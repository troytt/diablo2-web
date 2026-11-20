/**
 * Issue #993 items 11-12: Necromancer curse AoE particle shower (cursecenter / CurseArea) and States.txt onsound.
 *
 * Ground truth: D2Client.dll SKILLS_CltSt18_Curse 0x6fb785c0, SKILLS_CltDo30_Curse 0x6fb78b40,
 * MISSMODE_CltDo17_CurseCenter 0x6fb6bb40 → scatter 0x6fb6b210 / 0x6fb66d40, client state set 0x6fb23760.
 */
import { describe, expect, it } from 'vitest'
import { STATE_SOUNDS_113C, getStateOnSound113c } from '../../../src/common/audio/state-sounds-113c.ts'
import { getSoundIdByName113c } from '../../../src/common/audio/sounds-113c.ts'
import { d2Rand, type D2Seed } from '../../../src/common/drlg/light-grid.ts'
import { MISSILE_METAS } from '../../../src/client/render/missiles-meta.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import type { ClientUnit } from '../../../src/client/world/client-unit.ts'
import {
  CURSECENTER_RANGE_113C,
  computeCurseScatterPoints113c,
  curseScatterParams113c,
  curseVisualRadius113c,
  isCurseCenterWaveTick113c,
} from '../../../src/client/world/curse-center-113c.ts'
import { stateOnSoundRequest113c } from '../../../src/client/world/state-on-sound-113c.ts'
import { extractStateSoundRows113c } from '../../../src/baker/extract/gen-state-sounds.ts'

describe('#993 item 12: gen-state-sounds extractor', () => {
  const enc = (rows: string[]): Uint8Array => new TextEncoder().encode(rows.join('\r\n'))
  it('extracts onsound/offsound by column name and resolves Sounds.txt ids', () => {
    const rows = extractStateSoundRows113c(
      enc([
        'state\tid\tonsound\toffsound\teol',
        'none\t0\t\t\t0',
        'freeze\t1\timpact_bluemotize_1\t\t0',
        'wolf\t2\tdruid_morph\tdruid_morph\t0',
      ]),
    )
    expect(rows).toEqual([
      { stateId: 1, state: 'freeze', onSound: 365, offSound: 0 },
      { stateId: 2, state: 'wolf', onSound: 2346, offSound: 2346 },
    ])
  })
  it('fails fast on unknown sound names, id drift and missing columns', () => {
    expect(() => extractStateSoundRows113c(enc(['state\tid\tonsound\toffsound', 'x\t0\tno_such_sound\t']))).toThrow(
      /does not resolve/,
    )
    expect(() => extractStateSoundRows113c(enc(['state\tid\tonsound\toffsound', 'x\t5\t\t']))).toThrow(/expected 0/)
    expect(() => extractStateSoundRows113c(enc(['state\tid\tonsound', 'x\t0\t']))).toThrow(/offsound/)
  })
})

const CURSE_PARTICLES = [
  'curseamplifydamage',
  'cursedimvision',
  'curseweaken',
  'curseironmaiden',
  'curseterror',
  'curseattract',
  'cursereversevampire',
  'curseconfuse',
  'cursedecrepify',
  'curselowerresist',
] as const

interface WorldInternals {
  _units: Map<string, ClientUnit>
  spawnMissilesForSkill(caster: ClientUnit, skillId: number, tx: number, ty: number, lvl: number): void
  stepMissileUnit(unit: ClientUnit): void
  applySkillCastToUnit(
    u: ClientUnit,
    skillId: number,
    tx: number,
    ty: number,
    lvl: number,
    visuals: boolean,
    nowMs?: number,
  ): void
}

function missiles(world: ClientWorld): ClientUnit[] {
  return [...(world as unknown as WorldInternals)._units.values()].filter((u) => u.unitType === 'missile')
}

function makeWorld(): ClientWorld {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 90, y: 90 })
  return world
}

