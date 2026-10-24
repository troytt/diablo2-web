/**
 * Diablo II Combat Mathematics & Formulas.
 *
 * Implements canonical combat mathematics according to D2MOO, Diablo II 1.10–1.14c
 * game logic, and authoritative community documentation (The Phrozen Keep, The Amazon Basin, Arreat Summit):
 *
 * 1. Attack Rating (AR) vs Defense Rating (DR/AC) to-hit formula with:
 *    - Ignore Target's Defense (ITD) - only works on normal monsters, fails on bosses/champions/players.
 *    - -% Target Defense - 100% on normal monsters, halved (50% effectiveness) against bosses/champions.
 *    - Running defender defense penalty (DR = 0 when running).
 *    - Clamped to [5%, 95%].
 * 2. Shield blocking formula with Dexterity and Character Level scaling:
 *    - Capped at 75% while standing/walking/attacking.
 *    - Reduced to 1/3 and capped at 25% while running.
 * 3. Two distinct Critical Strike types:
 *    - Critical Strike (CS) from skills (Amazon/Barbarian/Assassin).
 *    - Deadly Strike (DS) from equipment.
 *    - Mutually exclusive sequential roll (CS first, then DS; no 4x damage; physical damage only).
 * 4. Crushing Blow (CB):
 *    - Normal Monster: 25% (melee) / 12.5% (ranged) current HP.
 *    - Boss / Champion / Super Unique: 12.5% (melee) / 6.25% (ranged) current HP.
 *    - Player / Merc: 10% (melee) / 5% (ranged) current HP.
 *    - Physical resistance interaction: reduced by 0%–99% DR; immune at >=100% DR;
 *      NOT amplified by negative DR (multiplier capped at 1.0).
 * 5. Open Wounds (OW):
 *    - Fixed 200 frames (8.0 seconds at 25 fps).
 *    - Level-dependent 1/256th bit rate across 5 level brackets (1–15, 16–30, 31–45, 46–60, 61–99).
 *    - Bosses/Super Uniques take 50% damage; players take 25% (melee) / 12.5% (ranged).
 *    - Disables natural monster life regeneration while bleeding.
 * 6. Life & Mana Steal (Leech):
 *    - Applied only to final physical damage.
 *    - Subject to target's Drain Effectiveness (e.g. Skeletons/Hell Mephisto = 0%).
 *    - Subject to game difficulty penalty (Normal 100%, Nightmare 50%, Hell 33.3%).
 * 7. Control effects:
 *    - Freezes Target +X (with level difference, boss chill fallback, difficulty duration reduction).
 *    - Knockback (size and boss immunity).
 * 8. Canonical Damage Mitigation Sequence:
 *    - Flat DR/MDR -> Percentage Resistance (%DR & Resists) -> Absorb.
 * 9. Hit Recovery (FHR) trigger based on net damage vs Max HP thresholds.
 * 10. Canonical 99-level experience progression table.
 */

import { D2Rng } from '../rng/d2-rng.ts'

const fallbackFormulaRng = new D2Rng(0x13579bdf)
const defaultFormulaRandomFn = (): number => fallbackFormulaRng.next()

export type TargetTier = 'normal' | 'boss' | 'player'
export type GameDifficulty = 'normal' | 'nightmare' | 'hell'

/**
 * Options for To-Hit Chance calculation.
 */
export interface HitChanceOptions {
  /** Ignore Target's Defense (ITD) affix (e.g. from Jah rune, Lightsaber). */
  readonly ignoreTargetDefense?: boolean | undefined
  /** -X% Target's Defense (e.g. Eth rune -25%, Conviction). */
  readonly targetDefenseReductionPercent?: number | undefined
  /** Whether the defender is currently running (sets defender DR to 0). */
  readonly isTargetRunning?: boolean | undefined
  /** Whether the defender is a boss, champion, unique, or player. */
  readonly isBossOrChampion?: boolean | undefined
}

/**
 * 1. To-Hit Chance (Attack Rating vs Defense Rating).
 *
 * Canonical formula:
 *   Chance = clamp(5%, 95%, 100% * (2 * AR / (AR + EffectiveDR)) * (AttackerLevel / (AttackerLevel + DefenderLevel)))
 *
 * Modifiers:
 * - Running: Effective DR = 0.
 * - ITD: Effective DR = 0 if defender is normal monster; fails on bosses/champions/players.
 * - -% Target Defense: Effective on normal monsters; 50% effectiveness against bosses/champions.
 *
 * @param attackerAr - Attacker's Attack Rating (AR).
 * @param defenderDr - Defender's Defense Rating (DR / AC).
 * @param attackerLevel - Attacker's level.
 * @param defenderLevel - Defender's level.
 * @param options - Defensive reduction and posture options.
 * @returns To-hit probability in percentage [5, 95].
 */
export function calculateHitChance(
  attackerAr: number,
  defenderDr: number,
  attackerLevel: number,
  defenderLevel: number,
  options: HitChanceOptions = {},
): number {
  const ar = Math.max(0, attackerAr)
  let dr = Math.max(0, defenderDr)
  const attLvl = Math.max(1, attackerLevel)
  const defLvl = Math.max(1, defenderLevel)

  if (options.isTargetRunning) {
    dr = 0
  } else if (options.ignoreTargetDefense && !options.isBossOrChampion) {
    dr = 0
  } else if (options.targetDefenseReductionPercent && options.targetDefenseReductionPercent > 0) {
    const factor = options.isBossOrChampion
      ? options.targetDefenseReductionPercent / 2
      : options.targetDefenseReductionPercent
    dr = Math.max(0, dr * (1 - factor / 100))
  }

  if (ar + dr <= 0) return 5

  const arFactor = (2 * ar) / (ar + dr)
  const lvlFactor = attLvl / (attLvl + defLvl)
  const rawChance = 100 * arFactor * lvlFactor

  return Math.max(5, Math.min(95, Math.round(rawChance * 100) / 100))
}

/**
 * 2. Player Shield Blocking Chance.
 *
 * Canonical formula:
 *   Total Block % = min(75%, floor(BaseBlock * (Dexterity - 15) / (2 * CharacterLevel)))
 *
 * When running, block chance is reduced to 1/3 and capped at 25%.
 *
 * @param baseBlock - Shield's base block chance + item bonuses.
 * @param dexterity - Character's total Dexterity.
 * @param characterLevel - Character level (1–99).
 * @param isRunning - Whether the character is currently running.
 * @returns Block chance in percentage [0, 75] (or [0, 25] if running).
 */
export function calculatePlayerBlockChance(
  baseBlock: number,
  dexterity: number,
  characterLevel: number,
  isRunning = false,
): number {
  if (baseBlock <= 0 || dexterity <= 15 || characterLevel <= 0) return 0
  const rawBlock = Math.floor((baseBlock * (dexterity - 15)) / (2 * characterLevel))
  if (isRunning) {
    return Math.max(0, Math.min(25, Math.floor(rawBlock / 3)))
  }
  return Math.max(0, Math.min(75, rawBlock))
}

/**
 * 3. Combined Critical Strike / Deadly Strike chance.
 *
 * In D2:
 * Critical Strike (CS) and Deadly Strike (DS) each double physical damage,
 * but cannot proc simultaneously to quadruple damage.
 * Combined probability:
 *   P = CS + DS * (1 - CS)
 *
 * @param criticalStrikePercent - Critical Strike % from skills [0, 100].
 * @param deadlyStrikePercent - Deadly Strike % from equipment [0, 100].
 * @returns Combined double-damage probability % [0, 100].
 */
export function calculateCriticalChance(
  criticalStrikePercent: number,
  deadlyStrikePercent: number,
): number {
  const cs = Math.max(0, Math.min(100, criticalStrikePercent)) / 100
  const ds = Math.max(0, Math.min(100, deadlyStrikePercent)) / 100
  const combined = cs + ds * (1 - cs)
  return Math.round(combined * 10000) / 100
}

/**
 * Detailed outcome of sequential CS/DS evaluation.
 */
export interface CriticalEvaluationResult {
  readonly isCritical: boolean
  readonly triggeredBy: 'none' | 'critical_strike' | 'deadly_strike'
  readonly csRoll: number
  readonly dsRoll: number
  readonly combinedChancePercent: number
}

/**
 * Evaluates Critical Strike (skill) and Deadly Strike (item) in strict canonical sequence:
 * Roll CS first; if it fails, roll DS. If either procs, physical damage is doubled.
 *
 * @param criticalStrikePercent - Critical Strike % from skills.
 * @param deadlyStrikePercent - Deadly Strike % from equipment.
 * @param randomFn - Random generator returning [0, 1).
 */
export function evaluateCriticalAndDeadlyStrike(
  criticalStrikePercent: number,
  deadlyStrikePercent: number,
  randomFn: () => number = defaultFormulaRandomFn,
): CriticalEvaluationResult {
  const cs = Math.max(0, Math.min(100, criticalStrikePercent))
  const ds = Math.max(0, Math.min(100, deadlyStrikePercent))
  const combinedChancePercent = calculateCriticalChance(cs, ds)

  const csRoll = Math.round(randomFn() * 10000) / 100
  if (cs > 0 && csRoll < cs) {
    return {
      isCritical: true,
      triggeredBy: 'critical_strike',
      csRoll,
      dsRoll: 0,
      combinedChancePercent,
    }
  }

  const dsRoll = Math.round(randomFn() * 10000) / 100
  if (ds > 0 && dsRoll < ds) {
    return {
      isCritical: true,
      triggeredBy: 'deadly_strike',
      csRoll,
      dsRoll,
      combinedChancePercent,
    }
  }

  return {
    isCritical: false,
    triggeredBy: 'none',
    csRoll,
    dsRoll,
    combinedChancePercent,
  }
}

/**
 * 4. Crushing Blow Damage.
 *
 * Base ratio of current HP truncated:
 * - Normal Monster: Melee 25% (1/4), Ranged 12.5% (1/8).
 * - Boss / Champion / Super Unique: Melee 12.5% (1/8), Ranged 6.25% (1/16).
 * - Player / Mercenary: Melee 10% (1/10), Ranged 5% (1/20).
 *
 * Physical Resistance (DR%) Interaction:
 * - If Physical Resistance >= 100% (Physical Immune): CB deals 0 damage.
 * - If Physical Resistance is in [0%, 99%]: CB damage is reduced by DR%.
 * - If Physical Resistance < 0%: CB damage is NOT amplified (factor capped at 1.0).
 * - Flat DR does NOT reduce CB.
 *
 * @param currentHp - Target's current HP before attack.
 * @param targetTierOrBoss - Target classification ('normal', 'boss', 'player', or boolean for backwards-compatibility).
 * @param isRanged - Whether the attack is ranged.
 * @param targetPhysicalResistance - Target's physical resistance % (DR%).
 * @returns Final Crushing Blow damage applied to HP.
 */
