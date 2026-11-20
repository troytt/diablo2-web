/**
 * Diablo II v1.13c `D2Game.dll` Core, Unit Sync & Monster AI Pipeline (`[K2]` Wave 3 Batch 8 `w3b8`):
 * 45 functions (`0x6FC97E70 .. 0x6FCA0450`, image base `0x6FC20000`).
 *
 * Every exported function is a 1:1 instruction-faithful `D2KernMemory113c` translation of the
 * `D2Game.dll` v1.13c x86 machine code, with zero array ordering helpers, zero nullish
 * coalescing, zero Node/DOM globals, and zero cross-layer imports.
 */

import { COLLISION_ClearSubtileMask113c } from '../common/collision.ts'
import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import {
  INVENTORY_FreeCorpse113c,
  INVENTORY_GetCorpseUnitId113c,
  INVENTORY_GetFirstCorpse113c,
  INVENTORY_GetLeftItemGuid113c,
  INVENTORY_GetNextCorpse113c,
} from '../common/inventory.ts'
import { SKILLS_SetUsedSkillMemPort113c } from '../common/k0-d2common-memports.ts'
import {
  PATH_ForceDirection113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_MarkUnitDeadCollision113c,
  PATH_SetMoveTestCollisionMask113c,
  PATH_SetNewDistance113c,
  PATH_SetStepNum113c,
  PATH_SetType113c,
  PATH_SetUnitCollisionPattern113c,
  UNITS_GetDirectionToCoords113c,
} from '../common/path.ts'
import {
  STATES_CheckState113c,
  STATES_CheckStateMask2OnUnit113c,
  STATES_CheckStateMask33OnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_ExpireOrphanStateSubLists113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetTotalStatValueLayer0_113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import { CHAT_FreeHoverMsg113c, CHAT_GetTimeoutFromHoverMsg113c } from '../common/text.ts'
import {
  STATES_UpdateGfxStateFlagsByMask113c,
  UNITROOM_RefreshUnit113c,
  UNITS_AreUnitsAligned113c,
  UNITS_GetRoom113c,
  UNITS_HasCollisionBetweenUnits113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.ts'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory.ts'
import {
  DATATBLS_GetDirectionOffset113c,
  DATATBLS_NormalizeDirection113c,
  MONSTERS_IsDead113c,
  MONSTERS_IsDemonOrUndead113c,
} from '../tables/datatbls-113c.ts'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c.ts'
import {
  AIGENERAL_BroadcastCmdToMinions113c,
  AIGENERAL_GetPackLeaderUnit113c,
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  MONSTER_CheckTypeFlagsMask113c,
  MONSTER_HasAlwaysChaseFlag113c,
  MONSTER_InitModeChangeStrc113c,
} from './ai-fallen-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import {
  AIGENERAL_CopyAiCommandParams113c,
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SUNITDMG_DistributeExperience113c,
} from './combat-a1c-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import { MONSTER_StartMode113c as MONSTER_StartModeReal113c } from './k2-real-s2c-combat-113c.ts'
import { MONSTER_GetOrRollRegionSubVariant113c } from './k2-combat-core-w1-113c.ts'
import { PARTY_TestPlayerRelationFlags113c } from './k2-sunit-spawn-w1-113c.ts'
import {
  AI_RunTowardTarget_6FD12F00_113c,
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
} from './k2-w2b8-113c.ts'
import { MONSTER_ClearModeEvents113c, SUNIT_IsDeadOrDying113c } from './monster-events.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_CheckFlagBit113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_GetRecordPtr113c,
  MONSTATS_ValidateClassId113c,
  MONSTER_CheckSpawnTileFree113c,
  MONSTER_GetBaseIdFromUnit113c,
  SEED_RollLimitedFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel.ts'
import { AI_StepRelativeToTargetUnit113c } from './town-npc-ai-113c.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** `D2Game.dll` `.data` `0x6FD18BE0`: global pointer to monster alignment filter table. */
export const D2GAME_MON_ALIGN_TABLE_PTR_VA_113C = 0x6fd18be0

/** Isolated reentrant scratch stack pointer for `w3b8` stack frames. */
let k2W3B8StackPtr = 0x7ea90000

function rollSeedAt6FC21180(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  const max = nMax | 0
  if (addr === 0 || max <= 0) {
    return 0
  }
  const lo = m.u32(addr) >>> 0
  const hi = m.u32((addr + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((addr + 4) >>> 0, newHi)
  m.setU32(addr, newLo)
  const uMax = max >>> 0
  if (((uMax - 1) & uMax) === 0) {
    return (newLo & (uMax - 1)) | 0
  }
  return (newLo % uMax) | 0
}

function appendUnitEventMsgNode113c(
  m: D2KernMemory113c,
  pUnit: number,
  pNode: number,
): void {
  if (m.u32((pUnit + 0xec) >>> 0) === 0) {
    m.setU32((pUnit + 0xec) >>> 0, pNode >>> 0)
  }
  const pLast = m.u32((pUnit + 0xf0) >>> 0) >>> 0
  if (pLast !== 0) {
    m.setU32(pLast, pNode >>> 0)
  }
  m.setU32((pUnit + 0xf0) >>> 0, pNode >>> 0)
  UNITROOM_RefreshUnit113c(m, pUnit >>> 0)
}

/**
 * Checks whether player `pPlayer` (`ecx`) is the owner of corpse unit `pCorpseUnit` (`eax`)
 * or has party corpse-loot permission (`flag 1`) from the corpse owner in `pGame` (`edx`).
 *
 * @va D2Game:0x6FC97E70
 */
export function PLAYER_CanLootCorpse_6FC97E70_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
  pCorpseUnit: number,
): number {
  hitD2GameVa113c(0x6FC97E70)
  if (pPlayer === 0) {
    throw new D2CommonAssertError('0x6fc97e70: pPlayer === 0', 908)
  }
  if (pCorpseUnit === 0) {
    throw new D2CommonAssertError('0x6fc97e70: pCorpseUnit === 0', 909)
  }
  if ((m.u32(pPlayer >>> 0) | 0) !== 0) {
    throw new D2CommonAssertError('0x6fc97e70: pPlayer->dwUnitType !== 0', 910)
  }
  const pInventory = m.u32((pCorpseUnit + 0x60) >>> 0) >>> 0
  const dwOwnerGuid = INVENTORY_GetLeftItemGuid113c(m, pInventory) >>> 0
  if ((m.u32((pPlayer + 0x0c) >>> 0) >>> 0) === dwOwnerGuid) {
    return 1
  }
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fc97e70: pGame === 0', 723)
  }
  const bucket = dwOwnerGuid & 0x7f
  let pOwnerUnit = m.u32((pGame + bucket * 4 + 0x1120) >>> 0) >>> 0
  while (pOwnerUnit !== 0) {
    if ((m.u32((pOwnerUnit + 0x0c) >>> 0) >>> 0) === dwOwnerGuid) {
      return PARTY_TestPlayerRelationFlags113c(m, pOwnerUnit, pPlayer >>> 0, 1) | 0
    }
    pOwnerUnit = m.u32((pOwnerUnit + 0xe4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Walks all corpse nodes in `pPlayer->pInventory` (`eax + 0x60`), freeing stale corpse records
 * whose `dwUnitId` is no longer present in `pGame->pUnitList[0]` (`ebx + 0x1120`) and returning
 * the count of live corpses remaining.
 *
 * @va D2Game:0x6FC97F00
 */
export function PLAYER_PruneAndCountLiveCorpses_6FC97F00_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC97F00)
  const pInventory = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return 0
  }
  let liveCount = 0
  let pCorpse = INVENTORY_GetFirstCorpse113c(m, pInventory) >>> 0
  while (pCorpse !== 0) {
    const pNextCorpse = INVENTORY_GetNextCorpse113c(m, pCorpse) >>> 0
    const dwCorpseUnitId = INVENTORY_GetCorpseUnitId113c(m, pCorpse) >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('0x6fc97f00: pGame === 0', 723)
    }
    const bucket = dwCorpseUnitId & 0x7f
    let pUnit = m.u32((pGame + bucket * 4 + 0x1120) >>> 0) >>> 0
    let found = false
    while (pUnit !== 0) {
      if ((m.u32((pUnit + 0x0c) >>> 0) >>> 0) === dwCorpseUnitId) {
        found = true
        break
      }
      pUnit = m.u32((pUnit + 0xe4) >>> 0) >>> 0
    }
    if (found) {
      liveCount = (liveCount + 1) | 0
    } else {
      INVENTORY_FreeCorpse113c(m, pInventory, dwCorpseUnitId, 1)
    }
    pCorpse = pNextCorpse
  }
  return liveCount
}

/**
 * Finalizes player death state on `pPlayer` (`eax`) in `pGame` (`ecx`): zeroes hitpoints (`stat 6`),
 * expires orphan state sublists, refreshes gfx state flags, clears bit `1` (`0x02`) of `pClient + 0x3D4`,
 * marks dead collision footprint, frees timer events `8` and `9`, and clears mode events.
 *
 * @va D2Game:0x6FC98230
 */
export function PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC98230)
  STATLIST_SetUnitStat113c(m, pPlayer >>> 0, 6, 0, 0)
  STATLIST_ExpireOrphanStateSubLists113c(m, pPlayer >>> 0)
  STATES_UpdateGfxStateFlagsByMask113c(m, pPlayer >>> 0, 0)
  if (pPlayer === 0 || (m.u32(pPlayer >>> 0) | 0) !== 0) {
    throw new D2CommonAssertError('0x6fc98230: invalid player unit', 1978)
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  if (pClient === 0) {
    throw new D2CommonAssertError('0x6fc98230: pClient === 0', 1978)
  }
  const dwClientFlags = m.u32((pClient + 0x3d4) >>> 0) >>> 0
  m.setU32((pClient + 0x3d4) >>> 0, (dwClientFlags & 0xfffffffd) >>> 0)
  PATH_MarkUnitDeadCollision113c(m, pPlayer >>> 0, 1)

  let pEvent = m.u32((pPlayer + 0xdc) >>> 0) >>> 0
  while (pEvent !== 0) {
    const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
    if (m.u8(pEvent) === 8) {
      EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
    }
    pEvent = pNext
  }

  pEvent = m.u32((pPlayer + 0xdc) >>> 0) >>> 0
  while (pEvent !== 0) {
    const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
    if (m.u8(pEvent) === 9) {
      EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
    }
    pEvent = pNext
  }

  MONSTER_ClearModeEvents113c(m, pGame >>> 0, pPlayer >>> 0)
}

/**
 * Event `6` (`EVENT_FREEHOVER`) callback (`ecx = pGame`, `edx = pUnit`, `ret 0x8`):
 * reschedules event `6` if `CHAT_GetTimeoutFromHoverMsg(pUnit->pHoverMsg) > pGame->dwGameFrame`;
 * otherwise frees `pUnit->pHoverMsg` (`+0xA4`), refreshes room unit, and sets `UNITFLAG_HOVERMSG` (`0x100`).
 *
 * @va D2Game:0x6FC99AA0
 */
export function EVENT_HandleFreeHoverMsg_6FC99AA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _arg1 = 0,
  _arg2 = 0,
): void {
  hitD2GameVa113c(0x6FC99AA0)
  if (pUnit === 0) {
    return
  }
  const pHoverMsg = m.u32((pUnit + 0xa4) >>> 0) >>> 0
  if (pHoverMsg === 0) {
    return
  }
  const dwTimeout = CHAT_GetTimeoutFromHoverMsg113c(m, pHoverMsg) >>> 0
  if (dwTimeout > (m.u32((pGame + 0xa8) >>> 0) >>> 0)) {
    EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 6, dwTimeout, 0, 0, 0)
    return
  }
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  CHAT_FreeHoverMsg113c(m, pMemPool, pHoverMsg)
  m.setU32((pUnit + 0xa4) >>> 0, 0)
  UNITROOM_RefreshUnit113c(m, pUnit >>> 0)
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x100) >>> 0)
}

/**
 * Allocates a 16-byte (`0x10`) unit message node of type `0x23` (`S2C_SET_SKILL`), populates
 * `bHand` (`+0x0E`), `wSkillId` (`+0x0C`), and `dwTargetId` (`+0x08`), appends to `pUnit` (`esi`),
 * and refreshes `pUnit` in its room (`ret 0xC`).
 *
 * @va D2Game:0x6FC9A020
 */
export function UNITMSG_QueuePacket23SetSkill_6FC9A020_113c(
  m: D2KernMemory113c,
  pUnit: number,
  bHand: number,
  wSkillId: number,
  dwTargetId: number,
): void {
  hitD2GameVa113c(0x6FC9A020)
  const pNode = m.alloc(0x10)
  m.setU32(pNode, 0)
  m.setU8((pNode + 0x04) >>> 0, 0x23)
  m.setU32((pNode + 0x08) >>> 0, dwTargetId >>> 0)
  m.setU16((pNode + 0x0c) >>> 0, wSkillId & 0xffff)
  m.setU8((pNode + 0x0e) >>> 0, bHand & 0xff)
  appendUnitEventMsgNode113c(m, pUnit >>> 0, pNode)
}

/**
 * Clears gfx state flag `0x12` (`18`) on `pUnit` (`esi`), allocates a 20-byte (`0x14`) unit message
 * node of type `0xA5` (`S2C_STATE_SKILL_A5`) with `wSkillId` (`+0x10`), appends to `pUnit`,
 * and refreshes `pUnit` in its room (`ret 0x4`).
 *
 * @va D2Game:0x6FC9A0F0
 */
export function UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  wSkillId: number,
): void {
  hitD2GameVa113c(0x6FC9A0F0)
  STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x12, 0)
  const pNode = m.alloc(0x14)
  m.setU32(pNode, 0)
  m.setU32((pNode + 0x04) >>> 0, 0)
  m.setU32((pNode + 0x08) >>> 0, 0)
  m.setU32((pNode + 0x0c) >>> 0, 0)
  m.setU32((pNode + 0x10) >>> 0, 0)
  m.setU8((pNode + 0x04) >>> 0, 0xa5)
  const unitType = pUnit !== 0 ? m.u32(pUnit >>> 0) & 0xff : 6
  m.setU8((pNode + 0x08) >>> 0, unitType)
  const unitId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
  m.setU32((pNode + 0x0c) >>> 0, unitId)
  m.setU16((pNode + 0x10) >>> 0, wSkillId & 0xffff)
  appendUnitEventMsgNode113c(m, pUnit >>> 0, pNode)
}

/**
 * Allocates a 40-byte (`0x28`) unit message node of type `0xA3` (`S2C_AURA_TARGET_FX`) for
 * `pUnit` (`esi`) and optional `pTargetUnit` (`edi`), appends to `pUnit`, and refreshes room (`ret 0x14`).
 *
 * @va D2Game:0x6FC9A190
 */