describe('#993 item 11: curse AoE particles (MISSILE_META)', () => {
  it('maps curse*(#181..#190) to the CurseArea particle meta, not CurseCast', () => {
    for (const key of CURSE_PARTICLES) {
      const meta = MISSILE_METAS[key]
      expect(meta, key).toBeDefined()
      expect(meta!.celFile).toBe('CurseArea')
      expect(meta!.name).toBe('curseall')
      expect(meta!.directions).toBe(16)
      expect(meta!.framesPerDirection).toBe(20)
    }
    expect(MISSILE_METAS['cursecast']!.celFile).toBe('CurseCast')
    expect(MISSILE_METAS['cursecenter']).toBeUndefined()
  })
})

describe('#993 item 11: cursecenter scatter math (0x6fb78b40 / 0x6fb6bb40 / 0x6fb66d40)', () => {
  it('visual radius = max(aurarangecalc - 3, 2)', () => {
    expect(curseVisualRadius113c(3)).toBe(2) // Amplify Damage slvl 1
    expect(curseVisualRadius113c(4)).toBe(2)
    expect(curseVisualRadius113c(7)).toBe(4) // Iron Maiden / Lower Resist slvl 1
    expect(curseVisualRadius113c(9)).toBe(6) // Weaken slvl 1 / Attract
    expect(curseVisualRadius113c(28)).toBe(25) // Weaken slvl 20
    expect(() => curseVisualRadius113c(Number.NaN)).toThrow()
  })

  it('waves fire on elapsed 0, 3, 6 only (elapsed < CltParam1 = 7, elapsed % 3 == 0)', () => {
    const ticks = Array.from({ length: 20 }, (_, i) => i).filter((i) => isCurseCenterWaveTick113c(i))
    expect(ticks).toEqual([0, 3, 6])
  })

  it('chance / step: R > 4 → (R/2, 2); else (R, 1)', () => {
    expect(curseScatterParams113c(2)).toEqual({ chance: 2, step: 1 })
    expect(curseScatterParams113c(4)).toEqual({ chance: 4, step: 1 })
    expect(curseScatterParams113c(5)).toEqual({ chance: 2, step: 2 })
    expect(curseScatterParams113c(9)).toEqual({ chance: 4, step: 2 })
  })

  it('scatters a filled disk on the sub-tile grid, consuming one RAND per in-disk grid point', () => {
    for (const radius of [2, 4, 6, 9]) {
      const { step } = curseScatterParams113c(radius)
      const seed: D2Seed = { lo: 0x1234567, hi: 666 }
      const points = computeCurseScatterPoints113c(100, 200, radius, seed)
      expect(points.length).toBeGreaterThan(0)
      let gridPoints = 0
      for (let dy = -radius; dy <= radius; dy += step) {
        for (let dx = -radius; dx <= radius; dx += step) {
          if (dx * dx + dy * dy <= radius * radius) gridPoints += 1
        }
      }
      expect(points.length).toBeLessThan(gridPoints)
      for (const p of points) {
        const dx = p.x - 100
        const dy = p.y - 200
        expect(dx * dx + dy * dy).toBeLessThanOrEqual(radius * radius)
        expect((dx + radius) % step === 0 && (dy + radius) % step === 0).toBe(true)
      }
      // Same stream replayed: RAND is drawn exactly once per in-disk grid point.
      const replay: D2Seed = { lo: 0x1234567, hi: 666 }
      for (let i = 0; i < gridPoints; i += 1) d2Rand(replay, 1)
      expect(seed).toEqual(replay)
    }
  })

  it('reproduces the 0x6fb66d40 RAND filter exactly for a fixed seed', () => {
    const seed: D2Seed = { lo: 42, hi: 666 }
    const ref: D2Seed = { lo: 42, hi: 666 }
    const expected: { x: number; y: number }[] = []
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (dx * dx + dy * dy > 4) continue
        if (d2Rand(ref, 2) !== 0) continue
        expected.push({ x: 10 + dx, y: 20 + dy })
      }
    }
    expect(computeCurseScatterPoints113c(10, 20, 2, seed)).toEqual(expected)
  })
})

