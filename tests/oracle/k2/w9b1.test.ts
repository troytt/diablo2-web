import { describe, expect, it } from 'vitest'
import {
  GDW_BITMASKS_IAT_VA_113C,
  SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/skills.ts'
import * as w9b1Exports from '../../../src/d2kern-113c/game/k2-w9b1-113c.ts'
import {
  ACT1Q1_InitQuestData_6FC85990_113c,
  ACT1Q4_OperateInifussTree_6FC85B40_113c,
  ACT1Q5_InitQuestData_6FC89200_113c,
  ACT1Q6_OnAndarielKilled_6FC87E00_113c,
  ACT4Q1_InitQuestData_6FCDAE40_113c,
  ACT5Q1_InitQuestData_6FC7BEA0_113c,
  ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c,
  ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c,
  ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c,
  AI_GreaterMummyThink_6FCA8380_113c,
  AI_SummonerThink_6FCA5780_113c,
  MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c,
  MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c,
  NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c,
  NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c,
  PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c,
  PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c,
  PETS_RecalcAndClampPlayerPetTypeForSkill_6FCBF600_113c,
  PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c,
  PLAYER_DestroyPlayerUnitResources_6FC587E0_113c,
  PLAYER_LootPlayerCorpseUnit_6FC99910_113c,
  PLAYERSAVE_SavePlayerCharacter_6FC74320_113c,
  QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c,
  QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c,
  SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c,
} from '../../../src/d2kern-113c/game/k2-w9b1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function setupTestMem() {
  const m = new SparseMemory113c()
  const holder = m.alloc(4)
  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  const pMasks = m.alloc(128)
  for (let i = 0; i < 32; i++) {
    m.setU32(pMasks + i * 4, (1 << i) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pMasks)
  m.setU32(GDW_BITMASKS_IAT_VA_113C, pMasks)
  m.setU32(0x6fd31c20, 0)

  m.setU32(holder, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, holder)
  m.setU32(SGPT_DATATABLES_VA_113C, pDataTables)
  const pItemsTxt = m.alloc(0x1a8 * 4)
  m.setU32(0x6fdefb94, 4)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(pDataTables + 0x1a8, 4)
  m.setU32(pDataTables + 0x1ac, pItemsTxt)
  m.setU32(pItemsTxt + 0x80, 0x20347068)
  m.setU32(pItemsTxt + 0x84, 0x20347068)

  const pSkillsTxt = m.alloc(0x23c * 16)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 16)

  const pMissilesTxt = m.alloc(0x1a4 * 16)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 16)

  const pPetTypeTxt = m.alloc(0xe0 * 8)
  m.setU32(pDataTables + 0xbe8, pPetTypeTxt)
  m.setU32(pDataTables + 0xbf0, 4)
  for (let i = 0; i < 4; i++) {
    m.setU16(pPetTypeTxt + i * 0xe0 + 0x0a, 2)
  }

  const pGame = m.alloc(0x1e00)
  m.setU32(pGame + 0xa8, 100)
  EVENT_InitTimerQueue113c(m, pGame)

  return { m, pDataTables, pSkillsTxt, pMissilesTxt, pPetTypeTxt, pGame }
}

