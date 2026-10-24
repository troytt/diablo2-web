/**
 * Diablo II: Lord of Destruction v1.13c — Druid Summoning Skills Module
 *
 * Dedicated pure calculation, PetType group exclusivity, cross-synergy (.lvl),
 * totem aura, vine corpse-cycling, and AI sub-skill formulas for the 10 Druid
 * Summoning Tree Skills and their 9 AI sub-skills:
 *
 * Player Summoning Skills:
 * - Skill 221: Raven (ReqLevel 1) — PetType 'raven' (group 0, max min(lvl, 5), 12+(lvl-1) hits, blind on normal monsters)
 * - Skill 222: Poison Creeper (ReqLevel 1) — PetType 'vine' (group 2, max 1, #294 Vine Attack poison mat)
 * - Skill 226: Oak Sage (ReqLevel 6) — PetType 'totem' (group 1, max 1, #296 Royal Shield +maxhp% aura, state 149 'oaksage')
 * - Skill 227: Summon Spirit Wolf (ReqLevel 6) — PetType 'wolf' (group 3, max min(lvl, 5), #292 Teleport, cross-synergy)
 * - Skill 231: Carrion Vine (ReqLevel 12) — PetType 'vine' (group 2, max 1, #307 CorpseCycler dm(3,12)% HP heal)
 * - Skill 236: Heart of Wolverine (ReqLevel 18) — PetType 'totem' (group 1, max 1, #297 Heart of Wolverine +ED%/+AR% aura, state 148 'wolverine')
 * - Skill 237: Summon Dire Wolf (ReqLevel 18) — PetType 'fenris' (group 3, max min(lvl, 3), #314 Fenris Rage corpse buff, cross-synergy)
 * - Skill 241: Solar Creeper (ReqLevel 24) — PetType 'vine' (group 2, max 1, #325 VineCycler dm(1,8)% Mana restore)
 * - Skill 246: Spirit of Barbs (ReqLevel 30) — PetType 'totem' (group 1, max 1, #298 Spirit of Barbs thorns_percent aura, state 147 'barbs')
 * - Skill 247: Summon Grizzly (ReqLevel 30) — PetType 'grizzly' (group 3, max 1, #326 BearSmite knockback + stun, cross-synergy)
 *
 * 1.13c Ground Truth:
 * - Skills.txt, PetType.txt, MonStats.txt, Missiles.txt, States.txt (Patch_D2.mpq)
 * - Druid Summoning cross-synergies (#227, #237, #247) use effective `.lvl` (including +skills), NOT `.blvl`!
 * - Zero runtime MPQ reading.
 */

import { compute5BandScaling, computeDiminishingReturns } from '../../common/data/calc-ast.ts'

export const DRUID_SUMMONING_SKILL_IDS = {
  RAVEN: 221,
  POISON_CREEPER: 222,
  OAK_SAGE: 226,
  SUMMON_SPIRIT_WOLF: 227,
  CARRION_VINE: 231,
  HEART_OF_WOLVERINE: 236,
  SUMMON_DIRE_WOLF: 237,
  SOLAR_CREEPER: 241,
  SPIRIT_OF_BARBS: 246,
  SUMMON_GRIZZLY: 247,
} as const

export const DRUID_PET_SUB_SKILL_IDS = {
  SPIRIT_WOLF_TELEPORT: 292,
  VINE_ATTACK: 294,
  SPIRIT_OF_BARBS_AURA: 296,
  HEART_OF_WOLVERINE_AURA: 297,
  OAK_SAGE_AURA: 298,
  CORPSE_CYCLER: 307,
  FENRIS_RAGE: 314,
  VINE_CYCLER: 325,
  BEAR_SMITE: 326,
} as const

export const DRUID_PET_GROUPS = {
  RAVEN: 0,
  TOTEM: 1,
  VINE: 2,
  BEAST: 3,
} as const

export interface DruidBeastSynergyLevels {
  /** Effective skill level (.lvl, including +skills) of #227 Summon Spirit Wolf */
  readonly spiritWolfSlvl?: number
  /** Effective skill level (.lvl, including +skills) of #237 Summon Dire Wolf */
  readonly direWolfSlvl?: number
  /** Effective skill level (.lvl, including +skills) of #247 Summon Grizzly */
  readonly grizzlySlvl?: number
}

export interface RavenStats {
  readonly skillId: 221
  readonly maxCount: number
  readonly petCount: number
  readonly maxHits: number
  readonly hitCount: number
  readonly hp: 100
  readonly minPhysDamage: number
  readonly maxPhysDamage: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly minPhysDmg: number
  readonly maxPhysDmg: number
  readonly attackRatingBonus: number
  readonly velocityBonusPct: number
  readonly petLevel: number
  readonly blindChancePct: number
  readonly dimVisionSlvl: number
  readonly blindDurationFrames: number
  readonly dimVisionDurationFrames: number
  readonly blindDurationSeconds: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly petType: 'raven'
  readonly petGroup: 0
  readonly monId: 'druidhawk'
  readonly classId: 419
  readonly invulnerable: true
}

export interface PoisonCreeperStats {
  readonly skillId: 222
  readonly maxCount: 1
  readonly baseHpMin: 34
  readonly baseHpMax: 46
  readonly baseHpAvg: 40
  readonly hpScalingPct: number
  readonly minHp: number
  readonly maxHp: number
  readonly hp: number
  readonly maxHpRoll: number
  readonly petLevel: number
  readonly eMinRate256: number
  readonly eMaxRate256: number
  readonly poisonMinRate256: number
  readonly poisonMaxRate256: number
  readonly minPoisonDamage: number
  readonly maxPoisonDamage: number
  readonly poisonMinDamage: number
  readonly poisonMaxDamage: number
  readonly totalPoisonMin: number
  readonly totalPoisonMax: number
  readonly totalPoisonMin256: number
  readonly totalPoisonMax256: number
  readonly poisonDurationFrames: 100
  readonly poisonLengthFrames: 100
  readonly poisonDurationSeconds: 4
  readonly manaCost: 8
  readonly manaCost256: 2048
  readonly petType: 'vine'
  readonly petGroup: 2
  readonly monId: 'plaguepoppy'
  readonly classId: 425
  readonly stateId: 150
  readonly stateName: 'vine_beast'
  readonly subSkillIds: readonly [294]
}

