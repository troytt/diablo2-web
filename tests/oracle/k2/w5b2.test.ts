import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { INVENTORY_AllocInventory113c } from '../../../src/d2kern-113c/common/inventory.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts'
import { STATLIST_CreateEx113c } from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c,
  ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c,
  ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c,
  ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c,
  ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c,
  ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c,
  ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c,
  ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c,
  ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c,
  ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c,
  ACT5Q3_PropagateQuestStateToPartyCallback_6FC7B120_113c,
  ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c,
  ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c,
  NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c,
  NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c,
  NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c,
  NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c,
  NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c,
  NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c,
  OBJ_OperateChestAndDropTreasure_6FC8EC20_113c,
  OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c,
  OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c,
  OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c,
  OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c,
  OBJ_UseWellHealPlayerAndPets_6FC8A560_113c,
  PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c,
  PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c,
  PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c,
  SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c,
  SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c,
  SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c,
  SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c,
  SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c,
  SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c,
  SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c,
  SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c,
  SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c,
  SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c,
  SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c,
  SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c,
  SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c,
  SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c,
  SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0_113c,
  STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c,
  SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b2-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2AnimDataTableStrc,
  D2DrlgLevelStrc,
  D2DynamicPathStrc,
  D2ItemsTxt_SIZE,
  D2ItemStatCostTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2RoomExStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'

function createW5B2TestWorld() {
  const m = new SparseMemory113c()
  m.fill(0x6fdd8000, 0x1c000, 0)
  m.fill(0x6fd1bd80, 0x40, 0)
  const pDataTables = m.alloc(0x1200)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  const pBitMasks = m.u32(0x6fd18be0)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)
  m.setU32(0x6fdeff6c, m.alloc(0x10))

  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, monStatsCount)
  for (let i = 0; i < monStatsCount; i += 1) {
    const rec = pMonStatsTxt + i * 0x1a8
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x18, i)
  }

  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, monStatsCount)

  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, skillsCount)

  const iscCount = 360
  const pItemStatCostTxt = m.alloc(iscCount * D2ItemStatCostTxt_SIZE)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt, pItemStatCostTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount, iscCount)

  const itemsCount = 32
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE)
  m.setU32(SG_ITEM_DATATABLES_VA_113C, itemsCount)
  m.setU32(SG_ITEM_DATATABLES_VA_113C + 4, pItemsTxt)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)

  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, levelsCount)

  const pObjectsTxt = m.alloc(600 * 0x1c0)
  m.setU32(pDataTables + 0xc48, pObjectsTxt)
  m.setU32(pDataTables + 0xc50, 600)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  const pStateMaskExp = m.alloc(0x40)
  m.setU32(pStateMaskExp + 4 * 4, 1 << 6)
  m.setU32(pDataTables + 0xc4, 200)
  m.setU32(pDataTables + 0x100, pStateMaskExp)
  m.setU32(pDataTables + 0x104, pStateMaskExp)
  m.setU32(pDataTables + 0xbf0, 8)
  m.fill(0x6fd27b8c, 0x30, 0)
  m.setU32(0x6fdf13c4, 20)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34))
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34))
  const pAnimData = m.alloc(0x800)
  const pEmptyBucket = m.alloc(8)
  for (let i = 0; i < 256; i += 1) {
    m.set(pAnimData, D2AnimDataTableStrc.pHashBuckets, pEmptyBucket, i)
  }
  m.setU32(0x6fdf0b4c, pAnimData)

  const pGame = m.alloc(0x1df4)
  m.setU32(pGame + 0x1c, 0x12340000)
  m.setU32(pGame + 0xa8, 100)
  m.setU16(pGame + 0x78, 101)
  m.setU32(pGame + 0x70, 1)
  m.setU8(pGame + 0x6d, 0)
  m.setU32(pGame + 0x1d2c, m.alloc(0x20))
  EVENT_InitTimerQueue113c(m, pGame)

  return { m, pGame, pDataTables, pSkillsTxt, pObjectsTxt, pItemsTxt }
}

