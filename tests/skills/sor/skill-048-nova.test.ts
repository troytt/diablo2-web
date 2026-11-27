/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #048: Nova (SOR)
 * Gitea Tracking Issue: #202
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Missile Definition (Skills.txt row 48, Missiles.txt 'nova')
 * D2: Visual Assets & Metadata Integrity (nova.png/json, light_cast_1.png/json, Additive Blending)
 * D3: Kinematics & 64-Bolt Circular Ring Dispersion (24 vel, 13 range, 2:1 isometric ground foreshortening)
 * D4: NextDelay = 4 Single-Hit Lockout Protection (Prevents point-blank 64x multi-hit stack)
 * D5: Obstacle & Terrain Collision Clipping (Wall collisions expire missiles, open space continues)
 * D6: 1.13c 5-Band Damage Scaling & Synergy Verification (1-20 at lvl 1, 57-94 at lvl 10, 131-188 at lvl 20, 0 synergies)
 * D7: WorldArena & Runtime Cast Integration (Cast action frame, mana cost, 0 cooldown, overlay attachment)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-048-nova.ts'
import {
  parseMissilesTxt,
  getMissileTxtData,
  CANONICAL_113C_MISSILES,
  getSkillManaCost,
  getSkillCooldownTicks,
  getSkillCastOverlay,
  SORCERESS_SKILL_CAST_OVERLAYS,
  calculateNovaDamage,
  tickProjectiles,
  ISO_GROUND_ASPECT_RATIO,
  type Projectile,
} from '../../../src/server/skills/skills.ts'
import {
  MissileEngine,
  spawnNovaRing,
} from '../../../src/server/engine/missile-engine.ts'
import {
  NOVA_META,
  MISSILE_METAS,
} from '../../../src/client/render/missiles-meta.ts'
import {
  LIGHT_CAST_1_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #048] Nova (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #202)', () => {
  const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition', () => {
    it('parses authentic Skills.txt row 48 (Nova)', () => {
      const lines = skillsTxtContent.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')
      const skillIdx = headers.indexOf('skill')
      const charClassIdx = headers.indexOf('charclass')
      const manaIdx = headers.indexOf('mana')
      const lvlManaIdx = headers.indexOf('lvlmana')
      const srvDoFuncIdx = headers.indexOf('srvdofunc')
      const castOverlayIdx = headers.indexOf('castoverlay')
      const srvMissileAIdx = headers.indexOf('srvmissilea')

      const novaRow = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx] === '48')
      expect(novaRow).toBeDefined()
      expect(novaRow![skillIdx]).toBe('Nova')
      expect(novaRow![charClassIdx]).toBe('sor')
      expect(Number(novaRow![manaIdx])).toBe(15)
      expect(Number(novaRow![lvlManaIdx])).toBe(1)
      expect(Number(novaRow![srvDoFuncIdx])).toBe(22)
      expect(novaRow![castOverlayIdx]).toBe('light_cast_1')
      expect(novaRow![srvMissileAIdx]).toBe('nova')
    })

    it('parses authentic Missiles.txt row for nova (ID 90)', () => {
      const map = parseMissilesTxt(missilesTxtContent)
      const nova = map.get('nova')
      expect(nova).toBeDefined()
      expect(nova!.id).toBe(90)
      expect(nova!.vel).toBe(24)
      expect(nova!.range).toBe(13)
      expect(nova!.speedPxPerSec).toBe(600) // 24 * 25
      expect(nova!.distancePx).toBe(312) // 24 * 13
      expect(nova!.celFile.toLowerCase()).toBe('electricnova')
      expect(nova!.animLen).toBe(13)
      expect(nova!.nextHit).toBe(1)
      expect(nova!.nextDelay).toBe(4)
      expect(nova!.trans).toBe(1)
    })

    it('CANONICAL_113C_MISSILES contains exact nova definition and no electricnova alias row', () => {
      const nova = getMissileTxtData('nova')
      expect(nova.id).toBe(90)
      expect(nova.vel).toBe(24)
      expect(nova.range).toBe(13)
      expect(nova.speedPxPerSec).toBe(600)
      expect(nova.distancePx).toBe(312)
      expect(nova.nextDelay).toBe(4)
      expect(nova.celFile.toLowerCase()).toBe('electricnova')

      expect(Object.prototype.hasOwnProperty.call(CANONICAL_113C_MISSILES, 'electricnova')).toBe(false)
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies baked DCC atlas sprite sheet files exist with non-zero size', () => {
      const missilePng = path.resolve(__dirname, '../../../public/missiles/nova.png')
      const missileJson = path.resolve(__dirname, '../../../public/missiles/nova.json')
      const overlayPng = path.resolve(__dirname, '../../../public/overlays/light_cast_1.png')
      const overlayJson = path.resolve(__dirname, '../../../public/overlays/light_cast_1.json')

      expect(fs.existsSync(missilePng)).toBe(true)
      expect(fs.statSync(missilePng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(missileJson)).toBe(true)
      expect(fs.existsSync(overlayPng)).toBe(true)
      expect(fs.statSync(overlayPng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(overlayJson)).toBe(true)
    })

    it('verifies NOVA_META metadata and registry registration', () => {
      expect(NOVA_META.name).toBe('nova')
      expect(NOVA_META.celFile).toBe('ElectricNova')
      expect(NOVA_META.directions).toBe(16)
      expect(NOVA_META.framesPerDirection).toBe(13)
      expect(MISSILE_METAS['electricnova']).toBeUndefined()
      expect(MISSILE_METAS['nova']).toBe(NOVA_META)
    })

    it('verifies cast overlay mapping and metadata', () => {
      expect(SORCERESS_SKILL_CAST_OVERLAYS[48]).toBe('light_cast_1')
      expect(getSkillCastOverlay(48)).toBe('light_cast_1')
      expect(LIGHT_CAST_1_META.name).toBe('light_cast_1')
      expect(OVERLAY_METAS['light_cast_1']).toBe(LIGHT_CAST_1_META)
    })
  })

  // =========================================================================
  // Dimension 3: Kinematics & 64-Bolt Circular Ring Dispersion
  // =========================================================================
  describe('Dimension 3: Kinematics & 64-Bolt Circular Ring Dispersion', () => {
    it('spawnNovaRing emits exactly 64 bolts with uniform angular distribution', () => {
      const bolts = spawnNovaRing(200, 300, 45)
      expect(bolts.length).toBe(64)

      for (let i = 0; i < 64; i++) {
        const b = bolts[i]!
        expect(b.x).toBe(200)
        expect(b.y).toBe(300)
        expect(b.damage).toBe(45)
        expect(b.ttl).toBe(13)
        expect(b.missileType).toBe('nova')
        expect(b.fromPlayer).toBe(true)
        expect(b.nextDelay).toBe(4)

        const expectedAngle = (i / 64) * Math.PI * 2
        const expectedVx = Math.cos(expectedAngle) * 24
        const expectedVy = Math.sin(expectedAngle) * 24 * ISO_GROUND_ASPECT_RATIO

        expect(b.vx).toBeCloseTo(expectedVx, 4)
        expect(b.vy).toBeCloseTo(expectedVy, 4)
      }
    })

    it('enforces 2:1 isometric ground foreshortening (ISO_GROUND_ASPECT_RATIO = 0.5)', () => {
      const bolts = spawnNovaRing(0, 0, 50)
      const eastBolt = bolts[0]! // angle = 0, cos = 1, sin = 0
      const southBolt = bolts[16]! // angle = pi/2, cos = 0, sin = 1
      const westBolt = bolts[32]! // angle = pi, cos = -1, sin = 0
      const northBolt = bolts[48]! // angle = 3pi/2, cos = 0, sin = -1

      expect(eastBolt.vx).toBeCloseTo(24, 4)
      expect(eastBolt.vy).toBeCloseTo(0, 4)

      expect(southBolt.vx).toBeCloseTo(0, 4)
      expect(southBolt.vy).toBeCloseTo(12, 4) // 24 * 0.5 = 12

      expect(westBolt.vx).toBeCloseTo(-24, 4)
      expect(westBolt.vy).toBeCloseTo(0, 4)

      expect(northBolt.vx).toBeCloseTo(0, 4)
      expect(northBolt.vy).toBeCloseTo(-12, 4) // -24 * 0.5 = -12
    })

    it('expanding ring maintains true elliptical shape over 5 ticks in open space', () => {
      let bolts: readonly Projectile[] = spawnNovaRing(0, 0, 50)
      const openTerrain = { overlap: () => 0 }

      for (let tick = 1; tick <= 5; tick++) {
        const outcome = tickProjectiles(bolts, [], openTerrain)
        bolts = outcome.alive
      }

      expect(bolts.length).toBe(64)
      // At tick 5: horizontal displacement = 5 * 24 = 120 px, vertical = 5 * 12 = 60 px
      for (const b of bolts) {
        const normalizedX = b.x / 120
        const normalizedY = b.y / 60
        const radiusSq = normalizedX * normalizedX + normalizedY * normalizedY
        expect(radiusSq).toBeCloseTo(1.0, 2)
      }
    })
  })

  // =========================================================================
  // Dimension 4: NextDelay = 4 Single-Hit Lockout Protection
  // =========================================================================
  describe('Dimension 4: NextDelay = 4 Single-Hit Lockout Protection', () => {
    it('prevents point-blank overlapping multi-hit stack (target takes damage from only 1 bolt)', () => {
      // Spawn 64 radial bolts from (0, 0)
      const bolts = spawnNovaRing(0, 0, 100)
      // Target at point-blank (x: 10, y: 0) with radius 15
      const target = { index: 1, x: 10, y: 0, radius: 15, alive: true }
      const nextDelayMap = new Map<number, number>()

      const outcome = tickProjectiles(bolts, [target], {
        overlap: () => 0,
        nextDelayByTarget: nextDelayMap,
        currentTick: 1,
      })

      // Multiple bolts passed through the target, but NextDelay = 4 locks out further hits
      expect(outcome.hits.length).toBe(1)
      expect(outcome.hits[0]!.targetIndex).toBe(1)
      expect(outcome.hits[0]!.damage).toBe(100)

      // Target must have lockout until tick 1 + 4 = 5
      expect(nextDelayMap.get(1)).toBe(5)

      // Next tick (tick 2), target is still in lockout
      const outcome2 = tickProjectiles(outcome.alive, [target], {
        overlap: () => 0,
        nextDelayByTarget: nextDelayMap,
        currentTick: 2,
      })
      expect(outcome2.hits.length).toBe(0)
      expect(nextDelayMap.get(1)).toBe(5)
    })
  })

  // =========================================================================
  // Dimension 5: Obstacle & Terrain Collision Clipping
  // =========================================================================
  describe('Dimension 5: Obstacle & Terrain Collision Clipping', () => {
    it('expires bolts moving into solid walls while open-air bolts continue', () => {
      const bolts = spawnNovaRing(0, 0, 50)
      // Solid wall at x >= 40
      const wallTerrain = { overlap: (x: number) => (x >= 40 ? 1 : 0) }

      // Step 3 ticks: x speed is 24 px/tick. By tick 3, all eastern bolts reach x >= 40
      const step1 = tickProjectiles(bolts, [], wallTerrain)
      const step2 = tickProjectiles(step1.alive, [], wallTerrain)
      const step3 = tickProjectiles(step2.alive, [], wallTerrain)

      expect(step3.wallHits).toBeGreaterThan(0)
      // Eastern bolts (vx > 15) must have hit the wall and died
      const survivingEastBolts = step3.alive.filter(b => b.vx > 15)
      expect(survivingEastBolts.length).toBe(0)

      // Western bolts (vx < 0) are in negative x (open space) and survive
      const survivingWestBolts = step3.alive.filter(b => b.vx < 0)
      expect(survivingWestBolts.length).toBeGreaterThan(0)
    })

    it('MissileEngine.tick detects obstacle collision and sets expired = true', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)
      const dummyOwner = {
        id: 'player',
        x: 0,
        y: 0,
        statList: new UnitStatList(),
      } as any
      engine.spawnMissile({
        missileNameOrId: 'nova',
        sourceSkillId: 48,
        slvl: 1,
        owner: dummyOwner,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
        dmgPacket: { minDamage: 50, maxDamage: 50, damageType: 'lightning' } as any,
        vx: 24,
        vy: 0,
        maxRangeTicks: 13,
      })

      // Wall at x >= 20 passed as 4th argument (collision) to engine.tick
      const collision = { isMissileBlocked: (x: number) => x >= 20 }
      engine.tick(1, [], new Map(), collision)

      // Missile moved to x=24 >= 20, must be marked expired and purged
      const active = engine.getActiveMissiles()
      expect(active.length).toBe(0)
    })
  })

  // =========================================================================
  // Dimension 6: 1.13c 5-Band Damage Scaling & Synergy Verification
  // =========================================================================
  describe('Dimension 6: 1.13c 5-Band Damage Scaling & Synergy Verification', () => {
    it('calculates exact 1.13c 5-band damage at slvl 1, 10, 20, and 30', () => {
      // slvl 1: 1-20
      const d1 = calculateNovaDamage(1)
      expect(d1.min).toBe(1)
      expect(d1.max).toBe(20)

      // slvl 10: 1 + 7*6 + 2*7 = 57, 20 + 7*8 + 2*9 = 94
      const d10 = calculateNovaDamage(10)
      expect(d10.min).toBe(57)
      expect(d10.max).toBe(94)

      // slvl 20: 1 + 7*6 + 8*7 + 4*8 = 131, 20 + 7*8 + 8*9 + 4*10 = 188
      const d20 = calculateNovaDamage(20)
      expect(d20.min).toBe(131)
      expect(d20.max).toBe(188)

      // slvl 30: 131 + 2*8 + 6*9 + 2*10 = 221, 188 + 2*10 + 6*11 + 2*12 = 298
      const d30 = calculateNovaDamage(30)
      expect(d30.min).toBe(221)
      expect(d30.max).toBe(298)
    })

    it('evaluates exact 1.13c Skills.txt formulas in skillModule.evaluate', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(48)!
      expect(skillRec).toBeDefined()
      expect(skillModule.skillId).toBe(48)
      expect(skillModule.name).toBe("Nova")
      expect(skillModule.charClass).toBe("sor")

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(48, 1)
      const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
      expect(r1.manaCost).toBe(15)
      expect(r1.manaCost256).toBe(3840)
      expect(r1.minElemDmg256).toBe(256)
      expect(r1.maxElemDmg256).toBe(5120)

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(48, 10)
      const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
      expect(r10.manaCost).toBe(24)
      expect(r10.manaCost256).toBe(6144)
      expect(r10.minElemDmg256).toBe(14592) // 57 * 256
      expect(r10.maxElemDmg256).toBe(24064) // 94 * 256

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(48, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(34)
      expect(r20.manaCost256).toBe(8704)
      expect(r20.minElemDmg256).toBe(33536) // 131 * 256
      expect(r20.maxElemDmg256).toBe(48128) // 188 * 256
      expect(r20.durationFrames).toBe(0)
      expect(r20.cooldownFrames).toBe(0)
    })

    it('enforces 1.13c zero synergy rule (Nova receives 0% synergy from other skills)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(48)!

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(48, 20)
      statsBase.setBaseSkillLevel(49, 20) // Lightning 20
      statsBase.setBaseSkillLevel(53, 20) // Chain Lightning 20
      statsBase.setBaseSkillLevel(38, 20) // Charged Bolt 20

      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(0)

      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(48, 20)
      statsSoftOnly.addStat('item_allskills', 20)
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
  // Dimension 7: WorldArena & Runtime Cast Integration
  // =========================================================================
  describe('Dimension 7: WorldArena & Runtime Cast Integration', () => {
    it('executes runtime skill effect in WorldArena (castCount, action frame, and combat outcome)', async () => {
      const registry = await getSharedDataRegistry()
      const arena = new WorldArena({
        registry,
        classCode: "sor",
        skillId: 48,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(48)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })

    it('verifies getSkillManaCost and getSkillCooldownTicks', () => {
      expect(getSkillManaCost(48, 1)).toBe(15)
      expect(getSkillManaCost(48, 10)).toBe(24)
      expect(getSkillManaCost(48, 20)).toBe(34)
      expect(getSkillCooldownTicks(48)).toBe(0)
    })
  })
})
