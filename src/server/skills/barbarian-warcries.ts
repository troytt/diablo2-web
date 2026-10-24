/**
 * Diablo II: Lord of Destruction v1.13c — Barbarian Warcries Module
 *
 * Dedicated pure calculation, duration, synergy, and kinematics formulas for the 10 Barbarian Warcries:
 * - Skill 130: Howl (ReqLevel 1)
 * - Skill 131: Find Potion (ReqLevel 1)
 * - Skill 137: Taunt (ReqLevel 6)
 * - Skill 138: Shout (ReqLevel 6)
 * - Skill 142: Find Item (ReqLevel 12)
 * - Skill 146: Battle Cry (ReqLevel 18)
 * - Skill 149: Battle Orders (ReqLevel 24)
 * - Skill 150: Grim Ward (ReqLevel 24)
 * - Skill 154: War Cry (ReqLevel 30)
 * - Skill 155: Battle Command (ReqLevel 30)
 *
 * 1.13c Ground Truth:
 * - Skills.txt & Missiles.txt (Patch_D2.mpq)
 * - Strict fixed-point 24.8 mana calculations
 * - 5-band physical damage progression for War Cry
 * - Diminishing returns dm12 for Find Potion (0..100) and Find Item (5..60)
 * - Shout / Battle Orders / Battle Command mutual duration synergy (+125 frames = 5s / blvl)
 * - Grim Ward 1000 frame (40s) totem life
 * - Zero runtime MPQ reading
 */

import { compute5BandScaling, computeDiminishingReturns } from '../../common/data/calc-ast.ts'

// --- Interfaces for Skill Calculations ---

export type WarcryDifficulty = 0 | 1 | 2 | 'normal' | 'nightmare' | 'hell'

export function resolveAiCurseDivisor(difficulty: WarcryDifficulty = 0): 1 | 2 | 4 {
  if (difficulty === 2 || difficulty === 'hell') return 4
  if (difficulty === 1 || difficulty === 'nightmare') return 2
  return 1
}

