/**
 * Diablo II: Lord of Destruction v1.13c — Assassin Shadow Disciplines Module
 *
 * Dedicated pure calculations, mutual exclusivity tracking (Burst of Speed vs Fade),
 * Venom 10-frame bitrate clamp, Weapon Block dual-claw mechanics, Cloak of Shadows blind/defense,
 * Mind Blast stun/conversion, and Shadow Warrior / Master minion orchestration for the 10
 * Assassin Shadow Disciplines Tree Skills:
 * - Skill 252: Claw Mastery (ReqLevel 1)
 * - Skill 253: Psychic Hammer (ReqLevel 1)
 * - Skill 258: Burst of Speed / Quickness (ReqLevel 6)
 * - Skill 263: Weapon Block (ReqLevel 12)
 * - Skill 264: Cloak of Shadows (ReqLevel 12)
 * - Skill 267: Fade (ReqLevel 18)
 * - Skill 268: Shadow Warrior (ReqLevel 18)
 * - Skill 273: Mind Blast (ReqLevel 24)
 * - Skill 278: Venom (ReqLevel 30)
 * - Skill 279: Shadow Master (ReqLevel 30)
 *
 * 1.13c Ground Truth:
 * - Skills.txt, Missiles.txt, MonStats.txt, SkillDesc.txt (Patch_D2.mpq).
 * - Burst of Speed vs Fade:
 *     Mutual exclusivity: Activating Burst of Speed cancels Fade. Activating Fade cancels Burst of Speed.
 * - Venom Mechanics:
 *     Poison duration is strictly clamped to 10 frames (0.4 seconds).
 *     Combines with other poison sources by summing bitrates over the 10-frame duration.
 * - Weapon Block Mechanics:
 *     Requires two claws (h2h in main-hand and off-hand).
 *     Full block chance when standing, attacking, or casting.
 *     Drops to 0% block chance while running (in contrast to shields which drop to 1/3).
 *     Can block both physical and magical/elemental projectile attacks.
 * - Cloak of Shadows Mechanics:
 *     Cannot be recast until its active duration has fully elapsed.
 *     Suppresses normal monster AI (blinds them, restricts vision to melee).
 *     Lowers monster defense by -min(15 + 3*(slvl-1), 95)% and increases Assassin defense by +(10 + 3*(slvl-1))%.
 * - Mind Blast Mechanics:
 *     Deals physical damage and stuns all targets in 4-yard radius for 50 + 5*(slvl-1) frames.
 *     Normal monsters and minions have a chance to be converted for 150 + rand(0, 100) frames.
 *     Champions, Uniques, SuperUniques, and Act Bosses are completely immune to conversion.
 * - Shadow Warrior & Shadow Master:
 *     Share the 'shadowwarrior' PetType with PetMax = 1 (summoning one despawns the other).
 *     Shadow Warrior mirrors the player's active left- and right-hand skills.
 *     Shadow Master has autonomous AI using all Assassin skills, with equipment quality scaling with slvl.
 * - Zero runtime MPQ reading.
 */

import {
  compute3BandDuration,
  compute5BandScaling,
  computeDiminishingReturns,
  computeLinearScaling,
} from '../../common/data/calc-ast.ts'

// --- Skill IDs ---

export const ASSASSIN_SHADOW_SKILL_IDS = {
  CLAW_MASTERY: 252,
  PSYCHIC_HAMMER: 253,
  BURST_OF_SPEED: 258,
  WEAPON_BLOCK: 263,
  CLOAK_OF_SHADOWS: 264,
  FADE: 267,
  SHADOW_WARRIOR: 268,
  MIND_BLAST: 273,
  VENOM: 278,
  SHADOW_MASTER: 279,
} as const

// --- Numerical Formulas (1.13c Ground Truth) ---

/**
 * Skill 252: Claw Mastery (Passive)
 * - AR Bonus%: ln12 = 30 + 10 * (slvl - 1)
 * - ED Bonus%: ln34 = 35 + 4 * (slvl - 1)
 * - Critical Strike%: dm56 = computeDiminishingReturns(0, 25, slvl)
 */
