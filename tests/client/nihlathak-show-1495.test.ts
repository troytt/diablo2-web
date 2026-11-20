import { describe, expect, it, vi } from 'vitest'
import { getBossDeathFxSpec } from '../../src/common/units/monster-death-fx.ts'
import { missileCltColsByName113c } from '../../src/common/skills/missile-clt-cols-113c.ts'
import {
  NEHLITHAK_CONTROL_MISSILE,
  NIHLATHAK_MONSTER_CLASS,
  NIHLITHAK1_MISSILE,
} from '../../src/client/world/boss-death-cltdo-113c.ts'
import { QuestFxLight } from '../../src/client/world/quest-fx-light.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('Nihlathak show = special quest event 17 (0x6fb02af0, #1495)', () => {
  it('ids match Missiles.txt / MonStats', () => {
    expect(missileCltColsByName113c('nehlithakcontrol')!.id).toBe(NEHLITHAK_CONTROL_MISSILE)
    expect(missileCltColsByName113c('nihlithak1')!.id).toBe(NIHLITHAK1_MISSILE)
    expect(missileCltColsByName113c('nihlithak1')!.pCltHitFunc).toBe(60)
    expect(NIHLATHAK_MONSTER_CLASS).toBe(526)
  })

  it('Nihlathak has no MonUMod 22 death show', () => {
    expect(getBossDeathFxSpec(526, 'nihlathakboss')).toBeNull()
  })

  it('QuestFxLight routes event 17', () => {
    const fx = new QuestFxLight()
    const start = vi.fn()
    fx.onSpecialQuestEvent(17, { findStoneAlpha: () => null, startNihlathakShowIfNear: start })
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('creates nehlithakcontrol + nihlithak1, hides Nihlathak; nihlithak1 range end -> nihlithak2 + nehlithakbonechips (z 85)', () => {
    const world = new ClientWorld() as any
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'P', x: 100, y: 100 })
    const mon = { unitType: 'monster', id: 9, classId: 526, x: 110.4, y: 120.7, key: 'monster:9' } as any
    world.startNihlathakShowAt(mon)
    expect(mon.clientNoDraw).toBe(true)
    const units = Array.from(world.units.values()) as any[]
    const ctl = units.find(u => u.missileKey === 'nehlithakcontrol')
    const body = units.find(u => u.missileKey === 'nihlithak1')
    expect(ctl).toBeDefined()
    expect(body).toBeDefined()
    expect(body.x).toBe(110)
    while (world.units.has(body.key)) world.stepMissileUnit(body)
    const after = Array.from(world.units.values()) as any[]
    expect(after.some(u => u.missileKey === 'nihlithak2')).toBe(true)
    const chips = after.find(u => u.missileKey === 'nehlithakbonechips')
    expect(chips?.altitude).toBe(85)
  })

  it('rejects a unit that is not Nihlathak', () => {
    const world = new ClientWorld() as any
    expect(() => world.startNihlathakShowAt({ unitType: 'monster', id: 2, classId: 5, x: 0, y: 0, key: 'monster:2' })).toThrow()
  })
})
