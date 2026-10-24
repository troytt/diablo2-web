/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #049: Lightning (SOR)
 * Gitea Tracking Issue: #203
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Missile Definition (Skills.txt row 49, Missiles.txt 'lightningbolt' / ID 98)
 * D2: Visual Assets & Metadata Integrity (lightningstrike.png/json, light_cast_1.png/json, Additive Blending)
 * D3: Beam Kinematics & Infinite Piercing (Speed 30 / 750 px/s, pierces all monsters along trajectory)
 * D4: Obstacle & Terrain Collision Clipping (8px continuous sub-stepping wall collision terminates beam)
 * D5: 1.13c 5-Band Piecewise Damage Scaling & +8% Synergies (EMin: 1, EMax: 40, +8/+12/+20/+28/+36, synergies 38/48/53)
 * D6: Lifecycle, Range 25 Frames, Mana Cost Formula (8 + (slvl - 1) * 0.5, 0 cooldown)
 * D7: WorldArena & Runtime Cast Integration (Cast action frame, mana cost, 0 cooldown, overlay attachment)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-049-lightning.ts'
import {
  parseMissilesTxt,
  getMissileTxtData,
  CANONICAL_113C_MISSILES,
  getSkillManaCost,
  getSkillCooldownTicks,
  getSkillCastOverlay,
  SORCERESS_SKILL_CAST_OVERLAYS,
  calculateLightningDamage,
  calculateLightningSynergyMultiplier,
  calculateSkillDamage,
  tickProjectiles,
  type Projectile,
} from '../../../src/server/skills/skills.ts'
import {
  MissileEngine,
  hasLineOfSight,
} from '../../../src/server/engine/missile-engine.ts'
import {
  LIGHTNINGSTRIKE_META,
  MISSILE_METAS,
} from '../../../src/client/render/missiles-meta.ts'
import {
  LIGHT_CAST_1_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #049] Lightning (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #203)', () => {
  const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition', () => {
    it('parses authentic Skills.txt row 49 (Lightning)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const manaShiftIdx = headers.indexOf('manashift')
      const castOverlayIdx = headers.indexOf('castoverlay')
      const srvMissileIdx = headers.indexOf('srvmissile')
      const eMinIdx = headers.indexOf('EMin')
      const eMaxIdx = headers.indexOf('EMax')
      const eMaxLev1Idx = headers.indexOf('EMaxLev1')
      const eMaxLev2Idx = headers.indexOf('EMaxLev2')
      const eMaxLev3Idx = headers.indexOf('EMaxLev3')
      const eMaxLev4Idx = headers.indexOf('EMaxLev4')
      const eMaxLev5Idx = headers.indexOf('EMaxLev5')
      const param8Idx = headers.indexOf('Param8') !== -1 ? headers.indexOf('Param8') : headers.indexOf('param8')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '49')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Lightning')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(16)
      expect(Number(row![lvlManaIdx])).toBe(1)
      expect(Number(row![manaShiftIdx])).toBe(7)
      expect(row![castOverlayIdx]?.trim()).toBe('light_cast_1')
      expect(row![srvMissileIdx]?.trim()).toBe('lightningbolt')
      expect(Number(row![eMinIdx])).toBe(1)
      expect(Number(row![eMaxIdx])).toBe(40)
      expect(Number(row![eMaxLev1Idx])).toBe(8)
      expect(Number(row![eMaxLev2Idx])).toBe(12)
      expect(Number(row![eMaxLev3Idx])).toBe(20)
      expect(Number(row![eMaxLev4Idx])).toBe(28)
      expect(Number(row![eMaxLev5Idx])).toBe(36)
      expect(Number(row![param8Idx])).toBe(8)
    })

    it('parses authentic Missiles.txt row for lightningbolt (ID 98)', () => {
      const map = parseMissilesTxt(missilesTxtContent)
      const bolt = map.get('lightningbolt')
      expect(bolt).toBeDefined()
      expect(bolt!.id).toBe(98)
      expect(bolt!.vel).toBe(30)
      expect(bolt!.range).toBe(25)
      expect(bolt!.speedPxPerSec).toBe(750) // 30 * 25
      expect(bolt!.distancePx).toBe(750) // 30 * 25
      expect(bolt!.trans).toBe(1)
    })

    it('CANONICAL_113C_MISSILES contains the exact lightningbolt row and no invented lightning alias', () => {
      const bolt = getMissileTxtData('lightningbolt')
      expect(bolt.id).toBe(98)
      expect(bolt.vel).toBe(30)
      expect(bolt.range).toBe(25)
      expect(bolt.speedPxPerSec).toBe(750)
      expect(bolt.distancePx).toBe(750)
      expect(bolt.trans).toBe(1)

      // Missiles.txt lightningbolt (#98) CelFile = null: the bolt head is invisible (Issue #1091).
      expect(bolt.celFile).toBe('null')
      expect(() => getMissileTxtData('lightning')).toThrow()
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies baked DCC atlas sprite sheet files exist with non-zero size', () => {
      const missilePng = path.resolve(__dirname, '../../../public/missiles/lightningstrike.png')
      const missileJson = path.resolve(__dirname, '../../../public/missiles/lightningstrike.json')
      const overlayPng = path.resolve(__dirname, '../../../public/overlays/light_cast_1.png')
      const overlayJson = path.resolve(__dirname, '../../../public/overlays/light_cast_1.json')

      expect(fs.existsSync(missilePng)).toBe(true)
      expect(fs.statSync(missilePng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(missileJson)).toBe(true)
      expect(fs.existsSync(overlayPng)).toBe(true)
      expect(fs.statSync(overlayPng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(overlayJson)).toBe(true)
    })

    it('verifies LIGHTNINGSTRIKE_META metadata and registry registration', () => {
      expect(LIGHTNINGSTRIKE_META.name).toBe('lightningstrike')
      expect(LIGHTNINGSTRIKE_META.directions).toBe(32)
      expect(MISSILE_METAS['lightningstrike']).toBe(LIGHTNINGSTRIKE_META)
    })

    it('verifies cast overlay mapping and metadata', () => {
      expect(SORCERESS_SKILL_CAST_OVERLAYS[49]).toBe('light_cast_1')
      expect(getSkillCastOverlay(49)).toBe('light_cast_1')
      expect(LIGHT_CAST_1_META.name).toBe('light_cast_1')
      expect(OVERLAY_METAS['light_cast_1']).toBe(LIGHT_CAST_1_META)
    })
  })

  // =========================================================================
  // Dimension 3: Beam Kinematics & Infinite Piercing
  // =========================================================================
  describe('Dimension 3: Beam Kinematics & Infinite Piercing', () => {
    it('missile advances at speed 30 px/tick (750 px/s) over 25 ticks', () => {
      const missile = getMissileTxtData('lightningbolt')
      const perTick = missile.speedPxPerSec / 25
      expect(perTick).toBe(30)
      expect(missile.range).toBe(25)
      expect(missile.distancePx).toBe(750)
    })

    it('infinite piercing: strikes 6 lined-up enemies without dying or being stopped by the 4-pierce cap', () => {
      // 6 enemies lined up horizontally along the beam's trajectory (y = 0)
      const enemies = [
        { index: 1, x: 50, y: 0, radius: 15, alive: true },
        { index: 2, x: 100, y: 0, radius: 15, alive: true },
        { index: 3, x: 150, y: 0, radius: 15, alive: true },
        { index: 4, x: 200, y: 0, radius: 15, alive: true },
        { index: 5, x: 250, y: 0, radius: 15, alive: true },
        { index: 6, x: 300, y: 0, radius: 15, alive: true },
      ]

      let projectiles: readonly Projectile[] = [
        {
          skillId: '49',
          x: 0,
          y: 0,
          vx: 30,
          vy: 0,
          damage: 100,
          ttl: 25,
          fromPlayer: true,
          missileType: 'lightningbolt',
          pierce: true,
        },
      ]

      const openTerrain = { overlap: () => 0 }
      const allHits: number[] = []

      // Step 12 ticks: missile covers 12 * 30 = 360 px, passing through all 6 enemies
      for (let t = 1; t <= 12; t++) {
        const outcome = tickProjectiles(projectiles, enemies, openTerrain)
        projectiles = outcome.alive
        for (const h of outcome.hits) {
          allHits.push(h.targetIndex)
        }
      }

      // All 6 enemies must be struck exactly once!
      expect(allHits).toEqual([1, 2, 3, 4, 5, 6])
      // The missile must still be alive in flight!
      expect(projectiles.length).toBe(1)
      expect(projectiles[0]!.x).toBe(360)
    })

    it('MissileEngine simulates infinite piercing across 6 targets', async () => {
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
        missileNameOrId: 'lightningbolt',
        sourceSkillId: 49,
        slvl: 20,
        owner,
        startX: 0,
        startY: 0,
        targetX: 600,
        targetY: 0,
        dmgPacket: { minDamage: 100, maxDamage: 100, damageType: 'lightning' } as any,
        vx: 30,
        vy: 0,
        maxRangeTicks: 25,
      })
      expect(m).not.toBeNull()

      const targets = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((id) => {
        const statList = new UnitStatList()
        statList.setHp256(1000 * 256)
        return {
          id,
          statList,
          stateBus: new StateBus(statList),
        } as any
      })

      const targetPositions = new Map<string, { x: number; y: number }>([
        ['m1', { x: 50, y: 0 }],
        ['m2', { x: 100, y: 0 }],
        ['m3', { x: 150, y: 0 }],
        ['m4', { x: 200, y: 0 }],
        ['m5', { x: 250, y: 0 }],
        ['m6', { x: 300, y: 0 }],
      ])

      const allHitIds: string[] = []
      for (let tick = 1; tick <= 12; tick++) {
        const step = engine.tick(tick, targets, targetPositions)
        for (const h of step.hits) {
          allHitIds.push(h.targetId)
        }
      }

      expect(allHitIds).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6'])
      const active = engine.getActiveMissiles()
      expect(active.length).toBe(1)
      expect(active[0]!.pierceCount).toBe(6)
    })
  })

  // =========================================================================
  // Dimension 4: Obstacle & Terrain Collision Clipping
  // =========================================================================
  describe('Dimension 4: Obstacle & Terrain Collision Clipping', () => {
    it('expires missile when colliding with a solid wall (x >= 80)', () => {
      let projectiles: readonly Projectile[] = [
        {
          skillId: '49',
          x: 0,
          y: 0,
          vx: 30,
          vy: 0,
          damage: 100,
          ttl: 25,
          fromPlayer: true,
          missileType: 'lightningbolt',
          pierce: true,
        },
      ]

      const wallTerrain = { overlap: (x: number) => (x >= 80 ? 1 : 0) }

      // Tick 1: moves to x=30 (open)
      const step1 = tickProjectiles(projectiles, [], wallTerrain)
      expect(step1.alive.length).toBe(1)
      expect(step1.wallHits).toBe(0)

      // Tick 2: moves to x=60 (open)
      const step2 = tickProjectiles(step1.alive, [], wallTerrain)
      expect(step2.alive.length).toBe(1)
      expect(step2.wallHits).toBe(0)

      // Tick 3: moves to x=90 (wall at x>=80 hit!)
      const step3 = tickProjectiles(step2.alive, [], wallTerrain)
      expect(step3.alive.length).toBe(0)
      expect(step3.wallHits).toBe(1)
      expect(step3.wallHitEvents![0]!.x).toBe(90)
    })

    it('sub-stepping collision detects thin obstacle between steps', () => {
      // Sub-stepping checks 8px intervals. Thin wall from x=35 to x=45.
      // Notice endpoints x=30 and x=60 are both outside the wall; only sub-step x=37.5 strikes it!
      const thinWallTerrain = {
        isMissileBlocked: (x: number) => x >= 35 && x <= 45,
      }
      let projectiles: readonly Projectile[] = [
        {
          skillId: '49',
          x: 0,
          y: 0,
          vx: 30,
          vy: 0,
          damage: 100,
          ttl: 25,
          fromPlayer: true,
          missileType: 'lightningbolt',
          pierce: true,
        },
      ]
      // Step 1: x from 0 to 30 (clear)
      const step1 = tickProjectiles(projectiles, [], {
        overlap: () => 0,
        isMissileBlocked: thinWallTerrain.isMissileBlocked,
      })
      expect(step1.alive.length).toBe(1)

      // Step 2: x from 30 to 60 (crosses 38..42 -> blocked!)
      const step2 = tickProjectiles(step1.alive, [], {
        overlap: () => 0,
        isMissileBlocked: thinWallTerrain.isMissileBlocked,
      })
      expect(step2.alive.length).toBe(0)
      expect(step2.wallHits).toBe(1)
    })

    it('hasLineOfSight returns true in open space and false across walls', () => {
      const terrain = { overlap: (x: number) => (x >= 50 && x <= 60 ? 1 : 0) }
      expect(hasLineOfSight(0, 0, 40, 0, terrain)).toBe(true)
      expect(hasLineOfSight(0, 0, 100, 0, terrain)).toBe(false)
    })
  })

  // =========================================================================
  // Dimension 5: Piecewise 5-Band Damage Scaling & Synergy Verification
  // =========================================================================
  describe('Dimension 5: Piecewise 5-Band Damage Scaling & Synergy Verification', () => {
    it('calculates exact 1.13c 5-band damage without synergies at slvl 1, 2, 8, 9, 10, 16, 20, 28, 30', () => {
      // Level 1: 1-40
      const d1 = calculateLightningDamage(1)
      expect(d1.min).toBe(1)
      expect(d1.max).toBe(40)

      // Level 2: 1 to 40 + 8 = 48
      const d2 = calculateLightningDamage(2)
      expect(d2.min).toBe(1)
      expect(d2.max).toBe(48)

      // Level 8: 1 to 40 + 7 * 8 = 96
      const d8 = calculateLightningDamage(8)
      expect(d8.min).toBe(1)
      expect(d8.max).toBe(96)

      // Level 9: 1 to 96 + 12 = 108
      const d9 = calculateLightningDamage(9)
      expect(d9.min).toBe(1)
      expect(d9.max).toBe(108)

      // Level 10: 1 to 96 + 2 * 12 = 120
      const d10 = calculateLightningDamage(10)
      expect(d10.min).toBe(1)
      expect(d10.max).toBe(120)

      // Level 16: 1 to 96 + 8 * 12 = 192
      const d16 = calculateLightningDamage(16)
      expect(d16.min).toBe(1)
      expect(d16.max).toBe(192)

      // Level 20: 1 to 192 + 4 * 20 = 272
      const d20 = calculateLightningDamage(20)
      expect(d20.min).toBe(1)
      expect(d20.max).toBe(272)

      // Level 28: 1 to 192 + 6 * 20 + 6 * 28 = 480
      const d28 = calculateLightningDamage(28)
      expect(d28.min).toBe(1)
      expect(d28.max).toBe(480)

      // Level 30: 1 to 480 + 2 * 36 = 552
      const d30 = calculateLightningDamage(30)
      expect(d30.min).toBe(1)
      expect(d30.max).toBe(552)
    })

    it('calculates exact +8% synergies per hard point in Charged Bolt, Nova, Chain Lightning', () => {
      // 10 pts Charged Bolt (+80%), 5 pts Nova (+40%), 5 pts Chain Lightning (+40%) = +160% (mult = 2.6)
      const mult = calculateLightningSynergyMultiplier({ chargedBolt: 10, nova: 5, chainLightning: 5 })
      expect(mult).toBeCloseTo(2.6, 4)

      // slvl 20 base = 1-272. With +160% synergy: min = floor(1 * 2.6) = 2, max = floor(272 * 2.6) = 707
      const d20Syn = calculateLightningDamage(20, { chargedBolt: 10, nova: 5, chainLightning: 5 })
      expect(d20Syn.min).toBe(2)
      expect(d20Syn.max).toBe(707)

      // calculateSkillDamage routes 49 and 'lightning' identically
      const viaCalc1 = calculateSkillDamage(49, 20, { chargedBolt: 10, nova: 5, chainLightning: 5 } as any)
      expect(viaCalc1.min).toBe(2)
      expect(viaCalc1.max).toBe(707)

      const viaCalc2 = calculateSkillDamage('lightning', 20, { chargedBolt: 10, nova: 5, chainLightning: 5 } as any)
      expect(viaCalc2.min).toBe(2)
      expect(viaCalc2.max).toBe(707)
    })

    it('evaluates exact 1.13c Skills.txt formulas in skillModule.evaluate', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(49)!

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(49, 1)
      const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
      expect(r1.manaCost).toBe(8)
      expect(r1.manaCost256).toBe(2048)
      expect(r1.minElemDmg256).toBe(256) // 1 * 256
      expect(r1.maxElemDmg256).toBe(10240) // 40 * 256

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(49, 10)
      const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
      expect(r10.manaCost).toBe(12)
      expect(r10.minElemDmg256).toBe(256) // 1 * 256
      expect(r10.maxElemDmg256).toBe(30720) // 120 * 256

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(49, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(17)
      expect(r20.minElemDmg256).toBe(256)
      expect(r20.maxElemDmg256).toBe(69632) // 272 * 256
      expect(r20.cooldownFrames).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 6: Lifecycle, Range 25 Frames, Mana Cost Formula
  // =========================================================================
  describe('Dimension 6: Lifecycle, Range 25 Frames, Mana Cost Formula', () => {
    it('projectile lives exactly 25 ticks in open space and expires on tick 25', () => {
      let projectiles: readonly Projectile[] = [
        {
          skillId: '49',
          x: 0,
          y: 0,
          vx: 30,
          vy: 0,
          damage: 100,
          ttl: 25,
          fromPlayer: true,
          missileType: 'lightningbolt',
          pierce: true,
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

    it('verifies getSkillManaCost formula: 8 + (slvl - 1) * 0.5', () => {
      expect(getSkillManaCost(49, 1)).toBe(8)
      expect(getSkillManaCost(49, 2)).toBe(8.5)
      expect(getSkillManaCost(49, 3)).toBe(9)
      expect(getSkillManaCost(49, 10)).toBe(12.5)
      expect(getSkillManaCost(49, 20)).toBe(17.5)
    })

    it('verifies getSkillCooldownTicks returns 0 frames', () => {
      expect(getSkillCooldownTicks(49)).toBe(0)
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
        skillId: 49,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(49)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })

    it('verifies skillModule definition and metadata for Lightning (49)', () => {
      expect(skillModule.skillId).toBe(49)
      expect(skillModule.name).toBe('Lightning')
      expect(skillModule.charClass).toBe('sor')
      expect(skillModule.srvStFunc).toBe(0)
      expect(skillModule.srvDoFunc).toBe(0)
      expect(getSkillCastOverlay(49)).toBe('light_cast_1')
      expect(SORCERESS_SKILL_CAST_OVERLAYS[49]).toBe('light_cast_1')
      expect(getSkillCooldownTicks(49)).toBe(0)
      expect(getSkillManaCost(49, 1)).toBe(8)
    })
  })
})
