/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 3 Batch 5 (`w3b5`) routines across
 * `0x6FC70130..0x6FC7DDF0` (45 functions).
 *
 * Every `@va`-annotated export is an instruction-faithful translation of its
 * corresponding `D2Game.dll` v1.13c routine operating on `D2KernMemory113c`.
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import {
  DRLGPRESET_CloneSaveHeaderBlock113c,
  DRLGPRESET_MovePointerAndClear113c,
} from '../common/drlg/preset.ts'
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import {
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_SerializeItemToBuffer113c,
} from '../common/items.ts'
import {
  INVENTORY_GetCompositWeaponMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports.ts'
import { MISSILE_SetTargetX113c } from '../common/missile.ts'
import {
  PATH_ClearPathPointsAndFlag0x20_113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
} from '../common/path.ts'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record.ts'
import { SKILLS_EvalCalcByOffset113c } from '../common/skills.ts'
import {
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import { UNITROOM_RefreshUnit113c, UNITS_GetRoom113c } from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { DATATBLS_AdjustMonsterPresetIndex113c } from '../tables/datatbls-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import {
  type BootInitGapBCallees113c,
  D2GAME_PLRMODES_SendStatToClientOrParty113c,
} from './boot-init-gap-b-113c.ts'
import {
  ITEMEVENT_RemoveByTypeAndState113c,
  type K2GapMeleeDotHooks113c,
  MISSILE_CreateServerProjectile113c,
  STATES_OnTimedStateRemoved113c,
} from './k2-gap-melee-dot-113c.ts'
import {
  AIGENERAL_GetQuestDataPtr38_113c,
  QUESTS_AddNpcDialogTextNodes113c,
  QUESTS_HasPlayerGuidInQuest113c,
} from './k2-items-tc-w1-113c.ts'
import { CHECKSUM_ComputeCrc32_6FC2B470_113c } from './k2-laneH-0x6fc2-w1-113c.ts'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  QUESTS_AttachQuestToUnit_6FC53F80_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import {
  GAMETIME_GetElapsedMilliseconds_6FC72020_113c,
  type GameTimeHostHooks113c,
  MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c,
  PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c,
} from './k2-laneL-0x6fc6-w1-113c.ts'
import {
  ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c,
  ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c,
  ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c,
  SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c,
} from './k2-laneM-0x6fc7-w1-113c.ts'
import { CLIENTS_UpdateCharacterProgression113c } from './k2-sunit-spawn-w1-113c.ts'
import {
  ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c,
  type K2W2B1Hooks113c,
  MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c,
} from './k2-w2b1-113c.ts'
import {
  QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c,
  QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c,
} from './k2-w2b2-113c.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_Create113c,
  type RegpopSpawnHooks113c,
  SUNIT_SetMonsterAlignmentState113c,
} from './regpop-spawn-113c.ts'
import { CLIENTS_GetPlayerUnit113c } from './replay-final11-113c.ts'
import { type FallenSliceWorld113c, MONSTER_StartMode113c } from './replay-kernel-113c.ts'
import { ROOM_SpawnMonsterPreset113c } from './room-presets-113c.ts'
import {
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
  type EventWheelHooks113c,
} from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

export type D2KernMemory113c = Memory113c

/** Optional host/test callbacks for `w3b5` routines. */
export interface K2W3B5Hooks113c extends K2W2B1Hooks113c, K2GapMeleeDotHooks113c {
  readonly gameTime?: GameTimeHostHooks113c
  readonly plrModes?: BootInitGapBCallees113c
  readonly regpop?: RegpopSpawnHooks113c
  readonly world?: FallenSliceWorld113c
  readonly invokeQuestSeqFilter?: (
    m: D2KernMemory113c,
    pRefQuest: number,
    fnVa: number,
  ) => number
}

/** Reentrant scratch stack pointer for `w3b5` local buffers. */
let k2W3B5StackPtr = 0x7e0a0000

const ACT5Q6_STATE_MSG_TABLE_6FD2D8A4: readonly number[] = [
  0xffffffff,
  0xffffffff,
  0xffffffff,
  0,
  1,
  2,
  1,
  0,
]

const ACT5Q5_STATE_MSG_TABLE_6FD2D1A4: readonly number[] = [
  0xffffffff,
  0,
  1,
  2,
  3,
  4,
  0,
  511,
]

const ACT5Q4_STATE_MSG_TABLE_6FD2CAA8: readonly number[] = [
  0xffffffff,
  0,
  1,
  2,
  3,
  4,
  515,
  20153,
]

function findQuestNodeInChain113c(
  m: D2KernMemory113c,
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

function readQuestStateMsgTable113c(
  m: D2KernMemory113c,
  tableVa: number,
  defaults: readonly number[],
  idx: number,
): number {
  const raw0 = m.u32(tableVa >>> 0) >>> 0
  if (raw0 !== 0) {
    return m.u32((tableVa + idx * 4) >>> 0) >>> 0
  }
  return idx >= 0 && idx < defaults.length ? (defaults[idx]! >>> 0) : 0xffffffff
}

function dispatchQuestSeqFilterF0_113c(
  m: D2KernMemory113c,
  pRefQuest: number,
  hooks?: K2W3B5Hooks113c,
): number {
  const fnVa = m.u32((pRefQuest + 0xf0) >>> 0) >>> 0
  if (hooks !== undefined && hooks.invokeQuestSeqFilter !== undefined) {
    return hooks.invokeQuestSeqFilter(m, pRefQuest, fnVa) & 0xff
  }
  if (fnVa === 0x6fc767a0) {
    return ACT5Q6_SeqFilter_6FC767A0_113c(m, pRefQuest, hooks) & 0xff
  }
  if (fnVa === 0x6fc76b10) {
    return ACT5Q4_SeqFilter_6FC76B10_113c(m, pRefQuest, hooks) & 0xff
  }
  if (fnVa === 0x6fc76bd0) {
    return ACT5Q5_SeqFilter_6FC76BD0_113c(m, pRefQuest, hooks) & 0xff
  }
  if (fnVa === 0x6fc76d10) {
    return ACT5Q1_SeqFilter_6FC76D10_113c(m, pRefQuest, hooks) & 0xff
  }
  return fnVa !== 0 ? 1 : 0
}

/**
 * State removal callback (`ecx = pUnit`, `edx = nState`, `[esp+4] = pStatList`, `ret 0x4`):
 * removes item events of type `1` for `nState`, resets monster AI think dispatch to `nSpecAi = 0`
 * if `pUnit->dwUnitType == 1`, and forwards to `STATES_OnTimedStateRemoved113c`.
 *
 * @va D2Game:0x6FC70130
 */
export function STATES_OnStateRemovedResetMonsterAi_6FC70130_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nState: number,
  pStatList = 0,
  hooks?: K2W3B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC70130)
  const unit = pUnit >>> 0
  if (unit === 0) {
    return
  }
  const pGame = m.u32((unit + 0x80) >>> 0) >>> 0
  ITEMEVENT_RemoveByTypeAndState113c(m, unit, pGame, 1, nState | 0)
  if ((m.u32(unit) >>> 0) === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    const pAiGen = pMonData !== 0 ? (m.u32((pMonData + 0x28) >>> 0) >>> 0) : 0
    AI_InitMonsterAiThinkFn113c(m, unit, m.u32((unit + 0x80) >>> 0) >>> 0, pAiGen, 0)
  }
  STATES_OnTimedStateRemoved113c(m, unit, nState | 0, pStatList >>> 0, hooks)
}

/**
 * Converts target monster `pTarget` (`[esp+8]`) to allied alignment (`2`) owned by `pCaster`
 * (`eax`) for skill `nSkillId` (`[esp+0xC]`) at level `nLevel` (`[esp+0x10]`) in `pGame`
 * (`[esp+4]`, `ret 0x10`): updates `pAiGeneral` owner fields, frees event type `2` nodes,
 * schedules AI event `2` at `dwGameFrame + 15`, sets state `0x60` (`STATE_CONVERSION`), and
 * when `SkillsTxt.dwCalc4` (`+0x13C`) evaluates `> 0`, assigns `MONUMOD` `0x15` and schedules
 * event `7` at `dwGameFrame + duration`.
 *
 * @va D2Game:0x6FC709E0
 */
export function SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c(
  m: D2KernMemory113c,
  pCaster: number,
  pGame: number,
  pTarget: number,
  nSkillId: number,
  nLevel: number,
  hooks?: K2W3B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC709E0)
  const skillId = nSkillId | 0
  let pSkillsTxt = 0
  if (skillId >= 0) {
    const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pTables = pTablesPtr !== 0 ? (m.u32(pTablesPtr) >>> 0) : 0
    if (pTables !== 0) {
      const nSkillsCount = m.u32((pTables + 0xba0) >>> 0) | 0
      if (skillId < nSkillsCount) {
        const pSkillsBase = m.u32((pTables + 0xb98) >>> 0) >>> 0
        pSkillsTxt = (pSkillsBase + Math.imul(skillId, 0x23c)) >>> 0
      }
    }
  }
  if (skillId === 0) {
    return
  }

  const caster = pCaster >>> 0
  const target = pTarget >>> 0
  const game = pGame >>> 0
  const ownerType = caster === 0 ? 6 : (m.u32(caster) >>> 0)
  const ownerGuid = caster === 0 ? 0xffffffff : (m.u32((caster + 0x0c) >>> 0) >>> 0)

  if (target !== 0) {
    if ((m.u32(target) >>> 0) === 1) {
      const pMonData = m.u32((target + 0x14) >>> 0) >>> 0
      const pAiGen = pMonData !== 0 ? (m.u32((pMonData + 0x28) >>> 0) >>> 0) : 0
      if (pAiGen !== 0) {
        m.setU32((pAiGen + 0x2c) >>> 0, ownerGuid)
        m.setU32((pAiGen + 0x30) >>> 0, ownerType)
        m.setU32((pAiGen + 0x28) >>> 0, game)
      }
    }
    if ((m.u32(target) >>> 0) === 1) {
      const pMonData = m.u32((target + 0x14) >>> 0) >>> 0
      const pAiGen = pMonData !== 0 ? (m.u32((pMonData + 0x28) >>> 0) >>> 0) : 0
      if (pAiGen !== 0) {
        if (caster !== 0) {
          m.setU32((pAiGen + 0x0c) >>> 0, m.u32((caster + 0x0c) >>> 0) >>> 0)
          m.setU32((pAiGen + 0x10) >>> 0, m.u32(caster) >>> 0)
        } else {
          m.setU32((pAiGen + 0x0c) >>> 0, 0xffffffff)
          m.setU32((pAiGen + 0x10) >>> 0, 1)
        }
      }
    }

    let pEvent = m.u32((target + 0xdc) >>> 0) >>> 0
    while (pEvent !== 0) {
      const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
      if (m.u8(pEvent) === 2) {
        EVENT_FreeNode113c(m, game, pEvent)
      }
      pEvent = pNext
    }
  }

  const eventHooks = hooks !== undefined ? hooks.eventWheel : undefined
  const frameNow = m.u32((game + 0xa8) >>> 0) >>> 0
  EVENT_SetEventFull113c(m, game, target, 2, (frameNow + 0x0f) >>> 0, 0, 0, 0, eventHooks)
  SUNIT_SetMonsterAlignmentState113c(m, target, 2, 0)

  if (target !== 0) {
    if ((m.u32(target) >>> 0) === 1) {
      const pMonData = m.u32((target + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        m.setU32((pMonData + 0x38) >>> 0, 0)
        m.setU32((pMonData + 0x34) >>> 0, 0)
      }
    }
    m.setU32((target + 0xc4) >>> 0, (m.u32((target + 0xc4) >>> 0) | 0x80000000) >>> 0)
  }

  STATES_ToggleGfxStateFlag113c(m, target, 0x60, 1)
  const dwCalc = m.u32((pSkillsTxt + 0x13c) >>> 0) >>> 0
  const nDuration = SKILLS_EvalCalcByOffset113c(m, caster, dwCalc, skillId, nLevel | 0) | 0
  if (nDuration > 0) {
    MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, target, 0x15, game, 0, hooks)
    const curFrame = m.u32((game + 0xa8) >>> 0) >>> 0
    EVENT_SetEventFull113c(
      m,
      game,
      target,
      7,
      (curFrame + (nDuration >>> 0)) >>> 0,
      0,
      0,
      0,
      eventHooks,
    )
  }
}

/**
 * Stamps `pNode` (`ecx`) with `[+0x00] = GAMETIME_GetElapsedMilliseconds`, `[+0x04] = dwArg4`
 * (`edx`), `[+0x08] = dwArg8` (`[esp+4]`, `ret 0x4`), and attaches `pNode + 0x0C` to the active
 * worker node at `0x6FD3039C` (rotating it to the tail of circular list `0x6FD30398` and
 * incrementing `[worker + 0x04]` and `0x6FD303AC`).
 *
 * @va D2Game:0x6FC72390
 */
