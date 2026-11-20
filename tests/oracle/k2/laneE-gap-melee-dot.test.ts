import { describe, expect, it } from 'vitest'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DamageStrc_SIZE,
  D2DynamicPathStrc,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2MissileDataStrc,
  D2MonsterDataStrc_SIZE,
  D2PlayerDataStrc_SIZE,
  D2RoomCollisionGridStrc,
  D2RoomCollisionGridStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2StatListExStrc,
  D2StatListStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  UNITS_Create113c,
  UNITS_InitPath113c,
} from '../../../src/d2kern-113c/common/unit.ts'
import { SKILLS_AddSkillToUnit113c } from '../../../src/d2kern-113c/common/skills.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import * as laneE from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c.ts'
import {
  BITSTREAM_WriteVarUint113c,
  D2GAME_FP_REMOVE_CLEAR_STATE_GFX_VA_113C,
  D2GAME_FP_REMOVE_TIMED_STATE_VA_113C,
  D2GAME_IAT_GDW_BITMASKS_VA_K2E_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_K2E_113C,
  ITEMEVENT_RemoveByTypeAndState113c,
  ITEMS_GetUnitAndLeaderMagicFind113c,
  ITEMS_RollInitialDurabilityStat113c,
  MISSILE_ApplyDamageAndArmorShred113c,
  MISSILE_ApplyDamageStrcToTarget113c,
  MISSILE_ApplyNextHitDelayState113c,
  MISSILE_BuildDamageStrcFromStats113c,
  MISSILE_CanCollideWithUnit113c,
  MISSILE_ClearStateGfxRemoveProc113c,
  MISSILE_CollideFilterPlayerOrMonster113c,
  MISSILE_CreateServerProjectile113c,
  MISSILE_DestroyDataAndEvents113c,
  MISSILE_DispatchFrameTick113c,
  MISSILE_InitDataAndPersistentEvent113c,
  MISSILE_InitOwnerDamageStats113c,
  MISSILE_MatchTargetCollideKillMode113c,
  MISSILE_ProcessTargetCollisionHit113c,
  MISSILE_RollInitialPierceCount113c,
  MISSILE_RollMasteryStatRange113c,
  MISSILE_SpawnNova64Directions113c,
  MISSILE_SrvDo01_FastcallThunk113c,
  MISSILE_SrvDo01_LinearProjectile113c,
  MISSILES_GetTxtRecordFast113c,
  MONSTER_Event03_RegenAndPoisonTick113c,
  MONSTER_Event12_ExpireTimedStats113c,
  MONSTER_QueuePacket0xAB_LifeNotify113c,
  MONSTER_SendPacket0x0C_LifeSync113c,
  MONSTER_StartGetHitMode113c,
  NET_SendPacket0x23_AssignSkill113c,
  NET_SendPacket0x3E_ItemStatBitStream113c,
  NET_SendPacket0xAB_UnitHeal113c,
  PLAYER_StartCastSkillAtCoords113c,
  SEED_RollRangeWithMinFast113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
  SKILLS_ResolveChargedSrvMissileId113c,
  SKILLS_SrvDo_NovaRing113c,
  STATES_ClearCurseStatesOnUnit113c,
  STATES_OnTimedStateRemoved113c,
} from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c.ts'

// Canonical D2Common static VAs hydrated in SparseMemory113c
const D2COMMON_SGPT_DATATABLES_VA = 0x6fde9e1c
const D2COMMON_GDW_BITMASKS_IAT_VA = 0x6fdd90b0
const D2COMMON_ITEMS_TXT_COUNT_VA = 0x6fdefb94
const D2COMMON_ITEMS_TXT_PTR_VA = 0x6fdefb98
const D2COMMON_MISSILES_TXT_PTR_VA = 0x6fdf0a3c
const D2COMMON_MISSILES_TXT_COUNT_VA = 0x6fdf0a44
const D2COMMON_EXPERIENCE_TXT_PTR_VA = 0x6fdf0b50

interface K2ETestWorld {
  m: SparseMemory113c
  pDataTables: number
  pBitMasks: number
  pStatesTxt: number
  pCurseMasks: number
  pStateMask6: number
  pStateMask32: number
  pStateMaskExp: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pMissilesTxt: number
  pSkillsTxt: number
  pIscTxt: number
  pItemsTxt: number
  pPetTypeTxt: number
  pGame: number
  pTimer: number
  pRoom: number
  pRoomEx: number
  pLevel: number
  pColGrid: number
  pColMap: number
}

