/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #065: Cold Mastery (SOR)
 * Gitea Tracking Issue: #219
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Schema Integrity (Skills.txt row 65, passivestat1 'passive_cold_pierce', Param1 20, Param2 5)
 * D2: Visual Assets & Metadata Integrity (Passive skill metadata, skillModule id 65, charClass 'sor', no cast overlay)
 * D3: Authentic 1.13c Passive Cold Pierce Calculation (20 + (slvl - 1) * 5: 20% at slvl 1, 65% at slvl 10, 115% at slvl 20, 165% at slvl 30, clamp 0 at slvl <= 0)
 * D4: Immunity Handling, Conviction/LR Interaction & -100% Floor Clamping (Cannot break immune, full power when broken, -100% clamp)
 * D5: StatList & Skill Module Evaluation (evaluate at slvl 1, 10, 20, zero synergies)
 * D6: Mana Progression & Cooldown Ticks (Mana = 0, Cooldown = 0)
 * D7: Invariants & WorldArena Integration (BATCH1_SKILLS strictly 38, WorldArena runtime cast)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-065-cold-mastery.ts'
import {
  calculateColdMasteryPierce,
  calculateSkillDamage,
  getSkillManaCost,
  getSkillCooldownTicks,
  getSkillCastOverlay,
  BATCH1_SKILLS,
} from '../../../src/server/skills/skills.ts'
import {
  computeEffectiveResistance,
  executeSUnitDmg,
} from '../../../src/server/engine/combat-pipeline.ts'

