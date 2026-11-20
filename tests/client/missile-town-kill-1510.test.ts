import { describe, expect, it } from 'vitest'
import { MISSILE_CLT_COLS_113C, missileCltColsByName113c } from '../../src/common/skills/missile-clt-cols-113c.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('0x6fb61af0 town removal of non-Town missiles (#1510)', () => {
  it('only the 9 Missiles.txt Town rows may live in town', () => {
    expect(MISSILE_CLT_COLS_113C.filter(r => r.town).map(r => r.name)).toEqual([
      'diablight', 'diabfire', 'diabwallmaker', 'diabwall', 'vine beast walk 1', 'vine beast walk 2',
      'vine beast neutral', 'vine beast attack', 'vine beast death',
    ])
  })

  it('removes a fireball stepped in the Rogue Encampment, keeps it in the Blood Moor and keeps a Town row', () => {
    const world = new ClientWorld() as any
    world.areaId = 1
    const fb = world.spawnMissileByKey('fireball', 100, 100, 120, 100, { ownerType: 'player', ownerId: 1 })
    world.stepMissileUnit(fb)
    expect(world.units.has(fb.key)).toBe(false)
    const vine = world.spawnMissileByKey('vine beast neutral', 100, 100, 100, 100, { ownerType: 'player', ownerId: 1 })
    expect(missileCltColsByName113c('vine beast neutral')!.town).toBe(true)
    world.stepMissileUnit(vine)
    expect(world.units.has(vine.key)).toBe(true)
    world.areaId = 2
    const fb2 = world.spawnMissileByKey('fireball', 100, 100, 120, 100, { ownerType: 'player', ownerId: 1 })
    world.stepMissileUnit(fb2)
    expect(world.units.has(fb2.key)).toBe(true)
  })
})
