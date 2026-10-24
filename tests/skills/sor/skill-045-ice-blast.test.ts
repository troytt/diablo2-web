/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #045: Ice Blast (SOR)
 * Gitea Tracking Issue: #199
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Missile Definition (Skills.txt row 45, Missiles.txt 'iceblast' & 'freezingarrowexp1')
 * D2: Visual Assets & Metadata Integrity (iceblast.png/json, freezeexplode.png/json, ice_cast_1.png/json, Additive Blending)
 * D3: Kinematics & Linear Trajectory (vel 12/24, range 40/50, 2:1 isometric ground aspect ratio)
 * D4: Single-Target Collision, Freeze Application & Obstacle Blocking (Solid freeze, cannot-be-frozen handling, wall expiration)
 * D5: 1.13c 5-Band Damage Scaling & Synergy Verification (8-12 at lvl 1, 85-93.5 at lvl 10, 253-266.5 at lvl 20, 533-551.5 at lvl 30, +8%/syn, +10% freeze/syn)
 * D6: Mana Progression & 0 Cooldown Ticks ((12 + lvl - 1) * 0.5 -> 6 / 10.5 / 15.5, cooldown = 0)
 * D7: Invariants & WorldArena Integration (BATCH1_SKILLS strictly 38, WorldArena runtime cast)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-045-ice-blast.ts'
