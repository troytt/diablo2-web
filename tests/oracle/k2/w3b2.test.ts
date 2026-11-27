import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
  PATH_TYPE_FLAGS_6FDE4180,
  PATH_TYPE_STEP_NUMS_6FDE4138,
} from '../../../src/d2kern-113c/common/path.ts'
import {
  SKILLS_GetParam3113c,
  SKILLS_GetParam4113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckState113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import * as w3b2Exports from '../../../src/d2kern-113c/game/k2-w3b2-113c.ts'
import {
  AI_SelectAndCastHirelingSkill_6FC3C4E0_113c,
  AI_SpawnPackMinionOrStartMode_6FC3BCA0_113c,
  AI_StepTurnAndCastSkill4_6FC3C1E0_113c,
  AIGENERAL_RemoveFromMinionList_6FC416A0_113c,
  GAME_LookupAndLockGameByKey_6FC4AAE0_113c,
  ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c,
  ITEMS_SaveItemToNodeAndFree_6FC403D0_113c,
  MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c,
  MONUMOD_ApplyChampionBaseStats_6FC418A0_113c,
  MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c,
  MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c,
  MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c,
  MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c,
  MONUMOD_ApplyGhostlyStats_6FC42D00_113c,
  MONUMOD_ApplyResistanceBonus_6FC41BE0_113c,
  MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c,
  MONUMOD_CheckModEligibility_6FC43100_113c,
  MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c,
  MONUMOD_SpawnBossMinionPack_6FC445A0_113c,
  MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c,
  MONUMOD_SpawnDeathNova_6FC46520_113c,
  MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c,
  MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c,
  MONUMOD_SpawnScarabChargedBolts_6FC46320_113c,
  MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c,
  OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c,
  OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c,
  OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c,
  OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c,
  OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c,
  OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c,
  OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c,
  OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c,
  OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c,
  OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c,
  OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c,
  SKILLS_ApplyProgressiveChargeState_6FC48E70_113c,
  SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c,
  SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c,
  SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c,
  SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c,
  SKILLS_SetupChargeOrLeapPath_6FC46A80_113c,
  SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c,
  SKILLS_SrvDo_SpawnCorpseMissile_6FC47C90_113c,
  SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c, EVENT_SetEventFull113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { D2LevelsTxt, D2LevelsTxt_SIZE } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function createW3B2World() {
  const m = new SparseMemory113c()
  m.fill(0x6fdd6000, 0x20000, 0)
  m.fill(0x6fd18000, 0x20000, 0)
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
  }

  const pMonStats2Txt = m.alloc(600 * 0x134)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 600)

  const pMonLvlTxt = m.alloc(120 * 0x78)
  m.setU32(pDataTables + 0xb70, pMonLvlTxt)
  m.setU32(pDataTables + 0xb74, 120)
  m.setU32(0x6fdf0b54, pMonLvlTxt)
  m.setU32(0x6fdf0b58, 120)

  const pSkillsTxt = m.alloc(320 * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 320)
  m.setU32(pDataTables + 0xba8, pSkillsTxt)
  m.setU32(pDataTables + 0xbac, 320)

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

  const pItemStatCostTxt = m.alloc(360 * 0x144)
  m.setU32(pDataTables + 0xbcc, pItemStatCostTxt)
  m.setU32(pDataTables + 0xbd4, 360)

  const pItemsTxt = m.alloc(64 * 0x1a8)
  m.setU32(pDataTables + 0x00, 64)
  m.setU32(pDataTables + 0x04, pItemsTxt)
  m.setU32(0x6fdefb94, 64)
  m.setU32(0x6fdefb98, pItemsTxt)

  const pMonUModTxt = m.alloc(64 * 0x20)
  m.setU32(pDataTables + 0xc50, pMonUModTxt)
  m.setU32(pDataTables + 0xc54, 64)

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, 140)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, act)
  }

  const pObjectsTxt = m.alloc(600 * 0x1c0)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  const pObjGroupTxt = m.alloc(32 * 0xb8)
  m.setU32(0x6fdf0b8c, pObjGroupTxt)
  m.setU32(0x6fdf0b90, 32)

  const pShrinesTxt = m.alloc(32 * 0x108)
  m.setU32(0x6fdf0b9c, pShrinesTxt)
  m.setU32(0x6fdf0ba0, 32)

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

  const pGame = m.alloc(0x1e00)
  m.setU32(pGame + 0x1c, 0x12340000)
  m.setU32(pGame + 0xa8, 100)
  m.setU16(pGame + 0x70, 1)
  m.setU32(pGame + 0x10f0, m.alloc(0x40))
  EVENT_InitTimerQueue113c(m, pGame)

  return {
    m,
    pGame,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pMonLvlTxt,
    pSkillsTxt,
    pMissilesTxt,
    pItemsTxt,
    pMonUModTxt,
    pLevelsTxt,
    pObjectsTxt,
    pObjGroupTxt,
  }
}

