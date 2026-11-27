import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  INVENTORY_SIGNATURE_113C,
  INVENTORY_SetCursorItem113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import { STATLIST_SetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import { D2GAME_MONUMOD_TABLE_VA_113C } from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts'
import * as w2b1Exports from '../../../src/d2kern-113c/game/k2-w2b1-113c.ts'
import {
  ACT1_IntroStatusFilter_6FC80800_113c,
  ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c,
  ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c,
  ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c,
  ACT1Q4_MarkFlag52_6FC80590_113c,
  ACT1Q4_MarkFlag63_6FC805C0_113c,
  ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c,
  ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c,
  ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c,
  ACT4_EndgameStatusFilter_6FC80810_113c,
  ACT4_IntroCallback08Noop_6FC80180_113c,
  ACT4_IntroStatusFilter_6FC80170_113c,
  ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c,
  ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c,
  ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c,
  ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c,
  ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c,
  ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c,
  ACT5Q3_Callback11_RemovePlayerGuidAndCheckIce_6FC78040_113c,
  ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c,
  ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c,
  ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c,
  ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c,
  ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c,
  ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c,
  ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c,
  ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c,
  ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c,
  ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c,
  ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c,
  ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c,
  ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c,
  ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c,
  ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c,
  ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c,
  AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c,
  ITEMS_IsUniqueItemDisabled_6FC217E0_113c,
  ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c,
  MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c,
  MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c,
  PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c,
  QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
  STORM_TSHashTableAllocUniqueKey_6FC22060_113c,
  STORM_TSListPlacementNewCopy_6FC226F0_113c,
  STORM_TSListPlacementNewDefault_6FC225A0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2GameStrc,
  D2InventoryStrc,
  D2ItemDataStrc,
  D2ItemDataStrc_SIZE,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2MissileDataStrc,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2StatListExStrc_SIZE,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function createKernelMem(): {
  m: SparseMemory113c
  pDataTables: number
  pUniqueItemsTxt: number
  pSkillsTxt: number
  pMissilesTxt: number
  pItemsTxt: number
  pLevelsTxt: number
} {
  const m = new SparseMemory113c()
  m.fill(0x6fdd6000, 0x20000, 0)
  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  const pUniqueItemsTxt = m.alloc(16 * 0x14c)
  m.setU32(pDataTables + 0xc24, pUniqueItemsTxt)
  m.setU32(pDataTables + 0xc28, 16)

  const pSkillsTxt = m.alloc(64 * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 64)

  const pMissilesTxt = m.alloc(32 * 0x1a4)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 32)

  const pItemsTxt = m.alloc(16 * D2ItemsTxt_SIZE)
  m.setU32(0x6fdefb94, 16)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(pDataTables + 0xbf8, m.alloc(8 * D2ItemTypesTxt_SIZE))
  m.setU32(pDataTables + 0xbfc, 8)
  m.setU32(pDataTables + 0xc00, 1)
  m.setU32(pDataTables + 0xc04, m.alloc(64))

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, act)
  }

  const pObjectsTxt = m.alloc(500 * 0x1c0)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 500)

  const pAnimDataTable = m.alloc(0x420)
  const pEmptyBucket = m.alloc(16)
  for (let i = 0; i < 256; i++) {
    m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  }
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)

  return {
    m,
    pDataTables,
    pUniqueItemsTxt,
    pSkillsTxt,
    pMissilesTxt,
    pItemsTxt,
    pLevelsTxt,
  }
}