export function computeClawMasteryAR(slvl: number): number {
  if (slvl <= 0) return 0
  return computeLinearScaling(30, 10, slvl)
}

export function computeClawMasteryED(slvl: number): number {
  if (slvl <= 0) return 0
  return computeLinearScaling(35, 4, slvl)
}

export function computeClawMasteryCriticalStrike(slvl: number): number {
  if (slvl <= 0) return 0
  return computeDiminishingReturns(0, 25, slvl)
}

/**
 * Skill 253: Psychic Hammer
 * - Physical Damage: MinDam=2, Lev=[2, 3, 4, 5, 6]; MaxDam=6, Lev=[3, 4, 5, 6, 7]
 * - Magic Damage: EMin=2, Lev=[2, 3, 4, 5, 6]; EMax=6, Lev=[3, 4, 5, 6, 7]
 * - Knockback Chance: Normal=100%, Unique=dm(50, 100), Boss/Player=dm(25, 99)
 */
export interface PsychicHammerDamage {
  readonly minPhys: number
  readonly maxPhys: number
  readonly minMagic: number
  readonly maxMagic: number
}

export function computePsychicHammerDamage(slvl: number): PsychicHammerDamage {
  if (slvl <= 0) return { minPhys: 0, maxPhys: 0, minMagic: 0, maxMagic: 0 }
  // Skills.txt HitShift = 7 (>> 1, i.e. / 2): slvl 1 deals 1-3 physical and 1-3 magic damage
  const minPhys = (compute5BandScaling(slvl, 2, 2, 3, 4, 5, 6) << 7) >> 8
  const maxPhys = (compute5BandScaling(slvl, 6, 3, 4, 5, 6, 7) << 7) >> 8
  const minMagic = (compute5BandScaling(slvl, 2, 2, 3, 4, 5, 6) << 7) >> 8
  const maxMagic = (compute5BandScaling(slvl, 6, 3, 4, 5, 6, 7) << 7) >> 8
  return { minPhys, maxPhys, minMagic, maxMagic }
}

export function computePsychicHammerKnockbackChance(
  slvl: number,
  targetType: 'normal' | 'exceptional' | 'champion' | 'unique' | 'boss' | 'player',
): number {
  if (slvl <= 0) return 0
  if (targetType === 'normal') return 100
  if (targetType === 'exceptional' || targetType === 'champion' || targetType === 'unique') {
    return computeDiminishingReturns(50, 100, slvl)
  }
  // boss or player
  return computeDiminishingReturns(25, 99, slvl)
}

/**
 * Skill 258: Burst of Speed / Quickness
 * - Duration: ln56 = 3000 + 300 * (slvl - 1) frames (120s + 12s/lvl)
 * - FRW Bonus%: dm12 = computeDiminishingReturns(15, 70, slvl)
 * - IAS Bonus%: dm34 = computeDiminishingReturns(15, 60, slvl)
 */
export function computeBurstOfSpeedDuration(slvl: number): number {
  if (slvl <= 0) return 0
  return computeLinearScaling(3000, 300, slvl)
}

export function computeBurstOfSpeedFRW(slvl: number): number {
  if (slvl <= 0) return 0
  return computeDiminishingReturns(15, 70, slvl)
}

export function computeBurstOfSpeedIAS(slvl: number): number {
  if (slvl <= 0) return 0
  return computeDiminishingReturns(15, 60, slvl)
}

/**
 * Skill 263: Weapon Block (Passive)
 * - Block Chance%: dm12 = computeDiminishingReturns(20, 65, slvl)
 * - Requires dual-claw equipped
 */
export function computeWeaponBlockChance(slvl: number): number {
  if (slvl <= 0) return 0
  return computeDiminishingReturns(20, 65, slvl)
}

/**
 * Skill 264: Cloak of Shadows
 * - Radius: 30 subtiles (20 yards)
 * - Duration: ln34 = 200 + 25 * (slvl - 1) frames (8.0s + 1.0s/lvl)
 * - Monster Defense Decrease%: min(15 + 3 * (slvl - 1), 95)%
 * - Assassin Defense Increase%: 10 + 3 * (slvl - 1)%
 */
