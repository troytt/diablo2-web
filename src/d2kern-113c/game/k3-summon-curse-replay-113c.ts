/**
 * Pure v1.13c kernel summon, curse, NecroPet AI, player breadcrumb ring, and
 * pet melee/kill/replenish helpers for K3 replay closure, routing all execution
 * through single canonical manifest-bound `tsSymbol` functions:
 * - `0x6FC99B90` player walk/run 20-entry breadcrumb ring (`pPlayerData + 0xA0..0x147`)
 * - `doIdx 16` (`0x6FC6D710` `SKILLS_SrvDo_SummonDecoy_6FC6D710_113c` + `0x6FCB2ED0` `MONSTER_EquipMonEquipItems113c`)
 * - `doIdx 30` (`0x6FC705D0` `SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c`)
 * - `doIdx 31` (`0x6FC718B0` `SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c`)
 * - `doIdx 56` (`0x6FC71750` `SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c`)
 * - `0x6FC3E900` (`ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c` -> `0x6FC3E640` / `0x6FC3E3D0`
 *   -> `0x6FC3E140` -> `0x6FC3CAE0`)
 * - `0x6FCFA480` (`ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c`)
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { INVENTORY_GetFirstItem113c, INVENTORY_GetNextItem113c } from '../common/inventory.ts'
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../common/inline-helpers.ts'
import { imul32 } from '../common/int-math.ts'
import { DUNGEON_CheckRoomIsTownMemPort113c } from '../common/k0-d2common-memports.ts'
import { SKILLS_EvalCalcByOffset113c } from '../common/skills.ts'
import {
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
  STATES_CheckState113c,
} from '../common/statlist.ts'
import {
  UNIT_GetAlignment113c,
  UNIT_ITEM,
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITS_GetBaseWalkVelocity113c,
  UNITS_GetRoom113c,
  UNITS_HasCollisionBetweenUnits113c,
  unitsGetTransformGfxValues113c,
} from '../common/unit.ts'
import { D2MonsterDataStrc, D2UnitStrc } from '../mem/layout.generated.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { SUNIT_DispatchItemEventCallbacks113c } from './a1c-post150-f786-f1040-113c.ts'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  MONSTER_ApplyCritDamage113c,
} from './ai-fallen-113c.ts'
import { D2GAME_SUNIT_IterateAllLivingPlayers113c } from './boot-init-gap-b-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import { bindK2KernelGlobals113c } from './k2-d2tv-evaluators-113c.ts'
import { SEED_RollRangeWithMinFast113c } from './k2-gap-melee-dot-113c.ts'
import {
  MONSTER_GetAiGeneralPtr_6FC218E0_113c,
  MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c,
} from './k2-laneH-0x6fc2-w1-113c.ts'
import {
  SUNITDMG_ResolveAttackerPlayer113c,
  SUNITDMG_TriggerAttackerBlindOrFlee113c,
} from './k2-real-s2c-combat-113c.ts'
import { MONSTER_IsPlayerInteractInTradeState113c } from './k2-sunit-spawn-w1-113c.ts'
import { PETS_InsertPetIntoPlayerPetSlot_6FCB7A20_113c } from './k2-w10b1-113c.ts'
import {
  type PetMoveActionOps113c,
  PETS_RegisterSummonPetAndClampCount_6FCB7F50_113c,
} from './k2-w11b1-113c.ts'
import { D2Game_6FCC3610_113c } from './k2-w13b1-113c.ts'
import {
  ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c,
  SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c,
  SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c,
  SKILLS_SrvDo_SummonDecoy_6FC6D710_113c,
} from './k2-w14b1-113c.ts'
import {
  ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c,
  SUMMON_GetPetTypeBucketPtr_6FCB6540_113c,
} from './k2-w2b4-113c.ts'
import { PETS_SendPetOrMercAssignPacket_6FCB66E0_113c } from './k2-w4b5-113c.ts'
import { PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c } from './k2-w5b1-113c.ts'
import { NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c } from './k2-w6b2-113c.ts'
import { SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c } from './k2-w7b1-113c.ts'
import {
  PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c,
  PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c,
} from './k2-w8b2-113c.ts'
import { ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c } from './k2-w9b2-113c.ts'
import { SUNIT_IsDeadOrDying113c } from './monster-events.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_EquipMonEquipItems113c,
  SKILLS_GetRecordPtrFast113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { EVENT_FreeNode113c } from './timer-wheel.ts'
import { UNITS_GetOctileDistanceToCoordinates113c } from './town-npc-ai-113c.ts'

/** Virtual `GetTickCount` slot (`0x6FD18D10` IAT -> `g_virtual_tick_ms` in `d2host-113c.c`). */
const D2GAME_VIRTUAL_TICK_VA_113C = 0x6fd18d10
const K3_SUMMON_SCRATCH_BASE = 0x00fb8000
let k3SummonScratchPtr = K3_SUMMON_SCRATCH_BASE

export type NecroPetReplayOps113c = PetMoveActionOps113c

function allocK3Scratch(m: Memory113c, bytes: number): number {
  const aligned = (bytes + 15) & ~15
  const base = k3SummonScratchPtr >>> 0
  k3SummonScratchPtr = (base + aligned) >>> 0
  for (let off = 0; off < aligned; off += 4) {
    m.setU32((base + off) >>> 0, 0)
  }
  return base
}