function allocPlayerWithQuests(
  m: SparseMemory113c,
  guid: number,
  nLevelId = 109,
): {
  pPlayer: number
  pPlayerData: number
  pQuestFlags: number
  pClient: number
  pRoom: number
} {
  const pPlayer = m.alloc(0x100)
  const pPlayerData = m.alloc(0x100)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  const pClient = m.alloc(0x240)
  const pDynPath = m.alloc(0x40)
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
  const pLevel = m.alloc(D2DrlgLevelStrc_SIZE)
  const pActFlag = m.alloc(8)

  m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
  m.set(pPlayer, D2UnitStrc.dwUnitId, guid)
  m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData)
  m.set(pPlayer, D2UnitStrc.pPath, pDynPath)
  m.setU32(pDynPath + 0x1c, pRoom)
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, pActFlag)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, nLevelId)

  m.setU32(pPlayerData + 0x10, pQuestFlags)
  m.setU32(pPlayerData + 0x14, pQuestFlags)
  m.setU32(pPlayerData + 0x18, pQuestFlags)
  m.setU32(pPlayerData + 0x9c, pClient)

  return { pPlayer, pPlayerData, pQuestFlags, pClient, pRoom }
}

function attachQuestChain(
  m: SparseMemory113c,
  pGame: number,
  questIds: readonly number[],
): Map<number, { pQuest: number; pQuestDataEx: number }> {
  const pQuestControl = m.alloc(0x40)
  m.setU32(pGame + 0x10f4, pQuestControl)
  const map = new Map<number, { pQuest: number; pQuestDataEx: number }>()
  let prev = 0
  for (const qId of questIds) {
    const pQuest = m.alloc(0x100)
    const pQuestDataEx = m.alloc(0x180)
    m.setU32(pQuest, qId)
    m.setU8(pQuest + 0x09, 1)
    m.setU32(pQuest + 0x18, pQuestDataEx)
    if (prev === 0) {
      m.setU32(pQuestControl, pQuest)
    } else {
      m.setU32(prev + 0xf4, pQuest)
    }
    prev = pQuest
    map.set(qId, { pQuest, pQuestDataEx })
  }
  return map
}

