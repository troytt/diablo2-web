/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #025: Plague Javelin (AMA)
 * Gitea Tracking Issue: #179
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { calculatePlagueJavelinStats } from '../../../src/common/skills/amazon-javelin-spear.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-025-plague-javelin.ts'

describe('[Skill #025] Plague Javelin (AMA) — 1.13c Parity (Issue #179 / #972)', () => {
  it('computes pure calculatePlagueJavelinStats 1.13c formulas (75+10*(slvl-1) frames, HitShift=3, +30+9*(slvl-1)% AR, 7+0.5*(slvl-1) mana, plaguejavcloud)', () => {
    const p1 = calculatePlagueJavelinStats(1)
    expect(p1.durationFrames).toBe(75)
    expect(p1.toHitBonusPct).toBe(30)
    expect(p1.castingDelayFrames).toBe(100)
    expect(p1.manaCost).toBe(7)
    expect(p1.trailCloudMissile).toBe('plaguejavcloud')
    expect(p1.hitShift).toBe(3)

    const p20 = calculatePlagueJavelinStats(20)
    expect(p20.durationFrames).toBe(265)
    expect(p20.toHitBonusPct).toBe(201)
    expect(p20.manaCost).toBe(16.5)
  })

  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(25)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(25)
    expect(skillModule.name).toBe("Plague Javelin")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(25, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(7)
    expect(r1.manaCost256).toBe(1792)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(80)
    expect(r1.maxElemDmg256).toBe(128)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(25, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(11)
    expect(r10.manaCost256).toBe(2944)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(608)
    expect(r10.maxElemDmg256).toBe(656)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(25, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(16)
    expect(r20.manaCost256).toBe(4224)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(1824)
    expect(r20.maxElemDmg256).toBe(1872)
    expect(r20.durationFrames).toBe(265)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(100)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(25)!
    const synId = 15

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(25, 20)
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
    statsSoftOnly.setBaseSkillLevel(25, 20)
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
      skillId: 25,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(25)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
    expect(outcome?.missilesSpawned).toContain('plaguejavelin')
    expect(dbg.missilesSpawned).toBeGreaterThanOrEqual(8)
  })

  it('verifies ClientWorld Layer 4 (Issue #975 / #1111): #25 Plague Javelin leaves plaguejavcloud trail and bursts 23 (8 slow + 15 fast) plaguejavcloud on impact', async () => {
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 25, 115, 100, 10)
    const plg = Array.from(world.units.values()).find(
      (u) => u.unitType === 'missile' && u.missileKey === 'plaguejavelin',
    )!
    expect(plg).toBeDefined()
    expect(plg.explosionMissile).toBe('')
    const countClouds = (key: string): number =>
      Array.from(world.units.values()).filter((u) => u.unitType === 'missile' && u.missileKey === key).length
    ;(world as any).stepMissileUnit(plg)
    // 1.13c Missiles.txt plaguejavelin CltSubMissile1 = plaguejavcloud (CltDoFunc=3 trail, Issue #1121),
    // never poisonjavcloud (that trail belongs to poisonjav).
    expect(countClouds('poisonjavcloud')).toBe(0)
    const trailClouds = countClouds('plaguejavcloud')
    expect(trailClouds).toBeGreaterThan(0)
    ;(world as any).triggerMissileImpact(plg, plg.x, plg.y, false)
    expect(countClouds('plaguejavcloud') - trailClouds).toBe(23)
  })

  it('verifies Issue #1297: plaguejavcloud (#221) executes MissCltDoFunc[4] to emit poisonpuff (#141) and uses 60-tick server TTL', async () => {
    const { CANONICAL_113C_MISSILES } = await import('../../../src/common/skills/missiles-data.ts')
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const { tickProjectiles } = await import('../../../src/server/skills/skills.ts')

    const cloudRow = CANONICAL_113C_MISSILES.plaguejavcloud!
    expect(cloudRow.pCltDoFunc).toBe(4)
    expect(cloudRow.param1).toBe(2)
    expect(cloudRow.param2).toBe(4)
    expect(cloudRow.cltParam1).toBe(24)
    expect(cloudRow.cltParam2).toBe(1)
    expect(cloudRow.cltParam3).toBe(6)
    expect(cloudRow.cltSubMissile1).toBe('poisonpuff')
    expect(cloudRow.range).toBe(60)

    const world = new ClientWorld()
    const cloud = (world as any).spawnMissileByKey('plaguejavcloud', 100, 100, 100, 100, {
      ownerType: 'player',
      ownerId: 1,
      sourceSkillId: 25,
      skillLevel: 10,
    })
    let sawPoisonPuff = false
    for (let t = 0; t < 60; t++) {
      ;(world as any).stepMissileUnit(cloud)
      if (
        Array.from(world.units.values()).some(
          (u) => u.unitType === 'missile' && u.missileKey === 'poisonpuff',
        )
      ) {
        sawPoisonPuff = true
      }
    }
    expect(sawPoisonPuff).toBe(true)

    // Server tickProjectiles uses 60-tick TTL for both trail and radial burst plaguejavcloud
    const srvFlight = tickProjectiles(
      [
        {
          skillId: '25',
          x: 100,
          y: 100,
          vx: 12,
          vy: 0,
          damage: 60,
          ttl: 15,
          fromPlayer: true,
          missileType: 'plaguejavelin',
          pierce: false,
        },
      ],
      [],
      { overlap: () => 0 },
    )
    const srvTrailCloud = srvFlight.alive.find((p) => p.missileType === 'plaguejavcloud')!
    expect(srvTrailCloud).toBeDefined()
    expect(srvTrailCloud.ttl).toBe(60)

    const srvExpire = tickProjectiles(
      [
        {
          skillId: '25',
          x: 100,
          y: 100,
          vx: 12,
          vy: 0,
          damage: 60,
          ttl: 0,
          fromPlayer: true,
          missileType: 'plaguejavelin',
          pierce: false,
        },
      ],
      [],
      { overlap: () => 0 },
    )
    const srvBurstClouds = srvExpire.alive.filter((p) => p.missileType === 'plaguejavcloud')
    expect(srvBurstClouds.length).toBeGreaterThanOrEqual(8)
    for (const bc of srvBurstClouds) {
      expect(bc.ttl).toBe(60)
    }
  })
})