function freeK3Scratch(base: number): void {
  k3SummonScratchPtr = base >>> 0
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function isAddrByteLoaded(m: Memory113c, addr: number): boolean {
  if (addr === 0) return false
  const memInternal = m as unknown as { known?: Map<number, Uint8Array> }
  const known = memInternal.known
  if (known === undefined) return false
  const kp = known.get(addr >>> 12)
  return kp !== undefined && kp[addr & 0xfff] !== 0
}

function ensureZeroedIfUnloaded(m: Memory113c, baseAddr: number, byteLen: number): void {
  const memInternal = m as unknown as { known?: Map<number, Uint8Array> }
  const known = memInternal.known
  if (known === undefined) return
  for (let i = 0; i < byteLen; i++) {
    const addr = (baseAddr + i) >>> 0
    const kp = known.get(addr >>> 12)
    if (kp === undefined || kp[addr & 0xfff] === 0) {
      m.setU8(addr, 0)
    }
  }
}

/**
 * Synchronizes `0x6FD18D10` (`GetTickCount` virtual tick) with `d2host-113c.c`:
 * `0x00100000 + dwGameFrame * 40`.
 */
export function syncVirtualTickCountK3_113c(m: Memory113c, dwGameFrame: number): void {
  const tick = (0x00100000 + imul32(dwGameFrame >>> 0, 40)) >>> 0
  m.setU32(D2GAME_VIRTUAL_TICK_VA_113C, tick)
}

/**
 * Binary-exact `D2Game:0x6FC99BE7..0x6FC99CD8` player walk/run 20-entry breadcrumb ring update
 * (`pPlayerData + 0xA0` index, `+0xA4` last tick, `+0xA8..0x147` 20 x `{ i32 x, i32 y }`).
 */
export function updatePlayerWalkBreadcrumbRingK3_113c(m: Memory113c, pPlayer: number): void {
  if (pPlayer === 0 || (m.u32(pPlayer >>> 0) | 0) !== UNIT_PLAYER) return
  const pPlrData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  if (pPlrData === 0) return
  ensureZeroedIfUnloaded(m, (pPlrData + 0xa0) >>> 0, 0xcc)
  const dwTick = m.u32(D2GAME_VIRTUAL_TICK_VA_113C) >>> 0
  const gateTick = ((m.u32((pPlrData + 0xa4) >>> 0) >>> 0) + 0x19) >>> 0
  if (dwTick <= gateTick) return

  const curIdx = m.u8((pPlrData + 0xa0) >>> 0) & 0xff
  const prevIdx = curIdx === 0 ? 19 : (curIdx - 1) | 0
  const posX = UNIT_GetPosX113c(m, pPlayer) | 0
  const posY = UNIT_GetPosY113c(m, pPlayer) | 0
  const prevX = m.u32((pPlrData + 0xa8 + prevIdx * 8) >>> 0) | 0
  const prevY = m.u32((pPlrData + 0xac + prevIdx * 8) >>> 0) | 0
  const dx = (posX - prevX) | 0
  const dy = (posY - prevY) | 0
  if ((imul32(dx, dx) + imul32(dy, dy)) > 0x2d) {
    m.setU32((pPlrData + 0xa8 + curIdx * 8) >>> 0, posX >>> 0)
    m.setU32((pPlrData + 0xac + curIdx * 8) >>> 0, posY >>> 0)
    m.setU32((pPlrData + 0xa4) >>> 0, dwTick)
    const nextIdx = (curIdx + 1) | 0
    m.setU8((pPlrData + 0xa0) >>> 0, nextIdx < 20 ? nextIdx : 0)
  }
}

/**
 * Ensures `pPlayerData->pPlayerPets` (`+0x44`) is allocated as `{ u32 pSlots }` pointing to
 * `nPetTypes * 12` zero-initialized bytes (`0x6FCB7B60`).
 */
export function ensurePlayerPetTableAllocatedK3_113c(
  m: Memory113c,
  pPlayer: number,
  pGame = 0,
): void {
  bindK2KernelGlobals113c(m)
  if (pPlayer === 0 || (m.u32(pPlayer >>> 0) | 0) !== UNIT_PLAYER) return
  if (pGame !== 0) {
    const b = m.u32((pPlayer + 0xd0) >>> 0) | 0
    if (b >= 0 && b < 8) {
      const pHead = m.u32((pGame + b * 4 + 0x10f8) >>> 0) >>> 0
      if (pHead !== 0 && !isAddrByteLoaded(m, pHead)) {
        m.fill(pHead, 0x10, 0)
        m.setU32(pHead, pPlayer >>> 0)
      }
    }
  }
  const pPlrData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  if (pPlrData === 0) return
  const rawClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
  const pClient = rawClient !== 0 ? rawClient : (pGame !== 0 ? (m.u32((pGame + 0x88) >>> 0) >>> 0) : 0)
  if (pClient !== 0) {
    ensureZeroedIfUnloaded(m, (pClient + 0x3d4) >>> 0, 4)
    if (!isAddrByteLoaded(m, (pClient + 0x16c) >>> 0)) {
      m.setU32((pClient + 0x16c) >>> 0, 0)
    }
    if (!isAddrByteLoaded(m, (pClient + 0x170) >>> 0)) {
      m.setU32((pClient + 0x170) >>> 0, m.u32((pPlayer + 0x0c) >>> 0))
    }
    if (!isAddrByteLoaded(m, (pClient + 0x174) >>> 0) || m.u32((pClient + 0x174) >>> 0) === 0) {
      m.setU32((pClient + 0x174) >>> 0, pPlayer >>> 0)
    }
    if (pGame !== 0 && (!isAddrByteLoaded(m, (pClient + 0x1a8) >>> 0) || m.u32((pClient + 0x1a8) >>> 0) === 0)) {
      m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
    }
  }
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  const nPetTypes = sgpt !== 0 ? (m.u32((sgpt + 0xbf0) >>> 0) | 0) : 0
  if (nPetTypes <= 0) return

  let pPetTable = m.u32((pPlrData + 0x44) >>> 0) >>> 0
  if (pPetTable === 0) {
    pPetTable = m.alloc(4) >>> 0
    m.setU32((pPlrData + 0x44) >>> 0, pPetTable)
  }
  if ((m.u32(pPetTable) >>> 0) === 0) {
    const byteLen = imul32(nPetTypes, 12)
    const pSlots = m.alloc(byteLen) >>> 0
    m.fill(pSlots, byteLen, 0)
    m.setU32(pPetTable, pSlots)
  }
}

function ensureItemsLinkerHydratedK3_113c(m: Memory113c): void {
  const pLinkVar = 0x6fdeff6c
  const pExisting = isAddrByteLoaded(m, pLinkVar) ? (m.u32(pLinkVar) >>> 0) : 0
  if (pExisting !== 0 && isAddrByteLoaded(m, pExisting)) {
    const pEntries = m.u32((pExisting + 0x08) >>> 0) >>> 0
    if (pEntries !== 0 && isAddrByteLoaded(m, pEntries)) return
  }
  const nItems = isAddrByteLoaded(m, 0x6fdefb94) ? (m.u32(0x6fdefb94) | 0) : 0
  const pItemsTxt = isAddrByteLoaded(m, 0x6fdefb98) ? (m.u32(0x6fdefb98) >>> 0) : 0
  if (nItems <= 0 || pItemsTxt === 0) return

  const codes = new Uint32Array(nItems)
  const indices = new Int32Array(nItems)
  let count = 0
  for (let i = 0; i < nItems; i++) {
    const pRec = (pItemsTxt + imul32(i, 0x1a8)) >>> 0
    if (!isAddrByteLoaded(m, (pRec + 0x80) >>> 0)) continue
    const code = m.u32((pRec + 0x80) >>> 0) >>> 0
    let pos = count
    while (pos > 0 && codes[pos - 1]! > code) {
      codes[pos] = codes[pos - 1]!
      indices[pos] = indices[pos - 1]!
      pos--
    }
    codes[pos] = code
    indices[pos] = i
    count++
  }
  const pLinker = m.alloc(0x10) >>> 0
  const pArr = m.alloc(count * 8) >>> 0
  m.setU32(pLinker, count >>> 0)
  m.setU32((pLinker + 0x04) >>> 0, count >>> 0)
  m.setU32((pLinker + 0x08) >>> 0, pArr)
  for (let j = 0; j < count; j++) {
    m.setU32((pArr + j * 8) >>> 0, codes[j]! >>> 0)
    m.setU32((pArr + j * 8 + 4) >>> 0, indices[j]! >>> 0)
  }
  m.setU32(pLinkVar, pLinker)
}

function snapshotInitialPetBaseStatsK3(m: Memory113c, pMon: number): Map<number, number> {
  const snap = new Map<number, number>()
  const pBase = m.u32((pMon + 0x5c) >>> 0) >>> 0
  if (pBase === 0) return snap
  const pArr = m.u32((pBase + 0x24) >>> 0) >>> 0
  const nCnt = m.u16((pBase + 0x28) >>> 0)
  for (let i = 0; i < nCnt; i++) {
    const statId = m.u16((pArr + i * 8 + 2) >>> 0)
    const val = m.u32((pArr + i * 8 + 4) >>> 0) | 0
    snap.set(statId, val)
  }
  return snap
}

function fixSummonStatsAfter6FC6F970_K3(
  m: Memory113c,
  pGame: number,
  pOwner: number,
  pPet: number,
  skId: number,
  effLvl: number,
  initBase: ReadonlyMap<number, number>,
): void {
  if (pPet === 0) return
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skId) >>> 0
  if (pSkillsTxt === 0) return

  let acBonus = 0
  let thBonus = 0
  const petLvl = STATLIST_GetUnitBaseStat113c(m, pPet, 0x0c, 0) | 0
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pSgptPtr !== 0 ? (m.u32(pSgptPtr) >>> 0) : 0
  if (pDataTables !== 0) {
    const nMonLvlCount = m.u32((pDataTables + 0xb74) >>> 0) | 0
    const maxIdx = (nMonLvlCount - 1) | 0
    const rowIdx = petLvl < maxIdx ? petLvl : maxIdx
    if (rowIdx >= 0 && rowIdx < nMonLvlCount) {
      const pMonLvlRec = (m.u32((pDataTables + 0xb70) >>> 0) + imul32(rowIdx, 0x78)) >>> 0
      const rawDiff = m.u8((pGame + 0x6d) >>> 0)
      const diff = rawDiff <= 0 ? 0 : rawDiff < 2 ? rawDiff : 2
      const isExp =
        m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0 ? 1 : 0
      acBonus = m.u32((pMonLvlRec + (diff + isExp * 3) * 4) >>> 0) | 0
      thBonus = m.u32((pMonLvlRec + (diff + (isExp + 2) * 3) * 4) >>> 0) | 0
    }
  }

  let passiveMaxHpAdd = 0
  const nIscCount = pDataTables !== 0 ? (m.u32((pDataTables + 0xbd4) >>> 0) | 0) : 0
  for (let i = 0; i < 5; i++) {
    const nStatId = sx16(m.u16((pSkillsTxt + 0x98 + i * 2) >>> 0))
    if (nStatId < 0 || nStatId >= nIscCount) continue
    const dwCalc = m.u32((pSkillsTxt + 0xa4 + i * 4) >>> 0)
    const nVal = SKILLS_EvalCalcByOffset113c(m, pOwner, dwCalc, skId, effLvl) | 0
    if (nStatId === 7) {
      passiveMaxHpAdd = (passiveMaxHpAdd + nVal) | 0
      continue
    }
    const baseInit = initBase.get(nStatId)
    let preVal = baseInit !== undefined ? baseInit : 0
    if (nStatId === 0x1f) preVal = (preVal + acBonus) | 0
    if (nStatId === 0x13) preVal = (preVal + thBonus) | 0
    STATLIST_SetUnitStat113c(m, pPet, nStatId, (preVal + nVal) | 0, 0)
  }

  const rawInitMaxHp = initBase.get(7)
  const baseMaxHp = ((rawInitMaxHp !== undefined ? rawInitMaxHp : 0) + passiveMaxHpAdd) | 0
  STATLIST_SetUnitStat113c(m, pPet, 7, baseMaxHp, 0)
  const preMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pPet) | 0
  const nLifeBonusPct =
    SKILLS_EvalCalcByOffset113c(m, pOwner, m.u32((pSkillsTxt + 0x138) >>> 0), skId, effLvl) | 0
  const bonusLife = Number((BigInt(preMaxLife) * BigInt(nLifeBonusPct)) / 100n) | 0
  const finalMaxLife = (preMaxLife + bonusLife) | 0
  STATLIST_SetUnitStat113c(m, pPet, 7, finalMaxLife, 0)
  STATLIST_SetUnitStat113c(m, pPet, 6, finalMaxLife, 0)
  const pMonTxt = MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(m, pPet) >>> 0
  if (pMonTxt !== 0) {
    const nLifeRegen = m.u32((pMonTxt + 0x1a0) >>> 0) | 0
    if (nLifeRegen !== 0) {
      STATLIST_SetUnitStat113c(m, pPet, 0x4a, (imul32(finalMaxLife >> 8, nLifeRegen) >> 4) | 0, 0)
    }
  }
}