export function calculateCrushingBlowDamage(
  currentHp: number,
  targetTierOrBoss: boolean | TargetTier = false,
  isRanged = false,
  targetPhysicalResistance = 0,
): number {
  if (currentHp <= 0) return 0
  if (targetPhysicalResistance >= 100) return 0

  let ratio = 0.25
  const isPlayer = targetTierOrBoss === 'player'
  const isBoss = targetTierOrBoss === true || targetTierOrBoss === 'boss'

  if (isPlayer) {
    ratio = isRanged ? 0.05 : 0.10
  } else if (isBoss) {
    ratio = isRanged ? 0.0625 : 0.125
  } else {
    ratio = isRanged ? 0.125 : 0.25
  }

  const baseDmg = Math.floor(currentHp * ratio)
  const resFactor = targetPhysicalResistance > 0
    ? Math.max(0, (100 - targetPhysicalResistance) / 100)
    : 1.0

  return Math.floor(baseDmg * resFactor)
}

/**
 * 5. Open Wounds (OW) Damage.
 *
 * Canonical 1.10+ formula:
 * Lasts 200 frames (8.0 seconds at 25 fps).
 * Life drain per frame in 1/256th point units based on attacker level (Clvl):
 *   Clvl 1–15:   (9 * Clvl + 31)
 *   Clvl 16–30:  (18 * Clvl - 104)
 *   Clvl 31–45:  (27 * Clvl - 374)
 *   Clvl 46–60:  (36 * Clvl - 779)
 *   Clvl >60:    (45 * Clvl - 1319)
 *
 * Modifiers:
 * - Boss / Champion / Super Unique: 1/2 (x0.5) for both melee and ranged.
 * - Player: 1/4 (x0.25) for melee, 1/8 (x0.125) for ranged.
 * - Normal monster: unmodified (x1.0).
 *
 * Crucial property: Disables natural monster life regeneration while active.
 */
export interface OpenWoundsDamageResult {
  readonly attackerLevel: number
  readonly lifeDrainPerFrame: number // in 1/256th point units
  readonly damagePerFrame: number // actual HP per frame
  readonly damagePerSecond: number // 25 fps
  readonly totalDamage200Frames: number
  readonly durationFrames: number // 200
  readonly durationSeconds: number // 8.0
  readonly modifierFactor: number
  readonly isBoss: boolean
  readonly isPlayer: boolean
}

export function calculateOpenWoundsDamage(
  attackerLevel: number,
  targetTierOrBoss: boolean | TargetTier = 'normal',
  isRanged = false,
): OpenWoundsDamageResult {
  const lvl = Math.max(1, Math.min(99, Math.floor(attackerLevel)))

  let basePerFrame = 0
  if (lvl <= 15) {
    basePerFrame = 9 * lvl + 31
  } else if (lvl <= 30) {
    basePerFrame = 18 * lvl - 104
  } else if (lvl <= 45) {
    basePerFrame = 27 * lvl - 374
  } else if (lvl <= 60) {
    basePerFrame = 36 * lvl - 779
  } else {
    basePerFrame = 45 * lvl - 1319
  }

  let modifierFactor = 1.0
  const isBoss = targetTierOrBoss === true || targetTierOrBoss === 'boss'
  const isPlayer = targetTierOrBoss === 'player'

  if (isBoss) {
    modifierFactor = 0.5
  } else if (isPlayer) {
    modifierFactor = isRanged ? 0.125 : 0.25
  }

  const damagePerFrame = (basePerFrame * modifierFactor) / 256
  const damagePerSecond = Math.round(damagePerFrame * 25 * 100) / 100
  const totalDamage200Frames = Math.floor(damagePerFrame * 200)

  return {
    attackerLevel: lvl,
    lifeDrainPerFrame: basePerFrame,
    damagePerFrame,
    damagePerSecond,
    totalDamage200Frames,
    durationFrames: 200,
    durationSeconds: 8.0,
    modifierFactor,
    isBoss,
    isPlayer,
  }
}

/**
 * 6. Life & Mana Steal (Leech).
 *
 * Rules:
 * - Only applies to the final physical damage dealt to the target.
 * - Multiplied by target's Drain Effectiveness (from MonStats.txt, 0% to 100%).
 * - Multiplied by game difficulty penalty:
 *     Normal: 100% (x1.0)
 *     Nightmare: 50% (x0.5)
 *     Hell: 33.3% (x1/3)
 */
export interface LeechResult {
  readonly lifeLeeched: number
  readonly manaLeeched: number
  readonly difficultyPenaltyFactor: number
  readonly drainEffectivenessFactor: number
  readonly rawLifeAttempted: number
  readonly rawManaAttempted: number
}

export function calculateLeech(
  finalPhysicalDamage: number,
  lifeLeechPercent: number,
  manaLeechPercent: number,
  drainEffectivenessPercent = 100,
  difficulty: GameDifficulty = 'normal',
): LeechResult {
  if (finalPhysicalDamage <= 0) {
    return {
      lifeLeeched: 0,
      manaLeeched: 0,
      difficultyPenaltyFactor: 1.0,
      drainEffectivenessFactor: Math.max(0, drainEffectivenessPercent) / 100,
      rawLifeAttempted: 0,
      rawManaAttempted: 0,
    }
  }

  let diffPenalty = 1.0
  if (difficulty === 'nightmare') {
    diffPenalty = 0.5
  } else if (difficulty === 'hell') {
    diffPenalty = 1 / 3
  }

  const drainFactor = Math.max(0, drainEffectivenessPercent) / 100
  const rawLife = finalPhysicalDamage * (Math.max(0, lifeLeechPercent) / 100)
  const rawMana = finalPhysicalDamage * (Math.max(0, manaLeechPercent) / 100)

  const lifeLeeched = Math.floor(rawLife * drainFactor * diffPenalty)
  const manaLeeched = Math.floor(rawMana * drainFactor * diffPenalty)

  return {
    lifeLeeched,
    manaLeeched,
    difficultyPenaltyFactor: diffPenalty,
    drainEffectivenessFactor: drainFactor,
    rawLifeAttempted: Math.round(rawLife * 10) / 10,
    rawManaAttempted: Math.round(rawMana * 10) / 10,
  }
}

/**
 * 7. Freezes Target +X calculation.
 *
 * Canonical formulas:
 * Melee: Chance = clamp(0, 100, 5 * (4 * B + AttackerLevel - DefenderLevel) + 30)
 * Ranged: Chance = clamp(0, 100, 5 * (4 * B + (AttackerLevel - 6) - DefenderLevel) / 3)
 *
 * Target rules:
 * - Bosses, Champions, Super Uniques and Players cannot be frozen; they are chilled instead.
 * - Duration = (Chance - Roll) * 2 + 25 frames [clamped 25, 250 frames].
 * - Duration is halved in Nightmare, quartered in Hell.
 */
export interface FreezeTargetResult {
  readonly chancePercent: number
  readonly roll: number
  readonly willFreeze: boolean
  readonly isChilledOnly: boolean
  readonly durationFrames: number
  readonly durationSeconds: number
}

export function calculateFreezeTarget(
  freezeBonus: number,
  attackerLevel: number,
  defenderLevel: number,
  targetTierOrBoss: boolean | TargetTier = 'normal',
  isRanged = false,
  difficulty: GameDifficulty = 'normal',
  randomFn: () => number = defaultFormulaRandomFn,
): FreezeTargetResult {
  if (freezeBonus <= 0) {
    return {
      chancePercent: 0,
      roll: 0,
      willFreeze: false,
      isChilledOnly: false,
      durationFrames: 0,
      durationSeconds: 0,
    }
  }

  const B = freezeBonus
  const al = attackerLevel
  const dl = defenderLevel

  let rawChance = 0
  if (!isRanged) {
    rawChance = 5 * (4 * B + al - dl) + 30
  } else {
    rawChance = (5 * (4 * B + (al - 6) - dl)) / 3
  }

  const chancePercent = Math.max(0, Math.min(100, Math.round(rawChance * 10) / 10))
  const roll = Math.round(randomFn() * 10000) / 100
  const success = roll < chancePercent

  if (!success) {
    return {
      chancePercent,
      roll,
      willFreeze: false,
      isChilledOnly: false,
      durationFrames: 0,
      durationSeconds: 0,
    }
  }

  const isBossOrPlayer = targetTierOrBoss === true || targetTierOrBoss === 'boss' || targetTierOrBoss === 'player'
  if (isBossOrPlayer) {
    return {
      chancePercent,
      roll,
      willFreeze: false,
      isChilledOnly: true,
      durationFrames: 75,
      durationSeconds: 3.0,
    }
  }

  let duration = Math.min(250, Math.max(25, Math.floor((chancePercent - roll) * 2 + 25)))
  if (difficulty === 'nightmare') {
    duration = Math.floor(duration / 2)
  } else if (difficulty === 'hell') {
    duration = Math.floor(duration / 4)
  }

  return {
    chancePercent,
    roll,
    willFreeze: true,
    isChilledOnly: false,
    durationFrames: duration,
    durationSeconds: Math.round((duration / 25) * 10) / 10,
  }
}

/**
 * 8. Resistance Damage Multiplier.
 *
 * In D2:
 * - Resistance >= 100% means Immune (0 damage).
 * - Resistance between 0% and 99% reduces damage: Damage * (1 - Res / 100).
 * - Resistance < 0% amplifies damage: Damage * (1 + |Res| / 100), capped at -100% (2x damage).
 *
 * @param resistancePercent - Target's resistance percentage.
 * @returns Multiplier factor (0 for immune, >1 for negative resistance) and immunity flag.
 */
export function calculateResistanceFactor(resistancePercent: number): {
  readonly factor: number
  readonly isImmune: boolean
} {
  if (resistancePercent >= 100) {
    return { factor: 0, isImmune: true }
  }
  const clampedRes = Math.max(-100, resistancePercent)
  const factor = (100 - clampedRes) / 100
  return { factor, isImmune: false }
}

/**
 * 8b. Resistance Reduction & 1/5th Rule for Breaking Immunities.
 *
 * Canonical Diablo II 1.10+ rules:
 * - If target's initial resistance >= 100% (Immune):
 *   - Conviction Aura and Lower Resist Curse have their effectiveness reduced to 1/5th (20%).
 *   - In integer arithmetic: floor(Penalty / 5).
 *   - If (InitialRes - EffectiveConviction - EffectiveLowerRes) >= 100%:
 *     - Immunity is NOT broken.
 *     - Direct equipment reduction (-% Enemy Resistance, e.g. Rainbow Facet, Griffon's Eye) CANNOT apply!
 *     - Target remains immune (0 damage).
 *   - If (InitialRes - EffectiveConviction - EffectiveLowerRes) < 100%:
 *     - Immunity IS BROKEN!
 *     - Direct equipment reduction (-% Enemy Resistance) now applies at 100% FULL effectiveness!
 * - If target's initial resistance < 100% (Non-Immune):
 *   - Conviction, Lower Resist, and equipment reduction all apply at 100% full strength.
 *   - Resistance is capped at a lower bound of -100% (2x damage multiplier).
 */
