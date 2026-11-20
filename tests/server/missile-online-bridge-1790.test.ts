/**
 * #1790: `GameInstance.stepMissiles` routes every room missile's per-frame `pSrvDoFunc`
 * (`gMissileSrvDoFuncTable` @ `0x6FD2D970`) and collision / expiry `pSrvHitFunc`
 * (`gpMissileSrvHitFnTable` @ `0x6FD2DA48`) through `MissileEngine` instead of a straight-line
 * bullet loop. Ground truth: `kb/skills/missiles/d2game-missile-srv-tables-113c.md`,
 * `kb/skills/missiles/d2game-srvhit-radius-113c.md`, `kb/skills/player/skills-sor-cold.md` 4.7,
 * `kb/skills/player/skills-sor-fire.md` 4.6, `kb/skills/player/skills-ama-bow-crossbow.md` 7 and
 * `kb/skills/player/skills-pal-combat.md` 3.7.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry, type MissileRecord } from '../../src/common/data/data-registry.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  BLESSED_HAMMER_DR_SUBTILES_113C,
  BLESSED_HAMMER_PATH_POINTS_113C,
  FROZEN_ORB_X_POSITIONS,
  FROZEN_ORB_Y_POSITIONS,
  MissileEngine,
  blessedHammerPathPoint113c,
  classifyOnlineSrvDoFunc113c,
  classifyOnlineSrvHitFunc113c,
} from '../../src/server/engine/missile-engine.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import { writeD2sSave113c } from '../../src/server/save/d2s-writer.ts'
import { createSampleD2sCharacterData } from '../e2e/server-reuse/helpers.ts'

type AnyEvent = ServerEvent & Record<string, unknown>

interface MonView {
  hp: number
  x: number
  y: number
  dead: boolean
}
interface MissileView {
  missileId: number
  x: number
  y: number
}
/** Private room internals driven directly so each case controls the rolled damage. */
interface RoomInternals {
  readonly missiles: Map<number, MissileView>
  readonly monsters: Map<number, MonView>
  readonly players: Map<number, unknown>
  resolvePlayerSkillCast(player: unknown, skillId: number): CastView | null
  launchPlayerSkillMissile(
    player: unknown,
    cast: CastView,
    row: MissileRecord,
    tx: number,
    ty: number,
    damage: number,
    opts?: { lockedMonsterId?: number },
  ): void
  launchFireWall113c(player: unknown, cast: CastView, row: MissileRecord, tx: number, ty: number): void
}
interface CastView {
  readonly slvl: number
  readonly missile: MissileRecord | undefined
  readonly evalResult: Record<string, number>
}

const registry = getSharedDataRegistry()
const room = (game: GameInstance): RoomInternals => game as unknown as RoomInternals

function row(name: string): MissileRecord {
  const r = registry.getMissileByName(name)
  if (r === undefined) throw new Error(`no Missiles.txt row ${name}`)
  return r
}

function setupGame(seed: number, charClass: number, skills: Readonly<Record<number, number>>) {
  const game = new GameInstance({ seed, difficulty: 0, areaId: 2 })
  const playerId = game.connectPlayer({
    d2sBytes: writeD2sSave113c(
      createSampleD2sCharacterData({
        name: `Bridge${charClass}`,
        charClass,
        level: 40,
        skillLevels: new Uint8Array(30),
        attributesOverrides: { maxManaFixed: 5000 * FIXED_ONE, manaFixed: 5000 * FIXED_ONE },
      }),
    ),
    x: 100,
    y: 100,
    areaId: 2,
    skills,
  })
  game.drainEvents(playerId)
  return { game, playerId, player: room(game).players.get(playerId) }
}

function dummy(game: GameInstance, x: number, y: number, hp = 50_000): number {
  const id = game.spawnMonster({ defId: 'fallen1', x, y, areaId: 2, hp, maxHp: hp, aiDisabled: true })
  const m = room(game).monsters.get(id) as unknown as { damageRegen?: number }
  if (m !== undefined) m.damageRegen = 0
  return id
}

function castOf(game: GameInstance, player: unknown, skillId: number): CastView {
  const cast = room(game).resolvePlayerSkillCast(player, skillId)
  if (cast === null) throw new Error(`cast ${skillId} rejected`)
  return cast
}

function stepCollect(game: GameInstance, playerId: number, frames: number): AnyEvent[] {
  const out: AnyEvent[] = []
  for (let i = 0; i < frames; i++) {
    game.stepFrames(1)
    out.push(...(game.drainEvents(playerId) as AnyEvent[]))
  }
  return out
}

