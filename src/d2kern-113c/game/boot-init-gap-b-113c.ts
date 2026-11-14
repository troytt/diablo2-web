import { UNITS_GetPlayerData113c } from '../common/composit.js'
import { UNITS_GetMonStats2ComponentChoice113c } from '../common/drlg/out-jung.js'
import {
  INVENTORY_FreeAllNodes113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetFirstNode113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetLeftItemGuid113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_GetNextNode113c,
  INVENTORY_GetNodeItemGuid113c,
  INVENTORY_UnitIsItem113c,
  INVENTORY_UpdateWeaponGuidOnInsert113c,
  INVENTORY_UpdateWeaponGuidOnRemoval113c,
} from '../common/inventory.js'
import {
  ITEMS_CanUseCharmInInventory113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckItemFlag113c,
  ITEMS_CheckRequirements113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemTypeShootsFromItem113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items.js'
import {
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports.js'
import { MONSTERS_GetHirelingTypeId113c } from '../common/missile.js'
import {
  PATH_GetDirection113c,
  PATH_GetDistance113c,
  PATH_GetLastPointX113c,
  PATH_GetLastPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetStepNum113c,
  PATH_GetTargetUnit113c,
  PATH_GetType113c,
} from '../common/path.js'
import { UNITS_GetLeftSkill113c, UNITS_GetRightSkill113c } from '../common/quest-record.js'
import {
  SKILLS_AddSkillToUnit113c,
  SKILLS_AssignItemChargedSkillStdcall113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetItemSkillInfo113c,
  SKILLS_GetOwnerItemGuid113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillUseFailReason113c,
  SKILLS_SetLeftSkill113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../common/skills.js'
import {
  STATES_ApplyMonSkillIconToUnit113c,
  STATES_CheckState113c,
  STATES_ClearGfxStateFlag113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_CheckUnitStatListFlag100113c,
  STATLIST_CopyBaseStatsToBuffer113c,
  STATLIST_GetOwnerAndDynamicFlag113c,
  STATLIST_GetStatListFromUnitStateAndFlag113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.js'
import {
  UNITS_GetAnimOrSeqMode113c,
  UNITS_GetTransformGfx113c,
  UNITS_HasAnyGfxStateFlag113c,
  UNITS_SetUnitUpdateFlags113c,
} from '../common/unit.js'
import type { Memory113c } from '../mem/sparse-memory.ts'

export type D2Ptr = number

function i8(v: number): number {
  return (v << 24) >> 24
}

function i16(v: number): number {
  return (v << 16) >> 16
}

function i32(v: number): number {
  return v | 0
}
import { MONSTER_CheckTypeFlagsMask113c } from './ai-fallen-113c.js'
import {
  MONSTER_BroadcastEventSoundToClients113c,
  SUNITDMG_GetPlayerClientClassId113c,
} from './combat-a1c-113c.js'
import { SUNIT_GetServerUnit113c } from './game-strc.js'
import {
  SKILLS_GetRecordPtrFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.js'

export interface BootInitGapBCallees113c {
  sendPacketToClient?: (mem: Memory113c, pClient: D2Ptr, packet: Uint8Array) => void
  getMonsterDirection?: (mem: Memory113c, pUnit: D2Ptr) => number
  getMercRelationType?: (mem: Memory113c, pPlayer: D2Ptr, dwMonUnitId: number) => number
  clearItemHoverAndSocketState?: (mem: Memory113c, pItem: D2Ptr) => void
  onDeleteItemCallback?: (mem: Memory113c, pGame: D2Ptr, pPlayer: D2Ptr, pItem: D2Ptr) => void
  freeItemServerUnit?: (mem: Memory113c, pGame: D2Ptr, pItem: D2Ptr) => void
  getSpecialUnit?: (mem: Memory113c, pGame: D2Ptr, nIndex: number) => D2Ptr
  onUnitPreSync?: (mem: Memory113c, pGame: D2Ptr, pUnit: D2Ptr, pClient: D2Ptr) => void
  syncPlayerUnitToClient?: (
    mem: Memory113c,
    pUnit: D2Ptr,
    pGame: D2Ptr,
    pClient: D2Ptr,
    bPreSynced: number,
  ) => void
  syncObjectUnitToClient?: (mem: Memory113c, pUnit: D2Ptr, pClient: D2Ptr) => void
  syncItemUnitToClient?: (mem: Memory113c, pUnit: D2Ptr, pClient: D2Ptr) => void
  onApplyMercStatBonus?: (
    mem: Memory113c,
    pOwner: D2Ptr,
    nStatIndex: number,
    nArg: number,
  ) => void
  dispatchPlayerModeHandler?: (
    mem: Memory113c,
    nModeIndex: number,
    pGame: D2Ptr,
    pUnit: D2Ptr,
    pClient: D2Ptr,
  ) => void
  assignUnitSkill?: (
    mem: Memory113c,
    pUnit: D2Ptr,
    bLeft: number,
    nSkillId: number,
    dwOwnerGuid: number,
  ) => void
  applyCharmItemStats?: (mem: Memory113c, pUnit: D2Ptr, pItem: D2Ptr, pArg: D2Ptr) => void
  deactivateEquippedItemStats?: (
    mem: Memory113c,
    pUnit: D2Ptr,
    pItem: D2Ptr,
    pArg: D2Ptr,
    bFlag1: number,
    bFlag2: number,
  ) => void
  activateEquippedItemStats?: (mem: Memory113c, pUnit: D2Ptr, pItem: D2Ptr, bFlag: number) => void
  hasMonEventEntry?: (mem: Memory113c, pUnit: D2Ptr, nEventType: number, dwStatAndLayer: number) => number
  registerMonEventEntry?: (
    mem: Memory113c,
    pUnit: D2Ptr,
    nEventType: number,
    dwStatAndLayer: number,
    nFuncId: number,
    nParam: number,
    dwItemGuid: number,
  ) => void
  unregisterMonEventEntries?: (
    mem: Memory113c,
    pUnit: D2Ptr,
    nEventType: number,
    dwStatAndLayer: number,
    dwItemGuid: number,
  ) => void
  sendSkillListPacket?: (mem: Memory113c, pClient: D2Ptr, pUnit: D2Ptr) => void
  refreshPassiveSkillStats?: (
    mem: Memory113c,
    pUnit: D2Ptr,
    nSkillId: number,
    dwItemGuid: number,
  ) => void
  refreshAllUnitSkills?: (mem: Memory113c, pGame: D2Ptr, pUnit: D2Ptr) => void
  applyAuraStatChange?: (
    mem: Memory113c,
    pGame: D2Ptr,
    pUnit: D2Ptr,
    dwItemGuid: number,
    nSkillId: number,
    nNewValue: number,
  ) => void
  removeAuraStatChange?: (
    mem: Memory113c,
    pGame: D2Ptr,
    pUnit: D2Ptr,
    dwItemGuid: number,
  ) => void
  applyStateStatChange?: (
    mem: Memory113c,
    pGame: D2Ptr,
    pUnit: D2Ptr,
    nStateId: number,
    bRemove: number,
  ) => void
  checkMonsterTargetValid?: (mem: Memory113c, pTargetUnit: D2Ptr) => number
  syncMonsterSkillCast?: (
    mem: Memory113c,
    pUnit: D2Ptr,
    nFlag: number,
    pTargetUnit: D2Ptr,
    pClient: D2Ptr,
  ) => void
  onMonsterMovementPacket?: (
    mem: Memory113c,
    pClient: D2Ptr,
    nOpcode: number,
    dwUnitId: number,
    nAction: number,
    nX: number,
    nY: number,
    nExtra1: number,
    nExtra2: number,
    nExtra3: number,
  ) => void
  onClearUnitReassignFlags?: (mem: Memory113c, pUnit: D2Ptr, pGame: D2Ptr) => void
  onMonsterPostSync?: (mem: Memory113c, pUnit: D2Ptr, pClient: D2Ptr) => void
  onMonsterSyncFlag8?: (mem: Memory113c, pUnit: D2Ptr, pClient: D2Ptr) => void
  isMonsterOwnedByPlayer?: (mem: Memory113c, pMonster: D2Ptr, pPlayer: D2Ptr) => number
  sendPetSyncForMonster?: (
    mem: Memory113c,
    pGame: D2Ptr,
    pMonster: D2Ptr,
    pClient: D2Ptr,
    nType: number,
  ) => void
  findMercPetType?: (mem: Memory113c, pGame: D2Ptr, pPlayer: D2Ptr, pMonster: D2Ptr) => number
  onMonsterSyncGfxStates?: (mem: Memory113c, pUnit: D2Ptr, pClient: D2Ptr) => void
  onMonsterSyncStatFlag100?: (mem: Memory113c, pUnit: D2Ptr, pClient: D2Ptr) => void
  onMonsterSyncBossMods?: (mem: Memory113c, pUnit: D2Ptr, pClient: D2Ptr) => void
}

interface PlayerModeSyncEntry113c {
  readonly handlerKind: number
  readonly f4: number
  readonly f8: number
}

const PLAYER_MODE_SYNC_TABLE_113C: readonly PlayerModeSyncEntry113c[] = [
  { handlerKind: 1, f4: 0x08, f8: 0x08 },
  { handlerKind: 2, f4: 0x07, f8: 0x07 },
  { handlerKind: 3, f4: 0x01, f8: 0x00 },
  { handlerKind: 3, f4: 0x17, f8: 0x18 },
  { handlerKind: 4, f4: 0x06, f8: 0x06 },
  { handlerKind: 2, f4: 0x07, f8: 0x07 },
  { handlerKind: 3, f4: 0x01, f8: 0x00 },
  { handlerKind: 5, f4: 0x15, f8: 0x16 },
  { handlerKind: 5, f4: 0x15, f8: 0x16 },
  { handlerKind: 4, f4: 0x12, f8: 0x12 },
  { handlerKind: 5, f4: 0x15, f8: 0x16 },
  { handlerKind: 5, f4: 0x15, f8: 0x16 },
  { handlerKind: 5, f4: 0x15, f8: 0x16 },
  { handlerKind: 5, f4: 0x15, f8: 0x16 },
  { handlerKind: 5, f4: 0x15, f8: 0x16 },
  { handlerKind: 5, f4: 0x15, f8: 0x16 },
  { handlerKind: 5, f4: 0x15, f8: 0x16 },
  { handlerKind: 4, f4: 0x09, f8: 0x09 },
  { handlerKind: 5, f4: 0x15, f8: 0x16 },
  { handlerKind: 6, f4: 0x14, f8: 0x14 },
]

const MONSTER_MODE_SYNC_TABLE_113C: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  number,
])[] = [
  [0, 1, 0, 0, 8, 8],
  [0, 0, 0, 0, 7, 7],
  [1, 1, 1, 0, 1, 0],
  [0, 0, 0, 0, 6, 6],
  [1, 1, 0, 1, 11, 10],
  [1, 1, 0, 1, 17, 16],
  [1, 1, 0, 0, 18, 18],
  [1, 1, 0, 1, 4, 5],
  [1, 1, 0, 1, 12, 13],
  [1, 1, 0, 1, 14, 15],
  [1, 1, 0, 1, 26, 27],
  [1, 1, 0, 1, 28, 29],
  [0, 0, 0, 0, 9, 9],
  [0, 1, 1, 0, 20, 20],
  [1, 1, 0, 1, 12, 13],
  [1, 1, 1, 0, 23, 24],
]

const MONSTER_MODE_SWITCH_INDEX_113C: readonly number[] = [
  0, 5, 5, 1, 5, 5, 2, 5, 5, 5, 5, 5, 3, 4,
]

function enqueueClientPacket113c(
  mem: Memory113c,
  pClient: D2Ptr,
  packet: Uint8Array,
  callees?: BootInitGapBCallees113c,
): void {
  if (callees && callees.sendPacketToClient) {
    callees.sendPacketToClient(mem, pClient, packet)
    return
  }
  if (pClient === 0) {
    return
  }
  const len = packet.byteLength
  let pPacketData = mem.u32(pClient + 0x1bc) >>> 0
  let curLen = pPacketData !== 0 ? mem.u32(pPacketData) >>> 0 : 0
  if (pPacketData === 0 || curLen + len > 0x200) {
    const pFree = mem.u32(pClient + 0x1c0) >>> 0
    if (pFree !== 0) {
      const pNextFree = mem.u32(pFree + 0x204) >>> 0
      mem.setU32(pClient + 0x1c0, pNextFree)
      pPacketData = pFree
    } else {
      pPacketData = mem.alloc(0x208)
    }
    mem.setU32(pPacketData, 0)
    mem.setU32(pPacketData + 0x204, 0)
    const pTail = mem.u32(pClient + 0x1bc) >>> 0
    if (pTail !== 0) {
      mem.setU32(pTail + 0x204, pPacketData)
    } else {
      mem.setU32(pClient + 0x1b8, pPacketData)
    }
    mem.setU32(pClient + 0x1bc, pPacketData)
    curLen = 0
  }
  for (let i = 0; i < len; i += 1) {
    mem.setU8(pPacketData + 4 + curLen + i, packet[i]!)
  }
  mem.setU32(pPacketData, (curLen + len) >>> 0)
}

function getUnitXByType113c(mem: Memory113c, pUnit: D2Ptr): number {
  const unitType = mem.u32(pUnit) >>> 0
  const pPath = mem.u32(pUnit + 0x2c) >>> 0
  if (unitType === 2 || (unitType > 3 && unitType <= 5)) {
    return pPath !== 0 ? mem.u32(pPath + 0x0c) & 0xffff : 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(mem, pPath) & 0xffff : 0
}

function getUnitYByType113c(mem: Memory113c, pUnit: D2Ptr): number {
  const unitType = mem.u32(pUnit) >>> 0
  const pPath = mem.u32(pUnit + 0x2c) >>> 0
  if (unitType === 2 || (unitType > 3 && unitType <= 5)) {
    return pPath !== 0 ? mem.u32(pPath + 0x10) & 0xffff : 0
  }
  return pPath !== 0 ? PATH_GetPosY113c(mem, pPath) & 0xffff : 0
}

function getMonsterDirectionDefault113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  callees?: BootInitGapBCallees113c,
): number {
  if (callees && callees.getMonsterDirection) {
    return callees.getMonsterDirection(mem, pUnit) & 0xff
  }
  if (pUnit === 0) {
    return 0x80
  }
  const pPath = mem.u32(pUnit + 0x2c) >>> 0
  if (pPath === 0) {
    return 0
  }
  return PATH_GetDirection113c(mem, pPath) & 0xff
}

function getMonsterStatsTxtRecord113c(mem: Memory113c, pUnit: D2Ptr): D2Ptr {
  if (pUnit === 0 || (mem.u32(pUnit) >>> 0) !== 1) {
    return 0
  }
  const pMonData = mem.u32(pUnit + 0x14) >>> 0
  if (pMonData === 0) {
    return 0
  }
  return mem.u32(pMonData) >>> 0
}

function resolveClientPlayerUnit113c(mem: Memory113c, pClient: D2Ptr): D2Ptr {
  if ((mem.u8(pClient + 0x3d4) & 1) !== 0) {
    return mem.u32(pClient + 0x174) >>> 0
  }
  if ((mem.u32(pClient + 0x174) >>> 0) === 0) {
    return 0
  }
  const pGame = mem.u32(pClient + 0x1a8) >>> 0
  const unitType = mem.u32(pClient + 0x16c) >>> 0
  const unitId = mem.u32(pClient + 0x170) >>> 0
  const pUnit = SUNIT_GetServerUnit113c(mem, pGame, unitType, unitId)
  if (pUnit === 0) {
    mem.setU32(pClient + 0x174, 0)
  }
  return pUnit
}

function findPlayerRelationNode113c(mem: Memory113c, pOwnerUnit: D2Ptr, pTargetUnit: D2Ptr): D2Ptr {
  const pPlayerData = UNITS_GetPlayerData113c(mem, pOwnerUnit)
  const targetGuid = pTargetUnit !== 0 ? mem.u32(pTargetUnit + 0x0c) >>> 0 : 0xffffffff
  if (pOwnerUnit === pTargetUnit || pPlayerData === 0) {
    return 0
  }
  let pNode = mem.u32(pPlayerData + 0x38) >>> 0
  while (pNode !== 0) {
    if ((mem.u32(pNode) >>> 0) === targetGuid) {
      return pNode
    }
    pNode = mem.u32(pNode + 0x10) >>> 0
  }
  return 0
}

// @va D2Game:0x6FCABD00
export function D2GAME_PACKET_SendStatByteWordDword113c(
  mem: Memory113c,
  pClient: D2Ptr,
  nStatId: number,
  nValue: number,
  callees?: BootInitGapBCallees113c,
): void {
  const statLo = nStatId & 0xff
  const valU32 = nValue >>> 0
  if (valU32 < 0xff) {
    const pkt = new Uint8Array(3)
    pkt[0] = 0x1d
    pkt[1] = statLo
    pkt[2] = valU32 & 0xff
    enqueueClientPacket113c(mem, pClient, pkt, callees)
    return
  }
  if (valU32 < 0xffff) {
    const pkt = new Uint8Array(4)
    pkt[0] = 0x1e
    pkt[1] = statLo
    pkt[2] = valU32 & 0xff
    pkt[3] = (valU32 >>> 8) & 0xff
    enqueueClientPacket113c(mem, pClient, pkt, callees)
    return
  }
  const pkt = new Uint8Array(6)
  pkt[0] = 0x1f
  pkt[1] = statLo
  pkt[2] = valU32 & 0xff
  pkt[3] = (valU32 >>> 8) & 0xff
  pkt[4] = (valU32 >>> 16) & 0xff
  pkt[5] = (valU32 >>> 24) & 0xff
  enqueueClientPacket113c(mem, pClient, pkt, callees)
}

// @va D2Game:0x6FCABFC0
export function D2GAME_PACKET_SendUnitStop113c(
  mem: Memory113c,
  pClient: D2Ptr,
  dwUnitId: number,
  wX: number,
  wY: number,
  bLifePct: number,
  callees?: BootInitGapBCallees113c,
): void {
  const pkt = new Uint8Array(10)
  const uid = dwUnitId >>> 0
  pkt[0] = 0x6d
  pkt[1] = uid & 0xff
  pkt[2] = (uid >>> 8) & 0xff
  pkt[3] = (uid >>> 16) & 0xff
  pkt[4] = (uid >>> 24) & 0xff
  pkt[5] = wX & 0xff
  pkt[6] = (wX >>> 8) & 0xff
  pkt[7] = wY & 0xff
  pkt[8] = (wY >>> 8) & 0xff
  pkt[9] = bLifePct & 0xff
  enqueueClientPacket113c(mem, pClient, pkt, callees)
}

// @va D2Game:0x6FCAC570
export function D2GAME_PACKET_SendPlayerPartyRelationship113c(
  mem: Memory113c,
  pTargetUnit: D2Ptr,
  pDestUnit: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  const dwUnitId = pTargetUnit !== 0 ? mem.u32(pTargetUnit + 0x0c) >>> 0 : 0xffffffff
  let wPartyId = 0xffff
  if (pTargetUnit !== 0) {
    const pGame = mem.u32(pTargetUnit + 0x80) >>> 0
    if (pGame !== 0 && (mem.u32(pTargetUnit) >>> 0) === 0) {
      wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(mem, pTargetUnit, pGame) & 0xffff
    }
  }
  const pkt = new Uint8Array(7)
  pkt[0] = 0x8d
  pkt[1] = dwUnitId & 0xff
  pkt[2] = (dwUnitId >>> 8) & 0xff
  pkt[3] = (dwUnitId >>> 16) & 0xff
  pkt[4] = (dwUnitId >>> 24) & 0xff
  pkt[5] = wPartyId & 0xff
  pkt[6] = (wPartyId >>> 8) & 0xff

  let pClient = 0
  if (pDestUnit !== 0 && (mem.u32(pDestUnit) >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(mem, pDestUnit)
    if (pPlayerData !== 0) {
      pClient = mem.u32(pPlayerData + 0x9c) >>> 0
    }
  }
  enqueueClientPacket113c(mem, pClient, pkt, callees)
}

// @va D2Game:0x6FCACA20
export function D2GAME_PACKET_SendMonsterAssign113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  pClient: D2Ptr,
  sgptDataTablesPtr = 0,
  callees?: BootInitGapBCallees113c,
): void {
  if (pUnit === 0 || (mem.u32(pUnit) >>> 0) !== 1) {
    return
  }
  const pkt = new Uint8Array(257)
  const dwUnitId = mem.u32(pUnit + 0x0c) >>> 0
  const wClassId = mem.u32(pUnit + 0x04) & 0xffff
  const wPosX = getUnitXByType113c(mem, pUnit)
  const wPosY = getUnitYByType113c(mem, pUnit)
  const bDir = getMonsterDirectionDefault113c(mem, pUnit, callees)

  pkt[0] = 0xac
  pkt[1] = dwUnitId & 0xff
  pkt[2] = (dwUnitId >>> 8) & 0xff
  pkt[3] = (dwUnitId >>> 16) & 0xff
  pkt[4] = (dwUnitId >>> 24) & 0xff
  pkt[5] = wClassId & 0xff
  pkt[6] = (wClassId >>> 8) & 0xff
  pkt[7] = wPosX & 0xff
  pkt[8] = (wPosX >>> 8) & 0xff
  pkt[9] = wPosY & 0xff
  pkt[10] = (wPosY >>> 8) & 0xff
  pkt[11] = bDir & 0xff

  let bitPos = 0
  const writeBits = (val: number, numBits: number): void => {
    const uval = val >>> 0
    for (let b = 0; b < numBits; b += 1) {
      const bit = (uval >>> b) & 1
      const byteIdx = 13 + (bitPos >>> 3)
      const bitIdx = bitPos & 7
      if (bit !== 0 && byteIdx < pkt.length) {
        pkt[byteIdx] = (pkt[byteIdx]! | (1 << bitIdx)) & 0xff
      }
      bitPos += 1
    }
  }

  const animMode = mem.u32(pUnit + 0x10) >>> 0
  const encodedMode =
    animMode === 8 || animMode === 9 || animMode === 12 || animMode === 0 ? animMode : 1
  writeBits(encodedMode, 4)

  const hasComp = D2GAME_MONSTER_HasComponentChoices113c(mem, pUnit)
  if (hasComp !== 0) {
    writeBits(1, 1)
    if ((mem.u32(pUnit) >>> 0) === 1) {
      const pMonData = mem.u32(pUnit + 0x14) >>> 0
      if (pMonData !== 0) {
        for (let comp = 0; comp < 16; comp += 1) {
          const compVal = mem.u8(pMonData + 4 + comp)
          const choiceCount = UNITS_GetMonStats2ComponentChoice113c(mem, pUnit, comp) | 0
          let bitWidth = 1
          if (choiceCount >= 3) {
            const dec = (choiceCount - 1) >>> 0
            bitWidth = dec === 0 ? 0 : 32 - Math.clz32(dec)
          }
          writeBits(compVal, bitWidth)
        }
      }
    }
  } else {
    writeBits(0, 1)
  }

  const pMonData = (mem.u32(pUnit) >>> 0) === 1 ? mem.u32(pUnit + 0x14) >>> 0 : 0
  const hasExtraInfo =
    (pMonData !== 0 && mem.u8(pMonData + 0x1c) !== 0) ||
    ((mem.u32(pUnit + 0xc4) >>> 9) & 1) !== 0

  if (!hasExtraInfo) {
    writeBits(0, 1)
  } else {
    writeBits(1, 1)
    const monFlags = pMonData !== 0 ? mem.u8(pMonData + 0x16) : 0
    writeBits((monFlags >>> 2) & 1, 1)
    writeBits((monFlags >>> 3) & 1, 1)
    writeBits((monFlags >>> 1) & 1, 1)
    writeBits((monFlags >>> 4) & 1, 1)
    writeBits((monFlags >>> 6) & 1, 1)
    if (pMonData !== 0 && (monFlags & 2) !== 0) {
      const wBossId = i16(mem.u16(pMonData + 0x26))
      writeBits(wBossId & 0xffff, 16)
    }
    if (pMonData !== 0) {
      for (let i = 0; i < 9; i += 1) {
        const modByte = mem.u8(pMonData + 0x1c + i)
        if (modByte === 0) {
          break
        }
        writeBits(modByte, 8)
      }
    }
    writeBits(0, 8)
    const wNameSeed = pMonData !== 0 ? mem.u16(pMonData + 0x14) : 0x1506
    writeBits(wNameSeed, 16)

    let wroteMercOwner = false
    if (pMonData !== 0) {
      const pAiGeneral = mem.u32(pMonData + 0x28) >>> 0
      if (pAiGeneral !== 0) {
        const pGame = mem.u32(pAiGeneral + 0x28) >>> 0
        if (pGame !== 0) {
          const ownerId = mem.u32(pAiGeneral + 0x2c) >>> 0
          const ownerType = mem.u32(pAiGeneral + 0x30) >>> 0
          const pOwner = SUNIT_GetServerUnit113c(mem, pGame, ownerType, ownerId)
          if (pOwner !== 0 && (mem.u32(pOwner) >>> 0) === 0) {
            const relType =
              callees && callees.getMercRelationType
                ? callees.getMercRelationType(mem, pOwner, dwUnitId)
                : 0
            if (relType === 7) {
              writeBits(1, 1)
              writeBits(mem.u32(pOwner + 0x0c) >>> 0, 32)
              wroteMercOwner = true
            }
          }
        }
      }
    }
    if (!wroteMercOwner) {
      writeBits(0, 1)
    }
  }

  if (
    ((mem.u32(pUnit + 0xc8) >>> 10) & 1) !== 0 &&
    (mem.u32(pUnit + 0x94) >>> 0) === 0
  ) {
    writeBits(1, 1)
    writeBits((mem.u32(pUnit + 0x98) & 0x8fffffff) >>> 0, 31)
  } else {
    writeBits(0, 1)
  }

  let wroteAnyStat = false
  const pStatList = STATLIST_GetStatListFromUnitStateAndFlag113c(mem, pUnit, 0, 0x40)
  if (pStatList !== 0) {
    const pStatBuf = mem.alloc(16 * 8)
    const nStats = STATLIST_CopyBaseStatsToBuffer113c(mem, pStatList, pStatBuf, 16) | 0
    if (nStats > 0 && sgptDataTablesPtr !== 0) {
      const pDataTables = mem.u32(sgptDataTablesPtr) >>> 0
      if (pDataTables !== 0) {
        const nItemStatCostCount = i32(mem.u32(pDataTables + 0xbd4))
        const pItemStatCostTxt = mem.u32(pDataTables + 0xbcc) >>> 0
        for (let i = 0; i < nStats; i += 1) {
          const wParam = mem.u16(pStatBuf + i * 8)
          const wStatId = i16(mem.u16(pStatBuf + i * 8 + 2))
          const dwStatVal = mem.u32(pStatBuf + i * 8 + 4) >>> 0
          if (wStatId >= 0 && wStatId < nItemStatCostCount && pItemStatCostTxt !== 0) {
            const pRecord = (pItemStatCostTxt + wStatId * 0x144) >>> 0
            const bFlags = mem.u8(pRecord + 4)
            const bSendBits = mem.u8(pRecord + 8)
            if ((bFlags & 1) !== 0 && bSendBits > 0) {
              if (!wroteAnyStat) {
                writeBits(1, 1)
                wroteAnyStat = true
              }
              writeBits(wStatId, 9)
              const bSendParamBits = mem.u8(pRecord + 9)
              if (bSendParamBits !== 0) {
                writeBits(wParam, bSendParamBits)
              }
              writeBits(dwStatVal, bSendBits)
            }
          }
        }
      }
      if (wroteAnyStat) {
        writeBits(0x1ff, 9)
      } else {
        writeBits(0, 1)
      }
    } else {
      writeBits(0, 1)
    }
  }
  writeBits(0, 1)

  const streamByteLen = (bitPos + 7) >>> 3
  const totalLen = (streamByteLen + 13) & 0xff
  pkt[12] = totalLen
  enqueueClientPacket113c(mem, pClient, pkt.subarray(0, totalLen), callees)
}

// @va D2Game:0x6FCAD670
export function D2GAME_PACKET_Send0x73MissileSync113c(
  mem: Memory113c,
  pClient: D2Ptr,
  bUnitType: number,
  dwUnitId: number,
  bPacketHeader: number,
  wPosX: number,
  wPosY: number,
  wTargetInfo: number,
  bParam1: number,
  bParam2: number,
  callees?: BootInitGapBCallees113c,
): void {
  if (pClient === 0) {
    return
  }
  const pGame = mem.u32(pClient + 0x1a8) >>> 0
  const pUnit = SUNIT_GetServerUnit113c(mem, pGame, bUnitType & 0xff, dwUnitId >>> 0)
  if (pUnit === 0) {
    return
  }
  const pkt = new Uint8Array(14)
  const uid = dwUnitId >>> 0
  pkt[0] = bPacketHeader & 0xff
  pkt[1] = bUnitType & 0xff
  pkt[2] = uid & 0xff
  pkt[3] = (uid >>> 8) & 0xff
  pkt[4] = (uid >>> 16) & 0xff
  pkt[5] = (uid >>> 24) & 0xff
  pkt[6] = wPosX & 0xff
  pkt[7] = (wPosX >>> 8) & 0xff
  pkt[8] = wPosY & 0xff
  pkt[9] = (wPosY >>> 8) & 0xff
  pkt[10] = bParam1 & 0xff
  pkt[11] = bParam2 & 0xff
  pkt[12] = (wTargetInfo >>> 8) & 0xff
  pkt[13] = 0
  enqueueClientPacket113c(mem, pClient, pkt, callees)
}

// @va D2Game:0x6FCAE170
export function D2GAME_PACKET_Send0x5BPlayerInGame113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  pSourceClient: D2Ptr,
  pDestClient: D2Ptr,
  sgptDataTablesPtr = 0,
  callees?: BootInitGapBCallees113c,
): void {
  const pPlayerData = UNITS_GetPlayerData113c(mem, pUnit)
  const pkt = new Uint8Array(290)
  pkt[0] = 0x5b
  const dwUnitId = pUnit !== 0 ? mem.u32(pUnit + 0x0c) >>> 0 : 0xffffffff
  pkt[3] = dwUnitId & 0xff
  pkt[4] = (dwUnitId >>> 8) & 0xff
  pkt[5] = (dwUnitId >>> 16) & 0xff
  pkt[6] = (dwUnitId >>> 24) & 0xff
  const bClassId = pUnit !== 0 ? mem.u32(pUnit + 0x04) & 0xff : 0xff
  pkt[7] = bClassId
  const wLevel = STATLIST_GetUnitStat113c(mem, pUnit, 12, 0) & 0xffff
  pkt[24] = wLevel & 0xff
  pkt[25] = (wLevel >>> 8) & 0xff

  let wPartyId = 0xffff
  if (pUnit !== 0) {
    const pGame = mem.u32(pUnit + 0x80) >>> 0
    if (pGame !== 0 && (mem.u32(pUnit) >>> 0) === 0) {
      wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(mem, pUnit, pGame) & 0xffff
    }
  }
  pkt[26] = wPartyId & 0xff
  pkt[27] = (wPartyId >>> 8) & 0xff

  if (pPlayerData !== 0) {
    for (let i = 0; i < 16; i += 1) {
      const ch = mem.u8(pPlayerData + i)
      pkt[8 + i] = ch
      if (ch === 0) {
        break
      }
    }
  }

  let extraLen = 0
  if (pSourceClient !== 0) {
    const wClientFlags = mem.u16(pSourceClient + 0x45e)
    pkt[32] = wClientFlags & 0xff
    pkt[33] = (wClientFlags >>> 8) & 0xff
    const dwTag = mem.u32(pSourceClient + 0x460) >>> 0
    pkt[34] = dwTag & 0xff
    pkt[35] = (dwTag >>> 8) & 0xff
    pkt[36] = (dwTag >>> 16) & 0xff
    pkt[37] = (dwTag >>> 24) & 0xff
    let tagLen = 0
    while (tagLen < 4 && pkt[34 + tagLen] !== 0) {
      tagLen += 1
    }
    const secondStart = 34 + tagLen + 1
    let secondLen = 0
    while (secondStart + secondLen < pkt.length - 1) {
      const b = mem.u8(pSourceClient + 0x464 + secondLen)
      pkt[secondStart + secondLen] = b
      if (b === 0) {
        break
      }
      secondLen += 1
    }
    extraLen = tagLen + 1 + secondLen
  } else {
    extraLen = 1
  }

  const totalLen = (35 + extraLen) & 0xffff
  pkt[1] = totalLen & 0xff
  pkt[2] = (totalLen >>> 8) & 0xff
  enqueueClientPacket113c(mem, pDestClient, pkt.subarray(0, totalLen), callees)

  if (pUnit !== 0 && (mem.u32(pUnit) >>> 0) === 0) {
    D2GAME_SUMMON_BroadcastPlayerPetsToClient113c(
      mem,
      pUnit,
      pDestClient,
      sgptDataTablesPtr,
      callees,
    )
  }
}

// @va D2Game:0x6FCAF5C0
export function D2GAME_ARENA_FindPlayerSlotByUnit113c(
  mem: Memory113c,
  pOutIndex: D2Ptr,
  pGame: D2Ptr,
  pUnit: D2Ptr,
): D2Ptr {
  const pArena = mem.u32(pGame + 0x1d24) >>> 0
  const pTable = mem.u32(pArena + 4) >>> 0
  mem.setU32(pOutIndex, 0)
  for (let idx = 0; idx < 0x40; idx += 1) {
    mem.setU32(pOutIndex, idx)
    const pSlot = (pTable + idx * 0x44) >>> 0
    if ((mem.u32(pSlot) >>> 0) === (pUnit >>> 0)) {
      return pSlot
    }
  }
  mem.setU32(pOutIndex, 0x40)
  return 0
}

// @va D2Game:0x6FCB6920
export function D2GAME_SUMMON_BroadcastPlayerPetsToClient113c(
  mem: Memory113c,
  pPlayerUnit: D2Ptr,
  pDestClient: D2Ptr,
  sgptDataTablesPtr = 0,
  callees?: BootInitGapBCallees113c,
): void {
  const pPlayerData = UNITS_GetPlayerData113c(mem, pPlayerUnit)
  if (pPlayerUnit === 0 || pPlayerData === 0) {
    return
  }
  const pGame = mem.u32(pPlayerUnit + 0x80) >>> 0
  const dwPlayerGuid = mem.u32(pPlayerUnit + 0x0c) >>> 0
  if (pGame === 0) {
    return
  }
  const pPlayerPets = mem.u32(pPlayerData + 0x44) >>> 0
  if (pPlayerPets === 0 || sgptDataTablesPtr === 0) {
    return
  }
  const pDataTables = mem.u32(sgptDataTablesPtr) >>> 0
  if (pDataTables === 0) {
    return
  }
  const nPetTypesCount = i32(mem.u32(pDataTables + 0xbf0))
  for (let petType = 0; petType < nPetTypesCount; petType += 1) {
    const pPetArray = mem.u32(pPlayerPets) >>> 0
    if (pPetArray === 0) {
      continue
    }
    const pPetHeadPtr = (pPetArray + petType * 12) >>> 0
    let pPetNode = mem.u32(pPetHeadPtr) >>> 0
    while (pPetNode !== 0) {
      if ((mem.u8(pPetNode) & 1) === 0) {
        const dwPetGuid = mem.u32(pPetNode + 4) >>> 0
        const bucketIdx = dwPetGuid & 0x7f
        let pMonUnit = mem.u32(pGame + 0x1320 + bucketIdx * 4) >>> 0
        while (pMonUnit !== 0) {
          if ((mem.u32(pMonUnit + 0x0c) >>> 0) === dwPetGuid) {
            break
          }
          pMonUnit = mem.u32(pMonUnit + 0xe4) >>> 0
        }
        if (pMonUnit !== 0) {
          const wMonClassId = mem.u32(pMonUnit + 4) & 0xffff
          if (petType !== 7) {
            const pkt = new Uint8Array(13)
            pkt[0] = 0x7a
            pkt[1] = 1
            pkt[2] = petType & 0xff
            pkt[3] = wMonClassId & 0xff
            pkt[4] = (wMonClassId >>> 8) & 0xff
            pkt[5] = dwPetGuid & 0xff
            pkt[6] = (dwPetGuid >>> 8) & 0xff
            pkt[7] = (dwPetGuid >>> 16) & 0xff
            pkt[8] = (dwPetGuid >>> 24) & 0xff
            pkt[9] = dwPlayerGuid & 0xff
            pkt[10] = (dwPlayerGuid >>> 8) & 0xff
            pkt[11] = (dwPlayerGuid >>> 16) & 0xff
            pkt[12] = (dwPlayerGuid >>> 24) & 0xff
            enqueueClientPacket113c(mem, pDestClient, pkt, callees)
          } else {
            const dwSeed = mem.u32(pPetNode + 0x0c) >>> 0
            const wName = mem.u16(pPetNode + 8)
            const pkt = new Uint8Array(20)
            pkt[0] = 0x81
            pkt[1] = 7
            pkt[2] = wMonClassId & 0xff
            pkt[3] = (wMonClassId >>> 8) & 0xff
            pkt[4] = dwPlayerGuid & 0xff
            pkt[5] = (dwPlayerGuid >>> 8) & 0xff
            pkt[6] = (dwPlayerGuid >>> 16) & 0xff
            pkt[7] = (dwPlayerGuid >>> 24) & 0xff
            pkt[8] = dwPetGuid & 0xff
            pkt[9] = (dwPetGuid >>> 8) & 0xff
            pkt[10] = (dwPetGuid >>> 16) & 0xff
            pkt[11] = (dwPetGuid >>> 24) & 0xff
            pkt[12] = wName & 0xff
            pkt[13] = (wName >>> 8) & 0xff
            pkt[16] = dwSeed & 0xff
            pkt[17] = (dwSeed >>> 8) & 0xff
            pkt[18] = (dwSeed >>> 16) & 0xff
            pkt[19] = (dwSeed >>> 24) & 0xff
            enqueueClientPacket113c(mem, pDestClient, pkt, callees)
          }
        }
      }
      pPetNode = mem.u32(pPetNode + 0x14) >>> 0
    }
  }
}

// @va D2Game:0x6FCBB3B0
export function D2GAME_INVENTORY_DestroyUnitInventoryItems113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  pGame: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  const pInventory = mem.u32(pUnit + 0x60) >>> 0
  if (pInventory === 0) {
    return
  }
  UNITS_SetUnitUpdateFlags113c(mem, pUnit, 0)
  let pNode = INVENTORY_GetFirstNode113c(mem, pInventory)
  while (pNode !== 0) {
    const itemGuid = INVENTORY_GetNodeItemGuid113c(mem, pNode) >>> 0
    if (pGame === 0) {
      return
    }
    const bucketIdx = itemGuid & 0x7f
    let pItem = mem.u32(pGame + 0x1720 + bucketIdx * 4) >>> 0
    while (pItem !== 0) {
      if ((mem.u32(pItem + 0x0c) >>> 0) === itemGuid) {
        break
      }
      pItem = mem.u32(pItem + 0xe4) >>> 0
    }
    if (pItem !== 0) {
      if (
        ITEMS_CheckItemFlag113c(mem, pItem, 0x10) !== 0 ||
        ITEMS_CheckItemFlag113c(mem, pItem, 0x4000) !== 0
      ) {
        ITEMS_SetBodyLocation113c(mem, pItem, 0)
      }
      if (
        ITEMS_CheckItemFlag113c(mem, pItem, 0x20) !== 0 &&
        ITEMS_CheckCommandFlags113c(mem, pItem, 0x80) !== 0
      ) {
        ITEMS_SetBodyLocation113c(mem, pItem, 0)
      }
      if (callees && callees.clearItemHoverAndSocketState) {
        callees.clearItemHoverAndSocketState(mem, pItem)
      }
      if ((mem.u32(pItem + 0xc8) & 1) !== 0) {
        UNITS_SetUnitUpdateFlags113c(mem, pItem, 0)
        const pItemInv = mem.u32(pItem + 0x60) >>> 0
        if (pItemInv !== 0) {
          let pChildNode = INVENTORY_GetFirstNode113c(mem, pItemInv)
          while (pChildNode !== 0) {
            const childGuid = INVENTORY_GetNodeItemGuid113c(mem, pChildNode) >>> 0
            let pChildItem = mem.u32(pGame + 0x1720 + (childGuid & 0x7f) * 4) >>> 0
            while (pChildItem !== 0) {
              if ((mem.u32(pChildItem + 0x0c) >>> 0) === childGuid) {
                if (callees && callees.clearItemHoverAndSocketState) {
                  callees.clearItemHoverAndSocketState(mem, pChildItem)
                }
                break
              }
              pChildItem = mem.u32(pChildItem + 0xe4) >>> 0
            }
            pChildNode = INVENTORY_GetNextNode113c(mem, pChildNode)
          }
          INVENTORY_FreeAllNodes113c(mem, pItemInv)
        }
      }
      if (ITEMS_CheckItemFlag113c(mem, pItem, 1) !== 0) {
        if (callees && callees.onDeleteItemCallback) {
          D2GAME_SUNIT_IterateAllLivingPlayers113c(mem, pGame, callees.onDeleteItemCallback, pItem)
        }
        if (callees && callees.freeItemServerUnit) {
          callees.freeItemServerUnit(mem, pGame, pItem)
        }
      }
    }
    pNode = INVENTORY_GetNextNode113c(mem, pNode)
  }
  INVENTORY_FreeAllNodes113c(mem, pInventory)
}

// @va D2Game:0x6FCBBEB0
export function D2GAME_PARTY_GetPartyIdForUnit113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  pGame: D2Ptr,
): number {
  const dwUnitId = pUnit !== 0 ? mem.u32(pUnit + 0x0c) >>> 0 : 0xffffffff
  const pInventory = pUnit !== 0 ? mem.u32(pUnit + 0x60) >>> 0 : 0
  if (pInventory !== 0) {
    INVENTORY_GetLeftItemGuid113c(mem, pInventory)
  }
  if (pUnit === 0 || (mem.u32(pUnit) >>> 0) !== 0 || pGame === 0) {
    return 0xffff
  }
  const pPartyCtrl = mem.u32(pGame + 0x1d2c) >>> 0
  if (pPartyCtrl === 0) {
    return 0xffff
  }
  let pParty = mem.u32(pPartyCtrl + 4) >>> 0
  while (pParty !== 0) {
    let pMember = mem.u32(pParty + 4) >>> 0
    while (pMember !== 0) {
      if ((mem.u32(pMember) >>> 0) === dwUnitId) {
        return mem.u16(pParty)
      }
      pMember = mem.u32(pMember + 4) >>> 0
    }
    pParty = mem.u32(pParty + 8) >>> 0
  }
  return 0xffff
}

