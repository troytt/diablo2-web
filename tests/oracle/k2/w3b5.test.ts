import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import { QUESTRECORD_SetQuestState113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  ACT5Intro_ActiveFilter_6FC79680_113c,
  ACT5Intro_Callback00_NpcActivate_6FC796B0_113c,
  ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c,
  ACT5Q1_Callback00_NpcActivate_6FC787C0_113c,
  ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c,
  ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F_6FC785C0_113c,
  ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c,
  ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c,
  ACT5Q1_SeqFilter_6FC76D10_113c,
  ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c,
  ACT5Q2_Callback00_NpcActivate_6FC783C0_113c,
  ACT5Q2_FindSpawnedPrisonObjectForUnit_6FC7A290_113c,
  ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c,
  ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c,
  ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c,
  ACT5Q3_ActiveFilter_6FC77F50_113c,
  ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c,
  ACT5Q3_Callback03_OnItemPickedUp_6FC77DD0_113c,
  ACT5Q3_Callback11_OnPlayerConnect_6FC77E80_113c,
  ACT5Q3_GrantScrollOfResistanceStats_6FC7A000_113c,
  ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c,
  ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c,
  ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c,
  ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded_6FC7CF70_113c,
  ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c,
  ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c,
  ACT5Q4_Callback00_NpcActivate_6FC77A60_113c,
  ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c,
  ACT5Q4_CheckPlayerNearNihlathakRoom_6FC77900_113c,
  ACT5Q4_SeqFilter_6FC76B10_113c,
  ACT5Q5_Callback00_NpcActivate_6FC775F0_113c,
  ACT5Q5_SeqFilter_6FC76BD0_113c,
  ACT5Q6_ActiveFilter_6FC76EF0_113c,
  ACT5Q6_Callback00_NpcActivate_6FC77000_113c,
  ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c,
  ACT5Q6_CompleteQuest28AndUpdateProgression_6FC78BE0_113c,
  ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c,
  ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c,
  ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c,
  ACT5Q6_SeqFilter_6FC767A0_113c,
  GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c,
  PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c,
  PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c,
  SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c,
  STATES_OnStateRemovedResetMonsterAi_6FC70130_113c,
} from '../../../src/d2kern-113c/game/k2-w3b5-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { D2ItemStatCostTxt_SIZE } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function setupPlayerAndQuest(questNo = 0x1f, recordId = 0x23) {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1200)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  const pBitMasks = m.u32(0x6fd18be0)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)

  const iscCount = 200
  const pItemStatCostTxt = m.alloc(iscCount * D2ItemStatCostTxt_SIZE)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt, pItemStatCostTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount, iscCount)

  const pMonStatsTxt = m.alloc(0x1a8 * 16)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 16)

  const pMonStateMaskExp = m.alloc(0x40)
  m.setU32(pMonStateMaskExp, 0xffffffff)
  m.setU32(pDataTables + 0xc4, 32)
  m.setU32(pDataTables + 0x104, pMonStateMaskExp)

  m.fill(0x6fd27e00, 0x9000, 0)

  const pGame = m.alloc(0x1df4)
  const pQuestCtrl = m.alloc(0x100)
  const pQuest = m.alloc(0x200)
  const pQuestDataEx = m.alloc(0x200)
  const pMsgTables = m.alloc(0xc4 * 16)
  const pPlayer = m.alloc(0x100)
  const pPlayerData = m.alloc(0x100)
  const pClient = m.alloc(0x520)
  const pPath = m.alloc(0x100)
  const pRoom = m.alloc(0x100)
  const pQuestFlags = m.alloc(0x100)
  const pQuestFlagsBuf = m.alloc(0x100)
  const pIntroData = m.alloc(0x40)
  const pIntroFlags = m.alloc(0x40)
  const pIntroFlagsBuf = m.alloc(0x40)
  const pNpc = m.alloc(0x100)
  const pArg = m.alloc(0x40)
  const pTextHeader = m.alloc(0x40)

  m.setU32(pQuestFlags, pQuestFlagsBuf)
  m.setU32(pQuestFlags + 0x04, 0x60)
  m.setU32(pIntroData, pIntroFlags)
  m.setU32(pIntroFlags, pIntroFlagsBuf)
  m.setU32(pIntroFlags + 0x04, 0x20)

  m.setU32(pGame + 0x10f4, pQuestCtrl)
  m.setU32(pQuestCtrl, pQuest)
  m.setU32(pQuest, questNo)
  m.setU32(pQuest + 0x04, pGame)
  m.setU32(pQuest + 0x18, pQuestDataEx)
  m.setU32(pQuest + 0xdc, pMsgTables)
  m.setU32(pQuest + 0xe0, recordId)

  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPlayer, 0)
  m.setU32(pPlayer + 0x0c, 1)
  m.setU32(pPlayer + 0x14, pPlayerData)
  m.setU32(pPlayer + 0x2c, pPath)
  m.setU32(pPlayerData + 0x10, pQuestFlags)
  m.setU32(pPlayerData + 0x1c, pIntroFlags)
  m.setU32(pPlayerData + 0x60, pIntroData)
  m.setU32(pPlayerData + 0x9c, pClient)

  m.setU32(pNpc, 1)
  m.setU32(pNpc + 0x0c, 2)

  m.setU32(pArg, pGame)
  m.setU32(pArg + 0x08, pNpc)
  m.setU32(pArg + 0x0c, pPlayer)
  m.setU32(pArg + 0x10, pTextHeader)
  m.setU32(pArg + 0x14, pTextHeader)

  return { m, pGame, pQuest, pQuestDataEx, pPlayer, pPlayerData, pQuestFlags, pNpc, pArg }
}