export function UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pTargetUnit: number,
  wAuraState: number,
  wSkillId: number,
  nX: number,
  nY: number,
  bSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FC9A190)
  const pNode = m.alloc(0x28)
  for (let off = 0; off < 0x28; off += 4) {
    m.setU32((pNode + off) >>> 0, 0)
  }
  m.setU8((pNode + 0x04) >>> 0, 0xa3)
  m.setU8((pNode + 0x08) >>> 0, bSkillLevel & 0xff)
  m.setU16((pNode + 0x0a) >>> 0, wAuraState & 0xffff)
  m.setU16((pNode + 0x0c) >>> 0, wSkillId & 0xffff)
  m.setU32((pNode + 0x10) >>> 0, pUnit !== 0 ? m.u32(pUnit >>> 0) >>> 0 : 6)
  m.setU32((pNode + 0x14) >>> 0, pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff)
  m.setU32((pNode + 0x20) >>> 0, nX >>> 0)
  m.setU32((pNode + 0x24) >>> 0, nY >>> 0)
  if (pTargetUnit !== 0) {
    m.setU32((pNode + 0x18) >>> 0, m.u32(pTargetUnit >>> 0) >>> 0)
    m.setU32((pNode + 0x1c) >>> 0, m.u32((pTargetUnit + 0x0c) >>> 0) >>> 0)
  } else {
    m.setU32((pNode + 0x1c) >>> 0, 0xffffffff)
  }
  appendUnitEventMsgNode113c(m, pUnit >>> 0, pNode)
}

/**
 * Validates `wStatId < 0xFF` (`bx`), allocates a 20-byte (`0x14`) unit message node of type `0x9E`
 * (`S2C_MERC_BYTE_STAT`) for `pUnit` (`esi`), and appends to `pUnit` (`ret 0x4`).
 *
 * @va D2Game:0x6FC9A3A0
 */
export function UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  wStatId: number,
  dwStatValue: number,
): void {
  hitD2GameVa113c(0x6FC9A3A0)
  if ((wStatId & 0xffff) >= 0xff) {
    throw new D2CommonAssertError('0x6fc9a3a0: wStatId >= 0xff', 682)
  }
  const pNode = m.alloc(0x14)
  m.setU32(pNode, 0)
  m.setU8((pNode + 0x04) >>> 0, 0x9e)
  m.setU32((pNode + 0x08) >>> 0, pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff)
  m.setU8((pNode + 0x0c) >>> 0, wStatId & 0xff)
  m.setU32((pNode + 0x10) >>> 0, dwStatValue >>> 0)
  appendUnitEventMsgNode113c(m, pUnit >>> 0, pNode)
}

/**
 * Allocates a 20-byte (`0x14`) unit message node of type `0x9A` (`S2C_SYNC_COORDS_9A`) for
 * `pUnit` (`esi`), populates coordinates and flags, and appends to `pUnit` (`ret 0x14`).
 *
 * @va D2Game:0x6FC9A440
 */
export function UNITMSG_QueuePacket9ACoords_6FC9A440_113c(
  m: D2KernMemory113c,
  pUnit: number,
  wX: number,
  bByte0A: number,
  wY: number,
  wWord0E: number,
  bByte10: number,
): void {
  hitD2GameVa113c(0x6FC9A440)
  const pNode = m.alloc(0x14)
  m.setU32(pNode, 0)
  m.setU8((pNode + 0x04) >>> 0, 0x9a)
  m.setU16((pNode + 0x08) >>> 0, wX & 0xffff)
  m.setU8((pNode + 0x0a) >>> 0, bByte0A & 0xff)
  m.setU16((pNode + 0x0c) >>> 0, wY & 0xffff)
  m.setU16((pNode + 0x0e) >>> 0, wWord0E & 0xffff)
  m.setU8((pNode + 0x10) >>> 0, bByte10 & 0xff)
  appendUnitEventMsgNode113c(m, pUnit >>> 0, pNode)
}

/**
 * Queries stat `0xB2` (`178`) on `pUnit`'s (`esi`) `0x80`-flagged stat list and, when within
 * `[0, sgptDataTables->nMonModeTxtCount (+0xBC0)]`, queues an 8-byte `0x11` packet to `pClient` (`ret 0x4`).
 *
 * @va D2Game:0x6FC9A570
 */
export function UNIT_SendStatB2Packet11ToClient_6FC9A570_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC9A570)
  const pStatList = STATLIST_GetStatListFromUnitAndFlag113c(m, pUnit >>> 0, 0x80) >>> 0
  if (pStatList === 0) {
    return
  }
  const nVal = STATLIST_GetTotalStatValueLayer0_113c(m, pStatList, 0xb2) | 0
  if (nVal < 0) {
    return
  }
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pSgptPtr !== 0 ? m.u32(pSgptPtr) >>> 0 : 0
  if (nVal > (m.u32((pDataTables + 0xbc0) >>> 0) | 0)) {
    return
  }
  const dwUnitType = pUnit !== 0 ? m.u32(pUnit >>> 0) >>> 0 : 6
  const dwUnitId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff

  const sp = (k2W3B8StackPtr - 8) >>> 0
  k2W3B8StackPtr = sp
  try {
    m.setU8(sp, 0x11)
    m.setU8((sp + 1) >>> 0, dwUnitType & 0xff)
    m.setU32((sp + 2) >>> 0, dwUnitId)
    m.setU16((sp + 6) >>> 0, nVal & 0xffff)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, sp, 8)
  } finally {
    k2W3B8StackPtr = (sp + 8) >>> 0
  }
}

/**
 * Radius scan callback (`edx = pUnit`, `[esp+4] = pCandidate`, `[esp+8] = pCtx`, `ret 0x8`):
 * selects the nearest alive player or monster (`dwUnitType == 0 || 1`) whose current life (`stat 6`)
 * is `<= (maxLife / 100) * pCtx->nLifePctThreshold (+0x08)`, storing `(pCandidate, sqDist)` at `pCtx + 0x00..+0x04`.
 *
 * @va D2Game:0x6FC9B860
 */
export function AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pCandidate: number,
  pCtx: number,
): number {
  hitD2GameVa113c(0x6FC9B860)
  if (pCandidate === 0) {
    return 0
  }
  const dwType = m.u32(pCandidate >>> 0) | 0
  if (dwType !== 1 && dwType !== 0) {
    return 0
  }
  if ((pUnit >>> 0) === (pCandidate >>> 0)) {
    return 0
  }
  if ((MONSTERS_IsDead113c(m, pCandidate >>> 0) | 0) !== 0) {
    return 0
  }
  const sqDist = UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pCandidate >>> 0) | 0
  if (sqDist > (m.u32((pCtx + 0x04) >>> 0) | 0)) {
    return 0
  }
  const curLife = STATLIST_GetUnitStat113c(m, pCandidate >>> 0, 6, 0) | 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pCandidate >>> 0) | 0
  const threshold = Math.imul(Math.trunc(maxLife / 100), m.u32((pCtx + 0x08) >>> 0) | 0)
  if (curLife <= threshold) {
    m.setU32(pCtx >>> 0, pCandidate >>> 0)
    m.setU32((pCtx + 0x04) >>> 0, sqDist >>> 0)
  }
  return 0
}

/**
 * Radius scan callback (`edx = pUnit`, `[esp+4] = pCandidate`, `[esp+8] = pCtx`, `ret 0x8`):
 * scans aligned monsters within `pCtx->nMaxSqDist (+0x10)` for corpse resurrection (`pCtx + 0x00`,
 * `dwAnimMode == 12`) or wounded healing (`pCtx + 0x04`, `curLife != maxLife`).
 *
 * @va D2Game:0x6FC9B8E0
 */
export function AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pCandidate: number,
  pCtx: number,
): number {
  hitD2GameVa113c(0x6FC9B8E0)
  if (pCandidate === 0) {
    return 0
  }
  if ((m.u32(pCandidate >>> 0) | 0) !== 1) {
    return 0
  }
  if ((pUnit >>> 0) === (pCandidate >>> 0)) {
    return 0
  }
  if ((UNITS_AreUnitsAligned113c(m, pUnit >>> 0, pCandidate >>> 0) | 0) === 0) {
    return 0
  }
  if ((UNIT_GetAlignment113c(m, pCandidate >>> 0) | 0) === 2) {
    return 0
  }
  if (((m.u32((pCandidate + 0xc4) >>> 0) >>> 1) & 1) === 0) {
    return 0
  }
  if ((STATES_CheckStateMask33OnUnit113c(m, pCandidate >>> 0) | 0) !== 0) {
    return 0
  }
  const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, m.u32((pCandidate + 0x04) >>> 0) | 0) >>> 0
  if ((m.u32((pCtx + 0x14) >>> 0) | 0) !== 0) {
    if ((MONSTERS_IsDemonOrUndead113c(m, pCandidate >>> 0) | 0) === 0) {
      return 0
    }
  } else {
    const bAlignFlags = m.u8((pMonStatsTxt + 0x0d) >>> 0)
    const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
    if ((m.u8((pAlignTable + 0x0c) >>> 0) & bAlignFlags) === 0) {
      return 0
    }
  }
  if ((m.u32((pCtx + 0x18) >>> 0) | 0) === 0) {
    if ((MONSTER_CheckTypeFlagsMask113c(m, pCandidate >>> 0, 8) | 0) !== 0) {
      return 0
    }
  }
  const sqDist = UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pCandidate >>> 0) | 0
  if (sqDist > (m.u32((pCtx + 0x10) >>> 0) | 0)) {
    return 0
  }
  m.setU32((pCtx + 0x0c) >>> 0, ((m.u32((pCtx + 0x0c) >>> 0) | 0) + 1) >>> 0)
  if ((m.u32((pCandidate + 0x10) >>> 0) | 0) === 0x0c) {
    if ((STATES_CheckStateMask2OnUnit113c(m, pCandidate >>> 0) | 0) === 0) {
      const nCount = ((m.u32((pCtx + 0x08) >>> 0) | 0) + 1) >>> 0
      m.setU32(pCtx >>> 0, pCandidate >>> 0)
      m.setU32((pCtx + 0x08) >>> 0, nCount)
      return 0
    }
  }
  const curLife = STATLIST_GetUnitStat113c(m, pCandidate >>> 0, 6, 0) | 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pCandidate >>> 0) | 0
  if (maxLife === curLife) {
    return 0
  }
  if ((m.u32((pCandidate + 0x10) >>> 0) | 0) === 0) {
    return 0
  }
  const nCount = ((m.u32((pCtx + 0x08) >>> 0) | 0) + 1) >>> 0
  m.setU32((pCtx + 0x04) >>> 0, pCandidate >>> 0)
  m.setU32((pCtx + 0x08) >>> 0, nCount)
  return 0
}

/**
 * Radius scan callback (`edx = pUnit`, `[esp+4] = pCandidate`, `[esp+8] = pCtx`, `ret 0x8`):
 * locates the nearest aligned alive monster with `wBaseId == 0x136` (`310`, Zakarum Zealot)
 * within `pCtx->nMaxSqDist (+0x08)`, tracking closest overall (`pCtx + 0x00`/`+0x0C`) and closest
 * with `< 40%` life (`pCtx + 0x04`/`+0x10`).
 *
 * @va D2Game:0x6FC9BA40
 */
export function AI_ScanCallbackNearestBaseId136_6FC9BA40_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pCandidate: number,
  pCtx: number,
): number {
  hitD2GameVa113c(0x6FC9BA40)
  if ((pCandidate >>> 0) === (pUnit >>> 0) || pCandidate === 0) {
    return 0
  }
  if ((m.u32(pCandidate >>> 0) | 0) !== 1) {
    return 0
  }
  if ((MONSTERS_IsDead113c(m, pCandidate >>> 0) | 0) !== 0) {
    return 0
  }
  if (((m.u32((pCandidate + 0xc4) >>> 0) >>> 1) & 1) === 0) {
    return 0
  }
  const baseId = MONSTER_GetBaseIdFromUnit113c(m, pCandidate >>> 0) | 0
  if (baseId < 0) {
    return 0
  }
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pSgptPtr !== 0 ? m.u32(pSgptPtr) >>> 0 : 0
  if (baseId >= (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
    return 0
  }
  if (baseId !== 0x136) {
    return 0
  }
  const sqDist = UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pCandidate >>> 0) | 0
  if (sqDist > (m.u32((pCtx + 0x08) >>> 0) | 0)) {
    return 0
  }
  if ((UNITS_AreUnitsAligned113c(m, pUnit >>> 0, pCandidate >>> 0) | 0) === 0) {
    return 0
  }
  if ((UNIT_GetAlignment113c(m, pCandidate >>> 0) | 0) !== 0) {
    return 0
  }
  if (sqDist < (m.u32((pCtx + 0x0c) >>> 0) | 0)) {
    m.setU32(pCtx >>> 0, pCandidate >>> 0)
    m.setU32((pCtx + 0x0c) >>> 0, sqDist >>> 0)
  }
  if (sqDist < (m.u32((pCtx + 0x10) >>> 0) | 0)) {
    if ((STATLIST_GetUnitLifePercent113c(m, pCandidate >>> 0) | 0) < 0x28) {
      m.setU32((pCtx + 0x04) >>> 0, pCandidate >>> 0)
      m.setU32((pCtx + 0x10) >>> 0, sqDist >>> 0)
    }
  }
  return 0
}

/**
 * Radius scan callback (`edx = pUnit`, `[esp+4] = pCandidate`, `[esp+8] = pCtx`, `ret 0x8`):
 * locates the nearest dead unaligned-0 monster corpse with `MonStats2` flag bit `0x0C` (`bCorpseSel`)
 * and `STATES_CheckStateMask33OnUnit == 0`, updating `(pCtx + 0x00, pCtx + 0x04)`.
 *
 * @va D2Game:0x6FC9BB00
 */
export function AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pCandidate: number,
  pCtx: number,
): number {
  hitD2GameVa113c(0x6FC9BB00)
  if ((pUnit >>> 0) === (pCandidate >>> 0) || pCandidate === 0) {
    return 0
  }
  if ((m.u32(pCandidate >>> 0) | 0) !== 1) {
    return 0
  }
  const dwFlagsC4 = m.u32((pCandidate + 0xc4) >>> 0) >>> 0
  if (((dwFlagsC4 >>> 9) & 1) !== 0) {
    return 0
  }
  if (((dwFlagsC4 >>> 1) & 1) === 0) {
    return 0
  }
  if ((MONSTERS_IsDead113c(m, pCandidate >>> 0) | 0) === 0) {
    return 0
  }
  if ((STATES_CheckStateMask33OnUnit113c(m, pCandidate >>> 0) | 0) !== 0) {
    return 0
  }
  if ((UNIT_GetAlignment113c(m, pCandidate >>> 0) | 0) !== 0) {
    return 0
  }
  if ((MONSTATS2_CheckFlagBit113c(m, m.u32((pCandidate + 0x04) >>> 0) | 0, 0x0c) | 0) === 0) {
    return 0
  }
  const sqDist = UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pCandidate >>> 0) | 0
  if (sqDist <= (m.u32((pCtx + 0x04) >>> 0) | 0)) {
    m.setU32(pCtx >>> 0, pCandidate >>> 0)
    m.setU32((pCtx + 0x04) >>> 0, sqDist >>> 0)
  }
  return 0
}