export interface ResistanceReductionResult {
  readonly initialRes: number
  readonly wasImmune: boolean
  readonly isImmune: boolean
  readonly immunityBroken: boolean
  readonly convictionPenalty: number
  readonly effectiveConviction: number
  readonly lowerResPenalty: number
  readonly effectiveLowerRes: number
  readonly itemMinusRes: number
  readonly effectiveItemMinusRes: number
  readonly resAfterSkills: number
  readonly finalRes: number
  readonly damageMultiplier: number
}

export function calculateResistanceReduction(
  enemyRes: number,
  convictionPenalty = 0,
  lowerResPenalty = 0,
  itemMinusRes = 0,
): ResistanceReductionResult {
  const initialRes = enemyRes
  const wasImmune = initialRes >= 100

  let effectiveConviction = Math.max(0, convictionPenalty)
  let effectiveLowerRes = Math.max(0, lowerResPenalty)

  if (wasImmune) {
    // 1/5th Rule: skills only have 20% effectiveness against immune monsters
    effectiveConviction = Math.floor(effectiveConviction / 5)
    effectiveLowerRes = Math.floor(effectiveLowerRes / 5)
  }

  const resAfterSkills = initialRes - (effectiveConviction + effectiveLowerRes)
  const immunityBroken = wasImmune && resAfterSkills < 100

  let effectiveItemMinusRes = 0
  let isImmune = false
  let finalRes = resAfterSkills

  if (resAfterSkills >= 100) {
    // Immunity persists: equipment -% enemy resistance fails completely
    isImmune = true
    effectiveItemMinusRes = 0
    finalRes = resAfterSkills
  } else {
    // Non-immune or broken immunity: equipment -% resistance applies at 100% full effect
    isImmune = false
    effectiveItemMinusRes = Math.max(0, itemMinusRes)
    finalRes = Math.max(-100, resAfterSkills - effectiveItemMinusRes)
  }

  const damageMultiplier = isImmune ? 0 : Math.round(((100 - finalRes) / 100) * 10000) / 10000

  return {
    initialRes,
    wasImmune,
    isImmune,
    immunityBroken,
    convictionPenalty: Math.max(0, convictionPenalty),
    effectiveConviction,
    lowerResPenalty: Math.max(0, lowerResPenalty),
    effectiveLowerRes,
    itemMinusRes: Math.max(0, itemMinusRes),
    effectiveItemMinusRes,
    resAfterSkills,
    finalRes,
    damageMultiplier,
  }
}

/**
 * 8c. Monster Life Regeneration & Prevent Monster Heal (PMH).
 *
 * Canonical D2 mechanics:
 * - Natural regeneration per frame:
 *     Regen/frame = (MaxHP * RegenRate) / 4096
 *   (RegenRate is from MonStats.txt, typically 1 to 50).
 * - At 25 fps:
 *     Regen/sec = (MaxHP * RegenRate * 25) / 4096
 * - Natural regeneration is completely suppressed to 0 if:
 *   - Target is under Open Wounds (OW) bleeding (lasts 200 frames / 8 seconds).
 *   - Target is inflicted with Prevent Monster Heal (PMH) (lasts 120,000 frames / 80 minutes).
 */
export interface MonsterRegenResult {
  readonly maxHp: number
  readonly regenRate: number
  readonly rawRegenPerFrame: number
  readonly rawRegenPerSecond: number
  readonly effectiveRegenPerFrame: number
  readonly effectiveRegenPerSecond: number
  readonly isBlockedByOW: boolean
  readonly isBlockedByPMH: boolean
}

export function calculateMonsterRegeneration(
  maxHp: number,
  regenRate: number,
  hasOW = false,
  hasPMH = false,
): MonsterRegenResult {
  const hp = Math.max(0, maxHp)
  const rate = Math.max(0, regenRate)

  const rawRegenPerFrame = (hp * rate) / 4096
  const rawRegenPerSecond = Math.round(rawRegenPerFrame * 25 * 100) / 100

  const isBlocked = hasOW || hasPMH
  const effectiveRegenPerFrame = isBlocked ? 0 : rawRegenPerFrame
  const effectiveRegenPerSecond = isBlocked ? 0 : rawRegenPerSecond

  return {
    maxHp: hp,
    regenRate: rate,
    rawRegenPerFrame,
    rawRegenPerSecond,
    effectiveRegenPerFrame,
    effectiveRegenPerSecond,
    isBlockedByOW: hasOW,
    isBlockedByPMH: hasPMH,
  }
}

export interface PreventMonsterHealEvaluation {
  readonly applied: boolean
  readonly durationFrames: number // 120,000 frames = 4800s = 80min
  readonly durationSeconds: number
  readonly reason: string
}

export function evaluatePreventMonsterHeal(
  attackerType: 'player' | 'mercenary' | 'minion' = 'player',
  targetTierOrUber: 'normal' | 'champion' | 'boss' | 'uber' = 'normal',
): PreventMonsterHealEvaluation {
  if (attackerType !== 'player') {
    return {
      applied: false,
      durationFrames: 0,
      durationSeconds: 0,
      reason: 'PMH 仅能由玩家本体近战或远程攻击命中触发 (雇佣兵与仆从佩戴无效)',
    }
  }

  if (targetTierOrUber === 'uber') {
    return {
      applied: false,
      durationFrames: 0,
      durationSeconds: 0,
      reason: '超级地狱火炬 Boss (Pandemonium Ubers) 免疫阻止怪物自愈 (PMH)',
    }
  }

  return {
    applied: true,
    durationFrames: 120000,
    durationSeconds: 4800,
    reason: '阻止怪物自愈 (PMH) 命中生效，持续 120,000 帧 (80 分钟)',
  }
}

/**
 * 8d. Knockback vs Monster Size & Boss Immunity.
 *
 * Canonical D2 rules:
 * - Bosses (Andariel, Duriel, Mephisto, Diablo, Baal, etc.) and Siege Beasts:
 *   100% IMMUNE to knockback (0% chance).
 * - Non-bosses with Knockback affix:
 *   - Melee: Small 100%, Medium 50%, Large 25%.
 *   - Ranged: Small 50%, Medium 25%, Large 12.5%.
 */
export type MonsterSize = 'small' | 'medium' | 'large'

export interface KnockbackEvaluationResult {
  readonly hasKnockbackAffix: boolean
  readonly isBossOrImmune: boolean
  readonly size: MonsterSize
  readonly isRanged: boolean
  readonly baseSizeChancePercent: number
  readonly finalChancePercent: number
  readonly roll: number
  readonly triggered: boolean
  readonly reason: string
}

export function calculateKnockbackSuccess(
  hasKnockback: boolean,
  defenderSize: MonsterSize = 'medium',
  isBossOrImmune = false,
  isRanged = false,
  randomFn: () => number = defaultFormulaRandomFn,
): KnockbackEvaluationResult {
  if (!hasKnockback) {
    return {
      hasKnockbackAffix: false,
      isBossOrImmune,
      size: defenderSize,
      isRanged,
      baseSizeChancePercent: 0,
      finalChancePercent: 0,
      roll: 0,
      triggered: false,
      reason: '攻击未附带击退词缀',
    }
  }

  if (isBossOrImmune) {
    return {
      hasKnockbackAffix: true,
      isBossOrImmune: true,
      size: defenderSize,
      isRanged,
      baseSizeChancePercent: 0,
      finalChancePercent: 0,
      roll: 0,
      triggered: false,
      reason: '关底首领 (Boss) 与攻城巨兽完全豁免击退效果',
    }
  }

  let baseChance = 50
  if (defenderSize === 'small') {
    baseChance = isRanged ? 50 : 100
  } else if (defenderSize === 'medium') {
    baseChance = isRanged ? 25 : 50
  } else {
    baseChance = isRanged ? 12.5 : 25
  }

  const roll = Math.round(randomFn() * 10000) / 100
  const triggered = roll < baseChance

  return {
    hasKnockbackAffix: true,
    isBossOrImmune: false,
    size: defenderSize,
    isRanged,
    baseSizeChancePercent: baseChance,
    finalChancePercent: baseChance,
    roll,
    triggered,
    reason: triggered
      ? `体型 ${defenderSize} (${baseChance}%几率) 击退成功 (掷骰 ${roll.toFixed(1)}%)`
      : `体型 ${defenderSize} (${baseChance}%几率) 掷骰未触发击退 (掷骰 ${roll.toFixed(1)}%)`,
  }
}

/**
 * 8e. Slows Target by X% (减速目标).
 *
 * Rules:
 * - Normal monsters: capped at 90%.
 * - Bosses / Champions / Super Uniques: capped at 50%.
 * - Stacks with Holy Freeze / Cold chill up to caps.
 */
export interface SlowTargetResult {
  readonly requestedSlowPercent: number
  readonly isBoss: boolean
  readonly maxCapPercent: number
  readonly effectiveSlowPercent: number
  readonly reason: string
}

export function calculateSlowTarget(
  requestedSlowPercent: number,
  isBoss = false,
): SlowTargetResult {
  const req = Math.max(0, requestedSlowPercent)
  const maxCapPercent = isBoss ? 50 : 90
  const effectiveSlowPercent = Math.min(maxCapPercent, req)

  const reason = isBoss && req > 50
    ? `首领/精英减速上限封顶为 50% (原请求 ${req}%)`
    : `减速目标生效: ${effectiveSlowPercent}%`

  return {
    requestedSlowPercent: req,
    isBoss,
    maxCapPercent,
    effectiveSlowPercent,
    reason,
  }
}

/**
 * 8f. Crowd Control: Hit Blinds Target (HBT) & Hit Causes Monster to Flee (HCMTF).
 *
 * Hit Blinds Target:
 * - Melee: Chance = clamp(1, 100, 50 + (AttackerLevel + Bonus * 4 - TargetLevel) * 2)
 * - Ranged: Chance = clamp(1, 100, (50 + (AttackerLevel + Bonus * 4 - TargetLevel) * 2) / 3)
 * - Bosses / Champions / Uniques are IMMUNE.
 * - Duration: (Bonus * 4 + 4) seconds.
 *
 * Hit Causes Monster to Flee:
 * - Fixed 125 frames (5.0 seconds).
 * - Bosses and Champions are IMMUNE.
 */
export interface HitBlindsTargetResult {
  readonly bonus: number
  readonly attackerLevel: number
  readonly targetLevel: number
  readonly isBossOrChampion: boolean
  readonly isRanged: boolean
  readonly chancePercent: number
  readonly roll: number
  readonly triggered: boolean
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly reason: string
}

