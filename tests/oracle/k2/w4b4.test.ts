import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers'
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc'
import {
  ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c,
  ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c,
  AI_SelectHostileTargetByMetrics_6FCA4720_113c,
  AI_ThinkBurrowerSpawner_6FCA77B0_113c,
  AI_ThinkChargerRunOrAttack_6FCA2EC0_113c,
  AI_ThinkDualAttackMelee_6FCA3AC0_113c,
  AI_ThinkMeleeBasic_6FCA1F50_113c,
  AI_ThinkMonsterSpawnerNest_6FCA7A60_113c,
  AI_ThinkPackFollowerMelee_6FCA4800_113c,
  AI_ThinkSimpleMeleeVariantA_6FCA2430_113c,
  AI_ThinkSimpleMeleeVariantB_6FCA2570_113c,
  AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c,
  ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c,
  ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c,
  MONSTER_SpawnChampionPackMembers_6FC67880_113c,
  MONSTER_TickPathStepAndAnim_6FC96A10_113c,
  MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c,
  NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c,
  NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c,
  NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c,
  NET_SendPacket18_HpManaPot_6FCAB8C0_113c,
  NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c,
  NET_SendPacket26_ChatMessage_6FCAB470_113c,
  NET_SendPacket7D_SetItemFlags_6FCAADE0_113c,
  NET_SendPacket8B_GameHandshake_6FCAC420_113c,
  NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c,
  NET_SendPacket96_WalkVerify_6FCAB750_113c,
  NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c,
  NET_SendPacket9E9FA0_StatValue_6FCABC20_113c,
  NET_SendPacketA0A1A2_StatDelta_6FCABB10_113c,
  NET_SendPacketA3_AuraTargetSkill_6FCABA90_113c,
  OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c,
  OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c,
  OBJ_OperateAuraStatShrine_6FC8ABB0_113c,
  OBJ_OperateCombatShrine_6FC8ACE0_113c,
  OBJ_OperateStaminaShrine_6FC8AC30_113c,
  OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c,
  OBJ_OperateTomeOrScrollStand_6FC8B340_113c,
  OBJ_OperateWirtsBody_6FC8D960_113c,
  OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c,
  PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c,
  PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c,
  PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c,
  PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c,
  STORM_TSListArraySetCount_6FC22510_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'

function createW4B4World() {
  const m = new SparseMemory113c()
  m.fill(0x6fd00000, 0x100000, 0)
  const pGame = m.alloc(0x2000)
  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  const pSgptHolder = m.alloc(4)
  m.setU32(pSgptHolder, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pSgptHolder)

  const pBitMasks = m.alloc(32 * 4)
  for (let b = 0; b < 32; b++) {
    m.setU32((pBitMasks + b * 4) >>> 0, (1 << b) >>> 0)
  }
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)

  const pIscTable = m.alloc(0x144 * 360)
  m.setU32((pDataTables + 0xbcc) >>> 0, pIscTable)
  m.setU32((pDataTables + 0xbd4) >>> 0, 360)
  m.setU16((pIscTable + 0x0e * 0x144 + 0x04) >>> 0, 0x0800)

  const pSkillsTxt = m.alloc(0x23c * 16)
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, 16)

  const itemCodes = [
    0x20646c67, // 'gld '
    0x20317068, // 'hp1 '
    0x20327068, // 'hp2 '
    0x20337068, // 'hp3 '
    0x20347068, // 'hp4 '
    0x20357068, // 'hp5 '
    0x2031706d, // 'mp1 '
    0x2032706d, // 'mp2 '
    0x2033706d, // 'mp3 '
    0x2034706d, // 'mp4 '
    0x2035706d, // 'mp5 '
    0x20637374, // 'tsc '
    0x20637369, // 'isc '
    0x206b6274, // 'tbk '
    0x206b6269, // 'ibk '
  ].sort((a, b) => (a >>> 0) - (b >>> 0))
  const pItemsTxt = m.alloc(0x1a8 * itemCodes.length)
  const pItemsLinker = m.alloc(0x20)
  const pLinkerRows = m.alloc(itemCodes.length * 8)
  for (let i = 0; i < itemCodes.length; i++) {
    const code = itemCodes[i]! >>> 0
    m.setU32((pLinkerRows + i * 8) >>> 0, code)
    m.setU32((pLinkerRows + i * 8 + 4) >>> 0, i)
    m.setU32((pItemsTxt + i * 0x1a8 + 0x80) >>> 0, code)
    m.setU8((pItemsTxt + i * 0x1a8 + 0x10f) >>> 0, 1)
    m.setU8((pItemsTxt + i * 0x1a8 + 0x110) >>> 0, 1)
    m.setU8((pItemsTxt + i * 0x1a8 + 0x12d) >>> 0, 1)
  }
  m.setU32(pItemsLinker, itemCodes.length)
  m.setU32((pItemsLinker + 0x08) >>> 0, pLinkerRows)
  m.setU32(0x6fdefb94, itemCodes.length)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(0x6fdeff6c, pItemsLinker)

  const pItemTypesTxt = m.alloc(0xe4 * 16)
  const pTypeEquiv = m.alloc(16 * 2 * 4)
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + 0xbfc) >>> 0, 16)
  m.setU32((pDataTables + 0xc00) >>> 0, 2)
  m.setU32((pDataTables + 0xc04) >>> 0, pTypeEquiv)

  const pCharStatsTxt = m.alloc(0xc4 * 8)
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStatsTxt)
  m.setU32((pDataTables + 0xbc8) >>> 0, 8)
  m.setU32((pDataTables + 0xba4) >>> 0, m.alloc(7 * 4))
  m.setU32(0x6fded354, pCharStatsTxt)
  m.setU32(0x6fded358, 8)

  m.setU32(0x6fdefbb4, m.alloc(0x20))
  m.setU32(0x6fdefbbc, m.alloc(0x90))
  m.setU32(0x6fdefbc0, m.alloc(0x90))
  m.setU32(0x6fdefbc4, m.alloc(0x90))
  m.setU32(0x6fdefbc8, m.alloc(0x90))

  const pObjectsTxt = m.alloc(0x1c0 * 16)
  m.setU32((pDataTables + 0xc20) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xc24) >>> 0, 16)
  m.setU32(0x6fdefc20, pObjectsTxt)
  m.setU32(0x6fdefc24, 16)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 16)

  m.setU32((pGame + 0xa8) >>> 0, 100)
  EVENT_InitTimerQueue113c(m, pGame)

  const pStatesTxt = m.alloc(0x3c * 200)
  const pStateMasks = m.alloc(0x40)
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc4) >>> 0, 200)
  m.setU32((pDataTables + 0xdc) >>> 0, pStateMasks)
  m.setU32((pDataTables + 0xf8) >>> 0, pStateMasks)
  m.setU32((pDataTables + 0xfc) >>> 0, pStateMasks)
  m.setU32((pDataTables + 0x144) >>> 0, pStateMasks)

  const pMonStatsTable = m.alloc(0x1a8 * 16)
  const pMonStats2Table = m.alloc(0x134 * 16)
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTable)
  m.setU32((pDataTables + 0xa80) >>> 0, 16)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Table)
  m.setU32((pDataTables + 0xa98) >>> 0, 16)
  m.setU32(0x6fd2e790, 0x6fca1f50)

  const pClient = m.alloc(0x500)
  const pPktNode = m.alloc(0x40c)
  m.setU32((pClient + 0x1b4) >>> 0, 4)
  m.setU32((pClient + 0x1b8) >>> 0, pPktNode)
  m.setU32((pClient + 0x1bc) >>> 0, pPktNode)

  return { m, pGame, pDataTables, pItemsTxt, pObjectsTxt, pClient, pPktNode }
}

