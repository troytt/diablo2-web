/**
 * Diablo II: Lord of Destruction v1.13c — Barbarian Combat Masteries Module
 *
 * Dedicated pure calculation and kinematics formulas for the 10 Barbarian Combat Masteries:
 * - Skill 127: Sword Mastery (ReqLevel 1)
 * - Skill 128: Axe Mastery (ReqLevel 1)
 * - Skill 129: Mace Mastery (ReqLevel 1)
 * - Skill 134: Polearm Mastery (ReqLevel 6)
 * - Skill 135: Throwing Mastery (ReqLevel 6)
 * - Skill 136: Spear Mastery (ReqLevel 6)
 * - Skill 141: Increased Stamina (ReqLevel 12)
 * - Skill 145: Iron Skin (ReqLevel 18)
 * - Skill 148: Increased Speed (ReqLevel 24)
 * - Skill 153: Natural Resistance (ReqLevel 30)
 *
 * 1.13c Ground Truth:
 * - Skills.txt (Patch_D2.mpq)
 * - Exact linear progressions ln12 (AR), ln34 (Dmg), ln12 (Stamina, Defense)
 * - Diminishing returns dm56 (Crit), dm12 (Speed, Resist All)
 * - Sequential roll for Critical Strike & Deadly Strike (no double-crit / 4x dmg)
 * - Zero runtime MPQ reading
 */

import { computeDiminishingReturns } from '../../common/data/calc-ast.ts'

// --- Interfaces for Skill Calculations ---

