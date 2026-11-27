import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATES_CheckGfxStateFlag113c,
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_CreateEx113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import * as w2b7Exports from '../../../src/d2kern-113c/game/k2-w2b7-113c.ts'
import {
  ACT2Q0_ActiveFilter_6FCE2590_113c,
  ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c,
  ACT2Q0_StatusFilter_6FCE25C0_113c,
  ACT2Q1_Callback10_RemovePlayerGuid_6FCE44D0_113c,
  ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c,
  ACT2Q1_UnitIterateSetCompletionState_6FCE5560_113c,
  ACT2Q2_AddStaffCount_6FCE2380_113c,
  ACT2Q2_Callback10_RemovePlayerGuid_6FCE3EB0_113c,
  ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c,
  ACT2Q2_NoOp_6FCE2450_113c,
  ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c,
  ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c,
  ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c,
  ACT2Q3_GetAltarState_6FCE2120_113c,
  ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c,
  ACT2Q3_IsEclipseInactive_6FCE21A0_113c,
  ACT2Q3_NoOpA_6FCE2350_113c,
  ACT2Q3_NoOpB_6FCE2360_113c,
  ACT2Q3_NoOpC_6FCE2370_113c,
  ACT2Q3_UnitIterateSetCompletionState_6FCE5260_113c,
  ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c,
  ACT2Q4_Callback10_RemovePlayerGuid_6FCE3620_113c,
  ACT2Q4_InitArcanePortalObject_6FCE32C0_113c,
  ACT2Q4_IsPortalOpen_6FCE2040_113c,
  ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c,
  ACT2Q4_UnitIterateSetQuest12State14_6FCE3510_113c,
  ACT2Q5_Callback10_RemovePlayerGuid_6FCE2F00_113c,
  ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c,
  ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c,
  ACT2Q5_UnitIterateSetCompletionState_6FCE4D90_113c,
  ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c,
  ACT2Q6_Callback10_RemovePlayerGuid_6FCE2AF0_113c,
  ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c,
  ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c,
  ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c,
  ACT2Q7_ActiveFilter_6FCE2750_113c,
  ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c,
  ACT2Q7_ClearNpcIdleTimerOnInteract_6FCE27C0_113c,
  ACT2Q8_ActiveFilter_6FCE25D0_113c,
  ACT2Q8_StatusFilter_6FCE25E0_113c,
  MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c,
  PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c,
  PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c,
  PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c,
  STATES_ClearGfxStateFlag_6FCEB1A0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b7-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { D2ItemsTxt_SIZE, D2LevelsTxt_SIZE } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface TestHarness {
  m: SparseMemory113c
  pGame: number
  pAct: number
  pQuestControl: number
}

function createHarness(nDifficulty = 0): TestHarness {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)

  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, levelsCount)

  const itemsCount = 16
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE)
  m.setU32(SG_ITEM_DATATABLES_VA_113C, itemsCount)
  m.setU32(SG_ITEM_DATATABLES_VA_113C + 4, pItemsTxt)
  m.setU32(pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x80, 0x20786f62) // 'box '

  const pGame = m.alloc(0x1df4)
  m.setU8(pGame + 0x6d, nDifficulty)
  const pQuestControl = m.alloc(0x40)
  m.setU32(pGame + 0x10f4, pQuestControl)

  const pAct = m.alloc(0x80)
  m.setU32(pAct + 0x04, pGame)
  const pEnv = m.alloc(0x40)
  m.setU32(pAct + 0x04, pGame)
  m.setU32(pGame + 0xc0, pAct)
  // Note: pAct+0x04 is shared between D2ActStrc->pEnvironment in D2Common and D2DrlgActStrc->pGame in D2Game
  void pEnv

  return { m, pGame, pAct, pQuestControl }
}

