import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientUnit } from '../../src/client/world/client-unit.ts'

function spawnMonster(world: ClientWorld, classId: number, id: number, x: number, y: number): ClientUnit {
  world.apply({ type: 'UnitAssign', unit: { unitType: 1, id, classId, x, y, mode: 1, lifePct: 128 } } as any)
  return (world as any).getUnit('monster', id) as ClientUnit
}

function countBaalCorpseMissiles(world: ClientWorld): number {
  let n = 0
  for (const u of world.units.values()) {
    if (u.unitType === 'missile' && u.missileKey?.startsWith('baalcorpseexplode')) n++
  }
  return n
}

describe('#285 Baal Corpse Explode before each throne wave', () => {
  it('explodes each corpse once, so later wave casts do not restart the gore animation', () => {
    const world = new ClientWorld()
    const baal = spawnMonster(world, 543, 900, 100, 100)
    const corpses: ClientUnit[] = []
    for (let i = 0; i < 3; i++) {
      const c = spawnMonster(world, 10, 960 + i, 106 + i, 100)
      c.dead = true
      c.mode = 12
      c.lifePct = 0
      corpses.push(c)
    }

    ;(world as any).spawnMissilesForSkill(baal, 285, 100, 100, 1)
    expect(countBaalCorpseMissiles(world)).toBe(3)
    for (const c of corpses) {
      expect(c.states.has(104)).toBe(true)
      expect(c.corpseSuppressed).toBe(true)
    }

    // The next wave's cast must not find the already exploded corpses again.
    ;(world as any).spawnMissilesForSkill(baal, 285, 100, 100, 1)
    expect(countBaalCorpseMissiles(world)).toBe(3)

    // delay (<= 19) -> expl (16) -> fade (Missiles.txt Range 443): the chain then ends.
    for (let t = 0; t < 19 + 16 + 443 + 5; t++) world.tick(40)
    expect(countBaalCorpseMissiles(world)).toBe(0)

    ;(world as any).spawnMissilesForSkill(baal, 285, 100, 100, 1)
    expect(countBaalCorpseMissiles(world)).toBe(0)

    // A fresh corpse from the new wave is still exploded.
    const fresh = spawnMonster(world, 10, 970, 104, 104)
    fresh.dead = true
    fresh.mode = 12
    fresh.lifePct = 0
    ;(world as any).spawnMissilesForSkill(baal, 285, 100, 100, 1)
    expect(countBaalCorpseMissiles(world)).toBe(1)
  })
})