export function GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c(
  m: D2KernMemory113c,
  pNode: number,
  dwArg4: number,
  dwArg8: number,
  hooks?: K2W3B5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC72390)
  const node = pNode >>> 0
  const elapsed = GAMETIME_GetElapsedMilliseconds_6FC72020_113c(
    m,
    hooks !== undefined ? hooks.gameTime : undefined,
  ) >>> 0
  m.setU32(node, elapsed)
  m.setU32((node + 0x04) >>> 0, dwArg4 >>> 0)
  m.setU32((node + 0x08) >>> 0, dwArg8 >>> 0)

  const listHeadVal = m.u32(0x6fd30398) >>> 0
  if (listHeadVal === 0) {
    m.setU32(0x6fd30398, 0x6fd30398)
    m.setU32(0x6fd3039c, 0x6fd30398)
    return 0
  }

  const pWorkerLink = m.u32(0x6fd3039c) >>> 0
  if (pWorkerLink === 0x6fd30398 || pWorkerLink === 0) {
    return 0
  }

  const pWorker = (pWorkerLink - 0x10) >>> 0
  const pWorkerQueueHead = (pWorker + 0x08) >>> 0
  const pNodeLink = (node + 0x0c) >>> 0
  if (pWorkerQueueHead === 0) {
    throw new D2CommonAssertError('pWorkerQueueHead != 0', 119)
  }
  if (pNodeLink === 0) {
    throw new D2CommonAssertError('pNodeLink != 0', 120)
  }

  m.setU32(pNodeLink, pWorkerQueueHead)
  const prevTail = m.u32((pWorkerQueueHead + 0x04) >>> 0) >>> 0
  m.setU32((pNodeLink + 0x04) >>> 0, prevTail)
  m.setU32(prevTail, pNodeLink)
  m.setU32((pWorkerQueueHead + 0x04) >>> 0, pNodeLink)

  m.setU32((pWorker + 0x04) >>> 0, (m.u32((pWorker + 0x04) >>> 0) + 1) >>> 0)
  m.setU32(0x6fd303ac, (m.u32(0x6fd303ac) + 1) >>> 0)

  const nextLink = m.u32((pWorkerLink + 0x04) >>> 0) >>> 0
  const prevLink = m.u32(pWorkerLink) >>> 0
  m.setU32((prevLink + 0x04) >>> 0, nextLink)
  const nextLink2 = m.u32((pWorkerLink + 0x04) >>> 0) >>> 0
  const prevLink2 = m.u32(pWorkerLink) >>> 0
  m.setU32(nextLink2, prevLink2)

  const newHead = m.u32(0x6fd30398) >>> 0
  if (newHead === 0) {
    throw new D2CommonAssertError('g_WorkerListHead != 0', 108)
  }

  m.setU32(pWorkerLink, newHead)
  const oldTail = m.u32((newHead + 0x04) >>> 0) >>> 0
  m.setU32((pWorkerLink + 0x04) >>> 0, oldTail)
  m.setU32(oldTail, pWorkerLink)
  m.setU32((newHead + 0x04) >>> 0, pWorkerLink)
  return 1
}

/**
 * Computes the `D2SaveHeader` CRC-32 checksum over `[pSaveData, pSaveData + nByteLen)`
 * (`esi = pSaveData`, `[esp+4] = nByteLen`, `ret 0x4`), temporarily zeroing header fields
 * `+0x0C`, `+0x30`, `+0x34`, and `+0xAB` when `dwVersion` (`+0x04`) `> 0x5B`.
 *
 * @va D2Game:0x6FC73170
 */
export function PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c(
  m: D2KernMemory113c,
  pSaveData: number,
  nByteLen: number,
): number {
  hitD2GameVa113c(0x6FC73170)
  const base = pSaveData >>> 0
  const dwVersion = m.u32((base + 0x04) >>> 0) >>> 0
  let saved0c = 0
  let saved30 = 0
  let saved34 = 0
  let savedAb = 0
  if (dwVersion > 0x5b) {
    saved0c = m.u32((base + 0x0c) >>> 0) >>> 0
    saved30 = m.u32((base + 0x30) >>> 0) >>> 0
    saved34 = m.u32((base + 0x34) >>> 0) >>> 0
    savedAb = m.u32((base + 0xab) >>> 0) >>> 0
    m.setU32((base + 0x0c) >>> 0, 0)
    m.setU32((base + 0x30) >>> 0, 0)
    m.setU32((base + 0x34) >>> 0, 0)
    m.setU32((base + 0xab) >>> 0, 0)
  }
  const crc = CHECKSUM_ComputeCrc32_6FC2B470_113c(m, base, nByteLen >>> 0) >>> 0
  if (dwVersion > 0x5b) {
    m.setU32((base + 0x0c) >>> 0, saved0c)
    m.setU32((base + 0x30) >>> 0, saved30)
    m.setU32((base + 0x34) >>> 0, saved34)
    m.setU32((base + 0xab) >>> 0, savedAb)
  }
  return crc
}

/**
 * Writes the `'JM'` (`0x4D4A`) item list header, item count, inventory items (excluding body
 * slots `4` and `5` in pass 1, then writing weapon slots `4`/`5` ordered by composite weapon,
 * followed by the cursor item) into `pBuffer` (`ecx`) from `pInventory` (`edx`) up to
 * `nMaxBytes` (`[esp+0xC]`, `ret 0x18`).
 *
 * @va D2Game:0x6FC737D0
 */
export function PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c(
  m: D2KernMemory113c,
  pBuffer: number,
  pInventory: number,
  _arg0 = 0,
  _arg1 = 0,
  nMaxBytes = 0,
  _arg3 = 0,
  _arg4 = 0,
  _arg5 = 0,
): number {
  hitD2GameVa113c(0x6FC737D0)
  const maxBytes = nMaxBytes | 0
  if (maxBytes < 2) {
    return 0
  }
  const baseBuf = pBuffer >>> 0
  const inv = pInventory >>> 0
  m.setU16(baseBuf, 0x4d4a)
  let curPtr = (baseBuf + 2) >>> 0
  let nCount = PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c(m, inv) >>> 0
  const elapsedAfterHeader = (curPtr - baseBuf) | 0
  if (maxBytes < ((elapsedAfterHeader + 2) | 0)) {
    return elapsedAfterHeader
  }
  const pCountField = curPtr
  m.setU16(pCountField, nCount & 0xffff)
  curPtr = (curPtr + 2) >>> 0
  if (inv === 0) {
    return (curPtr - baseBuf) | 0
  }

  const sp = k2W3B5StackPtr
  k2W3B5StackPtr = (sp + 0x2020) >>> 0
  try {
    const pCompositWeapon = INVENTORY_GetCompositWeaponMemPort113c(m, inv) >>> 0
    const pBodyLoc4 = INVENTORY_GetItemFromBodyLocMemPort113c(m, inv, 4) >>> 0
    const pBodyLoc5 = INVENTORY_GetItemFromBodyLocMemPort113c(m, inv, 5) >>> 0
    const pCursorItem = INVENTORY_GetCursorItem113c(m, inv) >>> 0

    if (pCompositWeapon !== 0) {
      if (pBodyLoc4 === pCompositWeapon) {
        if ((ITEMS_SerializeItemToBuffer113c(m, pBodyLoc4, sp, 0x2000, 1, 1, 0) | 0) < 0) {
          return -1
        }
        if (pBodyLoc5 !== 0) {
          if ((ITEMS_SerializeItemToBuffer113c(m, pBodyLoc5, sp, 0x2000, 1, 1, 0) | 0) < 0) {
            return -1
          }
        }
      } else {
        if ((ITEMS_SerializeItemToBuffer113c(m, pBodyLoc5, sp, 0x2000, 1, 1, 0) | 0) < 0) {
          return -1
        }
        if (pBodyLoc4 !== 0) {
          if ((ITEMS_SerializeItemToBuffer113c(m, pBodyLoc4, sp, 0x2000, 1, 1, 0) | 0) < 0) {
            return -1
          }
        }
      }
    } else {
      if (pBodyLoc4 !== 0) {
        if ((ITEMS_SerializeItemToBuffer113c(m, pBodyLoc4, sp, 0x2000, 1, 1, 0) | 0) < 0) {
          return -1
        }
      }
      if (pBodyLoc5 !== 0) {
        if ((ITEMS_SerializeItemToBuffer113c(m, pBodyLoc5, sp, 0x2000, 1, 1, 0) | 0) < 0) {
          return -1
        }
      }
    }

    let pNode = INVENTORY_GetFirstItem113c(m, inv) >>> 0
    while (pNode !== 0) {
      const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
      const bodyLoc = ITEMS_GetBodyLocation113c(m, pItem) & 0xff
      const nodePos = INVENTORY_GetItemNodePositionOther113c(m, pNode) | 0
      if (!(nodePos === 3 && (bodyLoc === 4 || bodyLoc === 5))) {
        const rem = ((baseBuf - curPtr) + maxBytes) | 0
        const written = SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pItem, rem, curPtr) | 0
        if (written < 0) {
          return -1
        }
        curPtr = (curPtr + written) >>> 0
        if (written === 0 && (nCount & 0xffff) > 0) {
          nCount = (nCount + 0xffff) >>> 0
        }
      }
      pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    }

    if (pCompositWeapon !== 0) {
      if (pBodyLoc4 === pCompositWeapon) {
        const rem4 = ((baseBuf - curPtr) + maxBytes) | 0
        const w4 = SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pBodyLoc4, rem4, curPtr) | 0
        if (w4 < 0) {
          return -1
        }
        curPtr = (curPtr + w4) >>> 0
        if (w4 === 0 && (nCount & 0xffff) > 0) {
          nCount = (nCount + 0xffff) >>> 0
        }
        if (pBodyLoc5 !== 0) {
          const rem5 = ((baseBuf - curPtr) + maxBytes) | 0
          const w5 =
            SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pBodyLoc5, rem5, curPtr) | 0
          if (w5 < 0) {
            return -1
          }
          curPtr = (curPtr + w5) >>> 0
          if (w5 === 0 && (nCount & 0xffff) > 0) {
            nCount = (nCount + 0xffff) >>> 0
          }
        }
      } else {
        const rem5 = ((baseBuf - curPtr) + maxBytes) | 0
        const w5 = SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pBodyLoc5, rem5, curPtr) | 0
        if (w5 < 0) {
          return -1
        }
        curPtr = (curPtr + w5) >>> 0
        if (w5 === 0 && (nCount & 0xffff) > 0) {
          nCount = (nCount + 0xffff) >>> 0
        }
        if (pBodyLoc4 !== 0) {
          const rem4 = ((baseBuf - curPtr) + maxBytes) | 0
          const w4 =
            SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pBodyLoc4, rem4, curPtr) | 0
          if (w4 < 0) {
            return -1
          }
          curPtr = (curPtr + w4) >>> 0
          if (w4 === 0 && (nCount & 0xffff) > 0) {
            nCount = (nCount + 0xffff) >>> 0
          }
        }
      }
    } else {
      if (pBodyLoc4 !== 0) {
        const rem4 = ((baseBuf - curPtr) + maxBytes) | 0
        const w4 = SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pBodyLoc4, rem4, curPtr) | 0
        if (w4 < 0) {
          return -1
        }
        curPtr = (curPtr + w4) >>> 0
        if (w4 === 0 && (nCount & 0xffff) > 0) {
          nCount = (nCount + 0xffff) >>> 0
        }
      }
      if (pBodyLoc5 !== 0) {
        const rem5 = ((baseBuf - curPtr) + maxBytes) | 0
        const w5 = SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pBodyLoc5, rem5, curPtr) | 0
        if (w5 < 0) {
          return -1
        }
        curPtr = (curPtr + w5) >>> 0
        if (w5 === 0 && (nCount & 0xffff) > 0) {
          nCount = (nCount + 0xffff) >>> 0
        }
      }
    }

    if (pCursorItem !== 0 && (m.u32(pCursorItem) >>> 0) === 4) {
      const remCursor = ((baseBuf - curPtr) + maxBytes) | 0
      const wCur =
        SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pCursorItem, remCursor, curPtr) | 0
      if (wCur < 0) {
        return -1
      }
      curPtr = (curPtr + wCur) >>> 0
      if (wCur === 0 && (nCount & 0xffff) > 0) {
        nCount = (nCount + 0xffff) >>> 0
      }
    }

    m.setU16(pCountField, nCount & 0xffff)
    return (curPtr - baseBuf) | 0
  } finally {
    k2W3B5StackPtr = sp
  }
}

/**
 * Act 5 Quest 6 (`Eve of Destruction`) `pfSeqFilter` (`+0xF0`, `ecx = pQuest`):
 * if `bLastState != 5` and `bNotIntro != 0`, sets `bLastState = 1` when `0` and returns `1`;
 * otherwise chains to `QUESTS_GetQuestData(pQuest->pGame, pQuest->dwChainQuestId)->pfSeqFilter`.
 *
 * @va D2Game:0x6FC767A0
 */
export function ACT5Q6_SeqFilter_6FC767A0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  hooks?: K2W3B5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC767A0)
  const quest = pQuest >>> 0
  const bState = m.u8((quest + 0x0c) >>> 0)
  if (bState !== 5 && m.u8((quest + 0x09) >>> 0) !== 0) {
    if (bState === 0) {
      m.setU8((quest + 0x0c) >>> 0, 1)
    }
    return 1
  }
  const pRefQuest =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((quest + 0x04) >>> 0),
      m.u32((quest + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pRefQuest === 0) {
    return 0
  }
  if ((m.u32((quest + 0xf0) >>> 0) >>> 0) === 0) {
    throw new D2CommonAssertError('!IsBadCodePtr(pQuest->pfSeqFilter)', 0x3d5)
  }
  return dispatchQuestSeqFilterF0_113c(m, pRefQuest, hooks)
}

