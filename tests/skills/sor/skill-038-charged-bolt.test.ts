/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #038: Charged Bolt (SOR)
 * Gitea Tracking Issue: #192
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Missile Definition (Skills.txt row 40 / Id 38, Missiles.txt 'chargedbolt' / ID 56)
 * D2: Visual Assets & Metadata Integrity (chargedbolt.png/json, light_cast_1.png/json, CHARGEDBOLT_META, LIGHT_CAST_1_META)
 * D3: Kinematics, Bolt Count Scaling & Discrete Orthogonal Jitter (min(24, slvl + 2), 32-entry lookup table)
 * D4: NextDelay 0 Multi-Hit & Terrain Collision Clipping (Multiple bolts strike same target, wall collision terminates bolt)
 * D5: 1.13c 5-Band Piecewise Damage Scaling & +6% Synergy from Lightning (EMin 4, EMax 8, +1/+1/+2/+3/+4 per band, Lightning blvl)
 * D6: Lifecycle, Range 98 Frames, Mana Cost Formula (3 + (slvl - 1) * 0.5, 0 cooldown ticks)
 * D7: WorldArena & Runtime Cast Integration (Cast action frame, mana consumption, 0 cooldown, overlay attachment)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-038-charged-bolt.ts'
import {
  parseMissilesTxt,
  getMissileTxtData,
  CANONICAL_113C_MISSILES,
  BATCH1_SKILLS,
  getBatch1SkillDef,
  getSkillManaCost,
  getSkillCooldownTicks,
  getSkillCastOverlay,
  SORCERESS_SKILL_CAST_OVERLAYS,
  GAT_CHARGED_BOLT_OFFSETS,
  calculateChargedBoltCount,
  calculateChargedBoltSynergyMultiplier,
  calculateChargedBoltDamage,
  calculateSkillDamage,
  tickProjectiles,
  ISO_GROUND_ASPECT_RATIO,
  type Projectile,
} from '../../../src/server/skills/skills.ts'
import {
  MissileEngine,
} from '../../../src/server/engine/missile-engine.ts'
import {
  CHARGEDBOLT_META,
  MISSILE_METAS,
} from '../../../src/client/render/missiles-meta.ts'
import {
  LIGHT_CAST_1_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #038] Charged Bolt (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #192)', () => {
  const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition', () => {
    it('parses authentic Skills.txt row 38 (Charged Bolt)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const manaShiftIdx = headers.indexOf('manashift')
      const castOverlayIdx = headers.indexOf('castoverlay')
      const srvMissileIdx = headers.indexOf('srvmissilea') !== -1 ? headers.indexOf('srvmissilea') : headers.indexOf('srvmissile')
      const eMinIdx = headers.indexOf('EMin')
      const eMaxIdx = headers.indexOf('EMax')
      const eLev1Idx = headers.indexOf('EMinLev1') !== -1 ? headers.indexOf('EMinLev1') : headers.indexOf('ELev1')
      const eLev2Idx = headers.indexOf('EMinLev2') !== -1 ? headers.indexOf('EMinLev2') : headers.indexOf('ELev2')
      const eLev3Idx = headers.indexOf('EMinLev3') !== -1 ? headers.indexOf('EMinLev3') : headers.indexOf('ELev3')
      const eLev4Idx = headers.indexOf('EMinLev4') !== -1 ? headers.indexOf('EMinLev4') : headers.indexOf('ELev4')
      const eLev5Idx = headers.indexOf('EMinLev5') !== -1 ? headers.indexOf('EMinLev5') : headers.indexOf('ELev5')
      const param8Idx = headers.indexOf('Param8') !== -1 ? headers.indexOf('Param8') : headers.indexOf('param8')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '38')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Charged Bolt')
      expect(Number(row![manaIdx])).toBe(24)
      expect(Number(row![lvlManaIdx])).toBe(4)
      expect(Number(row![manaShiftIdx])).toBe(5)
      expect(row![castOverlayIdx]?.trim()).toBe('light_cast_1')
      expect(row![srvMissileIdx]?.trim()).toBe('chargedbolt')
      expect(Number(row![eMinIdx])).toBe(4)
      expect(Number(row![eMaxIdx])).toBe(8)
      expect(Number(row![eLev1Idx])).toBe(1)
      expect(Number(row![eLev2Idx])).toBe(1)
      expect(Number(row![eLev3Idx])).toBe(2)
      expect(Number(row![eLev4Idx])).toBe(3)
      expect(Number(row![eLev5Idx])).toBe(4)
      expect(Number(row![param8Idx])).toBe(6) // +6% per point in Lightning

      // Verify authentic 1.13c mana formula: (24 + 4 * (lvl - 1)) * 2^(5 - 8)
      expect((24 + 4 * (1 - 1)) * (2 ** (5 - 8))).toBe(3)
      expect((24 + 4 * (10 - 1)) * (2 ** (5 - 8))).toBe(7.5)
      expect((24 + 4 * (20 - 1)) * (2 ** (5 - 8))).toBe(12.5)
    })

    it('parses authentic Missiles.txt row for chargedbolt (ID 56)', async () => {
      const map = parseMissilesTxt(missilesTxtContent)
      const bolt = map.get('chargedbolt')
      expect(bolt).toBeDefined()
      expect(bolt!.id).toBe(56)
      expect(bolt!.vel).toBe(12)
      expect(bolt!.range).toBe(98)
      expect(bolt!.speedPxPerSec).toBe(300) // 12 * 25
      expect(bolt!.distancePx).toBe(1176) // 98 * 12
      expect(bolt!.nextDelay ?? 0).toBe(0)

      const registry = await getSharedDataRegistry()
      const missileRec = registry.getMissileById(56)!
      expect(missileRec).toBeDefined()
      expect(missileRec.pCltDoFunc).toBe(1)
      expect(missileRec.pSrvDoFunc).toBe(1)
    })

    it('CANONICAL_113C_MISSILES contains exact chargedbolt definition', () => {
      const bolt = getMissileTxtData('chargedbolt')
      expect(bolt.id).toBe(56)
      expect(bolt.vel).toBe(12)
      expect(bolt.range).toBe(98)
      expect(bolt.speedPxPerSec).toBe(300)
      expect(bolt.distancePx).toBe(1176)
      expect(CANONICAL_113C_MISSILES['chargedbolt']).toBeDefined()
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies baked DCC atlas sprite sheet files exist with non-zero size', () => {
      const missilePng = path.resolve(__dirname, '../../../public/missiles/chargedbolt.png')
      const missileJson = path.resolve(__dirname, '../../../public/missiles/chargedbolt.json')
      const overlayPng = path.resolve(__dirname, '../../../public/overlays/light_cast_1.png')
      const overlayJson = path.resolve(__dirname, '../../../public/overlays/light_cast_1.json')

      expect(fs.existsSync(missilePng)).toBe(true)
      expect(fs.statSync(missilePng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(missileJson)).toBe(true)
      expect(fs.existsSync(overlayPng)).toBe(true)
      expect(fs.statSync(overlayPng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(overlayJson)).toBe(true)
    })

    it('verifies CHARGEDBOLT_META metadata and registry registration', () => {
      expect(CHARGEDBOLT_META.name).toBe('chargedbolt')
      expect(CHARGEDBOLT_META.directions).toBe(16)
      expect(CHARGEDBOLT_META.framesPerDirection).toBe(10)
      expect(MISSILE_METAS['chargedbolt']).toBe(CHARGEDBOLT_META)
    })

    it('verifies cast overlay mapping and metadata', () => {
      expect(SORCERESS_SKILL_CAST_OVERLAYS[38]).toBe('light_cast_1')
      expect(getSkillCastOverlay(38)).toBe('light_cast_1')
      expect(LIGHT_CAST_1_META.name).toBe('light_cast_1')
      expect(OVERLAY_METAS['light_cast_1']).toBe(LIGHT_CAST_1_META)
    })
  })

  // =========================================================================
  // Dimension 3: Kinematics, Bolt Count Scaling & Discrete Orthogonal Jitter
  // =========================================================================
  describe('Dimension 3: Kinematics, Bolt Count Scaling & Discrete Orthogonal Jitter', () => {
    it('scales bolt count correctly: min(24, slvl + 2)', () => {
      expect(calculateChargedBoltCount(1)).toBe(3)
      expect(calculateChargedBoltCount(2)).toBe(4)
      expect(calculateChargedBoltCount(5)).toBe(7)
      expect(calculateChargedBoltCount(10)).toBe(12)
      expect(calculateChargedBoltCount(20)).toBe(22)
      expect(calculateChargedBoltCount(22)).toBe(24)
      expect(calculateChargedBoltCount(30)).toBe(24) // capped at 24
      expect(calculateChargedBoltCount(50)).toBe(24)
    })

    it('advances at velocity 12 px/tick (300 px/s)', () => {
      const missile = getMissileTxtData('chargedbolt')
      expect(missile.speedPxPerSec / 25).toBe(12)
      expect(missile.range).toBe(98)
    })

    it('GAT_CHARGED_BOLT_OFFSETS contains authentic 32-entry discrete lookup table', () => {
      expect(GAT_CHARGED_BOLT_OFFSETS.length).toBe(32)
      for (const val of GAT_CHARGED_BOLT_OFFSETS) {
        expect([-1, 0, 1]).toContain(val)
      }
      expect(GAT_CHARGED_BOLT_OFFSETS[0]).toBe(-1)
      expect(GAT_CHARGED_BOLT_OFFSETS[1]).toBe(0)
      expect(GAT_CHARGED_BOLT_OFFSETS[2]).toBe(1)
      expect(GAT_CHARGED_BOLT_OFFSETS[31]).toBe(1)
    })

    it('tickProjectiles applies discrete orthogonal jitter displacing sideways while propagating', () => {
      const projectiles: readonly Projectile[] = [
        {
          skillId: '38',
          x: 0,
          y: 0,
          vx: 12,
          vy: 0,
          damage: 10,
          ttl: 98,
          fromPlayer: true,
          missileType: 'chargedbolt',
          jitter: true,
          seed: 0,
          jitterIndex: 0,
        },
      ]

      const openTerrain = { overlap: () => 0 }
      const tick1 = tickProjectiles(projectiles, [], openTerrain)
      expect(tick1.alive.length).toBe(1)
      const p1 = tick1.alive[0]!
      // Forward advancement with heading angle deflection and normalized speed (12 px/tick)
      expect(p1.x).toBeCloseTo(11.64, 1)
      expect(Math.hypot(p1.vx, p1.vy / ISO_GROUND_ASPECT_RATIO)).toBeCloseTo(12, 1)
      // Orthogonal displacement: perp vector deflects trajectory
      expect(p1.y).not.toBe(0)
      expect(p1.jitterIndex).toBe(1)
    })

    it('MissileEngine simulates Charged Bolt propagation with orthogonal jitter', async () => {
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
        missileNameOrId: 'chargedbolt',
        sourceSkillId: 38,
        slvl: 10,
        owner,
        startX: 0,
        startY: 0,
        targetX: 300,
        targetY: 0,
        dmgPacket: { minDamage: 10, maxDamage: 15, damageType: 'lightning' } as any,
        vx: 12,
        vy: 0,
        maxRangeTicks: 98,
        seed: 3,
        jitterIndex: 3,
      })
      expect(m).not.toBeNull()

      engine.tick()
      expect(m!.x).toBeGreaterThan(0)
      expect(m!.jitterIndex).toBe(4)
    })
  })

  // =========================================================================
  // Dimension 4: NextDelay 0 Multi-Hit & Terrain Collision Clipping
  // =========================================================================
  describe('Dimension 4: NextDelay 0 Multi-Hit & Terrain Collision Clipping', () => {
    it('NextDelay 0 permits multiple bolts in the same volley to strike the same enemy', () => {
      const enemy = { index: 1, x: 24, y: 0, radius: 16, alive: true }

      // 3 individual bolts converging on enemy
      const projectiles: readonly Projectile[] = [
        {
          skillId: '38',
          x: 0,
          y: 0,
          vx: 12,
          vy: 0,
          damage: 20,
          ttl: 98,
          fromPlayer: true,
          missileType: 'chargedbolt',
        },
        {
          skillId: '38',
          x: 0,
          y: 4,
          vx: 12,
          vy: 0,
          damage: 20,
          ttl: 98,
          fromPlayer: true,
          missileType: 'chargedbolt',
        },
        {
          skillId: '38',
          x: 0,
          y: -4,
          vx: 12,
          vy: 0,
          damage: 20,
          ttl: 98,
          fromPlayer: true,
          missileType: 'chargedbolt',
        },
      ]

      const openTerrain = { overlap: () => 0 }
      const tick1 = tickProjectiles(projectiles, [enemy], openTerrain)
      // Step to reach enemy
      const tick2 = tickProjectiles(tick1.alive, [enemy], openTerrain)

      // All 3 bolts must register hits because NextDelay is 0!
      const totalHits = tick1.hits.length + tick2.hits.length
      expect(totalHits).toBe(3)
    })

    it('terminates and dies on solid wall collision', () => {
      const projectiles: readonly Projectile[] = [
        {
          skillId: '38',
          x: 0,
          y: 0,
          vx: 12,
          vy: 0,
          damage: 20,
          ttl: 98,
          fromPlayer: true,
          missileType: 'chargedbolt',
        },
      ]

      // Wall at x >= 10
      const wallTerrain = {
        overlap: (x: number) => (x >= 10 ? 1 : 0),
      }

      const outcome = tickProjectiles(projectiles, [], wallTerrain)
      expect(outcome.wallHits).toBe(1)
      expect(outcome.alive.length).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 5: 1.13c 5-Band Piecewise Damage Scaling & +6% Synergy from Lightning
  // =========================================================================
  describe('Dimension 5: 1.13c 5-Band Piecewise Damage Scaling & +6% Synergy', () => {
    it('evaluates exact 5-band base damage without synergies', () => {
      // Base: 2-4
      expect(calculateChargedBoltDamage(1)).toEqual({ min: 2, max: 4 })
      // Level 8 (band 1 end: +1/+1 per level): 2 + 7 = 9, 4 + 7 = 11
      expect(calculateChargedBoltDamage(8)).toEqual({ min: 9, max: 11 })
      // Level 16 (band 2 end: +1/+1 per level): 9 + 8 = 17, 11 + 8 = 19
      expect(calculateChargedBoltDamage(16)).toEqual({ min: 17, max: 19 })
      // Level 20 (band 3: +2/+2 per level): 17 + 4*2 = 25, 19 + 4*2 = 27
      expect(calculateChargedBoltDamage(20)).toEqual({ min: 25, max: 27 })
      // Level 22 (band 3 end): 17 + 6*2 = 29, 19 + 6*2 = 31
      expect(calculateChargedBoltDamage(22)).toEqual({ min: 29, max: 31 })
      // Level 28 (band 4 end: +3/+3 per level): 29 + 6*3 = 47, 31 + 6*3 = 49
      expect(calculateChargedBoltDamage(28)).toEqual({ min: 47, max: 49 })
      // Level 30 (band 5: +4/+4 per level): 47 + 2*4 = 55, 49 + 2*4 = 57
      expect(calculateChargedBoltDamage(30)).toEqual({ min: 55, max: 57 })
    })

    it('evaluates +6% synergy per point in Lightning (49)', () => {
      expect(calculateChargedBoltSynergyMultiplier(0)).toBe(1.0)
      expect(calculateChargedBoltSynergyMultiplier({ lightning: 1 })).toBeCloseTo(1.06, 5)
      expect(calculateChargedBoltSynergyMultiplier({ lightning: 10 })).toBeCloseTo(1.60, 5)
      expect(calculateChargedBoltSynergyMultiplier({ lightning: 20 })).toBeCloseTo(2.20, 5)

      // Level 20 base (25-27) with 20 points in Lightning:
      // min = floor(25 * 2.2) = 55, max = floor(27 * 2.2) = 59
      const dmg = calculateChargedBoltDamage(20, { lightning: 20 })
      expect(dmg).toEqual({ min: 55, max: 59 })
    })

    it('integrates with calculateSkillDamage helper', () => {
      expect(calculateSkillDamage(38, 1)).toEqual({ min: 2, max: 4 })
      expect(calculateSkillDamage('chargedbolt', 20, { lightning: 20 } as any)).toEqual({ min: 55, max: 59 })
    })

    it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(38)!
      const synId = 49

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(38, 20)
      statsBase.setBaseSkillLevel(synId, 20)
      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(120)

      // +20 allskills and +33 charges without hard points must yield 0 synergy
      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(38, 20)
      statsSoftOnly.addStat('item_allskills', 20)
      statsSoftOnly.setChargedSkillLevel(synId, 33)
      const withSoftOnly = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsSoftOnly,
      })
      expect(withSoftOnly.synergyBonusPct).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 6: Lifecycle, Range 98 Frames, Mana Cost Formula
  // =========================================================================
  describe('Dimension 6: Lifecycle, Range 98 Frames, Mana Cost Formula', () => {
    it('projectile lives exactly 98 ticks in open space and expires on tick 98', () => {
      let projectiles: readonly Projectile[] = [
        {
          skillId: '38',
          x: 0,
          y: 0,
          vx: 12,
          vy: 0,
          damage: 10,
          ttl: 98,
          fromPlayer: true,
          missileType: 'chargedbolt',
        },
      ]

      const openTerrain = { overlap: () => 0 }
      for (let t = 1; t <= 98; t++) {
        const outcome = tickProjectiles(projectiles, [], openTerrain)
        expect(outcome.alive.length).toBe(1)
        expect(outcome.expired).toBe(0)
        projectiles = outcome.alive
      }

      // Tick 99: expires after completing 98 ticks of flight
      const outcome99 = tickProjectiles(projectiles, [], openTerrain)
      expect(outcome99.alive.length).toBe(0)
      expect(outcome99.expired).toBe(1)
    })

    it('verifies getSkillManaCost formula: 3 + (slvl - 1) * 0.5', () => {
      expect(getSkillManaCost(38, 1)).toBe(3)
      expect(getSkillManaCost(38, 2)).toBe(3.5)
      expect(getSkillManaCost(38, 3)).toBe(4)
      expect(getSkillManaCost(38, 10)).toBe(7.5)
      expect(getSkillManaCost(38, 20)).toBe(12.5)
    })

    it('verifies getSkillCooldownTicks returns 0 frames', () => {
      expect(getSkillCooldownTicks(38)).toBe(0)
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
        skillId: 38,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(38)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })

    it('verifies skillModule definition and metadata for Charged Bolt (38)', () => {
      expect(skillModule.skillId).toBe(38)
      expect(skillModule.name).toBe('Charged Bolt')
      expect(skillModule.charClass).toBe('sor')
      expect(skillModule.srvStFunc).toBe(0)
      expect(skillModule.srvDoFunc).toBe(17)
      expect(getSkillCastOverlay(38)).toBe('light_cast_1')
      expect(SORCERESS_SKILL_CAST_OVERLAYS[38]).toBe('light_cast_1')
      expect(getSkillCooldownTicks(38)).toBe(0)
      expect(getSkillManaCost(38, 1)).toBe(3)

      const boltMissile = CANONICAL_113C_MISSILES['chargedbolt']
      expect(boltMissile).toBeDefined()
      expect(boltMissile.vel).toBe(12) // 300 px/s (12 px/frame at 25 fps)
      expect(boltMissile.range).toBe(98)
    })
  })
})
