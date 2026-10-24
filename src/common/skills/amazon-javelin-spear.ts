/**
 * Diablo II: Lord of Destruction v1.13c — Amazon Javelin and Spear Skills Tree Module
 *
 * Dedicated pure calculation and kinematics formulas for the 10 javelin/spear skills:
 * - Skill 010: Jab
 * - Skill 014: Power Strike
 * - Skill 015: Poison Javelin
 * - Skill 019: Impale
 * - Skill 020: Lightning Bolt
 * - Skill 024: Charged Strike
 * - Skill 025: Plague Javelin
 * - Skill 030: Fend
 * - Skill 034: Lightning Strike
 * - Skill 035: Lightning Fury
 *
 * 1.13c Ground Truth:
 * - D2Common.dll / D2Game.dll / Patch_D2.mpq: Skills.txt & Missiles.txt
 * - Fixed-point 24.8 mana calculations
 * - 5-band level scaling: compute5BandScaling(slvl, base, lev1..lev5)
 * - Jab: 3 rapid consecutive thrusts, negative-to-positive %ED scaling (-15% + 3%/lvl), AR +10% + 9%/lvl, mana 2.0 + 0.25/lvl
 * - Power Strike: 5-band lightning damage (1..16 + 18/36/54/72/90/lvl), AR +20% + 12%/lvl, CS/LS/LF/LB synergies (+10%/lvl), mana 2.0 + 0.25/lvl
 * - Poison Javelin: duration 200 + 50 * (slvl - 1) frames (8.0s + 2.0s/lvl), 5-band poison damage, Plague Javelin synergy (+12%/lvl), 15-frame casting delay, mana 4.0 + 0.25/lvl
 * - Impale: slow crushing blow, massive %ED (+300% + 25%/lvl), AR +100% + 25%/lvl, durability loss chance 50% - dm(0, 30, slvl)%, interruptible (interrupt = 1), fixed 3 mana
 * - Lightning Bolt: 75% weapon physical damage (SrcDam = 96/128) converted 100% to lightning (SrvDmg12), 5-band lightning 1 - (40 + 12/18/28/48/88), auto-hit (ToHit = 0), 4 synergies (+3%/lvl), mana 6.0 + 0.25/lvl
 * - Charged Strike: floor(slvl / 5) + 3 bolts (3..7+), 5-band lightning damage per bolt, point-blank boss shotgunning, 4 synergies (+10%/lvl), mana 4.0 + 0.25/lvl
 * - Plague Javelin: duration 75 + 10 * (slvl - 1) frames (3.0s + 0.4s/lvl), 5-band poison damage (HitShift = 3), Poison Javelin synergy (+10%/lvl), 100-frame (4.0s) casting delay, mana 7.0 + 0.5/lvl
 * - Fend: multi-target strike against up to 12 adjacent enemies, %ED +70% + 10%/lvl, AR +40% + 10%/lvl, 1.13c Fend Bug (interrupted by Dodge/Avoid/Evade), fixed 5 mana
 * - Lightning Strike: chain hops 2 + (slvl - 1) (slvl + 1), 20-subtile search radius, 5-band lightning damage, 4-frame NextHitDelay, 4 synergies (+8%/lvl), fixed 9 mana
 * - Lightning Fury: 1 + slvl release bolts (2 + (slvl - 1)), 15-subtile (150px) search radius, 5-band bolt damage, triggers furylightning bursts on EACH hit and pierce, 4 synergies (+1%/lvl), mana 10 + 0.5/lvl
 */

import { compute5BandScaling, computeDiminishingReturns } from '../data/calc-ast.ts'

// --- Interfaces for Skill Calculations ---

