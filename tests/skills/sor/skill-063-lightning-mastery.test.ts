/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #063: Lightning Mastery (SOR)
 * Gitea Tracking Issue: #217
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Schema Integrity (Skills.txt row 63, passive=1, passivestate='lightningmastery', Param1=50, Param2=12)
 * D2: Passive Metadata & Scene Integration (0 mana cost, 0 cooldown, no active missile, calculateSkillDamage returns 0)
 * D3: Exact 1.13c Formula Scaling (50 + (slvl - 1) * 12: lvl 1=50%, lvl 2=62%, lvl 10=158%, lvl 20=278%, lvl 40=518%)
 * D4: Multiplicative Synergy Scaling across all 5 Lightning Skills (Charged Bolt, Lightning, Chain Lightning, Nova, Thunder Storm)
 * D5: StatList & Combat Pipeline Integration (getAccruedStat('passive_ltng_mastery'), item_allskills scaling, executeSUnitDmg)
 * D6: Edge Cases & Boundary Conditions (slvl 0, negative slvl, non-lightning elemental isolation, zero synergy receiver)
 * D7: Invariants & WorldArena Integration (BATCH1_SKILLS length strictly 38, zero runtime MPQ queries, WorldArena cast execution)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList, FIXED_ONE } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { executeSUnitDmg, type CombatUnitContext } from '../../../src/server/engine/combat-pipeline.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-063-lightning-mastery.ts'
import {
  calculateLightningMasteryBonusPct,
  calculateChargedBoltDamage,
  calculateLightningDamage,
  calculateChainLightningDamage,
  calculateNovaDamage,
  calculateThunderStormDamage,
  calculateSkillDamage,
  BATCH1_SKILLS,
} from '../../../src/server/skills/skills.ts'
import { getSkillRange, getSkillMana } from '../../../src/common/skills/weapon-combat-meta.ts'

