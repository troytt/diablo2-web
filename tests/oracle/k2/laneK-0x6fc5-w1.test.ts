import { describe, expect, it } from 'vitest'
import { collectImportGraph, legacyReachable } from '../../../tools/oracle/kern-replay/import-graph.ts'
import { REPO_ROOT_113C } from '../../../tools/oracle/kern-replay/replay-113c.ts'
import {
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  INVENTORY_SIGNATURE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { DATATABLES_OFF_113C } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import { QUESTRECORD_AllocRecord113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import { SKILLS_GetParam1113c, SKILLS_GetParam2113c } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import * as laneKExports from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c.ts'
import {
  MISSILES_AddElemDamageByEType_6FC59260_113c,
  MISSILES_ConsumePierceStat_6FC58F40_113c,
  MISSILES_FilterFlagBit4Missile_6FC59510_113c,
  MISSILES_InitChargedBoltPath_6FC61F50_113c,
  MISSILES_InitDrunkenPath_6FC59210_113c,
  MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c,
  MISSILES_SetElemLenByEType_6FC594B0_113c,
  MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c,
  MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c,
  MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c,
  MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c,
  MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c,
  MISSILES_SrvDo_ReturnOne_6FC58EC0_113c,
  MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c,
  MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c,
  MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c,
  MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c,
  MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c,
  MISSILES_SrvHit_CopyColdLenToFrzLen_6FC59040_113c,
  MISSILES_SrvHit_MoveColdLenToFrzLen_6FC58E70_113c,
  MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c,
  MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c,
  MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c,
  MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c,
  MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c,
  OBJECTS_OperateContainer_6FC56B90_113c,
  PLAYER_ApplyDeathExpPenalty_6FC57730_113c,
  PLAYER_FreePlayerCorpses_6FC579E0_113c,
  PLAYER_FreePlayerDataList98_6FC57500_113c,
  PLAYER_GetPlayerDataField48_6FC57440_113c,
  PLAYER_InitPlacedModesAndEvents_6FC57E20_113c,
  PLAYER_SetPlayerDataField48_6FC57480_113c,
  QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c,
  QUESTS_InitAct1Quest3Object_6FC54E10_113c,
  QUESTS_InitAct1Quest4Object_6FC54DA0_113c,
  QUESTS_PackNpcIntroFlags_6FC54C70_113c,
  QUESTS_RefreshInventoryQuestItems_6FC54760_113c,
  QUESTS_SendGameQuestStatePacket29_6FC55030_113c,
  QUESTS_SetNpcIntroFlags_6FC54D00_113c,
  QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c,
  QUESTS_TriggerCallback00_6FC54660_113c,
  QUESTS_TriggerCallback0B_6FC55C90_113c,
  SKILLS_RedemptionCorpseCallback_6FC59930_113c,
  SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c,
  SKILLS_StatListExpireClearState_6FC62290_113c,
} from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  bindRoomCollisionGrid113c,
  ensureD2CommonPathGlobals113c,
} from '../../../src/d2kern-113c/game/tables-bootstrap-113c.ts'
import {
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { D2MonLvlTxt_SIZE } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface LaneKTestWorld {
  m: SparseMemory113c
  pDataTables: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pMissilesTxt: number
  pSkillsTxt: number
  pObjectsTxt: number
  pItemsTxt: number
  pLevelsTxt: number
  pIscTxt: number
  pStatesTxt: number
  pDiffTxt: number
  pExpBin: number
  pSkillCode: number
}

function createLaneKWorld(): LaneKTestWorld {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1200)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fdd90b0, m.u32(0x6fd18be0))

  // ItemStatCost (400 records * 0x144)
  const iscCount = 400
  const pIscTxt = m.alloc(iscCount * 0x144)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt, pIscTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount, iscCount)

  // StatesTxt (200 records * 0x40) + corpse state mask at +0x150 + fStateMasks at +0x110
  const statesCount = 200
  const pStatesTxt = m.alloc(statesCount * 0x40)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pStatesTxt, pStatesTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nStatesTxtRecordCount, statesCount)
  const pCorpseStateMask = m.alloc(0x20)
  m.setU32(pDataTables + 0x150, pCorpseStateMask)

  // SkillCalc RPN bytecode buffer at +0x40 / +0x44
  const skillCodeSize = 0x200
  const pSkillCode = m.alloc(skillCodeSize)
  m.setU32(pDataTables + 0x40, pSkillCode)
  m.setU32(pDataTables + 0x44, skillCodeSize)

  // MonStatsTxt (500 * 0x1A8) & MonStats2Txt (500 * 0x134)
  const monCount = 500
  const pMonStatsTxt = m.alloc(monCount * 0x1a8)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pMonStatsTxt, pMonStatsTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nMonStatsTxtRecordCount, monCount)
  const pMonStats2Txt = m.alloc(monCount * 0x134)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pMonStats2Txt, pMonStats2Txt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nMonStats2TxtRecordCount, monCount)
  for (let i = 0; i < monCount; i++) {
    m.setU16(pMonStatsTxt + i * 0x1a8 + 0x18, i)
  }

  // SuperUniques count
  m.setU32(pDataTables + 0xa74, 66)
  m.setU32(0x6fdf0dc4, 66)

  // MissilesTxt (400 * 0x1A4)
  const missilesCount = 400
  const pMissilesTxt = m.alloc(missilesCount * 0x1a4)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pMissilesTxt, pMissilesTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nMissilesTxtRecordCount, missilesCount)

  // SkillsTxt (300 * 0x23C)
  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pSkillsTxt, pSkillsTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nSkillsTxtRecordCount, skillsCount)

  // OverlayTxt count at +0xBC0 & +0xBBC
  const overlayCount = 200
  const pOverlayTxt = m.alloc(overlayCount * 0x88)
  m.setU32(pDataTables + 0xbbc, pOverlayTxt)
  m.setU32(pDataTables + 0xbc0, overlayCount)

  // LevelsTxt (140 * 0x220) + Act level IDs table at 0x6fde4084
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * 0x220)
  m.setU32(pDataTables + 0xbb8, pLevelsTxt)
  m.setU32(0x6fdf1434, pLevelsTxt)
  m.setU32(0x6fdf1438, levelsCount)
  const actBounds = [1, 40, 75, 103, 109, 137]
  for (let i = 0; i < actBounds.length; i++) {
    m.setU32(0x6fde4084 + i * 4, actBounds[i]!)
  }

  // ObjectsTxt (600 * 0x1C0) at 0x6fdf0b94 / 0x6fdf0b98
  const objectsCount = 600
  const pObjectsTxt = m.alloc(objectsCount * 0x1c0)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, objectsCount)

  // ItemsTxt (100 * 0x1A8)
  const itemsCount = 100
  const pItemsTxt = m.alloc(itemsCount * 0x1a8)
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, itemsCount)

  // DifficultyLevels / MonLvl (4 * D2MonLvlTxt_SIZE)
  const pDiffTxt = m.alloc(4 * D2MonLvlTxt_SIZE)
  m.setU32(0x6fdf0b54, pDiffTxt)
  m.setU32(0x6fdf0b58, 4)

  // Experience.bin (105 levels * 8 dwords)
  const pExpBin = m.alloc(105 * 8 * 4)
  m.setU32(0x6fdf0b50, pExpBin)

  ensureD2CommonPathGlobals113c(m)

  return {
    m,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pMissilesTxt,
    pSkillsTxt,
    pObjectsTxt,
    pItemsTxt,
    pLevelsTxt,
    pIscTxt,
    pStatesTxt,
    pDiffTxt,
    pExpBin,
    pSkillCode,
  }
}

function allocGameWithTimer(m: SparseMemory113c, frame = 100, difficulty = 0): number {
  const pGame = m.alloc(0x1df4)
  m.setU8(pGame + 0x6d, difficulty)
  m.setU32(pGame + 0xa8, frame)
  EVENT_InitTimerQueue113c(m, pGame)
  return pGame
}