/**
 * Radius scan callback (`edx = pUnit`, `[esp+4] = pCandidate`, `[esp+8] = pCtx`, `ret 0x8`):
 * locates the nearest Fetish/Soul Killer minion (`wBaseId == 0x8D || 0x18C`) for Shaman AI,
 * tracking nearest corpse (`dwAnimMode == 12`, `pCtx + 0x00`/`+0x04`) and nearest alive minion
 * (`pCtx + 0x0C`/`+0x10`, count at `pCtx + 0x14`).
 *
 * @va D2Game:0x6FC9BB90
 */
export function AI_ScanCallbackFetishMinions_6FC9BB90_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pCandidate: number,
  pCtx: number,
): number {
  hitD2GameVa113c(0x6FC9BB90)
  if ((pUnit >>> 0) === (pCandidate >>> 0) || pCandidate === 0) {
    return 0
  }
  if ((m.u32(pCandidate >>> 0) | 0) !== 1) {
    return 0
  }
  if (((m.u32((pCandidate + 0xc4) >>> 0) >>> 1) & 1) === 0) {
    return 0
  }
  if ((STATES_CheckStateMask33OnUnit113c(m, pCandidate >>> 0) | 0) !== 0) {
    return 0
  }
  if ((m.u32((pCtx + 0x18) >>> 0) | 0) === 0) {
    if ((AIGENERAL_GetPackLeaderUnit113c(m, pCandidate >>> 0) >>> 0) !== (pUnit >>> 0)) {
      return 0
    }
  }
  const baseId =
    MONSTATS_ValidateClassId113c(m, MONSTER_GetBaseIdFromUnit113c(m, pCandidate >>> 0) | 0) | 0
  if (baseId !== 0x8d) {
    if (baseId !== 0x18c) {
      return 0
    }
    if ((m.u32((pCtx + 0x18) >>> 0) | 0) === 1) {
      return 0
    }
  }
  if ((UNIT_GetAlignment113c(m, pCandidate >>> 0) | 0) !== 0) {
    return 0
  }
  if ((m.u32((pCtx + 0x18) >>> 0) | 0) < 3) {
    if ((MONSTER_CheckTypeFlagsMask113c(m, pCandidate >>> 0, 0x0c) | 0) !== 0) {
      return 0
    }
  }
  const sqDist = UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pCandidate >>> 0) | 0
  if (sqDist > (m.u32((pCtx + 0x08) >>> 0) | 0)) {
    return 0
  }
  if ((m.u32((pCandidate + 0x10) >>> 0) | 0) === 0x0c) {
    if (sqDist < (m.u32((pCtx + 0x04) >>> 0) | 0)) {
      m.setU32(pCtx >>> 0, pCandidate >>> 0)
      m.setU32((pCtx + 0x04) >>> 0, sqDist >>> 0)
    }
    return 0
  }
  const newCount = ((m.u32((pCtx + 0x14) >>> 0) | 0) + 1) >>> 0
  const prevBestDist = m.u32((pCtx + 0x10) >>> 0) | 0
  m.setU32((pCtx + 0x14) >>> 0, newCount)
  if (sqDist < prevBestDist) {
    m.setU32((pCtx + 0x0c) >>> 0, pCandidate >>> 0)
    m.setU32((pCtx + 0x10) >>> 0, sqDist >>> 0)
  }
  return 0
}

function stepUnitSeed64113c(m: D2KernMemory113c, pUnit: number): number {
  const pSeed = (pUnit + 0x20) >>> 0
  const lo = m.u32(pSeed) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, newHi)
  m.setU32(pSeed, newLo)
  return newLo
}

function getUnitPathCoordXInline113c(m: D2KernMemory113c, pUnit: number): number {
  const dwType = m.u32(pUnit >>> 0) | 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    return m.u32((pPath + 0x0c) >>> 0) | 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function getUnitPathCoordYInline113c(m: D2KernMemory113c, pUnit: number): number {
  const dwType = m.u32(pUnit >>> 0) | 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    return m.u32((pPath + 0x10) >>> 0) | 0
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

function triggerMonsterSelfDeathMode0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): void {
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x20000) >>> 0)
  }
  SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
  const sp = (k2W3B8StackPtr - 0x20) >>> 0
  k2W3B8StackPtr = sp
  try {
    for (let off = 0; off < 0x20; off += 4) {
      m.setU32((sp + off) >>> 0, 0)
    }
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
    m.setU8((sp + 0x15) >>> 0, 0x64)
    hitD2GameVa113c(0x6FC95E10)
    MONSTER_StartModeReal113c(m, pGame >>> 0, pUnit >>> 0, 0, 0, 0, 0)
  } finally {
    k2W3B8StackPtr = (sp + 0x20) >>> 0
  }
}

/**
 * Radius scan callback (`edx = pUnit`, `[esp+4] = pCandidate`, `[esp+8] = pCtx`, `ret 0x8`):
 * locates the lowest-life aligned alive monster with `wBaseId == 0xEB` (`235`) or `0xEE` (`238`)
 * and `lifePct <= 60` (`0x3C`) within `pCtx->nMaxSqDist (+0x0C)`.
 *
 * @va D2Game:0x6FC9BC70
 */
export function AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pCandidate: number,
  pCtx: number,
): number {
  hitD2GameVa113c(0x6FC9BC70)
  if ((pUnit >>> 0) === (pCandidate >>> 0) || pCandidate === 0) {
    return 0
  }
  if ((m.u32(pCandidate >>> 0) | 0) !== 1) {
    return 0
  }
  if ((UNITS_AreUnitsAligned113c(m, pUnit >>> 0, pCandidate >>> 0) | 0) === 0) {
    return 0
  }
  if ((UNIT_GetAlignment113c(m, pCandidate >>> 0) | 0) === 2) {
    return 0
  }
  if ((MONSTERS_IsDead113c(m, pCandidate >>> 0) | 0) !== 0) {
    return 0
  }
  const baseId =
    MONSTATS_ValidateClassId113c(m, MONSTER_GetBaseIdFromUnit113c(m, pCandidate >>> 0) | 0) | 0
  if (baseId !== 0xeb && baseId !== 0xee) {
    return 0
  }
  const sqDist = UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pCandidate >>> 0) | 0
  if (sqDist > (m.u32((pCtx + 0x0c) >>> 0) | 0)) {
    return 0
  }
  const lifePct = STATLIST_GetUnitLifePercent113c(m, pCandidate >>> 0) | 0
  if (lifePct > 0x3c) {
    return 0
  }
  if ((m.u32((pCtx + 0x08) >>> 0) | 0) <= 0) {
    m.setU32((pCtx + 0x08) >>> 0, 0x7fffffff)
  }
  const newCount = ((m.u32((pCtx + 0x04) >>> 0) | 0) + 1) >>> 0
  const bestThreshold = m.u32((pCtx + 0x08) >>> 0) | 0
  m.setU32((pCtx + 0x04) >>> 0, newCount)
  if (lifePct < bestThreshold) {
    m.setU32(pCtx >>> 0, pCandidate >>> 0)
  }
  return 0
}

/**
 * Unburrows or activates submerged monster `pUnit` (`esi`) in `pGame` (`eax`):
 * clears `dwFlags & ~0x0E`, clears subtile masks `0x1000` and `0x0100`, sets collision pattern `5`
 * and move-test mask `0`, frees existing `EVENT_AITHINK` (`2`) nodes, and schedules event `2` at `dwGameFrame + 12`.
 *
 * @va D2Game:0x6FC9BE10
 */
export function AI_UnburrowAndScheduleThink_6FC9BE10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC9BE10)
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) & 0xfffffff1) >>> 0)
  }
  const y1 = getUnitPathCoordYInline113c(m, pUnit)
  const x1 = getUnitPathCoordXInline113c(m, pUnit)
  const pRoom1 = UNITS_GetRoom113c(m, pUnit >>> 0)
  COLLISION_ClearSubtileMask113c(m, pRoom1, x1, y1, 0x1000)

  const y2 = getUnitPathCoordYInline113c(m, pUnit)
  const x2 = getUnitPathCoordXInline113c(m, pUnit)
  const pRoom2 = UNITS_GetRoom113c(m, pUnit >>> 0)
  COLLISION_ClearSubtileMask113c(m, pRoom2, x2, y2, 0x0100)

  PATH_SetUnitCollisionPattern113c(m, pUnit >>> 0, 5)
  PATH_SetMoveTestCollisionMask113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0, 0)

  let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
  while (pEvent !== 0) {
    const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
    if (m.u8(pEvent) === 2) {
      EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
    }
    pEvent = pNext
  }

  const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x0c) >>> 0
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 2, targetFrame, 0, 0, 0)
}

/**
 * Stationary turret/trap melee AI callback (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * stalls `40` frames when out of melee range; otherwise rolls `aip1[diff]` to start `MONMODE_ATTACK1 (4)`
 * or stalls `aip2[diff]` frames.
 *
 * @va D2Game:0x6FC9BF50
 */
export function AI_StationaryMeleeTrap_6FC9BF50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9BF50)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  if (bInMeleeRange === 0) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x28)
    return
  }
  const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll = (newLo >>> 0) % 100
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
  if ((roll | 0) >= aip1) {
    const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip2)
    return
  }
  SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
  const sp = (k2W3B8StackPtr - 0x20) >>> 0
  k2W3B8StackPtr = sp
  try {
    for (let off = 0; off < 0x20; off += 4) {
      m.setU32((sp + off) >>> 0, 0)
    }
    m.setU32(sp, 4)
    m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
    let bAnimRate = 0x64
    if (pUnit !== 0) {
      const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
      if (pMonStats2 !== 0) {
        const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
        const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
        if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
          bAnimRate = 0x65
        }
      }
    }
    m.setU8((sp + 0x15) >>> 0, bAnimRate)
    m.setU32((sp + 0x08) >>> 0, pTarget)
    MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
  } finally {
    k2W3B8StackPtr = (sp + 0x20) >>> 0
  }
}

function runTentacleSkillCast113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  if (pTarget === 0) {
    triggerMonsterSelfDeathMode0_113c(m, pGame, pUnit)
    return
  }
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
  const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
  if (nDist > aip1 || (m.u32((pAiControl + 0x14) >>> 0) | 0) >= aip2) {
    triggerMonsterSelfDeathMode0_113c(m, pGame, pUnit)
    return
  }
  const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
  if (wSkill0 >= 0 && (m.u32((pAiControl + 0x18) >>> 0) | 0) === 0) {
    const bSeqMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
    AI_CastSkillWithMode113c(m, bSeqMode, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
    m.setU32((pAiControl + 0x14) >>> 0, ((m.u32((pAiControl + 0x14) >>> 0) | 0) + 1) >>> 0)
    m.setU32((pAiControl + 0x18) >>> 0, 1)
    return
  }
  m.setU32((pAiControl + 0x18) >>> 0, 0)
  const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip3)
}

/**
 * Tentacle / spire skill-cast AI callback (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * self-terminates (`mode 0`, `dwFlags |= 0x20000`) when `pTarget == 0`, `nDist > aip1[diff]`, or
 * `pAiControl->dwCount (+0x14) >= aip2[diff]`; otherwise alternates casting `Skill[0]` (`+0x170`) and stalling `aip3[diff]`.
 *
 * @va D2Game:0x6FC9C060
 */
export function AI_TentacleSkillCastA_6FC9C060_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9C060)
  runTentacleSkillCast113c(m, pGame, pUnit, pAiParam)
}

/**
 * Twin tentacle / spire skill-cast AI callback (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * identical machine-code twin of `0x6FC9C060`.
 *
 * @va D2Game:0x6FC9C1D0
 */
export function AI_TentacleSkillCastB_6FC9C1D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9C1D0)
  runTentacleSkillCast113c(m, pGame, pUnit, pAiParam)
}

/**
 * Horizontal-corridor wall trap AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * checks `aip1[diff] <= nDist <= aip2[diff]` and `abs(unitY - targetY) <= 2`, then either melee-attacks
 * (`MONSTER_GetOrRollRegionSubVariant != 1`) or casts `Skill[0]` (`+0x170`).
 *
 * @va D2Game:0x6FC9C340
 */
export function AI_WallTrapHorizontalY_6FC9C340_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9C340)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
  const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
  if (nDist < aip1 || nDist > aip2) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x28)
    return
  }
  const sp = (k2W3B8StackPtr - 0x10) >>> 0
  k2W3B8StackPtr = sp
  try {
    PATH_GetTargetTypeAndPosition113c(m, pUnit >>> 0, sp)
    PATH_GetTargetTypeAndPosition113c(m, pTarget, (sp + 8) >>> 0)
    const dy = Math.abs((m.u32((sp + 4) >>> 0) | 0) - (m.u32((sp + 12) >>> 0) | 0))
    const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
    if (dy <= 2 && dwGameFrame > (m.u32((pAiControl + 0x14) >>> 0) | 0)) {
      const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
      m.setU32((pAiControl + 0x14) >>> 0, (dwGameFrame + aip3) >>> 0)
      const subVar = MONSTER_GetOrRollRegionSubVariant113c(m, pUnit >>> 0, pGame >>> 0) | 0
      if (subVar !== 1) {
        AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pTarget)
        return
      }
      const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
      if (wSkill0 >= 0) {
        const aip4 = (m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0) << 16) >> 16
        m.setU32((pAiControl + 0x1c) >>> 0, (dwGameFrame + aip4) >>> 0)
        const bSeqMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
        return
      }
    }
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x1e)
  } finally {
    k2W3B8StackPtr = (sp + 0x10) >>> 0
  }
}

/**
 * Vertical-corridor wall trap AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * checks `aip1[diff] <= nDist <= aip2[diff]` and `abs(unitX - targetX) <= 2`, then either melee-attacks
 * (`MONSTER_GetOrRollRegionSubVariant != 1`) or casts `Skill[0]` (`+0x170`).
 *
 * @va D2Game:0x6FC9C460
 */
export function AI_WallTrapVerticalX_6FC9C460_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9C460)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
  const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
  if (nDist < aip1 || nDist > aip2) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x28)
    return
  }
  const sp = (k2W3B8StackPtr - 0x10) >>> 0
  k2W3B8StackPtr = sp
  try {
    PATH_GetTargetTypeAndPosition113c(m, pUnit >>> 0, sp)
    PATH_GetTargetTypeAndPosition113c(m, pTarget, (sp + 8) >>> 0)
    const dx = Math.abs((m.u32(sp) | 0) - (m.u32((sp + 8) >>> 0) | 0))
    const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
    if (dx <= 2 && dwGameFrame > (m.u32((pAiControl + 0x14) >>> 0) | 0)) {
      const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
      m.setU32((pAiControl + 0x14) >>> 0, (dwGameFrame + aip3) >>> 0)
      const subVar = MONSTER_GetOrRollRegionSubVariant113c(m, pUnit >>> 0, pGame >>> 0) | 0
      if (subVar !== 1) {
        AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pTarget)
        return
      }
      const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
      if (wSkill0 >= 0) {
        const aip4 = (m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0) << 16) >> 16
        m.setU32((pAiControl + 0x1c) >>> 0, (dwGameFrame + aip4) >>> 0)
        const bSeqMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
        return
      }
    }
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x1e)
  } finally {
    k2W3B8StackPtr = (sp + 0x10) >>> 0
  }
}

