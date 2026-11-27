import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import { tickProjectiles } from '../src/server/skills/skills.ts'
import type { Projectile } from '../src/common/skills/missiles-data.ts'
import {
  MISSILE_PIERCE_ROLL_CAP,
  advanceUnitPierceSeed,
  resolveUnitPierceTotal,
  resolveUnitSkillPierce,
  rollMissilePierceIdx,
} from '../src/server/engine/missile-pierce.ts'
import { computeDiminishingReturns } from '../src/common/data/calc-ast.ts'

/**
 * Issue #1420: 1.13c missile pierce is the `pierce_idx` (stat #328) mechanism.
 *
 * - creation `samples/d2/D2Game.dll` `0x6FC8F660`: Missiles.txt `Pierce` flag gate, `total = item_pierce (#156) +
 *   skill_pierce (#166)` of the owner, `SEED_InitLowSeed(owner base pierce_idx)` (`{ lo, hi: 666 }`), then
 *   `while (n < 4 && rand % 100 < total) n++`, stored on the missile;
 * - hit `0x6FC58F40` (from `0x6FC5EDE0` @ `0x6FC5EF2A`): `pierce_idx > 0` => decrement and keep flying, otherwise
 *   CollideKill decides;
 * - Skills.txt Pierce (#33) `passivestat1 = skill_pierce`, `passivecalc1 = dm12` (Param1 = 10, Param2 = 100).
 */

function unit(id: string, hp = 0) {
  const statList = new UnitStatList()
  if (hp > 0) statList.setHp256(hp * 256)
  return { id, name: id, statList, stateBus: new StateBus(statList) } as any
}

function lineOfTargets(n: number) {
  const targets = Array.from({ length: n }, (_, i) => unit(`mon_${String(i)}`, 100000))
  const positions = new Map<string, { x: number; y: number }>(targets.map((t, i) => [t.id, { x: 60 + i * 40, y: 0 }]))
  return { targets, positions }
}

function flyArrow(engine: MissileEngine, missile: string, owner: any, n: number) {
  const { targets, positions } = lineOfTargets(n)
  const m = engine.spawnMissile({
    missileNameOrId: missile,
    sourceSkillId: 0,
    slvl: 1,
    owner,
    startX: 0,
    startY: 0,
    targetX: 2000,
    targetY: 0,
    maxRangeTicks: 400,
    dmgPacket: { skillId: 0, attackKind: 'spell', elemType: 'none', autoHit: true, elemMin256: 256, elemMax256: 256 },
  })!
  const hitIds = new Set<string>()
  for (let t = 1; t <= 120 && !m.expired; t++) {
    const res = engine.tick(t, targets, positions)
    for (const h of res.hits) if (h.missileName === m.name) hitIds.add(h.targetId)
  }
  return { m, hitIds }
}

