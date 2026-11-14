/**
 * Pure 1:1 `D2Game.dll` v1.13c Blood Moor wilderness monster population,
 * region density (`REGPOP`), outfit variation (`MONREG`), object/shrine seeding,
 * unit seed stepping, and Fallen/Fetish party spawn routines for `[K1]`.
 *
 * Every `@va`-annotated export is a direct instruction-faithful translation of
 * its corresponding `D2Game.dll` v1.13c machine-code routine operating on
 * `Memory113c` (`SparseMemory113c`).
 */

import {
  COLLISION_CheckMaskWithPattern1_113c,
  COLLISION_CheckSubtileMask113c,
  COLLISION_FindFreePosition113c,
  COLLISION_SetMaskWithPattern113c,
  COLLISION_SetMaskWithSizeXY113c,
} from '../common/collision.ts'
import { UNITS_SetObjectShrineTxt113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { SEED_GenerateLoopSeed113c } from '../common/drlg/drlg-grid.ts'
import { UNITS_GetMonStats2ComponentChoice113c } from '../common/drlg/out-jung.ts'
import { D2CMP_10051_GetTileFlags113c } from '../common/drlg/room-tile.ts'
import {
  DUNGEON_FindFreeSpawnPositionInLevel113c,
  DUNGEON_FindLevelSpawnRoom113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetFloorTilesFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetLevelIdIfNotHidden113c,
  DUNGEON_GetLogicalRoomField30_113c,
  DUNGEON_GetRoomCoordListFromSubtile113c,
  DUNGEON_GetRoomCoordListIndexAtSubtile113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_IncreaseRoomPlayerCount113c,
} from '../common/dungeon.ts'
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../common/inline-helpers.ts'
import { INVENTORY_AllocInventory113c, INVENTORY_FreeInventory113c } from '../common/inventory.ts'
import {
  ITEMMODS_ApplyPropertyById113c,
  ITEMS_AllocItemData113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_GetItemSeed113c,
  ITEMS_GetOwnerGuid113c,
  ITEMS_InitItemSeed113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetOwnerGuid113c,
} from '../common/items.ts'
import { STATLIST_GetStatListFromUnitAndStateMemPort113c } from '../common/k0-d2common-memports.ts'
import { MONSTERS_GetHirelingTypeId113c } from '../common/missile.ts'
import {
  PATH_AllocDynamicPath113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndId113c,
  PATH_GetTargetUnit113c,
  PATH_MarkUnitDeadCollision113c,
  PATH_RefreshUnitCollisionPattern113c,
  PATH_RemoveUnitCollisionFootprint113c,
  PATH_SetCollisionMask113c,
  PATH_SetTargetUnit113c,
  PATH_SetUnitCollisionPattern113c,
  PATH_SetVelocity113c,
} from '../common/path.ts'
import { UNITS_InitStaticPathCoords113c } from '../common/quest-record.ts'
import {
  SKILLS_AllocSkillList113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_RefreshPassiveAuraSkills113c,
  SKILLS_SetSkillLevelOnUnit113c,
  SKILLS_SetSkillSlotIndex113c,
} from '../common/skills.ts'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  DUNGEON_GetRoomTileSubtypesPtr113c,
  MONSTERS_ApplyClassicConversionStats113c,
  STATES_CheckState113c,
  STATES_ClearGfxStateFlag113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CheckUnitStatListFlag100113c,
  STATLIST_ClearMonsterSkillIconStatList113c,
  STATLIST_CreateEx113c,
  STATLIST_FreeModStats113c,
  STATLIST_GetStatValue113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  ANIMSEQ_GetUnitSeqRecordPtr113c,
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_AddUnitToRoom113c,
  UNITROOM_RefreshUnit113c,
  UNITROOM_SortUnitListByY113c,
  UNITS_AllocStaticPath113c,
  UNITS_ClearGfxStateFlags113c,
  UNITS_GetAnimDataRecord113c,
  UNITS_GetRoom113c,
  UNITS_InitSkillAnimSequence113c,
  UNITS_SetCollisionMaskAtCoords113c,
  UNITS_SetPathRoomRefreshFlag113c,
  UNITS_SetRoom113c,
  UNITS_SetUnitAnimMode113c,
  UNITS_UpdateAnimFrame113c,
  UNIT_Alloc113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SEED_InitLowSeed113c, SEED_InitSeed113c } from '../prng.ts'
import {
  DATATBLS_GetLevelMonsterLevel113c,
  DATATBLS_GetMonLvlTxtRecord113c,
  DATATBLS_GetObjGroupTxtRecord113c,
  DATATBLS_GetObjGroupTxtRecordCount113c,
  DATATBLS_UnusedStub10182_113c,
  MONSTERS_IsDead113c,
} from '../tables/datatbls-113c.ts'
import { DUNGEON_GameTileToSubtileCoords113c } from '../tables/field-tbls-113c.ts'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c.ts'
import { DATATBLS_GetMonsterChainInfo113c } from '../tables/monster-tbls-113c.ts'
import {
  AIGENERAL_InitBossGroup113c,
  AIGENERAL_LinkMinionToLeader113c,
  AI_LookupDispatchTableRow113c,
  MONSTER_InitModeChangeStrc113c,
  SUNITDMG_FreeAttackerCombatList113c,
} from './ai-fallen-113c.ts'
import { MONSTER_StartMode113c } from './combat-a1c-113c.ts'
import { SUNIT_GetNewUnitId113c, SUNIT_GetServerUnit113c, SUNIT_InsertServerUnit113c } from './game-strc.ts'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c.ts'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events.ts'
import {
  EVENT_FreeNode113c,
  EVENT_GetNextEventFrame113c,
  EVENT_RemoveUnitEvents113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'

/** `D2Game.dll` IAT slot `0x6FD1829C` -> `&D2Common!sgptDataTables`. */
export const D2GAME_IAT_SGPT_DATATABLES_VA_113C = 0x6fd1829c

/** `D2Game.dll` IAT slot `0x6FD18BE0` -> `Fog!gdwBitMasks`. */
export const D2GAME_IAT_GDW_BITMASKS_VA_113C = 0x6fd18be0

/** `D2Game.dll` `.rdata` `0x6FD1B5F0`: `int32[9]` player-count HP bonus % table. */
export const D2GAME_PLAYER_HP_BONUS_TABLE_VA_113C = 0x6fd1b5f0

/** `D2Game.dll` `.rdata` `0x6FD1B614`: `int32[9]` player-count EXP bonus % table. */
export const D2GAME_PLAYER_EXP_BONUS_TABLE_VA_113C = 0x6fd1b614

/** `D2Game.dll` `.rdata` `0x6FD1C278`: `4` `(dx, dy)` floor neighbor offsets. */
export const D2GAME_FLOOR_CROSS_OFFSETS_VA_113C = 0x6fd1c278

/** `D2Game.dll` `.rdata` `0x6FD1C298`: `12` `(dx, dy)` fetish party ring offsets. */
export const D2GAME_FETISH_RING_OFFSETS_VA_113C = 0x6fd1c298

/** `D2Game.dll` `.data` `0x6FD2294C`: chest/gargoyle spawn descriptor pointer table. */
export const D2GAME_CHEST_GARGOYLE_PTRS_VA_113C = 0x6fd2294c

/** `D2Game.dll` `.data` `0x6FD31C50`: fallback loop-seed counter for `SUNIT_InitUnitSeed`. */
export const D2GAME_GLOBAL_SEED_COUNTER_VA_113C = 0x6fd31c50

/** Dedicated scratch region for `gdwBitMasks[0..31]` when hydrating standalone memory. */
const D2GAME_GDW_BITMASKS_DATA_VA_113C = 0x6fd41000

/** Reentrant stack frame pointer for `D2Common` out-parameter temporaries. */
let regpopStackPtr = 0x7ff00000

const PLAYER_BONUS_TABLE_9_113C = [0, 0, 50, 100, 150, 200, 250, 300, 350] as const
const FLOOR_CROSS_OFFSETS_113C = [0, -3, 3, 0, 0, 3, -3, 0] as const
const FETISH_RING_OFFSETS_113C = [
  -1, -4, 1, 4, 1, -3, -1, 3, 0, 2, 0, -2, -3, -1, 3, 1, 2, -1, -2, 1, 1, 0, -1, 0,
] as const

/**
 * Packed `0x28`-byte `D2MonsterSpawnStrc` passed on stack to `MONSTER_Create`.
 */
export interface MonsterCreateSpawnArgs113c {
  readonly pArgs: number
  readonly pGame: number
  readonly pRoom: number
  readonly pCoordNode: number
  readonly nClassId: number
  readonly nMode: number
  readonly pLeader: number
  readonly x: number
  readonly y: number
  readonly nMaxRadius: number
  readonly wFlags: number
}

/**
 * Optional hooks for external `D2Game.dll` / `D2Common.dll` callees outside this slice.
 */
export interface RegpopSpawnHooks113c {
  onMonsterCreate?: (m: Memory113c, args: MonsterCreateSpawnArgs113c) => number
  onAllocUnitData?: (
    m: Memory113c,
    nUnitType: number,
    nClassId: number,
    x: number,
    y: number,
    pGame: number,
    pRoom: number,
    wFlags1: number,
    wFlags2: number,
    dwUnused: number,
  ) => number
  onLinkMinionToLeader?: (m: Memory113c, pLeader: number, pMinion: number, pGame: number) => void
  onInitBossGroup?: (
    m: Memory113c,
    pUnit: number,
    nLeaderType: number,
    pGame: number,
    nLeaderId: number,
    bIsGroupMember: number,
    bIsBoss: number,
  ) => void
  onSpawnRandomObjectInRoom?: (
    m: Memory113c,
    nSizeX: number,
    nSizeY: number,
    nObjectId: number,
    pGame: number,
    nSubType: number,
    pRoom: number,
  ) => number
  onSpawnChestOrGargoylePack?: (
    m: Memory113c,
    pRoom: number,
    pDesc: number,
    nClassId: number,
    pGame: number,
  ) => number
  onSpawnChampionOrUniquePack?: (
    m: Memory113c,
    nRarityType: number,
    pRoom: number,
    pGame: number,
    nClassId: number,
  ) => number
  getLevelRoomCountInAct?: (m: Memory113c, pAct: number, nLevelId: number) => number
  getActPresetTileCoords?: (
    m: Memory113c,
    pAct: number,
    nOriginLevelId: number,
    nObjectType: number,
    pOutX: number,
    pOutY: number,
  ) => void
}

/**
 * Hydrates `D2Game.dll` IAT slots and `.rdata`/`.data` tables into `m` for standalone
 * tests and kernel boot.
 */
export function initD2GameGlobalsInMem113c(m: Memory113c, pDataTables: number): void {
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables >>> 0)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, D2COMMON_SGPT_DATATABLES_VA_113C)
  for (let i = 0; i < 32; i++) {
    m.setU32((D2GAME_GDW_BITMASKS_DATA_VA_113C + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, D2GAME_GDW_BITMASKS_DATA_VA_113C)
  for (let i = 0; i < 9; i++) {
    const bonus = PLAYER_BONUS_TABLE_9_113C[i]! >>> 0
    m.setU32((D2GAME_PLAYER_HP_BONUS_TABLE_VA_113C + i * 4) >>> 0, bonus)
    m.setU32((D2GAME_PLAYER_EXP_BONUS_TABLE_VA_113C + i * 4) >>> 0, bonus)
  }
  for (let i = 0; i < FLOOR_CROSS_OFFSETS_113C.length; i++) {
    m.setU32(
      (D2GAME_FLOOR_CROSS_OFFSETS_VA_113C + i * 4) >>> 0,
      FLOOR_CROSS_OFFSETS_113C[i]! >>> 0,
    )
  }
  for (let i = 0; i < FETISH_RING_OFFSETS_113C.length; i++) {
    m.setU32(
      (D2GAME_FETISH_RING_OFFSETS_VA_113C + i * 4) >>> 0,
      FETISH_RING_OFFSETS_113C[i]! >>> 0,
    )
  }
  m.setU32(D2GAME_CHEST_GARGOYLE_PTRS_VA_113C, 0x6fd22910)
  m.setU32(D2GAME_GLOBAL_SEED_COUNTER_VA_113C, 0)
}

function sx8(v: number): number {
  return (v << 24) >> 24
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function stepSeed64Inline(m: Memory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed >>> 0, newLo)
  m.setU32((pSeed + 4) >>> 0, newHi)
  return newLo
}

function rollSeedModInline(m: Memory113c, pSeed: number, nMax: number): number {
  const maxSigned = nMax | 0
  if (maxSigned <= 0) return 0
  const newLo = stepSeed64Inline(m, pSeed)
  const maxU = maxSigned >>> 0
  if ((maxU & ((maxU - 1) >>> 0)) === 0) {
    return (newLo & ((maxU - 1) >>> 0)) | 0
  }
  return ((newLo >>> 0) % maxU) | 0
}

function countRoomsInActLevelInline(m: Memory113c, pAct: number, nLevelId: number): number {
  if (pAct === 0) return 0
  const pActMisc = m.u32((pAct + 0x48) >>> 0)
  if (pActMisc === 0) return 0
  let pLevel = m.u32((pActMisc + 0x47c) >>> 0)
  while (pLevel !== 0) {
    if ((m.u32((pLevel + 0x1d0) >>> 0) | 0) === (nLevelId | 0)) {
      return m.u32((pLevel + 0x14) >>> 0) | 0
    }
    pLevel = m.u32((pLevel + 0x1ac) >>> 0)
  }
  return 0
}

function invokeMonsterCreateHook(
  m: Memory113c,
  pArgs: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  if (hooks === undefined || hooks.onMonsterCreate === undefined) {
    return MONSTER_Create113c(m, pArgs, hooks) >>> 0
  }
  return (
    hooks.onMonsterCreate(m, {
      pArgs,
      pGame: m.u32(pArgs) >>> 0,
      pRoom: m.u32((pArgs + 0x04) >>> 0) >>> 0,
      pCoordNode: m.u32((pArgs + 0x08) >>> 0) >>> 0,
      nClassId: m.u32((pArgs + 0x0c) >>> 0) | 0,
      nMode: m.u32((pArgs + 0x10) >>> 0) | 0,
      pLeader: m.u32((pArgs + 0x14) >>> 0) >>> 0,
      x: m.u32((pArgs + 0x18) >>> 0) | 0,
      y: m.u32((pArgs + 0x1c) >>> 0) | 0,
      nMaxRadius: m.u32((pArgs + 0x20) >>> 0) | 0,
      wFlags: m.u16((pArgs + 0x24) >>> 0) & 0xffff,
    }) >>> 0
  )
}

/**
 * Returns the X coordinate of `pUnit` (static path `+0x0C` for types `2, 4, 5`;
 * `PATH_GetPosX` for dynamic path types `0, 1, 3`).
 *
 * @va D2Game:0x6FC21100 (41B)
 */
export function UNIT_GetPosX113c(m: Memory113c, pUnit: number): number {
  const dwType = m.u32(pUnit >>> 0) | 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0)
    return m.u32((pStaticPath + 0x0c) >>> 0) | 0
  }
  const pDynamicPath = m.u32((pUnit + 0x2c) >>> 0)
  if (pDynamicPath === 0) return 0
  return PATH_GetPosX113c(m, pDynamicPath) | 0
}

/**
 * Returns the Y coordinate of `pUnit` (static path `+0x10` for types `2, 4, 5`;
 * `PATH_GetPosY` for dynamic path types `0, 1, 3`).
 *
 * @va D2Game:0x6FC21130 (41B)
 */
export function UNIT_GetPosY113c(m: Memory113c, pUnit: number): number {
  const dwType = m.u32(pUnit >>> 0) | 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0)
    return m.u32((pStaticPath + 0x10) >>> 0) | 0
  }
  const pDynamicPath = m.u32((pUnit + 0x2c) >>> 0)
  if (pDynamicPath === 0) return 0
  return PATH_GetPosY113c(m, pDynamicPath) | 0
}

/**
 * Fastcall/register `[0..nMax)` PRNG helper (`ecx = pSeed, esi = nMax`).
 *
 * @va D2Game:0x6FC211D0 (69B)
 */
export function SEED_RollLimitedFast113c(m: Memory113c, pSeed: number, nMax: number): number {
  return rollSeedModInline(m, pSeed, nMax)
}

/**
 * Looks up `D2MonStatsTxt*` (`sgptDataTables->pMonStatsTxt + nClassId * 0x1A8`).
 *
 * @va D2Game:0x6FC21220 (38B)
 */
export function MONSTATS_GetRecordPtr113c(m: Memory113c, nClassId: number): number {
  const id = nClassId | 0
  if (id < 0) return 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const nCount = m.u32((pTables + 0xa80) >>> 0) | 0
  if (id >= nCount) return 0
  const pBase = m.u32((pTables + 0xa78) >>> 0)
  return (pBase + Math.imul(id, 0x1a8)) >>> 0
}

/**
 * Returns `pRoom` if `(x, y)` lies inside `pRoom`'s subtile bounds (`+0x4C..+0x58`),
 * else scans `DUNGEON_GetAdjacentRoomsListFromRoom(pRoom)`.
 *
 * @va D2Game:0x6FC21280 (155B)
 */
