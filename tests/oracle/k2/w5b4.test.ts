import { describe, expect, it } from 'vitest'
import { INVENTORY_SIGNATURE_113C } from '../../../src/d2kern-113c/common/inventory.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import * as w5b4Exports from '../../../src/d2kern-113c/game/k2-w5b4-113c.ts'
import {
  ACT2Q1_ActiveFilter_6FCE2520_113c,
  ACT2Q1_SeqFilter_6FCE24A0_113c,
  ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c,
  ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c,
  ACT2Q2_StatusFilter_6FCE3BD0_113c,
  ACT2Q3_ActiveFilter_6FCE2250_113c,
  ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c,
  ACT2Q3_SeqFilter_6FCE21E0_113c,
  ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c,
  ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c,
  ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c,
  ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c,
  ACT2Q4_ActiveFilter_6FCE2080_113c,
  ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c,
  ACT2Q4_ChainSeqFilter_6FCE1FF0_113c,
  ACT2Q4_IsPalaceCellarAllowed_6FCE3260_113c,
  ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c,
  ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c,
  ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
  ACT2Q5_ActiveFilter_6FCE1E10_113c,
  ACT2Q5_Callback00_NpcActivate_6FCE3080_113c,
  ACT2Q5_InitArcanePortalObject_6FCE2850_113c,
  ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c,
  ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c,
  ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c,
  ACT2Q6_ActiveFilter_6FCE1C20_113c,
  ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c,
  ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c,
  ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c,
  ACT2Q6_StatusFilter_6FCE1D30_113c,
  ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c,
  ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c,
  ACT2Q8_ActiveFilter_6FCE25F0_113c,
  ACT2Q8_Callback00_NpcActivate_6FCE2680_113c,
  D2GAME_ACT2Q3_SEQ_MSG_TABLE_VA_113C,
  D2GAME_ACT2Q5_SEQ_MSG_TABLE_VA_113C,
  D2GAME_ACT2Q6_SEQ_MSG_TABLE_VA_113C,
  D2GAME_TAL_RASHA_TOMB_OBJECTS_VA_113C,
  NPC_ClearPlayerInteractState_6FCDCB90_113c,
  NPC_DeductPlayerGoldAndStash_6FCDCC60_113c,
  NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c,
  NPC_HealAndCureUnit_6FCDCBE0_113c,
  NPC_InitHirelingVendorRoster_6FCDCED0_113c,
  NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c,
  NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c,
  NPC_RefreshInventoryItemStatLists_6FCDCA20_113c,
  NPC_RollStoreItemUpgrade_6FCDD040_113c,
  NPC_TransferInventoryItemsToOwner_6FCDCD90_113c,
  QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b4-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  D2HirelingTxt_SIZE,
  D2ItemsTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2SkillsTxt_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  G_HIRELING_COUNT_VA_113C,
  G_HIRELING_TXT_VA_113C,
  HIRELING_TXT_SELLER_OFF_113C,
} from '../../../src/d2kern-113c/tables/monster-tbls-113c.ts'

interface Harness {
  m: SparseMemory113c
  pDataTables: number
  pGame: number
  pAct2: number
  pQuestControl: number
  pNpcControl: number
  pNpcSlots: number
  pItemsTxt: number
}