export function computeCloakOfShadowsDuration(slvl: number): number {
  if (slvl <= 0) return 0
  return computeLinearScaling(200, 25, slvl)
}

export function computeCloakOfShadowsDefenseReduction(slvl: number): number {
  if (slvl <= 0) return 0
  const raw = computeLinearScaling(15, 3, slvl)
  return Math.min(raw, 95)
}

export function computeCloakOfShadowsDefenseBonus(slvl: number): number {
  if (slvl <= 0) return 0
  return computeLinearScaling(10, 3, slvl)
}

/**
 * Skill 267: Fade
 * - Duration: ln56 = 3000 + 300 * (slvl - 1) frames (120s + 12s/lvl)
 * - All Elemental Resistances%: dm12 = computeDiminishingReturns(10, 75, slvl)
 * - Curse Length Reduction%: dm34 = computeDiminishingReturns(40, 90, slvl)
 * - Hidden Physical Damage Reduction%: 1% per slvl (ln78 = 1 + 1 * (slvl - 1) = slvl)
 */
export function computeFadeDuration(slvl: number): number {
  if (slvl <= 0) return 0
  return computeLinearScaling(3000, 300, slvl)
}

export function computeFadeResistances(slvl: number): number {
  if (slvl <= 0) return 0
  return computeDiminishingReturns(10, 75, slvl)
}

export function computeFadeCurseReduction(slvl: number): number {
  if (slvl <= 0) return 0
  return computeDiminishingReturns(40, 90, slvl)
}

export function computeFadePhysicalDamageReduction(slvl: number): number {
  if (slvl <= 0) return 0
  return slvl
}

export const computeFadePhysicalReduction = computeFadePhysicalDamageReduction

/**
 * Skill 273: Mind Blast
 * - Physical Damage: MinDam=10, Lev=[2, 5, 8, 8, 8]; MaxDam=20, Lev=[2, 5, 8, 8, 8]
 * - Stun Duration: 50 + 5 * (slvl - 1) frames (compute3BandDuration(slvl, 50, 5, 5, 5))
 * - Conversion Chance%: dm56 = computeDiminishingReturns(15, 40, slvl)
 * - Conversion Base Duration: 150 frames (6.0s), with random variance up to +100 frames (total 6..10s)
 */
export interface MindBlastDamage {
  readonly minPhys: number
  readonly maxPhys: number
}

export function computeMindBlastDamage(slvl: number): MindBlastDamage {
  if (slvl <= 0) return { minPhys: 0, maxPhys: 0 }
  const minPhys = compute5BandScaling(slvl, 10, 2, 5, 8, 8, 8)
  const maxPhys = compute5BandScaling(slvl, 20, 2, 5, 8, 8, 8)
  return { minPhys, maxPhys }
}

export function computeMindBlastStunDuration(slvl: number): number {
  if (slvl <= 0) return 0
  return compute3BandDuration(slvl, 50, 5, 5, 5)
}

export function computeMindBlastConversionChance(slvl: number): number {
  if (slvl <= 0) return 0
  return computeDiminishingReturns(15, 40, slvl)
}

/**
 * Skill 278: Venom
 * - Buff Duration: ln12 = 3000 + 100 * (slvl - 1) frames (120s + 4s/lvl)
 * - Poison Attack Duration: Strictly 10 frames (0.4s)
 * - Poison Damage (HitShift 6 = *64 in 256ths):
 *     EMin = 24, Lev=[6, 8, 10, 12, 14]
 *     EMax = 32, Lev=[6, 8, 10, 12, 14]
 */
export function computeVenomDuration(slvl: number): number {
  if (slvl <= 0) return 0
  return computeLinearScaling(3000, 100, slvl)
}

export interface VenomPoisonDamage {
  readonly minDamage: number
  readonly maxDamage: number
  readonly durationFrames: number
  readonly minBitrate: number
  readonly maxBitrate: number
}