// @va D2Game:0x6FCBDCD0
export function D2GAME_SUNIT_SyncUnitStateToClient113c(
  mem: Memory113c,
  pClient: D2Ptr,
  pGame: D2Ptr,
  pUnit: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  if (pUnit === 0) {
    return
  }
  const unitType = mem.u32(pUnit) >>> 0
  const hasFlag10 = ((mem.u32(pUnit + 0xc4) >>> 4) & 1) !== 0
  let bPreSynced = 0
  if (hasFlag10) {
    const pSpecial =
      callees && callees.getSpecialUnit ? callees.getSpecialUnit(mem, pGame, 0) : 0
    if (pSpecial !== pUnit) {
      if (unitType === 3) {
        return
      }
      if (callees && callees.onUnitPreSync) {
        callees.onUnitPreSync(mem, pGame, pUnit, pClient)
      }
      bPreSynced = 1
    }
  }
  if (unitType > 4) {
    return
  }
  switch (unitType) {
    case 0:
      if (callees && callees.syncPlayerUnitToClient) {
        callees.syncPlayerUnitToClient(mem, pUnit, pGame, pClient, bPreSynced)
      }
      return
    case 1:
      D2GAME_MONSTER_SyncMonsterUnitToClient113c(
        mem,
        pGame,
        pUnit,
        pClient,
        bPreSynced,
        callees,
      )
      return
    case 2:
      if (callees && callees.syncObjectUnitToClient) {
        callees.syncObjectUnitToClient(mem, pUnit, pClient)
      }
      return
    case 3:
      return
    case 4:
      if (callees && callees.syncItemUnitToClient) {
        callees.syncItemUnitToClient(mem, pUnit, pClient)
      }
      return
  }
}

