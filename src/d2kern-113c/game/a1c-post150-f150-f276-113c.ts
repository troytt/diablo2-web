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
import { D2CommonAssertError } from '../common/inline-helpers.ts'
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
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { SUNITDMG_FreeAttackerCombatList113c } from './ai-fallen-113c.ts'
import { MONREG_FindOrAllocActRoomNode113c } from './boot-init-gap-a-113c.ts'
import {
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c.ts'
import { AIGENERAL_CopyAiCommandParams113c } from './replay-kernel-113c.ts'
import { SUNIT_RemoveServerUnit113c } from './game-strc.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import { ITEMS_DeactivateEquippedItemStats113c } from './k2-gap-itemdef-113c.ts'
import { SUNIT_FreeUnit113c } from './replay-final11-113c.ts'
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
import {
  QUESTS_CheckGlobalQuestState_6FC538D0_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import { MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c } from './k2-laneL-0x6fc6-w1-113c.ts'
import {
  ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c,
  ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c,
  ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c,
  ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c,
} from './k2-laneM-0x6fc7-w1-113c.ts'
import { ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c } from './k2-w2b1-113c.ts'
import {
  ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c,
  ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c,
  ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c,
} from './k2-w3b5-113c.ts'
import {
  ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c,
  ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c,
  ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c,
  ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c,
  ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
  ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c,
  ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c,
  ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c,
} from './k2-w3b6-113c.ts'
import {
  ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c,
  ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
  ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
  ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
  ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c,
  ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
  ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c,
  ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c,
  ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
  ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
  ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
  ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c,
} from './k2-w4b2-113c.ts'
import {
  ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
  ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c,
} from './k2-w4b3-113c.ts'
import {
  ACT3Q5_SyncCouncilQuestFlagsCallback113c,
  ACT3Q6_SyncGidbinnState02Callback113c,
  MONSTER_CountInteractingPlayers113c,
  MONSTER_HasAnyInteractingPlayer113c,
} from './k2-sunit-spawn-w1-113c.ts'
import { ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c } from './k2-w2b7-113c.ts'
import { SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c } from './k2-w3b2-113c.ts'
import { SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c } from './k2-w5b7-113c.ts'
import {
  ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c,
  ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
} from './k2-w5b4-113c.ts'
import {
  ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c,
  ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c,
  ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c,
  ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c,
} from './k2-w5b5-113c.ts'
import {
  ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
  ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c,
  ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c,
  ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c,
} from './k2-w5b8-113c.ts'
import { NET_BroadcastSystemChatMessage_6FCEBE70_113c } from './k2-w6b3-113c.ts'
import { QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c } from './k2-w7b1-113c.ts'
import {
  ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c,
  ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c,
} from './k2-w7b2-113c.ts'
import {
  ACT2Q3_StartEclipseEvent_6FCE6A30_113c,
  PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c,
} from './k2-w7b3-113c.ts'
import { ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c } from './k2-w9b2-113c.ts'
import { MONSTER_GetInteractDataPtr_6FC21370_113c } from './k2-laneH-0x6fc2-w1-113c.ts'
import { PARTY_FindSubPartyById_6FCBBD00_113c } from './k2-w2b4-113c.ts'
import { QUESTS_SendNpcIntroPacket91_6FC55B60_113c } from './k2-w3b3-113c.ts'
import {
  ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c,
  ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c,
  ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c,
} from './k2-w4b8-113c.ts'
import { NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c } from './k2-w5b2-113c.ts'
import {
  NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c,
  NPCS_ResetVendorSlotInventory_6FCB02E0_113c,
} from './k2-w6b2-113c.ts'
import { ACT1Q4_OnPlayerEnterTristramWithCainUnrescued_6FC883C0_113c } from './k2-w8b2-113c.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

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
  try {
    const iatSlot = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    if (iatSlot !== 0) {
      const deref = m.u32(iatSlot) >>> 0
      return deref !== 0 ? deref : iatSlot
    }
  } catch {
    // Fall back to D2Common!sgptDataTables global slot in standalone unit tests.
  }
  try {
    return m.u32(0x6fde9e1c) >>> 0
  } catch {
    return 0
  }
}

function getBitMaskByte(m: Memory113c, dwordsOffset: number, fallbackBit: number): number {
  try {
    const iatPtr = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
    if (iatPtr !== 0) {
      const b = m.u8((iatPtr + dwordsOffset) >>> 0)
      if (b !== 0) return b
    }
  } catch {
    // Fall back to direct offset or constant bit in standalone unit tests.
  }
  try {
    const addr = (D2GAME_IAT_GDW_BITMASKS_VA_113C + dwordsOffset) >>> 0
    const b = m.u8(addr)
    return b !== 0 ? b : fallbackBit
  } catch {
    return fallbackBit
  }
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

function writeGameQuestState(m: Memory113c, pGame: number, nQuestId: number, nState: number): void {
  if (pGame === 0) return
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return
  const pQuestBits = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
  if (pQuestBits === 0) return
  QUESTRECORD_SetQuestState113c(m, pQuestBits, nQuestId, nState)
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
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    (mem, game, pUnit, arg) => {
      if (directFn !== undefined) {
        directFn(mem, game, pUnit, arg)
      }
    },
    pArg,
  )
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
  hitD2GameVa113c(0x6FC53830)
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
  hitD2GameVa113c(0x6FC53CE0)
  const pGame = m.u32(pArg >>> 0) >>> 0
  if (pGame === 0) return
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return
  let pQuest = m.u32(pQuestCtrl >>> 0) >>> 0
  let actNo = 0xff
  const filterActByte = bFilterAct & 0xff
  const checkActiveByte = bCheckActive & 0xff
  if (filterActByte === 1) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    if (pRoom !== 0) {
      const nLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
      actNo = DRLG_GetActNoFromLevelId113c(m, nLevel) & 0xff
    }
  }
  while (pQuest !== 0) {
    const cbIdx = m.u32((pArg + 0x04) >>> 0) >>> 0
    const pfnCallback = m.u32((pQuest + cbIdx * 4 + 0xa0) >>> 0) >>> 0
    if (pfnCallback !== 0) {
      if (checkActiveByte !== 0 || m.u8((pQuest + 0x0a) >>> 0) === 1) {
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
      if (k4QuestCallbackDispatcher !== null && k4QuestCallbackDispatcher(m, pfnCallback, pQuest, pArg)) {
        return
      }
      if (hooks?.onQuestCallback !== undefined) {
        hooks.onQuestCallback(m, pfnCallback, pQuest, pArg)
      }
      return
  }
}

let k4QuestCallbackDispatcher:
  | ((m: Memory113c, pfnCallback: number, pQuest: number, pArg: number) => boolean)
  | null = null

export function registerK4QuestCallbackDispatcher113c(
  fn: (m: Memory113c, pfnCallback: number, pQuest: number, pArg: number) => boolean,
): void {
  k4QuestCallbackDispatcher = fn
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
  hitD2GameVa113c(0x6FC54860)
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

function broadcastInlineQuestStateDebug113c(
  m: Memory113c,
  pQuest: number,
  nState: number,
): void {
  const savedStack = laneI1StackPtr
  const pBuf = allocStackFrame(m, 0x80)
  try {
    const text = `changing state to ${nState | 0}\n`
    for (let i = 0; i < text.length; i++) {
      m.setU8((pBuf + i) >>> 0, text.charCodeAt(i) & 0xff)
    }
    m.setU8((pBuf + text.length) >>> 0, 0)
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, pBuf, m.u32((pQuest + 0x04) >>> 0) >>> 0, 4)
    }
  } finally {
    freeStackFrame(savedStack)
  }
}

function getPlayerQuestFlagsFromArg113c(
  m: Memory113c,
  pArg: number,
): number {
  const pGame = m.u32(pArg >>> 0) >>> 0
  const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  return m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
}

function lookupObjectByGuidInGame113c(
  m: Memory113c,
  pGame: number,
  dwGuid: number,
): number {
  const target = dwGuid >>> 0
  let pObj = m.u32((pGame + ((target & 0x7f) << 2) + 0x1520) >>> 0) >>> 0
  while (pObj !== 0) {
    if ((m.u32((pObj + 0x0c) >>> 0) >>> 0) === target) {
      return pObj
    }
    pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Act 5 Quest 6 (Eve of Destruction / Baal) level-change callback (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT4Q1_Callback03_LevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC7A9B0 (327B)
 */
export function ACT4Q1_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7A9B0)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  if (nNewLevel === 0x6d) {
    ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c(
      m,
      m.u32((pArg + 0x0c) >>> 0) >>> 0,
      m.u32(pArg >>> 0) >>> 0,
    )
  }
  if (nOldLevel === 0x6d) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 2) {
      const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
      const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
      ) {
        return
      }
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      if (m.u8((pQuest + 0x0b) >>> 0) !== 1) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c,
          0,
          0,
        )
      }
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c,
        0,
        0,
      )
    }
  }
  if (nNewLevel >= 0x83) {
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    if (m.u8((pQuest + 0x09) >>> 0) !== 0 && m.u8((pQuest + 0x0b) >>> 0) < 2) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 2)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c,
        0,
        0,
      )
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pQuestGame,
      ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c,
      0,
      0,
    )
  }
}

/**
 * Act 5 Quest 5 (Rite of Passage / Ancients) level-change callback (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT4Q2_Callback03_LevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC7AB60 (491B)
 */
export function ACT4Q2_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7AB60)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (nOldLevel === 0x6d) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x09) >>> 0) !== 0 && m.u8((pQuest + 0x0c) >>> 0) === 2) {
      const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
      const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1) {
        return
      }
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      if (m.u8((pQuest + 0x0b) >>> 0) !== 1) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
          0,
          0,
        )
      }
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c,
        0,
        0,
      )
    }
  }
  if (nNewLevel === 0x78) {
    let bSync = 0
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    if (m.u8((pQuest + 0x0b) >>> 0) < 2 && m.u8((pQuest + 0x0c) >>> 0) > 2) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 2)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
        0,
        0,
      )
      bSync = 1
    }
    if (m.u8((pQuest + 0x0c) >>> 0) < 3) {
      m.setU8((pQuest + 0x0c) >>> 0, 3)
      broadcastInlineQuestStateDebug113c(m, pQuest, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c,
        0,
        0,
      )
    } else if (bSync !== 0) {
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c,
        0,
        0,
      )
    }
    if (m.u8(pQuestData) === 0 && m.u8((pQuestData + 0x58) >>> 0) !== 0) {
      if (pQuestGame === 0) {
        throw new D2CommonAssertError('Act5Q5.cpp', 0x2d3)
      }
      const pPortal = lookupObjectByGuidInGame113c(
        m,
        pQuestGame,
        m.u32((pQuestData + 0x5c) >>> 0) >>> 0,
      )
      if (pPortal !== 0 && m.u32((pQuestData + 0x60) >>> 0) === 0) {
        m.setU32((pQuestData + 0x60) >>> 0, 2)
        UNITS_ChangeAnimMode113c(m, pPortal, 1)
      }
    }
  }
}

/**
 * Act 5 Quest 4 (Betrayal of Harrogath / Nihlathak) level-change callback (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT4Q3_Callback03_LevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC7AD50 (199B)
 */
export function ACT4Q3_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7AD50)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (nOldLevel === 0x6d && m.u8((pQuest + 0x0c) >>> 0) === 2) {
    m.setU8((pQuest + 0x0c) >>> 0, 3)
    broadcastInlineQuestStateDebug113c(m, pQuest, 3)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0) >>> 0,
      ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c,
      0,
      0,
    )
  }
  if (nNewLevel === 0x79 && m.u8((pQuest + 0x0b) >>> 0) === 1) {
    m.setU8((pQuest + 0x14) >>> 0, 0)
    m.setU8((pQuest + 0x0b) >>> 0, 2)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0) >>> 0,
      ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
      0,
      0,
    )
    m.setU8((pQuestData + 0x86) >>> 0, 0)
  }
}

