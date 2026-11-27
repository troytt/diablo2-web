import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'

const joinAtZeroLife = (areaId: number) => {
  const world = new ClientWorld()
  world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId })
  world.apply({ type: 'UnitAssign', unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 100, y: 100, mode: 5 }, isSelf: true })
  world.apply({ type: 'StatSet', stat: 7, value: 40 << 8, param: 0 } as never)
  world.apply({ type: 'StatSet', stat: 6, value: 0, param: 0 } as never)
  world.apply({ type: 'LifeMana', life: 0, mana: 10, stamina: 50, at: { x: 100, y: 100 } })
  return world
}

describe('joining a game with zero life', () => {
  it('stays alive in town, where the server keeps the character standing', () => {
    const world = joinAtZeroLife(1)
    expect(world.self.life).toBe(0)
    expect(world.isDead).toBe(false)
  })
})