export function computeVenomPoisonDamage(slvl: number): VenomPoisonDamage {
  if (slvl <= 0) {
    return { minDamage: 0, maxDamage: 0, durationFrames: 10, minBitrate: 0, maxBitrate: 0 }
  }
  const minBase = compute5BandScaling(slvl, 24, 6, 8, 10, 12, 14)
  const maxBase = compute5BandScaling(slvl, 32, 6, 8, 10, 12, 14)
  // Skills.txt HitShift=6 implies per-frame bitrate in 256ths is base * 64 (e.g. slvl 1: 1536..2048 = 6..8 HP/frame).
  // Multiplied by ELen = 10 frames, total poison damage at slvl 1 is 60..80 over 10 frames (0.4s).
  const durationFrames = 10
  const minBitrate = minBase * 64
  const maxBitrate = maxBase * 64
  const minDamage = (minBitrate * durationFrames) >> 8
  const maxDamage = (maxBitrate * durationFrames) >> 8

  return {
    minDamage,
    maxDamage,
    durationFrames,
    minBitrate,
    maxBitrate,
  }
}

/**
 * Skill 268 & 279: Shadow Warrior & Shadow Master Stats
 */
export interface ShadowMinionStats {
  readonly hpBonusPct: number
  readonly toHitBonus: number
  readonly strBonus: number
  readonly dexBonus: number
  readonly allResistPct: number
  readonly defenseBonusPct: number
  readonly itemQualityLevel: number
}

export function computeShadowWarriorStats(slvl: number): ShadowMinionStats {
  if (slvl <= 0) {
    return {
      hpBonusPct: 0,
      toHitBonus: 0,
      strBonus: 0,
      dexBonus: 0,
      allResistPct: 0,
      defenseBonusPct: 0,
      itemQualityLevel: 0,
    }
  }
  return {
    hpBonusPct: slvl * 15,
    toHitBonus: slvl * 40,
    strBonus: slvl * 10,
    dexBonus: slvl * 10,
    allResistPct: Math.min(slvl * 4, 75),
    defenseBonusPct: slvl * 12,
    itemQualityLevel: 18 + (slvl - 1) * 2,
  }
}

export function computeShadowMasterStats(slvl: number): ShadowMinionStats {
  if (slvl <= 0) {
    return {
      hpBonusPct: 0,
      toHitBonus: 0,
      strBonus: 0,
      dexBonus: 0,
      allResistPct: 0,
      defenseBonusPct: 0,
      itemQualityLevel: 0,
    }
  }
  return {
    hpBonusPct: slvl * 15,
    toHitBonus: slvl * 40,
    strBonus: slvl * 10,
    dexBonus: slvl * 10,
    allResistPct: computeDiminishingReturns(5, 90, slvl),
    defenseBonusPct: 0,
    itemQualityLevel: 24 + (slvl - 1) * 3,
  }
}

// --- Shadow Buff State Tracker (Mutual Exclusivity & Cooldowns) ---

export interface ActiveShadowBuff {
  readonly skillId: number
  readonly name: string
  readonly level: number
  remainingFrames: number
  readonly params: Record<string, number>
}

export class ShadowBuffTracker {
  private activeBoS: ActiveShadowBuff | null = null
  private activeFade: ActiveShadowBuff | null = null
  private activeVenom: ActiveShadowBuff | null = null
  private activeCloak: ActiveShadowBuff | null = null

  /**
   * Apply Burst of Speed (Quickness).
   * 1.13c Invariant: Cancels Fade if active.
   */
  applyBurstOfSpeed(slvl: number): { applied: boolean; cancelledFade: boolean } {
    let cancelledFade = false
    if (this.activeFade) {
      this.activeFade = null
      cancelledFade = true
    }
    const duration = computeBurstOfSpeedDuration(slvl)
    this.activeBoS = {
      skillId: ASSASSIN_SHADOW_SKILL_IDS.BURST_OF_SPEED,
      name: 'Burst of Speed',
      level: slvl,
      remainingFrames: duration,
      params: {
        frwPct: computeBurstOfSpeedFRW(slvl),
        iasPct: computeBurstOfSpeedIAS(slvl),
      },
    }
    return { applied: true, cancelledFade }
  }

