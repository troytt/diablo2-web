/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #041: Inferno (SOR)
 * Gitea Tracking Issue: #195
 *
 * 7-Dimensional Verification Scope:
 * Dimension 1: Static data table parsing (Skills.txt row 41, Missiles.txt IDs 60 infernoflame1, 61 infernoflame2).
 * Dimension 2: Pre-baked visual assets & atlas metadata on disk (PNG/JSON exist with non-zero size).
 * Dimension 3: Kinematics & stream cone geometry (calculateInfernoRange, calculateInfernoRangePx, stream velocity & TTL).
 * Dimension 4: Collision detection & continuous stream ticks (hitTargets.clear() every frame, pierce persistence).
 * Dimension 5: Damage scaling & synergies (5-band math: 32-64 base, Warmth +13%/lvl, 256ths precision).
 * Dimension 6: Mana progression & continuous drain rules (6 starting mana, 144-220 256ths/frame drain, 0 cooldown).
 * Dimension 7: Invariants & integration (BATCH1_SKILLS length === 38, zero runtime MPQ queries, routing).
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-041-inferno.ts'
import {
  parseMissilesTxt,
  CANONICAL_113C_MISSILES,
  BATCH1_SKILLS,
  calculateInfernoDamage,
  calculateInfernoRange,
  calculateInfernoRangePx,
  calculateInfernoContinuousMana256,
  calculateSkillDamage,
  getSkillManaCost,
  getSkillCooldownTicks,
  tickProjectiles,
  type Projectile,
} from '../../../src/server/skills/skills.ts'
import {
  INFERNOFLAME1_META,
  INFERNOFLAME2_META,
} from '../../../src/client/render/missiles-meta.ts'
import { FIRE_CAST_2_META } from '../../../src/client/render/overlays-meta.ts'
import { castSkill } from '../../../src/server/skills/skills.ts'