export interface JabStats {
  readonly strikesCount: number
  readonly damagePct: number
  readonly enhancedDamagePct: number
  readonly attackRatingBonusPct: number
  readonly toHitBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface PowerStrikeStats {
  readonly minDamage: number
  readonly maxDamage: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly attackRatingBonusPct: number
  readonly toHitBonusPct: number
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface PoisonJavelinStats {
  readonly minDamage: number
  readonly maxDamage: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly tableDurationFrames: number
  readonly hitShift: number
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly castingDelayFrames: number
  readonly cooldownFrames: number
  readonly tableCooldownFrames: number
  readonly trailCloudMissile: string
  readonly manaCost: number
  readonly manaCost256: number
}

export interface ImpaleStats {
  readonly enhancedDamagePct: number
  readonly attackRatingBonusPct: number
  readonly toHitBonusPct: number
  readonly durabilityLossChancePct: number
  readonly uninterruptible: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

export interface LightningBoltStats {
  readonly conversionPct: number
  readonly physToElemPct: number
  readonly srcDam: number
  readonly flatBonusLightningMin: number
  readonly flatBonusLightningMax: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly tableMinDamage: number
  readonly tableMaxDamage: number
  readonly autoHit: boolean
  readonly bypassesDefense: boolean
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface ChargedStrikeStats {
  readonly boltsCount: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly shotgunning: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

export interface PlagueJavelinStats {
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly tableDurationFrames: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly attackRatingBonusPct: number
  readonly toHitBonusPct: number
  readonly hitShift: number
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly castingDelayFrames: number
  readonly cooldownFrames: number
  readonly impactCloudMissile: string
  readonly trailCloudMissile: string
  readonly manaCost: number
  readonly manaCost256: number
  readonly tableManaCost: number
  readonly tableManaCost256: number
}

export interface FendStats {
  readonly enhancedDamagePct: number
  readonly attackRatingBonusPct: number
  readonly toHitBonusPct: number
  readonly maxAdjacentTargets: number
  readonly strikesCount: number
  readonly evasionInterruptible: boolean
  readonly fendBugActive: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

export interface LightningStrikeStats {
  readonly chainHops: number
  readonly maxChainJumps: number
  readonly searchRadiusPx: number
  readonly searchRadiusSubtiles: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly nextHitDelayFrames: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface LightningFuryStats {
  readonly releaseBoltsCount: number
  readonly boltsCount: number
  readonly searchRadiusPx: number
  readonly searchRadiusSubtiles: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly piercingBursts: boolean
  readonly subMissileName: string
  readonly manaCost: number
  readonly manaCost256: number
}

// --- Synergy Input Types ---

export interface PowerStrikeSynergies {
  readonly chargedStrike?: number | undefined
  readonly lightningStrike?: number | undefined
  readonly lightningFury?: number | undefined
  readonly lightningBolt?: number | undefined
}

export interface PoisonJavelinSynergies {
  readonly plagueJavelin?: number | undefined
}

export interface LightningBoltSynergies {
  readonly powerStrike?: number | undefined
  readonly chargedStrike?: number | undefined
  readonly lightningStrike?: number | undefined
  readonly lightningFury?: number | undefined
}

export interface ChargedStrikeSynergies {
  readonly powerStrike?: number | undefined
  readonly lightningBolt?: number | undefined
  readonly lightningStrike?: number | undefined
  readonly lightningFury?: number | undefined
}

export interface PlagueJavelinSynergies {
  readonly poisonJavelin?: number | undefined
}

export interface LightningStrikeSynergies {
  readonly powerStrike?: number | undefined
  readonly lightningBolt?: number | undefined
  readonly chargedStrike?: number | undefined
  readonly lightningFury?: number | undefined
}

export interface LightningFurySynergies {
  readonly powerStrike?: number | undefined
  readonly lightningBolt?: number | undefined
  readonly chargedStrike?: number | undefined
  readonly lightningStrike?: number | undefined
}

// --- Helper Functions ---

function sanitizeLevel(slvl: number): number {
  if (!Number.isFinite(slvl) || slvl <= 0) return 1
  return Math.floor(slvl)
}

function sanitizePoints(val?: number): number {
  if (val === undefined || !Number.isFinite(val) || val <= 0) return 0
  return Math.floor(val)
}

// --- Pure Calculation Functions ---

/**
 * Skill 010: Jab
 *
 * 3 rapid consecutive thrusts with a javelin or spear.
 * Starts with a damage penalty at low levels that transitions to an enhanced damage bonus:
 * - %ED: -15% + 3% * (slvl - 1)
 * - AR Bonus: +10% + 9% * (slvl - 1)
 * - Mana: 2.0 + 0.25 * (slvl - 1) (mana = 8, lvlmana = 1, shift = 6)
 */
export function calculateJabStats(slvl: number): JabStats {
  const lvl = sanitizeLevel(slvl)
  const ed = -15 + 3 * (lvl - 1)
  const ar = 10 + 9 * (lvl - 1)
  const manaCost = 2.0 + 0.25 * (lvl - 1)
  const manaCost256 = (8 + (lvl - 1)) * 64

  return {
    strikesCount: 3,
    damagePct: ed,
    enhancedDamagePct: ed,
    attackRatingBonusPct: ar,
    toHitBonusPct: ar,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 014: Power Strike
 *
 * Adds direct lightning elemental damage to spear and javelin melee attacks:
 * - 5-band lightning damage: 1 - 16 base, scaling +18/36/54/72/90 per band
 * - AR Bonus: +20% + 12% * (slvl - 1) (ToHit = 20, LevToHit = 12)
 * - Synergies: Charged Strike, Lightning Strike, Lightning Fury, Lightning Bolt (+10%/lvl)
 * - Mana: 2.0 + 0.25 * (slvl - 1)
 */
export function calculatePowerStrikeStats(
  slvl: number,
  synergies?: PowerStrikeSynergies | number
): PowerStrikeStats {
  const lvl = sanitizeLevel(slvl)
  const baseMin = 1
  const baseMax = compute5BandScaling(lvl, 16, 18, 36, 54, 72, 90)

  let synergyBonusPct = 0
  let synergyMultiplier = 1.0
  if (typeof synergies === 'number') {
    synergyMultiplier = Math.max(1.0, synergies)
    synergyBonusPct = Math.round((synergyMultiplier - 1.0) * 100)
  } else if (synergies) {
    const cs = sanitizePoints(synergies.chargedStrike)
    const ls = sanitizePoints(synergies.lightningStrike)
    const lf = sanitizePoints(synergies.lightningFury)
    const lb = sanitizePoints(synergies.lightningBolt)
    synergyBonusPct = 10 * (cs + ls + lf + lb)
    synergyMultiplier = 1.0 + synergyBonusPct / 100
  }

  const minDamage = Math.floor(baseMin * synergyMultiplier)
  const maxDamage = Math.floor(baseMax * synergyMultiplier)
  const ar = 20 + 12 * (lvl - 1)
  const manaCost = 2.0 + 0.25 * (lvl - 1)
  const manaCost256 = (8 + (lvl - 1)) * 64

  return {
    minDamage,
    maxDamage,
    baseMinDamage: baseMin,
    baseMaxDamage: baseMax,
    attackRatingBonusPct: ar,
    toHitBonusPct: ar,
    synergyMultiplier,
    synergyBonusPct,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 015: Poison Javelin
 *
 * Throws a javelin that leaves a trail of toxic clouds in flight:
 * - Duration: 200 + 50 * (slvl - 1) frames (8.0s + 2.0s/lvl, ELen = 200, ELevLen1..3 = 50)
 * - 5-band poison damage: 32..48 base, scaling +16/32/48/64/96 min, +16/36/52/68/84 max
 * - Synergy: Plague Javelin (+12%/lvl)
 * - Casting Delay: 15 frames (0.6s, delay = 15)
 * - Mana: 4.0 + 0.25 * (slvl - 1) (mana = 16, lvlmana = 1, shift = 6)
 */
export function calculatePoisonJavelinStats(
  slvl: number,
  synergies?: PoisonJavelinSynergies | number
): PoisonJavelinStats {
  const lvl = sanitizeLevel(slvl)
  const baseMin = compute5BandScaling(lvl, 32, 16, 32, 48, 64, 96)
  const baseMax = compute5BandScaling(lvl, 48, 16, 36, 52, 68, 84)

  let synergyBonusPct = 0
  let synergyMultiplier = 1.0
  if (typeof synergies === 'number') {
    synergyMultiplier = Math.max(1.0, synergies)
    synergyBonusPct = Math.round((synergyMultiplier - 1.0) * 100)
  } else if (synergies) {
    const pj = sanitizePoints(synergies.plagueJavelin)
    synergyBonusPct = 12 * pj
    synergyMultiplier = 1.0 + synergyBonusPct / 100
  }

  const minDamage = Math.floor(baseMin * synergyMultiplier)
  const maxDamage = Math.floor(baseMax * synergyMultiplier)
  const durationFrames = 200 + 50 * (lvl - 1)
  const tableDurationFrames = durationFrames
  const durationSeconds = durationFrames / 25
  const manaCost = 4.0 + 0.25 * (lvl - 1)
  const manaCost256 = (16 + (lvl - 1)) * 64

  return {
    minDamage,
    maxDamage,
    baseMinDamage: baseMin,
    baseMaxDamage: baseMax,
    durationFrames,
    durationSeconds,
    tableDurationFrames,
    hitShift: 5,
    synergyMultiplier,
    synergyBonusPct,
    castingDelayFrames: 15,
    cooldownFrames: 15,
    tableCooldownFrames: 15,
    trailCloudMissile: 'poisonjavcloud',
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 019: Impale
 *
 * Slow, crushing melee thrust dealing massive physical damage with a weapon durability penalty:
 * - %ED: +300% + 25% * (slvl - 1) (calc1 = ln12)
 * - AR Bonus: +100% + 25% * (slvl - 1) (ToHit = 100, LevToHit = 25)
 * - Durability Loss Chance: 50% - dm(0, 30, slvl)% (calc2 = par6 - dm34)
 * - Mana: Fixed 3.0 (mana = 3, lvlmana = 0, shift = 8)
 * - Interruptible execution posture (interrupt = 1 in Skills.txt)
 */
export function calculateImpaleStats(slvl: number): ImpaleStats {
  const lvl = sanitizeLevel(slvl)
  const ed = 300 + 25 * (lvl - 1)
  const ar = 100 + 25 * (lvl - 1)
  const durabilityLossChancePct = 50 - computeDiminishingReturns(0, 30, lvl)

  return {
    enhancedDamagePct: ed,
    attackRatingBonusPct: ar,
    toHitBonusPct: ar,
    durabilityLossChancePct,
    uninterruptible: false,
    manaCost: 3.0,
    manaCost256: 768,
  }
}

/**
 * Skill 020: Lightning Bolt
 *
 * Converts 100% of 75% physical thrown javelin damage to lightning and adds bonus damage:
 * - SrcDam = 96 (75% weapon physical damage) converted 100% to lightning by MISSMODE_SrvDmg12 (0x6FC5A850)
 * - 5-band table lightning damage: 1 - 40 base, scaling +12/18/28/48/88
 * - Auto-hits defense (ToHit = 0 on lightningjavelin #205)
 * - 4 Synergies: Power Strike, Charged Strike, Lightning Strike, Lightning Fury (+3%/lvl)
 * - Mana: 6.0 + 0.25 * (slvl - 1) (mana = 24, lvlmana = 1, shift = 6)
 */
export function calculateLightningBoltStats(
  slvl: number,
  synergies?: LightningBoltSynergies | number
): LightningBoltStats {
  const lvl = sanitizeLevel(slvl)
  const tableMin = 1
  const tableMax = compute5BandScaling(lvl, 40, 12, 18, 28, 48, 88)
  const flatMin = tableMin
  const flatMax = tableMax

  let synergyBonusPct = 0
  let synergyMultiplier = 1.0
  if (typeof synergies === 'number') {
    synergyMultiplier = Math.max(1.0, synergies)
    synergyBonusPct = Math.round((synergyMultiplier - 1.0) * 100)
  } else if (synergies) {
    const ps = sanitizePoints(synergies.powerStrike)
    const cs = sanitizePoints(synergies.chargedStrike)
    const ls = sanitizePoints(synergies.lightningStrike)
    const lf = sanitizePoints(synergies.lightningFury)
    synergyBonusPct = 3 * (ps + cs + ls + lf)
    synergyMultiplier = 1.0 + synergyBonusPct / 100
  }

  const minDamage = Math.floor(tableMin * synergyMultiplier)
  const maxDamage = Math.floor(tableMax * synergyMultiplier)
  const manaCost256 = (24 + (lvl - 1)) * 64
  const manaCost = manaCost256 / 256

  return {
    conversionPct: 100,
    physToElemPct: 100,
    srcDam: 96,
    flatBonusLightningMin: flatMin,
    flatBonusLightningMax: flatMax,
    minDamage,
    maxDamage,
    tableMinDamage: tableMin,
    tableMaxDamage: tableMax,
    autoHit: true,
    bypassesDefense: true,
    synergyMultiplier,
    synergyBonusPct,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 024: Charged Strike
 *
 * Melee attack that emits charged lightning bolts outward from the target:
 * - Bolts Count: floor(slvl / 5) + 3 (3 at lvl 1..4, 4 at lvl 5..9, etc.)
 * - 5-band lightning damage per bolt: 1 - 30 base, scaling +12/16/20/24/28
 * - 4 Synergies: Power Strike, Lightning Bolt, Lightning Strike, Lightning Fury (+10%/lvl, Param8 = 10)
 * - Point-blank boss shotgunning capability against large hitboxes
 * - Mana: 4.0 + 0.25 * (slvl - 1) (mana = 16, lvlmana = 1, shift = 6)
 */
export function calculateChargedStrikeStats(
  slvl: number,
  synergies?: ChargedStrikeSynergies | number
): ChargedStrikeStats {
  const lvl = sanitizeLevel(slvl)
  const boltsCount = Math.floor(lvl / 5) + 3
  const baseMin = 1
  const baseMax = compute5BandScaling(lvl, 30, 12, 16, 20, 24, 28)

  let synergyBonusPct = 0
  let synergyMultiplier = 1.0
  if (typeof synergies === 'number') {
    synergyMultiplier = Math.max(1.0, synergies)
    synergyBonusPct = Math.round((synergyMultiplier - 1.0) * 100)
  } else if (synergies) {
    const ps = sanitizePoints(synergies.powerStrike)
    const lb = sanitizePoints(synergies.lightningBolt)
    const ls = sanitizePoints(synergies.lightningStrike)
    const lf = sanitizePoints(synergies.lightningFury)
    synergyBonusPct = 10 * (ps + lb + ls + lf)
    synergyMultiplier = 1.0 + synergyBonusPct / 100
  }

  const minDamage = Math.floor(baseMin * synergyMultiplier)
  const maxDamage = Math.floor(baseMax * synergyMultiplier)
  const manaCost = 4.0 + 0.25 * (lvl - 1)
  const manaCost256 = (16 + (lvl - 1)) * 64

  return {
    boltsCount,
    minDamage,
    maxDamage,
    baseMinDamage: baseMin,
    baseMaxDamage: baseMax,
    synergyMultiplier,
    synergyBonusPct,
    shotgunning: true,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 025: Plague Javelin
 *
 * Throws a javelin creating an expanding toxic cloud on impact and trailing clouds in flight:
 * - Duration: 75 + 10 * (slvl - 1) frames (3.0s + 0.4s/lvl, ELen = 75, ELevLen1..3 = 10)
 * - 5-band poison damage (HitShift = 3): 10..16 base, scaling +6/12/20/40/60
 * - AR Bonus: +30% + 9% * (slvl - 1) (ToHit = 30, LevToHit = 9)
 * - Synergy: Poison Javelin (+10%/lvl)
 * - Casting Delay: 100 frames (4.0s)
 * - Mana: 7.0 + 0.5 * (slvl - 1) (mana = 14, lvlmana = 1, shift = 7)
 */
export function calculatePlagueJavelinStats(
  slvl: number,
  synergies?: PlagueJavelinSynergies | number
): PlagueJavelinStats {
  const lvl = sanitizeLevel(slvl)
  const baseMin = compute5BandScaling(lvl, 10, 6, 12, 20, 40, 60)
  const baseMax = compute5BandScaling(lvl, 16, 6, 12, 20, 40, 60)

  let synergyBonusPct = 0
  let synergyMultiplier = 1.0
  if (typeof synergies === 'number') {
    synergyMultiplier = Math.max(1.0, synergies)
    synergyBonusPct = Math.round((synergyMultiplier - 1.0) * 100)
  } else if (synergies) {
    const pj = sanitizePoints(synergies.poisonJavelin)
    synergyBonusPct = 10 * pj
    synergyMultiplier = 1.0 + synergyBonusPct / 100
  }

  const minDamage = Math.floor(baseMin * synergyMultiplier)
  const maxDamage = Math.floor(baseMax * synergyMultiplier)
  const durationFrames = 75 + 10 * (lvl - 1)
  const durationSeconds = durationFrames / 25
  const tableDurationFrames = durationFrames
  const ar = 30 + 9 * (lvl - 1)
  const manaCost256 = (14 + (lvl - 1)) * 128
  const manaCost = manaCost256 / 256
  const tableManaCost = manaCost
  const tableManaCost256 = manaCost256

  return {
    durationFrames,
    durationSeconds,
    tableDurationFrames,
    minDamage,
    maxDamage,
    baseMinDamage: baseMin,
    baseMaxDamage: baseMax,
    attackRatingBonusPct: ar,
    toHitBonusPct: ar,
    hitShift: 3,
    synergyMultiplier,
    synergyBonusPct,
    castingDelayFrames: 100,
    cooldownFrames: 100,
    impactCloudMissile: 'plaguejavcloud',
    trailCloudMissile: 'plaguejavcloud',
    manaCost,
    manaCost256,
    tableManaCost,
    tableManaCost256,
  }
}

/**
 * Skill 030: Fend
 *
 * Attacks all adjacent enemies in rapid succession with a spear or javelin:
 * - %ED: +70% + 10% * (slvl - 1) (calc2 = ln34)
 * - AR Bonus: +40% + 10% * (slvl - 1) (ToHit = 40, LevToHit = 10)
 * - Max Adjacent Targets: 12 (calc1 = 12 in Skills.txt & SKILLS_SrvSt09_Fend)
 * - 1.13c "Fend Bug": Triggering Dodge, Avoid, or Evade interrupts and aborts remaining strikes
 * - Mana: Fixed 5.0 (mana = 5, lvlmana = 0, shift = 8)
 */
export function calculateFendStats(slvl: number, targetCount?: number): FendStats {
  const lvl = sanitizeLevel(slvl)
  const ed = 70 + 10 * (lvl - 1)
  const ar = 40 + 10 * (lvl - 1)
  const maxAdjacentTargets = 12
  const validTargets = targetCount !== undefined && Number.isFinite(targetCount)
    ? Math.max(1, Math.min(maxAdjacentTargets, Math.floor(targetCount)))
    : maxAdjacentTargets

  return {
    enhancedDamagePct: ed,
    attackRatingBonusPct: ar,
    toHitBonusPct: ar,
    maxAdjacentTargets,
    strikesCount: validTargets,
    evasionInterruptible: true,
    fendBugActive: true,
    manaCost: 5.0,
    manaCost256: 1280,
  }
}

/**
 * Skill 034: Lightning Strike
 *
 * Melee attack that causes chain lightning to leap between nearby enemies:
 * - Chain Hops: 2 + (slvl - 1) = slvl + 1 (calc2 = ln34, Param3 = 2, Param4 = 1)
 * - Search Radius: 20 sub-tiles (200px, calc1 = par1 = 20)
 * - 5-band lightning damage: 1 - 25 base, scaling +10/15/20/25/30
 * - NextHitDelay: 4 frames
 * - 4 Synergies: Power Strike, Lightning Bolt, Charged Strike, Lightning Fury (+8%/lvl)
 * - Mana: Fixed 9.0 (mana = 9, lvlmana = 0, shift = 8)
 */
export function calculateLightningStrikeStats(
  slvl: number,
  synergies?: LightningStrikeSynergies | number
): LightningStrikeStats {
  const lvl = sanitizeLevel(slvl)
  const chainHops = 2 + (lvl - 1)
  const baseMin = 1
  const baseMax = compute5BandScaling(lvl, 25, 10, 15, 20, 25, 30)

  let synergyBonusPct = 0
  let synergyMultiplier = 1.0
  if (typeof synergies === 'number') {
    synergyMultiplier = Math.max(1.0, synergies)
    synergyBonusPct = Math.round((synergyMultiplier - 1.0) * 100)
  } else if (synergies) {
    const ps = sanitizePoints(synergies.powerStrike)
    const lb = sanitizePoints(synergies.lightningBolt)
    const cs = sanitizePoints(synergies.chargedStrike)
    const lf = sanitizePoints(synergies.lightningFury)
    synergyBonusPct = 8 * (ps + lb + cs + lf)
    synergyMultiplier = 1.0 + synergyBonusPct / 100
  }

  const minDamage = Math.floor(baseMin * synergyMultiplier)
  const maxDamage = Math.floor(baseMax * synergyMultiplier)

  return {
    chainHops,
    maxChainJumps: chainHops,
    searchRadiusPx: 200,
    searchRadiusSubtiles: 20,
    minDamage,
    maxDamage,
    baseMinDamage: baseMin,
    baseMaxDamage: baseMax,
    synergyMultiplier,
    synergyBonusPct,
    nextHitDelayFrames: 4,
    manaCost: 9.0,
    manaCost256: 2304,
  }
}

/**
 * Skill 035: Lightning Fury
 *
 * Throws a javelin that splits into multiple charged lightning bolts upon contact:
 * - Release Bolts Count: 2 + (slvl - 1) = 1 + slvl (calc1 = ln12, Param1 = 2, Param2 = 1)
 * - Search Radius: 15 sub-tiles (150 sub-pixels / 10.0 yards, aurarangecalc = par3 = 15)
 * - 5-band lightning damage per bolt: 1 - 40 base, scaling +20/30/40/50/50
 * - Piercing Javelin: triggers a separate burst of (1 + slvl) furylightning bolts on EVERY pierced target and collision
 * - 4 Synergies: Power Strike, Lightning Bolt, Charged Strike, Lightning Strike (+1%/lvl)
 * - Mana: 10.0 + 0.5 * (slvl - 1) (mana = 20, lvlmana = 1, shift = 7)
 */
export function calculateLightningFuryStats(
  slvl: number,
  synergies?: LightningFurySynergies | number
): LightningFuryStats {
  const lvl = sanitizeLevel(slvl)
  const releaseBoltsCount = 2 + (lvl - 1)
  const baseMin = 1
  const baseMax = compute5BandScaling(lvl, 40, 20, 30, 40, 50, 50)

  let synergyBonusPct = 0
  let synergyMultiplier = 1.0
  if (typeof synergies === 'number') {
    synergyMultiplier = Math.max(1.0, synergies)
    synergyBonusPct = Math.round((synergyMultiplier - 1.0) * 100)
  } else if (synergies) {
    const ps = sanitizePoints(synergies.powerStrike)
    const lb = sanitizePoints(synergies.lightningBolt)
    const cs = sanitizePoints(synergies.chargedStrike)
    const ls = sanitizePoints(synergies.lightningStrike)
    synergyBonusPct = 1 * (ps + lb + cs + ls)
    synergyMultiplier = 1.0 + synergyBonusPct / 100
  }

  const minDamage = Math.floor(baseMin * synergyMultiplier)
  const maxDamage = Math.floor(baseMax * synergyMultiplier)
  const manaCost = 10.0 + 0.5 * (lvl - 1)
  const manaCost256 = (20 + (lvl - 1)) * 128

  return {
    releaseBoltsCount,
    boltsCount: releaseBoltsCount,
    searchRadiusPx: 150,
    searchRadiusSubtiles: 15,
    minDamage,
    maxDamage,
    baseMinDamage: baseMin,
    baseMaxDamage: baseMax,
    synergyMultiplier,
    synergyBonusPct,
    piercingBursts: true,
    subMissileName: 'furylightning',
    manaCost,
    manaCost256,
  }
}