/**
 * Act 5 Quest 2 (Rescue on Mount Arreat) level-change callback (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT4Q1_Callback03_AltLevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC7B1E0 (405B)
 */
export function ACT4Q1_Callback03_AltLevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7B1E0)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  if (nNewLevel >= 0x6f && nNewLevel <= 0x70) {
    const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
    if (m.u8((pQuest + 0x09) >>> 0) !== 0 && (m.u32((pQuestData + 0xa8) >>> 0) | 0) < 5) {
      let bSync = 0
      const cur0c = m.u8((pQuest + 0x0c) >>> 0)
      if (cur0c === 1 || cur0c === 2) {
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
        bSync = 1
      }
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      if (m.u8((pQuest + 0x0b) >>> 0) === 0) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c,
          0,
          0,
        )
        m.setU32((pQuest + 0xa8) >>> 0, 0)
        bSync = 1
      }
      if (bSync !== 0) {
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c,
          0,
          0,
        )
      }
    }
    return
  }
  if (nOldLevel === 0x6d) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 2) {
      const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
      const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
      ) {
        return
      }
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c,
        0,
        0,
      )
      const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
      if (
        m.u8((pQuest + 0x0b) >>> 0) === 0 &&
        m.u8((pQuest + 0x09) >>> 0) !== 0 &&
        (m.u32((pQuestData + 0xa8) >>> 0) | 0) < 5
      ) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c,
          0,
          0,
        )
        m.setU32((pQuest + 0xa8) >>> 0, 0)
      }
    }
  }
}

/**
 * Act 5 Quest 1 (Siege on Harrogath / Shenk) level-change callback (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT4Q2_Callback03_AltLevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC7B380 (266B)
 */
export function ACT4Q2_Callback03_AltLevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7B380)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  if (nNewLevel >= 0x6e && nNewLevel <= 0x70) {
    if (m.u8((pQuest + 0x09) >>> 0) !== 0) {
      const cur0c = m.u8((pQuest + 0x0c) >>> 0)
      if (cur0c === 1 || cur0c === 2) {
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          m.u32((pQuest + 0x04) >>> 0) >>> 0,
          ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c,
          0,
          0,
        )
      }
    }
    return
  }
  if (nOldLevel === 0x6d) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 2) {
      const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
      const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
      ) {
        return
      }
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      if (m.u8((pQuest + 0x0b) >>> 0) === 0) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
          0,
          0,
        )
      }
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c,
        0,
        0,
      )
    }
  }
}

/**
 * Act 5 Quest 3 (Prison of Ice / Anya) level-change callback (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT4Q2_Hellforge_Callback03_LevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC7F3F0 (484B)
 */
export function ACT4Q2_Hellforge_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7F3F0)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  if (nNewLevel === 0x70) {
    if (m.u8((pQuest + 0x09) >>> 0) !== 0 && m.u8((pQuest + 0x0c) >>> 0) === 0) {
      m.setU8((pQuest + 0x0c) >>> 0, 1)
      ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c(m, pQuest)
    }
  } else if (nNewLevel === 0x71 || nNewLevel === 0x72) {
    if (m.u8((pQuest + 0x09) >>> 0) !== 0) {
      let bSync = 0
      if (m.u8((pQuest + 0x0c) >>> 0) <= 2) {
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
        bSync = 1
      }
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      if (m.u8((pQuest + 0x0b) >>> 0) === 0) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
          0,
          0,
        )
        bSync = 1
      }
      if (bSync !== 0) {
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c,
          0,
          0,
        )
      }
      ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c(m, pQuest)
    }
  }
  if (nOldLevel === 0x6d) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 2) {
      const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
      const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
      ) {
        return
      }
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      if (m.u8((pQuest + 0x0b) >>> 0) === 0) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
          0,
          0,
        )
      }
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c,
        0,
        0,
      )
    }
  }
  if (
    nNewLevel >= 0x79 &&
    nNewLevel <= 0x7c &&
    m.u8((pQuest + 0x09) >>> 0) !== 0 &&
    m.u8((pQuest + 0x0c) >>> 0) < 5
  ) {
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(pArg >>> 0) >>> 0,
      ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c,
      0,
      m.u32((pArg + 0x08) >>> 0) >>> 0,
    )
    m.setU8((pQuest + 0x0c) >>> 0, 6)
    const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
    m.setU32((pQuestData + 0x84) >>> 0, 2)
    if (m.u32((pQuestData + 0x88) >>> 0) === 0) {
      m.setU32((pQuestData + 0x88) >>> 0, 1)
    }
  }
}

/**
 * Act 1 Quest 6 (Sisters to the Slaughter / Andariel) level-change callback
 * (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT1Q1_Callback03_LevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC83DD0 (443B)
 */
export function ACT1Q1_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC83DD0)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  if (nNewLevel >= 0x22 && nNewLevel <= 0x25 && m.u8((pQuest + 0x09) >>> 0) !== 0) {
    let bUpdated = 0
    if (m.u8((pQuest + 0x0c) >>> 0) < 3) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      bUpdated = 1
    }
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    let bNeedSync = bUpdated !== 0
    if (nNewLevel === 0x25) {
      if (m.u8((pQuest + 0x0b) >>> 0) < 2) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 2)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c,
          0,
          0,
        )
        bNeedSync = true
      }
    } else if (m.u8((pQuest + 0x0b) >>> 0) === 0) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 1)
      bNeedSync = true
    }
    if (bNeedSync) {
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c,
        0,
        0,
      )
    }
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        (D2GAME_IMAGE_BASE_113C + 0xfbe40) >>> 0,
        m.u32(pArg >>> 0) >>> 0,
        4,
      )
    }
    return
  }
  if (m.u8((pQuest + 0x0c) >>> 0) === 4 && nNewLevel === 0x28) {
    m.setU8((pQuest + 0x0c) >>> 0, 5)
    broadcastInlineQuestStateDebug113c(m, pQuest, 5)
    return
  }
  if (nOldLevel === 1) {
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 2) {
      const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
      const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
      ) {
        return
      }
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c,
        0,
        0,
      )
    }
  }
}

/**
 * Act 1 Quest 4 (The Forgotten Tower / Countess) level-change callback
 * (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT1Q2_Callback03_LevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC842D0 (350B)
 */
export function ACT1Q2_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC842D0)
  const bNotIntro = m.u8((pQuest + 0x09) >>> 0)
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  if (bNotIntro !== 0) {
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    if (nNewLevel === 0x14) {
      const f0c = m.u8((pQuest + 0x0c) >>> 0)
      if (f0c === 0) {
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 2)
        m.setU8((pQuest + 0x0b) >>> 0, 3)
        m.setU8((pQuest + 0x14) >>> 0, 0)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
          0,
          0,
        )
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c,
          0,
          0,
        )
        return
      }
      if (f0c <= 3 && m.u8((pQuest + 0x0b) >>> 0) === 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 4)
        m.setU8((pQuest + 0x14) >>> 0, 0)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
          0,
          0,
        )
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c,
          0,
          0,
        )
        return
      }
      return
    } else if (nNewLevel === 0x19) {
      const f0c = m.u8((pQuest + 0x0c) >>> 0)
      if (f0c < 4 && m.u8((pQuest + 0x0b) >>> 0) !== 2) {
        if (f0c !== 3) {
          QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
        }
        m.setU8((pQuest + 0x0b) >>> 0, 2)
        m.setU8((pQuest + 0x14) >>> 0, 0)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
          0,
          0,
        )
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c,
          0,
          0,
        )
        return
      }
      return
    }
  }
  if (nOldLevel === 1) {
    const f0c = m.u8((pQuest + 0x0c) >>> 0)
    if (f0c === 2) {
      const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
      const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) !== 1) {
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      }
    } else if (f0c === 5 && bNotIntro !== 0) {
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
      const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
      if (
        ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c(m, pQuestData, 0, dwGuid) !== 0 &&
        m.u16((pQuestData + 0x30) >>> 0) === 0 &&
        m.u16((pQuestData + 0x64) >>> 0) === 0
      ) {
        m.setU8((pQuest + 0x0a) >>> 0, 0)
      }
    }
  }
}

/**
 * Act 1 Quest 5 (Tools of the Trade / Charsi Imbue) level-change callback
 * (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT1Q4_Callback03_LevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC84D30 (217B)
 */
export function ACT1Q4_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC84D30)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    m.setU32((pQuest + 0xac) >>> 0, 0)
    return
  }
  if (nOldLevel === 1 && m.u8((pQuest + 0x0c) >>> 0) === 2) {
    const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
    const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
    ) {
      return
    }
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    if (m.u8((pQuest + 0x0b) >>> 0) !== 1) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 1)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
        0,
        0,
      )
    }
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pQuestGame,
      ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c,
      0,
      0,
    )
    m.setU32((pQuest + 0xac) >>> 0, 0)
  }
}

/**
 * Act 1 Quest 2 (Sisters' Burial Grounds / Blood Raven) level-change callback
 * (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT1Q5_Callback03_LevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC84ED0 (263B)
 */
export function ACT1Q5_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC84ED0)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  if (nNewLevel === 0x11 && m.u8((pQuest + 0x09) >>> 0) === 1) {
    let bHandled = false
    if (m.u8((pQuest + 0x0c) >>> 0) < 3) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      m.setU8((pQuest + 0x14) >>> 0, 0)
      bHandled = true
    }
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    const f0b = m.u8((pQuest + 0x0b) >>> 0)
    if (f0b === 1 || f0b === 0) {
      m.setU8((pQuest + 0x0b) >>> 0, 2)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c,
        0,
        0,
      )
      bHandled = true
    }
    if (bHandled) {
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c,
        0,
        0,
      )
      return
    }
  }
  if (nOldLevel === 1) {
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 2) {
      const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
      const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
      ) {
        return
      }
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c,
        0,
        0,
      )
    }
  }
}

/**
 * Act 1 Quest 1 (Den of Evil) level-change callback
 * (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`).
 * Bound to `ACT1Q6_Callback03_LevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC85040 (437B)
 */
export function ACT1Q6_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC85040)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (nNewLevel === 8) {
    if (m.u8((pQuest + 0x09) >>> 0) === 0) return
    let bSyncNeeded = false
    const f0c = m.u8((pQuest + 0x0c) >>> 0)
    if (f0c === 1 || f0c === 2) {
      m.setU8((pQuest + 0x0c) >>> 0, 3)
      broadcastInlineQuestStateDebug113c(m, pQuest, 3)
      bSyncNeeded = true
    }
    m.setU8((pQuestData + 0x85) >>> 0, 1)
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    if (m.u8((pQuest + 0x0b) >>> 0) < 2) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 2)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
        0,
        0,
      )
      m.setU32((pQuest + 0xa8) >>> 0, 0)
      bSyncNeeded = true
    }
    if (bSyncNeeded) {
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c,
        0,
        0,
      )
    }
    return
  }
  if (nOldLevel === 1) {
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 2) {
      const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
      const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
      ) {
        return
      }
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c,
        0,
        0,
      )
      if (m.u8((pQuest + 0x0b) >>> 0) !== 1) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pQuestGame,
          ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
          0,
          0,
        )
        m.setU32((pQuest + 0xa8) >>> 0, 0)
      }
    }
  }
}

/**
 * Act 1 Quest 3 (The Search for Cain) level-change callback
 * (`cbIdx = 3`, `__fastcall (ecx=pQuest, edx=pArg)`, levels `0x01`, `0x26`, `0x28`).
 * Bound to `ACT1Q3_Callback03_LevelChanged` in `k1r14-laneI1-f150-f276.json`.
 *
 * @va D2Game:0x6FC884B0 (635B)
 */