export function ROOM_FindRoomContainingSubtile113c(
  m: Memory113c,
  pRoom: number,
  x: number,
  y: number,
): number {
  if (pRoom === 0) return 0
  const sx = x | 0
  const sy = y | 0
  const rx = m.u32((pRoom + 0x4c) >>> 0) | 0
  const rw = m.u32((pRoom + 0x54) >>> 0) | 0
  const ry = m.u32((pRoom + 0x50) >>> 0) | 0
  const rh = m.u32((pRoom + 0x58) >>> 0) | 0
  if (sx >= rx && sx < ((rx + rw) | 0) && sy >= ry && sy < ((ry + rh) | 0)) {
    return pRoom >>> 0
  }
  const sp = regpopStackPtr
  regpopStackPtr = (sp + 16) >>> 0
  try {
    const pCount = sp
    const ppRooms = (sp + 4) >>> 0
    m.setU32(pCount, 0)
    m.setU32(ppRooms, 0)
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, ppRooms, pCount)
    const count = m.u32(pCount) >>> 0
    const pList = m.u32(ppRooms) >>> 0
    for (let i = 0; i < count; i++) {
      const pAdj = m.u32((pList + i * 4) >>> 0)
      if (pAdj === 0) continue
      const ax = m.u32((pAdj + 0x4c) >>> 0) | 0
      const aw = m.u32((pAdj + 0x54) >>> 0) | 0
      const ay = m.u32((pAdj + 0x50) >>> 0) | 0
      const ah = m.u32((pAdj + 0x58) >>> 0) | 0
      if (sx >= ax && sx < ((ax + aw) | 0) && sy >= ay && sy < ((ay + ah) | 0)) {
        return pAdj >>> 0
      }
    }
    return 0
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Looks up `D2MonStats2Txt*` from `nClassId` via `MonStatsTxt[nClassId].wMonStatsEx` (`+0x18`).
 *
 * @va D2Game:0x6FC21320 (67B)
 */
export function MONSTATS2_GetRecordPtr113c(m: Memory113c, nClassId: number): number {
  const id = nClassId | 0
  if (id < 0) return 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (id >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return 0
  const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(id, 0x1a8)) >>> 0
  const statsEx = sx16(m.u16((pMonStats + 0x18) >>> 0))
  if (statsEx < 0 || statsEx >= (m.u32((pTables + 0xa98) >>> 0) | 0)) return 0
  return (m.u32((pTables + 0xa90) >>> 0) + Math.imul(statsEx, 0x134)) >>> 0
}

/**
 * Stores `pCoordNode` into `pUnit->pMonsterData->pRoomCoordNode` (`+0x50`).
 *
 * @va D2Game:0x6FC21390 (26B)
 */
export function MONSTER_SetSpawnRoomCoordNode113c(
  m: Memory113c,
  pUnit: number,
  pCoordNode: number,
): void {
  if (pUnit === 0) return
  if ((m.u32(pUnit) | 0) !== 1) return
  const pMonsterData = m.u32((pUnit + 0x14) >>> 0)
  if (pMonsterData === 0) return
  m.setU32((pMonsterData + 0x50) >>> 0, pCoordNode >>> 0)
}

/**
 * Tests bit `nBit` in `D2MonStats2Txt.dwFlags` (`+0x04`) via `gdwBitMasks`.
 *
 * @va D2Game:0x6FC213B0 (97B)
 */
export function MONSTATS2_CheckFlagBit113c(m: Memory113c, nClassId: number, nBit: number): number {
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, nClassId)
  if (pMonStats2 === 0) return 0
  const bit = nBit | 0
  const byteVal = m.u8((pMonStats2 + 0x04 + (bit >> 3)) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
  const mask = m.u32((pMasks + ((bit & 7) << 2)) >>> 0)
  return (mask & byteVal) >>> 0
}

/**
 * Looks up `D2SkillsTxt*` (`sgptDataTables->pSkillsTxt + nSkillId * 0x23C`).
 *
 * @va D2Game:0x6FC21420 (38B)
 */
export function SKILLS_GetRecordPtrFast113c(m: Memory113c, nSkillId: number): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (id >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  return (m.u32((pTables + 0xb98) >>> 0) + Math.imul(id, 0x23c)) >>> 0
}

/**
 * Advances `pSeed` (`esi`) and masks low 32 bits with `(nPow2 - 1)`.
 *
 * @va D2Game:0x6FC21450 (37B)
 */
export function SEED_RollMaskFast113c(m: Memory113c, pSeed: number, nPow2: number): number {
  const newLo = stepSeed64Inline(m, pSeed)
  return (newLo & (((nPow2 | 0) - 1) >>> 0)) >>> 0
}

/**
 * Tests animation mode bit `nModeBit` in `D2MonStats2Txt.dwModeFlags` (`+0xF0`).
 *
 * @va D2Game:0x6FC21560 (100B)
 */
export function MONSTATS2_CheckModeBit113c(
  m: Memory113c,
  nClassId: number,
  nModeBit: number,
): number {
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, nClassId)
  if (pMonStats2 === 0) return 0
  const bit = nModeBit | 0
  const byteVal = m.u8((pMonStats2 + 0xf0 + (bit >> 3)) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
  const mask = m.u32((pMasks + ((bit & 7) << 2)) >>> 0)
  return (mask & byteVal) >>> 0
}

/**
 * Tests bit `nBit` in `D2MonStatsTxt.dwFlags` (`+0x0C`) via `gdwBitMasks`.
 *
 * @va D2Game:0x6FC215D0 (68B)
 */
export function MONSTATS_CheckFlagBit113c(m: Memory113c, nClassId: number, nBit: number): number {
  const pMonStats = MONSTATS_GetRecordPtr113c(m, nClassId)
  if (pMonStats === 0) return 0
  const bit = nBit | 0
  const byteVal = m.u8((pMonStats + 0x0c + (bit >> 3)) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
  const mask = m.u32((pMasks + ((bit & 7) << 2)) >>> 0)
  return (mask & byteVal) >>> 0
}

/**
 * Rolls half-open `[nMin, nMax)` (`ecx = pSeed, edi = nMin, eax = nMax`).
 * Returns `nMin` without stepping `pSeed` when `nMax <= nMin`.
 *
 * @va D2Game:0x6FC21780 (81B)
 */
export function SEED_RollRangeHalfOpen113c(
  m: Memory113c,
  pSeed: number,
  nMin: number,
  nMax: number,
): number {
  const minS = nMin | 0
  const maxS = nMax | 0
  if (maxS <= minS) return minS
  const span = (maxS - minS) | 0
  return (minS + rollSeedModInline(m, pSeed, span)) | 0
}

/**
 * Returns `nClassId` if `0 <= nClassId < nMonStatsTxtRecordCount`, else `-1`.
 *
 * @va D2Game:0x6FC21850 (24B)
 */
export function MONSTATS_ValidateClassId113c(m: Memory113c, nClassId: number): number {
  const id = nClassId | 0
  if (id < 0) return -1
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (id >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return -1
  return id
}

/**
 * Returns `MonStatsTxt[nClassId].wBaseId` (`+0x02`, sign-extended), or `nClassId` if out of range.
 *
 * @va D2Game:0x6FC21870 (41B)
 */
export function MONSTATS_GetBaseIdFromClassId113c(m: Memory113c, nClassId: number): number {
  const id = nClassId | 0
  if (id < 0) return id
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (id >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return id
  const pBase = m.u32((pTables + 0xa78) >>> 0)
  const pRec = (pBase + Math.imul(id, 0x1a8)) >>> 0
  if (pRec === 0) return id
  return sx16(m.u16((pRec + 2) >>> 0))
}

/**
 * Returns `MonStatsTxt[pUnit->dwClassId].wBaseId` for monster units (`dwUnitType == 1`), else `-1`.
 *
 * @va D2Game:0x6FC218A0 (59B)
 */
export function MONSTER_GetBaseIdFromUnit113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return -1
  if ((m.u32(pUnit) | 0) !== 1) return -1
  const nClassId = m.u32((pUnit + 4) >>> 0) | 0
  return MONSTATS_GetBaseIdFromClassId113c(m, nClassId)
}

/**
 * Returns squared Euclidean subtile distance `(xA - xB)^2 + (yA - yB)^2` between two units.
 *
 * @va D2Game:0x6FC21900 (225B)
 */
export function UNIT_CalcSqDistSubtiles113c(m: Memory113c, pUnitA: number, pUnitB: number): number {
  const dx = (UNIT_GetPosX113c(m, pUnitA) - UNIT_GetPosX113c(m, pUnitB)) | 0
  const dy = (UNIT_GetPosY113c(m, pUnitA) - UNIT_GetPosY113c(m, pUnitB)) | 0
  return (Math.imul(dx, dx) + Math.imul(dy, dy)) | 0
}

/**
 * Looks up `D2MonPropTxt*` (`sgptDataTables + 0xC30`, stride `0x138`) via `MonStatsTxt.wMonProp` (`+0x1A`).
 *
 * @va D2Game:0x6FC219F0 (78B)
 */
export function MONPROP_GetRecordPtrFromClassId113c(m: Memory113c, nClassId: number): number {
  const id = nClassId | 0
  if (id < 0) return 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (id >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return 0
  const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(id, 0x1a8)) >>> 0
  if (pMonStats === 0) return 0
  const wMonProp = sx16(m.u16((pMonStats + 0x1a) >>> 0))
  if (wMonProp < 0 || wMonProp >= (m.u32((pTables + 0xc34) >>> 0) | 0)) return 0
  return (m.u32((pTables + 0xc30) >>> 0) + Math.imul(wMonProp, 0x138)) >>> 0
}

/**
 * Looks up `D2MonSeqTxt*` (`sgptDataTables + 0xBE0`, stride `0x1C`) via `MonStatsTxt.wAiId` (`+0x2A`).
 *
 * @va D2Game:0x6FC21C80 (65B)
 */
export function MONSEQ_GetRecordPtrFromClassId113c(m: Memory113c, nClassId: number): number {
  const id = nClassId | 0
  if (id < 0) return 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (id >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return 0
  const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(id, 0x1a8)) >>> 0
  if (pMonStats === 0) return 0
  const wSeq = sx16(m.u16((pMonStats + 0x2a) >>> 0))
  if (wSeq < 0) return 0
  return (m.u32((pTables + 0xbe0) >>> 0) + Math.imul(wSeq, 0x1c)) >>> 0
}

/**
 * Reads `pUnit->pPlayerData->dwField158` (`+0x158`) for player units (`dwUnitType == 0`).
 *
 * @va D2Game:0x6FC21D90 (26B)
 */
export function PLAYER_GetParam158_113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  if ((m.u32(pUnit) | 0) !== 0) return 0
  const pPlayerData = m.u32((pUnit + 0x14) >>> 0)
  if (pPlayerData === 0) return 0
  return m.u32((pPlayerData + 0x158) >>> 0) | 0
}

/**
 * Reads `pUnit->pPlayerData->dwField15C` (`+0x15C`) for player units (`dwUnitType == 0`).
 *
 * @va D2Game:0x6FC21DB0 (26B)
 */
export function PLAYER_GetParam15C_113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  if ((m.u32(pUnit) | 0) !== 0) return 0
  const pPlayerData = m.u32((pUnit + 0x14) >>> 0)
  if (pPlayerData === 0) return 0
  return m.u32((pPlayerData + 0x15c) >>> 0) | 0
}

/**
 * Rolls chest trap type (`0` or `[1..8]`) into `pUnit->pObjectData->bChestFlags` (`+0x04`)
 * using `pObjInit->pSeed` (`+0x0C`, pointing to `pGame->tSeed`).
 *
 * @va D2Game:0x6FC4EA40 (141B)
 */
export function OBJECTS_RollChestTrapType113c(m: Memory113c, pObjInit: number): void {
  const pRoom = m.u32((pObjInit + 0x08) >>> 0)
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId)
  const pSeed = m.u32((pObjInit + 0x0c) >>> 0)
  const roll = (stepSeed64Inline(m, pSeed) >>> 0) % 100
  const nMonLvl = sx16(m.u16((pLevelsTxt + 0x10) >>> 0))
  const bias = nMonLvl < 0 ? 7 : 0
  const threshold = ((((nMonLvl + bias) >> 3) + 5) & 0xffff) >>> 0
  let trapType = 0
  if (roll < threshold) {
    trapType = SEED_RollRangeHalfOpen113c(m, pSeed, 1, 9) & 0xff
  }
  const pUnit = m.u32((pObjInit + 0x04) >>> 0)
  const pObjData = m.u32((pUnit + 0x14) >>> 0)
  m.setU8((pObjData + 0x04) >>> 0, trapType)
}

/**
 * Initializes chest trap, lock bit (`0x80`), and chest drop `tSeed` (`3` `pGame->tSeed` rolls when lockable, `2` otherwise).
 *
 * @va D2Game:0x6FC4ECB0 (182B)
 */
export function OBJECTS_InitChestLockAndSeed113c(m: Memory113c, pObjInit: number): void {
  OBJECTS_RollChestTrapType113c(m, pObjInit)
  const pUnit = m.u32((pObjInit + 0x04) >>> 0)
  const pObjData = m.u32((pUnit + 0x14) >>> 0)
  let flags = m.u8((pObjData + 0x04) >>> 0)
  const pRoom = m.u32((pObjInit + 0x08) >>> 0)
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId)
  const pObjectsTxt = m.u32((pObjInit + 0x10) >>> 0)
  const pSeed = m.u32((pObjInit + 0x0c) >>> 0)
  if (m.u8((pObjectsTxt + 0x171) >>> 0) !== 0) {
    const lockRoll = (stepSeed64Inline(m, pSeed) >>> 0) % 100
    const nMonLvl = sx16(m.u16((pLevelsTxt + 0x10) >>> 0))
    const signBit = nMonLvl < 0 ? -1 : 0
    const lockChance = (((nMonLvl - signBit) >> 1) + 8) | 0
    if ((lockRoll | 0) < lockChance) {
      flags = (flags | 0x80) & 0xff
    } else {
      flags &= 0x7f
    }
  } else {
    flags &= 0x7f
  }
  const chestSeedRoll = (((stepSeed64Inline(m, pSeed) >>> 0) % 0xfffe) + 1) >>> 0
  SEED_InitLowSeed113c(m, (pUnit + 0x20) >>> 0, chestSeedRoll)
  const pUnitAfter = m.u32((pObjInit + 0x04) >>> 0)
  const pObjDataAfter = m.u32((pUnitAfter + 0x14) >>> 0)
  m.setU8((pObjDataAfter + 0x04) >>> 0, flags)
}

/**
 * Picks a shrine ID from `pGame->pObjectControl` (`+0x10F0`) group `1..4` (up to `8` level-requirement retries).
 * Note: `0x6FC4EE0E` calls `D2Common.#10834` (`DATATBLS_GetShrinesTxtRecord`), checking `dwLevelMin` at `+0xB4`?
 * Wait: `0x6FC2B2CA` is `D2Common.#10403` (`DATATBLS_GetObjGroupTxtRecord`) or `#10834`? Verified in step 316:
 * `0x6FC2B2CA` -> `D2Common.dll:#10403` (`DATATBLS_GetObjGroupTxtRecord113c`, whose `+0xB4` in `ShrinesTxt`? Wait:
 * `DATATBLS_GetObjGroupTxtRecord113c` IS `D2Common.#10403` in `datatbls-113c.ts`!).
 *
 * @va D2Game:0x6FC4ED70 (232B)
 */
export function OBJECTS_PickShrineIdFromControlGroup113c(
  m: Memory113c,
  nGroupIdx: number,
  pGame: number,
  nLevelId: number,
): number {
  let grp = nGroupIdx & 0xff
  if (grp === 0 || grp > 4) grp = 2
  const pObjCtrl = m.u32((pGame + 0x10f0) >>> 0)
  const count0 = m.u32((pObjCtrl + 8 + grp * 4) >>> 0) | 0
  if (count0 === 0) {
    throw new Error('OBJECTS_PickShrineIdFromControlGroup113c: empty shrine group (line 716)')
  }
  const pCtrlGroups = (pObjCtrl + 8) >>> 0
  let shrineId = 1
  for (let tries = 8; tries > 0; tries--) {
    const count = m.u32((pCtrlGroups + grp * 4) >>> 0) | 0
    const pCtrlSeed = m.u32((pGame + 0x10f0) >>> 0)
    const idx = count > 0 ? rollSeedModInline(m, pCtrlSeed, count) : 0
    const pArr = m.u32((pCtrlGroups + 0x20 + grp * 4) >>> 0)
    shrineId = m.u32((pArr + idx * 4) >>> 0) | 0
    if (shrineId === 0) shrineId = 1
    const pRec = DATATBLS_GetObjGroupTxtRecord113c(m, shrineId)
    if ((nLevelId >>> 0) >= (m.u32((pRec + 0xb4) >>> 0) >>> 0)) {
      break
    }
  }
  return shrineId
}

/**
 * Initializes shrine subtype (`pObjData + 0x04`) and attaches shrine record via `UNITS_SetObjectShrineTxt`.
 *
 * @va D2Game:0x6FC4EF90 (316B)
 */
export function OBJECTS_InitShrineType113c(m: Memory113c, pObjInit: number): void {
  const pRoom = m.u32((pObjInit + 0x08) >>> 0)
  const pObjectsTxt = m.u32((pObjInit + 0x10) >>> 0)
  const nParm0 = m.u32((pObjectsTxt + 0x178) >>> 0) | 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  let shrineId: number
  if (nParm0 === 0) {
    const lvl = DUNGEON_GetLevelIdFromRoom113c(m, m.u32((pObjInit + 0x08) >>> 0))
    shrineId = 1
    for (let tries = 8; tries > 0; tries--) {
      const nCount = (DATATBLS_GetObjGroupTxtRecordCount113c(m) - 1) | 0
      const pSeed = m.u32((pObjInit + 0x0c) >>> 0)
      const roll = nCount > 0 ? rollSeedModInline(m, pSeed, nCount) : 0
      shrineId = (roll + 1) | 0
      const pRec = DATATBLS_GetObjGroupTxtRecord113c(m, shrineId)
      if ((lvl >>> 0) >= (m.u32((pRec + 0xb4) >>> 0) >>> 0)) {
        break
      }
    }
  } else {
    let grp: number
    if (nParm0 === 1) {
      grp = 2
    } else if (nParm0 === 2) {
      grp = 3
    } else {
      const pSeed = m.u32((pObjInit + 0x0c) >>> 0)
      const mod10 = (stepSeed64Inline(m, pSeed) >>> 0) % 10
      grp = mod10 === 0 ? 1 : 4
    }
    shrineId = OBJECTS_PickShrineIdFromControlGroup113c(
      m,
      grp,
      m.u32(pObjInit),
      nLevelId,
    )
  }
  if (shrineId === 5) shrineId = 3
  else if (shrineId === 4) shrineId = 2
  else if (shrineId === 16) shrineId = 18

  const pUnit = m.u32((pObjInit + 0x04) >>> 0)
  const pObjData = m.u32((pUnit + 0x14) >>> 0)
  m.setU8((pObjData + 0x04) >>> 0, shrineId & 0xff)
  const pShrineRec = DATATBLS_GetObjGroupTxtRecord113c(m, shrineId)
  UNITS_SetObjectShrineTxt113c(m, m.u32((pObjInit + 0x04) >>> 0), pShrineRec)
}

/**
 * Spawns density-scaled random objects in `pRoom` using `pGame->pObjectControl` (`+0x10F0`) seed.
 *
 * @va D2Game:0x6FC52CE0 (268B)
 */
export function OBJECTS_SpawnDensityObjectsInRoom113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  nDensity: number,
  nObjectId: number,
  nProb: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  const densByte = nDensity & 0xff
  if (densByte > 0x80) {
    throw new Error('OBJECTS_SpawnDensityObjectsInRoom113c: nDensity > 128 (line 2148)')
  }
  const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjectId)
  const sizeX = m.u32((pObjectsTxt + 0xd0) >>> 0) | 0
  const sizeY = m.u32((pObjectsTxt + 0xd4) >>> 0) | 0

  const sp = regpopStackPtr
  regpopStackPtr = (sp + 32) >>> 0
  let pRoomW = 0
  let pRoomH = 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    pRoomW = m.u32((sp + 0x08) >>> 0) | 0
    pRoomH = m.u32((sp + 0x0c) >>> 0) | 0
  } finally {
    regpopStackPtr = sp
  }

  const pObjCtrl = m.u32((pGame + 0x10f0) >>> 0)
  const probRoll = (stepSeed64Inline(m, pObjCtrl) >>> 0) % 100
  if (probRoll > (nProb & 0xffff)) {
    return 0
  }

  const areaScaled = Math.imul(pRoomH, pRoomW) >> 7
  const count = Math.imul(areaScaled, densByte) >> 8
  let lastObj = 0
  for (let i = 0; i < count; i++) {
    lastObj =
      hooks !== undefined && hooks.onSpawnRandomObjectInRoom !== undefined
        ? hooks.onSpawnRandomObjectInRoom(m, sizeX, sizeY, nObjectId, pGame, 0, pRoom) >>> 0
        : 0
    if (lastObj !== 0) {
      const mode = m.u32((lastObj + 0x10) >>> 0) | 0
      const selectable = m.u8((pObjectsTxt + 0xc4 + mode) >>> 0)
      const curFlags = m.u32((lastObj + 0xc4) >>> 0)
      m.setU32(
        (lastObj + 0xc4) >>> 0,
        selectable !== 0 ? (curFlags | 2) >>> 0 : (curFlags & ~2) >>> 0,
      )
    }
  }
  return lastObj >>> 0
}

