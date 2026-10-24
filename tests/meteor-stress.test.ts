/**
 * Diablo II: Lord of Destruction v1.13c — Skill #056: Meteor
 * Empirical Stress Testing & Adversarial Verification Suite
 *
 * Requirements (User Request & Solution Stress Testing Playbook):
 * 1. Countdown timing: verify meteor lands and detonates exactly at tick 60, not sooner or later.
 * 2. Dual sprite trajectory: verify meteor core (ID 100) and tail (ID 102) maintain synchronized coordinate descent.
 * 3. Exact 18 residual fire patch offsets spawned around impact point matching 0x6FD1C918 and 0x6FD1C8D0.
 * 4. Wall collision drop: fire patches spawned in wall cells are rejected (COLLIDE_WALL | COLLIDE_BLANK).
 * 5. 50,000-tick continuous rapid-casting stress test: verify zero unhandled exceptions, zero NaN coordinates,
 *    clean missile disposal, and bounded memory.
 */
import { describe, expect, it } from 'vitest'
import {
  tickProjectiles,
  ISO_GROUND_ASPECT_RATIO,
  calculateMeteorDamage,
  calculateMeteorResidualFireDamage,
  calculateMeteorDetailedDamage,
  METEOR_FIRE_SUBTILE_OFFSETS,
  type Projectile,
  type ProjectileTarget,
} from '../src/server/skills/skills.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import type { CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'

