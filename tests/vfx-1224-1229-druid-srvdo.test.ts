/**
 * VFX-B19 (#1224..#1229): server missile `pSrvDoFunc` dispatch keyed on the real 1.13c D2Game
 * SrvDo table (D2MOO MissMode.cpp SrvDo06 / 23_24 / 25 / 26 / 27 / 28 / 29 / 30) and the druid
 * transform client overlays (Skills.txt cltoverlaya / cltoverlayb).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import type { D2DataRegistry } from '../src/common/data/data-registry.ts'
import type { CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'
import {
  MISSILE_SUBTILE_FLAT_PX,
  MissileEngine,
  type ActiveMissile,
} from '../src/server/engine/missile-engine.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { DRUID_TRANSFORM_CLT_OVERLAYS_113C, castSkill } from '../src/server/skills/skills.ts'

function makeUnit(
  registry: D2DataRegistry,
  id: string,
  pos: { x: number; y: number },
  unitType: CombatUnitContext['unitType'] = 'monster',
): CombatUnitContext {
  const statList = new UnitStatList()
  statList.setBaseStat('maxhp', 1000 * FIXED_ONE)
  statList.setHp256(1000 * FIXED_ONE)
  return { id, name: id, statList, stateBus: new StateBus(statList, registry), unitType, x: pos.x, y: pos.y }
}

function liveMissiles(engine: MissileEngine): ActiveMissile[] {
  return (engine as unknown as { missiles: ActiveMissile[] }).missiles
}

describe('VFX-B19 server pSrvDoFunc dispatch (1.13c D2Game SrvDo table)', () => {
  it('#1224: tornado (pSrvDoFunc 27) spawns 0 sub-missiles over its 75-frame life', async () => {
    const registry = await getSharedDataRegistry()
    expect(registry.getMissileByName('tornado')?.pSrvDoFunc).toBe(27)
    expect(registry.getMissileByName('tornado')?.subMissile1).toBe('')
    const engine = new MissileEngine(registry)
    const druid = makeUnit(registry, 'dru', { x: 0, y: 0 }, 'player')
    const m = engine.spawnMissile({
      missileNameOrId: 'tornado', sourceSkillId: 245, slvl: 1, owner: druid,
      startX: 0, startY: 0, targetX: 1000, targetY: 0,
    })!
    expect(m.maxRangeTicks).toBe(75)
    let spawned = 0
    for (let t = 1; t <= 75; t++) spawned += engine.tick(t).subMissilesSpawned.length
    expect(spawned).toBe(0)
    expect(liveMissiles(engine).some(x => x.name === 'moltenboulderfirepath')).toBe(false)
  })

  it('#1224: tornado periodic damage uses calc4 (par1 = 15) cadence on remaining frames', async () => {
    const registry = await getSharedDataRegistry()
    const engine = new MissileEngine(registry)
    const druid = makeUnit(registry, 'dru', { x: 0, y: 0 }, 'player')
    engine.spawnMissile({
      missileNameOrId: 'tornado', sourceSkillId: 245, slvl: 1, owner: druid,
      startX: 0, startY: 0, targetX: 0, targetY: 0,
      vx: 0, vy: 0, dmgPacket: { skillId: 245, attackKind: 'spell', elemType: 'none', srcDam: 0, autoHit: true, minDam256: 256, maxDam256: 256 } as never,
    })
    const pulseTicks: number[] = []
    for (let t = 1; t <= 75; t++) {
      // Fresh far-away targets each tick (outside contact radius, inside 3-subtile aura radius).
      const victim = makeUnit(registry, `mon-${t}`, { x: 50, y: 0 })
      const out = engine.tick(t, [victim], new Map([[victim.id, { x: 50, y: 0 }]]))
      if (out.hits.some(h => h.missileName === 'tornado')) pulseTicks.push(t)
    }
    expect(pulseTicks.length).toBeGreaterThan(0)
    for (const t of pulseTicks) expect((75 - t) % 15).toBe(0)
  })

  it('#1225: volcano (pSrvDoFunc 28) spawns SubMissile1 only in the Param3..Param4 window at calc4 cadence', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('volcano')!
    expect(rec.pSrvDoFunc).toBe(28)
    expect(rec.subMissile1).toBe('volcano debris 2')
    expect([rec.param1, rec.param2, rec.param3, rec.param4]).toEqual([0, 0, 2, 128])
    const engine = new MissileEngine(registry)
    const druid = makeUnit(registry, 'dru', { x: 0, y: 0 }, 'player')
    const m = engine.spawnMissile({
      missileNameOrId: 'volcano', sourceSkillId: 244, slvl: 1, owner: druid,
      startX: 300, startY: 300, targetX: 300, targetY: 300,
    })!
    const range = m.maxRangeTicks
    expect(range).toBe(150)
    for (let t = 1; t <= range; t++) {
      const out = engine.tick(t)
      const debris = out.subMissilesSpawned.filter(n => n === 'volcano debris 2').length
      const others = out.subMissilesSpawned.filter(n => n !== 'volcano debris 2' && n !== 'volcano small fire')
      expect(others.filter(n => n.startsWith('volcano') || n.startsWith('erruption'))).toEqual([])
      const rem = range - t
      // Skills.txt Volcano calc4 = par2 = 2 (Missiles Param1 = 0)
      const expected = rem > 2 && rem < 128 && rem % 2 === 0 ? 1 : 0
      expect(debris, `tick ${t} remaining ${rem}`).toBe(expected)
    }
  })

  it('#1225: recycler delay (pSrvDoFunc 29, CorpseCycler #307) spawns no sub-missiles and heals once at remaining == Param1', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('recycler delay')!
    expect(rec.pSrvDoFunc).toBe(29)
    const engine = new MissileEngine(registry)
    const vine = makeUnit(registry, 'carrion-vine-owner', { x: 0, y: 0 }, 'player')
    vine.statList.setHp256(100 * FIXED_ONE)
    const m = engine.spawnMissile({
      missileNameOrId: 'recycler delay', sourceSkillId: 307, slvl: 1, owner: vine,
      startX: 0, startY: 0, targetX: 0, targetY: 0,
    })!
    let spawned = 0
    const healTicks: number[] = []
    for (let t = 1; t <= m.maxRangeTicks; t++) {
      const before = vine.statList.getHp256()
      spawned += engine.tick(t).subMissilesSpawned.length
      if (vine.statList.getHp256() !== before) healTicks.push(t)
    }
    expect(spawned).toBe(0)
    expect(healTicks).toEqual([m.maxRangeTicks - rec.param1])
  })

  it('#1226: moltenboulder (pSrvDoFunc 6) drops exactly 1 firepath per sub-tile advanced; emerge drops none', async () => {
    const registry = await getSharedDataRegistry()
    expect(registry.getMissileByName('moltenboulder')?.pSrvDoFunc).toBe(6)
    expect(registry.getMissileByName('moltenboulderemerge')?.pSrvDoFunc).toBe(1)
    const engine = new MissileEngine(registry)
    const druid = makeUnit(registry, 'dru', { x: 0, y: 0 }, 'player')
    const m = engine.spawnMissile({
      missileNameOrId: 'moltenboulder', sourceSkillId: 229, slvl: 1, owner: druid,
      startX: 0, startY: 0, targetX: 5000, targetY: 0,
    })!
    let firepaths = 0
    let xSeenByDoFunc = 0
    for (let t = 1; t <= 60; t++) {
      xSeenByDoFunc = m.x
      firepaths += engine.tick(t).subMissilesSpawned.filter(n => n === 'moltenboulderfirepath').length
    }
    expect(xSeenByDoFunc).toBeGreaterThan(100)
    expect(firepaths).toBe(Math.floor((xSeenByDoFunc + 1e-6) / MISSILE_SUBTILE_FLAT_PX))

    const engine2 = new MissileEngine(registry)
    const e = engine2.spawnMissile({
      missileNameOrId: 'moltenboulderemerge', sourceSkillId: 229, slvl: 1, owner: druid,
      startX: 0, startY: 0, targetX: 5000, targetY: 0,
    })!
    let emergeSubs = 0
    for (let t = 1; t <= e.maxRangeTicks; t++) {
      emergeSubs += engine2.tick(t).subMissilesSpawned.filter(n => n === 'moltenboulderfirepath').length
    }
    expect(emergeSubs).toBe(0)
  })

  it('#1227: rabiesplague (pSrvDoFunc 30) follows the infected unit and releases rabiescontagion every Param1 = 4 frames', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('rabiesplague')!
    expect([rec.pSrvDoFunc, rec.param1, rec.param2, rec.subMissile1]).toEqual([30, 4, 7, 'rabiescontagion'])
    expect(registry.getMissileByName('armageddoncontrol')?.pSrvDoFunc).toBe(1)
    const engine = new MissileEngine(registry)
    const druid = makeUnit(registry, 'dru', { x: 0, y: 0 }, 'player')
    const infected = makeUnit(registry, 'mon-infected', { x: 200, y: 100 })
    // SKILLS_SrvDo121_Rabies: pOwner = infected target, targetX/targetY = casting druid.
    const m = engine.spawnMissile({
      missileNameOrId: 'rabiesplague', sourceSkillId: 238, slvl: 1, owner: infected, linkedUnit: druid,
      startX: 200, startY: 100, targetX: 200, targetY: 100, maxRangeTicks: 40,
    })!
    const contagionTicks: number[] = []
    for (let t = 1; t < 40; t++) {
      const pos = { x: 200 + t * 3, y: 100 }
      const out = engine.tick(t, [], new Map([[infected.id, pos]]))
      expect(m.x).toBe(pos.x)
      expect(out.subMissilesSpawned).not.toContain('armageddonrock')
      if (out.subMissilesSpawned.includes('rabiescontagion')) contagionTicks.push(t)
    }
    expect(contagionTicks.length).toBeGreaterThan(5)
    for (const t of contagionTicks) expect((40 - t) % 4).toBe(0)
    const contagions = liveMissiles(engine).filter(x => x.name === 'rabiescontagion')
    expect(contagions.length).toBeGreaterThan(0)
    // MISSMODE_SrvDo30: missileParams.pOwner = unit resolved from targetX/targetY (the druid).
    for (const c of contagions) expect(c.owner.id).toBe('dru')
  })

  it('#1227: rabiesplague without its targetX/targetY unit dies (SrvDo30 returns 2) and armageddoncontrol never takes the SrvDo30 path', async () => {
    const registry = await getSharedDataRegistry()
    const engine = new MissileEngine(registry)
    const infected = makeUnit(registry, 'mon-infected', { x: 200, y: 100 })
    const m = engine.spawnMissile({
      missileNameOrId: 'rabiesplague', sourceSkillId: 238, slvl: 1, owner: infected,
      startX: 200, startY: 100, targetX: 200, targetY: 100, maxRangeTicks: 40,
    })!
    expect(engine.tick(1).subMissilesSpawned).toEqual([])
    expect(m.expired).toBe(true)

    const engine2 = new MissileEngine(registry)
    const druid = makeUnit(registry, 'dru', { x: 0, y: 0 }, 'player')
    engine2.spawnMissile({
      missileNameOrId: 'armageddoncontrol', sourceSkillId: 249, slvl: 1, owner: druid,
      startX: 0, startY: 0, targetX: 0, targetY: 0,
    })
    for (let t = 1; t <= 20; t++) expect(engine2.tick(t).subMissilesSpawned).not.toContain('rabiescontagion')
  })

  it('#1228: firestormmaker is handled by the SrvDo23 path-step code path', async () => {
    const registry = await getSharedDataRegistry()
    expect(registry.getMissileByName('firestormmaker')?.pSrvDoFunc).toBe(23)
    const engine = new MissileEngine(registry)
    const druid = makeUnit(registry, 'dru', { x: 0, y: 0 }, 'player')
    const m = engine.spawnMissile({
      missileNameOrId: 'firestormmaker', sourceSkillId: 225, slvl: 1, owner: druid,
      startX: 0, startY: 0, targetX: 5000, targetY: 0,
    })!
    let firestorms = 0
    let ticksWithSpawn = 0
    let flat = 0
    let last = { x: m.x, y: m.y }
    for (let t = 1; t <= 30; t++) {
      flat += Math.hypot(m.x - last.x, (m.y - last.y) / 0.5)
      last = { x: m.x, y: m.y }
      const n = engine.tick(t).subMissilesSpawned.filter(x => x === 'firestorm').length
      firestorms += n
      if (n > 0) ticksWithSpawn += 1
    }
    expect(firestorms).toBe(ticksWithSpawn)
    expect(firestorms).toBe(Math.floor((flat + 1e-6) / MISSILE_SUBTILE_FLAT_PX))
    expect(firestorms).toBeLessThan(30)
  })

  it('#1228: plague vines (pSrvDoFunc 26) spawn their trail only every Param1 frames and are not jittered', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('plague vines')!
    expect([rec.pSrvDoFunc, rec.param1, rec.subMissile1]).toEqual([26, 9, 'plague vines trail'])
    const engine = new MissileEngine(registry)
    const druid = makeUnit(registry, 'dru', { x: 0, y: 0 }, 'player')
    const m = engine.spawnMissile({
      missileNameOrId: 'plague vines', sourceSkillId: 222, slvl: 1, owner: druid,
      startX: 0, startY: 50, targetX: 5000, targetY: 50,
    })!
    const range = m.maxRangeTicks
    const trailTicks: number[] = []
    for (let t = 1; t < range; t++) {
      const out = engine.tick(t)
      expect(m.y).toBe(50)
      if (out.subMissilesSpawned.includes('plague vines trail')) trailTicks.push(t)
    }
    expect(trailTicks.length).toBeGreaterThan(0)
    for (const t of trailTicks) expect((range - t) % 9).toBe(0)
  })

  it('#1225/#1228: erruption center (pSrvDoFunc 25) spawns cracks on the Eruption calc2 (par2 = 6) cadence', async () => {
    const registry = await getSharedDataRegistry()
    expect(registry.getMissileByName('erruption center')?.pSrvDoFunc).toBe(25)
    const engine = new MissileEngine(registry)
    const druid = makeUnit(registry, 'dru', { x: 0, y: 0 }, 'player')
    const m = engine.spawnMissile({
      missileNameOrId: 'erruption center', sourceSkillId: 234, slvl: 1, owner: druid,
      startX: 400, startY: 400, targetX: 400, targetY: 400,
    })!
    const ticks: number[] = []
    for (let t = 1; t < m.maxRangeTicks; t++) {
      const out = engine.tick(t)
      expect([m.x, m.y]).toEqual([400, 400])
      if (out.subMissilesSpawned.includes('erruption crack 1')) ticks.push(t)
    }
    expect(ticks.length).toBeGreaterThan(0)
    for (const t of ticks) expect((m.maxRangeTicks - t) % 6).toBe(0)
  })
})

describe('#1229 druid transform client overlays (Skills.txt cltoverlaya / cltoverlayb)', () => {
  function makeEngine() {
    const engine = {
      world: {
        tick: 1,
        player: {
          x: 200, y: 200, hp: 500, maxHp: 500, mana: 500, maxMana: 500, level: 40,
          cooldown: 0, swingTicks: 0, charClass: 'dru', druidForm: 'human',
          skillLevels: { 223: 5, 224: 5, 228: 5 },
          baseSkillLevels: { 223: 5, 224: 5, 228: 5 },
        } as any,
        monsters: [],
        events: [],
      },
      projectiles: [] as any[],
      explosions: [],
      overlays: [] as any[],
      metrics: { casts: 0, playerHits: 0, castHits: 0, pickups: 0, inventoryRefusals: 0 },
      spawnOverlay: (token: string, pos: { x: number; y: number }) => {
        engine.overlays.push({ token, x: pos.x, y: pos.y })
      },
    } as any
    return engine
  }

  it('matches the Skills.txt cltoverlaya/cltoverlayb columns', async () => {
    const registry = await getSharedDataRegistry()
    for (const id of [223, 228] as const) {
      const rec = registry.getSkillById(id)!
      expect(DRUID_TRANSFORM_CLT_OVERLAYS_113C[id]).toEqual({ into: rec.cltOverlayA, undo: rec.cltOverlayB })
    }
  })

  for (const [skillId, into, undo] of [[223, 'wolf_into', 'wolf_undo'], [228, 'bear_into', 'bear_undo']] as const) {
    it(`server morph #${skillId} emits ${into} and unmorph emits ${undo}`, () => {
      const engine = makeEngine()
      const ctx = { engine, runtime: { level: 'Blood Moor', levelId: 2, act: 1, grid: {} as any }, hudManager: null, status: { textContent: null } } as any
      expect(castSkill(skillId, 250, 200, ctx)).toBe(true)
      expect(engine.overlays.map((o: any) => o.token)).toEqual([into])
      engine.world.player.cooldown = 0
      expect(castSkill(skillId, 250, 200, ctx)).toBe(true)
      expect(engine.overlays.map((o: any) => o.token)).toEqual([into, undo])
    })
  }

  it('src/server contains no invented `transform1` overlay key', () => {
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.ts$/.test(name) && readFileSync(p, 'utf8').includes('transform1')) hits.push(p)
      }
    }
    walk(join(__dirname, '..', 'src', 'server'))
    expect(hits).toEqual([])
  })
})
