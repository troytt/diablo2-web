import { describe, expect, it } from 'vitest'
import { QUESTRECORD_AllocRecord113c, QUESTRECORD_SetQuestState113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import * as laneBExports from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c.ts'
import {
  ACT3Q0_ActiveFilter113c,
  ACT3Q0_MarkWandererSeenCallback113c,
  ACT3Q0_StatusFilter113c,
  ACT3Q1_GetHratliTargetCoords113c,
  ACT3Q1_GetQuestDataByte04_113c,
  ACT3Q1_HratliIntroActiveFilter113c,
  ACT3Q1_HratliIntroStatusFilter113c,
  ACT3Q2_AddQuestDataCount1C_113c,
  ACT3Q2_DarkWandererStatusFilter113c,
  ACT3Q3_OnKhalimsWillCubed113c,
  ACT3Q4_CheckOrmusNpcWaitFlag113c,
  ACT3Q4_ClearOrmusNpcWaitFlag113c,
  ACT3Q4_OnQuestUnitDeactivate113c,
  ACT3Q4_SyncTomePartyQuestStateCallback113c,
  ACT3Q5_BlackenedTempleActiveFilter113c,
  ACT3Q5_CompleteCouncilPartyCallback113c,
  ACT3Q5_IsCompellingOrbIntact113c,
  ACT3Q5_IsDuranceEntryBlocked113c,
  ACT3Q5_SyncCouncilQuestFlagsCallback113c,
  ACT3Q6_MephistoActiveFilter113c,
  ACT3Q6_SetGidbinnState0ECallback113c,
  ACT3Q6_SyncGidbinnState02Callback113c,
  ACT3Q7_Callback11_Noop113c,
  ACT3Q7_Callback14_PlayerJoined113c,
  ACT3Q7_SendQuestUpdatePacket5D_113c,
  CLIENTS_UpdateCharacterProgression113c,
  MONSTER_CheckPlayerInteractUnlocked113c,
  MONSTER_CountInteractingPlayers113c,
  MONSTER_HasAnyInteractingPlayer113c,
  MONSTER_IsPlayerInteractInTradeState113c,
  MONSTER_PromotePlayerInteractToTradeState113c,
  MONSTER_SetLastInteractTarget113c,
  PARTY_FindPlayerRelationNode113c,
  PARTY_GetHostileCooldownTick113c,
  PARTY_GetPlayerRelationState113c,
  PARTY_TestPlayerRelationFlags113c,
  REGPOP_CanSpawnPresetMinionPack113c,
  REGPOP_RemapDirectionalMonsterClassId113c,
  SKILLS_DeductFromStatPool113c,
  SKILLS_DivideValueByMonLvlHp113c,
  SKILLS_IsDimVisionOrTerrorState113c,
  SKILLS_SetNecroSkeletonComponents113c,
  SKILLS_SrvSt18_ReturnOne113c,
  SUNIT_CanTargetOwnPetWithSkill113c,
  SUNIT_GetOwnerUnit113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c.ts'
import { D2MonLvlTxt_SIZE } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface TestWorld {
  m: SparseMemory113c
  pDataTables: number
  pMonStatsTxt: number
  pSkillsTxt: number
  pMonLvlTxt: number
}

function createTestWorld(monStatsCount = 500, skillsCount = 300, monLvlCount = 110): TestWorld {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)

  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, monStatsCount)

  const pSkillsTxt = m.alloc(skillsCount * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, skillsCount)

  const pMonLvlTxt = m.alloc(monLvlCount * D2MonLvlTxt_SIZE)
  m.setU32(0x6fdf0b54, pMonLvlTxt)
  m.setU32(0x6fdf0b58, monLvlCount)

  return { m, pDataTables, pMonStatsTxt, pSkillsTxt, pMonLvlTxt }
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
  quests: ReadonlyArray<{ nQuestNo: number; bState?: number; dataSize?: number }>,
): Map<number, { pQuest: number; pQuestDataEx: number }> {
  const pQuestCtrl = m.alloc(0x10)
  m.setU32(pGame + 0x10f4, pQuestCtrl)
  const map = new Map<number, { pQuest: number; pQuestDataEx: number }>()
  let prev = 0
  for (const q of quests) {
    const pQuest = m.alloc(0x100)
    const pQuestDataEx = m.alloc(q.dataSize !== undefined ? q.dataSize : 0x40)
    m.setU32(pQuest, q.nQuestNo)
    m.setU32(pQuest + 0x04, pGame)
    m.setU8(pQuest + 0x0c, q.bState !== undefined ? q.bState : 0)
    m.setU32(pQuest + 0x18, pQuestDataEx)
    if (prev === 0) {
      m.setU32(pQuestCtrl, pQuest)
    } else {
      m.setU32(prev + 0xf4, pQuest)
    }
    prev = pQuest
    map.set(q.nQuestNo, { pQuest, pQuestDataEx })
  }
  return map
}

