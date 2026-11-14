/**
 * Diablo II: Lord of Destruction v1.13c — Skill #059: Blizzard
 * Empirical Stress Testing & Adversarial Verification Suite
 *
 * Requirements (User Request & Solution Stress Testing Playbook):
 * 1. Altitude descent: 120 px to 0 px over 9 ticks (linear 120/9 px/tick, clamped at 0).
 * 2. Ground impact explosion at tick 9 vs immediate explosion on monster collision at tick t < 9.
 * 3. NextDelay = 0: multiple shards hitting the same target deal damage without cooldown immunity
 *    (both simultaneous hits and consecutive tick hits, with differential oracle contrast).
 * 4. Wall collisions: shards hitting walls explode and terminate cleanly without memory leak or hanging.
 * 5. 100,000 tick continuous stress simulation: verifying stability, bounded active missile count,
 *    zero NaNs, zero crashes, and zero memory leaks over 2,222+ Blizzard casts.
 */
import { describe, expect, it } from 'vitest'
import {
  tickProjectiles,
  ISO_GROUND_ASPECT_RATIO,
  calculateBlizzardDamage,
  calculateBlizzardSynergyMultiplier,
  CANONICAL_113C_MISSILES,
  type Projectile,
  type ProjectileTarget,
} from '../src/server/skills/skills.ts'
import {
  BLIZZARD_CIRCLE_X,
  BLIZZARD_CIRCLE_Y,
  getBlizzardDropOffset,
} from '../src/common/data/blizzard-table.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import type { CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'
import { renderSceneSourceFrame } from '../src/client/scene/world-renderer.ts'
import { celFileArtKey } from '../src/client/render/cel-file-key.ts'
import type { SceneMissileDrawable } from '../src/client/view/unit-drawables.ts'