export interface DruidTotemResistances {
  readonly poisonResist: 100
  readonly fireResist: 25
  readonly lightResist: 25
  readonly coldResist: 25
  readonly magicResist: 25
  readonly physicalResist: 0 | 100
  readonly damageResist: 0 | 100
}

export interface OakSageStats extends DruidTotemResistances {
  readonly skillId: 226
  readonly maxCount: 1
  readonly baseHpMin: 56
  readonly baseHpMax: 64
  readonly baseHpAvg: 60
  readonly hpScalingPct: number
  readonly minHp: number
  readonly maxHp: number
  readonly hp: number
  readonly maxHpRoll: number
  readonly auraSkillId: 298
  readonly auraSubSkillId: 298
  readonly stateId: 149
  readonly stateName: 'oaksage'
  readonly auraStateName: 'oaksage'
  readonly auraLifeBonusPct: number
  readonly maxLifeBonusPct: number
  readonly hpBonusPct: number
  readonly auraRadiusSubtiles: number
  readonly auraRadiusYards: number
  readonly petLevel: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly petType: 'totem'
  readonly petGroup: 1
  readonly monId: 'oaksage'
  readonly classId: 424
  readonly subSkillIds: readonly [298]
  readonly resistances: DruidTotemResistances
}

export interface HeartOfWolverineStats extends DruidTotemResistances {
  readonly skillId: 236
  readonly maxCount: 1
  readonly baseHpMin: 128
  readonly baseHpMax: 144
  readonly baseHpAvg: 136
  readonly hpScalingPct: number
  readonly minHp: number
  readonly maxHp: number
  readonly hp: number
  readonly maxHpRoll: number
  readonly auraSkillId: 297
  readonly auraSubSkillId: 297
  readonly stateId: 148
  readonly stateName: 'wolverine'
  readonly auraStateName: 'wolverine'
  readonly auraDamageBonusPct: number
  readonly damageBonusPct: number
  readonly auraAttackRatingBonusPct: number
  readonly attackRatingBonusPct: number
  readonly toHitBonusPct: number
  readonly auraRadiusSubtiles: number
  readonly auraRadiusYards: number
  readonly petLevel: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly petType: 'totem'
  readonly petGroup: 1
  readonly monId: 'heartofwolverine'
  readonly classId: 423
  readonly subSkillIds: readonly [297]
  readonly resistances: DruidTotemResistances
}

export interface SpiritOfBarbsStats extends DruidTotemResistances {
  readonly skillId: 246
  readonly maxCount: 1
  readonly baseHpMin: 200
  readonly baseHpMax: 226
  readonly baseHpAvg: 213
  readonly hpScalingPct: number
  readonly minHp: number
  readonly maxHp: number
  readonly hp: number
  readonly maxHpRoll: number
  readonly auraSkillId: 296
  readonly auraSubSkillId: 296
  readonly stateId: 147
  readonly stateName: 'barbs'
  readonly auraStateName: 'barbs'
  readonly auraThornsReturnPct: number
  readonly tooltipThornsReturnPct: number
  readonly thornsReflectPct: number
  readonly thornsPercent: number
  readonly auraRadiusSubtiles: number
  readonly auraRadiusYards: number
  readonly petLevel: number
  readonly manaCost: number
  readonly manaCost256: number
  readonly petType: 'totem'
  readonly petGroup: 1
  readonly monId: 'spiritofbarbs'
  readonly classId: 422
  readonly subSkillIds: readonly [296]
  readonly resistances: DruidTotemResistances
}

export interface CarrionVineStats {
  readonly skillId: 231
  readonly maxCount: 1
  readonly baseHpMin: 80
  readonly baseHpMax: 110
  readonly baseHpAvg: 95
  readonly hpScalingPct: number
  readonly minHp: number
  readonly maxHp: number
  readonly hp: number
  readonly maxHpRoll: number
  readonly healLifePct: number
  readonly healMaxHpPct: number
  readonly healHpPct: number
  readonly petLevel: number
  readonly manaCost: 10
  readonly manaCost256: 2560
  readonly petType: 'vine'
  readonly petGroup: 2
  readonly monId: 'cycleoflife'
  readonly classId: 426
  readonly stateId: 150
  readonly stateName: 'vine_beast'
  readonly subSkillIds: readonly [307, 294]
}

export interface SolarCreeperStats {
  readonly skillId: 241
  readonly maxCount: 1
  readonly baseHpMin: 138
  readonly baseHpMax: 192
  readonly baseHpAvg: 165
  readonly hpScalingPct: number
  readonly minHp: number
  readonly maxHp: number
  readonly hp: number
  readonly maxHpRoll: number
  readonly restoreManaPct: number
  readonly manaRecoverMaxPct: number
  readonly manaRecoverPct: number
  readonly petLevel: number
  readonly manaCost: 14
  readonly manaCost256: 3584
  readonly petType: 'vine'
  readonly petGroup: 2
  readonly monId: 'vinecreature'
  readonly classId: 427
  readonly stateId: 150
  readonly stateName: 'vine_beast'
  readonly subSkillIds: readonly [325, 294]
}

export interface SummonSpiritWolfStats {
  readonly skillId: 227
  readonly maxCount: number
  readonly petCount: number
  readonly baseHpMin: 60
  readonly baseHpMax: 82
  readonly baseHpAvg: 71
  readonly hpBonusPct: number
  readonly synergyLifePct: number
  readonly minHp: number
  readonly maxHp: number
  readonly hp: number
  readonly maxHpRoll: number
  readonly attackRatingBonusPct: number
  readonly selfDefenseBonusPct: number
  readonly defenseBonusPct: number
  readonly damageBonusPct: number
  readonly synergyDamagePct: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly minPhysDamage: number
  readonly maxPhysDamage: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly allResistancesPct: number
  readonly elemResist: number
  readonly petLevel: number
  readonly manaCost: 15
  readonly manaCost256: 3840
  readonly petType: 'wolf'
  readonly petGroup: 3
  readonly monId: 'spiritwolf'
  readonly classId: 420
  readonly subSkillIds: readonly [292]
}