/**
 * Act 5 Quest 4 (`Betrayal of Harrogath`) `pfSeqFilter` (`+0xF0`, `ecx = pQuest`):
 * if `bLastState < 5` and `bNotIntro != 0`, sets `bLastState = 1` when `0` and returns `1`;
 * otherwise chains to `QUESTS_GetQuestData(pQuest->pGame, pQuest->dwChainQuestId)->pfSeqFilter`.
 *
 * @va D2Game:0x6FC76B10
 */
export function ACT5Q4_SeqFilter_6FC76B10_113c(
  m: D2KernMemory113c,
  pQuest: number,
  hooks?: K2W3B5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC76B10)
  const quest = pQuest >>> 0
  const bState = m.u8((quest + 0x0c) >>> 0)
  if (bState < 5 && m.u8((quest + 0x09) >>> 0) !== 0) {
    if (bState === 0) {
      m.setU8((quest + 0x0c) >>> 0, 1)
    }
    return 1
  }
  const pRefQuest =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((quest + 0x04) >>> 0),
      m.u32((quest + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pRefQuest === 0) {
    return 0
  }
  if ((m.u32((quest + 0xf0) >>> 0) >>> 0) === 0) {
    throw new D2CommonAssertError('!IsBadCodePtr(pQuest->pfSeqFilter)', 0x14b)
  }
  return dispatchQuestSeqFilterF0_113c(m, pRefQuest, hooks)
}

/**
 * Act 5 Quest 5 (`Rite of Passage`) `pfSeqFilter` (`+0xF0`, `ecx = pQuest`):
 * if `bLastState != 5` and `bNotIntro != 0`, sets `bLastState = 1` when `0` and returns `1`;
 * otherwise chains to `QUESTS_GetQuestData(pQuest->pGame, pQuest->dwChainQuestId)->pfSeqFilter`.
 *
 * @va D2Game:0x6FC76BD0
 */
export function ACT5Q5_SeqFilter_6FC76BD0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  hooks?: K2W3B5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC76BD0)
  const quest = pQuest >>> 0
  const bState = m.u8((quest + 0x0c) >>> 0)
  if (bState !== 5 && m.u8((quest + 0x09) >>> 0) !== 0) {
    if (bState === 0) {
      m.setU8((quest + 0x0c) >>> 0, 1)
    }
    return 1
  }
  const pRefQuest =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((quest + 0x04) >>> 0),
      m.u32((quest + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pRefQuest === 0) {
    return 0
  }
  if ((m.u32((quest + 0xf0) >>> 0) >>> 0) === 0) {
    throw new D2CommonAssertError('!IsBadCodePtr(pQuest->pfSeqFilter)', 0x2cd)
  }
  return dispatchQuestSeqFilterF0_113c(m, pRefQuest, hooks)
}

/**
 * Act 5 Quest 1 (`Siege on Harrogath`) `pfSeqFilter` (`+0xF0`, `ecx = pQuest`):
 * if `bLastState != 5` and `bNotIntro != 0`, returns `1` without mutating `bLastState`;
 * otherwise chains to `QUESTS_GetQuestData(pQuest->pGame, pQuest->dwChainQuestId)->pfSeqFilter`.
 *
 * @va D2Game:0x6FC76D10
 */
export function ACT5Q1_SeqFilter_6FC76D10_113c(
  m: D2KernMemory113c,
  pQuest: number,
  hooks?: K2W3B5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC76D10)
  const quest = pQuest >>> 0
  if (m.u8((quest + 0x0c) >>> 0) !== 5 && m.u8((quest + 0x09) >>> 0) !== 0) {
    return 1
  }
  const pRefQuest =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((quest + 0x04) >>> 0),
      m.u32((quest + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pRefQuest === 0) {
    return 0
  }
  if ((m.u32((quest + 0xf0) >>> 0) >>> 0) === 0) {
    throw new D2CommonAssertError('!IsBadCodePtr(pQuest->pfSeqFilter)', 0x272)
  }
  return dispatchQuestSeqFilterF0_113c(m, pRefQuest, hooks)
}

/**
 * Act 5 Quest 6 (`Eve of Destruction`, `QUESTRECORD` `0x28`) `pfActiveFilter` (`+0xEC`,
 * `ecx = pQuest`, `edx = nNpcId`, `[esp+4] = _pPlayer`, `[esp+8] = pQuestFlags`,
 * `[esp+0xC] = _pNpcUnit`, `ret 0xC`) for Ancient Statues (`0x219..0x21B`) and Harrogath NPCs
 * (`0x1FF..0x209`).
 *
 * @va D2Game:0x6FC76EF0
 */
export function ACT5Q6_ActiveFilter_6FC76EF0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit: number,
): number {
  hitD2GameVa113c(0x6FC76EF0)
  const quest = pQuest >>> 0
  const npc = nNpcId | 0
  if (npc >= 0x219 && npc <= 0x21b) {
    if (ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c(m, m.u32((quest + 0x04) >>> 0)) !== 0) {
      if (m.u8((quest + 0x0c) >>> 0) === 1) {
        const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
        if (m.u8((pQuestDataEx + 0x90) >>> 0) === 0) {
          return 1
        }
      }
    }
  }

  const flags = pQuestFlags >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, flags, 0x28, 0) === 0) {
    return 0
  }
  const idx = (npc - 0x1ff) >>> 0
  if (idx > 0x0a) {
    return 0
  }
  switch (idx) {
    case 0:
      return DRLGWARP_TestRoomTileBit113c(m, flags, 0x28, 4) === 0 ? 1 : 0
    case 1:
      return DRLGWARP_TestRoomTileBit113c(m, flags, 0x28, 9) === 0 ? 1 : 0
    case 2:
      return DRLGWARP_TestRoomTileBit113c(m, flags, 0x28, 6) === 0 ? 1 : 0
    case 4:
      return DRLGWARP_TestRoomTileBit113c(m, flags, 0x28, 8) === 0 ? 1 : 0
    case 9:
      if (DRLGWARP_TestRoomTileBit113c(m, flags, 0x28, 0x0a) !== 0) {
        return 0
      }
      return DRLGWARP_TestRoomTileBit113c(m, flags, 0x28, 5) === 0 ? 1 : 0
    case 10:
      return DRLGWARP_TestRoomTileBit113c(m, flags, 0x28, 7) === 0 ? 1 : 0
    default:
      return 0
  }
}

/**
 * Act 5 Quest 6 (`Eve of Destruction`, `QUESTRECORD` `0x28`) `pfCallback[0]` (`ecx = pQuest`,
 * `edx = pQuestArg`): appends NPC dialog text nodes (`QUESTS_AddNpcDialogTextNodes113c`) for
 * Ancient Statues (`0x219..0x21B`), post-completion Harrogath NPCs (`0x1FF..0x209`), or active
 * state table `0x6FD2D8A4`.
 *
 * @va D2Game:0x6FC77000
 */
export function ACT5Q6_Callback00_NpcActivate_6FC77000_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC77000)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, m.u32((arg + 0x0c) >>> 0)) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  const pNpcUnit = m.u32((arg + 0x08) >>> 0) >>> 0
  const nNpcId = pNpcUnit === 0 ? -1 : (m.u32((pNpcUnit + 0x04) >>> 0) | 0)
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0

  if (nNpcId >= 0x219 && nNpcId <= 0x21b) {
    if (ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c(m, m.u32((quest + 0x04) >>> 0)) === 0) {
      return
    }
    const bState = m.u8((quest + 0x0c) >>> 0)
    if (bState === 1) {
      if (m.u8((pQuestDataEx + 0x90) >>> 0) === 0) {
        QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), nNpcId)
        return
      }
    }
    if (bState === 2 && m.u8((pQuestDataEx + 0x90) >>> 0) !== 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), nNpcId)
    }
    return
  }

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0) !== 0) {
    const idx = (nNpcId - 0x1ff) >>> 0
    if (idx > 0x0a) {
      return
    }
    switch (idx) {
      case 0:
        if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 4) === 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 2, m.u32((arg + 0x14) >>> 0), nNpcId)
        } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0x0d) !== 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), nNpcId)
        }
        return
      case 1:
        if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 9) === 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 2, m.u32((arg + 0x14) >>> 0), nNpcId)
        } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0x0d) !== 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), nNpcId)
        }
        return
      case 2:
        if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 6) === 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 2, m.u32((arg + 0x14) >>> 0), nNpcId)
        } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0x0d) !== 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), nNpcId)
        }
        return
      case 4:
        if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 8) === 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 2, m.u32((arg + 0x14) >>> 0), nNpcId)
        } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0x0d) !== 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), nNpcId)
        }
        return
      case 9:
        if (
          DRLGWARP_TestRoomTileBit113c(
            m,
            pQuestFlags,
            m.u32((quest + 0xe0) >>> 0) | 0,
            0x0a,
          ) !== 0
        ) {
          return
        }
        if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 5) === 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 4, m.u32((arg + 0x14) >>> 0), nNpcId)
        } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0x0d) !== 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 5, m.u32((arg + 0x14) >>> 0), nNpcId)
        }
        return
      case 10:
        if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0x0d) !== 0) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 2, m.u32((arg + 0x14) >>> 0), nNpcId)
        }
        return
      default:
        return
    }
  }

  const bState = m.u8((quest + 0x0c) >>> 0)
  if (bState < 4) {
    const msgIdx = readQuestStateMsgTable113c(
      m,
      0x6fd2d8a4,
      ACT5Q6_STATE_MSG_TABLE_6FD2D8A4,
      bState,
    )
    if (msgIdx !== 0xffffffff && (msgIdx >>> 0) < 9) {
      QUESTS_AddNpcDialogTextNodes113c(m, quest, msgIdx | 0, m.u32((arg + 0x14) >>> 0), nNpcId)
    }
  }
}

/**
 * Act 5 Quest 5 (`Rite of Passage`, `QUESTRECORD` `0x27`) `pfCallback[0]` (`ecx = pQuest`,
 * `edx = pQuestArg`): appends NPC dialog text nodes for Harrogath NPCs (`0x1FF..0x208`),
 * Ancient Statues (`0x219..0x21B`), or state table `0x6FD2D1A4`.
 *
 * @va D2Game:0x6FC775F0
 */
export function ACT5Q5_Callback00_NpcActivate_6FC775F0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC775F0)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, m.u32((arg + 0x0c) >>> 0)) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  const bBit0 =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0) | 0
  const pNpcUnit = m.u32((arg + 0x08) >>> 0) >>> 0
  const nNpcId = pNpcUnit === 0 ? -1 : (m.u32((pNpcUnit + 0x04) >>> 0) | 0)

  if (m.u8((quest + 0x09) >>> 0) === 0) {
    return
  }

  if (bBit0 !== 0) {
    const bBitD =
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0x0d) | 0
    const idx = (nNpcId - 0x1ff) >>> 0
    if (idx > 9) {
      return
    }
    let nState = -1
    switch (idx) {
      case 0:
        nState = 5
        break
      case 1:
        nState = 7
        break
      case 2:
        nState = 8
        break
      case 4:
        nState = 9
        break
      case 9:
        nState = 6
        break
      default:
        return
    }
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, nState) === 0
    ) {
      QUESTS_AddNpcDialogTextNodes113c(m, quest, 5, m.u32((arg + 0x14) >>> 0), nNpcId)
    } else if (bBitD !== 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), nNpcId)
    }
    return
  }

  if (nNpcId >= 0x219 && nNpcId <= 0x21b) {
    if (m.u8((pQuestDataEx + 0x10) >>> 0) === 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, quest, 4, m.u32((arg + 0x14) >>> 0), nNpcId)
    }
  }
  const bState = m.u8((quest + 0x0c) >>> 0)
  const msgIdx = readQuestStateMsgTable113c(
    m,
    0x6fd2d1a4,
    ACT5Q5_STATE_MSG_TABLE_6FD2D1A4,
    bState,
  )
  if (msgIdx !== 0xffffffff && (msgIdx >>> 0) < 9) {
    QUESTS_AddNpcDialogTextNodes113c(m, quest, msgIdx | 0, m.u32((arg + 0x14) >>> 0), nNpcId)
  }
}

/**
 * Checks whether `pPlayer` (`edx`) in `pGame` (`ecx`, `[esp+4] = _arg0`, `ret 0x4`) occupies or
 * is adjacent to `pQuest22->pQuestDataEx->pNihlathakRoom` (`+0x8C`), and when Quest `0x25` has
 * bit `0` or `1` set while Quest `0x26` bits `0`, `1`, and `0x0E` are clear, sets Quest `0x26`
 * states `1` and `0x0D`.
 *
 * @va D2Game:0x6FC77900
 */
