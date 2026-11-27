import { describe, expect, it } from 'vitest'
import {
  GDW_BITMASKS_IAT_VA_113C,
  SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/skills.ts'
import {
  ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c,
  ACT1Q3_OnNpcInitCainSearch_6FC86960_113c,
  ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c,
  ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c,
  ACT2Q2_CleanupHoradricStaffItemsOnEnterAct1_6FCE7D00_113c,
  ACT3Q3_CleanupKhalimItemsOnEnterAct2OrComplete_6FD087E0_113c,
  ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c,
  ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c,
  ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c,
  ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c,
  ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c,
  C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c,
  C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c,
  C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c,
  C2S_Packet32_NpcBuyItem_6FCEF570_113c,
  C2S_Packet49_WaypointInteract_6FCF0D30_113c,
  C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c,
  CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c,
  CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c,
  ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c,
  MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c,
  NPCTRADE_EnsureVendorInventoryGenerated_6FCDF1C0_113c,
  NPCTRADE_InteractBuyItem_6FCDF200_113c,
  NPCTRADE_InteractRepairItem_6FCE1890_113c,
  NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c,
  PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c,
  PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c,
  QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c,
  SKILLS_SpawnBoneWallSegment_6FC70E60_113c,
  SKILLS_SrvDo_BoneWall_6FC70FE0_113c,
  SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c,
  SKILLS_SrvDo_IronGolem_6FC71540_113c,
  SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c,
  SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c,
  SKILLS_SrvDo_SummonDecoy_6FC6D710_113c,
  SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c,
  SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c,
  SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c,
  SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c,
  SKILLS_SrvDo_Valkyrie_6FCB5980_113c,
  SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'

function createTestMem(): SparseMemory113c {
  const m = new SparseMemory113c()
  m.fill(0x10000, 0x40000, 0)
  m.fill(0x6fd18000, 0x20000, 0)
  m.fill(0x6fde9000, 0x10000, 0)
  initD2GameGlobalsInMem113c(m, 0x38100)

  const pMasks = 0x39800
  for (let i = 0; i < 32; i++) {
    m.setU32((pMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pMasks)
  m.setU32(GDW_BITMASKS_IAT_VA_113C, pMasks)

  m.setU32(0x38000, 0x38100)
  m.setU32(0x6fd1829c, 0x38000)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, 0x38000)
  m.setU32(0x6fde9e1c, 0x38100)
  m.setU32(SGPT_DATATABLES_VA_113C, 0x38100)
  m.setU32(0x6fdefbf0 + 0x04, 0x3b000)
  m.setU32(0x6fdf0b54, 0x3a000)
  m.setU32(0x6fdf0b58, 4)
  m.setU32(0x6fd31f80, 1)
  m.setU32(0x6fd31f7c, 2)

  // Initialize pGame (0x10000) timer queue, quest control, arena table, and NPC control
  EVENT_InitTimerQueue113c(m, 0x10000)
  m.setU32(0x10000 + 0x10f0, 0x15000)
  m.setU32(0x10000 + 0x10f4, 0x14500)
  m.setU32(0x14500 + 0x08, 1)
  m.setU32(0x14500 + 0x0c, 0x14600)
  m.setU32(0x14600, 0x14700)
  m.setU32(0x14604, 0x60)
  m.setU32(0x10000 + 0x1d24, 0x20000)
  m.setU32(0x20000 + 4, 0x20100)
  return m
}

const ALL_41_R1_VAS = [
  'D2Game:0x6FC566A0',
  'D2Game:0x6FC566C0',
  'D2Game:0x6FC60EB0',
  'D2Game:0x6FC63D40',
  'D2Game:0x6FC66560',
  'D2Game:0x6FC66720',
  'D2Game:0x6FC668A0',
  'D2Game:0x6FC6B7F0',
  'D2Game:0x6FC6D710',
  'D2Game:0x6FC6D8C0',
  'D2Game:0x6FC70E60',
  'D2Game:0x6FC70FE0',
  'D2Game:0x6FC71540',
  'D2Game:0x6FC71750',
  'D2Game:0x6FC718B0',
  'D2Game:0x6FC7C9E0',
  'D2Game:0x6FC7F5E0',
  'D2Game:0x6FC86960',
  'D2Game:0x6FC86CE0',
  'D2Game:0x6FC87000',
  'D2Game:0x6FC88920',
  'D2Game:0x6FC92FC0',
  'D2Game:0x6FC93D90',
  'D2Game:0x6FC98FA0',
  'D2Game:0x6FCB5980',
  'D2Game:0x6FCB5D50',
  'D2Game:0x6FCDAA50',
  'D2Game:0x6FCDB550',
  'D2Game:0x6FCDF1C0',
  'D2Game:0x6FCDF200',
  'D2Game:0x6FCDF2E0',
  'D2Game:0x6FCE1890',
  'D2Game:0x6FCE7D00',
  'D2Game:0x6FCEF270',
  'D2Game:0x6FCEF2F0',
  'D2Game:0x6FCEF570',
  'D2Game:0x6FCF0D30',
  'D2Game:0x6FCF1010',
  'D2Game:0x6FCF1200',
  'D2Game:0x6FCF8310',
  'D2Game:0x6FD087E0',
] as const

describe('K2 Remediation Lane R1 (41 D2Game VAs in k2-w14b1-113c.ts — zero unbacked hooks)', () => {
  it('traces all 41 remediated D2Game VAs with zero callback overrides', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    const pQuestFlags = 0x12800
    const pQuestData = 0x14000
    const pQuestExt = 0x14100
    const pQuestArg = 0x14200
    const pNpcControl = 0x15000
    const pNpc = 0x15200
    const pPacket = 0x16000

    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x2c, 0x12600)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pQuestFlags, 0x12900)
    m.setU32(pQuestFlags + 4, 0x60)
    m.setU32(pQuestData + 0x18, pQuestExt)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU16(pQuestArg + 0x14, 0x3ff)

    beginVaTrace113c()
    try {
      QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c(m, pGame, pPlayer, 0x20747368)
      m.setU16(0x12900 + 0x17 * 2, 1)
      ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c(m, pGame, pPlayer, 0x66)
      MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c(m, pGame, 0)
      SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c(m, pGame, pPlayer, -1, 1)
      SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c(m, pGame, pPlayer, -1, 1)
      SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c(m, pGame, pPlayer, -1, 1)
      SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c(m, pGame, pPlayer, -1, 1)
      CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c(m, 99, pGame, 0)
      SKILLS_SrvDo_SummonDecoy_6FC6D710_113c(m, pGame, pPlayer, -1, 1)
      SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c(m, pGame, pPlayer, -1, 1)
      SKILLS_SpawnBoneWallSegment_6FC70E60_113c(m, 0, pGame, pPlayer, 100, 100, 1)
      SKILLS_SrvDo_BoneWall_6FC70FE0_113c(m, pGame, pPlayer, 1, 1)
      SKILLS_SrvDo_IronGolem_6FC71540_113c(m, pGame, pPlayer, 1, 1)
      SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c(m, pGame, pPlayer, 0, 1)
      SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c(m, pGame, pPlayer, 1, 1)
      ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c(m, pQuestData, pQuestArg)
      ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c(m, pQuestData, pQuestArg)
      ACT1Q3_OnNpcInitCainSearch_6FC86960_113c(m, pQuestData, pQuestArg)
      ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c(m, pQuestData, pQuestArg)
      ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c(m, pQuestData, pQuestArg)
      ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c(m, pQuestData, pQuestArg)
      CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c(m, pGame, 0)

      const pPlayer2 = 0x12200
      const pData2 = 0x12500
      m.setU32(pPlayer2 + 0x14, pData2)
      m.setU32(pPlayerData + 0x5c, 0x12a00)
      m.setU32(pData2 + 0x5c, 0x12b00)
      m.setU16(0x12c00, 0x4d4a)
      m.setU32(0x12a00 + 0x04, 0x12c00)
      m.setU32(0x12b00 + 0x04, 0x12c00)
      m.setU32(0x12a00 + 0x0c, 50)
      PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c(
        m,
        pPlayerData,
        pPlayer,
        pPlayer2,
        pGame,
        pData2,
      )

      PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c(m, pPlayer, pGame)
      SKILLS_SrvDo_Valkyrie_6FCB5980_113c(m, pGame, pPlayer, -1, 1)
      SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c(m, pPlayer, pGame, 100, 100, 0, 0, 1)
      ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c(m, pQuestData, pQuestArg)
      ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c(m, pQuestArg)

      m.setU32(pNpc + 0x04, 42)
      NPCTRADE_EnsureVendorInventoryGenerated_6FCDF1C0_113c(m, pNpcControl, pNpc, pGame, 0)
      NPCTRADE_InteractBuyItem_6FCDF200_113c(m, pGame, pPlayer, 55, 66, 0, 0, 100)
      NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c(m, pGame, pPlayer, pNpc, 0)
      NPCTRADE_InteractRepairItem_6FCE1890_113c(m, pGame, pPlayer, 55, 66)
      ACT2Q2_CleanupHoradricStaffItemsOnEnterAct1_6FCE7D00_113c(m, pGame, pPlayer, 0)
      C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c(m, pGame, pPlayer, pPacket, 4)
      C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c(m, pGame, pPlayer, pPacket, 4)
      C2S_Packet32_NpcBuyItem_6FCEF570_113c(m, pGame, pPlayer, pPacket, 4)
      C2S_Packet49_WaypointInteract_6FCF0D30_113c(m, pGame, pPlayer, pPacket, 4)
      C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c(m, pGame, pPlayer, pPacket, 4)
      C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c(m, pGame, pPlayer, pPacket, 4)
      ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, 77, pGame, pPlayer)
      ACT3Q3_CleanupKhalimItemsOnEnterAct2OrComplete_6FD087E0_113c(m, pGame, pPlayer, 0)

      const hits = endVaTrace113c()
      for (const va of ALL_41_R1_VAS) {
        expect(hits.has(va), `Expected ${va} to be hit`).toBe(true)
      }
    } finally {
      endVaTrace113c()
    }
  })

  it('executes real D2Game_6FC93BA0_113c trade cancel when gold does not fit (no onCancelTrade hook)', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pPlayer1 = 0x12000
    const pPlayer2 = 0x12200
    const pData1 = 0x12400
    const pData2 = 0x12600
    m.setU32(pPlayer1, 0)
    m.setU32(pPlayer2, 0)
    m.setU32(pPlayer1 + 0x14, pData1)
    m.setU32(pPlayer2 + 0x14, pData2)
    m.setU32(pData1 + 0x5c, 0x12800)
    m.setU32(pData2 + 0x5c, 0x12900)
    m.setU16(0x12c00, 0x4d4a)
    m.setU32(0x12800 + 0x04, 0x12c00)
    m.setU32(0x12900 + 0x04, 0x12c00)
    m.setU32(0x12800 + 0x0c, 250)

    beginVaTrace113c()
    PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c(m, pData1, pPlayer1, pPlayer2, pGame, pData2)
    const hits = endVaTrace113c()

    expect(hits.has('D2Game:0x6FC93D90')).toBe(true)
    expect(hits.has('D2Game:0x6FC93BA0')).toBe(true)
    expect((m.u32(pPlayer1 + 0xc8) & 0x800000) !== 0).toBe(true)
    expect((m.u32(pPlayer2 + 0xc8) & 0x800000) !== 0).toBe(true)
  })

  it('executes real D2Game_6FCDE640_113c, D2Game_6FCE1510_113c, and D2Game_6FCDF990_113c on NPC vendor interaction', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    const pNpc = 0x15200
    const npcGuid = 7
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pNpc, 1)
    m.setU32(pNpc + 0x04, 0x93)
    m.setU32(pNpc + 0x0c, npcGuid)
    m.setU32(pGame + 0x1320 + (npcGuid & 0x7f) * 4, pNpc)
    m.setU32(pPlayer + 0x64, npcGuid)
    m.setU32(pPlayer + 0x68, 1)
    m.setU8(pPlayer + 0x6c, 1)

    const pPacket = 0x16000
    m.setU8(pPacket, 0x32)
    m.setU32(pPacket + 1, npcGuid)
    m.setU32(pPacket + 5, 999)
    m.setU16(pPacket + 9, 0)
    m.setU32(pPacket + 0x0d, 100)

    beginVaTrace113c()
    NPCTRADE_InteractBuyItem_6FCDF200_113c(m, pGame, pPlayer, npcGuid, 999, 0, 0, 100)
    NPCTRADE_InteractRepairItem_6FCE1890_113c(m, pGame, pPlayer, npcGuid, 1)
    const buyRet = C2S_Packet32_NpcBuyItem_6FCEF570_113c(m, pGame, pPlayer, pPacket, 0x11)
    const hits = endVaTrace113c()

    expect(buyRet).toBe(1)
    expect(hits.has('D2Game:0x6FCDF200')).toBe(true)
    expect(hits.has('D2Game:0x6FCDE640')).toBe(true)
    expect(hits.has('D2Game:0x6FCE1890')).toBe(true)
    expect(hits.has('D2Game:0x6FCE1510')).toBe(true)
    expect(hits.has('D2Game:0x6FCEF570')).toBe(true)
    expect(hits.has('D2Game:0x6FCDF990')).toBe(true)
  })

  it('executes real ACT1Q2_ActivateOrChainQuest_6FC84E10_113c via +0xf0 pfSeqFilter and QUESTS_GuidListAdd113c in 0x6FC88920', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pPlayer = 0x12000
    const pPlayerData = 0x12400
    const pQuestFlags = 0x12800
    const pQuestData = 0x14000
    const pQuestExt = 0x14100
    const pQuestArg = 0x14200

    const pClient = 0x18000
    m.setU32(pClient + 0x1a8, pGame)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 0x44)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pPlayerData + 0x9c, pClient)
    m.setU32(pQuestFlags, 0x12900)
    m.setU32(pQuestFlags + 4, 0x60)

    const qId = 2
    m.setU16(0x12900 + qId * 2, (1 << 1) | (1 << 0x0d))

    m.setU32(pQuestData + 0x04, pGame)
    m.setU8(pQuestData + 0x0c, 3)
    m.setU32(pQuestData + 0x18, pQuestExt)
    m.setU32(pQuestData + 0xe0, qId)
    m.setU32(pQuestData + 0xf0, 0x6fc84e10)

    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU16(pQuestArg + 0x14, 0x96)
    m.setU16(pQuestArg + 0x18, 0x5c)

    beginVaTrace113c()
    ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c(m, pQuestData, pQuestArg)
    const hits = endVaTrace113c()

    expect(hits.has('D2Game:0x6FC88920')).toBe(true)
    expect(hits.has('D2Game:0x6FC84E10')).toBe(true)
    expect(hits.has('D2Game:0x6FC53880')).toBe(true)
    expect(hits.has('D2Game:0x6FCE1030')).toBe(true)
    expect(m.u8(pQuestData + 0x0b)).toBe(0x0d)
  })
})