export interface SummonDireWolfStats {
  readonly skillId: 237
  readonly maxCount: number
  readonly petCount: number
  readonly baseHpMin: 98
  readonly baseHpMax: 130
  readonly baseHpAvg: 114
  readonly hpBonusPct: number
  readonly selfLifeBonusPct: number
  readonly minHp: number
  readonly maxHp: number
  readonly hp: number
  readonly maxHpRoll: number
  readonly attackRatingBonusPct: number
  readonly synergyArPct: number
  readonly selfDefenseBonusPct: number
  readonly spiritWolfDefenseBonusPct: number
  readonly defenseBonusPct: number
  readonly totalDefenseBonusPct: number
  readonly grizzlyDamageBonusPct: number
  readonly synergyDamagePct: number
  readonly rageDamageBonusPct: number
  readonly fenrisRageDamageBonusPct: number
  readonly fenrisRageBonusPct: number
  readonly rageDurationFrames: 500
  readonly fenrisRageDurationFrames: 500
  readonly damageBonusPct: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly minPhysDamage: number
  readonly maxPhysDamage: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly allResistancesPct: number
  readonly elemResist: number
  readonly petLevel: number
  readonly manaCost: 20
  readonly manaCost256: 5120
  readonly petType: 'fenris'
  readonly petGroup: 3
  readonly monId: 'fenris'
  readonly classId: 421
  readonly subSkillIds: readonly [314, 292]
}

export interface SummonGrizzlyStats {
  readonly skillId: 247
  readonly maxCount: 1
  readonly petCount: 1
  readonly baseHpMin: 550
  readonly baseHpMax: 750
  readonly baseHpAvg: 650
  readonly hpBonusPct: number
  readonly synergyLifePct: number
  readonly minHp: number
  readonly maxHp: number
  readonly hp: number
  readonly maxHpRoll: number
  readonly attackRatingBonusPct: number
  readonly synergyArPct: number
  readonly defenseBonusPct: number
  readonly synergyDefensePct: number
  /** Actual 1.13c passivecalc3 = ln34 = 15 + 10*(slvl-1)% */
  readonly damageBonusPct: number
  readonly selfDamageBonusPct: number
  /** Tooltip descLine 4 calca = ln56 = 25 + 10*(slvl-1)% */
  readonly tooltipDamageBonusPct: number
  readonly bearSmiteDamageBonusPct: number
  readonly bearSmiteStunFrames: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly minPhysDamage: number
  readonly maxPhysDamage: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly smiteMinPhysDamage: number
  readonly smiteMaxPhysDamage: number
  readonly allResistancesPct: number
  readonly elemResist: number
  readonly petLevel: number
  readonly manaCost: 40
  readonly manaCost256: 10240
  readonly petType: 'grizzly'
  readonly petGroup: 3
  readonly monId: 'druidbear'
  readonly classId: 428
  readonly subSkillIds: readonly [326]
}

export interface SpiritWolfTeleportStats {
  readonly skillId: 292
  readonly maxRangeSubtiles: number
}

export interface VineAttackStats {
  readonly skillId: 294
  readonly eMinRate256: number
  readonly eMaxRate256: number
  readonly minPoisonDamage: number
  readonly maxPoisonDamage: number
  readonly durationFrames: 100
  readonly missilePrimary: 'plague vines'
  readonly missileTrail: 'plague vines trail'
}

export interface CorpseCyclerStats {
  readonly skillId: 307
  readonly healLifePct: number
  readonly healMaxHpPct: number
  readonly healHpPct: number
  readonly healAmount256: number
}

export interface FenrisRageStats {
  readonly skillId: 314
  readonly stateId: 138
  readonly stateName: 'fenris_rage'
  readonly damageBonusPct: number
  readonly attackRatingBonusPct: number
  readonly velocityBonusPct: number
  readonly durationFrames: 500
}

export interface VineCyclerStats {
  readonly skillId: 325
  readonly restoreManaPct: number
  readonly manaRecoverMaxPct: number
  readonly manaRecoverPct: number
  readonly restoreAmount256: number
}

export interface BearSmiteStats {
  readonly skillId: 326
  readonly damageBonusPct: number
  readonly stunDurationFrames: number
  readonly stunLengthFrames: number
  readonly knockback: true
}

export function resolveDruidTotemResistances(
  difficulty: 'normal' | 'nightmare' | 'hell' | number = 'normal',
): DruidTotemResistances {
  const isNightmare = difficulty === 'nightmare' || difficulty === 1
  const phys = isNightmare ? 100 : 0
  return {
    poisonResist: 100,
    fireResist: 25,
    lightResist: 25,
    coldResist: 25,
    magicResist: 25,
    physicalResist: phys,
    damageResist: phys,
  }
}

function resolveTotemArgs(
  ownerLevelOrDifficulty: number | 'normal' | 'nightmare' | 'hell' | undefined,
  difficultyArg: 'normal' | 'nightmare' | 'hell' | number | undefined,
  argCount: number,
): { clvl: number; difficulty: 'normal' | 'nightmare' | 'hell' | number } {
  if (typeof ownerLevelOrDifficulty === 'string') {
    return { clvl: 1, difficulty: ownerLevelOrDifficulty }
  }
  if (
    argCount === 2 &&
    (ownerLevelOrDifficulty === 0 || ownerLevelOrDifficulty === 1 || ownerLevelOrDifficulty === 2)
  ) {
    // Allow 2-arg call (slvl, difficulty) where difficulty is 'normal'|'nightmare'|'hell' or 0|1|2
    return { clvl: Math.max(1, Math.trunc(ownerLevelOrDifficulty)), difficulty: ownerLevelOrDifficulty }
  }
  return {
    clvl: Math.max(1, Math.trunc(ownerLevelOrDifficulty ?? 1)),
    difficulty: difficultyArg ?? 'normal',
  }
}

/**
 * #221 Raven (1.13c `Skills.txt` row 221 + `SKILLS_SrvDo118_Raven` / `SKILLS_Click_Raven`).
 */