function created(events: readonly AnyEvent[], name: string): AnyEvent[] {
  const id = row(name).id
  return events.filter((e) => e.type === 'CreateMissile' && e.missileClassId === id)
}

const hpOf = (game: GameInstance, id: number): number => room(game).monsters.get(id)!.hp

describe('#1790 Frozen Orb (SrvDo15 / SrvHit29 / SrvDo16)', () => {
  it('room cast: 30 spiral bolts (1 per frame, index += 19 mod 64), then a 16-bolt nova at range end', () => {
    const { game, playerId } = setupGame(0x1790, 1, { 64: 10 })
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 64, x: 130, y: 100, hand: 'right' })
    const ev = stepCollect(game, playerId, 80)
    expect(created(ev, 'frozenorb')).toHaveLength(1)
    expect(created(ev, 'frozenorbbolt')).toHaveLength(30)
    expect(created(ev, 'frozenorbnova')).toHaveLength(16)
  })

  it('the orb pierces a monster in its path (CollideKill = 0) and still releases all 16 novas', () => {
    const { game, playerId, player } = setupGame(0x1791, 1, { 64: 10 })
    const mid = dummy(game, 106, 100)
    room(game).launchPlayerSkillMissile(player, castOf(game, player, 64), row('frozenorb'), 130, 100, 300)
    const ev = stepCollect(game, playerId, 80)
    expect(hpOf(game, mid)).toBeLessThan(50_000)
    expect(created(ev, 'frozenorbnova')).toHaveLength(16)
  })

  it('engine: bolt directions walk the radius-30 table by Param2 = 19; nova bolts curl 45 degrees', () => {
    const engine = new MissileEngine(registry)
    const orb = row('frozenorb')
    const st = engine.createOnlineMissileState113c({ row: orb, sourceSkillId: 64, slvl: 1, x: 0, y: 0, vx: 1, vy: 0, remainingFrames: 30 })
    const idx: number[] = []
    for (let f = 1; f <= 4; f++) {
      st.ageFrames = f
      const res = engine.stepOnlineMissileSrvDo113c(st, [])
      expect(res.spawns).toHaveLength(1)
      const s = res.spawns[0]!
      idx.push(FROZEN_ORB_X_POSITIONS.findIndex((x, i) => x === s.targetX && FROZEN_ORB_Y_POSITIONS[i] === s.targetY))
    }
    expect(idx).toEqual([0, 19, 38, 57])

    const nova = engine.createOnlineMissileState113c({
      row: row('frozenorbnova'), sourceSkillId: 64, slvl: 1, x: 0, y: 0, vx: 1.5, vy: 0, remainingFrames: 4,
      targetOffsetX: 30, targetOffsetY: 0,
    })
    engine.stepOnlineMissileSrvDo113c(nova, [])
    expect([nova.targetOffsetX, nova.targetOffsetY]).toEqual([15, 15])
    expect(Math.atan2(nova.vy, nova.vx)).toBeCloseTo(Math.PI / 4, 6)
    expect(Math.hypot(nova.vx, nova.vy)).toBeCloseTo(1.5, 6)
  })
})

