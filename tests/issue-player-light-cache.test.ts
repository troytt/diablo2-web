/**
 * Player light (radius/colour) resolution must not walk the equipment on every
 * rendered frame: the scene state provider and `buildRenderableUnits` ask for it
 * each frame (self + every remote player), while the values only change on
 * stat/equip updates — this was a top idle-CPU hotspot (two full equipment
 * walks per frame per player).
 */
import { describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'

describe('[player light cache]', () => {
  it('1. caches within the TTL window and recomputes once per signature change', () => {
    const world = new ClientWorld()
    const radiusSpy = vi.spyOn(world as unknown as { computePlayerLightRadiusBonus: () => number }, 'computePlayerLightRadiusBonus')
    const colorSpy = vi.spyOn(world as unknown as { computePlayerLightColor: () => number }, 'computePlayerLightColor')

    world.resolvePlayerLightRadiusBonus()
    world.resolvePlayerLightRadiusBonus()
    world.resolvePlayerLightColor()
    expect(radiusSpy).toHaveBeenCalledTimes(1)
    expect(colorSpy).toHaveBeenCalledTimes(1)

    world.invalidatePlayerLightCache()
    world.resolvePlayerLightRadiusBonus()
    expect(radiusSpy).toHaveBeenCalledTimes(2)
  })

  it('2. invalidates on equipment container size change even inside the TTL', () => {
    const world = new ClientWorld()
    const radiusSpy = vi.spyOn(world as unknown as { computePlayerLightRadiusBonus: () => number }, 'computePlayerLightRadiusBonus')
    world.resolvePlayerLightRadiusBonus()
    expect(radiusSpy).toHaveBeenCalledTimes(1)
    // simulate an equip mutation changing the container signature
    const containers = (world as unknown as { _containers: { equipment: Map<number, unknown> } })._containers
    containers.equipment.set(9001, { id: 9001, bodyLoc: 1 })
    world.resolvePlayerLightRadiusBonus()
    expect(radiusSpy).toHaveBeenCalledTimes(2)
  })

  it('3. an in-place stat write (self STAT_LIGHTRADIUS / STAT_LIGHTCOLOR, unit state stats) is seen immediately inside the TTL', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const radiusSpy = vi.spyOn(world as unknown as { computePlayerLightRadiusBonus: () => number }, 'computePlayerLightRadiusBonus')
    expect(world.resolvePlayerLightRadiusBonus()).toBe(0)
    expect(world.resolvePlayerLightColor()).toBe(0)
    expect(radiusSpy).toHaveBeenCalledTimes(1)

    // SetRadius(13 + bonus) is immediate in 1.13c (stat callback 0x6fac8bc0 → 0x6fb58b60).
    world.self.applyStat(89, 5)
    expect(world.resolvePlayerLightRadiusBonus()).toBe(5)
    expect(radiusSpy).toHaveBeenCalledTimes(2)
    // Same signature again: the cached value is returned without a recompute.
    expect(world.resolvePlayerLightRadiusBonus()).toBe(5)
    expect(radiusSpy).toHaveBeenCalledTimes(2)

    world.self.applyStat(90, 0xff0000)
    expect(world.resolvePlayerLightColor()).toBe(0xff0000)

    // A remote player's 0xA8 state stat list (StatList.setStateStats) also refreshes its cached light.
    world.apply({ type: 'UnitAssign', isSelf: false, unit: { unitType: 'player', id: 42, classId: 2, name: 'Paladin', x: 120, y: 100 } })
    expect(world.resolvePlayerLightRadiusBonus(42)).toBe(0)
    world.getUnit('player', 42)?.stats.setStateStats(7, [{ statId: 89, param: 0, value: 3 }])
    expect(world.resolvePlayerLightRadiusBonus(42)).toBe(3)
    world.getUnit('player', 42)?.stats.removeStateStats(7)
    expect(world.resolvePlayerLightRadiusBonus(42)).toBe(0)
  })
})