/**
 * Checks whether subtile `(x, y)` lies within `LevelsTxt.dwMonUMin` (`+0x0C`, squared safe radius, `289` = `17^2` in Blood Moor)
 * of a town-border exit tile or the level's waypoint preset object (`type=11`).
 *
 * @va D2Game:0x6FC66B20 (260B)
 */
export function REGPOP_IsNearTownExitOrWaypoint113c(
  m: Memory113c,
  pRoom: number,
  y: number,
  pGame: number,
  x: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  if (pRoom === 0) return 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  if (nLevelId === 0) return 0
  const pSubtypes = DUNGEON_GetRoomTileSubtypesPtr113c(m, pRoom)
  if (pSubtypes === 0) return 0
  const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId)
  const sqRadius = m.u32((pLevelsTxt + 0x0c) >>> 0) | 0
  const nBorderPts = m.u32((pSubtypes + 0x48) >>> 0) | 0
  const sx = x | 0
  const sy = y | 0
  for (let i = 0; i < nBorderPts; i++) {
    const bx = m.u32((pSubtypes + i * 4) >>> 0) | 0
    const by = m.u32((pSubtypes + 0x24 + i * 4) >>> 0) | 0
    const dx = (sx - bx) | 0
    const dy = (sy - by) | 0
    if (((Math.imul(dx, dx) + Math.imul(dy, dy)) | 0) < sqRadius) {
      return 1
    }
  }

  const sp = regpopStackPtr
  regpopStackPtr = (sp + 16) >>> 0
  try {
    const pTileX = sp
    const pTileY = (sp + 4) >>> 0
    m.setU32(pTileX, 0)
    m.setU32(pTileY, 0)
    const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
    const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0)
    if (hooks !== undefined && hooks.getActPresetTileCoords !== undefined) {
      hooks.getActPresetTileCoords(m, pAct, nLevelId, 11, pTileX, pTileY)
    } else if (pAct !== 0 && m.u32((pAct + 0x48) >>> 0) !== 0) {
      DUNGEON_FindLevelSpawnRoom113c(m, pAct, nLevelId, 11, pTileX, pTileY)
    }
    const tx = m.u32(pTileX) | 0
    const ty = m.u32(pTileY) | 0
    if (tx > 0 && ty > 0) {
      DUNGEON_GameTileToSubtileCoords113c(m, pTileX, pTileY)
      const wx = m.u32(pTileX) | 0
      const wy = m.u32(pTileY) | 0
      const dx = (sx - wx) | 0
      const dy = (sy - wy) | 0
      if (((Math.imul(dx, dx) + Math.imul(dy, dy)) | 0) < sqRadius) {
        return 1
      }
    }
    return 0
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Computes the inset `(x + 1, y + 1, w - 1, h - 1)` subtile spawn bounding box for `pCoordNode` (or `pRoom` if `pCoordNode == 0`).
 *
 * @va D2Game:0x6FC66C30 (146B)
 */
export function REGPOP_GetSpawnBoxSubtiles113c(
  m: Memory113c,
  pCoordNode: number,
  pRoom: number,
  pOutX: number,
  pOutY: number,
  pOutW: number,
  pOutH: number,
): void {
  const sp = regpopStackPtr
  regpopStackPtr = (sp + 32) >>> 0
  try {
    if (pCoordNode === 0) {
      DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
      const x = ((m.u32(sp) | 0) + 1) | 0
      const y = ((m.u32((sp + 4) >>> 0) | 0) + 1) | 0
      const w = ((m.u32((sp + 8) >>> 0) | 0) - 1) | 0
      const h = ((m.u32((sp + 12) >>> 0) | 0) - 1) | 0
      m.setU32(pOutX, x >>> 0)
      m.setU32(pOutY, y >>> 0)
      m.setU32(pOutW, w >>> 0)
      m.setU32(pOutH, h >>> 0)
      return
    }
    m.setU32(sp, m.u32((pCoordNode + 0x10) >>> 0))
    m.setU32((sp + 4) >>> 0, m.u32((pCoordNode + 0x14) >>> 0))
    m.setU32((sp + 8) >>> 0, m.u32((pCoordNode + 0x18) >>> 0))
    m.setU32((sp + 12) >>> 0, m.u32((pCoordNode + 0x1c) >>> 0))
    DUNGEON_GameTileToSubtileCoords113c(m, sp, (sp + 4) >>> 0)
    DUNGEON_GameTileToSubtileCoords113c(m, (sp + 8) >>> 0, (sp + 12) >>> 0)
    const left = ((m.u32(sp) | 0) + 1) | 0
    const top = ((m.u32((sp + 4) >>> 0) | 0) + 1) | 0
    const right = m.u32((sp + 8) >>> 0) | 0
    const bottom = m.u32((sp + 12) >>> 0) | 0
    m.setU32(pOutX, left >>> 0)
    m.setU32(pOutY, top >>> 0)
    m.setU32(pOutW, ((right - left) | 0) >>> 0)
    m.setU32(pOutH, ((bottom - top) | 0) >>> 0)
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Checks whether `pRoom` can be populated with monsters, incrementing `pMonReg->nVisitedRooms` (`+0x04`)
 * and lazily caching `pMonReg->nTotalRooms` (`+0x0C`).
 *
 * @va D2Game:0x6FC66CD0 (112B)
 */
export function REGPOP_CanPopulateRoom113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const pMonReg = m.u32((pGame + 0xf0 + nLevelId * 4) >>> 0)
  if (pMonReg === 0) return 0
  m.setU32((pMonReg + 0x04) >>> 0, ((m.u32((pMonReg + 0x04) >>> 0) | 0) + 1) >>> 0)
  const visLevelId = DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom)
  if (visLevelId === 0) return 0
  if ((m.u32((pMonReg + 0x0c) >>> 0) | 0) < 0) {
    const nAct = m.u8(pMonReg)
    const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0)
    const nRooms =
      hooks !== undefined && hooks.getLevelRoomCountInAct !== undefined
        ? hooks.getLevelRoomCountInAct(m, pAct, visLevelId) | 0
        : countRoomsInActLevelInline(m, pAct, visLevelId)
    m.setU32((pMonReg + 0x0c) >>> 0, nRooms >>> 0)
  }
  if ((m.u32((pMonReg + 0x2b8) >>> 0) | 0) === 0) return 0
  if ((m.u32((pMonReg + 0x0c) >>> 0) | 0) === 0) return 0
  if (DUNGEON_GetLevelIdFromRoom113c(m, pRoom) === 0x6c) {
    if (QUEST_Act4DiabloSealCheck113c(m, pGame) !== 0) return 0
  }
  return 1
}

/**
 * Returns `1` if `MonStatsTxt[nClassId].wBaseId` is `0x13` (`fallen1`) or `0x5B` (`fetisher1`), else `0`.
 *
 * @va D2Game:0x6FC66D40 (76B)
 */
export function REGPOP_UsesPartyBossGroup113c(m: Memory113c, nClassId: number): number {
  let id = nClassId | 0
  if (id < 0) return 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const nCount = m.u32((pTables + 0xa80) >>> 0) | 0
  if (id < nCount) {
    const pRec = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(id, 0x1a8)) >>> 0
    if (pRec !== 0) {
      id = sx16(m.u16((pRec + 2) >>> 0))
    }
  }
  if (id < 0) return 0
  const pTables2 = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (id >= (m.u32((pTables2 + 0xa80) >>> 0) | 0)) return 0
  return id === 0x13 || id === 0x5b ? 1 : 0
}

/**
 * Probes up to `20` random `(x, y)` coordinates in `pRoom->tSeed` (`+0x6C`) within `pCoordNode`'s box,
 * checking town/waypoint safe distance and `MONSTER_Create(..., wFlags = 1)`.
 *
 * @va D2Game:0x6FC67450 (528B)
 */
export function REGPOP_FindPackSpawnCoords113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
  pCoordNode: number,
  nClassId: number,
  pOutX: number,
  pOutY: number,
  bCheckSafeZone: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  const sp = regpopStackPtr
  regpopStackPtr = (sp + 0x60) >>> 0
  try {
    const pBoxX = sp
    const pBoxY = (sp + 4) >>> 0
    const pBoxW = (sp + 8) >>> 0
    const pBoxH = (sp + 12) >>> 0
    const pArgs = (sp + 16) >>> 0
    REGPOP_GetSpawnBoxSubtiles113c(m, pCoordNode, pRoom, pBoxX, pBoxY, pBoxW, pBoxH)
    const hasCoordNode = pCoordNode !== 0 ? 1 : 0
    const expectedIdx = pCoordNode !== 0 ? m.u32((pCoordNode + 0x28) >>> 0) | 0 : 0
    const pRoomSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0

    for (let attempt = 0; attempt < 20; attempt++) {
      const boxW = m.u32(pBoxW) | 0
      const dx = boxW > 0 ? rollSeedModInline(m, pRoomSeed, boxW) : 0
      const candX = ((m.u32(pBoxX) | 0) + dx) | 0

      const boxH = m.u32(pBoxH) | 0
      const dy = boxH > 0 ? rollSeedModInline(m, pRoomSeed, boxH) : 0
      const candY = ((m.u32(pBoxY) | 0) + dy) | 0

      if (bCheckSafeZone !== 0) {
        if (REGPOP_IsNearTownExitOrWaypoint113c(m, pRoom, candY, pGame, candX, hooks) !== 0) {
          continue
        }
      }

      if (hasCoordNode !== 0) {
        const idx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pRoom, candX, candY) | 0
        if (idx !== expectedIdx) continue
      }

      m.fill(pArgs, 0x28, 0)
      m.setU32(pArgs, pGame >>> 0)
      m.setU32((pArgs + 0x04) >>> 0, pRoom >>> 0)
      m.setU32((pArgs + 0x08) >>> 0, hasCoordNode !== 0 ? pCoordNode >>> 0 : 0)
      m.setU32((pArgs + 0x0c) >>> 0, nClassId >>> 0)
      m.setU32((pArgs + 0x10) >>> 0, 1)
      m.setU32((pArgs + 0x14) >>> 0, 0)
      m.setU32((pArgs + 0x18) >>> 0, candX >>> 0)
      m.setU32((pArgs + 0x1c) >>> 0, candY >>> 0)
      m.setU32((pArgs + 0x20) >>> 0, 0xffffffff)
      m.setU16((pArgs + 0x24) >>> 0, 1)

      if (invokeMonsterCreateHook(m, pArgs, hooks) !== 0) {
        m.setU32(pOutX, candX >>> 0)
        m.setU32(pOutY, candY >>> 0)
        return 1
      }
    }
    return 0
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Spawns a normal monster pack `[nMinCount..nMaxCount]` in `pRoom`:
 * finds pack coords (`0x6FC67450`), spawns leader (`0x6FD0F510`), rolls extra count from `leader->tSeed`,
 * and spawns extra pack members (`0x6FD0F570`).
 *
 * @va D2Game:0x6FC67700 (284B)
 */
export function REGPOP_SpawnMonsterPack113c(
  m: Memory113c,
  pRoom: number,
  nClassId: number,
  pGame: number,
  pCoordNode: number,
  nMinCount: number,
  nMaxCount: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  let minB = nMinCount & 0xff
  let maxB = nMaxCount & 0xff
  if (minB === 0 || maxB === 0 || maxB < minB) return 0

  const sp = regpopStackPtr
  regpopStackPtr = (sp + 16) >>> 0
  let spawnX = 0
  let spawnY = 0
  try {
    const pX = sp
    const pY = (sp + 4) >>> 0
    if (
      REGPOP_FindPackSpawnCoords113c(m, pRoom, pGame, pCoordNode, nClassId, pX, pY, 1, hooks) === 0
    ) {
      return 0
    }
    spawnX = m.u32(pX) | 0
    spawnY = m.u32(pY) | 0
  } finally {
    regpopStackPtr = sp
  }

  const pLeader = MONSTER_SpawnPackLeader113c(
    m,
    nClassId,
    pRoom,
    1,
    pGame,
    pCoordNode,
    spawnX,
    spawnY,
    -1,
    0,
    hooks,
  )
  if (pLeader === 0) return 0

  minB = (minB - 1) & 0xff
  maxB = (maxB - 1) & 0xff

  if (
    MONSTATS2_CheckFlagBit113c(m, nClassId, 0x12) !== 0 &&
    MONSTATS_ValidateClassId113c(m, nClassId) === 0x210
  ) {
    const lx = UNIT_GetPosX113c(m, pLeader)
    const ly = UNIT_GetPosY113c(m, pLeader)
    if (hooks !== undefined && hooks.onAllocUnitData !== undefined) {
      hooks.onAllocUnitData(m, 2, 0x232, lx, ly, pGame, pRoom, 1, 0, 0)
    }
  }

  const span = ((maxB - minB) + 1) | 0
  const extraCount = (minB + SEED_RollLimitedFast113c(m, (pLeader + 0x20) >>> 0, span)) | 0
  for (let i = 0; i < extraCount; i++) {
    MONSTER_SpawnPackMember113c(m, nClassId, pLeader, 1, pGame, pCoordNode, 3, 0, hooks)
  }
  return pLeader >>> 0
}

/**
 * Populates a newly activated wilderness/dungeon room (`pRoom`) with monster packs:
 * iterates `D2RoomCoordListStrc` nodes (`(subtileW / 3) * (subtileH / 3)` = `169` cells per `8x8`-tile Blood Moor room),
 * stepping `pGame->dwGameSeed` (`+0xD0`) mod `100000` against `pMonReg->dwMonDen` (`+0x2B8`).
 *
 * @va D2Game:0x6FC67A20 (711B)
 */
export function REGPOP_PopulateRoomMonsters113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  hooks?: RegpopSpawnHooks113c,
): void {
  if (REGPOP_CanPopulateRoom113c(m, pGame, pRoom, hooks) === 0) return
  let pCoord = DUNGEON_GetLogicalRoomField30_113c(m, pRoom)
  if (pCoord === 0) return

  const nLevelId = DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom)
  const pMonReg = m.u32((pGame + 0xf0 + nLevelId * 4) >>> 0)
  let monDen = m.u32((pMonReg + 0x2b8) >>> 0) | 0
  if (monDen > 10000) monDen = 10000
  m.setU32((pMonReg + 0x2b8) >>> 0, monDen >>> 0)

  let bSpawnedAny = 0
  const sp = regpopStackPtr
  regpopStackPtr = (sp + 32) >>> 0
  try {
    const pRect = sp
    const ppMonStatsTxt = (sp + 16) >>> 0

    while (pCoord !== 0) {
      if ((m.u32((pCoord + 0x28) >>> 0) | 0) !== 0 && (m.u32((pCoord + 0x20) >>> 0) | 0) === 0) {
        const left = m.u32((pCoord + 0x10) >>> 0) | 0
        const top = m.u32((pCoord + 0x14) >>> 0) | 0
        const right = m.u32((pCoord + 0x18) >>> 0) | 0
        const bottom = m.u32((pCoord + 0x1c) >>> 0) | 0
        if (left !== 0 || right !== 0) {
          m.setU32(pRect, left >>> 0)
          m.setU32((pRect + 4) >>> 0, top >>> 0)
          m.setU32((pRect + 8) >>> 0, right >>> 0)
          m.setU32((pRect + 12) >>> 0, bottom >>> 0)
          DUNGEON_GameTileToSubtileCoords113c(m, pRect, (pRect + 4) >>> 0)
          DUNGEON_GameTileToSubtileCoords113c(m, (pRect + 8) >>> 0, (pRect + 12) >>> 0)
          const subW = ((m.u32((pRect + 8) >>> 0) | 0) - (m.u32(pRect) | 0)) | 0
          const subH = ((m.u32((pRect + 12) >>> 0) | 0) - (m.u32((pRect + 4) >>> 0) | 0)) | 0
          const cellsY = Math.trunc(subH / 3) | 0
          const cellsX = Math.trunc(subW / 3) | 0
          let nCells = Math.imul(cellsY, cellsX) | 0

          while (nCells > 0) {
            const denRoll = (stepSeed64Inline(m, (pGame + 0xd0) >>> 0) >>> 0) % 100000
            if ((denRoll | 0) <= (m.u32((pMonReg + 0x2b8) >>> 0) | 0)) {
              m.setU32(ppMonStatsTxt, 0)
              const nClassId = MONSTER_ChooseMonsterClass113c(
                m,
                0,
                pRoom,
                pMonReg,
                pGame,
                ppMonStatsTxt,
                20,
              )
              const pMonStatsTxt = m.u32(ppMonStatsTxt) >>> 0
              if (pMonStatsTxt === 0) return

              let rarity = MONSTER_RollPackRarityType113c(m, pMonReg, pRoom)
              if (rarity === 1) rarity = 2

              // 0x6FC67B9D sub eax, 0; je 0x6FC67C79 (0 -> champion/unique), dec eax; je 0x6FC67C38
              // (1 -> chest/gargoyle; unreachable after the 1 -> 2 remap), else 0x6FC67BAD normal pack.
              let spawned = 0
              if (rarity === 0) {
                const champClassId = MONSTER_ChooseMonsterClass113c(
                  m,
                  1,
                  pRoom,
                  pMonReg,
                  pGame,
                  ppMonStatsTxt,
                  0,
                )
                spawned =
                  hooks !== undefined && hooks.onSpawnChampionOrUniquePack !== undefined
                    ? hooks.onSpawnChampionOrUniquePack(m, rarity, pRoom, pGame, champClassId)
                    : 0
              } else if (rarity === 1) {
                const pRoomSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0
                stepSeed64Inline(m, pRoomSeed)
                const pDesc = m.u32(D2GAME_CHEST_GARGOYLE_PTRS_VA_113C)
                spawned =
                  hooks !== undefined && hooks.onSpawnChestOrGargoylePack !== undefined
                    ? hooks.onSpawnChestOrGargoylePack(m, pRoom, pDesc, nClassId, pGame)
                    : 0
              } else {
                let minGrp = 1
                let maxGrp = 1
                if (REGPOP_UsesPartyBossGroup113c(m, nClassId) === 0) {
                  minGrp = m.u8((pMonStatsTxt + 0x2f) >>> 0)
                  maxGrp = m.u8((pMonStatsTxt + 0x30) >>> 0)
                }
                const sparsePct = m.u8((pMonStatsTxt + 0x31) >>> 0)
                let passSparse = true
                if (sparsePct !== 0) {
                  const sRoll = (stepSeed64Inline(m, (pGame + 0xd0) >>> 0) >>> 0) % 100
                  if ((sRoll | 0) > sparsePct) passSparse = false
                }
                if (passSparse) {
                  spawned = REGPOP_SpawnMonsterPack113c(
                    m,
                    pRoom,
                    nClassId,
                    pGame,
                    pCoord,
                    minGrp,
                    maxGrp,
                    hooks,
                  )
                }
              }

              if (spawned !== 0) {
                bSpawnedAny = 1
              }
            }
            nCells = (nCells - 1) | 0
          }
        }
      }
      pCoord = m.u32((pCoord + 0x2c) >>> 0)
    }

    if (bSpawnedAny !== 0) {
      m.setU32((pMonReg + 0x08) >>> 0, ((m.u32((pMonReg + 0x08) >>> 0) | 0) + 1) >>> 0)
    }
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Reads `pUnit->pMonsterData->dwField34` (`+0x34`) for monster units (`dwUnitType == 1`).
 *
 * @va D2Game:0x6FC68560 (25B)
 */
export function MONSTER_GetBossMinionField34_113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  if ((m.u32(pUnit) | 0) !== 1) return 0
  const pMonsterData = m.u32((pUnit + 0x14) >>> 0)
  if (pMonsterData === 0) return 0
  return m.u32((pMonsterData + 0x34) >>> 0) | 0
}

