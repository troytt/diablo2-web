import { describe, expect, it } from 'vitest'
import { D2COMMON_GDWBITMASKS_IAT_VA_113C, DATATABLES_OFF_113C } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_LinkItemToInventoryList113c,
  INVENTORY_SetCursorItem113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  ITEMS_GetItemCell113c,
  ITEMS_SetItemQuality113c,
  ITEMS_SetMagicPrefix113c,
  ITEMS_SetMagicSuffix113c,
  ITEMS_SetRarePrefix113c,
  ITEMS_SetRareSuffix113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  ITEMS_SetItemCell113c,
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import * as laneIExports from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c.ts'
import {
  AI_CastNextPatrolPointSkill_6FC35F90_113c,
  AI_CountAdjacentUnitsCallback_6FC35590_113c,
  AI_CountNearbyMinion453Or461Callback_6FC35890_113c,
  AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c,
  AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c,
  AI_InitClearFreezeAndStall_6FC36060_113c,
  AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c,
  AI_ThinkMeleeOrApproach7_6FC372B0_113c,
  AI_ThinkSingleStrikeTurret_6FC360B0_113c,
  AI_ThinkSpecialGuard_6FC39640_113c,
  AI_ThinkStaticTrapAttack_6FC36190_113c,
  AI_ThinkTimedExpireOrStall_6FC36410_113c,
  AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c,
  AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c,
  AIGENERAL_ForEachPackMember_6FC41490_113c,
  AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c,
  AIGENERAL_FreeMinionList_6FC40B30_113c,
  ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c,
  ITEMS_CalcDiminishingMfPercent_6FC2E130_113c,
  ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c,
  ITEMS_CheckItemTxtSpawnable_6FC2F180_113c,
  ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c,
  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c,
  ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c,
  ITEMS_FindQuestItemByBaseCode_6FC2E660_113c,
  ITEMS_GetVendorHealthPotionCode_6FC2E390_113c,
  ITEMS_GetVendorManaPotionCode_6FC2E310_113c,
  ITEMS_InitBaseWeaponDamageStats_6FC2E860_113c,
  ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c,
  ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c,
  ITEMS_SpawnItemWithParams_6FC31980_113c,
  ITEMS_TestUniqueSpawnedBit_6FC2E250_113c,
  MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c,
  MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c,
  MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c,
  MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c,
  MONUMOD_ApplyExtraFastVelocity_6FC42880_113c,
  MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c,
  MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c,
  MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c,
  MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c,
  MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c,
  MONUMOD_SetShatterOnDeath_6FC41A70_113c,
  MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c,
  SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c,
} from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
  EVENT_SetEventFull113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemStatCostTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'

interface LaneITestWorld {
  m: SparseMemory113c
  pGame: number
  pDataTables: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pSkillsTxt: number
  pItemsTxt: number
  pItemStatCostTxt: number
  pItemTypesEquiv: number
  pLevelsTxt: number
}

function createLaneITestWorld(): LaneITestWorld {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1200)
  initD2GameGlobalsInMem113c(m, pDataTables)

  // Mirror D2Common gdwBitMasks IAT pointer + D2Game AI dispatch tables (.data)
  const pBitMasks = m.u32(0x6fd18be0)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.fill(0x6fd2e668, 0x120, 0)
  m.fill(0x6fd2e788, 0x94 * 16, 0)

  // MonStatsTxt (600 rows * 0x1A8)
  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec = pMonStatsTxt + i * 0x1a8
    m.setU16(rec + 0x02, i) // wBaseId = i by default
    m.setU16(rec + 0x18, i) // wMonStatsEx = i by default
  }

  // MonStats2Txt (600 rows)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, monStatsCount)

  // SkillsTxt (300 rows * 0x23C)
  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, skillsCount)

  // ItemStatCostTxt (360 rows)
  const iscCount = 360
  const pItemStatCostTxt = m.alloc(iscCount * D2ItemStatCostTxt_SIZE)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt, pItemStatCostTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount, iscCount)

  // ItemsTxt (100 rows)
  const itemsCount = 100
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE)
  m.setU32(SG_ITEM_DATATABLES_VA_113C, itemsCount)
  m.setU32(SG_ITEM_DATATABLES_VA_113C + 4, pItemsTxt)

  // ItemTypes equivalence bitset (64 item types, 2 dwords per row)
  const itemTypesCount = 64
  const equivDwords = 2
  const pItemTypesEquiv = m.alloc(itemTypesCount * equivDwords * 4)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemTypesTxtRecordCount, itemTypesCount)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemTypesEquivDwords, equivDwords)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pItemTypesEquiv, pItemTypesEquiv)
  // Mark itemType i equivalent to itself
  for (let t = 0; t < itemTypesCount; t++) {
    const col = t >> 5
    const bit = 1 << (t & 31)
    m.setU32(pItemTypesEquiv + (t * equivDwords + col) * 4, bit >>> 0)
  }

  // LevelsTxt (140 rows)
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, levelsCount)

  // Game + Timer wheel
  const pGame = m.alloc(0x1df4)
  m.setU32(pGame + 0x1c, 0x12340000) // pMemoryPool
  m.setU32(pGame + 0xa8, 100) // dwGameFrame = 100
  m.setU16(pGame + 0x78, 101) // wItemFormat = 101
  m.setU32(pGame + 0x70, 1) // bExpansion = 1
  EVENT_InitTimerQueue113c(m, pGame)

  return {
    m,
    pGame,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pItemsTxt,
    pItemStatCostTxt,
    pItemTypesEquiv,
    pLevelsTxt,
  }
}

function allocItemUnit(
  m: SparseMemory113c,
  pGame: number,
  classId: number,
  unitId: number,
  quality = 2,
): { pItem: number; pItemData: number; pPath: number } {
  const pItem = m.alloc(0x100)
  const pItemData = m.alloc(0x74)
  const pPath = m.alloc(0x20)
  m.setU32(pItem, 4) // UNIT_ITEM
  m.setU32(pItem + 0x04, classId)
  m.setU32(pItem + 0x0c, unitId)
  m.setU32(pItem + 0x14, pItemData)
  m.setU32(pItem + 0x2c, pPath)
  m.setU32(pItem + 0x80, pGame)
  ITEMS_SetItemQuality113c(m, pItem, quality)
  STATLIST_CreateEx113c(m, pItem, 0, pGame)
  return { pItem, pItemData, pPath }
}