describe('#1790 Lightning Fury (SrvHit20) / Chain Lightning (SrvHit12) / Fire Ball (SrvHit01)', () => {
  it('Lightning Fury releases min(1 + slvl, targets) bolts at the other hostiles within 15 sub-tiles', () => {
    const { game, playerId, player } = setupGame(0x1792, 0, { 35: 5 })
    const a = dummy(game, 110, 100)
    const b = dummy(game, 114, 104)
    const c = dummy(game, 114, 96)
    const d = dummy(game, 114, 100)
    const far = dummy(game, 140, 100)
    room(game).launchPlayerSkillMissile(player, castOf(game, player, 35), row('lightningfury'), 110, 100, 400)
    const ev = stepCollect(game, playerId, 40)
    expect(created(ev, 'furylightning')).toHaveLength(3)
    for (const id of [a, b, c, d]) expect(hpOf(game, id)).toBeLessThan(50_000)
    expect(hpOf(game, far)).toBe(50_000)
  })

  it('a zero-damage Lightning Fury still runs SrvHit20 on contact but deals no damage (no minimum-1 hit)', () => {
    const { game, playerId, player } = setupGame(0x1793, 0, { 35: 5 })
    const a = dummy(game, 110, 100)
    const b = dummy(game, 114, 104)
    room(game).launchPlayerSkillMissile(player, castOf(game, player, 35), row('lightningfury'), 110, 100, 0)
    const ev = stepCollect(game, playerId, 40)
    expect(created(ev, 'furylightning')).toHaveLength(1)
    expect(hpOf(game, a)).toBe(50_000)
    expect(hpOf(game, b)).toBe(50_000)
  })

  it('Chain Lightning bounces to the nearest other hostile within auraRangeCalc (20) sub-tiles', () => {
    const { game, playerId, player } = setupGame(0x1794, 1, { 53: 10 })
    const ids = [dummy(game, 110, 100), dummy(game, 116, 100), dummy(game, 120, 100)]
    room(game).launchPlayerSkillMissile(player, castOf(game, player, 53), row('chainlightning'), 110, 100, 200)
    const ev = stepCollect(game, playerId, 60)
    for (const id of ids) expect(hpOf(game, id)).toBeLessThan(50_000)
    expect(created(ev, 'chainlightning').length).toBeGreaterThanOrEqual(2)
  })

  it('Fire Ball splashes every other hostile within its radius; units outside are untouched', () => {
    const { game, playerId, player } = setupGame(0x1795, 1, { 47: 10 })
    const a = dummy(game, 110, 100)
    const near = dummy(game, 112, 101)
    const far = dummy(game, 125, 100)
    room(game).launchPlayerSkillMissile(player, castOf(game, player, 47), row('fireball'), 110, 100, 300)
    stepCollect(game, playerId, 30)
    expect(hpOf(game, a)).toBeLessThan(50_000)
    expect(hpOf(game, near)).toBeLessThan(50_000)
    expect(hpOf(game, far)).toBe(50_000)
  })
})

describe('#1790 Guided Arrow (SrvDo07 / SrvHit10)', () => {
  it('a unit-locked arrow passes through other units and re-steers onto its moving target', () => {
    const { game, playerId, player } = setupGame(0x1796, 0, { 22: 10 })
    const blocker = dummy(game, 106, 100)
    const target = dummy(game, 114, 100)
    room(game).launchPlayerSkillMissile(player, castOf(game, player, 22), row('guidedarrow'), 114, 100, 250, {
      lockedMonsterId: target,
    })
    game.stepFrames(2)
    const t = room(game).monsters.get(target)!
    t.y = 106
    stepCollect(game, playerId, 40)
    expect(hpOf(game, blocker)).toBe(50_000)
    expect(hpOf(game, target)).toBeLessThan(50_000)
  })
})

describe('#1790 ground fire: Fire Wall (SrvDo024 / SrvDo06 / SrvDo05) and Meteor (SrvHit14)', () => {
  it('Fire Wall makers lay firewall pillars on every sub-tile and the patch burns a unit every frame', () => {
    const { game, playerId, player } = setupGame(0x1797, 1, { 51: 10 })
    const victim = dummy(game, 110, 100)
    const base = castOf(game, player, 51)
    const cast = { ...base, evalResult: { ...base.evalResult, minElemDmg256: 1024, maxElemDmg256: 1024 } }
    room(game).launchFireWall113c(player, cast, base.missile!, 110, 100)
    const ev = game.drainEvents(playerId) as AnyEvent[]
    const hpTrace: number[] = []
    for (let f = 0; f < 30; f++) {
      ev.push(...stepCollect(game, playerId, 1))
      hpTrace.push(hpOf(game, victim))
    }
    expect(created(ev, 'firewallmaker')).toHaveLength(2)
    expect(created(ev, 'firewall').length).toBeGreaterThanOrEqual(10)
    const drops = hpTrace.filter((hp, i) => hp < (i === 0 ? 50_000 : hpTrace[i - 1]!)).length
    expect(drops).toBeGreaterThanOrEqual(10)
  })

  it('Meteor: impact blast inside auraRangeCalc after Range frames, 18 meteorfire patches that keep burning', () => {
    const { game, playerId, player } = setupGame(0x1798, 1, { 56: 10 })
    const a = dummy(game, 110, 100)
    const b = dummy(game, 113, 101)
    const out = dummy(game, 130, 100)
    room(game).launchPlayerSkillMissile(player, castOf(game, player, 56), row('meteorcenter'), 110, 100, 700)
    const before = stepCollect(game, playerId, 58)
    expect(hpOf(game, a)).toBe(50_000)
    const ev = [...before, ...stepCollect(game, playerId, 4)]
    expect(created(ev, 'meteorfire')).toHaveLength(18)
    const afterImpact = hpOf(game, a)
    expect(afterImpact).toBeLessThan(50_000)
    expect(hpOf(game, b)).toBeLessThan(50_000)
    expect(hpOf(game, out)).toBe(50_000)
    stepCollect(game, playerId, 20)
    expect(hpOf(game, a)).toBeLessThan(afterImpact)
  })
})

