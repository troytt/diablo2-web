/**
 * 1.13c Numerical & Runtime 7-Dimensional Verification Suite — Skill #044: Frost Nova (SOR)
 * Gitea Tracking Issue: #431
 *
 * 7-Dimensional Verification Coverage:
 * D1: 1.13c Data Table Parsing & Canonical Missile Definition (Skills.txt row 44, Missiles.txt 'frostnova')
 * D2: Visual Assets & Metadata Integrity (frostnova.png/json, ice_cast_2.png/json, Additive Blending)
 * D3: Kinematics & 64-Bolt Circular Ring Dispersion (24 vel, 14 range, 2:1 isometric ground foreshortening)
 * D4: NextDelay = 4 Single-Hit Lockout Protection (Prevents point-blank 64x multi-hit stack)
 * D5: Obstacle & Terrain Collision Clipping (Wall collisions expire missiles, open space continues)
 * D6: 1.13c 5-Band Damage Scaling, Chill Duration & Synergy Verification (2-4 at lvl 1, 22-28 at lvl 10, 56-67 at lvl 20; +10%/lvl Blizzard & Frozen Orb)
 * D7: WorldArena & Runtime Cast Integration (Cast action frame, mana cost, 0 cooldown, overlay attachment, chill state application)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-044-frost-nova.ts'
import {
  parseMissilesTxt,
  getMissileTxtData,
  CANONICAL_113C_MISSILES,
  getSkillManaCost,
  getSkillCooldownTicks,
  getSkillCastOverlay,
  SORCERESS_SKILL_CAST_OVERLAYS,
  calculateFrostNovaDamage,
  calculateFrostNovaChillLength,
  calculateFrostNovaSynergyMultiplier,
  calculateSkillDamage,
  tickProjectiles,
  ISO_GROUND_ASPECT_RATIO,
  type Projectile,
} from '../../../src/server/skills/skills.ts'
import {
  MissileEngine,
  spawnFrostNovaRing,
  spawnNovaRing,
} from '../../../src/server/engine/missile-engine.ts'
import {
  FROSTNOVA_META,
  MISSILE_METAS,
} from '../../../src/client/render/missiles-meta.ts'
import {
  ICE_CAST_2_META,
  OVERLAY_METAS,
} from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #044] Frost Nova (SOR) — 1.13c 7-Dimensional Verification Suite (Issue #431)', () => {
  const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
  const skillsTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/skills.txt')
  const skillsTxtContent = fs.readFileSync(skillsTxtPath, 'latin1')

  // =========================================================================
  // Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition
  // =========================================================================
  describe('Dimension 1: 1.13c Data Table Parsing & Canonical Missile Definition', () => {
    it('parses authentic Skills.txt row 44 (Frost Nova)', () => {
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
      const delayIdx = headers.indexOf('delay')

      const fnRow = lines.slice(1).map(l => l.split('\t')).find(r => r[idIdx] === '44')
      expect(fnRow).toBeDefined()
      expect(fnRow![skillIdx]).toBe('Frost Nova')
      expect(fnRow![charClassIdx]).toBe('sor')
      expect(Number(fnRow![manaIdx])).toBe(9)
      expect(Number(fnRow![lvlManaIdx])).toBe(1)
      expect(Number(fnRow![srvDoFuncIdx])).toBe(22) // Identical to Nova (#48)
      expect(fnRow![castOverlayIdx]).toBe('ice_cast_2')
      expect(fnRow![srvMissileAIdx]).toBe('frostnova')
      expect(fnRow![delayIdx] || '').toBe('') // 0 cooldown
    })

    it('parses authentic Missiles.txt row for frostnova (ID 119)', () => {
      const map = parseMissilesTxt(missilesTxtContent)
      const fn = map.get('frostnova')
      expect(fn).toBeDefined()
      expect(fn!.id).toBe(119)
      expect(fn!.vel).toBe(24)
      expect(fn!.range).toBe(14)
      expect(fn!.speedPxPerSec).toBe(600) // 24 * 25
      expect(fn!.distancePx).toBe(336) // 24 * 14
      expect(fn!.celFile.toLowerCase()).toBe('frostnova')
      expect(fn!.animLen).toBe(14)
      expect(fn!.nextHit).toBe(1)
      expect(fn!.nextDelay).toBe(4)
      expect(fn!.trans).toBe(1)
    })

    it('CANONICAL_113C_MISSILES contains exact frostnova definition', () => {
      const fn = getMissileTxtData('frostnova')
      expect(fn.id).toBe(119)
      expect(fn.vel).toBe(24)
      expect(fn.range).toBe(14)
      expect(fn.speedPxPerSec).toBe(600)
      expect(fn.distancePx).toBe(336)
      expect(fn.nextDelay).toBe(4)
      expect(fn.celFile.toLowerCase()).toBe('frostnova')
      expect(fn.trans).toBe(1)
    })
  })

  // =========================================================================
  // Dimension 2: Visual Assets & Metadata Integrity
  // =========================================================================
  describe('Dimension 2: Visual Assets & Metadata Integrity', () => {
    it('verifies baked DCC atlas sprite sheet files exist with non-zero size', () => {
      const missilePng = path.resolve(__dirname, '../../../public/missiles/frostnova.png')
      const missileJson = path.resolve(__dirname, '../../../public/missiles/frostnova.json')
      const overlayPng = path.resolve(__dirname, '../../../public/overlays/ice_cast_2.png')
      const overlayJson = path.resolve(__dirname, '../../../public/overlays/ice_cast_2.json')

      expect(fs.existsSync(missilePng)).toBe(true)
      expect(fs.statSync(missilePng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(missileJson)).toBe(true)
      expect(fs.existsSync(overlayPng)).toBe(true)
      expect(fs.statSync(overlayPng).size).toBeGreaterThan(10000)
      expect(fs.existsSync(overlayJson)).toBe(true)
    })

    it('verifies FROSTNOVA_META metadata and registry registration', () => {
      expect(FROSTNOVA_META.name).toBe('frostnova')
      expect(FROSTNOVA_META.celFile).toBe('FrostNova')
      expect(FROSTNOVA_META.directions).toBe(16)
      expect(FROSTNOVA_META.framesPerDirection).toBe(14)
      expect(MISSILE_METAS['frostnova']).toBe(FROSTNOVA_META)
    })

    it('verifies cast overlay mapping and metadata', () => {
      expect(SORCERESS_SKILL_CAST_OVERLAYS[44]).toBe('ice_cast_2')
      expect(getSkillCastOverlay(44)).toBe('ice_cast_2')
      expect(ICE_CAST_2_META.name).toBe('ice_cast_2')
      expect(OVERLAY_METAS['ice_cast_2']).toBe(ICE_CAST_2_META)
    })
  })

  // =========================================================================
  // Dimension 3: Kinematics & 64-Bolt Circular Ring Dispersion
  // =========================================================================
  describe('Dimension 3: Kinematics & 64-Bolt Circular Ring Dispersion', () => {
    it('spawnFrostNovaRing emits exactly 64 bolts with uniform angular distribution and chill effect', () => {
      const bolts = spawnFrostNovaRing(200, 300, 25, { slvl: 5 })
      expect(bolts.length).toBe(64)

      for (let i = 0; i < 64; i++) {
        const b = bolts[i]!
        expect(b.x).toBe(200)
        expect(b.y).toBe(300)
        expect(b.damage).toBe(25)
        expect(b.ttl).toBe(14) // Range = 14
        expect(b.missileType).toBe('frostnova')
        expect(b.fromPlayer).toBe(true)
        expect(b.nextDelay).toBe(4)
        expect(b.statusEffect).toBe('chill')
        expect(b.statusDuration).toBe(200 + (5 - 1) * 25) // 300 frames

        const expectedAngle = (i / 64) * Math.PI * 2
        const expectedVx = Math.cos(expectedAngle) * 24
        const expectedVy = Math.sin(expectedAngle) * 24 * ISO_GROUND_ASPECT_RATIO

        expect(b.vx).toBeCloseTo(expectedVx, 4)
        expect(b.vy).toBeCloseTo(expectedVy, 4)
      }
    })

    it('enforces 2:1 isometric ground foreshortening (ISO_GROUND_ASPECT_RATIO = 0.5)', () => {
      const bolts = spawnFrostNovaRing(0, 0, 50)
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
      let bolts: readonly Projectile[] = spawnFrostNovaRing(0, 0, 50)
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
      const bolts = spawnFrostNovaRing(0, 0, 50)
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
      expect(outcome.hits[0]!.damage).toBe(50)

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
      const bolts = spawnFrostNovaRing(0, 0, 50)
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
      const statList = new UnitStatList()
      const stateBus = new StateBus(statList, registry)
      const dummyOwner = {
        id: 'player',
        x: 0,
        y: 0,
        statList,
        stateBus,
      } as any
      engine.spawnMissile({
        missileNameOrId: 'frostnova',
        sourceSkillId: 44,
        slvl: 1,
        owner: dummyOwner,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
        dmgPacket: { minDamage: 10, maxDamage: 10, damageType: 'cold' } as any,
        vx: 24,
        vy: 0,
        maxRangeTicks: 14,
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
  describe('Dimension 6: 1.13c 5-Band Damage Scaling, Chill Duration & Synergy Verification', () => {
    it('calculates exact 1.13c 5-band damage at slvl 1, 10, 20, and 30', () => {
      // slvl 1: EMin 4, EMax 8, HitShift 7 -> 2-4
      const d1 = calculateFrostNovaDamage(1)
      expect(d1.min).toBe(2)
      expect(d1.max).toBe(4)

      // slvl 10: baseMin = 4 + 7*4 + 2*6 = 44 -> 22, baseMax = 8 + 7*5 + 2*7 = 57 -> 28
      const d10 = calculateFrostNovaDamage(10)
      expect(d10.min).toBe(22)
      expect(d10.max).toBe(28)

      // slvl 20: baseMin = 4 + 7*4 + 8*6 + 4*8 = 112 -> 56, baseMax = 8 + 7*5 + 8*7 + 4*9 = 135 -> 67
      const d20 = calculateFrostNovaDamage(20)
      expect(d20.min).toBe(56)
      expect(d20.max).toBe(67)

      // slvl 30: baseMin = 112 + 2*8 + 6*10 + 2*12 = 212 -> 106, baseMax = 135 + 2*9 + 6*11 + 2*13 = 245 -> 122
      const d30 = calculateFrostNovaDamage(30)
      expect(d30.min).toBe(106)
      expect(d30.max).toBe(122)
    })

    it('calculates exact 1.13c chilling duration (200 + (slvl - 1) * 25 frames)', () => {
      expect(calculateFrostNovaChillLength(1)).toBe(200) // 8.0s
      expect(calculateFrostNovaChillLength(10)).toBe(425) // 17.0s
      expect(calculateFrostNovaChillLength(20)).toBe(675) // 27.0s
      expect(calculateFrostNovaChillLength(30)).toBe(925) // 37.0s
    })

    it('calculates synergy bonus from Blizzard (#59) and Frozen Orb (#64) (+10% per hard point)', () => {
      // 0 synergy
      expect(calculateFrostNovaSynergyMultiplier({})).toBe(1.0)
      expect(calculateFrostNovaSynergyMultiplier({ blizzard: 0, frozenOrb: 0 })).toBe(1.0)

      // 20 points in Blizzard: +200% -> multiplier 3.0
      expect(calculateFrostNovaSynergyMultiplier({ blizzard: 20 })).toBe(3.0)
      const dBlizzard20 = calculateFrostNovaDamage(20, { blizzard: 20 })
      expect(dBlizzard20.min).toBe(56 * 3) // 168
      expect(dBlizzard20.max).toBe(Math.floor(67.5 * 3)) // 202

      // 20 points Blizzard + 20 points Frozen Orb: +400% -> multiplier 5.0
      expect(calculateFrostNovaSynergyMultiplier({ blizzard: 20, frozenOrb: 20 })).toBe(5.0)
      const dMaxSyn = calculateFrostNovaDamage(20, { blizzard: 20, frozenOrb: 20 })
      expect(dMaxSyn.min).toBe(56 * 5) // 280
      expect(dMaxSyn.max).toBe(Math.floor(67.5 * 5)) // 337
    })

    it('calculateSkillDamage routes skill 44 correctly', () => {
      const d1 = calculateSkillDamage(44, 1)
      expect(d1.min).toBe(2)
      expect(d1.max).toBe(4)

      const d20Syn = calculateSkillDamage('frostnova', 20, { blizzard: 20, frozenOrb: 20 })
      expect(d20Syn.min).toBe(280)
      expect(d20Syn.max).toBe(337)
    })

    it('evaluates exact 1.13c Skills.txt formulas in skillModule.evaluate', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(44)!
      expect(skillRec).toBeDefined()
      expect(skillModule.skillId).toBe(44)
      expect(skillModule.name).toBe("Frost Nova")
      expect(skillModule.charClass).toBe("sor")

      const stats1 = new UnitStatList()
      stats1.setBaseSkillLevel(44, 1)
      const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
      expect(r1.manaCost).toBe(9)
      expect(r1.manaCost256).toBe(2304)
      expect(r1.minElemDmg256).toBe(512) // 2 * 256
      expect(r1.maxElemDmg256).toBe(1024) // 4 * 256
      expect(r1.durationFrames).toBe(200)

      const stats10 = new UnitStatList()
      stats10.setBaseSkillLevel(44, 10)
      const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
      expect(r10.manaCost).toBe(18)
      expect(r10.manaCost256).toBe(4608)
      expect(r10.minElemDmg256).toBe(5632) // 22 * 256
      expect(r10.maxElemDmg256).toBe(7296) // 28.5 * 256
      expect(r10.durationFrames).toBe(425)

      const stats20 = new UnitStatList()
      stats20.setBaseSkillLevel(44, 20)
      const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
      expect(r20.manaCost).toBe(28)
      expect(r20.manaCost256).toBe(7168)
      expect(r20.minElemDmg256).toBe(14336) // 56 * 256
      expect(r20.maxElemDmg256).toBe(17280) // 67.5 * 256
      expect(r20.durationFrames).toBe(675)
      expect(r20.cooldownFrames).toBe(0)
    })

    it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
      const registry = await getSharedDataRegistry()
      const skillRec = registry.getSkillById(44)!

      const statsBase = new UnitStatList()
      statsBase.setBaseSkillLevel(44, 20)
      statsBase.setBaseSkillLevel(59, 20) // Blizzard 20
      statsBase.setBaseSkillLevel(64, 20) // Frozen Orb 20

      const withHardPoints = skillModule.evaluate!({
        registry,
        skill: skillRec,
        slvl: 20,
        blvl: 20,
        statList: statsBase,
      })
      expect(withHardPoints.synergyBonusPct).toBe(400)

      const statsSoftOnly = new UnitStatList()
      statsSoftOnly.setBaseSkillLevel(44, 20)
      statsSoftOnly.addStat('item_allskills', 20)
      statsSoftOnly.setChargedSkillLevel(59, 33)
      statsSoftOnly.setChargedSkillLevel(64, 33)

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
        skillId: 44,
        slvl: 20,
      })
      const outcome = arena.triggerCast()
      arena.stepTicks(15)
      const dbg = arena.getDebugState()

      expect(dbg.ready).toBe(true)
      expect(dbg.skillId).toBe(44)
      expect(dbg.castCount).toBeGreaterThanOrEqual(1)
      expect(dbg.actionFrameTriggered).toBe(true)
      expect(outcome?.executed).toBe(true)
    })

    it('verifies getSkillManaCost and getSkillCooldownTicks (0 cooldown)', () => {
      expect(getSkillManaCost(44, 1)).toBe(9)
      expect(getSkillManaCost(44, 10)).toBe(18)
      expect(getSkillManaCost(44, 20)).toBe(28)
      expect(getSkillCooldownTicks(44)).toBe(0)
    })

    it('applies chill state to target stateBus upon frostnova missile collision in MissileEngine.tick', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const playerStatList = new UnitStatList()
      const playerStateBus = new StateBus(playerStatList, registry)
      const playerUnit = {
        id: 'player',
        x: 0,
        y: 0,
        statList: playerStatList,
        stateBus: playerStateBus,
      } as any

      const monsterStatList = new UnitStatList()
      monsterStatList.setBaseStat('maxhp', 500)
      monsterStatList.setHp256(500 * 256)
      const monsterStateBus = new StateBus(monsterStatList, registry)
      const monsterUnit = {
        id: 'monster-1',
        statList: monsterStatList,
        stateBus: monsterStateBus,
      } as any

      // Spawn a frostnova missile directed straight at the monster at (24, 0)
      engine.spawnMissile({
        missileNameOrId: 'frostnova',
        sourceSkillId: 44,
        slvl: 10,
        owner: playerUnit,
        startX: 0,
        startY: 0,
        targetX: 100,
        targetY: 0,
        dmgPacket: {
          skillId: 44,
          attackKind: 'spell',
          elemType: 'cold',
          elemMin256: 22 * 256,
          elemMax256: 28 * 256,
          elemDurationFrames: 425,
          autoHit: true,
        },
        vx: 24,
        vy: 0,
        maxRangeTicks: 14,
      })

      const targetPositions = new Map<string, { x: number; y: number }>([
        ['monster-1', { x: 24, y: 0 }],
      ])

      const outcome = engine.tick(1, [monsterUnit], targetPositions)
      expect(outcome.hits.length).toBe(1)
      expect(outcome.hits[0]!.targetId).toBe('monster-1')
      expect(outcome.hits[0]!.missileName).toBe('frostnova')

      // Target must have received chill state with durationFrames = 425
      expect(monsterStateBus.hasState('chill')).toBe(true)
      const entry = monsterStateBus.getActiveEntries().find(s => s.stateName === 'chill')
      expect(entry).toBeDefined()
      expect(entry!.durationFrames).toBe(425)
    })
  })
})
