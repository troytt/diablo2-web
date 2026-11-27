import { describe, expect, it } from 'vitest'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c,
  ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c,
  ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c,
  ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c,
  ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c,
  ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c,
  ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c,
  ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c,
  ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c,
  ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c,
  ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c,
  ACT2Q5_InitQuestData_6FCE7080_113c,
  ACT3Q7_Callback00_NpcActivate_6FD07080_113c,
  C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c,
  C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c,
  C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c,
  C2S_Packet20_UseInventoryItem_6FCEF730_113c,
  C2S_Packet21_MergeStackableItems_6FCEE4B0_113c,
  C2S_Packet26_UseBeltItem_6FCEF5B0_113c,
  C2S_Packet27_IdentifyItem_6FCEF6B0_113c,
  C2S_Packet60_SwapWeapons_6FCEF510_113c,
  ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c,
  ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c,
  ITEMS_EquipMercBodyLocFromPlayerCursor_6FCEFBC0_113c,
  ITEMS_ProcessReplenishStatTick_6FCFA350_113c,
  ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c,
  ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c,
  NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c,
  NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c,
  NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c,
} from '../../../src/d2kern-113c/game/k2-w8b3-113c.js'

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
  return pDataTables
}

describe('K2 Wave 8 Batch 3 (30 D2Game VAs 0x6FCDD880..0x6FD07080)', () => {
  it('ports [1..5/30] NPC item return/place/repair and Act 2 Q4/Q5 quest activation', () => {
    const m = new SparseMemory113c()
    initTestEnv(m)

    const pGame = 0x200000
    const pPlayer = 0x202000
    const pPlayerInv = 0x202200
    const pNpc = 0x203000
    const pItem = 0x204000
    const pQuestCtrl = 0x205000
    const pQuestData = 0x205200
    const pQuestState = 0x205400

    m.setU32(pPlayer + 0x60, pPlayerInv)
    m.setU32(pPlayerInv, 0x01020304)

    // [1/30] NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c
    m.setU32(pItem, 4)
    m.setU32(pItem + 0x0c, 10)
    m.setU32(pItem + 0x14, 0x204200)
    expect(
      NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c(
        m,
        pItem,
        pGame,
        pPlayer,
        1,
      ),
    ).toBe(1)

    // [2/30] NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c (pNpc === 0 early return)
    expect(
      NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c(
        m,
        0,
        pItem,
        pGame,
        pPlayer,
      ),
    ).toBe(0)

    // [3/30] NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c (non-repairable item early return)
    m.setU32(pItem, 4)
    m.setU32(pItem + 0x14, 0x204200)
    NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c(m, pPlayer, pItem, pGame)

    // [4/30] ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl, pQuestData)
    m.setU32(pQuestCtrl + 0x08, 1)
    m.setU32(pQuestData, 0x0c)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU8(pQuestData + 0x09, 1)
    m.setU8(pQuestData + 0x0c, 0)
    m.setU32(pQuestData + 0x18, pQuestState)
    m.setU8(pQuestState, 0)
    ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c(m, pGame)
    expect(m.u8(pQuestData + 0x0b)).toBe(2)

    // [5/30] ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c
    const pQuestDataQ4 = 0x205600
    const pQuestStateQ4 = 0x205800
    m.setU32(pQuestData + 0xf4, pQuestDataQ4)
    m.setU32(pQuestDataQ4, 0x0b)
    m.setU32(pQuestDataQ4 + 0x04, pGame)
    m.setU8(pQuestDataQ4 + 0x09, 1)
    m.setU8(pQuestDataQ4 + 0x0c, 0)
    m.setU32(pQuestDataQ4 + 0x18, pQuestStateQ4)
    ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c(m, pGame)
    expect(m.u8(pQuestDataQ4 + 0x0b)).toBe(1)
    void pNpc
  })

  it('ports [6..10/30] Act 2 Q1/Q3/Q5 timers, NPC deactivate callbacks, and quest init', () => {
    const m = new SparseMemory113c()
    initTestEnv(m)

    const pGame = 0x200000
    const pQuestData = 0x205200
    const pQuestState = 0x205400
    const pQuestArg = 0x205600

    // [6/30] ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQuestState)
    expect(
      ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c(
        m,
        pGame,
        pQuestData,
      ),
    ).toBe(1)

    // [7/30] ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c (pNpc === 0 early return)
    m.setU32(pQuestArg + 0x08, 0)
    ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c(m, pQuestData, pQuestArg)

    // [8/30] ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c (no Quest 9 data early return)
    ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c(m, pGame, 0)

    // [9/30] ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c
    const pPlayer = 0x202000
    const pPlayerData = 0x202400
    const pQuestRecord = 0x202800
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestRecord)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x08, 0)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU16(pQuestArg + 0x18, 0)
    ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c(m, pQuestData, pQuestArg)

    // [10/30] ACT2Q5_InitQuestData_6FCE7080_113c
    const pQ5Data = 0x206000
    m.setU32(pQ5Data + 0x04, pGame)
    ACT2Q5_InitQuestData_6FCE7080_113c(m, pQ5Data)
    expect(m.u32(pQ5Data + 0xa0)).toBe(0x6fce3080)
    expect(m.u32(pQ5Data + 0xcc)).toBe(0x6fce67c0)
    expect(m.u32(pQ5Data + 0xec)).toBe(0x6fce1e10)
    expect(m.u32(pQ5Data + 0x18)).not.toBe(0)
  })

  it('ports [11..15/30] Act 2 Q3 Tainted Sun altar and Act 2 Q4 Horazon Journal', () => {
    const m = new SparseMemory113c()
    initTestEnv(m)

    const pGame = 0x200000
    const pQuestCtrl = 0x205000
    const pQuest11Node = 0x205100
    const pQuest11Data = 0x205200
    const pQuest11State = 0x205400
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl + 0x08, 1)
    m.setU32(pQuestCtrl + 0x0c, pQuest11Node)
    m.setU32(pQuest11Node, pQuest11Data)
    m.setU32(pQuest11Data, 0x0b)
    m.setU32(pQuest11Data + 0x04, pGame)
    m.setU8(pQuest11Data + 0x0a, 0)
    m.setU32(pQuest11Data + 0x18, pQuest11State)

    // [11/30] ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c
    ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c(m, pQuest11Data, 0)

    // [12/30] ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c
    const pObjUnit = 0x206000
    m.setU32(pObjUnit, 2)
    m.setU8(pQuest11State + 0x1d, 1)
    ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c(m, pQuest11Data, pQuest11Node)

    // [13/30] ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c (mode !== 0 returns 0)
    m.setU32(pObjUnit + 0x10, 2)
    const pOpParam = 0x206200
    m.setU32(pOpParam, pGame)
    m.setU32(pOpParam + 0x04, pObjUnit)
    m.setU32(pOpParam + 0x08, 0)
    expect(ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c(m, pOpParam)).toBe(0)

    // [14/30] ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c
    const pQuestArg = 0x206400
    const pPlayer = 0x202000
    const pPlayerData = 0x202400
    const pQuestRecord = 0x202800
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestRecord)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x08, 0)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU16(pQuestArg + 0x18, 0x100)
    ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c(m, pQuest11Data, pQuestArg)

    // [15/30] ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c (no Quest 12 data returns 0)
    expect(ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c(m, pOpParam)).toBe(0)
  })
  it('ports [16..20/30] C2S packets 0x21, 0x1A, 0x60, 0x26 and merc bodyLoc unequip', () => {
    const m = new SparseMemory113c()
    initTestEnv(m)

    const pGame = 0x200000
    const pPlayer = 0x202000
    const pMerc = 0x203000
    const pPacket = 0x204000

    // [16/30] C2S_Packet21_MergeStackableItems_6FCEE4B0_113c (invalid packet size returns 3)
    expect(
      C2S_Packet21_MergeStackableItems_6FCEE4B0_113c(
        m,
        pGame,
        pPlayer,
        pPacket,
        4,
      ),
    ).toBe(3)

    // [17/30] ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c (expansion flag 0 returns 3)
    m.setU32(pGame + 0x70, 0)
    expect(
      ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c(
        m,
        1,
        pMerc,
        pGame,
        pPlayer,
      ),
    ).toBe(3)

    // [18/30] C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c (invalid packet size returns 3)
    expect(
      C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c(
        m,
        pGame,
        pPlayer,
        pPacket,
        4,
      ),
    ).toBe(3)

    // [19/30] C2S_Packet60_SwapWeapons_6FCEF510_113c (invalid packet size returns 3)
    expect(
      C2S_Packet60_SwapWeapons_6FCEF510_113c(m, pGame, pPlayer, pPacket, 5),
    ).toBe(3)

    // [20/30] C2S_Packet26_UseBeltItem_6FCEF5B0_113c (invalid packet size returns 3)
    expect(
      C2S_Packet26_UseBeltItem_6FCEF5B0_113c(m, pGame, pPlayer, pPacket, 5),
    ).toBe(3)
  })

  it('ports [21..25/30] C2S packets 0x27, 0x20, 0x1B, 0x19 and merc bodyLoc equip', () => {
    const m = new SparseMemory113c()
    initTestEnv(m)

    const pGame = 0x200000
    const pPlayer = 0x202000
    const pMerc = 0x203000
    const pItem = 0x204000
    const pPacket = 0x205000

    // [21/30] C2S_Packet27_IdentifyItem_6FCEF6B0_113c (invalid packet size returns 3)
    expect(
      C2S_Packet27_IdentifyItem_6FCEF6B0_113c(m, pGame, pPlayer, pPacket, 4),
    ).toBe(3)

    // [22/30] C2S_Packet20_UseInventoryItem_6FCEF730_113c (invalid packet size returns 3)
    expect(
      C2S_Packet20_UseInventoryItem_6FCEF730_113c(
        m,
        pGame,
        pPlayer,
        pPacket,
        4,
      ),
    ).toBe(3)

    // [23/30] ITEMS_EquipMercBodyLocFromPlayerCursor_6FCEFBC0_113c (expansion flag 0 returns 3)
    m.setU32(pGame + 0x70, 0)
    expect(
      ITEMS_EquipMercBodyLocFromPlayerCursor_6FCEFBC0_113c(
        m,
        pGame,
        pPlayer,
        pMerc,
        pItem,
      ),
    ).toBe(3)

    // [24/30] C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c (invalid packet size returns 3)
    expect(
      C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c(
        m,
        pGame,
        pPlayer,
        pPacket,
        4,
      ),
    ).toBe(3)

    // [25/30] C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c (invalid packet size returns 3)
    expect(
      C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c(
        m,
        pGame,
        pPlayer,
        pPacket,
        4,
      ),
    ).toBe(3)
  })

  it('ports [26..30/30] auto-stack, socket clone, corpse transfer, replenish tick, and Act 3 Q7 Ormus activate', () => {
    const m = new SparseMemory113c()
    initTestEnv(m)

    const pGame = 0x200000
    const pPlayer = 0x202000
    const pItem = 0x204000

    // [26/30] ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c (non-scroll/tome/stackable returns 0)
    m.setU32(pItem, 4)
    expect(
      ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c(
        m,
        pGame,
        pPlayer,
        pItem,
      ),
    ).toBe(0)

    // [27/30] ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c (subType === 0 returns 1)
    expect(
      ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c(
        m,
        pItem,
        pGame,
        pPlayer,
        pItem,
        0,
      ),
    ).toBe(1)

    // [28/30] ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c (null corpse returns 0)
    expect(
      ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c(m, 0, pGame, pPlayer),
    ).toBe(0)

    // [29/30] ITEMS_ProcessReplenishStatTick_6FCFA350_113c (replenish stat 0 returns 0)
    expect(
      ITEMS_ProcessReplenishStatTick_6FCFA350_113c(
        m,
        0xfc,
        0x48,
        pGame,
        pItem,
        20,
      ),
    ).toBe(0)

    // [30/30] ACT3Q7_Callback00_NpcActivate_6FD07080_113c (non-matching scroll index returns cleanly)
    const pQuestData = 0x206000
    const pQuestArg = 0x206200
    const pPlayerData = 0x206400
    const pQuestRecord = 0x206600
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU8(pGame + 0x6d, 0)
    m.setU32(pPlayerData + 0x10, pQuestRecord)
    m.setU32(pQuestRecord, 0x206700)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU16(pQuestArg + 0x14, 0)
    m.setU16(pQuestArg + 0x18, 0x100)
    ACT3Q7_Callback00_NpcActivate_6FD07080_113c(m, pQuestData, pQuestArg)
  })
})
