import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  SKILLS_AddSkillToUnit113c,
  SKILLS_AllocSkillList113c,
  SKILLS_GetCharges113c,
  SKILLS_GetSkillById113c,
  SKILLS_SetCharges113c,
  SKILLS_SetRightSkill113c,
  SKILLS_SetSkillLevelOnUnit113c,
  SGPT_EXPERIENCE_TXT_PTR_VA_113C,
} from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckState113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatListFromUnitAndState113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  AURAS_ApplyRadialStatBuffCallback113c,
  AURA_CheckCircleIntersectsRoom113c,
  AURA_CheckUnitMatchesFilterFlags113c,
  AURA_ForEachUnitInRadius113c,
  CURSES_ScaleImmuneMonsterResistPenalty113c,
  D2GAME_ITEM_EVENT_CALLBACK_TABLE_113C,
  DATATBLS_GetItemStatCostRecordFast113c,
  ITEMEVENT_AttackerTakesDamage113c,
  ITEMEVENT_ChanceToCastSkill113c,
  ITEMEVENT_ManaAfterKill113c,
  ITEMS_ActivateEquippedItemStats113c,
  ITEMS_DeactivateEquippedItemStats113c,
  ITEMS_GetScrollOrTomeSkillId113c,
  ITEMS_OnEquipScrollOrTome113c,
  ITEMS_OnUnequipScrollOrTome113c,
  ITEMS_RegisterItemEventCallback113c,
  ITEMS_UpdateScrollOrTomeSkillCharges113c,
  MONSTER_SetLastHitModeField54_113c,
  MONSTER_StartModeRun113c,
  NET_SendUnitTargetedSkillAction113c,
  PLAYER_Event0C_ExpireTimedStats113c,
  SKILLS_ActivateAuraSkillOnUnit113c,
  SKILLS_CallbackStaticField113c,
  SKILLS_CastTriggeredSkillCore113c,
  SKILLS_Event08_AuraPulseTick113c,
  SKILLS_TriggerSkillOnTarget113c,
  STATES_CreateOrUpdateAuraStatList113c,
  SUNITDMG_AddElementalDamageToStruct113c,
  SUNIT_AreUnitsInSamePartyOrAligned113c,
  SrvDoFunc_020_StaticField113c,
  SrvDoFunc_065_AuraRadialStatBuff113c,
  UNITEVENT_RegisterTimerOrItemEventNode113c,
  UNIT_QueueSkillCastNotify99_113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  EVENT_InitTimerQueue113c,
  EVENT_SetEventFull113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { D2MonLvlTxt_SIZE } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_GEMS_TXT_COUNT_VA,
  SGPT_GEMS_TXT_PTR_VA,
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
  SGPT_QUALITYITEMS_TXT_COUNT_VA,
  SGPT_QUALITYITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { collectImportGraph, legacyReachable } from '../../../tools/oracle/kern-replay/import-graph.ts'
import { REPO_ROOT_113C } from '../../../tools/oracle/kern-replay/replay-113c.ts'

const G_MONLVL_TXT_VA = 0x6fdf0b54
const G_MONLVL_COUNT_VA = 0x6fdf0b58

interface TestEnv {
  m: SparseMemory113c
  pDataTables: number
  pItemStatCostTxt: number
  pSkillsTxt: number
  pStatesTxt: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pMissilesTxt: number
  pSkillsCode: number
  pItemsTxt: number
  pQualityItemsTxt: number
  pGemsTxt: number
  pMonLvlTxt: number
  emitRpnConst: (val: number) => number
}