describe('#993 item 11: ClientWorld curse visual pipeline', () => {
  it('cast start spawns cursecast at the caster (SKILLS_CltSt18_Curse)', () => {
    const world = makeWorld()
    const caster = world.getUnit('player', 1)!
    ;(world as unknown as WorldInternals).applySkillCastToUnit(caster, 66, 100, 100, 1, true, 100000)
    const cast = missiles(world).filter((m) => m.missileKey === 'cursecast')
    expect(cast).toHaveLength(1)
    expect(cast[0]!.x).toBe(caster.x)
    expect(cast[0]!.y).toBe(caster.y)
    // The Do-frame visuals (cursecenter) are not spawned before the action frame.
    if (caster.castState?.missileFireDelayMs !== undefined) {
      expect(missiles(world).some((m) => m.missileKey === 'cursecenter')).toBe(false)
    }
  })

  it('Do frame spawns ONE invisible cursecenter that showers CurseArea particles on elapsed 0/3/6', () => {
    const world = makeWorld()
    const w = world as unknown as WorldInternals
    const caster = world.getUnit('player', 1)!
    w.spawnMissilesForSkill(caster, 72, 100, 100, 1) // Weaken slvl 1: aurarange 9 → visual radius 6
    const centers = missiles(world).filter((m) => m.missileKey === 'cursecenter')
    expect(centers).toHaveLength(1)
    const center = centers[0]!
    expect(center.x).toBe(100)
    expect(center.y).toBe(100)
    expect(center.curseSubMissileKey).toBe('curseweaken')
    expect(center.curseVisualRadius).toBe(6)
    expect(center.maxTicks).toBe(CURSECENTER_RANGE_113C)
    // No static cltmissilea at the target. Called directly (no SKILLS_CltSt18_Curse cast start), the CltDo30 path
    // spawns the cltmissilec 'cursecast' exactly once at the caster as the cast-start fallback (Issues #1165/#1166),
    // never at the curse target.
    expect(missiles(world).some((m) => m.missileKey === 'curseweaken')).toBe(false)
    const casts = missiles(world).filter((m) => m.missileKey === 'cursecast')
    expect(casts).toHaveLength(1)
    expect(casts[0]!.x).toBe(caster.x)
    expect(casts[0]!.y).toBe(caster.y)

    const countParticles = (): number => missiles(world).filter((m) => m.missileKey === 'curseweaken').length
    const perTick: number[] = []
    for (let tick = 0; tick < 10; tick += 1) {
      const before = countParticles()
      w.stepMissileUnit(center)
      perTick.push(countParticles() - before)
    }
    for (let tick = 0; tick < 10; tick += 1) {
      if (tick === 0 || tick === 3 || tick === 6) expect(perTick[tick], `tick ${tick}`).toBeGreaterThan(0)
      else expect(perTick[tick], `tick ${tick}`).toBe(0)
    }
    for (const p of missiles(world).filter((m) => m.missileKey === 'curseweaken')) {
      expect(Math.hypot(p.x - 100, p.y - 100)).toBeLessThanOrEqual(6)
      expect(p.ownerId).toBe(1)
    }
  })

  it('a cursecenter without CltDo30 data fails fast', () => {
    const world = makeWorld()
    const w = world as unknown as WorldInternals & {
      spawnMissileByKey(k: string, sx: number, sy: number, tx: number, ty: number): ClientUnit
    }
    const bare = w.spawnMissileByKey('cursecenter', 50, 50, 50, 50)
    expect(() => w.stepMissileUnit(bare)).toThrow(/cursecenter/)
  })
})

