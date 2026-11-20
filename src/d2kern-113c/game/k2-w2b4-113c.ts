/**
 * Diablo II v1.13c `D2Game.dll` Core & Combat Pipeline (`[K2]` Wave 2 Batch 4 `w2b4`):
 * 45 `S2C`, `ITEMS`, `EVENT`, `SUNITPROXY`, `MISSILE`, `STATES`, `SKILLS`, `SUMMON`,
 * `PARTY`, `MONAI`, `CLIENT`, and `VECTOR` functions (`0x6FCABF80..0x6FCBE490`).
 *
 * Every exported function is a 1:1 instruction-faithful translation of its
 * corresponding `D2Game.dll` v1.13c machine-code routine operating on `Memory113c`.
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { SGPT_DATA_TABLES_PTR_VA_6FDE9E1C } from '../common/drlg/drlg-room.ts'
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_RemoveClientFromRoom113c,
} from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32 } from '../common/int-math.ts'
import {
  INVENTORY_GetEquippedShield113c,
  UNITS_SetStaticPathPosX113c,
  UNITS_SetStaticPathPosY113c,
} from '../common/inventory.ts'
import { ITEMS_SetItemFlag113c, ITEMS_SetOrClearCommandFlags113c } from '../common/items.ts'
import { DUNGEON_CheckRoomIsTownMemPort113c } from '../common/k0-d2common-memports.ts'
import {
  MISSILE_GetTotalFrames113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetTotalFrames113c,
} from '../common/missile.ts'
import {
  PATH_Compute113c,
  PATH_GetTargetUnit113c,
  PATH_SetNewDistance113c,
  PATH_SetType113c,
} from '../common/path.ts'
import {
  SKILLS_CanMonsterReviveInMode2_113c,
  SKILLS_GetFirstSkillFromSkillList113c,
  SKILLS_GetNextSkill113c,
  SKILLS_GetPassiveState113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillLevelByIdWithBonus113c,
  SKILLS_GetSkillPhysMaxDamage113c,
  SKILLS_GetSkillPhysMinDamage113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_IsSelectableCorpse11157_113c,
} from '../common/skills.ts'
import {
  STATES_ApplyMonSkillIconToUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
} from '../common/statlist.ts'
import {
  ANIMSEQ_GetUnitSeqFrameDataField8_113c,
  ANIMSEQ_GetUnitSeqRecordPtr113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import { UNITFINDS_MatchUnitCandidate113c } from '../common/unit-finds.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SEED_InitLowSeed113c } from '../prng.ts'
import { MONSTERS_IsDead113c } from '../tables/datatbls-113c.ts'
import { S2C_SendPacket9C_ItemActionWorld113c } from './a1c-post150-f786-f1040-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import { D2GAME_ARENA_FindPlayerSlotByUnit113c } from './boot-init-gap-b-113c.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_GetBaseIdFromUnit113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
} from './regpop-spawn-113c.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** `D2Game.dll` `.data` `0x6FD274A8`: `gpSrvDoFuncTable[0..0xBE]` (`uint32[191]`). */
export const D2GAME_SRVDOFUNC_TABLE_VA_113C = 0x6fd274a8

/** `D2Game.dll` `.data` `0x6FD2F0EC`: count of item command flags cleared by `0x6FCBB340`. */
export const D2GAME_ITEM_CLEAR_CMD_FLAGS_COUNT_VA_113C = 0x6fd2f0ec

/** `D2Game.dll` `.data` `0x6FD2F0F0`: array of item command flags cleared by `0x6FCBB340`. */
export const D2GAME_ITEM_CLEAR_CMD_FLAGS_ARRAY_VA_113C = 0x6fd2f0f0

/** `D2Game.dll` `.data` `0x6FD2F0C8`: count of item flags cleared by `0x6FCBB340`. */
export const D2GAME_ITEM_CLEAR_FLAGS_COUNT_VA_113C = 0x6fd2f0c8

/** `D2Game.dll` `.data` `0x6FD2F0CC`: array of item flags cleared by `0x6FCBB340`. */
export const D2GAME_ITEM_CLEAR_FLAGS_ARRAY_VA_113C = 0x6fd2f0cc

/** Optional host callbacks for pool allocation/deallocation and indirect `SrvDoFunc` dispatch. */
export interface K2W2B4Hooks113c {
  readonly allocPoolMemory?: (
    m: Memory113c,
    pMemPool: number,
    nSize: number,
    szFileVa: number,
    nLine: number,
    nZero: number,
  ) => number
  readonly freePoolMemory?: (
    m: Memory113c,
    pMemPool: number,
    pMem: number,
    szFileVa: number,
    nLine: number,
    nZero: number,
  ) => void
  readonly onSrvDoFunc?: (
    m: Memory113c,
    pfn: number,
    pGame: number,
    pUnit: number,
    nSkillId: number,
    nSkillLevel: number,
  ) => number
}

/** Reentrant scratch stack region for local packet buffers and out-parameter dwords. */
let k2W2B4StackPtr = 0x7e040000

function resolveDataTablesPtr113c(m: Memory113c): number {
  const iatPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (iatPtr !== 0) {
    const deref = m.u32(iatPtr) >>> 0
    if (deref !== 0) {
      return deref
    }
    return iatPtr
  }
  return m.u32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C) >>> 0
}

function getClientFromPlayerUnitInline113c(m: Memory113c, pPlayer: number): number {
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    return m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  return 0
}

/**
 * Builds an 11-byte (`0x0B`) S2C unit location packet `[u8 bPacketId, u8 bUnitType, u32 dwUnitId, u16 wX, u16 wY, u8 bFlag]`
 * on the stack and queues it to `pClient` via `0x6FCAA3E0` (`al = bPacketId, cl = bUnitType, edx = dwUnitId, [esp+4] = pClient, [esp+8] = wX, [esp+0xC] = wY, [esp+0x10] = bFlag`).
 *
 * @va D2Game.dll@0x6fcabf80
 */
export function S2C_QueueLocationPacket11_6FCABF80_113c(
  m: Memory113c,
  bPacketId: number,
  bUnitType: number,
  dwUnitId: number,
  pClient: number,
  wX: number,
  wY: number,
  bFlag: number,
): number {
  hitD2GameVa113c(0x6FCABF80)
  const sp = k2W2B4StackPtr
  k2W2B4StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU8(sp, bPacketId & 0xff)
    m.setU8((sp + 0x01) >>> 0, bUnitType & 0xff)
    m.setU32((sp + 0x02) >>> 0, dwUnitId >>> 0)
    m.setU16((sp + 0x06) >>> 0, wX & 0xffff)
    m.setU16((sp + 0x08) >>> 0, wY & 0xffff)
    m.setU8((sp + 0x0a) >>> 0, bFlag & 0xff)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, sp, 0x0b) | 0
  } finally {
    k2W2B4StackPtr = sp
  }
}

