import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import { TEXT_AllocTextList113c } from '../../../src/d2kern-113c/common/text.ts'
import * as w5b8Exports from '../../../src/d2kern-113c/game/k2-w5b8-113c.ts'
import {
  ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c,
  ACT3_CainIntroActiveFilter_6FD055C0_113c,
  ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c,
  ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c,
  ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c,
  ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c,
  ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c,
  ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c,
  ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c,
  ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
  ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c,
  ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c,
  ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c,
  ACT3Q2_GidbinnActiveFilter_6FD04500_113c,
  ACT3Q2_GidbinnStatusFilter_6FD045B0_113c,
  ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c,
  ACT3Q2_SetGidbinnState0ECallback_6FD04280_113c,
  ACT3Q2_SetGidbinnTurnInPartyCallback_6FD041D0_113c,
  ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
  ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c,
  ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c,
  ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c,
  ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c,
  ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c,
  ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c,
  ACT3Q4_CompleteLamEsensTomePartyCallback_6FD064C0_113c,
  ACT3Q4_PropagateTomeQuestStateToSubParty_6FD06B90_113c,
  ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c,
  ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c,
  ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c,
  ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c,
  ACT3Q5_NotifyPlayerTravincalState0DCallback_6FD03760_113c,
  ACT3Q5_PropagateCouncilCompletionToPartyCallback_6FD06980_113c,
  ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c,
  ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c,
  ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c,
  ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c,
  ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c,
  ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c,
  ACT3Q7_InitMephistoPortalObject_6FD03290_113c,
  ACT3Q7_NotifyPlayerMephistoState0DCallback_6FD03320_113c,
  ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c,
  ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c,
  ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c,
  ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c,
} from '../../../src/d2kern-113c/game/k2-w5b8-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const ITEM_CODES = [
  0x20316671, // 0: 'qf1 '
  0x20326671, // 1: 'qf2 '
  0x20786f62, // 2: 'box '
  0x20343367, // 3: 'g34 '
  0x2034336a, // 4: 'j34 '
  0x20333367, // 5: 'g33 '
  0x20796571, // 6: 'qey '
  0x20726871, // 7: 'qhr '
  0x20726271, // 8: 'qbr '
  0x20626262, // 9: 'bbb '
] as const

function setupEnv(m: SparseMemory113c, nDiff = 0): {
  pGame: number
  pPlayer: number
  pPlayerData: number
  pQuestFlags: number
  pGameQuestFlags: number
  pQuestCtrl: number
  pClient: number
  pInv: number
} {
  const itemsTxt = m.alloc(ITEM_CODES.length * 0x1a8)
  m.setU32(0x6fdefb94, ITEM_CODES.length)
  m.setU32(0x6fdefb98, itemsTxt)
  for (let i = 0; i < ITEM_CODES.length; i++) {
    m.setU32(itemsTxt + i * 0x1a8 + 0x80, ITEM_CODES[i]!)
  }

  const pGame = m.alloc(0x1e00)
  m.setU8(pGame + 0x6d, nDiff & 0xff)
  m.setU8(pGame + 0x6a, 3)

  const pQuestCtrl = m.alloc(0x20)
  const pGameQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  m.setU32(pQuestCtrl + 0x08, 1)
  m.setU32(pQuestCtrl + 0x0c, pGameQuestFlags)
  m.setU32(pGame + 0x10f4, pQuestCtrl)

  const pPlayer = m.alloc(0x100)
  m.setU32(pPlayer + 0x00, 0)
  m.setU32(pPlayer + 0x0c, 0x42)
  m.setU32(pPlayer + 0x80, pGame)
  m.setU32(pGame + (0x42 & 0x7f) * 4 + 0x1120, pPlayer)

  const pPlayerData = m.alloc(0x180)
  m.setU32(pPlayer + 0x14, pPlayerData)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  m.setU32(pPlayerData + 0x10 + nDiff * 4, pQuestFlags)
  for (let i = 0; i < 3; i++) {
    m.setU32(pPlayerData + 0x40 + i * 4, QUESTRECORD_AllocRecord113c(m, 0))
    const pIntroData = m.alloc(8)
    m.setU32(pIntroData, QUESTRECORD_AllocRecord113c(m, 0))
    m.setU32(pPlayerData + 0x60 + i * 4, pIntroData)
  }

  const pClient = m.alloc(0x220)
  const pQueue = m.alloc(0x220)
  m.setU32(pClient + 0x04, 4)
  m.setU32(pClient + 0x1a8, pGame)
  m.setU32(pClient + 0x1bc, pQueue)
  m.setU32(pPlayerData + 0x9c, pClient)

  const pInv = m.alloc(0x40)
  m.setU32(pInv, 0x01020304)
  m.setU32(pPlayer + 0x60, pInv)

  return { pGame, pPlayer, pPlayerData, pQuestFlags, pGameQuestFlags, pQuestCtrl, pClient, pInv }
}

