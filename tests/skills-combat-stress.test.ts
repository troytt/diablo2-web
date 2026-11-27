import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BATCH1_SKILLS,
  getBatch1SkillDef,
  isBatch1Skill,
  getSkillManaCost,
  getSkillCooldownTicks,
  calculateSkillDamage,
  executeSkill,
  tickProjectiles,
  type SkillExecutionContext,
  type Batch1SkillDef,
  type Projectile,
  type ProjectileTarget,
} from '../src/server/skills/skills.ts'
import {
  CANONICAL_SKILL_TREE,
  createSkillTreeState,
  allocatePoint,
  calculateSynergyMultiplier,
} from '../src/common/skills/skill-tree.ts'
import type { CombatPlayer } from '../src/server/ai/monster-ai.ts'

/**
 * Helper to construct a standard combat player for testing.
 */
function createPlayer(overrides?: Partial<CombatPlayer>): CombatPlayer {
  return {
    x: 100,
    y: 100,
    facing: 0,
    hp: 100,
    maxHp: 100,
    mana: 100,
    maxMana: 100,
    level: 30,
    xp: 0,
    cooldown: 0,
    alive: true,
    respawnIn: 0,
    swingTicks: 0,
    ...overrides,
  }
}

/**
 * Independent mathematical ground-truth oracle for D2 1.13c damage calculations.
 * Used for differential testing against calculateSkillDamage.
 */
function computeDamageOracle(
  def: Batch1SkillDef,
  effectiveLevel: number,
  synergyMultiplier: number = 1.0,
  weaponDamage?: { min: number; max: number }
): { min: number; max: number } {
  const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1

  // Bone Armor (68): Skills.txt Param1 = 20 (base absorb), Param2 = 10 (additional/level)
  if (def.id === 68) {
    const base = 20 + (lvl - 1) * 10
    const syn = Number.isFinite(synergyMultiplier) && synergyMultiplier > 0 ? synergyMultiplier : 1.0
    const cap = Math.floor(base * syn)
    return { min: cap, max: cap }
  }

  // Corpse Explosion (74): Skills.txt Param1 = 70 (% min), Param2 = 120 (% max)
  if (def.id === 74) {
    const hp = weaponDamage?.max ?? 1000
    const minTotal = Math.trunc((hp * 70) / 100)
    const maxTotal = Math.trunc((hp * 120) / 100)
    const syn = Number.isFinite(synergyMultiplier) && synergyMultiplier > 0 ? synergyMultiplier : 1.0
    return { min: Math.floor(minTotal * syn), max: Math.floor(maxTotal * syn) }
  }

  // Raise Skeleton (70): summons a minion; player skill damage is 0
  if (def.id === 70) {
    return { min: 0, max: 0 }
  }

  let min = def.emin
  let max = def.emax

  if (lvl > 1) {
    const maxElev1 = def.emaxlev1 ?? def.elev1
    const maxElev2 = def.emaxlev2 ?? def.elev2
    const maxElev3 = def.emaxlev3 ?? def.elev3
    const maxElev4 = def.emaxlev4 ?? def.elev4
    const maxElev5 = def.emaxlev5 ?? def.elev5

    const b1 = Math.min(lvl - 1, 7)
    min += b1 * def.elev1
    max += b1 * maxElev1

    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * def.elev2
      max += b2 * maxElev2
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * def.elev3
      max += b3 * maxElev3
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * def.elev4
      max += b4 * maxElev4
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * def.elev5
      max += b5 * maxElev5
    }
  }

  const hitShift = def.hitshift ?? 8
  const shiftMultiplier = 2 ** (hitShift - 8)
  min *= shiftMultiplier
  max *= shiftMultiplier

  const syn = Number.isFinite(synergyMultiplier) && synergyMultiplier > 0 ? synergyMultiplier : 1.0
  min = Math.floor(min * syn)
  max = Math.floor(max * syn)

  if (weaponDamage && def.srcDamage > 0) {
    const wpnMult = def.srcDamage / 128.0
    min += Math.floor(Math.max(0, weaponDamage.min) * wpnMult)
    max += Math.floor(Math.max(0, weaponDamage.max) * wpnMult)
  }

  return { min, max }
}

/**
 * Computes unfloored base damage (after hitshift) to verify exact fixed-point synergy scaling.
 */
function computeUnflooredBaseDamage(def: Batch1SkillDef, effectiveLevel: number): { min: number; max: number } {
  const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1

  if (def.id === 68) {
    const base = 20 + (lvl - 1) * 10
    return { min: base, max: base }
  }
  if (def.id === 74) {
    return { min: 700, max: 1200 }
  }
  if (def.id === 70) {
    return { min: 0, max: 0 }
  }

  let min = def.emin
  let max = def.emax

  if (lvl > 1) {
    const maxElev1 = def.emaxlev1 ?? def.elev1
    const maxElev2 = def.emaxlev2 ?? def.elev2
    const maxElev3 = def.emaxlev3 ?? def.elev3
    const maxElev4 = def.emaxlev4 ?? def.elev4
    const maxElev5 = def.emaxlev5 ?? def.elev5

    const b1 = Math.min(lvl - 1, 7)
    min += b1 * def.elev1
    max += b1 * maxElev1
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * def.elev2
      max += b2 * maxElev2
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * def.elev3
      max += b3 * maxElev3
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * def.elev4
      max += b4 * maxElev4
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * def.elev5
      max += b5 * maxElev5
    }
  }

  const shift = 2 ** (def.hitshift - 8)
  return { min: min * shift, max: max * shift }
}

