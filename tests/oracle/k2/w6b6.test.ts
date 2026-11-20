import { describe, expect, it } from 'vitest'
import {
  ACT3Q0_InitHratliIntroQuestTable_6FD06660_113c,
  ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c,
  ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c,
  ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c,
  ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c,
  ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c,
  ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c,
  ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c,
  ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c,
  ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c,
  ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c,
  ACT3Q3_OperateSewerLeverObject_6FD09F60_113c,
  ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c,
  ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c,
  ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c,
  ACT3Q5_OnOrmusActivatedSendTravincalAlert_6FD069E0_113c,
  ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c,
  ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c,
  ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c,
  ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c,
  C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c,
  C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c,
  C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c,
  HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0_113c,
  ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c,
  ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c,
  ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c,
  ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c,
  ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c,
  ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c,
  ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c,
  ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c,
  ITEMS_InsertScrollIntoTome_6FCF34B0_113c,
  ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c,
  ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c,
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c,
  ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c,
  MONSTER_SpawnPresetPackTable_6FD0F940_113c,
  PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c,
  PLAYERSAVE_WriteCorpseSection_6FD0C260_113c,
  PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c,
  PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c,
  PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c,
  PLAYER_LevelUp_6FD0B090_113c,
  QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c,
} from '../../../src/d2kern-113c/game/k2-w6b6-113c'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'

function createTestMemory(): SparseMemory113c {
  const m = new SparseMemory113c()
  m.fill(0x0, 0x2000, 0)
  m.fill(0x10000, 0x70000, 0)
  m.fill(0x6fd18000, 0x1000, 0)
  m.fill(0x6fde0000, 0x12000, 0)
  const pDataTables = 0x70000
  const pItemsTxt = 0x72000
  const pItemTypesTxt = 0x74000
  const pExpBin = 0x76000
  m.setU32(0x6fd1829c, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(0x6fdefb94, 8)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
  m.setU32(pDataTables + 0xbfc, 8)
  m.setU32(0x6fdf0b50, pExpBin)
  return m
}

describe('K2 Wave 6 Batch 6 (w6b6) — 45 D2Game.dll functions (0x6FCEEC70..0x6FD10390)', () => {
  it('[1/45..3/45] validates C2S belt packets 0x23, 0x25, and 0x63 sizes and ownership', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pPlayer = 0x20000
    const pPacket = 0x30000

    expect(C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c(m, pGame, pPlayer, pPacket, 5)).toBe(3)
    expect(C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c(m, pGame, pPlayer, pPacket, 5)).toBe(
      3,
    )
    expect(
      C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c(m, pGame, pPlayer, pPacket, 4),
    ).toBe(3)
  })

  it('[4/45..8/45] handles auto-equip body loc, hand skill fallback, unique pickup check, book qty, and scroll-to-tome', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pUnit = 0x20000
    const pItem = 0x30000
    const pOutLoc = 0x40000
    const pOutReject = 0x40010

    m.setU32(pItem, 4)
    expect(ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c(m, pItem, pUnit, pOutLoc, 1)).toBe(0)

    m.setU32(pUnit, 0)
    m.setU32(pUnit + 0x60, 0x50000)
    ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, pUnit)

    expect(ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c(m, pUnit, pGame, 0)).toBe(0)

    m.setU32(pUnit, 1)
    ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c(m, pItem, pUnit, 1)

    expect(ITEMS_InsertScrollIntoTome_6FCF34B0_113c(m, 99, pGame, pUnit, 100, pOutReject)).toBe(0)
    expect(m.u32(pOutReject)).toBe(1)
  })

  it('[9/45..16/45] handles stack merge, belt/grid consume, ground autostack, scroll recount, socket insert, and belt-to-cursor', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pUnit = 0x20000
    const pItem = 0x30000
    const pTarget = 0x31000
    const pInv = 0x50000
    const pOutReject = 0x40000

    m.setU32(pUnit, 1)
    m.setU32(pUnit + 0x60, pInv)
    m.setU32(pInv, 0x1020304)
    m.setU32(pItem, 4)
    m.setU32(pTarget, 4)

    ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c(m, pTarget, pGame, pUnit, 0)

    expect(() => ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c(m, pItem, pUnit, pGame)).toThrow()
    expect(() => ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(m, pItem, pUnit, pGame)).toThrow()

    expect(ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c(m, pGame, pUnit, 0)).toBe(0)
    expect(ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c(m, pGame, pUnit, 0)).toBe(0)

    ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, pUnit)

    expect(
      ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c(
        m,
        11,
        pGame,
        pUnit,
        22,
        pOutReject,
        1,
        1,
        1,
        1,
      ),
    ).toBe(0)
    expect(m.u32(pOutReject)).toBe(1)

    expect(ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c(m, pUnit, pGame, 33, pOutReject)).toBe(0)
    expect(m.u32(pOutReject)).toBe(1)
  })

  it('[17/45..22/45] handles hireling exp, Dark Wanderer flesh beasts, Durance 3 check, Gidbinn init, and Act 3 quest table inits', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pPlayer = 0x20000
    const pPlayerData = 0x21000
    const pPet = 0x22000
    const pQuestData = 0x30000
    const pQuestExt = 0x31000
    const pQuestArg = 0x32000

    HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0_113c(m, 0, pGame, pPlayer, pPet, 10)

    m.setU32(pQuestData + 0x18, pQuestExt)
    m.setU8(pQuestExt + 0x0c, 1)
    expect(ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c(m, pGame, pQuestData)).toBe(1)

    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    expect(ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c(m, pGame, pPlayer)).toBe(
      0,
    )

    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pPlayerData + 0x10, 0x33000)
    ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c(m, pQuestData, pQuestArg)

    const pHratliQuest = 0x34000
    m.setU32(pHratliQuest + 0x04, pGame)
    ACT3Q0_InitHratliIntroQuestTable_6FD06660_113c(m, pHratliQuest)
    expect(m.u32(pHratliQuest + 0xa0)).toBe(0x6fd054c0)
    expect(m.u32(pHratliQuest + 0xe0)).toBe(0x10)
    expect(m.u32(pHratliQuest + 0x18)).toBeGreaterThan(0)

    const pKurastQuest = 0x35000
    ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c(m, pKurastQuest)
    expect(m.u32(pKurastQuest + 0xa0)).toBe(0x6fd055f0)
    expect(m.u32(pKurastQuest + 0xe0)).toBe(0x2a)
  })

  it('[23/45..32/45] handles Act 3 Mephisto, Travincal, Golden Bird, Gidbinn, Khalims Will, and Lam Esens Tome callbacks', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pQuestData = 0x30000
    const pQuestExt = 0x31000
    const pQuestArg = 0x32000
    const pNpc = 0x33000

    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQuestExt)
    m.setU8(pQuestData + 0x0b, 1)
    expect(ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c(m, pGame, pQuestData)).toBe(1)
    expect(m.u8(pQuestData + 0x0b)).toBe(4)

    m.setU32(pQuestArg + 0x08, pNpc)
    m.setU16(pNpc + 0x04, 0xff)
    m.setU8(pQuestExt + 0x03, 1)
    ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0b)).toBe(2)

    m.setU8(pQuestExt + 0x04, 1)
    ACT3Q5_OnOrmusActivatedSendTravincalAlert_6FD069E0_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestExt + 0x04)).toBe(0)

    ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c(m, pQuestData, pQuestArg)

    m.setU32(pQuestExt + 0x10, 1)
    m.setU8(pQuestData + 0x09, 1)
    m.setU8(pQuestExt + 0x14, 1)
    m.setU8(pQuestData + 0x0c, 2)
    ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c(m, pQuestData)
    expect(m.u8(pQuestData + 0x0b)).toBe(6)

    m.setU16(pNpc + 0x04, 0xfe)
    m.setU8(pQuestExt + 0x08, 1)
    ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0b)).toBe(5)

    m.setU16(pNpc + 0x04, 0xfd)
    m.setU8(pQuestExt + 0x01, 1)
    ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0b)).toBe(2)

    m.setU16(pNpc + 0x04, 0xf5)
    m.setU8(pQuestExt + 0x01, 1)
    ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0b)).toBe(1)

    ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c(m, pQuestData, pQuestArg)

    m.setU32(pQuestExt + 0x08, 1)
    m.setU8(pQuestData + 0x09, 1)
    m.setU8(pQuestExt + 0x02, 1)
    m.setU8(pQuestData + 0x0c, 2)
    ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c(m, pQuestData)
    expect(m.u8(pQuestData + 0x0b)).toBe(8)
  })

  it('[33/45..38/45] handles Sewer Lever, Khalim chests, Compelling Orb projectile, and Uber Tristram boss kills', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pObj = 0x20000
    const pOpArgs = 0x30000
    const pBoss = 0x40000

    m.setU32(pOpArgs, pGame)
    m.setU32(pOpArgs + 0x04, pObj)
    m.setU32(pObj + 0x10, 1)
    expect(ACT3Q3_OperateSewerLeverObject_6FD09F60_113c(m, pOpArgs)).toBe(0)
    expect(ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c(m, pOpArgs)).toBe(0)
    expect(ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c(m, pOpArgs)).toBe(0)
    expect(ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c(m, pOpArgs)).toBe(0)

    const pCenterObj = 0x25000
    const pStaticPath = 0x26000
    m.setU32(pCenterObj, 2)
    m.setU32(pCenterObj + 0x2c, pStaticPath)
    m.setU32(pStaticPath + 0x0c, 100)
    m.setU32(pStaticPath + 0x10, 200)
    ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c(m, pCenterObj, pGame)

    m.setU32(pBoss + 0x04, 0x2c0)
    QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c(m, pGame, pBoss)
    expect(m.u32(pGame + 0x1df0)).toBe(1)
  })

  it('[39/45..45/45] handles stat spending, attribute reset, level up, corpse save, 335-byte save header, pack spawn, and relation free', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pPlayer = 0x20000
    const pPlayerData = 0x21000
    const pClient = 0x22000
    const ppIoBuf = 0x30000
    const pBuf = 0x31000

    expect(PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c(m, pPlayer, 0)).toBe(0)
    PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c(m, 0)
    PLAYER_LevelUp_6FD0B090_113c(m, pPlayer, pGame)

    m.setU32(ppIoBuf, pBuf)
    expect(
      PLAYERSAVE_WriteCorpseSection_6FD0C260_113c(m, pGame, pPlayer, ppIoBuf, pBuf + 0x200, 0, 0),
    ).toBe(2)

    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x9c, pClient)
    m.setU8(pClient + 0x0d, 0x48)
    m.setU8(pClient + 0x0e, 0x65)
    m.setU8(pClient + 0x0f, 0x72)
    m.setU8(pClient + 0x10, 0x6f)
    m.setU8(pClient + 0x11, 0)
    m.setU32(ppIoBuf, pBuf)
    expect(PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c(m, pPlayer, pGame, ppIoBuf, pBuf + 10)).toBe(
      1,
    )

    const pPackTable = 0x40000
    m.setU32(pPackTable, 0)
    expect(
      MONSTER_SpawnPresetPackTable_6FD0F940_113c(m, pPackTable, 0x50000, pGame, 10, 20, 1, 0, 1, 0),
    ).toBe(0)

    const pRelNode = 0x41000
    m.setU32(pPlayerData + 0x38, pRelNode)
    m.setU32(pRelNode + 0x10, 0)
    PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c(m, pPlayer, pGame)
    expect(m.u32(pPlayerData + 0x38)).toBe(0)
  })
})