function allocRoom(m: SparseMemory113c, subX = 100, subY = 100, subW = 20, subH = 20, levelId = 2) {
  const pRoom = m.alloc(0x80)
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

function allocMonster(m: SparseMemory113c, pGame: number, pRoom: number, classId = 5, guid = 1, x = 105, y = 105) {
  const pMon = m.alloc(0x100)
  const pMonData = m.alloc(0x60)
  const pAiGen = m.alloc(0x48)
  const pAiCtrl = m.alloc(0x48)
  const pPath = m.alloc(0x100)
  const pSkills = m.alloc(0x20)
  m.setU32(pMon, 1)
  m.setU32(pMon + 0x04, classId)
  m.setU32(pMon + 0x0c, guid)
  m.setU32(pMon + 0x14, pMonData)
  m.setU32(pMon + 0x2c, pPath)
  m.setU32(pMon + 0x80, pGame)
  m.setU32(pMon + 0xa8, pSkills)
  const pMonStatsBase = m.u32(m.u32(0x6fde9e1c) + 0xa78)
  m.setU32(pMonData, pMonStatsBase + classId * 0x1a8)
  m.setU32(pMonData + 0x10, pAiCtrl)
  m.setU32(pMonData + 0x28, pAiGen)
  m.setU16(pPath + 0x02, x)
  m.setU16(pPath + 0x06, y)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pMon)
  STATLIST_CreateEx113c(m, pMon, 0, pGame)
  const pBasicList = STATLIST_AllocList113c(m, 1, 1, guid, 0, 0)
  STATLIST_MergeStatLists113c(m, pMon, pBasicList, 1)
  SUNIT_InsertServerUnit113c(m, pGame, pMon)
  return { pMon, pMonData, pAiGen, pAiCtrl, pPath, pSkills }
}

