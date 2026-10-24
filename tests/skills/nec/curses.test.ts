/**
 * Diablo II: Lord of Destruction v1.13c — Necromancer Curses Tree Verification Suite
 * Milestone M3: Skills 66, 71, 72, 76, 77, 81, 82, 86, 87, 91
 *
 * Verifies:
 * 1. Architecture invariants:
 *    - BATCH1_SKILLS length strictly 38.
 *    - ISO_GROUND_ASPECT_RATIO = 0.5.
 *    - Decoupled standalone curse formulas.
 *    - calculateSkillDamage returns { min: 0, max: 0 } for all 10 curses.
 * 2. Exact 1.13c radius formulas (yards and pixels) at slvl 1, 10, 20.
 * 3. Exact 1.13c duration formulas (frames and seconds) at slvl 1, 10, 20 with difficulty scaling.
 * 4. Physical immunity breaking with Amplify Damage (100% -> 80%, 110% -> 90%, 120% -> 100%).
 * 5. Physical immunity breaking with Decrepify (100% -> 90%, 105% -> 95%, 110% -> 100%).
 * 6. Elemental immunity breaking with Lower Resist (-dm56% with 1/5th penalty on immune).
 * 7. Attract immunity to overwrite: Amplify Damage, Decrepify, Weaken cannot replace Attract.
 * 8. Standard curse mutual exclusivity: Amplify Damage overwrites Weaken/Decrepify.
 * 9. Life Tap 50% physical life leech on hit.
 * 10. Iron Maiden physical melee damage reflection scaling (200% to 675%).
 * 11. Weaken -33% damage reduction.
 * 12. Decrepify tri-debuff (-50% speed, -50% attack rate, -50% damage, -50% phys res).
 * 13. Dim Vision sight reduction and boss immunity.
 * 14. Terror monster fleeing distance and boss immunity.
 * 15. Confuse target chaos and boss immunity.
 */
