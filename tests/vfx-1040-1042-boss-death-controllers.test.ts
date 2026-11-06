/**
 * Issues #1040 / #1041 / #1042: 1.13c D2Client MonUMod 22 `questcomplete` death shows of Blood Raven and Shenk.
 *
 * Ground truth (D2Client.dll 1.13c, see kb/monsters/d2client-boss-death-cltdo-113c.md):
 * - 0x6fad0fb0 (umod 22 event 1): class 267 (mode 0) -> 0x6fb02320, class 479 (mode 0) -> 0x6fb02bd0.
 * - 0x6fb02320: brdeathcontrol (#284) + SetTargetX(50), brdeathspirits1 (#296), brdeathsmokes1 (#293), once each.
 * - MissCltDoFunc[21] 0x6fb686f0: countdown; CltSubMissile1 brdeathlightningbolt; delay 0x6fb60050.
 * - 0x6fb02bd0: overseercontrol (#602) + SetTargetX(25).
 * - MissCltDoFunc[61] 0x6fb6a600: countdown; catapult cold ball (#416) / catapult meteor ball (#422) by seed & 1;
 *   delay 0x6fb5ff80 (20 / 15 / 10 / 5 / 25).
 */

import { homedir } from 'node:os'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  BR_DEATH_CONTROL_CLT_PARAM1,
  BR_DEATH_CONTROL_CLT_SUBMISSILE1,
  BR_DEATH_CONTROL_INITIAL_COUNTDOWN,
  OVERSEER_CONTROL_BALLS_113C,
  OVERSEER_CONTROL_INITIAL_COUNTDOWN,
  brDeathControlDelay,
  catapultBallTraj3d,
  overseerControlDelay,
} from '../src/client/world/boss-death-cltdo-113c.ts'
import { CANONICAL_113C_MISSILES, getMissileTxtData } from '../src/common/skills/missiles-data.ts'

const EXCEL = join(homedir(), 'd2-data', 'excel', 'Missiles.txt')

function readMissilesTxt(): Map<string, Record<string, string>> | null {
  let text: string
  try {
    text = readFileSync(EXCEL, 'latin1')
  } catch {
    return null
  }
  const lines = text.split(/\r?\n/).filter(l => l.length > 0)
  const header = lines[0]!.split('\t')
  const rows = new Map<string, Record<string, string>>()
  for (const line of lines.slice(1)) {
    const cells = line.split('\t')
    const row: Record<string, string> = {}
    header.forEach((h, i) => {
      row[h] = cells[i] ?? ''
    })
    if (row['Missile']) rows.set(row['Missile']!, row)
  }
  return rows
}

function makeWorld(seed: number) {
  const world = new ClientWorld()
  world.setCollisionChecker(() => false)
  world.setQuestFxSeed(seed)
  const spawned: { key: string; frame: number }[] = []
  const orig = world.spawnMissileByKey.bind(world)
  vi.spyOn(world, 'spawnMissileByKey').mockImplementation((key, sx, sy, tx, ty, opts) => {
    spawned.push({ key, frame: world.frameCount })
    return orig(key, sx, sy, tx, ty, opts)
  })
  return { world, spawned }
}

function assignMonster(world: ClientWorld, id: number, classId: number, x: number, y: number, bossMods?: number[]) {
  world.apply({
    type: 'UnitAssign',
    unit: { unitType: 'monster', id, classId, x, y, mode: 1, ...(bossMods ? { bossMods } : {}) },
  } as any)
}

function kill(world: ClientWorld, id: number) {
  world.apply({ type: 'UnitMode', unitType: 'monster', id, mode: 0, lifePct: 0 } as any)
}

function expectRealRows(keys: Iterable<string>) {
  for (const key of new Set(keys)) {
    const row = getMissileTxtData(key)
    expect(row.name, key).toBe(key)
  }
}

function srcFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...srcFiles(p))
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

const SRC = srcFiles(join(__dirname, '..', 'src'))

