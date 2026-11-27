/**
 * Issue #993 items 5-10 — Necromancer Poison & Bone client parity (D2Client.dll 1.13c).
 *
 * 5. Teeth: SKILLS_CltDo17 (0x6FAC5DA0) perpendicular fan, tooth floor(count/2) aims at the target point.
 * 6. Bone Armor: Overlay.txt #140..#142 metadata; StateSetFunc[6] 0x6FB23230 1..3 bone pairs from stats
 *    bonearmor (132) / bonearmormax (133) with the null1/null2 delay chain (0/8/16 frame phase).
 * 7. Corpse Explosion: STATE_CORPSE_NODRAW (104, hide=1) corpses are not drawn; Poison Explosion keeps
 *    STATE_CORPSE_NOSELECT (118) like D2Game SrvDo063 (0x6FC70190 push 0x76).
 * 8. Poison Explosion: CltDo33 ring of 8 poisonexplosioncloud + greenlightmissile; CltDo04 poisonpuff emitter.
 * 9. Bone Spear: Missiles.txt Trans=1 in data, meta and packer.
 * 10. Bone Spirit: MISSMODE_CltDo07 (0x6FB62EB0) homing on the CltDo18 locked target.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import {
  OVERLAY_BONEARMOR_BACK,
  OVERLAY_BONEARMOR_CAST,
  OVERLAY_BONEARMOR_FRONT,
  OVERLAY_BONEARMOR_NULL1,
  OVERLAY_BONEARMOR_NULL2,
  computeBoneArmorOverlayCount113c,
} from '../src/client/world/bone-armor-overlays-113c.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  BONESPIRIT_CLT_PARAM1_113C,
  BONESPIRIT_SIZE_113C,
  POISONEXPLOSIONCLOUD_113C,
  computeCltDo17FanAimPoints113c,
  poisonExplosionCloudOffsets113c,
  ringMissileSpeedSubTilesPerTick113c,
  rollPoisonCloudPuffTargets113c,
  shouldCltDo07Repath113c,
  unitDistance113c,
} from '../src/client/world/nec-poison-bone-113c.ts'
import { CANONICAL_113C_MISSILES, CANONICAL_113C_OVERLAYS } from '../src/common/skills/missiles-data.ts'

function missiles(world: ClientWorld, key: string) {
  return Array.from(world.units.values()).filter((u) => u.unitType === 'missile' && u.missileKey === key)
}

function boneArmorStats(cur: number, max: number) {
  return [
    { statId: 132, param: 0, value: cur },
    { statId: 133, param: 0, value: max },
  ]
}

function tickOverlays(world: ClientWorld, n: number): void {
  for (let i = 0; i < n; i++) (world as any).stepDiscreteSimulationTick(40)
}

describe('Issue #993 item 5: Teeth CltDo17 perpendicular fan', () => {
  it('aims tooth floor(count/2) exactly at the target for even and odd counts', () => {
    expect(computeCltDo17FanAimPoints113c(100, 100, 110, 100, 2)).toEqual([
      { x: 110, y: 101 },
      { x: 110, y: 100 },
    ])
    expect(computeCltDo17FanAimPoints113c(100, 100, 110, 100, 3)).toEqual([
      { x: 110, y: 101 },
      { x: 110, y: 100 },
      { x: 110, y: 99 },
    ])
    const diag = computeCltDo17FanAimPoints113c(100, 100, 110, 110, 4)
    expect(diag).toEqual([
      { x: 108, y: 112 },
      { x: 109, y: 111 },
      { x: 110, y: 110 },
      { x: 111, y: 109 },
    ])
    for (const count of [2, 5, 8, 24]) {
      const pts = computeCltDo17FanAimPoints113c(50, 60, 41, 75, count)
      expect(pts).toHaveLength(count)
      expect(pts[Math.floor(count / 2)]).toEqual({ x: 41, y: 75 })
    }
  })

  it('scales a short aim vector before taking the perpendicular (0x6FB50800)', () => {
    // d = (1, 0) -> x4 = (4, 0) -> x2 = (8, 0); P = (0, -8) halved to (0, -1)
    expect(computeCltDo17FanAimPoints113c(100, 100, 101, 100, 2)).toEqual([
      { x: 101, y: 101 },
      { x: 101, y: 100 },
    ])
  })

  it('client Teeth spawn sends the center tooth at the clicked point', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 100, y: 100 })
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 67, 110, 100, 1)
    const teeth = missiles(world, 'teeth')
    expect(teeth).toHaveLength(2)
    expect(teeth.some((t) => t.targetX === 110 && t.targetY === 100)).toBe(true)
    expect(teeth.some((t) => t.targetX === 110 && t.targetY === 101)).toBe(true)
  })
})

describe('Issue #993 item 6: Bone Armor overlays', () => {
  it('bonearmor overlay rows match Overlay.txt #140..#142', () => {
    expect(OVERLAY_TXT_ROWS[OVERLAY_BONEARMOR_CAST]!.name).toBe('bonearmor_cast')
    expect(OVERLAY_TXT_ROWS[OVERLAY_BONEARMOR_FRONT]!.name).toBe('bonearmor_front')
    expect(OVERLAY_TXT_ROWS[OVERLAY_BONEARMOR_BACK]!.name).toBe('bonearmor_back')
    expect(OVERLAY_TXT_ROWS[OVERLAY_BONEARMOR_NULL1]!.name).toBe('bonearmor_null1')
    expect(OVERLAY_TXT_ROWS[OVERLAY_BONEARMOR_NULL2]!.name).toBe('bonearmor_null2')
    for (const index of [OVERLAY_BONEARMOR_CAST, OVERLAY_BONEARMOR_FRONT, OVERLAY_BONEARMOR_BACK]) {
      const row = OVERLAY_TXT_ROWS[index]!
      const data = CANONICAL_113C_OVERLAYS[row.name]!
      expect(data.filename).toBe(row.filename)
      expect(data.frames).toBe(row.frames)
      expect(data.trans).toBe(row.trans)
      expect(data.preDraw).toBe(row.preDraw !== 0)
      expect(data.radius).toBe(row.radius)
    }
    expect(CANONICAL_113C_OVERLAYS['bonearmor_cast']!.filename).toBe('BoneShieldEmerge')
    expect(CANONICAL_113C_OVERLAYS['bonearmor_cast']!.frames).toBe(12)
  })

  it('0x6FB23230 bone count thresholds', () => {
    expect(computeBoneArmorOverlayCount113c(300, 300)).toBe(3)
    expect(computeBoneArmorOverlayCount113c(200, 300)).toBe(3)
    expect(computeBoneArmorOverlayCount113c(199, 300)).toBe(2)
    expect(computeBoneArmorOverlayCount113c(100, 300)).toBe(2)
    expect(computeBoneArmorOverlayCount113c(99, 300)).toBe(1)
    expect(computeBoneArmorOverlayCount113c(1, 300)).toBe(1)
    // Missing stat list (both 0): max/3 = 0 -> 3 bones
    expect(computeBoneArmorOverlayCount113c(0, 0)).toBe(3)
  })

  it('StateSet(14) builds 3 phase-offset bone pairs, drops pairs as absorb drains, clears on StateEnd', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 100, y: 100 })
    const unit = world.getUnit('player', 1)!
    const max = 50 * 256
    world.applyServerEvent({
      type: 'StateSet',
      unit: { unitType: 'player', id: 1 },
      state: 14,
      stats: boneArmorStats(max, max),
      origin: 0xa8,
      complete: true,
    } as any)
    expect(unit.overlays.map((o) => o.token).sort()).toEqual(
      ['bonearmor_cast', 'bonearmor_null1', 'bonearmor_null2'].sort(),
    )
    tickOverlays(world, 40)
    const fronts = unit.overlays.filter((o) => o.token === 'bonearmor_front')
    const backs = unit.overlays.filter((o) => o.token === 'bonearmor_back')
    expect(fronts).toHaveLength(3)
    expect(backs).toHaveLength(3)
    expect(unit.overlays.some((o) => o.token === 'bonearmor_cast')).toBe(false)
    // 0 / 8 / 16 frame phase offsets inside the 24-frame orbit
    const phases = fronts.map((o) => o.frame).sort((a, b) => a - b)
    const deltas = new Set(phases.map((f) => (f - phases[0]! + 24) % 24))
    expect(deltas).toEqual(new Set([0, 8, 16]))

    // Drain to < 1/3: two pairs removed
    world.applyServerEvent({
      type: 'StateSet',
      unit: { unitType: 'player', id: 1 },
      state: 14,
      stats: boneArmorStats(10 * 256, max),
      origin: 0xa8,
      complete: true,
    } as any)
    expect(unit.overlays.filter((o) => o.token === 'bonearmor_front')).toHaveLength(1)
    expect(unit.overlays.filter((o) => o.token === 'bonearmor_back')).toHaveLength(1)

    // 0xA7 (no stat list) does not run the set function
    world.applyServerEvent({
      type: 'StateSet',
      unit: { unitType: 'player', id: 1 },
      state: 14,
      origin: 0xa7,
    } as any)
    expect(unit.overlays.filter((o) => o.token === 'bonearmor_front')).toHaveLength(1)

    world.applyServerEvent({ type: 'StateEnd', unit: { unitType: 'player', id: 1 }, state: 14 } as any)
    expect(unit.overlays.some((o) => o.token.startsWith('bonearmor'))).toBe(false)
  })

  it('state 14 (nooverlays=1) adds no generic state overlays and null rows draw nothing', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 100, y: 100 })
    const unit = world.getUnit('player', 1)!
    world.applyServerEvent({
      type: 'StateSet',
      unit: { unitType: 'player', id: 1 },
      state: 14,
      stats: boneArmorStats(256, 256),
      origin: 0xa8,
      complete: true,
    } as any)
    const scene = buildSceneDrawables([unit])
    const tokens = scene.overlayDrawables.map((d) => d.token.toLowerCase())
    expect(tokens).toEqual(['bonearmor_cast'])
  })
})

describe('Issue #993 item 7: consumed corpses', () => {
  it('a corpse with STATE_CORPSE_NODRAW (104) is not drawn', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 700, classId: 1, x: 100, y: 100, lifePct: 0, mode: 12 },
    } as any)
    const corpse = world.getUnit('monster', 700)!
    expect(buildSceneDrawables([corpse]).unitDrawables.some((d) => d.id === 700)).toBe(true)
    world.applyServerEvent({
      type: 'StateSet',
      unit: { unitType: 'monster', id: 700 },
      state: 104,
      origin: 0xa8,
      complete: true,
    } as any)
    expect(buildSceneDrawables([corpse]).unitDrawables.some((d) => d.id === 700)).toBe(false)
  })

  it('Corpse Explosion prediction hides the corpse; Poison Explosion marks it unselectable (118)', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 100, y: 100 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 701, classId: 1, x: 105, y: 100, lifePct: 0, mode: 12 },
    } as any)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 702, classId: 1, x: 120, y: 100, lifePct: 0, mode: 12 },
    } as any)
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 74, 105, 100, 1)
    const ce = world.getUnit('monster', 701)!
    expect(ce.states.has(104)).toBe(true)
    expect(buildSceneDrawables([ce]).unitDrawables.some((d) => d.id === 701)).toBe(false)

    ;(world as any).spawnMissilesForSkill(caster, 83, 120, 100, 1)
    const pe = world.getUnit('monster', 702)!
    expect(pe.states.has(118)).toBe(true)
    expect(pe.states.has(104)).toBe(false)
    expect(pe.overlays.some((o) => o.token === 'poisoncorpse')).toBe(false)
    // An already consumed corpse is skipped by the next prediction
    ;(world as any).spawnMissilesForSkill(caster, 83, 120, 100, 1)
    expect(missiles(world, 'poisoncorpseexplosion').filter((m) => m.x === 120)).toHaveLength(2)
  })
})

describe('Issue #993 item 8: Poison Explosion clouds', () => {
  it('ring offsets are the 8 even entries of the radius-2 16-point table', () => {
    const offs = poisonExplosionCloudOffsets113c()
    expect(offs).toHaveLength(8)
    const set = new Set(offs.map((o) => `${o.x},${o.y}`))
    expect(set).toEqual(new Set(['0,2', '2,2', '2,0', '2,-2', '0,-2', '-2,-2', '-2,0', '-2,2']))
  })

  it('spawns poisoncorpseexplosion, greenlightmissile and 8 outward-drifting clouds', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 100, y: 100 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 710, classId: 1, x: 110, y: 100, lifePct: 0, mode: 12 },
    } as any)
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 83, 110, 100, 5)
    expect(missiles(world, 'poisoncorpseexplosion')).toHaveLength(1)
    expect(missiles(world, 'greenlightmissile')).toHaveLength(1)
    const clouds = missiles(world, 'poisonexplosioncloud')
    expect(clouds).toHaveLength(8)
    const speed = ringMissileSpeedSubTilesPerTick113c(POISONEXPLOSIONCLOUD_113C.param1)
    expect(speed).toBeCloseTo((16 * 192) / 65536, 10)
    for (const c of clouds) {
      expect(c.x).toBe(110)
      expect(c.y).toBe(100)
      expect(Math.hypot(c.vx ?? 0, c.vy ?? 0)).toBeCloseTo(speed, 10)
      expect(c.maxTicks).toBe(60)
    }
  })

  it('CltDo04 emits poisonpuff sub-missiles over the cloud lifetime', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 100, y: 100 })
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 83, 130, 130, 1)
    const clouds = missiles(world, 'poisonexplosioncloud')
    expect(clouds).toHaveLength(8)
    for (let t = 0; t < 60; t++) {
      for (const c of clouds) {
        if (world.units.has(c.key)) (world as any).stepMissileUnit(c)
      }
    }
    const puffs = missiles(world, 'poisonpuff')
    expect(puffs.length).toBeGreaterThan(0)
    for (const p of puffs) expect(p.pierce).toBe(true)
  })

  it('puff targets land r..2r-1 sub-tiles away per axis and always spawn on the last frame', () => {
    const seed = { lo: 12345, hi: 666 }
    for (let i = 0; i < 200; i++) {
      for (const t of rollPoisonCloudPuffTargets113c(seed, 0, 50, 50, 24, 1, 6)) {
        const dx = Math.abs(t.x - 50)
        const dy = Math.abs(t.y - 50)
        expect(dx).toBeGreaterThanOrEqual(6)
        expect(dx).toBeLessThanOrEqual(12)
        expect(dy).toBeGreaterThanOrEqual(6)
        expect(dy).toBeLessThanOrEqual(12)
      }
      expect(rollPoisonCloudPuffTargets113c(seed, 0, 50, 50, 24, 1, 6)).toHaveLength(1)
    }
  })
})

describe('Issue #993 item 9: Bone Spear Trans=1', () => {
  it('missile data, client meta and packer agree on Trans=1 additive', () => {
    expect(CANONICAL_113C_MISSILES['bonespear']!.trans).toBe(1)
    expect(MISSILE_METAS['bonespear']!.trans).toBe(1)
    expect(MISSILE_METAS['bonespear']!.blendMode).toBe('lighter')
    const packer = readFileSync(join(import.meta.dirname, '../src/baker/packers/pack-missiles.ts'), 'utf-8')
    expect(packer).toMatch(/\{ name: 'bonespear', celFile: 'BoneSpear', animSpeed: 16, trans: 1 \}/)
  })
})

describe('Issue #993 item 10: Bone Spirit CltDo07 homing', () => {
  it('re-paths every CltParam1 frames only inside the 3 < d < 25 window', () => {
    expect(shouldCltDo07Repath113c(0, 5, 10)).toBe(true)
    expect(shouldCltDo07Repath113c(5, 5, 10)).toBe(true)
    expect(shouldCltDo07Repath113c(3, 5, 10)).toBe(false)
    expect(shouldCltDo07Repath113c(10, 5, 3)).toBe(false)
    expect(shouldCltDo07Repath113c(10, 5, 25)).toBe(false)
    expect(unitDistance113c(0, 0, 1, 10, 4, 2)).toBe(Math.trunc((2 * 9 + 3) / 2))
  })

  it('a bone spirit cast on a monster turns toward it; a ground cast flies straight', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 100, y: 100 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 720, classId: 1, x: 110, y: 100, lifePct: 128, mode: 1 },
    } as any)
    const caster = world.getUnit('player', 1)!
    caster.targetUnit = { unitType: 'monster', id: 720 }
    ;(world as any).spawnMissilesForSkill(caster, 93, 110, 100, 1)
    const locked = missiles(world, 'bonespirit')[0]!
    expect(locked.homingTarget).toEqual({ unitType: 'monster', id: 720 })
    // The target moves away perpendicular to the flight line
    const mon = world.getUnit('monster', 720)!
    mon.y = 112
    for (let t = 0; t < BONESPIRIT_CLT_PARAM1_113C + 1; t++) (world as any).stepMissileUnit(locked)
    expect(locked.vy ?? 0).toBeGreaterThan(0)

    caster.targetUnit = undefined
    ;(world as any).spawnMissilesForSkill(caster, 93, 90, 100, 1)
    const ground = missiles(world, 'bonespirit').find((m) => m !== locked)!
    expect(ground.homingTarget).toBeUndefined()
    for (let t = 0; t < 12; t++) (world as any).stepMissileUnit(ground)
    expect(ground.vy ?? 0).toBe(0)
  })
})

describe('Issue #993: Missiles.txt / Overlay.txt ground truth (Patch_D2.mpq)', () => {
  it('client constants match the MPQ rows', async () => {
    const registry = await getSharedDataRegistry()
    const cloud = registry.getMissileByName('poisonexplosioncloud')!
    expect(Number(cloud.raw['Param1'])).toBe(POISONEXPLOSIONCLOUD_113C.param1)
    expect(Number(cloud.raw['CltParam1'])).toBe(POISONEXPLOSIONCLOUD_113C.cltParam1)
    expect(Number(cloud.raw['CltParam2'])).toBe(POISONEXPLOSIONCLOUD_113C.cltParam2)
    expect(Number(cloud.raw['CltParam3'])).toBe(POISONEXPLOSIONCLOUD_113C.cltParam3)
    expect(cloud.cltSubMissile1).toBe(POISONEXPLOSIONCLOUD_113C.cltSubMissile1)
    for (const key of ['bonespirit', 'monbonespirit']) {
      const row = registry.getMissileByName(key)!
      expect(Number(row.raw['CltParam1'])).toBe(BONESPIRIT_CLT_PARAM1_113C)
      expect(Number(row.raw['Size'])).toBe(BONESPIRIT_SIZE_113C)
    }
    expect(Number(registry.getMissileByName('bonespear')!.raw['Trans'])).toBe(1)
  })
})
