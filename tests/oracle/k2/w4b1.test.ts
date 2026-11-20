import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_GetItemCell113c,
  ITEMS_GetItemQuality113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  PATH_TYPE_FLAGS_6FDE4180,
  PATH_TYPE_STEP_NUMS_6FDE4138,
} from '../../../src/d2kern-113c/common/path.ts'
import { SKILLS_SetParam0C113c } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckState113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import * as w4b1Exports from '../../../src/d2kern-113c/game/k2-w4b1-113c.ts'
import {
  AI_ThinkPackIdlePatrol_6FC373D0_113c,
  AI_ThinkPutridDefiler_6FC389E0_113c,
  GAME_IsGameNameAvailable_6FC4ABD0_113c,
  ITEMS_ApplyLowQualityModsByFormat_6FC34AF0_113c,
  ITEMS_ApplySetItemModsByFormat_6FC341E0_113c,
  ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c,
  ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c,
  ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c,
  ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c,
  ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c,
  ITEMS_RollMagicAffixByFormat_6FC34B50_113c,
  ITEMS_RollRareNameIdByFormat_6FC34B30_113c,
  ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c,
  ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c,
  ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c,
  ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c,
  ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c,
  ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c,
  ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c,
  ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c,
  MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c,
  MONUMOD_ApplyChampionFanaticStats_6FC43810_113c,
  MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c,
  MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c,
  MONUMOD_ApplyColdEnchantedStats_6FC42320_113c,
  MONUMOD_ApplyFireEnchantedStats_6FC42740_113c,
  MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c,
  MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c,
  MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c,
  MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c,
  MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c,
  MONUMOD_RollRandomChampionMod_6FC43AE0_113c,
  MONUMOD_RollRandomUniqueBossMod_6FC43980_113c,
  MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c,
  OBJECTS_OperateGoldChestOrPile_6FC4F580_113c,
  OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c,
  OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c,
  OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c,
  OBJECTS_SpawnPresetBrazierOrTorch244_6FC531B0_113c,
  OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c,
  OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c,
  SKILLS_EndChargeOrLeapMovement_6FC48170_113c,
  SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c,
  SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c,
  STORM_TSListDestroySehWrapper_6FC21F60_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { D2LevelsTxt, D2LevelsTxt_SIZE } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_ITEMS_LINKER_PTR_VA,
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
  SGPT_MAGICAFFIX_TXT_COUNT_VA,
  SGPT_MAGICAFFIX_TXT_PTR_VA,
  SGPT_OBJGROUP_TXT_COUNT_VA,
  SGPT_OBJGROUP_TXT_PTR_VA,
  SGPT_QUALITYITEMS_TXT_COUNT_VA,
  SGPT_QUALITYITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'

function createW4B1World() {
  const m = new SparseMemory113c()
  m.fill(0x6fdd6000, 0x28000, 0)
  m.fill(0x6fd18000, 0x30000, 0)
  m.fill(0x00f0_b000, 0x1000, 0)

  const pDataTables = m.alloc(0x1400)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  const pMonStatsTxt = m.alloc(600 * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 600)
  m.setU32(0x6fdf0950, pMonStatsTxt)
  m.setU32(0x6fdf0958, 600)
  for (let i = 0; i < 600; i++) {
    const rec = pMonStatsTxt + i * 0x1a8
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x18, i)
    m.setU16(rec + 0x56, 10)
    m.setU16(rec + 0x58, 10)
    m.setU16(rec + 0x5a, 10)
  }

  const pMonStats2Txt = m.alloc(600 * 0x134)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 600)

  const pMonLvlTxt = m.alloc(120 * 0x78)
  m.setU32(pDataTables + 0xb70, pMonLvlTxt)
  m.setU32(pDataTables + 0xb74, 120)
  m.setU32(0x6fdf0b54, pMonLvlTxt)
  m.setU32(0x6fdf0b58, 120)
  for (let lvl = 1; lvl < 120; lvl++) {
    for (let col = 0; col < 24; col++) {
      m.setU32(pMonLvlTxt + lvl * 0x78 + col * 4, 100)
    }
  }

  const pSkillsTxt = m.alloc(360 * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 360)
  m.setU32(pDataTables + 0xba8, pSkillsTxt)
  m.setU32(pDataTables + 0xbac, 360)

  const pMissilesTxt = m.alloc(400 * 0x1a4)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 400)
  m.setU32(0x6fdf0a3c, pMissilesTxt)
  m.setU32(0x6fdf0a44, 400)

  const pStatesTxt = m.alloc(200 * 0x3c)
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, 200)
  m.setU32(pDataTables + 0xbc0, pStatesTxt)
  m.setU32(pDataTables + 0xbc8, 200)
  m.setU32(pDataTables + 0x150, m.alloc(32))

  const pObjectsTxt = m.alloc(600 * 0x1c0)
  m.setU32(pDataTables + 0xc98, pObjectsTxt)
  m.setU32(pDataTables + 0xca0, 600)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)
  for (let i = 0; i < 600; i++) {
    const rec = pObjectsTxt + i * 0x1c0
    m.setU32(rec + 0xd0, 1)
    m.setU32(rec + 0xd4, 1)
    m.setU32(rec + 0xdc, 1)
    m.setU32(rec + 0xe0, 1)
  }

  const pObjGroupTxt = m.alloc(32 * 0xb8)
  m.setU32(SGPT_OBJGROUP_TXT_PTR_VA, pObjGroupTxt)
  m.setU32(SGPT_OBJGROUP_TXT_COUNT_VA, 32)

  const pShrinesTxt = m.alloc(32 * 0x108)
  m.setU32(0x6fdf0b9c, pShrinesTxt)
  m.setU32(0x6fdf0ba0, 32)

  const pItemsTxt = m.alloc(64 * 0x1a8)
  m.setU32(pDataTables + 0x00, 64)
  m.setU32(pDataTables + 0x04, pItemsTxt)
  m.setU32(pDataTables + 0xbd8, pItemsTxt)
  m.setU32(pDataTables + 0xbdc, 64)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, 64)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  // Item 1 = 'gld ' (0x20646c67), Item 2 = 'ear ' (0x20726165)
  m.setU32(pItemsTxt + 1 * 0x1a8 + 0x80, 0x20646c67)
  m.setU8(pItemsTxt + 1 * 0x1a8 + 0x14d, 1)
  m.setU32(pItemsTxt + 2 * 0x1a8 + 0x80, 0x20726165)
  m.setU8(pItemsTxt + 2 * 0x1a8 + 0x14d, 1)

  const pLinker = m.alloc(0x10)
  const pLinkerRows = m.alloc(2 * 8)
  m.setU32(pLinker + 0x00, 2)
  m.setU32(pLinker + 0x08, pLinkerRows)
  m.setU32(pLinkerRows + 0x00, 0x20646c67)
  m.setU32(pLinkerRows + 0x04, 1)
  m.setU32(pLinkerRows + 0x08, 0x20726165)
  m.setU32(pLinkerRows + 0x0c, 2)
  m.setU32(SGPT_ITEMS_LINKER_PTR_VA, pLinker)

  const pUniqueItemsTxt = m.alloc(16 * 0x14c)
  m.setU32(pDataTables + 0xc24, pUniqueItemsTxt)
  m.setU32(pDataTables + 0xc28, 16)

  const pMagicAffixTxt = m.alloc(16 * 0x90)
  m.setU32(SGPT_MAGICAFFIX_TXT_COUNT_VA, 0)
  m.setU32(SGPT_MAGICAFFIX_TXT_PTR_VA, pMagicAffixTxt)

  const pQualityItemsTxt = m.alloc(8 * 0x70)
  m.setU32(SGPT_QUALITYITEMS_TXT_COUNT_VA, 0)
  m.setU32(SGPT_QUALITYITEMS_TXT_PTR_VA, pQualityItemsTxt)

  const pItemStatCost = m.alloc(360 * 0x144)
  m.setU32(pDataTables + 0x2c, pItemStatCost)
  m.setU32(pDataTables + 0x34, 360)
  m.setU32(pDataTables + 0xbcc, pItemStatCost)
  m.setU32(pDataTables + 0xbd4, 360)
  m.setU32(0x6fde9e48, pItemStatCost)
  m.setU32(0x6fde9e50, 360)

  const pMonUModTxt = m.alloc(64 * 0x20)
  m.setU32(pDataTables + 0xc50, pMonUModTxt)
  m.setU32(pDataTables + 0xc54, 64)
  for (let i = 0; i < 64; i++) {
    m.setU32(pMonUModTxt + i * 0x20 + 0x1c, 50)
  }

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, 140)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, act)
  }

  const pAnimDataTable = m.alloc(0x420)
  const pEmptyBucket = m.alloc(16)
  for (let i = 0; i < 256; i++) m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)

  const townLevels = [1, 40, 75, 103, 109]
  for (let act = 0; act < 5; act++) m.setU32(0x6fde4084 + act * 4, townLevels[act]!)

  for (let i = 0; i < PATH_TYPE_STEP_NUMS_6FDE4138.length; i++) {
    m.setU32((0x6fde4138 + i * 4) >>> 0, PATH_TYPE_STEP_NUMS_6FDE4138[i]! >>> 0)
  }
  for (let i = 0; i < PATH_TYPE_FLAGS_6FDE4180.length; i++) {
    m.setU32((0x6fde4180 + i * 4) >>> 0, PATH_TYPE_FLAGS_6FDE4180[i]! >>> 0)
  }
  m.fill(0x6fde41c8, 64 * 4, 1)

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

  const pGame = m.alloc(0x1e00)
  m.setU32(pGame + 0x1c, 0x12340000)
  m.setU8(pGame + 0x6d, 1)
  m.setU32(pGame + 0x70, 1)
  m.setU32(pGame + 0xa8, 100)
  m.setU32(pGame + 0xd0, 0x12345678)
  m.setU32(pGame + 0xd4, 0x00000001)
  EVENT_InitTimerQueue113c(m, pGame)

  const pObjRegion = m.alloc(0x600)
  m.setU32(pObjRegion + 0x00, 0x12345678)
  m.setU32(pObjRegion + 0x04, 1)
  m.setU32(pGame + 0x10f0, pObjRegion)

  return {
    m,
    pDataTables,
    pGame,
    pObjRegion,
    pMonStatsTxt,
    pMonLvlTxt,
    pSkillsTxt,
    pMissilesTxt,
    pObjectsTxt,
    pItemsTxt,
    pUniqueItemsTxt,
  }
}