export function calculateHitBlindsTarget(
  bonus: number,
  attackerLevel: number,
  targetLevel: number,
  isBossOrChampion = false,
  isRanged = false,
  randomFn: () => number = defaultFormulaRandomFn,
): HitBlindsTargetResult {
  if (bonus <= 0) {
    return {
      bonus: 0,
      attackerLevel,
      targetLevel,
      isBossOrChampion,
      isRanged,
      chancePercent: 0,
      roll: 0,
      triggered: false,
      durationFrames: 0,
      durationSeconds: 0,
      reason: '无致盲词缀 (Hit Blinds Target)',
    }
  }

  if (isBossOrChampion) {
    return {
      bonus,
      attackerLevel,
      targetLevel,
      isBossOrChampion: true,
      isRanged,
      chancePercent: 0,
      roll: 0,
      triggered: false,
      durationFrames: 0,
      durationSeconds: 0,
      reason: '首领、暗金怪与冠军怪免疫致盲效果',
    }
  }

  const rawMeleeChance = 50 + (attackerLevel + bonus * 4 - targetLevel) * 2
  const rawChance = isRanged ? rawMeleeChance / 3 : rawMeleeChance
  const chancePercent = Math.max(1, Math.min(100, Math.round(rawChance * 10) / 10))

  const roll = Math.round(randomFn() * 10000) / 100
  const triggered = roll < chancePercent

  const durationSeconds = bonus * 4 + 4
  const durationFrames = durationSeconds * 25

  return {
    bonus,
    attackerLevel,
    targetLevel,
    isBossOrChampion: false,
    isRanged,
    chancePercent,
    roll,
    triggered,
    durationFrames: triggered ? durationFrames : 0,
    durationSeconds: triggered ? durationSeconds : 0,
    reason: triggered
      ? `致盲命中！使目标盲目 (微暗灵视) 持续 ${durationSeconds} 秒 (${chancePercent}%几率)`
      : `致盲未命中 (${chancePercent}%几率, 掷骰 ${roll.toFixed(1)}%)`,
  }
}

export interface HitCausesFleeResult {
  readonly fleeChancePercent: number
  readonly isBossOrChampion: boolean
  readonly roll: number
  readonly triggered: boolean
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly reason: string
}

export function calculateHitCausesFlee(
  fleeChancePercent: number,
  isBossOrChampion = false,
  randomFn: () => number = defaultFormulaRandomFn,
): HitCausesFleeResult {
  const chance = Math.max(0, Math.min(100, fleeChancePercent))
  if (chance <= 0) {
    return {
      fleeChancePercent: 0,
      isBossOrChampion,
      roll: 0,
      triggered: false,
      durationFrames: 0,
      durationSeconds: 0,
      reason: '无恐吓逃跑词缀',
    }
  }

  if (isBossOrChampion) {
    return {
      fleeChancePercent: chance,
      isBossOrChampion: true,
      roll: 0,
      triggered: false,
      durationFrames: 0,
      durationSeconds: 0,
      reason: '首领与冠军怪物免疫恐吓逃跑效果',
    }
  }

  const roll = Math.round(randomFn() * 10000) / 100
  const triggered = roll < chance
  const durationFrames = triggered ? 125 : 0
  const durationSeconds = triggered ? 5.0 : 0

  return {
    fleeChancePercent: chance,
    isBossOrChampion: false,
    roll,
    triggered,
    durationFrames,
    durationSeconds,
    reason: triggered
      ? `恐吓逃跑生效！怪物陷入恐惧逃窜 5 秒 (几率 ${chance}%)`
      : `恐吓未触发 (几率 ${chance}%, 掷骰 ${roll.toFixed(1)}%)`,
  }
}

/**
 * 8g. Physical Damage Decomposition (Off-Weapon ED & Flat +Damage / Grief).
 *
 * Canonical Formula:
 *   BaseMin = floor(WeaponBaseMin * (1 + OnWeaponED / 100)) + FlatDamage
 *   BaseMax = floor(WeaponBaseMax * (1 + OnWeaponED / 100)) + FlatDamage
 *   TotalPhysMin = floor(BaseMin * (1 + (OffWeaponED + StatBonus) / 100))
 *   TotalPhysMax = floor(BaseMax * (1 + (OffWeaponED + StatBonus) / 100))
 */
export interface PhysicalDamageComponents {
  readonly weaponBaseMin: number
  readonly weaponBaseMax: number
  readonly onWeaponEdPercent?: number | undefined
  readonly flatDamage?: number | undefined
  readonly offWeaponEdPercent?: number | undefined
  readonly statBonusPercent?: number | undefined
}

export interface PhysicalDamageRangeResult {
  readonly weaponBaseMin: number
  readonly weaponBaseMax: number
  readonly onWeaponEdPercent: number
  readonly baseMinWithWeaponEd: number
  readonly baseMaxWithWeaponEd: number
  readonly flatDamage: number
  readonly baseMinWithFlat: number
  readonly baseMaxWithFlat: number
  readonly offWeaponEdPercent: number
  readonly statBonusPercent: number
  readonly totalMultiplier: number
  readonly finalMinDamage: number
  readonly finalMaxDamage: number
}

export function calculatePhysicalWeaponDamage(
  components: PhysicalDamageComponents,
): PhysicalDamageRangeResult {
  const wMin = Math.max(0, components.weaponBaseMin)
  const wMax = Math.max(wMin, components.weaponBaseMax)
  const onEd = Math.max(0, components.onWeaponEdPercent ?? 0)
  const flat = Math.max(0, components.flatDamage ?? 0)
  const offEd = Math.max(0, components.offWeaponEdPercent ?? 0)
  const statBonus = Math.max(0, components.statBonusPercent ?? 0)

  const baseMinWithWeaponEd = Math.floor(wMin * (1 + onEd / 100))
  const baseMaxWithWeaponEd = Math.floor(wMax * (1 + onEd / 100))

  const baseMinWithFlat = baseMinWithWeaponEd + flat
  const baseMaxWithFlat = baseMaxWithWeaponEd + flat

  const totalMultiplier = 1 + (offEd + statBonus) / 100
  const finalMinDamage = Math.floor(baseMinWithFlat * totalMultiplier)
  const finalMaxDamage = Math.floor(baseMaxWithFlat * totalMultiplier)

  return {
    weaponBaseMin: wMin,
    weaponBaseMax: wMax,
    onWeaponEdPercent: onEd,
    baseMinWithWeaponEd,
    baseMaxWithWeaponEd,
    flatDamage: flat,
    baseMinWithFlat,
    baseMaxWithFlat,
    offWeaponEdPercent: offEd,
    statBonusPercent: statBonus,
    totalMultiplier: Math.round(totalMultiplier * 1000) / 1000,
    finalMinDamage,
    finalMaxDamage,
  }
}

/**
 * 8h. Poison Bit Rate & Duration Averaging Stacking.
 *
 * In D2:
 * - Poison rate is in 1/256th damage per frame.
 * - Stacking across items:
 *     TotalBitRate = sum(BitRates)
 *     AvgDuration = sum(Durations) / N
 *     TotalDamage = floor((TotalBitRate * AvgDuration) / 256)
 */
export interface PoisonSource {
  readonly damage: number
  readonly durationSeconds?: number | undefined
  readonly durationFrames?: number | undefined
}

export interface PoisonStackResult {
  readonly totalBitRate: number
  readonly averageDurationFrames: number
  readonly averageDurationSeconds: number
  readonly totalPoisonDamage: number
  readonly damagePerSecond: number
  readonly sourcesCount: number
}

export function calculatePoisonStack(sources: readonly PoisonSource[]): PoisonStackResult {
  if (sources.length === 0) {
    return {
      totalBitRate: 0,
      averageDurationFrames: 0,
      averageDurationSeconds: 0,
      totalPoisonDamage: 0,
      damagePerSecond: 0,
      sourcesCount: 0,
    }
  }

  let sumBitRate = 0
  let sumFrames = 0
  let validCount = 0

  for (const src of sources) {
    const frames = src.durationFrames ?? ((src.durationSeconds ?? 0) * 25)
    if (frames > 0 && src.damage > 0) {
      const bitRate = (src.damage * 256) / frames
      sumBitRate += bitRate
      sumFrames += frames
      validCount += 1
    }
  }

  if (validCount === 0) {
    return {
      totalBitRate: 0,
      averageDurationFrames: 0,
      averageDurationSeconds: 0,
      totalPoisonDamage: 0,
      damagePerSecond: 0,
      sourcesCount: 0,
    }
  }

  const averageDurationFrames = Math.round(sumFrames / validCount)
  const averageDurationSeconds = Math.round((averageDurationFrames / 25) * 10) / 10
  const totalPoisonDamage = Math.floor((sumBitRate * averageDurationFrames) / 256)
  const damagePerSecond = Math.round(((sumBitRate * 25) / 256) * 100) / 100

  return {
    totalBitRate: Math.round(sumBitRate),
    averageDurationFrames,
    averageDurationSeconds,
    totalPoisonDamage,
    damagePerSecond,
    sourcesCount: validCount,
  }
}

/**
 * 9. Hit Recovery / Stun Check.
 *
 * In D2:
 * When a hit inflicts damage > MaxHP / 16:
 * - Damage >= MaxHP / 4: 100% chance to enter hit recovery.
 * - Damage >= MaxHP / 8: 50% chance to enter hit recovery.
 * - Damage >= MaxHP / 16: 25% chance to enter hit recovery.
 * - Damage < MaxHP / 16: 0% chance.
 *
 * @param damageDealt - Net damage received.
 * @param maxHp - Defender's maximum HP.
 * @param roll0to1 - Random float in [0, 1) (defaults to deterministic D2Rng roll).
 * @returns Whether hit recovery is triggered, and the trigger chance.
 */
export function checkHitRecovery(
  damageDealt: number,
  maxHp: number,
  roll0to1 = defaultFormulaRandomFn(),
): { readonly triggered: boolean; readonly chancePercent: number } {
  if (maxHp <= 0 || damageDealt <= 0) {
    return { triggered: false, chancePercent: 0 }
  }
  const ratio = damageDealt / maxHp
  let chancePercent = 0
  if (ratio >= 0.25) {
    chancePercent = 100
  } else if (ratio >= 0.125) {
    chancePercent = 50
  } else if (ratio >= 0.0625) {
    chancePercent = 25
  }

  const triggered = chancePercent > 0 && roll0to1 * 100 < chancePercent
  return { triggered, chancePercent }
}

/**
 * Elemental Damage specification for an attack.
 */
export interface AttackDamageSpec {
  /** Min physical damage rolled from weapon/skill/strength. */
  readonly physicalMin: number
  /** Max physical damage. */
  readonly physicalMax: number
  /** Fire damage. */
  readonly fire?: number
  /** Lightning damage. */
  readonly lightning?: number
  /** Cold damage (also chills). */
  readonly cold?: number
  /** Cold chill duration in frames/seconds. */
  readonly coldChillDuration?: number
  /** Poison damage (dealt over duration). */
  readonly poison?: number
  /** Magic damage (e.g. Berserk, Bone Spear). */
  readonly magic?: number
}

