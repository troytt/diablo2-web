import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../../src/client/world/client-world.ts'

describe('Issue #1274: Barbarian Double Throw (#140) sequential 2-frame throws without fan spread', () => {
  it('schedules right-hand throw at frame 3/12 and left-hand throw at frame 8/12, both flying straight along target angle', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 4, name: 'Barb', x: 5000, y: 5000 },
    })
    const barb = world.getUnit('player', 1)!

    ;(world as any).applySkillCastToUnit(barb, 140, 5020, 5000, 1, true, 1000)
    expect(barb.castState).toBeDefined()
    const cs = barb.castState!
    expect(cs.missileFireDelayMs).toBeDefined()
    expect(cs.secondMissileFireDelayMs).toBeDefined()
    expect(cs.secondMissileFireDelayMs!).toBeGreaterThan(cs.missileFireDelayMs!)

    const getThrowMissiles = () =>
      Array.from(world.units.values()).filter((u) => u.unitType === 'missile' && u.sourceSkillId === 140)

    // At t = 1000ms (cast start), 0 missiles spawned
    expect(getThrowMissiles().length).toBe(0)

    // Step until first event frame fires (frame 3/12)
    let now = 1000
    while (now - 1000 < cs.missileFireDelayMs!) {
      now += 40
      world.tick(40, now)
    }
    const afterFirst = getThrowMissiles()
    expect(afterFirst.length).toBe(1)
    expect(cs.missileSpawned).toBe(true)
    expect(cs.secondMissileSpawned).toBe(false)
    // First missile flies straight east (y === 5000, targetY === 5000, zero fan spread)
    expect(afterFirst[0]!.targetY).toBe(5000)
    expect(afterFirst[0]!.y).toBeCloseTo(5000, 5)

    // Step until second event frame fires (frame 8/12)
    while (now - 1000 < cs.secondMissileFireDelayMs!) {
      now += 40
      world.tick(40, now)
    }
    const afterSecond = getThrowMissiles()
    expect(afterSecond.length).toBe(2)
    expect(cs.secondMissileSpawned).toBe(true)
    // Both missiles fly straight along y = 5000, with the first ahead of the second in x
    expect(afterSecond[0]!.targetY).toBe(5000)
    expect(afterSecond[1]!.targetY).toBe(5000)
    expect(afterSecond[0]!.y).toBeCloseTo(5000, 5)
    expect(afterSecond[1]!.y).toBeCloseTo(5000, 5)
    expect(afterSecond[0]!.x).toBeGreaterThan(afterSecond[1]!.x)
  })
})
