/**
 * Diablo II: Lord of Destruction v1.13c — Amazon Bow & Crossbow Skills Tree Module
 *
 * Dedicated pure calculation and kinematics formulas for the 10 bow/crossbow skills:
 * - Skill 006: Magic Arrow
 * - Skill 007: Fire Arrow
 * - Skill 011: Cold Arrow
 * - Skill 012: Multiple Shot
 * - Skill 016: Exploding Arrow
 * - Skill 021: Ice Arrow
 * - Skill 022: Guided Arrow
 * - Skill 026: Strafe
 * - Skill 027: Immolation Arrow
 * - Skill 031: Freezing Arrow
 *
 * 1.13c Ground Truth:
 * - D2Common.dll / D2Game.dll / Patch_D2.mpq: Skills.txt & Missiles.txt
 * - Fixed-point 24.8 mana calculations
 * - 5-band scaling across levels 1, 2..8, 9..16, 17..22, 23..28, 29+
 * - Guided Arrow strict zero-pierce invariant (`canPierce = false`, `pierceChancePct = 0`)
 * - Multiple Shot fan distribution, center-2 proc limitation, and single-target hit immunity
 * - Immolation Arrow 25-frame casting cooldown and 75-frame ground fire patch
 * - Freezing Arrow 80 sub-pixel cold splash and 50-frame freeze duration
 */

import { compute5BandScaling } from '../data/calc-ast.ts'

// --- Interfaces for Skill Calculations ---

export interface MagicArrowStats {
  readonly conversionPct: number
  readonly flatPhysDamage: number
  readonly flatMagicDamage: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly toHitBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly noAmmo: boolean
  readonly requiresAmmo: boolean
}