export function ACT5Q4_CheckPlayerNearNihlathakRoom_6FC77900_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _arg0 = 0,
): number {
  hitD2GameVa113c(0x6FC77900)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const bDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  const pPlayerRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pPlayerRoom === 0) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0x0e) !== 0) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0) !== 0) {
    return 0
  }

  const pQuest22 = findQuestNodeInChain113c(m, game, 0x22)
  const pQuestDataEx = m.u32((pQuest22 + 0x18) >>> 0) >>> 0
  const pTargetRoom = m.u32((pQuestDataEx + 0x8c) >>> 0) >>> 0
  let bNear = 0
  if (pPlayerRoom === pTargetRoom) {
    bNear = 1
  } else {
    const sp = k2W3B5StackPtr
    k2W3B5StackPtr = (sp + 0x10) >>> 0
    try {
      m.setU32(sp, 0)
      m.setU32((sp + 0x04) >>> 0, 0)
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pPlayerRoom, (sp + 0x04) >>> 0, sp)
      const nRooms = m.u32(sp) >>> 0
      const ppRooms = m.u32((sp + 0x04) >>> 0) >>> 0
      for (let i = 0; i < nRooms; i++) {
        if ((m.u32((ppRooms + i * 4) >>> 0) >>> 0) === pTargetRoom) {
          bNear = 1
          break
        }
      }
    } finally {
      k2W3B5StackPtr = sp
    }
  }

  const pPlayerData2 = UNITS_GetPlayerData113c(m, player) >>> 0
  const bDiff2 = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags2 = m.u32((pPlayerData2 + bDiff2 * 4 + 0x10) >>> 0) >>> 0
  if (bNear === 0) {
    return 0
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags2, 0x25, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags2, 0x25, 1) === 0
  ) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags2, 0x26, 0) !== 0) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags2, 0x26, 1) !== 0) {
    return 0
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags2, 0x26, 1)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags2, 0x26, 0x0d)
  return 0
}

/**
 * Act 5 Quest 4 (`Betrayal of Harrogath`, `QUESTRECORD` `0x26`) `pfCallback[0]` (`ecx = pQuest`,
 * `edx = pQuestArg`): appends NPC dialog text nodes for Anya (`0x200`), completion states,
 * quest player GUID list (`pQuest + 0x1C`), or state table `0x6FD2CAA8`.
 *
 * @va D2Game:0x6FC77A60
 */
export function ACT5Q4_Callback00_NpcActivate_6FC77A60_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC77A60)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, m.u32((arg + 0x0c) >>> 0)) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  const bBit0 =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0) | 0
  const bBitD =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0x0d) | 0
  const pNpcUnit = m.u32((arg + 0x08) >>> 0) >>> 0
  const nNpcId = pNpcUnit === 0 ? -1 : (m.u32((pNpcUnit + 0x04) >>> 0) | 0)

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 1) === 0
  ) {
    return
  }

  if (nNpcId === 0x200 && m.u8((quest + 0x0c) >>> 0) === 1) {
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 1) !== 0
    ) {
      return
    }
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0) !== 0
    ) {
      return
    }
    QUESTS_AddNpcDialogTextNodes113c(m, quest, 0, m.u32((arg + 0x14) >>> 0), nNpcId)
    return
  }

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 1) !== 0
  ) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 4) === 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), nNpcId)
    } else {
      QUESTS_AddNpcDialogTextNodes113c(m, quest, 4, m.u32((arg + 0x14) >>> 0), nNpcId)
    }
    return
  }

  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const playerGuid = pPlayer === 0 ? 0xffffffff : (m.u32((pPlayer + 0x0c) >>> 0) >>> 0)
  const nGuidCount = m.u16((quest + 0x9c) >>> 0)
  for (let i = 0; i < nGuidCount; i++) {
    if ((m.u32((quest + 0x1c + i * 4) >>> 0) >>> 0) === playerGuid) {
      QUESTS_AddNpcDialogTextNodes113c(m, quest, 4, m.u32((arg + 0x14) >>> 0), nNpcId)
      return
    }
  }

  if (bBit0 === 1) {
    return
  }
  const bState = m.u8((quest + 0x0c) >>> 0)
  if (bState >= 4 && bBitD === 0) {
    return
  }
  if (m.u8((quest + 0x09) >>> 0) === 0) {
    return
  }
  const msgIdx = readQuestStateMsgTable113c(
    m,
    0x6fd2caa8,
    ACT5Q4_STATE_MSG_TABLE_6FD2CAA8,
    bState,
  )
  if (msgIdx !== 0xffffffff && (msgIdx >>> 0) < 8) {
    QUESTS_AddNpcDialogTextNodes113c(m, quest, msgIdx | 0, m.u32((arg + 0x14) >>> 0), nNpcId)
  }
}

/**
 * Act 5 Quest 3 (`Prison of Ice`, `QUESTRECORD` `0x25`) `pfCallback[3]` (`ecx = pQuest`,
 * `edx = pQuestArg`): increments `pQuestDataEx[+0xD8]` if the player holds `'ice '`
 * (`0x20656369`), and when Quest `0x21` (`pQuest`) is inactive or `bLastState >= 5` while
 * Quest `0x22` is active (`bNotIntro != 0`) and Quest `0x25` bits `0`, `1`, `6` are clear,
 * sets Quest `0x26` state `0x0E`.
 *
 * @va D2Game:0x6FC77DD0
 */
export function ACT5Q3_Callback03_OnItemPickedUp_6FC77DD0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC77DD0)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(arg) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20656369) !== 0) {
    const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
    m.setU32((pQuestDataEx + 0xd8) >>> 0, (m.u32((pQuestDataEx + 0xd8) >>> 0) + 1) >>> 0)
  }
  if (m.u8((quest + 0x09) >>> 0) !== 0 && m.u8((quest + 0x0c) >>> 0) < 5) {
    return
  }
  const pQuest22 = findQuestNodeInChain113c(m, m.u32((quest + 0x04) >>> 0), 0x22)
  if (pQuest22 === 0) {
    return
  }
  if (m.u8((pQuest22 + 0x09) >>> 0) === 0) {
    return
  }
  const pPlayer2 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame2 = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer2) >>> 0
  const bDiff = m.u8((pGame2 + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 1) !== 0) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 6) !== 0) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0) !== 0) {
    return
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 0x0e)
}

const ACT5Q2_STATE_MSG_TABLE_6FD2BC20: readonly number[] = [
  0xffffffff,
  0,
  1,
  2,
  3,
  4,
  540487794,
  540553330,
]

const ACT5Q1_STATE_MSG_TABLE_6FD2B2D8: readonly number[] = [
  0xffffffff,
  0,
  1,
  2,
  3,
  4,
  515,
  20096,
]

/**
 * Act 5 Quest 3 (`Prison of Ice`, `QUESTRECORD` `0x25`) `pfCallback[11]` (`ecx = pQuest`,
 * `edx = pQuestArg`): checks if the joining player holds `'ice '` (`0x20656369`), updates
 * `pQuestDataEx[+0x84]` / `[+0x88]` when completed, or syncs `bLastState` (`+0x0C`) and
 * `bQuestFlags` (`+0x0B`) from states `2`, `3`, and `pQuestDataEx[+0xD8]`.
 *
 * @va D2Game:0x6FC77E80
 */
export function ACT5Q3_Callback11_OnPlayerConnect_6FC77E80_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC77E80)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20656369) !== 0) {
    m.setU32((pQuestDataEx + 0xd8) >>> 0, 1)
  }

  const pPlayer2 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame2 = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer2) >>> 0
  const bDiff = m.u8((pGame2 + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0x0f) !== 0
  ) {
    m.setU32((pQuestDataEx + 0x84) >>> 0, 2)
    m.setU32((pQuestDataEx + 0x88) >>> 0, 1)
    return
  }

  if (m.u8((quest + 0x09) >>> 0) === 0) {
    return
  }

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 3) !== 0
  ) {
    m.setU8((quest + 0x0c) >>> 0, 3)
    m.setU8((quest + 0x0b) >>> 0, 1)
  } else if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 2) !== 0
  ) {
    m.setU8((quest + 0x0c) >>> 0, 2)
    m.setU8((quest + 0x0b) >>> 0, 1)
  }

  if (m.u32((pQuestDataEx + 0xd8) >>> 0) !== 0) {
    m.setU8((quest + 0x0c) >>> 0, 3)
    m.setU8((quest + 0x0b) >>> 0, 4)
  }
}

/**
 * Act 5 Quest 3 (`Prison of Ice`, `QUESTRECORD` `0x25`) `pfActiveFilter` (`+0xEC`,
 * `ecx = pQuest`, `edx = nNpcId`, `[esp+4] = pPlayer`, `[esp+8] = pQuestFlags`,
 * `[esp+0xC] = _pNpcUnit`, `ret 0xC`) for Malah (`0x201`), Frozen Anya (`0x20F`), and Anya (`0x200`).
 *
 * @va D2Game:0x6FC77F50
 */
export function ACT5Q3_ActiveFilter_6FC77F50_113c(
  m: D2KernMemory113c,
  pQuest: number,
  nNpcId: number,
  pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit: number,
): number {
  hitD2GameVa113c(0x6FC77F50)
  const quest = pQuest >>> 0
  const npc = nNpcId | 0
  const flags = pQuestFlags >>> 0

  if (npc === 0x201) {
    if (DRLGWARP_TestRoomTileBit113c(m, flags, m.u32((quest + 0xe0) >>> 0) | 0, 1) !== 0) {
      if (DRLGWARP_TestRoomTileBit113c(m, flags, 0x25, 8) === 0) {
        return 1
      }
    }
    if (DRLGWARP_TestRoomTileBit113c(m, flags, m.u32((quest + 0xe0) >>> 0) | 0, 0) !== 0) {
      return 0
    }
    if (DRLGWARP_TestRoomTileBit113c(m, flags, m.u32((quest + 0xe0) >>> 0) | 0, 1) !== 0) {
      return 0
    }
    const bState = m.u8((quest + 0x0c) >>> 0)
    if (bState === 1) {
      return 1
    }
    if (bState !== 4) {
      return 0
    }
    const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
    return m.u32((pQuestDataEx + 0xd8) >>> 0) === 0 ? 1 : 0
  }

  if (npc === 0x20f) {
    if (m.u8((quest + 0x09) >>> 0) === 0) {
      return 0
    }
    if (m.u8((quest + 0x0c) >>> 0) >= 5) {
      return 0
    }
    const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
    if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame, 0x20656369) !== 0) {
      return 0
    }
    return 1
  }

  if (npc === 0x200) {
    if (DRLGWARP_TestRoomTileBit113c(m, flags, m.u32((quest + 0xe0) >>> 0) | 0, 1) === 0) {
      return 0
    }
    return DRLGWARP_TestRoomTileBit113c(m, flags, 0x25, 9) === 0 ? 1 : 0
  }

  return 0
}

/**
 * Act 5 Quest 2 (`Rescue on Mount Arreat`, `QUESTRECORD` `0x24`) `pfCallback[0]` (`ecx = pQuest`,
 * `edx = pQuestArg`): appends NPC dialog text nodes for Qual-Kehk (`0x203`), player GUID list,
 * or state table `0x6FD2BC20`.
 *
 * @va D2Game:0x6FC783C0
 */
export function ACT5Q2_Callback00_NpcActivate_6FC783C0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC783C0)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, m.u32((arg + 0x0c) >>> 0)) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  const bBit0 =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0) | 0
  const bBitD =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0x0d) | 0
  const pNpcUnit = m.u32((arg + 0x08) >>> 0) >>> 0
  const nNpcId = pNpcUnit === 0 ? -1 : (m.u32((pNpcUnit + 0x04) >>> 0) | 0)

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 1) !== 0
  ) {
    QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), nNpcId)
    return
  }

  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const playerGuid = pPlayer === 0 ? 0xffffffff : (m.u32((pPlayer + 0x0c) >>> 0) >>> 0)
  const nGuidCount = m.u16((quest + 0x9c) >>> 0)
  for (let i = 0; i < nGuidCount; i++) {
    if ((m.u32((quest + 0x1c + i * 4) >>> 0) >>> 0) === playerGuid) {
      QUESTS_AddNpcDialogTextNodes113c(m, quest, 4, m.u32((arg + 0x14) >>> 0), nNpcId)
      return
    }
  }

  if (bBit0 === 1) {
    return
  }
  const bState = m.u8((quest + 0x0c) >>> 0)
  if (bState >= 4 && bBitD === 0) {
    return
  }
  if (m.u8((quest + 0x09) >>> 0) === 0) {
    return
  }
  const msgIdx = readQuestStateMsgTable113c(
    m,
    0x6fd2bc20,
    ACT5Q2_STATE_MSG_TABLE_6FD2BC20,
    bState,
  )
  if (msgIdx === 2 && nNpcId === 0x203) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 4) !== 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, quest, 5, m.u32((arg + 0x14) >>> 0), 0x203)
      return
    }
    QUESTS_AddNpcDialogTextNodes113c(m, quest, msgIdx | 0, m.u32((arg + 0x14) >>> 0), nNpcId)
    return
  }
  if (msgIdx !== 0xffffffff && (msgIdx >>> 0) < 0x0c) {
    QUESTS_AddNpcDialogTextNodes113c(m, quest, msgIdx | 0, m.u32((arg + 0x14) >>> 0), nNpcId)
  }
}