describe('[Skill #041] Inferno (SOR) — 1.13c Parity (Issue #195)', () => {
  // ==========================================================================
  // Dimension 1: Static Data Table Parsing
  // ==========================================================================
  it('Dimension 1: parses authentic 1.13c Skills.txt & Missiles.txt definitions', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(41)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(41)
    expect(skillModule.name).toBe('Inferno')
    expect(skillModule.charClass).toBe('sor')

    const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
    const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
    const map = parseMissilesTxt(missilesTxtContent)

    // infernoflame1 (ID 60)
    const inf1 = map.get('infernoflame1')
    expect(inf1).toBeDefined()
    expect(inf1!.id).toBe(60)
    expect(inf1!.vel).toBe(12)
    expect(inf1!.range).toBe(30)
    expect(inf1!.animLen).toBe(15)
    expect(inf1!.animSpeed).toBe(16)
    expect(inf1!.trans).toBe(1)
    expect(inf1!.light).toBe(5)

    // infernoflame2 (ID 61)
    const inf2 = map.get('infernoflame2')
    expect(inf2).toBeDefined()
    expect(inf2!.id).toBe(61)
    expect(inf2!.vel).toBe(12)
    expect(inf2!.range).toBe(30)
    expect(inf2!.animLen).toBe(15)
    expect(inf2!.animSpeed).toBe(16)
    expect(inf2!.trans).toBe(1)
    expect(inf2!.light).toBe(5)
  })

  // ==========================================================================
  // Dimension 2: Pre-baked Visual Assets & Atlas Metadata
  // ==========================================================================
  it('Dimension 2: pre-baked visual assets and metadata exist on disk with non-zero byte size', () => {
    const flame1Png = path.resolve(__dirname, '../../../public/missiles/infernoflame1.png')
    const flame2Png = path.resolve(__dirname, '../../../public/missiles/infernoflame2.png')
    const castOverlayPng = path.resolve(__dirname, '../../../public/overlays/fire_cast_2.png')

    expect(fs.existsSync(flame1Png)).toBe(true)
    expect(fs.statSync(flame1Png).size).toBeGreaterThan(0)

    expect(fs.existsSync(flame2Png)).toBe(true)
    expect(fs.statSync(flame2Png).size).toBeGreaterThan(0)

    expect(fs.existsSync(castOverlayPng)).toBe(true)
    expect(fs.statSync(castOverlayPng).size).toBeGreaterThan(0)

    // Atlas metadata
    expect(INFERNOFLAME1_META).toBeDefined()
    expect(INFERNOFLAME1_META.name).toBe('infernoflame1')
    expect(INFERNOFLAME1_META.framesPerDirection).toBe(15)

    expect(INFERNOFLAME2_META).toBeDefined()
    expect(INFERNOFLAME2_META.name).toBe('infernoflame2')
    expect(INFERNOFLAME2_META.framesPerDirection).toBe(15)

    expect(FIRE_CAST_2_META).toBeDefined()
    expect(FIRE_CAST_2_META.name).toBe('fire_cast_2')
  })

  // ==========================================================================
  // Dimension 3: Kinematics & Stream Cone Geometry
  // ==========================================================================
  it('Dimension 3: calculates exact 1.13c stream range progression in yards and screen pixels', () => {
    // Range in yards: (20 + 3 * (slvl - 1)) / 2 = 10 + 1.5 * (slvl - 1)
    expect(calculateInfernoRange(1)).toBe(10)
    expect(calculateInfernoRange(10)).toBe(23.5)
    expect(calculateInfernoRange(20)).toBe(38.5)

    // Range in pixels: yards * 32 (1 yard = 1 subtile = 32 horizontal pixels)
    expect(calculateInfernoRangePx(1)).toBe(320)
    expect(calculateInfernoRangePx(10)).toBe(752)
    expect(calculateInfernoRangePx(20)).toBe(1232)
  })

  // ==========================================================================
  // Dimension 4: Collision Detection & Continuous Stream Ticks
  // ==========================================================================
  it('Dimension 4: damages enemies continuously per frame with piercing stream flame persistence', () => {
    const flame: Projectile = {
      skillId: '41',
      x: 100,
      y: 100,
      vx: 12,
      vy: 0,
      damage: 32,
      ttl: 30,
      fromPlayer: true,
      missileType: 'infernoflame1',
      pierce: true,
      aoeRadius: 16,
    }

    const enemy = {
      index: 1,
      alive: true,
      x: 110,
      y: 100,
      radius: 16,
    }

    const terrain = { overlap: () => 0 }

    // Tick 1: flame advances and damages enemy
    const outcome1 = tickProjectiles([flame], [enemy], terrain)
    expect(outcome1.hits).toHaveLength(1)
    expect(outcome1.hits[0]!.damage).toBe(32)

    // Tick 2: hitTargets resets every frame for infernoflame -> damages enemy again continuously!
    const outcome2 = tickProjectiles(outcome1.alive, [enemy], terrain)
    expect(outcome2.hits).toHaveLength(1)
    expect(outcome2.hits[0]!.damage).toBe(32)

    // Flame is piercing and persists with decremented TTL
    expect(outcome2.alive).toHaveLength(1)
    expect(outcome2.alive[0]!.ttl).toBe(28)
  })

  // ==========================================================================
  // Dimension 5: Damage Scaling & Synergies
  // ==========================================================================
  it('Dimension 5: calculates exact 1.13c 5-band damage progression, 256ths precision, and synergies', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(41)!

    // Level 1: raw 32-64 -> in 256ths: 128 - 256
    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(41, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.minElemDmg256).toBe(128)
    expect(r1.maxElemDmg256).toBe(256)

    const d1 = calculateInfernoDamage(1)
    expect(d1.min256).toBe(128)
    expect(d1.max256).toBe(256)
    expect(d1.perSecMin).toBeCloseTo(12.5, 1)
    expect(d1.perSecMax).toBeCloseTo(25.0, 1)

    // Level 10: raw 252-286 -> in 256ths: 1008 - 1144
    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(41, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.minElemDmg256).toBe(1008)
    expect(r10.maxElemDmg256).toBe(1144)

    const d10 = calculateInfernoDamage(10)
    expect(d10.min256).toBe(1008)
    expect(d10.max256).toBe(1144)
    expect(d10.perSecMin).toBeCloseTo(98.43, 1)
    expect(d10.perSecMax).toBeCloseTo(111.71, 1)

    // Level 20: raw 520-564 -> in 256ths: 2080 - 2256
    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(41, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.minElemDmg256).toBe(2080)
    expect(r20.maxElemDmg256).toBe(2256)

    const d20 = calculateInfernoDamage(20)
    expect(d20.min256).toBe(2080)
    expect(d20.max256).toBe(2256)
    expect(d20.perSecMin).toBeCloseTo(203.12, 1)
    expect(d20.perSecMax).toBeCloseTo(220.31, 1)

    // Synergy: Warmth (+13%/lvl)
    // 20 Warmth points = +260% damage (multiplier 3.6)
    const d20Syn = calculateInfernoDamage(20, { warmth: 20 })
    expect(d20Syn.min256).toBe(Math.floor(2080 * 3.6))
    expect(d20Syn.max256).toBe(Math.floor(2256 * 3.6))

    // Hard point synergy rule: soft points (+allskills / charges) provide 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(41, 20)
    statsSoftOnly.addStat('item_allskills', 20)
    statsSoftOnly.setChargedSkillLevel(37, 33)
    const evalSoft = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: statsSoftOnly })
    expect(evalSoft.synergyBonusPct).toBe(0)
  })

  // ==========================================================================
  // Dimension 6: Mana Progression & Continuous Drain Rules
  // ==========================================================================
  it('Dimension 6: verifies authentic starting mana, continuous drain in 256ths, and 0 cooldown', () => {
    // Starting cast mana: strictly 6
    expect(getSkillManaCost(41, 1)).toBe(6)
    expect(getSkillManaCost(41, 10)).toBe(6)
    expect(getSkillManaCost(41, 20)).toBe(6)

    // Continuous mana drain per frame in 256ths: (36 + (slvl - 1)) * 4
    expect(calculateInfernoContinuousMana256(1)).toBe(144)
    expect(calculateInfernoContinuousMana256(10)).toBe(180)
    expect(calculateInfernoContinuousMana256(20)).toBe(220)

    // Cooldown / Cast Delay: strictly 0 frames (streaming skill)
    expect(getSkillCooldownTicks(41)).toBe(0)
  })

  it('Dimension 6: verifies continuous channeled mana drain and channel cessation upon depletion in castSkill', () => {
    const player = {
      x: 100,
      y: 100,
      facing: 0,
      cooldown: 0,
      mana: 10,
      maxMana: 100,
      infernoChanneling: false,
      infernoManaRemainder256: 0,
    }
    const engine: any = {
      world: {
        player,
        events: [],
      },
      projectiles: [],
      spawnOverlay: () => {},
      metrics: { casts: 0 },
    }
    const status = { textContent: '' } as any

    const context = {
      engine,
      runtime: {} as any,
      hudManager: null,
      status,
    }

    // Call 1: initial cast costs 6 mana
    const cast1 = castSkill(41, 200, 100, context)
    expect(cast1).toBe(true)
    expect(player.mana).toBe(4) // 10 - 6 = 4
    expect(player.infernoChanneling).toBe(true)
    expect(player.infernoManaRemainder256).toBe(0)

    // Call 2: frame 1 of continuous channeling (slvl 1 drain = 144/256)
    // Accumulator = 0 + 144 = 144, wholeMana = 0, mana remains 4
    const cast2 = castSkill(41, 200, 100, context)
    expect(cast2).toBe(true)
    expect(player.mana).toBe(4)
    expect(player.infernoManaRemainder256).toBe(144)

    // Call 3: frame 2 of continuous channeling (slvl 1 drain = 144/256)
    // Accumulator = 144 + 144 = 288, wholeMana = 1, remainder = 32, mana becomes 3
    const cast3 = castSkill(41, 200, 100, context)
    expect(cast3).toBe(true)
    expect(player.mana).toBe(3)
    expect(player.infernoManaRemainder256).toBe(32)

    // Drain down to 0 mana
    player.mana = 0
    player.infernoManaRemainder256 = 0
    // Calling while mana is 0 should stop channeling and return false
    const castEmpty = castSkill(41, 200, 100, context)
    expect(castEmpty).toBe(false)
    expect(status.textContent).toBe('法力不足！')
    expect(player.infernoChanneling).toBe(false)
  })

  // ==========================================================================
  // Dimension 7: Invariants & Integration
  // ==========================================================================
  it('Dimension 7: enforces BATCH1_SKILLS length invariant = 38, routing, and WorldArena execution', async () => {
    // STRICT INVARIANT: BATCH1_SKILLS length must remain exactly 38
    expect(Object.keys(BATCH1_SKILLS)).toHaveLength(38)

    // Routing in calculateSkillDamage
    const dmg1 = calculateSkillDamage(41, 1)
    expect(dmg1.min).toBe(32)
    expect(dmg1.max).toBe(64)

    const dmg10 = calculateSkillDamage('41', 10)
    expect(dmg10.min).toBe(252)
    expect(dmg10.max).toBe(286)

    const dmg20 = calculateSkillDamage('inferno', 20)
    expect(dmg20.min).toBe(520)
    expect(dmg20.max).toBe(564)

    // Canonical missiles
    expect(CANONICAL_113C_MISSILES.infernoflame1).toBeDefined()
    expect(CANONICAL_113C_MISSILES.infernoflame2).toBeDefined()

    // WorldArena Execution
    const registry = await getSharedDataRegistry()
    const arena = new WorldArena({
      registry,
      classCode: 'sor',
      skillId: 41,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(41)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })
})
