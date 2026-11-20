import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { TEXT_AllocTextList113c } from '../../../src/d2kern-113c/common/text.ts'
import * as w5b5Exports from '../../../src/d2kern-113c/game/k2-w5b5-113c.ts'
import {
  ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c,
  ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c,
  ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c,
  ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c,
  ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c,
  ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c,
  ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20_113c,
  ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c,
  ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c,
  ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c,
  ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c,
  ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c,
  ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c,
  ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c,
  ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c,
  ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c,
  ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c,
  ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c,
  ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c,
  ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c,
  ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c,
  ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c,
  ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c,
  ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c,
  ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c,
  ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c,
  ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c,
  ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c,
  ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c,
  ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c,
  ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c,
  ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c,
  ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c,
  ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c,
  MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c,
  NET_SendChatMessagePacket26Wrapper_6FCEB580_113c,
  PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c,
  PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c,
  PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c,
  PACKET_Srv40_RequestQuestLog_6FCEBD30_113c,
  PLAYER_CalcHealingPotionPercent_6FCEB840_113c,
  PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c,
  PLAYER_IssueMercAiMoveCommand_6FCEC750_113c,
  PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c,
  SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c,
} from '../../../src/d2kern-113c/game/k2-w5b5-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  D2ActStrc,
  D2ActiveRoomStrc,
  D2DrlgLevelStrc,
  D2DrlgStrc,
  D2InventoryStrc,
  D2ItemsTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2RoomExStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface TestHarness {
  m: SparseMemory113c
  pDataTables: number
  pGame: number
  pAct: number
  pQuestControl: number
  pGlobalQuestFlags: number
  pItemsTxt: number
}

function createHarness(nDifficulty = 0): TestHarness {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.alloc(0x80))

  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, levelsCount)
  // Level 40..74 are Act 2 (nAct = 1 at +0x03 in LevelsTxt, or DRLG_GetActNoFromLevelId113c)
  m.setU32(pDataTables + 0xa80, 600) // monStatsCount
  m.setU32(pDataTables + 0xba0, 360) // skillsTxtCount

  const itemsCount = 16
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x80, 0x20706976) // 'vip '
  m.setU32(pItemsTxt + 2 * D2ItemsTxt_SIZE + 0x80, 0x20786f62) // 'box '
  m.setU32(pItemsTxt + 3 * D2ItemsTxt_SIZE + 0x80, 0x2066736d) // 'msf '
  m.setU32(pItemsTxt + 4 * D2ItemsTxt_SIZE + 0x80, 0x20317274) // 'tr1 '
  m.setU32(pItemsTxt + 5 * D2ItemsTxt_SIZE + 0x80, 0x20747368) // 'hst '

  const pGame = m.alloc(0x1df4)
  m.setU8(pGame + 0x6d, nDifficulty)
  const pQuestControl = m.alloc(0x40)
  const pGlobalQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  m.setU32(pQuestControl + 0x08, 1)
  m.setU32(pQuestControl + 0x0c, pGlobalQuestFlags)
  m.setU32(pQuestControl + 0x18, 0x12345678)
  m.setU32(pQuestControl + 0x1c, 0x29a)
  m.setU32(pGame + 0x10f4, pQuestControl)

  const pAct = m.alloc(0x80)
  const pDrlg = m.alloc(0x500)
  m.set(pAct, D2ActStrc.pDrlg, pDrlg)
  m.setU32(pGame + 0xc0, pAct)

  return { m, pDataTables, pGame, pAct, pQuestControl, pGlobalQuestFlags, pItemsTxt }
}