/**
 * Syncs `pPlayer` (`edx`) Quest `0x24` (`Rescue on Mount Arreat`) state `2` or `3` from
 * `pQuest20->bLastState` (`+0x0C`) in `pGame` (`ecx`, `[esp+4] = _arg0`, `ret 0x4`) when
 * states `0` and `1` are clear.
 *
 * @va D2Game:0x6FC78530
 */
export function ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _arg0 = 0,
): number {
  hitD2GameVa113c(0x6FC78530)
  const game = pGame >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const bDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 0) === 1) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 1) === 1) {
    return 0
  }
  const pQuest20 = findQuestNodeInChain113c(m, game, 0x20)
  if (pQuest20 === 0) {
    return 0
  }
  const bState = m.u8((pQuest20 + 0x0c) >>> 0)
  if (bState === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 2)
    return 0
  }
  if (bState === 3) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 3)
  }
  return 0
}

/**
 * Marks Quest `0x23` (`Siege on Harrogath`) state `0` set and state `1` clear for `pPlayer`
 * (`eax`) in `pGame` (`edi`), and verifies that either state `0x0F` is set or Quest `0x1F`
 * exists in `pGame->pQuestControl` (`Fog.#10024` line `0x2EE`).
 *
 * @va D2Game:0x6FC785C0
 */
export function ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F_6FC785C0_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC785C0)
  const game = pGame >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const bDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 0)
  QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x23, 1)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0x0f) !== 0) {
    return
  }
  const pQuest1F = findQuestNodeInChain113c(m, game, 0x1f)
  if (pQuest1F !== 0) {
    return
  }
  throw new D2CommonAssertError('pQuest1F != NULL', 0x2ee)
}

/**
 * Party iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _arg0`, `ret 0x4`):
 * sets Quest `0x23` states `1` and `0x0D` when `pPlayer` is in Act 5 (`actNo == 4`) and has
 * Quest `0x23` states `0`, `1`, and `0x0D` clear.
 *
 * @va D2Game:0x6FC78640
 */
export function ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _arg0 = 0,
): void {
  hitD2GameVa113c(0x6FC78640)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const bDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0) === 1) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 1) === 1) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0x0d) === 1) {
    return
  }
  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) {
    return
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) {
    return
  }
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 4) {
    return
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 1)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 0x0d)
}

/**
 * Checks whether `pPlayer` (`edx`) in `pGame` (`ecx`, `[esp+4] = _arg0`, `ret 0x4`) occupies or
 * is adjacent to `pQuest1F->pQuestDataEx->pShenkRoom` (`+0x04`), and sets Quest `0x23` states
 * `1` and `0x0D` when state `0` is clear.
 *
 * @va D2Game:0x6FC786C0
 */
export function ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _arg0 = 0,
): number {
  hitD2GameVa113c(0x6FC786C0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const bDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  const pPlayerRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pPlayerRoom === 0) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0) !== 0) {
    return 0
  }

  const pQuest1F = findQuestNodeInChain113c(m, game, 0x1f)
  const pQuestDataEx = m.u32((pQuest1F + 0x18) >>> 0) >>> 0
  const pShenkRoom = m.u32((pQuestDataEx + 0x04) >>> 0) >>> 0
  let bNear = 0
  if (pPlayerRoom === pShenkRoom) {
    bNear = 1
  } else {
    const sp = k2W3B5StackPtr
    k2W3B5StackPtr = (sp + 0x10) >>> 0
    try {
      m.setU32(sp, 0)
      m.setU32((sp + 0x04) >>> 0, 0)
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pPlayerRoom, (sp + 0x04) >>> 0, sp)
      const nRooms = m.u32(sp) >>> 0
      const ppRooms = m.u32((sp + 0x04) >>> 0) >>> 0
      for (let i = 0; i < nRooms; i++) {
        if ((m.u32((ppRooms + i * 4) >>> 0) >>> 0) === pShenkRoom) {
          bNear = 1
          break
        }
      }
    } finally {
      k2W3B5StackPtr = sp
    }
  }

  const pPlayerData2 = UNITS_GetPlayerData113c(m, player) >>> 0
  const bDiff2 = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags2 = m.u32((pPlayerData2 + bDiff2 * 4 + 0x10) >>> 0) >>> 0
  if (bNear !== 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags2, 0x23, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags2, 0x23, 0x0d)
  }
  return 0
}

/**
 * Act 5 Quest 1 (`Siege on Harrogath`, `QUESTRECORD` `0x23`) `pfCallback[0]` (`ecx = pQuest`,
 * `edx = pQuestArg`): appends NPC dialog text nodes for Larzuk (`0x1FF`) and state table `0x6FD2B2D8`.
 *
 * @va D2Game:0x6FC787C0
 */
export function ACT5Q1_Callback00_NpcActivate_6FC787C0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC787C0)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, m.u32((arg + 0x0c) >>> 0)) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  const bBit0 =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0) | 0
  const bBitD =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0x0d) | 0
  const pNpcUnit = m.u32((arg + 0x08) >>> 0) >>> 0
  const nNpcId = pNpcUnit === 0 ? -1 : (m.u32((pNpcUnit + 0x04) >>> 0) | 0)

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 1) !== 0
  ) {
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 5) !== 0
    ) {
      return
    }
    QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), nNpcId)
    return
  }

  if (bBit0 === 1) {
    return
  }
  const bState = m.u8((quest + 0x0c) >>> 0)
  if (bState >= 4 && bBitD === 0) {
    return
  }
  if (m.u8((quest + 0x09) >>> 0) === 0) {
    return
  }
  const msgIdx = readQuestStateMsgTable113c(
    m,
    0x6fd2b2d8,
    ACT5Q1_STATE_MSG_TABLE_6FD2B2D8,
    bState,
  )
  if (msgIdx !== 0xffffffff && (msgIdx >>> 0) < 8) {
    QUESTS_AddNpcDialogTextNodes113c(m, quest, msgIdx | 0, m.u32((arg + 0x14) >>> 0), nNpcId)
  }
}

/**
 * Syncs `pPlayer` (`edx`) Quest `0x23` (`Siege on Harrogath`) state `2`, `3`, or `4` from
 * `pQuest1F->bLastState` (`+0x0C`) and `bQuestFlags` (`+0x0B`) in `pGame` (`ecx`,
 * `[esp+4] = _arg0`, `ret 0x4`) when states `0` and `1` are clear.
 *
 * @va D2Game:0x6FC78890
 */
export function ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _arg0 = 0,
): number {
  hitD2GameVa113c(0x6FC78890)
  const game = pGame >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const bDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0) === 1) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 1) === 1) {
    return 0
  }
  const pQuest1F = findQuestNodeInChain113c(m, game, 0x1f)
  if (pQuest1F === 0) {
    return 0
  }
  const bState = m.u8((pQuest1F + 0x0c) >>> 0)
  if (bState === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 2)
    return 0
  }
  if (bState === 3) {
    if (m.u8((pQuest1F + 0x0b) >>> 0) === 2) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 4)
      return 0
    }
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 3)
  }
  return 0
}

/**
 * Act 5 Quest 6 (`Eve of Destruction`, `QUESTRECORD` `0x28`) `pfCallback[11]` (`ecx = pQuest`,
 * `edx = pQuestArg`): when state `0` or `0x0F` is set, sets state `0x0A` and updates
 * `pClient->wCharacterProgression` (`+0x0A`) for the active difficulty; otherwise syncs
 * `bQuestFlags` (`+0x0B`), `bLastState` (`+0x0C`), and `pQuestDataEx[+0x90]` from states `2..3`.
 *
 * @va D2Game:0x6FC78930
 */
export function ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC78930)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0x0f) !== 0
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0x0a)
    const pPlayer2 = m.u32((arg + 0x0c) >>> 0) >>> 0
    let pClient = 0
    if (pPlayer2 !== 0 && (m.u32(pPlayer2) >>> 0) === 0) {
      const ppd = UNITS_GetPlayerData113c(m, pPlayer2) >>> 0
      pClient = m.u32((ppd + 0x9c) >>> 0) >>> 0
    }
    const pQuestGame = m.u32((quest + 0x04) >>> 0) >>> 0
    const gameDiff = m.u8((pQuestGame + 0x6d) >>> 0)
    const wProg = m.u16((pClient + 0x0a) >>> 0)
    const stepPerDiff = (((wProg & 0x20) | 0x80) >>> 5) >>> 0
    const targetProg = (Math.imul(stepPerDiff, gameDiff) + 5) | 0
    const curProg = (wProg >>> 8) & 0x1f
    if (targetProg >= curProg) {
      const wProgNow = m.u16((pClient + 0x0a) >>> 0)
      const nextProg = ((targetProg << 8) | (wProgNow & 0xe0ff)) & 0xffff
      m.setU16((pClient + 0x0a) >>> 0, nextProg)
    }
    return
  }

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 1) === 1
  ) {
    return
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 3) === 1
  ) {
    m.setU8((quest + 0x0b) >>> 0, 1)
    m.setU8((quest + 0x0c) >>> 0, 3)
    return
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 2) === 1
  ) {
    const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
    m.setU8((pQuestDataEx + 0x90) >>> 0, 1)
    m.setU8((quest + 0x0b) >>> 0, 1)
    m.setU8((quest + 0x0c) >>> 0, 3)
  }
}

/**
 * Queues a 15-byte `0x50` quest message packet (`[0x50, 0x24, 0x00, wValLo, wValHi, ...]`)
 * carrying `pQuest24->pQuestDataEx[+0xA4]` to `pPlayer`'s client (`eax = pPlayer`,
 * `[esp+4] = pGame`, `ret 0x4`).
 *
 * @va D2Game:0x6FC78A40
 */
export function ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC78A40)
  const player = pPlayer >>> 0
  let pClient = 0
  if (player !== 0 && (m.u32(player) >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  const pQuest24 = findQuestNodeInChain113c(m, pGame >>> 0, 0x24)
  const pQuestDataEx = m.u32((pQuest24 + 0x18) >>> 0) >>> 0
  const wVal = m.u16((pQuestDataEx + 0xa4) >>> 0)

  const sp = k2W3B5StackPtr
  k2W3B5StackPtr = (sp + 0x20) >>> 0
  try {
    m.fill(sp, 0x10, 0)
    m.setU8(sp, 0x50)
    m.setU16((sp + 1) >>> 0, 0x24)
    m.setU16((sp + 3) >>> 0, wVal)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 0x0f)
  } finally {
    k2W3B5StackPtr = sp
  }
}

/**
 * If `pPlayer` (`edx`) in `pGame` (`ecx`, `[esp+4] = _arg0`, `ret 0x4`) has Quest `0x28`
 * state `0x0D` set, sends a 6-byte `0x5D` (`[0x5D, 0x24, 0x02, 0, 0, 0]`) packet to the client
 * and sets speech `0x53` (`+0x6E = 0x53`, `+0x70 = pPlayer`, `dwFlags |= 0x400`).
 *
 * @va D2Game:0x6FC78AE0
 */
export function ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _arg0 = 0,
): number {
  hitD2GameVa113c(0x6FC78AE0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const bDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0x0d) === 0) {
    return 0
  }

  let pClient = 0
  if (player !== 0 && (m.u32(player) >>> 0) === 0) {
    const ppd = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((ppd + 0x9c) >>> 0) >>> 0
  }

  const sp = k2W3B5StackPtr
  k2W3B5StackPtr = (sp + 0x10) >>> 0
  try {
    m.fill(sp, 8, 0)
    m.setU8(sp, 0x5d)
    m.setU8((sp + 1) >>> 0, 0x24)
    m.setU8((sp + 2) >>> 0, 2)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 6)
  } finally {
    k2W3B5StackPtr = sp
  }

  if (player === 0) {
    throw new D2CommonAssertError('pPlayer != NULL', 0x558)
  }
  m.setU16((player + 0x6e) >>> 0, 0x53)
  m.setU32((player + 0x70) >>> 0, player)
  UNITROOM_RefreshUnit113c(m, player)
  m.setU32((player + 0xc4) >>> 0, (m.u32((player + 0xc4) >>> 0) | 0x400) >>> 0)
  return 0
}

/**
 * Sets Quest `0x28` states `0x0D` and `0` in `pQuestFlags` (`eax`), advances
 * `pClient->wCharacterProgression` (`+0x0A`) for `pPlayer` (`ecx`) in `pGame` (`ebx`),
 * and increments `pQuest24->pQuestDataEx[+0x88]`.
 *
 * @va D2Game:0x6FC78BE0
 */
