/**
 * Diablo II v1.13c `D2Game.dll` Boot/Init & Event/Sync Coverage Gap Closure Part 1 (36 VAs).
 *
 * Strictly binary-isomorphic 1:1 ports of `D2Game.dll` (`0x6FC2BD10..0x6FCBD5B0`).
 * Pure `Memory113c` execution with zero legacy module dependencies.
 */
import { COLLISION_FindFreeCoordsNear113c } from '../common/collision.ts'
import { UNITS_GetObjectShrineTxt113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { DRLGPRESET_FreeSaveHeaderBlock113c } from '../common/drlg/preset.ts'
import {
  DUNGEON_AreAllAdjacentRoomsActive113c,
  DUNGEON_FreeRoomPortalList113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_GetRoomExFromRoom113c,
} from '../common/dungeon.ts'
import { ENV_GetCycleState113c, ENV_StepCycle113c } from '../common/env.ts'
import { imul32, sar32 } from '../common/int-math.ts'
import {
  INVENTORY_GetCorpseUnitId113c,
  INVENTORY_GetFirstCorpse113c,
  INVENTORY_GetLeftItemGuid113c,
  INVENTORY_GetNextCorpse113c,
} from '../common/inventory.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import { PATH_GetTargetTypeAndPosition113c, PATH_GetVelocity113c } from '../common/path.ts'
import {
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
} from '../common/skills.ts'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  STATES_CheckState113c,
  STATES_CheckStateMask2OnUnit113c,
  STATLIST_CheckUnitStatListFlag100113c,
  STATLIST_ClearBaseStats113c,
  STATLIST_CopyBaseStatsToBuffer113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetUnitStat113c,
  STATLIST_NotifyIfStatModified113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_GetGfxStateFlagsPtr113c,
  UNITS_GetStateFlagsPtr113c,
  UNITS_HasAnyGfxStateFlag113c,
  UNITS_SetUnitUpdateFlags113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import { D2EventStrc, D2GameStrc, D2TimerStrc } from '../mem/layout.generated.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { seedRoll } from '../prng.ts'
import {
  AIGENERAL_ExpireMinionListsInAct113c,
  ITEMS_ExpireGroundItemsInAct113c,
} from './combat-a1c-113c.ts'
import { AIGENERAL_PopAiCommand113c } from './replay-kernel-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  MONSTER_DispatchEvent113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
  type MonsterEventCallbacks113c,
} from './monster-events.ts'
import {
  MONSTER_SpawnAtCoords113c,
  MONSTATS2_CheckFlagBit113c,
  MONSTATS_GetRecordPtr113c,
  MONSTATS_ValidateClassId113c,
  QUEST_Act4DiabloSealCheck113c,
  REGPOP_FindPackSpawnCoords113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import {
  EVENT_FLAG_DEFERRED_FREE,
  EVENT_FLAG_FIRING,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'

/** Scratch stack region for local structs/buffers in boot/init gap functions. */
let bootInitGapStackPtr = 0x7fb00000

/** `D2Game.dll` `.rdata` table `dword[9]` at `0x6FD1BBF0` used by `MONSTER_GetHirelingLevelBonusFactor113c`. */
export const HIRELING_BONUS_TABLE_6FD1BBF0: readonly number[] = [0, 0, 8, 16, 24, 32, 40, 48, 56]

/** `D2Game.dll` `.data` pointer `gpPerfTickRateArray` at `0x6FD27D30`. */
export const D2GAME_PERF_TICK_ARRAY_PTR_VA_113C = 0x6fd27d30
/** `D2Game.dll` `.bss` accumulator `gdwTotalMemPoolBytes` at `0x6FD4DC28`. */
export const D2GAME_TOTAL_MEMPOOL_BYTES_VA_113C = 0x6fd4dc28
/** `D2Game.dll` `.data` flag `gbDisableClientTimeout` at `0x6FD286A0`. */
export const D2GAME_DISABLE_CLIENT_TIMEOUT_VA_113C = 0x6fd286a0
/** `D2Game.dll` `.data` minion component callback table ptr (`0x6FD27D14`) and count (`0x6FD2A7E0`). */
export const D2GAME_MINION_COMP_TABLE_PTR_VA_113C = 0x6fd27d14
export const D2GAME_MINION_COMP_COUNT_VA_113C = 0x6fd2a7e0

/** Optional external hooks for callees outside the 36 target VAs. */
export interface BootInitGapACallees113c {
  readonly regpop?: RegpopSpawnHooks113c
  readonly monsterEvents?: MonsterEventCallbacks113c
  readonly spawnRestoredBossOrMinion?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    pRec: number,
  ) => void
  readonly relocateRestoredUnit?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    x: number,
    y: number,
    pRoom: number,
  ) => void
  readonly deleteRestoredUnit?: (m: Memory113c, pGame: number, pUnit: number) => void
  readonly postRestoreMonsterHook?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pRec: number,
    bDead: number,
  ) => void
  readonly onComponentCallback?: (
    m: Memory113c,
    pfn: number,
    pGame: number,
    pUnit: number,
    pNode: number,
    bFlag: number,
  ) => void
  readonly onComponentFree?: (
    m: Memory113c,
    pfnFree: number,
    pGame: number,
    pUnit: number,
    pNode: number,
  ) => void
  readonly getTickCountMs?: (m: Memory113c) => number
  readonly getClientPartyId?: (m: Memory113c, pUnit: number) => number
  readonly syncPlayerPartyRelations?: (
    m: Memory113c,
    pGame: number,
    pNewClient: number,
    pOtherClient: number,
  ) => void
  readonly sendCorpseSyncPacket?: (
    m: Memory113c,
    pClient: number,
    dwPlayerId: number,
    dwCorpseId: number,
  ) => void
  readonly onPostClientJoinSync?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    pUnit: number,
  ) => void
  readonly checkAct2EclipseQuest?: (m: Memory113c, pGame: number) => number
  readonly disconnectClient?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    nReason: number,
  ) => void
  readonly stepPlayerClientTick?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pClient: number,
  ) => void
  readonly stepJoinState1Or2?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    dwTickMs: number,
  ) => number
  readonly stepJoinState3Ready?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    dwTickMs: number,
  ) => number
  readonly spawnSuperUniqueById?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    x: number,
    y: number,
    nSuperUniqueId: number,
  ) => number
  readonly pickEvilUrnMonsterClassId?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    pMonReg: number,
  ) => number
  readonly spawnPresetPack?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    nClassId: number,
    x: number,
    y: number,
    bFlag1: number,
  ) => number
  readonly getQuestDescriptor?: (m: Memory113c, pGame: number, nQuestId: number) => number
  readonly onObjectQuestSync?: (
    m: Memory113c,
    pGame: number,
    pObject: number,
    pClient: number,
  ) => void
  readonly onStatModifiedNotify?: (
    m: Memory113c,
    pUnit: number,
    nStatId: number,
    nVal: number,
    pClient: number,
  ) => void
  readonly sendLifeManaStaminaPacket?: (
    m: Memory113c,
    pClient: number,
    pUnit: number,
    curLife: number,
    curMana: number,
    curStamina: number,
  ) => void
  readonly sendUnitEventSound?: (
    m: Memory113c,
    pClient: number,
    pUnit: number,
    wSound: number,
  ) => void
  readonly syncUnitFlag8000?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    pUnit: number,
  ) => void
  readonly sendUnitUpdateFlagsPacket?: (
    m: Memory113c,
    pClient: number,
    pUnit: number,
  ) => void
  readonly onNotifyOpcode?: (
    m: Memory113c,
    opcode: number,
    pClient: number,
    pUnit: number,
    pNode: number,
  ) => void
  readonly onUnitFullSyncPreSwitch?: (
    m: Memory113c,
    dwUnitType: number,
    pClient: number,
    pUnit: number,
    dwFlags: number,
  ) => void
  readonly onUnitFullSyncPostSwitch?: (
    m: Memory113c,
    dwUnitType: number,
    pClient: number,
    pUnit: number,
    dwFlags: number,
  ) => void
  readonly dispatchPlayerEvent?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
  ) => void
  readonly dispatchMonsterEvent?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
  ) => void
  readonly dispatchObjectEvent?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
  ) => void
  readonly dispatchMissileEvent?: (
    m: Memory113c,
    pfnHandler: number,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
  ) => void
  readonly dispatchItemEvent?: (
    m: Memory113c,
    pfnHandler: number,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
  ) => void
}

/** `Fog.#10046` (`D2FreePoolMem`): pool free is a no-op on sparse/bump memory. */
function fogFreeMemPool113c(_m: Memory113c, _ptr: number): void {}

/** Reads a signed 16-bit integer (`int16_t`) from `Memory113c`. */
function readI16(m: Memory113c, p: number): number {
  return (m.u16(p >>> 0) << 16) >> 16
}

/** `Fog.#10126`: initializes `D2BitBufferStrc` (`20 B`) for `pBuffer`/`nBytes`. */
function fogInitBitBuffer113c(
  m: Memory113c,
  pBitStream: number,
  pBuffer: number,
  nBytes: number,
): void {
  const bs = pBitStream >>> 0
  m.setU32(bs, pBuffer >>> 0)
  m.setU32((bs + 0x04) >>> 0, ((nBytes | 0) << 3) >>> 0)
  m.setU32((bs + 0x08) >>> 0, 0)
  m.setU32((bs + 0x0c) >>> 0, 0)
  m.setU32((bs + 0x10) >>> 0, 0)
}

/** `Fog.#10127`: returns current serialized byte count `nPos + (nPosBits !== 0 ? 1 : 0)`. */
function fogGetBitBufferSize113c(m: Memory113c, pBitStream: number): number {
  const bs = pBitStream >>> 0
  const nPos = m.u32((bs + 0x08) >>> 0) | 0
  return m.u32((bs + 0x0c) >>> 0) !== 0 ? (nPos + 1) | 0 : nPos
}

/** `Fog.#10128`: writes `nBits` of `nValue` into `D2BitBufferStrc` (`pBitStream`). */
function fogWriteBits113c(m: Memory113c, pBitStream: number, nValue: number, nBits: number): void {
  const esi = pBitStream >>> 0
  const ecx = m.u32((esi + 0x0c) >>> 0) | 0
  const edx = m.u32((esi + 0x08) >>> 0) | 0
  const eax = m.u32((esi + 0x04) >>> 0) | 0
  let ebp = nBits | 0
  const newBitTotal = (ecx + (edx << 3) + ebp) | 0
  if (newBitTotal > eax) {
    m.setU32((esi + 0x10) >>> 0, 1)
    m.setU32((esi + 0x08) >>> 0, sar32((eax + ((eax >> 31) & 7)) | 0, 3) >>> 0)
    m.setU32((esi + 0x0c) >>> 0, 0)
    return
  }
  if (ecx === 0) {
    m.setU8(m.u32((esi + 0x00) >>> 0), 0)
  }
  if (ebp <= 0) return
  let ebx = nValue | 0
  while (ebp > 0) {
    const curBit = m.u32((esi + 0x0c) >>> 0) | 0
    let chunk = (8 - curBit) | 0
    if (chunk > ebp) chunk = ebp
    const mask = ((1 << chunk) - 1) & 0xff
    const edi = m.u32((esi + 0x00) >>> 0)
    const dl = ((ebx & mask) << (curBit & 31)) & 0xff
    m.setU8(edi, (m.u8(edi) | dl) & 0xff)
    const nextBit = (curBit + chunk) | 0
    m.setU32((esi + 0x0c) >>> 0, nextBit >>> 0)
    if (nextBit === 8) {
      const newBuf = (m.u32((esi + 0x00) >>> 0) + 1) >>> 0
      const newPos = (m.u32((esi + 0x08) >>> 0) + 1) | 0
      const maxBits = m.u32((esi + 0x04) >>> 0) | 0
      m.setU32((esi + 0x08) >>> 0, newPos >>> 0)
      m.setU32((esi + 0x00) >>> 0, newBuf)
      m.setU32((esi + 0x0c) >>> 0, 0)
      if ((newPos << 3) < maxBits) {
        m.setU8(newBuf, 0)
      }
    }
    ebp = (ebp - chunk) | 0
    ebx = sar32(ebx, chunk & 31)
  }
}