export interface HowlStats {
  readonly fleeDurationFrames: number
  readonly fleeDurationSeconds: number
  readonly fleeRangeSubtiles: number
  readonly missileRangeFrames: number
  readonly missileVel: number
  readonly radiusSubtiles: number
  readonly aurarangecalcSubtiles: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface FindPotionStats {
  readonly successChancePct: number
  readonly requiresCorpse: boolean
  readonly requiresSoftCorpse: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

export interface TauntStats {
  readonly targetAttackRatingReductionPct: number
  readonly targetDamageReductionPct: number
  readonly forcesMeleeAttack: boolean
  readonly singleTarget: boolean
  readonly bossImmune: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

export interface ShoutStats {
  readonly defenseBonusPct: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly radiusSubtiles: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface FindItemStats {
  readonly dropChancePct: number
  readonly noDropZero: boolean
  readonly requiresCorpse: boolean
  readonly allowsSkeletonCorpse: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

export interface BattleCryStats {
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly targetDefenseReductionPct: number
  readonly targetDamageReductionPct: number
  readonly radiusSubtiles: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface BattleOrdersStats {
  readonly maxLifeBonusPct: number
  readonly maxManaBonusPct: number
  readonly maxStaminaBonusPct: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly radiusSubtiles: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface GrimWardStats {
  readonly totemDurationFrames: number
  readonly totemDurationSeconds: number
  readonly fleeRadiusYards: number
  readonly fleeRadiusSubtiles: number
  readonly fleeDurationFrames: number
  readonly fleeDurationSeconds: number
  readonly requiresCorpse: boolean
  readonly requiresSoftCorpse: boolean
  readonly manaCost: number
  readonly manaCost256: number
}

export interface WarCryStats {
  readonly minPhysicalDamage: number
  readonly maxPhysicalDamage: number
  readonly baseMinPhysicalDamage: number
  readonly baseMaxPhysicalDamage: number
  readonly synergyBonusPct: number
  readonly stunDurationFrames: number
  readonly stunDurationSeconds: number
  readonly radiusSubtiles: number
  readonly nextDelayFrames: number
  readonly manaCost: number
  readonly manaCost256: number
}

export interface BattleCommandStats {
  readonly allSkillsBonus: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly radiusSubtiles: number
  readonly manaCost: number
  readonly manaCost256: number
}

// --- Calculation Implementations ---

/**
 * Skill 130: Howl
 * - Flee duration: ln56 = 75 + 25 * (slvl - 1) frames, divided by AICurse divisor (1 / 2 / 4)
 * - Flee range: ln34 = 24 + 5 * (slvl - 1) subtiles
 * - Missile (#148 howl): Range = 12 (LevRange empty), Vel = 12 + calc1 = 12 + 2 * (slvl - 1) (no MaxVel clamp)
 * - Mana: 4 (1024 in 24.8)
 */
export function calculateHowlStats(slvl: number, difficulty: WarcryDifficulty = 0): HowlStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      fleeDurationFrames: 0,
      fleeDurationSeconds: 0,
      fleeRangeSubtiles: 0,
      missileRangeFrames: 0,
      missileVel: 0,
      radiusSubtiles: 0,
      aurarangecalcSubtiles: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  const aiCurseDiv = resolveAiCurseDivisor(difficulty)
  const durationFrames = Math.floor((75 + 25 * (lvl - 1)) / aiCurseDiv)
  const fleeRangeSubtiles = 24 + 5 * (lvl - 1)
  // Missiles.txt howl: Range 12 (LevRange empty) -> lifetime does not grow; SrvDo022 / CltDo25 pass
  // velocity = Vel 12 + calc1 'par1 * (lvl-1)' (Param1 = 2), with no MaxVel clamp (sub_6FD14170 flag 4).
  const missileRangeFrames = 12
  const missileVel = 12 + 2 * (lvl - 1)
  const radiusSubtiles = Math.round(((missileRangeFrames * missileVel) / 24) * 100) / 100
  return {
    fleeDurationFrames: durationFrames,
    fleeDurationSeconds: Math.round((durationFrames / 25) * 10) / 10,
    fleeRangeSubtiles,
    missileRangeFrames,
    missileVel,
    radiusSubtiles,
    aurarangecalcSubtiles: 2 + (lvl - 1),
    manaCost: 4,
    manaCost256: 1024,
  }
}

/**
 * Skill 131: Find Potion
 * Success Chance %: dm(0, 100, slvl)
 * Mana: 2
 */
export function calculateFindPotionStats(slvl: number): FindPotionStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      successChancePct: 0,
      requiresCorpse: true,
      requiresSoftCorpse: true,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  return {
    successChancePct: Math.min(100, computeDiminishingReturns(0, 100, lvl)),
    requiresCorpse: true,
    requiresSoftCorpse: true,
    manaCost: 2,
    manaCost256: 512,
  }
}

/**
 * 1.13c D2Game.dll `SKILLS_SrvDo069_FindPotion` (`0x6FC4CC20`):
 * `gdwPotionsTable[nAct + 5 * nDifficulty]` (15-entry tier table across 3 difficulties x 5 acts)
 * - 60% Healing Potion (`hp1`..`hp5`)
 * - 30% Mana Potion (`mp1`..`mp5`)
 * - 10% Rejuvenation Potion (`rvs` or `rvl`)
 */
const GDW_POTIONS_TIER_TABLE: readonly (1 | 2 | 3 | 4 | 5)[] = [
  // Normal: Act 1..5
  1, 2, 3, 4, 5,
  // Nightmare: Act 1..5
  3, 4, 4, 5, 5,
  // Hell: Act 1..5
  4, 5, 5, 5, 5,
]

export function rollFindPotionDrop113c(
  slvl: number,
  act: number = 0,
  difficulty: number = 0,
  roll100: number = 0,
  typeRoll100: number = 50,
): {
  dropped: boolean
  chancePct: number
  potionCode: string | null
  potionKind: 'healing' | 'mana' | 'rejuvenation' | null
} {
  const stats = calculateFindPotionStats(slvl)
  if (stats.successChancePct <= 0 || roll100 >= stats.successChancePct) {
    return {
      dropped: false,
      chancePct: stats.successChancePct,
      potionCode: null,
      potionKind: null,
    }
  }
  const actClamped = Math.max(0, Math.min(4, Math.floor(act)))
  const diffClamped = Math.max(0, Math.min(2, Math.floor(difficulty)))
  const tableIdx = actClamped + 5 * diffClamped
  const tier = GDW_POTIONS_TIER_TABLE[tableIdx] ?? 5

  if (typeRoll100 < 60) {
    return {
      dropped: true,
      chancePct: stats.successChancePct,
      potionCode: `hp${tier}`,
      potionKind: 'healing',
    }
  }
  if (typeRoll100 < 90) {
    return {
      dropped: true,
      chancePct: stats.successChancePct,
      potionCode: `mp${tier}`,
      potionKind: 'mana',
    }
  }
  const isFullRejuv = diffClamped >= 2 || (diffClamped === 1 && actClamped >= 3)
  return {
    dropped: true,
    chancePct: stats.successChancePct,
    potionCode: isFullRejuv ? 'rvl' : 'rvs',
    potionKind: 'rejuvenation',
  }
}

/**
 * Skill 137: Taunt
 * Target AR debuff: -(5 + 2 * (slvl - 1))%
 * Target Dmg debuff: -(5 + 2 * (slvl - 1))%
 * Mana: 3
 */
export function calculateTauntStats(slvl: number): TauntStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      targetAttackRatingReductionPct: 0,
      targetDamageReductionPct: 0,
      forcesMeleeAttack: true,
      singleTarget: true,
      bossImmune: true,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  const debuffPct = 5 + 2 * (lvl - 1)
  return {
    targetAttackRatingReductionPct: debuffPct,
    targetDamageReductionPct: debuffPct,
    forcesMeleeAttack: true,
    singleTarget: true,
    bossImmune: true,
    manaCost: 3,
    manaCost256: 768,
  }
}

/**
 * Skill 138: Shout
 * Defense %: 100 + 10 * (slvl - 1)%
 * Duration: 500 + 250 * (slvl - 1) + 125 * (battleOrdersBlvl + battleCommandBlvl) frames
 * Radius: Missiles.txt #149 shout Vel=16, Range=16 -> 256/24 = 10.67 subtiles
 * Mana: 6
 */
export function calculateShoutStats(
  slvl: number,
  battleOrdersBlvl = 0,
  battleCommandBlvl = 0
): ShoutStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      defenseBonusPct: 0,
      durationFrames: 0,
      durationSeconds: 0,
      radiusSubtiles: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  const baseDuration = 500 + 250 * (lvl - 1)
  const synDuration = 125 * (Math.max(0, battleOrdersBlvl) + Math.max(0, battleCommandBlvl))
  const totalFrames = baseDuration + synDuration
  return {
    defenseBonusPct: 100 + 10 * (lvl - 1),
    durationFrames: totalFrames,
    durationSeconds: Math.round((totalFrames / 25) * 10) / 10,
    radiusSubtiles: 10.67,
    manaCost: 6,
    manaCost256: 1536,
  }
}

/**
 * Skill 142: Find Item
 * Drop Chance %: dm(5, 60, slvl)
 * Mana: 7
 */
export function calculateFindItemStats(slvl: number): FindItemStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      dropChancePct: 0,
      noDropZero: true,
      requiresCorpse: true,
      allowsSkeletonCorpse: true,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  return {
    dropChancePct: computeDiminishingReturns(5, 60, lvl),
    noDropZero: true,
    requiresCorpse: true,
    allowsSkeletonCorpse: true,
    manaCost: 7,
    manaCost256: 1792,
  }
}

/**
 * Skill 146: Battle Cry
 * Duration: (300 + 60 * (slvl - 1)) / aiCurseDiv frames
 * Target Defense reduction: -(50 + 2 * (slvl - 1))%
 * Target Damage reduction: -(25 + 1 * (slvl - 1))%
 * Radius: Missiles.txt #219 battlecry Vel=16, Range=8 -> 128/24 = 5.33 subtiles
 * Mana: 5
 */
export function calculateBattleCryStats(
  slvl: number,
  difficulty: WarcryDifficulty = 0
): BattleCryStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      durationFrames: 0,
      durationSeconds: 0,
      targetDefenseReductionPct: 0,
      targetDamageReductionPct: 0,
      radiusSubtiles: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  const aiCurseDiv = resolveAiCurseDivisor(difficulty)
  const durationFrames = Math.floor((300 + 60 * (lvl - 1)) / aiCurseDiv)
  return {
    durationFrames,
    durationSeconds: Math.round((durationFrames / 25) * 10) / 10,
    targetDefenseReductionPct: 50 + 2 * (lvl - 1),
    targetDamageReductionPct: 25 + 1 * (lvl - 1),
    radiusSubtiles: 5.33,
    manaCost: 5,
    manaCost256: 1280,
  }
}

/**
 * Skill 149: Battle Orders
 * Life / Mana / Stamina %: 35 + 3 * (slvl - 1)%
 * Duration: 750 + 250 * (slvl - 1) + 125 * (shoutBlvl + battleCommandBlvl) frames
 * Radius: Missiles.txt #237 battleorders Vel=16, Range=16 -> 256/24 = 10.67 subtiles
 * Mana: 7
 */
export function calculateBattleOrdersStats(
  slvl: number,
  shoutBlvl = 0,
  battleCommandBlvl = 0
): BattleOrdersStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      maxLifeBonusPct: 0,
      maxManaBonusPct: 0,
      maxStaminaBonusPct: 0,
      durationFrames: 0,
      durationSeconds: 0,
      radiusSubtiles: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  const bonusPct = 35 + 3 * (lvl - 1)
  const baseDuration = 750 + 250 * (lvl - 1)
  const synDuration = 125 * (Math.max(0, shoutBlvl) + Math.max(0, battleCommandBlvl))
  const totalFrames = baseDuration + synDuration
  return {
    maxLifeBonusPct: bonusPct,
    maxManaBonusPct: bonusPct,
    maxStaminaBonusPct: bonusPct,
    durationFrames: totalFrames,
    durationSeconds: Math.round((totalFrames / 25) * 10) / 10,
    radiusSubtiles: 10.67,
    manaCost: 7,
    manaCost256: 1792,
  }
}

