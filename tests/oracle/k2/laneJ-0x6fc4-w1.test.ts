import { describe, expect, it } from 'vitest'
import { QUESTRECORD_AllocRecord113c, QUESTRECORD_SetQuestState113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  PATH_SetTargetUnit113c,
  PATH_TYPE_FLAGS_6FDE4180,
  PATH_TYPE_STEP_NUMS_6FDE4138,
} from '../../../src/d2kern-113c/common/path.ts'
import {
  SKILLS_GetParam3113c,
  SKILLS_GetParam4113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import { D2MonStatsTxt } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { STATLIST_GetUnitStat113c, STATLIST_SetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import * as laneJExports from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts'
import {
  CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c,
  CLIENT_SelectFlag20ClientCallback_6FC4A700_113c,
  CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c,
  DRLG_PopulateSingleRoom_6FC4CB80_113c,
  GAME_CommitGlobalGameSlot_6FC4A2D0_113c,
  GAME_LeaveGameCriticalSection_6FC49BA0_113c,
  GAME_ReserveGlobalGameSlot_6FC4A220_113c,
  MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c,
  MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c,
  MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c,
  MONUMOD_RollSelfResurrectEvent7_6FC43570_113c,
  MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c,
  OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c,
  OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c,
  OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c,
  OBJECTS_InitFn11_InitTownPortal_6FC53330_113c,
  OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c,
  OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c,
  OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c,
  OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c,
  OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c,
  OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c,
  OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c,
  OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c,
  OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c,
  OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c,
  OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c,
  PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c,
  PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c,
  PLRMODE_IsDualWieldingClaws_6FC46A30_113c,
  PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c,
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_AttachQuestToUnit_6FC53F80_113c,
  QUESTS_CheckGlobalQuestState_6FC538D0_113c,
  QUESTS_CheckNotIntro_6FC53970_113c,
  QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c,
  QUESTS_FreeUnitQuestChain_6FC53FF0_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
  QUESTS_GetQuestSeedPtr_6FC53D90_113c,
  QUESTS_ResolveDefaultStatusByte_6FC53A30_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
  QUESTS_TriggerItemDropped_6FC545A0_113c,
  QUESTS_TriggerItemPickedUp_6FC54510_113c,
  SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c,
  SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c, EVENT_SetEventFull113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface LaneJWorld {
  m: SparseMemory113c
  pDataTables: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pSkillsTxt: number
  pItemsTxt: number
  pItemTypesEquiv: number
  pObjectsTxt: number
}

function createLaneJWorld(): LaneJWorld {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1200)
  initD2GameGlobalsInMem113c(m, pDataTables)

  // Mirror D2Common sgptDataTables & bitmasks IATs
  m.setU32(0x6fde9e1c, pDataTables)
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C)
  m.setU32(0x6fdd90b0, pBitMasks)

  const pInvBitMasks = m.alloc(128)
  for (let i = 0; i < 32; i++) {
    m.setU32(pInvBitMasks + i * 4, (~(1 << i)) >>> 0)
  }
  m.setU32(0x6fdd9078, pInvBitMasks)

  // D2Common body grid 0 dimensions (13x1)
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)

  // StatesTxt & corpse state mask
  const pStatesTxt = m.alloc(200 * 0x3c)
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, 200)
  const pCorpseMask = m.alloc(32)
  m.setU32(pDataTables + 0x150, pCorpseMask)

  // MonStatsTxt (stride 0x1A8) & MonStats2Txt (stride 0x134)
  const monCount = 400
  const pMonStatsTxt = m.alloc(monCount * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, monCount)

  const pMonStats2Txt = m.alloc(monCount * 0x134)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, monCount)

  // SkillsTxt (stride 0x23C)
  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, skillsCount)

  // ItemStatCostTxt (stride 0x144)
  const statCount = 360
  const pItemStatCostTxt = m.alloc(statCount * 0x144)
  m.setU32(pDataTables + 0xbcc, pItemStatCostTxt)
  m.setU32(pDataTables + 0xbd4, statCount)

  // ItemTypesTxt & equivalence bitmatrix (stride 4 dwords per row)
  const itemTypesCount = 80
  const pItemTypesTxt = m.alloc(itemTypesCount * 0xe4)
  m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
  m.setU32(pDataTables + 0xbfc, itemTypesCount)
  m.setU32(pDataTables + 0xc00, 4)
  const pItemTypesEquiv = m.alloc(itemTypesCount * 16)
  m.setU32(pDataTables + 0xc04, pItemTypesEquiv)

  // ItemsTxt (stride 0x1A8) & weapon class code table
  const itemsCount = 64
  const pItemsTxt = m.alloc(itemsCount * 0x1a8)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)

  // Weapon class entries: 0x20317468 ('ht1 ') -> idx 2 (claw), 0x20736831 ('1hs ') -> idx 1
  m.setU32(0x6fdef020, 2)
  m.setU32(0x6fdef028, 0x20317468)
  m.setU16(0x6fdef02c, 2)
  m.setU32(0x6fdef030, 0x20736831)
  m.setU16(0x6fdef034, 1)

  // ObjectsTxt (stride 0x1C0)
  const objectsCount = 100
  const pObjectsTxt = m.alloc(objectsCount * 0x1c0)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, objectsCount)

  // LevelsTxt (stride 0x220) at sgptDataTables + 0xC58 / + 0xC5C
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * 0x220)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, levelsCount)

  // D2Common PATH_SetType113c & PATH_Compute113c static tables + Fog trig LUT
  for (let i = 0; i < PATH_TYPE_STEP_NUMS_6FDE4138.length; i++) {
    m.setU32((0x6fde4138 + i * 4) >>> 0, PATH_TYPE_STEP_NUMS_6FDE4138[i]! >>> 0)
  }
  for (let i = 0; i < PATH_TYPE_FLAGS_6FDE4180.length; i++) {
    m.setU32((0x6fde4180 + i * 4) >>> 0, PATH_TYPE_FLAGS_6FDE4180[i]! >>> 0)
  }
  m.fill(0x6fde41c8, 64 * 4, 1)
  const f32Buf = new ArrayBuffer(4)
  const f32View = new DataView(f32Buf)
  for (let i = 0; i < 512; i++) {
    f32View.setFloat32(0, Math.sin((i * Math.PI * 2) / 512), true)
    m.setU32((0x6ff7f470 + i * 4) >>> 0, f32View.getUint32(0, true))
  }

  // Act town level IDs at 0x6FDE4084: [1, 40, 75, 103, 109]
  const townLevels = [1, 40, 75, 103, 109]
  for (let act = 0; act < 5; act++) {
    m.setU32(0x6fde4084 + act * 4, townLevels[act]!)
  }

  return {
    m,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pItemsTxt,
    pItemTypesEquiv,
    pObjectsTxt,
  }
}

function allocGameWithTimer(m: SparseMemory113c, gameFrame = 100, difficulty = 0): number {
  const pGame = m.alloc(0x1e00)
  m.setU32(pGame + 0xa8, gameFrame)
  m.setU8(pGame + 0x6d, difficulty)
  EVENT_InitTimerQueue113c(m, pGame)
  return pGame
}

function attachStatListEx(m: SparseMemory113c, pUnit: number): number {
  const pStatListEx = m.alloc(0x68)
  m.setU32(pStatListEx + 0x08, m.u32(pUnit))
  m.setU32(pStatListEx + 0x0c, m.u32(pUnit + 0x0c))
  m.setU32(pStatListEx + 0x10, 0x80000000)
  const pStateFlags = m.alloc(64)
  m.setU32(pStatListEx + 0x58, pStateFlags)
  m.setU32(pUnit + 0x5c, pStatListEx)
  return pStatListEx
}