/**
 * Target's defensive specification.
 */
export interface DefenderDefenseSpec {
  /** Target Level. */
  readonly level: number
  /** Defense Rating (DR / AC). */
  readonly defense: number
  /** Block chance % [0, 75]. */
  readonly blockPercent: number
  /** Flat physical damage reduced (DR). */
  readonly flatDamageReduction?: number | undefined
  /** Flat magic damage reduced (MDR). */
  readonly flatMagicReduction?: number | undefined
  /** Physical resistance % (also known as %DR). */
  readonly resPhysical?: number | undefined
  /** Fire resistance %. */
  readonly resFire?: number | undefined
  /** Lightning resistance %. */
  readonly resLightning?: number | undefined
  /** Cold resistance %. */
  readonly resCold?: number | undefined
  /** Poison resistance %. */
  readonly resPoison?: number | undefined
  /** Magic resistance %. */
  readonly resMagic?: number | undefined
  /** Current HP (for crushing blow). */
  readonly currentHp: number
  /** Max HP (for hit recovery check). */
  readonly maxHp: number
  /** Target classification tier. */
  readonly tier?: TargetTier | undefined
  /** Monster physical size ('small', 'medium', 'large'). */
  readonly size?: MonsterSize | undefined
  /** Natural life regeneration rate from MonStats.txt. */
  readonly regenRate?: number | undefined
  /** Whether target is a Pandemonium Uber (immune to PMH). */
  readonly isUber?: boolean | undefined
  /** Whether the defender is a boss or champion (backwards-compatibility). */
  readonly isBoss?: boolean | undefined
  /** Whether defender is currently running (DR=0 and 1/3 block cap 25%). */
  readonly isRunning?: boolean | undefined
  /** Drain effectiveness % (0–100%, 0% for skeletons/hell bosses). */
  readonly drainEffectiveness?: number | undefined
}

/**
 * Additional combat calculation options.
 */
export interface CombatOptions {
  readonly criticalStrikePercent?: number | undefined
  readonly deadlyStrikePercent?: number | undefined
  readonly crushingBlowPercent?: number | undefined
  readonly openWoundsPercent?: number | undefined
  readonly lifeLeechPercent?: number | undefined
  readonly manaLeechPercent?: number | undefined
  readonly ignoreTargetDefense?: boolean | undefined
  readonly targetDefenseReductionPercent?: number | undefined
  readonly freezeBonus?: number | undefined
  readonly knockbackPercent?: number | undefined
  readonly difficulty?: GameDifficulty | undefined
  readonly isSpell?: boolean | undefined
  readonly isRanged?: boolean | undefined
  // PvE Depth Options (Issue #39)
  readonly defenderSize?: MonsterSize | undefined
  readonly convictionPenalty?: number | undefined
  readonly lowerResPenalty?: number | undefined
  readonly itemMinusPhysRes?: number | undefined
  readonly itemMinusFireRes?: number | undefined
  readonly itemMinusLightRes?: number | undefined
  readonly itemMinusColdRes?: number | undefined
  readonly itemMinusPoisonRes?: number | undefined
  readonly slowPercent?: number | undefined
  readonly hitBlindsTargetBonus?: number | undefined
  readonly hitCausesFleePercent?: number | undefined
  readonly preventMonsterHeal?: boolean | undefined
  readonly attackerType?: 'player' | 'mercenary' | 'minion' | undefined
}

/**
 * Full breakdown of an attack calculation for logging and inspection.
 */
export interface CombatCalculationResult {
  readonly attackerAr: number
  readonly defenderDr: number
  readonly hitChancePercent: number
  readonly hitRoll: number
  readonly isHit: boolean
  readonly isBlocked: boolean
  readonly defenderBlockPercent: number
  readonly isCritical: boolean
  readonly criticalTrigger: 'none' | 'critical_strike' | 'deadly_strike'
  readonly isCrushingBlow: boolean
  readonly crushingBlowDamage: number
  readonly isOpenWounds: boolean
  readonly openWoundsResult?: OpenWoundsDamageResult | undefined
  readonly lifeLeeched: number
  readonly manaLeeched: number
  readonly freezeResult?: FreezeTargetResult | undefined
  readonly knockbackTriggered: boolean
  readonly knockbackResult?: KnockbackEvaluationResult | undefined
  readonly slowResult?: SlowTargetResult | undefined
  readonly blindResult?: HitBlindsTargetResult | undefined
  readonly fleeResult?: HitCausesFleeResult | undefined
  readonly pmhResult?: PreventMonsterHealEvaluation | undefined
  readonly monsterRegenResult?: MonsterRegenResult | undefined
  readonly resistanceBreakResults?: Record<string, ResistanceReductionResult> | undefined
  readonly rawPhysicalDamage: number
  readonly finalPhysicalDamage: number
  readonly finalFireDamage: number
  readonly finalLightningDamage: number
  readonly finalColdDamage: number
  readonly finalPoisonDamage: number
  readonly finalMagicDamage: number
  readonly totalDamage: number
  readonly immunities: readonly string[]
  readonly hitRecoveryTriggered: boolean
  readonly hitRecoveryChance: number
  readonly log: readonly string[]
}

/**
 * Execute a complete Diablo II attack calculation with full mathematical provenance.
 *
 * @param attackerLevel - Attacker level.
 * @param attackerAr - Attacker Attack Rating (0 to bypass AR check, e.g. for spells).
 * @param damageSpec - Attack damage components.
 * @param defender - Defender attributes and defenses.
 * @param options - Additional proc chances, modifiers, and difficulty.
 * @param randomFn - Random generator function returning [0, 1).
 * @returns Detailed combat result.
 */