function ensureSummonRegisteredInPetSlotK3_113c(
  m: SparseMemory113c,
  pGame: number,
  pSpawnDesc: number,
  pPetUnit: number,
): void {
  if (pPetUnit === 0) return
  const pOwner = m.u32((pSpawnDesc + 0x04) >>> 0) >>> 0
  if (pOwner === 0 || (m.u32(pOwner) | 0) !== UNIT_PLAYER) return
  const nPetType = m.u32((pSpawnDesc + 0x1c) >>> 0) | 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  const nPetTypesCount = sgpt !== 0 ? (m.u32((sgpt + 0xbf0) >>> 0) | 0) : 0
  if (nPetType <= 0 || nPetType >= nPetTypesCount) return

  const pPlrData = UNITS_GetPlayerData113c(m, pOwner) >>> 0
  const pPlayerPets = pPlrData !== 0 ? (m.u32((pPlrData + 0x44) >>> 0) >>> 0) : 0
  if (pPlayerPets === 0) return

  const pPetTypeSlot = SUMMON_GetPetTypeBucketPtr_6FCB6540_113c(m, nPetType, pPlayerPets) >>> 0
  if (pPetTypeSlot === 0) return

  const dwPetGuid = m.u32((pPetUnit + 0x0c) >>> 0) >>> 0
  let node = m.u32(pPetTypeSlot) >>> 0
  while (node !== 0) {
    if ((m.u32((node + 0x04) >>> 0) >>> 0) === dwPetGuid) {
      return
    }
    node = m.u32((node + 0x14) >>> 0) >>> 0
  }

  const rawMax = m.u32((pSpawnDesc + 0x20) >>> 0) | 0
  const nMaxPets = rawMax < 1 ? 1 : rawMax
  const sp = allocK3Scratch(m, 0x30)
  try {
    const pInfo12 = sp >>> 0
    const pAssignCtx = (sp + 0x10) >>> 0
    PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c(m, pGame, pOwner, nPetType)
    PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c(m, nPetType, pOwner, pGame, nMaxPets)
    if (
      PETS_InsertPetIntoPlayerPetSlot_6FCB7A20_113c(
        m,
        pPetTypeSlot,
        pGame,
        pOwner,
        pPetUnit,
        pInfo12,
      ) === 0
    ) {
      return
    }
    m.setU32(pAssignCtx, m.u32((pOwner + 0x0c) >>> 0))
    m.setU32((pAssignCtx + 0x04) >>> 0, dwPetGuid)
    m.setU16((pAssignCtx + 0x08) >>> 0, m.u16((pPetUnit + 0x04) >>> 0))
    m.setU32((pAssignCtx + 0x0c) >>> 0, nPetType >>> 0)
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      pGame,
      (mem, _g, pTargetPlr, pCtx) => {
        PETS_SendPetOrMercAssignPacket_6FCB66E0_113c(mem as SparseMemory113c, pTargetPlr, pCtx)
      },
      pAssignCtx,
    )
  } finally {
    freeK3Scratch(sp)
  }
}