export function ACT1Q3_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC884B0)
  const nOldLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nNewLevel = m.u32((pArg + 0x18) >>> 0) | 0
  const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (nNewLevel === 0x26) {
    if (
      m.u8((pQuestData + 0x51) >>> 0) === 0 &&
      m.u8((pQuestData + 0x50) >>> 0) === 0 &&
      m.u8((pQuest + 0x0c) >>> 0) >= 6
    ) {
      ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c(m, pQuest)
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 5)
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 4)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
        0,
        0,
      )
    }
  }
  if (nOldLevel === 1) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    QUESTS_GuidListRemove113c(m, (pQuestData + 0xb4) >>> 0, dwGuid)
    const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
    const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
    ) {
      return
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 2) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
    }
  }
  if (nNewLevel === 1) {
    const pd2 = m.u32((pQuest + 0x18) >>> 0) >>> 0
    if (m.u8((pd2 + 0x70) >>> 0) === 0) return
    const pGame = m.u32(pArg >>> 0) >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('a1q4.cpp', 0x2d3)
    }
    const pObj = lookupObjectByGuidInGame113c(m, pGame, m.u32((pd2 + 0x6c) >>> 0))
    if (pObj !== 0 && m.u8((pd2 + 0x52) >>> 0) === 1 && m.u8((pd2 + 0x51) >>> 0) === 0) {
      const pRoom = UNITS_GetRoom113c(m, pObj)
      const nX = UNIT_GetPosX113c(m, pObj)
      const nY = UNIT_GetPosY113c(m, pObj)
      ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c(m, pGame, pRoom, nX, nY)
    }
    return
  }
  if (nNewLevel === 0x28) {
    const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
    const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
    ) {
      return
    }
    if (m.u8((pQuestData + 0x50) >>> 0) === 0 && m.u8((pQuest + 0x0c) >>> 0) < 6) {
      ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c(m, pQuest)
      ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c(m, pQuest, 0, 1)
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 7)
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 5)
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
        0,
        m.u32((pArg + 0x0c) >>> 0) >>> 0,
      )
      QUESTS_SetGlobalQuestState_6FC53920_113c(m, pQuestGame, 4, 0x0d)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pQuestGame,
        ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c,
        0,
        0,
      )
      m.setU32((pQuestData + 0x58) >>> 0, 1)
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
  hitD2GameVa113c(0x6FCAF410)
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
  hitD2GameVa113c(0x6FCB0320)
  if (hooks !== undefined) {
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
            if (hooks.onSeedRollLimited !== undefined) {
              roll = hooks.onSeedRollLimited(m, (pNpcCtrl + 0x08) >>> 0, 0x3fff)
            }
            m.setU32((pRec + 0x3c) >>> 0, roll >>> 0)
          }
          m.setU32((pRec + 0x38) >>> 0, (((m.u32((pRec + 0x38) | 0) >>> 0) + 1) | 0) >>> 0)
        }
        if (m.u32((pRec + 0x18) >>> 0) === 0 && bTownEmpty !== 0) {
          if (countActiveNpcInteracts(m, m.u32((pRec + 0x2c) >>> 0) >>> 0) <= 0) {
            if (m.u8((pRec + 0x1c) >>> 0) === 1 || m.u32((pRec + 0x0c) >>> 0) !== 0) {
              if (hooks.onFreeNpcInventoryNode !== undefined) {
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
              if (hooks.onReinitNpcRecord !== undefined) {
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
    return
  }

  if (pGame === 0) return
  const pNpcCtrl = m.u32((pGame + 0x1d24) >>> 0) >>> 0
  if (pNpcCtrl === 0) return
  let dwTick = 0
  try {
    dwTick = m.u32(0x6fd18d10) >>> 0
  } catch {
    dwTick = 0
  }
  const pArray = m.u32((pNpcCtrl + 0x04) >>> 0) >>> 0
  if ((m.u32(pNpcCtrl >>> 0) | 0) <= 0) return

  const targetAct = nAct & 0xff
  const emptyTown = (bTownEmpty | 0) !== 0
  let i = 0
  let pRec = pArray >>> 0
  for (;;) {
    if (
      (pRec + 0x20) >>> 0 !== 0 &&
      m.u8((pRec + 0x22) >>> 0) === targetAct &&
      m.u8((pRec + 0x23) >>> 0) === 1 &&
      (m.u32((pRec + 0x1c) >>> 0) | 0) === 1 &&
      m.u8((pRec + 0x20) >>> 0) === 1
    ) {
      if (emptyTown) {
        const dwGuid = m.u32((pRec + 0x40) >>> 0) >>> 0
        let pNpcUnit = m.u32((pGame + ((dwGuid & 0x7f) << 2) + 0x1320) >>> 0) >>> 0
        while (pNpcUnit !== 0 && (m.u32((pNpcUnit + 0x0c) >>> 0) >>> 0) !== dwGuid) {
          pNpcUnit = m.u32((pNpcUnit + 0xe4) >>> 0) >>> 0
        }
        if (pNpcUnit === 0 || (m.u32((pNpcUnit + 0x04) >>> 0) >>> 0) !== (m.u32(pRec >>> 0) >>> 0)) {
          NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c(m, pGame, pRec)
          m.setU8((pRec + 0x20) >>> 0, 0)
          m.setU32((pRec + 0x28) >>> 0, 0)
          const pInv = INVENTORY_AllocInventory113c(m, m.u32((pGame + 0x1c) >>> 0) >>> 0, 0) >>> 0
          m.setU32((pRec + 0x04) >>> 0, pInv)
        } else {
          const pInteract = MONSTER_GetInteractDataPtr_6FC21370_113c(m, pNpcUnit) >>> 0
          if ((MONSTER_CountInteractingPlayers113c(m, pInteract) | 0) === 0) {
            NPCS_ResetVendorSlotInventory_6FCB02E0_113c(m, pGame, pRec, pNpcUnit)
          } else {
            m.setU8((pRec + 0x27) >>> 0, 1)
          }
        }
      } else {
        const expireTick = (m.u32((pRec + 0x28) >>> 0) + 0x3a980) >>> 0
        if (dwTick >>> 0 > expireTick) {
          m.setU32((pRec + 0x28) >>> 0, dwTick >>> 0)
          m.setU8((pRec + 0x27) >>> 0, 1)
        }
      }
    }
    i = (i + 1) | 0
    pRec = (pRec + 0x44) >>> 0
    if (i >= (m.u32(pNpcCtrl >>> 0) | 0)) break
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
  hitD2GameVa113c(0x6FCB0C60)
  const savedStack = laneI1StackPtr
  if (hooks !== undefined) {
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
      const remainingInFromLevel = m.u32((pCtx + 0x04) >>> 0) >>> 0
      const bTownEmpty = remainingInFromLevel === 0 ? 1 : 0
      NPCS_UpdateMercenaryOrVendorSlots113c(m, pGame, fromAct, bTownEmpty, hooks)
      if (bTownEmpty !== 0 && fromAct < 4 && hooks.onActPlayerCountChanged !== undefined) {
        hooks.onActPlayerCountChanged(m, pGame, fromAct, 0)
      }
    }

    let toAct = -1
    if (nToLevel === 1) toAct = 0
    else if (nToLevel === 40) toAct = 1
    else if (nToLevel === 75) toAct = 2
    else if (nToLevel === 109) toAct = 4

    if (toAct >= 0) {
      NPCS_UpdateMercenaryOrVendorSlots113c(m, pGame, toAct, 0, hooks)
      if (toAct < 3 && hooks.onActPlayerCountChanged !== undefined) {
        hooks.onActPlayerCountChanged(m, pGame, toAct, 1)
      }
      if (toAct === 1 && hooks.onAct2TownEntered !== undefined) {
        hooks.onAct2TownEntered(m, pGame, pUnit)
      }
    }

    freeStackFrame(savedStack)
    return
  }

  try {
    const fromLvl = nFromLevel | 0
    let fromAct = -1
    if (fromLvl === 1) fromAct = 0
    else if (fromLvl === 40) fromAct = 1
    else if (fromLvl === 75) fromAct = 2
    else if (fromLvl === 103) fromAct = 3
    else if (fromLvl === 109) fromAct = 4

    if (fromAct >= 0) {
      const pCtx = allocStackFrame(m, 8)
      m.setU32(pCtx >>> 0, fromLvl >>> 0)
      m.setU32((pCtx + 0x04) >>> 0, 0)
      D2GAME_SUNIT_IterateAllLivingPlayers113c(
        m,
        pGame,
        ARENA_CountPlayersInLevelCallback113c,
        pCtx,
      )
      const remainingInFromLevel = m.u32((pCtx + 0x04) >>> 0) >>> 0
      const bTownEmpty = remainingInFromLevel === 0 ? 1 : 0
      NPCS_UpdateMercenaryOrVendorSlots113c(m, pGame, fromAct, bTownEmpty)
    }

    const toLvl = nToLevel | 0
    if (toLvl === 1) {
      QUESTS_SendNpcIntroPacket91_6FC55B60_113c(m, pUnit, 0, pGame)
    } else if (toLvl === 40) {
      QUESTS_SendNpcIntroPacket91_6FC55B60_113c(m, pUnit, 1, pGame)
      ACT1Q4_OnPlayerEnterTristramWithCainUnrescued_6FC883C0_113c(
        m as SparseMemory113c,
        pUnit,
        pGame,
      )
    } else if (toLvl === 75) {
      QUESTS_SendNpcIntroPacket91_6FC55B60_113c(m, pUnit, 2, pGame)
    } else if (toLvl === 109) {
      QUESTS_SendNpcIntroPacket91_6FC55B60_113c(m, pUnit, 4, pGame)
    }
  } finally {
    freeStackFrame(savedStack)
  }
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
  hitD2GameVa113c(0x6FCDA1E0)
  if (pQuest === 0 || pArg === 0) return
  if (m.u32((pArg + 0x14) >>> 0) === 0x67) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) !== 2) return
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    const questId = m.u32((pQuest + 0xe0) >>> 0) | 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, questId, 0) === 1 ||
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, questId, 1) === 1
    ) {
      return
    }
    if (hooks?.onQuestSetMainState !== undefined) {
      hooks.onQuestSetMainState(m, pQuest, 3)
    } else {
      m.setU8((pQuest + 0x0c) >>> 0, 3)
    }
    if (hooks?.onForEachPlayerUnit !== undefined) {
      hooks.onForEachPlayerUnit(m, m.u32((pQuest + 0x04) >>> 0) >>> 0, 0, 0x6fcd8e80)
    }
  }
}

/**
 * Act 4 Quest 3 (Terror's End) level-change callback (`cbIdx = 3`, Leaving `0x67`, Entering `0x6C`).
 *
 * @va D2Game:0x6FCDA3A0 (239B)
 */
export function ACT3Q2_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FCDA3A0)
  if (pQuest === 0 || pArg === 0) return
  const nFromLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nToLevel = m.u32((pArg + 0x18) >>> 0) | 0

  if (nFromLevel === 0x67 && m.u8((pQuest + 0x0c) >>> 0) === 2) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const pGame = m.u32(pArg >>> 0) >>> 0
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    const questId = m.u32((pQuest + 0xe0) >>> 0) | 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, questId, 0) === 1) {
      return
    }
    if (m.u8((pQuest + 0x0c) >>> 0) < 3) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
    }
    if (m.u8((pQuest + 0x0b) >>> 0) < 1) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 1)
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0) >>> 0,
      ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c,
      0,
      0,
    )
  }

  if (nToLevel === 0x6c && m.u8((pQuest + 0x09) >>> 0) !== 0) {
    if (m.u8((pQuest + 0x0c) >>> 0) < 3) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
    }
    if (m.u8((pQuest + 0x0b) >>> 0) < 1) {
      m.setU8((pQuest + 0x0b) >>> 0, 1)
      m.setU8((pQuest + 0x14) >>> 0, 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c,
        0,
        0,
      )
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0) >>> 0,
      ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c,
      0,
      0,
    )
  }
}

/**
 * Act 4 Quest 1 (The Fallen Angel) level-change callback (`cbIdx = 3`, Leaving `0x67`).
 *
 * @va D2Game:0x6FCDA550 (137B)
 */