function attachRoom(m: SparseMemory113c, pUnit: number, nLevelId: number): number {
  const pPath = m.alloc(0x40)
  const pRoom1 = m.alloc(0x90)
  const pRoom2 = m.alloc(0x90)
  const pLevel = m.alloc(0x200)
  m.setU32(pRoom1 + 0x7c, m.alloc(8))
  m.setU32(pUnit + 0x2c, pPath)
  m.setU32(pPath + 0x1c, pRoom1)
  m.setU32(pRoom1 + 0x10, pRoom2)
  m.setU32(pRoom2 + 0x58, pLevel)
  m.setU32(pLevel + 0x1d0, nLevelId >>> 0)
  return pRoom1
}

function linkQuest(m: SparseMemory113c, pGame: number, nQuestId: number): {
  pQuest: number
  pQuestEx: number
  pMsgTables: number
} {
  const pQuestCtrl = m.u32(pGame + 0x10f4)
  const pQuest = m.alloc(0x120)
  const pQuestEx = m.alloc(0x180)
  const pMsgTables = m.alloc(16 * 0xc4)
  m.setU32(pQuest + 0x00, nQuestId >>> 0)
  m.setU32(pQuest + 0x04, pGame)
  m.setU32(pQuest + 0x18, pQuestEx)
  m.setU32(pQuest + 0xdc, pMsgTables)
  m.setU32(pQuest + 0xe0, nQuestId >>> 0)
  m.setU32(pQuest + 0xf4, m.u32(pQuestCtrl))
  m.setU32(pQuestCtrl, pQuest)
  return { pQuest, pQuestEx, pMsgTables }
}

function addDialogEntry(
  m: SparseMemory113c,
  pMsgTables: number,
  tableIdx: number,
  npcId: number,
  strId: number,
): void {
  const pTable = pMsgTables + tableIdx * 0xc4
  m.setU32(pTable, npcId >>> 0)
  m.setU16(pTable + 0x04, strId & 0xffff)
  m.setU32(pTable + 0xc0, 1)
}

function makeItem(m: SparseMemory113c, classIdx: number, nextItem = 0): number {
  const pItem = m.alloc(0x100)
  const pItemData = m.alloc(0x80)
  m.setU32(pItem + 0x00, 4)
  m.setU32(pItem + 0x04, classIdx)
  m.setU32(pItem + 0x14, pItemData)
  m.setU32(pItemData + 0x64, nextItem)
  return pItem
}

function makeQuestArg(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  npcId: number,
): { pQuestArg: number; pTextHeader: number } {
  const pQuestArg = m.alloc(0x30)
  const pNpc = m.alloc(0x40)
  m.setU32(pNpc + 0x04, npcId >>> 0)
  const pTextHeader = TEXT_AllocTextList113c(m, 0)
  m.setU32(pQuestArg + 0x00, pGame)
  m.setU32(pQuestArg + 0x08, pNpc)
  m.setU32(pQuestArg + 0x0c, pPlayer)
  m.setU32(pQuestArg + 0x14, pTextHeader)
  return { pQuestArg, pTextHeader }
}

function firstDialogStrId(m: SparseMemory113c, pTextHeader: number): number {
  const pNode = m.u32(pTextHeader + 0x08)
  return pNode === 0 ? -1 : m.u16(pNode)
}