/**
 * Returns the multiplayer monster HP bonus percentage (`0, 0, 50, 100, ...`) for `nPlayers`.
 *
 * @va D2Game:0x6FCCF5D0 (23B)
 */
export function MONSTER_GetPlayerCountHpBonusPct113c(m: Memory113c, nPlayers: number): number {
  const n = nPlayers | 0
  if (n < 9) {
    return m.u32((D2GAME_PLAYER_HP_BONUS_TABLE_VA_113C + n * 4) >>> 0) | 0
  }
  return ((Math.imul(n, 5) + 0x82) << 1) | 0
}

/**
 * Returns the multiplayer monster EXP bonus percentage (`0, 0, 50, 100, ...`) for `nPlayers`.
 *
 * @va D2Game:0x6FCCF5F0 (20B)
 */
export function MONSTER_GetPlayerCountExpBonusPct113c(m: Memory113c, nPlayers: number): number {
  const n = nPlayers | 0
  if (n < 9) {
    return m.u32((D2GAME_PLAYER_EXP_BONUS_TABLE_VA_113C + n * 4) >>> 0) | 0
  }
  return Math.imul((n - 2) | 0, 50) | 0
}

/**
 * Selects or rolls the `16`-byte component outfit array (`pMonsterData->bComponents`, `+0x04..+0x13`)
 * using `pUnit->tSeed` (`+0x20`).
 *
 * @va D2Game:0x6FCCF730 (259B)
 */
export function MONSTER_ChooseOutfit113c(
  m: Memory113c,
  pUnit: number,
  pActOutfit: number,
): void {
  if (pUnit === 0) return
  if ((m.u32(pUnit) | 0) !== 1) return

  if (pActOutfit !== 0) {
    const nVariants = m.u8((pActOutfit + 0x03) >>> 0)
    if (nVariants > 0) {
      const idx = SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, nVariants)
      const pSrc = (pActOutfit + 0x04 + (idx << 4)) >>> 0
      if ((m.u32(pUnit) | 0) !== 1) return
      const pMonsterData = m.u32((pUnit + 0x14) >>> 0)
      if (pMonsterData === 0) return
      const pDst = (pMonsterData + 0x04) >>> 0
      if (pDst === 0) return
      m.setU32(pDst, m.u32(pSrc))
      m.setU32((pDst + 4) >>> 0, m.u32((pSrc + 4) >>> 0))
      m.setU32((pDst + 8) >>> 0, m.u32((pSrc + 8) >>> 0))
      m.setU32((pDst + 12) >>> 0, m.u32((pSrc + 12) >>> 0))
      return
    }
  }

  const pMonsterData = m.u32((pUnit + 0x14) >>> 0)
  const pDst = pMonsterData !== 0 ? (pMonsterData + 0x04) >>> 0 : 0
  for (let comp = 0; comp < 16; comp++) {
    const nChoices = UNITS_GetMonStats2ComponentChoice113c(m, pUnit, comp) | 0
    const choice = nChoices > 0 ? rollSeedModInline(m, (pUnit + 0x20) >>> 0, nChoices) : 0
    m.setU8((pDst + comp) >>> 0, choice & 0xff)
  }
}

/**
 * Purges existing `EVENT_AI` (`type == 2`) timer nodes on `pUnit` and schedules an initial
 * `EVENT_AI` at `pGame->dwGameFrame + 2` when `dwAnimMode == 1` (`NU`) or special baseIds `{110, 118, 136, 247}`.
 *
 * @va D2Game:0x6FCCF920 (241B)
 */
export function MONSTER_ScheduleInitialAiEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  if (pUnit === 0) return

  let pEv = m.u32((pUnit + 0xdc) >>> 0)
  while (pEv !== 0) {
    const pNext = m.u32((pEv + 0x24) >>> 0)
    if (m.u8(pEv) === 2) {
      EVENT_FreeNode113c(m, pGame, pEv)
    }
    pEv = pNext
  }

  const nMode = m.u32((pUnit + 0x10) >>> 0) | 0
  if (nMode === 1) {
    let pEv2 = m.u32((pUnit + 0xdc) >>> 0)
    while (pEv2 !== 0) {
      const pNext = m.u32((pEv2 + 0x24) >>> 0)
      if (m.u8(pEv2) === 2) {
        EVENT_FreeNode113c(m, pGame, pEv2)
      }
      pEv2 = pNext
    }
    const targetFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 2) >>> 0
    EVENT_SetEventFull113c(m, pGame, pUnit, 2, targetFrame, 0, 0, 0)
  } else if (nMode === 0x0c || nMode === 0) {
    return
  }

  let baseId = MONSTER_GetBaseIdFromUnit113c(m, pUnit)
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (baseId < 0 || baseId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) {
    baseId = -1
  }
  if (baseId === 110 || baseId === 118 || baseId === 136 || baseId === 247) {
    let pEv3 = m.u32((pUnit + 0xdc) >>> 0)
    while (pEv3 !== 0) {
      const pNext = m.u32((pEv3 + 0x24) >>> 0)
      if (m.u8(pEv3) === 2) {
        EVENT_FreeNode113c(m, pGame, pEv3)
      }
      pEv3 = pNext
    }
    const targetFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 2) >>> 0
    EVENT_SetEventFull113c(m, pGame, pUnit, 2, targetFrame, 0, 0, 0)
  }
}

/**
 * Checks whether Act 4 Chaos Sanctuary Diablo seals (`questId == 0x17`, `pQuestState + 0x13`) have cleared the sanctuary.
 *
 * @va D2Game:0x6FCD8940 (42B)
 */
export function QUEST_Act4DiabloSealCheck113c(m: Memory113c, pGame: number): number {
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0)
  if (pQuestCtrl === 0) return 0
  let pNode = m.u32(pQuestCtrl)
  while (pNode !== 0) {
    if ((m.u32(pNode) | 0) === 0x17) {
      const pData = m.u32((pNode + 0x18) >>> 0)
      return m.u8((pData + 0x13) >>> 0)
    }
    pNode = m.u32((pNode + 0xf4) >>> 0)
  }
  return 0
}

/**
 * Updates `pMonReg->dwActiveMonCount` (`+0x2CC`) when a monster enters or leaves death/revive mode.
 *
 * @va D2Game:0x6FCEA530 (123B)
 */
export function MONREG_UpdateActiveCountOnMode113c(
  m: Memory113c,
  pUnit: number,
  nOldMode: number,
  nNewMode: number,
  ppMonRegTable: number,
): void {
  if (pUnit === 0) return
  if ((m.u32(pUnit) | 0) !== 1) return
  if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) return
  const pMonsterData = m.u32((pUnit + 0x14) >>> 0)
  if (pMonsterData !== 0 && (m.u8((pMonsterData + 0x5c) >>> 0) & 2) !== 0) {
    return
  }
  const nLevelId = pMonsterData !== 0 ? m.u32((pMonsterData + 0x58) >>> 0) | 0 : 0
  const pMonReg = m.u32((ppMonRegTable + nLevelId * 4) >>> 0)
  if (pMonReg === 0) return
  if (m.u8((pMonReg + 0x2d8) >>> 0) !== 0) return
  const oldM = nOldMode | 0
  const newM = nNewMode | 0
  if (oldM === newM) return
  if (oldM === 0 && (newM === 1 || newM === 2)) {
    m.setU32((pMonReg + 0x2cc) >>> 0, ((m.u32((pMonReg + 0x2cc) >>> 0) | 0) - 1) >>> 0)
  }
  if (newM === 0 && oldM !== 4) {
    m.setU32((pMonReg + 0x2cc) >>> 0, ((m.u32((pMonReg + 0x2cc) >>> 0) | 0) + 1) >>> 0)
  }
}

/**
 * Marks `pMonsterData + 0x5C |= 2` if `bSkipCount != 0`, else increments `pMonReg->dwActiveMonCount` (`+0x2CC`).
 *
 * @va D2Game:0x6FCEA5B0 (53B)
 */
export function MONREG_IncrementSpawnCount113c(
  m: Memory113c,
  pUnit: number,
  bSkipCount: number,
  ppMonRegTable: number,
  pRoom: number,
): void {
  if (bSkipCount !== 0) {
    if (pUnit === 0) return
    if ((m.u32(pUnit) | 0) !== 1) return
    const pMonsterData = m.u32((pUnit + 0x14) >>> 0)
    if (pMonsterData === 0) return
    m.setU8((pMonsterData + 0x5c) >>> 0, (m.u8((pMonsterData + 0x5c) >>> 0) | 2) & 0xff)
    return
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const pMonReg = m.u32((ppMonRegTable + nLevelId * 4) >>> 0)
  m.setU32((pMonReg + 0x2cc) >>> 0, ((m.u32((pMonReg + 0x2cc) >>> 0) | 0) + 1) >>> 0)
}

/**
 * Looks up or creates the `0x34`-byte outfit cache entry in `pMonReg` (`+0x14 + idx * 0x34`, max `13`)
 * for `pUnit->dwClassId`, generating up to `3` distinct outfit variants via `MONREG_GenerateOutfitVariants113c`.
 *
 * @va D2Game:0x6FCEA5F0 (256B)
 */
export function MONREG_GetOrCreateActOutfit113c(
  m: Memory113c,
  ppMonRegTable: number,
  pRoom: number,
  pUnit: number,
): number {
  const rawClassId = pUnit !== 0 ? m.u32((pUnit + 0x04) >>> 0) : 0xffffffff
  const wClass = sx16(rawClassId & 0xffff)
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const nMonStatsCount = m.u32((pTables + 0xa80) >>> 0) | 0
  const validClass = wClass >= 0 && wClass < nMonStatsCount ? wClass : -1
  if (validClass === 195 || validClass === 196 || validClass === 294 || validClass === 296) {
    return 0
  }

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const pMonReg = m.u32((ppMonRegTable + nLevelId * 4) >>> 0)
  if (pMonReg === 0) return 0

  const bCount = m.u8((pMonReg + 0x12) >>> 0)
  let pEntry = (pMonReg + 0x14) >>> 0
  let i = 0
  if (bCount > 0) {
    while (i < m.u8((pMonReg + 0x12) >>> 0)) {
      if (sx16(m.u16(pEntry)) === wClass) {
        return pEntry >>> 0
      }
      pEntry = (pEntry + 0x34) >>> 0
      i++
    }
    if (i >= 13) return 0
  }

  if (wClass >= 0 && wClass < nMonStatsCount) {
    const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(wClass, 0x1a8)) >>> 0
    const statsEx = sx16(m.u16((pMonStats + 0x18) >>> 0))
    if (statsEx >= 0 && statsEx < (m.u32((pTables + 0xa98) >>> 0) | 0)) {
      const pMonStats2 = (m.u32((pTables + 0xa90) >>> 0) + Math.imul(statsEx, 0x134)) >>> 0
      if (pMonStats2 !== 0 && m.u8((pMonStats2 + 0xec) >>> 0) > 2) {
        m.setU16(pEntry, rawClassId & 0xffff)
        m.setU8((pMonReg + 0x12) >>> 0, (m.u8((pMonReg + 0x12) >>> 0) + 1) & 0xff)
        MONREG_GenerateOutfitVariants113c(m, (pUnit + 0x20) >>> 0, pEntry, 3)
      }
    }
  }
  return pEntry >>> 0
}

/**
 * Rolls monster pack rarity (`0` = boss quota hit -> champion/unique pack, `1` / `2` = `lo % 100 <= 35` / `> 35`;
 * the caller `0x6FC67A20` remaps `1 -> 2`, i.e. a normal pack)
 * using `pRoom->tSeed` (`+0x6C`) and `pMonReg` boss quotas (`+0x2BC`, `+0x2BD`, `+0x2C8`).
 *
 * @va D2Game:0x6FCFF080 (237B)
 */
export function MONSTER_RollPackRarityType113c(
  m: Memory113c,
  pMonReg: number,
  pRoom: number,
): number {
  const uMax = m.u8((pMonReg + 0x2bd) >>> 0)
  const uMin = m.u8((pMonReg + 0x2bc) >>> 0)
  const spawned = m.u8((pMonReg + 0x2c8) >>> 0)
  const pRoomSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0

  if (spawned < uMin) {
    const totalRooms = m.u32((pMonReg + 0x0c) >>> 0) | 0
    if (totalRooms !== 0) {
      const visited = m.u32((pMonReg + 0x04) >>> 0) | 0
      const roll100 = (stepSeed64Inline(m, pRoomSeed) >>> 0) % 100
      const quotaPct = Math.trunc(Math.imul(visited, 100) / totalRooms) | 0
      if ((roll100 | 0) < quotaPct) {
        return 0
      }
    }
  }

  if (spawned < uMax) {
    const extraRoll = (stepSeed64Inline(m, pRoomSeed) >>> 0) % 100
    if ((extraRoll | 0) <= 5) {
      return 0
    }
  }

  const typeRoll = (stepSeed64Inline(m, pRoomSeed) >>> 0) % 100
  return (typeRoll | 0) > 35 ? 2 : 1
}

/**
 * Generates up to `nMaxVariants` (`<= 3` total) distinct `16`-byte component outfit records in `pOutfitEntry` (`+0x04`).
 *
 * @va D2Game:0x6FCFF1A0 (764B)
 */
export function MONREG_GenerateOutfitVariants113c(
  m: Memory113c,
  pSeed: number,
  pOutfitEntry: number,
  nMaxVariants: number,
): void {
  if (pSeed === 0) {
    throw new Error('MONREG_GenerateOutfitVariants113c: pSeed == NULL (line 160)')
  }
  if (pOutfitEntry === 0) {
    throw new Error('MONREG_GenerateOutfitVariants113c: pOutfitEntry == NULL (line 161)')
  }
  const wClass = sx16(m.u16(pOutfitEntry))
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, wClass)
  if (pMonStats2 === 0) return

  const shiftCount = m.u8((pMonStats2 + 0x25) >>> 0) & 31
  const curCount = m.u8((pOutfitEntry + 0x03) >>> 0)
  const maxCombos = ((1 << shiftCount) - curCount) | 0
  let toGen = nMaxVariants | 0
  if (toGen > maxCombos) toGen = maxCombos
  if (toGen <= 0) return
  if (((toGen + curCount) | 0) > 3) {
    toGen = (3 - curCount) | 0
  }
  if (toGen <= 0) return

  const pCompCounts = (pMonStats2 + 0x15) >>> 0
  let pWrite = (pOutfitEntry + 0x04 + (curCount << 4)) >>> 0

  if (curCount === 0) {
    const pFirst = (pOutfitEntry + 0x04) >>> 0
    for (let c = 0; c < 16; c++) {
      const cnt = m.u8((pCompCounts + c) >>> 0)
      if (cnt <= 1) {
        m.setU8((pFirst + c) >>> 0, 0)
      } else {
        const val = SEED_RollLimitedFast113c(m, pSeed, cnt) & 0xff
        m.setU8((pFirst + c) >>> 0, val)
      }
    }
    m.setU8((pOutfitEntry + 0x03) >>> 0, (m.u8((pOutfitEntry + 0x03) >>> 0) + 1) & 0xff)
    toGen = (toGen - 1) | 0
    pWrite = (pWrite + 0x10) >>> 0
  }

  if (toGen === 0) return

  const multiComps = new Uint8Array(16)
  let nMulti = 0
  for (let c = 0; c < 16; c++) {
    if (m.u8((pCompCounts + c) >>> 0) > 1) {
      multiComps[nMulti++] = c
    }
  }
  if (nMulti <= 0) return

  let compA: number
  let compB: number
  if (nMulti === 1) {
    compA = multiComps[0]!
    compB = compA
  } else {
    const idxA = SEED_RollLimitedFast113c(m, pSeed, nMulti)
    compA = multiComps[idxA]!
    multiComps[idxA] = multiComps[nMulti - 1]!
    nMulti--
    const idxB = SEED_RollLimitedFast113c(m, pSeed, nMulti)
    compB = multiComps[idxB]!
  }

  if (toGen <= 0) return

  const pBaseOutfit = (pOutfitEntry + 0x04) >>> 0
  for (let rem = toGen; rem > 0; rem--) {
    m.setU32(pWrite, m.u32(pBaseOutfit))
    m.setU32((pWrite + 4) >>> 0, m.u32((pBaseOutfit + 4) >>> 0))
    m.setU32((pWrite + 8) >>> 0, m.u32((pBaseOutfit + 8) >>> 0))
    m.setU32((pWrite + 12) >>> 0, m.u32((pBaseOutfit + 12) >>> 0))

    let retries = 3
    while (true) {
      const cntA = m.u8((pCompCounts + compA) >>> 0)
      const valA = cntA > 0 ? rollSeedModInline(m, pSeed, cntA) : 0
      m.setU8((pWrite + compA) >>> 0, valA & 0xff)

      if (compA !== compB) {
        const cntB = m.u8((pCompCounts + compB) >>> 0)
        const valB = cntB > 0 ? rollSeedModInline(m, pSeed, cntB) : 0
        m.setU8((pWrite + compB) >>> 0, valB & 0xff)
      }

      const existing = m.u8((pOutfitEntry + 0x03) >>> 0)
      let isDup = false
      for (let e = 0; e < existing; e++) {
        const pPrev = (pOutfitEntry + 0x04 + e * 16) >>> 0
        if (
          m.u32(pWrite) === m.u32(pPrev) &&
          m.u32((pWrite + 4) >>> 0) === m.u32((pPrev + 4) >>> 0) &&
          m.u32((pWrite + 8) >>> 0) === m.u32((pPrev + 8) >>> 0) &&
          m.u32((pWrite + 12) >>> 0) === m.u32((pPrev + 12) >>> 0)
        ) {
          retries--
          isDup = true
        }
      }
      if (!isDup || retries === 0) break
    }

    m.setU8((pOutfitEntry + 0x03) >>> 0, (m.u8((pOutfitEntry + 0x03) >>> 0) + 1) & 0xff)
    pWrite = (pWrite + 0x10) >>> 0
  }
}

