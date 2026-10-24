/**
 * Diablo II: Lord of Destruction v1.13c — Skill #059: Blizzard (SOR)
 * Missile Physics, 64-Entry Circle Emitter, Falling Altitude & 1.13c Parity Suite
 *
 * Requirements (Issue #400 / Blizzard Parity):
 * 1. Missiles.txt ground truth: parses and verifies blizzardcenter (ID 158), blizzard1..4 (IDs 159..162),
 *    and blizzardexplode1..3 (IDs 163..165).
 * 2. Visual assets & atlas metadata: BLIZZARD1..4_META (icestormfallvar01/02 and Blizzard.dcc),
 *    BLIZZARDEXPLODE1..3_META (icestormimpactvar01/02.dcc), baked PNG/JSON files exist.
 * 3. Authoritative 64-entry circle table from D2Game.dll (VA 0x6FD1C960, 0x6FD1CA60),
 *    2:1 isometric ground foreshortening (ISO_GROUND_ASPECT_RATIO = 0.5), step 13 coprime rotation.
 * 4. Controller missile blizzardcenter (pSrvDoFunc = 10): lives 100 ticks, emits 25 shards total
 *    (every 4 ticks), harmless emitter (no direct contact damage).
 * 5. Falling shard vertical descent: altitude drops from 120 px to 0 over 9 ticks (120/9 px/tick).
 * 6. Ground impact & wall detonation: spawns blizzardexplode1..3 upon expiry or obstacle collision.
 * 7. NextDelay = 0 sweet-spot burst: multiple overlapping shards deal full damage without immunity windows.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  parseMissilesTxt,
  getMissileTxtData,
  CANONICAL_113C_MISSILES,
  tickProjectiles,
  ISO_GROUND_ASPECT_RATIO,
  calculateBlizzardDamage,
  calculateBlizzardSynergyMultiplier,
  type Projectile,
} from '../src/server/skills/skills.ts'
import {
  BLIZZARD_CIRCLE_X,
  BLIZZARD_CIRCLE_Y,
  getBlizzardDropOffset,
} from '../src/common/data/blizzard-table.ts'
import {
  BLIZZARD1_META,
  BLIZZARD2_META,
  BLIZZARD3_META,
  BLIZZARD4_META,
  BLIZZARDEXPLODE1_META,
  BLIZZARDEXPLODE2_META,
  BLIZZARDEXPLODE3_META,
  MISSILE_METAS,
} from '../src/client/render/missiles-meta.ts'

describe('[Skill #059] Blizzard — 1.13c Missile Physics & Runtime Parity (Issue #400)', () => {
  const missilesTxtPath = path.resolve(__dirname, '../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')

  it('1. Parses authentic 1.13c Missiles.txt and verifies Blizzard missile suite (IDs 158..165)', () => {
    const map = parseMissilesTxt(missilesTxtContent)

    // blizzardcenter (ID 158)
    const center = map.get('blizzardcenter')
    expect(center).toBeDefined()
    expect(center!.id).toBe(158)
    expect(center!.vel).toBe(0)
    expect(center!.range).toBe(100)
    expect(center!.animLen).toBe(2)
    expect(center!.red).toBe(81)
    expect(center!.green).toBe(81)
    expect(center!.blue).toBe(255)

    // blizzard1 (ID 159)
    const b1 = map.get('blizzard1')
    expect(b1).toBeDefined()
    expect(b1!.id).toBe(159)
    expect(b1!.vel).toBe(0)
    expect(b1!.range).toBe(9)
    expect(b1!.celFile.toLowerCase()).toBe('icestormfallvar01')
    expect(b1!.animLen).toBe(6)

    // blizzard2 (ID 160)
    const b2 = map.get('blizzard2')
    expect(b2).toBeDefined()
    expect(b2!.id).toBe(160)
    expect(b2!.vel).toBe(0)
    expect(b2!.range).toBe(9)
    expect(b2!.celFile.toLowerCase()).toBe('icestormfallvar02')
    expect(b2!.animLen).toBe(6)

    // blizzard3 (ID 161)
    const b3 = map.get('blizzard3')
    expect(b3).toBeDefined()
    expect(b3!.id).toBe(161)
    expect(b3!.vel).toBe(0)
    expect(b3!.range).toBe(9)
    expect(b3!.celFile.toLowerCase()).toBe('blizzard')
    expect(b3!.animLen).toBe(8)

    // blizzard4 (ID 162)
    const b4 = map.get('blizzard4')
    expect(b4).toBeDefined()
    expect(b4!.id).toBe(162)
    expect(b4!.vel).toBe(0)
    expect(b4!.range).toBe(9)
    expect(b4!.celFile.toLowerCase()).toBe('blizzard')
    expect(b4!.animLen).toBe(8)

    // blizzardexplode1 (ID 163)
    const exp1 = map.get('blizzardexplode1')
    expect(exp1).toBeDefined()
    expect(exp1!.id).toBe(163)
    expect(exp1!.vel).toBe(0)
    expect(exp1!.range).toBe(6)
    expect(exp1!.celFile.toLowerCase()).toBe('icestormimpactvar01')
    expect(exp1!.animLen).toBe(6)

    // blizzardexplode2 (ID 164)
    const exp2 = map.get('blizzardexplode2')
    expect(exp2).toBeDefined()
    expect(exp2!.id).toBe(164)
    expect(exp2!.vel).toBe(0)
    expect(exp2!.range).toBe(6)
    expect(exp2!.celFile.toLowerCase()).toBe('icestormimpactvar02')
    expect(exp2!.animLen).toBe(6)

    // blizzardexplode3 (ID 165)
    const exp3 = map.get('blizzardexplode3')
    expect(exp3).toBeDefined()
    expect(exp3!.id).toBe(165)
    expect(exp3!.vel).toBe(0)
    expect(exp3!.range).toBe(6)
    expect(exp3!.celFile.toLowerCase()).toBe('icestormimpactvar02')
    expect(exp3!.animLen).toBe(6)
  })

  it('2. CANONICAL_113C_MISSILES export contains Blizzard suite with exact 1.13c values', () => {
    const center = getMissileTxtData('blizzardcenter')
    expect(center.id).toBe(158)
    expect(center.vel).toBe(0)
    expect(center.range).toBe(100)

    const b1 = getMissileTxtData('blizzard1')
    expect(b1.id).toBe(159)
    expect(b1.vel).toBe(0)
    expect(b1.range).toBe(9)
    expect(b1.animLen).toBe(6)
    expect(b1.explosionMissile).toBe('')

    const b2 = getMissileTxtData('blizzard2')
    expect(b2.id).toBe(160)
    expect(b2.range).toBe(9)
    expect(b2.explosionMissile).toBe('')

    const b3 = getMissileTxtData('blizzard3')
    expect(b3.id).toBe(161)
    expect(b3.range).toBe(9)
    expect(b3.animLen).toBe(8)
    expect(b3.explosionMissile).toBe('')

    const b4 = getMissileTxtData('blizzard4')
    expect(b4.id).toBe(162)
    expect(b4.range).toBe(9)
    expect(b4.animLen).toBe(8)
    expect(b4.explosionMissile).toBe('')

    const exp1 = getMissileTxtData('blizzardexplode1')
    expect(exp1.id).toBe(163)
    expect(exp1.range).toBe(6)

    const exp2 = getMissileTxtData('blizzardexplode2')
    expect(exp2.id).toBe(164)
    expect(exp2.range).toBe(6)

    const exp3 = getMissileTxtData('blizzardexplode3')
    expect(exp3.id).toBe(165)
    expect(exp3.range).toBe(6)
  })

  it('3. Authentic baked DCC atlas metadata and files exist on disk with non-zero byte size', () => {
    expect(BLIZZARD1_META.name).toBe('blizzard1')
    expect(BLIZZARD1_META.celFile).toBe('icestormfallvar01')
    expect(BLIZZARD1_META.framesPerDirection).toBe(6)

    expect(BLIZZARD2_META.name).toBe('blizzard2')
    expect(BLIZZARD2_META.celFile).toBe('icestormfallvar02')
    expect(BLIZZARD2_META.framesPerDirection).toBe(6)

    expect(BLIZZARD3_META.name).toBe('blizzard3')
    expect(BLIZZARD3_META.celFile).toBe('Blizzard')
    expect(BLIZZARD3_META.framesPerDirection).toBe(8)

    expect(BLIZZARD4_META.name).toBe('blizzard4')
    expect(BLIZZARD4_META.celFile).toBe('Blizzard')
    expect(BLIZZARD4_META.framesPerDirection).toBe(8)

    expect(BLIZZARDEXPLODE1_META.name).toBe('blizzardexplode1')
    expect(BLIZZARDEXPLODE1_META.celFile).toBe('icestormimpactvar01')
    expect(BLIZZARDEXPLODE1_META.framesPerDirection).toBe(6)

    expect(BLIZZARDEXPLODE2_META.name).toBe('blizzardexplode2')
    expect(BLIZZARDEXPLODE2_META.celFile).toBe('icestormimpactvar02')
    expect(BLIZZARDEXPLODE2_META.framesPerDirection).toBe(6)

    expect(BLIZZARDEXPLODE3_META.name).toBe('blizzardexplode3')
    expect(BLIZZARDEXPLODE3_META.celFile).toBe('icestormimpactvar02')
    expect(BLIZZARDEXPLODE3_META.framesPerDirection).toBe(6)

    expect(MISSILE_METAS['blizzard1']).toBe(BLIZZARD1_META)
    expect(MISSILE_METAS['blizzard2']).toBe(BLIZZARD2_META)
    expect(MISSILE_METAS['blizzard3']).toBe(BLIZZARD3_META)
    expect(MISSILE_METAS['blizzard4']).toBe(BLIZZARD4_META)
    expect(MISSILE_METAS['blizzardexplode1']).toBe(BLIZZARDEXPLODE1_META)
    expect(MISSILE_METAS['blizzardexplode2']).toBe(BLIZZARDEXPLODE2_META)
    expect(MISSILE_METAS['blizzardexplode3']).toBe(BLIZZARDEXPLODE3_META)

    const missileFiles = [
      'blizzard1',
      'blizzard2',
      'blizzard3',
      'blizzard4',
      'blizzardexplode1',
      'blizzardexplode2',
      'blizzardexplode3',
    ]

    for (const name of missileFiles) {
      const pngPath = path.resolve(__dirname, `../public/missiles/${name}.png`)
      const jsonPath = path.resolve(__dirname, `../public/missiles/${name}.json`)
      expect(fs.existsSync(pngPath), `Missing ${pngPath}`).toBe(true)
      expect(fs.statSync(pngPath).size).toBeGreaterThan(1000)
      expect(fs.existsSync(jsonPath), `Missing ${jsonPath}`).toBe(true)
      expect(fs.statSync(jsonPath).size).toBeGreaterThan(100)
    }
  })

  it('4. Authoritative 64-entry circle lookup table matches 1.13c binary assembly (radius 30, Y*0.5)', () => {
    expect(BLIZZARD_CIRCLE_X.length).toBe(64)
    expect(BLIZZARD_CIRCLE_Y.length).toBe(64)

    // Primary cardinal points
    expect(BLIZZARD_CIRCLE_X[0]).toBe(0)
    expect(BLIZZARD_CIRCLE_Y[0]).toBe(30)
    expect(BLIZZARD_CIRCLE_X[16]).toBe(30)
    expect(BLIZZARD_CIRCLE_Y[16]).toBe(0)
    expect(BLIZZARD_CIRCLE_X[32]).toBe(0)
    expect(BLIZZARD_CIRCLE_Y[32]).toBe(-30)
    expect(BLIZZARD_CIRCLE_X[48]).toBe(-30)
    expect(BLIZZARD_CIRCLE_Y[48]).toBe(0)

    // getBlizzardDropOffset checks
    // At index 16 (X=30, Y=0), radius 7 subtiles: dx = 30 * (112/30) = 112, dy = 0
    const offEast = getBlizzardDropOffset(16, 7, 16)
    expect(offEast.dx).toBe(112)
    expect(offEast.dy).toBe(0)

    // At index 0 (X=0, Y=30), radius 7 subtiles: dx = 0, dy = 30 * (112/30) * 0.5 = 56
    const offSouth = getBlizzardDropOffset(0, 7, 16)
    expect(offSouth.dx).toBe(0)
    expect(offSouth.dy).toBe(56)

    // 2:1 isometric aspect ratio verification
    expect(ISO_GROUND_ASPECT_RATIO).toBe(0.5)
  })

  it('5. tickProjectiles: blizzardcenter lives 100 ticks and emits exactly 25 shards (cadence = 4 ticks, step = 13)', () => {
    let center: Projectile = {
      skillId: '59',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      damage: 150,
      ttl: 100, // 100 frames = 4.0s
      fromPlayer: true,
      missileType: 'blizzardcenter',
      subMissileIdx: 0,
    }

    const allEmittedShards: Projectile[] = []
    const openTerrain = { overlap: () => 0 }

    for (let tick = 1; tick <= 100; tick += 1) {
      const outcome = tickProjectiles([center], [], openTerrain)
      if (tick % 4 === 0) {
        expect(outcome.spawnedProjectiles).toBeDefined()
        expect(outcome.spawnedProjectiles!.length).toBe(1)
        const shard = outcome.spawnedProjectiles![0]!
        expect(['blizzard1', 'blizzard2', 'blizzard3', 'blizzard4']).toContain(shard.missileType)
        expect(shard.damage).toBe(150)
        expect(shard.statusEffect).toBe('chill')
        expect(shard.statusDuration).toBe(100)
        expect(shard.ttl).toBe(9)
        expect(shard.altitude).toBe(120)
        allEmittedShards.push(shard)
      } else {
        expect(outcome.spawnedProjectiles?.length ?? 0).toBe(0)
      }

      // Center must remain alive until tick 100
      center = outcome.alive.find(p => p.missileType === 'blizzardcenter')!
      if (tick < 100) {
        expect(center).toBeDefined()
        expect(center.ttl).toBe(100 - tick)
      }
    }

    // Exactly 25 shards produced over 100 ticks (100 / 4)
    expect(allEmittedShards.length).toBe(25)

    // At tick 101, center expires
    const expiredOutcome = tickProjectiles([center], [], openTerrain)
    expect(expiredOutcome.expired).toBe(1)
    expect(expiredOutcome.alive.length).toBe(0)
  })

  it('6. Main blizzardcenter is a harmless emitter and pierces monsters without dealing direct contact damage', () => {
    const center: Projectile = {
      skillId: '59',
      x: 200,
      y: 200,
      vx: 0,
      vy: 0,
      damage: 100,
      ttl: 20,
      fromPlayer: true,
      missileType: 'blizzardcenter',
      subMissileIdx: 0,
    }

    const monster = [{ index: 0, x: 200, y: 200, radius: 25, alive: true }]
    const outcome = tickProjectiles([center], monster, { overlap: () => 0 })

    // Center must not trigger hits or take damage on the monster
    expect(outcome.hits.length).toBe(0)
    expect(outcome.alive.some(p => p.missileType === 'blizzardcenter')).toBe(true)
  })

  it('7. Falling shard altitude descends vertically from 120 px to 0 over 9 ticks and detonates on ground impact', () => {
    let shard: Projectile = {
      skillId: '59',
      x: 150,
      y: 150,
      vx: 0,
      vy: 0,
      altitude: 120,
      damage: 80,
      ttl: 9,
      fromPlayer: true,
      missileType: 'blizzard1',
    }

    const openTerrain = { overlap: () => 0 }

    for (let tick = 1; tick <= 9; tick += 1) {
      const outcome = tickProjectiles([shard], [], openTerrain)
      shard = outcome.alive.find(p => p.missileType === 'blizzard1')!
      if (tick < 9) {
        expect(shard).toBeDefined()
        expect(shard.ttl).toBe(9 - tick)
        // Decrements by 120 / 9 px per tick
        const expectedAltitude = 120 - tick * (120 / 9)
        expect(shard.altitude).toBeCloseTo(expectedAltitude, 0.1)
      } else {
        // At tick 9, ttl reached 0
        expect(shard.ttl).toBe(0)
      }
    }

    // Next tick: shard with ttl 0 expires and detonates ground impact explosion
    const impactOutcome = tickProjectiles([shard], [], openTerrain)
    expect(impactOutcome.expired).toBe(1)
    expect(impactOutcome.spawnedProjectiles).toBeDefined()
    expect(impactOutcome.spawnedProjectiles!.length).toBe(1)

    const exp = impactOutcome.spawnedProjectiles![0]!
    expect(exp.missileType).toBe('blizzardexplode1')
    expect(exp.damage).toBe(80)
    expect(exp.ttl).toBe(6) // 1.13c Range = 6
    expect(exp.statusEffect).toBe('chill')
    expect(exp.statusDuration).toBe(100) // 100 ticks chill length
  })

  it('8. Wall collision halts descending shard and spawns impact explosion', () => {
    const shard: Projectile = {
      skillId: '59',
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      altitude: 80,
      damage: 90,
      ttl: 7,
      fromPlayer: true,
      missileType: 'blizzard2',
    }

    // Solid wall at (100, 100)
    const wallTerrain = { overlap: () => 1 }
    const outcome = tickProjectiles([shard], [], wallTerrain)

    expect(outcome.wallHits).toBe(1)
    expect(outcome.alive.some(p => p.missileType === 'blizzard2')).toBe(false)
    expect(outcome.spawnedProjectiles).toBeDefined()
    expect(outcome.spawnedProjectiles!.length).toBe(1)

    const exp = outcome.spawnedProjectiles![0]!
    expect(exp.missileType).toBe('blizzardexplode2')
    expect(exp.ttl).toBe(6)
  })

  it('9. Direct monster hit while falling deals cold damage and chill without immunity window (NextDelay = 0)', () => {
    const shard1: Projectile = {
      skillId: '59',
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      damage: 100,
      ttl: 5,
      fromPlayer: true,
      missileType: 'blizzard1',
    }
    const shard2: Projectile = {
      skillId: '59',
      x: 102,
      y: 100,
      vx: 0,
      vy: 0,
      damage: 100,
      ttl: 5,
      fromPlayer: true,
      missileType: 'blizzard2',
    }

    const dummyMonster = [{ index: 1, x: 101, y: 100, radius: 12, alive: true }]
    const outcome = tickProjectiles([shard1, shard2], dummyMonster, { overlap: () => 0 })

    // NextDelay = 0 allows both shards to hit the monster in the same frame
    expect(outcome.hits.length).toBe(2)
    for (const hit of outcome.hits) {
      expect(hit.targetIndex).toBe(1)
      expect(hit.damage).toBe(100)
      expect(hit.statusEffect).toBe('chill')
      expect(hit.statusDuration).toBe(100)
    }

    // Both shards must trigger explosion
    expect(outcome.spawnedProjectiles!.length).toBe(2)
    expect(outcome.spawnedProjectiles!.some(p => p.missileType === 'blizzardexplode1')).toBe(true)
    expect(outcome.spawnedProjectiles!.some(p => p.missileType === 'blizzardexplode2')).toBe(true)
  })

  it('10. calculateBlizzardDamage and calculateBlizzardSynergyMultiplier evaluate 5-band formulas & synergies', () => {
    // slvl 1: 45 - 75
    const d1 = calculateBlizzardDamage(1)
    expect(d1.min).toBe(45)
    expect(d1.max).toBe(75)

    // slvl 10: 210 - 249
    const d10 = calculateBlizzardDamage(10)
    expect(d10.min).toBe(210)
    expect(d10.max).toBe(249)

    // slvl 20: 570 - 619
    const d20 = calculateBlizzardDamage(20)
    expect(d20.min).toBe(570)
    expect(d20.max).toBe(619)

    // slvl 30: 1120 - 1179
    const d30 = calculateBlizzardDamage(30)
    expect(d30.min).toBe(1120)
    expect(d30.max).toBe(1179)

    // Synergy: 20 points in Ice Bolt (+100% = 2.0x)
    const syn20 = calculateBlizzardSynergyMultiplier({ iceBolt: 20 })
    expect(syn20).toBe(2.0)
    const d20Syn = calculateBlizzardDamage(20, { iceBolt: 20 })
    expect(d20Syn.min).toBe(1140) // 570 * 2.0
    expect(d20Syn.max).toBe(1238) // 619 * 2.0

    // Full synergies: 20 in Ice Bolt, 20 in Ice Blast, 20 in Glacial Spike (+300% = 4.0x)
    const syn60 = calculateBlizzardSynergyMultiplier({ iceBolt: 20, iceBlast: 20, glacialSpike: 20 })
    expect(syn60).toBe(4.0)
    const d20Full = calculateBlizzardDamage(20, { iceBolt: 20, iceBlast: 20, glacialSpike: 20 })
    expect(d20Full.min).toBe(2280) // 570 * 4.0
    expect(d20Full.max).toBe(2476) // 619 * 4.0
  })
})
