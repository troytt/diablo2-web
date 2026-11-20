import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  INVENTORY_SIGNATURE_113C,
  INVENTORY_SetCursorItem113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  STATLIST_AllocList113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import * as w3b1Exports from '../../../src/d2kern-113c/game/k2-w3b1-113c.ts'
import {
  AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c,
  AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c,
  AI_ThinkBaalThroneSpawner_6FC35E00_113c,
  AI_ThinkBloodHawk_6FC376B0_113c,
  AI_ThinkBloodLordFrenzy_6FC36270_113c,
  AI_ThinkClawViper_6FC38CE0_113c,
  AI_ThinkDelayedMeleeAttack_6FC38360_113c,
  AI_ThinkDualAttack95Pct_6FC381A0_113c,
  AI_ThinkGiantSpider_6FC377E0_113c,
  AI_ThinkMinionSpawner_6FC37BC0_113c,
  AI_ThinkPainWormSpawner_6FC364A0_113c,
  AI_ThinkPatrolAndAttack_6FC36E30_113c,
  AI_ThinkSandMaggot_6FC38480_113c,
  AI_ThinkThornedHulk_6FC379A0_113c,
  ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c,
  ITEMS_AddStaffModSkillsByTier_6FC335E0_113c,
  ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c,
  ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c,
  ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c,
  ITEMS_ApplyLowQualityItemMods_6FC337F0_113c,
  ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c,
  ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c,
  ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c,
  ITEMS_PopulateItemDropStruct_6FC2E410_113c,
  ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c,
  ITEMS_RollAndApplyUniqueItem_6FC33C20_113c,
  ITEMS_RollAutoMagicAffixId_6FC348A0_113c,
  ITEMS_RollMagicAffixId_6FC344D0_113c,
  ITEMS_RollRarePrefixId_6FC34210_113c,
  ITEMS_RollRareSuffixId_6FC34370_113c,
  ITEMS_RollSpawnableArmorId_6FC2FA30_113c,
  ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c,
  ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c,
  OBJRGN_AllocObjectControl_6FC2B9A0_113c,
  OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c,
  SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c,
  SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c,
  SKILLS_MountImpOnSiegeBeast_6FC2D040_113c,
  SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c,
  SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c,
  SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c,
  SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c,
  SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c,
  SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c,
  STORM_TSListDestroy_6FC21FE0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c.ts'
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
  D2InventoryStrc,
  D2ItemDataStrc,
  D2ItemDataStrc_SIZE,
  D2ItemsTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function createW3B1Mem(): {
  m: SparseMemory113c
  pDataTables: number
  pSkillsTxt: number
  pMissilesTxt: number
  pItemsTxt: number
  pLevelsTxt: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pUniqueItemsTxt: number
  pSetsTxt: number
  pSetItemsTxt: number
} {
  const m = new SparseMemory113c()
  m.fill(0x6fd18000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x28000, 0)
  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  const pSkillsTxt = m.alloc(256 * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 256)
  const pClassSkillCounts = m.alloc(7 * 4)
  const pClassSkillLists = m.alloc(7 * 30 * 2)
  m.setU32(pDataTables + 0xba4, pClassSkillCounts)
  m.setU32(pDataTables + 0xba8, 30)
  m.setU32(pDataTables + 0xbac, pClassSkillLists)

  const pMissilesTxt = m.alloc(64 * 0x1a4)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 64)

  const pStatesTxt = m.alloc(200 * 0x40)
  m.setU32(pDataTables + 0xbbc, pStatesTxt)
  m.setU32(pDataTables + 0xbc0, 200)

  const pItemStatCostTxt = m.alloc(360 * 0x144)
  m.setU32(pDataTables + 0x2c, pItemStatCostTxt)
  m.setU32(pDataTables + 0x34, 360)
  m.setU32(pDataTables + 0xbcc, pItemStatCostTxt)
  m.setU32(pDataTables + 0xbd4, 360)
  m.setU32(0x6fde9e48, pItemStatCostTxt)
  m.setU32(0x6fde9e50, 360)

  const pItemsTxt = m.alloc(16 * D2ItemsTxt_SIZE)
  m.setU32(pDataTables + 0x00, 16)
  m.setU32(pDataTables + 0x04, pItemsTxt)
  m.setU32(pDataTables + 0xbd8, pItemsTxt)
  m.setU32(pDataTables + 0xbdc, 16)
  m.setU32(0x6fdefb94, 16)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(0x6fdefb9c, pItemsTxt) // weapons
  m.setU32(0x6fdefba0, 4)
  m.setU32(0x6fdefba4, pItemsTxt + 4 * D2ItemsTxt_SIZE) // armor
  m.setU32(0x6fdefba8, 4)
  m.setU32(0x6fdefbac, pItemsTxt + 8 * D2ItemsTxt_SIZE) // misc
  m.setU32(0x6fdefbb0, 8)
  m.setU32(pItemsTxt + 9 * D2ItemsTxt_SIZE + 0x80, 0x20646c67) // 'gld '
  m.setU8(pItemsTxt + 9 * D2ItemsTxt_SIZE + 0x14d, 1)
  const pLinker = m.alloc(0x20)
  const pLinkerRows = m.alloc(16)
  m.setU32(pLinker + 0x00, 1)
  m.setU32(pLinker + 0x08, pLinkerRows)
  m.setU32(pLinkerRows + 0x00, 0x20646c67)
  m.setU32(pLinkerRows + 0x04, 9)
  m.setU32(0x6fdeff6c, pLinker) // SGPT_ITEMS_LINKER_PTR_VA

  const fieldDx = [0, 1, 1, 1, 0, -1, -1, -1, 0]
  const fieldDy = [-1, -1, 0, 1, 1, 1, 0, -1, 0]
  for (let i = 0; i < 9; i++) {
    m.setU32((0x6fde9ba0 + i * 4) >>> 0, fieldDx[i]! >>> 0)
    m.setU32((0x6fde9bc4 + i * 4) >>> 0, fieldDy[i]! >>> 0)
  }
  const pFieldData = m.alloc(256 * 256)
  m.fill(pFieldData, 256 * 256, 8)
  m.setU32(0x6fdf1404, pFieldData)
  m.setU32(0x6fdf1414, 128)
  m.setU32(0x6fdf1418, 128)

  const pItemTypesTxt = m.alloc(64 * D2ItemTypesTxt_SIZE)
  m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
  m.setU32(pDataTables + 0xbfc, 64)
  m.setU32(pDataTables + 0xc00, 2)
  const pItemTypesHierarchy = m.alloc(256)
  m.setU32(pDataTables + 0xc04, pItemTypesHierarchy)

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, 140)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, 8)
  for (let lvl = 1; lvl < 140; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, act)
    m.setU8(pLevelsTxt + lvl * D2LevelsTxt_SIZE + 0x03, act)
  }

  const pMonStatsTxt = m.alloc(600 * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 600)

  const pMonStats2Txt = m.alloc(600 * 0x134)
  m.setU32(pDataTables + 0xa84, pMonStats2Txt)
  m.setU32(pDataTables + 0xa8c, 600)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 600)

  for (let id = 0; id < 600; id++) {
    const rec = pMonStatsTxt + id * 0x1a8
    m.setU16(rec, id)
    m.setU16(rec + 0x02, id)
    m.setU16(rec + 0x06, id)
    m.setU16(rec + 0x18, id)
  }

  const pUniqueItemsTxt = m.alloc(16 * 0x14c)
  m.setU32(pDataTables + 0xc24, pUniqueItemsTxt)
  m.setU32(pDataTables + 0xc28, 16)

  const pSetsTxt = m.alloc(8 * 0x128)
  m.setU32(pDataTables + 0xc0c, pSetsTxt)
  m.setU32(pDataTables + 0xc10, 8)

  const pSetItemsTxt = m.alloc(16 * 0x1b8)
  m.setU32(pDataTables + 0xc18, pSetItemsTxt)
  m.setU32(pDataTables + 0xc1c, 16)

  const pObjGroupTxt = m.alloc(4 * 0xb8)
  m.setU32(0x6fdf0b8c, pObjGroupTxt)
  m.setU32(0x6fdf0b90, 4)
  m.setU8(pObjGroupTxt + 0xb2, 2)
  m.setU8(pObjGroupTxt + 0xb8 + 0xb2, 5)

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
    pSkillsTxt,
    pMissilesTxt,
    pItemsTxt,
    pLevelsTxt,
    pMonStatsTxt,
    pMonStats2Txt,
    pUniqueItemsTxt,
    pSetsTxt,
    pSetItemsTxt,
  }
}

