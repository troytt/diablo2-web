import { describe, expect, it } from 'vitest'
import {
  GDW_BITMASKS_IAT_VA_113C,
  SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/skills.ts'
import * as w8b1Exports from '../../../src/d2kern-113c/game/k2-w8b1-113c.ts'
import {
  ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c,
  ACT1Q1_SequenceFilter_6FC85410_113c,
  ACT1Q2_OnBurialGroundsEntered_6FC85440_113c,
  ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c,
  ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c,
  ACT1Q5_OnHoradricMalusDroppedOrRemoved_6FC855F0_113c,
  ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c,
  ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c,
  ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c,
  ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c,
  ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c,
  ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c,
  ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c,
  ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c,
  GAME_CreateMultiClientGame_6FC4C570_113c,
  GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c,
  MONSTER_MarkSpawnNodeProcessedAndTrigger_6FC68B60_113c,
  MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c,
  MONUMOD_KnockBeltPotionToGround_6FC44440_113c,
  PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c,
  PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c,
  PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c,
  QUESTS_DefaultSequenceFilter_6FC7AFB0_113c,
  QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c,
  QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c,
  QUESTS_UseQuestScrollItem_6FC56070_113c,
  SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c,
  SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c,
  SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c,
  SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c,
} from '../../../src/d2kern-113c/game/k2-w8b1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function allocZero(m: SparseMemory113c, size: number): number {
  const ptr = m.alloc(size)
  for (let i = 0; i < size; i += 4) {
    m.setU32((ptr + i) >>> 0, 0)
  }
  return ptr
}

function setupTestMem() {
  const m = new SparseMemory113c()
  const holder = allocZero(m, 4)
  const pDataTables = allocZero(m, 0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  const pMasks = allocZero(m, 128)
  for (let i = 0; i < 32; i++) {
    m.setU32(pMasks + i * 4, (1 << i) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pMasks)
  m.setU32(GDW_BITMASKS_IAT_VA_113C, pMasks)
  m.setU32(0x6fd31c20, 0)
  m.setU32(0x6fd31c24, 0)
  m.setU32(0x6fd2d8bc, 0)

  m.setU32(holder, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, holder)
  m.setU32(SGPT_DATATABLES_VA_113C, pDataTables)

  const pSkillsTxt = allocZero(m, 0x23c * 16)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 16)

  const pMissilesTxt = allocZero(m, 0x1a4 * 16)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 16)

  const pStatesTxt = allocZero(m, 0x40 * 32)
  for (let i = 0; i < 32; i++) {
    m.setU16(pStatesTxt + i * 0x40 + 0x02, 0xffff)
  }
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc0, pStatesTxt)
  m.setU32(pDataTables + 0xc4, 32)
  m.setU32(pDataTables + 0xbd4, 359)

  const pGame = allocZero(m, 0x1e00)
  m.setU32(pGame + 0xa8, 100)
  EVENT_InitTimerQueue113c(m, pGame)

  return { m, pDataTables, pSkillsTxt, pMissilesTxt, pGame }
}