describe('Issue #1420: 1.13c pierce_idx creation roll + per-hit consumption', () => {
  it('rollMissilePierceIdx follows SEED_InitLowSeed(lo, 666) + consecutive rand%100 < total, capped at 4', () => {
    // seed lo = 0, hi = 666: first SEED_Rand -> lo = 0 * 0x6AC690C5 + 666 = 666 -> 666 % 100 = 66.
    expect(rollMissilePierceIdx(66, 0)).toBe(0)
    expect(rollMissilePierceIdx(67, 0)).toBeGreaterThanOrEqual(1)
    expect(rollMissilePierceIdx(0, 0)).toBe(0)
    expect(rollMissilePierceIdx(100, 12345)).toBe(MISSILE_PIERCE_ROLL_CAP)
    expect(rollMissilePierceIdx(250, 7)).toBe(4) // `cmp ebx, 4` cap even above 100
    // Deterministic per seed and distribution of consecutive rolls (geometric, truncated at 4) for total = 50.
    const counts = [0, 0, 0, 0, 0]
    for (let s = 0; s < 4000; s++) {
      const n = rollMissilePierceIdx(50, s)
      expect(rollMissilePierceIdx(50, s)).toBe(n)
      counts[n]! += 1
    }
    expect(counts[0]! / 4000).toBeGreaterThan(0.4)
    expect(counts[0]! / 4000).toBeLessThan(0.6)
    expect(counts[4]! / 4000).toBeGreaterThan(0.03)
    expect(counts[4]! / 4000).toBeLessThan(0.1)
  })

  it('skill_pierce comes from Skills.txt Pierce (#33) passivecalc1 = dm12 (10, 100), not an engine formula', async () => {
    const registry = await getSharedDataRegistry()
    const owner = unit('ama')
    expect(resolveUnitSkillPierce(owner, registry)).toBe(0)
    for (const slvl of [1, 5, 10, 20, 30]) {
      owner.statList.setBaseSkillLevel(33, slvl)
      expect(resolveUnitSkillPierce(owner, registry)).toBe(computeDiminishingReturns(10, 100, slvl))
    }
    owner.statList.addStat('item_pierce', 7)
    expect(resolveUnitPierceTotal(owner, registry)).toBe(computeDiminishingReturns(10, 100, 30) + 7)
  })

  it('advanceUnitPierceSeed increments the owner base pierce_idx attack counter (0x6FCEE520)', () => {
    const owner = unit('ama')
    expect(owner.statList.getBaseStat('pierce_idx')).toBe(0)
    advanceUnitPierceSeed(owner)
    advanceUnitPierceSeed(owner)
    expect(owner.statList.getBaseStat('pierce_idx')).toBe(2)
  })

  it('arrow (Pierce=1, CollideKill=1) from an owner without pierce stats dies on the first target', async () => {
    const registry = await getSharedDataRegistry()
    const engine = new MissileEngine(registry)
    const { m, hitIds } = flyArrow(engine, 'arrow', unit('rogue'), 6)
    expect(m.canPierce).toBe(true)
    expect(m.pierceIdx).toBe(0)
    expect(m.expired).toBe(true)
    expect([...hitIds]).toEqual(['mon_0'])
  })

  it('arrow with item_pierce = 100 pierces exactly 4 times (5 targets) then dies', async () => {
    const registry = await getSharedDataRegistry()
    const engine = new MissileEngine(registry)
    const owner = unit('ama')
    owner.statList.addStat('item_pierce', 100)
    const { m, hitIds } = flyArrow(engine, 'arrow', owner, 7)
    expect(m.expired).toBe(true)
    expect(m.pierceIdx).toBe(0)
    expect(m.pierceCount).toBe(4)
    expect([...hitIds]).toEqual(['mon_0', 'mon_1', 'mon_2', 'mon_3', 'mon_4'])
  })

  it('arrow with item_pierce = 50 stores the creation roll seeded by the owner attack counter (reproducible)', async () => {
    const registry = await getSharedDataRegistry()
    const engine = new MissileEngine(registry)
    for (let attack = 0; attack < 20; attack++) {
      const owner = unit('ama')
      owner.statList.addStat('item_pierce', 50)
      owner.statList.setBaseStat('pierce_idx', attack)
      const expected = rollMissilePierceIdx(50, attack)
      const { m, hitIds } = flyArrow(engine, 'arrow', owner, 7)
      expect(m.pierceCount).toBe(expected)
      expect(hitIds.size).toBe(expected + 1)
    }
  })

  it('guidedarrow has no Missiles.txt Pierce flag: never rolls or consumes pierce even with item_pierce = 100', async () => {
    const registry = await getSharedDataRegistry()
    expect(registry.getMissileByName('guidedarrow')?.pierce).toBe(false)
    const engine = new MissileEngine(registry)
    const owner = unit('ama')
    owner.statList.addStat('item_pierce', 100)
    const m = engine.spawnMissile({
      missileNameOrId: 'guidedarrow', sourceSkillId: 22, slvl: 1, owner, startX: 0, startY: 0, targetX: 100, targetY: 0,
    })!
    expect(m.canPierce).toBe(false)
    expect(m.pierceIdx).toBe(0)
  })

  it('lightningbolt (Pierce empty, CollideKill=0) passes through every target without reading pierce stats', async () => {
    const registry = await getSharedDataRegistry()
    const rec = registry.getMissileByName('lightningbolt')!
    expect(rec.pierce).toBe(false)
    expect(rec.collideKill).toBe(false)
    const engine = new MissileEngine(registry)
    const owner = unit('sor')
    owner.statList.addStat('item_pierce', 100)
    const { m, hitIds } = flyArrow(engine, 'lightningbolt', owner, 6)
    expect(m.canPierce).toBe(false)
    expect(m.pierceIdx).toBe(0)
    expect(hitIds.size).toBe(6)
  })

  it('every Missiles.txt Pierce=1 row (incl. monster arrows/javelins) gets pierce_idx 0 without owner pierce stats', async () => {
    const registry = await getSharedDataRegistry()
    const engine = new MissileEngine(registry)
    const owner = unit('mon')
    let checked = 0
    for (let id = 0; id < 1000; id++) {
      const rec = registry.getMissileById(id)
      if (!rec?.pierce) continue
      const m = engine.spawnMissile({
        missileNameOrId: id, sourceSkillId: 0, slvl: 1, owner, startX: 0, startY: 0, targetX: 10, targetY: 0,
      })!
      expect(m.canPierce).toBe(true)
      expect(m.pierceIdx).toBe(0)
      checked += 1
    }
    expect(checked).toBeGreaterThan(50)
  })

  it('legacy tickProjectiles: pierce total is rolled once (no 100% default, no fixed per-hit sequence)', () => {
    const mk = (extra: Partial<Projectile>): Projectile => ({
      skillId: '6', missileType: 'magicarrow', x: 100, y: 100, vx: 10, vy: 0, damage: 10, ttl: 60, fromPlayer: true,
      pierce: true, maxPierceCount: 4, ...extra,
    })
    const targets = Array.from({ length: 6 }, (_, i) => ({ index: i, x: 130 + i * 20, y: 100, radius: 6, alive: true }))
    const run = (p: Projectile) => {
      let ps: readonly Projectile[] = [p]
      let hits = 0
      for (let t = 0; t < 60 && ps.length > 0; t++) {
        const out = tickProjectiles(ps, targets, { overlap: () => 0 })
        hits += out.hits.filter(h => h.missileType === 'magicarrow').length
        ps = out.alive.filter(x => x.missileType === 'magicarrow')
      }
      return hits
    }
    // maxPierceCount without a pierce total: no pierce (was `pierceChancePct ?? 100`).
    expect(run(mk({}))).toBe(1)
    expect(run(mk({ pierceChancePct: 100 }))).toBe(5)
    for (let seed = 0; seed < 10; seed++) {
      expect(run(mk({ pierceChancePct: 50, seed }))).toBe(rollMissilePierceIdx(50, seed) + 1)
    }
  })
})
