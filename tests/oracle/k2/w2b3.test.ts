import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
  D2CommonAssertError,
} from '../../../src/d2kern-113c/common/inline-helpers.js'
import { STATES_ToggleState113c } from '../../../src/d2kern-113c/common/statlist.js'
import { UNITS_InitPath113c } from '../../../src/d2kern-113c/common/unit.js'
import {
  AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c,
  AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c,
  MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c,
  MONMODE_EnterAnimMode10_6FC94C90_113c,
  MONMODE_EnterAnimMode6_6FC94C10_113c,
  MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c,
  MONMODE_EnterSequenceMode14_6FC954E0_113c,
  MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c,
  MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c,
  MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c,
  NET_SendPacket07_RoomTileCoords_6FCABF50_113c,
  NET_SendPacket103B_QuestRecord_6FCAAD40_113c,
  NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c,
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c,
  NET_SendPacket1A1B1C_StatUpdate_6FCABDA0_113c,
  NET_SendPacket42_ClearCursor_6FCAAF10_113c,
  NET_SendPacket47_UnitRelator1_6FCAAEC0_113c,
  NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c,
  NET_SendPacket60_PortalInfo_6FCAAAE0_113c,
  NET_SendPacket61_ByteParam_6FCAAAC0_113c,
  NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c,
  NET_SendPacket77_ButtonAction_6FCAB340_113c,
  NET_SendPacket79_GoldInTrade_6FCAB1F0_113c,
  NET_SendPacket7A_SummonChange_6FCAB290_113c,
  NET_SendPacket7B_ByteAndDword_6FCAAD10_113c,
  NET_SendPacket81_AssignMerc_6FCAB220_113c,
  NET_SendPacket98_UnitWordValue_6FCAA6C0_113c,
  NET_SendPacket9B_MercReviveInfo_6FCAA690_113c,
  NET_SendPacketA5_StateSkill_6FCABA10_113c,
  NET_SendPacketBuffer15B_6FCAABF0_113c,
  NET_SendPacketBuffer21B_6FCAAA70_113c,
  NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c,
  NET_SendPacketBuffer32B_6FCAAA10_113c,
  NET_SendPacketBuffer40B_6FCAB3D0_113c,
  NET_SendPacketBuffer6B_6FCAACD0_113c,
  NET_SendPacketBuffer7B_6FCAAB20_113c,
  NET_ShouldSyncTrackedStatDelta_6FCAA330_113c,
  OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c,
  OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c,
  OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c,
  OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c,
  OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c,
  PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c,
  PLRTRADE_WalkTradeItemList_6FC8FFA0_113c,
  SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c,
} from '../../../src/d2kern-113c/game/k2-w2b3-113c.js'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.js'
import {
  D2MonStatsTxt_SIZE,
  D2ObjectsTxt_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.js'
import {
  type Memory113c,
  SparseMemory113c,
} from '../../../src/d2kern-113c/mem/sparse-memory.js'

const SGPT_OBJECTS_TXT_PTR_VA_113C = 0x6fdf0b94
const SGPT_OBJECTS_TXT_COUNT_VA_113C = 0x6fdf0b98

/** Creates a client with an attached packet queue buffer at `+0x1BC`. */
function createTestClientWithQueue(m: Memory113c): { pClient: number; pQueue: number } {
  const pClient = m.alloc(0x500) >>> 0
  const pQueue = m.alloc(0x40c) >>> 0
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)
  return { pClient, pQueue }
}

/** Reads `nSize` queued packet bytes from `pQueue + 0x08`. */
function readQueuedBytes(m: Memory113c, pQueue: number, nSize: number): number[] {
  const out: number[] = []
  for (let i = 0; i < nSize; i++) {
    out.push(m.u8((pQueue + 0x04 + i) >>> 0))
  }
  return out
}

/** Sets up bitmasks and `ItemStatCost.txt` / `States.txt` tables in `Memory113c`. */
function setupDataTablesForStatsAndStates(m: Memory113c): number {
  const pBitMasks = m.alloc(128) >>> 0
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.setU32(0x6fd27c30, pBitMasks)
  m.setU32(0x6fd18be0, pBitMasks) // D2GAME_IAT_GDW_BITMASKS_VA_113C

  const pDataTables = m.alloc(0x1000) >>> 0
  const pDataTablesSlot = m.alloc(4) >>> 0
  m.setU32(pDataTablesSlot, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(0x6fd27d08, pDataTables)
  m.setU32(0x6fd1829c, pDataTablesSlot) // D2GAME_IAT_SGPT_DATATABLES_VA_113C

  const pItemStatCost = m.alloc(20 * 0x144) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0, pItemStatCost)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0, 20)

  const pStatesTxt = m.alloc(200 * 0x40) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pStatesTxt) >>> 0, pStatesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0, 200)

  const pMonStatsTxt = m.alloc(220 * D2MonStatsTxt_SIZE) >>> 0
  for (let i = 0; i < 220; i++) {
    m.setU16((pMonStatsTxt + i * D2MonStatsTxt_SIZE + 0x06) >>> 0, i)
  }
  m.setU32((pDataTables + DATATABLES_OFF_113C.pMonStatsTxt) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) >>> 0, 220)

  const pMonStats2Txt = m.alloc(220 * 0x134) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa8c) >>> 0, 220)

  const pAnimDataTable = m.alloc(0x500) >>> 0
  const pEmptyBucket = m.alloc(16) >>> 0
  for (let i = 0; i < 256; i++) {
    m.setU32((pAnimDataTable + i * 4) >>> 0, pEmptyBucket)
  }
  m.setU32((pAnimDataTable + 0x40c) >>> 0, 8)
  m.setU32((pAnimDataTable + 0x410) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13a4, 16)
  m.setU32(0x6fdf13b0, m.alloc(16 * 0x34) >>> 0)

  for (let i = 0; i < 160 * 4; i++) {
    m.setU32((0x6fd2e668 + i * 4) >>> 0, 0)
  }

  return pDataTables
}