/**
 * Zeros a 12-byte (`0x0C`) S2C packet buffer, populates `[u8 bPacketId, u32 dwUnitId, u8 bByte5, u8 bByte6, u32 dwField7, u8 bByte11]`,
 * and queues it to `pClient` via `0x6FCAA3E0` (`cl = bPacketId, edx = dwUnitId, [esp+4] = pClient, [esp+8] = bByte5, [esp+0xC] = bByte6, [esp+0x10] = dwField7, [esp+0x14] = bByte11`).
 *
 * @va D2Game.dll@0x6fcac160
 */
export function S2C_QueueMonsterMovePacket12_6FCAC160_113c(
  m: Memory113c,
  bPacketId: number,
  dwUnitId: number,
  pClient: number,
  bByte5: number,
  bByte6: number,
  dwField7: number,
  bByte11: number,
): number {
  hitD2GameVa113c(0x6FCAC160)
  const sp = k2W2B4StackPtr
  k2W2B4StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0)
    m.setU32((sp + 0x08) >>> 0, 0)
    m.setU8(sp, bPacketId & 0xff)
    m.setU32((sp + 0x01) >>> 0, dwUnitId >>> 0)
    m.setU8((sp + 0x05) >>> 0, bByte5 & 0xff)
    m.setU8((sp + 0x06) >>> 0, bByte6 & 0xff)
    m.setU8((sp + 0x0b) >>> 0, bByte11 & 0xff)
    m.setU32((sp + 0x07) >>> 0, dwField7 >>> 0)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, sp, 0x0c) | 0
  } finally {
    k2W2B4StackPtr = sp
  }
}

/**
 * Builds a 16-byte (`0x10`) S2C unit-target movement packet `[u8 bPacketId, u8 bUnitType, u32 dwUnitId, u8 bMoveType, u8 bTargetType, u32 dwTargetId, u16 wX, u16 wY]`
 * and queues it to `pClient` via `0x6FCAA3E0` (`al = bPacketId, cl = bUnitType, edx = dwUnitId, [esp+4..0x18] = pClient, bMoveType, bTargetType, dwTargetId, wX, wY`).
 *
 * @va D2Game.dll@0x6fcac230
 */
export function S2C_QueueUnitTargetMovePacket16_6FCAC230_113c(
  m: Memory113c,
  bPacketId: number,
  bUnitType: number,
  dwUnitId: number,
  pClient: number,
  bMoveType: number,
  bTargetType: number,
  dwTargetId: number,
  wX: number,
  wY: number,
): number {
  hitD2GameVa113c(0x6FCAC230)
  const sp = k2W2B4StackPtr
  k2W2B4StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU8(sp, bPacketId & 0xff)
    m.setU8((sp + 0x01) >>> 0, bUnitType & 0xff)
    m.setU32((sp + 0x02) >>> 0, dwUnitId >>> 0)
    m.setU8((sp + 0x06) >>> 0, bMoveType & 0xff)
    m.setU8((sp + 0x07) >>> 0, bTargetType & 0xff)
    m.setU32((sp + 0x08) >>> 0, dwTargetId >>> 0)
    m.setU16((sp + 0x0c) >>> 0, wX & 0xffff)
    m.setU16((sp + 0x0e) >>> 0, wY & 0xffff)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, sp, 0x10) | 0
  } finally {
    k2W2B4StackPtr = sp
  }
}

/**
 * Builds a 6-byte (`0x06`) S2C packet `[u8 bPacketId, u8 bSubType, u32 dwValue]` and queues it to `pClient`
 * via `0x6FCAA3E0` (`al = bPacketId, cl = bSubType, edx = dwValue, [esp+4] = pClient`).
 *
 * @va D2Game.dll@0x6fcac3b0
 */
export function S2C_QueueByteDwordPacket6_6FCAC3B0_113c(
  m: Memory113c,
  bPacketId: number,
  bSubType: number,
  dwValue: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAC3B0)
  const sp = k2W2B4StackPtr
  k2W2B4StackPtr = (sp + 0x08) >>> 0
  try {
    m.setU8(sp, bPacketId & 0xff)
    m.setU8((sp + 0x01) >>> 0, bSubType & 0xff)
    m.setU32((sp + 0x02) >>> 0, dwValue >>> 0)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, sp, 0x06) | 0
  } finally {
    k2W2B4StackPtr = sp
  }
}

/**
 * Builds a 1-byte (`0x01`) S2C packet `[u8 bPacketId]` and queues it to `pClient`
 * via `0x6FCAA3E0` (`al = bPacketId, [esp+4] = pClient`).
 *
 * @va D2Game.dll@0x6fcac490
 */
export function S2C_QueueSingleBytePacket1_6FCAC490_113c(
  m: Memory113c,
  bPacketId: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAC490)
  const sp = k2W2B4StackPtr
  k2W2B4StackPtr = (sp + 0x04) >>> 0
  try {
    m.setU8(sp, bPacketId & 0xff)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, sp, 0x01) | 0
  } finally {
    k2W2B4StackPtr = sp
  }
}

/**
 * Resolves `pClient` from player unit `pPlayer` (`edx`) via `UNITS_GetPlayerData(pPlayer)->pNetClient` (`+0x9C`)
 * and queues a 10-byte (`0x0A`) packet from `pPacket` (`[esp+4]`) via `0x6FCAA3E0`.
 *
 * @va D2Game.dll@0x6fcac530
 */
export function S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c(
  m: Memory113c,
  pPlayer: number,
  pPacket: number,
): number {
  hitD2GameVa113c(0x6FCAC530)
  const pClient = getClientFromPlayerUnitInline113c(m, pPlayer)
  return NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket >>> 0, 0x0a) | 0
}

/**
 * Resolves `pClient` from player unit `pPlayer` (`edx`) via `UNITS_GetPlayerData(pPlayer)->pNetClient` (`+0x9C`)
 * and queues a 7-byte (`0x07`) packet from `pPacket` (`[esp+4]`) via `0x6FCAA3E0`.
 *
 * @va D2Game.dll@0x6fcac5f0
 */
export function S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c(
  m: Memory113c,
  pPlayer: number,
  pPacket: number,
): number {
  hitD2GameVa113c(0x6FCAC5F0)
  const pClient = getClientFromPlayerUnitInline113c(m, pPlayer)
  return NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket >>> 0, 0x07) | 0
}

/**
 * Resolves `pClient` from player unit `pPlayer` (`edx`) via `UNITS_GetPlayerData(pPlayer)->pNetClient` (`+0x9C`)
 * and queues an 11-byte (`0x0B`) packet from `pPacket` (`[esp+4]`) via `0x6FCAA3E0`.
 *
 * @va D2Game.dll@0x6fcac690
 */
export function S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c(
  m: Memory113c,
  pPlayer: number,
  pPacket: number,
): number {
  hitD2GameVa113c(0x6FCAC690)
  const pClient = getClientFromPlayerUnitInline113c(m, pPlayer)
  return NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket >>> 0, 0x0b) | 0
}

/**
 * Asserts `D2GAME_GetClientFromPlayer(pPlayer) == pClient` (line `0x85C` = 2140) and sends S2C `0x9C`
 * world item action `0x0E` (belt remove) via `0x6FCAD3D0` (`eax = pPlayer, ecx = pClient, edx = pItem, [esp+4] = nCmdFlags`).
 *
 * @va D2Game.dll@0x6fcade50
 */