describe('Milestone 33 [K2] Wave 3 Batch 2 (w3b2): 45 D2Game 0x6FC3BCA0..0x6FC525C0 Functions', () => {
  it('exports exact 45 113c-suffixed kernel functions', () => {
    const names = Object.keys(w3b2Exports)
    expect(names.length).toBe(45)
    for (const name of names) {
      expect(name.endsWith('_113c')).toBe(true)
      expect(typeof (w3b2Exports as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('ports AI and preset monster functions (#1..#4)', () => {
    const { m, pGame, pMonStatsTxt } = createW3B2World()
    const { pRoom } = allocRoom(m)
    const { pMon, pMonData, pAiCtrl, pSkills } = allocMonster(m, pGame, pRoom, 10, 1)

    // [1/45] AI_SpawnPackMinionOrStartMode_6FC3BCA0_113c: Foul Crow Nest depletes when aipar1 == 0
    const pRec10 = pMonStatsTxt + 10 * 0x1a8
    m.setU16(pRec10 + 0x56, 0)
    m.setU16(pRec10 + 0x5c, 10)
    m.setU32(pAiCtrl + 0x14, 0)
    m.setU32(pSkills + 0x10, 0xdeadbeef)
    const pArgs1 = m.alloc(0x30)
    m.setU32(pArgs1 + 0x00, pAiCtrl)
    m.setU32(pArgs1 + 0x14, 5)
    m.setU32(pArgs1 + 0x1c, pRec10)
    AI_SpawnPackMinionOrStartMode_6FC3BCA0_113c(m, pGame, pMon, pArgs1)
    expect(m.u32(pSkills + 0x10)).toBe(0)

    // [2/45] AI_StepTurnAndCastSkill4_6FC3C1E0_113c: initial cast when wSkill4 >= 0 and dwParam[2] == 0
    m.setU16(pRec10 + 0x170, 5)
    m.setU8(pRec10 + 0x180, 1)
    m.setU32(pAiCtrl + 0x14, 0)
    const pArgs2 = m.alloc(0x30)
    m.setU32(pArgs2, pAiCtrl)
    m.setU32(pArgs2 + 0x1c, pRec10)
    AI_StepTurnAndCastSkill4_6FC3C1E0_113c(m, pGame, pMon, pArgs2)
    expect(m.u32(pAiCtrl + 0x14)).toBe(100)

    // [3/45] AI_SelectAndCastHirelingSkill_6FC3C4E0_113c: returns 0 when no HirelingTxt record matches
    m.setU32(0x6fdf0080 + 0x100 * 4, 0xffffffff)
    expect(AI_SelectAndCastHirelingSkill_6FC3C4E0_113c(m, pGame, pMon, 0, 1)).toBe(0)

    // [4/45] MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c: copies preset extra ptr & sets class 0x137 field +0x0E
    const { pMon: pSiege, pMonData: pSiegeData, pAiGen: pSiegeAiGen } = allocMonster(m, pGame, pRoom, 0x137, 2, 112, 118)
    m.setU8(pMonStatsTxt + 0x137 * 0x1a8 + 0x0d, 1)
    const pPresetUnit = m.alloc(0x60)
    const pNode = m.alloc(0x18)
    m.setU32(pPresetUnit + 0x24, pNode)
    m.setU32(pPresetUnit + 0x4c, 7)
    m.setU32(pPresetUnit + 0x50, 11)
    MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c(m, pSiege, pGame, pPresetUnit)
    expect(m.u32(pPresetUnit + 0x24)).toBe(0)
    expect(m.u32(pSiegeAiGen + 0x38)).toBe(pNode)
    expect(m.u8(pSiegeData + 0x0e)).toBe(7)
    void pMonData
  })
  it('ports item bitstream, minion list, and MONUMOD stat functions (#5..#17)', () => {
    const { m, pGame, pMonStatsTxt, pMonLvlTxt, pMonUModTxt, pSkillsTxt, pItemsTxt } =
      createW3B2World()
    const { pRoom } = allocRoom(m)

    // [5/45] ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c: returns 0 on empty/invalid inactive node
    const pInactiveNode = m.alloc(32)
    expect(ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c(m, pGame, 0, pInactiveNode)).toBe(0)

    // [6/45] ITEMS_SaveItemToNodeAndFree_6FC403D0_113c: serializes compact item to allocated save node
    m.setU32(pItemsTxt + 1 * 0x1a8 + 0x80, 0x20767273)
    m.setU8(pItemsTxt + 1 * 0x1a8 + 0x14d, 1)
    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x74)
    const pItemPath = m.alloc(0x20)
    m.setU32(pItem, 4)
    m.setU32(pItem + 0x04, 1)
    m.setU32(pItem + 0x0c, 50)
    m.setU32(pItem + 0x14, pItemData)
    m.setU32(pItem + 0x2c, pItemPath)
    m.setU32(pItem + 0x80, pGame)
    m.setU16(pItemData + 0x02, 0x60)
    m.setU32(pItemData + 0x18, 0x200000)
    const pInactiveHolder = m.alloc(0x20)
    const pRetHolder = ITEMS_SaveItemToNodeAndFree_6FC403D0_113c(m, pGame, pItem, pInactiveHolder)
    expect(pRetHolder).toBe(pInactiveHolder)
    const pSavedNode = m.u32(pInactiveHolder + 0x08)
    expect(pSavedNode).toBeGreaterThan(0)
    expect(m.u16(pSavedNode + 0x0c)).toBeGreaterThan(0)

    // [7/45] AIGENERAL_RemoveFromMinionList_6FC416A0_113c: unlinks minion from leader list & resets owner
    const { pMon: pLeader, pAiGen: pLeaderAiGen } = allocMonster(m, pGame, pRoom, 5, 10)
    const { pMon: pMinion, pAiGen: pMinionAiGen } = allocMonster(m, pGame, pRoom, 5, 11)
    const pN1 = m.alloc(8)
    const pN2 = m.alloc(8)
    m.setU32(pN1, 10)
    m.setU32(pN1 + 4, pN2)
    m.setU32(pN2, 11)
    m.setU32(pLeaderAiGen + 0x28, pGame)
    m.setU32(pLeaderAiGen + 0x34, pN1)
    m.setU32(pMinionAiGen + 0x28, pGame)
    m.setU32(pMinionAiGen + 0x2c, 10)
    m.setU32(pMinionAiGen + 0x30, 1)
    AIGENERAL_RemoveFromMinionList_6FC416A0_113c(m, pGame, pMinion)
    expect(m.u32(pMinionAiGen + 0x2c)).toBe(0xffffffff)
    expect(m.u32(pN1 + 4)).toBe(0)
    void pLeader

    // [8/45] MONUMOD_ApplyChampionBaseStats_6FC418A0_113c: sets level and tohit on sentry/champion
    const { pMon: pChamp, pMonData: pChampData } = allocMonster(m, pGame, pRoom, 0x14c, 12)
    MONUMOD_ApplyChampionBaseStats_6FC418A0_113c(m, pGame, pChamp, 0, 0)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x13, 0)).toBeGreaterThanOrEqual(51)

    // [9/45] MONUMOD_ApplyResistanceBonus_6FC41BE0_113c: applies fire resist on UMod 0x09
    MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, pChamp, 0x09, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x27, 0)).toBe(75)

    // [10/45] MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c: applies fire min/max damage
    const nMlvl = STATLIST_GetUnitStat113c(m, pChamp, 0x0c, 0)
    m.setU32(pMonLvlTxt + nMlvl * 0x78 + 18 * 4, 100)
    for (let i = 0; i < 36; i++) {
      m.setU32(pMonUModTxt + i * 0x20 + 0x1c, 50)
    }
    MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c(m, pChamp, 0, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x30, 0)).toBeGreaterThan(0)

    // [11/45] MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c
    m.setU32(pMonLvlTxt + 0x34, 100)
    MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c(m, pChamp, 5, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x19, 0)).toBe(50)

    // [12/45] MONUMOD_ApplyGhostlyStats_6FC42D00_113c
    STATLIST_SetUnitStat113c(m, pChamp, 6, 400 << 8, 0)
    STATLIST_SetUnitStat113c(m, pChamp, 7, 400 << 8, 0)
    MONUMOD_ApplyGhostlyStats_6FC42D00_113c(m, pChamp, 0x27, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x19, 0)).toBe(350)

    // [13/45] MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c
    const lvlBefore = STATLIST_GetUnitStat113c(m, pChamp, 0x0c, 0)
    MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c(m, pChamp, 0x10, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x0c, 0)).toBe(lvlBefore - 1)

    // [14/45] MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c
    m.setU8(pChampData + 0x16, 0)
    STATLIST_SetUnitStat113c(m, pChamp, 0x4a, 0x28, 0)
    MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c(m, pChamp, 2, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x4a, 0)).toBe(0)

    // [15/45] MONUMOD_CheckModEligibility_6FC43100_113c
    expect(MONUMOD_CheckModEligibility_6FC43100_113c(m, pChamp, pGame, 0, 0)).toBe(0)
    m.setU8(pMonUModTxt + 5 * 0x20 + 0x06, 1)
    expect(MONUMOD_CheckModEligibility_6FC43100_113c(m, pChamp, pGame, 5, 0)).toBe(1)

    // [16/45] MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c (D2Game.dll@0x6FC43EF0 requires non-null unit; D2Common.dll@0x6FD891F0 returns 0 for null)
    expect(MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c(m, pGame, pChamp)).toBe(1)

    // [17/45] MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c
    m.setU16(pSkillsTxt + 0x42 * 0x23c + 0x10, 9)
    m.setU32(pSkillsTxt + 0x42 * 0x23c + 0x70, -1)
    MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c(m, pGame, 0, pChamp)
  })

  it('ports MONUMOD spawn and missile trigger functions (#18..#24)', () => {
    const { m, pGame } = createW3B2World()
    const { pRoom } = allocRoom(m)
    const { pMon, pMonData, pAiGen } = allocMonster(m, pGame, pRoom, 5, 20, 108, 108)

    // [18/45] MONUMOD_SpawnBossMinionPack_6FC445A0_113c
    MONUMOD_SpawnBossMinionPack_6FC445A0_113c(m, pGame, pRoom, 0, 0)

    // [19/45] MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c
    expect(
      MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c(m, pGame, pRoom, 0, 105, 105, -1, -1, 0, 0, 0),
    ).toBe(0)

    // [20/45]..[23/45] Enchanted & Scarab bolts / Frost Nova
    let initCallbacks = 0
    const hooks = {
      meleeDot: {
        missileInitCallback: () => {
          initCallbacks++
        },
      },
    }
    const guidBeforeLe = m.u32(pGame + 0x9c)
    MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c(m, pGame, pMon, hooks)
    expect(m.u32(pGame + 0x9c)).toBe(guidBeforeLe + 8)
    expect(initCallbacks).toBe(8)

    MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c(m, pGame, pMon, hooks)
    expect(m.u32(pGame + 0x9c)).toBe(guidBeforeLe + 16)

    MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c(m, pGame, pMon, hooks)
    expect(m.u32(pGame + 0x9c)).toBeGreaterThan(guidBeforeLe + 16)

    const beforeScarab = m.u32(pGame + 0x9c)
    m.setU32(pMonData + 0x18, 50)
    MONUMOD_SpawnScarabChargedBolts_6FC46320_113c(m, pGame, pMon, hooks)
    expect(m.u32(pGame + 0x9c)).toBe(beforeScarab + 8)
    expect(m.u32(pMonData + 0x18)).toBe(100)

    // [24/45] MONUMOD_SpawnDeathNova_6FC46520_113c: no-op when leader not found
    m.setU32(pAiGen + 0x1c, 1)
    m.setU32(pAiGen + 0x20, 9999)
    MONUMOD_SpawnDeathNova_6FC46520_113c(m, pGame, pMon, 0, 0, 1, hooks)
  })

  it('ports SKILLS, GAME, SUNIT, and OBJECTS functions (#25..#45)', () => {
    const { m, pGame, pSkillsTxt, pObjectsTxt, pObjGroupTxt } = createW3B2World()
    const { pRoom } = allocRoom(m, 100, 100, 20, 20, 2)
    const { pMon, pPath } = allocMonster(m, pGame, pRoom, 5, 30, 106, 106)

    // [25/45] SKILLS_SetupChargeOrLeapPath_6FC46A80_113c
    const pSkill = m.alloc(0x40)
    const pSkillTxt5 = pSkillsTxt + 5 * 0x23c
    m.setU32(pSkill, pSkillTxt5)
    SKILLS_SetParam1113c(m, pSkill, 110)
    SKILLS_SetParam2113c(m, pSkill, 110)
    SKILLS_SetupChargeOrLeapPath_6FC46A80_113c(m, pMon, pSkill, 50)
    expect(m.u32(pSkill + 0x0c)).toBe(0x1101)

    // [26/45] SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c
    m.setU32(pSkillTxt5 + 0x1c0, -1)
    const pX = m.alloc(4)
    const pY = m.alloc(4)
    const pOutRoom = m.alloc(4)
    m.setU32(pX, 108)
    m.setU32(pY, 108)
    expect(SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c(m, pMon, -1, 1, pX, pY, pOutRoom)).toBe(0)

    // [27/45] SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c
    const wwRes = SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c(m, pMon, pGame, pSkill)
    expect(wwRes === 0 || wwRes === 1).toBe(true)

    // [28/45] SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c
    const potCode = SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c(m, pGame, pMon, 5)
    expect(potCode).toBeGreaterThan(0)

    // [29/45] SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c
    SKILLS_SetParam3113c(m, pSkill, 6)
    SKILLS_SetParam4113c(m, pSkill, -1)
    expect(SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c(m, pGame, pMon, pSkill)).toBe(0)
    expect(SKILLS_GetParam3113c(m, pSkill)).toBe(6)

    // [30/45] & [31/45] SKILLS_SrvDo_FindItemCorpseDrop & SKILLS_SrvDo_SpawnCorpseMissile
    expect(SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c(m, pGame, pMon, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_SpawnCorpseMissile_6FC47C90_113c(m, pGame, pMon, -1, 1)).toBe(0)

    // [32/45] SKILLS_ApplyProgressiveChargeState_6FC48E70_113c
    expect(SKILLS_ApplyProgressiveChargeState_6FC48E70_113c(m, pGame, pMon, -1, 1)).toBe(0)

    // [33/45] GAME_LookupAndLockGameByKey_6FC4AAE0_113c
    m.setU32(0x6fd31c24, 0)
    expect(GAME_LookupAndLockGameByKey_6FC4AAE0_113c(m, 1)).toBe(0)

    // [34/45] SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c
    const { pMon: pTempUnit } = allocMonster(m, pGame, pRoom, 5, 31)
    SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c(m, pGame, pTempUnit)

    // [35/45] OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c
    expect(OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(m, 0x10, pGame, pRoom, 105, 105, 0)).toBe(0)

    // [36/45]..[40/45] Room object populators
    const pPopCtx = m.alloc(0x20)
    const pUrnObj = m.alloc(0x20)
    const pUrnSeed = m.alloc(8)
    m.setU32(pPopCtx + 0x00, pGame)
    m.setU32(pPopCtx + 0x04, pUrnObj)
    m.setU32(pPopCtx + 0x08, pRoom)
    m.setU32(pPopCtx + 0x0c, pUrnSeed)
    OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c(m, pPopCtx)
    const pRoomCoords = m.alloc(0x20)
    m.setU32(pRoomCoords, 100)
    m.setU32(pRoomCoords + 4, 100)
    m.setU32(pRoomCoords + 8, 10)
    m.setU32(pRoomCoords + 12, 10)
    expect(OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c(m, pGame, pRoom, pRoomCoords, 0, 102, 0)).toBe(1)
    const pRect = m.alloc(0x10)
    m.setU32(pRect, 102)
    m.setU32(pRect + 4, 102)
    m.setU32(pRect + 8, 4)
    m.setU32(pRect + 12, 4)
    m.setU32(pObjectsTxt + 7 * 0x1c0 + 0xd0, 2)
    m.setU32(pObjectsTxt + 7 * 0x1c0 + 0xd4, 2)
    expect(OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c(m, pGame, pRoom, pRoomCoords, pRect, 0)).toBe(1)
    m.setU32(pObjectsTxt + 0x2e * 0x1c0 + 0xd0, 2)
    m.setU32(pObjectsTxt + 0x2e * 0x1c0 + 0xd4, 2)
    expect(OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c(m, pGame, pRoom, 0)).toBe(0)
    expect(OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c(m, pGame, pRoom, 0)).toBe(0)

    // [41/45] OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c
    PATH_SetTargetPos113c(m, pPath, 106, 106)
    OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c(m, pMon, pGame)

    // [42/45] & [43/45] OBJECTS_SpawnWallAlignedObjectWithCallback & OBJECTS_SpawnRandomObjectWithCallback
    const pSmallRoom = allocRoom(m, 100, 100, 4, 4, 2).pRoom
    expect(
      OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c(m, pGame, 7, 2, 2, pSmallRoom, 1, 0, 0, {
        onObjectPosValidate: () => 0,
      }),
    ).toBe(0)
    expect(
      OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c(m, pGame, 7, 2, 2, pSmallRoom, 0, 0, {
        onObjectPosValidate: () => 0,
      }),
    ).toBe(0)

    // [44/45] OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c
    const pTorch = OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c(m, pGame, pRoom, 0x173, 105, 105, 0)
    expect(pTorch).toBeGreaterThan(0)
    expect(m.u32(pTorch + 0x04)).toBe(0x173)

    // [45/45] OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c
    expect(OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c(m, pGame, pRoom, 0x100, 105, 105, 0)).toBe(0)
    expect(() =>
      OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c(m, pGame, 0, 0x23e, 105, 105, 0),
    ).toThrow(D2CommonAssertError)
    m.setU32(pObjGroupTxt + 0x20, 83)
    const pShrine = OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c(m, pGame, pRoom, 0x23f, 106, 106, 1)
    expect(pShrine).toBeGreaterThan(0)
  })
})