describe('#1790 Blessed Hammer spiral (PATHTYPE_BLESSEDHAMMER, D2Common 0x6FDAB3C0)', () => {
  it('path points: 32 per turn, 9600/65536 sub-tiles of radius per point, 77 points', () => {
    expect(BLESSED_HAMMER_PATH_POINTS_113C).toBe(77)
    expect(blessedHammerPathPoint113c(0, 0, 0)).toEqual({ x: 0, y: 0 })
    const p32 = blessedHammerPathPoint113c(0, 0, 32)
    expect(p32.x).toBeCloseTo(-32 * BLESSED_HAMMER_DR_SUBTILES_113C, 5)
    expect(p32.y).toBeCloseTo(0, 5)
  })

  it('room hammer follows the spiral around the caster instead of flying at the target', () => {
    const { game, playerId, player } = setupGame(0x1799, 3, { 112: 10 })
    const onLine = dummy(game, 112, 100)
    const p = blessedHammerPathPoint113c(100, 100, 48)
    const onSpiral = dummy(game, Math.round(p.x), Math.round(p.y))
    room(game).launchPlayerSkillMissile(player, castOf(game, player, 112), row('blessedhammer'), 112, 100, 300)
    const id = [...room(game).missiles.values()].find((m) => m.missileId === row('blessedhammer').id)!
    let maxR = 0
    for (let f = 0; f < 90; f++) {
      game.stepFrames(1)
      maxR = Math.max(maxR, Math.hypot(id.x - 100, id.y - 100))
    }
    game.drainEvents(playerId)
    expect(maxR).toBeLessThanOrEqual(76 * BLESSED_HAMMER_DR_SUBTILES_113C + 1.5)
    expect(hpOf(game, onSpiral)).toBeLessThan(50_000)
    expect(hpOf(game, onLine)).toBe(50_000)
  })
})

describe('#1790 class-of-bug sweep over Missiles.txt', () => {
  it('every row is classified; 50+ rows are routed through MissileEngine; all child rows exist', () => {
    let routed = 0
    let total = 0
    const missingChildren: string[] = []
    for (let id = 0; id < 1000; id++) {
      const r = registry.getMissileById(id)
      if (r === undefined) continue
      total++
      const doKind = classifyOnlineSrvDoFunc113c(r.pSrvDoFunc)
      const hitKind = classifyOnlineSrvHitFunc113c(r.pSrvHitFunc)
      const spiral = r.pSrvDmgFunc === 5 || r.pCltDoFunc === 2
      if (spiral || (doKind !== 'standard' && doKind !== 'engine-only') || (hitKind !== 'none' && hitKind !== 'engine-only')) {
        routed++
        for (const col of [r.subMissile1, r.hitSubMissile1]) {
          const name = col.trim()
          if (name !== '' && registry.getMissileByName(name) === undefined) missingChildren.push(`${r.name}->${name}`)
        }
      }
    }
    expect(total).toBeGreaterThan(300)
    expect(routed).toBeGreaterThanOrEqual(50)
    expect(missingChildren).toEqual([])
  })

  it('the seven issue skills resolve to routed srvdo / srvhit functions', () => {
    const engine = new MissileEngine(registry)
    expect(engine.classifyOnlineSrvDo113c(row('frozenorb'))).toBe('orb')
    expect(engine.classifyOnlineSrvHit113c(row('frozenorb'))).toBe('orbnova')
    expect(engine.classifyOnlineSrvHit113c(row('lightningfury'))).toBe('fury')
    expect(engine.classifyOnlineSrvDo113c(row('guidedarrow'))).toBe('homing')
    expect(engine.classifyOnlineSrvDo113c(row('firewallmaker'))).toBe('pathspawner')
    expect(engine.classifyOnlineSrvDo113c(row('firewall'))).toBe('groundfire')
    expect(engine.classifyOnlineSrvHit113c(row('meteorcenter'))).toBe('meteor')
    expect(engine.classifyOnlineSrvDo113c(row('blessedhammer'))).toBe('spiral')
    expect(engine.classifyOnlineSrvHit113c(row('chainlightning'))).toBe('chain')
    expect(engine.classifyOnlineSrvDo113c(row('blizzardcenter'))).toBe('areaspawner')
  })
})