describe('[Skill #056] Meteor — Empirical Stress & Physics Challenger Suite', () => {
  const openTerrain = { overlap: () => 0 }

  // =========================================================================
  // Dimension 1: Countdown Timing Parity (Detonates Exactly at Tick 60)
  // =========================================================================
  describe('Dimension 1: Countdown Timing Parity (Exact Tick 60 Detonation)', () => {
    it('verifies in MissileEngine that meteorcenter detonates at tick 60 and not at tick 59 or 61', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const ownerStatList = new UnitStatList(registry, {})
      const owner: CombatUnitContext = {
        id: 'sorc',
        name: 'Sorceress',
        isUndead: false,
        isDemon: false,
        statList: ownerStatList,
        stateBus: new StateBus(ownerStatList, registry),
      }

      const dummyStatList = new UnitStatList(registry, { maxhp: 50000 * 256, hitpoints: 50000 * 256 })
      const dummy: CombatUnitContext = {
        id: 'target-dummy',
        name: 'TargetDummy',
        isUndead: false,
        isDemon: false,
        statList: dummyStatList,
        stateBus: new StateBus(dummyStatList, registry),
      }

      const targetPositions = new Map([['target-dummy', { x: 300, y: 300 }]])

      // Spawn meteorcenter at (300, 300)
      engine.spawnMissile({
        missileNameOrId: 'meteorcenter',
        sourceSkillId: 56,
        slvl: 1,
        owner,
        startX: 300,
        startY: 300,
        targetX: 300,
        targetY: 300,
        dmgPacket: {
          skillId: 56,
          attackKind: 'spell',
          elemType: 'fire',
          elemMin256: 80 * 256,
          elemMax256: 100 * 256,
          autoHit: true,
        },
      })

      let detonationTick: number | null = null
      let spawnedSubmissilesOnDetonation: string[] = []

      // Step simulation tick by tick from 1 to 65
      for (let tick = 1; tick <= 65; tick++) {
        const step = engine.tick(tick, [dummy], targetPositions)

        if (step.hits.length > 0) {
          if (detonationTick === null) {
            detonationTick = tick
            spawnedSubmissilesOnDetonation = [...step.subMissilesSpawned]
          }
        }

        if (tick < 60) {
          // In ticks 1..59, meteorcenter must still be falling/waiting, 0 damage inflicted
          expect(step.hits.length, `Premature hit at tick ${tick}`).toBe(0)
          const center = engine.getActiveMissiles().find(m => m.name === 'meteorcenter')
          expect(center, `meteorcenter disappeared before tick 60 at tick ${tick}`).toBeDefined()
          expect(center!.ageTicks).toBe(tick)
        } else if (tick === 60) {
          // Exactly on tick 60: primary detonation must trigger!
          expect(step.hits.length, `Expected detonation at tick 60, but got 0 hits`).toBe(1)
          expect(step.hits[0]!.missileName).toBe('meteorexplode')
          expect(step.hits[0]!.damage).toBeGreaterThan(0)
        } else {
          // Past tick 60: meteorcenter must be expired and removed from active missiles
          const center = engine.getActiveMissiles().find(m => m.name === 'meteorcenter')
          expect(center, `meteorcenter lingered past tick 60 at tick ${tick}`).toBeUndefined()
        }
      }

      expect(detonationTick, 'Detonation must happen exactly at tick 60').toBe(60)
      expect(spawnedSubmissilesOnDetonation).toContain('meteorexplode')
      expect(spawnedSubmissilesOnDetonation.filter(s => s === 'meteorfire').length).toBe(18)
    })

    it('verifies in tickProjectiles whether meteorcenter detonates at tick 60 or tick 61', () => {
      let center: Projectile = {
        skillId: '56',
        x: 300,
        y: 300,
        vx: 0,
        vy: 0,
        damage: 500,
        ttl: 60,
        fromPlayer: true,
        missileType: 'meteorcenter',
        slvl: 1,
      }

      const dummyMonster = [{ index: 0, x: 300, y: 300, radius: 20, alive: true }]

      let detonationTick: number | null = null

      for (let tick = 1; tick <= 65; tick++) {
        const outcome = tickProjectiles([center], dummyMonster, openTerrain)

        if (outcome.hits.length > 0 && detonationTick === null) {
          detonationTick = tick
        }

        if (outcome.alive.length > 0) {
          center = outcome.alive[0]!
        } else {
          center = { ...center, ttl: -1 }
        }
      }

      // 1.13c Ground Truth: Meteor has Range: 60 ticks.
      // If tickProjectiles detonates at tick 61 instead of tick 60, this test detects the off-by-one tick delay.
      expect(detonationTick, `tickProjectiles detonation tick should be 60, but was ${detonationTick}`).toBe(60)
    })
  })

  // =========================================================================
  // Dimension 2: Dual Sprite Trajectory Synchronization (Core & Tail)
  // =========================================================================
  describe('Dimension 2: Dual Sprite Trajectory Synchronization (Core & Tail)', () => {
    it('verifies meteor core (ID 100) and tail (ID 102) exist and maintain synchronized coordinate descent', () => {
      // 1.13c Ground Truth (D2Client.dll 0x6FB68840 / Missiles.txt):
      // When meteorcenter (101) is cast, client children meteor (100) and meteortail (102)
      // are spawned and descend from the sky to the ground target over 60 ticks.
      // Altitude: Z(t) = (60 - t) * 25
      // Coordinate descent: X(t) = targetX - (60 - t) * 15, Y(t) = targetY - (60 - t) * 15
      // Both core and tail must share synchronized trajectory.

      const targetX = 400
      const targetY = 300

      // Create core and tail projectiles
      const core: Projectile = {
        skillId: '56',
        x: targetX,
        y: targetY,
        vx: 0,
        vy: 0,
        damage: 0,
        ttl: 60,
        fromPlayer: true,
        missileType: 'meteor',
        altitude: 60 * 25,
      }

      const tail: Projectile = {
        skillId: '56',
        x: targetX,
        y: targetY,
        vx: 0,
        vy: 0,
        damage: 0,
        ttl: 60,
        fromPlayer: true,
        missileType: 'meteortail',
        altitude: 60 * 25,
      }

      let activeProjectiles: Projectile[] = [core, tail]

      for (let t = 1; t <= 60; t++) {
        const step = tickProjectiles(activeProjectiles, [], openTerrain)
        activeProjectiles = step.alive as Projectile[]

        const curCore = activeProjectiles.find(p => p.missileType === 'meteor')
        const curTail = activeProjectiles.find(p => p.missileType === 'meteortail')

        // If core and tail are implemented in simulation:
        if (curCore !== undefined && curTail !== undefined) {
          // Verify synchronized coordinates
          expect(curCore.x).toBe(curTail.x)
          expect(curCore.y).toBe(curTail.y)
          expect(curCore.altitude).toBe(curTail.altitude)

          // Verify monotonic descent
          if (curCore.altitude !== undefined) {
            expect(curCore.altitude).toBeLessThanOrEqual(60 * 25)
            if (t === 60) {
              expect(curCore.altitude).toBeLessThanOrEqual(0)
            }
          }
        } else {
          // If neither core nor tail is updated/supported, fail and report missing dual sprite trajectory
          expect(curCore, `meteor (ID 100) core missile missing from simulation at tick ${t}`).toBeDefined()
          expect(curTail, `meteortail (ID 102) tail missile missing from simulation at tick ${t}`).toBeDefined()
        }
      }
    })
  })

  // =========================================================================
  // Dimension 3: Exact 18 Residual Fire Patch Offsets Matching 0x6FD1C918/8D0
  // =========================================================================
  describe('Dimension 3: Exact 18 Residual Fire Patch Offsets (0x6FD1C918 / 0x6FD1C8D0)', () => {
    it('verifies verbatim match of all 18 subtile offset pairs against D2Game.dll ground truth', () => {
      const GROUND_TRUTH_OFFSETS = [
        { x:  2, y: -2 }, // [0]  Inner Ring
        { x: -2, y: -2 }, // [1]  Inner Ring
        { x:  0, y:  2 }, // [2]  Inner Ring
        { x:  0, y:  5 }, // [3]  North Tip
        { x: -3, y:  3 }, // [4]  North-West Outer
        { x:  0, y:  3 }, // [5]  Center-North
        { x:  3, y:  3 }, // [6]  North-East Outer
        { x: -1, y:  2 }, // [7]  Center Cluster
        { x:  1, y:  1 }, // [8]  Center Cluster
        { x: -1, y: -1 }, // [9]  Center Cluster
        { x:  2, y: -1 }, // [10] Center Cluster
        { x: -4, y: -2 }, // [11] West Tip
        { x: -3, y: -2 }, // [12] West Outer
        { x: -1, y: -3 }, // [13] South-West Outer
        { x:  0, y: -4 }, // [14] South Tip
        { x:  1, y: -3 }, // [15] South-East Outer
        { x:  3, y: -3 }, // [16] East Outer
        { x:  4, y: -2 }, // [17] East Tip
      ]

      expect(METEOR_FIRE_SUBTILE_OFFSETS.length).toBe(18)
      for (let i = 0; i < 18; i++) {
        expect(METEOR_FIRE_SUBTILE_OFFSETS[i]).toEqual(GROUND_TRUTH_OFFSETS[i])
      }
    })

    it('verifies that detonation spawns exactly 18 meteorfire submissiles at correctly scaled pixel coordinates', () => {
      const centerX = 500
      const centerY = 500

      const center: Projectile = {
        skillId: '56',
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        damage: 300,
        ttl: 0, // detonates immediately
        fromPlayer: true,
        missileType: 'meteorcenter',
        slvl: 1,
      }

      const outcome = tickProjectiles([center], [], openTerrain)
      const spawnedFlames = outcome.spawnedProjectiles?.filter(p => p.missileType === 'meteorfire') ?? []

      expect(spawnedFlames.length).toBe(18)

      for (let i = 0; i < 18; i++) {
        const off = METEOR_FIRE_SUBTILE_OFFSETS[i]!
        const expectedX = centerX + off.x * 20
        const expectedY = centerY + off.y * 10

        const flame = spawnedFlames.find(f => f.x === expectedX && f.y === expectedY)
        expect(flame, `Missing meteorfire at offset [${i}] (${expectedX}, ${expectedY})`).toBeDefined()
        expect(flame!.ttl).toBe(90) // slvl 1: 90 ticks (3.6s per 1.13c)
        expect(flame!.pierce).toBe(true)
      }
    })
  })

  // =========================================================================
  // Dimension 4: Wall Collision Drop (COLLIDE_WALL | COLLIDE_BLANK)
  // =========================================================================
  describe('Dimension 4: Wall Collision Drop (COLLIDE_WALL | COLLIDE_BLANK)', () => {
    it('verifies fire patches falling inside solid wall cells are completely rejected in tickProjectiles', () => {
      const centerX = 300
      const centerY = 300

      const center: Projectile = {
        skillId: '56',
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        damage: 300,
        ttl: 0,
        fromPlayer: true,
        missileType: 'meteorcenter',
        slvl: 1,
      }

      // Case 1: East half is a wall (x > centerX = 300)
      const halfWallTerrain = {
        overlap: (x: number, _y: number) => (x > 300 ? 1 : 0),
      }

      const resHalf = tickProjectiles([center], [], halfWallTerrain)
      const flamesHalf = resHalf.spawnedProjectiles?.filter(p => p.missileType === 'meteorfire') ?? []

      expect(flamesHalf.length).toBeGreaterThan(0)
      expect(flamesHalf.length).toBeLessThan(18)
      for (const f of flamesHalf) {
        expect(f.x).toBeLessThanOrEqual(300)
      }

      // Case 2: Entire area is a solid wall
      const fullWallTerrain = {
        overlap: () => 1,
      }

      const resFull = tickProjectiles([center], [], fullWallTerrain)
      const flamesFull = resFull.spawnedProjectiles?.filter(p => p.missileType === 'meteorfire') ?? []
      expect(flamesFull.length).toBe(0) // All 18 fire patches dropped!

      // Case 3: Selective pinpoint wall blocking North Tip [3] (0, 5) -> (300, 350)
      const northTipX = centerX + 0 * 20
      const northTipY = centerY + 5 * 10
      const selectiveTerrain = {
        overlap: (x: number, y: number) => (x === northTipX && y === northTipY ? 1 : 0),
      }

      const resSelective = tickProjectiles([center], [], selectiveTerrain)
      const flamesSelective = resSelective.spawnedProjectiles?.filter(p => p.missileType === 'meteorfire') ?? []
      expect(flamesSelective.length).toBe(17)
      expect(flamesSelective.some(f => f.x === northTipX && f.y === northTipY)).toBe(false)
    })

    it('checks whether MissileEngine implements wall collision filtering for meteorfire spawning', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const ownerStatList = new UnitStatList(registry, {})
      const owner: CombatUnitContext = {
        id: 'sorc',
        name: 'Sorceress',
        isUndead: false,
        isDemon: false,
        statList: ownerStatList,
        stateBus: new StateBus(ownerStatList, registry),
      }

      engine.spawnMissile({
        missileNameOrId: 'meteorcenter',
        sourceSkillId: 56,
        slvl: 1,
        owner,
        startX: 200,
        startY: 200,
        targetX: 200,
        targetY: 200,
        dmgPacket: {
          skillId: 56,
          attackKind: 'spell',
          elemType: 'fire',
          elemMin256: 80 * 256,
          elemMax256: 100 * 256,
        },
      })

      // Tick 60 to trigger detonation
      for (let t = 1; t <= 60; t++) {
        engine.tick(t, [], new Map())
      }

      const activeFires = engine.getActiveMissiles().filter(m => m.name === 'meteorfire')
      // When no collision terrain is provided, all 18 submissiles spawn
      expect(activeFires.length).toBe(18)
    })

    it('verifies in MissileEngine that meteorfire submissiles landing in solid walls are dropped', async () => {
      const registry = await getSharedDataRegistry()
      // Terrain with eastern wall (x > 200)
      const halfWallTerrain = {
        overlap: (x: number, _y: number) => (x > 200 ? 1 : 0),
      }
      const engine = new MissileEngine(registry, halfWallTerrain)

      const ownerStatList = new UnitStatList(registry, {})
      const owner: CombatUnitContext = {
        id: 'sorc',
        name: 'Sorceress',
        isUndead: false,
        isDemon: false,
        statList: ownerStatList,
        stateBus: new StateBus(ownerStatList, registry),
      }

      engine.spawnMissile({
        missileNameOrId: 'meteorcenter',
        sourceSkillId: 56,
        slvl: 1,
        owner,
        startX: 200,
        startY: 200,
        targetX: 200,
        targetY: 200,
        dmgPacket: {
          skillId: 56,
          attackKind: 'spell',
          elemType: 'fire',
          elemMin256: 80 * 256,
          elemMax256: 100 * 256,
        },
      })

      // Tick 60 to trigger detonation
      for (let t = 1; t <= 60; t++) {
        engine.tick(t, [], new Map())
      }

      const activeFires = engine.getActiveMissiles().filter(m => m.name === 'meteorfire')
      expect(activeFires.length).toBeGreaterThan(0)
      expect(activeFires.length).toBeLessThan(18)
      expect(activeFires.every(m => m.x <= 200)).toBe(true)
    })
  })

  // =========================================================================
  // Dimension 5: 50,000-Tick Continuous Rapid-Casting Stress Simulation
  // =========================================================================
  describe('Dimension 5: 50,000-Tick Continuous Rapid-Casting Stress Simulation', () => {
    it('runs 50,000 ticks of continuous Meteor casting without crashes, NaNs, or memory leaks', () => {
      const simStartMs = Date.now()
      const heapBefore = process.memoryUsage().heapUsed

      let activeProjectiles: Projectile[] = []
      let totalCasts = 0
      let totalHits = 0
      let totalWallHits = 0
      let totalExpired = 0
      let peakActiveCount = 0

      // Dynamic moving targets in combat arena
      const targets: ProjectileTarget[] = [
        { index: 0, x: 250, y: 250, radius: 25, alive: true },
        { index: 1, x: 270, y: 260, radius: 20, alive: true },
        { index: 2, x: 230, y: 240, radius: 20, alive: true },
        { index: 3, x: 260, y: 230, radius: 20, alive: true },
        { index: 4, x: 350, y: 350, radius: 30, alive: true },
      ]

      // Semi-solid map terrain with boundary walls and interior pillar
      const hybridTerrain = {
        overlap: (x: number, y: number) => {
          if (x < 30 || x > 470 || y < 30 || y > 470) return 1 // perimeter walls
          if (x >= 280 && x <= 320 && y >= 280 && y <= 320) return 1 // central obstacle pillar
          return 0
        },
      }

      // 50,000 ticks = 2,000 seconds = 33.3 minutes of non-stop game simulation
      for (let tick = 0; tick < 50000; tick++) {
        // Cast Meteor on cooldown (every 30 ticks = 1.20s cast delay)
        if (tick % 30 === 0) {
          totalCasts++
          // Slight spatial variation across casts
          const cx = 250 + ((tick / 30) % 7) * 8 - 24
          const cy = 250 + ((tick / 30) % 5) * 10 - 20

          activeProjectiles.push({
            skillId: '56',
            x: cx,
            y: cy,
            vx: 0,
            vy: 0,
            damage: 200,
            ttl: 60, // 2.40s countdown
            fromPlayer: true,
            missileType: 'meteorcenter',
            slvl: 1,
            residualDamage: 25,
            fireDuration: 30,
          })
        }

        // Monsters move slightly every 8 ticks
        if (tick % 8 === 0) {
          for (let m = 0; m < targets.length; m++) {
            const angle = (tick * 0.04) + m * 1.2
            targets[m] = {
              ...targets[m]!,
              x: 250 + Math.cos(angle) * 35,
              y: 250 + Math.sin(angle) * 20 * ISO_GROUND_ASPECT_RATIO,
            }
          }
        }

        // Advance simulation tick
        const outcome = tickProjectiles(activeProjectiles, targets, hybridTerrain)
        activeProjectiles = outcome.alive as Projectile[]
        totalHits += outcome.hits.length
        totalWallHits += outcome.wallHits
        totalExpired += outcome.expired

        if (activeProjectiles.length > peakActiveCount) {
          peakActiveCount = activeProjectiles.length
        }

        // INVARIANT 1: Bounded missile count — no runaway projectile accumulation!
        // At any tick:
        // - At most 2 falling meteorcenters (ttl 60 / 30 = 2)
        // - At most 1 meteorexplode (ttl 16)
        // - At most 18-36 active residual fire patches (ttl 30)
        // Peak active projectiles should never exceed 100.
        if (activeProjectiles.length > 100) {
          throw new Error(`Runaway projectile leak at tick ${tick}: active count reached ${activeProjectiles.length}`)
        }

        // INVARIANT 2: Zero NaNs or non-finite numbers in any active missile
        for (const p of activeProjectiles) {
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
            throw new Error(`NaN detected in position at tick ${tick}: x=${p.x}, y=${p.y}`)
          }
          if (p.altitude !== undefined && (!Number.isFinite(p.altitude) || p.altitude < 0)) {
            throw new Error(`Invalid altitude at tick ${tick}: altitude=${p.altitude}`)
          }
          if (!Number.isFinite(p.ttl) || p.ttl < 0) {
            throw new Error(`Invalid ttl at tick ${tick}: ttl=${p.ttl}`)
          }
        }
      }

      const simElapsedMs = Date.now() - simStartMs
      const heapAfter = process.memoryUsage().heapUsed
      const heapDiffMb = (heapAfter - heapBefore) / (1024 * 1024)

      // Assertions on 50,000 tick completion
      expect(totalCasts).toBe(Math.floor(50000 / 30) + 1) // 1,667 Meteor casts
      expect(totalHits).toBeGreaterThan(1000) // thousands of hits registered
      expect(peakActiveCount).toBeLessThanOrEqual(65) // comfortably bounded
      expect(activeProjectiles.length).toBeLessThanOrEqual(40) // final active count bounded
      expect(heapDiffMb).toBeLessThan(25) // stable heap (< 25 MB delta)

      console.log(`[50,000-Tick Meteor Stress Sim Completed]`)
      console.log(`  Duration: ${simElapsedMs} ms (${(50000 / (simElapsedMs / 1000)).toFixed(0)} ticks/sec)`)
      console.log(`  Total Casts: ${totalCasts}`)
      console.log(`  Total Hits: ${totalHits}`)
      console.log(`  Total Wall Hits: ${totalWallHits}`)
      console.log(`  Total Expired Missiles: ${totalExpired}`)
      console.log(`  Peak Active Projectiles: ${peakActiveCount}`)
      console.log(`  Final Active Projectiles: ${activeProjectiles.length}`)
      console.log(`  Heap Diff: ${heapDiffMb.toFixed(2)} MB`)
    })
  })
})