function linkQuestNode(
  m: SparseMemory113c,
  pQuestControl: number,
  nQuestId: number,
  pDataExSize = 0x100,
): { pQuest: number; pQuestDataEx: number } {
  const pQuest = m.alloc(0x100)
  const pQuestDataEx = m.alloc(pDataExSize)
  m.setU32(pQuest + 0x00, nQuestId)
  m.setU32(pQuest + 0x18, pQuestDataEx)
  m.setU32(pQuest + 0xf4, m.u32(pQuestControl))
  m.setU32(pQuestControl, pQuest)
  return { pQuest, pQuestDataEx }
}

function createPlayerWithQuestFlags(
  m: SparseMemory113c,
  pGame: number,
  dwGuid = 42,
): { pPlayer: number; pPlayerData: number; pQuestFlags: number } {
  const pPlayer = m.alloc(0x100)
  m.setU32(pPlayer + 0x00, 0) // UNIT_PLAYER
  m.setU32(pPlayer + 0x0c, dwGuid)
  const pPlayerData = m.alloc(0xc0)
  m.setU32(pPlayer + 0x14, pPlayerData)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  const nDiff = m.u8(pGame + 0x6d)
  m.setU32(pPlayerData + nDiff * 4 + 0x10, pQuestFlags)
  return { pPlayer, pPlayerData, pQuestFlags }
}