/**
 * Skill 150: Grim Ward
 * Totem life: 1000 frames (40s)
 * Flee radius: 3 + 1 * (slvl - 1) subtiles
 * Flee duration: 60 / aiCurseDiv frames (2.4s / 1.2s / 0.6s)
 * Mana: 4
 */
export function calculateGrimWardStats(
  slvl: number,
  difficulty: WarcryDifficulty = 0
): GrimWardStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      totemDurationFrames: 0,
      totemDurationSeconds: 0,
      fleeRadiusYards: 0,
      fleeRadiusSubtiles: 0,
      fleeDurationFrames: 0,
      fleeDurationSeconds: 0,
      requiresCorpse: true,
      requiresSoftCorpse: true,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  const aiCurseDiv = resolveAiCurseDivisor(difficulty)
  const fleeDurationFrames = Math.floor(60 / aiCurseDiv)
  const fleeRadiusSubtiles = 3 + 1 * (lvl - 1)
  return {
    totemDurationFrames: 1000,
    totemDurationSeconds: 40.0,
    fleeRadiusYards: fleeRadiusSubtiles,
    fleeRadiusSubtiles,
    fleeDurationFrames,
    fleeDurationSeconds: Math.round((fleeDurationFrames / 25) * 10) / 10,
    requiresCorpse: true,
    requiresSoftCorpse: true,
    manaCost: 4,
    manaCost256: 1024,
  }
}

