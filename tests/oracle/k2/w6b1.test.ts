import { describe, expect, it } from 'vitest'
import {
  GDW_BITMASKS_IAT_VA_113C,
  SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/skills.ts'
import { STATLIST_CreateEx113c } from '../../../src/d2kern-113c/common/statlist.ts'
import * as w6b1Exports from '../../../src/d2kern-113c/game/k2-w6b1-113c.ts'
import {
  ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c,
  ACT1Q5_StatusFilter_6FC85500_113c,
  ACT5Q3_StatusFilter_6FC7B8C0_113c,
  AI_ThinkCurseCaster_6FC3AF80_113c,
  AI_ThinkSuccubus_6FC3A9F0_113c,
  MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c,
  MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c,
  MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c,
  MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c,
  MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c,
  MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c,
  MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c,
  MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c,
  MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c,
  MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c,
  MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c,
  MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c,
  MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c,
  MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c,
  MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c,
  MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c,
  MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c,
  NPCS_ClosePlayerTradeAndFreeGamble_6FC685C0_113c,
  OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c,
  QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c,
  SKILLS_ApplyAttractCurseCallback_6FC70B70_113c,
  SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c,
  SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c,
  SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c,
  SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c,
  SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c,
  SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c,
  SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c,
  SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c,
  SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c,
  SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c,
  SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c,
  SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c,
  SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c,
  SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c,
  SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c,
  SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c,
  SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c,
  SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c,
  STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c.ts'
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

  const pSkillsTxt = m.alloc(0x23c * 16)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 16)

  const pMissilesTxt = m.alloc(0x1a4 * 16)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 16)

  const pStatesTxt = m.alloc(0x40 * 32)
  for (let i = 0; i < 32; i++) {
    m.setU16(pStatesTxt + i * 0x40 + 0x02, 0xffff)
  }
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc0, pStatesTxt)
  m.setU32(pDataTables + 0xc4, 32)
  m.setU32(pDataTables + 0xbd4, 359)

  const pGame = m.alloc(0x1e00)
  m.setU32(pGame + 0xa8, 100)
  EVENT_InitTimerQueue113c(m, pGame)

  return { m, pDataTables, pSkillsTxt, pMissilesTxt, pGame }
}