/**
 * Selects a monster `classId` from `pMonReg`'s weighted spawn table (or `LevelsTxt.wUmon` in Normal champion/unique branch)
 * using `pRoom->tSeed` (`+0x6C`), writing the resolved `D2MonStatsTxt*` to `*ppOutMonStatsTxt`.
 *
 * @va D2Game:0x6FCFF4A0 (343B)
 */
export function MONSTER_ChooseMonsterClass113c(
  m: Memory113c,
  bChampionOrUnique: number,
  pRoom: number,
  pMonReg: number,
  pGame: number,
  ppOutMonStatsTxt: number,
  nSuperPct: number,
): number {
  const pRoomSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0

  if (bChampionOrUnique !== 0 && m.u8((pGame + 0x6d) >>> 0) === 0) {
    const nLevelId = m.u32((pMonReg + 0x2c0) >>> 0) | 0
    const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId)
    const nUMon = m.u8((pLevelsTxt + 0x35) >>> 0)
    if (nUMon === 0) {
      m.setU32(ppOutMonStatsTxt, 0)
      return 0
    }
    const idx = SEED_RollLimitedFast113c(m, pRoomSeed, nUMon)
    const classId = sx16(m.u16((pLevelsTxt + 0x9a + idx * 2) >>> 0))
    const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
    if (classId < 0 || classId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) {
      m.setU32(ppOutMonStatsTxt, 0)
      return classId
    }
    const pRec = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(classId, 0x1a8)) >>> 0
    m.setU32(ppOutMonStatsTxt, pRec)
    return classId
  }

  const bMonCount = m.u8((pMonReg + 0x10) >>> 0)
  if (bMonCount === 0) {
    m.setU32(ppOutMonStatsTxt, 0)
    return 0
  }

  const bTotalRarity = m.u8((pMonReg + 0x11) >>> 0)
  let pick = (SEED_RollLimitedFast113c(m, pRoomSeed, bTotalRarity) + 1) | 0
  let pEntry = (pMonReg + 0x14) >>> 0
  for (let i = 0; i < bMonCount; i++) {
    const r = m.u8((pEntry + 2) >>> 0)
    pick = (pick - r) | 0
    if (pick <= 0) break
    pEntry = (pEntry + 0x34) >>> 0
  }

  let chosenId = sx16(m.u16(pEntry))
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const nMonStatsCount = m.u32((pTables + 0xa80) >>> 0) | 0
  if (chosenId >= 0 && chosenId < nMonStatsCount) {
    const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(chosenId, 0x1a8)) >>> 0
    if (pMonStats !== 0) {
      const wNextInClass = sx16(m.u16((pMonStats + 0x20) >>> 0))
      if (wNextInClass >= 0) {
        const bFlags3 = m.u8((pMonStats + 0x0e) >>> 0)
        const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
        if ((bFlags3 & m.u8((pMasks + 0x1c) >>> 0)) !== 0) {
          const superRoll = (stepSeed64Inline(m, pRoomSeed) >>> 0) % 100
          if ((superRoll | 0) > (nSuperPct & 0xff)) {
            chosenId = wNextInClass
          }
        }
      }
    }
  }

  if (chosenId < 0 || chosenId >= nMonStatsCount) {
    m.setU32(ppOutMonStatsTxt, 0)
    return chosenId
  }
  const pFinal = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(chosenId, 0x1a8)) >>> 0
  m.setU32(ppOutMonStatsTxt, pFinal)
  return chosenId
}

/**
 * Initializes animation sequence / `AnimData.d2` frame count (`+0x48 = dwFrames << 8`) on `pUnit`.
 *
 * @va D2Game:0x6FCFFF10 (186B)
 */
export function SUNIT_InitUnitAnimData113c(m: Memory113c, pUnit: number): void {
  if (pUnit === 0) {
    throw new Error('SUNIT_InitUnitAnimData113c: pUnit == NULL (line 1378)')
  }
  const dwType = m.u32(pUnit) | 0
  m.setU8((pUnit + 0x4e) >>> 0, 0)
  const dwMode = m.u32((pUnit + 0x10) >>> 0) | 0
  const isPlayerSeq = dwType === 0 && dwMode === 0x12
  const isMonsterSeq = dwType === 1 && dwMode === 0x0e
  if (isMonsterSeq || isPlayerSeq) {
    if (ANIMSEQ_GetUnitSeqRecordPtr113c(m, pUnit) !== 0) {
      UNITS_InitSkillAnimSequence113c(m, pUnit)
      UNITS_SetUnitAnimMode113c(m, pUnit)
      return
    }
  }
  const pPath = m.u32((pUnit + 0x2c) >>> 0)
  m.setU32((pUnit + 0x30) >>> 0, 0)
  m.setU32((pUnit + 0x44) >>> 0, 0)
  if (pPath !== 0) {
    UNITS_SetUnitAnimMode113c(m, pUnit)
  } else {
    UNITS_GetAnimDataRecord113c(
      m,
      pUnit,
      m.u32(pUnit) | 0,
      m.u32((pUnit + 0x04) >>> 0) | 0,
      m.u32((pUnit + 0x10) >>> 0) | 0,
    )
  }
  const pAnimData = m.u32((pUnit + 0x50) >>> 0)
  if (pAnimData !== 0) {
    m.setU32((pUnit + 0x48) >>> 0, (m.u32((pAnimData + 0x08) >>> 0) << 8) >>> 0)
  }
}

/**
 * Initializes `pItem->pItemData` owner GUID and secondary item seed (`+1` `pGameSeed` step after `SUNIT_InitUnitSeed113c`).
 *
 * @va D2Game:0x6FD000C0 (65B)
 */
export function SUNIT_InitExtraItemSeed113c(
  m: Memory113c,
  pGameSeed: number,
  pItem: number,
): void {
  ITEMS_InitItemSeed113c(m, pItem)
  const guid = stepSeed64Inline(m, pGameSeed)
  ITEMS_SetOwnerGuid113c(m, pItem, guid)
  const ownerGuid = ITEMS_GetOwnerGuid113c(m, pItem)
  const pItemSeed = ITEMS_GetItemSeed113c(m, pItem)
  SEED_InitLowSeed113c(m, pItemSeed, ownerGuid)
}

/**
 * Initializes `pUnit->tSeed` (`+0x20`, `hi = 666`) and `pUnit->dwInitSeed` (`+0x28`):
 * when `pGameSeed != 0`, steps `pGameSeed` once (`0x6AC690C5`) and seeds `pUnit->tSeed` via `SEED_InitLowSeed`;
 * when `pGameSeed == 0`, increments global counter `0x6FD31C50` and calls `SEED_GenerateLoopSeed(2 * counter)`.
 *
 * @va D2Game:0x6FD00110 (120B)
 */
export function SUNIT_InitUnitSeed113c(m: Memory113c, pUnit: number, pGameSeed: number): void {
  if (pUnit === 0) {
    throw new Error('SUNIT_InitUnitSeed113c: pUnit == NULL (line 416)')
  }
  const pUnitSeed = (pUnit + 0x20) >>> 0
  SEED_InitSeed113c(m, pUnitSeed)
  if (pGameSeed !== 0) {
    const initSeed = stepSeed64Inline(m, pGameSeed)
    m.setU32((pUnit + 0x28) >>> 0, initSeed)
    SEED_InitLowSeed113c(m, pUnitSeed, initSeed)
    return
  }
  const cnt = m.u32(D2GAME_GLOBAL_SEED_COUNTER_VA_113C) >>> 0
  m.setU32(D2GAME_GLOBAL_SEED_COUNTER_VA_113C, (cnt + 1) >>> 0)
  const loopSeed = SEED_GenerateLoopSeed113c(m, (cnt << 1) >>> 0)
  m.setU32((pUnit + 0x28) >>> 0, loopSeed >>> 0)
  SEED_InitLowSeed113c(m, pUnitSeed, loopSeed >>> 0)
}

/**
 * Validates that `pUnit->pDynamicPath`'s target unit still exists in `pGame` (and is not a picked-up/equipped item),
 * clearing `PATH_SetTargetUnit(pPath, NULL)` if stale.
 *
 * @va D2Game:0x6FD007A0 (188B)
 */
export function SUNIT_ValidatePathTargetUnit113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): void {
  if (pUnit === 0) {
    throw new Error('SUNIT_ValidatePathTargetUnit113c: pUnit == NULL (line 1793)')
  }
  if (pGame === 0) {
    throw new Error('SUNIT_ValidatePathTargetUnit113c: pGame == NULL (line 1794)')
  }
  const pPath = m.u32((pUnit + 0x2c) >>> 0)
  if (pPath === 0) {
    throw new Error('SUNIT_ValidatePathTargetUnit113c: pDynamicPath == NULL (line 1797)')
  }
  if (PATH_GetTargetUnit113c(m, pPath) === 0) return

  const sp = regpopStackPtr
  regpopStackPtr = (sp + 16) >>> 0
  let targetType = 0
  let targetId = 0
  try {
    PATH_GetTargetTypeAndId113c(m, pPath, (sp + 4) >>> 0, sp)
    targetId = m.u32(sp) | 0
    targetType = m.u32((sp + 4) >>> 0) | 0
  } finally {
    regpopStackPtr = sp
  }

  const pResolved = SUNIT_GetServerUnit113c(m, pGame, targetType, targetId)
  if (pResolved !== PATH_GetTargetUnit113c(m, pPath)) {
    PATH_SetTargetUnit113c(m, pPath, 0)
  }
  if (pResolved !== 0 && (m.u32(pResolved) | 0) === 4) {
    const itemMode = m.u32((pResolved + 0x10) >>> 0) | 0
    if (itemMode === 2 || itemMode === 1) {
      PATH_SetTargetUnit113c(m, pPath, 0)
    }
  }
}

/**
 * Spawns a party minion around `pLeader`'s room & coordinates via `MONSTER_Create`.
 *
 * @va D2Game:0x6FD0DDB0 (210B)
 */