function spawnSummonPetWithSafePetInfoK3_113c(
  m: SparseMemory113c,
  pGame: number,
  pSpawnDesc: number,
): number {
  const pOwner = m.u32((pSpawnDesc + 0x04) >>> 0) >>> 0
  const pPlrData =
    pOwner !== 0 && (m.u32(pOwner) | 0) === UNIT_PLAYER ? (UNITS_GetPlayerData113c(m, pOwner) >>> 0) : 0
  const savedPetTable = pPlrData !== 0 ? (m.u32((pPlrData + 0x44) >>> 0) >>> 0) : 0
  if (pPlrData !== 0 && savedPetTable !== 0) {
    m.setU32((pPlrData + 0x44) >>> 0, 0)
  }
  const pMon = D2Game_6FCC3610_113c(m, pSpawnDesc, pGame) >>> 0
  if (pPlrData !== 0 && savedPetTable !== 0) {
    m.setU32((pPlrData + 0x44) >>> 0, savedPetTable)
  }
  if (pMon !== 0) {
    const spawnMode = m.u32((pSpawnDesc + 0x10) >>> 0) | 0
    if (spawnMode !== 1) {
      let pEvt = m.u32((pMon + 0xdc) >>> 0) >>> 0
      while (pEvt !== 0) {
        const pNext = m.u32((pEvt + 0x24) >>> 0) >>> 0
        if (m.u8(pEvt) === 1) {
          EVENT_FreeNode113c(m, pGame, pEvt)
        }
        pEvt = pNext
      }
    }
  }
  if (pMon !== 0 && pOwner !== 0 && (m.u32(pOwner) | 0) === UNIT_PLAYER) {
    const rawMax = m.u32((pSpawnDesc + 0x20) >>> 0) | 0
    const nMaxPets = rawMax < 1 ? 1 : rawMax
    const sp = allocK3Scratch(m, 0x10)
    try {
      PETS_RegisterSummonPetAndClampCount_6FCB7F50_113c(m, -1, pOwner, pGame, pMon, nMaxPets, sp)
    } finally {
      freeK3Scratch(sp)
    }
    ensureSummonRegisteredInPetSlotK3_113c(m, pGame, pSpawnDesc, pMon)
  }
  return pMon
}