function allocMonsterUnit(
  m: SparseMemory113c,
  pGame: number,
  classId: number,
  unitId: number,
  posX = 100,
  posY = 100,
  levelId = 2,
): {
  pMonster: number
  pMonData: number
  pAiGen: number
  pAiCtrl: number
  pPath: number
  pRoom: number
  pRoomEx: number
} {
  const pMonster = m.alloc(0x100)
  const pMonData = m.alloc(0x60)
  const pAiGen = m.alloc(0x48)
  const pAiCtrl = m.alloc(0x48)
  const pPath = m.alloc(0x100)
  const pSkills = m.alloc(0x20)

  const pRoom = m.alloc(0x100)
  const pRoomEx = m.alloc(0x90)
  const pLevel = m.alloc(0x200)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x4c, posX - 10)
  m.setU32(pRoom + 0x50, posY - 10)
  m.setU32(pRoom + 0x54, 40)
  m.setU32(pRoom + 0x58, 40)
  m.setU32(pRoomEx + 0x58, pLevel)
  m.setU32(pLevel + 0x1d0, levelId)

  m.setU32(pPath + 0x00, posX << 16)
  m.setU32(pPath + 0x04, posY << 16)
  m.setU16(pPath + 0x02, posX)
  m.setU16(pPath + 0x06, posY)
  m.setU32(pPath + 0x1c, pRoom)

  m.setU32(pMonster, 1) // UNIT_MONSTER
  m.setU32(pMonster + 0x04, classId)
  m.setU32(pMonster + 0x0c, unitId)
  m.setU32(pMonster + 0x10, 1) // MONMODE_NEUTRAL
  m.setU32(pMonster + 0x14, pMonData)
  m.setU32(pMonster + 0x20, 12345) // seedLo
  m.setU32(pMonster + 0x24, 666) // seedHi
  m.setU32(pMonster + 0x2c, pPath)
  m.setU32(pMonster + 0x80, pGame)
  m.setU32(pMonster + 0xa8, pSkills)
  m.setU32(pMonster + 0xc4, 0x04) // UNITFLAG_TARGETABLE

  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const pMonStatsBase = pTables !== 0 ? m.u32(pTables + 0xa78) : 0
  if (pMonStatsBase !== 0 && classId >= 0) {
    m.setU32(pMonData, pMonStatsBase + classId * 0x1a8)
  }
  m.setU32(pMonData + 0x28, pAiGen)
  m.setU32(pMonData + 0x2c, pAiCtrl)
  m.setU32(pAiGen + 0x28, pGame)
  m.setU32(pAiGen + 0x2c, 0xffffffff)
  m.setU32(pAiGen + 0x30, 1)

  STATLIST_CreateEx113c(m, pMonster, 1, pGame)
  STATLIST_SetUnitStat113c(m, pMonster, 6, 25600, 0) // HP = 100 << 8
  STATLIST_SetUnitStat113c(m, pMonster, 7, 25600, 0) // MaxHP = 100 << 8
  SUNIT_InsertServerUnit113c(m, pGame, pMonster)

  return { pMonster, pMonData, pAiGen, pAiCtrl, pPath, pRoom, pRoomEx }
}

class BitWriter {
  private readonly bytes: number[] = []
  private bitPos = 0

  writeBits(val: number, width: number): void {
    const u = val >>> 0
    for (let i = 0; i < width; i++) {
      const byteIdx = this.bitPos >> 3
      const bitIdx = this.bitPos & 7
      while (this.bytes.length <= byteIdx) {
        this.bytes.push(0)
      }
      if (((u >>> i) & 1) !== 0) {
        this.bytes[byteIdx] = (this.bytes[byteIdx]! | (1 << bitIdx)) & 0xff
      }
      this.bitPos++
    }
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes)
  }
}