function allocRoom(m: SparseMemory113c, subX = 100, subY = 100, subW = 20, subH = 20, levelId = 2) {
  const pRoom = m.alloc(0x90)
  const pRoomEx = m.alloc(0x80)
  const pLevel = m.alloc(0x200)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x3c, m.alloc(16))
  m.setU32(pRoomEx + 0x58, pLevel)
  m.setU32(pLevel + 0x1d0, levelId)
  m.setU32(pRoom + 0x4c, subX)
  m.setU32(pRoom + 0x50, subY)
  m.setU32(pRoom + 0x54, subW)
  m.setU32(pRoom + 0x58, subH)
  m.setU32(pRoom + 0x6c, 0x13572468)
  m.setU32(pRoom + 0x70, 1)
  const ppNear = m.alloc(8)
  m.setU32(ppNear, pRoom)
  m.setU32(pRoom, ppNear)
  m.setU32(pRoom + 0x24, 1)
  const pCollGrid = m.alloc(0x28)
  const pCollMap = m.alloc(subW * subH * 2)
  m.setU32(pCollGrid + 0x00, subX)
  m.setU32(pCollGrid + 0x04, subY)
  m.setU32(pCollGrid + 0x08, subW)
  m.setU32(pCollGrid + 0x0c, subH)
  m.setU32(pCollGrid + 0x20, pCollMap)
  m.setU32(pRoom + 0x20, pCollGrid)
  return { pRoom, pCollMap, pRoomEx, pLevel }
}

