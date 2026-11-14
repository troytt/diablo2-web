import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import { STATLIST_SetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import * as laneMExports from '../../../src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c.ts'
import {
  ACT5_InitObjectNoop_6FC76CE0_113c,
  ACT5Q0_StatusFilter_6FC76EA0_113c,
  ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c,
  ACT5Q1_ActiveFilter_6FC76D80_113c,
  ACT5Q1_StatusFilter_6FC76E00_113c,
  ACT5Q2_ActiveFilter_6FC76C40_113c,
  ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c,
  ACT5Q2_Callback11_RemovePlayerGuid_6FC782A0_113c,
  ACT5Q2_Callback14_PlayerJoined_6FC781A0_113c,
  ACT5Q2_Callback15_ClearState04_6FC78240_113c,
  ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c,
  ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c,
  ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c,
  ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c,
  ACT5Q3_GetPortalTargetCoords_6FC76A40_113c,
  ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c,
  ACT5Q3_RecordAnyaPosition_6FC76A00_113c,
  ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c,
  ACT5Q4_ActiveFilter_6FC76840_113c,
  ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c,
  ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c,
  ACT5Q4_CompletePersonalizationReward_6FC777F0_113c,
  ACT5Q4_StatusFilter_6FC768C0_113c,
  ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c,
  ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c,
  ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c,
  ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c,
  ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c,
  ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c,
  ACT5Q5_GetSummitPlayerCount_6FC766D0_113c,
  ACT5Q5_InitAncientsAltarObject_6FC773D0_113c,
  ACT5Q5_InitSummitDoorObject_6FC765B0_113c,
  ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c,
  ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c,
  ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c,
  ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c,
  ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c,
  ACT5Q6_ActiveFilter_6FC76810_113c,
  ACT5Q6_Callback11_RemovePlayerGuid_6FC775D0_113c,
  ACT5Q6_Callback14_PlayerJoined_6FC77540_113c,
  ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c,
  ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c,
  ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c,
  ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c,
  SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c,
} from '../../../src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  D2ItemDataStrc,
  D2ItemDataStrc_SIZE,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2StatListExStrc_SIZE,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function createKernelMem(): SparseMemory113c {
  const m = new SparseMemory113c()
  m.fill(0x6fdd6000, 0x20000, 0)
  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)

  const pObjectsTxt = m.alloc(220 * 0x1c0)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 220)

  const pItemsTxt = m.alloc(8 * D2ItemsTxt_SIZE)
  m.setU32(0x6fdefb94, 8)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(pDataTables + 0xbf8, m.alloc(8 * D2ItemTypesTxt_SIZE))
  m.setU32(pDataTables + 0xbfc, 8)
  m.setU32(pDataTables + 0xc00, 1)
  m.setU32(pDataTables + 0xc04, m.alloc(64))
  m.setU32(0x6fdd90b0, m.u32(0x6fd18be0))

  const pAnimDataTable = m.alloc(0x420)
  const pEmptyBucket = m.alloc(16)
  for (let i = 0; i < 256; i++) {
    m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  }
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)

  return m
}

function allocObjectUnit(m: SparseMemory113c, guid: number, classId = 100, mode = 0): number {
  const pObject = m.alloc(0x100)
  m.setU32(pObject, 2) // UNIT_OBJECT
  m.setU32(pObject + 0x04, classId)
  m.setU32(pObject + 0x0c, guid)
  m.setU32(pObject + 0x10, mode)
  const pStaticPath = m.alloc(0x20)
  const pRoom = m.alloc(0x80)
  m.setU32(pStaticPath, pRoom)
  m.setU32(pObject + 0x2c, pStaticPath)
  return pObject
}

function allocPlayerWithQuests(
  m: SparseMemory113c,
  unitId: number,
  difficulty = 0,
  levelId = 0,
): {
  pGame: number
  pPlayer: number
  pPlayerData: number
  pQuestFlags: number
  pRoom: number
} {
  const pGame = m.alloc(0x1df4)
  m.setU8(pGame + 0x6d, difficulty)

  const pPlayer = m.alloc(0x100)
  const pPlayerData = m.alloc(0x180)
  m.setU32(pPlayer, 0) // UNIT_PLAYER
  m.setU32(pPlayer + 0x0c, unitId)
  m.setU32(pPlayer + 0x10, 1) // neutral living mode
  m.setU32(pPlayer + 0x14, pPlayerData)

  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  m.setU32(pPlayerData + 0x10 + difficulty * 4, pQuestFlags)

  let pRoom = 0
  if (levelId > 0) {
    pRoom = m.alloc(0x80)
    const pRoomEx = m.alloc(0x80)
    const pLevel = m.alloc(0x200)
    m.setU32(pRoom + 0x10, pRoomEx)
    m.setU32(pRoomEx + 0x58, pLevel)
    m.setU32(pLevel + 0x1d0, levelId)
    const pDynamicPath = m.alloc(0x40)
    m.setU32(pDynamicPath + 0x1c, pRoom)
    m.setU32(pPlayer + 0x2c, pDynamicPath)
  }

  return { pGame, pPlayer, pPlayerData, pQuestFlags, pRoom }
}

