/**
 * Issues #1203..#1208 (batch VFX-B17): 1.13c D2Client boss death shows.
 *
 * Ground truth (D2Client.dll 1.13c, kb/monsters/d2client-boss-death-shows-113c.md):
 * - 0x6fad0fb0 (MonUMod 22 questcomplete event 1) class switch: 45, 156, 211, 229, 242, 243, 256, 267, 284 (mode 14),
 *   366, 479, 540..542, 544 only. No Uber boss (704..709), no Diablo clone (333), no Summoner (250).
 * - 0x6fb02600 (Diablo) stores the unit id in 0x6fba2134 and creates no missile.
 * - Death handlers create the controller without a range: lifetime = Missiles.txt Range.
 * - 0x6fb02270 (Mephisto): 299 mephistodeathcontrol + TargetX/Y 75, 358 mephistoholedelay, 306 mephistodonotdraw.
 * - MissCltDoFunc[26] 0x6fb6b780, [28] 0x6fb68010, MissCltHitFunc[33] 0x6fb65dd0.
 */

import { homedir } from 'node:os'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  BR_DEATH_CONTROL_CLT_PARAM1,
  MEPHISTO_DEATH_CONTROL_113C,
  MEPHISTO_DEATH_CONTROL_INITIAL_COUNTDOWN,
  MEPHISTO_DO_NOT_DRAW_113C,
  MEPHISTO_DO_NOT_DRAW_OFFSETS_113C,
  MEPHISTO_FLYING_ROCKS_BIG_113C,
  cltHit33Bursts,
  stepCltDo26,
} from '../src/client/world/boss-death-cltdo-113c.ts'
import { getMissileTxtData } from '../src/common/skills/missiles-data.ts'
import { getBossDeathFxSpec } from '../src/common/units/monster-death-fx.ts'

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

type Spawn = { key: string; frame: number; sx: number; sy: number; tx: number; ty: number }