export function MONSTER_SpawnPartyMinionInRing113c(
  m: Memory113c,
  nClassId: number,
  pLeader: number,
  nMode: number,
  pGame: number,
  nMaxRadius: number,
  wFlags: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  const sp = regpopStackPtr
  regpopStackPtr = (sp + 0x30) >>> 0
  try {
    const pRoom = UNITS_GetRoom113c(m, pLeader)
    const lx = UNIT_GetPosX113c(m, pLeader)
    const ly = UNIT_GetPosY113c(m, pLeader)
    m.fill(sp, 0x28, 0)
    m.setU32(sp, pGame >>> 0)
    m.setU32((sp + 0x04) >>> 0, pRoom >>> 0)
    m.setU32((sp + 0x08) >>> 0, 0)
    m.setU32((sp + 0x0c) >>> 0, nClassId >>> 0)
    m.setU32((sp + 0x10) >>> 0, nMode >>> 0)
    m.setU32((sp + 0x14) >>> 0, 0)
    m.setU32((sp + 0x18) >>> 0, lx >>> 0)
    m.setU32((sp + 0x1c) >>> 0, ly >>> 0)
    m.setU32((sp + 0x20) >>> 0, nMaxRadius >>> 0)
    m.setU16((sp + 0x24) >>> 0, wFlags & 0xffff)
    return invokeMonsterCreateHook(m, sp, hooks)
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Scans `DUNGEON_GetFloorTilesFromRoom(pRoom)` starting at a `pRoom->tSeed` random offset for a walkable
 * floor tile (`D2CMP.#10051 & 2`) with zero `0x100` center mask and at least one free `0x1C09` cardinal neighbor (`0x6FD1C278`).
 *
 * @va D2Game:0x6FD0DF60 (316B)
 */
export function MONSTER_FindValidFloorSpawnCoords113c(
  m: Memory113c,
  pRoom: number,
  pOutX: number,
  pOutY: number,
): number {
  const sp = regpopStackPtr
  regpopStackPtr = (sp + 0x30) >>> 0
  try {
    const pNumFloors = sp
    const pCoords = (sp + 8) >>> 0
    m.setU32(pNumFloors, 0)
    const pFloorArr = DUNGEON_GetFloorTilesFromRoom113c(m, pRoom, pNumFloors)
    if (pFloorArr === 0) return 0
    const nFloors = m.u32(pNumFloors) | 0
    if (nFloors === 0) return 0

    const pRoomSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0
    let startIdx = SEED_RollLimitedFast113c(m, pRoomSeed, nFloors)
    if (startIdx === 0) startIdx = 1

    DUNGEON_GetRoomCoordinates113c(m, pRoom, pCoords)
    const roomTileX = m.u32((pCoords + 0x10) >>> 0) | 0
    const roomTileY = m.u32((pCoords + 0x14) >>> 0) | 0

    const stopIdx = (startIdx - 1) | 0
    if (startIdx === stopIdx) return 0

    let idx = startIdx
    do {
      const pFloorTile = (pFloorArr + idx * 0x30) >>> 0
      const pTileEntry = m.u32((pFloorTile + 0x18) >>> 0)
      if (pTileEntry !== 0 && (D2CMP_10051_GetTileFlags113c(m, pTileEntry) & 2) !== 0) {
        const relTileX = m.u32((pFloorTile + 0x08) >>> 0) | 0
        const relTileY = m.u32((pFloorTile + 0x0c) >>> 0) | 0
        const subX = (Math.imul((roomTileX + relTileX) | 0, 5) + 3) | 0
        const subY = (Math.imul((roomTileY + relTileY) | 0, 5) + 3) | 0
        if ((COLLISION_CheckSubtileMask113c(m, pRoom, subX, subY, 0x0100) & 0xffff) === 0) {
          for (let k = 0; k < 4; k++) {
            const offX = m.u32((D2GAME_FLOOR_CROSS_OFFSETS_VA_113C + k * 8) >>> 0) | 0
            const offY = m.u32((D2GAME_FLOOR_CROSS_OFFSETS_VA_113C + k * 8 + 4) >>> 0) | 0
            const nx = (subX + offX) | 0
            const ny = (subY + offY) | 0
            if (
              (COLLISION_CheckMaskWithPattern1_113c(m, pRoom, nx, ny, 2, 0x1c09) & 0xffff) === 0
            ) {
              m.setU32(pOutX, subX >>> 0)
              m.setU32(pOutY, subY >>> 0)
              return 1
            }
          }
        }
      }
      idx = (((idx + 1) >>> 0) % (nFloors >>> 0)) | 0
    } while (idx !== stopIdx)
    return 0
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Spawns Fetish/Shaman party minions at rotating ring offsets (`0x6FD1C298`) around `pLeader`
 * and links each minion into `pLeader`'s `D2AiGeneralStrc` minion list.
 *
 * @va D2Game:0x6FD0E0A0 (441B)
 */
export function MONSTER_SpawnFetishPartyMinions113c(
  m: Memory113c,
  nVariantGroup: number,
  pGame: number,
  pLeader: number,
  nClassId: number,
  nMode: number,
  nCount: number,
  wFlags: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  if (pLeader === 0) return 0
  let grp = nVariantGroup | 0
  if (grp < 0 || grp > 2) grp = 0

  const pRoom = UNITS_GetRoom113c(m, pLeader)
  const leaderGuid = m.u32((pLeader + 0x0c) >>> 0)
  const leaderX = UNIT_GetPosX113c(m, pLeader)
  const leaderY = UNIT_GetPosY113c(m, pLeader)
  let ringIdx = ((stepSeed64Inline(m, (pLeader + 0x20) >>> 0) >>> 0) % 6) | 0
  let bAnySpawned = 0

  if ((nCount | 0) <= 0) return 0

  const sp = regpopStackPtr
  regpopStackPtr = (sp + 0x30) >>> 0
  try {
    const baseRing = grp * 6
    for (let rem = nCount | 0; rem > 0; rem--) {
      const pairIdx = (baseRing + ringIdx) * 8
      const sx = (leaderX + (m.u32((D2GAME_FETISH_RING_OFFSETS_VA_113C + pairIdx) >>> 0) | 0)) | 0
      const sy =
        (leaderY + (m.u32((D2GAME_FETISH_RING_OFFSETS_VA_113C + pairIdx + 4) >>> 0) | 0)) | 0
      ringIdx = Math.trunc(((ringIdx + 5) | 0) % 6) | 0

      m.fill(sp, 0x28, 0)
      m.setU32(sp, pGame >>> 0)
      m.setU32((sp + 0x04) >>> 0, pRoom >>> 0)
      m.setU32((sp + 0x08) >>> 0, 0)
      m.setU32((sp + 0x0c) >>> 0, nClassId >>> 0)
      m.setU32((sp + 0x10) >>> 0, nMode >>> 0)
      m.setU32((sp + 0x14) >>> 0, 0)
      m.setU32((sp + 0x18) >>> 0, sx >>> 0)
      m.setU32((sp + 0x1c) >>> 0, sy >>> 0)
      m.setU32((sp + 0x20) >>> 0, 0xffffffff)
      m.setU16((sp + 0x24) >>> 0, wFlags & 0xffff)

      const pMinion = invokeMonsterCreateHook(m, sp, hooks)
      if (pMinion !== 0) {
        bAnySpawned = 1
        if ((m.u32(pMinion) | 0) === 1) {
          const pMonData = m.u32((pMinion + 0x14) >>> 0)
          const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) : 0
          if (pAiGen !== 0) {
            m.setU32((pAiGen + 0x2c) >>> 0, leaderGuid >>> 0)
            m.setU32((pAiGen + 0x30) >>> 0, 1)
            m.setU32((pAiGen + 0x28) >>> 0, pGame >>> 0)
          }
        }
        if (hooks !== undefined && hooks.onLinkMinionToLeader !== undefined) {
          hooks.onLinkMinionToLeader(m, pLeader, pMinion, pGame)
        } else {
          AIGENERAL_LinkMinionToLeader113c(m, pLeader, pMinion, pGame)
        }
      }
    }
    return bAnySpawned
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Spawns party minions (`MonStatsTxt.wMinion1`/`wMinion2` at `+0x26`/`+0x28`, count `[bPartyMin..bPartyMax]` at `+0x2C`/`+0x2D`)
 * around a newly created party leader (such as `fallen1` or `fallenshaman1` in Blood Moor) and wires `D2AiGeneralStrc` boss-minion links.
 *
 * @va D2Game:0x6FD0E480 (609B)
 */
export function MONSTER_SpawnPartyMinions113c(
  m: Memory113c,
  pSpawnArgs: number,
  pLeader: number,
  hooks?: RegpopSpawnHooks113c,
): void {
  const nClassId = m.u32((pSpawnArgs + 0x0c) >>> 0) | 0
  if (nClassId < 0) return
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const nMonStatsCount = m.u32((pTables + 0xa80) >>> 0) | 0
  if (nClassId >= nMonStatsCount) return
  const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(nClassId, 0x1a8)) >>> 0
  if (pMonStats === 0) return

  const sp = regpopStackPtr
  regpopStackPtr = (sp + 16) >>> 0
  try {
    DATATBLS_GetMonsterChainInfo113c(m, nClassId, 0, sp)
  } finally {
    regpopStackPtr = sp
  }

  const wSpawnFlags = m.u16((pSpawnArgs + 0x24) >>> 0)
  const pGame = m.u32(pSpawnArgs) >>> 0
  const wMinion1 = sx16(m.u16((pMonStats + 0x26) >>> 0))
  if (wMinion1 < 0 || wMinion1 >= nMonStatsCount) return

  const baseId = MONSTATS_GetBaseIdFromClassId113c(m, nClassId)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
  const bMonFlags0 = m.u8((pMonStats + 0x0c) >>> 0)

  if (baseId >= 0 && baseId < nMonStatsCount && baseId === 0x105) {
    const leaderGuid = pLeader !== 0 ? m.u32((pLeader + 0x0c) >>> 0) : 0xffffffff
    const hasBit5 = (bMonFlags0 & m.u32((pMasks + 0x14) >>> 0)) !== 0
    if (pLeader !== 0 && (m.u32(pLeader) | 0) === 1) {
      const pMonData = m.u32((pLeader + 0x14) >>> 0)
      const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) : 0
      if (pAiGen !== 0) {
        if (hasBit5) m.setU8((pAiGen + 0x08) >>> 0, m.u8((pAiGen + 0x08) >>> 0) | 2)
        m.setU16((pAiGen + 0x08) >>> 0, m.u16((pAiGen + 0x08) >>> 0) | 1)
        m.setU32((pAiGen + 0x2c) >>> 0, leaderGuid >>> 0)
        m.setU32((pAiGen + 0x30) >>> 0, 1)
        m.setU32((pAiGen + 0x28) >>> 0, pGame)
      }
    }
    const partyMax = m.u8((pMonStats + 0x2d) >>> 0)
    const partyMin = m.u8((pMonStats + 0x2c) >>> 0)
    const count =
      partyMin < partyMax
        ? (partyMin +
            SEED_RollLimitedFast113c(m, (pLeader + 0x20) >>> 0, (partyMax - partyMin + 1) | 0)) |
          0
        : partyMin
    const varGroup = (~(wSpawnFlags >>> 2)) & 1
    MONSTER_SpawnFetishPartyMinions113c(
      m,
      varGroup,
      pGame,
      pLeader,
      wMinion1,
      1,
      count,
      0x40,
      hooks,
    )
    return
  }

  const hasSetBoss = (bMonFlags0 & m.u32((pMasks + 0x10) >>> 0)) !== 0
  if (hasSetBoss) {
    const leaderGuid = pLeader !== 0 ? m.u32((pLeader + 0x0c) >>> 0) : 0xffffffff
    const bossKill = bMonFlags0 & m.u32((pMasks + 0x14) >>> 0)
    if (hooks !== undefined && hooks.onInitBossGroup !== undefined) {
      hooks.onInitBossGroup(m, pLeader, 1, pGame, leaderGuid | 0, 1, bossKill)
    } else {
      AIGENERAL_InitBossGroup113c(m, pLeader, 1, pGame, leaderGuid | 0, 1, bossKill)
    }
  }

  const wMinion2 = sx16(m.u16((pMonStats + 0x28) >>> 0))
  const maxMinionSlot = wMinion2 >= 0 && wMinion2 < nMonStatsCount ? 1 : 0
  const partyMax = m.u8((pMonStats + 0x2d) >>> 0)
  const partyMin = m.u8((pMonStats + 0x2c) >>> 0)
  const totalCount =
    partyMin < partyMax
      ? (partyMin +
          SEED_RollLimitedFast113c(m, (pLeader + 0x20) >>> 0, (partyMax - partyMin + 1) | 0)) |
        0
      : partyMin
  if (totalCount <= 0) return

  let slotIdx = 0
  for (let rem = totalCount; rem > 0; rem--) {
    const minionClassId = sx16(m.u16((pMonStats + 0x26 + slotIdx * 2) >>> 0))
    const pMinion = MONSTER_SpawnPartyMinionInRing113c(
      m,
      minionClassId,
      pLeader,
      1,
      pGame,
      4,
      0x40,
      hooks,
    )
    if (pMinion !== 0) {
      const bFlagsNow = m.u8((pMonStats + 0x0c) >>> 0)
      if ((bFlagsNow & m.u8((pMasks + 0x10) >>> 0)) !== 0) {
        const leaderGuid = pLeader !== 0 ? m.u32((pLeader + 0x0c) >>> 0) : 0xffffffff
        if ((m.u32(pMinion) | 0) === 1) {
          const pMonData = m.u32((pMinion + 0x14) >>> 0)
          const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) : 0
          if (pAiGen !== 0) {
            m.setU32((pAiGen + 0x2c) >>> 0, leaderGuid >>> 0)
            m.setU32((pAiGen + 0x30) >>> 0, 1)
            m.setU32((pAiGen + 0x28) >>> 0, pGame)
          }
        }
        if (hooks !== undefined && hooks.onLinkMinionToLeader !== undefined) {
          hooks.onLinkMinionToLeader(m, pLeader, pMinion, pGame)
        } else {
          AIGENERAL_LinkMinionToLeader113c(m, pLeader, pMinion, pGame)
        }
      }
    }
    slotIdx = (slotIdx + 1) | 0
    if (slotIdx > maxMinionSlot) slotIdx = 0
  }
}

/**
 * Spawns a pack leader at `(x, y)` in `pRoom` via `MONSTER_Create`.
 *
 * @va D2Game:0x6FD0F510 (86B)
 */
export function MONSTER_SpawnPackLeader113c(
  m: Memory113c,
  nClassId: number,
  pRoom: number,
  nMode: number,
  pGame: number,
  pCoordNode: number,
  x: number,
  y: number,
  nMaxRadius: number,
  wFlags: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  const sp = regpopStackPtr
  regpopStackPtr = (sp + 0x30) >>> 0
  try {
    m.fill(sp, 0x28, 0)
    m.setU32(sp, pGame >>> 0)
    m.setU32((sp + 0x04) >>> 0, pRoom >>> 0)
    m.setU32((sp + 0x08) >>> 0, pCoordNode >>> 0)
    m.setU32((sp + 0x0c) >>> 0, nClassId >>> 0)
    m.setU32((sp + 0x10) >>> 0, nMode >>> 0)
    m.setU32((sp + 0x14) >>> 0, 0)
    m.setU32((sp + 0x18) >>> 0, x >>> 0)
    m.setU32((sp + 0x1c) >>> 0, y >>> 0)
    m.setU32((sp + 0x20) >>> 0, nMaxRadius >>> 0)
    m.setU16((sp + 0x24) >>> 0, wFlags & 0xffff)
    return invokeMonsterCreateHook(m, sp, hooks)
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Spawns an additional pack member near `pLeader`'s room & coordinates via `MONSTER_Create`.
 *
 * @va D2Game:0x6FD0F570 (210B)
 */
export function MONSTER_SpawnPackMember113c(
  m: Memory113c,
  nClassId: number,
  pLeader: number,
  nMode: number,
  pGame: number,
  pCoordNode: number,
  nMaxRadius: number,
  wFlags: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  const sp = regpopStackPtr
  regpopStackPtr = (sp + 0x30) >>> 0
  try {
    const pRoom = UNITS_GetRoom113c(m, pLeader)
    const lx = UNIT_GetPosX113c(m, pLeader)
    const ly = UNIT_GetPosY113c(m, pLeader)
    m.fill(sp, 0x28, 0)
    m.setU32(sp, pGame >>> 0)
    m.setU32((sp + 0x04) >>> 0, pRoom >>> 0)
    m.setU32((sp + 0x08) >>> 0, pCoordNode >>> 0)
    m.setU32((sp + 0x0c) >>> 0, nClassId >>> 0)
    m.setU32((sp + 0x10) >>> 0, nMode >>> 0)
    m.setU32((sp + 0x14) >>> 0, 0)
    m.setU32((sp + 0x18) >>> 0, lx >>> 0)
    m.setU32((sp + 0x1c) >>> 0, ly >>> 0)
    m.setU32((sp + 0x20) >>> 0, nMaxRadius >>> 0)
    m.setU16((sp + 0x24) >>> 0, wFlags & 0xffff)
    return invokeMonsterCreateHook(m, sp, hooks)
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Spawns a standalone monster at `(x, y)` in `pRoom` (`pCoordNode = 0`, `pLeader = 0`) via `MONSTER_Create`.
 *
 * @va D2Game:0x6FD0F650 (84B)
 */
export function MONSTER_SpawnAtCoords113c(
  m: Memory113c,
  nClassId: number,
  nMode: number,
  pGame: number,
  pRoom: number,
  x: number,
  y: number,
  nMaxRadius: number,
  wFlags: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  const sp = regpopStackPtr
  regpopStackPtr = (sp + 0x30) >>> 0
  try {
    m.fill(sp, 0x28, 0)
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
    return invokeMonsterCreateHook(m, sp, hooks)
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Checks special offset collision clearance for multi-tile/turret/tentacle base monster classes
 * (`0xCE`, `0xE4`, `0x12A`, `0x14E`, `0x210`) before spawning at `(x, y)`.
 *
 * @va D2Game:0x6FD13D20 (258B)
 */
export function MONSTER_CheckSpawnTileFree113c(
  m: Memory113c,
  pRoom: number,
  nClassId: number,
  y: number,
  x: number,
  bSkipSpecial298: number,
): number {
  let baseId = MONSTATS_GetBaseIdFromClassId113c(m, nClassId)
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (baseId < 0 || baseId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) {
    baseId = -1
  }

  let checkX = x | 0
  let checkY = y | 0
  let mask = 0x3c01

  if (baseId === 0xe4) {
    checkY = (checkY + 2) | 0
    const pFound = ROOM_FindRoomContainingSubtile113c(m, pRoom, checkX, checkY)
    if (pFound === 0) return 0
    return (COLLISION_CheckMaskWithPattern1_113c(m, pFound, checkX, checkY, 2, mask) & 0xffff) === 0
      ? 1
      : 0
  }
  if (baseId === 0xce) {
    checkY = (checkY + 3) | 0
    const pFound = ROOM_FindRoomContainingSubtile113c(m, pRoom, checkX, checkY)
    if (pFound === 0) return 0
    return (COLLISION_CheckMaskWithPattern1_113c(m, pFound, checkX, checkY, 2, mask) & 0xffff) === 0
      ? 1
      : 0
  }
  if (baseId === 0x12a) {
    if (bSkipSpecial298 !== 0) return 1
    const pFound = ROOM_FindRoomContainingSubtile113c(m, pRoom, checkX, checkY)
    if (pFound === 0) return 0
    return (COLLISION_CheckMaskWithPattern1_113c(m, pFound, checkX, checkY, 2, mask) & 0xffff) === 0
      ? 1
      : 0
  }
  if (baseId === 0x210) {
    checkX = (checkX + 2) | 0
    checkY = (checkY + 4) | 0
    const pFound = ROOM_FindRoomContainingSubtile113c(m, pRoom, checkX, checkY)
    if (pFound === 0) return 0
    return (COLLISION_CheckMaskWithPattern1_113c(m, pFound, checkX, checkY, 2, mask) & 0xffff) === 0
      ? 1
      : 0
  }
  if (baseId === 0x14e) {
    checkX = (checkX - 2) | 0
    checkY = (checkY - 2) | 0
    mask = 0x01c0
    const pFound = ROOM_FindRoomContainingSubtile113c(m, pRoom, checkX, checkY)
    if (pFound === 0) return 0
    return (COLLISION_CheckMaskWithPattern1_113c(m, pFound, checkX, checkY, 2, mask) & 0xffff) === 0
      ? 1
      : 0
  }
  return 1
}


/**
 * Checks whether `pUnit`'s current room has `nNumClients != 0` (`+0x78`).
 *
 * @va D2Game:0x6FCFF9A0 (24B)
 */
export function SUNIT_IsUnitInActiveClientRoom113c(m: Memory113c, pUnit: number): number {
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) return 0
  return m.u32((pRoom + 0x78) >>> 0) !== 0 ? 1 : 0
}

/**
 * Initializes `pUnit`'s velocity (`MonStatsTxt.nVelocity << 8`), animation mode (`UNITS_SetUnitAnimMode`),
 * and initial `MONSTER_StartMode` transition at `(x, y)` (`bInitialPlacement = 1`).
 *
 * @va D2Game:0x6FCCFAB0 (147B)
 */
export function MONSTER_InitPlacedMonsterPathAndMode113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  x: number,
  y: number,
): void {
  if (pUnit === 0) return
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  let pMonStats = 0
  if (nClassId >= 0 && nClassId < (m.u32((pTables + 0xa80) >>> 0) | 0)) {
    pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(nClassId, 0x1a8)) >>> 0
  }
  if (pMonStats === 0) return

  const pPath = m.u32((pUnit + 0x2c) >>> 0)
  const vel = sx16(m.u16((pMonStats + 0x32) >>> 0)) << 8
  PATH_SetVelocity113c(m, pPath, vel, 0, 0x17f)
  UNITS_SetUnitAnimMode113c(m, pUnit, 0, 0)

  const sp = regpopStackPtr
  regpopStackPtr = (sp + 0x28) >>> 0
  try {
    const eAnimMode = m.u32((pUnit + 0x10) >>> 0) | 0
    MONSTER_InitModeChangeStrc113c(m, pUnit, sp, eAnimMode)
    m.setU32((sp + 0x14) >>> 0, x >>> 0)
    m.setU32((sp + 0x18) >>> 0, y >>> 0)
    MONSTER_StartMode113c(m, pGame, pUnit, eAnimMode, 0, x | 0, y | 0)
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Updates `pRoom`'s ally/player count (`DUNGEON_IncreaseRoomPlayerCount`) when an allied monster
 * (`bInTown`, `STATE_CONFUSE`, hireling, or `STAT_ALIGNMENT == 2`) is added or removed (`pAiGeneral + 0x08` bit `0x08`).
 *
 * @va D2Game:0x6FD001A0 (233B)
 */
export function MONSTER_UpdateMonsterRoomAllyCount113c(
  m: Memory113c,
  pUnit: number,
  bAdd: number,
): void {
  if (pUnit === 0) return
  if ((m.u32(pUnit) | 0) !== 1) return
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) return

  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  if (
    MONSTATS_CheckFlagBit113c(m, nClassId, 0x10) === 0 &&
    STATES_CheckState113c(m, pUnit, 0x6f) === 0 &&
    MONSTERS_GetHirelingTypeId113c(m, pUnit) === 0
  ) {
    const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, 0)
    if (pStatList === 0) return
    if ((STATLIST_GetStatValue113c(m, pStatList, 0xac, 0) | 0) !== 2) return
  }

  const pMonData = m.u32((pUnit + 0x14) >>> 0)
  const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) : 0
  if (bAdd === 0) {
    if (pAiGen !== 0 && (m.u8((pAiGen + 0x08) >>> 0) & 8) !== 0) {
      m.setU32((pRoom + 0x28) >>> 0, ((m.u32((pRoom + 0x28) >>> 0) | 0) - 1) >>> 0)
      m.setU16((pAiGen + 0x08) >>> 0, m.u16((pAiGen + 0x08) >>> 0) & 0xfff7)
    }
  } else if (pAiGen !== 0 && (m.u8((pAiGen + 0x08) >>> 0) & 8) === 0) {
    DUNGEON_IncreaseRoomPlayerCount113c(m, pRoom)
    m.setU16((pAiGen + 0x08) >>> 0, m.u16((pAiGen + 0x08) >>> 0) | 8)
  }
}

/**
 * Sets `STAT_ALIGNMENT` (`0xAC`) on `pUnit`'s state `0` statlist (`0 = evil`, `1 = neutral`, `2 = good`),
 * toggles gfx state `0`, resets `pAiControl` target fields, and updates room ally count.
 *
 * @va D2Game:0x6FD00460 (752B)
 */
export function SUNIT_SetMonsterAlignmentState113c(
  m: Memory113c,
  pUnit: number,
  nAlignment: number,
  bRefreshStats: number,
): void {
  void bRefreshStats
  if (pUnit === 0) return
  if ((nAlignment >>> 0) >= 3) return

  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, 0)
  if (pStatList === 0) {
    const pNewList = STATLIST_AllocList113c(
      m,
      0,
      m.u32(pUnit),
      m.u32((pUnit + 0x0c) >>> 0),
      0,
      0,
    )
    STATLIST_SetStat113c(m, pNewList, 0xac, nAlignment, 0)
    STATLIST_SetState113c(m, pNewList, 0)
    STATLIST_MergeStatLists113c(m, pUnit, pNewList, 1)
  } else {
    const curAlign = STATLIST_GetStatValue113c(m, pStatList, 0xac, 0) | 0
    if (curAlign === (nAlignment | 0)) return
    STATLIST_SetStat113c(m, pStatList, 0xac, nAlignment, 0)
  }

  STATES_ToggleGfxStateFlag113c(m, pUnit, 0, 1)
  if ((m.u32(pUnit) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0)
    const pAiCtrl = pMonData !== 0 ? m.u32((pMonData + 0x1c) >>> 0) : 0
    if (pAiCtrl !== 0) {
      m.setU32((pAiCtrl + 0x10) >>> 0, (m.u32((pAiCtrl + 0x10) >>> 0) | 8) >>> 0)
      m.setU32((pAiCtrl + 0x14) >>> 0, 0)
      m.setU32((pAiCtrl + 0x18) >>> 0, 0)
      m.setU32((pAiCtrl + 0x1c) >>> 0, 0)
    }
    if ((nAlignment | 0) === 2) {
      MONSTER_UpdateMonsterRoomAllyCount113c(m, pUnit, 1)
    } else {
      MONSTER_UpdateMonsterRoomAllyCount113c(m, pUnit, 0)
    }
  }
}

/**
 * Deactivates `pUnit`'s active target, skill icons, modifier stat lists, and scheduled timer events
 * when placed in or moved to an inactive room (`nClients == 0`), clearing `UNITFLAG_ISACTIVE` (`0x02`).
 *
 * @va D2Game:0x6FD00860 (249B)
 */
export function SUNIT_DeactivateUnitStatesAndEvents113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): void {
  if (pUnit === 0) return
  const dwType = m.u32(pUnit) | 0
  if (dwType === 0 || dwType === 1 || dwType === 3) {
    if (m.u32((pUnit + 0x2c) >>> 0) !== 0) {
      SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
    }
    if (STATLIST_CheckUnitStatListFlag100113c(m, pUnit) !== 0) {
      for (let i = 0; i < 6; i++) {
        const stateId = m.u32((0x6fd27d90 + i * 4) >>> 0) | 0
        if (stateId > 0 && STATES_CheckState113c(m, pUnit, stateId) !== 0) {
          STATES_ToggleGfxStateFlag113c(m, pUnit, stateId, 0)
        }
      }
      STATLIST_ClearMonsterSkillIconStatList113c(m, pUnit)
    }
    STATLIST_FreeModStats113c(m, pUnit)
    UNITS_ClearGfxStateFlags113c(m, pUnit)
    SKILLS_RefreshPassiveAuraSkills113c(m, pUnit)
  }
  SUNITDMG_FreeAttackerCombatList113c(m, pGame, pUnit)
  if ((m.u8((pUnit + 0xc4) >>> 0) & 2) !== 0) {
    if (dwType !== 1 || m.u32((pUnit + 0x04) >>> 0) !== 0x197) {
      if (EVENT_GetNextEventFrame113c(m, pUnit, 9) === 0) {
        EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
        m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
      }
    }
  }
}

/**
 * Allocates `pUnit`'s path (`PATH_AllocDynamicPath` or `UNITS_AllocStaticPath`), links `pUnit` into `pRoom`
 * and `pGame`'s server unit hash (`SUNIT_InsertServerUnit113c`), schedules initial monster AI if `pRoom` is active,
 * and marks `UNITROOM_RefreshUnit`.
 *
 * @va D2Game:0x6FD00F40 (430B)
 */
export function SUNIT_PlaceServerUnitInRoom113c(
  m: Memory113c,
  pRoom: number,
  y: number,
  pUnit: number,
  x: number,
  pGame: number,
  bNoActivate: number,
): void {
  if (pRoom === 0 || pUnit === 0) return
  const dwType = m.u32(pUnit) | 0
  switch (dwType) {
    case 0: {
      PATH_AllocDynamicPath113c(m, m.u32((pGame + 0x1c) >>> 0), pRoom, x, y, pUnit, 0)
      break
    }
    case 1: {
      PATH_AllocDynamicPath113c(m, m.u32((pGame + 0x1c) >>> 0), pRoom, x, y, pUnit, 0)
      MONSTER_InitPlacedMonsterPathAndMode113c(m, pUnit, pGame, x, y)
      if (SUNIT_IsUnitInActiveClientRoom113c(m, pUnit) !== 0) {
        MONSTER_ScheduleInitialAiEvent113c(m, pGame, pUnit)
      } else {
        SUNIT_DeactivateUnitStatesAndEvents113c(m, pUnit, pGame)
      }
      break
    }
    case 2: {
      const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pUnit + 0x04) >>> 0)) >>> 0
      UNITS_AllocStaticPath113c(m, pUnit)
      UNITS_InitStaticPathCoords113c(m, pUnit, pRoom, x, y)
      const objMode = m.u32((pUnit + 0x10) >>> 0) >>> 0
      if (pObjectsTxt !== 0 && m.u8((pObjectsTxt + objMode + 0x120) >>> 0) !== 0) {
        UNITS_SetCollisionMaskAtCoords113c(m, pUnit, pRoom, x, y)
      }
      UNITROOM_SortUnitListByY113c(m, pUnit, pRoom)
      break
    }
    case 3: {
      PATH_AllocDynamicPath113c(m, m.u32((pGame + 0x1c) >>> 0), pRoom, x, y, pUnit, 0)
      break
    }
    case 4: {
      UNITS_AllocStaticPath113c(m, pUnit)
      UNITS_InitStaticPathCoords113c(m, pUnit, pRoom, x, y)
      const itemMode = m.u32((pUnit + 0x10) >>> 0) | 0
      if (itemMode === 3 || itemMode === 5) {
        if (itemMode === 3) {
          UNITS_SetCollisionMaskAtCoords113c(m, pUnit, pRoom, x, y)
        }
        UNITROOM_AddUnitToRoom113c(m, pUnit, pRoom)
      } else {
        UNITS_SetRoom113c(m, pUnit, pRoom)
      }
      ITEMS_SetOrClearCommandFlags113c(m, pUnit, 1, 1)
      break
    }
    case 5: {
      UNITS_AllocStaticPath113c(m, pUnit)
      UNITS_InitStaticPathCoords113c(m, pUnit, pRoom, x, y)
      UNITS_SetCollisionMaskAtCoords113c(m, pUnit, pRoom, x, y)
      UNITROOM_SortUnitListByY113c(m, pUnit, pRoom)
      break
    }
    default:
      return
  }

  SUNIT_InsertServerUnit113c(m, pGame, pUnit)
  UNITROOM_RefreshUnit113c(m, pUnit)
  if (bNoActivate === 0) {
    UNITS_SetPathRoomRefreshFlag113c(m, pUnit, 1)
  }
}