export function ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c(
  m: Memory113c,
  pPlayer: number,
  pClient: number,
  pItem: number,
  nCmdFlags: number,
): void {
  hitD2GameVa113c(0x6FCADE50)
  const pResolvedClient = getClientFromPlayerUnitInline113c(m, pPlayer)
  if (pResolvedClient !== (pClient >>> 0)) {
    throw new D2CommonAssertError('SendPacket.cpp', 0x85c)
  }
  S2C_SendPacket9C_ItemActionWorld113c(m, pClient >>> 0, pItem >>> 0, 0x0e, nCmdFlags, 0)
}

/**
 * Asserts `D2GAME_GetClientFromPlayer(pPlayer) == pClient` (line `0x853` = 2131) and sends S2C `0x9C`
 * world item action `0x0D` (swap in container) via `0x6FCAD3D0` (`eax = pPlayer, ecx = pClient, edx = pItem, [esp+4] = nCmdFlags`).
 *
 * @va D2Game.dll@0x6fcadeb0
 */
export function ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c(
  m: Memory113c,
  pPlayer: number,
  pClient: number,
  pItem: number,
  nCmdFlags: number,
): void {
  hitD2GameVa113c(0x6FCADEB0)
  const pResolvedClient = getClientFromPlayerUnitInline113c(m, pPlayer)
  if (pResolvedClient !== (pClient >>> 0)) {
    throw new D2CommonAssertError('SendPacket.cpp', 0x853)
  }
  S2C_SendPacket9C_ItemActionWorld113c(m, pClient >>> 0, pItem >>> 0, 0x0d, nCmdFlags, 0)
}

/**
 * Asserts `D2GAME_GetClientFromPlayer(pPlayer) == pClient` (line `0x849` = 2121) and sends S2C `0x9C`
 * world item action `0x0A` (remove from container) via `0x6FCAD3D0` (`eax = pPlayer, ecx = pClient, edx = pItem, [esp+4] = nCmdFlags`).
 *
 * @va D2Game.dll@0x6fcadf10
 */
export function ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c(
  m: Memory113c,
  pPlayer: number,
  pClient: number,
  pItem: number,
  nCmdFlags: number,
): void {
  hitD2GameVa113c(0x6FCADF10)
  const pResolvedClient = getClientFromPlayerUnitInline113c(m, pPlayer)
  if (pResolvedClient !== (pClient >>> 0)) {
    throw new D2CommonAssertError('SendPacket.cpp', 0x849)
  }
  S2C_SendPacket9C_ItemActionWorld113c(m, pClient >>> 0, pItem >>> 0, 0x0a, nCmdFlags, 0)
}

/**
 * Asserts `D2GAME_GetClientFromPlayer(pPlayer) == pClient` (line `0x7EF` = 2031) and sends S2C `0x9C`
 * world item action `0x04` (put in cursor) via `0x6FCAD3D0` (`eax = pPlayer, ecx = pClient, edx = pItem, [esp+4] = nCmdFlags`).
 *
 * @va D2Game.dll@0x6fcadf70
 */
export function ITEMS_SendCursorPutItemPacket04_6FCADF70_113c(
  m: Memory113c,
  pPlayer: number,
  pClient: number,
  pItem: number,
  nCmdFlags: number,
): void {
  hitD2GameVa113c(0x6FCADF70)
  const pResolvedClient = getClientFromPlayerUnitInline113c(m, pPlayer)
  if (pResolvedClient !== (pClient >>> 0)) {
    throw new D2CommonAssertError('SendPacket.cpp', 0x7ef)
  }
  S2C_SendPacket9C_ItemActionWorld113c(m, pClient >>> 0, pItem >>> 0, 0x04, nCmdFlags, 0)
}

/**
 * Asserts `D2GAME_GetClientFromPlayer(pPlayer) == pClient` (line `0x7E6` = 2022) and sends S2C `0x9C`
 * world item action `0x03` (on ground) via `0x6FCAD3D0` (`eax = pPlayer, ecx = pClient, edx = pItem, [esp+4] = nCmdFlags`).
 *
 * @va D2Game.dll@0x6fcadfd0
 */
export function ITEMS_SendGroundItemPacket03_6FCADFD0_113c(
  m: Memory113c,
  pPlayer: number,
  pClient: number,
  pItem: number,
  nCmdFlags: number,
): void {
  hitD2GameVa113c(0x6FCADFD0)
  const pResolvedClient = getClientFromPlayerUnitInline113c(m, pPlayer)
  if (pResolvedClient !== (pClient >>> 0)) {
    throw new D2CommonAssertError('SendPacket.cpp', 0x7e6)
  }
  S2C_SendPacket9C_ItemActionWorld113c(m, pClient >>> 0, pItem >>> 0, 0x03, nCmdFlags, 0)
}

/**
 * Asserts `D2GAME_GetClientFromPlayer(pPlayer) == pClient` (line `0x7DD` = 2013) and sends S2C `0x9C`
 * world item action `0x02` (drop to ground) via `0x6FCAD3D0` (`eax = pPlayer, ecx = pClient, edx = pItem, [esp+4] = nCmdFlags`).
 *
 * @va D2Game.dll@0x6fcae030
 */
export function ITEMS_SendDropToGroundPacket02_6FCAE030_113c(
  m: Memory113c,
  pPlayer: number,
  pClient: number,
  pItem: number,
  nCmdFlags: number,
): void {
  hitD2GameVa113c(0x6FCAE030)
  const pResolvedClient = getClientFromPlayerUnitInline113c(m, pPlayer)
  if (pResolvedClient !== (pClient >>> 0)) {
    throw new D2CommonAssertError('SendPacket.cpp', 0x7dd)
  }
  S2C_SendPacket9C_ItemActionWorld113c(m, pClient >>> 0, pItem >>> 0, 0x02, nCmdFlags, 0)
}

/**
 * Asserts `D2GAME_GetClientFromPlayer(pPlayer) == pClient` (line `0x7D2` = 2002), zeros `pItem`'s static path
 * X and Y coordinates (`UNITS_SetStaticPathPosX/Y(pItem, 0)`), and sends S2C `0x9C` world item action `0x01`
 * (pick up from ground) via `0x6FCAD3D0` (`eax = pPlayer, ecx = pItem, edx = pClient, [esp+4] = nCmdFlags`).
 *
 * @va D2Game.dll@0x6fcae090
 */
export function ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c(
  m: Memory113c,
  pPlayer: number,
  pItem: number,
  pClient: number,
  nCmdFlags: number,
): void {
  hitD2GameVa113c(0x6FCAE090)
  const pResolvedClient = getClientFromPlayerUnitInline113c(m, pPlayer)
  if (pResolvedClient !== (pClient >>> 0)) {
    throw new D2CommonAssertError('SendPacket.cpp', 0x7d2)
  }
  UNITS_SetStaticPathPosX113c(m, pItem >>> 0, 0)
  UNITS_SetStaticPathPosY113c(m, pItem >>> 0, 0)
  S2C_SendPacket9C_ItemActionWorld113c(m, pClient >>> 0, pItem >>> 0, 0x01, nCmdFlags, 0)
}

