import { describe, expect, it } from 'vitest'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel'
import {
  AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c,
  AI_Thinker_MeleeRangedApproachStall_6FC38A90_113c,
  AI_Thinker_PutridDefiler_6FC38730_113c,
  CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c,
  CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c,
  MISSILES_RedeemCorpseWithSkill124_6FC59910_113c,
  MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c,
  MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c,
  MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c,
  MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c,
  MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c,
  MISSILES_SrvHit_SpawnScaledBurstSubMissiles_6FC5C5B0_113c,
  MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c,
  PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c,
  PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c,
  PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c,
  SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c,
  SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c,
  SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c,
  SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c,
  SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c,
  SKILLS_MorphMonsterAndApplyState142_6FC2D850_113c,
  SKILLS_SpawnChargedBoltFanMissiles_6FC2D5D0_113c,
  SKILLS_SrvDo001_JumpOrLeapMissile_6FC2C400_113c,
  SKILLS_SrvDo004_NihlathakCorpseExplosion_6FC2CA20_113c,
  SKILLS_SrvDo005_PerpendicularLineMissiles_6FC2D370_113c,
  SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c,
  SKILLS_SrvDo009_CorpseConsumeAuraBuff_6FC2DD50_113c,
  SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c,
  SKILLS_SrvDo018_FindPotion_6FC47600_113c,
  SKILLS_SrvDo021_MeleeHitWithTimedAuraState_6FC489A0_113c,
  SKILLS_SrvDo031_ChargedBoltProjectiles_6FC63B60_113c,
  SKILLS_SrvDo035_MeleeSkillHitWithWeaponFill_6FC64ED0_113c,
  SKILLS_SrvDo036_MeleeHitWithPhysScaleAndLeech_6FC65000_113c,
  SKILLS_SrvDo054_MeleeHitZeroBonus_6FC6C720_113c,
  SKILLS_SrvDo055_MeleeHitWithMonsterElemStatsAndEvents_6FC6CB00_113c,
  SKILLS_SrvDo058_SpawnWeaponClassProjectileWithDmgPct_6FC6D270_113c,
  SKILLS_SrvDo064_NonTownMeleeHitWithElemConversion_6FC6F7D0_113c,
  SKILLS_SrvSt03_WhirlwindStart_6FC47F30_113c,
  SKILLS_SrvSt06_ChargeStart_6FC48600_113c,
  SKILLS_SrvSt30_MultiHitMeleeStart_6FC6C4F0_113c,
  SKILLS_SrvSt31_CappedMultiHitMeleeStart_6FC6C600_113c,
  SKILLS_SrvSt32_EnsureWeaponOrQuiverOrStartCast_6FC6C840_113c,
  STATES_OnTransformStateRemoved_6FC64A60_113c,
  STORM_TSHashTableGrowAndRehash_6FC222D0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'

function setupTables(m: SparseMemory113c): {
  pDataTables: number
  pSkillsBase: number
  pMissilesBase: number
} {
  const pDataTablesPtr = 0x100000
  const pDataTables = 0x100100
  const pSkillsBase = 0x110000
  const pMissilesBase = 0x160000
  const pStatesBase = 0x170000
  const pBitMasks = 0x180000
  m.fill(pDataTables, 0xd00, 0)
  m.fill(pSkillsBase, 300 * 0x23c, 0)
  m.fill(pMissilesBase, 20 * 0x1a4, 0)
  m.fill(pStatesBase, 200 * 0x3c, 0)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pDataTablesPtr)
  m.setU32(pDataTablesPtr, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(pDataTables + 0xb98, pSkillsBase)
  m.setU32(pDataTables + 0xba0, 300)
  m.setU32(pDataTables + 0xb64, pMissilesBase)
  m.setU32(pDataTables + 0xb6c, 20)
  m.setU32(pDataTables + 0xbc, pStatesBase)
  m.setU32(pDataTables + 0xc4, 200)
  m.setU32(pDataTables + 0xbc0, 200)
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pBitMasks)
  for (let i = 0; i < 32; i++) {
    m.setU32(pBitMasks + i * 4, (1 << i) >>> 0)
  }
  return { pDataTables, pSkillsBase, pMissilesBase }
}

