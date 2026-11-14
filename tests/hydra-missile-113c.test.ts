/**
 * Diablo II: Lord of Destruction v1.13c — Skill #062: Hydra (SOR)
 * 7-Dimensional Verification Suite: Missile Physics, Turret Emitter,
 * 3-Head Geometry, Visual Assets, Synergy & 1.13c Ground Truth Parity.
 *
 * Gitea Tracking Issue: #399
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  parseMissilesTxt,
  getMissileTxtData,
  CANONICAL_113C_MISSILES,
  BATCH1_SKILLS,
  getBatch1SkillDef,
  getSkillManaCost,
  calculateSkillDamage,
  tickProjectiles,
  ISO_GROUND_ASPECT_RATIO,
  getSkillCastOverlay,
  SORCERESS_SKILL_CAST_OVERLAYS,
  type Projectile,
} from '../src/server/skills/skills.ts'
import {
  MissileEngine,
} from '../src/server/engine/missile-engine.ts'
import {
  getSharedDataRegistry,
  PET_SUB_SKILL_IDS,
} from '../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../src/server/engine/stat-list.ts'
import { skillModule } from '../src/server/skills/impl/sor/skill-062-hydra.ts'
import {
  HYDRA_META,
  HYDRAFIRE_META,
  FIREBOLT_META,
  MISSILE_METAS,
} from '../src/client/render/missiles-meta.ts'
import { getSkillRange, getSkillMana } from '../src/common/skills/weapon-combat-meta.ts'
import { castSkill } from '../src/server/skills/skills.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'

describe('[Skill #062] Hydra — 7-Dimensional 1.13c Verification Suite (Issue #399)', () => {
  const missilesTxtPath = path.resolve(__dirname, '../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Ground Truth Parity
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Ground Truth Parity', () => {
    it('parses authentic 1.13c Missiles.txt and verifies row 247 hydra', () => {
      const map = parseMissilesTxt(missilesTxtContent)
      const hydra = map.get('hydra')
      expect(hydra).toBeDefined()
      expect(hydra!.id).toBe(247)
      expect(hydra!.vel).toBe(16)
      expect(hydra!.range).toBe(30)
      expect(hydra!.speedPxPerSec).toBe(400) // 16 * 25
      expect(hydra!.distancePx).toBe(480) // 16 * 30
      expect(hydra!.celFile.toLowerCase()).toBe('firebolt')
      expect(hydra!.animLen).toBe(5)
      expect(hydra!.explosionMissile).toBe('fireexplode')
      expect(hydra!.light).toBe(5)
      expect(hydra!.red).toBe(255)
      expect(hydra!.green).toBe(255)
      expect(hydra!.blue).toBe(255)
    })

    it('verifies CANONICAL_113C_MISSILES export contains hydra and hydrafire', () => {
      const hydra = getMissileTxtData('hydra')
      expect(hydra.id).toBe(247)
      expect(hydra.vel).toBe(16)
      expect(hydra.range).toBe(30)
      expect(hydra.speedPxPerSec).toBe(400)
      expect(hydra.distancePx).toBe(480)
      expect(hydra.explosionMissile).toBe('fireexplode')

      const hydrafire = getMissileTxtData('hydra')
      expect(hydrafire.id).toBe(247)
      expect(hydrafire.vel).toBe(16)
      expect(hydrafire.range).toBe(30)
    })

    it('verifies Skills.txt row 62 and PET_SUB_SKILL_IDS 337 in D2DataRegistry', async () => {
      const registry = await getSharedDataRegistry()
      const rec = registry.getSkillById(62)
      expect(rec).toBeDefined()
      expect(rec!.name).toBe('Hydra')
      expect(rec!.charClass).toBe('sor')

      // PET_SUB_SKILL_IDS contains 337 (HydraMissile)
      expect((PET_SUB_SKILL_IDS as readonly number[]).includes(337)).toBe(true)
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Parity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Parity', () => {
    it('verifies HYDRA_META and HYDRAFIRE_META alias FIREBOLT_META', () => {
      expect(HYDRA_META.name).toBe('hydra')
      expect(HYDRA_META.celFile).toBe('Firebolt')
      expect(HYDRA_META.directions).toBe(16)
      expect(HYDRA_META.framesPerDirection).toBe(5)
      expect(HYDRA_META.animSpeed).toBe(16)

      expect(HYDRAFIRE_META.name).toBe('hydra')
      expect(HYDRAFIRE_META.celFile).toBe('Firebolt')

      expect(MISSILE_METAS['hydra']).toBe(HYDRA_META)
      expect(MISSILE_METAS['hydra']).toBe(HYDRAFIRE_META)
      expect(MISSILE_METAS['firebolt']).toBe(FIREBOLT_META)
    })

    it('verifies baked PNG atlas and JSON metadata exist on disk with positive byte size', () => {
      const fbPng = path.resolve(__dirname, '../public/missiles/firebolt.png')
      const fbJson = path.resolve(__dirname, '../public/missiles/firebolt.json')
      const fePng = path.resolve(__dirname, '../public/missiles/fireexplode.png')
      const feJson = path.resolve(__dirname, '../public/missiles/fireexplode.json')

      expect(fs.existsSync(fbPng)).toBe(true)
      expect(fs.statSync(fbPng).size).toBeGreaterThan(1000)
      expect(fs.existsSync(fbJson)).toBe(true)
      expect(fs.existsSync(fePng)).toBe(true)
      expect(fs.statSync(fePng).size).toBeGreaterThan(1000)
      expect(fs.existsSync(feJson)).toBe(true)
    })

    it('verifies cast overlay mapping for Hydra is fire_cast_2', () => {
      expect(SORCERESS_SKILL_CAST_OVERLAYS[62]).toBe('fire_cast_2')
      expect(getSkillCastOverlay(62)).toBe('fire_cast_2')
      expect(getSkillCastOverlay('62')).toBe('fire_cast_2')
    })
  })

  // =========================================================================
  // Dimension 3: Stationary Turret Emitter Physics
  // =========================================================================
  describe('Dimension 3: Stationary Turret Emitter Physics', () => {
    it('stationary turret holds position (vx=0, vy=0) and ticks age without drifting', () => {
      const turret: Projectile = {
        skillId: '62',
        x: 200,
        y: 150,
        vx: 0,
        vy: 0,
        damage: 35,
        ttl: 250, // 10s at 25 fps
        fromPlayer: true,
        missileType: 'hydra_turret',
        isTurret: true,
        fireCadenceTicks: 25,
      }

      let current: readonly Projectile[] = [turret]
      const openTerrain = { overlap: () => 0 }

      for (let tick = 1; tick <= 10; tick++) {
        const res = tickProjectiles(current, [], openTerrain)
        expect(res.alive.length).toBe(1)
        const t = res.alive[0]!
        expect(t.x).toBe(200)
        expect(t.y).toBe(150)
        expect(t.vx).toBe(0)
        expect(t.vy).toBe(0)
        expect(t.ageTicks).toBe(tick)
        expect(t.ttl).toBe(250 - tick)
        current = res.alive
      }
    })

    it('periodically emits hydra bolt at closest enemy within 480 px every 25 ticks', () => {
      const turret: Projectile = {
        skillId: '62',
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        damage: 35,
        ttl: 250,
        fromPlayer: true,
        missileType: 'hydra_turret',
        isTurret: true,
        fireCadenceTicks: 25,
        spawnMissileType: 'hydra',
      }

      // Enemy at (300, 100), distance 200 px <= 480 px
      const enemy = { index: 1, x: 300, y: 100, radius: 16, alive: true }
      let current: readonly Projectile[] = [turret]
      const openTerrain = { overlap: () => 0 }
      const spawnedBolts: Projectile[] = []

      for (let tick = 1; tick <= 55; tick++) {
        const res = tickProjectiles(current, [enemy], openTerrain)
        if (res.spawnedProjectiles && res.spawnedProjectiles.length > 0) {
          spawnedBolts.push(...res.spawnedProjectiles)
        }
        current = res.alive.filter(p => p.isTurret)
      }

      // Should have emitted at tick 25 and tick 50 -> 2 bolts!
      expect(spawnedBolts.length).toBe(2)
      for (const bolt of spawnedBolts) {
        expect(bolt.missileType).toBe('hydra')
        expect(bolt.ttl).toBe(30) // 1.13c range: 30
        expect(bolt.damage).toBe(35)
        expect(bolt.x).toBe(100)
        expect(bolt.y).toBe(100)
        // Directed along +x axis toward (300, 100)
        expect(bolt.vx).toBeCloseTo(16, 0.1) // 1.13c vel: 16
        expect(bolt.vy).toBeCloseTo(0, 0.1)
      }
    })

    it('respects 2:1 isometric ground plane aspect ratio for distance targeting', () => {
      const turret: Projectile = {
        skillId: '62',
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        damage: 35,
        ttl: 250,
        fromPlayer: true,
        missileType: 'hydra_turret',
        isTurret: true,
        fireCadenceTicks: 25,
      }

      // Enemy A is at dx=0, dy=200 -> ground distance = 200 / 0.5 = 400 <= 480 (in range)
      // Enemy B is at dx=0, dy=300 -> ground distance = 300 / 0.5 = 600 > 480 (out of range)
      const enemyA = { index: 1, x: 100, y: 300, radius: 16, alive: true }
      const enemyB = { index: 2, x: 100, y: 400, radius: 16, alive: true }

      let current: readonly Projectile[] = [turret]
      let spawned: Projectile[] = []
      for (let tick = 1; tick <= 25; tick++) {
        const res = tickProjectiles(current, [enemyA, enemyB], { overlap: () => 0 })
        if (res.spawnedProjectiles) spawned.push(...res.spawnedProjectiles)
        current = res.alive.filter(p => p.isTurret)
      }

      expect(spawned.length).toBe(1)
      // Target was enemyA
      expect(spawned[0]!.vy).toBeCloseTo(16, 0.1)
    })

    it('spawns exactly 0 projectiles over 50 ticks when targets array is empty (idle turret parity)', () => {
      const turret: Projectile = {
        skillId: '62',
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        damage: 35,
        ttl: 250,
        fromPlayer: true,
        missileType: 'hydra_turret',
        isTurret: true,
        fireCadenceTicks: 25,
        spawnMissileType: 'hydra',
        targetX: 100,
        targetY: 100,
      }

      let current: readonly Projectile[] = [turret]
      const spawnedBolts: Projectile[] = []

      for (let tick = 1; tick <= 50; tick++) {
        const res = tickProjectiles(current, [], { overlap: () => 0 })
        if (res.spawnedProjectiles && res.spawnedProjectiles.length > 0) {
          spawnedBolts.push(...res.spawnedProjectiles)
        }
        current = res.alive.filter(p => p.isTurret)
      }

      expect(spawnedBolts.length).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 4: Harmless Turret Emitter & Single-Target Missile Collision
  // =========================================================================
  describe('Dimension 4: Harmless Turret Emitter & Single-Target Collision', () => {
    it('turret head deals NO contact damage to overlapping monster and does not die', () => {
      const turret: Projectile = {
        skillId: '62',
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        damage: 50,
        ttl: 100,
        fromPlayer: true,
        missileType: 'hydra_turret',
        isTurret: true,
      }

      // Monster right on top of turret head
      const monster = { index: 0, x: 100, y: 100, radius: 20, alive: true }
      const res = tickProjectiles([turret], [monster], { overlap: () => 0 })

      expect(res.hits.length).toBe(0) // No direct contact damage
      expect(res.alive.length).toBe(1) // Turret survives
      expect(res.alive[0]!.isTurret).toBe(true)
    })

    it('emitted hydra bolt deals damage, is single-target (pierce=false, collideKill=true)', () => {
      const bolt: Projectile = {
        skillId: '62',
        x: 100,
        y: 100,
        vx: 16,
        vy: 0,
        damage: 40,
        ttl: 30,
        fromPlayer: true,
        missileType: 'hydra',
        pierce: false,
      }

      const target1 = { index: 1, x: 110, y: 100, radius: 15, alive: true }
      const target2 = { index: 2, x: 130, y: 100, radius: 15, alive: true }

      const res = tickProjectiles([bolt], [target1, target2], { overlap: () => 0 })
      expect(res.hits.length).toBe(1)
      expect(res.hits[0]!.targetIndex).toBe(1)
      expect(res.hits[0]!.damage).toBe(40)
      // Bolt should be consumed (not alive)
      expect(res.alive.length).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 5: Obstacle / Wall Collision & Detonation
  // =========================================================================
  describe('Dimension 5: Obstacle / Wall Collision & Detonation', () => {
    it('emitted hydra bolt detonates into fireexplode and stops on wall impact', () => {
      const bolt: Projectile = {
        skillId: '62',
        x: 100,
        y: 100,
        vx: 16,
        vy: 0,
        damage: 40,
        ttl: 30,
        fromPlayer: true,
        missileType: 'hydra',
        pierce: false,
      }

      // Wall at x >= 110
      const wallTerrain = { overlap: (x: number) => (x >= 110 ? 1 : 0) }
      const res = tickProjectiles([bolt], [], wallTerrain)

      expect(res.wallHits).toBe(1)
      expect(res.alive.length).toBe(0)
      expect(res.wallHitEvents).toBeDefined()
      expect(res.wallHitEvents!.some(e => e.missileType === 'hydra')).toBe(true)
    })
  })

  // =========================================================================
  // Dimension 6: 1.13c Synergy & Level Scaling
  // =========================================================================
  describe('Dimension 6: 1.13c Synergy & Level Scaling', () => {
    it('verifies 1.13c base damage formulas at slvl 1, 10, and 20', () => {
      // slvl 1: EMin: 28, EMax: 39 with HitShift: 7 -> 14 - 19 (scaled by 2^(7-8) = 0.5, integer floor)
      const d1 = calculateSkillDamage(62, 1)
      expect(d1.min).toBe(14)
      expect(d1.max).toBe(19)

      // slvl 10: raw min = 28 + 7*11 + 2*15 = 135 -> 67.5 -> 67
      // raw max = 39 + 7*13 + 2*17 = 164 -> 82 -> 82
      const d10 = calculateSkillDamage(62, 10)
      expect(d10.min).toBe(67)
      expect(d10.max).toBe(82)

      // slvl 20: raw min = 28 + 7*11 + 8*15 + 4*19 = 301 -> 150.5 -> 150
      // raw max = 39 + 7*13 + 8*17 + 4*21 = 350 -> 175 -> 175
      const d20 = calculateSkillDamage(62, 20)
      expect(d20.min).toBe(150)
      expect(d20.max).toBe(175)
    })

    it('verifies 1.13c mana cost formula: (mana + lvlmana * (lvl - 1)) * 2^(manashift - 8)', () => {
      // mana = 40, lvlmana = 1, manashift = 7 -> factor = 0.5
      expect(getSkillManaCost(62, 1)).toBe(20) // (40 + 0) * 0.5 = 20
      expect(getSkillManaCost(62, 10)).toBe(24.5) // (40 + 9) * 0.5 = 24.5
      expect(getSkillManaCost(62, 20)).toBe(29.5) // (40 + 19) * 0.5 = 29.5
    })

    it('verifies hard point blvl synergy rule (Fire Bolt + Fire Ball +3% per hard point)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(62)!

      const statsHard = new UnitStatList()
      statsHard.setBaseSkillLevel(62, 20)
      statsHard.setBaseSkillLevel(36, 10) // 10 hard points in Fire Bolt
      statsHard.setBaseSkillLevel(47, 10) // 10 hard points in Fire Ball
      const resHard = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsHard,
      })
      // (10 + 10) * 3% = 60%
      expect(resHard.synergyBonusPct).toBe(60)

      // Soft items / charged skills do NOT grant synergy
      const statsSoft = new UnitStatList()
      statsSoft.setBaseSkillLevel(62, 20)
      statsSoft.addStat('item_allskills', 15)
      statsSoft.setChargedSkillLevel(36, 20)
      const resSoft = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsSoft,
      })
      expect(resSoft.synergyBonusPct).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 7: 3-Head Cluster Geometry & Cast Dispatch
  // =========================================================================
  describe('Dimension 7: 3-Head Cluster Geometry & Cast Dispatch', () => {
    it('castSkill spawns 3 turret heads with authentic Overlay.txt offsets [(-6, -11), (0, -7), (4, -15)]', () => {
      const engine = new GameEngine(
        { widthPx: 1000, heightPx: 1000, overlap: () => 0 },
        { spawn: { x: 200, y: 200 }, stats: [], questDefs: [], npcDefs: [] } as any,
      )
      engine.world.player.x = 200
      engine.world.player.y = 200
      engine.world.player.mana = 100
      engine.world.player.cooldown = 0

      const statusEl = { textContent: '' } as HTMLElement
      const dummyRuntime = {
        walkable: { isWalkable: () => true },
        collision: { isWalkable: () => true },
      } as any

      const targetX = 400
      const targetY = 300
      const castOk = castSkill(62, targetX, targetY, {
        engine,
        runtime: dummyRuntime,
        hudManager: null,
        status: statusEl,
      })

      expect(castOk).toBe(true)
      expect(statusEl.textContent).toBe('施展九头海蛇')
      expect(engine.world.player.cooldown).toBe(40) // 1.13c delay: 40 frames
      expect(engine.world.player.mana).toBe(80) // 100 - 20 = 80
      expect(engine.projectiles.length).toBe(3)

      const p0 = engine.projectiles[0]!
      const p1 = engine.projectiles[1]!
      const p2 = engine.projectiles[2]!

      expect(p0.x).toBe(targetX - 6)
      expect(p0.y).toBe(targetY - 11)
      expect(p0.headIndex).toBe(0)
      expect(p0.isTurret).toBe(true)
      expect(p0.ttl).toBe(250) // 1.13c Param1 = 250 frames

      expect(p1.x).toBe(targetX + 0)
      expect(p1.y).toBe(targetY - 7)
      expect(p1.headIndex).toBe(1)
      expect(p1.isTurret).toBe(true)

      expect(p2.x).toBe(targetX + 4)
      expect(p2.y).toBe(targetY - 15)
      expect(p2.headIndex).toBe(2)
      expect(p2.isTurret).toBe(true)
    })

    it('getSkillRange and getSkillMana return canonical values for skill 62', () => {
      expect(getSkillRange(62)).toBe(450)
      expect(getSkillMana(62)).toBe(20)
    })
  })
})