describe('K2 Wave 3 Batch 5 (0x6FC70130..0x6FC7DDF0)', () => {
  it('1..5: STATES_OnStateRemovedResetMonsterAi, SKILLS_ConvertMonsterAndScheduleExpire, GAMETIME_QueueTaskNodeToWorkerList, PLAYERSAVE_ComputeHeaderChecksum, PLAYERSAVE_WriteInventoryAndCursorItems', () => {
    const { m, pGame } = setupPlayerAndQuest()
    const pMon = m.alloc(0x100)
    const pMonData = m.alloc(0x100)
    const pMonStatsRec = m.alloc(0x1a8)
    const pAi = m.alloc(0x80)
    m.setU32(pMon, 1)
    m.setU32(pMon + 0x14, pMonData)
    m.setU32(pMon + 0x80, pGame)
    m.setU32(pMonData, pMonStatsRec)
    m.setU16(pMonStatsRec + 0x1e, 6)
    m.setU32(pMonData + 0x28, pAi)
    m.setU32(pMonData + 0x24, pMonStatsRec)
    m.setU32(pAi, 99)
    STATES_OnStateRemovedResetMonsterAi_6FC70130_113c(m, pMon, 5)
    expect(m.u32(pAi)).toBe(0)

    SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c(m, 0, pGame, pMon, 0, 1)

    const pWorker = m.alloc(0x40)
    const pNode = m.alloc(0x20)
    m.setU32(0x6fd18d10, 1000)
    m.setU32(pWorker + 0x08, pWorker + 0x08)
    m.setU32(pWorker + 0x0c, pWorker + 0x08)
    m.setU32(pWorker + 0x10, 0x6fd30398)
    m.setU32(pWorker + 0x14, 0x6fd30398)
    m.setU32(0x6fd30398, pWorker + 0x10)
    m.setU32(0x6fd3039c, pWorker + 0x10)
    expect(GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c(m, pNode, 0x11, 0x22)).toBe(1)
    expect(m.u32(pNode + 0x04)).toBe(0x11)
    expect(m.u32(pWorker + 0x04)).toBe(1)

    const pSave = m.alloc(0x100)
    m.setU32(pSave + 0x04, 0x60)
    m.setU32(pSave + 0x0c, 0xdeadbeef)
    m.setU8(pSave + 0x08, 0x12)
    const sum = PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c(m, pSave, 0x40)
    expect(sum).not.toBe(0)
    expect(m.u32(pSave + 0x0c) >>> 0).toBe(0xdeadbeef)

    const pBuf = m.alloc(0x40)
    expect(PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c(m, pBuf, 0, 0, 0, 16)).toBe(4)
    expect(m.u16(pBuf)).toBe(0x4d4a)
    expect(m.u16(pBuf + 2)).toBe(0)
  })

  it('6..9: ACT5Q6_SeqFilter, ACT5Q4_SeqFilter, ACT5Q5_SeqFilter, ACT5Q1_SeqFilter', () => {
    const { m, pQuest } = setupPlayerAndQuest(0x24, 0x28)
    m.setU8(pQuest + 0x09, 1)
    m.setU8(pQuest + 0x0c, 0)
    expect(ACT5Q6_SeqFilter_6FC767A0_113c(m, pQuest)).toBe(1)
    expect(m.u8(pQuest + 0x0c)).toBe(1)

    m.setU8(pQuest + 0x0c, 0)
    expect(ACT5Q4_SeqFilter_6FC76B10_113c(m, pQuest)).toBe(1)
    expect(m.u8(pQuest + 0x0c)).toBe(1)

    m.setU8(pQuest + 0x0c, 0)
    expect(ACT5Q5_SeqFilter_6FC76BD0_113c(m, pQuest)).toBe(1)
    expect(m.u8(pQuest + 0x0c)).toBe(1)

    m.setU8(pQuest + 0x0c, 2)
    expect(ACT5Q1_SeqFilter_6FC76D10_113c(m, pQuest)).toBe(1)
  })

  it('10..16: ACT5Q6/Q5/Q4/Q3 filters and callbacks (0x6FC76EF0..0x6FC77E80)', () => {
    const { m, pGame, pQuest, pQuestDataEx, pPlayer, pQuestFlags, pNpc, pArg } =
      setupPlayerAndQuest(0x24, 0x28)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x28, 0)
    m.setU8(pQuestDataEx + 0x90, 0)
    expect(ACT5Q6_ActiveFilter_6FC76EF0_113c(m, pQuest, 0x200, pPlayer, pQuestFlags, pNpc)).toBe(1)

    m.setU32(pNpc + 0x04, 0x200)
    ACT5Q6_Callback00_NpcActivate_6FC77000_113c(m, pQuest, pArg)

    m.setU32(pQuest + 0xe0, 0x27)
    m.setU32(pNpc + 0x04, 0x202)
    m.setU8(pQuest + 0x09, 1)
    m.setU8(pQuest + 0x0c, 1)
    ACT5Q5_Callback00_NpcActivate_6FC775F0_113c(m, pQuest, pArg)

    m.setU32(pQuest, 0x22)
    expect(ACT5Q4_CheckPlayerNearNihlathakRoom_6FC77900_113c(m, pGame, pPlayer)).toBe(0)

    m.setU32(pQuest + 0xe0, 0x26)
    m.setU32(pNpc + 0x04, 0x20f)
    m.setU8(pQuest + 0x0c, 1)
    ACT5Q4_Callback00_NpcActivate_6FC77A60_113c(m, pQuest, pArg)

    m.setU32(pQuest, 0x21)
    m.setU32(pQuest + 0xe0, 0x25)
    m.setU8(pQuest + 0x0c, 2)
    ACT5Q3_Callback03_OnItemPickedUp_6FC77DD0_113c(m, pQuest, pArg)
    ACT5Q3_Callback11_OnPlayerConnect_6FC77E80_113c(m, pQuest, pArg)
  })

  it('17..23: ACT5Q3_ActiveFilter and ACT5Q2/Q1 callbacks (0x6FC77F50..0x6FC787C0)', () => {
    const { m, pGame, pQuest, pQuestDataEx, pPlayer, pQuestFlags, pNpc, pArg } =
      setupPlayerAndQuest(0x21, 0x25)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 1)
    expect(ACT5Q3_ActiveFilter_6FC77F50_113c(m, pQuest, 0x201, pPlayer, pQuestFlags, pNpc)).toBe(1)

    m.setU32(pQuest, 0x20)
    m.setU32(pQuest + 0xe0, 0x24)
    m.setU32(pNpc + 0x04, 0x202)
    m.setU8(pQuest + 0x09, 1)
    m.setU8(pQuest + 0x0c, 1)
    ACT5Q2_Callback00_NpcActivate_6FC783C0_113c(m, pQuest, pArg)
    expect(ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c(m, pGame, pPlayer)).toBe(0)

    m.setU32(pQuest, 0x1f)
    m.setU32(pQuest + 0xe0, 0x23)
    m.setU8(pQuestDataEx + 0x17, 0)
    ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F_6FC785C0_113c(m, pPlayer, pGame)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0)).toBe(1)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 0)
    ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c(m, pGame, pPlayer)
    expect(ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c(m, pGame, pPlayer)).toBe(0)
    ACT5Q1_Callback00_NpcActivate_6FC787C0_113c(m, pQuest, pArg)
  })

  it('24..33: ACT5Q1_SyncPlayerQuestState, ACT5Q6/Q4/Intro helpers (0x6FC78890..0x6FC797B0)', () => {
    const { m, pGame, pQuest, pQuestDataEx, pPlayer, pQuestFlags, pNpc, pArg } =
      setupPlayerAndQuest(0x1f, 0x23)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 0)
    expect(ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c(m, pGame, pPlayer)).toBe(0)

    m.setU32(pQuest, 0x24)
    m.setU32(pQuest + 0xe0, 0x28)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x28, 2)
    ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c(m, pQuest, pArg)
    expect(m.u8(pQuestDataEx + 0x90)).toBe(1)

    m.setU16(pQuestDataEx + 0xa4, 0x1234)
    ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c(m, pPlayer, pGame)
    expect(ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c(m, pGame, pPlayer)).toBe(0)

    ACT5Q6_CompleteQuest28AndUpdateProgression_6FC78BE0_113c(m, pQuestFlags, pPlayer, pGame)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0x0d)).toBe(1)

    ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c(m, pGame, pPlayer)

    m.setU32(pQuest, 0x22)
    m.setU32(pQuest + 0xe0, 0x26)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 0)
    ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c(m, pQuest, pArg)

    expect(ACT5Intro_ActiveFilter_6FC79680_113c(m, pQuest, 0x200, pPlayer)).toBe(0)
    m.setU32(pNpc + 0x04, 0x200)
    ACT5Intro_Callback00_NpcActivate_6FC796B0_113c(m, pQuest, pArg)
    m.setU32(pArg + 0x14, 0x200)
    m.setU16(pArg + 0x18, 0x4e2e)
    ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c(m, pQuest, pArg)
  })

  it('34..45: ACT5Q3/Q2/Q1 preset objects, resistance scroll, prison & Anya helpers (0x6FC79D30..0x6FC7DDF0)', () => {
    const { m, pGame, pQuest, pQuestDataEx, pPlayer, pQuestFlags, pNpc, pArg } =
      setupPlayerAndQuest(0x21, 0x25)
    ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(m, pGame, 0)
    ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(m, pGame, 0)
    ACT5Q3_GrantScrollOfResistanceStats_6FC7A000_113c(m, pPlayer, 10, pGame)

    expect(ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c(m, pPlayer, pGame, 0)).toBe(0)
    const pOutObj = m.alloc(0x10)
    expect(ACT5Q2_FindSpawnedPrisonObjectForUnit_6FC7A290_113c(m, pGame, pPlayer, pOutObj)).toBe(0)
    ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(m, pGame, 0)
    expect(ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c(m, 0, 0, 0)).toBe(0)

    const pCoord = m.alloc(0x20)
    m.setU32(pCoord, pGame)
    m.setU32(pQuestDataEx + 0x88, 0)
    ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded_6FC7CF70_113c(m, pCoord)

    ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c(m, 99, pQuest, pArg)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 0)
    m.setU32(pNpc + 0x04, 0x200)
    ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c(m, pQuest, pArg)

    EVENT_InitTimerQueue113c(m, pGame)
    const pMon = m.alloc(0x100)
    const pMonData = m.alloc(0x80)
    const pMonPath = m.alloc(0x80)
    const pMonRoom = m.alloc(0x80)
    m.setU32(pMonRoom + 0x7c, m.alloc(8))
    m.setU32(pMonData + 0x30, m.alloc(0x20))
    m.setU32(pMonPath + 0x1c, pMonRoom)
    m.setU32(pMon, 1)
    m.setU32(pMon + 0x04, 0x20f)
    m.setU32(pMon + 0x14, pMonData)
    m.setU32(pMon + 0x2c, pMonPath)
    ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c(m, pMon, pQuest)
    expect((m.u32(pMon + 0xc4) & 1) !== 0).toBe(true)

    expect(ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c(m, pGame, 0)).toBe(0)
    expect(ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c(m, pGame, pMon)).toBe(1)
    expect(m.u8(pQuestDataEx + 0xe3)).toBe(1)
  })
})