/**
 * Skill 154: War Cry
 * 5-band physical damage: (20..30 base, +6 / +7 / +8 / +9 / +10)
 * Synergy: +6% damage per blvl in Howl, Taunt, Battle Cry
 * Stun duration: min(250, 25 + 5 * (slvl - 1)) frames
 * Radius: Missiles.txt #235 warcry Vel=16, Range=8 -> 128/24 = 5.33 subtiles
 * Mana: 10 + (slvl - 1)
 */
export function calculateWarCryStats(
  slvl: number,
  howlBlvl = 0,
  tauntBlvl = 0,
  battleCryBlvl = 0
): WarCryStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      minPhysicalDamage: 0,
      maxPhysicalDamage: 0,
      baseMinPhysicalDamage: 0,
      baseMaxPhysicalDamage: 0,
      synergyBonusPct: 0,
      stunDurationFrames: 0,
      stunDurationSeconds: 0,
      radiusSubtiles: 0,
      nextDelayFrames: 4,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  const baseMin = compute5BandScaling(lvl, 20, 6, 7, 8, 9, 10)
  const baseMax = compute5BandScaling(lvl, 30, 6, 7, 8, 9, 10)
  const synPoints = Math.max(0, howlBlvl) + Math.max(0, tauntBlvl) + Math.max(0, battleCryBlvl)
  const synergyBonusPct = synPoints * 6
  const finalMin = Math.floor((baseMin * (100 + synergyBonusPct)) / 100)
  const finalMax = Math.floor((baseMax * (100 + synergyBonusPct)) / 100)
  const stunFrames = Math.min(250, 25 + 5 * (lvl - 1))
  const mana = 10 + (lvl - 1)

  return {
    minPhysicalDamage: finalMin,
    maxPhysicalDamage: finalMax,
    baseMinPhysicalDamage: baseMin,
    baseMaxPhysicalDamage: baseMax,
    synergyBonusPct,
    stunDurationFrames: stunFrames,
    stunDurationSeconds: Math.round((stunFrames / 25) * 10) / 10,
    radiusSubtiles: 5.33,
    nextDelayFrames: 4,
    manaCost: mana,
    manaCost256: mana << 8,
  }
}