/**
 * Returns `max(pGame->dwPlayers, pGame->nDifficultyPlayerCountOverride)` clamped to `>= 1`.
 *
 * @va D2Game:0x6FC579A0 (45B)
 */
export function GAME_GetEffectivePlayerCount113c(m: Memory113c, pGame: number): number {
  let count = m.u32((pGame + 0x1d20) >>> 0) | 0
  const overrideCount = m.u32((pGame + 0x74) >>> 0) | 0
  if (overrideCount > count) {
    count = overrideCount
  }
  if (count <= 1) {
    count = 1
  }
  return count
}

/**
 * Resolves `pGame->nDifficulty` (`+0x6D`, clamped `0..2`), effective player count (`GAME_GetEffectivePlayerCount113c`),
 * and writes `nHpBonusPct` and `nExpBonusPct` into `pOutHpBonus` / `pOutExpBonus`.
 *
 * @va D2Game:0x6FCCF840 (118B)
 */
export function MONSTER_GetDifficultyAndPlayerBonus113c(
  m: Memory113c,
  pGame: number,
  pOutDiff: number,
  pOutPlayers: number,
  pOutHpBonus: number,
  pOutExpBonus: number,
): void {
  let nDiff = sx8(m.u8((pGame + 0x6d) >>> 0))
  if (nDiff < 0) nDiff = 0
  if (nDiff > 2) nDiff = 2
  m.setU32(pOutDiff, nDiff >>> 0)

  let nPlayers = GAME_GetEffectivePlayerCount113c(m, pGame)
  if (nPlayers < 1) nPlayers = 1
  m.setU32(pOutPlayers, nPlayers >>> 0)

  const nHpBonus =
    nPlayers < 9
      ? m.u32((D2GAME_PLAYER_HP_BONUS_TABLE_VA_113C + nPlayers * 4) >>> 0)
      : (Math.imul((nPlayers - 2) | 0, 50) >>> 0)
  m.setU32(pOutHpBonus, nHpBonus >>> 0)
  const nExpBonus =
    nPlayers < 9
      ? m.u32((D2GAME_PLAYER_EXP_BONUS_TABLE_VA_113C + nPlayers * 4) >>> 0)
      : (((nPlayers * 5 + 0x82) << 1) >>> 0)
  m.setU32(pOutExpBonus, nExpBonus >>> 0)
}

/**
 * Initializes `pUnit->pMonsterData->pAiGeneral` (`+0x28`) and `pAiControl` (`+0x1C`) AI think function pointers
 * from `D2GAME_MONSTER_AI_TABLE_VA_113C` (`0x6FD2A2A8`) via `AI_LookupDispatchTableRow113c`.
 *
 * @va D2Game:0x6FCBD230 (115B)
 */
export function AI_InitMonsterAiThinkFn113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0 || (m.u32(pUnit) | 0) !== 1) return 0
  const pMonData = m.u32((pUnit + 0x14) >>> 0)
  const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) : 0
  const nSpecAi = pAiGen !== 0 ? m.u32(pAiGen) | 0 : 0
  const pRow = AI_LookupDispatchTableRow113c(m, pUnit, nSpecAi)
  if (pRow === 0) return 0
  let pfnThink = m.u32((pRow + 0x08) >>> 0)
  if (pfnThink === 0 && pMonData !== 0) {
    const pMonStats = m.u32(pMonData) >>> 0
    const wAi = pMonStats !== 0 ? sx16(m.u16((pMonStats + 0x1e) >>> 0)) : -1
    if (wAi === 6) pfnThink = 0x6fca3130 // AiFallen
    else if (wAi === 3) pfnThink = 0x6fca38b0 // AiZombie
    else if (wAi === 4) pfnThink = 0x6fca74a0 // AiQuillRat
    else if (wAi === 5) pfnThink = 0x6fca3550 // AiSkeleton
    else if (wAi === 13) pfnThink = 0x6fca90a0 // AiFallenShaman
    else pfnThink = 0x6fcbcb00 // AiNpc default per 0x6fcbd370
  }
  if (pAiGen !== 0) {
    m.setU32((pAiGen + 0x04) >>> 0, pfnThink >>> 0)
  }
  const pAiCtrl = pMonData !== 0 ? m.u32((pMonData + 0x2c) >>> 0) : 0
  if (pAiCtrl !== 0) {
    m.setU32((pAiCtrl + 0x04) >>> 0, pfnThink >>> 0)
  }
  return 1
}

/**
 * Adds a monster skill (`nSkillId`, `nLevel`) to `pUnit` via `SKILLS_SetSkillLevelOnUnit113c` (`b Refresh = 1`)
 * and assigns skill slot `nSlot` if `nSlot != 0`.
 *
 * @va D2Game:0x6FCBF9A0 (58B)
 */
export function MONSTER_AddSkillToUnit113c(
  m: Memory113c,
  nLevel: number,
  nSkillId: number,
  pUnit: number,
  nSlot: number,
): void {
  SKILLS_SetSkillLevelOnUnit113c(m, pUnit, nSkillId, nLevel, 1, 0, 0)
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, nSkillId)
  if (pSkill !== 0 && nSlot !== 0) {
    SKILLS_SetSkillSlotIndex113c(m, pSkill, nSlot)
  }
}

/**
 * Equips `MonEquip.txt` items onto `pUnit` when `MonStatsTxt.bInventory` (`+0x0D & 0x01`) is set.
 * (No-op for Blood Moor Fallen/Shaman/Quill Rat/Zombie which have `wMonEquip < 0`).
 *
 * @va D2Game:0x6FCB2ED0 (632B)
 */
export function MONSTER_EquipMonEquipItems113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): void {
  if (pUnit === 0) return
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  const pMonStats = MONSTATS_GetRecordPtr113c(m, nClassId)
  if (pMonStats === 0) return
  if (sx16(m.u16((pMonStats + 0x62) >>> 0)) < 0) return
  if (pUnit !== 0 && m.u32((pUnit + 0x60) >>> 0) === 0) {
    INVENTORY_AllocInventory113c(m, 0, pUnit)
  }
  void pGame
}

/**
 * Rolls and populates all base stats (`STAT_MAXHP`, `STAT_HITPOINTS`, `STAT_ARMORCLASS`, `STAT_EXP`,
 * resistances, damage/tohit, velocity, regen, and `MonProp.txt` properties) on `pUnit->pStatListEx` (`+0x5C`).
 *
 * @va D2Game:0x6FCCFDB0 (1375B)
 */
export function MONSTER_InitStats113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pRoom: number,
): void {
  if (pUnit === 0) return
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  const pMonStats = MONSTATS_GetRecordPtr113c(m, nClassId)
  if (pMonStats === 0) return

  const sp = regpopStackPtr
  regpopStackPtr = (sp + 0x90) >>> 0
  try {
    const pDiff = sp
    const pPlayers = (sp + 4) >>> 0
    const pHpBonus = (sp + 8) >>> 0
    const pExpBonus = (sp + 12) >>> 0
    const pCalcBlock = (sp + 16) >>> 0

    MONSTER_GetDifficultyAndPlayerBonus113c(m, pGame, pDiff, pPlayers, pHpBonus, pExpBonus)
    const nDiff = m.u32(pDiff) | 0
    const nPlayers = Math.max(1, m.u32(pPlayers) | 0)
    const nHpBonus = m.u32(pHpBonus) | 0
    const nExpBonus = m.u32(pExpBonus) | 0
    const dwExpansion = m.u32((pGame + 0x70) >>> 0)
    const bExpansion =
      m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0 ? 1 : 0

    let mlvl = sx16(m.u16((pMonStats + nDiff * 2 + 0xaa) >>> 0))
    if (dwExpansion !== 0 && nDiff > 0 && pRoom !== 0) {
      const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
      const bFlags0 = m.u8((pMonStats + 0x0c) >>> 0)
      if (
        (bFlags0 & m.u32((pMasks + 0x08) >>> 0)) === 0 &&
        (bFlags0 & m.u32((pMasks + 0x18) >>> 0)) === 0
      ) {
        const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
        mlvl = DATATBLS_GetLevelMonsterLevel113c(m, nLevelId, nDiff, dwExpansion) | 0
      }
    }

    STATLIST_CreateEx113c(m, pUnit, 0, pGame)
    STATLIST_SetUnitStat113c(m, pUnit, 0x0c, mlvl, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 0x64, nPlayers, 0)

    STATLIST_SetUnitStat113c(
      m,
      pUnit,
      0x24,
      sx16(m.u16((pMonStats + nDiff * 2 + 0x144) >>> 0)),
      0,
    )
    STATLIST_SetUnitStat113c(
      m,
      pUnit,
      0x25,
      sx16(m.u16((pMonStats + nDiff * 2 + 0x14a) >>> 0)),
      0,
    )
    STATLIST_SetUnitStat113c(
      m,
      pUnit,
      0x27,
      sx16(m.u16((pMonStats + nDiff * 2 + 0x150) >>> 0)),
      0,
    )
    STATLIST_SetUnitStat113c(
      m,
      pUnit,
      0x29,
      sx16(m.u16((pMonStats + nDiff * 2 + 0x156) >>> 0)),
      0,
    )
    STATLIST_SetUnitStat113c(
      m,
      pUnit,
      0x2b,
      sx16(m.u16((pMonStats + nDiff * 2 + 0x15c) >>> 0)),
      0,
    )
    STATLIST_SetUnitStat113c(
      m,
      pUnit,
      0x2d,
      sx16(m.u16((pMonStats + nDiff * 2 + 0x162) >>> 0)),
      0,
    )
    STATLIST_SetUnitStat113c(m, pUnit, 0x14, m.u8((pMonStats + nDiff + 0xa3) >>> 0), 0)
    STATLIST_SetUnitStat113c(m, pUnit, 0x44, 0x64, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 0x43, 0x4b, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 0x45, 0x64, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 0x160, 0x80, 0)

    m.fill(pCalcBlock, 0x5c, 0)
    DATATBLS_CalculateMonsterStatsByLevel113c(
      m,
      nClassId,
      bExpansion,
      nDiff,
      mlvl,
      7,
      pCalcBlock,
    )

    const pUnitSeed = (pUnit + 0x20) >>> 0
    const minHp = m.u32(pCalcBlock) | 0
    const maxHp = m.u32((pCalcBlock + 0x04) >>> 0) | 0
    const rolledBaseHp = (minHp + SEED_RollLimitedFast113c(m, pUnitSeed, (maxHp - minHp + 1) | 0)) | 0
    let scaledHp = (rolledBaseHp + Math.trunc(Math.imul(rolledBaseHp, nHpBonus) / 100)) | 0
    if (scaledHp >= 0x800000) scaledHp = 0x7fffff
    const hp256 = (scaledHp << 8) | 0

    STATLIST_SetUnitStat113c(m, pUnit, 7, hp256, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 6, hp256, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 0x1f, m.u32((pCalcBlock + 0x08) >>> 0) | 0, 0)

    const baseExp = m.u32((pCalcBlock + 0x10) >>> 0) | 0
    const scaledExp = (baseExp + Math.trunc(Math.imul(baseExp, nExpBonus) / 100)) | 0
    STATLIST_SetUnitStat113c(m, pUnit, 0x0d, scaledExp, 0)

    const regenFactor = m.u32((pMonStats + 0x1a0) >>> 0) | 0
    const hpRegen = regenFactor !== 0 ? (Math.imul(regenFactor, hp256) >> 12) | 0 : 0
    STATLIST_SetUnitStat113c(m, pUnit, 0x4a, hpRegen, 0)

    MONSTERS_ApplyClassicConversionStats113c(m, pUnit, dwExpansion, nDiff)

    const pMonProp = MONPROP_GetRecordPtrFromClassId113c(m, nClassId)
    if (pMonProp !== 0) {
      const pPropList = STATLIST_AllocList113c(m, 1, 1, m.u32((pUnit + 0x0c) >>> 0), 0, 0)
      if (pPropList !== 0) {
        STATLIST_MergeStatLists113c(m, pUnit, pPropList, 1)
        const propBaseOff = nDiff * 0x60
        for (let i = 0; i < 6; i++) {
          const pEntry = (pMonProp + propBaseOff + i * 0x10 + 0x04) >>> 0
          const propId = m.u32(pEntry) | 0
          if (propId < 0) break
          const chance = m.u8((pMonProp + nDiff * 6 + i + 0x124) >>> 0)
          if (chance === 0 || SEED_RollLimitedFast113c(m, pUnitSeed, 100) < chance) {
            ITEMMODS_ApplyPropertyById113c(m, 0, 0, pUnit, 0, 0, 0, pEntry, 0, 0x40, 0)
          }
        }
      }
    }
  } finally {
    regpopStackPtr = sp
  }
}

/**
 * Initializes `pUnit->pMonsterData` (`0x60` bytes at `pUnit + 0x14`), `pAiGeneral` (`0x44` bytes at `+0x28`),
 * `pAiControl` (`0x34` bytes at `+0x1C`), `MonSeq.txt`, `pStatListEx` (`MONSTER_InitStats113c`), outfit
 * (`MONSTER_ChooseOutfit113c`), and monster skills (`MonStatsTxt + 0x14E..0x17C`).
 *
 * @va D2Game:0x6FCD0320 (484B)
 */
export function MONSTER_InitMonsterUnit113c(
  m: Memory113c,
  pUnit: number,
  pRoom: number,
  pGame: number,
  nMode: number,
): number {
  if (pUnit === 0) return 0
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  const pMonStats = MONSTATS_GetRecordPtr113c(m, nClassId)
  if (pMonStats === 0) return 0

  let pMonData = m.u32((pUnit + 0x14) >>> 0)
  if (pMonData === 0) {
    pMonData = m.alloc(0x60)
    m.fill(pMonData, 0x60, 0)
    m.setU32((pUnit + 0x14) >>> 0, pMonData)
  }
  m.setU32(pMonData, pMonStats >>> 0)

  const pAiGen = m.alloc(0x44)
  m.fill(pAiGen, 0x44, 0)
  m.setU32((pAiGen + 0x0c) >>> 0, 0xffffffff)
  m.setU32((pAiGen + 0x10) >>> 0, 1)
  m.setU32((pAiGen + 0x2c) >>> 0, 0xffffffff)
  m.setU32((pAiGen + 0x30) >>> 0, 1)
  m.setU32((pMonData + 0x28) >>> 0, pAiGen)

  const pAiCtrl = m.alloc(0x34)
  m.fill(pAiCtrl, 0x34, 0)
  m.setU32((pAiCtrl + 0x14) >>> 0, 0xffffffff)
  m.setU32((pMonData + 0x2c) >>> 0, pAiCtrl)
  m.setU32((pMonData + 0x1c) >>> 0, pAiCtrl)

  AI_InitMonsterAiThinkFn113c(m, pUnit)

  const pMonSeq = MONSEQ_GetRecordPtrFromClassId113c(m, nClassId)
  m.setU32((pUnit + 0x54) >>> 0, pMonSeq >>> 0)
  m.setU16((pMonData + 0x18) >>> 0, m.u16((pMonStats + 0x06) >>> 0))

  if (pRoom !== 0) {
    m.setU32((pMonData + 0x58) >>> 0, DUNGEON_GetLevelIdFromRoom113c(m, pRoom) >>> 0)
    m.setU32((pMonData + 0x30) >>> 0, DUNGEON_GetLogicalRoomField30_113c(m, pRoom) >>> 0)
  } else {
    m.setU32((pMonData + 0x58) >>> 0, 0)
  }

  m.setU32((pUnit + 0x10) >>> 0, nMode >>> 0)
  const pOutfit = MONREG_GetOrCreateActOutfit113c(m, (pGame + 0xf0) >>> 0, pRoom, pUnit)
  MONSTER_ChooseOutfit113c(m, pUnit, pOutfit)
  MONSTER_InitStats113c(m, pGame, pUnit, pRoom)

  for (let i = 0; i < 8; i++) {
    const pSkillRec = (pMonStats + 0x14e + i * 6) >>> 0
    const skillId = sx16(m.u16(pSkillRec))
    const skillSlot = m.u8((pSkillRec + 2) >>> 0)
    let skillLvl = m.u8((pSkillRec + 5) >>> 0)
    if (skillId <= 0 || skillLvl <= 0) break
    const nDiff = sx8(m.u8((pGame + 0x6d) >>> 0))
    if (nDiff === 1) skillLvl = (skillLvl + 3) | 0
    else if (nDiff === 2) skillLvl = (skillLvl + 5) | 0
    MONSTER_AddSkillToUnit113c(m, skillLvl, skillId, pUnit, skillSlot)
  }
  SKILLS_RefreshPassiveAuraSkills113c(m, pUnit)

  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
  if ((m.u8((pMonStats + 0x0d) >>> 0) & m.u32(pMasks)) !== 0) {
    MONSTER_EquipMonEquipItems113c(m, pUnit, pGame)
  }
  SUNIT_InitUnitAnimData113c(m, pUnit)
  return 1
}