/** Attaches a base `D2StatListExStrc` (`0x80000000`) with `(statId, value)` pairs to `pUnit`. */
function attachStatListEx(
  m: Memory113c,
  pUnit: number,
  stats: ReadonlyArray<readonly [number, number]>,
): number {
  const pStatList = m.alloc(0x64) >>> 0
  m.setU32((pStatList + 0x04) >>> 0, m.u32(pUnit >>> 0))
  m.setU32((pStatList + 0x08) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
  m.setU32((pStatList + 0x0c) >>> 0, 0x80000000)
  const pBaseArr = m.alloc(Math.max(16, stats.length * 8)) >>> 0
  const pFullArr = m.alloc(Math.max(16, stats.length * 8)) >>> 0
  for (let i = 0; i < stats.length; i++) {
    const [statId, val] = stats[i]!
    m.setU16((pBaseArr + i * 8) >>> 0, 0)
    m.setU16((pBaseArr + i * 8 + 2) >>> 0, statId)
    m.setU32((pBaseArr + i * 8 + 4) >>> 0, val >>> 0)
    m.setU16((pFullArr + i * 8) >>> 0, 0)
    m.setU16((pFullArr + i * 8 + 2) >>> 0, statId)
    m.setU32((pFullArr + i * 8 + 4) >>> 0, val >>> 0)
  }
  m.setU32((pStatList + 0x24) >>> 0, pBaseArr)
  m.setU16((pStatList + 0x28) >>> 0, stats.length)
  m.setU16((pStatList + 0x2a) >>> 0, Math.max(2, stats.length))
  m.setU32((pStatList + 0x48) >>> 0, pFullArr)
  m.setU16((pStatList + 0x4c) >>> 0, stats.length)
  m.setU16((pStatList + 0x4e) >>> 0, Math.max(2, stats.length))
  m.setU32((pUnit + 0x5c) >>> 0, pStatList)
  return pStatList
}

describe('Milestone 33 [K2] Wave 2 Batch 3 (w2b3: 45 D2Game.dll functions)', () => {
  it('[1/45] OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c toggles between modes 0 and 1', () => {
    const m = new SparseMemory113c()
    const pArgs = m.alloc(0x10) >>> 0
    const pObj = m.alloc(0x100) >>> 0
    m.setU32(pObj, 2) // UNIT_OBJECT
    UNITS_InitPath113c(m, pObj, 0, 0, 0)
    m.setU32((pObj + 0x10) >>> 0, 0)
    m.setU32((pArgs + 0x04) >>> 0, pObj)

    expect(OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c(m, pArgs)).toBe(0)
    expect(m.u32((pObj + 0x10) >>> 0)).toBe(1)

    expect(OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c(m, pArgs)).toBe(0)
    expect(m.u32((pObj + 0x10) >>> 0)).toBe(0)

    m.setU32((pObj + 0x10) >>> 0, 2)
    expect(OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c(m, pArgs)).toBe(0)
    expect(m.u32((pObj + 0x10) >>> 0)).toBe(2)

    m.setU32((pArgs + 0x04) >>> 0, 0)
    expect(OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c(m, pArgs)).toBe(0)
  })

  it('[2/45] OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c restores life and mana to max', () => {
    const m = new SparseMemory113c()
    setupDataTablesForStatsAndStates(m)
    const pUnit = m.alloc(0x100) >>> 0
    m.setU32(pUnit, 0) // UNIT_PLAYER
    attachStatListEx(m, pUnit, [
      [6, 100], // STAT_HITPOINTS
      [7, 250], // STAT_MAXHP
      [8, 40], // STAT_MANA
      [9, 120], // STAT_MAXMANA
    ])

    const pArgs = m.alloc(0x10) >>> 0
    m.setU32((pArgs + 0x08) >>> 0, pUnit)

    OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c(m, pArgs)
    const pStatList = m.u32((pUnit + 0x5c) >>> 0) >>> 0
    const pBaseArr = m.u32((pStatList + 0x24) >>> 0) >>> 0
    expect(m.u32((pBaseArr + 0 * 8 + 4) >>> 0)).toBe(250)
    expect(m.u32((pBaseArr + 2 * 8 + 4) >>> 0)).toBe(120)

    // Calling again when already at max is a no-op
    OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c(m, pArgs)
    expect(m.u32((pBaseArr + 0 * 8 + 4) >>> 0)).toBe(250)
    expect(m.u32((pBaseArr + 2 * 8 + 4) >>> 0)).toBe(120)
  })

  it('[3/45] OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c checks player and monster alive states', () => {
    const m = new SparseMemory113c()
    expect(OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c(m, 0)).toBe(0)

    const pMonster = m.alloc(0x100) >>> 0
    m.setU32(pMonster, 1)
    m.setU32((pMonster + 0x10) >>> 0, 1) // neutral
    expect(OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c(m, pMonster)).toBe(1)

    m.setU32((pMonster + 0x10) >>> 0, 12) // MONMODE_DEAD
    expect(OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c(m, pMonster)).toBe(0)

    const pPlayer = m.alloc(0x100) >>> 0
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x10) >>> 0, 1)
    expect(OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c(m, pPlayer)).toBe(1)

    m.setU32((pPlayer + 0x10) >>> 0, 0) // PLRMODE_DEATH
    expect(OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c(m, pPlayer)).toBe(0)

    m.setU32((pPlayer + 0x10) >>> 0, 0x11) // PLRMODE_DEAD
    expect(OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c(m, pPlayer)).toBe(0)

    const pObject = m.alloc(0x100) >>> 0
    m.setU32(pObject, 2)
    expect(OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c(m, pObject)).toBe(0)
  })

  it('[4/45] OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c resets subclass-bit-0 object', () => {
    const m = new SparseMemory113c()
    const pObj = m.alloc(0x100) >>> 0
    const pObjData = m.alloc(0x40) >>> 0
    const pObjTxt = m.alloc(0x200) >>> 0
    m.setU32(pObj, 2)
    UNITS_InitPath113c(m, pObj, 0, 0, 0)
    m.setU32((pObj + 0x10) >>> 0, 2)
    m.setU32((pObj + 0x14) >>> 0, pObjData)
    m.setU32(pObjData, pObjTxt)
    m.setU32((pObjData + 0x0c) >>> 0, 999)

    // SubClass bit 0 clear (+0x167 in D2ObjectsTxt) -> no-op
    m.setU8((pObjTxt + 0x167) >>> 0, 2)
    OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c(m, 0, pObj)
    expect(m.u32((pObj + 0x10) >>> 0)).toBe(2)
    expect(m.u32((pObjData + 0x0c) >>> 0)).toBe(999)

    // SubClass bit 0 set -> resets mode to 0, sets flag bit 1, clears +0x0C
    m.setU8((pObjTxt + 0x167) >>> 0, 1)
    OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c(m, 0, pObj)
    expect(m.u32((pObj + 0x10) >>> 0)).toBe(0)
    expect(m.u32((pObj + 0xc4) >>> 0) & 1).toBe(1)
    expect(m.u32((pObjData + 0x0c) >>> 0)).toBe(0)
  })

  it('[5/45] OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c transitions mode 1 object to mode 2', () => {
    const m = new SparseMemory113c()
    const pObjectsTable = m.alloc(4 * D2ObjectsTxt_SIZE) >>> 0
    m.setU32(SGPT_OBJECTS_TXT_PTR_VA_113C, pObjectsTable)
    m.setU32(SGPT_OBJECTS_TXT_COUNT_VA_113C, 4)

    const pObj = m.alloc(0x100) >>> 0
    m.setU32(pObj, 2)
    UNITS_InitPath113c(m, pObj, 0, 0, 0)
    m.setU32((pObj + 0x04) >>> 0, 1)
    m.setU32((pObj + 0x10) >>> 0, 1)

    // Guard: null object or nSubClass (+0x141) == 0
    OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c(m, 0, 0)
    OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c(m, 0, pObj)
    expect(m.u32((pObj + 0x10) >>> 0)).toBe(1)

    // Enable +0x141 = 1, +0x122 = 1
    const pRec1 = (pObjectsTable + D2ObjectsTxt_SIZE) >>> 0
    m.setU8((pRec1 + 0x141) >>> 0, 1)
    m.setU8((pRec1 + 0x122) >>> 0, 1)
    OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c(m, 0, pObj)
    expect(m.u32((pObj + 0x10) >>> 0)).toBe(2)
  })

  it('[6/45] & [7/45] PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c and PLRTRADE_WalkTradeItemList_6FC8FFA0_113c manage trade nodes', () => {
    const m = new SparseMemory113c()
    const pPlayer = m.alloc(0x100) >>> 0
    const pPlayerData = m.alloc(0x100) >>> 0
    const pTrade = m.alloc(0x20) >>> 0
    const pGame = m.alloc(0x40) >>> 0
    m.setU32(pPlayer, 0)

    // Guard: null pPlayerData or null pTrade
    expect(PLRTRADE_WalkTradeItemList_6FC8FFA0_113c(m, pPlayer)).toBe(0)
    expect(PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c(m, pPlayer, pGame, 10, 20)).toBe(0)

    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    expect(PLRTRADE_WalkTradeItemList_6FC8FFA0_113c(m, pPlayer)).toBe(0)

    m.setU32((pPlayerData + 0x5c) >>> 0, pTrade)

    const n1 = PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c(m, pPlayer, pGame, 0x1111, 0x2222)
    const n2 = PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c(m, pPlayer, pGame, 0x3333, 0x4444)
    expect(m.u32((pTrade + 0x08) >>> 0)).toBe(n2)
    expect(m.u32(n2)).toBe(0x3333)
    expect(m.u32((n2 + 0x04) >>> 0)).toBe(0x4444)
    expect(m.u32((n2 + 0x08) >>> 0)).toBe(n1)
    expect(m.u32(n1)).toBe(0x1111)
    expect(m.u32((n1 + 0x04) >>> 0)).toBe(0x2222)
    expect(m.u32((n1 + 0x08) >>> 0)).toBe(0)

    expect(PLRTRADE_WalkTradeItemList_6FC8FFA0_113c(m, pPlayer)).toBe(0)
  })

  it('[8/45] & [9/45] MONMODE_EnterAnimMode6_6FC94C10_113c and MONMODE_EnterAnimMode10_6FC94C90_113c switch monster modes', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x100) >>> 0
    const pUnit = m.alloc(0x100) >>> 0
    const pModeChange = m.alloc(0x20) >>> 0
    m.setU32(pUnit, 1)
    m.setU32((pModeChange + 0x04) >>> 0, pUnit)

    expect(MONMODE_EnterAnimMode6_6FC94C10_113c(m, pGame, pModeChange)).toBe(1)
    expect(m.u32((pUnit + 0x10) >>> 0)).toBe(6)

    expect(MONMODE_EnterAnimMode10_6FC94C90_113c(m, pGame, pModeChange)).toBe(1)
    expect(m.u32((pUnit + 0x10) >>> 0)).toBe(10)
  })

  it('[10/45] MONMODE_EnterSequenceMode14_6FC954E0_113c sets mode 14 and clears flag 0x40', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x100) >>> 0
    const pUnit = m.alloc(0x100) >>> 0
    const pModeChange = m.alloc(0x20) >>> 0
    m.setU32(pUnit, 1)
    m.setU32((pUnit + 0xc4) >>> 0, 0x45)
    m.setU32((pModeChange + 0x04) >>> 0, pUnit)

    expect(MONMODE_EnterSequenceMode14_6FC954E0_113c(m, pGame, pModeChange)).toBe(0)
    expect(m.u32((pUnit + 0x10) >>> 0)).toBe(14)
    expect(m.u32((pUnit + 0xc4) >>> 0)).toBe(0x05)
  })

  it('[11/45] MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c forwards to MONSTER_DropTreasureOnDeath113c', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x100) >>> 0
    const pMonster = m.alloc(0x100) >>> 0
    const pKiller = m.alloc(0x100) >>> 0
    MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c(m, pGame, pMonster, pKiller)
    expect(m.u32(pMonster)).toBe(0)
  })

  it('[12/45] MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c advances frame and enters mode 11 on completion', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x100) >>> 0
    const pUnit = m.alloc(0x100) >>> 0
    const pPath = m.alloc(0x220) >>> 0
    m.setU32(pUnit, 1)
    m.setU32((pUnit + 0x2c) >>> 0, pPath)
    m.setU32((pUnit + 0x10) >>> 0, 2)
    m.setU32((pUnit + 0x44) >>> 0, 0) // dwFramePrecise = 0
    m.setU32((pUnit + 0x48) >>> 0, 0x300) // dwFrameCountPrecise = 3 frames (fp8)
    m.setU16((pUnit + 0x4c) >>> 0, 0x100) // wAnimSpeed = 256 (1 frame/tick)

    // Tick 1: advances from 0 to 0x100 (0x100 + 0x100 < 0x300), stays in mode 2
    expect(MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c(m, pGame, pUnit)).toBe(1)
    expect(m.u32((pUnit + 0x10) >>> 0)).toBe(2)

    // Tick 2: advances from 0x100 to 0x200 (0x200 + 0x100 >= 0x300), enters mode 11
    expect(MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c(m, pGame, pUnit)).toBe(1)
    expect(m.u32((pUnit + 0x10) >>> 0)).toBe(11)
  })

  it('[13/45] MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c handles sarcophagus vs standard monsters', () => {
    const m = new SparseMemory113c()
    setupDataTablesForStatsAndStates(m)
    const pGame = m.alloc(0x100) >>> 0
    const pUnit = m.alloc(0x100) >>> 0
    m.setU32(pUnit, 1)
    m.setU32((pUnit + 0x2c) >>> 0, m.alloc(0x220) >>> 0)
    m.setU32((pUnit + 0x04) >>> 0, 5) // non-sarcophagus
    m.setU32((pUnit + 0x10) >>> 0, 11)

    expect(MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c(m, pGame, pUnit)).toBe(1)
    expect(m.u32((pUnit + 0x10) >>> 0)).toBe(12)
  })

  it('[14/45] MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c enters mode 11 and schedules event at +15 frames', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x200) >>> 0
    EVENT_InitTimerQueue113c(m, pGame)
    m.setU32((pGame + 0xa8) >>> 0, 100)

    const pUnit = m.alloc(0x100) >>> 0
    m.setU32(pUnit, 1)
    const pModeChange = m.alloc(0x20) >>> 0
    m.setU32((pModeChange + 0x04) >>> 0, pUnit)

    expect(MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c(m, pGame, pModeChange)).toBe(1)
    expect(m.u32((pUnit + 0x10) >>> 0)).toBe(11)
    const pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    expect(pEvent).not.toBe(0)
    expect(m.u8(pEvent)).toBe(2)
    expect(m.u32((pEvent + 0x04) >>> 0)).toBe(115)
  })

  it('[15/45] MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c asserts on null unit and reschedules mode events', () => {
    const m = new SparseMemory113c()
    setupDataTablesForStatsAndStates(m)
    const pGame = m.alloc(0x200) >>> 0
    EVENT_InitTimerQueue113c(m, pGame)
    m.setU32((pGame + 0xa8) >>> 0, 50)

    expect(() => MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c(m, pGame, 0, 1)).toThrow(
      D2CommonAssertError,
    )

    const pUnit = m.alloc(0x100) >>> 0
    const pSkills = m.alloc(0x20) >>> 0
    m.setU32(pUnit, 1)
    m.setU32((pUnit + 0x48) >>> 0, 0x400)
    m.setU16((pUnit + 0x4c) >>> 0, 0x100)
    m.setU32((pUnit + 0xa8) >>> 0, pSkills)
    m.setU32((pSkills + 0x10) >>> 0, 0xdeadbeef)

    MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c(m, pGame, pUnit, 3)
    expect(m.u32((pUnit + 0x10) >>> 0)).toBe(3)
    expect(m.u32((pSkills + 0x10) >>> 0)).toBe(0)
  })

  it('[16/45] SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c appends 0xA4 nodes to unit message list', () => {
    const m = new SparseMemory113c()
    const pUnit = m.alloc(0x100) >>> 0
    m.setU32(pUnit, 1)

    SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c(m, pUnit, 0x1234)
    const pFirst = m.u32((pUnit + 0xec) >>> 0) >>> 0
    expect(pFirst).not.toBe(0)
    expect(m.u32((pUnit + 0xf0) >>> 0)).toBe(pFirst)
    expect(m.u8((pFirst + 0x04) >>> 0)).toBe(0xa4)
    expect(m.u16((pFirst + 0x08) >>> 0)).toBe(0x1234)

    SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c(m, pUnit, 0x5678)
    const pSecond = m.u32((pUnit + 0xf0) >>> 0) >>> 0
    expect(pSecond).not.toBe(pFirst)
    expect(m.u32(pFirst)).toBe(pSecond)
    expect(m.u16((pSecond + 0x08) >>> 0)).toBe(0x5678)
  })

  it('[17/45] AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c selects closest alive evil monster', () => {
    const m = new SparseMemory113c()
    const pSelf = m.alloc(0x100) >>> 0
    const pPathSelf = m.alloc(0x40) >>> 0
    m.setU32(pSelf, 1)
    m.setU32((pSelf + 0x2c) >>> 0, pPathSelf)
    m.setU16((pPathSelf + 0x02) >>> 0, 100)
    m.setU16((pPathSelf + 0x06) >>> 0, 100)

    const pBestOut = m.alloc(0x10) >>> 0
    m.setU32(pBestOut, 0)
    m.setU32((pBestOut + 0x04) >>> 0, 1000)

    // Self -> ignored
    expect(AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c(m, 0, pSelf, pSelf, pBestOut)).toBe(0)
    expect(m.u32(pBestOut)).toBe(0)

    // Candidate monster at (103, 104) -> sqDist = 9 + 16 = 25
    const pCand = m.alloc(0x100) >>> 0
    const pPathCand = m.alloc(0x40) >>> 0
    m.setU32(pCand, 1)
    m.setU32((pCand + 0x10) >>> 0, 1) // alive
    m.setU32((pCand + 0x2c) >>> 0, pPathCand)
    m.setU16((pPathCand + 0x02) >>> 0, 103)
    m.setU16((pPathCand + 0x06) >>> 0, 104)

    expect(AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c(m, 0, pSelf, pCand, pBestOut)).toBe(0)
    expect(m.u32(pBestOut)).toBe(pCand)
    expect(m.u32((pBestOut + 0x04) >>> 0)).toBe(25)
  })

  it('[18/45] AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c clears state 12 gfx flag and stalls monster', () => {
    const m = new SparseMemory113c()
    setupDataTablesForStatsAndStates(m)
    const pGame = m.alloc(0x200) >>> 0
    EVENT_InitTimerQueue113c(m, pGame)
    m.setU32((pGame + 0xa8) >>> 0, 200)

    const pUnit = m.alloc(0x100) >>> 0
    const pMonData = m.alloc(0x60) >>> 0
    const pMonStatsTxt = m.alloc(0x1b0) >>> 0
    m.setU16((pMonStatsTxt + 0x1e) >>> 0, 6)
    m.setU32(pMonData, pMonStatsTxt)
    m.setU32(pUnit, 1)
    m.setU32((pUnit + 0x10) >>> 0, 1)
    m.setU32((pUnit + 0x14) >>> 0, pMonData)
    attachStatListEx(m, pUnit, [])
    STATES_ToggleState113c(m, pUnit, 0x0c, 1)

    const pAiArgs = m.alloc(0x10) >>> 0
    const pAiEntry = m.alloc(0x10) >>> 0
    m.setU32(pAiArgs, pAiEntry)

    AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c(m, pGame, pUnit, pAiArgs)
    const pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    expect(pEvent).not.toBe(0)
    expect(m.u32((pEvent + 0x04) >>> 0)).toBe(201)
  })

  it('[19/45] NET_ShouldSyncTrackedStatDelta_6FCAA330_113c throttles small deltas up to 6 times', () => {
    const m = new SparseMemory113c()
    const pTrack = m.alloc(0x10) >>> 0
    m.setU32((pTrack + 0x04) >>> 0, 100)

    // Zero delta -> 0
    expect(NET_ShouldSyncTrackedStatDelta_6FCAA330_113c(m, pTrack, 100)).toBe(0)

    // Small delta (|105 - 100| = 5 <= 8): first 6 calls return 0
    for (let i = 1; i <= 6; i++) {
      expect(NET_ShouldSyncTrackedStatDelta_6FCAA330_113c(m, pTrack, 105)).toBe(0)
      expect(m.u8((pTrack + 0x0c) >>> 0)).toBe(i)
    }
    // 7th call triggers sync, resets counter to 0, updates +0x04
    expect(NET_ShouldSyncTrackedStatDelta_6FCAA330_113c(m, pTrack, 105)).toBe(1)
    expect(m.u8((pTrack + 0x0c) >>> 0)).toBe(0)
    expect(m.u32((pTrack + 0x04) >>> 0)).toBe(105)

    // Large negative delta (|90 - 105| = 15 > 8) -> immediate sync
    expect(NET_ShouldSyncTrackedStatDelta_6FCAA330_113c(m, pTrack, 90)).toBe(1)
    expect(m.u32((pTrack + 0x04) >>> 0)).toBe(90)
  })

  it('[20/45]..[25/45] queues packets 0x9B, 0x98, 0x74, 32B buffer, 21B buffer, and 0x61', () => {
    const m = new SparseMemory113c()

    // [20/45] 0x9B (D2Game.dll@0x6FCAA3E0 returns queued byte count `nPacketSize`)
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(NET_SendPacket9B_MercReviveInfo_6FCAA690_113c(m, 0x1234, 0xdeadbeef, pClient)).toBe(7)
      expect(readQueuedBytes(m, pQueue, 7)).toEqual([0x9b, 0x34, 0x12, 0xef, 0xbe, 0xad, 0xde])
    }

    // [21/45] 0x98
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(NET_SendPacket98_UnitWordValue_6FCAA6C0_113c(m, 0x11223344, 0x5566, pClient)).toBe(7)
      expect(readQueuedBytes(m, pQueue, 7)).toEqual([0x98, 0x44, 0x33, 0x22, 0x11, 0x66, 0x55])
    }

    // [22/45] 0x74 (null units -> -1, valid units -> +0x0C guid)
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c(m, 0, 0, pClient, 1)).toBe(10)
      expect(readQueuedBytes(m, pQueue, 10)).toEqual([
        0x74, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      ])

      const { pClient: pClient2, pQueue: pQueue2 } = createTestClientWithQueue(m)
      const pOwner = m.alloc(0x20) >>> 0
      const pCorpse = m.alloc(0x20) >>> 0
      m.setU32((pOwner + 0x0c) >>> 0, 0x01020304)
      m.setU32((pCorpse + 0x0c) >>> 0, 0x05060708)
      expect(
        NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c(m, pOwner, pCorpse, pClient2, 0),
      ).toBe(10)
      expect(readQueuedBytes(m, pQueue2, 10)).toEqual([
        0x74, 0x00, 0x04, 0x03, 0x02, 0x01, 0x08, 0x07, 0x06, 0x05,
      ])
    }

    // [23/45] 32B buffer copy
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      const pSrc = m.alloc(0x20) >>> 0
      for (let i = 0; i < 32; i++) m.setU8((pSrc + i) >>> 0, i + 1)
      expect(NET_SendPacketBuffer32B_6FCAAA10_113c(m, pSrc, pClient)).toBe(32)
      expect(m.u32((pQueue + 0x00) >>> 0)).toBe(32)
      expect(readQueuedBytes(m, pQueue, 4)).toEqual([1, 2, 3, 4])
    }

    // [24/45] 21B buffer copy
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      const pSrc = m.alloc(0x18) >>> 0
      for (let i = 0; i < 21; i++) m.setU8((pSrc + i) >>> 0, 0x10 + i)
      expect(NET_SendPacketBuffer21B_6FCAAA70_113c(m, pSrc, pClient)).toBe(21)
      expect(m.u32((pQueue + 0x00) >>> 0)).toBe(21)
      expect(m.u8((pQueue + 0x04 + 20) >>> 0)).toBe(0x24)
    }

    // [25/45] 0x61
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(NET_SendPacket61_ByteParam_6FCAAAC0_113c(m, 0x07, pClient)).toBe(2)
      expect(readQueuedBytes(m, pQueue, 2)).toEqual([0x61, 0x07])
    }
  })

  it('[26/45]..[32/45] queues packets 0x60, 7B, 15B, 15B transaction, 6B, 7B byte+dword, and 103B quest record', () => {
    const m = new SparseMemory113c()

    // [26/45] 0x60 portal info
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      const pPortal = m.alloc(0x100) >>> 0
      const pObjData = m.alloc(0x40) >>> 0
      m.setU32(pPortal, 2)
      m.setU32((pPortal + 0x0c) >>> 0, 0x11223344)
      m.setU32((pPortal + 0x14) >>> 0, pObjData)
      m.setU8((pObjData + 0x04) >>> 0, 0x25)
      m.setU8((pObjData + 0x05) >>> 0, 0x03)
      expect(NET_SendPacket60_PortalInfo_6FCAAAE0_113c(m, pPortal, pClient)).toBe(7)
      expect(readQueuedBytes(m, pQueue, 7)).toEqual([0x60, 0x03, 0x25, 0x44, 0x33, 0x22, 0x11])
    }

    // [27/45] 7B buffer copy
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      const pSrc = m.alloc(8) >>> 0
      for (let i = 0; i < 7; i++) m.setU8((pSrc + i) >>> 0, 0x30 + i)
      expect(NET_SendPacketBuffer7B_6FCAAB20_113c(m, pSrc, pClient)).toBe(7)
      expect(readQueuedBytes(m, pQueue, 7)).toEqual([0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36])
    }

    // [28/45] 15B buffer copy
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      const pSrc = m.alloc(16) >>> 0
      for (let i = 0; i < 15; i++) m.setU8((pSrc + i) >>> 0, 0x40 + i)
      expect(NET_SendPacketBuffer15B_6FCAABF0_113c(m, pSrc, pClient)).toBe(15)
      expect(m.u32((pQueue + 0x00) >>> 0)).toBe(15)
      expect(m.u8((pQueue + 0x04 + 14) >>> 0)).toBe(0x4e)
    }

    // [29/45] 15B transaction result
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(
        NET_SendPacket15B_TransactionResult_6FCAAC90_113c(
          m,
          0x2a,
          0x0c,
          0x55667788,
          pClient,
          0x11223344,
          0x01,
        ),
      ).toBe(15)
      expect(readQueuedBytes(m, pQueue, 15)).toEqual([
        0x2a, 0x01, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x44, 0x33, 0x22, 0x11, 0x88, 0x77, 0x66, 0x55,
      ])
    }

    // [30/45] 6B buffer copy
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      const pSrc = m.alloc(8) >>> 0
      for (let i = 0; i < 6; i++) m.setU8((pSrc + i) >>> 0, 0x50 + i)
      expect(NET_SendPacketBuffer6B_6FCAACD0_113c(m, pSrc, pClient)).toBe(6)
      expect(readQueuedBytes(m, pQueue, 6)).toEqual([0x50, 0x51, 0x52, 0x53, 0x54, 0x55])
    }

    // [31/45] 7B byte+dword
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(NET_SendPacket7B_ByteAndDword_6FCAAD10_113c(m, 0x2c, 0x03, 0x11223344, pClient)).toBe(
        7,
      )
      expect(readQueuedBytes(m, pQueue, 7)).toEqual([0x2c, 0x03, 0x44, 0x33, 0x22, 0x11, 0x00])
    }

    // [32/45] 103B quest record
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      const pQuestData = m.alloc(0x14) >>> 0
      const pQuestBuf = m.alloc(0x60) >>> 0
      m.setU32(pQuestData, pQuestBuf)
      m.setU8(pQuestBuf, 0xaa)
      m.setU8((pQuestBuf + 0x5f) >>> 0, 0xbb)
      expect(
        NET_SendPacket103B_QuestRecord_6FCAAD40_113c(
          m,
          0x28,
          0x01,
          0x11223344,
          pClient,
          pQuestData,
          0x09,
        ),
      ).toBe(0x67)
      expect(m.u32((pQueue + 0x00) >>> 0)).toBe(0x67)
      expect(readQueuedBytes(m, pQueue, 8)).toEqual([
        0x28, 0x01, 0x44, 0x33, 0x22, 0x11, 0x09, 0xaa,
      ])
      expect(m.u8((pQueue + 0x04 + 0x66) >>> 0)).toBe(0xbb)
    }
  })

  it('[33/45]..[39/45] queues packets 0x48, 0x47, 0x42, 0x79, 0x81, 0x7A, and 21B alt buffer', () => {
    const m = new SparseMemory113c()
    const pUnit = m.alloc(0x20) >>> 0
    m.setU32(pUnit, 4) // UNIT_ITEM
    m.setU32((pUnit + 0x0c) >>> 0, 0x11223344)

    // [33/45] 0x48 (null & non-null unit)
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c(m, 0, pClient, 1)).toBe(11)
      expect(readQueuedBytes(m, pQueue, 11)).toEqual([
        0x48, 0x06, 0x01, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
      ])

      const { pClient: pC2, pQueue: pQ2 } = createTestClientWithQueue(m)
      expect(NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c(m, pUnit, pC2, 2)).toBe(11)
      expect(readQueuedBytes(m, pQ2, 11)).toEqual([
        0x48, 0x04, 0x02, 0x44, 0x33, 0x22, 0x11, 0x00, 0x00, 0x00, 0x00,
      ])
    }

    // [34/45] 0x47 (null & non-null unit)
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(NET_SendPacket47_UnitRelator1_6FCAAEC0_113c(m, 0, pClient)).toBe(11)
      expect(readQueuedBytes(m, pQueue, 11)).toEqual([
        0x47, 0x06, 0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
      ])

      const { pClient: pC2, pQueue: pQ2 } = createTestClientWithQueue(m)
      expect(NET_SendPacket47_UnitRelator1_6FCAAEC0_113c(m, pUnit, pC2)).toBe(11)
      expect(readQueuedBytes(m, pQ2, 11)).toEqual([
        0x47, 0x04, 0x00, 0x44, 0x33, 0x22, 0x11, 0x00, 0x00, 0x00, 0x00,
      ])
    }

    // [35/45] 0x42 (null & non-null unit)
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(NET_SendPacket42_ClearCursor_6FCAAF10_113c(m, 0, pClient)).toBe(6)
      expect(readQueuedBytes(m, pQueue, 6)).toEqual([0x42, 0x06, 0xff, 0xff, 0xff, 0xff])

      const { pClient: pC2, pQueue: pQ2 } = createTestClientWithQueue(m)
      expect(NET_SendPacket42_ClearCursor_6FCAAF10_113c(m, pUnit, pC2)).toBe(6)
      expect(readQueuedBytes(m, pQ2, 6)).toEqual([0x42, 0x04, 0x44, 0x33, 0x22, 0x11])
    }

    // [36/45] 0x79
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(NET_SendPacket79_GoldInTrade_6FCAB1F0_113c(m, 0x000186a0, 1, pClient)).toBe(6)
      expect(readQueuedBytes(m, pQueue, 6)).toEqual([0x79, 0x01, 0xa0, 0x86, 0x01, 0x00])
    }

    // [37/45] 0x81
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(
        NET_SendPacket81_AssignMerc_6FCAB220_113c(
          m,
          0x22222222,
          pClient,
          0x05,
          0x11111111,
          0x1234,
          0x33333333,
          0x44444444,
        ),
      ).toBe(20)
      expect(readQueuedBytes(m, pQueue, 20)).toEqual([
        0x81, 0x05, 0x34, 0x12, 0x11, 0x11, 0x11, 0x11, 0x22, 0x22, 0x22, 0x22, 0x33, 0x33, 0x33,
        0x33, 0x44, 0x44, 0x44, 0x44,
      ])
    }

    // [38/45] 0x7A
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(
        NET_SendPacket7A_SummonChange_6FCAB290_113c(
          m,
          0x01,
          pClient,
          0x02,
          0x99887766,
          0x11223344,
          0x01ab,
        ),
      ).toBe(13)
      expect(readQueuedBytes(m, pQueue, 13)).toEqual([
        0x7a, 0x01, 0x02, 0xab, 0x01, 0x44, 0x33, 0x22, 0x11, 0x66, 0x77, 0x88, 0x99,
      ])
    }

    // [39/45] 21B alt buffer copy
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      const pSrc = m.alloc(0x18) >>> 0
      for (let i = 0; i < 21; i++) m.setU8((pSrc + i) >>> 0, 0x60 + i)
      expect(NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c(m, pSrc, pClient)).toBe(21)
      expect(m.u32((pQueue + 0x00) >>> 0)).toBe(21)
      expect(m.u8((pQueue + 0x04 + 20) >>> 0)).toBe(0x74)
    }
  })

  it('[40/45]..[45/45] queues packets 0x77, 40B buffer, 10B unit stat, 0xA5, 0x1A/0x1B/0x1C, and 0x07', () => {
    const m = new SparseMemory113c()

    // [40/45] 0x77
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0x0c, pClient)).toBe(2)
      expect(readQueuedBytes(m, pQueue, 2)).toEqual([0x77, 0x0c])
    }

    // [41/45] 40B buffer copy
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      const pSrc = m.alloc(0x28) >>> 0
      for (let i = 0; i < 40; i++) m.setU8((pSrc + i) >>> 0, i + 1)
      expect(NET_SendPacketBuffer40B_6FCAB3D0_113c(m, pSrc, pClient)).toBe(40)
      expect(m.u32((pQueue + 0x00) >>> 0)).toBe(40)
      expect(m.u8((pQueue + 0x04 + 39) >>> 0)).toBe(40)
    }

    // [42/45] 10B unit byte stat + assert on wStatId >= 0xFF
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(() =>
        NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c(m, 0xff, pClient, 0x20, 1, 2),
      ).toThrow(D2CommonAssertError)

      expect(
        NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c(
          m,
          0x0c,
          pClient,
          0x20,
          0x11223344,
          0x55667788,
        ),
      ).toBe(10)
      expect(readQueuedBytes(m, pQueue, 10)).toEqual([
        0x20, 0x44, 0x33, 0x22, 0x11, 0x0c, 0x88, 0x77, 0x66, 0x55,
      ])
    }

    // [43/45] 0xA5
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(
        NET_SendPacketA5_StateSkill_6FCABA10_113c(m, 0x01, 0x11223344, pClient, 0x009a),
      ).toBe(8)
      expect(readQueuedBytes(m, pQueue, 8)).toEqual([
        0xa5, 0x01, 0x44, 0x33, 0x22, 0x11, 0x9a, 0x00,
      ])
    }

    // [44/45] 0x1A / 0x1B / 0x1C stat update branches
    {
      const { pClient: pC1, pQueue: pQ1 } = createTestClientWithQueue(m)
      expect(NET_SendPacket1A1B1C_StatUpdate_6FCABDA0_113c(m, pC1, 150, 100)).toBe(2)
      expect(readQueuedBytes(m, pQ1, 2)).toEqual([0x1a, 50])

      const { pClient: pC2, pQueue: pQ2 } = createTestClientWithQueue(m)
      expect(NET_SendPacket1A1B1C_StatUpdate_6FCABDA0_113c(m, pC2, 0x1234, 0x0100)).toBe(3)
      expect(readQueuedBytes(m, pQ2, 3)).toEqual([0x1b, 0x34, 0x11])

      const { pClient: pC3, pQueue: pQ3 } = createTestClientWithQueue(m)
      expect(NET_SendPacket1A1B1C_StatUpdate_6FCABDA0_113c(m, pC3, 50, 100)).toBe(5)
      expect(readQueuedBytes(m, pQ3, 5)).toEqual([0x1c, 50, 0x00, 0x00, 0x00])
    }

    // [45/45] 0x07 room tile coords
    {
      const { pClient, pQueue } = createTestClientWithQueue(m)
      expect(
        NET_SendPacket07_RoomTileCoords_6FCABF50_113c(m, 0x1234, 0x5678, pClient, 0x02),
      ).toBe(6)
      expect(readQueuedBytes(m, pQueue, 6)).toEqual([0x07, 0x34, 0x12, 0x78, 0x56, 0x02])
    }
  })
})
