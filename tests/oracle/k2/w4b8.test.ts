import { describe, expect, it } from 'vitest'
import { QUESTRECORD_AllocRecord113c } from '../../../src/d2kern-113c/common/quest-record.js'
import { D2GAME_IAT_SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/game/regpop-spawn-113c.js'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.js'
import {
  ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c,
  ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c,
  ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c,
  ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c,
  ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c,
  ACT4Q1_InitNpcDialog_6FCD9560_113c,
  ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c,
  ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c,
  ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c,
  ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c,
  ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c,
  ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c,
  ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c,
  ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c,
  ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c,
  ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c,
  ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c,
  ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c,
  ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c,
  ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c,
  ACT4Q3_InitNpcDialog_6FCD9070_113c,
  ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c,
  ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c,
  ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c,
  ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c,
  ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c,
  ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c,
  AIBAAL_ChooseActionWeighted_6FCD7380_113c,
  AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c,
  AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c,
  AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c,
  SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c,
  SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c,
  SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c,
  SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c,
  SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c,
  SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c,
  SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c,
  SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c,
  SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c,
  SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c,
  SKILLS_SrvDo141_SpawnPartyMinionsAndDistributeExp_6FCD65E0_113c,
  SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c,
  SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c,
  SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b8-113c.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'

function zeroRange(m: SparseMemory113c, base: number, size: number): void {
  for (let i = 0; i < size; i += 4) {
    m.setU32((base + i) >>> 0, 0)
  }
}

function allocZero(m: SparseMemory113c, size: number): number {
  const ptr = m.alloc(size)
  zeroRange(m, ptr, size)
  return ptr
}

function setupSgptDataTables(m: SparseMemory113c): number {
  const pPtrSlot = 0x1000
  const pDataTables = 0x2000
  const pSkillsTxt = 0x10000
  const pMissilesTxt = 0x20000
  zeroRange(m, 0x1000, 0x6000)
  zeroRange(m, 0x6fd1b5f0, 0x50)
  zeroRange(m, pSkillsTxt, 0x23c * 16)
  zeroRange(m, pSkillsTxt + 173 * 0x23c, 0x23c)
  zeroRange(m, pMissilesTxt, 0x1a4 * 10)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pPtrSlot)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(pPtrSlot, pDataTables)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 300)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 400)
  m.setU32(pDataTables + 0xbc0, 200)
  return pDataTables
}

