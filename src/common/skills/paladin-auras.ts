/**
 * Diablo II: Lord of Destruction v1.13c — Paladin Offensive & Defensive Auras Shared Module
 *
 * Dedicated pure calculation, pulse cadence, and synergy formulas for all 20 Paladin Auras:
 *
 * Offensive Auras (10 skills):
 * - Skill 098: Might (ReqLevel 1) — `aurastate = might` (#33)
 * - Skill 102: Holy Fire (ReqLevel 6) — `aurastate = holyfire` (#35)
 * - Skill 103: Thorns (ReqLevel 6) — `aurastate = thorns` (#36)
 * - Skill 108: Blessed Aim (ReqLevel 12) — `aurastate = blessedaim` (#40), `passivestate = 180` (+5% AR/blvl when off)
 * - Skill 113: Concentration (ReqLevel 18) — `aurastate = concentration` (#42)
 * - Skill 114: Holy Freeze (ReqLevel 18) — `aurastate = holywind` (#43), `auratargetstate = holywindcold` (#44)
 * - Skill 118: Holy Shock (ReqLevel 24) — `aurastate = holyshock` (#46)
 * - Skill 119: Sanctuary (ReqLevel 24) — `aurastate = sanctuary` (#47)
 * - Skill 122: Fanaticism (ReqLevel 30) — `aurastate = fanaticism` (#49)
 * - Skill 123: Conviction (ReqLevel 30) — `aurastate = conviction` (#28), `auratargetstate = conviction` (#28)
 *
 * Defensive Auras (10 skills):
 * - Skill 099: Prayer (ReqLevel 1) — `aurastate = prayer` (#34)
 * - Skill 100: Resist Fire (ReqLevel 1) — `aurastate = resistfire` (#3), `passivestate = 181` (+floor(blvl/2)% max fire res when off)
 * - Skill 104: Defiance (ReqLevel 6) — `aurastate = defiance` (#37)
 * - Skill 105: Resist Cold (ReqLevel 6) — `aurastate = resistcold` (#4), `passivestate = 182` (+floor(blvl/2)% max cold res when off)
 * - Skill 109: Cleansing (ReqLevel 12) — `aurastate = cleansing` (#45)
 * - Skill 110: Resist Lightning (ReqLevel 12) — `aurastate = resistlight` (#5), `passivestate = 183` (+floor(blvl/2)% max light res when off)
 * - Skill 115: Vigor (ReqLevel 18) — `aurastate = stamina` (#41)
 * - Skill 120: Meditation (ReqLevel 24) — `aurastate = meditation` (#48)
 * - Skill 124: Redemption (ReqLevel 30) — `aurastate = redemption` (#50), corpse `STATE_REDEEMED` (#99)
 * - Skill 125: Salvation (ReqLevel 30) — `aurastate = resistall` (#8)
 */

import { compute5BandScaling, computeDiminishingReturns } from '../data/calc-ast.ts'

// ============================================================================
// PALADIN AURA SKILL IDS & STATES.TXT CASTER AURA STATE MAPPING
// ============================================================================

export const PALADIN_OFFENSIVE_AURA_IDS = [
  98, 102, 103, 108, 113, 114, 118, 119, 122, 123,
] as const

export const PALADIN_DEFENSIVE_AURA_IDS = [
  99, 100, 104, 105, 109, 110, 115, 120, 124, 125,
] as const

export const PALADIN_AURA_SKILL_IDS = [
  98, 99, 100, 102, 103, 104, 105, 108, 109, 110,
  113, 114, 115, 118, 119, 120, 122, 123, 124, 125,
] as const

/**
 * Exact 1.13c `Skills.txt` `aurastate` -> `States.txt` row id for each Paladin Aura skill
 * (States.txt: 28 conviction, 29 convicted, 50 redemption, 51 battlecommand — Issue #1046).
 */