/**
 * Tentacle melee-attack AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * self-terminates (`mode 0`, `dwFlags |= 0x20000`) when `pTarget == 0`, `nDist > aip1[diff]`, or
 * `pAiControl->dwCount (+0x14) >= aip2[diff]`; otherwise alternates `AI_StartAttackMode(4)` and `AI_Stall(aip3[diff])`.
 *
 * @va D2Game:0x6FC9C580
 */
export function AI_TentacleMeleeAttack_6FC9C580_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9C580)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  if (pTarget === 0) {
    triggerMonsterSelfDeathMode0_113c(m, pGame, pUnit)
    return
  }
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
  const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
  if (nDist > aip1 || (m.u32((pAiControl + 0x14) >>> 0) | 0) >= aip2) {
    triggerMonsterSelfDeathMode0_113c(m, pGame, pUnit)
    return
  }
  if ((m.u32((pAiControl + 0x18) >>> 0) | 0) === 0) {
    AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pTarget)
    m.setU32((pAiControl + 0x14) >>> 0, ((m.u32((pAiControl + 0x14) >>> 0) | 0) + 1) >>> 0)
    m.setU32((pAiControl + 0x18) >>> 0, 1)
    return
  }
  m.setU32((pAiControl + 0x18) >>> 0, 0)
  const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip3)
}

/**
 * Searches 8 compass directions around `pUnit` (`ecx`) starting from the direction toward `pTarget` (`eax`)
 * for a free 3-subtile offset tile able to spawn class `0x12A` (`298`), casting `pMonStatsTxt->wSkill[0]`
 * (`+0x170`) at `(spawnX, spawnY)` and returning `1` when found (`ret 0x8`).
 *
 * @va D2Game:0x6FC9C6E0
 */
export function AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c(
  m: D2KernMemory113c,
  pTarget: number,
  pUnit: number,
  pMonStatsTxt: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC9C6E0)
  const targetY = getUnitPathCoordYInline113c(m, pTarget)
  const targetX = getUnitPathCoordXInline113c(m, pTarget)
  const rawDir = UNITS_GetDirectionToCoords113c(m, pUnit >>> 0, targetX, targetY) & 0xff
  let curDir = DATATBLS_NormalizeDirection113c(m, rawDir) & 0xff
  const dirTable = [6, 4, 2, 2, 2, 0, 6, 6] as const

  const sp = (k2W3B8StackPtr - 0x10) >>> 0
  k2W3B8StackPtr = sp
  try {
    for (let i = 0; i < 8; i++) {
      curDir = curDir & 7
      const mappedDir = dirTable[curDir]!
      DATATBLS_GetDirectionOffset113c(m, mappedDir, sp, (sp + 4) >>> 0)
      const dx = m.u32(sp) | 0
      const dy = m.u32((sp + 4) >>> 0) | 0
      const unitX = getUnitPathCoordXInline113c(m, pUnit)
      const unitY = getUnitPathCoordYInline113c(m, pUnit)
      const spawnX = (unitX + dx * 3) | 0
      const spawnY = (unitY + dy * 3) | 0

      const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
      const pDataTables = pSgptPtr !== 0 ? m.u32(pSgptPtr) >>> 0 : 0
      const nMonCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
      const spawnClassId = nMonCount > 0x12a ? 0x12a : -1

      const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
      if (wSkill0 >= 0) {
        const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0)
        if ((MONSTER_CheckSpawnTileFree113c(m, pRoom, spawnClassId, spawnY, spawnX, 0) | 0) !== 0) {
          const bSeqMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
          AI_CastSkillWithMode113c(
            m,
            bSeqMode,
            pUnit >>> 0,
            pGame >>> 0,
            wSkill0,
            0,
            spawnX,
            spawnY,
          )
          return 1
        }
      }
      curDir = (curDir + 1) & 0xff
    }
    return 0
  } finally {
    k2W3B8StackPtr = (sp + 0x10) >>> 0
  }
}

/**
 * Axis-aligned beam turret / Gargoyle Trap AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * snaps `pUnit`'s facing direction along the dominant cardinal axis toward `pTarget` via `.rdata` tables
 * `0x6FD1BB10` / `0x6FD1BB08`, and casts `Skill[0]` (`+0x170`) when aligned within `6` subtiles.
 *
 * @va D2Game:0x6FC9C910
 */
export function AI_CardinalBeamTurret_6FC9C910_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9C910)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pendingStall = m.u32((pAiControl + 0x14) >>> 0) | 0
  if (pendingStall > 0) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, pendingStall)
    m.setU32((pAiControl + 0x14) >>> 0, 0)
    return
  }
  UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit >>> 0, pTarget)
  const targetX = getUnitPathCoordXInline113c(m, pTarget)
  const targetY = getUnitPathCoordYInline113c(m, pTarget)
  const unitX = getUnitPathCoordXInline113c(m, pUnit)
  const unitY = getUnitPathCoordYInline113c(m, pUnit)
  const absDx = Math.abs((targetX - unitX) | 0)
  const absDy = Math.abs((targetY - unitY) | 0)
  const lookX = absDx >= absDy ? targetX : unitX
  const lookY = absDx >= absDy ? unitY : targetY

  const rawDir = UNITS_GetDirectionToCoords113c(m, pUnit >>> 0, lookX, lookY) & 0xff
  const dirIdx = m.u8((rawDir + 0x6fd1bb10) >>> 0)
  const forcedDir = m.u8((dirIdx + 0x6fd1bb08) >>> 0)
  PATH_ForceDirection113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0, forcedDir)

  const diff = m.u8((pGame + 0x6d) >>> 0)
  if (absDx < 6 || absDy < 6) {
    const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
    if (wSkill0 >= 0) {
      const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
      if (nDist < aip1) {
        const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
        const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
        if (roll < aip2) {
          const bSeqMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
          AI_CastSkillWithMode113c(m, bSeqMode, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
          const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
          m.setU32((pAiControl + 0x14) >>> 0, aip3 >>> 0)
          return
        }
      }
    }
  }
  const aip4 = (m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip4)
}

/**
 * Wake-of-Destruction / Baal Minion / Linked-Owner Turret AI (`ecx = pGame`, `edx = pUnit`,
 * `[esp+4] = pAiParam`, `ret 0x4`): validates owner unit via `pAiGeneral + 0x28..+0x30`, kills self
 * if owner is missing or dead (`40%` roll when owner in mode `12`), and cycles between `Skill[0]` (`+0x170`),
 * `Skill[1]` (`+0x172`), melee attack (`mode 4`), and timed AI think delays.
 *
 * @va D2Game:0x6FC9CB10
 */
export function AI_LinkedOwnerTurretCycle_6FC9CB10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9CB10)
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0

  let pOwner = 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGeneral !== 0 && m.u32((pAiGeneral + 0x28) >>> 0) !== 0) {
        const dwOwnerId = m.u32((pAiGeneral + 0x2c) >>> 0) >>> 0
        const dwOwnerType = m.u32((pAiGeneral + 0x30) >>> 0) >>> 0
        pOwner = SUNIT_GetServerUnit113c(m, pGame >>> 0, dwOwnerType, dwOwnerId) >>> 0
      }
    }
  }
  if (pOwner === 0) {
    SUNITDMG_DistributeExperience113c(m, pGame >>> 0, 0, pUnit >>> 0)
    return
  }

  const ownerMode = m.u32((pOwner + 0x10) >>> 0) | 0
  if (ownerMode === 0x0c) {
    const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
    if ((newLo >>> 0) % 100 < 0x28) {
      SUNIT_ValidatePathTargetUnit113c(m, pOwner, pGame >>> 0)
      let pKiller = PATH_GetTargetUnit113c(m, m.u32((pOwner + 0x2c) >>> 0) >>> 0) >>> 0
      if (pKiller === pOwner) {
        pKiller = 0
      }
      SUNITDMG_DistributeExperience113c(m, pGame >>> 0, pKiller, pUnit >>> 0)
      return
    }
  }

  const diff = m.u8((pGame + 0x6d) >>> 0)
  const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
  if (wSkill0 >= 0) {
    const nState = m.u32((pAiControl + 0x1c) >>> 0) | 0
    if (nState === 0) {
      const bSeqMode0 = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
      AI_CastSkillWithMode113c(m, bSeqMode0, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame >>> 0, pUnit >>> 0, 8)
      const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
      const nextFrame = (Math.imul(aip3, 25) + (m.u32((pGame + 0xa8) >>> 0) | 0)) >>> 0
      m.setU32((pAiControl + 0x18) >>> 0, nextFrame)
      m.setU32((pAiControl + 0x1c) >>> 0, 1)
      return
    }
    if (nState === 2 && (m.u32((pGame + 0xa8) >>> 0) | 0) > (m.u32((pAiControl + 0x18) >>> 0) | 0)) {
      const aip6 = (m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0) << 16) >> 16
      let doCast0 = false
      if (nDist <= aip6 && bInMeleeRange === 0) {
        const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
        const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
        if (roll < aip2) {
          doCast0 = true
        }
      }
      if (!doCast0 && ownerMode === 0x0e) {
        const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
        if (roll < 0x32) {
          doCast0 = true
        }
      }
      if (doCast0) {
        const bSeqMode0 = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode0, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
        AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame >>> 0, pUnit >>> 0, 8)
        const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
        const nextFrame = (Math.imul(aip3, 25) + (m.u32((pGame + 0xa8) >>> 0) | 0)) >>> 0
        m.setU32((pAiControl + 0x18) >>> 0, nextFrame)
        m.setU32((pAiControl + 0x1c) >>> 0, 1)
        return
      }
    }
  }

  const wSkill1 = (m.u16((pMonStatsTxt + 0x172) >>> 0) << 16) >> 16
  if (wSkill1 >= 0) {
    if ((m.u32((pAiControl + 0x1c) >>> 0) | 0) !== 1) {
      if (bInMeleeRange !== 0) {
        const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
        const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
        if (roll < aip1) {
          AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pTarget)
          return
        }
      }
      const aip5 = (m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0) << 16) >> 16
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip5)
      return
    }
    if ((m.u32((pGame + 0xa8) >>> 0) | 0) > (m.u32((pAiControl + 0x18) >>> 0) | 0)) {
      const aip6 = (m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0) << 16) >> 16
      let doCast1 = bInMeleeRange !== 0 || nDist < aip6
      if (!doCast1 && ownerMode !== 0x0e) {
        const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
        if (roll < 5) {
          doCast1 = true
        }
      }
      if (doCast1) {
        const bSeqMode1 = (m.u8((pMonStatsTxt + 0x181) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(
          m,
          bSeqMode1,
          pUnit >>> 0,
          pGame >>> 0,
          wSkill1,
          pUnit >>> 0,
          0,
          0,
        )
        const aip4 = (m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0) << 16) >> 16
        const nextFrame = (Math.imul(aip4, 25) + (m.u32((pGame + 0xa8) >>> 0) | 0)) >>> 0
        m.setU32((pAiControl + 0x18) >>> 0, nextFrame)
        m.setU32((pAiControl + 0x1c) >>> 0, 2)
        return
      }
    }
  }

  if ((m.u32((pAiControl + 0x1c) >>> 0) | 0) === 1) {
    const aip5 = (m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0) << 16) >> 16
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame >>> 0, pUnit >>> 0, aip5)
    return
  }

  if (bInMeleeRange !== 0) {
    const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
    const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
    if (roll < aip1) {
      AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pTarget)
      return
    }
  }
  const aip5 = (m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip5)
}

/**
 * Radius scan callback (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pCandidate`, `[esp+8] = pCtx`, `ret 0x8`):
 * evaluates hostile alive targetable units within `sqDist <= 0x400`, tracking total count (`+0x1C`),
 * close count within `0xE1` (`+0x08`), nearest overall (`+0x00`/`+0x04`), lowest whole HP (`+0x0C`/`+0x10`),
 * and nearest when `pUnit` is a player (`+0x14`/`+0x18`).
 *
 * @va D2Game:0x6FC9CF10
 */
export function AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pCandidate: number,
  pCtx: number,
): number {
  hitD2GameVa113c(0x6FC9CF10)
  if ((pUnit >>> 0) === (pCandidate >>> 0)) {
    return 0
  }
  if ((SUNIT_IsDeadOrDying113c(m, pCandidate >>> 0) | 0) !== 0) {
    return 0
  }
  if (pCandidate === 0) {
    return 0
  }
  if (((m.u32((pCandidate + 0xc4) >>> 0) >>> 2) & 1) === 0) {
    return 0
  }
  if (
    (SUNIT_AreUnitsHostileOrUnaligned113c(m, pCandidate >>> 0, pUnit >>> 0, pGame >>> 0) | 0) === 0
  ) {
    return 0
  }
  const sqDist = UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pCandidate >>> 0) | 0
  if (sqDist > 0x400) {
    return 0
  }
  m.setU32((pCtx + 0x1c) >>> 0, ((m.u32((pCtx + 0x1c) >>> 0) | 0) + 1) >>> 0)
  if (sqDist <= 0xe1) {
    m.setU32((pCtx + 0x08) >>> 0, ((m.u32((pCtx + 0x08) >>> 0) | 0) + 1) >>> 0)
  }
  if (sqDist < (m.u32((pCtx + 0x04) >>> 0) | 0)) {
    m.setU32(pCtx >>> 0, pCandidate >>> 0)
    m.setU32((pCtx + 0x04) >>> 0, sqDist >>> 0)
  }
  const hpWhole = (STATLIST_GetUnitStat113c(m, pCandidate >>> 0, 6, 0) | 0) >> 8
  if (hpWhole < (m.u32((pCtx + 0x10) >>> 0) | 0)) {
    m.setU32((pCtx + 0x0c) >>> 0, pCandidate >>> 0)
    m.setU32((pCtx + 0x10) >>> 0, hpWhole >>> 0)
  }
  if (sqDist < (m.u32((pCtx + 0x18) >>> 0) | 0) && pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 0) {
    m.setU32((pCtx + 0x14) >>> 0, pCandidate >>> 0)
    m.setU32((pCtx + 0x18) >>> 0, sqDist >>> 0)
  }
  return 0
}

/**
 * Mosquito Nest / Sucker Nest spawner AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * stalls `25` frames if `nDist > 25`, self-terminates when `pAiControl->dwSpawnCount (+0x18) > aip3[diff]`,
 * or checks tile clearance for class `0xE4` (`228`) and casts `Skill[0]` (`+0x170`).
 *
 * @va D2Game:0x6FC9CFD0
 */