// @va D2Game:0x6FCBDE10
export function D2GAME_SUNIT_SyncRoomUnitsToClient113c(
  mem: Memory113c,
  pRoom: D2Ptr,
  pClient: D2Ptr,
  pGame: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  if (pRoom === 0) {
    return
  }
  let pUnit = mem.u32(pRoom + 0x1c) >>> 0
  while (pUnit !== 0) {
    const pNext = mem.u32(pUnit + 0xe0) >>> 0
    D2GAME_SUNIT_SyncUnitStateToClient113c(mem, pClient, pGame, pUnit, callees)
    pUnit = pNext
  }
}

// @va D2Game:0x6FCBF2B0
export function D2GAME_MONSTER_ApplyMercStatsOnOwner113c(
  mem: Memory113c,
  pMonsterUnit: D2Ptr,
  nArg: number,
  sgptDataTablesPtr: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  if (pMonsterUnit === 0 || (mem.u32(pMonsterUnit) >>> 0) !== 1) {
    return
  }
  const pMonData = mem.u32(pMonsterUnit + 0x14) >>> 0
  if (pMonData === 0) {
    return
  }
  const pAiGeneral = mem.u32(pMonData + 0x28) >>> 0
  if (pAiGeneral === 0) {
    return
  }
  const pGame = mem.u32(pAiGeneral + 0x28) >>> 0
  if (pGame === 0) {
    return
  }
  const ownerId = mem.u32(pAiGeneral + 0x2c) >>> 0
  const ownerType = mem.u32(pAiGeneral + 0x30) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(mem, pGame, ownerType, ownerId)
  if (pOwner === 0 || sgptDataTablesPtr === 0) {
    return
  }
  const monClassId = i32(mem.u32(pMonsterUnit + 4))
  if (monClassId < 0) {
    return
  }
  const pDataTables = mem.u32(sgptDataTablesPtr) >>> 0
  if (pDataTables === 0) {
    return
  }
  const nMonStatsCount = i32(mem.u32(pDataTables + 0xa80))
  if (monClassId >= nMonStatsCount) {
    return
  }
  const pMonStatsTxt = mem.u32(pDataTables + 0xa78) >>> 0
  if (pMonStatsTxt === 0) {
    return
  }
  const pRecord = (pMonStatsTxt + monClassId * 0x1a8) >>> 0
  const wStatIndex = i16(mem.u16(pRecord + 0xa8))
  if (wStatIndex <= 0) {
    return
  }
  const nMaxStatIndex = i32(mem.u32(pDataTables + 0xba0))
  if (wStatIndex > nMaxStatIndex) {
    return
  }
  if (callees && callees.onApplyMercStatBonus) {
    callees.onApplyMercStatBonus(mem, pOwner, wStatIndex, nArg)
  }
}