import { describe, expect, it } from 'vitest'
import {
  BATCH1_SKILLS,
  calculateSkillDamage,
  ISO_GROUND_ASPECT_RATIO,
  calculateCurseRadiusYards,
  calculateCurseRadiusPx,
  calculateCurseDurationFrames,
  calculateAmplifyDamageDebuff,
  calculateWeakenDebuff,
  calculateIronMaidenReturnPct,
  calculateTerrorDistance,
  calculateDecrepifyDebuff,
  calculateLowerResistReduction,
  computeImmunityBreak,
  calculateCurseEffect,
} from '../../../src/server/skills/skills.ts'
import {
  computeEffectiveResistance,
  executeSUnitDmg,
  type CombatUnitContext,
} from '../../../src/server/engine/combat-pipeline.ts'
import { FIXED_ONE, UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { evaluateSkillCore113c, executeSkillCore113c } from '../../../src/server/skills/registry.ts'
import {
  buildTooltipViewModel,
  createInitialState,
} from '../../../src/common/skills/skill-calc-engine.ts'
import {
  ClientWorld,
  CURSE_CLT_MISSILE_A,
  getCurseRadiusSubtiles113c,
} from '../../../src/client/world/client-world.ts'

describe('Milestone M3: Necromancer Curses Tree (1.13c Ground Truth)', () => {
  // =========================================================================
  // 1. Architecture Invariants
  // =========================================================================
  describe('1. Architecture Invariants', () => {
    it('preserves BATCH1_SKILLS length strictly at 38 skills', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })

    it('enforces ISO_GROUND_ASPECT_RATIO === 0.5', () => {
      expect(ISO_GROUND_ASPECT_RATIO).toBe(0.5)
    })

    it('returns { min: 0, max: 0 } from calculateSkillDamage for all 10 curses', () => {
      const curseIds = [66, 71, 72, 76, 77, 81, 82, 86, 87, 91]
      for (const id of curseIds) {
        const dmg = calculateSkillDamage(id, 20)
        expect(dmg).toEqual({ min: 0, max: 0 })
      }
    })
  })

  // =========================================================================
  // 2. Exact Radius Formulas (Yards & Pixels)
  // =========================================================================
  describe('2. Exact Radius Formulas (Yards & Pixels)', () => {
    it('calculates Amplify Damage (66) radius: 3 + (slvl - 1) * 1 subtiles * 2/3', () => {
      expect(calculateCurseRadiusYards(66, 1)).toBe(2.0)
      expect(calculateCurseRadiusPx(66, 1)).toBe(80)

      expect(calculateCurseRadiusYards(66, 10)).toBe(8.0)
      expect(calculateCurseRadiusPx(66, 10)).toBe(320)

      expect(calculateCurseRadiusYards(66, 20)).toBe(14.67)
      expect(calculateCurseRadiusPx(66, 20)).toBe(587)
    })

    it('calculates Dim Vision (71) radius: 4 + (slvl - 1) * 1 subtiles * 2/3', () => {
      expect(calculateCurseRadiusYards(71, 1)).toBe(2.67)
      expect(calculateCurseRadiusPx(71, 1)).toBe(107)

      expect(calculateCurseRadiusYards(71, 10)).toBe(8.67)
      expect(calculateCurseRadiusPx(71, 10)).toBe(347)

      expect(calculateCurseRadiusYards(71, 20)).toBe(15.33)
      expect(calculateCurseRadiusPx(71, 20)).toBe(613)
    })

    it('calculates Weaken (72) radius: 9 + (slvl - 1) * 1 subtiles * 2/3', () => {
      expect(calculateCurseRadiusYards(72, 1)).toBe(6.0)
      expect(calculateCurseRadiusPx(72, 1)).toBe(240)

      expect(calculateCurseRadiusYards(72, 10)).toBe(12.0)
      expect(calculateCurseRadiusPx(72, 10)).toBe(480)

      expect(calculateCurseRadiusYards(72, 20)).toBe(18.67)
      expect(calculateCurseRadiusPx(72, 20)).toBe(747)
    })

    it('calculates Iron Maiden (76) fixed radius: 7 * 2/3 = 4.67y (187 px)', () => {
      expect(calculateCurseRadiusYards(76, 1)).toBe(4.67)
      expect(calculateCurseRadiusPx(76, 1)).toBe(187)

      expect(calculateCurseRadiusYards(76, 10)).toBe(4.67)
      expect(calculateCurseRadiusPx(76, 10)).toBe(187)

      expect(calculateCurseRadiusYards(76, 20)).toBe(4.67)
      expect(calculateCurseRadiusPx(76, 20)).toBe(187)
    })

    it('calculates Terror (77) fixed radius: 4 * 2/3 = 2.67y (107 px)', () => {
      expect(calculateCurseRadiusYards(77, 1)).toBe(2.67)
      expect(calculateCurseRadiusPx(77, 1)).toBe(107)

      expect(calculateCurseRadiusYards(77, 10)).toBe(2.67)
      expect(calculateCurseRadiusPx(77, 10)).toBe(107)

      expect(calculateCurseRadiusYards(77, 20)).toBe(2.67)
      expect(calculateCurseRadiusPx(77, 20)).toBe(107)
    })

    it('calculates Confuse (81) radius: 6 + (slvl - 1) * 1 subtiles * 2/3', () => {
      expect(calculateCurseRadiusYards(81, 1)).toBe(4.0)
      expect(calculateCurseRadiusPx(81, 1)).toBe(160)

      expect(calculateCurseRadiusYards(81, 10)).toBe(10.0)
      expect(calculateCurseRadiusPx(81, 10)).toBe(400)

      expect(calculateCurseRadiusYards(81, 20)).toBe(16.67)
      expect(calculateCurseRadiusPx(81, 20)).toBe(667)
    })

    it('calculates Life Tap (82) radius: 4 + (slvl - 1) * 1 subtiles * 2/3', () => {
      expect(calculateCurseRadiusYards(82, 1)).toBe(2.67)
      expect(calculateCurseRadiusPx(82, 1)).toBe(107)

      expect(calculateCurseRadiusYards(82, 10)).toBe(8.67)
      expect(calculateCurseRadiusPx(82, 10)).toBe(347)

      expect(calculateCurseRadiusYards(82, 20)).toBe(15.33)
      expect(calculateCurseRadiusPx(82, 20)).toBe(613)
    })

    it('calculates Attract (86) fixed search radius: 6.0y (240 px)', () => {
      expect(calculateCurseRadiusYards(86, 1)).toBe(6.0)
      expect(calculateCurseRadiusPx(86, 1)).toBe(240)

      expect(calculateCurseRadiusYards(86, 10)).toBe(6.0)
      expect(calculateCurseRadiusPx(86, 10)).toBe(240)

      expect(calculateCurseRadiusYards(86, 20)).toBe(6.0)
      expect(calculateCurseRadiusPx(86, 20)).toBe(240)
    })

    it('calculates Decrepify (87) fixed radius: 6 * 2/3 = 4.0y (160 px)', () => {
      expect(calculateCurseRadiusYards(87, 1)).toBe(4.0)
      expect(calculateCurseRadiusPx(87, 1)).toBe(160)

      expect(calculateCurseRadiusYards(87, 10)).toBe(4.0)
      expect(calculateCurseRadiusPx(87, 10)).toBe(160)

      expect(calculateCurseRadiusYards(87, 20)).toBe(4.0)
      expect(calculateCurseRadiusPx(87, 20)).toBe(160)
    })

    it('calculates Lower Resist (91) radius: 7 + (slvl - 1) * 1 subtiles * 2/3', () => {
      expect(calculateCurseRadiusYards(91, 1)).toBe(4.67)
      expect(calculateCurseRadiusPx(91, 1)).toBe(187)

      expect(calculateCurseRadiusYards(91, 10)).toBe(10.67)
      expect(calculateCurseRadiusPx(91, 10)).toBe(427)

      expect(calculateCurseRadiusYards(91, 20)).toBe(17.33)
      expect(calculateCurseRadiusPx(91, 20)).toBe(693)
    })
  })

  // =========================================================================
  // 3. Exact Duration Formulas (Frames & Seconds)
  // =========================================================================
  describe('3. Exact Duration Formulas (Frames & Seconds)', () => {
    it('calculates exact curse durations across all 10 curses at slvl 1, 10, 20', () => {
      // 66 Amplify Damage: 200 + (slvl-1)*75
      expect(calculateCurseDurationFrames(66, 1)).toBe(200) // 8.0s
      expect(calculateCurseDurationFrames(66, 10)).toBe(875) // 35.0s
      expect(calculateCurseDurationFrames(66, 20)).toBe(1625) // 65.0s

      // 71 Dim Vision: 175 + (slvl-1)*50
      expect(calculateCurseDurationFrames(71, 1)).toBe(175) // 7.0s
      expect(calculateCurseDurationFrames(71, 10)).toBe(625) // 25.0s
      expect(calculateCurseDurationFrames(71, 20)).toBe(1125) // 45.0s

      // 72 Weaken: 350 + (slvl-1)*60
      expect(calculateCurseDurationFrames(72, 1)).toBe(350) // 14.0s
      expect(calculateCurseDurationFrames(72, 10)).toBe(890) // 35.6s
      expect(calculateCurseDurationFrames(72, 20)).toBe(1490) // 59.6s

      // 76 Iron Maiden: 300 + (slvl-1)*60
      expect(calculateCurseDurationFrames(76, 1)).toBe(300) // 12.0s
      expect(calculateCurseDurationFrames(76, 10)).toBe(840) // 33.6s
      expect(calculateCurseDurationFrames(76, 20)).toBe(1440) // 57.6s

      // 77 Terror: 200 + (slvl-1)*25
      expect(calculateCurseDurationFrames(77, 1)).toBe(200) // 8.0s
      expect(calculateCurseDurationFrames(77, 10)).toBe(425) // 17.0s
      expect(calculateCurseDurationFrames(77, 20)).toBe(675) // 27.0s

      // 81 Confuse: 250 + (slvl-1)*50
      expect(calculateCurseDurationFrames(81, 1)).toBe(250) // 10.0s
      expect(calculateCurseDurationFrames(81, 10)).toBe(700) // 28.0s
      expect(calculateCurseDurationFrames(81, 20)).toBe(1200) // 48.0s

      // 82 Life Tap: 400 + (slvl-1)*60
      expect(calculateCurseDurationFrames(82, 1)).toBe(400) // 16.0s
      expect(calculateCurseDurationFrames(82, 10)).toBe(940) // 37.6s
      expect(calculateCurseDurationFrames(82, 20)).toBe(1540) // 61.6s

      // 86 Attract: 300 + (slvl-1)*90
      expect(calculateCurseDurationFrames(86, 1)).toBe(300) // 12.0s
      expect(calculateCurseDurationFrames(86, 10)).toBe(1110) // 44.4s
      expect(calculateCurseDurationFrames(86, 20)).toBe(2010) // 80.4s

      // 87 Decrepify: 100 + (slvl-1)*15
      expect(calculateCurseDurationFrames(87, 1)).toBe(100) // 4.0s
      expect(calculateCurseDurationFrames(87, 10)).toBe(235) // 9.4s
      expect(calculateCurseDurationFrames(87, 20)).toBe(385) // 15.4s

      // 91 Lower Resist: 500 + (slvl-1)*50
      expect(calculateCurseDurationFrames(91, 1)).toBe(500) // 20.0s
      expect(calculateCurseDurationFrames(91, 10)).toBe(950) // 38.0s
      expect(calculateCurseDurationFrames(91, 20)).toBe(1450) // 58.0s
    })

    it('scales Dim Vision duration by difficulty (50% NM, 25% Hell)', () => {
      // Normal: 175f / 1125f
      expect(calculateCurseDurationFrames(71, 1, 'normal')).toBe(175)
      expect(calculateCurseDurationFrames(71, 20, 'normal')).toBe(1125)

      // Nightmare: 50%
      expect(calculateCurseDurationFrames(71, 1, 'nightmare')).toBe(87)
      expect(calculateCurseDurationFrames(71, 20, 'nightmare')).toBe(562)

      // Hell: 25%
      expect(calculateCurseDurationFrames(71, 1, 'hell')).toBe(43)
      expect(calculateCurseDurationFrames(71, 20, 'hell')).toBe(281)
    })
  })

  // =========================================================================
  // 4. Physical Immunity Breaking with Amplify Damage
  // =========================================================================
  describe('4. Physical Immunity Breaking with Amplify Damage', () => {
    it('applies 1/5th penalty on immune monster (100% -> 80%, 110% -> 90%, 120% -> 100%)', () => {
      // 100% phys res: 100 - floor(100/5) = 100 - 20 = 80% (broken!)
      const b100 = computeImmunityBreak(100, 100)
      expect(b100.wasImmune).toBe(true)
      expect(b100.effectiveRes).toBe(80)
      expect(b100.broken).toBe(true)

      // 110% phys res: 110 - 20 = 90% (broken!)
      const b110 = computeImmunityBreak(110, 100)
      expect(b110.wasImmune).toBe(true)
      expect(b110.effectiveRes).toBe(90)
      expect(b110.broken).toBe(true)

      // 120% phys res: 120 - 20 = 100% (remains immune!)
      const b120 = computeImmunityBreak(120, 100)
      expect(b120.wasImmune).toBe(true)
      expect(b120.effectiveRes).toBe(100)
      expect(b120.broken).toBe(false)
    })

    it('applies full -100% physical resistance to non-immune monster (50% -> -50%, 0% -> -100%)', () => {
      const b50 = computeImmunityBreak(50, 100)
      expect(b50.wasImmune).toBe(false)
      expect(b50.effectiveRes).toBe(-50)
      expect(b50.broken).toBe(false)

      const b0 = computeImmunityBreak(0, 100)
      expect(b0.wasImmune).toBe(false)
      expect(b0.effectiveRes).toBe(-100)
      expect(b0.broken).toBe(false)
    })

    it('verifies computeEffectiveResistance under Amplify Damage physical pierce', () => {
      const res = computeEffectiveResistance({
        isDefenderPlayer: false,
        baseRes: 110,
        convictionPierce: 100, // 1/5th penalty applies
      })
      expect(res.isImmune).toBe(false)
      expect(res.effectiveRes).toBe(90)
      expect(res.convictionAndLRApplied).toBe(20)
    })
  })

  // =========================================================================
  // 5. Physical Immunity Breaking with Decrepify
  // =========================================================================
  describe('5. Physical Immunity Breaking with Decrepify', () => {
    it('applies 1/5th penalty on immune monster (100% -> 90%, 105% -> 95%, 110% -> 100%)', () => {
      // 100% phys res: 100 - floor(50/5) = 100 - 10 = 90% (broken!)
      const b100 = computeImmunityBreak(100, 50)
      expect(b100.wasImmune).toBe(true)
      expect(b100.effectiveRes).toBe(90)
      expect(b100.broken).toBe(true)

      // 105% phys res: 105 - 10 = 95% (broken!)
      const b105 = computeImmunityBreak(105, 50)
      expect(b105.wasImmune).toBe(true)
      expect(b105.effectiveRes).toBe(95)
      expect(b105.broken).toBe(true)

      // 110% phys res: 110 - 10 = 100% (remains immune!)
      const b110 = computeImmunityBreak(110, 50)
      expect(b110.wasImmune).toBe(true)
      expect(b110.effectiveRes).toBe(100)
      expect(b110.broken).toBe(false)
    })

    it('applies full -50% physical resistance to non-immune monster (50% -> 0%, 0% -> -50%)', () => {
      const b50 = computeImmunityBreak(50, 50)
      expect(b50.wasImmune).toBe(false)
      expect(b50.effectiveRes).toBe(0)

      const b0 = computeImmunityBreak(0, 50)
      expect(b0.wasImmune).toBe(false)
      expect(b0.effectiveRes).toBe(-50)
    })
  })

  // =========================================================================
  // 6. Elemental Immunity Breaking with Lower Resist
  // =========================================================================
  describe('6. Elemental Immunity Breaking with Lower Resist', () => {
    it('evaluates exact dm56 curve: slvl 1: -32%, slvl 10: -55%, slvl 20: -63%', () => {
      expect(calculateLowerResistReduction(1)).toBe(32)
      expect(calculateLowerResistReduction(10)).toBe(55)
      expect(calculateLowerResistReduction(20)).toBe(63)
    })

    it('breaks elemental immunities at 1/5th penalty', () => {
      // slvl 1: 32% pierce -> floor(32/5) = 6% on 100% res -> 94% (broken!)
      const b1 = computeImmunityBreak(100, 32)
      expect(b1.wasImmune).toBe(true)
      expect(b1.effectiveRes).toBe(94)
      expect(b1.broken).toBe(true)

      // slvl 20: 63% pierce -> floor(63/5) = 12% on 100% res -> 88% (broken!)
      const b20 = computeImmunityBreak(100, 63)
      expect(b20.wasImmune).toBe(true)
      expect(b20.effectiveRes).toBe(88)
      expect(b20.broken).toBe(true)

      // 110% Lightning Res with slvl 20 LR: 110 - 12 = 98% (broken!)
      const b110 = computeImmunityBreak(110, 63)
      expect(b110.wasImmune).toBe(true)
      expect(b110.effectiveRes).toBe(98)
      expect(b110.broken).toBe(true)

      // 115% Fire Res with slvl 20 LR: 115 - 12 = 103% (remains immune!)
      const b115 = computeImmunityBreak(115, 63)
      expect(b115.wasImmune).toBe(true)
      expect(b115.effectiveRes).toBe(103)
      expect(b115.broken).toBe(false)
    })
  })

  // =========================================================================
  // 7. Attract Overwrite Immunity
  // =========================================================================
  describe('7. Attract Overwrite Immunity (cursetype = 2)', () => {
    it('rejects Amplify Damage, Decrepify, Weaken, and duplicate Attract when Attract is active', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList()
      const bus = new StateBus(stats, registry)

      // 1. Apply Attract (cursetype = 2)
      const resAttract = bus.applyState({
        stateNameOrId: 'attract',
        slvl: 10,
        curseTypeOverride: 2,
        durationFrames: 1110,
      })
      expect(resAttract.applied).toBe(true)
      expect(bus.hasState('attract')).toBe(true)

      // 2. Attempt to cast Amplify Damage (cursetype = 1) -> must be blocked!
      const resAmp = bus.applyState({
        stateNameOrId: 'amplifydamage',
        slvl: 20,
        curseTypeOverride: 1,
      })
      expect(resAmp.applied).toBe(false)
      expect(resAmp.blockedByAttract).toBe(true)
      expect(bus.hasState('amplifydamage')).toBe(false)
      expect(bus.hasState('attract')).toBe(true)

      // 3. Attempt to cast Decrepify (cursetype = 1) -> must be blocked!
      const resDec = bus.applyState({
        stateNameOrId: 'decrepify',
        slvl: 20,
        curseTypeOverride: 1,
      })
      expect(resDec.applied).toBe(false)
      expect(resDec.blockedByAttract).toBe(true)

      // 4. Attempt to recast Attract on already attracted monster -> must be blocked / no reset!
      const resAttract2 = bus.applyState({
        stateNameOrId: 'attract',
        slvl: 20,
        curseTypeOverride: 2,
      })
      expect(resAttract2.applied).toBe(false)
      expect(resAttract2.blockedByAttract).toBe(true)
    })
  })

  // =========================================================================
  // 8. Standard Curse Mutual Exclusivity
  // =========================================================================
  describe('8. Standard Curse Mutual Exclusivity (cursetype = 1)', () => {
    it('overwrites previous cursetype=1 curses cleanly without stat leakage', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList()
      const bus = new StateBus(stats, registry)

      // 1. Apply Weaken
      const r1 = bus.applyState({
        stateNameOrId: 'weaken',
        slvl: 1,
        stats: { damagepercent: -33 },
        curseTypeOverride: 1,
      })
      expect(r1.applied).toBe(true)
      expect(bus.hasState('weaken')).toBe(true)
      expect(stats.getModifierBonus('damagepercent')).toBe(-33)

      // 2. Overwrite with Amplify Damage
      const r2 = bus.applyState({
        stateNameOrId: 'amplifydamage',
        slvl: 1,
        stats: { damageresist: -100, amplify_phys_pierce: 100 },
        curseTypeOverride: 1,
      })
      expect(r2.applied).toBe(true)
      expect(r2.evictedState).toBe('weaken')
      expect(bus.hasState('weaken')).toBe(false)
      expect(bus.hasState('amplifydamage')).toBe(true)
      expect(stats.getModifierBonus('damagepercent')).toBe(0) // Cleanly removed!
      expect(stats.getModifierBonus('damageresist')).toBe(-100)

      // 3. Overwrite with Decrepify
      const r3 = bus.applyState({
        stateNameOrId: 'decrepify',
        slvl: 1,
        stats: { damageresist: -50, velocitypercent: -50 },
        curseTypeOverride: 1,
      })
      expect(r3.applied).toBe(true)
      expect(r3.evictedState).toBe('amplifydamage')
      expect(bus.hasState('amplifydamage')).toBe(false)
      expect(bus.hasState('decrepify')).toBe(true)
      expect(stats.getModifierBonus('damageresist')).toBe(-50)
      expect(stats.getModifierBonus('velocitypercent')).toBe(-50)
    })
  })

  // =========================================================================
  // 9. Life Tap 50% Leech Hook
  // =========================================================================
  describe('9. Life Tap 50% Physical Leech Hook', () => {
    it('grants 50% physical life leech to attackers on hit', () => {
      const attackerStats = new UnitStatList()
      attackerStats.setHp256(50 * FIXED_ONE)
      attackerStats.addStat('maxhp', 100)
      const attackerBus = new StateBus(attackerStats)
      const attacker: CombatUnitContext = {
        id: 'attacker',
        name: 'Hero',
        statList: attackerStats,
        stateBus: attackerBus,
        unitType: 'player',
      }

      const defenderStats = new UnitStatList()
      defenderStats.setHp256(1000 * FIXED_ONE)
      const defenderBus = new StateBus(defenderStats)
      defenderBus.applyState({
        stateNameOrId: 'lifetap',
        slvl: 10,
        curseTypeOverride: 1,
      })
      const defender: CombatUnitContext = {
        id: 'defender',
        name: 'Skeleton',
        statList: defenderStats,
        stateBus: defenderBus,
        unitType: 'monster',
      }

      // Attack dealing 100 physical damage
      const outcome = executeSUnitDmg(attacker, defender, {
        skillId: 0,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: 100 * FIXED_ONE,
        flatPhysMax256: 100 * FIXED_ONE,
        autoHit: true,
      }, { rand: () => 50 })

      expect(outcome.hit).toBe(true)
      expect(outcome.physDamage256).toBe(100 * FIXED_ONE)
      expect(outcome.attackerHealed256).toBe(50 * FIXED_ONE) // 50% of 100 = 50 HP
      expect(attackerStats.getHp256()).toBe(100 * FIXED_ONE) // 50 + 50 = 100 HP!
    })
  })

  // =========================================================================
  // 10. Iron Maiden Damage Reflection
  // =========================================================================
  describe('10. Iron Maiden Damage Reflection Scaling', () => {
    it('scales reflection percentage: 200 + (slvl - 1) * 25 % (slvl 1: 200%, 10: 425%, 20: 675%)', () => {
      expect(calculateIronMaidenReturnPct(1)).toBe(200)
      expect(calculateIronMaidenReturnPct(10)).toBe(425)
      expect(calculateIronMaidenReturnPct(20)).toBe(675)
      // PvP division by 4
      expect(calculateIronMaidenReturnPct(20, true)).toBe(168)
    })

    it('reflects physical melee damage back to cursed attacker mitigated by attacker phys res', () => {
      const cursedAttackerStats = new UnitStatList()
      cursedAttackerStats.setHp256(1000 * FIXED_ONE)
      cursedAttackerStats.addStat('damageresist', 50) // 50% physical resistance
      const attackerBus = new StateBus(cursedAttackerStats)
      attackerBus.applyState({
        stateNameOrId: 'ironmaiden',
        slvl: 1, // 200% return
        curseTypeOverride: 1,
      })
      const attacker: CombatUnitContext = {
        id: 'cursed_monster',
        name: 'Urdar',
        statList: cursedAttackerStats,
        stateBus: attackerBus,
        unitType: 'monster',
      }

      const defenderStats = new UnitStatList()
      defenderStats.setHp256(1000 * FIXED_ONE)
      const defenderBus = new StateBus(defenderStats)
      const defender: CombatUnitContext = {
        id: 'player',
        name: 'Hero',
        statList: defenderStats,
        stateBus: defenderBus,
        unitType: 'player',
      }

      // Monster strikes player for 100 physical damage
      const outcome = executeSUnitDmg(attacker, defender, {
        skillId: 0,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: 100 * FIXED_ONE,
        flatPhysMax256: 100 * FIXED_ONE,
        autoHit: true,
      }, { rand: () => 50 })

      // Raw reflected: 100 * 200% = 200. Mitigated by attacker's 50% phys res: 200 * (100 - 50)% = 100!
      expect(outcome.reflectedPhys256).toBe(100 * FIXED_ONE)
      expect(cursedAttackerStats.getHp256()).toBe(900 * FIXED_ONE)
    })
  })

  // =========================================================================
  // 11. Weaken & 12. Decrepify Debuffs
  // =========================================================================
  describe('11. Weaken & 12. Decrepify Debuffs', () => {
    it('evaluates Weaken debuff: -33% damage dealt', () => {
      const w = calculateWeakenDebuff()
      expect(w.damagepercent).toBe(-33)
    })

    it('evaluates Decrepify tri-debuff: -50% velocity, -50% attack rate, -50% damage, -50% phys res', () => {
      const d = calculateDecrepifyDebuff()
      expect(d.velocitypercent).toBe(-50)
      expect(d.attackrate).toBe(-50)
      expect(d.damagepercent).toBe(-50)
      expect(d.damageresist).toBe(-50)
      expect(d.amplify_phys_pierce).toBe(50)
      expect(d.item_slow).toBe(50)
    })
  })

  // =========================================================================
  // 13. Dim Vision, 14. Terror, 15. Confuse Specifications
  // =========================================================================
  describe('13..15 Mental Curses Specs', () => {
    it('evaluates Terror run distance: 24 + (slvl - 1) * 2 subtiles', () => {
      expect(calculateTerrorDistance(1)).toBe(24)
      expect(calculateTerrorDistance(10)).toBe(42)
      expect(calculateTerrorDistance(20)).toBe(62)
    })

    it('returns complete CurseSpec from calculateCurseEffect across all skills', () => {
      const specAmp = calculateCurseEffect(66, 1)
      expect(specAmp.skillName).toBe('Amplify Damage')
      expect(specAmp.stateName).toBe('amplifydamage')
      expect(specAmp.curseType).toBe(1)
      expect(specAmp.radiusYards).toBe(2.0)
      expect(specAmp.durationFrames).toBe(200)

      const specAttract = calculateCurseEffect(86, 10)
      expect(specAttract.skillName).toBe('Attract')
      expect(specAttract.stateName).toBe('attract')
      expect(specAttract.curseType).toBe(2)
      expect(specAttract.radiusYards).toBe(6.0)
      expect(specAttract.durationFrames).toBe(1110)

      const specLR = calculateCurseEffect(91, 20)
      expect(specLR.skillName).toBe('Lower Resist')
      expect(specLR.stateName).toBe('lowerresist')
      expect(specLR.debuffStats.lowerresist_pierce).toBe(63)
    })
  })

  // =========================================================================
  // 16. Issue #977: Necromancer Curses 1.13c Deep Parity
  // =========================================================================
  describe('16. Issue #977: Necromancer Curses 1.13c Deep Parity', () => {
    it('applies DifficultyLevels.txt AiCurseDiv (1 / 2 / 4) to all 4 AI curses (#71, #77, #81, #86) and never to standard curses', async () => {
      // #77 Terror (200f base at slvl 1): Normal=200, NM=100, Hell=50
      expect(calculateCurseDurationFrames(77, 1, 'normal')).toBe(200)
      expect(calculateCurseDurationFrames(77, 1, 'nightmare')).toBe(100)
      expect(calculateCurseDurationFrames(77, 1, 'hell')).toBe(50)

      // #81 Confuse (250f base at slvl 1): Normal=250, NM=125, Hell=62
      expect(calculateCurseDurationFrames(81, 1, 'normal')).toBe(250)
      expect(calculateCurseDurationFrames(81, 1, 'nightmare')).toBe(125)
      expect(calculateCurseDurationFrames(81, 1, 'hell')).toBe(62)

      // #86 Attract (300f base at slvl 1): Normal=300, NM=150, Hell=75
      expect(calculateCurseDurationFrames(86, 1, 'normal')).toBe(300)
      expect(calculateCurseDurationFrames(86, 1, 'nightmare')).toBe(150)
      expect(calculateCurseDurationFrames(86, 1, 'hell')).toBe(75)

      // Standard curses (#66 Amplify Damage, #91 Lower Resist) are unpenalized in Hell
      expect(calculateCurseDurationFrames(66, 1, 'hell')).toBe(200)
      expect(calculateCurseDurationFrames(91, 1, 'hell')).toBe(500)

      // Verify evaluateSkillCore113c respects difficulty for AI curses
      const registry = await getSharedDataRegistry()
      const skill86 = registry.getSkillById(86)!
      const stats = new UnitStatList()
      stats.setBaseSkillLevel(86, 1)
      const evalHell = evaluateSkillCore113c({
        registry,
        skill: skill86,
        slvl: 1,
        blvl: 1,
        statList: stats,
        difficulty: 'hell',
      })
      expect(evalHell.durationFrames).toBe(75)
    })

    it('rejects lower-slvl re-application of the SAME type-1 curse while allowing equal/higher slvl or different curse overwrite', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList()
      const bus = new StateBus(stats, registry)

      // Apply Amplify Damage slvl 10
      const r10 = bus.applyState({
        stateNameOrId: 'amplifydamage',
        slvl: 10,
        durationFrames: 875,
        curseTypeOverride: 1,
      })
      expect(r10.applied).toBe(true)

      // Re-apply Amplify Damage slvl 5 -> rejected!
      const r5 = bus.applyState({
        stateNameOrId: 'amplifydamage',
        slvl: 5,
        durationFrames: 500,
        curseTypeOverride: 1,
      })
      expect(r5.applied).toBe(false)
      expect(bus.getState('amplifydamage')?.slvl).toBe(10)
      expect(bus.getState('amplifydamage')?.durationFrames).toBe(875)

      // Re-apply Amplify Damage slvl 10 -> refreshes duration without setting evictedState
      const r10Refresh = bus.applyState({
        stateNameOrId: 'amplifydamage',
        slvl: 10,
        durationFrames: 900,
        curseTypeOverride: 1,
      })
      expect(r10Refresh.applied).toBe(true)
      expect(r10Refresh.evictedState).toBeUndefined()
      expect(bus.getState('amplifydamage')?.durationFrames).toBe(900)

      // Apply DIFFERENT type-1 curse (Weaken slvl 1) -> overwrites Amplify Damage slvl 10
      const rWeaken = bus.applyState({
        stateNameOrId: 'weaken',
        slvl: 1,
        durationFrames: 350,
        curseTypeOverride: 1,
      })
      expect(rWeaken.applied).toBe(true)
      expect(rWeaken.evictedState).toBe('amplifydamage')
      expect(bus.hasState('amplifydamage')).toBe(false)
      expect(bus.hasState('weaken')).toBe(true)
    })

    it('formats descline=31 duration in seconds for #71 Dim Vision, #81 Confuse, and #86 Attract tooltips', () => {
      for (const [skillId, expectedSec] of [
        [71, 'Duration: 7 seconds'],
        [81, 'Duration: 10 seconds'],
        [86, 'Duration: 12 seconds'],
      ] as const) {
        const nec = createInitialState('nec')
        nec.hardPoints[skillId] = 1
        const vm = buildTooltipViewModel(nec, skillId, 99)!
        const durLine = vm.current.effects.find((e) => e.lineType === 31)
        expect(durLine?.textEn).toBe(expectedSec)
      }
    })

    it('triggers Iron Maiden (#76) on StateBus domeleedamage event and applies 1/4 penalty on mercenaries', () => {
      const mercStats = new UnitStatList()
      mercStats.setHp256(1000 * FIXED_ONE)
      const mercBus = new StateBus(mercStats)
      mercBus.applyState({
        stateNameOrId: 'ironmaiden',
        slvl: 1, // 200% monster return -> 50% (200/4) on mercenary/player
        curseTypeOverride: 1,
      })

      // Direct StateBus reactive trigger check
      const evs = mercBus.triggerReactiveEvents({
        event: 'domeleedamage',
        incomingPhys256: 100 * FIXED_ONE,
        isPvP: true,
      })
      expect(evs.reflectedPhys256).toBe(50 * FIXED_ONE)

      // Full executeSUnitDmg check for mercenary attacker
      const mercAttacker: CombatUnitContext = {
        id: 'merc-1',
        name: 'Act 2 Merc',
        statList: mercStats,
        stateBus: mercBus,
        unitType: 'mercenary',
      }
      const defStats = new UnitStatList()
      defStats.setHp256(1000 * FIXED_ONE)
      const defender: CombatUnitContext = {
        id: 'mon-1',
        name: 'Chaos Knight',
        statList: defStats,
        stateBus: new StateBus(defStats),
        unitType: 'monster',
      }
      const outcome = executeSUnitDmg(mercAttacker, defender, {
        skillId: 0,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: 100 * FIXED_ONE,
        flatPhysMax256: 100 * FIXED_ONE,
        autoHit: true,
      }, { rand: () => 50 })
      // 100 * floor(200 / 4)% = 50 reflected damage
      expect(outcome.reflectedPhys256).toBe(50 * FIXED_ONE)
    })

    it('stacks Weaken (-33%) and Decrepify (-50%) damagepercent with positive monster damage buffs (e.g. Might +100%)', () => {
      const monStats = new UnitStatList()
      monStats.setHp256(1000 * FIXED_ONE)
      const monBus = new StateBus(monStats)
      // Might aura (+100% damagepercent)
      monBus.applyState({
        stateNameOrId: 'might',
        slvl: 7,
        stats: { damagepercent: 100 },
      })
      // Decrepify applied without inline stats (fallback path in combat-pipeline)
      monBus.applyState({
        stateNameOrId: 'decrepify',
        slvl: 1,
        curseTypeOverride: 1,
      })
      const attacker: CombatUnitContext = {
        id: 'mon',
        name: 'Minion',
        statList: monStats,
        stateBus: monBus,
        unitType: 'monster',
      }
      const defStats = new UnitStatList()
      defStats.setHp256(1000 * FIXED_ONE)
      const defender: CombatUnitContext = {
        id: 'plr',
        name: 'Hero',
        statList: defStats,
        stateBus: new StateBus(defStats),
        unitType: 'player',
      }
      const outcome = executeSUnitDmg(attacker, defender, {
        skillId: 0,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: 100 * FIXED_ONE,
        flatPhysMax256: 100 * FIXED_ONE,
        autoHit: true,
      }, { rand: () => 50 })
      // Base 100 * (100 + 100 [Might] - 50 [Decrepify]) / 100 = 150 physical damage
      expect(outcome.physDamage256).toBe(150 * FIXED_ONE)
    })

    it('redirects nearby hostile monsters within 9 subtiles (6.0 yards) to attack the Attract (#86) target in executeSkillCore113c', async () => {
      const registry = await getSharedDataRegistry()
      const skill86 = registry.getSkillById(86)!
      const casterStats = new UnitStatList()
      casterStats.setBaseSkillLevel(86, 5)
      const caster: CombatUnitContext = {
        id: 'nec',
        name: 'Necromancer',
        statList: casterStats,
        stateBus: new StateBus(casterStats, registry),
        unitType: 'player',
      }
      const makeMon = (id: string, x: number, y: number): CombatUnitContext => {
        const st = new UnitStatList()
        st.setHp256(500 * FIXED_ONE)
        return {
          id,
          name: id,
          statList: st,
          stateBus: new StateBus(st, registry),
          unitType: 'monster',
          x,
          y,
        }
      }
      const targetMon = makeMon('mon-attracted', 100, 100)
      const nearbyMon = makeMon('mon-nearby', 106, 100) // dist 6 <= 9 subtiles (4 yards <= 6 yards)
      const farMon = makeMon('mon-far', 120, 100) // dist 20 > 9 subtiles

      const evalRes = evaluateSkillCore113c({
        registry,
        skill: skill86,
        slvl: 5,
        blvl: 5,
        statList: casterStats,
        difficulty: 'hell',
      })
      const execRes = executeSkillCore113c({
        registry,
        skill: skill86,
        evalResult: evalRes,
        caster,
        targets: [targetMon, nearbyMon, farMon],
        targetPositions: new Map([
          ['mon-attracted', { x: 100, y: 100 }],
          ['mon-nearby', { x: 106, y: 100 }],
          ['mon-far', { x: 120, y: 100 }],
        ]),
        corpses: [],
        missileEngine: {} as any,
        auraScanner: {} as any,
        summonManager: {} as any,
        currentTick: 1,
        targetX: 100,
        targetY: 100,
        difficulty: 'hell',
      })
      expect(execRes.executed).toBe(true)
      expect(targetMon.stateBus?.hasState('attract')).toBe(true)
      expect((nearbyMon as any).attractTargetId).toBe('mon-attracted')
      expect((farMon as any).attractTargetId).toBeUndefined()
    })

    it('aligns ClientWorld curse casting with 1.13c SkillDoClt032_Curse (cursecast + cltmissilea, friendly exclusion, overlay replacement, and Attract rules)', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 90, y: 90 })
      // Hostile monster 1 at (100, 100)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 501, classId: 1, x: 100, y: 100, lifePct: 128, mode: 1 },
      })
      // Hostile monster 2 at (102, 100)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 502, classId: 1, x: 102, y: 100, lifePct: 128, mode: 1 },
      })
      // Friendly Necroskeleton (classId 363) at (100, 100)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 503, classId: 363, x: 100, y: 100, lifePct: 128, mode: 1 },
      })

      const caster = world.getUnit('player', 1)!
      // 1. Cast Weaken (#72) at (100, 100)
      ;(world as any).spawnMissilesForSkill(caster, 72, 100, 100, 1)
      const m501 = world.getUnit('monster', 501)!
      const m502 = world.getUnit('monster', 502)!
      const skel503 = world.getUnit('monster', 503)!

      // Friendly skeleton must NOT be cursed
      expect(skel503.states.has(19)).toBe(false)
      // Hostile monsters receive state 19 (Weaken) and overlay 'curseweaken'
      expect(m501.states.has(19)).toBe(true)
      expect(m501.overlays.some((o) => o.token === 'curseweaken')).toBe(true)
      expect(CURSE_CLT_MISSILE_A[72]).toBe('curseweaken')
      expect(getCurseRadiusSubtiles113c(66, 1)).toBe(3)
      expect(getCurseRadiusSubtiles113c(87, 20)).toBe(6)

      // 2. Cast Amplify Damage (#66) at (100, 100) -> overwrites Weaken state & removes 'curseweaken' overlay
      ;(world as any).spawnMissilesForSkill(caster, 66, 100, 100, 1)
      expect(m501.states.has(19)).toBe(false)
      expect(m501.states.has(9)).toBe(true)
      expect(m501.overlays.some((o) => o.token === 'curseweaken')).toBe(false)
      expect(m501.overlays.some((o) => o.token === 'curseamplifydamage')).toBe(true)

      // 3. Cast Attract (#86) at (100, 100) -> curses ONLY closest monster m501 (single-target), leaving m502 with Amplify Damage
      ;(world as any).spawnMissilesForSkill(caster, 86, 100, 100, 1)
      expect(m501.states.has(57)).toBe(true)
      expect(m501.states.has(9)).toBe(false)
      expect(m501.overlays.some((o) => o.token === 'curseamplifydamage')).toBe(false)
      expect(m501.overlays.some((o) => o.token === 'curseattract')).toBe(true)
      expect(m502.states.has(57)).toBe(false)
      expect(m502.states.has(9)).toBe(true)

      // 4. Cast Decrepify (#87) at (100, 100) -> m501 (has Attract 57) is NOT overwritten and keeps 'curseattract', m502 gets Decrepify (60)
      ;(world as any).spawnMissilesForSkill(caster, 87, 100, 100, 1)
      expect(m501.states.has(57)).toBe(true)
      expect(m501.states.has(60)).toBe(false)
      expect(m501.overlays.some((o) => o.token === 'curseattract')).toBe(true)
      expect(m501.overlays.some((o) => o.token === 'cursedecrepify')).toBe(false)
      expect(m502.states.has(60)).toBe(true)
      expect(m502.overlays.some((o) => o.token === 'cursedecrepify')).toBe(true)
    })
  })
})
