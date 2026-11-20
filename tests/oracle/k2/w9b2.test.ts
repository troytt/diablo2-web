import { describe, expect, it } from 'vitest'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  ACT2Q1_InitQuestData_6FCE7B40_113c,
  ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c,
  ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c,
  ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c,
  ACT2Q4_InitQuestData_6FCE9400_113c,
  ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c,
  ACT3Q3_InitQuestData_6FD07CE0_113c,
  ACT3Q6_InitQuestData_6FD0A080_113c,
  C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c,
  C2S_PacketUseQuestScrollItem_6FCED8D0_113c,
  ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c,
  ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c,
  ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c,
  PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c,
  SKILLS_EquipSummonedPetItems_6FD0E6F0_113c,
} from '../../../src/d2kern-113c/game/k2-w9b2-113c.js'

function initTestEnv(m: SparseMemory113c): number {
  const pDataTablesPtr = 0x100000
  const pDataTables = 0x100100
  const pSkillsTxt = 0x110000
  const pStatCostTxt = 0x150000
  const pBitMasks = 0x180000
  m.fill(0x100000, 0x90000, 0)
  m.fill(0x200000, 0x20000, 0)
  m.fill(0x3000, 0x2000, 0)
  m.fill(0x7fd70000, 0x20000, 0)
  m.fill(0x7ffdf000, 0x2000, 0)
  m.setU32(0x6fd1829c, pDataTablesPtr)
  m.setU32(0x6fd270b0, pDataTablesPtr)
  m.setU32(pDataTablesPtr, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(0x6fd31c20, 0)
  m.setU32(0x6fd182a4, pBitMasks)
  m.setU32(0x6fd27060, pBitMasks)
  for (let i = 0; i < 32; i++) {
    m.setU32(pBitMasks + i * 4, (1 << i) >>> 0)
  }
  m.setU32(pDataTables + 0xb90, pSkillsTxt)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 256)
  m.setU32(pDataTables + 0xc58, 512)
  m.setU32(pDataTables + 0xc4, 256)
  m.setU32(pDataTables + 0xbcc, pStatCostTxt)
  m.setU32(pDataTables + 0xbd4, 512)
  m.setU32(0x6fdefb94, 64)
  m.setU32(0x6fdefb98, 0x160000)
  m.setU32(0x6fdeff6c, 0x170000)
  m.fill(0x6fd1b200, 0x200, 0)
  return pDataTables
}