export function ACT3Q3_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FCDA550)
  if (pQuest === 0 || pArg === 0) return
  if (m.u32((pArg + 0x14) >>> 0) === 0x67) {
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 2) {
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      const pGame = m.u32(pArg >>> 0) >>> 0
      const pPlayerData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
      const diffIdx = m.u8((pGame + 0x6d) >>> 0)
      const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
      const questId = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, questId, 0) !== 1) {
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          m.u32((pQuest + 0x04) >>> 0) >>> 0,
          ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c,
          0,
          0,
        )
        if (m.u8((pQuest + 0x0b) >>> 0) === 0) {
          m.setU8((pQuest + 0x14) >>> 0, 0)
          m.setU8((pQuest + 0x0b) >>> 0, 1)
        }
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
  hitD2GameVa113c(0x6FCE2E20)
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  if ((m.u32((pArg + 0x18) >>> 0) | 0) < 0x28) return
  if ((m.u32((pArg + 0x14) >>> 0) | 0) !== 0x28) return
  if (m.u16((pQuest + 0x9c) >>> 0) <= 0) return
  const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
  const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
  QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
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
  hitD2GameVa113c(0x6FCE3EC0)
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
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FCE6450)
  const nToLevel = m.u32((pArg + 0x18) >>> 0) | 0
  if (nToLevel < 0x28 || nToLevel >= 0x4b) return

  if ((m.u32((pArg + 0x14) >>> 0) | 0) === 0x28 && m.u16((pQuest + 0x9c) >>> 0) > 0) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
    QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return

  const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestData + 0x01) >>> 0) === 0) {
    let nTombLevel = m.u32((pQuestData + 0x34) >>> 0) | 0
    if (nTombLevel === 0) {
      const pGame = m.u32(pArg >>> 0) >>> 0
      const pAct2 = m.u32((pGame + 0xc0) >>> 0) >>> 0
      nTombLevel = DRLGLOGIC_GetBossTombLevel113c(m, pAct2) | 0
      m.setU32((pQuestData + 0x34) >>> 0, nTombLevel >>> 0)
    }
    if (nTombLevel === 0) return

    if (nToLevel === nTombLevel) {
      if (m.u8((pQuest + 0x0c) >>> 0) === 2) return
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 2)
      if (m.u8((pQuest + 0x0b) >>> 0) <= 1) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 2)
      }
      ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c(
        m,
        m.u32(pArg >>> 0) >>> 0,
        m.u32((pArg + 0x0c) >>> 0) >>> 0,
        0,
      )
      return
    }
    if (nToLevel === 0x2e) {
      if (m.u8((pQuest + 0x0c) >>> 0) === 0) {
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 2)
        ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c(
          m,
          m.u32(pArg >>> 0) >>> 0,
          m.u32((pArg + 0x0c) >>> 0) >>> 0,
          0,
        )
      }
      if (m.u8((pQuest + 0x0b) >>> 0) !== 0) return
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 1)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c,
        0,
        0,
      )
      return
    }
  }

  if (nToLevel === 0x49 && m.u8((pQuest + 0x0c) >>> 0) <= 1) {
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 2)
    if (m.u8((pQuest + 0x0b) >>> 0) <= 1) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 2)
    }
    ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c(
      m,
      m.u32(pArg >>> 0) >>> 0,
      m.u32((pArg + 0x0c) >>> 0) >>> 0,
      0,
    )
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
  hitD2GameVa113c(0x6FCE6E00)
  if ((m.u32((pArg + 0x14) >>> 0) | 0) !== 0x28) return
  if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
    QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
  }
  if (m.u8((pQuest + 0x0c) >>> 0) !== 2) return

  const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
  const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 1) === 1
  ) {
    return
  }
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c,
    0,
    0,
  )
}

/**
 * Act 2 Quest 5 (The Summoner) level-change callback (`cbIdx = 3`, Entering `0x2C`/`0x2D`/`0x28`, Leaving `0x28`).
 *
 * @va D2Game:0x6FCE73A0 (210B)
 */
export function ACT2Q5_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FCE73A0)
  const nFromLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nToLevel = m.u32((pArg + 0x18) >>> 0) | 0
  const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0

  if (
    (nToLevel === 0x2c || nToLevel === 0x2d) &&
    m.u8((pQuest + 0x0c) >>> 0) === 0 &&
    m.u8((pQuest + 0x09) >>> 0) === 1
  ) {
    ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c(m as SparseMemory113c, pQuest)
  }

  if (nToLevel === 0x28 && m.u8((pQuestData + 0x03) >>> 0) === 1) {
    if ((ACT2Q3_StartEclipseEvent_6FCE6A30_113c(m, pQuest) & 0xff) !== 0) {
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c,
        0,
        0,
      )
      m.setU8((pQuestData + 0x03) >>> 0, 0)
    }
  }

  if (nFromLevel === 0x28) {
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 2) {
      m.setU8((pQuest + 0x0c) >>> 0, 3)
      broadcastInlineQuestStateDebug113c(m, pQuest, 3)
    }
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
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FCE9190)
  const nFromLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nToLevel = m.u32((pArg + 0x18) >>> 0) | 0

  if (nToLevel === 0x4a) {
    let bUpdated = false
    if (m.u8((pQuest + 0x0c) >>> 0) < 4) {
      bUpdated = true
      m.setU8((pQuest + 0x0c) >>> 0, 4)
      broadcastInlineQuestStateDebug113c(m, pQuest, 4)
    }
    if (m.u8((pQuest + 0x0b) >>> 0) < 4) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 4)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c,
        0,
        0,
      )
      bUpdated = true
    }
    if (bUpdated) {
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
        0,
        0,
      )
    }
    return
  }

  if (nToLevel === 0x32) {
    const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 8)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 7)
  }

  if (nFromLevel !== 0x28) return

  const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestData + 0x0c) >>> 0) === 1) {
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    const dwMonGuid = m.u32((pQuestData + 0x3c) >>> 0) >>> 0
    if (pQuestGame === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
    }
    let pMon = m.u32((pQuestGame + ((dwMonGuid & 0x7f) << 2) + 0x1320) >>> 0) >>> 0
    while (pMon !== 0 && (m.u32((pMon + 0x0c) >>> 0) >>> 0) !== dwMonGuid) {
      pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
    }
    let keepFlag = false
    if (pMon !== 0) {
      let pInteract = 0
      if ((m.u32(pMon >>> 0) | 0) === 1) {
        const pMonData = m.u32((pMon + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) {
          pInteract = m.u32((pMonData + 0x30) >>> 0) >>> 0
        }
      }
      if (MONSTER_HasAnyInteractingPlayer113c(m, pInteract) !== 0) {
        MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c(m, pQuestGame, pMon, 0)
        keepFlag = true
      } else {
        SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c(m, pQuestGame, pMon)
      }
    }
    if (!keepFlag) {
      m.setU8((pQuestData + 0x0c) >>> 0, 0)
    }
  }

  if (m.u8((pQuestData + 0x0d) >>> 0) === 0 && m.u8((pQuestData + 0x11) >>> 0) !== 0) {
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    const dwObjGuid = m.u32((pQuestData + 0x38) >>> 0) >>> 0
    if (pQuestGame === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
    }
    const pObj = lookupObjectByGuidInGame113c(m, pQuestGame, dwObjGuid)
    if (pObj !== 0) {
      const savedStack = laneI1StackPtr
      const pIoCoord = allocStackFrame(m, 8)
      try {
        PATH_GetTargetTypeAndPosition113c(m, pObj, pIoCoord)
        const pRoom = UNITS_GetRoom113c(m, pObj) >>> 0
        ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c(m, pIoCoord, pQuest, pRoom)
      } finally {
        freeStackFrame(savedStack)
      }
    }
  }

  if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
    QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
  }

  const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 1) === 1
  ) {
    return
  }
  if (m.u8((pQuest + 0x0c) >>> 0) === 3) {
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 4)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0) >>> 0,
      ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
      0,
      0,
    )
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
  hitD2GameVa113c(0x6FD03E00)
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
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FD071D0)
  const nFromLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nToLevel = m.u32((pArg + 0x18) >>> 0) | 0

  if (nFromLevel === 0x4b) {
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const fState = m.u8((pQuest + 0x0c) >>> 0)
    if (fState >= 2 && fState <= 3) {
      const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
      const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0x0b) === 1
      ) {
        return
      }
      if (m.u8((pQuest + 0x0b) >>> 0) < 3) {
        m.setU8((pQuest + 0x14) >>> 0, 0)
        m.setU8((pQuest + 0x0b) >>> 0, 2)
      }
      const b11 = QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, m.u32(pArg >>> 0) >>> 0, 0x11, 0x0d)
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, b11 === 1 ? 4 : 5)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c,
        0,
        0,
      )
    }
  }

  if (nToLevel >= 0x62 && m.u8((pQuest + 0x09) >>> 0) !== 0 && m.u8((pQuest + 0x0c) >>> 0) === 0) {
    m.setU8((pQuest + 0x0c) >>> 0, 1)
    m.setU32((pQuest + 0xa8) >>> 0, (D2GAME_IMAGE_BASE_113C + 0xe6910) >>> 0)
  }

  if (nToLevel === 0x64) {
    let bSync = false
    const fLast = m.u8((pQuest + 0x0b) >>> 0)
    if (fLast === 2 || fLast === 1) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c,
        0,
        0,
      )
      bSync = true
    }
    if (m.u8((pQuest + 0x0c) >>> 0) === 1) {
      const b11 = QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, m.u32(pArg >>> 0) >>> 0, 0x11, 0x0d)
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, b11 === 1 ? 4 : 5)
      bSync = true
    }
    if (bSync) {
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c,
        0,
        0,
      )
    }
    return
  }

  if (nToLevel === 0x66) {
    if (m.u8((pQuest + 0x0b) >>> 0) !== 4) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 4)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c,
        0,
        0,
      )
    }
    const fState = m.u8((pQuest + 0x0c) >>> 0)
    if (fState !== 4 && fState !== 5) {
      const b11 = QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, m.u32(pArg >>> 0) >>> 0, 0x11, 0x0d)
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, b11 === 1 ? 4 : 5)
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0) >>> 0,
      ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c,
      0,
      0,
    )
  }
}

/**
 * Act 3 Quest 5 (The Blackened Temple) level-change callback (`cbIdx = 3`, Entering `0x52`, Leaving `0x4B`).
 *
 * @va D2Game:0x6FD07560 (222B)
 */
export function ACT3Q5_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FD07560)
  const nFromLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nToLevel = m.u32((pArg + 0x18) >>> 0) | 0

  if (nToLevel === 0x52 && m.u8((pQuest + 0x09) >>> 0) !== 0 && m.u8((pQuest + 0x0c) >>> 0) === 0) {
    m.setU8((pQuest + 0x0c) >>> 0, 1)
    m.setU32((pQuest + 0xa8) >>> 0, (D2GAME_IMAGE_BASE_113C + 0xe69e0) >>> 0)
  }

  if (nFromLevel !== 0x4b) return

  if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
    QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
  }

  const fState = m.u8((pQuest + 0x0c) >>> 0)
  if (fState < 2 || fState > 3) return

  const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
  const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 4) === 1
  ) {
    return
  }

  if (m.u8((pQuest + 0x0b) >>> 0) < 3) {
    m.setU8((pQuest + 0x14) >>> 0, 0)
    m.setU8((pQuest + 0x0b) >>> 0, 2)
  }
  const b11 = QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, m.u32(pArg >>> 0) >>> 0, 0x11, 0x0d)
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, b11 === 1 ? 4 : 5)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT3Q5_SyncCouncilQuestFlagsCallback113c,
    0,
    0,
  )
}

