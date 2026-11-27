import { describe, expect, it } from 'vitest'
import {
  enirhsReverseName113c,
  resolveShrineOperateFx113c,
  shrineMissileLevel113c,
} from '../../src/client/world/shrine-operate-fx-113c.ts'
import { getMissileTxtData } from '../../src/common/skills/missiles-data.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('shrine operate effects (D2Client 0x6fad4b90 / shrine table 0x6fb82f60, #1523 / #1527)', () => {
  it('missile level = clamp(trunc(level / 5), 1, 8)', () => {
    expect(shrineMissileLevel113c(1)).toBe(1)
    expect(shrineMissileLevel113c(9)).toBe(1)
    expect(shrineMissileLevel113c(10)).toBe(2)
    expect(shrineMissileLevel113c(39)).toBe(7)
    expect(shrineMissileLevel113c(99)).toBe(8)
  })

  it('fire shrine (19, 0x6fad6060): 16 fireballs to shrine + {5,-10,15,-20}^2', () => {
    const fx = resolveShrineOperateFx113c(19, 100, 200, 30)
    expect(fx.missiles).toHaveLength(16)
    expect(new Set(fx.missiles.map((m) => m.missile))).toEqual(new Set(['fireball']))
    expect(fx.missiles[0]).toEqual({ missile: 'fireball', sourceX: 100, sourceY: 200, targetX: 105, targetY: 205, level: 6 })
    expect(fx.missiles[15]).toMatchObject({ targetX: 80, targetY: 180 })
  })

  it('exploding (21) and poison (22) shrines: 6 potions to fixed absolute offsets', () => {
    const ex = resolveShrineOperateFx113c(21, 50, 60, 1)
    expect(ex.missiles.map((m) => [m.targetX - 50, m.targetY - 60])).toEqual([[-6, 6], [-6, -6], [0, 6], [0, -6], [6, 6], [6, -6]])
    expect(ex.missiles.every((m) => m.missile === 'explosivepotion')).toBe(true)
    const po = resolveShrineOperateFx113c(22, 50, 60, 1)
    expect(po.missiles.every((m) => m.missile === 'chokinggaspoition')).toBe(true)
  })

  it('the missile names exist in Missiles.txt with the ids the handlers push (0x3E, 0x2D, 0x30)', () => {
    expect(getMissileTxtData('fireball').id).toBe(0x3e)
    expect(getMissileTxtData('explosivepotion').id).toBe(0x2d)
    expect(getMissileTxtData('chokinggaspoition').id).toBe(0x30)
  })

  it('Enirhs (16) reverses the name; other codes and out-of-table codes do nothing', () => {
    expect(resolveShrineOperateFx113c(16, 0, 0, 1)).toEqual({ missiles: [], reverseName: true })
    expect(enirhsReverseName113c('WebBotOne')).toBe('enOtoBbeW')
    for (const code of [0, 1, 6, 15, 18, 20, 23, 99]) expect(resolveShrineOperateFx113c(code, 0, 0, 1)).toEqual({ missiles: [], reverseName: false })
  })

  it('S2C 0x0E event 0x15 on a fire shrine spawns the 16 fireballs owned by player pkt[7]; a missing player skips', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 0, id: 7, classId: 1, x: 90, y: 90, mode: 1 } })
    world.apply({ type: 'UnitAssign', unit: { unitType: 2, id: 5, classId: 2, x: 100, y: 100, mode: 0, flags: 19 } })
    world.apply({ type: 'UnitMode', unitType: 2, id: 5, mode: 0, eventCode: 0x15, eventFlag: 7 })
    world.tick(40)
    const fireballs = world.getUnitsByType('missile').filter((m) => m.missileKey === 'fireball')
    expect(fireballs).toHaveLength(16)
    expect(fireballs.every((m) => m.ownerId === 7)).toBe(true)
    world.apply({ type: 'UnitMode', unitType: 2, id: 5, mode: 0, eventCode: 0x15, eventFlag: 99 })
    world.tick(40)
    expect(world.getUnitsByType('missile').filter((m) => m.missileKey === 'fireball').length).toBeLessThanOrEqual(16)
  })
})