function linkQuestNode(
  m: SparseMemory113c,
  pGame: number,
  pQuestControl: number,
  nQuestId: number,
  nQuestNo = nQuestId,
): { pQuest: number; pQuestDataEx: number; pMsgTables: number } {
  const pQuest = m.alloc(0x100)
  const pQuestDataEx = m.alloc(0x100)
  const pMsgTables = m.alloc(0xc4 * 12)
  m.setU32(pQuest + 0x00, nQuestId)
  m.setU32(pQuest + 0x04, pGame)
  m.setU32(pQuest + 0x18, pQuestDataEx)
  m.setU32(pQuest + 0xdc, pMsgTables)
  m.setU32(pQuest + 0xe0, nQuestNo)
  m.setU32(pQuest + 0xf4, m.u32(pQuestControl))
  m.setU32(pQuestControl, pQuest)
  return { pQuest, pQuestDataEx, pMsgTables }
}

function createPlayerWithClient(
  m: SparseMemory113c,
  pGame: number,
  dwGuid = 42,
  nCharClass = 1,
): { pPlayer: number; pPlayerData: number; pQuestFlags: number; pClient: number; pPacketQueue: number } {
  const pPlayer = m.alloc(0x100)
  m.setU32(pPlayer + 0x00, 0)
  m.setU32(pPlayer + 0x04, nCharClass)
  m.setU32(pPlayer + 0x0c, dwGuid)
  m.setU32(pPlayer + 0x20, 0x11223344)
  m.setU32(pPlayer + 0x24, 0x29a)
  m.setU32(pPlayer + 0x80, pGame)

  const pPlayerData = m.alloc(0xc0)
  m.setU32(pPlayer + 0x14, pPlayerData)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  const nDiff = m.u8(pGame + 0x6d)
  m.setU32(pPlayerData + nDiff * 4 + 0x10, pQuestFlags)
  const pIntroData = m.alloc(0x10)
  const pIntroHolder0 = m.alloc(0x08)
  const pIntroHolder1 = m.alloc(0x08)
  m.setU32(pIntroHolder0, m.alloc(0x20))
  m.setU32(pIntroHolder1, m.alloc(0x20))
  m.setU32(pIntroData + 0x00, pIntroHolder0)
  m.setU32(pIntroData + 0x04, pIntroHolder1)
  m.setU32(pPlayerData + nDiff * 4 + 0x60, pIntroData)

  const pClient = m.alloc(0x520)
  const pPacketQueue = m.alloc(0x420)
  m.setU32(pClient + 0x04, 4)
  m.setU8(pClient + 0x1ac, 1)
  m.setU32(pClient + 0x1bc, pPacketQueue)
  m.setU32(pPlayerData + 0x9c, pClient)
  return { pPlayer, pPlayerData, pQuestFlags, pClient, pPacketQueue }
}

function attachCursorQuestItem(
  m: SparseMemory113c,
  pPlayer: number,
  nItemClassId: number,
): number {
  const pInv = m.alloc(0x40)
  m.setU32(pInv + 0x00, 0x01020304)
  const pItem = m.alloc(0x100)
  m.setU32(pItem + 0x00, 4)
  m.setU32(pItem + 0x04, nItemClassId)
  m.setU32(pInv + 0x20, pItem)
  m.setU32(pPlayer + 0x60, pInv)
  return pItem
}

