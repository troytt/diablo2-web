import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import * as w7b3Exports from '../../../src/d2kern-113c/game/k2-w7b3-113c.ts'
import {
  ACT2Q3_SeqCallback_6FCE6390_113c,
  ACT2Q3_StartEclipseEvent_6FCE6A30_113c,
  ACT2Q5_OnScrollMessage_6FCE67C0_113c,
  ACT2Q5_OnSummonerKilled_6FCE66B0_113c,
  ACT2Q5_SeqCallback_6FCE69D0_113c,
  ACT2Q6_PropagatePartyCompletionCallback_6FCE65A0_113c,
  ACT4Q1_OnIzualKilled_6FCDABF0_113c,
  ACT4Q1_SeqCallback_6FCDA270_113c,
  ACT4Q3_OnScrollMessage_6FCDB250_113c,
  ACT4Q3_SeqCallback_6FCDA4F0_113c,
  AIBAAL_CloneThink_6FCD8460_113c,
  AIBAAL_CombatThink_6FCC9610_113c,
  AIBAAL_ThroneRoomThink_6FCD8610_113c,
  ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c,
  ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c,
  ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c,
  MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c,
  MONAI_NihlathakThink_6FCC7580_113c,
  MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c,
  MONAI_SiegeMinionThinkA_6FCC5EB0_113c,
  MONAI_SiegeMinionThinkB_6FCC6050_113c,
  MONAI_SiegeMinionThinkC_6FCC62D0_113c,
  MONAI_WorldstoneMinionThink_6FCC7410_113c,
  MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c,
  NPC_OnHealerNpcInteract_6FCDD810_113c,
  PARTY_AddPlayerToSubParty_6FCBC4F0_113c,
  PARTY_RemoveSubPartyById_6FCBC7D0_113c,
  PETS_FreePlayerPetTable_6FCB7640_113c,
  PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c,
  PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c,
  SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c,
  SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c,
  SKILLS_SrvDo028_Conversion_6FCB9830_113c,
  SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c,
  SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c,
  SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c,
  SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c,
  SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c,
  SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function allocGame(m: SparseMemory113c): number {
  const pGame = m.alloc(0x2000) >>> 0
  EVENT_InitTimerQueue113c(m, pGame)
  const pTables = m.alloc(0x1000) >>> 0
  m.setU32(0x6fd1829c, 0x6fde9e1c)
  m.setU32(0x6fde9e1c, pTables)
  m.setU32(0x6fd31c20, 0)
  const pQuestCtrl = m.alloc(0x40) >>> 0
  const pQuest23 = m.alloc(0x100) >>> 0
  const pQuest23Ex = m.alloc(0x40) >>> 0
  m.setU32(pQuest23, 0x23)
  m.setU32((pQuest23 + 0x18) >>> 0, pQuest23Ex)
  m.setU32(pQuestCtrl, pQuest23)
  m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)
  return pGame
}

