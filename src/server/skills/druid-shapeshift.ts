/**
 * Diablo II: Lord of Destruction v1.13c — Druid Shape Shifting Skills Module
 *
 * Dedicated pure calculation, transformation states, charge-up orb progression,
 * contagious spread, and kinematics formulas for the 10 Druid Shape Shifting Tree Skills:
 * - Skill 223: Werewolf (ReqLevel 1)
 * - Skill 224: Lycanthropy (ReqLevel 1)
 * - Skill 228: Werebear (ReqLevel 6)
 * - Skill 232: Feral Rage (ReqLevel 12)
 * - Skill 233: Maul (ReqLevel 12)
 * - Skill 238: Rabies (ReqLevel 18)
 * - Skill 239: Fire Claws (ReqLevel 18)
 * - Skill 242: Hunger (ReqLevel 24)
 * - Skill 243: Shock Wave (ReqLevel 24)
 * - Skill 248: Fury (ReqLevel 30)
 *
 * 1.13c Ground Truth:
 * - Skills.txt, Missiles.txt, States.txt, Overlay.txt (Patch_D2.mpq)
 * - Werewolf: attack rate dm(10, 80, slvl), attack rating, stamina, life, Lycanthropy duration
 * - Lycanthropy: passive +20s/slvl shift duration, +20% base + 5%/slvl max HP
 * - Werebear: enhanced physical damage 55% + 8%/slvl, armor bonus 25% + 6%/slvl, max HP 75% + Lycanthropy
 * - Feral Rage: 3-stage charge orb, speed bonus dm(10, 70, slvl), life leech 4% * slvl
 * - Maul: 5-stage charge orb, damage bonus 20% * slvl per charge, stun dm(10, 100, slvl)
 * - Rabies: infectious poison bite spreading to adjacent targets within 4 subtiles
 * - Fire Claws: massive elemental fire melee strike synergized by 4 elemental spells (+22%/blvl)
 * - Hunger: dual life & mana leech dm(50, 200, slvl) with -75% damage penalty
 * - Shock Wave: bear-only stun cone ln12 stun duration (40 frames + 15/slvl)
 * - Fury: 5-hit uninterrupted feral frenzy sequence (min(2 + slvl - 1, 5) hits)
 * - Zero runtime MPQ reading
 */

import { compute5BandScaling, computeDiminishingReturns } from '../../common/data/calc-ast.ts'

export type DruidForm = 'human' | 'werewolf' | 'werebear'

// --- Skill IDs ---

export const DRUID_SHAPESHIFT_SKILL_IDS = {
  WEREWOLF: 223,
  LYCANTHROPY: 224,
  WEREBEAR: 228,
  FERAL_RAGE: 232,
  MAUL: 233,
  RABIES: 238,
  FIRE_CLAWS: 239,
  HUNGER: 242,
  SHOCK_WAVE: 243,
  FURY: 248,
} as const

/**
 * 1.13c Skills.txt `cltoverlaya` / `cltoverlayb` for the druid transforms (Overlay.txt rows,
 * `expansion\druidmorph`): `into` plays when the form is entered, `undo` when it is left.
 */
export const DRUID_TRANSFORM_CLT_OVERLAYS_113C: Readonly<
  Record<223 | 228, { readonly into: string; readonly undo: string }> & {
    readonly werewolf: number
    readonly werebear: number
  }
> = Object.freeze(
  Object.defineProperties(
    {
      223: Object.freeze({ into: 'wolf_into', undo: 'wolf_undo' }),
      228: Object.freeze({ into: 'bear_into', undo: 'bear_undo' }),
    },
    {
      werewolf: { value: 423, enumerable: false, writable: false },
      werebear: { value: 424, enumerable: false, writable: false },
    },
  ),
) as Readonly<
  Record<223 | 228, { readonly into: string; readonly undo: string }> & {
    readonly werewolf: number
    readonly werebear: number
  }
>

// --- Interfaces for Skill Calculations ---

export interface WerewolfStats {
  readonly attackRateBonusPct: number
  readonly toHitBonusPct: number
  readonly staminaBonusPct: number
  readonly maxHpBonusPct: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly cooldownFrames: number
  readonly cooldownSeconds: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly stateName: string
}