describe('Missiles.txt ground truth of the controllers', () => {
  const rows = readMissilesTxt()
  it.skipIf(rows === null)('brdeathcontrol / overseercontrol / catapult balls match the 1.13c rows', () => {
    const r = rows!
    expect(r.get('brdeathcontrol')).toMatchObject({ Id: '284', pCltDoFunc: '21', Range: '375', CltParam1: String(BR_DEATH_CONTROL_CLT_PARAM1), CltSubMissile1: BR_DEATH_CONTROL_CLT_SUBMISSILE1 })
    expect(r.get('brdeathspirits1')).toMatchObject({ Id: '296', ExplosionMissile: 'brdeathspiritnu', AlwaysExplode: '1', Range: '60' })
    expect(r.get('brdeathsmokes1')).toMatchObject({ Id: '293', ExplosionMissile: 'brdeathsmokenu', AlwaysExplode: '1', Range: '60' })
    expect(r.get('overseercontrol')).toMatchObject({ Id: '602', pCltDoFunc: '61', Range: '500' })
    expect(r.get('catapult cold ball')).toMatchObject({ Id: '416', Range: '25' })
    expect(r.get('catapult meteor ball')).toMatchObject({ Id: '422', Range: '25' })
    for (const ball of OVERSEER_CONTROL_BALLS_113C) {
      expect(CANONICAL_113C_MISSILES[ball]!.range).toBe(25)
    }
  })

  it('delay tables of 0x6fb60050 / 0x6fb5ff80 and the catapult trajectory', () => {
    expect([0, 124, 125, 174, 175, 299, 300, 374].map(brDeathControlDelay)).toEqual([25, 25, 10, 10, 3, 3, 15, 15])
    expect([0, 149, 150, 199, 200, 224, 225, 374, 375, 499].map(overseerControlDelay)).toEqual([
      20, 20, 15, 15, 10, 10, 5, 5, 25, 25,
    ])
    const t = catapultBallTraj3d()
    expect(t.z >> 11).toBe(400)
    expect(t.vz >> 11).toBe(-16)
    expect((t.z >> 11) / -(t.vz >> 11)).toBe(25)
  })
})

describe('Issue #1040: overseercontrol only lobs real catapult rows', () => {
  it('source no longer names the invented catapult keys', () => {
    const bad = /'catapult meteor'|'catapult cold'|'catapult plague'|'catapult charged ball|'catapult meteor exp'|'catapult cold explode'/
    expect(SRC.filter(f => bad.test(readFileSync(f, 'utf8')))).toEqual([])
  })

  it('Shenk (overseer1 + umod 22) runs 500 frames without throwing; balls only cold / meteor, 25-frame lead-in, 20-frame interval', () => {
    const { world, spawned } = makeWorld(0x1040)
    assignMonster(world, 4790, 479, 5000, 6000, [22])
    kill(world, 4790)
    const ctrls = world.getUnitsByType('missile').filter(m => m.missileKey === 'overseercontrol')
    expect(ctrls).toHaveLength(1)
    expect(ctrls[0]!.maxTicks).toBe(500)
    expect(ctrls[0]!.cltCountdown).toBe(OVERSEER_CONTROL_INITIAL_COUNTDOWN)
    const start = world.frameCount
    expect(() => {
      for (let i = 0; i < 500; i++) world.tick(40)
    }).not.toThrow()
    const balls = spawned.filter(s => s.key !== 'overseercontrol')
    expect(balls.length).toBeGreaterThan(10)
    for (const b of balls) expect(OVERSEER_CONTROL_BALLS_113C).toContain(b.key)
    expect(new Set(balls.map(b => b.key)).size).toBe(2)
    expectRealRows(spawned.map(s => s.key))
    const rel = balls.map(b => b.frame - start)
    expect(rel[0]!).toBeGreaterThanOrEqual(25)
    const early = rel.filter(f => f < 150)
    for (let i = 1; i < early.length; i++) expect(early[i]! - early[i - 1]!).toBe(20)
  })

  it('a catapult ball falls from z 400 to the ground over its Range 25', () => {
    const { world } = makeWorld(0x1041)
    assignMonster(world, 4791, 479, 5000, 6000, [22])
    kill(world, 4791)
    for (let i = 0; i < 26; i++) world.tick(40)
    const ball = world.getUnitsByType('missile').find(m => OVERSEER_CONTROL_BALLS_113C.includes(m.missileKey as never))
    expect(ball).toBeDefined()
    expect(ball!.maxTicks).toBe(25)
    expect(ball!.traj3d).toBeDefined()
    expect(Math.abs(ball!.x - 5000)).toBeLessThanOrEqual(10)
    expect(Math.abs(ball!.y - 6000)).toBeLessThanOrEqual(10)
  })
})