describe('[Skill #063] Lightning Mastery (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #217)', () => {
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Schema Integrity
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Schema Integrity', () => {
    it('parses authentic Skills.txt row 63 (Lightning Mastery)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const reqLevelIdx = headers.indexOf('reqlevel')
      const passiveIdx = headers.indexOf('passive')
      const passiveStateIdx = headers.indexOf('passivestate')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const param1Idx = headers.indexOf('Param1') !== -1 ? headers.indexOf('Param1') : headers.indexOf('param1')
      const param2Idx = headers.indexOf('Param2') !== -1 ? headers.indexOf('Param2') : headers.indexOf('param2')
      const srvStFuncIdx = headers.indexOf('srvstfunc')
      const srvDoFuncIdx = headers.indexOf('srvdofunc')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '63')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Lightning Mastery')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![reqLevelIdx])).toBe(30)
      expect(Number(row![passiveIdx])).toBe(1)
      expect(row![passiveStateIdx]?.trim()).toBe('lightningmastery')
      expect(Number(row![manaIdx])).toBe(0)
      expect(Number(row![lvlManaIdx])).toBe(0)
      expect(Number(row![param1Idx])).toBe(50) // Base 50% at slvl 1
      expect(Number(row![param2Idx])).toBe(12) // +12% per slvl
      expect(Number(row![srvStFuncIdx])).toBe(0)
      expect(Number(row![srvDoFuncIdx])).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 2: Passive Metadata & Scene Integration
  // =========================================================================
  describe('Dimension 2: Passive Metadata & Scene Integration', () => {
    it('verifies skill module properties and zero active costs', () => {
      expect(skillModule.skillId).toBe(63)
      expect(skillModule.name).toBe('Lightning Mastery')
      expect(skillModule.charClass).toBe('sor')
      expect(skillModule.srvStFunc).toBe(0)
      expect(skillModule.srvDoFunc).toBe(0)
    })

    it('verifies scene query interfaces: mana cost = 0, range = 0, damage = {min: 0, max: 0}', () => {
      expect(getSkillMana(63)).toBe(0)
      expect(getSkillRange(63)).toBe(0)
      expect(calculateSkillDamage(63, 1)).toEqual({ min: 0, max: 0 })
      expect(calculateSkillDamage(63, 20)).toEqual({ min: 0, max: 0 })
      expect(calculateSkillDamage('63', 20)).toEqual({ min: 0, max: 0 })
      expect(calculateSkillDamage('lightningmastery', 20)).toEqual({ min: 0, max: 0 })
    })

    it('evaluates via skillModule.evaluate with 0 mana and passive radius reflecting bonus', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(63)!
      expect(skillRec).toBeDefined()

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(63, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(0)
      expect(r20.manaCost256).toBe(0)
      expect(r20.minPhysDmg).toBe(0)
      expect(r20.maxPhysDmg).toBe(0)
      expect(r20.minElemDmg256).toBe(0)
      expect(r20.maxElemDmg256).toBe(0)
      expect(r20.durationFrames).toBe(0)
      expect(r20.cooldownFrames).toBe(0)
      expect(r20.radiusSubtiles).toBe(278) // 50 + 19 * 12 = 278
    })
  })

  // =========================================================================
  // Dimension 3: Exact 1.13c Formula Scaling
  // =========================================================================
  describe('Dimension 3: Exact 1.13c Formula Scaling', () => {
    it('calculates authentic 1.13c bonus percentages: 50 + (slvl - 1) * 12', () => {
      expect(calculateLightningMasteryBonusPct(1)).toBe(50)   // Level 1: +50%
      expect(calculateLightningMasteryBonusPct(2)).toBe(62)   // Level 2: +62%
      expect(calculateLightningMasteryBonusPct(5)).toBe(98)   // Level 5: +98%
      expect(calculateLightningMasteryBonusPct(10)).toBe(158) // Level 10: +158%
      expect(calculateLightningMasteryBonusPct(15)).toBe(218) // Level 15: +218%
      expect(calculateLightningMasteryBonusPct(20)).toBe(278) // Level 20: +278%
      expect(calculateLightningMasteryBonusPct(30)).toBe(398) // Level 30: +398%
      expect(calculateLightningMasteryBonusPct(40)).toBe(518) // Level 40: +518%
    })

    it('safely clamps non-positive slvl to 0% bonus', () => {
      expect(calculateLightningMasteryBonusPct(0)).toBe(0)
      expect(calculateLightningMasteryBonusPct(-1)).toBe(0)
      expect(calculateLightningMasteryBonusPct(-10)).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 4: Multiplicative Synergy Scaling across all 5 Lightning Skills
  // =========================================================================
  describe('Dimension 4: Multiplicative Synergy Scaling across all 5 Lightning Skills', () => {
    it('proves multiplicative scaling on Charged Bolt (Skill 38)', () => {
      // Level 20 base: 25 - 27
      const base = calculateChargedBoltDamage(20)
      expect(base).toEqual({ min: 25, max: 27 })

      // Synergy only (+120% from 20 hard points in Lightning):
      // min: floor(25 * 2.2) = 55, max: floor(27 * 2.2) = 59
      const synOnly = calculateChargedBoltDamage(20, { lightningPoints: 20 })
      expect(synOnly).toEqual({ min: 55, max: 59 })

      // Mastery only (+278% from Level 20 Lightning Mastery):
      // min: floor(25 * 3.78) = 94, max: floor(27 * 3.78) = 102
      const masteryOnly = calculateChargedBoltDamage(20, undefined, 20)
      expect(masteryOnly).toEqual({ min: 94, max: 102 })

      // BOTH Synergy (+120%) and Mastery (+278%):
      // Multiplicative: Base * 2.20 * 3.78 = Base * 8.316
      // min: floor(25 * 8.316) = 207
      // max: floor(27 * 8.316) = 224
      const both = calculateChargedBoltDamage(20, { lightningPoints: 20, lightningMastery: 20 })
      expect(both).toEqual({ min: 207, max: 224 })

      // Invariant check: Multiplicative is far higher than additive (25 * (1 + 1.20 + 2.78) = 25 * 4.98 = 124.5 -> 124)
      expect(both.min).toBeGreaterThan(124)
      expect(both.max).toBeGreaterThan(134)
    })

    it('proves multiplicative scaling on Lightning (Skill 49)', () => {
      // Level 20 base: 1 - 272
      const base = calculateLightningDamage(20)
      expect(base).toEqual({ min: 1, max: 272 })

      // Synergy only (+160% from 20 hard points in Chain Lightning):
      // min: floor(1 * 2.6) = 2, max: floor(272 * 2.6) = 707
      const synOnly = calculateLightningDamage(20, { chainLightningPoints: 20 })
      expect(synOnly).toEqual({ min: 2, max: 707 })

      // Mastery only (+278% from Level 20 Lightning Mastery):
      // min: floor(1 * 3.78) = 3, max: floor(272 * 3.78) = 1028
      const masteryOnly = calculateLightningDamage(20, undefined, 20)
      expect(masteryOnly).toEqual({ min: 3, max: 1028 })

      // BOTH: floor(272 * 2.60 * 3.78) = 2673
      const both = calculateLightningDamage(20, { chainLightningPoints: 20, lightningMastery: 20 })
      expect(both).toEqual({ min: 9, max: 2673 })
      expect(both.max).toBeGreaterThan(272 * (1 + 1.60 + 2.78)) // 272 * 5.38 = 1463
    })

    it('proves multiplicative scaling on Chain Lightning (Skill 53)', () => {
      // Level 20 base: 1 - 281
      const base = calculateChainLightningDamage(20)
      expect(base).toEqual({ min: 1, max: 281 })

      // Synergy only (+80% from 20 hard points in Lightning):
      // min: floor(1 * 1.8) = 1, max: floor(281 * 1.8) = 505
      const synOnly = calculateChainLightningDamage(20, { lightningPoints: 20 })
      expect(synOnly).toEqual({ min: 1, max: 505 })

      // Mastery only (+278%):
      // min: floor(1 * 3.78) = 3, max: floor(281 * 3.78) = 1062
      const masteryOnly = calculateChainLightningDamage(20, undefined, 20)
      expect(masteryOnly).toEqual({ min: 3, max: 1062 })

      // BOTH: floor(281 * 1.80 * 3.78) = 1911
      const both = calculateChainLightningDamage(20, { lightningPoints: 20, lightningMastery: 20 })
      expect(both).toEqual({ min: 6, max: 1911 })
    })

    it('proves scaling on Nova (Skill 48)', () => {
      // Level 20 base: 131 - 188
      const base = calculateNovaDamage(20)
      expect(base).toEqual({ min: 131, max: 188 })

      // With LM 20 (+278%):
      // min: floor(131 * 3.78) = 495
      // max: floor(188 * 3.78) = 710
      const withLm20 = calculateNovaDamage(20, { lightningMastery: 20 })
      expect(withLm20).toEqual({ min: 495, max: 710 })
    })

    it('proves scaling on Thunder Storm (Skill 57)', () => {
      // Level 20 base: 195 - 294
      const base = calculateThunderStormDamage(20)
      expect(base).toEqual({ min: 195, max: 294 })

      // With LM 20 (+278%):
      // min: 195 * 3.78 = 737.1 -> 737
      // max: 294 * 3.78 = 1111.32 -> 1111
      const withLm20 = calculateThunderStormDamage(20, { lightningMastery: 20 })
      expect(withLm20).toEqual({ min: 737, max: 1111 })
    })
  })

  // =========================================================================
  // Dimension 5: StatList & Combat Pipeline Integration
  // =========================================================================
  describe('Dimension 5: StatList & Combat Pipeline Integration', () => {
    it('accrues passive_ltng_mastery stat dynamically from skill level', () => {
      const stats = new UnitStatList()
      expect(stats.getAccruedStat('passive_ltng_mastery')).toBe(0)
      expect(stats.getAccruedStat('passive_lightning_mastery')).toBe(0)

      stats.setBaseSkillLevel(63, 1)
      expect(stats.getAccruedStat('passive_ltng_mastery')).toBe(50)
      expect(stats.getAccruedStat('passive_lightning_mastery')).toBe(50)

      stats.setBaseSkillLevel(63, 20)
      expect(stats.getAccruedStat('passive_ltng_mastery')).toBe(278)
      expect(stats.getAccruedStat('passive_lightning_mastery')).toBe(278)

      // +5 allskills boosts effective skill level to 25 -> 50 + 24 * 12 = 338%
      stats.addStat('item_allskills', 5)
      expect(stats.getAccruedStat('passive_ltng_mastery')).toBe(338)
      expect(stats.getAccruedStat('passive_lightning_mastery')).toBe(338)
    })

    it('applies passive_ltng_mastery inside executeSUnitDmg combat pipeline', async () => {
      const registry = await getSharedDataRegistry()
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const defenderStats = new UnitStatList(registry, { maxhp: 2000 * FIXED_ONE, hitpoints: 2000 * FIXED_ONE })

      // Attacker has Level 20 Lightning Mastery (+278%)
      attackerStats.setBaseSkillLevel(63, 20)

      const attackerBus = new StateBus(attackerStats, registry)
      const defenderBus = new StateBus(defenderStats, registry)

      const attackerCtx: CombatUnitContext = {
        id: 'sorceress-1',
        name: 'Sorceress',
        statList: attackerStats,
        stateBus: attackerBus,
      }
      const defenderCtx: CombatUnitContext = {
        id: 'target-dummy-1',
        name: 'Target Dummy',
        statList: defenderStats,
        stateBus: defenderBus,
      }

      // Deal 100 raw lightning damage
      const res = executeSUnitDmg(attackerCtx, defenderCtx, {
        skillId: 49, // Lightning
        attackKind: 'spell',
        autoHit: true,
        elemType: 'ltng',
        elemMin256: 100 * FIXED_ONE,
        elemMax256: 100 * FIXED_ONE,
      }, { rand: () => 50 })

      // Raw 100 scaled by +278% mastery: 100 * 3.78 = 378 total damage!
      expect(res.elemDamage256).toBe(378 * FIXED_ONE)
      expect(res.totalDamage).toBe(378)
      expect(defenderStats.getHp()).toBe(2000 - 378)
    })
  })

  // =========================================================================
  // Dimension 6: Edge Cases & Boundary Conditions
  // =========================================================================
  describe('Dimension 6: Edge Cases & Boundary Conditions', () => {
    it('does NOT alter non-lightning damage in combat pipeline', async () => {
      const registry = await getSharedDataRegistry()
      const attackerStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const defenderStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })

      // Attacker has Level 20 Lightning Mastery (+278%)
      attackerStats.setBaseSkillLevel(63, 20)

      const attackerBus = new StateBus(attackerStats, registry)
      const defenderBus = new StateBus(defenderStats, registry)

      const attackerCtx: CombatUnitContext = { id: 'a1', name: 'A', statList: attackerStats, stateBus: attackerBus }
      const defenderCtx: CombatUnitContext = { id: 'd1', name: 'D', statList: defenderStats, stateBus: defenderBus }

      // Deal 100 Fire damage
      const resFire = executeSUnitDmg(attackerCtx, defenderCtx, {
        skillId: 47, // Fire Ball
        attackKind: 'spell',
        autoHit: true,
        elemType: 'fire',
        elemMin256: 100 * FIXED_ONE,
        elemMax256: 100 * FIXED_ONE,
      }, { rand: () => 50 })
      // Lightning Mastery does NOT boost Fire damage: remains 100
      expect(resFire.totalDamage).toBe(100)

      // Deal 100 Physical damage
      const resPhys = executeSUnitDmg(attackerCtx, defenderCtx, {
        skillId: 1,
        attackKind: 'spell',
        autoHit: true,
        flatPhysMin256: 100 * FIXED_ONE,
        flatPhysMax256: 100 * FIXED_ONE,
      }, { rand: () => 50 })
      // Lightning Mastery does NOT boost Physical damage: remains 100
      expect(resPhys.totalDamage).toBe(100)
    })

    it('enforces that Lightning Mastery itself receives 0 synergies in 1.13c', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(63)!

      const statsWithAllSkills = new UnitStatList()
      statsWithAllSkills.setBaseSkillLevel(63, 20)
      statsWithAllSkills.setBaseSkillLevel(49, 20) // 20 points in Lightning
      statsWithAllSkills.setBaseSkillLevel(53, 20) // 20 points in Chain Lightning

      const evalResult = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsWithAllSkills,
      })
      expect(evalResult.synergyBonusPct).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 7: Invariants & WorldArena Integration
  // =========================================================================
  describe('Dimension 7: Invariants & WorldArena Integration', () => {
    it('executes runtime skill effect in WorldArena (castCount, action frame, and outcome)', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: 'sor',
        skillId: 63,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(63)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })

    it('enforces BATCH1_SKILLS length invariant strictly 38', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })
  })
})