/**
 * Allocates a server `D2UnitStrc` (`UNIT_Alloc113c`), assigns its server GUID (`SUNIT_GetNewUnitId113c`),
 * seeds `pUnit->tSeed` (`SUNIT_InitUnitSeed113c` from `pRoom->tSeed` or `pGame->tGameSeed`), initializes
 * type-specific unit data (`MONSTER_InitMonsterUnit113c`, `OBJECTS_InitObjectUnit113c`, etc.), places the unit
 * in `pRoom` (`SUNIT_PlaceServerUnitInRoom113c`), and sets its collision footprint.
 *
 * @va D2Game:0x6FD01D90 (754B)
 */
export function SUNIT_AllocUnitData113c(
  m: Memory113c,
  nUnitType: number,
  nClassId: number,
  x: number,
  y: number,
  pGame: number,
  pRoom: number,
  wFlags: number,
  nMode: number,
  dwData: number,
): number {
  if (pGame === 0) return 0
  if (nUnitType === 2 && nClassId === 0x2d) {
    nClassId = 0x1a
  }
  const pUnit = UNIT_Alloc113c(m, nUnitType)
  if (pUnit === 0) return 0

  if (nUnitType === 1 && m.u32((pUnit + 0x14) >>> 0) === 0) {
    const pMonData = m.alloc(0x60)
    m.fill(pMonData, 0x60, 0)
    m.setU32((pUnit + 0x14) >>> 0, pMonData)
  }

  m.setU32((pUnit + 0x80) >>> 0, pGame >>> 0)
  m.setU32((pUnit + 0x04) >>> 0, nClassId >>> 0)

  let dwUnitId = dwData >>> 0
  if ((nUnitType !== 0 && nUnitType !== 3) || dwUnitId === 0) {
    dwUnitId = SUNIT_GetNewUnitId113c(m, pGame, nUnitType) >>> 0
  }
  m.setU32((pUnit + 0x0c) >>> 0, dwUnitId)

  if (nUnitType !== 0) {
    SUNIT_InitUnitSeed113c(m, pUnit, (pGame + 0xd0) >>> 0)
  }

  if (pRoom !== 0) {
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
    const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
    m.setU8((pUnit + 0x18) >>> 0, nAct)
    m.setU32((pUnit + 0x1c) >>> 0, m.u32((pGame + 0xbc + nAct * 4) >>> 0))
  }
  m.setU32((pUnit + 0x84) >>> 0, pGame >>> 0)

  switch (nUnitType) {
    case 0:
      SKILLS_AllocSkillList113c(m, pUnit)
      break
    case 1:
      SKILLS_AllocSkillList113c(m, pUnit)
      if (MONSTER_InitMonsterUnit113c(m, pUnit, pRoom, pGame, nMode) === 0) {
        return 0
      }
      break
    case 2: {
      let pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pObjData === 0) {
        pObjData = m.alloc(0x38) >>> 0
        m.fill(pObjData, 0x38, 0)
        m.setU32((pUnit + 0x14) >>> 0, pObjData)
      }
      m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, nClassId) >>> 0)
      m.setU32((pUnit + 0x10) >>> 0, nMode >>> 0)
      UNITS_AllocStaticPath113c(m, pUnit)
      OBJECTS_InitObjectUnit113c(m, pUnit, pGame, dwUnitId, pRoom, x, y)
      break
    }
    case 3:
      break
    case 4:
      ITEMS_AllocItemData113c(m, m.u32((pGame + 0x1c) >>> 0), pUnit)
      m.setU32((pUnit + 0x10) >>> 0, nMode >>> 0)
      SUNIT_InitExtraItemSeed113c(m, (pGame + 0xd0) >>> 0, pUnit)
      break
    case 5:
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 1) >>> 0)
      break
    default:
      return 0
  }

  let dwUnitFlags = m.u32((pUnit + 0xc4) >>> 0) | 2
  if ((wFlags & 2) !== 0) {
    dwUnitFlags |= 0x2000
  }
  m.setU32((pUnit + 0xc4) >>> 0, dwUnitFlags >>> 0)

  if ((wFlags & 1) !== 0) {
    SUNIT_PlaceServerUnitInRoom113c(m, pRoom, y, pUnit, x, pGame, 1)
    if (nUnitType === 0) {
      const mode = m.u32((pUnit + 0x10) >>> 0) | 0
      if (mode === 0x11 || mode === 0) {
        PATH_RemoveUnitCollisionFootprint113c(m, pUnit, 1)
        PATH_SetUnitCollisionPattern113c(m, pUnit, 5)
        PATH_SetCollisionMask113c(m, m.u32((pUnit + 0x2c) >>> 0), 0x8000)
      }
    } else if (nUnitType === 1) {
      if (
        SUNIT_IsDeadOrDying113c(m, pUnit) !== 0 &&
        MONSTATS2_CheckFlagBit113c(m, nClassId, 0x13) === 0
      ) {
        PATH_RemoveUnitCollisionFootprint113c(m, pUnit, 1)
        PATH_SetUnitCollisionPattern113c(m, pUnit, 5)
        PATH_SetCollisionMask113c(m, m.u32((pUnit + 0x2c) >>> 0), 0x8000)
      }
    }
  } else if (pRoom !== 0) {
    SUNIT_PlaceServerUnitInRoom113c(m, pRoom, y, pUnit, x, pGame, 0)
  } else if (nUnitType === 4) {
    SUNIT_InsertServerUnit113c(m, pGame, pUnit)
    ITEMS_SetOrClearCommandFlags113c(m, pUnit, 1, 1)
  }

  return pUnit >>> 0
}

/**
 * Registers special periodic/timed events for sand maggot eggs, catapults, Baal tentacles, etc.
 *
 * @va D2Game:0x6FD0E260 (535B)
 */
export function MONSTER_InitSpecialClassEvents113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pRoom: number,
  pSpawnArgs: number,
): void {
  void pRoom
  void pSpawnArgs
  if (pUnit === 0) return
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  if (nClassId === 0x199) {
    const targetFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 0x4b) >>> 0
    EVENT_SetEventFull113c(m, pGame, pUnit, 0x0b, targetFrame, 0, 0, 0)
  }
}

/**
 * Performs post-spawn quest notifications and special monster class setup (Blood Raven, Izual,
 * Countess, Chaos Sanctuary seal bosses, Cow King, trapped souls, etc.).
 *
 * @va D2Game:0x6FD0E7B0 (1879B)
 */
export function MONSTER_PostSpawnQuestAndSpecialInit113c(
  m: Memory113c,
  pSpawnArgs: number,
  pUnit: number,
): void {
  if (pUnit === 0 || pSpawnArgs === 0) return
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  const pMonStats = MONSTATS_GetRecordPtr113c(m, nClassId)
  if (pMonStats === 0) return
  if (sx16(m.u16((pMonStats + 0x3c) >>> 0)) > 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x400) >>> 0)
  }
}

/**
 * Core `D2Game.dll` monster factory (`0x6FD0EF10`): searches concentric square perimeters (`r = 0` or `3, 6, ... 3 * nMaxRadius`)
 * seeded from `pRoom->tSeed` (`+0x6C`) for a collision-free subtile, returns `1` immediately when `wFlags & 1` (probe-only),
 * or allocates and initializes the `D2UnitStrc` via `SUNIT_AllocUnitData113c`, increments `MONREG` count, sets alignment,
 * and spawns party minions (`MONSTER_SpawnPartyMinions113c`).
 *
 * @va D2Game:0x6FD0EF10 (1323B)
 */
export function MONSTER_Create113c(
  m: Memory113c,
  pSpawnArgs: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  const nClassId = m.u32((pSpawnArgs + 0x0c) >>> 0) | 0
  if (nClassId < 0) return 0
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nClassId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return 0
  const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(nClassId, 0x1a8)) >>> 0
  if (pMonStats === 0) return 0
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, nClassId)
  if (pMonStats2 === 0) return 0

  const bCollisionType = m.u8((pMonStats2 + 0x0a) >>> 0)
  let collMask = 0x3c01
  if (bCollisionType === 1) collMask = 0x01c0
  else if (bCollisionType === 2) collMask = 0x3f11
  else if (bCollisionType === 3) collMask = 0

  let pRoom = m.u32((pSpawnArgs + 0x04) >>> 0)
  if (pRoom === 0) return 0
  const pCoordNode = m.u32((pSpawnArgs + 0x08) >>> 0)
  const sp = regpopStackPtr
  regpopStackPtr = (sp + 0x50) >>> 0
  try {
    let minX = 0
    let minY = 0
    let maxX = 0
    let maxY = 0
    let nNodeIdx = 0
    let bHasNode = 0

    if (pCoordNode === 0) {
      DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
      minX = m.u32(sp) | 0
      minY = m.u32((sp + 0x04) >>> 0) | 0
      maxX = (minX + (m.u32((sp + 0x08) >>> 0) | 0)) | 0
      maxY = (minY + (m.u32((sp + 0x0c) >>> 0) | 0)) | 0
    } else {
      m.setU32(sp, m.u32((pCoordNode + 0x10) >>> 0))
      m.setU32((sp + 0x04) >>> 0, m.u32((pCoordNode + 0x14) >>> 0))
      m.setU32((sp + 0x08) >>> 0, m.u32((pCoordNode + 0x18) >>> 0))
      m.setU32((sp + 0x0c) >>> 0, m.u32((pCoordNode + 0x1c) >>> 0))
      DUNGEON_GameTileToSubtileCoords113c(m, sp, (sp + 0x04) >>> 0)
      DUNGEON_GameTileToSubtileCoords113c(m, (sp + 0x08) >>> 0, (sp + 0x0c) >>> 0)
      minX = m.u32(sp) | 0
      minY = m.u32((sp + 0x04) >>> 0) | 0
      maxX = m.u32((sp + 0x08) >>> 0) | 0
      maxY = m.u32((sp + 0x0c) >>> 0) | 0
      nNodeIdx = m.u32((pCoordNode + 0x28) >>> 0) | 0
      bHasNode = 1
    }

    const nMaxRadius = m.u32((pSpawnArgs + 0x20) >>> 0) | 0
    const rStart = nMaxRadius < 0 ? 0 : 3
    const rMax = nMaxRadius < 0 ? 0 : Math.imul(nMaxRadius, 3) | 0

    let outX = 0
    let outY = 0
    const wFlags = m.u16((pSpawnArgs + 0x24) >>> 0)

    if (
      bCollisionType === 1 &&
      (nClassId < 0x102 || nClassId > 0x107) &&
      nClassId !== 0x99
    ) {
      const pOutX = (sp + 0x20) >>> 0
      const pOutY = (sp + 0x24) >>> 0
      m.setU32(pOutX, 0)
      m.setU32(pOutY, 0)
      if (MONSTER_FindValidFloorSpawnCoords113c(m, pRoom, pOutX, pOutY) !== 0) {
        outX = m.u32(pOutX) | 0
        outY = m.u32(pOutY) | 0
        pRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, outX, outY)
      }
    } else if (rStart <= rMax) {
      const originX = m.u32((pSpawnArgs + 0x18) >>> 0) | 0
      const originY = m.u32((pSpawnArgs + 0x1c) >>> 0) | 0
      const pRoomSeed = (pRoom + 0x6c) >>> 0
      const sizeX = sx8(m.u8((pMonStats2 + 0x08) >>> 0))

      for (let r = rStart; r <= rMax; r = (r + 3) | 0) {
        let offX = 0
        let offY = 0
        let stepX = 0
        let stepY = 0

        const rollAxis = stepSeed64Inline(m, pRoomSeed)
        if ((rollAxis & 1) !== 0) {
          offX = r
          offY = SEED_RollLimitedFast113c(m, pRoomSeed, r)
          stepX = 0
          stepY = 1
        } else {
          offX = SEED_RollLimitedFast113c(m, pRoomSeed, r)
          offY = r
          stepX = 1
          stepY = 0
        }

        if ((stepSeed64Inline(m, pRoomSeed) & 1) !== 0) {
          offX = -offX | 0
        }
        if ((stepSeed64Inline(m, pRoomSeed) & 1) !== 0) {
          offY = -offY | 0
        }

        let curX = (originX + offX) | 0
        let curY = (originY + offY) | 0
        const leftX = (originX - r) | 0
        const topY = (originY - r) | 0
        const rightX = (leftX + r * 2) | 0
        const botY = (topY + r * 2) | 0
        const nSteps = r === 0 ? 1 : (r * 8) | 0

        for (let step = 0; step < nSteps; step++) {
          if (curX === leftX && curY === topY) {
            stepX = 1
            stepY = 0
          }
          if (curX === rightX) {
            if (curY === topY) {
              stepX = 0
              stepY = 1
            }
            if (curY === botY) {
              stepX = -1
              stepY = 0
            }
          }
          if (curX === leftX) {
            if (curY === botY) {
              stepX = 0
              stepY = -1
            }
            if (curY === topY && curX === rightX && curY === botY) {
              stepX = 0
              stepY = 0
            }
          }

          curY = (curY + stepY) | 0
          curX = (curX + stepX) | 0

          if (curX >= minX && curX < maxX && curY >= minY && curY < maxY) {
            if (
              bHasNode === 0 ||
              (DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pRoom, curX, curY) | 0) === nNodeIdx
            ) {
              if (MONSTER_CheckSpawnTileFree113c(m, pRoom, nClassId, curY, curX, 1) !== 0) {
                if (
                  (COLLISION_CheckMaskWithPattern1_113c(
                    m,
                    pRoom,
                    curX,
                    curY,
                    sizeX,
                    collMask,
                  ) &
                    0xffff) ===
                    0 ||
                  (wFlags & 0x80) !== 0
                ) {
                  outX = curX
                  outY = curY
                  break
                }
              }
            }
          }
        }
        if (outX !== 0 && outY !== 0) break
      }
    }

    if (outX === 0 || outY === 0 || pRoom === 0) return 0
    if ((wFlags & 1) !== 0) return 1

    const pGame = m.u32(pSpawnArgs) >>> 0
    const allocFlags = (wFlags & 0x20) !== 0 ? 3 : 1
    const nMode = m.u32((pSpawnArgs + 0x10) >>> 0) | 0
    const dwData = m.u32((pSpawnArgs + 0x14) >>> 0)
    const pUnit = SUNIT_AllocUnitData113c(
      m,
      1,
      nClassId,
      outX,
      outY,
      pGame,
      pRoom,
      allocFlags,
      nMode,
      dwData,
    )
    if (pUnit === 0) return 0

    MONREG_IncrementSpawnCount113c(m, pUnit, wFlags & 0x1a, (pGame + 0xf0) >>> 0, pRoom)

    const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
    if (pCoordNode !== 0) {
      MONSTER_SetSpawnRoomCoordNode113c(m, pUnit, pCoordNode)
    } else if ((m.u8((pMonStats + 0x0f) >>> 0) & m.u32((pMasks + 0x08) >>> 0)) === 0) {
      const pCurRoom = UNITS_GetRoom113c(m, pUnit)
      const pBox = (sp + 0x30) >>> 0
      DUNGEON_GetRoomCoordinates113c(m, pCurRoom, pBox)
      const pList = DUNGEON_GetRoomCoordListFromSubtile113c(
        m,
        pCurRoom,
        m.u32(pBox) | 0,
        m.u32((pBox + 0x04) >>> 0) | 0,
      )
      MONSTER_SetSpawnRoomCoordNode113c(m, pUnit, pList)
    } else {
      const pCurRoom = UNITS_GetRoom113c(m, pUnit)
      const ux = UNIT_GetPosX113c(m, pUnit)
      const uy = UNIT_GetPosY113c(m, pUnit)
      const pList = DUNGEON_GetRoomCoordListFromSubtile113c(m, pCurRoom, ux, uy)
      MONSTER_SetSpawnRoomCoordNode113c(m, pUnit, pList)
    }

    const nRegAct = m.u8((pUnit + 0x18) >>> 0)
    const pMonReg = m.u32((pGame + 0x10dc + nRegAct * 4) >>> 0)
    if (pMonReg !== 0) {
      m.setU32((pMonReg + 0x10) >>> 0, ((m.u32((pMonReg + 0x10) >>> 0) | 0) + 1) >>> 0)
      m.setU32((pMonReg + 0x14) >>> 0, ((m.u32((pMonReg + 0x14) >>> 0) | 0) + 1) >>> 0)
    }

    const bAlign = m.u8((pMonStats + 0x4c) >>> 0)
    if (bAlign === 1) {
      SUNIT_SetMonsterAlignmentState113c(m, pUnit, 2, 1)
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x20000) >>> 0)
    } else if (bAlign === 2) {
      SUNIT_SetMonsterAlignmentState113c(m, pUnit, 1, 1)
    } else {
      SUNIT_SetMonsterAlignmentState113c(m, pUnit, 0, 1)
    }

    if ((wFlags & 2) === 0) {
      MONSTER_InitSpecialClassEvents113c(m, pGame, pUnit, pRoom, pSpawnArgs)
    }
    MONSTER_PostSpawnQuestAndSpecialInit113c(m, pSpawnArgs, pUnit)
    if ((wFlags & 0x40) === 0) {
      MONSTER_SpawnPartyMinions113c(m, pSpawnArgs, pUnit, hooks)
    }

    return pUnit >>> 0
  } finally {
    regpopStackPtr = sp
  }
}

export { sx8 as regpopSx8_113c }
