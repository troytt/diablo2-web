import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import { QUESTRECORD_SetQuestState113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  QUESTS_GuidListAdd113c,
  QUESTS_GuidListContains113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts'
import {
  ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c,
  ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c,
  ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c,
  ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c,
  ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c,
  ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c,
  ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c,
  ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c,
  ACT1Q4_InitCainGibbetObject_6FC814A0_113c,
  ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c,
  ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c,
  ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c,
  ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c,
  ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c,
  ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c,
  ACT1Q5_Callback14_PlayerJoinedWithMalus_6FC81C00_113c,
  ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c,
  ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c,
  ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c,
  ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c,
  ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c,
  ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c,
  ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c,
  ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c,
  OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c,
  OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c,
  OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c,
  OBJECTS_GrantUnitDexterity_6FC896F0_113c,
  OBJECTS_GrantUnitEnergy_6FC89710_113c,
  OBJECTS_GrantUnitSkillPoints_6FC89650_113c,
  OBJECTS_GrantUnitStrength_6FC896B0_113c,
  OBJECTS_GrantUnitVitality_6FC896D0_113c,
  OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c,
  OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c,
  OBJECTS_OperateToggleObjectMode012_6FC89A80_113c,
  QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c,
  QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c,
  QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c,
  QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c,
  QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c,
  SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c,
  SHRINES_ApplyHealthExchangeEffect_6FC89800_113c,
  SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c,
  SHRINES_ApplyManaExchangeEffect_6FC897A0_113c,
  SHRINES_ApplyManaRechargeEffect_6FC89860_113c,
} from '../../../src/d2kern-113c/game/k2-w2b2-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function createPlayerWithQuestFlags(m: SparseMemory113c, nDiff = 0): {
  pGame: number
  pPlayer: number
  pPlayerData: number
  pQuestFlags: number
  pQuestBuf: number
  pClient: number
  pQueue: number
} {
  const pGame = m.alloc(0x1e00)
  m.setU8(pGame + 0x6d, nDiff & 0xff)

  const pPlayer = m.alloc(0x100)
  m.setU32(pPlayer + 0x00, 0) // UNIT_PLAYER
  m.setU32(pPlayer + 0x0c, 0x1234) // dwUnitId

  const pPlayerData = m.alloc(0x100)
  m.setU32(pPlayer + 0x14, pPlayerData)

  const pQuestFlags = m.alloc(0x10)
  const pQuestBuf = m.alloc(0x100)
  m.setU32(pQuestFlags, pQuestBuf)
  m.setU32(pPlayerData + 0x10 + nDiff * 4, pQuestFlags)

  const pClient = m.alloc(0x200)
  const pQueue = m.alloc(0x400)
  m.setU32(pClient + 0x1bc, pQueue)
  m.setU32(pPlayerData + 0x9c, pClient)

  return { pGame, pPlayer, pPlayerData, pQuestFlags, pQuestBuf, pClient, pQueue }
}

function attachPlayerRoomLevel(m: SparseMemory113c, pPlayer: number, nLevelId: number): number {
  const pPath = m.alloc(0x40)
  const pRoom1 = m.alloc(0x80)
  const pRoom2 = m.alloc(0x80)
  const pLevel = m.alloc(0x200)
  m.setU32(pPlayer + 0x2c, pPath)
  m.setU32(pPath + 0x1c, pRoom1)
  m.setU32(pRoom1 + 0x10, pRoom2)
  m.setU32(pRoom2 + 0x58, pLevel)
  m.setU32(pLevel + 0x1d0, nLevelId >>> 0)
  return pRoom1
}

function linkQuestInGame(m: SparseMemory113c, pGame: number, nQuestId: number): {
  pQuest: number
  pQuestDataEx: number
} {
  let pChain = m.u32(pGame + 0x10f4)
  if (pChain === 0) {
    pChain = m.alloc(0x10)
    m.setU32(pGame + 0x10f4, pChain)
  }
  const pQuest = m.alloc(0x120)
  const pQuestDataEx = m.alloc(0x200)
  m.setU32(pQuest + 0x00, nQuestId >>> 0)
  m.setU32(pQuest + 0x04, pGame)
  m.setU32(pQuest + 0x18, pQuestDataEx)
  m.setU32(pQuest + 0xe0, nQuestId >>> 0)
  m.setU32(pQuest + 0xf4, m.u32(pChain))
  m.setU32(pChain, pQuest)
  return { pQuest, pQuestDataEx }
}

