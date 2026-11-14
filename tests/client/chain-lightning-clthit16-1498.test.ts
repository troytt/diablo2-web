import { describe, expect, it } from 'vitest'
import {
  chainLightningHits113c,
  cltHit16Radius113c,
  lightningStrikeHits113c,
} from '../../src/client/world/chain-lightning-clthit16-113c.ts'
import { missileCltColsByName113c } from '../../src/common/skills/missile-clt-cols-113c.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

function addMonster(world: any, id: number, x: number, y: number): any {
  const m = world.upsertMonster
    ? world.upsertMonster({ id, classId: 0, x, y })
    : undefined
  return m
}

describe('MissCltHitFunc[16] chain lightning bounce (0x6fb667d0, #1498)', () => {
  it('bounce counts come from Skills.txt calc1 (#53 ln34/5) and calc2 (#34 ln34)', () => {
    expect(chainLightningHits113c(1)).toBe(5)
    expect(chainLightningHits113c(4)).toBe(5)
    expect(chainLightningHits113c(5)).toBe(6)
    expect(chainLightningHits113c(20)).toBe(9)
    expect(lightningStrikeHits113c(1)).toBe(2)
    expect(lightningStrikeHits113c(10)).toBe(11)
  })

  it('radius = cHitPar1 when > 0 (chainlightning2 = 10), else the skill aurarangecalc (20), unknown skill throws', () => {
    expect(missileCltColsByName113c('chainlightning2')?.cHitPar[0]).toBe(10)
    expect(missileCltColsByName113c('chainlightning2')?.pCltHitFunc).toBe(16)
    expect(cltHit16Radius113c(10, undefined)).toBe(10)
    expect(cltHit16Radius113c(0, 53)).toBe(20)
    expect(cltHit16Radius113c(0, 34)).toBe(20)
    expect(() => cltHit16Radius113c(0, 999)).toThrow()
  })

  it('on hit with count > 1 spawns a new chainlightning from the hit unit with count - 1 and ends the hit segment', () => {
    const world = new ClientWorld() as any
    const a = { unitType: 'monster', id: 101, x: 110, y: 100, dead: false, mode: 1, states: new Set(), lifePct: 100, overlays: [] as any[] }
    const b = { unitType: 'monster', id: 102, x: 118, y: 100, dead: false, mode: 1, states: new Set(), lifePct: 100, overlays: [] as any[] }
    const far = { unitType: 'monster', id: 103, x: 160, y: 100, dead: false, mode: 1, states: new Set(), lifePct: 100, overlays: [] as any[] }
    world._monsters.set(101, a)
    world._monsters.set(102, b)
    world._monsters.set(103, far)
    world.isFriendlyOrNonHostileMonster = () => false
    const cl = world.spawnMissileByKey('chainlightning', 100, 100, 110, 100, {
      ownerType: 'player',
      ownerId: 1,
      sourceSkillId: 53,
      skillLevel: 1,
      pierce: false,
    })
    cl.cltCountdown = 5
    world.triggerMissileImpact(cl, a.x, a.y, false, a)
    const children = Array.from(world.units.values()).filter((u: any) => u.missileKey === 'chainlightning' && u !== cl) as any[]
    expect(children).toHaveLength(1)
    const c = children[0]
    expect(c.cltCountdown).toBe(4)
    expect(c.x).toBe(a.x)
    expect(c.targetX).toBe(b.x)
    expect(c.hitUnitIds.has(101)).toBe(true)
    expect(cl.pierce).toBe(false)
  })

  it('count <= 1 ends the chain', () => {
    const world = new ClientWorld() as any
    const a = { unitType: 'monster', id: 101, x: 110, y: 100, dead: false, mode: 1, states: new Set(), lifePct: 100, overlays: [] as any[] }
    const b = { unitType: 'monster', id: 102, x: 118, y: 100, dead: false, mode: 1, states: new Set(), lifePct: 100, overlays: [] as any[] }
    world._monsters.set(101, a)
    world._monsters.set(102, b)
    world.isFriendlyOrNonHostileMonster = () => false
    const cl = world.spawnMissileByKey('chainlightning', 100, 100, 110, 100, { ownerType: 'player', ownerId: 1, sourceSkillId: 53, skillLevel: 1 })
    cl.cltCountdown = 1
    world.triggerMissileImpact(cl, a.x, a.y, false, a)
    expect(Array.from(world.units.values()).filter((u: any) => u.missileKey === 'chainlightning')).toHaveLength(1)
  })
})
void addMonster
