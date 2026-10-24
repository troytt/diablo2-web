import { describe, it, expect } from 'vitest'
import {
  BATCH1_SKILLS,
  getBatch1SkillDef,
  isBatch1Skill,
  getSkillManaCost,
  getSkillCooldownTicks,
  calculateSkillDamage,
  executeSkill,
  type SkillExecutionContext,
  type Batch1SkillDef,
  type SkillType,
} from '../src/server/skills/skills.ts'
import {
  CANONICAL_SKILL_TREE,
  CANONICAL_SKILL_MAP,
  createSkillTreeState,
  canAllocate,
  allocatePoint,
  canDeallocate,
  deallocatePoint,
  respec,
  calculateSynergyMultiplier,
  type SkillTreeState,
} from '../src/common/skills/skill-tree.ts'
import type { CombatPlayer } from '../src/server/ai/monster-ai.ts'

function makeTestPlayer(overrides?: Partial<CombatPlayer>): CombatPlayer {
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

describe('Adversarial Stress Testing: M3 Skills, Resources, Cooldowns & State', () => {
  // ==========================================================================
  // Suite 1: Mana Edge Cases Across All 38 Skills
  // ==========================================================================
  describe('Suite 1: Mana Edge Cases Across All 38 Skills', () => {
    const all38SkillIds = Object.keys(BATCH1_SKILLS).map(Number)
    const testLevels = [-10, 0, 1, 5, 10, 20, 50, 99, NaN, Infinity, -Infinity]

    it('verifies catalog contains exactly 38 skills across all 7 classes', () => {
      expect(all38SkillIds.length).toBe(38)
      for (const id of all38SkillIds) {
        expect(isBatch1Skill(id)).toBe(true)
        const def = getBatch1SkillDef(id)
        expect(def).toBeDefined()
        expect(def!.id).toBe(id)
      }
    })

    it('verifies mana cost is always finite, non-negative, and never NaN across all 38 skills and edge levels', () => {
      for (const skillId of all38SkillIds) {
        const def = getBatch1SkillDef(skillId)!
        const lvl1Cost = getSkillManaCost(skillId, 1)
        expect(lvl1Cost).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(lvl1Cost)).toBe(true)

        for (const lvl of testLevels) {
          const cost = getSkillManaCost(skillId, lvl)

          // Invariants
          expect(typeof cost).toBe('number')
          expect(Number.isNaN(cost)).toBe(false)
          expect(Number.isFinite(cost)).toBe(true)
          expect(cost).toBeGreaterThanOrEqual(0)

          // For invalid, negative, or non-finite levels, cost must normalize safely to level 1 cost
          if (Number.isNaN(lvl) || !Number.isFinite(lvl) || lvl <= 0) {
            expect(cost).toBe(lvl1Cost)
          }

          // Must never drop below defined minmana
          const minmana = def.minmana ?? 0
          expect(cost).toBeGreaterThanOrEqual(minmana)
        }
      }
    })

    it('returns 0 mana for non-batch1 skill IDs and non-numeric skill IDs', () => {
      const invalidSkillIds = [0, -1, -999, 9999, NaN, Infinity, -Infinity, 999999]
      for (const id of invalidSkillIds) {
        expect(getSkillManaCost(id, 1)).toBe(0)
        expect(getSkillManaCost(id, 20)).toBe(0)
        expect(getSkillManaCost(id, NaN)).toBe(0)
      }
    })

    it('validates authentic 1.13c mana costs for selected archetypes at specific levels', () => {
      // Fire Bolt (36): mana 5, lvlmana 0, manashift 7 (shift 0.5) -> constant 2.5
      expect(getSkillManaCost(36, 1)).toBe(2.5)
      expect(getSkillManaCost(36, 10)).toBe(2.5)
      expect(getSkillManaCost(36, 99)).toBe(2.5)

      // Teeth (67): mana 6, lvlmana 1, manashift 7 (shift 0.5) -> (6 + 1*(lvl-1))*0.5
      expect(getSkillManaCost(67, 1)).toBe(3.0)
      expect(getSkillManaCost(67, 2)).toBe(3.5)
      expect(getSkillManaCost(67, 10)).toBe(7.5)
      expect(getSkillManaCost(67, 20)).toBe(12.5)

      // Holy Bolt (101): 1.13c Skills.txt: mana 32, lvlmana 1, manashift 4 (shift 0.0625) -> (32 + 1*(lvl-1))*0.0625
      expect(getSkillManaCost(101, 1)).toBe(2.0)
      expect(getSkillManaCost(101, 9)).toBe(2.5)
      expect(getSkillManaCost(101, 17)).toBe(3.0)

      // Blessed Hammer (112): mana 20, lvlmana 1, manashift 6 (shift 0.25) -> (20 + 1*(lvl-1))*0.25
      expect(getSkillManaCost(112, 1)).toBe(5.0)
      expect(getSkillManaCost(112, 5)).toBe(6.0)
      expect(getSkillManaCost(112, 21)).toBe(10.0)

      // Fire Blast (251): 1.13c Skills.txt: mana 24, lvlmana 1, manashift 5 (shift 0.125) -> (24 + 1*(lvl-1))*0.125
      expect(getSkillManaCost(251, 1)).toBe(3.0)
      expect(getSkillManaCost(251, 2)).toBe(3.125)
      expect(getSkillManaCost(251, 5)).toBe(3.5)
      expect(getSkillManaCost(251, 10)).toBe(4.125)
    })
  })

  // ==========================================================================
  // Suite 2: Decreasing Mana Cost Floor Invariant (Magic Arrow & Double Swing)
  // ==========================================================================
  describe('Suite 2: Decreasing Mana Never Drops Below 0 (Magic Arrow, Double Swing)', () => {
    it('verifies Magic Arrow (id: 6) decreasing mana floors strictly at 0.0 for levels 1..99', () => {
      // Magic Arrow: mana 12, lvlmana -1, minmana 0, manashift 5 (shift factor 0.125)
      // Level 1: 12 * 0.125 = 1.50
      // Level 5: (12 - 4) * 0.125 = 1.00
      // Level 9: (12 - 8) * 0.125 = 0.50
      // Level 13: (12 - 12) * 0.125 = 0.00
      // Level 14+: raw < 0 clamped strictly to minmana = 0
      expect(getSkillManaCost(6, 1)).toBe(1.5)
      expect(getSkillManaCost(6, 2)).toBe(1.375)
      expect(getSkillManaCost(6, 5)).toBe(1.0)
      expect(getSkillManaCost(6, 9)).toBe(0.5)
      expect(getSkillManaCost(6, 12)).toBe(0.125)
      expect(getSkillManaCost(6, 13)).toBe(0.0)

      for (let lvl = 14; lvl <= 99; lvl++) {
        const cost = getSkillManaCost(6, lvl)
        expect(cost).toBe(0.0)
      }
    })

    it('verifies Double Swing (id: 133) decreasing mana floors strictly at 0.0 for levels 1..99', () => {
      // Double Swing: mana 8, lvlmana -1, minmana 0, manashift 5 (shift factor 0.125)
      // Level 1: 8 * 0.125 = 1.00
      // Level 5: (8 - 4) * 0.125 = 0.50
      // Level 9: (8 - 8) * 0.125 = 0.00
      // Level 10+: raw < 0 clamped strictly to minmana = 0
      expect(getSkillManaCost(133, 1)).toBe(1.0)
      expect(getSkillManaCost(133, 2)).toBe(0.875)
      expect(getSkillManaCost(133, 5)).toBe(0.5)
      expect(getSkillManaCost(133, 8)).toBe(0.125)
      expect(getSkillManaCost(133, 9)).toBe(0.0)

      for (let lvl = 10; lvl <= 99; lvl++) {
        const cost = getSkillManaCost(133, lvl)
        expect(cost).toBe(0.0)
      }
    })
  })

  // ==========================================================================
  // Suite 3: Minimum Mana Clamping Invariant (Teleport & Other Minmana Skills)
  // ==========================================================================
  describe('Suite 3: Minmana Clamping (Teleport Never Drops Below 1)', () => {
    it('verifies Teleport (id: 54) clamps strictly at minmana = 1 for levels 1..99', () => {
      // Teleport: mana 24, lvlmana -1, minmana 1, manashift 8 (shift factor 1.0)
      // Level 1: 24
      // Level 10: 15
      // Level 20: 5
      // Level 23: 2
      // Level 24: 1 (reaches minmana)
      // Level 25..99: raw cost drops below 1, clamped strictly to minmana = 1
      expect(getSkillManaCost(54, 1)).toBe(24)
      expect(getSkillManaCost(54, 10)).toBe(15)
      expect(getSkillManaCost(54, 20)).toBe(5)
      expect(getSkillManaCost(54, 23)).toBe(2)
      expect(getSkillManaCost(54, 24)).toBe(1)
      expect(getSkillManaCost(54, 25)).toBe(1)

      for (let lvl = 26; lvl <= 99; lvl++) {
        const cost = getSkillManaCost(54, lvl)
        expect(cost).toBe(1)
      }
    })

    it('verifies all skills with minmana > 0 never violate their minmana clamp', () => {
      for (const [idStr, def] of Object.entries(BATCH1_SKILLS)) {
        const skillId = Number(idStr)
        if (def.minmana > 0) {
          for (let lvl = 1; lvl <= 99; lvl++) {
            const cost = getSkillManaCost(skillId, lvl)
            expect(cost).toBeGreaterThanOrEqual(def.minmana)
          }
        }
      }
    })
  })

  // ==========================================================================
  // Suite 4: Fractional Mana Accumulation & Low-Mana Rapid Casting
  // ==========================================================================
  describe('Suite 4: Fractional Mana Accumulation and Rapid Casting Under Low-Mana Conditions', () => {
    it('rejects casting when current mana is strictly less than fractional cost', () => {
      // Fire Bolt costs 2.5 mana
      const player = makeTestPlayer({ mana: 2.49 })
      const ctx: SkillExecutionContext = { caster: player, skillLevel: 1 }

      const res = executeSkill(36, ctx)
      expect(res.kind).toBe('mana')
      if (res.kind === 'mana') {
        expect(res.cost).toBe(2.5)
        expect(res.currentMana).toBe(2.49)
      }
      // Mana is preserved without deductions
      expect(player.mana).toBe(2.49)
    })

    it('allows casting immediately once fractional mana accumulator crosses the threshold', () => {
      const player = makeTestPlayer({ mana: 2.49 })
      const ctx: SkillExecutionContext = { caster: player, skillLevel: 1 }

      // Insufficient: 2.49 < 2.5
      expect(executeSkill(36, ctx).kind).toBe('mana')

      // Accumulate +0.02 mana -> 2.51
      player.mana += 0.02
      expect(player.mana).toBeCloseTo(2.51, 5)

      // Now sufficient: 2.51 >= 2.5
      const res = executeSkill(36, ctx)
      expect(res.kind).toBe('projectile')
      expect(player.mana).toBeCloseTo(0.01, 5)
    })

    it('simulates rapid sequential casting under low-mana until exhausted', () => {
      // Start with exactly 5.0 mana (2 casts of Fire Bolt at 2.5 each)
      const player = makeTestPlayer({ mana: 5.0 })
      const ctx: SkillExecutionContext = { caster: player, skillLevel: 1 }

      // Cast 1
      const c1 = executeSkill(36, ctx)
      expect(c1.kind).toBe('projectile')
      expect(player.mana).toBeCloseTo(2.5, 5)

      // Cast 2
      const c2 = executeSkill(36, ctx)
      expect(c2.kind).toBe('projectile')
      expect(player.mana).toBeCloseTo(0.0, 5)

      // Cast 3: Mana exhausted
      const c3 = executeSkill(36, ctx)
      expect(c3.kind).toBe('mana')
      if (c3.kind === 'mana') {
        expect(c3.cost).toBe(2.5)
        expect(c3.currentMana).toBeCloseTo(0.0, 5)
      }
      expect(player.mana).toBeCloseTo(0.0, 5)
    })

    it('chains rapid casting across different skills with heterogeneous fractional costs', () => {
      // Start with 3.0 mana
      const player = makeTestPlayer({ mana: 3.0 })

      // 1. Magic Arrow L1 (1.5 mana) -> 1.5 remaining
      const r1 = executeSkill(6, { caster: player, skillLevel: 1 })
      expect(r1.kind).toBe('projectile')
      expect(player.mana).toBeCloseTo(1.5, 5)

      // 2. Fire Bolt L1 (2.5 mana) -> fails (1.5 < 2.5), mana preserved
      const r2 = executeSkill(36, { caster: player, skillLevel: 1 })
      expect(r2.kind).toBe('mana')
      expect(player.mana).toBeCloseTo(1.5, 5)

      // 3. Double Swing L1 (1.0 mana) -> succeeds, 0.5 remaining
      const r3 = executeSkill(133, { caster: player, skillLevel: 1 })
      expect(r3.kind).toBe('melee')
      expect(player.mana).toBeCloseTo(0.5, 5)

      // 4. Magic Arrow L9 (0.5 mana) -> succeeds, 0.0 remaining
      const r4 = executeSkill(6, { caster: player, skillLevel: 9 })
      expect(r4.kind).toBe('projectile')
      expect(player.mana).toBeCloseTo(0.0, 5)

      // 5. Magic Arrow L13 (0.0 mana) -> succeeds even with 0.0 mana!
      const r5 = executeSkill(6, { caster: player, skillLevel: 13 })
      expect(r5.kind).toBe('projectile')
      expect(player.mana).toBeCloseTo(0.0, 5)
    })

    it('successfully executes 0-cost skills when player mana is exactly 0.0', () => {
      const zeroCostSkills: readonly { readonly id: number; readonly level: number; readonly expectedKind: string }[] = [
        { id: 6, level: 13, expectedKind: 'projectile' }, // Magic Arrow L13
        { id: 6, level: 20, expectedKind: 'projectile' }, // Magic Arrow L20
        { id: 133, level: 9, expectedKind: 'melee' },      // Double Swing L9
        { id: 133, level: 20, expectedKind: 'melee' },     // Double Swing L20
        { id: 96, level: 1, expectedKind: 'melee' },       // Sacrifice
        { id: 98, level: 1, expectedKind: 'aura' },        // Might
        { id: 37, level: 1, expectedKind: 'passive' },     // Warmth
        { id: 224, level: 1, expectedKind: 'passive' },    // Lycanthropy
        { id: 252, level: 1, expectedKind: 'passive' },    // Claw Mastery
      ]

      for (const item of zeroCostSkills) {
        const player = makeTestPlayer({ mana: 0 })
        const res = executeSkill(item.id, { caster: player, skillLevel: item.level })
        expect(res.kind).toBe(item.expectedKind)
        expect(player.mana).toBe(0)
      }
    })
  })

  // ==========================================================================
  // Suite 5: deductResources: false Behavior
  // ==========================================================================
  describe('Suite 5: deductResources: false Behavior', () => {
    it('executes skills across all archetypes without mutating caster mana or cooldown when deductResources: false', () => {
      const testCases: readonly { readonly id: number; readonly expectedKind: SkillType }[] = [
        { id: 36, expectedKind: 'projectile' }, // Fire Bolt
        { id: 10, expectedKind: 'melee' },      // Jab
        { id: 44, expectedKind: 'area' },       // Frost Nova
        { id: 68, expectedKind: 'buff' },       // Bone Armor
        { id: 66, expectedKind: 'curse' },      // Amplify Damage
        { id: 54, expectedKind: 'movement' },   // Teleport
        { id: 70, expectedKind: 'summon' },     // Raise Skeleton
        { id: 98, expectedKind: 'aura' },       // Might
        { id: 37, expectedKind: 'passive' },    // Warmth
        { id: 223, expectedKind: 'buff' },      // Werewolf (has 25 cooldown)
        { id: 225, expectedKind: 'area' },      // Firestorm (has 15 cooldown)
        { id: 229, expectedKind: 'projectile' },// Molten Boulder (has 50 cooldown)
      ]

      for (const tc of testCases) {
        const player = makeTestPlayer({ mana: 100, cooldown: 0 })
        const ctx: SkillExecutionContext = { caster: player, skillLevel: 1 }

        const res = executeSkill(tc.id, ctx, { deductResources: false })
        expect(res.kind).toBe(tc.expectedKind)

        // Invariant: mana and cooldown must NOT be mutated
        expect(player.mana).toBe(100)
        expect(player.cooldown).toBe(0)
      }
    })

    it('still enforces resource requirements even when deductResources: false is supplied', () => {
      // 1. Mana requirement check: Player with insufficient mana cannot cast even with deductResources: false
      const playerLowMana = makeTestPlayer({ mana: 10 }) // Teleport needs 24 mana
      const ctxMana: SkillExecutionContext = { caster: playerLowMana, skillLevel: 1 }
      const resMana = executeSkill(54, ctxMana, { deductResources: false })

      expect(resMana.kind).toBe('mana')
      if (resMana.kind === 'mana') {
        expect(resMana.cost).toBe(24)
        expect(resMana.currentMana).toBe(10)
      }
      expect(playerLowMana.mana).toBe(10)

      // 2. Cooldown requirement check: Player with active cooldown cannot cast delay skill even with deductResources: false
      const playerOnCd = makeTestPlayer({ mana: 100, cooldown: 10 })
      const ctxCd: SkillExecutionContext = { caster: playerOnCd, skillLevel: 1 }
      const resCd = executeSkill(223, ctxCd, { deductResources: false }) // Werewolf delay 25

      expect(resCd.kind).toBe('cooldown')
      if (resCd.kind === 'cooldown') {
        expect(resCd.ticksLeft).toBe(10)
      }
      expect(playerOnCd.cooldown).toBe(10)
    })

    it('mutates player mana and cooldown when deductResources is omitted or true', () => {
      const player1 = makeTestPlayer({ mana: 100, cooldown: 0 })
      const res1 = executeSkill(223, { caster: player1, skillLevel: 1 }) // Werewolf (15 mana, 25 cooldown)
      expect(res1.kind).toBe('buff')
      expect(player1.mana).toBe(85)
      expect(player1.cooldown).toBe(25)

      const player2 = makeTestPlayer({ mana: 100, cooldown: 0 })
      const res2 = executeSkill(223, { caster: player2, skillLevel: 1 }, { deductResources: true })
      expect(res2.kind).toBe('buff')
      expect(player2.mana).toBe(85)
      expect(player2.cooldown).toBe(25)
    })
  })

  // ==========================================================================
  // Suite 6: Cooldown Timing & Casting Lockout Simulation (25fps Engine Clock)
  // ==========================================================================
  describe('Suite 6: Cooldown Timing: Exact 25fps Ticks and Casting Lockout', () => {
    it('verifies exact 1.13c casting delay frame ticks for all 38 skills', () => {
      const expectedDelays: Record<number, number> = {
        223: 25, // Werewolf: 25 frames (1.0 sec)
        225: 15, // Firestorm: 15 frames (0.6 sec)
        229: 50, // Molten Boulder: 50 frames (2.0 sec)
      }

      for (const [idStr, def] of Object.entries(BATCH1_SKILLS)) {
        const id = Number(idStr)
        const expected = expectedDelays[id] ?? 0
        expect(getSkillCooldownTicks(id)).toBe(expected)
        expect(def.delay).toBe(expected)
      }
    })

    it('simulates full 25fps tick-down lifecycle for Werewolf (25 frames)', () => {
      const player = makeTestPlayer({ mana: 100, cooldown: 0 })
      const ctx: SkillExecutionContext = { caster: player, skillLevel: 1 }

      // Frame 0: Cast Werewolf -> sets cooldown = 25
      const initialCast = executeSkill(223, ctx)
      expect(initialCast.kind).toBe('buff')
      expect(player.cooldown).toBe(25)

      // Simulate 25 individual game loop frames at 25 fps
      for (let remaining = 25; remaining >= 1; remaining--) {
        expect(player.cooldown).toBe(remaining)

        // Attempting to cast Werewolf while cooldown > 0 must be locked out
        const blocked = executeSkill(223, ctx)
        expect(blocked.kind).toBe('cooldown')
        if (blocked.kind === 'cooldown') {
          expect(blocked.ticksLeft).toBe(remaining)
        }

        // Non-cooldown skills (Fire Bolt, Double Swing, Teleport) must NOT be locked out!
        const nonCd = executeSkill(36, ctx)
        expect(nonCd.kind).toBe('projectile')

        // Engine tick decrements cooldown by 1
        player.cooldown = Math.max(0, player.cooldown - 1)
      }

      // At frame 25 after 25 decrements: cooldown is exactly 0
      expect(player.cooldown).toBe(0)

      // Now Werewolf can be cast again successfully
      const secondCast = executeSkill(223, ctx)
      expect(secondCast.kind).toBe('buff')
      expect(player.cooldown).toBe(25)
    })

    it('simulates full 25fps tick-down lifecycle for Firestorm (15 frames)', () => {
      const player = makeTestPlayer({ mana: 100, cooldown: 0 })
      const ctx: SkillExecutionContext = { caster: player, skillLevel: 1 }

      const cast = executeSkill(225, ctx)
      expect(cast.kind).toBe('area')
      expect(player.cooldown).toBe(15)

      for (let remaining = 15; remaining >= 1; remaining--) {
        expect(player.cooldown).toBe(remaining)
        const blocked = executeSkill(225, ctx)
        expect(blocked.kind).toBe('cooldown')
        if (blocked.kind === 'cooldown') {
          expect(blocked.ticksLeft).toBe(remaining)
        }
        player.cooldown = Math.max(0, player.cooldown - 1)
      }

      expect(player.cooldown).toBe(0)
      expect(executeSkill(225, ctx).kind).toBe('area')
    })

    it('simulates full 25fps tick-down lifecycle for Molten Boulder (50 frames)', () => {
      const player = makeTestPlayer({ mana: 100, cooldown: 0 })
      const ctx: SkillExecutionContext = { caster: player, skillLevel: 1 }

      const cast = executeSkill(229, ctx)
      expect(cast.kind).toBe('projectile')
      expect(player.cooldown).toBe(50)

      for (let remaining = 50; remaining >= 1; remaining--) {
        expect(player.cooldown).toBe(remaining)
        const blocked = executeSkill(229, ctx)
        expect(blocked.kind).toBe('cooldown')
        if (blocked.kind === 'cooldown') {
          expect(blocked.ticksLeft).toBe(remaining)
        }
        player.cooldown = Math.max(0, player.cooldown - 1)
      }

      expect(player.cooldown).toBe(0)
      expect(executeSkill(229, ctx).kind).toBe('projectile')
    })

    it('enforces shared casting delay lockout across different delay skills', () => {
      const player = makeTestPlayer({ mana: 100, cooldown: 0 })
      const ctx: SkillExecutionContext = { caster: player, skillLevel: 1 }

      // Cast Firestorm (15 frame delay)
      executeSkill(225, ctx)
      expect(player.cooldown).toBe(15)

      // Werewolf (delay 25) and Molten Boulder (delay 50) must BOTH be locked out by the 15-frame active cooldown
      const ww = executeSkill(223, ctx)
      expect(ww.kind).toBe('cooldown')
      if (ww.kind === 'cooldown') expect(ww.ticksLeft).toBe(15)

      const mb = executeSkill(229, ctx)
      expect(mb.kind).toBe('cooldown')
      if (mb.kind === 'cooldown') expect(mb.ticksLeft).toBe(15)

      // Meanwhile, non-cooldown skills can still be cast
      const zeal = executeSkill(106, ctx)
      expect(zeal.kind).toBe('melee')
    })
  })

  // ==========================================================================
  // Suite 7: Comprehensive Input Hardening across skill-tree & skills
  // ==========================================================================
  describe('Suite 7: Input Hardening Against NaN, null, undefined, negatives, and infinities', () => {
    const adversarialInputs = [
      NaN,
      null as any,
      undefined as any,
      -1,
      -100,
      Infinity,
      -Infinity,
      'invalid' as any,
      {},
      [],
    ]

    describe('createSkillTreeState hardening', () => {
      it('safely normalizes any adversarial input to a non-negative integer pool', () => {
        for (const input of adversarialInputs) {
          const state = createSkillTreeState(input)
          expect(Number.isInteger(state.unspentPoints)).toBe(true)
          expect(Number.isFinite(state.unspentPoints)).toBe(true)
          expect(state.unspentPoints).toBeGreaterThanOrEqual(0)
          expect(state.hardPoints).toEqual({})
        }

        // Float points are floored
        expect(createSkillTreeState(5.9).unspentPoints).toBe(5)
        expect(createSkillTreeState(0.9).unspentPoints).toBe(0)
      })
    })

    describe('canAllocate & allocatePoint hardening', () => {
      it('safely rejects invalid skillIds without throwing', () => {
        const state = createSkillTreeState(10)
        for (const input of adversarialInputs) {
          expect(canAllocate(CANONICAL_SKILL_TREE, state, input, 30)).toBe(false)
          expect(allocatePoint(CANONICAL_SKILL_TREE, state, input, 30)).toBe(false)
          expect(state.unspentPoints).toBe(10)
        }
      })

      it('safely rejects invalid playerLevel values without throwing', () => {
        const state = createSkillTreeState(10)
        const invalidLevels = [NaN, null as any, undefined as any, -1, -50, -Infinity, 'abc' as any]
        for (const lvl of invalidLevels) {
          expect(canAllocate(CANONICAL_SKILL_TREE, state, 36, lvl)).toBe(false)
          expect(allocatePoint(CANONICAL_SKILL_TREE, state, 36, lvl)).toBe(false)
          expect(state.unspentPoints).toBe(10)
        }
      })

      it('safely rejects when state unspentPoints is corrupted', () => {
        const corruptedState1: SkillTreeState = { hardPoints: {}, unspentPoints: NaN }
        expect(canAllocate(CANONICAL_SKILL_TREE, corruptedState1, 36, 30)).toBe(false)

        const corruptedState2: SkillTreeState = { hardPoints: {}, unspentPoints: -5 }
        expect(canAllocate(CANONICAL_SKILL_TREE, corruptedState2, 36, 30)).toBe(false)

        const corruptedState3: SkillTreeState = { hardPoints: {}, unspentPoints: null as any }
        expect(canAllocate(CANONICAL_SKILL_TREE, corruptedState3, 36, 30)).toBe(false)
      })
    })

    describe('canDeallocate & deallocatePoint hardening', () => {
      it('safely rejects invalid skillIds without throwing', () => {
        const state = createSkillTreeState(10)
        state.hardPoints[36] = 5
        for (const input of adversarialInputs) {
          expect(canDeallocate(CANONICAL_SKILL_TREE, state, input)).toBe(false)
          expect(deallocatePoint(CANONICAL_SKILL_TREE, state, input)).toBe(false)
        }
      })

      it('safely rejects corrupted hardPoints values without throwing', () => {
        const state = createSkillTreeState(10)
        state.hardPoints[36] = NaN as any
        expect(canDeallocate(CANONICAL_SKILL_TREE, state, 36)).toBe(false)

        state.hardPoints[36] = -1
        expect(canDeallocate(CANONICAL_SKILL_TREE, state, 36)).toBe(false)

        state.hardPoints[36] = null as any
        expect(canDeallocate(CANONICAL_SKILL_TREE, state, 36)).toBe(false)
      })
    })

    describe('respec hardening', () => {
      it('resets allocated hardPoints and refunds points cleanly', () => {
        const state = createSkillTreeState(5)
        state.hardPoints[36] = 10
        state.hardPoints[47] = 5

        const refunded = respec(state)
        expect(refunded).toBe(15)
        expect(state.unspentPoints).toBe(20)
        expect(state.hardPoints[36]).toBe(0)
        expect(state.hardPoints[47]).toBe(0)
      })
    })

    describe('calculateSynergyMultiplier hardening', () => {
      it('returns 1.0 (no bonus) for invalid skillIds and damageTypes without throwing', () => {
        const state = createSkillTreeState(10)
        for (const input of adversarialInputs) {
          expect(calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, input)).toBe(1.0)
          expect(calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 36, input)).toBe(1.0)
        }
      })

      it('returns finite multiplier >= 1.0 even when hardPoints contains corrupted entries', () => {
        const state = createSkillTreeState(10)
        state.hardPoints[47] = NaN as any
        state.hardPoints[56] = -10 as any
        const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 36)
        expect(typeof mult).toBe('number')
        expect(Number.isFinite(mult)).toBe(true)
        expect(mult).toBeGreaterThanOrEqual(1.0)
      })
    })

    describe('getSkillManaCost hardening', () => {
      it('handles adversarial skillIds and effectiveLevels safely', () => {
        for (const input of adversarialInputs) {
          const c1 = getSkillManaCost(input, 1)
          expect(c1).toBe(0)

          const c2 = getSkillManaCost(36, input)
          expect(typeof c2).toBe('number')
          expect(Number.isFinite(c2)).toBe(true)
          expect(c2).toBeGreaterThanOrEqual(0)
        }
      })
    })

    describe('getSkillCooldownTicks hardening', () => {
      it('handles adversarial skillIds safely', () => {
        for (const input of adversarialInputs) {
          expect(getSkillCooldownTicks(input)).toBe(0)
        }
      })
    })

    describe('calculateSkillDamage hardening', () => {
      it('handles adversarial skillIds, levels, and synergy multipliers safely', () => {
        for (const input of adversarialInputs) {
          const d1 = calculateSkillDamage(input, 1)
          expect(d1).toEqual({ min: 0, max: 0 })

          const d2 = calculateSkillDamage(36, input)
          expect(Number.isFinite(d2.min)).toBe(true)
          expect(Number.isFinite(d2.max)).toBe(true)
          expect(d2.min).toBeGreaterThanOrEqual(0)
          expect(d2.max).toBeGreaterThanOrEqual(0)

          const d3 = calculateSkillDamage(36, 1, input)
          expect(Number.isFinite(d3.min)).toBe(true)
          expect(Number.isFinite(d3.max)).toBe(true)
          expect(d3.min).toBeGreaterThanOrEqual(0)
          expect(d3.max).toBeGreaterThanOrEqual(0)
        }
      })

      it('safely handles negative weapon damage without producing negative output', () => {
        const dmg = calculateSkillDamage(10, 1, 1.0, { min: -50, max: -20 })
        expect(dmg.min).toBeGreaterThanOrEqual(0)
        expect(dmg.max).toBeGreaterThanOrEqual(0)
      })
    })

    describe('executeSkill hardening', () => {
      it('safely handles unknown skill IDs without throwing', () => {
        const player = makeTestPlayer()
        for (const input of adversarialInputs) {
          const res = executeSkill(input, { caster: player, skillLevel: 1 })
          expect(res).toBeDefined()
          expect(res.kind).toBe('melee')
        }
      })

      it('safely handles zero-distance target without generating NaN velocities', () => {
        const player = makeTestPlayer({ x: 250, y: 350 })
        const res = executeSkill(36, {
          caster: player,
          target: { x: 250, y: 350 }, // Exact same spot
          skillLevel: 1,
        })
        expect(res.kind).toBe('projectile')
        if (res.kind === 'projectile') {
          expect(Number.isFinite(res.projectile.vx)).toBe(true)
          expect(Number.isFinite(res.projectile.vy)).toBe(true)
          expect(Number.isNaN(res.projectile.vx)).toBe(false)
          expect(Number.isNaN(res.projectile.vy)).toBe(false)
        }
      })

      it('safely handles invalid caster facing without throwing', () => {
        const invalidFacings = [-1, 8, 99, NaN as any]
        for (const facing of invalidFacings) {
          const player = makeTestPlayer({ facing })
          const res = executeSkill(36, { caster: player, skillLevel: 1 })
          expect(res.kind).toBe('projectile')
          if (res.kind === 'projectile') {
            expect(Number.isFinite(res.projectile.vx)).toBe(true)
            expect(Number.isFinite(res.projectile.vy)).toBe(true)
          }
        }
      })
    })
  })
})