/** `Fog.#10252`: returns lowest set bit index `0..31` of `mask`, or `-1` when `mask == 0`. */
function fogBitScanForward113c(mask: number): number {
  const v = mask >>> 0
  if (v === 0) return -1
  const lowest = (v & -v) >>> 0
  return (31 - Math.clz32(lowest)) | 0
}

/** `Storm.#501` (`SStrCopy`): copies up to `maxLen - 1` bytes and null-terminates `dst`. */
function stormStrCopy113c(m: Memory113c, dst: number, src: number, maxLen: number): number {
  const limit = maxLen | 0
  if (limit <= 0 || dst === 0) return 0
  let i = 0
  if (src !== 0) {
    for (; i < limit - 1; i++) {
      const ch = m.u8((src + i) >>> 0)
      if (ch === 0) break
      m.setU8((dst + i) >>> 0, ch)
    }
  }
  m.setU8((dst + i) >>> 0, 0)
  return i
}

/** `D2Game` `seedRoll` on an in-memory `D2SeedStrc`. */
function seedRollMem113c(m: Memory113c, pSeed: number, nMax: number): number {
  const seed = { lo: m.u32(pSeed >>> 0) >>> 0, hi: m.u32((pSeed + 4) >>> 0) >>> 0 }
  const r = seedRoll(seed, nMax)
  m.setU32((pSeed + 4) >>> 0, seed.hi >>> 0)
  m.setU32(pSeed >>> 0, seed.lo >>> 0)
  return r
}

/**
 * Checks whether an object in `pRoom` should respawn or block room deactivation due to an active portal.
 *
 * @va D2Game:0x6FC2BD10
 */
export function OBJECT_CheckRespawnOrPortalInRoom113c(
  m: Memory113c,
  pUnit: number,
  pRoom: number,
): number {
  if (pUnit === 0 || pRoom === 0) return 1
  if (m.u32((pUnit + 0x10) >>> 0) !== 2) return 1
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) return 1

  const nClassId = pUnit !== 0 ? m.u32((pUnit + 0x04) >>> 0) | 0 : -1
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nClassId) >>> 0
  if (pObjTxt === 0) {
    throw new Error('OBJECT_CheckRespawnOrPortalInRoom113c: pObjTxt == NULL (line 620)')
  }

  const isRespawnableShrineOrWell =
    nClassId > 0x132
      ? nClassId === 0x18e
      : nClassId >= 0x130 || nClassId === 0x18 || nClassId === 0x9c

  if (isRespawnableShrineOrWell) {
    const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
    if (m.u8((pGame + 0x6d) >>> 0) >= 3) return 1
    const dwRespawnFrame = m.u32((pUnit + 0x7c) >>> 0) >>> 0
    const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
    if (dwRespawnFrame >= dwGameFrame) {
      UNITS_ChangeAnimMode113c(m, pUnit, 0)
      const dwNewFrame = (((m.u32((pObjTxt + 0xac) >>> 0) | 0) >> 8) + (dwGameFrame | 0)) >>> 0
      EVENT_SetEventFull113c(m, pGame, pUnit, 5, dwNewFrame, 0, 0, 0)
      return 1
    }
  }

  if (nClassId !== 0x3c) return 1
  const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if ((m.u8((pObjData + 0x04) >>> 0) & 3) !== 1) return 1
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pUnitRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
  return pUnitRoom === (pRoom >>> 0) ? 0 : 1
}

/**
 * Finds or allocates an `ActMonRegRoomNodeStrc` (`0x1C` bytes) in `pActMonReg` for `pRoom`'s coordinates.
 *
 * @va D2Game:0x6FC3E960
 */
export function MONREG_FindOrAllocActRoomNode113c(
  m: Memory113c,
  pActMonReg: number,
  _pGame: number,
  pRoom: number,
): number {
  if (pActMonReg === 0) return 0
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x20) >>> 0
  let x = 0
  let y = 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    x = m.u32(sp) >>> 0
    y = m.u32((sp + 4) >>> 0) >>> 0
  } finally {
    bootInitGapStackPtr = sp
  }

  const bucket = ((x + y) & 0xbf) >>> 0
  let pNode = m.u32((pActMonReg + bucket * 4) >>> 0) >>> 0
  while (pNode !== 0) {
    if (m.u32((pNode + 0x04) >>> 0) === x && m.u32((pNode + 0x08) >>> 0) === y) {
      return pNode
    }
    pNode = m.u32((pNode + 0x0c) >>> 0) >>> 0
  }

  pNode = m.alloc(0x1c) >>> 0
  m.setU32(pNode, 0)
  m.setU32((pNode + 0x04) >>> 0, x)
  m.setU32((pNode + 0x08) >>> 0, y)
  m.setU32((pNode + 0x0c) >>> 0, 0)
  m.setU32((pNode + 0x10) >>> 0, 0)
  const pOldTail = m.u32((pActMonReg + 0x304) >>> 0) >>> 0
  m.setU32((pNode + 0x14) >>> 0, pOldTail)
  m.setU32((pNode + 0x18) >>> 0, bucket)

  const pOldBucketHead = m.u32((pActMonReg + bucket * 4) >>> 0) >>> 0
  if (pOldBucketHead !== 0) {
    m.setU32((pOldBucketHead + 0x10) >>> 0, pNode)
  }
  m.setU32((pActMonReg + bucket * 4) >>> 0, pNode)

  if (m.u32((pActMonReg + 0x300) >>> 0) === 0) {
    m.setU32((pActMonReg + 0x300) >>> 0, pNode)
  }
  const pTail = m.u32((pActMonReg + 0x304) >>> 0) >>> 0
  if (pTail !== 0) {
    m.setU32((pTail + 0x0c) >>> 0, pNode)
  }
  m.setU32((pActMonReg + 0x304) >>> 0, pNode)
  m.setU32((pActMonReg + 0x308) >>> 0, (m.u32((pActMonReg + 0x308) >>> 0) + 1) >>> 0)
  return pNode
}

/**
 * Frees all saved monster records on `pNode`, unlinks `pNode` from `pActMonReg`, and frees `pNode`.
 *
 * @va D2Game:0x6FC3EA40
 */
export function MONREG_UnlinkAndFreeActRoomNode113c(
  m: Memory113c,
  pNode: number,
  pActMonReg: number,
  pGame: number,
): void {
  if (pActMonReg === 0 || pNode === 0) return

  let pRec = m.u32(pNode >>> 0) >>> 0
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0
  while (pRec !== 0) {
    const pNextRec = m.u32((pRec + 0x30) >>> 0) >>> 0
    const pSaveBlock = m.u32((pRec + 0x2c) >>> 0) >>> 0
    if (pSaveBlock !== 0) {
      DRLGPRESET_FreeSaveHeaderBlock113c(m, pMemPool, pSaveBlock)
    }
    fogFreeMemPool113c(m, pRec)
    pRec = pNextRec
  }
  m.setU32(pNode >>> 0, 0)

  const bucket = m.u32((pNode + 0x18) >>> 0) >>> 0
  const pNext0C = m.u32((pNode + 0x0c) >>> 0) >>> 0
  if (m.u32((pActMonReg + bucket * 4) >>> 0) === (pNode >>> 0)) {
    m.setU32((pActMonReg + bucket * 4) >>> 0, pNext0C)
  }
  if (m.u32((pActMonReg + 0x300) >>> 0) === (pNode >>> 0)) {
    m.setU32((pActMonReg + 0x300) >>> 0, pNext0C)
  }
  const pPrev14 = m.u32((pNode + 0x14) >>> 0) >>> 0
  if (m.u32((pActMonReg + 0x304) >>> 0) === (pNode >>> 0)) {
    m.setU32((pActMonReg + 0x304) >>> 0, pPrev14)
  }

  const pPrev10 = m.u32((pNode + 0x10) >>> 0) >>> 0
  if (pPrev10 !== 0) {
    m.setU32((pPrev10 + 0x0c) >>> 0, pNext0C)
  }
  const pNext0C2 = m.u32((pNode + 0x0c) >>> 0) >>> 0
  if (pNext0C2 !== 0) {
    m.setU32((pNext0C2 + 0x10) >>> 0, m.u32((pNode + 0x10) >>> 0))
  }
  const pPrev14_2 = m.u32((pNode + 0x14) >>> 0) >>> 0
  if (pPrev14_2 !== 0) {
    m.setU32((pPrev14_2 + 0x0c) >>> 0, m.u32((pNode + 0x0c) >>> 0))
  }
  const pNext0C3 = m.u32((pNode + 0x0c) >>> 0) >>> 0
  if (pNext0C3 !== 0) {
    m.setU32((pNext0C3 + 0x14) >>> 0, m.u32((pNode + 0x14) >>> 0))
  }

  fogFreeMemPool113c(m, pNode)
  m.setU32((pActMonReg + 0x308) >>> 0, (m.u32((pActMonReg + 0x308) >>> 0) - 1) >>> 0)
}

/**
 * Walks `*ppHead` (`+0x30` chain), frees each `+0x2C` save header block and record, and zeroes `*ppHead`.
 *
 * @va D2Game:0x6FC3FB40
 */
export function MONREG_FlushAndFreePendingSpawnNodes113c(
  m: Memory113c,
  pGame: number,
  ppHead: number,
): void {
  if (ppHead === 0) return
  let pCur = m.u32(ppHead >>> 0) >>> 0
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0
  while (pCur !== 0) {
    const pNext = m.u32((pCur + 0x30) >>> 0) >>> 0
    const pSaveBlock = m.u32((pCur + 0x2c) >>> 0) >>> 0
    if (pSaveBlock !== 0) {
      DRLGPRESET_FreeSaveHeaderBlock113c(m, pMemPool, pSaveBlock)
    }
    fogFreeMemPool113c(m, pCur)
    pCur = pNext
  }
  m.setU32(ppHead >>> 0, 0)
}

/**
 * Restores saved room monsters from `pRoomNode`, unlinks/frees `pRoomNode`, and runs Act 4 Diablo seal check.
 *
 * @va D2Game:0x6FC3FB90
 */