// @va D2Game:0x6FCCF610
export function D2GAME_MONSTER_HasComponentChoices113c(mem: Memory113c, pUnit: D2Ptr): number {
  let pComp = 0
  if (pUnit !== 0 && (mem.u32(pUnit) >>> 0) === 1) {
    const pMonData = mem.u32(pUnit + 0x14) >>> 0
    if (pMonData !== 0) {
      pComp = (pMonData + 4) >>> 0
    }
  }
  if (pComp === 0) {
    return 0
  }
  for (let i = 0; i < 16; i += 1) {
    if (mem.u8(pComp + i) !== 0) {
      return 1
    }
  }
  return 0
}

// @va D2Game:0x6FCD2760
export function D2GAME_PACKET_Send0x65PlayerKillCount113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  pClient: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  const pPlayerData = UNITS_GetPlayerData113c(mem, pUnit)
  if (pPlayerData === 0) {
    return
  }
  const pArenaUnit = mem.u32(pPlayerData + 0x34) >>> 0
  if (pArenaUnit === 0) {
    return
  }
  const dwUnitId = pUnit !== 0 ? mem.u32(pUnit + 0x0c) >>> 0 : 0xffffffff
  const wKills = mem.u16(pArenaUnit)
  const pkt = new Uint8Array(7)
  pkt[0] = 0x65
  pkt[1] = dwUnitId & 0xff
  pkt[2] = (dwUnitId >>> 8) & 0xff
  pkt[3] = (dwUnitId >>> 16) & 0xff
  pkt[4] = (dwUnitId >>> 24) & 0xff
  pkt[5] = wKills & 0xff
  pkt[6] = (wKills >>> 8) & 0xff
  enqueueClientPacket113c(mem, pClient, pkt, callees)
}

// @va D2Game:0x6FCD27D0
export function D2GAME_ARENA_ClearPlayerArenaFlags113c(mem: Memory113c, pUnit: D2Ptr): void {
  if (pUnit === 0 || (mem.u32(pUnit) >>> 0) !== 0) {
    return
  }
  const pPlayerData = UNITS_GetPlayerData113c(mem, pUnit)
  if (pPlayerData === 0) {
    return
  }
  const pArenaUnit = mem.u32(pPlayerData + 0x34) >>> 0
  if (pArenaUnit === 0) {
    return
  }
  mem.setU32(pArenaUnit + 4, 0)
}

// @va D2Game:0x6FCD2C20
export function D2GAME_ARENA_BroadcastKillCountsToClients113c(
  mem: Memory113c,
  pGame: D2Ptr,
  pClient: D2Ptr,
  bForceAll: number,
  callees?: BootInitGapBCallees113c,
): void {
  if (pClient === 0 || pGame === 0) {
    return
  }
  const pTargetPlayer = resolveClientPlayerUnit113c(mem, pClient)
  let pCurClient = mem.u32(pGame + 0x88) >>> 0
  while (pCurClient !== 0) {
    const pCurPlayer = resolveClientPlayerUnit113c(mem, pCurClient)
    if ((mem.u32(pCurClient + 4) >>> 0) === 4 && pCurPlayer !== 0) {
      let shouldSend = false
      if (bForceAll !== 0) {
        shouldSend = true
      } else if (pCurPlayer !== pTargetPlayer) {
        const pPlayerData = UNITS_GetPlayerData113c(mem, pCurPlayer)
        const pArenaUnit = pPlayerData !== 0 ? mem.u32(pPlayerData + 0x34) >>> 0 : 0
        if (pArenaUnit !== 0 && (mem.u32(pArenaUnit + 4) >>> 0) !== 0) {
          shouldSend = true
        }
      }
      if (shouldSend) {
        D2GAME_PACKET_Send0x65PlayerKillCount113c(mem, pCurPlayer, pClient, callees)
      }
    }
    pCurClient = mem.u32(pCurClient + 0x4a8) >>> 0
  }
}

// @va D2Game:0x6FCD2D40
export function D2GAME_ARENA_SyncClientKillCountsOnJoin113c(
  mem: Memory113c,
  pGame: D2Ptr,
  pClient: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  D2GAME_ARENA_BroadcastKillCountsToClients113c(mem, pGame, pClient, 1, callees)
  if (pClient === 0) {
    return
  }
  const dwClientState = mem.u32(pClient + 4) >>> 0
  const pPlayer = mem.u32(pClient + 0x174) >>> 0
  if (dwClientState !== 4 && pPlayer !== 0) {
    D2GAME_PACKET_Send0x65PlayerKillCount113c(mem, pPlayer, pClient, callees)
  }
}

