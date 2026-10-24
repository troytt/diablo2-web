/**
 * VFX-B19-7 (#1230): scene Telekinesis spawns only the Skills.txt #43 castoverlay (light_cast_2) on
 * the caster — tgtoverlay is empty and SrvDo021_Telekinesis puts no overlay on the target.
 * VFX-B19-8 (#1231): scene Nova uses the real Missiles.txt row 'nova' (#90); no 'electricnova' alias.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { spawnNovaRing } from '../src/server/engine/missile-engine.ts'
import { castSkill } from '../src/server/skills/skills.ts'

function makeEngine(monsters: any[] = []) {
  const engine = {
    world: {
      tick: 1,
      player: {
        x: 200, y: 200, hp: 500, maxHp: 500, mana: 500, maxMana: 500, level: 40, xp: 0,
        cooldown: 0, swingTicks: 0, charClass: 'sor',
        skillLevels: { 43: 5, 48: 5 },
        baseSkillLevels: { 43: 5, 48: 5 },
      } as any,
      monsters,
      events: [] as any[],
      kills: 0,
    },
    projectiles: [] as any[],
    explosions: [],
    overlays: [] as any[],
    metrics: { casts: 0, playerHits: 0, castHits: 0, pickups: 0, inventoryRefusals: 0 },
    spawnOverlay: (token: string, pos: { x: number; y: number }, anchor?: string) => {
      engine.overlays.push({ token, x: pos.x, y: pos.y, anchor })
    },
  } as any
  return engine
}

function ctxFor(engine: any) {
  return { engine, runtime: { level: 'Blood Moor', levelId: 2, act: 1 }, hudManager: null, status: { textContent: null } } as any
}

describe('#1230 scene Telekinesis overlays (Skills.txt #43)', () => {
  it('Skills.txt #43 castoverlay = light_cast_2, tgtoverlay empty', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getSkillById(43) as any
    expect(String(rec.castOverlay ?? '').toLowerCase()).toBe('light_cast_2')
    expect(String(rec.tgtOverlay ?? '')).toBe('')
  })

  it('casting on a monster spawns exactly one light_cast_2, anchored to the caster', () => {
    const monster = {
      index: 0, x: 300, y: 220, hp: 10000, maxHp: 10000, state: 'idle',
      stats: { id: 'zombie1', name: 'Zombie', xp: 1, modifiers: [] },
    }
    const engine = makeEngine([monster])
    expect(castSkill(43, 300, 220, ctxFor(engine))).toBe(true)
    expect(monster.hp).toBeLessThan(10000)
    const tk = engine.overlays.filter((o: any) => o.token === 'light_cast_2')
    expect(tk).toHaveLength(1)
    expect(tk[0]).toMatchObject({ x: 200, y: 200, anchor: 'player' })
  })

  it('generic ground cast also spawns only the caster overlay', () => {
    const engine = makeEngine([])
    expect(castSkill(43, 320, 240, ctxFor(engine))).toBe(true)
    expect(engine.overlays.filter((o: any) => o.token === 'light_cast_2')).toEqual([
      { token: 'light_cast_2', x: 200, y: 200, anchor: 'player' },
    ])
  })
})

describe('#1231 scene Nova uses the real Missiles.txt row "nova"', () => {
  it('Skills.txt #48 srvmissilea/cltmissilea = nova, and "nova" is Missiles.txt #90', async () => {
    const registry = await getSharedDataRegistry()
    const skill = registry.getSkillById(48) as any
    expect(skill.srvMissileA).toBe('nova')
    expect(skill.cltMissileA).toBe('nova')
    expect(registry.getMissileByName('nova')?.id).toBe(90)
    expect(registry.getMissileByName('electricnova')).toBeUndefined()
  })

  it('a scene Nova cast spawns 64 missiles of type nova', () => {
    const engine = makeEngine([])
    expect(castSkill(48, 260, 200, ctxFor(engine))).toBe(true)
    expect(engine.projectiles).toHaveLength(64)
    for (const p of engine.projectiles) expect(p.missileType).toBe('nova')
  })

  it('spawnNovaRing defaults to missile type nova', () => {
    const ring = spawnNovaRing(0, 0, 10)
    expect(ring).toHaveLength(64)
    for (const b of ring) expect(b.missileType).toBe('nova')
  })

  it("'electricnova' appears nowhere in src/", () => {
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx|js|mjs|json)$/.test(name) && /electricnova/.test(readFileSync(p, 'utf8'))) hits.push(p)
      }
    }
    walk(join(__dirname, '../src'))
    expect(hits).toEqual([])
  })
})
