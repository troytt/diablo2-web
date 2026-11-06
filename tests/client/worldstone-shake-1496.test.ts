import { describe, expect, it, vi } from 'vitest'
import { SEED_RollLimitedRandomNumber } from '../../src/common/rng/d2-rng.ts'
import { missileCltColsByName113c } from '../../src/common/skills/missile-clt-cols-113c.ts'
import { MISSILE_CLASS_ID_TO_KEY } from '../../src/common/skills/missiles-data.ts'
import {
  WORLDSTONE_DEBRIS1_MISSILE,
  WORLDSTONE_SHAKE_MISSILE,
  isWorldstoneShakeLevel,
  worldstoneDebrisMissile,
  worldstoneShakeTick,
} from '../../src/client/world/quest-fx-worldstone-113c.ts'
import { QuestFxLight } from '../../src/client/world/quest-fx-light.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('worldstone shake (event 19, 0x6fb032c0, CltDo66 0x6fb69ea0, #1496)', () => {
  it('rows and levels', () => {
    const r = missileCltColsByName113c('worldstone shake')!
    expect(r.id).toBe(WORLDSTONE_SHAKE_MISSILE)
    expect(r.pCltDoFunc).toBe(66)
    expect(r.pCltHitFunc).toBe(61)
    expect([0, 1, 2].map(i => MISSILE_CLASS_ID_TO_KEY[WORLDSTONE_DEBRIS1_MISSILE + i])).toEqual([
      'baalfx tyreal debris 1',
      'baalfx tyreal debris 2',
      'baalfx tyreal debris 3',
    ])
    expect(isWorldstoneShakeLevel(131)).toBe(true)
    expect(isWorldstoneShakeLevel(132)).toBe(true)
    expect(isWorldstoneShakeLevel(130)).toBe(false)
  })

  it('first frame (TargetX 0) always shakes without the 0x3f roll; RAND order % 10 then two RAND(60)', () => {
    const seed = { lo: 99, hi: 666 }
    const ref = { ...seed }
    const t = worldstoneShakeTick(0, seed)
    expect(t.shake).toBe(true)
    expect(t.nextTargetX).toBe(1)
    const r10 = SEED_RollLimitedRandomNumber(ref, 10)
    if (r10 === 0) {
      const ox = SEED_RollLimitedRandomNumber(ref, 60) - 30
      const oy = SEED_RollLimitedRandomNumber(ref, 60) - 30
      expect(t.debris).toEqual({ ox, oy })
    } else {
      expect(t.debris).toBeNull()
    }
    expect(seed).toEqual(ref)
  })

  it('later frames roll RAND() & 0x3f first', () => {
    const seed = { lo: 5, hi: 666 }
    const ref = { ...seed }
    const t = worldstoneShakeTick(1, seed)
    expect(t.shake).toBe(SEED_RollLimitedRandomNumber(ref, 64) === 0)
  })

  it('debris row 635 + RAND(3)', () => {
    for (let i = 1; i < 50; i++) {
      const id = worldstoneDebrisMissile({ lo: i, hi: 666 })
      expect(id).toBeGreaterThanOrEqual(635)
      expect(id).toBeLessThanOrEqual(637)
    }
  })

  it('event 19 arms the shake; the shake missile appears once per level-131/132 visit and leaves with the level', () => {
    const world = new ClientWorld() as any
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'P', x: 100, y: 100 })
    const fx = new QuestFxLight()
    fx.onSpecialQuestEvent(19, { findStoneAlpha: () => null, armWorldstoneShake: () => world.armWorldstoneShake() })
    expect(world.updateWorldstoneShakeTrigger(120)).toBeUndefined()
    const m = world.updateWorldstoneShakeTrigger(131)
    expect(m?.missileKey).toBe('worldstone shake')
    expect(world.updateWorldstoneShakeTrigger(131)).toBeUndefined()
    const shake = vi.spyOn(world, 'startScreenShake')
    world.areaId = 131
    world.stepMissileUnit(m)
    expect(shake).toHaveBeenCalledWith(3000, 6, 2000, 2000)
    expect(world.units.has(m.key)).toBe(true)
    world.areaId = 120
    world.stepMissileUnit(m)
    expect(world.units.has(m.key)).toBe(false)
    expect(world.updateWorldstoneShakeTrigger(120)).toBeUndefined()
    expect(world.updateWorldstoneShakeTrigger(132)?.missileKey).toBe('worldstone shake')
  })

  it('without event 19 nothing is created', () => {
    const world = new ClientWorld() as any
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'P', x: 100, y: 100 })
    expect(world.updateWorldstoneShakeTrigger(131)).toBeUndefined()
  })
})