  /**
   * Apply Fade.
   * 1.13c Invariant: Cancels Burst of Speed if active.
   */
  applyFade(slvl: number): { applied: boolean; cancelledBoS: boolean } {
    let cancelledBoS = false
    if (this.activeBoS) {
      this.activeBoS = null
      cancelledBoS = true
    }
    const duration = computeFadeDuration(slvl)
    this.activeFade = {
      skillId: ASSASSIN_SHADOW_SKILL_IDS.FADE,
      name: 'Fade',
      level: slvl,
      remainingFrames: duration,
      params: {
        allResistPct: computeFadeResistances(slvl),
        curseReductionPct: computeFadeCurseReduction(slvl),
        damageResistPct: computeFadePhysicalDamageReduction(slvl),
      },
    }
    return { applied: true, cancelledBoS }
  }

  /**
   * Apply Venom.
   * Coexists with Burst of Speed or Fade.
   */
  applyVenom(slvl: number): void {
    const duration = computeVenomDuration(slvl)
    const poison = computeVenomPoisonDamage(slvl)
    this.activeVenom = {
      skillId: ASSASSIN_SHADOW_SKILL_IDS.VENOM,
      name: 'Venom',
      level: slvl,
      remainingFrames: duration,
      params: {
        minDamage: poison.minDamage,
        maxDamage: poison.maxDamage,
        durationFrames: poison.durationFrames,
        minBitrate: poison.minBitrate,
        maxBitrate: poison.maxBitrate,
      },
    }
  }

  /**
   * Apply Cloak of Shadows.
   * 1.13c Invariant: Cannot be cast if already active!
   */
  applyCloakOfShadows(slvl: number): { success: boolean; reason?: string | undefined } {
    if (this.activeCloak && this.activeCloak.remainingFrames > 0) {
      return { success: false, reason: 'Cloak of Shadows is already active (recast locked)' }
    }
    const duration = computeCloakOfShadowsDuration(slvl)
    this.activeCloak = {
      skillId: ASSASSIN_SHADOW_SKILL_IDS.CLOAK_OF_SHADOWS,
      name: 'Cloak of Shadows',
      level: slvl,
      remainingFrames: duration,
      params: {
        monsterDefReductionPct: computeCloakOfShadowsDefenseReduction(slvl),
        assassinDefBonusPct: computeCloakOfShadowsDefenseBonus(slvl),
        radiusSubtiles: 30,
      },
    }
    return { success: true }
  }

  getBurstOfSpeed(): ActiveShadowBuff | null {
    return this.activeBoS
  }

  getFade(): ActiveShadowBuff | null {
    return this.activeFade
  }

  getVenom(): ActiveShadowBuff | null {
    return this.activeVenom
  }

  getCloakOfShadows(): ActiveShadowBuff | null {
    return this.activeCloak
  }

  /**
   * Advance simulation time by a number of frames.
   */
  updateFrames(deltaFrames: number): void {
    if (this.activeBoS) {
      this.activeBoS.remainingFrames -= deltaFrames
      if (this.activeBoS.remainingFrames <= 0) this.activeBoS = null
    }
    if (this.activeFade) {
      this.activeFade.remainingFrames -= deltaFrames
      if (this.activeFade.remainingFrames <= 0) this.activeFade = null
    }
    if (this.activeVenom) {
      this.activeVenom.remainingFrames -= deltaFrames
      if (this.activeVenom.remainingFrames <= 0) this.activeVenom = null
    }
    if (this.activeCloak) {
      this.activeCloak.remainingFrames -= deltaFrames
      if (this.activeCloak.remainingFrames <= 0) this.activeCloak = null
    }
  }
}

// --- Venom Poison Clamp Engine ---

export interface PoisonSource {
  readonly damage: number
  readonly durationFrames: number
}

