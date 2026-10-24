/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #055: Glacial Spike (SOR)
 * Gitea Tracking Issue: #209
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Missile Definition (Skills.txt row 55, Missiles.txt 'glacialspike' & 'freezingarrowexp1')
 * D2: Visual Assets & Metadata Integrity (glacialspike.png/json, freezingarrowexp2.png/json, freezeexplode.png/json, ice_cast_2.png/json)
 * D3: Kinematics & Linear Trajectory (vel 16/24, range 40, distance 640/960 px, 2:1 isometric ground aspect ratio)
 * D4: 64px AoE Freeze Radius, Multi-Target Splash & Wall Detonation (AoE freeze to primary & splash targets, wall explosion)
 * D5: 1.13c 5-Band Damage Scaling & Synergy Verification (16-24 at lvl 1, 91-103.5 at lvl 10, 225-242.5 at lvl 20, 375-397.5 at lvl 30, +5%/syn, +3% Blizzard freeze)
 * D6: Mana Progression & 0 Cooldown Ticks ((20 + lvl - 1) * 0.5 -> 10 / 14.5 / 19.5, cooldown = 0)
 * D7: Invariants & WorldArena Integration (BATCH1_SKILLS strictly 38, WorldArena runtime cast)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-055-glacial-spike.ts'
