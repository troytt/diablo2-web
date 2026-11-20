import { describe, it, expect } from 'vitest'
import {
  calculateHitChance,
  calculatePlayerBlockChance,
  calculateCriticalChance,
  evaluateCriticalAndDeadlyStrike,
  calculateCrushingBlowDamage,
  calculateOpenWoundsDamage,
  calculateLeech,
  calculateFreezeTarget,
  calculateResistanceFactor,
  calculateResistanceReduction,
  calculateMonsterRegeneration,
  evaluatePreventMonsterHeal,
  calculateKnockbackSuccess,
  calculateSlowTarget,
  calculateHitBlindsTarget,
  calculateHitCausesFlee,
  calculatePhysicalWeaponDamage,
  calculatePoisonStack,
  checkHitRecovery,
  calculateAttack,
  D2_EXPERIENCE_TABLE_99,
  getExperienceForLevel,
  getNextLevelExperience,
  getExperienceTable,
  parseExperienceTable,
  EXPERIENCE_TABLE_BY_CLASS,
} from '../src/common/skills/formulas.ts'

describe('Diablo II Combat Mathematics (Issue #24 / M9)', () => {
  describe('calculateHitChance (AR vs DR)', () => {
    it('calculates exact 50% hit chance when AR == DR and AttackerLevel == DefenderLevel', () => {
      // 100% * (2 * 1000 / (1000 + 1000)) * (20 / (20 + 20)) = 100% * 1 * 0.5 = 50%
      const chance = calculateHitChance(1000, 1000, 20, 20)
      expect(chance).toBe(50)
    })

    it('clamps upper bound to 95% even with overwhelmingly high AR and level advantage', () => {
      const chance = calculateHitChance(50000, 10, 90, 1)
      expect(chance).toBe(95)
    })

    it('clamps lower bound to 5% even with tiny AR and severe level disadvantage', () => {
      const chance = calculateHitChance(10, 50000, 1, 90)
      expect(chance).toBe(5)
    })

    it('accurately reproduces community calculator scenario (Level 25 Paladin vs Level 20 Monster)', () => {
      const chance = calculateHitChance(1200, 800, 25, 20)
      expect(chance).toBeCloseTo(66.67, 1)
    })

    it('handles Ignore Target Defense (ITD) against normal monsters vs bosses', () => {
      // Normal monster: ITD treats defense as 0.
      // 100% * (2 * 1000 / (1000 + 0)) * (20 / (20 + 20)) = 100% * 2 * 0.5 = 100% -> clamped to 95%
      const normalWithItd = calculateHitChance(1000, 10000, 20, 20, { ignoreTargetDefense: true, isBossOrChampion: false })
      expect(normalWithItd).toBe(95)

      // Boss / Champion: ITD fails! Retains full 10000 defense.
      const bossWithItd = calculateHitChance(1000, 10000, 20, 20, { ignoreTargetDefense: true, isBossOrChampion: true })
      // 100% * (2000 / 11000) * 0.5 = 9.09%
      expect(bossWithItd).toBeCloseTo(9.09, 1)
    })

    it('halves -% Target Defense against bosses (50% effectiveness)', () => {
      // Normal monster: -50% defense reduces 1000 to 500.
      const normalDefRed = calculateHitChance(1000, 1000, 20, 20, { targetDefenseReductionPercent: 50, isBossOrChampion: false })
      // 100% * (2000 / 1500) * 0.5 = 66.67%
      expect(normalDefRed).toBeCloseTo(66.67, 1)

      // Boss: -50% defense only reduces 25% (defense 1000 -> 750).
      const bossDefRed = calculateHitChance(1000, 1000, 20, 20, { targetDefenseReductionPercent: 50, isBossOrChampion: true })
      // 100% * (2000 / 1750) * 0.5 = 57.14%
      expect(bossDefRed).toBeCloseTo(57.14, 1)
    })

    it('treats defender DR as 0 when target is running', () => {
      const runningChance = calculateHitChance(1000, 50000, 20, 20, { isTargetRunning: true })
      expect(runningChance).toBe(95)
    })
  })

  describe('calculatePlayerBlockChance (Shield Blocking)', () => {
    it('returns 0% if character has <= 15 dexterity or no shield block', () => {
      expect(calculatePlayerBlockChance(50, 15, 30)).toBe(0)
      expect(calculatePlayerBlockChance(0, 100, 30)).toBe(0)
    })

    it('calculates standard max-block target: 75% cap reached with sufficient dexterity', () => {
      const block = calculatePlayerBlockChance(75, 150, 50)
      expect(block).toBe(75)
    })

    it('calculates partial block correctly', () => {
      const block = calculatePlayerBlockChance(50, 50, 40)
      expect(block).toBe(21)
    })

    it('reduces block to 1/3 and caps at 25% when running', () => {
      const blockRunning = calculatePlayerBlockChance(75, 150, 50, true)
      expect(blockRunning).toBe(25)

      const partialRunning = calculatePlayerBlockChance(50, 50, 40, true)
      expect(partialRunning).toBe(7)
    })
  })

  describe('Critical Strike (CS) vs Deadly Strike (DS)', () => {
    it('calculates combined double damage chance (P = CS + DS * (1 - CS))', () => {
      expect(calculateCriticalChance(25, 0)).toBe(25)
      expect(calculateCriticalChance(0, 30)).toBe(30)
      expect(calculateCriticalChance(20, 50)).toBe(60)
      expect(calculateCriticalChance(50, 50)).toBe(75)
      expect(calculateCriticalChance(100, 100)).toBe(100)
    })

    it('evaluates CS first, and bypasses DS roll if CS procs', () => {
      const rolls = [0.10] // CS roll is 10% (< 50% CS)
      let idx = 0
      const res = evaluateCriticalAndDeadlyStrike(50, 50, () => rolls[idx++] ?? 0)
      expect(res.isCritical).toBe(true)
      expect(res.triggeredBy).toBe('critical_strike')
      expect(res.csRoll).toBe(10)
      expect(res.dsRoll).toBe(0) // DS roll skipped
    })

    it('evaluates DS if CS roll fails', () => {
      const rolls = [0.80, 0.20] // CS roll is 80% (fails), DS roll is 20% (< 50% DS -> procs!)
      let idx = 0
      const res = evaluateCriticalAndDeadlyStrike(50, 50, () => rolls[idx++] ?? 0)
      expect(res.isCritical).toBe(true)
      expect(res.triggeredBy).toBe('deadly_strike')
      expect(res.csRoll).toBe(80)
      expect(res.dsRoll).toBe(20)
    })

    it('returns none if both CS and DS fail', () => {
      const rolls = [0.80, 0.90] // CS roll 80%, DS roll 90%
      let idx = 0
      const res = evaluateCriticalAndDeadlyStrike(50, 50, () => rolls[idx++] ?? 0)
      expect(res.isCritical).toBe(false)
      expect(res.triggeredBy).toBe('none')
    })
  })

  describe('calculateCrushingBlowDamage', () => {
    it('deals 25% of current HP on melee hit against normal monster', () => {
      expect(calculateCrushingBlowDamage(1000, 'normal', false)).toBe(250)
      expect(calculateCrushingBlowDamage(1000, false, false)).toBe(250) // backward-compatibility
    })

    it('deals 12.5% of current HP on ranged hit against normal monster', () => {
      expect(calculateCrushingBlowDamage(1000, 'normal', true)).toBe(125)
      expect(calculateCrushingBlowDamage(1000, false, true)).toBe(125)
    })

    it('deals 12.5% of current HP on melee hit against boss', () => {
      expect(calculateCrushingBlowDamage(1000, 'boss', false)).toBe(125)
      expect(calculateCrushingBlowDamage(1000, true, false)).toBe(125)
    })

    it('deals 6.25% of current HP on ranged hit against boss', () => {
      expect(calculateCrushingBlowDamage(1000, 'boss', true)).toBe(62)
      expect(calculateCrushingBlowDamage(1000, true, true)).toBe(62)
    })

    it('deals 10% melee / 5% ranged on player tier (PvP)', () => {
      expect(calculateCrushingBlowDamage(1000, 'player', false)).toBe(100)
      expect(calculateCrushingBlowDamage(1000, 'player', true)).toBe(50)
    })

    it('reduces CB damage by target physical resistance (DR%)', () => {
      // 1000 HP, normal melee = 250 base. With 50% physical resistance -> 125
      expect(calculateCrushingBlowDamage(1000, 'normal', false, 50)).toBe(125)
      // With 75% physical resistance -> 62
      expect(calculateCrushingBlowDamage(1000, 'normal', false, 75)).toBe(62)
    })

    it('completely negates CB if target has 100% or greater physical resistance (Physical Immune)', () => {
      expect(calculateCrushingBlowDamage(1000, 'normal', false, 100)).toBe(0)
      expect(calculateCrushingBlowDamage(1000, 'normal', false, 120)).toBe(0)
    })

    it('does NOT amplify CB damage when physical resistance is negative (e.g. Amplify Damage / Decrepify)', () => {
      // 1000 HP base = 250. Negative DR cannot increase CB damage above 1.0 factor!
      expect(calculateCrushingBlowDamage(1000, 'normal', false, -50)).toBe(250)
      expect(calculateCrushingBlowDamage(1000, 'normal', false, -100)).toBe(250)
    })
  })

  describe('calculateOpenWoundsDamage (OW 200-frame level formula)', () => {
    it('calculates exact damage for Level 1–15 bracket', () => {
      // Level 10: 9 * 10 + 31 = 121 / 256 HP/frame. 200 frames: floor(121 * 200 / 256) = 94 HP
      const ow = calculateOpenWoundsDamage(10, 'normal', false)
      expect(ow.lifeDrainPerFrame).toBe(121)
      expect(ow.totalDamage200Frames).toBe(94)
      expect(ow.durationSeconds).toBe(8.0)
    })

    it('calculates exact damage for Level 16–30 bracket', () => {
      // Level 25: 18 * 25 - 104 = 346 / 256. 200 frames: floor(346 * 200 / 256) = 270 HP
      const ow = calculateOpenWoundsDamage(25, 'normal', false)
      expect(ow.lifeDrainPerFrame).toBe(346)
      expect(ow.totalDamage200Frames).toBe(270)
    })

    it('calculates exact damage for Level 31–45 bracket', () => {
      // Level 40: 27 * 40 - 374 = 706 / 256. 200 frames: floor(706 * 200 / 256) = 551 HP
      const ow = calculateOpenWoundsDamage(40, 'normal', false)
      expect(ow.lifeDrainPerFrame).toBe(706)
      expect(ow.totalDamage200Frames).toBe(551)
    })

    it('calculates exact damage for Level 46–60 bracket', () => {
      // Level 55: 36 * 55 - 779 = 1201 / 256. 200 frames: floor(1201 * 200 / 256) = 938 HP
      const ow = calculateOpenWoundsDamage(55, 'normal', false)
      expect(ow.lifeDrainPerFrame).toBe(1201)
      expect(ow.totalDamage200Frames).toBe(938)
    })

    it('calculates exact damage for Level >60 bracket', () => {
      // Level 80: 45 * 80 - 1319 = 2281 / 256. 200 frames: floor(2281 * 200 / 256) = 1782 HP
      const ow = calculateOpenWoundsDamage(80, 'normal', false)
      expect(ow.lifeDrainPerFrame).toBe(2281)
      expect(ow.totalDamage200Frames).toBe(1782)
    })

    it('halves damage against Bosses (0.5 modifier)', () => {
      // Level 80 against Boss: 1782 / 2 = 891 HP
      const owBoss = calculateOpenWoundsDamage(80, 'boss', false)
      expect(owBoss.modifierFactor).toBe(0.5)
      expect(owBoss.totalDamage200Frames).toBe(891)
    })

    it('applies player modifiers (0.25 melee / 0.125 ranged)', () => {
      const owPlayerMelee = calculateOpenWoundsDamage(80, 'player', false)
      expect(owPlayerMelee.modifierFactor).toBe(0.25)
      expect(owPlayerMelee.totalDamage200Frames).toBe(445)

      const owPlayerRanged = calculateOpenWoundsDamage(80, 'player', true)
      expect(owPlayerRanged.modifierFactor).toBe(0.125)
      expect(owPlayerRanged.totalDamage200Frames).toBe(222)
    })
  })

  describe('calculateLeech (Life & Mana Steal)', () => {
    it('leeches correctly in Normal difficulty with 100% drain effectiveness', () => {
      // 100 physical damage, 10% LL, 5% ML
      const leech = calculateLeech(100, 10, 5, 100, 'normal')
      expect(leech.lifeLeeched).toBe(10)
      expect(leech.manaLeeched).toBe(5)
    })

    it('applies 50% penalty in Nightmare and 33.3% penalty in Hell', () => {
      // 100 physical damage, 20% LL
      const leechNM = calculateLeech(100, 20, 0, 100, 'nightmare')
      expect(leechNM.lifeLeeched).toBe(10) // 20 * 0.5 = 10

      const leechHell = calculateLeech(100, 30, 0, 100, 'hell')
      expect(leechHell.lifeLeeched).toBe(10) // 30 * (1/3) = 10
    })

    it('returns 0 leech against targets with 0% drain effectiveness (e.g. Skeletons)', () => {
      const leechSkeleton = calculateLeech(500, 20, 20, 0, 'normal')
      expect(leechSkeleton.lifeLeeched).toBe(0)
      expect(leechSkeleton.manaLeeched).toBe(0)
    })

    it('returns 0 leech if physical damage dealt is 0', () => {
      const leechZeroDmg = calculateLeech(0, 20, 20, 100, 'normal')
      expect(leechZeroDmg.lifeLeeched).toBe(0)
      expect(leechZeroDmg.manaLeeched).toBe(0)
    })
  })

  describe('calculateFreezeTarget', () => {
    it('calculates freeze chance and duration on normal monster', () => {
      // Bonus = 1, AttLvl = 30, DefLvl = 20, Melee:
      // Chance = 5 * (4*1 + 30 - 20) + 30 = 5 * 14 + 30 = 100%
      const res = calculateFreezeTarget(1, 30, 20, 'normal', false, 'normal', () => 0.10)
      expect(res.willFreeze).toBe(true)
      expect(res.isChilledOnly).toBe(false)
      expect(res.durationSeconds).toBeGreaterThan(0)
    })

    it('falls back to chill on Bosses without hard-freezing', () => {
      const resBoss = calculateFreezeTarget(2, 50, 50, 'boss', false, 'normal', () => 0.05)
      expect(resBoss.willFreeze).toBe(false)
      expect(resBoss.isChilledOnly).toBe(true)
      expect(resBoss.durationSeconds).toBe(3.0)
    })
  })

  describe('calculateResistanceFactor (Elemental Resistances & Immunities)', () => {
    it('handles immunity at 100% or higher', () => {
      const res100 = calculateResistanceFactor(100)
      expect(res100.isImmune).toBe(true)
      expect(res100.factor).toBe(0)

      const res120 = calculateResistanceFactor(120)
      expect(res120.isImmune).toBe(true)
      expect(res120.factor).toBe(0)
    })

    it('handles normal resistance (0% to 99%)', () => {
      expect(calculateResistanceFactor(0).factor).toBe(1.0)
      expect(calculateResistanceFactor(50).factor).toBe(0.5)
      expect(calculateResistanceFactor(75).factor).toBe(0.25)
    })

    it('handles negative resistance (amplified damage up to 2x at -100%)', () => {
      expect(calculateResistanceFactor(-50).factor).toBe(1.5)
      expect(calculateResistanceFactor(-100).factor).toBe(2.0)
      expect(calculateResistanceFactor(-150).factor).toBe(2.0)
    })
  })

  describe('checkHitRecovery', () => {
    it('triggers 100% when damage >= 25% of MaxHP', () => {
      const check = checkHitRecovery(30, 100, 0.99)
      expect(check.chancePercent).toBe(100)
      expect(check.triggered).toBe(true)
    })

    it('triggers 50% chance when 12.5% <= damage < 25% of MaxHP', () => {
      const checkPass = checkHitRecovery(20, 100, 0.40)
      expect(checkPass.chancePercent).toBe(50)
      expect(checkPass.triggered).toBe(true)

      const checkFail = checkHitRecovery(20, 100, 0.60)
      expect(checkFail.chancePercent).toBe(50)
      expect(checkFail.triggered).toBe(false)
    })

    it('triggers 25% chance when 6.25% <= damage < 12.5% of MaxHP', () => {
      const checkPass = checkHitRecovery(10, 100, 0.20)
      expect(checkPass.chancePercent).toBe(25)
      expect(checkPass.triggered).toBe(true)

      const checkFail = checkHitRecovery(10, 100, 0.30)
      expect(checkFail.chancePercent).toBe(25)
      expect(checkFail.triggered).toBe(false)
    })

    it('does not trigger when damage < 6.25% of MaxHP', () => {
      const check = checkHitRecovery(5, 100, 0.01)
      expect(check.chancePercent).toBe(0)
      expect(check.triggered).toBe(false)
    })
  })

  describe('calculateAttack integrated', () => {
    it('correctly reports a miss when hitRoll exceeds hitChancePercent', () => {
      const result = calculateAttack(
        10, 100,
        { physicalMin: 10, physicalMax: 20 },
        { level: 20, defense: 500, blockPercent: 0, currentHp: 100, maxHp: 100 },
        {},
        () => 0.90,
      )
      expect(result.isHit).toBe(false)
      expect(result.totalDamage).toBe(0)
    })

    it('correctly reports blocked hit and negates damage', () => {
      const rolls = [0.10, 0.10]
      let idx = 0
      const result = calculateAttack(
        50, 5000,
        { physicalMin: 50, physicalMax: 50 },
        { level: 50, defense: 1000, blockPercent: 50, currentHp: 200, maxHp: 200 },
        {},
        () => rolls[idx++] ?? 0.5,
      )
      expect(result.isHit).toBe(true)
      expect(result.isBlocked).toBe(true)
      expect(result.totalDamage).toBe(0)
    })

    it('calculates full damage and triggers hit recovery on critical strike', () => {
      // 1: hit roll = 0.20 (hit)
      // 2: crit roll (CS) = 0.10 (< 50% -> critical strike)
      // 3: damage roll = 0.50 (20 * 2 = 40)
      // 4: hit recovery roll = 0.10 (< 100% -> triggered)
      const rolls = [0.20, 0.10, 0.50, 0.10]
      let idx = 0
      const result = calculateAttack(
        50, 5000,
        { physicalMin: 20, physicalMax: 20, fire: 15 },
        { level: 50, defense: 1000, blockPercent: 0, resPhysical: 25, resFire: -20, currentHp: 100, maxHp: 100 },
        { criticalStrikePercent: 50 },
        () => rolls[idx++] ?? 0.5,
      )
      expect(result.isHit).toBe(true)
      expect(result.isBlocked).toBe(false)
      expect(result.isCritical).toBe(true)
      expect(result.criticalTrigger).toBe('critical_strike')
      // Physical: 20 * 2 (crit) = 40. Res 25% => 40 * 0.75 = 30.
      expect(result.finalPhysicalDamage).toBe(30)
      // Fire: 15. Res -20% => 15 * 1.20 = 18.
      expect(result.finalFireDamage).toBe(18)
      expect(result.totalDamage).toBe(48)
      expect(result.hitRecoveryTriggered).toBe(true)
    })

    it('integrates Open Wounds and Leech into combat result', () => {
      // 1: hit roll = 0.10 (hit)
      // 2: OW roll = 0.10 (< 100% -> triggers OW)
      // 3: damage roll = 0.50 (50 physical)
      // 4: recovery roll = 0.90
      const rolls = [0.10, 0.10, 0.50, 0.90]
      let idx = 0
      const result = calculateAttack(
        50, 5000,
        { physicalMin: 50, physicalMax: 50 },
        { level: 50, defense: 100, blockPercent: 0, currentHp: 500, maxHp: 500, drainEffectiveness: 100 },
        { openWoundsPercent: 100, lifeLeechPercent: 20 },
        () => rolls[idx++] ?? 0.5,
      )
      expect(result.isHit).toBe(true)
      expect(result.isOpenWounds).toBe(true)
      expect(result.openWoundsResult?.attackerLevel).toBe(50)
      expect(result.finalPhysicalDamage).toBe(50)
      expect(result.lifeLeeched).toBe(10) // 50 * 0.20 = 10
    })

    it('bypasses AR/DR when isSpell is set', () => {
      const result = calculateAttack(
        1, 0,
        { physicalMin: 0, physicalMax: 0, fire: 50 },
        { level: 90, defense: 99999, blockPercent: 75, resFire: 0, currentHp: 500, maxHp: 500 },
        { isSpell: true },
        () => 0.99,
      )
      expect(result.isHit).toBe(true)
      expect(result.isBlocked).toBe(false)
      expect(result.finalFireDamage).toBe(50)
      expect(result.totalDamage).toBe(50)
    })
  })

  describe('D2_EXPERIENCE_TABLE_99 and Experience.txt Parity (Issue #639)', () => {
    it('contains exact 100 elements (indices 0 to 99)', () => {
      expect(D2_EXPERIENCE_TABLE_99.length).toBe(100)
    })

    it('matches authentic 1.13c progression thresholds across all classes', () => {
      expect(D2_EXPERIENCE_TABLE_99[1]).toBe(0)
      expect(D2_EXPERIENCE_TABLE_99[2]).toBe(500)
      expect(D2_EXPERIENCE_TABLE_99[10]).toBe(57715)
      expect(D2_EXPERIENCE_TABLE_99[17]).toBe(275207)
      expect(D2_EXPERIENCE_TABLE_99[30]).toBe(4663553)
      expect(D2_EXPERIENCE_TABLE_99[90]).toBe(1618470619)
      expect(D2_EXPERIENCE_TABLE_99[99]).toBe(3520485254)
    })

    it('is strictly monotonic increasing from level 1 to 99', () => {
      for (let i = 2; i <= 99; i++) {
        expect(D2_EXPERIENCE_TABLE_99[i]!).toBeGreaterThan(D2_EXPERIENCE_TABLE_99[i - 1]!)
      }
    })

    it('provides getExperienceForLevel and getNextLevelExperience helper parity', () => {
      expect(getExperienceForLevel(1)).toBe(0)
      expect(getExperienceForLevel(2)).toBe(500)
      expect(getExperienceForLevel(17)).toBe(275207)
      expect(getExperienceForLevel(30)).toBe(4663553)
      expect(getExperienceForLevel(90)).toBe(1618470619)
      expect(getExperienceForLevel(99)).toBe(3520485254)

      expect(getNextLevelExperience(1)).toBe(500)
      expect(getNextLevelExperience(16)).toBe(275207)
      expect(getNextLevelExperience(29)).toBe(4663553)
      expect(getNextLevelExperience(89)).toBe(1618470619)
      expect(getNextLevelExperience(98)).toBe(3520485254)
      expect(getNextLevelExperience(99)).toBe(3520485254)

      // Test across specific classes
      const classes = ['amazon', 'sorceress', 'necromancer', 'paladin', 'barbarian', 'druid', 'assassin']
      for (const cls of classes) {
        expect(getExperienceForLevel(30, cls)).toBe(4663553)
        expect(getExperienceForLevel(99, cls)).toBe(3520485254)
        expect(EXPERIENCE_TABLE_BY_CLASS[cls]?.[99]).toBe(3520485254)
      }
    })
  })

  describe('PvE Depth Mechanics (Issue #39)', () => {
    describe('calculateResistanceReduction (1/5th Rule & Immunity Breaking)', () => {
      it('applies 1/5th penalty to Conviction and Lower Resist against immune monsters (>= 100% res)', () => {
        // Monster has 110% Lightning resistance.
        // Conviction Level 12 provides -85% res. Against immune target, only 85 / 5 = 17% is effective!
        // 110% - 17% = 93% (< 100% => Immunity Broken!)
        const result = calculateResistanceReduction(110, 85, 0, 0)
        expect(result.wasImmune).toBe(true)
        expect(result.effectiveConviction).toBe(17)
        expect(result.resAfterSkills).toBe(93)
        expect(result.immunityBroken).toBe(true)
        expect(result.isImmune).toBe(false)
        expect(result.finalRes).toBe(93)
        expect(result.damageMultiplier).toBeCloseTo(0.07, 2)
      })

      it('prevents direct item -% resistance from working when immunity is NOT broken', () => {
        // Monster has 120% Fire resistance.
        // Conviction 85% provides 17% effective reduction -> 120% - 17% = 103% (still >= 100%!).
        // Player has -20% Enemy Fire Resistance from equipment.
        // In D2, equipment -% res CANNOT break immunity and does NOT apply if target remains immune!
        const result = calculateResistanceReduction(120, 85, 0, 20)
        expect(result.wasImmune).toBe(true)
        expect(result.immunityBroken).toBe(false)
        expect(result.isImmune).toBe(true)
        expect(result.effectiveItemMinusRes).toBe(0) // Item minus res completely fails!
        expect(result.finalRes).toBe(103)
        expect(result.damageMultiplier).toBe(0)
      })

      it('applies direct item -% resistance at 100% full strength once immunity is broken by skills', () => {
        // Monster has 110% Lightning resistance.
        // Conviction 85% -> 17% reduction -> 93% res (broken!).
        // Now equipment -25% from Griffon's Eye applies at 100% full effect!
        // 93% - 25% = 68% final resistance.
        const result = calculateResistanceReduction(110, 85, 0, 25)
        expect(result.immunityBroken).toBe(true)
        expect(result.effectiveItemMinusRes).toBe(25)
        expect(result.finalRes).toBe(68)
        expect(result.damageMultiplier).toBeCloseTo(0.32, 2)
      })

      it('combines Conviction and Lower Resist both with 1/5th penalty', () => {
        // Monster has 130% Lightning resistance.
        // Conviction 85% -> 17% reduction.
        // Lower Resist 60% -> 12% reduction.
        // Total skill reduction = 17 + 12 = 29% -> 130 - 29 = 101% (still immune!).
        const stillImmune = calculateResistanceReduction(130, 85, 60, 0)
        expect(stillImmune.effectiveConviction).toBe(17)
        expect(stillImmune.effectiveLowerRes).toBe(12)
        expect(stillImmune.resAfterSkills).toBe(101)
        expect(stillImmune.isImmune).toBe(true)

        // But against 125% res: 125 - 29 = 96% (broken!).
        const broken = calculateResistanceReduction(125, 85, 60, 0)
        expect(broken.immunityBroken).toBe(true)
        expect(broken.resAfterSkills).toBe(96)
        expect(broken.isImmune).toBe(false)
      })

      it('applies 100% full effectiveness to non-immune monsters (< 100% res) and respects -100% cap', () => {
        // Monster has 50% Fire resistance.
        // Conviction 85% + Lower Resist 30% + Equipment -25% = -140% total reduction.
        // 50% - 140% = -90%.
        const result = calculateResistanceReduction(50, 85, 30, 25)
        expect(result.wasImmune).toBe(false)
        expect(result.effectiveConviction).toBe(85)
        expect(result.effectiveLowerRes).toBe(30)
        expect(result.effectiveItemMinusRes).toBe(25)
        expect(result.finalRes).toBe(-90)
        expect(result.damageMultiplier).toBe(1.9)

        // Lower bound clamp at -100% (2x damage)
        const capped = calculateResistanceReduction(0, 85, 60, 25)
        expect(capped.finalRes).toBe(-100)
        expect(capped.damageMultiplier).toBe(2.0)
      })
    })

    describe('calculateMonsterRegeneration & evaluatePreventMonsterHeal', () => {
      it('calculates natural monster regeneration per frame and per second', () => {
        // Monster with 40,960 HP, regen rate 10
        // Regen/frame = (40960 * 10) / 4096 = 100 HP/frame
        // Regen/sec = 100 * 25 = 2500 HP/sec
        const regen = calculateMonsterRegeneration(40960, 10)
        expect(regen.rawRegenPerFrame).toBe(100)
        expect(regen.rawRegenPerSecond).toBe(2500)
        expect(regen.effectiveRegenPerFrame).toBe(100)
        expect(regen.effectiveRegenPerSecond).toBe(2500)
      })

      it('suppresses natural monster regeneration to 0 when Open Wounds (OW) is active', () => {
        const regen = calculateMonsterRegeneration(40960, 10, true, false)
        expect(regen.isBlockedByOW).toBe(true)
        expect(regen.effectiveRegenPerFrame).toBe(0)
        expect(regen.effectiveRegenPerSecond).toBe(0)
      })

      it('suppresses natural monster regeneration to 0 when PMH is active', () => {
        const regen = calculateMonsterRegeneration(40960, 10, false, true)
        expect(regen.isBlockedByPMH).toBe(true)
        expect(regen.effectiveRegenPerFrame).toBe(0)
        expect(regen.effectiveRegenPerSecond).toBe(0)
      })

      it('evaluates Prevent Monster Heal constraints (player only, uber immunity, 80 min duration)', () => {
        // Player attack succeeds
        const playerAttack = evaluatePreventMonsterHeal('player', 'boss')
        expect(playerAttack.applied).toBe(true)
        expect(playerAttack.durationFrames).toBe(120000)
        expect(playerAttack.durationSeconds).toBe(4800)

        // Mercenary attack fails
        const mercAttack = evaluatePreventMonsterHeal('mercenary', 'boss')
        expect(mercAttack.applied).toBe(false)
        expect(mercAttack.durationFrames).toBe(0)

        // Minion / Iron Golem attack fails
        const minionAttack = evaluatePreventMonsterHeal('minion', 'boss')
        expect(minionAttack.applied).toBe(false)

        // Pandemonium Ubers are immune to PMH
        const uberAttack = evaluatePreventMonsterHeal('player', 'uber')
        expect(uberAttack.applied).toBe(false)
        expect(uberAttack.durationFrames).toBe(0)
      })
    })

    describe('calculateKnockbackSuccess (Size & Boss Immunity)', () => {
      it('never knocks back bosses or siege beasts', () => {
        const bossKb = calculateKnockbackSuccess(true, 'small', true, false, () => 0.01)
        expect(bossKb.triggered).toBe(false)
        expect(bossKb.finalChancePercent).toBe(0)
      })

      it('returns 0% if attack has no knockback affix', () => {
        const noKb = calculateKnockbackSuccess(false, 'small', false, false, () => 0.01)
        expect(noKb.triggered).toBe(false)
        expect(noKb.hasKnockbackAffix).toBe(false)
      })

      it('scales knockback chance by target size for melee attacks (Small 100%, Medium 50%, Large 25%)', () => {
        const small = calculateKnockbackSuccess(true, 'small', false, false, () => 0.99)
        expect(small.baseSizeChancePercent).toBe(100)
        expect(small.triggered).toBe(true) // 100% always triggers

        const medSuccess = calculateKnockbackSuccess(true, 'medium', false, false, () => 0.40)
        expect(medSuccess.baseSizeChancePercent).toBe(50)
        expect(medSuccess.triggered).toBe(true)

        const medFail = calculateKnockbackSuccess(true, 'medium', false, false, () => 0.60)
        expect(medFail.triggered).toBe(false)

        const largeSuccess = calculateKnockbackSuccess(true, 'large', false, false, () => 0.20)
        expect(largeSuccess.baseSizeChancePercent).toBe(25)
        expect(largeSuccess.triggered).toBe(true)

        const largeFail = calculateKnockbackSuccess(true, 'large', false, false, () => 0.30)
        expect(largeFail.triggered).toBe(false)
      })

      it('halves knockback chances for ranged attacks (Small 50%, Medium 25%, Large 12.5%)', () => {
        const smallRanged = calculateKnockbackSuccess(true, 'small', false, true, () => 0.40)
        expect(smallRanged.baseSizeChancePercent).toBe(50)
        expect(smallRanged.triggered).toBe(true)

        const medRanged = calculateKnockbackSuccess(true, 'medium', false, true, () => 0.20)
        expect(medRanged.baseSizeChancePercent).toBe(25)
        expect(medRanged.triggered).toBe(true)

        const largeRanged = calculateKnockbackSuccess(true, 'large', false, true, () => 0.10)
        expect(largeRanged.baseSizeChancePercent).toBe(12.5)
        expect(largeRanged.triggered).toBe(true)
      })
    })

    describe('calculateSlowTarget', () => {
      it('allows up to 90% slow on normal monsters', () => {
        const slow75 = calculateSlowTarget(75, false)
        expect(slow75.effectiveSlowPercent).toBe(75)

        const slow95 = calculateSlowTarget(95, false)
        expect(slow95.effectiveSlowPercent).toBe(90) // Capped at 90%
      })

      it('caps slow at 50% for bosses and champions', () => {
        const bossSlow = calculateSlowTarget(75, true)
        expect(bossSlow.effectiveSlowPercent).toBe(50) // Capped at 50%
      })
    })

    describe('Crowd Control: Hit Blinds Target (HBT) & Hit Causes Monster to Flee (HCMTF)', () => {
      it('calculates Hit Blinds Target chance, duration and boss immunity', () => {
        // Attacker Lv50, Defender Lv40, Bonus 1:
        // Raw melee chance = 50 + (50 + 4 - 40) * 2 = 50 + 28 = 78%
        const blindMelee = calculateHitBlindsTarget(1, 50, 40, false, false, () => 0.50)
        expect(blindMelee.chancePercent).toBe(78)
        expect(blindMelee.triggered).toBe(true)
        expect(blindMelee.durationSeconds).toBe(8) // (1*4+4) = 8s
        expect(blindMelee.durationFrames).toBe(200)

        // Ranged divides chance by 3: 78 / 3 = 26%
        const blindRanged = calculateHitBlindsTarget(1, 50, 40, false, true, () => 0.20)
        expect(blindRanged.chancePercent).toBe(26)
        expect(blindRanged.triggered).toBe(true)

        // Bosses are immune
        const blindBoss = calculateHitBlindsTarget(1, 50, 40, true, false, () => 0.01)
        expect(blindBoss.triggered).toBe(false)
        expect(blindBoss.chancePercent).toBe(0)
      })

      it('calculates Hit Causes Monster to Flee duration (125 frames / 5s) and boss immunity', () => {
        const fleeNormal = calculateHitCausesFlee(50, false, () => 0.20)
        expect(fleeNormal.triggered).toBe(true)
        expect(fleeNormal.durationSeconds).toBe(5.0)
        expect(fleeNormal.durationFrames).toBe(125)

        const fleeBoss = calculateHitCausesFlee(50, true, () => 0.01)
        expect(fleeBoss.triggered).toBe(false)
      })
    })

    describe('calculatePhysicalWeaponDamage (Off-Weapon ED & Grief +Flat Damage)', () => {
      it('calculates pure Grief Phase Blade with Fortitude and Strength bonus', () => {
        // Phase Blade base damage: 31 to 35
        // On-weapon ED: 0%
        // Grief flat damage: +400
        // Base damage becomes: [31+400, 35+400] = [431, 435]
        // Off-Weapon ED: 300% (Fortitude Armor) + 150% (Fanaticism Aura) = 450%
        // Stat Bonus: 150% (Strength)
        // Total Multiplier = 1 + (450 + 150) / 100 = 7.0x
        // Final Min = 431 * 7 = 3017
        // Final Max = 435 * 7 = 3045
        const griefDmg = calculatePhysicalWeaponDamage({
          weaponBaseMin: 31,
          weaponBaseMax: 35,
          onWeaponEdPercent: 0,
          flatDamage: 400,
          offWeaponEdPercent: 450,
          statBonusPercent: 150,
        })
        expect(griefDmg.baseMinWithFlat).toBe(431)
        expect(griefDmg.baseMaxWithFlat).toBe(435)
        expect(griefDmg.totalMultiplier).toBe(7.0)
        expect(griefDmg.finalMinDamage).toBe(3017)
        expect(griefDmg.finalMaxDamage).toBe(3045)
      })

      it('correctly layers on-weapon ED before flat damage', () => {
        // Base: 10 to 20
        // On-Weapon ED: 100% -> [20, 40]
        // Flat Damage: +10 -> [30, 50]
        // Off-Weapon ED: 100% -> Multiplier 2.0x -> [60, 100]
        const dmg = calculatePhysicalWeaponDamage({
          weaponBaseMin: 10,
          weaponBaseMax: 20,
          onWeaponEdPercent: 100,
          flatDamage: 10,
          offWeaponEdPercent: 100,
        })
        expect(dmg.baseMinWithWeaponEd).toBe(20)
        expect(dmg.baseMaxWithWeaponEd).toBe(40)
        expect(dmg.baseMinWithFlat).toBe(30)
        expect(dmg.baseMaxWithFlat).toBe(50)
        expect(dmg.finalMinDamage).toBe(60)
        expect(dmg.finalMaxDamage).toBe(100)
      })
    })

    describe('calculatePoisonStack (Bit Rates & Averaging)', () => {
      it('calculates bit rate summation and average duration across multiple poison charms', () => {
        // Source 1: 100 poison damage over 5 seconds (125 frames)
        // Bit rate 1 = (100 * 256) / 125 = 204.8
        // Source 2: 50 poison damage over 3 seconds (75 frames)
        // Bit rate 2 = (50 * 256) / 75 = 170.6667
        // Total BitRate = 204.8 + 170.6667 = 375.4667
        // Average Duration = (125 + 75) / 2 = 100 frames (4.0 seconds)
        // Total Poison Damage = floor(375.4667 * 100 / 256) = floor(146.6667) = 146
        const poison = calculatePoisonStack([
          { damage: 100, durationSeconds: 5 },
          { damage: 50, durationSeconds: 3 },
        ])
        expect(poison.sourcesCount).toBe(2)
        expect(poison.averageDurationFrames).toBe(100)
        expect(poison.averageDurationSeconds).toBe(4.0)
        expect(poison.totalPoisonDamage).toBe(146)
        expect(poison.damagePerSecond).toBeCloseTo(36.67, 1)
      })

      it('handles empty poison sources safely', () => {
        const empty = calculatePoisonStack([])
        expect(empty.totalPoisonDamage).toBe(0)
        expect(empty.totalBitRate).toBe(0)
      })
    })

    describe('calculateAttack with integrated PvE options', () => {
      it('breaks elemental immunity with conviction and applies equipment -% res', () => {
        const rolls = [0.1, 0.5, 0.5]
        let idx = 0
        const result = calculateAttack(
          80, 5000,
          { physicalMin: 10, physicalMax: 10, lightning: 1000 },
          { level: 80, defense: 500, blockPercent: 0, resLightning: 110, currentHp: 5000, maxHp: 5000 },
          {
            convictionPenalty: 85,
            itemMinusLightRes: 25,
          },
          () => rolls[idx++] ?? 0.5,
        )
        // Lightning resistance 110% -> 93% (Conviction 17%) -> 68% (Griffon -25%) -> 32% damage factor
        expect(result.resistanceBreakResults?.lightning?.immunityBroken).toBe(true)
        expect(result.resistanceBreakResults?.lightning?.finalRes).toBe(68)
        expect(result.finalLightningDamage).toBe(320)
      })

      it('evaluates knockback size and boss immunity in calculateAttack', () => {
        // Small monster knocked back
        const smallResult = calculateAttack(
          50, 5000,
          { physicalMin: 20, physicalMax: 20 },
          { level: 50, defense: 100, blockPercent: 0, currentHp: 200, maxHp: 200, size: 'small', tier: 'normal' },
          { knockbackPercent: 100 },
          () => 0.05,
        )
        expect(smallResult.knockbackTriggered).toBe(true)

        // Boss monster immune to knockback
        const bossResult = calculateAttack(
          50, 5000,
          { physicalMin: 20, physicalMax: 20 },
          { level: 50, defense: 100, blockPercent: 0, currentHp: 200, maxHp: 200, size: 'small', tier: 'boss' },
          { knockbackPercent: 100 },
          () => 0.05,
        )
        expect(bossResult.knockbackTriggered).toBe(false)
      })

      it('applies PMH and calculates monster natural regeneration suppression', () => {
        const result = calculateAttack(
          50, 5000,
          { physicalMin: 50, physicalMax: 50 },
          { level: 50, defense: 100, blockPercent: 0, currentHp: 40960, maxHp: 40960, regenRate: 10, tier: 'boss' },
          { preventMonsterHeal: true, attackerType: 'player' },
          () => 0.05,
        )
        expect(result.pmhResult?.applied).toBe(true)
        expect(result.monsterRegenResult?.isBlockedByPMH).toBe(true)
        expect(result.monsterRegenResult?.effectiveRegenPerFrame).toBe(0)
      })
    })
  })
})