export const PALADIN_AURA_STATE_BY_SKILL_ID: Readonly<Record<number, number>> = {
  98: 33,  // Might -> might (#33)
  99: 34,  // Prayer -> prayer (#34)
  100: 3,  // Resist Fire -> resistfire (#3)
  102: 35, // Holy Fire -> holyfire (#35)
  103: 36, // Thorns -> thorns (#36)
  104: 37, // Defiance -> defiance (#37)
  105: 4,  // Resist Cold -> resistcold (#4)
  108: 40, // Blessed Aim -> blessedaim (#40)
  109: 45, // Cleansing -> cleansing (#45)
  110: 5,  // Resist Lightning -> resistlight (#5)
  113: 42, // Concentration -> concentration (#42)
  114: 43, // Holy Freeze -> holywind (#43)
  115: 41, // Vigor -> stamina (#41)
  118: 46, // Holy Shock -> holyshock (#46)
  119: 47, // Sanctuary -> sanctuary (#47)
  120: 48, // Meditation -> meditation (#48)
  122: 49, // Fanaticism -> fanaticism (#49)
  123: 28, // Conviction -> conviction (#28)
  124: 50, // Redemption -> redemption (#50)
  125: 8,  // Salvation -> resistall (#8)
}

const PALADIN_AURA_SKILL_SET = new Set<number>(PALADIN_AURA_SKILL_IDS)

export function isPaladinAuraSkill(skillId: number): boolean {
  return PALADIN_AURA_SKILL_SET.has(skillId)
}

// ============================================================================
// INTERFACES — OFFENSIVE AURAS (10 SKILLS)
// ============================================================================