export function AI_MosquitoNestSpawner_6FC9CFD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9CFD0)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  if (nDist > 0x19) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x19)
    return
  }
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
  if ((m.u32((pAiControl + 0x18) >>> 0) | 0) > aip3) {
    triggerMonsterSelfDeathMode0_113c(m, pGame, pUnit)
    return
  }
  const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  const frameDelta = Math.abs((dwGameFrame - (m.u32((pAiControl + 0x14) >>> 0) | 0)) | 0)
  const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
  if (wSkill0 >= 0) {
    const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
    if (frameDelta >= aip1) {
      const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
      const pDataTables = pSgptPtr !== 0 ? m.u32(pSgptPtr) >>> 0 : 0
      const nMonCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
      const spawnClassId = nMonCount > 0xe4 ? 0xe4 : -1
      const posY = UNIT_GetPosY113c(m, pUnit >>> 0) | 0
      const posX = UNIT_GetPosX113c(m, pUnit >>> 0) | 0
      const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0)
      if ((MONSTER_CheckSpawnTileFree113c(m, pRoom, spawnClassId, posY, posX, 0) | 0) !== 0) {
        m.setU32((pAiControl + 0x18) >>> 0, ((m.u32((pAiControl + 0x18) >>> 0) | 0) + 1) >>> 0)
        m.setU32((pAiControl + 0x14) >>> 0, dwGameFrame >>> 0)
        const bSeqMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
        return
      }
    }
  }
  const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
  const delay = (((newLo >>> 0) % 10) + 0x14) | 0
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, delay)
}

/**
 * Foul Crow Nest spawner AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * stalls `25` frames if `nDist > 20`, self-terminates when `pAiControl->dwSpawnCount (+0x18) >= aip3[diff]`,
 * or updates `+0x14 = dwGameFrame`, checks tile clearance for class `0xCE` (`206`), and casts `Skill[0]` (`+0x170`).
 *
 * @va D2Game:0x6FC9D170
 */
export function AI_FoulCrowNestSpawner_6FC9D170_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9D170)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  if (nDist > 0x14) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x19)
    return
  }
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
  if ((m.u32((pAiControl + 0x18) >>> 0) | 0) >= aip3) {
    triggerMonsterSelfDeathMode0_113c(m, pGame, pUnit)
    return
  }
  const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  const frameDelta = Math.abs((dwGameFrame - (m.u32((pAiControl + 0x14) >>> 0) | 0)) | 0)
  const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
  if (wSkill0 >= 0) {
    const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
    if (frameDelta >= aip1) {
      m.setU32((pAiControl + 0x14) >>> 0, dwGameFrame >>> 0)
      const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
      const pDataTables = pSgptPtr !== 0 ? m.u32(pSgptPtr) >>> 0 : 0
      const nMonCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
      const spawnClassId = nMonCount > 0xce ? 0xce : -1
      const posY = UNIT_GetPosY113c(m, pUnit >>> 0) | 0
      const posX = UNIT_GetPosX113c(m, pUnit >>> 0) | 0
      const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0)
      if ((MONSTER_CheckSpawnTileFree113c(m, pRoom, spawnClassId, posY, posX, 0) | 0) !== 0) {
        m.setU32((pAiControl + 0x18) >>> 0, ((m.u32((pAiControl + 0x18) >>> 0) | 0) + 1) >>> 0)
        const bSeqMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
        return
      }
    }
  }
  const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
  const delay = (((newLo >>> 0) % 10) + 0x14) | 0
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, delay)
}

/**
 * Single-shot trap / suicide skill caster AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * rolls `aip2[diff]` to cast `Skill[0]` (`+0x170`), sets `pAiControl + 0x14 = 1`, and on the next tick
 * resolves path target and awards kill/death via `0x6FCFEEE0`.
 *
 * @va D2Game:0x6FC9D310
 */
export function AI_OneShotSkillTrap_6FC9D310_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9D310)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
  const diff = m.u8((pGame + 0x6d) >>> 0)
  if (wSkill0 >= 0) {
    if ((m.u32((pAiControl + 0x14) >>> 0) | 0) !== 1) {
      const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
      const roll = (newLo >>> 0) % 100
      const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
      if ((roll | 0) < aip2) {
        const bSeqMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
        const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
        AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame >>> 0, pUnit >>> 0, aip1)
        m.setU32((pAiControl + 0x14) >>> 0, 1)
        return
      }
    }
  }
  if ((m.u32((pAiControl + 0x14) >>> 0) | 0) === 1) {
    SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
    let pKiller = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0) >>> 0
    if (pKiller === (pUnit >>> 0)) {
      pKiller = 0
    }
    SUNITDMG_DistributeExperience113c(m, pGame >>> 0, pKiller, pUnit >>> 0)
  }
  const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip1)
}


function aiApproachTarget6FD12540(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nMode: number,
  nX: number,
  nY: number,
  nStepNum: number,
  dwFlags: number,
): number {
  let mode = nMode | 0
  if (mode === 0x0f && (STATES_CheckState113c(m, pUnit >>> 0, 0x3c) | 0) !== 0) {
    let pAiControl = 0
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    m.setU32((pAiControl + 0x18) >>> 0, 0)
    m.setU32((pAiControl + 0x1c) >>> 0, 0)
    m.setU8((pAiControl + 0x20) >>> 0, 0)
    mode = 2
  }
  PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0, nStepNum | 0)
  const sp = (k2W3B8StackPtr - 0x20) >>> 0
  k2W3B8StackPtr = sp
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit >>> 0, sp, mode)
    if (pTarget !== 0) {
      m.setU32((sp + 0x08) >>> 0, pTarget >>> 0)
    } else {
      m.setU32((sp + 0x0c) >>> 0, nX >>> 0)
      m.setU32((sp + 0x10) >>> 0, nY >>> 0)
    }
    const res =
      MONSTER_StartMode113c(
        m,
        pGame >>> 0,
        pUnit >>> 0,
        mode,
        pTarget >>> 0,
        nX | 0,
        nY | 0,
      ) | 0
    if (res !== 0) {
      return res
    }
    const flagsByte = dwFlags & 0xff
    if ((flagsByte & 4) !== 0) {
      let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
      while (pEvent !== 0) {
        const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
        if (m.u8(pEvent) === 2) {
          EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
        }
        pEvent = pNext
      }
    }
    if ((flagsByte & 1) !== 0 && pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
        if (pAiGeneral !== 0) {
          m.setU8((pAiGeneral + 8) >>> 0, (m.u8((pAiGeneral + 8) >>> 0) | 0x40) & 0xff)
        }
      }
    }
    if ((flagsByte & 2) !== 0) {
      const roll = (stepUnitSeed64113c(m, pUnit >>> 0) >>> 0) % 100
      if (roll < 0x46) {
        AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 4)
        return 1
      }
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
      return 1
    }
    return res
  } finally {
    k2W3B8StackPtr = (sp + 0x20) >>> 0
  }
}

/**
 * Random-offset ground skill caster AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * rolls `aip1[diff]` to cast `Skill[0]` (`+0x170`) at `(unitX - aip3 + rand(2*aip3), unitY - aip3 + rand(2*aip3))`,
 * or stalls `aip2[diff]` frames.
 *
 * @va D2Game:0x6FC9D400
 */
export function AI_CastSkillAtRandomOffsetAroundSelf_6FC9D400_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9D400)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const wSkill0Init = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
  if (wSkill0Init >= 0) {
    const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
    const roll = (newLo >>> 0) % 100
    const diff0 = m.u8((pGame + 0x6d) >>> 0)
    const aip1 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x56) >>> 0) << 16) >> 16
    if ((roll | 0) < aip1) {
      const unitX = getUnitPathCoordXInline113c(m, pUnit)
      const diff1 = m.u8((pGame + 0x6d) >>> 0)
      const aip3X = (m.u16((pMonStatsTxt + diff1 * 2 + 0x62) >>> 0) << 16) >> 16
      const randX = SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, aip3X << 1) | 0
      const diff2 = m.u8((pGame + 0x6d) >>> 0)
      const aip3XSub = (m.u16((pMonStatsTxt + diff2 * 2 + 0x62) >>> 0) << 16) >> 16
      const targetX = (randX + ((unitX - aip3XSub) | 0)) | 0

      const unitY = getUnitPathCoordYInline113c(m, pUnit)
      const diff3 = m.u8((pGame + 0x6d) >>> 0)
      const aip3Y = (m.u16((pMonStatsTxt + diff3 * 2 + 0x62) >>> 0) << 16) >> 16
      const randY = SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, aip3Y << 1) | 0
      const diff4 = m.u8((pGame + 0x6d) >>> 0)
      const aip3YSub = (m.u16((pMonStatsTxt + diff4 * 2 + 0x62) >>> 0) << 16) >> 16
      const targetY = (randY + ((unitY - aip3YSub) | 0)) | 0

      const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
      const bSeqMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
      AI_CastSkillWithMode113c(m, bSeqMode, pUnit >>> 0, pGame >>> 0, wSkill0, 0, targetX, targetY)
      return
    }
  }
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip2)
}

/**
 * Submerged / burrowed monster transition AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * if `dwAnimMode == 11`, sets `pAiControl + 0x14 = 1` and reschedules `EVENT_AITHINK (2)` at `dwGameFrame + 1`;
 * if `pAiControl + 0x14 == 4`, starts `mode 10` (`MONMODE_SKILL3`); otherwise reinitializes AI think fn and stalls `1`.
 *
 * @va D2Game:0x6FC9D550
 */
export function AI_SubmergedOrStuckTransition_6FC9D550_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9D550)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  if (pUnit !== 0 && (m.u32((pUnit + 0x10) >>> 0) | 0) === 0x0b) {
    m.setU32((pAiControl + 0x14) >>> 0, 1)
    let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pEvent !== 0) {
      const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
      if (m.u8(pEvent) === 2) {
        EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
      }
      pEvent = pNext
    }
    const nextFrame = (m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0
    EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 2, nextFrame, 0, 0, 0)
    return
  }
  if ((m.u32((pAiControl + 0x14) >>> 0) | 0) === 4) {
    m.setU32((pAiControl + 0x14) >>> 0, 1)
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    const sp = (k2W3B8StackPtr - 0x20) >>> 0
    k2W3B8StackPtr = sp
    try {
      for (let off = 0; off < 0x20; off += 4) {
        m.setU32((sp + off) >>> 0, 0)
      }
      m.setU32(sp, 0x0a)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      let bAnimRate = 0x64
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const bSubClass = m.u8((pMonStats2 + 0x105) >>> 0)
          const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
          if ((bSubClass & m.u32((pAlignTable + 0x08) >>> 0)) !== 0) {
            bAnimRate = 0x65
          }
        }
      }
      m.setU8((sp + 0x15) >>> 0, bAnimRate)
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 0x0a, 0, 0, 0)
    } finally {
      k2W3B8StackPtr = (sp + 0x20) >>> 0
    }
    return
  }
  AI_InitMonsterAiThinkFn113c(m, pUnit >>> 0)
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 1)
}

/**
 * Basic melee or step-approach AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * when in melee range, rolls `aip3[diff]` to attack (`mode 4`) or stalls `aip2[diff]`;
 * when out of melee range, rolls `aip1[diff]` to step 12 subtiles toward target (`0x6FD11D90`) or stalls `aip2[diff]`.
 *
 * @va D2Game:0x6FC9D7C0
 */
export function AI_BasicMeleeOrStepApproach_6FC9D7C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9D7C0)
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll = (newLo >>> 0) % 100
  const diff = m.u8((pGame + 0x6d) >>> 0)
  if (bInMeleeRange !== 0) {
    const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
    if ((roll | 0) >= aip3) {
      const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip2)
      return
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    const sp = (k2W3B8StackPtr - 0x20) >>> 0
    k2W3B8StackPtr = sp
    try {
      for (let off = 0; off < 0x20; off += 4) {
        m.setU32((sp + off) >>> 0, 0)
      }
      m.setU32(sp, 4)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      let bAnimRate = 0x64
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
          const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
          if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
            bAnimRate = 0x65
          }
        }
      }
      m.setU8((sp + 0x15) >>> 0, bAnimRate)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
    } finally {
      k2W3B8StackPtr = (sp + 0x20) >>> 0
    }
    return
  }
  const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
  if ((roll | 0) < aip1) {
    AI_StepRelativeToTargetUnit113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 0x0c, 2, 0)
    return
  }
  const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip2)
}

/**
 * Pack-broadcast or melee-approach AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * if `pUnit` has always-chase flag (`dwInteractType == 3 || 19`), broadcasts command `1` to minions and
 * attacks/approaches unconditionally; otherwise rolls `aip1[diff]`/`aip2[diff]` vs `aip3[diff]`/`aip4[diff]`.
 *
 * @va D2Game:0x6FC9D910
 */
export function AI_PackBroadcastOrMeleeApproach_6FC9D910_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9D910)
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0

  let isAlwaysChase = false
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const nInteractType = m.u32((pMonData + 0x54) >>> 0) | 0
      if (nInteractType === 3 || nInteractType === 0x13) {
        isAlwaysChase = true
      }
    }
  }

  if (isAlwaysChase) {
    const sp = (k2W3B8StackPtr - 0x20) >>> 0
    k2W3B8StackPtr = sp
    try {
      m.setU32((sp + 0x08) >>> 0, 1)
      m.setU32((sp + 0x0c) >>> 0, pTarget !== 0 ? m.u32(pTarget) >>> 0 : 6)
      m.setU32((sp + 0x10) >>> 0, pTarget !== 0 ? m.u32((pTarget + 0x0c) >>> 0) >>> 0 : 0xffffffff)
      AIGENERAL_BroadcastCmdToMinions113c(m, pUnit >>> 0, pGame >>> 0, sp)
      if (bInMeleeRange !== 0) {
        SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
        for (let off = 0; off < 0x20; off += 4) {
          m.setU32((sp + off) >>> 0, 0)
        }
        m.setU32(sp, 4)
        m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
        let bAnimRate = 0x64
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
          const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
          if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
            bAnimRate = 0x65
          }
        }
        m.setU8((sp + 0x15) >>> 0, bAnimRate)
        m.setU32((sp + 0x08) >>> 0, pTarget)
        MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
        return
      }
      aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
      return
    } finally {
      k2W3B8StackPtr = (sp + 0x20) >>> 0
    }
  }

  const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll = (newLo >>> 0) % 100
  const diff = m.u8((pGame + 0x6d) >>> 0)
  if (bInMeleeRange !== 0) {
    const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
    if ((roll | 0) >= aip1) {
      const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip3)
      return
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    const sp = (k2W3B8StackPtr - 0x20) >>> 0
    k2W3B8StackPtr = sp
    try {
      for (let off = 0; off < 0x20; off += 4) {
        m.setU32((sp + off) >>> 0, 0)
      }
      m.setU32(sp, 4)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      let bAnimRate = 0x64
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
          const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
          if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
            bAnimRate = 0x65
          }
        }
      }
      m.setU8((sp + 0x15) >>> 0, bAnimRate)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
    } finally {
      k2W3B8StackPtr = (sp + 0x20) >>> 0
    }
    return
  }

  const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
  if ((roll | 0) < aip2) {
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
    return
  }
  const aip4 = (m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip4)
}