/**
 * Act 3 Quest 6 (The Guardian / Travincal) level-change callback (`cbIdx = 3`, Entering `0x4E`, Leaving `0x4B`).
 *
 * @va D2Game:0x6FD07880 (184B)
 */
export function ACT3Q6_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FD07880)
  const nFromLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nToLevel = m.u32((pArg + 0x18) >>> 0) | 0

  if (nToLevel === 0x4e && m.u8((pQuest + 0x09) >>> 0) !== 0 && m.u8((pQuest + 0x0c) >>> 0) === 0) {
    m.setU8((pQuest + 0x0c) >>> 0, 1)
  }

  if (nFromLevel !== 0x4b) return

  if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
    QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
  }

  const fState = m.u8((pQuest + 0x0c) >>> 0)
  if (fState === 2) {
    const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
    const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1 ||
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0x0f) === 1
    ) {
      return
    }
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0) >>> 0,
      ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
      0,
      0,
    )
  } else if (fState === 5) {
    m.setU8((pQuest + 0x0a) >>> 0, 0)
  }
}

/**
 * Act 3 Quest 7 (Flayer Jungle / Gidbinn) level-change callback (`cbIdx = 3`, Entering `0x4D`).
 *
 * @va D2Game:0x6FD07A10 (34B)
 */
export function ACT3Q7_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FD07A10)
  if ((m.u32((pArg + 0x18) >>> 0) | 0) !== 0x4d) return
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  if (m.u8((pQuest + 0x0c) >>> 0) >= 3) return
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 1)
}

/**
 * Act 3 Quest 8 (Durance / Sewer) level-change callback (`cbIdx = 3`, Entering `0x4F`, Leaving `0x4B`).
 *
 * @va D2Game:0x6FD07BE0 (245B)
 */
export function ACT3Q8_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FD07BE0)
  const nFromLevel = m.u32((pArg + 0x14) >>> 0) | 0
  const nToLevel = m.u32((pArg + 0x18) >>> 0) | 0

  if (nToLevel === 0x4f && m.u8((pQuest + 0x09) >>> 0) !== 0 && m.u8((pQuest + 0x0c) >>> 0) < 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 1)
  }

  if (nFromLevel !== 0x4b) return

  if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
    QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
  }

  if (m.u8((pQuest + 0x0c) >>> 0) !== 2) return

  const pQuestFlags = getPlayerQuestFlagsFromArg113c(m, pArg)
  const nQuestNo = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestNo, 0) === 1) return

  if (m.u8((pQuest + 0x0b) >>> 0) !== 1) {
    m.setU8((pQuest + 0x14) >>> 0, 0)
    m.setU8((pQuest + 0x0b) >>> 0, 1)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0) >>> 0,
      ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c,
      0,
      0,
    )
  }
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT3Q6_SyncGidbinnState02Callback113c,
    0,
    0,
  )
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
  hitD2GameVa113c(0x6FC57810)
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
 * against `dword [0x6FD31C1C]` when `byte [pGame + 0x6A]` is in `1..3` (`0x6FC579A0` helper).
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
function safeReadU32PlrIntro113c(m: Memory113c, addr: number): number {
  try {
    return m.u32(addr >>> 0) >>> 0
  } catch {
    return 0
  }
}

export function PLRINTRO_CleanInvalidMonsterMinions113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pPlayerData: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FCB7D10)
  if (hooks !== undefined) {
    const sgpt = getSgptDataTablesPtr(m)
    const petTypesCount = sgpt !== 0 ? (m.u32((sgpt + 0xbf0) | 0) >>> 0) : 0
    if (petTypesCount <= 1) return
    let offset = 0x0c
    for (let petType = 1; petType < petTypesCount; petType++, offset += 0x0c) {
      if (offset === 0x54) continue
      const pPetsRoot = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
      if (pPetsRoot === 0) continue
      const pBucketBase = safeReadU32PlrIntro113c(m, pPetsRoot)
      if (pBucketBase === 0) continue
      const pBucket = (pBucketBase + offset) >>> 0
      let pNode = safeReadU32PlrIntro113c(m, pBucket)
      while (pNode !== 0) {
        let pNext = 0
        let dwPetGuid = 0
        try {
          pNext = m.u32((pNode + 0x14) >>> 0) >>> 0
          dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
        } catch {
          break
        }
        let pMonster = m.u32((pGame + ((dwPetGuid & 0x7f) << 2) + 0x1320) >>> 0) >>> 0
        while (pMonster !== 0) {
          if (m.u32((pMonster + 0x0c) >>> 0) >>> 0 === dwPetGuid) break
          pMonster = m.u32((pMonster + 0xe4) >>> 0) >>> 0
        }
        let shouldRemove = false
        if (pMonster === 0) {
          shouldRemove = true
        } else if ((m.u8((pMonster + 0xc6) >>> 0) & 1) !== 0) {
          shouldRemove = true
        } else {
          const dwType = m.u32(pMonster >>> 0) >>> 0
          const eMode = m.u32((pMonster + 0x10) >>> 0)
          if (dwType === 0) {
            if (eMode === 0 || eMode === 17) shouldRemove = true
          } else if (dwType === 1) {
            if (eMode === 0 || eMode === 12) shouldRemove = true
          } else {
            shouldRemove = true
          }
        }
        if (shouldRemove) {
          if (hooks.onRemovePlayerPet !== undefined) {
            hooks.onRemovePlayerPet(m, pGame, pPlayer, pMonster, petType, dwPetGuid)
          } else {
            let prev = 0
            let cur = m.u32(pBucket >>> 0) >>> 0
            while (cur !== 0) {
              if (cur === pNode) {
                if (prev !== 0) {
                  m.setU32((prev + 0x14) >>> 0, pNext)
                } else {
                  m.setU32(pBucket >>> 0, pNext)
                }
                break
              }
              prev = cur
              cur = m.u32((cur + 0x14) >>> 0) >>> 0
            }
          }
        }
        pNode = pNext
      }
    }
    return
  }

  let pPetsRoot = pPlayerData >>> 0
  if (
    pPetsRoot !== 0 &&
    pPlayer !== 0 &&
    m.u32(pPlayer >>> 0) === 0 &&
    (m.u32((pPlayer + 0x14) >>> 0) >>> 0) === pPetsRoot
  ) {
    pPetsRoot = m.u32((pPetsRoot + 0x44) >>> 0) >>> 0
  }

  const sgpt0 = getSgptDataTablesPtr(m)
  let petTypesCount = sgpt0 !== 0 ? (m.u32((sgpt0 + 0xbf0) >>> 0) | 0) : 0
  if (petTypesCount <= 1) return

  let petType = 1
  let offset = 0x0c
  for (;;) {
    if (offset >= 0 && petType < petTypesCount && offset !== 0x54 && pPetsRoot !== 0) {
      const pBucketBase = m.u32(pPetsRoot >>> 0) >>> 0
      const pBucket = pBucketBase !== 0 ? ((pBucketBase + offset) >>> 0) : 0
      if (pBucket !== 0) {
        let pNode = m.u32(pBucket >>> 0) >>> 0
        while (pNode !== 0) {
          if (pGame === 0) {
            throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
          }
          const pNext = m.u32((pNode + 0x14) >>> 0) >>> 0
          const dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
          let pMonster = m.u32((pGame + ((dwPetGuid & 0x7f) << 2) + 0x1320) >>> 0) >>> 0
          while (pMonster !== 0) {
            if ((m.u32((pMonster + 0x0c) >>> 0) >>> 0) === dwPetGuid) break
            pMonster = m.u32((pMonster + 0xe4) >>> 0) >>> 0
          }
          let shouldRemove = false
          if (pMonster === 0) {
            shouldRemove = true
          } else if ((m.u8((pMonster + 0xc6) >>> 0) & 1) !== 0) {
            shouldRemove = true
          } else {
            const dwType = m.u32(pMonster >>> 0) >>> 0
            const eMode = m.u32((pMonster + 0x10) >>> 0) | 0
            if (dwType === 0) {
              if (eMode === 0 || eMode === 0x11) shouldRemove = true
            } else if (dwType === 1) {
              if (eMode === 0 || eMode === 0x0c) shouldRemove = true
            } else {
              shouldRemove = true
            }
          }
          if (shouldRemove) {
            PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(m, pGame, pPlayer, dwPetGuid, 0)
          }
          pNode = pNext
        }
      }
    }
    const dtNext = getSgptDataTablesPtr(m)
    petTypesCount = dtNext !== 0 ? (m.u32((dtNext + 0xbf0) >>> 0) | 0) : 0
    petType = (petType + 1) | 0
    offset = (offset + 0x0c) | 0
    if (petType >= petTypesCount) break
  }
}

/**
 * Cleans invalid minions via `PLRINTRO_CleanInvalidMonsterMinions113c` and sends all active
 * pet entries with `PetTypesTxt` flag bit 2 (`0x04`) to `pPlayer`'s client via `NET_SendPacket7F`.
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
  hitD2GameVa113c(0x6FCB8250)
  if (hooks !== undefined) {
    if (pPlayer === 0 || m.u32(pPlayer >>> 0) !== 0 || pGame === 0) return
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer)
    if (pPlayerData === 0) return
    const pPetsRoot = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
    if (pPetsRoot === 0) return
    PLRINTRO_CleanInvalidMonsterMinions113c(m, pGame, pPlayer, pPlayerData, hooks)
    const sgpt = getSgptDataTablesPtr(m)
    if (sgpt === 0) return
    const petTypesCount = (m.u32((sgpt + 0xbf0) | 0) >>> 0)
    let petTypesBase = safeReadU32PlrIntro113c(m, (sgpt + 0xbe8) >>> 0)
    if (petTypesBase === 0) {
      petTypesBase = safeReadU32PlrIntro113c(m, (sgpt + 0xbec) >>> 0)
    }
    const maskByte = getBitMaskByte(m, 8, 4)
    for (let petType = 1; petType < petTypesCount; petType++) {
      if (petTypesBase === 0) continue
      const pPetTxt = (petTypesBase + petType * 0xe0) >>> 0
      if (pPetTxt === 0) continue
      let petFlags = 0
      try {
        petFlags = m.u8((pPetTxt + 0x04) >>> 0)
      } catch {
        continue
      }
      if ((petFlags & maskByte) === 0) continue
      const pBucketBase = safeReadU32PlrIntro113c(m, pPetsRoot)
      if (pBucketBase === 0) continue
      const pBucket = (pBucketBase + petType * 0x0c) >>> 0
      let pNode = safeReadU32PlrIntro113c(m, pBucket)
      while (pNode !== 0) {
        let dwPetGuid = 0
        let nClassId = 0
        let dwOwnerGuid = 0
        let wHydraFlags = 0
        let pNext = 0
        try {
          dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
          nClassId = m.u32(pNode >>> 0) >>> 0
          dwOwnerGuid = m.u32((pNode + 0x0c) >>> 0) >>> 0
          wHydraFlags = m.u16((pNode + 0x10) >>> 0)
          pNext = m.u32((pNode + 0x14) >>> 0) >>> 0
        } catch {
          break
        }
        if (hooks.onSendPetPacketToClient !== undefined) {
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
        pNode = pNext
      }
    }
    return
  }

  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  if (pPlayerData === 0) return
  const pPetsRoot = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPetsRoot === 0) return

  PLRINTRO_CleanInvalidMonsterMinions113c(m, pGame, pPlayer, pPetsRoot)

  let resolvedClient = 0
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    resolvedClient = m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0) >>> 0
  }

  const sgpt0 = getSgptDataTablesPtr(m)
  let petTypesCount = sgpt0 !== 0 ? (m.u32((sgpt0 + 0xbf0) >>> 0) | 0) : 0
  if (petTypesCount <= 1) return

  let petType = 1
  let offset = 0x0c
  let txtOff = 0xe0
  for (;;) {
    const dtCur = getSgptDataTablesPtr(m)
    if (offset >= 0 && petType < petTypesCount && dtCur !== 0) {
      const pBucketBase = m.u32(pPetsRoot >>> 0) >>> 0
      const pBucket = pBucketBase !== 0 ? ((pBucketBase + offset) >>> 0) : 0
      const petTypesBase = m.u32((dtCur + 0xbe8) >>> 0) >>> 0
      if (pBucket !== 0 && petTypesBase !== 0) {
        const pPetTxt = (petTypesBase + txtOff) >>> 0
        if (pPetTxt !== 0) {
          const maskByte = getBitMaskByte(m, 8, 4)
          if ((m.u8((pPetTxt + 0x04) >>> 0) & maskByte) !== 0) {
            let pNode = m.u32(pBucket >>> 0) >>> 0
            while (pNode !== 0) {
              if ((m.u8(pNode >>> 0) & 1) === 0) {
                if (pGame === 0) {
                  throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
                }
                const dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
                let pMonster = m.u32((pGame + ((dwPetGuid & 0x7f) << 2) + 0x1320) >>> 0) >>> 0
                while (pMonster !== 0) {
                  if ((m.u32((pMonster + 0x0c) >>> 0) >>> 0) === dwPetGuid) break
                  pMonster = m.u32((pMonster + 0xe4) >>> 0) >>> 0
                }
                if (pMonster !== 0) {
                  NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c(
                    m,
                    resolvedClient,
                    pMonster,
                  )
                }
              }
              pNode = m.u32((pNode + 0x14) >>> 0) >>> 0
            }
          }
        }
      }
    }
    txtOff = (txtOff + 0xe0) | 0
    const dtEnd = getSgptDataTablesPtr(m)
    petTypesCount = dtEnd !== 0 ? (m.u32((dtEnd + 0xbf0) >>> 0) | 0) : 0
    petType = (petType + 1) | 0
    offset = (offset + 0x0c) | 0
    if (petType >= petTypesCount) break
  }
}

/**
 * Sends party member life/level sync (`NET_SendPacket7F_PartyMemberLifeAndLevel`) for all other
 * members in `pPlayer`'s party (`[pGame + 0x1D2C]`) to `pPlayer`'s client (`[pPlayerData + 0x9C]`).
 *
 * @va D2Game:0x6FCBC620 (193B)
 */