/**
 * Frees all slab chunks in `pGame->pTimerQueue->pSlabList` (`+0xA1C`, next link at `+0x7084`),
 * frees `pGame->pTimerQueue` (`+0xB8`), and nulls `pGame->pTimerQueue` (`edi = pGame`).
 *
 * @va D2Game.dll@0x6fcae4d0
 */
export function EVENT_DestroyTimerQueue_6FCAE4D0_113c(
  m: Memory113c,
  pGame: number,
  hooks?: K2W2B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FCAE4D0)
  const pTimerQueue = m.u32((pGame + 0xb8) >>> 0) >>> 0
  if (pTimerQueue === 0) {
    return
  }
  let pChunk = m.u32((pTimerQueue + 0xa1c) >>> 0) >>> 0
  while (pChunk !== 0) {
    const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
    const pNextChunk = m.u32((pChunk + 0x7084) >>> 0) >>> 0
    if (hooks !== undefined && hooks.freePoolMemory !== undefined) {
      hooks.freePoolMemory(m, pMemPool, pChunk, 0x6fd1bac8, 0x314, 0)
    }
    pChunk = pNextChunk
  }
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  if (hooks !== undefined && hooks.freePoolMemory !== undefined) {
    hooks.freePoolMemory(m, pMemPool, pTimerQueue, 0x6fd1bac8, 0x317, 0)
  }
  m.setU32((pGame + 0xb8) >>> 0, 0)
}

/**
 * Searches `pSlot->pList18` (`+0x18`, next at `+0x08`) for a node whose `[+0x00]` matches
 * `pTargetUnit ? pTargetUnit->dwUnitId : 0xFFFFFFFF`, or allocates and prepends a new 12-byte node
 * (`eax = pTargetUnit, edi = pSlot, [esp+4] = pGame`).
 *
 * @va D2Game.dll@0x6fcaf6c0
 */
export function SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c(
  m: Memory113c,
  pTargetUnit: number,
  pSlot: number,
  pGame: number,
  hooks?: K2W2B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FCAF6C0)
  const dwGuid = pTargetUnit === 0 ? 0xffffffff : m.u32((pTargetUnit + 0x0c) >>> 0) >>> 0
  let pNode = m.u32((pSlot + 0x18) >>> 0) >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) >>> 0) === dwGuid) {
      return pNode
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  const pNewNode =
    hooks !== undefined && hooks.allocPoolMemory !== undefined
      ? hooks.allocPoolMemory(m, pMemPool, 0x0c, 0x6fd1baa0, 0x4ed, 0) >>> 0
      : m.alloc(0x0c) >>> 0
  m.setU32(pNewNode, dwGuid)
  m.setU32((pNewNode + 0x08) >>> 0, m.u32((pSlot + 0x18) >>> 0))
  m.setU32((pSlot + 0x18) >>> 0, pNewNode)
  return pNewNode
}

/**
 * Resolves `nClassId = pNpcUnit ? pNpcUnit->dwClassId : -1` and delegates to `0x6FCAF5C0`
 * (`D2GAME_ARENA_FindPlayerSlotByUnit113c`) (`eax = pNpcUnit, ecx = pGame, [esp+4] = pOutIndex`).
 *
 * @va D2Game.dll@0x6fcaf820
 */
export function SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c(
  m: Memory113c,
  pNpcUnit: number,
  pGame: number,
  pOutIndex: number,
): number {
  hitD2GameVa113c(0x6FCAF820)
  const nClassId = pNpcUnit === 0 ? 0xffffffff : m.u32((pNpcUnit + 0x04) >>> 0) >>> 0
  return D2GAME_ARENA_FindPlayerSlotByUnit113c(m, pOutIndex >>> 0, pGame >>> 0, nClassId) >>> 0
}

/**
 * Finds the NPC proxy slot for `pNpcUnit` via `0x6FCAF5C0`, and if `pSlot != NULL` and `pSlot->dwCount` (`+0x0C`) != 0,
 * walks `pSlot->pPlayerList` (`+0x08`, next at `+0x08`) for `pNode->dwPlayerGuid` (`+0x04`) matching
 * `pPlayerUnit ? pPlayerUnit->dwUnitId : 0xFFFFFFFF`, returning `pNode->pData` (`+0x00`) (`eax = pNpcUnit, ecx = pGame, edi = pPlayerUnit`).
 *
 * @va D2Game.dll@0x6fcafaa0
 */
export function SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c(
  m: Memory113c,
  pNpcUnit: number,
  pGame: number,
  pPlayerUnit: number,
): number {
  hitD2GameVa113c(0x6FCAFAA0)
  const nClassId = pNpcUnit === 0 ? 0xffffffff : m.u32((pNpcUnit + 0x04) >>> 0) >>> 0
  const sp = k2W2B4StackPtr
  k2W2B4StackPtr = (sp + 0x04) >>> 0
  let pSlot = 0
  try {
    pSlot = D2GAME_ARENA_FindPlayerSlotByUnit113c(m, sp, pGame >>> 0, nClassId) >>> 0
  } finally {
    k2W2B4StackPtr = sp
  }
  if (pSlot === 0 || m.u32((pSlot + 0x0c) >>> 0) === 0) {
    return 0
  }
  const dwPlayerGuid = pPlayerUnit === 0 ? 0xffffffff : m.u32((pPlayerUnit + 0x0c) >>> 0) >>> 0
  let pNode = m.u32((pSlot + 0x08) >>> 0) >>> 0
  while (pNode !== 0) {
    if ((m.u32((pNode + 0x04) >>> 0) >>> 0) === dwPlayerGuid) {
      return m.u32(pNode) >>> 0
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  return 0
}

/**
 * Caps `pMissile`'s total/remaining frames at `0x4D` (77) when `>= 0x4E` (78), initializes `pMissile->pSeed` (`+0x20`)
 * with `dwSeed`, sets `pDynamicPath` type to `0x0A`, sets path distance to `nFrames`, and computes the path
 * (`ecx = pMissile, edx = dwSeed`).
 *
 * @va D2Game.dll@0x6fcb0ea0
 */
export function MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c(
  m: Memory113c,
  pMissile: number,
  dwSeed: number,
): void {
  hitD2GameVa113c(0x6FCB0EA0)
  if (pMissile === 0) {
    return
  }
  let nFrames = MISSILE_GetTotalFrames113c(m, pMissile >>> 0) | 0
  if (nFrames >= 0x4e) {
    nFrames = 0x4d
    MISSILE_SetTotalFrames113c(m, pMissile >>> 0, 0x4d)
    MISSILE_SetRemainingFrames113c(m, pMissile >>> 0, 0x4d)
  }
  const pPath = m.u32((pMissile + 0x2c) >>> 0) >>> 0
  SEED_InitLowSeed113c(m, (pMissile + 0x20) >>> 0, dwSeed)
  PATH_SetType113c(m, pPath, 0x0a)
  PATH_SetNewDistance113c(m, pPath, nFrames)
  PATH_Compute113c(m, pPath, pMissile >>> 0, 0)
}

/**
 * StatList expiration callback that clears `nState` in `pUnit`'s gfx state flags via `STATES_ToggleGfxStateFlag(pUnit, nState, 0)`
 * (`ecx = pUnit, edx = nState, [esp+4] = pStatList`).
 *
 * @va D2Game.dll@0x6fcb0f00
 */
export function STATES_ClearGfxStateFlagCallback_6FCB0F00_113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FCB0F00)
  void _pStatList
  STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, nState | 0, 0)
}