export interface FireArrowStats {
  readonly minDamage: number
  readonly maxDamage: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly physToElemPct: number
  readonly srcDam: number
  readonly toHitBonusPct: number
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface ColdArrowStats {
  readonly minDamage: number
  readonly maxDamage: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly durationFrames: number
  readonly baseDurationFrames: number
  readonly physToElemPct: number
  readonly srcDam: number
  readonly toHitBonusPct: number
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly lenSynergyMultiplier: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface MultipleShotStats {
  readonly arrowCount: number
  readonly damageMultiplier: number
  readonly srcDam: number
  readonly centerProcArrows: number
  readonly onlyCenterArrowsProc: boolean
  readonly singleTargetImmunity: boolean
  readonly toHitBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface ExplodingArrowStats {
  readonly minBlastDamage: number
  readonly maxBlastDamage: number
  readonly baseMinBlastDamage: number
  readonly baseMaxBlastDamage: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly radiusPx: number
  readonly radiusSubtiles: number
  readonly toHitBonusPct: number
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface IceArrowStats {
  readonly minDamage: number
  readonly maxDamage: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly freezeFrames: number
  readonly baseFreezeFrames: number
  readonly toHitBonusPct: number
  readonly dmgSynergyMultiplier: number
  readonly lenSynergyMultiplier: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface GuidedArrowStats {
  readonly enhancedDamagePct: number
  readonly alwaysHits: boolean
  readonly autoHit: boolean
  readonly canPierce: boolean
  readonly pierceChancePct: number
  readonly toHitBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface StrafeStats {
  readonly arrowCount: number
  readonly minArrows: number
  readonly damageMultiplier: number
  readonly srcDam: number
  readonly enhancedDamagePct: number
  readonly stationaryLockIn: boolean
  readonly lockInFrames: number
  readonly toHitBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface ImmolationArrowStats {
  readonly minExplosionDamage: number
  readonly maxExplosionDamage: number
  readonly baseMinExplosionDamage: number
  readonly baseMaxExplosionDamage: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly firePatchDurationFrames: number
  readonly firePatchMinDamagePerSec: number
  readonly firePatchMaxDamagePerSec: number
  readonly cooldownFrames: number
  readonly toHitBonusPct: number
  readonly explosionSynergyMultiplier: number
  readonly firePatchSynergyMultiplier: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface FreezingArrowStats {
  readonly minColdDamage: number
  readonly maxColdDamage: number
  readonly baseMinColdDamage: number
  readonly baseMaxColdDamage: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly freezeFrames: number
  readonly baseFreezeFrames: number
  readonly radiusPx: number
  readonly radiusSubtiles: number
  readonly toHitBonusPct: number
  readonly coldSynergyMultiplier: number
  readonly lenSynergyMultiplier: number
  readonly manaCost: number
  readonly manaCost256: number
}

// --- Pure Calculation Functions ---

/**
 * Skill 006: Magic Arrow
 * Physical-to-magic conversion `min(100, 1 + (slvl-1)*1)% = min(100, slvl)%` (Missiles.txt `magicarrow` dParam1=1, dParam2=1),
 * flat physical damage `+slvl` (Skills.txt MinDam=1, MaxDam=1, MinLevDam1..5=1, MaxLevDam1..5=1),
 * AR bonus `+10 + 9*(slvl-1)%`,
 * mana `max(0, 1.5 - 0.125*(slvl-1))` in 24.8 fixed point (reaches 0 at lvl 13),
 * zero ammo consumption invariant (`noammo: 1`).
 */
export function calculateMagicArrowStats(slvl: number): MagicArrowStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const conversionPct = Math.min(100, Math.max(0, lvl))
  const flatPhysDamage = compute5BandScaling(lvl, 1, 1, 1, 1, 1, 1)
  const toHitBonusPct = 10 + 9 * (lvl - 1)
  const manaCost = Math.max(0, 1.5 - 0.125 * (lvl - 1))
  const manaCost256 = Math.max(0, 384 - 32 * (lvl - 1))

  return {
    conversionPct,
    flatPhysDamage,
    flatMagicDamage: flatPhysDamage,
    minDamage: flatPhysDamage,
    maxDamage: flatPhysDamage,
    toHitBonusPct,
    manaCost,
    manaCost256,
    noAmmo: true,
    requiresAmmo: false,
  }
}

/**
 * Skill 007: Fire Arrow
 * 100% weapon damage (`srcdam = 128`),
 * physical-to-fire conversion `min(100, 3 + 2*(slvl-1))%` (Missiles.txt `firearrow` dParam1=3, dParam2=2),
 * 5-band fire damage:
 *   Min: (1, 2, 3, 6, 12, 24)
 *   Max: (4, 2, 3, 7, 14, 27)
 * Exploding Arrow synergy (+12%/blvl),
 * AR bonus `+10 + 9*(slvl-1)%`,
 * mana `3.0 + 0.125*(slvl-1)` (`Mana=24, lvlmana=1, manashift=5`).
 */
export function calculateFireArrowStats(
  slvl: number,
  synergies?: number | { readonly explodingArrow?: number; readonly [key: string]: any }
): FireArrowStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const baseMin = compute5BandScaling(lvl, 1, 2, 3, 6, 12, 24)
  const baseMax = compute5BandScaling(lvl, 4, 2, 3, 7, 14, 27)
  let synergyMultiplier = 1.0
  let synergyBonusPct = 0
  if (typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0) {
    synergyMultiplier = synergies
    synergyBonusPct = Math.round((synergyMultiplier - 1.0) * 100)
  } else if (synergies && typeof synergies === 'object') {
    const synBlvl = Math.max(0, Math.floor(synergies?.explodingArrow ?? (synergies as any)?.['Exploding Arrow'] ?? 0))
    synergyBonusPct = synBlvl * 12
    synergyMultiplier = 1 + synergyBonusPct / 100
  }
  const minDamage = Math.floor(baseMin * synergyMultiplier)
  const maxDamage = Math.floor(baseMax * synergyMultiplier)
  const physToElemPct = Math.min(100, 3 + 2 * (lvl - 1))
  const toHitBonusPct = 10 + 9 * (lvl - 1)
  const manaCost = 3.0 + 0.125 * (lvl - 1)
  const manaCost256 = (24 + (lvl - 1)) * 32

  return {
    minDamage,
    maxDamage,
    baseMinDamage: baseMin,
    baseMaxDamage: baseMax,
    physToElemPct,
    srcDam: 128,
    toHitBonusPct,
    synergyMultiplier,
    synergyBonusPct,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 011: Cold Arrow
 * 100% weapon damage (`srcdam = 128`),
 * physical-to-cold conversion `min(100, 3 + 2*(slvl-1))%` (Missiles.txt `coldarrow` dParam1=3, dParam2=2),
 * 5-band cold damage (Skills.txt: eMin=6, eMax=8 with hitShift=7 factor 0.5):
 *   Min: (6, 4, 5, 8, 16, 42) * 0.5
 *   Max: (8, 4, 5, 9, 17, 44) * 0.5
 * Chill duration `100 + 30*(slvl-1)` frames (ELen=100, ELevLen1..3=30),
 * Ice Arrow synergies (+12% damage/blvl, +5% chill duration/blvl),
 * AR bonus `+10 + 9*(slvl-1)%`,
 * mana `3.5 + 0.125*(slvl-1)` (`Mana=28, lvlmana=1, manashift=5`).
 */
export function calculateColdArrowStats(
  slvl: number,
  synergies?: number | { readonly iceArrow?: number; readonly [key: string]: any }
): ColdArrowStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const baseMin = compute5BandScaling(lvl, 6, 4, 5, 8, 16, 42) * 0.5
  const baseMax = compute5BandScaling(lvl, 8, 4, 5, 9, 17, 44) * 0.5
  let synergyMultiplier = 1.0
  let synergyBonusPct = 0
  let lenSynergyMultiplier = 1.0
  if (typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0) {
    synergyMultiplier = synergies
    synergyBonusPct = Math.round((synergyMultiplier - 1.0) * 100)
  } else if (synergies && typeof synergies === 'object') {
    const synBlvl = Math.max(0, Math.floor(synergies?.iceArrow ?? (synergies as any)?.['Ice Arrow'] ?? 0))
    synergyBonusPct = synBlvl * 12
    synergyMultiplier = 1 + synergyBonusPct / 100
    lenSynergyMultiplier = 1 + (synBlvl * 5) / 100
  }
  const minDamage = Math.floor(baseMin * synergyMultiplier)
  const maxDamage = Math.floor(baseMax * synergyMultiplier)
  const baseDurationFrames = 100 + 30 * (lvl - 1)
  const durationFrames = Math.floor(baseDurationFrames * lenSynergyMultiplier)
  const physToElemPct = Math.min(100, 3 + 2 * (lvl - 1))
  const toHitBonusPct = 10 + 9 * (lvl - 1)
  const manaCost = 3.5 + 0.125 * (lvl - 1)
  const manaCost256 = (28 + (lvl - 1)) * 32

  return {
    minDamage,
    maxDamage,
    baseMinDamage: baseMin,
    baseMaxDamage: baseMax,
    durationFrames,
    baseDurationFrames,
    physToElemPct,
    srcDam: 128,
    toHitBonusPct,
    synergyMultiplier,
    synergyBonusPct,
    lenSynergyMultiplier,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 012: Multiple Shot
 * Arrow count `min(24, 1 + slvl)` (`Param1=2, Param2=1, calc1=min(24, ln12)`),
 * 75% weapon damage (`srcdam = 96`),
 * center 2 arrows proc flag,
 * single-target multi-hit immunity per volley (`NextDelay = 4`),
 * mana `4 + 1*(slvl-1)`.
 */
export function calculateMultipleShotStats(slvl: number): MultipleShotStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const arrowCount = Math.min(24, Math.max(2, 1 + lvl))
  const manaCost = 4 + 1 * (lvl - 1)
  const manaCost256 = manaCost * 256

  return {
    arrowCount,
    damageMultiplier: 0.75,
    srcDam: 96,
    centerProcArrows: 2,
    onlyCenterArrowsProc: true,
    singleTargetImmunity: true,
    toHitBonusPct: 0,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 016: Exploding Arrow
 * 5-band blast fire damage:
 *   Min: (2, 5, 7, 9, 12, 20)
 *   Max: (6, 5, 8, 11, 14, 23)
 * AoE 80 sub-pixels (5 subtiles / 3.33 yards),
 * Fire Arrow synergy (+12%/blvl),
 * AR bonus `+20 + 9*(slvl-1)%`,
 * mana `5 + 0.5*(slvl-1)`.
 */
export function calculateExplodingArrowStats(
  slvl: number,
  synergies?: number | { readonly fireArrow?: number; readonly [key: string]: any }
): ExplodingArrowStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const baseMin = compute5BandScaling(lvl, 2, 5, 7, 9, 12, 20)
  const baseMax = compute5BandScaling(lvl, 6, 5, 8, 11, 14, 23)
  let synergyMultiplier = 1.0
  let synergyBonusPct = 0
  if (typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0) {
    synergyMultiplier = synergies
    synergyBonusPct = Math.round((synergyMultiplier - 1.0) * 100)
  } else if (synergies && typeof synergies === 'object') {
    const synBlvl = Math.max(0, Math.floor(synergies?.fireArrow ?? (synergies as any)?.['Fire Arrow'] ?? 0))
    synergyBonusPct = synBlvl * 12
    synergyMultiplier = 1 + synergyBonusPct / 100
  }
  const minBlastDamage = Math.floor(baseMin * synergyMultiplier)
  const maxBlastDamage = Math.floor(baseMax * synergyMultiplier)
  const toHitBonusPct = 20 + 9 * (lvl - 1)
  const manaCost = 5 + 0.5 * (lvl - 1)
  const manaCost256 = Math.round(manaCost * 256)

  return {
    minBlastDamage,
    maxBlastDamage,
    baseMinBlastDamage: baseMin,
    baseMaxBlastDamage: baseMax,
    minDamage: minBlastDamage,
    maxDamage: maxBlastDamage,
    radiusPx: 80,
    radiusSubtiles: 80,
    toHitBonusPct,
    synergyMultiplier,
    synergyBonusPct,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 021: Ice Arrow
 * 5-band cold damage:
 *   Min: (6, 6, 12, 18, 26, 36)
 *   Max: (10, 6, 13, 19, 27, 38)
 * Freeze duration `50 + 5*(slvl-1)` frames,
 * AR bonus `+20 + 9*(slvl-1)%`,
 * Cold Arrow synergy (+8% damage/blvl),
 * Freezing Arrow synergy (+5% length/blvl),
 * mana `4 + 0.25*(slvl-1)`.
 */
export function calculateIceArrowStats(
  slvl: number,
  synergies?: number | {
    readonly coldArrow?: number
    readonly freezingArrow?: number
    readonly [key: string]: any
  }
): IceArrowStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const baseMin = compute5BandScaling(lvl, 6, 6, 12, 18, 26, 36)
  const baseMax = compute5BandScaling(lvl, 10, 6, 13, 19, 27, 38)
  let dmgSynergyMultiplier = 1.0
  let lenSynergyMultiplier = 1.0

  if (typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0) {
    dmgSynergyMultiplier = synergies
  } else if (synergies && typeof synergies === 'object') {
    const caBlvl = Math.max(0, Math.floor(synergies?.coldArrow ?? (synergies as any)?.['Cold Arrow'] ?? 0))
    const dmgSynPct = caBlvl * 8
    dmgSynergyMultiplier = 1 + dmgSynPct / 100

    const faBlvl = Math.max(0, Math.floor(synergies?.freezingArrow ?? (synergies as any)?.['Freezing Arrow'] ?? 0))
    const lenSynPct = faBlvl * 5
    lenSynergyMultiplier = 1 + lenSynPct / 100
  }
  const minDamage = Math.floor(baseMin * dmgSynergyMultiplier)
  const maxDamage = Math.floor(baseMax * dmgSynergyMultiplier)

  const baseFreezeFrames = 50 + 5 * (lvl - 1)
  const freezeFrames = Math.floor(baseFreezeFrames * lenSynergyMultiplier)

  const toHitBonusPct = 20 + 9 * (lvl - 1)
  const manaCost = 4 + 0.25 * (lvl - 1)
  const manaCost256 = Math.round(manaCost * 256)

  return {
    minDamage,
    maxDamage,
    baseMinDamage: baseMin,
    baseMaxDamage: baseMax,
    freezeFrames,
    baseFreezeFrames,
    toHitBonusPct,
    dmgSynergyMultiplier,
    lenSynergyMultiplier,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 022: Guided Arrow
 * Enhanced damage `+5%*(slvl-1)`,
 * auto-hit invariant (`alwaysHits = true`),
 * pierce-capable (`canPierce = true`, actual pierce chance from Skill #33 Pierce + item_pierce),
 * mana `max(1.0, 8.0 - 0.25*(slvl-1))` (`minmana=1, mana=32, lvlmana=-1, manashift=6`).
 */
export function calculateGuidedArrowStats(slvl: number): GuidedArrowStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const enhancedDamagePct = 5 * (lvl - 1)
  const manaCost = Math.max(1.0, 8.0 - 0.25 * (lvl - 1))
  const manaCost256 = Math.max(256, Math.round((8.0 - 0.25 * (lvl - 1)) * 256))

  return {
    enhancedDamagePct,
    alwaysHits: true,
    autoHit: true,
    canPierce: true,
    pierceChancePct: 0,
    toHitBonusPct: 0,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 026: Strafe
 * Max arrow count `min(10, 3 + slvl)` (`Param1=4, Param2=1, calc1=min(ln12, 10)`),
 * Min arrow count `2 + floor(slvl / 4)` (`Param4=2, calc3=par4 + lvl/4`),
 * 75% weapon damage (`srcdam = 96`),
 * Enhanced damage `+5%*slvl` (`Param3=5, calc2=par3 * lvl`),
 * stationary lock-in duration,
 * mana fixed at 11.
 */
export function calculateStrafeStats(slvl: number): StrafeStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const arrowCount = Math.min(10, Math.max(4, 3 + lvl))
  const minArrows = 2 + Math.floor(lvl / 4)
  const enhancedDamagePct = 5 * lvl
  const lockInFrames = arrowCount * 2 + 4

  return {
    arrowCount,
    minArrows,
    damageMultiplier: 0.75,
    srcDam: 96,
    enhancedDamagePct,
    stationaryLockIn: true,
    lockInFrames,
    toHitBonusPct: 0,
    manaCost: 11,
    manaCost256: 2816,
  }
}

/**
 * Skill 027: Immolation Arrow
 * 5-band explosion fire damage:
 *   Min: (12, 12, 23, 34, 36, 38)
 *   Max: (23, 12, 23, 34, 36, 38)
 * 75-frame ground fire patch (`immolationfire`),
 * 25-frame casting cooldown (1.0s delay),
 * Synergies:
 *   - Exploding Arrow (`#16`): +10%/blvl explosion fire damage (`Skills.txt` EDmgSymPerCalc = `skill('Exploding Arrow'.blvl) * par8`, Param8=10)
 *   - Fire Arrow (`#7`): +5%/blvl ground fire patch damage (`Missiles.txt` `immolationfire` EDmgSymPerCalc = `skill('Fire Arrow'.blvl) * par7`, Param7=5)
 * AR bonus `+30 + 9*(slvl-1)%`,
 * mana `6 + 0.5*(slvl-1)`.
 */
export function calculateImmolationArrowStats(
  slvl: number,
  synergies?: number | {
    readonly explodingArrow?: number
    readonly fireArrow?: number
    readonly [key: string]: any
  }
): ImmolationArrowStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const baseMin = compute5BandScaling(lvl, 12, 12, 23, 34, 36, 38)
  const baseMax = compute5BandScaling(lvl, 23, 12, 23, 34, 36, 38)
  let explosionSynergyMultiplier = 1.0
  let firePatchSynergyMultiplier = 1.0

  if (typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0) {
    explosionSynergyMultiplier = synergies
    firePatchSynergyMultiplier = synergies
  } else if (synergies && typeof synergies === 'object') {
    const eaBlvl = Math.max(
      0,
      Math.floor(synergies?.explodingArrow ?? (synergies as any)?.['Exploding Arrow'] ?? 0)
    )
    const expSynPct = eaBlvl * 10
    explosionSynergyMultiplier = 1 + expSynPct / 100

    const faBlvl = Math.max(
      0,
      Math.floor(synergies?.fireArrow ?? (synergies as any)?.['Fire Arrow'] ?? 0)
    )
    const patchSynPct = faBlvl * 5
    firePatchSynergyMultiplier = 1 + patchSynPct / 100
  }
  const minExplosionDamage = Math.floor(baseMin * explosionSynergyMultiplier)
  const maxExplosionDamage = Math.floor(baseMax * explosionSynergyMultiplier)

  // 1.13c immolationfire (missile 230) base damage scaled by Fire Arrow (+5%/blvl) synergy
  const firePatchMinDamagePerSec = Math.floor(7 * firePatchSynergyMultiplier)
  const firePatchMaxDamagePerSec = Math.floor(10 * firePatchSynergyMultiplier)

  const toHitBonusPct = 30 + 9 * (lvl - 1)
  const manaCost = 6 + 0.5 * (lvl - 1)
  const manaCost256 = Math.round(manaCost * 256)

  return {
    minExplosionDamage,
    maxExplosionDamage,
    baseMinExplosionDamage: baseMin,
    baseMaxExplosionDamage: baseMax,
    minDamage: minExplosionDamage,
    maxDamage: maxExplosionDamage,
    firePatchDurationFrames: 75,
    firePatchMinDamagePerSec,
    firePatchMaxDamagePerSec,
    cooldownFrames: 25,
    toHitBonusPct,
    explosionSynergyMultiplier,
    firePatchSynergyMultiplier,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 031: Freezing Arrow
 * 5-band frost blast cold damage:
 *   Min: (40, 10, 15, 20, 22, 24)
 *   Max: (50, 10, 15, 20, 22, 24)
 * AoE 80 sub-pixels (5.33 yards / 2.66 tiles),
 * 50-frame freeze duration,
 * Cold Arrow synergy (+12% damage/lvl),
 * Ice Arrow synergy (+5% length/lvl),
 * AR bonus `+40 + 9*(slvl-1)%`,
 * mana `9 + 0.5*(slvl-1)`.
 */
export function calculateFreezingArrowStats(
  slvl: number,
  synergies?: number | {
    readonly coldArrow?: number
    readonly iceArrow?: number
    readonly [key: string]: any
  }
): FreezingArrowStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const baseMin = compute5BandScaling(lvl, 40, 10, 15, 20, 22, 24)
  const baseMax = compute5BandScaling(lvl, 50, 10, 15, 20, 22, 24)
  let coldSynergyMultiplier = 1.0
  let lenSynergyMultiplier = 1.0

  if (typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0) {
    coldSynergyMultiplier = synergies
  } else if (synergies && typeof synergies === 'object') {
    const caBlvl = Math.max(0, Math.floor(synergies?.coldArrow ?? (synergies as any)?.['Cold Arrow'] ?? 0))
    const coldSynPct = caBlvl * 12
    coldSynergyMultiplier = 1 + coldSynPct / 100

    const iaBlvl = Math.max(0, Math.floor(synergies?.iceArrow ?? (synergies as any)?.['Ice Arrow'] ?? 0))
    const lenSynPct = iaBlvl * 5
    lenSynergyMultiplier = 1 + lenSynPct / 100
  }
  const minColdDamage = Math.floor(baseMin * coldSynergyMultiplier)
  const maxColdDamage = Math.floor(baseMax * coldSynergyMultiplier)

  const freezeFrames = Math.floor(50 * lenSynergyMultiplier)

  const toHitBonusPct = 40 + 9 * (lvl - 1)
  const manaCost = 9 + 0.5 * (lvl - 1)
  const manaCost256 = Math.round(manaCost * 256)

  return {
    minColdDamage,
    maxColdDamage,
    baseMinColdDamage: baseMin,
    baseMaxColdDamage: baseMax,
    minDamage: minColdDamage,
    maxDamage: maxColdDamage,
    freezeFrames,
    baseFreezeFrames: 50,
    radiusPx: 80,
    radiusSubtiles: 80,
    toHitBonusPct,
    coldSynergyMultiplier,
    lenSynergyMultiplier,
    manaCost,
    manaCost256,
  }
}

// --- Kinematics Helpers ---

/**
 * Computes symmetrical fan angles for Multiple Shot.
 * Spreads `arrowCount` arrows across an arc centered at `aimAngleRad`.
 */
export function generateMultipleShotAngles(
  aimAngleRad: number,
  arrowCount: number,
  arcRad: number = (45 * Math.PI) / 180
): number[] {
  if (arrowCount <= 1) return [aimAngleRad]
  const angles: number[] = []
  const halfArc = arcRad / 2
  const step = arcRad / (arrowCount - 1)
  for (let i = 0; i < arrowCount; i += 1) {
    angles.push(aimAngleRad - halfArc + i * step)
  }
  return angles
}

/**
 * Checks if an arrow index in a Multiple Shot volley is one of the two center arrows.
 * Only center arrows can trigger "chance to cast on striking" procs and knockback in 1.13c.
 * Per D2MOO C++ (SkillAma.cpp:515-560, v31 = 2), exactly 2 central arrows are generated without 0x10000 flag when arrowCount >= 2.
 */
export function isMultipleShotCenterArrow(index: number, arrowCount: number): boolean {
  if (arrowCount <= 0) return false
  if (arrowCount === 1) return index === 0
  const mid2 = Math.floor(arrowCount / 2)
  const mid1 = mid2 - 1
  return index === mid1 || index === mid2
}

