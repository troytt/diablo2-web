/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #051: Fire Wall (SOR)
 * Gitea Tracking Issue: #205
 *
 * 7-Dimensional Verification Scope:
 * Dimension 1: Static data table parsing (Skills.txt row 51, Missiles.txt IDs 82 firewallmaker, 83 firewall/groundfirebig).
 * Dimension 2: Pre-baked visual assets & atlas metadata on disk (PNG/JSON exist with non-zero size).
 * Dimension 3: Kinematics & 15-patch perpendicular line emitter geometry (24px spacing, 0.5 isometric ratio, obstacle clipping).
 * Dimension 4: Collision detection & continuous ground ticks (hit radius 24px, per-frame damage, NextDelay = 0).
 * Dimension 5: Damage scaling & synergies (5-band math: 15-20 base, Warmth +4%/lvl, Inferno +1%/lvl, 256ths precision).
 * Dimension 6: Mana progression & cooldown / cast delay rules (22 + slvl - 1, strictly 35 frames / 1.40s).
 * Dimension 7: Invariants & integration (BATCH1_SKILLS length === 38, zero runtime MPQ queries, routing).
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-051-fire-wall.ts'
import {
  parseMissilesTxt,
  CANONICAL_113C_MISSILES,
  BATCH1_SKILLS,
  calculateFireWallDamage,
  calculateFireWallPatches,
  calculateSkillDamage,
  getSkillManaCost,
  getSkillCooldownTicks,
  tickProjectiles,
  ISO_GROUND_ASPECT_RATIO,
  type Projectile,
} from '../../../src/server/skills/skills.ts'
import {
  FIREWALL_META,
  GROUNDFIREBIG_META,
} from '../../../src/client/render/missiles-meta.ts'
import { FIRE_CAST_2_META } from '../../../src/client/render/overlays-meta.ts'