/**
 * StatList expiration callback that clears `nState` in `pUnit`'s gfx state flags and sets `UNITFLAG_SKSRVDOFUNC` (`0x40`)
 * on `pUnit->dwFlags` (`+0xC4`) when `pUnit != NULL` (`ecx = pUnit, edx = nState, [esp+4] = pStatList`).
 *
 * @va D2Game.dll@0x6fcb0f10
 */
export function STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FCB0F10)
  void _pStatList
  STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, nState | 0, 0)
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
}

/**
 * Validates `pUnit`'s path target unit in `pGame` via `0x6FD007A0` and returns `1` iff the target unit
 * is non-null and distinct from `pUnit` (`ecx = pGame, edx = pUnit, [esp+4] = nSkillId, [esp+8] = nSkillLevel`).
 *
 * @va D2Game.dll@0x6fcb1b40
 */
export function SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCB1B40)
  void _nSkillId
  void _nSkillLevel
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  return 1
}

/**
 * Validates `pUnit`'s path target unit in `pGame` via `0x6FD007A0` and, if non-null and distinct from `pUnit`,
 * tests `UNITS_CanUnitMeleeAttackTarget(pUnit, pTarget, 0)` (`ecx = pGame, edx = pUnit, [esp+4] = nSkillId, [esp+8] = nSkillLevel`).
 *
 * @va D2Game.dll@0x6fcb2030
 */
export function SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCB2030)
  void _nSkillId
  void _nSkillLevel
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  return UNITS_CanUnitMeleeAttackTarget113c(m, pUnit >>> 0, pTarget, 0) | 0
}

/**
 * Validates `pUnit`'s path target unit in `pGame` via `0x6FD007A0` and verifies that neither `pUnit` nor `pTarget`
 * is in a town room and that `pTarget->dwUnitType` is `0` (`UNIT_PLAYER`) or `1` (`UNIT_MONSTER`)
 * (`ecx = pGame, edx = pUnit, [esp+4] = nSkillId, [esp+8] = nSkillLevel`).
 *
 * @va D2Game.dll@0x6fcb2060
 */
export function SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCB2060)
  void _nSkillId
  void _nSkillLevel
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  const pUnitRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pUnitRoom) !== 0) {
    return 0
  }
  const pTargetRoom = UNITS_GetRoom113c(m, pTarget) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) !== 0) {
    return 0
  }
  const targetType = m.u32(pTarget) | 0
  if (targetType < 0 || targetType > 1) {
    return 0
  }
  return 1
}

/**
 * Bounds-checks `nPetType` (`eax`) against `sgptDataTables->nPetTypeTxtRecordCount` (`+0xBF0`) and returns
 * `&pPlayerPets->aPetTypes[nPetType]` (`*pPlayerPets + nPetType * 12`), or `0` if out of range (`eax = nPetType, [esp+4] = pPlayerPets`).
 *
 * @va D2Game.dll@0x6fcb6540
 */
export function SUMMON_GetPetTypeBucketPtr_6FCB6540_113c(
  m: Memory113c,
  nPetType: number,
  pPlayerPets: number,
): number {
  hitD2GameVa113c(0x6FCB6540)
  const petType = nPetType | 0
  if (petType < 0) {
    return 0
  }
  const pDataTables = resolveDataTablesPtr113c(m)
  const nPetTypeCount = m.u32((pDataTables + 0xbf0) >>> 0) | 0
  if (petType >= nPetTypeCount) {
    return 0
  }
  const pBucketsBase = m.u32(pPlayerPets >>> 0) >>> 0
  return (pBucketsBase + imul32(petType, 12)) >>> 0
}

/**
 * Resolves `pPlayerData = UNITS_GetPlayerData(pPlayer)` (asserting non-null at line `0x171` = 369) and returns
 * the first pet unit GUID (`pHead->dwPetGuid` at `+0x04`) in bucket `nPetType`, or `-1` if none exists
 * (`eax = pPlayer, esi = nPetType`).
 *
 * @va D2Game.dll@0x6fcb67b0
 */
export function SUMMON_GetFirstPetGuidForType_6FCB67B0_113c(
  m: Memory113c,
  pPlayer: number,
  nPetType: number,
): number {
  hitD2GameVa113c(0x6FCB67B0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('Summon.cpp', 0x171)
  }
  const pPlayerPets = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPlayerPets === 0) {
    return -1
  }
  const petType = nPetType | 0
  if (petType < 0) {
    return -1
  }
  const pDataTables = resolveDataTablesPtr113c(m)
  const nPetTypeCount = m.u32((pDataTables + 0xbf0) >>> 0) | 0
  if (petType >= nPetTypeCount) {
    return -1
  }
  const pBucketsBase = m.u32(pPlayerPets) >>> 0
  const pBucket = (pBucketsBase + imul32(petType, 12)) >>> 0
  if (pBucket === 0) {
    return -1
  }
  const pHead = m.u32(pBucket) >>> 0
  if (pHead === 0) {
    return -1
  }
  return m.u32((pHead + 0x04) >>> 0) | 0
}

/**
 * Returns `1` iff `pUnit->pInventory` (`+0x60`) is non-null and `INVENTORY_GetEquippedShield(pInventory, 0)` is non-null
 * (`ecx = pGame, edx = pUnit, [esp+4] = nSkillId, [esp+8] = nSkillLevel`).
 *
 * @va D2Game.dll@0x6fcb8390
 */
export function SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c(
  m: Memory113c,
  pUnit: number,
  _pGame = 0,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCB8390)
  void _pGame
  void _nSkillId
  void _nSkillLevel
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return 0
  }
  const pShield = INVENTORY_GetEquippedShield113c(m, pInventory, 0) >>> 0
  return pShield !== 0 ? 1 : 0
}

/**
 * Inspects `pSeq = ANIMSEQ_GetUnitSeqRecordPtr(pUnit)` and `nFrames = ANIMSEQ_GetUnitSeqFrameDataField8(pUnit)`:
 * per exact 1.13c codegen (`mov dl, [edi+5]` hoisted outside the `ecx` loop), returns `-1` if `nFrames > 0` and
 * `pSeq[5] == 0`, otherwise returns `7` (`esi = pUnit`).
 *
 * @va D2Game.dll@0x6fcb83b0
 */
export function SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c(
  m: Memory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCB83B0)
  const pSeq = ANIMSEQ_GetUnitSeqRecordPtr113c(m, pUnit >>> 0) >>> 0
  if (pSeq !== 0) {
    const nFrames = ANIMSEQ_GetUnitSeqFrameDataField8_113c(m, pUnit >>> 0) | 0
    if (nFrames > 0) {
      const dl = m.u8((pSeq + 0x05) >>> 0)
      for (let ecx = 0; ecx < nFrames; ecx = (ecx + 1) | 0) {
        if (dl === 0) {
          return (ecx - 1) | 0
        }
      }
    }
  }
  return 7
}

