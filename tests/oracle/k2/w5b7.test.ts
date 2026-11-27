import { describe, expect, it } from 'vitest'
import {
  G_INVENTORY_TXT_TABLE_VA_113C,
  INVENTORY_AllocInventory113c,
  INVENTORY_SetCursorItem113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { STATLIST_AllocList113c, STATLIST_SetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import {
  SGPT_BELTS_TXT_COUNT_VA,
  SGPT_BELTS_TXT_PTR_VA,
  SGPT_BOOKS_TXT_COUNT_VA,
  SGPT_BOOKS_TXT_PTR_VA,
  SGPT_INVENTORY_TXT_MAX_VA,
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
  SGPT_QUALITYITEMS_TXT_COUNT_VA,
  SGPT_QUALITYITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import * as w5b7Exports from '../../../src/d2kern-113c/game/k2-w5b7-113c.ts'
import {
  ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c,
  ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c,
  ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c,
  ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c,
  ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c,
  ITEMS_CompactBeltColumnDown_6FCF2540_113c,
  ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c,
  ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c,
  ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c,
  ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c,
  ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c,
  ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c,
  ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c,
  ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c,
  ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c,
  ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c,
  ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c,
  ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c,
  ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c,
  ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c,
  ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c,
  ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c,
  ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c,
  ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c,
  ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c,
  PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c,
  PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c,
  QUESTS_ChainStatusFilterNotState5_6FD02F00_113c,
  QUESTS_ChainStatusFilterNotState7_6FD02A40_113c,
  QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c,
  QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c,
  QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c,
  SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c,
  SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c,
  SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c,
  SUNITDMG_OnStunOrFreezeEndNeutralCallback_6FCFBD90_113c,
  SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c,
  SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c,
  SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
  SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c,
  SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c,
  SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c,
  SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c,
  SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c,
} from '../../../src/d2kern-113c/game/k2-w5b7-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function allocZero(m: SparseMemory113c, size: number): number {
  const ptr = m.alloc(size) >>> 0
  for (let i = 0; i < size; i += 4) {
    m.setU32((ptr + i) >>> 0, 0)
  }
  return ptr
}

function allocClient(m: SparseMemory113c, pGame: number): number {
  const pClient = allocZero(m, 0x600)
  const pQueue = allocZero(m, 0x410)
  m.setU32((pClient + 0x04) >>> 0, 4)
  m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)
  return pClient
}

function setupTables(m: SparseMemory113c) {
  const pDataTables = allocZero(m, 0x1000)
  const pDataTablesPtr = allocZero(m, 4)
  m.setU32(0x6fd1829c, pDataTablesPtr)
  m.setU32(pDataTablesPtr, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  const pBitMasks = allocZero(m, 0x80)
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(0x6fd18be0, pBitMasks)
  m.setU32(0x6fdd90b0, pBitMasks)

  const pSkillsTxt = allocZero(m, 0x23c * 8)
  const pMonStatsTxt = allocZero(m, 0x1a8 * 4)
  const pItemStatCostTxt = allocZero(m, 0x144 * 240)
  const pItemTypesTxt = allocZero(m, 0xe4 * 80)
  const pItemTypesEquiv = allocZero(m, 4 * 4 * 80)
  const pItemsTxt = allocZero(m, 0x1a8 * 8)
  const pBooksTxt = allocZero(m, 0x20 * 4)
  const pUniqueTxt = allocZero(m, 0x14c * 4)
  const pInventoryTxt = allocZero(m, 0xf0 * 16)

  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 8)
  const pMonStats2Txt = allocZero(m, 0x134 * 4)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 4)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 4)
  m.setU32(pDataTables + 0xbcc, pItemStatCostTxt)
  m.setU32(pDataTables + 0xbd4, 240)
  m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
  m.setU32(pDataTables + 0xbfc, 80)
  m.setU32(pDataTables + 0xc00, 4)
  m.setU32(pDataTables + 0xc04, pItemTypesEquiv)
  m.setU32(pDataTables + 0xc24, pUniqueTxt)
  m.setU32(pDataTables + 0xc28, 4)
  m.setU32(pDataTables + 0xc6c, 6)
  m.setU32(pDataTables + 0xc70, 0x3f)
  m.setU32(pDataTables + 0xc4, 200)
  const pStatesTxt = allocZero(m, 0x40 * 200)
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xfc, allocZero(m, 0x40))
  m.setU32(pDataTables + 0x150, allocZero(m, 0x40))
  m.setU32(pDataTables + 0x154, allocZero(m, 0x40))

  const pObjectsTxt = allocZero(m, 0x1c0 * 8)
  const pBeltsTxt = allocZero(m, 0x108 * 8)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, 8)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_BOOKS_TXT_COUNT_VA, 4)
  m.setU32(SGPT_BOOKS_TXT_PTR_VA, pBooksTxt)
  m.setU32(SGPT_QUALITYITEMS_TXT_COUNT_VA, 4)
  m.setU32(SGPT_QUALITYITEMS_TXT_PTR_VA, pBooksTxt)
  m.setU32(SGPT_BELTS_TXT_COUNT_VA, 8)
  m.setU32(SGPT_BELTS_TXT_PTR_VA, pBeltsTxt)
  m.setU32(G_INVENTORY_TXT_TABLE_VA_113C, pBeltsTxt)
  m.setU32(SGPT_INVENTORY_TXT_MAX_VA, 16)
  m.setU32(0x6fdefa54, pInventoryTxt)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 8)
  m.setU8(0x6fdf1478, 0)
  for (let off = 0; off < 0x40; off += 4) {
    m.setU32((0x6fded370 + off) >>> 0, 0)
  }
  m.setU8(0x6fded378, 11)
  m.setU8(0x6fded379, 1)
  m.setU8(0x6fded390, 4)
  m.setU8(0x6fded391, 4)
  m.setU32(0x6fdf13a4, 16)
  m.setU32(0x6fdf13b0, allocZero(m, 0x34 * 16))
  m.setU32(0x6fdeefe4, 0)
  m.setU32(0x6fddc7b4, 1)
  const pAnimTable = allocZero(m, 0x600)
  const pEmptyBucket = allocZero(m, 8)
  for (let i = 0; i <= 256; i++) {
    m.setU32((pAnimTable + i * 4) >>> 0, pEmptyBucket)
  }
  m.setU32(0x6fdf0b4c, pAnimTable)

  for (let t = 0; t < 80; t++) {
    m.setU32((pItemTypesEquiv + t * 16 + ((t >>> 5) << 2)) >>> 0, (1 << (t & 31)) >>> 0)
  }

  return {
    pDataTables,
    pSkillsTxt,
    pMonStatsTxt,
    pItemStatCostTxt,
    pItemTypesTxt,
    pItemTypesEquiv,
    pItemsTxt,
    pBooksTxt,
    pUniqueTxt,
    pInventoryTxt,
  }
}