export function MONREG_RestoreRoomMonstersFromNode113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
  pRoomNode: number,
  callees?: BootInitGapACallees113c,
): void {
  let pRec = m.u32(pRoomNode >>> 0) >>> 0
  if (pRec === 0) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pRoomCoords = sp
  const pCoordOut = (sp + 0x14) >>> 0
  const ppRoomOut = (sp + 0x20) >>> 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
    const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0

    while (pRec !== 0) {
      let bSkipSpawn = 0
      const pNextRec = m.u32((pRec + 0x30) >>> 0) >>> 0
      const nClassId = m.u32(pRec >>> 0) | 0
      const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, nClassId) >>> 0
      if (pMonStatsTxt === 0) break

      const wMonStatsFlags = m.u16((pMonStatsTxt + 0x1a0) >>> 0)
      if ((wMonStatsFlags & 0x800) === 0) {
        const dwFlags20 = m.u32((pRec + 0x20) >>> 0)
        if ((dwFlags20 & 2) !== 0 && (dwFlags20 & 0x220) === 0) {
          bSkipSpawn = 1
        }
      }

      if (m.u8((pRec + 0x27) >>> 0) !== 0 && bSkipSpawn === 0) {
        if (callees !== undefined && callees.spawnRestoredBossOrMinion !== undefined) {
          callees.spawnRestoredBossOrMinion(m, pGame, pRoom, pRec)
        }
      } else {
        let x = m.u32((pRec + 0x14) >>> 0) | 0
        let y = m.u32((pRec + 0x18) >>> 0) | 0
        const subX = m.u32(pRoomCoords) | 0
        const subY = m.u32((pRoomCoords + 0x04) >>> 0) | 0
        const subW = m.u32((pRoomCoords + 0x08) >>> 0) | 0
        const subH = m.u32((pRoomCoords + 0x0c) >>> 0) | 0

        if (x < subX) {
          x = subX
        } else if (x >= ((subX + subW) | 0)) {
          x = (subX + subW - 1) | 0
        }
        m.setU32((pRec + 0x14) >>> 0, x >>> 0)

        if (y < subY) {
          y = subY
        } else if (y >= ((subY + subH) | 0)) {
          y = (subY + subH - 1) | 0
        }
        m.setU32((pRec + 0x18) >>> 0, y >>> 0)

        if (bSkipSpawn === 0) {
          const dwFlags20 = m.u32((pRec + 0x20) >>> 0)
          const bDead = dwFlags20 & 2
          const nAnimMode = bDead !== 0 ? 0x0c : 1
          let wSpawnFlags = 1
          if (bDead !== 0) {
            wSpawnFlags = 0x28
          } else if ((dwFlags20 & 0x400) !== 0) {
            wSpawnFlags = 0x41
          }
          const nRadius = ((wMonStatsFlags >>> 11) & 1) !== 0 || (wSpawnFlags & 8) !== 0 ? -1 : 3
          let pUnit = MONSTER_SpawnAtCoords113c(
            m,
            nClassId,
            nAnimMode,
            pGame,
            pRoom,
            x,
            y,
            nRadius,
            wSpawnFlags,
            callees !== undefined ? callees.regpop : undefined,
          )
          if (pUnit === 0 && bDead === 0 && (dwFlags20 & 0x400) === 0) {
            pUnit = MONSTER_SpawnAtCoords113c(
              m,
              nClassId,
              nAnimMode,
              pGame,
              pRoom,
              x,
              y,
              6,
              9,
              callees !== undefined ? callees.regpop : undefined,
            )
            if (pUnit !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
              if (MONSTATS2_CheckFlagBit113c(m, m.u32((pUnit + 0x04) >>> 0) | 0, 0x1d) === 0) {
                m.setU32(pCoordOut, UNIT_GetPosX113c(m, pUnit) >>> 0)
                m.setU32((pCoordOut + 4) >>> 0, UNIT_GetPosY113c(m, pUnit) >>> 0)
                m.setU32(ppRoomOut, 0)
                COLLISION_FindFreeCoordsNear113c(m, pRoom, pCoordOut, 0x0d, 0x1c09, ppRoomOut)
                const pOutRoom = m.u32(ppRoomOut) >>> 0
                if (pOutRoom !== 0) {
                  if (callees !== undefined && callees.relocateRestoredUnit !== undefined) {
                    callees.relocateRestoredUnit(
                      m,
                      pGame,
                      pUnit,
                      m.u32(pCoordOut) | 0,
                      m.u32((pCoordOut + 4) >>> 0) | 0,
                      pOutRoom,
                    )
                  }
                } else {
                  if (callees !== undefined && callees.deleteRestoredUnit !== undefined) {
                    callees.deleteRestoredUnit(m, pGame, pUnit)
                  }
                  pUnit = 0
                }
              }
            }
          }

          if (pUnit !== 0) {
            STATLIST_SetUnitStat113c(m, pUnit, 6, m.u32((pRec + 0x08) >>> 0) | 0, 0)
            STATLIST_SetUnitStat113c(m, pUnit, 7, m.u32((pRec + 0x0c) >>> 0) | 0, 0)
            STATLIST_SetUnitStat113c(m, pUnit, 0x15, m.u32((pRec + 0x10) >>> 0) | 0, 0)
            STATLIST_SetUnitStat113c(m, pUnit, 0x0c, m.u32((pRec + 0x04) >>> 0) | 0, 0)
            STATLIST_SetUnitStat113c(m, pUnit, 0x24, (m.u8((pRec + 0x1c) >>> 0) << 24) >> 24, 0)
            STATLIST_SetUnitStat113c(m, pUnit, 0x25, (m.u8((pRec + 0x1d) >>> 0) << 24) >> 24, 0)
            STATLIST_SetUnitStat113c(m, pUnit, 0x27, (m.u8((pRec + 0x1e) >>> 0) << 24) >> 24, 0)
            STATLIST_SetUnitStat113c(m, pUnit, 0x29, (m.u8((pRec + 0x1f) >>> 0) << 24) >> 24, 0)
            STATLIST_SetUnitStat113c(m, pUnit, 0x2b, (m.u8((pRec + 0x25) >>> 0) << 24) >> 24, 0)
            STATLIST_SetUnitStat113c(m, pUnit, 0x2d, (m.u8((pRec + 0x26) >>> 0) << 24) >> 24, 0)

            const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
            if (pMonData !== 0) {
              const bFlag20Bit0 = m.u8((pRec + 0x20) >>> 0) & 1
              const cur16 = m.u8((pMonData + 0x16) >>> 0)
              m.setU8(
                (pMonData + 0x16) >>> 0,
                bFlag20Bit0 !== 0 ? (cur16 | 1) & 0xff : cur16 & 0xfe,
              )
              if ((m.u32((pRec + 0x20) >>> 0) & 0x10) !== 0) {
                m.setU8((pMonData + 0x16) >>> 0, (m.u8((pMonData + 0x16) >>> 0) | 8) & 0xff)
                m.setU16((pMonData + 0x26) >>> 0, m.u16((pRec + 0x28) >>> 0))
              }
              m.setU32((pMonData + 0x34) >>> 0, m.u32((pRec + 0x38) >>> 0))
            }

            if ((m.u32((pRec + 0x20) >>> 0) & 0x400) !== 0) {
              m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) & 0xfffffff9) >>> 0)
            }
            if ((m.u32((pRec + 0x20) >>> 0) & 0x800) !== 0) {
              m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) & 0xffffffef) >>> 0)
            }

            if (callees !== undefined && callees.postRestoreMonsterHook !== undefined) {
              callees.postRestoreMonsterHook(m, pGame, pUnit, pRec, bDead)
            }
          }
        }
      }

      const pSaveBlock = m.u32((pRec + 0x2c) >>> 0) >>> 0
      if (pSaveBlock !== 0) {
        DRLGPRESET_FreeSaveHeaderBlock113c(m, pMemPool, pSaveBlock)
      }
      fogFreeMemPool113c(m, pRec)
      pRec = pNextRec
    }

    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
    const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
    const pActMonReg = m.u32((pGame + nAct * 4 + 0x1de0) >>> 0) >>> 0
    MONREG_UnlinkAndFreeActRoomNode113c(m, pRoomNode, pActMonReg, pGame)
    QUEST_Act4DiabloSealCheck113c(m, pGame)
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Pops all queued AI commands on `pMonster->pMonsterData->pAiGeneral`.
 *
 * @va D2Game:0x6FC41420
 */
export function AIGENERAL_FlushAllAiCommands113c(
  m: Memory113c,
  _pGame: number,
  pMonster: number,
): void {
  if (pMonster === 0) return
  if (m.u32(pMonster >>> 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGeneral === 0) return
  while (m.u32((pAiGeneral + 0x24) >>> 0) !== 0 && m.u32((pAiGeneral + 0x20) >>> 0) !== 0) {
    AIGENERAL_PopAiCommand113c(m, pMonster)
  }
}

/**
 * Walks `pUnit->pMonsterData->pMinionComponentList` (`+0x58`), invokes callbacks, and frees nodes when `bFlag != 0`.
 *
 * @va D2Game:0x6FC468E0
 */
export function MONSTER_DispatchMinionComponentCallbacks113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  bFlag: number,
  callees?: BootInitGapACallees113c,
): void {
  if (pUnit === 0) return
  if (m.u32(pUnit >>> 0) !== 1) return
  const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  let pNode = m.u32((pMonData + 0x58) >>> 0) >>> 0
  if (pNode === 0) return

  const count = m.u32(D2GAME_MINION_COMP_COUNT_VA_113C) >>> 0
  const tableBase = m.u32(D2GAME_MINION_COMP_TABLE_PTR_VA_113C) >>> 0

  while (pNode !== 0) {
    const idx = m.u32(pNode >>> 0) >>> 0
    if (idx < count && tableBase !== 0) {
      const pEntry = (tableBase + imul32(idx | 0, 0x14)) >>> 0
      const pfn = m.u32((pEntry + 0x08) >>> 0) >>> 0
      if (pfn !== 0 && callees !== undefined && callees.onComponentCallback !== undefined) {
        callees.onComponentCallback(m, pfn, pGame, pUnit, pNode, bFlag)
      }
    }
    pNode = m.u32((pNode + 0x10) >>> 0) >>> 0
  }

  if (bFlag !== 0) {
    let pCur = m.u32((pMonData + 0x58) >>> 0) >>> 0
    while (pCur !== 0) {
      const pNext = m.u32((pCur + 0x10) >>> 0) >>> 0
      const idx = m.u32(pCur >>> 0) >>> 0
      if (idx < count && tableBase !== 0) {
        const pEntry = (tableBase + imul32(idx | 0, 0x14)) >>> 0
        const pfnFree = m.u32((pEntry + 0x04) >>> 0) >>> 0
        if (pfnFree !== 0) {
          if (callees !== undefined && callees.onComponentFree !== undefined) {
            callees.onComponentFree(m, pfnFree, pGame, pUnit, pCur)
          }
        } else {
          fogFreeMemPool113c(m, pCur)
        }
      }
      pCur = pNext
    }
    m.setU32((pMonData + 0x58) >>> 0, 0)
  }
}

/**
 * Walks `pGame->pClientList` (`+0x88` along `+0x4A8`) and invokes `callback` for every client with `dwClientState == 4`.
 *
 * @va D2Game:0x6FC49820
 */
export function CLIENTS_ForEachInGameClient113c(
  m: Memory113c,
  pGame: number,
  pfnCallback: number,
  pContext: number,
  callback?: (m: Memory113c, pClient: number, pContext: number) => void,
): void {
  if (pGame === 0) {
    throw new Error('CLIENTS_ForEachInGameClient113c: pGame == NULL (line 1231)')
  }
  if (pfnCallback === 0 && callback === undefined) {
    throw new Error('CLIENTS_ForEachInGameClient113c: pfnCallback == NULL (line 1232)')
  }
  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    if (m.u32((pClient + 0x04) >>> 0) === 4) {
      if (callback !== undefined) {
        callback(m, pClient, pContext)
      }
    }
    pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
  }
}

/**
 * Updates `pGame` tick rate metrics (`+0xAC`, `+0xB0`, `+0xB4`) and optional performance array slot.
 *
 * @va D2Game:0x6FC49BE0
 */
export function GAME_UpdateTickRateMetrics113c(
  m: Memory113c,
  pGame: number,
  callees?: BootInitGapACallees113c,
): void {
  const pPerfInfo = m.u32(D2GAME_PERF_TICK_ARRAY_PTR_VA_113C) >>> 0
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  const poolBytes = pMemPool !== 0 ? m.u32((pMemPool + 0x17a8) >>> 0) : 0
  m.setU32(
    D2GAME_TOTAL_MEMPOOL_BYTES_VA_113C,
    (m.u32(D2GAME_TOTAL_MEMPOOL_BYTES_VA_113C) + poolBytes) >>> 0,
  )

  const dwTickMs =
    callees !== undefined && callees.getTickCountMs !== undefined
      ? callees.getTickCountMs(m) >>> 0
      : m.u32((pGame + 0xac) >>> 0) >>> 0
  const deltaMs = (dwTickMs - m.u32((pGame + 0xac) >>> 0)) | 0
  if (deltaMs >= 1000) {
    const framesDelta = (m.u32((pGame + 0xa8) >>> 0) - m.u32((pGame + 0xb0) >>> 0)) | 0
    const rate = Math.trunc(imul32(framesDelta, 1000) / deltaMs) | 0
    m.setU32((pGame + 0xb4) >>> 0, rate >>> 0)
    m.setU32((pGame + 0xac) >>> 0, dwTickMs)
    m.setU32((pGame + 0xb0) >>> 0, m.u32((pGame + 0xa8) >>> 0))
  }
  if (pPerfInfo !== 0) {
    const idx = m.u16((pGame + 0x28) >>> 0)
    m.setU32((pPerfInfo + idx * 4) >>> 0, m.u32((pGame + 0xb4) >>> 0))
  }
}

/**
 * Every 128 frames (`(dwGameFrame & 0x7F) == 0`), expires ground items and minion lists in act `(dwGameFrame >> 7) % 5`.
 *
 * @va D2Game:0x6FC4C0F0
 */
