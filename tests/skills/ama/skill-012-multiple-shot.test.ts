/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #012: Multiple Shot (AMA)
 * Gitea Tracking Issue: #166
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-012-multiple-shot.ts'
import {
  calculateMultipleShotStats,
  generateMultipleShotAngles,
  isMultipleShotCenterArrow,
} from '../../../src/common/skills/amazon-bow.ts'

describe('[Skill #012] Multiple Shot (AMA) — 1.13c Parity (Issue #166)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(12)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(12)
    expect(skillModule.name).toBe("Multiple Shot")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(12, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(4)
    expect(r1.manaCost256).toBe(1024)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(12, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(13)
    expect(r10.manaCost256).toBe(3328)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(12, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(23)
    expect(r20.manaCost256).toBe(5888)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(21)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(12)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(12, 20)
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
    statsSoftOnly.setBaseSkillLevel(12, 20)
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
      skillId: 12,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(12)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateMultipleShotStats pure calculations and kinematics invariants', () => {
    // Level 1: 2 arrows, 75% weapon damage (srcdam=96), 4 mana
    const s1 = calculateMultipleShotStats(1)
    expect(s1.arrowCount).toBe(2)
    expect(s1.damageMultiplier).toBe(0.75)
    expect(s1.srcDam).toBe(96)
    expect(s1.centerProcArrows).toBe(2)
    expect(s1.onlyCenterArrowsProc).toBe(true)
    expect(s1.singleTargetImmunity).toBe(true)
    expect(s1.manaCost).toBe(4)

    // Level 10: 11 arrows, 13 mana
    const s10 = calculateMultipleShotStats(10)
    expect(s10.arrowCount).toBe(11)
    expect(s10.manaCost).toBe(13)

    // Level 20: 21 arrows, 23 mana
    const s20 = calculateMultipleShotStats(20)
    expect(s20.arrowCount).toBe(21)
    expect(s20.manaCost).toBe(23)

    // Level 23+: capped at 24 arrows
    const s23 = calculateMultipleShotStats(23)
    expect(s23.arrowCount).toBe(24)
    const s30 = calculateMultipleShotStats(30)
    expect(s30.arrowCount).toBe(24)

    // Proc flag: only center 2 arrows proc
    // For 4 arrows (0, 1, 2, 3): mid1=1, mid2=2
    expect(isMultipleShotCenterArrow(0, 4)).toBe(false)
    expect(isMultipleShotCenterArrow(1, 4)).toBe(true)
    expect(isMultipleShotCenterArrow(2, 4)).toBe(true)
    expect(isMultipleShotCenterArrow(3, 4)).toBe(false)

    // Symmetrical fan angles test
    const angles = generateMultipleShotAngles(0, 5, Math.PI / 4)
    expect(angles.length).toBe(5)
    expect(angles[0]).toBeCloseTo(-Math.PI / 8)
    expect(angles[2]).toBeCloseTo(0)
    expect(angles[4]).toBeCloseTo(Math.PI / 8)

    // Boundary resilience
    const sZero = calculateMultipleShotStats(0)
    expect(sZero.arrowCount).toBe(2)
    expect(sZero.manaCost).toBe(4)

    const sNeg = calculateMultipleShotStats(-5)
    expect(sNeg.arrowCount).toBe(2)

    const sNan = calculateMultipleShotStats(NaN)
    expect(sNan.arrowCount).toBe(2)

    const sFrac = calculateMultipleShotStats(3.9)
    expect(sFrac.arrowCount).toBe(4)
  })
})