describe('[Skill #065] Cold Mastery (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #219)', () => {
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Schema Integrity
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Schema Integrity', () => {
    it('parses authentic Skills.txt row 65 (Cold Mastery)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const passiveIdx = headers.indexOf('passive')
      const passiveStat1Idx = headers.indexOf('passivestat1')
      const passiveCalc1Idx = headers.indexOf('passivecalc1')
      const param1Idx = headers.indexOf('Param1') !== -1 ? headers.indexOf('Param1') : headers.indexOf('param1')
      const param2Idx = headers.indexOf('Param2') !== -1 ? headers.indexOf('Param2') : headers.indexOf('param2')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '65')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Cold Mastery')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(0)
      expect(Number(row![lvlManaIdx])).toBe(0)
      expect(Number(row![passiveIdx])).toBe(1)
      expect(row![passiveStat1Idx]?.trim()).toBe('passive_cold_pierce')
      expect(row![passiveCalc1Idx]?.trim()).toBe('ln12')
      expect(Number(row![param1Idx])).toBe(20) // 20% base cold pierce
      expect(Number(row![param2Idx])).toBe(5)  // +5% cold pierce per level
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies Cold Mastery skillModule metadata', () => {
      expect(skillModule.skillId).toBe(65)
      expect(skillModule.name).toBe('Cold Mastery')
      expect(skillModule.charClass).toBe('sor')
      expect(getSkillCastOverlay(65)).toBeUndefined()
    })
  })

  // =========================================================================
  // Dimension 3: Authentic 1.13c Passive Cold Pierce Calculation
  // =========================================================================
  describe('Dimension 3: Authentic 1.13c Passive Cold Pierce Calculation', () => {
    it('calculates exact 1.13c linear formula: 20 + (slvl - 1) * 5', () => {
      // slvl 1: 20%
      expect(calculateColdMasteryPierce(1)).toBe(20)

      // slvl 5: 20 + 4*5 = 40%
      expect(calculateColdMasteryPierce(5)).toBe(40)

      // slvl 10: 20 + 9*5 = 65%
      expect(calculateColdMasteryPierce(10)).toBe(65)

      // slvl 20: 20 + 19*5 = 115%
      expect(calculateColdMasteryPierce(20)).toBe(115)

      // slvl 30: 20 + 29*5 = 165%
      expect(calculateColdMasteryPierce(30)).toBe(165)

      // Level <= 0 must return 0
      expect(calculateColdMasteryPierce(0)).toBe(0)
      expect(calculateColdMasteryPierce(-5)).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 4: Immunity Handling, Conviction/LR Interaction & -100% Floor Clamping
  // =========================================================================
  describe('Dimension 4: Immunity Handling, Conviction/LR Interaction & -100% Floor Clamping', () => {
    it('Case 1: Reduces non-immune positive resistance (50% base, slvl 20 CM -> -65%)', () => {
      const pierce = calculateColdMasteryPierce(20) // 115
      const res = computeEffectiveResistance({
        isDefenderPlayer: false,
        baseRes: 50,
        passiveEnemyPierce: pierce,
      })
      expect(res.isImmune).toBe(false)
      expect(res.effectiveRes).toBe(-65) // 50 - 115
    })

    it('Case 2: Enforces strict -100% resistance floor clamp (0% base, slvl 20 CM -> -100%)', () => {
      const pierce = calculateColdMasteryPierce(20) // 115
      const res = computeEffectiveResistance({
        isDefenderPlayer: false,
        baseRes: 0,
        passiveEnemyPierce: pierce,
      })
      expect(res.isImmune).toBe(false)
      // Clamped to -100% (cannot go to -115%)
      expect(res.effectiveRes).toBe(-100)
    })

    it('Case 3: Invariant: Cold Mastery CANNOT break natural cold immunity (110% base -> 100% immune)', () => {
      const pierce = calculateColdMasteryPierce(20) // 115
      const res = computeEffectiveResistance({
        isDefenderPlayer: false,
        baseRes: 110,
        passiveEnemyPierce: pierce,
      })
      expect(res.isImmune).toBe(true)
      expect(res.effectiveRes).toBe(100)
    })

    it('Case 4: Applies at full 100% power when immunity is broken by Conviction/Lower Resist', () => {
      const pierce = calculateColdMasteryPierce(20) // 115
      // Monster with 110% cold res, Conviction with 85% pierce
      // Conviction applied at 1/5th to immune: 85 / 5 = 17%
      // Resistance after Conviction: 110 - 17 = 93% (< 100%, broken!)
      // Cold Mastery now applies at 100% power: 93 - 115 = -22%
      const res = computeEffectiveResistance({
        isDefenderPlayer: false,
        baseRes: 110,
        convictionPierce: 85,
        passiveEnemyPierce: pierce,
      })
      expect(res.isImmune).toBe(false)
      expect(res.convictionAndLRApplied).toBe(17)
      expect(res.resAfterConvictionLR).toBe(93)
      expect(res.effectiveRes).toBe(-22)
    })

    it('Case 5: Combat pipeline executes damage amplification with passive_cold_pierce stat', () => {
      const attackerStats = new UnitStatList()
      // slvl 20 Cold Mastery: 115% pierce
      attackerStats.addStat('passive_cold_pierce', 115)
      const attackerCtx = {
        id: 'sorceress',
        statList: attackerStats,
        stateBus: new StateBus(attackerStats),
      } as any

      // Defender with 0% cold resistance
      const defenderStats = new UnitStatList()
      defenderStats.addStat('hp', 500 * 256)
      defenderStats.addStat('res_cold', 0)
      const defenderCtx = {
        id: 'fallen',
        statList: defenderStats,
        stateBus: new StateBus(defenderStats),
      } as any

      // Deal 100 cold damage: effective res clamped to -100% -> takes 200 damage (2.0x max multiplier)
      const dmgResult = executeSUnitDmg(attackerCtx, defenderCtx, {
        skillId: 45,
        attackKind: 'spell',
        autoHit: true,
        elemType: 'cold',
        elemMin256: 100 * 256,
        elemMax256: 100 * 256,
      }, { rand: () => 50 })

      expect(dmgResult.immuneToElem).toBe(false)
      expect(dmgResult.totalDamage).toBe(200)
    })
  })

  // =========================================================================
  // Dimension 5: StatList & Skill Module Evaluation
  // =========================================================================
  describe('Dimension 5: StatList & Skill Module Evaluation', () => {
    it('evaluates exact 1.13c Skills.txt formulas at slvl 1, 10, and 20', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(65)!

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(65, 1)
      const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
      expect(r1.manaCost).toBe(0)
      expect(r1.minElemDmg256).toBe(0)
      expect(r1.maxElemDmg256).toBe(0)
      expect(r1.radiusSubtiles).toBe(20) // Param1: 20%

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(65, 10)
      const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
      expect(r10.manaCost).toBe(0)
      expect(r10.radiusSubtiles).toBe(65) // 20 + 9*5 = 65%

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(65, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(0)
      expect(r20.radiusSubtiles).toBe(115) // 20 + 19*5 = 115%
      expect(r20.cooldownFrames).toBe(0)
    })

    it('enforces 1.13c zero synergy rule (passive skill has no synergies)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(65)!

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(65, 20)
      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 6: Mana Progression & Cooldown Ticks
  // =========================================================================
  describe('Dimension 6: Mana Progression & Cooldown Ticks', () => {
    it('enforces 0 mana cost at all levels for passive skill', () => {
      expect(getSkillManaCost(65, 1)).toBe(0)
      expect(getSkillManaCost(65, 10)).toBe(0)
      expect(getSkillManaCost(65, 20)).toBe(0)
      expect(getSkillManaCost(65, 30)).toBe(0)
    })

    it('enforces 0 cooldown ticks for passive skill', () => {
      expect(getSkillCooldownTicks(65)).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 7: Invariants & WorldArena Integration
  // =========================================================================
  describe('Dimension 7: Invariants & WorldArena Integration', () => {
    it('STRICT INVARIANT: BATCH1_SKILLS length must remain strictly 38', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })

    it('returns { min: 0, max: 0 } from calculateSkillDamage for Cold Mastery', () => {
      const dmg = calculateSkillDamage(65, 20)
      expect(dmg.min).toBe(0)
      expect(dmg.max).toBe(0)
    })

    it('executes runtime skill in WorldArena', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: 'sor',
        skillId: 65,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(65)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })
  })
})
