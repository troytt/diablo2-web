/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #017: Slow Missiles (AMA)
 * Gitea Tracking Issue: #171
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-017-slow-missiles.ts'
import { calculateSlowMissilesStats } from '../../../src/common/skills/amazon-passive.ts'

describe('[Skill #017] Slow Missiles (AMA) — 1.13c Parity (Issue #171)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(17)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(17)
    expect(skillModule.name).toBe("Slow Missiles")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(17, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(5)
    expect(r1.manaCost256).toBe(1280)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(17, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(5)
    expect(r10.manaCost256).toBe(1280)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(17, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(5)
    expect(r20.manaCost256).toBe(1280)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(3150)
    expect(r20.radiusSubtiles).toBe(20)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(17)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(17, 20)
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
    statsSoftOnly.setBaseSkillLevel(17, 20)
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
      skillId: 17,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(17)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateSlowMissilesStats pure calculations and boundary invariants', () => {
    // slvl 1: 300 frames (12.0s), 200px radius, 0.33 vel mult (67% reduction), 5 mana (1280)
    const stats1 = calculateSlowMissilesStats(1)
    expect(stats1.durationFrames).toBe(300)
    expect(stats1.durationSeconds).toBe(12)
    expect(stats1.radiusPx).toBe(200)
    expect(stats1.radiusSubtiles).toBe(20)
    expect(stats1.velocityMultiplier).toBe(0.33)
    expect(stats1.velocityReductionPct).toBe(67)
    expect(stats1.manaCost).toBe(5)
    expect(stats1.manaCost256).toBe(1280)

    // slvl 10: 300 + 150*9 = 1650 frames (66.0s)
    const stats10 = calculateSlowMissilesStats(10)
    expect(stats10.durationFrames).toBe(1650)
    expect(stats10.durationSeconds).toBe(66)

    // slvl 20: 300 + 150*19 = 3150 frames (126.0s)
    const stats20 = calculateSlowMissilesStats(20)
    expect(stats20.durationFrames).toBe(3150)
    expect(stats20.durationSeconds).toBe(126)
  })

  it('applies skill_handofathena=33 and item_light=3 with cursetype=0 (coexists with Inner Sight and Curses)', async () => {
    const registry = await getSharedDataRegistry()
    const arena = new WorldArena({
      registry,
      classCode: 'ama',
      skillId: 17,
      slvl: 20,
    })
    const dummy = arena.targets[0]!
    dummy.stateBus.applyState({
      stateNameOrId: 'innersight',
      slvl: 20,
      durationFrames: 2100,
      stats: { armorclass: -815, item_light: 3 },
      curseTypeOverride: 0,
    })
    arena.triggerCast()
    arena.stepTicks(15)
    expect(dummy.stateBus.hasState('slowmissiles')).toBe(true)
    expect(dummy.stateBus.hasState('innersight')).toBe(true)
    expect(dummy.statList.getAccruedStat('skill_handofathena')).toBe(33)
  })
})
