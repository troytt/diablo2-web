/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #026: Strafe (AMA)
 * Gitea Tracking Issue: #180
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-026-strafe.ts'
import { calculateStrafeStats } from '../../../src/common/skills/amazon-bow.ts'

describe('[Skill #026] Strafe (AMA) — 1.13c Parity (Issue #180)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(26)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(26)
    expect(skillModule.name).toBe("Strafe")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(26, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(11)
    expect(r1.manaCost256).toBe(2816)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(26, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(11)
    expect(r10.manaCost256).toBe(2816)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(26, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(11)
    expect(r20.manaCost256).toBe(2816)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(35)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(26)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(26, 20)
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
    statsSoftOnly.setBaseSkillLevel(26, 20)
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
      skillId: 26,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(26)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateStrafeStats pure calculations and burst invariants', () => {
    // Level 1: 4 max arrows (2 min arrows), 75% weapon damage (srcdam=96), +5% ED, stationary lock-in, 11 mana
    const s1 = calculateStrafeStats(1)
    expect(s1.arrowCount).toBe(4)
    expect(s1.minArrows).toBe(2)
    expect(s1.damageMultiplier).toBe(0.75)
    expect(s1.srcDam).toBe(96)
    expect(s1.enhancedDamagePct).toBe(5)
    expect(s1.stationaryLockIn).toBe(true)
    expect(s1.lockInFrames).toBe(12) // 4 * 2 + 4
    expect(s1.manaCost).toBe(11)

    // Level 2: 5 arrows
    const s2 = calculateStrafeStats(2)
    expect(s2.arrowCount).toBe(5)

    // Level 7+: capped at 10 max arrows
    const s7 = calculateStrafeStats(7)
    expect(s7.arrowCount).toBe(10)

    // Level 10: 10 max arrows (4 min arrows), +50% ED, 11 mana
    const s10 = calculateStrafeStats(10)
    expect(s10.arrowCount).toBe(10)
    expect(s10.minArrows).toBe(4)
    expect(s10.enhancedDamagePct).toBe(50)
    expect(s10.manaCost).toBe(11)

    // Level 20: 10 max arrows (7 min arrows), +100% ED, 11 mana
    const s20 = calculateStrafeStats(20)
    expect(s20.arrowCount).toBe(10)
    expect(s20.minArrows).toBe(7)
    expect(s20.enhancedDamagePct).toBe(100)
    expect(s20.manaCost).toBe(11)

    // Fixed mana cost invariant
    for (let lvl = 1; lvl <= 30; lvl++) {
      expect(calculateStrafeStats(lvl).manaCost).toBe(11)
    }

    // Boundary resilience
    const sZero = calculateStrafeStats(0)
    expect(sZero.arrowCount).toBe(4)
    expect(sZero.manaCost).toBe(11)

    const sNeg = calculateStrafeStats(-5)
    expect(sNeg.arrowCount).toBe(4)

    const sNan = calculateStrafeStats(NaN)
    expect(sNan.arrowCount).toBe(4)

    const sFrac = calculateStrafeStats(7.9)
    expect(sFrac.arrowCount).toBe(calculateStrafeStats(7).arrowCount)
  })
})
