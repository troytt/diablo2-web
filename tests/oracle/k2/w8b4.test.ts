import { describe, expect, it } from 'vitest'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items'
import {
  ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c,
  ACT3Q1_OnQuestItemPickedUp_6FD07640_113c,
  ACT3Q2_OnGidbinnPickedUp_6FD07770_113c,
  ACT3Q3_OnNpcSpeechComplete_6FD07940_113c,
  ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c,
  ACT3Q7_OnMephistoKilled_6FD09A10_113c,
  PARTY_AcceptInviteAndSyncParty_6FD10D50_113c,
  PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b4-113c'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'

function createTestMemory(): SparseMemory113c {
  const m = new SparseMemory113c()
  m.fill(0x0, 0x2000, 0)
  m.fill(0x10000, 0x70000, 0)
  m.fill(0x6fd18000, 0x20000, 0)
  m.fill(0x6fde0000, 0x12000, 0)
  const pDataTables = 0x70000
  const pItemsTxt = 0x72000
  const pObjectsTxt = 0x75000
  const pItemsLinker = 0x76000
  const pItemsLinkerRows = 0x76100
  m.setU32(0x6fd1829c, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(0x6fdefb94, 8)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(0x6fdeff6c, pItemsLinker)
  m.setU32(pItemsLinker, 1)
  m.setU32(pItemsLinker + 0x08, pItemsLinkerRows)
  m.setU32(pItemsLinkerRows, 0x2034336a)
  m.setU32(pItemsLinkerRows + 0x04, 0)
  m.setU32(pDataTables + 0xc98, pObjectsTxt)
  m.setU32(pDataTables + 0xc9c, 8)
  return m
}

describe('K2 Wave 8 Batch 4 (w8b4) — 8 D2Game.dll functions (0x6FD07640..0x6FD10FF0)', () => {
  it('[1/8] ACT3Q1_OnQuestItemPickedUp_6FD07640_113c handles Golden Bird (g34) and Jade Figurine (j34) pickups', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pQuest = 0x14000
    const pQuestArg = 0x15000
    const pPlayer = 0x20000
    const pPlayerData = 0x21000
    const pQuestFlags = 0x22000
    const pItem = 0x23000
    const pItemsTxt = 0x72000

    m.setU32(pQuest + 0x04, pGame)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x08, pItem)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pQuestFlags, 0x22100)
    m.setU32(pQuestFlags + 0x04, 0x60)

    // Item 0 = 'g34 ' (0x20343367)
    m.setU32(pItem + 0x04, 0)
    m.setU32(pItemsTxt + 0x80, 0x20343367)
    ACT3Q1_OnQuestItemPickedUp_6FD07640_113c(m, pQuest, pQuestArg)
    expect(m.u8(pQuest + 0x0b)).toBe(3)
    expect(m.u8(pQuest + 0x0c)).toBe(3)

    // Item 0 = 'j34 ' (0x2034336a)
    m.setU32(pItemsTxt + 0x80, 0x2034336a)
    ACT3Q1_OnQuestItemPickedUp_6FD07640_113c(m, pQuest, pQuestArg)
    expect(m.u8(pQuest + 0x0b)).toBe(1)
    expect(m.u8(pQuest + 0x0c)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 6)).toBe(1)
  })

  it('[2/8] ACT3Q2_OnGidbinnPickedUp_6FD07770_113c sets quest state 4 and player flag (0x13, 9) when g33 is picked up', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pQuest = 0x14000
    const pQuestArg = 0x15000
    const pPlayer = 0x20000
    const pPlayerData = 0x21000
    const pQuestFlags = 0x22000
    const pItem = 0x23000
    const pItemsTxt = 0x72000

    m.setU32(pQuest + 0x04, pGame)
    m.setU8(pQuest + 0x09, 1)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x08, pItem)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pQuestFlags, 0x22100)
    m.setU32(pQuestFlags + 0x04, 0x60)

    m.setU32(pItem + 0x04, 0)
    m.setU32(pItemsTxt + 0x80, 0x20333367)

    ACT3Q2_OnGidbinnPickedUp_6FD07770_113c(m, pQuest, pQuestArg)
    expect(m.u8(pQuest + 0x0c)).toBe(4)
    expect(m.u8(pQuest + 0x0b)).toBe(3)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 9)).toBe(1)
  })

  it('[3/8] ACT3Q3_OnNpcSpeechComplete_6FD07940_113c maps Deckard Cain (0xF5) speeches 543..548 to quest 0x12 flags 2..7', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pQuest = 0x14000
    const pQuestExt = 0x14500
    const pQuestArg = 0x15000
    const pPlayer = 0x20000
    const pPlayerData = 0x21000
    const pQuestFlags = 0x22000

    m.setU32(pQuest + 0x04, pGame)
    m.setU32(pQuest + 0x18, pQuestExt)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU16(pQuestArg + 0x14, 0xf5)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pQuestFlags, 0x22100)
    m.setU32(pQuestFlags + 0x04, 0x60)

    m.setU16(pQuestArg + 0x18, 0x21f)
    ACT3Q3_OnNpcSpeechComplete_6FD07940_113c(m, pQuest, pQuestArg)
    expect(m.u8(pQuest + 0x0c)).toBe(2)
    expect(m.u8(pQuestExt + 0x01)).toBe(1)
    expect(m.u32(pQuest + 0xa8)).toBe(0x6fd06d90)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 2)).toBe(1)

    m.setU16(pQuestArg + 0x18, 0x224)
    ACT3Q3_OnNpcSpeechComplete_6FD07940_113c(m, pQuest, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 7)).toBe(1)
  })

  it('[4/8] ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c marks monster class 0x16E flag 0x20000 and completes council on last kill', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pQuests = 0x11500
    const pGlobalFlags = 0x11600
    const pQuest = 0x14000
    const pQuestExt = 0x14500
    const pQuestArg = 0x15000
    const pVictim = 0x24000

    m.setU32(pGame + 0x10f4, pQuests)
    m.setU32(pQuests + 0x08, 1)
    m.setU32(pQuests + 0x0c, pGlobalFlags)
    m.setU32(pGlobalFlags, 0x11700)
    m.setU32(pGlobalFlags + 0x04, 0x60)

    m.setU32(pQuest + 0x04, pGame)
    m.setU8(pQuest + 0x09, 1)
    m.setU32(pQuest + 0x18, pQuestExt)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x08, pVictim)

    // Case 1: victim classId == 0x16e sets +0xc4 |= 0x20000
    m.setU32(pVictim + 0x04, 0x16e)
    ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c(m, pQuest, pQuestArg)
    expect(m.u32(pVictim + 0xc4)).toBe(0x20000)

    // Case 2: normal council boss with +0x34 == 1 completes quest 0x15
    m.setU32(pVictim + 0x04, 0x159)
    m.setU32(pVictim + 0x0c, 0x99)
    m.setU8(pQuestExt + 0x0d, 1)
    m.setU8(pQuestExt + 0x0e, 1)
    m.setU8(pQuestExt + 0x0c, 1)
    m.setU32(pQuestExt + 0x34, 1)
    ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c(m, pQuest, pQuestArg)
    expect(m.u32(pQuestExt + 0x34)).toBe(0)
    expect(m.u32(pQuestExt)).toBe(0x99)
    expect(m.u8(pQuest + 0x0b)).toBe(0x0d)
    expect(DRLGWARP_TestRoomTileBit113c(m, pGlobalFlags, 0x15, 0x0d)).toBe(1)
  })

  it('[5/8] ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c sets drop code j34, marks +0x01 when unroomed, and drops real j34 when roomed', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pQuest = 0x14000
    const pQuestExt = 0x14500
    const pQuestArg = 0x15000
    const pBoss = 0x24000
    const pItemsTxt = 0x72000

    m.setU32(pItemsTxt + 0x80, 0x2034336a)
    m.setU8(pItemsTxt + 0x10f, 1)
    m.setU8(pItemsTxt + 0x110, 1)
    m.setU8(pItemsTxt + 0x12d, 1)
    m.setU32(pQuest + 0x04, pGame)
    m.setU8(pQuest + 0x09, 1)
    m.setU32(pQuest + 0x18, pQuestExt)
    m.setU32(pQuest + 0xe0, 0x14)
    m.setU8(pQuestExt + 0x02, 1)
    m.setU8(pQuestExt + 0x0c, 1)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x08, pBoss)

    // Case A: pBoss has no room -> 0x6FC31A70 returns 0, triggering +0x01 fallback
    ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c(m, pQuest, pQuestArg)
    expect(m.u32(pBoss + 0xb8)).toBe(0x2034336a)
    expect(m.u8(pQuestExt + 0x01)).toBe(1)
    expect(m.u8(pQuestExt + 0x02)).toBe(0)

    // Case B: pBoss has a valid room + collision grid -> 0x6FC31A70 -> 0x6FC31490 spawns real 'j34 '
    const pDataTables = 0x70000
    const pHolder = m.alloc(4)
    m.setU32(pHolder, pDataTables)
    m.setU32(0x6fd1829c, pHolder)
    const pBitMasks = m.alloc(32 * 4)
    for (let b = 0; b < 32; b++) m.setU32(pBitMasks + b * 4, (1 << b) >>> 0)
    m.setU32(0x6fdd90b0, pBitMasks)
    m.setU32(0x6fd18be0, pBitMasks)
    m.setU32(pItemsTxt + 0x84, 0x2034336a)
    m.setU8(pItemsTxt + 0xfc, 1)
    m.setU8(pItemsTxt + 0xfd, 1)
    m.setU8(pItemsTxt + 0x10e, 1)
    m.setU16(pItemsTxt + 0x11e, 1)
    m.setU8(pItemsTxt + 0x133, 1)
    m.setU8(pItemsTxt + 0x14d, 1)
    const pIsc = m.alloc(0x144 * 360)
    m.setU32(pDataTables + 0x2c, pIsc)
    m.setU32(pDataTables + 0x34, 360)
    m.setU32(pDataTables + 0xbcc, pIsc)
    m.setU32(pDataTables + 0xbd4, 360)
    m.setU32(0x6fde9e48, pIsc)
    m.setU32(0x6fde9e50, 360)
    m.setU32(pDataTables + 0x00, 8)
    m.setU32(pDataTables + 0x04, pItemsTxt)
    m.setU32(pDataTables + 0xbd8, pItemsTxt)
    m.setU32(pDataTables + 0xbdc, 8)
    const pItemTypesTxt = m.alloc(0xe4 * 4)
    for (let i = 0; i < 4; i++) m.setU8(pItemTypesTxt + i * 0xe4 + 0x11, 1)
    m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
    m.setU32(pDataTables + 0xbfc, 4)
    m.setU32(pDataTables + 0xc00, 1)
    const pTypeMatrix = m.alloc(32)
    m.setU32(pTypeMatrix + 4, 1 << 1)
    m.setU32(pDataTables + 0xc04, pTypeMatrix)
    m.setU32(pDataTables + 0xba4, m.alloc(28))
    const pAnimDataTable = m.alloc(0x420)
    const pEmptyBucket = m.alloc(16)
    for (let i = 0; i < 256; i++) m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
    m.setU32(pAnimDataTable + 0x40c, 8)
    m.setU32(pAnimDataTable + 0x410, 256)
    m.setU32(0x6fdf0b4c, pAnimDataTable)
    m.setU32(0x6fdf13a4, 16)
    m.setU32(0x6fdf13b0, m.alloc(16 * 0x34))
    m.setU32(0x6fdf13c0, m.alloc(8 * 0x34))
    m.setU32(0x6fdf13d0, m.alloc(20 * 0x34))
    const fieldDx = [0, 1, 1, 1, 0, -1, -1, -1, 0]
    const fieldDy = [-1, -1, 0, 1, 1, 1, 0, -1, 0]
    for (let i = 0; i < 9; i++) {
      m.setU32((0x6fde9ba0 + i * 4) >>> 0, fieldDx[i]! >>> 0)
      m.setU32((0x6fde9bc4 + i * 4) >>> 0, fieldDy[i]! >>> 0)
    }
    const pFieldData = m.alloc(256 * 256)
    m.fill(pFieldData, 256 * 256, 8)
    m.setU32(0x6fdf1404, pFieldData)
    m.setU32(0x6fdf1414, 128)
    m.setU32(0x6fdf1418, 128)

    const pRoom = m.alloc(0x90)
    const pRoomEx = m.alloc(0xec)
    const pLevel = m.alloc(0x230)
    const pAct = m.alloc(0x80)
    const pColl = m.alloc(0x30)
    const pMask = m.alloc(40 * 40 * 2)
    const pNear = m.alloc(8)
    m.setU32(pNear, pRoom)
    m.setU32(pRoom, pNear)
    m.setU32(pRoom + 0x10, pRoomEx)
    m.setU32(pRoom + 0x20, pColl)
    m.setU32(pRoom + 0x24, 1)
    m.setU32(pRoom + 0x3c, pAct)
    m.setU32(pRoom + 0x4c, 100)
    m.setU32(pRoom + 0x50, 100)
    m.setU32(pRoom + 0x54, 40)
    m.setU32(pRoom + 0x58, 40)
    m.setU32(pRoomEx + 0x58, pLevel)
    m.setU32(pLevel + 0x1d0, 76)
    m.setU32(pColl + 0x00, 100)
    m.setU32(pColl + 0x04, 100)
    m.setU32(pColl + 0x08, 40)
    m.setU32(pColl + 0x0c, 40)
    m.setU32(pColl + 0x20, pMask)

    const pBossPath = m.alloc(0x80)
    m.setU32(pBoss, 1)
    m.setU32(pBoss + 0x2c, pBossPath)
    m.setU16(pBossPath + 0x02, 110)
    m.setU16(pBossPath + 0x06, 110)
    m.setU32(pBossPath + 0x1c, pRoom)
    m.setU8(pQuestExt + 0x01, 0)
    m.setU8(pQuestExt + 0x02, 1)
    m.setU8(pQuestExt + 0x0c, 1)

    ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c(m, pQuest, pQuestArg)
    expect(m.u32(pQuestExt + 0x10)).toBe(1)
    expect(m.u8(pQuestExt + 0x14)).toBe(1)
    expect(m.u8(pQuest + 0x0c)).toBe(1)
    expect(m.u8(pQuest + 0x0b)).toBe(1)
    expect(m.u8(pQuestExt + 0x02)).toBe(0)
  })

  it('[6/8] ACT3Q7_OnMephistoKilled_6FD09A10_113c sets quest state 6, global flag (0x16, 0x0D), and Soulstone drop code mss', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pQuests = 0x11500
    const pGlobalFlags = 0x11600
    const pQuest = 0x14000
    const pQuestExt = 0x14500
    const pQuestArg = 0x15000
    const pBoss = 0x24000

    m.setU32(pGame + 0x10f4, pQuests)
    m.setU32(pQuests + 0x08, 1)
    m.setU32(pQuests + 0x0c, pGlobalFlags)
    m.setU32(pGlobalFlags, 0x11700)
    m.setU32(pGlobalFlags + 0x04, 0x60)

    m.setU32(pQuest + 0x04, pGame)
    m.setU8(pQuest + 0x09, 1)
    m.setU32(pQuest + 0x18, pQuestExt)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x08, pBoss)

    ACT3Q7_OnMephistoKilled_6FD09A10_113c(m, pQuest, pQuestArg)
    expect(m.u8(pQuest + 0x0c)).toBe(6)
    expect(m.u32(pQuest + 0xc8)).toBe(0x6fd03390)
    expect(m.u8(pQuestExt)).toBe(1)
    expect(m.u32(pQuestExt + 0x0c)).toBe(2)
    expect(m.u32(pBoss + 0xb8)).toBe(0x2073736d)
    expect(m.u8(pQuests + 0x20)).toBe(0x0b)
    expect(DRLGWARP_TestRoomTileBit113c(m, pGlobalFlags, 0x16, 0x0d)).toBe(1)
  })

  it('[7/8] PARTY_AcceptInviteAndSyncParty_6FD10D50_113c creates sub-party when invite relation state is 2', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pPartyCtrl = 0x12000
    const pAccepter = 0x20000
    const pAccepterData = 0x21000
    const pInviter = 0x30000
    const pInviterData = 0x31000
    const pRelNode = 0x32000

    m.setU32(pGame + 0x10f8, pPartyCtrl)
    m.setU32(pGame + 0x1d2c, pPartyCtrl)
    m.setU16(pPartyCtrl, 5)
    m.setU32(pAccepter, 0)
    m.setU32(pAccepter + 0x0c, 10)
    m.setU32(pAccepter + 0x14, pAccepterData)
    m.setU32(pAccepter + 0x80, pGame)
    m.setU32(pInviter, 0)
    m.setU32(pInviter + 0x0c, 20)
    m.setU32(pInviter + 0x14, pInviterData)
    m.setU32(pInviter + 0x80, pGame)

    // Pre-populate relation node on accepter toward inviter (guid 20) with state 2 (invited)
    m.setU32(pAccepterData + 0x38, pRelNode)
    m.setU32(pRelNode, 20)
    m.setU32(pRelNode + 0x0c, 2)

    PARTY_AcceptInviteAndSyncParty_6FD10D50_113c(m, pGame, pAccepter, pInviter)
    expect(m.u16(pPartyCtrl)).toBe(6)
    expect(m.u32(pPartyCtrl + 0x04)).not.toBe(0)
  })

  it('[8/8] PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c sets mutual hostility flag 0x08 between unpartied players', () => {
    const m = createTestMemory()
    const pGame = 0x10000
    const pSource = 0x20000
    const pSourceData = 0x21000
    const pTarget = 0x30000
    const pTargetData = 0x31000

    m.setU32(pSource, 0)
    m.setU32(pSource + 0x0c, 101)
    m.setU32(pSource + 0x14, pSourceData)
    m.setU32(pSource + 0x80, pGame)

    m.setU32(pTarget, 0)
    m.setU32(pTarget + 0x0c, 202)
    m.setU32(pTarget + 0x14, pTargetData)
    m.setU32(pTarget + 0x80, pGame)

    PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c(m, pTarget, pSource, pGame)

    const pSourceRel = m.u32(pSourceData + 0x38) >>> 0
    const pTargetRel = m.u32(pTargetData + 0x38) >>> 0
    expect(pSourceRel).not.toBe(0)
    expect(pTargetRel).not.toBe(0)
    expect(m.u16(pSourceRel + 0x04) & 8).toBe(8)
    expect(m.u16(pTargetRel + 0x04) & 8).toBe(8)
  })
})