function setupUnitStatListAndTables(m: SparseMemory113c, pUnit: number): number {
  const pStatList = m.alloc(0x80)
  m.setU32(pUnit + 0x5c, pStatList)
  m.setU32(pStatList + 0x08, m.u32(pUnit))

  const sgpt = m.alloc(0x1000)
  const iscTable = m.alloc(360 * 0x144)
  m.setU32(0x6fde9e1c, sgpt)
  m.setU32(sgpt + 0xbd4, 359)
  m.setU32(sgpt + 0xbcc, iscTable)

  const bitMasks = m.alloc(32 * 4)
  for (let i = 0; i < 32; i++) {
    m.setU32(bitMasks + i * 4, (1 << i) >>> 0)
  }
  m.setU32(0x6fdd90b0, bitMasks)
  return pStatList
}

describe('k2-w2b2-113c oracle tests (45 D2Game.dll functions)', () => {
  it('ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c removes player GUID from quest and 3 ex lists', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m)
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 6)
    m.setU16(pQuest + 0x9c, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 0)

    const guid = m.u32(pPlayer + 0x0c)
    QUESTS_GuidListAdd113c(m, pQuest + 0x1c, guid)
    QUESTS_GuidListAdd113c(m, pQuestDataEx, guid)
    QUESTS_GuidListAdd113c(m, pQuestDataEx + 0x84, guid)
    QUESTS_GuidListAdd113c(m, pQuestDataEx + 0x108, guid)

    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 0x0c, pPlayer)

    ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c(m, pQuest, pQuestArg)

    expect(QUESTS_GuidListContains113c(m, pQuest + 0x1c, guid)).toBe(0)
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx, guid)).toBe(0)
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx + 0x84, guid)).toBe(0)
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx + 0x108, guid)).toBe(0)
  })

  it('ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c asserts on missing quest 5 and sets mode 3 when inactive', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x1200)
    const pObject = m.alloc(0x100)
    m.setU32(pObject, 2)
    m.setU32(pObject + 0x2c, m.alloc(0x20))
    const pObjInit = m.alloc(0x20)
    m.setU32(pObjInit + 0x00, pGame)
    m.setU32(pObjInit + 0x04, pObject)

    expect(() => ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c(m, pObjInit)).toThrow(D2CommonAssertError)

    const { pQuest } = linkQuestInGame(m, pGame, 5)
    m.setU8(pQuest + 0x09, 1)
    ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c(m, pObjInit)
    expect(m.u32(pObject + 0x10)).toBe(0)

    m.setU8(pQuest + 0x09, 0)
    ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c(m, pObjInit)
    expect(m.u32(pObject + 0x10)).toBe(3)
  })

  it('ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c sets states 0x0D and 0 only for Act 1 players', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m)
    attachPlayerRoomLevel(m, pPlayer, 40) // Act 2 -> ignored
    ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0)).toBe(0)

    attachPlayerRoomLevel(m, pPlayer, 1) // Act 1 -> sets 0x0d and 0
    ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0x0d)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0)).toBe(1)
  })

  it('ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c removes GUID from pQuestDataEx + 0xB4', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer } = createPlayerWithQuestFlags(m)
    const { pQuestDataEx } = linkQuestInGame(m, pGame, 4)
    const guid = m.u32(pPlayer + 0x0c)
    QUESTS_GuidListAdd113c(m, pQuestDataEx + 0xb4, guid)
    QUESTS_GuidListAdd113c(m, pQuestDataEx + 0xb4, 0xffffffff)

    ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c(m, pGame, pPlayer)
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx + 0xb4, guid)).toBe(0)

    ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c(m, pGame, 0)
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx + 0xb4, 0xffffffff)).toBe(0)
  })

  it('ACT1Q4_InitCainGibbetObject_6FC814A0_113c handles missing and active quest 4 states', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x1200)
    const pObject = m.alloc(0x100)
    m.setU32(pObject, 2)
    m.setU32(pObject + 0x2c, m.alloc(0x20))
    const pObjInit = m.alloc(0x20)
    m.setU32(pObjInit + 0x00, pGame)
    m.setU32(pObjInit + 0x04, pObject)

    // No quest 4 -> sets object mode 2
    ACT1Q4_InitCainGibbetObject_6FC814A0_113c(m, pObjInit)
    expect(m.u32(pObject + 0x10)).toBe(2)

    // With quest 4 active and bActive == 0 -> sets pQuestDataEx + 0x47 = 1, +0x58 = 1, object mode = 1
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 4)
    m.setU8(pQuest + 0x09, 0)
    ACT1Q4_InitCainGibbetObject_6FC814A0_113c(m, pObjInit)
    expect(m.u8(pQuestDataEx + 0x47)).toBe(1)
    expect(m.u32(pQuestDataEx + 0x58)).toBe(1)
    expect(m.u32(pObject + 0x10)).toBe(1)
  })

  it('ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c sets quest 4 state 0x0A in Tristram (0x27)', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m)
    attachPlayerRoomLevel(m, pPlayer, 4) // Stony Field -> does not set
    expect(ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0x0a)).toBe(0)

    attachPlayerRoomLevel(m, pPlayer, 0x27) // Tristram -> sets state 0x0a
    expect(ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0x0a)).toBe(1)
  })

  it('ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c sets quest 4 state 4 for eligible Act 1 player', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m)
    attachPlayerRoomLevel(m, pPlayer, 40) // Act 2 -> ignored
    ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 4)).toBe(0)

    attachPlayerRoomLevel(m, pPlayer, 1) // Act 1 -> sets state 4
    ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 4)).toBe(1)
  })

  it('ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c stores object GUID or 0xFFFFFFFF', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x1200)
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 4)
    const pObject = m.alloc(0x40)
    m.setU32(pObject + 0x0c, 0x7788)

    ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c(m, pQuest, pObject)
    expect(m.u8(pQuestDataEx + 0x49)).toBe(1)
    expect(m.u32(pQuestDataEx + 0x28)).toBe(0x7788)

    ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c(m, pQuest, 0)
    expect(m.u32(pQuestDataEx + 0x28)).toBe(0xffffffff)
  })

  it('ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c removes player GUID from quest and +0xB4/+0x138 lists', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m)
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 4)
    m.setU16(pQuest + 0x9c, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 0)

    const guid = m.u32(pPlayer + 0x0c)
    QUESTS_GuidListAdd113c(m, pQuest + 0x1c, guid)
    QUESTS_GuidListAdd113c(m, pQuestDataEx + 0xb4, guid)
    QUESTS_GuidListAdd113c(m, pQuestDataEx + 0x138, guid)

    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 0x0c, pPlayer)

    ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c(m, pQuest, pQuestArg)
    expect(QUESTS_GuidListContains113c(m, pQuest + 0x1c, guid)).toBe(0)
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx + 0xb4, guid)).toBe(0)
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx + 0x138, guid)).toBe(0)
  })

  it('ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c and ACT1Q5 Malus inventory callbacks', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer } = createPlayerWithQuestFlags(m)
    const { pQuest: pQuest4, pQuestDataEx: pEx4 } = linkQuestInGame(m, pGame, 4)
    const { pQuest: pQuest3, pQuestDataEx: pEx3 } = linkQuestInGame(m, pGame, 3)

    // Seed ItemsTxt table at 0x6FDEFB94 / 0x6FDEFB98 with 3 records: 0='bkd ', 1='bks ', 2='hdm '
    const itemsTxt = m.alloc(3 * 0x1a8)
    m.setU32(0x6fdefb94, 3)
    m.setU32(0x6fdefb98, itemsTxt)
    m.setU32(itemsTxt + 0 * 0x1a8 + 0x80, 0x20646b62) // 'bkd '
    m.setU32(itemsTxt + 1 * 0x1a8 + 0x80, 0x20736b62) // 'bks '
    m.setU32(itemsTxt + 2 * 0x1a8 + 0x80, 0x206d6468) // 'hdm '

    // Attach inventory with cursor item 'bkd ' and linked items 'bks ' and 'hdm '
    const pInv = m.alloc(0x40)
    m.setU32(pInv, 0x01020304)
    m.setU32(pPlayer + 0x60, pInv)

    const makeItem = (classId: number, nextItem = 0): number => {
      const pItem = m.alloc(0x100)
      const pItemData = m.alloc(0x80)
      m.setU32(pItem + 0x00, 4)
      m.setU32(pItem + 0x04, classId)
      m.setU32(pItem + 0x14, pItemData)
      m.setU32(pItemData + 0x64, nextItem)
      return pItem
    }

    const itemHdm = makeItem(2, 0)
    const itemBks = makeItem(1, itemHdm)
    const itemBkd = makeItem(0, 0)
    m.setU32(pInv + 0x20, itemBkd) // cursor
    m.setU32(pInv + 0x0c, itemBks) // first item

    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 0x00, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)

    ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c(m, pQuest4, pQuestArg)
    expect(m.u32(pEx4 + 0x7c)).toBe(2)

    ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c(m, pGame, pPlayer)
    expect(m.u8(pEx3 + 0xa0)).toBe(1)

    m.setU8(pQuest3 + 0x09, 1)
    m.setU8(pQuest3 + 0x0c, 0)
    m.setU8(pEx3 + 0x01, 1)
    m.setU32(pEx3 + 0x98, 2)
    ACT1Q5_Callback14_PlayerJoinedWithMalus_6FC81C00_113c(m, pQuest3, pQuestArg)
    expect(m.u32(pEx3 + 0x9c)).toBe(1)
    expect(m.u8(pQuest3 + 0x0b)).toBe(2)
  })

  it('ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c removes player GUID from pQuestDataEx + 0x14', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer } = createPlayerWithQuestFlags(m)
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 5)
    const guid = m.u32(pPlayer + 0x0c)
    QUESTS_GuidListAdd113c(m, pQuestDataEx + 0x14, guid)

    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c(m, pQuest, pQuestArg)
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx + 0x14, guid)).toBe(0)
  })

  it('ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c grants quest 3 states 0x0D and 1 at level >= 8', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m)
    setupUnitStatListAndTables(m, pPlayer)

    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 7, 0)
    ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 1)).toBe(0)

    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 8, 0)
    ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 0x0d)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 1)).toBe(1)
  })

  it('QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c and ExGuidLists_6FC82170_113c', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer } = createPlayerWithQuestFlags(m)
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 1)
    const guid = m.u32(pPlayer + 0x0c)
    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 0x0c, pPlayer)

    QUESTS_GuidListAdd113c(m, pQuest + 0x1c, guid)
    QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c(m, pQuest, pQuestArg)
    expect(QUESTS_GuidListContains113c(m, pQuest + 0x1c, guid)).toBe(0)

    QUESTS_GuidListAdd113c(m, pQuest + 0x1c, guid)
    QUESTS_GuidListAdd113c(m, pQuestDataEx, guid)
    QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c(m, pQuest, pQuestArg)
    expect(QUESTS_GuidListContains113c(m, pQuest + 0x1c, guid)).toBe(0)
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx, guid)).toBe(0)
  })

  it('ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c and ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m)
    const { pQuest } = linkQuestInGame(m, pGame, 0)

    ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c(m, pPlayer, pGame)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x29, 0x0d)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x29, 1)).toBe(1)

    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU16(pQuestArg + 0x14, 0x9b)
    m.setU16(pQuestArg + 0x18, 2) // not 0 or 1 -> ignored
    ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c(m, pQuest, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0, 0)).toBe(0)

    m.setU16(pQuestArg + 0x18, 1)
    ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c(m, pQuest, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0, 0)).toBe(1)
  })

  it('ACT1Q6, ACT1Q3, ACT1Q4, ACT1Q2, ACT1Q1 SetCompletedBeforeAlertCallbacks and ACT1Q5_SendTowerTomeQuestAlert5D', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags, pQueue } = createPlayerWithQuestFlags(m)

    ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 0x0e)).toBe(1)
    expect(m.u8(pQueue + 0x04)).toBe(0x5d)
    expect(m.u8(pQueue + 0x05)).toBe(6)

    ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0x0e)).toBe(1)

    ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0x0e)).toBe(1)

    ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0x0e)).toBe(1)

    const usedBeforeQ1 = m.u32(pQueue + 0x00)
    ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 0x0e)).toBe(1)
    // Sends 6-byte 0x5D packet + 103-byte 0x28 packet
    expect(m.u32(pQueue + 0x00)).toBe(usedBeforeQ1 + 6 + 103)

    // Test ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c on a fresh client queue
    const { pPlayer: pPlayerTome, pQueue: pQueueTome } = createPlayerWithQuestFlags(m)
    ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c(m, pPlayerTome)
    expect(m.u32(pQueueTome + 0x00)).toBe(6)
    expect(m.u8(pQueueTome + 0x04)).toBe(0x5d)
    expect(m.u8(pQueueTome + 0x05)).toBe(4)
    expect(m.u8(pQueueTome + 0x06)).toBe(1)
  })

  it('ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c and ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m)
    m.setU32(pPlayer + 0x2c, m.alloc(0x30))

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 0x0d)
    ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c(m, pGame, pPlayer)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x21)
    expect(m.u32(pPlayer + 0x70)).toBe(pPlayer)
    expect(m.u32(pPlayer + 0xc4) & 0x400).toBe(0x400)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 1, 0x0d)
    ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c(m, pGame, pPlayer)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x23)
  })

  it('OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c sets object mode 1 and schedules event 7 at +25 frames', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x1e00)
    m.setU32(pGame + 0xa8, 100) // dwGameFrame
    EVENT_InitTimerQueue113c(m, pGame)

    const pObject = m.alloc(0x100)
    m.setU32(pObject + 0x00, 2) // UNIT_OBJECT
    m.setU32(pObject + 0x0c, 0x55)
    m.setU32(pObject + 0x2c, m.alloc(0x20))

    const pObjInit = m.alloc(0x20)
    m.setU32(pObjInit + 0x00, pGame)
    m.setU32(pObjInit + 0x04, pObject)

    OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c(m, pObjInit)
    expect(m.u32(pObject + 0x10)).toBe(1)
    expect(m.u32(pObject + 0xdc)).not.toBe(0) // pEventFirst attached
  })

  it('QUESTS_Set/Get/ClearPlayerNpcIntroFlag_6FC89490..0x6FC895F0_113c manage NPC intro flags', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pPlayerData } = createPlayerWithQuestFlags(m)
    const pIntroData = m.alloc(0x10)
    const pIntroHolder0 = m.alloc(0x10)
    const pIntroHolder1 = m.alloc(0x10)
    const pIntroBuf0 = m.alloc(0x20)
    const pIntroBuf1 = m.alloc(0x20)
    m.setU32(pIntroHolder0, pIntroBuf0)
    m.setU32(pIntroHolder1, pIntroBuf1)
    m.setU32(pIntroData + 0x00, pIntroHolder0)
    m.setU32(pIntroData + 0x04, pIntroHolder1)
    m.setU32(pPlayerData + 0x60, pIntroData)

    // Unknown NPC -> maps to bit 0 (clear)
    expect(QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer, 9999, pGame)).toBe(0)

    // NPC 148 (0x94 Akara, bit 2 -> mask 4)
    expect(QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer, 148, pGame)).toBe(0)
    QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(m, pPlayer, 148, pGame)
    expect(QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer, 148, pGame)).toBe(4)

    // Set and clear bit 2 in +0x04 buffer via QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c
    m.setU8(pIntroBuf1, 0xff)
    QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c(m, pPlayer, 148, pGame)
    expect(m.u8(pIntroBuf1) & 4).toBe(0)
  })

  it('OBJECTS_GrantUnit* and AddUnitMaxAndCurrentLife/ManaFixed8 (0x6FC89650..0x6FC89730) update unit stats', () => {
    const m = new SparseMemory113c()
    const pUnit = m.alloc(0x100)
    m.setU32(pUnit, 0)
    setupUnitStatListAndTables(m, pUnit)

    expect(OBJECTS_GrantUnitSkillPoints_6FC89650_113c(m, pUnit, 2)).toBe(1)
    expect(STATLIST_GetUnitBaseStat113c(m, pUnit, 5, 0)).toBe(2)

    expect(OBJECTS_GrantUnitStrength_6FC896B0_113c(m, 0, pUnit, 5)).toBe(1)
    expect(STATLIST_GetUnitBaseStat113c(m, pUnit, 0, 0)).toBe(5)

    expect(OBJECTS_GrantUnitVitality_6FC896D0_113c(m, pUnit, 4)).toBe(1)
    expect(STATLIST_GetUnitBaseStat113c(m, pUnit, 3, 0)).toBe(4)

    expect(OBJECTS_GrantUnitDexterity_6FC896F0_113c(m, pUnit, 3)).toBe(1)
    expect(STATLIST_GetUnitBaseStat113c(m, pUnit, 2, 0)).toBe(3)

    expect(OBJECTS_GrantUnitEnergy_6FC89710_113c(m, pUnit, 6)).toBe(1)
    expect(STATLIST_GetUnitBaseStat113c(m, pUnit, 1, 0)).toBe(6)

    STATLIST_SetUnitStat113c(m, pUnit, 6, 100 << 8, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 7, 100 << 8, 0)
    expect(OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c(m, pUnit, 20)).toBe(1)
    expect(STATLIST_GetUnitBaseStat113c(m, pUnit, 7, 0)).toBe(120 << 8)
    expect(STATLIST_GetUnitBaseStat113c(m, pUnit, 6, 0)).toBe(120 << 8)

    STATLIST_SetUnitStat113c(m, pUnit, 8, 50 << 8, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 9, 50 << 8, 0)
    expect(OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c(m, pUnit, 15)).toBe(1)
    expect(STATLIST_GetUnitBaseStat113c(m, pUnit, 9, 0)).toBe(65 << 8)
    expect(STATLIST_GetUnitBaseStat113c(m, pUnit, 8, 0)).toBe(65 << 8)
  })

  it('SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c reverses player name in-place and zeroes tail', () => {
    const m = new SparseMemory113c()
    const { pPlayer, pPlayerData } = createPlayerWithQuestFlags(m)
    const name = 'Deckard'
    for (let i = 0; i < name.length; i++) {
      m.setU8(pPlayerData + i, name.charCodeAt(i))
    }
    m.setU8(pPlayerData + name.length, 0)
    m.setU8(pPlayerData + 10, 0xaa)

    const pObjOperate = m.alloc(0x20)
    m.setU32(pObjOperate + 0x08, pPlayer)

    SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c(m, pObjOperate)
    let reversed = ''
    for (let i = 0; i < name.length; i++) {
      reversed += String.fromCharCode(m.u8(pPlayerData + i))
    }
    expect(reversed).toBe('drakceD')
    expect(m.u8(pPlayerData + 10)).toBe(0)
  })

  it('SHRINES_ApplyManaExchange/HealthExchange/ManaRecharge/HealthRecharge (0x6FC897A0..0x6FC898A0)', () => {
    const m = new SparseMemory113c()
    const pUnit = m.alloc(0x100)
    m.setU32(pUnit, 0)
    setupUnitStatListAndTables(m, pUnit)

    STATLIST_SetUnitStat113c(m, pUnit, 6, 100 << 8, 0) // hp
    STATLIST_SetUnitStat113c(m, pUnit, 7, 200 << 8, 0) // maxhp
    STATLIST_SetUnitStat113c(m, pUnit, 8, 40 << 8, 0) // mana
    STATLIST_SetUnitStat113c(m, pUnit, 9, 100 << 8, 0) // maxmana

    const pObjOperate = m.alloc(0x20)
    m.setU32(pObjOperate + 0x08, pUnit)
    const pShrinesTxt = m.alloc(0x20)
    m.setU32(pShrinesTxt + 0x04, 50) // arg0 = 50%
    m.setU32(pShrinesTxt + 0x08, 100) // arg1 = 100%

    SHRINES_ApplyManaExchangeEffect_6FC897A0_113c(m, pObjOperate, pShrinesTxt)
    expect(STATLIST_GetUnitStat113c(m, pUnit, 8, 0)).toBe(20 << 8)
    expect(STATLIST_GetUnitStat113c(m, pUnit, 6, 0)).toBe(120 << 8)

    SHRINES_ApplyHealthExchangeEffect_6FC89800_113c(m, pObjOperate, pShrinesTxt)
    expect(STATLIST_GetUnitStat113c(m, pUnit, 6, 0)).toBe(60 << 8)
    expect(STATLIST_GetUnitStat113c(m, pUnit, 8, 0)).toBe(80 << 8)

    SHRINES_ApplyManaRechargeEffect_6FC89860_113c(m, pObjOperate)
    expect(STATLIST_GetUnitStat113c(m, pUnit, 8, 0)).toBe(100 << 8)

    SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c(m, pObjOperate)
    expect(STATLIST_GetUnitStat113c(m, pUnit, 6, 0)).toBe(200 << 8)
  })

  it('OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c asserts on NULL inventory and finds matching item type', () => {
    const m = new SparseMemory113c()
    const pUnit = m.alloc(0x100)
    expect(() => OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c(m, pUnit, 5)).toThrow(D2CommonAssertError)

    setupUnitStatListAndTables(m, pUnit)
    const sgpt = m.u32(0x6fde9e1c)
    const pEquiv = m.alloc(0x40)
    m.setU32(sgpt + 0xbfc, 10) // nItemTypesTxtRecordCount
    m.setU32(sgpt + 0xc00, 1) // nItemTypesEquivDwords
    m.setU32(sgpt + 0xc04, pEquiv)
    m.setU32(pEquiv + 3 * 4, 1 << 5) // wType1 = 3 matches itemType = 5

    const itemsTxt = m.alloc(0x1a8)
    m.setU32(0x6fdefb94, 1)
    m.setU32(0x6fdefb98, itemsTxt)
    m.setU16(itemsTxt + 0x11e, 3) // wType[0] = 3

    const pInv = m.alloc(0x40)
    m.setU32(pInv, 0x01020304)
    m.setU32(pUnit + 0x60, pInv)

    expect(OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c(m, pUnit, 5)).toBe(0)

    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x80)
    m.setU32(pItem + 0x00, 4)
    m.setU32(pItem + 0x04, 0)
    m.setU32(pItem + 0x14, pItemData)
    m.setU32(pInv + 0x0c, pItem)

    expect(OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c(m, pUnit, 4)).toBe(0)
    expect(OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c(m, pUnit, 5)).toBe(1)
  })

  it('OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c and OBJECTS_OperateToggleObjectMode012_6FC89A80_113c', () => {
    const m = new SparseMemory113c()
    const pPlayer = m.alloc(0x100)
    const pRoomAct1 = attachPlayerRoomLevel(m, pPlayer, 1)
    const pRoomAct2 = attachPlayerRoomLevel(m, pPlayer, 40)

    expect(OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c(m, pRoomAct1, 0xea)).toBe(0)
    expect(OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c(m, pRoomAct2, 0xea)).toBe(1)
    expect(OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c(m, pRoomAct1, 0x10)).toBe(1)

    const pObject = m.alloc(0x100)
    m.setU32(pObject + 0x00, 2)
    m.setU32(pObject + 0x2c, m.alloc(0x20))
    m.setU32(pObject + 0xc4, 0x06)

    const pObjOperate = m.alloc(0x20)
    m.setU32(pObjOperate + 0x04, pObject)

    // Mode 0 -> transitions to 1 and clears bit 0x02 of dwFlags (+0xC4)
    expect(OBJECTS_OperateToggleObjectMode012_6FC89A80_113c(m, pObjOperate)).toBe(1)
    expect(m.u32(pObject + 0x10)).toBe(1)
    expect(m.u32(pObject + 0xc4)).toBe(0x05)

    // Mode 2 -> transitions to 0
    m.setU32(pObject + 0x10, 2)
    expect(OBJECTS_OperateToggleObjectMode012_6FC89A80_113c(m, pObjOperate)).toBe(1)
    expect(m.u32(pObject + 0x10)).toBe(0)
  })
})