export function GAME_ExpireItemsAndMinionListsPeriodic113c(
  m: Memory113c,
  pGame: number,
): void {
  const dwFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
  if ((dwFrame & 0x7f) === 0) {
    const nAct = ((dwFrame >>> 7) % 5) >>> 0
    const pAct = m.u32((pGame + nAct * 4 + 0xbc) >>> 0) >>> 0
    if (pAct !== 0) {
      ITEMS_ExpireGroundItemsInAct113c(m, pGame, pAct)
      AIGENERAL_ExpireMinionListsInAct113c(m, pGame, pAct)
    }
  }
}

/**
 * Broadcasts `0x5B` player-in-game packets and corpse sync between `pNewClient` and all existing state-4 clients.
 *
 * @va D2Game:0x6FC4C120
 */
export function GAME_SyncNewClientWithExistingPlayers113c(
  m: Memory113c,
  pGame: number,
  pNewClient: number,
  callees?: BootInitGapACallees113c,
): void {
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x60) >>> 0
  const pktNew = sp
  const pktOther = (sp + 0x28) >>> 0
  try {
    m.fill(pktNew, 0x24, 0)
    const pNewUnit = m.u32((pNewClient + 0x174) >>> 0) >>> 0
    m.setU8(pktNew, 0x5b)
    m.setU16((pktNew + 1) >>> 0, 0x24)
    m.setU32((pktNew + 3) >>> 0, pNewUnit !== 0 ? m.u32((pNewUnit + 0x0c) >>> 0) : 0)
    m.setU8((pktNew + 7) >>> 0, m.u8((pNewClient + 0x0c) >>> 0))
    stormStrCopy113c(m, (pktNew + 8) >>> 0, (pNewClient + 0x0d) >>> 0, 0x10)
    const newLvl = pNewUnit !== 0 ? STATLIST_GetUnitStat113c(m, pNewUnit, 0x0c, 0) & 0xffff : 0
    m.setU16((pktNew + 0x18) >>> 0, newLvl)
    const newPartyId =
      callees !== undefined && callees.getClientPartyId !== undefined && pNewUnit !== 0
        ? callees.getClientPartyId(m, pNewUnit) & 0xffff
        : 0xffff
    m.setU16((pktNew + 0x1a) >>> 0, newPartyId)
    m.setU32((pktNew + 0x1c) >>> 0, 0)
    m.setU32((pktNew + 0x20) >>> 0, 0)

    let pOther = m.u32((pGame + 0x88) >>> 0) >>> 0
    while (pOther !== 0) {
      if (pOther !== (pNewClient >>> 0) && m.u32((pOther + 0x04) >>> 0) === 4) {
        NET_QueuePacketToClientBuffer113c(m, pOther, 1, pktNew, 0x24)

        const pOtherUnit = m.u32((pOther + 0x174) >>> 0) >>> 0
        m.fill(pktOther, 0x24, 0)
        m.setU8(pktOther, 0x5b)
        m.setU16((pktOther + 1) >>> 0, 0x24)
        m.setU32((pktOther + 3) >>> 0, pOtherUnit !== 0 ? m.u32((pOtherUnit + 0x0c) >>> 0) : 0)
        m.setU8((pktOther + 7) >>> 0, m.u8((pOther + 0x0c) >>> 0))
        stormStrCopy113c(m, (pktOther + 8) >>> 0, (pOther + 0x0d) >>> 0, 0x10)
        const otherLvl =
          pOtherUnit !== 0 ? STATLIST_GetUnitStat113c(m, pOtherUnit, 0x0c, 0) & 0xffff : 0
        m.setU16((pktOther + 0x18) >>> 0, otherLvl)
        const otherPartyId =
          callees !== undefined && callees.getClientPartyId !== undefined && pOtherUnit !== 0
            ? callees.getClientPartyId(m, pOtherUnit) & 0xffff
            : 0xffff
        m.setU16((pktOther + 0x1a) >>> 0, otherPartyId)
        m.setU32((pktOther + 0x1c) >>> 0, 0)
        m.setU32((pktOther + 0x20) >>> 0, 0)
        NET_QueuePacketToClientBuffer113c(m, pNewClient, 1, pktOther, 0x24)

        if (callees !== undefined && callees.syncPlayerPartyRelations !== undefined) {
          callees.syncPlayerPartyRelations(m, pGame, pNewClient, pOther)
        }

        if (pOtherUnit !== 0) {
          const pInv = m.u32((pOtherUnit + 0x60) >>> 0) >>> 0
          let pCorpse = INVENTORY_GetFirstCorpse113c(m, pInv) >>> 0
          while (pCorpse !== 0) {
            const dwCorpseUnitId = INVENTORY_GetCorpseUnitId113c(m, pCorpse)
            const pCorpseUnit = SUNIT_GetServerUnit113c(m, pGame, 0, dwCorpseUnitId)
            if (pCorpseUnit !== 0) {
              if (callees !== undefined && callees.sendCorpseSyncPacket !== undefined) {
                callees.sendCorpseSyncPacket(
                  m,
                  pNewClient,
                  m.u32((pOtherUnit + 0x0c) >>> 0),
                  m.u32((pCorpseUnit + 0x0c) >>> 0),
                )
              }
            }
            pCorpse = INVENTORY_GetNextCorpse113c(m, pCorpse) >>> 0
          }
        }
      }
      pOther = m.u32((pOther + 0x4a8) >>> 0) >>> 0
    }

    NET_QueuePacketToClientBuffer113c(m, pNewClient, 1, pktNew, 0x24)
    if (callees !== undefined && callees.onPostClientJoinSync !== undefined) {
      callees.onPostClientJoinSync(m, pGame, pNewClient, pNewUnit)
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Steps environment lighting cycles across all 5 acts and broadcasts `0x53` when any cycle or Act 2 eclipse state changes.
 *
 * @va D2Game:0x6FC4CA20
 */
export function GAME_StepActEnvironmentCycles113c(
  m: Memory113c,
  pGame: number,
  callees?: BootInitGapACallees113c,
): void {
  if (pGame === 0) {
    throw new Error('GAME_StepActEnvironmentCycles113c: pGame == NULL (line 3058)')
  }
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pCycleIdx = sp
  const pTicks = (sp + 4) >>> 0
  const pEclipse = (sp + 8) >>> 0
  const pPkt53 = (sp + 0x10) >>> 0
  try {
    let bBroadcast53 = 0
    m.setU32(pCycleIdx, 0)
    m.setU32(pTicks, 0)
    m.setU32(pEclipse, 0)

    for (let nAct = 0; nAct < 5; nAct++) {
      const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
      if (pAct !== 0) {
        if (ENV_StepCycle113c(m, pAct, nAct) !== 0) {
          bBroadcast53 = 1
        }
        if (nAct === 1) {
          ENV_GetCycleState113c(m, pAct, pCycleIdx, pTicks, pEclipse)
          const curEclipse = m.u32(pEclipse)
          const questEclipse =
            callees !== undefined && callees.checkAct2EclipseQuest !== undefined
              ? callees.checkAct2EclipseQuest(m, pGame) >>> 0
              : 0
          if (questEclipse !== curEclipse) {
            bBroadcast53 = 1
          }
        }
      }
    }

    if (bBroadcast53 !== 0) {
      const pAct0 = m.u32((pGame + 0xbc) >>> 0) >>> 0
      if (pAct0 !== 0) {
        ENV_GetCycleState113c(m, pAct0, pCycleIdx, pTicks, pEclipse)
      }
      let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
      while (pClient !== 0) {
        if (m.u32((pClient + 0x04) >>> 0) === 4) {
          let bClientEclipse = 0
          if (m.u8((pClient + 0x16d) >>> 0) === 1) {
            const questEclipse =
              callees !== undefined && callees.checkAct2EclipseQuest !== undefined
                ? callees.checkAct2EclipseQuest(m, pGame)
                : 0
            if (questEclipse !== 0) bClientEclipse = 1
          }
          m.setU8(pPkt53, 0x53)
          m.setU32((pPkt53 + 1) >>> 0, m.u32(pCycleIdx))
          m.setU32((pPkt53 + 5) >>> 0, m.u32(pTicks))
          m.setU8((pPkt53 + 9) >>> 0, bClientEclipse & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt53, 10)
        }
        pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Checks all clients in `pGame` for ping timeout (`> 35000` ms) or player timer timeout (`> 0x4E2` frames), and steps active players.
 *
 * @va D2Game:0x6FC4D670
 */
export function GAME_CheckAndDisconnectTimedOutClients113c(
  m: Memory113c,
  pGame: number,
  dwTickMs: number,
  callees?: BootInitGapACallees113c,
): void {
  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    const pNext = m.u32((pClient + 0x4a8) >>> 0) >>> 0
    const dwLastPing = m.u32((pClient + 0x484) >>> 0) >>> 0
    if (
      dwLastPing !== 0 &&
      ((dwTickMs - dwLastPing) | 0) > 35000 &&
      m.u32(D2GAME_DISABLE_CLIENT_TIMEOUT_VA_113C) === 0
    ) {
      if (callees !== undefined && callees.disconnectClient !== undefined) {
        callees.disconnectClient(m, pGame, pClient, 4)
      }
    } else if (m.u32((pClient + 0x04) >>> 0) === 4) {
      const pUnit = m.u32((pClient + 0x174) >>> 0) >>> 0
      if (pUnit === 0) {
        if (callees !== undefined && callees.disconnectClient !== undefined) {
          callees.disconnectClient(m, pGame, pClient, 4)
        }
      } else {
        const pPlayerData = m.u32((pUnit + 0x14) >>> 0) >>> 0
        const dwTimer9C = pPlayerData !== 0 ? m.u32((pPlayerData + 0x9c) >>> 0) : 0
        if (
          dwTimer9C !== 0 &&
          ((m.u32((pGame + 0xa8) >>> 0) - dwTimer9C) | 0) > 0x4e2
        ) {
          if (callees !== undefined && callees.disconnectClient !== undefined) {
            callees.disconnectClient(m, pGame, pClient, 4)
          }
        } else {
          if (callees !== undefined && callees.stepPlayerClientTick !== undefined) {
            callees.stepPlayerClientTick(m, pGame, pUnit, pClient)
          }
          m.setU32((pClient + 0x1ac) >>> 0, 0)
        }
      }
    }
    pClient = pNext
  }
}

/**
 * Steps client join state machine (`dwClientState` 1, 2, 3 -> 4) and checks empty-game idle expiration.
 *
 * @va D2Game:0x6FC4D9B0
 */
export function GAME_StepClientJoinStatesAndTimeouts113c(
  m: Memory113c,
  pGame: number,
  dwTickMs: number,
  callees?: BootInitGapACallees113c,
): number {
  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    const pNext = m.u32((pClient + 0x4a8) >>> 0) >>> 0
    const dwState = m.u32((pClient + 0x04) >>> 0)
    if (dwState === 4) {
      return 1
    }
    if (dwState === 1 || dwState === 2) {
      const elapsed = (dwTickMs - m.u32((pClient + 0x19c) >>> 0)) >>> 0
      if (elapsed <= 10000) {
        if (callees !== undefined && callees.stepJoinState1Or2 !== undefined) {
          callees.stepJoinState1Or2(m, pGame, pClient, dwTickMs)
        }
      } else {
        if (callees !== undefined && callees.disconnectClient !== undefined) {
          callees.disconnectClient(m, pGame, pClient, 0)
        }
      }
    } else if (dwState === 3) {
      const elapsed = (dwTickMs - m.u32((pClient + 0x19c) >>> 0)) >>> 0
      if (elapsed <= 15000) {
        const pUnit = m.u32((pClient + 0x174) >>> 0) >>> 0
        const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
        const pRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
        const roomsActive =
          pRoom !== 0 ? DUNGEON_AreAllAdjacentRoomsActive113c(m, pRoom) !== 0 : true
        const ready =
          callees !== undefined && callees.stepJoinState3Ready !== undefined
            ? callees.stepJoinState3Ready(m, pGame, pClient, dwTickMs)
            : roomsActive
              ? 1
              : 0
        if (ready !== 0) {
          if (pUnit !== 0) {
            UNITS_SetUnitUpdateFlags113c(m, pUnit, 0)
          }
          m.setU32((pClient + 0x04) >>> 0, 4)
          GAME_SyncNewClientWithExistingPlayers113c(m, pGame, pClient, callees)
          return 1
        }
      } else {
        if (callees !== undefined && callees.disconnectClient !== undefined) {
          callees.disconnectClient(m, pGame, pClient, 0)
        }
      }
    }
    pClient = pNext
  }

  if (m.u32((pGame + 0x88) >>> 0) !== 0) {
    return 1
  }
  const dwEmptySince = m.u32((pGame + 0xa0) >>> 0) >>> 0
  if (dwEmptySince === 0) {
    m.setU32((pGame + 0xa0) >>> 0, dwTickMs >>> 0)
    return 1
  }
  const idleLimit = m.u32((pGame + 0xa8) >>> 0) > 0x1bf20 ? 300000 : 120000
  return ((dwTickMs - dwEmptySince) >>> 0) <= idleLimit ? 1 : 0
}

/**
 * Sets object animation mode to `2` via `D2Common.#11090` (`UNITS_ChangeAnimMode`).
 *
 * @va D2Game:0x6FC4E750
 */
export function OBJECT_SetAnimMode2Wrapper113c(
  m: Memory113c,
  _pGame: number,
  pObject: number,
  _pPlayer = 0,
  _bFlag = 0,
): number {
  return UNITS_ChangeAnimMode113c(m, pObject, 2)
}

/**
 * Spawns a preset superunique or Evil Urn monster pack in `pRoom`.
 *
 * @va D2Game:0x6FC66F70
 */
export function MONSTER_SpawnPresetOrEvilUrn113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  bFlag1: number,
  x: number,
  y: number,
  nSuperUniqueOrClassId: number,
  bIsEvilUrn: number,
  callees?: BootInitGapACallees113c,
): number {
  if (bIsEvilUrn === 0 && (nSuperUniqueOrClassId | 0) >= 0) {
    if (callees !== undefined && callees.spawnSuperUniqueById !== undefined) {
      if (callees.spawnSuperUniqueById(m, pGame, pRoom, x, y, nSuperUniqueOrClassId) !== 0) {
        return 1
      }
    }
  }

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const pMonReg = m.u32((pGame + 0xf0 + imul32(nLevelId, 4)) >>> 0) >>> 0
  if (pMonReg === 0) return 0
  if (m.u8((pMonReg + 0x0c) >>> 0) === 0 || m.u8((pMonReg + 0x08) >>> 0) === 0) return 0

  const nClassId =
    callees !== undefined && callees.pickEvilUrnMonsterClassId !== undefined
      ? callees.pickEvilUrnMonsterClassId(m, pGame, pRoom, pMonReg) | 0
      : nSuperUniqueOrClassId | 0
  if (MONSTATS_ValidateClassId113c(m, nClassId) === 0) return 0
  if (bIsEvilUrn !== 0 && MONSTATS2_CheckFlagBit113c(m, nClassId, 2) === 0) return 0

  const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, nClassId) >>> 0
  if (pMonStatsTxt === 0) return 0
  if ((m.u8((pMonStatsTxt + 0x1a0) >>> 0) & 0x10) === 0) return 0

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x20) >>> 0
  const pCoordNode = sp
  const pOutX = (sp + 8) >>> 0
  const pOutY = (sp + 12) >>> 0
  try {
    m.setU32(pCoordNode, x >>> 0)
    m.setU32((pCoordNode + 4) >>> 0, y >>> 0)
    if (
      REGPOP_FindPackSpawnCoords113c(
        m,
        pRoom,
        pGame,
        pCoordNode,
        nClassId,
        pOutX,
        pOutY,
        0,
        callees !== undefined ? callees.regpop : undefined,
      ) === 0
    ) {
      return 0
    }
    if (callees !== undefined && callees.spawnPresetPack !== undefined) {
      return callees.spawnPresetPack(
        m,
        pGame,
        pRoom,
        nClassId,
        m.u32(pOutX) | 0,
        m.u32(pOutY) | 0,
        bFlag1,
      )
    }
    return 1
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Checks if `pPortalUnit` or its linked twin portal is in Tristram (`levelId == 0x26`) and advances Act 1 Quest 3 state.
 *
 * @va D2Game:0x6FC86320
 */
export function QUEST_Act1TownPortalUpdateState113c(
  m: Memory113c,
  pPortalUnit: number,
  pGame: number,
  callees?: BootInitGapACallees113c,
): number {
  const pPath = pPortalUnit !== 0 ? m.u32((pPortalUnit + 0x2c) >>> 0) >>> 0 : 0
  const pRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)

  const dwTwinId = pPortalUnit !== 0 ? m.u32((pPortalUnit + 0x94) >>> 0) : 0xffffffff
  const pTwinUnit = SUNIT_GetServerUnit113c(m, pGame, 2, dwTwinId) >>> 0
  const pTwinPath = pTwinUnit !== 0 ? m.u32((pTwinUnit + 0x2c) >>> 0) >>> 0 : 0
  const pTwinRoom = pTwinPath !== 0 ? m.u32((pTwinPath + 0x1c) >>> 0) >>> 0 : 0
  const nTwinLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pTwinRoom)

  if (nLevelId !== 0x26 && nTwinLevelId !== 0x26) {
    return 0
  }

  const pQuest =
    callees !== undefined && callees.getQuestDescriptor !== undefined
      ? callees.getQuestDescriptor(m, pGame, 3) >>> 0
      : 0
  if (pQuest === 0) return 1
  const pQuestExt = m.u32((pQuest + 0xf0) >>> 0) >>> 0
  if (pQuestExt === 0) return 1
  if (m.u8(pQuestExt) === 1) {
    m.setU32((pQuestExt + 0x04) >>> 0, 2)
  }
  return 1
}

/**
 * Sends object mode (`0x0E`), shrine speech (`0x2C`), and quest state packets for `pObject` to `pClient`.
 *
 * @va D2Game:0x6FC8A0D0
 */
export function OBJECT_SendUpdatePacketsToClient113c(
  m: Memory113c,
  pClient: number,
  pObject: number,
  callees?: BootInitGapACallees113c,
): void {
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pkt0E = sp
  const pkt2C = (sp + 0x10) >>> 0
  try {
    const dwFlags = m.u32((pObject + 0xc4) >>> 0)
    if ((dwFlags & 0x40) !== 0) {
      m.fill(pkt0E, 0x0c, 0)
      m.setU8(pkt0E, 0x0e)
      m.setU8((pkt0E + 1) >>> 0, m.u8(pObject >>> 0))
      m.setU32((pkt0E + 2) >>> 0, m.u32((pObject + 0x0c) >>> 0))
      m.setU8((pkt0E + 6) >>> 0, m.u8((pObject + 0x10) >>> 0))
      m.setU8((pkt0E + 7) >>> 0, (m.u8((pObject + 0xc5) >>> 0) >>> 3) & 1)
      const pObjData = m.u32((pObject + 0x14) >>> 0) >>> 0
      const subType = pObjData !== 0 ? m.u8((pObjData + 0x04) >>> 0) : 0
      m.setU8((pkt0E + 8) >>> 0, subType)
      m.setU8((pkt0E + 11) >>> 0, subType)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pkt0E, 0x0c)
    }

    const dwFlags2 = m.u32((pObject + 0xc8) >>> 0)
    if ((dwFlags2 & 0x200000) !== 0) {
      const pShrineTxt = UNITS_GetObjectShrineTxt113c(m, pObject) >>> 0
      const pObjData = m.u32((pObject + 0x14) >>> 0) >>> 0
      m.fill(pkt2C, 8, 0)
      m.setU8(pkt2C, 0x2c)
      m.setU8((pkt2C + 1) >>> 0, m.u8(pObject >>> 0))
      m.setU32((pkt2C + 2) >>> 0, m.u32((pObject + 0x0c) >>> 0))
      const wSpeech =
        pShrineTxt !== 0
          ? m.u16((pShrineTxt + 0x0e) >>> 0)
          : ((pObjData !== 0 ? m.u8((pObjData + 0x04) >>> 0) : 0) + 0x111) & 0xffff
      m.setU16((pkt2C + 6) >>> 0, wSpeech)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pkt2C, 8)
    }

    if ((m.u32((pObject + 0xc8) >>> 0) & 0x100000) !== 0) {
      if (callees !== undefined && callees.onObjectQuestSync !== undefined) {
        callees.onObjectQuestSync(m, m.u32((pObject + 0x80) >>> 0), pObject, pClient)
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Syncs `pObject` update packets (when `dwFlags & 0x8000`) and flushes `pObject->pEventNotifyList` (`+0xE8`) to `pClient`.
 *
 * @va D2Game:0x6FC8B200
 */
export function OBJECT_SyncStateAndEventsToClient113c(
  m: Memory113c,
  pObject: number,
  pClient: number,
  callees?: BootInitGapACallees113c,
): number {
  if (((m.u32((pObject + 0xc4) >>> 0) >>> 15) & 1) !== 0) {
    if (m.u32(pObject >>> 0) !== 2) {
      throw new Error('OBJECT_SyncStateAndEventsToClient113c: dwUnitType != 2 (line 1453)')
    }
    OBJECT_SendUpdatePacketsToClient113c(m, pClient, pObject, callees)
  }
  if (m.u32((pObject + 0xe8) >>> 0) !== 0) {
    UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pObject, callees)
  }
  return 1
}

/**
 * Computes monster life percentage on a `0..128` (`0x80`) scale (`((curLife >> 8) << 7) / (maxLife >> 8)`).
 *
 * @va D2Game:0x6FC97060
 */
export function MONSTER_CalcLifePercentage128_113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const curLife = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0
  const maxLifeShr = maxLife >> 8
  if (maxLifeShr <= 0) return 0x80
  let pct = Math.trunc(((curLife >> 8) << 7) / maxLifeShr) | 0
  if (pct === 0 && curLife > 0) {
    pct = 1
  }
  if (pct > 0x80) {
    pct = 0x80
  }
  return pct & 0xff
}

/**
 * Looks up `0x6FD1BBF0[nIndex]` (`[0, 0, 8, 16, 24, 32, 40, 48]`) when `pGame != 0`, `nIndex < 8`, and `pGame->dwGameType == 0`.
 *
 * @va D2Game:0x6FC970A0
 */
export function MONSTER_GetHirelingLevelBonusFactor113c(
  m: Memory113c,
  pGame: number,
  nIndex: number,
): number {
  if (pGame === 0) return 0
  if ((nIndex >>> 0) >= 8) return 0
  if (m.u32((pGame + 0x70) >>> 0) !== 0) return 0
  return HIRELING_BONUS_TABLE_6FD1BBF0[nIndex >>> 0]!
}

/**
 * Calculates and applies monster base combat stats, elemental damage rolls (`0x30..0x42`, `0x13B..0x13D`), and resistances (`0x24..0x2D`).
 *
 * @va D2Game:0x6FC97240
 */
export function MONSTER_ApplyElementalDamageAndResistStats113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  bFlag: number,
): void {
  if (pMonster === 0 || m.u32(pMonster >>> 0) !== 1 || pGame === 0) return
  const nClassId = m.u32((pMonster + 0x04) >>> 0) | 0
  const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, nClassId) >>> 0
  if (pMonStatsTxt === 0) return

  const pStatList = STATLIST_GetStatListFromUnitAndFlag113c(m, pMonster, 0) >>> 0
  if (pStatList === 0) return

  let nDifficulty = m.u8((pGame + 0x6d) >>> 0) | 0
  if (nDifficulty < 0) {
    nDifficulty = 0
  } else if (nDifficulty > 2) {
    nDifficulty = 2
  }
  const bIsExpansion = m.u16((pGame + 0x6a) >>> 0)
  const nLevel = STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0
  const isEvilAlign = UNIT_GetAlignment113c(m, pMonster) === 2

  if (isEvilAlign) {
    STATLIST_ClearBaseStats113c(m, pStatList)
  }

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x40) >>> 0
  const pMonLvlStats = sp
  try {
    m.fill(pMonLvlStats, 0x2c, 0)
    DATATBLS_CalculateMonsterStatsByLevel113c(
      m,
      nClassId,
      bIsExpansion,
      nDifficulty,
      nLevel,
      0x3f,
      pMonLvlStats,
    )

    const diffOff = imul32(nDifficulty, 0x2a)
    if (bFlag !== 0) {
      const min1 = Math.trunc(
        imul32(readI16(m, (pMonStatsTxt + diffOff + 0xec) >>> 0), m.u32((pMonLvlStats + 0x0c) >>> 0) | 0) /
          100,
      )
      STATLIST_SetStat113c(m, pStatList, 0x16, min1, 0)

      const max1 = Math.trunc(
        imul32(readI16(m, (pMonStatsTxt + diffOff + 0xee) >>> 0), m.u32((pMonLvlStats + 0x0c) >>> 0) | 0) /
          100,
      )
      STATLIST_SetStat113c(m, pStatList, 0x17, max1, 0)

      const th1 = Math.trunc(
        imul32(readI16(m, (pMonStatsTxt + diffOff + 0xf4) >>> 0), m.u32((pMonLvlStats + 0x08) >>> 0) | 0) /
          100,
      )
      STATLIST_SetStat113c(m, pStatList, 0x13, th1, 0)
      STATLIST_SetStat113c(m, pStatList, 0x43, 0, 0)
      STATLIST_SetStat113c(m, pStatList, 0x44, 0, 0)
      STATLIST_SetStat113c(m, pStatList, 0x45, 0, 0)
    } else {
      const min1 = Math.trunc(
        imul32(readI16(m, (pMonStatsTxt + diffOff + 0xec) >>> 0), m.u32((pMonLvlStats + 0x10) >>> 0) | 0) /
          100,
      )
      STATLIST_SetStat113c(m, pStatList, 0x16, min1, 0)

      const max1 = Math.trunc(
        imul32(readI16(m, (pMonStatsTxt + diffOff + 0xee) >>> 0), m.u32((pMonLvlStats + 0x10) >>> 0) | 0) /
          100,
      )
      STATLIST_SetStat113c(m, pStatList, 0x17, max1, 0)

      const min2 = Math.trunc(
        imul32(readI16(m, (pMonStatsTxt + diffOff + 0xf0) >>> 0), m.u32((pMonLvlStats + 0x10) >>> 0) | 0) /
          100,
      )
      STATLIST_SetStat113c(m, pStatList, 0x18, min2, 0)

      const max2 = Math.trunc(
        imul32(readI16(m, (pMonStatsTxt + diffOff + 0xf2) >>> 0), m.u32((pMonLvlStats + 0x10) >>> 0) | 0) /
          100,
      )
      STATLIST_SetStat113c(m, pStatList, 0x19, max2, 0)

      const th1 = Math.trunc(
        imul32(readI16(m, (pMonStatsTxt + diffOff + 0xf4) >>> 0), m.u32((pMonLvlStats + 0x08) >>> 0) | 0) /
          100,
      )
      STATLIST_SetStat113c(m, pStatList, 0x13, th1, 0)

      const th2 = Math.trunc(
        imul32(readI16(m, (pMonStatsTxt + diffOff + 0xf6) >>> 0), m.u32((pMonLvlStats + 0x08) >>> 0) | 0) /
          100,
      )
      STATLIST_SetStat113c(m, pStatList, 0x14, th2, 0)

      const ac = Math.trunc(
        imul32(readI16(m, (pMonStatsTxt + diffOff + 0xe4) >>> 0), m.u32((pMonLvlStats + 0x04) >>> 0) | 0) /
          100,
      )
      STATLIST_SetStat113c(m, pStatList, 0x1f, ac, 0)
    }

    const pSeed = (pMonster + 0x20) >>> 0
    for (let slot = 0; slot < 3; slot++) {
      const pElem = (pMonStatsTxt + 0x154 + slot * 8) >>> 0
      const nElemType = m.u8(pElem)
      if (nElemType !== 0) {
        const nChance = m.u8((pElem + nDifficulty + 2) >>> 0)
        if (nChance > 0 && seedRollMem113c(m, pSeed, 100) < nChance) {
          const elemDiffOff = (pElem + nDifficulty * 2) >>> 0
          const scaleDmg = m.u32((pMonLvlStats + (bFlag !== 0 ? 0x0c : 0x10)) >>> 0) | 0
          const edi = Math.trunc(imul32(readI16(m, (elemDiffOff + 5) >>> 0), scaleDmg) / 100)
          const ebx = Math.trunc(imul32(readI16(m, (elemDiffOff + 0x0b) >>> 0), scaleDmg) / 100)
          const ebp = readI16(m, (elemDiffOff + 0x11) >>> 0)

          switch (nElemType) {
            case 1:
              STATLIST_SetStat113c(m, pStatList, 0x30, edi, 0)
              STATLIST_SetStat113c(m, pStatList, 0x31, ebx, 0)
              break
            case 2:
              STATLIST_SetStat113c(m, pStatList, 0x32, edi, 0)
              STATLIST_SetStat113c(m, pStatList, 0x33, ebx, 0)
              break
            case 3:
              STATLIST_SetStat113c(m, pStatList, 0x34, edi, 0)
              STATLIST_SetStat113c(m, pStatList, 0x35, ebx, 0)
              break
            case 4:
              STATLIST_SetStat113c(m, pStatList, 0x36, edi, 0)
              STATLIST_SetStat113c(m, pStatList, 0x37, ebx, 0)
              STATLIST_SetStat113c(m, pStatList, 0x38, ebp, 0)
              break
            case 5:
              STATLIST_SetStat113c(m, pStatList, 0x39, imul32(edi, 10), 0)
              STATLIST_SetStat113c(m, pStatList, 0x3a, imul32(ebx, 10), 0)
              STATLIST_SetStat113c(m, pStatList, 0x3b, ebp * 2, 0)
              break
            case 6:
              STATLIST_SetStat113c(m, pStatList, 0x3c, edi, 0)
              STATLIST_SetStat113c(m, pStatList, 0x3d, ebx, 0)
              break
            case 7:
              STATLIST_SetStat113c(m, pStatList, 0x3e, edi, 0)
              STATLIST_SetStat113c(m, pStatList, 0x3f, ebx, 0)
              break
            case 8:
              STATLIST_SetStat113c(m, pStatList, 0x40, edi, 0)
              STATLIST_SetStat113c(m, pStatList, 0x41, ebx, 0)
              break
            case 9:
              STATLIST_SetStat113c(m, pStatList, 0x42, ebp, 0)
              break
            case 10:
              break
            case 11:
              STATLIST_SetStat113c(m, pStatList, 0x13c, edi, 0)
              STATLIST_SetStat113c(m, pStatList, 0x13d, ebx, 0)
              STATLIST_SetStat113c(m, pStatList, 0x13b, ebp, 0)
              break
            default:
              break
          }
        }
      }
    }

    if (isEvilAlign) {
      return
    }

    const resBase = (pMonStatsTxt + 0x10e + imul32(nDifficulty, 0x0c)) >>> 0
    const resStatIds: readonly number[] = [0x24, 0x25, 0x27, 0x29, 0x2b, 0x2d]
    for (let i = 0; i < 6; i++) {
      const val = readI16(m, (resBase + i * 2) >>> 0)
      const clamped = val <= 0 ? 0 : val
      STATLIST_SetStat113c(m, pStatList, resStatIds[i]!, clamped, 0)
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Syncs unit gfx states, modified stats, sound events, and event notification queue to `pClient`.
 *
 * @va D2Game:0x6FC988B0
 */
export function UNIT_SyncStateAndStatsToClient113c(
  m: Memory113c,
  pGame: number,
  pClient: number,
  pUnit: number,
  callees?: BootInitGapACallees113c,
): void {
  if (UNITS_HasAnyGfxStateFlag113c(m, pUnit) !== 0) {
    UNIT_SendGfxStatesBitstreamToClient113c(m, pUnit, pClient)
  }

  if (STATLIST_CheckUnitStatListFlag100113c(m, pUnit) !== 0) {
    const uType = m.u32(pUnit >>> 0)
    if (uType === 0 && m.u32((pClient + 0x174) >>> 0) === (pUnit >>> 0)) {
      const cb =
        callees !== undefined && callees.onStatModifiedNotify !== undefined
          ? callees.onStatModifiedNotify
          : undefined
      for (let statId = 0; statId < 0x33; statId++) {
        STATLIST_NotifyIfStatModified113c(m, pUnit, pClient, statId, 0, cb)
      }
      const curLife = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
      const curMana = STATLIST_GetUnitStat113c(m, pUnit, 8, 0) | 0
      const curStamina = STATLIST_GetUnitStat113c(m, pUnit, 0x0a, 0) | 0
      if (
        curLife !== (m.u32((pClient + 0x1b0) >>> 0) | 0) ||
        curMana !== (m.u32((pClient + 0x1b4) >>> 0) | 0) ||
        curStamina !== (m.u32((pClient + 0x1b8) >>> 0) | 0)
      ) {
        m.setU32((pClient + 0x1b0) >>> 0, curLife >>> 0)
        m.setU32((pClient + 0x1b4) >>> 0, curMana >>> 0)
        m.setU32((pClient + 0x1b8) >>> 0, curStamina >>> 0)
        if (callees !== undefined && callees.sendLifeManaStaminaPacket !== undefined) {
          callees.sendLifeManaStaminaPacket(m, pClient, pUnit, curLife, curMana, curStamina)
        }
      }
    } else if (uType === 1) {
      const cb =
        callees !== undefined && callees.onStatModifiedNotify !== undefined
          ? callees.onStatModifiedNotify
          : undefined
      STATLIST_NotifyIfStatModified113c(m, pUnit, pClient, 0x1f, 0, cb)
      STATLIST_NotifyIfStatModified113c(m, pUnit, pClient, 0x15, 0, cb)
    }
  }

  const dwFlags = m.u32((pUnit + 0xc4) >>> 0)
  if ((dwFlags & 0x400) !== 0) {
    if (callees !== undefined && callees.sendUnitEventSound !== undefined) {
      callees.sendUnitEventSound(m, pClient, pUnit, m.u16((pUnit + 0xd8) >>> 0))
    }
  }

  if (((m.u32((pUnit + 0xc4) >>> 0) >>> 15) & 1) !== 0) {
    if (callees !== undefined && callees.syncUnitFlag8000 !== undefined) {
      callees.syncUnitFlag8000(m, pGame, pClient, pUnit)
    }
  }

  if (m.u32((pUnit + 0xe8) >>> 0) !== 0) {
    UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit, callees)
  }

  if ((m.u8((pUnit + 0xc6) >>> 0) & 1) !== 0 || (m.u8((pUnit + 0xc4) >>> 0) & 0x80) !== 0) {
    if (callees !== undefined && callees.sendUnitUpdateFlagsPacket !== undefined) {
      callees.sendUnitUpdateFlagsPacket(m, pClient, pUnit)
    }
  }
}

/**
 * Frees all nodes in `pUnit->pEventNotifyList` (`+0xE8`, linked via `+0x10`) and zeroes `+0xE8`.
 *
 * @va D2Game:0x6FC99FE0
 */
export function UNIT_FreeEventNotifyList113c(m: Memory113c, pUnit: number): void {
  if (pUnit === 0) {
    throw new Error('UNIT_FreeEventNotifyList113c: pUnit == NULL (line 3373)')
  }
  let pNode = m.u32((pUnit + 0xe8) >>> 0) >>> 0
  while (pNode !== 0) {
    const pNext = m.u32((pNode + 0x10) >>> 0) >>> 0
    fogFreeMemPool113c(m, pNode)
    pNode = pNext
  }
  m.setU32((pUnit + 0xe8) >>> 0, 0)
}

/**
 * Serializes modified gfx states on `pUnit` (`D2Common.#10315`) as `0xA8` (bitstream) or `0xA9` (clear) packets to `pClient`.
 *
 * @va D2Game:0x6FC9A5E0
 */
export function UNIT_SendGfxStatesBitstreamToClient113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): void {
  if (pUnit === 0) {
    throw new Error('UNIT_SendGfxStatesBitstreamToClient113c: pUnit == NULL (line 2463)')
  }
  const pGfxFlags = UNITS_GetGfxStateFlagsPtr113c(m, pUnit) >>> 0
  if (pGfxFlags === 0) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x1140) >>> 0
  const pBitStream = sp
  const pPkt = (sp + 0x20) >>> 0
  const pStatsBuf = (sp + 0x120) >>> 0
  try {
    for (let dwordIdx = 0; dwordIdx < 6; dwordIdx++) {
      let mask = m.u32((pGfxFlags + dwordIdx * 4) >>> 0) >>> 0
      while (mask !== 0) {
        const bitIdx = fogBitScanForward113c(mask)
        if (bitIdx < 0) break
        const nState = ((dwordIdx << 5) + bitIdx) | 0
        mask = (mask & ~((1 << (bitIdx & 31)) >>> 0)) >>> 0

        if (STATES_CheckState113c(m, pUnit, nState) !== 0) {
          m.fill(pPkt, 0x100, 0)
          m.setU8(pPkt, 0xa8)
          m.setU8((pPkt + 1) >>> 0, m.u8(pUnit >>> 0))
          m.setU32((pPkt + 2) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
          fogInitBitBuffer113c(m, pBitStream, (pPkt + 7) >>> 0, 0xf8)
          fogWriteBits113c(m, pBitStream, nState, 8)

          const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, nState) >>> 0
          if (pStatList !== 0) {
            const nStats = STATLIST_CopyBaseStatsToBuffer113c(m, pStatList, pStatsBuf, 0x200) | 0
            for (let i = 0; i < nStats; i++) {
              const pStat = (pStatsBuf + i * 8) >>> 0
              const wParam = m.u16(pStat)
              const wStatId = m.u16((pStat + 2) >>> 0)
              const nVal = m.u32((pStat + 4) >>> 0) | 0
              if (m.u32((pBitStream + 0x08) >>> 0) >= 0xf2) break
              fogWriteBits113c(m, pBitStream, wStatId, 9)
              if (wParam !== 0) {
                fogWriteBits113c(m, pBitStream, 1, 1)
                fogWriteBits113c(m, pBitStream, wParam, 16)
              } else {
                fogWriteBits113c(m, pBitStream, 0, 1)
              }
              fogWriteBits113c(m, pBitStream, nVal, 32)
              if (wStatId <= 0x0b) {
                fogWriteBits113c(m, pBitStream, nVal & 1, 1)
              }
            }
          }
          fogWriteBits113c(m, pBitStream, 0x1ff, 9)
          const totalLen = (fogGetBitBufferSize113c(m, pBitStream) + 7) & 0xff
          m.setU8((pPkt + 6) >>> 0, totalLen)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, totalLen)
        } else {
          m.setU8(pPkt, 0xa9)
          m.setU8((pPkt + 1) >>> 0, m.u8(pUnit >>> 0))
          m.setU32((pPkt + 2) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
          m.setU8((pPkt + 6) >>> 0, nState & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 7)
        }
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Serializes all active states on `pUnit` (`D2Common.#11150`) as `0xA8` (with stats) or `0xA7` (flag only) packets to `pClient`.
 *
 * @va D2Game:0x6FC9A940
 */
export function UNIT_SendAllStatesBitstreamToClient113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): void {
  if (pUnit === 0) {
    throw new Error('UNIT_SendAllStatesBitstreamToClient113c: pUnit == NULL (line 2544)')
  }
  const pStateFlags = UNITS_GetStateFlagsPtr113c(m, pUnit) >>> 0
  if (pStateFlags === 0) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x1140) >>> 0
  const pBitStream = sp
  const pPkt = (sp + 0x20) >>> 0
  const pStatsBuf = (sp + 0x120) >>> 0
  try {
    for (let dwordIdx = 0; dwordIdx < 6; dwordIdx++) {
      let mask = m.u32((pStateFlags + dwordIdx * 4) >>> 0) >>> 0
      while (mask !== 0) {
        const bitIdx = fogBitScanForward113c(mask)
        if (bitIdx < 0) break
        const nState = ((dwordIdx << 5) + bitIdx) | 0
        mask = (mask & ~((1 << (bitIdx & 31)) >>> 0)) >>> 0

        const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, nState) >>> 0
        if (pStatList !== 0) {
          m.fill(pPkt, 0x100, 0)
          m.setU8(pPkt, 0xa8)
          m.setU8((pPkt + 1) >>> 0, m.u8(pUnit >>> 0))
          m.setU32((pPkt + 2) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
          fogInitBitBuffer113c(m, pBitStream, (pPkt + 7) >>> 0, 0xf8)
          fogWriteBits113c(m, pBitStream, nState, 8)

          const nStats = STATLIST_CopyBaseStatsToBuffer113c(m, pStatList, pStatsBuf, 0x200) | 0
          for (let i = 0; i < nStats; i++) {
            const pStat = (pStatsBuf + i * 8) >>> 0
            const wParam = m.u16(pStat)
            const wStatId = m.u16((pStat + 2) >>> 0)
            const nVal = m.u32((pStat + 4) >>> 0) | 0
            if (m.u32((pBitStream + 0x08) >>> 0) >= 0xf2) break
            fogWriteBits113c(m, pBitStream, wStatId, 9)
            if (wParam !== 0) {
              fogWriteBits113c(m, pBitStream, 1, 1)
              fogWriteBits113c(m, pBitStream, wParam, 16)
            } else {
              fogWriteBits113c(m, pBitStream, 0, 1)
            }
            fogWriteBits113c(m, pBitStream, nVal, 32)
            if (wStatId <= 0x0b) {
              fogWriteBits113c(m, pBitStream, nVal & 1, 1)
            }
          }
          fogWriteBits113c(m, pBitStream, 0x1ff, 9)
          const totalLen = (fogGetBitBufferSize113c(m, pBitStream) + 7) & 0xff
          m.setU8((pPkt + 6) >>> 0, totalLen)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, totalLen)
        } else {
          m.setU8(pPkt, 0xa7)
          m.setU8((pPkt + 1) >>> 0, m.u8(pUnit >>> 0))
          m.setU32((pPkt + 2) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
          m.setU8((pPkt + 6) >>> 0, nState & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 7)
        }
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Walks `pUnit->pEventNotifyList` (`+0xE8`) and dispatches queued S2C packets (`0x23, 0x99, 0x9A, 0x9E, 0xA1, 0xA3, 0xA4, 0xA5, 0xAB`) to `pClient`.
 *
 * @va D2Game:0x6FC9ADF0
 */
export function UNIT_FlushEventNotifyQueueToClient113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  callees?: BootInitGapACallees113c,
): void {
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pPkt = sp
  try {
    let pNode = m.u32((pUnit + 0xe8) >>> 0) >>> 0
    while (pNode !== 0) {
      const opcode = m.u8((pNode + 0x04) >>> 0)
      switch (opcode) {
        case 0x9a:
          m.fill(pPkt, 0x11, 0)
          m.setU8(pPkt, 0x9a)
          m.setU32((pPkt + 1) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
          m.setU16((pPkt + 5) >>> 0, m.u16((pNode + 0x0a) >>> 0))
          m.setU16((pPkt + 7) >>> 0, m.u16((pNode + 0x08) >>> 0))
          m.setU32((pPkt + 9) >>> 0, m.u32(pNode >>> 0))
          m.setU16((pPkt + 13) >>> 0, m.u32((pNode + 0x0c) >>> 0) & 0xffff)
          m.setU16((pPkt + 15) >>> 0, (m.u32((pNode + 0x0c) >>> 0) >>> 16) & 0xffff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x11)
          break
        case 0xa4:
          m.setU8(pPkt, 0xa4)
          m.setU16((pPkt + 1) >>> 0, m.u16((pNode + 0x08) >>> 0))
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 3)
          break
        case 0xab:
          if (((m.u32((pUnit + 0xc4) >>> 0) >>> 15) & 1) === 0) {
            if (callees !== undefined && callees.onNotifyOpcode !== undefined) {
              callees.onNotifyOpcode(m, opcode, pClient, pUnit, pNode)
            }
          }
          break
        case 0x23:
        case 0x99:
        case 0x9e:
        case 0xa1:
        case 0xa3:
        case 0xa5:
          if (callees !== undefined && callees.onNotifyOpcode !== undefined) {
            callees.onNotifyOpcode(m, opcode, pClient, pUnit, pNode)
          }
          break
        default:
          break
      }
      pNode = m.u32((pNode + 0x10) >>> 0) >>> 0
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Full unit synchronization to `pClient` across unit types (`0..5`), including monster skill levels, states, and event queues.
 *
 * @va D2Game:0x6FC9B0A0
 */
export function UNIT_SendFullUnitSyncToClient113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  dwFlags: number,
  callees?: BootInitGapACallees113c,
): void {
  if (pClient === 0) {
    throw new Error('UNIT_SendFullUnitSyncToClient113c: pClient == NULL (line 2802)')
  }
  if (pUnit === 0) {
    throw new Error('UNIT_SendFullUnitSyncToClient113c: pUnit == NULL (line 2803)')
  }
  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  if (pGame === 0) {
    throw new Error('UNIT_SendFullUnitSyncToClient113c: pGame == NULL (line 2806)')
  }
  if (((m.u32((pUnit + 0xc4) >>> 0) >>> 11) & 1) !== 0) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x20) >>> 0
  const pPkt09 = sp
  try {
    const dwUnitType = m.u32(pUnit >>> 0)
    switch (dwUnitType) {
      case 0:
      case 2:
      case 4:
        if (callees !== undefined && callees.onUnitFullSyncPreSwitch !== undefined) {
          callees.onUnitFullSyncPreSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
        }
        break
      case 3: {
        const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
        if (pPath !== 0) {
          PATH_GetVelocity113c(m, pPath)
        }
        if (callees !== undefined && callees.onUnitFullSyncPreSwitch !== undefined) {
          callees.onUnitFullSyncPreSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
        }
        break
      }
      case 1: {
        const isDead = SUNIT_IsDeadOrDying113c(m, pUnit) !== 0
        if (!isDead || STATES_CheckStateMask2OnUnit113c(m, pUnit) !== 0) {
          const x = UNIT_GetPosX113c(m, pUnit)
          const y = UNIT_GetPosY113c(m, pUnit)
          STATLIST_SetUnitStat113c(m, pUnit, 0x148, (x + y) & 0xffff, 0)
          const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
          const pMonStatsTxt = pMonData !== 0 ? m.u32(pMonData >>> 0) >>> 0 : 0
          if (pMonStatsTxt !== 0) {
            const skillMask = m.u32((pMonStatsTxt + 0x16c) >>> 0)
            for (let i = 0; i < 8; i++) {
              if (((1 << i) & skillMask) !== 0) {
                const wSkillId = readI16(m, (pMonStatsTxt + 0x170 + i * 2) >>> 0)
                const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(
                  m,
                  pUnit,
                  wSkillId,
                )
                if (pSkill !== 0) {
                  SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1)
                }
              }
            }
          }
          UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient)
          UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit, callees)
          if (callees !== undefined && callees.onUnitFullSyncPreSwitch !== undefined) {
            callees.onUnitFullSyncPreSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
          }
        }
        break
      }
      default: {
        m.fill(pPkt09, 0x0b, 0)
        m.setU8(pPkt09, 0x09)
        m.setU8((pPkt09 + 1) >>> 0, dwUnitType & 0xff)
        m.setU32((pPkt09 + 2) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
        m.setU8((pPkt09 + 6) >>> 0, m.u8((pUnit + 0x04) >>> 0))
        m.setU16((pPkt09 + 7) >>> 0, UNIT_GetPosX113c(m, pUnit) & 0xffff)
        m.setU16((pPkt09 + 9) >>> 0, UNIT_GetPosY113c(m, pUnit) & 0xffff)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt09, 0x0b)
        break
      }
    }

    if (dwUnitType === 0) {
      if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0 && STATES_CheckState113c(m, pUnit, 7) !== 0) {
        const dwCorpseGuid = INVENTORY_GetLeftItemGuid113c(m, m.u32((pUnit + 0x60) >>> 0))
        if (dwCorpseGuid !== -1) {
          const pCorpseUnit = SUNIT_GetServerUnit113c(m, pGame, 0, dwCorpseGuid)
          if (
            pCorpseUnit !== 0 &&
            callees !== undefined &&
            callees.sendCorpseSyncPacket !== undefined
          ) {
            callees.sendCorpseSyncPacket(
              m,
              pClient,
              m.u32((pUnit + 0x0c) >>> 0),
              m.u32((pCorpseUnit + 0x0c) >>> 0),
            )
          }
        }
      }
      UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient)
      UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit, callees)
    }

    if (callees !== undefined && callees.onUnitFullSyncPostSwitch !== undefined) {
      callees.onUnitFullSyncPostSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Appends `nSize` bytes from `pPacket` into `pClient->pPacketQueue` (`+0x1BC`, allocating a `0x40C` overflow block at `+0x408` if `> 0x400`).
 *
 * @va D2Game:0x6FCAA3E0
 */
export function NET_QueuePacketToClientBuffer113c(
  m: Memory113c,
  pClient: number,
  nChannel: number,
  pPacket: number,
  nSize: number,
): number {
  if (pClient === 0 || nChannel !== 1) return 0
  const size = nSize | 0
  if (size >= 0x200) {
    throw new Error('NET_QueuePacketToClientBuffer113c: nSize >= 0x200 (line 210)')
  }
  let pQueue = m.u32((pClient + 0x1bc) >>> 0) >>> 0
  if (pQueue === 0) return 0

  const curUsed = m.u32((pQueue + 0x04) >>> 0) | 0
  if (((curUsed + size) | 0) > 0x400) {
    if (m.u32((pQueue + 0x408) >>> 0) === 0) {
      const pOverflow = m.alloc(0x40c) >>> 0
      m.setU32(pOverflow, 1)
      m.setU32((pOverflow + 0x04) >>> 0, 0)
      m.setU32((pOverflow + 0x408) >>> 0, 0)
      m.setU32((pQueue + 0x408) >>> 0, pOverflow)
    }
    pQueue = m.u32((pQueue + 0x408) >>> 0) >>> 0
  }

  const writeOff = (pQueue + 0x08 + m.u32((pQueue + 0x04) >>> 0)) >>> 0
  for (let i = 0; i < size; i++) {
    m.setU8((writeOff + i) >>> 0, m.u8((pPacket + i) >>> 0))
  }
  m.setU32((pQueue + 0x04) >>> 0, (m.u32((pQueue + 0x04) >>> 0) + size) >>> 0)
  m.setU32((pClient + 0x1c0) >>> 0, (m.u32((pClient + 0x1c0) >>> 0) + size) >>> 0)
  m.setU32((pClient + 0x1c4) >>> 0, (m.u32((pClient + 0x1c4) >>> 0) + 1) >>> 0)
  return 1
}

/**
 * Copies 10 dwords (`0x28` = 40 bytes) from `pSrcPacket40` and queues them to `pClient` channel `1`.
 *
 * @va D2Game:0x6FCAB400
 */
export function NET_SendFixed40BytePacketToClient113c(
  m: Memory113c,
  pClient: number,
  pSrcPacket40: number,
): number {
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  try {
    for (let i = 0; i < 10; i++) {
      m.setU32((sp + i * 4) >>> 0, m.u32((pSrcPacket40 + i * 4) >>> 0))
    }
    return NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 0x28)
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Executes persistent and timed slot events for Partition 0 (`UNIT_PLAYER`).
 *
 * @va D2Game:0x6FCAE9A0
 */
export function EVENT_ExecutePlayerEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): void {
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 0)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    if (callees !== undefined && callees.dispatchPlayerEvent !== undefined) {
      callees.dispatchPlayerEvent(
        m,
        pGame,
        m.get(node, D2EventStrc.pUnit),
        m.get(node, D2EventStrc.nType),
        m.get(node, D2EventStrc.dwArg14),
        m.get(node, D2EventStrc.dwArg18),
      )
    }
    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = nSlot & 63
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      if (callees !== undefined && callees.dispatchPlayerEvent !== undefined) {
        callees.dispatchPlayerEvent(
          m,
          pGame,
          m.get(node, D2EventStrc.pUnit),
          m.get(node, D2EventStrc.nType),
          m.get(node, D2EventStrc.dwArg14),
          m.get(node, D2EventStrc.dwArg18),
        )
      }
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
}

/**
 * Executes persistent and timed slot events for Partition 1 (`UNIT_MONSTER`).
 *
 * @va D2Game:0x6FCAEBC0
 */
export function EVENT_ExecuteMonsterEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): void {
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 1)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    const pUnit = m.get(node, D2EventStrc.pUnit)
    const evType = m.get(node, D2EventStrc.nType)
    const arg14 = m.get(node, D2EventStrc.dwArg14)
    const arg18 = m.get(node, D2EventStrc.dwArg18)
    if (callees !== undefined && callees.dispatchMonsterEvent !== undefined) {
      callees.dispatchMonsterEvent(m, pGame, pUnit, evType, arg14, arg18)
    } else if (callees !== undefined && callees.monsterEvents !== undefined) {
      MONSTER_DispatchEvent113c(m, pGame, pUnit, evType, arg14, arg18, callees.monsterEvents)
    }
    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = 64 + (nSlot & 63)
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      if (callees !== undefined && callees.dispatchMonsterEvent !== undefined) {
        callees.dispatchMonsterEvent(m, pGame, pUnit, evType, arg14, arg18)
      } else if (callees !== undefined && callees.monsterEvents !== undefined) {
        MONSTER_DispatchEvent113c(m, pGame, pUnit, evType, arg14, arg18, callees.monsterEvents)
      }
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
}