export interface ClampedPoisonResult {
  readonly finalDurationFrames: number
  readonly totalDamageDealt: number
  readonly effectiveBitrate: number
  readonly sourcesCombinedCount: number
}

/**
 * 1.13c Venom Bitrate Clamping:
 * When Venom is active on an attack:
 * 1. The total duration of the poison attack is clamped to 10 frames (0.4s).
 * 2. Each additional poison source's bitrate is calculated: bitrate = (damage << 8) / duration.
 * 3. The total bitrate = venomBitrate + sum(otherBitrates).
 * 4. The total damage dealt over the 10 frames = (totalBitrate * 10) >> 8.
 */
export function resolveVenomPoisonClamp(
  venomLevel: number,
  additionalSources: readonly PoisonSource[],
): ClampedPoisonResult {
  const venom = computeVenomPoisonDamage(venomLevel)
  const venomBitrate256 = (venom.minDamage << 8) / 10

  let totalBitrate256 = venomBitrate256
  for (const src of additionalSources) {
    if (src.durationFrames > 0 && src.damage > 0) {
      const srcBitrate256 = (src.damage << 8) / src.durationFrames
      totalBitrate256 += srcBitrate256
    }
  }

  const finalDurationFrames = 10
  const totalDamageDealt = (totalBitrate256 * finalDurationFrames) >> 8

  return {
    finalDurationFrames,
    totalDamageDealt,
    effectiveBitrate: totalBitrate256,
    sourcesCombinedCount: additionalSources.length + 1,
  }
}

// --- Weapon Block Mechanics ---

export type PlayerMovementMode = 'standing' | 'walking' | 'attacking' | 'casting' | 'running'

export interface WeaponBlockEvaluation {
  readonly canBlock: boolean
  readonly baseChancePct: number
  readonly effectiveChancePct: number
  readonly reason?: string | undefined
}

/**
 * 1.13c Weapon Block Resolution:
 * - Requires dual-claw wielding (two claws equipped).
 * - Full block chance applied when standing, attacking, or casting.
 * - Unlike shields (which drop to 1/3 block chance with 75% cap), Weapon Block drops to 0% when walking or running!
 * - Weapon Block can block elemental/magical spells and ranged projectiles.
 */
export function resolveWeaponBlock(
  slvl: number,
  hasDualClaws: boolean,
  mode: PlayerMovementMode,
): WeaponBlockEvaluation {
  if (!hasDualClaws) {
    return {
      canBlock: false,
      baseChancePct: 0,
      effectiveChancePct: 0,
      reason: 'Requires dual claws to activate Weapon Block',
    }
  }

  const baseChance = computeWeaponBlockChance(slvl)
  if (mode === 'running' || mode === 'walking') {
    return {
      canBlock: false,
      baseChancePct: baseChance,
      effectiveChancePct: 0,
      reason: 'Weapon Block is disabled (0%) while walking or running',
    }
  }

  return {
    canBlock: true,
    baseChancePct: baseChance,
    effectiveChancePct: baseChance,
  }
}

// --- Mind Blast Stun & Conversion Resolution ---

export interface MindBlastResolution {
  readonly damageDealt: number
  readonly stunApplied: boolean
  readonly stunDurationFrames: number
  readonly converted: boolean
  readonly conversionDurationFrames: number
}

/**
 * 1.13c Mind Blast Resolution against a specific target.
 */
export function resolveMindBlastTarget(
  slvl: number,
  target: {
    readonly isPlayer?: boolean | undefined
    readonly isBoss?: boolean | undefined
    readonly isUnique?: boolean | undefined
    readonly isChampion?: boolean | undefined
    readonly roll?: number | undefined // 0..99
    readonly durationRoll?: number | undefined // 0..100
  },
): MindBlastResolution {
  const dmg = computeMindBlastDamage(slvl)
  const stunDuration = computeMindBlastStunDuration(slvl)

  // Immunity check for conversion:
  // Players, Act Bosses, Uniques, Champions cannot be converted
  const cannotConvert = Boolean(
    target.isPlayer || target.isBoss || target.isUnique || target.isChampion,
  )

  const convChance = computeMindBlastConversionChance(slvl)
  const roll = target.roll ?? 50
  const converted = !cannotConvert && roll < convChance

  const durationRand = target.durationRoll ?? 50
  const conversionDuration = converted ? 150 + durationRand : 0

  return {
    damageDealt: dmg.minPhys,
    stunApplied: true,
    stunDurationFrames: stunDuration,
    converted,
    conversionDurationFrames: conversionDuration,
  }
}