function allocUnitWithStats(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  unitType: number,
  classId: number,
  unitId: number,
  x = 105,
  y = 105,
): number {
  const pUnit = m.alloc(0x100)
  m.setU32(pUnit + 0x00, unitType)
  m.setU32(pUnit + 0x04, classId)
  m.setU32(pUnit + 0x0c, unitId)
  m.setU32(pUnit + 0x20, 0x11223344)
  m.setU32(pUnit + 0x24, 1)
  m.setU32(pUnit + 0x80, pGame)
  const pData = m.alloc(0x80)
  m.setU32(pUnit + 0x14, pData)
  const pPath = m.alloc(0x100)
  m.setU32(pUnit + 0x2c, pPath)
  const pSkills = m.alloc(0x20)
  m.setU32(pUnit + 0xa8, pSkills)
  if (unitType === 2 || unitType === 4) {
    m.setU32(pPath + 0x00, pRoom)
    m.setU32(pPath + 0x0c, x)
    m.setU32(pPath + 0x10, y)
  } else {
    m.setU16(pPath + 0x02, x)
    m.setU16(pPath + 0x06, y)
    m.setU32(pPath + 0x1c, pRoom)
    m.setU32(pPath + 0x30, pUnit)
    if (unitType === 1) {
      const pMonStatsBase = m.u32(m.u32(0x6fde9e1c) + 0xa78)
      m.setU32(pData + 0x00, pMonStatsBase + classId * 0x1a8)
      m.setU32(pData + 0x10, m.alloc(0x48))
      m.setU32(pData + 0x28, m.alloc(0x48))
    }
  }
  STATLIST_CreateEx113c(m, pUnit, 0, pGame)
  SUNIT_InsertServerUnit113c(m, pGame, pUnit)
  return pUnit
}