export function ACT5Q6_CompleteQuest28AndUpdateProgression_6FC78BE0_113c(
  m: D2KernMemory113c,
  pQuestFlags: number,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC78BE0)
  const flags = pQuestFlags >>> 0
  const player = pPlayer >>> 0
  const game = pGame >>> 0
  QUESTRECORD_SetQuestState113c(m, flags, 0x28, 0x0d)
  QUESTRECORD_SetQuestState113c(m, flags, 0x28, 0)

  let pClient = 0
  if (player !== 0 && (m.u32(player) >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const bDiff = m.u8((game + 0x6d) >>> 0)
  const wProg = m.u16((pClient + 0x0a) >>> 0)
  const stepPerDiff = (((wProg & 0x20) | 0x80) >>> 5) >>> 0
  const targetProg = (Math.imul(stepPerDiff, bDiff) + 5) | 0
  const curProg = (wProg >>> 8) & 0x1f
  if (targetProg >= curProg) {
    const wProgNow = m.u16((pClient + 0x0a) >>> 0)
    const nextProg = ((targetProg << 8) | (wProgNow & 0xe0ff)) & 0xffff
    m.setU16((pClient + 0x0a) >>> 0, nextProg)
  }

  const pQuest24 = findQuestNodeInChain113c(m, game, 0x24)
  if (pQuest24 !== 0) {
    const pQuestDataEx = m.u32((pQuest24 + 0x18) >>> 0) >>> 0
    m.setU32((pQuestDataEx + 0x88) >>> 0, (m.u32((pQuestDataEx + 0x88) >>> 0) + 1) >>> 0)
  }
}

/**
 * Party iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _arg0`, `ret 0x4`):
 * when `pPlayer` is in Act 5 (`actNo == 4`) with Quest `0x28` states `0` and `1` clear, sets
 * states `0` and `0x0D` and calls `CLIENTS_UpdateCharacterProgression113c(m, pClient, bDiff, 5)`.
 *
 * @va D2Game:0x6FC78C90
 */
export function ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _arg0 = 0,
): void {
  hitD2GameVa113c(0x6FC78C90)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const bDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0) === 1) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 1) === 1) {
    return
  }
  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) {
    return
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) {
    return
  }
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 4) {
    return
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x28, 0)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x28, 0x0d)

  if (player !== 0 && (m.u32(player) >>> 0) === 0) {
    const ppd = UNITS_GetPlayerData113c(m, player) >>> 0
    const pClient = m.u32((ppd + 0x9c) >>> 0) >>> 0
    CLIENTS_UpdateCharacterProgression113c(m, pClient, m.u8((game + 0x6d) >>> 0), 5)
    return
  }
  CLIENTS_UpdateCharacterProgression113c(m, 0, m.u8((game + 0x6d) >>> 0), 5)
}

/**
 * Act 5 Quest 4 (`Betrayal of Harrogath`, `QUESTRECORD` `0x26`) `pfCallback[11]` (`ecx = pQuest`,
 * `edx = pQuestArg`): syncs `bQuestFlags` (`+0x0B`) and `bLastState` (`+0x0C`) from states `0`,
 * `0x0F`, `1`, `4`, `3`, `2`, or sets `bLastState = 1` if Malah (`0x201`) intro flag is set.
 *
 * @va D2Game:0x6FC79450
 */
export function ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC79450)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0x0f) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 1) === 1
  ) {
    m.setU8((quest + 0x0b) >>> 0, 5)
    return
  }

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 4) === 1
  ) {
    m.setU8((quest + 0x0b) >>> 0, 2)
    m.setU8((quest + 0x0c) >>> 0, 3)
    return
  }

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 3) === 1
  ) {
    m.setU8((quest + 0x0b) >>> 0, 1)
    m.setU8((quest + 0x0c) >>> 0, 3)
    return
  }

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 2) === 1
  ) {
    m.setU8((quest + 0x0b) >>> 0, 1)
    m.setU8((quest + 0x0c) >>> 0, 2)
    return
  }

  const pGame2 = m.u32(arg) >>> 0
  const pPlayer2 = m.u32((arg + 0x0c) >>> 0) >>> 0
  if (QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer2, 0x201, pGame2) !== 0) {
    if (m.u8((quest + 0x0c) >>> 0) === 0 && m.u8((quest + 0x09) >>> 0) !== 0) {
      m.setU8((quest + 0x0c) >>> 0, 1)
    }
  }
}


const ACT5Q3_STATE_MSG_TABLE_6FD2C468: readonly number[] = [
  0xffffffff,
  0,
  1,
  2,
  3,
  4,
  5,
  0,
  512,
  20137,
  0,
  0,
  0,
  0,
  0,
  0,
]

function invokeMonsterStartModeW3B5_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  mode: number,
  pTarget: number,
  targetX: number,
  targetY: number,
  hooks?: K2W3B5Hooks113c,
): void {
  if (pGame === 0 || pMonster === 0) {
    return
  }
  if (hooks !== undefined && hooks.world !== undefined) {
    MONSTER_StartMode113c(hooks.world, pMonster, mode, pTarget, targetX, targetY)
    return
  }
  MONSTER_StartMode113c(
    m,
    pGame >>> 0,
    pMonster >>> 0,
    mode | 0,
    pTarget >>> 0,
    targetX | 0,
    targetY | 0,
  )
}

function defaultSpawnMonsterAtCoordsW3B5_113c(
  m: D2KernMemory113c,
  nClassId: number,
  nMode: number,
  pGame: number,
  pRoom: number,
  x: number,
  y: number,
  nMaxRadius: number,
  wFlags: number,
  hooks?: K2W3B5Hooks113c,
): number {
  const sp = k2W3B5StackPtr
  k2W3B5StackPtr = (sp + 0x30) >>> 0
  try {
    m.setU32(sp, pGame >>> 0)
    m.setU32((sp + 0x04) >>> 0, pRoom >>> 0)
    m.setU32((sp + 0x08) >>> 0, 0)
    m.setU32((sp + 0x0c) >>> 0, nClassId >>> 0)
    m.setU32((sp + 0x10) >>> 0, nMode >>> 0)
    m.setU32((sp + 0x14) >>> 0, 0)
    m.setU32((sp + 0x18) >>> 0, x >>> 0)
    m.setU32((sp + 0x1c) >>> 0, y >>> 0)
    m.setU32((sp + 0x20) >>> 0, nMaxRadius >>> 0)
    m.setU16((sp + 0x24) >>> 0, wFlags & 0xffff)
    return MONSTER_Create113c(m, sp, hooks !== undefined ? hooks.regpop : undefined) >>> 0
  } finally {
    k2W3B5StackPtr = sp
  }
}

/**
 * Act 5 Intro Quest `pfActiveFilter` (`+0xEC`, `ecx = pQuest`, `edx = nNpcId`,
 * `[esp+4] = pPlayer`, `[esp+8] = _pQuestFlags`, `[esp+0xC] = _pNpcUnit`, `ret 0xC`):
 * returns `1` when `nNpcId == 0x201` (Malah) and the player has not yet heard Malah's intro.
 *
 * @va D2Game:0x6FC79680
 */
export function ACT5Intro_ActiveFilter_6FC79680_113c(
  m: D2KernMemory113c,
  pQuest: number,
  nNpcId: number,
  pPlayer: number,
  _pQuestFlags = 0,
  _pNpcUnit = 0,
): number {
  hitD2GameVa113c(0x6FC79680)
  if ((nNpcId | 0) !== 0x201) {
    return 0
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  if (QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer >>> 0, nNpcId | 0, pGame) !== 0) {
    return 0
  }
  return 1
}

/**
 * Act 5 Intro Quest `pfCallback[0]` (`ecx = pQuest`, `edx = pQuestArg`):
 * checks whether `pPlayer` has already heard the intro speech for Harrogath NPCs
 * (`0x200..0x203`, `0x208`), and if not, adds class-specific dialog text nodes (`1`, `2`, or `0`).
 *
 * @va D2Game:0x6FC796B0
 */
export function ACT5Intro_Callback00_NpcActivate_6FC796B0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC796B0)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pTarget === 0 ? -1 : (m.u32((pTarget + 0x04) >>> 0) | 0)
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const nPlayerClassId = pPlayer === 0 ? -1 : (m.u32((pPlayer + 0x04) >>> 0) | 0)

  const idx = (nNpcClassId - 0x200) >>> 0
  let classMatch1 = 7
  let classMatch2 = 7
  if (idx > 8) {
    return
  }
  switch (idx) {
    case 0:
    case 8:
      break
    case 1:
      classMatch1 = 4
      classMatch2 = 1
      break
    case 2:
      classMatch1 = 6
      classMatch2 = 2
      break
    case 3:
      classMatch1 = 5
      classMatch2 = 3
      break
    default:
      return
  }

  const pGame = m.u32(arg) >>> 0
  if (QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer, nNpcClassId, pGame) !== 0) {
    return
  }

  const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
  if (nPlayerClassId === classMatch1) {
    QUESTS_AddNpcDialogTextNodes113c(m, quest, 1, pTextHeader, nNpcClassId)
    return
  }
  if (nPlayerClassId === classMatch2) {
    QUESTS_AddNpcDialogTextNodes113c(m, quest, 2, pTextHeader, nNpcClassId)
    return
  }
  QUESTS_AddNpcDialogTextNodes113c(m, quest, 0, pTextHeader, nNpcClassId)
}

/**
 * Act 5 Intro Quest `pfCallback[2]` (`ecx = _pQuest`, `edx = pQuestArg`):
 * marks the Harrogath NPC intro speech flag on `pPlayer` when the matching intro message ID
 * (`0x4E23`, `0x4E2E`, `0x4E45..0x4E47`, `0x4E55..0x4E57`, `0x4E61..0x4E63`) is scrolled,
 * and activates Act 5 Quest 1 (`0x1F`) after Malah's intro (`0x201`).
 *
 * @va D2Game:0x6FC797B0
 */
export function ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c(
  m: D2KernMemory113c,
  _pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC797B0)
  const arg = pQuestArg >>> 0
  const nNpcClassId = m.u32((arg + 0x14) >>> 0) | 0
  const wMsgId = m.u16((arg + 0x18) >>> 0)
  const idx = (nNpcClassId - 0x200) >>> 0
  if (idx > 8) {
    return
  }

  switch (idx) {
    case 0: {
      if (wMsgId !== 0x4e2e) {
        return
      }
      const pGame = m.u32(arg) >>> 0
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(m, pPlayer, nNpcClassId, pGame)
      return
    }
    case 1: {
      if (wMsgId !== 0x4e47 && wMsgId !== 0x4e46 && wMsgId !== 0x4e45) {
        return
      }
      const pGame = m.u32(arg) >>> 0
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(m, pPlayer, nNpcClassId, pGame)
      const pQuest1F = findQuestNodeInChain113c(m, m.u32(arg) >>> 0, 0x1f)
      if (pQuest1F !== 0) {
        ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c(m, pQuest1F)
      }
      return
    }
    case 2: {
      if (wMsgId !== 0x4e56 && wMsgId !== 0x4e55 && wMsgId !== 0x4e57) {
        return
      }
      const pGame = m.u32(arg) >>> 0
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(m, pPlayer, nNpcClassId, pGame)
      return
    }
    case 3: {
      if (wMsgId !== 0x4e63 && wMsgId !== 0x4e62 && wMsgId !== 0x4e61) {
        return
      }
      const pGame = m.u32(arg) >>> 0
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(m, pPlayer, nNpcClassId, pGame)
      return
    }
    case 8: {
      if (wMsgId !== 0x4e23) {
        return
      }
      const pGame = m.u32(arg) >>> 0
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(m, pPlayer, nNpcClassId, pGame)
      return
    }
    default:
      return
  }
}

/**
 * Clones preset save-header chain `pSaveChain` (`edx`) into Act 5 Quest 3 (`0x21`) state `+0x108`
 * for preset object `0x1CD` (`eax = pGame`, `edx = pSaveChain`), and transfers ownership to the
 * tracked monster's `pAiGeneral + 0x38` when `+0x93 != 0` and `+0x10D == 0`.
 *
 * @va D2Game:0x6FC79D30
 */