import {
  parseMissilesTxt,
  getMissileTxtData,
  CANONICAL_113C_MISSILES,
  getSkillManaCost,
  getSkillCooldownTicks,
  getSkillCastOverlay,
  SORCERESS_SKILL_CAST_OVERLAYS,
  calculateIceBlastDamage,
  calculateIceBlastFreezeLength,
  calculateSkillDamage,
  tickProjectiles,
  ISO_GROUND_ASPECT_RATIO,
  BATCH1_SKILLS,
  type Projectile,
} from '../../../src/server/skills/skills.ts'
import {
  MissileEngine,
} from '../../../src/server/engine/missile-engine.ts'
import {
  ICEBLAST_META,
  FREEZEEXPLODE_META,
  MISSILE_METAS,
} from '../../../src/client/render/missiles-meta.ts'
import {
  ICE_CAST_1_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #045] Ice Blast (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #199)', () => {
  const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition', () => {
    it('parses authentic Skills.txt row 45 (Ice Blast)', () => {
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
      const hitShiftIdx = headers.indexOf('HitShift')
      const param1Idx = headers.indexOf('Param1') !== -1 ? headers.indexOf('Param1') : headers.indexOf('param1')
      const param2Idx = headers.indexOf('Param2') !== -1 ? headers.indexOf('Param2') : headers.indexOf('param2')
      const param7Idx = headers.indexOf('Param7') !== -1 ? headers.indexOf('Param7') : headers.indexOf('param7')
      const param8Idx = headers.indexOf('Param8') !== -1 ? headers.indexOf('Param8') : headers.indexOf('param8')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '45')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Ice Blast')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(12)
      expect(Number(row![lvlManaIdx])).toBe(1)
      expect(Number(row![manaShiftIdx])).toBe(7) // factor = 0.5
      expect(row![castOverlayIdx]?.trim()).toBe('ice_cast_1')
      expect(row![srvMissileIdx]?.trim()).toBe('iceblast')
      expect(Number(row![eMinIdx])).toBe(16)
      expect(Number(row![eMaxIdx])).toBe(24)
      expect(Number(row![hitShiftIdx])).toBe(7) // 16 / 2 = 8, 24 / 2 = 12 at lvl 1
      expect(Number(row![param1Idx])).toBe(75) // 75 frames base freeze (3.0s)
      expect(Number(row![param2Idx])).toBe(5)  // +5 frames freeze per level (0.2s)
      expect(Number(row![param7Idx])).toBe(10) // 10% freeze synergy per hard point
      expect(Number(row![param8Idx])).toBe(8)  // 8% damage synergy per hard point
    })

    it('parses authentic Missiles.txt row for iceblast (ID 91)', () => {
      const map = parseMissilesTxt(missilesTxtContent)
      const iceblast = map.get('iceblast')
      expect(iceblast).toBeDefined()
      expect(iceblast!.id).toBe(91)
      expect(iceblast!.vel).toBe(12)
      expect(iceblast!.range).toBe(50)
      expect(iceblast!.celFile.toLowerCase()).toBe('iceblast')
      expect(iceblast!.trans).toBe(1)

      const lines = missilesTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const missileCol = headers.indexOf('Missile')
      const pSrvDmgFuncCol = headers.indexOf('pSrvDmgFunc')
      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[missileCol]?.trim() === 'iceblast')
      expect(Number(row![pSrvDmgFuncCol])).toBe(4)
    })

    it('CANONICAL_113C_MISSILES contains exact iceblast definitions', () => {
      const iceblast = getMissileTxtData('iceblast')
      expect(iceblast.id).toBe(91)
      expect(iceblast.vel).toBe(12)
      expect(iceblast.range).toBe(50)
      expect(iceblast.celFile.toLowerCase()).toBe('iceblast')
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies baked DCC atlas sprite sheet files exist with non-zero size', () => {
      const missilePng = path.resolve(__dirname, '../../../public/missiles/iceblast.png')
      const missileJson = path.resolve(__dirname, '../../../public/missiles/iceblast.json')
      const explodePng = path.resolve(__dirname, '../../../public/missiles/freezingarrowexp1.png')
      const explodeJson = path.resolve(__dirname, '../../../public/missiles/freezingarrowexp1.json')
      const overlayPng = path.resolve(__dirname, '../../../public/overlays/ice_cast_1.png')
      const overlayJson = path.resolve(__dirname, '../../../public/overlays/ice_cast_1.json')

      expect(fs.existsSync(missilePng)).toBe(true)
      expect(fs.statSync(missilePng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(missileJson)).toBe(true)

      expect(fs.existsSync(explodePng)).toBe(true)
      expect(fs.statSync(explodePng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(explodeJson)).toBe(true)

      expect(fs.existsSync(overlayPng)).toBe(true)
      expect(fs.statSync(overlayPng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(overlayJson)).toBe(true)
    })

    it('verifies ICEBLAST_META and FREEZEEXPLODE_META metadata and registry registration', () => {
      expect(ICEBLAST_META.name).toBe('iceblast')
      expect(ICEBLAST_META.celFile).toBe('IceBlast')
      expect(ICEBLAST_META.directions).toBe(16)
      expect(ICEBLAST_META.framesPerDirection).toBe(5)
      expect(MISSILE_METAS['iceblast']).toBe(ICEBLAST_META)

      expect(FREEZEEXPLODE_META.name).toBe('freezingarrowexp1')
      expect(FREEZEEXPLODE_META.directions).toBe(1)
      expect(FREEZEEXPLODE_META.framesPerDirection).toBe(15)
      expect(MISSILE_METAS['freezingarrowexp1']).toBe(FREEZEEXPLODE_META)
    })

    it('verifies cast overlay mapping and metadata', () => {
      expect(SORCERESS_SKILL_CAST_OVERLAYS[45]).toBe('ice_cast_1')
      expect(getSkillCastOverlay(45)).toBe('ice_cast_1')
      expect(ICE_CAST_1_META.name).toBe('ice_cast_1')
      expect(OVERLAY_METAS['ice_cast_1']).toBe(ICE_CAST_1_META)
    })
  })

  // =========================================================================
  // Dimension 3: Kinematics & Linear Trajectory
  // =========================================================================
  describe('Dimension 3: Kinematics & Linear Trajectory', () => {
    it('propagates at speed 24 with maximum range of 40 ticks (960 px)', () => {
      const p: Projectile = {
        skillId: '45',
        x: 0,
        y: 0,
        vx: 24,
        vy: 0,
        damage: 25,
        ttl: 40,
        missileType: 'iceblast',
        fromPlayer: true,
        statusEffect: 'freeze',
        statusDuration: 75,
      }

      const openTerrain = { overlap: () => 0 }
      let current = [p]
      for (let tick = 1; tick <= 5; tick++) {
        const step = tickProjectiles(current, [], openTerrain)
        current = [...step.alive]
      }

      expect(current.length).toBe(1)
      expect(current[0]!.x).toBe(120) // 5 * 24
      expect(current[0]!.y).toBe(0)
      expect(current[0]!.ttl).toBe(35)
    })

    it('applies 2:1 isometric ground aspect ratio for diagonal shots', () => {
      const angle = Math.PI / 4 // 45 degrees
      const vx = Math.cos(angle) * 24
      const vy = Math.sin(angle) * 24 * ISO_GROUND_ASPECT_RATIO

      const p: Projectile = {
        skillId: '45',
        x: 100,
        y: 100,
        vx,
        vy,
        damage: 50,
        ttl: 40,
        missileType: 'iceblast',
        fromPlayer: true,
      }

      const outcome = tickProjectiles([p], [], { overlap: () => 0 })
      expect(outcome.alive[0]!.x).toBeCloseTo(100 + vx, 4)
      expect(outcome.alive[0]!.y).toBeCloseTo(100 + vy, 4)
      // Vertical speed is halved in isometric coordinates
      expect(vy).toBeCloseTo(vx * 0.5, 4)
    })
  })

  // =========================================================================
  // Dimension 4: Single-Target Collision, Freeze Application & Obstacle Blocking
  // =========================================================================
  describe('Dimension 4: Single-Target Collision, Freeze Application & Obstacle Blocking', () => {
    it('hits single target, expires immediately without multi-target pierce, and applies solid freeze', () => {
      const p: Projectile = {
        skillId: '45',
        x: 0,
        y: 0,
        vx: 24,
        vy: 0,
        damage: 100,
        ttl: 40,
        missileType: 'iceblast',
        fromPlayer: true,
        statusEffect: 'freeze',
        statusDuration: 120,
      }

      const target1 = { index: 1, x: 20, y: 0, radius: 15, alive: true }
      const target2 = { index: 2, x: 25, y: 0, radius: 15, alive: true }

      const outcome = tickProjectiles([p], [target1, target2], { overlap: () => 0 })
      expect(outcome.hits.length).toBe(1)
      expect(outcome.hits[0]!.targetIndex).toBe(1)
      expect(outcome.hits[0]!.damage).toBe(100)
      expect(outcome.hits[0]!.statusEffect).toBe('freeze')
      expect(outcome.hits[0]!.statusDuration).toBe(120)
      // Missile expires upon impact
      expect(outcome.alive.length).toBe(0)
    })

    it('expires upon hitting wall obstacle and does not hit targets behind wall', () => {
      const p: Projectile = {
        skillId: '45',
        x: 0,
        y: 0,
        vx: 24,
        vy: 0,
        damage: 50,
        ttl: 40,
        missileType: 'iceblast',
        fromPlayer: true,
      }

      // Wall at x >= 20
      const wallTerrain = { overlap: (x: number) => (x >= 20 ? 1 : 0) }
      const targetBehindWall = { index: 1, x: 24, y: 0, radius: 15, alive: true }

      const outcome = tickProjectiles([p], [targetBehindWall], wallTerrain)
      expect(outcome.wallHits).toBe(1)
      expect(outcome.hits.length).toBe(0)
      expect(outcome.alive.length).toBe(0)
    })

    it('MissileEngine integration: tick triggers freeze on monster and cannot_be_frozen immunizes', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const ownerStats = new UnitStatList()
      const ownerCtx = {
        id: 'sorceress',
        statList: ownerStats,
        stateBus: new StateBus(ownerStats),
      } as any

      // 1. Normal monster: receives solid freeze
      const monStats1 = new UnitStatList()
      monStats1.addStat('hp', 500 * 256)
      const monCtx1 = {
        id: 'zombie_1',
        statList: monStats1,
        stateBus: new StateBus(monStats1),
      } as any

      engine.spawnMissile({
        missileNameOrId: 'iceblast',
        sourceSkillId: 45,
        slvl: 10,
        owner: ownerCtx,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
        dmgPacket: { minDamage: 50, maxDamage: 50, damageType: 'cold', elemDurationFrames: 120 } as any,
        vx: 24,
        vy: 0,
        maxRangeTicks: 40,
      })

      const targetPositions = new Map<string, { x: number; y: number }>([
        ['zombie_1', { x: 20, y: 0 }],
      ])

      const outcome = engine.tick(1, [monCtx1], targetPositions)
      expect(outcome.hits.length).toBe(1)
      expect(outcome.hits[0]!.targetId).toBe('zombie_1')
      expect(monCtx1.stateBus.hasState('freeze')).toBe(true)

      // 2. Monster with Cannot Be Frozen: takes damage but does NOT freeze
      const engine2 = new MissileEngine(registry)
      const monStats2 = new UnitStatList()
      monStats2.addStat('hp', 500 * 256)
      monStats2.addStat('item_cannotbefrozen', 1)
      const monCtx2 = {
        id: 'champion_zombie',
        statList: monStats2,
        stateBus: new StateBus(monStats2),
      } as any

      engine2.spawnMissile({
        missileNameOrId: 'iceblast',
        sourceSkillId: 45,
        slvl: 10,
        owner: ownerCtx,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
        dmgPacket: { minDamage: 50, maxDamage: 50, damageType: 'cold', elemDurationFrames: 120 } as any,
        vx: 24,
        vy: 0,
        maxRangeTicks: 40,
      })

      const targetPositions2 = new Map<string, { x: number; y: number }>([
        ['champion_zombie', { x: 20, y: 0 }],
      ])

      const outcome2 = engine2.tick(1, [monCtx2], targetPositions2)
      expect(outcome2.hits.length).toBe(1)
      expect(outcome2.hits[0]!.targetId).toBe('champion_zombie')
      expect(monCtx2.stateBus.hasState('freeze')).toBe(false)
    })
  })

  // =========================================================================
  // Dimension 5: 1.13c 5-Band Damage Scaling & Synergy Verification
  // =========================================================================
  describe('Dimension 5: 1.13c 5-Band Damage Scaling & Synergy Verification', () => {
    it('calculates authentic 1.13c 5-band damage at slvl 1, 10, 20, and 30', () => {
      // slvl 1: 8 - 12 (EMin 16, EMax 24, HitShift 7 -> /2)
      const d1 = calculateIceBlastDamage(1)
      expect(d1.min).toBe(8)
      expect(d1.max).toBe(12)

      // slvl 10: 85 - 93.5 (21760/256, 23936/256)
      const d10 = calculateIceBlastDamage(10)
      expect(d10.min).toBe(85)
      expect(d10.max).toBe(93.5)

      // slvl 20: 253 - 266.5 (64768/256, 68224/256)
      const d20 = calculateIceBlastDamage(20)
      expect(d20.min).toBe(253)
      expect(d20.max).toBe(266.5)

      // slvl 30: 533 - 551.5 (1066/2, 1103/2)
      const d30 = calculateIceBlastDamage(30)
      expect(d30.min).toBe(533)
      expect(d30.max).toBe(551.5)
    })

    it('calculates authentic freeze length in frames (75 base + 5/lvl) and synergies (+10%/lvl)', () => {
      // slvl 1: 75 frames (3.0s)
      expect(calculateIceBlastFreezeLength(1)).toBe(75)

      // slvl 10: 75 + 9*5 = 120 frames (4.8s)
      expect(calculateIceBlastFreezeLength(10)).toBe(120)

      // slvl 20: 75 + 19*5 = 170 frames (6.8s)
      expect(calculateIceBlastFreezeLength(20)).toBe(170)

      // slvl 20 with 20 points in Glacial Spike (+200%): 170 * (100 + 200) / 100 = 510 frames (20.4s)
      expect(calculateIceBlastFreezeLength(20, { glacialSpike: 20 })).toBe(510)
    })

    it('enforces +8% damage synergy per hard point from synergies', () => {
      // slvl 20 with 20 points in Ice Bolt (+160% synergy)
      const synDmg = calculateIceBlastDamage(20, { iceBolt: 20 })
      // 253 * 2.6 = 657.8, 266.5 * 2.6 = 692.9
      expect(synDmg.min).toBe(657.8)
      expect(synDmg.max).toBe(692.9)
    })

    it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(45)!
      const synId = 39 // Ice Bolt

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(45, 20)
      statsBase.setBaseSkillLevel(synId, 20)
      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(160)

      // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(45, 20)
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
  // Dimension 6: Mana Progression & 0 Cooldown Ticks
  // =========================================================================
  describe('Dimension 6: Mana Progression & 0 Cooldown Ticks', () => {
    it('calculates authentic 1.13c mana costs ((12 + lvl - 1) * 0.5)', () => {
      expect(getSkillManaCost(45, 1)).toBe(6)
      expect(getSkillManaCost(45, 10)).toBe(10.5)
      expect(getSkillManaCost(45, 20)).toBe(15.5)
      expect(getSkillManaCost(45, 30)).toBe(20.5)
    })

    it('enforces 0 cooldown ticks (spammable cold projectile)', () => {
      expect(getSkillCooldownTicks(45)).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 7: Invariants & WorldArena Integration
  // =========================================================================
  describe('Dimension 7: Invariants & WorldArena Integration', () => {
    it('STRICT INVARIANT: BATCH1_SKILLS length must remain strictly 38', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })

    it('routes calculateSkillDamage correctly for skillId 45', () => {
      const dmg = calculateSkillDamage(45, 20)
      expect(dmg.min).toBe(253)
      expect(dmg.max).toBe(266.5)
    })

    it('executes runtime skill effect in WorldArena (castCount, action frame, and outcome)', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: 'sor',
        skillId: 45,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(45)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })
  })
})
