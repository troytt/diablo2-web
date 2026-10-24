/**
 * Diablo II v1.13c Skill Calculator Engine.
 *
 * Implements:
 * - Full 210-skill allocation state machine with prerequisite validation and orphan protection.
 * - 1.13c base-point synergy multiplier calculation (blvl 0..20 invariant).
 * - Mastery amplification (Sorceress Fire/Lightning/Cold Masteries, Paladin Concentration for Hammer, etc.).
 * - 5-level-band damage progression with HitShift precision scaling.
 * - 24.8 fixed-point mana cost formulas with minmana clamping.
 * - Localized tooltip data generation for both Chinese and English.
 * - Build URL hash serialization and deserialization.
 */

import type { CharacterClassCode } from '../units/classes.ts'
import { compute3BandDuration } from '../data/calc-ast.ts'
import {
  SKILLS_CATALOG,
  SKILLS_BY_ID,
  SKILLS_BY_CLASS,
  type SkillCatalogEntry,
  type SynergyBonusInfo,
  type DescLineDefinition,
} from '../data/skills-catalog.ts'

export interface SkillCalcState {
  classCode: CharacterClassCode
  hardPoints: Record<number, number> // skillId -> 0..20
  tabSoftPoints: Record<number, number> // tabIndex 0..2 -> 0..99
  allSkillsSoftPoints: number // 0..99
  specificSoftPoints: Record<number, number> // skillId -> 0..99
}

export function createInitialState(classCode: CharacterClassCode = 'ama'): SkillCalcState {
  return {
    classCode,
    hardPoints: {},
    tabSoftPoints: { 0: 0, 1: 0, 2: 0 },
    allSkillsSoftPoints: 0,
    specificSoftPoints: {},
  }
}

/**
 * Returns effective skill level (hard points + soft points).
 * In Diablo II, an uninvested skill has effective level 0 (unless granted as an oskill).
 */
export function getEffectiveLevel(state: SkillCalcState, skillId: number): number {
  const hard = state.hardPoints[skillId] ?? 0
  const specSoft = state.specificSoftPoints[skillId] ?? 0
  if (hard === 0 && specSoft === 0) return 0

  const skill = SKILLS_BY_ID[skillId]
  if (!skill) return hard
  const tabSoft = state.tabSoftPoints[skill.tabIndex] ?? 0
  const allSoft = state.allSkillsSoftPoints ?? 0
  return hard + tabSoft + allSoft + specSoft
}

/**
 * Returns total hard points invested in the build.
 */
export function getTotalPointsSpent(state: SkillCalcState): number {
  return Object.values(state.hardPoints).reduce((sum, pts) => sum + (pts || 0), 0)
}

/**
 * Returns hard points invested in a specific skill tree tab (0..2).
 */
export function getTabPointsSpent(state: SkillCalcState, tabIndex: number): number {
  let sum = 0
  for (const [idStr, pts] of Object.entries(state.hardPoints)) {
    const id = Number(idStr)
    const skill = SKILLS_BY_ID[id]
    if (skill && skill.tabIndex === tabIndex) {
      sum += pts || 0
    }
  }
  return sum
}

/**
 * Calculates the minimum character level required for the current allocated build.
 * - Takes into account the highest required level for any skill with points.
 * - Takes into account total points spent: 1 point at lvl 1, plus 1 point per lvl up to 99 (98 points) + 12 quest points = 110 total points.
 */
export function getRequiredCharacterLevel(state: SkillCalcState): number {
  let minLevel = 1
  for (const [idStr, pts] of Object.entries(state.hardPoints)) {
    if (!pts || pts <= 0) continue
    const id = Number(idStr)
    const skill = SKILLS_BY_ID[id]
    if (!skill) continue
    // In D2, each hard point in a skill requires +1 character level:
    // e.g. Level 1 skill with 20 points requires at least level 20.
    // Level 30 skill with 20 points requires at least level 49 (30 + 19).
    const skillReq = skill.reqlevel + (pts - 1)
    if (skillReq > minLevel) minLevel = skillReq
  }

  // Also point quantity constraint: points > 12 quests means level >= points - 12 + 1
  const total = getTotalPointsSpent(state)
  const levelFromPoints = Math.max(1, total > 12 ? total - 12 + 1 : 1)
  minLevel = Math.max(minLevel, levelFromPoints)

  return Math.min(99, minLevel)
}

/**
 * Checks if a skill point can be allocated to skillId.
 */
export function canAllocate(state: SkillCalcState, skillId: number): boolean {
  const skill = SKILLS_BY_ID[skillId]
  if (!skill || skill.classCode !== state.classCode) return false

  const currentHard = state.hardPoints[skillId] ?? 0
  if (currentHard >= 20) return false

  // Max build points limit: 110 points
  if (getTotalPointsSpent(state) >= 110) return false

  // Prerequisite check: all reqskills must have at least 1 hard point
  for (const reqId of skill.reqskills) {
    if ((state.hardPoints[reqId] ?? 0) < 1) return false
  }

  return true
}

/**
 * Allocates 1 point to skillId. Returns true if successful.
 */
export function allocatePoint(state: SkillCalcState, skillId: number, count: number = 1): boolean {
  let changed = false
  for (let i = 0; i < count; i++) {
    if (!canAllocate(state, skillId)) break
    state.hardPoints[skillId] = (state.hardPoints[skillId] ?? 0) + 1
    changed = true
  }
  return changed
}

/**
 * Checks if a skill point can be deallocated from skillId without breaking prerequisite chains (orphan protection).
 */
export function canDeallocate(state: SkillCalcState, skillId: number): boolean {
  const currentHard = state.hardPoints[skillId] ?? 0
  if (currentHard <= 0) return false

  // If we have more than 1 point, reducing to >= 1 never breaks prerequisites
  if (currentHard > 1) return true

  // If reducing from 1 to 0, no dependent skills may have allocated points
  // BFS check over all reachable dependents
  const queue = [...(SKILLS_BY_ID[skillId]?.dependents ?? [])]
  const visited = new Set<number>()

  while (queue.length > 0) {
    const depId = queue.shift()!
    if (visited.has(depId)) continue
    visited.add(depId)

    if ((state.hardPoints[depId] ?? 0) > 0) {
      return false // An active dependent relies on this prerequisite!
    }

    const depSkill = SKILLS_BY_ID[depId]
    if (depSkill) {
      for (const nextDep of depSkill.dependents) {
        if (!visited.has(nextDep)) queue.push(nextDep)
      }
    }
  }

  return true
}

/**
 * Deallocates 1 point from skillId. Returns true if successful.
 */
export function deallocatePoint(state: SkillCalcState, skillId: number, count: number = 1): boolean {
  let changed = false
  for (let i = 0; i < count; i++) {
    if (!canDeallocate(state, skillId)) break
    state.hardPoints[skillId] = (state.hardPoints[skillId] ?? 0) - 1
    if (state.hardPoints[skillId] === 0) {
      delete state.hardPoints[skillId]
    }
    changed = true
  }
  return changed
}

/**
 * Resets all skill points (Respec).
 */
export function respec(state: SkillCalcState): number {
  const refunded = getTotalPointsSpent(state)
  state.hardPoints = {}
  return refunded
}

// ============================================================================
// Synergy & Mastery Calculation Engine
// ============================================================================

export interface SynergyCalculationResult {
  readonly list: readonly {
    readonly providerId: number
    readonly providerName: string
    readonly providerNameZh: string
    readonly percentPerLevel: number
    readonly hardPoints: number
    readonly currentBonusPct: number
    readonly type?: 'damage' | 'elemental' | 'duration' | 'attack' | 'life' | 'defense' | 'toHit' | 'magic' | undefined
    readonly labelEn?: string | undefined
    readonly labelZh?: string | undefined
  }[]
  readonly totalPercent: number
  readonly multiplier: number
  readonly physicalPercent: number
  readonly physicalMultiplier: number
  readonly elementalPercent: number
  readonly elementalMultiplier: number
}

/**
 * Evaluates the synergy bonuses for a skill based strictly on provider hard points (blvl 0..20).
 */
export function evaluateSynergies(state: SkillCalcState, skill: SkillCatalogEntry): SynergyCalculationResult {
  if (!skill.synergiesReceived || skill.synergiesReceived.length === 0) {
    return {
      list: [],
      totalPercent: 0,
      multiplier: 1.0,
      physicalPercent: 0,
      physicalMultiplier: 1.0,
      elementalPercent: 0,
      elementalMultiplier: 1.0,
    }
  }

  let totalPercent = 0
  let physicalPercent = 0
  let elementalPercent = 0
  const list = skill.synergiesReceived.map(syn => {
    const providerSkill = SKILLS_BY_ID[syn.providerId]
    const hardPts = state.hardPoints[syn.providerId] ?? 0
    const bonus = hardPts * syn.percentPerLevel
    if (!syn.type || syn.type === 'damage') {
      totalPercent += bonus
      physicalPercent += bonus
    } else if (syn.type === 'elemental') {
      totalPercent += bonus
      elementalPercent += bonus
    }
    return {
      providerId: syn.providerId,
      providerName: syn.providerName || providerSkill?.name || `Skill ${syn.providerId}`,
      providerNameZh: providerSkill?.nameZh || syn.providerName || `技能 ${syn.providerId}`,
      percentPerLevel: syn.percentPerLevel,
      hardPoints: hardPts,
      currentBonusPct: bonus,
      type: syn.type,
      labelEn: syn.labelEn,
      labelZh: syn.labelZh,
    }
  })

  return {
    list,
    totalPercent,
    multiplier: Number((1.0 + totalPercent / 100).toFixed(4)),
    physicalPercent,
    physicalMultiplier: Number((1.0 + physicalPercent / 100).toFixed(4)),
    elementalPercent,
    elementalMultiplier: Number((1.0 + elementalPercent / 100).toFixed(4)),
  }
}

export interface MasteryCalculationResult {
  readonly active: boolean
  readonly masteryId: number
  readonly masteryName: string
  readonly masteryNameZh: string
  readonly effectiveLevel: number
  readonly bonusPercent: number
  readonly multiplier: number
  readonly descriptionZh: string
  readonly descriptionEn: string
}