/**
 * Masks off bits `0x14` (`0xFFFFFFEB`) on `pItem->dwFlagEx` (`+0xC8`), clears all command flags listed in
 * `0x6FD2F0F0[0 .. *0x6FD2F0EC - 1]`, and clears all item flags listed in `0x6FD2F0CC[0 .. *0x6FD2F0C8 - 1]`
 * (`edi = pItem`).
 *
 * @va D2Game.dll@0x6fcbb340
 */
export function ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c(
  m: Memory113c,
  pItem: number,
): void {
  hitD2GameVa113c(0x6FCBB340)
  if (pItem !== 0) {
    m.setU32((pItem + 0xc8) >>> 0, (m.u32((pItem + 0xc8) >>> 0) & 0xffffffeb) >>> 0)
  }
  let nCmdFlagsCount = m.u32(D2GAME_ITEM_CLEAR_CMD_FLAGS_COUNT_VA_113C) >>> 0
  for (let i = 0; (i >>> 0) < nCmdFlagsCount; i = (i + 1) | 0) {
    const dwCmdFlag = m.u32((D2GAME_ITEM_CLEAR_CMD_FLAGS_ARRAY_VA_113C + (i << 2)) >>> 0)
    ITEMS_SetOrClearCommandFlags113c(m, pItem >>> 0, dwCmdFlag, 0)
    nCmdFlagsCount = m.u32(D2GAME_ITEM_CLEAR_CMD_FLAGS_COUNT_VA_113C) >>> 0
  }
  let nItemFlagsCount = m.u32(D2GAME_ITEM_CLEAR_FLAGS_COUNT_VA_113C) >>> 0
  for (let i = 0; (i >>> 0) < nItemFlagsCount; i = (i + 1) | 0) {
    const dwItemFlag = m.u32((D2GAME_ITEM_CLEAR_FLAGS_ARRAY_VA_113C + (i << 2)) >>> 0)
    ITEMS_SetItemFlag113c(m, pItem >>> 0, dwItemFlag, 0)
    nItemFlagsCount = m.u32(D2GAME_ITEM_CLEAR_FLAGS_COUNT_VA_113C) >>> 0
  }
}

/**
 * Splits `nGoldToAdd` (`eax`) for `pPlayer` (`ebx`) against `STATLIST_GetUnitGoldBankLimit(pPlayer)` and
 * current `STAT_GOLD` (`14`), writing the addable amount to `*pOutGoldToAdd` (`[esp+4]`) and any overflow
 * remainder to `*pOutRemainder` (`[esp+8]`).
 *
 * @va D2Game.dll@0x6fcbbc70
 */
export function PARTY_SplitGoldPickupByCap_6FCBBC70_113c(
  m: Memory113c,
  nGoldToAdd: number,
  pPlayer: number,
  pOutGoldToAdd: number,
  pOutRemainder: number,
): void {
  hitD2GameVa113c(0x6FCBBC70)
  const nGoldLimit = STATLIST_GetUnitGoldBankLimit113c(m, pPlayer >>> 0) | 0
  const nCurGold = STATLIST_GetUnitStat113c(m, pPlayer >>> 0, 0x0e, 0) | 0
  const nAdd = nGoldToAdd | 0
  const nTotal = (nCurGold + nAdd) | 0
  m.setU32(pOutRemainder >>> 0, 0)
  m.setU32(pOutGoldToAdd >>> 0, nAdd >>> 0)
  if (nTotal > nGoldLimit) {
    const nAllowed = (nGoldLimit - nCurGold) | 0
    const nOverflow = (nAdd - nAllowed) | 0
    m.setU32(pOutGoldToAdd >>> 0, nAllowed >>> 0)
    m.setU32(pOutRemainder >>> 0, nOverflow >>> 0)
  }
}

/**
 * Asserts `pSubParty != NULL` (line `0xE5` = 229) and walks `pSubParty->pMembers` (`+0x04`, next at `+0x04`)
 * returning `1` iff any member node has `dwUnitId == dwTargetUnitId` (`eax = pSubParty, ecx = dwTargetUnitId`).
 *
 * @va D2Game.dll@0x6fcbbcb0
 */
export function PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c(
  m: Memory113c,
  pSubParty: number,
  dwTargetUnitId: number,
): number {
  hitD2GameVa113c(0x6FCBBCB0)
  if (pSubParty === 0) {
    throw new D2CommonAssertError('Party.cpp', 0xe5)
  }
  const targetId = dwTargetUnitId >>> 0
  let pMember = m.u32((pSubParty + 0x04) >>> 0) >>> 0
  while (pMember !== 0) {
    if ((m.u32(pMember) >>> 0) === targetId) {
      return 1
    }
    pMember = m.u32((pMember + 0x04) >>> 0) >>> 0
  }
  return 0
}

/**
 * Reads `pPartyControl = pGame->pPartyControl` (`+0x1D2C`, asserting non-null at line `0xD2` = 210)
 * and walks `pPartyControl->pSubPartyHead` (`+0x04`, next at `+0x08`) returning the node whose
 * `wPartyId` (`+0x00`) equals `wPartyId & 0xFFFF`, or `0` if not found (`eax = pGame, cx = wPartyId`).
 *
 * @va D2Game.dll@0x6fcbbd00
 */