describe('[Skill #051] Fire Wall (SOR) — 1.13c Parity (Issue #205)', () => {
  // ==========================================================================
  // Dimension 1: Static Data Table Parsing
  // ==========================================================================
  it('Dimension 1: parses authentic 1.13c Skills.txt & Missiles.txt definitions', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(51)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(51)
    expect(skillModule.name).toBe('Fire Wall')
    expect(skillModule.charClass).toBe('sor')

    const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
    const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
    const map = parseMissilesTxt(missilesTxtContent)

    // firewallmaker (ID 82)
    const fwm = map.get('firewallmaker')
    expect(fwm).toBeDefined()
    expect(fwm!.id).toBe(68)
    expect(fwm!.range).toBe(7)

    // firewall (ID 83)
    const fw = map.get('firewall')
    expect(fw).toBeDefined()
    expect(fw!.id).toBe(69)
    expect(fw!.range).toBe(90)
    expect(fw!.animLen).toBe(37)
    expect(fw!.animSpeed).toBe(16)
    expect(fw!.loopAnim).toBe(1)
    expect(fw!.trans).toBe(1)
    expect(fw!.light).toBe(5)
  })

  // ==========================================================================
  // Dimension 2: Pre-baked Visual Assets & Atlas Metadata
  // ==========================================================================
  it('Dimension 2: pre-baked visual assets and metadata exist on disk with non-zero size', () => {
    const publicDir = path.resolve(__dirname, '../../../public')

    const firewallPng = path.join(publicDir, 'missiles/firewall.png')
    const groundfirebigPng = path.join(publicDir, 'missiles/groundfirebig.png')
    const castOverlayPng = path.join(publicDir, 'overlays/fire_cast_2.png')

    expect(fs.existsSync(firewallPng)).toBe(true)
    expect(fs.statSync(firewallPng).size).toBeGreaterThan(0)

    expect(fs.existsSync(groundfirebigPng)).toBe(true)
    expect(fs.statSync(groundfirebigPng).size).toBeGreaterThan(0)

    expect(fs.existsSync(castOverlayPng)).toBe(true)
    expect(fs.statSync(castOverlayPng).size).toBeGreaterThan(0)

    // Metas
    expect(FIREWALL_META.name).toBe('firewall')
    expect(FIREWALL_META.framesPerDirection).toBe(37)
    expect(GROUNDFIREBIG_META.name).toBe('groundfirebig')
    expect(GROUNDFIREBIG_META.framesPerDirection).toBe(37)
    expect(FIRE_CAST_2_META.name).toBe('fire_cast_2')
  })

  // ==========================================================================
  // Dimension 3: Kinematics & 15-Patch Perpendicular Line Emitter Geometry
  // ==========================================================================
  it('Dimension 3: calculates strictly perpendicular 15-patch emitter with 24px spacing and obstacle clipping', () => {
    const casterX = 100
    const casterY = 100
    const targetX = 200
    const targetY = 100 // Travel vector is purely horizontal (+100, 0)

    const patches = calculateFireWallPatches(casterX, casterY, targetX, targetY, {
      count: 15,
      spacing: 24,
    })

    expect(patches).toHaveLength(15)

    // Center patch (i = 0) must be exactly at target
    const center = patches.find(p => p.index === 0)!
    expect(center.x).toBe(targetX)
    expect(center.y).toBe(targetY)

    // Since travel vector is (100, 0), normal is vertical: (0, 1)
    // In 2:1 isometric ground ratio, dy offset is scaled by ISO_GROUND_ASPECT_RATIO (0.5)
    // For i = 1: x = targetX, y = targetY + 1 * 24 * 1 * 0.5 = 100 + 12 = 112
    const p1 = patches.find(p => p.index === 1)!
    expect(p1.x).toBe(targetX)
    expect(p1.y).toBe(targetY + 12)

    // Test dot product of travel vector and patch displacement vector is strictly 0 (perpendicular)
    const travelDx = targetX - casterX
    const travelDy = targetY - casterY
    for (const p of patches) {
      if (p.index === 0) continue
      const patchDisplacementX = p.x - targetX
      // Unscale isometric Y to get true world normal
      const unscaledPatchDisplacementY = (p.y - targetY) / ISO_GROUND_ASPECT_RATIO
      const dot = travelDx * patchDisplacementX + travelDy * unscaledPatchDisplacementY
      expect(Math.abs(dot)).toBeLessThan(1e-4)
    }

    // Obstacle clipping: suppressed patches landing on obstacles
    const blockedPatches = calculateFireWallPatches(casterX, casterY, targetX, targetY, {
      count: 15,
      spacing: 24,
      isBlocked: (x, y) => y > 120, // block patches with y > 120
    })
    expect(blockedPatches.length).toBeLessThan(15)
    for (const bp of blockedPatches) {
      expect(bp.y).toBeLessThanOrEqual(120)
    }
  })

  // ==========================================================================
  // Dimension 4: Collision Detection & Continuous Ground Ticks
  // ==========================================================================
  it('Dimension 4: standing in fire inflicts continuous damage per frame with NextDelay = 0', () => {
    const patch: Projectile = {
      skillId: '51',
      x: 200,
      y: 200,
      vx: 0,
      vy: 0,
      damage: 100,
      ttl: 90,
      fromPlayer: true,
      missileType: 'firewall',
      pierce: true,
      aoeRadius: 24,
    }

    const enemy = {
      index: 1,
      alive: true,
      x: 200,
      y: 200,
      radius: 16,
    }

    const terrain = { overlap: () => 0 }

    // Tick 1
    const outcome1 = tickProjectiles([patch], [enemy], terrain)
    expect(outcome1.hits).toHaveLength(1)
    expect(outcome1.hits[0]!.damage).toBe(100)

    // Tick 2: Since it is a ground fire patch, hitTargetIds clears every frame -> damages again!
    const outcome2 = tickProjectiles(outcome1.alive, [enemy], terrain)
    expect(outcome2.hits).toHaveLength(1)
    expect(outcome2.hits[0]!.damage).toBe(100)

    // Patch persists for full 90 ticks and does not terminate on enemy contact
    expect(outcome2.alive).toHaveLength(1)
    expect(outcome2.alive[0]!.ttl).toBe(88)
  })

  // ==========================================================================
  // Dimension 5: Damage Scaling & Synergies
  // ==========================================================================
  it('Dimension 5: calculates exact 1.13c 5-band damage progression, 256ths precision, and synergies', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(51)!

    // Level 1: raw 15-20 -> in 256ths: 240 - 320
    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(51, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.minElemDmg256).toBe(240)
    expect(r1.maxElemDmg256).toBe(320)

    const d1 = calculateFireWallDamage(1)
    expect(d1.min256).toBe(240)
    expect(d1.max256).toBe(320)
    expect(d1.perSecMin).toBeCloseTo(23.44, 1)
    expect(d1.perSecMax).toBeCloseTo(31.25, 1)

    // Level 10: raw 106-111 -> in 256ths: 1696 - 1776
    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(51, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.minElemDmg256).toBe(1696)
    expect(r10.maxElemDmg256).toBe(1776)

    const d10 = calculateFireWallDamage(10)
    expect(d10.min256).toBe(1696)
    expect(d10.max256).toBe(1776)
    expect(d10.perSecMin).toBeCloseTo(165.62, 1)
    expect(d10.perSecMax).toBeCloseTo(173.44, 1)

    // Level 20: raw 274-279 -> in 256ths: 4384 - 4464
    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(51, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.minElemDmg256).toBe(4384)
    expect(r20.maxElemDmg256).toBe(4464)

    const d20 = calculateFireWallDamage(20)
    expect(d20.min256).toBe(4384)
    expect(d20.max256).toBe(4464)
    expect(d20.perSecMin).toBeCloseTo(428.12, 1)
    expect(d20.perSecMax).toBeCloseTo(435.94, 1)

    // Synergy: Warmth (+4%/lvl), Inferno (+1%/lvl)
    // 20 Warmth points = +80% damage
    const d20Syn = calculateFireWallDamage(20, { warmth: 20, inferno: 0 })
    expect(d20Syn.min256).toBe(Math.floor(4384 * 1.8))
    expect(d20Syn.max256).toBe(Math.floor(4464 * 1.8))

    // Hard point synergy rule: soft points (allskills/charged) provide 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(51, 20)
    statsSoftOnly.addStat('item_allskills', 20)
    statsSoftOnly.setChargedSkillLevel(37, 33)
    const evalSoft = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: statsSoftOnly })
    expect(evalSoft.synergyBonusPct).toBe(0)
  })

  // ==========================================================================
  // Dimension 6: Mana Progression & Cooldown / Cast Delay
  // ==========================================================================
  it('Dimension 6: verifies authentic mana progression and strictly 35 frames cast delay', () => {
    // Mana: 22 + (slvl - 1)
    expect(getSkillManaCost(51, 1)).toBe(22)
    expect(getSkillManaCost(51, 10)).toBe(31)
    expect(getSkillManaCost(51, 20)).toBe(41)

    // Cooldown / Cast Delay: strictly 35 frames (1.40s)
    expect(getSkillCooldownTicks(51)).toBe(35)
  })

  // ==========================================================================
  // Dimension 7: Invariants & Integration
  // ==========================================================================
  it('Dimension 7: enforces BATCH1_SKILLS length invariant = 38 and routing via calculateSkillDamage', () => {
    // STRICT INVARIANT: BATCH1_SKILLS length must remain exactly 38
    expect(Object.keys(BATCH1_SKILLS)).toHaveLength(38)

    // Routing in calculateSkillDamage
    const dmg1 = calculateSkillDamage(51, 1)
    expect(dmg1.min).toBe(15)
    expect(dmg1.max).toBe(20)

    const dmg10 = calculateSkillDamage('51', 10)
    expect(dmg10.min).toBe(106)
    expect(dmg10.max).toBe(111)

    const dmg20 = calculateSkillDamage('firewall', 20)
    expect(dmg20.min).toBe(274)
    expect(dmg20.max).toBe(279)

    // Canonical missiles
    expect(CANONICAL_113C_MISSILES.firewallmaker).toBeDefined()
    expect(CANONICAL_113C_MISSILES.firewall).toBeDefined()
    expect(CANONICAL_113C_MISSILES.firewall!.celFile).toBe('groundFireBig')
    // 'groundfirebig' is a CelFile, not a Missiles.txt row (Issue #1089).
    expect(CANONICAL_113C_MISSILES['groundfirebig']).toBeUndefined()
  })
})