// --- Shadow Minion Orchestrator (Warrior & Master) ---

export type ShadowType = 'warrior' | 'master'

export interface ActiveShadowMinion {
  readonly type: ShadowType
  readonly slvl: number
  readonly stats: ShadowMinionStats
  readonly summonedFrame: number
}

export class ShadowMinionManager {
  private activeShadow: ActiveShadowMinion | null = null

  /**
   * Summon a Shadow Warrior or Shadow Master.
   * 1.13c Invariant: PetType 'shadowwarrior' limit is 1.
   * Summoning one replaces the other immediately.
   */
  summonShadow(type: ShadowType, slvl: number, currentFrame: number): {
    shadow: ActiveShadowMinion
    despawnedPrevious: boolean
  } {
    const despawnedPrevious = this.activeShadow !== null
    const stats =
      type === 'warrior'
        ? computeShadowWarriorStats(slvl)
        : computeShadowMasterStats(slvl)

    this.activeShadow = {
      type,
      slvl,
      stats,
      summonedFrame: currentFrame,
    }

    return {
      shadow: this.activeShadow,
      despawnedPrevious,
    }
  }

  getActiveShadow(): ActiveShadowMinion | null {
    return this.activeShadow
  }

  despawnShadow(): boolean {
    if (this.activeShadow) {
      this.activeShadow = null
      return true
    }
    return false
  }

  /**
   * Calculate effective skill level when Shadow Warrior casts a mirrored skill.
   * Formula: max(1, floor(warriorLevel / 3) + floor(playerSkillLevel / 2))
   */
  getShadowWarriorCastingLevel(warriorLevel: number, playerSkillLevel = 0): number {
    return Math.max(1, Math.floor(warriorLevel / 3) + Math.floor(playerSkillLevel / 2))
  }

  /**
   * Calculate effective skill level when Shadow Master casts an autonomous skill.
   * Formula: max(1, floor(masterLevel / 3) + floor(ownerEffectiveSkillLvl / 2))
   */
  getShadowMasterCastingLevel(masterLevel: number, ownerEffectiveSkillLvl = 0): number {
    return Math.max(1, Math.floor(masterLevel / 3) + Math.floor(ownerEffectiveSkillLvl / 2))
  }
}

export function getShadowWarriorCastingLevel(shadowSlvl: number, ownerEffectiveSkillLvl = 0): number {
  return Math.max(1, Math.floor(shadowSlvl / 3) + Math.floor(ownerEffectiveSkillLvl / 2))
}

export function getShadowMasterCastingLevel(shadowSlvl: number, ownerEffectiveSkillLvl = 0): number {
  return Math.max(1, Math.floor(shadowSlvl / 3) + Math.floor(ownerEffectiveSkillLvl / 2))
}

export function computeShadowWarriorResistances(slvl: number): number {
  return computeShadowWarriorStats(slvl).allResistPct
}

export function computeShadowMasterResistances(slvl: number): number {
  return computeShadowMasterStats(slvl).allResistPct
}

export function computeShadowMaxLife(slvl: number, baseHp = 376): number {
  if (slvl <= 0) return 0
  return Math.floor((baseHp * (100 + 15 * slvl)) / 100)
}

export function computeShadowMlvl(clvl: number, slvl: number): number {
  if (slvl <= 0) return 0
  if (clvl <= 0) return slvl
  return Math.min(clvl, slvl + Math.floor((3 * clvl) / 4))
}