/**
 * Self-buff / ranged skill / circlestrafe AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * 1. Checks `Skill[1]` (`+0x172`) aura state (`SkillsTxt + 0x80`); if missing and `lifePct < aip1[diff]` and `roll < aip2[diff]`, casts `Skill[1]`.
 * 2. When in melee range, rolls `aip3[diff]` to attack (`mode 4`) or stalls `aip4[diff]`.
 * 3. When out of melee range, manages cooldown counter `pAiControl + 0x14` (`aip5`/`aip6`), casts `Skill[0]` (`+0x170`) when `bRank < 4`,
 *    or approaches (`aip7[diff]`, `pathType = 2`, `dist = 6..7`) / circlestrafes (`nDist < aip8[diff]`, `pathType = 5..6`, `dist = 3`) / stalls `15`.
 *
 * @va D2Game:0x6FC9DB70
 */
export function AI_SelfBuffOrSkillAndStrafe_6FC9DB70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9DB70)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit >>> 0) | 0

  const wSkill1 = (m.u16((pMonStatsTxt + 0x172) >>> 0) << 16) >> 16
  if (wSkill1 >= 0) {
    const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pSgptPtr !== 0 ? m.u32(pSgptPtr) >>> 0 : 0
    const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
    if (wSkill1 < nSkillsCount) {
      const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
      const pSkillRec = (pSkillsTxtBase + Math.imul(wSkill1, 0x23c)) >>> 0
      if (pSkillRec !== 0) {
        const wAuraState = (m.u16((pSkillRec + 0x80) >>> 0) << 16) >> 16
        if (wAuraState >= 0 && (STATES_CheckState113c(m, pUnit >>> 0, wAuraState) | 0) === 0) {
          const diff0 = m.u8((pGame + 0x6d) >>> 0)
          const aip1 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x56) >>> 0) << 16) >> 16
          if (lifePct < aip1) {
            const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
            const diff1 = m.u8((pGame + 0x6d) >>> 0)
            const aip2 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x5c) >>> 0) << 16) >> 16
            if (roll < aip2) {
              const wSkill1Cast = (m.u16((pMonStatsTxt + 0x172) >>> 0) << 16) >> 16
              const bSeqMode1 = (m.u8((pMonStatsTxt + 0x181) >>> 0) << 24) >> 24
              AI_CastSkillWithMode113c(m, bSeqMode1, pUnit >>> 0, pGame >>> 0, wSkill1Cast, 0, 0, 0)
              return
            }
          }
        }
      }
    }
  }

  if (bInMeleeRange !== 0) {
    const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
    const roll = (newLo >>> 0) % 100
    const diff = m.u8((pGame + 0x6d) >>> 0)
    const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
    if ((roll | 0) >= aip3) {
      const aip4 = (m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0) << 16) >> 16
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip4)
      return
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    const sp = (k2W3B8StackPtr - 0x20) >>> 0
    k2W3B8StackPtr = sp
    try {
      for (let off = 0; off < 0x20; off += 4) {
        m.setU32((sp + off) >>> 0, 0)
      }
      m.setU32(sp, 4)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      let bAnimRate = 0x64
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
          const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
          if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
            bAnimRate = 0x65
          }
        }
      }
      m.setU8((sp + 0x15) >>> 0, bAnimRate)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
    } finally {
      k2W3B8StackPtr = (sp + 0x20) >>> 0
    }
    return
  }

  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip5 = (m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0) << 16) >> 16
  if (nDist < aip5 && (m.u32((pAiControl + 0x14) >>> 0) | 0) <= 0) {
    const aip6 = (m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0) << 16) >> 16
    m.setU32((pAiControl + 0x14) >>> 0, aip6 >>> 0)
  }

  const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
  if (wSkill0 >= 0 && (m.u32((pAiControl + 0x14) >>> 0) | 0) === 0) {
    let blockedByRank = false
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0 && m.u8((pMonData + 0x0e) >>> 0) >= 4) {
        blockedByRank = true
      }
    }
    if (!blockedByRank) {
      const bSeqMode0 = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
      AI_CastSkillWithMode113c(m, bSeqMode0, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
      const diffCast = m.u8((pGame + 0x6d) >>> 0)
      const aip6 = (m.u16((pMonStatsTxt + diffCast * 2 + 0x74) >>> 0) << 16) >> 16
      m.setU32((pAiControl + 0x14) >>> 0, aip6 >>> 0)
      return
    }
  }

  const curCooldown = m.u32((pAiControl + 0x14) >>> 0) | 0
  if (curCooldown > 0) {
    m.setU32((pAiControl + 0x14) >>> 0, (curCooldown - 1) >>> 0)
  }

  const newLo1 = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll1 = (newLo1 >>> 0) % 100
  const diffMove = m.u8((pGame + 0x6d) >>> 0)
  const aip7 = (m.u16((pMonStatsTxt + diffMove * 2 + 0x7a) >>> 0) << 16) >> 16
  if ((roll1 | 0) < aip7) {
    const newLo2 = stepUnitSeed64113c(m, pUnit >>> 0)
    let pUnitAiControl = 0
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pUnitAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    let distByte = ((newLo2 & 1) + 6) & 0xff
    m.setU32((pUnitAiControl + 0x18) >>> 0, 2)
    if (distByte !== 0) {
      if (distByte >= 0x4e) {
        distByte = 0x4d
      }
      m.setU8((pUnitAiControl + 0x20) >>> 0, distByte)
    }
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
    return
  }

  const aip8 = (m.u16((pMonStatsTxt + diffMove * 2 + 0x80) >>> 0) << 16) >> 16
  if (nDist < aip8) {
    const newLo2 = stepUnitSeed64113c(m, pUnit >>> 0)
    let pathType = (newLo2 & 0xff) >= 0x80 ? 6 : 5
    if (pathType === 1) {
      pathType = 7
    }
    let pUnitAiControl = 0
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pUnitAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    if (pathType !== 0) {
      m.setU32((pUnitAiControl + 0x18) >>> 0, pathType >>> 0)
    }
    m.setU8((pUnitAiControl + 0x20) >>> 0, 3)
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
    return
  }

  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0f)
}

/**
 * Melee or `pathType = 13` (`PATHTYPE_TOWARD_FINISH`) approach AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * when in melee range, rolls `aip1[diff]` to attack (`mode 4`) or stalls `aip2[diff]`;
 * when out of melee range, rolls `aip3[diff]` to set `pAiControl + 0x18 = 13` and approach (`mode 2`, `flags = 7`), or stalls `aip4[diff]`.
 *
 * @va D2Game:0x6FC9DF00
 */
export function AI_MeleeOrPathType13Approach_6FC9DF00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9DF00)
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll = (newLo >>> 0) % 100
  const diff = m.u8((pGame + 0x6d) >>> 0)
  if (bInMeleeRange !== 0) {
    const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
    if ((roll | 0) >= aip1) {
      const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip2)
      return
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    const sp = (k2W3B8StackPtr - 0x20) >>> 0
    k2W3B8StackPtr = sp
    try {
      for (let off = 0; off < 0x20; off += 4) {
        m.setU32((sp + off) >>> 0, 0)
      }
      m.setU32(sp, 4)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      let bAnimRate = 0x64
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
          const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
          if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
            bAnimRate = 0x65
          }
        }
      }
      m.setU8((sp + 0x15) >>> 0, bAnimRate)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
    } finally {
      k2W3B8StackPtr = (sp + 0x20) >>> 0
    }
    return
  }

  const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
  if ((roll | 0) < aip3) {
    let pUnitAiControl = 0
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pUnitAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    m.setU32((pUnitAiControl + 0x18) >>> 0, 0x0d)
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
    return
  }
  const aip4 = (m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip4)
}

/**
 * Initial 5-frame stall then melee-approach AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * on first tick (`pAiControl + 0x14 == 0`), sets `+0x14 = 1` and stalls `5` frames; thereafter rolls
 * `aip1[diff]`/`aip2[diff]` in melee range or `aip3[diff]`/`10` out of melee range.
 *
 * @va D2Game:0x6FC9E4D0
 */
export function AI_InitialStall5ThenMeleeApproach_6FC9E4D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9E4D0)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  if ((m.u32((pAiControl + 0x14) >>> 0) | 0) === 0) {
    m.setU32((pAiControl + 0x14) >>> 0, 1)
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 5)
    return
  }
  const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll = (newLo >>> 0) % 100
  const diff = m.u8((pGame + 0x6d) >>> 0)
  if (bInMeleeRange !== 0) {
    const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
    if ((roll | 0) >= aip1) {
      const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip2)
      return
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    const sp = (k2W3B8StackPtr - 0x20) >>> 0
    k2W3B8StackPtr = sp
    try {
      for (let off = 0; off < 0x20; off += 4) {
        m.setU32((sp + off) >>> 0, 0)
      }
      m.setU32(sp, 4)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      let bAnimRate = 0x64
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
          const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
          if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
            bAnimRate = 0x65
          }
        }
      }
      m.setU8((sp + 0x15) >>> 0, bAnimRate)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
    } finally {
      k2W3B8StackPtr = (sp + 0x20) >>> 0
    }
    return
  }

  const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
  if ((roll | 0) < aip3) {
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
    return
  }
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0a)
}

/**
 * Aura-buff and LOS skill-caster AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * 1. Casts `Skill[1]` (`+0x172`) if its `SkillsTxt` aura state (`+0x80`) is not active on `pUnit`.
 * 2. Casts `Skill[2]` (`+0x174`) at `(targetX, targetY)` if `UNITS_HasCollisionBetweenUnits(pUnit, pTarget, 6)` is non-zero.
 * 3. Consumes pending stall `pAiControl + 0x18`.
 * 4. Manages cooldown `pAiControl + 0x1C` (`aip6`), `Skill[0]` (`+0x170`) casting (`aip3`/`aip4`), step-approach (`nDist > 10`), and melee `mode 4`.
 *
 * @va D2Game:0x6FC9E640
 */
export function AI_AuraBuffAndLineOfSightSkillCaster_6FC9E640_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9E640)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0

  const targetX = getUnitPathCoordXInline113c(m, pTarget)
  const targetY = getUnitPathCoordYInline113c(m, pTarget)

  const wSkill1 = (m.u16((pMonStatsTxt + 0x172) >>> 0) << 16) >> 16
  if (wSkill1 >= 0) {
    const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pSgptPtr !== 0 ? m.u32(pSgptPtr) >>> 0 : 0
    if (wSkill1 < (m.u32((pDataTables + 0xba0) >>> 0) | 0)) {
      const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
      const pSkillRec = (pSkillsTxtBase + Math.imul(wSkill1, 0x23c)) >>> 0
      if (pSkillRec !== 0) {
        const wAuraState = (m.u16((pSkillRec + 0x80) >>> 0) << 16) >> 16
        if (wAuraState >= 0 && (STATES_CheckState113c(m, pUnit >>> 0, wAuraState) | 0) === 0) {
          const wSkill1Cast = (m.u16((pMonStatsTxt + 0x172) >>> 0) << 16) >> 16
          const bSeqMode1 = (m.u8((pMonStatsTxt + 0x181) >>> 0) << 24) >> 24
          AI_CastSkillWithMode113c(m, bSeqMode1, pUnit >>> 0, pGame >>> 0, wSkill1Cast, 0, 0, 0)
          return
        }
      }
    }
  }

  if ((UNITS_HasCollisionBetweenUnits113c(m, pUnit >>> 0, pTarget, 6) | 0) !== 0) {
    const wSkill2 = (m.u16((pMonStatsTxt + 0x174) >>> 0) << 16) >> 16
    const bSeqMode2 = (m.u8((pMonStatsTxt + 0x182) >>> 0) << 24) >> 24
    AI_CastSkillWithMode113c(m, bSeqMode2, pUnit >>> 0, pGame >>> 0, wSkill2, 0, targetX, targetY)
    return
  }

  const pendingStall = m.u32((pAiControl + 0x18) >>> 0) | 0
  if (pendingStall !== 0) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, pendingStall)
    m.setU32((pAiControl + 0x18) >>> 0, 0)
    return
  }

  if (bInMeleeRange === 0) {
    const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
    if (wSkill0 >= 0 && nDist < 10) {
      if ((m.u32((pAiControl + 0x1c) >>> 0) | 0) > 0) {
        aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
        return
      }
      const roll0 = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
      const diff0 = m.u8((pGame + 0x6d) >>> 0)
      const aip3 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x62) >>> 0) << 16) >> 16
      if (roll0 < aip3) {
        const wSkill0Cast = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
        const bSeqMode0 = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(
          m,
          bSeqMode0,
          pUnit >>> 0,
          pGame >>> 0,
          wSkill0Cast,
          pTarget,
          targetX,
          targetY,
        )
        const diff1 = m.u8((pGame + 0x6d) >>> 0)
        const aip5 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x6e) >>> 0) << 16) >> 16
        m.setU32((pAiControl + 0x18) >>> 0, aip5 >>> 0)
        const diff2 = m.u8((pGame + 0x6d) >>> 0)
        const aip6 = (m.u16((pMonStatsTxt + diff2 * 2 + 0x74) >>> 0) << 16) >> 16
        m.setU32((pAiControl + 0x1c) >>> 0, aip6 >>> 0)
        return
      }
    }

    if ((m.u32((pAiControl + 0x1c) >>> 0) | 0) > 0) {
      aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
      return
    }
    const diff = m.u8((pGame + 0x6d) >>> 0)
    const rollMove = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
    const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
    if (rollMove < aip2) {
      aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
      return
    }
    if (nDist > 10) {
      AI_StepRelativeToTargetUnit113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 6, 2, 9)
      return
    }
    const bAiDelay = m.u8((pMonStatsTxt + diff + 0x4f) >>> 0)
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, bAiDelay)
    return
  }

  if ((m.u32((pAiControl + 0x1c) >>> 0) | 0) <= 0) {
    const roll1 = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
    const diff0 = m.u8((pGame + 0x6d) >>> 0)
    const aip1 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x56) >>> 0) << 16) >> 16
    if (roll1 >= aip1) {
      m.setU32((pAiControl + 0x1c) >>> 0, 0)
      const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
      if (wSkill0 >= 0) {
        const roll2 = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
        const diff1 = m.u8((pGame + 0x6d) >>> 0)
        const aip4 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x68) >>> 0) << 16) >> 16
        if (roll2 < aip4) {
          const wSkill0Cast = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
          const bSeqMode0 = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
          AI_CastSkillWithMode113c(
            m,
            bSeqMode0,
            pUnit >>> 0,
            pGame >>> 0,
            wSkill0Cast,
            pTarget,
            targetX,
            targetY,
          )
          const diff2 = m.u8((pGame + 0x6d) >>> 0)
          const aip5 = (m.u16((pMonStatsTxt + diff2 * 2 + 0x6e) >>> 0) << 16) >> 16
          m.setU32((pAiControl + 0x18) >>> 0, aip5 >>> 0)
          const diff3 = m.u8((pGame + 0x6d) >>> 0)
          const aip6 = (m.u16((pMonStatsTxt + diff3 * 2 + 0x74) >>> 0) << 16) >> 16
          m.setU32((pAiControl + 0x1c) >>> 0, aip6 >>> 0)
          return
        }
      }
      const diffDelay = m.u8((pGame + 0x6d) >>> 0)
      const bAiDelay = m.u8((pMonStatsTxt + diffDelay + 0x4f) >>> 0)
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, bAiDelay)
      return
    }
  }

  const curCooldown = m.u32((pAiControl + 0x1c) >>> 0) | 0
  if (curCooldown > 0) {
    m.setU32((pAiControl + 0x1c) >>> 0, (curCooldown - 1) >>> 0)
  }
  SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
  const sp = (k2W3B8StackPtr - 0x20) >>> 0
  k2W3B8StackPtr = sp
  try {
    for (let off = 0; off < 0x20; off += 4) {
      m.setU32((sp + off) >>> 0, 0)
    }
    m.setU32(sp, 4)
    m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
    let bAnimRate = 0x64
    if (pUnit !== 0) {
      const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
      if (pMonStats2 !== 0) {
        const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
        const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
        if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
          bAnimRate = 0x65
        }
      }
    }
    m.setU8((sp + 0x15) >>> 0, bAnimRate)
    m.setU32((sp + 0x08) >>> 0, pTarget)
    MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
  } finally {
    k2W3B8StackPtr = (sp + 0x20) >>> 0
  }
}