describe('K2 Wave 9 Batch 2 (15 D2Game VAs 0x6FCE6CA0..0x6FD110F0)', () => {
  it('ports [1..5/15] Act 2 quest callbacks, timers, and quest init tables', () => {
    const m = new SparseMemory113c()
    initTestEnv(m)

    const pGame = 0x200000
    const pPlayer = 0x201000
    const pPlayerData = 0x201200
    const pQuestRecord = 0x201400
    const pQuestRecordBuf = 0x201500
    const pQuestCtrl = 0x202000
    const pQuest9 = 0x202200
    const pQuest9State = 0x202400

    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 0x42)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestRecord)
    m.setU32(pQuestRecord, pQuestRecordBuf)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl, pQuest9)
    m.setU32(pQuest9, 0x09)
    m.setU32(pQuest9 + 0x18, pQuest9State)
    m.setU32(pQuest9State + 0x18, 5)
    m.setU32(pQuest9State + 0x1c, 2)
    m.setU32(pQuest9State + 0x24, 3)

    // [1/15] ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c
    ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c(m, pGame, pPlayer)
    expect(m.u8(pQuest9State + 0x2a)).toBe(1)
    expect(m.u32(pQuest9State + 0x2c)).toBe(0x42)
    expect(m.u32(pQuest9State + 0x18)).toBe(4)
    expect(m.u32(pQuest9State + 0x1c)).toBe(3)
    expect(m.u32(pQuest9State + 0x24)).toBe(2)

    // [2/15] ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c
    const pQuest3 = 0x203000
    const pQuest3State = 0x203200
    m.setU32(pQuest3 + 0x04, pGame)
    m.setU8(pQuest3 + 0x0c, 0)
    m.setU32(pQuest3 + 0x18, pQuest3State)
    m.setU8(pQuest3State + 0x01, 0)
    ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c(m, pQuest3)
    expect(m.u8(pQuest3State + 0x01)).toBe(1)

    // [3/15] ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c
    const pQuestArg = 0x203400
    const pGlobalFlags = 0x203600
    const pGlobalFlagsBuf = 0x203700
    m.setU32(pQuestCtrl + 0x08, 1)
    m.setU32(pQuestCtrl + 0x0c, pGlobalFlags)
    m.setU32(pGlobalFlags, pGlobalFlagsBuf)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU16(pQuestRecordBuf + 0x0b * 2, 1) // bit 0 set on quest 0x0b
    ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c(m, pQuest3, pQuestArg)
    expect((m.u16(pGlobalFlagsBuf + 0x0b * 2) & (1 << 0x0d)) !== 0).toBe(true)

    // [4/15] ACT2Q1_InitQuestData_6FCE7B40_113c
    const pQuest1 = 0x204000
    m.setU32(pQuest1 + 0x04, pGame)
    ACT2Q1_InitQuestData_6FCE7B40_113c(m, pQuest1, 0x204200)
    expect(m.u32(pQuest1 + 0xa0)).toBe(0x6fce4320)
    expect(m.u32(pQuest1 + 0xe0)).toBe(0x09)
    expect(m.u8(pQuest1 + 0x0d)).toBe(4)

    // [5/15] ACT2Q4_InitQuestData_6FCE9400_113c
    const pQuest4 = 0x204400
    m.setU32(pQuest4 + 0x04, pGame)
    ACT2Q4_InitQuestData_6FCE9400_113c(m, pQuest4, 0x204600)
    expect(m.u32(pQuest4 + 0xa0)).toBe(0x6fce4ea0)
    expect(m.u32(pQuest4 + 0xe0)).toBe(0x0c)
    expect(m.u8(pQuest4 + 0x0d)).toBe(5)
  })

  it('ports [6..10/15] C2S scroll/spawn packets, merc equip, ground pickup, and item replenish', () => {
    const m = new SparseMemory113c()
    initTestEnv(m)

    const pGame = 0x200000
    const pPlayer = 0x201000
    const pPlayerInv = 0x201200
    const pPlayerData = 0x201400
    const pPacket = 0x201800

    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x60, pPlayerInv)
    m.setU32(pPlayerInv, 0x01020304)

    // [6/15] C2S_PacketUseQuestScrollItem_6FCED8D0_113c
    expect(C2S_PacketUseQuestScrollItem_6FCED8D0_113c(m, pGame, pPlayer, pPacket, 4)).toBe(3)
    m.setU32(pPacket + 1, 99)
    expect(C2S_PacketUseQuestScrollItem_6FCED8D0_113c(m, pGame, pPlayer, pPacket, 5)).toBe(1)

    // [7/15] C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c
    expect(C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c(m, pGame, pPlayer, pPacket, 4)).toBe(3)

    // [8/15] ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c
    const pMerc = 0x202000
    const pCursorItem = 0x202200
    m.setU32(pGame + 0x70, 0)
    expect(ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c(m, pCursorItem, pMerc, pGame, pPlayer)).toBe(3)
    m.setU32(pGame + 0x70, 1)
    expect(ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c(m, pCursorItem, pMerc, pGame, pPlayer)).toBe(0)

    // [9/15] ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c
    const pOutErr = 0x202800
    expect(ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c(m, 0x55, pGame, pPlayer, pOutErr)).toBe(0)
    expect(m.u32(pOutErr)).toBe(1)

    // [10/15] ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c
    const pItem = 0x203000
    m.setU32(pItem, 4)
    ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c(m, pGame, pItem)
  })

  it('ports [11..15/15] Act 3 quest init/attach, summoned pet equip, and party leave notify', () => {
    const m = new SparseMemory113c()
    initTestEnv(m)

    const pGame = 0x200000
    const pQuest3 = 0x201000
    m.setU32(pQuest3 + 0x04, pGame)

    // [11/15] ACT3Q3_InitQuestData_6FD07CE0_113c
    ACT3Q3_InitQuestData_6FD07CE0_113c(m, pQuest3, 0x201200)
    expect(m.u32(pQuest3 + 0xa0)).toBe(0x6fd04c90)
    expect(m.u32(pQuest3 + 0xe0)).toBe(0x12)
    expect(m.u32(pQuest3 + 0x10)).toBe(0x0f)

    // [12/15] ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c
    const pQuest1 = 0x202000
    const pQuest1State = 0x202200
    const pBoss = 0x202400
    m.setU32(pQuest1 + 0x04, pGame)
    m.setU8(pQuest1 + 0x09, 1)
    m.setU32(pQuest1 + 0x18, pQuest1State)
    m.setU8(pQuest1State + 0x0c, 1)
    m.setU8(pQuest1State + 0x01, 1)
    m.setU32(pBoss + 0x0c, 0x77)
    expect(ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c(m, pQuest1, pBoss)).toBe(1)
    expect(m.u32(pQuest1 + 0xc0)).toBe(0x6fd08010)
    expect(m.u8(pQuest1State + 0x01)).toBe(0)
    expect(m.u8(pQuest1State + 0x02)).toBe(1)
    expect(m.u32(pQuest1State + 0x04)).toBe(0x77)

    // [13/15] ACT3Q6_InitQuestData_6FD0A080_113c
    const pQuest6 = 0x203000
    m.setU32(pQuest6 + 0x04, pGame)
    ACT3Q6_InitQuestData_6FD0A080_113c(m, pQuest6, 0x203200)
    expect(m.u32(pQuest6 + 0xa0)).toBe(0x6fd033a0)
    expect(m.u32(pQuest6 + 0xe0)).toBe(0x16)
    expect(m.u8(pQuest6 + 0x0d)).toBe(6)

    // [14/15] SKILLS_EquipSummonedPetItems_6FD0E6F0_113c
    const pPet = 0x204000
    m.setU32(pPet, 1)
    m.setU32(pPet + 0x04, 0)
    m.setU32(pPet + 0x80, pGame)
    SKILLS_EquipSummonedPetItems_6FD0E6F0_113c(m, pPet)

    // [15/15] PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c
    const pPlayer = 0x205000
    const pPlayerData = 0x205200
    m.setU32(pGame + 0x1d2c, 0x206000)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 1)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x80, pGame)
    PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c(m, pGame, pPlayer)
  })
})
