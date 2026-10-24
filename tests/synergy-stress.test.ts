import { describe, it, expect } from 'vitest'
import {
  CANONICAL_SKILL_TREE,
  CANONICAL_SKILL_PARAMS,
  calculateSynergyMultiplier,
} from '../src/common/skills/skill-tree.ts'
import type { SkillNode, SkillTreeState, CharacterClassCode } from '../src/common/skills/skill-tree.ts'

/**
 * Adversarial Stress Testing Suite for Diablo II (v1.13c) Synergy Engine.
 *
 * Focus areas:
 * 1. All 69 synergy-receiving skills under extreme point allocations (0, 1, 10, 20 hard points).
 * 2. Strict base-point invariant: equipment soft points (slvl) never bleed into synergy calculations.
 * 3. Robust syntax resilience: unclosed parentheses (Fire Wall typo), case insensitivity, malformed formulas, and injection attacks.
 * 4. Multi-synergy exact algebraic ground truth verification.
 * 5. Differential fuzzing against an independent mathematical oracle.
 */

// Filter all canonical skills that receive synergies
const SYNERGY_SKILLS = CANONICAL_SKILL_TREE.filter(
  s => s.synergyFormulas.physical || s.synergyFormulas.elemental || s.synergyFormulas.duration
)

/**
 * Independent mathematical oracle for differential testing.
 * Implements a separate, clean parsing and evaluation pipeline.
 */
function independentOracle(
  tree: readonly SkillNode[],
  state: SkillTreeState,
  skillId: number,
  damageType: 'physical' | 'elemental' | 'duration'
): number {
  const node = tree.find(s => s.id === skillId)
  if (!node) return 1.0

  const formula = damageType === 'physical'
    ? node.synergyFormulas.physical
    : damageType === 'duration'
      ? node.synergyFormulas.duration
      : node.synergyFormulas.elemental

  if (!formula || formula.trim() === '' || formula.trim() === '-') return 1.0

  const nameMap = new Map<string, number>()
  for (const s of tree) {
    nameMap.set(s.name.trim().toLowerCase(), s.id)
  }

  // Parse skill references
  let expr = formula.replace(/skill\(\s*['"]([^'"]+)['"]\s*\.blvl\s*\)/gi, (_, skillName) => {
    const id = nameMap.get(skillName.trim().toLowerCase())
    if (id === undefined) return '0'
    const pts = Math.max(0, Math.min(20, state.hardPoints[id] ?? 0))
    return String(pts)
  })

  // Parse parameters
  const canon = CANONICAL_SKILL_PARAMS[node.id] || {}
  const p8 = canon.par8 ?? 16
  const p7 = canon.par7 ?? 8
  const p6 = canon.par6 ?? 5
  const p5 = canon.par5 ?? 0

  expr = expr.replace(/\bpar8\b/gi, String(p8))
  expr = expr.replace(/\bpar7\b/gi, String(p7))
  expr = expr.replace(/\bpar6\b/gi, String(p6))
  expr = expr.replace(/\bpar5\b/gi, String(p5))

  // Balance parentheses
  const opens = (expr.match(/\(/g) || []).length
  const closes = (expr.match(/\)/g) || []).length
  if (opens > closes) expr += ')'.repeat(opens - closes)
  else if (closes > opens) expr = '('.repeat(closes - opens) + expr

  if (!/^[-+0-9*/().\s]+$/.test(expr)) return 1.0

  try {
    const val = Function(`"use strict"; return (${expr})`)()
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return 1.0
    return 1.0 + val / 100.0
  } catch {
    return 1.0
  }
}