describe('Milestone 33 [K2] Lane K2-B: 45 D2Game SUNIT / REGPOP / MONSTER / ACT3 / PARTY Functions', () => {
  it('exports exact 45 113c-suffixed kernel functions', () => {
    const names = Object.keys(laneBExports)
    expect(names.length).toBe(45)
    for (const name of names) {
      expect(name.endsWith('113c')).toBe(true)
      expect(typeof (laneBExports as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('ports SKILLS_DeductFromStatPool113c (0x6FC645E0)', () => {
    const m = new SparseMemory113c()
    const pPool = m.alloc(4)

    // Partial deduction: nAmount < *pPool
    m.setU32(pPool, 10)
    expect(SKILLS_DeductFromStatPool113c(m, 4, pPool)).toBe(0)
    expect(m.u32(pPool)).toBe(6)

    // Exact deduction: nAmount == *pPool
    expect(SKILLS_DeductFromStatPool113c(m, 6, pPool)).toBe(0)
    expect(m.u32(pPool)).toBe(0)

    // Overflow deduction: nAmount > *pPool -> zeroes pool and returns remainder
    m.setU32(pPool, 5)
    expect(SKILLS_DeductFromStatPool113c(m, 12, pPool)).toBe(7)
    expect(m.u32(pPool)).toBe(0)

    // Signed negative pool edge
    m.setU32(pPool, -3)
    expect(SKILLS_DeductFromStatPool113c(m, 2, pPool)).toBe(5)
    expect(m.u32(pPool)).toBe(0)
  })

  it('ports REGPOP_CanSpawnPresetMinionPack113c (0x6FC66D90)', () => {
    const { m, pDataTables } = createTestWorld(500)

    // Excluded switch cases return 0
    for (const blocked of [0xe5, 0x11c, 0x11d, 0x11e, 0x11f, 0x120, 0x188, 0x189]) {
      expect(REGPOP_CanSpawnPresetMinionPack113c(m, blocked)).toBe(0)
    }

    // Allowed neighboring and boundary IDs return 1
    for (const allowed of [-5, -1, 0, 1, 0xe4, 0xe6, 0x11b, 0x121, 0x187, 0x18a, 499, 600]) {
      expect(REGPOP_CanSpawnPresetMinionPack113c(m, allowed)).toBe(1)
    }

    // Out-of-bounds id == 0xe5 when nMonStatsCount == 200 normalizes to -1 and returns 1
    m.setU32(pDataTables + 0xa80, 200)
    expect(REGPOP_CanSpawnPresetMinionPack113c(m, 0xe5)).toBe(1)
  })

  it('ports REGPOP_RemapDirectionalMonsterClassId113c (0x6FC66E80)', () => {
    const { m, pDataTables, pMonStatsTxt } = createTestWorld(100)

    // Configure class 19 (0x13) with wBaseId = 0x13 and class 90 with wBaseId = 0x13
    m.setU16(pMonStatsTxt + 0x13 * 0x1a8 + 0x02, 0x13)
    m.setU16(pMonStatsTxt + 90 * 0x1a8 + 0x02, 0x13)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 90, 6)).toBe(0x14)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 90, 7)).toBe(0x15)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 90, 12)).toBe(0x15)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 90, 16)).toBe(0x15)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 90, 8)).toBe(90)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 90, 5)).toBe(90)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 90, 17)).toBe(90)

    // Configure class 58 (0x3a) with wBaseId = 0x3a
    m.setU16(pMonStatsTxt + 0x3a * 0x1a8 + 0x02, 0x3a)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 0x3a, 6)).toBe(0x3b)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 0x3a, 7)).toBe(0x3b)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 0x3a, 12)).toBe(0x3c)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 0x3a, 16)).toBe(0x3c)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 0x3a, 10)).toBe(0x3a)

    // Small table clamp: returns -1 when remapped target >= nMonStatsCount
    m.setU32(pDataTables + 0xa80, 0x3c) // 0x3b valid, 0x3c out-of-bounds
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 0x3a, 6)).toBe(0x3b)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 0x3a, 12)).toBe(-1)

    m.setU32(pDataTables + 0xa80, 0x15) // 0x14 valid, 0x15 out-of-bounds
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 0x13, 6)).toBe(0x14)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 0x13, 7)).toBe(-1)

    // Negative / out-of-bounds / negative wBaseId returns original nClassId
    m.setU32(pDataTables + 0xa80, 100)
    m.setU16(pMonStatsTxt + 5 * 0x1a8 + 0x02, 0xffff)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, -3, 6)).toBe(-3)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 150, 6)).toBe(150)
    expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 5, 6)).toBe(5)
  })

  it('ports MONSTER interact list queries & mutators (0x6FC68370, 0x6FC68390, 0x6FC684F0, 0x6FC686D0, 0x6FC68710, 0x6FC68750)', () => {
    const { m, pMonStatsTxt } = createTestWorld(300)

    expect(MONSTER_HasAnyInteractingPlayer113c(m, 0)).toBe(0)
    expect(MONSTER_CountInteractingPlayers113c(m, 0)).toBe(0)

    const pInteract = m.alloc(4)
    expect(MONSTER_HasAnyInteractingPlayer113c(m, pInteract)).toBe(0)
    expect(MONSTER_CountInteractingPlayers113c(m, pInteract)).toBe(0)

    const pPlayerA = m.alloc(0x100)
    const pPlayerB = m.alloc(0x100)
    const pPlayerC = m.alloc(0x100)

    const node1 = m.alloc(0x0c)
    const node2 = m.alloc(0x0c)
    const node3 = m.alloc(0x0c)
    m.setU32(node1, 0) // empty slot
    m.setU32(node1 + 0x08, node2)
    m.setU32(node2, pPlayerA)
    m.setU32(node2 + 0x04, 0) // locked conversation state 0
    m.setU32(node2 + 0x08, node3)
    m.setU32(node3, pPlayerB)
    m.setU32(node3 + 0x04, 1) // state 1
    m.setU32(node3 + 0x08, 0)

    m.setU32(pInteract, node1)
    expect(MONSTER_HasAnyInteractingPlayer113c(m, pInteract)).toBe(1)
    expect(MONSTER_CountInteractingPlayers113c(m, pInteract)).toBe(2)

    // Set up monster unit with pMonsterData + 0x30 = pInteract
    const pMonster = m.alloc(0x100)
    const pMonsterData = m.alloc(0x60)
    m.setU32(pMonster, 1)
    m.setU32(pMonster + 0x04, 150) // classId 150
    m.setU32(pMonster + 0x14, pMonsterData)
    m.setU32(pMonsterData + 0x30, pInteract)

    // Guard paths on 0x6FC684F0 / 0x6FC686D0 / 0x6FC68710
    expect(MONSTER_CheckPlayerInteractUnlocked113c(m, 0, pPlayerA)).toBe(0)
    expect(MONSTER_IsPlayerInteractInTradeState113c(m, 0, pPlayerA)).toBe(0)
    MONSTER_PromotePlayerInteractToTradeState113c(m, 0, pPlayerB)
    expect(m.u32(node3 + 0x04)).toBe(1)

    // PlayerA (state 0): locked (0), not in trade (0), promote from 0 is no-op
    expect(MONSTER_CheckPlayerInteractUnlocked113c(m, pMonster, pPlayerA)).toBe(0)
    expect(MONSTER_IsPlayerInteractInTradeState113c(m, pMonster, pPlayerA)).toBe(0)
    MONSTER_PromotePlayerInteractToTradeState113c(m, pMonster, pPlayerA)
    expect(m.u32(node2 + 0x04)).toBe(0)

    // PlayerB (state 1): unlocked (1), not yet in trade (0), promote -> state 2 -> in trade (1)
    expect(MONSTER_CheckPlayerInteractUnlocked113c(m, pMonster, pPlayerB)).toBe(1)
    expect(MONSTER_IsPlayerInteractInTradeState113c(m, pMonster, pPlayerB)).toBe(0)
    MONSTER_PromotePlayerInteractToTradeState113c(m, pMonster, pPlayerB)
    expect(m.u32(node3 + 0x04)).toBe(2)
    expect(MONSTER_IsPlayerInteractInTradeState113c(m, pMonster, pPlayerB)).toBe(1)

    // PlayerC (not in list): CheckUnlocked returns 1, IsInTrade returns 0
    expect(MONSTER_CheckPlayerInteractUnlocked113c(m, pMonster, pPlayerC)).toBe(1)
    expect(MONSTER_IsPlayerInteractInTradeState113c(m, pMonster, pPlayerC)).toBe(0)

    // 0x6FC68750 MONSTER_SetLastInteractTarget113c
    expect(MONSTER_SetLastInteractTarget113c(m, 0, 1, 0x99)).toBe(0)
    expect(MONSTER_SetLastInteractTarget113c(m, pPlayerA, 1, 0x99)).toBe(0)
    expect(MONSTER_SetLastInteractTarget113c(m, pMonster, 5, 0x99)).toBe(0)
    // Bit 0x10 (byte +0x0e bit 0) not yet set on class 150
    expect(MONSTER_SetLastInteractTarget113c(m, pMonster, 2, 0x1234)).toBe(0)

    // Enable bit 0x10 (16 -> +0x0C + 2 = +0x0E, mask 0x01)
    m.setU8(pMonStatsTxt + 150 * 0x1a8 + 0x0e, 0x01)
    expect(MONSTER_SetLastInteractTarget113c(m, pMonster, 4, 0xdeadbeef)).toBe(1)
    expect(m.u32(pMonsterData + 0x38)).toBe(4)
    expect(m.u32(pMonsterData + 0x34)).toBe(0xdeadbeef)
  })

  it('ports CLIENTS_UpdateCharacterProgression113c (0x6FC6A2D0)', () => {
    const m = new SparseMemory113c()
    CLIENTS_UpdateCharacterProgression113c(m, 0, 1, 5) // NULL guard

    const pClient = m.alloc(0x20)
    // Classic character (bit 0x20 clear -> 4 acts/diff), preserve bit 2 (0x04) and bit 15 (0x8000)
    m.setU16(pClient + 0x0a, 0x8004)
    CLIENTS_UpdateCharacterProgression113c(m, pClient, 1, 4) // 4 * 1 + 4 = 8
    expect(m.u16(pClient + 0x0a)).toBe(0x8004 | (8 << 8))

    // Lower progression (4 * 0 + 4 = 4 < 8) must NOT overwrite
    CLIENTS_UpdateCharacterProgression113c(m, pClient, 0, 4)
    expect((m.u16(pClient + 0x0a) >>> 8) & 0x1f).toBe(8)

    // Expansion character (bit 0x20 set -> 5 acts/diff): 5 * 2 + 5 = 15
    m.setU16(pClient + 0x0a, 0x8024 | (8 << 8))
    CLIENTS_UpdateCharacterProgression113c(m, pClient, 2, 5)
    expect(m.u16(pClient + 0x0a)).toBe(0x8024 | (15 << 8))
  })

  it('ports SKILLS_DivideValueByMonLvlHp113c (0x6FC6DF60), SKILLS_IsDimVisionOrTerrorState113c (0x6FC6DF80), and SKILLS_SrvSt18_ReturnOne113c (0x6FC6DFD0)', () => {
    const { m, pMonLvlTxt } = createTestWorld()

    // Row 5: dwField1C == 0 -> returns original value
    m.setU32(pMonLvlTxt + 5 * D2MonLvlTxt_SIZE + 0x1c, 0)
    expect(SKILLS_DivideValueByMonLvlHp113c(m, 5, 250)).toBe(250)

    // Row 10: dwField1C == 25 -> signed truncating division (including negative values and high-byte masking)
    m.setU32(pMonLvlTxt + 10 * D2MonLvlTxt_SIZE + 0x1c, 25)
    expect(SKILLS_DivideValueByMonLvlHp113c(m, 0x10a, 260)).toBe(10)
    expect(SKILLS_DivideValueByMonLvlHp113c(m, 10, -260)).toBe(-10)

    expect(SKILLS_IsDimVisionOrTerrorState113c(m, 0x17)).toBe(1)
    expect(SKILLS_IsDimVisionOrTerrorState113c(m, 0x38)).toBe(1)
    expect(SKILLS_IsDimVisionOrTerrorState113c(m, 0)).toBe(0)
    expect(SKILLS_IsDimVisionOrTerrorState113c(m, 0x18)).toBe(0)
    expect(SKILLS_IsDimVisionOrTerrorState113c(m, -1)).toBe(0)

    expect(SKILLS_SrvSt18_ReturnOne113c(m, 0, 0, 70, 5)).toBe(1)
  })

  it('ports SKILLS_SetNecroSkeletonComponents113c (0x6FC6E390)', () => {
    const m = new SparseMemory113c()
    const pOwner = m.alloc(0x40)
    m.setU32(pOwner + 0x20, 0x12345678)
    m.setU32(pOwner + 0x24, 0x0000029a)

    const pSkel = m.alloc(0x100)
    const pMonData = m.alloc(0x40)
    const pAiGen = m.alloc(0x40)
    m.setU32(pSkel, 1)
    m.setU32(pSkel + 0x14, pMonData)
    m.setU32(pMonData + 0x28, pAiGen)

    // Melee skeleton at tier 25 (clamped to row 10: [2, 3, 1, 0, 0, 1, 2, 2, 4]) with shield
    SKILLS_SetNecroSkeletonComponents113c(m, 25, pSkel, pOwner, 1, 0)
    expect(m.u8(pMonData + 0x04)).toBe(2) // col 0
    expect(m.u8(pMonData + 0x05)).toBe(1) // col 2
    expect(m.u8(pMonData + 0x0c)).toBe(0) // col 3
    expect(m.u8(pMonData + 0x0d)).toBe(0) // col 4
    expect(m.u8(pMonData + 0x06)).toBe(1) // col 5
    expect(m.u8(pMonData + 0x07)).toBe(2) // col 6
    expect(m.u8(pMonData + 0x08)).toBe(2) // col 7
    expect(m.u8(pMonData + 0x0b)).toBe(3) // col 1 (shield)
    expect(m.u8(pMonData + 0x09)).toBe(4) // col 8 (melee weapon)

    // Skeletal Mage at tier 3 ([0, 1, 0, 0, 0, 0, 0, 1, 1]) without shield
    m.setU8(pMonData + 0x0b, 0x77)
    m.setU32(pAiGen + 0x14, 0)
    m.setU32(pAiGen + 0x18, 99)
    const expectedProd = BigInt(0x12345678) * 0x6ac690c5n + BigInt(0x29a)
    const expectedLo = Number(expectedProd & 0xffffffffn) >>> 0
    const expectedHi = Number((expectedProd >> 32n) & 0xffffffffn) >>> 0
    const expectedElem = expectedLo & 3

    SKILLS_SetNecroSkeletonComponents113c(m, 3, pSkel, pOwner, 0, 1)
    expect(m.u32(pOwner + 0x20)).toBe(expectedLo)
    expect(m.u32(pOwner + 0x24)).toBe(expectedHi)
    expect(m.u8(pMonData + 0x0b)).toBe(0x77) // untouched when bHasShield == 0
    expect(m.u8(pMonData + 0x0f)).toBe(expectedElem)
    expect(m.u8(pMonData + 0x10)).toBe(expectedElem)
    expect(m.u32(pAiGen + 0x14)).toBe(1)
    expect(m.u32(pAiGen + 0x18)).toBe(0)

    // NULL monster in mage mode still steps owner seed without crashing
    SKILLS_SetNecroSkeletonComponents113c(m, 1, 0, pOwner, 1, 1)
    expect(m.u32(pOwner + 0x20)).not.toBe(expectedLo)
  })

  it('ports SUNIT_CanTargetOwnPetWithSkill113c (0x6FD00210) and SUNIT_GetOwnerUnit113c (0x6FD00A20)', () => {
    const { m, pSkillsTxt } = createTestWorld()
    const pGame = m.alloc(0x1df4)

    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x0c, 42)
    SUNIT_InsertServerUnit113c(m, pGame, pPlayer)

    const pPet = m.alloc(0x100)
    const pPetData = m.alloc(0x40)
    const pAiGen = m.alloc(0x40)
    m.setU32(pPet, 1)
    m.setU32(pPet + 0x0c, 105)
    m.setU32(pPet + 0x14, pPetData)
    m.setU32(pPetData + 0x28, pAiGen)
    m.setU32(pAiGen + 0x28, 1) // has owner group/ref
    m.setU32(pAiGen + 0x2c, 42) // ownerId = 42
    m.setU32(pAiGen + 0x30, 0) // ownerType = UNIT_PLAYER (0)

    // Skill 50: initially lacks bit 0x02 at +0x07
    expect(SUNIT_CanTargetOwnPetWithSkill113c(m, 0, pPet, 50)).toBe(0)
    expect(SUNIT_CanTargetOwnPetWithSkill113c(m, pPlayer, 0, 50)).toBe(0)
    expect(SUNIT_CanTargetOwnPetWithSkill113c(m, pPlayer, pPet, -1)).toBe(0)
    expect(SUNIT_CanTargetOwnPetWithSkill113c(m, pPlayer, pPet, 500)).toBe(0)
    expect(SUNIT_CanTargetOwnPetWithSkill113c(m, pPlayer, pPet, 50)).toBe(0)

    // Enable SkillsTxt[50] byte +0x07 bit 1 (0x02)
    m.setU8(pSkillsTxt + 50 * 0x23c + 0x07, 0x02)
    expect(SUNIT_CanTargetOwnPetWithSkill113c(m, pPlayer, pPet, 50)).toBe(1)

    // Mismatched owner ID or non-player ownerType returns 0
    m.setU32(pAiGen + 0x2c, 99)
    expect(SUNIT_CanTargetOwnPetWithSkill113c(m, pPlayer, pPet, 50)).toBe(0)
    m.setU32(pAiGen + 0x2c, 42)
    m.setU32(pAiGen + 0x30, 1)
    expect(SUNIT_CanTargetOwnPetWithSkill113c(m, pPlayer, pPet, 50)).toBe(0)

    // 0x6FD00A20 SUNIT_GetOwnerUnit113c
    expect(SUNIT_GetOwnerUnit113c(m, 0, pGame)).toBe(0)
    m.setU32(pPet + 0x94, 0)
    m.setU32(pPet + 0x98, 42)
    m.setU32(pPet + 0xc8, 0) // bit 10 (0x0400) clear
    expect(SUNIT_GetOwnerUnit113c(m, pPet, pGame)).toBe(0)

    m.setU32(pPet + 0xc8, 0x0400) // bit 10 set
    expect(SUNIT_GetOwnerUnit113c(m, pPet, pGame)).toBe(pPlayer)
  })

  it('ports Act 3 quest filter & state helpers (0x6FD028A0, 0x6FD028B0, 0x6FD028C0, 0x6FD02900, 0x6FD02960, 0x6FD02AB0, 0x6FD02EF0, 0x6FD03000, 0x6FD03030, 0x6FD03040)', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pQuestFlags, pRoom } = allocPlayerWithQuests(m, 1, 0, 0x4b) // Kurast Docks (75)
    const pOutStatus = m.alloc(4)
    m.setU8(pOutStatus, 0x7f)

    // No-op & zero filters
    expect(ACT3Q0_ActiveFilter113c(m, 0, 0xff, pPlayer, pQuestFlags, 0)).toBe(0)
    expect(ACT3Q0_StatusFilter113c(m, 0, pPlayer, 0, pQuestFlags, pOutStatus)).toBe(0)
    expect(ACT3Q1_HratliIntroStatusFilter113c(m, 0, pPlayer, 0, pQuestFlags, pOutStatus)).toBe(0)
    expect(m.u8(pOutStatus)).toBe(0x7f)

    expect(ACT3Q2_DarkWandererStatusFilter113c(m, 0, pPlayer, 0, pQuestFlags, pOutStatus)).toBe(0)
    expect(m.u8(pOutStatus)).toBe(0)
    ACT3Q7_Callback11_Noop113c(m, 0, 0)

    // 0x6FD03000 ACT3Q1_HratliIntroActiveFilter113c (NPC 0xFD == Hratli, quest 0x10 bit 0)
    expect(ACT3Q1_HratliIntroActiveFilter113c(m, 0, 0xff, pPlayer, pQuestFlags, 0)).toBe(0)
    expect(ACT3Q1_HratliIntroActiveFilter113c(m, 0, 0xfd, pPlayer, pQuestFlags, 0)).toBe(1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x10, 0)
    expect(ACT3Q1_HratliIntroActiveFilter113c(m, 0, 0xfd, pPlayer, pQuestFlags, 0)).toBe(0)

    // 0x6FD028C0 ACT3Q6_MephistoActiveFilter113c
    const pQuestMeph = m.alloc(0x100)
    m.setU8(pQuestMeph + 0x0c, 1)
    expect(ACT3Q6_MephistoActiveFilter113c(m, pQuestMeph, 0xff, pPlayer, pQuestFlags, 0)).toBe(1)
    expect(ACT3Q6_MephistoActiveFilter113c(m, pQuestMeph, 0xf5, pPlayer, pQuestFlags, 0)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 0)
    expect(ACT3Q6_MephistoActiveFilter113c(m, pQuestMeph, 0xff, pPlayer, pQuestFlags, 0)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 0x0b)
    expect(ACT3Q6_MephistoActiveFilter113c(m, pQuestMeph, 0xff, pPlayer, pQuestFlags, 0)).toBe(1)

    // 0x6FD02AB0 ACT3Q5_BlackenedTempleActiveFilter113c
    const pQuestCouncil = m.alloc(0x100)
    const pCouncilEx = m.alloc(0x20)
    m.setU32(pQuestCouncil + 0x18, pCouncilEx)
    m.setU8(pQuestCouncil + 0x0c, 1)
    expect(ACT3Q5_BlackenedTempleActiveFilter113c(m, pQuestCouncil, 0xff, pPlayer, pQuestFlags, 0)).toBe(1)
    expect(ACT3Q5_BlackenedTempleActiveFilter113c(m, pQuestCouncil, 0xf5, pPlayer, pQuestFlags, 0)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 4)
    expect(ACT3Q5_BlackenedTempleActiveFilter113c(m, pQuestCouncil, 0xf5, pPlayer, pQuestFlags, 0)).toBe(1)
    m.setU8(pCouncilEx + 0x0c, 1)
    expect(ACT3Q5_BlackenedTempleActiveFilter113c(m, pQuestCouncil, 0xf5, pPlayer, pQuestFlags, 0)).toBe(0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 0)
    expect(ACT3Q5_BlackenedTempleActiveFilter113c(m, pQuestCouncil, 0xff, pPlayer, pQuestFlags, 0)).toBe(0)

    // 0x6FD02900 ACT3Q5_IsDuranceEntryBlocked113c & 0x6FD02960 ACT3Q5_IsCompellingOrbIntact113c
    // Before quest chain attached: CompellingOrbIntact returns 1, DuranceEntryBlocked returns 0
    expect(ACT3Q5_IsCompellingOrbIntact113c(m, pGame)).toBe(1)
    expect(ACT3Q5_IsDuranceEntryBlocked113c(m, pGame, pPlayer)).toBe(0)

    const chain = attachQuestChain(m, pGame, [{ nQuestNo: 0x13 }])
    const q13Ex = chain.get(0x13)!.pQuestDataEx
    expect(ACT3Q5_IsCompellingOrbIntact113c(m, pGame)).toBe(1)
    expect(ACT3Q5_IsDuranceEntryBlocked113c(m, pGame, pPlayer)).toBe(1)

    // Inside level 0x65 (Durance of Hate Level 2), entry is never blocked even when orb is intact
    const pRoomEx = m.u32(pRoom + 0x10)
    const pLevel = m.u32(pRoomEx + 0x58)
    m.setU32(pLevel + 0x1d0, 0x65)
    expect(ACT3Q5_IsDuranceEntryBlocked113c(m, pGame, pPlayer)).toBe(0)

    // Once Compelling Orb smashed (+0x0C = 1), neither is intact/blocked
    m.setU32(pLevel + 0x1d0, 0x53) // Travincal
    m.setU8(q13Ex + 0x0c, 1)
    expect(ACT3Q5_IsCompellingOrbIntact113c(m, pGame)).toBe(0)
    expect(ACT3Q5_IsDuranceEntryBlocked113c(m, pGame, pPlayer)).toBe(0)
  })

  it('ports Act 3 quest chain data accessors & mutators (0x6FD02B10, 0x6FD02B40, 0x6FD02C40, 0x6FD02CD0, 0x6FD02DB0, 0x6FD03B00, 0x6FD04900)', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer } = allocPlayerWithQuests(m, 7, 1, 0x4b)
    const pOutCoords = m.alloc(8)

    // Missing quest nodes safe defaults
    ACT3Q4_ClearOrmusNpcWaitFlag113c(m, pGame)
    expect(ACT3Q4_CheckOrmusNpcWaitFlag113c(m, pGame)).toBe(0)
    expect(ACT3Q1_GetHratliTargetCoords113c(m, pGame, pOutCoords)).toBe(0)
    expect(ACT3Q1_GetQuestDataByte04_113c(m, pGame)).toBe(0)
    ACT3Q2_AddQuestDataCount1C_113c(m, pGame, 3)

    const chain = attachQuestChain(m, pGame, [
      { nQuestNo: 0x10 },
      { nQuestNo: 0x11 },
      { nQuestNo: 0x12 },
    ])
    const q10 = chain.get(0x10)!
    const q11 = chain.get(0x11)!
    const q12 = chain.get(0x12)!

    // 0x6FD02B40 & 0x6FD02B10 (quest 0x12 Ormus wait byte at +0x00)
    m.setU8(q12.pQuestDataEx, 1)
    expect(ACT3Q4_CheckOrmusNpcWaitFlag113c(m, pGame)).toBe(1)
    ACT3Q4_ClearOrmusNpcWaitFlag113c(m, pGame)
    expect(ACT3Q4_CheckOrmusNpcWaitFlag113c(m, pGame)).toBe(0)

    // 0x6FD02C40 & 0x6FD02CD0 (quest 0x11 Hratli coords & byte +0x04)
    m.setU8(q11.pQuestDataEx + 0x04, 9)
    expect(ACT3Q1_GetQuestDataByte04_113c(m, pGame)).toBe(9)
    m.setU32(q11.pQuestDataEx + 0x10, 5120)
    m.setU32(q11.pQuestDataEx + 0x14, 5184)
    expect(ACT3Q1_GetHratliTargetCoords113c(m, pGame, pOutCoords)).toBe(0) // +0x06 == 0
    m.setU8(q11.pQuestDataEx + 0x06, 1)
    expect(ACT3Q1_GetHratliTargetCoords113c(m, pGame, pOutCoords)).toBe(1)
    expect(m.u32(pOutCoords)).toBe(5120)
    expect(m.u32(pOutCoords + 0x04)).toBe(5184)

    // 0x6FD02DB0 & 0x6FD04900 (quest 0x10 relic counters)
    m.setU32(q10.pQuestDataEx + 0x10, 2)
    m.setU32(q10.pQuestDataEx + 0x14, 3)
    m.setU32(q10.pQuestDataEx + 0x18, 4)
    m.setU32(q10.pQuestDataEx + 0x1c, 1)
    m.setU32(q10.pQuestDataEx + 0x20, 0)
    ACT3Q2_AddQuestDataCount1C_113c(m, pGame, 2)
    expect(m.u32(q10.pQuestDataEx + 0x1c)).toBe(3)
    expect(m.u8(q10.pQuestDataEx + 0x27)).toBe(1)

    ACT3Q3_OnKhalimsWillCubed113c(m, pPlayer, pGame)
    expect(m.u32(q10.pQuestDataEx + 0x10)).toBe(1)
    expect(m.u32(q10.pQuestDataEx + 0x14)).toBe(2)
    expect(m.u32(q10.pQuestDataEx + 0x18)).toBe(3)
    expect(m.u32(q10.pQuestDataEx + 0x1c)).toBe(2)
    expect(m.u32(q10.pQuestDataEx + 0x20)).toBe(1)

    // 0x6FD03B00 ACT3Q4_OnQuestUnitDeactivate113c
    const pTomeUnit = m.alloc(0x40)
    m.setU32(pTomeUnit + 0x0c, 0x777)
    m.setU8(q12.pQuestDataEx + 0x02, 1)
    m.setU32(q12.pQuestDataEx + 0x04, 0x888)
    ACT3Q4_OnQuestUnitDeactivate113c(m, q12.pQuest, pTomeUnit) // non-matching guid
    expect(m.u8(q12.pQuestDataEx + 0x02)).toBe(1)

    m.setU32(q12.pQuestDataEx + 0x04, 0x777)
    ACT3Q4_OnQuestUnitDeactivate113c(m, q12.pQuest, pTomeUnit) // matching guid
    expect(m.u8(q12.pQuestDataEx + 0x02)).toBe(0)
    expect(m.u8(q12.pQuestDataEx + 0x01)).toBe(1)
  })

  it('ports Act 3 player/party callbacks & packet 0x5D sender (0x6FD030C0, 0x6FD037D0, 0x6FD03A80, 0x6FD03C70, 0x6FD049E0, 0x6FD04A50, 0x6FD05230, 0x6FD05370)', () => {
    const m = new SparseMemory113c()
    const { pGame, pPlayer, pPlayerData, pQuestFlags, pRoom } = allocPlayerWithQuests(m, 11, 2, 0x01) // Act 1 Rogue Encampment

    const chain = attachQuestChain(m, pGame, [
      { nQuestNo: 0x0f, bState: 3 },
      { nQuestNo: 0x12, bState: 1 },
      { nQuestNo: 0x13, bState: 2 },
    ])
    const q12 = chain.get(0x12)!
    const q13 = chain.get(0x13)!

    // In Act 1 (level 1 -> actNo 0), 0x6FD030C0 and 0x6FD037D0 do NOT set Act 3 quest bits
    expect(ACT3Q0_MarkWandererSeenCallback113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x20, 0)).toBe(0)
    ACT3Q5_CompleteCouncilPartyCallback113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 4)).toBe(0)

    // Move player to Act 3 (level 0x53 = 83 = Travincal -> actNo 2)
    const pRoomEx = m.u32(pRoom + 0x10)
    const pLevel = m.u32(pRoomEx + 0x58)
    m.setU32(pLevel + 0x1d0, 0x53)

    expect(ACT3Q0_MarkWandererSeenCallback113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x20, 0)).toBe(1)

    // 0x6FD03A80 ACT3Q5_SyncCouncilQuestFlagsCallback113c sets bits 2 & 3 on quest 0x15
    m.setU8(q13.pQuestDataEx + 0x05, 1)
    expect(ACT3Q5_SyncCouncilQuestFlagsCallback113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 2)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 3)).toBe(1)

    // 0x6FD037D0 ACT3Q5_CompleteCouncilPartyCallback113c sets state 4 (since 0x12 bit 0 is clear) and 0x0d
    ACT3Q5_CompleteCouncilPartyCallback113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 4)).toBe(1)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0x0d)).toBe(1)

    // 0x6FD03C70 ACT3Q4_SyncTomePartyQuestStateCallback113c sets quest 0x14 state from q12.pQuestDataEx + 0x18
    m.setU32(q12.pQuestDataEx + 0x18, 0x0c)
    ACT3Q4_SyncTomePartyQuestStateCallback113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0x0c)).toBe(1)

    // 0x6FD05370 & 0x6FD05230 (quest 0x11 Gidbinn)
    expect(ACT3Q6_SyncGidbinnState02Callback113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 2)).toBe(1)
    expect(ACT3Q6_SetGidbinnState0ECallback113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0x0e)).toBe(1)

    // 0x6FD049E0 ACT3Q7_Callback14_PlayerJoined113c
    const pQuest7 = m.alloc(0x100)
    const pQuest7Ex = m.alloc(0x30)
    m.setU32(pQuest7 + 0x18, pQuest7Ex)
    m.setU8(pQuest7 + 0x14, 0x03)
    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)

    ACT3Q7_Callback14_PlayerJoined113c(m, pQuest7, pQuestArg) // all 0 -> unchanged
    expect(m.u8(pQuest7 + 0x0c)).toBe(0)
    m.setU32(pQuest7Ex + 0x14, 1) // non-zero organ counter
    ACT3Q7_Callback14_PlayerJoined113c(m, pQuest7, pQuestArg)
    expect(m.u8(pQuest7 + 0x0c)).toBe(2)
    expect(m.u8(pQuest7 + 0x0b)).toBe(7)

    // 0x6FD04A50 ACT3Q7_SendQuestUpdatePacket5D_113c
    const pClient = m.alloc(0x200)
    const pQueue = m.alloc(0x410)
    m.setU32(pClient + 0x1bc, pQueue)
    m.setU32(pPlayerData + 0x9c, pClient)

    ACT3Q7_SendQuestUpdatePacket5D_113c(m, pQuest7, 0x06, pQuestArg)
    expect(m.u32(pQueue + 0x04)).toBe(6)
    expect(m.u8(pQueue + 0x08)).toBe(0x5d)
    expect(m.u8(pQueue + 0x09)).toBe(0x10)
    expect(m.u8(pQueue + 0x0a)).toBe(0x03)
    expect(m.u8(pQueue + 0x0b)).toBe(0x06)
    expect(m.u16(pQueue + 0x0c)).toBe(0)
  })

  it('ports PARTY player relation list queries (0x6FD10060, 0x6FD100E0, 0x6FD101D0, 0x6FD102A0)', () => {
    const m = new SparseMemory113c()
    const { pPlayer: pAlice, pPlayerData: pAliceData } = allocPlayerWithQuests(m, 1)
    const { pPlayer: pBob } = allocPlayerWithQuests(m, 2)
    const { pPlayer: pCarol } = allocPlayerWithQuests(m, 3)

    m.setU32(pAliceData + 0x160, 0xabcd1234) // global hostile delay tick when target == 0

    // Link two relation nodes on Alice (+0x38, next at +0x10): node1 (guid 99) -> node2 (Bob guid 2)
    const node1 = m.alloc(0x14)
    const nodeBob = m.alloc(0x14)
    m.setU32(node1, 99)
    m.setU32(node1 + 0x04, 0x01)
    m.setU32(node1 + 0x08, 1111)
    m.setU16(node1 + 0x0c, 2)
    m.setU32(node1 + 0x10, nodeBob)

    m.setU32(nodeBob, 2)
    m.setU32(nodeBob + 0x04, 0x09) // loot (0x01) | hostile (0x08)
    m.setU32(nodeBob + 0x08, 5555)
    m.setU16(nodeBob + 0x0c, 4)
    m.setU32(nodeBob + 0x10, 0)

    m.setU32(pAliceData + 0x38, node1)

    // 0x6FD10060 PARTY_FindPlayerRelationNode113c
    expect(PARTY_FindPlayerRelationNode113c(m, pAlice, pAlice)).toBe(0)
    expect(PARTY_FindPlayerRelationNode113c(m, pAlice, 0)).toBe(0)
    expect(PARTY_FindPlayerRelationNode113c(m, pAlice, pCarol)).toBe(0)
    expect(PARTY_FindPlayerRelationNode113c(m, pAlice, pBob)).toBe(nodeBob)

    // 0x6FD100E0 PARTY_GetHostileCooldownTick113c
    expect(PARTY_GetHostileCooldownTick113c(m, pAlice, 0)).toBe(0xabcd1234)
    expect(PARTY_GetHostileCooldownTick113c(m, pAlice, pAlice)).toBe(0)
    expect(PARTY_GetHostileCooldownTick113c(m, pAlice, pCarol)).toBe(0)
    expect(PARTY_GetHostileCooldownTick113c(m, pAlice, pBob)).toBe(5555)

    // 0x6FD101D0 PARTY_GetPlayerRelationState113c
    expect(PARTY_GetPlayerRelationState113c(m, pAlice, pAlice)).toBe(1) // self returns 1
    expect(PARTY_GetPlayerRelationState113c(m, pAlice, pCarol)).toBe(0)
    expect(PARTY_GetPlayerRelationState113c(m, pAlice, pBob)).toBe(4)

    // 0x6FD102A0 PARTY_TestPlayerRelationFlags113c
    expect(PARTY_TestPlayerRelationFlags113c(m, pAlice, pAlice, 0xff)).toBe(0)
    expect(PARTY_TestPlayerRelationFlags113c(m, pAlice, pCarol, 0xff)).toBe(0)
    expect(PARTY_TestPlayerRelationFlags113c(m, pAlice, pBob, 0x08)).toBe(0x08)
    expect(PARTY_TestPlayerRelationFlags113c(m, pAlice, pBob, 0x02)).toBe(0)
  })
})
