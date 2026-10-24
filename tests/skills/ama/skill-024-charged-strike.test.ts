/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #024: Charged Strike (AMA)
 * Gitea Tracking Issue: #178
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { calculateChargedStrikeStats } from '../../../src/common/skills/amazon-javelin-spear.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-024-charged-strike.ts'

describe('[Skill #024] Charged Strike (AMA) — 1.13c Parity (Issue #178 / #972)', () => {
  it('computes pure calculateChargedStrikeStats 1.13c formulas (3+floor(slvl/5) bolts, 5-band lightning + 10%/lvl synergies, 4+0.25*(slvl-1) mana)', () => {
    const c1 = calculateChargedStrikeStats(1)
    expect(c1.boltsCount).toBe(3)
    expect(c1.minDamage).toBe(1)
    expect(c1.maxDamage).toBe(30)
    expect(c1.manaCost).toBe(4)

    const c20 = calculateChargedStrikeStats(20)
    expect(c20.boltsCount).toBe(7)
    expect(c20.minDamage).toBe(1)
    expect(c20.maxDamage).toBe(322)
    expect(c20.manaCost).toBe(8.75)

    const c20Syn = calculateChargedStrikeStats(20, { powerStrike: 20, lightningBolt: 20 })
    expect(c20Syn.maxDamage).toBe(Math.floor((322 * 500) / 100))
  })

  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(24)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(24)
    expect(skillModule.name).toBe("Charged Strike")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(24, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(4)
    expect(r1.manaCost256).toBe(1024)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(256)
    expect(r1.maxElemDmg256).toBe(7680)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(24, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(6)
    expect(r10.manaCost256).toBe(1600)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(256)
    expect(r10.maxElemDmg256).toBe(37376)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(24, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(8)
    expect(r20.manaCost256).toBe(2240)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(256)
    expect(r20.maxElemDmg256).toBe(82432)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(98)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(24)!
    const synId = 34

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(24, 20)
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
    expect(withHardPoints.synergyBonusPct).toBe(200)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(24, 20)
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
      skillId: 24,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(24)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
    // At slvl 20, Charged Strike spawns 3 + floor(20/5) = 7 chargedstrikebolts unconditionally on swing
    expect(outcome?.missilesSpawned.filter(m => m === 'chargedstrikebolt').length).toBe(7)
  })

  it('verifies ClientWorld Layer 4 (Issue #975): #24 Charged Strike spawns 3 + floor(slvl / 5) chargedstrikebolts and attaches lightning overlay', async () => {
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 101, classId: 1, x: 102, y: 100, lifePct: 128, mode: 1 },
    })
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 24, 102, 100, 20)
    const bolts = Array.from(world.units.values()).filter(
      (u) => u.unitType === 'missile' && u.missileKey === 'chargedstrikebolt',
    )
    expect(bolts.length).toBe(7)
    expect(world.getUnit('monster', 101)!.overlays.some((o) => o.token === 'lightning')).toBe(true)
  })
})