function createItemDefTestEnv(): TestEnv {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(0x6fdd6000, 0x20000, 0)

  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  // ItemStatCost.txt (400 rows * 0x144)
  const nIsc = 400
  const pItemStatCostTxt = m.alloc(nIsc * 0x144)
  m.setU32(pDataTables + 0xbcc, pItemStatCostTxt)
  m.setU32(pDataTables + 0xbd4, nIsc)
  // Configure pool stats (6=HP->7=MaxHP, 8=Mana->9=MaxMana, 10=Stam->11=MaxStam) with fDirect (bit 4)
  m.setU8(pItemStatCostTxt + 6 * 0x144 + 0x04, 0x10)
  m.setU16(pItemStatCostTxt + 6 * 0x144 + 0x32, 7)
  m.setU8(pItemStatCostTxt + 8 * 0x144 + 0x04, 0x10)
  m.setU16(pItemStatCostTxt + 8 * 0x144 + 0x32, 9)
  m.setU8(pItemStatCostTxt + 10 * 0x144 + 0x04, 0x10)
  m.setU16(pItemStatCostTxt + 10 * 0x144 + 0x32, 11)

  // States.txt (200 rows * 0x3C) + state mask bitfields
  const nStates = 200
  const pStatesTxt = m.alloc(nStates * 0x3c)
  for (let i = 0; i < nStates; i++) {
    m.setU16(pStatesTxt + i * 0x3c, i)
  }
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, nStates)
  // State mask tables (+0xC8..+0x168) — allocate clean bitmask arrays
  const pStateMasks = m.alloc(0x400)
  for (let off = 0xc8; off <= 0x168; off += 4) {
    m.setU32(pDataTables + off, pStateMasks + (off - 0xc8) * 8)
  }

  // Skills.txt (360 rows * 0x23C) + SkillsCode RPN buffer (+0x40, +0x44)
  const nSkills = 360
  const pSkillsTxt = m.alloc(nSkills * 0x23c)
  for (let i = 0; i < nSkills; i++) {
    m.setU16(pSkillsTxt + i * 0x23c, i)
    m.setU32(pSkillsTxt + i * 0x23c + 0x170, 0xffffffff)
  }
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, nSkills)

  const pSkillsCode = m.alloc(0x1000)
  m.setU32(pDataTables + 0x40, pSkillsCode)
  m.setU32(pDataTables + 0x44, 0x1000)
  // Offset 0 = immediate 0 (op=0 returns 0)
  m.setU8(pSkillsCode, 0)
  let nextRpnOff = 8
  const emitRpnConst = (val: number): number => {
    const off = nextRpnOff
    m.setU8(pSkillsCode + off, 9)
    m.setU32(pSkillsCode + off + 1, val >>> 0)
    m.setU8(pSkillsCode + off + 5, 0)
    nextRpnOff += 8
    return off
  }

  // Skill encode shift/mask (+0xC6C = 6, +0xC70 = 0x3F)
  m.setU32(pDataTables + 0xc6c, 6)
  m.setU32(pDataTables + 0xc70, 0x3f)

  // MonStats.txt (80 rows * 0x1A8) & MonStats2.txt (80 rows * 0x134)
  const pMonStatsTxt = m.alloc(80 * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 80)
  const pMonStats2Txt = m.alloc(80 * 0x134)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 80)

  // Missiles.txt (80 rows * 0x1A4)
  const pMissilesTxt = m.alloc(80 * 0x1a4)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 80)

  // MonLvl.txt (10 rows)
  const pMonLvlTxt = m.alloc(10 * D2MonLvlTxt_SIZE)
  m.setU32(G_MONLVL_TXT_VA, pMonLvlTxt)
  m.setU32(G_MONLVL_COUNT_VA, 10)

  // Items.txt (32 rows * 0x1A8), ItemTypes bitvec (+0xBFC = 96, +0xC00 = 3 dwords/row, +0xC04 = matrix)
  const pItemsTxt = m.alloc(32 * 0x1a8)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, 32)
  m.setU32(pDataTables + 0xbfc, 96)
  m.setU32(pDataTables + 0xc00, 3)
  const pItemTypeBitVec = m.alloc(96 * 3 * 4)
  m.setU32(pDataTables + 0xc04, pItemTypeBitVec)
  for (let t = 0; t < 96; t++) {
    const col = t >> 5
    const bit = 1 << (t & 31)
    m.setU32(pItemTypeBitVec + (t * 3 + col) * 4, bit >>> 0)
  }

  // QualityItems / Books (16 rows * 0x20) & Gems.txt (16 rows * 0xC0)
  const pQualityItemsTxt = m.alloc(16 * 0x20)
  m.setU32(SGPT_QUALITYITEMS_TXT_PTR_VA, pQualityItemsTxt)
  m.setU32(SGPT_QUALITYITEMS_TXT_COUNT_VA, 16)
  const pGemsTxt = m.alloc(16 * 0xc0)
  m.setU32(SGPT_GEMS_TXT_PTR_VA, pGemsTxt)
  m.setU32(SGPT_GEMS_TXT_COUNT_VA, 16)

  // Experience.bin max skill/char level (`0x6FDF0B50` -> 99)
  const pExpBin = m.alloc(32)
  m.setU32(pExpBin, 99)
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin)

  // AnimData empty bucket table (`0x6FDF0B4C`) for `UNITS_SetUnitAnimMode113c`
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
    pItemStatCostTxt,
    pSkillsTxt,
    pStatesTxt,
    pMonStatsTxt,
    pMonStats2Txt,
    pMissilesTxt,
    pSkillsCode,
    pItemsTxt,
    pQualityItemsTxt,
    pGemsTxt,
    pMonLvlTxt,
    emitRpnConst,
  }
}

function allocDynamicUnitWithStats(
  m: SparseMemory113c,
  unitType: number,
  classId: number,
  unitId: number,
  pGame: number,
  x: number,
  y: number,
  pRoom = 0,
): number {
  const pUnit = m.alloc(0x100)
  m.setU32(pUnit, unitType >>> 0)
  m.setU32(pUnit + 0x04, classId >>> 0)
  m.setU32(pUnit + 0x0c, unitId >>> 0)
  m.setU32(pUnit + 0x10, 1) // neutral alive mode
  m.setU32(pUnit + 0x20, 0x12345678)
  m.setU32(pUnit + 0x24, 0x0000029a)
  m.setU32(pUnit + 0x80, pGame >>> 0)
  m.setU32(pUnit + 0xc4, 0x0c) // targetable + attackable

  const pPath = m.alloc(0x200)
  m.setU16(pPath + 0x02, x & 0xffff)
  m.setU16(pPath + 0x06, y & 0xffff)
  m.setU16(pPath + 0x10, x & 0xffff) // targetX / firstPointX
  m.setU16(pPath + 0x12, y & 0xffff) // targetY / firstPointY
  m.setU32(pPath + 0x1c, pRoom >>> 0)
  m.setU32(pPath + 0x20, pUnit)
  m.setU32(pUnit + 0x2c, pPath)

  const pStatListEx = STATLIST_CreateEx113c(m, pUnit, 0, pGame)
  m.setU32(pUnit + 0x5c, pStatListEx)

  if (unitType === 0) {
    const pPlayerData = m.alloc(0xc0)
    m.setU32(pUnit + 0x14, pPlayerData)
    // Players carry STATE_ALIGNMENT (0x69) with STAT_ALIGNMENT (0xAC) = 2 (GOOD)
    const pAlignList = STATLIST_AllocList113c(m, 0, 0, unitId, 0, 0)
    STATLIST_SetState113c(m, pAlignList, 0x69)
    STATLIST_SetStat113c(m, pAlignList, 0xac, 2, 0)
    STATLIST_MergeStatLists113c(m, pUnit, pAlignList, 1)
  } else if (unitType === 1) {
    const pMonsterData = m.alloc(0x80)
    m.setU32(pUnit + 0x14, pMonsterData)
  }

  // Register in pGame server unit hash (`0x1120 + type * 0x200 + (id & 0x7f) * 4`)
  if (pGame !== 0 && unitType >= 0 && unitType < 5) {
    m.setU32(pGame + 0x1120 + unitType * 0x200 + (unitId & 0x7f) * 4, pUnit)
  }
  return pUnit
}