// @va D2Game:0x6FCD2D90
export function D2GAME_ARENA_SyncArenaJoinState113c(
  mem: Memory113c,
  pGame: D2Ptr,
  pClient: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  if (pGame === 0) {
    return
  }
  const pArenaCtrl = mem.u32(pGame + 0x1d28) >>> 0
  if (pArenaCtrl === 0) {
    return
  }
  if ((mem.u32(pArenaCtrl + 8) & 0x400) === 0) {
    return
  }
  const pSpecialUnit =
    callees && callees.getSpecialUnit ? callees.getSpecialUnit(mem, pGame, 0) : 0
  if (pSpecialUnit !== 0) {
    const pPlayerData = UNITS_GetPlayerData113c(mem, pSpecialUnit)
    const pArenaUnit = pPlayerData !== 0 ? mem.u32(pPlayerData + 0x34) >>> 0 : 0
    if (pArenaUnit !== 0 && (mem.u32(pArenaUnit + 4) >>> 0) !== 0) {
      D2GAME_PACKET_Send0x65PlayerKillCount113c(mem, pSpecialUnit, pClient, callees)
    }
  }
  if (pClient === 0) {
    return
  }
  if ((mem.u8(pClient + 0x3d4) & 4) !== 0) {
    D2GAME_ARENA_BroadcastKillCountsToClients113c(mem, pGame, pClient, 0, callees)
  }
}

// @va D2Game:0x6FCEB570
export function D2GAME_PLRMODES_SendClientWhisperAdapter113c(
  mem: Memory113c,
  pClient: D2Ptr,
  pTargetClient: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  if (pTargetClient === 0) {
    return
  }
  let nameLen = 0
  while (nameLen < 16 && mem.u8(pTargetClient + 8 + nameLen) !== 0) {
    nameLen += 1
  }
  if (nameLen >= 16) {
    return
  }
  const pkt = new Uint8Array(40)
  pkt[0] = 0x5a
  pkt[1] = 2
  pkt[2] = 4
  for (let i = 0; i < 16; i += 1) {
    const ch = mem.u8(pTargetClient + 8 + i)
    pkt[8 + i] = ch
    if (ch === 0) {
      break
    }
  }
  for (let i = 0; i < 16; i += 1) {
    const ch = mem.u8(pTargetClient + 0x18 + i)
    pkt[24 + i] = ch
    if (ch === 0) {
      break
    }
  }
  enqueueClientPacket113c(mem, pClient, pkt, callees)
}

// @va D2Game:0x6FCEB8F0
export function D2GAME_PLRMODES_DispatchModeSyncToClient113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  pGame: D2Ptr,
  pClient: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  const modeIndex = pUnit !== 0 ? mem.u32(pUnit + 0x10) >>> 0 : 0
  if (modeIndex >= PLAYER_MODE_SYNC_TABLE_113C.length) {
    return
  }
  const entry = PLAYER_MODE_SYNC_TABLE_113C[modeIndex]!
  if (entry.handlerKind === 2) {
    D2GAME_PLRMODES_Send0x0DPlayerStop113c(mem, pUnit, pClient, modeIndex, callees)
    return
  }
  if (callees && callees.dispatchPlayerModeHandler) {
    callees.dispatchPlayerModeHandler(mem, modeIndex, pGame, pUnit, pClient)
  }
}

// @va D2Game:0x6FCEBDB0
export function D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c(
  mem: Memory113c,
  pClient: D2Ptr,
  pGame: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  let len = 0
  while (len < 16) {
    if (mem.u8(pClient + 8 + len) === 0) {
      break
    }
    if (mem.u8(pClient + 9 + len) === 0) {
      len += 1
      break
    }
    if (mem.u8(pClient + 10 + len) === 0) {
      len += 2
      break
    }
    if (mem.u8(pClient + 11 + len) === 0) {
      len += 3
      break
    }
    len += 4
  }
  if (len >= 16 || pGame === 0) {
    return
  }
  let pCurClient = mem.u32(pGame + 0x88) >>> 0
  while (pCurClient !== 0) {
    if ((mem.u32(pCurClient + 4) >>> 0) === 4) {
      D2GAME_PLRMODES_SendClientWhisperAdapter113c(mem, pCurClient, pClient, callees)
    }
    pCurClient = mem.u32(pCurClient + 0x4a8) >>> 0
  }
}

// @va D2Game:0x6FCEC2F0
export function D2GAME_PLRMODES_SendStatToClientOrParty113c(
  mem: Memory113c,
  pSourceUnit: D2Ptr,
  nStatId: number,
  pDestPlayerUnit: D2Ptr,
  nStatValue: number,
  callees?: BootInitGapBCallees113c,
): void {
  if (pDestPlayerUnit === 0 || (mem.u32(pDestPlayerUnit) >>> 0) !== 0) {
    return
  }
  const pPlayerData = UNITS_GetPlayerData113c(mem, pDestPlayerUnit)
  if (pPlayerData === 0) {
    return
  }
  const pClient = mem.u32(pPlayerData + 0x9c) >>> 0
  if (pClient === 0) {
    return
  }
  if (pSourceUnit === pDestPlayerUnit) {
    D2GAME_PACKET_SendStatByteWordDword113c(mem, pClient, nStatId, nStatValue, callees)
    return
  }
  const dwUnitId = pSourceUnit !== 0 ? mem.u32(pSourceUnit + 0x0c) >>> 0 : 0xffffffff
  const valU32 = nStatValue >>> 0
  const pkt = new Uint8Array(10)
  pkt[0] = 0x20
  pkt[1] = dwUnitId & 0xff
  pkt[2] = (dwUnitId >>> 8) & 0xff
  pkt[3] = (dwUnitId >>> 16) & 0xff
  pkt[4] = (dwUnitId >>> 24) & 0xff
  pkt[5] = nStatId & 0xff
  pkt[6] = valU32 & 0xff
  pkt[7] = (valU32 >>> 8) & 0xff
  pkt[8] = (valU32 >>> 16) & 0xff
  pkt[9] = (valU32 >>> 24) & 0xff
  enqueueClientPacket113c(mem, pClient, pkt, callees)
}

// @va D2Game:0x6FCED190
export function D2GAME_PLRMODES_Send0x0DPlayerStop113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  pClient: D2Ptr,
  nModeIndex: number,
  callees?: BootInitGapBCallees113c,
): void {
  if (pClient === 0 || pUnit === 0) {
    return
  }
  const pClientPlayer = resolveClientPlayerUnit113c(mem, pClient)
  if (pUnit === pClientPlayer) {
    return
  }
  const bLifePct = STATLIST_GetUnitLifePercent113c(mem, pUnit) & 0xff
  const bAction =
    nModeIndex >= 0 && nModeIndex < PLAYER_MODE_SYNC_TABLE_113C.length
      ? PLAYER_MODE_SYNC_TABLE_113C[nModeIndex]!.f4 & 0xff
      : 0x07
  const wPosY = getUnitYByType113c(mem, pUnit)
  const wPosX = getUnitXByType113c(mem, pUnit)
  const dwUnitId = mem.u32(pUnit + 0x0c) >>> 0

  const pkt = new Uint8Array(13)
  pkt[0] = 0x0d
  pkt[1] = 0x00
  pkt[2] = dwUnitId & 0xff
  pkt[3] = (dwUnitId >>> 8) & 0xff
  pkt[4] = (dwUnitId >>> 16) & 0xff
  pkt[5] = (dwUnitId >>> 24) & 0xff
  pkt[6] = bAction
  pkt[7] = wPosX & 0xff
  pkt[8] = (wPosX >>> 8) & 0xff
  pkt[9] = wPosY & 0xff
  pkt[10] = (wPosY >>> 8) & 0xff
  pkt[11] = 0x00
  pkt[12] = bLifePct
  enqueueClientPacket113c(mem, pClient, pkt, callees)
}

// @va D2Game:0x6FCF1830
export function D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  pItem: D2Ptr,
): number {
  const bReqMet = ITEMS_CheckRequirements113c(mem, pItem, pUnit, 0, 0, 0, 0)
  if (bReqMet === 0) {
    return 0
  }
  const nShootsType = ITEMS_GetItemTypeShootsFromItem113c(mem, pItem)
  if (nShootsType === 0) {
    return bReqMet
  }
  const pInventory = mem.u32(pUnit + 0x60) >>> 0
  let pOtherItem = INVENTORY_GetItemFromBodyLocMemPort113c(mem, pInventory, 4)
  if (pOtherItem === pItem) {
    pOtherItem = INVENTORY_GetItemFromBodyLocMemPort113c(mem, pInventory, 5)
  }
  if (pOtherItem === 0) {
    return 0
  }
  const nReqItemType = ITEMS_GetItemTypeShootsFromItem113c(mem, pItem)
  if (ITEMS_CheckItemTypeIdMemPort113c(mem, pOtherItem, nReqItemType) !== 0) {
    return bReqMet
  }
  return 0
}

// @va D2Game:0x6FCF1890
export function D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  pOutSnapshot: D2Ptr,
): void {
  mem.setU32(pOutSnapshot, STATLIST_GetUnitStat113c(mem, pUnit, 6, 0) >>> 0)
  mem.setU32(pOutSnapshot + 4, STATLIST_GetUnitStat113c(mem, pUnit, 8, 0) >>> 0)
  mem.setU32(pOutSnapshot + 8, STATLIST_GetUnitStat113c(mem, pUnit, 10, 0) >>> 0)

  const pLeftSkill = UNITS_GetLeftSkill113c(mem, pUnit)
  if (pLeftSkill !== 0) {
    mem.setU32(pOutSnapshot + 0x18, SKILLS_GetOwnerItemGuid113c(mem, pLeftSkill) >>> 0)
    mem.setU32(pOutSnapshot + 0x10, SKILLS_GetSkillIdFromSkill113c(mem, pLeftSkill) >>> 0)
  } else {
    mem.setU32(pOutSnapshot + 0x18, 0xffffffff)
    mem.setU32(pOutSnapshot + 0x10, 0)
  }

  const pRightSkill = UNITS_GetRightSkill113c(mem, pUnit)
  if (pRightSkill !== 0) {
    mem.setU32(pOutSnapshot + 0x14, SKILLS_GetOwnerItemGuid113c(mem, pRightSkill) >>> 0)
    mem.setU32(pOutSnapshot + 0x0c, SKILLS_GetSkillIdFromSkill113c(mem, pRightSkill) >>> 0)
  } else {
    mem.setU32(pOutSnapshot + 0x14, 0xffffffff)
    mem.setU32(pOutSnapshot + 0x0c, 0)
  }
}

// @va D2Game:0x6FCF1ED0
export function D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  pSnapshot: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  const nLeftSkillId = mem.u32(pSnapshot + 0x10) >>> 0
  if (nLeftSkillId !== 0) {
    const dwLeftOwnerGuid = mem.u32(pSnapshot + 0x18) >>> 0
    const pSkill = SKILLS_GetSkillById113c(mem, pUnit, nLeftSkillId, dwLeftOwnerGuid)
    if (pSkill !== 0 && pSkill !== UNITS_GetLeftSkill113c(mem, pUnit)) {
      const failReason = SKILLS_GetSkillUseFailReason113c(mem, pUnit, pSkill)
      if (failReason !== 2 && failReason !== 7 && callees && callees.assignUnitSkill) {
        callees.assignUnitSkill(mem, pUnit, 1, nLeftSkillId, dwLeftOwnerGuid)
      }
    }
  }
  const nRightSkillId = mem.u32(pSnapshot + 0x0c) >>> 0
  if (nRightSkillId !== 0) {
    const dwRightOwnerGuid = mem.u32(pSnapshot + 0x14) >>> 0
    const pSkill = SKILLS_GetSkillById113c(mem, pUnit, nRightSkillId, dwRightOwnerGuid)
    if (pSkill !== 0 && pSkill !== UNITS_GetRightSkill113c(mem, pUnit)) {
      const failReason = SKILLS_GetSkillUseFailReason113c(mem, pUnit, pSkill)
      if (failReason !== 2 && failReason !== 7 && callees && callees.assignUnitSkill) {
        callees.assignUnitSkill(mem, pUnit, 0, nRightSkillId, dwRightOwnerGuid)
      }
    }
  }
}