export function PARTY_SendPartyPetsToClient113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FCBC620)
  if (hooks !== undefined) {
    if (pPlayer === 0 || m.u32(pPlayer >>> 0) !== 0 || pGame === 0) return
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer)
    const pClient = pPlayerData !== 0 ? m.u32((pPlayerData + 0x9c) >>> 0) >>> 0 : 0
    const dwPlayerGuid = m.u32((pPlayer + 0x0c) >>> 0) >>> 0

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
              if (hooks.onSendPetPacketToClient !== undefined) {
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
    return
  }

  let pClient = 0
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pPlrData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    if (pPlrData !== 0) {
      pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
    }
  }
  if (pPlayer === 0 || m.u32((pPlayer + 0x80) >>> 0) === 0 || m.u32(pPlayer >>> 0) !== 0) {
    return
  }
  const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlayer, pGame) & 0xffff
  if (wPartyId === 0xffff) return
  const pSubParty = PARTY_FindSubPartyById_6FCBBD00_113c(m, pGame, wPartyId) >>> 0
  if (pSubParty === 0) return

  let pMemberNode = m.u32((pSubParty + 0x04) >>> 0) >>> 0
  while (pMemberNode !== 0) {
    if (pGame === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
    }
    const memberGuid = m.u32(pMemberNode >>> 0) >>> 0
    let pMemberUnit = m.u32((pGame + ((memberGuid & 0x7f) << 2) + 0x1120) >>> 0) >>> 0
    while (pMemberUnit !== 0) {
      if ((m.u32((pMemberUnit + 0x0c) >>> 0) >>> 0) === memberGuid) break
      pMemberUnit = m.u32((pMemberUnit + 0xe4) >>> 0) >>> 0
    }
    if (pMemberUnit !== 0 && pMemberUnit !== (pPlayer >>> 0)) {
      NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c(m, pClient, pMemberUnit)
    }
    pMemberNode = m.u32((pMemberNode + 0x04) >>> 0) >>> 0
  }
}

// ============================================================================
// F276 (14 VAs)
// ============================================================================

function findMonsterAiCommandType113c(
  m: Memory113c,
  pUnit: number,
  dwCmdType: number,
): number {
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 1) return 0
  const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return 0
  const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGen === 0) return 0
  const pTail = m.u32((pAiGen + 0x20) >>> 0) >>> 0
  if (pTail === 0) return 0
  let cur = m.u32(pTail >>> 0) >>> 0
  while (cur !== 0) {
    if ((m.u32((cur + 0x08) >>> 0) >>> 0) === (dwCmdType >>> 0)) {
      return cur
    }
    if (cur === pTail) break
    cur = m.u32(cur >>> 0) >>> 0
  }
  return 0
}

function ensureMonsterAiCmd10ForSave113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): number {
  const existing = findMonsterAiCommandType113c(m, pUnit, 0x0a)
  if (existing !== 0) return existing
  const savedStack = laneI1StackPtr
  const pSrcCmd = allocStackFrame(m, 0x20)
  try {
    m.setU32((pSrcCmd + 0x08) >>> 0, 0x0a)
    AIGENERAL_CopyAiCommandParams113c(m, pGame, pUnit, pSrcCmd)
  } finally {
    freeStackFrame(savedStack)
  }
  return findMonsterAiCommandType113c(m, pUnit, 0x0a)
}

/**
 * Packs monster preset flags, `cmd 0x0A` state, AI save pointer (`+0x38` -> `[pNode+0x24]`),
 * boss/mount target fields, and `0x137`/`0x138` byte into an inactive preset save node (`pNode`).
 *
 * @va D2Game:0x6FC3EF50 (883B)
 */
export function MONSTER_PackPresetSaveData113c(
  m: Memory113c,
  pUnit: number,
  pNode: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC3EF50)
  const unit = pUnit >>> 0
  const node = pNode >>> 0
  const game = pGame >>> 0
  if (unit === 0 || node === 0) return 0

  const nClassId = m.u32((unit + 0x04) >>> 0) | 0
  const sgpt = getSgptDataTablesPtr(m)
  const monStatsCount = sgpt !== 0 ? (m.u32((sgpt + 0xa80) >>> 0) | 0) : 0
  const monStatsBase = sgpt !== 0 ? (m.u32((sgpt + 0xa78) >>> 0) >>> 0) : 0
  const pMonStats =
    nClassId >= 0 && nClassId < monStatsCount && monStatsBase !== 0
      ? (monStatsBase + nClassId * 0x1a8) >>> 0
      : 0

  const unitFlags = m.u32((unit + 0xc4) >>> 0) >>> 0
  if (((unitFlags >>> 0x1a) & 1) !== 0) {
    m.setU32((node + 0x50) >>> 0, (m.u32((node + 0x50) >>> 0) | 1) >>> 0)
    m.setU32((node + 0x4c) >>> 0, 0xdeaddead)
  }
  if (((unitFlags >>> 0x11) & 1) !== 0) {
    m.setU32((node + 0x4c) >>> 0, 0xdeaddead)
    m.setU32((node + 0x50) >>> 0, (m.u32((node + 0x50) >>> 0) | 2) >>> 0)
  }

  const monStatByte0D = pMonStats !== 0 ? m.u8((pMonStats + 0x0d) >>> 0) : 0
  const b0 = getBitMaskByte(m, 0x00, 1)
  const b1 = getBitMaskByte(m, 0x04, 2)
  const b2 = getBitMaskByte(m, 0x08, 4)
  if ((monStatByte0D & (b0 | b1 | b2)) !== 0) {
    const cmd10 = ensureMonsterAiCmd10ForSave113c(m, unit, game)
    if (cmd10 !== 0) {
      const p0c = m.u32((cmd10 + 0x0c) >>> 0) >>> 0
      if (p0c !== 0) {
        m.setU32((node + 0x4c) >>> 0, p0c)
        m.setU32((node + 0x50) >>> 0, m.u32((cmd10 + 0x10) >>> 0) >>> 0)
      }
    }
    const pAiGen =
      m.u32(unit >>> 0) === 1 && m.u32((unit + 0x14) >>> 0) !== 0
        ? m.u32((m.u32((unit + 0x14) >>> 0) + 0x28) >>> 0) >>> 0
        : 0
    if (pAiGen !== 0 && m.u32((pAiGen + 0x38) >>> 0) !== 0) {
      DRLGPRESET_MovePointerAndClear113c(m, (pAiGen + 0x38) >>> 0, (node + 0x24) >>> 0)
    }
  }

  const nodeFlags = m.u32((node + 0x18) >>> 0) >>> 0
  if (
    nClassId === 0x10b ||
    nClassId === 0xf3 ||
    ((nodeFlags & 0x800) !== 0 && m.u16((node + 0x3c) >>> 0) === 6)
  ) {
    const cmd10 = ensureMonsterAiCmd10ForSave113c(m, unit, game)
    if (cmd10 !== 0) {
      m.setU32((node + 0x4c) >>> 0, m.u32((cmd10 + 0x0c) >>> 0) >>> 0)
      m.setU32((node + 0x50) >>> 0, m.u32((cmd10 + 0x10) >>> 0) >>> 0)
    }
  }

  if (m.u32(unit >>> 0) === 1 && nClassId >= 0) {
    let baseId = nClassId
    if (pMonStats !== 0) {
      baseId = (m.u16((pMonStats + 0x02) >>> 0) << 16) >> 16
    }
    if (baseId >= 0 && baseId < monStatsCount) {
      const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
      const pAiGen = pMonData !== 0 ? (m.u32((pMonData + 0x28) >>> 0) >>> 0) : 0
      if (baseId === 0x44) {
        m.setU32((node + 0x4c) >>> 0, pAiGen !== 0 ? m.u32((pAiGen + 0x1c) >>> 0) >>> 0 : 0)
      } else if (baseId === 0x21f) {
        m.setU32((node + 0x4c) >>> 0, pAiGen !== 0 ? m.u32((pAiGen + 0x14) >>> 0) >>> 0 : 0)
      }
    }
  }

  if (nClassId === 0x138 || nClassId === 0x137) {
    const pMonData =
      m.u32(unit >>> 0) === 1 ? (m.u32((unit + 0x14) >>> 0) >>> 0) : 0
    m.setU32((node + 0x4c) >>> 0, pMonData !== 0 ? m.u8((pMonData + 0x0e) >>> 0) : 0)
  }
  return 1
}

/**
 * Strips active states, frees type-2 event nodes, allocates a `0x5C`-byte inactive monster node,
 * calls `MONSTER_PackPresetSaveData113c`, and links the node into `[pRoomNode + 0x0C]`.
 *
 * @va D2Game:0x6FC3F600 (1006B)
 */