function attachStatListEx(m: SparseMemory113c, pUnit: number): number {
  const pStatListEx = STATLIST_CreateEx113c(m, pUnit, 0, 0)
  m.setU32(pUnit + 0x5c, pStatListEx)
  return pStatListEx
}

function allocRoomWithLevel(
  m: SparseMemory113c,
  levelId: number,
  subX = 100,
  subY = 200,
  subW = 40,
  subH = 40,
): { pRoom: number; pRoomEx: number; pLevel: number; pAct: number } {
  const pRoom = m.alloc(0x80)
  const pRoomEx = m.alloc(0x100)
  const pLevel = m.alloc(0x230)
  const pAct = m.alloc(0x80)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x2c, pAct)
  m.setU32(pRoom + 0x4c, subX >>> 0)
  m.setU32(pRoom + 0x50, subY >>> 0)
  m.setU32(pRoom + 0x54, subW >>> 0)
  m.setU32(pRoom + 0x58, subH >>> 0)
  m.setU32(pRoomEx + 0x58, pLevel)
  m.setU32(pLevel + 0x1d0, levelId)
  bindRoomCollisionGrid113c(m, pRoom, subX, subY, subW, subH, () => 0)
  return { pRoom, pRoomEx, pLevel, pAct }
}

function allocMissileUnit(
  m: SparseMemory113c,
  classId: number,
  unitId = 500,
  opts?: {
    totalFrames?: number
    remFrames?: number
    skillId?: number
    level?: number
    targetX?: number
    ownerType?: number
    ownerId?: number
    hasOwnerFlag?: boolean
    pRoom?: number
    x?: number
    y?: number
  },
): { pMissile: number; pMissileData: number; pDynPath: number } {
  const pMissile = m.alloc(0x100)
  const pMissileData = m.alloc(0x40)
  const pDynPath = m.alloc(0x1ec)
  m.setU32(pMissile, 3) // UNIT_MISSILE
  m.setU32(pMissile + 0x04, classId)
  m.setU32(pMissile + 0x0c, unitId)
  m.setU32(pMissile + 0x14, pMissileData)
  m.setU32(pMissile + 0x2c, pDynPath)
  m.setU32(pDynPath + 0x30, pMissile)

  if (opts !== undefined) {
    if (opts.totalFrames !== undefined) m.setU16(pMissileData + 0x0e, opts.totalFrames & 0xffff)
    if (opts.remFrames !== undefined) m.setU16(pMissileData + 0x10, opts.remFrames & 0xffff)
    if (opts.skillId !== undefined) m.setU16(pMissileData + 0x0a, opts.skillId & 0xffff)
    if (opts.level !== undefined) m.setU16(pMissileData + 0x0c, opts.level & 0xffff)
    if (opts.targetX !== undefined) m.setU32(pMissileData + 0x28, opts.targetX >>> 0)
    if (opts.ownerType !== undefined) m.setU32(pMissile + 0x94, opts.ownerType >>> 0)
    if (opts.ownerId !== undefined) m.setU32(pMissile + 0x98, opts.ownerId >>> 0)
    if (opts.hasOwnerFlag) m.setU32(pMissile + 0xc8, 0x400)
    if (opts.pRoom !== undefined) m.setU32(pDynPath + 0x1c, opts.pRoom)
    if (opts.x !== undefined) {
      m.setU16(pDynPath + 0x02, opts.x & 0xffff)
      m.setU16(pDynPath + 0x10, opts.x & 0xffff)
    }
    if (opts.y !== undefined) {
      m.setU16(pDynPath + 0x06, opts.y & 0xffff)
      m.setU16(pDynPath + 0x12, opts.y & 0xffff)
    }
  }
  return { pMissile, pMissileData, pDynPath }
}

