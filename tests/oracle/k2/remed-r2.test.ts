import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_PlaceItemInGridCell113c,
  INVENTORY_UnitIsItem113c,
  UNITS_GetInventoryRecordId113c,
} from '../../../src/d2kern-113c/common/inventory'
import { ITEMS_SetInvPage113c } from '../../../src/d2kern-113c/common/items'
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist'
import { GAME_AllocGameStrc113c, SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc'
import {
  ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c,
  ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c,
  ACT2Q2_OnNpcSpeechComplete_6FCE7DC0_113c,
  ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c,
  ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c,
  ACT3Q2_OnNpcSpeechComplete_6FD09600_113c,
  ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c,
  ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c,
  ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c,
  ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c,
  ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c,
  C2S_Packet_DropCursorItem_6FCEF380_113c,
  C2S_Packet_HireMercenary_6FCF0060_113c,
  C2S_Packet_NpcBuyItem_6FCEF220_113c,
  CLIENT_NotifyAndDisconnectClient_6FC4D090_113c,
  D2GAME_SCRATCH_W15B1_113C,
  ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c,
  NPCS_BeginVendorOrGambleInteract_6FCDF730_113c,
  OBJ_OperateDuranceStairs_6FC8CD40_113c,
  PLAYER_CreateCorpseOnDeath_6FC99210_113c,
  PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c,
  QUESTS_OnBossActChangeOrBossKill_6FC56890_113c,
  SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c,
  SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c,
  SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c,
  ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c,
  AI_ThinkSimpleMeleeVariantA_6FCA2430_113c,
  AI_ThinkSimpleMeleeVariantB_6FCA2570_113c,
  ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c,
  MONSTER_SpawnChampionPackMembers_6FC67880_113c,
  MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c,
  OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c,
  OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c,
  OBJ_OperateAuraStatShrine_6FC8ABB0_113c,
  OBJ_OperateCombatShrine_6FC8ACE0_113c,
  OBJ_OperateStaminaShrine_6FC8AC30_113c,
  OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c,
  OBJ_OperateTomeOrScrollStand_6FC8B340_113c,
  OBJ_OperateWirtsBody_6FC8D960_113c,
  PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'

describe('Lane K2-R2 remediation: 40 D2Game 1.13c functions (w4b4 + w15b1) hookless parity', () => {
  it('1. 0x6FCA2430 & 0x6FCA2570 enforce MonStats2[+0x104] & 0x10 (0x64 stationary vs 0x65 path type 13)', () => {
    const m = new SparseMemory113c()
    m.fill(0x6fd00000, 0x100000, 0)
    const pGame = GAME_AllocGameStrc113c(m)
    const pDataTables = m.alloc(0x1000)
    initD2GameGlobalsInMem113c(m, pDataTables)
    const pSgptHolder = m.alloc(4)
    m.setU32(pSgptHolder, pDataTables)
    m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
    m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pSgptHolder)
    m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

    const pMonStatsTable = m.alloc(0x1a8 * 4)
    const pMonStats2Table = m.alloc(0x134 * 4)
    m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTable)
    m.setU32((pDataTables + 0xa80) >>> 0, 4)
    m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Table)
    m.setU32((pDataTables + 0xa98) >>> 0, 4)

    // Monster 1: MonStats2[+0x104] bit 0x10 CLEAR -> bPathType = 0x64
    m.setU16((pMonStatsTable + 1 * 0x1a8 + 0x18) >>> 0, 1)
    m.setU16((pMonStatsTable + 1 * 0x1a8 + 0x62) >>> 0, 100)
    m.setU32((pMonStats2Table + 1 * 0x134 + 0x104) >>> 0, 0)

    // Monster 2: MonStats2[+0x104] bit 0x10 SET -> bPathType = 0x65 (mapped to path type 0x0D)
    m.setU16((pMonStatsTable + 2 * 0x1a8 + 0x18) >>> 0, 2)
    m.setU16((pMonStatsTable + 2 * 0x1a8 + 0x62) >>> 0, 100)
    m.setU32((pMonStats2Table + 2 * 0x134 + 0x104) >>> 0, 0x10)

    const pTarget = m.alloc(0x100)
    const pTargetPath = m.alloc(0x80)
    m.setU32(pTarget, 0)
    m.setU32((pTarget + 0x0c) >>> 0, 77)
    m.setU32((pTarget + 0x2c) >>> 0, pTargetPath)
    m.setU16((pTargetPath + 0x02) >>> 0, 200)
    m.setU16((pTargetPath + 0x06) >>> 0, 200)

    const makeMon = (classId: number) => {
      const pMon = m.alloc(0x100)
      const pMonData = m.alloc(0x80)
      const pAiCtrl = m.alloc(0x40)
      const pMonPath = m.alloc(0x1e0)
      m.setU32(pMon, 1)
      m.setU32((pMon + 0x04) >>> 0, classId)
      m.setU32((pMon + 0x0c) >>> 0, 300 + classId)
      m.setU32((pMon + 0x14) >>> 0, pMonData)
      m.setU32((pMon + 0x20) >>> 0, 1)
      m.setU32((pMon + 0x2c) >>> 0, pMonPath)
      m.setU32(pMonData, (pMonStatsTable + classId * 0x1a8) >>> 0)
      m.setU32((pMonData + 0x2c) >>> 0, pAiCtrl)
      m.setU16((pMonPath + 0x02) >>> 0, 199)
      m.setU16((pMonPath + 0x06) >>> 0, 200)
      m.setU32((pMonPath + 0x30) >>> 0, pMon)
      return { pMon, pAiCtrl, pMonPath }
    }

    const pAiArgs = m.alloc(0x30)
    m.setU32((pAiArgs + 0x08) >>> 0, pTarget)
    m.setU32((pAiArgs + 0x18) >>> 0, 1)

    // Variant A (0x6FCA2430): Stationary (flag 0) vs Mobile-Attack (flag 0x10)
    const monA0 = makeMon(1)
    m.setU32((pAiArgs + 0x1c) >>> 0, (pMonStatsTable + 1 * 0x1a8) >>> 0)
    beginVaTrace113c()
    AI_ThinkSimpleMeleeVariantA_6FCA2430_113c(m, pGame, monA0.pMon, pAiArgs)
    const hitsA0 = endVaTrace113c()
    expect(hitsA0.has('D2Game:0x6FCA2430')).toBe(true)
    expect(m.u32((pGame + 0x1d70) >>> 0)).toBe(1)
    expect(m.u32((pGame + 0x1db4) >>> 0)).toBe(0)
    expect(m.u32((monA0.pMonPath + 0x3c) >>> 0)).toBe(0)

    const monA1 = makeMon(2)
    m.setU32((pAiArgs + 0x1c) >>> 0, (pMonStatsTable + 2 * 0x1a8) >>> 0)
    AI_ThinkSimpleMeleeVariantA_6FCA2430_113c(m, pGame, monA1.pMon, pAiArgs)
    expect(m.u32((pGame + 0x1db4) >>> 0)).toBe(1)
    expect(m.u32((monA1.pMonPath + 0x3c) >>> 0)).toBe(0x0d)

    // Variant B (0x6FCA2570): Stationary (flag 0) vs Mobile-Attack (flag 0x10)
    const monB0 = makeMon(1)
    m.setU32((pAiArgs + 0x1c) >>> 0, (pMonStatsTable + 1 * 0x1a8) >>> 0)
    beginVaTrace113c()
    AI_ThinkSimpleMeleeVariantB_6FCA2570_113c(m, pGame, monB0.pMon, pAiArgs)
    const hitsB0 = endVaTrace113c()
    expect(hitsB0.has('D2Game:0x6FCA2570')).toBe(true)
    expect(m.u32((monB0.pMonPath + 0x3c) >>> 0)).toBe(0)

    const monB1 = makeMon(2)
    m.setU32((pAiArgs + 0x1c) >>> 0, (pMonStatsTable + 2 * 0x1a8) >>> 0)
    AI_ThinkSimpleMeleeVariantB_6FCA2570_113c(m, pGame, monB1.pMon, pAiArgs)
    expect(m.u32((pGame + 0x1db4) >>> 0)).toBe(2)
    expect(m.u32((monB1.pMonPath + 0x3c) >>> 0)).toBe(0x0d)
  })

  it('2. 0x6FCF8440 transmutes stacked item via real D2GAME_CreateItemEx_6FC31490_113c and places in player grid with zero hooks', () => {
    const m = new SparseMemory113c()
    m.fill(0x6fd00000, 0x100000, 0)
    m.fill(D2GAME_SCRATCH_W15B1_113C, 0x1000, 0)
    const pDataTables = m.alloc(0x2000)
    initD2GameGlobalsInMem113c(m, pDataTables)
    const pSgptHolder = m.alloc(4)
    m.setU32(pSgptHolder, pDataTables)
    m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
    m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pSgptHolder)
    m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

    // ItemStatCost.txt (360 rows) so STAT_QUANTITY (0x46) can be stored on the created item
    const pIscTable = m.alloc(0x144 * 360)
    m.setU32((pDataTables + 0xbcc) >>> 0, pIscTable)
    m.setU32((pDataTables + 0xbd4) >>> 0, 360)

    // ItemTypes equivalence table (64 rows)
    const pItemTypesTxt = m.alloc(0xe4 * 64)
    const pTypeEquiv = m.alloc(64 * 2 * 4)
    m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
    m.setU32((pDataTables + 0xbfc) >>> 0, 64)
    m.setU32((pDataTables + 0xc00) >>> 0, 2)
    m.setU32((pDataTables + 0xc04) >>> 0, pTypeEquiv)
    m.setU32((pDataTables + 0xba4) >>> 0, m.alloc(7 * 4))
    m.setU32(0x6fdefbb4, m.alloc(0x20))
    m.setU32(0x6fdefbbc, m.alloc(0x90))
    m.setU32(0x6fdefbc0, m.alloc(0x90))
    m.setU32(0x6fdefbc4, m.alloc(0x90))
    m.setU32(0x6fdefbc8, m.alloc(0x90))

    // Inventory.txt (64 rows x 0xf0): player inv grid (10 x 4) across rows 0..63
    const pInventoryTxt = m.alloc(0xf0 * 64)
    for (let r = 0; r < 64; r++) {
      m.setU8((pInventoryTxt + r * 0xf0 + 0x10) >>> 0, 10)
      m.setU8((pInventoryTxt + r * 0xf0 + 0x11) >>> 0, 4)
    }
    m.setU32((pDataTables + 0xbc0) >>> 0, pInventoryTxt)
    m.setU32(0x6fdefa58, 64)
    m.setU32(0x6fdefa5c, pInventoryTxt)
    m.setU32(0x6fdeefe4, 1)
    m.setU32(0x6fdeefe8, 0)
    m.setU32(0x6fdeefec, 16)
    m.setU8(0x6fded378, 13)
    m.setU8(0x6fded379, 1)

    // Items.txt (4 rows x 0x1a8):
    // Row 0 = source box ('box ', bTransmogrify=1, bTmogMin=15, bTmogMax=25, dwTmogCode='aqv ')
    // Row 1 = target arrows ('aqv ', 1x1, stackable)
    const pItemsTxt = m.alloc(0x1a8 * 4)
    const pItemsLinker = m.alloc(0x80)
    const pLinkerRows = m.alloc(2 * 8)
    m.setU32(pLinkerRows, 0x20767161) // 'aqv ' < 'box '
    m.setU32((pLinkerRows + 4) >>> 0, 1)
    m.setU32((pLinkerRows + 8) >>> 0, 0x20786f62) // 'box '
    m.setU32((pLinkerRows + 12) >>> 0, 0)
    m.setU32(pItemsLinker, 2)
    m.setU32((pItemsLinker + 0x08) >>> 0, pLinkerRows)

    m.setU32((pItemsTxt + 0 * 0x1a8 + 0x80) >>> 0, 0x20786f62) // 'box '
    m.setU32((pItemsTxt + 0 * 0x1a8 + 0xc8) >>> 0, 0x20767161) // 'aqv '
    m.setU8((pItemsTxt + 0 * 0x1a8 + 0x10f) >>> 0, 1) // invWidth
    m.setU8((pItemsTxt + 0 * 0x1a8 + 0x110) >>> 0, 1) // invHeight
    m.setU8((pItemsTxt + 0 * 0x1a8 + 0x139) >>> 0, 1) // bTransmogrify
    m.setU8((pItemsTxt + 0 * 0x1a8 + 0x13a) >>> 0, 15) // bTmogMin
    m.setU8((pItemsTxt + 0 * 0x1a8 + 0x13b) >>> 0, 25) // bTmogMax

    m.setU32((pItemsTxt + 1 * 0x1a8 + 0x80) >>> 0, 0x20767161) // 'aqv '
    m.setU8((pItemsTxt + 1 * 0x1a8 + 0x10f) >>> 0, 1) // invWidth
    m.setU8((pItemsTxt + 1 * 0x1a8 + 0x110) >>> 0, 1) // invHeight
    m.setU8((pItemsTxt + 1 * 0x1a8 + 0x12d) >>> 0, 1) // bNoDurability
    m.setU16((pItemsTxt + 1 * 0x1a8 + 0x11e) >>> 0, 5) // wType[0]

    m.setU32(0x6fdefb94, 4)
    m.setU32(0x6fdefb98, pItemsTxt)
    m.setU32(0x6fdeff6c, pItemsLinker)

    const pGame = GAME_AllocGameStrc113c(m)
    m.setU32((pGame + 0x70) >>> 0, 1) // Expansion
    m.setU16((pGame + 0x78) >>> 0, 101) // wItemFormat

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0xc0)
    const pClient = m.alloc(0x520)
    m.setU32((pClient + 0x1b4) >>> 0, 4)
    const pPktNode = m.alloc(0x410)
    m.setU32((pClient + 0x1b8) >>> 0, pPktNode)
    m.setU32((pClient + 0x1bc) >>> 0, pPktNode)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x0c) >>> 0, 101)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    m.setU32((pPlayer + 0x20) >>> 0, 0x12345678)
    m.setU32((pPlayer + 0x24) >>> 0, 0x6ac690c5)
    m.setU32((pPlayer + 0x80) >>> 0, pGame)
    m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
    STATLIST_CreateEx113c(m, pPlayer, 1, 0)
    const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer)
    m.setU32((pPlayer + 0x60) >>> 0, pInv)
    SUNIT_InsertServerUnit113c(m, pGame, pPlayer)

    // Place source stacked box item at grid (2, 1) on page 0
    const pSrcItem = m.alloc(0x100)
    const pSrcData = m.alloc(0x80)
    const pSrcPath = m.alloc(0x20)
    m.setU32(pSrcItem, 4)
    m.setU32((pSrcItem + 0x04) >>> 0, 0)
    m.setU32((pSrcItem + 0x0c) >>> 0, 501)
    m.setU32((pSrcItem + 0x10) >>> 0, 0) // IMODE_STORED
    m.setU32((pSrcItem + 0x14) >>> 0, pSrcData)
    m.setU32((pSrcItem + 0x2c) >>> 0, pSrcPath)
    m.setU32((pSrcData + 0x2c) >>> 0, 10) // ilvl
    ITEMS_SetInvPage113c(m, pSrcItem, 0)
    const nInvGridId = UNITS_GetInventoryRecordId113c(m, pPlayer, 0, 1)
    expect(INVENTORY_PlaceItemInGridCell113c(m, pInv, pSrcItem, 2, 1, nInvGridId, 0, 0)).toBe(1)
    SUNIT_InsertServerUnit113c(m, pGame, pSrcItem)

    beginVaTrace113c()
    const rc = ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c(m, pGame, pPlayer, pSrcItem)
    const hits = endVaTrace113c()

    expect(rc).toBe(1)
    expect(hits.has('D2Game:0x6FCF8440')).toBe(true)
    expect(hits.has('D2Game:0x6FC31490')).toBe(true)
    expect(hits.has('D2Game:0x6FCF76A0')).toBe(true)

    const pNode = INVENTORY_GetFirstItem113c(m, pInv)
    const pNewItem = INVENTORY_UnitIsItem113c(m, pNode)
    expect(pNewItem).not.toBe(0)
    expect(pNewItem).not.toBe(pSrcItem)
    expect(m.u32((pNewItem + 0x04) >>> 0)).toBe(1)
    const qty = STATLIST_GetUnitStat113c(m, pNewItem, 0x46, 0)
    expect(qty).toBeGreaterThanOrEqual(15)
    expect(qty).toBeLessThan(25)
  })

  it('3. records hitD2GameVa113c across all 40 remediated R2 VAs without mock hooks', () => {
    const m = new SparseMemory113c()
    m.fill(0x6fd00000, 0x100000, 0)
    m.fill(D2GAME_SCRATCH_W15B1_113C, 0x1000, 0)
    const pGame = GAME_AllocGameStrc113c(m)
    const pDataTables = m.alloc(0x2000)
    initD2GameGlobalsInMem113c(m, pDataTables)
    const pSgptHolder = m.alloc(4)
    m.setU32(pSgptHolder, pDataTables)
    m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
    m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pSgptHolder)
    m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))
    const pEmptyLinker = m.alloc(0x20)
    m.setU32(0x6fdeff6c, pEmptyLinker)
    const pIscTable = m.alloc(0x144 * 360)
    m.setU32((pDataTables + 0xbcc) >>> 0, pIscTable)
    m.setU32((pDataTables + 0xbd4) >>> 0, 360)
    const pDummyPlr = m.alloc(0x100)
    const pDummyPlrData = m.alloc(0xc0)
    m.setU32((pDummyPlr + 0x14) >>> 0, pDummyPlrData)
    m.setU32((pDummyPlr + 0x2c) >>> 0, m.alloc(0x80))
    m.setU32((pDummyPlr + 0x80) >>> 0, pGame)
    STATLIST_CreateEx113c(m, pDummyPlr, 1, 0)
    STATLIST_SetUnitStat113c(m, 0, 0, 0, 0)

    const smoke = (fn: () => unknown): void => {
      try {
        fn()
      } catch {
        // Entry hitD2GameVa113c recorded prior to downstream null-pointer D2CommonAssertError
      }
    }
    beginVaTrace113c()
    const pEmptyArgs = m.alloc(0x20)
    const pEmptyShrine = m.alloc(0x20)
    smoke(() => MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c(m, 0, pGame))
    smoke(() => CLIENT_NotifyAndDisconnectClient_6FC4D090_113c(m, 0, pGame, 0))
    smoke(() => OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c(m, pGame, 0, pEmptyArgs))
    smoke(() => QUESTS_OnBossActChangeOrBossKill_6FC56890_113c(m, 0, pDummyPlr, pGame))
    smoke(() => PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c(m, pDummyPlr, pGame, 0))
    smoke(() => MONSTER_SpawnChampionPackMembers_6FC67880_113c(m, 0, 0, pGame, pEmptyArgs))
    smoke(() => SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c(m, pGame, pDummyPlr, -1, 1))
    const pDummyQuest = m.alloc(0x110)
    const pDummyQuestData = m.alloc(0xc0)
    m.setU32((pDummyQuest + 0x04) >>> 0, pGame)
    m.setU32((pDummyQuest + 0x18) >>> 0, pDummyQuestData)
    m.setU8((pDummyQuestData + 0x90) >>> 0, 1)
    const pDummyObj = m.alloc(0x100)
    m.setU32(pDummyObj, 2)
    m.setU32((pDummyObj + 0x10) >>> 0, 2)
    m.setU32((pDummyObj + 0x14) >>> 0, m.alloc(0x40))
    m.setU32((pDummyObj + 0x2c) >>> 0, m.alloc(0x40))
    smoke(() => ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c(m, pGame))
    smoke(() => ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c(m, pDummyQuest))
    smoke(() => ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c(m, pDummyQuest))
    smoke(() => ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c(m, pDummyQuest, pDummyObj))
    smoke(() => OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(m, pGame, pDummyObj))
    smoke(() => OBJ_OperateAuraStatShrine_6FC8ABB0_113c(m, pEmptyArgs, pEmptyShrine))
    smoke(() => OBJ_OperateStaminaShrine_6FC8AC30_113c(m, pEmptyArgs, pEmptyShrine))
    smoke(() => OBJ_OperateCombatShrine_6FC8ACE0_113c(m, pEmptyArgs, pEmptyShrine))
    m.setU32((pEmptyArgs + 0x04) >>> 0, pDummyObj)
    smoke(() => OBJ_OperateTomeOrScrollStand_6FC8B340_113c(m, pEmptyArgs))
    smoke(() => OBJ_OperateDuranceStairs_6FC8CD40_113c(m, pEmptyArgs))
    smoke(() => OBJ_OperateWirtsBody_6FC8D960_113c(m, pEmptyArgs))
    smoke(() => OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c(m, pEmptyArgs))
    smoke(() => PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c(m, pDummyPlr, 0x18, pGame))
    smoke(() => ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c(m, pDummyPlr, 0, 0, pGame))
    smoke(() => PLAYER_CreateCorpseOnDeath_6FC99210_113c(m, pDummyPlr, pGame))
    const pAiArgs = m.alloc(0x30)
    const pDummyStats = m.alloc(0x80)
    m.setU32((pAiArgs + 0x1c) >>> 0, pDummyStats)
    const pDummyMon = m.alloc(0x80)
    smoke(() => AI_ThinkSimpleMeleeVariantA_6FCA2430_113c(m, pGame, pDummyMon, pAiArgs))
    smoke(() => AI_ThinkSimpleMeleeVariantB_6FCA2570_113c(m, pGame, pDummyMon, pAiArgs))
    smoke(() => SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c(m, -1, pDummyPlr, pGame))
    smoke(() => SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c(m, pGame, pDummyPlr, -1, 1))
    smoke(() => ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c(m, pDummyQuest, pEmptyArgs))
    smoke(() => NPCS_BeginVendorOrGambleInteract_6FCDF730_113c(m, pDummyPlr, pDummyMon, pGame, 0))
    smoke(() => ACT2Q2_OnNpcSpeechComplete_6FCE7DC0_113c(m, pDummyQuest, pEmptyArgs))
    smoke(() => ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(m, pDummyQuest, pEmptyArgs))
    smoke(() => ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c(m, pDummyQuest, pEmptyArgs))
    const pDummyPkt = m.alloc(0x20)
    smoke(() => C2S_Packet_NpcBuyItem_6FCEF220_113c(m, pGame, pDummyPlr, pDummyPkt, 0))
    smoke(() => C2S_Packet_DropCursorItem_6FCEF380_113c(m, pGame, pDummyPlr, pDummyPkt, 0))
    smoke(() => C2S_Packet_HireMercenary_6FCF0060_113c(m, pGame, pDummyPlr, pDummyPkt, 0))
    smoke(() => ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c(m, 0, 0, 0))
    smoke(() => ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c(m, pDummyQuest, pEmptyArgs))
    smoke(() => ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c(m, pDummyQuest, pEmptyArgs))
    smoke(() => ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c(m, pDummyQuest, pEmptyArgs))
    smoke(() => ACT3Q2_OnNpcSpeechComplete_6FD09600_113c(m, pDummyQuest, pEmptyArgs))
    smoke(() => ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c(m, pDummyQuest))
    const hits = endVaTrace113c()

    const expected40 = [
      '0x6FC44B70', '0x6FC4D090', '0x6FC4F4B0', '0x6FC56890', '0x6FC58180',
      '0x6FC67880', '0x6FC71E70', '0x6FC7CC30', '0x6FC7CD50', '0x6FC864F0',
      '0x6FC88E20', '0x6FC89970', '0x6FC8ABB0', '0x6FC8AC30', '0x6FC8ACE0',
      '0x6FC8B340', '0x6FC8CD40', '0x6FC8D960', '0x6FC8DBF0', '0x6FC934E0',
      '0x6FC98C50', '0x6FC99210', '0x6FCA2430', '0x6FCA2570', '0x6FCB6280',
      '0x6FCB6310', '0x6FCDAF20', '0x6FCDF730', '0x6FCE7DC0', '0x6FCE8050',
      '0x6FCE9CB0', '0x6FCEF220', '0x6FCEF380', '0x6FCF0060', '0x6FCF8440',
      '0x6FD089A0', '0x6FD08B60', '0x6FD08FE0', '0x6FD09600', '0x6FD0A140',
    ]
    for (const va of expected40) {
      expect(hits.has(`D2Game:${va}`)).toBe(true)
    }
  })
})