// @va D2Game:0x6FCF51A0
export function D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(
  mem: Memory113c,
  pGame: D2Ptr,
  pUnit: D2Ptr,
  bSendPacket: number,
  callees?: BootInitGapBCallees113c,
): void {
  if (pUnit === 0) {
    return
  }
  if ((mem.u32(pUnit) >>> 0) !== 0 && ((mem.u32(pUnit + 0xc4) >>> 9) & 1) === 0) {
    return
  }
  const pSnapshot = mem.alloc(0x1c)
  D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c(mem, pUnit, pSnapshot)
  const pInventory = mem.u32(pUnit + 0x60) >>> 0
  if (pInventory === 0) {
    return
  }
  let pItemNode = INVENTORY_GetFirstItem113c(mem, pInventory)
  while (pItemNode !== 0) {
    const pItem = INVENTORY_UnitIsItem113c(mem, pItemNode)
    if (
      pItem !== 0 &&
      INVENTORY_GetItemNodePositionOther113c(mem, pItemNode) === 1 &&
      ITEMS_CanUseCharmInInventory113c(mem, pItem, pUnit) !== 0 &&
      STATLIST_GetOwnerAndDynamicFlag113c(mem, pItem, 0) === 0 &&
      D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c(mem, pUnit, pItem) !== 0
    ) {
      ITEMS_SetOrClearCommandFlags113c(mem, pItem, 0x4000, 0)
      if (callees && callees.applyCharmItemStats) {
        callees.applyCharmItemStats(mem, pUnit, pItem, pGame)
      }
    }
    pItemNode = INVENTORY_GetNextItem113c(mem, pItemNode)
  }

  let bChanged = 1
  while (bChanged !== 0) {
    for (let bodyLoc = 1; bodyLoc < 11; bodyLoc += 1) {
      const pItem = INVENTORY_GetItemFromBodyLocMemPort113c(mem, pInventory, bodyLoc)
      if (pItem === 0) {
        continue
      }
      if (
        ITEMS_CheckCommandFlags113c(mem, pItem, 0x100) !== 0 &&
        STATLIST_GetOwnerAndDynamicFlag113c(mem, pItem, 0) === 0
      ) {
        continue
      }
      if (
        ITEMS_CheckCommandFlags113c(mem, pItem, 0x4000) !== 0 &&
        STATLIST_GetOwnerAndDynamicFlag113c(mem, pItem, 0) === 0
      ) {
        continue
      }
      if (D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c(mem, pUnit, pItem) === 0) {
        ITEMS_SetOrClearCommandFlags113c(mem, pItem, 0x4000, 1)
        const pCurInv = mem.u32(pUnit + 0x60) >>> 0
        INVENTORY_UpdateWeaponGuidOnRemoval113c(mem, pCurInv, pItem)
        if (
          UNITS_GetAnimOrSeqMode113c(mem, pItem) === 1 &&
          callees &&
          callees.deactivateEquippedItemStats
        ) {
          callees.deactivateEquippedItemStats(mem, pUnit, pItem, pGame, 1, 1)
        }
      }
    }

    bChanged = 0
    for (let bodyLoc = 1; bodyLoc < 11; bodyLoc += 1) {
      const pItem = INVENTORY_GetItemFromBodyLocMemPort113c(mem, pInventory, bodyLoc)
      if (pItem === 0) {
        continue
      }
      if (ITEMS_CheckCommandFlags113c(mem, pItem, 0x100) !== 0) {
        continue
      }
      if (
        ITEMS_CheckCommandFlags113c(mem, pItem, 0x4000) === 0 &&
        STATLIST_GetOwnerAndDynamicFlag113c(mem, pItem, 0) !== 0
      ) {
        continue
      }
      if (D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c(mem, pUnit, pItem) === 0) {
        continue
      }
      ITEMS_SetOrClearCommandFlags113c(mem, pItem, 0x4000, 0)
      const pCurInv = mem.u32(pUnit + 0x60) >>> 0
      if (pCurInv !== 0) {
        const loc = ITEMS_GetBodyLocation113c(mem, pItem) & 0xff
        if (loc !== 11 && loc !== 12) {
          INVENTORY_UpdateWeaponGuidOnInsert113c(mem, pCurInv, pItem)
          const itemMode = UNITS_GetAnimOrSeqMode113c(mem, pItem)
          const canActivate =
            itemMode === 1 ||
            (itemMode === 0 && ITEMS_CanUseCharmInInventory113c(mem, pItem, pUnit) !== 0)
          if (canActivate && callees && callees.activateEquippedItemStats) {
            callees.activateEquippedItemStats(mem, pUnit, pItem, 1)
          }
        }
      }
      bChanged = 1
    }
  }

  for (let bodyLoc = 1; bodyLoc < 11; bodyLoc += 1) {
    const pItem = INVENTORY_GetItemFromBodyLocMemPort113c(mem, pInventory, bodyLoc)
    if (pItem === 0) {
      continue
    }
    if (ITEMS_GetItemQuality113c(mem, pItem) !== 5) {
      continue
    }
    if (
      ITEMS_CheckCommandFlags113c(mem, pItem, 0x100) !== 0 ||
      ITEMS_CheckCommandFlags113c(mem, pItem, 0x4000) !== 0
    ) {
      continue
    }
    if (callees && callees.deactivateEquippedItemStats) {
      callees.deactivateEquippedItemStats(mem, pUnit, pItem, pGame, 1, 1)
    }
    if (callees && callees.activateEquippedItemStats) {
      callees.activateEquippedItemStats(mem, pUnit, pItem, 1)
    }
  }

  D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c(mem, pUnit, pSnapshot, callees)
  UNITS_SetUnitUpdateFlags113c(mem, pUnit, 1)

  if (bSendPacket === 0) {
    return
  }
  let pPlayerUnit = 0
  const unitType = mem.u32(pUnit) >>> 0
  if (unitType === 0) {
    pPlayerUnit = pUnit
  } else if (unitType === 1) {
    const pMonData = mem.u32(pUnit + 0x14) >>> 0
    if (pMonData !== 0) {
      const pAiGeneral = mem.u32(pMonData + 0x28) >>> 0
      if (pAiGeneral !== 0) {
        const pOwnerGame = mem.u32(pAiGeneral + 0x28) >>> 0
        if (pOwnerGame !== 0) {
          const ownerId = mem.u32(pAiGeneral + 0x2c) >>> 0
          const ownerType = mem.u32(pAiGeneral + 0x30) >>> 0
          const pOwner = SUNIT_GetServerUnit113c(mem, pOwnerGame, ownerType, ownerId)
          if (pOwner !== 0 && (mem.u32(pOwner) >>> 0) === 0) {
            pPlayerUnit = pOwner
          }
        }
      }
    }
  }
  if (pPlayerUnit === 0) {
    return
  }
  const pPlayerData = UNITS_GetPlayerData113c(mem, pPlayerUnit)
  if (pPlayerData === 0) {
    return
  }
  const pClient = mem.u32(pPlayerData + 0x9c) >>> 0
  if (pClient === 0) {
    return
  }
  const dwUnitId = mem.u32(pUnit + 0x0c) >>> 0
  const pkt = new Uint8Array(11)
  pkt[0] = 0x48
  pkt[1] = unitType & 0xff
  pkt[2] = 0
  pkt[3] = dwUnitId & 0xff
  pkt[4] = (dwUnitId >>> 8) & 0xff
  pkt[5] = (dwUnitId >>> 16) & 0xff
  pkt[6] = (dwUnitId >>> 24) & 0xff
  enqueueClientPacket113c(mem, pClient, pkt, callees)
}

// @va D2Game:0x6FCF9470
export function D2GAME_ITEMSTAT_OnStatChangedCallback113c(
  mem: Memory113c,
  pGame: D2Ptr,
  pUnit: D2Ptr,
  pItemUnit: D2Ptr,
  dwStatAndLayer: number,
  nOldValue: number,
  nNewValue: number,
  sgptDataTablesPtr: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  if (pGame === 0 || pUnit === 0 || sgptDataTablesPtr === 0) {
    return
  }
  const nStatId = (dwStatAndLayer >>> 16) | 0
  const nLayer = dwStatAndLayer & 0xffff
  if (nStatId < 0) {
    return
  }
  const pDataTables = mem.u32(sgptDataTablesPtr) >>> 0
  if (pDataTables === 0) {
    return
  }
  const nItemStatCostCount = i32(mem.u32(pDataTables + 0xbd4))
  if (nStatId >= nItemStatCostCount) {
    return
  }
  const pItemStatCostTxt = mem.u32(pDataTables + 0xbcc) >>> 0
  if (pItemStatCostTxt === 0) {
    return
  }
  const pRecord = (pItemStatCostTxt + nStatId * 0x144) >>> 0
  const dwItemGuid = pItemUnit !== 0 ? mem.u32(pItemUnit + 0x0c) >>> 0 : 0

  const wMonEv1 = i16(mem.u16(pRecord + 0x48))
  if (wMonEv1 > 0) {
    if (nNewValue !== 0) {
      const alreadyHas =
        callees && callees.hasMonEventEntry
          ? callees.hasMonEventEntry(mem, pUnit, 2, dwStatAndLayer)
          : 0
      if (alreadyHas === 0) {
        const wFunc1 = i16(mem.u16(pRecord + 0x4c))
        if (callees && callees.registerMonEventEntry) {
          callees.registerMonEventEntry(
            mem,
            pUnit,
            2,
            dwStatAndLayer,
            wFunc1,
            wMonEv1,
            dwItemGuid,
          )
        }
        const wMonEv2 = i16(mem.u16(pRecord + 0x4a))
        if (wMonEv2 > 0) {
          const wFunc2 = i16(mem.u16(pRecord + 0x4e))
          if (callees && callees.registerMonEventEntry) {
            callees.registerMonEventEntry(
              mem,
              pUnit,
              2,
              dwStatAndLayer,
              wFunc2,
              wMonEv2,
              dwItemGuid,
            )
          }
        }
      }
    } else if (callees && callees.unregisterMonEventEntries) {
      callees.unregisterMonEventEntries(mem, pUnit, 2, dwStatAndLayer, dwItemGuid)
    }
  }

  const scaleResourceStat = (curStatId: number): void => {
    const oldMax = nOldValue | 0
    const newMax = nNewValue | 0
    if (newMax === oldMax || oldMax <= 0) {
      return
    }
    const curVal = STATLIST_GetUnitStat113c(mem, pUnit, curStatId, 0) | 0
    if (curVal <= 0) {
      return
    }
    const denom = oldMax > 0x100 ? oldMax : 0x100
    let scaled = Math.trunc((curVal / denom) * newMax)
    if (scaled <= 1) {
      scaled = 1
    }
    if (scaled >= newMax) {
      scaled = newMax
    }
    STATLIST_SetUnitStat113c(mem, pUnit, curStatId, scaled, 0)
  }

  switch (nStatId) {
    case 7: {
      scaleResourceStat(6)
      if ((mem.u32(pUnit) >>> 0) === 1) {
        const pMonStatsTxt = getMonsterStatsTxtRecord113c(mem, pUnit)
        if (pMonStatsTxt !== 0) {
          const nLifeRegen = i32(mem.u32(pMonStatsTxt + 0x1a0))
          if (nLifeRegen !== 0) {
            const regenVal = (((nNewValue >> 8) * nLifeRegen) >> 4) | 0
            STATLIST_SetUnitStat113c(mem, pUnit, 0x4a, regenVal, 0)
          }
        }
      }
      return
    }
    case 9:
      scaleResourceStat(8)
      return
    case 11:
      scaleResourceStat(10)
      return
    case 97:
    case 107: {
      const nSkillId = nLayer & 0xffff
      const pSkillTxt = SKILLS_GetRecordPtrFast113c(mem, nSkillId)
      if (nSkillId === 0) {
        return
      }
      if (nStatId === 107) {
        if ((mem.u32(pUnit) >>> 0) !== 0) {
          return
        }
        const nCharClass = pSkillTxt !== 0 ? i8(mem.u8(pSkillTxt + 0x0c)) : -1
        if ((i32(mem.u32(pUnit + 4)) | 0) !== nCharClass) {
          return
        }
      }
      let pSkill = SKILLS_GetSkillById113c(mem, pUnit, nSkillId, -1)
      if (pSkill === 0) {
        pSkill = SKILLS_AddSkillToUnit113c(mem, pUnit, nSkillId)
        SKILLS_SetSkillLevelOnUnit113c(mem, pUnit, nSkillId, 0, 0, 0, 0)
        let pClient = 0
        if ((mem.u32(pUnit) >>> 0) === 0) {
          const pPlayerData = UNITS_GetPlayerData113c(mem, pUnit)
          if (pPlayerData !== 0) {
            pClient = mem.u32(pPlayerData + 0x9c) >>> 0
          }
        }
        if (callees && callees.sendSkillListPacket) {
          callees.sendSkillListPacket(mem, pClient, pUnit)
        }
      }
      STATES_ApplyMonSkillIconToUnit113c(mem, pUnit, nSkillId)
      if (callees && callees.refreshPassiveSkillStats) {
        callees.refreshPassiveSkillStats(mem, pUnit, nSkillId, dwItemGuid)
      }
      if ((nNewValue | 0) > 0) {
        return
      }
      let bRemoveSkill = 1
      if (SKILLS_EvaluateSkillLevel113c(mem, pUnit, pSkill, 0) !== 0) {
        bRemoveSkill = 0
        if (SKILLS_EvaluateSkillLevel113c(mem, pUnit, pSkill, 1) !== 0) {
          return
        }
      }
      if (UNITS_GetLeftSkill113c(mem, pUnit) === pSkill) {
        const pDefaultLeft = SKILLS_GetSkillById113c(mem, pUnit, 0, -1)
        if (pDefaultLeft !== 0) {
          SKILLS_SetLeftSkill113c(mem, pUnit, 0, 0xffffffff)
          const pOutGuid = mem.alloc(4)
          mem.setU32(pOutGuid, 0xffffffff)
          SKILLS_GetItemSkillInfo113c(mem, pDefaultLeft, pOutGuid, 0, 0, 0)
          if ((mem.u32(pUnit) >>> 0) === 0 && callees && callees.assignUnitSkill) {
            callees.assignUnitSkill(mem, pUnit, 1, 0, mem.u32(pOutGuid) >>> 0)
          }
        }
      }
      if (
        UNITS_GetRightSkill113c(mem, pUnit) === pSkill &&
        callees &&
        callees.assignUnitSkill
      ) {
        callees.assignUnitSkill(mem, pUnit, 0, 0, 0xffffffff)
      }
      if (bRemoveSkill !== 0) {
        SKILLS_SetSkillLevelOnUnit113c(mem, pUnit, nSkillId, 0, 1, 0, 0)
      }
      return
    }
    case 83:
    case 188: {
      const targetClass = nStatId === 188 ? (nLayer >>> 3) & 0x1fff : nLayer & 0xffff
      let matchesClass = false
      if ((mem.u32(pUnit) >>> 0) === 0 && (mem.u32(pUnit + 4) >>> 0) === targetClass) {
        matchesClass = true
      } else if (MONSTERS_GetHirelingTypeId113c(mem, pUnit) !== 0) {
        matchesClass = true
      } else {
        const pScratch = mem.alloc(12)
        mem.setU32(pScratch, mem.u32(pUnit) >>> 0)
        mem.setU32(pScratch + 4, mem.u32(pUnit + 4) >>> 0)
        mem.setU32(pScratch + 8, mem.u32(pUnit + 0x10) >>> 0)
        UNITS_GetTransformGfx113c(mem, pUnit, pScratch, pScratch + 4, pScratch + 8)
        if (mem.u32(pScratch) === 0 && (mem.u32(pScratch + 4) >>> 0) === targetClass) {
          matchesClass = true
        }
      }
      if (matchesClass && callees && callees.refreshAllUnitSkills) {
        callees.refreshAllUnitSkills(mem, pGame, pUnit)
      }
      return
    }
    case 126:
    case 127:
      if (callees && callees.refreshAllUnitSkills) {
        callees.refreshAllUnitSkills(mem, pGame, pUnit)
      }
      return
    case 151:
      if (nNewValue !== 0) {
        if (callees && callees.applyAuraStatChange) {
          callees.applyAuraStatChange(mem, pGame, pUnit, dwItemGuid, nLayer, nNewValue)
        }
      } else if (callees && callees.removeAuraStatChange) {
        callees.removeAuraStatChange(mem, pGame, pUnit, dwItemGuid)
      }
      return
    case 204: {
      if (pItemUnit === 0) {
        return
      }
      const nShift = mem.u32(pDataTables + 0xc6c) & 0x1f
      const dwMask = mem.u32(pDataTables + 0xc70) >>> 0
      const nLevel = nLayer & dwMask
      const nSkillId = nLayer >> nShift
      const rawCharges = STATLIST_GetUnitStat113c(mem, pItemUnit, nStatId, nLayer)
      const curCharges = rawCharges & 0xff
      if (curCharges > 0 && STATLIST_GetOwnerAndDynamicFlag113c(mem, pItemUnit, 0) === pUnit) {
        SKILLS_AssignItemChargedSkillStdcall113c(
          mem,
          pUnit,
          dwItemGuid,
          nSkillId,
          nLevel,
          curCharges,
          0,
        )
        return
      }
      SKILLS_AssignItemChargedSkillStdcall113c(mem, pUnit, dwItemGuid, nSkillId, nLevel, 0, 1)
      if (callees && callees.refreshPassiveSkillStats) {
        callees.refreshPassiveSkillStats(mem, pUnit, nSkillId, dwItemGuid)
      }
      return
    }
    case 98: {
      const nStateId = nLayer & 0xffff
      const nStatesCount = i32(mem.u32(pDataTables + 0xc4))
      if (nStateId < 0 || nStateId >= nStatesCount) {
        return
      }
      if (nNewValue !== 0) {
        if (STATES_CheckState113c(mem, pUnit, nStateId) !== 0) {
          return
        }
        if (callees && callees.applyStateStatChange) {
          callees.applyStateStatChange(mem, pGame, pUnit, nStateId, 0)
        }
        STATES_ToggleGfxStateFlag113c(mem, pUnit, nStateId, 1)
        STATES_ClearGfxStateFlag113c(mem, pUnit, nStateId, 1)
      } else {
        if (STATES_CheckState113c(mem, pUnit, nStateId) === 0) {
          return
        }
        if (callees && callees.applyStateStatChange) {
          callees.applyStateStatChange(mem, pGame, pUnit, nStateId, 1)
        }
        STATES_ToggleGfxStateFlag113c(mem, pUnit, nStateId, 0)
        STATES_ClearGfxStateFlag113c(mem, pUnit, nStateId, 1)
      }
      return
    }
    default:
      return
  }
}

