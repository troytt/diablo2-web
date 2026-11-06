import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../../src/client/world/client-world.ts'

describe('Issue #1279: Paladin Blessed Hammer (#112) 1.13c Archimedean spiral kinematics', () => {
  it('expands blessedhammer spiral at dR = 0.09277 sub-tiles/tick and dTheta = 0.12435 rad/tick (~8.8 sub-tiles max radius over 95 ticks)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 3, name: 'Paladin', x: 5000, y: 5000 },
    })
    const pal = world.getUnit('player', 1)!

    ;(world as any).spawnMissilesForSkill(pal, 112, 5005, 5000, 1)
    const hammer = Array.from(world.units.values()).find(
      (u) => u.unitType === 'missile' && u.missileKey === 'blessedhammer',
    )!
    expect(hammer).toBeDefined()
    expect(hammer.maxTicks).toBe(120)

    // Step 1 tick
    world.tick(40, 1040)
    expect(hammer.spiralRadius).toBeCloseTo(0.09277, 5)
    expect(hammer.spiralAngle).toBeCloseTo(0.12435, 5)

    // Step 94 more ticks (tick 95): radius stays compact (~8.81 sub-tiles, never 42+ sub-tiles)
    for (let t = 2; t <= 95; t++) {
      world.tick(40, 1000 + t * 40)
    }
    expect(hammer.spiralRadius).toBeCloseTo(95 * 0.09277, 3)
    expect(hammer.spiralRadius!).toBeLessThan(9.0)
    expect(Math.hypot(hammer.x - 5000, hammer.y - 5000)).toBeCloseTo(95 * 0.09277, 3)
  })
})