/**
 * Executes persistent and timed slot events for Partition 3 (`UNIT_OBJECT`), freeing orphaned events whose room is NULL.
 *
 * @va D2Game:0x6FCAECC0
 */
export function EVENT_ExecuteObjectEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): void {
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 3)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    const pUnit = m.get(node, D2EventStrc.pUnit)
    const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
    const pRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
    if (pRoom === 0) {
      EVENT_FreeNode113c(m, pGame, node)
    } else {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      if (callees !== undefined && callees.dispatchObjectEvent !== undefined) {
        callees.dispatchObjectEvent(
          m,
          pGame,
          pUnit,
          m.get(node, D2EventStrc.nType),
          m.get(node, D2EventStrc.dwArg14),
          m.get(node, D2EventStrc.dwArg18),
        )
      }
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
        EVENT_FreeNode113c(m, pGame, node)
      }
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = 192 + (nSlot & 63)
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
      const pRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
      if (pRoom === 0) {
        EVENT_FreeNode113c(m, pGame, node)
      } else {
        m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
        if (callees !== undefined && callees.dispatchObjectEvent !== undefined) {
          callees.dispatchObjectEvent(
            m,
            pGame,
            pUnit,
            m.get(node, D2EventStrc.nType),
            m.get(node, D2EventStrc.dwArg14),
            m.get(node, D2EventStrc.dwArg18),
          )
        }
        const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
        m.set(node, D2EventStrc.fFlags, postFlags)
        EVENT_FreeNode113c(m, pGame, node)
      }
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
}