describe('K2 Wave 4 Batch 8 (w4b8): 45 D2Game.dll functions (0x6FCD3770..0x6FCDB6A0)', () => {
  it('ports [1/45]..[5/45] skill functions (0x6FCD3770..0x6FCD4870)', () => {
    const m = new SparseMemory113c()
    setupSgptDataTables(m)

    // [1/45] 0x6FCD3770
    m.setU32(0x4000 + 0x2c, 0x5200)
    expect(SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c(m, 0x3000, 0x4000, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c(m, 0x3000, 0x4000, 1, 1)).toBe(0)

    // [2/45] 0x6FCD3890
    expect(SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c(m, 0x3000, 0x4000)).toBe(0)

    // [3/45] 0x6FCD3930
    expect(SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c(m, 0x3000, 0x4000)).toBe(0)

    // [4/45] 0x6FCD42D0
    expect(SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c(m, 0x3000, 0x4000, -1, 1)).toBe(0)

    // [5/45] 0x6FCD4870
    expect(SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c(m, 0x3000, 0x4000)).toBe(0)
    const pSkillInfo = 0x5000
    const pSkill = 0x5100
    const pSkillTxt173 = 0x10000 + 173 * 0x23c
    m.setU32(0x4000 + 0xa8, pSkillInfo)
    m.setU32(pSkillInfo, pSkill)
    m.setU32(pSkill, pSkillTxt173)
    m.setU16(pSkillTxt173, 173)
    m.setU32(pSkill + 0x28, 3)
    m.setU32(0x4000, 2)
    m.setU32(0x4000 + 0x2c, 0x5200)
    m.setU16(0x5200 + 0x02, 100)
    m.setU16(0x5200 + 0x06, 120)
    m.setU32(pSkill + 0x10, 105)
    m.setU32(pSkill + 0x14, 125)
    expect(SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c(m, 0x3000, 0x4000)).toBe(0)
  })

  it('ports [6/45]..[15/45] skill and Baal AI functions (0x6FCD4D30..0x6FCD7380)', () => {
    const m = new SparseMemory113c()
    setupSgptDataTables(m)

    // [6/45] 0x6FCD4D30
    expect(
      SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c(m, 0x3000, 0x4000, -1, 1),
    ).toBe(0)
    const pSkillTxt10 = 0x10000 + 10 * 0x23c
    m.setU16(pSkillTxt10 + 0x48, 0xffff)
    expect(
      SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c(m, 0x3000, 0x4000, 10, 1),
    ).toBe(0)

    // [7/45] 0x6FCD5110
    expect(
      SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c(m, 0x3000, 0x4000, -1, 1),
    ).toBe(0)

    // [8/45] 0x6FCD52A0
    expect(
      SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c(m, 0x3000, 0x4000, -1, 1),
    ).toBe(0)
    m.setU16(pSkillTxt10 + 0x48, 5)
    m.setU32(pSkillTxt10 + 0x138, 0xffffffff)
    m.setU32(pSkillTxt10 + 0x13c, 0xffffffff)
    expect(
      SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c(m, 0x3000, 0x4000, 10, 1),
    ).toBe(1)
    expect(m.u32(0x4000 + 0xc4) & 0x40).toBe(0x40)

    // [9/45] 0x6FCD5450
    expect(SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c(m, 0x3000, 0x4000, -1, 1)).toBe(
      0,
    )

    // [10/45] 0x6FCD5D40
    expect(SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c(m, 0x3000, 0x4000, -1, 1)).toBe(
      0,
    )

    // [11/45] 0x6FCD5E50
    expect(SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c(m, 0x3000, 0x4000, -1, 1)).toBe(0)

    // [12/45] 0x6FCD5FB0
    expect(
      SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c(m, 0x3000, 0x4000, -1, 1),
    ).toBe(0)

    // [13/45] 0x6FCD65E0
    expect(
      SKILLS_SrvDo141_SpawnPartyMinionsAndDistributeExp_6FCD65E0_113c(m, 0x3000, 0x4000, -1, 1),
    ).toBe(0)

    // [14/45] 0x6FCD6720
    m.setU32(0x3000 + 0xa8, 50)
    EVENT_InitTimerQueue113c(m, 0x3000)
    expect(SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c(m, 0x3000, 0)).toBe(1)
    expect(SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c(m, 0x3000, 0x4000)).toBe(1)

    // [15/45] 0x6FCD7380
    const pBaal = allocZero(m, 0x100)
    const pTarget = allocZero(m, 0x100)
    const pTargetSkills = allocZero(m, 0x20)
    const pAiState = allocZero(m, 0x40)
    m.setU32(pBaal, 1)
    m.setU32(pBaal + 0x20, 12345)
    m.setU32(pBaal + 0x24, 67890)
    m.setU32(pTarget + 0xa8, pTargetSkills)
    const actionIdx = AIBAAL_ChooseActionWeighted_6FCD7380_113c(
      m,
      pBaal,
      0x3000,
      pAiState,
      pTarget,
      1,
      0,
      1,
      0,
      70,
    )
    expect(actionIdx).toBeGreaterThanOrEqual(0)
    expect(actionIdx).toBeLessThan(16)
  })

  it('ports [16/45]..[30/45] Baal AI and Act 4 quest functions (0x6FCD75D0..0x6FCD93B0)', () => {
    const m = new SparseMemory113c()
    setupSgptDataTables(m)

    const pGame = allocZero(m, 0x1200)
    const pBaal = allocZero(m, 0x100)
    const pBaalSkills = allocZero(m, 0x20)
    const pTarget = allocZero(m, 0x100)
    const pTargetSkills = allocZero(m, 0x20)
    m.setU32(pBaal, 1)
    m.setU32(pBaal + 0x20, 111)
    m.setU32(pBaal + 0x24, 222)
    m.setU32(pBaal + 0xa8, pBaalSkills)
    m.setU32(pTarget + 0xa8, pTargetSkills)

    // [16/45] 0x6FCD75D0
    const midIdx = AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c(
      m,
      pTarget,
      pGame,
      pBaal,
      1,
      0,
      1,
    )
    expect(midIdx).toBeGreaterThanOrEqual(0)
    expect(midIdx).toBeLessThan(16)

    // [17/45] 0x6FCD7750
    const closeIdx = AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c(
      m,
      pBaal,
      pGame,
      pTarget,
      1,
    )
    expect(closeIdx).toBeGreaterThanOrEqual(0)
    expect(closeIdx).toBeLessThan(16)

    // [18/45] 0x6FCD78A0
    const pAiParamPtr = allocZero(m, 8)
    const pAiParam = allocZero(m, 8)
    m.setU32(pAiParamPtr, pAiParam)
    AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c(m, pGame, 0, pAiParamPtr)

    // [19/45] 0x6FCD8970
    const pQuestData = allocZero(m, 0x100)
    const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU8(pQuestData + 0x0c, 1)
    expect(ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c(m, pQuestData, 0x16f, 0, pQuestFlags)).toBe(1)
    expect(ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c(m, pQuestData, 999, 0, pQuestFlags)).toBe(0)

    // [20/45] 0x6FCD8A70
    m.setU8(pQuestData + 0x09, 1)
    m.setU8(pQuestData + 0x0c, 1)
    expect(ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c(m, pQuestData)).toBe(1)

    // [21/45] 0x6FCD8AE0
    expect(
      ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c(m, pQuestData, 0x16f, 0, pQuestFlags),
    ).toBe(1)
    expect(
      ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c(m, pQuestData, 0x196, 0, pQuestFlags),
    ).toBe(1)

    // [22/45] 0x6FCD8B90
    const pPlayer = allocZero(m, 0x100)
    const pPlayerData = allocZero(m, 0x100)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    expect(ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c(m, pQuestData, 0x198, pPlayer)).toBe(1)
    expect(ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c(m, pQuestData, 0x16f, pPlayer)).toBe(0)

    // [23/45] 0x6FCD8C00
    const pNpcParams = allocZero(m, 0x40)
    const pNpcUnit = allocZero(m, 0x100)
    m.setU32(pNpcParams, pGame)
    m.setU32(pNpcParams + 0x08, pNpcUnit)
    m.setU32(pNpcParams + 0x0c, pPlayer)
    m.setU32(pNpcUnit + 0x04, 0x100)
    ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c(m, pQuestData, pNpcParams)

    // [24/45] 0x6FCD8CE0
    m.setU8(pQuestData + 0x0c, 0)
    ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c(m, pQuestData, pNpcParams)

    // [25/45] 0x6FCD8E80
    expect(ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c(m, pGame, pPlayer)).toBe(0)

    // [26/45] 0x6FCD8F20
    m.setU32(pQuestData + 0xe0, 0x1a)
    ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c(m, pQuestData, pNpcParams)

    // [27/45] 0x6FCD9070
    m.setU8(pQuestData + 0x09, 0)
    ACT4Q3_InitNpcDialog_6FCD9070_113c(m, pQuestData, pNpcParams)

    // [28/45] 0x6FCD9290
    expect(ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c(m, pGame, pPlayer)).toBe(0)

    // [29/45] 0x6FCD9320
    m.setU32(pQuestData + 0xe0, 0x19)
    ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c(m, pQuestData, pNpcParams)

    // [30/45] 0x6FCD93B0
    const pQuestChain = allocZero(m, 0x20)
    const pQuestNode22 = allocZero(m, 0x100)
    const pCustom22 = allocZero(m, 0x40)
    m.setU32(pGame + 0x10f4, pQuestChain)
    m.setU32(pQuestChain, pQuestNode22)
    m.setU32(pQuestNode22, 0x16)
    m.setU32(pQuestNode22 + 0x18, pCustom22)
    m.setU32(pCustom22 + 0x14, pNpcUnit)
    expect(ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c(m, pGame, pPlayer)).toBe(0)
  })

  it('ports [31/45]..[45/45] Act 4 quest and Hellforge functions (0x6FCD94F0..0x6FCDB6A0)', () => {
    const m = new SparseMemory113c()
    setupSgptDataTables(m)

    const pGame = allocZero(m, 0x1200)
    const pPlayer = allocZero(m, 0x100)
    const pPlayerData = allocZero(m, 0x100)
    const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
    const pQuestFlagsBuf = m.u32(pQuestFlags)
    const pClient = allocZero(m, 0x40)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pPlayerData + 0x9c, pClient)

    const pQuestData = allocZero(m, 0x100)
    const pCustom = allocZero(m, 0x80)
    const pNpcParams = allocZero(m, 0x40)
    const pNpcUnit = allocZero(m, 0x100)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pCustom)
    m.setU32(pQuestData + 0xe0, 0x19)
    m.setU32(pNpcParams, pGame)
    m.setU32(pNpcParams + 0x08, pNpcUnit)
    m.setU32(pNpcParams + 0x0c, pPlayer)

    // [31/45] 0x6FCD94F0
    ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c(m, pGame, pPlayer)

    // [32/45] 0x6FCD9560
    ACT4Q1_InitNpcDialog_6FCD9560_113c(m, pQuestData, pNpcParams)

    // [33/45] 0x6FCD96A0
    expect(ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c(m, pGame, pPlayer)).toBe(0)

    // [34/45] 0x6FCD9730
    ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c(m, pQuestData, pNpcParams)

    // [35/45] 0x6FCD9830
    ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c(m, pQuestData, pNpcParams)
    expect(m.u8(pQuestData + 0x0c)).toBe(1)

    // [36/45] 0x6FCD9970
    m.setU16(pQuestFlagsBuf + 0x1b * 2, 1)
    expect(ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c(m, pGame, pPlayer)).toBe(0)

    // [37/45] 0x6FCD99D0
    m.setU16(pQuestFlagsBuf + 0x1a * 2, 1)
    expect(ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c(m, pGame, pPlayer)).toBe(0)

    // [38/45] 0x6FCD9A30
    ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c(m, pQuestFlags, pPlayer, pGame)
    expect((m.u16(pClient + 0x0a) >>> 8) & 0x1f).toBe(4)

    // [39/45] 0x6FCD9B00
    m.setU16(pQuestFlagsBuf + 0x1a * 2, 0)
    expect(ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c(m, pGame, pPlayer)).toBe(0)

    // [40/45] 0x6FCD9C00
    expect(ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c(m, pGame, 0)).toBe(0)

    // [41/45] 0x6FCD9D20
    m.setU16(pQuestFlagsBuf + 0x19 * 2, 1)
    expect(ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c(m, pGame, pPlayer)).toBe(0)

    // [42/45] 0x6FCDA810
    m.setU8(pQuestData + 0x09, 0)
    ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c(m, pQuestData, pNpcParams)

    // [43/45] 0x6FCDA850
    expect(ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c(m, 0, 100, pGame, 100, pCustom)).toBe(0)

    // [44/45] 0x6FCDAFF0
    expect(ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c(m, pNpcParams, pCustom)).toBe(0)

    // [45/45] 0x6FCDB6A0
    m.setU8(pCustom + 0x03, 0)
    ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c(m, pNpcUnit, pQuestData)
  })
})