describe('[K2] w5b5 — 45 D2Game.dll functions (0x6FCE3E10..0x6FCEC9D0)', () => {
  it('exports all 45 target functions with _6FCXXXXX_113c naming', () => {
    const fnNames = Object.keys(w5b5Exports).filter(
      (k) => typeof (w5b5Exports as Record<string, unknown>)[k] === 'function',
    )
    expect(fnNames.length).toBe(45)
    for (const name of fnNames) {
      expect(name).toMatch(/_6FCE[0-9A-F]{4}_113c$/)
    }
  })

  it('ports [1..5] ACT2Q2 staff flags/substatus and ACT2Q1 player-enter & NPC dialog', () => {
    const { m, pGame, pQuestControl, pGlobalQuestFlags } = createHarness()
    const { pPlayer, pQuestFlags } = createPlayerWithClient(m, pGame, 101)

    // [1/45] 0x6FCE3E10: clears (10, 4) on 'vip ' (item class 1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0a, 4)
    const pVip = m.alloc(0x40)
    m.setU32(pVip + 0x04, 1)
    const pArg = m.alloc(0x28)
    m.setU32(pArg + 0x00, pGame)
    m.setU32(pArg + 0x08, pVip)
    m.setU32(pArg + 0x0c, pPlayer)
    ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c(m, 0, pArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 4)).toBe(0)

    // [2/45] 0x6FCE3F40: increments pQuestDataEx + 0x14 on quest 9
    const q9 = linkQuestNode(m, pGame, pQuestControl, 9)
    expect(ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u32(q9.pQuestDataEx + 0x14)).toBe(1)

    // [3/45] 0x6FCE4030: resolves 'hst ' (item class 5) -> status 4, return 1
    attachCursorQuestItem(m, pPlayer, 5)
    const pOutStatus = m.alloc(4)
    expect(ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c(m, q9.pQuest, pPlayer, pOutStatus)).toBe(1)
    expect(m.u8(pOutStatus)).toBe(4)

    // [4/45] 0x6FCE41D0: syncs global quest state (9, 0x0D) when player has (9, 0)
    m.setU32(pPlayer + 0x60, 0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 0)
    const q8 = linkQuestNode(m, pGame, pQuestControl, 8, 9)
    m.setU8(q8.pQuest + 0x09, 1)
    m.setU8(q8.pQuest + 0x0c, 2)
    ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c(m, q8.pQuest, pArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pGlobalQuestFlags, 9, 0x0d)).toBe(1)
    expect(m.u8(q8.pQuest + 0x0c)).toBe(0)

    // [5/45] 0x6FCE4320: NPC dialog on state (9, 1) adds msg table 3
    const { pPlayer: pPlr2, pQuestFlags: pFlags2 } = createPlayerWithClient(m, pGame, 102)
    QUESTRECORD_SetQuestState113c(m, pFlags2, 9, 1)
    const pNpc = m.alloc(0x40)
    m.setU32(pNpc + 0x04, 0xb0)
    const pTextList = TEXT_AllocTextList113c(m, 0)
    m.setU32(q8.pMsgTables + 3 * 0xc4 + 0x00, 0xb0)
    m.setU16(q8.pMsgTables + 3 * 0xc4 + 0x04, 555)
    m.setU32(q8.pMsgTables + 3 * 0xc4 + 0xc0, 1)
    m.setU32(pArg + 0x08, pNpc)
    m.setU32(pArg + 0x0c, pPlr2)
    m.setU32(pArg + 0x14, pTextList)
    ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c(m, q8.pQuest, pArg)
    expect(m.u32(pTextList + 0x04)).toBe(1)
  })

  it('ports [6..15] ACT2Q1/ACT2Q0/ACT2Intro/ACT2Q7/ACT2Q6 callbacks and tomb packet 0x50', () => {
    const { m, pGame, pAct, pQuestControl, pGlobalQuestFlags } = createHarness()
    const { pPlayer, pQuestFlags, pPacketQueue } = createPlayerWithClient(m, pGame, 201, 1)
    const q8 = linkQuestNode(m, pGame, pQuestControl, 8, 9)
    m.setU8(q8.pQuest + 0x0c, 2)

    // [6/45] 0x6FCE4430
    ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c(m, pGame, pPlayer)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 2)).toBe(1)

    // [7/45] 0x6FCE44E0
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 8, 0)
    const pArg = m.alloc(0x28)
    m.setU32(pArg + 0x00, pGame)
    m.setU32(pArg + 0x0c, pPlayer)
    const q0 = linkQuestNode(m, pGame, pQuestControl, 7, 8)
    ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c(m, q0.pQuest, pArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pGlobalQuestFlags, 8, 0x0d)).toBe(1)

    // [8/45] 0x6FCE4570 & [9/45] 0x6FCE4620
    const { pPlayer: pPlrB, pQuestFlags: pFlagsB } = createPlayerWithClient(m, pGame, 202, 1)
    const pJerhyn = m.alloc(0x40)
    m.setU32(pJerhyn + 0x04, 0xc9)
    const pTextB = TEXT_AllocTextList113c(m, 0)
    m.setU32(q0.pMsgTables + 0x00, 0xc9)
    m.setU16(q0.pMsgTables + 0x04, 0xfd)
    m.setU32(q0.pMsgTables + 0xc0, 1)
    m.setU32(pArg + 0x08, pJerhyn)
    m.setU32(pArg + 0x0c, pPlrB)
    m.setU32(pArg + 0x14, pTextB)
    ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c(m, q0.pQuest, pArg)
    expect(m.u32(pTextB + 0x04)).toBe(1)

    m.setU16(pArg + 0x14, 0xc9)
    m.setU16(pArg + 0x18, 0xfd)
    ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c(m, q0.pQuest, pArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pFlagsB, 8, 0)).toBe(1)

    // [10/45] 0x6FCE4690 & [11/45] 0x6FCE4780 (Drognan 0xB1 + Sorceress class 1)
    const qIntro = linkQuestNode(m, pGame, pQuestControl, 0x20, 0)
    const pDrognan = m.alloc(0x40)
    m.setU32(pDrognan + 0x04, 0xb1)
    const pTextIntro = TEXT_AllocTextList113c(m, 0)
    m.setU32(qIntro.pMsgTables + 1 * 0xc4 + 0x00, 0xb1)
    m.setU16(qIntro.pMsgTables + 1 * 0xc4 + 0x04, 0x11e)
    m.setU32(qIntro.pMsgTables + 1 * 0xc4 + 0xc0, 1)
    m.setU32(pArg + 0x08, pDrognan)
    m.setU32(pArg + 0x0c, pPlrB)
    m.setU32(pArg + 0x14, pTextIntro)
    ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c(m, qIntro.pQuest, pArg)
    expect(m.u32(pTextIntro + 0x04)).toBe(1)

    m.setU32(pArg + 0x14, 0xb1)
    m.setU16(pArg + 0x18, 0x11e)
    ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c(m, qIntro.pQuest, pArg)

    // [12/45] 0x6FCE4900 & [13/45] 0x6FCE4A40 (Kaelan 0x179)
    const q7 = linkQuestNode(m, pGame, pQuestControl, 0x1e, 0x1e)
    const pGuard = m.alloc(0x40)
    m.setU32(pGuard + 0x04, 0x179)
    m.setU32(pArg + 0x08, pGuard)
    m.setU32(pArg + 0x14, TEXT_AllocTextList113c(m, 0))
    ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c(m, q7.pQuest, pArg)
    m.setU16(pArg + 0x14, 0x179)
    m.setU16(pArg + 0x18, 0x3b)
    ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c(m, q7.pQuest, pArg)
    expect(m.u32(q7.pQuest + 0xa8)).toBe(0x6fce27c0)

    // [14/45] 0x6FCE4AA0 & [15/45] 0x6FCE4B10
    const q6 = linkQuestNode(m, pGame, pQuestControl, 0x0d, 0x0e)
    m.setU8(q6.pQuestDataEx + 0x3d, 1)
    expect(ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c(m, pGame, 0)).toBe(1)
    const pDrlg = m.get(pAct, D2ActStrc.pDrlg)
    m.set(pDrlg, D2DrlgStrc.nBossTombLevel, 0x45)
    ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c(m, pPlayer, pGame)
    expect(m.u32(q6.pQuestDataEx + 0x34)).toBe(0x45)
    expect(m.u32(pPacketQueue + 0x00)).toBe(0x0f)
    expect(m.u8(pPacketQueue + 0x04)).toBe(0x50)
    expect(m.u16(pPacketQueue + 0x07)).toBe(3)
  })

  it('ports [16..32] Duriel progression, eclipse packets 0x53, Radament/staff callbacks, Orifice, and portal/Jerhyn helpers', () => {
    const { m, pGame, pQuestControl } = createHarness(1)
    const { pPlayer, pQuestFlags, pClient, pPacketQueue } = createPlayerWithClient(m, pGame, 301)

    // [16/45] 0x6FCE4C30: expansion bit 0x20 -> actsPerDiff = 5, nDiff = 1 -> targetProg = 7
    m.setU16(pClient + 0x0a, 0x0020)
    ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c(m, pPlayer, pQuestFlags, pGame)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0d)).toBe(1)
    expect((m.u16(pClient + 0x0a) >>> 8) & 0x1f).toBe(7)

    // [17/45] 0x6FCE4CC0
    ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c(m, pGame, pPlayer)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x36)
    expect((m.u32(pPlayer + 0xc4) & 0x400) !== 0).toBe(true)

    // [18/45] 0x6FCE4D30, [19/45] 0x6FCE4E30, [21/45] 0x6FCE5030, [25/45] 0x6FCE52B0, [28/45] 0x6FCE5630
    expect(ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c(m, pGame, pPlayer)).toBe(0)
    expect(ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c(m, pGame, pPlayer)).toBe(0)

    // [20/45] 0x6FCE4EA0 (NPC 0x14B)
    const q4 = linkQuestNode(m, pGame, pQuestControl, 0x0b, 0x0c)
    m.setU8(q4.pQuestDataEx + 0x0e, 0)
    const pNpc14b = m.alloc(0x40)
    m.setU32(pNpc14b + 0x04, 0x14b)
    const pText4 = TEXT_AllocTextList113c(m, 0)
    m.setU32(q4.pMsgTables + 7 * 0xc4 + 0x00, 0x14b)
    m.setU16(q4.pMsgTables + 7 * 0xc4 + 0x04, 701)
    m.setU32(q4.pMsgTables + 7 * 0xc4 + 0xc0, 1)
    const pArg = m.alloc(0x28)
    m.setU32(pArg + 0x00, pGame)
    m.setU32(pArg + 0x08, pNpc14b)
    m.setU32(pArg + 0x0c, pPlayer)
    m.setU32(pArg + 0x14, pText4)
    ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c(m, q4.pQuest, pArg)
    expect(m.u32(pText4 + 0x04)).toBe(1)

    // [22/45] 0x6FCE5090
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0b, 0x0d)
    ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c(m, pGame, pPlayer)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x34)

    // [23/45] 0x6FCE5100 & [24/45] 0x6FCE5190
    m.setU32(pPacketQueue + 0x00, 0)
    ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c(m, pGame, pPlayer)
    expect(m.u32(pPacketQueue + 0x00)).toBe(0x0a)
    expect(m.u8(pPacketQueue + 0x04)).toBe(0x53)
    expect(m.u32(pPacketQueue + 0x05)).toBe(2)

    ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c(m, pGame, pPlayer)
    expect(m.u32(pPacketQueue + 0x00)).toBe(0x1a)
    expect(m.u8(pPacketQueue + 0x0e)).toBe(0x53)
    expect(m.u32(pPacketQueue + 0x0f)).toBe(5)
    expect(m.u8(pPacketQueue + 0x17)).toBe(1)
    expect(m.u8(pPacketQueue + 0x18)).toBe(0x5d)

    // [26/45] 0x6FCE54A0 & [27/45] 0x6FCE55B0
    const q8 = linkQuestNode(m, pGame, pQuestControl, 8, 9)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 5)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 0x0d)
    ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c(m, pGame, pPlayer)
    expect(m.u32(q8.pQuestDataEx + 0x0c)).toBe(1)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x32)

    const { pPlayer: pPlrAct2, pQuestFlags: pFlagsAct2 } = createPlayerWithClient(m, pGame, 302)
    const pPath = m.alloc(0x40)
    const pRoom = m.alloc(0x80)
    const pRoomEx = m.alloc(0x80)
    const pLevel = m.alloc(0x200)
    m.set(pLevel, D2DrlgLevelStrc.nLevelId, 40)
    m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
    m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
    m.setU32(pPath + 0x1c, pRoom)
    m.setU32(pPlrAct2 + 0x2c, pPath)
    ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c(m, pGame, pPlrAct2)
    expect(DRLGWARP_TestRoomTileBit113c(m, pFlagsAct2, 9, 1)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pFlagsAct2, 9, 5)).toBe(1)

    // [29/45] 0x6FCE5F30
    const q2 = linkQuestNode(m, pGame, pQuestControl, 9, 0x0a)
    m.setU8(q2.pQuest + 0x08, 1)
    const pCube = m.alloc(0x40)
    m.setU32(pCube + 0x04, 2) // 'box '
    m.setU32(pArg + 0x08, pCube)
    m.setU32(pArg + 0x0c, pPlrAct2)
    ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c(m, q2.pQuest, pArg)
    expect(m.u8(q2.pQuest + 0x0b)).toBe(6)

    // [30/45] 0x6FCE6240
    linkQuestNode(m, pGame, pQuestControl, 0x0d, 0x0e)
    const pInvOrifice = m.alloc(0x40)
    m.setU32(pInvOrifice + 0x00, 0x01020304)
    const pStaffItem = m.alloc(0x100)
    const pStaffItemData = m.alloc(0x80)
    m.setU32(pStaffItem + 0x00, 4)
    m.setU32(pStaffItem + 0x04, 5) // 'hst '
    m.setU32(pStaffItem + 0x14, pStaffItemData)
    m.set(pInvOrifice, D2InventoryStrc.pFirstItem, pStaffItem)
    m.setU32(pPlrAct2 + 0x60, pInvOrifice)
    const pOrifice = m.alloc(0x100)
    m.setU32(pOrifice + 0x00, 2)
    m.setU32(pOrifice + 0x0c, 777)
    m.setU32(pOrifice + 0x10, 0)
    m.setU32(pOrifice + 0x2c, m.alloc(0x20))
    const pOp = m.alloc(0x20)
    m.setU32(pOp + 0x00, pGame)
    m.setU32(pOp + 0x04, pOrifice)
    m.setU32(pOp + 0x08, pPlrAct2)
    expect(ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c(m, pOp)).toBe(0)
    expect(m.u8(pPlrAct2 + 0x6c)).toBe(1)
    expect(m.u32(pPlrAct2 + 0x64)).toBe(777)
    expect(m.u32(pPlrAct2 + 0x68)).toBe(2)

    // [31/45] 0x6FCE7C20 & [32/45] 0x6FCE7FB0 (early-exit gate checks)
    const q0 = linkQuestNode(m, pGame, pQuestControl, 7, 8)
    m.setU8(q0.pQuestDataEx + 0x0d, 1)
    ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20_113c(m, q0.pQuest, pArg)
    expect(ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c(m, pGame, m.alloc(8), m.alloc(4))).toBe(0)
  })

  it('ports [33..45] Jerhyn relocate, Arcane portal init, MONREG, packets 0x3B/0x26/0x3C/0x40/0x2F, skill/shrine/potion calcs, 0x5A slain, and merc AI move', () => {
    const { m, pDataTables, pGame, pQuestControl } = createHarness(0)
    const { pPlayer, pPlayerData, pClient, pPacketQueue } = createPlayerWithClient(m, pGame, 401, 1)

    // [33/45] 0x6FCE8FD0 (early exit when +0x0C == 0 and +0x0D == 1)
    const q0 = linkQuestNode(m, pGame, pQuestControl, 7, 8)
    m.setU8(q0.pQuestDataEx + 0x0d, 1)
    ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c(m, m.alloc(8), q0.pQuest, 0)

    // [34/45] 0x6FCE99B0 (level mismatch safe exit)
    const q4 = linkQuestNode(m, pGame, pQuestControl, 0x0b, 0x0c)
    void q4
    const pInit = m.alloc(0x10)
    m.setU32(pInit + 0x00, pGame)
    ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c(m, pInit)

    // [35/45] 0x6FCEA410: MONREG transfer & evil unique decrement
    const ppMonReg = m.alloc(0x20)
    const pSrcReg = m.alloc(0x300)
    const pDstReg = m.alloc(0x300)
    m.setU32(ppMonReg + 0x00, pSrcReg)
    m.setU32(ppMonReg + 0x04, pDstReg)
    m.setU32(pSrcReg + 0x2cc, 10)
    m.setU32(pSrcReg + 0x2c8, 3)
    const pMon = m.alloc(0x100)
    const pMonData = m.alloc(0x80)
    m.setU32(pMon + 0x00, 1)
    m.setU32(pMon + 0x14, pMonData)
    m.setU8(pMonData + 0x16, 1)
    MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c(m, ppMonReg, 1, 0, 0, 0, 0, pMon)
    expect(m.u32(pMonData + 0x58)).toBe(1)
    expect(m.u32(pSrcReg + 0x2cc)).toBe(9)
    expect(m.u32(pSrcReg + 0x2c8)).toBe(2)

    // [36/45] 0x6FCEB4A0: PACKET_Srv3B
    const pPkt3B = m.alloc(8)
    m.setU8(pPkt3B + 0x00, 0x3b)
    m.setU16(pPkt3B + 0x01, 900) // >= monStatsCount(600) -> 2
    expect(PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c(m, pGame, pPlayer, 0, 1)).toBe(3)
    expect(PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c(m, pGame, pPlayer, pPkt3B, 3)).toBe(2)
    m.setU16(pPkt3B + 0x01, 0xb1)
    expect(PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c(m, pGame, pPlayer, pPkt3B, 3)).toBe(0)

    // [37/45] 0x6FCEB580: NET_SendChatMessagePacket26Wrapper
    const pChat = m.alloc(0x120)
    m.setU8(pChat + 0x00, 0x26)
    m.setU8(pChat + 0x01, 1)
    m.setU8(pChat + 0x0a, 0x41) // 'A'
    m.setU8(pChat + 0x1b, 0x42) // 'B'
    m.setU32(pPacketQueue + 0x00, 0)
    NET_SendChatMessagePacket26Wrapper_6FCEB580_113c(m, pClient, pChat)
    expect(m.u32(pPacketQueue + 0x00)).toBeGreaterThan(0)

    // [38/45] 0x6FCEB610: SKILLS_ValidateSkillAllocationEligibility
    expect(SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c(m, -1, pPlayer)).toBe(2)
    expect(SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c(m, 500, pPlayer)).toBe(2)

    // [39/45] 0x6FCEB720 & [40/45] 0x6FCEB840: Shrine mana & Healing potion percent
    m.setU32(pDataTables + 0xbc8, 7)
    const pCharStats = m.alloc(7 * 0xc4)
    m.setU8(pCharStats + 1 * 0xc4 + 0x3a, 120)
    m.setU32(pDataTables + 0xbc4, pCharStats)
    m.setU32(pDataTables + 0xbd4, 360)
    m.setU32(pDataTables + 0xbcc, m.alloc(360 * 0x144))

    const pBaseStats = STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
    m.setU32(pPlayer + 0x5c, pBaseStats)
    STATLIST_SetUnitStat113c(m, pPlayer, 6, 50 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 7, 100 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 8, 25 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 9, 100 << 8, 0)
    const pShrineList = STATLIST_AllocList113c(m, 0, 0, 0, 0x6a, 2000)
    STATLIST_MergeStatLists113c(m, pPlayer, pShrineList, 1)

    const pHealList = STATLIST_AllocList113c(m, 0, 0, 0, 0x64, 60)
    STATLIST_SetStat113c(m, pHealList, 0x4a, 2 << 8, 0)
    STATLIST_MergeStatLists113c(m, pPlayer, pHealList, 1)

    m.setU32(pGame + 0xa8, 50)
    expect(PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c(m, pPlayer)).toBe(85)
    expect(PLAYER_CalcHealingPotionPercent_6FCEB840_113c(m, pPlayer)).toBe(70)

    // [41/45] 0x6FCEBC70: PACKET_Srv3C (clear hotkey via 0xFFFF -> wSkillId = -1)
    const pPkt3C = m.alloc(12)
    m.setU32(pPkt3C + 0x01, (2 << 16) | 0xffff)
    m.setU32(pPkt3C + 0x05, 0xffffffff)
    expect(PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c(m, pGame, pPlayer, pPkt3C, 4)).toBe(3)
    expect(PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c(m, pGame, pPlayer, pPkt3C, 9)).toBe(0)

    // [42/45] 0x6FCEBD30: PACKET_Srv40
    expect(PACKET_Srv40_RequestQuestLog_6FCEBD30_113c(m, pGame, pPlayer, pPkt3C, 2)).toBe(3)
    expect(PACKET_Srv40_RequestQuestLog_6FCEBD30_113c(m, pGame, pPlayer, pPkt3C, 1)).toBe(0)

    // [43/45] 0x6FCEC370: PLRMODES_BroadcastSlainPlayerPacket5A
    expect(() => PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c(m, 0, 0, pGame)).toThrow(
      D2CommonAssertError,
    )
    m.setU8(pClient + 0x0d, 0x48) // 'H'
    m.setU32(pGame + 0x88, pClient)
    m.setU32(pPacketQueue + 0x00, 0)
    PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c(m, pPlayer, 0, pGame)
    expect(m.u32(pPacketQueue + 0x00)).toBe(0x28)
    expect(m.u8(pPacketQueue + 0x04)).toBe(0x5a)

    // [44/45] 0x6FCEC750: PLAYER_IssueMercAiMoveCommand
    const dwMercGuid = 0x55
    const pMerc = m.alloc(0x100)
    const pMercMonData = m.alloc(0x80)
    const pAiGen = m.alloc(0x40)
    m.setU32(pMerc + 0x00, 1)
    m.setU32(pMerc + 0x0c, dwMercGuid)
    m.setU32(pMerc + 0x14, pMercMonData)
    m.setU32(pMercMonData + 0x28, pAiGen)
    m.setU32(pGame + 0x1320 + ((dwMercGuid & 0x7f) << 2), pMerc)

    m.setU32(pDataTables + 0xbf0, 16)
    const pPetWrapper = m.alloc(8)
    const pPetArr = m.alloc(0x80)
    const pPetNode = m.alloc(0x20)
    m.setU32(pPetNode + 0x04, dwMercGuid)
    m.setU32(pPetArr + 0x54, pPetNode)
    m.setU32(pPetWrapper + 0x00, pPetArr)
    m.setU32(pPlayerData + 0x44, pPetWrapper)
    expect(PLAYER_IssueMercAiMoveCommand_6FCEC750_113c(m, pGame, dwMercGuid, pPlayer, 120, 140, 0x0d)).toBe(0)
    const pCmdHead = m.u32(pAiGen + 0x20)
    expect(pCmdHead).not.toBe(0)
    expect(m.u32(pCmdHead + 0x08)).toBe(0x0d)
    expect(m.u32(pCmdHead + 0x0c)).toBe(120)
    expect(m.u32(pCmdHead + 0x10)).toBe(140)

    // [45/45] 0x6FCEC9D0: PACKET_Srv2F
    const pPkt2F = m.alloc(12)
    m.setU32(pPkt2F + 0x01, 999)
    m.setU16(pPkt2F + 0x05, 0x3b)
    expect(PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c(m, pGame, pPlayer, pPkt2F, 5)).toBe(3)
    expect(PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c(m, pGame, pPlayer, pPkt2F, 9)).toBe(0)
  })
})