/**
 * Dispatches K3 summon & curse `wSrvDoFunc` indices (`16, 30, 31, 56`) through canonical
 * manifest-bound `tsSymbol` functions (`0x6FC705D0`, `0x6FC6D710`, `0x6FC71750`, `0x6FC718B0`).
 */
export function dispatchSummonOrCurseDoFuncK3_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  doIdx: number,
  skId: number,
  effLvl: number,
): number {
  bindK2KernelGlobals113c(m)
  const sm = m as SparseMemory113c

  if (doIdx === 30) {
    return SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c(sm, pGame, pUnit, skId, effLvl)
  }

  ensurePlayerPetTableAllocatedK3_113c(m, pUnit, pGame)

  if (doIdx === 16) {
    let spawnedPet = 0
    let savedPetInv = 0
    let initBase: Map<number, number> | null = null
    const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skId) >>> 0
    const rawSummonMode = pSkillsTxt !== 0 ? m.u8((pSkillsTxt + 0xbf) >>> 0) : 1
    const summonMode = rawSummonMode < 16 ? rawSummonMode : 1
    const rc = SKILLS_SrvDo_SummonDecoy_6FC6D710_113c(
      sm,
      pGame,
      pUnit,
      skId,
      effLvl,
      (mem, pg, pSummonArg) => {
        mem.setU32((pSummonArg + 0x10) >>> 0, summonMode)
        const pMon = spawnSummonPetWithSafePetInfoK3_113c(mem, pg, pSummonArg)
        if (pMon !== 0) {
          spawnedPet = pMon
          initBase = snapshotInitialPetBaseStatsK3(mem, pMon)
          savedPetInv = mem.u32((pMon + 0x60) >>> 0) >>> 0
          mem.setU32((pMon + 0x60) >>> 0, 0)
        }
        return pMon
      },
    )
    if (spawnedPet !== 0 && initBase !== null) {
      fixSummonStatsAfter6FC6F970_K3(m, pGame, pUnit, spawnedPet, skId, effLvl, initBase)
    }
    if (spawnedPet !== 0 && savedPetInv !== 0) {
      m.setU32((spawnedPet + 0x60) >>> 0, savedPetInv)
      let nCalc13C =
        pSkillsTxt !== 0
          ? SKILLS_EvalCalcByOffset113c(
              m,
              pUnit,
              m.u32((pSkillsTxt + 0x13c) >>> 0),
              skId,
              effLvl,
            ) | 0
          : 0
      if (nCalc13C === 0) {
        const nOwnerLvl = STATLIST_GetUnitStat113c(m, pUnit, 0x0c, 0) | 0
        let nCap = imul32(effLvl, 3)
        if (nCap <= 1) nCap = 1
        nCalc13C = nCap < nOwnerLvl ? nCap : nOwnerLvl
      }
      ensureItemsLinkerHydratedK3_113c(m)
      MONSTER_EquipMonEquipItems113c(m, spawnedPet, pGame, pUnit, nCalc13C, 0, effLvl)
      const pPetMonData = m.get(spawnedPet, D2UnitStrc.pUnitData) >>> 0
      if (pPetMonData !== 0) {
        ensureZeroedIfUnloaded(m, (pPetMonData + 0x30) >>> 0, 4)
        const pInteract = m.u32((pPetMonData + 0x30) >>> 0) >>> 0
        if (pInteract !== 0) {
          ensureZeroedIfUnloaded(m, pInteract, 4)
        }
      }
      const pOwnerPlrData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
      const rawOwnerClient = pOwnerPlrData !== 0 ? (m.u32((pOwnerPlrData + 0x9c) >>> 0) >>> 0) : 0
      const pOwnerClient =
        rawOwnerClient !== 0 ? rawOwnerClient : (m.u32((pGame + 0x88) >>> 0) >>> 0)
      if (pOwnerClient !== 0) {
        PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c(sm, pOwnerClient, spawnedPet)
      }
      MONSTER_IsPlayerInteractInTradeState113c(m, spawnedPet, pUnit)
      for (
        let pEqItem = INVENTORY_GetFirstItem113c(m, savedPetInv) >>> 0;
        pEqItem !== 0;
        pEqItem = INVENTORY_GetNextItem113c(m, pEqItem) >>> 0
      ) {
        ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c(m, pEqItem)
      }
      const fullMaxHp = STATLIST_GetMaxLifeFromUnit113c(m, spawnedPet) | 0
      STATLIST_SetUnitStat113c(m, spawnedPet, 6, fullMaxHp, 0)
    }
    return rc
  }

  if (doIdx === 56) {
    let spawnedPet = 0
    let initBase: Map<number, number> | null = null
    const rc = SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c(
      sm,
      pGame,
      pUnit,
      skId,
      effLvl,
      (mem, pg, pSummonArg) => {
        const pMon = spawnSummonPetWithSafePetInfoK3_113c(mem, pg, pSummonArg)
        if (pMon !== 0) {
          spawnedPet = pMon
          initBase = snapshotInitialPetBaseStatsK3(mem, pMon)
        }
        return pMon
      },
    )
    if (spawnedPet !== 0 && initBase !== null) {
      fixSummonStatsAfter6FC6F970_K3(m, pGame, pUnit, spawnedPet, skId, effLvl, initBase)
    }
    return rc
  }

  if (doIdx === 31) {
    let spawnedPet = 0
    let initBase: Map<number, number> | null = null
    const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skId) >>> 0
    const rawSummonMode = pSkillsTxt !== 0 ? m.u8((pSkillsTxt + 0xbf) >>> 0) : 1
    const summonMode = rawSummonMode < 16 ? rawSummonMode : 1
    const rc = SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c(
      sm,
      pGame,
      pUnit,
      skId,
      effLvl,
      (mem, pg, pSummonArg) => {
        mem.setU32((pSummonArg + 0x10) >>> 0, summonMode)
        const pMon = spawnSummonPetWithSafePetInfoK3_113c(mem, pg, pSummonArg)
        if (pMon !== 0) {
          spawnedPet = pMon
          initBase = snapshotInitialPetBaseStatsK3(mem, pMon)
        }
        return pMon
      },
    )
    if (spawnedPet !== 0 && initBase !== null) {
      fixSummonStatsAfter6FC6F970_K3(m, pGame, pUnit, spawnedPet, skId, effLvl, initBase)
    }
    return rc
  }

  return 1
}