export interface ShadowGeneratedItem {
  readonly slot: 'torso' | 'head' | 'rarm' | 'larm' | 'glov' | 'belt' | 'feet' | 'rrin' | 'lrin' | 'neck'
  readonly itemCode: string
  readonly quality: 'normal' | 'superior' | 'magic' | 'rare'
  readonly ilvl: number
}

export type ShadowEquipmentLoadout = readonly ShadowGeneratedItem[]

/**
 * Generates MonEquip.txt equipment for #268 Shadow Warrior and #279 Shadow Master.
 * - Shadow Warrior (#268): ilvl = min(18 + 2*slvl, 50); armor, helm, dual claws (magic at slvl >= 1).
 * - Shadow Master (#279): ilvl = min(24 + 3*slvl, 60); armor, helm, dual claws (magic below slvl 11, rare at slvl >= 11),
 *   plus gloves/belt/boots/rings/amulet at higher slvl thresholds.
 */
export function generateShadowEquipment(skillId: 268 | 279, slvl: number): ShadowGeneratedItem[] {
  const lvl = Math.max(1, slvl)
  if (skillId === 268) {
    const ilvl = Math.min(50, 18 + 2 * (lvl - 1))
    const quality: 'magic' | 'rare' = lvl >= 13 ? 'rare' : 'magic'
    const claw1 = lvl >= 9 ? '9cs' : 'ces'
    const claw2 = lvl >= 9 ? '9lw' : 'btl'
    const armor = lvl >= 9 ? 'xui' : 'stu'
    const helm = lvl >= 9 ? 'xkp' : 'skp'
    return [
      { slot: 'torso', itemCode: armor, quality, ilvl },
      { slot: 'head', itemCode: helm, quality, ilvl },
      { slot: 'rarm', itemCode: claw1, quality, ilvl },
      { slot: 'larm', itemCode: claw2, quality, ilvl },
    ]
  }
  const ilvl = Math.min(60, 24 + 3 * (lvl - 1))
  const coreQuality: 'magic' | 'rare' = lvl >= 11 ? 'rare' : 'magic'
  const claw1 = lvl >= 17 ? '7wb' : lvl >= 9 ? '9wb' : 'wrb'
  const claw2 = lvl >= 17 ? '7xf' : lvl >= 9 ? '9xf' : 'axf'
  const armor = lvl >= 17 ? 'utp' : lvl >= 9 ? 'xtp' : 'ltp'
  const helm = lvl >= 17 ? 'urn' : lvl >= 9 ? 'xrn' : 'crn'
  const items: ShadowGeneratedItem[] = [
    { slot: 'torso', itemCode: armor, quality: coreQuality, ilvl },
    { slot: 'head', itemCode: helm, quality: coreQuality, ilvl },
    { slot: 'rarm', itemCode: claw1, quality: coreQuality, ilvl },
    { slot: 'larm', itemCode: claw2, quality: coreQuality, ilvl },
  ]
  if (lvl >= 5) {
    items.push({ slot: 'glov', itemCode: lvl >= 13 ? 'xvg' : 'vgl', quality: lvl >= 13 ? 'rare' : 'magic', ilvl })
  }
  if (lvl >= 7) {
    items.push({ slot: 'belt', itemCode: lvl >= 13 ? 'zvb' : 'vbl', quality: lvl >= 13 ? 'rare' : 'magic', ilvl })
    items.push({ slot: 'feet', itemCode: lvl >= 13 ? 'xvb' : 'vbt', quality: lvl >= 13 ? 'rare' : 'magic', ilvl })
  }
  if (lvl >= 11) {
    items.push({ slot: 'rrin', itemCode: 'rin', quality: lvl >= 17 ? 'rare' : 'magic', ilvl })
  }
  if (lvl >= 13) {
    items.push({ slot: 'neck', itemCode: 'amu', quality: lvl >= 17 ? 'rare' : 'magic', ilvl })
  }
  if (lvl >= 16) {
    items.push({ slot: 'lrin', itemCode: 'rin', quality: 'rare', ilvl })
  }
  return items
}