function createK2ETestWorld(levelId = 2): K2ETestWorld {
  const m = new SparseMemory113c()

  // 1. gdwBitMasks (32 dwords: 1 << i)
  const pBitMasks = m.alloc(32 * 4)
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2COMMON_GDW_BITMASKS_IAT_VA, pBitMasks)
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_K2E_113C, pBitMasks)

  // 2. sgptDataTables & core Txt tables
  const pDataTables = m.alloc(0x1000)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_K2E_113C, D2COMMON_SGPT_DATATABLES_VA)

  // StatesTxt (185 states, stride 0x40) + bitmask arrays
  const nStates = 185
  const pStatesTxt = m.alloc(nStates * 0x40)
  const pCurseMasks = m.alloc(8 * 4)
  const pStateMask6 = m.alloc(8 * 4)
  const pStateMask32 = m.alloc(8 * 4)
  const pStateMaskExp = m.alloc(8 * 4)
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc0) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc4) >>> 0, nStates)
  m.setU32((pDataTables + 0xdc) >>> 0, pStateMask6)
  m.setU32((pDataTables + 0xe0) >>> 0, pStateMask6)
  m.setU32((pDataTables + 0xe4) >>> 0, pCurseMasks)
  m.setU32((pDataTables + 0xfc) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x100) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x104) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x10c) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x140) >>> 0, pStateMask32)
  m.setU32((pDataTables + 0x144) >>> 0, pStateMask32)
  m.setU32((pDataTables + 0x14c) >>> 0, pStateMask32)

  // MonStatsTxt (16 records * 0x1A8) & MonStats2Txt (16 records * 0x134)
  const nMonsters = 16
  const pMonStatsTxt = m.alloc(nMonsters * 0x1a8)
  const pMonStats2Txt = m.alloc(nMonsters * 0x134)
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, nMonsters)
  m.setU32((pDataTables + 0xa88) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, nMonsters)
  for (let i = 0; i < nMonsters; i++) {
    const pM = (pMonStatsTxt + i * 0x1a8) >>> 0
    m.setU16((pM + 0x06) >>> 0, i) // wMonStatsEx -> MonStats2 index
    m.setU16((pM + 0x18) >>> 0, i) // wMonStatsEx -> MonStats2 index
    m.setU32((pM + 0x0c) >>> 0, 0x8000) // bit 15 (killable / attackable)
    const pM2 = (pMonStats2Txt + i * 0x134) >>> 0
    m.setU8((pM2 + 0x08) >>> 0, 2) // nSizeX = 2
    m.setU8((pM2 + 0x09) >>> 0, 2) // nSizeY = 2
    m.setU32((pM2 + 0xf0) >>> 0, 0x200f) // NU, WL, GH (bit 3), KB (bit 13)
  }

  // MissilesTxt (32 records * 0x1A4)
  const nMissiles = 32
  const pMissilesTxt = m.alloc(nMissiles * 0x1a4)
  m.setU32((pDataTables + 0xb64) >>> 0, pMissilesTxt)
  m.setU32((pDataTables + 0xb6c) >>> 0, nMissiles)
  m.setU32(D2COMMON_MISSILES_TXT_PTR_VA, pMissilesTxt)
  m.setU32(D2COMMON_MISSILES_TXT_COUNT_VA, nMissiles)
  for (let i = 0; i < nMissiles; i++) {
    m.setU8((pMissilesTxt + i * 0x1a4 + 0x18a) >>> 0, 1) // nSize = 1
  }

  // SkillsTxt (128 records * 0x23C)
  const nSkills = 128
  const pSkillsTxt = m.alloc(nSkills * 0x23c)
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, nSkills)
  for (let i = 0; i < nSkills; i++) {
    m.setU16((pSkillsTxt + i * 0x23c) >>> 0, i)
  }

  // ItemStatCostTxt (360 records * 0x144) & CharStatsTxt (7 records * 0xC4)
  const nCharStats = 7
  const pCharStatsTxt = m.alloc(nCharStats * 0xc4)
  for (let i = 0; i < nCharStats; i++) {
    m.setU32((pCharStatsTxt + i * 0xc4 + 0x4c) >>> 0, 0x20687468) // "hth "
  }
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStatsTxt)
  m.setU32((pDataTables + 0xbc8) >>> 0, nCharStats)
  const nStats = 360
  const pIscTxt = m.alloc(nStats * 0x144)
  m.setU32((pDataTables + 0xbcc) >>> 0, pIscTxt)
  m.setU32((pDataTables + 0xbd4) >>> 0, nStats)

  // ItemsTxt (16 records * 0x1A8)
  const nItems = 16
  const pItemsTxt = m.alloc(nItems * 0x1a8)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA, nItems)
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32((pDataTables + 0xaa8) >>> 0, nItems)
  m.setU32((pDataTables + 0xaac) >>> 0, pItemsTxt)

  // PetTypeTxt (8 records * 0xE0)
  const nPetTypes = 8
  const pPetTypeTxt = m.alloc(nPetTypes * 0xe0)
  m.setU32((pDataTables + 0xbe8) >>> 0, pPetTypeTxt)
  m.setU32((pDataTables + 0xbf0) >>> 0, nPetTypes)
  for (let i = 0; i < nPetTypes; i++) {
    m.setU16((pPetTypeTxt + i * 0xe0 + 0x0a) >>> 0, 1)
  }

  // ExperienceTxt max level table pointer
  const pExpTxt = m.alloc(64)
  m.setU32(pExpTxt, 99)
  m.setU32(D2COMMON_EXPERIENCE_TXT_PTR_VA, pExpTxt)

  // MonType matrix (+0xC40 count, +0xC44 ptr, +0xC48 strideDwords)
  const nMonTypes = 8
  const pMonTypeMatrix = m.alloc(nMonTypes * 4)
  m.setU32((pDataTables + 0xc40) >>> 0, nMonTypes)
  m.setU32((pDataTables + 0xc44) >>> 0, pMonTypeMatrix)
  m.setU32((pDataTables + 0xc48) >>> 0, 1)

  // AnimData.d2 & static D2Common animation mode / speed tables for UNITS_SetUnitAnimMode113c
  m.setU32(0x20, 0x20687468) // "hth " fallback code
  m.fill(0x6fdf13a4, 0x30, 0)
  m.setU32(0x6fdf13c8, 1) // ANIM_PLR_GUARD_VA_113C
  const pAnimTable = m.alloc(0x500)
  const pEmptyBucket = m.alloc(8)
  for (let h = 0; h < 256; h++) {
    m.setU32((pAnimTable + h * 4) >>> 0, pEmptyBucket)
  }
  m.setU32((pAnimTable + 0x404 + 0x08) >>> 0, 8) // default dwFramesPerDirection
  m.setU32((pAnimTable + 0x404 + 0x0c) >>> 0, 256) // default dwAnimSpeed
  m.setU32(0x6fdf0b4c, pAnimTable) // SGP_ANIMDATA_TABLE_VA_113C
  m.fill(0x6fde3368, 13 * 8, 0) // WEAPON_CLASS_CODE_TABLE_6FDE3368
  m.fill(0x6fde4608, 6 * 12, 0) // diminishing stat bonus table
  m.fill(0x6fddc5f8, 0x400, 0) // player/monster mode switch & weapon anim rate tables

  // 3. D2GameStrc + D2TimerStrc
  const pGame = m.alloc(D2GameStrc_SIZE)
  m.set(pGame, D2GameStrc.dwGameFrame, 100)
  m.set(pGame, D2GameStrc.bExpansion, 1)
  m.setU32((pGame + 0xd0) >>> 0, 0x12345678) // game seed lo
  m.setU32((pGame + 0xd4) >>> 0, 0x0000029a) // game seed hi
  const pAct0 = m.alloc(0x80)
  m.setU32((pGame + 0xbc) >>> 0, pAct0)
  const pTimer = EVENT_InitTimerQueue113c(m, pGame)

  // 4. D2ActiveRoomStrc (100x100 subtiles starting at (100, 100))
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
  const pLevel = m.alloc(0x230)
  m.setU32((pLevel + 0x1d0) >>> 0, levelId)
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  const pActUpdateFlag = m.alloc(8)
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, pActUpdateFlag)

  const subX = 100
  const subY = 100
  const subW = 80
  const subH = 80
  m.set(pRoom, D2ActiveRoomStrc.nSubtileX, subX)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileY, subY)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileWidth, subW)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileHeight, subH)
  m.set(pRoom, D2ActiveRoomStrc.nTileX, subX / 5)
  m.set(pRoom, D2ActiveRoomStrc.nTileY, subY / 5)
  m.set(pRoom, D2ActiveRoomStrc.nTileWidth, subW / 5)
  m.set(pRoom, D2ActiveRoomStrc.nTileHeight, subH / 5)

  // pCoords (+0x08) for room margin check
  const pCoords = m.alloc(0x40)
  m.setU32((pCoords + 0x00) >>> 0, subX)
  m.setU32((pCoords + 0x04) >>> 0, subY)
  m.setU32((pCoords + 0x08) >>> 0, subW)
  m.setU32((pCoords + 0x0c) >>> 0, subH)
  m.setU32((pCoords + 0x10) >>> 0, subX / 5)
  m.setU32((pCoords + 0x14) >>> 0, subY / 5)
  m.setU32((pCoords + 0x18) >>> 0, subW / 5)
  m.setU32((pCoords + 0x1c) >>> 0, subH / 5)
  m.set(pRoom, D2ActiveRoomStrc.pCoords, pCoords)

  const ppRoomsNear = m.alloc(8)
  m.setU32(ppRoomsNear, pRoom)
  m.set(pRoom, D2ActiveRoomStrc.ppRoomsNear, ppRoomsNear)
  m.set(pRoom, D2ActiveRoomStrc.nRoomsNear, 1)

  const pColGrid = m.alloc(D2RoomCollisionGridStrc_SIZE)
  const pColMap = m.alloc(subW * subH * 2)
  m.set(pColGrid, D2RoomCollisionGridStrc.nSubtileX, subX)
  m.set(pColGrid, D2RoomCollisionGridStrc.nSubtileY, subY)
  m.set(pColGrid, D2RoomCollisionGridStrc.nSubtileWidth, subW)
  m.set(pColGrid, D2RoomCollisionGridStrc.nSubtileHeight, subH)
  m.set(pColGrid, D2RoomCollisionGridStrc.nTileX, subX / 5)
  m.set(pColGrid, D2RoomCollisionGridStrc.nTileY, subY / 5)
  m.set(pColGrid, D2RoomCollisionGridStrc.nTileWidth, subW / 5)
  m.set(pColGrid, D2RoomCollisionGridStrc.nTileHeight, subH / 5)
  m.set(pColGrid, D2RoomCollisionGridStrc.pMapStart, pColMap)
  m.set(pRoom, D2ActiveRoomStrc.pCollisionGrid, pColGrid)

  return {
    m,
    pDataTables,
    pBitMasks,
    pStatesTxt,
    pCurseMasks,
    pStateMask6,
    pStateMask32,
    pStateMaskExp,
    pMonStatsTxt,
    pMonStats2Txt,
    pMissilesTxt,
    pSkillsTxt,
    pIscTxt,
    pItemsTxt,
    pPetTypeTxt,
    pGame,
    pTimer,
    pRoom,
    pRoomEx,
    pLevel,
    pColGrid,
    pColMap,
  }
}