import {
  parseMissilesTxt,
  getMissileTxtData,
  CANONICAL_113C_MISSILES,
  getSkillManaCost,
  getSkillCooldownTicks,
  getSkillCastOverlay,
  SORCERESS_SKILL_CAST_OVERLAYS,
  calculateGlacialSpikeDamage,
  calculateGlacialSpikeFreezeLength,
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
  GLACIALSPIKE_META,
  FREEZINGARROWEXP2_META,
  FREEZEEXPLODE_META,
  MISSILE_METAS,
} from '../../../src/client/render/missiles-meta.ts'
import {
  ICE_CAST_2_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #055] Glacial Spike (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #209)', () => {
  const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition', () => {
    it('parses authentic Skills.txt row 55 (Glacial Spike)', () => {
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
      const param3Idx = headers.indexOf('Param3') !== -1 ? headers.indexOf('Param3') : headers.indexOf('param3')
      const param4Idx = headers.indexOf('Param4') !== -1 ? headers.indexOf('Param4') : headers.indexOf('param4')
      const param7Idx = headers.indexOf('Param7') !== -1 ? headers.indexOf('Param7') : headers.indexOf('param7')
      const param8Idx = headers.indexOf('Param8') !== -1 ? headers.indexOf('Param8') : headers.indexOf('param8')

      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx]?.trim() === '55')
      expect(row).toBeDefined()
      expect(row![skillIdx]?.trim()).toBe('Glacial Spike')
      expect(row![charClassIdx]?.trim()).toBe('sor')
      expect(Number(row![manaIdx])).toBe(20)
      expect(Number(row![lvlManaIdx])).toBe(1)
      expect(Number(row![manaShiftIdx])).toBe(7) // factor = 0.5
      expect(row![castOverlayIdx]?.trim()).toBe('ice_cast_2')
      expect(row![srvMissileIdx]?.trim()).toBe('glacialspike')
      expect(Number(row![eMinIdx])).toBe(32)
      expect(Number(row![eMaxIdx])).toBe(48)
      expect(Number(row![hitShiftIdx])).toBe(7) // 32 / 2 = 16, 48 / 2 = 24 at lvl 1
      expect(Number(row![param1Idx])).toBe(4)  // 4 subtiles = 64 px radius
      expect(Number(row![param2Idx])).toBe(0)  // 0 radius per lvl
      expect(Number(row![param3Idx])).toBe(50) // 50 frames base freeze (2.0s)
      expect(Number(row![param4Idx])).toBe(3)  // +3 frames freeze per level (0.12s)
      expect(Number(row![param7Idx])).toBe(3)  // +3% freeze length per Blizzard point
      expect(Number(row![param8Idx])).toBe(5)  // +5% damage synergy per hard point
    })

    it('parses authentic Missiles.txt row for glacialspike (ID 96)', () => {
      const map = parseMissilesTxt(missilesTxtContent)
      const glacialspike = map.get('glacialspike')
      expect(glacialspike).toBeDefined()
      expect(glacialspike!.id).toBe(96)
      expect(glacialspike!.vel).toBe(16)
      expect(glacialspike!.range).toBe(40)
      expect(glacialspike!.celFile.toLowerCase()).toBe('glacialspike')
      expect(glacialspike!.trans).toBe(1)

      const lines = missilesTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const missileCol = headers.indexOf('Missile')
      const pSrvHitFuncCol = headers.indexOf('pSrvHitFunc')
      const row = lines.slice(1).map(l => l.split('\t')).find(r => r[missileCol]?.trim() === 'glacialspike')
      expect(Number(row![pSrvHitFuncCol])).toBe(13) // Explode & 64px AoE burst
    })

    it('CANONICAL_113C_MISSILES contains exact glacialspike definitions', () => {
      const gs = getMissileTxtData('glacialspike')
      expect(gs.id).toBe(96)
      expect(gs.vel).toBe(16)
      expect(gs.range).toBe(40)
      expect(gs.celFile.toLowerCase()).toBe('glacialspike')
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies baked DCC atlas sprite sheet files exist with non-zero size', () => {
      const spikePng = path.resolve(__dirname, '../../../public/missiles/glacialspike.png')
      const spikeJson = path.resolve(__dirname, '../../../public/missiles/glacialspike.json')
      const ejectaPng = path.resolve(__dirname, '../../../public/missiles/freezingarrowexp2.png')
      const ejectaJson = path.resolve(__dirname, '../../../public/missiles/freezingarrowexp2.json')
      const explodePng = path.resolve(__dirname, '../../../public/missiles/freezingarrowexp1.png')
      const explodeJson = path.resolve(__dirname, '../../../public/missiles/freezingarrowexp1.json')
      const overlayPng = path.resolve(__dirname, '../../../public/overlays/ice_cast_2.png')
      const overlayJson = path.resolve(__dirname, '../../../public/overlays/ice_cast_2.json')

      expect(fs.existsSync(spikePng)).toBe(true)
      expect(fs.statSync(spikePng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(spikeJson)).toBe(true)

      expect(fs.existsSync(ejectaPng)).toBe(true)
      expect(fs.statSync(ejectaPng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(ejectaJson)).toBe(true)

      expect(fs.existsSync(explodePng)).toBe(true)
      expect(fs.statSync(explodePng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(explodeJson)).toBe(true)

      expect(fs.existsSync(overlayPng)).toBe(true)
      expect(fs.statSync(overlayPng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(overlayJson)).toBe(true)
    })

    it('verifies GLACIALSPIKE_META and FREEZINGARROWEXP2_META metadata and registry registration', () => {
      expect(GLACIALSPIKE_META.name).toBe('glacialspike')
      expect(GLACIALSPIKE_META.celFile).toBe('GlacialSpike')
      expect(GLACIALSPIKE_META.directions).toBe(16)
      expect(GLACIALSPIKE_META.framesPerDirection).toBe(6)
      expect(MISSILE_METAS['glacialspike']).toBe(GLACIALSPIKE_META)

      expect(FREEZINGARROWEXP2_META.name).toBe('freezingarrowexp2')
      expect(MISSILE_METAS['freezingarrowexp2']).toBe(FREEZINGARROWEXP2_META)
    })

    it('verifies cast overlay mapping and metadata', () => {
      expect(SORCERESS_SKILL_CAST_OVERLAYS[55]).toBe('ice_cast_2')
      expect(getSkillCastOverlay(55)).toBe('ice_cast_2')
      expect(ICE_CAST_2_META.name).toBe('ice_cast_2')
      expect(OVERLAY_METAS['ice_cast_2']).toBe(ICE_CAST_2_META)
    })
  })

  // =========================================================================
  // Dimension 3: Kinematics & Linear Trajectory
  // =========================================================================
  describe('Dimension 3: Kinematics & Linear Trajectory', () => {
    it('propagates at speed 24 with maximum range of 40 ticks', () => {
      const p: Projectile = {
        skillId: '55',
        x: 0,
        y: 0,
        vx: 24,
        vy: 0,
        damage: 32,
        ttl: 40,
        missileType: 'glacialspike',
        fromPlayer: true,
        aoeRadius: 64,
        statusEffect: 'freeze',
        statusDuration: 50,
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

    it('applies 2:1 isometric ground aspect ratio for vertical motion', () => {
      const angle = Math.PI / 2 // 90 degrees straight south
      const vx = Math.cos(angle) * 24
      const vy = Math.sin(angle) * 24 * ISO_GROUND_ASPECT_RATIO

      const p: Projectile = {
        skillId: '55',
        x: 0,
        y: 0,
        vx,
        vy,
        damage: 32,
        ttl: 40,
        missileType: 'glacialspike',
        fromPlayer: true,
      }

      const outcome = tickProjectiles([p], [], { overlap: () => 0 })
      expect(outcome.alive[0]!.x).toBeCloseTo(0, 4)
      expect(outcome.alive[0]!.y).toBeCloseTo(12, 4) // 24 * 0.5 = 12
    })
  })

  // =========================================================================
  // Dimension 4: 64px AoE Freeze Radius, Multi-Target Splash & Wall Detonation
  // =========================================================================
  describe('Dimension 4: 64px AoE Freeze Radius, Multi-Target Splash & Wall Detonation', () => {
    it('impacts primary target and freezes all enemies within 64px AoE radius', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const ownerStats = new UnitStatList()
      const ownerCtx = {
        id: 'sorceress',
        statList: ownerStats,
        stateBus: new StateBus(ownerStats),
      } as any

      // Target 1: direct hit at (20, 0)
      const monStats1 = new UnitStatList()
      monStats1.addStat('hp', 500 * 256)
      const monCtx1 = {
        id: 'direct_zombie',
        statList: monStats1,
        stateBus: new StateBus(monStats1),
      } as any

      // Target 2: nearby monster at (35, 20) -> distance = hypot(15, 20) = 25 px <= 64 px
      const monStats2 = new UnitStatList()
      monStats2.addStat('hp', 500 * 256)
      const monCtx2 = {
        id: 'splash_zombie',
        statList: monStats2,
        stateBus: new StateBus(monStats2),
      } as any

      // Target 3: far monster at (200, 0) -> distance = 180 px > 64 px
      const monStats3 = new UnitStatList()
      monStats3.addStat('hp', 500 * 256)
      const monCtx3 = {
        id: 'far_zombie',
        statList: monStats3,
        stateBus: new StateBus(monStats3),
      } as any

      engine.spawnMissile({
        missileNameOrId: 'glacialspike',
        sourceSkillId: 55,
        slvl: 10,
        owner: ownerCtx,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
        dmgPacket: { minDamage: 90, maxDamage: 100, damageType: 'cold', elemDurationFrames: 77 } as any,
        vx: 24,
        vy: 0,
        maxRangeTicks: 40,
      })

      const targetPositions = new Map<string, { x: number; y: number }>([
        ['direct_zombie', { x: 20, y: 0 }],
        ['splash_zombie', { x: 35, y: 20 }],
        ['far_zombie', { x: 200, y: 0 }],
      ])

      const outcome = engine.tick(1, [monCtx1, monCtx2, monCtx3], targetPositions)

      // Direct hit + splash hit
      expect(outcome.hits.length).toBe(2)
      const directHit = outcome.hits.find(h => h.targetId === 'direct_zombie')
      const splashHit = outcome.hits.find(h => h.targetId === 'splash_zombie')
      expect(directHit).toBeDefined()
      expect(splashHit).toBeDefined()
      expect(splashHit!.missileName).toContain('splash')

      // BOTH direct and splash targets receive solid freeze
      expect(monCtx1.stateBus.hasState('freeze')).toBe(true)
      expect(monCtx2.stateBus.hasState('freeze')).toBe(true)

      // Far monster unaffected
      expect(monCtx3.stateBus.hasState('freeze')).toBe(false)
    })

    it('detonates upon hitting wall obstacle and damages/freezes nearby monsters with 64px burst', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const ownerStats = new UnitStatList()
      const ownerCtx = {
        id: 'sorceress',
        statList: ownerStats,
        stateBus: new StateBus(ownerStats),
      } as any

      // Monster standing next to the wall at (25, 10)
      const monStats = new UnitStatList()
      monStats.addStat('hp', 500 * 256)
      const monCtx = {
        id: 'near_wall_zombie',
        statList: monStats,
        stateBus: new StateBus(monStats),
      } as any

      engine.spawnMissile({
        missileNameOrId: 'glacialspike',
        sourceSkillId: 55,
        slvl: 10,
        owner: ownerCtx,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
        dmgPacket: { minDamage: 90, maxDamage: 100, damageType: 'cold', elemDurationFrames: 77 } as any,
        vx: 24,
        vy: 0,
        maxRangeTicks: 40,
      })

      // Wall at x >= 20
      const wallCollision = { isMissileBlocked: (x: number) => x >= 20 }
      const targetPositions = new Map<string, { x: number; y: number }>([
        ['near_wall_zombie', { x: 25, y: 10 }],
      ])

      const outcome = engine.tick(1, [monCtx], targetPositions, wallCollision)

      // Explodes against wall and hits near_wall_zombie via splash
      expect(outcome.hits.length).toBe(1)
      expect(outcome.hits[0]!.targetId).toBe('near_wall_zombie')
      expect(monCtx.stateBus.hasState('freeze')).toBe(true)
    })
  })

  // =========================================================================
  // Dimension 5: 1.13c 5-Band Damage Scaling & Synergy Verification
  // =========================================================================
  describe('Dimension 5: 1.13c 5-Band Damage Scaling & Synergy Verification', () => {
    it('calculates authentic 1.13c 5-band damage at slvl 1, 10, 20, and 30', () => {
      // slvl 1: 16 - 24 (EMin 32, EMax 48, HitShift 7 -> /2)
      const d1 = calculateGlacialSpikeDamage(1)
      expect(d1.min).toBe(16)
      expect(d1.max).toBe(24)

      // slvl 10: 91 - 103.5 (23296/256, 26496/256)
      const d10 = calculateGlacialSpikeDamage(10)
      expect(d10.min).toBe(91)
      expect(d10.max).toBe(103.5)

      // slvl 20: 225 - 242.5 (57600/256, 62080/256)
      const d20 = calculateGlacialSpikeDamage(20)
      expect(d20.min).toBe(225)
      expect(d20.max).toBe(242.5)

      // slvl 30: 375 - 397.5 (750/2, 795/2)
      const d30 = calculateGlacialSpikeDamage(30)
      expect(d30.min).toBe(375)
      expect(d30.max).toBe(397.5)
    })

    it('calculates authentic freeze length in frames (50 base + 3/lvl) and Blizzard synergy (+3%/lvl)', () => {
      // slvl 1: 50 frames (2.0s)
      expect(calculateGlacialSpikeFreezeLength(1)).toBe(50)

      // slvl 10: 50 + 9*3 = 77 frames (3.08s)
      expect(calculateGlacialSpikeFreezeLength(10)).toBe(77)

      // slvl 20: 50 + 19*3 = 107 frames (4.28s)
      expect(calculateGlacialSpikeFreezeLength(20)).toBe(107)

      // slvl 20 with 20 points in Blizzard (+60%): Math.floor(107 * 160 / 100) = 171 frames (6.84s)
      expect(calculateGlacialSpikeFreezeLength(20, { blizzard: 20 })).toBe(171)
    })

    it('enforces +5% damage synergy per hard point from synergies', () => {
      // slvl 20 with 20 points in Ice Bolt (+100% synergy)
      const synDmg = calculateGlacialSpikeDamage(20, { iceBolt: 20 })
      // 225 * 2.0 = 450, 242.5 * 2.0 = 485
      expect(synDmg.min).toBe(450)
      expect(synDmg.max).toBe(485)
    })

    it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(55)!
      const synId = 39 // Ice Bolt

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(55, 20)
      statsBase.setBaseSkillLevel(synId, 20)
      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(100)

      // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(55, 20)
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
    it('calculates authentic 1.13c mana costs ((20 + lvl - 1) * 0.5)', () => {
      expect(getSkillManaCost(55, 1)).toBe(10)
      expect(getSkillManaCost(55, 10)).toBe(14.5)
      expect(getSkillManaCost(55, 20)).toBe(19.5)
      expect(getSkillManaCost(55, 30)).toBe(24.5)
    })

    it('enforces 0 cooldown ticks (spammable cold projectile)', () => {
      expect(getSkillCooldownTicks(55)).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 7: Invariants & WorldArena Integration
  // =========================================================================
  describe('Dimension 7: Invariants & WorldArena Integration', () => {
    it('STRICT INVARIANT: BATCH1_SKILLS length must remain strictly 38', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })

    it('routes calculateSkillDamage correctly for skillId 55', () => {
      const dmg = calculateSkillDamage(55, 20)
      expect(dmg.min).toBe(225)
      expect(dmg.max).toBe(242.5)
    })

    it('executes runtime skill effect in WorldArena (castCount, action frame, and outcome)', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: 'sor',
        skillId: 55,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(55)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })
  })
})
