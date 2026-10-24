/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #035: Lightning Fury (AMA)
 * Gitea Tracking Issue: #189
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { calculateLightningFuryStats } from '../../../src/common/skills/amazon-javelin-spear.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-035-lightning-fury.ts'

describe('[Skill #035] Lightning Fury (AMA) — 1.13c Parity (Issue #189 / #972)', () => {
  it('computes pure calculateLightningFuryStats 1.13c formulas (2+(slvl-1) release bolts, 15-subtile radius, furylightning sub-missile, 10+0.5*(slvl-1) mana)', () => {
    const f1 = calculateLightningFuryStats(1)
    expect(f1.releaseBoltsCount).toBe(2)
    expect(f1.searchRadiusSubtiles).toBe(15)
    expect(f1.subMissileName).toBe('furylightning')
    expect(f1.minDamage).toBe(1)
    expect(f1.maxDamage).toBe(40)
    expect(f1.manaCost).toBe(10)

    const f20 = calculateLightningFuryStats(20)
    expect(f20.releaseBoltsCount).toBe(21)
    expect(f20.searchRadiusSubtiles).toBe(15)
    expect(f20.minDamage).toBe(1)
    expect(f20.maxDamage).toBe(580)
    expect(f20.manaCost).toBe(19.5)
  })

  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(35)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(35)
    expect(skillModule.name).toBe("Lightning Fury")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(35, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(10)
    expect(r1.manaCost256).toBe(2560)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(256)
    expect(r1.maxElemDmg256).toBe(10240)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(35, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(14)
    expect(r10.manaCost256).toBe(3712)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(256)
    expect(r10.maxElemDmg256).toBe(61440)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(35, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(19)
    expect(r20.manaCost256).toBe(4992)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(256)
    expect(r20.maxElemDmg256).toBe(148480)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(15)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(35)!
    const synId = 24

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(35, 20)
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
    expect(withHardPoints.synergyBonusPct).toBe(20)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(35, 20)
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
      skillId: 35,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(35)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
    // Primary lightningfury javelin hits dummy and spawns furylightning bolts toward all enemies in 15 subtiles (300px)
    expect(outcome?.missilesSpawned).toContain('lightningfury')
    expect(dbg.missilesSpawned).toBeGreaterThanOrEqual(2)
  })

  it('verifies ClientWorld Layer 4 (Issue #975): #35 Lightning Fury spawns up to 1 + slvl piercing furylightning bolts toward hostile monsters within 15 subtiles', async () => {
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 101, classId: 1, x: 105, y: 100, lifePct: 128, mode: 1 },
    })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 102, classId: 1, x: 112, y: 100, lifePct: 128, mode: 1 },
    })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 103, classId: 1, x: 118, y: 100, lifePct: 128, mode: 1 },
    })
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 35, 105, 100, 1) // slvl 1 -> maxBolts = 2
    const lf = Array.from(world.units.values()).find(
      (u) => u.unitType === 'missile' && u.missileKey === 'lightningfury',
    )!
    ;(world as any).triggerMissileImpact(lf, 105, 100, false, world.getUnit('monster', 101)!)
    const furyBolts = Array.from(world.units.values()).filter(
      (u) => u.unitType === 'missile' && u.missileKey === 'furylightning',
    )
    expect(furyBolts.length).toBe(2)
    expect(furyBolts.every((b) => b.pierce === true)).toBe(true)
  })
})