describe('K2 Wave 3 Batch 1 (w3b1: 45 functions across 0x6FC21FE0..0x6FC38CE0)', () => {
  it('exports all 45 functions with exact _6FCXXXXX_113c naming', () => {
    const fnNames = Object.entries(w3b1Exports)
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k)
    expect(fnNames.length).toBe(45)
    for (const name of fnNames) {
      expect(name).toMatch(/_6FC[0-9A-F]{5}_113c$/)
    }
  })

  it('verifies [1/45..3/45] STORM_TSListDestroy_6FC21FE0_113c and OBJRGN functions (0x6FC2B510, 0x6FC2B9A0)', () => {
    const { m } = createW3B1Mem()

    const pList = m.alloc(0x20)
    m.setU32(pList, 4)
    m.setU32(pList + 4, ~(pList + 4) >>> 0)
    m.setU32(pList + 8, ~(pList + 4) >>> 0)
    STORM_TSListDestroy_6FC21FE0_113c(m, pList)
    expect(m.u32(pList + 4)).toBe(0)
    expect(m.u32(pList + 8)).toBe(0)

    const pGame = m.alloc(0x2000)
    m.setU32(pGame + 0xd0, 0x12345678)
    m.setU32(pGame + 0xd4, 0x9abcdef0)
    expect(() => OBJRGN_AllocObjectControl_6FC2B9A0_113c(m, 0)).toThrow(D2CommonAssertError)

    const seedLo = OBJRGN_AllocObjectControl_6FC2B9A0_113c(m, pGame)
    expect(seedLo).not.toBe(0)
    const pObjCtrl = m.u32(pGame + 0x10f0)
    expect(pObjCtrl).toBeGreaterThan(0)
    expect(m.u32(pObjCtrl + 0x08 + 2 * 4)).toBe(1)
    expect(m.u32(pObjCtrl + 0x08 + 5 * 4)).toBe(1)

    const pUnit = m.alloc(0x100)
    const pPath = m.alloc(0x40)
    const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
    const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
    const pLevel = m.alloc(D2DrlgLevelStrc_SIZE)
    m.set(pUnit, D2UnitStrc.pPath, pPath)
    m.setU32(pPath + 0x1c, pRoom)
    m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
    m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
    m.set(pLevel, D2DrlgLevelStrc.nLevelId, 2)

    const pMonReg = m.alloc(0x100)
    m.setU8(pMonReg + 0x10, 1)
    m.setU16(pMonReg + 0x14, 0x113) // matches common base 0x112
    m.setU32(pGame + 2 * 4 + 0xf0, pMonReg)

    const pArgs = m.alloc(0x10)
    m.setU32(pArgs, pGame)
    m.setU32(pArgs + 4, pUnit)
    expect(OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c(m, pArgs)).toBe(0x112)
    // Second call uses cached value
    expect(OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c(m, pArgs)).toBe(0x112)
  })

  it('verifies [4/45..12/45] SKILLS summon, impregnate, aura, split-spawn, leech, SiegeBeast mount/dismount, and hose tick', () => {
    const { m, pSkillsTxt, pMissilesTxt, pMonStatsTxt } = createW3B1Mem()

    const pGame = m.alloc(0x2000)
    EVENT_InitTimerQueue113c(m, pGame)

    const pUnit = m.alloc(0x100)
    const pMonData = m.alloc(0x80)
    const pAiGen = m.alloc(0x60)
    const pSkillList = m.alloc(0x20)
    const pSkill = m.alloc(0x40)
    const pPath = m.alloc(0x80)
    const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
    m.set(pUnit, D2UnitStrc.dwUnitType, 1)
    m.set(pUnit, D2UnitStrc.dwClassId, 0x1ec)
    m.set(pUnit, D2UnitStrc.pUnitData, pMonData)
    m.setU32(pMonData, pMonStatsTxt + 0x1ec * 0x1a8)
    m.setU32(pMonData + 0x28, pAiGen)
    m.set(pUnit, D2UnitStrc.pSkills, pSkillList)
    m.setU32(pSkillList + 0x10, pSkill)
    m.set(pUnit, D2UnitStrc.pPath, pPath)
    m.setU32(pPath + 0x1c, pRoom)
    m.setU16(pPath + 0x02, 100)
    m.setU16(pPath + 0x06, 200)

    expect(SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c(m, pGame, pUnit, 10, 1)).toBe(1)
    expect(SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c(m, pGame, pUnit, 10, 1)).toBe(0)

    const pSkill10 = pSkillsTxt + 10 * 0x23c
    m.setU16(pSkill10 + 0x82, 15) // wAuraState
    m.setU16(pSkill10 + 0x48, 5) // wSrvMissileA = 5
    m.setU16(pSkill10 + 0xe6, 12) // wSumOverlay
    m.setU32(pMissilesTxt + 5 * 0x1a4 + 0x3c, 20)

    SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c(m, 10, pUnit, 1, pUnit)
    expect(SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c(m, pGame, pUnit, 10, 1)).toBe(1)
    expect(SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c(m, pGame, pUnit, 10, 1)).toBe(0)
    expect(SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c(m, pGame, pUnit, 10, 1)).toBe(0)

    const pImp = m.alloc(0x100)
    m.set(pImp, D2UnitStrc.dwUnitType, 1)
    m.set(pImp, D2UnitStrc.dwClassId, 0x1b3)
    const pBeastStats = STATLIST_AllocList113c(m, 0, 1, 1, 0, 0)
    m.setU32(pUnit + 0x5c, pBeastStats)
    STATLIST_SetUnitStat113c(m, pUnit, 6, 25600, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 7, 25600, 0)

    SKILLS_MountImpOnSiegeBeast_6FC2D040_113c(m, pUnit, pImp, 1, pGame, 2)
    expect(m.u32(pAiGen)).toBe(0x10)

    SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c(m, pUnit, pImp, pGame, 0)
    expect(m.u32(pAiGen)).toBe(0)

    expect(SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c(m, pGame, pUnit, 10, 1)).toBe(1)
  })

  it('verifies [13/45..20/45] ITEMS drop struct, ground place, unique mark, remove/free, spawnable rolls, and gold pile', () => {
    const { m, pItemsTxt, pUniqueItemsTxt } = createW3B1Mem()

    const pGame = m.alloc(0x2000)
    m.setU32(pGame + 0x70, 1) // expansion

    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(D2ItemDataStrc_SIZE)
    const pStaticPath = m.alloc(0x40)
    const pItemStats = STATLIST_AllocList113c(m, 0, 4, 0, 0, 0)
    m.set(pItem, D2UnitStrc.dwUnitType, 4)
    m.set(pItem, D2UnitStrc.dwClassId, 1)
    m.set(pItem, D2UnitStrc.pUnitData, pItemData)
    m.set(pItem, D2UnitStrc.pPath, pStaticPath)
    m.setU32(pItem + 0x5c, pItemStats)
    m.set(pItemData, D2ItemDataStrc.wItemFormat, 100)
    m.set(pItemData, D2ItemDataStrc.dwItemLevel, 25)
    m.set(pItemData, D2ItemDataStrc.dwQuality, 4)
    m.set(pItemData, D2ItemDataStrc.dwItemCell, 2)
    m.setU16(pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x11e, 4) // wType1 = ITEMTYPE_GOLD (4)
    STATLIST_SetUnitStat113c(m, pItem, 0x0e, 500, 0)

    const pDrop = m.alloc(0x90)
    ITEMS_PopulateItemDropStruct_6FC2E410_113c(m, pDrop, pItem, 0)
    expect(m.u16(pDrop + 0x2a)).toBe(100)
    expect(m.u32(pDrop + 0x0c)).toBe(25)
    expect(m.u32(pDrop + 0x34)).toBe(500)
    expect(m.u32(pDrop + 0x40)).toBe(2)

    const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
    const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
    const pLevel = m.alloc(D2DrlgLevelStrc_SIZE)
    const ppNear = m.alloc(8)
    m.setU32(ppNear, pRoom)
    m.setU32(pRoom, ppNear)
    m.setU32(pRoom + 0x24, 1)
    m.setU32(pRoom + 0x3c, m.alloc(16))
    const pCollGrid = m.alloc(0x28)
    const pCollMap = m.alloc(100 * 100 * 2)
    m.setU32(pCollGrid + 0x08, 100)
    m.setU32(pCollGrid + 0x0c, 100)
    m.setU32(pCollGrid + 0x20, pCollMap)
    m.setU32(pRoom + 0x20, pCollGrid)
    m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
    m.setU32(pRoom + 0x54, 100)
    m.setU32(pRoom + 0x58, 100)
    m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
    m.set(pLevel, D2DrlgLevelStrc.nLevelId, 1)
    EVENT_InitTimerQueue113c(m, pGame)
    ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(m, 50, pItem, pRoom, pGame, 0, 40)
    expect(m.u32(pItem + 0x10)).toBe(3)
    expect(m.u8(pItemData + 0x45)).toBe(0xff)

    // [15/45] ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c
    m.set(pItemData, D2ItemDataStrc.dwQuality, 7)
    const pUnique2 = pUniqueItemsTxt + 2 * 0x14c
    m.setU8(pUnique2 + 0x2c, 0) // bNoLimit = 0
    expect(ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c(m, pGame, pItem)).toBe(1)
    expect(m.u32(pGame + 0x1b24) & (1 << 2)).not.toBe(0)
    // Second spawn of same non-quest unique fails
    expect(ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c(m, pGame, pItem)).toBe(0)

    // [16/45] ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c
    const pPlayer = m.alloc(0x100)
    const pInv = m.alloc(0x40)
    m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
    m.set(pPlayer, D2UnitStrc.pInventory, pInv)
    m.set(pInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)
    INVENTORY_SetCursorItem113c(m, pInv, pItem)
    expect(ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pItem)).toBe(0)

    // [17/45..19/45] Spawnable item rolls
    const pSeed = m.alloc(8)
    m.setU32(pSeed, 0x11223344)
    m.setU32(pSeed + 4, 0x55667788)
    for (let idx of [0, 4, 8]) {
      const pRec = pItemsTxt + idx * D2ItemsTxt_SIZE
      m.setU8(pRec + 0x133, 1) // nSpawnable = 1
      m.setU8(pRec + 0xfc, 1) // nRarity = 1
      m.setU8(pRec + 0xfd, 5) // nLevel = 5
      m.setU16(pRec + 0x11e, 1) // wType = 1
    }
    expect(ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c(m, pGame, pSeed, 10, 1, 1, 1)).toBe(8)
    expect(ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c(m, 1, pGame, pSeed, 10, 1)).toBe(0)
    expect(ITEMS_RollSpawnableArmorId_6FC2FA30_113c(m, 1, pGame, pSeed, 10, 1)).toBe(4)

    // [20/45] ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c
    const pCoords = m.alloc(8)
    m.setU32(pCoords, 10)
    m.setU32(pCoords + 4, 20)
    expect(ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c(m, pCoords, pGame, pRoom)).toBeGreaterThan(0)
  })

  it('verifies [21/45..31/45] ITEMS staffmods, low/high quality, set/unique cell, and rare/magic/automagic affixes', () => {
    const { m, pSkillsTxt, pItemsTxt, pSetsTxt, pSetItemsTxt } = createW3B1Mem()

    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(D2ItemDataStrc_SIZE)
    const pItemStats = STATLIST_AllocList113c(m, 0, 4, 0, 0, 0)
    m.set(pItem, D2UnitStrc.dwUnitType, 4)
    m.set(pItem, D2UnitStrc.dwClassId, 1)
    m.set(pItem, D2UnitStrc.pUnitData, pItemData)
    m.setU32(pItem + 0x5c, pItemStats)
    m.set(pItemData, D2ItemDataStrc.wItemFormat, 100)
    m.set(pItemData, D2ItemDataStrc.dwItemLevel, 30)
    m.setU32(pItemData + 0x0c, 0xabcdef01)
    m.setU32(pItemData + 0x10, 0x12345678)

    const pRec1 = pItemsTxt + 1 * D2ItemsTxt_SIZE
    const dwCode = 0x20647773 // 'swd '
    m.setU32(pRec1 + 0x80, dwCode)
    m.setU8(pRec1 + 0x112, 30) // base durability
    m.setU8(pRec1 + 0x113, 0) // bNoDurability = 0
    STATLIST_SetUnitStat113c(m, pItem, 0x48, 20, 0)
    STATLIST_SetUnitStat113c(m, pItem, 0x49, 20, 0)

    for (let s = 6; s < 40; s++) {
      const pSk = pSkillsTxt + s * 0x23c
      m.setU16(pSk + 0x26, 0)
    }

    ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c(m, pItem, 30, 6, 50)
    ITEMS_AddStaffModSkillsByTier_6FC335E0_113c(m, 30, pItem, 6)

    // Books count ptr for low quality mods
    m.setU32(0x6fdf111c, 4)
    expect(ITEMS_ApplyLowQualityItemMods_6FC337F0_113c(m, pItem)).toBe(0)

    // Set table setup for 0x6FC33A30
    const pSetItem0 = pSetItemsTxt
    m.setU16(pSetItem0, 3) // set item index = 3
    m.setU32(pSetItem0 + 0x28, dwCode)
    m.setU32(pSetItem0 + 0x34, 5) // rarity
    m.setU32(pSetsTxt + 0x0c, 1) // 1 item in set 0
    m.setU32(pSetsTxt + 0x110, pSetItem0)
    m.setU32(0x6fde9e1c, m.u32(0x6fde9e1c))
    m.setU32(m.u32(0x6fde9e1c) + 0xc10, 1)
    expect(ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c(m, pItem)).toBe(1)
    expect(m.get(pItemData, D2ItemDataStrc.dwItemCell)).toBe(3)

    // 0x6FC33C20: SetItems scan with forced index
    const pDrop = m.alloc(0x90)
    m.setU32(pDrop + 0x40, 1) // forced index = 0 (1 - 1)
    expect(ITEMS_RollAndApplyUniqueItem_6FC33C20_113c(m, pItem, pDrop)).toBe(1)
    expect(m.get(pItemData, D2ItemDataStrc.dwItemCell)).toBe(0)
    expect(STATLIST_GetUnitBaseStat113c(m, pItem, 0x48, 0)).toBeGreaterThan(0)
    expect(STATLIST_GetUnitStat113c(m, pItem, 0x48, 0)).toBeGreaterThan(0)

    // 0x6FC33E60 & 0x6FC340B0
    expect(ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c(m, pItem, pDrop)).toBe(0)
    expect(ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c(m, pItem, pDrop)).toBe(0)

    // 0x6FC34210, 0x6FC34370, 0x6FC344D0, 0x6FC348A0
    expect(ITEMS_RollRarePrefixId_6FC34210_113c(m, 1, pItem)).toBe(0)
    expect(ITEMS_RollRareSuffixId_6FC34370_113c(m, 0, pItem)).toBe(0)
    expect(ITEMS_RollMagicAffixId_6FC344D0_113c(m, pItem, 1, 1, 0, 1, 0, 0)).toBe(0)
    expect(ITEMS_RollAutoMagicAffixId_6FC348A0_113c(m, pItem, 1, 1, 0, 1, 0)).toBe(0)
  })

  it('verifies [32/45..45/45] AI target selection callbacks and monster AI thinkers (0x6FC359B0..0x6FC38CE0)', () => {
    const { m, pMonStatsTxt } = createW3B1Mem()

    const pGame = m.alloc(0x2000)
    EVENT_InitTimerQueue113c(m, pGame)
    m.setU32(pGame + 0xa8, 100) // dwGameFrame

    const pUnit = m.alloc(0x100)
    const pMonData = m.alloc(0x80)
    const pAiGen = m.alloc(0x60)
    const pAiCtrl = m.alloc(0x40)
    const pPath = m.alloc(0x80)
    const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
    m.set(pUnit, D2UnitStrc.dwUnitType, 1)
    m.set(pUnit, D2UnitStrc.dwClassId, 10)
    m.set(pUnit, D2UnitStrc.dwUnitId, 7)
    m.set(pUnit, D2UnitStrc.pUnitData, pMonData)
    m.setU32(pMonData + 0x28, pAiGen)
    m.setU32(pMonData + 0x2c, pAiCtrl)
    m.set(pUnit, D2UnitStrc.pPath, pPath)
    m.setU32(pPath + 0x1c, pRoom)
    m.setU16(pPath + 0x02, 50)
    m.setU16(pPath + 0x06, 60)
    const pUnitStats = STATLIST_AllocList113c(m, 0, 1, 7, 0, 0)
    m.setU32(pUnit + 0x5c, pUnitStats)
    STATLIST_SetUnitStat113c(m, pUnit, 6, 12800, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 7, 25600, 0)

    SUNIT_InsertServerUnit113c(m, pGame, pUnit)
    m.setU32(pAiGen + 0x28, pGame)
    m.setU32(pAiGen + 0x2c, 7) // dwLeaderId
    m.setU32(pAiGen + 0x30, 1) // dwLeaderType

    const pAiThinkArg = m.alloc(0x30)
    const pAiParam = m.alloc(0x50)
    const pTarget = m.alloc(0x100)
    const pTargetPath = m.alloc(0x80)
    m.set(pTarget, D2UnitStrc.dwUnitType, 0)
    m.set(pTarget, D2UnitStrc.pPath, pTargetPath)
    m.setU16(pTargetPath + 0x02, 52)
    m.setU16(pTargetPath + 0x06, 62)

    const pMonRec10 = pMonStatsTxt + 10 * 0x1a8
    m.setU16(pMonRec10 + 0x56, 50)
    m.setU16(pMonRec10 + 0x5c, 50)
    m.setU16(pMonRec10 + 0x62, 50)
    m.setU16(pMonRec10 + 0x68, 10)
    m.setU16(pMonRec10 + 0x6e, 10)
    m.setU16(pMonRec10 + 0x74, 10)
    m.setU16(pMonRec10 + 0x170, 0xffff) // -1

    m.setU32(pAiThinkArg, pAiParam)
    m.setU32(pAiThinkArg + 0x08, pTarget)
    m.setU32(pAiThinkArg + 0x14, 5)
    m.setU32(pAiThinkArg + 0x18, 1) // bInMeleeRange = 1
    m.setU32(pAiThinkArg + 0x1c, pMonRec10)

    // [32/45] AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c
    AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c(m, pUnit, pAiThinkArg)
    expect(m.u32(pAiParam + 0x14)).toBe(0)
    expect(m.u32(pAiParam + 0x18)).toBe(0)

    // [33/45] AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c
    const pMaxDistSq = m.alloc(4)
    m.setU32(pMaxDistSq, 100)
    expect(AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c(m, pGame, pUnit, pUnit, pMaxDistSq)).toBe(0)

    // [34/45..45/45] All 12 AI thinkers
    AI_ThinkBaalThroneSpawner_6FC35E00_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkBloodLordFrenzy_6FC36270_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkPainWormSpawner_6FC364A0_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkPatrolAndAttack_6FC36E30_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkBloodHawk_6FC376B0_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkGiantSpider_6FC377E0_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkThornedHulk_6FC379A0_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkMinionSpawner_6FC37BC0_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkDualAttack95Pct_6FC381A0_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkDelayedMeleeAttack_6FC38360_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkSandMaggot_6FC38480_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkClawViper_6FC38CE0_113c(m, pGame, pUnit, pAiThinkArg)

    // Also exercise ranged branch (bInMeleeRange = 0) across thinkers
    m.setU32(pAiThinkArg + 0x18, 0)
    AI_ThinkBloodHawk_6FC376B0_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkGiantSpider_6FC377E0_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkThornedHulk_6FC379A0_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkDualAttack95Pct_6FC381A0_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkDelayedMeleeAttack_6FC38360_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkSandMaggot_6FC38480_113c(m, pGame, pUnit, pAiThinkArg)
    AI_ThinkClawViper_6FC38CE0_113c(m, pGame, pUnit, pAiThinkArg)
  })
})