function spawnTestActor(
  w: K2ETestWorld,
  unitType: 0 | 1,
  classId: number,
  unitId: number,
  x: number,
  y: number,
): number {
  const { m, pGame, pRoom } = w
  const pUnit = UNITS_Create113c(m, unitType, classId, unitId, pGame)
  m.set(pUnit, D2UnitStrc.dwAnimMode, 1)
  m.set(pUnit, D2UnitStrc.dwFlags, 0x0c) // targetable + can-be-attacked (bits 2 & 3)
  m.setU32((pUnit + 0x20) >>> 0, 0x11223344)
  m.setU32((pUnit + 0x24) >>> 0, 0x0000029a)

  if (unitType === 0) {
    const pPlayerData = m.alloc(D2PlayerDataStrc_SIZE)
    m.set(pUnit, D2UnitStrc.pUnitData, pPlayerData)
  } else {
    const pMonData = m.alloc(D2MonsterDataStrc_SIZE)
    m.setU32(pMonData, (w.pMonStatsTxt + classId * 0x1a8) >>> 0)
    m.set(pUnit, D2UnitStrc.pUnitData, pMonData)
  }

  UNITS_InitPath113c(m, pUnit, x, y, pRoom)
  STATLIST_CreateEx113c(m, pUnit, 0, pGame)
  STATLIST_SetUnitStat113c(m, pUnit, 0x06, 200 << 8, 0) // 200 HP
  STATLIST_SetUnitStat113c(m, pUnit, 0x07, 200 << 8, 0) // 200 MaxHP
  STATLIST_SetUnitStat113c(m, pUnit, 0x0c, 10, 0) // Level 10
  if (unitType === 0) {
    const pAlignList = STATLIST_AllocList113c(m, 0, 0, unitId, 0x69, 0)
    STATLIST_SetState113c(m, pAlignList, 0x69)
    STATLIST_SetStat113c(m, pAlignList, 0xac, 2, 0)
    STATLIST_MergeStatLists113c(m, pUnit, pAlignList, 1)
  }

  // Link into room unit list (+0x74, next at unit + 0xe8) and game server hash
  const prevRoomUnit = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst)
  m.set(pUnit, D2UnitStrc.pRoomUnitNext, prevRoomUnit)
  m.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pUnit)
  SUNIT_InsertServerUnit113c(m, pGame, pUnit)

  // Stamp monster/player collision mask into pColMap so missile step scan detects occupancy
  const relX = x - 100
  const relY = y - 100
  if (relX >= 0 && relX < 80 && relY >= 0 && relY < 80) {
    const mask = unitType === 0 ? 0x80 : 0x100
    m.setU16((w.pColMap + (relY * 80 + relX) * 2) >>> 0, mask)
  }

  return pUnit
}

function readQueuedClientBytes(m: SparseMemory113c, pClient: number): Uint8Array {
  const chunks: number[] = []
  let pNode = m.u32((pClient + 0x1b8) >>> 0)
  while (pNode !== 0) {
    const used = m.u32(pNode) | 0
    for (let i = 0; i < used; i++) {
      chunks.push(m.u8((pNode + 4 + i) >>> 0))
    }
    pNode = m.u32((pNode + 0x204) >>> 0)
  }
  return Uint8Array.from(chunks)
}