describe('Synergy Engine Adversarial Stress Testing (1.13c)', () => {
  // ==========================================================================
  // 1. All 69 Synergy-Receiving Skills Under Extreme Point Allocations
  // ==========================================================================
  describe('1. 69 Synergy Skills Under Extreme Allocations (0, 1, 10, 20 hard points)', () => {
    it('verifies catalog contains exactly 69 synergy-receiving skills', () => {
      expect(SYNERGY_SKILLS).toHaveLength(69)
      const classBreakdown: Record<CharacterClassCode, number> = {
        ama: 0, sor: 0, nec: 0, pal: 0, bar: 0, dru: 0, ass: 0
      }
      for (const s of SYNERGY_SKILLS) {
        classBreakdown[s.classCode]++
      }
      expect(classBreakdown).toEqual({
        ama: 13,
        sor: 19,
        nec: 6,
        pal: 7,
        bar: 2,
        dru: 12,
        ass: 10,
      })
    })

    it('returns exactly 1.0 (0% bonus) for all 69 skills when all donor skills have 0 hard points', () => {
      const state: SkillTreeState = { hardPoints: {}, unspentPoints: 100 }

      for (const skill of SYNERGY_SKILLS) {
        for (const type of ['physical', 'elemental', 'duration'] as const) {
          if (!skill.synergyFormulas[type]) continue
          const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, skill.id, type)
          expect(mult, `${skill.name} (${type}) with 0 points should be 1.0`).toBe(1.0)
        }
      }
    })

    it('evaluates all 69 skills across 1, 10, and 20 hard points with monotonic growth', () => {
      for (const skill of SYNERGY_SKILLS) {
        for (const type of ['physical', 'elemental', 'duration'] as const) {
          if (!skill.synergyFormulas[type]) continue

          const mults: number[] = []
          for (const pts of [0, 1, 10, 20]) {
            const state: SkillTreeState = { hardPoints: {}, unspentPoints: 100 }
            for (const donor of CANONICAL_SKILL_TREE) {
              state.hardPoints[donor.id] = pts
            }
            const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, skill.id, type)
            const oracle = independentOracle(CANONICAL_SKILL_TREE, state, skill.id, type)
            expect(mult, `${skill.name} (${type}) at ${pts} pts`).toBeCloseTo(oracle, 4)
            mults.push(mult)
          }

          // Monotonic growth: 0 <= 1 <= 10 <= 20
          expect(mults[0]).toBe(1.0)
          expect(mults[1]).toBeGreaterThan(mults[0])
          expect(mults[2]).toBeGreaterThan(mults[1])
          expect(mults[3]).toBeGreaterThan(mults[2])
        }
      }
    })

    it('clamps hard points to [0..20] boundary even if state contains adversarial values', () => {
      const stateOver: SkillTreeState = { hardPoints: {}, unspentPoints: 0 }
      const state20: SkillTreeState = { hardPoints: {}, unspentPoints: 0 }
      const stateNeg: SkillTreeState = { hardPoints: {}, unspentPoints: 0 }

      for (const s of CANONICAL_SKILL_TREE) {
        stateOver.hardPoints[s.id] = 99  // Over-invested
        state20.hardPoints[s.id] = 20    // Legal maximum
        stateNeg.hardPoints[s.id] = -10  // Negative invested
      }

      for (const skill of SYNERGY_SKILLS) {
        for (const type of ['physical', 'elemental', 'duration'] as const) {
          if (!skill.synergyFormulas[type]) continue
          const multOver = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, stateOver, skill.id, type)
          const mult20 = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state20, skill.id, type)
          const multNeg = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, stateNeg, skill.id, type)

          // 99 points must clamp to 20 points
          expect(multOver, `${skill.name} (${type}) clamp 99->20`).toBe(mult20)
          // Negative points must clamp to 0 points (1.0 multiplier)
          expect(multNeg, `${skill.name} (${type}) clamp negative->0`).toBe(1.0)
        }
      }
    })
  })

  // ==========================================================================
  // 2. Base-Point Invariant & Equipment Soft-Point Isolation
  // ==========================================================================
  describe('2. Base-Point Invariant & Equipment Soft-Point Isolation', () => {
    it('confirms equipment soft points (slvl) never alter synergy multiplier', () => {
      // Setup Sorceress: Fire Bolt (36) with Fire Ball (47) = 5 hard points, Meteor (56) = 3 hard points
      const state: SkillTreeState = {
        hardPoints: { 47: 5, 56: 3 },
        unspentPoints: 10,
      }

      // Baseline: (5 + 3) * 16% = +128% => 2.28
      const baseline = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 36, 'elemental')
      expect(baseline).toBeCloseTo(2.28, 4)

      // Simulate character wearing Magefist (+1 Fire Skills), The Oculus (+3 Sorc Skills),
      // Harlequin Crest (+2 All Skills), and 10 Fire Grand Charms (+10 Fire Skills) = +16 soft points.
      // Soft points change effective level from 5 -> 21, but hard points MUST remain 5.
      const stateWithGear: any = {
        ...state,
        softPoints: { 47: 16, 56: 16 },
        effectiveLevels: { 47: 21, 56: 19 },
      }

      const gearMult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, stateWithGear, 36, 'elemental')
      expect(gearMult).toBe(baseline)
    })

    it('rejects adversarial formulas attempting to reference .slvl or .lvl', () => {
      const state: SkillTreeState = {
        hardPoints: { 47: 20 },
        unspentPoints: 0,
      }

      const maliciousCatalog: SkillNode[] = [
        {
          id: 9901,
          name: 'Slvl Exploit Skill',
          classCode: 'sor',
          tabIndex: 0,
          tabName: 'Fire Spells',
          row: 1,
          col: 1,
          reqlevel: 1,
          reqskills: [],
          dependents: [],
          synergyFormulas: {
            elemental: "skill('Fire Ball'.slvl)*par8",
          },
        },
        {
          id: 9902,
          name: 'Lvl Exploit Skill',
          classCode: 'sor',
          tabIndex: 0,
          tabName: 'Fire Spells',
          row: 1,
          col: 1,
          reqlevel: 1,
          reqskills: [],
          dependents: [],
          synergyFormulas: {
            elemental: "skill('Fire Ball'.lvl)*par8",
          },
        },
      ]

      // Because the engine strictly matches .blvl, .slvl and .lvl are left un-substituted,
      // fail the arithmetic regex, and safely evaluate to 1.0 (no bonus).
      expect(calculateSynergyMultiplier(maliciousCatalog, state, 9901, 'elemental')).toBe(1.0)
      expect(calculateSynergyMultiplier(maliciousCatalog, state, 9902, 'elemental')).toBe(1.0)
    })

    it('oskills and charges grant 0 synergy bonus to other skills', () => {
      // Paladin with Holy Shield: Holy Shield receives synergy from Defiance (107).
      // If a character has +3 to Defiance from an Exile runeword or CTA (oskills),
      // hard points remain 0.
      const state: SkillTreeState = {
        hardPoints: { 107: 0 }, // 0 hard points
        unspentPoints: 10,
      }

      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 117, 'elemental')
      expect(mult).toBe(1.0)
    })
  })

  // ==========================================================================
  // 3. Formula Syntax Resilience, Unclosed Parens & Adversarial Inputs
  // ==========================================================================
  describe('3. Formula Syntax Resilience, Unclosed Parens & Adversarial Inputs', () => {
    it('correctly parses and balances Blizzard canonical unclosed Fire Wall formula', () => {
      // Canonical Skills.txt row 51: "(skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7"
      // Missing closing parenthesis!
      // Warmth par8 = 4, Inferno par7 = 1
      const state: SkillTreeState = {
        hardPoints: { 37: 10, 41: 10 },
        unspentPoints: 0,
      }

      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 51, 'elemental')
      // (10 * 4 + 10 * 1) = +50% => 1.50
      expect(mult).toBeCloseTo(1.50, 4)

      // Test at 20 hard points: (20 * 4 + 20 * 1) = +100% => 2.00
      state.hardPoints[37] = 20
      state.hardPoints[41] = 20
      expect(calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 51, 'elemental')).toBeCloseTo(2.00, 4)
    })

    it('handles multiple unclosed or unopened parentheses without throwing', () => {
      const state: SkillTreeState = { hardPoints: { 37: 10, 41: 10 }, unspentPoints: 0 }

      const variations = [
        "((skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7",
        "(((skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7",
        "(skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7))",
        "(skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7)))",
      ]

      for (const formula of variations) {
        const tree = CANONICAL_SKILL_TREE.map(s => s.id === 51 ? {
          ...s,
          synergyFormulas: { ...s.synergyFormulas, elemental: formula },
        } : s)

        const mult = calculateSynergyMultiplier(tree, state, 51, 'elemental')
        expect(mult, `Formula: ${formula}`).toBeCloseTo(1.50, 4)
      }
    })

    it('is case-insensitive for skill names, parameters, and formula keywords', () => {
      const state: SkillTreeState = { hardPoints: { 37: 10 }, unspentPoints: 0 }

      const variations = [
        "skill('warmth'.blvl)*par8",
        "skill('WARMTH'.blvl)*par8",
        "skill('wArMtH'.blvl)*par8",
        "SKILL('Warmth'.BLVL)*PAR8",
        "sKiLl('Warmth'.bLvL)*pAr8",
        'skill("Warmth".blvl)*par8', // double quotes
        "skill('  Warmth  '.blvl)*par8", // spaces inside quotes
        "  skill('Warmth'.blvl) * par8  ", // spaces around operators
        "\tskill('Warmth'.blvl)\n* par8\t", // tabs and newlines
      ]

      for (const formula of variations) {
        const tree = CANONICAL_SKILL_TREE.map(s => s.id === 51 ? {
          ...s,
          synergyFormulas: { ...s.synergyFormulas, elemental: formula },
        } : s)

        const mult = calculateSynergyMultiplier(tree, state, 51, 'elemental')
        // 10 * 4% = +40% => 1.40
        expect(mult, `Variation: ${JSON.stringify(formula)}`).toBeCloseTo(1.40, 4)
      }
    })

    it('documents edge case: intra-token whitespace "skill (" or ". blvl" falls back to 1.0', () => {
      const state: SkillTreeState = { hardPoints: { 37: 10 }, unspentPoints: 0 }
      const tree = CANONICAL_SKILL_TREE.map(s => s.id === 51 ? {
        ...s,
        synergyFormulas: { ...s.synergyFormulas, elemental: "  skill ( 'Warmth' . blvl ) * par8  " },
      } : s)

      // Regex requires skill\( and \.blvl, so space between function name and paren or around dot
      // leaves token unparsed, which fails arithmetic validation and safely defaults to 1.0.
      const mult = calculateSynergyMultiplier(tree, state, 51, 'elemental')
      expect(mult).toBe(1.0)
    })

    it('safely handles nonexistent skills by defaulting their contribution to 0 points', () => {
      const state: SkillTreeState = { hardPoints: { 37: 10 }, unspentPoints: 0 }
      const formula = "skill('NonExistentSkill'.blvl)*par8 + skill('Warmth'.blvl)*par8"

      const tree = CANONICAL_SKILL_TREE.map(s => s.id === 51 ? {
        ...s,
        synergyFormulas: { ...s.synergyFormulas, elemental: formula },
      } : s)

      const mult = calculateSynergyMultiplier(tree, state, 51, 'elemental')
      // NonExistentSkill is 0; Warmth is 10 * 4% = +40% => 1.40
      expect(mult).toBeCloseTo(1.40, 4)
    })

    it('rejects malicious JavaScript injection payloads safely with 1.0 fallback', () => {
      const state: SkillTreeState = { hardPoints: { 37: 10 }, unspentPoints: 0 }
      const attacks = [
        "alert('xss')",
        "process.exit(1)",
        "console.log(1)",
        "this.constructor.constructor('return 100')()",
        "globalThis",
        "function(){return 50}()",
        "__proto__",
        "1; while(true){}",
      ]

      for (const attack of attacks) {
        const tree = CANONICAL_SKILL_TREE.map(s => s.id === 51 ? {
          ...s,
          synergyFormulas: { ...s.synergyFormulas, elemental: attack },
        } : s)

        const mult = calculateSynergyMultiplier(tree, state, 51, 'elemental')
        expect(mult, `Attack payload: ${attack}`).toBe(1.0)
      }
    })

    it('handles empty, whitespace, and arithmetic syntax errors safely', () => {
      const state: SkillTreeState = { hardPoints: { 37: 10 }, unspentPoints: 0 }
      const malformed = [
        "",
        "   ",
        "-",
        "+++",
        "*** / ()",
        "()",
        "((()))",
        "-100 * par8", // negative result
        "0",           // zero result
      ]

      for (const formula of malformed) {
        const tree = CANONICAL_SKILL_TREE.map(s => s.id === 51 ? {
          ...s,
          synergyFormulas: { ...s.synergyFormulas, elemental: formula },
        } : s)

        const mult = calculateSynergyMultiplier(tree, state, 51, 'elemental')
        expect(mult, `Malformed: ${formula}`).toBe(1.0)
      }
    })
  })

  // ==========================================================================
  // 4. Multi-Synergy Calculations Against Exact 1.13c Ground Truth Formulas
  // ==========================================================================
  describe('4. Multi-Synergy Calculations Against Exact 1.13c Formulas', () => {
    it('Paladin Blessed Hammer (112): Vigor (115) + Blessed Aim (108) @ +14% per point', () => {
      const state: SkillTreeState = {
        hardPoints: { 115: 20, 108: 20 },
        unspentPoints: 0,
      }
      // (20 + 20) * 14% = +560% => 6.60 multiplier
      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 112, 'elemental')
      expect(mult).toBeCloseTo(6.60, 4)
    })

    it('Necromancer Bone Spear (84): Wall (78) + Prison (88) + Teeth (67) + Spirit (93) @ +7% per point', () => {
      const state: SkillTreeState = {
        hardPoints: { 78: 20, 88: 20, 67: 20, 93: 20 },
        unspentPoints: 0,
      }
      // (20 + 20 + 20 + 20) * 7% = +560% => 6.60 multiplier
      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 84, 'elemental')
      expect(mult).toBeCloseTo(6.60, 4)
    })

    it('Necromancer Bone Spirit (93): Wall (78) + Prison (88) + Teeth (67) + Spear (84) @ +6% per point', () => {
      const state: SkillTreeState = {
        hardPoints: { 78: 20, 88: 20, 67: 20, 84: 20 },
        unspentPoints: 0,
      }
      // (20 + 20 + 20 + 20) * 6% = +480% => 5.80 multiplier
      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 93, 'elemental')
      expect(mult).toBeCloseTo(5.80, 4)
    })

    it('Druid Molten Boulder (229): Dual physical (Volcano @ 10%) & elemental (Firestorm @ 8%) synergies', () => {
      const state: SkillTreeState = {
        hardPoints: { 244: 20, 225: 20 }, // Volcano (244) = 20, Firestorm (225) = 20
        unspentPoints: 0,
      }
      // Physical: 20 * 10% = +200% => 3.00 multiplier
      const phys = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 229, 'physical')
      expect(phys).toBeCloseTo(3.00, 4)

      // Elemental: 20 * 8% = +160% => 2.60 multiplier
      const elem = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 229, 'elemental')
      expect(elem).toBeCloseTo(2.60, 4)
    })

    it('Druid Volcano (244): Dual physical (Molten Boulder @ 12%) & elemental (Eruption + Armageddon @ 12%) synergies', () => {
      const state: SkillTreeState = {
        hardPoints: { 229: 20, 234: 20, 249: 20 }, // Molten Boulder (229), Eruption (234), Armageddon (249)
        unspentPoints: 0,
      }
      // Physical: 20 * 12% = +240% => 3.40 multiplier
      const phys = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 244, 'physical')
      expect(phys).toBeCloseTo(3.40, 4)

      // Elemental: (20 + 20) * 12% = +480% => 5.80 multiplier
      const elem = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 244, 'elemental')
      expect(elem).toBeCloseTo(5.80, 4)
    })

    it('Paladin Holy Fire (102), Holy Freeze (114), and Holy Shock (118) split-aura synergies', () => {
      // Holy Fire: Resist Fire (100) * 18% + Salvation (125) * 6%
      const stateFire: SkillTreeState = { hardPoints: { 100: 20, 125: 20 }, unspentPoints: 0 }
      const multFire = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, stateFire, 102, 'elemental')
      // 20 * 18 + 20 * 6 = 360 + 120 = +480% => 5.80
      expect(multFire).toBeCloseTo(5.80, 4)

      // Holy Freeze: Resist Cold (105) * 15% + Salvation (125) * 7%
      const stateFreeze: SkillTreeState = { hardPoints: { 105: 20, 125: 20 }, unspentPoints: 0 }
      const multFreeze = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, stateFreeze, 114, 'elemental')
      // 20 * 15 + 20 * 7 = 300 + 140 = +440% => 5.40
      expect(multFreeze).toBeCloseTo(5.40, 4)

      // Holy Shock: Resist Lightning (110) * 12% + Salvation (125) * 4%
      const stateShock: SkillTreeState = { hardPoints: { 110: 20, 125: 20 }, unspentPoints: 0 }
      const multShock = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, stateShock, 118, 'elemental')
      // 20 * 12 + 20 * 4 = 240 + 80 = +320% => 4.20
      expect(multShock).toBeCloseTo(4.20, 4)
    })

    it('Assassin Fire Trauma (251) 6-way trap synergy @ +9% per point', () => {
      // 6 donors: Shock Field (256), Death Sentry (276), Charged Bolt Sentry (261),
      // Lightning Sentry (271), Wake of Fire Sentry (262), Inferno Sentry (272)
      const state: SkillTreeState = {
        hardPoints: { 256: 20, 276: 20, 261: 20, 271: 20, 262: 20, 272: 20 },
        unspentPoints: 0,
      }
      // 6 * 20 * 9% = 120 * 9% = +1080% => 11.80 multiplier
      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 251, 'elemental')
      expect(mult).toBeCloseTo(11.80, 4)
    })

    it('Sorceress Ice Bolt (39) 5-way cold spell synergy @ +15% per point', () => {
      // 5 donors: Frost Nova (44), Ice Blast (45), Glacial Spike (55), Blizzard (59), Frozen Orb (64)
      const state: SkillTreeState = {
        hardPoints: { 44: 20, 45: 20, 55: 20, 59: 20, 64: 20 },
        unspentPoints: 0,
      }
      // 5 * 20 * 15% = 100 * 15% = +1500% => 16.00 multiplier
      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 39, 'elemental')
      expect(mult).toBeCloseTo(16.00, 4)
    })

    it('Barbarian War Cry (154) physical damage synergy (+6% per point of Howl/Taunt/Battle Cry)', () => {
      const state: SkillTreeState = {
        hardPoints: { 130: 20, 137: 20, 146: 20 }, // Howl (130), Taunt (137), Battle Cry (146)
        unspentPoints: 0,
      }
      // 3 * 20 * 6% = 60 * 6% = +360% => 4.60 multiplier
      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 154, 'physical')
      expect(mult).toBeCloseTo(4.60, 4)
    })

    it('Druid Tornado (245) physical damage synergy (+9% per point of Cyclone Armor/Twister/Hurricane)', () => {
      const state: SkillTreeState = {
        hardPoints: { 235: 20, 240: 20, 250: 20 }, // Cyclone Armor (235), Twister (240), Hurricane (250)
        unspentPoints: 0,
      }
      // 3 * 20 * 9% = 60 * 9% = +540% => 6.40 multiplier
      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 245, 'physical')
      expect(mult).toBeCloseTo(6.40, 4)
    })
  })

  // ==========================================================================
  // 5. Differential Fuzzing Against Independent Oracle (1,000 Iterations)
  // ==========================================================================
  describe('5. Differential Fuzzing Against Independent Oracle (1,000 Iterations)', () => {
    it('passes 1,000 randomized allocation tests with zero divergence from oracle', () => {
      // Deterministic PRNG seed
      let seed = 123456789
      function rng() {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed / 0x100000000
      }

      for (let i = 0; i < 1000; i++) {
        // Pick random skill from the 69 synergy receivers
        const skillIndex = Math.floor(rng() * SYNERGY_SKILLS.length)
        const skill = SYNERGY_SKILLS[skillIndex]

        // Pick an available damage type
        const availableTypes = (['physical', 'elemental', 'duration'] as const).filter(
          t => Boolean(skill.synergyFormulas[t])
        )
        const type = availableTypes[Math.floor(rng() * availableTypes.length)]

        // Randomly assign hard points (0..20) across tree skills
        const state: SkillTreeState = { hardPoints: {}, unspentPoints: 100 }
        for (const s of CANONICAL_SKILL_TREE) {
          // 40% chance of 0, 20% chance of 20, 40% chance of 1..19
          const r = rng()
          if (r < 0.4) {
            state.hardPoints[s.id] = 0
          } else if (r < 0.6) {
            state.hardPoints[s.id] = 20
          } else {
            state.hardPoints[s.id] = Math.floor(rng() * 20) + 1
          }
        }

        const actual = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, skill.id, type)
        const expected = independentOracle(CANONICAL_SKILL_TREE, state, skill.id, type)

        expect(
          Math.abs(actual - expected),
          `Fuzz iteration ${i} failed for ${skill.name} (${type})`
        ).toBeLessThanOrEqual(1e-4)
      }
    })
  })
})