export function PARTY_FindSubPartyById_6FCBBD00_113c(
  m: Memory113c,
  pGame: number,
  wPartyId: number,
): number {
  hitD2GameVa113c(0x6FCBBD00)
  const pPartyControl = m.u32((pGame + 0x1d2c) >>> 0) >>> 0
  if (pPartyControl === 0) {
    throw new D2CommonAssertError('Party.cpp', 0xd2)
  }
  const targetPartyId = wPartyId & 0xffff
  let pNode = m.u32((pPartyControl + 0x04) >>> 0) >>> 0
  while (pNode !== 0) {
    if (m.u16(pNode) === targetPartyId) {
      return pNode
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  return 0
}

/**
 * Allocates the next unused `wPartyId >= 3` from `pGame->pPartyControl` (`+0x1D2C`), advancing past any colliding
 * sub-party nodes in `pPartyControl->pSubPartyHead` (`+0x04`, next at `+0x08`) and storing `wPartyId + 1` at `+0x00`
 * (`eax = pGame`).
 *
 * @va D2Game.dll@0x6fcbbd40
 */
export function PARTY_AllocNextPartyId_6FCBBD40_113c(m: Memory113c, pGame: number): number {
  hitD2GameVa113c(0x6FCBBD40)
  const pPartyControl = m.u32((pGame + 0x1d2c) >>> 0) >>> 0
  let wId = m.u16(pPartyControl)
  if (wId < 3) {
    wId = 3
  }
  const pHead = m.u32((pPartyControl + 0x04) >>> 0) >>> 0
  restartScan: while (true) {
    let pNode = pHead
    while (pNode !== 0) {
      if (m.u16(pNode) === (wId & 0xffff)) {
        wId = (wId + 1) & 0xffff
        if (wId < 3) {
          wId = 3
        }
        continue restartScan
      }
      pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
    }
    break
  }
  m.setU16(pPartyControl, (wId + 1) & 0xffff)
  return wId
}

/**
 * Asserts `pGame != NULL` (line `0x18` = 24) and `pGame->pPartyControl == NULL` (line `0x19` = 25),
 * allocates an 8-byte `D2PartyControlStrc` (asserting non-null at line `0x1B` = 27), initializes
 * `wNextPartyId = 3` (`+0x00`) and `pSubPartyHead = 0` (`+0x04`), and stores it at `pGame + 0x1D2C` (`esi = pGame`).
 *
 * @va D2Game.dll@0x6fcbbe40
 */
export function PARTY_AllocPartyControl_6FCBBE40_113c(
  m: Memory113c,
  pGame: number,
  hooks?: K2W2B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FCBBE40)
  if (pGame === 0) {
    throw new D2CommonAssertError('Party.cpp', 0x18)
  }
  if (m.u32((pGame + 0x1d2c) >>> 0) !== 0) {
    throw new D2CommonAssertError('Party.cpp', 0x19)
  }
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  const pPartyControl =
    hooks !== undefined && hooks.allocPoolMemory !== undefined
      ? hooks.allocPoolMemory(m, pMemPool, 0x08, 0x6fd1b9cc, 0x1a, 0) >>> 0
      : m.alloc(0x08) >>> 0
  if (pPartyControl === 0) {
    throw new D2CommonAssertError('Party.cpp', 0x1b)
  }
  m.setU32(pPartyControl, 0)
  m.setU32((pPartyControl + 0x04) >>> 0, 0)
  m.setU16(pPartyControl, 3)
  m.setU32((pGame + 0x1d2c) >>> 0, pPartyControl)
}

/**
 * 3-byte `ret 4` stub in `D2Game.dll` (`0x6FCBC990`).
 *
 * @va D2Game.dll@0x6fcbc990
 */
export function MONAI_NoOpStub_6FCBC990_113c(_m: Memory113c, _arg0 = 0): number {
  hitD2GameVa113c(0x6FCBC990)
  void _m
  void _arg0
  return 0
}

/**
 * Checks whether monster `pMonster` (`eax`) in mode `nMode` (`ecx`) can revive/teleport: returns `1` immediately
 * unless `nMode` is `10`, `11`, or `12`; if `bCheckBossFlag != 0` (`[esp+4]`) and `pMonster` has `pMonsterData->bTypeFlags & 0x02`
 * (`+0x16`), returns `0`; otherwise delegates to `SKILLS_CanMonsterReviveInMode2(pMonster ? pMonster->dwClassId : -1)`.
 *
 * @va D2Game.dll@0x6fcbc9a0
 */
export function SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c(
  m: Memory113c,
  pMonster: number,
  nMode: number,
  bCheckBossFlag: number,
): number {
  hitD2GameVa113c(0x6FCBC9A0)
  const mode = nMode | 0
  if (mode === 0 || (mode !== 0x0a && mode !== 0x0b && mode !== 0x0c)) {
    return 1
  }
  if (bCheckBossFlag !== 0) {
    if (pMonster === 0) {
      return SKILLS_CanMonsterReviveInMode2_113c(m, -1) | 0
    }
    if ((m.u32(pMonster >>> 0) >>> 0) === 1) {
      const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 0x02) !== 0) {
        return 0
      }
    }
  }
  const nClassId = pMonster === 0 ? -1 : m.u32((pMonster + 0x04) >>> 0) | 0
  return SKILLS_CanMonsterReviveInMode2_113c(m, nClassId) | 0
}

/**
 * Unit-find callback that checks if `pCandidate` (`[esp+4]`) is a living monster (`dwUnitType == 1`, `!MONSTERS_IsDead`)
 * distinct from `pSourceUnit` (`edx`) sharing the same `MONSTER_GetBaseIdFromUnit`, and if its squared subtile distance
 * to `pSourceUnit` is `< pBestCtx->nBestDistSq` (`+0x04`), updates `pBestCtx->pBestUnit` (`+0x00`) and `pBestCtx->nBestDistSq` (`+0x04`),
 * always returning `0`.
 *
 * @va D2Game.dll@0x6fcbca00
 */
export function SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c(
  m: Memory113c,
  pSourceUnit: number,
  pCandidate: number,
  pBestCtx: number,
): number {
  hitD2GameVa113c(0x6FCBCA00)
  const cand = pCandidate >>> 0
  const src = pSourceUnit >>> 0
  if (cand !== 0 && (m.u32(cand) >>> 0) === 1 && src !== cand) {
    const srcBaseId = MONSTER_GetBaseIdFromUnit113c(m, src) | 0
    const candBaseId = MONSTER_GetBaseIdFromUnit113c(m, cand) | 0
    if (srcBaseId === candBaseId && MONSTERS_IsDead113c(m, cand) === 0) {
      const distSq = UNIT_CalcSqDistSubtiles113c(m, src, cand) | 0
      const bestDistSq = m.u32((pBestCtx + 0x04) >>> 0) | 0
      if (distSq < bestDistSq) {
        m.setU32(pBestCtx >>> 0, cand)
        m.setU32((pBestCtx + 0x04) >>> 0, distSq >>> 0)
      }
    }
  }
  return 0
}

/**
 * Asserts `pRoom != NULL` (line `0x14E` = 334), retrieves `DUNGEON_GetAdjacentRoomsListFromRoom(pRoom, &ppRooms, &nRooms)`,
 * and calls `DUNGEON_RemoveClientFromRoom(ppRooms[i], pClient)` for each adjacent room (`eax = pRoom, edi = pClient`).
 *
 * @va D2Game.dll@0x6fcbd550
 */
export function CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c(
  m: Memory113c,
  pRoom: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FCBD550)
  if (pRoom === 0) {
    throw new D2CommonAssertError('Client.cpp', 0x14e)
  }
  const sp = k2W2B4StackPtr
  k2W2B4StackPtr = (sp + 0x08) >>> 0
  try {
    const pCountPtr = sp
    const ppRoomsPtr = (sp + 0x04) >>> 0
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom >>> 0, ppRoomsPtr, pCountPtr)
    let nCount = m.u32(pCountPtr) >>> 0
    for (let i = 0; (i >>> 0) < nCount; i = (i + 1) | 0) {
      const pRoomsArray = m.u32(ppRoomsPtr) >>> 0
      const pAdjRoom = m.u32((pRoomsArray + (i << 2)) >>> 0) >>> 0
      DUNGEON_RemoveClientFromRoom113c(m, pAdjRoom, pClient >>> 0)
      nCount = m.u32(pCountPtr) >>> 0
    }
  } finally {
    k2W2B4StackPtr = sp
  }
}

/**
 * Corpse unit-find filter callback that checks `SKILLS_IsSelectableCorpse11157(pUnit)` and, if non-zero,
 * delegates to `UNITFINDS_MatchUnitCandidate(pUnit, pSearch)` (`ecx = pUnit, edx = pSearch`).
 *
 * @va D2Game.dll@0x6fcbe2e0
 */