describe('[K2] w2b7 — 45 D2Game.dll functions (0x6FCE1F90..0x6FCEB4E0)', () => {
  it('exports all 45 target functions with _6FCXXXXX_113c naming', () => {
    const fnNames = Object.keys(w2b7Exports).filter(
      (k) => typeof (w2b7Exports as Record<string, unknown>)[k] === 'function',
    )
    expect(fnNames.length).toBe(45)
    for (const name of fnNames) {
      expect(name).toMatch(/_6FCE[0-9A-F]{4}_113c$/)
    }
  })

  it('ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c & ACT2Q4_IsPortalOpen_6FCE2040_113c', () => {
    const { m, pGame, pQuestControl } = createHarness()
    expect(ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c(m, pGame)).toBe(0)
    expect(ACT2Q4_IsPortalOpen_6FCE2040_113c(m, pGame)).toBe(0)

    linkQuestNode(m, pQuestControl, 9)
    const { pQuestDataEx } = linkQuestNode(m, pQuestControl, 0x0b)
    expect(ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c(m, pGame)).toBe(0)

    m.setU8(pQuestDataEx + 0x0f, 1)
    m.setU8(pQuestDataEx + 0x10, 0)
    expect(ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c(m, pGame)).toBe(1)
    expect(m.u8(pQuestDataEx + 0x10)).toBe(1)
    // Second call returns 0 because +0x10 is already 1
    expect(ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c(m, pGame)).toBe(0)

    expect(ACT2Q4_IsPortalOpen_6FCE2040_113c(m, pGame)).toBe(0)
    m.setU16(pQuestDataEx + 0x40, 2)
    expect(ACT2Q4_IsPortalOpen_6FCE2040_113c(m, pGame)).toBe(1)
  })

  it('ACT2Q3_GetAltarState_6FCE2120_113c, ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c, ACT2Q3_IsEclipseInactive_6FCE21A0_113c & NoOps', () => {
    const { m, pGame, pAct, pQuestControl } = createHarness()
    expect(ACT2Q3_GetAltarState_6FCE2120_113c(m, pAct)).toBe(0)
    expect(ACT2Q3_IsEclipseInactive_6FCE21A0_113c(m, pGame)).toBe(1)

    const { pQuest, pQuestDataEx } = linkQuestNode(m, pQuestControl, 0x0a)
    m.setU8(pQuestDataEx + 0x04, 7)
    expect(ACT2Q3_GetAltarState_6FCE2120_113c(m, pAct)).toBe(7)

    // bNotIntro == 0 -> returns 1
    m.setU8(pQuest + 0x09, 0)
    expect(ACT2Q3_IsEclipseInactive_6FCE21A0_113c(m, pGame)).toBe(1)
    // bNotIntro == 1, nSeqFilter == 3 (< 4) -> returns 0
    m.setU8(pQuest + 0x09, 1)
    m.setU8(pQuest + 0x0c, 3)
    expect(ACT2Q3_IsEclipseInactive_6FCE21A0_113c(m, pGame)).toBe(0)
    // bNotIntro == 1, nSeqFilter == 4 (>= 4) -> returns 1
    m.setU8(pQuest + 0x0c, 4)
    expect(ACT2Q3_IsEclipseInactive_6FCE21A0_113c(m, pGame)).toBe(1)

    // InitAct2EclipseIfActive: nAct != 1 does nothing
    const pAct1 = m.alloc(0x60)
    const pEnv = m.alloc(0x40)
    m.setU32(pAct1 + 0x04, pEnv)
    m.setU32(pGame + 0xc0, pAct1)
    m.setU8(pQuestDataEx + 0x03, 1)
    ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c(m, 0, pGame)
    expect(m.u8(pQuestDataEx + 0x03)).toBe(1)

    // nAct == 1 triggers ENV_InitEclipseEnvironment113c and updates +0x03=0, +0x02=1
    ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c(m, 1, pGame)
    expect(m.u8(pQuestDataEx + 0x03)).toBe(0)
    expect(m.u8(pQuestDataEx + 0x02)).toBe(1)
    expect(m.u32(pEnv + 0x30)).toBe(1)

    // Single-byte ret stubs
    expect(ACT2Q3_NoOpA_6FCE2350_113c(m)).toBeUndefined()
    expect(ACT2Q3_NoOpB_6FCE2360_113c(m)).toBeUndefined()
    expect(ACT2Q3_NoOpC_6FCE2370_113c(m)).toBeUndefined()
    expect(ACT2Q2_NoOp_6FCE2450_113c(m)).toBeUndefined()
  })

  it('ACT2Q2_AddStaffCount_6FCE2380_113c & ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c', () => {
    const { m, pGame, pAct, pQuestControl } = createHarness()
    ACT2Q2_AddStaffCount_6FCE2380_113c(m, pAct, 3)
    expect(ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c(m, pGame)).toBe(1)

    const { pQuestDataEx: pQ2Ex } = linkQuestNode(m, pQuestControl, 9)
    m.setU32(pQ2Ex + 0x24, 10)
    ACT2Q2_AddStaffCount_6FCE2380_113c(m, pAct, 5)
    expect(m.u32(pQ2Ex + 0x24)).toBe(15)
    ACT2Q2_AddStaffCount_6FCE2380_113c(m, pAct, -4)
    expect(m.u32(pQ2Ex + 0x24)).toBe(11)

    const { pQuest: pQ1 } = linkQuestNode(m, pQuestControl, 8)
    m.setU8(pQ1 + 0x09, 0)
    expect(ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c(m, pGame)).toBe(1)
    m.setU8(pQ1 + 0x09, 1)
    m.setU8(pQ1 + 0x0c, 3)
    expect(ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c(m, pGame)).toBe(0)
    m.setU8(pQ1 + 0x0c, 5)
    expect(ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c(m, pGame)).toBe(1)
  })

  it('ACT2Q0 / ACT2Q8 active & status filters (0x6FCE2590..0x6FCE25E0)', () => {
    const { m, pGame } = createHarness()
    const { pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m, pGame)
    expect(ACT2Q0_ActiveFilter_6FCE2590_113c(m, 0, 100, pPlayer, pQuestFlags, 0)).toBe(0)
    expect(ACT2Q0_ActiveFilter_6FCE2590_113c(m, 0, 0xc9, pPlayer, pQuestFlags, 0)).toBe(1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 8, 0)
    expect(ACT2Q0_ActiveFilter_6FCE2590_113c(m, 0, 0xc9, pPlayer, pQuestFlags, 0)).toBe(0)

    expect(ACT2Q0_StatusFilter_6FCE25C0_113c(m)).toBe(0)
    expect(ACT2Q8_ActiveFilter_6FCE25D0_113c(m)).toBe(0)

    const pStatus = m.alloc(4)
    m.setU8(pStatus, 0x7f)
    expect(ACT2Q8_StatusFilter_6FCE25E0_113c(m, 0, pPlayer, 0, 0, pStatus)).toBe(0)
    expect(m.u8(pStatus)).toBe(0)
  })

  it('ACT2Q7 callbacks & active filter (0x6FCE2720, 0x6FCE2750, 0x6FCE27C0)', () => {
    const { m, pGame } = createHarness(1)
    const { pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m, pGame)
    const pQuestData = m.alloc(0x100)
    const pQuestDataEx = m.alloc(0x40)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQuestDataEx)

    const pQuestArg = m.alloc(0x30)
    m.setU32(pQuestArg + 0x00, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU16(pQuestArg + 0x14, 0x17a)
    m.setU16(pQuestArg + 0x18, 0x100)
    ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c(m, pQuestData, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1f, 0)).toBe(0)

    m.setU16(pQuestArg + 0x18, 0x12f)
    ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c(m, pQuestData, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1f, 0)).toBe(1)

    // ActiveFilter 0x6FCE2750
    expect(ACT2Q7_ActiveFilter_6FCE2750_113c(m, pQuestData, 0x100, pPlayer)).toBe(0)
    // Both (0x1E, 0) and (0x1E, 0x0D) are 0 -> 1
    expect(ACT2Q7_ActiveFilter_6FCE2750_113c(m, pQuestData, 0x179, pPlayer)).toBe(1)
    // Set (0x1E, 0x0D) = 1 while (9, 0x0D) = 0 -> 0
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1e, 0x0d)
    expect(ACT2Q7_ActiveFilter_6FCE2750_113c(m, pQuestData, 0x179, pPlayer)).toBe(0)
    // Set (9, 0x0D) = 1 while (0x1E, 0) = 0 -> 1
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 0x0d)
    expect(ACT2Q7_ActiveFilter_6FCE2750_113c(m, pQuestData, 0x179, pPlayer)).toBe(1)
    // Set (0x1E, 0) = 1 -> 0
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1e, 0)
    expect(ACT2Q7_ActiveFilter_6FCE2750_113c(m, pQuestData, 0x179, pPlayer)).toBe(0)

    // ClearNpcIdleTimerOnInteract 0x6FCE27C0
    const pNpc = m.alloc(0x40)
    m.setU16(pNpc + 0x04, 0x179)
    m.setU32(pQuestArg + 0x08, pNpc)
    m.setU8(pQuestDataEx, 1)
    m.setU32(pQuestData + 0xa8, 999)
    ACT2Q7_ClearNpcIdleTimerOnInteract_6FCE27C0_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestDataEx)).toBe(0)
    expect(m.u32(pQuestData + 0xa8)).toBe(0)
  })

  it('ACT2Q6 Orifice, ClearQuest10State9, SetQuest14State2 & Completion (0x6FCE27F0, 0x6FCE29C0, 0x6FCE2A90, 0x6FCE4BD0)', () => {
    const { m, pGame, pQuestControl } = createHarness()
    const { pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m, pGame, 77)
    const { pQuest: pQ6, pQuestDataEx: pQ6Ex } = linkQuestNode(m, pQuestControl, 0x0d)

    const pObj = m.alloc(0x100)
    m.setU32(pObj + 0x00, 2) // UNIT_OBJECT
    m.setU32(pObj + 0x0c, 0xabcddcba)
    const pStaticPath = m.alloc(0x30)
    m.setU32(pObj + 0x2c, pStaticPath)
    const pInteractArg = m.alloc(0x10)
    m.setU32(pInteractArg + 0x00, pGame)
    m.setU32(pInteractArg + 0x04, pObj)

    // bNotIntro == 0 -> sets mode 2
    m.setU8(pQ6 + 0x09, 0)
    ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c(m, pInteractArg)
    expect(m.u8(pQ6Ex + 0x05)).toBe(1)
    expect(m.u32(pQ6Ex + 0x2c) >>> 0).toBe(0xabcddcba)
    expect(m.u32(pObj + 0x10)).toBe(2)

    // bNotIntro == 1 -> sets mode from [pQ6Ex + 0x18]
    m.setU8(pQ6 + 0x09, 1)
    m.setU32(pQ6Ex + 0x18, 4)
    ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c(m, pInteractArg)
    expect(m.u32(pObj + 0x10)).toBe(4)

    // ClearQuest10State9ForPlayer
    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 0x00, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0a, 9)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 9)).toBe(1)
    ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c(m, pQ6, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 9)).toBe(0)

    // UnitIterateSetQuest14State2
    m.setU8(pQ6 + 0x0c, 1)
    expect(ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 2)).toBe(0)
    m.setU8(pQ6 + 0x0c, 2)
    expect(ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 2)).toBe(1)

    // UnitIterateSetCompletionState (0x6FCE4BD0)
    expect(ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0e)).toBe(1)
  })

  it('Guid removal wrappers & callbacks (0x6FCE2AF0, 0x6FCE2F00, 0x6FCE3620, 0x6FCE3970, 0x6FCE3EB0, 0x6FCE44D0, 0x6FCE4550)', () => {
    const { m, pGame } = createHarness()
    const { pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m, pGame, 0x55)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 10, 0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 10, 1)

    const pQuestData = m.alloc(0x100)
    const pQuestDataEx = m.alloc(0x100)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQuestDataEx)
    m.setU32(pQuestData + 0xe0, 10)

    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 0x0c, pPlayer)

    // Populate guid list at pQuestData + 0x1C
    const resetMainGuidList = () => {
      m.setU32(pQuestData + 0x1c, 0x55)
      m.setU16(pQuestData + 0x9c, 1)
    }

    resetMainGuidList()
    ACT2Q6_Callback10_RemovePlayerGuid_6FCE2AF0_113c(m, pQuestData, pQuestArg)
    expect(m.u16(pQuestData + 0x9c)).toBe(0)

    resetMainGuidList()
    ACT2Q5_Callback10_RemovePlayerGuid_6FCE2F00_113c(m, pQuestData, pQuestArg)
    expect(m.u16(pQuestData + 0x9c)).toBe(0)

    resetMainGuidList()
    ACT2Q4_Callback10_RemovePlayerGuid_6FCE3620_113c(m, pQuestData, pQuestArg)
    expect(m.u16(pQuestData + 0x9c)).toBe(0)

    resetMainGuidList()
    m.setU32(pQuestDataEx + 0x14, 0x55)
    m.setU16(pQuestDataEx + 0x94, 1)
    expect(ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c(m, pQuestData, pQuestArg)).toBe(1)
    expect(m.u16(pQuestData + 0x9c)).toBe(0)
    expect(m.u16(pQuestDataEx + 0x94)).toBe(0)

    resetMainGuidList()
    ACT2Q2_Callback10_RemovePlayerGuid_6FCE3EB0_113c(m, pQuestData, pQuestArg)
    expect(m.u16(pQuestData + 0x9c)).toBe(0)

    resetMainGuidList()
    ACT2Q1_Callback10_RemovePlayerGuid_6FCE44D0_113c(m, pQuestData, pQuestArg)
    expect(m.u16(pQuestData + 0x9c)).toBe(0)

    // ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c removes from pQuestDataEx + 0x00
    m.setU32(pQuestDataEx + 0x00, 0x55)
    m.setU16(pQuestDataEx + 0x80, 1)
    expect(ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c(m, pQuestData, pQuestArg)).toBe(1)
    expect(m.u16(pQuestDataEx + 0x80)).toBe(0)
  })

  it('ACT2Q5 started state, completion & Arcane Sanctuary sound (0x6FCE2DC0, 0x6FCE4D90, 0x6FCE4DE0)', () => {
    const { m, pGame } = createHarness()
    const { pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m, pGame)
    const pQuestData = m.alloc(0x100)
    m.setU32(pQuestData + 0xe0, 0x0d)
    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 0x00, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 2)
    ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c(m, pQuestData, pQuestArg)
    expect(m.u8(pQuestData + 0x0b)).toBe(2)
    expect(m.u8(pQuestData + 0x0c)).toBe(1)

    // Completion state 0x6FCE4D90
    expect(ACT2Q5_UnitIterateSetCompletionState_6FCE4D90_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0x0e)).toBe(1)

    // PlaySummonerTauntInArcane 0x6FCE4DE0
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 0x0d)
    const pDynPath = m.alloc(0x40)
    const pRoom = m.alloc(0x40)
    const pRoomEx = m.alloc(0x80)
    const pLevel = m.alloc(0x200)
    m.setU32(pLevel + 0x1d0, 0x4a) // Arcane Sanctuary = 74
    m.setU32(pRoomEx + 0x58, pLevel)
    m.setU32(pRoom + 0x10, pRoomEx)
    m.setU32(pDynPath + 0x1c, pRoom)
    m.setU32(pPlayer + 0x2c, pDynPath)

    expect(ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x33)
    expect(m.u32(pPlayer + 0x70)).toBe(pPlayer)
    expect((m.u32(pPlayer + 0xc4) & 0x400) !== 0).toBe(true)
  })

  it('ACT2Q4 UnitIterate & Arcane Portal Object init (0x6FCE3190, 0x6FCE32C0, 0x6FCE3510)', () => {
    const { m, pGame, pQuestControl } = createHarness()
    const { pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m, pGame)
    expect(ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c(m, pGame, pPlayer)).toBe(0)

    expect(ACT2Q4_UnitIterateSetQuest12State14_6FCE3510_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0x0e)).toBe(1)

    const { pQuestDataEx } = linkQuestNode(m, pQuestControl, 0x0b)
    m.setU16(pQuestDataEx + 0x40, 1)
    const pObj = m.alloc(0x100)
    m.setU32(pObj + 0x00, 2) // UNIT_OBJECT
    m.setU32(pObj + 0x0c, 0x99887766)
    const pStaticPath = m.alloc(0x30)
    m.setU32(pObj + 0x2c, pStaticPath)
    const pInteractArg = m.alloc(0x10)
    m.setU32(pInteractArg + 0x00, pGame)
    m.setU32(pInteractArg + 0x04, pObj)

    ACT2Q4_InitArcanePortalObject_6FCE32C0_113c(m, pInteractArg)
    expect(m.u32(pObj + 0x10)).toBe(1)
    expect(m.u32(pQuestDataEx + 0x38) >>> 0).toBe(0x99887766)
  })

  it('ACT2Q2 Cube & Viper Amulet helpers (0x6FCE3EF0, 0x6FCE3FC0, 0x6FCE4170) + ACT2Q3/ACT2Q1 completion (0x6FCE5260, 0x6FCE5560)', () => {
    const { m, pGame, pQuestControl } = createHarness()
    const { pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m, pGame)
    const { pQuestDataEx } = linkQuestNode(m, pQuestControl, 9)

    // Missing cube increments [pQuestDataEx + 0x14]
    expect(ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u32(pQuestDataEx + 0x14)).toBe(1)

    // Eligible amulet player increments [pQuestDataEx + 0x14]
    expect(ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u32(pQuestDataEx + 0x14)).toBe(2)

    // CanPlayerReceiveViperAmulet: initially (0x0A, 0) == 0 && (0x0A, 0x0F) == 0 -> 1
    expect(ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c(m, pPlayer, pGame)).toBe(1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0a, 0)
    expect(ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c(m, pPlayer, pGame)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0a, 0x0d)
    expect(ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c(m, pPlayer, pGame)).toBe(1)

    // ACT2Q3 & ACT2Q1 completion state iterators
    expect(ACT2Q3_UnitIterateSetCompletionState_6FCE5260_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0x0e)).toBe(1)

    expect(ACT2Q1_UnitIterateSetCompletionState_6FCE5560_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0x0e)).toBe(1)
  })

  it('MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c & STATES_ClearGfxStateFlag_6FCEB1A0_113c', () => {
    const { m } = createHarness()
    const ppMonReg = m.alloc(5 * 4)
    const pMonRegAct1 = m.alloc(0x300)
    m.setU32(pMonRegAct1 + 0x2d0, 10)
    m.setU32(ppMonReg + 1 * 4, pMonRegAct1)

    const pMonster = m.alloc(0x100)
    m.setU32(pMonster + 0x00, 1) // UNIT_MONSTER
    const pMonsterData = m.alloc(0x80)
    m.setU32(pMonster + 0x14, pMonsterData)
    m.setU32(pMonsterData + 0x58, 1) // spawn act = 1

    // Evil monster without MONTYPEFLAG_OTHER (0x02) decrements +0x2D0
    MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c(m, pMonster, ppMonReg)
    expect(m.u32(pMonRegAct1 + 0x2d0)).toBe(9)

    // Monster with MONTYPEFLAG_OTHER (0x02) is skipped
    m.setU8(pMonsterData + 0x5c, 2)
    MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c(m, pMonster, ppMonReg)
    expect(m.u32(pMonRegAct1 + 0x2d0)).toBe(9)

    // STATES_ClearGfxStateFlag_6FCEB1A0_113c clears active state
    STATLIST_CreateEx113c(m, pMonster, 0, 0)
    STATES_ToggleGfxStateFlag113c(m, pMonster, 5, 1)
    expect(STATES_CheckState113c(m, pMonster, 5)).not.toBe(0)
    STATES_ClearGfxStateFlag_6FCEB1A0_113c(m, pMonster, 5, 0)
    expect(STATES_CheckState113c(m, pMonster, 5)).toBe(0)
    expect(STATES_CheckGfxStateFlag113c(m, pMonster, 5)).not.toBe(0)
  })

  it('PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c, PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c, PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c', () => {
    const { m, pGame } = createHarness()
    const { pPlayer, pPlayerData } = createPlayerWithQuestFlags(m, pGame)
    STATLIST_CreateEx113c(m, pPlayer, 0, 0)

    // Bad packet length -> 3
    expect(PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c(m, pGame, pPlayer, 0, 2)).toBe(3)
    expect(PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c(m, pGame, pPlayer, 0, 2)).toBe(3)
    expect(PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c(m, pGame, pPlayer, 0, 2)).toBe(3)

    // Srv54: mode 3 (RUN) -> mode 2 (WALK)
    m.setU32(pPlayer + 0x10, 3)
    expect(PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c(m, pGame, pPlayer, 0, 1)).toBe(0)
    expect(m.u32(pPlayer + 0x10)).toBe(2)

    // Srv53: mode 2 (WALK) with 0 stamina -> stays mode 2
    expect(PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c(m, pGame, pPlayer, 0, 1)).toBe(0)
    expect(m.u32(pPlayer + 0x10)).toBe(2)

    // Srv53: mode 2 (WALK) with stamina > 0 -> switches to mode 3 (RUN)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0a, 50, 0)
    expect(PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c(m, pGame, pPlayer, 0, 1)).toBe(0)
    expect(m.u32(pPlayer + 0x10)).toBe(3)

    // Srv48: pPlayerIntro == 0 -> returns 2
    m.setU32(pPlayerData + 0x4c, 0)
    expect(PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c(m, pGame, pPlayer, 0, 1)).toBe(2)

    // Srv48: pPlayerIntro != 0 -> clears +0x4C to 0 and returns 0
    m.setU32(pPlayerData + 0x4c, 0x12345678)
    expect(PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c(m, pGame, pPlayer, 0, 1)).toBe(0)
    expect(m.u32(pPlayerData + 0x4c)).toBe(0)

    // Null player throws D2CommonAssertError in UNITS_GetPlayerData113c
    expect(() => PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c(m, pGame, 0, 0, 1)).toThrow(
      D2CommonAssertError,
    )
  })
})
