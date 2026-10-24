/**
 * Diablo II: Lord of Destruction v1.13c — Amazon Passive & Magic Skills Tree Module
 *
 * Dedicated pure calculation and kinematics formulas for the 10 passive & magic skills:
 * - Skill 008: Inner Sight
 * - Skill 009: Critical Strike
 * - Skill 013: Dodge
 * - Skill 017: Slow Missiles
 * - Skill 018: Avoid
 * - Skill 023: Penetrate
 * - Skill 028: Decoy (Dopplezon)
 * - Skill 029: Evade
 * - Skill 032: Valkyrie
 * - Skill 033: Pierce
 *
 * 1.13c Ground Truth:
 * - D2Common.dll / D2Game.dll / Patch_D2.mpq: Skills.txt, Missiles.txt, MonStats.txt
 * - `computeDiminishingReturns(a, b, lvl)` (`dm12` / `dm(a, b, lvl)`) for CS, Dodge, Avoid, Evade, Pierce
 * - Inner Sight: 5-band flat defense reduction `-compute5BandScaling(slvl, 40, 25, 45, 60, 80, 100)` (`-edmn`),
 *   duration `200 + 100 * (slvl - 1)` frames (`ln34`: 8.0s + 4.0s/lvl), 200px (20 subtiles) radius, fixed 5 mana
 * - Critical Strike: `dm(5, 80, slvl)`, sequential doubling with Deadly Strike (never quadrupling), 0 mana
 * - Dodge: melee avoidance while standing/attacking (`dm(10, 65, slvl)`), `S1` (`PLRMODE_SPECIAL1 = 13`) animation lock, 0 mana
 * - Slow Missiles: 200px (20 subtiles) radius, duration `300 + 150 * (slvl - 1)` frames (`ln34`: 12.0s + 6.0s/lvl),
 *   missile velocity reduced to 33%, fixed 5 mana
 * - Avoid: ranged missile avoidance while standing/attacking (`dm(15, 75, slvl)`), `S1` (`PLRMODE_SPECIAL1 = 13`) animation lock, 0 mana
 * - Penetrate: linear Attack Rating bonus `+35% + 10% * (slvl - 1)`, 0 mana
 * - Decoy: duration `250 + 125 * (slvl - 1)` frames, two-stage HP `floor(floor(amazonBaseHp * 50 / 100) * (100 + 10 * slvl) / 100)`
 *   (55% at slvl 1, +5% per level), max 85% elemental resistance (`min(85, 4 * slvl)`), stationary posture, draws monster threat,
 *   no passive avoid/evade inheritance in 1.13c, mana `floor(max(256, (76 - 3 * (slvl - 1)) << 6) / 256)` (`minmana = 1`)
 * - Evade: avoidance while moving (`dm(10, 65, slvl)`), zero animation lock (uninterrupted motion), 0 mana
 * - Valkyrie: base HP `440`, additive `(20 * (slvl - 1) + 20 * decoyBlvl)%` maxhp bonus, resistances `min(85, 2 * (slvl + decoyBlvl))%`,
 *   inherits CS, Dodge, Avoid, Evade at Amazon's blvl and Penetrate (`40 * slvl + 40 * penetrateBlvl` flat AR),
 *   150-frame (6.0s) casting delay, 5 equipment generation tiers (`ilvl = 25 + 3 * (slvl - 1)`), mana `25 + (slvl - 1)`
 * - Pierce: diminishing returns `dm(10, 100, slvl)`, max 4 pierces (5 hits), Guided Arrow strict 0% pierce override, 0 mana
 */

import { compute5BandScaling, computeDiminishingReturns } from '../data/calc-ast.ts'

// --- Interfaces for Skill Calculations ---