// @va D2Game:0x6FCFF780
export function D2GAME_SUNIT_GetGameFromUnit113c(mem: Memory113c, pUnit: D2Ptr): D2Ptr {
  if (pUnit === 0) {
    return 0
  }
  return mem.u32(pUnit + 0x80) >>> 0
}

// @va D2Game:0x6FCFFC10
export function D2GAME_SUNIT_IterateAllLivingPlayers113c(
  mem: Memory113c,
  pGame: D2Ptr,
  pfnCallback: (mem: Memory113c, pGame: D2Ptr, pPlayer: D2Ptr, pContext: D2Ptr) => void,
  pContext: D2Ptr,
): void {
  if (pGame === 0) {
    return
  }
  for (let bucket = 0; bucket < 0x80; bucket += 1) {
    let pUnit = mem.u32(pGame + 0x1120 + bucket * 4) >>> 0
    while (pUnit !== 0) {
      if (STATES_CheckState113c(mem, pUnit, 7) === 0) {
        pfnCallback(mem, pGame, pUnit, pContext)
      }
      pUnit = mem.u32(pUnit + 0xe4) >>> 0
    }
  }
}

// @va D2Game:0x6FD10130
export function D2GAME_PARTY_Send0x8BPartyRelationStatus113c(
  mem: Memory113c,
  pUnitA: D2Ptr,
  pDestUnit: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  const pPlayerDataDest = UNITS_GetPlayerData113c(mem, pDestUnit)
  const guidA = pUnitA !== 0 ? mem.u32(pUnitA + 0x0c) >>> 0 : 0xffffffff
  let pNode = 0
  if (pDestUnit !== pUnitA && pPlayerDataDest !== 0) {
    let cur = mem.u32(pPlayerDataDest + 0x38) >>> 0
    while (cur !== 0) {
      if ((mem.u32(cur) >>> 0) === guidA) {
        pNode = cur
        break
      }
      cur = mem.u32(cur + 0x10) >>> 0
    }
  }
  const guidDest = pDestUnit !== 0 ? mem.u32(pDestUnit + 0x0c) >>> 0 : 0xffffffff
  if (guidDest === guidA || pNode === 0) {
    return
  }
  let pClient = 0
  if (pDestUnit !== 0 && (mem.u32(pDestUnit) >>> 0) === 0 && pPlayerDataDest !== 0) {
    pClient = mem.u32(pPlayerDataDest + 0x9c) >>> 0
  }
  const bState = mem.u8(pNode + 0x0c)
  const pkt = new Uint8Array(6)
  pkt[0] = 0x8b
  pkt[1] = guidA & 0xff
  pkt[2] = (guidA >>> 8) & 0xff
  pkt[3] = (guidA >>> 16) & 0xff
  pkt[4] = (guidA >>> 24) & 0xff
  pkt[5] = bState
  enqueueClientPacket113c(mem, pClient, pkt, callees)
}

// @va D2Game:0x6FD10220
export function D2GAME_PARTY_SetPlayerRelationState113c(
  mem: Memory113c,
  pOwnerUnit: D2Ptr,
  pTargetUnit: D2Ptr,
  dwState: number,
): void {
  const pNode = findPlayerRelationNode113c(mem, pOwnerUnit, pTargetUnit)
  if (pOwnerUnit !== pTargetUnit && pNode !== 0) {
    mem.setU32(pNode + 0x0c, dwState >>> 0)
  }
}

// @va D2Game:0x6FD102F0
export function D2GAME_PARTY_EnsurePlayerRelationNode113c(
  mem: Memory113c,
  pUnitA: D2Ptr,
  pUnitB: D2Ptr,
  _pGame: D2Ptr,
): void {
  const pPlayerDataB = UNITS_GetPlayerData113c(mem, pUnitB)
  if (pUnitB === pUnitA || pPlayerDataB === 0) {
    return
  }
  if (STATES_CheckState113c(mem, pUnitA, 7) !== 0) {
    return
  }
  if (STATES_CheckState113c(mem, pUnitB, 7) !== 0) {
    return
  }
  if (findPlayerRelationNode113c(mem, pUnitB, pUnitA) !== 0) {
    return
  }
  const pNode = mem.alloc(0x14)
  mem.setU32(pNode, pUnitA !== 0 ? mem.u32(pUnitA + 0x0c) >>> 0 : 0xffffffff)
  mem.setU32(pNode + 4, 0)
  mem.setU32(pNode + 8, 0)
  const classId = SUNITDMG_GetPlayerClientClassId113c(mem, pUnitA) & 0xffff
  mem.setU32(pNode + 0x0c, classId !== 0xffff ? 1 : 0)
  mem.setU32(pNode + 0x10, mem.u32(pPlayerDataB + 0x38) >>> 0)
  mem.setU32(pPlayerDataB + 0x38, pNode)
}

// @va D2Game:0x6FD10480
export function D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c(
  mem: Memory113c,
  pGame: D2Ptr,
  pUnitNew: D2Ptr,
  pUnitExisting: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  const guidNew = pUnitNew !== 0 ? mem.u32(pUnitNew + 0x0c) >>> 0 : 0xffffffff
  D2GAME_PARTY_EnsurePlayerRelationNode113c(mem, pUnitExisting, pUnitNew, pGame)
  D2GAME_PARTY_EnsurePlayerRelationNode113c(mem, pUnitNew, pUnitExisting, pGame)
  D2GAME_PACKET_SendPlayerPartyRelationship113c(mem, pUnitNew, pUnitExisting, callees)

  const pNodeOnNew = findPlayerRelationNode113c(mem, pUnitNew, pUnitExisting)
  if (pUnitNew !== pUnitExisting && pNodeOnNew !== 0) {
    mem.setU32(pNodeOnNew + 0x0c, 0)
  }

  let hasParty = 0
  if (pUnitNew !== 0) {
    const pUnitGame = mem.u32(pUnitNew + 0x80) >>> 0
    if (pUnitGame !== 0 && (mem.u32(pUnitNew) >>> 0) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(mem, pUnitNew, pUnitGame) & 0xffff
      if (wPartyId !== 0xffff) {
        hasParty = 1
      }
    }
  }
  D2GAME_PARTY_SetPlayerRelationState113c(mem, pUnitExisting, pUnitNew, hasParty)
  D2GAME_PARTY_Send0x8BPartyRelationStatus113c(mem, pUnitNew, pUnitExisting, callees)
  D2GAME_PARTY_Send0x8BPartyRelationStatus113c(mem, pUnitExisting, pUnitNew, callees)

  const pPlayerDataNew = UNITS_GetPlayerData113c(mem, pUnitNew)
  if (pPlayerDataNew === 0) {
    return
  }
  let pRelNode = mem.u32(pPlayerDataNew + 0x38) >>> 0
  while (pRelNode !== 0) {
    const otherGuid = mem.u32(pRelNode) >>> 0
    const wRelFlags = mem.u16(pRelNode + 4)
    let pClientExisting = 0
    if (pUnitExisting !== 0 && (mem.u32(pUnitExisting) >>> 0) === 0) {
      const pPlayerDataExisting = UNITS_GetPlayerData113c(mem, pUnitExisting)
      if (pPlayerDataExisting !== 0) {
        pClientExisting = mem.u32(pPlayerDataExisting + 0x9c) >>> 0
      }
    }
    const pkt = new Uint8Array(11)
    pkt[0] = 0x8c
    pkt[1] = guidNew & 0xff
    pkt[2] = (guidNew >>> 8) & 0xff
    pkt[3] = (guidNew >>> 16) & 0xff
    pkt[4] = (guidNew >>> 24) & 0xff
    pkt[5] = otherGuid & 0xff
    pkt[6] = (otherGuid >>> 8) & 0xff
    pkt[7] = (otherGuid >>> 16) & 0xff
    pkt[8] = (otherGuid >>> 24) & 0xff
    pkt[9] = wRelFlags & 0xff
    pkt[10] = (wRelFlags >>> 8) & 0xff
    enqueueClientPacket113c(mem, pClientExisting, pkt, callees)
    pRelNode = mem.u32(pRelNode + 0x10) >>> 0
  }
}