export function calculateAttack(
  attackerLevel: number,
  attackerAr: number,
  damageSpec: AttackDamageSpec,
  defender: DefenderDefenseSpec,
  options: CombatOptions = {},
  randomFn: () => number = defaultFormulaRandomFn,
): CombatCalculationResult {
  const log: string[] = []
  const immunities: string[] = []
  const resistanceBreakResults: Record<string, ResistanceReductionResult> = {}

  const isBossOrChampion = defender.isBoss ?? (defender.tier === 'boss')
  const targetTier: TargetTier = defender.tier ?? (defender.isBoss ? 'boss' : 'normal')
  const isRunning = defender.isRunning ?? false
  const isSpell = options.isSpell ?? false
  const isRanged = options.isRanged ?? false
  const difficulty = options.difficulty ?? 'normal'

  // 1. To-Hit Check
  let isHit = true
  let hitChancePercent = 100
  const hitRoll = Math.round(randomFn() * 10000) / 100

  if (!isSpell) {
    hitChancePercent = calculateHitChance(
      attackerAr,
      defender.defense,
      attackerLevel,
      defender.level,
      {
        ignoreTargetDefense: options.ignoreTargetDefense,
        targetDefenseReductionPercent: options.targetDefenseReductionPercent,
        isTargetRunning: isRunning,
        isBossOrChampion,
      },
    )
    isHit = hitRoll < hitChancePercent

    const itdNote = options.ignoreTargetDefense
      ? isBossOrChampion
        ? ' [ITD 对暗金/Boss无效]'
        : ' [ITD 生效: 目标防御降为0]'
      : ''
    const defRedNote = (options.targetDefenseReductionPercent ?? 0) > 0
      ? isBossOrChampion
        ? ` [-%Def 衰减折半: -${(options.targetDefenseReductionPercent! / 2).toFixed(1)}%]`
        : ` [-%Def 全额生效: -${options.targetDefenseReductionPercent}%]`
      : ''
    const runNote = isRunning ? ' [目标奔跑: 防御视为0]' : ''

    log.push(
      `[1. 命中率判定 (AR vs DR)]: 攻击者 AR=${attackerAr} (Lv${attackerLevel}) 对抗 防御者 DR=${defender.defense} (Lv${defender.level})` +
      `${itdNote}${defRedNote}${runNote} => 最终命中率: ${hitChancePercent.toFixed(1)}% (范围 5%–95%)。掷骰: ${hitRoll.toFixed(1)}% => ${isHit ? '✓ 命中' : '✗ 未命中 (MISS)'}`,
    )
  } else {
    log.push(`[1. 法术技能检查]: 法术攻击无视护甲与命中率 (100% 必定命中)`)
  }

  if (!isHit) {
    return {
      attackerAr,
      defenderDr: defender.defense,
      hitChancePercent,
      hitRoll,
      isHit: false,
      isBlocked: false,
      defenderBlockPercent: defender.blockPercent,
      isCritical: false,
      criticalTrigger: 'none',
      isCrushingBlow: false,
      crushingBlowDamage: 0,
      isOpenWounds: false,
      lifeLeeched: 0,
      manaLeeched: 0,
      knockbackTriggered: false,
      rawPhysicalDamage: 0,
      finalPhysicalDamage: 0,
      finalFireDamage: 0,
      finalLightningDamage: 0,
      finalColdDamage: 0,
      finalPoisonDamage: 0,
      finalMagicDamage: 0,
      totalDamage: 0,
      immunities: [],
      hitRecoveryTriggered: false,
      hitRecoveryChance: 0,
      log,
    }
  }

  // 2. Shield Blocking Check
  let isBlocked = false
  let defenderBlock = defender.blockPercent
  if (isRunning) {
    defenderBlock = Math.max(0, Math.min(25, Math.floor(defenderBlock / 3)))
  }

  if (!isSpell && defenderBlock > 0) {
    const blockRoll = Math.round(randomFn() * 10000) / 100
    isBlocked = blockRoll < defenderBlock
    log.push(
      `[2. 格挡判定]: 防御者有效格挡率: ${defenderBlock}%${isRunning ? ' (奔跑削减至1/3且上限25%)' : ''}，掷骰: ${blockRoll.toFixed(1)}% => ${isBlocked ? '🛡️ 格挡成功 (伤害完全抵消 0)' : '格挡失败'}`,
    )
  }

  if (isBlocked) {
    return {
      attackerAr,
      defenderDr: defender.defense,
      hitChancePercent,
      hitRoll,
      isHit: true,
      isBlocked: true,
      defenderBlockPercent: defenderBlock,
      isCritical: false,
      criticalTrigger: 'none',
      isCrushingBlow: false,
      crushingBlowDamage: 0,
      isOpenWounds: false,
      lifeLeeched: 0,
      manaLeeched: 0,
      knockbackTriggered: false,
      rawPhysicalDamage: 0,
      finalPhysicalDamage: 0,
      finalFireDamage: 0,
      finalLightningDamage: 0,
      finalColdDamage: 0,
      finalPoisonDamage: 0,
      finalMagicDamage: 0,
      totalDamage: 0,
      immunities: [],
      hitRecoveryTriggered: false,
      hitRecoveryChance: 0,
      log,
    }
  }

  // 3. Critical Strike (CS) & Deadly Strike (DS) Check
  const critResult = evaluateCriticalAndDeadlyStrike(
    options.criticalStrikePercent ?? 0,
    options.deadlyStrikePercent ?? 0,
    randomFn,
  )
  if (!isSpell && (options.criticalStrikePercent || options.deadlyStrikePercent)) {
    if (critResult.triggeredBy === 'critical_strike') {
      log.push(
        `[3. 暴击判定 (CS/DS)]: 技能致命一击 (CS ${options.criticalStrikePercent}%) 命中掷骰 ${critResult.csRoll.toFixed(1)}% => ⚡ 触发致命一击 (物理伤害 x2)`,
      )
    } else if (critResult.triggeredBy === 'deadly_strike') {
      log.push(
        `[3. 暴击判定 (CS/DS)]: CS 未触发 (掷骰 ${critResult.csRoll.toFixed(1)}%) -> 装备双倍打击 (DS ${options.deadlyStrikePercent}%) 命中掷骰 ${critResult.dsRoll.toFixed(1)}% => ⚡ 触发双倍打击 (物理伤害 x2)`,
      )
    } else {
      log.push(
        `[3. 暴击判定 (CS/DS)]: 综合双倍几率 ${critResult.combinedChancePercent.toFixed(1)}%，掷骰未触发双倍打击`,
      )
    }
  }

  // 4. Crushing Blow (CB) Check
  const cbChance = options.crushingBlowPercent ?? 0
  const cbRoll = Math.round(randomFn() * 10000) / 100
  const isCrushingBlow = !isSpell && cbChance > 0 && cbRoll < cbChance
  let crushingBlowDamage = 0
  if (isCrushingBlow) {
    const physRes = defender.resPhysical ?? 0
    crushingBlowDamage = calculateCrushingBlowDamage(
      defender.currentHp,
      targetTier,
      isRanged,
      physRes,
    )
    const resNote = physRes >= 100
      ? ' [目标物理免疫: CB 伤害为 0]'
      : physRes > 0
        ? ` [受物抗 ${physRes}% 削减]`
        : physRes < 0
          ? ` [负物抗不增伤, 封顶100%]`
          : ''
    log.push(
      `[4. 压碎性打击 (CB)]: 几率 ${cbChance}% 命中 (掷骰 ${cbRoll.toFixed(1)}%)！当前生命 ${defender.currentHp} 削减 ${crushingBlowDamage} HP${resNote}`,
    )
  }

  // 5. Open Wounds (OW) Check
  const owChance = options.openWoundsPercent ?? 0
  const owRoll = Math.round(randomFn() * 10000) / 100
  const isOpenWounds = !isSpell && owChance > 0 && owRoll < owChance
  let openWoundsResult: OpenWoundsDamageResult | undefined
  if (isOpenWounds) {
    openWoundsResult = calculateOpenWoundsDamage(attackerLevel, targetTier, isRanged)
    log.push(
      `[5. 撕开伤口 (OW)]: 几率 ${owChance}% 命中 (掷骰 ${owRoll.toFixed(1)}%)！持续流血 200 帧 (8秒)，` +
      `每秒流失 ${openWoundsResult.damagePerSecond} HP (总计 ${openWoundsResult.totalDamage200Frames} HP)，并禁止目标自愈！`,
    )
  }

  // 6. Roll Raw Physical Damage
  const pMin = damageSpec.physicalMin
  const pMax = Math.max(pMin, damageSpec.physicalMax)
  let rawPhysical = pMin + Math.round(randomFn() * (pMax - pMin))
  if (critResult.isCritical) {
    rawPhysical *= 2
  }
  // Note: CB damage is physical, added directly after critical doubling
  rawPhysical += crushingBlowDamage

  // 7. Apply Resistances & Reductions
  // 7a. Physical: Flat DR -> %DR (Resistance with -% Enemy Phys Res)
  const physBreak = calculateResistanceReduction(
    defender.resPhysical ?? 0,
    0,
    0,
    options.itemMinusPhysRes ?? 0,
  )
  resistanceBreakResults.physical = physBreak
  if (physBreak.isImmune) immunities.push('Physical')
  const flatDr = defender.flatDamageReduction ?? 0
  let finalPhysicalDamage = Math.max(0, (rawPhysical - flatDr) * physBreak.damageMultiplier)
  finalPhysicalDamage = Math.round(finalPhysicalDamage * 10) / 10
  log.push(
    `[6. 物理伤害结算]: 原始物理 ${rawPhysical} (基准 [${pMin}..${pMax}]${critResult.isCritical ? ' 暴击x2' : ''}${isCrushingBlow ? ' +CB' : ''}) ` +
    `- 减伤(DR) ${flatDr} -> 物抗 ${physBreak.finalRes}% (因子 x${physBreak.damageMultiplier.toFixed(2)}${physBreak.isImmune ? ' 物理免疫' : ''}) => 最终物理伤害: ${finalPhysicalDamage}`,
  )

  // 7b. Fire (with Conviction & Lower Resist 1/5th rule + Equipment -% Fire Res)
  const flatMdr = defender.flatMagicReduction ?? 0
  let finalFire = 0
  if ((damageSpec.fire ?? 0) > 0) {
    const fireBreak = calculateResistanceReduction(
      defender.resFire ?? 0,
      options.convictionPenalty ?? 0,
      options.lowerResPenalty ?? 0,
      options.itemMinusFireRes ?? 0,
    )
    resistanceBreakResults.fire = fireBreak
    if (fireBreak.isImmune) immunities.push('Fire')
    finalFire = Math.max(0, Math.round((Math.max(0, damageSpec.fire! - flatMdr) * fireBreak.damageMultiplier) * 10) / 10)

    const breakNote = fireBreak.immunityBroken
      ? ` [⚡ 1/5法则破免成功! 原${fireBreak.initialRes}% -> 降为${fireBreak.finalRes}%]`
      : fireBreak.wasImmune && fireBreak.isImmune
        ? ` [🛡️ 减抗未能破免! 原${fireBreak.initialRes}% -> ${fireBreak.finalRes}%仍>=100%]`
        : ` -> 火抗 ${fireBreak.finalRes}%`

    log.push(
      `[7. 火焰伤害]: 基础火伤 ${damageSpec.fire} - MDR ${flatMdr}${breakNote} (因子 x${fireBreak.damageMultiplier.toFixed(2)}${fireBreak.isImmune ? ' 免疫' : ''}) => 净火伤: ${finalFire}`,
    )
  }

  // 7c. Lightning (with Conviction & Lower Resist 1/5th rule + Equipment -% Light Res)
  let finalLightning = 0
  if ((damageSpec.lightning ?? 0) > 0) {
    const lightBreak = calculateResistanceReduction(
      defender.resLightning ?? 0,
      options.convictionPenalty ?? 0,
      options.lowerResPenalty ?? 0,
      options.itemMinusLightRes ?? 0,
    )
    resistanceBreakResults.lightning = lightBreak
    if (lightBreak.isImmune) immunities.push('Lightning')
    finalLightning = Math.max(0, Math.round((Math.max(0, damageSpec.lightning! - flatMdr) * lightBreak.damageMultiplier) * 10) / 10)

    const breakNote = lightBreak.immunityBroken
      ? ` [⚡ 1/5法则破免成功! 原${lightBreak.initialRes}% -> 降为${lightBreak.finalRes}%]`
      : lightBreak.wasImmune && lightBreak.isImmune
        ? ` [🛡️ 减抗未能破免! 原${lightBreak.initialRes}% -> ${lightBreak.finalRes}%仍>=100%]`
        : ` -> 电抗 ${lightBreak.finalRes}%`

    log.push(
      `[8. 闪电伤害]: 基础电伤 ${damageSpec.lightning} - MDR ${flatMdr}${breakNote} (因子 x${lightBreak.damageMultiplier.toFixed(2)}${lightBreak.isImmune ? ' 免疫' : ''}) => 净电伤: ${finalLightning}`,
    )
  }

  // 7d. Cold (with Conviction & Lower Resist 1/5th rule + Equipment -% Cold Res)
  let finalCold = 0
  if ((damageSpec.cold ?? 0) > 0) {
    const coldBreak = calculateResistanceReduction(
      defender.resCold ?? 0,
      options.convictionPenalty ?? 0,
      options.lowerResPenalty ?? 0,
      options.itemMinusColdRes ?? 0,
    )
    resistanceBreakResults.cold = coldBreak
    if (coldBreak.isImmune) immunities.push('Cold')
    finalCold = Math.max(0, Math.round((Math.max(0, damageSpec.cold! - flatMdr) * coldBreak.damageMultiplier) * 10) / 10)

    const breakNote = coldBreak.immunityBroken
      ? ` [⚡ 1/5法则破免成功! 原${coldBreak.initialRes}% -> 降为${coldBreak.finalRes}%]`
      : coldBreak.wasImmune && coldBreak.isImmune
        ? ` [🛡️ 减抗未能破免! 原${coldBreak.initialRes}% -> ${coldBreak.finalRes}%仍>=100%]`
        : ` -> 冰抗 ${coldBreak.finalRes}%`

    log.push(
      `[9. 冰冷伤害]: 基础冰伤 ${damageSpec.cold} - MDR ${flatMdr}${breakNote} (因子 x${coldBreak.damageMultiplier.toFixed(2)}${coldBreak.isImmune ? ' 免疫' : ''}) => 净冰伤: ${finalCold}`,
    )
  }

  // 7e. Poison (Conviction does NOT affect poison; Lower Resist DOES affect poison)
  let finalPoison = 0
  if ((damageSpec.poison ?? 0) > 0) {
    const poisonBreak = calculateResistanceReduction(
      defender.resPoison ?? 0,
      0, // Conviction has no effect on Poison
      options.lowerResPenalty ?? 0,
      options.itemMinusPoisonRes ?? 0,
    )
    resistanceBreakResults.poison = poisonBreak
    if (poisonBreak.isImmune) immunities.push('Poison')
    finalPoison = Math.max(0, Math.round((damageSpec.poison! * poisonBreak.damageMultiplier) * 10) / 10)

    const breakNote = poisonBreak.immunityBroken
      ? ` [⚡ 诅咒破毒免成功! 原${poisonBreak.initialRes}% -> 降为${poisonBreak.finalRes}%]`
      : poisonBreak.wasImmune && poisonBreak.isImmune
        ? ` [🛡️ 减抗未能破毒免! 原${poisonBreak.initialRes}% -> ${poisonBreak.finalRes}%仍>=100%]`
        : ` -> 毒抗 ${poisonBreak.finalRes}%`

    log.push(
      `[10. 毒素伤害]: 基础毒伤 ${damageSpec.poison}${breakNote} (因子 x${poisonBreak.damageMultiplier.toFixed(2)}${poisonBreak.isImmune ? ' 免疫' : ''}) => 净毒伤: ${finalPoison}`,
    )
  }

  // 7f. Magic
  let finalMagic = 0
  if ((damageSpec.magic ?? 0) > 0) {
    const magicRes = defender.resMagic ?? 0
    const factor = calculateResistanceFactor(magicRes)
    if (factor.isImmune) immunities.push('Magic')
    finalMagic = Math.max(0, Math.round((Math.max(0, damageSpec.magic! - flatMdr) * factor.factor) * 10) / 10)
    log.push(
      `[11. 纯魔法伤害]: 基础魔伤 ${damageSpec.magic} - MDR ${flatMdr} -> 魔抗 ${magicRes}% (因子 x${factor.factor.toFixed(2)}${factor.isImmune ? ' 免疫' : ''}) => 净魔伤: ${finalMagic}`,
    )
  }

  // 8. Life & Mana Leech
  const leechResult = calculateLeech(
    finalPhysicalDamage,
    options.lifeLeechPercent ?? 0,
    options.manaLeechPercent ?? 0,
    defender.drainEffectiveness ?? 100,
    difficulty,
  )
  if (!isSpell && ((options.lifeLeechPercent ?? 0) > 0 || (options.manaLeechPercent ?? 0) > 0)) {
    const drainEff = defender.drainEffectiveness ?? 100
    log.push(
      `[12. 偷取生命/法力]: 汲取效率 ${drainEff}%, 难度惩罚 x${leechResult.difficultyPenaltyFactor.toFixed(2)} ` +
      `=> 实际偷取生命 +${leechResult.lifeLeeched} HP, 偷取法力 +${leechResult.manaLeeched} MP`,
    )
  }

  // 9. Freezes Target & Knockback (Size-based & Boss Immunity)
  let freezeResult: FreezeTargetResult | undefined
  if (!isSpell && (options.freezeBonus ?? 0) > 0) {
    freezeResult = calculateFreezeTarget(
      options.freezeBonus!,
      attackerLevel,
      defender.level,
      targetTier,
      isRanged,
      difficulty,
      randomFn,
    )
    if (freezeResult.willFreeze) {
      log.push(
        `[13. 冻结目标 (Freezes Target)]: 冻结几率 ${freezeResult.chancePercent}% (掷骰 ${freezeResult.roll.toFixed(1)}%) => ❄️ 目标被冰冻 ${freezeResult.durationSeconds} 秒 (${freezeResult.durationFrames} 帧)!`,
      )
    } else if (freezeResult.isChilledOnly) {
      log.push(
        `[13. 冻结目标 (Freezes Target)]: 目标为 Boss/精英，免疫完全冰冻，降级为减速减速 (Chill) ${freezeResult.durationSeconds} 秒!`,
      )
    }
  }

  const kbChance = options.knockbackPercent ?? 0
  const defenderSize = defender.size ?? options.defenderSize ?? 'medium'
  const kbResult = calculateKnockbackSuccess(
    kbChance > 0,
    defenderSize,
    isBossOrChampion,
    isRanged,
    randomFn,
  )
  const knockbackTriggered = !isSpell && kbResult.triggered
  if (kbChance > 0) {
    log.push(`[14. 击退判定 (Knockback)]: ${kbResult.reason}`)
  }

  // 10. Crowd Control: Slow Target, Blinds, Causes Flee
  let slowResult: SlowTargetResult | undefined
  if ((options.slowPercent ?? 0) > 0) {
    slowResult = calculateSlowTarget(options.slowPercent!, isBossOrChampion)
    log.push(`[15. 减速目标 (Slow)]: ${slowResult.reason}`)
  }

  let blindResult: HitBlindsTargetResult | undefined
  if (!isSpell && (options.hitBlindsTargetBonus ?? 0) > 0) {
    blindResult = calculateHitBlindsTarget(
      options.hitBlindsTargetBonus!,
      attackerLevel,
      defender.level,
      isBossOrChampion,
      isRanged,
      randomFn,
    )
    log.push(`[16. 使目标盲目 (HBT)]: ${blindResult.reason}`)
  }

  let fleeResult: HitCausesFleeResult | undefined
  if (!isSpell && (options.hitCausesFleePercent ?? 0) > 0) {
    fleeResult = calculateHitCausesFlee(
      options.hitCausesFleePercent!,
      isBossOrChampion,
      randomFn,
    )
    log.push(`[17. 恐吓逃跑 (HCMTF)]: ${fleeResult.reason}`)
  }

  // 11. Prevent Monster Heal (PMH) & Monster Regeneration Evaluation
  let pmhResult: PreventMonsterHealEvaluation | undefined
  if (!isSpell && options.preventMonsterHeal) {
    const targetKind = defender.isUber ? 'uber' : (isBossOrChampion ? 'boss' : 'normal')
    pmhResult = evaluatePreventMonsterHeal(options.attackerType ?? 'player', targetKind)
    log.push(`[18. 阻止怪物自愈 (PMH)]: ${pmhResult.reason}`)
  }

  const monsterRegenResult = calculateMonsterRegeneration(
    defender.maxHp,
    defender.regenRate ?? 0,
    isOpenWounds,
    pmhResult?.applied ?? false,
  )

  const totalDamage = Math.round((finalPhysicalDamage + finalFire + finalLightning + finalCold + finalPoison + finalMagic) * 10) / 10
  log.push(
    `[19. 最终伤害汇总]: 单次打击扣减 = ${totalDamage} HP (目标剩余生命: ${Math.max(0, Math.round((defender.currentHp - totalDamage) * 10) / 10)} / ${defender.maxHp})`,
  )

  // 12. Hit Recovery (Stun) Check
  const recovery = checkHitRecovery(totalDamage, defender.maxHp, randomFn())
  if (recovery.triggered) {
    log.push(`[20. 受击硬直 (Hit Recovery)]: 单次伤害达到触发阈值 (几率 ${recovery.chancePercent}%) => 💥 触发硬直后仰！`)
  } else if (recovery.chancePercent > 0) {
    log.push(`[20. 受击硬直 (Hit Recovery)]: 伤害达到阈值 (几率 ${recovery.chancePercent}%)，掷骰通过，未陷入硬直`)
  }

  return {
    attackerAr,
    defenderDr: defender.defense,
    hitChancePercent,
    hitRoll,
    isHit: true,
    isBlocked: false,
    defenderBlockPercent: defenderBlock,
    isCritical: critResult.isCritical,
    criticalTrigger: critResult.triggeredBy,
    isCrushingBlow,
    crushingBlowDamage,
    isOpenWounds,
    openWoundsResult,
    lifeLeeched: leechResult.lifeLeeched,
    manaLeeched: leechResult.manaLeeched,
    freezeResult,
    knockbackTriggered,
    knockbackResult: kbResult,
    slowResult,
    blindResult,
    fleeResult,
    pmhResult,
    monsterRegenResult,
    resistanceBreakResults,
    rawPhysicalDamage: rawPhysical,
    finalPhysicalDamage,
    finalFireDamage: finalFire,
    finalLightningDamage: finalLightning,
    finalColdDamage: finalCold,
    finalPoisonDamage: finalPoison,
    finalMagicDamage: finalMagic,
    totalDamage,
    immunities,
    hitRecoveryTriggered: recovery.triggered,
    hitRecoveryChance: recovery.chancePercent,
    log,
  }
}