describe('#993 item 12: States.txt onsound', () => {
  it('generated table matches States.txt / Sounds.txt for the curse states', () => {
    expect(getStateOnSound113c(9)).toBe(getSoundIdByName113c('necromancer_amplifydamage'))
    expect(getStateOnSound113c(23)).toBe(getSoundIdByName113c('necromancer_dimvision'))
    expect(getStateOnSound113c(19)).toBe(getSoundIdByName113c('necromancer_weaken'))
    expect(getStateOnSound113c(55)).toBe(getSoundIdByName113c('necromancer_ironmaiden'))
    expect(getStateOnSound113c(56)).toBe(getSoundIdByName113c('necromancer_taint'))
    expect(getStateOnSound113c(59)).toBe(getSoundIdByName113c('necromancer_confuse'))
    expect(getStateOnSound113c(58)).toBe(getSoundIdByName113c('necromancer_reversevampire'))
    expect(getStateOnSound113c(57)).toBe(getSoundIdByName113c('necromancer_attract'))
    expect(getStateOnSound113c(60)).toBe(getSoundIdByName113c('necromancer_decrepify'))
    expect([9, 23, 19, 55, 56, 59, 58, 57, 60].map(getStateOnSound113c)).toEqual([
      2445, 2469, 2482, 2471, 2477, 2456, 2474, 2446, 2468,
    ])
    // States.txt lowerresist (#61) has an EMPTY onsound in 1.13c (2486 is barbarian_battlecry_state).
    expect(getStateOnSound113c(61)).toBe(0)
    expect(STATE_SOUNDS_113C.find((r) => r.stateId === 139)).toEqual({
      stateId: 139,
      state: 'wolf',
      onSound: 2346,
      offSound: 2346,
    })
  })

  it('stateOnSoundRequest113c only fires on inactive → active', () => {
    const unit = { unitType: 'monster' as const, id: 5, x: 1, y: 2 }
    expect(stateOnSoundRequest113c(unit, 9, true)).toBeNull()
    expect(stateOnSoundRequest113c(unit, 61, false)).toBeNull()
    expect(stateOnSoundRequest113c(unit, 9, false)).toEqual({
      soundId: 2445,
      unit: { unitType: 'monster', id: 5, x: 1, y: 2 },
    })
  })

  it('StateSet plays the onsound once per activation', () => {
    const world = makeWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 501, classId: 1, x: 100, y: 100, lifePct: 128, mode: 1 } })
    world.drainWorldSoundRequests()
    const stateSet = { type: 'StateSet', unit: { unitType: 1, id: 501 }, state: 19 } as const
    world.apply(stateSet as never)
    expect(world.drainWorldSoundRequests().filter((r) => r.soundId === 2482)).toHaveLength(1)
    world.apply(stateSet as never)
    expect(world.drainWorldSoundRequests().filter((r) => r.soundId === 2482)).toHaveLength(0)
    world.apply({ type: 'StateEnd', unit: { unitType: 1, id: 501 }, state: 19 } as never)
    world.apply(stateSet as never)
    expect(world.drainWorldSoundRequests().filter((r) => r.soundId === 2482)).toHaveLength(1)
  })

  it('optimistic client curse plays the onsound and the server StateSet does not repeat it', () => {
    const world = makeWorld()
    const w = world as unknown as WorldInternals
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 501, classId: 1, x: 100, y: 100, lifePct: 128, mode: 1 } })
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 502, classId: 1, x: 102, y: 100, lifePct: 128, mode: 1 } })
    world.drainWorldSoundRequests()
    const caster = world.getUnit('player', 1)!
    w.spawnMissilesForSkill(caster, 66, 100, 100, 1)
    const amp = world.drainWorldSoundRequests().filter((r) => r.soundId === 2445)
    expect(amp.map((r) => r.unit?.id).sort()).toEqual([501, 502])
    world.apply({ type: 'StateSet', unit: { unitType: 1, id: 501 }, state: 9 } as never)
    expect(world.drainWorldSoundRequests().filter((r) => r.soundId === 2445)).toHaveLength(0)
    // Recast of the same curse refreshes silently.
    w.spawnMissilesForSkill(caster, 66, 100, 100, 1)
    expect(world.drainWorldSoundRequests().filter((r) => r.soundId === 2445)).toHaveLength(0)
    // A different curse replaces it and sounds once per unit.
    w.spawnMissilesForSkill(caster, 87, 100, 100, 1)
    expect(world.drainWorldSoundRequests().filter((r) => r.soundId === 2468)).toHaveLength(2)
    // Lower Resist has no States.txt onsound.
    w.spawnMissilesForSkill(caster, 91, 100, 100, 1)
    expect(world.drainWorldSoundRequests().some((r) => r.soundId === 2486)).toBe(false)
  })
})