describe('[Skill #059] Blizzard — Empirical Stress & Physics Challenger Suite', () => {
  const openTerrain = { overlap: () => 0 }
  const wallTerrain = { overlap: () => 1 }

  // =========================================================================
  // Dimension 1: Shard Altitude Descent Physics (120 px -> 0 px over 9 ticks)
  // =========================================================================
  describe('Dimension 1: Shard Altitude Descent Physics (120 px -> 0 px over 9 ticks)', () => {
    const shardVariants = ['blizzard1', 'blizzard2', 'blizzard3', 'blizzard4'] as const

    for (const variant of shardVariants) {
      it(`verifies altitude descent of ${variant} tick-by-tick from 120 px to 0 px over exactly 9 ticks`, () => {
        let shard: Projectile = {
          skillId: '59',
          x: 200,
          y: 200,
          vx: 0,
          vy: 0,
          altitude: 120,
          damage: 100,
          ttl: 9,
          fromPlayer: true,
          missileType: variant,
        }

        const descentRate = 120 / 9 // 13.333333333333334 px/tick

        for (let tick = 1; tick <= 9; tick++) {
          const outcome = tickProjectiles([shard], [], openTerrain)
          shard = outcome.alive.find(p => p.missileType === variant)!

          expect(shard).toBeDefined()
          expect(shard.ttl).toBe(9 - tick)

          const expectedAltitude = Math.max(0, 120 - tick * descentRate)
          expect(shard.altitude).toBeCloseTo(expectedAltitude, 0.001)

          if (tick === 9) {
            // At tick 9, altitude reaches ground level (within IEEE-754 float precision ~1e-14)
            expect(shard.altitude).toBeCloseTo(0, 5)
            expect(shard.ttl).toBe(0)
          } else {
            expect(shard.altitude).toBeGreaterThan(0)
          }
        }
      })
    }

    it('verifies altitude never drops below zero and remains non-negative even if ticked past 0', () => {
      let shard: Projectile = {
        skillId: '59',
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        altitude: 5, // very close to ground
        damage: 100,
        ttl: 5,
        fromPlayer: true,
        missileType: 'blizzard1',
      }

      // Tick once: 5 - (120/9) < 0, must be clamped to exactly 0
      const outcome = tickProjectiles([shard], [], openTerrain)
      const ticked = outcome.alive.find(p => p.missileType === 'blizzard1')!
      expect(ticked.altitude).toBe(0)
      expect(Number.isNaN(ticked.altitude!)).toBe(false)
      expect(Number.isFinite(ticked.altitude!)).toBe(true)
    })

    it('verifies visual screen projection offset: drawY = WorldY - altitude', () => {
      const drawnSprites: { x: number; y: number }[] = []
      const mockRenderer = {
        begin: () => {},
        flush: () => {},
        setLighting: () => {},
        setUnitLight: () => {},
        draw: (_frame: any, x: number, y: number) => {
          drawnSprites.push({ x, y })
        },
        drawSolid: (_x: number, _y: number) => {},
      } as any

      const mockArt = {
        meta: { name: 'blizzard1', directions: 1, framesPerDirection: 6, animSpeed: 16 },
        frames: [[{ x: 0, y: 0, anchorX: 0, anchorY: 0, width: 32, height: 64 }]],
        handle: 'atlas',
      } as any
      const missileArtMap = new Map([[celFileArtKey('IceBolt'), mockArt]])

      const baseMissile: SceneMissileDrawable = {
        drawableKind: 'missile',
        unitId: 1,
        missileClassId: 155,
        missileKey: 'blizzard1',
        celFile: 'IceBolt',
        direction: 0,
        frame: 0,
        totalFrames: 6,
        loopAnim: true,
        altitude: 120,
        subX: 10,
        subY: 10,
        worldX: 200,
        worldY: 200,
        sortY: 320,
        blendMode: 'additive',
        trans: 1,
        lightRadius: 0,
        lightColor: [0, 0, 0],
      }

      // Shard at World (200, 200), altitude 120 -> screen Y should be 200 - 120 = 80
      renderSceneSourceFrame({
        renderer: mockRenderer,
        cameraX: 200,
        cameraY: 200,
        missileDrawables: [baseMissile],
        missileArtMap,
      } as any)
      expect(drawnSprites.length).toBe(1)
      expect(drawnSprites[0]!.y).toBe(200 - 120) // 80 px

      // Shard at World (200, 200), altitude 0 (ground level) -> screen Y should be 200
      drawnSprites.length = 0
      renderSceneSourceFrame({
        renderer: mockRenderer,
        cameraX: 200,
        cameraY: 200,
        missileDrawables: [{ ...baseMissile, altitude: 0, sortY: 200 }],
        missileArtMap,
      } as any)
      expect(drawnSprites.length).toBe(1)
      expect(drawnSprites[0]!.y).toBe(200) // 200 px
    })

    it('verifies all 25 shards spawned from blizzardcenter initialize with altitude 120 px', () => {
      const center: Projectile = {
        skillId: '59',
        x: 300,
        y: 300,
        vx: 0,
        vy: 0,
        damage: 200,
        ttl: 100,
        fromPlayer: true,
        missileType: 'blizzardcenter',
        subMissileIdx: 0,
      }

      let current: Projectile[] = [center]
      const spawnedShards: Projectile[] = []

      for (let t = 1; t <= 100; t++) {
        const res = tickProjectiles(current, [], openTerrain)
        current = res.alive as Projectile[]
        if (res.spawnedProjectiles && res.spawnedProjectiles.length > 0) {
          for (const p of res.spawnedProjectiles) {
            if (p.missileType?.startsWith('blizzard') && !p.missileType.includes('explode')) {
              spawnedShards.push(p)
            }
          }
        }
      }

      expect(spawnedShards.length).toBe(25)
      for (const shard of spawnedShards) {
        expect(shard.altitude).toBe(120)
        expect(shard.ttl).toBe(9)
        expect(shard.damage).toBe(200)
        expect(shard.statusEffect).toBe('chill')
        expect(shard.statusDuration).toBe(100)
      }
    })
  })

  // =========================================================================
  // Dimension 2: Ground Impact Explosion (t = 9) vs Immediate Collision (t < 9)
  // =========================================================================
  describe('Dimension 2: Ground Impact Explosion (t = 9) vs Immediate Collision (t < 9)', () => {
    it('Case A (Ground Impact): shard reaches altitude 0 at tick 9 and detonates ground impact explosion on expiry', () => {
      let shard: Projectile = {
        skillId: '59',
        x: 250,
        y: 250,
        vx: 0,
        vy: 0,
        altitude: 120,
        damage: 150,
        ttl: 9,
        fromPlayer: true,
        missileType: 'blizzard1',
      }

      // Over ticks 1..9, no monster is present
      for (let tick = 1; tick <= 9; tick++) {
        const res = tickProjectiles([shard], [], openTerrain)
        expect(res.hits.length).toBe(0)
        expect(res.expired).toBe(0)
        shard = res.alive.find(p => p.missileType === 'blizzard1')!
        expect(shard).toBeDefined()
      }

      // At tick 9, shard is at ground level (altitude ~0 within IEEE-754 precision, ttl 0)
      expect(shard.altitude).toBeCloseTo(0, 5)
      expect(shard.ttl).toBe(0)

      // On next tick (tick 10), shard expires and detonates ground explosion
      const detonateRes = tickProjectiles([shard], [], openTerrain)
      expect(detonateRes.expired).toBe(1)
      expect(detonateRes.alive.some(p => p.missileType === 'blizzard1')).toBe(false)
      expect(detonateRes.spawnedProjectiles).toBeDefined()
      expect(detonateRes.spawnedProjectiles!.length).toBe(1)

      const exp = detonateRes.spawnedProjectiles![0]!
      expect(exp.missileType).toBe('blizzardexplode1')
      expect(exp.ttl).toBe(6) // 1.13c Range = 6
      expect(exp.statusEffect).toBe('chill')
      expect(exp.statusDuration).toBe(100) // 1.13c ElemLen = 100
      expect(exp.x).toBe(250)
      expect(exp.y).toBe(250)
    })

    it('Case B (Immediate Monster Collision at t < 9): parametric sweep across all ticks t in [1..8]', () => {
      // Test collision at every possible mid-air tick: t = 1, 2, 3, 4, 5, 6, 7, 8
      for (let collisionTick = 1; collisionTick <= 8; collisionTick++) {
        let shard: Projectile = {
          skillId: '59',
          x: 200,
          y: 200,
          vx: 0,
          vy: 0,
          altitude: 120,
          damage: 120,
          ttl: 9,
          fromPlayer: true,
          missileType: 'blizzard2',
        }

        // Ticks before collision: target is distant/inactive
        const distantTarget: ProjectileTarget = { index: 1, x: 9999, y: 9999, radius: 20, alive: true }
        for (let t = 1; t < collisionTick; t++) {
          const res = tickProjectiles([shard], [distantTarget], openTerrain)
          expect(res.hits.length).toBe(0)
          shard = res.alive.find(p => p.missileType === 'blizzard2')!
          expect(shard).toBeDefined()
          expect(shard.altitude).toBeGreaterThan(0)
        }

        // At collisionTick, place target directly under the falling shard
        const closeTarget: ProjectileTarget = { index: 1, x: 200, y: 200, radius: 20, alive: true }
        const hitRes = tickProjectiles([shard], [closeTarget], openTerrain)

        // 1. Hit must register IMMEDIATELY at collisionTick
        expect(hitRes.hits.length).toBe(1)
        const hit = hitRes.hits[0]!
        expect(hit.targetIndex).toBe(1)
        expect(hit.damage).toBe(120)
        expect(hit.statusEffect).toBe('chill')
        expect(hit.statusDuration).toBe(100)

        // 2. Shard must be destroyed IMMEDIATELY on collision (not survive to tick 9)
        expect(hitRes.alive.some(p => p.missileType === 'blizzard2')).toBe(false)

        // 3. Impact explosion must be spawned IMMEDIATELY at collisionTick
        expect(hitRes.spawnedProjectiles).toBeDefined()
        expect(hitRes.spawnedProjectiles!.length).toBe(1)
        const exp = hitRes.spawnedProjectiles![0]!
        expect(exp.missileType).toBe('blizzardexplode2')
        expect(exp.ttl).toBe(6)
        expect(exp.x).toBe(200)
        expect(exp.y).toBe(200)
      }
    })

    it('empirical finding: blizzardexplode spawned on monster hit carries damage: 0 to prevent double damage', () => {
      const shard: Projectile = {
        skillId: '59',
        x: 200,
        y: 200,
        vx: 0,
        vy: 0,
        altitude: 60,
        damage: 150,
        ttl: 4,
        fromPlayer: true,
        missileType: 'blizzard3',
      }

      const target: ProjectileTarget = { index: 1, x: 200, y: 200, radius: 20, alive: true }
      const res = tickProjectiles([shard], [target], openTerrain)

      expect(res.hits.length).toBe(1)
      expect(res.hits[0]!.damage).toBe(150) // shard dealt full damage

      // Spawned explosion must have damage = 0
      const exp = res.spawnedProjectiles![0]!
      expect(exp.missileType).toBe('blizzardexplode3')
      expect(exp.damage).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 3: NextDelay = 0 Invariant (No Cooldown Immunity / Sweet-Spot Burst)
  // =========================================================================
  describe('Dimension 3: NextDelay = 0 Invariant (No Cooldown Immunity / Sweet-Spot Burst)', () => {
    it('verifies simultaneous hits: 5 overlapping shards hitting the same target on the same tick all deal full damage', () => {
      const shards: Projectile[] = [1, 2, 3, 4, 5].map(i => ({
        skillId: '59',
        x: 200,
        y: 200,
        vx: 0,
        vy: 0,
        damage: 100,
        ttl: 5,
        fromPlayer: true,
        missileType: `blizzard${((i - 1) % 4) + 1}`,
      }))

      const target: ProjectileTarget = { index: 99, x: 200, y: 200, radius: 20, alive: true }
      const res = tickProjectiles(shards, [target], openTerrain)

      // All 5 shards must hit the target without being blocked by immunity frames
      expect(res.hits.length).toBe(5)
      let totalDamage = 0
      for (const hit of res.hits) {
        expect(hit.targetIndex).toBe(99)
        expect(hit.damage).toBe(100)
        expect(hit.statusEffect).toBe('chill')
        totalDamage += hit.damage
      }
      expect(totalDamage).toBe(500)
    })

    it('verifies consecutive tick hits: shards hitting on ticks t, t+1, t+2, t+3 all deal damage without NextDelay lockout', () => {
      const target: ProjectileTarget = { index: 42, x: 200, y: 200, radius: 20, alive: true }
      let totalDamage = 0
      const recordedHits: number[] = []

      // On 4 consecutive ticks, a new shard hits the target
      for (let t = 1; t <= 4; t++) {
        const shard: Projectile = {
          skillId: '59',
          x: 200,
          y: 200,
          vx: 0,
          vy: 0,
          damage: 150,
          ttl: 5,
          fromPlayer: true,
          missileType: 'blizzard1',
        }

        const res = tickProjectiles([shard], [target], openTerrain)
        expect(res.hits.length).toBe(1)
        expect(res.hits[0]!.damage).toBe(150)
        recordedHits.push(res.hits[0]!.damage)
        totalDamage += res.hits[0]!.damage
      }

      expect(recordedHits.length).toBe(4)
      expect(totalDamage).toBe(600) // 150 * 4
    })

    it('differential contrast oracle: compares NextDelay = 0 (Blizzard) against NextDelay = 4 (Nova / Chain Lightning)', async () => {
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
        id: 'boss-target',
        name: 'BossDummy',
        isUndead: false,
        isDemon: true,
        statList: dummyStatList,
        stateBus: new StateBus(dummyStatList, registry),
      }

      const targetPositions = new Map([['boss-target', { x: 100, y: 100 }]])

      // 1. Contrast Test: Nova with nextDelay = 4
      // Spawn 2 Nova missiles hitting on tick 1 and tick 2
      engine.spawnMissile({
        missileNameOrId: 'nova',
        sourceSkillId: 48,
        slvl: 20,
        owner,
        startX: 100,
        startY: 100,
        targetX: 100,
        targetY: 100,
        dmgPacket: { skillId: 48, attackKind: 'spell', elemType: 'ltng', elemMin256: 100 * 256, elemMax256: 100 * 256, autoHit: true },
      })
      engine.spawnMissile({
        missileNameOrId: 'nova',
        sourceSkillId: 48,
        slvl: 20,
        owner,
        startX: 100,
        startY: 100,
        targetX: 100,
        targetY: 100,
        dmgPacket: { skillId: 48, attackKind: 'spell', elemType: 'ltng', elemMin256: 100 * 256, elemMax256: 100 * 256, autoHit: true },
      })

      const novaRes = engine.tick(1, [dummy], targetPositions)
      // Under NextDelay = 4, first Nova hits, second Nova is locked out on the same tick!
      expect(novaRes.hits.length).toBe(1)
      expect(engine.isTargetInNextDelay('boss-target', 1)).toBe(true)

      // 2. Blizzard Test: NextDelay = 0
      // In contrast, Blizzard has NextDelay = 0 (empty in Missiles.txt)
      const b1 = registry.getMissileByName('blizzard1')!
      expect(b1.nextHit).toBe(false)
      expect(b1.nextDelay).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 4: Wall Collisions & Resource Cleanup
  // =========================================================================
  describe('Dimension 4: Wall Collisions & Resource Cleanup', () => {
    it('verifies descending shard hitting a wall detonates immediately and spawns impact explosion', () => {
      const shard: Projectile = {
        skillId: '59',
        x: 150,
        y: 150,
        vx: 0,
        vy: 0,
        altitude: 70,
        damage: 100,
        ttl: 6,
        fromPlayer: true,
        missileType: 'blizzard4',
      }

      const res = tickProjectiles([shard], [], wallTerrain)

      // Shard halted and destroyed by wall
      expect(res.wallHits).toBe(1)
      expect(res.alive.some(p => p.missileType === 'blizzard4')).toBe(false)

      // Wall hit event recorded
      expect(res.wallHitEvents).toBeDefined()
      expect(res.wallHitEvents!.length).toBe(1)
      expect(res.wallHitEvents![0]!.missileType).toBe('blizzard4')

      // Explosion spawned
      expect(res.spawnedProjectiles).toBeDefined()
      expect(res.spawnedProjectiles!.length).toBe(1)
      const exp = res.spawnedProjectiles![0]!
      expect(exp.missileType).toBe('blizzardexplode1')
      expect(exp.ttl).toBe(6)
    })

    it('verifies 1,000 shards fired into solid walls terminate cleanly without memory leak or hanging', () => {
      const shards: Projectile[] = []
      for (let i = 0; i < 1000; i++) {
        shards.push({
          skillId: '59',
          x: 100 + (i % 50),
          y: 100 + Math.floor(i / 50),
          vx: 0,
          vy: 0,
          altitude: 120,
          damage: 50,
          ttl: 9,
          fromPlayer: true,
          missileType: 'blizzard1',
        })
      }

      // Tick 1: all 1,000 shards strike the wall immediately
      const tick1 = tickProjectiles(shards, [], wallTerrain)
      expect(tick1.wallHits).toBe(1000)
      // None of the original shards should survive
      expect(tick1.alive.every(p => p.missileType === 'blizzardexplode1')).toBe(true)
      expect(tick1.alive.length).toBe(1000) // 1,000 spawned explosions

      // Now tick the 1,000 explosions over open terrain until they all expire (range = 6)
      let active = tick1.alive as Projectile[]
      for (let t = 1; t <= 6; t++) {
        const step = tickProjectiles(active, [], openTerrain)
        active = step.alive as Projectile[]
      }

      // After 6 ticks, the explosions reached ttl = 0
      // Next tick (tick 7): all 1,000 explosions expire
      const finalStep = tickProjectiles(active, [], openTerrain)
      expect(finalStep.expired).toBe(1000)
      expect(finalStep.alive.length).toBe(0) // Clean zero active missiles!
    })
  })

  // =========================================================================
  // Dimension 5: 100,000-Tick Long-Run Stress Simulation (Crashes, NaNs, Leaks)
  // =========================================================================
  describe('Dimension 5: 100,000-Tick Long-Run Stress Simulation (Crashes, NaNs, Leaks)', () => {
    it('runs 100,000 ticks of continuous Blizzard casting without crashes, NaNs, or memory leaks', () => {
      const simStartMs = Date.now()
      const heapBefore = process.memoryUsage().heapUsed

      let activeProjectiles: Projectile[] = []
      let totalCasts = 0
      let totalHits = 0
      let totalWallHits = 0
      let totalExpired = 0
      let peakActiveCount = 0

      // Dynamic targets moving in combat arena
      const targets: ProjectileTarget[] = [
        { index: 0, x: 200, y: 200, radius: 25, alive: true },
        { index: 1, x: 215, y: 210, radius: 20, alive: true },
        { index: 2, x: 190, y: 220, radius: 20, alive: true },
        { index: 3, x: 205, y: 185, radius: 20, alive: true },
        { index: 4, x: 300, y: 300, radius: 25, alive: true },
      ]

      // Semi-solid map terrain with boundary walls
      const hybridTerrain = {
        overlap: (x: number, y: number) => (x > 380 || x < 20 || y > 380 || y < 20 ? 1 : 0),
      }

      // 100,000 ticks = 4,000 seconds = 66.6 minutes of non-stop game simulation
      for (let tick = 0; tick < 100000; tick++) {
        // Cast Blizzard on cooldown (every 45 ticks = 1.80s cast delay)
        if (tick % 45 === 0) {
          totalCasts++
          // Settle Blizzard center with slight spatial variation across casts
          const cx = 200 + ((tick / 45) % 5) * 10
          const cy = 200 + ((tick / 45) % 7) * 8
          activeProjectiles.push({
            skillId: '59',
            x: cx,
            y: cy,
            vx: 0,
            vy: 0,
            damage: 150,
            ttl: 100,
            fromPlayer: true,
            missileType: 'blizzardcenter',
            subMissileIdx: 0,
          })
        }

        // Monsters oscillate positions slightly every 10 ticks
        if (tick % 10 === 0) {
          for (let m = 0; m < targets.length; m++) {
            const angle = (tick * 0.05) + m
            targets[m] = {
              ...targets[m]!,
              x: 200 + Math.cos(angle) * 30,
              y: 200 + Math.sin(angle) * 15 * ISO_GROUND_ASPECT_RATIO,
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

        // INVARIANT 1: Bounded missile count — no runaway memory leak!
        // At any tick, at most 3 blizzard centers (ttl 100 / 45 = 2.22) can exist concurrently,
        // each emitting shards with ttl 9. Peak active projectiles must never exceed 60.
        if (activeProjectiles.length > 60) {
          throw new Error(`Memory leak detected at tick ${tick}: active projectile count reached ${activeProjectiles.length}`)
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

      // Assertions on 100,000 tick completion
      expect(totalCasts).toBe(Math.floor(100000 / 45) + 1) // 2,223 Blizzard casts
      expect(totalHits).toBeGreaterThan(1000) // thousands of hits registered
      expect(peakActiveCount).toBeLessThanOrEqual(45) // comfortably bounded
      expect(activeProjectiles.length).toBeLessThanOrEqual(25) // final active count is bounded
      expect(heapDiffMb).toBeLessThan(15) // stable heap (< 15 MB variance)

      console.log(`[100,000-Tick Blizzard Stress Sim Completed]`)
      console.log(`  Duration: ${simElapsedMs} ms (${(100000 / (simElapsedMs / 1000)).toFixed(0)} ticks/sec)`)
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