/**
 * Top-level `NecroPet` AI (`0x6FC3E900`) dispatcher routing directly through
 * `ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c` -> `D2Game_6FC3E3D0_113c` / `D2Game_6FC3E640_113c`.
 */
export function runNecroPetAiK3_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  ops: NecroPetReplayOps113c,
): void {
  if (pMonster === 0 || SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return
  bindK2KernelGlobals113c(m)
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData) >>> 0
  if (pMonData === 0) return
  ensureZeroedIfUnloaded(m, (pMonData + 0x3c) >>> 0, 12)
  let pAiParam = isAddrByteLoaded(m, (pMonData + 0x18) >>> 0)
    ? (m.u32((pMonData + 0x18) >>> 0) >>> 0)
    : 0
  if (pAiParam === 0) {
    pAiParam = m.alloc(0x24) >>> 0
    m.fill(pAiParam, 0x24, 0)
    const classId = m.u32((pMonster + 0x04) >>> 0) | 0
    if (classId === 0x16c) {
      m.setU32((pAiParam + 0x14) >>> 0, 1)
    }
    m.setU32((pMonData + 0x18) >>> 0, pAiParam)
  } else {
    ensureZeroedIfUnloaded(m, pAiParam, 0x24)
  }
  const pUnitMonStatsTxt = MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(m, pMonster) >>> 0
  const pMonStatsTxt =
    pUnitMonStatsTxt !== 0 ? pUnitMonStatsTxt : (m.get(pMonData, D2MonsterDataStrc.pMonStatsTxt) >>> 0)

  const pAiTickArgs = allocK3Scratch(m, 0x24)
  try {
    m.setU32(pAiTickArgs, pAiParam)
    m.setU32((pAiTickArgs + 0x1c) >>> 0, pMonStatsTxt)
    ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c(
      m as SparseMemory113c,
      pGame,
      pMonster,
      pAiTickArgs,
      undefined,
      undefined,
      ops,
    )
  } finally {
    freeK3Scratch(pAiTickArgs)
  }

  const pOwner = AIGENERAL_GetPackLeaderUnit113c(m, pMonster) >>> 0
  if (pOwner !== 0 && (m.u32(pOwner) | 0) === UNIT_PLAYER) {
    ensurePlayerPetTableAllocatedK3_113c(m, pOwner, pGame)
    const pPlrData = UNITS_GetPlayerData113c(m, pOwner) >>> 0
    const rawClient = pPlrData !== 0 ? (m.u32((pPlrData + 0x9c) >>> 0) >>> 0) : 0
    const pClient = rawClient !== 0 ? rawClient : (m.u32((pGame + 0x88) >>> 0) >>> 0)
    if (pClient !== 0) {
      NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c(
        m as SparseMemory113c,
        pClient,
        pMonster,
      )
    }
  }
}