function allocRoomWithCollision(
  m: SparseMemory113c,
  subX: number,
  subY: number,
  subW: number,
  subH: number,
  levelId = 2,
): { pRoom: number; pCollMap: number; pRoomEx: number; pLevel: number } {
  const pRoom = m.alloc(0x80)
  const pRoomEx = m.alloc(0x80)
  const pLevel = m.alloc(0x200)
  m.setU32(pRoom + 0x10, pRoomEx)
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

function readUnitEvents(
  m: SparseMemory113c,
  pUnit: number,
): Array<{ nType: number; dwFrame: number }> {
  const events: Array<{ nType: number; dwFrame: number }> = []
  let pEv = m.u32(pUnit + 0xdc)
  while (pEv !== 0) {
    events.push({ nType: m.u8(pEv), dwFrame: m.u32(pEv + 0x04) })
    pEv = m.u32(pEv + 0x24)
  }
  return events
}

describe('Milestone 33 [K2] Lane K2-J: 45 D2Game 0x6FC43320..0x6FC545A0 Functions', () => {
  it('exports exact 45 113c-suffixed kernel functions', () => {
    const names = Object.keys(laneJExports)
    expect(names.length).toBe(45)
    for (const name of names) {
      expect(name.endsWith('113c')).toBe(true)
      expect(typeof (laneJExports as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('ports MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c (0x6FC43320)', () => {
    const { m } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 200)

    // Null unit is a safe no-op
    MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(m, pGame, 0)

    const pMonster = m.alloc(0x100)
    const pMonData = m.alloc(0x60)
    m.setU32(pMonster, 1) // UNIT_MONSTER
    m.setU32(pMonster + 0x04, 5)
    m.setU32(pMonster + 0x10, 0x0c) // MONMODE_DEAD -> ignored
    m.setU32(pMonster + 0x14, pMonData)
    MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(m, pGame, pMonster)
    expect(m.u32(pMonster + 0xdc)).toBe(0)

    // UNITFLAG_DEAD (+0xC6 bit 0) -> ignored
    m.setU32(pMonster + 0x10, 1)
    m.setU8(pMonster + 0xc6, 1)
    MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(m, pGame, pMonster)
    expect(m.u32(pMonster + 0xdc)).toBe(0)

    // Living monster -> schedules AI event + event 7 at dwGameFrame + 0x4B (200 + 75 = 275)
    m.setU8(pMonster + 0xc6, 0)
    MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(m, pGame, pMonster)
    const evs = readUnitEvents(m, pMonster)
    expect(evs.some((e) => e.nType === 7 && e.dwFrame === 275)).toBe(true)

    // Living player (mode != 0 && mode != 0x11) also schedules event 7; mode 0x11 is ignored
    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x10, 0x11)
    MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(m, pGame, pPlayer)
    expect(m.u32(pPlayer + 0xdc)).toBe(0)
    m.setU32(pPlayer + 0x10, 1)
    MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(m, pGame, pPlayer)
    expect(readUnitEvents(m, pPlayer).some((e) => e.nType === 7 && e.dwFrame === 275)).toBe(true)
  })

  it('ports MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c (0x6FC43390)', () => {
    const { m } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 300)

    // pUnit == 0 schedules global timer event 7 at frame 304 without crashing
    MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c(m, pGame, 0)

    const pMonster = m.alloc(0x100)
    const pSkillList = m.alloc(0x20)
    m.setU32(pSkillList + 0x10, 0xdeadbeef)
    m.setU32(pMonster, 1)
    m.setU32(pMonster + 0xa8, pSkillList)

    // Mode 1 -> no-op
    m.setU32(pMonster + 0x10, 1)
    MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c(m, pGame, pMonster)
    expect(m.u32(pSkillList + 0x10)).toBe(0xdeadbeef)
    expect(m.u32(pMonster + 0xdc)).toBe(0)

    // Mode 3 (GETHIT) -> zeroes pUsedSkill, transitions to mode 0, schedules event 7 at +4
    m.setU32(pMonster + 0x10, 3)
    MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c(m, pGame, pMonster)
    expect(m.u32(pSkillList + 0x10)).toBe(0)
    expect(m.u32(pMonster + 0x10)).toBe(0)
    expect(readUnitEvents(m, pMonster)[0]).toEqual({ nType: 7, dwFrame: 304 })

    // Mode 0x0C -> schedules another event 7 at +4
    const pCorpse = m.alloc(0x100)
    m.setU32(pCorpse, 1)
    m.setU32(pCorpse + 0x10, 0x0c)
    MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c(m, pGame, pCorpse)
    expect(readUnitEvents(m, pCorpse)).toEqual([{ nType: 7, dwFrame: 304 }])
  })

  it('ports MONUMOD_RollSelfResurrectEvent7_6FC43570_113c (0x6FC43570)', () => {
    const { m, pMonStatsTxt } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 500, 1) // Nightmare (diff = 1)

    const classId = 12
    const pRec = pMonStatsTxt + classId * 0x1a8
    m.setU16(pRec + 1 * 2 + 0x80, 100) // wAid[1] = 100%
    m.setU16(pRec + 1 * 2 + 0x56, 7) // wAIdel[1] = 7 -> +71 frames

    const pMonster = m.alloc(0x100)
    m.setU32(pMonster, 1)
    m.setU32(pMonster + 0x04, classId)
    m.setU32(pMonster + 0x10, 0) // MONMODE_DEATH
    m.setU32(pMonster + 0x20, 12345)
    m.setU32(pMonster + 0x24, 67890)
    const pListEx = attachStatListEx(m, pMonster) // alignment defaults to 0 (evil)

    // Pre-existing type-7 event is purged while type-2 event is retained
    EVENT_SetEventFull113c(m, pGame, pMonster, 2, 510, 0, 0, 0)
    EVENT_SetEventFull113c(m, pGame, pMonster, 7, 520, 0, 0, 0)

    MONUMOD_RollSelfResurrectEvent7_6FC43570_113c(m, pGame, pMonster)
    const evs = readUnitEvents(m, pMonster)
    expect(evs).toEqual([
      { nType: 7, dwFrame: 571 },
      { nType: 2, dwFrame: 510 },
    ])

    // Friendly alignment (pStatListEx->dwFlags bit 0x200 -> alignment 2) blocks resurrection
    m.setU32(pListEx + 0x10, 0x80000200)
    const seedBefore = m.u32(pMonster + 0x20)
    MONUMOD_RollSelfResurrectEvent7_6FC43570_113c(m, pGame, pMonster)
    expect(m.u32(pMonster + 0x20)).toBe(seedBefore)
  })

  it('ports MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c (0x6FC43670)', () => {
    const { m } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 100)

    // Rogue hireling owner (dwUnitType = 1, dwClassId = 0x10F, dwUnitId = 42)
    const pRogue = m.alloc(0x100)
    m.setU32(pRogue, 1)
    m.setU32(pRogue + 0x04, 0x10f)
    m.setU32(pRogue + 0x0c, 42)
    attachStatListEx(m, pRogue)
    STATLIST_SetUnitStat113c(m, pRogue, 0x17, 5, 0) // secMin = 5 -> +0x400
    STATLIST_SetUnitStat113c(m, pRogue, 0x18, 9, 0) // secMax = 9 -> +0x800
    SUNIT_InsertServerUnit113c(m, pGame, pRogue)

    const pMissile = m.alloc(0x100)
    m.setU32(pMissile, 3) // UNIT_MISSILE
    m.setU32(pMissile + 0x0c, 99)
    m.setU32(pMissile + 0x94, 1) // ownerType = UNIT_MONSTER
    m.setU32(pMissile + 0x98, 42) // ownerId = 42
    attachStatListEx(m, pMissile)
    STATLIST_SetUnitStat113c(m, pMissile, 0x15, 0x200, 0)
    STATLIST_SetUnitStat113c(m, pMissile, 0x16, 0x300, 0)

    // Without bit 0x400 on +0xC8 -> unchanged
    MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c(m, pGame, pMissile)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x15, 0)).toBe(0x200)

    // With bit 0x400 set -> adds (5<<8)-0x100 = 0x400 and (9<<8)-0x100 = 0x800
    m.setU32(pMissile + 0xc8, 0x400)
    MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c(m, pGame, pMissile)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x15, 0)).toBe(0x600)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x16, 0)).toBe(0xb00)

    // Clamp to 0 when secMin/secMax == 0 and base < 0x100
    STATLIST_SetUnitStat113c(m, pRogue, 0x17, 0, 0)
    STATLIST_SetUnitStat113c(m, pRogue, 0x18, 0, 0)
    STATLIST_SetUnitStat113c(m, pMissile, 0x15, 0x80, 0)
    STATLIST_SetUnitStat113c(m, pMissile, 0x16, 0x80, 0)
    MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c(m, pGame, pMissile)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x15, 0)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x16, 0)).toBe(0)
  })

  it('ports MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c (0x6FC469F0)', () => {
    const { m } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 1000)

    MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c(m, 0)

    const pMonster = m.alloc(0x100)
    m.setU32(pMonster, 1)
    MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c(m, pMonster) // pGame == 0 -> no-op
    expect(m.u32(pMonster + 0xdc)).toBe(0)

    m.setU32(pMonster + 0x80, pGame)
    MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c(m, pMonster)
    expect(readUnitEvents(m, pMonster)).toEqual([{ nType: 7, dwFrame: 1075 }])
  })

  it('ports PLRMODE_IsDualWieldingClaws_6FC46A30_113c (0x6FC46A30)', () => {
    const { m, pItemsTxt, pItemTypesEquiv } = createLaneJWorld()

    // Configure item type 0x2E (claw, also weapon 0x2D) and item type 0x1E (sword, weapon 0x2D only)
    const clawRow = 0x2e * 16
    m.setU32(pItemTypesEquiv + clawRow + 4, (1 << (0x2d - 32)) | (1 << (0x2e - 32)))
    const swordRow = 0x1e * 16
    m.setU32(pItemTypesEquiv + swordRow + 4, 1 << (0x2d - 32))

    // Item classId 1 = claw ('ht1 ', wType0 = 0x2E), classId 2 = sword ('1hs ', wType0 = 0x1E, comp = 5)
    m.setU32(pItemsTxt + 1 * 0x1a8 + 0xc0, 0x20317468)
    m.setU16(pItemsTxt + 1 * 0x1a8 + 0x11e, 0x2e)
    m.setU32(pItemsTxt + 2 * 0x1a8 + 0xc0, 0x20736831)
    m.setU8(pItemsTxt + 2 * 0x1a8 + 0x115, 6)
    m.setU16(pItemsTxt + 2 * 0x1a8 + 0x11e, 0x1e)

    const pPlayer = m.alloc(0x100)
    expect(PLRMODE_IsDualWieldingClaws_6FC46A30_113c(m, pPlayer)).toBe(0)

    const pInv = m.alloc(0x40)
    m.setU32(pInv, 0x01020304)
    const pGrid = m.alloc(0x20)
    const ppBody = m.alloc(13 * 4)
    m.setU8(pGrid + 0x08, 13)
    m.setU8(pGrid + 0x09, 1)
    m.setU32(pGrid + 0x0c, ppBody)
    m.setU32(pInv + 0x14, pGrid)
    m.setU32(pInv + 0x18, 1)
    m.setU32(pPlayer + 0x60, pInv)

    const allocWeapon = (classId: number, guid: number): number => {
      const pItm = m.alloc(0x100)
      const pItmData = m.alloc(0x80)
      m.setU32(pItm, 4)
      m.setU32(pItm + 0x04, classId)
      m.setU32(pItm + 0x0c, guid)
      m.setU32(pItm + 0x14, pItmData)
      return pItm
    }

    const pClawR = allocWeapon(1, 101)
    const pClawL = allocWeapon(1, 102)
    const pSwordL = allocWeapon(2, 103)

    // Only one claw equipped -> 0
    m.setU32(ppBody + 4 * 4, pClawR)
    m.setU32(pInv + 0x1c, 101) // pComp = pClawR (slot 5)
    expect(PLRMODE_IsDualWieldingClaws_6FC46A30_113c(m, pPlayer)).toBe(0)

    // Claw + non-claw sword -> 0
    m.setU32(ppBody + 5 * 4, pSwordL)
    expect(PLRMODE_IsDualWieldingClaws_6FC46A30_113c(m, pPlayer)).toBe(0)

    // Two Assassin claws across slots 4 & 5 -> 1
    m.setU32(ppBody + 5 * 4, pClawL)
    expect(PLRMODE_IsDualWieldingClaws_6FC46A30_113c(m, pPlayer)).toBe(1)
  })

  it('ports PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c (0x6FC46B30)', () => {
    const { m, pSkillsTxt } = createLaneJWorld()
    const { pRoom: pWildRoom } = allocRoomWithCollision(m, 100, 200, 40, 40, 2)
    const { pRoom: pTownRoom } = allocRoomWithCollision(m, 100, 200, 40, 40, 1)

    const pUnit = m.alloc(0x100)
    const pPath = m.alloc(0x40)
    m.setU32(pPath + 0x1c, pWildRoom)
    m.setU32(pUnit + 0x2c, pPath)

    // Invalid skill IDs -> 0
    expect(PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c(m, -1, 210, pUnit, 110)).toBe(0)
    expect(PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c(m, 999, 210, pUnit, 110)).toBe(0)

    // Outside room & adjacent rooms -> 0
    expect(PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c(m, 10, 999, pUnit, 999)).toBe(0)

    // Wilderness room -> 1 even when bInTown == 0
    expect(PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c(m, 10, 210, pUnit, 110)).toBe(1)

    // Town room -> 0 when bInTown == 0, 1 when bInTown (+0x05 bit 0) == 1
    m.setU32(pPath + 0x1c, pTownRoom)
    expect(PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c(m, 10, 210, pUnit, 110)).toBe(0)
    m.setU8(pSkillsTxt + 10 * 0x23c + 0x05, 1)
    expect(PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c(m, 10, 210, pUnit, 110)).toBe(1)
  })

  it('ports PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c (0x6FC47030)', () => {
    const { m } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 100)
    const { pRoom, pLevel } = allocRoomWithCollision(m, 100, 100, 80, 80, 2)

    const pTarget = m.alloc(0x100)
    const pTargetPath = m.alloc(0x80)
    m.setU32(pTarget, 1)
    m.setU32(pTarget + 0x0c, 77)
    m.setU16(pTargetPath + 0x02, 120) // tx = 120
    m.setU16(pTargetPath + 0x06, 130) // ty = 130
    m.setU32(pTargetPath + 0x1c, pRoom)
    m.setU32(pTarget + 0x2c, pTargetPath)
    SUNIT_InsertServerUnit113c(m, pGame, pTarget)

    const pUnit = m.alloc(0x100)
    const pPath = m.alloc(0x100)
    m.setU32(pUnit, 0)
    m.setU16(pPath + 0x02, 125)
    m.setU16(pPath + 0x06, 135)
    m.setU32(pPath + 0x1c, pRoom)
    m.setU32(pPath + 0x30, pUnit)
    m.setU32(pUnit + 0x2c, pPath)
    m.setU32(pUnit + 0x48, 0x00000255)

    const pSkill = m.alloc(0x40)
    SKILLS_SetParam3113c(m, pSkill, 1) // targetType = UNIT_MONSTER
    SKILLS_SetParam4113c(m, pSkill, 77) // targetId = 77

    // Reflected destination: destX = 3*125 - 2*120 = 135, destY = 3*135 - 2*130 = 145
    // Rejects when destination room is town (levelId == 1)
    m.setU32(pLevel + 0x1d0, 1)
    expect(
      PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c(m, pSkill, pGame, pUnit, 125, 135),
    ).toBe(0)

    // Succeeds in wilderness (levelId == 2); second call advances +0x48 from 0x300 -> 0x400
    m.setU32(pLevel + 0x1d0, 2)
    expect(
      PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c(m, pSkill, pGame, pUnit, 125, 135),
    ).toBe(1)
    expect(m.u32(pSkill + 0x0c)).toBe(1)
    expect(m.u32(pUnit + 0x38)).toBe(0x00000c00)
    expect(m.u32(pUnit + 0x48)).toBe(0x00000400)
    expect(m.u16(pPath + 0x10)).toBe(135)
    expect(m.u16(pPath + 0x12)).toBe(145)
  })

  it('ports SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c (0x6FC47240) and SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c (0x6FC47270)', () => {
    const { m, pMonStatsTxt, pMonStats2Txt } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 100)

    const classId = 15
    m.set(pMonStatsTxt + classId * 0x1a8, D2MonStatsTxt.wMonStatsEx, classId)
    // Enable MonStats2 flag bit 7 (+0x04 byte 0 bit 7 = 0x80) only first
    m.setU8(pMonStats2Txt + classId * 0x134 + 0x04, 0x80)

    const pCaster = m.alloc(0x100)
    const pCasterPath = m.alloc(0x80)
    m.setU32(pCaster, 0)
    m.setU32(pCaster + 0x0c, 1)
    m.setU32(pCaster + 0x2c, pCasterPath)

    const pCorpse = m.alloc(0x100)
    m.setU32(pCorpse, 1)
    m.setU32(pCorpse + 0x04, classId)
    m.setU32(pCorpse + 0x0c, 88)
    m.setU32(pCorpse + 0x10, 0x0c) // MONMODE_DEAD
    const pCorpseStatEx = attachStatListEx(m, pCorpse)
    SUNIT_InsertServerUnit113c(m, pGame, pCorpse)

    // Link caster path target to corpse via PATH_SetTargetUnit113c
    PATH_SetTargetUnit113c(m, pCasterPath, pCorpse)

    expect(SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c(m, pGame, pCaster)).toBe(1)
    // SrvSt33 requires MonStats2 flag bit 12 (+0x05 bit 4 = 0x10) as well
    expect(SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c(m, pGame, pCaster)).toBe(0)

    m.setU8(pMonStats2Txt + classId * 0x134 + 0x05, 0x10)
    expect(SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c(m, pGame, pCaster)).toBe(1)

    // Activate state 0x76 (118 -> word 3, bit 22) -> SrvSt33 returns 0 while SrvSt34 stays 1
    const pStateFlags = m.u32(pCorpseStatEx + 0x58)
    m.setU32(pStateFlags + (0x76 >> 5) * 4, 1 << (0x76 & 31))
    expect(SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c(m, pGame, pCaster)).toBe(0)
    expect(SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c(m, pGame, pCaster)).toBe(1)
  })

  it('ports PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c (0x6FC479C0)', () => {
    const { m } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 100)

    const pAttacker = m.alloc(0x100)
    m.setU32(pAttacker, 1)
    m.setU32(pAttacker + 0x04, 5)
    m.setU32(pAttacker + 0x0c, 10)
    attachStatListEx(m, pAttacker)

    const pDefender = m.alloc(0x100)
    m.setU32(pDefender, 0)
    m.setU32(pDefender + 0x0c, 555)
    attachStatListEx(m, pDefender)
    SUNIT_InsertServerUnit113c(m, pGame, pDefender)

    const pAttackerPath = m.alloc(0x100)
    m.setU32(pAttacker + 0x2c, pAttackerPath)
    PATH_SetTargetUnit113c(m, pAttackerPath, pDefender)

    const pSkill = m.alloc(0x40)

    expect(PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c(m, 0, pAttacker, pSkill, pGame)).toBe(
      0,
    )
    expect(
      PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c(m, pDefender, pAttacker, 0, pGame),
    ).toBe(0)

    expect(
      PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c(m, pDefender, pAttacker, pSkill, pGame),
    ).toBe(1)
    expect(SKILLS_GetParam3113c(m, pSkill)).toBe(0) // dwParam3 = defender type (0)
    expect(SKILLS_GetParam4113c(m, pSkill)).toBe(555) // dwParam4 = defender guid (555)
  })

  it('ports GAME_LeaveGameCriticalSection_6FC49BA0_113c (0x6FC49BA0), GAME_ReserveGlobalGameSlot_6FC4A220_113c (0x6FC4A220), and GAME_CommitGlobalGameSlot_6FC4A2D0_113c (0x6FC4A2D0)', () => {
    const m = new SparseMemory113c()
    const csEvents: string[] = []
    const hooks: laneJExports.LaneJKernHooks113c = {
      onEnterCriticalSection: (_mem, pCs, line) => csEvents.push(`enter:0x${pCs.toString(16)}:${line}`),
      onLeaveCriticalSection: (_mem, pCs) => csEvents.push(`leave:0x${pCs.toString(16)}`),
    }

    expect(() => GAME_LeaveGameCriticalSection_6FC49BA0_113c(m, 0, hooks)).toThrow(/4110/)
    const pGame = m.alloc(0x40)
    expect(() => GAME_LeaveGameCriticalSection_6FC49BA0_113c(m, pGame, hooks)).toThrow(/4111/)
    m.setU32(pGame + 0x18, 0x12345000)
    GAME_LeaveGameCriticalSection_6FC49BA0_113c(m, pGame, hooks)
    expect(csEvents).toEqual(['leave:0x12345000'])

    // Reserve slot wrapping from 0x400 -> 1
    m.fill(0x6fd30c04, 1025 * 4, 0)
    m.setU32(0x6fd2e350, 0x400)
    const slotA = GAME_ReserveGlobalGameSlot_6FC4A220_113c(m, hooks)
    expect(slotA).toBe(0x400)
    expect(m.u16(0x6fd2e350)).toBe(1)
    expect(m.u32(0x6fd30c04 + 0x400 * 4)).toBe(0xffffffff)

    // Commit requires reserved -1 sentinel
    expect(() => GAME_CommitGlobalGameSlot_6FC4A2D0_113c(m, 0xabc, 1, hooks)).toThrow(/389/)
    GAME_CommitGlobalGameSlot_6FC4A2D0_113c(m, 0xabc, 0x400, hooks)
    expect(m.u32(0x6fd30c04 + 0x400 * 4)).toBe(0xabc)

    // Full table -> returns 0
    for (let s = 1; s <= 0x400; s++) {
      m.setU32(0x6fd30c04 + s * 4, 0x999)
    }
    m.setU16(0x6fd2e350, 5)
    expect(GAME_ReserveGlobalGameSlot_6FC4A220_113c(m, hooks)).toBe(0)
  })

  it('ports CLIENT_SelectFlag20ClientCallback_6FC4A700_113c (0x6FC4A700)', () => {
    const m = new SparseMemory113c()
    const ppOut = m.alloc(4)
    expect(() => CLIENT_SelectFlag20ClientCallback_6FC4A700_113c(m, 0, ppOut)).toThrow(/2982/)

    const pClient = m.alloc(0x500)
    CLIENT_SelectFlag20ClientCallback_6FC4A700_113c(m, pClient, ppOut)
    expect(m.u32(ppOut)).toBe(0)

    m.setU8(pClient + 0x3d4, 0x20)
    CLIENT_SelectFlag20ClientCallback_6FC4A700_113c(m, pClient, ppOut)
    expect(m.u32(ppOut)).toBe(pClient)
  })

  it('ports CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c (0x6FC4A9F0)', () => {
    const { m } = createLaneJWorld()
    const { pRoom: pRoomA } = allocRoomWithCollision(m, 0, 0, 20, 20, 2)
    const { pRoom: pRoomB } = allocRoomWithCollision(m, 40, 40, 20, 20, 2)

    const pClient = m.alloc(0x500)
    const pQueue = m.alloc(0x410)
    m.setU32(pClient + 0x1bc, pQueue)

    const pMonster = m.alloc(0x100)
    const pPath = m.alloc(0x40)
    m.setU32(pMonster, 1) // UNIT_MONSTER
    m.setU32(pMonster + 0x0c, 0x11223344)
    m.setU32(pPath + 0x1c, pRoomA)
    m.setU32(pMonster + 0x2c, pPath)

    // Null unit -> safe no-op; missing client room -> assert 5483
    CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c(m, pClient, 0)
    expect(() => CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c(m, pClient, pMonster)).toThrow(
      /5483/,
    )

    // Distant room -> nothing queued
    m.setU32(pClient + 0x1b4, pRoomB)
    CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c(m, pClient, pMonster)
    expect(m.u32(pQueue + 0x00)).toBe(0)

    // Adjacent room, missile type (3) -> skipped
    m.setU32(pClient + 0x1b4, pRoomA)
    m.setU32(pMonster, 3)
    CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c(m, pClient, pMonster)
    expect(m.u32(pQueue + 0x00)).toBe(0)

    // Adjacent room, monster (1) -> 6-byte [0x0A, 0x01, 0x11223344] packet queued
    m.setU32(pMonster, 1)
    CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c(m, pClient, pMonster)
    expect(m.u32(pQueue + 0x00)).toBe(6)
    expect(m.u8(pQueue + 0x04)).toBe(0x0a)
    expect(m.u8(pQueue + 0x05)).toBe(0x01)
    expect(m.u32(pQueue + 0x06)).toBe(0x11223344)
  })

  it('ports CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c (0x6FC4BED0)', () => {
    const { m } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 100)

    expect(() => CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c(m, 0, pGame)).toThrow(/251/)

    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 0x778899aa)
    SUNIT_InsertServerUnit113c(m, pGame, pPlayer)

    // Peer 1 (state 4 -> receives 0x5C), Peer 2 (state 2 -> skipped)
    const pPeer1 = m.alloc(0x500)
    const pQueue1 = m.alloc(0x410)
    m.setU32(pPeer1 + 0x04, 4)
    m.setU32(pPeer1 + 0x1bc, pQueue1)

    const pPeer2 = m.alloc(0x500)
    const pQueue2 = m.alloc(0x410)
    m.setU32(pPeer2 + 0x04, 2)
    m.setU32(pPeer2 + 0x1bc, pQueue2)
    m.setU32(pPeer1 + 0x4a8, pPeer2)
    m.setU32(pGame + 0x88, pPeer1)

    // Leaving client without flag 1 revalidates via SUNIT_GetServerUnit
    const pLeaving = m.alloc(0x500)
    m.setU32(pLeaving + 0x16c, 0)
    m.setU32(pLeaving + 0x170, 0x778899aa)
    m.setU32(pLeaving + 0x174, pPlayer)
    m.setU32(pLeaving + 0x1a8, pGame)

    CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c(m, pLeaving, pGame)
    expect(m.u32(pQueue1 + 0x00)).toBe(5)
    expect(m.u8(pQueue1 + 0x04)).toBe(0x5c)
    expect(m.u32(pQueue1 + 0x05)).toBe(0x778899aa)
    expect(m.u32(pQueue2 + 0x00)).toBe(0)

    // Missing server unit clears stale +0x174 cache
    m.setU32(pLeaving + 0x170, 0xdead)
    CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c(m, pLeaving, pGame)
    expect(m.u32(pLeaving + 0x174)).toBe(0)
  })

  it('ports DRLG_PopulateSingleRoom_6FC4CB80_113c (0x6FC4CB80)', () => {
    const { m } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 100)
    const { pRoom } = allocRoomWithCollision(m, 0, 0, 20, 20, 2)
    const pObjCtrl = m.alloc(0x100)
    const pLevelObjInfo = m.alloc(0x20)
    m.setU32(pObjCtrl + 2 * 4 + 0x48, pLevelObjInfo)
    m.setU32(pGame + 0x10f0, pObjCtrl)

    let refreshCalls = 0
    const callees = {
      refreshRoomUnits: () => {
        refreshCalls++
      },
      objects: {
        getLevelRoomCountInAct: () => 0,
        checkLevelObjectHook: () => 0,
        spawnObjectsByFn: () => 0,
        spawn: { initObject: () => {}, placeServerUnit: () => {} },
      },
      initAmbientMonster: () => {},
      presets: {
        spawnMonsterPreset: () => 0,
        spawnSpecialObject: () => 0,
        allocUnitData: () => 0,
        placePresetItem: () => 0,
        freeUnit: () => {},
        initQuestObject1CB: () => {},
        initQuestObject1CD: () => {},
        initQuestObject21F: () => {},
      },
      regpop: {},
    }

    // First call: populates room, sets pRoom+0x34 bit 0 and bit 1 (flag 2) -> 3
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, pGame, callees)
    expect(refreshCalls).toBe(1)
    expect(m.u32(pRoom + 0x34) & 3).toBe(3)

    // Second call while flag 2 is set: skips refreshRoomUnits
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, pGame, callees)
    expect(refreshCalls).toBe(1)

    // Clear pRoom+0x34 bit 1 (keep bit 0 = 1) -> refreshes saved units and re-sets bit 1
    m.setU32(pRoom + 0x34, 1)
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, pGame, callees)
    expect(refreshCalls).toBe(2)
    expect(m.u32(pRoom + 0x34) & 3).toBe(3)
  })

  it('ports OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c (0x6FC4E5D0) and OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c (0x6FC4E660)', () => {
    const { m } = createLaneJWorld()
    const { pRoom, pCollMap } = allocRoomWithCollision(m, 100, 200, 30, 30, 2)

    const pRoomCoords = m.alloc(0x20)
    m.setU32(pRoomCoords + 0x00, 100)
    m.setU32(pRoomCoords + 0x04, 200)
    m.setU32(pRoomCoords + 0x08, 30)
    m.setU32(pRoomCoords + 0x0c, 30)

    const pPos = m.alloc(8)
    // Border rejection for Margin2 (posX <= subX + 2)
    m.setU32(pPos, 102)
    m.setU32(pPos + 4, 215)
    expect(OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(m, pRoomCoords, pPos, pRoom, 2, 2)).toBe(
      0,
    )

    // Clear interior spot (115, 215) passes both Margin2 and Margin7
    m.setU32(pPos, 115)
    m.setU32(pPos + 4, 215)
    expect(OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(m, pRoomCoords, pPos, pRoom, 2, 2)).toBe(
      1,
    )
    expect(OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(m, pRoomCoords, pPos, 2, pRoom, 2)).toBe(
      1,
    )

    // Stamp 0x0400 (matched by 0x0C01 wide check, ignored by Margin2 at distance 3) at (118, 218)
    m.setU16(pCollMap + (18 * 30 + 18) * 2, 0x0400)
    expect(OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(m, pRoomCoords, pPos, pRoom, 2, 2)).toBe(
      1,
    )
    expect(OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(m, pRoomCoords, pPos, 2, pRoom, 2)).toBe(
      0,
    )

    // Stamp 0x0001 directly at (115, 215) -> blocks Margin2 as well
    m.setU16(pCollMap + (15 * 30 + 15) * 2, 0x0001)
    expect(OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(m, pRoomCoords, pPos, pRoom, 2, 2)).toBe(
      0,
    )
  })

  it('ports OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c (0x6FC4E730), OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c (0x6FC4E740), OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c (0x6FC4EC70), and OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c (0x6FC4EF50)', () => {
    const { m, pObjectsTxt } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 100)
    const pObjCtrl = m.alloc(0x20)
    m.setU32(pGame + 0x10f0, pObjCtrl)

    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    const pStaticPath = m.alloc(0x20)
    m.setU32(pObj, 2) // UNIT_OBJECT
    m.setU32(pObj + 0x14, pObjData)
    m.setU32(pObj + 0x2c, pStaticPath)

    const pInit = m.alloc(0x20)
    m.setU32(pInit + 0x00, pGame)
    m.setU32(pInit + 0x04, pObj)
    m.setU32(pInit + 0x0c, pObjCtrl)
    m.setU32(pInit + 0x10, pObjectsTxt)

    m.setU32(pObj + 0x10, 0)
    expect(OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c(m, pInit)).toBe(1)
    expect(m.u32(pObj + 0x10)).toBe(1)

    m.setU32(pObj + 0x10, 0)
    expect(OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c(m, pInit)).toBe(1)
    expect(m.u32(pObj + 0x10)).toBe(1)

    // InitFn34: seed (lo=0, hi=0) -> newLo=0 (even -> stays 0); seed (lo=1, hi=0) -> newLo=0x6ac690c5 (odd -> mode 1)
    m.setU32(pObj + 0x10, 0)
    m.setU32(pObjCtrl, 0)
    m.setU32(pObjCtrl + 4, 0)
    OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c(m, pInit)
    expect(m.u32(pObj + 0x10)).toBe(0)

    m.setU32(pObjCtrl, 1)
    m.setU32(pObjCtrl + 4, 0)
    OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c(m, pInit)
    expect(m.u32(pObj + 0x10)).toBe(1)

    // InitFn57: initializes chest seed & lock flags and sets sparkly chest byte +0x78 = 1
    const { pRoom } = allocRoomWithCollision(m, 0, 0, 20, 20, 2)
    m.setU32(pInit + 0x08, pRoom)
    OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c(m, pInit)
    expect(m.u8(pObj + 0x78)).toBe(1)
    expect(m.u32(pObj + 0x20)).toBeGreaterThan(0)
  })

  it('ports OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c (0x6FC52BC0)', () => {
    const { m, pObjectsTxt } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 100)
    const { pRoom } = allocRoomWithCollision(m, 0, 0, 32, 32, 2) // 32*32=1024 -> >>7 = 8

    // Density > 128 asserts line 2195
    expect(() =>
      OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c(m, pGame, pRoom, 129, 5, 100),
    ).toThrow(/2195/)

    const objId = 5
    const pTxt = pObjectsTxt + objId * 0x1c0
    m.setU32(pTxt + 0xd0, 2) // sizeX
    m.setU32(pTxt + 0xd4, 2) // sizeY
    m.setU8(pTxt + 0xc4 + 0, 1) // bSelectable[0] = 1

    const pSpawned = m.alloc(0x100)
    m.setU32(pSpawned, 2)
    m.setU32(pSpawned + 0x10, 0)
    m.setU32(pSpawned + 0xc4, 0)

    // nProb = 100 guarantees roll <= nProb; density 64 -> (8 * 64) >> 8 = 2 attempts
    const res = OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c(
      m,
      pGame,
      pRoom,
      64,
      objId,
      100,
      {
        regpop: {
          onSpawnRandomObjectInRoom: () => pSpawned,
        },
      },
    )
    expect(res).toBe(pSpawned)
    expect(m.u32(pSpawned + 0xc4) & 2).toBe(2)

    // bSelectable[0] = 0 clears bit 0x02 on pObj + 0xC4
    m.setU8(pTxt + 0xc4 + 0, 0)
    OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c(m, pGame, pRoom, 64, objId, 100, {
      regpop: {
        onSpawnRandomObjectInRoom: () => pSpawned,
      },
    })
    expect(m.u32(pSpawned + 0xc4) & 2).toBe(0)
  })

  it('ports Object InitFns 51, 11, 59, 58, 24, 22, and 10 (0x6FC532F0, 0x6FC53330, 0x6FC53620, 0x6FC53680, 0x6FC536D0, 0x6FC536F0, 0x6FC53740)', () => {
    const { m, pObjectsTxt } = createLaneJWorld()
    const pGame = allocGameWithTimer(m, 400)
    const pObjCtrl = m.alloc(0x20)
    m.setU32(pGame + 0x10f0, pObjCtrl)

    const { pRoom, pLevel } = allocRoomWithCollision(m, 10, 10, 30, 30, 42) // Act 2 (level 42 -> town 40)
    const pTxt = pObjectsTxt + 3 * 0x1c0
    m.setU32(pTxt + 0xdc, 0x0a00) // dwFrameCnt1 >> 8 = 10

    const makeObjInit = (mode: number): { pObj: number; pObjData: number; pInit: number } => {
      const pObj = m.alloc(0x100)
      const pObjData = m.alloc(0x40)
      const pStaticPath = m.alloc(0x20)
      m.setU32(pObj, 2)
      m.setU32(pObj + 0x04, 3)
      m.setU32(pObj + 0x10, mode)
      m.setU32(pObj + 0x14, pObjData)
      m.setU32(pObjData, pTxt)
      m.setU32(pStaticPath + 0x00, pRoom)
      m.setU32(pStaticPath + 0x0c, 20)
      m.setU32(pStaticPath + 0x10, 20)
      m.setU32(pObj + 0x2c, pStaticPath)

      const pInit = m.alloc(0x20)
      m.setU32(pInit + 0x00, pGame)
      m.setU32(pInit + 0x04, pObj)
      m.setU32(pInit + 0x08, pRoom)
      m.setU32(pInit + 0x0c, pObjCtrl)
      m.setU32(pInit + 0x10, pTxt)
      m.setU32(pInit + 0x14, 20)
      m.setU32(pInit + 0x18, 20)
      return { pObj, pObjData, pInit }
    }

    // 0x6FC532F0 (InitFn 51): mode 0 ignored, mode 2 schedules event 9 at 400 + 35 = 435
    const f51a = makeObjInit(0)
    OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c(m, f51a.pInit)
    expect(readUnitEvents(m, f51a.pObj)).toEqual([])
    const f51b = makeObjInit(2)
    OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c(m, f51b.pInit)
    expect(readUnitEvents(m, f51b.pObj)).toEqual([{ nType: 9, dwFrame: 435 }])

    // 0x6FC53330 (InitFn 11): stores town level 40 in pObjData+0x04 and schedules event 1 at 400 + 10 + 1 = 411
    const f11 = makeObjInit(1)
    OBJECTS_InitFn11_InitTownPortal_6FC53330_113c(m, f11.pInit)
    expect(m.u8(f11.pObjData + 0x04)).toBe(40)
    expect(readUnitEvents(m, f11.pObj)).toEqual([{ nType: 1, dwFrame: 411 }])

    // 0x6FC53620 (InitFn 59): mode 0 -> mode 1 + event 7 (427) + event 1 (411)
    const f59 = makeObjInit(0)
    OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c(m, f59.pInit)
    expect(m.u32(f59.pObj + 0x10)).toBe(1)
    expect(readUnitEvents(m, f59.pObj)).toEqual([
      { nType: 1, dwFrame: 411 },
      { nType: 7, dwFrame: 427 },
    ])

    // 0x6FC53680 (InitFn 58): seed 0 -> jitter 0 -> event 8 at 400 + 0x19 = 425
    m.setU32(pObjCtrl, 0)
    m.setU32(pObjCtrl + 4, 0)
    const f58 = makeObjInit(0)
    OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c(m, f58.pInit)
    expect(readUnitEvents(m, f58.pObj)).toEqual([{ nType: 8, dwFrame: 425 }])

    // 0x6FC536D0 (InitFn 24): event 3 at 425
    const f24 = makeObjInit(0)
    OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c(m, f24.pInit)
    expect(readUnitEvents(m, f24.pObj)).toEqual([{ nType: 3, dwFrame: 425 }])

    // 0x6FC536F0 (InitFn 22): +0x141 = 1 & +0x13F = 0 -> mode 2 + event 0 at 425
    m.setU8(pTxt + 0x141, 1)
    m.setU8(pTxt + 0x13f, 0)
    const f22 = makeObjInit(0)
    OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c(m, f22.pInit)
    expect(m.u32(f22.pObj + 0x10)).toBe(2)
    expect(readUnitEvents(m, f22.pObj)).toEqual([{ nType: 0, dwFrame: 425 }])

    // 0x6FC53740 (InitFn 10): level 42 -> mode 2 + event 0 at 425; level 1 -> event 8 at 460
    const f10Wild = makeObjInit(0)
    OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c(m, f10Wild.pInit)
    expect(m.u32(f10Wild.pObj + 0x10)).toBe(2)
    expect(readUnitEvents(m, f10Wild.pObj)).toEqual([{ nType: 0, dwFrame: 425 }])

    m.setU32(pLevel + 0x1d0, 1)
    const f10Town = makeObjInit(0)
    OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c(m, f10Town.pInit)
    expect(m.u32(f10Town.pObj + 0x10)).toBe(0)
    expect(readUnitEvents(m, f10Town.pObj)).toEqual([{ nType: 8, dwFrame: 460 }])
  })

  it('ports QUESTS_CheckGlobalQuestState_6FC538D0_113c (0x6FC538D0), QUESTS_SetGlobalQuestState_6FC53920_113c (0x6FC53920), and QUESTS_CheckNotIntro_6FC53970_113c (0x6FC53970)', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x1200)
    const pQuestCtrl = m.alloc(0x28)
    const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU32(pQuestCtrl + 0x0c, pQuestFlags)
    m.setU32(pGame + 0x10f4, pQuestCtrl)

    // Uninitialized quest control asserts
    expect(() => QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, pGame, 3, 1)).toThrow(/2092/)
    expect(() => QUESTS_SetGlobalQuestState_6FC53920_113c(m, pGame, 3, 1)).toThrow(/2080/)
    expect(() => QUESTS_CheckNotIntro_6FC53970_113c(m, 0, 3)).toThrow(/1987/)
    expect(() => QUESTS_CheckNotIntro_6FC53970_113c(m, pGame, 3)).toThrow(/1989/)

    m.setU32(pQuestCtrl + 0x08, 1)
    expect(QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, pGame, 3, 5)).toBe(0)
    QUESTS_SetGlobalQuestState_6FC53920_113c(m, pGame, 3, 5)
    expect(QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, pGame, 3, 5)).toBe(1)

    // CheckNotIntro: missing quest returns 1; bNotIntro == 0 -> 0; bNotIntro == 1 -> 1
    expect(QUESTS_CheckNotIntro_6FC53970_113c(m, pGame, 7)).toBe(1)
    const pQuest = m.alloc(0x100)
    m.setU32(pQuest, 7)
    m.setU8(pQuest + 0x09, 0)
    m.setU32(pQuestCtrl, pQuest)
    expect(QUESTS_CheckNotIntro_6FC53970_113c(m, pGame, 7)).toBe(0)
    m.setU8(pQuest + 0x09, 1)
    expect(QUESTS_CheckNotIntro_6FC53970_113c(m, pGame, 7)).toBe(1)
  })

  it('ports QUESTS_ResolveDefaultStatusByte_6FC53A30_113c (0x6FC53A30)', () => {
    const m = new SparseMemory113c()
    const pQuest = m.alloc(0x100)
    const pFlags = QUESTRECORD_AllocRecord113c(m, 0)
    const pOut = m.alloc(4)

    // Case 1: b0C (2) < b0D (5), no state 0x0E -> writes b0B (3)
    m.setU32(pQuest, 2)
    m.setU8(pQuest + 0x0b, 3)
    m.setU8(pQuest + 0x0c, 2)
    m.setU8(pQuest + 0x0d, 5)
    m.setU32(pQuest + 0xe0, 2)
    QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(m, pQuest, pFlags, pOut)
    expect(m.u8(pOut)).toBe(3)

    // Case 2: b0C < b0D with state 0x0E -> writes 0x0C
    QUESTRECORD_SetQuestState113c(m, pFlags, 2, 0x0e)
    QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(m, pQuest, pFlags, pOut)
    expect(m.u8(pOut)).toBe(0x0c)

    // Case 3: quest 10 (0x0A) when b0C >= b0D: b0B == 4 -> 4; b0B != 4 -> 12
    const pFlags2 = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU32(pQuest, 0x0a)
    m.setU8(pQuest + 0x0b, 4)
    m.setU8(pQuest + 0x0c, 5)
    m.setU8(pQuest + 0x0d, 5)
    m.setU32(pQuest + 0xe0, 0x0a)
    QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(m, pQuest, pFlags2, pOut)
    expect(m.u8(pOut)).toBe(4)
    m.setU8(pQuest + 0x0b, 2)
    QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(m, pQuest, pFlags2, pOut)
    expect(m.u8(pOut)).toBe(12)

    // Case 4: quest 4 with state 0x0E and b0C >= b0D: b0C == 6 -> 0x0C, b0C == 7 -> b0B
    QUESTRECORD_SetQuestState113c(m, pFlags2, 4, 0x0e)
    m.setU32(pQuest, 4)
    m.setU8(pQuest + 0x0b, 9)
    m.setU8(pQuest + 0x0c, 6)
    m.setU8(pQuest + 0x0d, 5)
    m.setU32(pQuest + 0xe0, 4)
    QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(m, pQuest, pFlags2, pOut)
    expect(m.u8(pOut)).toBe(0x0c)
    m.setU8(pQuest + 0x0c, 7)
    QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(m, pQuest, pFlags2, pOut)
    expect(m.u8(pOut)).toBe(9)
  })

  it('ports QUESTS_AppendQuestTimer_6FC53AF0_113c (0x6FC53AF0), QUESTS_GetQuestSeedPtr_6FC53D90_113c (0x6FC53D90), and QUESTS_GetQuestData_6FC53F30_113c (0x6FC53F30)', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x1200)

    expect(() => QUESTS_GetQuestSeedPtr_6FC53D90_113c(m, pGame)).toThrow(/507/)
    expect(() => QUESTS_GetQuestData_6FC53F30_113c(m, pGame, -1)).toThrow(/119/)
    expect(QUESTS_GetQuestData_6FC53F30_113c(m, pGame, 5)).toBe(0)

    const pQuestCtrl = m.alloc(0x30)
    m.setU32(pQuestCtrl + 0x14, 250) // dwTick
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    expect(QUESTS_GetQuestSeedPtr_6FC53D90_113c(m, pGame)).toBe(pQuestCtrl + 0x18)

    const pQuest = m.alloc(0x100)
    m.setU32(pQuest, 5)
    m.setU32(pQuest + 0x04, pGame)
    m.setU32(pQuestCtrl, pQuest)
    expect(QUESTS_GetQuestData_6FC53F30_113c(m, pGame, 5)).toBe(pQuest)
    expect(QUESTS_GetQuestData_6FC53F30_113c(m, pGame, 9)).toBe(0)

    // AppendQuestTimer prepends node and asserts if bExecuting (+0x04) != 0
    QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 30, pQuest, 0x6fd00001)
    const pTimer = m.u32(pQuestCtrl + 0x10)
    expect(pTimer).toBeGreaterThan(0)
    expect(m.u32(pTimer)).toBe(0x6fd00001)
    expect(m.u32(pTimer + 0x04)).toBe(pQuest)
    expect(m.u32(pTimer + 0x08)).toBe(280)
    expect(m.u32(pTimer + 0x0c)).toBe(30)
    expect(m.u32(pTimer + 0x10)).toBe(0)

    m.setU32(pQuestCtrl + 0x04, 1)
    expect(() => QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 10, pQuest, 0x6fd00001)).toThrow(/1047/)
  })

  it('ports QUESTS_AttachQuestToUnit_6FC53F80_113c (0x6FC53F80), QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c (0x6FC53C70), and QUESTS_FreeUnitQuestChain_6FC53FF0_113c (0x6FC53FF0)', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x100)
    m.setU32(pGame + 0x1c, 0xfeed0000)

    const pUnit = m.alloc(0x100)
    const pQuestA = m.alloc(0x100)
    const pQuestB = m.alloc(0x100)
    m.setU8(pQuestA + 0x0a, 1) // active
    m.setU8(pQuestB + 0x0a, 0) // inactive
    m.setU32(pQuestA + 2 * 4 + 0xa0, 0x6fc90001)
    m.setU32(pQuestB + 2 * 4 + 0xa0, 0x6fc90002)

    expect(() => QUESTS_AttachQuestToUnit_6FC53F80_113c(m, 0, pUnit, pGame)).toThrow(/93/)
    expect(QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQuestA, pUnit, pGame)).toBe(1)
    expect(QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQuestA, pUnit, pGame)).toBe(0) // duplicate
    expect(QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQuestB, pUnit, pGame)).toBe(1)

    const pArg = m.alloc(0x1c)
    m.setU32(pArg + 0x00, pGame)
    m.setU32(pArg + 0x04, 2) // cbIdx = 2
    m.setU32(pArg + 0x08, pUnit)

    const fired: number[] = []
    const hooks: laneJExports.LaneJKernHooks113c = {
      onQuestCallback: (_mem, pfn) => fired.push(pfn),
    }

    // bForceInactive = 0 -> only active pQuestA fires
    QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c(m, pArg, 0, hooks)
    expect(fired).toEqual([0x6fc90001])

    // bForceInactive = 1 -> both pQuestB and pQuestA fire
    fired.length = 0
    QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c(m, pArg, 1, hooks)
    expect(fired).toEqual([0x6fc90002, 0x6fc90001])

    // Free chain records freed blocks with game memPool
    const freed: Array<{ pool: number; block: number }> = []
    QUESTS_FreeUnitQuestChain_6FC53FF0_113c(m, pGame, m.u32(pUnit + 0x74), {
      onFreeMem: (_mem, pool, block) => freed.push({ pool, block }),
    })
    expect(freed.length).toBe(2)
    expect(freed[0]!.pool).toBe(0xfeed0000)
  })

  it('ports OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c (0x6FC54370)', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x1200)
    const pQuestCtrl = m.alloc(0x20)
    m.setU32(pGame + 0x10f4, pQuestCtrl)

    const pObj = m.alloc(0x100)
    const pStaticPath = m.alloc(0x20)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x2c, pStaticPath)
    const pInit = m.alloc(0x20)
    m.setU32(pInit, pGame)
    m.setU32(pInit + 0x04, pObj)

    // Missing quest 15 asserts line 2435
    expect(() => OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c(m, pInit)).toThrow(/2435/)

    const pQuest15 = m.alloc(0x100)
    const pQuest15Ex = m.alloc(0x40)
    m.setU32(pQuest15, 0x0f)
    m.setU32(pQuest15 + 0x18, pQuest15Ex)
    m.setU32(pQuest15Ex + 0x18, 1)
    m.setU32(pQuestCtrl, pQuest15)

    // bNotIntro == 0 -> forces mode 2
    m.setU8(pQuest15 + 0x09, 0)
    OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c(m, pInit)
    expect(m.u32(pObj + 0x10)).toBe(2)

    // bNotIntro == 1 -> syncs mode from pQuestDataEx + 0x18 (1)
    m.setU8(pQuest15 + 0x09, 1)
    OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c(m, pInit)
    expect(m.u32(pObj + 0x10)).toBe(1)
  })

  it('ports QUESTS_TriggerItemPickedUp_6FC54510_113c (0x6FC54510) and QUESTS_TriggerItemDropped_6FC545A0_113c (0x6FC545A0)', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x100)
    const pItem = m.alloc(0x100)
    const pActor = m.alloc(0x100)

    const pQuest = m.alloc(0x100)
    m.setU8(pQuest + 0x0a, 1) // active
    m.setU32(pQuest + 5 * 4 + 0xa0, 0x6fc90555) // cbIdx 5 (picked up)
    m.setU32(pQuest + 4 * 4 + 0xa0, 0x6fc90444) // cbIdx 4 (dropped)
    QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQuest, pItem, pGame)

    const captured: Array<{ pfn: number; cbIdx: number; item: number; actor: number }> = []
    const hooks: laneJExports.LaneJKernHooks113c = {
      onQuestCallback: (mem, pfn, _q, pArg) => {
        captured.push({
          pfn,
          cbIdx: mem.u32(pArg + 0x04),
          item: mem.u32(pArg + 0x08),
          actor: mem.u32(pArg + 0x0c),
        })
      },
    }

    QUESTS_TriggerItemPickedUp_6FC54510_113c(m, pGame, pItem, pActor, hooks)
    QUESTS_TriggerItemDropped_6FC545A0_113c(m, pGame, pItem, pActor, hooks)
    expect(captured).toEqual([
      { pfn: 0x6fc90555, cbIdx: 5, item: pItem, actor: pActor },
      { pfn: 0x6fc90444, cbIdx: 4, item: pItem, actor: pActor },
    ])

    // IsBadCodePtr sentinel (0xFFFFFFFF) throws line 574
    m.setU32(pQuest + 5 * 4 + 0xa0, 0xffffffff)
    expect(() => QUESTS_TriggerItemPickedUp_6FC54510_113c(m, pGame, pItem, pActor, hooks)).toThrow(
      /574/,
    )
    m.setU32(pQuest + 4 * 4 + 0xa0, 0xffffffff)
    expect(() => QUESTS_TriggerItemDropped_6FC545A0_113c(m, pGame, pItem, pActor, hooks)).toThrow(
      /574/,
    )
  })

  it('directly exercises built-in Act 3 Quest 7 callback VAs via QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x100)
    const pUnit = m.alloc(0x100)
    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    const pPFlags = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU32(pPlayerData + 0x10, pPFlags)

    const pQuest = m.alloc(0x100)
    const pEx = m.alloc(0x30)
    m.setU8(pQuest + 0x0a, 1)
    m.setU32(pEx + 0x10, 1) // non-zero relic counter triggers promotion
    m.setU32(pQuest + 0x18, pEx)
    m.setU32(pQuest + 11 * 4 + 0xa0, 0x6fd02ef0) // ACT3Q7_Callback11_Noop
    m.setU32(pQuest + 14 * 4 + 0xa0, 0x6fd049e0) // ACT3Q7_Callback14_PlayerJoined
    QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQuest, pUnit, pGame)

    const pArg = m.alloc(0x1c)
    m.setU32(pArg + 0x00, pGame)
    m.setU32(pArg + 0x04, 11)
    m.setU32(pArg + 0x08, pUnit)
    m.setU32(pArg + 0x0c, pPlayer)
    QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c(m, pArg, 0)

    m.setU32(pArg + 0x04, 14)
    QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c(m, pArg, 0)
    expect(m.u8(pQuest + 0x0c)).toBe(2)
    expect(m.u8(pQuest + 0x0b)).toBe(7)
  })
})
