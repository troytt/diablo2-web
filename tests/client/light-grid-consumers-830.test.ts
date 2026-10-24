/**
 * Issue #830: the light records of the scene's units (SPEC #830 §6) and their lifecycle in the lighting pass.
 *
 * - buildSceneDrawables emitters: missiles (0x6fb63647), monsters (base light 0x6fafc24e, MonUMod 3 handler
 *   0x6fad0510), other players (0x6fac92f5), objects as type-2 records (#827, 0x6fad496a) and overlays
 *   (0x6fb1b49f–0x6fb1b4e0).
 * - The light list reconcile of applyLightingInputs: Kill vs Free, Light Quality gating, allocation re-creation,
 *   type-2 cache invalidation, missile flicker (0x6fb60df0) and the local player's stat 89 / 90 callbacks
 *   (0x6fac8bc0 / 0x6fac89a0).
 * - The flat unit light (0x6fb4f120) and the stored Light Quality setting.
 */

import { describe, expect, it } from 'vitest'
import {
  buildSceneDrawables,
  resolveMissileMetadata,
  type RenderableUnitInput,
} from '../../src/client/view/unit-drawables.ts'
import type { UnitCastState } from '../../src/client/world/client-unit.ts'
import {
  MISSILE_LIGHT_113C,
  MONSTER_LIGHT_113C,
  SKILL_CAST_LIGHT_113C,
  missileLight113c,
  skillCastLight113c,
} from '../../src/common/units/light-sources-113c.ts'
import { OVERLAY_TXT_ROWS } from '../../src/client/render/overlay-txt-rows.ts'
import { d2Rand, LIGHT_SEED_HI, LightGrid, type LightRecord, PLAYER_LIGHT_RADIUS } from '../../src/common/drlg/light-grid.ts'
import {
  applyLightingInputs,
  getLightingPassState,
  unitFlatLight,
  wallColumnTints113c,
  type LightEmitterInput,
  type LightingInputs,
} from '../../src/client/scene/lighting-presets.ts'
import {
  DEFAULT_LIGHT_QUALITY,
  normalizeLightQuality,
  sanitizeClientSettings,
} from '../../src/client/settings/client-settings.ts'
import type { CollisionGrid } from '../../src/common/world/d2map.ts'

/** A 200×200 sub-tile level without obstacles. */
function openCollisionGrid(): CollisionGrid {
  return {
    cellsX: 40,
    cellsY: 40,
    originX: 0,
    originY: 0,
    gridWidth: 200,
    blocked: new Uint8Array(200 * 200),
    collisionMasks: new Uint16Array(200 * 200),
  }
}

/** Missiles.txt ids whose art resolves to their own row and has a sprite. */
function drawnMissile(id: number): boolean {
  const res = resolveMissileMetadata(id)
  if (res === null || res.entry.id !== id) return false
  const cel = res.entry.celFile
  return Boolean(cel) && cel.trim() !== '' && cel.toLowerCase() !== 'null'
}

function emittersOf(units: readonly RenderableUnitInput[]): readonly LightEmitterInput[] {
  return buildSceneDrawables(units).lightEmitters
}

