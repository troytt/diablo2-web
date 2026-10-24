/**
 * Issue #1000: Barbarian Combat Masteries (#127–#153) 4-Layer Full-Stack 1.13c Parity Suite
 *
 * Verifies:
 * 1. Pure 1.13c formulas for all 10 Barbarian Combat Masteries (#127..#153)
 * 2. Canonical ItemTypes.txt weapon-type matching (`blun` including staves/wands/scepters, `spea` vs `thro` for javelins)
 * 3. Layer 2 (`UnitStatList`, `executeSUnitDmg`, `executeSkill113c`) passive accrual, weapon mastery gating, CS+DS mutual exclusion, and cross-tab synergies (#144+#145, #147+#141)
 * 4. Layer 1 (`aggregateUnit`, `computeCombatStats`, `syncHudModelFromWorld`) C-screen stats, `staminarecoverybonus` (stat 28), hard-point gate, and weapon mastery wiring
 * 5. Layer 3 (`executeNormalAttack`, `castSkill` #140) & Layer 4 (`computeMoveVelocityPercent113c` stat 67 direct additive velocity)
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import {
  calculateSwordMasteryStats,
  calculateAxeMasteryStats,
  calculateMaceMasteryStats,
  calculatePolearmMasteryStats,
  calculateThrowingMasteryStats,
  calculateSpearMasteryStats,
  calculateIncreasedStaminaStats,
  calculateIronSkinStats,
  calculateIncreasedSpeedStats,
  calculateNaturalResistanceStats,
  isWeaponMatchingMastery,
  calculateEffectiveCriticalStrike,
} from '../../../src/server/skills/barbarian-masteries.ts'
import {
  calculateConcentrateStats,
  calculateFrenzyStats,
  calculateFrenzyStackState,
} from '../../../src/server/skills/barbarian-combat.ts'
import { FIXED_ONE, UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import {
  executeSUnitDmg,
  type CombatUnitContext,
} from '../../../src/server/engine/combat-pipeline.ts'
import { executeSkill113c } from '../../../src/server/skills/registry.ts'
import {
  aggregateUnit,
  itemCodeIsA,
} from '../../../src/client/ui-model/stat-engine.ts'
import { computeCombatStats } from '../../../src/client/ui-model/combat-stats.ts'
import { StatList as ClientStatList } from '../../../src/client/world/stat-list.ts'
import {
  computeMoveVelocityPercent113c,
  resolveCharacterAnimSpeedParams,
} from '../../../src/common/units/char-anim-speed.ts'
import { executeNormalAttack } from '../../../src/server/engine/combat-pipeline.ts'
import { castSkill } from '../../../src/server/skills/skills.ts'

function createUnit(overrides?: Partial<CombatUnitContext>): CombatUnitContext {
  const statList = new UnitStatList()
  statList.setBaseStat('level', 80)
  statList.setBaseStat('tohit', 10000)
  statList.setBaseStat('armorclass', 100)
  statList.setBaseStat('maxhp', 2000 * FIXED_ONE)
  statList.setHp256(2000 * FIXED_ONE)
  const stateBus = new StateBus(statList)
  return {
    id: 'unit-1',
    name: 'unit-1',
    unitType: 'player',
    charClass: 'bar',
    x: 100,
    y: 100,
    statList,
    stateBus,
    weaponMinPhys: 100,
    weaponMaxPhys: 100,
    ...overrides,
  }
}

describe('Issue #1000: Barbarian Combat Masteries (#127–#153) 4-Layer 1.13c Parity', () => {
  it('1. evaluates exact 1.13c Skills.txt formulas for all 10 Combat Masteries (#127..#153)', () => {
    // #127 Sword, #128 Axe, #129 Mace: AR = 28 + 8*(slvl-1), ED = 28 + 5*(slvl-1), Crit = dm(0,35,slvl)
    for (const fn of [calculateSwordMasteryStats, calculateAxeMasteryStats, calculateMaceMasteryStats]) {
      const s1 = fn(1)
      expect(s1.attackRatingBonusPct).toBe(28)
      expect(s1.damageBonusPct).toBe(28)
      expect(s1.criticalStrikeChancePct).toBe(5)

      const s10 = fn(10)
      expect(s10.attackRatingBonusPct).toBe(100)
      expect(s10.damageBonusPct).toBe(73)
      expect(s10.criticalStrikeChancePct).toBe(24)

      const s20 = fn(20)
      expect(s20.attackRatingBonusPct).toBe(180)
      expect(s20.damageBonusPct).toBe(123)
      expect(s20.criticalStrikeChancePct).toBe(29)
    }

    // #134 Polearm, #135 Throwing, #136 Spear: AR = 30 + 8*(slvl-1), ED = 28 + 5*(slvl-1), Crit = dm(5,35,slvl)
    for (const fn of [calculatePolearmMasteryStats, calculateThrowingMasteryStats, calculateSpearMasteryStats]) {
      const s1 = fn(1)
      expect(s1.attackRatingBonusPct).toBe(30)
      expect(s1.damageBonusPct).toBe(28)
      expect(s1.criticalStrikeChancePct).toBe(5)

      const s10 = fn(10)
      expect(s10.attackRatingBonusPct).toBe(102)
      expect(s10.damageBonusPct).toBe(73)
      expect(s10.criticalStrikeChancePct).toBe(24)

      const s20 = fn(20)
      expect(s20.attackRatingBonusPct).toBe(182)
      expect(s20.damageBonusPct).toBe(123)
      expect(s20.criticalStrikeChancePct).toBe(29)
    }

    // #141 Increased Stamina: +30 + 15*(slvl-1)% Max Stamina AND Stamina Recovery Rate
    expect(calculateIncreasedStaminaStats(1)).toEqual({
      staminaBonusPct: 30,
      staminaRecoveryBonusPct: 30,
      manaCost: 0,
      manaCost256: 0,
    })
    expect(calculateIncreasedStaminaStats(10).staminaBonusPct).toBe(165)
    expect(calculateIncreasedStaminaStats(10).staminaRecoveryBonusPct).toBe(165)
    expect(calculateIncreasedStaminaStats(20).staminaBonusPct).toBe(315)
    expect(calculateIncreasedStaminaStats(20).staminaRecoveryBonusPct).toBe(315)

    // #145 Iron Skin: +30 + 10*(slvl-1)% Defense
    expect(calculateIronSkinStats(1).defenseBonusPct).toBe(30)
    expect(calculateIronSkinStats(10).defenseBonusPct).toBe(120)
    expect(calculateIronSkinStats(20).defenseBonusPct).toBe(220)

    // #148 Increased Speed: dm(7, 50, slvl)% Walk/Run Velocity
    expect(calculateIncreasedSpeedStats(1).runWalkSpeedBonusPct).toBe(13)
    expect(calculateIncreasedSpeedStats(10).runWalkSpeedBonusPct).toBe(36)
    expect(calculateIncreasedSpeedStats(20).runWalkSpeedBonusPct).toBe(43)

    // #153 Natural Resistance: dm(0, 80, slvl)% All Elemental Resistances
    const nr1 = calculateNaturalResistanceStats(1)
    expect(nr1.resistAllPct).toBe(12)
    expect(nr1.fireResistPct).toBe(12)
    expect(nr1.coldResistPct).toBe(12)
    expect(nr1.lightningResistPct).toBe(12)
    expect(nr1.poisonResistPct).toBe(12)
    expect(calculateNaturalResistanceStats(10).resistAllPct).toBe(55)
    expect(calculateNaturalResistanceStats(20).resistAllPct).toBe(67)
  })

  it('2. matches canonical ItemTypes.txt weapon hierarchy (`blun` includes staves/wands/scepters/hammers/clubs; `jave` matches #136 in melee and #135 when thrown)', () => {
    // #127 Sword Mastery (`swor`)
    expect(isWeaponMatchingMastery('swor', 127)).toBe(true)
    expect(isWeaponMatchingMastery('axe', 127)).toBe(false)

    // #128 Axe Mastery (`axe`, `taxe` in melee)
    expect(isWeaponMatchingMastery('axe', 128)).toBe(true)
    expect(isWeaponMatchingMastery('taxe', 128)).toBe(true)
    expect(isWeaponMatchingMastery('pole', 128)).toBe(false)

    // #129 Mace Mastery (`blun` -> mace, club, hamm, scep, staf, wand)
    for (const bluntType of ['blun', 'mace', 'club', 'hamm', 'scep', 'staf', 'wand', 'staff']) {
      expect(isWeaponMatchingMastery(bluntType, 129)).toBe(true)
    }
    expect(isWeaponMatchingMastery('swor', 129)).toBe(false)
    expect(isWeaponMatchingMastery('spea', 129)).toBe(false)

    // #134 Polearm Mastery (`pole`)
    expect(isWeaponMatchingMastery('pole', 134)).toBe(true)
    expect(isWeaponMatchingMastery('spea', 134)).toBe(false)

    // #135 Throwing Mastery (`thro` -> tkni, taxe, jave)
    for (const throwType of ['thro', 'tkni', 'taxe', 'jave']) {
      expect(isWeaponMatchingMastery(throwType, 135)).toBe(true)
    }
    expect(isWeaponMatchingMastery('spea', 135)).toBe(false)

    // #136 Spear Mastery (`spea` -> spea, jave in melee)
    expect(isWeaponMatchingMastery('spea', 136)).toBe(true)
    expect(isWeaponMatchingMastery('jave', 136)).toBe(true)
    expect(isWeaponMatchingMastery('pole', 136)).toBe(false)
  })

  it('3. accrues Barbarian passives (#141, #145, #148, #153) in UnitStatList and gates on hard points > 0', () => {
    const stats = new UnitStatList()
    stats.setBaseStat('maxstamina', 100 * FIXED_ONE)
    stats.setBaseStat('armorclass', 200)
    stats.setBaseStat('fireresist', 10)
    stats.setBaseStat('coldresist', 10)
    stats.setBaseStat('lightresist', 10)
    stats.setBaseStat('poisonresist', 10)

    // Unlearned passives with +5 allskills must NOT grant passive bonuses
    stats.addStat('item_allskills', 5)
    expect(stats.getAccruedStat('maxstamina')).toBe(100 * FIXED_ONE)
    expect(stats.getAccruedStat('staminarecoverybonus')).toBe(0)
    expect(stats.getAccruedStat('armorclass')).toBe(200)
    expect(stats.getAccruedStat('velocitypercent')).toBe(0)
    expect(stats.getAccruedStat('fireresist')).toBe(10)

    // Invest 1 hard point in each passive -> effective slvl = 1 + 5 = 6
    stats.setBaseSkillLevel(141, 1) // slvl 6 -> +105% maxstamina & +105% staminarecoverybonus
    stats.setBaseSkillLevel(145, 1) // slvl 6 -> +80% armorclass
    stats.setBaseSkillLevel(148, 1) // slvl 6 -> dm(7,50,6) = +30% velocitypercent
    stats.setBaseSkillLevel(153, 1) // slvl 6 -> dm(0,80,6) = +44% all resists

    expect(stats.getAccruedStat('item_maxstamina_percent')).toBe(105)
    expect(stats.getAccruedStat('staminarecoverybonus')).toBe(105)
    expect(stats.getAccruedStat('maxstamina')).toBe(Math.trunc((100 * FIXED_ONE * 205) / 100))
    expect(stats.getAccruedStat('armorclass')).toBe(Math.trunc((200 * 180) / 100))
    expect(stats.getAccruedStat('velocitypercent')).toBe(30)
    expect(stats.getAccruedStat('fireresist')).toBe(54)
    expect(stats.getAccruedStat('coldresist')).toBe(54)
    expect(stats.getAccruedStat('lightresist')).toBe(54)
    expect(stats.getAccruedStat('poisonresist')).toBe(54)
  })

  it('4. gates Weapon Mastery (%AR, %ED, Crit) by equipped weapon type and enforces CS + DS mutual exclusion in executeSUnitDmg', () => {
    const attacker = createUnit({
      weaponItemType: 'swor',
      weaponMinPhys: 100,
      weaponMaxPhys: 100,
    })
    attacker.statList.setBaseSkillLevel(127, 10) // Sword Mastery slvl 10: +100% AR, +73% ED, 23% Crit
    const defender = createUnit({ id: 'def-1', unitType: 'monster' })

    // Matching weapon (`swor`) + roll100=0 (< 23% Crit): deals (100 * 1.73) * 2 = 346 damage
    const hitMatchingCrit = executeSUnitDmg(attacker, defender, {
      skillId: 0,
      attackKind: 'melee',
      srcDam: 128,
      roll100: 0,
      masteryCritRoll100: 0,
      rng: { rand: () => 0 },
    })
    expect(hitMatchingCrit.hit).toBe(true)
    expect(hitMatchingCrit.totalDamage).toBe(346)

    // Matching weapon (`swor`) + roll100=50 (>= 23% Crit): deals 100 * 1.73 = 173 damage
    defender.statList.setHp256(2000 * FIXED_ONE)
    const hitMatchingNoCrit = executeSUnitDmg(attacker, defender, {
      skillId: 0,
      attackKind: 'melee',
      srcDam: 128,
      roll100: 50,
      masteryCritRoll100: 50,
      rng: { rand: () => 50 },
    })
    expect(hitMatchingNoCrit.totalDamage).toBe(173)

    // Non-matching weapon (`axe` with only Sword Mastery #127 learned): 0% ED, 0% Crit -> 100 damage even at roll100=0
    attacker.weaponItemType = 'axe'
    defender.statList.setHp256(2000 * FIXED_ONE)
    const hitNonMatching = executeSUnitDmg(attacker, defender, {
      skillId: 0,
      attackKind: 'melee',
      srcDam: 128,
      roll100: 0,
      masteryCritRoll100: 0,
      rng: { rand: () => 0 },
    })
    expect(hitNonMatching.totalDamage).toBe(100)

    // Mutual exclusion of Mastery Crit (CS) and Deadly Strike (DS):
    // Even with 100% DS and roll100=0 (< 23% CS), damage is doubled ONCE (346), never quadrupled (692)
    attacker.weaponItemType = 'swor'
    attacker.statList.setBaseStat('item_deadlystrike', 100)
    defender.statList.setHp256(2000 * FIXED_ONE)
    const hitCsPlusDs = executeSUnitDmg(attacker, defender, {
      skillId: 0,
      attackKind: 'melee',
      srcDam: 128,
      roll100: 0,
      masteryCritRoll100: 0,
      rng: { rand: () => 0 },
    })
    expect(hitCsPlusDs.totalDamage).toBe(346)
    expect(calculateEffectiveCriticalStrike(50, 50)).toBe(75)

    // Berserk (#152) 100% Magic conversion happens AFTER Mastery Crit 2x physical doubling
    defender.statList.setHp256(2000 * FIXED_ONE)
    const hitBerserkCrit = executeSUnitDmg(attacker, defender, {
      skillId: 152,
      attackKind: 'melee',
      srcDam: 128,
      physToElemPct: 100,
      elemType: 'mag',
      roll100: 0,
      masteryCritRoll100: 0,
      rng: { rand: () => 0 },
    })
    expect(hitBerserkCrit.physDamage256).toBe(0)
    expect(hitBerserkCrit.elemDamage256).toBe(346 * FIXED_ONE)
    expect(hitBerserkCrit.totalDamage).toBe(346)
  })

  it('5. applies #135 Throwing Mastery to #2 Throw, #4 Left Hand Throw, and #140 Double Throw without double-counting', async () => {
    const registry = await getSharedDataRegistry()
    const caster = createUnit({
      weaponItemType: 'jave',
      isThrowing: true,
      weaponQuantity: 10,
      offHandIsThrowing: true,
      offHandWeaponQuantity: 10,
      offHandWeaponItemType: 'tkni',
      weaponMinPhys: 100,
      weaponMaxPhys: 100,
    })
    // Learn #135 Throwing Mastery at slvl 10 (+73% ED, +102% AR, 23% Crit)
    caster.statList.setBaseSkillLevel(135, 10)
    // Also learn #136 Spear Mastery at slvl 20 — must NOT apply to thrown javelins (#2)
    caster.statList.setBaseSkillLevel(136, 20)

    const target = createUnit({ id: 'mon-1', unitType: 'monster', x: 120, y: 100 })
    const outThrow = executeSkill113c({
      registry,
      skill: registry.getSkillById(2)!,
      caster,
      targets: [target],
      targetX: 120,
      targetY: 100,
    } as any)
    expect(outThrow.executed).toBe(true)
    expect(outThrow.missilesSpawned.length).toBe(1)

    // When the thrown javelin hits in executeSUnitDmg, #135 (+73% ED) applies, NOT #136 (+123% ED)
    const hitThrow = executeSUnitDmg(caster, target, {
      skillId: 2,
      attackKind: 'missile',
      srcDam: 128,
      roll100: 50, // no crit
      masteryCritRoll100: 50,
      rng: { rand: () => 50 },
    })
    expect(hitThrow.totalDamage).toBe(173)

    // #140 Double Throw spawns 2 missiles and decrements both weapon quantities
    caster.statList.setBaseSkillLevel(140, 5)
    const outDoubleThrow = executeSkill113c({
      registry,
      skill: registry.getSkillById(140)!,
      caster,
      targets: [target],
      targetX: 120,
      targetY: 100,
    } as any)
    expect(outDoubleThrow.executed).toBe(true)
    expect(outDoubleThrow.missilesSpawned.length).toBe(2)
  })

  it('6. wires cross-tab synergies: #145 Iron Skin -> #144 Concentrate (+10% Def/blvl) and #141 Increased Stamina -> #147 Frenzy (+0.4s/blvl)', async () => {
    // Pure calculators
    const concNoSyn = calculateConcentrateStats(10, 0, 0, 0, 0)
    const concWithIronSkin = calculateConcentrateStats(10, 0, 0, 0, 15)
    expect(concNoSyn.defenseBonusPct).toBe(190)
    expect(concWithIronSkin.defenseBonusPct).toBe(340) // +150% from 15 hard points in #145 Iron Skin

    const frenzyNoSyn = calculateFrenzyStats(10, 0, 0, 0, 0)
    const frenzyWithStamina = calculateFrenzyStats(10, 0, 0, 0, 12)
    expect(frenzyNoSyn.durationFrames).toBe(150)
    expect(frenzyWithStamina.durationFrames).toBe(270) // 150 + 12 * 10 frames (10.8s)
    expect(calculateFrenzyStackState(2, 1, 10, 0, 50, 12).remainingFrames).toBe(220) // 270 - 50

    // Runtime execution via executeSkill113c
    const registry = await getSharedDataRegistry()
    const caster = createUnit({ weaponItemType: 'swor' })
    caster.statList.setBaseSkillLevel(144, 10)
    caster.statList.setBaseSkillLevel(145, 15) // Iron Skin blvl = 15
    caster.statList.setBaseSkillLevel(147, 10)
    caster.statList.setBaseSkillLevel(141, 12) // Increased Stamina blvl = 12
    const target = createUnit({ id: 'mon-2', unitType: 'monster', x: 110, y: 100 })

    const concOut = executeSkill113c({
      registry,
      skill: registry.getSkillById(144)!,
      caster,
      targets: [target],
    } as any)
    expect(concOut.statesApplied).toContain('concentrate')
    expect(caster.stateBus.getState('concentrate')?.stats['skill_armor_percent']).toBe(340)

    const frenzyOut = executeSkill113c({
      registry,
      skill: registry.getSkillById(147)!,
      caster,
      targets: [target],
    } as any)
    expect(frenzyOut.statesApplied).toContain('frenzy')
    expect(caster.stateBus.getState('frenzy')?.durationFrames).toBe(270)
  })

  it('7. aligns Layer 1 stat-engine (`aggregateUnit`, `computeCombatStats`) and Layer 4 (`computeMoveVelocityPercent113c` stat 67)', () => {
    // Layer 1: aggregateUnit with learned vs unlearned passives & active Concentrate state
    const cStats = new ClientStatList()
    cStats.set(12, 50) // clvl = 50
    cStats.set(3, 50) // vit = 50
    cStats.set(11, 200 * 256) // maxstamina = 200
    cStats.set(31, 100) // base armorclass = 100
    cStats.set(127, 5) // +5 allskills

    const emptyContainers = {
      equipmentBySlot: new Map(),
      mercBySlot: new Map(),
      inventory: new Map(),
      socketedByHost: new Map(),
      byId: new Map(),
    } as any

    const aggUnlearned = aggregateUnit({
      kind: 'player',
      stats: cStats,
      level: 50,
      activeStates: new Set<number>(),
      classId: 4, // Barbarian
      hardSkillLevels: new Map<number, number>(),
      containers: emptyContainers,
    })

    const aggLearned = aggregateUnit({
      kind: 'player',
      stats: cStats,
      level: 50,
      activeStates: new Set<number>([15]), // state 15 = concentrate
      classId: 4, // Barbarian
      hardSkillLevels: new Map<number, number>([
        [141, 5], // Increased Stamina hard=5, eff=10 -> +165% maxstamina & +165% staminarecoverybonus (stat 28)
        [144, 5], // Concentrate hard=5, eff=10
        [145, 5], // Iron Skin hard=5, eff=10 -> +120% passive def + +50% synergy to Concentrate
        [148, 5], // Increased Speed hard=5, eff=10 -> +36% velocitypercent (stat 67)
        [153, 5], // Natural Resistance hard=5, eff=10 -> +55% all resists
      ]),
      containers: emptyContainers,
    })

    expect(aggUnlearned.total(28)).toBe(0)
    expect(aggLearned.total(28)).toBe(165) // staminarecoverybonus = 30 + 15*9
    expect(aggLearned.total(11)).toBeGreaterThan(aggUnlearned.total(11))
    expect(aggLearned.total(67)).toBe(36) // velocitypercent = dm(7,50,10)
    expect(aggLearned.total(39)).toBe(aggUnlearned.total(39) + 55) // fireresist
    expect(aggLearned.total(171)).toBe(120 + (100 + 10 * 9 + 10 * 5)) // 120 (Iron Skin) + 240 (Concentrate + Iron Skin syn) = 360

    // Layer 1: computeCombatStats with Sword Mastery (#127 -> stat 342=%AR, 343=%ED)
    const swordArm = {
      weapon: {
        code: 'lsd',
        minDam: 10,
        maxDam: 20,
        twoHandMinDam: 0,
        twoHandMaxDam: 0,
        minMisDam: 0,
        maxMisDam: 0,
        strBonus: 100,
        dexBonus: 0,
        twoHanded: false,
        oneOrTwoHanded: false,
        throwable: false,
        weaponClass: '1hs',
      },
      component: 5,
      ethereal: false,
      canBeEquipped: true,
      isType: (tc: string) => itemCodeIsA('lsd', tc),
      localRaw: () => 0,
    }
    const baseAttackSkill = {
      id: 0,
      level: 1,
      weapSel: 0,
      kick: false,
      srcDam: 128,
      itypeA1: '',
      itypeA1IsThrown: false,
      range: 'h2h' as const,
      toHitPercent: 0,
      damagePercent: 0,
      skillPhysical256: { min: 0, max: 0 },
      spellDamage: null,
    }
    const combatWithoutMastery = computeCombatStats({
      charClass: 'bar',
      clvl: 50,
      toHitFactor: 20,
      strength: 100,
      dexterity: 100,
      dexterityWithoutStates: 100,
      lists: [],
      rightArm: swordArm as any,
      leftArm: null,
      primaryArm: 'right',
      boots: null,
      masteries: [],
      isDamageRelated: () => false,
      hasStateColorFlag: () => false,
      leftSkill: baseAttackSkill,
      rightSkill: baseAttackSkill,
    })
    const combatWithMastery = computeCombatStats({
      charClass: 'bar',
      clvl: 50,
      toHitFactor: 20,
      strength: 100,
      dexterity: 100,
      dexterityWithoutStates: 100,
      lists: [],
      rightArm: swordArm as any,
      leftArm: null,
      primaryArm: 'right',
      boots: null,
      masteries: [
        { statId: 342, itemType: 'swor', value: 100 }, // +100% AR
        { statId: 343, itemType: 'swor', value: 73 }, // +73% ED
      ],
      isDamageRelated: () => false,
      hasStateColorFlag: () => false,
      leftSkill: baseAttackSkill,
      rightSkill: baseAttackSkill,
    })
    expect(combatWithMastery.left.attackRating!).toBeGreaterThan(combatWithoutMastery.left.attackRating!)
    expect(combatWithMastery.left.damage.physMax).toBeGreaterThan(combatWithoutMastery.left.damage.physMax)

    // Layer 4: Skill #148 Increased Speed (`skillVelocityPercent` / stat 67) is direct additive velocity (bypasses 150 item FRW diminishing returns)
    const itemOnly = computeMoveVelocityPercent113c({
      running: true,
      itemFrw: 30, // eFRW = floor(150*30/180) = 25 -> 100 + 50 + 25 = 175
    })
    const withIncreasedSpeed = computeMoveVelocityPercent113c({
      running: true,
      itemFrw: 30,
      skillVelocityPercent: 36, // slvl 10 Increased Speed (+36% direct) -> 211
    })
    expect(withIncreasedSpeed - itemOnly).toBe(36)

    const animParams = resolveCharacterAnimSpeedParams('bar', 'rn', {
      weaponCode: 'lsd',
      skillVelocityPercent: 36,
    })
    expect(animParams.velocityPercent).toBe(100 + 50 + 36)
  })

  it('8. integrates Barbarian Weapon Masteries into Layer 3 scene combat (`executeNormalAttack` & `castSkill` #140)', () => {
    const monster = {
      index: 0,
      x: 110,
      y: 100,
      hp: 1000,
      maxHp: 1000,
      state: 'idle',
      stats: { id: 'zombie1', name: 'Zombie', hp: 1000 },
    } as any
    const engine = {
      world: {
        tick: 1,
        player: {
          x: 100,
          y: 100,
          hp: 500,
          maxHp: 500,
          mana: 200,
          maxMana: 200,
          cooldown: 0,
          swingTicks: 0,
          skillLevels: { 129: 10, 135: 10, 140: 5 }, // Mace Mastery slvl 10 (+73% ED), Throwing Mastery slvl 10 (+73% ED)
          criticalStrikeProc: true,
        },
        monsters: [monster],
        events: [],
      },
      projectiles: [] as any[],
      explosions: [],
      overlays: [],
      metrics: { casts: 0, playerHits: 0, castHits: 0, pickups: 0, inventoryRefusals: 0 },
      spawnOverlay: () => {},
    } as any

    // Melee normal attack with a staff (`staf` matches #129 Mace Mastery `blun`!)
    const outcome = executeNormalAttack(110, 100, {
      engine,
      equippedWeapon: { code: 'lst', type: 'staf', damage: '100 to 100' },
    })
    expect(outcome.casted).toBe(true)
    // 100 base * (1 + 0.73) * 2 (crit) = 346 damage -> monster HP = 1000 - 346 = 654
    expect(monster.hp).toBe(654)

    // Ranged Double Throw (#140) with #135 Throwing Mastery slvl 10 (+73% ED) + Crit (2x)
    engine.world.player.cooldown = 0
    const status = { textContent: null as string | null }
    const casted = castSkill(140, 200, 100, {
      engine,
      runtime: { level: 'Rogue Encampment', levelId: 1, act: 1, grid: {} as any },
      hudManager: null,
      status,
      equippedWeapon: { code: 'jav', type: 'jave', damage: '50 to 50' },
    })
    expect(casted).toBe(true)
    expect(engine.projectiles.length).toBe(2)
    expect(engine.projectiles[0].damage).toBeGreaterThan(100)
  })
})