describe('K2 Wave 6 Batch 1 (45 D2Game VAs 0x6FC221D0..0x6FC85500)', () => {
  it('exports all 45 functions', () => {
    const fnList = Object.values(w6b1Exports).filter((v) => typeof v === 'function')
    expect(fnList.length).toBe(45)
  })

  it('[1..5] STORM_TSHashTableCheckChainAndGrow, RadialPhysAndElemDamage, SpawnChargedBoltFanByCalc1, ApplyAuraOrMorphMinion, AI_ThinkSuccubus', () => {
    const { m, pGame, pSkillsTxt } = setupTestMem()

    const pHash = m.alloc(0x40)
    const pBuckets = m.alloc(0x40)
    m.setU32(pHash + 0x18, 4)
    m.setU32(pHash + 0x24, pBuckets)
    m.setU32(pHash + 0x28, 3)
    STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c(m, pHash, 1)
    expect(m.u32(pHash + 0x28)).toBe(3)

    expect(SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c(m, pGame, 0, -1, 1)).toBe(0)
    const pUnit = m.alloc(0x100)
    m.setU32(pUnit, 1)
    m.setU32(pUnit + 0x10, 1)
    m.setU32(pUnit + 0x2c, m.alloc(0x100))
    const pTarget = m.alloc(0x100)
    const pMonStatsTxt = m.alloc(0x200)
    m.setU16(pMonStatsTxt + 0x178, 0xffff)
    m.setU32(pSkillsTxt + 0x23c + 0x64, 0)
    expect(SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c(m, pGame, pUnit, 1, 1)).toBe(0)

    expect(SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    m.setU16(pSkillsTxt + 0x23c + 0x38, 0xffff)
    expect(SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c(m, pGame, pUnit, 1, 1)).toBe(0)

    expect(SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    m.setU16(pSkillsTxt + 0x23c + 0x80, 0xffff)
    expect(SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c(m, pGame, pUnit, 1, 1)).toBe(0)

    const pAiArg = m.alloc(0x40)
    m.setU32(pAiArg + 0x08, pTarget)
    m.setU32(pAiArg + 0x1c, pMonStatsTxt)
    AI_ThinkSuccubus_6FC3A9F0_113c(m, pGame, pUnit, pAiArg)
    expect(m.u32(pAiArg + 0x08)).toBe(pTarget)
  })

  it('[6..12] AI_ThinkCurseCaster, MONUMOD_OnHitApplyCursedAmplifyDamage, UnownedMonsterMode12, Fury, ProgressiveCharge, FalseTombSymbol, SpawnJerhyn', () => {
    const { m, pGame, pSkillsTxt } = setupTestMem()
    const pUnit = m.alloc(0x100)
    m.setU32(pUnit, 1)
    m.setU32(pUnit + 0x10, 1)
    m.setU32(pUnit + 0x2c, m.alloc(0x100))
    const pTarget = m.alloc(0x100)
    const pMonStatsTxt = m.alloc(0x200)
    m.setU16(pMonStatsTxt + 0x178, 0xffff)
    const pAiArg = m.alloc(0x40)
    m.setU32(pAiArg + 0x08, pTarget)
    m.setU32(pAiArg + 0x1c, pMonStatsTxt)
    AI_ThinkCurseCaster_6FC3AF80_113c(m, pGame, pUnit, pAiArg)
    expect(m.u32(pAiArg + 0x08)).toBe(pTarget)

    MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c(m, pGame, pUnit, 0, 0)
    expect(SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c(m, pGame, 0)).toBe(0)
    expect(SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    m.setU16(pSkillsTxt + 0x23c + 0x80, 10)
    expect(SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c(m, pGame, pUnit, 1, 0)).toBe(0)

    expect(() => OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c(m, pGame, 0, 0, 10, 10)).toThrow(
      'Objects.cpp:391: pRoom == 0',
    )

    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg, pGame)
    QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c(m, pQuestArg)
    expect(m.u32(pQuestArg)).toBe(pGame)
  })

  it('[13..23] Missile SrvHit handlers (0x6FC5AB30..0x6FC5E0B0)', () => {
    const { m, pGame } = setupTestMem()
    const pMissile = m.alloc(0x100)
    const pDynPath = m.alloc(0x100)
    m.setU32(pMissile, 3)
    m.setU32(pMissile + 0x04, 0xffffffff)
    m.setU32(pMissile + 0x2c, pDynPath)
    expect(MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c(m, pGame, 0, 0)).toBe(1)
    expect(MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c(m, pGame, 0, 0)).toBe(1)
    expect(MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c(m, pGame, 0, 0)).toBe(1)
    expect(MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c(m, pGame, 0, 0)).toBe(1)
    expect(MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c(m, pGame, 0, 0)).toBe(1)
    expect(MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c(m, pGame, 0, 0)).toBe(1)
    expect(MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c(m, pGame, 0, 0)).toBe(1)
    expect(MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c(m, pGame, 0, 0)).toBe(1)
    expect(MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c(m, pGame, 0, 0)).toBe(1)
    expect(MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c(m, pGame, 0, 0)).toBe(1)
  })

  it('[24..33] Missile SrvDo handlers and Skill projectile/aura functions (0x6FC5F550..0x6FC65850)', () => {
    const { m, pGame } = setupTestMem()
    expect(MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c(m, pGame, 0)).toBe(2)
    expect(MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c(m, pGame, 0)).toBe(2)
    expect(MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c(m, pGame, 0)).toBe(2)
    expect(MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c(m, pGame, 0)).toBe(2)
    expect(MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c(m, pGame, 0)).toBe(2)

    expect(
      SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c(m, 0, 0, pGame, 1, 1, 1),
    ).toBe(0)
    expect(SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c(m, pGame, 0, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c(m, pGame, 0, -1, 1)).toBe(0)
    expect(
      SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c(m, pGame, 0, -1, 1),
    ).toBe(0)
    expect(SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c(m, pGame, 0, -1, 1)).toBe(0)
  })

  it('[34..45] Timed skill state, charged melee release, NPC trade close, Strafe volley, corpse checks, curses, and Act1/Act5 quests (0x6FC66210..0x6FC85500)', () => {
    const { m, pGame, pSkillsTxt } = setupTestMem()
    const pUnit = m.alloc(0x100)
    m.setU32(pUnit, 4)
    m.setU32(pUnit + 0x0c, 7)
    m.setU32(pUnit + 0x2c, m.alloc(0x100))
    STATLIST_CreateEx113c(m, pUnit, 0, 0)

    m.setU16(pSkillsTxt + 0x23c + 0x80, 12)
    expect(SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c(m, pGame, pUnit, 1, 3)).toBe(1)
    expect((m.u32(pUnit + 0xc4) & 0x40) !== 0).toBe(true)
    m.setU32(pUnit, 0)

    expect(
      SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c(m, pGame, pUnit, -1, 1),
    ).toBe(0)

    const pNpcRecord = m.alloc(0x40)
    const pNode = m.alloc(0x10)
    m.setU32(pNode, pUnit)
    m.setU32(pNode + 0x04, 0)
    m.setU32(pNpcRecord, pNode)
    m.setU32(pUnit + 0x68, 1)
    m.setU8(pUnit + 0x6c, 1)
    NPCS_ClosePlayerTradeAndFreeGamble_6FC685C0_113c(m, pGame, pUnit, 0, pNpcRecord)
    expect(m.u32(pNpcRecord)).toBe(0)
    expect(m.u8(pUnit + 0x6c)).toBe(0)

    expect(SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c(m, 0)).toBe(0)
    expect(SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c(m, pGame, 0)).toBe(0)
    expect(SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c(m, 0, pUnit, pGame)).toBe(0)
    expect(SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c(m, 0, 0)).toBe(0)
    expect(SKILLS_ApplyAttractCurseCallback_6FC70B70_113c(m, 0, 0)).toBe(0)

    const pQuestData = m.alloc(0x100)
    const pPlayerFlags = m.alloc(0x40)
    m.setU32(pPlayerFlags, m.alloc(0x100))
    m.setU32(pPlayerFlags + 0x04, 0x200)
    const pOutByte = m.alloc(4)
    expect(ACT5Q3_StatusFilter_6FC7B8C0_113c(m, pQuestData, pUnit, 0, pPlayerFlags, pOutByte)).toBe(1)
    expect(m.u8(pOutByte)).toBe(0)

    const pCairnState = m.alloc(0x20)
    const pSeedHolder = m.alloc(0x30)
    m.setU32(pSeedHolder + 0x18, 0x12345678)
    m.setU32(pSeedHolder + 0x1c, 0x9abcdef0)
    m.setU32(pGame + 0x10f4, pSeedHolder)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pCairnState)
    ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c(m, pQuestData)
    const assigned = [
      m.u16(pCairnState),
      m.u16(pCairnState + 2),
      m.u16(pCairnState + 4),
      m.u16(pCairnState + 6),
      m.u16(pCairnState + 8),
    ]
    expect(assigned.includes(0x11)).toBe(true)
    expect(assigned.includes(0x15)).toBe(true)

    expect(ACT1Q5_StatusFilter_6FC85500_113c(m, pQuestData, pUnit, 0, pPlayerFlags, pOutByte)).toBe(1)
  })
})