export function SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c(
  m: Memory113c,
  pUnit: number,
  pSearch: number,
): number {
  hitD2GameVa113c(0x6FCBE2E0)
  if (SKILLS_IsSelectableCorpse11157_113c(m, pUnit >>> 0) === 0) {
    return 0
  }
  return UNITFINDS_MatchUnitCandidate113c(m, pUnit >>> 0, pSearch >>> 0) | 0
}

/**
 * Evaluates `nLvl = SKILLS_GetSkillLevelByIdWithBonus(pUnit, nSkillId)` and writes
 * `[minPhysDmg >> 8, maxPhysDmg >> 8, toHitBonus]` into `pOutStats3Dwords[0..2]`
 * (`esi = nSkillId, edi = pUnit, [esp+4] = pOutStats3Dwords`).
 *
 * @va D2Game.dll@0x6fcbe330
 */
export function SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c(
  m: Memory113c,
  nSkillId: number,
  pUnit: number,
  pOutStats3Dwords: number,
): number {
  hitD2GameVa113c(0x6FCBE330)
  const nLvl = SKILLS_GetSkillLevelByIdWithBonus113c(m, pUnit >>> 0, nSkillId | 0) | 0
  const minDmg = (SKILLS_GetSkillPhysMinDamage113c(m, pUnit >>> 0, nSkillId | 0, nLvl, 1) | 0) >> 8
  m.setU32(pOutStats3Dwords >>> 0, minDmg >>> 0)
  const maxDmg = (SKILLS_GetSkillPhysMaxDamage113c(m, pUnit >>> 0, nSkillId | 0, nLvl, 1) | 0) >> 8
  m.setU32((pOutStats3Dwords + 0x04) >>> 0, maxDmg >>> 0)
  const toHit = SKILLS_GetSkillToHitBonus113c(m, pUnit >>> 0, nSkillId | 0, nLvl) | 0
  m.setU32((pOutStats3Dwords + 0x08) >>> 0, toHit >>> 0)
  return toHit
}

/**
 * Walks all skills on `pUnit->pSkillList` (`+0xA8`), and for each skill whose `SKILLS_GetPassiveState(nSkillId)` is `> 0`,
 * enables that gfx state flag on `pUnit` (`STATES_ToggleGfxStateFlag(pUnit, nState, 1)`) and applies the monster skill icon
 * (`STATES_ApplyMonSkillIconToUnit(pUnit, nSkillId)`) (`ebx = pUnit`).
 *
 * @va D2Game.dll@0x6fcbe370
 */
export function SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c(
  m: Memory113c,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCBE370)
  const pSkillList = m.u32((pUnit + 0xa8) >>> 0) >>> 0
  if (pSkillList === 0) {
    return
  }
  let pSkill = SKILLS_GetFirstSkillFromSkillList113c(m, pSkillList) >>> 0
  while (pSkill !== 0) {
    const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0x6fd1b980, 0x1153) | 0
    const nState = SKILLS_GetPassiveState113c(m, nSkillId) | 0
    if (nState > 0) {
      STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, nState, 1)
      STATES_ApplyMonSkillIconToUnit113c(m, pUnit >>> 0, nSkillId)
    }
    pSkill = SKILLS_GetNextSkill113c(m, pSkill) >>> 0
  }
}

/**
 * Bounds-checks `nSrvDoFunc` (`eax`) in `[0, 0xBF)` and dispatches `gpSrvDoFuncTable[nSrvDoFunc]` (`0x6FD274A8`)
 * with `(pGame, pUnit, nSkillId, nSkillLevel)` when non-null (`eax = nSrvDoFunc, ecx = pGame, edx = pUnit, [esp+4] = nSkillId, [esp+8] = nSkillLevel`).
 *
 * @va D2Game.dll@0x6fcbe420
 */
export function SKILLS_DispatchSrvDoFunc_6FCBE420_113c(
  m: Memory113c,
  nSrvDoFunc: number,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2W2B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FCBE420)
  const idx = nSrvDoFunc | 0
  if (idx < 0 || idx >= 0xbf) {
    return idx
  }
  const pfn = m.u32((D2GAME_SRVDOFUNC_TABLE_VA_113C + (idx << 2)) >>> 0) >>> 0
  if (pfn === 0) {
    return 0
  }
  if (hooks !== undefined && hooks.onSrvDoFunc !== undefined) {
    return hooks.onSrvDoFunc(m, pfn, pGame >>> 0, pUnit >>> 0, nSkillId | 0, nSkillLevel | 0) | 0
  }
  return pfn | 0
}

/**
 * Rotates `(x, y)` at `(*pX, *pY)` (`ebx = pX, edi = pY`) 90 degrees (`newX = *pY, newY = -*pX`)
 * and repeatedly divides both components by 2 toward zero (`(v - (v >> 31)) >> 1`) while
 * `newX * newX + newY * newY > 3`, storing the normalized vector back to `(*pX, *pY)`.
 *
 * @va D2Game.dll@0x6fcbe450
 */
export function VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c(
  m: Memory113c,
  pX: number,
  pY: number,
): void {
  hitD2GameVa113c(0x6FCBE450)
  let ecx = (-(m.u32(pX >>> 0) | 0)) | 0
  let esi = m.u32(pY >>> 0) | 0
  let sq = (imul32(ecx, ecx) + imul32(esi, esi)) | 0
  while (sq > 3) {
    esi = ((esi - (esi >> 31)) | 0) >> 1
    ecx = ((ecx - (ecx >> 31)) | 0) >> 1
    sq = (imul32(ecx, ecx) + imul32(esi, esi)) | 0
  }
  m.setU32(pX >>> 0, esi >>> 0)
  m.setU32(pY >>> 0, ecx >>> 0)
}

/**
 * Scales the 2D integer vector `(*pX, *pY)` (`esi = pX, edx = pY`) up in place: if `x*x + y*y < 4`,
 * multiplies both components by 4 (`<< 2`) and recomputes `x*x + y*y`; if `x*x + y*y < 16`,
 * multiplies both components by 2 (`<< 1`).
 *
 * @va D2Game.dll@0x6fcbe490
 */
export function VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c(
  m: Memory113c,
  pX: number,
  pY: number,
): void {
  hitD2GameVa113c(0x6FCBE490)
  let ecx = m.u32(pX >>> 0) | 0
  let eax = m.u32(pY >>> 0) | 0
  let sq = (imul32(eax, eax) + imul32(ecx, ecx)) | 0
  if (sq < 4) {
    const x4 = (ecx << 2) | 0
    m.setU32(pX >>> 0, x4 >>> 0)
    const y4 = ((m.u32(pY >>> 0) | 0) << 2) | 0
    m.setU32(pY >>> 0, y4 >>> 0)
    ecx = m.u32(pX >>> 0) | 0
    sq = (imul32(y4, y4) + imul32(ecx, ecx)) | 0
  }
  if (sq < 16) {
    const x2 = (ecx + ecx) | 0
    m.setU32(pX >>> 0, x2 >>> 0)
    const y2 = ((m.u32(pY >>> 0) | 0) << 1) | 0
    m.setU32(pY >>> 0, y2 >>> 0)
  }
}