/**
 * Melee/circlestrafe or step-approach AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * when in melee range, rolls `aip2[diff]` to attack (`mode 4`), else rolls `aip4[diff]` to circlestrafe (`pathType = 5..6`, `dist = 2`),
 * else stalls `aip3[diff]`; when out of melee range, rolls `aip1[diff]` to step 8 subtiles toward target, else rolls `aip1[diff]`
 * to approach (`flags = 7`), else stalls `aip3[diff]`.
 *
 * @va D2Game:0x6FC9F370
 */
export function AI_MeleeStrafeOrStepApproach_6FC9F370_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9F370)
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  if (bInMeleeRange !== 0) {
    const newLo1 = stepUnitSeed64113c(m, pUnit >>> 0)
    const roll1 = (newLo1 >>> 0) % 100
    const diff0 = m.u8((pGame + 0x6d) >>> 0)
    const aip2 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x5c) >>> 0) << 16) >> 16
    if ((roll1 | 0) < aip2) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
      const sp = (k2W3B8StackPtr - 0x20) >>> 0
      k2W3B8StackPtr = sp
      try {
        for (let off = 0; off < 0x20; off += 4) {
          m.setU32((sp + off) >>> 0, 0)
        }
        m.setU32(sp, 4)
        m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
        let bAnimRate = 0x64
        if (pUnit !== 0) {
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
          if (pMonStats2 !== 0) {
            const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
            const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
            if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
              bAnimRate = 0x65
            }
          }
        }
        m.setU8((sp + 0x15) >>> 0, bAnimRate)
        m.setU32((sp + 0x08) >>> 0, pTarget)
        MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
      } finally {
        k2W3B8StackPtr = (sp + 0x20) >>> 0
      }
      return
    }

    const newLo2 = stepUnitSeed64113c(m, pUnit >>> 0)
    const roll2 = (newLo2 >>> 0) % 100
    const diff1 = m.u8((pGame + 0x6d) >>> 0)
    const aip4 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x68) >>> 0) << 16) >> 16
    if ((roll2 | 0) < aip4) {
      const newLo3 = stepUnitSeed64113c(m, pUnit >>> 0)
      let pathType = (newLo3 & 0xff) >= 0x80 ? 6 : 5
      if (pathType === 1) {
        pathType = 7
      }
      let pUnitAiControl = 0
      if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
        const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) {
          pUnitAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
        }
      }
      if (pathType !== 0) {
        m.setU32((pUnitAiControl + 0x18) >>> 0, pathType >>> 0)
      }
      m.setU8((pUnitAiControl + 0x20) >>> 0, 2)
      aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
      return
    }

    const aip3 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x62) >>> 0) << 16) >> 16
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip3)
    return
  }

  const newLo1 = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll1 = (newLo1 >>> 0) % 100
  const diff0 = m.u8((pGame + 0x6d) >>> 0)
  const aip1 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x56) >>> 0) << 16) >> 16
  if ((roll1 | 0) < aip1) {
    AI_StepRelativeToTargetUnit113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 8, 2, 1)
    return
  }

  const newLo2 = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll2 = (newLo2 >>> 0) % 100
  const diff1 = m.u8((pGame + 0x6d) >>> 0)
  const aip1Retry = (m.u16((pMonStatsTxt + diff1 * 2 + 0x56) >>> 0) << 16) >> 16
  if ((roll2 | 0) < aip1Retry) {
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
    return
  }

  const aip3 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x62) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip3)
}

/**
 * Three-stage suicide minion AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * - Stage `0`: when `nDist < aip2[diff]` or `MONSTER_HasAlwaysChaseFlag(pUnit)`, starts `mode 8` (`MONMODE_SKILL1`) and sets stage `1`.
 * - Stage `1`: when out of melee range, rolls `aip1[diff]` to approach (`mode 2`) or wanders (`AI_IdleWander`);
 *              when in melee range, triggers `AI_StartAttackMode(8)`, schedules event `0` at `dwGameFrame + 1`, and sets stage `2`.
 * - Stage `2`: awards death/experience via `SUNITDMG_DistributeExperience` (`0x6FCFEEE0`).
 *
 * @va D2Game:0x6FC9F5A0
 */
export function AI_ThreeStageSuicideMinion_6FC9F5A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9F5A0)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const nStage = m.u32((pAiControl + 0x14) >>> 0) | 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0

  if (nStage === 2) {
    SUNITDMG_DistributeExperience113c(m, pGame >>> 0, pTarget, pUnit >>> 0)
    return
  }
  if (nStage === 0) {
    const diff0 = m.u8((pGame + 0x6d) >>> 0)
    const aip2 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x5c) >>> 0) << 16) >> 16
    if (nDist < aip2 || (MONSTER_HasAlwaysChaseFlag113c(m, pUnit >>> 0) | 0) !== 0) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
      const sp = (k2W3B8StackPtr - 0x20) >>> 0
      k2W3B8StackPtr = sp
      try {
        for (let off = 0; off < 0x20; off += 4) {
          m.setU32((sp + off) >>> 0, 0)
        }
        m.setU32(sp, 8)
        m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
        let bAnimRate = 0x64
        if (pUnit !== 0) {
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
          if (pMonStats2 !== 0) {
            const bSubClass = m.u8((pMonStats2 + 0x105) >>> 0)
            const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
            if ((bSubClass & m.u32(pAlignTable)) !== 0) {
              bAnimRate = 0x65
            }
          }
        }
        m.setU8((sp + 0x15) >>> 0, bAnimRate)
        m.setU32((sp + 0x08) >>> 0, pTarget)
        MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 8, pTarget, 0, 0)
      } finally {
        k2W3B8StackPtr = (sp + 0x20) >>> 0
      }
      m.setU32((pAiControl + 0x14) >>> 0, 1)
      return
    }
  }
  if (nStage === 1) {
    if (bInMeleeRange === 0) {
      const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
      const diff = m.u8((pGame + 0x6d) >>> 0)
      const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
      if (roll < aip1) {
        aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
        return
      }
      AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 8)
      return
    }
    AI_StartAttackMode113c(m, 8, pUnit >>> 0, pGame >>> 0, pTarget)
    const nextFrame = (m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0
    EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0, nextFrame, 0, 0, 0)
    m.setU32((pAiControl + 0x14) >>> 0, 2)
    return
  }
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip3)
}


/**
 * Combo melee / dual-skill AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * when in melee range, if `pAiControl->dwState (+0x14) !== 0` and `roll >= aip1[diff]`, stalls `aip2[diff]`;
 * otherwise sets `dwState = 1` and rolls `aip5[diff]` for `Skill[0]`, `aip6[diff]` for `Skill[1]`, or starts `mode 4` melee;
 * when out of melee range, sets `dwState = 0` and rolls `aip3[diff]` to approach (`flags = 7`) or stalls `aip4[diff]`.
 *
 * @va D2Game:0x6FC9F760
 */
export function AI_ComboMeleeAndDualSkill_6FC9F760_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9F760)
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0

  if (bInMeleeRange !== 0) {
    if ((m.u32((pAiControl + 0x14) >>> 0) | 0) !== 0) {
      const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
      const roll = (newLo >>> 0) % 100
      const diff = m.u8((pGame + 0x6d) >>> 0)
      const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
      if ((roll | 0) >= aip1) {
        const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
        AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip2)
        return
      }
    }
    m.setU32((pAiControl + 0x14) >>> 0, 1)
    const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
    if (wSkill0 >= 0) {
      const newLo0 = stepUnitSeed64113c(m, pUnit >>> 0)
      const roll0 = (newLo0 >>> 0) % 100
      const diff0 = m.u8((pGame + 0x6d) >>> 0)
      const aip5 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x6e) >>> 0) << 16) >> 16
      if ((roll0 | 0) < aip5) {
        const bSeqMode0 = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode0, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
        return
      }
    }
    const wSkill1 = (m.u16((pMonStatsTxt + 0x172) >>> 0) << 16) >> 16
    if (wSkill1 >= 0) {
      const newLo1 = stepUnitSeed64113c(m, pUnit >>> 0)
      const roll1 = (newLo1 >>> 0) % 100
      const diff1 = m.u8((pGame + 0x6d) >>> 0)
      const aip6 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x74) >>> 0) << 16) >> 16
      if ((roll1 | 0) < aip6) {
        const bSeqMode1 = (m.u8((pMonStatsTxt + 0x181) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode1, pUnit >>> 0, pGame >>> 0, wSkill1, pTarget, 0, 0)
        return
      }
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    const sp = (k2W3B8StackPtr - 0x20) >>> 0
    k2W3B8StackPtr = sp
    try {
      for (let off = 0; off < 0x20; off += 4) {
        m.setU32((sp + off) >>> 0, 0)
      }
      m.setU32(sp, 4)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      let bAnimRate = 0x64
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
          const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
          if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
            bAnimRate = 0x65
          }
        }
      }
      m.setU8((sp + 0x15) >>> 0, bAnimRate)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
    } finally {
      k2W3B8StackPtr = (sp + 0x20) >>> 0
    }
    return
  }

  m.setU32((pAiControl + 0x14) >>> 0, 0)
  const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll = (newLo >>> 0) % 100
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
  if ((roll | 0) < aip3) {
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
    return
  }
  const aip4 = (m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip4)
}

/**
 * Alternating melee or approach AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * when in melee range, attacks (`mode 4`, setting `dwState = 1`) only if `dwState === 0` and `roll < aip1[diff]`,
 * else resets `dwState = 0` and stalls `aip2[diff]`; when out of melee range, resets `dwState = 0` and rolls `aip3[diff]`
 * to approach (`flags = 1`) or stalls `aip4[diff]`.
 *
 * @va D2Game:0x6FC9F9A0
 */
export function AI_AlternatingMeleeOrApproach_6FC9F9A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9F9A0)
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0

  if (bInMeleeRange !== 0) {
    if ((m.u32((pAiControl + 0x14) >>> 0) | 0) === 0) {
      const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
      const roll = (newLo >>> 0) % 100
      const diff = m.u8((pGame + 0x6d) >>> 0)
      const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
      if ((roll | 0) < aip1) {
        m.setU32((pAiControl + 0x14) >>> 0, 1)
        SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
        const sp = (k2W3B8StackPtr - 0x20) >>> 0
        k2W3B8StackPtr = sp
        try {
          for (let off = 0; off < 0x20; off += 4) {
            m.setU32((sp + off) >>> 0, 0)
          }
          m.setU32(sp, 4)
          m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
          let bAnimRate = 0x64
          if (pUnit !== 0) {
            const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
            if (pMonStats2 !== 0) {
              const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
              const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
              if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
                bAnimRate = 0x65
              }
            }
          }
          m.setU8((sp + 0x15) >>> 0, bAnimRate)
          m.setU32((sp + 0x08) >>> 0, pTarget)
          MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
        } finally {
          k2W3B8StackPtr = (sp + 0x20) >>> 0
        }
        return
      }
    }
    const diff = m.u8((pGame + 0x6d) >>> 0)
    const aip2 = (m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0) << 16) >> 16
    m.setU32((pAiControl + 0x14) >>> 0, 0)
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip2)
    return
  }

  m.setU32((pAiControl + 0x14) >>> 0, 0)
  const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll = (newLo >>> 0) % 100
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip3 = (m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0) << 16) >> 16
  if ((roll | 0) < aip3) {
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 1)
    return
  }
  const aip4 = (m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip4)
}


/**
 * Charge/run or triple-skill melee AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * when `nDist > aip5[diff]`, sets `pathType = 0x0D`, `velBonus = 100`, approaches in `mode 0x0F`, and sets `dwState = 1`;
 * when in melee range, if `dwState === 0` and `roll >= aip2[diff]`, stalls `aip3[diff]`, else resets `dwState = 0` and rolls
 * `aip6[diff]` (`Skill[0]`), `aip7[diff]` (`Skill[1]`), `aip8[diff]` (`Skill[2]`), or attacks (`mode 4`);
 * when out of melee range, rolls `aip1[diff]` to either run toward target (`aip4[diff]`, `0x6FD12F00`) or walk (`step = 3`).
 *
 * @va D2Game:0x6FC9FB30
 */