/**
 * Skill 155: Battle Command
 * +1 to All Skills (fixed)
 * Duration: 125 + 250 * (slvl - 1) + 125 * (shoutBlvl + battleOrdersBlvl) frames
 * Radius: Missiles.txt #236 battlecommand Vel=16, Range=16 -> 256/24 = 10.67 subtiles
 * Mana: 11
 */
export function calculateBattleCommandStats(
  slvl: number,
  shoutBlvl = 0,
  battleOrdersBlvl = 0
): BattleCommandStats {
  const lvl = Math.max(0, Math.floor(slvl))
  if (lvl === 0) {
    return {
      allSkillsBonus: 0,
      durationFrames: 0,
      durationSeconds: 0,
      radiusSubtiles: 0,
      manaCost: 0,
      manaCost256: 0,
    }
  }

  const baseDuration = 125 + 250 * (lvl - 1)
  const synDuration = 125 * (Math.max(0, shoutBlvl) + Math.max(0, battleOrdersBlvl))
  const totalFrames = baseDuration + synDuration
  return {
    allSkillsBonus: 1,
    durationFrames: totalFrames,
    durationSeconds: Math.round((totalFrames / 25) * 10) / 10,
    radiusSubtiles: 10.67,
    manaCost: 11,
    manaCost256: 2816,
  }
}

/**
 * Unified dispatch evaluation for Barbarian Warcries.
 */