describe('Milestone 33 [K2] Lane K2-K: 45 D2Game 0x6FC54660..0x6FC62290 Functions', () => {
  it('exports exact 45 113c-suffixed kernel functions with zero legacy reachability', () => {
    const names = Object.keys(laneKExports)
    expect(names.length).toBe(45)
    for (const name of names) {
      expect(name.endsWith('113c')).toBe(true)
      expect(typeof (laneKExports as Record<string, unknown>)[name]).toBe('function')
    }

    const entry = 'src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c.ts'
    const graph = collectImportGraph(REPO_ROOT_113C, [entry])
    expect(legacyReachable(graph, [entry])).toEqual([])
    expect(graph.files.has('src/d2kern-113c/game/fallen-ai-113c.ts')).toBe(false)
  })

  it('ports QUESTS_TriggerCallback00_6FC54660_113c (0x6FC54660)', () => {
    const { m } = createLaneKWorld()
    expect(() => QUESTS_TriggerCallback00_6FC54660_113c(m, 0, 0, 0, 0)).toThrow(/0x996|2454/)

    const pGame = allocGameWithTimer(m)
    const { pRoom } = allocRoomWithLevel(m, 2) // Act 0 (Blood Moor)
    const pPlayer = m.alloc(0x100)
    const pDynPath = m.alloc(0x80)
    m.setU32(pDynPath + 0x1c, pRoom)
    m.setU32(pPlayer + 0x2c, pDynPath)

    const pClient = m.alloc(0x200)
    m.setU32(pClient + 0x1a8, pGame)

    const pQuestCtrl = m.alloc(0x10)
    const pQuest = m.alloc(0x100)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl, pQuest)
    m.setU8(pQuest + 0x08, 0) // Act 0
    m.setU32(pQuest + 0xa0, 0x6fc80000) // cbIdx 0

    const seen: Array<{ cbVa: number; cbType: number; pTarget: number; pPlayer: number; extra: number }> = []
    QUESTS_TriggerCallback00_6FC54660_113c(m, pClient, pPlayer, 0x1234, 0x77, {
      onQuestCallback: (mem, cbVa, _pq, pArg) => {
        seen.push({
          cbVa,
          cbType: mem.u32(pArg + 0x04),
          pTarget: mem.u32(pArg + 0x08),
          pPlayer: mem.u32(pArg + 0x0c),
          extra: mem.u32(pArg + 0x14),
        })
      },
    })
    expect(seen).toEqual([
      { cbVa: 0x6fc80000, cbType: 0, pTarget: 0x1234, pPlayer, extra: 0x77 },
    ])
  })

  it('ports QUESTS_RefreshInventoryQuestItems_6FC54760_113c (0x6FC54760)', () => {
    const { m, pItemsTxt } = createLaneKWorld()
    const pGame = allocGameWithTimer(m)
    const pPlayer = m.alloc(0x100)
    const pInv = m.alloc(0x40)
    m.setU32(pInv, INVENTORY_SIGNATURE_113C)
    m.setU32(pPlayer + 0x60, pInv)

    // Item 1: classId 10 -> nQuest = 4 (quest index 3)
    m.setU8(pItemsTxt + 10 * 0x1a8 + 0x12a, 4)
    // Item 2: classId 11 -> nQuest = 0 (non-quest item)
    m.setU8(pItemsTxt + 11 * 0x1a8 + 0x12a, 0)

    const pItem1 = m.alloc(0x100)
    const pItemData1 = m.alloc(0x80)
    const pItem2 = m.alloc(0x100)
    const pItemData2 = m.alloc(0x80)
    m.setU32(pItem1, 4)
    m.setU32(pItem1 + 0x04, 10)
    m.setU32(pItem1 + 0x14, pItemData1)
    m.setU32(pItemData1 + 0x64, pItem2) // pNextItem in D2ItemDataStrc
    m.setU32(pItem2, 4)
    m.setU32(pItem2 + 0x04, 11)
    m.setU32(pItem2 + 0x14, pItemData2)
    m.setU32(pInv + 0x0c, pItem1) // pFirstItem

    const pQuestCtrl = m.alloc(0x10)
    const pQuest3 = m.alloc(0x100)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl, pQuest3)
    m.setU32(pQuest3, 3) // nQuestNo = 3
    m.setU32(pQuest3 + 0xc4, 0x6fc854a0) // cbIdx 9
    m.setU32(pQuest3 + 0xa0 + 10 * 4, 0x6fc85500) // cbIdx 10

    const events: Array<{ va: number; cbIdx: number; target: number }> = []
    QUESTS_RefreshInventoryQuestItems_6FC54760_113c(m, pPlayer, pGame, {
      onQuestCallback: (mem, va, _pq, pArg) => {
        events.push({ va, cbIdx: mem.u32(pArg + 0x04), target: mem.u32(pArg + 0x08) })
      },
    })
    expect(events).toEqual([
      { va: 0x6fc854a0, cbIdx: 9, target: pItem1 },
      { va: 0x6fc85500, cbIdx: 10, target: pItem1 },
    ])

    // Bad code pointer at +0xC4 asserts line 0x2DE
    m.setU32(pQuest3 + 0xc4, 0x00001234)
    expect(() => QUESTS_RefreshInventoryQuestItems_6FC54760_113c(m, pPlayer, pGame)).toThrow(/0x2de|734/)
  })

  it('ports QUESTS_PackNpcIntroFlags_6FC54C70_113c (0x6FC54C70) and QUESTS_SetNpcIntroFlags_6FC54D00_113c (0x6FC54D00)', () => {
    const { m } = createLaneKWorld()
    const pGame = allocGameWithTimer(m, 50, 1) // Nightmare (diff = 1)
    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x180)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)

    const pIntro = m.alloc(0x10)
    const pBitRecord = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU32(pIntro + 0x04, pBitRecord)
    m.setU32(pPlayerData + 0x60 + 1 * 4, pIntro)

    // 3 NPCs: 147 (bit 1), 154 (bit 5), 520 (bit 34)
    const pSetList = m.alloc(12)
    m.setU32(pSetList, 147)
    m.setU32(pSetList + 4, 154)
    m.setU32(pSetList + 8, 520)

    const pPacket = m.alloc(0x20)
    // Initially empty -> returns 0 and fills 12 words at pPacket + 2 with 0xFFFF
    expect(QUESTS_PackNpcIntroFlags_6FC54C70_113c(m, pPacket, pSetList, pIntro, 3)).toBe(0)
    for (let i = 0; i < 12; i++) {
      expect(m.u16(pPacket + 2 + i * 2)).toBe(0xffff)
    }

    // Set intro bits for [147, 520]
    const pMarkTwo = m.alloc(8)
    m.setU32(pMarkTwo, 147)
    m.setU32(pMarkTwo + 4, 520)
    QUESTS_SetNpcIntroFlags_6FC54D00_113c(m, pPlayer, 2, pGame, pMarkTwo)

    // Pack across [147, 154, 520] -> returns 1 and writes [147, 520, 0xFFFF, ...]
    expect(QUESTS_PackNpcIntroFlags_6FC54C70_113c(m, pPacket, pSetList, pIntro, 3)).toBe(1)
    expect(m.u16(pPacket + 2)).toBe(147)
    expect(m.u16(pPacket + 4)).toBe(520)
    expect(m.u16(pPacket + 6)).toBe(0xffff)
  })

  it('ports QUESTS_InitAct1Quest4Object_6FC54DA0_113c (0x6FC54DA0) and QUESTS_InitAct1Quest3Object_6FC54E10_113c (0x6FC54E10)', () => {
    const { m } = createLaneKWorld()
    const pGame = allocGameWithTimer(m)
    const pObj = m.alloc(0x100)
    const pStaticPath = m.alloc(0x20)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x0c, 0xabc)
    m.setU32(pObj + 0x10, 0)
    m.setU32(pObj + 0x2c, pStaticPath)

    const pObjInit = m.alloc(0x10)
    m.setU32(pObjInit, pGame)
    m.setU32(pObjInit + 0x04, pObj)

    // Without quest 4/3 present -> forces anim mode 2
    QUESTS_InitAct1Quest4Object_6FC54DA0_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(2)

    m.setU32(pObj + 0x10, 0)
    QUESTS_InitAct1Quest3Object_6FC54E10_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(2)

    // Attach Quest 4 and Quest 3
    const pQuestCtrl = m.alloc(0x10)
    const pQuest4 = m.alloc(0x100)
    const pData4 = m.alloc(0x80)
    const pQuest3 = m.alloc(0x100)
    const pData3 = m.alloc(0xb0)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl, pQuest4)
    m.setU32(pQuest4, 4)
    m.setU32(pQuest4 + 0x18, pData4)
    m.setU32(pData4 + 0x54, 1) // custom mode 1
    m.setU32(pQuest4 + 0xf4, pQuest3)
    m.setU32(pQuest3, 3)
    m.setU8(pQuest3 + 0x09, 1) // bNotIntro = 1 -> keeps +0x98 mode
    m.setU32(pQuest3 + 0x18, pData3)
    m.setU32(pData3 + 0x98, 1)

    QUESTS_InitAct1Quest4Object_6FC54DA0_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(1)
    expect(m.u8(pData4 + 0x48)).toBe(1)
    expect(m.u32(pData4 + 0x34)).toBe(0xabc)

    m.setU32(pObj + 0x10, 0)
    QUESTS_InitAct1Quest3Object_6FC54E10_113c(m, pObjInit)
    expect(m.u8(pData3 + 0x01)).toBe(1)
    expect(m.u32(pData3 + 0x04)).toBe(0xabc)
    expect(m.u32(pObj + 0x10)).toBe(1)

    // Quest 3 with bNotIntro == 0 overrides +0x98 to 2
    m.setU8(pQuest3 + 0x09, 0)
    QUESTS_InitAct1Quest3Object_6FC54E10_113c(m, pObjInit)
    expect(m.u32(pData3 + 0x98)).toBe(2)
    expect(m.u32(pObj + 0x10)).toBe(2)
  })

  it('ports QUESTS_SendGameQuestStatePacket29_6FC55030_113c (0x6FC55030)', () => {
    const { m } = createLaneKWorld()
    const pGame = allocGameWithTimer(m)
    const pQuestCtrl = m.alloc(0x20)
    m.setU32(pGame + 0x10f4, pQuestCtrl)

    const pClient = m.alloc(0x200)
    const pQueue = m.alloc(0x40c)
    m.setU32(pClient + 0x1bc, pQueue)

    // Uninitialized (+0x08 == 0) -> asserts 0x7DD
    expect(() => QUESTS_SendGameQuestStatePacket29_6FC55030_113c(m, pGame, pClient)).toThrow(/0x7dd|2013/)

    const pQuestRec = QUESTRECORD_AllocRecord113c(m, 0)
    const pRawBuf = m.u32(pQuestRec)
    m.setU8(pRawBuf, 0xa5)
    m.setU8(pRawBuf + 0x5f, 0x5a)
    m.setU32(pQuestCtrl + 0x08, 1)
    m.setU32(pQuestCtrl + 0x0c, pQuestRec)

    QUESTS_SendGameQuestStatePacket29_6FC55030_113c(m, pGame, pClient)
    expect(m.u32(pQueue + 0x00)).toBe(0x61)
    expect(m.u8(pQueue + 0x04)).toBe(0x29)
    expect(m.u8(pQueue + 0x05)).toBe(0xa5)
    expect(m.u8(pQueue + 0x04 + 0x60)).toBe(0x5a)
  })

  it('ports QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c (0x6FC55A20)', () => {
    const { m } = createLaneKWorld()
    const pGame = allocGameWithTimer(m, 100, 2) // Hell (diff = 2)
    const { pRoom } = allocRoomWithLevel(m, 1)

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x180)
    const pDynPath = m.alloc(0x80)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 42)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pDynPath + 0x1c, pRoom)
    m.setU32(pPlayer + 0x2c, pDynPath)
    const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU32(pPlayerData + 0x10 + 2 * 4, pQuestFlags)
    SUNIT_InsertServerUnit113c(m, pGame, pPlayer)

    const pGuidList = m.alloc(0x84)
    m.setU32(pGuidList, 42)
    m.setU16(pGuidList + 0x80, 1)

    QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c(m, 5, pGame, pGuidList, 0x19)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0x0d)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 1)).toBe(1)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x19)
    expect(m.u32(pPlayer + 0x70)).toBe(pPlayer)
    expect((m.u32(pPlayer + 0xc4) & 0x400) !== 0).toBe(true)
  })

  it('ports QUESTS_TriggerCallback0B_6FC55C90_113c (0x6FC55C90)', () => {
    const { m } = createLaneKWorld()
    const pGame = allocGameWithTimer(m)
    const { pRoom } = allocRoomWithLevel(m, 1)
    const pPlayer = m.alloc(0x100)
    const pDynPath = m.alloc(0x80)
    m.setU32(pDynPath + 0x1c, pRoom)
    m.setU32(pPlayer + 0x2c, pDynPath)

    const pMonster = m.alloc(0x100)
    m.setU32(pMonster, 1)
    m.setU32(pMonster + 0x04, 150) // Kashya
    m.setU32(pMonster + 0x0c, 77)
    SUNIT_InsertServerUnit113c(m, pGame, pMonster)

    const pQuestCtrl = m.alloc(0x10)
    const pQuest = m.alloc(0x100)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl, pQuest)
    m.setU8(pQuest + 0x08, 0)
    m.setU32(pQuest + 0xa0 + 0x0b * 4, 0x6fc81000)

    const calls: Array<{ target: number; monClass: number; msgId: number }> = []
    QUESTS_TriggerCallback0B_6FC55C90_113c(m, pGame, 77, pPlayer, 0x123, {
      onQuestCallback: (mem, _va, _pq, pArg) => {
        calls.push({
          target: mem.u32(pArg + 0x08),
          monClass: mem.u32(pArg + 0x14),
          msgId: mem.u32(pArg + 0x18),
        })
      },
    })
    expect(calls).toEqual([{ target: pMonster, monClass: 150, msgId: 0x123 }])

    // Target GUID == -1 passes NULL monster and 0 classId
    calls.length = 0
    QUESTS_TriggerCallback0B_6FC55C90_113c(m, pGame, -1, pPlayer, 0x456, {
      onQuestCallback: (mem, _va, _pq, pArg) => {
        calls.push({
          target: mem.u32(pArg + 0x08),
          monClass: mem.u32(pArg + 0x14),
          msgId: mem.u32(pArg + 0x18),
        })
      },
    })
    expect(calls).toEqual([{ target: 0, monClass: 0, msgId: 0x456 }])
  })

  it('ports QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c (0x6FC56820)', () => {
    const { m } = createLaneKWorld()
    const pGame = allocGameWithTimer(m)
    const { pRoom } = allocRoomWithLevel(m, 2, 100, 200, 40, 40)

    const pPlayer = m.alloc(0x100)
    const pDynPath = m.alloc(0x80)
    m.setU32(pDynPath + 0x1c, pRoom)
    m.setU32(pPlayer + 0x2c, pDynPath)

    const pCoord = m.alloc(8)
    m.setU32(pCoord, 110)
    m.setU32(pCoord + 4, 215)

    // nType = 1 (direct MonStats index 25)
    let spawnedInfo: { cid: number; x: number; y: number; mode: number } | null = null
    const res1 = QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c(m, 25, 1, pCoord, pGame, pPlayer, {
      spawnAtCoords: (_mem, cid, mode, _pg, _pr, x, y) => {
        spawnedInfo = { cid, x, y, mode }
        return 0xbeef01
      },
    })
    expect(res1).toBe(0xbeef01)
    expect(spawnedInfo).toEqual({ cid: 25, x: 110, y: 215, mode: 1 })

    // nType = 2 (MonPreset index: MonStatsCount 500 + 25 = 525 -> resolved via getMonPresetRecord)
    spawnedInfo = null
    const res2 = QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c(m, 25, 2, pCoord, pGame, pPlayer, {
      getMonPresetRecord: (_mem, _act, placeId) => (placeId === 525 ? 88 : -1),
      spawnAtCoords: (_mem, cid, mode, _pg, _pr, x, y) => {
        spawnedInfo = { cid, x, y, mode }
        return 0xbeef02
      },
    })
    expect(res2).toBe(0xbeef02)
    expect(spawnedInfo).toEqual({ cid: 88, x: 110, y: 215, mode: 1 })

    // Out-of-bounds coord not in room or adjacent rooms returns 0
    m.setU32(pCoord, 9999)
    expect(QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c(m, 25, 1, pCoord, pGame, pPlayer)).toBe(0)
  })

  it('ports OBJECTS_OperateContainer_6FC56B90_113c (0x6FC56B90)', () => {
    const { m, pObjectsTxt } = createLaneKWorld()
    const pGame = allocGameWithTimer(m, 300)
    const pObj = m.alloc(0x100)
    const pStaticPath = m.alloc(0x20)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x04, 5)
    m.setU32(pObj + 0x0c, 88)
    m.setU32(pObj + 0x10, 0) // OBJMODE_NEUTRAL
    m.setU32(pObj + 0x2c, pStaticPath)
    m.setU32(pObj + 0xc4, 0x07) // bit 0x02 set

    m.setU8(pObjectsTxt + 5 * 0x1c0 + 0x140, 1) // bHasOpAnim = 1
    m.setU32(pObjectsTxt + 5 * 0x1c0 + 0xdc, 12 << 8) // 12 frames

    const pOp = m.alloc(0x20)
    m.setU32(pOp, pGame)
    m.setU32(pOp + 0x04, pObj)
    m.setU32(pOp + 0x10, 5)

    expect(OBJECTS_OperateContainer_6FC56B90_113c(m, pOp)).toBe(1)
    expect(m.u32(pObj + 0x10)).toBe(1) // OBJMODE_OPERATING
    expect(m.u32(pObj + 0xc4)).toBe(0x05) // bit 0x02 cleared
    expect(EVENT_GetNextEventFrame113c(m, pObj, 1)).toBe(312)

    // Already opened (mode != 0) -> returns 0
    expect(OBJECTS_OperateContainer_6FC56B90_113c(m, pOp)).toBe(0)

    // bHasOpAnim == 0 -> transitions directly to mode 2 without scheduling event
    m.setU32(pObj + 0x10, 0)
    m.setU8(pObjectsTxt + 5 * 0x1c0 + 0x140, 0)
    expect(OBJECTS_OperateContainer_6FC56B90_113c(m, pOp)).toBe(1)
    expect(m.u32(pObj + 0x10)).toBe(2)
  })

  it('ports PLAYER_GetPlayerDataField48_6FC57440_113c, PLAYER_SetPlayerDataField48_6FC57480_113c, and PLAYER_FreePlayerDataList98_6FC57500_113c', () => {
    const { m } = createLaneKWorld()
    expect(() => PLAYER_GetPlayerDataField48_6FC57440_113c(m, 0)).toThrow(/0x24c|588/)
    expect(() => PLAYER_SetPlayerDataField48_6FC57480_113c(m, 0, 1)).toThrow(/0x23f|575/)

    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    expect(() => PLAYER_GetPlayerDataField48_6FC57440_113c(m, pPlayer)).toThrow(/0x24f|591/)
    expect(() => PLAYER_SetPlayerDataField48_6FC57480_113c(m, pPlayer, 1)).toThrow(/0x242|578/)

    const pPlayerData = m.alloc(0x180)
    m.setU32(pPlayer + 0x14, pPlayerData)

    PLAYER_SetPlayerDataField48_6FC57480_113c(m, pPlayer, 0xdeadbeef)
    expect(PLAYER_GetPlayerDataField48_6FC57440_113c(m, pPlayer)).toBe(0xdeadbeef)

    const pGame = allocGameWithTimer(m)
    const n1 = m.alloc(0x18)
    const n2 = m.alloc(0x18)
    m.setU32(n1 + 0x10, n2)
    m.setU32(n2 + 0x10, 0)
    m.setU32(pPlayerData + 0x98, n1)

    PLAYER_FreePlayerDataList98_6FC57500_113c(m, pPlayerData, pGame)
    expect(m.u32(pPlayerData + 0x98)).toBe(0)
  })

  it('ports PLAYER_ApplyDeathExpPenalty_6FC57730_113c (0x6FC57730)', () => {
    const { m, pDiffTxt, pExpBin } = createLaneKWorld()
    // Hell difficulty (2): 10% XP penalty (+0x04 = 10)
    m.setU32(pDiffTxt + 2 * D2MonLvlTxt_SIZE + 0x04, 10)
    // Class 0: level 9 start = 10,000, level 10 start = 20,000 (span = 10,000 -> 10% = 1,000)
    m.setU32(pExpBin + (0 + 9 * 8 + 8) * 4, 10000)
    m.setU32(pExpBin + (0 + 10 * 8 + 8) * 4, 20000)

    const pGame = allocGameWithTimer(m, 100, 2)
    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x180)
    const pClient = m.alloc(0x520)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x04, 0)
    m.setU32(pPlayer + 0x0c, 1)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x9c, pClient)
    attachStatListEx(m, pPlayer)

    // Mid-level deduction: 15,000 - 1,000 = 14,000, lostExp = 1,000
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 10, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0d, 15000, 0)
    PLAYER_ApplyDeathExpPenalty_6FC57730_113c(m, pGame, pPlayer)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0x0d, 0)).toBe(14000)
    expect(m.u32(pClient + 0x508)).toBe(1000)

    // Floor clamp: 10,300 - 1,000 clamps to 10,001, lostExp = 300 (10,300 - 10,000)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0d, 10300, 0)
    PLAYER_ApplyDeathExpPenalty_6FC57730_113c(m, pGame, pPlayer)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0x0d, 0)).toBe(10001)
    expect(m.u32(pClient + 0x508)).toBe(300)
  })

  it('ports PLAYER_FreePlayerCorpses_6FC579E0_113c (0x6FC579E0)', () => {
    const { m } = createLaneKWorld()
    const pGame = allocGameWithTimer(m)
    const { pRoom } = allocRoomWithLevel(m, 2)

    const pPlayer = m.alloc(0x100)
    const pInv = m.alloc(0x40)
    m.setU32(pInv, INVENTORY_SIGNATURE_113C)
    m.setU32(pPlayer + 0x60, pInv)

    // Corpse player unit GUID 99 in game hash table
    const pCorpseUnit = m.alloc(0x100)
    const pCorpseData = m.alloc(0x180)
    const pDynPath = m.alloc(0x80)
    m.setU32(pCorpseUnit, 0)
    m.setU32(pCorpseUnit + 0x0c, 99)
    m.setU32(pCorpseUnit + 0x14, pCorpseData)
    for (let i = 0; i < 3; i++) {
      const pWp = m.alloc(0x20)
      m.setU16(pWp, 0x0102)
      m.setU32(pCorpseData + 0x1c + i * 4, pWp)
    }
    m.setU32(pCorpseUnit + 0xd0, 0x0b)
    m.setU32(pDynPath + 0x1c, pRoom)
    m.setU32(pDynPath + 0x30, pCorpseUnit)
    m.setU32(pCorpseUnit + 0x2c, pDynPath)
    SUNIT_InsertServerUnit113c(m, pGame, pCorpseUnit)

    const pCorpseRec = m.alloc(0x10)
    m.setU32(pCorpseRec + 0x04, 99) // unitId at +0x04
    m.setU32(pInv + 0x34, pCorpseRec) // D2InventoryStrc.pFirstCorpse (+0x34)

    PLAYER_FreePlayerCorpses_6FC579E0_113c(m, pPlayer, pGame)
    // Portal node prepended on room (+0x18) with corpse type (0) and guid (99)
    const pPortalNode = m.u32(pRoom + 0x18)
    expect(pPortalNode).not.toBe(0)
    expect(m.u32(pPortalNode)).toBe(0)
    expect(m.u32(pPortalNode + 0x04)).toBe(99)
    // Corpse unlinked from game player hash bucket
    expect(m.u32(pGame + 0x1120 + (99 & 0x7f) * 4)).toBe(0)
  })

  it('ports PLAYER_InitPlacedModesAndEvents_6FC57E20_113c (0x6FC57E20)', () => {
    const { m } = createLaneKWorld()
    expect(() => PLAYER_InitPlacedModesAndEvents_6FC57E20_113c(m, 0, 0, 0, 0)).toThrow(/0x804|2052/)

    const pGame = allocGameWithTimer(m, 400)
    const pPlayer = m.alloc(0x100)
    const pInv = m.alloc(0x40)
    const pCursorItem = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 7)
    m.setU32(pPlayer + 0x10, 9) // custom mode preserved when cursor item present
    m.setU32(pInv, INVENTORY_SIGNATURE_113C)
    m.setU32(pInv + 0x20, pCursorItem) // pCursorItem != 0
    m.setU32(pPlayer + 0x60, pInv)

    PLAYER_InitPlacedModesAndEvents_6FC57E20_113c(m, pGame, pPlayer, 100, 200)
    expect(m.u32(pPlayer + 0x10)).toBe(9)
    expect(EVENT_GetNextEventFrame113c(m, pPlayer, 3)).toBe(401)
    expect(EVENT_GetNextEventFrame113c(m, pPlayer, 0x0b)).toBe(650)
  })

  it('ports simple missile SrvDo/SrvHit helpers (0x6FC58E70, 0x6FC58E90, 0x6FC58EA0, 0x6FC58EC0, 0x6FC59040)', () => {
    const { m } = createLaneKWorld()
    const pDmg = m.alloc(0x70)
    m.setU32(pDmg + 0x30, 75)
    MISSILES_SrvHit_MoveColdLenToFrzLen_6FC58E70_113c(m, 0, 0, 0, pDmg)
    expect(m.u32(pDmg + 0x30)).toBe(0)
    expect(m.u32(pDmg + 0x34)).toBe(75)

    expect(MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c(m, 0, 0, 0)).toBe(0)
    expect(MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c(m, 0, 0, 1)).toBe(2)
    expect(MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c(m, 0, 0, -5)).toBe(2)

    const { pRoom, pRoomEx } = allocRoomWithLevel(m, 2)
    m.setU32(pRoomEx + 0x28, 0x400000) // DRLGROOMFLAG_HAS_PORTAL_113C set
    const { pMissile } = allocMissileUnit(m, 10, 501, { pRoom })
    expect(MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c(m, 0, pMissile, 1)).toBe(0)
    expect(m.u32(pRoomEx + 0x28)).toBe(0x400000)
    expect(MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c(m, 0, pMissile, 0)).toBe(0)
    expect(m.u32(pRoomEx + 0x28)).toBe(0)

    expect(MISSILES_SrvDo_ReturnOne_6FC58EC0_113c(m, 0, 0, 0)).toBe(1)

    m.setU32(pDmg + 0x30, 120)
    m.setU32(pDmg + 0x34, 0)
    MISSILES_SrvHit_CopyColdLenToFrzLen_6FC59040_113c(m, 0, pMissile, 0, pDmg)
    expect(m.u32(pDmg + 0x30)).toBe(120)
    expect(m.u32(pDmg + 0x34)).toBe(120)
  })

  it('ports MISSILES_ConsumePierceStat_6FC58F40_113c (0x6FC58F40) and MISSILES_FilterFlagBit4Missile_6FC59510_113c (0x6FC59510)', () => {
    const { m, pMissilesTxt } = createLaneKWorld()
    const { pMissile } = allocMissileUnit(m, 12, 502)
    attachStatListEx(m, pMissile)
    STATLIST_SetUnitStat113c(m, pMissile, 0x148, 2, 0)

    // Without bit 2 (0x04) in dwFlags -> returns 3 without consuming pierce
    expect(MISSILES_ConsumePierceStat_6FC58F40_113c(m, pMissile)).toBe(3)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x148, 0)).toBe(2)

    // Enable bit 2 (0x04): decrements 2 -> 1 -> 0 (returning 2, 2), then returns 3
    m.setU8(pMissilesTxt + 12 * 0x1a4 + 0x04, 0x04)
    expect(MISSILES_ConsumePierceStat_6FC58F40_113c(m, pMissile)).toBe(2)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x148, 0)).toBe(1)
    expect(MISSILES_ConsumePierceStat_6FC58F40_113c(m, pMissile)).toBe(2)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x148, 0)).toBe(0)
    expect(MISSILES_ConsumePierceStat_6FC58F40_113c(m, pMissile)).toBe(3)

    // Bit 4 (0x10) filter check
    expect(MISSILES_FilterFlagBit4Missile_6FC59510_113c(m, pMissile)).toBe(0)
    m.setU8(pMissilesTxt + 12 * 0x1a4 + 0x04, 0x14)
    expect(MISSILES_FilterFlagBit4Missile_6FC59510_113c(m, pMissile)).toBe(1)
    expect(MISSILES_FilterFlagBit4Missile_6FC59510_113c(m, 0)).toBe(0)
  })

  it('ports MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c (0x6FC58FF0) and MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c (0x6FC591A0)', () => {
    const { m, pMissilesTxt } = createLaneKWorld()
    const { pMissile, pMissileData } = allocMissileUnit(m, 15, 503, {
      totalFrames: 30,
      remFrames: 20, // elapsed = 10
    })
    m.setU16(pMissilesTxt + 15 * 0x1a4 + 0x36, 25) // wProgOverlay = 25
    m.setU32(pMissilesTxt + 15 * 0x1a4 + 0x4c, 15) // dwParam[0] = 15 -> threshold = 30 - 15 = 15

    const pTarget = m.alloc(0x100)
    const pTargetPath = m.alloc(0x80)
    m.setU32(pTarget, 1)
    m.setU32(pTarget + 0x0c, 600)
    m.setU32(pTarget + 0x2c, pTargetPath)
    const pTargetEx = attachStatListEx(m, pTarget)

    MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c(m, 0, pMissile, pTarget, 0)
    expect((m.u32(pTargetEx + 0x10) & 0x100) !== 0).toBe(true)
    expect(STATLIST_GetUnitStat113c(m, pTarget, 0xb2, 0)).toBe(25)

    expect(MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c(m, 0, 0, 1)).toBe(1)
    expect(MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c(m, 0, pMissile, 0)).toBe(0)
    // elapsed (10) < threshold (15) -> returns 2
    expect(MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c(m, 0, pMissile, 1)).toBe(2)
    // elapsed (20) >= threshold (15) -> returns 0
    m.setU16(pMissileData + 0x10, 10)
    expect(MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c(m, 0, pMissile, 1)).toBe(0)
  })

  it('ports MISSILES_InitDrunkenPath_6FC59210_113c (0x6FC59210) and MISSILES_InitChargedBoltPath_6FC61F50_113c (0x6FC61F50)', () => {
    const { m } = createLaneKWorld()
    const { pRoom } = allocRoomWithLevel(m, 2, 100, 200, 80, 80)

    const m1 = allocMissileUnit(m, 20, 504, {
      totalFrames: 300,
      remFrames: 300,
      pRoom,
      x: 110,
      y: 210,
    })
    m.setU16(m1.pDynPath + 0x10, 137) // wTargetX = 137
    m.setU16(m1.pDynPath + 0x12, 230)
    MISSILES_InitDrunkenPath_6FC59210_113c(m, m1.pMissile)
    expect(m.u32(m1.pDynPath + 0x3c)).toBe(10) // PATHTYPE_MISSILE_DRUNKEN
    expect(m.u8(m1.pDynPath + 0x91)).toBe(0x4d) // PATH_SetNewDistance clamps 255 -> 77 (nDistMax +0x91)

    const m2 = allocMissileUnit(m, 21, 505, {
      totalFrames: 90,
      remFrames: 90,
      pRoom,
      x: 110,
      y: 210,
    })
    m.setU16(m2.pDynPath + 0x10, 130) // wTargetX = 130 + nSeedOffset (7) => initial low seed 137
    m.setU16(m2.pDynPath + 0x12, 230)
    MISSILES_InitChargedBoltPath_6FC61F50_113c(m, m2.pMissile, 7)
    expect(m.u16(m2.pMissileData + 0x0e)).toBe(0x4d) // clamped totalFrames to 77
    expect(m.u16(m2.pMissileData + 0x10)).toBe(0x4d) // clamped remFrames to 77
    expect(m.u32(m2.pDynPath + 0x3c)).toBe(10)
    // Identical initial seed (137) + identical start/target coords => identical post-PATH_Compute LCG state
    expect(m.u32(m2.pMissile + 0x20)).toBe(m.u32(m1.pMissile + 0x20))
    expect(m.u32(m2.pMissile + 0x24)).toBe(m.u32(m1.pMissile + 0x24))
  })

  it('ports elemental damage jump-table helpers (0x6FC59260, 0x6FC592E0, 0x6FC594B0)', () => {
    const { m, pMissilesTxt } = createLaneKWorld()
    const { pMissile } = allocMissileUnit(m, 30, 506)
    const pDmg = m.alloc(0x70)

    const eTypeToOff: ReadonlyArray<readonly [number, number]> = [
      [0, 0x08],
      [1, 0x10],
      [2, 0x1c],
      [3, 0x20],
      [4, 0x24],
      [5, 0x28],
      [6, 0x38],
      [7, 0x3c],
      [8, 0x40],
      [9, 0x44],
      [11, 0x14],
    ]
    for (const [et, off] of eTypeToOff) {
      m.fill(pDmg, 0x70, 0)
      m.setU32(pDmg + off, 10)
      m.setU8(pMissilesTxt + 30 * 0x1a4 + 0xe4, et)
      MISSILES_AddElemDamageByEType_6FC59260_113c(m, pMissile, pDmg, 25)
      expect(m.u32(pDmg + off)).toBe(35)
    }

    // eType 12 overwrites +0x24 instead of adding
    m.setU32(pDmg + 0x24, 100)
    m.setU8(pMissilesTxt + 30 * 0x1a4 + 0xe4, 12)
    MISSILES_AddElemDamageByEType_6FC59260_113c(m, pMissile, pDmg, 40)
    expect(m.u32(pDmg + 0x24)).toBe(40)

    // SetElemLenByEType (0x6FC594B0) for eTypes 4, 5, 9, 11, 12
    const lenCases: ReadonlyArray<readonly [number, number]> = [
      [4, 0x30],
      [5, 0x2c],
      [9, 0x44],
      [11, 0x18],
      [12, 0x34],
    ]
    for (const [et, off] of lenCases) {
      m.fill(pDmg, 0x70, 0)
      m.setU8(pMissilesTxt + 30 * 0x1a4 + 0xe4, et)
      MISSILES_SetElemLenByEType_6FC594B0_113c(m, pMissile, pDmg, 88)
      expect(m.u32(pDmg + off)).toBe(88)
    }

    // ResetDamageKeepETypeLen (0x6FC592E0): eType 4 keeps +0x30/+0x34 and clears +0x2C/+0x18
    m.setU32(pDmg, 0x00000fff)
    m.setU32(pDmg + 0x30, 50)
    m.setU32(pDmg + 0x34, 60)
    m.setU32(pDmg + 0x2c, 70)
    m.setU32(pDmg + 0x18, 80)
    m.setU8(pMissilesTxt + 30 * 0x1a4 + 0xe4, 4)
    MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c(m, pMissile, pDmg)
    expect(m.u32(pDmg)).toBe(0x000008ff)
    expect(m.u32(pDmg + 0x30)).toBe(50)
    expect(m.u32(pDmg + 0x34)).toBe(60)
    expect(m.u32(pDmg + 0x2c)).toBe(0)
    expect(m.u32(pDmg + 0x18)).toBe(0)
  })

  it('ports stun/knockback/mana-drain missile callbacks (0x6FC59560, 0x6FC59670, 0x6FC596E0)', () => {
    const { m, pMissilesTxt, pSkillsTxt } = createLaneKWorld()
    const { pMissile } = allocMissileUnit(m, 35, 507, { skillId: 40 })
    const pDmg = m.alloc(0x70)

    // 0x6FC59560: falls back to SkillsTxt.dwParam[2] (+0x14C) when dwHitPar[0] <= 0
    m.setU32(pMissilesTxt + 35 * 0x1a4 + 0x78, 0)
    m.setU32(pSkillsTxt + 40 * 0x23c + 0x14c, 45)
    MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c(m, 0, pMissile, 0, pDmg)
    expect(m.u32(pDmg + 0x44)).toBe(45)
    expect(m.u32(pDmg + 0x60)).toBe(0x60)

    // 0x6FC59670: threshold 128 guarantees knockback bit 0x40 at pDmg + 5
    m.setU32(pMissilesTxt + 35 * 0x1a4 + 0x78, 128)
    m.setU32(pMissile + 0x20, 12345)
    m.setU32(pMissile + 0x24, 67890)
    MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c(m, 0, pMissile, 0, pDmg)
    expect((m.u8(pDmg + 0x05) & 0x40) !== 0).toBe(true)

    // 0x6FC596E0: drains 25% of player's 200 mana -> 150 remaining, returns 2
    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 1)
    attachStatListEx(m, pPlayer)
    STATLIST_SetUnitStat113c(m, pPlayer, 8, 200, 0)
    m.setU32(pMissilesTxt + 35 * 0x1a4 + 0x4c, 25)
    expect(MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c(m, 0, pMissile, pPlayer)).toBe(2)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0)).toBe(150)

    // Zero mana returns 1
    STATLIST_SetUnitStat113c(m, pPlayer, 8, 0, 0)
    expect(MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c(m, 0, pMissile, pPlayer)).toBe(1)
  })

  it('ports SKILLS_RedemptionCorpseCallback_6FC59930_113c (0x6FC59930)', () => {
    const { m, pSkillsTxt, pSkillCode, pMonStats2Txt } = createLaneKWorld()
    // Encode 3 RPN constants in pSkillCode: [0x00] = 100% chance, [0x10] = 50 life, [0x20] = 30 mana
    m.setU8(pSkillCode + 0x00, 9)
    m.setU32(pSkillCode + 0x01, 100)
    m.setU8(pSkillCode + 0x10, 9)
    m.setU32(pSkillCode + 0x11, 50)
    m.setU8(pSkillCode + 0x20, 9)
    m.setU32(pSkillCode + 0x21, 30)

    const pRedemptionTxt = pSkillsTxt + 0x7c * 0x23c
    m.setU32(pRedemptionTxt + 0x138, 0x00)
    m.setU32(pRedemptionTxt + 0x13c, 0x10)
    m.setU32(pRedemptionTxt + 0x140, 0x20)

    const pPaladin = m.alloc(0x100)
    m.setU32(pPaladin, 0)
    m.setU32(pPaladin + 0x0c, 1)
    m.setU32(pPaladin + 0x20, 777)
    m.setU32(pPaladin + 0x24, 666)
    attachStatListEx(m, pPaladin)
    STATLIST_SetUnitStat113c(m, pPaladin, 6, 100 << 8, 0) // curLife = 100
    STATLIST_SetUnitStat113c(m, pPaladin, 7, 140 << 8, 0) // maxLife = 140 (clamps 100 + 50 -> 140)
    STATLIST_SetUnitStat113c(m, pPaladin, 8, 20 << 8, 0) // curMana = 20
    STATLIST_SetUnitStat113c(m, pPaladin, 9, 100 << 8, 0) // maxMana = 100 (20 + 30 = 50)

    // Selectable corpse: monster class 5 (MonStats2 flag bit 7 = 0x80 at +0x04), mode 0x0C (MONMODE_DEAD)
    m.setU8(pMonStats2Txt + 5 * 0x134 + 0x04, 0x80)
    const pCorpse = m.alloc(0x100)
    const pCorpsePath = m.alloc(0x80)
    m.setU32(pCorpse, 1)
    m.setU32(pCorpse + 0x04, 5)
    m.setU32(pCorpse + 0x0c, 200)
    m.setU32(pCorpse + 0x10, 0x0c)
    m.setU32(pCorpse + 0x2c, pCorpsePath)
    m.setU32(pCorpse + 0xc4, 0x07)
    attachStatListEx(m, pCorpse)

    SKILLS_RedemptionCorpseCallback_6FC59930_113c(m, 0, pPaladin, pCorpse, 5)
    expect(STATLIST_GetUnitStat113c(m, pPaladin, 6, 0)).toBe(140 << 8)
    expect(STATLIST_GetUnitStat113c(m, pPaladin, 8, 0)).toBe(50 << 8)
    expect(STATES_CheckState113c(m, pCorpse, 0x63)).toBe(1 << (0x63 & 31))
    expect(m.u32(pCorpse + 0xc4)).toBe(0x01) // bits 0x06 cleared
  })

  it('ports MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c (0x6FC59A40)', () => {
    const { m, pMissilesTxt, pMonStats2Txt } = createLaneKWorld()
    const { pMissile } = allocMissileUnit(m, 45, 508)
    const pDmg = m.alloc(0x70)

    // Monster class 8: small (bit 10 -> byte +0x05 bit 2 = 0x04)
    // Monster class 9: large (bit 11 -> byte +0x05 bit 3 = 0x08)
    m.setU8(pMonStats2Txt + 8 * 0x134 + 0x05, 0x04)
    m.setU8(pMonStats2Txt + 9 * 0x134 + 0x05, 0x08)

    const pSmallMon = m.alloc(0x100)
    m.setU32(pSmallMon, 1)
    m.setU32(pSmallMon + 0x04, 8)

    const pLargeMon = m.alloc(0x100)
    m.setU32(pLargeMon, 1)
    m.setU32(pLargeMon + 0x04, 9)

    // Tier 1 with baseChance = 60: large monster rejected, small monster gets 120% -> guaranteed hit flag 0x08
    m.setU32(pMissilesTxt + 45 * 0x1a4 + 0x78, 1)
    m.setU32(pMissilesTxt + 45 * 0x1a4 + 0x7c, 60)
    m.setU32(pMissile + 0x20, 999)

    MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c(m, 0, pMissile, pLargeMon, pDmg)
    expect(m.u8(pDmg + 0x04)).toBe(0)

    MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c(m, 0, pMissile, pSmallMon, pDmg)
    expect(m.u8(pDmg + 0x04)).toBe(0x08)
  })

  it('ports owner-linked missile callbacks (0x6FC59BD0, 0x6FC59C80, 0x6FC59F70, 0x6FC5A1D0)', () => {
    const { m, pSkillsTxt } = createLaneKWorld()
    const pGame = allocGameWithTimer(m, 100)
    const { pRoom } = allocRoomWithLevel(m, 2, 100, 200, 80, 80)

    const pOwner = m.alloc(0x100)
    const pOwnerPath = m.alloc(0x1ec)
    m.setU32(pOwner, 0)
    m.setU32(pOwner + 0x0c, 11)
    m.setU32(pOwner + 0x2c, pOwnerPath)
    m.setU32(pOwnerPath + 0x1c, pRoom)
    m.setU16(pOwnerPath + 0x02, 135)
    m.setU16(pOwnerPath + 0x06, 245)
    attachStatListEx(m, pOwner)
    SUNIT_InsertServerUnit113c(m, pGame, pOwner)

    // Skill 50 periodic length = 80 (+0x214 = 80, +0x224 = 0xFFFFFFFF)
    m.setU32(pSkillsTxt + 50 * 0x23c + 0x214, 80)
    m.setU32(pSkillsTxt + 50 * 0x23c + 0x224, 0xffffffff)

    const { pMissile, pDynPath } = allocMissileUnit(m, 48, 509, {
      skillId: 50,
      level: 1,
      targetX: 145, // remFrames = 145 - 100 = 45 (in 10..80)
      ownerType: 0,
      ownerId: 11,
      hasOwnerFlag: true,
      pRoom,
      x: 110,
      y: 210,
    })

    const pTarget = m.alloc(0x100)
    m.setU32(pTarget, 1)
    const pDmg = m.alloc(0x70)
    m.setU32(pDmg + 0x28, 300)
    m.setU32(pDmg + 0x2c, 80)

    // 0x6FC59BD0: clamps dwPoisLen to 45 while keeping dwPoisDamage = 300
    MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c(m, pGame, pMissile, pTarget, pDmg)
    expect(m.u32(pDmg + 0x28)).toBe(300)
    expect(m.u32(pDmg + 0x2c)).toBe(45)

    // Out-of-range (< 10 remaining frames) zeroes both +0x28 and +0x2C
    m.setU32(pGame + 0xa8, 140)
    MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c(m, pGame, pMissile, pTarget, pDmg)
    expect(m.u32(pDmg + 0x28)).toBe(0)
    expect(m.u32(pDmg + 0x2c)).toBe(0)

    // 0x6FC59C80: sets 0x20000 on target flags when owner lacks bit 9 (0x200)
    MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c(m, pGame, pMissile, pTarget, pDmg)
    expect((m.u32(pTarget + 0xc4) & 0x20000) !== 0).toBe(true)

    // 0x6FC59F70: Blaze check (0x0D)
    expect(MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c(m, pGame, pMissile, pOwner)).toBe(2)
    STATES_ToggleGfxStateFlag113c(m, pOwner, 0x0d, 1)
    expect(MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c(m, pGame, pMissile, pOwner)).toBe(0)

    // 0x6FC5A1D0: warps missile dynamic path to owner's coordinates (135, 245)
    MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c(m, pGame, pMissile)
    expect(m.u16(pDynPath + 0x02)).toBe(135)
    expect(m.u16(pDynPath + 0x06)).toBe(245)
  })

  it('ports missile monster spawners and Town Portal activator (0x6FC5BC80, 0x6FC5BD10, 0x6FC5E670)', () => {
    const { m, pSkillsTxt, pMissilesTxt, pObjectsTxt } = createLaneKWorld()
    const pGame = allocGameWithTimer(m, 500)
    const { pRoom, pRoomEx } = allocRoomWithLevel(m, 2, 100, 200, 80, 80)

    // Owner with skill 60 whose Param1 == 333
    const pOwner = m.alloc(0x100)
    const pSkillList = m.alloc(0x20)
    const pSkill = m.alloc(0x40)
    const pSkTxt60 = pSkillsTxt + 60 * 0x23c
    m.setU16(pSkTxt60, 60)
    m.setU32(pSkill, pSkTxt60)
    m.setU32(pSkill + 0x28, 1) // nSkillLevel = 1
    m.setU32(pSkill + 0x18, 333) // D2SkillStrc.dwParam1 (+0x18) = 333
    m.setU32(pSkillList + 0x04, pSkill) // D2SkillListStrc.pFirstSkill (+0x04)
    m.setU32(pOwner, 0)
    m.setU32(pOwner + 0x0c, 21)
    m.setU32(pOwner + 0xa8, pSkillList)
    SUNIT_InsertServerUnit113c(m, pGame, pOwner)

    const { pMissile } = allocMissileUnit(m, 55, 510, {
      skillId: 60,
      targetX: 707, // portal object GUID
      ownerType: 0,
      ownerId: 21,
      hasOwnerFlag: true,
      pRoom,
      x: 122,
      y: 233,
    })

    const spawns: Array<{ cid: number; mode: number; x: number; y: number }> = []
    expect(
      MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c(m, pGame, pMissile, 0, {
        spawnAtCoords: (_mem, cid, mode, _pg, _pr, x, y) => {
          spawns.push({ cid, mode, x, y })
          return 1
        },
      }),
    ).toBe(1)
    expect(spawns).toEqual([{ cid: 333, mode: 1, x: 122, y: 233 }])

    // 0x6FC5BD10: dwParam[0] = 240, dwParam[1] = 8
    spawns.length = 0
    m.setU32(pMissilesTxt + 55 * 0x1a4 + 0x4c, 240)
    m.setU32(pMissilesTxt + 55 * 0x1a4 + 0x50, 8)
    expect(
      MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c(m, pGame, pMissile, 0, {
        spawnAtCoords: (_mem, cid, mode, _pg, _pr, x, y) => {
          spawns.push({ cid, mode, x, y })
          return 1
        },
      }),
    ).toBe(1)
    expect(spawns).toEqual([{ cid: 240, mode: 8, x: 122, y: 233 }])

    // 0x6FC5E670: Town Portal object GUID 707 in game object hash table (+0x1520)
    const pPortal = m.alloc(0x100)
    const pPortalPath = m.alloc(0x20)
    m.setU32(pPortal, 2) // UNIT_OBJECT
    m.setU32(pPortal + 0x04, 59) // Town Portal object class
    m.setU32(pPortal + 0x0c, 707)
    m.setU32(pPortal + 0x10, 0) // OBJMODE_NEUTRAL
    m.setU32(pPortalPath, pRoom)
    m.setU32(pPortal + 0x2c, pPortalPath)
    m.setU32(pObjectsTxt + 59 * 0x1c0 + 0xdc, 15 << 8)
    m.setU32(pRoomEx + 0x28, 0x400000)
    SUNIT_InsertServerUnit113c(m, pGame, pPortal)

    expect(MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c(m, pGame, pMissile, 1)).toBe(0)
    expect(MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(m.u32(pRoomEx + 0x28)).toBe(0)
    expect(m.u32(pPortal + 0x10)).toBe(1)
    expect(EVENT_GetNextEventFrame113c(m, pPortal, 1)).toBe(515)
  })

  it('ports SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c (0x6FC62230) and SKILLS_StatListExpireClearState_6FC62290_113c (0x6FC62290)', () => {
    const { m, pSkillsTxt } = createLaneKWorld()
    const pUnit = m.alloc(0x100)
    const pDynPath = m.alloc(0x80)
    const pSkillList = m.alloc(0x20)
    const pSkill = m.alloc(0x40)
    const pSkTxt = pSkillsTxt + 70 * 0x23c
    m.setU16(pSkTxt, 70)
    m.setU32(pSkill, pSkTxt)
    m.setU32(pSkill + 0x28, 3)
    m.setU32(pSkillList + 0x04, pSkill) // D2SkillListStrc.pFirstSkill (+0x04)
    m.setU32(pUnit, 0)
    m.setU32(pUnit + 0x0c, 5)
    m.setU32(pUnit + 0x2c, pDynPath)
    m.setU32(pUnit + 0xa8, pSkillList)
    attachStatListEx(m, pUnit)

    expect(SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c(m, 0, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c(m, 0, pUnit, 999, 1)).toBe(0)
    expect(SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c(m, 0, pUnit, 70, 1)).toBe(1)
    expect(SKILLS_GetParam1113c(m, pSkill) | 0).toBe(-1)
    expect(SKILLS_GetParam2113c(m, pSkill)).toBe(1)

    STATES_ToggleGfxStateFlag113c(m, pUnit, 0x10, 1)
    expect(STATES_CheckState113c(m, pUnit, 0x10)).toBe(1 << 0x10)
    SKILLS_StatListExpireClearState_6FC62290_113c(m, pUnit, 0x10, 0)
    expect(STATES_CheckState113c(m, pUnit, 0x10)).toBe(0)
    expect((m.u32(pUnit + 0xc4) & 0x40) !== 0).toBe(true)
  })
})