export interface LycanthropyStats {
  readonly durationBonusFrames: number
  readonly durationBonusSeconds: number
  readonly maxHpBonusPct: number
  readonly isPassive: boolean
}

export interface WerebearStats {
  readonly damageBonusPct: number
  readonly defenseBonusPct: number
  readonly maxHpBonusPct: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly cooldownFrames: number
  readonly cooldownSeconds: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly stateName: string
}

export interface FeralRageStats {
  readonly damageBonusPct: number
  readonly toHitBonusPct: number
  readonly lifeLeechPct: number
  readonly minLifeLeechPct: number
  readonly maxLifeLeechPct: number
  readonly velocityBonusPct: number
  readonly minVelocityBonusPct: number
  readonly maxVelocityBonusPct: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly currentCharge: number
  readonly maxCharges: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly stateName: string
  readonly overlayName: string
}

export interface MaulStats {
  readonly damageBonusPerChargePct: number
  readonly damageBonusPct: number
  readonly minDamageBonusPct: number
  readonly maxDamageBonusPct: number
  readonly toHitBonusPct: number
  readonly stunDurationFrames: number
  readonly minStunDurationFrames: number
  readonly maxStunDurationFrames: number
  readonly stunDurationSeconds: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly currentCharge: number
  readonly maxCharges: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly stateName: string
  readonly overlayName: string
}

export interface RabiesStats {
  readonly minBitrate256: number
  readonly maxBitrate256: number
  readonly minPoisonDamage: number
  readonly maxPoisonDamage: number
  readonly poisonDurationFrames: number
  readonly poisonDurationSeconds: number
  readonly toHitBonusPct: number
  readonly contagionRadiusSubtiles: number
  readonly contagionSpreadIntervalFrames: number
  readonly synergyBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly overlayName: string
}