function allocGame(m: SparseMemory113c): number {
  const pGame = allocZero(m, 0x2000)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  m.setU32((pGame + 0x70) >>> 0, 1)
  EVENT_InitTimerQueue113c(m, pGame)
  return pGame
}

describe('K2 Wave 5 Batch 7 (w5b7: 45 D2Game.dll 1.13c VAs 0x6FCEFF30..0x6FD02F00)', () => {
  it('exports all 45 target functions', () => {
    const fnList = Object.values(w5b7Exports).filter((v) => typeof v === 'function')
    expect(fnList.length).toBe(45)
  })

  it('[1..5] C2S 0x59/0x14 packet handlers and book/scroll/dual-wield item checks', () => {
    const m = new SparseMemory113c()
    const { pMonStatsTxt, pItemsTxt, pBooksTxt } = setupTables(m)
    const pGame = allocGame(m)

    // [1/45] 0x6FCEFF30
    const pPkt59 = allocZero(m, 0x20)
    expect(PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c(m, pGame, 0, pPkt59, 5)).toBe(3)
    m.setU32((pPkt59 + 1) >>> 0, 6)
    expect(PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c(m, pGame, 0, pPkt59, 0x11)).toBe(2)

    const pPlayer = allocZero(m, 0x100)
    const pPlrPath = allocZero(m, 0x80)
    m.setU16((pPlrPath + 0x02) >>> 0, 100)
    m.setU16((pPlrPath + 0x06) >>> 0, 100)
    m.setU32((pPlayer + 0x2c) >>> 0, pPlrPath)

    const pNpc = allocZero(m, 0x100)
    m.setU32(pNpc, 1)
    m.setU32((pNpc + 0x04) >>> 0, 1)
    m.setU32((pNpc + 0x0c) >>> 0, 7)
    const pNpcPath = allocZero(m, 0x80)
    m.setU16((pNpcPath + 0x02) >>> 0, 105)
    m.setU16((pNpcPath + 0x06) >>> 0, 105)
    m.setU32((pNpc + 0x2c) >>> 0, pNpcPath)
    const pMonData = allocZero(m, 0x40)
    const pAiGen = allocZero(m, 0x40)
    m.setU32((pMonData + 0x28) >>> 0, pAiGen)
    m.setU32((pNpc + 0x14) >>> 0, pMonData)
    m.setU32((pGame + 0x1320 + ((7 & 0x7f) << 2)) >>> 0, pNpc)
    m.setU8((pMonStatsTxt + 0x1a8 + 0x0d) >>> 0, 0x03)

    m.setU32((pPkt59 + 1) >>> 0, 1)
    m.setU32((pPkt59 + 5) >>> 0, 7)
    m.setU32((pPkt59 + 9) >>> 0, 210)
    m.setU32((pPkt59 + 13) >>> 0, 220)
    expect(PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c(m, pGame, pPlayer, pPkt59, 0x11)).toBe(0)
    expect(m.u32((pAiGen + 0x14) >>> 0)).toBe(0x28)
    expect(m.u32((pAiGen + 0x18) >>> 0)).toBe(210)
    expect(m.u32((pAiGen + 0x1c) >>> 0)).toBe(220)

    // [2/45] 0x6FCF00A0
    const pPkt14 = allocZero(m, 0x40)
    expect(PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c(m, pGame, pPlayer, pPkt14, 2)).toBe(3)
    m.setU8((pPkt14 + 2) >>> 0, 1)
    m.setU8((pPkt14 + 3) >>> 0, 0x48)
    m.setU8((pPkt14 + 4) >>> 0, 0x69)
    m.setU8((pPkt14 + 5) >>> 0, 0)
    expect(PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c(m, pGame, pPlayer, pPkt14, 12)).toBe(0)
    expect(m.u32((pPlayer + 0xa4) >>> 0)).not.toBe(0)
    expect(m.u32((pPlayer + 0xc4) >>> 0) & 0x100).toBe(0x100)

    // [3/45] 0x6FCF17B0 & [4/45] 0x6FCF1B20
    const pBookItem = allocZero(m, 0x100)
    const pBookData = allocZero(m, 0x80)
    m.setU32(pBookItem, 4)
    m.setU32((pBookItem + 0x04) >>> 0, 1)
    m.setU32((pBookItem + 0x14) >>> 0, pBookData)
    m.setU16((pBookData + 0x3e) >>> 0, 1)
    m.setU16((pItemsTxt + 0x1a8 + 0x11e) >>> 0, 0x12)
    m.setU8((pItemsTxt + 0x1a8 + 0x129) >>> 0, 1)
    m.setU32((pItemsTxt + 0x1a8 + 0xe0) >>> 0, 20)
    m.setU32((pBooksTxt + 0x20 + 0x08) >>> 0, 217)
    m.setU32((pBooksTxt + 0x20 + 0x0c) >>> 0, 218)
    expect(ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(m, pBookItem)).toBe(218)

    const pScrollItem = allocZero(m, 0x100)
    const pScrollData = allocZero(m, 0x80)
    m.setU32(pScrollItem, 4)
    m.setU32((pScrollItem + 0x04) >>> 0, 2)
    m.setU32((pScrollItem + 0x14) >>> 0, pScrollData)
    m.setU16((pScrollData + 0x3e) >>> 0, 1)
    m.setU16((pItemsTxt + 0x1a8 * 2 + 0x11e) >>> 0, 0x16)
    expect(ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(m, pScrollItem)).toBe(217)

    const pOutRem = allocZero(m, 4)
    expect(ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c(m, pScrollItem, pPlayer, pOutRem)).toBe(0)

    // [5/45] 0x6FCF1C00
    const pLoc = allocZero(m, 4)
    const ppPri = allocZero(m, 4)
    const ppSec = allocZero(m, 4)
    m.setU32(pLoc, 4)
    expect(ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c(m, pLoc, pBookItem, ppPri, pPlayer, ppSec)).toBe(1)
  })

  it('[6..15] Hand flags, carry1/quest conflicts, ranged check, recharge, belt compact, cursor destroy', () => {
    const m = new SparseMemory113c()
    const { pItemsTxt, pSkillsTxt, pUniqueTxt } = setupTables(m)
    const pGame = allocGame(m)
    const pClient = allocClient(m, pGame)

    const pPlayer = allocZero(m, 0x100)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x04) >>> 0, 4) // Barbarian
    m.setU32((pPlayer + 0x0c) >>> 0, 11)
    m.setU32((pPlayer + 0x80) >>> 0, pGame)
    const pPlrData = allocZero(m, 0xc0)
    m.setU32((pPlrData + 0x9c) >>> 0, pClient)
    m.setU32((pPlayer + 0x14) >>> 0, pPlrData)
    const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer)
    m.setU32((pPlayer + 0x60) >>> 0, pInv)
    m.setU32((pPlayer + 0xa8) >>> 0, allocZero(m, 0x20))

    // [6/45] 0x6FCF1F60
    const pWep = allocZero(m, 0x100)
    const pWepData = allocZero(m, 0x80)
    m.setU32(pWep, 4)
    m.setU32((pWep + 0x04) >>> 0, 1)
    m.setU32((pWep + 0x0c) >>> 0, 50)
    m.setU32((pWep + 0x14) >>> 0, pWepData)
    m.setU16((pItemsTxt + 0x1a8 + 0x11e) >>> 0, 0x2d)
    const pHandFlags = allocZero(m, 0x28)
    ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c(m, pWep, pPlayer, pHandFlags)
    expect(m.u32((pHandFlags + 0x14) >>> 0)).toBe(1)
    expect(m.u32((pHandFlags + 0x1c) >>> 0)).toBe(1)

    // [7/45] 0x6FCF2070
    m.setU32((pWepData + 0x00) >>> 0, 7)
    m.setU32((pWepData + 0x18) >>> 0, 0)
    m.setU16(pUniqueTxt, 0)
    m.setU8((pUniqueTxt + 0x2c) >>> 0, 4)
    expect(
      ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c(m, 0, pItemsTxt + 0x1a8, pWep),
    ).toBe(0)

    // [8/45] 0x6FCF22C0
    const pSkill = allocZero(m, 0x40)
    m.setU32(pSkill, pSkillsTxt + 0x23c)
    m.setU16((pSkillsTxt + 0x23c) >>> 0, 1)
    m.setU16((pSkillsTxt + 0x23c + 0x18) >>> 0, 0x30)
    m.setU8((pSkillsTxt + 0x23c + 0x14) >>> 0, 2)
    expect(ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c(m, pSkill, pPlayer)).toBe(1)

    // [9/45] 0x6FCF2310 & [10/45] 0x6FCF2380
    ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c(m, pPlayer, pSkill, 1)
    expect(ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c(m, pGame, pPlayer, pWep)).toBe(0)

    // [11/45] 0x6FCF24B0 & [12/45] 0x6FCF2540
    ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c(m, pPlayer)
    ITEMS_CompactBeltColumnDown_6FCF2540_113c(m, 2, pPlayer)

    // [13/45] 0x6FCF2840
    const pStaticPath = allocZero(m, 0x20)
    m.setU32((pWep + 0x2c) >>> 0, pStaticPath)
    ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c(m, pWep, pPlayer, 0x15)
    expect(m.u16((pPlayer + 0x6e) >>> 0)).toBe(0x15)
    expect(m.u32((pWep + 0x10) >>> 0)).toBe(3)

    // [14/45] 0x6FCF2BE0
    ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c(m, pWep, pPlayer)

    // [15/45] 0x6FCF2C70
    INVENTORY_SetCursorItem113c(m, pInv, pWep)
    expect(ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, pPlayer, pWep, pGame)).toBe(1)
    expect(m.u32((pInv + 0x20) >>> 0)).toBe(0)
  })

  it('[16..25] Belt/grid item removal, scroll charges, belt place/swap, strip inv, break, gold pickup', () => {
    const m = new SparseMemory113c()
    const { pItemsTxt, pBooksTxt, pSkillsTxt } = setupTables(m)
    const pGame = allocGame(m)
    const pClient = allocClient(m, pGame)

    const pPlayer = allocZero(m, 0x100)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x0c) >>> 0, 21)
    m.setU32((pPlayer + 0x80) >>> 0, pGame)
    const pPlrData = allocZero(m, 0xc0)
    m.setU32((pPlrData + 0x9c) >>> 0, pClient)
    m.setU32((pPlayer + 0x14) >>> 0, pPlrData)
    const pPlrStats = STATLIST_AllocList113c(m, 0, 0x80000000, 0, 21)
    m.setU32((pPlayer + 0x5c) >>> 0, pPlrStats)
    STATLIST_SetUnitStat113c(m, pPlayer, 12, 10, 0) // level 10 -> 100,000 max gold
    const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer)
    m.setU32((pPlayer + 0x60) >>> 0, pInv)
    m.setU32((pPlayer + 0xa8) >>> 0, allocZero(m, 0x20))

    // Skill list on pPlayer with skill 1 (owner -1)
    const pSkillList = allocZero(m, 0x20)
    const pSkill = allocZero(m, 0x40)
    m.setU16((pSkillsTxt + 0x23c) >>> 0, 1)
    m.setU32(pSkill, pSkillsTxt + 0x23c)
    m.setU32((pSkill + 0x34) >>> 0, 0xffffffff)
    m.setU32((pSkill + 0x30) >>> 0, 3)
    m.setU32((pSkillList + 0x04) >>> 0, pSkill)
    m.setU32((pPlayer + 0xa8) >>> 0, pSkillList)

    // [18/45] 0x6FCF31D0
    const pScroll = allocZero(m, 0x100)
    const pScrollData = allocZero(m, 0x80)
    m.setU32(pScroll, 4)
    m.setU32((pScroll + 0x04) >>> 0, 2)
    m.setU32((pScroll + 0x14) >>> 0, pScrollData)
    m.setU16((pScrollData + 0x3e) >>> 0, 1)
    m.setU16((pItemsTxt + 0x1a8 * 2 + 0x11e) >>> 0, 0x16)
    m.setU32((pBooksTxt + 0x20 + 0x08) >>> 0, 1)
    ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, pScroll, pPlayer, 2)
    expect(m.u32((pSkill + 0x30) >>> 0)).toBe(5)

    // [19/45] 0x6FCF4E80 & [22/45] 0x6FCF5A00
    const pReject = allocZero(m, 4)
    expect(ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c(m, 999, pGame, pPlayer, 0, 1, pReject)).toBe(0)
    expect(m.u32(pReject)).toBe(1)
    expect(ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c(m, pPlayer, pGame, 998, 999, pReject)).toBe(0)

    // [21/45] 0x6FCF5740 & [24/45] 0x6FCF6BC0
    const pEqItem = allocZero(m, 0x100)
    const pEqData = allocZero(m, 0x80)
    const pEqStats = STATLIST_AllocList113c(m, 0, 0x80000000, 4, 77)
    m.setU32(pEqItem, 4)
    m.setU32((pEqItem + 0x04) >>> 0, 1)
    m.setU32((pEqItem + 0x0c) >>> 0, 77)
    m.setU32((pEqItem + 0x10) >>> 0, 1)
    m.setU32((pEqItem + 0x14) >>> 0, pEqData)
    m.setU32((pEqItem + 0x2c) >>> 0, allocZero(m, 0x20))
    m.setU32((pEqItem + 0x5c) >>> 0, pEqStats)
    STATLIST_SetUnitStat113c(m, pEqItem, 0x48, 5, 0)
    ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c(m, pEqItem, pPlayer, pGame)
    expect(m.u16((pPlayer + 0x6e) >>> 0)).toBe(9)
    ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c(m, pPlayer, pEqItem, pGame)
    expect(m.u16((pPlayer + 0x6e) >>> 0)).toBe(6)

    // [23/45] 0x6FCF6590 (grid full / zero-width returns 0 cleanly)
    expect(ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c(m, pEqItem, pPlayer, pGame, 0, 0, 0, 0)).toBe(0)

    // [16/45] 0x6FCF2CF0 & [17/45] 0x6FCF2D90 error assertions on unlinked item
    expect(() => ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c(m, pGame, pEqItem, pPlayer)).toThrow()
    expect(() => ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c(m, pPlayer, pEqItem, pGame, 0)).toThrow()

    // [20/45] 0x6FCF5590
    ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c(m, pPlayer, pGame)

    // [25/45] 0x6FCF6C80
    const pGold = allocZero(m, 0x100)
    m.setU32(pGold, 4)
    m.setU32((pGold + 0x0c) >>> 0, 88)
    m.setU32((pGold + 0x14) >>> 0, allocZero(m, 0x80))
    m.setU32((pGold + 0x2c) >>> 0, allocZero(m, 0x20))
    const pGoldStats = STATLIST_AllocList113c(m, 0, 0x80000000, 4, 88)
    m.setU32((pGold + 0x5c) >>> 0, pGoldStats)
    STATLIST_SetUnitStat113c(m, pGold, 0x0e, 250, 0)
    ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c(m, pPlayer, pGame, pGold)
    expect(m.u32((pPlayer + 0x5c) >>> 0)).not.toBe(0)
  })

  it('[26..35] Scroll charge decrement, SUnitDmg object/exp/state/splash/phys, SUnit find/portal/place', () => {
    const m = new SparseMemory113c()
    const { pSkillsTxt } = setupTables(m)
    const pGame = allocGame(m)
    const pClient = allocClient(m, pGame)

    const pPlayer = allocZero(m, 0x100)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x0c) >>> 0, 31)
    m.setU32((pPlayer + 0x10) >>> 0, 1)
    m.setU32((pPlayer + 0x80) >>> 0, pGame)
    const pPlrData = allocZero(m, 0xc0)
    m.setU32((pPlrData + 0x9c) >>> 0, pClient)
    m.setU32((pPlayer + 0x14) >>> 0, pPlrData)
    const pPlrPath = allocZero(m, 0x80)
    m.setU16((pPlrPath + 0x02) >>> 0, 50)
    m.setU16((pPlrPath + 0x06) >>> 0, 60)
    m.setU32((pPlayer + 0x2c) >>> 0, pPlrPath)
    const pPlrStats = STATLIST_AllocList113c(m, 0, 0x80000000, 0, 31)
    m.setU32((pPlayer + 0x5c) >>> 0, pPlrStats)
    STATLIST_SetUnitStat113c(m, pPlayer, 12, 15, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 21, 5, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 22, 10, 0)

    const pSkillList = allocZero(m, 0x20)
    const pSkill = allocZero(m, 0x40)
    m.setU16((pSkillsTxt + 0x23c * 2) >>> 0, 2)
    m.setU32(pSkill, pSkillsTxt + 0x23c * 2)
    m.setU32((pSkill + 0x34) >>> 0, 0xffffffff)
    m.setU32((pSkill + 0x30) >>> 0, 2)
    m.setU32((pSkillList + 0x04) >>> 0, pSkill)
    m.setU32((pPlayer + 0xa8) >>> 0, pSkillList)

    // [26/45] 0x6FCF8DE0
    ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c(m, pPlayer, 2)
    expect(m.u32((pSkill + 0x30) >>> 0)).toBe(1)

    // [27/45] 0x6FCFAB00
    SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c(m, pPlayer, 5)

    // [28/45] 0x6FCFAED0
    const pExpCtx = allocZero(m, 0x50)
    SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c(m, pGame, pPlayer, pExpCtx)
    expect(m.u32((pExpCtx + 0x44) >>> 0)).toBe(1)
    expect(m.u32((pExpCtx + 0x48) >>> 0)).toBe(15)

    // [29/45] 0x6FCFB4C0 & [30/45] 0x6FCFBD90
    const pMon = allocZero(m, 0x100)
    m.setU32(pMon, 1)
    m.setU32((pMon + 0x0c) >>> 0, 44)
    m.setU32((pMon + 0x10) >>> 0, 2)
    m.setU32((pMon + 0x80) >>> 0, pGame)
    m.setU32((pMon + 0x5c) >>> 0, STATLIST_AllocList113c(m, 0, 0x80000000, 1, 44))
    SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c(m, pMon, 11)
    SUNITDMG_OnStunOrFreezeEndNeutralCallback_6FCFBD90_113c(m, pMon, 11)
    expect(m.u32((pMon + 0x10) >>> 0)).toBe(1)

    // [31/45] 0x6FCFCE00
    const pDmg = allocZero(m, 0x70)
    SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c(m, pPlayer, 2, 1, pDmg)
    expect(m.u32((pDmg + 0x08) >>> 0)).toBeGreaterThan(0)

    // [32/45] 0x6FCFE380
    const pSplashMis = allocZero(m, 0x100)
    m.setU32(pSplashMis, 3)
    expect(
      SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c(
        m,
        pGame,
        pSplashMis,
        50,
        60,
        5,
        pDmg,
        0,
        0,
        0,
        0,
      ),
    ).toBe(0)

    // [33/45] 0x6FCFFCC0
    m.setU32((pGame + 0x1120 + ((31 & 0x7f) << 2)) >>> 0, pPlayer)
    const found = SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGame,
      (_mem, _g, u) => (m.u32((u + 0x0c) >>> 0) === 31 ? 1 : 0),
      0,
      0,
    )
    expect(found).toBe(pPlayer)

    // [34/45] 0x6FCFFDC0
    const pPortalA = allocZero(m, 0x100)
    const pPortalB = allocZero(m, 0x100)
    const pPathA = allocZero(m, 0x30)
    const pPathB = allocZero(m, 0x30)
    const pDataA = allocZero(m, 0x40)
    const pDataB = allocZero(m, 0x40)
    m.setU32(pPortalA, 2)
    m.setU32(pPortalB, 2)
    m.setU32((pPortalA + 0x14) >>> 0, pDataA)
    m.setU32((pPortalB + 0x14) >>> 0, pDataB)
    m.setU32((pPortalA + 0x2c) >>> 0, pPathA)
    m.setU32((pPortalB + 0x2c) >>> 0, pPathB)
    m.setU32((pPathA + 0x0c) >>> 0, 111)
    m.setU32((pPathA + 0x10) >>> 0, 222)
    m.setU32((pPathB + 0x0c) >>> 0, 333)
    m.setU32((pPathB + 0x10) >>> 0, 444)
    SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c(m, pPortalA, pPortalB)
    expect(m.u32((pDataA + 0x20) >>> 0)).toBe(333)
    expect(m.u32((pDataB + 0x20) >>> 0)).toBe(111)

    // [35/45] 0x6FD00D00 (missile unit type 3 placement)
    const pMissile = allocZero(m, 0x100)
    m.setU32(pMissile, 3)
    const pRoomEx = allocZero(m, 0x80)
    const pLevel = allocZero(m, 0x200)
    m.setU32((pLevel + 0x1d0) >>> 0, 1)
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
    const pRoom = allocZero(m, 0x80)
    m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
    SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c(m, 60, pRoom, pMissile, pGame, 50)
    expect(m.u32((pMissile + 0x2c) >>> 0)).not.toBe(0)
  })

  it('[36..45] Portal dest owner, anim event schedulers, Anya spawn probe, quest status chains', () => {
    const m = new SparseMemory113c()
    setupTables(m)
    const pGame = allocGame(m)

    const pOwner = allocZero(m, 0x100)
    m.setU32(pOwner, 0)
    m.setU32((pOwner + 0x0c) >>> 0, 19)
    m.setU32((pGame + 0x1120 + ((19 & 0x7f) << 2)) >>> 0, pOwner)

    // [36/45] 0x6FD01570
    const pAct0 = allocZero(m, 0x80)
    const pPortalDestRoom = allocZero(m, 0x80)
    m.setU32((pPortalDestRoom + 0x54) >>> 0, 100)
    m.setU32((pPortalDestRoom + 0x58) >>> 0, 100)
    m.setU32((pAct0 + 0x10) >>> 0, pPortalDestRoom)
    m.setU32((pGame + 0xbc) >>> 0, pAct0)
    const pPortal = allocZero(m, 0x100)
    const pObjData = allocZero(m, 0x40)
    m.setU8((pObjData + 0x04) >>> 0, 1)
    m.setU32((pPortal + 0x14) >>> 0, pObjData)
    m.setU32((pPortal + 0x94) >>> 0, 0)
    m.setU32((pPortal + 0x98) >>> 0, 19)
    expect(SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c(m, pGame, pPortal)).toBe(pOwner)

    // [37/45] 0x6FD02310, [38/45] 0x6FD02480, [39/45] 0x6FD02600
    const pUnit = allocZero(m, 0x100)
    const pAnimData = allocZero(m, 0x40)
    m.setU8((pAnimData + 0x11) >>> 0, 1)
    m.setU32((pUnit + 0x50) >>> 0, pAnimData)
    m.setU32((pUnit + 0x48) >>> 0, 4 << 8)
    m.setU16((pUnit + 0x4c) >>> 0, 0x100)
    SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c(m, pUnit, pGame, 0)
    expect(m.u32((pUnit + 0xdc) >>> 0)).not.toBe(0)
    SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c(m, pUnit, pGame, 1)
    expect(m.u32((pUnit + 0xdc) >>> 0)).not.toBe(0)
    SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c(m, pUnit, pGame, 50)
    expect(m.u32((pUnit + 0xdc) >>> 0)).not.toBe(0)

    // [40/45] 0x6FD02780
    const pQuestCtrl = allocZero(m, 0x20)
    const pQuest28 = allocZero(m, 0x100)
    const pFilter28 = allocZero(m, 0x20)
    m.setU32(pQuest28, 0x1c)
    m.setU8(pFilter28, 1)
    m.setU8((pFilter28 + 2) >>> 0, 1)
    m.setU32((pFilter28 + 4) >>> 0, 5100)
    m.setU32((pFilter28 + 8) >>> 0, 5200)
    m.setU32((pQuest28 + 0x18) >>> 0, pFilter28)
    m.setU32(pQuestCtrl, pQuest28)
    m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)
    const pOutCoords = allocZero(m, 8)
    expect(ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c(m, pGame, pOwner, pOutCoords)).toBe(1)
    expect(m.u32(pOutCoords)).toBe(5100)
    expect(m.u32((pOutCoords + 4) >>> 0)).toBe(5200)

    // [41/45]..[45/45] Quest status filter chain
    const pQuestA = allocZero(m, 0x100)
    const pQuestB = allocZero(m, 0x100)
    m.setU32(pQuestA, 10)
    m.setU32((pQuestA + 0x04) >>> 0, pGame)
    m.setU8((pQuestA + 0x09) >>> 0, 1)
    m.setU8((pQuestA + 0x0c) >>> 0, 2)
    m.setU32((pQuestA + 0xf0) >>> 0, 0x6fd02a40)
    m.setU32((pQuest28 + 0xf4) >>> 0, pQuestA)

    m.setU32(pQuestB, 11)
    m.setU32((pQuestB + 0x04) >>> 0, pGame)
    m.setU8((pQuestB + 0x09) >>> 0, 0)
    m.setU8((pQuestB + 0x0c) >>> 0, 5)
    m.setU32((pQuestB + 0x10) >>> 0, 10)
    m.setU32((pQuestB + 0xf0) >>> 0, 0x6fd02f00)
    m.setU32((pQuestA + 0xf4) >>> 0, pQuestB)

    expect(QUESTS_ChainStatusFilterNotState7_6FD02A40_113c(m, pQuestA)).toBe(1)
    expect(QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c(m, pQuestB)).toBe(1)
    expect(QUESTS_ChainStatusFilterNotState5_6FD02F00_113c(m, pQuestB)).toBe(1)

    const pQuestC = allocZero(m, 0x100)
    m.setU8((pQuestC + 0x09) >>> 0, 1)
    m.setU8((pQuestC + 0x0c) >>> 0, 0)
    expect(QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c(m, pQuestC)).toBe(1)
    expect(m.u8((pQuestC + 0x0c) >>> 0)).toBe(1)
    m.setU8((pQuestC + 0x0c) >>> 0, 0)
    expect(QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c(m, pQuestC)).toBe(1)
    expect(m.u8((pQuestC + 0x0c) >>> 0)).toBe(1)
  })
})