describe('issue #830 unit light emitters (buildSceneDrawables)', () => {
  it('a missile light is Missiles.txt Light / Flicker / RGB at x8 = (precise >> 13) + 4, High quality only, fading out (0x6fb63647)', () => {
    const id = MISSILE_LIGHT_113C.findIndex((row, i) => row[0] > 0 && row[1] > 0 && drawnMissile(i))
    expect(id).toBeGreaterThanOrEqual(0)
    const [light, flicker, red, green, blue] = missileLight113c(id)
    // Port 100.25 is D2 precise 100.75: x8 = floor(100.75 * 8) + 4 = 810; y 50.75 → 51.25 → 414.
    const res = buildSceneDrawables([{ kind: 'missile', id: 77, classId: id, x: 100.25, y: 50.75 }])
    expect(res.lightEmitters).toEqual([
      {
        unitType: 3,
        unitId: 77,
        slot: 'unit',
        lightType: 1,
        x8: 810,
        y8: 414,
        radius: light,
        red,
        green,
        blue,
        flicker,
        fadeOnRemove: true,
        requiresHighQuality: true,
      },
    ])
    expect(res.missileDrawables).toHaveLength(1)
    expect(res.missileDrawables[0]).toMatchObject({ lightRadius: light, lightColor: [red, green, blue] })

    // The immediate SetRadius override (meteor centre → 12, 0x6fb66702) replaces Light; a bad override throws.
    const overridden = buildSceneDrawables([{ kind: 'missile', id: 78, classId: id, x: 1, y: 1, missileLightRadius: 12 }])
    expect(overridden.lightEmitters[0]!.radius).toBe(12)
    expect(overridden.missileDrawables[0]!.lightRadius).toBe(12)
    expect(() => emittersOf([{ kind: 'missile', id: 79, classId: id, x: 1, y: 1, missileLightRadius: 0 }])).toThrow(
      /light radius override 0/,
    )
    expect(() => emittersOf([{ kind: 'missile', id: 79, classId: id, x: 1, y: 1, missileLightRadius: 2.5 }])).toThrow(
      RangeError,
    )
  })

  it('a missile without a sprite still has its light; Light 0 and ids outside Missiles.txt have none', () => {
    const spriteless = MISSILE_LIGHT_113C.findIndex((row, i) => {
      const res = resolveMissileMetadata(i)
      return row[0] > 0 && res !== null && res.entry.id === i && !drawnMissile(i)
    })
    expect(spriteless).toBeGreaterThanOrEqual(0)
    const res = buildSceneDrawables([{ kind: 'missile', id: 5, classId: spriteless, x: 10, y: 10 }])
    expect(res.missileDrawables).toHaveLength(0)
    expect(res.lightEmitters).toHaveLength(1)
    expect(res.lightEmitters[0]).toMatchObject({ unitType: 3, unitId: 5, radius: missileLight113c(spriteless)[0] })

    const dark = MISSILE_LIGHT_113C.findIndex((row, i) => row[0] === 0 && drawnMissile(i))
    expect(dark).toBeGreaterThanOrEqual(0)
    const darkRes = buildSceneDrawables([{ kind: 'missile', id: 6, classId: dark, x: 10, y: 10 }])
    expect(darkRes.lightEmitters).toEqual([])
    expect(darkRes.missileDrawables).toHaveLength(1)
    expect(darkRes.missileDrawables[0]!.lightRadius).toBe(0)

    const unknown = MISSILE_LIGHT_113C.length + 100
    expect(resolveMissileMetadata(unknown)).toBeNull()
    const unknownRes = buildSceneDrawables([{ kind: 'missile', id: 7, classId: unknown, x: 10, y: 10 }])
    expect(unknownRes.lightEmitters).toEqual([])
    expect(unknownRes.missileDrawables).toEqual([])
  })

  it('a monster has its MonStats2 Light (type 0) and none when Light is 0 (0x6fafc24e)', () => {
    const lit = MONSTER_LIGHT_113C.findIndex((row) => row[0] > 0)
    expect(lit).toBeGreaterThanOrEqual(0)
    const [radius, red, green, blue] = MONSTER_LIGHT_113C[lit]!
    // Port 30 / 31 → precise 30.5 / 31.5 → x8 248, y8 256.
    expect(emittersOf([{ kind: 'monster', id: 40, classId: lit, x: 30, y: 31 }])).toEqual([
      { unitType: 1, unitId: 40, slot: 'unit', lightType: 0, x8: 248, y8: 256, radius, red, green, blue },
    ])
    expect(MONSTER_LIGHT_113C[0]![0]).toBe(0)
    expect(emittersOf([{ kind: 'monster', id: 41, classId: 0, x: 30, y: 31 }])).toEqual([])
  })

  it('MonUMod 3 (0x6fad0510) needs a non-zero first mod byte and the unique flag: radius 7, MonStats2 colour', () => {
    const lit = MONSTER_LIGHT_113C.findIndex((row) => row[0] > 0)
    const [baseRadius, red, green, blue] = MONSTER_LIGHT_113C[lit]!
    expect(baseRadius).not.toBe(7)
    const at = { kind: 'monster' as const, classId: lit, x: 30, y: 31 }
    expect(emittersOf([{ ...at, id: 50, flags: 0x08, bossMods: [3] }])).toEqual([
      { unitType: 1, unitId: 50, slot: 'unit', lightType: 0, x8: 248, y8: 256, radius: 7, red, green, blue },
    ])
    // The fixed handler list {1, 2, 3, 4} runs whenever the first mod byte is non-zero (0x6fad0f20).
    expect(emittersOf([{ ...at, id: 51, flags: 0x08, bossMods: [5] }])[0]!.radius).toBe(7)
    expect(emittersOf([{ ...at, id: 52, flags: 0x08, bossMods: [0, 3] }])[0]!.radius).toBe(baseRadius)
    expect(emittersOf([{ ...at, id: 53, flags: 0, bossMods: [3] }])[0]!.radius).toBe(baseRadius)
    expect(emittersOf([{ ...at, id: 54, isUnique: true, bossMods: [3] }])[0]!.radius).toBe(7)
  })

  it('a champion umod light takes B, G, R = RAND(seed, 256) in that order on each of the 1 + count(mod 3) runs', () => {
    expect(LIGHT_SEED_HI).toBe(666)
    const id = 0x1234
    const rgbAfter = (runs: number): [number, number, number] => {
      const seed = { lo: id, hi: LIGHT_SEED_HI }
      let rgb: [number, number, number] = [0, 0, 0]
      for (let run = 0; run < runs; run += 1) {
        const b = d2Rand(seed, 256)
        const g = d2Rand(seed, 256)
        const r = d2Rand(seed, 256)
        rgb = [r, g, b]
      }
      return rgb
    }
    const champion = { kind: 'monster' as const, id, classId: 0, x: 30, y: 31, flags: 0x0c }
    const three = emittersOf([{ ...champion, bossMods: [3, 7, 3] }])
    const [r3, g3, b3] = rgbAfter(3)
    expect(three).toEqual([
      { unitType: 1, unitId: id, slot: 'unit', lightType: 0, x8: 248, y8: 256, radius: 7, red: r3, green: g3, blue: b3 },
    ])
    const [r1, g1, b1] = rgbAfter(1)
    expect(emittersOf([{ ...champion, bossMods: [7] }])[0]).toMatchObject({ radius: 7, red: r1, green: g1, blue: b1 })
    expect([r1, g1, b1]).not.toEqual([r3, g3, b3])
  })

  it('another player has a white radius-13 type-1 light (0x6fac92f5); the local player light belongs to the pass', () => {
    expect(PLAYER_LIGHT_RADIUS).toBe(13)
    expect(
      emittersOf([
        { kind: 'player', id: 9, classId: 1, x: 10, y: 20, isLocalPlayer: false },
        { kind: 'player', id: 1, classId: 1, x: 10, y: 20, isLocalPlayer: true },
      ]),
    ).toEqual([
      { unitType: 0, unitId: 9, slot: 'unit', lightType: 1, x8: 88, y8: 168, radius: 13, red: 255, green: 255, blue: 255 },
    ])
  })

  it('another player carries stat 89 / 90 into light emitter input (issue #879)', () => {
    // Explicit properties on RenderableUnitInput
    expect(
      emittersOf([
        {
          kind: 'player',
          id: 9,
          classId: 1,
          x: 10,
          y: 20,
          isLocalPlayer: false,
          playerLightRadiusBonus: 5,
          playerLightColor: 0x00ff80,
        },
      ]),
    ).toEqual([
      {
        unitType: 0,
        unitId: 9,
        slot: 'unit',
        lightType: 1,
        x8: 88,
        y8: 168,
        radius: 13,
        red: 255,
        green: 255,
        blue: 255,
        playerLightRadiusBonus: 5,
        playerLightColor: 0x00ff80,
      },
    ])

    // Fallback via unit.stats
    const statMap = new Map<number, number>([
      [89, 4],
      [90, 0xff0000],
    ])
    expect(
      emittersOf([
        {
          kind: 'player',
          id: 12,
          classId: 2,
          x: 5,
          y: 5,
          isLocalPlayer: false,
          stats: statMap,
        },
      ]),
    ).toEqual([
      {
        unitType: 0,
        unitId: 12,
        slot: 'unit',
        lightType: 1,
        x8: 48,
        y8: 48,
        radius: 13,
        red: 255,
        green: 255,
        blue: 255,
        playerLightRadiusBonus: 4,
        playerLightColor: 0xff0000,
      },
    ])
  })

  it('an overlay with an overlay.bin Radius makes a type-1 light of InitRadius growing to Radius (0x6fb1b4e0)', () => {
    const growing = OVERLAY_TXT_ROWS.findIndex((row) => row.radius !== 0 && row.initRadius > 0 && row.initRadius !== row.radius)
    const steady = OVERLAY_TXT_ROWS.findIndex((row) => row.radius !== 0 && row.initRadius === row.radius)
    const zero = OVERLAY_TXT_ROWS.findIndex((row) => row.radius === 0 && row.name !== 'null')
    expect(growing).toBeGreaterThanOrEqual(0)
    expect(steady).toBeGreaterThanOrEqual(0)
    expect(zero).toBeGreaterThanOrEqual(0)
    const g = OVERLAY_TXT_ROWS[growing]!
    const s = OVERLAY_TXT_ROWS[steady]!
    const z = OVERLAY_TXT_ROWS[zero]!
    const lights = emittersOf([
      {
        kind: 'monster',
        id: 60,
        classId: 0,
        x: 30,
        y: 31,
        overlays: [
          { overlayId: growing, token: g.name },
          { overlayId: steady, token: s.name },
          { overlayId: zero, token: z.name },
        ],
      },
    ])
    expect(lights).toEqual([
      {
        unitType: 1,
        unitId: 60,
        slot: `ov:${String(growing)}`,
        lightType: 1,
        x8: 248,
        y8: 256,
        radius: g.initRadius,
        targetRadius: g.radius,
        red: g.red,
        green: g.green,
        blue: g.blue,
      },
      {
        unitType: 1,
        unitId: 60,
        slot: `ov:${String(steady)}`,
        lightType: 1,
        x8: 248,
        y8: 256,
        radius: s.radius,
        red: s.red,
        green: s.green,
        blue: s.blue,
      },
    ])
    // Issue #955 fault containment: an unknown overlay token contributes no light and is
    // reported once instead of throwing (a per-frame throw aborted the whole render loop).
    expect(
      emittersOf([
        {
          kind: 'monster',
          id: 60,
          classId: 0,
          x: 30,
          y: 31,
          overlays: [{ overlayId: 9999, token: 'no_such_overlay_row' }],
        },
      ]),
    ).toHaveLength(0)
    expect(lights[1]).not.toHaveProperty('targetRadius')
  })

  it('an object light (#827) is a type-2 record at sub * 8 + 4 carrying its allocation identity (0x6fad496a)', () => {
    const allocation = {}
    const res = buildSceneDrawables([
      {
        kind: 'object',
        id: 30,
        classId: 1,
        x: 40,
        y: 41,
        objectPointLight: { radius: 5, r: 255, g: 128, b: 64 },
        objectLightAllocation: allocation,
      },
      { kind: 'object', id: 31, classId: 1, x: 42, y: 41 },
    ])
    expect(res.pointLights).toEqual([{ subTileX: 40, subTileY: 41, radius: 5, intensity: 255, r: 255, g: 128, b: 64 }])
    expect(res.lightEmitters).toHaveLength(1)
    expect(res.lightEmitters[0]).toEqual({
      unitType: 2,
      unitId: 30,
      slot: 'unit',
      lightType: 2,
      x8: 324,
      y8: 332,
      radius: 5,
      red: 255,
      green: 128,
      blue: 64,
      allocation,
    })
    expect(res.lightEmitters[0]!.allocation).toBe(allocation)
    // Issue #955 fault containment: an out-of-range object light radius is skipped (with a
    // one-shot reportMissingArt) instead of throwing inside the per-frame build.
    expect(
      emittersOf([
        { kind: 'object', id: 32, classId: 1, x: 40, y: 41, objectPointLight: { radius: 19, r: 1, g: 1, b: 1 } },
      ]),
    ).toHaveLength(0)
  })

  it('a skill-cast light (#876) is type 1, radius 1 -> min(Light, 18), RGB from Missiles.txt (0x6fb50f60)', () => {
    // Fire Bolt (skill 36) -> firebolt (missile 58, Light 7, RGB 255/178/64)
    const fireCastState: UnitCastState = {
      skillId: 36,
      mode: 10,
      targetX: 25,
      targetY: 25,
      startedAtMs: 1000,
      untilMs: 1500,
    }
    const [fireLight, fireR, fireG, fireB] = skillCastLight113c(36)
    expect(fireLight).toBe(7)
    expect([fireR, fireG, fireB]).toEqual([255, 178, 64])

    // Port 20, 21 -> precise 20.5, 21.5 -> x8 168, y8 176
    const res = buildSceneDrawables([
      { kind: 'player', id: 10, classId: 1, x: 20, y: 21, castState: fireCastState },
    ])
    const castEmitter = res.lightEmitters.find((e) => e.slot === 'cast')
    expect(castEmitter).toEqual({
      unitType: 0,
      unitId: 10,
      slot: 'cast',
      lightType: 1,
      x8: 168,
      y8: 176,
      radius: 1,
      targetRadius: 7,
      red: 255,
      green: 178,
      blue: 64,
      allocation: fireCastState,
    })
    expect(castEmitter!.allocation).toBe(fireCastState)
    // The castoverlay light (0x6fb1b300, firecast InitRadius 1 -> Radius 9) is also present alongside the cast light
    const overlayEmitter = res.lightEmitters.find((e) => e.slot === 'cast:36:1000')
    expect(overlayEmitter).toMatchObject({
      slot: 'cast:36:1000',
      radius: 1,
      targetRadius: 9,
      red: 255,
      green: 178,
      blue: 64,
    })

    // Ice Bolt (skill 39) -> icebolt (missile 59, Light 7, RGB 81/81/255)
    const iceCastState: UnitCastState = {
      skillId: 39,
      mode: 10,
      targetX: 25,
      targetY: 25,
      startedAtMs: 1000,
      untilMs: 1500,
    }
    const [iceLight, iceR, iceG, iceB] = skillCastLight113c(39)
    expect(iceLight).toBe(7)
    expect([iceR, iceG, iceB]).toEqual([81, 81, 255])
    const iceRes = emittersOf([
      { kind: 'player', id: 11, classId: 1, x: 20, y: 21, castState: iceCastState },
    ])
    const iceCastEmitter = iceRes.find((e) => e.slot === 'cast')
    expect(iceCastEmitter).toEqual({
      unitType: 0,
      unitId: 11,
      slot: 'cast',
      lightType: 1,
      x8: 168,
      y8: 176,
      radius: 1,
      targetRadius: 7,
      red: 81,
      green: 81,
      blue: 255,
      allocation: iceCastState,
    })

    // Monster casting Fire Bolt (unitType 1)
    const monsterRes = emittersOf([
      { kind: 'monster', id: 25, classId: 0, x: 20, y: 21, castState: fireCastState },
    ])
    const monsterCastEmitter = monsterRes.find((e) => e.slot === 'cast')
    expect(monsterCastEmitter).toMatchObject({
      unitType: 1,
      unitId: 25,
      slot: 'cast',
      radius: 1,
      targetRadius: 7,
    })

    // Skills without light (e.g. skill 0 Attack) emit no cast light
    expect(skillCastLight113c(0)).toEqual([0, 0, 0, 0])
    expect(
      emittersOf([
        {
          kind: 'player',
          id: 12,
          classId: 1,
          x: 20,
          y: 21,
          castState: { skillId: 0, mode: 10, targetX: 0, targetY: 0, startedAtMs: 0, untilMs: 100 },
        },
      ]).filter((e) => e.slot === 'cast'),
    ).toEqual([])

    // Corpse / dead unit emits no cast light
    expect(
      emittersOf([
        {
          kind: 'player',
          id: 13,
          classId: 1,
          x: 20,
          y: 21,
          isCorpse: true,
          castState: fireCastState,
        },
      ]).filter((e) => e.slot === 'cast'),
    ).toEqual([])
    expect(
      emittersOf([
        {
          kind: 'player',
          id: 14,
          classId: 1,
          x: 20,
          y: 21,
          lifePct: 0,
          castState: fireCastState,
        },
      ]).filter((e) => e.slot === 'cast'),
    ).toEqual([])

    // Out-of-range skillId throws RangeError
    expect(() => skillCastLight113c(999)).toThrow(RangeError)
    expect(() =>
      emittersOf([
        {
          kind: 'player',
          id: 15,
          classId: 1,
          x: 20,
          y: 21,
          castState: { skillId: 999, mode: 10, targetX: 0, targetY: 0, startedAtMs: 0, untilMs: 100 },
        },
      ]),
    ).toThrow(RangeError)
  })
})