export interface FireClawsStats {
  readonly minFireDamage: number
  readonly maxFireDamage: number
  readonly toHitBonusPct: number
  readonly synergyBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface HungerStats {
  readonly damagePenaltyPct: number
  readonly lifeLeechPct: number
  readonly manaLeechPct: number
  readonly toHitBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface ShockWaveStats {
  readonly minPhysicalDamage: number
  readonly maxPhysicalDamage: number
  readonly stunDurationFrames: number
  readonly stunDurationSeconds: number
  readonly synergyBonusPct: number
  readonly cooldownFrames: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly missileName: string
}

export interface FuryStats {
  readonly damageBonusPct: number
  readonly toHitBonusPct: number
  readonly attackCount: number
  readonly isUninterruptible: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

// --- Pure Calculation Functions ---

/**
 * Skill 223: Werewolf (Wearwolf)
 * Ground Truth:
 * - Attack Rate bonus: dm(10, 80, slvl)
 * - ToHit: 50 + (slvl - 1) * 15
 * - Stamina: 25% (constant)
 * - Max HP: 25% base + Lycanthropy.ln34 (20 + (lycBlvl - 1) * 5)%
 * - Duration: 1000 frames (40s) + Lycanthropy.ln12 (1000 + (lycBlvl - 1) * 500 frames)
 * - Mana: 15, Cooldown: 25 frames (1.0s)
 */
export function calculateWerewolfStats(
  slvl: number,
  lycanthropyBlvl = 0,
): WerewolfStats {
  const lvl = Math.max(1, slvl)
  const lycPts = Math.max(0, lycanthropyBlvl)

  const attackRateBonusPct = computeDiminishingReturns(10, 80, lvl)
  const toHitBonusPct = 50 + (lvl - 1) * 15

  const lycHpBonus = lycPts > 0 ? 20 + (lycPts - 1) * 5 : 0
  const maxHpBonusPct = 25 + lycHpBonus

  const lycDurationBonus = lycPts > 0 ? 1000 + (lycPts - 1) * 500 : 0
  const durationFrames = 1000 + lycDurationBonus

  return {
    attackRateBonusPct,
    toHitBonusPct,
    staminaBonusPct: 25,
    maxHpBonusPct,
    durationFrames,
    durationSeconds: durationFrames / 25,
    cooldownFrames: 25,
    cooldownSeconds: 1.0,
    manaCost: 15,
    manaCost256: 3840,
    stateName: 'wolf',
  }
}

/**
 * Skill 224: Lycanthropy (Shape Shifting)
 * Ground Truth:
 * - Passive skill
 * - Duration bonus: 1000 + (slvl - 1) * 500 frames (+20s/lvl)
 * - Max HP bonus: 20 + (slvl - 1) * 5 % (+20% base, +5%/lvl)
 */
export function calculateLycanthropyStats(slvl: number): LycanthropyStats {
  const lvl = Math.max(1, slvl)
  const durationBonusFrames = 1000 + (lvl - 1) * 500
  const maxHpBonusPct = 20 + (lvl - 1) * 5

  return {
    durationBonusFrames,
    durationBonusSeconds: durationBonusFrames / 25,
    maxHpBonusPct,
    isPassive: true,
  }
}

/**
 * Skill 228: Werebear (Wearbear)
 * Ground Truth:
 * - Enhanced Damage: 50 + (slvl - 1) * 8 %
 * - Armor / Defense: 25 + (slvl - 1) * 6 %
 * - Max HP: 50% base + Lycanthropy.ln34 (20 + (lycBlvl - 1) * 5)%
 * - Duration: 1000 frames (40s) + Lycanthropy.ln12 (1000 + (lycBlvl - 1) * 500 frames)
 * - Mana: 15, Cooldown: 25 frames (1.0s)
 */
export function calculateWerebearStats(
  slvl: number,
  lycanthropyBlvl = 0,
): WerebearStats {
  const lvl = Math.max(1, slvl)
  const lycPts = Math.max(0, lycanthropyBlvl)

  const damageBonusPct = 50 + (lvl - 1) * 8
  const defenseBonusPct = 25 + (lvl - 1) * 6

  const lycHpBonus = lycPts > 0 ? 20 + (lycPts - 1) * 5 : 0
  const maxHpBonusPct = 50 + lycHpBonus

  const lycDurationBonus = lycPts > 0 ? 1000 + (lycPts - 1) * 500 : 0
  const durationFrames = 1000 + lycDurationBonus

  return {
    damageBonusPct,
    defenseBonusPct,
    maxHpBonusPct,
    durationFrames,
    durationSeconds: durationFrames / 25,
    cooldownFrames: 25,
    cooldownSeconds: 1.0,
    manaCost: 15,
    manaCost256: 3840,
    stateName: 'bear',
  }
}

/**
 * Skill 232: Feral Rage
 * Ground Truth (D2Game_SKILLS_SrvDo030_FeralRage_Maul @ 0x6fd04fd0):
 * - Wolf-only attack
 * - Damage: 50 + (slvl - 1) * 5 %
 * - ToHit: 20 + (slvl - 1) * 10 %
 * - Max charges: calc2 = floor(slvl / 2) + 3
 * - Per-charge Life Leech: 4 * charge % (range 4% .. 4 * maxCharges %)
 * - Per-charge Velocity: dm(10, 70, charge) % (range 19% .. dm(10, 70, maxCharges) %)
 * - Duration: 500 frames (20.0s)
 * - Mana: 3
 */
export function calculateFeralRageStats(
  slvl: number,
  currentCharge?: number,
): FeralRageStats {
  const lvl = Math.max(1, slvl)
  const maxCharges = Math.floor(lvl / 2) + 3
  const charge =
    currentCharge !== undefined
      ? Math.max(1, Math.min(maxCharges, currentCharge))
      : maxCharges
  const damageBonusPct = 50 + (lvl - 1) * 5
  const toHitBonusPct = 20 + (lvl - 1) * 10
  const minLifeLeechPct = 4
  const maxLifeLeechPct = 4 * maxCharges
  const lifeLeechPct = 4 * charge
  const minVelocityBonusPct = computeDiminishingReturns(10, 70, 1)
  const maxVelocityBonusPct = computeDiminishingReturns(10, 70, maxCharges)
  const velocityBonusPct = computeDiminishingReturns(10, 70, charge)
  const stage = Math.min(3, Math.floor((3 * (charge - 1)) / maxCharges) + 1)

  return {
    damageBonusPct,
    toHitBonusPct,
    lifeLeechPct,
    minLifeLeechPct,
    maxLifeLeechPct,
    velocityBonusPct,
    minVelocityBonusPct,
    maxVelocityBonusPct,
    durationFrames: 500,
    durationSeconds: 20.0,
    currentCharge: charge,
    maxCharges,
    manaCost: 3,
    manaCost256: 768,
    stateName: 'feralrage',
    overlayName: `feralrage${stage}front`,
  }
}

/**
 * Skill 233: Maul
 * Ground Truth (D2Game_SKILLS_SrvDo030_FeralRage_Maul @ 0x6fd04fd0):
 * - Bear-only attack
 * - Max charges: calc2 = floor(slvl / 2) + 3
 * - Damage bonus per charge: 20 * charge % (range 20% .. 20 * maxCharges %)
 * - ToHit: 20 + (slvl - 1) * 10 %
 * - Stun duration: dm(10, 100, charge) frames
 * - Duration: 500 frames (20.0s)
 * - Mana: 3
 */
export function calculateMaulStats(
  slvl: number,
  currentCharge?: number,
): MaulStats {
  const lvl = Math.max(1, slvl)
  const maxCharges = Math.floor(lvl / 2) + 3
  const charge =
    currentCharge !== undefined
      ? Math.max(1, Math.min(maxCharges, currentCharge))
      : maxCharges
  const damageBonusPerChargePct = 20
  const minDamageBonusPct = 20
  const maxDamageBonusPct = 20 * maxCharges
  const damageBonusPct = 20 * charge
  const toHitBonusPct = 20 + (lvl - 1) * 10
  const minStunDurationFrames = computeDiminishingReturns(10, 100, 1)
  const maxStunDurationFrames = computeDiminishingReturns(10, 100, maxCharges)
  const stunDurationFrames = computeDiminishingReturns(10, 100, charge)
  const stage = Math.min(3, Math.floor((3 * (charge - 1)) / maxCharges) + 1)

  return {
    damageBonusPerChargePct,
    damageBonusPct,
    minDamageBonusPct,
    maxDamageBonusPct,
    toHitBonusPct,
    stunDurationFrames,
    minStunDurationFrames,
    maxStunDurationFrames,
    stunDurationSeconds: Number((stunDurationFrames / 25).toFixed(2)),
    durationFrames: 500,
    durationSeconds: 20.0,
    currentCharge: charge,
    maxCharges,
    manaCost: 3,
    manaCost256: 768,
    stateName: 'maul',
    overlayName: `maul${stage}front`,
  }
}

/**
 * Skill 238: Rabies
 * Ground Truth:
 * - Wolf-only infectious bite
 * - Poison damage: HitShift = 3 (8/256 per frame), eMin=6 [4, 5, 7, 11, 16], eMax=14 [4, 5, 7, 11, 16]
 * - Poison length: 100 + (slvl - 1) * 10 frames (4s + 0.4s/lvl)
 * - ToHit: 50 + (slvl - 1) * 7 %
 * - Synergy: +18% poison damage per blvl in Plague Poppy (Poison Creeper #222)
 * - Contagion radius: 7 subtiles (4.66 yards), spread cadence: every 4 frames
 * - Mana: 10
 */
export function calculateRabiesStats(
  slvl: number,
  plaguePoppyBlvl = 0,
): RabiesStats {
  const lvl = Math.max(1, slvl)
  const ppPts = Math.max(0, plaguePoppyBlvl)

  const rawMin = compute5BandScaling(lvl, 6, 4, 5, 7, 11, 16)
  const rawMax = compute5BandScaling(lvl, 14, 4, 5, 7, 11, 16)
  const synergyBonusPct = ppPts * 18

  const minBitrate256 = Math.trunc((rawMin * 8 * (100 + synergyBonusPct)) / 100)
  const maxBitrate256 = Math.trunc((rawMax * 8 * (100 + synergyBonusPct)) / 100)
  const poisonDurationFrames = 100 + (lvl - 1) * 10
  const minPoisonDamage = Math.floor((minBitrate256 * poisonDurationFrames) / 256)
  const maxPoisonDamage = Math.floor((maxBitrate256 * poisonDurationFrames) / 256)

  return {
    minBitrate256,
    maxBitrate256,
    minPoisonDamage,
    maxPoisonDamage,
    poisonDurationFrames,
    poisonDurationSeconds: poisonDurationFrames / 25,
    toHitBonusPct: 50 + (lvl - 1) * 7,
    contagionRadiusSubtiles: 7,
    contagionSpreadIntervalFrames: 4,
    synergyBonusPct,
    manaCost: 10,
    manaCost256: 2560,
    overlayName: 'rabiesplague',
  }
}

/**
 * Skill 239: Fire Claws
 * Ground Truth:
 * - Usable in Wolf or Bear form
 * - Fire damage: eMin=15 [8, 12, 20, 24, 30], eMax=20 [8, 12, 22, 26, 34]
 * - ToHit: 50 + (slvl - 1) * 15 %
 * - Synergies: +22% fire damage per blvl in Firestorm, Molten Boulder, Volcano, Eruption
 * - Mana: 4
 */
export function calculateFireClawsStats(
  slvl: number,
  firestormBlvl = 0,
  moltenBoulderBlvl = 0,
  volcanoBlvl = 0,
  eruptionBlvl = 0,
): FireClawsStats {
  const lvl = Math.max(1, slvl)
  const synTotal =
    Math.max(0, firestormBlvl) +
    Math.max(0, moltenBoulderBlvl) +
    Math.max(0, volcanoBlvl) +
    Math.max(0, eruptionBlvl)

  const rawMin = compute5BandScaling(lvl, 15, 8, 12, 20, 24, 30)
  const rawMax = compute5BandScaling(lvl, 20, 8, 12, 22, 26, 34)
  const synergyBonusPct = synTotal * 22

  const minFireDamage = Math.trunc((rawMin * (100 + synergyBonusPct)) / 100)
  const maxFireDamage = Math.trunc((rawMax * (100 + synergyBonusPct)) / 100)

  return {
    minFireDamage,
    maxFireDamage,
    toHitBonusPct: 50 + (lvl - 1) * 15,
    synergyBonusPct,
    manaCost: 4,
    manaCost256: 1024,
  }
}

/**
 * Skill 242: Hunger
 * Ground Truth:
 * - Usable in Wolf or Bear form
 * - Damage penalty: -75% weapon damage
 * - Life Leech: dm(50, 200, slvl) %
 * - Mana Leech: dm(50, 200, slvl) %
 * - ToHit: 50 + (slvl - 1) * 10 %
 * - Mana: 3
 */
export function calculateHungerStats(slvl: number): HungerStats {
  const lvl = Math.max(1, slvl)
  const leechPct = computeDiminishingReturns(50, 200, lvl)

  return {
    damagePenaltyPct: -75,
    lifeLeechPct: leechPct,
    manaLeechPct: leechPct,
    toHitBonusPct: 50 + (lvl - 1) * 10,
    manaCost: 3,
    manaCost256: 768,
  }
}

/**
 * Skill 243: Shock Wave
 * Ground Truth:
 * - Bear-only frontal sonic roar
 * - Phys damage: minDam=10 [3, 5, 7, 7, 7], maxDam=20 [3, 5, 7, 7, 7]
 * - Stun duration: ln12 = 40 + (slvl - 1) * 15 frames (1.6s at slvl 1, +0.6s/lvl)
 * - Synergy: +5% physical damage per blvl in Maul
 * - Mana: 7
 */
export function calculateShockWaveStats(
  slvl: number,
  maulBlvl = 0,
): ShockWaveStats {
  const lvl = Math.max(1, slvl)
  const maulPts = Math.max(0, maulBlvl)

  const rawMin = compute5BandScaling(lvl, 10, 3, 5, 7, 7, 7)
  const rawMax = compute5BandScaling(lvl, 20, 3, 5, 7, 7, 7)
  const synergyBonusPct = maulPts * 5

  const minPhysicalDamage = Math.trunc((rawMin * (100 + synergyBonusPct)) / 100)
  const maxPhysicalDamage = Math.trunc((rawMax * (100 + synergyBonusPct)) / 100)
  const stunDurationFrames = Math.min(250, 40 + (lvl - 1) * 15)

  return {
    minPhysicalDamage,
    maxPhysicalDamage,
    stunDurationFrames,
    stunDurationSeconds: stunDurationFrames / 25,
    synergyBonusPct,
    cooldownFrames: 0,
    manaCost: 7,
    manaCost256: 1792,
    missileName: 'shockwave',
  }
}

/**
 * Skill 248: Fury
 * Ground Truth:
 * - Wolf-only rapid multi-attack sequence
 * - Enhanced Damage: 100 + (slvl - 1) * 17 %
 * - ToHit: 50 + (slvl - 1) * 7 %
 * - Attack count: min(2 + slvl - 1, 5) hits
 * - Uninterruptible sequence
 * - Mana: 4
 */
export function calculateFuryStats(slvl: number): FuryStats {
  const lvl = Math.max(1, slvl)
  const damageBonusPct = 100 + (lvl - 1) * 17
  const toHitBonusPct = 50 + (lvl - 1) * 7
  const attackCount = Math.min(2 + lvl - 1, 5)

  return {
    damageBonusPct,
    toHitBonusPct,
    attackCount,
    isUninterruptible: true,
    manaCost: 4,
    manaCost256: 1024,
  }
}

// --- Kinematics & Mechanics Simulation Helpers ---

/**
 * Validates whether a given skill can be executed in the current Druid form.
 */
export function canCastShapeShiftSkill(
  currentForm: 'human' | 'wolf' | 'bear',
  skillId: number,
): boolean {
  switch (skillId) {
    case DRUID_SHAPESHIFT_SKILL_IDS.WEREWOLF:
    case DRUID_SHAPESHIFT_SKILL_IDS.WEREBEAR:
      // 1.13c Skills.txt restrict = 1, State1 = wolf, State2 = bear:
      // Castable in human (transform), same form (revert), or opposite beast form (cross-morph).
      return currentForm === 'human' || currentForm === 'wolf' || currentForm === 'bear'

    case DRUID_SHAPESHIFT_SKILL_IDS.FERAL_RAGE:
    case DRUID_SHAPESHIFT_SKILL_IDS.RABIES:
    case DRUID_SHAPESHIFT_SKILL_IDS.FURY:
      // Strictly Werewolf only (restrict = 2, State1 = wolf)
      return currentForm === 'wolf'

    case DRUID_SHAPESHIFT_SKILL_IDS.MAUL:
    case DRUID_SHAPESHIFT_SKILL_IDS.SHOCK_WAVE:
      // Strictly Werebear only (restrict = 2, State1 = bear)
      return currentForm === 'bear'

    case DRUID_SHAPESHIFT_SKILL_IDS.FIRE_CLAWS:
    case DRUID_SHAPESHIFT_SKILL_IDS.HUNGER:
      // Can be used in either beast form, but not human (restrict = 2, State1 = wolf, State2 = bear)
      return currentForm === 'wolf' || currentForm === 'bear'

    case DRUID_SHAPESHIFT_SKILL_IDS.LYCANTHROPY:
      // Passive
      return true

    default:
      return canCastDruidSkill(currentForm, skillId)
  }
}

/**
 * Validates whether any Druid skill (IDs 221..250) can be executed in the current form.
 * 1.13c Ground Truth (`Skills.txt` `restrict` & `State1..3`):
 * - `restrict = 1` (castable in Human, Werewolf, OR Werebear form):
 *   - All 10 Summoning skills: Raven (221), Poison Creeper (222), Oak Sage (226), Spirit Wolf (227),
 *     Carrion Vine (231), Heart of Wolverine (236), Summon Dire Wolf (237), Solar Creeper (241),
 *     Spirit of Barbs (246), Summon Grizzly (247).
 *   - Werewolf (223), Werebear (228), and Armageddon (249).
 * - `restrict = 2` (beast-form restricted):
 *   - Feral Rage (232), Rabies (238), Fury (248): Wolf only (`State1 = wolf`)
 *   - Maul (233), Shock Wave (243): Bear only (`State1 = bear`)
 *   - Fire Claws (239), Hunger (242): Wolf or Bear (`State1 = wolf, State2 = bear`)
 * - `restrict = 0 / empty` (Human form ONLY — blocked in Werewolf and Werebear):
 *   - Firestorm (225), Molten Boulder (229), Arctic Blast (230), Fissure (234),
 *     Cyclone Armor (235), Twister (240), Volcano (244), Tornado (245), Hurricane (250).
 */
export function canCastDruidSkill(
  currentForm: 'human' | 'wolf' | 'bear',
  skillId: number,
): boolean {
  // Passives
  if (skillId === DRUID_SHAPESHIFT_SKILL_IDS.LYCANTHROPY) {
    return true
  }

  // restrict = 1: Shapeshift-allowed spells, transformations, and all 10 Druid summons
  if (
    skillId === 221 ||
    skillId === 222 ||
    skillId === DRUID_SHAPESHIFT_SKILL_IDS.WEREWOLF ||
    skillId === 226 ||
    skillId === 227 ||
    skillId === DRUID_SHAPESHIFT_SKILL_IDS.WEREBEAR ||
    skillId === 231 ||
    skillId === 236 ||
    skillId === 237 ||
    skillId === 241 ||
    skillId === 246 ||
    skillId === 247 ||
    skillId === 249
  ) {
    return true
  }

  // restrict = 2, State1 = wolf: Wolf-only attacks
  if (
    skillId === DRUID_SHAPESHIFT_SKILL_IDS.FERAL_RAGE ||
    skillId === DRUID_SHAPESHIFT_SKILL_IDS.RABIES ||
    skillId === DRUID_SHAPESHIFT_SKILL_IDS.FURY
  ) {
    return currentForm === 'wolf'
  }

  // restrict = 2, State1 = bear: Bear-only attacks
  if (
    skillId === DRUID_SHAPESHIFT_SKILL_IDS.MAUL ||
    skillId === DRUID_SHAPESHIFT_SKILL_IDS.SHOCK_WAVE
  ) {
    return currentForm === 'bear'
  }

  // restrict = 2, State1 = wolf, State2 = bear: Dual-beast attacks
  if (
    skillId === DRUID_SHAPESHIFT_SKILL_IDS.FIRE_CLAWS ||
    skillId === DRUID_SHAPESHIFT_SKILL_IDS.HUNGER
  ) {
    return currentForm === 'wolf' || currentForm === 'bear'
  }

  // restrict = 0 / empty: All 9 other Elemental spells (225, 229, 230, 234, 235, 240, 244, 245, 250) require human form
  if (skillId >= 221 && skillId <= 250) {
    return currentForm === 'human'
  }

  return true
}

/**
 * Advance charge-up orb counter on successful melee connection (Maul, Feral Rage).
 */
export function advanceChargeOrb(currentCharge: number, maxCharge: number): number {
  return Math.min(Math.max(0, currentCharge) + 1, maxCharge)
}

export interface ContagionTarget {
  readonly id: string
  readonly x: number
  readonly y: number
}

/**
 * Simulate Rabies contagious spread between adjacent infected and healthy targets.
 * Spread occurs within contagionRadiusSubtiles (default 7 subtiles = 140px in world units).
 */
export function simulateRabiesContagion(
  infectedTargets: readonly ContagionTarget[],
  healthyTargets: readonly ContagionTarget[],
  radiusPx = 140,
): string[] {
  const newlyInfectedIds: string[] = []

  for (const healthy of healthyTargets) {
    let infected = false
    for (const source of infectedTargets) {
      const dx = healthy.x - source.x
      const dy = (healthy.y - source.y) * 2 // 2:1 isometric space
      const distSq = dx * dx + dy * dy
      if (distSq <= radiusPx * radiusPx) {
        infected = true
        break
      }
    }
    if (infected) {
      newlyInfectedIds.push(healthy.id)
    }
  }

  return newlyInfectedIds
}

export interface FuryStrikeDistribution {
  readonly targetId: string
  readonly hitIndex: number
}

/**
 * Distribute Fury multi-hit strike sequence across nearby target enemies.
 * If 1 target, all strikes focus on that target. If multiple targets, alternates between them.
 */
export function distributeFuryStrikes(
  targetIds: readonly string[],
  totalHits: number,
): FuryStrikeDistribution[] {
  if (targetIds.length === 0 || totalHits <= 0) return []

  const strikes: FuryStrikeDistribution[] = []
  for (let i = 0; i < totalHits; i++) {
    const targetId = targetIds[i % targetIds.length]!
    strikes.push({
      targetId,
      hitIndex: i + 1,
    })
  }

  return strikes
}
