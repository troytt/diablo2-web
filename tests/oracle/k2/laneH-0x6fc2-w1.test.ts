import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { SKILLS_SetUsedSkillMemPort113c } from '../../../src/d2kern-113c/common/k0-d2common-memports.ts'
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts'
import {
  STATES_CheckState113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetSkillId113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import * as laneHExports from '../../../src/d2kern-113c/game/k2-laneH-0x6fc2-w1-113c.ts'
import {
  CHARSTATS_GetRecordPtrFast_6FC210A0_113c,
  CHECKSUM_ComputeCrc32_6FC2B470_113c,
  DATATBLS_GetTableWordAE0_6FC21830_113c,
  MONLVL_GetRecordPtrFast_6FC21E90_113c,
  MONSTATS_FollowSubClassChain_6FC21D30_113c,
  MONSTER_GetAiGeneralPtr_6FC218E0_113c,
  MONSTER_GetInteractDataPtr_6FC21370_113c,
  MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c,
  MONSTER_GetMonsterDataField2C_6FC21DD0_113c,
  MONSTER_TestUnitMonTypeFlag_6FC22790_113c,
  MONTYPE_TestNestedBit_6FC21620_113c,
  OBJRGN_CheckCoordSpacing20_6FC2B700_113c,
  OBJRGN_CheckCoordSpacing40_6FC2B670_113c,
  OBJRGN_PrependObjectCoordNode_6FC2B800_113c,
  OVERLAY_GetRecordPtrFast_6FC21AE0_113c,
  PETTYPE_GetRecordPtrFast_6FC21B60_113c,
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
  PLAYER_GetWaypointDataForDifficulty_6FC21720_113c,
  SEED_StepSeed64Fast_6FC21160_113c,
  SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c,
  SKILLS_CanMonsterBeImpregnated_6FC2C110_113c,
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  SKILLS_EvalLinearParam34_6FC21A40_113c,
  SKILLS_EvalLinearParam56_6FC21A90_113c,
  SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c,
  SKILLS_GetMaxSkillLevel_6FC21740_113c,
  SKILLS_GetParam1Fast_6FC21B90_113c,
  SKILLS_GetParam2Fast_6FC21BC0_113c,
  SKILLS_GetParam3Fast_6FC21BF0_113c,
  SKILLS_GetParam4Fast_6FC21C20_113c,
  SKILLS_GetParam5Fast_6FC21C50_113c,
  SKILLS_GetParam6Fast_6FC21EC0_113c,
  SKILLS_GetParam7Fast_6FC21EF0_113c,
  SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c,
  SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c,
  SKILLS_SrvSt59_Submerge_6FC2BEE0_113c,
  STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c,
  STATLIST_AddUnitStatGoldGuarded_6FC21670_113c,
  STATLIST_SetUnitStatGoldGuarded_6FC21040_113c,
  STORM_TSArrayCalcChunkSize_6FC225F0_113c,
  STORM_TSHashTableLookup_6FC22130_113c,
  STORM_TSListInitDefault_6FC224B0_113c,
  STORM_TSListInitFromPrototype_6FC22740_113c,
  STORM_TSListUnlinkAll_6FC22180_113c,
  UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c,
} from '../../../src/d2kern-113c/game/k2-laneH-0x6fc2-w1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
  type MonsterCreateSpawnArgs113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { D2LevelsTxt_SIZE, D2SkillStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface TestWorld {
  m: SparseMemory113c
  pDataTables: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pSkillsTxt: number
  pCharStatsTxt: number
  pUniqueItemsTxt: number
  pOverlayTxt: number
  pPetTypeTxt: number
  pMonLvlTxt: number
  pLevelsTxt: number
  pMonTypeNest: number
  pSkillCode: number
}

function createTestWorld(): TestWorld {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, monStatsCount)

  const monStats2Count = 600
  const pMonStats2Txt = m.alloc(monStats2Count * 0x134)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, monStats2Count)

  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, skillsCount)

  const charStatsCount = 7
  const pCharStatsTxt = m.alloc(charStatsCount * 0xc4)
  m.setU32(pDataTables + 0xbc4, pCharStatsTxt)
  m.setU32(pDataTables + 0xbc8, charStatsCount)

  const uniqueItemsCount = 400
  const pUniqueItemsTxt = m.alloc(uniqueItemsCount * 0x14c)
  m.setU32(pDataTables + 0xc24, pUniqueItemsTxt)
  m.setU32(pDataTables + 0xc28, uniqueItemsCount)

  const overlayCount = 150
  const pOverlayTxt = m.alloc(overlayCount * 0x3c)
  m.setU32(pDataTables + 0xbc, pOverlayTxt)
  m.setU32(pDataTables + 0xc4, overlayCount)

  const petTypeCount = 32
  const pPetTypeTxt = m.alloc(petTypeCount * 0xe0)
  m.setU32(pDataTables + 0xbe8, pPetTypeTxt)
  m.setU32(pDataTables + 0xbf0, petTypeCount)

  const monLvlCount = 110
  const pMonLvlTxt = m.alloc(monLvlCount * 0x78)
  m.setU32(pDataTables + 0xb70, pMonLvlTxt)
  m.setU32(pDataTables + 0xb74, monLvlCount)

  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, levelsCount)

  // States count at +0xBC0 and StatesTxt at +0xBBC (stride 0x40)
  const statesCount = 185
  const pStatesTxt = m.alloc(statesCount * 0x40)
  m.setU32(pDataTables + 0xbbc, pStatesTxt)
  m.setU32(pDataTables + 0xbc0, statesCount)
  const pStateMask33 = m.alloc(32)
  m.setU32(pDataTables + 0x150, pStateMask33)
  // State masks table at +0xBC0 / +0x10B0? Also ItemStatCost at +0xBCC / +0xBD4
  const iscCount = 360
  const pItemStatCost = m.alloc(iscCount * 0x144)
  m.setU32(pDataTables + 0xbcc, pItemStatCost)
  m.setU32(pDataTables + 0xbd4, iscCount)

  // MonTypeNest: 64 types -> 2 dwords per row
  const monTypeCount = 64
  const monTypeStrideDwords = 2
  const pMonTypeNest = m.alloc(monTypeCount * monTypeStrideDwords * 4)
  m.setU32(pDataTables + 0xc40, monTypeCount)
  m.setU32(pDataTables + 0xc44, pMonTypeNest)
  m.setU32(pDataTables + 0xc48, monTypeStrideDwords)

  // Skill RPN bytecode buffer at +0x40 / +0x44
  const pSkillCode = m.alloc(0x100)
  m.setU32(pDataTables + 0x40, pSkillCode)
  m.setU32(pDataTables + 0x44, 0x100)

  return {
    m,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pCharStatsTxt,
    pUniqueItemsTxt,
    pOverlayTxt,
    pPetTypeTxt,
    pMonLvlTxt,
    pLevelsTxt,
    pMonTypeNest,
    pSkillCode,
  }
}