describe('K2 Wave 4 Batch 4 (w4b4): 45 D2Game.dll functions', () => {
  it('ports [1/45..10/45] TSListArray, items, monster promotion, death gold, quests, and object traps', () => {
    const { m, pGame } = createW4B4World()

    // [1/45] 0x6FC22510 STORM_TSListArraySetCount_6FC22510_113c
    const pArr = m.alloc(0x10)
    m.setU32((pArr + 0x0c) >>> 0, 4)
    STORM_TSListArraySetCount_6FC22510_113c(m, pArr, 3)
    expect(m.u32((pArr + 0x04) >>> 0)).toBe(3)
    expect(m.u32(pArr)).toBe(4)
    STORM_TSListArraySetCount_6FC22510_113c(m, pArr, 1)
    expect(m.u32((pArr + 0x04) >>> 0)).toBe(1)

    // [2/45] 0x6FC309B0 ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c
    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x80)
    m.setU32(pItem, 4)
    m.setU32((pItem + 0x14) >>> 0, pItemData)
    const ppItem = m.alloc(4)
    m.setU32(ppItem, pItem)
    const pDrop = m.alloc(0x90)
    m.setU32((pDrop + 0x14) >>> 0, pGame)
    let modCalled = 0
    ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(m, 0x12345678, ppItem, pDrop, 7, {
      onApplyTypeSpecificCreatedItemMods_6FC30600: () => {
        modCalled++
      },
    })
    expect(modCalled).toBe(1)
    expect(m.u32((pItemData + 0x04) >>> 0)).toBe(0x12345678)
    expect(m.u32((pDrop + 0x30) >>> 0)).toBe(2)

    // [3/45] 0x6FC44B70 MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c
    const pMon = m.alloc(0x100)
    const pMonData = m.alloc(0x80)
    m.setU32(pMon, 1)
    m.setU32((pMon + 0x14) >>> 0, pMonData)
    let umodRolled = 0
    MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c(m, pMon, pGame, {
      onRollChampionOrUniqueUMods_6FC43CA0: () => {
        umodRolled++
      },
    })
    expect(umodRolled).toBe(1)
    expect(m.u8((pMonData + 0x16) >>> 0) & 0x08).toBe(0x08)

    // [4/45] 0x6FC4F4B0 OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c
    const pRoom = m.alloc(0x80)
    const pRoomEx = m.alloc(0x80)
    const pLevel = m.alloc(0x200)
    m.setU32((pLevel + 0x1d0) >>> 0, 10)
    m.setU32(pRoom, pRoomEx)
    m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
    m.setU32((pRoom + 0x2c) >>> 0, m.alloc(4))
    m.setU32((pRoom + 0x34) >>> 0, 0x04)
    const pRoomCoords = m.alloc(0x20)
    m.setU32(pRoomCoords, 100)
    m.setU32((pRoomCoords + 0x04) >>> 0, 200)
    m.setU32((pRoomCoords + 0x08) >>> 0, 4)
    m.setU32((pRoomCoords + 0x0c) >>> 0, 4)
    expect(OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c(m, pGame, pRoom, pRoomCoords)).toBe(1)

    // [5/45] 0x6FC58180 PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c
    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x0c) >>> 0, 11)
    m.setU32((pPlayer + 0x80) >>> 0, pGame)
    const pStatList = STATLIST_CreateEx113c(m, pPlayer, 0, 0)
    m.setU32((pPlayer + 0x5c) >>> 0, pStatList)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 15, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0e, 500, 0)
    let droppedGold = 0
    PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c(m, pPlayer, pGame, 0, {
      onDropPlayerInventoryGold_6FC57F80: (_mem, _g, _id, _pl, amt) => {
        droppedGold = amt
        return amt
      },
    })
    expect(droppedGold).toBe(425)

    // [6/45] 0x6FC67880 MONSTER_SpawnChampionPackMembers_6FC67880_113c
    MONSTER_SpawnChampionPackMembers_6FC67880_113c(m, pMon, 10, pGame, pRoomCoords)

    // [7/45] 0x6FC7CC30 ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c
    const pQuestCtrl = m.alloc(0x40)
    const pQuest = m.alloc(0x110)
    const pQData = m.alloc(0xc0)
    m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)
    m.setU32(pQuestCtrl, pQuest)
    m.setU32(pQuest, 0x21)
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU32((pQuest + 0x18) >>> 0, pQData)
    let anyaSpawned = 0
    ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c(m, pGame, {
      onSpawnFrozenAnyaAndObject189_6FC7C690: () => {
        anyaSpawned++
      },
    })
    expect(anyaSpawned).toBe(1)

    // [8/45] 0x6FC88E20 ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c
    const pCountessObj = m.alloc(0x100)
    const pObjPath = m.alloc(0x40)
    const pObjData = m.alloc(0x40)
    m.setU32(pCountessObj, 2)
    m.setU32((pCountessObj + 0x14) >>> 0, pObjData)
    m.setU32((pCountessObj + 0x2c) >>> 0, pObjPath)
    m.setU32(pObjPath, pRoom)
    m.setU32((pObjPath + 0x1c) >>> 0, pRoom)
    ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c(m, pQuest, pCountessObj)
    expect(m.u8((pQData + 0x90) >>> 0)).toBe(1)

    // [9/45] 0x6FC89970 OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c
    m.setU8((pObjData + 0x04) >>> 0, 8)
    let trap9Called = 0
    OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(m, pGame, pCountessObj, {
      onSpawnRandomMonsterTrapFromObject_6FC8A4E0: () => {
        trap9Called++
      },
    })
    expect(trap9Called).toBe(1)

    // [10/45] 0x6FC8ABB0 OBJ_OperateAuraStatShrine_6FC8ABB0_113c
    const pOpArgs = m.alloc(0x20)
    const pShrineTxt = m.alloc(0x40)
    m.setU8(pShrineTxt, 6)
    m.setU32((pShrineTxt + 0x04) >>> 0, 50)
    m.setU32((pShrineTxt + 0x0c) >>> 0, 100)
    m.setU32(pOpArgs, pGame)
    m.setU32((pOpArgs + 0x04) >>> 0, pGame)
    m.setU32((pOpArgs + 0x08) >>> 0, pPlayer)
    expect(OBJ_OperateAuraStatShrine_6FC8ABB0_113c(m, pOpArgs, pShrineTxt)).not.toBe(0)
  })

  it('ports [11/45..30/45] shrines, Wirts body, stash, player trade, monster path/gold, and AI think functions', () => {
    const { m, pGame, pClient } = createW4B4World()

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    const pPlrPath = m.alloc(0x1e0)
    const pRoom = m.alloc(0x80)
    const pRoomEx = m.alloc(0x80)
    const pLevel = m.alloc(0x200)
    m.setU32((pLevel + 0x1d0) >>> 0, 10)
    m.setU32(pRoom, pRoomEx)
    m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
    m.setU32((pRoom + 0x2c) >>> 0, m.alloc(4))
    m.setU32((pRoom + 0x34) >>> 0, 0x04)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x0c) >>> 0, 21)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    m.setU32((pPlayer + 0x2c) >>> 0, pPlrPath)
    m.setU32((pPlayer + 0x80) >>> 0, pGame)
    m.setU16((pPlrPath + 0x02) >>> 0, 105)
    m.setU16((pPlrPath + 0x06) >>> 0, 205)
    m.setU32((pPlrPath + 0x1c) >>> 0, pRoom)
    m.setU32((pPlrPath + 0x30) >>> 0, pPlayer)
    m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
    const pPlrStats = STATLIST_CreateEx113c(m, pPlayer, 0, 0)
    m.setU32((pPlayer + 0x5c) >>> 0, pPlrStats)
    const pSkillList = m.alloc(0x20)
    const pSkill0 = m.alloc(0x40)
    m.setU32(pSkill0, m.u32((m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) + 0xb98) >>> 0))
    m.setU32((pSkill0 + 0x28) >>> 0, 1)
    m.setU32((pSkill0 + 0x34) >>> 0, 0xffffffff)
    m.setU32((pSkillList + 0x04) >>> 0, pSkill0)
    m.setU32((pPlayer + 0xa8) >>> 0, pSkillList)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0a, 50 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0b, 100 << 8, 0)

    const pShrineTxt = m.alloc(0x40)
    m.setU8(pShrineTxt, 12)
    m.setU32((pShrineTxt + 0x04) >>> 0, 200)
    m.setU32((pShrineTxt + 0x08) >>> 0, 50)
    m.setU32((pShrineTxt + 0x0c) >>> 0, 250)

    const pOpArgs = m.alloc(0x30)
    m.setU32(pOpArgs, pGame)
    m.setU32((pOpArgs + 0x04) >>> 0, pGame)
    m.setU32((pOpArgs + 0x08) >>> 0, pPlayer)

    // [11/45] 0x6FC8AC30 OBJ_OperateStaminaShrine_6FC8AC30_113c
    OBJ_OperateStaminaShrine_6FC8AC30_113c(m, pOpArgs, pShrineTxt)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0x0a, 0)).toBe((100 << 8) + 400)

    // [12/45] 0x6FC8ACE0 OBJ_OperateCombatShrine_6FC8ACE0_113c
    m.setU8(pShrineTxt, 7)
    OBJ_OperateCombatShrine_6FC8ACE0_113c(m, pOpArgs, pShrineTxt)

    // [13/45] 0x6FC8B340 OBJ_OperateTomeOrScrollStand_6FC8B340_113c
    const pShrineObj = m.alloc(0x100)
    const pObjPath = m.alloc(0x40)
    const pSeed = m.alloc(8)
    m.setU32(pSeed, 12345)
    m.setU32((pSeed + 4) >>> 0, 67890)
    m.setU32(pShrineObj, 2)
    m.setU32((pShrineObj + 0x10) >>> 0, 0)
    m.setU32((pShrineObj + 0x2c) >>> 0, pObjPath)
    m.setU32(pObjPath, pRoom)
    m.setU32((pObjPath + 0x0c) >>> 0, 106)
    m.setU32((pObjPath + 0x10) >>> 0, 206)
    m.setU32(pOpArgs, pGame)
    m.setU32((pOpArgs + 0x04) >>> 0, pShrineObj)
    m.setU32((pOpArgs + 0x08) >>> 0, pPlayer)
    m.setU32((pOpArgs + 0x0c) >>> 0, pSeed)
    expect(OBJ_OperateTomeOrScrollStand_6FC8B340_113c(m, pOpArgs)).toBe(1)
    expect(m.u32((pShrineObj + 0x10) >>> 0)).toBe(2)

    // [14/45] 0x6FC8D960 OBJ_OperateWirtsBody_6FC8D960_113c
    m.setU32((pShrineObj + 0x10) >>> 0, 0)
    expect(
      OBJ_OperateWirtsBody_6FC8D960_113c(m, pOpArgs, {
        onRollAndDropItemByTypeAtUnit_6FC31A70: () => 1,
      }),
    ).toBe(1)
    expect(m.u32((pShrineObj + 0x10) >>> 0)).toBe(1)

    // [15/45] 0x6FC8DBF0 OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c
    m.setU32((pShrineObj + 0x10) >>> 0, 1)
    OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c(m, pOpArgs)

    // [16/45] 0x6FC8DD60 OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c
    OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c(m, pOpArgs, 1)

    // [17/45] 0x6FC90FB0 PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c
    m.setU32((pPlayerData + 0x5c) >>> 0, m.alloc(0x18))
    expect(PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c(m, pPlayer, pGame)).toBe(0)

    // [18/45] 0x6FC93860 PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c
    expect(PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c(m, pPlayer, pGame, 0)).toBe(1)

    // [19/45] 0x6FC96A10 MONSTER_TickPathStepAndAnim_6FC96A10_113c
    const pMon = m.alloc(0x100)
    const pMonData = m.alloc(0x80)
    const pMonPath = m.alloc(0x1e0)
    const pMonStatsTxt = m.alloc(0x200)
    const pAiGen = m.alloc(0x40)
    m.setU32(pMon, 1)
    m.setU32((pMon + 0x0c) >>> 0, 31)
    m.setU32((pMon + 0x10) >>> 0, 1)
    m.setU32((pMon + 0x14) >>> 0, pMonData)
    m.setU32((pMon + 0x2c) >>> 0, pMonPath)
    m.setU32((pMon + 0x44) >>> 0, 0x0100)
    m.setU32((pMon + 0x48) >>> 0, 0x0400)
    m.setU16((pMon + 0x4c) >>> 0, 0x0100)
    m.setU32(pMonData, pMonStatsTxt)
    m.setU32((pMonData + 0x2c) >>> 0, pAiGen)
    m.setU16((pMonPath + 0x02) >>> 0, 108)
    m.setU16((pMonPath + 0x06) >>> 0, 208)
    m.setU32((pMonPath + 0x1c) >>> 0, pRoom)
    m.setU32((pMonPath + 0x30) >>> 0, pMon)
    expect(MONSTER_TickPathStepAndAnim_6FC96A10_113c(m, pGame, pMon)).toBe(1)
    expect(MONSTER_TickPathStepAndAnim_6FC96A10_113c(m, pGame, pMon)).toBe(2)

    // [20/45] 0x6FC98C50 ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c
    ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c(m, pMon, 250, pPlayer, pGame)

    // [21/45..30/45] AI think & target selection functions
    const pAiCtrl = m.alloc(0x40)
    const pAiArgs = m.alloc(0x30)
    m.setU32(pAiCtrl, 0x0a)
    m.setU32(pAiArgs, pAiCtrl)
    m.setU32((pAiArgs + 0x08) >>> 0, pPlayer)
    m.setU32((pAiArgs + 0x14) >>> 0, 3)
    m.setU32((pAiArgs + 0x18) >>> 0, 1)
    m.setU32((pAiArgs + 0x1c) >>> 0, pMonStatsTxt)
    m.setU16((pMonStatsTxt + 0x56) >>> 0, 10)
    m.setU16((pMonStatsTxt + 0x5c) >>> 0, 10)
    m.setU16((pMonStatsTxt + 0x62) >>> 0, 50)
    m.setU16((pMonStatsTxt + 0x68) >>> 0, 10)
    m.setU16((pMonStatsTxt + 0x6e) >>> 0, 10)

    AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c(m, pGame, pMon, pAiArgs)
    AI_ThinkMeleeBasic_6FCA1F50_113c(m, pGame, pMon, pAiArgs)
    AI_ThinkSimpleMeleeVariantA_6FCA2430_113c(m, pGame, pMon, pAiArgs)
    AI_ThinkSimpleMeleeVariantB_6FCA2570_113c(m, pGame, pMon, pAiArgs)
    AI_ThinkChargerRunOrAttack_6FCA2EC0_113c(m, pGame, pMon, pAiArgs)
    AI_ThinkDualAttackMelee_6FCA3AC0_113c(m, pGame, pMon, pAiArgs)
    expect(
      AI_SelectHostileTargetByMetrics_6FCA4720_113c(m, pGame, pMon, pMonStatsTxt, pPlayer),
    ).toBe(pPlayer)
    AI_ThinkPackFollowerMelee_6FCA4800_113c(m, pGame, pMon, pAiArgs)
    AI_ThinkBurrowerSpawner_6FCA77B0_113c(m, pGame, pMon, pAiArgs)
    AI_ThinkMonsterSpawnerNest_6FCA7A60_113c(m, pGame, pMon, pAiArgs)
  })

  it('ports [31/45..45/45] S2C packet builders and party stat-sync functions', () => {
    const { m, pGame, pClient, pPktNode } = createW4B4World()

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    const pPlrPath = m.alloc(0x40)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x0c) >>> 0, 0x11223344)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    m.setU32((pPlayer + 0x2c) >>> 0, pPlrPath)
    m.setU32((pPlayer + 0x80) >>> 0, pGame)
    m.setU16((pPlrPath + 0x02) >>> 0, 500)
    m.setU16((pPlrPath + 0x06) >>> 0, 600)
    m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
    SUNIT_InsertServerUnit113c(m, pGame, pPlayer)

    // [31/45] 0x6FCAA2A0 NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c
    m.setU32((pClient + 0x3bc) >>> 0, 1)
    NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c(m, pClient)
    expect(m.u8((pPktNode + 4) >>> 0)).toBe(0x16)

    // [32/45] 0x6FCAADE0 NET_SendPacket7D_SetItemFlags_6FCAADE0_113c
    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x80)
    const pItemPath = m.alloc(0x40)
    m.setU32(pItem, 4)
    m.setU32((pItem + 0x0c) >>> 0, 99)
    m.setU32((pItem + 0x14) >>> 0, pItemData)
    m.setU32((pItem + 0x2c) >>> 0, pItemPath)
    m.setU32((pItemData + 0x18) >>> 0, 0x10)
    // D2Game.dll@0x6FCAA3E0 returns queued byte count (`nPacketSize`) on success.
    expect(NET_SendPacket7D_SetItemFlags_6FCAADE0_113c(m, pPlayer, pItem, pClient, 0x04, 1)).toBe(18)

    // [33/45] 0x6FCAB0F0 NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c
    m.setU32((pItem + 0x04) >>> 0, 1)
    m.setU32((pItemData + 0x04) >>> 0, 2)
    m.setU32((pItemData + 0x18) >>> 0, 0x2010)
    NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 6, pPlayer, pItem, pClient, 0x2000, 0)

    // [34/45] 0x6FCAB470 NET_SendPacket26_ChatMessage_6FCAB470_113c
    const pChatMsg = m.alloc(0x140)
    m.setU8(pChatMsg, 0x26)
    m.setU8((pChatMsg + 0x0a) >>> 0, 0x41)
    m.setU8((pChatMsg + 0x1a) >>> 0, 0x48)
    expect(NET_SendPacket26_ChatMessage_6FCAB470_113c(m, pChatMsg, pClient)).toBe(14)

    // [35/45] 0x6FCAB750 NET_SendPacket96_WalkVerify_6FCAB750_113c
    expect(NET_SendPacket96_WalkVerify_6FCAB750_113c(m, pClient, 100, 120, 140, 4, 8)).toBe(9)

    // [36/45] 0x6FCAB7F0 NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c
    expect(
      NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c(m, pClient, 200, 150, 100, 500, 600, 0, 0),
    ).toBe(13)

    // [37/45] 0x6FCAB8C0 NET_SendPacket18_HpManaPot_6FCAB8C0_113c
    expect(
      NET_SendPacket18_HpManaPot_6FCAB8C0_113c(m, pClient, 250, 180, 120, 10, 5, 500, 600, 2, -2),
    ).toBe(15)

    // [38/45] 0x6FCABA90 NET_SendPacketA3_AuraTargetSkill_6FCABA90_113c
    expect(
      NET_SendPacketA3_AuraTargetSkill_6FCABA90_113c(m, 0, 98, pClient, 5, 1, 11, 0, 22, 510, 610),
    ).toBe(24)

    // [39/45] 0x6FCABB10 NET_SendPacketA0A1A2_StatDelta_6FCABB10_113c
    expect(NET_SendPacketA0A1A2_StatDelta_6FCABB10_113c(m, pClient, 0, 10, 0, pPlayer)).toBe(7)
    expect(NET_SendPacketA0A1A2_StatDelta_6FCABB10_113c(m, pClient, 0, 1000, 0, pPlayer)).toBe(8)
    expect(NET_SendPacketA0A1A2_StatDelta_6FCABB10_113c(m, pClient, 0, 100000, 0, pPlayer)).toBe(10)

    // [40/45] 0x6FCABC20 NET_SendPacket9E9FA0_StatValue_6FCABC20_113c
    expect(NET_SendPacket9E9FA0_StatValue_6FCABC20_113c(m, 1, pPlayer, pClient, 20)).toBe(7)
    expect(NET_SendPacket9E9FA0_StatValue_6FCABC20_113c(m, 1, pPlayer, pClient, 2000)).toBe(8)
    expect(NET_SendPacket9E9FA0_StatValue_6FCABC20_113c(m, 1, pPlayer, pClient, 200000)).toBe(10)

    // [41/45] 0x6FCABE10 NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c
    expect(NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c(m, pClient, 50, 10)).toBe(2)
    expect(NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c(m, pClient, 50, 60)).toBe(3)
    expect(NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c(m, pClient, 5000, 10)).toBe(4)
    expect(NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c(m, pClient, 500000, 10)).toBe(6)

    // [42/45] 0x6FCAC280 NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c
    expect(
      NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c(m, 0, 0x15, 0x11223344, pClient, 1, 500, 600, 0, 1),
    ).toBe(13)

    // [43/45] 0x6FCAC420 NET_SendPacket8B_GameHandshake_6FCAC420_113c
    const pArenaCtrl = m.alloc(0x20)
    m.setU32((pGame + 0x1d28) >>> 0, pArenaCtrl)
    expect(NET_SendPacket8B_GameHandshake_6FCAC420_113c(m, pGame, 0x8b, pClient)).toBe(8)

    // [44/45] 0x6FCAC910 NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c
    expect(NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c(m, pPlayer, pPlayer, 100, 7)).toBe(0)

    // [45/45] 0x6FCACFB0 PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c
    PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c(m, pPlayer, pGame)
  })
})