describe('Milestone 33 [K2] Lane E — 39 D2Game Dynamic-Gap Ports (a1-bloodmoor-melee + p52-dot-ticks)', () => {
  it('exports all 39 target D2Game VAs as Memory113c-first *113c functions', () => {
    const expectedExports = [
      'MISSILES_GetTxtRecordFast113c',
      'SEED_RollRangeWithMinFast113c',
      'BITSTREAM_WriteVarUint113c',
      'ITEMS_GetUnitAndLeaderMagicFind113c',
      'ITEMS_RollInitialDurabilityStat113c',
      'ITEMEVENT_RemoveByTypeAndState113c',
      'MISSILE_ClearStateGfxRemoveProc113c',
      'MISSILE_MatchTargetCollideKillMode113c',
      'MISSILE_RollMasteryStatRange113c',
      'MISSILE_BuildDamageStrcFromStats113c',
      'MISSILE_CanCollideWithUnit113c',
      'MISSILE_CollideFilterPlayerOrMonster113c',
      'MISSILE_ApplyDamageStrcToTarget113c',
      'MISSILE_ApplyDamageAndArmorShred113c',
      'MISSILE_DispatchFrameTick113c',
      'MISSILE_ApplyNextHitDelayState113c',
      'MISSILE_ProcessTargetCollisionHit113c',
      'MISSILE_SrvDo01_LinearProjectile113c',
      'MISSILE_SrvDo01_FastcallThunk113c',
      'SKILLS_SrvDo_NovaRing113c',
      'MISSILE_InitOwnerDamageStats113c',
      'MISSILE_RollInitialPierceCount113c',
      'MISSILE_DestroyDataAndEvents113c',
      'MISSILE_InitDataAndPersistentEvent113c',
      'MISSILE_CreateServerProjectile113c',
      'MONSTER_Event12_ExpireTimedStats113c',
      'MONSTER_StartGetHitMode113c',
      'MONSTER_Event03_RegenAndPoisonTick113c',
      'PLAYER_StartCastSkillAtCoords113c',
      'MONSTER_QueuePacket0xAB_LifeNotify113c',
      'NET_SendPacket0x3E_ItemStatBitStream113c',
      'NET_SendPacket0x23_AssignSkill113c',
      'NET_SendPacket0xAB_UnitHeal113c',
      'STATES_ClearCurseStatesOnUnit113c',
      'SKILLS_ResolveChargedSrvMissileId113c',
      'STATES_OnTimedStateRemoved113c',
      'SKILLS_AssignHandSkillAndSyncAura113c',
      'MISSILE_SpawnNova64Directions113c',
      'MONSTER_SendPacket0x0C_LifeSync113c',
    ]
    expect(expectedExports.length).toBe(39)
    for (const name of expectedExports) {
      expect(typeof (laneE as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('covers 0x6FC21250, 0x6FC21480, and 0x6FC21CD0 (MissilesTxt fast lookup, PRNG range roll, bitstream varuint)', () => {
    const w = createK2ETestWorld()
    const { m } = w

    // 0x6FC21250: MISSILES_GetTxtRecordFast113c
    expect(MISSILES_GetTxtRecordFast113c(m, -1)).toBe(0)
    expect(MISSILES_GetTxtRecordFast113c(m, 32)).toBe(0)
    expect(MISSILES_GetTxtRecordFast113c(m, 0)).toBe(w.pMissilesTxt)
    expect(MISSILES_GetTxtRecordFast113c(m, 5)).toBe((w.pMissilesTxt + 5 * 0x1a4) >>> 0)

    // 0x6FC21480: SEED_RollRangeWithMinFast113c
    const pSeed = m.alloc(8)
    m.setU32(pSeed, 0x00010003)
    m.setU32((pSeed + 4) >>> 0, 666)
    expect(SEED_RollRangeWithMinFast113c(m, pSeed, 42, 0)).toBe(42)
    expect(m.u32(pSeed)).toBe(0x00010003) // untouched on nRange <= 0

    // Power-of-2 range (8)
    const rPow2 = SEED_RollRangeWithMinFast113c(m, pSeed, 10, 8)
    const expNext1 = 0x00010003n * 0x6ac690c5n + 666n
    const expLo1 = Number(expNext1 & 0xffffffffn) >>> 0
    expect(m.u32(pSeed)).toBe(expLo1)
    expect(rPow2).toBe(((expLo1 & 7) + 10) | 0)

    // Non-power-of-2 range (10)
    const hi1 = m.u32((pSeed + 4) >>> 0)
    const rDiv = SEED_RollRangeWithMinFast113c(m, pSeed, 25, 10)
    const expNext2 = BigInt(expLo1) * 0x6ac690c5n + BigInt(hi1)
    const expLo2 = Number(expNext2 & 0xffffffffn) >>> 0
    expect(rDiv).toBe(((expLo2 % 10) + 25) | 0)

    // 0x6FC21CD0: BITSTREAM_WriteVarUint113c (<0x100, <0x10000, >=0x10000)
    const pBs = m.alloc(20)
    const pBuf = m.alloc(16)
    m.setU32(pBs, pBuf)
    m.setU32((pBs + 4) >>> 0, 16 * 8)
    BITSTREAM_WriteVarUint113c(m, pBs, 0xa5) // 0 + 8 bits = 9 bits
    expect(m.u32((pBs + 8) >>> 0)).toBe(1)
    expect(m.u32((pBs + 12) >>> 0)).toBe(1)
    // Low bit is 0 (flag), followed by 0xa5 << 1 => byte0 = (0xa5 << 1) & 0xff = 0x4a, byte1 bit0 = 1
    expect(m.u8(pBuf)).toBe(0x4a)
    expect(m.u8((pBuf + 1) >>> 0) & 1).toBe(1)

    BITSTREAM_WriteVarUint113c(m, pBs, 0x1234) // + 18 bits => total 27 bits (3 bytes + 3 bits)
    expect(m.u32((pBs + 8) >>> 0)).toBe(3)
    expect(m.u32((pBs + 12) >>> 0)).toBe(3)

    BITSTREAM_WriteVarUint113c(m, pBs, 0x89abcdef) // + 34 bits => total 61 bits (7 bytes + 5 bits)
    expect(m.u32((pBs + 8) >>> 0)).toBe(7)
    expect(m.u32((pBs + 12) >>> 0)).toBe(5)
  })

  it('covers 0x6FC2F2F0, 0x6FC2F700, and 0x6FC57110 (MF + leader MF, item AC roll, item event unlink)', () => {
    const w = createK2ETestWorld()
    const { m, pGame } = w

    // 0x6FC2F2F0: ITEMS_GetUnitAndLeaderMagicFind113c
    const pLeader = spawnTestActor(w, 1, 1, 10, 120, 120)
    const pMinion = spawnTestActor(w, 1, 1, 11, 122, 120)
    STATLIST_SetUnitStat113c(m, pLeader, 0x50, 75, 0)
    STATLIST_SetUnitStat113c(m, pMinion, 0x50, 30, 0)

    const pAiGen = m.alloc(0x40)
    m.setU32((pAiGen + 0x28) >>> 0, pGame)
    m.setU32((pAiGen + 0x2c) >>> 0, 10) // leader GUID
    m.setU32((pAiGen + 0x30) >>> 0, 1) // leader type (monster)
    const pMinionData = m.get(pMinion, D2UnitStrc.pUnitData)
    m.setU32((pMinionData + 0x28) >>> 0, pAiGen)

    expect(ITEMS_GetUnitAndLeaderMagicFind113c(m, 0)).toBe(0)
    expect(ITEMS_GetUnitAndLeaderMagicFind113c(m, pLeader)).toBe(75)
    expect(ITEMS_GetUnitAndLeaderMagicFind113c(m, pMinion)).toBe(105)

    // 0x6FC2F700: ITEMS_RollInitialDurabilityStat113c
    const pItemRec = (w.pItemsTxt + 2 * 0x1a8) >>> 0
    m.setU32((pItemRec + 0xcc) >>> 0, 12) // dwMinAc
    m.setU32((pItemRec + 0xd0) >>> 0, 18) // dwMaxAc
    const pItem = UNITS_Create113c(m, 4, 2, 500, pGame)
    m.setU32((pItem + 0x20) >>> 0, 0x55667788)
    m.setU32((pItem + 0x24) >>> 0, 666)
    STATLIST_CreateEx113c(m, pItem, 0, pGame)

    expect(ITEMS_GetUnitAndLeaderMagicFind113c(m, pItem)).toBe(0)
    ITEMS_RollInitialDurabilityStat113c(m, pItem)
    const rolledAc = STATLIST_GetUnitStat113c(m, pItem, 0x1f, 0)
    expect(rolledAc).toBeGreaterThanOrEqual(12)
    expect(rolledAc).toBeLessThanOrEqual(18)

    // 0x6FC57110: ITEMEVENT_RemoveByTypeAndState113c
    const n1 = m.alloc(0x24) // active firing (wFlags & 1): deferred mark |= 2
    const n2 = m.alloc(0x24) // matching non-firing: unlinked
    const n3 = m.alloc(0x24) // non-matching state: kept
    m.setU16((n1 + 0x02) >>> 0, 0x01)
    m.setU32((n1 + 0x04) >>> 0, 1)
    m.setU32((n1 + 0x08) >>> 0, 2)
    m.setU32((n1 + 0x18) >>> 0, 0)
    m.setU32((n1 + 0x1c) >>> 0, n2)

    m.setU16((n2 + 0x02) >>> 0, 0x00)
    m.setU32((n2 + 0x04) >>> 0, 1)
    m.setU32((n2 + 0x08) >>> 0, 2)
    m.setU32((n2 + 0x18) >>> 0, n1)
    m.setU32((n2 + 0x1c) >>> 0, n3)

    m.setU16((n3 + 0x02) >>> 0, 0x00)
    m.setU32((n3 + 0x04) >>> 0, 1)
    m.setU32((n3 + 0x08) >>> 0, 99)
    m.setU32((n3 + 0x18) >>> 0, n2)
    m.setU32((n3 + 0x1c) >>> 0, 0)

    m.setU32((pLeader + 0x90) >>> 0, n1)
    ITEMEVENT_RemoveByTypeAndState113c(m, pLeader, pGame, 1, 2)
    expect(m.u16((n1 + 0x02) >>> 0)).toBe(0x03) // marked |= 2
    expect(m.u32((n1 + 0x1c) >>> 0)).toBe(n3) // n2 unlinked!
    expect(m.u32((n3 + 0x18) >>> 0)).toBe(n1)
  })

  it('covers S2C packet builders 0x6FCAB010 (0x3E), 0x6FCAB710 (0x23), 0x6FCABA50 (0xAB), 0x6FD13360 (0x0C), and 0x6FC9A260', () => {
    const w = createK2ETestWorld()
    const { m } = w

    const pClient = m.alloc(0x200)

    // 0x6FCAB710: NET_SendPacket0x23_AssignSkill113c (13 bytes)
    NET_SendPacket0x23_AssignSkill113c(m, 0, 0x11223344, pClient, 1, 0x005c, 0xffffffff)
    let bytes = readQueuedClientBytes(m, pClient)
    expect(bytes.length).toBe(13)
    expect(Array.from(bytes)).toEqual([
      0x23,
      0x00,
      0x44, 0x33, 0x22, 0x11,
      0x01,
      0x5c, 0x00,
      0xff, 0xff, 0xff, 0xff,
    ])

    // 0x6FCABA50: NET_SendPacket0xAB_UnitHeal113c (7 bytes appended to same 0x208 packet block)
    NET_SendPacket0xAB_UnitHeal113c(m, 1, 0x0000002a, pClient, 0x64)
    bytes = readQueuedClientBytes(m, pClient)
    expect(bytes.length).toBe(20)
    expect(Array.from(bytes.slice(13))).toEqual([0xab, 0x01, 0x2a, 0x00, 0x00, 0x00, 0x64])

    // 0x6FCAB010: NET_SendPacket0x3E_ItemStatBitStream113c (34 bytes queued)
    const pClient2 = m.alloc(0x200)
    const pItem = UNITS_Create113c(m, 4, 1, 0x55, w.pGame)
    NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, 0, pClient2, 1, 72, 15)
    const pkt3e = readQueuedClientBytes(m, pClient2)
    expect(pkt3e.length).toBe(0x22)
    expect(pkt3e[0]).toBe(0x3e)
    // 9 (guid=0x55) + 1 (flag) + 9 (stat=72) + 9 (val=15) + 9 (layer=0) = 37 bits = 5 bytes => +2 = 7
    expect(pkt3e[1]).toBe(7)

    // 0x6FD13360: MONSTER_SendPacket0x0C_LifeSync113c (9 bytes)
    const pClient3 = m.alloc(0x200)
    const pMon = spawnTestActor(w, 1, 1, 77, 130, 130)
    STATLIST_SetUnitStat113c(m, pMon, 0x06, 100 << 8, 0) // 100 / 200 HP => pct = 64 -> dec -> 63 (0x3f)
    m.setU8((pMon + 0xb0) >>> 0, 0x24) // hitClass
    const pMonData = m.get(pMon, D2UnitStrc.pUnitData)
    m.setU8((pMonData + 0x17) >>> 0, 0x01) // boss/champ bit -> |= 0x80 => 0xbf
    MONSTER_SendPacket0x0C_LifeSync113c(m, pMon, pClient3)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x160, 0)).toBe(64)
    const pkt0c = readQueuedClientBytes(m, pClient3)
    expect(Array.from(pkt0c)).toEqual([0x0c, 0x01, 77, 0, 0, 0, 0x13, 0x24, 0xbf])

    // 0x6FC9A260: MONSTER_QueuePacket0xAB_LifeNotify113c
    MONSTER_QueuePacket0xAB_LifeNotify113c(m, pMon, 0x40)
    MONSTER_QueuePacket0xAB_LifeNotify113c(m, pMon, 0x20)
    const headAb = m.u32((pMon + 0xec) >>> 0)
    const tailAb = m.u32((pMon + 0xf0) >>> 0)
    expect(headAb).not.toBe(0)
    expect(tailAb).not.toBe(headAb)
    expect(m.u32(headAb)).toBe(tailAb)
    expect(m.u8((headAb + 0x04) >>> 0)).toBe(0xab)
    expect(m.u8((headAb + 0x08) >>> 0)).toBe(1)
    expect(m.u32((headAb + 0x0c) >>> 0)).toBe(77)
    expect(m.u8((headAb + 0x10) >>> 0)).toBe(0x40)
    expect(m.u8((tailAb + 0x10) >>> 0)).toBe(0x20)
  })

  it('covers 0x6FCB0F30, 0x6FC58E60, 0x6FCBF7A0, 0x6FC94870, and 0x6FC95210 (curses, timed states, get-hit mode)', () => {
    const w = createK2ETestWorld()
    const { m, pGame } = w
    const pMon = spawnTestActor(w, 1, 1, 21, 130, 130)

    // Configure state 9 (Amplify Damage) as curse in StatesTxt & mask tables
    const curseState = 9
    const buffState = 32
    m.setU32(w.pCurseMasks, 1 << curseState)
    m.setU32(w.pStateMask6, 1 << curseState)
    m.setU8((w.pStatesTxt + curseState * 0x40 + 0x04) >>> 0, 0x40) // bit 6 (mask 6)

    const pCurseList = STATLIST_AllocList113c(m, 2, 1, 21, curseState, 150)
    STATLIST_SetStat113c(m, pCurseList, 0x24, -100, 0) // -100% DR
    STATLIST_SetStatRemoveProc113c(m, pCurseList, D2GAME_FP_REMOVE_TIMED_STATE_VA_113C)
    STATLIST_MergeStatLists113c(m, pMon, pCurseList, 1)
    STATES_ToggleGfxStateFlag113c(m, pMon, curseState, 1)

    const pBuffList = STATLIST_AllocList113c(m, 2, 1, 21, buffState, 105)
    STATLIST_SetStat113c(m, pBuffList, 0x1f, 50, 0) // +50 AC
    STATLIST_SetStatRemoveProc113c(m, pBuffList, D2GAME_FP_REMOVE_CLEAR_STATE_GFX_VA_113C)
    STATLIST_MergeStatLists113c(m, pMon, pBuffList, 1)
    STATES_ToggleGfxStateFlag113c(m, pMon, buffState, 1)

    expect(STATES_CheckState113c(m, pMon, curseState)).not.toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x24, 0)).toBe(-100)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x1f, 0)).toBe(50)

    // 0x6FCB0F30: clears curseState (9), unlinks -100% DR, keeps buffState (32)
    STATES_ClearCurseStatesOnUnit113c(m, pMon)
    expect(STATES_CheckState113c(m, pMon, curseState)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x24, 0)).toBe(0)
    expect(STATES_CheckState113c(m, pMon, buffState)).not.toBe(0)

    // 0x6FC94870: advance dwGameFrame to 105 and expire buffState (32) -> invokes 0x6FC58E60
    m.set(pGame, D2GameStrc.dwGameFrame, 105)
    MONSTER_Event12_ExpireTimedStats113c(m, pGame, pMon)
    expect(STATES_CheckState113c(m, pMon, buffState)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x1f, 0)).toBe(0)

    // Direct 0x6FC58E60 & 0x6FCBF7A0 verification on player with pet container
    const pPlayer = spawnTestActor(w, 0, 2, 1, 125, 125)
    const pPlayerData = m.get(pPlayer, D2UnitStrc.pUnitData)
    const pPetsContainer = m.alloc(16)
    const pPetArr = m.alloc(8 * 12)
    m.setU32(pPetsContainer, pPetArr)
    m.setU32((pPlayerData + 0x44) >>> 0, pPetsContainer)
    STATES_ToggleGfxStateFlag113c(m, pPlayer, 15, 1)
    MISSILE_ClearStateGfxRemoveProc113c(m, pPlayer, 15, 0)
    expect(STATES_CheckState113c(m, pPlayer, 15)).toBe(0)

    STATES_ToggleGfxStateFlag113c(m, pPlayer, 16, 1)
    STATES_OnTimedStateRemoved113c(m, pPlayer, 16, 0)
    expect(STATES_CheckState113c(m, pPlayer, 16)).toBe(0)

    // 0x6FC95210: MONSTER_StartGetHitMode113c
    const pModeChange = m.alloc(0x24)
    m.setU32((pModeChange + 0x04) >>> 0, pMon)
    expect(MONSTER_StartGetHitMode113c(m, pGame, pModeChange)).toBe(1)
    expect(m.get(pMon, D2UnitStrc.dwAnimMode)).toBe(3)
  })

  it('covers 0x6FCB1340, 0x6FCC2100, and 0x6FC98840 (charged missile ID, hand skill + aura sync, cast at coords)', () => {
    const w = createK2ETestWorld()
    const { m, pGame } = w
    const pPlayer = spawnTestActor(w, 0, 3, 1, 135, 135)
    const pPlayerData = m.get(pPlayer, D2UnitStrc.pUnitData)
    const pClient = m.alloc(0x200)
    m.setU32((pPlayerData + 0x9c) >>> 0, pClient)

    // Configure skill 25 as progressive charge skill (`dwFlags` bit 2 at `gdwBitMasks[2]` => byte offset 0x08 = 0x04, auraState = 20, auraStat = 300)
    const chargeSkill = 25
    const pChargeTxt = (w.pSkillsTxt + chargeSkill * 0x23c) >>> 0
    m.setU8((pChargeTxt + 0x04) >>> 0, 0x04)
    m.setU16((pChargeTxt + 0x80) >>> 0, 20)
    m.setU16((pChargeTxt + 0x54) >>> 0, 300)
    m.setU16((pChargeTxt + 0x48) >>> 0, 10) // tier 1
    m.setU16((pChargeTxt + 0x4a) >>> 0, 11) // tier 2
    m.setU16((pChargeTxt + 0x4c) >>> 0, 12) // tier 3

    expect(SKILLS_ResolveChargedSrvMissileId113c(m, -1, pPlayer)).toBe(-1)
    expect(SKILLS_ResolveChargedSrvMissileId113c(m, chargeSkill, pPlayer)).toBe(10)

    const pChargeList = STATLIST_AllocList113c(m, 0, 0, 1, 20, 0)
    STATLIST_SetState113c(m, pChargeList, 20)
    STATLIST_SetStat113c(m, pChargeList, 300, 3, 0)
    STATLIST_MergeStatLists113c(m, pPlayer, pChargeList, 1)
    expect(SKILLS_ResolveChargedSrvMissileId113c(m, chargeSkill, pPlayer)).toBe(12)

    // Configure skill 98 (Might aura: `dwFlags` bit 5 at `gdwBitMasks[5]` => byte offset 0x14 => bit 5 = 0x20, auraState = 33)
    // and skill 92 (Poison Nova: non-aura right-hand skill)
    const auraSkill = 98
    const novaSkill = 92
    const pAuraTxt = (w.pSkillsTxt + auraSkill * 0x23c) >>> 0
    m.setU8((pAuraTxt + 0x04) >>> 0, 0x20) // bit 5 (aura)
    m.setU16((pAuraTxt + 0x80) >>> 0, 33) // aura state 33

    const pSkillList = m.alloc(0x20)
    m.setU32((pPlayer + 0xa8) >>> 0, pSkillList)
    const pAuraSkillNode = SKILLS_AddSkillToUnit113c(m, pPlayer, auraSkill)
    m.setU32((pAuraSkillNode + 0x28) >>> 0, 4) // base skill level 4
    const pNovaSkillNode = SKILLS_AddSkillToUnit113c(m, pPlayer, novaSkill)
    m.setU32((pNovaSkillNode + 0x28) >>> 0, 5) // base skill level 5

    // 0x6FCC2100: assign auraSkill (98) to right hand -> activates state 33 & sends 0x23
    SKILLS_AssignHandSkillAndSyncAura113c(m, pPlayer, 0, auraSkill, 0xffffffff)
    expect(STATES_CheckState113c(m, pPlayer, 33)).not.toBe(0)
    expect(readQueuedClientBytes(m, pClient).length).toBe(13)

    // Switch right hand from auraSkill (98) to novaSkill (92) -> tears down aura state 33 & sends second 0x23
    SKILLS_AssignHandSkillAndSyncAura113c(m, pPlayer, 0, novaSkill, 0xffffffff)
    expect(STATES_CheckState113c(m, pPlayer, 33)).toBe(0)
    expect(readQueuedClientBytes(m, pClient).length).toBe(26)

    // 0x6FC98840: PLAYER_StartCastSkillAtCoords113c
    m.setU32((pSkillList + 0x10) >>> 0, pNovaSkillNode) // pUsedSkill
    m.setU32((pPlayer + 0xc4) >>> 0, (m.u32((pPlayer + 0xc4) >>> 0) | 0x40) >>> 0)
    PLAYER_StartCastSkillAtCoords113c(m, pGame, pPlayer, 10, 145, 145)
    expect(m.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(10)
    expect(m.u32((pPlayer + 0xc4) >>> 0) & 0x40).toBe(0)
  })

  it('covers missile damage rolling, mastery, pierce, armor shred, and lifecycle (0x6FC58FB0..0x6FC5AFF0, 0x6FC8F620..0x6FC8F8A0)', () => {
    const w = createK2ETestWorld()
    const { m, pGame } = w

    const pPlayer = spawnTestActor(w, 0, 2, 1, 120, 120)
    const pDemon = spawnTestActor(w, 1, 2, 30, 126, 120)
    // Mark monster class 2 as Demon (`nBitField2` +0x0d bit 7 = 0x80 killable, bit 5 = 0x20 for MONSTER_CheckMonTypeFlag0x20, bit 3 = 0x08 for Demon/Undead)
    const pDemonTxt = (w.pMonStatsTxt + 2 * 0x1a8) >>> 0
    m.setU8((pDemonTxt + 0x0d) >>> 0, 0xa8)
    STATLIST_SetUnitStat113c(m, pDemon, 0x1f, 80, 0) // 80 AC

    // 0x6FC58FB0: MISSILE_MatchTargetCollideKillMode113c
    expect(MISSILE_MatchTargetCollideKillMode113c(m, pPlayer, 0)).toBe(0)
    expect(MISSILE_MatchTargetCollideKillMode113c(m, pPlayer, 1)).toBe(1)
    expect(MISSILE_MatchTargetCollideKillMode113c(m, pDemon, 1)).toBe(0)
    expect(MISSILE_MatchTargetCollideKillMode113c(m, pDemon, 2)).toBe(1)
    expect(MISSILE_MatchTargetCollideKillMode113c(m, pDemon, 3)).toBe(1)
    expect(MISSILE_MatchTargetCollideKillMode113c(m, 0, 4)).toBe(1)

    // Configure missile 3 with pierce flag (bit 2 at `gdwBitMasks[2]` => byte offset 0x08 = 0x04), owner flag (bit 0 = 0x01), HitShift = 8
    const misId = 3
    const pMisTxt = (w.pMissilesTxt + misId * 0x1a4) >>> 0
    m.setU8((pMisTxt + 0x04) >>> 0, 0x05) // bit 0 (owner) + bit 2 (pierce)
    m.setU8((pMisTxt + 0x9a) >>> 0, 12) // nVel
    m.setU16((pMisTxt + 0x96) >>> 0, 20) // wRange
    m.setU8((pMisTxt + 0x183) >>> 0, 3) // nCollideType = 3
    m.setU8((pMisTxt + 0x198) >>> 0, 8) // nHitShift = 8
    m.setU32((pMisTxt + 0x104) >>> 0, 10) // dwMinDamage
    m.setU32((pMisTxt + 0x118) >>> 0, 20) // dwMaxDamage

    // Give player 100% pierce (`0x9c = 100`) so `0x6FC8F660` rolls all 4 pierce charges
    STATLIST_SetUnitStat113c(m, pPlayer, 0xa6, 100, 0)

    const pParams = m.alloc(0x5c)
    m.setU32(pParams, 0x03) // explicit origin + delta
    m.setU32((pParams + 0x04) >>> 0, pPlayer)
    m.setU32((pParams + 0x08) >>> 0, pPlayer)
    m.setU32((pParams + 0x10) >>> 0, misId)
    m.setU32((pParams + 0x14) >>> 0, 120)
    m.setU32((pParams + 0x18) >>> 0, 120)
    m.setU32((pParams + 0x1c) >>> 0, 10)
    m.setU32((pParams + 0x20) >>> 0, 0)
    m.setU32((pParams + 0x30) >>> 0, 1) // level 1

    const pMissile = MISSILE_CreateServerProjectile113c(m, pGame, pParams)
    expect(pMissile).not.toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x148, 0)).toBe(4) // 4 pierce charges!

    // Populate missile stats for 0x6FC59B40, 0x6FC5A4E0, 0x6FC5AE10, 0x6FC5AFF0
    STATLIST_SetUnitStat113c(m, pMissile, 0x15, 10 << 8, 0) // min phys
    STATLIST_SetUnitStat113c(m, pMissile, 0x16, 10 << 8, 0) // max phys
    STATLIST_SetUnitStat113c(m, pMissile, 0x79, 50, 0) // +50% demon dmg
    STATLIST_SetUnitStat113c(m, pMissile, 0x7a, 50, 0) // +50% undead/demon dmg
    STATLIST_SetUnitStat113c(m, pMissile, 0x8d, 1, 0) // deadly strike (x2)
    STATLIST_SetUnitStat113c(m, pMissile, 0x30, 20 << 8, 0) // fire min
    STATLIST_SetUnitStat113c(m, pMissile, 0x31, 20 << 8, 0) // fire max
    STATLIST_SetUnitStat113c(m, pMissile, 0x149, 25, 0) // +25% fire mastery
    STATLIST_SetUnitStat113c(m, pMissile, 0x78, -30, 0) // -30 target AC shred

    expect(MISSILE_RollMasteryStatRange113c(m, 0x31, 0x149, pMissile, 0x30)).toBe((25 << 8) | 0)

    const pDmg = m.alloc(D2DamageStrc_SIZE)
    MISSILE_BuildDamageStrcFromStats113c(m, pMissile, pDemon, pDmg)
    // phys = 10<<8 * (1 + 100%) * 2 (deadly strike) = 40 << 8
    expect(m.u32((pDmg + 0x08) >>> 0)).toBe((40 << 8) >>> 0)
    expect(m.u32((pDmg + 0x10) >>> 0)).toBe((25 << 8) >>> 0)
    expect(m.u8((pDmg + 0x05) >>> 0) & 0x20).toBe(0x20)

    MISSILE_ApplyDamageAndArmorShred113c(m, pGame, pDmg, pMissile, pDemon)
    // Demon lost 65 HP (200 -> 135 HP) and 30 AC (80 -> 50 AC)
    expect(STATLIST_GetUnitStat113c(m, pDemon, 0x06, 0)).toBe(135 << 8)
    expect(STATLIST_GetUnitStat113c(m, pDemon, 0x1f, 0)).toBe(50)

    // Verify MISSILE_InitOwnerDamageStats113c, MISSILE_InitDataAndPersistentEvent113c & MISSILE_DestroyDataAndEvents113c
    MISSILE_InitOwnerDamageStats113c(m, pPlayer, pMissile, 1, pPlayer)
    MISSILE_RollInitialPierceCount113c(m, pPlayer, pMissile)
    MISSILE_InitDataAndPersistentEvent113c(m, pMissile, pGame, 999)
    expect(m.get(pMissile, D2UnitStrc.dwUnitId)).toBe(999)
    MISSILE_DestroyDataAndEvents113c(m, pMissile, pGame)
    expect(m.get(pMissile, D2UnitStrc.pUnitData)).toBe(0)
    expect(m.get(pMissile, D2UnitStrc.pEventFirst)).toBe(0)
  })

  it('executes full E2E Poison Nova 64-ray pipeline (0x6FC63AA0 -> 0x6FCC2800 -> 0x6FC8F930 -> 0x6FC5E3F0 -> 0x6FC5F540 -> 0x6FC5F320 -> 0x6FC5EDE0 -> 0x6FC5E590 -> 0x6FC96740 -> 0x6FC94870)', () => {
    const w = createK2ETestWorld(2) // Blood Moor (non-town)
    const { m, pGame, pRoom } = w

    // Necromancer at (130, 130); Fallen directly on ray 0 (+dx path: (132, 130))
    const pNecro = spawnTestActor(w, 0, 2, 1, 130, 130)
    const pFallen = spawnTestActor(w, 1, 1, 40, 132, 130)
    STATLIST_SetUnitStat113c(m, pFallen, 0x06, 95 << 8, 0) // 95 HP (60 HP after initial 35 HP poison hit)
    STATLIST_SetUnitStat113c(m, pFallen, 0x07, 95 << 8, 0) // 95 MaxHP

    // Configure Poison Nova skill (92) & missile (8)
    const novaSkillId = 92
    const novaMisId = 8
    const pNovaSkillTxt = (w.pSkillsTxt + novaSkillId * 0x23c) >>> 0
    m.setU16((pNovaSkillTxt + 0x48) >>> 0, novaMisId) // wSrvMissile = 8
    m.setU32((pNovaSkillTxt + 0x138) >>> 0, 0xffffffff) // no calc bonus

    const pNovaMisTxt = (w.pMissilesTxt + novaMisId * 0x1a4) >>> 0
    m.setU8((pNovaMisTxt + 0x04) >>> 0, 0x05) // bit 0 (owner) | bit 2 (pierce/pass-through)
    m.setU16((pNovaMisTxt + 0x0c) >>> 0, 1) // wSrvDoFunc = 1 (linear projectile)
    m.setU8((pNovaMisTxt + 0x9a) >>> 0, 16) // nVel = 16
    m.setU16((pNovaMisTxt + 0x96) >>> 0, 20) // wRange = 20 frames
    m.setU8((pNovaMisTxt + 0x183) >>> 0, 3) // nCollideType = 3 (player/monster, mask 0x184)
    m.setU8((pNovaMisTxt + 0x188) >>> 0, 1) // bLastCollide (NextDelay enabled!)
    m.setU8((pNovaMisTxt + 0x189) >>> 0, 4) // nNextDelay = 4 frames

    // 1. Cast Poison Nova via SKILLS_SrvDo_NovaRing113c -> spawns 64 missiles in pRoom!
    const castOk = SKILLS_SrvDo_NovaRing113c(m, pGame, pNecro, novaSkillId, 1, {})
    expect(castOk).toBe(1)

    // Collect all spawned missiles in pRoom and seed poison stats (35 HP/frame for 10 frames)
    const spawnedMissiles: number[] = []
    for (let u = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst); u !== 0; u = m.get(u, D2UnitStrc.pRoomUnitNext)) {
      if (m.get(u, D2UnitStrc.dwUnitType) === 3) {
        spawnedMissiles.push(u)
        STATLIST_SetUnitStat113c(m, u, 0x39, 35 << 8, 0) // pois min
        STATLIST_SetUnitStat113c(m, u, 0x3a, 35 << 8, 0) // pois max
        STATLIST_SetUnitStat113c(m, u, 0x3b, 10, 0) // pois len = 10 frames
      }
    }
    expect(spawnedMissiles.length).toBe(64)

    // Verify ray 0 (last in LIFO or GUID 1) targets (130 + 30, 130 + 0) = (160, 130)
    const pRay0 = SUNIT_GetServerUnitFromList(spawnedMissiles, m, 1)
    expect(pRay0).not.toBe(0)
    const pRay0Path = m.get(pRay0, D2UnitStrc.pPath)
    expect(m.get(pRay0Path, D2DynamicPathStrc.wTargetX)).toBe(160)
    expect(m.get(pRay0Path, D2DynamicPathStrc.wTargetY)).toBe(130)

    // Verify MISSILE_CanCollideWithUnit113c & MISSILE_CollideFilterPlayerOrMonster113c before hit
    const pCtx = m.alloc(16)
    m.setU32(pCtx, pGame)
    m.setU32((pCtx + 4) >>> 0, pRay0)
    m.setU32((pCtx + 8) >>> 0, pNecro)
    m.setU32((pCtx + 12) >>> 0, pNovaMisTxt)
    expect(MISSILE_CanCollideWithUnit113c(m, pFallen, pNecro, pNovaMisTxt, pGame, pRay0)).toBe(1)
    expect(MISSILE_CanCollideWithUnit113c(m, pNecro, pNecro, pNovaMisTxt, pGame, pRay0)).toBe(0)
    expect(MISSILE_CollideFilterPlayerOrMonster113c(m, pFallen, pCtx)).toBe(1)

    // 2. Tick all 64 missiles for 2 frames via MISSILE_DispatchFrameTick113c -> ray 0 hits Fallen!
    for (let tick = 0; tick < 2; tick++) {
      for (const pMis of spawnedMissiles) {
        MISSILE_DispatchFrameTick113c(m, pGame, pMis)
      }
    }

    // Verify NextDelay (STATE_JUSTHIT = 0x56) blocked duplicate ray hits and STATE_POISON (2) applied -35<<8 regen!
    expect(STATES_CheckState113c(m, pFallen, 0x56)).not.toBe(0)
    expect(STATES_CheckState113c(m, pFallen, 0x02)).not.toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pFallen, 0x4a, 0)).toBe(-(35 << 8))

    // Also verify MISSILE_SrvDo01_FastcallThunk113c & MISSILE_SrvDo01_LinearProjectile113c & MISSILE_ApplyDamageStrcToTarget113c directly
    expect(MISSILE_SrvDo01_FastcallThunk113c(m, pGame, pRay0)).toBe(1)
    expect(MISSILE_SrvDo01_LinearProjectile113c(m, pRay0, pGame)).toBe(1)
    expect(MISSILE_ProcessTargetCollisionHit113c(m, pRay0, pGame, pFallen, 0)).toBe(1) // blocked by NextDelay 0x56!
    MISSILE_ApplyNextHitDelayState113c(m, pRay0, pFallen)
    const pZeroDmg = m.alloc(D2DamageStrc_SIZE)
    MISSILE_ApplyDamageStrcToTarget113c(m, pZeroDmg, pGame, pRay0, pFallen)

    // 3. Tick DoT frame 1 (60 HP -> 25 HP, queues 0xAB life notify!)
    m.set(pGame, D2GameStrc.dwGameFrame, 101)
    MONSTER_Event03_RegenAndPoisonTick113c(m, pGame, pFallen)
    expect(STATLIST_GetUnitStat113c(m, pFallen, 0x06, 0)).toBe(25 << 8)
    expect(m.u32((pFallen + 0xec) >>> 0)).not.toBe(0) // 0xAB queued!
    expect(m.get(pFallen, D2UnitStrc.dwAnimMode)).toBe(1) // still alive

    // 4. Advance to frame 105 -> expire NextDelay (0x56) via Event 12 while Poison (expires at 110) stays active!
    m.set(pGame, D2GameStrc.dwGameFrame, 105)
    MONSTER_Event12_ExpireTimedStats113c(m, pGame, pFallen)
    expect(STATES_CheckState113c(m, pFallen, 0x56)).toBe(0)
    expect(STATES_CheckState113c(m, pFallen, 0x02)).not.toBe(0)

    // 5. Tick DoT frame 2 (25 HP -> 0 HP -> kills Fallen via poison killer attribution!)
    MONSTER_Event03_RegenAndPoisonTick113c(m, pGame, pFallen)
    expect(STATLIST_GetUnitStat113c(m, pFallen, 0x06, 0)).toBe(0)
    expect(m.get(pFallen, D2UnitStrc.dwAnimMode)).toBe(0) // transitioned to death mode!
    expect((m.get(pFallen, D2UnitStrc.dwFlags) & 0x10000) !== 0).toBe(true)

    // 6. Advance to frame 111 -> expire Poison (2) via Event 12!
    m.set(pGame, D2GameStrc.dwGameFrame, 111)
    MONSTER_Event12_ExpireTimedStats113c(m, pGame, pFallen)
    expect(STATLIST_GetUnitStat113c(m, pFallen, 0x4a, 0)).toBe(0)
    expect(STATES_CheckState113c(m, pFallen, 0x02)).toBe(0)
  })
})

function SUNIT_GetServerUnitFromList(
  units: readonly number[],
  m: SparseMemory113c,
  guid: number,
): number {
  for (const u of units) {
    if (m.get(u, D2UnitStrc.dwUnitId) === (guid >>> 0)) return u
  }
  return 0
}