/**
 * Executes persistent and timed slot events for Partition 2 (`UNIT_MISSILE`), invoking `pNode->pfnHandler`.
 *
 * @va D2Game:0x6FCAEDD0
 */
export function EVENT_ExecuteMissileEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): void {
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x10) >>> 0
  try {
    let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 2)
    while (node !== 0) {
      m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
      const pRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
      if (pRoom === 0) {
        EVENT_FreeNode113c(m, pGame, node)
      } else {
        if (m.u32(pUnit >>> 0) === 3 && (m.u8((pUnit + 0xc4) >>> 0) & 4) !== 0) {
          PATH_GetTargetTypeAndPosition113c(m, pUnit, sp)
        }
        m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
        const pfn = m.get(node, D2EventStrc.pfnHandler)
        if (pfn !== 0) {
          if (callees !== undefined && callees.dispatchMissileEvent !== undefined) {
            callees.dispatchMissileEvent(
              m,
              pfn,
              pGame,
              pUnit,
              m.get(node, D2EventStrc.nType),
              m.get(node, D2EventStrc.dwArg14),
              m.get(node, D2EventStrc.dwArg18),
            )
          }
        } else {
          m.set(
            node,
            D2EventStrc.fFlags,
            m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_DEFERRED_FREE,
          )
        }
        const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
        m.set(node, D2EventStrc.fFlags, postFlags)
        if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
          EVENT_FreeNode113c(m, pGame, node)
        }
      }
      node = m.get(pTimer, D2TimerStrc.pSavedNext)
    }

    const slot = 128 + (nSlot & 63)
    node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
    const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
    while (node !== 0) {
      m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
      if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
        const pUnit = m.get(node, D2EventStrc.pUnit)
        const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
        const pRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
        if (pRoom === 0) {
          EVENT_FreeNode113c(m, pGame, node)
        } else {
          if (m.u32(pUnit >>> 0) === 3 && (m.u8((pUnit + 0xc4) >>> 0) & 4) !== 0) {
            PATH_GetTargetTypeAndPosition113c(m, pUnit, sp)
          }
          m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
          const pfn = m.get(node, D2EventStrc.pfnHandler)
          if (pfn !== 0 && callees !== undefined && callees.dispatchMissileEvent !== undefined) {
            callees.dispatchMissileEvent(
              m,
              pfn,
              pGame,
              pUnit,
              m.get(node, D2EventStrc.nType),
              m.get(node, D2EventStrc.dwArg14),
              m.get(node, D2EventStrc.dwArg18),
            )
          }
          const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
          m.set(node, D2EventStrc.fFlags, postFlags)
          EVENT_FreeNode113c(m, pGame, node)
        }
      }
      node = m.get(pTimer, D2TimerStrc.pSavedNext)
    }
    m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Executes persistent and timed slot events for Partition 4 (`UNIT_ITEM`), invoking `pNode->pfnHandler`.
 *
 * @va D2Game:0x6FCAEF20
 */
