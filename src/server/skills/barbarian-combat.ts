/**
 * Diablo II: Lord of Destruction v1.13c — Barbarian Combat Skills Module
 *
 * Dedicated pure calculation and kinematics formulas for the 10 Barbarian Combat Skills:
 * - Skill 126: Bash (ReqLevel 1)
 * - Skill 132: Leap (ReqLevel 6)
 * - Skill 133: Double Swing (ReqLevel 6)
 * - Skill 139: Stun (ReqLevel 12)
 * - Skill 140: Double Throw (ReqLevel 12)
 * - Skill 143: Leap Attack (ReqLevel 18)
 * - Skill 144: Concentrate (ReqLevel 18)
 * - Skill 147: Frenzy (ReqLevel 24)
 * - Skill 151: Whirlwind (ReqLevel 30)
 * - Skill 152: Berserk (ReqLevel 30)
 *
 * 1.13c Ground Truth:
 * - Skills.txt & Missiles.txt & Overlay.txt (Patch_D2.mpq)
 * - Strict fixed-point 24.8 mana calculations
 * - Uninterruptible swing flag for Concentrate
 * - Double Swing mana reduction reaching 0 at slvl 9+
 * - Frenzy dual-wield buff duration (150 frames = 6s) and speed scaling
 * - Whirlwind spinning path progression (-50% + 8%/lvl)
 * - Berserk 100% physical to magic damage conversion & defense zeroing
 */

// --- Interfaces for Skill Calculations ---