describe('issue #830 light list reconcile (applyLightingInputs)', () => {
  const collisionGrid = openCollisionGrid()
  const base: Omit<LightingInputs, 'tick' | 'lightEmitters'> = {
    preset: 'auto',
    levelId: 8,
    collisionGrid,
    playerSubTile: { x: 100, y: 100 },
    ambient: null,
  }
  const missile = (unitId: number, extra: Partial<LightEmitterInput> = {}): LightEmitterInput => ({
    unitType: 3,
    unitId,
    slot: 'unit',
    lightType: 1,
    x8: 812,
    y8: 812,
    radius: 5,
    red: 255,
    green: 255,
    blue: 255,
    fadeOnRemove: true,
    requiresHighQuality: true,
    ...extra,
  })
  const monster = (unitId: number): LightEmitterInput => ({
    unitType: 1,
    unitId,
    slot: 'unit',
    lightType: 0,
    x8: 780,
    y8: 812,
    radius: 5,
    red: 255,
    green: 255,
    blue: 255,
  })
  const object = (unitId: number, radius: number, allocation: object): LightEmitterInput => ({
    unitType: 2,
    unitId,
    slot: 'unit',
    lightType: 2,
    x8: 884,
    y8: 804,
    radius,
    red: 255,
    green: 200,
    blue: 100,
    allocation,
  })
  const pass = (initialQuality: 0 | 1 | 2 = 2) => {
    const lightGrid = new LightGrid()
    const st = getLightingPassState(lightGrid)
    let lightQuality = initialQuality
    const run = (tick: number, lightEmitters: readonly LightEmitterInput[], extra: Partial<LightingInputs> = {}): void => {
      applyLightingInputs(
        { ...base, tick, lightEmitters, ...extra },
        { lightGrid, renderer: { setLighting: () => {} }, lightQuality, nowMs: 0 },
      )
    }
    return {
      st,
      run,
      setQuality: (q: 0 | 1 | 2): void => {
        lightQuality = q
      },
      recOf: (key: string): LightRecord | null | undefined => st.tracked.get(key)?.rec,
    }
  }

  it('a vanished fading emitter is Killed (fades 8 per build, then frees itself); any other is Freed at once', () => {
    const { st, run, recOf } = pass()
    run(1, [missile(5), monster(6)])
    const m = recOf('3:5:unit')!
    const n = recOf('1:6:unit')!
    expect(st.lights.size).toBe(2)
    expect(m.r).toBe(40)
    run(2, [])
    expect(n.linked).toBe(false)
    expect(m.linked).toBe(true)
    expect(m.dying).toBe(true)
    expect(m.r).toBe(32)
    expect(st.tracked.size).toBe(0)
    for (const [tick, r] of [[3, 24], [4, 16], [5, 8]] as const) {
      run(tick, [])
      expect(m.r).toBe(r)
      expect(m.linked).toBe(true)
    }
    run(6, [])
    expect(m.linked).toBe(false)
    expect(st.lights.size).toBe(0)
  })

  it('a High-quality-only light is skipped below Light Quality 2 and never created later for the same owner', () => {
    const { st, run, setQuality, recOf } = pass(1)
    run(1, [missile(5)])
    expect(st.lights.size).toBe(0)
    expect(recOf('3:5:unit')).toBeNull()
    setQuality(2)
    run(2, [missile(5), missile(6)])
    expect(recOf('3:5:unit')).toBeNull()
    expect(st.lights.size).toBe(1)
    expect(st.lights.head!.unitId).toBe(6)
    // Once the owner is gone a new unit with that id is a new light.
    run(3, [missile(6)])
    run(4, [missile(5)])
    expect(recOf('3:5:unit')).not.toBeNull()
    expect(st.lights.head!.unitId).toBe(5)
  })

  it('a new allocation identity frees the record and creates a new one at the list head (SetObjectLight)', () => {
    const { st, run, recOf } = pass()
    const a1 = {}
    const a2 = {}
    run(1, [object(30, 4, a1), monster(6)])
    const first = recOf('2:30:unit')!
    expect(st.lights.head).toBe(recOf('1:6:unit'))
    run(2, [object(30, 4, a2), monster(6)])
    const second = recOf('2:30:unit')!
    expect(second).not.toBe(first)
    expect(first.linked).toBe(false)
    expect(st.lights.head).toBe(second)
    expect(st.lights.size).toBe(2)
    run(3, [object(30, 4, a2), monster(6)])
    expect(recOf('2:30:unit')).toBe(second)
  })

  it('two emitters claiming one owner slot throw', () => {
    const { run } = pass()
    expect(() => run(1, [monster(7), monster(7)])).toThrow(/two lights claim the owner slot 1:7:unit/)
  })

  it('a type-2 radius change is a SetRadius (cache rebuilt); a new collision frame rebuilds every cache', () => {
    const { run, recOf } = pass()
    const alloc = {}
    run(1, [object(30, 5, alloc)])
    const rec = recOf('2:30:unit')!
    expect(rec.r).toBe(40)
    expect(rec.cacheValid).toBe(true)
    expect(rec.cache!.length).toBe(11 * 11)
    rec.cache!.fill(7)
    run(2, [object(30, 5, alloc)])
    expect(Array.from(rec.cache!).every((v) => v === 7)).toBe(true)
    run(3, [object(30, 6, alloc)])
    expect(rec.r).toBe(48)
    expect(rec.target).toBe(48)
    expect(rec.cache!.length).toBe(13 * 13)
    expect(Array.from(rec.cache!).every((v) => v === 0)).toBe(true)
    rec.cache!.fill(7)
    run(4, [object(30, 6, alloc)], { collisionGrid: openCollisionGrid() })
    expect(Array.from(rec.cache!).every((v) => v === 0)).toBe(true)
  })

  it('a flickering light retargets to radius + RAND(seed, Flicker) whenever r >> 3 >= radius (0x6fb60df0)', () => {
    const { run, recOf } = pass()
    const e = missile(8, { radius: 3, flicker: 4 })
    const seed = { lo: 8, hi: LIGHT_SEED_HI }
    let r = 24
    let target = 24
    for (let tick = 1; tick <= 6; tick += 1) {
      run(tick, [e])
      if (r >> 3 >= 3) target = (3 + d2Rand(seed, 4)) * 8
      if (target !== r) r += target > r ? 8 : -8
      const rec = recOf('3:8:unit')!
      expect([rec.target, rec.r]).toEqual([target, r])
    }
  })

  it('the local player light: stat 89 sets 13 + v and a total <= 0 leaves it unchanged; stat 90 colours it', () => {
    const { run, recOf } = pass()
    const player = (): LightRecord => recOf('0:1:unit')!
    run(1, [], { playerUnitId: 1 })
    expect(player().r).toBe(13 * 8)
    expect([player().red, player().green, player().blue]).toEqual([255, 255, 255])
    const steps: readonly [number, number][] = [
      [5, 18 * 8],
      [-13, 18 * 8],
      [-12, 8],
      [-20, 8],
      [0, 13 * 8],
    ]
    let tick = 2
    for (const [bonus, r] of steps) {
      run(tick, [], { playerUnitId: 1, playerLightRadiusBonus: bonus })
      expect([bonus, player().r]).toEqual([bonus, r])
      tick += 1
    }
    run(tick, [], { playerUnitId: 1, playerLightColor: 0x00ff80 })
    expect([player().red, player().green, player().blue]).toEqual([0, 255, 128])
    run(tick + 1, [], { playerUnitId: 1, playerLightColor: 0 })
    expect([player().red, player().green, player().blue]).toEqual([255, 255, 255])
  })

  it('another player light: stat 89 sets 13 + v and total <= 0 leaves it unchanged; stat 90 colours it (issue #879 parity)', () => {
    const { run, recOf } = pass()
    const otherPlayer = (): LightRecord => recOf('0:9:unit')!
    const makeOtherPlayerEmitter = (bonus?: number, color?: number): LightEmitterInput => ({
      unitType: 0,
      unitId: 9,
      slot: 'unit',
      lightType: 1,
      x8: 88,
      y8: 168,
      radius: PLAYER_LIGHT_RADIUS,
      red: 255,
      green: 255,
      blue: 255,
      playerLightRadiusBonus: bonus,
      playerLightColor: color,
    })

    run(1, [makeOtherPlayerEmitter()])
    expect(otherPlayer().r).toBe(13 * 8)
    expect(otherPlayer().type).toBe(1)
    expect([otherPlayer().red, otherPlayer().green, otherPlayer().blue]).toEqual([255, 255, 255])

    const steps: readonly [number, number][] = [
      [5, 18 * 8],
      [-13, 18 * 8],
      [-12, 8],
      [-20, 8],
      [0, 13 * 8],
    ]
    let tick = 2
    for (const [bonus, r] of steps) {
      run(tick, [makeOtherPlayerEmitter(bonus)])
      expect([bonus, otherPlayer().r]).toEqual([bonus, r])
      tick += 1
    }
    run(tick, [makeOtherPlayerEmitter(0, 0x00ff80)])
    expect([otherPlayer().red, otherPlayer().green, otherPlayer().blue]).toEqual([0, 255, 128])
    run(tick + 1, [makeOtherPlayerEmitter(0, 0)])
    expect([otherPlayer().red, otherPlayer().green, otherPlayer().blue]).toEqual([255, 255, 255])
  })

  it('skill-cast light ramps radius 1 -> targetRadius by ±8 per build frame, and frees old light on recast or cast end (#876)', () => {
    const grid = new LightGrid()
    grid.setOrigin(100, 100)
    const st = getLightingPassState(grid)
    const run = (tick: number, emitters: readonly LightEmitterInput[]) =>
      applyLightingInputs({ ...base, tick, lightEmitters: emitters }, { lightGrid: grid, renderer: { setLighting() {} } })
    const castRecord = () => [...st.lights].find((l) => l.unitType === 0 && l.unitId === 10)

    const cast1: UnitCastState = {
      skillId: 36, // Fire Bolt, Light 7
      mode: 10,
      targetX: 25,
      targetY: 25,
      startedAtMs: 1000,
      untilMs: 1500,
    }
    const emitter1: LightEmitterInput = {
      unitType: 0,
      unitId: 10,
      slot: 'cast',
      lightType: 1,
      x8: 800,
      y8: 800,
      radius: 1,
      targetRadius: 7,
      red: 255,
      green: 178,
      blue: 64,
      allocation: cast1,
    }

    // Build 1: created with radius 1 (r = 8), stepped once by build (+8) -> r = 16
    run(1, [emitter1])
    expect(st.lights.size).toBe(1)
    const rec1 = castRecord()!
    expect(rec1).toBeDefined()
    expect(rec1.r).toBe(16)
    expect([rec1.red, rec1.green, rec1.blue]).toEqual([255, 178, 64])

    // Builds 2..6: ramps by +8 each build frame up to 7 * 8 = 56
    const expected = [24, 32, 40, 48, 56]
    for (let i = 0; i < expected.length; i++) {
      run(i + 2, [emitter1])
      expect(castRecord()!.r).toBe(expected[i])
    }
    // Build 7: stays at targetRadius 56
    run(7, [emitter1])
    expect(castRecord()!.r).toBe(56)

    // Continuous casting: recast with a new allocation resets to radius 1 (stepped to 16) and frees old light immediately
    const cast2: UnitCastState = {
      skillId: 39, // Ice Bolt, Light 7, RGB 81/81/255
      mode: 10,
      targetX: 25,
      targetY: 25,
      startedAtMs: 1500,
      untilMs: 2000,
    }
    const emitter2: LightEmitterInput = {
      unitType: 0,
      unitId: 10,
      slot: 'cast',
      lightType: 1,
      x8: 800,
      y8: 800,
      radius: 1,
      targetRadius: 7,
      red: 81,
      green: 81,
      blue: 255,
      allocation: cast2,
    }
    run(8, [emitter2])
    expect(st.lights.size).toBe(1)
    const rec2 = castRecord()!
    expect(rec2).not.toBe(rec1)
    expect(rec2.r).toBe(16)
    expect([rec2.red, rec2.green, rec2.blue]).toEqual([81, 81, 255])

    // Cast end: emitter removed -> light record is immediately freed (not faded)
    run(9, [])
    expect(st.lights.size).toBe(0)
    expect(castRecord()).toBeUndefined()
  })
})