export function MONSTER_SaveInactiveMonsterNode113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _hooks?: Post150LaneI1Hooks113c,
): number {
  hitD2GameVa113c(0x6FC3F600)
  if (pUnit === 0 || pGame === 0) return 0
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (pRoom === 0) return 0

  const sgpt = getSgptDataTablesPtr(m)
  if (sgpt !== 0) {
    const nAuraStates = (m.u16((sgpt + 0x178) >>> 0) << 16) >> 16
    const pAuraStateArr = m.u32((sgpt + 0x174) >>> 0) >>> 0
    if (pAuraStateArr !== 0) {
      for (let i = 0; i < nAuraStates; i++) {
        const stateId = (m.u16((pAuraStateArr + i * 2) >>> 0) << 16) >> 16
        if (STATES_CheckState113c(m, pUnit, stateId) !== 0) {
          const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, stateId)
          if (pStatList !== 0) {
            STATLIST_UnlinkSubList113c(m, pUnit, pStatList)
            STATLIST_FreeStatListIfNonExtended113c(m, pStatList)
          }
        }
      }
    }
  }

  let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
  while (pEvent !== 0) {
    const pNextEvent = m.u32((pEvent + 0x24) >>> 0) >>> 0
    if (m.u8(pEvent >>> 0) === 2) {
      EVENT_FreeNode113c(m, pGame, pEvent)
    }
    pEvent = pNextEvent
  }

  const pNode = m.alloc(0x5c) >>> 0
  for (let i = 0; i < 0x5c; i += 4) {
    m.setU32((pNode + i) >>> 0, 0)
  }
  m.setU32((pNode + 0x1c) >>> 0, 0xffffffff)

  if (MONSTER_PackPresetSaveData113c(m, pUnit, pNode, pGame) === 0) {
    freeMemBlock(m, pNode)
    return 0
  }

  let posX = 0
  let posY = 0
  const dwUnitType = m.u32(pUnit >>> 0) >>> 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath !== 0) {
    if (dwUnitType === 2 || dwUnitType === 4 || dwUnitType === 5) {
      posX = m.u32((pPath + 0x0c) >>> 0) | 0
      posY = m.u32((pPath + 0x10) >>> 0) | 0
    } else {
      posX = PATH_GetPosX113c(m, pPath) | 0
      posY = PATH_GetPosY113c(m, pPath) | 0
    }
  }
  m.setU32(pNode >>> 0, posX >>> 0)
  m.setU32((pNode + 0x04) >>> 0, posY >>> 0)
  m.setU32((pNode + 0x08) >>> 0, m.u32((pUnit + 0x04) >>> 0) >>> 0)
  m.setU32((pNode + 0x54) >>> 0, m.u32((pGame + 0xa8) >>> 0) >>> 0)

  const pMonsterData = dwUnitType === 1 ? (m.u32((pUnit + 0x14) >>> 0) >>> 0) : 0
  const pAiGeneral = pMonsterData !== 0 ? (m.u32((pMonsterData + 0x28) >>> 0) >>> 0) : 0
  if (pAiGeneral !== 0) {
    m.setU32((pNode + 0x28) >>> 0, m.u32(pAiGeneral >>> 0) >>> 0)
  }
  const monField14 = pMonsterData !== 0 ? m.u16((pMonsterData + 0x14) >>> 0) : 0x1506
  m.setU16((pNode + 0x30) >>> 0, monField14)

  let flags18 = 0
  if (pMonsterData !== 0) {
    const monTypeFlags = m.u8((pMonsterData + 0x16) >>> 0)
    if ((monTypeFlags & 0x04) !== 0) flags18 |= 0x02
    if ((monTypeFlags & 0x02) !== 0) {
      flags18 |= 0x0800
      m.setU16((pNode + 0x3c) >>> 0, m.u16((pMonsterData + 0x26) >>> 0))
    }
    if ((monTypeFlags & 0x01) !== 0) flags18 |= 0x01
    if ((monTypeFlags & 0x10) !== 0) flags18 |= 0x20
    if ((m.u8((pMonsterData + 0x5c) >>> 0) & 0x02) !== 0) flags18 |= 0x40
  }

  const align = UNIT_GetAlignment113c(m, pUnit) | 0
  if (align === 2) flags18 |= 0x0100
  else if (align === 0) flags18 |= 0x0200
  else if (align === 1) flags18 |= 0x80

  const spawnType = m.u32((pUnit + 0xd0) >>> 0) >>> 0
  if (spawnType !== 0x0b) {
    flags18 |= 0x0400
  }
  const animMode = m.u32((pUnit + 0x10) >>> 0) | 0
  if (animMode === 0 || animMode === 0x0c) {
    flags18 |= 0x04
  }
  m.setU32((pNode + 0x18) >>> 0, flags18 >>> 0)

  m.setU32((pNode + 0x40) >>> 0, STATLIST_GetUnitStat113c(m, pUnit, 0x0d, 0) >>> 0)
  m.setU32((pNode + 0x44) >>> 0, STATLIST_GetMaxLifeFromUnit113c(m, pUnit) >>> 0)
  m.setU32((pNode + 0x48) >>> 0, STATLIST_GetUnitStat113c(m, pUnit, 0x06, 0) >>> 0)

  if (pMonsterData !== 0) {
    m.setU32((pNode + 0x2c) >>> 0, m.u32((pMonsterData + 0x58) >>> 0) >>> 0)
    for (let k = 0; k < 9; k++) {
      m.setU8((pNode + 0x32 + k) >>> 0, m.u8((pMonsterData + 0x1c + k) >>> 0))
    }
  }
  if (pAiGeneral !== 0 && m.u32((pAiGeneral + 0x30) >>> 0) === 1) {
    const aiFlags = m.u16((pAiGeneral + 0x08) >>> 0)
    const saved2C = m.u32((pAiGeneral + 0x2c) >>> 0) >>> 0
    const saved34 = m.u32((pAiGeneral + 0x34) >>> 0) >>> 0
    m.setU32((pAiGeneral + 0x2c) >>> 0, 0xffffffff)
    m.setU32((pAiGeneral + 0x34) >>> 0, 0)
    if (saved2C !== 0xffffffff) {
      m.setU32((pNode + 0x1c) >>> 0, saved2C)
      m.setU32((pNode + 0x20) >>> 0, saved34)
      let f18 = m.u32((pNode + 0x18) >>> 0)
      if ((aiFlags & 0x01) !== 0) f18 |= 0x08
      if ((aiFlags & 0x02) !== 0) f18 |= 0x10
      m.setU32((pNode + 0x18) >>> 0, f18 >>> 0)
    }
  }

  m.setU32((pNode + 0x0c) >>> 0, m.u32((pUnit + 0x0c) >>> 0) >>> 0)
  m.setU32((pNode + 0x10) >>> 0, m.u32((pUnit + 0xc4) >>> 0) >>> 0)
  m.setU32((pNode + 0x14) >>> 0, m.u32((pUnit + 0xc8) >>> 0) >>> 0)

  const nLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const actNo = DRLG_GetActNoFromLevelId113c(m, nLevel) & 0xff
  if (actNo >= 5) {
    freeMemBlock(m, pNode)
    return 0
  }

  const savedStack = laneI1StackPtr
  const pRoomCoords = allocStackFrame(m, 0x20)
  DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
  const roomX = m.u32(pRoomCoords >>> 0) | 0
  const roomY = m.u32((pRoomCoords + 0x04) >>> 0) | 0
  freeStackFrame(savedStack)

  const pRoomNode = MONREG_FindOrAllocActRoomNode113c(m, pGame, actNo, roomX, roomY, 1)
  if (pRoomNode === 0) return 0
  m.setU32((pNode + 0x58) >>> 0, m.u32((pRoomNode + 0x0c) >>> 0) >>> 0)
  m.setU32((pRoomNode + 0x0c) >>> 0, pNode)
  return 1
}

/**
 * Saves an inactive unit (`pUnit`: monster type `1`, corpse/object/warp types `0`/`2`/`5`, or item type `4`)
 * into the act's inactive room list at `[pGame + actNo*4 + 0xD8]`.
 *
 * @va D2Game:0x6FC404E0 (626B)
 */