export interface MightStats {
  readonly damagePercent: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface HolyFireStats {
  readonly pulseMin: number
  readonly pulseMax: number
  readonly pulseMin256: number
  readonly pulseMax256: number
  readonly weaponFireMin: number
  readonly weaponFireMax: number
  readonly synergyBonusPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface ThornsStats {
  readonly reflectPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface BlessedAimStats {
  readonly attackRatingPct: number
  readonly passiveArBonusPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface ConcentrationStats {
  readonly damagePercent: number
  readonly uninterruptedChancePct: number
  readonly blessedHammerBonusPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface HolyFreezeStats {
  readonly slowPct: number
  readonly pulseMin: number
  readonly pulseMax: number
  readonly pulseMin256: number
  readonly pulseMax256: number
  readonly weaponColdMin: number
  readonly weaponColdMax: number
  readonly chillDurationFrames: number
  readonly chillDurationSeconds: number
  readonly synergyBonusPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface HolyShockStats {
  readonly pulseMin: number
  readonly pulseMax: number
  readonly pulseMin256: number
  readonly pulseMax256: number
  readonly weaponLightningMin: number
  readonly weaponLightningMax: number
  readonly synergyBonusPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface SanctuaryStats {
  readonly pulseMin: number
  readonly pulseMax: number
  readonly pulseMin256: number
  readonly pulseMax256: number
  readonly undeadDamagePercent: number
  readonly undeadAttackRating: number
  readonly synergyBonusPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface FanaticismStats {
  readonly casterIas: number
  readonly partyIas: number
  readonly iasPct: number
  readonly attackRatingPct: number
  readonly casterDamagePercent: number
  readonly partyDamagePercent: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface ConvictionStats {
  readonly defenseReductionPct: number
  readonly resistanceReductionPct: number
  readonly immunityBreakingReductionPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

// ============================================================================
// INTERFACES — DEFENSIVE AURAS (10 SKILLS)
// ============================================================================

export interface PrayerStats {
  readonly healAmount: number
  readonly healAmount256: number
  readonly manaCostPerFrame256: number
  readonly manaCostPerPulse256: number
  readonly manaCostPerPulse: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface ResistFireStats {
  readonly fireResistPct: number
  readonly maxFireResistBonusPct: number
  readonly passiveMaxFireResistPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface DefianceStats {
  readonly defensePercent: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface ResistColdStats {
  readonly coldResistPct: number
  readonly maxColdResistBonusPct: number
  readonly passiveMaxColdResistPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface CleansingStats {
  readonly curseReductionPct: number
  readonly poisonLengthReductionPct: number
  readonly prayerHealAmount: number
  readonly prayerHealAmount256: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface ResistLightningStats {
  readonly lightningResistPct: number
  readonly maxLightningResistBonusPct: number
  readonly passiveMaxLightningResistPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface VigorStats {
  readonly velocityPercent: number
  readonly staminaRecoveryBonusPct: number
  readonly maxStaminaPercent: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface MeditationStats {
  readonly manaRecoveryBonusPct: number
  readonly prayerHealAmount: number
  readonly prayerHealAmount256: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface RedemptionStats {
  readonly redemptionChancePct: number
  readonly lifeRecoverPts: number
  readonly manaRecoverPts: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

export interface SalvationStats {
  readonly fireResistPct: number
  readonly coldResistPct: number
  readonly lightningResistPct: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
}

// ============================================================================
// PALADIN OFFENSIVE AURAS (10 SKILLS) — 1.13c Ground Truth Calculators
// ============================================================================

/**
 * 1. Might (Skill 98)
 * - Party physical %ED: 40% + (slvl - 1) * 10%
 * - Radius: ln12 subtiles (16 + (slvl - 1) * 2) -> (radiusSubtiles * 2) / 3 yards
 */
export function calculateMightStats(slvl: number): MightStats {
  const lvl = Math.max(1, slvl)
  const damagePercent = 40 + (lvl - 1) * 10
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return { damagePercent, radiusSubtiles, radiusYards }
}

/**
 * 2. Holy Fire (Skill 102)
 * - Radial fire pulse (every 50 ticks)
 * - Weapon added fire damage: 6 * pulseMin .. 6 * pulseMax (`enms * 6 / 256`..`enma * 6 / 256`)
 * - Synergies: Resist Fire (+18%/blvl), Salvation (+6%/blvl)
 * - 5-band scaling with hitShift = 7: EMin=2, EMax=6, Lev1..5=[1, 2, 3, 5, 7]
 */
export function calculateHolyFireStats(
  slvl: number,
  synergies?: { resistFire?: number; salvation?: number },
): HolyFireStats {
  const lvl = Math.max(1, slvl)
  const baseMin = compute5BandScaling(lvl, 2, 1, 2, 3, 5, 7)
  const baseMax = compute5BandScaling(lvl, 6, 1, 2, 3, 5, 7)
  const rfBlvl = synergies?.resistFire ?? 0
  const salvBlvl = synergies?.salvation ?? 0
  const synergyBonusPct = rfBlvl * 18 + salvBlvl * 6

  // hitShift = 7 -> 256 fixed point is (base << 7)
  const rawMin256 = baseMin << 7
  const rawMax256 = baseMax << 7
  const pulseMin256 = Math.trunc((rawMin256 * (100 + synergyBonusPct)) / 100)
  const pulseMax256 = Math.trunc((rawMax256 * (100 + synergyBonusPct)) / 100)
  const pulseMin = pulseMin256 >> 8
  const pulseMax = pulseMax256 >> 8

  // Param5 = 6 (weapon damage multiplier): enms * 6 / 256
  const weaponFireMin = Math.trunc((pulseMin256 * 6) / 256)
  const weaponFireMax = Math.trunc((pulseMax256 * 6) / 256)

  const radiusSubtiles = 6 + (lvl - 1) * 1
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))

  return {
    pulseMin,
    pulseMax,
    pulseMin256,
    pulseMax256,
    weaponFireMin,
    weaponFireMax,
    synergyBonusPct,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 3. Thorns (Skill 103)
 * - Physical melee reflection: 250% + (slvl - 1) * 40%
 * - Radius: 16 + (slvl - 1) * 2 subtiles
 */
export function calculateThornsStats(slvl: number): ThornsStats {
  const lvl = Math.max(1, slvl)
  const reflectPct = 250 + (lvl - 1) * 40
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return { reflectPct, radiusSubtiles, radiusYards }
}

/**
 * 4. Blessed Aim (Skill 108)
 * - Active party %AR: 75% + (slvl - 1) * 15%
 * - Passive %AR: +5% per hard point (blvl * 5%) when aura is inactive
 * - Radius: 16 + (slvl - 1) * 2 subtiles
 */
export function calculateBlessedAimStats(
  slvl: number,
  blvl?: number,
): BlessedAimStats {
  const lvl = Math.max(1, slvl)
  const attackRatingPct = 75 + (lvl - 1) * 15
  const hardPoints = blvl !== undefined ? Math.max(0, blvl) : lvl
  const passiveArBonusPct = hardPoints * 5
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return { attackRatingPct, passiveArBonusPct, radiusSubtiles, radiusYards }
}

/**
 * 5. Concentration (Skill 113)
 * - Party physical %ED: 60% + (slvl - 1) * 15%
 * - Uninterrupted attack chance: 20% (Param1 = 20)
 * - Blessed Hammer synergy: +50% of active Concentration %ED (Math.trunc(damagePercent / 2))
 * - Radius: 16 + (slvl - 1) * 2 subtiles
 */
export function calculateConcentrationStats(slvl: number): ConcentrationStats {
  const lvl = Math.max(1, slvl)
  const damagePercent = 60 + (lvl - 1) * 15
  const uninterruptedChancePct = 20
  const blessedHammerBonusPct = Math.trunc(damagePercent / 2)
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    damagePercent,
    uninterruptedChancePct,
    blessedHammerBonusPct,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 6. Holy Freeze (Skill 114)
 * - Continuous enemy slow: `dm34` (`Param3 = 25, Param4 = 60` -> `computeDiminishingReturns(25, 60, slvl)`:
 *   30% at slvl 1, 50% at slvl 10, 54% at slvl 20, cap 60%), bypasses Cannot Be Frozen (CBF)
 * - Radial cold pulse (every 50 ticks)
 * - Weapon added cold damage: 5 * pulseMin .. 5 * pulseMax (`enms * 5 / 256`..`enma * 5 / 256`)
 * - `ELen = 0` in `Skills.txt` row 114 (`chillDurationFrames = 0`; slow comes from `holywindcold` state lasting `perdelay = 50` frames)
 * - Synergies: Resist Cold (+15%/blvl), Salvation (+7%/blvl)
 * - 5-band scaling with hitShift = 8: EMin=2, EMax=3, Lev1..5=[1, 2, 3, 4, 5]
 */
export function calculateHolyFreezeStats(
  slvl: number,
  synergies?: { resistCold?: number; salvation?: number },
): HolyFreezeStats {
  const lvl = Math.max(1, slvl)
  const slowPct = computeDiminishingReturns(25, 60, lvl)
  const baseMin = compute5BandScaling(lvl, 2, 1, 2, 3, 4, 5)
  const baseMax = compute5BandScaling(lvl, 3, 1, 2, 3, 4, 5)
  const rcBlvl = synergies?.resistCold ?? 0
  const salvBlvl = synergies?.salvation ?? 0
  const synergyBonusPct = rcBlvl * 15 + salvBlvl * 7

  // hitShift = 8
  const rawMin256 = baseMin << 8
  const rawMax256 = baseMax << 8
  const pulseMin256 = Math.trunc((rawMin256 * (100 + synergyBonusPct)) / 100)
  const pulseMax256 = Math.trunc((rawMax256 * (100 + synergyBonusPct)) / 100)
  const pulseMin = pulseMin256 >> 8
  const pulseMax = pulseMax256 >> 8

  // Param5 = 5 (weapon damage multiplier)
  const weaponColdMin = Math.trunc((pulseMin256 * 5) / 256)
  const weaponColdMax = Math.trunc((pulseMax256 * 5) / 256)

  // Skills.txt row 114: ELen = 0 (no separate cold length; slow is applied via holywindcold state for 50 frames)
  const chillDurationFrames = 0
  const chillDurationSeconds = 0

  const radiusSubtiles = 6 + (lvl - 1) * 1
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))

  return {
    slowPct,
    pulseMin,
    pulseMax,
    pulseMin256,
    pulseMax256,
    weaponColdMin,
    weaponColdMax,
    chillDurationFrames,
    chillDurationSeconds,
    synergyBonusPct,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 7. Holy Shock (Skill 118)
 * - Radial lightning pulse (every 50 ticks): min strictly 1, max scales Lev1..5=[6, 8, 10, 12, 15]
 * - Weapon added lightning damage: min 1, max 6 * pulseMax (`enma * 6 / 256`)
 * - Synergies: Resist Lightning (+12%/blvl), Salvation (+4%/blvl)
 * - hitShift = 8
 */
export function calculateHolyShockStats(
  slvl: number,
  synergies?: { resistLightning?: number; salvation?: number },
): HolyShockStats {
  const lvl = Math.max(1, slvl)
  const baseMin = 1
  const baseMax = compute5BandScaling(lvl, 10, 6, 8, 10, 12, 15)
  const rlBlvl = synergies?.resistLightning ?? 0
  const salvBlvl = synergies?.salvation ?? 0
  const synergyBonusPct = rlBlvl * 12 + salvBlvl * 4

  // hitShift = 8
  const rawMin256 = baseMin << 8
  const rawMax256 = baseMax << 8
  const pulseMin256 = Math.trunc((rawMin256 * (100 + synergyBonusPct)) / 100)
  const pulseMax256 = Math.trunc((rawMax256 * (100 + synergyBonusPct)) / 100)
  const pulseMin = pulseMin256 >> 8
  const pulseMax = pulseMax256 >> 8

  // Param5 = 6 (weapon damage multiplier)
  const weaponLightningMin = 1
  const weaponLightningMax = Math.trunc((pulseMax256 * 6) / 256)

  const radiusSubtiles = 6 + (lvl - 1) * 1
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))

  return {
    pulseMin,
    pulseMax,
    pulseMin256,
    pulseMax256,
    weaponLightningMin,
    weaponLightningMax,
    synergyBonusPct,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 8. Sanctuary (Skill 119)
 * - Radial magic pulse + knockback every 50 ticks strictly vs Undead
 * - Direct weapon attacks ignore positive Undead physical resistance (clamps damageresist > 0 to 0%)
 * - Direct weapon %ED vs Undead: 150% + (slvl - 1) * 30%
 * - Direct weapon AR vs Undead: 100 + (slvl - 1) * 50
 * - Synergy: Cleansing (+7%/blvl magic damage)
 * - hitShift = 8: EMin=8 Lev1..5=[4, 4, 5, 5, 6], EMax=16 Lev1..5=[4, 5, 6, 6, 7]
 */
export function calculateSanctuaryStats(
  slvl: number,
  synergies?: { cleansing?: number },
): SanctuaryStats {
  const lvl = Math.max(1, slvl)
  const baseMin = compute5BandScaling(lvl, 8, 4, 4, 5, 5, 6)
  const baseMax = compute5BandScaling(lvl, 16, 4, 5, 6, 6, 7)
  const cleansingBlvl = synergies?.cleansing ?? 0
  const synergyBonusPct = cleansingBlvl * 7

  // hitShift = 8
  const rawMin256 = baseMin << 8
  const rawMax256 = baseMax << 8
  const pulseMin256 = Math.trunc((rawMin256 * (100 + synergyBonusPct)) / 100)
  const pulseMax256 = Math.trunc((rawMax256 * (100 + synergyBonusPct)) / 100)
  const pulseMin = pulseMin256 >> 8
  const pulseMax = pulseMax256 >> 8

  const undeadDamagePercent = 150 + (lvl - 1) * 30
  const undeadAttackRating = 100 + (lvl - 1) * 50

  const radiusSubtiles = 5 + (lvl - 1) * 1
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))

  return {
    pulseMin,
    pulseMax,
    pulseMin256,
    pulseMax256,
    undeadDamagePercent,
    undeadAttackRating,
    synergyBonusPct,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 9. Fanaticism (Skill 122)
 * - IAS (`aurastat1 = attackrate`, `dm34` with `Param3 = 10, Param4 = 40`):
 *   `computeDiminishingReturns(10, 40, slvl)` (14% at slvl 1, 30% at slvl 10, 35% at slvl 20, cap 40%)
 *   Granted equally to both caster and party allies in range!
 * - Attack Rating (`aurastat2 = item_tohit_percent`, `ln78`): 40% + (slvl - 1) * 5%
 * - Caster physical %ED (`ln56`): 50% + (slvl - 1) * 17%
 * - Party physical %ED (`ln56 / 2`): strictly HALF of caster %ED (`Math.trunc(casterDamagePercent / 2)`)
 * - Radius: 11 + (slvl - 1) * 1 subtiles
 */
export function calculateFanaticismStats(slvl: number): FanaticismStats {
  const lvl = Math.max(1, slvl)
  const iasPct = computeDiminishingReturns(10, 40, lvl)
  const casterIas = iasPct
  const partyIas = iasPct
  const attackRatingPct = 40 + (lvl - 1) * 5
  const casterDamagePercent = 50 + (lvl - 1) * 17
  const partyDamagePercent = Math.trunc(casterDamagePercent / 2)
  const radiusSubtiles = 11 + (lvl - 1) * 1
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    casterIas,
    partyIas,
    iasPct,
    attackRatingPct,
    casterDamagePercent,
    partyDamagePercent,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 10. Conviction (Skill 123)
 * - Defense reduction % (`aurastat1 = skill_armor_percent`, `-dm56` with `Param5 = 40, Param6 = 100`):
 *   `computeDiminishingReturns(40, 100, slvl)` (49% at slvl 1, 81% at slvl 10, 90% at slvl 20, cap 100%)
 * - Elemental resistance reduction (Fire, Cold, Lightning): `min(150, 30 + (slvl - 1) * 5)`%
 * - 1.13c Immunity breaking: applies at 1/5th effectiveness (-6%..-30%) against elemental immunities (`baseRes >= 100%`)
 * - Does NOT affect Poison or Magic resistance!
 * - Radius: fixed 20 subtiles (13.33 yards)
 */
export function calculateConvictionStats(slvl: number): ConvictionStats {
  const lvl = Math.max(1, slvl)
  const defenseReductionPct = computeDiminishingReturns(40, 100, lvl)
  const resistanceReductionPct = Math.min(150, 30 + (lvl - 1) * 5)
  const immunityBreakingReductionPct = Math.trunc(resistanceReductionPct / 5)
  const radiusSubtiles = 20
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    defenseReductionPct,
    resistanceReductionPct,
    immunityBreakingReductionPct,
    radiusSubtiles,
    radiusYards,
  }
}

// ============================================================================
// PALADIN DEFENSIVE AURAS (10 SKILLS) — 1.13c Ground Truth Calculators
// ============================================================================

/**
 * 1. Prayer (Skill 99)
 * - Periodic heal pulse (every 50 ticks): `edns = compute5BandScaling(slvl, 2, 1, 1, 2, 2, 3)` HP
 *   (slvl 1: 2 HP, slvl 10: 11 HP, slvl 20: 25 HP)
 * - 1.13c Mana cost per 50-frame pulse (`Skills.txt` row 99: `mana = 16, lvlmana = 3, manashift = 4`):
 *   `manaCostPerPulse256 = (16 + 3 * (slvl - 1)) << 4` (`1 + 0.1875 * (slvl - 1)` mana per pulse)
 * - Legacy per-frame drain `manaCostPerFrame256 = 16` retained for compatibility
 * - Radius: ln12 subtiles (16 + (slvl - 1) * 2)
 */
export function calculatePrayerStats(slvl: number): PrayerStats {
  const lvl = Math.max(1, slvl)
  const healAmount = compute5BandScaling(lvl, 2, 1, 1, 2, 2, 3)
  const healAmount256 = healAmount << 8
  const manaCostPerFrame256 = 16
  const manaCostPerPulse256 = (16 + 3 * (lvl - 1)) << 4
  const manaCostPerPulse = Number((manaCostPerPulse256 / 256).toFixed(4))
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    healAmount,
    healAmount256,
    manaCostPerFrame256,
    manaCostPerPulse256,
    manaCostPerPulse,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 2. Resist Fire (Skill 100)
 * - Active party fire res: `dm34 = computeDiminishingReturns(35, 150, slvl)`
 *   (+53% at slvl 1, +114% at slvl 10, +132% at slvl 20)
 * - Active party max fire res (`aurastat2 = maxfireresist`, `aurastatcalc2 = blvl`):
 *   `+1%` per hard point (`blvl`) granted to caster and all party allies in range (suppresses caster's passive `blvl / 2`)
 * - Passive max fire res (`passivestate = 181`, `passivecalc1 = blvl / 2`):
 *   `+1%` per 2 hard points (`Math.floor(blvl / 2)`) for self when aura is inactive
 * - Radius: ln12 subtiles (16 + (slvl - 1) * 2)
 */
export function calculateResistFireStats(
  slvl: number,
  blvl?: number,
): ResistFireStats {
  const lvl = Math.max(1, slvl)
  const fireResistPct = computeDiminishingReturns(35, 150, lvl)
  const basePoints = blvl !== undefined ? Math.max(0, blvl) : lvl
  const passiveMaxFireResistPct = Math.floor(basePoints / 2)
  const maxFireResistBonusPct = basePoints
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    fireResistPct,
    maxFireResistBonusPct,
    passiveMaxFireResistPct,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 3. Defiance (Skill 104)
 * - Active party %Defense: `ln34 = 70 + (slvl - 1) * 10` (+70% at slvl 1, +160% at slvl 10, +260% at slvl 20)
 * - Synergizes Holy Shield (+15% defense per hard point)
 * - Radius: ln12 subtiles (16 + (slvl - 1) * 2)
 */
export function calculateDefianceStats(slvl: number): DefianceStats {
  const lvl = Math.max(1, slvl)
  const defensePercent = 70 + (lvl - 1) * 10
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    defensePercent,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 4. Resist Cold (Skill 105)
 * - Active party cold res: `dm34 = computeDiminishingReturns(35, 150, slvl)`
 *   (+53% at slvl 1, +114% at slvl 10, +132% at slvl 20)
 * - Active party max cold res (`aurastat2 = maxcoldresist`, `aurastatcalc2 = blvl`):
 *   `+1%` per hard point (`blvl`) granted to caster and all party allies in range (suppresses caster's passive `blvl / 2`)
 * - Passive max cold res (`passivestate = 182`, `passivecalc1 = blvl / 2`):
 *   `+1%` per 2 hard points (`Math.floor(blvl / 2)`) for self when aura is inactive
 * - Radius: ln12 subtiles (16 + (slvl - 1) * 2)
 */
export function calculateResistColdStats(
  slvl: number,
  blvl?: number,
): ResistColdStats {
  const lvl = Math.max(1, slvl)
  const coldResistPct = computeDiminishingReturns(35, 150, lvl)
  const basePoints = blvl !== undefined ? Math.max(0, blvl) : lvl
  const passiveMaxColdResistPct = Math.floor(basePoints / 2)
  const maxColdResistBonusPct = basePoints
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    coldResistPct,
    maxColdResistBonusPct,
    passiveMaxColdResistPct,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 5. Cleansing (Skill 109)
 * - Curse and poison duration reduction: `dm34` (`computeDiminishingReturns(30, 90, slvl)`:
 *   39% at slvl 1, 71% at slvl 10, 80% at slvl 20, cap 90%)
 * - Synergy: Free Prayer heal pulse (`skill('Prayer'.edns)` at Prayer effective slvl, 0 mana cost)
 * - Radius: ln12 subtiles (16 + (slvl - 1) * 2)
 */
export function calculateCleansingStats(
  slvl: number,
  prayerLvl?: number,
): CleansingStats {
  const lvl = Math.max(1, slvl)
  const curseReductionPct = computeDiminishingReturns(30, 90, lvl)
  const poisonLengthReductionPct = curseReductionPct
  const pLvl = prayerLvl !== undefined ? Math.max(0, prayerLvl) : 0
  const prayerHealAmount = pLvl > 0 ? compute5BandScaling(pLvl, 2, 1, 1, 2, 2, 3) : 0
  const prayerHealAmount256 = prayerHealAmount << 8
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    curseReductionPct,
    poisonLengthReductionPct,
    prayerHealAmount,
    prayerHealAmount256,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 6. Resist Lightning (Skill 110)
 * - Active party lightning res: `dm34 = computeDiminishingReturns(35, 150, slvl)`
 *   (+53% at slvl 1, +114% at slvl 10, +132% at slvl 20)
 * - Active party max lightning res (`aurastat2 = maxlightresist`, `aurastatcalc2 = blvl`):
 *   `+1%` per hard point (`blvl`) granted to caster and all party allies in range (suppresses caster's passive `blvl / 2`)
 * - Passive max lightning res (`passivestate = 183`, `passivecalc1 = blvl / 2`):
 *   `+1%` per 2 hard points (`Math.floor(blvl / 2)`) for self when aura is inactive
 * - Radius: ln12 subtiles (16 + (slvl - 1) * 2)
 */
export function calculateResistLightningStats(
  slvl: number,
  blvl?: number,
): ResistLightningStats {
  const lvl = Math.max(1, slvl)
  const lightningResistPct = computeDiminishingReturns(35, 150, lvl)
  const basePoints = blvl !== undefined ? Math.max(0, blvl) : lvl
  const passiveMaxLightningResistPct = Math.floor(basePoints / 2)
  const maxLightningResistBonusPct = basePoints
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    lightningResistPct,
    maxLightningResistBonusPct,
    passiveMaxLightningResistPct,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 7. Vigor (Skill 115)
 * - Faster Run/Walk (velocitypercent): `dm56 = computeDiminishingReturns(7, 50, slvl)`
 *   (+13% at slvl 1, +36% at slvl 10, +43% at slvl 20)
 * - Stamina recovery bonus (staminarecoverybonus): `ln34 = 50 + (slvl - 1) * 25`
 *   (+50% at slvl 1, +275% at slvl 10, +525% at slvl 20)
 * - Max stamina % (skill_staminapercent): `ln34 = 50 + (slvl - 1) * 25`
 * - Radius: ln12 subtiles (16 + (slvl - 1) * 3)
 */
export function calculateVigorStats(slvl: number): VigorStats {
  const lvl = Math.max(1, slvl)
  const velocityPercent = computeDiminishingReturns(7, 50, lvl)
  const staminaRecoveryBonusPct = 50 + (lvl - 1) * 25
  const maxStaminaPercent = 50 + (lvl - 1) * 25
  const radiusSubtiles = 16 + (lvl - 1) * 3
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    velocityPercent,
    staminaRecoveryBonusPct,
    maxStaminaPercent,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 8. Meditation (Skill 120)
 * - Active party mana recovery rate: `ln34 = 300 + (slvl - 1) * 25`
 *   (+300% at slvl 1, +525% at slvl 10, +775% at slvl 20)
 * - Synergy: Free Prayer heal pulse (`skill('Prayer'.edns)` at Prayer effective slvl, 0 mana cost)
 * - Note: 1.13c `aurafilter = 73729` (applies only to player units, excluding mercenaries & minions)
 * - Radius: ln12 subtiles (16 + (slvl - 1) * 2)
 */
export function calculateMeditationStats(
  slvl: number,
  prayerLvl?: number,
): MeditationStats {
  const lvl = Math.max(1, slvl)
  const manaRecoveryBonusPct = 300 + (lvl - 1) * 25
  const pLvl = prayerLvl !== undefined ? Math.max(0, prayerLvl) : 0
  const prayerHealAmount = pLvl > 0 ? compute5BandScaling(pLvl, 2, 1, 1, 2, 2, 3) : 0
  const prayerHealAmount256 = prayerHealAmount << 8
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    manaRecoveryBonusPct,
    prayerHealAmount,
    prayerHealAmount256,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 9. Redemption (Skill 124)
 * - 50-tick cadence, fixed 16 subtiles radius in 2:1 isometric ground space
 * - Redemption chance: `dm34 = computeDiminishingReturns(10, 100, slvl)`
 *   (24% at slvl 1, 71% at slvl 10, 86% at slvl 20)
 * - Life and Mana replenishment: `ln56 = 25 + (slvl - 1) * 5` (25 at slvl 1, 70 at slvl 10, 120 at slvl 20)
 * - Consumes valid monster corpses (`STATE_REDEEMED` #99), caster-only restore
 */
export function calculateRedemptionStats(slvl: number): RedemptionStats {
  const lvl = Math.max(1, slvl)
  const redemptionChancePct = computeDiminishingReturns(10, 100, lvl)
  const lifeRecoverPts = 25 + (lvl - 1) * 5
  const manaRecoverPts = lifeRecoverPts
  const radiusSubtiles = 16
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    redemptionChancePct,
    lifeRecoverPts,
    manaRecoverPts,
    radiusSubtiles,
    radiusYards,
  }
}

/**
 * 10. Salvation (Skill 125)
 * - Active party All Resistances (Fire, Cold, Lightning): `dm34 = computeDiminishingReturns(50, 120, slvl)`
 *   (61% at slvl 1, 98% at slvl 10, 109% at slvl 20)
 * - Strictly zero effect on Poison or Magic resistance!
 * - Synergizes Holy Fire (+6%), Holy Freeze (+7%), Holy Shock (+4%)
 * - Radius: ln12 subtiles (16 + (slvl - 1) * 2)
 */
export function calculateSalvationStats(slvl: number): SalvationStats {
  const lvl = Math.max(1, slvl)
  const resPct = computeDiminishingReturns(50, 120, lvl)
  const radiusSubtiles = 16 + (lvl - 1) * 2
  const radiusYards = Number(((radiusSubtiles * 2) / 3).toFixed(2))
  return {
    fireResistPct: resPct,
    coldResistPct: resPct,
    lightningResistPct: resPct,
    radiusSubtiles,
    radiusYards,
  }
}
