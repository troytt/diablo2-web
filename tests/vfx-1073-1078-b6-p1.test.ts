/**
 * VFX-B6-p1: Invented Overlay Token Removal & 1.13c Parity Suite (Issues #1073–#1078).
 *
 * Verifies against 1.13c Ground Truth (`Skills.txt`, `States.txt`, `Overlay.txt`, `Missiles.txt`, `D2Client.dll`):
 * - #1073 (B6-1): Holy Shield (#117) attaches no invented 'holyshield' loop overlay and does not locally add state 101;
 *   StateSet/StateEnd 101 cycle leaves unit.overlays unchanged.
 * - #1074 (B6-2): Conversion (#116) attaches no invented 'conversion' loop overlay; OVERLAY_METAS['conversion'] is removed;
 *   a state-53 monster renders exactly one conversion overlay ('conversionaura', 10 frames, animRate 8) via STATE_OVERLAYS[53],
 *   and StateEnd 53 clears it completely.
 * - #1075 (B6-3): Vengeance (#111) attaches no invented 'vengeance' overlay.
 * - #1076 (B6-4): Smite (#97) client cast near 3 monsters changes no client unit states or overlays;
 *   StateSet 21 on one monster produces exactly one 'stun' overlay (12 frames) on that monster only.
 * - #1077 (B6-5): Sacrifice (#96) attaches no 'sacrifice_1'/'sacrifice_2' overlays and implements SkillCltDoFunc[34]
 *   (0x6FADB530): spawns missile classId in [18..20] (blood1/blood2/bigblood1) per seeded cltcalc1=3 evaluation at the
 *   target unit with Missiles.txt velocity/range, and spawns no missile when there is no target unit.
 * - #1078 (B6-6): Shout (#138), Battle Orders (#149), and Battle Command (#155) attach States.txt castoverlay
 *   ('shoutstart', 'battleorderscast', 'battlecommandcast') and never invented '*_cast' tokens.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import { OVERLAY_METAS, STATE_OVERLAYS } from '../src/client/render/overlays-meta.ts'
import { clearMissingArtEntries, getMissingArtEntries } from '../src/client/scene/missing-art.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import type { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { SELF_BUFF_SKILL_STATES } from '../src/client/world/world-skill-state-tables.ts'
import { SEED_InitLowSeed, SEED_RollLimitedRandomNumber, type D2SeedStrc } from '../src/common/rng/d2-rng.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'

const ROOT_DIR = resolve(__dirname, '..')
const OVERLAY_TXT_NAME_SET: ReadonlySet<string> = new Set(
  OVERLAY_TXT_ROWS.map((r) => r.name.trim().toLowerCase()),
)

function createPaladinWorld(x = 100, y = 100): { world: ClientWorld; caster: ClientUnit } {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 3, name: 'Paladin', x, y })
  const caster = world.getUnit('player', 1)!
  return { world, caster }
}

function createBarbarianWorld(x = 100, y = 100): { world: ClientWorld; caster: ClientUnit } {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 4, name: 'Barbarian', x, y })
  const caster = world.getUnit('player', 1)!
  return { world, caster }
}

function addHostileMonster(world: ClientWorld, id: number, x: number, y: number, classId = 1): ClientUnit {
  world.apply({
    type: 'UnitAssign',
    unit: { unitType: 1, id, classId, x, y, lifePct: 128, mode: 1 },
  } as any)
  return world.getUnit('monster', id)!
}

describe('VFX-B6-p1: Invented Overlay Token Removal & 1.13c Parity (#1073–#1078)', () => {
  describe('#1073 (B6-1): Holy Shield (#117) attaches no invented holyshield overlay and leaves overlays unchanged across StateSet/StateEnd 101', () => {
    it('casting #117 attaches no overlay with token holyshield and activates state 101 for bsh paperdoll override', () => {
      clearMissingArtEntries()
      const { world, caster } = createPaladinWorld()

      ;(world as any).spawnMissilesForSkill(caster, 117, caster.x, caster.y, 10)
      expect(caster.overlays.some((o) => o.token === 'holyshield')).toBe(false)
      expect(caster.overlays).toHaveLength(0)
      expect(caster.states.has(101)).toBe(true)
      expect(SELF_BUFF_SKILL_STATES[117]).toBe(101)
      expect(getMissingArtEntries()).toEqual([])
    })

    it('a StateSet/StateEnd 101 cycle leaves unit.overlays unchanged and emits no overlay drawables', () => {
      const { world, caster } = createPaladinWorld()
      expect(STATE_OVERLAYS[101]).toBeUndefined()

      world.apply({
        type: 'StateSet',
        unit: { unitType: 0, id: caster.id },
        state: 101,
      } as any)
      expect(caster.states.has(101)).toBe(true)
      expect(caster.overlays).toHaveLength(0)
      expect(buildSceneDrawables([caster]).overlayDrawables).toHaveLength(0)

      world.apply({
        type: 'StateEnd',
        unit: { unitType: 0, id: caster.id },
        state: 101,
      } as any)
      expect(caster.states.has(101)).toBe(false)
      expect(caster.overlays).toHaveLength(0)
    })

    it('has no holyshield overlay or missile-meta key', () => {
      expect(OVERLAY_TXT_NAME_SET.has('holyshield')).toBe(false)
      expect(OVERLAY_METAS['holyshield']).toBeUndefined()
      expect(MISSILE_METAS['holyshield']).toBeUndefined()
      expect(CANONICAL_113C_MISSILES['holyshield']).toBeUndefined()

      const worldSkillMissilesSrc = readFileSync(
        resolve(ROOT_DIR, 'src/client/world/world-skill-missiles.ts'),
        'utf-8',
      )
      expect(worldSkillMissilesSrc).not.toMatch(/attachUnitOverlay\([^)]*['"]holyshield['"]/)
    })
  })

  describe('#1074 (B6-2): Conversion (#116) uses STATE_OVERLAYS[53] -> conversionaura (10 frames, animRate 8) without duplicate conversion loop overlay', () => {
    it('casting #116 with a state-53 monster nearby adds no unit overlay, draws exactly one conversionaura overlay, and clears on StateEnd 53', () => {
      clearMissingArtEntries()
      const { world, caster } = createPaladinWorld(100, 100)
      const monster = addHostileMonster(world, 201, 101, 100)

      // Server sets state 53 (conversion) on monster
      world.apply({
        type: 'StateSet',
        unit: { unitType: 1, id: monster.id },
        state: 53,
      } as any)
      expect(monster.states.has(53)).toBe(true)
      expect(monster.overlays).toHaveLength(0)

      // Client casts #116 near the state-53 monster -> adds no unit.overlays entry
      ;(world as any).spawnMissilesForSkill(caster, 116, monster.x, monster.y, 10)
      expect(monster.overlays).toHaveLength(0)
      expect(getMissingArtEntries()).toEqual([])

      // Drawable list for the state-53 monster contains exactly one conversion overlay (conversionaura, 10 frames, animRate 8)
      const drawables = buildSceneDrawables([monster])
      expect(drawables.overlayDrawables).toHaveLength(1)
      const convDrawable = drawables.overlayDrawables[0]!
      expect(convDrawable.token).toBe('conversionaura')
      expect(convDrawable.totalFrames).toBe(10)
      expect(convDrawable.loop).toBe(true)

      const convMeta = OVERLAY_METAS['conversionaura']
      expect(convMeta).toBeDefined()
      expect(convMeta!.frames).toBe(10)
      expect(convMeta!.animRate).toBe(8)
      expect(convMeta!.celFile).toBe('Conversion')
      expect(OVERLAY_METAS['conversion']).toBeUndefined()
      expect(MISSILE_METAS['conversion']).toBeUndefined()

      // After StateEnd 53 no conversion overlay remains
      world.apply({
        type: 'StateEnd',
        unit: { unitType: 1, id: monster.id },
        state: 53,
      } as any)
      expect(monster.states.has(53)).toBe(false)
      expect(monster.overlays).toHaveLength(0)
      expect(buildSceneDrawables([monster]).overlayDrawables).toHaveLength(0)
    })
  })

  describe('#1075 (B6-3): Vengeance (#111) attaches no invented vengeance overlay', () => {
    it('casting #111 adds no overlay and vengeance is absent from overlay/missile metas', () => {
      clearMissingArtEntries()
      const { world, caster } = createPaladinWorld(100, 100)
      const monster = addHostileMonster(world, 301, 101, 100)

      ;(world as any).spawnMissilesForSkill(caster, 111, monster.x, monster.y, 10)
      expect(caster.overlays).toHaveLength(0)
      expect(monster.overlays).toHaveLength(0)
      expect(getMissingArtEntries()).toEqual([])

      expect(OVERLAY_TXT_NAME_SET.has('vengeance')).toBe(false)
      expect(OVERLAY_METAS['vengeance']).toBeUndefined()
      expect(MISSILE_METAS['vengeance']).toBeUndefined()
      expect(CANONICAL_113C_MISSILES['vengeance']).toBeUndefined()

      const worldSkillMissilesSrc = readFileSync(
        resolve(ROOT_DIR, 'src/client/world/world-skill-missiles.ts'),
        'utf-8',
      )
      expect(worldSkillMissilesSrc).not.toMatch(/attachUnitOverlay\([^)]*['"]vengeance['"]/)
    })
  })

  describe('#1076 (B6-4): Smite (#97) adds no client AoE stun or invented smite overlay; StateSet 21 renders 12-frame stun on target only', () => {
    it('casting #97 near 3 monsters changes no client unit states or overlays, and StateSet 21 on one monster produces one stun overlay (12 frames) on that monster only', () => {
      clearMissingArtEntries()
      const { world, caster } = createPaladinWorld(100, 100)
      const m1 = addHostileMonster(world, 401, 101, 100)
      const m2 = addHostileMonster(world, 402, 100, 101)
      const m3 = addHostileMonster(world, 403, 102, 101)

      ;(world as any).spawnMissilesForSkill(caster, 97, m1.x, m1.y, 10)
      for (const m of [m1, m2, m3]) {
        expect(m.states.has(21)).toBe(false)
        expect(m.overlays).toHaveLength(0)
        expect(buildSceneDrawables([m]).overlayDrawables).toHaveLength(0)
      }
      expect(getMissingArtEntries()).toEqual([])

      // Server sends StateSet 21 (stunned) on m1 only
      world.apply({
        type: 'StateSet',
        unit: { unitType: 1, id: m1.id },
        state: 21,
      } as any)
      expect(m1.states.has(21)).toBe(true)
      expect(m2.states.has(21)).toBe(false)
      expect(m3.states.has(21)).toBe(false)

      const allDrawables = buildSceneDrawables([m1, m2, m3])
      expect(allDrawables.overlayDrawables).toHaveLength(1)
      const stunOv = allDrawables.overlayDrawables[0]!
      expect(stunOv.ownerUnitId).toBe(m1.id)
      expect(stunOv.token).toBe('stun')
      expect(stunOv.totalFrames).toBe(12)

      expect(OVERLAY_TXT_NAME_SET.has('smite')).toBe(false)
      expect(OVERLAY_METAS['smite']).toBeUndefined()
      expect(MISSILE_METAS['smite']).toBeUndefined()
      expect(CANONICAL_113C_MISSILES['smite']).toBeUndefined()
    })
  })

  describe('#1077 (B6-5): Sacrifice (#96) attaches no sacrifice_* overlays and implements SkillCltDoFunc[34] (0x6FADB530)', () => {
    it('spawns no missile when there is no target unit (0x6FADB59B..0x6FADB5A2)', () => {
      clearMissingArtEntries()
      const { world, caster } = createPaladinWorld(100, 100)

      ;(world as any).spawnMissilesForSkill(caster, 96, 101, 100, 10)
      expect(caster.overlays).toHaveLength(0)
      const missiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(missiles).toHaveLength(0)
      expect(getMissingArtEntries()).toEqual([])
    })

    it('selects blood missile classId in [18..20] (blood1/blood2/bigblood1) per seeded cltcalc1=3 evaluation and positions it at the target unit', () => {
      clearMissingArtEntries()
      const { world, caster } = createPaladinWorld(100, 100)
      const target = addHostileMonster(world, 501, 102, 101)

      const seenClassIds = new Set<number>()
      for (let seedVal = 1; seedVal <= 30; seedVal++) {
        for (const u of Array.from(world.units.values())) {
          if (u.unitType === 'missile') (world as any)._units.delete(`missile:${u.id}`)
        }
        SEED_InitLowSeed(caster.seed, seedVal)
        const mirrorSeed: D2SeedStrc = { lo: caster.seed.lo, hi: caster.seed.hi }
        const expectedClassId = 18 + SEED_RollLimitedRandomNumber(mirrorSeed, 3)

        ;(world as any).spawnMissilesForSkill(caster, 96, target.x, target.y, 10)

        expect(caster.overlays.some((o) => o.token.startsWith('sacrifice_'))).toBe(false)
        expect(target.overlays.some((o) => o.token.startsWith('sacrifice_'))).toBe(false)
        expect(caster.overlays).toHaveLength(0)
        expect(target.overlays).toHaveLength(0)

        const missiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
        expect(missiles).toHaveLength(1)
        const blood = missiles[0]!
        expect(blood.classId).toBe(expectedClassId)
        expect(blood.classId).toBeGreaterThanOrEqual(18)
        expect(blood.classId).toBeLessThanOrEqual(20)
        expect(blood.x).toBe(target.x)
        expect(blood.y).toBe(target.y)
        expect(blood.maxTicks).toBe(128)
        expect(Math.hypot(blood.vx ?? 0, blood.vy ?? 0)).toBeGreaterThan(0)
        seenClassIds.add(blood.classId)
      }

      // All 3 Missiles.txt blood rows [18 (blood1), 19 (blood2), 20 (bigblood1)] must be produced across seeds
      expect( Array.from(seenClassIds).sort((a, b) => a - b) ).toEqual([18, 19, 20])
      expect(getMissingArtEntries()).toEqual([])
    })
  })

  describe('#1078 (B6-6): Shout (#138), Battle Orders (#149), and Battle Command (#155) attach States.txt castoverlay', () => {
    it('attaches shoutstart (#138), battleorderscast (#149), and battlecommandcast (#155), with no token outside Overlay.txt', () => {
      clearMissingArtEntries()
      const cases: ReadonlyArray<{ skillId: number; stateId: number; expectedCastOverlay: string }> = [
        { skillId: 138, stateId: 26, expectedCastOverlay: 'shoutstart' },
        { skillId: 149, stateId: 32, expectedCastOverlay: 'battleorderscast' },
        { skillId: 155, stateId: 51, expectedCastOverlay: 'battlecommandcast' },
      ]

      for (const { skillId, stateId, expectedCastOverlay } of cases) {
        const { world, caster } = createBarbarianWorld(100, 100)
        ;(world as any).spawnMissilesForSkill(caster, skillId, caster.x, caster.y, 5)

        expect(caster.states.has(stateId)).toBe(true)
        const tokens = caster.overlays.map((o) => o.token)
        expect(tokens).toContain(expectedCastOverlay)
        for (const tok of tokens) {
          expect(OVERLAY_TXT_NAME_SET.has(tok.toLowerCase()), `token '${tok}' must be in Overlay.txt`).toBe(true)
        }
      }

      expect(OVERLAY_METAS['shout_cast']).toBeUndefined()
      expect(OVERLAY_METAS['battleorders_cast']).toBeUndefined()
      expect(OVERLAY_METAS['battlecommand_cast']).toBeUndefined()
      expect(getMissingArtEntries()).toEqual([])
    })
  })
})