export function calculateRavenStats(
  slvl: number,
  ownerLevel = 1,
  targetLevel = ownerLevel,
): RavenStats {
  const s = Math.max(1, Math.trunc(slvl))
  const clvl = Math.max(1, Math.trunc(ownerLevel))
  const mlvl = Math.max(1, Math.trunc(targetLevel))

  const maxCount = Math.min(s, 5)
  const maxHits = 12 + (s - 1)
  const minPhysDamage = compute5BandScaling(s, 2, 1, 1, 1, 1, 1)
  const maxPhysDamage = compute5BandScaling(s, 4, 1, 1, 1, 1, 1)
  const attackRatingBonus = 100 + 15 * (s - 1)
  const velocityBonusPct = 50 + 2 * (s - 1)
  const petLevel = Math.max(1, clvl - 2 + s)

  const blindChancePct = Math.max(5, Math.min(100, 50 + 5 * (clvl - 2 + s - mlvl)))
  const dimVisionSlvl = Math.max(1, Math.floor((blindChancePct - 35) / 5))
  const blindDurationFrames = 50 + 15 * (dimVisionSlvl - 1)

  return {
    skillId: 221,
    maxCount,
    petCount: maxCount,
    maxHits,
    hitCount: maxHits,
    hp: 100,
    minPhysDamage,
    maxPhysDamage,
    minDamage: minPhysDamage,
    maxDamage: maxPhysDamage,
    minPhysDmg: minPhysDamage,
    maxPhysDmg: maxPhysDamage,
    attackRatingBonus,
    velocityBonusPct,
    petLevel,
    blindChancePct,
    dimVisionSlvl,
    blindDurationFrames,
    dimVisionDurationFrames: blindDurationFrames,
    blindDurationSeconds: blindDurationFrames / 25,
    manaCost: 6,
    manaCost256: 6 * 256,
    petType: 'raven',
    petGroup: 0,
    monId: 'druidhawk',
    classId: 419,
    invulnerable: true,
  }
}

/**
 * #222 Poison Creeper & #294 Vine Attack (1.13c `Skills.txt` rows 222, 294 + `MonStats.txt` `plaguepoppy`).
 */
export function calculatePoisonCreeperStats(
  slvl: number,
  ownerLevel = 1,
): PoisonCreeperStats {
  const s = Math.max(1, Math.trunc(slvl))
  const clvl = Math.max(1, Math.trunc(ownerLevel))

  const baseHpMin = 34
  const baseHpMax = 46
  const baseHpAvg = 40
  const hpScalingPct = 25 * (s - 1)
  const minHp = Math.floor((baseHpMin * (100 + hpScalingPct)) / 100)
  const maxHp = Math.floor((baseHpAvg * (100 + hpScalingPct)) / 100)
  const maxHpRoll = Math.floor((baseHpMax * (100 + hpScalingPct)) / 100)
  const petLevel = Math.floor((3 * clvl) / 4) + s

  const eMinRate256 = compute5BandScaling(s, 12, 7, 12, 15, 17, 19)
  const eMaxRate256 = compute5BandScaling(s, 16, 7, 12, 15, 17, 19)
  const poisonDurationFrames = 100
  const minPoisonDamage = Math.floor((eMinRate256 * poisonDurationFrames) / 256)
  const maxPoisonDamage = Math.floor((eMaxRate256 * poisonDurationFrames) / 256)

  return {
    skillId: 222,
    maxCount: 1,
    baseHpMin,
    baseHpMax,
    baseHpAvg,
    hpScalingPct,
    minHp,
    maxHp,
    hp: maxHp,
    maxHpRoll,
    petLevel,
    eMinRate256,
    eMaxRate256,
    poisonMinRate256: eMinRate256,
    poisonMaxRate256: eMaxRate256,
    minPoisonDamage,
    maxPoisonDamage,
    poisonMinDamage: minPoisonDamage,
    poisonMaxDamage: maxPoisonDamage,
    totalPoisonMin: minPoisonDamage,
    totalPoisonMax: maxPoisonDamage,
    totalPoisonMin256: eMinRate256 * poisonDurationFrames,
    totalPoisonMax256: eMaxRate256 * poisonDurationFrames,
    poisonDurationFrames,
    poisonLengthFrames: poisonDurationFrames,
    poisonDurationSeconds: 4,
    manaCost: 8,
    manaCost256: 2048,
    petType: 'vine',
    petGroup: 2,
    monId: 'plaguepoppy',
    classId: 425,
    stateId: 150,
    stateName: 'vine_beast',
    subSkillIds: [294],
  }
}

/**
 * #226 Oak Sage & #296 Royal Shield Aura (1.13c `Skills.txt` rows 226, 296 + `MonStats.txt` `oaksage`).
 */
export function calculateOakSageStats(
  slvl: number,
  ownerLevelOrDifficulty: number | 'normal' | 'nightmare' | 'hell' = 1,
  difficultyArg?: 'normal' | 'nightmare' | 'hell' | number,
): OakSageStats {
  const s = Math.max(1, Math.trunc(slvl))
  const { clvl, difficulty } = resolveTotemArgs(ownerLevelOrDifficulty, difficultyArg, arguments.length)

  const baseHpMin = 56
  const baseHpMax = 64
  const baseHpAvg = 60
  const hpScalingPct = 30 * (s - 1)
  const minHp = Math.floor((baseHpMin * (100 + hpScalingPct)) / 100)
  const maxHp = Math.floor((baseHpAvg * (100 + hpScalingPct)) / 100)
  const maxHpRoll = Math.floor((baseHpMax * (100 + hpScalingPct)) / 100)

  const auraLifeBonusPct = 30 + 5 * (s - 1)
  const auraRadiusSubtiles = 30 + 2 * (s - 1)
  const auraRadiusYards = Math.floor((auraRadiusSubtiles * 2) / 3)
  const manaCost = 15 + (s - 1)
  const resists = resolveDruidTotemResistances(difficulty)

  return {
    skillId: 226,
    maxCount: 1,
    baseHpMin,
    baseHpMax,
    baseHpAvg,
    hpScalingPct,
    minHp,
    maxHp,
    hp: maxHp,
    maxHpRoll,
    auraSkillId: 298,
    auraSubSkillId: 298,
    stateId: 149,
    stateName: 'oaksage',
    auraStateName: 'oaksage',
    auraLifeBonusPct,
    maxLifeBonusPct: auraLifeBonusPct,
    hpBonusPct: auraLifeBonusPct,
    auraRadiusSubtiles,
    auraRadiusYards,
    petLevel: clvl,
    manaCost,
    manaCost256: manaCost * 256,
    petType: 'totem',
    petGroup: 1,
    monId: 'oaksage',
    classId: 424,
    subSkillIds: [298],
    resistances: resists,
    ...resists,
  }
}