/**
 * Authentic Diablo II 1.13c Experience.txt raw table data and parser.
 * Sourced directly from Expansion 1.13c data/global/excel/Experience.txt.
 */
export const EXPERIENCE_TXT_RAW = "Level\tAmazon\tSorceress\tNecromancer\tPaladin\tBarbarian\tDruid\tAssassin\tExpRatio\nMaxLvl\t99\t99\t99\t99\t99\t99\t99\t10\n0\t0\t0\t0\t0\t0\t0\t0\t1024\n1\t500\t500\t500\t500\t500\t500\t500\t1024\n2\t1500\t1500\t1500\t1500\t1500\t1500\t1500\t1024\n3\t3750\t3750\t3750\t3750\t3750\t3750\t3750\t1024\n4\t7875\t7875\t7875\t7875\t7875\t7875\t7875\t1024\n5\t14175\t14175\t14175\t14175\t14175\t14175\t14175\t1024\n6\t22680\t22680\t22680\t22680\t22680\t22680\t22680\t1024\n7\t32886\t32886\t32886\t32886\t32886\t32886\t32886\t1024\n8\t44396\t44396\t44396\t44396\t44396\t44396\t44396\t1024\n9\t57715\t57715\t57715\t57715\t57715\t57715\t57715\t1024\n10\t72144\t72144\t72144\t72144\t72144\t72144\t72144\t1024\n11\t90180\t90180\t90180\t90180\t90180\t90180\t90180\t1024\n12\t112725\t112725\t112725\t112725\t112725\t112725\t112725\t1024\n13\t140906\t140906\t140906\t140906\t140906\t140906\t140906\t1024\n14\t176132\t176132\t176132\t176132\t176132\t176132\t176132\t1024\n15\t220165\t220165\t220165\t220165\t220165\t220165\t220165\t1024\n16\t275207\t275207\t275207\t275207\t275207\t275207\t275207\t1024\n17\t344008\t344008\t344008\t344008\t344008\t344008\t344008\t1024\n18\t430010\t430010\t430010\t430010\t430010\t430010\t430010\t1024\n19\t537513\t537513\t537513\t537513\t537513\t537513\t537513\t1024\n20\t671891\t671891\t671891\t671891\t671891\t671891\t671891\t1024\n21\t839864\t839864\t839864\t839864\t839864\t839864\t839864\t1024\n22\t1049830\t1049830\t1049830\t1049830\t1049830\t1049830\t1049830\t1024\n23\t1312287\t1312287\t1312287\t1312287\t1312287\t1312287\t1312287\t1024\n24\t1640359\t1640359\t1640359\t1640359\t1640359\t1640359\t1640359\t1024\n25\t2050449\t2050449\t2050449\t2050449\t2050449\t2050449\t2050449\t1024\n26\t2563061\t2563061\t2563061\t2563061\t2563061\t2563061\t2563061\t1024\n27\t3203826\t3203826\t3203826\t3203826\t3203826\t3203826\t3203826\t1024\n28\t3902260\t3902260\t3902260\t3902260\t3902260\t3902260\t3902260\t1024\n29\t4663553\t4663553\t4663553\t4663553\t4663553\t4663553\t4663553\t1024\n30\t5493363\t5493363\t5493363\t5493363\t5493363\t5493363\t5493363\t1024\n31\t6397855\t6397855\t6397855\t6397855\t6397855\t6397855\t6397855\t1024\n32\t7383752\t7383752\t7383752\t7383752\t7383752\t7383752\t7383752\t1024\n33\t8458379\t8458379\t8458379\t8458379\t8458379\t8458379\t8458379\t1024\n34\t9629723\t9629723\t9629723\t9629723\t9629723\t9629723\t9629723\t1024\n35\t10906488\t10906488\t10906488\t10906488\t10906488\t10906488\t10906488\t1024\n36\t12298162\t12298162\t12298162\t12298162\t12298162\t12298162\t12298162\t1024\n37\t13815086\t13815086\t13815086\t13815086\t13815086\t13815086\t13815086\t1024\n38\t15468534\t15468534\t15468534\t15468534\t15468534\t15468534\t15468534\t1024\n39\t17270791\t17270791\t17270791\t17270791\t17270791\t17270791\t17270791\t1024\n40\t19235252\t19235252\t19235252\t19235252\t19235252\t19235252\t19235252\t1024\n41\t21376515\t21376515\t21376515\t21376515\t21376515\t21376515\t21376515\t1024\n42\t23710491\t23710491\t23710491\t23710491\t23710491\t23710491\t23710491\t1024\n43\t26254525\t26254525\t26254525\t26254525\t26254525\t26254525\t26254525\t1024\n44\t29027522\t29027522\t29027522\t29027522\t29027522\t29027522\t29027522\t1024\n45\t32050088\t32050088\t32050088\t32050088\t32050088\t32050088\t32050088\t1024\n46\t35344686\t35344686\t35344686\t35344686\t35344686\t35344686\t35344686\t1024\n47\t38935798\t38935798\t38935798\t38935798\t38935798\t38935798\t38935798\t1024\n48\t42850109\t42850109\t42850109\t42850109\t42850109\t42850109\t42850109\t1024\n49\t47116709\t47116709\t47116709\t47116709\t47116709\t47116709\t47116709\t1024\n50\t51767302\t51767302\t51767302\t51767302\t51767302\t51767302\t51767302\t1024\n51\t56836449\t56836449\t56836449\t56836449\t56836449\t56836449\t56836449\t1024\n52\t62361819\t62361819\t62361819\t62361819\t62361819\t62361819\t62361819\t1024\n53\t68384473\t68384473\t68384473\t68384473\t68384473\t68384473\t68384473\t1024\n54\t74949165\t74949165\t74949165\t74949165\t74949165\t74949165\t74949165\t1024\n55\t82104680\t82104680\t82104680\t82104680\t82104680\t82104680\t82104680\t1024\n56\t89904191\t89904191\t89904191\t89904191\t89904191\t89904191\t89904191\t1024\n57\t98405658\t98405658\t98405658\t98405658\t98405658\t98405658\t98405658\t1024\n58\t107672256\t107672256\t107672256\t107672256\t107672256\t107672256\t107672256\t1024\n59\t117772849\t117772849\t117772849\t117772849\t117772849\t117772849\t117772849\t1024\n60\t128782495\t128782495\t128782495\t128782495\t128782495\t128782495\t128782495\t1024\n61\t140783010\t140783010\t140783010\t140783010\t140783010\t140783010\t140783010\t1024\n62\t153863570\t153863570\t153863570\t153863570\t153863570\t153863570\t153863570\t1024\n63\t168121381\t168121381\t168121381\t168121381\t168121381\t168121381\t168121381\t1024\n64\t183662396\t183662396\t183662396\t183662396\t183662396\t183662396\t183662396\t1024\n65\t200602101\t200602101\t200602101\t200602101\t200602101\t200602101\t200602101\t1024\n66\t219066380\t219066380\t219066380\t219066380\t219066380\t219066380\t219066380\t1024\n67\t239192444\t239192444\t239192444\t239192444\t239192444\t239192444\t239192444\t1024\n68\t261129853\t261129853\t261129853\t261129853\t261129853\t261129853\t261129853\t1024\n69\t285041630\t285041630\t285041630\t285041630\t285041630\t285041630\t285041630\t1024\n70\t311105466\t311105466\t311105466\t311105466\t311105466\t311105466\t311105466\t976\n71\t339515048\t339515048\t339515048\t339515048\t339515048\t339515048\t339515048\t928\n72\t370481492\t370481492\t370481492\t370481492\t370481492\t370481492\t370481492\t880\n73\t404234916\t404234916\t404234916\t404234916\t404234916\t404234916\t404234916\t832\n74\t441026148\t441026148\t441026148\t441026148\t441026148\t441026148\t441026148\t784\n75\t481128591\t481128591\t481128591\t481128591\t481128591\t481128591\t481128591\t736\n76\t524840254\t524840254\t524840254\t524840254\t524840254\t524840254\t524840254\t688\n77\t572485967\t572485967\t572485967\t572485967\t572485967\t572485967\t572485967\t640\n78\t624419793\t624419793\t624419793\t624419793\t624419793\t624419793\t624419793\t592\n79\t681027665\t681027665\t681027665\t681027665\t681027665\t681027665\t681027665\t544\n80\t742730244\t742730244\t742730244\t742730244\t742730244\t742730244\t742730244\t496\n81\t809986056\t809986056\t809986056\t809986056\t809986056\t809986056\t809986056\t448\n82\t883294891\t883294891\t883294891\t883294891\t883294891\t883294891\t883294891\t400\n83\t963201521\t963201521\t963201521\t963201521\t963201521\t963201521\t963201521\t352\n84\t1050299747\t1050299747\t1050299747\t1050299747\t1050299747\t1050299747\t1050299747\t304\n85\t1145236814\t1145236814\t1145236814\t1145236814\t1145236814\t1145236814\t1145236814\t256\n86\t1248718217\t1248718217\t1248718217\t1248718217\t1248718217\t1248718217\t1248718217\t192\n87\t1361512946\t1361512946\t1361512946\t1361512946\t1361512946\t1361512946\t1361512946\t144\n88\t1484459201\t1484459201\t1484459201\t1484459201\t1484459201\t1484459201\t1484459201\t108\n89\t1618470619\t1618470619\t1618470619\t1618470619\t1618470619\t1618470619\t1618470619\t81\n90\t1764543065\t1764543065\t1764543065\t1764543065\t1764543065\t1764543065\t1764543065\t61\n91\t1923762030\t1923762030\t1923762030\t1923762030\t1923762030\t1923762030\t1923762030\t46\n92\t2097310703\t2097310703\t2097310703\t2097310703\t2097310703\t2097310703\t2097310703\t35\n93\t2286478756\t2286478756\t2286478756\t2286478756\t2286478756\t2286478756\t2286478756\t26\n94\t2492671933\t2492671933\t2492671933\t2492671933\t2492671933\t2492671933\t2492671933\t20\n95\t2717422497\t2717422497\t2717422497\t2717422497\t2717422497\t2717422497\t2717422497\t15\n96\t2962400612\t2962400612\t2962400612\t2962400612\t2962400612\t2962400612\t2962400612\t11\n97\t3229426756\t3229426756\t3229426756\t3229426756\t3229426756\t3229426756\t3229426756\t8\n98\t3520485254\t3520485254\t3520485254\t3520485254\t3520485254\t3520485254\t3520485254\t6\n99\t3837739017\t3837739017\t3837739017\t3837739017\t3837739017\t3837739017\t3837739017\t5"

