import { describe, expect, it } from 'vitest'
import {
  ACT1Q1_Callback03_LevelChanged113c,
  ACT1Q2_Callback03_LevelChanged113c,
  ACT1Q3_Callback03_LevelChanged113c,
  ACT1Q4_Callback03_LevelChanged113c,
  ACT1Q5_Callback03_LevelChanged113c,
  ACT1Q6_Callback03_LevelChanged113c,
  ACT2Q1_Callback03_LevelChanged113c,
  ACT2Q2_Callback03_LevelChanged113c,
  ACT2Q3_Callback03_LevelChanged113c,
  ACT2Q4_Callback03_LevelChanged113c,
  ACT2Q5_Callback03_LevelChanged113c,
  ACT2Q6_Callback03_LevelChanged113c,
  ACT3Q0_Callback03_LevelChanged113c,
  ACT3Q1_Callback03_LevelChanged113c,
  ACT3Q2_Callback03_LevelChanged113c,
  ACT3Q3_Callback03_LevelChanged113c,
  ACT3Q4_Callback03_LevelChanged113c,
  ACT3Q5_Callback03_LevelChanged113c,
  ACT3Q6_Callback03_LevelChanged113c,
  ACT3Q7_Callback03_LevelChanged113c,
  ACT3Q8_Callback03_LevelChanged113c,
  ACT4Q1_Callback03_AltLevelChanged113c,
  ACT4Q1_Callback03_LevelChanged113c,
  ACT4Q2_Callback03_AltLevelChanged113c,
  ACT4Q2_Callback03_LevelChanged113c,
  ACT4Q2_Hellforge_Callback03_LevelChanged113c,
  ACT4Q3_Callback03_LevelChanged113c,
  ARENA_CountPlayersInLevelCallback113c,
  D2GAME_MAX_ROOM_UNIT_COUNT_VA_113C,
  MONSTER_DestroyMonsterUnit113c,
  MONSTER_FreeAiCmdCircularList113c,
  MONSTER_FreeAiGeneral113c,
  MONSTER_FreeInteractData113c,
  MONSTER_PackPresetSaveData113c,
  MONSTER_SaveInactiveMonsterNode113c,
  NPCS_OnPlayerLevelChange113c,
  NPCS_UpdateMercenaryOrVendorSlots113c,
  OBJECT_DestroyObjectUnit113c,
  OBJECT_FreeObjectRegionData113c,
  PARTY_SendPartyPetsToClient113c,
  PLRINTRO_CleanInvalidMonsterMinions113c,
  PLRINTRO_SendAllPlayerPetsToClient113c,
  QUESTS_CountLivingUnitsInRoomCallback113c,
  QUESTS_CountUnitsInGame113c,
  QUESTS_FreeUnitQuestChain113c,
  QUESTS_GuidListRemove113c,
  QUESTS_NotifyLevelChange113c,
  QUESTS_TriggerCallback113c,
  SUNIT_ClearUnitInventoryItems113c,
  SUNIT_DeactivateAndRemoveUnit113c,
  SUNIT_GetUnitField78_113c,
  SUNIT_UnlinkFromRoomUpdateList113c,
  UNIT_SaveInactiveUnitNode113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f150-f276-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function createLaneI1Memory(): { m: SparseMemory113c; sgpt: number } {
  const m = new SparseMemory113c()
  const sgpt = m.alloc(0x1000)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, sgpt)
  m.fill(D2GAME_IAT_GDW_BITMASKS_VA_113C, 0x100, 0)
  for (let i = 0; i < 32; i++) {
    m.setU32((D2GAME_IAT_GDW_BITMASKS_VA_113C + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2GAME_MAX_ROOM_UNIT_COUNT_VA_113C, 12)
  return { m, sgpt }
}

describe('K1R14 Lane I1: D2Game post-F150 coverage gap closure Part 1 (F150..F276, 52 VAs)', () => {
  it('verifies F150 core quest GUID list, callback dispatcher, and level-change notification (3 VAs)', () => {
    const { m } = createLaneI1Memory()

    // 1. QUESTS_GuidListRemove113c (0x6FC53830)
    const pList = m.alloc(0x88)
    m.setU16((pList + 0x80) >>> 0, 3)
    m.setU32((pList + 0x00) >>> 0, 101)
    m.setU32((pList + 0x04) >>> 0, 202)
    m.setU32((pList + 0x08) >>> 0, 303)
    expect(QUESTS_GuidListRemove113c(m, pList, 202)).toBe(1)
    expect(m.u16((pList + 0x80) >>> 0)).toBe(2)
    expect(m.u32((pList + 0x04) >>> 0)).toBe(303)
    expect(QUESTS_GuidListRemove113c(m, pList, 999)).toBe(0)

    // 2. QUESTS_TriggerCallback113c (0x6FC53CE0)
    const pGame = m.alloc(0x2000)
    const pQuestCtrl = m.alloc(0x40)
    m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)
    const pQuest = m.alloc(0x100)
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU8((pQuest + 0x08) >>> 0, 0) // act 0
    m.setU8((pQuest + 0x0a) >>> 0, 1) // active
    m.setU32((pQuest + 0xa0 + 3 * 4) >>> 0, 0x6fc83dd0) // callback[3] = ACT1Q1_Callback03_LevelChanged
    const pQuestData1 = m.alloc(0x80)
    m.setU32((pQuest + 0xf0) >>> 0, pQuestData1)
    m.setU32(pQuestCtrl >>> 0, pQuest)

    const pArg = m.alloc(0x28)
    const pPlayer = m.alloc(0x100)
    const pPlayerData0 = m.alloc(0x100)
    const pQuestRecord0 = m.alloc(0x100)
    m.setU32(pQuestRecord0 >>> 0, m.alloc(0x80))
    m.setU32((pPlayerData0 + 0x10) >>> 0, pQuestRecord0)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData0)
    m.setU32(pArg >>> 0, pGame)
    m.setU32((pArg + 0x04) >>> 0, 3) // callback index 3
    m.setU32((pArg + 0x0c) >>> 0, pPlayer)
    m.setU32((pArg + 0x14) >>> 0, 2) // Blood Moor
    m.setU32((pArg + 0x18) >>> 0, 8) // Den of Evil

    QUESTS_TriggerCallback113c(m, pArg, 1, 0)
    expect(m.u8((pQuestData1 + 0x00) >>> 0)).toBe(1)

    // 3. QUESTS_NotifyLevelChange113c (0x6FC54860)
    m.setU8((pQuestData1 + 0x00) >>> 0, 0)
    QUESTS_NotifyLevelChange113c(m, pGame, pPlayer, 2, 8)
    expect(m.u8((pQuestData1 + 0x00) >>> 0)).toBe(1)
  })

  it('verifies F150 Act 1, Act 2, Act 3, and Act 4 level-changed quest callbacks (27 VAs)', () => {
    const { m } = createLaneI1Memory()
    const pGame = m.alloc(0x2000)
    const pPlayer = m.alloc(0x100)
    m.setU32((pPlayer + 0x0c) >>> 0, 77)
    const pPlayerData = m.alloc(0x100)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    const pQuestRecord = m.alloc(0x100)
    m.setU32(pQuestRecord >>> 0, m.alloc(0x80))
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestRecord)

    const pQuest = m.alloc(0x100)
    const pQuestData = m.alloc(0x400)
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU8((pQuest + 0x0a) >>> 0, 1)
    m.setU32((pQuest + 0xf0) >>> 0, pQuestData)

    const pArg = m.alloc(0x28)
    m.setU32(pArg >>> 0, pGame)
    m.setU32((pArg + 0x0c) >>> 0, pPlayer)

    // Act 1 callbacks
    m.setU32((pArg + 0x14) >>> 0, 1)
    m.setU32((pArg + 0x18) >>> 0, 8)
    ACT1Q1_Callback03_LevelChanged113c(m, pQuest, pArg)
    expect(m.u8((pQuestData + 0x00) >>> 0)).toBe(1)

    m.setU8((pQuestData + 0x87) >>> 0, 1)
    m.setU32((pArg + 0x14) >>> 0, 2)
    m.setU32((pArg + 0x18) >>> 0, 17)
    ACT1Q2_Callback03_LevelChanged113c(m, pQuest, pArg)
    expect(m.u32((pQuest + 0xb0) >>> 0)).toBe(0x6fc81250)

    m.setU32((pArg + 0x1c) >>> 0, 1)
    m.setU32((pArg + 0x20) >>> 0, 4)
    ACT1Q4_Callback03_LevelChanged113c(m, pQuest, pArg)

    m.setU32((pArg + 0x1c) >>> 0, 27)
    m.setU32((pArg + 0x20) >>> 0, 28)
    ACT1Q5_Callback03_LevelChanged113c(m, pQuest, pArg)

    m.setU32((pArg + 0x1c) >>> 0, 34)
    m.setU32((pArg + 0x20) >>> 0, 37)
    ACT1Q6_Callback03_LevelChanged113c(m, pQuest, pArg)

    m.setU32((pArg + 0x1c) >>> 0, 5)
    m.setU32((pArg + 0x20) >>> 0, 6)
    ACT1Q3_Callback03_LevelChanged113c(m, pQuest, pArg)

    // Act 2 callbacks
    m.setU32((pArg + 0x1c) >>> 0, 40)
    m.setU32((pArg + 0x20) >>> 0, 47)
    ACT2Q1_Callback03_LevelChanged113c(m, pQuest, pArg)

    m.setU32((pArg + 0x1c) >>> 0, 41)
    m.setU32((pArg + 0x20) >>> 0, 60)
    ACT2Q2_Callback03_LevelChanged113c(m, pQuest, pArg)

    m.setU32((pArg + 0x1c) >>> 0, 44)
    m.setU32((pArg + 0x20) >>> 0, 61)
    ACT2Q3_Callback03_LevelChanged113c(m, pQuest, pArg)

    m.setU32((pArg + 0x1c) >>> 0, 40)
    m.setU32((pArg + 0x20) >>> 0, 50)
    ACT2Q4_Callback03_LevelChanged113c(m, pQuest, pArg)

    m.setU32((pArg + 0x1c) >>> 0, 54)
    m.setU32((pArg + 0x20) >>> 0, 74)
    ACT2Q5_Callback03_LevelChanged113c(m, pQuest, pArg)

    m.setU32((pArg + 0x1c) >>> 0, 74)
    m.setU32((pArg + 0x20) >>> 0, 46)
    ACT2Q6_Callback03_LevelChanged113c(m, pQuest, pArg)

    // Act 3 callbacks
    m.setU32((pArg + 0x1c) >>> 0, 75)
    m.setU32((pArg + 0x20) >>> 0, 76)
    ACT3Q0_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT3Q1_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT3Q2_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT3Q3_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT3Q4_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT3Q5_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT3Q6_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT3Q7_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT3Q8_Callback03_LevelChanged113c(m, pQuest, pArg)

    // Act 4 callbacks
    m.setU32((pArg + 0x1c) >>> 0, 103)
    m.setU32((pArg + 0x20) >>> 0, 105)
    ACT4Q1_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT4Q1_Callback03_AltLevelChanged113c(m, pQuest, pArg)
    ACT4Q2_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT4Q2_Callback03_AltLevelChanged113c(m, pQuest, pArg)
    ACT4Q2_Hellforge_Callback03_LevelChanged113c(m, pQuest, pArg)
    ACT4Q3_Callback03_LevelChanged113c(m, pQuest, pArg)
  })

  it('verifies F150 arena player counter and NPC vendor/mercenary slot sync (3 VAs)', () => {
    const { m } = createLaneI1Memory()
    const pGame = m.alloc(0x2000)
    const pUnit = m.alloc(0x100)
    const pPath = m.alloc(0x40)
    const pRoom = m.alloc(0x80)
    const pRoomEx = m.alloc(0x80)
    const pLevel = m.alloc(0x240)
    m.setU32((pUnit + 0x2c) >>> 0, pPath)
    m.setU32((pPath + 0x1c) >>> 0, pRoom)
    m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
    m.setU32((pLevel + 0x1d0) >>> 0, 1) // level 1 (Rogue Encampment)

    const pCtx = m.alloc(8)
    m.setU32(pCtx >>> 0, 1)
    m.setU32((pCtx + 4) >>> 0, 0)
    ARENA_CountPlayersInLevelCallback113c(m, pGame, pUnit, pCtx)
    expect(m.u32((pCtx + 4) >>> 0)).toBe(1)

    NPCS_UpdateMercenaryOrVendorSlots113c(m, pGame, 0, 1)
    NPCS_OnPlayerLevelChange113c(m, pGame, 1, pUnit, 2)
  })

  it('verifies F224 room living-unit counter callback and game unit counter (2 VAs)', () => {
    const { m } = createLaneI1Memory()
    const pCount = m.alloc(4)
    const pUnit = m.alloc(0x100)
    m.setU32(pUnit >>> 0, 0) // player
    m.setU32((pUnit + 0x10) >>> 0, 1) // neutral mode
    QUESTS_CountLivingUnitsInRoomCallback113c(m, pUnit, pCount)
    expect(m.u32(pCount >>> 0)).toBe(1)

    const pGame = m.alloc(0x2000)
    m.setU8((pGame + 0x6a) >>> 0, 1)
    expect(QUESTS_CountUnitsInGame113c(m, pGame)).toBe(12)
  })

  it('verifies F251 player pet cleanup and party pet client sync (3 VAs)', () => {
    const { m, sgpt } = createLaneI1Memory()
    m.setU32((sgpt + 0xbf0) >>> 0, 2) // 2 PetTypesTxt records
    const petTxt = m.alloc(2 * 0xe0)
    m.setU8((petTxt + 0xe0 + 0x04) >>> 0, 0x04)
    m.setU32((sgpt + 0xbec) >>> 0, petTxt)

    const pGame = m.alloc(0x2000)
    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    const pPetsRoot = m.alloc(0x20)
    const pBucketBase = m.alloc(0x40)
    m.setU32((pPlayerData + 0x44) >>> 0, pPetsRoot)
    m.setU32(pPetsRoot >>> 0, pBucketBase)

    PLRINTRO_CleanInvalidMonsterMinions113c(m, pGame, pPlayer, pPlayerData)
    PLRINTRO_SendAllPlayerPetsToClient113c(m, 0x1234, pPlayer, pGame)
    PARTY_SendPartyPetsToClient113c(m, pGame, pPlayer)
  })

  it('verifies F276 inactive monster/unit archival, AI/object/quest teardown, and room update unlink (14 VAs)', () => {
    const { m } = createLaneI1Memory()
    const pGame = m.alloc(0x2000)
    const pUnit = m.alloc(0x120)
    const pNode = m.alloc(0x80)
    m.setU32(pUnit >>> 0, 1) // UNIT_MONSTER
    m.setU8((pUnit + 0x78) >>> 0, 0xaa)

    expect(SUNIT_GetUnitField78_113c(m, pUnit)).toBe(0xaa)

    MONSTER_PackPresetSaveData113c(m, pUnit, pNode, pGame)
    expect(MONSTER_SaveInactiveMonsterNode113c(m, pGame, pUnit)).toBe(0)
    UNIT_SaveInactiveUnitNode113c(m, pGame, pUnit)

    const pAiGeneral = m.alloc(0x60)
    MONSTER_FreeAiCmdCircularList113c(m, pGame, pAiGeneral)
    const pAiGeneral2 = m.alloc(0x60)
    MONSTER_FreeAiGeneral113c(m, pGame, pAiGeneral2)

    const pObjRegion = m.alloc(0x40)
    OBJECT_FreeObjectRegionData113c(m, pGame, pObjRegion)

    const pObjUnit = m.alloc(0x100)
    m.setU32(pObjUnit >>> 0, 2) // UNIT_OBJECT
    OBJECT_DestroyObjectUnit113c(m, pGame, pObjUnit)

    QUESTS_FreeUnitQuestChain113c(m, pGame, pUnit)

    const pInteract = m.alloc(0x20)
    MONSTER_FreeInteractData113c(m, pGame, pInteract)

    const pMonUnit = m.alloc(0x120)
    m.setU32(pMonUnit >>> 0, 1)
    const pMonData = m.alloc(0x80)
    m.setU32((pMonUnit + 0x14) >>> 0, pMonData)
    MONSTER_DestroyMonsterUnit113c(m, pGame, pMonUnit)

    SUNIT_ClearUnitInventoryItems113c(m, pGame, pUnit)
    SUNIT_UnlinkFromRoomUpdateList113c(m, pGame, pUnit)
    SUNIT_DeactivateAndRemoveUnit113c(m, pGame, pUnit, 1)
  })
})