/**
 * Evaluates mastery bonuses applicable to a skill (e.g. Fire/Lightning/Cold Masteries, Concentration for Hammer, Claw Mastery).
 */
export function evaluateMasteries(state: SkillCalcState, skill: SkillCatalogEntry): MasteryCalculationResult | null {
  if (!skill.masteries || skill.masteries.length === 0) return null

  // Check Sorceress Masteries
  if (skill.classCode === 'sor') {
    if (skill.masteries.includes(61)) {
      // Fire Mastery
      const mastery = SKILLS_BY_ID[61]
      const slvl = getEffectiveLevel(state, 61)
      if (slvl > 0 && mastery) {
        const pct = 30 + 7 * (slvl - 1)
        return {
          active: true,
          masteryId: 61,
          masteryName: 'Fire Mastery',
          masteryNameZh: '火焰精通',
          effectiveLevel: slvl,
          bonusPercent: pct,
          multiplier: Number((1.0 + pct / 100).toFixed(4)),
          descriptionZh: `+${pct}% 火焰伤害 (来自 ${slvl} 级火焰精通)`,
          descriptionEn: `+${pct}% Fire Damage (from Level ${slvl} Fire Mastery)`,
        }
      }
    }

    if (skill.masteries.includes(63)) {
      // Lightning Mastery
      const mastery = SKILLS_BY_ID[63]
      const slvl = getEffectiveLevel(state, 63)
      if (slvl > 0 && mastery) {
        const pct = 50 + 12 * (slvl - 1)
        return {
          active: true,
          masteryId: 63,
          masteryName: 'Lightning Mastery',
          masteryNameZh: '闪电精通',
          effectiveLevel: slvl,
          bonusPercent: pct,
          multiplier: Number((1.0 + pct / 100).toFixed(4)),
          descriptionZh: `+${pct}% 闪电伤害 (来自 ${slvl} 级闪电精通)`,
          descriptionEn: `+${pct}% Lightning Damage (from Level ${slvl} Lightning Mastery)`,
        }
      }
    }

    if (skill.masteries.includes(65)) {
      // Cold Mastery
      const mastery = SKILLS_BY_ID[65]
      const slvl = getEffectiveLevel(state, 65)
      if (slvl > 0 && mastery) {
        const pierce = 20 + 5 * (slvl - 1)
        return {
          active: true,
          masteryId: 65,
          masteryName: 'Cold Mastery',
          masteryNameZh: '冰冻精通',
          effectiveLevel: slvl,
          bonusPercent: pierce,
          multiplier: 1.0, // Lowers resistance rather than direct multiplier
          descriptionZh: `-${pierce}% 敌人冰冷抗性 (来自 ${slvl} 级冰冻精通)`,
          descriptionEn: `-${pierce}% Enemy Cold Resistance (from Level ${slvl} Cold Mastery)`,
        }
      }
    }
  }

  // Check Paladin Concentration for Blessed Hammer (id 112)
  if (skill.classCode === 'pal' && skill.id === 112 && skill.masteries.includes(113)) {
    const slvl = getEffectiveLevel(state, 113)
    if (slvl > 0) {
      // Concentration grants +60% + 15%*(slvl-1), halved for Blessed Hammer
      const concPct = Math.floor((60 + 15 * (slvl - 1)) / 2)
      return {
        active: true,
        masteryId: 113,
        masteryName: 'Concentration',
        masteryNameZh: '专注光环',
        effectiveLevel: slvl,
        bonusPercent: concPct,
        multiplier: Number((1.0 + concPct / 100).toFixed(4)),
        descriptionZh: `+${concPct}% 伤害 (来自 ${slvl} 级专注光环 50% 加成)`,
        descriptionEn: `+${concPct}% Damage (from Level ${slvl} Concentration Aura at 50% effectiveness)`,
      }
    }
  }

  // Check Assassin Claw Mastery (id 252)
  if (skill.classCode === 'ass' && skill.masteries.includes(252)) {
    const slvl = getEffectiveLevel(state, 252)
    if (slvl > 0) {
      const pct = 30 + 4 * (slvl - 1)
      return {
        active: true,
        masteryId: 252,
        masteryName: 'Claw Mastery',
        masteryNameZh: '爪支配',
        effectiveLevel: slvl,
        bonusPercent: pct,
        multiplier: Number((1.0 + pct / 100).toFixed(4)),
        descriptionZh: `+${pct}% 伤害 (来自 ${slvl} 级爪支配)`,
        descriptionEn: `+${pct}% Damage (from Level ${slvl} Claw Mastery)`,
      }
    }
  }

  return null
}

// ============================================================================
// 1.13c Math Evaluation: Bands, Mana, Damage
// ============================================================================

export function evaluateLevelBand(base: number, bands: readonly number[], lvl: number): number {
  if (lvl <= 1) return base
  let val = base
  const b1 = Math.min(lvl - 1, 7) // levels 2..8
  val += b1 * (bands[0] ?? 0)

  if (lvl > 8) {
    const b2 = Math.min(lvl - 8, 8) // levels 9..16
    val += b2 * (bands[1] ?? 0)
  }
  if (lvl > 16) {
    const b3 = Math.min(lvl - 16, 6) // levels 17..22
    val += b3 * (bands[2] ?? 0)
  }
  if (lvl > 22) {
    const b4 = Math.min(lvl - 22, 6) // levels 23..28
    val += b4 * (bands[3] ?? 0)
  }
  if (lvl > 28) {
    const b5 = lvl - 28 // levels 29+
    val += b5 * (bands[4] ?? 0)
  }
  return val
}

/**
 * Calculates 1.13c mana cost with 24.8 fixed point shift and minmana clamping.
 */
export function calculateManaCost(skill: SkillCatalogEntry, lvl: number): number {
  if (skill.mana === 0 && skill.lvlmana === 0) return 0
  const shift = skill.manashift ?? 8
  const shiftFactor = 2 ** (shift - 8)
  const raw = (skill.mana + skill.lvlmana * (lvl - 1)) * shiftFactor
  const cost = Math.max(skill.minmana ?? 0, raw)
  return Math.round(cost * 10) / 10
}

export interface DetailedDamageResult {
  readonly hasDamage: boolean
  readonly type: string
  readonly typeZh: string
  readonly baseMin: number
  readonly baseMax: number
  readonly synergyMultiplier: number
  readonly synergyBonusPct: number
  readonly withSynergyMin: number
  readonly withSynergyMax: number
  readonly masteryMultiplier: number
  readonly masteryBonusPct: number
  readonly finalMin: number
  readonly finalMax: number
  readonly physBaseMin?: number | undefined
  readonly physBaseMax?: number | undefined
  readonly physSynergyBonusPct?: number | undefined
  readonly physSynergyMultiplier?: number | undefined
  readonly physMin?: number | undefined
  readonly physMax?: number | undefined
  readonly durationFrames?: number | undefined
  readonly durationSeconds?: number | undefined
  readonly weaponDamagePercent?: number | undefined
}

/**
 * Computes full detailed damage values including base, synergy, and mastery multipliers.
 * In Diablo II 1.13c, a skill only deals direct attack damage if descdam is set in SkillDesc.txt.
 */