function allocTestRoom(
  m: SparseMemory113c,
  levelId: number,
  subX: number,
  subY: number,
  subW: number,
  subH: number,
): number {
  const pLevel = m.alloc(0x200)
  m.setU32(pLevel + 0x1d0, levelId >>> 0)
  const pRoomEx = m.alloc(0x80)
  m.setU32(pRoomEx + 0x58, pLevel)

  const pRoom = m.alloc(0x90)
  const ppAdj = m.alloc(8)
  m.setU32(ppAdj, pRoom)
  m.setU32(pRoom, ppAdj) // ppRoomsNear
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x24, 1) // nRoomsNear
  // Subtile coordinates (`+0x4c..+0x58`) read by DUNGEON_GetRoomCoordinates113c
  m.setU32(pRoom + 0x4c, subX >>> 0)
  m.setU32(pRoom + 0x50, subY >>> 0)
  m.setU32(pRoom + 0x54, subW >>> 0)
  m.setU32(pRoom + 0x58, subH >>> 0)
  return pRoom
}

describe('Lane K2-F: p52-item-defense 32 Dynamic-Gap D2Game.dll VAs (8,978 B)', () => {
  it('maintains 100% d2kern-113c import-graph purity with zero legacy edges', () => {
    const entry = 'src/d2kern-113c/game/k2-gap-itemdef-113c.ts'
    const graph = collectImportGraph(REPO_ROOT_113C, [entry])
    expect(legacyReachable(graph, [entry])).toEqual([])
  })

  it('ports 0x6FC210D0 (DATATBLS_GetItemStatCostRecordFast113c) & 0x6FC6E230 (CURSES_ScaleImmuneMonsterResistPenalty113c)', () => {
    const env = createItemDefTestEnv()
    const { m, pItemStatCostTxt } = env

    expect(DATATBLS_GetItemStatCostRecordFast113c(m, -1)).toBe(0)
    expect(DATATBLS_GetItemStatCostRecordFast113c(m, 400)).toBe(0)
    expect(DATATBLS_GetItemStatCostRecordFast113c(m, 39)).toBe(
      (pItemStatCostTxt + 39 * 0x144) >>> 0,
    )

    const pGame = m.alloc(0x2000)
    const pPlayer = allocDynamicUnitWithStats(m, 0, 0, 1, pGame, 100, 100)
    const pMonster = allocDynamicUnitWithStats(m, 1, 5, 2, pGame, 102, 102)
    STATLIST_SetUnitStat113c(m, pMonster, 41, 110, 0) // Lightning Immune (110%)

    // Immune monster scales negative primary resistance penalty to 1/5th (-85 -> -17)
    expect(CURSES_ScaleImmuneMonsterResistPenalty113c(m, 41, -85, pMonster)).toBe(-17)
    // Positive resistance buff is unscaled
    expect(CURSES_ScaleImmuneMonsterResistPenalty113c(m, 41, 50, pMonster)).toBe(50)
    // Max-resist stat (42 = MAXLIGHTRESIST) is excluded by jump table 0x6FC6E288
    expect(CURSES_ScaleImmuneMonsterResistPenalty113c(m, 42, -25, pMonster)).toBe(-25)
    // Players are never scaled by monster immunity rule
    STATLIST_SetUnitStat113c(m, pPlayer, 41, 120, 0)
    expect(CURSES_ScaleImmuneMonsterResistPenalty113c(m, 41, -85, pPlayer)).toBe(-85)
    // Non-immune monster (< 100 base resist) takes full -85 penalty
    STATLIST_SetUnitStat113c(m, pMonster, 39, 75, 0)
    expect(CURSES_ScaleImmuneMonsterResistPenalty113c(m, 39, -85, pMonster)).toBe(-85)
  })

  it('ports 0x6FC57190 (UNITEVENT_RegisterTimerOrItemEventNode113c) & 0x6FCBE290 (ITEMS_RegisterItemEventCallback113c)', () => {
    const { m } = createItemDefTestEnv()
    const pGame = m.alloc(0x2000)
    const pUnit = allocDynamicUnitWithStats(m, 0, 1, 1, pGame, 50, 50)

    expect(UNITEVENT_RegisterTimerOrItemEventNode113c(m, 0, pGame, 2, 1, 2, 0x1111, 3, 99)).toBe(0)

    // Invalid item-event IDs (< 0, >= 50, or 0 which is NULL in 0x6FD277A8) return 0
    expect(ITEMS_RegisterItemEventCallback113c(m, -1, 10, 2, pUnit, pGame, 3, 0xaa, 0xbb)).toBe(0)
    expect(ITEMS_RegisterItemEventCallback113c(m, 0, 10, 2, pUnit, pGame, 3, 0xaa, 0xbb)).toBe(0)
    expect(ITEMS_RegisterItemEventCallback113c(m, 50, 10, 2, pUnit, pGame, 3, 0xaa, 0xbb)).toBe(0)

    // Item Event #6 -> 0x6FCCD910 (Attacker Takes Damage), #21 -> 0x6FCCDCE0 (Chance To Cast)
    const pNode1 = ITEMS_RegisterItemEventCallback113c(m, 6, 0x77, 2, pUnit, pGame, 4, 0x4e0000, 5)
    expect(pNode1).not.toBe(0)
    expect(m.u8(pNode1)).toBe(4)
    expect(m.u32(pNode1 + 0x04)).toBe(2)
    expect(m.u32(pNode1 + 0x08)).toBe(0x77)
    expect(m.u32(pNode1 + 0x0c)).toBe(0x4e0000)
    expect(m.u32(pNode1 + 0x10)).toBe(5)
    expect(m.u32(pNode1 + 0x14)).toBe(0x6fccd910)
    expect(m.u32(pUnit + 0x90)).toBe(pNode1)

    const pNode2 = ITEMS_RegisterItemEventCallback113c(
      m,
      21,
      0x88,
      2,
      pUnit,
      pGame,
      5,
      0xc60041,
      0,
    )
    expect(m.u32(pUnit + 0x90)).toBe(pNode2)
    expect(m.u32(pNode2 + 0x1c)).toBe(pNode1)
    expect(m.u32(pNode1 + 0x18)).toBe(pNode2)
    expect(m.u32(pNode2 + 0x14)).toBe(D2GAME_ITEM_EVENT_CALLBACK_TABLE_113C[21])
  })

  it('ports 0x6FCBEFE0 (SUNITDMG_AddElementalDamageToStruct113c), 0x6FC62EC0 (SKILLS_CallbackStaticField113c) & 0x6FC630D0 (SrvDoFunc_020_StaticField113c)', () => {
    const env = createItemDefTestEnv()
    const { m, pSkillsTxt, pMonLvlTxt, emitRpnConst } = env

    // Test 0x6FCBEFE0 across fire (1), cold (4), poison (5), stun (9), freeze (12), and random (10)
    const pDmg = m.alloc(0x70)
    const pOutRes = m.alloc(8)
    const pOutElem = pOutRes + 4
    const pGame = m.alloc(0x2000)
    const pSorc = allocDynamicUnitWithStats(m, 0, 1, 1, pGame, 100, 100)

    SUNITDMG_AddElementalDamageToStruct113c(m, pDmg, 1, pSorc, 0x500, 0, pOutRes, 0)
    expect(m.u32(pDmg + 0x10)).toBe(0x500)
    expect(m.u32(pDmg + 0x60)).toBe(0x20)
    expect(m.u32(pOutRes)).toBe(0x27)

    SUNITDMG_AddElementalDamageToStruct113c(m, pDmg, 4, pSorc, 0x300, 50, pOutRes, 0)
    expect(m.u32(pDmg + 0x24)).toBe(0x300)
    expect(m.u32(pDmg + 0x30)).toBe(50)
    expect(m.u32(pOutRes)).toBe(0x2b)

    SUNITDMG_AddElementalDamageToStruct113c(m, pDmg, 10, pSorc, 0x200, 0, pOutRes, pOutElem)
    expect([1, 2, 4, 5]).toContain(m.u32(pOutElem))

    // Test 0x6FC630D0 + 0x6FC62EC0 end-to-end in an active room with negative lightning resist cap & Hell 50% floor
    const pRoom = allocTestRoom(m, 2, 80, 80, 40, 40) // Blood Moor (level 2, non-town)
    m.setU32(m.u32(pSorc + 0x2c) + 0x1c, pRoom)

    const pEnemy1 = allocDynamicUnitWithStats(m, 1, 1, 10, pGame, 104, 104, pRoom)
    STATLIST_SetUnitStat113c(m, pEnemy1, 7, 200 << 8, 0) // MaxHP = 200
    STATLIST_SetUnitStat113c(m, pEnemy1, 6, 200 << 8, 0) // CurHP = 200
    STATLIST_SetUnitStat113c(m, pEnemy1, 41, -50, 0) // -50% Lightning Resist (must NOT amplify Static Field past 25%!)

    const pEnemyAtCap = allocDynamicUnitWithStats(m, 1, 1, 11, pGame, 105, 105, pRoom)
    STATLIST_SetUnitStat113c(m, pEnemyAtCap, 7, 200 << 8, 0)
    STATLIST_SetUnitStat113c(m, pEnemyAtCap, 6, 90 << 8, 0) // 45% <= 50% Hell cap -> untouched!

    // Link units into pRoom->pUnitFirst (+0x74) via +0xe8
    m.setU32(pRoom + 0x74, pSorc)
    m.setU32(pSorc + 0xe8, pEnemy1)
    m.setU32(pEnemy1 + 0xe8, pEnemyAtCap)

    // Configure Hell difficulty (diff=2, expansion=1) with 50% Static Field cap in MonLvl.txt[2]+0x40
    m.setU8(pGame + 0x6d, 2)
    m.setU32(pGame + 0x70, 1)
    m.setU32(pMonLvlTxt + 2 * D2MonLvlTxt_SIZE + 0x40, 50)

    // Configure skill #42 (Static Field) in Skills.txt
    const pSfTxt = pSkillsTxt + 42 * 0x23c
    m.setU32(pSfTxt + 0x50, 0x8583) // hostile + attackable + monsters
    m.setU32(pSfTxt + 0x64, emitRpnConst(15)) // radius 15
    m.setU32(pSfTxt + 0x138, emitRpnConst(25)) // 25% HP reduction
    m.setU32(pSfTxt + 0x13c, emitRpnConst(256)) // minDmg 1 HP (256)
    m.setU8(pSfTxt + 0x1dc, 2) // Lightning (2)

    expect(SrvDoFunc_020_StaticField113c(m, pGame, pSorc, 42, 5)).toBe(1)
    // Enemy1 had 200 HP (51200) and -50% LR; 12800 * 100 / 150 = 8533 -> 8533 * 150 / 100 = 12799 -> 38401
    expect(STATLIST_GetUnitStat113c(m, pEnemy1, 6, 0)).toBe(38401)
    // EnemyAtCap had 90/200 HP (<= 50% cap) so untouched at 90 HP
    expect(STATLIST_GetUnitStat113c(m, pEnemyAtCap, 6, 0)).toBe(90 << 8)
  })

  it('ports 0x6FC94C30 (MONSTER_StartModeRun113c), 0x6FC97820 (PLAYER_Event0C_ExpireTimedStats113c) & 0x6FCCF710 (MONSTER_SetLastHitModeField54_113c)', () => {
    const { m } = createItemDefTestEnv()
    const pGame = m.alloc(0x2000)
    m.setU32(pGame + 0xa8, 500) // dwGameFrame = 500

    const pMonster = allocDynamicUnitWithStats(m, 1, 1, 20, pGame, 60, 60)
    const pPath = m.u32(pMonster + 0x2c)
    const pModeArgs = m.alloc(0x24)
    m.setU32(pModeArgs + 0x04, pMonster)

    // Zero path points -> returns 0 without changing mode
    m.setU32(pPath + 0x28, 0)
    expect(MONSTER_StartModeRun113c(m, pGame, pModeArgs)).toBe(0)

    // Non-zero path points -> transitions anim mode to 15 (MONMODE_RUN) and returns 1
    m.setU32(pPath + 0x28, 3)
    expect(MONSTER_StartModeRun113c(m, pGame, pModeArgs)).toBe(1)
    expect(m.u32(pMonster + 0x10)).toBe(15)

    // 0x6FCCF710 writes pMonsterData + 0x54 only on monsters
    MONSTER_SetLastHitModeField54_113c(m, pMonster, 0xdeadbeef)
    expect(m.u32(m.u32(pMonster + 0x14) + 0x54)).toBe(0xdeadbeef)

    // 0x6FC97820 expires timed sublists <= pGame->dwGameFrame (+0xA8)
    const pPlayer = allocDynamicUnitWithStats(m, 0, 0, 1, pGame, 60, 60)
    const pAuraSetup = m.alloc(0x24)
    m.setU32(pAuraSetup + 0x00, pPlayer)
    m.setU32(pAuraSetup + 0x04, pPlayer)
    m.setU32(pAuraSetup + 0x08, 100)
    m.setU32(pAuraSetup + 0x0c, 3)
    m.setU32(pAuraSetup + 0x10, 25) // expires at frame 525
    m.setU32(pAuraSetup + 0x14, 39) // FIRERESIST
    m.setU32(pAuraSetup + 0x18, 30)
    m.setU32(pAuraSetup + 0x1c, 10)
    EVENT_InitTimerQueue113c(m, pGame)

    const pCreated = STATES_CreateOrUpdateAuraStatList113c(m, pAuraSetup)
    expect(pCreated).not.toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 39, 0)).toBe(30)

    // At frame 510 (< 525), stat remains active
    m.setU32(pGame + 0xa8, 510)
    PLAYER_Event0C_ExpireTimedStats113c(m, pGame, pPlayer)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 39, 0)).toBe(30)

    // At frame 525, timed sublist expires cleanly
    m.setU32(pGame + 0xa8, 525)
    PLAYER_Event0C_ExpireTimedStats113c(m, pGame, pPlayer)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 39, 0)).toBe(0)
  })

  it('ports 0x6FCBE610, 0x6FCC0370, 0x6FCC0C70, 0x6FCC00B0, 0x6FCBA1A0 & 0x6FCBA8D0 (full radial aura pipeline)', () => {
    const env = createItemDefTestEnv()
    const { m, pSkillsTxt, pMonStats2Txt, emitRpnConst } = env

    const pGame = m.alloc(0x2000)
    m.setU32(pGame + 0xa8, 100)
    EVENT_InitTimerQueue113c(m, pGame)

    const pRoom = allocTestRoom(m, 2, 100, 100, 50, 50)
    // 0x6FCBE610 circle-room checks (exact binary `||` bounds behavior + NULL room)
    expect(AURA_CheckCircleIntersectsRoom113c(m, 120, pRoom, 120, 10)).toBe(1)
    expect(AURA_CheckCircleIntersectsRoom113c(m, 120, 0, 120, 10)).toBe(0)
    const pDegenerateRoom = allocTestRoom(m, 2, 100, 100, -40, 50)
    expect(AURA_CheckCircleIntersectsRoom113c(m, 120, pDegenerateRoom, 10, -60)).toBe(0)

    const pPaladin = allocDynamicUnitWithStats(m, 0, 3, 1, pGame, 110, 110, pRoom)
    STATLIST_SetUnitStat113c(m, pPaladin, 9, 50 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPaladin, 8, 50 << 8, 0)

    // Allied mercenary (pet owned by pPaladin via pAiGeneral)
    const pMerc = allocDynamicUnitWithStats(m, 1, 2, 30, pGame, 114, 114, pRoom)
    const pMercMonData = m.u32(pMerc + 0x14)
    const pAiGen = m.alloc(0x40)
    m.setU32(pAiGen + 0x28, pGame)
    m.setU32(pAiGen + 0x2c, 1) // ownerId = Paladin (1)
    m.setU32(pAiGen + 0x30, 0) // ownerType = UNIT_PLAYER (0)
    m.setU32(pMercMonData + 0x28, pAiGen)
    // MonStats2 bit 1 (`+0x05` & 0x02) required by 0x6FCC00B0 for monster state buffs
    m.setU8(pMonStats2Txt + 0 * 0x134 + 0x05, 0x02)

    m.setU32(pRoom + 0x74, pPaladin)
    m.setU32(pPaladin + 0xe8, pMerc)

    // Verify 0x6FCC0370 filter flags (party/aligned 0x10000 + players/monsters 0x03)
    expect(AURA_CheckUnitMatchesFilterFlags113c(m, 0x10003, pPaladin, pMerc)).toBe(1)
    expect(AURA_CheckUnitMatchesFilterFlags113c(m, 0x8003, pPaladin, pMerc)).toBe(0)

    // Configure Skill #104 (Defiance / radial defense aura) for SrvDoFunc_065_AuraRadialStatBuff113c (0x6FCBA8D0)
    const pDefTxt = pSkillsTxt + 104 * 0x23c
    m.setU8(pDefTxt + 0x04, 0x20) // aura bit 5
    m.setU32(pDefTxt + 0x50, 0x10003) // party players + aligned monsters
    m.setU16(pDefTxt + 0x54, 31) // STAT_ITEM_ARMOR_PERCENT (31)
    m.setU16(pDefTxt + 0x56, 0xffff)
    m.setU32(pDefTxt + 0x64, emitRpnConst(20)) // radius 20
    m.setU32(pDefTxt + 0x68, emitRpnConst(120)) // +120% defense
    m.setU16(pDefTxt + 0x80, 28) // self aura state
    m.setU16(pDefTxt + 0x82, 29) // target aura state
    m.setU16(pDefTxt + 0x98, 40) // passive self stat (MAXFIRERESIST +5)
    m.setU16(pDefTxt + 0x9a, 0xffff)
    m.setU32(pDefTxt + 0xa4, emitRpnConst(5))
    m.setU32(pDefTxt + 0x128, emitRpnConst(50)) // aura len

    expect(SrvDoFunc_065_AuraRadialStatBuff113c(m, pGame, pPaladin, 104, 6)).toBe(1)
    // Both Paladin and allied Mercenary receive +120% defense from 0x6FCBA1A0 + 0x6FCC00B0 + 0x6FCC0C70
    expect(STATLIST_GetUnitStat113c(m, pPaladin, 31, 0)).toBe(120)
    expect(STATLIST_GetUnitStat113c(m, pPaladin, 40, 0)).toBe(5)
    expect(STATLIST_GetUnitStat113c(m, pMerc, 31, 0)).toBe(120)
  })

  it('ports 0x6FCC1D10 (SKILLS_ActivateAuraSkillOnUnit113c) & 0x6FCC1E80 (SKILLS_Event08_AuraPulseTick113c)', () => {
    const env = createItemDefTestEnv()
    const { m, pSkillsTxt, emitRpnConst } = env

    const pGame = m.alloc(0x2000)
    m.setU32(pGame + 0xa8, 200)
    EVENT_InitTimerQueue113c(m, pGame)

    const pRoom = allocTestRoom(m, 2, 50, 50, 40, 40)
    const pPaladin = allocDynamicUnitWithStats(m, 0, 3, 1, pGame, 60, 60, pRoom)
    m.setU32(pPaladin + 0xa8, SKILLS_AllocSkillList113c(m, 0))
    SKILLS_AddSkillToUnit113c(m, pPaladin, 98)
    SKILLS_SetSkillLevelOnUnit113c(m, pPaladin, 98, 4, 0, 0, 0)
    SKILLS_SetRightSkill113c(m, pPaladin, 98, -1)

    const pAuraTxt = pSkillsTxt + 98 * 0x23c
    m.setU8(pAuraTxt + 0x04, 0x20) // aura bit + delay flag 0x20
    m.setU16(pAuraTxt + 0x80, 33) // might state
    m.setU32(pAuraTxt + 0x160, emitRpnConst(25)) // perdelay 25 frames

    // 0x6FCC1D10 creates state 33 statlist with stats 0x15E=98, 0x15F=4 and schedules event 8
    SKILLS_ActivateAuraSkillOnUnit113c(m, pPaladin, pGame, 98)
    expect(STATES_CheckState113c(m, pPaladin, 33)).not.toBe(0)
    const pAuraList = STATLIST_GetStatListFromUnitAndState113c(m, pPaladin, 33)
    expect(pAuraList).not.toBe(0)
    expect(STATLIST_GetStatValue113c(m, pAuraList, 0x15e, 0)).toBe(98)
    expect(STATLIST_GetStatValue113c(m, pAuraList, 0x15f, 0)).toBe(4)

    // 0x6FCC1E80 ticks both right-hand aura (-1) and item-granted aura (98)
    SKILLS_Event08_AuraPulseTick113c(m, pGame, pPaladin, -1)
    SKILLS_Event08_AuraPulseTick113c(m, pGame, pPaladin, 98)

    // If unit loses aura state, 0x6FCC1E80 deletes orphaned event 8 for arg14=98
    EVENT_SetEventFull113c(m, pGame, pPaladin, 8, 300, 0, 99, 0)
    SKILLS_Event08_AuraPulseTick113c(m, pGame, pPaladin, 99)
  })

  it('ports 0x6FC9A4C0, 0x6FCAD210, 0x6FCCCDA0, 0x6FCCD910, 0x6FCCDCE0, 0x6FD114F0 & 0x6FD117E0 (item events & triggered skills)', () => {
    const env = createItemDefTestEnv()
    const { m, pSkillsTxt } = env

    const pGame = m.alloc(0x2000)
    const pRoomNear = allocTestRoom(m, 2, 100, 100, 30, 30)
    const pRoomFar = allocTestRoom(m, 2, 300, 300, 30, 30)

    const pDefender = allocDynamicUnitWithStats(m, 0, 1, 1, pGame, 110, 110, pRoomNear)
    const pAttacker = allocDynamicUnitWithStats(m, 1, 1, 2, pGame, 112, 112, pRoomNear)
    const pFarEnemy = allocDynamicUnitWithStats(m, 1, 1, 3, pGame, 310, 312, pRoomFar)

    // 1. 0x6FCCCDA0 (ITEMEVENT_ManaAfterKill113c / Damage-To-Mana event #13):
    // 20% Damage-To-Mana on 50 (50<<8 = 12800) damage -> +2560 mana!
    STATLIST_SetUnitStat113c(m, pDefender, 9, 100 << 8, 0) // MaxMana = 100
    STATLIST_SetUnitStat113c(m, pDefender, 8, 10 << 8, 0) // CurMana = 10
    STATLIST_SetUnitStat113c(m, pDefender, 114, 20, 0) // 20%
    const pIncomingDmg = m.alloc(0x70)
    m.setU16(pIncomingDmg + 0x04, 0x0005) // hit + melee flags
    m.setU32(pIncomingDmg + 0x4c, 50 << 8)
    expect(ITEMEVENT_ManaAfterKill113c(m, pDefender, pAttacker, pIncomingDmg, 114 << 16, 0)).toBe(
      1,
    )
    expect(STATLIST_GetUnitStat113c(m, pDefender, 8, 0)).toBe(20 << 8)

    // 2. 0x6FCCD910 (ITEMEVENT_AttackerTakesDamage113c):
    // Thorns stat 78 = 15 -> deals (15 << 8) physical damage back to pAttacker!
    STATLIST_SetUnitStat113c(m, pDefender, 78, 15, 0)
    STATLIST_SetUnitStat113c(m, pAttacker, 6, 40 << 8, 0)
    expect(
      ITEMEVENT_AttackerTakesDamage113c(
        m,
        pGame,
        pDefender,
        pAttacker,
        pIncomingDmg,
        78 << 16,
        0,
      ),
    ).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pAttacker, 6, 0)).toBe(25 << 8)
    expect(m.u32(pAttacker + 0xb0)).toBe(0x8d)

    // 3. 0x6FCCDCE0 -> 0x6FD117E0 -> 0x6FD114F0 -> 0x6FC9A4C0 (100% Chance to Cast Skill #38 Charged Bolt slvl 3)
    const pProcSkillTxt = pSkillsTxt + 38 * 0x23c
    m.setU16(pProcSkillTxt + 0x0a, 2) // SrvDoFunc
    m.setU16(pProcSkillTxt + 0x0c, 2)
    m.setU16(pProcSkillTxt + 0x16a, 2) // wItemEffect != 0 required by 0x6FD114F0
    m.setU8(pProcSkillTxt + 0x120, 1) // target self mode 1

    const encodedLayer = (38 << 6) | 3
    STATLIST_SetStat113c(m, m.u32(pDefender + 0x5c), 198, 100, encodedLayer)
    expect(STATLIST_GetUnitStatWithLayer113c(m, pDefender, 198, encodedLayer)).toBe(100)

    expect(
      ITEMEVENT_ChanceToCastSkill113c(
        m,
        pDefender,
        pAttacker,
        pIncomingDmg,
        (198 << 16) | encodedLayer,
        0,
      ),
    ).toBe(1)

    // Verify 0x6FC9A4C0 queued a 0x99 node on pDefender + 0xEC / +0xF0
    const pNotify99 = m.u32(pDefender + 0xec)
    expect(pNotify99).not.toBe(0)
    expect(m.u32(pDefender + 0xf0)).toBe(pNotify99)
    expect(m.u8(pNotify99 + 0x04)).toBe(0x99)
    expect(m.u16(pNotify99 + 0x08)).toBe(38)
    expect(m.u8(pNotify99 + 0x0a)).toBe(3)

    // Direct call to 0x6FD114F0 & 0x6FD117E0 verifying path target save/restore
    expect(SKILLS_TriggerSkillOnTarget113c(m, pAttacker, pDefender, 38, 5, 0)).toBe(1)
    const pSecond99 = m.u32(pDefender + 0xf0)
    expect(pSecond99).not.toBe(pNotify99)
    expect(m.u32(pNotify99)).toBe(pSecond99)

    // Also verify 0x6FD114F0 rejects skills with wItemEffect == 0
    expect(
      SKILLS_CastTriggeredSkillCore113c(m, pAttacker, pDefender, pGame, 0, 1, 0, 0, 0, 0, 0, 0, 0),
    ).toBe(0)

    // 4. 0x6FCAD210 (NET_SendUnitTargetedSkillAction113c):
    // Near target in adjacent room -> 16-byte 0x99 packet; far target -> 17-byte 0x9A ground packet!
    const pClient = m.alloc(0x400)
    const pQueue = m.alloc(0x410)
    m.setU32(pClient + 0x174, pDefender)
    m.setU32(pClient + 0x1a8, pGame)
    m.setU32(pClient + 0x1bc, pQueue)
    m.setU8(pClient + 0x3d4, 1)

    NET_SendUnitTargetedSkillAction113c(m, pClient, 1, 0, 1, 1, 2, 38, 0, 3)
    expect(m.u32(pQueue + 0x04)).toBe(0x10)
    expect(m.u8(pQueue + 0x08)).toBe(0x99)
    expect(m.u16(pQueue + 0x08 + 6)).toBe(38)

    NET_SendUnitTargetedSkillAction113c(m, pClient, 1, 0, 1, 1, 3, 38, 0, 3)
    expect(m.u32(pQueue + 0x04)).toBe(0x21) // 0x10 + 0x11
    expect(m.u8(pQueue + 0x18)).toBe(0x9a)
    expect(m.u16(pQueue + 0x18 + 0x0b)).toBe(310)
    expect(m.u16(pQueue + 0x18 + 0x0d)).toBe(312)
  })

  it('ports 0x6FCF1AA0, 0x6FCF43E0, 0x6FCF4630, 0x6FCF4670, 0x6FCF46B0 & 0x6FCF47C0 (scroll/tome charges & equipment stat lifecycle)', () => {
    const env = createItemDefTestEnv()
    const { m, pItemsTxt, pQualityItemsTxt } = env

    const pGame = m.alloc(0x2000)
    EVENT_InitTimerQueue113c(m, pGame)
    const pPlayer = allocDynamicUnitWithStats(m, 0, 1, 1, pGame, 100, 100)
    m.setU32(pPlayer + 0xa8, SKILLS_AllocSkillList113c(m, 0))

    // Wire client onto playerData (+0x9C) so 0x21 / 0x22 / 0x23 packets queue cleanly
    const pClient = m.alloc(0x400)
    const pQueue = m.alloc(0x410)
    m.setU32(pClient + 0x1a8, pGame)
    m.setU32(pClient + 0x1bc, pQueue)
    m.setU32(m.u32(pPlayer + 0x14) + 0x9c, pClient)

    // Item classId 5 = Tome of Town Portal (type 0x12 = 18), Book.txt[1] -> scrollSkill=219, tomeSkill=220
    m.setU16(pItemsTxt + 5 * 0x1a8 + 0x11e, 0x12) // wType[0] = 0x12 (Tome)
    m.setU32(pQualityItemsTxt + 1 * 0x20 + 0x08, 219)
    m.setU32(pQualityItemsTxt + 1 * 0x20 + 0x0c, 220)

    const pTome = m.alloc(0x100)
    m.setU32(pTome, 4) // UNIT_ITEM
    m.setU32(pTome + 0x04, 5)
    m.setU32(pTome + 0x0c, 77)
    const pTomeData = m.alloc(0x80)
    m.setU16(pTomeData + 0x3e, 1) // wMagicSuffix[0] = 1 (Book.txt row 1)
    m.setU32(pTome + 0x14, pTomeData)
    const pTomeStats = STATLIST_AllocList113c(m, 0x40, 4, 77, 0, 0)
    m.setU32(pTome + 0x5c, pTomeStats)
    STATLIST_SetStat113c(m, pTomeStats, 0x46, 3, 0) // 3 charges
    STATLIST_SetStat113c(m, pTomeStats, 0, 10, 0) // +10 Strength when merged

    // 0x6FCF1AA0 resolves skill 220 for Tome
    expect(ITEMS_GetScrollOrTomeSkillId113c(m, pTome)).toBe(220)

    // 0x6FCF47C0 -> 0x6FCF4670 -> 0x6FCF43E0 equips tome, adds skill 220 with 3 charges & merges +10 Str
    STATLIST_MergeStatLists113c(m, pPlayer, pTomeStats, 1)
    ITEMS_ActivateEquippedItemStats113c(m, pPlayer, pTome, 0)

    const pTpSkill = SKILLS_GetSkillById113c(m, pPlayer, 220, -1)
    expect(pTpSkill).not.toBe(0)
    expect(SKILLS_GetCharges113c(m, pTpSkill)).toBe(3)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0, 0)).toBe(10)

    // Assign Tome of TP to right-hand skill, then unequip via 0x6FCF46B0 -> 0x6FCF4630 -> 0x6FCF43E0
    const pAttackSkill = SKILLS_AddSkillToUnit113c(m, pPlayer, 0)
    SKILLS_SetCharges113c(m, pAttackSkill, 0)
    SKILLS_SetRightSkill113c(m, pPlayer, 220, -1)

    ITEMS_DeactivateEquippedItemStats113c(m, pPlayer, pTome, pGame, 1, 1)
    expect(SKILLS_GetCharges113c(m, pTpSkill)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0, 0)).toBe(0)

    // Direct 0x6FCF4670 / 0x6FCF4630 / 0x6FCF43E0 round-trip
    ITEMS_OnEquipScrollOrTome113c(m, pTome, pPlayer)
    expect(SKILLS_GetCharges113c(m, pTpSkill)).toBe(3)
    expect(ITEMS_UpdateScrollOrTomeSkillCharges113c(m, pTome, pPlayer, 1)).toBe(1)
    expect(SKILLS_GetCharges113c(m, pTpSkill)).toBe(6)
    ITEMS_OnUnequipScrollOrTome113c(m, pTome, pPlayer)
    expect(SKILLS_GetCharges113c(m, pTpSkill)).toBe(3)
  })

  it('ports 0x6FD00570 (SUNIT_AreUnitsInSamePartyOrAligned113c) across players, parties & pets', () => {
    const { m } = createItemDefTestEnv()
    const pGame = m.alloc(0x2000)

    const pPlayer1 = allocDynamicUnitWithStats(m, 0, 0, 1, pGame, 50, 50)
    const pPlayer2 = allocDynamicUnitWithStats(m, 0, 1, 2, pGame, 52, 52)
    const pPlayer3 = allocDynamicUnitWithStats(m, 0, 2, 3, pGame, 54, 54)

    // Same unit is always aligned
    expect(SUNIT_AreUnitsInSamePartyOrAligned113c(m, pPlayer1, pPlayer1)).toBe(1)
    // Unpartied distinct players (party 0xFFFF) are NOT aligned
    expect(SUNIT_AreUnitsInSamePartyOrAligned113c(m, pPlayer2, pPlayer1)).toBe(0)

    // Build D2PartyControlStrc at pGame + 0x1D2C putting Player 1 and Player 2 in party #5
    const pPartyCtrl = m.alloc(0x20)
    const pSubParty = m.alloc(0x10)
    const pMem1 = m.alloc(0x08)
    const pMem2 = m.alloc(0x08)
    m.setU32(pMem1, 1)
    m.setU32(pMem1 + 0x04, pMem2)
    m.setU32(pMem2, 2)
    m.setU16(pSubParty, 5)
    m.setU32(pSubParty + 0x04, pMem1)
    m.setU32(pPartyCtrl + 0x04, pSubParty)
    m.setU32(pGame + 0x1d2c, pPartyCtrl)

    expect(SUNIT_AreUnitsInSamePartyOrAligned113c(m, pPlayer2, pPlayer1)).toBe(1)
    expect(SUNIT_AreUnitsInSamePartyOrAligned113c(m, pPlayer3, pPlayer1)).toBe(0)

    // Pet owned by Player 2 is aligned with Player 1 via party #5!
    const pPet2 = allocDynamicUnitWithStats(m, 1, 10, 50, pGame, 53, 53)
    const pAiGen = m.alloc(0x40)
    m.setU32(pAiGen + 0x28, pGame)
    m.setU32(pAiGen + 0x2c, 2)
    m.setU32(pAiGen + 0x30, 0)
    m.setU32(m.u32(pPet2 + 0x14) + 0x28, pAiGen)

    expect(SUNIT_AreUnitsInSamePartyOrAligned113c(m, pPet2, pPlayer1)).toBe(1)
    expect(SUNIT_AreUnitsInSamePartyOrAligned113c(m, pPet2, pPlayer3)).toBe(0)
  })
})