describe('K2 Wave 5 Batch 1 (w5b1: 45 D2Game.dll 1.13c functions)', () => {
  it('[1/45..5/45] tests TSHashTable grow and skills 0x6FC2C400..0x6FC2D5D0', () => {
    const m = new SparseMemory113c()
    setupTables(m)

    const pHash = 0x200000
    const pBuckets = 0x201000
    m.fill(pHash, 0x40, 0)
    m.fill(pBuckets, 0x80, 0)
    m.setU32(pHash + 0x1c, pBuckets)
    m.setU32(pHash + 0x20, 2)
    m.setU32(pHash + 0x24, 1)
    for (let i = 0; i < 2; i++) {
      const b = pBuckets + i * 12
      m.setU32(b, 4)
      m.setU32(b + 4, b + 4)
      m.setU32(b + 8, ~(b + 4) >>> 0)
    }
    STORM_TSHashTableGrowAndRehash_6FC222D0_113c(m, pHash)
    expect(m.u32(pHash + 0x24)).toBe(3)

    const pGame = 0x220000
    const pUnit = 0x210000
    const pPath = 0x210200
    m.fill(pGame, 0x1800, 0)
    EVENT_InitTimerQueue113c(m, pGame)
    m.fill(pUnit, 0x100, 0)
    m.fill(pPath, 0x80, 0)
    m.setU32(pUnit, 1)
    m.setU32(pUnit + 0x2c, pPath)
    m.setU16(pPath + 0x02, 50)
    m.setU16(pPath + 0x06, 60)

    expect(SKILLS_SrvDo001_JumpOrLeapMissile_6FC2C400_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo004_NihlathakCorpseExplosion_6FC2CA20_113c(m, pGame, pUnit, 1, 1)).toBe(1)
    expect(SKILLS_SrvDo005_PerpendicularLineMissiles_6FC2D370_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_SpawnChargedBoltFanMissiles_6FC2D5D0_113c(m, pUnit, pGame, 1, 0, 1, 1)).toBe(0)
  })

  it('[6/45..10/45] tests charged missile, morph monster, corpse aura, and AI thinkers', () => {
    const m = new SparseMemory113c()
    const { pSkillsBase } = setupTables(m)

    const pGame = 0x220000
    const pUnit = 0x230000
    const pPath = 0x230200
    const pArgs = 0x231000
    const pMonStats = 0x232000
    m.fill(pGame, 0x1800, 0)
    EVENT_InitTimerQueue113c(m, pGame)
    m.fill(pUnit, 0x100, 0)
    m.fill(pPath, 0x80, 0)
    m.fill(pArgs, 0x40, 0)
    m.fill(pMonStats, 0x200, 0)
    m.setU32(pUnit, 1)
    m.setU32(pUnit + 0x2c, pPath)

    expect(SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    SKILLS_MorphMonsterAndApplyState142_6FC2D850_113c(m, -1, pUnit, pGame, 1, 0)

    const skillId = 5
    const pSkillTxt = pSkillsBase + skillId * 0x23c
    m.setU16(pSkillTxt + 0x80, 10)
    expect(SKILLS_SrvDo009_CorpseConsumeAuraBuff_6FC2DD50_113c(m, pGame, pUnit, skillId, 1)).toBe(0)

    m.setU32(pArgs + 0x18, 1)
    m.setU32(pArgs + 0x1c, pMonStats)
    m.setU16(pMonStats + 0x170, 0xffff)
    AI_Thinker_PutridDefiler_6FC38730_113c(m, pGame, pUnit, pArgs)
    AI_Thinker_MeleeRangedApproachStall_6FC38A90_113c(m, pGame, pUnit, pArgs)
    expect((m.u32(pUnit + 0xc4) & 0x0e) !== 0).toBe(true)
  })

  it('[11/45..15/45] tests quest NPC cmd 3 and melee skills 0x6FC473C0..0x6FC47A10', () => {
    const m = new SparseMemory113c()
    const { pSkillsBase } = setupTables(m)

    const pGame = 0x240000
    const pUnit = 0x241000
    const pPath = 0x241200
    m.fill(pGame, 0x1800, 0)
    EVENT_InitTimerQueue113c(m, pGame)
    m.fill(pUnit, 0x100, 0)
    m.fill(pPath, 0x80, 0)
    m.setU32(pUnit, 1)
    m.setU32(pUnit + 0x2c, pPath)

    expect(AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c(m, 0, pGame)).toBe(0)
    expect(SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo018_FindPotion_6FC47600_113c(m, pGame, pUnit, -1, 1)).toBe(0)

    const skillId = 10
    const pSkillTxt = pSkillsBase + skillId * 0x23c
    m.setU16(pSkillTxt + 0x12e, 1)
    expect(SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c(m, pUnit, pGame, skillId, 1)).toBe(
      0,
    )
    expect(
      SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c(m, skillId, pUnit, pGame, 0, 1),
    ).toBe(0)
  })

  it('[16/45..25/45] tests Whirlwind, Charge, Maul, client sync, player death, and missile retarget', () => {
    const m = new SparseMemory113c()
    const { pMissilesBase } = setupTables(m)

    const pClient = 0x250000
    const pGame = 0x251000
    const pArenaCtrl = 0x253800
    const pPlayer = 0x254000
    const pInv = 0x254200
    const pPath = 0x254400
    const pPlayerData = 0x254600
    const pSkills = 0x254900
    const pAttacker = 0x255000
    const pMissile = 0x256000
    m.fill(pClient, 0x500, 0)
    m.fill(pGame, 0x2000, 0)
    m.fill(pArenaCtrl, 0x40, 0)
    m.setU32(pGame + 0x1d28, pArenaCtrl)
    m.fill(pPlayer, 0x100, 0)
    m.fill(pInv, 0x80, 0)
    m.fill(pPath, 0x80, 0)
    m.fill(pPlayerData, 0x200, 0)
    m.fill(pSkills, 0x40, 0)
    m.fill(pAttacker, 0x100, 0)
    m.fill(pMissile, 0x100, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x2c, pPath)
    m.setU32(pPlayer + 0x60, pInv)
    m.setU32(pPlayer + 0xa8, pSkills)
    m.setU32(pInv, 0x1020304)

    expect(SKILLS_SrvSt03_WhirlwindStart_6FC47F30_113c(m, pGame, pPlayer, 1, 1)).toBe(0)
    expect(SKILLS_SrvSt06_ChargeStart_6FC48600_113c(m, pGame, pPlayer, 1, 1)).toBe(0)
    expect(SKILLS_SrvDo021_MeleeHitWithTimedAuraState_6FC489A0_113c(m, pGame, pPlayer, -1, 1)).toBe(
      0,
    )

    CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c(m, pClient, pGame)
    expect(m.u32(pClient + 0x04)).toBe(1)

    CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c(m, 0)

    PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c(m, pClient, pPlayer)

    m.setU32(pAttacker, 0)
    PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c(m, pPlayer, pGame, pAttacker)

    m.setU8(pPlayer + 0x6c, 1)
    m.setU32(pPlayer + 0x64, 99)
    m.setU32(pPlayer + 0x68, 1)
    expect(PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(m, pPlayer, pGame, 0)).toBe(
      0,
    )
    expect(m.u8(pPlayer + 0x6c)).toBe(0)

    expect(MISSILES_RedeemCorpseWithSkill124_6FC59910_113c(m, pGame, pPlayer, 0, 1)).toBe(0)

    const pMisPath = 0x256200
    m.fill(pMisPath, 0x80, 0)
    m.setU32(pMissile, 3)
    m.setU32(pMissile + 0x04, 1)
    m.setU32(pMissile + 0x2c, pMisPath)
    m.setU32(pMissilesBase + 0x1a4 + 0x3c, 10)
    expect(MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c(m, pMissile, pGame)).toBe(1)
  })

  it('[26/45..35/45] tests missile hit bursts, chain bounce, attract, taunt, stash fountain, and transform state', () => {
    const m = new SparseMemory113c()
    const { pSkillsBase, pMissilesBase } = setupTables(m)

    const pGame = 0x260000
    const pMissile = 0x262000
    const pMisPath = 0x262200
    const pMisData = 0x262400
    const pAttacker = 0x263000
    const pAttPath = 0x263200
    const pDefender = 0x264000
    const pDefPath = 0x264200
    m.fill(pGame, 0x1800, 0)
    m.fill(pMissile, 0x100, 0)
    m.fill(pMisPath, 0x80, 0)
    m.fill(pMisData, 0x80, 0)
    m.fill(pAttacker, 0x100, 0)
    m.fill(pAttPath, 0x80, 0)
    m.fill(pDefender, 0x100, 0)
    m.fill(pDefPath, 0x80, 0)

    m.setU32(pMissile, 3)
    m.setU32(pMissile + 0x04, 2)
    m.setU32(pMissile + 0x14, pMisData)
    m.setU32(pMissile + 0x2c, pMisPath)
    m.setU16(pMissilesBase + 2 * 0x1a4 + 0x24, (-1) & 0xffff)
    expect(MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILES_SrvHit_SpawnScaledBurstSubMissiles_6FC5C5B0_113c(m, pGame, pMissile, 0)).toBe(
      1,
    )
    expect(MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c(m, pGame, pMissile, 0)).toBe(3)
    expect(MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c(m, pGame, pMissile, 0)).toBe(1)

    expect(MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c(m, pGame, 0)).toBe(2)

    m.setU32(pAttacker, 0)
    m.setU32(pAttacker + 0x2c, pAttPath)
    m.setU32(pDefender, 1)
    m.setU32(pDefender + 0x2c, pDefPath)
    expect(SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c(m, pGame, pAttacker)).toBe(0)

    m.setU16(pSkillsBase + 3 * 0x23c + 0x110, (-1) & 0xffff)
    expect(
      SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c(
        m,
        pGame,
        pAttacker,
        pDefender,
        0,
        3,
        1,
      ),
    ).toBe(1)

    expect(SKILLS_SrvDo031_ChargedBoltProjectiles_6FC63B60_113c(m, pGame, pAttacker, -1, 1)).toBe(
      0,
    )
    STATES_OnTransformStateRemoved_6FC64A60_113c(m, pAttacker, 10, 0)
  })

  it('[36/45..45/45] tests melee and projectile skill handlers 0x6FC64ED0..0x6FC6F7D0', () => {
    const m = new SparseMemory113c()
    const { pSkillsBase } = setupTables(m)

    const pGame = 0x270000
    const pUnit = 0x272000
    const pUnitPath = 0x272200
    const pUnitSkills = 0x272400
    const pTarget = 0x273000
    const pTargetPath = 0x273200
    m.fill(pGame, 0x1800, 0)
    EVENT_InitTimerQueue113c(m, pGame)
    m.fill(pUnit, 0x100, 0)
    m.fill(pUnitPath, 0x80, 0)
    m.fill(pUnitSkills, 0x40, 0)
    m.fill(pTarget, 0x100, 0)
    m.fill(pTargetPath, 0x80, 0)

    m.setU32(pUnit, 0)
    m.setU32(pUnit + 0x2c, pUnitPath)
    m.setU32(pUnit + 0xa8, pUnitSkills)
    m.setU32(pTarget, 1)
    m.setU32(pTarget + 0x2c, pTargetPath)
    expect(SKILLS_SrvDo035_MeleeSkillHitWithWeaponFill_6FC64ED0_113c(m, pGame, pUnit, 4, 1)).toBe(
      0,
    )
    expect(
      SKILLS_SrvDo036_MeleeHitWithPhysScaleAndLeech_6FC65000_113c(m, pGame, pUnit, 4, 1),
    ).toBe(0)

    const pSkillTxt = pSkillsBase + 4 * 0x23c
    m.setU16(pSkillTxt + 0x12e, 1)
    SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c(
      m,
      4,
      pUnit,
      pTarget,
      pGame,
      5,
      pSkillTxt,
      1,
    )

    expect(SKILLS_SrvSt30_MultiHitMeleeStart_6FC6C4F0_113c(m, pGame, pUnit, 4, 1)).toBe(0)
    expect(SKILLS_SrvSt31_CappedMultiHitMeleeStart_6FC6C600_113c(m, pGame, pUnit, 4, 1)).toBe(0)
    expect(SKILLS_SrvDo054_MeleeHitZeroBonus_6FC6C720_113c(m, pGame, pUnit, 4, 1)).toBe(0)
    expect(
      SKILLS_SrvSt32_EnsureWeaponOrQuiverOrStartCast_6FC6C840_113c(m, pGame, pTarget, 4, 1),
    ).toBe(1)
    expect(
      SKILLS_SrvDo055_MeleeHitWithMonsterElemStatsAndEvents_6FC6CB00_113c(m, pGame, pUnit, 4, 1),
    ).toBe(0)
    expect(
      SKILLS_SrvDo058_SpawnWeaponClassProjectileWithDmgPct_6FC6D270_113c(m, pGame, pUnit, -1, 1),
    ).toBe(0)
    expect(
      SKILLS_SrvDo064_NonTownMeleeHitWithElemConversion_6FC6F7D0_113c(m, pGame, pUnit, 4, 1),
    ).toBe(0)
  })
})
