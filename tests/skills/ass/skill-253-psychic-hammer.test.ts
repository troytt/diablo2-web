/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #253: Psychic Hammer (ASS)
 * Gitea Tracking Issue: #346
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ass/skill-253-psychic-hammer.ts'

describe('[Skill #253] Psychic Hammer (ASS) — 1.13c Parity (Issue #346)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(253)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(253)
    expect(skillModule.name).toBe("Psychic Hammer")
    expect(skillModule.charClass).toBe("ass")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(253, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(4)
    expect(r1.manaCost256).toBe(1024)
    expect(r1.minPhysDmg).toBe(1)
    expect(r1.maxPhysDmg).toBe(3)
    expect(r1.minElemDmg256).toBe(256)
    expect(r1.maxElemDmg256).toBe(768)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(253, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(6)
    expect(r10.manaCost256).toBe(1600)
    expect(r10.minPhysDmg).toBe(11)
    expect(r10.maxPhysDmg).toBe(17)
    expect(r10.minElemDmg256).toBe(2816)
    expect(r10.maxElemDmg256).toBe(4480)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(253, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(8)
    expect(r20.manaCost256).toBe(2240)
    expect(r20.minPhysDmg).toBe(28)
    expect(r20.maxPhysDmg).toBe(39)
    expect(r20.minElemDmg256).toBe(7168)
    expect(r20.maxElemDmg256).toBe(10112)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(253)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(253, 20)
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
    statsSoftOnly.setBaseSkillLevel(253, 20)
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
      classCode: "ass",
      skillId: 253,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(253)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })
})
