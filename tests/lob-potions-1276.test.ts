import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'

function getMissilesByKey(world: ClientWorld, key: string) {
  return world.getUnitsByType('missile').filter((m) => m.missileKey === key)
}

describe('Issue #1276: pCltDoFunc = 2 Lobbed Potions parabolic arc & landing impact', () => {
  it('populates pCltDoFunc=2 and 1.13c hit sub-missiles on all 8 lobbed potion rows', () => {
    const keys = [
      'oilpotion',
      'explosivepotion',
      'fulminatingpotion',
      'rancidgasepotion',
      'chokinggaspoition',
      'stranglinggaspotion',
      'pantherpotorange',
      'pantherpotgreen',
    ] as const

    for (const key of keys) {
      const row = CANONICAL_113C_MISSILES[key]
      expect(row, key).toBeDefined()
      expect(row!.pCltDoFunc, `${key} pCltDoFunc`).toBe(2)
      expect(row!.alwaysExplode, `${key} alwaysExplode`).toBe(true)
      expect(row!.pCltHitFunc, `${key} pCltHitFunc`).toBeGreaterThan(0)
      expect(row!.cltHitSubMissile1, `${key} cltHitSubMissile1`).toBeTruthy()
    }
  })

  it('flies in a parabolic arc (altitude > 0 mid-flight, skipping mid-path monsters) and lands on (targetX, targetY) with altitude = 0', () => {
    const world = new ClientWorld()
    world.setCollisionChecker(() => false)

    // Place a hostile monster directly on the mid-point (104.5, 100) between start (100, 100) and target (109, 100)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 500, classId: 1, x: 104.5, y: 100, mode: 1, lifePct: 128 },
    } as any)

    const pot = world.spawnMissileByKey('pantherpotorange', 100, 100, 109, 100, {
      ownerType: 'monster',
      ownerId: 10,
    })

    // dist = 9, vel = 16 -> speedSubTilesPerTick = 0.75 -> lobFlightTicks = 12
    expect(pot.maxTicks).toBe(12)
    expect(pot.vx).toBeCloseTo(0.75, 5)
    expect(pot.vy).toBeCloseTo(0, 5)
    expect(pot.altitude).toBe(0)
    expect((pot as any).lobPeakAltitude).toBeCloseTo(31.5, 5)

    const altitudes: number[] = []
    for (let tick = 1; tick <= pot.maxTicks!; tick++) {
      ;(world as any).stepMissileUnit(pot)
      altitudes.push(pot.altitude ?? 0)
      if (tick < pot.maxTicks!) {
        // Still in flight and has not prematurely collided with monster at (104.5, 100)
        expect(world.units.has(pot.key)).toBe(true)
        expect(pot.altitude).toBeGreaterThan(0)
      }
    }

    // Peak altitude reached at midpoint (tick 6 of 12 -> t = 0.5 -> altitude = Math.round(31.5) = 32)
    expect(altitudes[5]).toBe(32)
    // Altitude returns to 0 on landing tick (tick 12 -> t = 1.0)
    expect(altitudes[11]).toBe(0)
    expect(pot.x).toBeCloseTo(109, 5)
    expect(pot.y).toBeCloseTo(100, 5)
    expect(world.units.has(pot.key)).toBe(false)

    // Spawned explodingarrowexp at landing point (109, 100), not at mid-path monster (104.5, 100)
    const exps = getMissilesByKey(world, 'explodingarrowexp')
    expect(exps).toHaveLength(1)
    expect(exps[0]!.x).toBeCloseTo(109, 5)
    expect(exps[0]!.y).toBeCloseTo(100, 5)
  })

  it('spawns 1.13c fire explosions and debris on landing for oilpotion, explosivepotion, and fulminatingpotion', () => {
    const world = new ClientWorld()
    world.setCollisionChecker(() => false)

    const oil = world.spawnMissileByKey('oilpotion', 100, 100, 106, 100, {
      ownerType: 'player',
      ownerId: 1,
    })
    while (world.units.has(oil.key)) {
      ;(world as any).stepMissileUnit(oil)
    }
    expect(getMissilesByKey(world, 'fireexplode')).toHaveLength(1)

    const expPot = world.spawnMissileByKey('explosivepotion', 100, 110, 106, 110, {
      ownerType: 'player',
      ownerId: 1,
    })
    while (world.units.has(expPot.key)) {
      ;(world as any).stepMissileUnit(expPot)
    }
    expect(getMissilesByKey(world, 'explodingarrowexp')).toHaveLength(1)

    const fulm = world.spawnMissileByKey('fulminatingpotion', 100, 120, 106, 120, {
      ownerType: 'player',
      ownerId: 1,
    })
    while (world.units.has(fulm.key)) {
      ;(world as any).stepMissileUnit(fulm)
    }
    expect(getMissilesByKey(world, 'explosivepotionexp')).toHaveLength(1)
    const debris = world
      .getUnitsByType('missile')
      .filter((m) => m.missileKey?.startsWith('explosivepotiondebris'))
    expect(debris).toHaveLength(1)
  })

  it('spawns 1.13c poison cloud rings on landing for rancidgasepotion, chokinggaspoition, stranglinggaspotion, and pantherpotgreen', () => {
    const world = new ClientWorld()
    world.setCollisionChecker(() => false)

    const rancid = world.spawnMissileByKey('rancidgasepotion', 100, 100, 108, 100, {
      ownerType: 'player',
      ownerId: 1,
    })
    while (world.units.has(rancid.key)) {
      ;(world as any).stepMissileUnit(rancid)
    }
    // cHitPar1 = 0, cHitPar2 = 2 -> 8 slow clouds
    expect(getMissilesByKey(world, 'rancidgascloud')).toHaveLength(8)

    const choking = world.spawnMissileByKey('chokinggaspoition', 100, 120, 108, 120, {
      ownerType: 'player',
      ownerId: 1,
    })
    while (world.units.has(choking.key)) {
      ;(world as any).stepMissileUnit(choking)
    }
    // cHitPar1 = 2, cHitPar2 = 2 -> 8 slow + 8 fast = 16 clouds
    expect(getMissilesByKey(world, 'chokinggascloud')).toHaveLength(16)

    const strangling = world.spawnMissileByKey('stranglinggaspotion', 100, 140, 108, 140, {
      ownerType: 'player',
      ownerId: 1,
    })
    while (world.units.has(strangling.key)) {
      ;(world as any).stepMissileUnit(strangling)
    }
    // cHitPar1 = 1, cHitPar2 = 2 -> 8 slow + 15 fast = 23 clouds
    expect(getMissilesByKey(world, 'stranglinggascloud')).toHaveLength(23)

    const pantherGreen = world.spawnMissileByKey('pantherpotgreen', 100, 160, 108, 160, {
      ownerType: 'monster',
      ownerId: 2,
    })
    while (world.units.has(pantherGreen.key)) {
      ;(world as any).stepMissileUnit(pantherGreen)
    }
    // 8 earlier + 8 from pantherpotgreen (pCltHitFunc = 28) = 16
    expect(getMissilesByKey(world, 'rancidgascloud')).toHaveLength(16)
  })
})