export function AI_ChargeRunOrTripleSkillMelee_6FC9FB30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9FB30)
  const diff0 = m.u8((pGame + 0x6d) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const aip5 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x6e) >>> 0) << 16) >> 16

  if (nDist > aip5) {
    const pMonStats2 = m.u32((pAiParam + 0x20) >>> 0) >>> 0
    const bStep = m.u8((pMonStats2 + 0x0e) >>> 0)
    PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0, bStep)
    let pUnitAiControl = 0
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pUnitAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    m.setU32((pUnitAiControl + 0x18) >>> 0, 0x0d)
    m.setU32((pUnitAiControl + 0x1c) >>> 0, 0x64)
    aiApproachTarget6FD12540(
      m,
      pGame >>> 0,
      pUnit >>> 0,
      pTarget,
      0x0f,
      0,
      0,
      bStep !== 0 ? bStep : 1,
      0,
    )
    m.setU32((pAiControl + 0x14) >>> 0, 1)
    return
  }

  if (bInMeleeRange !== 0) {
    if ((m.u32((pAiControl + 0x14) >>> 0) | 0) === 0) {
      const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
      const roll = (newLo >>> 0) % 100
      const diff1 = m.u8((pGame + 0x6d) >>> 0)
      const aip2 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x5c) >>> 0) << 16) >> 16
      if ((roll | 0) >= aip2) {
        const aip3 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x62) >>> 0) << 16) >> 16
        AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip3)
        return
      }
    }
    m.setU32((pAiControl + 0x14) >>> 0, 0)
    const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
    if (wSkill0 >= 0) {
      const roll0 = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
      const diff = m.u8((pGame + 0x6d) >>> 0)
      const aip6 = (m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0) << 16) >> 16
      if (roll0 < aip6) {
        const bSeqMode0 = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode0, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
        return
      }
    }
    const wSkill1 = (m.u16((pMonStatsTxt + 0x172) >>> 0) << 16) >> 16
    if (wSkill1 >= 0) {
      const roll1 = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
      const diff = m.u8((pGame + 0x6d) >>> 0)
      const aip7 = (m.u16((pMonStatsTxt + diff * 2 + 0x7a) >>> 0) << 16) >> 16
      if (roll1 < aip7) {
        const bSeqMode1 = (m.u8((pMonStatsTxt + 0x181) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode1, pUnit >>> 0, pGame >>> 0, wSkill1, pTarget, 0, 0)
        return
      }
    }
    const wSkill2 = (m.u16((pMonStatsTxt + 0x174) >>> 0) << 16) >> 16
    if (wSkill2 >= 0) {
      const roll2 = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
      const diff = m.u8((pGame + 0x6d) >>> 0)
      const aip8 = (m.u16((pMonStatsTxt + diff * 2 + 0x80) >>> 0) << 16) >> 16
      if (roll2 < aip8) {
        const bSeqMode2 = (m.u8((pMonStatsTxt + 0x182) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode2, pUnit >>> 0, pGame >>> 0, wSkill2, pTarget, 0, 0)
        return
      }
    }
    AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pTarget)
    return
  }

  const newLo1 = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll1 = (newLo1 >>> 0) % 100
  const diff1 = m.u8((pGame + 0x6d) >>> 0)
  const aip1 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x56) >>> 0) << 16) >> 16
  if ((roll1 | 0) < aip1) {
    const pMonStats2 = m.u32((pAiParam + 0x20) >>> 0) >>> 0
    PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0, m.u8((pMonStats2 + 0x0e) >>> 0))
    const newLo2 = stepUnitSeed64113c(m, pUnit >>> 0)
    const roll2 = (newLo2 >>> 0) % 100
    const diff2 = m.u8((pGame + 0x6d) >>> 0)
    const aip4 = (m.u16((pMonStatsTxt + diff2 * 2 + 0x68) >>> 0) << 16) >> 16
    if ((roll2 | 0) < aip4) {
      let pUnitAiControl = 0
      if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
        const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) {
          pUnitAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
        }
      }
      m.setU32((pUnitAiControl + 0x18) >>> 0, 0x0d)
      m.setU32((pUnitAiControl + 0x1c) >>> 0, 0x64)
      const bStep = m.u8((m.u32((pAiParam + 0x20) >>> 0) + 0x0e) >>> 0)
      AI_RunTowardTarget_6FD12F00_113c(m, pUnit >>> 0, pTarget, pGame >>> 0, bStep)
      return
    }
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 3, 0)
    return
  }
  const aip3 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x62) >>> 0) << 16) >> 16
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip3)
}

/**
 * Melee or dual-skill with `pathType = 7` approach AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * when in melee range, rolls `aip1[diff]` for `Skill[0]` or starts `mode 4` melee;
 * when out of melee range, rolls `aip2[diff]` to stall `5` frames, else rolls `aip3[diff]` to cast `Skill[0]` (`aip4[diff]`) or `Skill[1]`,
 * else sets `pUnitAiControl + 0x18 = 7` and approaches (`flags = 7`).
 *
 * @va D2Game:0x6FC9FE60
 */
export function AI_MeleeOrDualSkillPathType7_6FC9FE60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9FE60)
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0

  if (bInMeleeRange !== 0) {
    const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
    if (wSkill0 >= 0) {
      const newLo = stepUnitSeed64113c(m, pUnit >>> 0)
      const roll = (newLo >>> 0) % 100
      const diff = m.u8((pGame + 0x6d) >>> 0)
      const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
      if ((roll | 0) < aip1) {
        const bSeqMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
        return
      }
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    const sp = (k2W3B8StackPtr - 0x20) >>> 0
    k2W3B8StackPtr = sp
    try {
      for (let off = 0; off < 0x20; off += 4) {
        m.setU32((sp + off) >>> 0, 0)
      }
      m.setU32(sp, 4)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      let bAnimRate = 0x64
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const bSubClass = m.u8((pMonStats2 + 0x104) >>> 0)
          const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
          if ((bSubClass & m.u32((pAlignTable + 0x10) >>> 0)) !== 0) {
            bAnimRate = 0x65
          }
        }
      }
      m.setU8((sp + 0x15) >>> 0, bAnimRate)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
    } finally {
      k2W3B8StackPtr = (sp + 0x20) >>> 0
    }
    return
  }

  const newLo1 = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll1 = (newLo1 >>> 0) % 100
  const diff0 = m.u8((pGame + 0x6d) >>> 0)
  const aip2 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x5c) >>> 0) << 16) >> 16
  if ((roll1 | 0) < aip2) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 5)
    return
  }

  const newLo2 = stepUnitSeed64113c(m, pUnit >>> 0)
  const roll2 = (newLo2 >>> 0) % 100
  const diff1 = m.u8((pGame + 0x6d) >>> 0)
  const aip3 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x62) >>> 0) << 16) >> 16
  if ((roll2 | 0) < aip3) {
    const wSkill0 = (m.u16((pMonStatsTxt + 0x170) >>> 0) << 16) >> 16
    if (wSkill0 >= 0) {
      const rollSkill0 = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
      const diff2 = m.u8((pGame + 0x6d) >>> 0)
      const aip4 = (m.u16((pMonStatsTxt + diff2 * 2 + 0x68) >>> 0) << 16) >> 16
      if (rollSkill0 < aip4) {
        const bSeqMode0 = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        AI_CastSkillWithMode113c(m, bSeqMode0, pUnit >>> 0, pGame >>> 0, wSkill0, pTarget, 0, 0)
        return
      }
    }
    const wSkill1 = (m.u16((pMonStatsTxt + 0x172) >>> 0) << 16) >> 16
    if (wSkill1 >= 0) {
      const bSeqMode1 = (m.u8((pMonStatsTxt + 0x181) >>> 0) << 24) >> 24
      AI_CastSkillWithMode113c(m, bSeqMode1, pUnit >>> 0, pGame >>> 0, wSkill1, pTarget, 0, 0)
      return
    }
  }

  let pUnitAiControl = 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pUnitAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
    }
  }
  m.setU32((pUnitAiControl + 0x18) >>> 0, 7)
  aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
}


/**
 * Multi-state regenerating / burrowing monster AI (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiParam`, `ret 0x4`):
 * - States `0` and `4`: enters `mode 10` (`MONMODE_SEQUENCE`), purges existing event `2` nodes on `pUnit->pEventList (+0xDC)`,
 *   schedules event `2` at `dwGameFrame + 8`, sets `dwState = 1`, `dwSubCount = 0`, and applies `(curRegen * aip5[diff]) / 8` bonus to `STAT_HPREGEN (0x4A)`.
 * - State `1`: when `dwSubCount > 1` and woken by melee/range/chase/lifePct, removes bonus `STAT_HPREGEN`, triggers `AI_StartAttackMode(9)`,
 *   schedules think timer `6`, and sets `dwState = 3`; otherwise triggers `AI_StartAttackMode(11)`, schedules think timer `10` or `15`, and increments `dwSubCount`.
 * - State `2`: flees if `lifePct < aip1[diff]` (`dwState = 4`), or rolls `< 33` to approach (`dwState = 3`), `< 15` to wander, or stalls `10`.
 * - State `3`: flees if `lifePct < aip1[diff]` (`dwState = 4`), approaches if out of melee range, uses `mode 5` if `dwSubCount > 0`,
 *   flees (`dwState = 2`) if `AlwaysChase` and `roll < aip2[diff]`, or rolls `aip3[diff]`/`aip4[diff]` for `mode 5` vs `mode 4` attack, else stalls `10`.
 *
 * @va D2Game:0x6FCA0450
 */
export function AI_RegeneratingMultiStateMonster_6FCA0450_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA0450)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const nDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMeleeRange = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit >>> 0) | 0
  const nState = m.u32((pAiControl + 0x14) >>> 0) | 0

  if (nState === 0 || nState === 4) {
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    const sp = (k2W3B8StackPtr - 0x20) >>> 0
    k2W3B8StackPtr = sp
    try {
      for (let off = 0; off < 0x20; off += 4) {
        m.setU32((sp + off) >>> 0, 0)
      }
      m.setU32(sp, 0x0a)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      let bAnimRate = 0x64
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const bSubClass = m.u8((pMonStats2 + 0x105) >>> 0)
          const pAlignTable = m.u32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C) >>> 0
          if ((bSubClass & m.u32((pAlignTable + 0x08) >>> 0)) !== 0) {
            bAnimRate = 0x65
          }
        }
      }
      m.setU8((sp + 0x15) >>> 0, bAnimRate)
      m.setU32((sp + 0x08) >>> 0, 0)
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 0x0a, 0, 0, 0)
    } finally {
      k2W3B8StackPtr = (sp + 0x20) >>> 0
    }
    if (pUnit !== 0) {
      let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
      while (pEvent !== 0) {
        const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
        if (m.u8(pEvent) === 2) {
          EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
        }
        pEvent = pNext
      }
    }
    const nextFrame = (m.u32((pGame + 0xa8) >>> 0) + 8) >>> 0
    EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 2, nextFrame, 0, 0, 0)
    m.setU32((pAiControl + 0x14) >>> 0, 1)
    m.setU32((pAiControl + 0x18) >>> 0, 0)
    const curRegen = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x4a, 0) | 0
    if (curRegen !== 0) {
      const diff = m.u8((pGame + 0x6d) >>> 0)
      const aip5 = (m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0) << 16) >> 16
      const prod = Math.imul(aip5, curRegen)
      const deltaRegen = ((prod + ((prod >> 31) & 7)) | 0) >> 3
      m.setU32((pAiControl + 0x1c) >>> 0, deltaRegen >>> 0)
      STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x4a, (deltaRegen + curRegen) | 0, 0)
      return
    }
    m.setU32((pAiControl + 0x1c) >>> 0, 0)
    return
  }

  if (nState === 1) {
    if ((m.u32((pAiControl + 0x18) >>> 0) | 0) > 1) {
      if (
        bInMeleeRange !== 0 ||
        nDist < 7 ||
        (MONSTER_HasAlwaysChaseFlag113c(m, pUnit >>> 0) | 0) !== 0 ||
        (nDist < 14 && lifePct > 50)
      ) {
        if ((m.u32((pAiControl + 0x1c) >>> 0) | 0) !== 0) {
          const curRegen = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x4a, 0) | 0
          const savedBonus = m.u32((pAiControl + 0x1c) >>> 0) | 0
          STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x4a, (curRegen - savedBonus) | 0, 0)
        }
        AI_StartAttackMode113c(m, 9, pUnit >>> 0, pGame >>> 0, 0)
        AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame >>> 0, pUnit >>> 0, 6)
        m.setU32((pAiControl + 0x14) >>> 0, 3)
        return
      }
    }
    AI_StartAttackMode113c(m, 0x0b, pUnit >>> 0, pGame >>> 0, 0)
    const curSubCount = m.u32((pAiControl + 0x18) >>> 0) | 0
    AI_ScheduleAiThinkTimer_6FD120C0_113c(
      m,
      pGame >>> 0,
      pUnit >>> 0,
      curSubCount === 0 ? 10 : 15,
    )
    m.setU32((pAiControl + 0x18) >>> 0, ((m.u32((pAiControl + 0x18) >>> 0) | 0) + 1) >>> 0)
    return
  }

  if (nState === 2) {
    const diff = m.u8((pGame + 0x6d) >>> 0)
    const aip1 = (m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0) << 16) >> 16
    if (lifePct < aip1) {
      if ((AI_FleeFrom113c(m, pTarget, pGame >>> 0, pUnit >>> 0, 0x0f, 0) | 0) !== 0) {
        m.setU32((pAiControl + 0x14) >>> 0, 4)
        return
      }
    }
    if ((rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) < 0x21) {
      aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
      m.setU32((pAiControl + 0x14) >>> 0, 3)
      return
    }
    if ((rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) >= 0x0f) {
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
      return
    }
    AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 6)
    return
  }

  if (nState === 3) {
    const diff0 = m.u8((pGame + 0x6d) >>> 0)
    const aip1 = (m.u16((pMonStatsTxt + diff0 * 2 + 0x56) >>> 0) << 16) >> 16
    if (lifePct < aip1) {
      if ((AI_FleeFrom113c(m, pTarget, pGame >>> 0, pUnit >>> 0, 0x0f, 0) | 0) !== 0) {
        m.setU32((pAiControl + 0x14) >>> 0, 4)
        return
      }
    }
    if (bInMeleeRange === 0) {
      aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
      return
    }
    if ((m.u32((pAiControl + 0x18) >>> 0) | 0) > 0) {
      AI_StartAttackMode113c(m, 5, pUnit >>> 0, pGame >>> 0, pTarget)
      m.setU32((pAiControl + 0x18) >>> 0, 0)
      return
    }
    if ((MONSTER_HasAlwaysChaseFlag113c(m, pUnit >>> 0) | 0) !== 0) {
      const rollChase = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
      const diff1 = m.u8((pGame + 0x6d) >>> 0)
      const aip2 = (m.u16((pMonStatsTxt + diff1 * 2 + 0x5c) >>> 0) << 16) >> 16
      if (rollChase < aip2) {
        if ((AI_FleeFrom113c(m, pTarget, pGame >>> 0, pUnit >>> 0, 0x0c, 0) | 0) !== 0) {
          m.setU32((pAiControl + 0x14) >>> 0, 2)
          return
        }
      }
    }
    const rollAtk = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
    const diff2 = m.u8((pGame + 0x6d) >>> 0)
    const aip3 = (m.u16((pMonStatsTxt + diff2 * 2 + 0x62) >>> 0) << 16) >> 16
    if (rollAtk < aip3) {
      const rollMode = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
      const diff3 = m.u8((pGame + 0x6d) >>> 0)
      const aip4 = (m.u16((pMonStatsTxt + diff3 * 2 + 0x68) >>> 0) << 16) >> 16
      AI_StartAttackMode113c(m, rollMode < aip4 ? 5 : 4, pUnit >>> 0, pGame >>> 0, pTarget)
      return
    }
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
    return
  }

  if (nDist < 15) {
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
    m.setU32((pAiControl + 0x14) >>> 0, 3)
    return
  }
  m.setU32((pAiControl + 0x14) >>> 0, 4)
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 15)
}