function allocUnitWithStats(
  m: SparseMemory113c,
  unitType: number,
  classId: number,
  unitId: number,
  pGame: number,
): number {
  const pUnit = m.alloc(0x100)
  m.setU32(pUnit, unitType)
  m.setU32(pUnit + 0x04, classId)
  m.setU32(pUnit + 0x0c, unitId)
  m.setU32(pUnit + 0x80, pGame)
  STATLIST_CreateEx113c(m, pUnit, 0, pGame)
  return pUnit
}

function attachActiveRoom(
  m: SparseMemory113c,
  pUnit: number,
  levelId: number,
  posX: number,
  posY: number,
): { pRoom: number; pDynPath: number } {
  const pRoom = m.alloc(0x90)
  const pRoomEx = m.alloc(0x90)
  const pLevel = m.alloc(0x200)
  const pActUpdateFlag = m.alloc(4)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x2c, pActUpdateFlag)
  m.setU32(pRoomEx + 0x58, pLevel)
  m.setU32(pLevel + 0x1d0, levelId)

  const pDynPath = m.alloc(0x100)
  m.setU16(pDynPath + 0x02, posX)
  m.setU16(pDynPath + 0x06, posY)
  m.setU32(pDynPath + 0x1c, pRoom)
  m.setU32(pDynPath + 0x30, pUnit)
  m.setU32(pUnit + 0x2c, pDynPath)
  return { pRoom, pDynPath }
}