/**
 * Returns `true` when `pUnit` wields a two-handed weapon (`Items.txt + 0x127` `b2Handed !== 0`
 * on a non-dual-wielding unit, `0x6FCFC566` `INVENTORY_GetWieldType == 2`).
 */
export function isUnitWieldingTwoHandedWeaponK3_113c(
  m: Memory113c,
  pUnit: number,
  pWeapon: number,
): boolean {
  if (pUnit === 0 || pWeapon === 0) return false
  if (m.get(pUnit, D2UnitStrc.pInventory) === 0) return false
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  const pItemsTxtBase = m.u32(0x6fdefb98) >>> 0
  const nItemsCount = m.u32(0x6fdefb94) | 0
  const itemClassId = m.u32((pWeapon + 0x04) >>> 0) | 0
  if (pItemsTxtBase !== 0 && itemClassId >= 0 && itemClassId < nItemsCount) {
    const pTxt = (pItemsTxtBase + imul32(itemClassId, 0x1a8)) >>> 0
    return m.u8((pTxt + 0x127) >>> 0) !== 0
  }
  if (sgpt !== 0) {
    const pAltBase = m.u32(sgpt) >>> 0
    if (pAltBase !== 0 && itemClassId >= 0) {
      const pTxt = (pAltBase + imul32(itemClassId, 0x1a8)) >>> 0
      return m.u8((pTxt + 0x127) >>> 0) !== 0
    }
  }
  return false
}

/**
 * Dispatches attacker `DO_MELEE_DAMAGE` (`event = 5` at `0x6FCFE1DD`) item/skill event callbacks
 * (such as Clay Golem `0x6FC6EF70` / `0x6FCCD2A0` Slow Target and Valkyrie rare weapon procs).
 */
export function dispatchAttackerMeleeHitItemEventsK3_113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmgScratch: number,
): void {
  SUNITDMG_TriggerAttackerBlindOrFlee113c(m, pGame, pAttacker, 0, pDmgScratch)
  MONSTER_ApplyCritDamage113c(m, 0, pDmgScratch, pDefender)
  if (
    pAttacker !== 0 &&
    (m.u32(pAttacker >>> 0) | 0) === UNIT_PLAYER &&
    (m.u32((pAttacker + 0x04) >>> 0) | 0) === 0
  ) {
    SEED_RollRangeWithMinFast113c(m, 0, 0, 0)
  }
  if (pAttacker === 0 || !isAddrByteLoaded(m, (pAttacker + 0x90) >>> 0)) return
  const head = m.u32((pAttacker + 0x90) >>> 0) >>> 0
  if (head < 0x40000000) return
  bindK2KernelGlobals113c(m)
  SUNIT_DispatchItemEventCallbacks113c(m, pAttacker, pGame, 5, pDefender, pDmgScratch)
}

/**
 * Resolves `pKiller` to its owning `UNIT_PLAYER` (`0x6FCFB5E0`) when a summoned pet or missile kills
 * a monster so XP and kill count are credited to the player.
 */