describe('issue #830 flat unit light and Light Quality setting', () => {
  it('unitFlatLight reads the cell of the path sub-tile as T[I][C] / 255, edge clamped 0..47 on all 4 sides (0x6fb4f120, #877)', () => {
    const grid = new LightGrid()
    grid.setOrigin(100, 100) // originSub = (76, 76), cells 0..47 cover sub-tiles 76..123
    grid.fill(25, 25, 25, 25, 200, 255, 128, 10)
    const lit = [200 / 255, 100 / 255, 7 / 255]
    // Dynamic: port 100.6 is precise 101.1 → sub-tile 101 = cell 25; port 100.4 → 100.9 → cell 24.
    expect(unitFlatLight(grid, 100.6, 100.6, true)).toEqual(lit)
    expect(unitFlatLight(grid, 100.4, 100.6, true)).toEqual([0, 0, 0])
    // Static: the sub-tile itself.
    expect(unitFlatLight(grid, 101, 101, false)).toEqual(lit)
    expect(unitFlatLight(grid, 100.9, 101, false)).toEqual([0, 0, 0])
    // 0..47 edge clamping on all 4 sides (west < 0 -> 0, east > 47 -> 47, north < 0 -> 0, south > 47 -> 47)
    grid.fill(0, 25, 0, 25, 255, 255, 255, 255)
    grid.fill(47, 25, 47, 25, 255, 255, 0, 0)
    grid.fill(25, 0, 25, 0, 255, 0, 255, 0)
    grid.fill(25, 47, 25, 47, 255, 0, 0, 255)
    expect(unitFlatLight(grid, -500, 101, false)).toEqual([1, 1, 1])
    expect(unitFlatLight(grid, 500, 101, false)).toEqual([1, 0, 0])
    expect(unitFlatLight(grid, 101, -500, false)).toEqual([0, 1, 0])
    expect(unitFlatLight(grid, 101, 500, false)).toEqual([0, 0, 1])
    expect(unitFlatLight(grid, 500, 500, true)).toEqual([0, 0, 0])
  })

  it('wallColumnTints113c samples the 6 points of 0x6fb8ed18 (default) or 0x6fb8eef8 (faded) as T[I][C] / 255 (#877)', () => {
    const grid = new LightGrid()
    grid.setOrigin(100, 100) // originSub = (76, 76)
    // Wall tile at cell (20, 20) -> sub (100, 100) -> entry (800, 800)
    // For orientation 1 (nLightDirection 1), default offsets are:
    // (16, 40), (24, 32), (32, 24), (40, 16), (48, 8), (56, 0)
    // -> sub-tiles (102, 105), (103, 104), (104, 103), (105, 102), (106, 101), (107, 100)
    // -> grid cells (26, 29), (27, 28), (28, 27), (29, 26), (30, 25), (31, 24)
    const defaultCells: [number, number][] = [
      [26, 29],
      [27, 28],
      [28, 27],
      [29, 26],
      [30, 25],
      [31, 24],
    ]
    defaultCells.forEach(([gx, gy], i) => {
      const v = (i + 1) * 40
      grid.fill(gx, gy, gx, gy, v, 255, 255, 255)
    })
    const tintsDefault = wallColumnTints113c(grid, 20, 20, 1, false)
    expect(tintsDefault).toHaveLength(6)
    expect(tintsDefault!.map((c) => c[0])).toEqual(defaultCells.map((_, i) => ((i + 1) * 40) / 255))

    // Faded (0x6fb8eef8) shifts nLightDirection 1 by (-16, -16) in x8 = (-2, -2) sub-tiles:
    // -> grid cells (24, 27), (25, 26), (26, 25), (27, 24), (28, 23), (29, 22)
    const fadedCells: [number, number][] = [
      [24, 27],
      [25, 26],
      [26, 25],
      [27, 24],
      [28, 23],
      [29, 22],
    ]
    fadedCells.forEach(([gx, gy], i) => {
      const v = (i + 1) * 30
      grid.fill(gx, gy, gx, gy, v, 255, 0, 255)
    })
    const tintsFaded = wallColumnTints113c(grid, 20, 20, 1, true)
    expect(tintsFaded).toHaveLength(6)
    expect(tintsFaded!.map((c) => [c[0], c[1], c[2]])).toEqual(
      fadedCells.map((_, i) => [((i + 1) * 30) / 255, 0, ((i + 1) * 30) / 255]),
    )
  })

  it('Light Quality is stored as 0, 1 or 2 (default 2); anything else falls back', () => {
    expect(DEFAULT_LIGHT_QUALITY).toBe(2)
    expect([0, 1, 2, '0', ' 1 ', '2'].map((v) => normalizeLightQuality(v))).toEqual([0, 1, 2, 0, 1, 2])
    expect([3, -1, 1.5, 'high', '', null, undefined].map((v) => normalizeLightQuality(v))).toEqual([2, 2, 2, 2, 2, 2, 2])
    expect(normalizeLightQuality('bogus', 0)).toBe(0)
    expect(sanitizeClientSettings({ lightQuality: 1 }).lightQuality).toBe(1)
    expect(sanitizeClientSettings({ lightQuality: 7 }).lightQuality).toBe(2)
    expect(sanitizeClientSettings({}).lightQuality).toBe(2)
  })
})