describe('K2 Wave 5 Batch 8 (w5b8: 45 D2Game.dll 1.13c VAs 0x6FD03050..0x6FD06B90)', () => {
  it('exports all 45 target functions', () => {
    const fns = Object.values(w5b8Exports).filter((v) => typeof v === 'function')
    expect(fns).toHaveLength(45)
  })

  it('[1..5] Mephisto quest 0x16 / 0x20 sync, portal init, state 0x0D notify, and NPC dialog', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags, pGameQuestFlags } = setupEnv(m, 1)
    attachRoom(m, pPlayer, 75)
    const { pQuest, pQuestEx, pMsgTables } = linkQuest(m, pGame, 0x14)
    const { pQuestArg, pTextHeader } = makeQuestArg(m, pGame, pPlayer, 0xf5)

    m.setU8(pQuestEx + 0x01, 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x20, 0)
    ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c(m, pQuest, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pGameQuestFlags, 0x20, 0x0d)).toBe(1)
    expect(m.u8(pQuestEx + 0x01)).toBe(0)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 8)
    ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c(m, pQuest, pQuestArg)
    expect(m.u8(pQuest + 0x0c)).toBe(5)
    expect(m.u8(pQuest + 0x0b)).toBe(3)

    const pObj = m.alloc(0x100)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x0c, 0x99)
    const pObjRoom = attachRoom(m, pObj, 102)
    m.setU32(pQuestEx + 0x0c, 1)
    const pObjInit = m.alloc(0x20)
    m.setU32(pObjInit + 0x00, pGame)
    m.setU32(pObjInit + 0x04, pObj)
    m.setU32(pObjInit + 0x08, pObjRoom)
    ACT3Q7_InitMephistoPortalObject_6FD03290_113c(m, pObjInit)
    expect(m.u32(pQuestEx + 0x04)).toBe(0x99)
    expect(m.u32(pObj + 0x10)).toBe(1)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 0x0d)
    expect(ACT3Q7_NotifyPlayerMephistoState0DCallback_6FD03320_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x42)
    expect(m.u32(pPlayer + 0xc4) & 0x400).toBe(0x400)

    m.setU8(pQuest + 0x0c, 3)
    addDialogEntry(m, pMsgTables, 2, 0xf5, 0x512)
    ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c(m, pQuest, pQuestArg)
    expect(firstDialogStrId(m, pTextHeader)).toBe(0x512)
  })

  it('[6..11] Mephisto progression advance, quest 14->player sync, missing relic/cube counter, and Travincal sync/dialog', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags, pClient, pInv } = setupEnv(m, 1)
    attachRoom(m, pPlayer, 75)
    const { pQuest: pQuest14 } = linkQuest(m, pGame, 0x14)
    const { pQuest: pQuest13, pQuestEx: pEx13, pMsgTables } = linkQuest(m, pGame, 0x13)
    m.setU32(pQuest13 + 0xe0, 0x15)

    m.setU16(pClient + 0x0a, 0x0020)
    ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c(m, pQuestFlags, pPlayer, pGame)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0)).toBe(1)
    expect((m.u16(pClient + 0x0a) >>> 8) & 0x1f).toBe(8)

    const { pGame: pG2, pPlayer: pP2, pQuestFlags: pQF2 } = setupEnv(m, 0)
    const { pQuest: pQ14b } = linkQuest(m, pG2, 0x14)
    m.setU8(pQ14b + 0x0c, 4)
    m.setU8(pQ14b + 0x0b, 3)
    ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c(m, pG2, pP2)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQF2, 0x16, 5)).toBe(1)

    m.setU32(pInv + 0x0c, 0)
    ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c(m, pGame, pPlayer)
    expect(m.u32(pEx13 + 0x3c)).toBe(1)
    expect(m.u32(pEx13 + 0x40)).toBe(1)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 0x0d)
    ACT3Q5_NotifyPlayerTravincalState0DCallback_6FD03760_113c(m, pGame, pPlayer)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x40)

    const { pQuestArg, pTextHeader } = makeQuestArg(m, pGame, pPlayer, 0xf5)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 2)
    ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c(m, pQuest13, pQuestArg)
    expect(m.u8(pQuest13 + 0x0b)).toBe(2)
    expect(m.u8(pQuest13 + 0x0c)).toBe(3)

    m.setU8(pQuest13 + 0x09, 1)
    addDialogEntry(m, pMsgTables, 2, 0xf5, 0x611)
    ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c(m, pQuest13, pQuestArg)
    expect(firstDialogStrId(m, pTextHeader)).toBe(0x611)
    void pQuest14
  })

  it('[12..15] Golden Bird sync, status filter, dialog nodes, and active filter', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags, pInv } = setupEnv(m, 0)
    const { pQuest, pMsgTables } = linkQuest(m, pGame, 0x14)
    m.setU32(pInv + 0x0c, makeItem(m, 3)) // 'g34 '

    const { pQuestArg, pTextHeader } = makeQuestArg(m, pGame, pPlayer, 0xf5)
    ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c(m, pQuest, pQuestArg)
    expect(m.u8(pQuest + 0x0c)).toBe(3)
    expect(m.u8(pQuest + 0x0b)).toBe(3)

    const pOutStatus = m.alloc(4)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0f, 0)
    expect(ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c(m, pQuest, pPlayer, 0, pQuestFlags, pOutStatus)).toBe(1)
    expect(m.u8(pOutStatus)).toBe(3)

    addDialogEntry(m, pMsgTables, 3, 0xf5, 0x703)
    ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c(m, pQuest, pQuestArg)
    expect(firstDialogStrId(m, pTextHeader)).toBe(0x703)

    expect(ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c(m, pQuest, 0xfe, pPlayer, pQuestFlags)).toBe(1)
    expect(ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c(m, pQuest, 0xf5, pPlayer, pQuestFlags)).toBe(1)
  })

  it('[16..21] Gidbinn party callbacks, dialog nodes, active filter, status filter, and state sync', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags, pInv } = setupEnv(m, 0)
    attachRoom(m, pPlayer, 75)
    const { pQuest, pMsgTables } = linkQuest(m, pGame, 0x11)

    ACT3Q2_SetGidbinnState0ECallback_6FD04280_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0x0e)).toBe(1)

    ACT3Q2_SetGidbinnTurnInPartyCallback_6FD041D0_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 6)).toBe(1)

    const { pQuestArg, pTextHeader } = makeQuestArg(m, pGame, pPlayer, 0xfc)
    addDialogEntry(m, pMsgTables, 5, 0xfc, 0x725)
    ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c(m, pQuest, pQuestArg)
    expect(firstDialogStrId(m, pTextHeader)).toBe(0x725)

    expect(ACT3Q2_GidbinnActiveFilter_6FD04500_113c(m, pQuest, 0xfc, pPlayer, pQuestFlags)).toBe(1)
    expect(ACT3Q2_GidbinnActiveFilter_6FD04500_113c(m, pQuest, 0xff, pPlayer, pQuestFlags)).toBe(1)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0f, 0)
    const pOutStatus = m.alloc(4)
    expect(ACT3Q2_GidbinnStatusFilter_6FD045B0_113c(m, pQuest, pPlayer, 0, pQuestFlags, pOutStatus)).toBe(1)
    expect(m.u8(pOutStatus)).toBe(5)

    const { pGame: pG2, pPlayer: pP2, pQuestFlags: pQF2, pInv: pInv2 } = setupEnv(m, 0)
    linkQuest(m, pG2, 0x11)
    m.setU32(pInv2 + 0x0c, makeItem(m, 5)) // 'g33 '
    ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c(m, pG2, pP2)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQF2, 0x13, 5)).toBe(1)
    void pInv
  })

  it('[22..30] Khalim Will status/dialog/active, Lam Esen Tome sync/dialog, Hratli intro, and Cain intro filter', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags, pGameQuestFlags, pInv } = setupEnv(m, 0)
    const { pQuest: pQ12, pMsgTables: pMsg12 } = linkQuest(m, pGame, 0x12)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0f, 0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x12, 2)
    m.setU32(pInv + 0x0c, makeItem(m, 6, makeItem(m, 7))) // 'qey ' + 'qhr '

    const pOutStatus = m.alloc(4)
    expect(ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c(m, pQ12, pPlayer, 0, pQuestFlags, pOutStatus)).toBe(1)
    expect(m.u8(pOutStatus)).toBe(2)

    const { pQuestArg, pTextHeader } = makeQuestArg(m, pGame, pPlayer, 0xf5)
    addDialogEntry(m, pMsg12, 1, 0xf5, 0x801)
    ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c(m, pQ12, pQuestArg)
    expect(firstDialogStrId(m, pTextHeader)).toBe(0x801)
    expect(ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c(m, pQ12, 0xf5, pPlayer, pQuestFlags)).toBe(1)

    const { pQuest: pQ11, pQuestEx: pEx11, pMsgTables: pMsg11 } = linkQuest(m, pGame, 0x11)
    m.setU32(pInv + 0x0c, makeItem(m, 9)) // 'bbb '
    ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c(m, pQ11, pQuestArg)
    expect(m.u8(pQ11 + 0x0c)).toBe(4)
    expect(m.u8(pEx11 + 0x02)).toBe(1)

    const { pQuestArg: pTomeArg, pTextHeader: pTomeHdr } = makeQuestArg(m, pGame, pPlayer, 0xfe)
    addDialogEntry(m, pMsg11, 3, 0xfe, 0x833)
    ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c(m, pQ11, pTomeArg)
    expect(firstDialogStrId(m, pTomeHdr)).toBe(0x833)

    const { pQuest: pQ10, pMsgTables: pMsg10 } = linkQuest(m, pGame, 0x10)
    m.setU32(pPlayer + 0x04, 1)
    const { pQuestArg: pHratliArg, pTextHeader: pHratliHdr } = makeQuestArg(m, pGame, pPlayer, 0xfd)
    addDialogEntry(m, pMsg10, 1, 0xfd, 0x1d2)
    ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c(m, pQ10, pHratliArg)
    expect(firstDialogStrId(m, pHratliHdr)).toBe(0x1d2)

    const pSpeechArg = m.alloc(0x20)
    m.setU32(pSpeechArg + 0x0c, pPlayer)
    m.setU16(pSpeechArg + 0x14, 0xfd)
    m.setU16(pSpeechArg + 0x18, 0x1d2)
    ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c(m, pQ10, pSpeechArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x10, 0)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pGameQuestFlags, 0x10, 0x0d)).toBe(1)

    ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c(m, pQ10, pHratliArg)
    expect(ACT3_CainIntroActiveFilter_6FD055C0_113c(m, pQ10, 0xf5, pPlayer)).toBe(1)
  })

  it('[31..38] Kurast NPC intro dialog/speech, Mephisto bridge/portal, quest 5D alerts, Council kill proximity, and Gidbinn altar', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags } = setupEnv(m, 0)
    EVENT_InitTimerQueue113c(m, pGame)
    m.setU32(pGame + 0xa8, 100)
    const pPlrRoom = attachRoom(m, pPlayer, 75)

    const { pQuest: pQIntro, pMsgTables: pMsgIntro } = linkQuest(m, pGame, 0x10)
    m.setU32(pPlayer + 0x04, 2) // Necromancer -> matches Alkor (0xfe) special class 2 -> msg 1
    const { pQuestArg: pAlkorArg, pTextHeader: pAlkorHdr } = makeQuestArg(m, pGame, pPlayer, 0xfe)
    addDialogEntry(m, pMsgIntro, 1, 0xfe, 0x1f6)
    ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c(m, pQIntro, pAlkorArg)
    expect(firstDialogStrId(m, pAlkorHdr)).toBe(0x1f6)

    const pIntroDoneArg = m.alloc(0x20)
    m.setU32(pIntroDoneArg + 0x00, pGame)
    m.setU32(pIntroDoneArg + 0x0c, pPlayer)
    m.setU32(pIntroDoneArg + 0x14, 0xf5)
    m.setU16(pIntroDoneArg + 0x18, 0x1ca)
    ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c(m, pQIntro, pIntroDoneArg)
    expect(ACT3_CainIntroActiveFilter_6FD055C0_113c(m, pQIntro, 0xf5, pPlayer)).toBe(0)

    const { pQuestEx: pEx14 } = linkQuest(m, pGame, 0x14)
    const pBridge = m.alloc(0x100)
    const pPortal = m.alloc(0x100)
    m.setU32(pBridge, 2)
    m.setU32(pBridge + 0x0c, 0x21)
    attachRoom(m, pBridge, 102)
    m.setU32(pPortal, 2)
    m.setU32(pPortal + 0x0c, 0x22)
    attachRoom(m, pPortal, 102)
    m.setU32(pGame + 0x21 * 4 + 0x1520, pBridge)
    m.setU32(pGame + 0x22 * 4 + 0x1520, pPortal)
    m.setU8(pEx14 + 0x01, 1)
    m.setU8(pEx14 + 0x02, 1)
    m.setU32(pEx14 + 0x04, 0x21)
    m.setU32(pEx14 + 0x08, 0x22)
    ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c(m, pGame)
    expect(m.u32(pBridge + 0x10)).toBe(1)
    expect(m.u32(pPortal + 0x10)).toBe(2)

    expect(ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c(m, pGame, pPlayer)).toBe(0)

    const { pQuestEx: pEx13 } = linkQuest(m, pGame, 0x13)
    const pCouncilMon = m.alloc(0x100)
    m.setU32(pCouncilMon, 1)
    m.setU32(pCouncilMon + 0x0c, 0x33)
    const pMonPath = m.alloc(0x40)
    m.setU32(pCouncilMon + 0x2c, pMonPath)
    m.setU32(pMonPath + 0x1c, pPlrRoom)
    m.setU32(pGame + 0x33 * 4 + 0x1320, pCouncilMon)
    m.setU32(pEx13, 0x33)
    ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 4)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0x0d)).toBe(1)

    const objectsTxt = m.alloc(2 * 0x1c0)
    m.setU32(0x6fdf0b94, objectsTxt)
    m.setU32(0x6fdf0b98, 2)
    m.setU32(objectsTxt + 1 * 0x1c0 + 0xdc, 0x0500)
    const { pQuestEx: pEx11 } = linkQuest(m, pGame, 0x11)
    const pAltar = m.alloc(0x100)
    m.setU32(pAltar, 2)
    m.setU32(pAltar + 0x04, 1)
    m.setU32(pAltar + 0x0c, 0x25)
    attachRoom(m, pAltar, 78)
    m.setU32(pGame + 0x25 * 4 + 0x1520, pAltar)
    m.setU8(pEx11 + 0x06, 1)
    m.setU32(pEx11 + 0x28, 0x25)
    ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c(m, pGame)
    expect(m.u8(pEx11 + 0x06)).toBe(0)
    expect(m.u32(pEx11 + 0x2c)).toBe(2)
    expect(m.u32(pAltar + 0x10)).toBe(1)
  })

  it('[39..45] Gidbinn/Khalim/Tome alerts, Khalim relic pickup 5D, Tome party complete, and sub-party propagation', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags, pClient } = setupEnv(m, 0)
    attachRoom(m, pPlayer, 75)

    expect(ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c(m, pGame, pPlayer)).toBe(0)

    const { pQuest: pQ12, pQuestEx: pEx12 } = linkQuest(m, pGame, 0x12)
    m.setU8(pQ12 + 0x14, 0x12)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0f, 0)
    const pPickedFlail = makeItem(m, 0) // 'qf1 '
    const pPickupArg = m.alloc(0x20)
    m.setU32(pPickupArg + 0x00, pGame)
    m.setU32(pPickupArg + 0x08, pPickedFlail)
    m.setU32(pPickupArg + 0x0c, pPlayer)
    ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c(m, pQ12, pPickupArg)
    const pQueue = m.u32(pClient + 0x1bc)
    expect(m.u32(pQueue + 0x00)).toBe(6)

    ACT3Q4_CompleteLamEsensTomePartyCallback_6FD064C0_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 1)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0x0d)).toBe(1)

    const pMember = m.alloc(0x100)
    m.setU32(pMember + 0x00, 0)
    m.setU32(pMember + 0x0c, 0x43)
    m.setU32(pMember + 0x80, pGame)
    const pMemData = m.alloc(0x180)
    const pMemFlags = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU32(pMember + 0x14, pMemData)
    m.setU32(pMemData + 0x10, pMemFlags)
    attachRoom(m, pMember, 75)
    m.setU32(pGame + (0x43 & 0x7f) * 4 + 0x1120, pMember)

    const pPartyCtrl = m.alloc(0x10)
    const pSubParty = m.alloc(0x10)
    const pNode1 = m.alloc(0x08)
    const pNode2 = m.alloc(0x08)
    m.setU16(pSubParty, 5)
    m.setU32(pNode1, 0x42)
    m.setU32(pNode1 + 0x04, pNode2)
    m.setU32(pNode2, 0x43)
    m.setU32(pSubParty + 0x04, pNode1)
    m.setU32(pPartyCtrl + 0x04, pSubParty)
    m.setU32(pGame + 0x1d2c, pPartyCtrl)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 0x0d)
    expect(ACT3Q5_PropagateCouncilCompletionToPartyCallback_6FD06980_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pMemFlags, 0x15, 0x0d)).toBe(1)

    m.setU32(pEx12 + 0x18, 3)
    expect(ACT3Q4_PropagateTomeQuestStateToSubParty_6FD06B90_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pMemFlags, 0x14, 3)).toBe(1)

    const { pQuest: pQ0F } = linkQuest(m, pGame, 0x0f)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x10, 0)
    const pBadCtrl = m.alloc(0x20)
    m.setU32(pGame + 0x10f4, pBadCtrl)
    expect(() => ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c(m, pQ0F, pPickupArg)).toThrow(
      D2CommonAssertError,
    )
  })
})