export function ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSaveChain: number,
): void {
  hitD2GameVa113c(0x6FC79D30)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x21)
  if (pQuest === 0 || (pSaveChain >>> 0) === 0) {
    return
  }
  const pQuestGame0 = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const pMemPool = pQuestGame0 !== 0 ? (m.u32((pQuestGame0 + 0x1c) >>> 0) >>> 0) : 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const pCloned = DRLGPRESET_CloneSaveHeaderBlock113c(m, pMemPool, pSaveChain >>> 0) >>> 0
  const bSpawned = m.u8((pQuestDataEx + 0x93) >>> 0)
  const ppSlot108 = (pQuestDataEx + 0x108) >>> 0
  m.setU32(ppSlot108, pCloned)
  if (bSpawned === 0) {
    return
  }
  const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const dwMonGuid = m.u32((pQuestDataEx + 0x9c) >>> 0) >>> 0
  if (pQuestGame === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
  }
  let pMon = m.u32((pQuestGame + 0x1320 + ((dwMonGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pMon !== 0) {
    if ((m.u32((pMon + 0x0c) >>> 0) >>> 0) === dwMonGuid) {
      if (
        pCloned !== 0 &&
        (m.u32((pCloned + 0x04) >>> 0) >>> 0) !== 0 &&
        m.u8((pQuestDataEx + 0x10d) >>> 0) === 0
      ) {
        const ppAiPath = AIGENERAL_GetQuestDataPtr38_113c(m, pMon) >>> 0
        DRLGPRESET_MovePointerAndClear113c(m, ppSlot108, ppAiPath)
        m.setU8((pQuestDataEx + 0x10d) >>> 0, 1)
      }
      return
    }
    pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
  }
}

/**
 * Clones preset save-header chain `pSaveChain` (`edx`) into Act 5 Quest 3 (`0x21`) state `+0x104`
 * for preset object `0x1CB` (`eax = pGame`, `edx = pSaveChain`), and transfers ownership to the
 * tracked monster's `pAiGeneral + 0x38` when `+0x91 != 0` and `+0x10C == 0`.
 *
 * @va D2Game:0x6FC79E10
 */
export function ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSaveChain: number,
): void {
  hitD2GameVa113c(0x6FC79E10)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x21)
  if (pQuest === 0 || (pSaveChain >>> 0) === 0) {
    return
  }
  const pQuestGame0 = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const pMemPool = pQuestGame0 !== 0 ? (m.u32((pQuestGame0 + 0x1c) >>> 0) >>> 0) : 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const pCloned = DRLGPRESET_CloneSaveHeaderBlock113c(m, pMemPool, pSaveChain >>> 0) >>> 0
  const bSpawned = m.u8((pQuestDataEx + 0x91) >>> 0)
  const ppSlot104 = (pQuestDataEx + 0x104) >>> 0
  m.setU32(ppSlot104, pCloned)
  if (bSpawned === 0) {
    return
  }
  const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const dwMonGuid = m.u32((pQuestDataEx + 0x94) >>> 0) >>> 0
  if (pQuestGame === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
  }
  let pMon = m.u32((pQuestGame + 0x1320 + ((dwMonGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pMon !== 0) {
    if ((m.u32((pMon + 0x0c) >>> 0) >>> 0) === dwMonGuid) {
      if (
        pCloned !== 0 &&
        (m.u32((pCloned + 0x04) >>> 0) >>> 0) !== 0 &&
        m.u8((pQuestDataEx + 0x10c) >>> 0) === 0
      ) {
        const ppAiPath = AIGENERAL_GetQuestDataPtr38_113c(m, pMon) >>> 0
        DRLGPRESET_MovePointerAndClear113c(m, ppSlot104, ppAiPath)
        m.setU8((pQuestDataEx + 0x10c) >>> 0, 1)
      }
      return
    }
    pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
  }
}

/**
 * Allocates a permanent `D2StatListStrc` for `pPlayer` (`esi`), merges it into `pPlayer` with
 * `bType = 1`, sets fire (`0x27`), lightning (`0x29`), cold (`0x2B`), and poison (`0x2D`)
 * resistances to `nResistBonus` (`edi`), and syncs all 4 stats to the client (`[esp+4] = pGame`, `ret 0x4`).
 *
 * @va D2Game:0x6FC7A000
 */
export function ACT5Q3_GrantScrollOfResistanceStats_6FC7A000_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  nResistBonus: number,
  pGame: number,
  hooks?: K2W3B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7A000)
  const player = pPlayer >>> 0
  const bonus = nResistBonus | 0
  const dwOwnerId = player === 0 ? 0xffffffff : (m.u32((player + 0x0c) >>> 0) >>> 0)
  const dwOwnerType = player === 0 ? 6 : (m.u32(player) >>> 0)
  void pGame
  const pStatList = STATLIST_AllocList113c(m, 0, dwOwnerType, dwOwnerId, 0, 0) >>> 0
  if (pStatList === 0) {
    return
  }
  STATLIST_MergeStatLists113c(m, player, pStatList, 1)
  STATLIST_SetStat113c(m, pStatList, 0x27, bonus, 0)
  STATLIST_SetStat113c(m, pStatList, 0x29, bonus, 0)
  STATLIST_SetStat113c(m, pStatList, 0x2b, bonus, 0)
  STATLIST_SetStat113c(m, pStatList, 0x2d, bonus, 0)
  const plrModes = hooks !== undefined ? hooks.plrModes : undefined
  D2GAME_PLRMODES_SendStatToClientOrParty113c(m, player, 0x27, player, bonus, plrModes)
  D2GAME_PLRMODES_SendStatToClientOrParty113c(m, player, 0x29, player, bonus, plrModes)
  D2GAME_PLRMODES_SendStatToClientOrParty113c(m, player, 0x2b, player, bonus, plrModes)
  D2GAME_PLRMODES_SendStatToClientOrParty113c(m, player, 0x2d, player, bonus, plrModes)
}

/**
 * Checks whether any room adjacent to `pPlayer` (`eax`, falling back to `pGame->pClientList`'s
 * player when `nGameType == 3` or to `pFallbackUnit` at `[esp+4]`) contains a monster unit
 * (`dwUnitType == 1`) of class `0x1B2` (`434`, Barricade Prison Door) in mode `0x0C` (`12`, dead)
 * (`ecx = pGame`, `ret 0x4`).
 *
 * @va D2Game:0x6FC7A160
 */
export function ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
  pFallbackUnit: number,
): number {
  hitD2GameVa113c(0x6FC7A160)
  let pTarget = pPlayer >>> 0
  const game = pGame >>> 0
  if (pTarget === 0) {
    if (m.u8((game + 0x6a) >>> 0) === 3) {
      const pClientList = m.u32((game + 0x88) >>> 0) >>> 0
      if (pClientList !== 0) {
        pTarget = CLIENTS_GetPlayerUnit113c(m, pClientList, 0) >>> 0
      }
    }
    if (pTarget === 0) {
      pTarget = pFallbackUnit >>> 0
    }
  }

  const pRoom = UNITS_GetRoom113c(m, pTarget) >>> 0
  if (pRoom === 0) {
    return 0
  }

  const sp = k2W3B5StackPtr
  k2W3B5StackPtr = (sp + 0x10) >>> 0
  try {
    const pnRoomsNear = sp
    const pppRoomsNear = (sp + 0x04) >>> 0
    m.setU32(pnRoomsNear, 0)
    m.setU32(pppRoomsNear, 0)
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, pppRoomsNear, pnRoomsNear)
    const nRoomsNear = m.u32(pnRoomsNear) >>> 0
    const ppRooms = m.u32(pppRoomsNear) >>> 0
    for (let i = 0; i < nRoomsNear; i++) {
      const pAdjRoom = m.u32((ppRooms + i * 4) >>> 0) >>> 0
      let pUnit = m.u32((pAdjRoom + 0x74) >>> 0) >>> 0
      while (pUnit !== 0) {
        if (
          (m.u32(pUnit) >>> 0) === 1 &&
          (m.u32((pUnit + 0x04) >>> 0) >>> 0) === 0x1b2 &&
          (m.u32((pUnit + 0x10) >>> 0) >>> 0) === 0x0c
        ) {
          return 1
        }
        pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0
      }
    }
    return 0
  } finally {
    k2W3B5StackPtr = sp
  }
}

/**
 * Looks up the prison group index (`0..2`) for `pUnit` (`[esp+4]`) in Act 5 Quest 2 (`0x20`)
 * via `ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c`; if valid and `bObjectSpawned[idx]`
 * (`+0xF8 + idx`) is non-zero, resolves object GUID `dwObjGuids[idx]` (`+0xEC + idx*4`) in
 * `pGame->pUnitList[2]` (`+0x1520`), stores it to `*ppOutObject` (`[esp+8]`), and returns `1`
 * (`edi = pGame`, `ret 0x8`).
 *
 * @va D2Game:0x6FC7A290
 */
