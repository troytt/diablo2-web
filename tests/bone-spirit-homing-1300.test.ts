/**
 * Regression tests for Issue #1300:
 * Necromancer Bone Spirit (#93) & MonBoneSpirit (#211) target acquisition and
 * `MISSMODE_SrvDo07` (`0x6FC59DC0`) / `MISSMODE_CltDo07` (`0x6FB62EB0`) homing.
 */

import { describe, expect, it } from 'vitest'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { tickProjectiles, type Projectile } from '../src/server/skills/skills.ts'

function getActiveMissiles(world: ClientWorld): ClientUnit[] {
  const out: ClientUnit[] = []
  for (const u of (world as any)._units.values() as Iterable<ClientUnit>) {
    if (u.unitType === 'missile') out.push(u)
  }
  return out
}

describe('Issue #1300: Necromancer Bone Spirit (#93) Homing', () => {
  it('preserves selfUnit.targetUnit across server SkillCast coordinate echoes during local cast wind-up', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const self = (world as any).ensureUnit('player', 1) as ClientUnit
    self.x = 100
    self.y = 100
    ;(world as any)._self.x = 100
    ;(world as any)._self.y = 100
    ;(world as any)._self.rightSkill = 93

    const monster = new ClientUnit({
      unitType: 'monster',
      id: 701,
      classId: 0,
      x: 112,
      y: 108,
      mode: 1,
      direction: 0,
    })
    ;(world as any)._units.set(monster.key, monster)
    ;(world as any)._monsters.set(monster.id, monster)

    world.noteOutgoingCommand(
      {
        type: 'SkillOn',
        hand: 'right',
        target: { unitType: 1, id: 701 },
        shift: false,
        hold: false,
      },
      1000,
    )
    expect(self.targetUnit).toEqual({ unitType: 1, id: 701 })

    // Server echoes back a coordinate-based SkillCast before the action frame completes:
    world.applyEvent(
      {
        type: 'SkillCast',
        caster: { unitType: 0, id: 1 },
        skill: 93,
        level: 5,
        target: { x: 112, y: 108 },
      } as any,
      1040,
    )
    expect(self.targetUnit).toEqual({ unitType: 1, id: 701 })
  })

  it('acquires nearby hostile monster at cast location and re-acquires within Param2=15 sub-tiles if target dies mid-flight', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const self = (world as any).ensureUnit('player', 1) as ClientUnit
    self.x = 100
    self.y = 100

    const primary = new ClientUnit({
      unitType: 'monster',
      id: 801,
      classId: 0,
      x: 110,
      y: 100,
      mode: 1,
      direction: 0,
    })
    const secondary = new ClientUnit({
      unitType: 'monster',
      id: 802,
      classId: 0,
      x: 108,
      y: 110,
      mode: 1,
      direction: 0,
    })
    ;(world as any)._units.set(primary.key, primary)
    ;(world as any)._monsters.set(primary.id, primary)
    ;(world as any)._units.set(secondary.key, secondary)
    ;(world as any)._monsters.set(secondary.id, secondary)

    // Cast aimed slightly near primary monster (112, 101) without targetUnit set on caster:
    self.targetUnit = undefined
    ;(world as any).spawnMissilesForSkill(self, 93, 112, 101, 5)
    const spirit = getActiveMissiles(world)[0]!
    expect(spirit.missileKey).toBe('bonespirit')
    expect(spirit.homingTarget).toEqual({ unitType: 'monster', id: 801 })

    // Primary monster dies before tick 5; Bone Spirit re-acquires secondary monster within 15 sub-tiles on tick 5:
    primary.dead = true
    primary.mode = 12
    for (let t = 0; t < 6; t++) {
      ;(world as any).stepDiscreteSimulationTick()
    }
    expect(spirit.homingTarget).toEqual({ unitType: 'monster', id: 802 })
    expect(spirit.vy).toBeGreaterThan(0)
  })

  it('steers server Bone Spirit directly toward living hostile targets without orbiting', () => {
    const proj: Projectile = {
      skillId: '93',
      missileType: 'bonespirit',
      x: 100,
      y: 100,
      vx: 12,
      vy: 0,
      damage: 120,
      ttl: 128,
      fromPlayer: true,
      homing: true,
    }
    const outcome = tickProjectiles(
      [proj],
      [{ index: 0, x: 100, y: 200, radius: 12, alive: true }],
      { overlap: () => 0 },
    )
    expect(outcome.alive).toHaveLength(1)
    const stepped = outcome.alive[0]!
    expect(Math.abs(stepped.vx)).toBeLessThan(1e-5)
    expect(stepped.vy).toBeCloseTo(12, 4)
  })
})
