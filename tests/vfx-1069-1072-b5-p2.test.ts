import { describe, expect, it } from 'vitest'
import { OVERLAY_TARGETS, parseStatesTxtOverlays } from '../src/baker/packers/pack-overlays.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import {
  OVERLAY_METAS,
  STATE_OVERLAYS,
  STATE_PGSV_OVERLAYS,
} from '../src/client/render/overlays-meta.ts'
import { clearMissingArtEntries, getMissingArtEntries } from '../src/client/scene/missing-art.ts'
import { buildSceneDrawables, resolveStateOverlayTokens113c } from '../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { CANONICAL_113C_OVERLAYS, getOverlayTxtData } from '../src/common/skills/missiles-data.ts'

describe('B5-p2: Diablo II v1.13c Overlay Data, attachUnitOverlay Frame Parity, & Multi-Stage State Overlays (#1069, #1070, #1071, #1072)', () => {
  describe('#1069 (B5-7): CANONICAL_113C_OVERLAYS contains only genuine Overlay.txt row names', () => {
    it('Object.keys(CANONICAL_113C_OVERLAYS) is an exact subset of Overlay.txt row names (293 rows, 0 fabricated/alias keys)', () => {
      const overlayTxtNames = new Set(OVERLAY_TXT_ROWS.map((r) => r.name.trim().toLowerCase()))
      const canonicalKeys = Object.keys(CANONICAL_113C_OVERLAYS)

      expect(canonicalKeys.length).toBe(OVERLAY_TXT_ROWS.length)
      for (const key of canonicalKeys) {
        expect(overlayTxtNames.has(key), `unexpected non-Overlay.txt key '${key}'`).toBe(true)
        const entry = CANONICAL_113C_OVERLAYS[key]!
        expect(entry.overlay.toLowerCase()).toBe(key)
      }

      const removedBogusKeys = [
        'maul1front',
        'maul2front',
        'maul3front',
        'feralrage1front',
        'feralrage2front',
        'feralrage3front',
        'chargeup1',
        'chargeup2',
        'chargeup3',
        'stealup1',
        'stealup2',
        'stealup3',
        'fireup1',
        'fireup2',
        'fireup3',
        'coldup1',
        'coldup2',
        'coldup3',
        'lightup1',
        'lightup2',
        'lightup3',
        'royalup1',
        'royalup2',
        'royalup3',
        'cast_fire_1',
        'cry_shout',
        'fanaticism_aura',
      ]
      for (const badKey of removedBogusKeys) {
        expect(CANONICAL_113C_OVERLAYS[badKey]).toBeUndefined()
        expect(() => getOverlayTxtData(badKey)).toThrow()
      }
    })
  })

  describe('#1070 (B5-8): attachUnitOverlay uses Overlay.txt Frames and AnimRate & rejects non-Overlay.txt tokens', () => {
    it('sets totalFrames == Overlay.txt Frames and maxTicks == ceil(Frames*16/AnimRate) for all 10 curses, curse_hit, and cast_undead', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Necro', x: 100, y: 100 })
      const unit = world.getUnit('player', 1)!

      const expectedTokens: ReadonlyArray<{
        readonly token: string
        readonly frames: number
        readonly animRate: number
        readonly loop: boolean
      }> = [
        { token: 'curseamplifydamage', frames: 24, animRate: 16, loop: true },
        { token: 'cursedimvision', frames: 24, animRate: 16, loop: true },
        { token: 'curseweaken', frames: 24, animRate: 16, loop: true },
        { token: 'curseironmaiden', frames: 29, animRate: 16, loop: true },
        { token: 'curseterror', frames: 20, animRate: 16, loop: true },
        { token: 'curseconfuse', frames: 24, animRate: 16, loop: true },
        { token: 'cursereversevampire', frames: 24, animRate: 16, loop: true },
        { token: 'curseattract', frames: 24, animRate: 16, loop: true },
        { token: 'cursedecrepify', frames: 24, animRate: 16, loop: true },
        { token: 'curselowerresist', frames: 29, animRate: 16, loop: true },
        { token: 'curse_hit', frames: 10, animRate: 16, loop: false },
        { token: 'cast_undead', frames: 16, animRate: 16, loop: false },
      ]

      for (const spec of expectedTokens) {
        unit.overlays = []
        const ov = (world as any).attachUnitOverlay(unit, spec.token, spec.loop)
        expect(ov, `overlay for ${spec.token}`).toBeDefined()
        expect(ov.totalFrames, `${spec.token} totalFrames`).toBe(spec.frames)
        expect(ov.maxTicks, `${spec.token} maxTicks`).toBe(Math.ceil((spec.frames * 16) / spec.animRate))
      }
    })

    it('loops Lower Resist (curselowerresist) across all 29 frames without truncating at frame 20', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Necro', x: 100, y: 100 })
      const monster = (world as any).ensureUnit('monster', 10)
      monster.classId = 0
      monster.x = 102
      monster.y = 102

      const ov = (world as any).attachUnitOverlay(monster, 'curselowerresist', true)
      expect(ov.totalFrames).toBe(29)
      expect(ov.maxTicks).toBe(29)

      const visitedFrames = new Set<number>()
      for (let t = 0; t < 29; t++) {
        visitedFrames.add(ov.frame)
        ;(world as any).stepDiscreteSimulationTick(40)
      }
      expect(visitedFrames.size).toBe(29)
      expect(visitedFrames.has(20)).toBe(true)
      expect(visitedFrames.has(28)).toBe(true)
      expect(ov.frame).toBe(0)
    })

    it('rejects tokens not in Overlay.txt (reports missing art and does not push to unit.overlays)', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Necro', x: 100, y: 100 })
      const unit = world.getUnit('player', 1)!
      unit.overlays = []
      clearMissingArtEntries()

      const res = (world as any).attachUnitOverlay(unit, 'not_an_overlay_txt_token', false)
      expect(res).toBeUndefined()
      expect(unit.overlays).toHaveLength(0)
      expect(getMissingArtEntries().some((m) => m.id === 'not_an_overlay_txt_token')).toBe(true)
    })
  })

  describe('#1071 (B5-9): Multi-stage state overlays draw a single stage (117/120 setfunc 16, 151 setfunc 8, 122..127 setfunc 1)', () => {
    it('STATE_OVERLAYS contains only States.txt overlay1..4 (122..127 absent) and STATE_PGSV_OVERLAYS maps 122..127 to pgsvoverlay', () => {
      for (let stateId = 122; stateId <= 127; stateId++) {
        expect(STATE_OVERLAYS[stateId]).toBeUndefined()
      }
      expect(STATE_PGSV_OVERLAYS).toEqual({
        122: 'progressive_damage_1',
        123: 'progressive_steal_1',
        124: 'progressive_other_1',
        125: 'progressive_fire_1',
        126: 'progressive_cold_1',
        127: 'progressive_lightning_1',
      })

      const parsed = parseStatesTxtOverlays(
        [
          'state\tid\toverlay1\toverlay2\toverlay3\toverlay4\tpgsv\tpgsvoverlay',
          'progressive_fire\t125\t\t\t\t\t1\tprogressive_fire_1',
        ].join('\n'),
        OVERLAY_TXT_ROWS,
      )
      expect(parsed[125]).toBeUndefined()
    })

    it('draws only 2 overlays for state 117 (charges=2 -> maul2 + maul2back), 1 for state 125 (charge=1 -> progressive_fire_1), 1 for state 126 (charge=1 -> progressive_cold_1), and 1 for state 151 (full absorb -> cyclonearmor1front)', () => {
      // State 117 with charges=2 -> only maul2 and maul2back
      const maulScene = buildSceneDrawables([
        {
          kind: 'player',
          id: 1,
          classId: 5,
          x: 50,
          y: 50,
          states: [117],
          charges: 2,
        } as any,
      ])
      expect(maulScene.overlayDrawables.map((d) => d.token)).toEqual(['maul2', 'maul2back'])

      // State 125 with charge=1 -> only progressive_fire_1
      const fireScene = buildSceneDrawables([
        {
          kind: 'player',
          id: 2,
          classId: 6,
          x: 50,
          y: 50,
          states: [125],
          charge: 1,
        } as any,
      ])
      expect(fireScene.overlayDrawables.map((d) => d.token)).toEqual(['progressive_fire_1'])

      // State 126 with charge=1 -> only progressive_cold_1 (and charge=3 -> progressive_cold_3)
      const coldScene1 = buildSceneDrawables([
        {
          kind: 'player',
          id: 3,
          classId: 6,
          x: 50,
          y: 50,
          states: [126],
          charge: 1,
        } as any,
      ])
      expect(coldScene1.overlayDrawables.map((d) => d.token)).toEqual(['progressive_cold_1'])

      const coldScene3 = buildSceneDrawables([
        {
          kind: 'player',
          id: 3,
          classId: 6,
          x: 50,
          y: 50,
          states: [126],
          charge: 3,
        } as any,
      ])
      expect(coldScene3.overlayDrawables.map((d) => d.token)).toEqual(['progressive_cold_3'])

      // State 151 (cyclonearmor) at full absorb, mid absorb, and low absorb
      const cycloneFull = buildSceneDrawables([
        {
          kind: 'player',
          id: 4,
          classId: 5,
          x: 50,
          y: 50,
          states: [151],
          stats: { 132: 120, 133: 120 },
        } as any,
      ])
      expect(cycloneFull.overlayDrawables.map((d) => d.token)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
        'cyclonearmor2back',
        'cyclonearmor2front',
        'cyclonearmor3back',
        'cyclonearmor3front',
      ])

      const cycloneMid = buildSceneDrawables([
        {
          kind: 'player',
          id: 4,
          classId: 5,
          x: 50,
          y: 50,
          states: [151],
          stats: { 132: 60, 133: 120 },
        } as any,
      ])
      expect(cycloneMid.overlayDrawables.map((d) => d.token)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
        'cyclonearmor2back',
        'cyclonearmor2front',
      ])

      const cycloneLow = buildSceneDrawables([
        {
          kind: 'player',
          id: 4,
          classId: 5,
          x: 50,
          y: 50,
          states: [151],
          stats: { 132: 20, 133: 120 },
        } as any,
      ])
      expect(cycloneLow.overlayDrawables.map((d) => d.token)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
      ])
    })
  })

  describe('#1072 (B5-10): Druid Maul/Feral Rage use real maul1..5/feralrage1..5 + back via state 117/120 with no *front aliases', () => {
    it('draws maul{k}+maul{k}back and feralrage{k}+feralrage{k}back for k=1..5 without attaching fake *front tokens', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Druid', x: 100, y: 100 })
      const druid = world.getUnit('player', 1)!

      for (let k = 1; k <= 5; k++) {
        ;(world as any).spawnMissilesForSkill(druid, 233, druid.x + 1, druid.y, 10)
        expect(druid.states.has(117)).toBe(true)
        expect(druid.overlays.some((o) => o.token.includes('front'))).toBe(false)
        expect(resolveStateOverlayTokens113c(druid, 117)).toEqual([`maul${k}`, `maul${k}back`])
        const scene = buildSceneDrawables([druid])
        const maulTokens = scene.overlayDrawables
          .map((d) => d.token)
          .filter((t) => t.startsWith('maul'))
        expect(maulTokens).toEqual([`maul${k}`, `maul${k}back`])
      }

      druid.states.remove(117)
      for (let k = 1; k <= 5; k++) {
        ;(world as any).spawnMissilesForSkill(druid, 232, druid.x + 1, druid.y, 10)
        expect(druid.states.has(120)).toBe(true)
        expect(druid.overlays.some((o) => o.token.includes('front'))).toBe(false)
        expect(resolveStateOverlayTokens113c(druid, 120)).toEqual([
          `feralrage${k}`,
          `feralrage${k}back`,
        ])
        const scene = buildSceneDrawables([druid])
        const frTokens = scene.overlayDrawables
          .map((d) => d.token)
          .filter((t) => t.startsWith('feralrage'))
        expect(frTokens).toEqual([`feralrage${k}`, `feralrage${k}back`])
      }
    })

    it('contains no maul*front or feralrage*front keys in OVERLAY_METAS or OVERLAY_TARGETS', () => {
      for (let k = 1; k <= 5; k++) {
        expect(OVERLAY_METAS[`maul${k}front`]).toBeUndefined()
        expect(OVERLAY_METAS[`feralrage${k}front`]).toBeUndefined()
        expect(OVERLAY_METAS[`maul${k}`]).toBeDefined()
        expect(OVERLAY_METAS[`maul${k}back`]).toBeDefined()
        expect(OVERLAY_METAS[`feralrage${k}`]).toBeDefined()
        expect(OVERLAY_METAS[`feralrage${k}back`]).toBeDefined()
      }
      for (const target of OVERLAY_TARGETS) {
        expect(target.name).not.toMatch(/^(maul|feralrage)\d+front$/)
        for (const alias of target.aliases ?? []) {
          expect(alias).not.toMatch(/^(maul|feralrage)\d+front$/)
        }
      }
    })
  })
})