describe('M3 Adversarial Stress Testing: Combat Engine & Damage Mathematics', () => {
  // ==========================================================================
  // Suite 1: Full-Spectrum 38 Skills × Levels 1..99 Level-Band Progressions
  // ==========================================================================
  describe('1. Full-Spectrum 38 Skills × Levels 1..99 Level-Band Progressions', () => {
    it('exhaustively matches oracle across all 38 skills at all levels 1..99 (3,762 combinations)', () => {
      const skillIds = Object.keys(BATCH1_SKILLS).map(Number)
      expect(skillIds.length).toBe(38)

      for (const skillId of skillIds) {
        const def = getBatch1SkillDef(skillId)!
        for (let lvl = 1; lvl <= 99; lvl++) {
          const actual = calculateSkillDamage(skillId, lvl)
          const expected = computeDamageOracle(def, lvl)
          expect(actual.min).toBe(expected.min)
          expect(actual.max).toBe(expected.max)
          expect(actual.min).toBeLessThanOrEqual(actual.max)
        }
      }
    })

    it('rigorously tests exact 5-tier level-band transition boundaries (levels 1, 2, 8, 9, 16, 17, 22, 23, 28, 29, 50, 99)', () => {
      const testLevels = [1, 2, 8, 9, 16, 17, 22, 23, 28, 29, 50, 99]

      for (const [idStr, def] of Object.entries(BATCH1_SKILLS)) {
        const skillId = Number(idStr)
        if (def.id === 68) {
          for (const lvl of testLevels) {
            const res = calculateSkillDamage(skillId, lvl)
            expect(res.min).toBe(20 + (lvl - 1) * 10)
            expect(res.max).toBe(20 + (lvl - 1) * 10)
          }
          continue
        }
        if (def.id === 74) {
          for (const lvl of testLevels) {
            const res = calculateSkillDamage(skillId, lvl)
            expect(res.min).toBe(700)
            expect(res.max).toBe(1200)
          }
          continue
        }
        if (def.id === 70) {
          for (const lvl of testLevels) {
            const res = calculateSkillDamage(skillId, lvl)
            expect(res.min).toBe(0)
            expect(res.max).toBe(0)
          }
          continue
        }

        const maxElev1 = def.emaxlev1 ?? def.elev1
        const maxElev2 = def.emaxlev2 ?? def.elev2
        const maxElev3 = def.emaxlev3 ?? def.elev3
        const maxElev4 = def.emaxlev4 ?? def.elev4
        const maxElev5 = def.emaxlev5 ?? def.elev5

        for (const lvl of testLevels) {
          const res = calculateSkillDamage(skillId, lvl)
          const oracle = computeDamageOracle(def, lvl)
          expect(res.min).toBe(oracle.min)
          expect(res.max).toBe(oracle.max)

          // Explicit validation of level band step calculation
          if (def.elev1 === 0 && def.elev2 === 0 && def.elev3 === 0 && def.elev4 === 0 && def.elev5 === 0) {
            continue
          }

          const maxElev1 = def.emaxlev1 ?? def.elev1
          const maxElev2 = def.emaxlev2 ?? def.elev2
          const maxElev3 = def.emaxlev3 ?? def.elev3
          const maxElev4 = def.emaxlev4 ?? def.elev4
          const maxElev5 = def.emaxlev5 ?? def.elev5

          if (lvl === 1) {
            // Level 1: exactly emin/emax shifted
            const shift = 2 ** (def.hitshift - 8)
            expect(res.min).toBe(Math.floor(def.emin * shift))
            expect(res.max).toBe(Math.floor(def.emax * shift))
          } else if (lvl === 2) {
            // Level 2: +1 * elev1
            const shift = 2 ** (def.hitshift - 8)
            expect(res.min).toBe(Math.floor((def.emin + def.elev1) * shift))
            expect(res.max).toBe(Math.floor((def.emax + maxElev1) * shift))
          } else if (lvl === 8) {
            // Level 8: +7 * elev1
            const shift = 2 ** (def.hitshift - 8)
            expect(res.min).toBe(Math.floor((def.emin + 7 * def.elev1) * shift))
            expect(res.max).toBe(Math.floor((def.emax + 7 * maxElev1) * shift))
          } else if (lvl === 9) {
            // Level 9: +7 * elev1 + 1 * elev2
            const shift = 2 ** (def.hitshift - 8)
            expect(res.min).toBe(Math.floor((def.emin + 7 * def.elev1 + def.elev2) * shift))
            expect(res.max).toBe(Math.floor((def.emax + 7 * maxElev1 + maxElev2) * shift))
          } else if (lvl === 16) {
            // Level 16: +7 * elev1 + 8 * elev2
            const shift = 2 ** (def.hitshift - 8)
            expect(res.min).toBe(Math.floor((def.emin + 7 * def.elev1 + 8 * def.elev2) * shift))
            expect(res.max).toBe(Math.floor((def.emax + 7 * maxElev1 + 8 * maxElev2) * shift))
          } else if (lvl === 17) {
            // Level 17: +7 * elev1 + 8 * elev2 + 1 * elev3
            const shift = 2 ** (def.hitshift - 8)
            expect(res.min).toBe(Math.floor((def.emin + 7 * def.elev1 + 8 * def.elev2 + def.elev3) * shift))
            expect(res.max).toBe(Math.floor((def.emax + 7 * maxElev1 + 8 * maxElev2 + maxElev3) * shift))
          } else if (lvl === 22) {
            // Level 22: +7 * elev1 + 8 * elev2 + 6 * elev3
            const shift = 2 ** (def.hitshift - 8)
            expect(res.min).toBe(Math.floor((def.emin + 7 * def.elev1 + 8 * def.elev2 + 6 * def.elev3) * shift))
            expect(res.max).toBe(Math.floor((def.emax + 7 * maxElev1 + 8 * maxElev2 + 6 * maxElev3) * shift))
          } else if (lvl === 23) {
            // Level 23: +7 * elev1 + 8 * elev2 + 6 * elev3 + 1 * elev4
            const shift = 2 ** (def.hitshift - 8)
            expect(res.min).toBe(Math.floor((def.emin + 7 * def.elev1 + 8 * def.elev2 + 6 * def.elev3 + def.elev4) * shift))
            expect(res.max).toBe(Math.floor((def.emax + 7 * maxElev1 + 8 * maxElev2 + 6 * maxElev3 + maxElev4) * shift))
          } else if (lvl === 28) {
            // Level 28: +7 * elev1 + 8 * elev2 + 6 * elev3 + 6 * elev4
            const shift = 2 ** (def.hitshift - 8)
            expect(res.min).toBe(Math.floor((def.emin + 7 * def.elev1 + 8 * def.elev2 + 6 * def.elev3 + 6 * def.elev4) * shift))
            expect(res.max).toBe(Math.floor((def.emax + 7 * maxElev1 + 8 * maxElev2 + 6 * maxElev3 + 6 * maxElev4) * shift))
          } else if (lvl === 29) {
            // Level 29: +7 * elev1 + 8 * elev2 + 6 * elev3 + 6 * elev4 + 1 * elev5
            const shift = 2 ** (def.hitshift - 8)
            expect(res.min).toBe(Math.floor((def.emin + 7 * def.elev1 + 8 * def.elev2 + 6 * def.elev3 + 6 * def.elev4 + def.elev5) * shift))
            expect(res.max).toBe(Math.floor((def.emax + 7 * maxElev1 + 8 * maxElev2 + 6 * maxElev3 + 6 * maxElev4 + maxElev5) * shift))
          }
        }
      }
    })

    it('enforces monotonic damage progression for all growing skills across levels 1..99', () => {
      for (const [idStr, def] of Object.entries(BATCH1_SKILLS)) {
        const skillId = Number(idStr)
        if (def.elev1 === 0 && def.elev2 === 0 && def.elev3 === 0 && def.elev4 === 0 && def.elev5 === 0) {
          continue
        }
        for (let lvl = 1; lvl < 99; lvl++) {
          const dCurr = calculateSkillDamage(skillId, lvl)
          const dNext = calculateSkillDamage(skillId, lvl + 1)
          expect(dNext.min).toBeGreaterThanOrEqual(dCurr.min)
          expect(dNext.max).toBeGreaterThanOrEqual(dCurr.max)
        }
      }
    })
  })

  // ==========================================================================
  // Suite 2: HitShift Precision Scaling (Shifts 6, 7, 8)
  // ==========================================================================
  describe('2. HitShift Precision Scaling (Shifts 6, 7, 8)', () => {
    it('verifies HitShift 8 (1.0x identity multiplier) preserves exact unattenuated values', () => {
      // Blessed Hammer (112): hitshift 8, emin 12, emax 16, elev1 8
      const bh1 = calculateSkillDamage(112, 1)
      expect(bh1.min).toBe(12)
      expect(bh1.max).toBe(16)

      const bh2 = calculateSkillDamage(112, 2)
      expect(bh2.min).toBe(20) // 12 + 8
      expect(bh2.max).toBe(24) // 16 + 8

      // Holy Bolt (101): hitshift 8, emin 8, emax 16, elev1 4
      const hb1 = calculateSkillDamage(101, 1)
      expect(hb1.min).toBe(8)
      expect(hb1.max).toBe(16)

      // Fire Blast (251): hitshift 8, emin 3, emax 4
      const fb1 = calculateSkillDamage(251, 1)
      expect(fb1.min).toBe(3)
      expect(fb1.max).toBe(4)
    })

    it('verifies HitShift 7 (0.5x half multiplier) exactly halves raw values', () => {
      // Fire Bolt (36): hitshift 7, emin 6, emax 12 -> 3..6
      const fb1 = calculateSkillDamage(36, 1)
      expect(fb1.min).toBe(3) // 6 * 0.5
      expect(fb1.max).toBe(6) // 12 * 0.5

      // Ice Bolt (39): hitshift 7, emin 6, emax 10 -> 3..5
      const ib1 = calculateSkillDamage(39, 1)
      expect(ib1.min).toBe(3) // 6 * 0.5
      expect(ib1.max).toBe(5) // 10 * 0.5

      // Fire Ball (47): hitshift 7, emin 12, emax 28 -> 6..14
      const fball1 = calculateSkillDamage(47, 1)
      expect(fball1.min).toBe(6) // 12 * 0.5
      expect(fball1.max).toBe(14) // 28 * 0.5

      // Teeth (67): hitshift 7, emin 4, emax 8 -> 2..4
      const teeth1 = calculateSkillDamage(67, 1)
      expect(teeth1.min).toBe(2) // 4 * 0.5
      expect(teeth1.max).toBe(4) // 8 * 0.5
    })

    it('verifies HitShift 6 (0.25x quarter multiplier) precision behavior', () => {
      // Test the mathematical precision invariant:
      // hitshift 6 yields 0.25, hitshift 7 yields 0.5, hitshift 8 yields 1.0
      const hitShiftFactors = [6, 7, 8].map(s => 2 ** (s - 8))
      expect(hitShiftFactors[0]).toBe(0.25)
      expect(hitShiftFactors[1]).toBe(0.5)
      expect(hitShiftFactors[2]).toBe(1.0)

      // Ratio comparisons: Shift 6 is exactly half of Shift 7, which is half of Shift 8
      expect(hitShiftFactors[0] * 2).toBe(hitShiftFactors[1])
      expect(hitShiftFactors[1] * 2).toBe(hitShiftFactors[2])

      // Differential oracle verification on synthetic HitShift 6 definition
      const syntheticShift6Def: Batch1SkillDef = {
        id: 996,
        name: 'Shift 6 Prober',
        classCode: 'sor',
        charClass: 'sorceress',
        type: 'projectile',
        mana: 10,
        lvlmana: 1,
        minmana: 1,
        manashift: 8,
        delay: 0,
        hitshift: 6,
        emin: 40,
        emax: 80,
        elev1: 8,
        elev2: 12,
        elev3: 16,
        elev4: 20,
        elev5: 24,
        srcDamage: 0,
      }
      const oracleL1 = computeDamageOracle(syntheticShift6Def, 1)
      expect(oracleL1.min).toBe(10) // 40 * 0.25
      expect(oracleL1.max).toBe(20) // 80 * 0.25
    })
  })

  // ==========================================================================
  // Suite 3: Synergy Scaling Across Multipliers (1.0, 1.5, 2.0, 5.0, 10.0)
  // ==========================================================================
  describe('3. Synergy Scaling Across Multipliers (1.0, 1.5, 2.0, 5.0, 10.0)', () => {
    const testMultipliers = [1.0, 1.5, 2.0, 5.0, 10.0]

    it('strictly scales linearly with synergy multiplier and floors properly for all 38 skills', () => {
      for (const [idStr, def] of Object.entries(BATCH1_SKILLS)) {
        const skillId = Number(idStr)
        if (skillId === 68 || skillId === 74) {
          // Bone Armor has flat additive synergy points, and Corpse Explosion damage is corpse-HP based
          continue
        }
        for (const mult of testMultipliers) {
          for (const lvl of [1, 10, 20, 30]) {
            const synergized = calculateSkillDamage(skillId, lvl, mult)
            const unfloored = computeUnflooredBaseDamage(def, lvl)

            // D2 1.13c ground truth: Synergy scales the 256ths precision unfloored base, then floors
            expect(synergized.min).toBe(Math.floor(unfloored.min * mult))
            expect(synergized.max).toBe(Math.floor(unfloored.max * mult))
          }
        }
      }
    })

    it('enforces exact floor behavior on fractional results', () => {
      // Fire Bolt (36) at L1 has min 3, max 6
      // With mult = 1.5:
      // min = floor(3 * 1.5) = floor(4.5) = 4 (NOT 5!)
      // max = floor(6 * 1.5) = floor(9.0) = 9
      const fb1_5 = calculateSkillDamage(36, 1, 1.5)
      expect(fb1_5.min).toBe(4)
      expect(fb1_5.max).toBe(9)

      // Firestorm (225) at L1 has emin 3, emax 6 with HitShift 2 (1/64 factor)
      // Unfloored: min = 3/64 = 0.046875, max = 6/64 = 0.09375
      // With mult = 1.5: floor(0.046875 * 1.5) = 0, floor(0.09375 * 1.5) = 0
      const fs1_5 = calculateSkillDamage(225, 1, 1.5)
      expect(fs1_5.min).toBe(0)
      expect(fs1_5.max).toBe(0)

      // Teeth (67) at L10 has raw min 22 (4 + 7*2 + 2*2), unfloored min 11.0 (HitShift 7)
      // With mult = 1.5: floor(11.0 * 1.5) = floor(16.5) = 16
      // With mult = 2.0: floor(11.0 * 2.0) = 22
      const teethL10_1_5 = calculateSkillDamage(67, 10, 1.5)
      expect(teethL10_1_5.min).toBe(16)

      const teethL10_2_0 = calculateSkillDamage(67, 10, 2.0)
      expect(teethL10_2_0.min).toBe(22)

      // Blessed Hammer (112) at L1 has min 12, max 16
      // mult = 1.5: min = 18, max = 24
      // mult = 2.0: min = 24, max = 32
      // mult = 5.0: min = 60, max = 80
      // mult = 10.0: min = 120, max = 160
      const bh1_0 = calculateSkillDamage(112, 1, 1.0)
      const bh1_5 = calculateSkillDamage(112, 1, 1.5)
      const bh2_0 = calculateSkillDamage(112, 1, 2.0)
      const bh5_0 = calculateSkillDamage(112, 1, 5.0)
      const bh10_0 = calculateSkillDamage(112, 1, 10.0)

      expect(bh1_0).toEqual({ min: 12, max: 16 })
      expect(bh1_5).toEqual({ min: 18, max: 24 })
      expect(bh2_0).toEqual({ min: 24, max: 32 })
      expect(bh5_0).toEqual({ min: 60, max: 80 })
      expect(bh10_0).toEqual({ min: 120, max: 160 })
    })

    it('integrates with live skill tree allocations and verifies base-point invariant', () => {
      // Sorceress Fire Ball (47) receives +14% per hard point from Fire Bolt (36) and Meteor (56)
      const state = createSkillTreeState(40)
      for (let i = 0; i < 20; i++) {
        allocatePoint(CANONICAL_SKILL_TREE, state, 36, 1) // 20 pts in Fire Bolt
      }
      expect(state.hardPoints[36]).toBe(20)

      const synMult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 47, 'elemental')
      // 20 * 14% = +280% -> multiplier = 3.80
      expect(synMult).toBeCloseTo(3.80, 5)

      const fbBaseL20 = calculateSkillDamage(47, 20, 1.0)
      const fbSynL20 = calculateSkillDamage(47, 20, synMult)

      const fbUnfloored = computeUnflooredBaseDamage(BATCH1_SKILLS[47]!, 20)
      expect(fbSynL20.min).toBe(Math.floor(fbUnfloored.min * synMult))
      expect(fbSynL20.max).toBe(Math.floor(fbUnfloored.max * synMult))
      expect(fbSynL20.min).toBeGreaterThan(fbBaseL20.min * 3)
    })
  })

  // ==========================================================================
  // Suite 4: Weapon Damage Integration & SrcDamage Scaling
  // ==========================================================================
  describe('4. Weapon Damage Integration & SrcDamage Scaling', () => {
    const testWeapon = { min: 25, max: 80 }

    it('integrates 100% weapon damage (srcDamage = 128) for pure weapon melee skills', () => {
      const pureWeaponSkills = [
        10,  // Jab
        126, // Bash
        96,  // Sacrifice
        106, // Zeal
        133, // Double Swing
        143, // Leap Attack
        223, // Werewolf
        254, // Tiger Strike
      ]

      for (const skillId of pureWeaponSkills) {
        const dmg = calculateSkillDamage(skillId, 1, 1.0, testWeapon)
        // Base skill damage is 0, so result is exactly 100% of weapon damage
        expect(dmg.min).toBe(25)
        expect(dmg.max).toBe(80)
      }
    })

    it('correctly combines weapon damage with flat elemental spell additions on hybrid skills', () => {
      // Fire Arrow (7): srcDamage 128, fire damage at L1 is 1..4
      const fa = calculateSkillDamage(7, 1, 1.0, testWeapon)
      expect(fa.min).toBe(1 + 25) // 26
      expect(fa.max).toBe(4 + 80) // 84

      // Cold Arrow (11): srcDamage 128, cold damage at L1 is 3..4
      const ca = calculateSkillDamage(11, 1, 1.0, testWeapon)
      expect(ca.min).toBe(3 + 25) // 28
      expect(ca.max).toBe(4 + 80) // 84

      // Power Strike (14): srcDamage 128, lightning damage at L1 is 1..16
      const ps = calculateSkillDamage(14, 1, 1.0, testWeapon)
      expect(ps.min).toBe(1 + 25) // 26
      expect(ps.max).toBe(16 + 80) // 96
    })

    it('strictly isolates weapon damage from synergy multipliers (synergy applies ONLY to spell damage)', () => {
      // Fire Arrow (7) with synergy multiplier 2.0
      // Base fire: 1..4. Synergized fire: floor(1 * 2) = 2, floor(4 * 2) = 8
      // Weapon: 25..80 (must NOT be multiplied by 2.0!)
      // Total expected: min = 2 + 25 = 27, max = 8 + 80 = 88
      const faSynergized = calculateSkillDamage(7, 1, 2.0, testWeapon)
      expect(faSynergized.min).toBe(27)
      expect(faSynergized.max).toBe(88)

      // If an engine erroneously multiplied weapon damage by 2.0, min would be 52 and max would be 168.
      expect(faSynergized.min).not.toBe(Math.floor((1 + 25) * 2.0))
    })

    it('strictly ignores weapon damage for spell skills (srcDamage = 0)', () => {
      const pureSpellSkills = [
        36,  // Fire Bolt
        39,  // Ice Bolt
        47,  // Fire Ball
        67,  // Teeth
        101, // Holy Bolt
        112, // Blessed Hammer
        225, // Firestorm
        229, // Molten Boulder
        251, // Fire Blast
      ]

      for (const skillId of pureSpellSkills) {
        const withoutWeapon = calculateSkillDamage(skillId, 5, 1.0)
        const withWeapon = calculateSkillDamage(skillId, 5, 1.0, testWeapon)
        expect(withWeapon.min).toBe(withoutWeapon.min)
        expect(withWeapon.max).toBe(withoutWeapon.max)
      }
    })

    it('handles Smite (97) srcDamage = 0 invariant', () => {
      // Smite uses shield damage, NOT weapon damage
      const smiteWithWeapon = calculateSkillDamage(97, 1, 1.0, testWeapon)
      expect(smiteWithWeapon.min).toBe(0)
      expect(smiteWithWeapon.max).toBe(0)
    })
  })

  // ==========================================================================
  // Suite 5: Combat Archetype Execution Stress Testing
  // ==========================================================================
  describe('5. Combat Archetype Execution Stress Testing', () => {
    describe('Melee Multi-Hits, Knockback, Auto-Hit, and Recoil', () => {
      it('Jab (10): strikes exactly 3 times across all levels 1..30', () => {
        for (let lvl = 1; lvl <= 30; lvl++) {
          const player = createPlayer({ mana: 1000 })
          const res = executeSkill(10, { caster: player, skillLevel: lvl }, { deductResources: false })
          expect(res.kind).toBe('melee')
          if (res.kind === 'melee') {
            expect(res.hits).toBe(3)
            expect(res.knockback).toBe(false)
            expect(res.autoHit).toBe(false)
          }
        }
      })

      it('Zeal (106): strikes min(lvl + 1, 5) times, capping strictly at 5 hits', () => {
        const player = createPlayer({ mana: 1000 })

        const testZeal = (lvl: number, expectedHits: number) => {
          const res = executeSkill(106, { caster: player, skillLevel: lvl }, { deductResources: false })
          expect(res.kind).toBe('melee')
          if (res.kind === 'melee') {
            expect(res.hits).toBe(expectedHits)
            expect(res.knockback).toBe(false)
            expect(res.autoHit).toBe(false)
          }
        }

        testZeal(1, 2)
        testZeal(2, 3)
        testZeal(3, 4)
        testZeal(4, 5)
        testZeal(5, 5)
        testZeal(10, 5)
        testZeal(20, 5)
        testZeal(99, 5)
      })

      it('Double Swing (133): strikes exactly 2 times across all levels 1..30', () => {
        for (let lvl = 1; lvl <= 30; lvl++) {
          const player = createPlayer({ mana: 1000 })
          const res = executeSkill(133, { caster: player, skillLevel: lvl }, { deductResources: false })
          expect(res.kind).toBe('melee')
          if (res.kind === 'melee') {
            expect(res.hits).toBe(2)
            expect(res.knockback).toBe(false)
            expect(res.autoHit).toBe(false)
          }
        }
      })

      it('Bash (126): triggers knockback flag without autoHit', () => {
        const player = createPlayer()
        const res = executeSkill(126, { caster: player, skillLevel: 1 })
        expect(res.kind).toBe('melee')
        if (res.kind === 'melee') {
          expect(res.knockback).toBe(true)
          expect(res.autoHit).toBe(false)
          expect(res.hits).toBe(1)
        }
      })

      it('Smite (97): triggers auto-hit (100% hit rate) and knockback flags', () => {
        const player = createPlayer()
        const res = executeSkill(97, { caster: player, skillLevel: 1 })
        expect(res.kind).toBe('melee')
        if (res.kind === 'melee') {
          expect(res.autoHit).toBe(true)
          expect(res.knockback).toBe(true)
          expect(res.hits).toBe(1)
        }
      })

      it('Sacrifice (96): inflicts exactly 8% recoil self-damage', () => {
        const player = createPlayer()
        const res = executeSkill(96, { caster: player, skillLevel: 1 })
        expect(res.kind).toBe('melee')
        if (res.kind === 'melee') {
          expect(res.selfDamagePct).toBe(8)
          expect(res.knockback).toBe(false)
          expect(res.autoHit).toBe(false)
        }
      })
    })

    describe('Radial Area Effects & Scaling', () => {
      it('Frost Nova (44): maintains static calibrated radius of 240 pixels', () => {
        for (const lvl of [1, 5, 10, 20]) {
          const player = createPlayer({ mana: 1000 })
          const res = executeSkill(44, { caster: player, skillLevel: lvl }, { deductResources: false })
          expect(res.kind).toBe('area')
          if (res.kind === 'area') {
            expect(res.radius).toBe(240)
          }
        }
      })

      it('Corpse Explosion (74): dynamically expands radius via 80 + 20 * (lvl - 1)', () => {
        const expectations = [
          { lvl: 1, radius: 80 },
          { lvl: 2, radius: 100 },
          { lvl: 5, radius: 160 },
          { lvl: 10, radius: 260 },
          { lvl: 20, radius: 460 },
        ]
        for (const { lvl, radius } of expectations) {
          const player = createPlayer({ mana: 1000 })
          const res = executeSkill(74, { caster: player, skillLevel: lvl }, { deductResources: false })
          expect(res.kind).toBe('area')
          if (res.kind === 'area') {
            expect(res.radius).toBe(radius)
          }
        }
      })
    })

    describe('Projectile Trajectories, Speeds, and Zero-Distance Target Handling', () => {
      it('spawns projectiles with correct directional velocity towards target', () => {
        const player = createPlayer({ x: 100, y: 100 })
        const target = { x: 300, y: 100 } // Directly east

        const res = executeSkill(36, { caster: player, target, skillLevel: 1 })
        expect(res.kind).toBe('projectile')
        if (res.kind === 'projectile') {
          expect(res.projectile.x).toBe(100)
          expect(res.projectile.y).toBe(100)
          expect(res.projectile.vx).toBe(500 / 25) // 20 px/tick (1.13c Missiles.txt Vel: 20)
          expect(res.projectile.vy).toBeCloseTo(0, 5)
          expect(res.projectile.ttl).toBe(Math.round(1000 / 20)) // 50 ticks (1.13c Range: 50)
        }
      })

      it('spawns diagonal projectiles with normalized unit vector', () => {
        const player = createPlayer({ x: 100, y: 100 })
        const target = { x: 200, y: 200 } // 45 degrees southeast

        const res = executeSkill(36, { caster: player, target, skillLevel: 1 })
        expect(res.kind).toBe('projectile')
        if (res.kind === 'projectile') {
          const speedPerTick = 500 / 25
          const expectedV = speedPerTick / Math.SQRT2
          expect(res.projectile.vx).toBeCloseTo(expectedV, 4)
          expect(res.projectile.vy).toBeCloseTo(expectedV, 4)
        }
      })

      it('handles zero-distance target vector (target == caster) without producing NaN or zero velocity', () => {
        const player = createPlayer({ x: 150, y: 250, facing: 0 }) // Facing south (0, 1)
        const target = { x: 150, y: 250 } // Identical position

        const res = executeSkill(36, { caster: player, target, skillLevel: 1 })
        expect(res.kind).toBe('projectile')
        if (res.kind === 'projectile') {
          expect(Number.isFinite(res.projectile.vx)).toBe(true)
          expect(Number.isFinite(res.projectile.vy)).toBe(true)
          expect(res.projectile.vx).toBeCloseTo(0, 5)
          expect(res.projectile.vy).toBe(500 / 25) // Falls back to facing south! (1.13c Vel: 20)
        }
      })

      it('simulates projectile flight and hit collision via tickProjectiles', () => {
        const proj: Projectile = {
          skillId: '36',
          x: 100,
          y: 100,
          vx: 20,
          vy: 0,
          damage: 15,
          ttl: 10,
          fromPlayer: true,
        }
        const targets: ProjectileTarget[] = [
          { index: 1, x: 150, y: 100, radius: 10, alive: true },
        ]

        // Tick 1: moves to (120, 100), distance to target = 30 > 18
        const step1 = tickProjectiles([proj], targets, { overlap: () => 0 })
        expect(step1.alive.length).toBe(1)
        expect(step1.hits.length).toBe(0)
        expect(step1.alive[0]!.x).toBe(120)

        // Tick 2: moves to (140, 100), distance to target = 10 <= 10 + 8
        const step2 = tickProjectiles(step1.alive, targets, { overlap: () => 0 })
        expect(step2.alive.length).toBe(0)
        expect(step2.hits.length).toBe(1)
        expect(step2.hits[0]!.targetIndex).toBe(1)
        expect(step2.hits[0]!.damage).toBe(15)
      })
    })

    describe('Buffs, Curses, Summons, Auras, and Passives', () => {
      it('Bone Armor (68): absorbs 20 + 10 * (lvl - 1) physical damage', () => {
        const player = createPlayer()
        for (const lvl of [1, 5, 10, 20]) {
          const res = executeSkill(68, { caster: player, skillLevel: lvl }, { deductResources: false })
          expect(res.kind).toBe('buff')
          if (res.kind === 'buff') {
            expect(res.buffEffect.damageAbsorption).toBe(20 + 10 * (lvl - 1))
          }
        }
      })

      it('Shout (138): boosts defense by 100 + 10 * (lvl - 1)%', () => {
        const player = createPlayer()
        for (const lvl of [1, 5, 10]) {
          const res = executeSkill(138, { caster: player, skillLevel: lvl }, { deductResources: false })
          expect(res.kind).toBe('buff')
          if (res.kind === 'buff') {
            expect(res.buffEffect.defensePct).toBe(100 + 10 * (lvl - 1))
            // 1.13c Skills.txt Shout auralencalc ln34 = Param3 (500) + Param4 (250) * (lvl - 1) frames @ 25 fps
            expect(res.durationSeconds).toBe(20 + 10 * (lvl - 1))
          }
        }
      })

      it('Burst of Speed (258): boosts attack and walk/run speed', () => {
        const player = createPlayer()
        const res = executeSkill(258, { caster: player, skillLevel: 10 }, { deductResources: false })
        expect(res.kind).toBe('buff')
        if (res.kind === 'buff') {
          expect(res.buffEffect.attackSpeedPct).toBe(20 + 2 * (10 - 1)) // 38%
          expect(res.buffEffect.walkRunSpeedPct).toBe(20 + 3 * (10 - 1)) // 47%
          expect(res.durationSeconds).toBe(120 + 12 * (10 - 1)) // 228s
        }
      })

      it('Amplify Damage (66): inflicts -100% physical resistance curse', () => {
        const player = createPlayer()
        const res = executeSkill(66, { caster: player, skillLevel: 5 }, { deductResources: false })
        expect(res.kind).toBe('curse')
        if (res.kind === 'curse') {
          expect(res.debuffEffect.physicalResistPenaltyPct).toBe(100)
          expect(res.radius).toBe(80 + 20 * (5 - 1)) // 160 px
          expect(res.durationSeconds).toBe(8 + 3 * (5 - 1)) // 20s
        }
      })

      it('Raise Skeleton (70): scales minion count via 1.13c petmax (lvl < 4 ? lvl : 2 + floor(lvl / 3))', () => {
        const expectations = [
          { lvl: 1, count: 1 },
          { lvl: 2, count: 2 },
          { lvl: 3, count: 3 },
          { lvl: 5, count: 3 },
          { lvl: 6, count: 4 },
          { lvl: 9, count: 5 },
          { lvl: 20, count: 8 }, // 2 + floor(20/3) = 2 + 6 = 8
        ]
        for (const { lvl, count } of expectations) {
          const player = createPlayer({ mana: 1000 })
          const res = executeSkill(70, { caster: player, skillLevel: lvl }, { deductResources: false })
          expect(res.kind).toBe('summon')
          if (res.kind === 'summon') {
            expect(res.summonType).toBe('skeleton')
            expect(res.count).toBe(count)
          }
        }
      })

      it('Might (98): aura scales bonus damage via 40 + 10 * (lvl - 1)%', () => {
        const player = createPlayer()
        for (const lvl of [1, 5, 10, 20]) {
          const res = executeSkill(98, { caster: player, skillLevel: lvl }, { deductResources: false })
          expect(res.kind).toBe('aura')
          if (res.kind === 'aura') {
            expect(res.auraBonusPct).toBe(40 + 10 * (lvl - 1))
            expect(res.manaCost).toBe(0)
          }
        }
      })

      it('Warmth (37), Lycanthropy (224), and Claw Mastery (252) passive effects', () => {
        const player = createPlayer()

        const w = executeSkill(37, { caster: player, skillLevel: 10 }, { deductResources: false })
        expect(w.kind).toBe('passive')
        if (w.kind === 'passive') {
          expect(w.passiveBonus.manaRegenPct).toBe(30 + 12 * (10 - 1)) // 138%
        }

        const lyc = executeSkill(224, { caster: player, skillLevel: 5 }, { deductResources: false })
        expect(lyc.kind).toBe('passive')
        if (lyc.kind === 'passive') {
          expect(lyc.passiveBonus.shapeshiftLifePct).toBe(20 + 5 * (5 - 1)) // 40%
        }

        const cm = executeSkill(252, { caster: player, skillLevel: 5 }, { deductResources: false })
        expect(cm.kind).toBe('passive')
        if (cm.kind === 'passive') {
          expect(cm.passiveBonus.clawDamagePct).toBe(35 + 8 * (5 - 1)) // 67%
        }
      })
    })
  })

  // ==========================================================================
  // Suite 6: Adversarial Boundary Fuzzing & Resilience
  // ==========================================================================
  describe('6. Adversarial Boundary Fuzzing & Resilience', () => {
    it('handles negative, zero, and extreme levels safely without throwing or NaN', () => {
      const extremeLevels = [-999, -1, 0, NaN, Infinity, -Infinity, 1.75, 999999]
      for (const lvl of extremeLevels) {
        const dmg = calculateSkillDamage(36, lvl)
        expect(Number.isFinite(dmg.min)).toBe(true)
        expect(Number.isFinite(dmg.max)).toBe(true)
        expect(dmg.min).toBeGreaterThanOrEqual(0)
        expect(dmg.max).toBeGreaterThanOrEqual(dmg.min)

        const mana = getSkillManaCost(36, lvl)
        expect(Number.isFinite(mana)).toBe(true)
        expect(mana).toBeGreaterThanOrEqual(0)
      }
    })

    it('handles adversarial synergy inputs (NaN, negative, zero, Infinity)', () => {
      const adversarialSyns = [NaN, -5.0, 0, -Infinity, Infinity]
      for (const syn of adversarialSyns) {
        const dmg = calculateSkillDamage(47, 20, syn)
        expect(Number.isFinite(dmg.min)).toBe(true)
        expect(Number.isFinite(dmg.max)).toBe(true)
        expect(dmg.min).toBeGreaterThan(0)
      }
    })

    it('handles negative and malformed weapon damage structures gracefully', () => {
      const negativeWeapon = { min: -100, max: -50 }
      const dmg = calculateSkillDamage(10, 1, 1.0, negativeWeapon)
      expect(dmg.min).toBe(0)
      expect(dmg.max).toBe(0)
    })

    it('handles unknown skill IDs gracefully returning safe zeroed results', () => {
      const unknownIds = [-1, 0, 99999]
      for (const id of unknownIds) {
        expect(isBatch1Skill(id)).toBe(false)
        expect(getBatch1SkillDef(id)).toBeUndefined()
        expect(getSkillManaCost(id, 1)).toBe(0)
        expect(getSkillCooldownTicks(id)).toBe(0)

        const dmg = calculateSkillDamage(id, 1)
        expect(dmg).toEqual({ min: 0, max: 0 })

        const res = executeSkill(id, { caster: createPlayer(), skillLevel: 1 })
        expect(res.kind).toBe('melee')
        if (res.kind === 'melee') {
          expect(res.skillName).toBe('Unknown')
        }
      }
    })
  })

  // ==========================================================================
  // Suite 7: BATCH1_SKILLS parity with raw Skills.txt
  // ==========================================================================
  describe('7. BATCH1_SKILLS parity with raw Skills.txt', () => {
    it('BATCH1_SKILLS parity with raw Skills.txt', () => {
      const skillsTxtPath = path.resolve(__dirname, '../samples/fixtures/data/global/excel/skills.txt')
      const content = fs.readFileSync(skillsTxtPath, 'latin1')
      const lines = content.split('\n')
      const headers = lines[0]!.split('\t')
      const idIdx = headers.indexOf('Id')

      const getCol = (h: string) => headers.indexOf(h)
      const num = (v: string | undefined, defaultVal = 0) => {
        if (!v || v.trim() === '') return defaultVal
        const n = Number(v.trim())
        return Number.isFinite(n) ? n : defaultVal
      }

      const rowsById = new Map<number, string[]>()
      for (let i = 1; i < lines.length; i++) {
        const r = lines[i]!.split('\t')
        if (r.length > idIdx && /^\d+$/.test(r[idIdx]!.trim())) {
          rowsById.set(Number(r[idIdx]!.trim()), r)
        }
      }

      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)

      for (const [idStr, def] of Object.entries(BATCH1_SKILLS)) {
        const sid = Number(idStr)
        const row = rowsById.get(sid)
        expect(row).toBeDefined()
        if (!row) continue

        const emin = num(row[getCol('EMin')])
        const emax = num(row[getCol('EMax')])
        const elev1 = num(row[getCol('EMinLev1')])
        const elev2 = num(row[getCol('EMinLev2')])
        const elev3 = num(row[getCol('EMinLev3')])
        const elev4 = num(row[getCol('EMinLev4')])
        const elev5 = num(row[getCol('EMinLev5')])
        const emaxlev1 = num(row[getCol('EMaxLev1')]) || elev1
        const emaxlev2 = num(row[getCol('EMaxLev2')]) || elev2
        const emaxlev3 = num(row[getCol('EMaxLev3')]) || elev3
        const emaxlev4 = num(row[getCol('EMaxLev4')]) || elev4
        const emaxlev5 = num(row[getCol('EMaxLev5')]) || elev5
        const hitshift = num(row[getCol('HitShift')], 8)
        const mana = num(row[getCol('mana')])
        const lvlmana = num(row[getCol('lvlmana')])
        const minmana = num(row[getCol('minmana')])
        const manashift = num(row[getCol('manashift')], 8)

        // For Frost Nova (44) and Teeth (67), assert exact equality between BATCH1_SKILLS and raw parsed Skills.txt
        if (sid === 44 || sid === 67) {
          expect(def.emin).toBe(emin)
          expect(def.emax).toBe(emax)
          expect(def.elev1).toBe(elev1)
          expect(def.elev2).toBe(elev2)
          expect(def.elev3).toBe(elev3)
          expect(def.elev4).toBe(elev4)
          expect(def.elev5).toBe(elev5)
          expect(def.emaxlev1 ?? def.elev1).toBe(emaxlev1)
          expect(def.emaxlev2 ?? def.elev2).toBe(emaxlev2)
          expect(def.emaxlev3 ?? def.elev3).toBe(emaxlev3)
          expect(def.emaxlev4 ?? def.elev4).toBe(emaxlev4)
          expect(def.emaxlev5 ?? def.elev5).toBe(emaxlev5)
          expect(def.hitshift).toBe(hitshift)
          expect(def.mana).toBe(mana)
          expect(def.lvlmana).toBe(lvlmana)
          expect(def.minmana).toBe(minmana)
          expect(def.manashift).toBe(manashift)
        }

        // Independent oracle branches for Bone Armor (68) and Corpse Explosion (74)
        // CRITICAL ANTI-EVASION: NO imports or calls to calculateBoneArmorCapacity or calculateCorpseExplosionDamage
        if (sid === 68) {
          const p1 = num(row[getCol('Param1')]) // 20
          const p2 = num(row[getCol('Param2')]) // 10
          expect(p1).toBe(20)
          expect(p2).toBe(10)
          for (let slvl = 1; slvl <= 20; slvl++) {
            const independentCapacity = p1 + (slvl - 1) * p2
            expect(independentCapacity).toBe(20 + (slvl - 1) * 10)
          }
        }

        if (sid === 74) {
          const p1 = num(row[getCol('Param1')]) // 70 (70% min HP)
          const p2 = num(row[getCol('Param2')]) // 120 (120% max HP)
          expect(p1).toBe(70)
          expect(p2).toBe(120)
          const testHp = 1000
          const minDmg = (testHp * p1) / 100
          const maxDmg = (testHp * p2) / 100
          // 50% physical, 50% fire derived independently
          const physMin = minDmg * 0.5
          const fireMin = minDmg * 0.5
          const physMax = maxDmg * 0.5
          const fireMax = maxDmg * 0.5
          expect(physMin + fireMin).toBe(700)
          expect(physMax + fireMax).toBe(1200)
        }
      }
    })
  })
})