export function calculateDetailedDamage(
  state: SkillCalcState,
  skill: SkillCatalogEntry,
  evalLevel: number
): DetailedDamageResult {
  const lvl = Math.max(1, evalLevel)

  // In Diablo II 1.13c, a skill only deals direct attack damage if descdam is defined
  const hasDamage = Boolean(skill.descdam && skill.descdam !== '')
  if (!hasDamage) {
    return {
      hasDamage: false,
      type: 'none',
      typeZh: '',
      baseMin: 0,
      baseMax: 0,
      synergyMultiplier: 1.0,
      synergyBonusPct: 0,
      withSynergyMin: 0,
      withSynergyMax: 0,
      masteryMultiplier: 1.0,
      masteryBonusPct: 0,
      finalMin: 0,
      finalMax: 0,
    }
  }

  let type = 'physical'
  let typeZh = '物理伤害'
  let rawBaseMin = 0
  let rawBaseMax = 0
  let durationFrames = 0

  const hasElemChannel = Boolean(skill.eType && skill.eType !== '')
  const hasPhysChannel =
    skill.minDam > 0 || skill.maxDam > 0 || Boolean(skill.minLevDam && skill.minLevDam.some(x => x > 0))
  const isDualPhysElem = hasElemChannel && hasPhysChannel

  if (hasElemChannel) {
    type = skill.eType
    const typeNamesZh: Record<string, string> = {
      fire: '火焰伤害',
      ltng: '闪电伤害',
      cold: '冰冷伤害',
      pois: '毒素伤害',
      mag: '魔法伤害',
    }
    typeZh = typeNamesZh[skill.eType] || `${skill.eType} 伤害`

    if (skill.id === 234 && skill.eMin === 0 && skill.eMax === 0) {
      // 1.13c Fissure (#234) sub-missile fallback: Missiles.txt 'erruption crack 1' (EMin=15, EMax=25, EMinLev=6,14,18,22,26)
      rawBaseMin = evaluateLevelBand(15, [6, 14, 18, 22, 26], lvl)
      rawBaseMax = evaluateLevelBand(25, [6, 14, 18, 22, 26], lvl)
    } else {
      rawBaseMin = evaluateLevelBand(skill.eMin, skill.eMinLev, lvl)
      rawBaseMax = evaluateLevelBand(skill.eMax, skill.eMaxLev, lvl)
    }

    if (skill.eLen > 0 || (skill.eLevLen && skill.eLevLen.length > 0)) {
      durationFrames = compute3BandDuration(
        lvl,
        skill.eLen,
        skill.eLevLen?.[0] ?? 0,
        skill.eLevLen?.[1] ?? 0,
        skill.eLevLen?.[2] ?? 0,
      )
    }
  } else if (hasPhysChannel) {
    type = 'physical'
    typeZh = '物理伤害'
    rawBaseMin = evaluateLevelBand(skill.minDam, skill.minLevDam, lvl)
    rawBaseMax = evaluateLevelBand(skill.maxDam, skill.maxLevDam, lvl)
  }

  const syn = evaluateSynergies(state, skill)
  const mastery = evaluateMasteries(state, skill)
  const masteryMult = mastery && mastery.active ? mastery.multiplier : 1.0
  const masteryPct = mastery && mastery.active ? mastery.bonusPercent : 0

  // For dual-channel skills (e.g., #229 Molten Boulder, #244 Volcano, #249 Armageddon),
  // elemental damage is scaled strictly by elemental synergies (EDmgSymPerCalc) while
  // physical damage is scaled strictly by physical synergies (DmgSymPerCalc).
  const primarySynPct = isDualPhysElem ? syn.elementalPercent : syn.totalPercent
  const primarySynMult = isDualPhysElem ? syn.elementalMultiplier : syn.multiplier

  let baseMin = 0
  let baseMax = 0
  let withSynergyMin = 0
  let withSynergyMax = 0

  if (skill.eType === 'pois' && durationFrames > 0) {
    // 1.13c Poison Bitrate Formula (SkillDesc.txt descline=14):
    // HitShift converts eMin/eMax into 256ths-HP per frame (bitrate = eMin << hitshift);
    // Total poison damage over durationFrames = floor(bitrate * durationFrames / 256).
    const hitShift = skill.hitshift ?? 8
    const minRate256 = rawBaseMin * (2 ** hitShift)
    const maxRate256 = rawBaseMax * (2 ** hitShift)
    baseMin = Math.floor((minRate256 * durationFrames) / 256)
    baseMax = Math.floor((maxRate256 * durationFrames) / 256)
    const minRateSyn256 = Math.trunc((minRate256 * (100 + primarySynPct)) / 100)
    const maxRateSyn256 = Math.trunc((maxRate256 * (100 + primarySynPct)) / 100)
    withSynergyMin = Math.floor((minRateSyn256 * durationFrames) / 256)
    withSynergyMax = Math.floor((maxRateSyn256 * durationFrames) / 256)
  } else if ((skill.descdam === '8' || skill.descdam === '9') && (skill.hitshift ?? 8) < 8) {
    // 1.13c Per-Second Stream Display (SkillDesc.txt descdam=8 for Arctic Blast/Inferno/Wake of Inferno, descdam=9 for Firestorm):
    // descdam=8 scales per-frame 256ths bitrate by 25 frames/sec (divided by ddam calc2=3 for #272 Wake of Inferno -> 25/768);
    // descdam=9 scales by 3 trails * 25 = 75 frames/sec.
    const hitShift = skill.hitshift ?? 8
    const framesFactor = skill.descdam === '9' ? 75 : 25
    const denom = skill.id === 272 ? 768 : 256
    const minRate256 = rawBaseMin * (2 ** hitShift)
    const maxRate256 = rawBaseMax * (2 ** hitShift)
    baseMin = Math.floor((minRate256 * framesFactor) / denom)
    baseMax = Math.floor((maxRate256 * framesFactor) / denom)
    const minRateSyn256 = Math.trunc((minRate256 * (100 + primarySynPct)) / 100)
    const maxRateSyn256 = Math.trunc((maxRate256 * (100 + primarySynPct)) / 100)
    withSynergyMin = Math.floor((minRateSyn256 * framesFactor) / denom)
    withSynergyMax = Math.floor((maxRateSyn256 * framesFactor) / denom)
  } else {
    const shiftMultiplier = 2 ** ((skill.hitshift ?? 8) - 8)
    baseMin = Math.round(rawBaseMin * shiftMultiplier)
    baseMax = Math.round(rawBaseMax * shiftMultiplier)
    withSynergyMin = Math.floor(baseMin * primarySynMult)
    withSynergyMax = Math.floor(baseMax * primarySynMult)
  }

  const finalMin = Math.floor(withSynergyMin * masteryMult)
  const finalMax = Math.floor(withSynergyMax * masteryMult)

  let physBaseMin: number | undefined
  let physBaseMax: number | undefined
  let physSynergyBonusPct: number | undefined
  let physSynergyMultiplier: number | undefined
  let physMin: number | undefined
  let physMax: number | undefined

  if (isDualPhysElem) {
    const shiftMultiplier = 2 ** ((skill.hitshift ?? 8) - 8)
    const rawPhysMin = evaluateLevelBand(skill.minDam, skill.minLevDam, lvl)
    const rawPhysMax = evaluateLevelBand(skill.maxDam, skill.maxLevDam, lvl)
    physBaseMin = Math.round(rawPhysMin * shiftMultiplier)
    physBaseMax = Math.round(rawPhysMax * shiftMultiplier)
    physSynergyBonusPct = skill.synergyFormulas?.physical ? syn.physicalPercent : 0
    physSynergyMultiplier = Number((1.0 + physSynergyBonusPct / 100).toFixed(4))
    physMin = Math.floor((physBaseMin * (100 + physSynergyBonusPct)) / 100)
    physMax = Math.floor((physBaseMax * (100 + physSynergyBonusPct)) / 100)
  }

  let weaponDamagePercent: number | undefined
  if (skill.srcDamage > 0) {
    weaponDamagePercent = Math.round((skill.srcDamage / 128) * 100)
  }

  return {
    hasDamage: true,
    type,
    typeZh,
    baseMin,
    baseMax,
    synergyMultiplier: primarySynMult,
    synergyBonusPct: primarySynPct,
    withSynergyMin,
    withSynergyMax,
    masteryMultiplier: masteryMult,
    masteryBonusPct: masteryPct,
    finalMin,
    finalMax,
    ...(isDualPhysElem
      ? {
          physBaseMin,
          physBaseMax,
          physSynergyBonusPct,
          physSynergyMultiplier,
          physMin,
          physMax,
        }
      : {}),
    durationFrames: durationFrames > 0 ? durationFrames : undefined,
    durationSeconds: durationFrames > 0 ? Math.round((durationFrames / 25) * 10) / 10 : undefined,
    weaponDamagePercent,
  }
}

// ============================================================================
// Skill Effects & Tooltip Evaluator (SkillDesc.txt & SkillCalc.txt Ground Truth)
// ============================================================================

export interface FormattedDescLine {
  readonly lineType: number
  readonly textEn: string
  readonly textZh: string
  readonly value?: number | string | undefined
}

export function evalDiminishing(a: number, b: number, lvl: number): number {
  if (b === a) return a
  return Math.floor(((110 * lvl) * (b - a)) / (100 * (lvl + 6))) + a
}

export interface SkillFormulaContext {
  readonly lvl: number
  readonly params: Readonly<Record<string, number | undefined>>
  readonly ln12: number
  readonly ln34: number
  readonly ln56: number
  readonly ln78: number
  readonly dm12: number
  readonly dm34: number
  readonly dm56: number
  readonly dm78: number
  readonly toht: number
  readonly len: number
  readonly edmn: number
  readonly edmx: number
  readonly edns?: number | undefined
  readonly edxs?: number | undefined
  readonly m1en?: number | undefined
  readonly m1ex?: number | undefined
  readonly m1eo?: number | undefined
  readonly m1ey?: number | undefined
  readonly m2en?: number | undefined
  readonly m2ex?: number | undefined
  readonly m3en?: number | undefined
  readonly m3ex?: number | undefined
  readonly mana: number
  readonly mps: number
  readonly hardPoints: Record<number, number>
  readonly effLevels: Record<number, number>
}

import { CANONICAL_SKILLS } from './skills-data.ts'

const SKILLS_BY_LOWER_NAME = new Map<string, SkillCatalogEntry>()
for (const entry of SKILLS_CATALOG) {
  const lower = entry.name.toLowerCase()
  if (!SKILLS_BY_LOWER_NAME.has(lower)) {
    SKILLS_BY_LOWER_NAME.set(lower, entry)
  }
}
for (const [id, rawName, displayName] of CANONICAL_SKILLS) {
  const entry = SKILLS_BY_ID[id]
  if (entry) {
    const lowerRaw = rawName.toLowerCase()
    if (!SKILLS_BY_LOWER_NAME.has(lowerRaw)) {
      SKILLS_BY_LOWER_NAME.set(lowerRaw, entry)
    }
    const lowerDisplay = displayName.toLowerCase()
    if (!SKILLS_BY_LOWER_NAME.has(lowerDisplay)) {
      SKILLS_BY_LOWER_NAME.set(lowerDisplay, entry)
    }
  }
}

const FORMULA_TOKEN_REPLACEMENTS: Readonly<Record<string, string>> = {
  lvl: '_lvl',
  par1: '_par1',
  par2: '_par2',
  par3: '_par3',
  par4: '_par4',
  par5: '_par5',
  par6: '_par6',
  par7: '_par7',
  par8: '_par8',
  ln12: '_ln12',
  ln34: '_ln34',
  ln56: '_ln56',
  ln78: '_ln78',
  dm12: '_dm12',
  dm34: '_dm34',
  dm56: '_dm56',
  dm78: '_dm78',
  toht: '_toht',
  len: '_len',
  edln: '_len',
  edmn: '_edmn',
  edmx: '_edmx',
  edns: '_edns',
  edxs: '_edxs',
  m1en: '_m1en',
  m1ex: '_m1ex',
  m1eo: '_m1eo',
  m1ey: '_m1ey',
  m2en: '_m2en',
  m2ex: '_m2ex',
  m3en: '_m3en',
  m3ex: '_m3ex',
  mps: '_mps',
  usmc: '_mana',
}

const FORMULA_TOKEN_REGEX =
  /\b(?:lvl|par[1-8]|ln(?:12|34|56|78)|dm(?:12|34|56|78)|toht|len|edln|edmn|edmx|edns|edxs|m1en|m1ex|m1eo|m1ey|m2en|m2ex|m3en|m3ex|mps|usmc)\b/g

const COMPILED_FORMULA_CACHE = new Map<string, (ctx: SkillFormulaContext) => number>()