// @va D2Game:0x6FD135C0
export function D2GAME_MONSTER_SendMonsterMovementSync113c(
  mem: Memory113c,
  pUnit: D2Ptr,
  nFlag: number,
  pClient: D2Ptr,
  callees?: BootInitGapBCallees113c,
): void {
  if (pUnit === 0 || pClient === 0) {
    return
  }
  const pGame = mem.u32(pUnit + 0x80) >>> 0
  const animMode = mem.u32(pUnit + 0x10) >>> 0
  const modeRow =
    animMode < MONSTER_MODE_SYNC_TABLE_113C.length
      ? MONSTER_MODE_SYNC_TABLE_113C[animMode]!
      : MONSTER_MODE_SYNC_TABLE_113C[1]!

  SUNIT_ValidatePathTargetUnit113c(mem, pUnit, pGame)
  const pPath = mem.u32(pUnit + 0x2c) >>> 0
  let pTargetUnit = pPath !== 0 ? PATH_GetTargetUnit113c(mem, pPath) : 0
  if (pTargetUnit === pUnit) {
    pTargetUnit = 0
  } else if (pTargetUnit !== 0 && callees && callees.checkMonsterTargetValid) {
    if (callees.checkMonsterTargetValid(mem, pTargetUnit) === 0) {
      pTargetUnit = 0
    }
  }
  if (modeRow[0] === 0) {
    pTargetUnit = 0
  }

  if (animMode === 14 || SKILLS_GetUsedSkillMemPort113c(mem, pUnit) !== 0) {
    if (callees && callees.syncMonsterSkillCast) {
      callees.syncMonsterSkillCast(mem, pUnit, nFlag, pTargetUnit, pClient)
    }
    return
  }
  if (pPath === 0) {
    return
  }

  let nOpcode = 0x67
  let nAction = modeRow[4]
  let nPosOrTypeX = 0
  let nPosOrGuidY = 0

  if (pTargetUnit !== 0) {
    nAction = modeRow[5]
    nPosOrTypeX = mem.u32(pTargetUnit) >>> 0
    nPosOrGuidY = mem.u32(pTargetUnit + 0x0c) >>> 0
    nOpcode = 0x68
    if (animMode === 2 || animMode === 15) {
      const pathType = PATH_GetType113c(mem, pPath) | 0
      if (pathType >= 5 && pathType <= 6) {
        nAction = modeRow[4]
        nOpcode = 0x67
        nPosOrTypeX = PATH_GetLastPointX113c(mem, pPath)
        nPosOrGuidY = PATH_GetLastPointY113c(mem, pPath)
      }
    }
  } else if (modeRow[1] !== 0) {
    nPosOrTypeX = PATH_GetLastPointX113c(mem, pPath)
    nPosOrGuidY = PATH_GetLastPointY113c(mem, pPath)
  } else {
    nPosOrTypeX = PATH_GetPosX113c(mem, pPath)
    nPosOrGuidY = PATH_GetPosY113c(mem, pPath)
  }

  let bExtra1 = 0
  let bExtra2 = 0
  let bExtra3 = 0
  let bStepNum = 0

  const switchIdx =
    animMode <= 13 ? MONSTER_MODE_SWITCH_INDEX_113C[animMode]! : 5

  switch (switchIdx) {
    case 0:
      bExtra1 = PATH_GetDirection113c(mem, pPath) & 0xff
      bExtra2 = mem.u8(pUnit + 0xb0)
      break
    case 1: {
      let dir = getMonsterDirectionDefault113c(mem, pUnit, callees)
      if (dir > 1) {
        dir = (dir - 1) & 0xff
      }
      if (MONSTER_CheckTypeFlagsMask113c(mem, pUnit, 0x100) !== 0) {
        dir = (dir | 0x80) & 0xff
      }
      bExtra1 = dir
      bExtra2 = mem.u8(pUnit + 0xb0)
      break
    }
    case 2:
      if (pTargetUnit === 0) {
        nPosOrTypeX = 0
        nPosOrGuidY = 0xffffffff
      }
      break
    case 3:
      bExtra1 = PATH_GetDirection113c(mem, pPath) & 0xff
      break
    case 4:
      bExtra1 = PATH_GetDistance113c(mem, pPath) & 0xff
      bExtra2 = getMonsterDirectionDefault113c(mem, pUnit, callees)
      bExtra3 = mem.u8(pUnit + 0xb0)
      break
    default: {
      bStepNum = PATH_GetStepNum113c(mem, pPath) & 0xff
      if (animMode === 1) {
        const bDir = getMonsterDirectionDefault113c(mem, pUnit, callees)
        const dwUnitId = mem.u32(pUnit + 0x0c) >>> 0
        const wUnitY = UNIT_GetPosY113c(mem, pUnit) & 0xffff
        const wUnitX = UNIT_GetPosX113c(mem, pUnit) & 0xffff
        D2GAME_PACKET_SendUnitStop113c(mem, pClient, dwUnitId, wUnitX, wUnitY, bDir, callees)
        const curStat = STATLIST_GetUnitBaseStat113c(mem, pUnit, 0x148, 0) | 0
        STATLIST_SetUnitStat113c(mem, pUnit, 0x148, (curStat + 1) | 0, 0)
        return
      }
      break
    }
  }

  const dwUnitId = mem.u32(pUnit + 0x0c) >>> 0
  if (switchIdx === 4 || (switchIdx === 5 && animMode === 13)) {
    if (callees && callees.onMonsterMovementPacket) {
      callees.onMonsterMovementPacket(
        mem,
        pClient,
        nOpcode,
        dwUnitId,
        nAction,
        nPosOrTypeX,
        nPosOrGuidY,
        bExtra1,
        bExtra2,
        bExtra3,
      )
    }
    return
  }

  if (modeRow[2] !== 0) {
    if (callees && callees.onMonsterMovementPacket) {
      callees.onMonsterMovementPacket(
        mem,
        pClient,
        nOpcode,
        dwUnitId,
        nAction,
        nPosOrTypeX,
        nPosOrGuidY,
        bStepNum,
        0,
        0,
      )
    }
    return
  }

  if (modeRow[3] !== 0) {
    const outOp = nOpcode === 0x68 ? 0x6c : 0x6b
    const wUnitY = UNIT_GetPosY113c(mem, pUnit) & 0xffff
    const wUnitX = UNIT_GetPosX113c(mem, pUnit) & 0xffff
    if (callees && callees.onMonsterMovementPacket) {
      callees.onMonsterMovementPacket(
        mem,
        pClient,
        outOp,
        dwUnitId,
        nAction,
        nPosOrTypeX,
        nPosOrGuidY,
        wUnitX,
        wUnitY,
        bExtra1,
      )
    }
    return
  }

  const outOp = nOpcode === 0x68 ? 0x6a : 0x69
  if (callees && callees.onMonsterMovementPacket) {
    callees.onMonsterMovementPacket(
      mem,
      pClient,
      outOp,
      dwUnitId,
      nAction,
      nPosOrTypeX,
      nPosOrGuidY,
      bExtra1,
      bExtra2,
      0,
    )
  }
}

// @va D2Game:0x6FD13A40
export function D2GAME_MONSTER_SyncMonsterUnitToClient113c(
  mem: Memory113c,
  pGame: D2Ptr,
  pUnit: D2Ptr,
  pClient: D2Ptr,
  bPreSynced: number,
  callees?: BootInitGapBCallees113c,
): void {
  if (pUnit !== 0) {
    if ((mem.u8(pUnit + 0xca) & 1) !== 0) {
      const wPosY = getUnitYByType113c(mem, pUnit)
      const wPosX = getUnitXByType113c(mem, pUnit)
      const dwUnitId = mem.u32(pUnit + 0x0c) >>> 0
      const bUnitType = mem.u32(pUnit) & 0xff
      const pkt = new Uint8Array(11)
      pkt[0] = 0x15
      pkt[1] = bUnitType
      pkt[2] = dwUnitId & 0xff
      pkt[3] = (dwUnitId >>> 8) & 0xff
      pkt[4] = (dwUnitId >>> 16) & 0xff
      pkt[5] = (dwUnitId >>> 24) & 0xff
      pkt[6] = wPosX & 0xff
      pkt[7] = (wPosX >>> 8) & 0xff
      pkt[8] = wPosY & 0xff
      pkt[9] = (wPosY >>> 8) & 0xff
      pkt[10] = 1
      enqueueClientPacket113c(mem, pClient, pkt, callees)
      if (callees && callees.onClearUnitReassignFlags) {
        callees.onClearUnitReassignFlags(mem, pUnit, pGame)
      }
    }
    if ((mem.u32(pUnit + 0xc4) & 1) !== 0) {
      D2GAME_MONSTER_SendMonsterMovementSync113c(mem, pUnit, pGame, pClient, callees)
    }
    mem.setU32(pUnit + 0xc4, (mem.u32(pUnit + 0xc4) & 0xfff7ffff) >>> 0)
  }

  if (callees && callees.onMonsterPostSync) {
    callees.onMonsterPostSync(mem, pUnit, pClient)
  }

  if (pUnit !== 0) {
    if (((mem.u32(pUnit + 0xc4) >>> 8) & 1) !== 0 && callees && callees.onMonsterSyncFlag8) {
      callees.onMonsterSyncFlag8(mem, pUnit, pClient)
    }

    if ((mem.u32(pUnit + 0xc8) & 1) !== 0) {
      const pClientPlayer =
        callees && callees.getSpecialUnit
          ? callees.getSpecialUnit(mem, pClient, 0)
          : resolveClientPlayerUnit113c(mem, pClient)
      const isOwned =
        pClientPlayer !== 0 && callees && callees.isMonsterOwnedByPlayer
          ? callees.isMonsterOwnedByPlayer(mem, pUnit, pClientPlayer)
          : 0
      if (pClientPlayer !== 0 && isOwned !== 0) {
        if (callees && callees.sendPetSyncForMonster) {
          callees.sendPetSyncForMonster(mem, pGame, pUnit, pClient, 0)
        }
        const nPetType =
          callees && callees.findMercPetType
            ? callees.findMercPetType(mem, pGame, pClientPlayer, pUnit)
            : 0
        if (nPetType !== 0 && callees && callees.sendPetSyncForMonster) {
          callees.sendPetSyncForMonster(mem, pGame, pUnit, pClient, nPetType)
        }
      } else if (MONSTERS_GetHirelingTypeId113c(mem, pUnit) !== 0) {
        let pMercOwner = 0
        if ((mem.u32(pUnit) >>> 0) === 1) {
          const pMonData = mem.u32(pUnit + 0x14) >>> 0
          if (pMonData !== 0) {
            const pAiGeneral = mem.u32(pMonData + 0x28) >>> 0
            if (pAiGeneral !== 0) {
              const pOwnerGame = mem.u32(pAiGeneral + 0x28) >>> 0
              if (pOwnerGame !== 0) {
                const ownerId = mem.u32(pAiGeneral + 0x2c) >>> 0
                const ownerType = mem.u32(pAiGeneral + 0x30) >>> 0
                pMercOwner = SUNIT_GetServerUnit113c(mem, pOwnerGame, ownerType, ownerId)
              }
            }
          }
        }
        if (pMercOwner === pClientPlayer && callees && callees.sendPetSyncForMonster) {
          callees.sendPetSyncForMonster(mem, pGame, pUnit, pClient, 0)
        }
      }
    }

    if (((mem.u32(pUnit + 0xc4) >>> 10) & 1) !== 0) {
      MONSTER_BroadcastEventSoundToClients113c(mem, pUnit, pClient)
    }

    if (((mem.u32(pUnit + 0xc4) >>> 15) & 1) !== 0) {
      const curHp = (STATLIST_GetUnitStat113c(mem, pUnit, 6, 0) | 0) >> 8
      const maxHp = (STATLIST_GetUnitStat113c(mem, pUnit, 7, 0) | 0) >> 8
      const lifePct =
        maxHp > 0 && curHp < maxHp ? Math.trunc((curHp << 7) / maxHp) & 0xff : 0x80
      STATLIST_SetUnitStat113c(mem, pUnit, 0x160, lifePct, 0)
    }
  }

  if (bPreSynced === 0 && UNITS_HasAnyGfxStateFlag113c(mem, pUnit) !== 0) {
    if (callees && callees.onMonsterSyncGfxStates) {
      callees.onMonsterSyncGfxStates(mem, pUnit, pClient)
    }
  }

  if (STATLIST_CheckUnitStatListFlag100113c(mem, pUnit) !== 0) {
    if (callees && callees.onMonsterSyncStatFlag100) {
      callees.onMonsterSyncStatFlag100(mem, pUnit, pClient)
    }
  }

  if (
    pUnit !== 0 &&
    ((mem.u32(pUnit + 0xc4) >>> 11) & 1) !== 0 &&
    callees &&
    callees.onMonsterSyncBossMods
  ) {
    callees.onMonsterSyncBossMods(mem, pUnit, pClient)
  }
}