describe('Milestone 33 [K2] Lane K2-H: 45 D2Game 0x6FC21020..0x6FC2C310 Functions', () => {
  it('exports exact 45 113c-suffixed kernel functions', () => {
    const names = Object.keys(laneHExports)
    expect(names.length).toBe(45)
    for (const name of names) {
      expect(name.endsWith('113c')).toBe(true)
      expect(typeof (laneHExports as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('ports PLAYER_GetQuestRecordForDifficulty_6FC21020_113c (0x6FC21020) and PLAYER_GetWaypointDataForDifficulty_6FC21720_113c (0x6FC21720)', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x80)
    const pPlayer = m.alloc(0x40)
    const pPlayerData = m.alloc(0x40)
    m.setU32(pPlayer, 0) // UNIT_PLAYER
    m.setU32(pPlayer + 0x14, pPlayerData)

    const questPtrs = [0x40011000, 0x40012000, 0x40013000]
    const wpPtrs = [0x40021000, 0x40022000, 0x40023000]
    for (let diff = 0; diff < 3; diff++) {
      m.setU32(pPlayerData + 0x10 + diff * 4, questPtrs[diff]!)
      m.setU32(pPlayerData + 0x1c + diff * 4, wpPtrs[diff]!)
    }

    for (let diff = 0; diff < 3; diff++) {
      m.setU8(pGame + 0x6d, diff)
      expect(PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame)).toBe(questPtrs[diff])
      expect(PLAYER_GetWaypointDataForDifficulty_6FC21720_113c(m, pPlayer, pGame)).toBe(wpPtrs[diff])
    }
  })

  it('ports STATLIST_SetUnitStatGoldGuarded_6FC21040_113c (0x6FC21040) and STATLIST_AddUnitStatGoldGuarded_6FC21670_113c (0x6FC21670)', () => {
    const { m } = createTestWorld()
    const pGame = m.alloc(0x100)
    const pPlayer = allocUnitWithStats(m, 0, 0, 1, pGame)
    const pMonster = allocUnitWithStats(m, 1, 5, 2, pGame)

    // Level 10 player -> inventory gold limit (STATLIST_GetUnitGoldBankLimit) = 10 * 10000 = 100,000
    STATLIST_SetUnitStat113c(m, pPlayer, 12, 10, 0)

    // NULL unit is a safe no-op
    STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, 0, 14, 500)
    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, 0, 14, 500)

    // Negative value clamps stat to 0
    STATLIST_SetUnitStat113c(m, pPlayer, 14, 1234, 0)
    STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, pPlayer, 14, -5)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0)).toBe(0)

    // Exact cap 100,000 succeeds; 100,001 overflows and zeroes STAT_GOLD (14)
    STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, pPlayer, 14, 100000)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0)).toBe(100000)
    STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, pPlayer, 14, 100001)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0)).toBe(0)

    // Stash gold (15): 2,500,000 succeeds; 2,500,001 zeroes STAT_GOLDBANK (15)
    STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, pPlayer, 15, 2500000)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 15, 0)).toBe(2500000)
    STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, pPlayer, 15, 2500001)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 15, 0)).toBe(0)

    // Non-player monster is not subject to player gold cap
    STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, pMonster, 14, 9000000)
    expect(STATLIST_GetUnitStat113c(m, pMonster, 14, 0)).toBe(9000000)

    // AddUnitStatGoldGuarded: normal addition, underflow zeroing, and cap-overflow zeroing
    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 14, 60000)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0)).toBe(60000)
    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 14, 40000)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0)).toBe(100000)
    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 14, 1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0)).toBe(0)

    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 15, 2500000)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 15, 0)).toBe(2500000)
    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 15, 5)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 15, 0)).toBe(0)

    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 15, 500)
    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 15, -600)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 15, 0)).toBe(0)
  })

  it('ports fast DataTables record lookups (0x6FC210A0, 0x6FC216F0, 0x6FC21AE0, 0x6FC21B60, 0x6FC21E90, 0x6FC21830)', () => {
    const {
      m,
      pDataTables,
      pCharStatsTxt,
      pUniqueItemsTxt,
      pOverlayTxt,
      pPetTypeTxt,
      pMonLvlTxt,
    } = createTestWorld()

    expect(CHARSTATS_GetRecordPtrFast_6FC210A0_113c(m, -1)).toBe(0)
    expect(CHARSTATS_GetRecordPtrFast_6FC210A0_113c(m, 0)).toBe(pCharStatsTxt)
    expect(CHARSTATS_GetRecordPtrFast_6FC210A0_113c(m, 6)).toBe((pCharStatsTxt + 6 * 0xc4) >>> 0)
    expect(CHARSTATS_GetRecordPtrFast_6FC210A0_113c(m, 7)).toBe(0)

    expect(UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c(m, -1)).toBe(0)
    expect(UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c(m, 10)).toBe((pUniqueItemsTxt + 10 * 0x14c) >>> 0)
    expect(UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c(m, 400)).toBe(0)

    expect(OVERLAY_GetRecordPtrFast_6FC21AE0_113c(m, -1)).toBe(0)
    expect(OVERLAY_GetRecordPtrFast_6FC21AE0_113c(m, 5)).toBe((pOverlayTxt + 5 * 0x3c) >>> 0)
    expect(OVERLAY_GetRecordPtrFast_6FC21AE0_113c(m, 150)).toBe(0)

    expect(PETTYPE_GetRecordPtrFast_6FC21B60_113c(m, -1)).toBe(0)
    expect(PETTYPE_GetRecordPtrFast_6FC21B60_113c(m, 3)).toBe((pPetTypeTxt + 3 * 0xe0) >>> 0)
    expect(PETTYPE_GetRecordPtrFast_6FC21B60_113c(m, 32)).toBe(0)

    expect(MONLVL_GetRecordPtrFast_6FC21E90_113c(m, -1)).toBe(0)
    expect(MONLVL_GetRecordPtrFast_6FC21E90_113c(m, 85)).toBe((pMonLvlTxt + 85 * 0x78) >>> 0)
    expect(MONLVL_GetRecordPtrFast_6FC21E90_113c(m, 110)).toBe(0)

    m.setU16(pDataTables + 0xae0 + 0 * 2, 0x1234)
    m.setU16(pDataTables + 0xae0 + 65 * 2, 0xfeed)
    expect(DATATBLS_GetTableWordAE0_6FC21830_113c(m, -1)).toBe(-1)
    expect(DATATBLS_GetTableWordAE0_6FC21830_113c(m, 0)).toBe(0x1234)
    expect(DATATBLS_GetTableWordAE0_6FC21830_113c(m, 65)).toBe(0xfeed)
    expect(DATATBLS_GetTableWordAE0_6FC21830_113c(m, 66)).toBe(-1)
  })

  it('ports SEED_StepSeed64Fast_6FC21160_113c (0x6FC21160)', () => {
    const m = new SparseMemory113c()
    const pSeed = m.alloc(8)
    m.setU32(pSeed, 1)
    m.setU32(pSeed + 4, 0x29a)

    const lo1 = SEED_StepSeed64Fast_6FC21160_113c(m, pSeed)
    expect(lo1).toBe((0x6ac690c5 + 0x29a) >>> 0)
    expect(m.u32(pSeed)).toBe(lo1)
    expect(m.u32(pSeed + 4)).toBe(0)

    // Verify 64-bit carry into dwHiSeed
    m.setU32(pSeed, 0xffffffff)
    m.setU32(pSeed + 4, 0xffffffff)
    const expected64 = 0xffffffffn * 0x6ac690c5n + 0xffffffffn
    const lo2 = SEED_StepSeed64Fast_6FC21160_113c(m, pSeed)
    expect(lo2).toBe(Number(expected64 & 0xffffffffn) >>> 0)
    expect(m.u32(pSeed + 4)).toBe(Number((expected64 >> 32n) & 0xffffffffn) >>> 0)
  })

  it('ports MonsterData pointer accessors (0x6FC21370, 0x6FC21540, 0x6FC218E0, 0x6FC21DD0)', () => {
    const m = new SparseMemory113c()
    const pMonster = m.alloc(0x40)
    const pMonsterData = m.alloc(0x40)
    m.setU32(pMonster, 1) // UNIT_MONSTER
    m.setU32(pMonster + 0x14, pMonsterData)
    m.setU32(pMonsterData + 0x00, 0x40050000)
    m.setU32(pMonsterData + 0x28, 0x40050010)
    m.setU32(pMonsterData + 0x2c, 0x40050020)
    m.setU32(pMonsterData + 0x30, 0x40050030)

    expect(MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(m, pMonster)).toBe(0x40050000)
    expect(MONSTER_GetAiGeneralPtr_6FC218E0_113c(m, pMonster)).toBe(0x40050010)
    expect(MONSTER_GetMonsterDataField2C_6FC21DD0_113c(m, pMonster)).toBe(0x40050020)
    expect(MONSTER_GetInteractDataPtr_6FC21370_113c(m, pMonster)).toBe(0x40050030)

    // NULL unit, non-monster unit, and NULL pMonsterData all return 0
    const pPlayer = m.alloc(0x40)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pMonsterData)
    const pEmptyMonster = m.alloc(0x40)
    m.setU32(pEmptyMonster, 1)
    m.setU32(pEmptyMonster + 0x14, 0)

    for (const bad of [0, pPlayer, pEmptyMonster]) {
      expect(MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(m, bad)).toBe(0)
      expect(MONSTER_GetAiGeneralPtr_6FC218E0_113c(m, bad)).toBe(0)
      expect(MONSTER_GetMonsterDataField2C_6FC21DD0_113c(m, bad)).toBe(0)
      expect(MONSTER_GetInteractDataPtr_6FC21370_113c(m, bad)).toBe(0)
    }
  })

  it('ports MONTYPE_TestNestedBit_6FC21620_113c (0x6FC21620) and MONSTER_TestUnitMonTypeFlag_6FC22790_113c (0x6FC22790)', () => {
    const { m, pMonStatsTxt, pMonTypeNest } = createTestWorld()

    // Row 5 has bit 37 (dword 1, bit 5 -> 0x20) set; Row 0 has bit 0 (0x01) set
    m.setU32(pMonTypeNest + (0 * 2 + 0) * 4, 1)
    m.setU32(pMonTypeNest + (5 * 2 + 1) * 4, 1 << 5)

    // 0x6FC21620 rejects <= 0 (`jle`) and >= 64 (`jge`), returns raw mask bit when set
    expect(MONTYPE_TestNestedBit_6FC21620_113c(m, 0, 5)).toBe(0)
    expect(MONTYPE_TestNestedBit_6FC21620_113c(m, 37, 0)).toBe(0)
    expect(MONTYPE_TestNestedBit_6FC21620_113c(m, 64, 5)).toBe(0)
    expect(MONTYPE_TestNestedBit_6FC21620_113c(m, 37, 64)).toBe(0)
    expect(MONTYPE_TestNestedBit_6FC21620_113c(m, 37, 5)).toBe(1 << 5)
    expect(MONTYPE_TestNestedBit_6FC21620_113c(m, 36, 5)).toBe(0)

    // 0x6FC22790 allows 0 (`jl` only rejects < 0), uses pUnit's MonStatsTxt.wMonType (+0x1C) as bit in row nMonType
    const pMon0 = m.alloc(0x40)
    m.setU32(pMon0, 1)
    m.setU32(pMon0 + 0x04, 10)
    m.setU16(pMonStatsTxt + 10 * 0x1a8 + 0x1c, 0)
    expect(MONSTER_TestUnitMonTypeFlag_6FC22790_113c(m, pMon0, 0)).toBe(1)

    const pMon37 = m.alloc(0x40)
    m.setU32(pMon37, 1)
    m.setU32(pMon37 + 0x04, 11)
    m.setU16(pMonStatsTxt + 11 * 0x1a8 + 0x1c, 37)
    expect(MONSTER_TestUnitMonTypeFlag_6FC22790_113c(m, pMon37, 5)).toBe(1 << 5)
    expect(MONSTER_TestUnitMonTypeFlag_6FC22790_113c(m, pMon37, -1)).toBe(0)
    expect(MONSTER_TestUnitMonTypeFlag_6FC22790_113c(m, pMon37, 64)).toBe(0)
    expect(MONSTER_TestUnitMonTypeFlag_6FC22790_113c(m, 0, 5)).toBe(0)
  })

  it('ports SkillsTxt wMaxLvl, raw dwParam1..7 getters, and linear param evaluators (0x6FC21740, 0x6FC21A40, 0x6FC21A90, 0x6FC21B10, 0x6FC21B90, 0x6FC21BC0, 0x6FC21BF0, 0x6FC21C20, 0x6FC21C50, 0x6FC21EC0, 0x6FC21EF0)', () => {
    const { m, pSkillsTxt } = createTestWorld()
    const rec25 = pSkillsTxt + 25 * 0x23c
    m.setU16(rec25 + 0x12c, 30) // wMaxLvl = 30
    m.setU32(rec25 + 0x148, 100) // dwParam1
    m.setU32(rec25 + 0x14c, 15) // dwParam2
    m.setU32(rec25 + 0x150, 200) // dwParam3
    m.setU32(rec25 + 0x154, 25) // dwParam4
    m.setU32(rec25 + 0x158, 300) // dwParam5
    m.setU32(rec25 + 0x15c, 35) // dwParam6
    m.setU32(rec25 + 0x160, 400) // dwParam7

    // wMaxLvl: 30 when positive, default 20 when 0, negative, or out of range
    expect(SKILLS_GetMaxSkillLevel_6FC21740_113c(m, 25)).toBe(30)
    expect(SKILLS_GetMaxSkillLevel_6FC21740_113c(m, 26)).toBe(20)
    m.setU16(pSkillsTxt + 26 * 0x23c + 0x12c, -5)
    expect(SKILLS_GetMaxSkillLevel_6FC21740_113c(m, 26)).toBe(20)
    expect(SKILLS_GetMaxSkillLevel_6FC21740_113c(m, -1)).toBe(20)
    expect(SKILLS_GetMaxSkillLevel_6FC21740_113c(m, 300)).toBe(20)

    // Raw dwParam1..7 getters
    expect(SKILLS_GetParam1Fast_6FC21B90_113c(m, 25)).toBe(100)
    expect(SKILLS_GetParam2Fast_6FC21BC0_113c(m, 25)).toBe(15)
    expect(SKILLS_GetParam3Fast_6FC21BF0_113c(m, 25)).toBe(200)
    expect(SKILLS_GetParam4Fast_6FC21C20_113c(m, 25)).toBe(25)
    expect(SKILLS_GetParam5Fast_6FC21C50_113c(m, 25)).toBe(300)
    expect(SKILLS_GetParam6Fast_6FC21EC0_113c(m, 25)).toBe(35)
    expect(SKILLS_GetParam7Fast_6FC21EF0_113c(m, 25)).toBe(400)

    for (const badId of [-1, 300]) {
      expect(SKILLS_GetParam1Fast_6FC21B90_113c(m, badId)).toBe(0)
      expect(SKILLS_GetParam2Fast_6FC21BC0_113c(m, badId)).toBe(0)
      expect(SKILLS_GetParam3Fast_6FC21BF0_113c(m, badId)).toBe(0)
      expect(SKILLS_GetParam4Fast_6FC21C20_113c(m, badId)).toBe(0)
      expect(SKILLS_GetParam5Fast_6FC21C50_113c(m, badId)).toBe(0)
      expect(SKILLS_GetParam6Fast_6FC21EC0_113c(m, badId)).toBe(0)
      expect(SKILLS_GetParam7Fast_6FC21EF0_113c(m, badId)).toBe(0)
    }

    // Linear param pairs: base + (lvl - 1) * step for lvl >= 1, 0 for lvl <= 0 or invalid id
    expect(SKILLS_EvalLinearParam12_6FC21B10_113c(m, 25, 1)).toBe(100)
    expect(SKILLS_EvalLinearParam12_6FC21B10_113c(m, 25, 5)).toBe(160)
    expect(SKILLS_EvalLinearParam12_6FC21B10_113c(m, 25, 0)).toBe(0)
    expect(SKILLS_EvalLinearParam12_6FC21B10_113c(m, -1, 5)).toBe(0)

    expect(SKILLS_EvalLinearParam34_6FC21A40_113c(m, 25, 1)).toBe(200)
    expect(SKILLS_EvalLinearParam34_6FC21A40_113c(m, 25, 5)).toBe(300)
    expect(SKILLS_EvalLinearParam34_6FC21A40_113c(m, 25, 0)).toBe(0)

    expect(SKILLS_EvalLinearParam56_6FC21A90_113c(m, 25, 1)).toBe(300)
    expect(SKILLS_EvalLinearParam56_6FC21A90_113c(m, 25, 5)).toBe(440)
    expect(SKILLS_EvalLinearParam56_6FC21A90_113c(m, 300, 5)).toBe(0)
  })

  it('ports MONSTATS_FollowSubClassChain_6FC21D30_113c (0x6FC21D30)', () => {
    const { m, pMonStatsTxt } = createTestWorld()

    // Chain 10 -> 11 -> 12 -> -1 (with wBaseId = 10 on all three)
    m.setU16(pMonStatsTxt + 10 * 0x1a8 + 0x02, 10)
    m.setU16(pMonStatsTxt + 10 * 0x1a8 + 0x04, 11)
    m.setU16(pMonStatsTxt + 11 * 0x1a8 + 0x02, 10)
    m.setU16(pMonStatsTxt + 11 * 0x1a8 + 0x04, 12)
    m.setU16(pMonStatsTxt + 12 * 0x1a8 + 0x02, 10)
    m.setU16(pMonStatsTxt + 12 * 0x1a8 + 0x04, 0xffff) // -1

    expect(MONSTATS_FollowSubClassChain_6FC21D30_113c(m, -1, 0)).toBe(-1)
    expect(MONSTATS_FollowSubClassChain_6FC21D30_113c(m, 600, 0)).toBe(-1)
    expect(MONSTATS_FollowSubClassChain_6FC21D30_113c(m, 11, 0)).toBe(10)
    expect(MONSTATS_FollowSubClassChain_6FC21D30_113c(m, 10, 1)).toBe(11)
    expect(MONSTATS_FollowSubClassChain_6FC21D30_113c(m, 10, 2)).toBe(12)
    expect(MONSTATS_FollowSubClassChain_6FC21D30_113c(m, 10, 3)).toBe(-1)
  })

  it('ports Storm TSList, TSHashTable, and TSGrowableArray primitives (0x6FC22130, 0x6FC22180, 0x6FC224B0, 0x6FC225F0, 0x6FC22740)', () => {
    const m = new SparseMemory113c()

    // 1. Default TSExplicitList ctor (0x6FC224B0)
    const pDefaultList = m.alloc(12)
    expect(STORM_TSListInitDefault_6FC224B0_113c(m, pDefaultList)).toBe(pDefaultList)
    expect(m.u32(pDefaultList)).toBe(0xdddddddd)
    expect(m.u32(pDefaultList + 4)).toBe((pDefaultList + 4) >>> 0)
    expect(m.u32(pDefaultList + 8)).toBe((~(pDefaultList + 4)) >>> 0)

    // 2. Prototype TSExplicitList ctor (0x6FC22740)
    const pProto = m.alloc(12)
    m.setU32(pProto, 8) // m_linkoffset = 8
    const pBuckets = m.alloc(4 * 12)
    for (let i = 0; i < 4; i++) {
      const b = pBuckets + i * 12
      expect(STORM_TSListInitFromPrototype_6FC22740_113c(m, b, pProto)).toBe(b)
      expect(m.u32(b)).toBe(8)
      expect(m.u32(b + 4)).toBe((b + 4) >>> 0)
      expect(m.u32(b + 8)).toBe((~(b + 4)) >>> 0)
    }

    // 3. Link 2 nodes into bucket 1 (mask = 3, keys 5 and 9 both hash to bucket 1)
    const pHashTable = m.alloc(0x30)
    m.setU32(pHashTable + 0x1c, pBuckets)
    m.setU32(pHashTable + 0x24, 3)

    const bucket1 = pBuckets + 1 * 12
    const term1 = (bucket1 + 4) >>> 0
    const pNodeA = m.alloc(0x18) // +0 = key(5), +8 = prevlink, +0xC = next
    const pNodeB = m.alloc(0x18) // +0 = key(9), +8 = prevlink, +0xC = next
    m.setU32(pNodeA, 5)
    m.setU32(pNodeB, 9)
    m.setU32(bucket1 + 8, pNodeA)
    m.setU32(bucket1 + 4, (pNodeB + 8) >>> 0)
    m.setU32(pNodeA + 8, term1)
    m.setU32(pNodeA + 0x0c, pNodeB)
    m.setU32(pNodeB + 8, (pNodeA + 8) >>> 0)
    m.setU32(pNodeB + 0x0c, (~term1) >>> 0)

    expect(STORM_TSHashTableLookup_6FC22130_113c(m, pHashTable, 5)).toBe(pNodeA)
    expect(STORM_TSHashTableLookup_6FC22130_113c(m, pHashTable, 9)).toBe(pNodeB)
    expect(STORM_TSHashTableLookup_6FC22130_113c(m, pHashTable, 13)).toBe(0)
    expect(STORM_TSHashTableLookup_6FC22130_113c(m, pHashTable, 2)).toBe(0)

    // 4. UnlinkAll (0x6FC22180) unlinks both nodes and restores empty sentinel terminator
    STORM_TSListUnlinkAll_6FC22180_113c(m, bucket1)
    expect(m.u32(bucket1 + 4)).toBe(term1)
    expect(m.u32(bucket1 + 8)).toBe((~term1) >>> 0)
    expect(m.u32(pNodeA + 8)).toBe(0)
    expect(m.u32(pNodeA + 0x0c)).toBe(0)
    expect(m.u32(pNodeB + 8)).toBe(0)
    expect(m.u32(pNodeB + 0x0c)).toBe(0)
    expect(STORM_TSHashTableLookup_6FC22130_113c(m, pHashTable, 5)).toBe(0)

    // 5. TSGrowableArray::CalcChunkSize (0x6FC225F0)
    const pArr = m.alloc(0x14)
    expect(STORM_TSArrayCalcChunkSize_6FC225F0_113c(m, 0, pArr)).toBe(1)
    expect(STORM_TSArrayCalcChunkSize_6FC225F0_113c(m, 1, pArr)).toBe(1)
    expect(STORM_TSArrayCalcChunkSize_6FC225F0_113c(m, 3, pArr)).toBe(2)
    expect(STORM_TSArrayCalcChunkSize_6FC225F0_113c(m, 7, pArr)).toBe(4)
    expect(STORM_TSArrayCalcChunkSize_6FC225F0_113c(m, 15, pArr)).toBe(8)
    expect(STORM_TSArrayCalcChunkSize_6FC225F0_113c(m, 20, pArr)).toBe(16)
    expect(m.u32(pArr + 0x0c)).toBe(0) // untouched for < 21
    expect(STORM_TSArrayCalcChunkSize_6FC225F0_113c(m, 21, pArr)).toBe(21)
    expect(m.u32(pArr + 0x0c)).toBe(21)
  })

  it('ports CHECKSUM_ComputeCrc32_6FC2B470_113c (0x6FC2B470)', () => {
    const m = new SparseMemory113c()
    const pBuf = m.alloc(16)
    const ascii = '123456789'
    for (let i = 0; i < ascii.length; i++) {
      m.setU8(pBuf + i, ascii.charCodeAt(i))
    }
    // Canonical IEEE 802.3 CRC-32 check value for "123456789" is 0xCBF43926
    expect(CHECKSUM_ComputeCrc32_6FC2B470_113c(m, pBuf, 9)).toBe(0xcbf43926)
    expect(() => CHECKSUM_ComputeCrc32_6FC2B470_113c(m, pBuf, 0)).toThrow(D2CommonAssertError)
  })

  it('ports OBJRGN spacing checks and coord node prepend (0x6FC2B670, 0x6FC2B700, 0x6FC2B800)', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x1200)
    const pObjCtrl = m.alloc(0x1200)
    const pRegionAct1 = m.alloc(0x100)
    m.setU32(pGame + 0x1c, 0x11223344)
    m.setU32(pGame + 0x10f0, pObjCtrl)
    m.setU32(pObjCtrl + 1 * 4 + 0x48, pRegionAct1)

    // Empty counts return 1
    expect(OBJRGN_CheckCoordSpacing40_6FC2B670_113c(m, pGame, 1, 500, 500)).toBe(1)
    expect(OBJRGN_CheckCoordSpacing20_6FC2B700_113c(m, pGame, 1, 500, 500)).toBe(1)

    // Add 1 shrine at (500, 600) in +0x40 (threshold 50 on BOTH |dx| and |dy|)
    m.setU32(pRegionAct1 + 0x14, 1)
    m.setU32(pRegionAct1 + 0x40, 500)
    m.setU32(pRegionAct1 + 0x44, 600)
    expect(OBJRGN_CheckCoordSpacing40_6FC2B670_113c(m, pGame, 1, 549, 700)).toBe(0) // |dx|=49 < 50
    expect(OBJRGN_CheckCoordSpacing40_6FC2B670_113c(m, pGame, 1, 600, 551)).toBe(0) // |dy|=49 < 50
    expect(OBJRGN_CheckCoordSpacing40_6FC2B670_113c(m, pGame, 1, 550, 650)).toBe(1) // |dx|=50, |dy|=50

    // Add 1 well at (1000, 2000) in +0x20 (threshold 100 on BOTH |dx| and |dy|)
    m.setU32(pRegionAct1 + 0x18, 1)
    m.setU32(pRegionAct1 + 0x20, 1000)
    m.setU32(pRegionAct1 + 0x24, 2000)
    expect(OBJRGN_CheckCoordSpacing20_6FC2B700_113c(m, pGame, 1, 901, 2200)).toBe(0) // |dx|=99 < 100
    expect(OBJRGN_CheckCoordSpacing20_6FC2B700_113c(m, pGame, 1, 1100, 2099)).toBe(0) // |dy|=99 < 100
    expect(OBJRGN_CheckCoordSpacing20_6FC2B700_113c(m, pGame, 1, 1100, 2100)).toBe(1) // |dx|=100, |dy|=100

    // PrependObjectCoordNode (0x6FC2B800): static object (type 2) + dynamic player (type 0)
    const pObj = m.alloc(0x40)
    const pStaticPath = m.alloc(0x20)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x2c, pStaticPath)
    m.setU32(pStaticPath + 0x0c, 321)
    m.setU32(pStaticPath + 0x10, 654)

    OBJRGN_PrependObjectCoordNode_6FC2B800_113c(m, pGame, pObj, 0xaa)
    const pNode1 = m.u32(pObjCtrl + 0x1110)
    expect(pNode1).not.toBe(0)
    expect(m.u32(pNode1)).toBe(0xaa)
    expect(m.u32(pNode1 + 0x04)).toBe(321)
    expect(m.u32(pNode1 + 0x08)).toBe(654)
    expect(m.u32(pNode1 + 0x0c)).toBe(0)

    const pPlayer = m.alloc(0x40)
    const pDynPath = m.alloc(0x40)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x2c, pDynPath)
    m.setU16(pDynPath + 0x02, 111)
    m.setU16(pDynPath + 0x06, 222)

    OBJRGN_PrependObjectCoordNode_6FC2B800_113c(m, pGame, pPlayer, 0xbb)
    const pNode2 = m.u32(pObjCtrl + 0x1110)
    expect(m.u32(pNode2)).toBe(0xbb)
    expect(m.u32(pNode2 + 0x04)).toBe(111)
    expect(m.u32(pNode2 + 0x08)).toBe(222)
    expect(m.u32(pNode2 + 0x0c)).toBe(pNode1)
  })

  it('ports SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c (0x6FC2BE20)', () => {
    const { m, pSkillsTxt } = createTestWorld()
    const pGame = m.alloc(0x100)
    const pPlayer = allocUnitWithStats(m, 0, 0, 1, pGame)

    // Skill 80: dwParam5 (+0x158) = 40 HP -> threshold 40 << 8 = 10240
    const skillId = 80
    m.setU32(pSkillsTxt + skillId * 0x23c + 0x158, 40)

    const attachBloodMana = (): number => {
      const sub = STATLIST_AllocList113c(m, 0, 0, 0, 1)
      STATLIST_SetState113c(m, sub, 0x72)
      STATLIST_SetSkillId113c(m, sub, skillId)
      STATLIST_MergeStatLists113c(m, pPlayer, sub, true)
      return sub
    }

    // 1. Sufficient HP above threshold: deducts cost, keeps state 0x72, returns 1
    const sub1 = attachBloodMana()
    STATLIST_SetUnitStat113c(m, pPlayer, 6, 200 << 8, 0)
    expect(SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c(m, pPlayer, 50 << 8)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 6, 0)).toBe(150 << 8)
    expect(m.u32(pPlayer + 0x5c)).not.toBe(0)
    void sub1

    // 2. Deducting drops HP below 40 << 8: deducts cost, unlinks state 0x72, returns 1
    expect(SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c(m, pPlayer, 120 << 8)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 6, 0)).toBe(30 << 8)

    // 3. Insufficient HP (curHp < cost): unlinks state 0x72, clamps HP to 0x100 (1 HP), returns 0
    attachBloodMana()
    STATLIST_SetUnitStat113c(m, pPlayer, 6, 10 << 8, 0)
    expect(SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c(m, pPlayer, 25 << 8)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 6, 0)).toBe(0x100)
  })

  it('ports SKILLS_SrvSt59_Submerge_6FC2BEE0_113c (0x6FC2BEE0)', () => {
    const { m, pSkillsTxt, pSkillCode } = createTestWorld()
    const pGame = m.alloc(0x100)
    m.setU32(pGame + 0xa8, 1000) // dwGameFrame = 1000

    const pUnit = allocUnitWithStats(m, 1, 50, 7, pGame)
    attachActiveRoom(m, pUnit, 2, 100, 100)

    // Skill 90: dwCalc1 (+0x138) at offset 0 -> RPN [7, 45, 0] => 45 frames
    m.setU8(pSkillCode + 0, 7)
    m.setU8(pSkillCode + 1, 45)
    m.setU8(pSkillCode + 2, 0)
    m.setU32(pSkillsTxt + 90 * 0x23c + 0x138, 0)

    // Invalid skill id or missing pSkillList/usedSkill returns 0
    expect(SKILLS_SrvSt59_Submerge_6FC2BEE0_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_SrvSt59_Submerge_6FC2BEE0_113c(m, pGame, pUnit, 90, 1)).toBe(0)

    // Attach pSkillList (+0xA8) -> pUsedSkill (+0x10 via SKILLS_SetUsedSkillMemPort113c)
    const pSkillList = m.alloc(0x20)
    const pSkill = m.alloc(0x40)
    m.setU32(pUnit + 0xa8, pSkillList)
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, pSkill)

    expect(SKILLS_SrvSt59_Submerge_6FC2BEE0_113c(m, pGame, pUnit, 90, 1)).toBe(1)
    expect(m.get(pSkill, D2SkillStrc.dwParam1)).toBe(1045)
    expect(STATES_CheckState113c(m, pUnit, 0x0c)).not.toBe(0)
  })

  it('ports STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c (0x6FC2C000) and SKILLS_CanMonsterBeImpregnated_6FC2C110_113c (0x6FC2C110)', () => {
    const { m, pMonStatsTxt, pSkillsTxt } = createTestWorld()
    const pGame = m.alloc(0x1df4)

    // Configure monster classes: 100 (normal), 0x222 (Putrid Defiler), 0x227 (Pain Worm)
    m.setU16(pMonStatsTxt + 100 * 0x1a8 + 0x02, 100)
    m.setU16(pMonStatsTxt + 0x222 * 0x1a8 + 0x02, 0x222)
    m.setU16(pMonStatsTxt + 0x227 * 0x1a8 + 0x02, 0x227)

    const pLiveMon = allocUnitWithStats(m, 1, 100, 10, pGame)
    m.setU32(pLiveMon + 0x10, 1) // MONMODE_NEUTRAL (live)
    attachActiveRoom(m, pLiveMon, 2, 250, 260)

    // Eligible live non-friendly monster returns 1; good alignment (2) returns 0
    expect(SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(m, pLiveMon)).toBe(1)
    const pLiveStatListEx = m.u32(pLiveMon + 0x5c)
    const origFlags = m.u32(pLiveStatListEx + 0x10)
    m.setU32(pLiveStatListEx + 0x10, (origFlags | 0x0200) >>> 0)
    expect(SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(m, pLiveMon)).toBe(0)
    m.setU32(pLiveStatListEx + 0x10, origFlags)

    // Putrid Defiler (0x222) and Pain Worm (0x227) return 0
    m.setU32(pLiveMon + 0x04, 0x222)
    expect(SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(m, pLiveMon)).toBe(0)
    m.setU32(pLiveMon + 0x04, 0x227)
    expect(SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(m, pLiveMon)).toBe(0)
    m.setU32(pLiveMon + 0x04, 100)

    // Already impregnated (state 0x6E) returns 0
    STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c(m, pLiveMon, 0x6e, 0)
    const spawnedCalls: MonsterCreateSpawnArgs113c[] = []

    // Live monster expiring state 0x6E does NOT spawn Pain Worm
    STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c(m, pLiveMon, 0x6e, 0, {
      regpop: {
        onMonsterCreate: (_mem, args) => {
          spawnedCalls.push(args)
          return 0
        },
      },
    })
    expect(spawnedCalls.length).toBe(0)

    // Dead monster (mode 0x0C) with custom skill wSumMon = 310, nSumUMode = 8 DOES spawn!
    m.setU32(pLiveMon + 0x10, 0x0c)
    expect(SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(m, pLiveMon)).toBe(0)

    const skillId = 120
    m.setU16(pSkillsTxt + skillId * 0x23c + 0xbc, 310)
    m.setU8(pSkillsTxt + skillId * 0x23c + 0xbf, 8)
    const pSubList = STATLIST_AllocList113c(m, 0, 0, 0, 1)
    STATLIST_SetSkillId113c(m, pSubList, skillId)

    STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c(m, pLiveMon, 0x6e, pSubList, {
      regpop: {
        onMonsterCreate: (_mem, args) => {
          spawnedCalls.push(args)
          return 1
        },
      },
    })
    expect(spawnedCalls.length).toBe(1)
    expect(spawnedCalls[0]!.nClassId).toBe(310)
    expect(spawnedCalls[0]!.nMode).toBe(8)
    expect(spawnedCalls[0]!.nMaxRadius).toBe(1)

    // NULL unit with out-of-range state triggers 0x6FC2C0EF Fog.#10024 assert (line 0xA2A)
    expect(() => STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c(m, 0, -1, 0)).toThrow(
      D2CommonAssertError,
    )
  })

  it('ports SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c (0x6FC2C170)', () => {
    const { m } = createTestWorld()
    const pGame = m.alloc(0x1df4)

    const pOwner = allocUnitWithStats(m, 1, 20, 42, pGame)
    attachActiveRoom(m, pOwner, 2, 777, 888)
    SUNIT_InsertServerUnit113c(m, pGame, pOwner)

    const pFollower = allocUnitWithStats(m, 1, 21, 43, pGame)
    const { pDynPath: pFollowerPath } = attachActiveRoom(m, pFollower, 2, 100, 200)
    m.setU32(pFollower + 0x94, 1) // dwOwnerType = UNIT_MONSTER
    m.setU32(pFollower + 0x98, 42) // dwOwnerId = 42

    // Without bit 10 (0x400) in dwFlagsEx (+0xC8), position is unchanged
    expect(SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c(m, pGame, pFollower, 0, 1)).toBe(1)
    expect(m.u16(pFollowerPath + 0x02)).toBe(100)
    expect(m.u16(pFollowerPath + 0x06)).toBe(200)

    // With bit 10 (0x400) set, copies owner position (777, 888)
    m.setU32(pFollower + 0xc8, 0x400)
    expect(SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c(m, pGame, pFollower, 0, 1)).toBe(1)
    expect(m.u16(pFollowerPath + 0x02)).toBe(777)
    expect(m.u16(pFollowerPath + 0x06)).toBe(888)
  })

  it('ports SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c (0x6FC2C1F0)', () => {
    const { m, pMonStatsTxt, pMonStats2Txt } = createTestWorld()
    const pGame = m.alloc(0x1df4)

    // Configure class 15 -> MonStats2 index 15 (+0x18 wMonStatsEx) with corpseSel bit (byte +0x04 bit 7 = 0x80)
    m.setU16(pMonStatsTxt + 15 * 0x1a8 + 0x18, 15)
    m.setU8(pMonStats2Txt + 15 * 0x134 + 0x04, 0x80)

    const pPlayer = allocUnitWithStats(m, 0, 0, 1, pGame)
    const pPlrAlignSub = STATLIST_AllocList113c(m, 0, 0, 0, 1)
    STATLIST_SetState113c(m, pPlrAlignSub, 0x69)
    STATLIST_SetStat113c(m, pPlrAlignSub, 0xac, 2, 0)
    STATLIST_MergeStatLists113c(m, pPlayer, pPlrAlignSub, true)
    const { pRoom } = attachActiveRoom(m, pPlayer, 2, 100, 100)
    // Configure room interior bounds (+0x4C..+0x58: nSubtileX, nSubtileY, nSubtileWidth, nSubtileHeight)
    m.setU32(pRoom + 0x4c, 50)
    m.setU32(pRoom + 0x50, 50)
    m.setU32(pRoom + 0x54, 100)
    m.setU32(pRoom + 0x58, 100)
    const ppRooms = m.alloc(4)
    m.setU32(ppRooms, pRoom)
    m.setU32(pRoom, ppRooms)
    m.setU32(pRoom + 0x24, 1)

    // Hostile monster corpse in MONMODE_DEAD (0x0C) inside range 10 at (104, 103)
    const pCorpse = allocUnitWithStats(m, 1, 15, 99, pGame)
    m.setU32(pCorpse + 0x10, 0x0c)
    const pCorpsePath = m.alloc(0x80)
    m.setU16(pCorpsePath + 0x02, 104)
    m.setU16(pCorpsePath + 0x06, 103)
    m.setU32(pCorpsePath + 0x1c, pRoom)
    m.setU32(pCorpse + 0x2c, pCorpsePath)
    const pCorpseData = m.alloc(0x40)
    const pCorpseAiGen = m.alloc(0x40)
    m.setU32(pCorpseAiGen + 0x0c, 0xffffffff) // no owner
    m.setU32(pCorpseData + 0x28, pCorpseAiGen)
    m.setU32(pCorpse + 0x14, pCorpseData)

    // Link corpse into pRoom->pUnitFirst (+0x74)
    m.setU32(pRoom + 0x74, pCorpse)

    expect(SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c(m, pPlayer, pGame, 10)).toBe(
      pCorpse,
    )
    expect(SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c(m, pPlayer, pGame, 2)).toBe(0)
  })

  it('ports SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c (0x6FC2C310)', () => {
    const { m, pSkillsTxt, pSkillCode } = createTestWorld()
    const pGame = m.alloc(0x1df4)
    m.setU32(pGame + 0xa8, 500) // dwGameFrame = 500

    // RPN calc at offset 16 -> [7, 30, 0] => 30 frames; wAuraTargetState (+0x4E) = 15
    m.setU8(pSkillCode + 16, 7)
    m.setU8(pSkillCode + 17, 30)
    m.setU8(pSkillCode + 18, 0)
    const skillId = 140
    m.setU32(pSkillsTxt + skillId * 0x23c + 0x138, 16)
    m.setU16(pSkillsTxt + skillId * 0x23c + 0x4e, 15)

    // Target player (guid = 77)
    const pTarget = allocUnitWithStats(m, 0, 0, 77, pGame)
    attachActiveRoom(m, pTarget, 2, 200, 200)
    SUNIT_InsertServerUnit113c(m, pGame, pTarget)

    // Leader monster (guid = 88) + 1 live minion (guid = 89)
    const pLeader = allocUnitWithStats(m, 1, 20, 88, pGame)
    const { pDynPath: pLeaderPath } = attachActiveRoom(m, pLeader, 2, 195, 195)
    PATH_SetTargetUnit113c(m, pLeaderPath, pTarget)
    SUNIT_InsertServerUnit113c(m, pGame, pLeader)

    const pMinion = allocUnitWithStats(m, 1, 21, 89, pGame)
    attachActiveRoom(m, pMinion, 2, 196, 196)
    SUNIT_InsertServerUnit113c(m, pGame, pMinion)

    // Wire leader & minion pMonsterData -> pAiGeneral
    const pLeaderMonData = m.alloc(0x40)
    const pLeaderAiGen = m.alloc(0x40)
    const pMinionNode = m.alloc(0x10)
    m.setU32(pMinionNode, 89)
    m.setU16(pLeaderAiGen + 0x08, 1) // boss flag
    m.setU32(pLeaderAiGen + 0x28, pGame)
    m.setU32(pLeaderAiGen + 0x2c, 88)
    m.setU32(pLeaderAiGen + 0x30, 1) // ownerType = UNIT_MONSTER
    m.setU32(pLeaderAiGen + 0x34, pMinionNode)
    m.setU32(pLeaderMonData + 0x28, pLeaderAiGen)
    m.setU32(pLeader + 0x14, pLeaderMonData)

    const pMinionMonData = m.alloc(0x40)
    const pMinionAiGen = m.alloc(0x40)
    m.setU32(pMinionAiGen + 0x28, pGame)
    m.setU32(pMinionAiGen + 0x2c, 88)
    m.setU32(pMinionMonData + 0x28, pMinionAiGen)
    m.setU32(pMinion + 0x14, pMinionMonData)

    expect(SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c(m, pGame, pLeader, skillId, 1)).toBe(1)

    // Verify minion received AI command { 1, 0 (UNIT_PLAYER), 77, 530 } at pMinionAiGen->pCurrentCmd (+0x20)
    const pCmd = m.u32(pMinionAiGen + 0x20)
    expect(pCmd).not.toBe(0)
    expect(m.u32(pCmd + 0x08)).toBe(1)
    expect(m.u32(pCmd + 0x0c)).toBe(0)
    expect(m.u32(pCmd + 0x10)).toBe(77)
    expect(m.u32(pCmd + 0x14)).toBe(530)
  })
})