export interface ExperienceTableParseResult {
  maxLevel: number
  tableByClass: Record<string, number[]>
  expRatios: number[]
}

export function parseExperienceTable(rawTxt: string): ExperienceTableParseResult {
  const lines = rawTxt.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    return { maxLevel: 99, tableByClass: {}, expRatios: [] }
  }
  const header = lines[0]!.split("\t")
  const classCols: Record<string, number> = {}
  let expRatioCol = -1
  for (let c = 1; c < header.length; c++) {
    const col = header[c]!.trim().toLowerCase()
    if (col === "expratio") {
      expRatioCol = c
    } else if (col) {
      classCols[col] = c
    }
  }

  let maxLevel = 99
  const tableByClass: Record<string, number[]> = {}
  for (const cls of Object.keys(classCols)) {
    tableByClass[cls] = new Array(100).fill(0)
  }
  const expRatios: number[] = new Array(100).fill(1024)

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split("\t")
    const lvlStr = parts[0]!.trim()
    if (lvlStr === "MaxLvl") {
      const parsedMax = parseInt(parts[1] ?? "99", 10)
      if (!Number.isNaN(parsedMax)) maxLevel = parsedMax
      continue
    }
    const lvlNum = parseInt(lvlStr, 10)
    if (Number.isNaN(lvlNum)) continue
    // In Experience.txt:
    // Row "0" corresponds to XP threshold to reach Level 1 (0)
    // Row "1" corresponds to XP threshold to reach Level 2 (500)
    // Row "L" corresponds to XP threshold to reach Level L + 1
    const targetLevel = lvlNum + 1
    if (targetLevel >= 1 && targetLevel <= 99) {
      for (const [cls, colIdx] of Object.entries(classCols)) {
        tableByClass[cls]![targetLevel] = parseInt(parts[colIdx] ?? "0", 10) || 0
      }
      if (expRatioCol !== -1) {
        // ExpRatio applies to the row's *current* level (row 70 = 976 at level 70),
        // unlike the class XP columns whose row L is the threshold for L + 1.
        expRatios[lvlNum] = parseInt(parts[expRatioCol] ?? "1024", 10) || 1024
      }
    }
  }

  return { maxLevel, tableByClass, expRatios }
}

export const PARSED_EXPERIENCE_TABLE = parseExperienceTable(EXPERIENCE_TXT_RAW)
export const EXPERIENCE_TABLE_BY_CLASS = PARSED_EXPERIENCE_TABLE.tableByClass

/**
 * Canonical Diablo II 1.13c Experience Progression Table (Levels 1 to 99).
 *
 * Index corresponds to character level (Index 1 = Level 1).
 * Level 1 = 0, Level 2 = 500, Level 17 = 275207, Level 30 = 4663553, Level 90 = 1618470619, Level 99 = 3520485254.
 */
export const D2_EXPERIENCE_TABLE_99: readonly number[] =
  EXPERIENCE_TABLE_BY_CLASS["amazon"] ?? new Array(100).fill(0)

export function getExperienceTable(charClass?: string): readonly number[] {
  if (charClass) {
    const key = charClass.trim().toLowerCase()
    if (key in EXPERIENCE_TABLE_BY_CLASS) {
      return EXPERIENCE_TABLE_BY_CLASS[key]!
    }
  }
  return D2_EXPERIENCE_TABLE_99
}

export function getExperienceForLevel(level: number, charClass?: string): number {
  if (level <= 1) return 0
  const table = getExperienceTable(charClass)
  if (level >= table.length) return table[table.length - 1] ?? 0
  return table[level] ?? 0
}

export function getNextLevelExperience(level: number, charClass?: string): number {
  if (level <= 0) return getExperienceForLevel(2, charClass)
  if (level >= 99) return getExperienceForLevel(99, charClass)
  return getExperienceForLevel(level + 1, charClass)
}
