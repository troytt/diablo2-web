import { describe, expect, it } from 'vitest'
import {
  ICEBREAK_MELT_BY_MISSILE_ID_113C,
  SHATTER_STATES_113C,
  getIcebreakMeltMissile113c,
  hasShatterState113c,
} from '../../src/common/units/monster-death-fx.ts'
import { CANONICAL_113C_MISSILES } from '../../src/common/skills/missiles-data.ts'
import { MISSILE_METAS } from '../../src/client/render/missiles-meta.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function assignMonster(world: ClientWorld, id: number, states: number[]): void {
  world.applyEvent({
    type: 'UnitAssign',
    unit: { unitType: 'monster', id, classId: 1, x: 100, y: 100, mode: 1, lifePct: 50, states },
  } as any)
}

function kill(world: ClientWorld, id: number): void {
  world.applyEvent({ type: 'UnitMode', unitType: 'monster', id, mode: 12, lifePct: 0 } as any)
}

function missileKeys(world: ClientWorld): string[] {
  return world.getUnitsByType('missile').map(m => m.missileKey ?? '')
}

describe('Issue #1453: frozen monster shatter -> icebreak melt (MissCltHitFunc 31)', () => {
  it('maps every pCltHitFunc=31 row through the 0x6FB606A0 switch table', () => {
    const clt31 = Object.values(CANONICAL_113C_MISSILES)
      .filter(r => r.pCltHitFunc === 31)
      .map(r => r.id)
      .sort((a, b) => a - b)
    expect(clt31).toEqual([272, 273, 274, 417])
    expect(Object.keys(ICEBREAK_MELT_BY_MISSILE_ID_113C).map(Number).sort((a, b) => a - b)).toEqual(clt31)
    expect(getIcebreakMeltMissile113c(272)).toBe('icebreaksmallmelt')
    expect(getIcebreakMeltMissile113c(273)).toBe('icebreaklargemelt')
    expect(getIcebreakMeltMissile113c(274)).toBe('icebreaklargemelt')
    expect(getIcebreakMeltMissile113c(417)).toBe('icebreaklargemelt')
    expect(getIcebreakMeltMissile113c(275)).toBeUndefined()
    for (const key of ['icebreaksmallmelt', 'icebreaklargemelt'] as const) {
      expect(CANONICAL_113C_MISSILES[key]?.range).toBe(150)
      expect(MISSILE_METAS[key]).toBeDefined()
    }
  })

  it('uses the States.txt shatter=1 set (#1 freeze, #107 shatter, #184 uberminion)', () => {
    expect([...SHATTER_STATES_113C].sort((a, b) => a - b)).toEqual([1, 107, 184])
    expect(hasShatterState113c(new Set([11]))).toBe(false)
    expect(hasShatterState113c(new Set([11, 107]))).toBe(true)
  })

  it.each([1, 107, 184])('state #%i death spawns shards, then the melt puddle when the shards expire', stateId => {
    const world = new ClientWorld()
    assignMonster(world, 9100 + stateId, [stateId])
    kill(world, 9100 + stateId)
    expect(world.getUnit('monster', 9100 + stateId)!.corpseSuppressed).toBe(true)
    const shardKey = missileKeys(world).find(k => k === 'icebreaksmall' || k === 'icebreaklarge')!
    expect(shardKey).toBeDefined()
    expect(missileKeys(world)).toContain('icebreaksmoke')
    const meltKey = shardKey === 'icebreaksmall' ? 'icebreaksmallmelt' : 'icebreaklargemelt'
    expect(missileKeys(world)).not.toContain(meltKey)
    for (let i = 0; i < 40; i++) world.tick()
    const keys = missileKeys(world)
    expect(keys).not.toContain(shardKey)
    expect(keys).toContain(meltKey)
    const melt = world.getUnitsByType('missile').find(m => m.missileKey === meltKey)!
    expect(melt.x).toBeCloseTo(100)
    expect(melt.y).toBeCloseTo(100)
    expect(melt.loopAnim).toBe(false)
    // Range 150: the puddle is gone after its lifetime.
    for (let i = 0; i < 160; i++) world.tick()
    expect(missileKeys(world)).not.toContain(meltKey)
  })

  it('a chilled-only (#11) death does not shatter', () => {
    const world = new ClientWorld()
    assignMonster(world, 9200, [11])
    kill(world, 9200)
    expect(missileKeys(world)).not.toContain('icebreaksmall')
    expect(missileKeys(world)).not.toContain('icebreaklarge')
  })

  it('icebreaksmall leaves icebreaksmallmelt with the shard direction', () => {
    const world = new ClientWorld() as any
    const small = world.spawnMissileByKey('icebreaksmall', 40, 40, 40, 40, { loopAnim: false, direction: 2 })
    small.vx = 0
    small.vy = 0
    for (let i = 0; i < 40; i++) world.tick()
    const melt = world.getUnitsByType('missile').find((m: any) => m.missileKey === 'icebreaksmallmelt')
    expect(melt).toBeDefined()
    expect(melt.direction).toBe(small.direction)
  })

  it('icebreaklarge and catapult cold explosion leave icebreaklargemelt; a unit hit leaves none', () => {
    const world = new ClientWorld() as any
    const large = world.spawnMissileByKey('icebreaklarge', 50, 50, 50, 50, { loopAnim: false })
    large.vx = 0
    large.vy = 0
    for (let i = 0; i < 40; i++) world.tick()
    expect(missileKeys(world)).toContain('icebreaklargemelt')

    const world2 = new ClientWorld() as any
    const cold = world2.spawnMissileByKey('catapult cold explosion', 60, 60, 60, 60, {})
    world2.triggerMissileImpact(cold, 60, 60, false)
    expect(missileKeys(world2)).toContain('icebreaklargemelt')

    const world3 = new ClientWorld() as any
    assignMonster(world3, 9300, [])
    const target = world3.getUnit('monster', 9300)
    const cold3 = world3.spawnMissileByKey('catapult cold explosion', 60, 60, 60, 60, {})
    world3.triggerMissileImpact(cold3, 60, 60, false, target)
    expect(missileKeys(world3)).not.toContain('icebreaklargemelt')
  })

  it('sets animSpeed = 8 (UNITS_SetAnimSpeed 0x80 at 0x6FB6067D) on spawned melt puddles and holds final frame 11', () => {
    const world = new ClientWorld() as any
    const shard = world.spawnMissileByKey('icebreaksmall', 40, 40, 40, 40, { loopAnim: false, direction: 3 })
    shard.vx = 0
    shard.vy = 0
    while (world.getUnitsByType('missile').some((m: any) => m.missileKey === 'icebreaksmall')) {
      world.tick()
    }
    const melt = world.getUnitsByType('missile').find((m: any) => m.missileKey === 'icebreaksmallmelt')!
    expect(melt).toBeDefined()
    expect(melt.animSpeed).toBe(8)
    expect(melt.direction).toBe(3)
    expect(melt.frame).toBe(0)
    // At animSpeed = 8 (0.5 frames/tick), 10 ticks advance 5 frames
    for (let i = 0; i < 10; i++) world.tick()
    expect(melt.frame).toBe(5)
    // Over 24 total ticks, the 12-frame animation reaches frame 11 and holds there
    for (let i = 0; i < 40; i++) world.tick()
    expect(melt.frame).toBe(11)
    expect(world.getUnitsByType('missile').some((m: any) => m.missileKey === 'icebreaksmallmelt')).toBe(true)
  })

  it('assigns a 4-way shard direction (dwFlags = 0x2020 at 0x6FAFBEC0) on monster shatter death', () => {
    const world = new ClientWorld()
    const dirs = new Set<number>()
    for (let id = 9400; id < 9404; id++) {
      assignMonster(world, id, [1])
      kill(world, id)
    }
    const shards = world
      .getUnitsByType('missile')
      .filter(m => m.missileKey === 'icebreaksmall' || m.missileKey === 'icebreaklarge')
    expect(shards.length).toBe(4)
    for (const s of shards) {
      expect(s.direction).toBeGreaterThanOrEqual(0)
      expect(s.direction).toBeLessThan(4)
      dirs.add(s.direction!)
    }
    expect(dirs.size).toBe(4)
  })

  it('GameInstance broadcasts shatter state before UnitMode(12) when a freezing skill (#45 Ice Blast) kills a monster', () => {
    const server = new GameInstance({ areaId: 2, seed: 42 }) as any
    const playerId = server.connectPlayer({
      charName: 'FrostSorc',
      classId: 1,
      level: 30,
      areaId: 2,
      x: 100,
      y: 100,
      skills: { 45: 10 },
    })
    const monsterId = server.spawnMonster({
      defId: 'zombie1',
      areaId: 2,
      x: 102,
      y: 100,
      hp: 5,
      maxHp: 5,
    })
    server.drainPlayerEvents(playerId)
    // Lethal Ice Blast (#45, srvdofunc=18 freezing skill) hit on an unfrozen monster
    server.finishMonsterDamage(
      server.players.get(playerId),
      server.monsters.get(monsterId),
      50,
      45,
      'cold',
    )
    const monster = server.monsters.get(monsterId)
    expect(monster.dead).toBe(true)
    expect(monster.shattered).toBe(true)
    expect(monster.states.has(1)).toBe(true)

    const events = server.drainPlayerEvents(playerId)
    const stateIdx = events.findIndex(
      (e: any) =>
        e.type === 'UnitState' &&
        e.unitType === 'monster' &&
        (e.unitId === monsterId || e.id === monsterId) &&
        (e.state === 1 || e.stateId === 1) &&
        e.active === true,
    )
    const modeIdx = events.findIndex(
      (e: any) =>
        e.type === 'UnitMode' &&
        (e.unitType === 'monster' || e.unitType === 1) &&
        e.id === monsterId &&
        e.mode === 12,
    )
    expect(stateIdx).toBeGreaterThanOrEqual(0)
    expect(modeIdx).toBeGreaterThan(stateIdx)

    // Replay into ClientWorld: corpse is suppressed and icebreak shard -> melt puddle spawns
    const world = new ClientWorld()
    assignMonster(world, monsterId, [])
    for (const ev of events) world.applyEvent(ev)
    expect(world.getUnit('monster', monsterId)!.corpseSuppressed).toBe(true)
    expect(
      missileKeys(world).some(k => k === 'icebreaksmall' || k === 'icebreaklarge'),
    ).toBe(true)
  })
})
