import { describe, expect, it } from 'vitest'
import { AudioRuntime113c } from '../../src/client/audio/audio-runtime-113c.ts'
import { resolveSkillSequenceFrame } from '../../src/common/skills/skill-anim-modes.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  LEAP_SETUP_TABLE_113C,
  computeLeapTrajectoryParams113c,
} from '../../src/client/world/world-skill-missiles.ts'
import { buildSceneDrawables, type SceneUnitDrawable } from '../../src/client/view/unit-drawables.ts'

describe('Barbarian Whirlwind (#151) & Leap (#132) / Leap Attack (#143) 1.13c Parity (Issue #1305)', () => {
  describe('Bug 1: Whirlwind (#151) character rotation speed & looping sequence frames', () => {
    it('loops spinning sequence frames 3..7 after startup frames 0..2 instead of clamping on frame 7', () => {
      const f0 = resolveSkillSequenceFrame(151, 'hth', 0, 256)
      const f2 = resolveSkillSequenceFrame(151, 'hth', 2, 256)
      const f3 = resolveSkillSequenceFrame(151, 'hth', 3, 256)
      const f8 = resolveSkillSequenceFrame(151, 'hth', 8, 256)
      const f9 = resolveSkillSequenceFrame(151, 'hth', 9, 256)
      const f12 = resolveSkillSequenceFrame(151, 'hth', 12, 256)

      expect(f0?.sequenceFrame).toBe(0)
      expect(f0?.done).toBe(false)
      expect(f2?.sequenceFrame).toBe(2)
      expect(f3?.sequenceFrame).toBe(3)
      // At tick 8 (past the 8-frame table), SKILLS_CltDo45_Whirlwind (0x6FB76583) loops back to frame 3..7
      expect(f8?.sequenceFrame).toBe(3)
      expect(f8?.done).toBe(false)
      expect(f9?.sequenceFrame).toBe(4)
      expect(f9?.done).toBe(false)
      expect(f12?.sequenceFrame).toBe(7)
      expect(f12?.done).toBe(false)
    })

    it('rotates both direction and targetDirection by 1 quadrant (+16 dir64 = 90°) per 25Hz tick without advanceTurn tug-of-war', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: {
          unitType: 'player',
          id: 1,
          classId: 4, // Barbarian
          name: 'Conan',
          x: 100,
          y: 100,
          mode: 1,
          direction: 0,
        },
        isSelf: true,
      })
      const barb = world.getUnit('player', 1)!
      expect(barb).toBeDefined()

      world.apply({
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 151,
        level: 1,
        target: { x: 110, y: 100 },
      })
      world.drainWorldSoundRequests()

      const startDir = barb.direction
      expect(barb.targetDirection).toBe(startDir)

      // Simulate four 25Hz ticks broken into sub-ticks (e.g., 10ms high-refresh render steps)
      // to verify advanceTurn(safeDt) never pulls direction back toward the initial cast direction.
      const seenDirs: number[] = [startDir]
      for (let t = 0; t < 4; t++) {
        for (let sub = 0; sub < 4; sub++) {
          world.tick(10)
        }
        seenDirs.push(barb.direction)
        expect(barb.targetDirection).toBe(barb.direction)
      }

      expect(seenDirs[1]).toBe((startDir + 16) & 63)
      expect(seenDirs[2]).toBe((startDir + 32) & 63)
      expect(seenDirs[3]).toBe((startDir + 48) & 63)
      expect(seenDirs[4]).toBe(startDir)
    })
  })

  describe('Bug 2: Whirlwind (#151) sound effect (2531) lifecycle & multi-cast deduplication', () => {
    it('stops/fades barbarian_whirlwind (2531, FadeOut=6) when Whirlwind ends and prevents stacking across multiple casts', () => {
      const world = new ClientWorld()
      const audio = new AudioRuntime113c({
        listenerPos: () => ({ x: 100, y: 100 }),
      })
      world.apply({
        type: 'UnitAssign',
        unit: {
          unitType: 'player',
          id: 1,
          classId: 4,
          name: 'Conan',
          x: 100,
          y: 100,
          mode: 1,
          direction: 0,
        },
        isSelf: true,
      })

      // Cast #1 (short Whirlwind)
      world.apply({
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 151,
        level: 1,
        target: { x: 101, y: 100 },
      })
      audio.drainWorldRequests(world.drainWorldSoundRequests())

      const getActiveRecs = (): any[] => (audio.records as any).active as any[]
      const activeAfterCast1 = getActiveRecs().filter(
        (r) => r.id >= 2531 && r.id <= 2534 && !r.stop,
      )
      expect(activeAfterCast1.length).toBe(1)

      // Cast #2 & Cast #3 before Cast #1 buffer finishes: prior 2531 record is stopped/faded, never stacked
      world.apply({
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 151,
        level: 1,
        target: { x: 102, y: 100 },
      })
      audio.drainWorldRequests(world.drainWorldSoundRequests())

      world.apply({
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 151,
        level: 1,
        target: { x: 101, y: 100 },
      })
      audio.drainWorldRequests(world.drainWorldSoundRequests())

      const nonFadingActive = getActiveRecs().filter(
        (r) => r.id >= 2531 && r.id <= 2534 && !r.stop && !r.fading,
      )
      expect(nonFadingActive.length).toBe(1)

      // Step world until Whirlwind reaches target and clears castState
      for (let i = 0; i < 6; i++) {
        world.tick(40)
        audio.drainWorldRequests(world.drainWorldSoundRequests())
        audio.soundTick(world.frameCount)
      }

      const barb = world.getUnit('player', 1)!
      expect(barb.castState).toBeUndefined()

      // After FadeOut=6 ticks complete, no Whirlwind sound remains active
      for (let i = 0; i < 8; i++) {
        world.tick(40)
        audio.soundTick(world.frameCount)
      }
      const remaining = getActiveRecs().filter(
        (r) => r.id >= 2531 && r.id <= 2534 && !r.stop,
      )
      expect(remaining.length).toBe(0)
    })
  })

  describe('Bug 3 & Bug 4: Leap (#132) & Leap Attack (#143) distance-based parabolic jump height & landing sound (2517)', () => {
    it('matches 1.13c D2LeapSetupTableStrc (0x6FB85F54) 4 distance tiers (velMag = 9, stepSpeed = 0.5625)', () => {
      expect(LEAP_SETUP_TABLE_113C).toEqual([
        { velMag: 9, peakZ: 34 },
        { velMag: 9, peakZ: 127 },
        { velMag: 9, peakZ: 216 },
        { velMag: 9, peakZ: 70 },
      ])

      const t0 = computeLeapTrajectoryParams113c(6) // 1..8 subtiles -> tier 0
      const t1 = computeLeapTrajectoryParams113c(12) // 9..16 subtiles -> tier 1
      const t2 = computeLeapTrajectoryParams113c(20) // 17..24 subtiles -> tier 2
      const t3 = computeLeapTrajectoryParams113c(28) // >=25 subtiles -> tier 3

      expect(t0.sizeIdx).toBe(0)
      expect(t0.peakZ).toBe(34)
      expect(t0.stepSpeed).toBe(0.5625)

      expect(t1.sizeIdx).toBe(1)
      expect(t1.peakZ).toBe(127)
      expect(t1.stepSpeed).toBe(0.5625)

      expect(t2.sizeIdx).toBe(2)
      expect(t2.peakZ).toBe(216)
      expect(t2.stepSpeed).toBe(0.5625)

      expect(t3.sizeIdx).toBe(3)
      expect(t3.peakZ).toBe(70)
      expect(t3.stepSpeed).toBe(0.5625)
    })

    it('renders higher jump arc altitude for longer Leap (#132) & Leap Attack (#143) distances and emits landing sound 2517 + dust overlay on touchdown', () => {
      const runJumpSim = (skillId: 132 | 143, distanceSubtiles: number) => {
        const world = new ClientWorld()
        world.apply({
          type: 'UnitAssign',
          unit: {
            unitType: 'player',
            id: 1,
            classId: 4,
            name: 'Conan',
            x: 100,
            y: 100,
            mode: 1,
            direction: 0,
          },
          isSelf: true,
        })
        world.apply({
          type: 'SkillCast',
          caster: { unitType: 'player', id: 1 },
          skill: skillId,
          level: 1,
          target: { x: 100 + distanceSubtiles, y: 100 },
        })
        world.drainWorldSoundRequests() // drain takeoff cast sound (2515)

        const barb = world.getUnit('player', 1)!
        let maxAltitude = 0
        const soundIdsOnFlightAndLand: number[] = []

        for (let tick = 0; tick < 65 && barb.castState !== undefined; tick++) {
          world.tick(40)
          const alt = barb.altitude ?? 0
          if (alt > maxAltitude) {
            maxAltitude = alt
            const scene = buildSceneDrawables({
              tick: world.frameCount,
              units: [
                {
                  id: barb.id,
                  kind: 'player',
                  classId: barb.classId,
                  x: barb.x,
                  y: barb.y,
                  mode: barb.mode,
                  direction: barb.direction,
                  altitude: barb.altitude,
                  isLocalPlayer: true,
                },
              ],
            })
            const unitDrawable = scene.unitDrawables.find(
              (e): e is SceneUnitDrawable => e.drawableKind === 'unit' && e.id === 1,
            )
            expect(unitDrawable?.altitude).toBe(alt)
          }
          for (const req of world.drainWorldSoundRequests()) {
            if (req.soundId !== undefined) {
              soundIdsOnFlightAndLand.push(req.soundId)
            }
          }
        }

        expect(barb.castState).toBeUndefined()
        expect(barb.altitude).toBe(0)
        expect(barb.x).toBeCloseTo(100 + distanceSubtiles, 5)
        expect(soundIdsOnFlightAndLand).toContain(2517) // barbarian_leap_land
        expect(barb.overlays.some((o) => o.token.toLowerCase() === 'dust')).toBe(true)

        return maxAltitude
      }

      const shortLeapPeak = runJumpSim(132, 6) // tier 0 (peakZ 34)
      const medLeapPeak = runJumpSim(132, 12) // tier 1 (peakZ 127)
      const longLeapPeak = runJumpSim(132, 20) // tier 2 (peakZ 216)
      const maxLeapAttackPeak = runJumpSim(143, 28) // tier 3 (peakZ 70)

      expect(shortLeapPeak).toBe(34)
      expect(medLeapPeak).toBe(127)
      expect(longLeapPeak).toBe(216)
      expect(maxLeapAttackPeak).toBe(70)
    })
  })
})