describe('Milestone 33 [K2] Lane K2-I: 45 D2Game SKILLS / ITEMS / AI / MONREG / AIGENERAL / MONUMOD Functions', () => {
  it('exports exact 45 113c-suffixed kernel functions', () => {
    const names = Object.keys(laneIExports)
    expect(names.length).toBe(45)
    for (const name of names) {
      expect(name.endsWith('113c')).toBe(true)
      expect(typeof (laneIExports as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('ports SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c (0x6FC2DE20)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster } = allocMonsterUnit(m, pGame, 1, 10)

    // Schedule two mode events (type 0) and one periodic event (type 3)
    EVENT_SetEventFull113c(m, pGame, pMonster, 0, 105, 0, 0, 0)
    EVENT_SetEventFull113c(m, pGame, pMonster, 3, 120, 0, 0, 0)
    EVENT_SetEventFull113c(m, pGame, pMonster, 0, 108, 0, 0, 0)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 0)).toBe(105)

    SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c(m, pGame, pMonster)
    // All type 0 events freed; type 3 preserved; type 2 scheduled at 100 + 13 = 113
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 0)).toBe(0)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 3)).toBe(120)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(113)
  })

  it('ports ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c (0x6FC2E0A0)', () => {
    const { m, pGame, pItemsTxt } = createLaneITestWorld()

    // Class 1: regular weapon (wType1 = 10, nComponent = 0)
    const rec1 = pItemsTxt + 1 * D2ItemsTxt_SIZE
    m.set(rec1, D2ItemsTxt.nComponent, 0)
    m.set(rec1, D2ItemsTxt.wType1, 10)
    const { pItem: item1 } = allocItemUnit(m, pGame, 1, 1, 2)
    expect(ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, pGame, item1)).toBe(100 + 0x3a98)

    // Magic (4) -> +30000 (0x7530); Unique (7) -> +45000 (0xAFC8)
    ITEMS_SetItemQuality113c(m, item1, 4)
    expect(ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, pGame, item1)).toBe(100 + 0x7530)
    ITEMS_SetItemQuality113c(m, item1, 7)
    expect(ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, pGame, item1)).toBe(100 + 0xafc8)

    // Component byte != 0 -> returns 0 (never expires)
    m.set(rec1, D2ItemsTxt.nComponent, 5)
    expect(ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, pGame, item1)).toBe(0)

    // Gold (wType1 = 4): <= 10000 -> +15000, > 10000 -> +45000
    const recGold = pItemsTxt + 2 * D2ItemsTxt_SIZE
    m.set(recGold, D2ItemsTxt.nComponent, 0)
    m.set(recGold, D2ItemsTxt.wType1, 4)
    const { pItem: goldItem } = allocItemUnit(m, pGame, 2, 2, 2)
    STATLIST_SetUnitStat113c(m, goldItem, 0x0e, 10000, 0)
    expect(ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, pGame, goldItem)).toBe(100 + 0x3a98)
    STATLIST_SetUnitStat113c(m, goldItem, 0x0e, 10001, 0)
    expect(ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, pGame, goldItem)).toBe(100 + 0xafc8)

    // Socket filler (wType1 = 0x35 = 53) -> +30000
    const recGem = pItemsTxt + 3 * D2ItemsTxt_SIZE
    m.set(recGem, D2ItemsTxt.nComponent, 0)
    m.set(recGem, D2ItemsTxt.wType1, 0x35)
    const { pItem: gemItem } = allocItemUnit(m, pGame, 3, 3, 2)
    expect(ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, pGame, gemItem)).toBe(100 + 0x7530)
  })

  it('ports ITEMS_CalcDiminishingMfPercent_6FC2E130_113c (0x6FC2E130)', () => {
    const m = new SparseMemory113c()
    expect(ITEMS_CalcDiminishingMfPercent_6FC2E130_113c(m, 50, 250, 250)).toBe(50)
    expect(ITEMS_CalcDiminishingMfPercent_6FC2E130_113c(m, 110, 250, 250)).toBe(110)
    // MF = 350, factor = 250: ((250 * 250) / (250 + 250)) + 100 = 225
    expect(ITEMS_CalcDiminishingMfPercent_6FC2E130_113c(m, 350, 250, 250)).toBe(225)
    // MF = 600, factor = 500: ((500 * 500) / 1000) + 100 = 350
    expect(ITEMS_CalcDiminishingMfPercent_6FC2E130_113c(m, 600, 500, 500)).toBe(350)
  })

  it('ports ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c (0x6FC2E150) & ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c (0x6FC2E1C0)', () => {
    const { m, pGame } = createLaneITestWorld()
    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    // Missing inventory throws assertion
    expect(() => ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pPlayer, 0)).toThrow()

    const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer)
    m.setU32(pPlayer + 0x60, pInv)
    const { pItem: itemA } = allocItemUnit(m, pGame, 1, 101)
    const { pItem: itemB } = allocItemUnit(m, pGame, 1, 102)
    const { pItem: itemC } = allocItemUnit(m, pGame, 1, 103)

    INVENTORY_LinkItemToInventoryList113c(m, itemA, pInv)
    INVENTORY_SetCursorItem113c(m, pInv, itemB)

    expect(ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pPlayer, itemA)).toBe(1)
    expect(ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pPlayer, itemB)).toBe(1)
    expect(ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pPlayer, itemC)).toBe(0)

    // Override inventory argument takes precedence
    const pAltInv = INVENTORY_AllocInventory113c(m, 0, 0)
    INVENTORY_SetCursorItem113c(m, pAltInv, itemC)
    expect(ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pPlayer, itemC, pAltInv)).toBe(1)

    // Remove itemA from list and itemB from cursor via 0x6FC2E1C0
    ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c(m, pInv, itemA)
    expect(INVENTORY_GetFirstItem113c(m, pInv)).toBe(0)
    expect(ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pPlayer, itemA)).toBe(0)

    ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c(m, pInv, itemB)
    expect(INVENTORY_GetCursorItem113c(m, pInv)).toBe(0)
    expect(ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pPlayer, itemB)).toBe(0)
  })

  it('ports ITEMS_ClearAffixesAndItemCell_6FC2E210_113c (0x6FC2E210)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pItem, pItemData } = allocItemUnit(m, pGame, 1, 10, 6)
    for (let i = 0; i < 3; i++) {
      ITEMS_SetMagicPrefix113c(m, pItem, 100 + i, i)
      ITEMS_SetMagicSuffix113c(m, pItem, 200 + i, i)
    }
    ITEMS_SetRarePrefix113c(m, pItem, 55)
    ITEMS_SetRareSuffix113c(m, pItem, 77)
    ITEMS_SetItemCell113c(m, pItem, 42)

    const ppItem = m.alloc(4)
    m.setU32(ppItem, pItem)
    ITEMS_ClearAffixesAndItemCell_6FC2E210_113c(m, ppItem)

    for (let i = 0; i < 3; i++) {
      expect(m.u16(pItemData + 0x38 + i * 2)).toBe(0)
      expect(m.u16(pItemData + 0x3e + i * 2)).toBe(0)
    }
    expect(m.u16(pItemData + 0x32)).toBe(0)
    expect(m.u16(pItemData + 0x34)).toBe(0)
    expect(ITEMS_GetItemCell113c(m, pItem) | 0).toBe(-1)
  })

  it('ports ITEMS_TestUniqueSpawnedBit_6FC2E250_113c (0x6FC2E250) & ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c (0x6FC2E800)', () => {
    const { m, pGame } = createLaneITestWorld()
    expect(ITEMS_TestUniqueSpawnedBit_6FC2E250_113c(m, 0, 5)).toBe(0)
    expect(ITEMS_TestUniqueSpawnedBit_6FC2E250_113c(m, pGame, -1)).toBe(1)
    expect(ITEMS_TestUniqueSpawnedBit_6FC2E250_113c(m, pGame, 0x1001)).toBe(1)

    // Set bit 37 (dword 1, bit 5)
    m.setU32(pGame + 0x1b24 + 4, 1 << 5)
    expect(ITEMS_TestUniqueSpawnedBit_6FC2E250_113c(m, pGame, 37)).toBe(1 << 5)
    expect(ITEMS_TestUniqueSpawnedBit_6FC2E250_113c(m, pGame, 36)).toBe(0)

    const { pItem } = allocItemUnit(m, pGame, 1, 50, 7) // Unique
    ITEMS_SetItemCell113c(m, pItem, 37)
    expect(ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c(m, pItem, pGame)).toBe(1 << 5)
    expect(ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c(m, pItem, 0)).toBe(0)

    // Non-unique quality returns 0 even if cell bit is set
    ITEMS_SetItemQuality113c(m, pItem, 6)
    expect(ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c(m, pItem, pGame)).toBe(0)
  })

  it('ports ITEMS_GetVendorManaPotionCode_6FC2E310_113c (0x6FC2E310) & ITEMS_GetVendorHealthPotionCode_6FC2E390_113c (0x6FC2E390)', () => {
    const { m, pGame } = createLaneITestWorld()
    // Act 1 (levelId = 1), Normal (diff = 0) -> 'mp1 ' / 'hp1 '
    const { pMonster, pRoomEx } = allocMonsterUnit(m, pGame, 148, 20, 50, 50, 1)
    m.setU8(pGame + 0x6d, 0)
    expect(ITEMS_GetVendorManaPotionCode_6FC2E310_113c(m, pMonster)).toBe(0x2031706d)
    expect(ITEMS_GetVendorHealthPotionCode_6FC2E390_113c(m, pMonster)).toBe(0x20317068)

    // Nightmare (diff = 1) adds +2 -> 'mp3 ' / 'hp3 '
    m.setU8(pGame + 0x6d, 1)
    expect(ITEMS_GetVendorManaPotionCode_6FC2E310_113c(m, pMonster)).toBe(0x2033706d)
    expect(ITEMS_GetVendorHealthPotionCode_6FC2E390_113c(m, pMonster)).toBe(0x20337068)

    // Act 4 (levelId = 103) in Hell (diff = 2) -> act 3 + 2 = 5 >= 4 -> clamps to 'mp4 ' / 'hp4 '
    const pLevel = m.u32(pRoomEx + 0x58)
    m.setU32(pLevel + 0x1d0, 103)
    m.setU8(pGame + 0x6d, 2)
    expect(ITEMS_GetVendorManaPotionCode_6FC2E310_113c(m, pMonster)).toBe(0x2034706d)
    expect(ITEMS_GetVendorHealthPotionCode_6FC2E390_113c(m, pMonster)).toBe(0x20347068)
  })

  it('ports ITEMS_FindQuestItemByBaseCode_6FC2E660_113c (0x6FC2E660)', () => {
    const { m, pGame, pItemsTxt } = createLaneITestWorld()
    const baseCode = 0x20786f62 // 'box '
    const rec = pItemsTxt + 5 * D2ItemsTxt_SIZE
    m.setU32(rec + D2ItemsTxt.dwCode.off, baseCode)
    m.setU8(rec + 0x12a, 1) // bQuest = 1
    m.setU8(rec + 0x12b, 1) // bQuestDiffCheck = 1

    const pPlayer = m.alloc(0x100)
    const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer)
    m.setU32(pPlayer + 0x60, pInv)

    // Item in inventory with quest diff 0 in Hell (diff = 2) -> rejected
    const { pItem: normalCube, pItemData: cubeData } = allocItemUnit(m, pGame, 5, 200)
    m.setU8(cubeData + 0x45, 0) // page 0
    STATLIST_SetUnitStat113c(m, normalCube, 0x164, 0, 0)
    INVENTORY_LinkItemToInventoryList113c(m, normalCube, pInv)

    m.setU8(pGame + 0x6d, 2)
    expect(ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, baseCode)).toBe(0)

    // Upgrade stat 0x164 to 2 -> matched!
    STATLIST_SetUnitStat113c(m, normalCube, 0x164, 2, 0)
    expect(ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, baseCode)).toBe(normalCube)

    // Page 1 item is skipped
    m.setU8(cubeData + 0x45, 1)
    expect(ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, baseCode)).toBe(0)

    // Cursor item takes priority when valid
    const { pItem: cursorCube } = allocItemUnit(m, pGame, 5, 201)
    STATLIST_SetUnitStat113c(m, cursorCube, 0x164, 2, 0)
    INVENTORY_SetCursorItem113c(m, pInv, cursorCube)
    expect(ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, baseCode)).toBe(cursorCube)
  })

  it('ports ITEMS_InitBaseWeaponDamageStats_6FC2E860_113c (0x6FC2E860)', () => {
    const { m, pGame, pItemsTxt } = createLaneITestWorld()
    const rec = pItemsTxt + 7 * D2ItemsTxt_SIZE
    m.setU8(rec + 0xfe, 10) // minDam
    m.setU8(rec + 0xff, 24) // maxDam
    m.setU8(rec + 0x100, 15) // minMisDam
    m.setU8(rec + 0x101, 35) // maxMisDam
    m.setU8(rec + 0x102, 20) // 2handMinDam
    m.setU8(rec + 0x103, 45) // 2handMaxDam

    const { pItem } = allocItemUnit(m, pGame, 7, 300)
    ITEMS_InitBaseWeaponDamageStats_6FC2E860_113c(m, pItem)

    expect(STATLIST_GetUnitStat113c(m, pItem, 0x15, 0)).toBe(10)
    expect(STATLIST_GetUnitStat113c(m, pItem, 0x16, 0)).toBe(24)
    expect(STATLIST_GetUnitStat113c(m, pItem, 0x17, 0)).toBe(20)
    expect(STATLIST_GetUnitStat113c(m, pItem, 0x18, 0)).toBe(45)
    expect(STATLIST_GetUnitStat113c(m, pItem, 0x9f, 0)).toBe(15)
    expect(STATLIST_GetUnitStat113c(m, pItem, 0xa0, 0)).toBe(35)
  })

  it('ports ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c (0x6FC2EAE0)', () => {
    const { m, pGame } = createLaneITestWorld()
    const pHeader = m.alloc(16)
    m.setU32(pHeader, 4) // classId = 4
    m.setU16(pHeader + 4, 80)
    m.setU16(pHeader + 6, 90)
    m.setU8(pHeader + 8, 3)

    const pOutBytes = m.alloc(4)

    // Out-of-range classId writes *pOutBytes = 0 and returns 0
    m.setU32(pHeader, 999)
    m.setU32(pOutBytes, 77)
    expect(ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(m, pGame, pHeader, 0, 0, 0, 1, pOutBytes, 0x56)).toBe(0)
    expect(m.u32(pOutBytes)).toBe(0)

    // Valid compact ear item bitstream ('JM' + ITEMFLAG_COMPACT | ITEMFLAG_EAR)
    m.setU32(pHeader, 4)
    const bw = new BitWriter()
    bw.writeBits(0x4d4a, 16)
    bw.writeBits(0x00210000, 32)
    bw.writeBits(101, 10) // fmt
    bw.writeBits(3, 3) // mode = 3 (on ground)
    bw.writeBits(80, 16) // posX
    bw.writeBits(90, 16) // posY
    bw.writeBits(2, 3) // earClass
    bw.writeBits(55, 7) // earLevel
    bw.writeBits(66, 7) // 'B'
    bw.writeBits(0, 7) // '\0'
    const raw = bw.toUint8Array()
    const pBuf = m.alloc(raw.length + 4)
    m.loadBlock(pBuf, raw)

    const pRoom = m.alloc(0x100)
    const pRoomEx = m.alloc(0x90)
    const pLevel = m.alloc(0x200)
    m.setU32(pRoom + 0x10, pRoomEx)
    m.setU32(pRoomEx + 0x58, pLevel)
    m.setU32(pLevel + 0x1d0, 1)
    m.setU32(pRoom + 0x4c, 60)
    m.setU32(pRoom + 0x50, 60)
    m.setU32(pRoom + 0x54, 80)
    m.setU32(pRoom + 0x58, 80)

    const pLoaded = ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(
      m,
      pGame,
      pHeader,
      pRoom,
      pBuf,
      raw.length,
      1,
      pOutBytes,
      0x56,
    )
    expect(pLoaded).not.toBe(0)
    expect(m.u32(pOutBytes)).toBeGreaterThan(0)
    const pLoadedData = m.u32(pLoaded + 0x14)
    expect((m.u32(pLoadedData + 0x18) & 0x80000) !== 0).toBe(true)

    // Invalid bitstream header frees unit and returns 0
    const pBadBuf = m.alloc(16)
    expect(
      ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(m, pGame, pHeader, pRoom, pBadBuf, 16, 1, pOutBytes, 0x56),
    ).toBe(0)
  })

  it('ports ITEMS_CheckItemTxtSpawnable_6FC2F180_113c (0x6FC2F180)', () => {
    const { m, pItemsTxt } = createLaneITestWorld()
    const rec = pItemsTxt + 8 * D2ItemsTxt_SIZE
    const pSeed = m.alloc(8)
    m.setU32(pSeed, 1)
    m.setU32(pSeed + 4, 666)

    // Not spawnable -> 0
    m.setU8(rec + 0x133, 0)
    expect(ITEMS_CheckItemTxtSpawnable_6FC2F180_113c(m, rec, 10, -1, pSeed, 1)).toBe(0)

    // Spawnable, non-quest, qlvl = 8 <= 10, matching wType = 45
    m.setU8(rec + 0x133, 1)
    m.setU8(rec + 0x12a, 0)
    m.setU8(rec + 0xfd, 8)
    m.setU8(rec + 0xfc, 0)
    m.setU16(rec + 0x11e, 45)
    expect(ITEMS_CheckItemTxtSpawnable_6FC2F180_113c(m, rec, 10, 45, pSeed, 0)).toBe(1)
    expect(ITEMS_CheckItemTxtSpawnable_6FC2F180_113c(m, rec, 10, 46, pSeed, 0)).toBe(0)
    expect(ITEMS_CheckItemTxtSpawnable_6FC2F180_113c(m, rec, 5, -1, pSeed, 1)).toBe(0)
  })

  it('ports ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c (0x6FC30700)', () => {
    const { m, pGame, pItemsTxt } = createLaneITestWorld()
    const rec = pItemsTxt + 9 * D2ItemsTxt_SIZE
    m.set(rec, D2ItemsTxt.nSubType, 1) // has sub-inventory

    const { pItem } = allocItemUnit(m, pGame, 9, 400)
    const pSubInv = INVENTORY_AllocInventory113c(m, 0, pItem)
    m.setU32(pItem + 0x60, pSubInv)
    EVENT_SetEventFull113c(m, pGame, pItem, 3, 150, 0, 0, 0)
    expect(EVENT_GetNextEventFrame113c(m, pItem, 3)).toBe(150)

    ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c(m, pGame, pItem)
    expect(EVENT_GetNextEventFrame113c(m, pItem, 3)).toBe(0)
  })

  it('ports ITEMS_SpawnItemWithParams_6FC31980_113c (0x6FC31980)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster } = allocMonsterUnit(m, pGame, 1, 25)
    let capturedIlvl = 0
    let capturedFlags2 = 0

    const pCreated = ITEMS_SpawnItemWithParams_6FC31980_113c(
      m,
      33,
      1, // bFlag8 -> 8
      1, // bIdentified -> 2
      pMonster,
      6, // classId
      pGame,
      4, // mode
      7, // quality
      1,
      0xdeadbeef,
      0x11223344,
      {
        onCreateItemEx: (mem, game, pDrop) => {
          capturedIlvl = mem.u32(pDrop + 0x0c)
          capturedFlags2 = mem.u32(pDrop + 0x80)
          const { pItem } = allocItemUnit(mem, game, mem.u32(pDrop + 0x14), 501, mem.u32(pDrop + 0x30))
          return pItem
        },
      },
    )
    expect(pCreated).not.toBe(0)
    expect(capturedIlvl).toBe(33)
    expect(capturedFlags2).toBe(0x0a)
    // Command flag 0x10 set on created item
    const pItemData = m.u32(pCreated + 0x14)
    expect((m.u32(pItemData + 0x18) & 0x10) !== 0).toBe(true)

    // Also verify default (non-hooked) creation path with negative nItemLevel clamped to 1
    const pCreatedDefault = ITEMS_SpawnItemWithParams_6FC31980_113c(
      m,
      0,
      0,
      1,
      pMonster,
      6,
      pGame,
      3,
      4,
      0,
      123,
      456,
    )
    expect(pCreatedDefault).not.toBe(0)
    expect(m.u32(m.u32(pCreatedDefault + 0x14) + 0x2c)).toBe(1)
  })

  it('ports AI_CountAdjacentUnitsCallback_6FC35590_113c (0x6FC35590)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster: origin } = allocMonsterUnit(m, pGame, 1, 1, 100, 100)
    const { pMonster: adj } = allocMonsterUnit(m, pGame, 1, 2, 101, 100)
    const { pMonster: far } = allocMonsterUnit(m, pGame, 1, 3, 110, 110)

    const pCtx = m.alloc(12)
    m.setU32(pCtx, origin)

    AI_CountAdjacentUnitsCallback_6FC35590_113c(m, origin, pCtx)
    expect(m.u32(pCtx + 8)).toBe(0)

    AI_CountAdjacentUnitsCallback_6FC35590_113c(m, far, pCtx)
    expect(m.u32(pCtx + 8)).toBe(0)

    AI_CountAdjacentUnitsCallback_6FC35590_113c(m, adj, pCtx)
    expect(m.u32(pCtx + 8)).toBe(1)
    expect(m.u32(pCtx + 4)).toBe(adj)
  })

  it('ports AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c (0x6FC35660)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster: healer } = allocMonsterUnit(m, pGame, 1, 10, 100, 100)
    const { pMonster: ally60 } = allocMonsterUnit(m, pGame, 1, 11, 102, 100)
    const { pMonster: ally30 } = allocMonsterUnit(m, pGame, 1, 12, 103, 100)
    const { pMonster: ally90 } = allocMonsterUnit(m, pGame, 1, 13, 101, 100)

    STATLIST_SetUnitStat113c(m, ally60, 6, 15360, 0) // 60%
    STATLIST_SetUnitStat113c(m, ally30, 6, 7680, 0) // 30%
    STATLIST_SetUnitStat113c(m, ally90, 6, 23040, 0) // 90% (> 75%)

    const pCtx = m.alloc(12)
    m.setU32(pCtx, 0)
    m.setU32(pCtx + 4, 100) // bestLifePct = 100
    m.setU32(pCtx + 8, 100) // maxSqDist = 100

    AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c(m, pGame, healer, ally90, pCtx)
    expect(m.u32(pCtx)).toBe(0)

    AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c(m, pGame, healer, ally60, pCtx)
    expect(m.u32(pCtx)).toBe(ally60)
    expect(m.u32(pCtx + 4)).toBe(60)

    AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c(m, pGame, healer, ally30, pCtx)
    expect(m.u32(pCtx)).toBe(ally30)
    expect(m.u32(pCtx + 4)).toBe(30)
  })

  it('ports AI_CountNearbyMinion453Or461Callback_6FC35890_113c (0x6FC35890)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster: origin } = allocMonsterUnit(m, pGame, 0x1c5, 1, 100, 100)
    const { pMonster: m453 } = allocMonsterUnit(m, pGame, 0x1c5, 2, 102, 100)
    const { pMonster: m461 } = allocMonsterUnit(m, pGame, 0x1cd, 3, 103, 100)
    const { pMonster: mOther } = allocMonsterUnit(m, pGame, 10, 4, 104, 100)

    const pCount = m.alloc(4)
    AI_CountNearbyMinion453Or461Callback_6FC35890_113c(m, pGame, origin, origin, pCount)
    AI_CountNearbyMinion453Or461Callback_6FC35890_113c(m, pGame, origin, mOther, pCount)
    expect(m.u32(pCount)).toBe(0)

    AI_CountNearbyMinion453Or461Callback_6FC35890_113c(m, pGame, origin, m453, pCount)
    AI_CountNearbyMinion453Or461Callback_6FC35890_113c(m, pGame, origin, m461, pCount)
    expect(m.u32(pCount)).toBe(2)
  })

  it('ports AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c (0x6FC358F0)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster: tracker, pAiGen } = allocMonsterUnit(m, pGame, 1, 1, 100, 100)
    const { pMonster: farMon } = allocMonsterUnit(m, pGame, 1, 22, 110, 100)
    const { pMonster: nearMon } = allocMonsterUnit(m, pGame, 1, 33, 103, 100)

    AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c(m, tracker, 0)
    expect(m.u32(pAiGen + 0x14)).toBe(0xffffffff)

    AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c(m, tracker, farMon)
    expect(m.u32(pAiGen + 0x14)).toBe(22)

    AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c(m, tracker, nearMon)
    expect(m.u32(pAiGen + 0x14)).toBe(33)

    // Farther candidate does not overwrite closer tracked GUID
    AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c(m, tracker, farMon)
    expect(m.u32(pAiGen + 0x14)).toBe(33)
  })

  it('ports AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c (0x6FC35BB0)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster, pMonData } = allocMonsterUnit(m, pGame, 1, 50)
    const pInteract = m.alloc(16)
    const pNode = m.alloc(12)
    m.setU32(pMonData + 0x30, pInteract)
    m.setU32(pInteract, pNode)
    m.setU32(pNode, 0x9999) // active player unit pointer

    // Blocked while interacting
    expect(AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c(m, pMonster, pGame)).toBe(0)

    // Clear player interaction -> transitions to death mode (0) and returns 1
    m.setU32(pNode, 0)
    let capturedMode = -1
    expect(
      AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c(m, pMonster, pGame, undefined, {
        onMonsterStartMode: (mem, _g, pModeArgs) => {
          capturedMode = mem.u32(pModeArgs)
          return 1
        },
      }),
    ).toBe(1)
    expect(capturedMode).toBe(0)
  })

  it('ports AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c (0x6FC35C40)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster: overlord } = allocMonsterUnit(m, pGame, 460, 1, 100, 100)
    const { pMonster: minion } = allocMonsterUnit(m, pGame, 0x1c5, 2, 102, 100)
    STATLIST_SetUnitStat113c(m, minion, 6, 10240, 0) // 40% HP

    const pScanCtx = m.alloc(0x20)
    m.setU32(pScanCtx + 0x00, 100) // maxHealSqDist
    m.setU32(pScanCtx + 0x04, 100) // maxWhipSqDist
    m.setU32(pScanCtx + 0x08, 80) // maxHealLifePct

    AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c(m, pGame, overlord, minion, pScanCtx)
    expect(m.u32(pScanCtx + 0x14)).toBe(1)
    expect(m.u32(pScanCtx + 0x0c)).toBe(minion)
    expect(m.u32(pScanCtx + 0x10)).toBe(minion)
  })

  it('ports AI_CastNextPatrolPointSkill_6FC35F90_113c (0x6FC35F90)', () => {
    const { m, pGame, pMonStatsTxt } = createLaneITestWorld()
    const { pMonster, pAiCtrl } = allocMonsterUnit(m, pGame, 12, 60, 100, 100)
    m.setU16(pMonStatsTxt + 12 * 0x1a8 + 0x170, 36) // wSkill1 = 36 (Firebolt)

    const pSaveBlock = m.alloc(16)
    const pEntries = m.alloc(24)
    m.setU32(pSaveBlock, 1) // 1 patrol point
    m.setU32(pSaveBlock + 4, pEntries)
    m.setU32(pEntries + 4, 120) // X
    m.setU32(pEntries + 8, 140) // Y
    m.setU32(pAiCtrl + 0x38, pSaveBlock)

    const pAiArgs = m.alloc(0x20)
    m.setU32(pAiArgs, pAiCtrl)

    let castMode = -1
    const ok = AI_CastNextPatrolPointSkill_6FC35F90_113c(m, pAiArgs, pGame, pMonster, undefined, {
      onMonsterStartMode: (mem, _g, pModeArgs) => {
        castMode = mem.u32(pModeArgs)
        return 1
      },
    })
    expect(ok).toBe(1)
    expect(castMode).toBe(4)
    expect(m.u32(pAiCtrl + 0x14)).toBe(1)
    expect(m.u32(pAiCtrl + 0x18)).toBe(100)

    // Exhausted index resets to 0 after > 700 frames elapsed
    m.setU32(pGame + 0xa8, 900)
    expect(AI_CastNextPatrolPointSkill_6FC35F90_113c(m, pAiArgs, pGame, pMonster)).toBe(0)
    expect(m.u32(pAiCtrl + 0x14)).toBe(0)
  })

  it('ports AI_InitClearFreezeAndStall_6FC36060_113c (0x6FC36060)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster, pAiGen } = allocMonsterUnit(m, pGame, 1, 70)
    STATES_ToggleGfxStateFlag113c(m, pMonster, 0x0c, 1)
    expect(STATES_CheckState113c(m, pMonster, 0x0c)).not.toBe(0)

    const pInitArgs = m.alloc(8)
    m.setU32(pInitArgs, pAiGen)

    AI_InitClearFreezeAndStall_6FC36060_113c(m, pGame, pMonster, pInitArgs)
    expect(STATES_CheckState113c(m, pMonster, 0x0c)).toBe(0)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(101)
  })

  it('ports AI_ThinkSingleStrikeTurret_6FC360B0_113c (0x6FC360B0)', () => {
    const { m, pGame, pMonStats2Txt } = createLaneITestWorld()
    const { pMonster, pAiCtrl } = allocMonsterUnit(m, pGame, 15, 71)
    const { pMonster: target } = allocMonsterUnit(m, pGame, 1, 72)
    m.setU8(pMonStats2Txt + 15 * D2MonStats2Txt_SIZE + 0x104, 1 << 4) // bit 4 -> byte15 = 0x65

    const pAiArgs = m.alloc(0x20)
    m.setU32(pAiArgs, pAiCtrl)
    m.setU32(pAiArgs + 0x08, target)

    // Out of melee range -> stalls 10 frames (110)
    m.setU32(pAiArgs + 0x18, 0)
    AI_ThinkSingleStrikeTurret_6FC360B0_113c(m, pGame, pMonster, pAiArgs)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(110)

    // In melee range -> fires once with byte15 == 0x65 and sets +0x14 = 1
    m.setU32(pAiArgs + 0x18, 1)
    let capturedByte15 = 0
    AI_ThinkSingleStrikeTurret_6FC360B0_113c(m, pGame, pMonster, pAiArgs, undefined, {
      onMonsterStartMode: (mem, _g, pModeArgs) => {
        capturedByte15 = mem.u8(pModeArgs + 0x15)
        return 1
      },
    })
    expect(capturedByte15).toBe(0x65)
    expect(m.u32(pAiCtrl + 0x14)).toBe(1)

    // Subsequent think stalls 50 frames (150)
    AI_ThinkSingleStrikeTurret_6FC360B0_113c(m, pGame, pMonster, pAiArgs)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(150)
  })

  it('ports AI_ThinkStaticTrapAttack_6FC36190_113c (0x6FC36190)', () => {
    const { m, pGame, pMonStatsTxt } = createLaneITestWorld()
    const { pMonster } = allocMonsterUnit(m, pGame, 16, 73)
    const pMonStats = pMonStatsTxt + 16 * 0x1a8
    const pAiArgs = m.alloc(0x20)
    m.setU32(pAiArgs + 0x1c, pMonStats)

    // aip1 = 0 -> roll >= 0 -> stalls 15 frames (115)
    m.setU16(pMonStats + 0x56, 0)
    AI_ThinkStaticTrapAttack_6FC36190_113c(m, pGame, pMonster, pAiArgs)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(115)

    // aip1 = 100 -> roll < 100 -> starts mode 4
    m.setU16(pMonStats + 0x56, 100)
    let startedMode = 0
    AI_ThinkStaticTrapAttack_6FC36190_113c(m, pGame, pMonster, pAiArgs, undefined, {
      onMonsterStartMode: (mem, _g, pModeArgs) => {
        startedMode = mem.u32(pModeArgs)
        return 1
      },
    })
    expect(startedMode).toBe(4)
  })

  it('ports AI_ThinkTimedExpireOrStall_6FC36410_113c (0x6FC36410)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster, pAiCtrl } = allocMonsterUnit(m, pGame, 17, 74)
    const pAiArgs = m.alloc(0x20)
    m.setU32(pAiArgs, pAiCtrl)

    // expireFrame (200) >= gameFrame (100) -> stalls 15 frames
    m.setU32(pAiCtrl + 0x14, 200)
    AI_ThinkTimedExpireOrStall_6FC36410_113c(m, pGame, pMonster, pAiArgs)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(115)

    // expireFrame (50) < gameFrame (100) -> transitions to mode 0 (death)
    m.setU32(pAiCtrl + 0x14, 50)
    let deathMode = -1
    AI_ThinkTimedExpireOrStall_6FC36410_113c(m, pGame, pMonster, pAiArgs, undefined, {
      onMonsterStartMode: (mem, _g, pModeArgs) => {
        deathMode = mem.u32(pModeArgs)
        return 1
      },
    })
    expect(deathMode).toBe(0)
  })

  it('ports AI_ThinkMeleeOrApproach7_6FC372B0_113c (0x6FC372B0)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster } = allocMonsterUnit(m, pGame, 1, 75, 100, 100)
    const { pMonster: target } = allocMonsterUnit(m, pGame, 1, 76, 105, 100)
    const pAiArgs = m.alloc(0x20)
    m.setU32(pAiArgs + 0x08, target)

    // Seed = (0, 1) -> first LCG step lo = 1 (% 100 == 1 < 80) -> melee attack
    m.setU32(pMonster + 0x20, 0)
    m.setU32(pMonster + 0x24, 1)
    m.setU32(pAiArgs + 0x18, 1)
    let modeSeen = 0
    AI_ThinkMeleeOrApproach7_6FC372B0_113c(m, pGame, pMonster, pAiArgs, undefined, {
      onMonsterStartMode: (mem, _g, pModeArgs) => {
        modeSeen = mem.u32(pModeArgs)
        return 1
      },
    })
    expect(modeSeen).toBe(4)

    // Out of melee range with seed (0, 1) (% 100 == 1 < 50) -> approaches target in walk mode (2)
    m.setU32(pMonster + 0x20, 0)
    m.setU32(pMonster + 0x24, 1)
    m.setU32(pAiArgs + 0x18, 0)
    AI_ThinkMeleeOrApproach7_6FC372B0_113c(m, pGame, pMonster, pAiArgs)
    expect(m.u32(pMonster + 0x10)).toBe(2)
  })

  it('ports AI_ThinkSpecialGuard_6FC39640_113c (0x6FC39640)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster, pAiCtrl } = allocMonsterUnit(m, pGame, 1, 80, 100, 100, 2)
    const pAiArgs = m.alloc(0x20)
    m.setU32(pAiArgs, pAiCtrl)

    // Non-neutral mode -> stalls 5 frames (105)
    m.setU32(pMonster + 0x10, 2)
    AI_ThinkSpecialGuard_6FC39640_113c(m, pGame, pMonster, pAiArgs)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(105)

    // Neutral mode with no nearby player and seed producing roll >= 20 -> stalls 10 frames (110)
    m.setU32(pMonster + 0x10, 1)
    m.setU32(pMonster + 0x20, 0)
    m.setU32(pMonster + 0x24, 25)
    AI_ThinkSpecialGuard_6FC39640_113c(m, pGame, pMonster, pAiArgs)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(110)
  })

  it('ports MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c (0x6FC3EC40) & MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c (0x6FC3EE50)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster, pRoom } = allocMonsterUnit(m, pGame, 540, 90, 100, 100, 2)

    // Link an inactive room node at (100, 100) in Act 0 (pGame + 0xD8)
    const pInactRoom = m.alloc(0x18)
    const pInactMon = m.alloc(0x60)
    const pMinionNode = m.alloc(8)
    m.setU32(pInactRoom + 0x00, 100)
    m.setU32(pInactRoom + 0x04, 100)
    m.setU32(pInactRoom + 0x0c, pInactMon)
    m.setU32(pGame + 0xd8, pInactRoom)

    m.setU32(pInactMon + 0x08, 540)
    m.setU8(pInactMon + 0x18, 0x04) // dead flag
    m.setU32(pInactMon + 0x20, pMinionNode)

    // Dead via inactive monster list
    expect(MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c(m, 100, 100, pGame, pRoom, 540)).toBe(1)
    expect(MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c(m, 100, 100, pGame, pRoom, 541)).toBe(0)

    // Delete inactive monster 540 via 0x6FC3EC40
    const freedPtrs: number[] = []
    MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c(m, pGame, 0, 540, {
      onFreePoolMem: (_mem, _pool, ptr) => {
        freedPtrs.push(ptr)
      },
    })
    expect(m.u32(pInactRoom + 0x0c)).toBe(0)
    expect(freedPtrs).toEqual([pMinionNode, pInactMon])
    expect(MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c(m, 100, 100, pGame, pRoom, 540)).toBe(0)

    // Also detects dead active monster in pRoom + 0x74
    m.setU32(pRoom + 0x74, pMonster)
    m.setU32(pMonster + 0x10, 12) // MONMODE_DEAD
    expect(MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c(m, 100, 100, pGame, pRoom, 540)).toBe(1)
  })

  it('ports AIGENERAL_FreeMinionList_6FC40B30_113c (0x6FC40B30), AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c (0x6FC41040), AIGENERAL_ForEachPackMember_6FC41490_113c (0x6FC41490), and AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c (0x6FC41590)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster: boss, pAiGen: bossAiGen } = allocMonsterUnit(m, pGame, 1, 901)
    const { pMonster: min1, pAiGen: min1AiGen } = allocMonsterUnit(m, pGame, 1, 902)
    const { pMonster: min2, pAiGen: min2AiGen } = allocMonsterUnit(m, pGame, 1, 903)

    // Configure boss & minions
    m.setU32(bossAiGen + 0x2c, 901)
    m.setU32(bossAiGen + 0x30, 1)
    m.setU32(min1AiGen + 0x2c, 901)
    m.setU32(min1AiGen + 0x30, 1)
    m.setU32(min2AiGen + 0x2c, 901)
    m.setU32(min2AiGen + 0x30, 1)

    const pNode1 = m.alloc(8)
    const pNode2 = m.alloc(8)
    m.setU32(pNode1, 902)
    m.setU32(pNode1 + 4, pNode2)
    m.setU32(pNode2, 903)
    m.setU32(pNode2 + 4, 0)
    m.setU32(bossAiGen + 0x34, pNode1)

    // 1. AIGENERAL_ForEachPackMember_6FC41490_113c from minion resolves boss and visits [min1, min2]
    expect(() => AIGENERAL_ForEachPackMember_6FC41490_113c(m, min1, 0, 0, 0)).toThrow()
    const visited: number[] = []
    AIGENERAL_ForEachPackMember_6FC41490_113c(m, min1, (_mem, pMember, a1, a2) => {
      visited.push(pMember, a1, a2)
    }, 11, 22)
    expect(visited).toEqual([min1, 11, 22, min2, 11, 22])

    // 2. AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c clears minion leader GUIDs to -1 without freeing list
    AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c(m, bossAiGen)
    expect(m.u32(min1AiGen + 0x2c)).toBe(0xffffffff)
    expect(m.u32(min2AiGen + 0x2c)).toBe(0xffffffff)
    expect(m.u32(bossAiGen + 0x34)).toBe(pNode1)

    // Restore leader GUIDs and run AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c
    m.setU32(min1AiGen + 0x2c, 901)
    m.setU32(min2AiGen + 0x2c, 901)
    const freedBossNodes: number[] = []
    AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c(m, boss, {
      onFreePoolMem: (_mem, _pool, ptr) => {
        freedBossNodes.push(ptr)
      },
    })
    expect(m.u32(min1AiGen + 0x2c)).toBe(0xffffffff)
    expect(m.u32(min2AiGen + 0x2c)).toBe(0xffffffff)
    expect(m.u32(bossAiGen + 0x34)).toBe(0)
    expect(freedBossNodes).toEqual([pNode1, pNode2])

    // 3. AIGENERAL_FreeMinionList_6FC40B30_113c frees standalone list
    const pStandalone = m.alloc(8)
    m.setU32(pStandalone + 4, 0)
    const freedStandalone: number[] = []
    AIGENERAL_FreeMinionList_6FC40B30_113c(m, pGame, pStandalone, {
      onFreePoolMem: (_mem, _pool, ptr) => {
        freedStandalone.push(ptr)
      },
    })
    expect(freedStandalone).toEqual([pStandalone])
  })

  it('ports MONUMOD death/gethit callbacks (0x6FC41A70, 0x6FC41A90, 0x6FC41AD0, 0x6FC41B00, 0x6FC41BB0)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster } = allocMonsterUnit(m, pGame, 1, 950)

    // 0x6FC41A70: only sets STATE_SHATTER (0x6B) when mode == 0
    m.setU32(pMonster + 0x10, 1)
    MONUMOD_SetShatterOnDeath_6FC41A70_113c(m, pGame, pMonster, 0, 1)
    expect(STATES_CheckState113c(m, pMonster, 0x6b)).toBe(0)
    m.setU32(pMonster + 0x10, 0)
    MONUMOD_SetShatterOnDeath_6FC41A70_113c(m, pGame, pMonster, 0, 1)
    expect(STATES_CheckState113c(m, pMonster, 0x6b)).not.toBe(0)

    // 0x6FC41A90: skips non-unique umod 0x12, schedules Event 7 at +4 otherwise
    MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c(m, pGame, pMonster, 0x12, 0)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 7)).toBe(0)
    MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c(m, pGame, pMonster, 0x12, 1)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 7)).toBe(104)

    // 0x6FC41AD0: schedules Event 7 at +2 in GETHIT (mode 3) when bUnique != 0
    const { pMonster: ghMon } = allocMonsterUnit(m, pGame, 1, 951)
    m.setU32(ghMon + 0x10, 3)
    MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c(m, pGame, ghMon, 9, 0)
    expect(EVENT_GetNextEventFrame113c(m, ghMon, 7)).toBe(0)
    MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c(m, pGame, ghMon, 9, 1)
    expect(EVENT_GetNextEventFrame113c(m, ghMon, 7)).toBe(102)

    // 0x6FC41B00: schedules Event 7 at +2 in mode 0 or 3 regardless of bUnique
    const { pMonster: gdMon } = allocMonsterUnit(m, pGame, 1, 952)
    m.setU32(gdMon + 0x10, 2)
    MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c(m, pGame, gdMon, 9, 0)
    expect(EVENT_GetNextEventFrame113c(m, gdMon, 7)).toBe(0)
    m.setU32(gdMon + 0x10, 0)
    MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c(m, pGame, gdMon, 9, 0)
    expect(EVENT_GetNextEventFrame113c(m, gdMon, 7)).toBe(102)

    // 0x6FC41BB0: schedules Event 7 at +4 in mode 0 only when bUnique != 0
    const { pMonster: uqMon } = allocMonsterUnit(m, pGame, 1, 953)
    m.setU32(uqMon + 0x10, 0)
    MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c(m, pGame, uqMon, 5, 0)
    expect(EVENT_GetNextEventFrame113c(m, uqMon, 7)).toBe(0)
    MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c(m, pGame, uqMon, 5, 1)
    expect(EVENT_GetNextEventFrame113c(m, uqMon, 7)).toBe(104)
  })

  it('ports MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c (0x6FC41B30) & MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c (0x6FC41E80)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster } = allocMonsterUnit(m, pGame, 10, 960)
    const pBaseSub = STATLIST_AllocList113c(m, 1, 1, 960)
    STATLIST_SetStat113c(m, pBaseSub, 0x15, 8, 0)
    STATLIST_SetStat113c(m, pBaseSub, 0x16, 15, 0)
    STATLIST_SetStat113c(m, pBaseSub, 0x17, 5, 0)
    STATLIST_SetStat113c(m, pBaseSub, 0x18, 9, 0)
    STATLIST_MergeStatLists113c(m, pMonster, pBaseSub, 1)

    // Rogue merc (0x10F) is skipped
    m.setU32(pMonster + 0x04, 0x10f)
    MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c(m, pGame, pMonster, 0, 1)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 0x15, 0)).toBe(8)

    // Normal monster folds (8 + 5 - 1 = 12, 15 + 9 - 1 = 23)
    m.setU32(pMonster + 0x04, 10)
    MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c(m, pGame, pMonster, 0, 1)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 0x15, 0)).toBe(12)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 0x16, 0)).toBe(23)

    // 0x6FC41E80: +3 level and *5 base experience
    STATLIST_SetUnitStat113c(m, pMonster, 0x0c, 20, 0)
    STATLIST_SetUnitStat113c(m, pMonster, 0x0d, 150, 0)
    MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c(m, pMonster)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0)).toBe(23)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 0x0d, 0)).toBe(750)
  })

  it('ports MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c (0x6FC41EC0) & MONUMOD_ApplyExtraFastVelocity_6FC42880_113c (0x6FC42880)', () => {
    const { m, pGame, pMonStatsTxt } = createLaneITestWorld()
    const { pMonster } = allocMonsterUnit(m, pGame, 20, 970)

    // Branch C: maxLife = 25600, pct = -75 -> 25600 - 19200 = 6400
    MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c(m, pMonster, -75)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 7, 0)).toBe(6400)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 6, 0)).toBe(6400)

    // Branch A: maxLife > 0x100000 (2,000,000), pct = 50 -> 3,000,000
    STATLIST_SetUnitStat113c(m, pMonster, 7, 2000000, 0)
    MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c(m, pMonster, 50)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 7, 0)).toBe(3000000)

    // Branch B: maxLife = 10000, pct = 100000 (> 0x10000) -> 10000 + 10000 * 1000 = 10010000
    STATLIST_SetUnitStat113c(m, pMonster, 7, 10000, 0)
    MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c(m, pMonster, 100000)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 7, 0)).toBe(10010000)

    // 0x6FC42880: wVelocity = 8 -> (2048 / 8) - 128 = 128 -> clamped to 100
    m.setU16(pMonStatsTxt + 20 * 0x1a8 + 0x32, 8)
    MONUMOD_ApplyExtraFastVelocity_6FC42880_113c(m, pMonster)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 0x43, 0)).toBe(100)

    // wVelocity = 15 -> (2048 / 15) - 128 = 136 - 128 = 8 -> clamped to 10 (+100 = 110)
    m.setU16(pMonStatsTxt + 20 * 0x1a8 + 0x32, 15)
    MONUMOD_ApplyExtraFastVelocity_6FC42880_113c(m, pMonster)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 0x43, 0)).toBe(110)
  })

  it('ports MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c (0x6FC42B10)', () => {
    const { m, pGame } = createLaneITestWorld()
    const { pMonster } = allocMonsterUnit(m, pGame, 550, 980, 100, 100, 72)

    // Alive mode != 0 is ignored
    m.setU32(pMonster + 0x10, 1)
    MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c(m, pGame, pMonster, 0, 1)
    expect(STATES_CheckState113c(m, pMonster, 0x68)).toBe(0)

    // Mode 0 spawns class 0x227 (551) in radius 1 and sets STATE_CORPSE_NODRAW (0x68)
    m.setU32(pMonster + 0x10, 0)
    let spawnedClassId = 0
    MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c(m, pGame, pMonster, 0, 1, {
      onMonsterCreate: (_mem, args) => {
        spawnedClassId = args.nClassId
        return 1
      },
    })
    expect(spawnedClassId).toBe(0x227)
    expect(STATES_CheckState113c(m, pMonster, 0x68)).not.toBe(0)
  })
})