export function EVENT_ExecuteItemEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): void {
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 4)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    const pfn = m.get(node, D2EventStrc.pfnHandler)
    if (pfn !== 0) {
      if (callees !== undefined && callees.dispatchItemEvent !== undefined) {
        callees.dispatchItemEvent(
          m,
          pfn,
          pGame,
          m.get(node, D2EventStrc.pUnit),
          m.get(node, D2EventStrc.nType),
          m.get(node, D2EventStrc.dwArg14),
          m.get(node, D2EventStrc.dwArg18),
        )
      }
    } else {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_DEFERRED_FREE)
    }
    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = 256 + (nSlot & 63)
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pfn = m.get(node, D2EventStrc.pfnHandler)
      if (pfn !== 0 && callees !== undefined && callees.dispatchItemEvent !== undefined) {
        callees.dispatchItemEvent(
          m,
          pfn,
          pGame,
          m.get(node, D2EventStrc.pUnit),
          m.get(node, D2EventStrc.nType),
          m.get(node, D2EventStrc.dwArg14),
          m.get(node, D2EventStrc.dwArg18),
        )
      }
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
}

/**
 * Walks all 5 acts in `pGame` (`+0xBC..+0xCC`) and frees the portal list on every room via `D2Common.#10732`.
 *
 * @va D2Game:0x6FCBD5B0
 */
export function ACT_FreeAllActRoomPortalLists113c(m: Memory113c, pGame: number): void {
  if (pGame === 0) {
    throw new Error('ACT_FreeAllActRoomPortalLists113c: pGame == NULL (line 223)')
  }
  for (let nAct = 0; nAct < 5; nAct++) {
    const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
    if (pAct !== 0) {
      let pRoom = DUNGEON_GetRoomExFromRoom113c(m, pAct) >>> 0
      while (pRoom !== 0) {
        DUNGEON_FreeRoomPortalList113c(m, pRoom)
        pRoom = m.u32((pRoom + 0x7c) >>> 0) >>> 0
      }
    }
  }
}
