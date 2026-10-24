/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #034: Lightning Strike (AMA)
 * Gitea Tracking Issue: #188
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { calculateLightningStrikeStats } from '../../../src/common/skills/amazon-javelin-spear.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-034-lightning-strike.ts'

describe('[Skill #034] Lightning Strike (AMA) — 1.13c Parity (Issue #188 / #972)', () => {
  it('computes pure calculateLightningStrikeStats 1.13c formulas (2+(slvl-1) hops, 20-subtile radius, 5-band lightning + 8%/lvl synergies, 9 mana)', () => {
    const l1 = calculateLightningStrikeStats(1)
    expect(l1.chainHops).toBe(2)
    expect(l1.searchRadiusSubtiles).toBe(20)
    expect(l1.minDamage).toBe(1)
    expect(l1.maxDamage).toBe(25)
    expect(l1.manaCost).toBe(9)

    const l20 = calculateLightningStrikeStats(20)
    expect(l20.chainHops).toBe(21)
    expect(l20.searchRadiusSubtiles).toBe(20)
    expect(l20.minDamage).toBe(1)
    expect(l20.maxDamage).toBe(295)
    expect(l20.manaCost).toBe(9)
  })

  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(34)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(34)
    expect(skillModule.name).toBe("Lightning Strike")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(34, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(9)
    expect(r1.manaCost256).toBe(2304)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(256)
    expect(r1.maxElemDmg256).toBe(6400)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(34, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(9)
    expect(r10.manaCost256).toBe(2304)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(256)
    expect(r10.maxElemDmg256).toBe(32000)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(34, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(9)
    expect(r20.manaCost256).toBe(2304)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(256)
    expect(r20.maxElemDmg256).toBe(75520)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(20)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(34)!
    const synId = 24

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(34, 20)
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
    expect(withHardPoints.synergyBonusPct).toBe(160)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(34, 20)
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
      skillId: 34,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(34)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
    expect(outcome?.missilesSpawned).toContain('lightningstrike')
    expect(dbg.totalDamageDealt).toBeGreaterThan(0)
  })

  it('verifies ClientWorld Layer 4 (Issue #975): #34 Lightning Strike bounces within 20 subtiles for 1 + slvl hits and attaches lightning overlay', async () => {
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 101, classId: 1, x: 102, y: 100, lifePct: 128, mode: 1 },
    })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 102, classId: 1, x: 120, y: 100, lifePct: 128, mode: 1 },
    })
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 34, 102, 100, 1)
    expect(world.getUnit('monster', 101)!.overlays.some((o) => o.token === 'lightning')).toBe(true)
    const ls = Array.from(world.units.values()).find(
      (u) => u.unitType === 'missile' && u.missileKey === 'lightningstrike',
    )!
    expect(ls).toBeDefined()
    ls.hitUnitIds = new Set([101])
    ;(world as any).triggerMissileImpact(ls, 102, 100, false, world.getUnit('monster', 101)!)
    // Monster 102 is 18 subtiles away (<= 20), so ls bounces to it
    expect(ls.pierce).toBe(true)
    ls.hitUnitIds.add(102)
    ;(world as any).triggerMissileImpact(ls, 120, 100, false, world.getUnit('monster', 102)!)
    // At slvl 1, maxHits = 1 + 1 = 2, so pierce is now false
    expect(ls.pierce).toBe(false)
  })
})