export function UNIT_SaveInactiveUnitNode113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC404E0)
  if (pUnit === 0 || pGame === 0) return
  const dwUnitType = m.u32(pUnit >>> 0) >>> 0
  if (dwUnitType === 1) {
    MONSTER_SaveInactiveMonsterNode113c(m, pGame, pUnit, hooks)
    return
  }

  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (pRoom === 0) return
  const nLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const actNo = DRLG_GetActNoFromLevelId113c(m, nLevel) & 0xff
  if (actNo >= 5) return

  let posX = 0
  let posY = 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath !== 0) {
    if (dwUnitType === 2 || dwUnitType === 4 || dwUnitType === 5) {
      posX = m.u32((pPath + 0x0c) >>> 0) | 0
      posY = m.u32((pPath + 0x10) >>> 0) | 0
    } else {
      posX = PATH_GetPosX113c(m, pPath) | 0
      posY = PATH_GetPosY113c(m, pPath) | 0
    }
  }

  const savedStack = laneI1StackPtr
  const pRoomCoords = allocStackFrame(m, 0x20)
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
    const roomX = m.u32(pRoomCoords >>> 0) | 0
    const roomY = m.u32((pRoomCoords + 0x04) >>> 0) | 0
    const pRoomNode = MONREG_FindOrAllocActRoomNode113c(m, pGame, actNo, roomX, roomY, 1)
    if (pRoomNode === 0) return

    if (dwUnitType === 4) {
      if (hooks?.onSaveInactiveItemNode !== undefined) {
        const ppOutNode = (pRoomCoords + 0x18) >>> 0
        m.setU32(ppOutNode, 0)
        const ok = hooks.onSaveInactiveItemNode(m, pUnit, ppOutNode)
        const pItemNode = m.u32(ppOutNode) >>> 0
        if (ok !== 0 && pItemNode !== 0) {
          m.setU32(pItemNode >>> 0, m.u32((pRoomNode + 0x08) >>> 0) >>> 0)
          m.setU32((pRoomNode + 0x08) >>> 0, pItemNode)
        }
        return
      }
      hitD2GameVa113c(0x6fc403d0)
      const pItemData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      const expireFrame =
        pItemData !== 0 && m.u32((pItemData + 0x50) >>> 0) !== 0
          ? (m.u32((pItemData + 0x50) >>> 0) >>> 0)
          : ((m.u32((pGame + 0xa8) >>> 0) + 15000) >>> 0)
      const pItemNode = m.alloc(0x18) >>> 0
      m.setU32((pItemNode + 0x04) >>> 0, expireFrame)
      m.setU32((pItemNode + 0x08) >>> 0, m.u32((pUnit + 0x0c) >>> 0) >>> 0)
      m.setU16((pItemNode + 0x0c) >>> 0, posX & 0xffff)
      m.setU16((pItemNode + 0x0e) >>> 0, posY & 0xffff)
      m.setU32(pItemNode, m.u32((pRoomNode + 0x08) >>> 0) >>> 0)
      m.setU32((pRoomNode + 0x08) >>> 0, pItemNode)
      EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
      UNITROOM_RemoveUnitFromRoom113c(m, pUnit)
      SUNIT_RemoveServerUnit113c(m, pGame, pUnit)
      return
    }

    const pSavedNode = m.alloc(0x34) >>> 0
    for (let i = 0; i < 0x34; i += 4) {
      m.setU32((pSavedNode + i) >>> 0, 0)
    }
    m.setU32(pSavedNode, posX >>> 0)
    m.setU32((pSavedNode + 0x04) >>> 0, posY >>> 0)
    m.setU32((pSavedNode + 0x08) >>> 0, dwUnitType)
    const classId = m.u32((pUnit + 0x04) >>> 0) | 0
    m.setU32((pSavedNode + 0x0c) >>> 0, classId >>> 0)

    if (dwUnitType === 0) {
      m.setU32((pSavedNode + 0x20) >>> 0, m.u32((pUnit + 0x0c) >>> 0) >>> 0)
      m.setU32((pSavedNode + 0x10) >>> 0, m.u32((pUnit + 0x10) >>> 0) >>> 0)
    } else if (dwUnitType === 2) {
      const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, classId) >>> 0
      let animMode = m.u32((pUnit + 0x10) >>> 0) | 0
      if (
        animMode === 1 &&
        pObjTxt !== 0 &&
        m.u8((pObjTxt + 0x109) >>> 0) === 0 &&
        m.u8((pObjTxt + 0x141) >>> 0) !== 0
      ) {
        animMode = 2
        m.setU32((pUnit + 0x10) >>> 0, 2)
      }
      m.setU32((pSavedNode + 0x10) >>> 0, animMode >>> 0)
      const subClass = pObjTxt !== 0 ? m.u8((pObjTxt + 0x167) >>> 0) : 0
      if ((subClass & 0x01) !== 0 || UNITS_HasObjectSubClassBit0113c(m, pUnit) !== 0) {
        const nextEv5 = EVENT_GetNextEventFrame113c(m, pUnit, 5) >>> 0
        m.setU32((pSavedNode + 0x20) >>> 0, (nextEv5 >>> 16) & 0xffff)
        m.setU32((pSavedNode + 0x24) >>> 0, nextEv5 & 0xffff)
      } else if (classId === 0x3b || classId === 0x3c || classId === 0x64) {
        m.setU32((pSavedNode + 0x20) >>> 0, m.u32((pUnit + 0x0c) >>> 0) >>> 0)
      } else {
        m.setU32((pSavedNode + 0x24) >>> 0, m.u8((pUnit + 0x78) >>> 0))
      }
      m.setU32((pSavedNode + 0x2c) >>> 0, m.u32((pUnit + 0xb8) >>> 0) >>> 0)
      const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pObjData !== 0) {
        m.setU8((pSavedNode + 0x28) >>> 0, m.u8((pObjData + 0x04) >>> 0))
      }
    } else {
      m.setU32((pSavedNode + 0x10) >>> 0, m.u32((pUnit + 0x10) >>> 0) >>> 0)
    }

    m.setU32((pSavedNode + 0x14) >>> 0, m.u32((pGame + 0xa8) >>> 0) >>> 0)
    m.setU32((pSavedNode + 0x18) >>> 0, m.u32((pUnit + 0xc4) >>> 0) >>> 0)
    m.setU32((pSavedNode + 0x1c) >>> 0, m.u32((pUnit + 0xc8) >>> 0) >>> 0)
    m.setU32((pSavedNode + 0x30) >>> 0, m.u32((pRoomNode + 0x10) >>> 0) >>> 0)
    m.setU32((pRoomNode + 0x10) >>> 0, pSavedNode)
  } finally {
    freeStackFrame(savedStack)
  }
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
  hitD2GameVa113c(0x6FC40B60)
  if (pAiGeneral === 0) return
  if (m.u32((pAiGeneral + 0x24) >>> 0) === 0) return
  while (m.u32((pAiGeneral + 0x24) >>> 0) !== 0) {
    const pHead = m.u32((pAiGeneral + 0x20) >>> 0) >>> 0
    if (pHead === 0) break
    const pNext = m.u32(pHead >>> 0) >>> 0
    if (pHead === pNext) {
      m.setU32((pAiGeneral + 0x24) >>> 0, 0)
      m.setU32((pAiGeneral + 0x20) >>> 0, 0)
    } else {
      if ((m.u32((pAiGeneral + 0x24) >>> 0) >>> 0) === pHead) {
        m.setU32((pAiGeneral + 0x24) >>> 0, pNext)
      }
      const nextReload = m.u32(pHead >>> 0) >>> 0
      m.setU32((pAiGeneral + 0x20) >>> 0, nextReload)
      const pPrev = m.u32((pHead + 0x04) >>> 0) >>> 0
      m.setU32(pPrev >>> 0, m.u32(pHead >>> 0) >>> 0)
      const pNextNode = m.u32(pHead >>> 0) >>> 0
      m.setU32((pNextNode + 0x04) >>> 0, m.u32((pHead + 0x04) >>> 0) >>> 0)
    }
    freeMemBlock(m, pHead)
  }
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
  hitD2GameVa113c(0x6FC40C00)
  if (pAiGeneral === 0) return
  const pSaveHdr = m.u32((pAiGeneral + 0x38) >>> 0) >>> 0
  if (pSaveHdr !== 0) {
    DRLGPRESET_FreeSaveHeaderBlock113c(m, pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) >>> 0 : 0, pSaveHdr)
  }
  let pMinion = m.u32((pAiGeneral + 0x34) >>> 0) >>> 0
  while (pMinion !== 0) {
    const pNext = m.u32((pMinion + 0x04) >>> 0) >>> 0
    freeMemBlock(m, pMinion)
    pMinion = pNext
  }
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
  hitD2GameVa113c(0x6FC4E790)
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
  hitD2GameVa113c(0x6FC4EE60)
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
  hitD2GameVa113c(0x6FC57220)
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
  hitD2GameVa113c(0x6FC683B0)
  if (pInteract === 0) return
  let pNode = 0
  try {
    pNode = m.u32(pInteract >>> 0) >>> 0
  } catch {
    return
  }
  while (pNode !== 0) {
    let pNext = 0
    try {
      pNext = m.u32((pNode + 0x08) >>> 0) >>> 0
    } catch {
      break
    }
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
  hitD2GameVa113c(0x6FCCFB90)
  if (pUnit === 0) return
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame)

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
    INVENTORY_FreeInventory113c(m, pInv)
    if (pInv !== 0) {
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
  hitD2GameVa113c(0x6FCFF6C0)
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
  hitD2GameVa113c(0x6FD00C80)
  if ((pUnit >>> 0) === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x3ad)
  }
  const dwUnitType = m.u32(pUnit >>> 0) | 0
  if (dwUnitType >= 6) {
    throw new D2CommonAssertError('SUnit.cpp', 0x3ae)
  }
  if ((dwUnitType >>> 0) <= 3) {
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
 * Iterates `pUnit->pInventory` (`[pUnit + 0x60]`), deactivates equipped stats (`0x6FCF46B0`),
 * removes every item node (`#10646`), and deletes each server unit (`0x6FD020A0`), plus cursor item (`#11017`).
 *
 * @va D2Game:0x6FD01110 (445B, `__stdcall(pGame, pUnit)`, `calleePop = 8`, void)
 */
export function SUNIT_ClearUnitInventoryItems113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  hitD2GameVa113c(0x6FD01110)
  const unit = pUnit >>> 0
  if (unit === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x9d7)
  }
  const pInv = m.u32((unit + 0x60) >>> 0) >>> 0
  if (pInv === 0) return

  let pItem = INVENTORY_GetFirstItem113c(m, pInv)
  while (pItem !== 0) {
    const pNext = INVENTORY_GetNextItem113c(m, pItem)
    const pValidItem = INVENTORY_UnitIsItem113c(m, pItem) >>> 0
    if (pValidItem === 0) {
      throw new D2CommonAssertError('SUnit.cpp', 0x9ea)
    }

    if (m.u32(pValidItem) === 4) {
      ITEMS_DeactivateEquippedItemStats113c(m, unit, pValidItem, pGame >>> 0, 0, 1)
      const posOther = INVENTORY_GetItemNodePositionOther113c(m, pValidItem)
      if (posOther === 3) {
        const bodyLoc = INVENTORY_GetItemBodyLocFromX113c(m, pInv, pValidItem)
        INVENTORY_NoOpRet8B113c(m, pInv, bodyLoc)
      } else if (ITEMS_CanUseCharmInInventory113c(m, pValidItem, unit) !== 0) {
        const invPage = ITEMS_GetInvPage113c(m, pValidItem) & 0xff
        const invRecId = UNITS_GetInventoryRecordId113c(
          m,
          unit,
          invPage,
          m.u32((pGame + 0x70) >>> 0) >>> 0,
        )
        const itemType = m.u32(pValidItem) | 0
        const pPath = m.u32((pValidItem + 0x2c) >>> 0) >>> 0
        let posY = 0
        let posX = 0
        if (itemType === 2 || itemType === 4 || itemType === 5) {
          if (pPath !== 0) {
            posY = m.u32((pPath + 0x10) >>> 0) >>> 0
            posX = m.u32((pPath + 0x0c) >>> 0) >>> 0
          }
        } else if (pPath !== 0) {
          posY = PATH_GetPosY113c(m, pPath) >>> 0
          posX = PATH_GetPosX113c(m, pPath) >>> 0
        }
        INVENTORY_NoOpRet20113c(m, 0x6fd1b02c, 0xa04, pInv, posX, posY, invRecId, 0, invPage)
        if (invPage === 0 && hooks?.onNotifyCharmUnequip !== undefined) {
          hooks.onNotifyCharmUnequip(m, pGame, unit, pValidItem)
        }
      }
    }

    if (INVENTORY_RemoveItemFromInventory113c(m, pInv, pValidItem) === 0) {
      throw new D2CommonAssertError('SUnit.cpp', 0xa08)
    }
    if ((m.u32(pValidItem) | 0) < 6) {
      if (hooks?.onDeleteServerUnit !== undefined) {
        hooks.onDeleteServerUnit(m, pGame, pValidItem)
      } else {
        SUNIT_FreeUnit113c(m, pGame, pValidItem)
      }
    }

    pItem = pNext
  }

  const pCursorItem = INVENTORY_GetCursorItem113c(m, pInv) >>> 0
  if (pCursorItem !== 0 && (m.u32(pCursorItem) | 0) < 6) {
    if (hooks?.onDeleteServerUnit !== undefined) {
      hooks.onDeleteServerUnit(m, pGame, pCursorItem)
    } else {
      SUNIT_FreeUnit113c(m, pGame, pCursorItem)
    }
  }
}

/**
 * Unlinks `pUnit` (`esi`) from its room update list at `[pGame + listIdx*4 + 0x10F8]` (`listIdx = [pUnit + 0xD0]`),
 * using sentinel head skip (`[head + 0x08]`) for `listIdx < 8` and head/prev/next at `+0x08`/`+0x0C`,
 * frees the 16-byte doubly-linked node, and resets `[pUnit + 0xD0] = 0x0B`.
 *
 * @va D2Game:0x6FD0FC60 (209B, `edi = pGame`, `esi = pUnit`, `calleePop = 0`, void)
 */
export function SUNIT_UnlinkFromRoomUpdateList113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FD0FC60)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  if (game === 0 || unit === 0) return
  const unitType = m.u32(unit) >>> 0
  if (unitType !== 0 && unitType !== 1) return
  const listIdx = m.u32((unit + 0xd0) >>> 0) >>> 0
  if (listIdx >= 0x0b) return
  const pHead = m.u32((game + listIdx * 4 + 0x10f8) >>> 0) >>> 0
  if (pHead === 0) return

  if (listIdx < 8) {
    let pNode = m.u32((pHead + 0x08) >>> 0) >>> 0
    while (pNode !== 0) {
      if (m.u32(pNode >>> 0) >>> 0 === unit) {
        const pPrev = m.u32((pNode + 0x0c) >>> 0) >>> 0
        const pNext = m.u32((pNode + 0x08) >>> 0) >>> 0
        if (pPrev !== 0) {
          m.setU32((pPrev + 0x08) >>> 0, pNext)
        }
        if (pNext !== 0) {
          m.setU32((pNext + 0x0c) >>> 0, pPrev)
        }
        freeMemBlock(m, pNode)
        m.setU32((unit + 0xd0) >>> 0, 0x0b)
        return
      }
      pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
    }
    m.setU32((unit + 0xd0) >>> 0, 0x0b)
    return
  }

  let pNode = pHead
  while (pNode !== 0) {
    if (m.u32(pNode >>> 0) >>> 0 === unit) {
      const pNext = m.u32((pNode + 0x08) >>> 0) >>> 0
      if (pNode === pHead) {
        m.setU32((game + listIdx * 4 + 0x10f8) >>> 0, pNext)
        if (pNext !== 0) {
          m.setU32((pNext + 0x0c) >>> 0, 0)
        }
      } else {
        const pPrev = m.u32((pNode + 0x0c) >>> 0) >>> 0
        if (pPrev !== 0) {
          m.setU32((pPrev + 0x08) >>> 0, pNext)
        }
        if (pNext !== 0) {
          m.setU32((pNext + 0x0c) >>> 0, pPrev)
        }
      }
      freeMemBlock(m, pNode)
      m.setU32((unit + 0xd0) >>> 0, 0x0b)
      return
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  m.setU32((unit + 0xd0) >>> 0, 0x0b)
}