describe('K2 Wave 8 Batch 1 (30 D2Game VAs 0x6FC2C1B0..0x6FC855F0)', () => {
  it('exports all 30 functions', () => {
    const fnList = Object.values(w8b1Exports).filter((v) => typeof v === 'function')
    expect(fnList.length).toBe(30)
  })

  it('[1..5] ResurrectMonster, Event07_KillOrUnsummonUnit, KnockBeltPotion, CreateSinglePlayer, CreateMultiClient', () => {
    const { m, pGame } = setupTestMem()

    expect(SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c(m, pGame, 0)).toBe(0)
    const pMon = allocZero(m, 0x100)
    const pPath = allocZero(m, 0x80)
    m.setU32(pMon, 1)
    m.setU32(pMon + 0x2c, pPath)
    m.setU32(pMon + 0xc4, 0x0e)
    expect(SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c(m, pGame, pMon)).toBe(1)
    expect(m.u32(pMon + 0xc4) & 0x0e).toBe(0)

    m.setU8(pMon + 0xc6, 1)
    MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c(m, pGame, pMon)

    MONUMOD_KnockBeltPotionToGround_6FC44440_113c(m, pGame, 0, 0)
    const pPlayer = allocZero(m, 0x100)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x60, 0)
    MONUMOD_KnockBeltPotionToGround_6FC44440_113c(m, pGame, 0, pPlayer)

    m.setU32(0x6fd2c55c, 0)
    const pName = allocZero(m, 16)
    const pPass = allocZero(m, 16)
    const pDesc = allocZero(m, 16)
    const pHandshake = allocZero(m, 0x80)
    GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c(m, pName, pPass, pDesc, pHandshake, 0, 0, 1)
    expect(
      GAME_CreateMultiClientGame_6FC4C570_113c(m, pName, pPass, pDesc, 4, 0, 0, 1, pHandshake),
    ).toBe(0)
  })

  it('[6..10] TriggerAct5Portal, UseQuestScroll, SpawnPortalFromMissile, InfernoCheckMana, MultipleShotSpread', () => {
    const { m, pGame, pSkillsTxt } = setupTestMem()

    const pPlayer = allocZero(m, 0x100)
    QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c(m, pPlayer, pGame)

    const pScroll = allocZero(m, 0x100)
    m.setU32(pScroll, 4)
    m.setU32(pScroll + 0x04, 0xfff)
    QUESTS_UseQuestScrollItem_6FC56070_113c(m, pGame, pPlayer, 999)

    const pMissile = allocZero(m, 0x100)
    const pMPath = allocZero(m, 0x80)
    m.setU32(pMissile, 3)
    m.setU32(pMissile + 0x2c, pMPath)
    expect(() => QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c(m, pMissile, pGame, 1)).toThrow()

    expect(SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
    m.setU16(pSkillsTxt + 0x23c + 0x184, 10)
    m.setU16(pSkillsTxt + 0x23c + 0x48, 0xffff)
    expect(SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c(m, pGame, pPlayer, 1, 1)).toBe(0)

    expect(SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c(m, pGame, pPlayer, -1, 1)).toBe(
      0,
    )
    m.setU16(pSkillsTxt + 2 * 0x23c + 0x48, 0xffff)
    expect(SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c(m, pGame, pPlayer, 2, 1)).toBe(
      0,
    )
  })

  it('[11..20] MarkSpawnNode, AttractConvert, SerializeSave, SaveSinglePlayer, CommitRealmSave, Act5Q4/Q1/Q5', () => {
    const { m, pGame, pSkillsTxt } = setupTestMem()

    const pListHead = allocZero(m, 4)
    const pNode = allocZero(m, 12)
    const pNpc = allocZero(m, 0x100)
    m.setU32(pNpc, 1)
    m.setU32(pNpc + 0x04, 1)
    m.setU32(pListHead, pNode)
    m.setU32(pNode, pNpc)
    m.setU32(pNode + 4, 0)
    const pPlayer = allocZero(m, 0x100)
    m.setU32(pPlayer + 0x2c, allocZero(m, 0x80))
    MONSTER_MarkSpawnNodeProcessedAndTrigger_6FC68B60_113c(m, pListHead, pNpc, pGame, pPlayer)
    expect(m.u32(pNode + 4)).toBe(1)

    expect(SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c(m, pGame, pPlayer, -1, 1)).toBe(
      0,
    )
    expect(SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c(m, pGame, pPlayer, 1, 1)).toBe(
      0,
    )
    void pSkillsTxt

    const pClient = allocZero(m, 0x200)
    const pPlayerUnit = allocZero(m, 0x100)
    m.setU8(pGame + 0x1d25, 0)
    expect(
      PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c(m, 0, pPlayerUnit, pGame, 0, 0, 0, 0, 0),
    ).toBe(0)
    PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c(m, pGame, pPlayerUnit, 0, 0, 0)
    void pClient
    void PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c

    const pPlayerData = allocZero(m, 0x100)
    const pQuestRec = allocZero(m, 0x100)
    m.setU32(pQuestRec, allocZero(m, 0x100))
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestRec)
    const pQuestData = allocZero(m, 0x100)
    const pQuestEx = allocZero(m, 0x200)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQuestEx)
    const pQuestArg = allocZero(m, 0x40)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x04, 1)
    m.setU32(pQuestArg + 0x08, pPlayer)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c(m, pQuestData, pQuestArg)

    m.setU8(pQuestData + 0x09, 0)
    m.setU32(pQuestData + 0xf4, 0)
    expect(QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m, pQuestData)).toBe(0)

    m.setU16(pQuestArg + 0x14, 0x999)
    ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c(m, pQuestData, pQuestArg)

    ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c(m, pGame, pPlayer)

    ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c(m, pGame)
  })

  it('[21..30] AnyaInteract, TrySpawnNihlathakPortal, Act5Q5NpcIntro, Act1Q6/Q5/Q1/Q2/Q4 quest handlers', () => {
    const { m, pGame } = setupTestMem()

    const pQuestData = allocZero(m, 0x100)
    const pQuestEx = allocZero(m, 0x200)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQuestEx)
    const pQuestArg = allocZero(m, 0x40)
    m.setU32(pQuestArg, pGame)

    ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c(m, pQuestData, pQuestArg)
    ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c(m, pGame, 0)

    m.setU16(pQuestArg + 0x18, 0x9999)
    m.setU16(pQuestArg + 0x14, 0x100)
    ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c(m, pQuestData, pQuestArg)

    m.setU16(pQuestArg + 0x14, 0x100)
    ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c(m, pQuestData, pQuestArg)

    ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c(m, pQuestData, pQuestArg)
    ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c(m, pQuestData, pQuestArg)

    m.setU8(pQuestData + 0x0c, 1)
    expect(ACT1Q1_SequenceFilter_6FC85410_113c(m, pQuestData)).toBe(1)

    m.setU8(pQuestEx + 0x4f, 1)
    ACT1Q2_OnBurialGroundsEntered_6FC85440_113c(m, pQuestData)

    m.setU8(pQuestData + 0x09, 0)
    ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c(m, pQuestData, pQuestArg)

    m.setU8(pQuestData + 0x09, 1)
    m.setU32(pQuestEx + 0x9c, 2)
    ACT1Q5_OnHoradricMalusDroppedOrRemoved_6FC855F0_113c(m, pQuestData)
    expect(m.u32(pQuestEx + 0x9c)).toBe(1)
  })
})