/**
 * #236 Heart of Wolverine & #297 Aura (1.13c `Skills.txt` rows 236, 297 + `MonStats.txt` `heartofwolverine`).
 */
export function calculateHeartOfWolverineStats(
  slvl: number,
  ownerLevelOrDifficulty: number | 'normal' | 'nightmare' | 'hell' = 1,
  difficultyArg?: 'normal' | 'nightmare' | 'hell' | number,
): HeartOfWolverineStats {
  const s = Math.max(1, Math.trunc(slvl))
  const { clvl, difficulty } = resolveTotemArgs(ownerLevelOrDifficulty, difficultyArg, arguments.length)

  const baseHpMin = 128
  const baseHpMax = 144
  const baseHpAvg = 136
  const hpScalingPct = 25 * (s - 1)
  const minHp = Math.floor((baseHpMin * (100 + hpScalingPct)) / 100)
  const maxHp = Math.floor((baseHpAvg * (100 + hpScalingPct)) / 100)
  const maxHpRoll = Math.floor((baseHpMax * (100 + hpScalingPct)) / 100)

  const auraDamageBonusPct = 20 + 7 * (s - 1)
  const auraAttackRatingBonusPct = 25 + 7 * (s - 1)
  const auraRadiusSubtiles = 30 + 2 * (s - 1)
  const auraRadiusYards = Math.floor((auraRadiusSubtiles * 2) / 3)
  const manaCost = 20 + (s - 1)
  const resists = resolveDruidTotemResistances(difficulty)

  return {
    skillId: 236,
    maxCount: 1,
    baseHpMin,
    baseHpMax,
    baseHpAvg,
    hpScalingPct,
    minHp,
    maxHp,
    hp: maxHp,
    maxHpRoll,
    auraSkillId: 297,
    auraSubSkillId: 297,
    stateId: 148,
    stateName: 'wolverine',
    auraStateName: 'wolverine',
    auraDamageBonusPct,
    damageBonusPct: auraDamageBonusPct,
    auraAttackRatingBonusPct,
    attackRatingBonusPct: auraAttackRatingBonusPct,
    toHitBonusPct: auraAttackRatingBonusPct,
    auraRadiusSubtiles,
    auraRadiusYards,
    petLevel: clvl,
    manaCost,
    manaCost256: manaCost * 256,
    petType: 'totem',
    petGroup: 1,
    monId: 'heartofwolverine',
    classId: 423,
    subSkillIds: [297],
    resistances: resists,
    ...resists,
  }
}

/**
 * #246 Spirit of Barbs & #298 Aura (1.13c `Skills.txt` rows 246, 298 + `MonStats.txt` `spiritofbarbs`).
 */
export function calculateSpiritOfBarbsStats(
  slvl: number,
  ownerLevelOrDifficulty: number | 'normal' | 'nightmare' | 'hell' = 1,
  difficultyArg?: 'normal' | 'nightmare' | 'hell' | number,
): SpiritOfBarbsStats {
  const s = Math.max(1, Math.trunc(slvl))
  const { clvl, difficulty } = resolveTotemArgs(ownerLevelOrDifficulty, difficultyArg, arguments.length)

  const baseHpMin = 200
  const baseHpMax = 226
  const baseHpAvg = 213
  const hpScalingPct = 25 * (s - 1)
  const minHp = Math.floor((baseHpMin * (100 + hpScalingPct)) / 100)
  const maxHp = Math.floor((baseHpAvg * (100 + hpScalingPct)) / 100)
  const maxHpRoll = Math.floor((baseHpMax * (100 + hpScalingPct)) / 100)

  const auraThornsReturnPct = 50 + 10 * (s - 1)
  const tooltipThornsReturnPct = 50 + 20 * (s - 1)
  const auraRadiusSubtiles = 30 + 2 * (s - 1)
  const auraRadiusYards = Math.floor((auraRadiusSubtiles * 2) / 3)
  const manaCost = 25 + (s - 1)
  const resists = resolveDruidTotemResistances(difficulty)

  return {
    skillId: 246,
    maxCount: 1,
    baseHpMin,
    baseHpMax,
    baseHpAvg,
    hpScalingPct,
    minHp,
    maxHp,
    hp: maxHp,
    maxHpRoll,
    auraSkillId: 296,
    auraSubSkillId: 296,
    stateId: 147,
    stateName: 'barbs',
    auraStateName: 'barbs',
    auraThornsReturnPct,
    tooltipThornsReturnPct,
    thornsReflectPct: auraThornsReturnPct,
    thornsPercent: auraThornsReturnPct,
    auraRadiusSubtiles,
    auraRadiusYards,
    petLevel: clvl,
    manaCost,
    manaCost256: manaCost * 256,
    petType: 'totem',
    petGroup: 1,
    monId: 'spiritofbarbs',
    classId: 422,
    subSkillIds: [296],
    resistances: resists,
    ...resists,
  }
}

/**
 * #231 Carrion Vine & #307 CorpseCycler (1.13c `Skills.txt` rows 231, 307 + `MonStats.txt` `cycleoflife`).
 */
export function calculateCarrionVineStats(
  slvl: number,
  ownerLevel = 1,
): CarrionVineStats {
  const s = Math.max(1, Math.trunc(slvl))
  const clvl = Math.max(1, Math.trunc(ownerLevel))

  const baseHpMin = 80
  const baseHpMax = 110
  const baseHpAvg = 95
  const hpScalingPct = 20 * (s - 1)
  const minHp = Math.floor((baseHpMin * (100 + hpScalingPct)) / 100)
  const maxHp = Math.floor((baseHpAvg * (100 + hpScalingPct)) / 100)
  const maxHpRoll = Math.floor((baseHpMax * (100 + hpScalingPct)) / 100)
  const healLifePct = computeDiminishingReturns(3, 12, s)
  const petLevel = Math.floor((3 * clvl) / 4) + s

  return {
    skillId: 231,
    maxCount: 1,
    baseHpMin,
    baseHpMax,
    baseHpAvg,
    hpScalingPct,
    minHp,
    maxHp,
    hp: maxHp,
    maxHpRoll,
    healLifePct,
    healMaxHpPct: healLifePct,
    healHpPct: healLifePct,
    petLevel,
    manaCost: 10,
    manaCost256: 2560,
    petType: 'vine',
    petGroup: 2,
    monId: 'cycleoflife',
    classId: 426,
    stateId: 150,
    stateName: 'vine_beast',
    subSkillIds: [307, 294],
  }
}