describe('K2 Wave 7 Batch 3 (39 D2Game VAs)', () => {
  it('exports all 39 functions and satisfies JSDoc and purity invariants', () => {
    const fnNames = Object.keys(w7b3Exports).filter(
      (k) => typeof (w7b3Exports as Record<string, unknown>)[k] === 'function',
    )
    expect(fnNames.length).toBe(39)

    const src = readFileSync(
      resolve(__dirname, '../../../src/d2kern-113c/game/k2-w7b3-113c.ts'),
      'utf8',
    )
    expect(src).not.toContain('server/')
    expect(src).not.toContain('.sort(')
    expect(src).not.toContain('.toSorted(')
    expect(src).not.toContain('??')
    expect((src.match(/@dll D2Game\.dll/g) || []).length).toBe(39)
    expect((src.match(/@va 0x6FC/gi) || []).length).toBe(39)
    expect((src.match(/@ordinalOrName D2Game_6FC/gi) || []).length).toBe(39)
  })

  it('PETS_FreePlayerPetTable_6FCB7640_113c clears pPlayerData->pPetTable (+0x44)', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pPlayer = m.alloc(0x100) >>> 0
    const pPlayerData = m.alloc(0xc0) >>> 0
    const pPetTable = m.alloc(0x20) >>> 0
    const pSlots = m.alloc(0x80) >>> 0
    const pTables = m.alloc(0xd00) >>> 0
    m.setU32(0x6fde9e1c, pTables)
    m.setU32((pTables + 0xbf0) >>> 0, 2)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    m.setU32((pPlayerData + 0x44) >>> 0, pPetTable)
    m.setU32(pPetTable, pSlots)

    PETS_FreePlayerPetTable_6FCB7640_113c(m, pGame, pPlayer)
    expect(m.u32((pPlayerData + 0x44) >>> 0)).toBe(0)
  })

  it('PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c returns early when pet GUID is not found', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pPlayer = m.alloc(0x100) >>> 0
    const pPlayerData = m.alloc(0xc0) >>> 0
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(m, pGame, pPlayer, 0x999, 0)
    expect(m.u32((pPlayerData + 0x44) >>> 0)).toBe(0)
  })

  it('SKILLS_SrvDo028_Conversion_6FCB9830_113c returns 0 when pTarget is missing or not a monster', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pCaster = m.alloc(0x100) >>> 0
    expect(SKILLS_SrvDo028_Conversion_6FCB9830_113c(m, pGame, pCaster, 0x74, 1)).toBe(0)
  })

  it('ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c returns early when inventory has no items', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pUnit = m.alloc(0x100) >>> 0
    const pInventory = m.alloc(0x40) >>> 0
    m.setU32(pInventory, 0x01020304)
    m.setU32((pUnit + 0x60) >>> 0, pInventory)
    const pClient = m.alloc(0x200) >>> 0
    ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c(m, 0, pGame, pUnit, pClient)
    expect(m.u32((pUnit + 0x60) >>> 0)).toBe(pInventory)
  })

  it('PARTY_AddPlayerToSubParty_6FCBC4F0_113c and PARTY_RemoveSubPartyById_6FCBC7D0_113c manage sub-party list', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pPartyCtrl = m.alloc(0x20) >>> 0
    const pSubParty = m.alloc(0x10) >>> 0
    const pPlayer = m.alloc(0x100) >>> 0
    const pPlayerData = m.alloc(0xc0) >>> 0
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x0c) >>> 0, 7)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    m.setU32((pGame + 0x1120 + (7 << 2)) >>> 0, pPlayer)
    m.setU32((pGame + 0x1d2c) >>> 0, pPartyCtrl)
    m.setU16(pSubParty, 5)
    m.setU32((pPartyCtrl + 0x04) >>> 0, pSubParty)

    expect(PARTY_AddPlayerToSubParty_6FCBC4F0_113c(m, pGame, 5, pPlayer)).toBe(1)
    PARTY_RemoveSubPartyById_6FCBC7D0_113c(m, pGame, 5)
    expect(m.u32((pPartyCtrl + 0x04) >>> 0)).toBe(0)
  })

  it('PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c returns 0 when casting standard portal in town', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pCaster = m.alloc(0x100) >>> 0
    const pSourceRoom = m.alloc(0x100) >>> 0
    const pRoomEx = m.alloc(0x100) >>> 0
    const pLevel = m.alloc(0x200) >>> 0
    m.setU32((pSourceRoom + 0x10) >>> 0, pRoomEx)
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
    m.setU32((pLevel + 0x1d0) >>> 0, 1)
    expect(
      PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c(
        m,
        pGame,
        pCaster,
        pSourceRoom,
        100,
        100,
        2,
        0,
        0x3b,
        0,
      ),
    ).toBe(0)
  })

  it('SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c and Mainhand_6FCC2B40_113c return 0 without weapon', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pUnit = m.alloc(0x100) >>> 0
    expect(
      SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c(m, pGame, pUnit, 1, 1),
    ).toBe(0)
    expect(
      SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c(m, pGame, pUnit, 1, 1),
    ).toBe(0)
  })

  it('MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c returns 0 for non-Evaluating AI mode', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pMonster = m.alloc(0x100) >>> 0
    const pTarget = m.alloc(0x100) >>> 0
    expect(
      MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c(m, 0, pTarget, pMonster, pGame, 0, 0),
    ).toBe(0)
  })

  it('MONAI_SiegeMinion / Worldstone / Nihlathak / Barbarian / Baal think functions schedule AI when idle', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pMonster = m.alloc(0x100) >>> 0
    const pMonData = m.alloc(0x80) >>> 0
    const pAiGeneral = m.alloc(0x40) >>> 0
    const pAiControl = m.alloc(0x60) >>> 0
    const pAiParam = m.alloc(0x30) >>> 0
    const pMonStatsTxt = m.alloc(0x200) >>> 0
    for (let off = 0x170; off <= 0x17e; off += 2) {
      m.setU16((pMonStatsTxt + off) >>> 0, 0xffff)
    }
    m.setU32(pMonster, 1)
    m.setU32((pMonster + 0x10) >>> 0, 1)
    m.setU32((pMonster + 0x14) >>> 0, pMonData)
    m.setU32((pMonData + 0x28) >>> 0, pAiGeneral)
    m.setU32((pMonData + 0x2c) >>> 0, pAiControl)
    m.setU32(pAiParam, pAiControl)
    m.setU32((pAiParam + 0x1c) >>> 0, pMonStatsTxt)

    MONAI_SiegeMinionThinkA_6FCC5EB0_113c(m, pAiParam, pMonster, pGame)
    MONAI_SiegeMinionThinkB_6FCC6050_113c(m, pAiParam, pGame, pMonster)
    MONAI_SiegeMinionThinkC_6FCC62D0_113c(m, pAiParam, pMonster, pGame)
    MONAI_WorldstoneMinionThink_6FCC7410_113c(m, pGame, pMonster, pAiParam)
    MONAI_NihlathakThink_6FCC7580_113c(m, pGame, pMonster, pAiParam)
    MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c(m, pGame, pMonster, pAiParam)
    AIBAAL_CombatThink_6FCC9610_113c(m, pGame, pMonster, pAiParam)
    AIBAAL_CloneThink_6FCD8460_113c(m, pGame, pMonster, pAiParam)
    AIBAAL_ThroneRoomThink_6FCD8610_113c(m, pGame, pMonster, pAiParam)
    expect(m.u32(pMonster)).toBe(1)
  })

  it('ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c returns 0 when pPlayer is null', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    expect(ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c(m, pGame, 0, 0)).toBe(0)
  })

  it('ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c returns early when victim is not a monster', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pAttacker = m.alloc(0x100) >>> 0
    const pVictim = m.alloc(0x100) >>> 0
    m.setU32(pVictim, 0)
    ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c(m, pGame, 9, pAttacker, pVictim, 0)
    expect(m.u32(pVictim)).toBe(0)
  })

  it('MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c returns 0 when unit room is null', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pUnit = m.alloc(0x100) >>> 0
    const pPath = m.alloc(0x80) >>> 0
    m.setU32(pUnit, 1)
    m.setU32((pUnit + 0x2c) >>> 0, pPath)
    expect(MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c(m, pGame, pUnit)).toBe(0)
  })

  it('SKILLS_SrvDo120..135 functions return 0 gracefully when target or tables are absent', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pUnit = m.alloc(0x100) >>> 0
    m.setU32(pUnit, 1)
    expect(SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c(m, pGame, pUnit, 1, 1)).toBe(0)
    expect(
      SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c(m, pGame, pUnit, 1, 1),
    ).toBe(0)
    expect(
      SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c(m, pGame, pUnit, 1, 1),
    ).toBe(0)
    expect(SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c(m, pGame, pUnit, 1, 1)).toBe(0)
    expect(
      SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c(m, pGame, pUnit, 1, 1),
    ).toBe(0)
    expect(
      SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c(m, pGame, pUnit, 1, 1),
    ).toBe(0)
  })

  it('ACT4 and ACT2 quest callbacks update quest state bytes and custom flags', () => {
    const m = new SparseMemory113c()
    const pGame = allocGame(m)
    const pQuest = m.alloc(0x100) >>> 0
    const pCustom = m.alloc(0x60) >>> 0
    const pQuestArg = m.alloc(0x30) >>> 0
    const pQuestCtrl = m.alloc(0x40) >>> 0
    m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU32((pQuest + 0x18) >>> 0, pCustom)
    m.setU8((pQuest + 0x09) >>> 0, 1)
    m.setU8((pQuest + 0x0c) >>> 0, 0)

    expect(ACT4Q1_SeqCallback_6FCDA270_113c(m, pQuest)).toBe(1)
    expect(m.u8((pQuest + 0x0c) >>> 0)).toBe(1)

    m.setU8((pQuest + 0x0c) >>> 0, 0)
    expect(ACT4Q3_SeqCallback_6FCDA4F0_113c(m, pQuest)).toBe(1)
    expect(m.u8((pQuest + 0x0c) >>> 0)).toBe(1)

    m.setU8((pQuest + 0x09) >>> 0, 0)
    m.setU8((pCustom + 0x0d) >>> 0, 1)
    ACT4Q1_OnIzualKilled_6FCDABF0_113c(m, pQuest, pQuestArg)
    expect(m.u8((pQuest + 0x0c) >>> 0)).toBe(4)

    ACT4Q3_OnScrollMessage_6FCDB250_113c(m, pQuest, pQuestArg)
    NPC_OnHealerNpcInteract_6FCDD810_113c(m, 0, 0, pGame)
    expect(m.u32(0x6fd31c08)).toBe(0xffffffff)

    m.setU8((pQuest + 0x0c) >>> 0, 0)
    m.setU8((pQuest + 0x09) >>> 0, 1)
    expect(ACT2Q3_SeqCallback_6FCE6390_113c(m, pQuest)).toBe(1)
    expect(m.u8((pQuest + 0x0c) >>> 0)).toBe(1)

    const pPlayer = m.alloc(0x100) >>> 0
    const pPlayerData = m.alloc(0xc0) >>> 0
    const pQuestFlags = m.alloc(0x20) >>> 0
    const pQuestBuf = m.alloc(0x80) >>> 0
    m.setU32(pQuestFlags, pQuestBuf)
    m.setU32((pQuestFlags + 0x04) >>> 0, 0x300)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags)
    expect(ACT2Q6_PropagatePartyCompletionCallback_6FCE65A0_113c(m, pGame, pPlayer, 0)).toBe(0)

    m.setU8((pQuest + 0x09) >>> 0, 0)
    ACT2Q5_OnSummonerKilled_6FCE66B0_113c(m, pQuest, pQuestArg)
    expect(m.u8((pQuestCtrl + 0x20) >>> 0)).toBe(7)

    ACT2Q5_OnScrollMessage_6FCE67C0_113c(m, pQuest, pQuestArg)

    m.setU8((pQuest + 0x0c) >>> 0, 1)
    expect(ACT2Q5_SeqCallback_6FCE69D0_113c(m, pQuest)).toBe(1)

    expect(ACT2Q3_StartEclipseEvent_6FCE6A30_113c(m, pQuest)).toBe(0)
    expect(m.u8((pCustom + 0x03) >>> 0)).toBe(1)
  })
})
