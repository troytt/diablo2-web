/**
 * Issue #1502: client missile-vs-unit collision uses the 1.13c `Missiles.txt` `Size` footprint
 * (`D2Common.#10389` @ `0x6FDCF6A0`, 9-case jump table @ `0x6FDCF8E8`) against the target's sub-tile
 * `SizeX`, shared with the server, instead of a fixed 1.75 (2.25 for guided arrow) sub-tile radius.
 */

import { describe, expect, it } from 'vitest'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  MISSILE_CLT_COLS_113C_COUNT,
  missileCltCols113c,
  missileCltColsByName113c,
} from '../src/common/skills/missile-clt-cols-113c.ts'
import {
  checkMissileSegmentFootprintOverlap113c,
  checkMissileSizeFootprintOverlap113c,
  checkMissileSubtileRayFootprintOverlap113c,
  getMissileSizeFootprintOffsets113c,
} from '../src/common/skills/missile-size-footprint-113c.ts'
import { getMonsterSizeXByHcIdx } from '../src/common/units/monster-mapping.ts'
import * as serverEngine from '../src/server/engine/missile-engine.ts'

describe('Issue #1502: shared 1.13c missile Size footprint', () => {
  it('implements all 9 (missile Size, target SizeX) cases of the 0x6FDCF8E8 jump table', () => {
    const inside = (m: number, t: number, dx: number, dy: number): boolean =>
      checkMissileSizeFootprintOverlap113c(dx, dy, m, t)
    // (1,1): same sub-tile only
    expect(inside(1, 1, 0, 0)).toBe(true)
    expect(inside(1, 1, 1, 0)).toBe(false)
    // (1,2) / (2,1): manhattan <= 1
    for (const [m, t] of [[1, 2], [2, 1]] as const) {
      expect(inside(m, t, 1, 0)).toBe(true)
      expect(inside(m, t, 0, 1)).toBe(true)
      expect(inside(m, t, 1, 1)).toBe(false)
    }
    // (1,3) / (3,1): chebyshev <= 1
    for (const [m, t] of [[1, 3], [3, 1]] as const) {
      expect(inside(m, t, 1, 1)).toBe(true)
      expect(inside(m, t, 2, 0)).toBe(false)
    }
    // (2,2): manhattan <= 2
    expect(inside(2, 2, 1, 1)).toBe(true)
    expect(inside(2, 2, 2, 0)).toBe(true)
    expect(inside(2, 2, 2, 1)).toBe(false)
    // (2,3) / (3,2): 5x3 cross
    for (const [m, t] of [[2, 3], [3, 2]] as const) {
      expect(inside(m, t, 2, 1)).toBe(true)
      expect(inside(m, t, 1, 2)).toBe(true)
      expect(inside(m, t, 2, 2)).toBe(false)
    }
    // (3,3): chebyshev <= 2
    expect(inside(3, 3, 2, 2)).toBe(true)
    expect(inside(3, 3, 3, 0)).toBe(false)
    // Size 0 (or out of 1..3) never collides with units
    for (let t = 0; t <= 3; t++) expect(inside(0, t, 0, 0)).toBe(false)
    expect(inside(1, 0, 0, 0)).toBe(false)
  })

  it('every missiles.bin row has a Size in 0..3 and the server re-exports the shared implementation', () => {
    const counts = [0, 0, 0, 0]
    for (let id = 0; id < MISSILE_CLT_COLS_113C_COUNT; id++) {
      const size = missileCltCols113c(id)!.size
      expect(size).toBeGreaterThanOrEqual(0)
      expect(size).toBeLessThanOrEqual(3)
      counts[size]!++
    }
    expect(counts.reduce((a, b) => a + b, 0)).toBe(MISSILE_CLT_COLS_113C_COUNT)
    expect(counts[1]).toBeGreaterThan(0)
    expect(serverEngine.checkMissileSizeFootprintOverlap113c).toBe(checkMissileSizeFootprintOverlap113c)
  })

  it('sweeps the whole movement step (sub-tile ray) rather than only the end point', () => {
    // Missile Size 1 vs target SizeX 2 passing straight through the target's sub-tile in one 4-sub-tile step.
    expect(checkMissileSegmentFootprintOverlap113c(0, 0, 4, 0, 2, 0, 1, 2)).toBe(true)
    expect(checkMissileSegmentFootprintOverlap113c(0, 0, 4, 0, 2, 2, 1, 2)).toBe(false)
  })

  it('client grid form compares integer sub-tiles (16.16 >> 16) at every stepped ray point', () => {
    // Same sub-tile row after flooring: 100.9 and 100.1 are both sub-tile 100.
    expect(checkMissileSubtileRayFootprintOverlap113c(100, 100.9, 104, 100.9, 102.5, 100.1, 1, 1)).toBe(true)
    // Size 1 vs SizeX 2: one sub-tile off-axis (manhattan 1) hits, two misses.
    expect(checkMissileSubtileRayFootprintOverlap113c(100, 100, 104, 100, 102, 101.99, 1, 2)).toBe(true)
    expect(checkMissileSubtileRayFootprintOverlap113c(100, 100, 104, 100, 102, 102, 1, 2)).toBe(false)
    // A 4-sub-tile step is halved down to <= 1 sub-tile so the intermediate sub-tile 102 is tested.
    expect(checkMissileSubtileRayFootprintOverlap113c(100, 100, 104, 100, 102, 100, 1, 1)).toBe(true)
    // Size 0 rows never hit units.
    expect(checkMissileSubtileRayFootprintOverlap113c(100, 100, 104, 100, 102, 100, 0, 3)).toBe(false)
  })
})