export function compileSkillDescFormula(rawFormula: string): (ctx: SkillFormulaContext) => number {
  let s = rawFormula.trim()
  if (!s) return () => 0
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1).trim()
  }
  if (!s) return () => 0

  const skillResolvers: ((ctx: SkillFormulaContext) => number)[] = []

  // Cross-skill properties: skill('Skill Name'.prop)
  s = s.replace(/skill\(['"]([^'"]+)['"]\.(blvl|lvl|par\d+|ln\d+)\)/g, (_match, skillName: string, prop: string) => {
    const target = SKILLS_BY_LOWER_NAME.get(skillName.toLowerCase())
    if (!target) return '0'
    if (prop.startsWith('par')) return String(target.params[prop] ?? 0)
    const idx = skillResolvers.length
    const targetId = target.id
    const tParams = target.params
    if (prop === 'blvl') {
      skillResolvers.push(ctx => ctx.hardPoints?.[targetId] ?? 0)
    } else if (prop === 'lvl') {
      skillResolvers.push(ctx => ctx.effLevels?.[targetId] ?? 0)
    } else if (prop === 'ln12') {
      const p1 = tParams.par1 ?? 0
      const p2 = tParams.par2 ?? 0
      skillResolvers.push(ctx => {
        const eff = ctx.effLevels?.[targetId] ?? 0
        return eff <= 0 ? 0 : p1 + (eff - 1) * p2
      })
    } else if (prop === 'ln34') {
      const p3 = tParams.par3 ?? 0
      const p4 = tParams.par4 ?? 0
      skillResolvers.push(ctx => {
        const eff = ctx.effLevels?.[targetId] ?? 0
        return eff <= 0 ? 0 : p3 + (eff - 1) * p4
      })
    } else if (prop === 'ln56') {
      const p5 = tParams.par5 ?? 0
      const p6 = tParams.par6 ?? 0
      skillResolvers.push(ctx => {
        const eff = ctx.effLevels?.[targetId] ?? 0
        return eff <= 0 ? 0 : p5 + (eff - 1) * p6
      })
    } else {
      return '0'
    }
    return `_s${String(idx)}`
  })

  // Cross-skill level-indexed lookup: sklvl('Skill Name'.levelExpr.prop)
  // e.g. sklvl('Holy Fire'.ln56.edmn), sklvl('Holy Fire'.ln56.edmx), sklvl('Holy Fire'.ln56.par5)
  s = s.replace(
    /sklvl\(['"]([^'"]+)['"]\.(ln12|ln34|ln56|lvl)\.(edmn|edmx|par\d+)\)/g,
    (_match, skillName: string, lvlProp: string, valProp: string) => {
      const target = SKILLS_BY_LOWER_NAME.get(skillName.toLowerCase())
      if (!target) return '0'
      if (valProp.startsWith('par')) {
        return String(target.params[valProp] ?? 0)
      }
      const idx = skillResolvers.length
      const resolveSubLvl = (ctx: SkillFormulaContext): number => {
        if (lvlProp === 'ln12') return ctx.ln12
        if (lvlProp === 'ln34') return ctx.ln34
        if (lvlProp === 'ln56') return ctx.ln56
        return ctx.lvl
      }
      const shiftFactor = 2 ** ((target.hitshift ?? 8) - 8)
      if (valProp === 'edmn') {
        skillResolvers.push(ctx => {
          const subLvl = Math.max(1, resolveSubLvl(ctx))
          return Math.floor(evaluateLevelBand(target.eMin, target.eMinLev, subLvl) * shiftFactor)
        })
      } else if (valProp === 'edmx') {
        skillResolvers.push(ctx => {
          const subLvl = Math.max(1, resolveSubLvl(ctx))
          return Math.floor(evaluateLevelBand(target.eMax, target.eMaxLev, subLvl) * shiftFactor)
        })
      } else {
        return '0'
      }
      return `_s${String(idx)}`
    },
  )

  // Missile property lookups: miss('missile_name'.prop)
  s = s.replace(/miss\(['"]([^'"]+)['"]\.(edns|edxs|edmn|edmx)\)/g, (_match, missName: string, prop: string) => {
    const lowerMiss = missName.toLowerCase()
    const idx = skillResolvers.length
    if (lowerMiss === 'royalstrikemeteorfire') {
      // 1.13c Missiles.txt 'royalstrikemeteorfire' (#567): HitShift=3 (2^3=8), EMin=6, EMax=10,
      // EMinLev=[5,10,16,22,30], EMaxLev=[5,10,17,24,32], synergy=Fists of Fire blvl * 6%
      skillResolvers.push(ctx => {
        const fofBlvl = ctx.hardPoints?.[259] ?? 0
        const synMult = 100 + fofBlvl * 6
        if (prop === 'edns') {
          const raw = evaluateLevelBand(6, [5, 10, 16, 22, 30], ctx.lvl)
          return Math.floor((raw * 8 * synMult) / 100)
        }
        if (prop === 'edxs') {
          const raw = evaluateLevelBand(10, [5, 10, 17, 24, 32], ctx.lvl)
          return Math.floor((raw * 8 * synMult) / 100)
        }
        if (prop === 'edmn') {
          const raw = evaluateLevelBand(6, [5, 10, 16, 22, 30], ctx.lvl)
          return Math.floor(((raw * 8 * synMult) / 100) / 256)
        }
        const raw = evaluateLevelBand(10, [5, 10, 17, 24, 32], ctx.lvl)
        return Math.floor(((raw * 8 * synMult) / 100) / 256)
      })
      return `_s${String(idx)}`
    }
    if (lowerMiss === 'fistsoffirefirewall') {
      // 1.13c Missiles.txt 'fistsoffirefirewall' (#557): HitShift=3 (2^3=8), EMin=6, EMax=10,
      // EMinLev=[5,10,16,22,30], EMaxLev=[5,10,17,24,32], synergy=Royal Strike blvl * 6%
      skillResolvers.push(ctx => {
        const psBlvl = ctx.hardPoints?.[280] ?? 0
        const synMult = 100 + psBlvl * 6
        if (prop === 'edns') {
          const raw = evaluateLevelBand(6, [5, 10, 16, 22, 30], ctx.lvl)
          return Math.floor((raw * 8 * synMult) / 100)
        }
        if (prop === 'edxs') {
          const raw = evaluateLevelBand(10, [5, 10, 17, 24, 32], ctx.lvl)
          return Math.floor((raw * 8 * synMult) / 100)
        }
        if (prop === 'edmn') {
          const raw = evaluateLevelBand(6, [5, 10, 16, 22, 30], ctx.lvl)
          return Math.floor(((raw * 8 * synMult) / 100) / 256)
        }
        const raw = evaluateLevelBand(10, [5, 10, 17, 24, 32], ctx.lvl)
        return Math.floor(((raw * 8 * synMult) / 100) / 256)
      })
      return `_s${String(idx)}`
    }
    return '0'
  })

  // Discard complex unresolved nested lookups safely
  s = s.replace(/sklvl\([^)]+\)/g, '0')
  s = s.replace(/miss\([^)]+\)/g, '0')

  // Math functions
  s = s.replace(/\bmin\s*\(/g, 'Math.min(')
  s = s.replace(/\bmax\s*\(/g, 'Math.max(')

  // Context tokens in a single regex pass
  s = s.replace(FORMULA_TOKEN_REGEX, token => FORMULA_TOKEN_REPLACEMENTS[token] ?? token)

  // In Diablo II 1.13c, all formula arithmetic in D2Common.dll (0x6FD55000) uses 32-bit integer idiv,
  // evaluated left-to-right in compileSafeMathAst's parseTerm (Math.trunc(num / denom)).
  const isMpsOnly = s === '_mps'
  const astRoot = compileSafeMathAst(s, skillResolvers)
  return (ctx: SkillFormulaContext): number => {
    const res = astRoot(ctx)
    if (!Number.isFinite(res)) return 0
    return isMpsOnly ? Math.round(res * 10) / 10 : Math.round(res)
  }
}

const CONTEXT_VAR_READERS: Readonly<Record<string, (ctx: SkillFormulaContext) => number>> = {
  _lvl: ctx => ctx.lvl,
  _par1: ctx => ctx.params.par1 ?? 0,
  _par2: ctx => ctx.params.par2 ?? 0,
  _par3: ctx => ctx.params.par3 ?? 0,
  _par4: ctx => ctx.params.par4 ?? 0,
  _par5: ctx => ctx.params.par5 ?? 0,
  _par6: ctx => ctx.params.par6 ?? 0,
  _par7: ctx => ctx.params.par7 ?? 0,
  _par8: ctx => ctx.params.par8 ?? 0,
  _ln12: ctx => ctx.ln12,
  _ln34: ctx => ctx.ln34,
  _ln56: ctx => ctx.ln56,
  _ln78: ctx => ctx.ln78,
  _dm12: ctx => ctx.dm12,
  _dm34: ctx => ctx.dm34,
  _dm56: ctx => ctx.dm56,
  _dm78: ctx => ctx.dm78,
  _toht: ctx => ctx.toht,
  _len: ctx => ctx.len,
  _edmn: ctx => ctx.edmn,
  _edmx: ctx => ctx.edmx,
  _edns: ctx => ctx.edns ?? ctx.edmn * 256,
  _edxs: ctx => ctx.edxs ?? ctx.edmx * 256,
  _m1en: ctx => ctx.m1en ?? 0,
  _m1ex: ctx => ctx.m1ex ?? 0,
  _m1eo: ctx => ctx.m1eo ?? (ctx.m1en ?? 0) * 256,
  _m1ey: ctx => ctx.m1ey ?? (ctx.m1ex ?? 0) * 256,
  _m2en: ctx => ctx.m2en ?? 0,
  _m2ex: ctx => ctx.m2ex ?? 0,
  _m3en: ctx => ctx.m3en ?? 0,
  _m3ex: ctx => ctx.m3ex ?? 0,
  _mana: ctx => ctx.mana,
  _mps: ctx => ctx.mps,
}

function compileSafeMathAst(
  input: string,
  skillResolvers: readonly ((ctx: SkillFormulaContext) => number)[],
): (ctx: SkillFormulaContext) => number {
  let pos = 0
  const len = input.length

  const skipWs = (): void => {
    while (pos < len && /\s/.test(input[pos]!)) pos++
  }

  const parseTernary = (): ((ctx: SkillFormulaContext) => number) => {
    const cond = parseComparison()
    skipWs()
    if (input[pos] === '?') {
      pos++
      const trueBranch = parseTernary()
      skipWs()
      if (input[pos] !== ':') return () => NaN
      pos++
      const falseBranch = parseTernary()
      return ctx => {
        const c = cond(ctx)
        if (!Number.isFinite(c)) return NaN
        return c !== 0 ? trueBranch(ctx) : falseBranch(ctx)
      }
    }
    return cond
  }

  const parseComparison = (): ((ctx: SkillFormulaContext) => number) => {
    let left = parseAdditive()
    while (true) {
      skipWs()
      const twoChar = input.slice(pos, pos + 2)
      let op = ''
      if (twoChar === '<=' || twoChar === '>=' || twoChar === '==' || twoChar === '!=') {
        op = twoChar
        pos += 2
      } else {
        const ch = input[pos]
        if (ch === '<' || ch === '>' || ch === '=') {
          op = ch
          pos++
        }
      }
      if (!op) break
      const prev = left
      const right = parseAdditive()
      left = ctx => {
        const l = prev(ctx)
        const r = right(ctx)
        if (!Number.isFinite(l) || !Number.isFinite(r)) return NaN
        if (op === '<') return l < r ? 1 : 0
        if (op === '>') return l > r ? 1 : 0
        if (op === '<=') return l <= r ? 1 : 0
        if (op === '>=') return l >= r ? 1 : 0
        if (op === '==' || op === '=') return l === r ? 1 : 0
        return l !== r ? 1 : 0
      }
    }
    return left
  }

  const parseAdditive = (): ((ctx: SkillFormulaContext) => number) => {
    let left = parseTerm()
    while (true) {
      skipWs()
      const ch = input[pos]
      if (ch === '+') {
        pos++
        const prev = left
        const right = parseTerm()
        left = ctx => prev(ctx) + right(ctx)
      } else if (ch === '-') {
        pos++
        const prev = left
        const right = parseTerm()
        left = ctx => prev(ctx) - right(ctx)
      } else {
        break
      }
    }
    return left
  }

  const parseTerm = (): ((ctx: SkillFormulaContext) => number) => {
    let left = parseFactor()
    while (true) {
      skipWs()
      const ch = input[pos]
      if (ch === '*') {
        pos++
        const prev = left
        const right = parseFactor()
        left = ctx => prev(ctx) * right(ctx)
      } else if (ch === '/') {
        pos++
        const prev = left
        const right = parseFactor()
        left = ctx => {
          const denom = right(ctx)
          if (denom === 0 || !Number.isFinite(denom)) return NaN
          const num = prev(ctx)
          return Number.isFinite(num) ? Math.trunc(num / denom) : NaN
        }
      } else {
        break
      }
    }
    return left
  }

  const parseFactor = (): ((ctx: SkillFormulaContext) => number) => {
    skipWs()
    if (pos >= len) return () => NaN
    const ch = input[pos]!
    if (ch === '+') {
      pos++
      const inner = parseFactor()
      return ctx => +inner(ctx)
    }
    if (ch === '-') {
      pos++
      const inner = parseFactor()
      return ctx => -inner(ctx)
    }
    if (ch === '(') {
      pos++
      const inner = parseTernary()
      skipWs()
      if (input[pos] !== ')') return () => NaN
      pos++
      return inner
    }
    if (input.startsWith('Math.floor', pos) || input.startsWith('Math.min', pos) || input.startsWith('Math.max', pos)) {
      let fnName: 'floor' | 'min' | 'max'
      if (input.startsWith('Math.floor', pos)) {
        fnName = 'floor'
        pos += 'Math.floor'.length
      } else if (input.startsWith('Math.min', pos)) {
        fnName = 'min'
        pos += 'Math.min'.length
      } else {
        fnName = 'max'
        pos += 'Math.max'.length
      }
      skipWs()
      if (input[pos] !== '(') return () => NaN
      pos++
      const argFns: ((ctx: SkillFormulaContext) => number)[] = [parseTernary()]
      while (true) {
        skipWs()
        if (input[pos] === ',') {
          pos++
          argFns.push(parseTernary())
        } else {
          break
        }
      }
      if (input[pos] !== ')') return () => NaN
      pos++
      if (fnName === 'floor') {
        if (argFns.length !== 1) return () => NaN
        const arg0 = argFns[0]!
        return ctx => {
          const v = arg0(ctx)
          return Number.isFinite(v) ? Math.floor(v) : NaN
        }
      }
      if (fnName === 'min') {
        return ctx => {
          let m = Infinity
          for (let i = 0; i < argFns.length; i++) {
            const v = argFns[i]!(ctx)
            if (!Number.isFinite(v)) return NaN
            if (v < m) m = v
          }
          return m
        }
      }
      return ctx => {
        let m = -Infinity
        for (let i = 0; i < argFns.length; i++) {
          const v = argFns[i]!(ctx)
          if (!Number.isFinite(v)) return NaN
          if (v > m) m = v
        }
        return m
      }
    }
    const varMatch = /^_[a-z0-9]+/.exec(input.slice(pos))
    if (varMatch) {
      const token = varMatch[0]
      pos += token.length
      if (token.startsWith('_s')) {
        const idx = Number(token.slice(2))
        const sr = skillResolvers[idx]
        return sr ?? (() => 0)
      }
      const reader = CONTEXT_VAR_READERS[token]
      return reader ?? (() => NaN)
    }
    const numMatch = /^[0-9]+(?:\.[0-9]+)?/.exec(input.slice(pos))
    if (numMatch) {
      pos += numMatch[0].length
      const numVal = Number(numMatch[0])
      return () => numVal
    }
    return () => NaN
  }

  const root = parseTernary()
  skipWs()
  if (pos !== len) return () => NaN
  return root
}

export function evalSkillDescFormula(formula: string | undefined, ctx: SkillFormulaContext): number {
  if (!formula) return 0
  const key = String(formula)
  let evaluator = COMPILED_FORMULA_CACHE.get(key)
  if (evaluator === undefined) {
    evaluator = compileSkillDescFormula(key)
    COMPILED_FORMULA_CACHE.set(key, evaluator)
  }
  return evaluator(ctx)
}

function createLazyEffLevels(
  state: SkillCalcState,
  overrideSkillId: number,
  overrideLvl: number,
): Record<number, number> {
  const cache: Record<number, number> = { [overrideSkillId]: overrideLvl }
  return new Proxy(cache, {
    get(target, prop): number | undefined {
      if (prop in target) {
        return target[prop as unknown as number]
      }
      if (typeof prop === 'string') {
        const id = Number(prop)
        if (Number.isInteger(id) && id >= 0) {
          const val = getEffectiveLevel(state, id)
          target[id] = val
          return val
        }
      }
      return undefined
    },
  })
}

export function evaluateSkillEffects(
  state: SkillCalcState,
  skill: SkillCatalogEntry,
  lvl: number
): readonly FormattedDescLine[] {
  const effLevels = createLazyEffLevels(state, skill.id, lvl)

  const p = skill.params || {}
  const dm12 = evalDiminishing(p.par1 ?? 0, p.par2 ?? 0, lvl)
  const dm34 = evalDiminishing(p.par3 ?? 0, p.par4 ?? 0, lvl)
  const dm56 = evalDiminishing(p.par5 ?? 0, p.par6 ?? 0, lvl)
  const dm78 = evalDiminishing(p.par7 ?? 0, p.par8 ?? 0, lvl)

  // Determine duration len using authentic 1.13c 3-band duration scaling
  let durationFrames = compute3BandDuration(
    lvl,
    skill.eLen,
    skill.eLevLen?.[0] ?? 0,
    skill.eLevLen?.[1] ?? 0,
    skill.eLevLen?.[2] ?? 0,
  )
  if (durationFrames === 0) {
    if (
      skill.id === 138 ||
      skill.id === 149 ||
      skill.id === 155 ||
      skill.name === 'Battle Orders' ||
      skill.name === 'Shout' ||
      skill.name === 'Battle Command'
    ) {
      const synShout = state.hardPoints[138] ?? 0
      const synBC = state.hardPoints[155] ?? 0
      const synBO = state.hardPoints[149] ?? 0
      let synBonus = 0
      if (skill.id === 149 || skill.name === 'Battle Orders') {
        synBonus = (synShout + synBC) * (skill.params.par8 ?? 125)
        durationFrames = (skill.params.par1 ?? 0) + (lvl - 1) * (skill.params.par2 ?? 0) + synBonus
      } else if (skill.id === 138 || skill.name === 'Shout') {
        synBonus = (synBO + synBC) * (skill.params.par8 ?? 125)
        durationFrames = (skill.params.par3 ?? 0) + (lvl - 1) * (skill.params.par4 ?? 0) + synBonus
      } else if (skill.id === 155 || skill.name === 'Battle Command') {
        synBonus = (synShout + synBO) * (skill.params.par8 ?? 125)
        durationFrames = (skill.params.par1 ?? 0) + (lvl - 1) * (skill.params.par2 ?? 0) + synBonus
      }
    }
  }

  const shiftMultiplier = 2 ** ((skill.hitshift ?? 8) - 8)
  const hitShift256 = 2 ** (skill.hitshift ?? 8)
  const manaShiftFactor = 2 ** ((skill.manashift ?? 8) - 8)
  const rawMps = (skill.mana + skill.lvlmana * (lvl - 1)) * manaShiftFactor * 25
  const synEval = evaluateSynergies(state, skill)
  const elemSynPct = synEval.elementalPercent || synEval.totalPercent
  const rawElemMin = evaluateLevelBand(skill.eMin, skill.eMinLev, lvl)
  const rawElemMax = evaluateLevelBand(skill.eMax, skill.eMaxLev, lvl)
  const ednsVal = Math.floor((rawElemMin * hitShift256 * (100 + elemSynPct)) / 100)
  const edxsVal = Math.floor((rawElemMax * hitShift256 * (100 + elemSynPct)) / 100)

  let m1en = 0
  let m1ex = 0
  let m1eo = 0
  let m1ey = 0
  let m2en = 0
  let m2ex = 0
  let m3en = 0
  let m3ex = 0
  if (skill.id === 121) {
    // Fist of the Heavens Descmissile1: fistoftheheavensbolt (#234: HitShift=8, EMin=40, EMax=50, EMinLev=[6,10,16,32,48], EMaxLev=[6,10,16,32,48], syn=#101*15%)
    const hbSyn = (state.hardPoints[101] ?? 0) * 15
    m1en = Math.floor((evaluateLevelBand(40, [6, 10, 16, 32, 48], lvl) * (100 + hbSyn)) / 100)
    m1ex = Math.floor((evaluateLevelBand(50, [6, 10, 16, 32, 48], lvl) * (100 + hbSyn)) / 100)
    m1eo = m1en * 256
    m1ey = m1ex * 256
  } else if (skill.id === 259) {
    // Fists of Fire Descmissile1: fistsoffirefirewall (#557: HitShift=3, EMin=6, EMax=10, EMinLev=[5,10,16,22,30], EMaxLev=[5,10,17,24,32], syn=#280*6%)
    const psSyn = (state.hardPoints[280] ?? 0) * 6
    m1eo = Math.floor((evaluateLevelBand(6, [5, 10, 16, 22, 30], lvl) * 8 * (100 + psSyn)) / 100)
    m1ey = Math.floor((evaluateLevelBand(10, [5, 10, 17, 24, 32], lvl) * 8 * (100 + psSyn)) / 100)
    m1en = Math.floor(m1eo / 256)
    m1ex = Math.floor(m1ey / 256)
  } else if (skill.id === 269) {
    // Claws of Thunder Descmissile2: clawsofthundernova (#559), Descmissile3: clawsofthunderbolt (#558) (syn=#280*8%)
    const psSyn = (state.hardPoints[280] ?? 0) * (skill.params.par8 ?? 8)
    m2en = Math.floor((1 * (100 + psSyn)) / 100)
    m2ex = Math.floor((evaluateLevelBand(30, [15, 25, 35, 45, 65], lvl) * (100 + psSyn)) / 100)
    m3en = Math.floor((1 * (100 + psSyn)) / 100)
    m3ex = Math.floor((evaluateLevelBand(40, [20, 40, 60, 80, 100], lvl) * (100 + psSyn)) / 100)
  } else if (skill.id === 280) {
    // Phoenix Strike Descmissile1: royalstrikemeteor (syn=#259*10%), Descmissile2: royalstrikechainlightning (syn=#269*13%), Descmissile3: royalstrikechaosice (syn=#274*10%)
    const fofSyn = (state.hardPoints[259] ?? 0) * 10
    const cotSyn = (state.hardPoints[269] ?? 0) * 13
    const boiSyn = (state.hardPoints[274] ?? 0) * 10
    m1en = Math.floor((evaluateLevelBand(20, [10, 19, 29, 38, 46], lvl) * (100 + fofSyn)) / 100)
    m1ex = Math.floor((evaluateLevelBand(40, [10, 21, 33, 42, 50], lvl) * (100 + fofSyn)) / 100)
    m2en = Math.floor((1 * (100 + cotSyn)) / 100)
    m2ex = Math.floor((evaluateLevelBand(40, [20, 40, 60, 80, 100], lvl) * (100 + cotSyn)) / 100)
    m3en = Math.floor((evaluateLevelBand(16, [4, 8, 12, 20, 28], lvl) * (100 + boiSyn)) / 100)
    m3ex = Math.floor((evaluateLevelBand(32, [4, 8, 13, 21, 29], lvl) * (100 + boiSyn)) / 100)
  }

  const baseCtx: SkillFormulaContext = {
    lvl,
    params: skill.params,
    ln12: (skill.params.par1 ?? 0) + (lvl - 1) * (skill.params.par2 ?? 0),
    ln34: (skill.params.par3 ?? 0) + (lvl - 1) * (skill.params.par4 ?? 0),
    ln56: (skill.params.par5 ?? 0) + (lvl - 1) * (skill.params.par6 ?? 0),
    ln78: (skill.params.par7 ?? 0) + (lvl - 1) * (skill.params.par8 ?? 0),
    dm12,
    dm34,
    dm56,
    dm78,
    toht: 0,
    len: durationFrames,
    edmn: Math.round(rawElemMin * shiftMultiplier),
    edmx: Math.round(rawElemMax * shiftMultiplier),
    edns: ednsVal,
    edxs: edxsVal,
    m1en,
    m1ex,
    m1eo,
    m1ey,
    m2en,
    m2ex,
    m3en,
    m3ex,
    mana: calculateManaCost(skill, lvl),
    mps: Math.round(rawMps * 10) / 10,
    hardPoints: state.hardPoints,
    effLevels,
  }

  const toht = skill.toHitCalc
    ? evalSkillDescFormula(skill.toHitCalc, baseCtx)
    : (skill.toHit ?? 0) + (lvl - 1) * (skill.toHitLev ?? 0)

  const ctx: SkillFormulaContext = {
    ...baseCtx,
    toht,
  }

  const results: FormattedDescLine[] = []
  const lines = [...(skill.descLines || []), ...(skill.dsc2Lines || [])]
  for (const line of lines) {
    const valA = evalSkillDescFormula(line.calca, ctx)
    const valB = evalSkillDescFormula(line.calcb, ctx)
    const lt = line.lineType

    let zh = ''
    let en = ''
    const isPct = line.textbKey === 'StrSkill23' || line.textbZh === '百分比' || line.textbEn?.toLowerCase() === 'percent'
    const signA = valA > 0 ? '+' : ''

    // Chinese label ergonomic adjustment for Attack Speed vs Attack Rating vs Damage %
    let textaZh = line.textaZh || ''
    if (line.textaKey === 'StrSkill106') {
      textaZh = '攻擊速度：'
    } else if (line.textaKey === 'StrSkill22') {
      textaZh = '準確率：'
    } else if (line.textaKey === 'StrSkill4' && isPct) {
      textaZh = '傷害加成：'
    } else if (line.textaKey === 'StrSkill62') {
      textaZh = '冰凍時間：'
    } else if (line.textaKey === 'StrSkill59') {
      textaZh = '恐懼時間：'
    }

    if (lt === 2) {
      zh = `${textaZh}${signA}${valA}${isPct ? '%' : ' ' + (line.textbZh || '')}`
      en = `${line.textaEn || ''} ${signA}${valA}${isPct ? '%' : ' ' + (line.textbEn || '')}`
    } else if (lt === 3) {
      if (line.calca?.trim() === 'mps') {
        zh = `${textaZh}${valA} ${line.textbZh || '每秒'}`
        en = `${line.textaEn || ''} ${valA} ${line.textbEn || 'per second'}`
      } else {
        zh = `${textaZh}${signA}${valA}${isPct ? '%' : ' ' + (line.textbZh || '')}`
        en = `${line.textaEn || ''} ${signA}${valA}${isPct ? '%' : ' ' + (line.textbEn || '')}`
      }
    } else if (lt === 4) {
      zh = `${textaZh}${signA}${valA}`
      en = `${line.textaEn || ''} ${signA}${valA}`
    } else if (lt === 5) {
      zh = `${textaZh}${valA}`
      en = `${line.textaEn || ''} ${valA}`
    } else if (lt === 6) {
      zh = `+${valA}${textaZh || '%'}`
      en = `+${valA}${line.textaEn || '%'}`
    } else if (lt === 7) {
      if (skill.id === 37) {
        zh = `法力回復速度：+${valA}%`
        en = `Mana Recovery Rate: +${valA}%`
      } else if (
        line.textaEn === 'hits' ||
        line.textaEn === '5213' ||
        line.textaZh === '擊中' ||
        line.textaZh === '次攻击'
      ) {
        zh = `${valA} ${textaZh || '擊中'}`
        en = `${valA} ${line.textaEn || 'hits'}`
      } else if (line.textaEn === 'percent damage returned') {
        zh = `+${valA}${textaZh || '%的傷害會回彈'}`
        en = `+${valA}% damage returned`
      } else {
        zh = `+${valA}%`
        en = `+${valA}%`
      }
    } else if (lt === 8) {
      if (line.calca && valA !== 0) {
        zh = `攻擊準確率：+${valA}%`
        en = `To Attack Rating: +${valA}%`
      }
    } else if (lt === 9) {
      if (skill.descdam && skill.descdam !== '') {
        const dmg = calculateDetailedDamage(state, skill, lvl)
        const pMin = dmg.physMin ?? dmg.finalMin
        const pMax = dmg.physMax ?? dmg.finalMax
        zh = `傷害：${pMin} - ${pMax}`
        en = `Damage: ${pMin}-${pMax}`
      } else if (skill.minDam > 0 || skill.maxDam > 0) {
        const bMin = evaluateLevelBand(skill.minDam, skill.minLevDam, lvl)
        const bMax = evaluateLevelBand(skill.maxDam, skill.maxLevDam, lvl)
        const pMin = Math.floor((bMin * (100 + valA)) / 100)
        const pMax = Math.floor((bMax * (100 + valA)) / 100)
        zh = `傷害：${pMin} - ${pMax}`
        en = `Damage: ${pMin}-${pMax}`
      }
    } else if (lt === 10) {
      const dmg = calculateDetailedDamage(state, skill, lvl)
      if (dmg.hasDamage && dmg.type !== 'physical') {
        const labelZh =
          dmg.type === 'fire'
            ? '火焰傷害'
            : dmg.type === 'cold'
              ? '冰冷傷害'
              : dmg.type === 'ltng'
                ? '閃電傷害'
                : dmg.type === 'pois'
                  ? '毒素傷害'
                  : '魔法傷害'
        const labelEn =
          dmg.type === 'fire'
            ? 'Fire Damage'
            : dmg.type === 'cold'
              ? 'Cold Damage'
              : dmg.type === 'ltng'
                ? 'Lightning Damage'
                : dmg.type === 'pois'
                  ? 'Poison Damage'
                  : 'Magic Damage'
        zh = `${labelZh}：${dmg.finalMin} - ${dmg.finalMax}`
        en = `${labelEn}: ${dmg.finalMin}-${dmg.finalMax}`
      }
    } else if (lt === 11) {
      if (skill.id === 230 || skill.eType === 'cold') {
        const frames = skill.id === 230 ? (ctx.ln34 || durationFrames) : durationFrames
        if (frames > 0) {
          const sec = Math.round((frames / 25) * 10) / 10
          zh = `冰冷時間：${sec} 秒`
          en = `Cold Length: ${sec} seconds`
        }
      } else if (durationFrames > 0) {
        const sec = Math.round((durationFrames / 25) * 10) / 10
        zh = `持續：${sec} 秒`
        en = `Duration: ${sec} seconds`
      }
    } else if (lt === 12 || lt === 31) {
      const clampedValA = skill.id === 243 ? Math.min(250, valA) : valA
      const sec =
        lt === 12
          ? Math.round((clampedValA / 25) * 10) / 10
          : clampedValA > 50
            ? Math.round((clampedValA / 25) * 10) / 10
            : clampedValA
      const bPrefixZh = line.textbEn?.startsWith('Charge ') && line.textbZh ? `${line.textbZh} ` : ''
      const bPrefixEn = line.textbEn?.startsWith('Charge ') ? `${line.textbEn} ` : ''
      zh = `${bPrefixZh}${textaZh || '持續：'}${sec} 秒`
      en = `${bPrefixEn}${line.textaEn || 'Duration:'} ${sec} seconds`
    } else if (lt === 13) {
      const baseLife = skill.minionStats?.minHP ?? 20
      const life = Math.floor(((baseLife + valB) * (100 + valA)) / 100)
      zh = `生命：${life}`
      en = `Life: ${life}`
    } else if (lt === 14) {
      const dmg = calculateDetailedDamage(state, skill, lvl)
      if (!dmg.hasDamage && skill.eType === 'pois') {
        const eMinRate = evaluateLevelBand(skill.eMin, skill.eMinLev, lvl)
        const eMaxRate = evaluateLevelBand(skill.eMax, skill.eMaxLev, lvl)
        const eLen = skill.eLen || 100
        const pMin = Math.floor((eMinRate * eLen) / 256)
        const pMax = Math.floor((eMaxRate * eLen) / 256)
        const sec = Math.round((eLen / 25) * 10) / 10
        zh = `毒素傷害：${pMin} - ${pMax}，持續 ${sec} 秒`
        en = `Poison Damage: ${pMin}-${pMax} over ${sec} seconds`
      } else {
        const sec = dmg.durationSeconds ?? 2
        zh = `毒素傷害：${dmg.finalMin} - ${dmg.finalMax}，持續 ${sec} 秒`
        en = `Poison Damage: ${dmg.finalMin}-${dmg.finalMax} over ${sec} seconds`
      }
    } else if (lt === 17) {
      const bPrefixZh = line.textbZh ? `${line.textbZh} ` : ''
      const bPrefixEn = line.textbEn ? `${line.textbEn} ` : ''
      zh = `${bPrefixZh}${textaZh}${valA} - ${valB} 每秒`
      en = `${bPrefixEn}${line.textaEn || ''} ${valA}-${valB} per second`.trim()
    } else if (lt === 18) {
      zh = `${textaZh}`
      en = `${line.textaEn || ''}`
    } else if (lt === 19 || lt === 37) {
      const yards = (valA * (2 / 3)).toFixed(1)
      const bPrefixZh = line.textbEn?.startsWith('Charge ') && line.textbZh ? `${line.textbZh} ` : ''
      const bPrefixEn = line.textbEn?.startsWith('Charge ') ? `${line.textbEn} ` : ''
      zh = `${bPrefixZh}${textaZh || '半徑：'}${yards} 碼`
      en = `${bPrefixEn}${line.textaEn || 'Radius:'} ${yards} yards`
    } else if (lt === 22) {
      if (skill.id === 229) {
        // 1.13c moltenboulderfirepath: EMin=4, EMax=6, EMinLev=[2,3,4,6,8], EMaxLev=[3,4,5,7,9], HitShift=3
        const rawMin = evaluateLevelBand(4, [2, 3, 4, 6, 8], lvl)
        const rawMax = evaluateLevelBand(6, [3, 4, 5, 7, 9], lvl)
        const synPct = (state.hardPoints[225] ?? 0) * 8
        const minSec = Math.floor((Math.trunc((rawMin * 8 * (100 + synPct)) / 100) * 75) / 256)
        const maxSec = Math.floor((Math.trunc((rawMax * 8 * (100 + synPct)) / 100) * 75) / 256)
        zh = `每秒平均火焰傷害：${minSec} - ${maxSec}`
        en = `Average Fire Damage: ${minSec}-${maxSec} per second`
      } else if (skill.id === 249) {
        // 1.13c armageddonfire: EMin=9, EMax=12, EMinLev=[4,5,6,6,6], EMaxLev=[5,6,7,7,7], HitShift=4
        const rawMin = evaluateLevelBand(9, [4, 5, 6, 6, 6], lvl)
        const rawMax = evaluateLevelBand(12, [5, 6, 7, 7, 7], lvl)
        const minSec = Math.floor((rawMin * 16 * 75) / 256)
        const maxSec = Math.floor((rawMax * 16 * 75) / 256)
        zh = `每秒平均火焰傷害：${minSec} - ${maxSec}`
        en = `Average Fire Damage: ${minSec}-${maxSec} per second`
      }
    } else if (lt === 23) {
      const frames = skill.id === 234 ? 80 : (valA > 0 ? valA : 80)
      const sec = Math.round((frames / 25) * 10) / 10
      zh = `${textaZh || '持續：'}${sec} 秒`
      en = `${line.textaEn || 'Duration:'} ${sec} seconds`
    } else if (lt === 24) {
      const dmg = calculateDetailedDamage(state, skill, lvl)
      const dMin = dmg.hasDamage ? dmg.finalMin : ctx.edmn
      const dMax = dmg.hasDamage ? dmg.finalMax : ctx.edmx
      const bPrefixZh = line.textbZh ? `${line.textbZh} ` : ''
      const bPrefixEn = line.textbEn ? `${line.textbEn} ` : ''
      zh = `${bPrefixZh}${textaZh}${dMin} - ${dMax}`
      en = `${bPrefixEn}${line.textaEn || ''} ${dMin}-${dMax}`.trim()
    } else if (lt === 26 || lt === 27) {
      const dmg = calculateDetailedDamage(state, skill, lvl)
      const elemZh = dmg.type === 'cold' ? '冰冷' : '火焰'
      const elemEn = dmg.type === 'cold' ? 'Cold' : 'Fire'
      zh = `每秒平均${elemZh}傷害：${dmg.finalMin} - ${dmg.finalMax}`
      en = `Average ${elemEn} Damage: ${dmg.finalMin}-${dmg.finalMax} per second`
    } else if (lt === 32) {
      const tbZh = (line.textbZh || '').replace(/：$/, '')
      const tbEn = (line.textbEn || '').replace(/:$/, '')
      zh = `${textaZh}+${valA}%${tbZh ? ' ' + tbZh : ''}`
      en = `${line.textaEn || ''} +${valA}%${tbEn ? ' ' + tbEn : ''}`.trim()
    } else if (lt === 33) {
      zh = `${textaZh}${line.textbZh || ''}`
      en = `${line.textaEn || ''}${line.textbEn ? ' ' + line.textbEn : ''}`.trim()
    } else if (lt === 34) {
      const smLvl = getEffectiveLevel(state, 69)
      const masteryDmg = smLvl * 2
      const baseMin = (skill.minionStats?.minDam ?? 1) + ctx.edmn + masteryDmg
      const baseMax = (skill.minionStats?.maxDam ?? 2) + ctx.edmn + masteryDmg
      const bonusPct = lvl < 4 ? 0 : (lvl - 3) * 7
      const finalMin = Math.floor((baseMin * (100 + bonusPct)) / 100)
      const finalMax = Math.floor((baseMax * (100 + bonusPct)) / 100)
      zh = `傷害：${finalMin} - ${finalMax}`
      en = `Damage: ${finalMin} - ${finalMax}`
    } else if (lt === 35) {
      zh = `${textaZh || '聖火'}傷害：${valA} - ${valB}`
      en = `${line.textaEn || 'Holy Fire'} Damage: ${valA} - ${valB}`
    } else if (lt === 36) {
      zh = `${textaZh || '總數'}：${valA}`
      en = `${line.textaEn || 'Total'}: ${valA}`
    } else if (lt === 38) {
      zh = `${textaZh || '傷害：'}${valA} - ${valB}${line.textbZh || '%的屍體生命'}`
      en = `${line.textaEn || 'Damage:'} ${valA}-${valB} ${line.textbEn || 'percent of corpse Life'}`
    } else if (lt === 39) {
      const baseMin = skill.minionStats?.minDam ?? 2
      const baseMax = skill.minionStats?.maxDam ?? 5
      const fgBlvl = state.hardPoints[94] ?? 0
      const selfDmgPct =
        skill.id === 75
          ? (skill.params.par2 ?? 35) * (lvl - 1)
          : skill.id === 85
            ? (skill.params.par4 ?? 35) * (lvl - 1)
            : 0
      const dmgPct = selfDmgPct + fgBlvl * 6
      const finalMin = Math.floor((baseMin * (100 + dmgPct)) / 100)
      const finalMax = Math.floor((baseMax * (100 + dmgPct)) / 100)
      zh = `傷害：${finalMin} - ${finalMax}`
      en = `Damage: ${finalMin} - ${finalMax}`
    } else if (lt === 41) {
      zh = `火焰傷害：${valA} - ${valB}`
      en = `Fire Damage: ${valA} - ${valB}`
    } else if (lt === 43) {
      const min43 = Math.floor(valA / 256)
      const max43 = Math.floor(valB / 256)
      zh = `${textaZh}${min43} - ${max43}${line.textbZh || ''}`
      en = `${(line.textaEn || '').trim()} ${min43}-${max43}${line.textbEn || ''}`.trim()
    } else if (lt === 45) {
      zh = `反彈物理傷害：${valA}%`
      en = `Damage Returned: ${valA}%`
    } else if (lt === 49) {
      const sMin =
        ctx.edmn > 0 || ctx.edmx > 0
          ? ctx.edmn
          : Math.round(evaluateLevelBand(skill.minDam, skill.minLevDam, lvl) * shiftMultiplier)
      const sMax =
        ctx.edmn > 0 || ctx.edmx > 0
          ? ctx.edmx
          : Math.round(evaluateLevelBand(skill.maxDam, skill.maxLevDam, lvl) * shiftMultiplier)
      zh = `${textaZh || '重擊傷害：'}+${sMin} - ${sMax}`
      en = `${line.textaEn || 'Smite Damage:'} +${sMin}-${sMax}`
    } else if (lt === 50) {
      zh = `${textaZh || '聖光彈的傷害：'}${ctx.m1en ?? 0} - ${ctx.m1ex ?? 0}`
      en = `${line.textaEn || 'Holy Bolt Damage:'} ${ctx.m1en ?? 0}-${ctx.m1ex ?? 0}`
    } else if (lt === 52) {
      zh = `${textaZh}+${valA} - ${valB}%`
      en = `${line.textaEn || ''} +${valA}-${valB}%`.trim()
    } else if (lt === 57) {
      const sec = Math.round((valA / 25) * 10) / 10
      zh = `${textaZh || '持續：'}+${sec} 秒`
      en = `${line.textaEn || 'Duration:'} +${sec} seconds`
    } else if (lt === 59) {
      zh = `每秒平均${textaZh || '火焰傷害：'}${valA} - ${valB}`
      en = `Average ${(line.textaEn || 'Fire Damage:').trim()} ${valA}-${valB} per second`
    } else if (lt === 61) {
      zh = `${textaZh}${valA}${line.textbZh ? ' ' + line.textbZh : ''}`
      en = `${line.textaEn || ''} ${valA}${line.textbEn ? ' ' + line.textbEn : ''}`.trim()
    } else if (lt === 62) {
      zh = `${textaZh ? textaZh + ' ' : ''}${line.textbZh || ''}${valA} - ${valB}`
      en = `${line.textaEn ? line.textaEn + ' ' : ''}${line.textbEn ? line.textbEn + ' ' : ''}${valA}-${valB}`.trim()
    } else if (lt === 66) {
      zh = textaZh.includes('%d%%') ? textaZh.replace('%d%%', `${valA}%`) : `${textaZh}${valA}%`
      en = (line.textaEn || '').includes('%d%%')
        ? (line.textaEn || '').replace('%d%%', `${valA}%`)
        : `${line.textaEn || ''} ${valA}%`.trim()
    } else if (lt === 70) {
      const tbZh = (line.textbZh || '').replace(/：$/, '')
      const tbEn = (line.textbEn || '').replace(/:$/, '')
      zh = `${textaZh}+${valA}${tbZh ? ' ' + tbZh : ''}`
      en = `${line.textaEn || ''} +${valA}${tbEn ? ' ' + tbEn : ''}`.trim()
    } else if (lt === 72 || lt === 73) {
      zh = `${valA}/${valB} ${textaZh || '武器傷害'}`
      en = `${valA}/${valB} ${line.textaEn || 'Weapon Damage'}`
    } else if (textaZh || line.textaEn) {
      zh = `${textaZh}${valA > 0 ? ' +' + valA : ''}`
      en = `${line.textaEn || ''}${valA > 0 ? ' +' + valA : ''}`
    }

    if (zh.trim() && en.trim()) {
      results.push({ lineType: lt, textZh: zh.trim(), textEn: en.trim(), value: valA })
    }
  }
  return results
}

// ============================================================================
// Tooltip View Model Generator
// ============================================================================

export interface TooltipViewModel {
  readonly skill: SkillCatalogEntry
  readonly hardPoints: number
  readonly effectiveLevel: number
  readonly isLearned: boolean
  readonly canAllocateNow: boolean
  readonly reqlevel: number
  readonly levelMet: boolean
  readonly prereqs: readonly {
    readonly id: number
    readonly name: string
    readonly nameZh: string
    readonly met: boolean
  }[]
  readonly current: {
    readonly level: number
    readonly manaCost: number
    readonly delaySeconds: number
    readonly damage: DetailedDamageResult
    readonly effects: readonly FormattedDescLine[]
  }
  readonly nextLevel: {
    readonly level: number
    readonly manaCost: number
    readonly damage: DetailedDamageResult
    readonly effects: readonly FormattedDescLine[]
  } | null
  readonly synergiesReceived: readonly {
    readonly providerId: number
    readonly providerName: string
    readonly providerNameZh: string
    readonly percentPerLevel: number
    readonly hardPoints: number
    readonly currentBonusPct: number
    readonly type?: 'damage' | 'elemental' | 'duration' | 'attack' | 'life' | 'defense' | 'toHit' | 'magic' | undefined
    readonly labelEn?: string | undefined
    readonly labelZh?: string | undefined
  }[]
  readonly synergiesGiven: readonly {
    readonly targetId: number
    readonly targetName: string
    readonly targetNameZh: string
    readonly percentPerLevel: number
  }[]
  readonly masteryInfo: MasteryCalculationResult | null
  readonly shortDesc: string
  readonly shortDescZh: string
  readonly longDesc: string
  readonly longDescZh: string
}

/**
 * Builds the complete view model for the hover tooltip.
 */
export function buildTooltipViewModel(
  state: SkillCalcState,
  skillId: number,
  playerLevel: number = 99
): TooltipViewModel | null {
  const skill = SKILLS_BY_ID[skillId]
  if (!skill) return null

  const hard = state.hardPoints[skillId] ?? 0
  const eff = getEffectiveLevel(state, skillId)
  const isLearned = eff > 0
  const levelMet = playerLevel >= skill.reqlevel
  const canAlloc = canAllocate(state, skillId)

  // Prerequisite status
  const prereqs = skill.reqskills.map(reqId => {
    const reqSkill = SKILLS_BY_ID[reqId]
    return {
      id: reqId,
      name: reqSkill?.name || `Skill ${reqId}`,
      nameZh: reqSkill?.nameZh || reqSkill?.name || `技能 ${reqId}`,
      met: (state.hardPoints[reqId] ?? 0) >= 1,
    }
  })

  // Current Level stats (if unlearned, preview level 1)
  const displayLevel = isLearned ? eff : 1
  const currentMana = calculateManaCost(skill, displayLevel)
  const delaySec = skill.delay > 0 ? Math.round((skill.delay / 25) * 10) / 10 : 0
  const currentDamage = calculateDetailedDamage(state, skill, displayLevel)
  const currentEffects = evaluateSkillEffects(state, skill, displayLevel)

  // Next Level stats: only show when learned and not maxed
  let nextLevel: TooltipViewModel['nextLevel'] = null
  if (isLearned && hard < 20) {
    const nextLvl = eff + 1
    nextLevel = {
      level: nextLvl,
      manaCost: calculateManaCost(skill, nextLvl),
      damage: calculateDetailedDamage(state, skill, nextLvl),
      effects: evaluateSkillEffects(state, skill, nextLvl),
    }
  }

  const synResult = evaluateSynergies(state, skill)
  const masteryInfo = evaluateMasteries(state, skill)

  return {
    skill,
    hardPoints: hard,
    effectiveLevel: eff,
    isLearned,
    canAllocateNow: canAlloc,
    reqlevel: skill.reqlevel,
    levelMet,
    prereqs,
    current: {
      level: displayLevel,
      manaCost: currentMana,
      delaySeconds: delaySec,
      damage: currentDamage,
      effects: currentEffects,
    },
    nextLevel,
    synergiesReceived: synResult.list,
    synergiesGiven: skill.synergiesGiven || [],
    masteryInfo,
    shortDesc: skill.shortDesc,
    shortDescZh: skill.shortDescZh,
    longDesc: skill.longDesc,
    longDescZh: skill.longDescZh,
  }
}

// ============================================================================
// Build Serialization (URL Hash)
// ============================================================================

/**
 * Serializes state into a compact URL hash: #ama:6=20,7=1;tab=0,1,0;all=2
 */
export function serializeBuildToHash(state: SkillCalcState): string {
  const parts: string[] = []
  const skillsStr = Object.entries(state.hardPoints)
    .filter(([_, pts]) => pts > 0)
    .map(([id, pts]) => `${id}:${pts}`)
    .join(',')
  parts.push(`c=${state.classCode}`)
  if (skillsStr) parts.push(`s=${skillsStr}`)

  const tabsStr = [state.tabSoftPoints[0] || 0, state.tabSoftPoints[1] || 0, state.tabSoftPoints[2] || 0].join(',')
  if (tabsStr !== '0,0,0') parts.push(`t=${tabsStr}`)
  if (state.allSkillsSoftPoints > 0) parts.push(`a=${state.allSkillsSoftPoints}`)

  return '#' + parts.join(';')
}

/**
 * Deserializes URL hash into state.
 */
export function deserializeBuildFromHash(hash: string): SkillCalcState | null {
  if (!hash || !hash.startsWith('#')) return null
  try {
    const raw = hash.slice(1)
    const tokens = raw.split(';')
    let classCode: CharacterClassCode = 'ama'
    const hardPoints: Record<number, number> = {}
    const tabSoftPoints: Record<number, number> = { 0: 0, 1: 0, 2: 0 }
    let allSkillsSoftPoints = 0

    for (const token of tokens) {
      const eqIdx = token.indexOf('=')
      if (eqIdx === -1) continue
      const key = token.slice(0, eqIdx)
      const val = token.slice(eqIdx + 1)
      if (key === 'c' && val) {
        if (['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'].includes(val)) {
          classCode = val as CharacterClassCode
        }
      } else if (key === 's' && val) {
        const pairs = val.split(',')
        for (const pair of pairs) {
          const [idStr, ptsStr] = pair.includes(':') ? pair.split(':') : pair.split('=')
          const id = Number(idStr)
          const pts = Number(ptsStr)
          if (id > 0 && pts > 0 && pts <= 20) {
            hardPoints[id] = pts
          }
        }
      } else if (key === 't' && val) {
        const t = val.split(',').map(Number)
        tabSoftPoints[0] = t[0] || 0
        tabSoftPoints[1] = t[1] || 0
        tabSoftPoints[2] = t[2] || 0
      } else if (key === 'a' && val) {
        allSkillsSoftPoints = Number(val) || 0
      }
    }

    return {
      classCode,
      hardPoints,
      tabSoftPoints,
      allSkillsSoftPoints,
      specificSoftPoints: {},
    }
  } catch {
    return null
  }
}