describe('K2 Wave 4 Batch 1 (45 D2Game.dll VAs 0x6FC21F60..0x6FC531B0)', () => {
  it('exports all 45 functions with _6FCXXXXX_113c naming', () => {
    const fnNames = Object.keys(w4b1Exports).filter((k) => /_6FC[0-9A-F]{5}_113c$/.test(k))
    expect(fnNames).toHaveLength(45)
  })

  it('[1..5] destroys Storm TSList, runs Nihlathak CE & pack-leader mark missile, applies unique mods, and rolls weighted drop classId', () => {
    const { m, pGame, pSkillsTxt, pUniqueItemsTxt } = createW4B1World()
    const { pRoom } = allocRoom(m)

    // [1/45] STORM_TSListDestroySehWrapper_6FC21F60_113c
    const pList = m.alloc(0x10)
    m.setU32(pList + 0x04, pList + 0x04)
    m.setU32(pList + 0x08, ~(pList + 0x04))
    STORM_TSListDestroySehWrapper_6FC21F60_113c(m, pList)
    expect(m.u32(pList + 0x04)).toBe(0)
    expect(m.u32(pList + 0x08)).toBe(0)

    // [2/45] SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c
    const pCaster = allocUnitWithStats(m, pGame, pRoom, 1, 10, 1)
    const pCorpse = allocUnitWithStats(m, pGame, pRoom, 1, 11, 2)
    expect(
      SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c(m, pGame, pCaster, pCorpse, 5),
    ).toBeTypeOf('number')

    // [3/45] SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c
    m.setU16(pSkillsTxt + 10 * 0x23c + 0x48, 5)
    const pMonData = m.u32(pCaster + 0x14)
    const pAiGen = m.u32(pMonData + 0x28)
    m.setU32(pAiGen + 0x28, pGame)
    m.setU32(pAiGen + 0x2c, 1)
    m.setU32(pAiGen + 0x30, 1)
    const pCasterPath = m.u32(pCaster + 0x2c)
    m.setU32(pCasterPath + 0x58, pCorpse)
    expect(SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c(m, pGame, pCaster, 10, 1)).toBe(1)
    expect(STATES_CheckState113c(m, pCorpse, 0x76)).not.toBe(0)

    // [4/45] ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c
    const pItem = allocUnitWithStats(m, pGame, pRoom, 4, 1, 3)
    const pDrop = m.alloc(0x90)
    m.setU32(pDrop + 0x2c, 1)
    m.setU32(pDrop + 0x40, 2)
    m.setU32(pUniqueItemsTxt + 2 * 0x14c + 0x28, 0x20646c67)
    expect(ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c(m, pGame, pItem, pDrop)).toBe(1)
    expect(ITEMS_GetItemCell113c(m, pItem)).toBe(2)

    // [5/45] ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c
    const pSeed = m.alloc(8)
    m.setU32(pSeed + 0x00, 0)
    m.setU32(pSeed + 0x04, 10)
    expect(ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c(m, pSeed, 1, pGame, 0, 1, 0)).toBe(1)
  })

  it('[6..20] handles superior/set/low-quality mods, room item/ear/gold spawners, and magic/rare/crafted affixes', () => {
    const { m, pGame } = createW4B1World()
    const { pRoom } = allocRoom(m)
    const pItem = allocUnitWithStats(m, pGame, pRoom, 4, 1, 10)
    const pItemData = m.u32(pItem + 0x14)
    m.setU16(pItemData + 0x02, 100)

    const ppItem = m.alloc(4)
    m.setU32(ppItem, pItem)
    const pdwSeed = m.alloc(4)
    m.setU32(pdwSeed, 0x12345678)
    const pDrop = m.alloc(0x90)

    // [6/45] ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c
    ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c(m, ppItem, pdwSeed, pDrop)
    expect(ITEMS_GetItemQuality113c(m, pItem)).toBe(3)
    expect(m.u32(pDrop + 0x30)).toBe(3)

    // [7..8/45] ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c & ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c
    expect(() => ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c(m, pItem, pDrop)).toThrow(
      D2CommonAssertError,
    )
    expect(ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c(m, ppItem, pDrop)).toBe(0)

    // [9..13/45] Ground item, ear, and gold pile spawners
    const pCoords = m.alloc(8)
    m.setU32(pCoords + 0x00, 105)
    m.setU32(pCoords + 0x04, 105)
    const pMon = allocUnitWithStats(m, pGame, pRoom, 1, 5, 11)
    expect(
      ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c(m, pCoords, pGame, pRoom, 99, 1, pMon),
    ).toBe(0)
    expect(
      ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c(
        m,
        pGame,
        pRoom,
        pCoords,
        99,
        1,
        pMon,
      ),
    ).toBe(0)
    expect(
      ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c(m, pCoords, pRoom, pGame, 99, 1, pMon),
    ).toBe(0)

    const pPlayer = allocUnitWithStats(m, pGame, pRoom, 0, 0, 12)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 15, 0)
    ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c(m, pPlayer, pGame)
    ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(m, pGame, pMon, 0)

    // [14..20/45] Format-dispatched quality and affix rollers
    expect(ITEMS_ApplySetItemModsByFormat_6FC341E0_113c(m, pItem, pDrop)).toBeTypeOf('number')
    expect(ITEMS_ApplyLowQualityModsByFormat_6FC34AF0_113c(m, pItem, pDrop)).toBeTypeOf('number')
    expect(ITEMS_RollRareNameIdByFormat_6FC34B30_113c(m, pItem, 1)).toBe(0)
    expect(ITEMS_RollMagicAffixByFormat_6FC34B50_113c(m, pItem, 1, 0, 1, 1, 0, 0)).toBe(0)
    expect(ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c(m, pItem, pDrop)).toBe(0)
    expect(ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c(m, pItem, pDrop)).toBe(0)
    expect(ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c(m, pItem, pDrop)).toBe(0)
  })

  it('[21..36] executes AI minion pack/Putrid Defiler thinkers and MONUMOD boss/champion modifiers', () => {
    const { m, pGame, pMonStatsTxt } = createW4B1World()
    const { pRoom } = allocRoom(m)
    const pMon = allocUnitWithStats(m, pGame, pRoom, 1, 10, 20)
    STATLIST_SetUnitStat113c(m, pMon, 0x0c, 10, 0)

    const pAiTickArgs = m.alloc(0x40)
    const pAiCtrl = m.alloc(0x40)
    m.setU32(pAiTickArgs + 0x00, pAiCtrl)
    m.setU32(pAiTickArgs + 0x1c, pMonStatsTxt + 10 * 0x1a8)
    AI_ThinkPackIdlePatrol_6FC373D0_113c(m, pGame, pMon, pAiTickArgs)
    AI_ThinkPutridDefiler_6FC389E0_113c(m, pGame, pMon, pAiTickArgs)

    MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c(m, pMon, 23, 1)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x3e, 0)).toBeGreaterThan(0)
    MONUMOD_ApplyColdEnchantedStats_6FC42320_113c(m, pMon, 18, 1)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x39, 0)).toBeGreaterThan(0)
    MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c(m, pMon, 18, 1)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x36, 0)).toBeGreaterThan(0)
    MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c(m, pMon, 17, 1)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x32, 0)).toBeGreaterThan(0)
    MONUMOD_ApplyFireEnchantedStats_6FC42740_113c(m, pMon, 9, 1)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x30, 0)).toBeGreaterThan(0)

    MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c(m, 5, pMon, 0, 1)
    MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c(m, pMon, pGame, 0)
    MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c(m, pMon, 38, 1)
    MONUMOD_ApplyChampionFanaticStats_6FC43810_113c(m, pMon, 37, 1)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x10, 0)).toBe(-70)
    MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c(m, pMon, 36, 1)
    expect(STATLIST_GetUnitStat113c(m, pMon, 0x24, 0)).toBe(80)

    expect(MONUMOD_RollRandomUniqueBossMod_6FC43980_113c(m, pGame, pMon, 0)).toBe(0)
    expect(MONUMOD_RollRandomChampionMod_6FC43AE0_113c(m, pGame, pMon)).toBe(0)
    MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 0, pRoom, pGame, pMon, 0)
    MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c(m, pGame, pMon, 0, 0)
  })

  it('[37..45] handles charge/leap end, game name check, gold chest operate, and room object spawners', () => {
    const { m, pGame, pObjRegion } = createW4B1World()
    const { pRoom } = allocRoom(m, 100, 100, 20, 20, 2)

    const pUnit = allocUnitWithStats(m, pGame, pRoom, 0, 4, 30)
    const pSkill = m.alloc(0x40)
    SKILLS_SetParam0C113c(m, pSkill, 1)
    expect(SKILLS_EndChargeOrLeapMovement_6FC48170_113c(m, pSkill, 107, pUnit, 0, 0)).toBe(1)
    expect(m.u32(pSkill + 0x0c)).toBe(0)

    const szName = m.alloc(0x20)
    expect(GAME_IsGameNameAvailable_6FC4ABD0_113c(m, szName)).toBe(1)

    const pObj = allocUnitWithStats(m, pGame, pRoom, 2, 50, 31)
    m.setU32(pObj + 0x10, 1)
    const pOpArgs = m.alloc(0x30)
    m.setU32(pOpArgs + 0x04, pObj)
    OBJECTS_OperateGoldChestOrPile_6FC4F580_113c(m, pOpArgs)
    expect(m.u32(pObj + 0x10)).toBe(1)

    const pActCtrl = m.alloc(0x100)
    m.setU32(pObjRegion + 2 * 4 + 0x48, pActCtrl)

    expect(OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c(m, pGame, pRoom, 0)).toBe(1)
    expect(OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c(m, pGame, pRoom, 0)).toBe(1)
    expect(OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c(m, pGame, pRoom, 2, 0, 0)).toBe(0)
    expect(OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c(m, pGame, pRoom, 10, 2, 0)).toBe(0)
    expect(OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c(m, pGame, pRoom, 57, 0)).toBe(0)
    expect(
      OBJECTS_SpawnPresetBrazierOrTorch244_6FC531B0_113c(m, pGame, pRoom, 244, 105, 105),
    ).toBeGreaterThanOrEqual(0)
  })
})