describe('K2 Wave 2 Batch 1 (w2b1: 45 functions across 0x6FC217E0..0x6FC80810)', () => {
  it('exports all 45 functions with exact _6FCXXXXX_113c naming', () => {
    const fnNames = Object.entries(w2b1Exports)
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k)
    expect(fnNames.length).toBe(45)
    for (const name of fnNames) {
      expect(name).toMatch(/_6FC[0-9A-F]{5}_113c$/)
    }
  })

  it('verifies ITEMS_IsUniqueItemDisabled_6FC217E0_113c and ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c', () => {
    const { m, pUniqueItemsTxt } = createKernelMem()

    expect(ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, 0)).toBe(0)

    const pNonItem = m.alloc(0x80)
    m.setU32(pNonItem, 1)
    expect(ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, pNonItem)).toBe(0)

    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(D2ItemDataStrc_SIZE)
    m.set(pItem, D2UnitStrc.dwUnitType, 4)
    m.set(pItem, D2UnitStrc.pUnitData, pItemData)
    m.set(pItemData, D2ItemDataStrc.dwQuality, 4) // magic, not unique (7)
    expect(ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, pItem)).toBe(0)

    m.set(pItemData, D2ItemDataStrc.dwQuality, 7)
    m.set(pItemData, D2ItemDataStrc.dwItemCell, -1)
    expect(ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, pItem)).toBe(0)

    m.set(pItemData, D2ItemDataStrc.dwItemCell, 999) // out of bounds
    expect(ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, pItem)).toBe(0)

    m.set(pItemData, D2ItemDataStrc.dwItemCell, 3)
    const pRec3 = pUniqueItemsTxt + 3 * 0x14c
    m.setU8(pRec3 + 0x2c, 0x00)
    expect(ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, pItem)).toBe(0)

    m.setU8(pRec3 + 0x2c, 0x04) // bit 2 set
    expect(ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, pItem)).toBe(1)

    // 0x6FC2E7E0: ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c
    const pOwner = m.alloc(0x100)
    const pInv = m.alloc(0x40)
    m.set(pOwner, D2UnitStrc.pInventory, pInv)
    m.set(pInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)
    INVENTORY_SetCursorItem113c(m, pInv, pItem)
    expect(m.get(pInv, D2InventoryStrc.pCursorItem)).toBe(pItem)

    ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(m, pOwner, pItem)
    expect(m.get(pInv, D2InventoryStrc.pCursorItem)).toBe(0)
  })

  it('verifies Storm TSHashTable key allocation (0x6FC22060) and TSList SEH placement constructors (0x6FC225A0, 0x6FC226F0)', () => {
    const { m } = createKernelMem()

    const pHash = m.alloc(0x60)
    const pBuckets = m.alloc(4 * 12)
    m.setU32(pHash + 0x1c, pBuckets)
    m.setU32(pHash + 0x24, 3) // mask = 3

    // Normal sequential increments without wraparound
    expect(STORM_TSHashTableAllocUniqueKey_6FC22060_113c(m, pHash)).toBe(1)
    expect(STORM_TSHashTableAllocUniqueKey_6FC22060_113c(m, pHash)).toBe(2)
    expect(m.u32(pHash + 0x4c)).toBe(0)

    // Force wraparound through 0xffffffff -> 0 -> sets +0x4c = 1 and probes bucket 1
    const pExistingNode1 = m.alloc(0x20)
    m.setU32(pExistingNode1, 1) // key 1 is already in bucket 1
    m.setU32(pExistingNode1 + 4, 0)
    m.setU32(pExistingNode1 + 8, 0)
    m.setU32(pBuckets + 1 * 12, 4) // linkOffset = 4
    m.setU32(pBuckets + 1 * 12 + 8, pExistingNode1)
    m.setU32(pBuckets + 2 * 12 + 8, 0) // bucket 2 empty

    m.setU32(pHash + 0x48, 0xffffffff)
    expect(STORM_TSHashTableAllocUniqueKey_6FC22060_113c(m, pHash)).toBe(2)
    expect(m.u32(pHash + 0x4c)).toBe(1)

    // 0x6FC225A0: STORM_TSListPlacementNewDefault_6FC225A0_113c
    expect(STORM_TSListPlacementNewDefault_6FC225A0_113c(m, 0)).toBe(0)
    const pListA = m.alloc(16)
    expect(STORM_TSListPlacementNewDefault_6FC225A0_113c(m, pListA)).toBe(pListA)
    expect(m.u32(pListA)).toBe(0xdddddddd)
    expect(m.u32(pListA + 4)).toBe((pListA + 4) >>> 0)
    expect(m.u32(pListA + 8)).toBe(~(pListA + 4) >>> 0)

    // 0x6FC226F0: STORM_TSListPlacementNewCopy_6FC226F0_113c
    const pProto = m.alloc(16)
    m.setU32(pProto, 0x18)
    expect(STORM_TSListPlacementNewCopy_6FC226F0_113c(m, 0, pProto)).toBe(0)
    const pListB = m.alloc(16)
    expect(STORM_TSListPlacementNewCopy_6FC226F0_113c(m, pListB, pProto)).toBe(pListB)
    expect(m.u32(pListB)).toBe(0x18)
    expect(m.u32(pListB + 4)).toBe((pListB + 4) >>> 0)
    expect(m.u32(pListB + 8)).toBe(~(pListB + 4) >>> 0)
  })

  it('verifies AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c and MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c', () => {
    const { m } = createKernelMem()
    const pGame = m.alloc(0x1200)
    m.setU32(pGame + 0x1c, 0x12340000)
    const pMonReg0 = m.alloc(0x300)
    m.setU32(pGame + 0xf0, pMonReg0)

    // Guard branches for 0x6FC41210
    AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c(m, pGame, 0, 10, 1, 1, 1, 0)
    const pPlayer = m.alloc(0x80)
    m.setU32(pPlayer, 0)
    AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c(m, pGame, pPlayer, 10, 1, 1, 1, 0)

    const pMonster = m.alloc(0x100)
    const pMonData = m.alloc(0x80)
    const pAiGeneral = m.alloc(0x50)
    m.setU32(pMonster, 1)
    m.setU32(pMonster + 0x14, pMonData)
    m.setU32(pMonData + 0x28, pAiGeneral)

    const pMin1 = m.alloc(8)
    const pMin2 = m.alloc(8)
    m.setU32(pMin1, 101)
    m.setU32(pMin1 + 4, pMin2)
    m.setU32(pMin2, 102)
    m.setU32(pMin2 + 4, 0)
    m.setU32(pAiGeneral + 0x34, pMin1)

    const pNewList = m.alloc(8)
    const freedNodes: number[] = []
    AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c(
      m,
      pGame,
      pMonster,
      777,
      1,
      1,
      1,
      pNewList,
      {
        onFreePoolMem: (_m, _pool, ptr) => {
          freedNodes.push(ptr)
        },
      },
    )
    expect(freedNodes).toEqual([pMin1, pMin2])
    expect(m.u8(pAiGeneral + 0x08) & 0x03).toBe(0x03)
    expect(m.u32(pAiGeneral + 0x28)).toBe(pGame)
    expect(m.u32(pAiGeneral + 0x2c)).toBe(777)
    expect(m.u32(pAiGeneral + 0x30)).toBe(1)
    expect(m.u32(pAiGeneral + 0x34)).toBe(pNewList)

    // 0x6FC432B0: MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c
    MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, 0, 5, pGame, 1)
    MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pPlayer, 5, pGame, 1)

    m.setU32(pMonster + 0x20, 0x12345678)
    m.setU32(pMonster + 0x24, 0x00000001)
    m.setU32(D2GAME_MONUMOD_TABLE_VA_113C + 1 * 4, 0x6fc43020) // RNDNAME native callback
    m.setU32(D2GAME_MONUMOD_TABLE_VA_113C + 5 * 4, 0x6fc41cd0) // custom hook callback

    // Slot 0: assign UMod 1 with bBoss = 1 -> increments dwUniqueCount, sets 0x08 flag, rolls name seed
    MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pMonster, 1, pGame, 1)
    expect(m.u8(pMonData + 0x1c)).toBe(1)
    expect(m.u8(pMonData + 0x16) & 0x08).toBe(0x08)
    expect(m.u32(pMonReg0 + 0x2c8)).toBe(1)
    expect(m.u16(pMonData + 0x14)).not.toBe(0)

    // Slot 1: assign UMod 5 with hook callback
    const calledUMods: Array<{ pfn: number; uMod: number; bBoss: number }> = []
    MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pMonster, 5, pGame, 0, {
      onMonUMod: (_m, pfn, _mon, nUModId, bBoss) => {
        calledUMods.push({ pfn, uMod: nUModId, bBoss })
      },
    })
    expect(m.u8(pMonData + 0x1c + 1)).toBe(5)
    expect(calledUMods).toEqual([{ pfn: 0x6fc41cd0, uMod: 5, bBoss: 0 }])

    // Fill all 9 slots and verify 10th is ignored
    for (let i = 2; i < 9; i++) {
      m.setU8(pMonData + 0x1c + i, i + 10)
    }
    MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pMonster, 36, pGame, 0)
    expect(m.u8(pMonData + 0x1c + 8)).toBe(18)
  })

  it('verifies QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c, PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c, and MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c', () => {
    const { m, pMissilesTxt, pSkillsTxt } = createKernelMem()

    const pGame = m.alloc(0x1400)
    m.setU8(pGame + 0x6d, 0)
    const pQuestControl = m.alloc(0x40)
    m.setU8(pQuestControl + 0x20, 0x05)
    m.setU32(pGame + 0x10f4, pQuestControl)

    const { pPlayer, pPlayerData, pQuestFlags, pClient } = allocPlayerWithQuests(m, 11)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 1, 0)

    expect(QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(m, pGame, pPlayer)).toBe(0)
    const pPktNode = m.u32(pClient + 0x1b8)
    expect(pPktNode).not.toBe(0)
    // 0x67 (103B packet 0x28) + 2B (packet 0x89) = 0x69 bytes queued
    expect(m.u32(pPktNode)).toBe(0x69)
    expect(m.u8(pPktNode + 4)).toBe(0x28)
    expect(m.u8(pPktNode + 4 + 0x67)).toBe(0x89)
    expect(m.u8(pPktNode + 4 + 0x68)).toBe(0x05)

    // Non-player unit branch in 0x6FC559C0
    expect(QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(m, pGame, pPlayer)).toBe(0)

    // 0x6FC57AC0: PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c
    expect(PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c(m, 0, pPlayer)).toBe(0)
    expect(PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c(m, pGame, 0)).toBe(0)

    const { pPlayer: pRival } = allocPlayerWithQuests(m, 22)
    m.setU32(pGame + 0x1120 + 0 * 4, pPlayer)
    m.setU32(pPlayer + 0xe4, pRival)

    const pHostileNode = m.alloc(0x18)
    m.setU32(pHostileNode, 22)
    m.setU32(pHostileNode + 0x04, 0x00) // neutral
    m.setU32(pPlayerData + 0x38, pHostileNode)
    expect(PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c(m, pGame, pPlayer)).toBe(0)

    m.setU32(pHostileNode + 0x04, 0x08) // hostile
    expect(PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c(m, pGame, pPlayer)).toBe(1)

    // 0x6FC59600: MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c
    const pOutData = m.alloc(0x80)
    MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c(m, 0, pGame, pOutData)
    expect(m.u32(pOutData + 0x60)).toBe(0)

    const pMissile = m.alloc(0x100)
    const pMissileData = m.alloc(0x40)
    m.set(pMissile, D2UnitStrc.dwUnitType, 3)
    m.set(pMissile, D2UnitStrc.dwClassId, 2)
    m.set(pMissile, D2UnitStrc.pUnitData, pMissileData)
    m.set(pMissileData, D2MissileDataStrc.nSkill, 5)
    m.set(pMissileData, D2MissileDataStrc.nLevel, 4)

    // Case 1: MissilesTxt[2].dwParam1 (+0x78) > 0 -> uses dwParam1 directly
    const pMisRec2 = pMissilesTxt + 2 * 0x1a4
    m.setU32(pMisRec2 + 0x78, 45)
    MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c(m, pMissile, pGame, pOutData)
    expect(m.u32(pOutData + 0x44)).toBe(45)
    expect(m.u32(pOutData + 0x60)).toBe(0x60)

    // Case 2: MissilesTxt[2].dwParam1 <= 0 -> falls back to SkillsTxt[5] linear param1 + (lvl-1)*param2
    m.setU32(pMisRec2 + 0x78, 0)
    const pSkillRec5 = pSkillsTxt + 5 * 0x23c
    m.setU32(pSkillRec5 + 0x148, 20) // param1
    m.setU32(pSkillRec5 + 0x14c, 6) // param2 -> 20 + (4-1)*6 = 38
    MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c(m, pMissile, pGame, pOutData)
    expect(m.u32(pOutData + 0x44)).toBe(38)
    expect(m.u32(pOutData + 0x60)).toBe(0x60)
  })

  it('verifies Act 5 quest callbacks, statue object inits, and prison counters (0x6FC77D80..0x6FC7E7F0)', () => {
    const { m, pItemsTxt } = createKernelMem()
    const pGame = m.alloc(0x1400)
    m.set(pGame, D2GameStrc.dwGameFrame, 100)
    EVENT_InitTimerQueue113c(m, pGame)

    const quests = attachQuestChain(m, pGame, [3, 0x20, 0x22, 0x23])
    const { pPlayer, pQuestFlags, pClient } = allocPlayerWithQuests(m, 301, 109)

    // Setup player inventory with 'ice ' item (0x20656369)
    const pInv = m.alloc(0x40)
    m.set(pPlayer, D2UnitStrc.pInventory, pInv)
    m.set(pInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)
    const pIceItem = m.alloc(0x100)
    const pIceData = m.alloc(D2ItemDataStrc_SIZE)
    m.set(pIceItem, D2UnitStrc.dwUnitType, 4)
    m.set(pIceItem, D2UnitStrc.dwClassId, 1)
    m.set(pIceItem, D2UnitStrc.pUnitData, pIceData)
    m.set(pItemsTxt + 1 * D2ItemsTxt_SIZE, D2ItemsTxt.dwCode, 0x20656369)
    m.setU8(pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x12a, 1)
    m.setU32(pIceItem + 0x5c, m.alloc(D2StatListExStrc_SIZE))
    m.setU32(m.u32(pIceItem + 0x5c) + 0x10, 0x40)
    STATLIST_SetUnitStat113c(m, pIceItem, 0x164, 0, 0)
    m.set(pInv, D2InventoryStrc.pCursorItem, pIceItem)

    // 0x6FC77D80: ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c
    const q3 = quests.get(3)!
    ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c(m, pGame, pPlayer)
    expect(m.u8(q3.pQuestDataEx + 0xe2)).toBe(1)

    // 0x6FC78040: ACT5Q3_Callback11_RemovePlayerGuidAndCheckIce_6FC78040_113c
    m.setU32(q3.pQuest + 0x1c, 301)
    m.setU16(q3.pQuest + 0x1c + 0x80, 1)
    m.setU32(q3.pQuestDataEx, 301)
    m.setU16(q3.pQuestDataEx + 0x80, 1)
    m.setU32(q3.pQuestDataEx + 0xd8, 4)
    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    expect(ACT5Q3_Callback11_RemovePlayerGuidAndCheckIce_6FC78040_113c(m, q3.pQuest, pQuestArg)).toBe(
      pIceItem,
    )
    expect(m.u16(q3.pQuest + 0x1c + 0x80)).toBe(0)
    expect(m.u16(q3.pQuestDataEx + 0x80)).toBe(0)
    expect(m.u32(q3.pQuestDataEx + 0xd8)).toBe(3)

    // 0x6FC787A0: ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c
    m.setU32(q3.pQuest + 0x1c, 301)
    m.setU16(q3.pQuest + 0x1c + 0x80, 1)
    expect(
      ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c(m, q3.pQuest, pQuestArg),
    ).toBe(1)
    expect(m.u16(q3.pQuest + 0x1c + 0x80)).toBe(0)

    // 0x6FC78BA0, 0x6FC78F40, 0x6FC79060, 0x6FC79120, 0x6FC79390, 0x6FC795C0: state 0x0E + 0x5D alerts
    expect(ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0x0e)).toBe(1)

    expect(ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, 0x0e)).toBe(1)

    expect(ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0x0e)).toBe(1)

    expect(ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0x0e)).toBe(1)

    expect(ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 0x0e)).toBe(1)

    expect(ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0x0e)).toBe(1)

    // 0x6FC78DA0: ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c
    const pObj = m.alloc(0x100)
    m.set(pObj, D2UnitStrc.dwUnitType, 2)
    m.set(pObj, D2UnitStrc.dwClassId, 0x1da)
    m.set(pObj, D2UnitStrc.dwUnitId, 888)
    m.set(pObj, D2UnitStrc.pPath, m.alloc(0x20))
    const pOpParam = m.alloc(0x20)
    m.setU32(pOpParam, pGame)
    m.setU32(pOpParam + 0x04, pObj)
    m.setU32(pOpParam + 0x08, pPlayer)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x27, 0)
    expect(ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c(m, pOpParam)).toBe(0)

    // 0x6FC78E50, 0x6FC78EA0, 0x6FC78EF0: Ancient statue object init handlers
    const q23 = quests.get(0x23)!
    m.setU32(q23.pQuestDataEx + 0x34, 2) // slot 1 anim mode = 2 for classId 0x1da
    const pObjInit = m.alloc(0x10)
    m.setU32(pObjInit, pGame)
    m.setU32(pObjInit + 0x04, pObj)

    ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c(m, pObjInit)
    expect(m.u32(q23.pQuestDataEx + 0x1c)).toBe(888)

    ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c(m, pObjInit)
    expect(m.u32(q23.pQuestDataEx + 0x18)).toBe(888)

    ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c(m, pObjInit)
    expect(m.u32(q23.pQuestDataEx + 0x14)).toBe(888)

    // 0x6FC78FF0, 0x6FC792F0, 0x6FC79550: Player speech sound triggers on state 0x0D
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 0x0d)
    expect(ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x52)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 0x0d)
    expect(ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x51)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 0x0d)
    expect(ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x50)

    // 0x6FC79180: ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c
    m.setU32(pClient + 0x1b8, 0)
    m.setU32(pClient + 0x1bc, 0)
    ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c(m, pPlayer)
    const pPkt5D = m.u32(pClient + 0x1b8)
    expect(Array.from(m.readBytes(pPkt5D + 4, 6))).toEqual([0x5d, 0x21, 0x20, 0, 0, 0])

    // 0x6FC79230 & 0x6FC79290: Soldier prison group counters on quest 0x20
    const q20 = quests.get(0x20)!
    const pSoldier = m.alloc(0x100)
    m.set(pSoldier, D2UnitStrc.dwUnitType, 1)
    m.set(pSoldier, D2UnitStrc.dwUnitId, 505)
    m.setU32(q20.pQuestDataEx + 0xb0 + 1 * 0x14 + 2 * 4, 505) // group 1, slot 2

    expect(ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c(m, pGame, pSoldier)).toBe(0)
    for (let k = 1; k <= 5; k++) {
      ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c(m, pGame, pSoldier)
      expect(m.u32(q20.pQuestDataEx + 0x114 + 1 * 4)).toBe(k)
      expect(m.u8(q20.pQuestDataEx + 0x108 + 1)).toBe(k >= 5 ? 1 : 0)
    }
    expect(ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c(m, pGame, pSoldier)).toBe(1)

    // 0x6FC79A60, 0x6FC79AB0, 0x6FC79B00: Object operate sound 0x13 handlers
    m.setU16(pPlayer + 0x6e, 0)
    expect(ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c(m, pOpParam)).toBe(0)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x13)

    m.setU16(pPlayer + 0x6e, 0)
    expect(ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c(m, pOpParam)).toBe(0)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x13)

    m.setU16(pPlayer + 0x6e, 0)
    expect(ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c(m, pOpParam)).toBe(0)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x13)

    const pNullOp = m.alloc(0x10)
    expect(() => ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c(m, pNullOp)).toThrow(
      D2CommonAssertError,
    )

    // 0x6FC7E7F0: ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c
    const q22 = quests.get(0x22)!
    ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c(m, pGame, pSoldier)
    expect(m.get(pSoldier, D2UnitStrc.pEventFirst)).toBe(0)
    m.setU8(q22.pQuestDataEx + 0x87, 1)
    ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c(m, pGame, pSoldier)
    expect(m.get(pSoldier, D2UnitStrc.pEventFirst)).not.toBe(0)
  })

  it('verifies Act 1 Quest 4 state/coord helpers and intro quest filters (0x6FC80170..0x6FC80810)', () => {
    const { m } = createKernelMem()
    const pGame = m.alloc(0x1400)
    const quests = attachQuestChain(m, pGame, [4])
    const q4 = quests.get(4)!

    // 0x6FC80170, 0x6FC80180, 0x6FC80800, 0x6FC80810
    expect(ACT4_IntroStatusFilter_6FC80170_113c(m)).toBe(0)
    ACT4_IntroCallback08Noop_6FC80180_113c(m)
    expect(ACT1_IntroStatusFilter_6FC80800_113c(m)).toBe(0)
    const pOutStatus = m.alloc(4)
    m.setU8(pOutStatus, 0x7f)
    expect(ACT4_EndgameStatusFilter_6FC80810_113c(m, 0, 0, 0, 0, pOutStatus)).toBe(0)
    expect(m.u8(pOutStatus)).toBe(0)

    // 0x6FC80390: ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c
    expect(ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c(m, pGame)).toBe(0)
    m.setU8(q4.pQuestDataEx + 0x93, 1)
    expect(ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c(m, pGame)).toBe(1)

    // 0x6FC803D0: ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c
    ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c(m, pGame)
    expect(m.u8(q4.pQuestDataEx + 0x92)).toBe(1)

    // 0x6FC80400: ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c
    const pStaticObj = m.alloc(0x80)
    const pStaticPath = m.alloc(0x20)
    m.set(pStaticObj, D2UnitStrc.dwUnitType, 2)
    m.set(pStaticObj, D2UnitStrc.pPath, pStaticPath)
    m.setU32(pStaticPath + 0x0c, 5111)
    m.setU32(pStaticPath + 0x10, 5222)

    expect(ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c(m, pGame, pStaticObj)).toBe(1)
    expect(m.u32(q4.pQuestDataEx + 0x9c)).toBe(5111)
    expect(m.u32(q4.pQuestDataEx + 0xa0)).toBe(5222)
    expect(m.u8(q4.pQuestDataEx + 0x67)).toBe(1)
    // Second call returns 0 since +0x67 is already 1
    m.setU32(pStaticPath + 0x0c, 9999)
    expect(ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c(m, pGame, pStaticObj)).toBe(0)
    expect(m.u32(q4.pQuestDataEx + 0x9c)).toBe(5111)

    // 0x6FC80450: ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c
    const pCoords = m.alloc(8)
    m.setU8(q4.pQuestDataEx + 0x95, 0)
    expect(ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c(m, pGame, pStaticObj, pCoords)).toBe(1)
    expect(m.u32(pCoords)).toBe(9999)
    expect(m.u32(pCoords + 4)).toBe(5222)

    m.setU8(q4.pQuestDataEx + 0x95, 1)
    expect(ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c(m, pGame, pStaticObj, pCoords)).toBe(1)
    expect(m.u32(pCoords)).toBe(5111)
    expect(m.u32(pCoords + 4)).toBe(5222)

    // 0x6FC804C0: ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c
    m.setU32(q4.pQuestDataEx + 0xa8, 6001)
    m.setU32(q4.pQuestDataEx + 0xac, 6002)
    m.setU8(q4.pQuestDataEx + 0x96, 1)
    m.setU8(q4.pQuestDataEx + 0x92, 1) // portal already opened -> returns 0
    expect(ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c(m, pGame, pCoords)).toBe(0)
    m.setU8(q4.pQuestDataEx + 0x92, 0)
    expect(ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c(m, pGame, pCoords)).toBe(1)
    expect(m.u32(pCoords)).toBe(6001)
    expect(m.u32(pCoords + 4)).toBe(6002)

    // 0x6FC80590 & 0x6FC805C0
    ACT1Q4_MarkFlag52_6FC80590_113c(m, pGame)
    expect(m.u8(q4.pQuestDataEx + 0x52)).toBe(1)
    ACT1Q4_MarkFlag63_6FC805C0_113c(m, pGame)
    expect(m.u8(q4.pQuestDataEx + 0x63)).toBe(1)

    // 0x6FC805F0: ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c
    const { pPlayer: pNonTristUnit } = allocPlayerWithQuests(m, 401, 4) // Stony Field (4 != 38)
    expect(ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c(m, pGame, pNonTristUnit)).toBe(0)
    const { pPlayer: pTristUnit } = allocPlayerWithQuests(m, 402, 0x26) // Tristram (38)
    expect(ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c(m, pGame, pTristUnit)).toBe(1)
    expect(m.u32(q4.pQuestDataEx + 0x74)).toBe(pTristUnit)
  })
})