function attachQuestChain(
  m: SparseMemory113c,
  pGame: number,
  quests: ReadonlyArray<{
    nQuestNo: number
    bNotIntro?: number
    bSubState?: number
    bLastState?: number
    dwQuestRecordId?: number
    dataSize?: number
  }>,
): Map<number, { pQuest: number; pQuestDataEx: number }> {
  const pQuestCtrl = m.alloc(0x10)
  m.setU32(pGame + 0x10f4, pQuestCtrl)
  const out = new Map<number, { pQuest: number; pQuestDataEx: number }>()
  let prev = 0
  for (const q of quests) {
    const pQuest = m.alloc(0x100)
    const pQuestDataEx = m.alloc(q.dataSize !== undefined ? q.dataSize : 0x140)
    m.setU32(pQuest, q.nQuestNo)
    m.setU32(pQuest + 0x04, pGame)
    m.setU8(pQuest + 0x09, q.bNotIntro !== undefined ? q.bNotIntro : 1)
    m.setU8(pQuest + 0x0b, q.bSubState !== undefined ? q.bSubState : 0)
    m.setU8(pQuest + 0x0c, q.bLastState !== undefined ? q.bLastState : 0)
    m.setU32(pQuest + 0x18, pQuestDataEx)
    m.setU32(pQuest + 0xe0, q.dwQuestRecordId !== undefined ? q.dwQuestRecordId : 0)
    if (prev === 0) {
      m.setU32(pQuestCtrl, pQuest)
    } else {
      m.setU32(prev + 0xf4, pQuest)
    }
    prev = pQuest
    out.set(q.nQuestNo, { pQuest, pQuestDataEx })
  }
  return out
}

