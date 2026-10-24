/**
 * Regression tests for Issue #1421:
 * 1.13c Missile Velocity (`Vel + trunc(VelLev * lvl / 8)`), `MaxVel`, `Accel`,
 * global 75% velocity multiplier (`D2Game.dll` `0x6FC8FAA3`), one-time creation
 * `Slow Missiles` scaling (`0x6FC8FA54`), and `Range + LevRange * lvl + SubLoop` (`0x6FC8FC75`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import type { D2DataRegistry } from '../src/common/data/data-registry.ts'
import type { CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { computeEffectiveMonsterMissileSpeed, type Monster } from '../src/server/ai/monster-ai.ts'

function createUnit(
  registry: D2DataRegistry,
  id: string,
  unitType: CombatUnitContext['unitType'] = 'player',
): CombatUnitContext {
  const statList = new UnitStatList(registry, {})
  statList.setBaseStat('maxhp', 1000 * FIXED_ONE)
  statList.setHp256(1000 * FIXED_ONE)
  const stateBus = new StateBus(statList, registry)
  return {
    id,
    name: id,
    unitType,
    statList,
    stateBus,
    x: 0,
    y: 0,
  }
}

describe('Issue #1421: 1.13c Missile Velocity, MaxVel, Accel, 75% Factor, Slow Missiles & Range/SubLoop', () => {
  it('1. nova (Vel=24, MaxVel=24, Accel=-1000) starts at 75% velocity (18 px/tick) and decelerates each frame via Accel', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('nova')!
    expect(rec.vel).toBe(24)
    expect(rec.maxVel).toBe(24)
    expect(rec.accel).toBe(-1000)

    const engine = new MissileEngine(registry)
    const owner = createUnit(registry, 'sorc')
    const bolts = engine.spawnNovaRing({
      sourceSkillId: 48,
      slvl: 1,
      owner,
      startX: 0,
      startY: 0,
      dmgPacket: {
        skillId: 48,
        attackKind: 'spell',
        elemType: 'ltng',
        autoHit: true,
        elemMin256: 256,
        elemMax256: 512,
      },
    })
    expect(bolts).toHaveLength(64)

    // Bolt 0 fires along angle = 0 (+X axis)
    const eastBolt = bolts[0]!
    // 1.13c 0x6FC8FA15..0x6FC8FAB8: ((24 << 8) * 75) / 100 = 4608 (18 px/tick)
    expect(eastBolt.vel256).toBe(4608)
    expect(eastBolt.speed).toBe(18)
    expect(eastBolt.vx).toBeCloseTo(18, 6)
    expect(eastBolt.vy).toBeCloseTo(0, 6)

    // Step frame 1: PATH_StepVelocity (0x6FD5CEB0) adds Accel = -1000 -> vel256 = 3608 (14.09375 px/tick)
    engine.tick(1)
    expect(eastBolt.vel256).toBe(3608)
    expect(eastBolt.speed).toBeCloseTo(3608 / 256, 6)
    expect(eastBolt.vx).toBeCloseTo(3608 / 256, 6)
    const dx1 = eastBolt.x

    // Step frame 2: vel256 = 2608 (10.1875 px/tick), step delta strictly decreases
    const prevX = eastBolt.x
    engine.tick(2)
    const dx2 = eastBolt.x - prevX
    expect(eastBolt.vel256).toBe(2608)
    expect(dx2).toBeLessThan(dx1)

    // Step frames 3..6: velocity clamps at 0 and never goes negative (0x6FD5CED1)
    for (let t = 3; t <= 6; t++) {
      engine.tick(t)
    }
    expect(eastBolt.vel256).toBe(0)
    expect(eastBolt.speed).toBe(0)
  })

  it('2. blessedhammer (Vel=18, MaxVel=30, Accel=250) accelerates from initial 75% velocity (13.5) up to MaxVel=30 cap', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('blessedhammer')!
    expect(rec.vel).toBe(18)
    expect(rec.maxVel).toBe(30)
    expect(rec.accel).toBe(250)

    const engine = new MissileEngine(registry)
    const owner = createUnit(registry, 'paladin')
    const hammer = engine.spawnMissile({
      missileNameOrId: 'blessedhammer',
      sourceSkillId: 112,
      slvl: 1,
      owner,
      startX: 100,
      startY: 100,
      targetX: 200,
      targetY: 100,
    })!

    // Initial velocity: trunc(((18 << 8) * 75) / 100) = 3456 (13.5 px/tick), maxVel256 = 30 << 8 = 7680
    expect(hammer.vel256).toBe(3456)
    expect(hammer.speed).toBe(13.5)
    expect(hammer.maxVel256).toBe(30 << 8)

    // Tick 1: 3456 + 250 = 3706
    engine.tick(1)
    expect(hammer.vel256).toBe(3706)
    expect(hammer.speed).toBeCloseTo(3706 / 256, 6)
    expect(Math.hypot(hammer.vx, hammer.vy)).toBeCloseTo(3706 / 256, 5)

    // Tick 2..25: accelerates by +250/frame and clamps at MaxVel = 30 (7680)
    for (let t = 2; t <= 25; t++) {
      engine.tick(t)
      expect(hammer.vel256).toBeLessThanOrEqual(30 << 8)
      expect(hammer.speed).toBeLessThanOrEqual(30)
    }
    expect(hammer.vel256).toBe(30 << 8)
    expect(hammer.speed).toBe(30)
    expect(Math.hypot(hammer.vx, hammer.vy)).toBeCloseTo(30, 5)
  })

  it('3. moltenboulder (Vel=4, MaxVel=4) uses Missiles.txt Vel=4 (scaled by 75% to 3 px/tick) without Math.max(8, ...) floor, and VelLev scales by trunc(VelLev * slvl / 8)', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('moltenboulder')!
    expect(rec.vel).toBe(4)
    expect(rec.maxVel).toBe(4)

    const engine = new MissileEngine(registry)
    const owner = createUnit(registry, 'druid')
    const boulder = engine.spawnMissile({
      missileNameOrId: 'moltenboulder',
      sourceSkillId: 229,
      slvl: 1,
      owner,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
    })!

    // 1.13c 0x6FC8FA34 & 0x6FC8FAA3: ((4 << 8) * 75) / 100 = 768 (3 px/tick, NOT clamped to >= 8)
    expect(boulder.vel256).toBe(768)
    expect(boulder.speed).toBe(3)
    expect(boulder.vx).toBe(3)
    expect(boulder.vy).toBe(0)

    engine.tick(1)
    expect(boulder.x).toBe(3)

    // Also verify VelLev scaling: spidergoohat (or synthetic VelLev missile via panick)
    // In Missiles.txt, missiles with VelLev != 0 scale by Vel + trunc((VelLev * slvl) / 8)
    const velLevMissile = Array.from({ length: 700 }, (_, id) => registry.getMissileById(id)).find(
      (m) => m !== undefined && m.vel > 0 && m.velLev !== 0,
    )
    if (velLevMissile) {
      const mLvl8 = engine.spawnMissile({
        missileNameOrId: velLevMissile.id,
        sourceSkillId: 0,
        slvl: 8,
        owner,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
      })!
      const expectedRawVel = velLevMissile.vel + Math.trunc((velLevMissile.velLev * 8) / 8)
      const expectedVel256 = Math.trunc(((expectedRawVel << 8) * 75) / 100)
      expect(mLvl8.vel256).toBe(expectedVel256)
    }
  })

  it('4. firewallmaker range uses Range + LevRange * slvl (lvl 1 -> 9 frames, lvl 5 -> 17 frames)', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('firewallmaker')!
    expect(rec.range).toBe(7)
    expect(rec.levRange).toBe(2)

    const engine = new MissileEngine(registry)
    const owner = createUnit(registry, 'sorc')

    const mLvl1 = engine.spawnMissile({
      missileNameOrId: 'firewallmaker',
      sourceSkillId: 51,
      slvl: 1,
      owner,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
    })!
    // 1.13c 0x6FC8FC7D..0x6FC8FC94: Range + slvl * LevRange = 7 + 1 * 2 = 9 (not 7 + 0 * 2 = 7)
    expect(mLvl1.maxRangeTicks).toBe(9)

    const mLvl5 = engine.spawnMissile({
      missileNameOrId: 'firewallmaker',
      sourceSkillId: 51,
      slvl: 5,
      owner,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
    })!
    // 7 + 5 * 2 = 17
    expect(mLvl5.maxRangeTicks).toBe(17)
  })

  it('5. SubLoop missiles add (SubStop - SubStart) * loops to range when loops > 0 (0x6FC8FC90)', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('firewall')!
    expect(rec.subLoop).toBe(true)
    expect(rec.subStart).toBe(12)
    expect(rec.subStop).toBe(36)
    expect(rec.range).toBe(90)

    const engine = new MissileEngine(registry)
    const owner = createUnit(registry, 'sorc')

    const baseWall = engine.spawnMissile({
      missileNameOrId: 'firewall',
      sourceSkillId: 51,
      slvl: 1,
      owner,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
    })!
    expect(baseWall.maxRangeTicks).toBe(90)

    const loopedWall = engine.spawnMissile({
      missileNameOrId: 'firewall',
      sourceSkillId: 51,
      slvl: 1,
      owner,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      loops: 3,
    })!
    // 90 + (36 - 12) * 3 = 90 + 72 = 162
    expect(loopedWall.maxRangeTicks).toBe(90 + (36 - 12) * 3)
  })

  it('6. Slow Missiles applies once at missile creation via state 87 skill_handofathena; clearing slowmissiles mid-flight does not restore speed', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('fireball')!
    expect(rec.canSlow).toBe(true)
    expect(rec.vel).toBe(20)

    const engine = new MissileEngine(registry)
    const owner = createUnit(registry, 'archer', 'monster')

    // Apply Slow Missiles state (state 87) with skill_handofathena = 33
    owner.stateBus!.applyState({
      stateNameOrId: 'slowmissiles',
      curseTypeOverride: 0,
      durationFrames: 300,
      stats: { skill_handofathena: 33 },
    })

    const mSlowed = engine.spawnMissile({
      missileNameOrId: 'fireball',
      sourceSkillId: 47,
      slvl: 1,
      owner,
      startX: 0,
      startY: 0,
      targetX: 500,
      targetY: 0,
    })!

    // 1.13c 0x6FC8FA54..0x6FC8FAB8:
    // vel256 = 20 << 8 = 5120
    // after Slow Missiles (33%): trunc((5120 * 33) / 100) = 1689
    // after global 75%: trunc((1689 * 75) / 100) = 1266
    const expectedSlowVel256 = Math.trunc((Math.trunc(((20 << 8) * 33) / 100) * 75) / 100)
    expect(mSlowed.vel256).toBe(expectedSlowVel256)
    expect(mSlowed.vx).toBeCloseTo(expectedSlowVel256 / 256, 6)

    // Tick 1 while owner still has slowmissiles
    engine.tick(1)
    const step1Dx = mSlowed.x
    expect(step1Dx).toBeCloseTo(expectedSlowVel256 / 256, 6)

    // Remove slowmissiles state from owner mid-flight
    owner.stateBus!.removeState('slowmissiles')
    expect(owner.stateBus!.hasState('slowmissiles')).toBe(false)
    expect(owner.statList.getAccruedStat('skill_handofathena')).toBe(0)

    // Tick 2 after owner lost slowmissiles: already-spawned missile MUST retain its creation-time slowed speed
    const prevX = mSlowed.x
    engine.tick(2)
    const step2Dx = mSlowed.x - prevX
    expect(step2Dx).toBeCloseTo(step1Dx, 6)
    expect(mSlowed.vel256).toBe(expectedSlowVel256)

    // Also verify computeEffectiveMonsterMissileSpeed reads skill_handofathena from stateBus without hardcoded 0.33
    const monsterWithState = {
      id: 1,
      stateBus: owner.stateBus,
      statList: owner.statList,
    } as unknown as Monster
    owner.stateBus!.applyState({
      stateNameOrId: 'slowmissiles',
      curseTypeOverride: 0,
      durationFrames: 300,
      stats: { skill_handofathena: 50 },
    })
    expect(computeEffectiveMonsterMissileSpeed(monsterWithState, 20, true)).toBe(10)
    expect(computeEffectiveMonsterMissileSpeed(monsterWithState, 20, false)).toBe(20)
  })
})
