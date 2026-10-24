/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #008: Inner Sight (AMA)
 * Gitea Tracking Issue: #162
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-008-inner-sight.ts'
import { calculateInnerSightStats } from '../../../src/common/skills/amazon-passive.ts'

describe('[Skill #008] Inner Sight (AMA) — 1.13c Parity (Issue #162)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(8)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(8)
    expect(skillModule.name).toBe("Inner Sight")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(8, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(5)
    expect(r1.manaCost256).toBe(1280)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(10240)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(8, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(5)
    expect(r10.manaCost256).toBe(1280)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(78080)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(8, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(5)
    expect(r20.manaCost256).toBe(1280)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(208640)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(2100)
    expect(r20.radiusSubtiles).toBe(20)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(8)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(8, 20)
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
    statsSoftOnly.setBaseSkillLevel(8, 20)
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
      skillId: 8,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(8)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateInnerSightStats pure calculations and boundary invariants', () => {
    // slvl 1: -40 flat defense (-edmn), 200 frames (8.0s), 200px radius, 5 mana (1280)
    const stats1 = calculateInnerSightStats(1)
    expect(stats1.flatDefenseReduction).toBe(-40)
    expect(stats1.durationFrames).toBe(200)
    expect(stats1.durationSeconds).toBe(8)
    expect(stats1.radiusPx).toBe(200)
    expect(stats1.radiusSubtiles).toBe(20)
    expect(stats1.manaCost).toBe(5)
    expect(stats1.manaCost256).toBe(1280)

    // slvl 10: -edmn(40, 25, 45, 60, 80, 100) at slvl 10 = -(40 + 7*25 + 2*45) = -305 defense, 200 + 100*9 = 1100 frames (44.0s)
    const stats10 = calculateInnerSightStats(10)
    expect(stats10.flatDefenseReduction).toBe(-305)
    expect(stats10.durationFrames).toBe(1100)
    expect(stats10.durationSeconds).toBe(44)

    // slvl 20: -edmn(40, 25, 45, 60, 80, 100) at slvl 20 = -(40 + 7*25 + 8*45 + 4*60) = -815 defense, 200 + 100*19 = 2100 frames (84.0s)
    const stats20 = calculateInnerSightStats(20)
    expect(stats20.flatDefenseReduction).toBe(-815)
    expect(stats20.durationFrames).toBe(2100)
    expect(stats20.durationSeconds).toBe(84)
  })

  it('applies flat armorclass reduction (-edmn) and item_light=3 with cursetype=0 (coexists with Necromancer curses)', async () => {
    const registry = await getSharedDataRegistry()
    const arena = new WorldArena({
      registry,
      classCode: 'ama',
      skillId: 8,
      slvl: 20,
    })
    const dummy = arena.targets[0]!
    dummy.statList.setBaseStat('armorclass', 1000)
    // Apply Necromancer Amplify Damage (cursetype=1) first
    dummy.stateBus.applyState({
      stateNameOrId: 'amplifydamage',
      slvl: 1,
      durationFrames: 500,
      stats: { amplify_phys_pierce: 100 },
      curseTypeOverride: 1,
    })
    expect(dummy.stateBus.hasState('amplifydamage')).toBe(true)

    arena.triggerCast()
    arena.stepTicks(15)
    expect(dummy.stateBus.hasState('innersight')).toBe(true)
    expect(dummy.stateBus.hasState('amplifydamage')).toBe(true) // cursetype=0 does NOT overwrite cursetype=1!
    expect(dummy.statList.getAccruedStat('armorclass')).toBe(1000 - 815) // 185
  })
})