function createHarness(nDifficulty = 0): Harness {
  const m = new SparseMemory113c()
  m.fill(0x6fd10000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x20000, 0)
  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)

  const pBitMasks = m.alloc(128)
  for (let i = 0; i < 32; i++) m.setU32(pBitMasks + i * 4, (1 << i) >>> 0)
  m.setU32(0x6fdd90b0, pBitMasks)

  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE)
  for (let lvl = 40; lvl <= 74; lvl++) {
    m.setU8(pLevelsTxt + lvl * D2LevelsTxt_SIZE + 0x02, 1) // nAct = 1 (Act 2)
  }
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, levelsCount)
  // DRLG_GetActNoFromLevelId reads town boundaries at sgptDataTables + 0xC60 (5 dwords: [1, 40, 75, 103, 109, 137])
  const actBounds = [1, 40, 75, 103, 109, 137]
  for (let i = 0; i < actBounds.length; i++) {
    m.setU32(pDataTables + 0xc60 + i * 4, actBounds[i]!)
  }

  const itemsCount = 16
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(pDataTables + 0xc28, itemsCount)
  m.setU32(pDataTables + 0xc2c, pItemsTxt)

  const pSkillsTxt = m.alloc(16 * D2SkillsTxt_SIZE)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 16)
  m.setU32(pDataTables + 0xc4, 256)
  const pIsc = m.alloc(360 * 0x144)
  m.setU32(pDataTables + 0xbcc, pIsc)
  m.setU32(pDataTables + 0xbd4, 360)
  const pExpTxt = m.alloc(0x200)
  m.setU32(pExpTxt, 99)
  m.setU32(0x6fdf0b50, pExpTxt)

  const pGame = m.alloc(0x1df4)
  m.setU8(pGame + 0x6d, nDifficulty)
  m.setU32(pGame + 0x70, 1) // bExpansion = 1
  const pQuestControl = m.alloc(0x40)
  m.setU32(pQuestControl + 0x08, 1)
  m.setU32(pQuestControl + 0x0c, QUESTRECORD_AllocRecord113c(m, 0))
  m.setU32(pGame + 0x10f4, pQuestControl)

  const pNpcControl = m.alloc(0x40)
  const pNpcSlots = m.alloc(0x40 * 0x44)
  for (let i = 0; i < 0x40; i++) m.setU32(pNpcSlots + i * 0x44, 0xfffffffe)
  m.setU32(pNpcControl + 0x04, pNpcSlots)
  m.setU32(pNpcControl + 0x08, 0x12345678)
  m.setU32(pNpcControl + 0x0c, 0x0000029a)
  m.setU32(pGame + 0x1d24, pNpcControl)

  const pAct2 = m.alloc(0x80)
  m.setU32(pAct2 + 0x04, pGame)
  const pDrlg = m.alloc(0x500)
  m.setU32(pAct2 + 0x48, pDrlg)
  m.setU32(pGame + 0xc0, pAct2)

  return { m, pDataTables, pGame, pAct2, pQuestControl, pNpcControl, pNpcSlots, pItemsTxt }
}

function allocPlayer(m: SparseMemory113c, nDifficulty = 0, guid = 101): {
  pPlayer: number
  pPlayerData: number
  pQuestFlags: number
  pInv: number
} {
  const pPlayer = m.alloc(0x100)
  const pPlayerData = m.alloc(0x100)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  const pInv = m.alloc(0x40)
  m.setU32(pInv, INVENTORY_SIGNATURE_113C)
  m.setU32(pPlayer, 0) // UNIT_PLAYER
  m.setU32(pPlayer + 0x0c, guid)
  m.setU32(pPlayer + 0x14, pPlayerData)
  m.setU32(pPlayer + 0x60, pInv)
  m.setU32(pPlayerData + (nDifficulty << 2) + 0x10, pQuestFlags)
  const pStatListEx = STATLIST_CreateEx113c(m, pPlayer, 0, 0)
  m.setU32(pPlayer + 0x5c, pStatListEx)
  STATLIST_SetUnitStat113c(m, pPlayer, 12, 20, 0) // STAT_LEVEL = 20
  return { pPlayer, pPlayerData, pQuestFlags, pInv }
}

function allocItem(m: SparseMemory113c, itemId: number, baseCode: number, guid = 500): number {
  const pItem = m.alloc(0x100)
  const pItemData = m.alloc(0xa0)
  m.setU32(pItem, 4) // UNIT_ITEM
  m.setU32(pItem + 0x04, itemId)
  m.setU32(pItem + 0x0c, guid)
  m.setU32(pItem + 0x14, pItemData)
  const pItemsTxt = m.u32(0x6fdefb98)
  m.setU32(pItemsTxt + itemId * D2ItemsTxt_SIZE + 0x80, baseCode)
  m.setU32(pItemsTxt + itemId * D2ItemsTxt_SIZE + 0x84, baseCode) // dwNormCode
  return pItem
}

