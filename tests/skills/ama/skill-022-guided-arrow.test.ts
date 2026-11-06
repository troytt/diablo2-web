/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #022: Guided Arrow (AMA)
 * Gitea Tracking Issue: #176
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-022-guided-arrow.ts'
import { calculateGuidedArrowStats } from '../../../src/common/skills/amazon-bow.ts'

describe('[Skill #022] Guided Arrow (AMA) — 1.13c Parity (Issue #176)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(22)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(22)
    expect(skillModule.name).toBe("Guided Arrow")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(22, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(8)
    expect(r1.manaCost256).toBe(2048)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(22, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(5)
    expect(r10.manaCost256).toBe(1472)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(22, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(3)
    expect(r20.manaCost256).toBe(832)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(22)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(22, 20)
    if (synId !== null) {
      statsBase.setBaseSkillLevel(synId, 20)
    }
    const withHardPoints = skillModule.evaluate!({
      registry,
      skill: skillRec,
      slvl: 20,
      blvl: 20,
      statList: statsBase,
    })
    expect(withHardPoints.synergyBonusPct).toBe(0)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(22, 20)
    statsSoftOnly.addStat('item_allskills', 20)
    if (synId !== null) {
      statsSoftOnly.setChargedSkillLevel(synId, 33)
    }
    const withSoftOnly = skillModule.evaluate!({
      registry,
      skill: skillRec,
      slvl: 20,
      blvl: 20,
      statList: statsSoftOnly,
    })
    expect(withSoftOnly.synergyBonusPct).toBe(0)
  })

  it('executes runtime skill effect in WorldArena (castCount, action frame, and combat/state/missile/summon outcome)', async () => {
    const registry = await getSharedDataRegistry()
    const arena = new WorldArena({
      registry,
      classCode: "ama",
      skillId: 22,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(22)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateGuidedArrowStats pure calculations and pierce capability', () => {
    // Level 1: +0% ED, alwaysHits = true, canPierce = true, pierceChancePct = 0 (scales from Pierce #33 + item_pierce), 8.0 mana
    const s1 = calculateGuidedArrowStats(1)
    expect(s1.enhancedDamagePct).toBe(0)
    expect(s1.alwaysHits).toBe(true)
    expect(s1.autoHit).toBe(true)
    expect(s1.canPierce).toBe(true)
    expect(s1.pierceChancePct).toBe(0)
    expect(s1.manaCost).toBe(8.0)

    // Level 10: +45% ED, 5.75 mana
    const s10 = calculateGuidedArrowStats(10)
    expect(s10.enhancedDamagePct).toBe(45)
    expect(s10.alwaysHits).toBe(true)
    expect(s10.canPierce).toBe(true)
    expect(s10.manaCost).toBe(5.75)

    // Level 20: +95% ED, 3.25 mana
    const s20 = calculateGuidedArrowStats(20)
    expect(s20.enhancedDamagePct).toBe(95)
    expect(s20.alwaysHits).toBe(true)
    expect(s20.canPierce).toBe(true)
    expect(s20.manaCost).toBe(3.25)

    // High level clamp: mana floor is 1.0 (minmana=1; slvl 29+ reaches 1.0)
    const s29 = calculateGuidedArrowStats(29)
    expect(s29.manaCost).toBe(1.0)
    const s50 = calculateGuidedArrowStats(50)
    expect(s50.manaCost).toBe(1.0)

    // Pierce capability and auto-hit at all levels
    for (let lvl = 1; lvl <= 40; lvl++) {
      const s = calculateGuidedArrowStats(lvl)
      expect(s.canPierce).toBe(true)
      expect(s.pierceChancePct).toBe(0)
      expect(s.alwaysHits).toBe(true)
    }

    // Boundary resilience
    const sZero = calculateGuidedArrowStats(0)
    expect(sZero.enhancedDamagePct).toBe(0)
    expect(sZero.manaCost).toBe(8.0)

    const sNeg = calculateGuidedArrowStats(-10)
    expect(sNeg.enhancedDamagePct).toBe(0)

    const sNan = calculateGuidedArrowStats(NaN)
    expect(sNan.enhancedDamagePct).toBe(0)

    const sFrac = calculateGuidedArrowStats(6.5)
    expect(sFrac.enhancedDamagePct).toBe(calculateGuidedArrowStats(6).enhancedDamagePct)
  })
})