/**
 * #241 Solar Creeper & #325 VineCycler (1.13c `Skills.txt` rows 241, 325 + `MonStats.txt` `vinecreature`).
 */
export function calculateSolarCreeperStats(
  slvl: number,
  ownerLevel = 1,
): SolarCreeperStats {
  const s = Math.max(1, Math.trunc(slvl))
  const clvl = Math.max(1, Math.trunc(ownerLevel))

  const baseHpMin = 138
  const baseHpMax = 192
  const baseHpAvg = 165
  const hpScalingPct = 20 * (s - 1)
  const minHp = Math.floor((baseHpMin * (100 + hpScalingPct)) / 100)
  const maxHp = Math.floor((baseHpAvg * (100 + hpScalingPct)) / 100)
  const maxHpRoll = Math.floor((baseHpMax * (100 + hpScalingPct)) / 100)
  const restoreManaPct = computeDiminishingReturns(1, 8, s)
  const petLevel = Math.floor((3 * clvl) / 4) + s

  return {
    skillId: 241,
    maxCount: 1,
    baseHpMin,
    baseHpMax,
    baseHpAvg,
    hpScalingPct,
    minHp,
    maxHp,
    hp: maxHp,
    maxHpRoll,
    restoreManaPct,
    manaRecoverMaxPct: restoreManaPct,
    manaRecoverPct: restoreManaPct,
    petLevel,
    manaCost: 14,
    manaCost256: 3584,
    petType: 'vine',
    petGroup: 2,
    monId: 'vinecreature',
    classId: 427,
    stateId: 150,
    stateName: 'vine_beast',
    subSkillIds: [325, 294],
  }
}

/**
 * #227 Summon Spirit Wolf (1.13c `Skills.txt` row 227 + `MonStats.txt` `spiritwolf`).
 * Cross-synergies use effective `.lvl` of #237 Dire Wolf and #247 Grizzly!
 * Supports both `(slvl, { direWolfSlvl, grizzlySlvl }, ownerLevel)` and `(slvl, direWolfSlvl, grizzlySlvl, ownerLevel)`.
 */
export function calculateSummonSpiritWolfStats(
  slvl: number,
  synergiesOrDireWolfSlvl: DruidBeastSynergyLevels | number = {},
  ownerLevelOrGrizzlySlvl = 1,
  ownerLevelIfPositional = 1,
): SummonSpiritWolfStats {
  const s = Math.max(1, Math.trunc(slvl))
  let dwSlvl = 0
  let grizSlvl = 0
  let clvl = 1

  if (typeof synergiesOrDireWolfSlvl === 'number') {
    dwSlvl = Math.max(0, Math.trunc(synergiesOrDireWolfSlvl))
    grizSlvl = Math.max(0, Math.trunc(arguments.length >= 3 ? ownerLevelOrGrizzlySlvl : 0))
    clvl = Math.max(1, Math.trunc(ownerLevelIfPositional))
  } else {
    dwSlvl = Math.max(0, Math.trunc(synergiesOrDireWolfSlvl.direWolfSlvl ?? 0))
    grizSlvl = Math.max(0, Math.trunc(synergiesOrDireWolfSlvl.grizzlySlvl ?? 0))
    clvl = Math.max(1, Math.trunc(ownerLevelOrGrizzlySlvl))
  }

  const maxCount = Math.min(s, 5)
  const baseHpMin = 60
  const baseHpMax = 82
  const baseHpAvg = 71
  const hpBonusPct = dwSlvl > 0 ? 50 + 25 * (dwSlvl - 1) : 0
  const minHp = Math.floor((baseHpMin * (100 + hpBonusPct)) / 100)
  const maxHp = Math.floor((baseHpAvg * (100 + hpBonusPct)) / 100)
  const maxHpRoll = Math.floor((baseHpMax * (100 + hpBonusPct)) / 100)

  const attackRatingBonusPct = 50 + 25 * (s - 1)
  const selfDefenseBonusPct = 50 + 10 * (s - 1) + 7 * s
  const defenseBonusPct = selfDefenseBonusPct
  const damageBonusPct = grizSlvl > 0 ? 15 + 10 * (grizSlvl - 1) : 0

  const baseMinDamage = compute5BandScaling(s, 2, 1, 2, 3, 5, 7)
  const baseMaxDamage = compute5BandScaling(s, 6, 1, 2, 3, 5, 7)
  const minPhysDamage = Math.floor((baseMinDamage * (100 + damageBonusPct)) / 100)
  const maxPhysDamage = Math.floor((baseMaxDamage * (100 + damageBonusPct)) / 100)
  const allResistancesPct = Math.min(85, 5 * (s - 1))

  return {
    skillId: 227,
    maxCount,
    petCount: maxCount,
    baseHpMin,
    baseHpMax,
    baseHpAvg,
    hpBonusPct,
    synergyLifePct: hpBonusPct,
    minHp,
    maxHp,
    hp: maxHp,
    maxHpRoll,
    attackRatingBonusPct,
    selfDefenseBonusPct,
    defenseBonusPct,
    damageBonusPct,
    synergyDamagePct: damageBonusPct,
    baseMinDamage,
    baseMaxDamage,
    minPhysDamage,
    maxPhysDamage,
    minDamage: minPhysDamage,
    maxDamage: maxPhysDamage,
    allResistancesPct,
    elemResist: allResistancesPct,
    petLevel: clvl,
    manaCost: 15,
    manaCost256: 3840,
    petType: 'wolf',
    petGroup: 3,
    monId: 'spiritwolf',
    classId: 420,
    subSkillIds: [292],
  }
}

export const calculateSpiritWolfStats = calculateSummonSpiritWolfStats

/**
 * #237 Summon Dire Wolf (1.13c `Skills.txt` row 237 + `MonStats.txt` `fenris` + #314 `Fenris Rage`).
 * Cross-synergies use effective `.lvl` of #227 Spirit Wolf and #247 Grizzly!
 * Supports both `(slvl, { spiritWolfSlvl, grizzlySlvl }, ownerLevel, isEnraged)` and `(slvl, spiritWolfSlvl, grizzlySlvl, ownerLevel, isEnraged)`.
 */
