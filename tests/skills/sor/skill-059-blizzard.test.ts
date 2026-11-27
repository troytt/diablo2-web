/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #059: Blizzard (SOR)
 * Gitea Tracking Issue: #213 / #400
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-059-blizzard.ts'
import {
  calculateSkillDamage,
  calculateBlizzardDamage,
  tickProjectiles,
  CANONICAL_113C_MISSILES,
  type Projectile,
} from '../../../src/server/skills/skills.ts'

describe('[Skill #059] Blizzard (SOR) — 1.13c Parity (Issue #213 / #400)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(59)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(59)
    expect(skillModule.name).toBe("Blizzard")
    expect(skillModule.charClass).toBe("sor")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(59, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(23)
    expect(r1.manaCost256).toBe(5888)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(11520)
    expect(r1.maxElemDmg256).toBe(19200)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(59, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(32)
    expect(r10.manaCost256).toBe(8192)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(53760)
    expect(r10.maxElemDmg256).toBe(63744)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(59, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(42)
    expect(r20.manaCost256).toBe(10752)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(145920)
    expect(r20.maxElemDmg256).toBe(158464)
    expect(r20.durationFrames).toBe(100)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(45)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(59)!
    const synId = 39

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(59, 20)
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
    expect(withHardPoints.synergyBonusPct).toBe(100)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(59, 20)
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
      classCode: "sor",
      skillId: 59,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(59)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('calculateSkillDamage routes Skill 59 and evaluates exact 1.13c damage ranges at slvl 1, 10, 20', () => {
    // slvl 1: { min: 45, max: 75 }
    const d1 = calculateSkillDamage(59, 1)
    expect(d1).toEqual({ min: 45, max: 75 })

    // slvl 10: { min: 210, max: 249 }
    const d10 = calculateSkillDamage(59, 10)
    expect(d10).toEqual({ min: 210, max: 249 })

    // slvl 20: { min: 570, max: 619 }
    const d20 = calculateSkillDamage(59, 20)
    expect(d20).toEqual({ min: 570, max: 619 })

    // String skill ID routing
    expect(calculateSkillDamage('59', 1)).toEqual({ min: 45, max: 75 })
    expect(calculateSkillDamage('blizzard', 20)).toEqual({ min: 570, max: 619 })

    // Synergy integration via multiplier and synergy object
    expect(calculateSkillDamage(59, 20, 2.0)).toEqual({ min: 1140, max: 1238 })
    expect(calculateSkillDamage(59, 20, { iceBolt: 20 })).toEqual({ min: 1140, max: 1238 })
  })

  it('blizzardcenter missile and falling shards scale with slvl and do not default to 45', () => {
    const openTerrain = { overlap: () => 0 }

    // Case A: slvl = 1 -> damage range { 45, 75 } -> average 60
    const dmgRange1 = calculateSkillDamage(59, 1)
    const avgDamage1 = Math.round((dmgRange1.min + dmgRange1.max) / 2)
    expect(avgDamage1).toBe(60)

    const centerL1: Projectile = {
      skillId: '59',
      x: 200,
      y: 200,
      vx: 0,
      vy: 0,
      damage: avgDamage1,
      ttl: 100,
      fromPlayer: true,
      missileType: 'blizzardcenter',
      subMissileIdx: 0,
      ageTicks: 3, // next tick will be tick 4 -> emit shard
    }

    const outcomeL1 = tickProjectiles([centerL1], [], openTerrain)
    expect(outcomeL1.spawnedProjectiles).toBeDefined()
    expect(outcomeL1.spawnedProjectiles!.length).toBe(1)
    const shardL1 = outcomeL1.spawnedProjectiles![0]!
    expect(shardL1.damage).toBe(60)
    expect(shardL1.damage).not.toBe(45)

    // Case B: slvl = 20 -> damage range { 570, 619 } -> average 595
    const dmgRange20 = calculateSkillDamage(59, 20)
    const avgDamage20 = Math.round((dmgRange20.min + dmgRange20.max) / 2)
    expect(avgDamage20).toBe(595)

    const centerL20: Projectile = {
      skillId: '59',
      x: 200,
      y: 200,
      vx: 0,
      vy: 0,
      damage: avgDamage20,
      ttl: 100,
      fromPlayer: true,
      missileType: 'blizzardcenter',
      subMissileIdx: 0,
      ageTicks: 3, // next tick will be tick 4 -> emit shard
    }

    const outcomeL20 = tickProjectiles([centerL20], [], openTerrain)
    expect(outcomeL20.spawnedProjectiles).toBeDefined()
    expect(outcomeL20.spawnedProjectiles!.length).toBe(1)
    const shardL20 = outcomeL20.spawnedProjectiles![0]!
    expect(shardL20.damage).toBe(595)
    expect(shardL20.damage).not.toBe(45)

    // Shard expiry ground explosion inherits shard damage
    const expiringShard: Projectile = {
      skillId: '59',
      x: 200,
      y: 200,
      vx: 0,
      vy: 0,
      altitude: 0,
      damage: 595,
      ttl: 0,
      fromPlayer: true,
      missileType: 'blizzard1',
    }
    const expOutcome = tickProjectiles([expiringShard], [], openTerrain)
    expect(expOutcome.spawnedProjectiles?.length).toBe(1)
    expect(expOutcome.spawnedProjectiles![0]!.damage).toBe(595)
  })

  it('CANONICAL_113C_MISSILES blizzardexplode3 matches Missiles.txt celFile icestormimpactvar02', () => {
    expect(CANONICAL_113C_MISSILES.blizzardexplode3.celFile).toBe('icestormimpactvar02')
  })
})