describe('D2Game 1.13c K2 Wave 5 Batch 2 (0x6FC7AB00..0x6FCB94C0)', () => {
  it('[1/45]..[20/45] Act1/Act5 Quest Party Propagation, Cain Rescue, Well/Shrine/Chest/Urn & HoverMsg', () => {
    const { m, pGame, pObjectsTxt } = createW5B2TestWorld()

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    const pQuestRecord = m.alloc(0x100)
    m.setU32(pQuestRecord, m.alloc(0x60))
    m.setU32(pQuestRecord + 4, 0x60)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 1)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x80, pGame)
    m.setU32(pPlayer + 0x60, INVENTORY_AllocInventory113c(m, 0, pPlayer))
    STATLIST_CreateEx113c(m, pPlayer, 0x80000000, pGame)
    m.setU32(pPlayerData + 0x10, pQuestRecord)

    // [1/45]..[8/45], [11/45]..[12/45] Quest party propagation callbacks
    expect(ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT5Q3_PropagateQuestStateToPartyCallback_6FC7B120_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c(m, pGame, pPlayer)).toBe(0)

    // [9/45] ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c
    const pPlrPath = m.alloc(0x80)
    const pTristRoom = m.alloc(0x80)
    const pTristRoomEx = m.alloc(0x80)
    const pTristLevel = m.alloc(0x280)
    m.set(pTristLevel, D2DrlgLevelStrc.nLevelId, 0x26)
    m.set(pTristRoomEx, D2RoomExStrc.pLevel, pTristLevel)
    m.set(pTristRoom, D2ActiveRoomStrc.pRoomEx, pTristRoomEx)
    m.set(pTristRoom, D2ActiveRoomStrc.pActUpdateFlag, m.alloc(4))
    m.set(pPlrPath, D2DynamicPathStrc.pRoom, pTristRoom)
    m.setU32(pPlayer + 0x2c, pPlrPath)
    ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 4, 1)).toBe(1)

    // [10/45] ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c
    expect(ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c(m, pGame, pPlayer)).toBe(0)

    // [13/45]..[19/45] Object operate handlers
    m.fill(m.u32(pQuestRecord), 0x60, 0)
    const pObjTxtRec = pObjectsTxt + 10 * 0x1c0
    m.setU8(pObjTxtRec + 0x121, 1)
    m.setU32(pObjTxtRec + 0x17c, 0x80)
    m.setU32(pObjTxtRec + 0x184, 3)

    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    const pObjPath = m.alloc(0x40)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x04, 10)
    m.setU32(pObj + 0x10, 0)
    m.setU32(pObj + 0x14, pObjData)
    m.setU32(pObj + 0x2c, pObjPath)
    m.setU32(pObj + 0x80, pGame)
    m.setU32(pObjPath, pTristRoom)
    m.setU32(pObjData, pObjTxtRec)
    const pOpArgs = m.alloc(0x30)
    m.setU32(pOpArgs, pGame)
    m.setU32(pOpArgs + 0x04, pObj)
    m.setU32(pOpArgs + 0x08, pPlayer)
    m.setU32(pOpArgs + 0x0c, m.alloc(8))
    m.setU32(pOpArgs + 0x10, 10)

    expect(ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c(m, pOpArgs)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 4, 1)).toBe(1)
    expect(OBJ_UseWellHealPlayerAndPets_6FC8A560_113c(m, pObjTxtRec, pPlayer, pGame)).toBe(0)
    OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c(m, pOpArgs)
    m.setU32(pObj + 0x10, 0)
    expect(OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c(m, pOpArgs)).toBe(1)
    m.setU32(pObj + 0x10, 0)
    expect(OBJ_OperateChestAndDropTreasure_6FC8EC20_113c(m, pOpArgs)).toBe(1)
    m.setU32(pObj + 0x10, 0)
    expect(OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c(m, pOpArgs)).toBe(1)
    m.setU32(pObj + 0x10, 0)
    expect(OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c(m, pOpArgs)).toBe(1)

    // [20/45] SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c
    const pClient = m.alloc(0x600)
    SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c(m, pClient, pObj)
  })

  it('[21/45]..[45/45] Net Packet 9D/59/Sync, NPC Gamble/Vendor Free, Progressive Charge Skills, Pets & Morph', () => {
    const { m, pGame, pDataTables, pSkillsTxt } = createW5B2TestWorld()
    m.setU32(pDataTables + 0xbc, m.alloc(200 * 0x3c))
    m.setU32(pDataTables + 0xbd4, 360)

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    const pClient = m.alloc(0x600)
    const pPlayerPath = m.alloc(0x80)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 7)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x20, 0x12345)
    m.setU32(pPlayer + 0x24, 666)
    m.setU32(pPlayer + 0x2c, pPlayerPath)
    m.setU16(pPlayerPath + 0x02, 100)
    m.setU16(pPlayerPath + 0x06, 100)
    m.setU16(pPlayerPath + 0x10, 102)
    m.setU16(pPlayerPath + 0x12, 102)
    m.setU32(pPlayer + 0x60, INVENTORY_AllocInventory113c(m, 0, pPlayer))
    m.setU32(pPlayer + 0x80, pGame)
    STATLIST_CreateEx113c(m, pPlayer, 0x80000000, pGame)
    m.setU32(pPlayerData + 0x9c, pClient)
    m.setU32(pClient + 0x1a8, pGame)
    m.setU8(pClient + 0x3d4, 1)
    m.setU32(pClient + 0x174, pPlayer)
    SUNIT_InsertServerUnit113c(m, pGame, pPlayer)

    // [22/45] NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c
    const szName = m.alloc(16)
    m.setU8(szName, 0x48)
    m.setU8(szName + 1, 0x65)
    m.setU8(szName + 2, 0)
    NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c(
      m,
      pClient,
      1,
      7,
      szName,
      100,
      100,
    )

    // [21/45] NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c (assert mismatch throws)
    const pDummyItem = m.alloc(0x100)
    m.setU32(pDummyItem, 4)
    m.setU32(pDummyItem + 0x14, m.alloc(0x80))
    expect(() =>
      NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(m, pDummyItem, pPlayer, 0, 0),
    ).toThrow()

    // [23/45] NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c
    const pMonster = m.alloc(0x100)
    const pMonData = m.alloc(0x80)
    const pMonPath = m.alloc(0x80)
    m.setU32(pMonster, 1)
    m.setU32(pMonster + 0x04, 1)
    m.setU32(pMonster + 0x0c, 42)
    m.setU32(pMonster + 0x10, 1)
    m.setU32(pMonster + 0x14, pMonData)
    m.setU32(pMonster + 0x2c, pMonPath)
    m.setU16(pMonPath + 0x02, 101)
    m.setU16(pMonPath + 0x06, 101)
    STATLIST_CreateEx113c(m, pMonster, 0x80000000, pGame)
    SUNIT_InsertServerUnit113c(m, pGame, pMonster)
    expect(NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c(m, pPlayer, pPlayer, 50, 0)).toBe(0)
    expect(NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c(m, pMonster, pPlayer, 50, 0)).toBe(0)
    expect(NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c(m, pDummyItem, pPlayer, 50, 0)).toBe(0)

    // [24/45]..[26/45] NPC gamble/merc/vendor cleanup
    const pNpcCtrl = m.alloc(0x10)
    const pNpcSlots = m.alloc(0x40 * 0x44)
    m.setU32(pGame + 0x1d24, pNpcCtrl)
    m.setU32(pNpcCtrl + 0x04, pNpcSlots)
    m.setU32(pNpcSlots, 150)
    m.setU32(pNpcSlots + 0x04, INVENTORY_AllocInventory113c(m, 0, 0))
    m.setU32(pNpcSlots + 0x0c, 1)
    const pGambleNode = m.alloc(0x10)
    m.setU32(pGambleNode, INVENTORY_AllocInventory113c(m, 0, 0))
    m.setU32(pGambleNode + 0x04, 7)
    m.setU32(pNpcSlots + 0x08, pGambleNode)

    const pNpcUnit = m.alloc(0x20)
    m.setU32(pNpcUnit + 0x04, 150)
    NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c(m, pNpcUnit, pPlayer, pGame)
    expect(m.u32(pNpcSlots + 0x08)).toBe(0)

    const pGambleNode2 = m.alloc(0x10)
    m.setU32(pGambleNode2, INVENTORY_AllocInventory113c(m, 0, 0))
    m.setU32(pGambleNode2 + 0x04, 7)
    m.setU32(pNpcSlots + 0x08, pGambleNode2)
    const pMercNode = m.alloc(0x10)
    m.setU32(pMercNode, 7)
    m.setU32(pNpcSlots + 0x18, pMercNode)
    NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c(m, pNpcUnit, pPlayer, pGame)
    expect(m.u32(pNpcSlots + 0x08)).toBe(0)
    expect(m.u32(pNpcSlots + 0x18)).toBe(0)

    NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c(m, pGame, pNpcSlots)
    expect(m.u32(pNpcSlots + 0x04)).toBe(0)

    // [27/45]..[37/45], [42/45]..[45/45] Progressive charge & combat skill handlers
    const skillId = 10
    const skillRec = pSkillsTxt + skillId * 0x23c
    m.setU16(skillRec + 0x54, 30)
    m.setU16(skillRec + 0x80, 10)
    m.setU8(skillRec + 0x1a5, 0x80)
    m.setU8(skillRec + 0x1dc, 4)

    const pChargeList = STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
    const pDmg = m.alloc(0x70)
    SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c(m, pPlayer, pDmg, pChargeList)
    SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c(m, pPlayer, pChargeList, pDmg)
    expect(SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0_113c(m, pGame, pPlayer, skillId, 1)).toBe(0)
    expect(SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c(m, pGame, pPlayer, skillId, 1)).toBe(0)

    PATH_SetTargetUnit113c(m, pPlayerPath, pMonster)
    SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c(m, pPlayer, pGame, pMonster, skillId, 1)

    const pAuraCtx = m.alloc(0x14)
    m.setU32(pAuraCtx, pGame)
    m.setU32(pAuraCtx + 0x04, pPlayer)
    m.setU32(pAuraCtx + 0x0c, pDmg)
    expect(SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c(m, pAuraCtx, pMonster)).toBe(1)

    expect(SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c(m, pGame, pPlayer, skillId, 1)).toBe(1)
    expect(
      SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c(
        m,
        pGame,
        pPlayer,
        1,
        1234,
        1,
        0,
        skillId,
        1,
      ),
    ).toBe(1)
    expect(SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c(m, pGame, pPlayer, skillId, 1)).toBe(0)
    expect(SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c(m, pGame, pPlayer, skillId, 1)).toBe(0)
    expect(SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c(m, pGame, pPlayer, skillId, 1)).toBe(1)

    // [38/45]..[41/45] Pet packet/warp/unsummon & morph state removal
    expect(PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c(m, pMonster, pGame, pPlayer)).toBe(0)
    const pPetSlot = m.alloc(8)
    PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c(m, pPetSlot, 0, pGame, 100, 100)
    PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c(m, pGame, 9999)

    const pInfo = m.alloc(0x20)
    m.setU32(pPlayer + 0xa8, pInfo)
    STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c(m, pPlayer, 10, 0)

    // [42/45]..[45/45] Claws of Thunder, Melee Elem Convert, Smite, Leap/Charge Projectile
    expect(SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c(m, pGame, pPlayer, skillId, 1)).toBe(0)
    expect(SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c(m, pGame, pPlayer, skillId, 1)).toBe(0)
    expect(SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c(m, pGame, pPlayer, skillId, 1)).toBe(0)
    expect(SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c(m, pGame, pPlayer, skillId, 1)).toBe(0)
  })
})