export interface WeaponMasteryStats {
  readonly skillId: number
  readonly skillName: string
  readonly weaponCategory: string
  readonly attackRatingBonusPct: number
  readonly damageBonusPct: number
  readonly criticalStrikeChancePct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface IncreasedStaminaStats {
  readonly staminaBonusPct: number
  readonly staminaRecoveryBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface IronSkinStats {
  readonly defenseBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface IncreasedSpeedStats {
  readonly runWalkSpeedBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface NaturalResistanceStats {
  readonly resistAllPct: number
  readonly fireResistPct: number
  readonly coldResistPct: number
  readonly lightningResistPct: number
  readonly poisonResistPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

// --- Calculation Implementations ---

/**
 * Skill 127: Sword Mastery
 * AR: 28 + 8 * (slvl - 1)%
 * Dmg: 28 + 5 * (slvl - 1)%
 * Crit: dm(0, 35, slvl)%
 */
export function calculateSwordMasteryStats(slvl: number): WeaponMasteryStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      skillId: 127,
      skillName: 'Sword Mastery',
      weaponCategory: 'sword',
      attackRatingBonusPct: 0,
      damageBonusPct: 0,
      criticalStrikeChancePct: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  return {
    skillId: 127,
    skillName: 'Sword Mastery',
    weaponCategory: 'sword',
    attackRatingBonusPct: 28 + 8 * (lvl - 1),
    damageBonusPct: 28 + 5 * (lvl - 1),
    criticalStrikeChancePct: computeDiminishingReturns(0, 35, lvl),
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 128: Axe Mastery
 * AR: 28 + 8 * (slvl - 1)%
 * Dmg: 28 + 5 * (slvl - 1)%
 * Crit: dm(0, 35, slvl)%
 */
export function calculateAxeMasteryStats(slvl: number): WeaponMasteryStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      skillId: 128,
      skillName: 'Axe Mastery',
      weaponCategory: 'axe',
      attackRatingBonusPct: 0,
      damageBonusPct: 0,
      criticalStrikeChancePct: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  return {
    skillId: 128,
    skillName: 'Axe Mastery',
    weaponCategory: 'axe',
    attackRatingBonusPct: 28 + 8 * (lvl - 1),
    damageBonusPct: 28 + 5 * (lvl - 1),
    criticalStrikeChancePct: computeDiminishingReturns(0, 35, lvl),
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 129: Mace Mastery
 * AR: 28 + 8 * (slvl - 1)%
 * Dmg: 28 + 5 * (slvl - 1)%
 * Crit: dm(0, 35, slvl)%
 * Applies to: Maces, Clubs, Hammers, Flails, Scepters
 */
export function calculateMaceMasteryStats(slvl: number): WeaponMasteryStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      skillId: 129,
      skillName: 'Mace Mastery',
      weaponCategory: 'mace',
      attackRatingBonusPct: 0,
      damageBonusPct: 0,
      criticalStrikeChancePct: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  return {
    skillId: 129,
    skillName: 'Mace Mastery',
    weaponCategory: 'mace',
    attackRatingBonusPct: 28 + 8 * (lvl - 1),
    damageBonusPct: 28 + 5 * (lvl - 1),
    criticalStrikeChancePct: computeDiminishingReturns(0, 35, lvl),
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 134: Polearm Mastery
 * AR: 30 + 8 * (slvl - 1)%
 * Dmg: 28 + 5 * (slvl - 1)%
 * Crit: dm(0, 35, slvl)%
 */
export function calculatePolearmMasteryStats(slvl: number): WeaponMasteryStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      skillId: 134,
      skillName: 'Polearm Mastery',
      weaponCategory: 'polearm',
      attackRatingBonusPct: 0,
      damageBonusPct: 0,
      criticalStrikeChancePct: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  return {
    skillId: 134,
    skillName: 'Polearm Mastery',
    weaponCategory: 'polearm',
    attackRatingBonusPct: 30 + 8 * (lvl - 1),
    damageBonusPct: 28 + 5 * (lvl - 1),
    criticalStrikeChancePct: computeDiminishingReturns(0, 35, lvl),
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 135: Throwing Mastery
 * AR: 30 + 8 * (slvl - 1)%
 * Dmg: 28 + 5 * (slvl - 1)%
 * Crit: dm(0, 35, slvl)%
 * Applies to: Throwing Knives, Throwing Axes, Javelins (when thrown)
 */
export function calculateThrowingMasteryStats(slvl: number): WeaponMasteryStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      skillId: 135,
      skillName: 'Throwing Mastery',
      weaponCategory: 'throwing',
      attackRatingBonusPct: 0,
      damageBonusPct: 0,
      criticalStrikeChancePct: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  return {
    skillId: 135,
    skillName: 'Throwing Mastery',
    weaponCategory: 'throwing',
    attackRatingBonusPct: 30 + 8 * (lvl - 1),
    damageBonusPct: 28 + 5 * (lvl - 1),
    criticalStrikeChancePct: computeDiminishingReturns(0, 35, lvl),
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 136: Spear Mastery
 * AR: 30 + 8 * (slvl - 1)%
 * Dmg: 28 + 5 * (slvl - 1)%
 * Crit: dm(0, 35, slvl)%
 * Applies to: Spears and Javelins (in melee)
 */
export function calculateSpearMasteryStats(slvl: number): WeaponMasteryStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      skillId: 136,
      skillName: 'Spear Mastery',
      weaponCategory: 'spear',
      attackRatingBonusPct: 0,
      damageBonusPct: 0,
      criticalStrikeChancePct: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  return {
    skillId: 136,
    skillName: 'Spear Mastery',
    weaponCategory: 'spear',
    attackRatingBonusPct: 30 + 8 * (lvl - 1),
    damageBonusPct: 28 + 5 * (lvl - 1),
    criticalStrikeChancePct: computeDiminishingReturns(0, 35, lvl),
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 141: Increased Stamina
 * Stamina %: 30 + 15 * (slvl - 1)%
 */
export function calculateIncreasedStaminaStats(slvl: number): IncreasedStaminaStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      staminaBonusPct: 0,
      staminaRecoveryBonusPct: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  const bonus = 30 + 15 * (lvl - 1)
  return {
    staminaBonusPct: bonus,
    staminaRecoveryBonusPct: bonus,
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 145: Iron Skin
 * Defense %: 30 + 10 * (slvl - 1)%
 */
export function calculateIronSkinStats(slvl: number): IronSkinStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      defenseBonusPct: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  return {
    defenseBonusPct: 30 + 10 * (lvl - 1),
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 148: Increased Speed
 * Velocity %: dm(7, 50, slvl)%
 */
export function calculateIncreasedSpeedStats(slvl: number): IncreasedSpeedStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      runWalkSpeedBonusPct: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  return {
    runWalkSpeedBonusPct: computeDiminishingReturns(7, 50, lvl),
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 153: Natural Resistance
 * Elemental Resistances (Fire, Cold, Lightning, Poison): dm(0, 80, slvl)%
 */
export function calculateNaturalResistanceStats(slvl: number): NaturalResistanceStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      resistAllPct: 0,
      fireResistPct: 0,
      coldResistPct: 0,
      lightningResistPct: 0,
      poisonResistPct: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  const res = computeDiminishingReturns(0, 80, lvl)
  return {
    resistAllPct: res,
    fireResistPct: res,
    coldResistPct: res,
    lightningResistPct: res,
    poisonResistPct: res,
    manaCost: 0,
    manaCost256: 0,
  }
}

// --- Weapon & Crit Evaluation Helpers ---

/**
 * Checks if a given weapon type string matches the target Barbarian Mastery skill.
 */
export function isWeaponMatchingMastery(weaponType: string, skillId: number): boolean {
  const norm = weaponType.toLowerCase().trim()
  switch (skillId) {
    case 127: // Sword Mastery (passiveItype = swor)
      return (
        norm === 'swor' ||
        norm.includes('sword') ||
        norm.includes('blade') ||
        norm.includes('falchion') ||
        norm.includes('scimitar') ||
        norm.includes('saber') ||
        norm.includes('claymore') ||
        norm.includes('zweihander')
      )
    case 128: // Axe Mastery (passiveItype = axe -> axe, taxe in melee)
      return (
        norm === 'axe' ||
        norm === 'taxe' ||
        (norm.includes('axe') && !norm.includes('poleaxe') && !norm.includes('cryptic axe')) ||
        norm.includes('cleaver') ||
        norm.includes('hatchet')
      )
    case 129: // Mace Mastery (passiveItype = blun -> blun, mace, club, hamm, scep, staf, wand)
      return (
        norm === 'blun' ||
        norm === 'mace' ||
        norm === 'club' ||
        norm === 'hamm' ||
        norm === 'scep' ||
        norm === 'staf' ||
        norm === 'wand' ||
        norm.includes('blunt') ||
        norm.includes('mace') ||
        norm.includes('club') ||
        norm.includes('hammer') ||
        norm.includes('maul') ||
        norm.includes('flail') ||
        norm.includes('scepter') ||
        norm.includes('morning star') ||
        norm.includes('staff') ||
        norm.includes('wand')
      )
    case 134: // Polearm Mastery (passiveItype = pole)
      return (
        norm === 'pole' ||
        norm.includes('polearm') ||
        norm.includes('scythe') ||
        norm.includes('voulge') ||
        norm.includes('thresher') ||
        norm.includes('halberd') ||
        norm.includes('bardiche') ||
        norm.includes('lochaber') ||
        norm.includes('bill') ||
        norm.includes('poleaxe') ||
        norm.includes('cryptic axe')
      )
    case 135: // Throwing Mastery (passiveItype = thro -> tkni, taxe, jave, thro)
      return (
        norm === 'thro' ||
        norm === 'tkni' ||
        norm === 'taxe' ||
        norm === 'jave' ||
        norm.includes('throw') ||
        norm.includes('javelin') ||
        norm.includes('dart') ||
        norm.includes('pilum') ||
        norm.includes('harpoon')
      )
    case 136: // Spear Mastery (passiveItype = spea -> spea, jave in melee)
      return (
        norm === 'spea' ||
        norm === 'jave' ||
        norm.includes('spear') ||
        norm.includes('pike') ||
        norm.includes('lance') ||
        norm.includes('trident') ||
        norm.includes('javelin')
      )
    default:
      return false
  }
}

/**
 * Evaluates effective double-damage proc chance combining Mastery Critical Strike and Deadly Strike.
 *
 * In Diablo II 1.13c:
 * - Critical Strike (Mastery/Amazon) rolls first.
 * - If CS does not proc, Deadly Strike (items) rolls second.
 * - They NEVER stack to quadruple damage; damage is doubled at most once:
 *   P(double damage) = CS% + DS% * (1 - CS% / 100)
 */
export function calculateEffectiveCriticalStrike(
  masteryCritPct: number,
  deadlyStrikePct: number
): number {
  const cs = Math.max(0, Math.min(100, masteryCritPct)) / 100
  const ds = Math.max(0, Math.min(100, deadlyStrikePct)) / 100
  const combined = cs + ds * (1 - cs)
  return Math.round(combined * 1000) / 10 // rounded to 1 decimal place %
}

/**
 * Unified dispatch evaluation for Barbarian Combat Masteries.
 */
export function evaluateBarbarianMastery(
  skillId: number,
  slvl: number
): WeaponMasteryStats | IncreasedStaminaStats | IronSkinStats | IncreasedSpeedStats | NaturalResistanceStats | null {
  switch (skillId) {
    case 127:
      return calculateSwordMasteryStats(slvl)
    case 128:
      return calculateAxeMasteryStats(slvl)
    case 129:
      return calculateMaceMasteryStats(slvl)
    case 134:
      return calculatePolearmMasteryStats(slvl)
    case 135:
      return calculateThrowingMasteryStats(slvl)
    case 136:
      return calculateSpearMasteryStats(slvl)
    case 141:
      return calculateIncreasedStaminaStats(slvl)
    case 145:
      return calculateIronSkinStats(slvl)
    case 148:
      return calculateIncreasedSpeedStats(slvl)
    case 153:
      return calculateNaturalResistanceStats(slvl)
    default:
      return null
  }
}
