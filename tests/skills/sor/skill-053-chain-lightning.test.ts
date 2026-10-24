/**
 * Diablo II: Lord of Destruction v1.13c — Comprehensive 7-Dimensional Verification Suite
 * Skill #053: Chain Lightning (SOR)
 *
 * Gitea Tracking Issue: #207
 *
 * 7 Verification Dimensions:
 * - Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition
 * - Dimension 2: Visual Assets & Metadata Integrity
 * - Dimension 3: Seeking Kinematics & Jump Formula
 * - Dimension 4: Ping-Pong Retargeting, Target Exclusion & NextDelay = 4
 * - Dimension 5: Piecewise 5-Band Damage Scaling & Synergy Verification
 * - Dimension 6: Lifecycle, Range 25 Frames, Mana Cost Formula
 * - Dimension 7: WorldArena & Runtime Cast Integration
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-053-chain-lightning.ts'
import {
  parseMissilesTxt,
  getMissileTxtData,
  CANONICAL_113C_MISSILES,
  getSkillManaCost,
  getSkillCooldownTicks,
  getSkillCastOverlay,
  SORCERESS_SKILL_CAST_OVERLAYS,
  calculateChainLightningDamage,
  calculateChainLightningSynergyMultiplier,
  calculateChainLightningJumps,
  calculateSkillDamage,
  tickProjectiles,
  type Projectile,
  type ProjectileTarget,
} from '../../../src/server/skills/skills.ts'
import {
  MissileEngine,
  hasLineOfSight,
} from '../../../src/server/engine/missile-engine.ts'
import {
  CHAINLIGHTNING_META,
  MISSILE_METAS,
} from '../../../src/client/render/missiles-meta.ts'
import {
  LIGHT_CAST_1_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #053] Chain Lightning (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #207)', () => {
  const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition', () => {
    it('parses authentic Skills.txt row 53 (Chain Lightning)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const manaShiftIdx = headers.indexOf('manashift')
      const castOverlayIdx = headers.indexOf('castoverlay')
      const srvMissileAIdx = headers.indexOf('srvmissilea')
      const eMinIdx = headers.indexOf('EMin')
      const eMaxIdx = headers.indexOf('EMax')
      const eMaxLev1Idx = headers.indexOf('EMaxLev1')
      const eMaxLev2Idx = headers.indexOf('EMaxLev2')
      const eMaxLev3Idx = headers.indexOf('EMaxLev3')
      const eMaxLev4Idx = headers.indexOf('EMaxLev4')
      const eMaxLev5Idx = headers.indexOf('EMaxLev5')
      const param8Idx = headers.indexOf('Param8') !== -1 ? headers.indexOf('Param8') : headers.indexOf('param8')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '53')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Chain Lightning')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(9)
      expect(Number(row![lvlManaIdx])).toBe(1)
      expect(Number(row![manaShiftIdx])).toBe(8)
      expect(row![castOverlayIdx]?.trim()).toBe('light_cast_1')
      expect(row![srvMissileAIdx]?.trim()).toBe('chainlightning')
      expect(Number(row![eMinIdx])).toBe(1)
      expect(Number(row![eMaxIdx])).toBe(40)
      expect(Number(row![eMaxLev1Idx])).toBe(11)
      expect(Number(row![eMaxLev2Idx])).toBe(13)
      expect(Number(row![eMaxLev3Idx])).toBe(15)
      expect(Number(row![eMaxLev4Idx])).toBe(15)
      expect(Number(row![eMaxLev5Idx])).toBe(15)
      expect(Number(row![param8Idx])).toBe(4)
    })

    it('parses authentic Missiles.txt row for chainlightning (ID 93)', () => {
      const map = parseMissilesTxt(missilesTxtContent)
      const cl = map.get('chainlightning')
      expect(cl).toBeDefined()
      expect(cl!.id).toBe(93)
      expect(cl!.vel).toBe(30)
      expect(cl!.range).toBe(25)
      expect(cl!.speedPxPerSec).toBe(750)
      expect(cl!.distancePx).toBe(750)
      expect(cl!.trans).toBe(1)
    })

    it('CANONICAL_113C_MISSILES contains exact chainlightning definitions', () => {
      const cl = getMissileTxtData('chainlightning')
      expect(cl.id).toBe(93)
      expect(cl.vel).toBe(30)
      expect(cl.range).toBe(25)
      expect(cl.speedPxPerSec).toBe(750)
      expect(cl.distancePx).toBe(750)
      expect(cl.trans).toBe(1)

      const def = CANONICAL_113C_MISSILES['chainlightning']
      expect(def).toBeDefined()
      expect(def!.id).toBe(93)
      expect(def!.vel).toBe(30)
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies baked DCC atlas sprite sheet files exist with non-zero size', () => {
      const missilePng = path.resolve(
        process.cwd(),
        'public/missiles/chainlightning.png',
      )
      const missileJson = path.resolve(
        process.cwd(),
        'public/missiles/chainlightning.json',
      )
      const overlayPng = path.resolve(
        process.cwd(),
        'public/overlays/light_cast_1.png',
      )
      const overlayJson = path.resolve(
        process.cwd(),
        'public/overlays/light_cast_1.json',
      )

      expect(fs.existsSync(missilePng)).toBe(true)
      expect(fs.statSync(missilePng).size).toBeGreaterThan(1000)

      expect(fs.existsSync(missileJson)).toBe(true)
      expect(fs.statSync(missileJson).size).toBeGreaterThan(100)

      expect(fs.existsSync(overlayPng)).toBe(true)
      expect(fs.statSync(overlayPng).size).toBeGreaterThan(1000)

      expect(fs.existsSync(overlayJson)).toBe(true)
      expect(fs.statSync(overlayJson).size).toBeGreaterThan(100)
    })

    it('verifies CHAINLIGHTNING_META metadata and registry registration', () => {
      expect(CHAINLIGHTNING_META).toBeDefined()
      expect(CHAINLIGHTNING_META.name).toBe('chainlightning')
      expect(CHAINLIGHTNING_META.directions).toBe(32)
      expect(MISSILE_METAS['chainlightning']).toBeDefined()
      expect(MISSILE_METAS['chainlightning']!.name).toBe('chainlightning')
    })

    it('verifies cast overlay mapping and metadata', () => {
      const overlay = getSkillCastOverlay(53)
      expect(overlay).toBe('light_cast_1')
      expect(SORCERESS_SKILL_CAST_OVERLAYS[53]).toBe('light_cast_1')

      expect(LIGHT_CAST_1_META).toBeDefined()
      expect(LIGHT_CAST_1_META.name).toBe('light_cast_1')
      expect(OVERLAY_METAS['light_cast_1']).toBeDefined()
    })
  })

  // =========================================================================
  // Dimension 3: Seeking Kinematics & Jump Formula
  // =========================================================================
  describe('Dimension 3: Seeking Kinematics & Jump Formula', () => {
    it('evaluates exact 1.13c jump formula: 5 + Math.floor(slvl / 5)', () => {
      expect(calculateChainLightningJumps(1)).toBe(5)
      expect(calculateChainLightningJumps(2)).toBe(5)
      expect(calculateChainLightningJumps(4)).toBe(5)
      expect(calculateChainLightningJumps(5)).toBe(6)
      expect(calculateChainLightningJumps(6)).toBe(6)
      expect(calculateChainLightningJumps(9)).toBe(6)
      expect(calculateChainLightningJumps(10)).toBe(7)
      expect(calculateChainLightningJumps(14)).toBe(7)
      expect(calculateChainLightningJumps(15)).toBe(8)
      expect(calculateChainLightningJumps(19)).toBe(8)
      expect(calculateChainLightningJumps(20)).toBe(9)
      expect(calculateChainLightningJumps(25)).toBe(10)
      expect(calculateChainLightningJumps(30)).toBe(11)
      expect(calculateChainLightningJumps(40)).toBe(13)
    })

    it('missile advances at 30 px/tick (750 px/s) toward target', () => {
      const missileData = getMissileTxtData('chainlightning')
      expect(missileData.speedPxPerSec).toBe(750)
      expect(missileData.distancePx).toBe(750)

      const target: ProjectileTarget = {
        index: 1,
        x: 300,
        y: 0,
        radius: 16,
        alive: true,
      }

      // Initial projectile fired horizontally at target 300px away
      const initial: Projectile = {
        skillId: '53',
        x: 0,
        y: 0,
        vx: 30,
        vy: 0,
        damage: 100,
        ttl: 25,
        fromPlayer: true,
        missileType: 'chainlightning',
        chainRemaining: 5,
        nextHit: 1,
        nextDelay: 4,
      }

      let current: readonly Projectile[] = [initial]
      const openTerrain = { overlap: () => 0 }

      // Advance 9 ticks (x = 270)
      for (let t = 1; t <= 9; t++) {
        const step = tickProjectiles(current, [target], openTerrain)
        expect(step.alive.length).toBe(1)
        expect(step.hits.length).toBe(0)
        current = step.alive
      }
      expect(current[0]!.x).toBe(270)
    })

    it('enforces 20 subtiles (400 px) search radius for jumps', () => {
      // Target 1 at (0, 0), Target 2 at (450, 0) — out of 400px jump range
      const t1: ProjectileTarget = { index: 1, x: 100, y: 0, radius: 16, alive: true }
      const t2: ProjectileTarget = { index: 2, x: 550, y: 0, radius: 16, alive: true } // dist = 450 > 400

      const projectile: Projectile = {
        skillId: '53',
        x: 90,
        y: 0,
        vx: 30,
        vy: 0,
        damage: 100,
        ttl: 25,
        fromPlayer: true,
        missileType: 'chainlightning',
        chainRemaining: 5,
        nextHit: 1,
        nextDelay: 4,
      }

      const outcome = tickProjectiles([projectile], [t1, t2], { overlap: () => 0 })
      expect(outcome.hits.length).toBe(1)
      expect(outcome.hits[0]!.targetIndex).toBe(1)
      // Since t2 is 450px away (> 400px search radius), chain cannot jump!
      expect(outcome.spawnedProjectiles?.length ?? 0).toBe(0)
      expect(outcome.alive.length).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 4: Ping-Pong Retargeting, Target Exclusion & NextDelay = 4
  // =========================================================================
  describe('Dimension 4: Ping-Pong Retargeting, Target Exclusion & NextDelay = 4', () => {
    it('ping-pongs between 2 monsters within 400 px for all available jumps', () => {
      // Target A at (100, 0), Target B at (200, 0). Distance between them is 100 px <= 400 px.
      const tA: ProjectileTarget = { index: 1, x: 100, y: 0, radius: 16, alive: true }
      const tB: ProjectileTarget = { index: 2, x: 200, y: 0, radius: 16, alive: true }
      const targets = [tA, tB]

      // Initial missile hits A with chainRemaining = 3
      let projectiles: readonly Projectile[] = [
        {
          skillId: '53',
          x: 75,
          y: 0,
          vx: 30,
          vy: 0,
          damage: 50,
          ttl: 25,
          fromPlayer: true,
          missileType: 'chainlightning',
          chainRemaining: 3,
          nextHit: 1,
          nextDelay: 4,
        },
      ]

      const hitSequence: number[] = []
      const openTerrain = { overlap: () => 0 }

      // Tick through the lifecycle to trace the jumps
      for (let tick = 1; tick <= 50; tick++) {
        const outcome = tickProjectiles(projectiles, targets, openTerrain)
        for (const hit of outcome.hits) {
          hitSequence.push(hit.targetIndex)
        }
        projectiles = outcome.alive
        if (projectiles.length === 0) break
      }

      // Chain lightning hit A, spawned jump toward B (chainRemaining = 2),
      // hit B, spawned jump back toward A (chainRemaining = 1),
      // hit A, spawned jump back toward B (chainRemaining = 0),
      // hit B, 0 jumps remaining -> terminates!
      // Total hits: 4 hits (initial + 3 jumps)
      expect(hitSequence).toEqual([1, 2, 1, 2])
    })

    it('terminates cleanly after 1 hit when only 1 monster is in range', () => {
      // Only 1 monster in range
      const tA: ProjectileTarget = { index: 1, x: 100, y: 0, radius: 16, alive: true }
      const projectiles: readonly Projectile[] = [
        {
          skillId: '53',
          x: 75,
          y: 0,
          vx: 30,
          vy: 0,
          damage: 50,
          ttl: 25,
          fromPlayer: true,
          missileType: 'chainlightning',
          chainRemaining: 5,
          nextHit: 1,
          nextDelay: 4,
        },
      ]

      const outcome = tickProjectiles(projectiles, [tA], { overlap: () => 0 })
      expect(outcome.hits.length).toBe(1)
      expect(outcome.hits[0]!.targetIndex).toBe(1)
      // Cannot jump back to the immediate victim, so 0 spawned jumps and 0 alive
      expect(outcome.spawnedProjectiles?.length ?? 0).toBe(0)
      expect(outcome.alive.length).toBe(0)
    })

    it('MissileEngine enforces NextDelay = 4 frames and ping-pong jumping across 2 targets', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const ownerStats = new UnitStatList()
      const owner = {
        id: 'player',
        x: 0,
        y: 0,
        statList: ownerStats,
        stateBus: new StateBus(ownerStats),
      } as any

      const m = engine.spawnMissile({
        missileNameOrId: 'chainlightning',
        sourceSkillId: 53,
        slvl: 20,
        owner,
        startX: 0,
        startY: 0,
        targetX: 60,
        targetY: 0,
        dmgPacket: { minDamage: 50, maxDamage: 50, damageType: 'lightning' } as any,
        vx: 30,
        vy: 0,
        maxRangeTicks: 25,
        chainRemaining: 2, // will hit A, jump to B, hit B, jump to A, hit A (3 total hits)
      })
      expect(m).not.toBeNull()

      const statA = new UnitStatList()
      statA.setHp256(1000 * 256)
      const statB = new UnitStatList()
      statB.setHp256(1000 * 256)

      const targets = [
        { id: 'target_a', statList: statA, stateBus: new StateBus(statA) },
        { id: 'target_b', statList: statB, stateBus: new StateBus(statB) },
      ] as any[]

      const targetPositions = new Map<string, { x: number; y: number }>([
        ['target_a', { x: 60, y: 0 }],
        ['target_b', { x: 180, y: 0 }],
      ])

      const hitRecords: { tick: number; targetId: string }[] = []
      for (let tick = 1; tick <= 30; tick++) {
        const step = engine.tick(tick, targets, targetPositions)
        for (const h of step.hits) {
          hitRecords.push({ tick, targetId: h.targetId })
        }
      }

      // Expected hit sequence: target_a -> target_b -> target_a
      expect(hitRecords.map((r) => r.targetId)).toEqual([
        'target_a',
        'target_b',
        'target_a',
      ])

      // Verify NextDelay between hits on the same target:
      // Hit on target_a at tick 2, next hit on target_a occurs after tick 2 + 4 = tick 6
      const aHits = hitRecords.filter((r) => r.targetId === 'target_a')
      expect(aHits.length).toBe(2)
      expect(aHits[1]!.tick - aHits[0]!.tick).toBeGreaterThanOrEqual(4)
    })
  })

  // =========================================================================
  // Dimension 5: Piecewise 5-Band Damage Scaling & Synergy Verification
  // =========================================================================
  describe('Dimension 5: Piecewise 5-Band Damage Scaling & Synergy Verification', () => {
    it('calculates exact 1.13c 5-band damage without synergies at slvl 1, 2, 8, 9, 10, 16, 17, 20, 22, 28, 30', () => {
      // Level 1: 1-40
      expect(calculateChainLightningDamage(1)).toEqual({ min: 1, max: 40 })

      // Band 1: Level 2-8 (+11/lvl)
      // slvl 2: 40 + 11 = 51
      expect(calculateChainLightningDamage(2)).toEqual({ min: 1, max: 51 })
      // slvl 8: 40 + 7 * 11 = 117
      expect(calculateChainLightningDamage(8)).toEqual({ min: 1, max: 117 })

      // Band 2: Level 9-16 (+13/lvl)
      // slvl 9: 117 + 13 = 130
      expect(calculateChainLightningDamage(9)).toEqual({ min: 1, max: 130 })
      // slvl 10: 117 + 2 * 13 = 143
      expect(calculateChainLightningDamage(10)).toEqual({ min: 1, max: 143 })
      // slvl 16: 117 + 8 * 13 = 221
      expect(calculateChainLightningDamage(16)).toEqual({ min: 1, max: 221 })

      // Band 3: Level 17-22 (+15/lvl)
      // slvl 17: 221 + 15 = 236
      expect(calculateChainLightningDamage(17)).toEqual({ min: 1, max: 236 })
      // slvl 20: 221 + 4 * 15 = 281
      expect(calculateChainLightningDamage(20)).toEqual({ min: 1, max: 281 })
      // slvl 22: 221 + 6 * 15 = 311
      expect(calculateChainLightningDamage(22)).toEqual({ min: 1, max: 311 })

      // Band 4: Level 23-28 (+15/lvl)
      // slvl 28: 311 + 6 * 15 = 401
      expect(calculateChainLightningDamage(28)).toEqual({ min: 1, max: 401 })

      // Band 5: Level 29+ (+15/lvl)
      // slvl 30: 401 + 2 * 15 = 431
      expect(calculateChainLightningDamage(30)).toEqual({ min: 1, max: 431 })
    })

    it('calculates exact +4% synergies per hard point in Charged Bolt, Nova, Lightning', () => {
      // 0 hard points = 1.0 multiplier
      expect(
        calculateChainLightningSynergyMultiplier({
          chargedBoltPoints: 0,
          novaPoints: 0,
          lightningPoints: 0,
        }),
      ).toBe(1)

      // 1 hard point in Charged Bolt: +4% -> 1.04
      expect(
        calculateChainLightningSynergyMultiplier({
          chargedBoltPoints: 1,
          novaPoints: 0,
          lightningPoints: 0,
        }),
      ).toBeCloseTo(1.04, 5)

      // 1 hard point in Nova: +4% -> 1.04
      expect(
        calculateChainLightningSynergyMultiplier({
          chargedBoltPoints: 0,
          novaPoints: 1,
          lightningPoints: 0,
        }),
      ).toBeCloseTo(1.04, 5)

      // 1 hard point in Lightning: +4% -> 1.04
      expect(
        calculateChainLightningSynergyMultiplier({
          chargedBoltPoints: 0,
          novaPoints: 0,
          lightningPoints: 1,
        }),
      ).toBeCloseTo(1.04, 5)

      // 20 hard points in each of the 3 synergy skills: 60 * 4% = +240% -> 3.4 multiplier
      expect(
        calculateChainLightningSynergyMultiplier({
          chargedBoltPoints: 20,
          novaPoints: 20,
          lightningPoints: 20,
        }),
      ).toBeCloseTo(3.4, 5)

      // Total damage with full synergies at slvl 20 (base 1-281):
      // min = round(1 * 3.4) = 3, max = round(281 * 3.4) = 955
      const mult = calculateChainLightningSynergyMultiplier({
        chargedBoltPoints: 20,
        novaPoints: 20,
        lightningPoints: 20,
      })
      const baseDmg = calculateChainLightningDamage(20)
      expect(Math.round(baseDmg.min * mult)).toBe(3)
      expect(Math.round(baseDmg.max * mult)).toBe(955)
    })

    it('evaluates exact 1.13c Skills.txt formulas in skillModule.evaluate', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(53)!

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(53, 1)
      const r1 = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 1,
        blvl: 1,
        statList: stats1,
      })
      expect(r1.manaCost).toBe(9)
      expect(r1.minElemDmg256).toBe(256) // 1 * 256
      expect(r1.maxElemDmg256).toBe(10240) // 40 * 256

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(53, 10)
      const r10 = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 10,
        blvl: 10,
        statList: stats10,
      })
      expect(r10.manaCost).toBe(18)
      expect(r10.minElemDmg256).toBe(256)
      expect(r10.maxElemDmg256).toBe(36608) // 143 * 256

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(53, 20)
      const r20 = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: stats20,
      })
      expect(r20.manaCost).toBe(28)
      expect(r20.minElemDmg256).toBe(256)
      expect(r20.maxElemDmg256).toBe(71936) // 281 * 256
      expect(r20.cooldownFrames).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 6: Lifecycle, Range 25 Frames, Mana Cost Formula
  // =========================================================================
  describe('Dimension 6: Lifecycle, Range 25 Frames, Mana Cost Formula', () => {
    it('projectile lives exactly 25 ticks in open space and expires on tick 26', () => {
      let projectiles: readonly Projectile[] = [
        {
          skillId: '53',
          x: 0,
          y: 0,
          vx: 30,
          vy: 0,
          damage: 100,
          ttl: 25,
          fromPlayer: true,
          missileType: 'chainlightning',
          chainRemaining: 5,
          nextHit: 1,
          nextDelay: 4,
        },
      ]

      const openTerrain = { overlap: () => 0 }

      for (let t = 1; t <= 25; t++) {
        const outcome = tickProjectiles(projectiles, [], openTerrain)
        expect(outcome.alive.length).toBe(1)
        expect(outcome.expired).toBe(0)
        projectiles = outcome.alive
      }

      // Tick 26: expires after completing full 25 ticks of flight
      const outcome26 = tickProjectiles(projectiles, [], openTerrain)
      expect(outcome26.alive.length).toBe(0)
      expect(outcome26.expired).toBe(1)
    })

    it('verifies getSkillManaCost formula: 9 + (slvl - 1) * 1', () => {
      expect(getSkillManaCost(53, 1)).toBe(9)
      expect(getSkillManaCost(53, 2)).toBe(10)
      expect(getSkillManaCost(53, 3)).toBe(11)
      expect(getSkillManaCost(53, 10)).toBe(18)
      expect(getSkillManaCost(53, 20)).toBe(28)
      expect(getSkillManaCost(53, 30)).toBe(38)
    })

    it('verifies getSkillCooldownTicks returns 0 frames', () => {
      expect(getSkillCooldownTicks(53)).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 7: WorldArena & Runtime Cast Integration
  // =========================================================================
  describe('Dimension 7: WorldArena & Runtime Cast Integration', () => {
    it('executes runtime skill effect in WorldArena (castCount, action frame, and combat outcome)', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: 'sor',
        skillId: 53,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(53)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })

    it('verifies skillModule definition and metadata for Chain Lightning (53)', () => {
      expect(skillModule.skillId).toBe(53)
      expect(skillModule.name).toBe('Chain Lightning')
      expect(skillModule.charClass).toBe('sor')
      expect(skillModule.srvStFunc).toBe(0)
      expect(skillModule.srvDoFunc).toBe(26)
      expect(getSkillCastOverlay(53)).toBe('light_cast_1')
      expect(SORCERESS_SKILL_CAST_OVERLAYS[53]).toBe('light_cast_1')
      expect(getSkillCooldownTicks(53)).toBe(0)
      expect(getSkillManaCost(53, 1)).toBe(9)
      expect(calculateChainLightningJumps(1)).toBe(5)
    })
  })
})