export function resolveKillerPlayerForMonsterDeathK3_113c(
  m: Memory113c,
  pGame: number,
  pKiller: number,
): number {
  if (pKiller === 0) return 0
  const uType = m.get(pKiller, D2UnitStrc.dwUnitType)
  if (uType === UNIT_PLAYER) return pKiller
  bindK2KernelGlobals113c(m)
  const resolved = SUNITDMG_ResolveAttackerPlayer113c(m, pGame, pKiller) >>> 0
  if (resolved !== 0 && m.get(resolved, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
    return resolved
  }
  if (uType === UNIT_MONSTER) {
    const pAiGen = MONSTER_GetAiGeneralPtr_6FC218E0_113c(m as SparseMemory113c, pKiller) >>> 0
    if (
      pAiGen !== 0 &&
      m.u32((pAiGen + 0x28) >>> 0) !== 0 &&
      m.u32((pAiGen + 0x30) >>> 0) === UNIT_PLAYER
    ) {
      const ownerGuid = m.u32((pAiGen + 0x2c) >>> 0) >>> 0
      const pOwner =
        SUNIT_GetServerUnit113c(m, m.u32((pAiGen + 0x28) >>> 0), UNIT_PLAYER, ownerGuid) >>> 0
      if (pOwner !== 0 && m.get(pOwner, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
        return pOwner
      }
    }
  }
  return 0
}

/**
 * Resolves `D2Common:0x6FD83110` (`UNITS_SetUnitAnimMode` -> `0x6FDA01E0` `UNITS_GetTransformGfx` ->
 * `0x6FD80D50` `UNITS_GetBaseWalkVelocity`) velocity for disguised/transformed monsters such as
 * Valkyrie (`STATE_VALKYRIE = 98` -> `UNIT_PLAYER`, `CLASS_AMAZON`, `nWalkSpeed = 6 << 8 = 1536`).
 */
export function resolveMonsterScaledVelocityK3_113c(
  m: Memory113c,
  pMonster: number,
  mode: number,
  rowVelocity: number,
  totalPct: number,
): number {
  if (pMonster !== 0 && ((m.u32((pMonster + 0xc8) >>> 0) >>> 3) & 1) !== 0) {
    const [outType, outClass, outMode] = unitsGetTransformGfxValues113c(
      m,
      pMonster,
      1,
      m.u32((pMonster + 0x04) >>> 0),
      mode,
    )
    if ((outType | 0) === UNIT_PLAYER) {
      if ((outMode | 0) === 3) {
        return 0x1000
      }
      const baseWalk256 = UNITS_GetBaseWalkVelocity113c(m, UNIT_PLAYER, outClass | 0) | 0
      const effBase256 = baseWalk256 > 0 ? baseWalk256 : 0x600
      const scaled = Math.trunc((effBase256 * totalPct) / 100) | 0
      return scaled > 0 ? scaled : 0
    }
  }
  const scaled = Math.trunc(((rowVelocity << 8) * totalPct) / 100) | 0
  return scaled > 0 ? scaled : 0
}

/**
 * Extends evil monster target acquisition (`0x6FCBD3B0` -> `0x6FCD1C90` -> `0x6FCD1660`) to include
 * player-aligned summoned pets (`UNIT_GetAlignment == 2` with `UNITFLAG_ISVALIDTARGET = 0x04`),
 * preserving LIFO `pRoom->pUnitFirst` tie-breaking when a summoned pet was inserted after the player.
 */
export function scanFriendlyPetTargetsForEvilMonsterK3_113c(
  m: Memory113c,
  monsters: Iterable<number>,
  pMonster: number,
  mx: number,
  my: number,
  radius: number,
  minDist: number,
  bestTarget: number,
): { minDist: number; bestTarget: number } {
  const playerMinDist = minDist | 0
  let curBest = bestTarget >>> 0
  if (pMonster === 0 || UNIT_GetAlignment113c(m, pMonster) !== 0) {
    return { minDist: playerMinDist, bestTarget: curBest }
  }
  const monAct = m.u8((pMonster + 0x18) >>> 0)
  let bestTargetDist = curBest !== 0 && playerMinDist < radius ? playerMinDist : (radius | 0)
  if (bestTargetDist > 55) bestTargetDist = 55

  const petList: number[] = []
  for (const pCand of monsters) {
    if (pCand === 0 || pCand === pMonster) continue
    if (m.u8((pCand + 0x18) >>> 0) !== monAct) continue
    if (SUNIT_IsDeadOrDying113c(m, pCand) !== 0) continue
    if (((m.get(pCand, D2UnitStrc.dwFlags) >>> 2) & 1) === 0) continue
    if (UNIT_GetAlignment113c(m, pCand) !== 2) continue
    const pCandRoom = UNITS_GetRoom113c(m, pCand) >>> 0
    if (pCandRoom !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, pCandRoom) !== 0) continue
    petList.push(pCand >>> 0)
  }
  for (let i = petList.length - 1; i >= 0; i--) {
    const pCand = petList[i]!
    const d = UNITS_GetOctileDistanceToCoordinates113c(m, pCand, mx | 0, my | 0) | 0
    if (d >= 0 && d < bestTargetDist) {
      if (UNITS_HasCollisionBetweenUnits113c(m, pMonster, pCand, 4) === 0) {
        bestTargetDist = d
        curBest = pCand
      }
    }
  }
  return {
    minDist: curBest !== 0 && curBest !== (bestTarget >>> 0) ? bestTargetDist : playerMinDist,
    bestTarget: curBest,
  }
}

/**
 * Dispatches `UNIT_ITEM` (`uType === 4`) timer events (`0x6FCFA480` self-repair / replenish quantity).
 */
export function dispatchItemTimerEventK3_113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
  evType: number,
): void {
  if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return
  if (evType === 0 || evType === 3) {
    bindK2KernelGlobals113c(m)
    ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c(
      m as SparseMemory113c,
      pGame,
      pItem,
    )
  }
}

/**
 * Checks whether `STATE_COLD` (`28`) is active on `pDefender`.
 */
export function hasColdChillOnMeleeHitK3_113c(m: Memory113c, pDefender: number): boolean {
  return pDefender !== 0 && STATES_CheckState113c(m, pDefender, 28) !== 0
}