export interface BashStats {
  readonly damageBonusPct: number
  readonly flatPhysicalMin: number
  readonly flatPhysicalMax: number
  readonly knockbackChancePct: number
  readonly toHitBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface LeapStats {
  readonly minDistanceYards: number
  readonly maxDistanceYards: number
  readonly leapDistanceSubtiles: number
  readonly leapDistanceYards: number
  readonly knockbackRadiusSubtiles: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface DoubleSwingStats {
  readonly damageBonusPct: number
  readonly attackRateBonusPct: number
  readonly toHitBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly requiresDualWield: boolean
}

export interface StunStats {
  readonly stunDurationFrames: number
  readonly baseDurationFrames: number
  readonly damageBonusPct: number
  readonly toHitBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly overlayName: string
}

export interface DoubleThrowStats {
  readonly damageBonusPct: number
  readonly toHitBonusPct: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly requiresDualThrowing: boolean
}

export interface LeapAttackStats {
  readonly damageBonusPct: number
  readonly knockbackRadiusSubtiles: number
  readonly toHitBonusPct: number
  readonly minDistanceYards: number
  readonly maxDistanceYards: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface ConcentrateStats {
  readonly damageBonusPct: number
  readonly defenseBonusPct: number
  readonly toHitBonusPct: number
  readonly magicConversionPct: number
  readonly isUninterruptible: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

export interface FrenzyStats {
  readonly damageBonusPct: number
  readonly toHitBonusPct: number
  readonly minRunSpeedPct: number
  readonly maxRunSpeedPct: number
  readonly minAttackSpeedPct: number
  readonly maxAttackSpeedPct: number
  readonly durationFrames: number
  readonly magicConversionPct: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly overlayName: string
  readonly requiresDualWield: boolean
}

export interface WhirlwindStats {
  readonly damageBonusPct: number
  readonly toHitBonusPct: number
  readonly attacksPerTick: number
  readonly hitFrequencyFrames: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface BerserkStats {
  readonly damageBonusPct: number
  readonly toHitBonusPct: number
  readonly magicConversionPct: number
  readonly zeroDefenseDurationFrames: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly overlayName: string
}

// --- Pure Calculation Functions ---

function dm(minVal: number, maxVal: number, slvl: number): number {
  const lvl = Math.max(1, Math.trunc(slvl))
  const factor = Math.min(100, Math.trunc((110 * lvl) / (lvl + 6)))
  const span = maxVal - minVal
  return minVal + Math.trunc((span * factor) / 100)
}

/**
 * Skill 126: Bash
 * Ground Truth:
 * - calc1: ln12 + skill('Stun'.blvl)*par8 (ln12: par1=50, par2=5, par8=5)
 * - calc2: ln34 (par3=1, par4=1) -> flat min/max physical damage
 * - toHitCalc: tohit + skill('Concentrate'.blvl)*par7 (20 base, +5/lvl, +5%*Concentrate.blvl)
 * - Knockback: 100%
 * - Mana: 2 (constant)
 */
export function calculateBashStats(
  slvl: number,
  stunBlvl = 0,
  concentrateBlvl = 0,
): BashStats {
  const lvl = Math.max(1, slvl)
  const stunPts = Math.max(0, stunBlvl)
  const concentratePts = Math.max(0, concentrateBlvl)

  const damageBonusPct = 50 + (lvl - 1) * 5 + stunPts * 5
  const flatPhysicalMin = 1 + (lvl - 1) * 1
  const flatPhysicalMax = 1 + (lvl - 1) * 1
  const toHitBonusPct = 20 + (lvl - 1) * 5 + concentratePts * 5

  return {
    damageBonusPct,
    flatPhysicalMin,
    flatPhysicalMax,
    knockbackChancePct: 100,
    toHitBonusPct,
    manaCost: 2,
    manaCost256: 512,
  }
}

/**
 * Skill 132: Leap
 * Ground Truth:
 * - calc1: dm12 (p1=4, p2=30) -> leap distance in subtiles (diminishing returns)
 * - calc2: ln34 (p3=4, p4=1) -> knockback radius in subtiles
 * - Mana: 2 (constant)
 */
export function calculateLeapStats(slvl: number, _leapAttackBlvl = 0): LeapStats {
  const lvl = Math.max(1, slvl)
  const leapDistanceSubtiles = dm(4, 30, lvl)
  const leapDistanceYards = +(leapDistanceSubtiles * (2 / 3)).toFixed(2)
  const knockbackRadiusSubtiles = 4 + (lvl - 1) * 1

  return {
    minDistanceYards: 4,
    maxDistanceYards: 20,
    leapDistanceSubtiles,
    leapDistanceYards,
    knockbackRadiusSubtiles,
    manaCost: 2,
    manaCost256: 512,
  }
}

/**
 * Skill 133: Double Swing
 * Ground Truth:
 * - calc1: skill('Bash'.blvl)*par8 (par8=10)
 * - toHit: 15, LevToHit: 5 -> 15 + (lvl - 1) * 5
 * - mana: 8, lvlmana: -1, manashift: 5 (32nds of a mana in 256ths -> 1.0 mana at slvl 1, -0.125/lvl, 0 at slvl 9+)
 */
export function calculateDoubleSwingStats(slvl: number, bashBlvl = 0): DoubleSwingStats {
  const lvl = Math.max(1, slvl)
  const bashPts = Math.max(0, bashBlvl)

  const damageBonusPct = bashPts * 10
  const toHitBonusPct = 15 + (lvl - 1) * 5

  // 1.13c mana calculation: mana = 8, lvlmana = -1, manashift = 5 (each unit = 32/256 = 0.125 mana)
  const rawManaCost256 = Math.max(0, (8 - (lvl - 1)) * 32)
  const manaCost = Math.max(0, Math.floor(rawManaCost256 / 256))

  return {
    damageBonusPct,
    attackRateBonusPct: 50,
    toHitBonusPct,
    manaCost,
    manaCost256: rawManaCost256,
    requiresDualWield: true,
  }
}

/**
 * Skill 139: Stun
 * Ground Truth:
 * - ELen=30, ELevLen1=5 (slvl 2-8), ELevLen2=5 (slvl 9-16), ELevLen3=2 (slvl 17+)
 * - calc1: skill('Bash'.blvl)*par8 (par8=8) -> +8% damage/pt
 * - ELenSymPerCalc: skill('War Cry'.blvl)*par6 (par6=5) -> +5% duration/pt, hard-capped at 250 frames (10s)
 * - toHitCalc: tohit + skill('Concentrate'.blvl)*par7 (15 base, +5/lvl, +5%*Concentrate.blvl)
 * - Mana: 2 (constant)
 */
export function calculateStunStats(
  slvl: number,
  bashBlvl = 0,
  warCryBlvl = 0,
  concentrateBlvl = 0,
): StunStats {
  const lvl = Math.max(1, Math.trunc(slvl))
  const bashPts = Math.max(0, bashBlvl)
  const warCryPts = Math.max(0, warCryBlvl)
  const concentratePts = Math.max(0, concentrateBlvl)

  let baseDurationFrames = 30
  if (lvl > 1) {
    const tier1 = Math.min(lvl, 8) - 1
    const tier2 = Math.max(0, Math.min(lvl, 16) - 8)
    const tier3 = Math.max(0, lvl - 16)
    baseDurationFrames = 30 + tier1 * 5 + tier2 * 5 + tier3 * 2
  }
  const stunDurationFrames = Math.min(
    250,
    Math.trunc((baseDurationFrames * (100 + warCryPts * 5)) / 100),
  )
  const damageBonusPct = bashPts * 8
  const toHitBonusPct = 15 + (lvl - 1) * 5 + concentratePts * 5

  return {
    stunDurationFrames,
    baseDurationFrames,
    damageBonusPct,
    toHitBonusPct,
    manaCost: 2,
    manaCost256: 512,
    overlayName: 'stun',
  }
}

/**
 * Skill 140: Double Throw
 * Ground Truth:
 * - calc1: skill('Double Swing'.blvl)*par8 (par8=8)
 * - toHit: 20, LevToHit: 10 -> 20 + (lvl - 1) * 10
 * - Mana: 1 (256 in 256ths)
 */
export function calculateDoubleThrowStats(slvl: number, doubleSwingBlvl = 0): DoubleThrowStats {
  const lvl = Math.max(1, slvl)
  const dsPts = Math.max(0, doubleSwingBlvl)

  const damageBonusPct = dsPts * 8
  const toHitBonusPct = 20 + (lvl - 1) * 10

  return {
    damageBonusPct,
    toHitBonusPct,
    manaCost: 1,
    manaCost256: 256,
    requiresDualThrowing: true,
  }
}

/**
 * Skill 143: Leap Attack
 * Ground Truth:
 * - calc1: ln34 + skill('Leap'.blvl)*par8 (p3=100, p4=30, par8=10)
 * - Knockback range: p5=4, p6=2 -> 4 + (lvl - 1) * 2 subtiles
 * - toHit: 50, LevToHit: 15 -> 50 + (lvl - 1) * 15
 * - Mana: 9 (constant)
 */
export function calculateLeapAttackStats(slvl: number, leapBlvl = 0): LeapAttackStats {
  const lvl = Math.max(1, slvl)
  const leapPts = Math.max(0, leapBlvl)

  const damageBonusPct = 100 + (lvl - 1) * 30 + leapPts * 10
  const knockbackRadiusSubtiles = 4 + (lvl - 1) * 2
  const toHitBonusPct = 50 + (lvl - 1) * 15

  return {
    damageBonusPct,
    knockbackRadiusSubtiles,
    toHitBonusPct,
    minDistanceYards: 4,
    maxDistanceYards: 30,
    manaCost: 9,
    manaCost256: 2304,
  }
}

/**
 * Skill 144: Concentrate
 * Ground Truth:
 * - calc1: ln12 + skill('Bash'.blvl)*par8 + skill('Battle Orders'.blvl)*par7
 *   (p1=70, p2=5, par8=5, par7=10)
 * - defense bonus: ln34 + skill('Iron Skin'.blvl)*par8 (p3=100, p4=10, par8=10) -> 100 + (lvl - 1) * 10 + ironSkinBlvl * 10%
 * - toHit: 60, LevToHit: 10 -> 60 + (lvl - 1) * 10
 * - calc4: skill('Berserk'.blvl) -> 1% magic conversion per point
 * - Mana: 2 (constant)
 */
export function calculateConcentrateStats(
  slvl: number,
  bashBlvl = 0,
  battleOrdersBlvl = 0,
  berserkBlvl = 0,
  ironSkinBlvl = 0,
): ConcentrateStats {
  const lvl = Math.max(1, slvl)
  const bashPts = Math.max(0, bashBlvl)
  const boPts = Math.max(0, battleOrdersBlvl)
  const berserkPts = Math.max(0, berserkBlvl)
  const ironSkinPts = Math.max(0, ironSkinBlvl)

  const damageBonusPct = 70 + (lvl - 1) * 5 + bashPts * 5 + boPts * 10
  const defenseBonusPct = 100 + (lvl - 1) * 10 + ironSkinPts * 10
  const toHitBonusPct = 60 + (lvl - 1) * 10
  const magicConversionPct = Math.min(100, berserkPts * 1)

  return {
    damageBonusPct,
    defenseBonusPct,
    toHitBonusPct,
    magicConversionPct,
    isUninterruptible: true,
    manaCost: 2,
    manaCost256: 512,
  }
}

/**
 * Skill 147: Frenzy
 * Ground Truth:
 * - calc1: ln12 + (skill('Double Swing'.blvl) + skill('Taunt'.blvl))*par8
 *   (p1=90, p2=5, par8=8)
 * - run speed (aurastatcalc1 = dm34): p3=20, p4=200 (47% at stack 1, up to dm(20, 200, slvl))
 * - attack speed (aurastatcalc2 = dm56): p5=0, p6=50 (7% at stack 1, up to dm(0, 50, slvl))
 * - duration: par7 + skill('Increased Stamina'.blvl)*10 -> 150 + increasedStaminaBlvl * 10 frames (6s + 0.4s/blvl)
 * - toHit: 100, LevToHit: 7 -> 100 + (lvl - 1) * 7
 * - calc4: skill('Berserk'.blvl) -> 1% magic conversion per point
 * - Mana: 1.5 (mana=3, manashift=7 -> 384 in 256ths)
 * - Overlay: frenzy1
 */
export function calculateFrenzyStats(
  slvl: number,
  doubleSwingBlvl = 0,
  tauntBlvl = 0,
  berserkBlvl = 0,
  increasedStaminaBlvl = 0,
): FrenzyStats {
  const lvl = Math.max(1, slvl)
  const dsPts = Math.max(0, doubleSwingBlvl)
  const tauntPts = Math.max(0, tauntBlvl)
  const berserkPts = Math.max(0, berserkBlvl)
  const incStaminaPts = Math.max(0, increasedStaminaBlvl)

  const damageBonusPct = 90 + (lvl - 1) * 5 + (dsPts + tauntPts) * 8
  const toHitBonusPct = 100 + (lvl - 1) * 7
  const minRunSpeedPct = dm(20, 200, 1)
  const maxRunSpeedPct = dm(20, 200, lvl)
  const minAttackSpeedPct = dm(0, 50, 1)
  const maxAttackSpeedPct = dm(0, 50, lvl)
  const magicConversionPct = Math.min(100, berserkPts * 1)

  return {
    damageBonusPct,
    toHitBonusPct,
    minRunSpeedPct,
    maxRunSpeedPct,
    minAttackSpeedPct,
    maxAttackSpeedPct,
    durationFrames: 150 + incStaminaPts * 10,
    magicConversionPct,
    manaCost: 1,
    manaCost256: 384,
    overlayName: 'frenzy1',
    requiresDualWield: true,
  }
}

/**
 * Skill 151: Whirlwind
 * Ground Truth:
 * - calc1: ln12 (p1=-50, p2=8) -> -50 + (lvl - 1) * 8%
 * - toHit: 0, LevToHit: 5 -> 0 + (lvl - 1) * 5
 * - Mana: mana=25, lvlmana=1, manashift=7 -> (25 + (lvl - 1)) * 128 in 256ths (12.5 + 0.5/lvl)
 * - hit frequency: initial unconditional hit checks at frames 0 and 4, then weapon speed breakpoints
 */
export function calculateWhirlwindStats(slvl: number): WhirlwindStats {
  const lvl = Math.max(1, slvl)

  const damageBonusPct = -50 + (lvl - 1) * 8
  const toHitBonusPct = 0 + (lvl - 1) * 5
  const manaCost256 = (25 + (lvl - 1)) * 128
  const manaCost = Math.floor(manaCost256 / 256)

  return {
    damageBonusPct,
    toHitBonusPct,
    attacksPerTick: 1,
    hitFrequencyFrames: 4,
    manaCost,
    manaCost256,
  }
}

/**
 * Skill 152: Berserk
 * Ground Truth:
 * - calc1: ln12 + (skill('Howl'.blvl) + skill('Shout'.blvl))*par8
 *   (p1=150, p2=15, par8=10)
 * - calc2: par4 - min(((110*lvl)/(lvl+6)*(par4-par3)/100),(par4-par3))
 *   (par4=75, par3=25) -> defense zero duration
 * - calc4: 100 -> 100% physical damage converted to Magic damage
 * - toHit: 100, LevToHit: 15 -> 100 + (lvl - 1) * 15
 * - Mana: 4 (constant)
 * - Overlay: BerserkOverlay
 */
export function calculateBerserkStats(
  slvl: number,
  howlBlvl = 0,
  shoutBlvl = 0,
): BerserkStats {
  const lvl = Math.max(1, slvl)
  const howlPts = Math.max(0, howlBlvl)
  const shoutPts = Math.max(0, shoutBlvl)

  const damageBonusPct = 150 + (lvl - 1) * 15 + (howlPts + shoutPts) * 10
  const toHitBonusPct = 100 + (lvl - 1) * 15

  // calc2: par4 - min(((110*lvl)/(lvl+6)*(par4-par3)/100),(par4-par3))
  const par4 = 75
  const par3 = 25
  const range = par4 - par3 // 50
  const reduction = Math.min(range, Math.floor(((110 * lvl) / (lvl + 6)) * (range / 100)))
  const zeroDefenseDurationFrames = par4 - reduction

  return {
    damageBonusPct,
    toHitBonusPct,
    magicConversionPct: 100,
    zeroDefenseDurationFrames,
    manaCost: 4,
    manaCost256: 1024,
    overlayName: 'berserkfront',
  }
}

/**
 * Validate 1.13c pre-cast equipment constraints for Barbarian combat skills with tri-state semantics:
 * - Bash (#126), Double Swing (#133), Stun (#139), Leap Attack (#143), Concentrate (#144), Frenzy (#147), Whirlwind (#151), Berserk (#152):
 *   require a melee weapon (fails if `weaponItemType === 'bow' || weaponItemType === 'crossbow' || isRanged === true`)
 * - Double Swing (#133) & Frenzy (#147):
 *   require dual-wielding melee weapons (fails if `hasDualWield === false || isDualWielding === false`)
 * - Double Throw (#140):
 *   requires dual throwing weapons (fails if `hasDualThrow === false`)
 * Tri-state semantics: undefined/omitted allows execution for backwards compatibility with legacy test fixtures.
 */
export function validateBarbarianSkillEquipment(
  skillId: number,
  equipment?: {
    weaponItemType?: string | undefined
    isRanged?: boolean | undefined
    hasDualWield?: boolean | undefined
    isDualWielding?: boolean | undefined
    hasDualThrow?: boolean | undefined
  },
): { valid: boolean; reason?: 'requires_melee' | 'requires_dual_wield' | 'requires_dual_throw' } {
  if (!equipment) return { valid: true }

  if (
    [126, 133, 139, 143, 144, 147, 151, 152].includes(skillId) &&
    (equipment.weaponItemType === 'bow' ||
      equipment.weaponItemType === 'crossbow' ||
      equipment.isRanged === true)
  ) {
    return { valid: false, reason: 'requires_melee' }
  }

  if (
    (skillId === 133 || skillId === 147) &&
    (equipment.hasDualWield === false || equipment.isDualWielding === false)
  ) {
    return { valid: false, reason: 'requires_dual_wield' }
  }

  if (skillId === 140 && equipment.hasDualThrow === false) {
    return { valid: false, reason: 'requires_dual_throw' }
  }

  return { valid: true }
}

/**
 * Validate 1.13c Leap (#132) and Leap Attack (#143) trajectory and destination validity:
 * Ground truth (D2Game.dll srvstfunc=40/41 & srvdofunc=77/78):
 * - When Leap Attack (#143) targets an enemy already in melee range, it does NOT fail;
 *   it skips the jump trajectory and immediately executes the ground strike in place (`meleeFallback: true`).
 * - Destination cannot be blocked or invalid room path.
 * - Distance must be within min/max leap bounds [4..30] yards (when jumping).
 */
export function validateBarbarianLeapDestination(
  skillId: number,
  params?: {
    distanceYards?: number
    isPathBlocked?: boolean
    isInMeleeRange?: boolean
  },
): {
  valid: boolean
  meleeFallback?: boolean
  reason?: 'path_blocked' | 'in_melee_range' | 'out_of_range'
} {
  if (!params) return { valid: true }
  if (params.isPathBlocked) return { valid: false, reason: 'path_blocked' }
  if (params.isInMeleeRange) {
    if (skillId === 143) {
      return { valid: true, meleeFallback: true }
    }
    return { valid: false, reason: 'in_melee_range' }
  }
  if (
    params.distanceYards !== undefined &&
    (params.distanceYards < 4 || params.distanceYards > 30)
  ) {
    return { valid: false, reason: 'out_of_range' }
  }
  return { valid: true }
}

/**
 * Authentic 1.13c Whirlwind Frame Progression (`D2Game.dll` SKILLS_GetWhirlwindFrame @ 0x6FC48A20):
 * - First two hit checks occur unconditionally at frames 0 and 4 (irrespective of weapon speed).
 * - Subsequent hit checks occur at intervals determined by `Weapon IAS - WSM`:
 *   - 1H Weapons & 2H Swords:
 *     >= 34 -> 4f, >= 10 -> 6f, >= -15 -> 8f, >= -34 -> 10f, >= -59 -> 12f, >= -85 -> 14f, < -85 -> 16f
 *   - 2H Non-Sword Weapons:
 *     >= 60 -> 4f, >= 35 -> 6f, >= 15 -> 8f, >= 0 -> 10f, >= -15 -> 12f, >= -35 -> 14f, < -35 -> 16f
 * - Off-weapon IAS does NOT affect Whirlwind hit check intervals.
 */
export function calculateWhirlwindHitFrames(
  totalFrames: number,
  weaponIas = 0,
  weaponBaseSpeed = 0,
  isDualWield = false,
  isTwoHandedNonSword = false,
): { hitFrames: number[]; hitInterval: number; isDualWield: boolean } {
  const frames = Math.max(0, totalFrames)
  const effIas = weaponIas - weaponBaseSpeed
  let hitInterval = 4
  if (isTwoHandedNonSword) {
    if (effIas >= 60) hitInterval = 4
    else if (effIas >= 35) hitInterval = 6
    else if (effIas >= 15) hitInterval = 8
    else if (effIas >= 0) hitInterval = 10
    else if (effIas >= -15) hitInterval = 12
    else if (effIas >= -35) hitInterval = 14
    else hitInterval = 16
  } else {
    if (effIas >= 34) hitInterval = 4
    else if (effIas >= 10) hitInterval = 6
    else if (effIas >= -15) hitInterval = 8
    else if (effIas >= -34) hitInterval = 10
    else if (effIas >= -59) hitInterval = 12
    else if (effIas >= -85) hitInterval = 14
    else hitInterval = 16
  }

  const hitFrames: number[] = [0]
  if (frames >= 4) hitFrames.push(4)

  let nextFrame = 4 + hitInterval
  while (nextFrame <= frames) {
    hitFrames.push(nextFrame)
    nextFrame += hitInterval
  }

  return {
    hitFrames,
    hitInterval,
    isDualWield,
  }
}

/**
 * Authentic 1.13c Frenzy Momentum Stacking Kinematics (`D2Game.dll` srvdofunc=9):
 * - Each successful hit increments the internal Frenzy counter `nValue` by +1, capped at `slvl`.
 * - Run/Walk velocity bonus (`stat 67`) = `dm(20, 200, nValue)` (47% at nValue=1, up to dm(20, 200, slvl))
 * - Attack rate bonus (`stat 68`) = `dm(0, 50, nValue)` (7% at nValue=1, up to dm(0, 50, slvl))
 * - Buff duration is `150 + 10 * blvl(Increased Stamina)` frames (6.0s + 0.4s/pt), refreshed on hit.
 */
export function calculateFrenzyStackState(
  currentStacks: number,
  successfulHits: number,
  slvl: number,
  lastHitFrame: number,
  currentFrame: number,
  increasedStaminaBlvl = 0,
): {
  activeStacks: number
  isExpired: boolean
  remainingFrames: number
  currentRunSpeedBonusPct: number
  currentAttackSpeedBonusPct: number
} {
  const lvl = Math.max(1, Math.trunc(slvl))
  const stats = calculateFrenzyStats(lvl, 0, 0, 0, increasedStaminaBlvl)
  const elapsed = currentFrame - lastHitFrame
  if (elapsed >= stats.durationFrames) {
    return {
      activeStacks: 0,
      isExpired: true,
      remainingFrames: 0,
      currentRunSpeedBonusPct: 0,
      currentAttackSpeedBonusPct: 0,
    }
  }

  const newStacks = Math.min(lvl, Math.max(0, currentStacks) + Math.max(0, successfulHits))
  const currentRunSpeedBonusPct = newStacks > 0 ? dm(20, 200, newStacks) : 0
  const currentAttackSpeedBonusPct = newStacks > 0 ? dm(0, 50, newStacks) : 0

  return {
    activeStacks: newStacks,
    isExpired: false,
    remainingFrames: stats.durationFrames - elapsed,
    currentRunSpeedBonusPct,
    currentAttackSpeedBonusPct,
  }
}