function makeWorld(seed: number) {
  const world = new ClientWorld()
  world.setCollisionChecker(() => false)
  world.setQuestFxSeed(seed)
  const spawned: Spawn[] = []
  const orig = world.spawnMissileByKey.bind(world)
  vi.spyOn(world, 'spawnMissileByKey').mockImplementation((key, sx, sy, tx, ty, opts) => {
    spawned.push({ key, frame: world.frameCount, sx, sy, tx, ty })
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

function missiles(world: ClientWorld) {
  return world.getUnitsByType('missile')
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

describe('Missiles.txt ground truth of the Mephisto death rows', () => {
  const rows = readMissilesTxt()
  it.skipIf(rows === null)('mephistodeathcontrol / donotdraw / flyingrocksbig constants match the 1.13c rows', () => {
    const r = rows!
    const c = MEPHISTO_DEATH_CONTROL_113C
    expect(r.get('mephistodeathcontrol')).toMatchObject({
      Id: '299',
      pCltDoFunc: '26',
      Range: '275',
      CltParam1: String(c.cltParam1),
      CltParam2: String(c.cltParam2),
      CltParam3: String(c.cltParam3),
      CltSubMissile1: c.cltSubMissile1,
      CltSubMissile2: c.cltSubMissile2,
    })
    expect(r.get('mephistodonotdraw')).toMatchObject({
      Id: '306',
      pCltDoFunc: '28',
      Range: '70',
      CltParam1: String(MEPHISTO_DO_NOT_DRAW_113C.cltParam1),
      CltSubMissile1: MEPHISTO_DO_NOT_DRAW_113C.cltSubMissile1,
    })
    expect(r.get('mephistoflyingrocksbig')).toMatchObject({
      Id: '302',
      pCltHitFunc: '33',
      cHitPar1: String(MEPHISTO_FLYING_ROCKS_BIG_113C.cHitPar1),
      CltHitSubMissile1: MEPHISTO_FLYING_ROCKS_BIG_113C.cltHitSubMissile1,
      ExplosionMissile: 'mephistoexplosionbig',
      AlwaysExplode: '1',
    })
    expect(r.get('mephistoflyingrockssmall')).toMatchObject({ Id: '304', ExplosionMissile: 'mephistoexplosionsmall' })
    expect(r.get('mephistoholedelay')).toMatchObject({ Id: '358', Range: '50', ExplosionMissile: 'mephistoholebirth' })
  })
})

describe('Issue #1204: Uber bosses / Diablo clone have no client death show', () => {
  it('getBossDeathFxSpec returns null for 704..709 and 333', () => {
    const cases: [number, string][] = [
      [707, 'uberandariel'],
      [708, 'uberduriel'],
      [704, 'ubermephisto'],
      [706, 'uberizual'],
      [705, 'uberdiablo'],
      [709, 'uberbaal'],
      [333, 'diabloclone'],
    ]
    for (const [id, name] of cases) {
      expect(getBossDeathFxSpec(id, name), name).toBeNull()
      expect(getBossDeathFxSpec(id), String(id)).toBeNull()
    }
  })

  it('an Uber Baal death creates no baalfx control; Diablo clone / Uber Mephisto none either', () => {
    const { world, spawned } = makeWorld(0x1204)
    assignMonster(world, 7090, 709, 5000, 6000, [22])
    assignMonster(world, 3330, 333, 5100, 6000, [22])
    assignMonster(world, 7040, 704, 5200, 6000, [22])
    kill(world, 7090)
    kill(world, 3330)
    kill(world, 7040)
    const keys = spawned.map(s => s.key)
    for (const bad of ['baalfx control', 'diabwallmaker', 'mephistodeathcontrol', 'mephistoholedelay']) {
      expect(keys).not.toContain(bad)
    }
  })
})

describe('Issue #1205: Diablo death creates no diabwallmaker ring', () => {
  it('spec has no controller missile', () => {
    const spec = getBossDeathFxSpec(243, 'diablo')
    expect(spec).not.toBeNull()
    expect(spec!.controllerMissileKey).toBeNull()
  })

  it('triggerMonsterDeathFx(diablo 243, umod 22) spawns 0 diabwallmaker', () => {
    const { world, spawned } = makeWorld(0x1205)
    assignMonster(world, 2430, 243, 5000, 6000, [22])
    kill(world, 2430)
    for (let i = 0; i < 20; i++) world.tick(40)
    expect(spawned.filter(s => s.key === 'diabwallmaker' || s.key === 'diabwall')).toHaveLength(0)
  })

  it("'diabwallmaker' is not named by the client death-fx sources", () => {
    const dir = join(__dirname, '..', 'src', 'client', 'world')
    const hits = srcFiles(dir).filter(f => readFileSync(f, 'utf8').includes("'diabwallmaker'"))
    for (const f of hits) expect(f).toMatch(/world-missile-stepper\.ts$|world-skill-state-tables\.ts$|skill/)
    expect(readFileSync(join(dir, 'world-quest-fx.ts'), 'utf8')).not.toContain("'diabwallmaker'")
  })
})

describe('Issue #1206: Summoner death has no orbmist show', () => {
  it('getBossDeathFxSpec(250, summoner) is null', () => {
    expect(getBossDeathFxSpec(250, 'summoner')).toBeNull()
  })

  it('a Summoner (with umod 22) death spawns no orbmist / orbmisttrail', () => {
    const { world, spawned } = makeWorld(0x1206)
    assignMonster(world, 2500, 250, 5000, 6000, [22])
    kill(world, 2500)
    for (let i = 0; i < 40; i++) world.tick(40)
    expect(spawned.filter(s => s.key.startsWith('orbmist'))).toHaveLength(0)
  })
})

describe('Issue #1207: boss death controllers live for their Missiles.txt Range', () => {
  const cases: [number, string, string, number[]?][] = [
    [156, 'andariel', 'andycontrol0'],
    [211, 'duriel', 'durieldeathcontrol'],
    [229, 'radament', 'radamentdeath'],
    [242, 'mephisto', 'mephistodeathcontrol'],
    [256, 'izual', 'izual control'],
    [267, 'bloodraven', 'brdeathcontrol', [22]],
    [479, 'shenk', 'overseercontrol', [22]],
    [526, 'nihlathakboss', 'nehlithakcontrol'],
    [540, 'ancientbarb1', 'ancient death center'],
    [544, 'baalcrab', 'baalfx control'],
  ]
  for (const [classId, name, key, mods] of cases) {
    it(`${name} (${classId}) -> ${key} maxTicks = Range`, () => {
      const spec = getBossDeathFxSpec(classId, name)
      expect(spec?.controllerMissileKey).toBe(key)
      expect(spec).not.toHaveProperty('rangeTicks')
      expect(spec).not.toHaveProperty('controllerRange')
      const { world } = makeWorld(0x1207 + classId)
      assignMonster(world, 90000 + classId, classId, 5000, 6000, mods)
      kill(world, 90000 + classId)
      const ctrls = missiles(world).filter(m => m.missileKey === key)
      expect(ctrls).toHaveLength(1)
      const row = getMissileTxtData(key)
      expect(ctrls[0]!.maxTicks).toBe(row.range + (row.levRange ?? 0))
    })
  }

  it('radamentdeath 400 / baalfx control 650 / mephistodeathcontrol 275 / izual control 200', () => {
    expect(getMissileTxtData('radamentdeath').range).toBe(400)
    expect(getMissileTxtData('baalfx control').range).toBe(650)
    expect(getMissileTxtData('mephistodeathcontrol').range).toBe(275)
    expect(getMissileTxtData('izual control').range).toBe(200)
    expect(getMissileTxtData('queendeathcenter').range).toBe(100)
  })
})

describe('Issue #1203: Blood Raven brdeathcontrol (Range 375, TargetX 50, ±CltParam1, brdeathsmokes1)', () => {
  it('375-frame controller, no bolt in the first 50 frames, offsets within ±20, one brdeathsmokes1', () => {
    const { world, spawned } = makeWorld(0x1203)
    assignMonster(world, 2672, 267, 5000, 6000, [22])
    kill(world, 2672)
    const ctrl = missiles(world).find(m => m.missileKey === 'brdeathcontrol')!
    expect(ctrl.maxTicks).toBe(375)
    expect(missiles(world).filter(m => m.missileKey === 'brdeathsmokes1')).toHaveLength(1)
    const start = world.frameCount
    for (let i = 0; i < 375; i++) world.tick(40)
    const bolts = spawned.filter(s => s.key === 'brdeathlightningbolt')
    expect(bolts.length).toBeGreaterThan(0)
    for (const b of bolts) {
      expect(b.frame - start).toBeGreaterThanOrEqual(50)
      expect(Math.abs(b.tx - b.sx)).toBeLessThanOrEqual(BR_DEATH_CONTROL_CLT_PARAM1)
      expect(Math.abs(b.ty - b.sy)).toBeLessThanOrEqual(BR_DEATH_CONTROL_CLT_PARAM1)
    }
  })
})

describe('Issue #1208: Mephisto death per 0x6fb02270 / CltDoFunc 26 / 28 / CltHitFunc 33', () => {
  it('stepCltDo26: first shots at frame 75, then every CltParam1 (16) / CltParam2 (4) frames', () => {
    const u: { cltCountdown?: number; cltCountdownY?: number } = {
      cltCountdown: MEPHISTO_DEATH_CONTROL_INITIAL_COUNTDOWN,
      cltCountdownY: MEPHISTO_DEATH_CONTROL_INITIAL_COUNTDOWN,
    }
    const s1: number[] = []
    const s2: number[] = []
    for (let f = 0; f < 120; f++) {
      const r = stepCltDo26(u)
      if (r.sub1) s1.push(f)
      if (r.sub2) s2.push(f)
    }
    expect(s1).toEqual([75, 91, 107])
    expect(s2.slice(0, 4)).toEqual([75, 79, 83, 87])
  })

  it('CltHitFunc 33 bursts: count = TargetX, level 1..5, offsets within ±max(3, cHitPar1)', () => {
    const seed = { lo: 1234, hi: 666 }
    const b = cltHit33Bursts(seed, 4, 20)
    expect(b).toHaveLength(4)
    for (const x of b) {
      expect(x.level).toBeGreaterThanOrEqual(1)
      expect(x.level).toBeLessThanOrEqual(5)
      expect(Math.abs(x.dx)).toBeLessThanOrEqual(20)
      expect(Math.abs(x.dy)).toBeLessThanOrEqual(20)
      expect(x.dx !== 0 || x.dy !== 0).toBe(true)
    }
    expect(cltHit33Bursts(seed, 0, 20)).toEqual([])
  })

  it('art: mephistoflyingrocksbig is baked from its own CelFile ExplosionSpark; no alias for the null-cel controller', () => {
    expect(MISSILE_METAS['mephistoflyingrocksbig']?.celFile).toBe('ExplosionSpark')
    expect(MISSILE_METAS['mephistoflyingrocksbig']?.name).toBe('mephistoflyingrocksbig')
    expect(MISSILE_METAS['mephistodeathcontrol']).toBeUndefined()
    expect(MISSILE_METAS['mephistoflyingrockssmall']?.celFile).toBe(getMissileTxtData('mephistoflyingrockssmall').celFile)
  })

  it('death frame: one control (TargetX/Y 75), one mephistoholedelay, one mephistodonotdraw', () => {
    const { world, spawned } = makeWorld(0x1208)
    assignMonster(world, 2420, 242, 5000, 6000, [22])
    kill(world, 2420)
    const ms = missiles(world)
    const ctrl = ms.filter(m => m.missileKey === 'mephistodeathcontrol')
    expect(ctrl).toHaveLength(1)
    expect(ctrl[0]!.maxTicks).toBe(275)
    expect(ctrl[0]!.cltCountdown).toBe(75)
    expect(ctrl[0]!.cltCountdownY).toBe(75)
    expect(ms.filter(m => m.missileKey === 'mephistoholedelay')).toHaveLength(1)
    expect(ms.filter(m => m.missileKey === 'mephistodonotdraw')).toHaveLength(1)
    expect(ms.find(m => m.missileKey === 'mephistoholedelay')!.maxTicks).toBe(50)
    expect(ms.find(m => m.missileKey === 'mephistodonotdraw')!.maxTicks).toBe(70)
    expect(spawned.map(s => s.key).slice(0, 3)).toEqual(['mephistodeathcontrol', 'mephistoholedelay', 'mephistodonotdraw'])
  })

  it('over its 275 frames the control throws firewallmakers and flyingrocksbig; rocks burst into small rocks / explosions', () => {
    const { world, spawned } = makeWorld(0x1209)
    assignMonster(world, 2421, 242, 5000, 6000, [22])
    kill(world, 2421)
    const start = world.frameCount
    for (let i = 0; i < 300; i++) world.tick(40)
    const rel = (k: string) => spawned.filter(s => s.key === k).map(s => s.frame - start)
    const makers = rel('mephistofirewallmaker')
    const rocks = rel('mephistoflyingrocksbig')
    expect(makers.length).toBeGreaterThan(5)
    expect(rocks.length).toBeGreaterThan(20)
    expect(Math.min(...makers)).toBeGreaterThanOrEqual(75)
    expect(Math.min(...rocks)).toBeGreaterThanOrEqual(75)
    expect(rel('mephistoexplosionbig').length).toBeGreaterThan(0)
    expect(rel('mephistoflyingrockssmall').length).toBeGreaterThan(0)
    expect(rel('mephistoexplosionsmall').length).toBeGreaterThan(0)
    for (const s of spawned.filter(x => x.key === 'mephistoflyingrocksbig' || x.key === 'mephistofirewallmaker')) {
      expect(Math.abs(s.tx - s.sx)).toBeLessThanOrEqual(MEPHISTO_DEATH_CONTROL_113C.cltParam3)
      expect(Math.abs(s.ty - s.sy)).toBeLessThanOrEqual(MEPHISTO_DEATH_CONTROL_113C.cltParam3)
    }
    // The control no longer creates mephistoholedelay itself.
    expect(spawned.filter(s => s.key === 'mephistoholedelay')).toHaveLength(1)
    // mephistodonotdraw: four corpseexplosion at Mephisto + the cross offsets, at elapsed 15.
    const ce = spawned.filter(s => s.key === 'corpseexplosion')
    expect(ce).toHaveLength(4)
    expect(ce.map(s => [s.sx - 5000, s.sy - 6000])).toEqual(MEPHISTO_DO_NOT_DRAW_OFFSETS_113C.map(o => [o.dx, o.dy]))
    // Every spawned key is a real Missiles.txt row.
    for (const key of new Set(spawned.map(s => s.key))) {
      const row = getMissileTxtData(key)
      expect(row.name, key).toBe(key)
    }
  })
})
