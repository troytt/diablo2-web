/**
 * Regression tests for Issue #1292:
 * Amazon Guided Arrow (#22) `MISSMODE_SrvDo07` (`0x6FC59DC0`) / `MISSMODE_CltDo07` (`0x6FB62EB0`)
 * homing and first-hit termination (`CollideKill=1`, `Pierce=0`, no pass-through).
 */

import { describe, expect, it } from 'vitest'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { tickProjectiles, type Projectile } from '../src/server/skills/skills.ts'

function getActiveGuidedArrows(world: ClientWorld): ClientUnit[] {
  const out: ClientUnit[] = []
  for (const u of (world as any)._units.values() as Iterable<ClientUnit>) {
    if (u.unitType === 'missile' && u.missileKey === 'guidedarrow') out.push(u)
  }
  return out
}

describe('Issue #1292: Amazon Guided Arrow (#22) Homing & Collision Termination', () => {
  it('locks onto nearest living hostile monster, homes in on 5-frame cadence, ignores corpses, and terminates on hit', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const self = (world as any).ensureUnit('player', 1) as ClientUnit
    self.x = 100
    self.y = 100

    // Dead corpse in the initial line of fire should be ignored by both homing and collision:
    const corpse = new ClientUnit({
      unitType: 'monster',
      id: 901,
      classId: 0,
      x: 105,
      y: 100,
      mode: 12,
      direction: 0,
    })
    corpse.dead = false // test mode === 12 corpse guard even if dead flag wasn't set
    corpse.lifePct = 0

    // Living hostile monster off-axis at (110, 108):
    const target = new ClientUnit({
      unitType: 'monster',
      id: 902,
      classId: 0,
      x: 110,
      y: 108,
      mode: 1,
      direction: 0,
    })
    ;(world as any)._units.set(corpse.key, corpse)
    ;(world as any)._monsters.set(corpse.id, corpse)
    ;(world as any)._units.set(target.key, target)
    ;(world as any)._monsters.set(target.id, target)

    // Fire Guided Arrow horizontally toward (115, 100) without explicit targetUnit:
    self.targetUnit = undefined
    ;(world as any).spawnMissilesForSkill(self, 22, 115, 100, 5)
    const arrows = getActiveGuidedArrows(world)
    expect(arrows).toHaveLength(1)
    const arrow = arrows[0]!
    expect(arrow.pierce).toBe(false)
    expect(arrow.homingTarget).toEqual({ unitType: 'monster', id: 902 })

    // Step simulation ticks: arrow steers toward (110, 108), hits target 902, and terminates (removed from world):
    let hitAndTerminated = false
    for (let t = 0; t < 25; t++) {
      ;(world as any).stepDiscreteSimulationTick()
      if (getActiveGuidedArrows(world).length === 0) {
        hitAndTerminated = true
        break
      }
    }
    expect(hitAndTerminated).toBe(true)
    expect(arrow.hitUnitIds?.has(902)).toBe(true)
    expect(arrow.hitUnitIds?.has(901)).toBe(false)
  })

  it('steers server Guided Arrow directly into off-axis target and terminates on first hit without passing through', () => {
    let projectiles: readonly Projectile[] = [
      {
        skillId: '22',
        missileType: 'guidedarrow',
        x: 100,
        y: 100,
        vx: 24,
        vy: 0,
        damage: 85,
        ttl: 128,
        fromPlayer: true,
        homing: true,
        pierce: false,
        pierceChancePct: 0,
      },
    ]
    const target = { index: 0, x: 140, y: 150, radius: 10, alive: true }
    let totalHits = 0
    for (let t = 0; t < 10 && projectiles.length > 0; t++) {
      const outcome = tickProjectiles(projectiles, [target], { overlap: () => 0 })
      totalHits += outcome.hits.length
      projectiles = outcome.alive
    }
    expect(totalHits).toBe(1)
    expect(projectiles).toHaveLength(0)
  })

  it('Issue #1306: calculates Pierce (#33 / item_pierce) on Guided Arrow (#22), piercing and homing onto subsequent or same targets up to 4 pierces', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const self = (world as any).ensureUnit('player', 1) as ClientUnit
    self.x = 100
    self.y = 100
    // Grant 100% pierce (e.g. Pierce #33 + Razortail item_pierce stat 156):
    self.stats.set(166, 86) // STAT_SKILL_PIERCE
    self.stats.set(156, 33) // STAT_ITEM_PIERCE -> total 100% -> 4 pierces (5 total hits)

    const m1 = new ClientUnit({
      unitType: 'monster',
      id: 911,
      classId: 0,
      x: 106,
      y: 100,
      mode: 1,
      direction: 0,
    })
    const m2 = new ClientUnit({
      unitType: 'monster',
      id: 912,
      classId: 0,
      x: 112,
      y: 103,
      mode: 1,
      direction: 0,
    })
    ;(world as any)._units.set(m1.key, m1)
    ;(world as any)._monsters.set(m1.id, m1)
    ;(world as any)._units.set(m2.key, m2)
    ;(world as any)._monsters.set(m2.id, m2)

    self.targetUnit = undefined
    ;(world as any).spawnMissilesForSkill(self, 22, 115, 100, 10)
    const arrows = getActiveGuidedArrows(world)
    expect(arrows).toHaveLength(1)
    const arrow = arrows[0]!
    expect(arrow.canPierce).toBe(true)
    expect(arrow.pierce).toBe(true)
    expect(arrow.pierceRemaining).toBe(4)

    // Step simulation ticks: arrow hits m1, pierces (does not disappear!), switches homing to m2, hits m2, and continues piercing up to 4 pierces (5 hits total)
    for (let t = 0; t < 45; t++) {
      ;(world as any).stepDiscreteSimulationTick()
      if (getActiveGuidedArrows(world).length === 0) break
    }
    expect(arrow.hitUnitIds?.has(911)).toBe(true)
    expect(arrow.hitUnitIds?.has(912)).toBe(true)
    expect(arrow.pierceCount).toBe(5)
    expect(arrow.pierceRemaining).toBe(0)
    expect(getActiveGuidedArrows(world)).toHaveLength(0)
  })

  it('Issue #1306: server tickProjectiles calculates pierce on Guided Arrow and pierces up to maxPierceCount', () => {
    let projectiles: readonly Projectile[] = [
      {
        skillId: '22',
        missileType: 'guidedarrow',
        x: 100,
        y: 100,
        vx: 24,
        vy: 0,
        damage: 90,
        ttl: 128,
        fromPlayer: true,
        homing: true,
        pierce: true,
        pierceChancePct: 100,
        maxPierceCount: 2,
      },
    ]
    const t1 = { index: 0, x: 120, y: 100, radius: 10, alive: true }
    const t2 = { index: 1, x: 165, y: 115, radius: 10, alive: true }
    let totalHits = 0
    const hitTargetIndices: number[] = []
    for (let t = 0; t < 35 && projectiles.length > 0; t++) {
      const outcome = tickProjectiles(projectiles, [t1, t2], { overlap: () => 0 })
      for (const h of outcome.hits) {
        totalHits += 1
        hitTargetIndices.push(h.targetIndex)
      }
      projectiles = outcome.alive
    }
    // 2 pierces = 3 total hits before disappearing
    expect(totalHits).toBe(3)
    expect(hitTargetIndices).toContain(0)
    expect(hitTargetIndices).toContain(1)
    expect(projectiles).toHaveLength(0)
  })
})