describe('Issue #1041: Blood Raven death creates brdeathspirits1 / brdeathsmokes1 once', () => {
  it("source no longer names 'brdeathspirits'", () => {
    expect(SRC.filter(f => /['"]brdeathspirits['"]/.test(readFileSync(f, 'utf8')))).toEqual([])
  })

  it('exactly one spirits1 / smokes1 / control on Blood Raven; S1 -> NU after 60 frames; 375 control frames do not throw', () => {
    const { world, spawned } = makeWorld(0x1042)
    assignMonster(world, 2670, 267, 5000, 6000, [22])
    kill(world, 2670)
    const missiles = () => world.getUnitsByType('missile')
    expect(missiles().filter(m => m.missileKey === 'brdeathcontrol')).toHaveLength(1)
    expect(missiles().filter(m => m.missileKey === 'brdeathspirits1')).toHaveLength(1)
    expect(missiles().filter(m => m.missileKey === 'brdeathsmokes1')).toHaveLength(1)
    const ctrl = missiles().find(m => m.missileKey === 'brdeathcontrol')!
    expect(ctrl.maxTicks).toBe(375)
    expect(ctrl.cltCountdown).toBe(BR_DEATH_CONTROL_INITIAL_COUNTDOWN)
    const start = world.frameCount
    for (let i = 0; i < 62; i++) world.tick(40)
    expect(missiles().some(m => m.missileKey === 'brdeathspiritnu')).toBe(true)
    expect(missiles().some(m => m.missileKey === 'brdeathsmokenu')).toBe(true)
    expect(() => {
      for (let i = 0; i < 375; i++) world.tick(40)
    }).not.toThrow()
    expect(spawned.filter(s => s.key === 'brdeathspirits1')).toHaveLength(1)
    expect(spawned.filter(s => s.key === 'brdeathsmokes1')).toHaveLength(1)
    expectRealRows(spawned.map(s => s.key))
    const bolts = spawned.filter(s => s.key === 'brdeathlightningbolt').map(s => s.frame - start)
    expect(bolts.length).toBeGreaterThan(5)
    expect(bolts[0]!).toBeGreaterThanOrEqual(50)
    expect(bolts[1]! - bolts[0]!).toBe(25)
  })
})

describe('Issue #1042: the overseer1 show is gated by MonUMod 22 questcomplete', () => {
  it('a plain overseer1 dies without overseercontrol and purges nothing', () => {
    const { world } = makeWorld(0x1043)
    assignMonster(world, 4792, 479, 5000, 6000)
    assignMonster(world, 4793, 480, 5004, 6004)
    const near = world.getUnitsByType('monster').find(m => m.id === 4793)!
    const before = near.tempSummonExpireTick
    kill(world, 4792)
    expect(world.getUnitsByType('missile').filter(m => m.missileKey === 'overseercontrol')).toHaveLength(0)
    expect(near.tempSummonExpireTick).toBe(before)
  })

  it('an overseer1 with umod 22 (Shenk) gets exactly one overseercontrol', () => {
    const { world } = makeWorld(0x1044)
    assignMonster(world, 4794, 479, 5000, 6000, [5, 22])
    kill(world, 4794)
    expect(world.getUnitsByType('missile').filter(m => m.missileKey === 'overseercontrol')).toHaveLength(1)
  })

  it('a Blood Raven without umod 22 has no brdeath show either (same 0x6fad0fb0 gate)', () => {
    const { world } = makeWorld(0x1045)
    assignMonster(world, 2671, 267, 5000, 6000)
    kill(world, 2671)
    expect(world.getUnitsByType('missile').filter(m => m.missileKey?.startsWith('brdeath'))).toHaveLength(0)
  })
})
