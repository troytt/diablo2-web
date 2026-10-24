/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #030: Fend (AMA)
 * Gitea Tracking Issue: #184
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { calculateFendStats } from '../../../src/common/skills/amazon-javelin-spear.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-030-fend.ts'

describe('[Skill #030] Fend (AMA) — 1.13c Parity (Issue #184 / #972)', () => {
  it('computes pure calculateFendStats 1.13c formulas (+70+10*(slvl-1)% ED, +40+10*(slvl-1)% AR, maxAdjacentTargets=12, 5 mana)', () => {
    const f1 = calculateFendStats(1)
    expect(f1.enhancedDamagePct).toBe(70)
    expect(f1.toHitBonusPct).toBe(40)
    expect(f1.maxAdjacentTargets).toBe(12)
    expect(f1.manaCost).toBe(5)

    const f20 = calculateFendStats(20)
    expect(f20.enhancedDamagePct).toBe(260)
    expect(f20.toHitBonusPct).toBe(230)
    expect(f20.maxAdjacentTargets).toBe(12)
    expect(f20.manaCost).toBe(5)
  })

  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(30)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(30)
    expect(skillModule.name).toBe("Fend")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(30, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(5)
    expect(r1.manaCost256).toBe(1280)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(30, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(5)
    expect(r10.manaCost256).toBe(1280)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(30, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(5)
    expect(r20.manaCost256).toBe(1280)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(1141)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(30)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(30, 20)
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
    statsSoftOnly.setBaseSkillLevel(30, 20)
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
      skillId: 30,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(30)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
    // 1 strike per living target in arena (4 dummies in WorldArena)
    expect(outcome?.notes).toContain('melee_hits:4')
  })

  it('verifies ClientWorld Layer 4 (Issue #975): #30 Fend spawns no client projectile', async () => {
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 30, 102, 100, 10)
    expect(Array.from(world.units.values()).filter((u) => u.unitType === 'missile').length).toBe(0)
  })
})