export interface InnerSightStats {
  readonly flatDefenseReduction: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly radiusPx: number
  readonly radiusSubtiles: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface CriticalStrikeStats {
  readonly chancePct: number
  readonly damageMultiplier: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface DodgeStats {
  readonly chancePct: number
  readonly triggersAnimationLock: boolean
  readonly animationCode: 'S1'
  readonly appliesTo: 'melee'
  readonly condition: 'stationary_or_attacking'
  readonly manaCost: number
  readonly manaCost256: number
}

export interface SlowMissilesStats {
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly radiusPx: number
  readonly radiusSubtiles: number
  readonly velocityMultiplier: number
  readonly velocityReductionPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface AvoidStats {
  readonly chancePct: number
  readonly triggersAnimationLock: boolean
  readonly animationCode: 'S1'
  readonly appliesTo: 'missile'
  readonly condition: 'stationary_or_attacking'
  readonly manaCost: number
  readonly manaCost256: number
}

export interface PenetrateStats {
  readonly attackRatingBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface DecoyStats {
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly hp: number
  readonly hpPctOfAmazon: number
  readonly allResistancesPct: number
  readonly defense: number
  readonly inheritedAvoidLvl: number
  readonly inheritedEvadeLvl: number
  readonly isStationary: boolean
  readonly drawsThreat: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

export interface EvadeStats {
  readonly chancePct: number
  readonly triggersAnimationLock: boolean
  readonly animationCode: 'S1'
  readonly appliesTo: 'melee_or_missile'
  readonly condition: 'moving'
  readonly uninterrupted: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

export type ValkyrieEquipmentTier = 'tier1_basic' | 'tier2_boots' | 'tier3_gloves' | 'tier4_war_pike' | 'tier5_rare_tiara'

export interface ValkyrieStats {
  readonly baseHp: number
  readonly finalHp: number
  readonly decoySynergyBonusPct: number
  readonly allResistancesPct: number
  readonly strength: number
  readonly dexterity: number
  readonly defenseBonusPct: number
  readonly attackRatingBonus: number
  readonly equipmentIlvl: number
  readonly cooldownFrames: number
  readonly cooldownSeconds: number
  readonly equipmentTier: ValkyrieEquipmentTier
  readonly inheritedCriticalStrikeLvl: number
  readonly inheritedDodgeLvl: number
  readonly inheritedAvoidLvl: number
  readonly inheritedEvadeLvl: number
  readonly inheritedPenetrateLvl: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface PierceStats {
  readonly chancePct: number
  readonly maxPierceCount: number
  readonly maxHitsPerMissile: number
  readonly isGuidedArrow: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

// --- Pure Calculation Functions ---

/**
 * Skill 008: Inner Sight
 * Radius: 200px (20 subtiles / 13.33 yards) (`Skills.txt` `Param1 = 20`)
 * Duration: `200 + 100 * (slvl - 1)` frames (`8.0s + 4.0s/lvl`, `auralencalc = ln34`, `Param3 = 200, Param4 = 100`)
 * Flat Defense Reduction: `-compute5BandScaling(slvl, 40, 25, 45, 60, 80, 100)` (`aurastatcalc1 = -edmn`)
 * Mana: fixed 5 mana (1280 in 24.8 fixed point)
 */
export function calculateInnerSightStats(slvl: number): InnerSightStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const flatDefenseReduction = -compute5BandScaling(lvl, 40, 25, 45, 60, 80, 100)
  const durationFrames = 200 + 100 * (lvl - 1)
  const durationSeconds = durationFrames / 25
  const radiusPx = 200
  const radiusSubtiles = 20
  const manaCost = 5
  const manaCost256 = 1280

  return {
    flatDefenseReduction,
    durationFrames,
    durationSeconds,
    radiusPx,
    radiusSubtiles,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 009: Critical Strike
 * Chance %: `computeDiminishingReturns(5, 80, slvl)`
 * Multiplies physical damage component only (x2).
 * Strictly sequential evaluation with Deadly Strike (never quadrupling).
 * Mana: 0 (passive).
 */
export function calculateCriticalStrikeStats(slvl: number): CriticalStrikeStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const chancePct = computeDiminishingReturns(5, 80, lvl)
  return {
    chancePct,
    damageMultiplier: 2.0,
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 013: Dodge
 * Chance %: `computeDiminishingReturns(10, 65, slvl)`
 * Melee avoidance while standing still or attacking (`!defender.isMoving`).
 * Triggers `S1` (`PLRMODE_SPECIAL1 = 13`) animation lock (`Skills.txt` `anim = S1`).
 * Mana: 0 (passive).
 */
export function calculateDodgeStats(slvl: number): DodgeStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const chancePct = computeDiminishingReturns(10, 65, lvl)
  return {
    chancePct,
    triggersAnimationLock: true,
    animationCode: 'S1',
    appliesTo: 'melee',
    condition: 'stationary_or_attacking',
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 017: Slow Missiles
 * Radius: 200px (20 subtiles / 13.33 yards) (`Skills.txt` `Param2 = 20`)
 * Duration: `300 + 150 * (slvl - 1)` frames (`12.0s + 6.0s/lvl`, `auralencalc = ln34`, `Param3 = 300, Param4 = 150`)
 * Missile Velocity: scaled down to 33% (67% speed reduction, `Param1 = 33`)
 * Mana: fixed 5 mana (1280 in 24.8 fixed point)
 */
export function calculateSlowMissilesStats(slvl: number): SlowMissilesStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const durationFrames = 300 + 150 * (lvl - 1)
  const durationSeconds = durationFrames / 25
  const radiusPx = 200
  const radiusSubtiles = 20
  const velocityMultiplier = 0.33
  const velocityReductionPct = 67
  const manaCost = 5
  const manaCost256 = 1280

  return {
    durationFrames,
    durationSeconds,
    radiusPx,
    radiusSubtiles,
    velocityMultiplier,
    velocityReductionPct,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 018: Avoid
 * Chance %: `computeDiminishingReturns(15, 75, slvl)`
 * Ranged missile avoidance while standing still or attacking (`!defender.isMoving`).
 * Triggers `S1` (`PLRMODE_SPECIAL1 = 13`) animation lock (`Skills.txt` `anim = S1`).
 * Mana: 0 (passive).
 */
export function calculateAvoidStats(slvl: number): AvoidStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const chancePct = computeDiminishingReturns(15, 75, lvl)
  return {
    chancePct,
    triggersAnimationLock: true,
    animationCode: 'S1',
    appliesTo: 'missile',
    condition: 'stationary_or_attacking',
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 023: Penetrate
 * Attack Rating Bonus %: `+35% + 10% * (slvl - 1)`
 * Directly accrued to player's global `item_tohit_percent` stat.
 * Mana: 0 (passive).
 */
export function calculatePenetrateStats(slvl: number): PenetrateStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const attackRatingBonusPct = 35 + 10 * (lvl - 1)
  return {
    attackRatingBonusPct,
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 028: Decoy (Dopplezon)
 * Duration: `250 + 125 * (slvl - 1)` frames (`10.0s + 5.0s/lvl`, `calc2 = ln12`, `Param1 = 250, Param2 = 125`)
 * HP: Two-stage 1.13c calculation (`SKILLS_SrvDo015_Dopplezon` `0x6FC6D8C0` + `D2GAME_SetSummonPassiveStats_6FD0C530` `0x6FD0C530`):
 *   - Stage 1: `hpBase = floor(amazonBaseHp * 50 / 100)` (`MonStats.txt` `Dopplezon` `minHP=50, maxHP=50` = 50% of caster maxHP)
 *   - Stage 2: `+10 * slvl%` (`calc1 = ul56`, `Param5 = 10, Param6 = 10`) -> `floor(hpBase * (100 + 10 * slvl) / 100)` (55% at slvl 1, +5%/lvl)
 * Resistances: `min(85, 4 * slvl)%` (`aurastatcalc1..4 = min(lvl * par4, 85)`, `Param4 = 4`)
 * Defense: inherits Amazon's defense at instant of casting
 * Passive Inheritance: None in 1.13c (`sumskill1..5` are all empty on `Dopplezon`)
 * AI Contract: Stationary posture (`NU` mode), cannot move or attack, draws monster threat
 * Mana: `Skills.txt` `mana=76, lvlmana=-3, manashift=6, minmana=1` -> `manaCost256 = max(256, (76 - 3 * (slvl - 1)) << 6)`
 */
export function calculateDecoyStats(
  slvl: number,
  amazonBaseHp: number = 100,
  amazonDef: number = 0,
  _synergies?: { avoidLvl?: number; evadeLvl?: number },
): DecoyStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const durationFrames = 250 + 125 * (lvl - 1)
  const durationSeconds = durationFrames / 25
  const hpBase = Math.floor((amazonBaseHp * 50) / 100)
  const hp = Math.floor((hpBase * (100 + 10 * lvl)) / 100)
  const hpPctOfAmazon = Math.floor((50 * (100 + 10 * lvl)) / 100)
  const allResistancesPct = Math.min(85, 4 * lvl)
  const manaCost256 = Math.max(256, (76 - 3 * (lvl - 1)) << 6)
  const manaCost = Math.max(1, Math.floor(manaCost256 / 256))

  return {
    durationFrames,
    durationSeconds,
    hp,
    hpPctOfAmazon,
    allResistancesPct,
    defense: amazonDef,
    inheritedAvoidLvl: 0,
    inheritedEvadeLvl: 0,
    isStationary: true,
    drawsThreat: true,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 029: Evade
 * Chance %: `computeDiminishingReturns(10, 65, slvl)`
 * Avoidance while moving (`defender.isMoving === true`) against both melee and missile attacks.
 * Zero animation lock during movement (`Skills.txt` `anim = S1`, uninterrupted motion).
 * Mana: 0 (passive).
 */
export function calculateEvadeStats(slvl: number): EvadeStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const chancePct = computeDiminishingReturns(10, 65, lvl)
  return {
    chancePct,
    triggersAnimationLock: false,
    animationCode: 'S1',
    appliesTo: 'melee_or_missile',
    condition: 'moving',
    uninterrupted: true,
    manaCost: 0,
    manaCost256: 0,
  }
}

/**
 * Skill 032: Valkyrie
 * Cooldown: 150 frames (6.0s casting delay)
 * Mana Cost: `25 + (slvl - 1)`
 * Base HP: `440 * (1 + 0.2 * (slvl - 1))`
 * Synergy HP: Additive `+20%` of base 440 HP per hard point in Decoy (`calc1 = (lvl - 1) * 20 + skill('Dopplezon'.blvl) * 20`)
 * Resistances: `min(85, 2 * (slvl + decoyHardPoints))%` (`aurastatcalc3..6 = min((lvl + skill('Dopplezon'.blvl)) * 2, 85)`)
 * Passives (`passivestat1..4`):
 * - `defenseBonusPct = 10 * (slvl - 1)` (`item_armor_percent = ln12`, `Param1=0, Param2=10`)
 * - `attackRatingBonus = 40 * slvl + 40 * penetrateBlvl` (`tohit = par3 * lvl + skill('Penetrate'.blvl) * par3`, `Param3=40`)
 * - `strength = 25 * slvl` (`ln56`, `Param5=25, Param6=25`)
 * - `dexterity = 12 * slvl` (`ln78`, `Param7=12, Param8=12`)
 * - `equipmentIlvl = 25 + 3 * (slvl - 1)` (`Param7=25, Param8=3` in `D2GAME_SummonSetPassiveStats`)
 * Equipment Generation Tiers:
 * - slvl 1: Spear, Full Plate Mail
 * - slvl 7: Adds Heavy Boots
 * - slvl 11: Adds Gloves
 * - slvl 17: Spear upgraded to Rare War Pike
 * - slvl 27+: Magical/Rare Crusader Gauntlets, Tiara, Sacred Armor
 * Passive Inheritance: Inherits CS, Dodge, Avoid, Evade at Amazon's blvl
 */
export function calculateValkyrieStats(
  slvl: number,
  synergies?: {
    decoyHardPoints?: number
    csLvl?: number
    dodgeLvl?: number
    avoidLvl?: number
    evadeLvl?: number
    penetrateLvl?: number
  },
): ValkyrieStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const baseHp = Math.floor(440 * (1 + 0.2 * (lvl - 1)))
  const decoyHardPoints = Math.max(0, Math.floor(synergies?.decoyHardPoints ?? 0))
  const decoySynergyBonusPct = decoyHardPoints * 20
  const totalHpBonusPct = 20 * (lvl - 1) + decoySynergyBonusPct
  const finalHp = Math.floor((440 * (100 + totalHpBonusPct)) / 100)
  const allResistancesPct = Math.min(85, 2 * (lvl + decoyHardPoints))
  const strength = 25 * lvl
  const dexterity = 12 * lvl
  const defenseBonusPct = 10 * (lvl - 1)
  const penetrateHardPoints = Math.max(0, Math.floor(synergies?.penetrateLvl ?? 0))
  const attackRatingBonus = 40 * lvl + 40 * penetrateHardPoints
  const equipmentIlvl = 25 + 3 * (lvl - 1)
  const cooldownFrames = 150
  const cooldownSeconds = 6.0
  const manaCost = 25 + (lvl - 1)
  const manaCost256 = (25 + (lvl - 1)) * 256

  let equipmentTier: ValkyrieEquipmentTier = 'tier1_basic'
  if (lvl >= 27) {
    equipmentTier = 'tier5_rare_tiara'
  } else if (lvl >= 17) {
    equipmentTier = 'tier4_war_pike'
  } else if (lvl >= 11) {
    equipmentTier = 'tier3_gloves'
  } else if (lvl >= 7) {
    equipmentTier = 'tier2_boots'
  }

  return {
    baseHp,
    finalHp,
    decoySynergyBonusPct,
    allResistancesPct,
    strength,
    dexterity,
    defenseBonusPct,
    attackRatingBonus,
    equipmentIlvl,
    cooldownFrames,
    cooldownSeconds,
    equipmentTier,
    inheritedCriticalStrikeLvl: synergies?.csLvl ?? 0,
    inheritedDodgeLvl: synergies?.dodgeLvl ?? 0,
    inheritedAvoidLvl: synergies?.avoidLvl ?? 0,
    inheritedEvadeLvl: synergies?.evadeLvl ?? 0,
    inheritedPenetrateLvl: penetrateHardPoints,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 033: Pierce
 * Chance %: `computeDiminishingReturns(10, 100, slvl)`
 * Max Pierce Count: 4 pierces (5 hits max)
 * Mana: 0 (passive).
 */
export function calculatePierceStats(slvl: number, skillId?: number): PierceStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const isGuidedArrow = skillId === 22
  const chancePct = computeDiminishingReturns(10, 100, lvl)

  return {
    chancePct,
    maxPierceCount: 4,
    maxHitsPerMissile: 5,
    isGuidedArrow,
    manaCost: 0,
    manaCost256: 0,
  }
}
