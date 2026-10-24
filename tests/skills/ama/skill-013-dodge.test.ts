/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #013: Dodge (AMA)
 * Gitea Tracking Issue: #167
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-013-dodge.ts'
import { calculateDodgeStats } from '../../../src/common/skills/amazon-passive.ts'

describe('[Skill #013] Dodge (AMA) — 1.13c Parity (Issue #167)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(13)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(13)
    expect(skillModule.name).toBe("Dodge")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(13, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(0)
    expect(r1.manaCost256).toBe(0)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(13, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(0)
    expect(r10.manaCost256).toBe(0)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(13, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(0)
    expect(r20.manaCost256).toBe(0)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(1245)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(13)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(13, 20)
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
    statsSoftOnly.setBaseSkillLevel(13, 20)
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
      skillId: 13,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(13)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateDodgeStats pure calculations and boundary invariants', () => {
    // slvl 1: dm(10, 65, 1) = floor(110*1*55 / (100*7)) + 10 = floor(6050/700) + 10 = 8 + 10 = 18%
    const stats1 = calculateDodgeStats(1)
    expect(stats1.chancePct).toBe(18)
    expect(stats1.triggersAnimationLock).toBe(true)
    expect(stats1.animationCode).toBe('S1')
    expect(stats1.appliesTo).toBe('melee')
    expect(stats1.condition).toBe('stationary_or_attacking')
    expect(stats1.manaCost).toBe(0)
    expect(stats1.manaCost256).toBe(0)

    // slvl 10: dm(10, 65, 10) = floor(110*10*55 / (100*16)) + 10 = floor(60500/1600) + 10 = 37 + 10 = 47%
    const stats10 = calculateDodgeStats(10)
    expect(stats10.chancePct).toBe(47)

    // slvl 20: dm(10, 65, 20) = floor(110*20*55 / (100*26)) + 10 = floor(121000/2600) + 10 = 46 + 10 = 56%
    const stats20 = calculateDodgeStats(20)
    expect(stats20.chancePct).toBe(56)
  })
})