describe('K2 Wave 9 Batch 1 (25 D2Game VAs 0x6FC56100..0x6FCDDE50)', () => {
  it('exports all 25 functions', () => {
    const fnList = Object.values(w9b1Exports).filter((v) => typeof v === 'function')
    expect(fnList.length).toBe(25)
  })

  it('[1..5] TaintedSunAltarInit, ObjectEvent07_DispatchByClassId, DestroyPlayerUnitResources, SpawnPortalOnGroundImpact, RadamentDeathPortalAndSubMissiles', () => {
    const { m, pGame } = setupTestMem()

    const pObjUnit = m.alloc(0x100)
    m.setU32(pObjUnit + 0x00, 2)
    m.setU32(pObjUnit + 0x10, 2)
    m.setU32(pObjUnit + 0x2c, m.alloc(0x40))
    const pInitArg = m.alloc(0x20)
    m.setU32(pInitArg + 0x00, pGame)
    m.setU32(pInitArg + 0x04, pObjUnit)
    m.setU32(pInitArg + 0x08, 0)
    QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c(m, pInitArg)
    expect(m.u32(pObjUnit + 0x10)).toBe(2)

    QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c(m, pGame, pObjUnit)

    const pPlayer1 = m.alloc(0x100)
    m.setU32(pPlayer1 + 0x00, 0)
    const pPlrData1 = m.alloc(0x100)
    const pBitBuf = m.alloc(0x40)
    for (const off of [0x1c, 0x20, 0x24, 0x60, 0x64, 0x68]) {
      m.setU32(pPlrData1 + off, pBitBuf)
    }
    m.setU32(pPlayer1 + 0x14, pPlrData1)
    PLAYER_DestroyPlayerUnitResources_6FC587E0_113c(m, pGame, pPlayer1)

    const pMissile = m.alloc(0x100)
    m.setU32(pMissile + 0x00, 3)
    expect(MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c(m, pGame, 0, 0)).toBe(0)

    expect(MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c(m, pGame, 0)).toBe(2)
  })

  it('[6..10] SavePlayerCharacter, ACT5Q4_Callback01_NpcDeactivate, ACT5Q1_InitQuestData, ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty, ACT5Q5_OperateAncientsAltar', () => {
    const { m, pGame } = setupTestMem()

    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer + 0x00, 0)
    const pPlrData = m.alloc(0x100)
    m.setU32(pPlayer + 0x14, pPlrData)
    expect(PLAYERSAVE_SavePlayerCharacter_6FC74320_113c(m, pGame, 0, 0, 1)).toBe(0)

    const pQuestData5Q4 = m.alloc(0x100)
    const pEx5Q4 = m.alloc(0x90)
    m.setU32(pQuestData5Q4 + 0x04, pGame)
    m.setU8(pQuestData5Q4 + 0x09, 1)
    m.setU32(pQuestData5Q4 + 0x18, pEx5Q4)
    const pArg5Q4 = m.alloc(0x20)
    m.setU16(pArg5Q4 + 0x14, 0x200)
    m.setU16(pArg5Q4 + 0x18, 0x4ea9)
    ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c(m, pQuestData5Q4, pArg5Q4)
    expect(m.u8(pEx5Q4 + 0x86)).toBe(1)
    expect(m.u8(pEx5Q4 + 0x87)).toBe(1)

    const pQuest5Q1 = m.alloc(0x100)
    m.setU32(pQuest5Q1 + 0x04, pGame)
    ACT5Q1_InitQuestData_6FC7BEA0_113c(m, pQuest5Q1)
    expect(m.u32(pQuest5Q1 + 0xe0)).toBe(0x23)
    expect(m.u32(pQuest5Q1 + 0x10)).toBe(0x20)
    expect(m.u32(pQuest5Q1 + 0x18)).not.toBe(0)

    const pQuest5Q5 = m.alloc(0x100)
    const pEx5Q5 = m.alloc(0x80)
    m.setU32(pQuest5Q5 + 0x04, pGame)
    m.setU32(pQuest5Q5 + 0x18, pEx5Q5)
    ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c(m, pQuest5Q5, pPlayer)

    const pOpArgs = m.alloc(0x20)
    m.setU32(pOpArgs + 0x00, pGame)
    m.setU32(pOpArgs + 0x04, 0)
    m.setU32(pOpArgs + 0x08, pPlayer)
    expect(ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c(m, pOpArgs)).toBe(0)
  })

  it('[11..15] ACT1Q1_InitQuestData, ACT1Q4_OperateInifussTree, ACT1Q6_OnAndarielKilled, ACT1Q5_InitQuestData, PLAYER_LootPlayerCorpseUnit', () => {
    const { m, pGame } = setupTestMem()

    const pQuest1Q1 = m.alloc(0x100)
    m.setU32(pQuest1Q1 + 0x04, pGame)
    ACT1Q1_InitQuestData_6FC85990_113c(m, pQuest1Q1)
    expect(m.u32(pQuest1Q1 + 0xe0)).toBe(1)
    expect(m.u32(pQuest1Q1 + 0x10)).toBe(2)

    const pQC = m.alloc(0x40)
    const pQuest4 = m.alloc(0x100)
    m.setU32(pQuest4 + 0x00, 4)
    m.setU8(pQuest4 + 0x09, 1)
    m.setU8(pQuest4 + 0x0c, 6)
    m.setU32(pQC + 0x00, pQuest4)
    m.setU32(pGame + 0x10f4, pQC)
    const pInifussObj = m.alloc(0x100)
    m.setU32(pInifussObj + 0x00, 2)
    m.setU32(pInifussObj + 0x10, 2)
    const pOpInifuss = m.alloc(0x20)
    m.setU32(pOpInifuss + 0x00, pGame)
    m.setU32(pOpInifuss + 0x04, pInifussObj)
    m.setU32(pOpInifuss + 0x08, 0)
    expect(ACT1Q4_OperateInifussTree_6FC85B40_113c(m, pOpInifuss)).toBe(0)

    const pQuest1Q6 = m.alloc(0x100)
    const pEx1Q6 = m.alloc(0x1a0)
    m.setU32(pQuest1Q6 + 0x04, pGame)
    m.setU32(pQuest1Q6 + 0x18, pEx1Q6)
    const pEvt1Q6 = m.alloc(0x20)
    m.setU32(pEvt1Q6 + 0x00, pGame)
    m.setU32(pEvt1Q6 + 0x04, 0)
    m.setU32(pEvt1Q6 + 0x08, 0)
    ACT1Q6_OnAndarielKilled_6FC87E00_113c(m, pQuest1Q6, pEvt1Q6)
    expect(m.u8(pEx1Q6 + 0x194)).toBe(1)
    expect(m.u8(pQuest1Q6 + 0x0c)).toBe(4)

    const pQuest1Q5 = m.alloc(0x100)
    m.setU32(pQuest1Q5 + 0x04, pGame)
    ACT1Q5_InitQuestData_6FC89200_113c(m, pQuest1Q5)
    expect(m.u32(pQuest1Q5 + 0xe0)).toBe(5)
    expect(m.u32(pQuest1Q5 + 0x10)).toBe(3)

    PLAYER_LootPlayerCorpseUnit_6FC99910_113c(m, pGame, 0, 0)
  })

  it('[16..20] AI_SummonerThink, AI_GreaterMummyThink, SKILLS_SrvDo_RadialAuraDamage, PETS_ClampAllPlayerPetTypesToDefaultMax, PETS_RecalcAndClampAllPlayerPetCountsFromSkills', () => {
    const { m, pGame } = setupTestMem()

    const pMonUnit = m.alloc(0x100)
    m.setU32(pMonUnit + 0x00, 1)
    const pTarget = m.alloc(0x100)
    m.setU32(pTarget + 0x00, 2)
    const pTargetPath = m.alloc(0x40)
    m.setU32(pTarget + 0x2c, pTargetPath)
    const pAiCtrl = m.alloc(0x40)
    const pMonStatsTxt = m.alloc(0x200)
    for (let off = 0x170; off <= 0x178; off += 2) {
      m.setU16(pMonStatsTxt + off, 0xffff)
    }
    const pAiArgs = m.alloc(0x30)
    m.setU32(pAiArgs + 0x00, pAiCtrl)
    m.setU32(pAiArgs + 0x08, pTarget)
    m.setU32(pAiArgs + 0x14, 10)
    m.setU32(pAiArgs + 0x18, 0)
    m.setU32(pAiArgs + 0x1c, pMonStatsTxt)

    AI_SummonerThink_6FCA5780_113c(m, pGame, pMonUnit, pAiArgs)
    expect(m.u32(pAiCtrl + 0x14)).toBe(1)

    AI_GreaterMummyThink_6FCA8380_113c(m, pGame, pMonUnit, pAiArgs)

    expect(SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c(m, pGame, pMonUnit, -1, 1)).toBe(0)

    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x14, m.alloc(0x80))
    PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c(m, pPlayer, pGame)
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(m, pGame, pPlayer)
  })

  it('[21..25] PETS_WarpOrUnsummonPlayerPets, PETS_RecalcAndClampPlayerPetTypeForSkill, ACT4Q1_InitQuestData, NPCS_HandleSoldOrGambledItemPlacement, NPCS_RepairAndRechargePlayerItemWrapper', () => {
    const { m, pGame } = setupTestMem()
    m.setU8(pGame + 0x6d, 1)

    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer + 0x00, 0)
    PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c(m, pGame, pPlayer, 100, 100)
    PETS_RecalcAndClampPlayerPetTypeForSkill_6FCBF600_113c(m, -1, pPlayer, pGame)

    const pQuest4Q1 = m.alloc(0x100)
    m.setU32(pQuest4Q1 + 0x04, pGame)
    ACT4Q1_InitQuestData_6FCDAE40_113c(m, pQuest4Q1)
    expect(m.u32(pQuest4Q1 + 0xe0)).toBe(0x19)
    expect(m.u32(pQuest4Q1 + 0x10)).toBe(0x18)
    expect(m.u32(pQuest4Q1 + 0x18)).not.toBe(0)

    const pArena = m.alloc(0x40)
    const pArenaTable = m.alloc(0x40 * 0x44)
    m.setU32(pGame + 0x1d24, pArena)
    m.setU32(pArena + 0x04, pArenaTable)
    m.setU32(pArenaTable + 0x00, 0x999)
    const pNpc = m.alloc(0x100)
    m.setU32(pNpc + 0x00, 1)
    m.setU32(pNpc + 0x04, 0x999)
    const pItem = m.alloc(0x100)
    m.setU32(pItem + 0x00, 4)
    const pItemData = m.alloc(0x80)
    m.setU32(pItem + 0x14, pItemData)
    m.setU32(pArenaTable + 0x10, 1)
    m.setU32(pArenaTable + 0x14, pItem)
    NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c(m, pItem, pGame, pNpc, pPlayer, 1)

    NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c(m, pGame, pPlayer, pItem)
  })
})