export function ACT5Q2_FindSpawnedPrisonObjectForUnit_6FC7A290_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  ppOutObject: number,
): number {
  hitD2GameVa113c(0x6FC7A290)
  const game = pGame >>> 0
  const pQuest = findQuestNodeInChain113c(m, game, 0x20)
  if (pQuest === 0) {
    return 0
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const nGroupIdx = ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, pUnit >>> 0, pQuest) | 0
  if (nGroupIdx < 0) {
    return 0
  }
  if (m.u8((pQuestDataEx + 0xf8 + nGroupIdx) >>> 0) === 0) {
    return 0
  }
  const dwObjGuid = m.u32((pQuestDataEx + 0xec + nGroupIdx * 4) >>> 0) >>> 0
  let pObj = m.u32((game + 0x1520 + ((dwObjGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pObj !== 0) {
    if ((m.u32((pObj + 0x0c) >>> 0) >>> 0) === dwObjGuid) {
      m.setU32(ppOutObject >>> 0, pObj)
      return 1
    }
    pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Clones preset save-header chain `pSaveChain` (`edx`) into Act 5 Quest 1 (`0x1F`) state `+0x00`
 * for preset object `0x21F` (`eax = pGame`, `edx = pSaveChain`), and transfers ownership to the
 * tracked monster's `pAiGeneral + 0x38` when `+0x15 != 0` and `+0x17 == 0`.
 *
 * @va D2Game:0x6FC7A5C0
 */
export function ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSaveChain: number,
): void {
  hitD2GameVa113c(0x6FC7A5C0)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x1f)
  if (pQuest === 0 || (pSaveChain >>> 0) === 0) {
    return
  }
  const pQuestGame0 = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const pMemPool = pQuestGame0 !== 0 ? (m.u32((pQuestGame0 + 0x1c) >>> 0) >>> 0) : 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const pCloned = DRLGPRESET_CloneSaveHeaderBlock113c(m, pMemPool, pSaveChain >>> 0) >>> 0
  const bSpawned = m.u8((pQuestDataEx + 0x15) >>> 0)
  m.setU32(pQuestDataEx, pCloned)
  if (bSpawned === 0) {
    return
  }
  const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const dwMonGuid = m.u32((pQuestDataEx + 0x10) >>> 0) >>> 0
  if (pQuestGame === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
  }
  let pMon = m.u32((pQuestGame + 0x1320 + ((dwMonGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pMon !== 0) {
    if ((m.u32((pMon + 0x0c) >>> 0) >>> 0) === dwMonGuid) {
      if (
        pCloned !== 0 &&
        (m.u32((pCloned + 0x04) >>> 0) >>> 0) !== 0 &&
        m.u8((pQuestDataEx + 0x17) >>> 0) === 0
      ) {
        const ppAiPath = AIGENERAL_GetQuestDataPtr38_113c(m, pMon) >>> 0
        DRLGPRESET_MovePointerAndClear113c(m, pQuestDataEx, ppAiPath)
        m.setU8((pQuestDataEx + 0x17) >>> 0, 1)
      }
      return
    }
    pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
  }
}

/**
 * Spawns up to `5` captive Barbarian soldier monsters (`0x216`) in `25` (`0x19`) attempts around
 * `pCoordInfo` (`[esp+8]`) for Act 5 Quest 2 (`pQuest` at `[esp+4]`, prison group `nGroupIdx` at
 * `[esp+0xC]`, `ret 0xC`), recording their GUIDs at `pQuestDataEx + 0xB0 + (nGroupIdx*5 + i)*4`
 * and attaching Quest `0x20` to each spawned unit.
 *
 * @va D2Game:0x6FC7C2A0
 */
export function ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pCoordInfo: number,
  nGroupIdx: number,
  hooks?: K2W3B5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC7C2A0)
  const quest = pQuest >>> 0
  const coord = pCoordInfo >>> 0
  const groupIdx = nGroupIdx | 0
  if (quest === 0 || m.u8((quest + 0x09) >>> 0) === 0) {
    return 0
  }

  const sp = k2W3B5StackPtr
  k2W3B5StackPtr = (sp + 0x30) >>> 0
  try {
    let nSpawned = 0
    for (let attempt = 0; attempt < 0x19; attempt++) {
      m.setU32(sp, m.u32((quest + 0x04) >>> 0))
      m.setU32((sp + 0x04) >>> 0, m.u32((coord + 0x08) >>> 0))
      m.setU32((sp + 0x08) >>> 0, 0)
      m.setU32((sp + 0x0c) >>> 0, 0x216)
      m.setU32((sp + 0x10) >>> 0, 1)
      m.setU32((sp + 0x14) >>> 0, 0)
      m.setU32((sp + 0x18) >>> 0, m.u32((coord + 0x14) >>> 0))
      m.setU32((sp + 0x1c) >>> 0, m.u32((coord + 0x18) >>> 0))
      m.setU32((sp + 0x20) >>> 0, 5)
      m.setU16((sp + 0x24) >>> 0, 0)

      const pMon =
        MONSTER_Create113c(m, sp, hooks !== undefined ? hooks.regpop : undefined) >>> 0
      if (pMon !== 0) {
        m.setU32((pMon + 0xc4) >>> 0, (m.u32((pMon + 0xc4) >>> 0) | 0x03000000) >>> 0)
        const dwMonGuid = m.u32((pMon + 0x0c) >>> 0) >>> 0
        const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
        const slotIdx = (nSpawned + Math.imul(groupIdx, 5)) | 0
        m.setU32((pQuestDataEx + 0xb0 + slotIdx * 4) >>> 0, dwMonGuid)
        const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
        nSpawned = (nSpawned + 1) | 0
        const pQuest20 = findQuestNodeInChain113c(m, pGame, 0x20)
        if (pQuest20 !== 0) {
          QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQuest20, pMon, pGame)
        }
        if (nSpawned >= 5) {
          break
        }
      }
    }
    return nSpawned
  } finally {
    k2W3B5StackPtr = sp
  }
}

/**
 * Spawns the Frozen Anya monster preset (`sgptDataTables->wFrozenAnyaPreset` at `+0xB58` adjusted
 * by `DATATBLS_AdjustMonsterPresetIndex113c(2, wPreset)`) in mode `1` when Act 5 Quest 3 (`0x21`)
 * has `dwField88 == 1` and `bFrozenAnyaSpawned (+0x92) == 0` (`ecx = pCoordInfo`).
 *
 * @va D2Game:0x6FC7CF70
 */
export function ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded_6FC7CF70_113c(
  m: D2KernMemory113c,
  pCoordInfo: number,
  hooks?: K2W3B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7CF70)
  const coord = pCoordInfo >>> 0
  const pGame0 = m.u32(coord) >>> 0
  const pQuest = findQuestNodeInChain113c(m, pGame0, 0x21)
  if (pQuest === 0) {
    return
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if ((m.u32((pQuestDataEx + 0x88) >>> 0) | 0) !== 1) {
    return
  }
  if (m.u8((pQuestDataEx + 0x92) >>> 0) !== 0) {
    return
  }
  const pIat = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pTables = pIat !== 0 ? (m.u32(pIat) >>> 0) : (m.u32(0x6fde9e1c) >>> 0)
  const wPreset = pTables !== 0 ? m.u16((pTables + 0xb58) >>> 0) : 0
  const nClassId = DATATBLS_AdjustMonsterPresetIndex113c(m, 2, wPreset) | 0
  const y = m.u32((coord + 0x18) >>> 0) | 0
  const x = m.u32((coord + 0x14) >>> 0) | 0
  const pGame = m.u32(coord) >>> 0
  const pRoom = m.u32((coord + 0x08) >>> 0) >>> 0
  const pMon =
    ROOM_SpawnMonsterPreset113c(
      m,
      pRoom,
      nClassId,
      pGame,
      x,
      y,
      1,
      (m2, cid, mode, pg2, pr2, px, py, maxR, wf) =>
        defaultSpawnMonsterAtCoordsW3B5_113c(m2, cid, mode, pg2, pr2, px, py, maxR, wf, hooks),
    ) >>> 0
  if (pMon !== 0) {
    m.setU32((pQuestDataEx + 0xa0) >>> 0, m.u32((pMon + 0x0c) >>> 0))
    m.setU8((pQuestDataEx + 0x92) >>> 0, 1)
  }
}

/**
 * Creates missile `0x21D` (`541`) from `pQuestArg->pTarget` (`[esp+8] + 0x08`) aimed at object
 * `dwObjectGuid` (`ebx`) in `pQuest->pGame` (`[esp+4] + 0x04`, `ret 0x8`), and stores `dwObjectGuid`
 * into the missile's target X via `MISSILE_SetTargetX113c`.
 *
 * @va D2Game:0x6FC7D960
 */
export function ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c(
  m: D2KernMemory113c,
  dwObjectGuid: number,
  pQuest: number,
  pQuestArg: number,
  hooks?: K2W3B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7D960)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const objGuid = dwObjectGuid >>> 0
  const pGame0 = m.u32((quest + 0x04) >>> 0) >>> 0
  if (pGame0 === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
  }
  let pObj = m.u32((pGame0 + 0x1520 + ((objGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pObj !== 0 && (m.u32((pObj + 0x0c) >>> 0) >>> 0) !== objGuid) {
    pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
  }
  if (pObj === 0) {
    return
  }

  const sp = k2W3B5StackPtr
  k2W3B5StackPtr = (sp + 0x60) >>> 0
  try {
    for (let i = 0; i < 0x17; i++) {
      m.setU32((sp + i * 4) >>> 0, 0)
    }
    const pOriginUnit = m.u32((arg + 0x08) >>> 0) >>> 0
    m.setU32(sp, 0x420)
    m.setU32((sp + 0x04) >>> 0, pOriginUnit)
    m.setU32((sp + 0x08) >>> 0, pOriginUnit)
    m.setU32((sp + 0x10) >>> 0, 0x21d)

    const dwType1 = m.u32(pObj) | 0
    const pPath1 = m.u32((pObj + 0x2c) >>> 0) >>> 0
    let targetX = 0
    if (dwType1 === 2 || (dwType1 > 3 && dwType1 <= 5)) {
      targetX = m.u32((pPath1 + 0x0c) >>> 0) | 0
    } else if (pPath1 !== 0) {
      targetX = PATH_GetPosX113c(m, pPath1) | 0
    }
    m.setU32((sp + 0x1c) >>> 0, targetX >>> 0)

    const dwType2 = m.u32(pObj) | 0
    const pPath2 = m.u32((pObj + 0x2c) >>> 0) >>> 0
    let targetY = 0
    if (dwType2 === 2 || (dwType2 > 3 && dwType2 <= 5)) {
      targetY = m.u32((pPath2 + 0x10) >>> 0) | 0
    } else if (pPath2 !== 0) {
      targetY = PATH_GetPosY113c(m, pPath2) | 0
    }
    m.setU32((sp + 0x20) >>> 0, targetY >>> 0)
    m.setU32((sp + 0x30) >>> 0, 1)

    const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
    const pMissile = MISSILE_CreateServerProjectile113c(m, pGame, sp, hooks) >>> 0
    if (pMissile !== 0) {
      MISSILE_SetTargetX113c(m, pMissile, objGuid | 0)
    }
  } finally {
    k2W3B5StackPtr = sp
  }
}

/**
 * Act 5 Quest 3 (`Prison of Ice`, `QUESTRECORD` `0x25`) `pfCallback[0]` (`ecx = pQuest`,
 * `edx = pQuestArg`): handles interaction with Frozen Anya (`0x20F` in state `6`), Malah (`0x201`
 * thaw potion / scroll of resistance checks), Larzuk/Malah reward dialog (`state 1`), or state
 * table `0x6FD2C468`.
 *
 * @va D2Game:0x6FC7DA70
 */
export function ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
  hooks?: K2W3B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7DA70)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, m.u32((arg + 0x0c) >>> 0)) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  const bBit0 =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0) | 0
  const bBit13 =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0x0d) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pTarget === 0 ? -1 : (m.u32((pTarget + 0x04) >>> 0) | 0)
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0

  if (nNpcClassId === 0x20f) {
    if (m.u8((quest + 0x0c) >>> 0) !== 6) {
      return
    }
    SKILLS_SetUsedSkillMemPort113c(m, pTarget, 0)
    invokeMonsterStartModeW3B5_113c(m, m.u32(arg) >>> 0, pTarget, 0x0c, 0, 0, 0, hooks)
    return
  }

  if (nNpcClassId === 0x201) {
    if (m.u8((quest + 0x0c) >>> 0) === 4) {
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      const pArgGame = m.u32(arg) >>> 0
      if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x20656369) !== 0) {
        return
      }
      if ((m.u32((pQuestDataEx + 0xd8) >>> 0) >>> 0) !== 0) {
        return
      }
      QUESTS_AddNpcDialogTextNodes113c(m, quest, 3, m.u32((arg + 0x14) >>> 0), 0x201)
      return
    }

    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0) !== 0 ||
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 0x0f) !== 0
    ) {
      if (
        m.u8((pQuestDataEx + 0x102) >>> 0) === 0 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 8) !== 0 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 7) === 0
      ) {
        const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
        const pArgGame = m.u32(arg) >>> 0
        if (
          ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pArgGame, 0x20327274) === 0 &&
          DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 8) === 0
        ) {
          QUESTS_AddNpcDialogTextNodes113c(m, quest, 5, m.u32((arg + 0x14) >>> 0), 0x201)
        }
      }
    }
  }

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((quest + 0xe0) >>> 0) | 0, 1) !== 0) {
    if (nNpcClassId === 0x200) {
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 9) !== 0) {
        return
      }
    } else if (nNpcClassId === 0x201) {
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 8) !== 0) {
        return
      }
    }
    QUESTS_AddNpcDialogTextNodes113c(m, quest, 5, m.u32((arg + 0x14) >>> 0), nNpcClassId)
    return
  }

  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const dwPlayerGuid = pPlayer === 0 ? 0xffffffff : (m.u32((pPlayer + 0x0c) >>> 0) >>> 0)
  if ((QUESTS_HasPlayerGuidInQuest113c(m, quest, dwPlayerGuid) | 0) === 1) {
    QUESTS_AddNpcDialogTextNodes113c(m, quest, 6, m.u32((arg + 0x14) >>> 0), nNpcClassId)
    return
  }

  if (bBit0 === 1) {
    return
  }
  const bState = m.u8((quest + 0x0c) >>> 0)
  if (bState >= 5 && bBit13 === 0) {
    return
  }
  if (m.u8((quest + 0x09) >>> 0) === 0) {
    return
  }
  const msgIdx = readQuestStateMsgTable113c(
    m,
    0x6fd2c468,
    ACT5Q3_STATE_MSG_TABLE_6FD2C468,
    bState,
  )
  if (msgIdx !== 0xffffffff && (msgIdx >>> 0) < 0x0a) {
    QUESTS_AddNpcDialogTextNodes113c(m, quest, msgIdx | 0, m.u32((arg + 0x14) >>> 0), nNpcClassId)
  }
}

/**
 * Transitions the Frozen Anya monster `pMonster` (`esi`) into dead/thawed mode (`0x0C`) for
 * Act 5 Quest 3 (`pQuest` at `[esp+4]`, `ret 0x4`): closes active NPC interactions, clears path
 * points, frees event type `2` nodes, sets `STAT_HITPOINTS` (`6`) to `0`, clears used skill,
 * starts mode `0x0C`, refreshes the unit in its room, and sets `dwFlags |= 1`.
 *
 * @va D2Game:0x6FC7DD00
 */
export function ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c(
  m: D2KernMemory113c,
  pMonster: number,
  pQuest: number,
  hooks?: K2W3B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7DD00)
  const mon = pMonster >>> 0
  const quest = pQuest >>> 0
  let pInteractHeadPtr = 0
  if (mon !== 0 && (m.u32(mon) >>> 0) === 1) {
    const pMonData = m.u32((mon + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pInteractHeadPtr = m.u32((pMonData + 0x30) >>> 0) >>> 0
    }
  }
  let pInteractNode = m.u32(pInteractHeadPtr) >>> 0
  while (pInteractNode !== 0) {
    if ((m.u32(pInteractNode) | 0) !== 0) {
      MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c(
        m,
        m.u32((quest + 0x04) >>> 0),
        mon,
        0,
      )
      break
    }
    pInteractNode = m.u32((pInteractNode + 0x08) >>> 0) >>> 0
  }

  PATH_ClearPathPointsAndFlag0x20_113c(m, m.u32((mon + 0x2c) >>> 0))
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  let pEvent = m.u32((mon + 0xdc) >>> 0) >>> 0
  while (pEvent !== 0) {
    const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
    if (m.u8(pEvent) === 2) {
      EVENT_FreeNode113c(m, pGame, pEvent)
    }
    pEvent = pNext
  }

  STATLIST_SetUnitStat113c(m, mon, 6, 0, 0)
  SKILLS_SetUsedSkillMemPort113c(m, mon, 0)
  invokeMonsterStartModeW3B5_113c(m, m.u32((quest + 0x04) >>> 0), mon, 0x0c, 0, 0, 0, hooks)
  UNITROOM_RefreshUnit113c(m, mon)
  m.setU32((mon + 0xc4) >>> 0, (m.u32((mon + 0xc4) >>> 0) | 1) >>> 0)
}

/**
 * Attempts to apply Malah's thaw potion to `pTargetUnit` (`edx`) in `pGame` (`ecx`,
 * `[esp+4] = _pPlayer`, `ret 0x4`): returns `0` unless `pTargetUnit->dwClassId == 0x20F` (`527`);
 * if an NPC interaction is active, closes interactions with callback `0x6FC79180` and returns `1`;
 * otherwise clears used skill, starts mode `0x0C`, sets Quest `0x21` `bThawed` (`+0xE3 = 1`), and returns `1`.
 *
 * @va D2Game:0x6FC7DDF0
 */
export function ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pTargetUnit: number,
  _pPlayer = 0,
  hooks?: K2W3B5Hooks113c,
): number {
  hitD2GameVa113c(0x6FC7DDF0)
  const game = pGame >>> 0
  const target = pTargetUnit >>> 0
  if (target === 0 || (m.u32((target + 0x04) >>> 0) | 0) !== 0x20f) {
    return 0
  }

  let pInteractHeadPtr = 0
  if ((m.u32(target) >>> 0) === 1) {
    const pMonData = m.u32((target + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pInteractHeadPtr = m.u32((pMonData + 0x30) >>> 0) >>> 0
    }
  }
  let pInteractNode = m.u32(pInteractHeadPtr) >>> 0
  while (pInteractNode !== 0) {
    if ((m.u32(pInteractNode) | 0) !== 0) {
      MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c(
        m,
        game,
        target,
        0x6fc79180,
        (m2, pPlr) => {
          ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c(m2, pPlr)
        },
      )
      return 1
    }
    pInteractNode = m.u32((pInteractNode + 0x08) >>> 0) >>> 0
  }

  SKILLS_SetUsedSkillMemPort113c(m, target, 0)
  invokeMonsterStartModeW3B5_113c(m, game, target, 0x0c, 0, 0, 0, hooks)
  const pQuest21 = findQuestNodeInChain113c(m, game, 0x21)
  if (pQuest21 !== 0) {
    const pQuestDataEx = m.u32((pQuest21 + 0x18) >>> 0) >>> 0
    m.setU8((pQuestDataEx + 0xe3) >>> 0, 1)
  }
  return 1
}