function linkQuest(
  m: SparseMemory113c,
  pGame: number,
  pQuestControl: number,
  nQuestId: number,
  nQuestNo = nQuestId,
): { pQuest: number; pQuestEx: number } {
  const pQuest = m.alloc(0x100)
  const pQuestEx = m.alloc(0xc0)
  m.setU32(pQuest, nQuestId)
  m.setU32(pQuest + 0x04, pGame)
  m.setU8(pQuest + 0x09, 1)
  m.setU32(pQuest + 0x18, pQuestEx)
  m.setU32(pQuest + 0xdc, m.alloc(0x800))
  m.setU32(pQuest + 0xe0, nQuestNo)
  m.setU32(pQuest + 0xf4, m.u32(pQuestControl))
  m.setU32(pQuestControl, pQuest)
  return { pQuest, pQuestEx }
}

describe('K2 Wave 5 Batch 4 (w5b4): D2Game 0x6FCDC840..0x6FCE3BD0', () => {
  it('exports all 45 w5b4 functions', () => {
    const fns = Object.entries(w5b4Exports).filter(([, v]) => typeof v === 'function')
    expect(fns.length).toBe(45)
  })

  it('ports [1..5] NPC stock lookup, inventory statlist refresh, perm store check, interact clear, and heal/cure', () => {
    const { m, pGame, pNpcSlots } = createHarness(1)
    const { pPlayer } = allocPlayer(m, 1, 77)
    const pNpc = m.alloc(0x100)
    const pMonData = m.alloc(0x60)
    m.setU32(pNpc, 1)
    m.setU32(pNpc + 0x04, 177) // Drognan
    m.setU32(pNpc + 0x14, pMonData)

    const pItem = allocItem(m, 1, 0x20347068, 501) // 'hp4 '
    // [1/45] 0x6FCDC840: returns 1 when NPC slot not registered yet
    expect(NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c(m, pPlayer, pGame, pNpc, pItem, 0)).toBe(1)
    // Register NPC slot 0 for class 177 -> node created with byte+4 == 0 -> checks command flag 0x10
    m.setU32(pNpcSlots, 177)
    expect(NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c(m, pPlayer, pGame, pNpc, pItem, 0)).toBe(0)
    NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c(m, pItem, pNpc, 0)
    expect(NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c(m, pPlayer, pGame, pNpc, pItem, 0)).toBe(1)

    // [2/45] 0x6FCDCA20: 0 for null unit, 1 for player with initialized inventory
    expect(NPC_RefreshInventoryItemStatLists_6FCDCA20_113c(m, 0)).toBe(0)
    expect(NPC_RefreshInventoryItemStatLists_6FCDCA20_113c(m, pPlayer)).toBe(1)

    // [3/45] 0x6FCDCAA0: 'hp4 ' is permanent store item in Nightmare/Hell (difficulty=1), custom code in perm table
    expect(NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c(m, pNpc, pGame, pItem)).toBe(1)
    m.setU8(pGame + 0x6d, 0)
    expect(NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c(m, pNpc, pGame, pItem)).toBe(0)
    const pPermCodes = m.alloc(8)
    m.setU32(pPermCodes, 0x20347068)
    m.setU32(pNpcSlots + 0x34, pPermCodes)
    m.setU32(pNpcSlots + 0x38, 1)
    expect(NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c(m, pNpc, pGame, pItem)).toBe(1)

    // [4/45] 0x6FCDCB90: clears interact state on player
    m.setU32(pPlayer + 0x64, 123)
    m.setU32(pPlayer + 0x68, 1)
    m.setU8(pPlayer + 0x6c, 1)
    NPC_ClearPlayerInteractState_6FCDCB90_113c(m, pNpc, pPlayer, pGame)
    expect(m.u32(pPlayer + 0x64)).toBe(0xffffffff)
    expect(m.u32(pPlayer + 0x68)).toBe(6)
    expect(m.u8(pPlayer + 0x6c)).toBe(0)

    // [5/45] 0x6FCDCBE0: heals life to max and unlinks poison/freeze statlists
    STATLIST_SetUnitStat113c(m, pPlayer, 7, 500, 0) // maxhp
    STATLIST_SetUnitStat113c(m, pPlayer, 6, 100, 0) // hitpoints
    const pbChanged = m.alloc(4)
    NPC_HealAndCureUnit_6FCDCBE0_113c(m, pPlayer, pbChanged)
    expect(m.u8(pbChanged)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 6, 0)).toBe(500)
  })

  it('ports [6..10] NPC gold/stash deduction, item transfer, hireling roster init, and store upgrade roll', () => {
    const { m, pGame } = createHarness(0)
    const { pPlayer } = allocPlayer(m, 0, 102)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0e, 300, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0f, 1000, 0)

    // [6/45] 0x6FCDCC60: fails when cost > inv+stash, deducts across inv & stash when cost > inv
    expect(NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayer, 2000)).toBe(0)
    expect(NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayer, 500)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0x0f, 0)).toBe(800)

    // [7/45] 0x6FCDCD90 & [8/45] 0x6FCDCE60
    const pNpc = m.alloc(0x100)
    const pNpcInv = m.alloc(0x40)
    m.setU32(pNpcInv, INVENTORY_SIGNATURE_113C)
    m.setU32(pNpc + 0x60, pNpcInv)
    const pSoldItem = allocItem(m, 2, 0x20706163, 601)
    NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c(m, pSoldItem, pNpc, 1)
    expect((m.u32(pSoldItem + 0xc8) & 4) !== 0).toBe(true)
    const pEmptyInv = m.alloc(0x40)
    m.setU32(pEmptyInv, INVENTORY_SIGNATURE_113C)
    NPC_TransferInventoryItemsToOwner_6FCDCD90_113c(m, pEmptyInv, pPlayer)

    // [9/45] 0x6FCDCED0: allocates hireling roster and marks 10 entries active
    const pHirelingTxt = m.alloc(2 * D2HirelingTxt_SIZE)
    m.setU32(G_HIRELING_TXT_VA_113C, pHirelingTxt)
    m.setU32(G_HIRELING_COUNT_VA_113C, 1)
    m.setU16(pHirelingTxt, 100) // D2HirelingTxt.wVersion (+0x00) = 100
    m.setU32(pHirelingTxt + HIRELING_TXT_SELLER_OFF_113C, 198) // Greiz
    m.setU32(pHirelingTxt + 0x10, 1) // D2HirelingTxt.dwDifficulty (+0x10) = 1
    m.setU16(pHirelingTxt + 0x114, 10)
    m.setU16(pHirelingTxt + 0x116, 24) // 15 names -> 10 picked
    const pSlot = m.alloc(0x44)
    NPC_InitHirelingVendorRoster_6FCDCED0_113c(m, pSlot, pGame, 198)
    expect(m.u8(pSlot + 0x21)).toBe(1)
    const pRoster = m.u32(pSlot + 0x10)
    expect(pRoster).not.toBe(0)
    let activeCount = 0
    for (let i = 0; i < 15; i++) {
      if (m.u32(pRoster + i * 16 + 0x0c) === 1) activeCount++
    }
    expect(activeCount).toBe(10)

    // [10/45] 0x6FCDD040: returns original itemId in non-expansion or blank uber code
    m.setU32(pGame + 0x70, 0)
    expect(NPC_RollStoreItemUpgrade_6FCDD040_113c(m, 50, pGame, 2, 100, 50)).toBe(2)
    m.setU32(pGame + 0x70, 1)
    expect(NPC_RollStoreItemUpgrade_6FCDD040_113c(m, 50, pGame, 2, 100, 50)).toBe(2)
  })

  it('ports [11..15] skill charge consume + ACT2Q6 state/tomb symbol/active/status filters', () => {
    const { m, pGame, pAct2, pQuestControl } = createHarness(0)
    const { pPlayer, pQuestFlags } = allocPlayer(m, 0, 103)

    // [11/45] 0x6FCDF8F0: early exit on negative skillId or absent skill
    QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c(m, pPlayer, -1, 1)
    QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c(m, pPlayer, 5, 1)

    // [12/45] 0x6FCE1990
    const { pQuest: q0d, pQuestEx: q0dEx } = linkQuest(m, pGame, pQuestControl, 0x0d, 0x0e)
    m.setU8(pGame + 0x6a, 3)
    ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c(m, q0d, 0)
    expect(m.u8(q0dEx + 0x10)).toBe(1)
    expect(m.u32(q0dEx + 0x14)).toBe(8)
    ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c(m, q0d, 1)
    expect(m.u8(q0dEx + 0x10)).toBe(0)

    // [13/45] 0x6FCE1BA0: cycles 6 non-boss tomb symbols
    for (let i = 0; i < 7; i++) m.setU32(D2GAME_TAL_RASHA_TOMB_OBJECTS_VA_113C + i * 4, 300 + i)
    const pDrlg = m.u32(pAct2 + 0x48)
    m.setU32(pDrlg + 0x94, 0x44) // D2DrlgStrc.nBossTombLevel (+0x94) = 0x42 + 2 -> skips index 2 (302)
    const picked: number[] = []
    for (let i = 0; i < 6; i++) picked.push(ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c(m, q0d))
    expect(picked).toEqual([300, 301, 303, 304, 305, 306])
    expect(ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c(m, q0d)).toBe(300)

    // [14/45] 0x6FCE1C20 & [15/45] 0x6FCE1D30
    m.setU8(q0d + 0x0c, 1)
    expect(ACT2Q6_ActiveFilter_6FCE1C20_113c(m, q0d, 0xc9, pPlayer, pQuestFlags, 0)).toBe(1)
    const pOutStatus = m.alloc(4)
    expect(ACT2Q6_StatusFilter_6FCE1D30_113c(m, q0d, pPlayer, 0, pQuestFlags, pOutStatus)).toBe(1)
    expect(m.u8(pOutStatus)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 7, 0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 3)
    expect(ACT2Q6_StatusFilter_6FCE1D30_113c(m, q0d, pPlayer, 0, pQuestFlags, pOutStatus)).toBe(1)
    expect(m.u8(pOutStatus)).toBe(5)
  })

  it('ports [16..30] ACT2Q1..ACT2Q8 active/seq filters, portal init, NPC activate, and room completion', () => {
    const { m, pGame, pQuestControl } = createHarness(0)
    const { pPlayer, pQuestFlags } = allocPlayer(m, 0, 104)

    // Attach dynamic path + Act 2 room (level 40 = Lut Gholein, Act index 1)
    const pLevel = m.alloc(0x200)
    m.setU32(pLevel + 0x1d0, 40)
    const pRoomEx = m.alloc(0x80)
    m.setU32(pRoomEx + 0x58, pLevel)
    const pRoom = m.alloc(0x40)
    m.setU32(pRoom + 0x10, pRoomEx)
    const pPath = m.alloc(0x40)
    m.setU16(pPath + 0x02, 100)
    m.setU16(pPath + 0x06, 100)
    m.setU32(pPath + 0x1c, pRoom)
    m.setU32(pPlayer + 0x2c, pPath)

    // [16/45] 0x6FCE1E10
    expect(ACT2Q5_ActiveFilter_6FCE1E10_113c(m, 0, 0xb0, pPlayer, pQuestFlags, 0)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 1)
    expect(ACT2Q5_ActiveFilter_6FCE1E10_113c(m, 0, 0xb0, pPlayer, pQuestFlags, 0)).toBe(1)

    // [17/45] 0x6FCE1FF0, [19/45] 0x6FCE21E0, [21/45] 0x6FCE24A0
    const { pQuest: q08 } = linkQuest(m, pGame, pQuestControl, 8, 9)
    const { pQuest: q0a } = linkQuest(m, pGame, pQuestControl, 0x0a, 0x0b)
    const { pQuest: q0b, pQuestEx: q0bEx } = linkQuest(m, pGame, pQuestControl, 0x0b, 0x0c)
    m.setU8(q08 + 0x0c, 1)
    m.setU32(q08 + 0xf0, 0x6fce24a0)
    m.setU32(q0a + 0x10, 8)
    m.setU8(q0a + 0x0c, 5) // completed -> chains to q08
    m.setU32(q0a + 0xf0, 0x6fce21e0)
    m.setU32(q0b + 0x10, 0x0a)
    m.setU32(q0b + 0xf0, 0x6fce1ff0)
    expect(ACT2Q1_SeqFilter_6FCE24A0_113c(m, q08)).toBe(1)
    expect(ACT2Q3_SeqFilter_6FCE21E0_113c(m, q0a)).toBe(1)
    expect(ACT2Q4_ChainSeqFilter_6FCE1FF0_113c(m, q0b)).toBe(1)

    // [18/45] 0x6FCE2080, [20/45] 0x6FCE2250, [22/45] 0x6FCE2520
    m.setU16(q0bEx + 0x40, 0)
    expect(ACT2Q4_ActiveFilter_6FCE2080_113c(m, q0b, 0x14b, pPlayer, pQuestFlags, 0)).toBe(1)
    m.setU8(q0a + 0x0c, 1)
    expect(ACT2Q3_ActiveFilter_6FCE2250_113c(m, q0a, 0xb1, pPlayer, pQuestFlags, 0)).toBe(1)
    expect(ACT2Q1_ActiveFilter_6FCE2520_113c(m, q08, 0xb0, pPlayer, pQuestFlags, 0)).toBe(1)

    // [23/45] 0x6FCE25F0 & [24/45] 0x6FCE2680
    const { pQuest: q0d, pQuestEx: q0dEx } = linkQuest(m, pGame, pQuestControl, 0x0d, 0x0e)
    const { pQuest: q28 } = linkQuest(m, pGame, pQuestControl, 0x1c, 0x1c)
    m.setU8(q0d + 0x0c, 1)
    m.setU8(q0a + 0x0c, 4) // eclipse inactive
    QUESTRECORD_SetQuestState113c(m, m.u32(pQuestControl + 0x0c), 0x0b, 0x0d)
    expect(ACT2Q8_ActiveFilter_6FCE25F0_113c(m, q28, 0x17a, pPlayer, pQuestFlags, 0)).toBe(1)
    const pNpcKaelan = m.alloc(0x40)
    m.setU32(pNpcKaelan + 0x04, 0x17a)
    const pQuestArg = m.alloc(0x30)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x08, pNpcKaelan)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    ACT2Q8_Callback00_NpcActivate_6FCE2680_113c(m, q28, pQuestArg)

    // [25/45] 0x6FCE2850
    const pPortalObj = m.alloc(0x100)
    const pStaticPath = m.alloc(0x20)
    m.setU32(pStaticPath, pRoom)
    m.setU32(pPortalObj, 2)
    m.setU32(pPortalObj + 0x0c, 888)
    m.setU32(pPortalObj + 0x2c, pStaticPath)
    const pOpData = m.alloc(0x10)
    m.setU32(pOpData, pGame)
    m.setU32(pOpData + 0x04, pPortalObj)
    ACT2Q5_InitArcanePortalObject_6FCE2850_113c(m, pOpData)
    expect(m.u32(q0dEx + 0x28)).toBe(888)

    // [26/45] 0x6FCE2900, [27/45] 0x6FCE29E0, [28/45] 0x6FCE2B00
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 2)
    ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c(m, q0d, pQuestArg)
    expect(m.u8(q0d + 0x0c)).toBe(2)
    ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 5)).toBe(1)
    m.setU32(D2GAME_ACT2Q6_SEQ_MSG_TABLE_VA_113C + 2 * 4, 0xffffffff)
    ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c(m, q0d, pQuestArg)

    // [29/45] 0x6FCE2E70 & [30/45] 0x6FCE2F10
    const { pQuestEx: q0cEx } = linkQuest(m, pGame, pQuestControl, 0x0c, 0x0d)
    const { pPlayer: pPlayer2, pQuestFlags: qFlags2 } = allocPlayer(m, 0, 105)
    m.setU32(pPlayer2 + 0x2c, pPath)
    m.setU32(q0cEx + 0x04, pRoom)
    expect(ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c(m, pGame, pPlayer2, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, qFlags2, 0x0d, 1)).toBe(1)
    const { pPlayer: pPlayer3, pQuestFlags: qFlags3 } = allocPlayer(m, 0, 106)
    m.setU32(pPlayer3 + 0x2c, pPath)
    ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c(m, pGame, pPlayer3, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, qFlags3, 0x0d, 0x0d)).toBe(1)
  })

  it('ports [31..45] ACT2Q2..ACT2Q5 unit iteration, staff item sync, NPC activate, and status filters', () => {
    const { m, pGame, pQuestControl } = createHarness(0)
    const { pPlayer, pQuestFlags } = allocPlayer(m, 0, 107)

    const pLevel = m.alloc(0x200)
    m.setU32(pLevel + 0x1d0, 58) // Claw Viper Temple Level 2 (Act 2)
    const pRoomEx = m.alloc(0x80)
    m.setU32(pRoomEx + 0x58, pLevel)
    const pRoom = m.alloc(0x40)
    m.setU32(pRoom + 0x10, pRoomEx)
    const pPath = m.alloc(0x40)
    m.setU16(pPath + 0x02, 100)
    m.setU16(pPath + 0x06, 100)
    m.setU32(pPath + 0x1c, pRoom)
    m.setU32(pPlayer + 0x2c, pPath)

    const { pQuest: q09 } = linkQuest(m, pGame, pQuestControl, 9, 0x0a)
    const { pQuest: q0a, pQuestEx: q0aEx } = linkQuest(m, pGame, pQuestControl, 0x0a, 0x0b)
    const { pQuest: q0b, pQuestEx: q0bEx } = linkQuest(m, pGame, pQuestControl, 0x0b, 0x0c)
    const { pQuest: q0c } = linkQuest(m, pGame, pQuestControl, 0x0c, 0x0d)
    linkQuest(m, pGame, pQuestControl, 0x0d, 0x0e)

    // [31/45] 0x6FCE3010 & [32/45] 0x6FCE3080
    m.setU8(q0c + 0x0c, 1)
    expect(ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 2)).toBe(1)
    m.setU32(D2GAME_ACT2Q5_SEQ_MSG_TABLE_VA_113C + 4, 0xffffffff)
    const pQuestArg = m.alloc(0x30)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    ACT2Q5_Callback00_NpcActivate_6FCE3080_113c(m, q0c, pQuestArg)

    // [33/45] 0x6FCE31C0 & [34/45] 0x6FCE3260
    m.setU32(q0bEx + 0x20, 105)
    m.setU32(q0bEx + 0x24, 105)
    expect(ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c(m, pGame, pPlayer, 0)).toBe(1)
    expect(m.u32(q0bEx + 0x1c)).toBe(107)
    expect(ACT2Q4_IsPalaceCellarAllowed_6FCE3260_113c(m, pGame)).toBe(1)

    // [35/45] 0x6FCE3320, [36/45] 0x6FCE3480, [37/45] 0x6FCE3550
    m.setU8(q0b + 0x0c, 2)
    expect(ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 2)).toBe(1)
    ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c(m, q0b, pQuestArg)
    expect(m.u16(q0bEx + 0x40)).toBe(2)
    ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0)).toBe(1)

    // [38/45]..[42/45]: ACT2Q3 helpers
    expect(ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(m.u32(q0aEx + 0x9c)).toBe(1)
    m.setU8(q0a + 0x0c, 2)
    expect(ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 3)).toBe(1)
    m.setU32(q0aEx + 0x98, 58)
    expect(ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 1)).toBe(1)
    const { pPlayer: pPlayerB, pQuestFlags: qFlagsB } = allocPlayer(m, 0, 108)
    m.setU32(pPlayerB + 0x2c, pPath)
    ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c(m, pGame, pPlayerB, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, qFlagsB, 0x0b, 1)).toBe(1)
    m.setU32(D2GAME_ACT2Q3_SEQ_MSG_TABLE_VA_113C + 2 * 4, 0xffffffff)
    m.setU32(pQuestArg + 0x0c, pPlayerB)
    QUESTRECORD_SetQuestState113c(m, qFlagsB, 0x0b, 0x0e)
    ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c(m, q0a, pQuestArg)

    // [43/45]..[45/45]: ACT2Q2 staff item callbacks and status filter
    ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c(m, q09, pQuestArg)
    ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c(m, q09, pQuestArg)
    const pOutStatus = m.alloc(4)
    QUESTRECORD_SetQuestState113c(m, qFlagsB, 7, 0)
    QUESTRECORD_SetQuestState113c(m, qFlagsB, 0x0a, 3)
    expect(ACT2Q2_StatusFilter_6FCE3BD0_113c(m, q09, pPlayerB, 0, qFlagsB, pOutStatus)).toBe(1)
    expect(m.u8(pOutStatus)).toBe(2)
  })
})