export function evaluateBarbarianWarcry(
  skillId: number,
  slvl: number,
  synergies: {
    howlBlvl?: number
    tauntBlvl?: number
    shoutBlvl?: number
    battleCryBlvl?: number
    battleOrdersBlvl?: number
    battleCommandBlvl?: number
    difficulty?: WarcryDifficulty
  } = {}
) {
  switch (skillId) {
    case 130:
      return calculateHowlStats(slvl, synergies.difficulty ?? 0)
    case 131:
      return calculateFindPotionStats(slvl)
    case 137:
      return calculateTauntStats(slvl)
    case 138:
      return calculateShoutStats(
        slvl,
        synergies.battleOrdersBlvl ?? 0,
        synergies.battleCommandBlvl ?? 0
      )
    case 142:
      return calculateFindItemStats(slvl)
    case 146:
      return calculateBattleCryStats(slvl, synergies.difficulty ?? 0)
    case 149:
      return calculateBattleOrdersStats(
        slvl,
        synergies.shoutBlvl ?? 0,
        synergies.battleCommandBlvl ?? 0
      )
    case 150:
      return calculateGrimWardStats(slvl, synergies.difficulty ?? 0)
    case 154:
      return calculateWarCryStats(
        slvl,
        synergies.howlBlvl ?? 0,
        synergies.tauntBlvl ?? 0,
        synergies.battleCryBlvl ?? 0
      )
    case 155:
      return calculateBattleCommandStats(
        slvl,
        synergies.shoutBlvl ?? 0,
        synergies.battleOrdersBlvl ?? 0
      )
    default:
      return null
  }
}

/**
 * Validate 1.13c Corpse target validity for Barbarian Warcries:
 * - Find Potion (#131), Find Item (#142), and Grim Ward (#150)
 * Ground Truth (D2Game SkillBar.cpp: SKILLS_SrvSt33_FindPotion_GrimWard, SKILLS_SrvSt34_FindItem;
 * D2Common: D2Common_11020 / SKILLS_CanUnitCorpseBeSelected):
 * 1. Must be a valid corpse (`!corpse` fails with `no_corpse`)
 * 2. Must not be already consumed / selected (`corpse.consumed`, `stateId === 104`, `stateId === 118`, `noSelect`, `noDraw` fails with `already_consumed`)
 * 3. Must not be shattered by cold / freeze death (`corpse.shattered` fails with `corpse_shattered`)
 * 4. Must not be a boss corpse (`corpse.isBoss` fails with `boss_corpse_invalid`)
 * 5. For #131 Find Potion & #150 Grim Ward (`srvstfunc = 33`), corpse must have `bSoft == 1` (`corpse.isSoft === false` fails with `corpse_not_soft`).
 *    For #142 Find Item (`srvstfunc = 34`), `bSoft` is NOT required (skeleton corpses ARE valid).
 */
export function validateBarbarianCorpseTarget(
  skillId: number,
  corpse?: {
    consumed?: boolean
    shattered?: boolean
    isBoss?: boolean
    isSoft?: boolean
    stateId?: number
    states?: ReadonlySet<number> | readonly number[]
    noSelect?: boolean
    noDraw?: boolean
  },
): {
  valid: boolean
  reason?: 'no_corpse' | 'already_consumed' | 'corpse_shattered' | 'boss_corpse_invalid' | 'corpse_not_soft'
} {
  if (!corpse) return { valid: false, reason: 'no_corpse' }
  const hasConsumedState =
    corpse.stateId === 104 ||
    corpse.stateId === 118 ||
    (corpse.states instanceof Set
      ? corpse.states.has(104) || corpse.states.has(118)
      : Array.isArray(corpse.states)
        ? corpse.states.includes(104) || corpse.states.includes(118)
        : false)
  if (corpse.consumed || hasConsumedState || corpse.noSelect || corpse.noDraw) {
    return { valid: false, reason: 'already_consumed' }
  }
  if (corpse.shattered) return { valid: false, reason: 'corpse_shattered' }
  if (corpse.isBoss) return { valid: false, reason: 'boss_corpse_invalid' }
  if ((skillId === 131 || skillId === 150) && corpse.isSoft === false) {
    return { valid: false, reason: 'corpse_not_soft' }
  }
  return { valid: true }
}