export function calculateSummonDireWolfStats(
  slvl: number,
  synergiesOrSpiritWolfSlvl: DruidBeastSynergyLevels | number = {},
  ownerLevelOrGrizzlySlvl = 1,
  isEnragedOrOwnerLevel: boolean | number = false,
  isEnragedIfPositional = false,
): SummonDireWolfStats {
  const s = Math.max(1, Math.trunc(slvl))
  let swSlvl = 0
  let grizSlvl = 0
  let clvl = 1
  let isEnraged = false

  if (typeof synergiesOrSpiritWolfSlvl === 'number') {
    swSlvl = Math.max(0, Math.trunc(synergiesOrSpiritWolfSlvl))
    grizSlvl = Math.max(0, Math.trunc(arguments.length >= 3 ? ownerLevelOrGrizzlySlvl : 0))
    if (typeof isEnragedOrOwnerLevel === 'boolean') {
      isEnraged = isEnragedOrOwnerLevel
    } else {
      clvl = Math.max(1, Math.trunc(isEnragedOrOwnerLevel))
      isEnraged = isEnragedIfPositional
    }
  } else {
    swSlvl = Math.max(0, Math.trunc(synergiesOrSpiritWolfSlvl.spiritWolfSlvl ?? 0))
    grizSlvl = Math.max(0, Math.trunc(synergiesOrSpiritWolfSlvl.grizzlySlvl ?? 0))
    clvl = Math.max(1, Math.trunc(ownerLevelOrGrizzlySlvl))
    isEnraged = Boolean(isEnragedOrOwnerLevel)
  }

  const maxCount = Math.min(s, 3)
  const baseHpMin = 98
  const baseHpMax = 130
  const baseHpAvg = 114
  const hpBonusPct = 50 + 25 * (s - 1)
  const minHp = Math.floor((baseHpMin * (100 + hpBonusPct)) / 100)
  const maxHp = Math.floor((baseHpAvg * (100 + hpBonusPct)) / 100)
  const maxHpRoll = Math.floor((baseHpMax * (100 + hpBonusPct)) / 100)

  const attackRatingBonusPct = swSlvl > 0 ? 50 + 25 * (swSlvl - 1) : 0
  const selfDefenseBonusPct = 4 * s
  const spiritWolfDefenseBonusPct = swSlvl > 0 ? 50 + 10 * (swSlvl - 1) : 0
  const defenseBonusPct = selfDefenseBonusPct + spiritWolfDefenseBonusPct

  const grizzlyDamageBonusPct = grizSlvl > 0 ? 15 + 10 * (grizSlvl - 1) : 0
  const rageDamageBonusPct = 100 + 4 * (s - 1)
  const damageBonusPct = grizzlyDamageBonusPct + (isEnraged ? rageDamageBonusPct : 0)

  const baseMinDamage = compute5BandScaling(s, 7, 2, 3, 5, 7, 9)
  const baseMaxDamage = compute5BandScaling(s, 12, 2, 4, 6, 8, 10)
  const minPhysDamage = Math.floor((baseMinDamage * (100 + damageBonusPct)) / 100)
  const maxPhysDamage = Math.floor((baseMaxDamage * (100 + damageBonusPct)) / 100)
  const allResistancesPct = Math.min(85, 5 * (s - 1))

  return {
    skillId: 237,
    maxCount,
    petCount: maxCount,
    baseHpMin,
    baseHpMax,
    baseHpAvg,
    hpBonusPct,
    selfLifeBonusPct: hpBonusPct,
    minHp,
    maxHp,
    hp: maxHp,
    maxHpRoll,
    attackRatingBonusPct,
    synergyArPct: attackRatingBonusPct,
    selfDefenseBonusPct,
    spiritWolfDefenseBonusPct,
    defenseBonusPct,
    totalDefenseBonusPct: defenseBonusPct,
    grizzlyDamageBonusPct,
    synergyDamagePct: grizzlyDamageBonusPct,
    rageDamageBonusPct,
    fenrisRageDamageBonusPct: rageDamageBonusPct,
    fenrisRageBonusPct: rageDamageBonusPct,
    rageDurationFrames: 500,
    fenrisRageDurationFrames: 500,
    damageBonusPct,
    baseMinDamage,
    baseMaxDamage,
    minPhysDamage,
    maxPhysDamage,
    minDamage: minPhysDamage,
    maxDamage: maxPhysDamage,
    allResistancesPct,
    elemResist: allResistancesPct,
    petLevel: clvl,
    manaCost: 20,
    manaCost256: 5120,
    petType: 'fenris',
    petGroup: 3,
    monId: 'fenris',
    classId: 421,
    subSkillIds: [314, 292],
  }
}

export const calculateDireWolfStats = calculateSummonDireWolfStats

/**
 * #247 Summon Grizzly (1.13c `Skills.txt` row 247 + `MonStats.txt` `druidbear` + #326 `BearSmite`).
 * Cross-synergies use effective `.lvl` of #227 Spirit Wolf and #237 Dire Wolf!
 * Supports both `(slvl, { spiritWolfSlvl, direWolfSlvl }, ownerLevel)` and `(slvl, spiritWolfSlvl, direWolfSlvl, ownerLevel)`.
 */
