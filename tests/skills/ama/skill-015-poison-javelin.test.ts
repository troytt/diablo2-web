/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #015: Poison Javelin (AMA)
 * Gitea Tracking Issue: #169
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { calculatePoisonJavelinStats } from '../../../src/common/skills/amazon-javelin-spear.ts'
import { getSkillCooldownTicks } from '../../../src/common/skills/missiles-data.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-015-poison-javelin.ts'

describe('[Skill #015] Poison Javelin (AMA) — 1.13c Parity (Issue #169 / #972)', () => {
  it('computes pure calculatePoisonJavelinStats 1.13c formulas (200+50*(slvl-1) frames, 15-frame delay, HitShift=5 poison)', () => {
    expect(getSkillCooldownTicks(15)).toBe(15)

    const p1 = calculatePoisonJavelinStats(1)
    expect(p1.durationFrames).toBe(200)
    expect(p1.castingDelayFrames).toBe(15)
    expect(p1.hitShift).toBe(5)
    expect(p1.manaCost).toBe(4)

    const p20 = calculatePoisonJavelinStats(20)
    expect(p20.durationFrames).toBe(1150)
    expect(p20.castingDelayFrames).toBe(15)
    expect(p20.manaCost).toBe(8.75)
  })

  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(15)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(15)
    expect(skillModule.name).toBe("Poison Javelin")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(15, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(4)
    expect(r1.manaCost256).toBe(1024)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(32)
    expect(r1.maxElemDmg256).toBe(48)
    expect(r1.durationFrames).toBe(200)
    expect(r1.minElemDmg).toBe(25)
    expect(r1.maxElemDmg).toBe(37)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(15, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(6)
    expect(r10.manaCost256).toBe(1600)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(208)
    expect(r10.maxElemDmg256).toBe(232)
    expect(r10.durationFrames).toBe(650)
    expect(r10.minElemDmg).toBe(528)
    expect(r10.maxElemDmg).toBe(589)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(15, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(8)
    expect(r20.manaCost256).toBe(2240)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(592)
    expect(r20.maxElemDmg256).toBe(656)
    expect(r20.durationFrames).toBe(1150)
    expect(r20.minElemDmg).toBe(2659)
    expect(r20.maxElemDmg).toBe(2946)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(15)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(15)!
    const synId = 25

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(15, 20)
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
    expect(withHardPoints.synergyBonusPct).toBe(240)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(15, 20)
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
      skillId: 15,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(15)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
    expect(outcome?.missilesSpawned).toContain('poisonjav')
    expect(dbg.missilesActive.some(m => m.celFile.length > 0)).toBe(true)

    // Throwing javelin ammo consumption (decquant = 1)
    arena.player.weaponItemType = 'jave'
    arena.player.weaponQuantity = 0
    const noAmmo = arena.triggerCast()
    expect(noAmmo?.executed).toBe(false)
    expect(noAmmo?.error).toBe('no_ammo')
  })

  it('verifies ClientWorld Layer 4 (Issue #975): #15 Poison Javelin pierces and emits poisonjavcloud trail', async () => {
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    const caster = world.getUnit('player', 1)!
    // Missiles.txt Pierce=1 only marks poisonjav pierce-capable; actual piercing needs owner
    // STAT_SKILL_PIERCE (166) / STAT_ITEM_PIERCE (156) (D2Game 0x6FD11420, Issue #1117).
    caster.stats.set(166, 100)
    ;(world as any).spawnMissilesForSkill(caster, 15, 115, 100, 10)
    const pjav = Array.from(world.units.values()).find(
      (u) => u.unitType === 'missile' && u.missileKey === 'poisonjav',
    )!
    expect(pjav).toBeDefined()
    expect(pjav.canPierce).toBe(true)
    expect(pjav.pierce).toBe(true)
    ;(world as any).stepMissileUnit(pjav)
    expect(
      Array.from(world.units.values()).some(
        (u) => u.unitType === 'missile' && u.missileKey === 'poisonjavcloud',
      ),
    ).toBe(true)
  })

  it('verifies Issue #1297: poisonjavcloud (#39) executes MissCltDoFunc[4] to emit poisonpuff (#141), trails to monster impact point, and uses 60-tick server TTL', async () => {
    const { CANONICAL_113C_MISSILES } = await import('../../../src/common/skills/missiles-data.ts')
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const { tickProjectiles } = await import('../../../src/server/skills/skills.ts')

    const cloudRow = CANONICAL_113C_MISSILES.poisonjavcloud!
    expect(cloudRow.pCltDoFunc).toBe(4)
    expect(cloudRow.cltParam1).toBe(24)
    expect(cloudRow.cltParam2).toBe(1)
    expect(cloudRow.cltParam3).toBe(6)
    expect(cloudRow.cltSubMissile1).toBe('poisonpuff')
    expect(cloudRow.range).toBe(60)

    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 201, classId: 1, x: 101, y: 100, lifePct: 128, mode: 1 },
    })
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 15, 105, 100, 10)
    const pjav = Array.from(world.units.values()).find(
      (u) => u.unitType === 'missile' && u.missileKey === 'poisonjav',
    )!
    expect(pjav).toBeDefined()
    ;(world as any).stepMissileUnit(pjav)

    const clouds = Array.from(world.units.values()).filter(
      (u) => u.unitType === 'missile' && u.missileKey === 'poisonjavcloud',
    )
    // One trail cloud at launch (100, 100) + one impact trail cloud at hit monster (101, 100)
    expect(clouds.length).toBeGreaterThanOrEqual(2)
    expect(clouds.some((c) => Math.abs(c.x - 101) < 1e-3 && Math.abs(c.y - 100) < 1e-3)).toBe(true)

    // Step one poisonjavcloud through its 60-tick lifetime and verify poisonpuff (#141) is emitted
    const testCloud = clouds[0]!
    let sawPoisonPuff = false
    for (let t = 0; t < 60; t++) {
      ;(world as any).stepMissileUnit(testCloud)
      if (
        Array.from(world.units.values()).some(
          (u) => u.unitType === 'missile' && u.missileKey === 'poisonpuff',
        )
      ) {
        sawPoisonPuff = true
      }
    }
    expect(sawPoisonPuff).toBe(true)

    // Server tickProjectiles uses 60-tick TTL for poisonjavcloud
    const srvOut = tickProjectiles(
      [
        {
          skillId: '15',
          x: 100,
          y: 100,
          vx: 12,
          vy: 0,
          damage: 30,
          ttl: 25,
          fromPlayer: true,
          missileType: 'poisonjav',
          pierce: false,
        },
      ],
      [],
      { overlap: () => 0 },
    )
    const srvCloud = srvOut.alive.find((p) => p.missileType === 'poisonjavcloud')!
    expect(srvCloud).toBeDefined()
    expect(srvCloud.ttl).toBe(60)
  })
})