describe('Milestone 33 [K2] Lane K2-M: 45 D2Game 0x6FC73470..0x6FC782E0 Functions', () => {
  it('exports exact 45 113c-suffixed kernel functions', () => {
    const names = Object.keys(laneMExports)
    expect(names.length).toBe(45)
    for (const name of names) {
      expect(name.endsWith('113c')).toBe(true)
      expect(typeof (laneMExports as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('ports SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c (0x6FC73470)', () => {
    const m = createKernelMem()
    const pOutBuf = m.alloc(0x80)

    // NULL item returns 0 immediately
    expect(SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, 0, 0x80, pOutBuf)).toBe(0)

    // Build compact-stream item (nDropSound != 0 triggers compact encode path in ITEMS_WriteItemStreamAndSockets113c)
    const pItemsTxt = m.u32(0x6fdefb98)
    m.set(pItemsTxt + D2ItemsTxt_SIZE, D2ItemsTxt.nDropSound, 1)
    m.set(pItemsTxt + D2ItemsTxt_SIZE, D2ItemsTxt.dwCode, 0x20737068) // 'hps '

    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(D2ItemDataStrc_SIZE)
    const pItemPath = m.alloc(0x20)
    m.set(pItem, D2UnitStrc.dwUnitType, 4)
    m.set(pItem, D2UnitStrc.dwClassId, 1)
    m.set(pItem, D2UnitStrc.dwAnimMode, 0)
    m.set(pItem, D2UnitStrc.pUnitData, pItemData)
    m.set(pItem, D2UnitStrc.pPath, pItemPath)
    m.set(pItemData, D2ItemDataStrc.wItemFormat, 101)
    m.set(pItemData, D2ItemDataStrc.dwCommandFlags, 0x200000)

    // Flagged bit 15 (0x8000) on +0xC8 skips serialization and returns 0
    m.setU32(pItem + 0xc8, 0x8000)
    expect(SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pItem, 0x80, pOutBuf)).toBe(0)

    // Unflagged item serializes JM header (0x4D4A) and returns positive byte length
    m.setU32(pItem + 0xc8, 0)
    const written = SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pItem, 0x80, pOutBuf)
    expect(written).toBeGreaterThan(0)
    expect(m.u16(pOutBuf)).toBe(0x4d4a)

    // Zero buffer capacity overflows bit buffer -> ITEMS_SerializeItemToBuffer returns 0 -> asserts line 0x75A
    expect(() => SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pItem, 0, pOutBuf)).toThrow(
      D2CommonAssertError,
    )
  })

  it('ports Worldstone Chamber init & entry checks (0x6FC764D0, 0x6FC76520, 0x6FC76570)', () => {
    const m = createKernelMem()
    const { pGame } = allocPlayerWithQuests(m, 1)

    // Without quest 0x24, entry is allowed (returns 1)
    expect(ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c(m, pGame)).toBe(1)

    const quests = attachQuestChain(m, pGame, [{ nQuestNo: 0x24 }])
    const { pQuestDataEx } = quests.get(0x24)!

    m.setU8(pQuestDataEx + 0x86, 0)
    expect(ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c(m, pGame)).toBe(1)
    m.setU8(pQuestDataEx + 0x86, 1)
    expect(ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c(m, pGame)).toBe(0)
    m.setU8(pQuestDataEx + 0x86, 2)
    expect(ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c(m, pGame)).toBe(1)

    // 0x6FC764D0: applies +0x9C anim mode to object then writes +0x9C = 2
    const pObj9C = allocObjectUnit(m, 10)
    const pInit9C = m.alloc(0x20)
    m.setU32(pInit9C, pGame)
    m.setU32(pInit9C + 0x04, pObj9C)
    m.setU32(pQuestDataEx + 0x9c, 5)
    ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c(m, pInit9C)
    expect(m.u32(pObj9C + 0x10)).toBe(5)
    expect(m.u32(pQuestDataEx + 0x9c)).toBe(2)

    // 0x6FC76520: applies +0x94 anim mode to object then writes +0x94 = 2
    const pObj94 = allocObjectUnit(m, 11)
    const pInit94 = m.alloc(0x20)
    m.setU32(pInit94, pGame)
    m.setU32(pInit94 + 0x04, pObj94)
    m.setU32(pQuestDataEx + 0x94, 4)
    ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c(m, pInit94)
    expect(m.u32(pObj94 + 0x10)).toBe(4)
    expect(m.u32(pQuestDataEx + 0x94)).toBe(2)
  })

  it('ports Arreat Summit door, portal, Ancient readiness, and player count helpers (0x6FC765B0..0x6FC76740)', () => {
    const m = createKernelMem()
    const { pGame, pPlayer } = allocPlayerWithQuests(m, 1, 0, 0x78)
    const pObj = allocObjectUnit(m, 20, 100, 7)
    const pObjInit = m.alloc(0x20)
    m.setU32(pObjInit, pGame)
    m.setU32(pObjInit + 0x04, pObj)

    // Missing quest 0x23: 0x6FC765B0 returns without mutating, 0x6FC76640 returns 0
    ACT5Q5_InitSummitDoorObject_6FC765B0_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(7)
    expect(ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c(m, pGame)).toBe(0)

    const quests = attachQuestChain(m, pGame, [{ nQuestNo: 0x23, bNotIntro: 1 }])
    const { pQuest, pQuestDataEx } = quests.get(0x23)!

    // 0x6FC765B0: +0x4A == 0 -> mode 0, +0x4A != 0 -> mode 2
    m.setU8(pQuestDataEx + 0x4a, 0)
    ACT5Q5_InitSummitDoorObject_6FC765B0_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(0)
    m.setU8(pQuestDataEx + 0x4a, 1)
    ACT5Q5_InitSummitDoorObject_6FC765B0_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(2)

    // 0x6FC76600: requires bNotIntro != 0 and pQuestDataEx[+0x00] == 0
    m.setU8(pQuestDataEx, 0)
    expect(ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c(m, pGame)).toBe(1)
    m.setU8(pQuestDataEx, 1)
    expect(ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c(m, pGame)).toBe(0)
    m.setU8(pQuestDataEx, 0)
    m.setU8(pQuest + 0x09, 0)
    expect(ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c(m, pGame)).toBe(0)

    // 0x6FC76640: requires +0x48 != 0 and +0x44 == 0
    m.setU8(pQuestDataEx + 0x48, 0)
    m.setU32(pQuestDataEx + 0x44, 0)
    expect(ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c(m, pGame)).toBe(0)
    m.setU8(pQuestDataEx + 0x48, 1)
    m.setU32(pQuestDataEx + 0x44, 2)
    expect(ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c(m, pGame)).toBe(0)
    m.setU32(pQuestDataEx + 0x44, 0)
    expect(ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c(m, pGame)).toBe(1)

    // 0x6FC766D0 & 0x6FC76740: summit player count and reset flag +0x11
    m.setU32(pQuestDataEx + 0x0c, 2)
    m.setU8(pQuestDataEx + 0x10, 1)
    m.setU8(pQuestDataEx + 0x11, 0)
    expect(ACT5Q5_GetSummitPlayerCount_6FC766D0_113c(m, pGame)).toBe(2)

    // Non-summit player does not decrement
    const other = allocPlayerWithQuests(m, 2, 0, 109)
    ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c(m, other.pPlayer, pGame)
    expect(ACT5Q5_GetSummitPlayerCount_6FC766D0_113c(m, pGame)).toBe(2)

    // First summit leave: 2 -> 1, +0x11 remains 0
    ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c(m, pPlayer, pGame)
    expect(ACT5Q5_GetSummitPlayerCount_6FC766D0_113c(m, pGame)).toBe(1)
    expect(m.u8(pQuestDataEx + 0x11)).toBe(0)

    // Second summit leave: 1 -> 0 with +0x10 != 0 -> sets +0x11 = 1
    ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c(m, pPlayer, pGame)
    expect(ACT5Q5_GetSummitPlayerCount_6FC766D0_113c(m, pGame)).toBe(0)
    expect(m.u8(pQuestDataEx + 0x11)).toBe(1)
  })

  it('ports Act 5 Q6 and Q4 active/status filters (0x6FC76810, 0x6FC76840, 0x6FC768C0)', () => {
    const m = createKernelMem()
    const { pGame, pPlayer, pQuestFlags } = allocPlayerWithQuests(m, 1)
    const quests = attachQuestChain(m, pGame, [
      { nQuestNo: 0x24, bLastState: 1, dwQuestRecordId: 0x28 },
      { nQuestNo: 0x22, bNotIntro: 1, bSubState: 2, bLastState: 1, dwQuestRecordId: 0x26 },
    ])
    const q6 = quests.get(0x24)!.pQuest
    const q4 = quests.get(0x22)!.pQuest

    // 0x6FC76810: Qual-Kehk (0x203), bLastState == 1, quest bit 0 clear
    expect(ACT5Q6_ActiveFilter_6FC76810_113c(m, q6, 0x200, pPlayer, pQuestFlags, 0)).toBe(0)
    expect(ACT5Q6_ActiveFilter_6FC76810_113c(m, q6, 0x203, pPlayer, pQuestFlags, 0)).toBe(1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x28, 0)
    expect(ACT5Q6_ActiveFilter_6FC76810_113c(m, q6, 0x203, pPlayer, pQuestFlags, 0)).toBe(0)
    m.setU8(q6 + 0x0c, 2)
    expect(ACT5Q6_ActiveFilter_6FC76810_113c(m, q6, 0x203, pPlayer, pQuestFlags, 0)).toBe(0)

    // 0x6FC76840: Anya (0x200) in state 1 requires 0x25 bit 0 or 1, and 0x26 bits 0 & 1 clear
    expect(ACT5Q4_ActiveFilter_6FC76840_113c(m, q4, 0x1ff, pPlayer, pQuestFlags, 0)).toBe(0)
    expect(ACT5Q4_ActiveFilter_6FC76840_113c(m, q4, 0x200, pPlayer, pQuestFlags, 0)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 1)
    expect(ACT5Q4_ActiveFilter_6FC76840_113c(m, q4, 0x200, pPlayer, pQuestFlags, 0)).toBe(1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 1)
    expect(ACT5Q4_ActiveFilter_6FC76840_113c(m, q4, 0x200, pPlayer, pQuestFlags, 0)).toBe(0)

    // Non-state-1 branch of 0x6FC76840: requires 0x26 bit 0x0D set and 0x26 bit 4 clear
    m.setU8(q4 + 0x0c, 2)
    expect(ACT5Q4_ActiveFilter_6FC76840_113c(m, q4, 0x200, pPlayer, pQuestFlags, 0)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 0x0d)
    expect(ACT5Q4_ActiveFilter_6FC76840_113c(m, q4, 0x200, pPlayer, pQuestFlags, 0)).toBe(1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 4)
    expect(ACT5Q4_ActiveFilter_6FC76840_113c(m, q4, 0x200, pPlayer, pQuestFlags, 0)).toBe(0)

    // 0x6FC768C0: status filter branches
    const pOut = m.alloc(4)
    const freshFlags = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU8(q4 + 0x0b, 3)
    m.setU8(q4 + 0x0c, 2)
    expect(ACT5Q4_StatusFilter_6FC768C0_113c(m, q4, pPlayer, 0, freshFlags, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(3)

    QUESTRECORD_SetQuestState113c(m, freshFlags, 0x26, 0x0e)
    expect(ACT5Q4_StatusFilter_6FC768C0_113c(m, q4, pPlayer, 0, freshFlags, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(0x0c)

    QUESTRECORD_SetQuestState113c(m, freshFlags, 0x26, 0x0d)
    expect(ACT5Q4_StatusFilter_6FC768C0_113c(m, q4, pPlayer, 0, freshFlags, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(4)

    QUESTRECORD_SetQuestState113c(m, freshFlags, 0x26, 4)
    expect(ACT5Q4_StatusFilter_6FC768C0_113c(m, q4, pPlayer, 0, freshFlags, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(5)

    QUESTRECORD_SetQuestState113c(m, freshFlags, 0x26, 0)
    expect(ACT5Q4_StatusFilter_6FC768C0_113c(m, q4, pPlayer, 0, freshFlags, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(0)
  })

  it('ports Prison of Ice position and portal coordinate helpers (0x6FC76950, 0x6FC76A00, 0x6FC76A40)', () => {
    const m = createKernelMem()
    const { pGame } = allocPlayerWithQuests(m, 1)
    const pObj = allocObjectUnit(m, 30)
    const pStaticPath = m.u32(pObj + 0x2c)
    m.setU32(pStaticPath + 0x0c, 5120)
    m.setU32(pStaticPath + 0x10, 6144)
    const pOutCoords = m.alloc(8)

    expect(ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c(m, pGame)).toBe(0)
    expect(ACT5Q3_RecordAnyaPosition_6FC76A00_113c(m, pGame, pObj)).toBe(0)
    expect(ACT5Q3_GetPortalTargetCoords_6FC76A40_113c(m, pGame, pObj, pOutCoords)).toBe(0)

    const quests = attachQuestChain(m, pGame, [{ nQuestNo: 0x21 }])
    const { pQuestDataEx } = quests.get(0x21)!

    expect(ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c(m, pGame)).toBe(1)
    expect(ACT5Q3_RecordAnyaPosition_6FC76A00_113c(m, pGame, pObj)).toBe(1)
    expect(m.u32(pQuestDataEx + 0xc4)).toBe(5120)
    expect(m.u32(pQuestDataEx + 0xc8)).toBe(6144)
    expect(m.u8(pQuestDataEx + 0xe0)).toBe(1)

    // +0x84 == 0 -> GetPortalTargetCoords returns 0
    expect(ACT5Q3_GetPortalTargetCoords_6FC76A40_113c(m, pGame, pObj, pOutCoords)).toBe(0)

    // +0x84 != 0, +0xB1 == 0 -> reads live unit position
    m.setU32(pQuestDataEx + 0x84, 1)
    expect(ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c(m, pGame)).toBe(0)
    m.setU32(pStaticPath + 0x0c, 5200)
    m.setU32(pStaticPath + 0x10, 6200)
    expect(ACT5Q3_GetPortalTargetCoords_6FC76A40_113c(m, pGame, pObj, pOutCoords)).toBe(1)
    expect(m.u32(pOutCoords)).toBe(5200)
    expect(m.u32(pOutCoords + 4)).toBe(6200)

    // +0xB1 != 0 -> copies saved coords from +0xC4 / +0xC8
    m.setU8(pQuestDataEx + 0xb1, 1)
    expect(ACT5Q3_GetPortalTargetCoords_6FC76A40_113c(m, pGame, pObj, pOutCoords)).toBe(1)
    expect(m.u32(pOutCoords)).toBe(5120)
    expect(m.u32(pOutCoords + 4)).toBe(6144)
  })

  it('ports soldier counter, Q2 active filter, noop init, and Q1 activation/filters (0x6FC76B80..0x6FC76EA0)', () => {
    const m = createKernelMem()
    const { pGame, pPlayer, pQuestFlags } = allocPlayerWithQuests(m, 1)
    const quests = attachQuestChain(m, pGame, [
      { nQuestNo: 0x20, bNotIntro: 0, bSubState: 2, bLastState: 0, dwQuestRecordId: 0x24 },
      { nQuestNo: 0x1f, bNotIntro: 1, bSubState: 2, bLastState: 1, dwQuestRecordId: 0x23 },
    ])
    const q2 = quests.get(0x20)!
    const q1 = quests.get(0x1f)!

    // 0x6FC76B80: 3 unspawned groups = 15, + spawned(10) - saved(6) - killed(2) = 17
    m.setU32(q2.pQuestDataEx + 0xa4, 10)
    m.setU32(q2.pQuestDataEx + 0xac, 6)
    m.setU32(q2.pQuestDataEx + 0xa8, 2)
    expect(ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c(m, q2.pQuest)).toBe(17)
    // All 3 groups spawned and negative delta clamps to 0
    m.setU8(q2.pQuestDataEx + 0x86, 1)
    m.setU8(q2.pQuestDataEx + 0x87, 1)
    m.setU8(q2.pQuestDataEx + 0x88, 1)
    m.setU32(q2.pQuestDataEx + 0xa4, 3)
    expect(ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c(m, q2.pQuest)).toBe(0)

    // 0x6FC76CE0: no-op init
    expect(ACT5_InitObjectNoop_6FC76CE0_113c(m, 0)).toBeUndefined()

    // 0x6FC76CF0: sets +0x0C = 1 only when +0x0C == 0 && +0x09 != 0
    ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c(m, q2.pQuest)
    expect(m.u8(q2.pQuest + 0x0c)).toBe(0)
    m.setU8(q2.pQuest + 0x09, 1)
    ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c(m, q2.pQuest)
    expect(m.u8(q2.pQuest + 0x0c)).toBe(1)
    m.setU8(q2.pQuest + 0x0c, 3)
    ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c(m, q2.pQuest)
    expect(m.u8(q2.pQuest + 0x0c)).toBe(3)

    // 0x6FC76C40: Qual-Kehk (0x203) & captive soldier (0x216)
    m.setU8(q2.pQuest + 0x0c, 1)
    expect(ACT5Q2_ActiveFilter_6FC76C40_113c(m, q2.pQuest, 0x203, pPlayer, pQuestFlags, 0)).toBe(1)
    expect(ACT5Q2_ActiveFilter_6FC76C40_113c(m, q2.pQuest, 0x216, pPlayer, pQuestFlags, 0)).toBe(1)
    expect(ACT5Q2_ActiveFilter_6FC76C40_113c(m, q2.pQuest, 0x1ff, pPlayer, pQuestFlags, 0)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 1)
    expect(ACT5Q2_ActiveFilter_6FC76C40_113c(m, q2.pQuest, 0x203, pPlayer, pQuestFlags, 0)).toBe(0)
    expect(ACT5Q2_ActiveFilter_6FC76C40_113c(m, q2.pQuest, 0x216, pPlayer, pQuestFlags, 0)).toBe(0)
    m.setU8(q2.pQuest + 0x0c, 2)
    expect(ACT5Q2_ActiveFilter_6FC76C40_113c(m, q2.pQuest, 0x203, pPlayer, pQuestFlags, 0)).toBe(1)

    // 0x6FC76D80: Larzuk (0x1FF)
    expect(ACT5Q1_ActiveFilter_6FC76D80_113c(m, q1.pQuest, 0x200, pPlayer, pQuestFlags, 0)).toBe(0)
    expect(ACT5Q1_ActiveFilter_6FC76D80_113c(m, q1.pQuest, 0x1ff, pPlayer, pQuestFlags, 0)).toBe(1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 1)
    m.setU8(q1.pQuest + 0x0c, 4) // even when bLastState != 1, bit 1 set && bit 5 clear returns 1
    expect(ACT5Q1_ActiveFilter_6FC76D80_113c(m, q1.pQuest, 0x1ff, pPlayer, pQuestFlags, 0)).toBe(1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 5)
    expect(ACT5Q1_ActiveFilter_6FC76D80_113c(m, q1.pQuest, 0x1ff, pPlayer, pQuestFlags, 0)).toBe(0)

    // 0x6FC76E00 & 0x6FC76EA0: Q1 and Q0 status filters
    const pOut = m.alloc(4)
    const f1 = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU8(q1.pQuest + 0x0b, 2)
    m.setU8(q1.pQuest + 0x0c, 2)
    expect(ACT5Q1_StatusFilter_6FC76E00_113c(m, q1.pQuest, pPlayer, 0, f1, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(2)

    QUESTRECORD_SetQuestState113c(m, f1, 0x23, 0x0e)
    expect(ACT5Q1_StatusFilter_6FC76E00_113c(m, q1.pQuest, pPlayer, 0, f1, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(0x0c)

    QUESTRECORD_SetQuestState113c(m, f1, 0x23, 1)
    expect(ACT5Q1_StatusFilter_6FC76E00_113c(m, q1.pQuest, pPlayer, 0, f1, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(3)

    QUESTRECORD_SetQuestState113c(m, f1, 0x23, 5)
    expect(ACT5Q1_StatusFilter_6FC76E00_113c(m, q1.pQuest, pPlayer, 0, f1, pOut)).toBe(1)
    expect(m.u8(pOut)).toBe(4)

    m.setU8(pOut, 99)
    expect(ACT5Q0_StatusFilter_6FC76EA0_113c(m, q1.pQuest, pPlayer, 0, f1, pOut)).toBe(0)
    expect(m.u8(pOut)).toBe(0)
  })

  it('ports Q5 callbacks and jump-table scroll states (0x6FC76EB0, 0x6FC76FC0, 0x6FC77270) plus GUID removals (0x6FC775D0, 0x6FC77A20, 0x6FC782A0)', () => {
    const m = createKernelMem()
    const { pGame, pPlayer, pQuestFlags } = allocPlayerWithQuests(m, 42)
    const quests = attachQuestChain(m, pGame, [{ nQuestNo: 0x23, dwQuestRecordId: 0x27 }])
    const { pQuest, pQuestDataEx } = quests.get(0x23)!

    const pQuestArg = m.alloc(0x24)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)

    // 0x6FC76EB0: sets state 0x0A only when state 0 is already set
    ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c(m, pQuest, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, 0x0a)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x27, 0)
    ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c(m, pQuest, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, 0x0a)).toBe(1)

    // 0x6FC77270: verifies exact jump table [7, 9, 5, 4, 6, 8] for 0x4ECF..0x4ED4 and out-of-range ignore
    const expectedMap: ReadonlyArray<[number, number]> = [
      [0x4ecf, 7],
      [0x4ed0, 9],
      [0x4ed1, 5],
      [0x4ed2, 4],
      [0x4ed3, 6],
      [0x4ed4, 8],
    ]
    m.setU16(pQuestArg + 0x18, 0x4ece)
    ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c(m, pQuest, pQuestArg)
    for (const [, st] of expectedMap) {
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, st)).toBe(0)
    }
    for (const [msgId, st] of expectedMap) {
      m.setU16(pQuestArg + 0x18, msgId)
      ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c(m, pQuest, pQuestArg)
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, st)).toBe(1)
    }

    // Dual-list GUID removal callbacks (0x6FC76FC0, 0x6FC77A20, 0x6FC782A0) and single-list (0x6FC775D0)
    for (const fn of [
      ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c,
      ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c,
      ACT5Q2_Callback11_RemovePlayerGuid_6FC782A0_113c,
    ]) {
      m.setU32(pQuest + 0x1c, 42)
      m.setU16(pQuest + 0x1c + 0x80, 1)
      m.setU32(pQuestDataEx, 42)
      m.setU16(pQuestDataEx + 0x80, 1)
      expect(fn(m, pQuest, pQuestArg)).toBe(1)
      expect(m.u16(pQuest + 0x1c + 0x80)).toBe(0)
      expect(m.u16(pQuestDataEx + 0x80)).toBe(0)
    }

    m.setU32(pQuest + 0x1c, 42)
    m.setU16(pQuest + 0x1c + 0x80, 1)
    expect(ACT5Q6_Callback11_RemovePlayerGuid_6FC775D0_113c(m, pQuest, pQuestArg)).toBe(1)
    expect(m.u16(pQuest + 0x1c + 0x80)).toBe(0)
  })

  it('ports Q6 Baal sync and Q5 Altar / Summit / Statue object handlers (0x6FC77320..0x6FC775D0)', () => {
    const m = createKernelMem()
    const { pGame, pPlayer, pQuestFlags } = allocPlayerWithQuests(m, 10, 0, 109) // Harrogath (Act 5 = actNo 4)
    const quests = attachQuestChain(m, pGame, [
      { nQuestNo: 0x24, bLastState: 2, dwQuestRecordId: 0x28 },
      { nQuestNo: 0x23, bLastState: 2, dwQuestRecordId: 0x27 },
    ])
    const q6 = quests.get(0x24)!
    const q5 = quests.get(0x23)!

    // 0x6FC77320: syncs 0x28 state 2 or 3 for Act 5 players
    expect(ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 2)).toBe(1)

    // 0x6FC773D0: Altar init sets +0x58 = 1, +0x5C = guid, applies +0x60 mode, then promotes to +0x60 = 2 / mode 1 when [0] == 0
    const pAltar = allocObjectUnit(m, 77)
    const pAltarInit = m.alloc(0x20)
    m.setU32(pAltarInit, pGame)
    m.setU32(pAltarInit + 0x04, pAltar)
    m.setU8(q5.pQuestDataEx, 0)
    m.setU32(q5.pQuestDataEx + 0x60, 0)
    ACT5Q5_InitAncientsAltarObject_6FC773D0_113c(m, pAltarInit)
    expect(m.u8(q5.pQuestDataEx + 0x58)).toBe(1)
    expect(m.u32(q5.pQuestDataEx + 0x5c)).toBe(77)
    expect(m.u32(q5.pQuestDataEx + 0x60)).toBe(2)
    expect(m.u32(pAltar + 0x10)).toBe(1)

    // 0x6FC77440: increments +0x54 only on level 0x78 and living animMode (!= 0 && != 0x11)
    expect(ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(m.u32(q5.pQuestDataEx + 0x54)).toBe(0)
    const summitPlr = allocPlayerWithQuests(m, 11, 0, 0x78)
    expect(
      ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c(m, pGame, summitPlr.pPlayer, 0),
    ).toBe(0)
    expect(m.u32(q5.pQuestDataEx + 0x54)).toBe(1)
    m.setU32(summitPlr.pPlayer + 0x10, 0x11)
    ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c(m, pGame, summitPlr.pPlayer, 0)
    expect(m.u32(q5.pQuestDataEx + 0x54)).toBe(1)

    // 0x6FC774A0: Worldstone entrance init stores GUID at +0x50 and applies mode from +0x4C
    const pEntrance = allocObjectUnit(m, 88)
    const pEntInit = m.alloc(0x20)
    m.setU32(pEntInit, pGame)
    m.setU32(pEntInit + 0x04, pEntrance)
    m.setU32(q5.pQuestDataEx + 0x4c, 3)
    ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c(m, pEntInit)
    expect(m.u32(q5.pQuestDataEx + 0x50)).toBe(88)
    expect(m.u32(pEntrance + 0x10)).toBe(3)

    // 0x6FC774F0: Ancients statue classId mapping (0x1DA -> slot 1, 0x1DB -> slot 0, 0x1DC -> slot 2)
    m.setU32(q5.pQuestDataEx + 0x30, 4)
    m.setU32(q5.pQuestDataEx + 0x34, 5)
    m.setU32(q5.pQuestDataEx + 0x38, 6)
    for (const [cid, expectedMode] of [
      [0x1da, 5],
      [0x1db, 4],
      [0x1dc, 6],
      [0x1dd, 0],
    ] as const) {
      const pStatue = allocObjectUnit(m, 90 + cid, cid, 0)
      const pStInit = m.alloc(0x10)
      m.setU32(pStInit + 0x04, pStatue)
      ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c(m, pStInit, q5.pQuestDataEx)
      expect(m.u32(pStatue + 0x10)).toBe(expectedMode)
    }

    // 0x6FC77540: Q6 player joined callback
    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    ACT5Q6_Callback14_PlayerJoined_6FC77540_113c(m, q6.pQuest, pQuestArg)
    expect(m.u8(q6.pQuest + 0x0b)).toBe(1)
    expect(m.u8(q6.pQuest + 0x0c)).toBe(2)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x28, 0)
    ACT5Q6_Callback14_PlayerJoined_6FC77540_113c(m, q6.pQuest, pQuestArg)
    expect(m.u8(q6.pQuestDataEx + 0x4a)).toBe(1)
  })

  it('ports Rite of Passage level gate, Nihlathak rewards/callbacks, and Anya portal spawn (0x6FC77750..0x6FC77CB0)', () => {
    const m = createKernelMem()
    const { pGame, pPlayer, pQuestFlags, pRoom } = allocPlayerWithQuests(m, 50, 1, 109) // Nightmare (diff=1 -> req lvl 40), Act 5

    // Attach statlist on player so STATLIST_GetUnitBaseStat(pPlayer, 12, 0) reads STAT_LEVEL
    const pStatList = m.alloc(D2StatListExStrc_SIZE)
    m.set(pPlayer, D2UnitStrc.pStatListEx, pStatList)
    m.setU32(pStatList + 0x10, 0x80000000)

    const quests = attachQuestChain(m, pGame, [
      { nQuestNo: 0x23, bLastState: 2 },
      { nQuestNo: 0x22, bLastState: 3 },
      { nQuestNo: 0x21, bLastState: 2 },
    ])
    const q3 = quests.get(0x21)!

    // 0x6FC77750: level 39 < 40 does not set 0x27 state 2; level 40 sets 0x27 state 2
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 39, 0)
    ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, 2)).toBe(0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 40, 0)
    ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, 2)).toBe(1)

    // 0x6FC77C00: requires 0x25 bit 0 or 1, then sets 0x26 state 3
    ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 3)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 0)
    ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 3)).toBe(1)

    // 0x6FC77830: awards 0x26 states 1 and 0x0D to eligible Act 5 party member
    ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 1)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0x0d)).toBe(1)

    // 0x6FC777F0: sets 0x26 state 0, clears state 1, returns state 0x0F bit
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 0x0f)
    expect(ACT5Q4_CompletePersonalizationReward_6FC777F0_113c(m, pPlayer, pGame)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 1)).toBe(0)

    // 0x6FC77CB0: out-of-room probe increments (+0xC4, +0xC8) by +3; in-room probe spawns object 0xBD
    m.setU32(pRoom + 0x4c, 100)
    m.setU32(pRoom + 0x50, 200)
    m.setU32(pRoom + 0x54, 40)
    m.setU32(pRoom + 0x58, 40)
    m.setU32(pGame + 0xbc + 4 * 4, m.alloc(0x80)) // Act 5 D2ActStrc*

    m.setU32(q3.pQuestDataEx + 0x84, 1)
    m.setU32(q3.pQuestDataEx + 0xc4, 98)
    m.setU32(q3.pQuestDataEx + 0xc8, 198)
    expect(ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u32(q3.pQuestDataEx + 0xc4)).toBe(101)
    expect(m.u32(q3.pQuestDataEx + 0xc8)).toBe(201)

    // Second call hits (101, 201) inside pRoom [100..140, 200..240] and spawns portal object 0xBD
    expect(ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c(m, pGame, pPlayer)).toBe(1)
    expect(m.u8(q3.pQuestDataEx + 0xb1)).toBe(1)
    expect(m.u32(q3.pQuestDataEx + 0xc0)).toBeGreaterThan(0)
  })

  it('ports Q3/Q2 party & join callbacks and soldier matrix search (0x6FC780A0..0x6FC782E0)', () => {
    const m = createKernelMem()
    const { pGame, pPlayer, pQuestFlags } = allocPlayerWithQuests(m, 60, 0, 109)
    const quests = attachQuestChain(m, pGame, [
      { nQuestNo: 0x21, bLastState: 3, dwQuestRecordId: 0x25 },
      { nQuestNo: 0x20, bLastState: 0, dwQuestRecordId: 0x24 },
    ])
    const q2 = quests.get(0x20)!

    // 0x6FC78110: syncs 0x25 state 3 from quest 0x21
    expect(ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 3)).toBe(1)

    // 0x6FC780A0: sets 0x25 states 0x0D and 1
    ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0x0d)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 1)).toBe(1)

    // 0x6FC781A0 & 0x6FC78240: Q2 player joined & clear state 4
    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 4)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 2)
    ACT5Q2_Callback14_PlayerJoined_6FC781A0_113c(m, q2.pQuest, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 4)).toBe(0)
    expect(m.u8(q2.pQuest + 0x0c)).toBe(2)
    expect(m.u8(q2.pQuest + 0x0b)).toBe(1)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 4)
    ACT5Q2_Callback15_ClearState04_6FC78240_113c(m, q2.pQuest, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 4)).toBe(0)

    // 0x6FC78260: 3x5 GUID matrix search at +0xB0
    m.fill(q2.pQuestDataEx + 0xb0, 60, 0)
    m.setU32(q2.pQuestDataEx + 0xb0 + 2 * 0x14 + 4 * 4, 777)
    m.setU32(q2.pQuestDataEx + 0xb0 + 1 * 0x14 + 0 * 4, 0xffffffff)
    const pSoldier = allocObjectUnit(m, 777)
    const pUnlisted = allocObjectUnit(m, 888)
    expect(ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, pSoldier, q2.pQuest)).toBe(2)
    expect(ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, 0, q2.pQuest)).toBe(1)
    expect(ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, pUnlisted, q2.pQuest)).toBe(-1)

    // 0x6FC782E0: sets 0x24 states 0x0D, 1, and 5/6/7 according to savedSoldiers (+0xAC == 15, 14, other)
    for (const [saved, expectedBit] of [
      [15, 5],
      [14, 6],
      [10, 7],
    ] as const) {
      const pPartyPlr = allocPlayerWithQuests(m, 100 + saved, 0, 109)
      m.setU32(q2.pQuestDataEx + 0xac, saved)
      ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c(m, pGame, pPartyPlr.pPlayer, 0)
      expect(DRLGWARP_TestRoomTileBit113c(m, pPartyPlr.pQuestFlags, 0x24, 0x0d)).toBe(1)
      expect(DRLGWARP_TestRoomTileBit113c(m, pPartyPlr.pQuestFlags, 0x24, 1)).toBe(1)
      expect(DRLGWARP_TestRoomTileBit113c(m, pPartyPlr.pQuestFlags, 0x24, expectedBit)).toBe(1)
    }
  })
})