export function calculateSummonGrizzlyStats(
  slvl: number,
  synergiesOrSpiritWolfSlvl: DruidBeastSynergyLevels | number = {},
  ownerLevelOrDireWolfSlvl = 1,
  ownerLevelIfPositional = 1,
): SummonGrizzlyStats {
  const s = Math.max(1, Math.trunc(slvl))
  let swSlvl = 0
  let dwSlvl = 0
  let clvl = 1

  if (typeof synergiesOrSpiritWolfSlvl === 'number') {
    swSlvl = Math.max(0, Math.trunc(synergiesOrSpiritWolfSlvl))
    dwSlvl = Math.max(0, Math.trunc(arguments.length >= 3 ? ownerLevelOrDireWolfSlvl : 0))
    clvl = Math.max(1, Math.trunc(ownerLevelIfPositional))
  } else {
    swSlvl = Math.max(0, Math.trunc(synergiesOrSpiritWolfSlvl.spiritWolfSlvl ?? 0))
    dwSlvl = Math.max(0, Math.trunc(synergiesOrSpiritWolfSlvl.direWolfSlvl ?? 0))
    clvl = Math.max(1, Math.trunc(ownerLevelOrDireWolfSlvl))
  }

  const baseHpMin = 550
  const baseHpMax = 750
  const baseHpAvg = 650
  const hpBonusPct = dwSlvl > 0 ? 50 + 25 * (dwSlvl - 1) : 0
  const minHp = Math.floor((baseHpMin * (100 + hpBonusPct)) / 100)
  const maxHp = Math.floor((baseHpAvg * (100 + hpBonusPct)) / 100)
  const maxHpRoll = Math.floor((baseHpMax * (100 + hpBonusPct)) / 100)

  const attackRatingBonusPct = swSlvl > 0 ? 50 + 25 * (swSlvl - 1) : 0
  const defenseBonusPct = swSlvl > 0 ? 50 + 10 * (swSlvl - 1) : 0
  const damageBonusPct = 15 + 10 * (s - 1)
  const tooltipDamageBonusPct = 25 + 10 * (s - 1)
  const bearSmiteDamageBonusPct = 35 + 10 * (s - 1)
  const bearSmiteStunFrames = Math.min(250, 15 + 5 * (s - 1))

  const baseMinDamage = compute5BandScaling(s, 30, 8, 12, 16, 20, 24)
  const baseMaxDamage = compute5BandScaling(s, 60, 8, 12, 16, 20, 24)
  const minPhysDamage = Math.floor((baseMinDamage * (100 + damageBonusPct)) / 100)
  const maxPhysDamage = Math.floor((baseMaxDamage * (100 + damageBonusPct)) / 100)
  const smiteTotalEd = damageBonusPct + bearSmiteDamageBonusPct
  const smiteMinPhysDamage = Math.floor((baseMinDamage * (100 + smiteTotalEd)) / 100)
  const smiteMaxPhysDamage = Math.floor((baseMaxDamage * (100 + smiteTotalEd)) / 100)
  const allResistancesPct = Math.min(85, 5 * (s - 1))

  return {
    skillId: 247,
    maxCount: 1,
    petCount: 1,
    baseHpMin,
    baseHpMax,
    baseHpAvg,
    hpBonusPct,
    synergyLifePct: hpBonusPct,
    minHp,
    maxHp,
    hp: maxHp,
    maxHpRoll,
    attackRatingBonusPct,
    synergyArPct: attackRatingBonusPct,
    defenseBonusPct,
    synergyDefensePct: defenseBonusPct,
    damageBonusPct,
    selfDamageBonusPct: damageBonusPct,
    tooltipDamageBonusPct,
    bearSmiteDamageBonusPct,
    bearSmiteStunFrames,
    baseMinDamage,
    baseMaxDamage,
    minPhysDamage,
    maxPhysDamage,
    minDamage: minPhysDamage,
    maxDamage: maxPhysDamage,
    smiteMinPhysDamage,
    smiteMaxPhysDamage,
    allResistancesPct,
    elemResist: allResistancesPct,
    petLevel: clvl,
    manaCost: 40,
    manaCost256: 10240,
    petType: 'grizzly',
    petGroup: 3,
    monId: 'druidbear',
    classId: 428,
    subSkillIds: [326],
  }
}

export const calculateGrizzlyStats = calculateSummonGrizzlyStats

// --- Sub-Skill Pure Helpers (#292, #294, #296, #297, #298, #307, #314, #325, #326) ---

export function calculateSpiritWolfTeleportStats(slvl: number): SpiritWolfTeleportStats {
  const s = Math.max(1, Math.trunc(slvl))
  return {
    skillId: 292,
    maxRangeSubtiles: 15 + s,
  }
}

export function calculateVineAttackStats(slvl: number): VineAttackStats {
  const pc = calculatePoisonCreeperStats(slvl)
  return {
    skillId: 294,
    eMinRate256: pc.eMinRate256,
    eMaxRate256: pc.eMaxRate256,
    minPoisonDamage: pc.minPoisonDamage,
    maxPoisonDamage: pc.maxPoisonDamage,
    durationFrames: 100,
    missilePrimary: 'plague vines',
    missileTrail: 'plague vines trail',
  }
}

export function calculateCorpseCyclerStats(
  slvl: number,
  ownerMaxHp256 = 25600,
): CorpseCyclerStats {
  const s = Math.max(1, Math.trunc(slvl))
  const healLifePct = computeDiminishingReturns(3, 12, s)
  const healAmount256 = Math.floor((ownerMaxHp256 * healLifePct) / 100)
  return {
    skillId: 307,
    healLifePct,
    healMaxHpPct: healLifePct,
    healHpPct: healLifePct,
    healAmount256,
  }
}

export function calculateFenrisRageStats(slvl: number): FenrisRageStats {
  const s = Math.max(1, Math.trunc(slvl))
  const bonusPct = 100 + 4 * (s - 1)
  return {
    skillId: 314,
    stateId: 138,
    stateName: 'fenris_rage',
    damageBonusPct: bonusPct,
    attackRatingBonusPct: bonusPct,
    velocityBonusPct: 20,
    durationFrames: 500,
  }
}

export function calculateVineCyclerStats(
  slvl: number,
  ownerMaxMana256 = 25600,
): VineCyclerStats {
  const s = Math.max(1, Math.trunc(slvl))
  const restoreManaPct = computeDiminishingReturns(1, 8, s)
  const restoreAmount256 = Math.floor((ownerMaxMana256 * restoreManaPct) / 100)
  return {
    skillId: 325,
    restoreManaPct,
    manaRecoverMaxPct: restoreManaPct,
    manaRecoverPct: restoreManaPct,
    restoreAmount256,
  }
}

export function calculateBearSmiteStats(slvl: number): BearSmiteStats {
  const s = Math.max(1, Math.trunc(slvl))
  const stunFrames = Math.min(250, 15 + 5 * (s - 1))
  return {
    skillId: 326,
    damageBonusPct: 35 + 10 * (s - 1),
    stunDurationFrames: stunFrames,
    stunLengthFrames: stunFrames,
    knockback: true,
  }
}