function spawnMagicArrowAtMonster(offsetY: number): { arrow: ClientUnit; hit: boolean } {
  const world = new ClientWorld()
  world.selfId = 1
  const self = (world as any).ensureUnit('player', 1) as ClientUnit
  self.x = 100
  self.y = 100
  const target = new ClientUnit({ unitType: 'monster', id: 902, classId: 0, x: 108, y: 100 + offsetY, mode: 1, direction: 0 })
  ;(world as any)._units.set(target.key, target)
  ;(world as any)._monsters.set(target.id, target)
  self.targetUnit = undefined
  ;(world as any).spawnMissilesForSkill(self, 6, 130, 100, 1)
  let arrow: ClientUnit | undefined
  for (const u of (world as any)._units.values() as Iterable<ClientUnit>) {
    if (u.unitType === 'missile') arrow = u
  }
  expect(arrow).toBeDefined()
  for (let t = 0; t < 20; t++) (world as any).stepDiscreteSimulationTick()
  return { arrow: arrow!, hit: arrow!.hitUnitIds?.has(902) ?? false }
}

describe('Issue #1502: client stepper hit test', () => {
  it('magic arrow hits within its Size footprint and misses outside it (no fixed 1.75 radius)', () => {
    const size = missileCltColsByName113c('magicarrow')!.size
    expect(size).toBe(1)
    expect(getMonsterSizeXByHcIdx(0)).toBe(2)
    // (1,2): manhattan distance <= 1 sub-tile around the target's integer sub-tile.
    expect(spawnMagicArrowAtMonster(0.5).hit).toBe(true)
    // 1.99 sub-tiles off-axis was outside the old 1.75 radius but is the adjacent sub-tile row in 1.13c.
    expect(spawnMagicArrowAtMonster(1.99).hit).toBe(true)
    // Two sub-tile rows away is outside the footprint.
    expect(spawnMagicArrowAtMonster(2.2).hit).toBe(false)
  })

  it('blocks Size=2 missiles (chainlightning/lightningfury) on 5-cell + cross wall footprint (0x6FD9CE00) while Size=1 missiles pass', () => {
    expect(getMissileSizeFootprintOffsets113c(1)).toHaveLength(1)
    expect(getMissileSizeFootprintOffsets113c(2)).toHaveLength(5)
    expect(getMissileSizeFootprintOffsets113c(3)).toHaveLength(9)
    expect(missileCltColsByName113c('chainlightning')!.size).toBe(2)
    expect(missileCltColsByName113c('magicarrow')!.size).toBe(1)

    const world = new ClientWorld()
    // Place a single missile-barrier wall cell at (105, 101), 1 sub-tile off the y=100 flight axis
    world.setMissileCollisionChecker((ix, iy) => ix === 105 && iy === 101)

    const chainLightning = world.spawnMissileByKey('chainlightning', 100, 100, 115, 100, {
      ownerType: 'player',
      ownerId: 1,
      sourceSkillId: 53,
      skillLevel: 1,
      maxTicks: 40,
    })
    const arrow = world.spawnMissileByKey('magicarrow', 100, 100, 115, 100, {
      ownerType: 'player',
      ownerId: 1,
      sourceSkillId: 6,
      skillLevel: 1,
      maxTicks: 40,
    })

    for (let t = 0; t < 15; t++) {
      world.tick(40)
    }

    // Chain Lightning (Size=2) collides with the adjacent wall at (105, 101) when entering (105, 100)
    expect(world.getUnit('missile', chainLightning.id)).toBeUndefined()
    // Magic Arrow (Size=1) tests only (x, y) and flies past x=105
    const activeArrow = world.getUnit('missile', arrow.id)
    expect(activeArrow).toBeDefined()
    expect(activeArrow!.x).toBeGreaterThan(106)
  })

  it('refreshes targeted unit coordinates at the action frame (0x6FB51340) even after an intervening stop UnitMove', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.apply(
      {
        type: 'UnitAssign',
        unit: {
          unitType: 0,
          id: 1,
          classId: 1, // Sorceress
          name: 'Sorc',
          x: 100,
          y: 100,
          mode: 1,
        },
      },
      1000,
    )
    world.apply(
      {
        type: 'UnitAssign',
        unit: {
          unitType: 1,
          id: 777,
          classId: 0, // Fallen
          name: 'Fallen',
          x: 110,
          y: 100,
          mode: 1,
        },
      },
      1000,
    )

    const selfUnit = world.getUnit('player', 1)!
    const monster = world.getUnit('monster', 777)!
    selfUnit.targetUnit = { unitType: 1, id: 777 }

    // Start casting Ice Bolt (skillId=39) at t=1000 while monster is at (110, 100)
    ;(world as any).applySkillCastToUnit(selfUnit, 39, monster.x, monster.y, 1, true, 1000)
    expect(selfUnit.castState?.targetUnit).toEqual({ unitType: 1, id: 777 })
    expect(selfUnit.castState?.missileSpawned).toBe(false)

    // Server sends S2C 0x0D PlayerStop (UnitMove with mode='stop') during wind-up: must NOT clear targetUnit
    world.apply(
      {
        type: 'UnitMove',
        unitType: 0,
        id: 1,
        from: { x: 100, y: 100 },
        to: { x: 100, y: 100 },
        mode: 'stop',
      },
      1040,
    )
    expect(selfUnit.targetUnit).toEqual({ unitType: 1, id: 777 })

    // Monster moves to (125, 115) before the action frame fires
    world.apply(
      {
        type: 'UnitReassign',
        unitType: 1,
        id: 777,
        at: { x: 125, y: 115 },
      },
      1050,
    )

    // Advance until the action-frame missile spawns
    let icebolt: ClientUnit | undefined
    for (let step = 1; step <= 20; step++) {
      world.tick(40, 1000 + step * 40)
      for (const u of (world as any)._units.values() as Iterable<ClientUnit>) {
        if (u.unitType === 'missile' && u.missileKey === 'icebolt') {
          icebolt = u
          break
        }
      }
      if (icebolt) break
    }
    expect(icebolt).toBeDefined()
    // Ice Bolt must be aimed toward the monster's action-frame position (125, 115), so vy > 0
    expect(icebolt!.vy ?? 0).toBeGreaterThan(0.1)
    expect(icebolt!.targetX).toBe(125)
    expect(icebolt!.targetY).toBe(115)
  })
})
