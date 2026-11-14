/**
 * Diablo II: Lord of Destruction v1.13c `UNIT_MISSILE` Runtime (`MissileEngine`).
 *
 * Implements:
 * - `Missiles.txt` trajectory & frame lifecycle (`Vel`, `MaxVel`, `Accel`, `Range + (slvl - 1) * LevRange`).
 * - `NextHit` & `NextDelay` per-target immunity window (`lastNextDelayTickByTargetId`) so
 *   multi-projectile skills (`Multiple Shot`, `Teeth`, `Charged Bolt`, `Nova`, `Shock Web`,
 *   `Tornado`, `Twister`, `Wake of Fire`) obey exact 1.13c `NextDelay` frames.
 * - `Pierce`: Missiles.txt `Pierce` flag + creation-time `pierce_idx` roll from the owner's
 *   `item_pierce + skill_pierce` (at most 4), consumed per hit (`missile-pierce.ts`, Issue #1420).
 * - `pSrvDoFunc` (linear flight, spiral `Blessed Hammer`, homing `Guided Arrow`/`Bone Spirit`,
 *   radial bolt emitter `Frozen Orb` `pSrvDoFunc=15`, ground fire trail `Blaze`/`Fire Wall`/`Molten Boulder`).
 * - `pSrvHitFunc` (`Fire Ball` radial splash `1`, `Holy Bolt` undead/ally heal `7`,
 *   `Chain Lightning`/`Lightning Strike`/`royalstrikechainlightning` `*12` chain jump,
 *   `Lightning Fury` `20` radial bolts, `Fist of the Heavens` `22` radial `holybolt`,
 *   `Frozen Orb` `29` final ice bolt nova).
 */
import {
  checkMissileSegmentFootprintOverlap113c as checkMissileSegmentFootprintOverlapCommon113c,
  checkMissileSizeFootprintOverlap113c,
  stepMissileSubtileRay113c as stepMissileSubtileRayCommon113c,
} from '../../common/skills/missile-size-footprint-113c.ts'
import type { D2DataRegistry, MissileRecord, SkillRecord } from '../../common/data/data-registry.ts'
import { executeSUnitDmg, type CombatUnitContext, type SUnitDmgPacket } from './combat-pipeline.ts'
import { METEOR_FIRE_SUBTILE_OFFSETS } from '../../common/data/meteor-table.ts'
import {
  calculateMeteorResidualFireDamage,
  calculateFistOfTheHeavensHolyBoltDamage,
} from '../skills/skills.ts'
import { FIXED_ONE } from './stat-list.ts'
import { compute3BandDuration, compute5BandScaling, computeDiminishingReturns, evaluateCalc } from '../../common/data/calc-ast.ts'
import { D2Rng, hashString32 } from '../../common/rng/d2-rng.ts'
import { ownerCanConsumePierce, resolveMissilePierceIdx } from './missile-pierce.ts'
import { resolveAiCurseDivisor } from '../skills/barbarian-warcries.ts'
import { getMonsterPathRecord } from '../../common/path/units.ts'
import {
  calculateColdArrowStats,
  calculateMultipleShotStats,
  calculateStrafeStats,
  calculateIceArrowStats,
  calculateImmolationArrowStats,
  calculateFreezingArrowStats,
  generateMultipleShotAngles,
  isMultipleShotCenterArrow,
} from '../../common/skills/amazon-bow.ts'

export { isMultipleShotCenterArrow }
export const ISO_GROUND_ASPECT_RATIO = 0.5


export interface DamageRange {
  readonly min: number
  readonly max: number
}

export interface PoisonDamageSpec {
  readonly minDamage: number
  readonly maxDamage: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly minRate: number
  readonly maxRate: number
}

export type SynergyState = Record<string, number | undefined>

export interface StaticFieldResult {
  readonly damage: number
  readonly newHp: number
  readonly immune: boolean
  readonly blockedByFloor: boolean
}

/**
 * Authentic 1.13c Static Field damage calculation with pre-check invariant and difficulty floors.
 * Source: D2Game.dll VA 0x6FC62F13 (SKILLS_AuraCallback_StaticField) & DifficultyLevels.txt
 */
export function calculateStaticFieldDamage(
  currentHp: number,
  maxHp: number,
  difficulty: 'normal' | 'nightmare' | 'hell' = 'normal',
  lightningRes = 0,
): StaticFieldResult {
  const minPct = difficulty === 'hell' ? 50 : difficulty === 'nightmare' ? 33 : 0
  const hpFloor = difficulty === 'normal' ? 1 : Math.max(1, Math.floor((maxHp * minPct) / 100))

  // 1.13c Assembly Invariant (SKILLS_AuraCallback_StaticField at 0x6FC62F13):
  // If current HP is already at or below the difficulty floor, return 0 damage immediately!
  if (currentHp <= hpFloor) {
    return { damage: 0, newHp: currentHp, immune: false, blockedByFloor: true }
  }

  if (lightningRes >= 100) {
    return { damage: 0, newHp: currentHp, immune: true, blockedByFloor: false }
  }

  let damage = Math.floor(currentHp * 0.25)

  // Support negative resistance scaling (Lower Resist, Conviction, -% enemy lightning resistance).
  // Clamped to [-100, 99]% per Diablo II resistance lower bound.
  const clampedRes = Math.max(-100, Math.min(99, lightningRes))
  damage = Math.floor((damage * (100 - clampedRes)) / 100)

  // CRITICAL SAFETY INVARIANT: Non-lethal damage clamping MUST occur AFTER resistance scaling
  // so Static Field NEVER deals lethal damage (newHp >= 1, damage <= currentHp - 1)
  damage = Math.min(damage, Math.max(0, currentHp - 1))

  return { damage, newHp: currentHp - damage, immune: false, blockedByFloor: false }
}

export function calculateStaticFieldRadiusYards(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 4 + lvl
}

export function calculateStaticFieldRadiusPx(slvl: number): number {
  return calculateStaticFieldRadiusYards(slvl) * 40
}

/**
 * Calculates Frost Nova (Skill 44) synergy multiplier:
 * +10% cold damage per hard point in Blizzard (59) and Frozen Orb (64).
 */
export function calculateFrostNovaSynergyMultiplier(synergies?: {
  readonly blizzard?: number | undefined
  readonly frozenOrb?: number | undefined
} | number): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  }
  const points = (synergies?.blizzard ?? 0) + (synergies?.frozenOrb ?? 0)
  return 1.0 + points * 0.10
}

/**
 * Calculates Frost Nova (Skill 44) cold damage range:
 * 1.13c ground truth:
 * - EMin: 4, EMax: 8
 * - EMinLev1..5: [4, 6, 8, 10, 12]
 * - EMaxLev1..5: [5, 7, 9, 11, 13]
 * - HitShift: 7 (effective damage = base >> 1 = base / 2)
 * - Synergies: +10% cold damage per hard point in Blizzard and Frozen Orb.
 * - Kinematic: Expanding circular ring of 64 radial bolts with 2:1 isometric ground foreshortening.
 */
export function calculateFrostNovaDamage(
  slvl: number,
  synergies?: {
    readonly blizzard?: number | undefined
    readonly frozenOrb?: number | undefined
  } | number,
): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const syn = calculateFrostNovaSynergyMultiplier(synergies)

  const baseMin = compute5BandScaling(lvl, 4, 4, 6, 8, 10, 12)
  const baseMax = compute5BandScaling(lvl, 8, 5, 7, 9, 11, 13)

  const min = Math.floor((baseMin / 2) * syn)
  const max = Math.floor((baseMax / 2) * syn)

  return { min, max }
}

/**
 * Calculates Frost Nova (Skill 44) cold chill duration in frames at 25 fps:
 * 1.13c ground truth:
 * - ELen: 200 frames (8.0 seconds)
 * - ELevLen1..3: 25 frames (+1.0 second per level)
 * - Formula: 200 + (slvl - 1) * 25 frames
 */
export function calculateFrostNovaChillLength(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 200 + (lvl - 1) * 25
}

/**
 * Authentic 1.13c Nova 5-band damage scaling (Skills.txt row 48):
 * EMin: 1, EMinLev1..5: 6, 7, 8, 9, 10
 * EMax: 20, EMaxLev1..5: 8, 9, 10, 11, 12
 * 0 synergies in 1.13c.
 */
export function calculateNovaDamage(
  slvl: number,
  synergies?: {
    readonly lightningMastery?: number | undefined
  } | number,
  lightningMastery?: number,
): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let min = 1
  let max = 20
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    min += b1 * 6
    max += b1 * 8
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * 7
      max += b2 * 9
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * 8
      max += b3 * 10
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * 9
      max += b4 * 11
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * 10
      max += b5 * 12
    }
  }

  const masteryLvl =
    typeof lightningMastery === 'number'
      ? lightningMastery
      : typeof synergies === 'object' && synergies !== null
        ? synergies.lightningMastery ?? 0
        : 0
  const masteryBonus = masteryLvl > 0 ? calculateLightningMasteryBonusPct(masteryLvl) : 0
  const synMult = typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0

  min = Math.floor(min * synMult * (1 + masteryBonus / 100))
  max = Math.floor(max * synMult * (1 + masteryBonus / 100))
  return { min, max }
}

/**
 * Authentic 1.13c Lightning (Skill 49) synergy multiplier:
 * +8% lightning damage per hard point in Charged Bolt (38), Nova (48), and Chain Lightning (53).
 */
export function calculateLightningSynergyMultiplier(synergies: {
  readonly chargedBolt?: number | undefined
  readonly chargedBoltPoints?: number | undefined
  readonly nova?: number | undefined
  readonly novaPoints?: number | undefined
  readonly chainLightning?: number | undefined
  readonly chainLightningPoints?: number | undefined
}): number {
  const points =
    (synergies.chargedBolt ?? synergies.chargedBoltPoints ?? 0) +
    (synergies.nova ?? synergies.novaPoints ?? 0) +
    (synergies.chainLightning ?? synergies.chainLightningPoints ?? 0)
  return 1.0 + points * 0.08
}

/**
 * Authentic 1.13c Lightning (Skill 49) 5-band damage scaling (Skills.txt row 51):
 * EMin: 1, EMinLev1..5: 0 (Min damage is always 1)
 * EMax: 40, EMaxLev1..5: 8, 12, 20, 28, 36
 * Synergy: +8% per hard point in Charged Bolt, Nova, Chain Lightning.
 */
export function calculateLightningDamage(
  slvl: number,
  synergies?: {
    readonly chargedBolt?: number | undefined
    readonly chargedBoltPoints?: number | undefined
    readonly nova?: number | undefined
    readonly novaPoints?: number | undefined
    readonly chainLightning?: number | undefined
    readonly chainLightningPoints?: number | undefined
    readonly lightningMastery?: number | undefined
  } | number,
  lightningMastery?: number,
): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let min = 1
  let max = 40
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    max += b1 * 8
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      max += b2 * 12
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      max += b3 * 20
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      max += b4 * 28
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      max += b5 * 36
    }
  }

  const synMult =
    typeof synergies === 'number'
      ? (Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0)
      : synergies
        ? calculateLightningSynergyMultiplier(synergies)
        : 1.0

  const masteryLvl =
    typeof lightningMastery === 'number'
      ? lightningMastery
      : typeof synergies === 'object' && synergies !== null
        ? synergies.lightningMastery ?? 0
        : 0
  const masteryBonus = masteryLvl > 0 ? calculateLightningMasteryBonusPct(masteryLvl) : 0

  // The flat 1-point min (EMin=1, EMinLev1=0) is not synergised: D2Common #10121 0x6FDA04C7 (#1681)
  min = Math.floor(min * (1 + masteryBonus / 100))
  max = Math.floor(max * synMult * (1 + masteryBonus / 100))
  return { min, max }
}

/**
 * Authentic 1.13c Chain Lightning (Skill 53) synergy multiplier:
 * +4% lightning damage per hard point in Charged Bolt (38), Nova (48), and Lightning (49).
 */
export function calculateChainLightningSynergyMultiplier(synergies: {
  readonly chargedBolt?: number | undefined
  readonly chargedBoltPoints?: number | undefined
  readonly nova?: number | undefined
  readonly novaPoints?: number | undefined
  readonly lightning?: number | undefined
  readonly lightningPoints?: number | undefined
}): number {
  const points =
    (synergies.chargedBolt ?? synergies.chargedBoltPoints ?? 0) +
    (synergies.nova ?? synergies.novaPoints ?? 0) +
    (synergies.lightning ?? synergies.lightningPoints ?? 0)
  return 1.0 + points * 0.04
}

/**
 * Authentic 1.13c Chain Lightning (Skill 53) jumps calculation:
 * 1.13c Skills.txt: Param5 = 5 (base jumps), calc1 = ln34 / 5 -> 5 + Math.floor(slvl / 5).
 */
export function calculateChainLightningJumps(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 5 + Math.floor(lvl / 5)
}

/**
 * Authentic 1.13c Chain Lightning (Skill 53) 5-band damage scaling (Skills.txt row 55):
 * EMin: 1, EMinLev1..5: 0 (Min damage is always 1)
 * EMax: 40, EMaxLev1..5: 11, 13, 15, 15, 15
 * Synergy: +4% per hard point in Charged Bolt, Nova, Lightning.
 */
export function calculateChainLightningDamage(
  slvl: number,
  synergies?: {
    readonly chargedBolt?: number | undefined
    readonly chargedBoltPoints?: number | undefined
    readonly nova?: number | undefined
    readonly novaPoints?: number | undefined
    readonly lightning?: number | undefined
    readonly lightningPoints?: number | undefined
    readonly lightningMastery?: number | undefined
  } | number,
  lightningMastery?: number,
): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let min = 1
  let max = 40
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    max += b1 * 11
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      max += b2 * 13
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      max += b3 * 15
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      max += b4 * 15
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      max += b5 * 15
    }
  }

  const synMult =
    typeof synergies === 'number'
      ? (Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0)
      : synergies
        ? calculateChainLightningSynergyMultiplier(synergies)
        : 1.0

  const masteryLvl =
    typeof lightningMastery === 'number'
      ? lightningMastery
      : typeof synergies === 'object' && synergies !== null
        ? synergies.lightningMastery ?? 0
        : 0
  const masteryBonus = masteryLvl > 0 ? calculateLightningMasteryBonusPct(masteryLvl) : 0

  // The flat 1-point min (EMin=1, EMinLev1=0) is not synergised: D2Common #10121 0x6FDA04C7 (#1681)
  min = Math.floor(min * (1 + masteryBonus / 100))
  max = Math.floor(max * synMult * (1 + masteryBonus / 100))
  return { min, max }
}

/**
 * Authentic 1.13c Charged Bolt (Skill 38) 32-entry discrete orthogonal jitter offset lookup table.
 * Source: D2Common.dll VA 0x6FD85470 (PATH_ComputePathChargedBolt)
 */
export const GAT_CHARGED_BOLT_OFFSETS: readonly number[] = Object.freeze([
  -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1,
   0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 1,
])

/**
 * Authentic 1.13c Charged Bolt (Skill 38) bolt count:
 * min(24, slvl + 2)
 */
export function calculateChargedBoltCount(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return Math.min(24, lvl + 2)
}

/**
 * Authentic 1.13c Charged Bolt (Skill 38) synergy multiplier:
 * +6% lightning damage per hard point in Lightning (49).
 */
export function calculateChargedBoltSynergyMultiplier(synergies: {
  readonly lightning?: number | undefined
  readonly lightningPoints?: number | undefined
} | number): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  }
  const points = synergies?.lightning ?? synergies?.lightningPoints ?? 0
  return 1.0 + points * 0.06
}

/**
 * Authentic 1.13c Charged Bolt (Skill 38) 5-band damage scaling (Skills.txt row 40):
 * Base: 2-4, lvl 2-8: +1/+1, lvl 9-16: +1/+1, lvl 17-22: +2/+2, lvl 23-28: +3/+3, lvl 29+: +4/+4.
 * Synergy: +6% per hard point in Lightning (49).
 */
export function calculateChargedBoltDamage(
  slvl: number,
  synergies?: {
    readonly lightning?: number | undefined
    readonly lightningPoints?: number | undefined
    readonly lightningMastery?: number | undefined
  } | number,
  lightningMastery?: number,
): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let min = 2
  let max = 4
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    min += b1 * 1
    max += b1 * 1
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * 1
      max += b2 * 1
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * 2
      max += b3 * 2
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * 3
      max += b4 * 3
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * 4
      max += b5 * 4
    }
  }

  const synMult =
    typeof synergies === 'number'
      ? (Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0)
      : synergies
        ? calculateChargedBoltSynergyMultiplier(synergies)
        : 1.0

  const masteryLvl =
    typeof lightningMastery === 'number'
      ? lightningMastery
      : typeof synergies === 'object' && synergies !== null
        ? synergies.lightningMastery ?? 0
        : 0
  const masteryBonus = masteryLvl > 0 ? calculateLightningMasteryBonusPct(masteryLvl) : 0

  min = Math.floor(min * synMult * (1 + masteryBonus / 100))
  max = Math.floor(max * synMult * (1 + masteryBonus / 100))
  return { min, max }
}

/**
 * Authentic 1.13c Telekinesis (Skill 43) hard synergy to Energy Shield (Skill 58):
 * Reduces Energy Shield damage-to-mana consumption ratio by 1/16 (0.0625) per hard point:
 * ratio = (32 - Math.min(20, TK_blvl)) / 16.
 * Level 0 -> 2.00, Level 8 -> 1.50, Level 16 -> 1.00, Level 20 -> 0.75.
 */
export function calculateEnergyShieldManaRatio(telekinesisBaseLevel: number): number {
  const blvl = Number.isFinite(telekinesisBaseLevel) ? Math.max(0, Math.floor(telekinesisBaseLevel)) : 0
  return (32 - Math.min(20, blvl)) / 16
}

/**
 * Authentic 1.13c Telekinesis (Skill 43) combat damage (Skills.txt row 45):
 * Deals 1-2 lightning damage base (slvl to slvl + 1).
 */
export function calculateTelekinesisDamage(slvl: number): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return { min: lvl, max: lvl + 1 }
}

/**
 * Authentic 1.13c Telekinesis (Skill 43) remote item pickup whitelist:
 * Allowed: Potions, scrolls, gold, ammo (arrows/bolts), keys.
 * Forbidden: Equipment (weapons, armor, helms, shields, boots, gloves, belts, rings, amulets).
 */
export function isTelekinesisItemAllowed(item: any): boolean {
  if (!item) return false
  if (item.isGold === true) return true
  const code = (item.code || item.item?.code || item.base?.code || item.id || item.item?.id || '').toLowerCase().trim()
  const name = (item.name || item.item?.name || item.nameZh || item.item?.nameZh || '').toLowerCase()
  const type = (item.type || item.item?.type || item.base?.type || item.category || '').toLowerCase()

  if (code === 'gld' || code === 'gold' || item.isGold) return true
  if (/^(hp[1-5]|mp[1-5]|rvs|rvl|vps|yps|wms|ant|thw|sta)$/.test(code)) return true
  if (name.includes('potion') || name.includes('药剂') || name.includes('药水') || name.includes('活力') || name.includes('解毒') || name.includes('解冻')) return true
  if (/^(tsc|isc|tbk|ibk)$/.test(code)) return true
  if (name.includes('scroll') || name.includes('卷轴') || name.includes('tome') || name.includes('书')) return true
  if (/^(aqv|cqv)$/.test(code)) return true
  if (name.includes('arrow') || name.includes('bolt') || name.includes('箭矢') || name.includes('十字弓弹')) return true
  if (code === 'key' || name.includes('key') || name.includes('钥匙')) return true
  if (
    type === 'potion' ||
    type.includes('potion') ||
    type === 'scroll' ||
    type.includes('scroll') ||
    type === 'gold' ||
    type === 'ammo' ||
    type.includes('ammo') ||
    type.includes('arrow') ||
    type.includes('bolt') ||
    type === 'key'
  ) {
    return true
  }

  return false
}

/**
 * Authentic 1.13c Telekinesis (Skill 43) remote interactive object whitelist:
 * Supports: chest, locked chest, waypoint, portal, shrine, door, well, urn, sarcophagus, casket, stash, barrel.
 */
export function isTelekinesisObjectAllowed(objectTypeOrName: string): boolean {
  if (!objectTypeOrName) return false
  const norm = objectTypeOrName.toLowerCase().trim()
  return (
    norm.includes('chest') ||
    norm.includes('waypoint') ||
    norm.includes('portal') ||
    norm.includes('shrine') ||
    norm.includes('door') ||
    norm.includes('well') ||
    norm.includes('urn') ||
    norm.includes('casket') ||
    norm.includes('stash') ||
    norm.includes('barrel') ||
    norm.includes('sarcophagus') ||
    norm.includes('tomb')
  )
}


export function hasLineOfSight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  terrain:
    | MissileTerrainCollision
    | ((x: number, y: number, fromX?: number, fromY?: number, mask?: number) => boolean)
    | undefined,
  mask?: number,
): boolean {
  if (!terrain) {
    throw new Error('hasLineOfSight requires a valid terrain collision provider')
  }
  if (mask === 0) return true
  const dist = Math.hypot(x1 - x0, y1 - y0)
  if (dist === 0) return true
  const steps = stepMissileSubtileRay113c(x0, y0, x1, y1, MISSILE_SUBTILE_FLAT_PX)
  let prevX = x0
  let prevY = y0
  for (let i = 1; i < steps.length; i++) {
    const pt = steps[i]!
    const curX = pt.x
    const curY = pt.y
    let blocked = false
    if (typeof terrain === 'function') {
      blocked = Boolean(terrain(curX, curY, prevX, prevY, mask))
    } else if (terrain.isMissileBlocked !== undefined) {
      blocked = terrain.isMissileBlocked(curX, curY, prevX, prevY, mask)
    } else if (terrain.overlap !== undefined) {
      blocked = terrain.overlap(curX, curY) > 0
    } else {
      throw new Error('hasLineOfSight requires terrain with isMissileBlocked or overlap')
    }
    if (blocked) {
      return false
    }
    prevX = curX
    prevY = curY
  }
  return true
}


/**
 * Authentic D2Game 64-entry discrete circle lookup tables (radius 30).
 * Replicated byte-for-byte from D2Game.dll 0x6FC60CA0 (MISSMODE_SrvDo15_FrozenOrb, tables 0x6FD1CA60/0x6FD1C960)
 * and 0x6FC5C850 (MISSMODE_SrvHit29_FrozenOrb, tables 0x6FD1C790/0x6FD1C690).
 */
export const FROZEN_ORB_X_POSITIONS: readonly number[] = Object.freeze([
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
])

export const FROZEN_ORB_Y_POSITIONS: readonly number[] = Object.freeze([
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
])

export interface ActiveMissile {
  readonly uid: string
  readonly missileId: number
  readonly name: string
  readonly celFile: string
  readonly sourceSkillId: number
  readonly slvl: number
  readonly owner: CombatUnitContext
  readonly record: MissileRecord
  x: number
  y: number
  vx: number
  vy: number
  /**
   * Fixed-point velocity (`Vel << 8`), initialized in `MISSILE_CreateMissileFromParams` (`0x6FC8F930`)
   * and stepped each frame by `accel` in `PATH_StepVelocity` (`0x6FD5CEB0`).
   */
  vel256: number
  /**
   * Fixed-point maximum velocity (`MaxVel << 8` when `Accel != 0`, otherwise initial `vel256`) per `0x6FC8FB13..0x6FC8FB5A`.
   */
  readonly maxVel256: number
  /**
   * Fixed-point acceleration per frame (`Missiles.txt Accel`) per `0x6FC8FB37`.
   */
  readonly accel: number
  /**
   * Current scalar speed in `Vel` (`px/tick`) units (`vel256 / 256`).
   */
  speed: number
  /**
   * Whether `vy` uses 2:1 isometric ground foreshortening (`ISO_GROUND_ASPECT_RATIO = 0.5`).
   */
  readonly isoGroundForeshorten?: boolean | undefined
  /**
   * Optional `nLoops` passed at creation for `SubLoop` range extension (`0x6FC8FC90`).
   */
  loops?: number | undefined
  angleRad: number
  ageTicks: number
  readonly maxRangeTicks: number
  readonly nextHit: boolean
  readonly nextDelayFrames: number
  /** Missiles.txt `Pierce` flag: the row may consume its owner's pierce roll (`0x6FC8F6A3` / `0x6FC58F7B`). */
  readonly canPierce: boolean
  /**
   * Remaining pierces (`pierce_idx`, stat #328) rolled once at creation from the owner's `item_pierce + skill_pierce`
   * (`0x6FC8F660`, at most 4) and decremented on each unit hit (`0x6FC58F40`). See `missile-pierce.ts`.
   */
  pierceIdx: number
  /** Number of units this missile has passed through without being removed (bookkeeping only). */
  pierceCount: number
  readonly hitTargetIds: Set<string>
  dmgPacket: SUnitDmgPacket
  chainRemaining: number
  lastHitTargetId?: string | undefined
  expired: boolean
  subMissileIdx?: number
  currentHitFrame?: number
  fireCadenceTicks?: number | undefined
  spawnMissileType?: string | undefined
  altitude?: number | undefined
  seed?: number | undefined
  jitterIndex?: number | undefined
  originX?: number | undefined
  originY?: number | undefined
  spiralTheta?: number | undefined
  readonly volleyId?: string | undefined
  readonly canTriggerProcs?: boolean | undefined
  isSlowed?: boolean | undefined
  slowMultiplier?: number | undefined
  /**
   * Unit referenced by the missile's `targetX`/`targetY` (unit type / GUID) pair in 1.13c.
   * `SKILLS_SrvDo121_Rabies` stores the casting druid there for `rabiesplague` (whose
   * `pOwner` is the infected unit); `MISSMODE_SrvDo30_RabiesPlague` resolves it with
   * `SUNIT_GetServerUnit` and hands it to `rabiescontagion` as `pOwner`.
   */
  readonly linkedUnit?: CombatUnitContext | undefined
  /** Flat (2:1-corrected) path distance travelled since the last emitted path step (`D2Common_10234`). */
  pathStepAccumPx?: number | undefined
  pathLastX?: number | undefined
  pathLastY?: number | undefined
  /** Per-missile `pSeed` used by `SEED_InitLowSeed` / `ITEMS_RollLimitedRandomNumber` in SrvDo08/10/25/28/30. */
  doFuncRng?: D2Rng | undefined
  /** Locked target unit id for homing missiles (`MISSMODE_SrvDo07_GuidedArrow_BoneSpirit` `0x6FC61710`). */
  lockedTargetId?: string | undefined
  /** Stored target offset X (`MISSILE_GetTargetX` `0x6FC2B24C` / `MISSILE_SetTargetX` `0x6FC2A50E`) for `SrvHit29`/`SrvDo16`. */
  targetOffsetX?: number | undefined
  /** Stored target offset Y (`MISSILE_GetTargetY` `0x6FC2B288` / `MISSILE_SetTargetY` `0x6FC2AF5E`) for `SrvHit29`/`SrvDo16`. */
  targetOffsetY?: number | undefined
}

/** One sub-tile in the server missile engine's flat world pixels (subtile x = 20 px, y = 10 px on screen). */
export const MISSILE_SUBTILE_FLAT_PX = 20

/**
 * 1.13c `D2Game.dll` `0x6FD2D928` (`g_aMissileCollideTypes[9]`, 8 bytes/entry: `{ pfnUnitCallback, dwCollisionMask }`).
 * Indexed by `MissilesTxt.nCollideType` (`+0x185`, `0..8`) at `MISSILE_CreateMissileFromParams` (`0x6FC8FD52..0x6FC8FD77`)
 * and `MISSMODE_MoveMissile` (`0x6FC5F3FB..0x6FC5F426`).
 */
export interface MissileCollideTypeEntry113c {
  readonly collideType: number
  /** 1.13c unit collision callback VA (`0` = NULL, `0x6FC5AD70` = player/good, `0x6FC5ADD0` = monster, `0x6FC5AD30` = player+monster, `0x6FC59510` = missile). */
  readonly callbackVa: number
  /** 1.13c `D2Common.#10212` 32-bit collision mask (`0x6FD2D92C + collideType * 8`). */
  readonly collisionMask: number
  /** Terrain bitmask subset (`0x00`, `0x04` = `COLLIDE_MISSILE_BARRIER`, `0x05` = `COLLIDE_MISSILE_BARRIER | COLLIDE_WALL`). */
  readonly terrainMask: number
  /** Unit category bitmask subset (`0x0000`, `0x0080` = player/good, `0x0100` = monster, `0x0180` = player+monster). */
  readonly unitTypeMask: number
  /** Whether this `CollideType` tests player-category / good-aligned units (`0x80`). */
  readonly collidesWithPlayers: boolean
  /** Whether this `CollideType` tests monster-category units (`0x100`). */
  readonly collidesWithMonsters: boolean
  /** Whether this `CollideType` tests destructible missiles (`0x40` with `CanDestroy`). */
  readonly collidesWithMissiles: boolean
}

export const MISSILE_COLLIDE_TABLE_113C: readonly MissileCollideTypeEntry113c[] = [
  // 0: { 0x00000000, 0x0000 } — no unit or terrain collision
  { collideType: 0, callbackVa: 0x00000000, collisionMask: 0x0000, terrainMask: 0x00, unitTypeMask: 0x0000, collidesWithPlayers: false, collidesWithMonsters: false, collidesWithMissiles: false },
  // 1: { 0x6FC5AD70, 0x0084 } — COLLIDE_PLAYER (0x80) | COLLIDE_MISSILE_BARRIER (0x04) (+ good-aligned mercs/summons via 0x6FC5ACB0)
  { collideType: 1, callbackVa: 0x6FC5AD70, collisionMask: 0x0084, terrainMask: 0x04, unitTypeMask: 0x0080, collidesWithPlayers: true, collidesWithMonsters: false, collidesWithMissiles: false },
  // 2: { 0x6FC5ADD0, 0x0104 } — COLLIDE_MONSTER (0x100) | COLLIDE_MISSILE_BARRIER (0x04)
  { collideType: 2, callbackVa: 0x6FC5ADD0, collisionMask: 0x0104, terrainMask: 0x04, unitTypeMask: 0x0100, collidesWithPlayers: false, collidesWithMonsters: true, collidesWithMissiles: false },
  // 3: { 0x6FC5AD30, 0x0184 } — COLLIDE_MONSTER (0x100) | COLLIDE_PLAYER (0x80) | COLLIDE_MISSILE_BARRIER (0x04)
  { collideType: 3, callbackVa: 0x6FC5AD30, collisionMask: 0x0184, terrainMask: 0x04, unitTypeMask: 0x0180, collidesWithPlayers: true, collidesWithMonsters: true, collidesWithMissiles: false },
  // 4: { 0x00000000, 0x0000 } — unused
  { collideType: 4, callbackVa: 0x00000000, collisionMask: 0x0000, terrainMask: 0x00, unitTypeMask: 0x0000, collidesWithPlayers: false, collidesWithMonsters: false, collidesWithMissiles: false },
  // 5: { 0x6FC5ADD0, 0x0104 } — COLLIDE_MONSTER (0x100) | COLLIDE_MISSILE_BARRIER (0x04)
  { collideType: 5, callbackVa: 0x6FC5ADD0, collisionMask: 0x0104, terrainMask: 0x04, unitTypeMask: 0x0100, collidesWithPlayers: false, collidesWithMonsters: true, collidesWithMissiles: false },
  // 6: { 0x00000000, 0x0004 } — COLLIDE_MISSILE_BARRIER (0x04) terrain-only; pfnUnitCallback == NULL (never collides with units)
  { collideType: 6, callbackVa: 0x00000000, collisionMask: 0x0004, terrainMask: 0x04, unitTypeMask: 0x0000, collidesWithPlayers: false, collidesWithMonsters: false, collidesWithMissiles: false },
  // 7: { 0x6FC59510, 0x0040 } — COLLIDE_MISSILE (0x40) with CanDestroy
  { collideType: 7, callbackVa: 0x6FC59510, collisionMask: 0x0040, terrainMask: 0x00, unitTypeMask: 0x0000, collidesWithPlayers: false, collidesWithMonsters: false, collidesWithMissiles: true },
  // 8: { 0x6FC5AD30, 0x0185 } — COLLIDE_MONSTER (0x100) | COLLIDE_PLAYER (0x80) | COLLIDE_MISSILE_BARRIER (0x04) | COLLIDE_WALL (0x01)
  { collideType: 8, callbackVa: 0x6FC5AD30, collisionMask: 0x0185, terrainMask: 0x05, unitTypeMask: 0x0180, collidesWithPlayers: true, collidesWithMonsters: true, collidesWithMissiles: false },
] as const

export function getMissileCollideEntry113c(collideType: number): MissileCollideTypeEntry113c {
  const idx = Math.trunc(collideType)
  if (idx >= 0 && idx < MISSILE_COLLIDE_TABLE_113C.length) {
    return MISSILE_COLLIDE_TABLE_113C[idx]!
  }
  return MISSILE_COLLIDE_TABLE_113C[0]!
}

/**
 * 1.13c `D2Game.dll` `0x6FD2D970` (`gMissileSrvDoFuncTable[38]`, indexed by `MissilesTxt.pSrvDoFunc` `0..37`).
 * Dispatched at `MISSILES_ExecuteMissileFrame` (`0x6FC5F51E`).
 */
export interface MissileSrvDoTableEntry113c {
  readonly funcId: number
  readonly handlerVa: number
  readonly name: string
}

export const MISSILE_SRV_DO_TABLE_113C: readonly MissileSrvDoTableEntry113c[] = [
  { funcId: 0, handlerVa: 0x00000000, name: 'null' },
  { funcId: 1, handlerVa: 0x6fc5f540, name: 'MISSMODE_SrvDo01_StandardMove' },
  { funcId: 2, handlerVa: 0x6fc61b80, name: 'MISSMODE_SrvDo02_PoisonJavelin' },
  { funcId: 3, handlerVa: 0x6fc61ae0, name: 'MISSMODE_SrvDo03_PoisonCloudTrail' },
  { funcId: 4, handlerVa: 0x00000000, name: 'null' },
  { funcId: 5, handlerVa: 0x6fc61980, name: 'MISSMODE_SrvDo05_FireWallSegment' },
  { funcId: 6, handlerVa: 0x6fc61850, name: 'MISSMODE_SrvDo06_FireWallMaker_MoltenBoulder' },
  { funcId: 7, handlerVa: 0x6fc61710, name: 'MISSMODE_SrvDo07_GuidedArrow_BoneSpirit' },
  { funcId: 8, handlerVa: 0x6fc61670, name: 'MISSMODE_SrvDo08_MonBlizzCenter' },
  { funcId: 9, handlerVa: 0x6fc61520, name: 'MISSMODE_SrvDo09_BatLightning' },
  { funcId: 10, handlerVa: 0x6fc613d0, name: 'MISSMODE_SrvDo10_BlizzardCenter' },
  { funcId: 11, handlerVa: 0x6fc61240, name: 'MISSMODE_SrvDo11_FingerMageSpider' },
  { funcId: 12, handlerVa: 0x6fc61110, name: 'MISSMODE_SrvDo12_DiabloWallMaker' },
  { funcId: 13, handlerVa: 0x6fc60eb0, name: 'MISSMODE_SrvDo13_BoneWallMaker' },
  { funcId: 14, handlerVa: 0x6fc60e10, name: 'MISSMODE_SrvDo14_GrimWardDelay' },
  { funcId: 15, handlerVa: 0x6fc60ca0, name: 'MISSMODE_SrvDo15_FrozenOrb' },
  { funcId: 16, handlerVa: 0x6fc60bd0, name: 'MISSMODE_SrvDo16_FrozenOrbNova' },
  { funcId: 17, handlerVa: 0x6fc60b20, name: 'MISSMODE_SrvDo17_CairnStones' },
  { funcId: 18, handlerVa: 0x6fc608d0, name: 'MISSMODE_SrvDo18_TowerChestSpawner' },
  { funcId: 19, handlerVa: 0x6fc5f6d0, name: 'MISSMODE_SrvDo19_RadamentDeath' },
  { funcId: 20, handlerVa: 0x6fc60860, name: 'MISSMODE_SrvDo20_BladeCreeper' },
  { funcId: 21, handlerVa: 0x6fc61eb0, name: 'MISSMODE_SrvDo21_distraction' },
  { funcId: 22, handlerVa: 0x6fc606d0, name: 'MISSMODE_SrvDo22_LightningTrailingJavelin' },
  { funcId: 23, handlerVa: 0x6fc605e0, name: 'MISSMODE_SrvDo23_SuccubusFireball' },
  { funcId: 24, handlerVa: 0x6fc605e0, name: 'MISSMODE_SrvDo24_FirestormMaker' },
  { funcId: 25, handlerVa: 0x6fc604d0, name: 'MISSMODE_SrvDo25_EruptionCenter' },
  { funcId: 26, handlerVa: 0x6fc60420, name: 'MISSMODE_SrvDo26_Vines' },
  { funcId: 27, handlerVa: 0x6fc60280, name: 'MISSMODE_SrvDo27_Tornado' },
  { funcId: 28, handlerVa: 0x6fc60070, name: 'MISSMODE_SrvDo28_Volcano' },
  { funcId: 29, handlerVa: 0x6fc5fed0, name: 'MISSMODE_SrvDo29_RecyclerDelay' },
  { funcId: 30, handlerVa: 0x6fc5fb40, name: 'MISSMODE_SrvDo30_RabiesPlague' },
  { funcId: 31, handlerVa: 0x6fc5f9f0, name: 'MISSMODE_SrvDo31_WakeOfDestructionMaker' },
  { funcId: 32, handlerVa: 0x6fc61de0, name: 'MISSMODE_SrvDo32_TigerFury' },
  { funcId: 33, handlerVa: 0x6fc5fd30, name: 'MISSMODE_SrvDo33_VineRecyclerDelay' },
  { funcId: 34, handlerVa: 0x6fc61c30, name: 'MISSMODE_SrvDo34_BaalTauntControl' },
  { funcId: 35, handlerVa: 0x6fc5f890, name: 'MISSMODE_SrvDo35_RoyalStrikeChaosIce' },
  { funcId: 36, handlerVa: 0x6fc5f670, name: 'MISSMODE_SrvDo36_BaalFxControl' },
  { funcId: 37, handlerVa: 0x6fc5f550, name: 'MISSMODE_SrvDo37_Diablogeddon' },
] as const

/**
 * 1.13c `D2Game.dll` `0x6FD2DA48` (`gpMissileSrvHitFnTable[65]`, indexed by `MissilesTxt.pSrvHitFunc` `0..64`).
 * Dispatched at `MISSILES_SrvHitDispatch` (`0x6FC5EDE0`).
 */
export interface MissileSrvHitTableEntry113c {
  readonly funcId: number
  readonly handlerVa: number
  readonly name: string
}

export const MISSILE_SRV_HIT_TABLE_113C: readonly MissileSrvHitTableEntry113c[] = [
  { funcId: 0, handlerVa: 0x00000000, name: 'null' },
  { funcId: 1, handlerVa: 0x6fc5b990, name: 'MISSMODE_SrvHit01_FireBallRadialSplash' },
  { funcId: 2, handlerVa: 0x6fc5e330, name: 'MISSMODE_SrvHit02_PlagueJavelinPoisonCloud' },
  { funcId: 3, handlerVa: 0x6fc5bb60, name: 'MISSMODE_SrvHit03_PotionFireSplash' },
  { funcId: 4, handlerVa: 0x6fc5f220, name: 'MISSMODE_SrvHit04_SubMissileExplosionTrigger' },
  { funcId: 5, handlerVa: 0x6fc5c700, name: 'MISSMODE_SrvHit05_MonsterRancidGasPotion' },
  { funcId: 6, handlerVa: 0x6fc5bd10, name: 'MISSMODE_SrvHit06_GrimWardCreate' },
  { funcId: 7, handlerVa: 0x6fc59fd0, name: 'MISSMODE_SrvHit07_HolyBolt' },
  { funcId: 8, handlerVa: 0x6fc59f70, name: 'MISSMODE_SrvHit08_BlazeFirestormPersist' },
  { funcId: 9, handlerVa: 0x6fc5e0b0, name: 'MISSMODE_SrvHit09_ImmolationArrow' },
  { funcId: 10, handlerVa: 0x6fc5b140, name: 'MISSMODE_SrvHit10_GuidedArrow_BoneSpirit' },
  { funcId: 11, handlerVa: 0x6fc5f120, name: 'MISSMODE_SrvHit11_CreateMonFromMissile' },
  { funcId: 12, handlerVa: 0x6fc5d020, name: 'MISSMODE_SrvHit12_ChainLightning' },
  { funcId: 13, handlerVa: 0x6fc5b3e0, name: 'MISSMODE_SrvHit13_GlacialSpike' },
  { funcId: 14, handlerVa: 0x6fc5def0, name: 'MISSMODE_SrvHit14_MeteorCenter' },
  { funcId: 15, handlerVa: 0x6fc5cdd0, name: 'MISSMODE_SrvHit15_SpiderGooLay' },
  { funcId: 16, handlerVa: 0x6fc5ec10, name: 'MISSMODE_SrvHit16_SpiderGooSlow' },
  { funcId: 17, handlerVa: 0x6fc5eae0, name: 'MISSMODE_SrvHit17_HowlFlee' },
  { funcId: 18, handlerVa: 0x6fc5ea60, name: 'MISSMODE_SrvHit18_Shout_BO_BC_AllyBuff' },
  { funcId: 19, handlerVa: 0x6fc5e8a0, name: 'MISSMODE_SrvHit19_FingerMageSpiderManaDrain' },
  { funcId: 20, handlerVa: 0x6fc5dd60, name: 'MISSMODE_SrvHit20_LightningFury' },
  { funcId: 21, handlerVa: 0x6fc5abd0, name: 'MISSMODE_SrvHit21_BattleCryDebuff' },
  { funcId: 22, handlerVa: 0x6fc5db30, name: 'MISSMODE_SrvHit22_FistOfTheHeavensDelay' },
  { funcId: 23, handlerVa: 0x6fc59da0, name: 'MISSMODE_SrvHit23_MissileSkillCast' },
  { funcId: 24, handlerVa: 0x6fc5b7c0, name: 'MISSMODE_SrvHit24_PantherPotOrange' },
  { funcId: 25, handlerVa: 0x6fc5da60, name: 'MISSMODE_SrvHit25_PantherPotGreen' },
  { funcId: 26, handlerVa: 0x6fc5c990, name: 'MISSMODE_SrvHit26_GrimWardStart' },
  { funcId: 27, handlerVa: 0x6fc58ec0, name: 'MISSMODE_SrvHit27_GrimWardExpire' },
  { funcId: 28, handlerVa: 0x6fc5e740, name: 'MISSMODE_SrvHit28_GrimWardScare' },
  { funcId: 29, handlerVa: 0x6fc5c850, name: 'MISSMODE_SrvHit29_FrozenOrbBurst' },
  { funcId: 30, handlerVa: 0x00000000, name: 'null' },
  { funcId: 31, handlerVa: 0x6fc5a920, name: 'MISSMODE_SrvHit31_Firehead' },
  { funcId: 32, handlerVa: 0x6fc5be70, name: 'MISSMODE_SrvHit32_CairnStones' },
  { funcId: 33, handlerVa: 0x6fc58ea0, name: 'MISSMODE_SrvHit33_TowerChestSpawner' },
  { funcId: 34, handlerVa: 0x00000000, name: 'null' },
  { funcId: 35, handlerVa: 0x6fc5e670, name: 'MISSMODE_SrvHit35_OrbMist' },
  { funcId: 36, handlerVa: 0x6fc5ab30, name: 'MISSMODE_SrvHit36_BombInAirGroundSpawn' },
  { funcId: 37, handlerVa: 0x6fc58e90, name: 'MISSMODE_SrvHit37_BladeCreeperPierce' },
  { funcId: 38, handlerVa: 0x6fc5c5b0, name: 'MISSMODE_SrvHit38_CatapultChargedBall' },
  { funcId: 39, handlerVa: 0x6fc5bc00, name: 'MISSMODE_SrvHit39_ImpSpawnMonsters' },
  { funcId: 40, handlerVa: 0x6fc5c490, name: 'MISSMODE_SrvHit40_CatapultSpikeBall' },
  { funcId: 41, handlerVa: 0x00000000, name: 'null' },
  { funcId: 42, handlerVa: 0x00000000, name: 'null' },
  { funcId: 43, handlerVa: 0x6fc59e30, name: 'MISSMODE_SrvHit43_HealingVortex' },
  { funcId: 44, handlerVa: 0x6fc5b5f0, name: 'MISSMODE_SrvHit44_JavelinArmageddonSplash' },
  { funcId: 45, handlerVa: 0x6fc5c3b0, name: 'MISSMODE_SrvHit45_LightningTrailingJavelin' },
  { funcId: 46, handlerVa: 0x00000000, name: 'null' },
  { funcId: 47, handlerVa: 0x6fc5d8c0, name: 'MISSMODE_SrvHit47_MoltenBoulderKnockbackExplode' },
  { funcId: 48, handlerVa: 0x6fc5c260, name: 'MISSMODE_SrvHit48_MoltenBoulderEmerge' },
  { funcId: 49, handlerVa: 0x00000000, name: 'null' },
  { funcId: 50, handlerVa: 0x6fc591a0, name: 'MISSMODE_SrvHit50_PlagueVinesTrail' },
  { funcId: 51, handlerVa: 0x6fc5c160, name: 'MISSMODE_SrvHit51_VolcanoDebris2' },
  { funcId: 52, handlerVa: 0x6fc5c030, name: 'MISSMODE_SrvHit52_BladeFury' },
  { funcId: 53, handlerVa: 0x6fc5f7d0, name: 'MISSMODE_SrvHit53_RabiesContagion' },
  { funcId: 54, handlerVa: 0x6fc5bc80, name: 'MISSMODE_SrvHit54_BaalSpawnMonsters' },
  { funcId: 55, handlerVa: 0x6fc596e0, name: 'MISSMODE_SrvHit55_BaalInfernoManaDrain' },
  { funcId: 56, handlerVa: 0x6fc5b210, name: 'MISSMODE_SrvHit56_ArmageddonControl' },
  { funcId: 57, handlerVa: 0x6fc5bbb0, name: 'MISSMODE_SrvHit57_BaalFxControl' },
  { funcId: 58, handlerVa: 0x6fc5bed0, name: 'MISSMODE_SrvHit58_BaalTauntLightningControl' },
  { funcId: 59, handlerVa: 0x6fc5d800, name: 'MISSMODE_SrvHit59_BaalTauntPoisonControl' },
  { funcId: 60, handlerVa: 0x00000000, name: 'null' },
  { funcId: 61, handlerVa: 0x00000000, name: 'null' },
  { funcId: 62, handlerVa: 0x00000000, name: 'null' },
  { funcId: 63, handlerVa: 0x00000000, name: 'null' },
  { funcId: 64, handlerVa: 0x00000000, name: 'null' },
] as const

/**
 * 1.13c `D2Game.dll` `0x6FD2DB68` (`gpMissileSrvDmgFnTable[16]`, indexed by `MissilesTxt.pSrvDmgFunc` `0..15`).
 * Dispatched inside `MISSILES_SrvHitDispatch` (`0x6FC5EDE0`).
 */
export interface MissileSrvDmgTableEntry113c {
  readonly funcId: number
  readonly handlerVa: number
  readonly name: string
}

export const MISSILE_SRV_DMG_TABLE_113C: readonly MissileSrvDmgTableEntry113c[] = [
  { funcId: 0, handlerVa: 0x00000000, name: 'null' },
  { funcId: 1, handlerVa: 0x6fc59ce0, name: 'MISSMODE_SrvDmg01_ArrowPhysToElemConvert' },
  { funcId: 2, handlerVa: 0x6fc59080, name: 'MISSMODE_SrvDmg02_ColdToFreezeScale' },
  { funcId: 3, handlerVa: 0x6fc59670, name: 'MISSMODE_SrvDmg03_GroundFireDamage' },
  { funcId: 4, handlerVa: 0x6fc58e70, name: 'MISSMODE_SrvDmg04_IceBlastColdToFreeze' },
  { funcId: 5, handlerVa: 0x6fc5a790, name: 'MISSMODE_SrvDmg05_BlessedHammerUndeadDemon' },
  { funcId: 6, handlerVa: 0x6fc59c80, name: 'MISSMODE_SrvDmg06_GrimWardFear' },
  { funcId: 7, handlerVa: 0x6fc59600, name: 'MISSMODE_SrvDmg07_Warcry_ShockWaveStun' },
  { funcId: 8, handlerVa: 0x6fc58ff0, name: 'MISSMODE_SrvDmg08_EruptionCrackOverlay' },
  { funcId: 9, handlerVa: 0x6fc59560, name: 'MISSMODE_SrvDmg09_TwisterStun' },
  { funcId: 10, handlerVa: 0x6fc59040, name: 'MISSMODE_SrvDmg10_BladesOfIceFreeze' },
  { funcId: 11, handlerVa: 0x6fc59bd0, name: 'MISSMODE_SrvDmg11_RabiesContagion' },
  { funcId: 12, handlerVa: 0x6fc5a850, name: 'MISSMODE_SrvDmg12_LightningJavelinConvert' },
  { funcId: 13, handlerVa: 0x6fc5aaa0, name: 'MISSMODE_SrvDmg13_BlessedHammerExConcentration' },
  { funcId: 14, handlerVa: 0x6fc59a40, name: 'MISSMODE_SrvDmg14_MoltenBoulderKnockback' },
  { funcId: 15, handlerVa: 0x00000000, name: 'null' },
] as const

function getUnitMonHcIdx(unit: unknown): number | undefined {
  if (!unit || typeof unit !== 'object') return undefined
  const u = unit as { monHcIdx?: number; hcIdx?: number }
  if (typeof u.monHcIdx === 'number' && u.monHcIdx >= 0) return u.monHcIdx
  if (typeof u.hcIdx === 'number' && u.hcIdx >= 0) return u.hcIdx
  return undefined
}

/**
 * Resolve a unit's 1.13c alignment side (`'good'` = player / party / mercenary / player minion,
 * `'evil'` = hostile monster).
 */
export function resolveUnitAlignmentSide113c(
  unit: CombatUnitContext | undefined,
  referenceOwner?: CombatUnitContext | undefined,
): 'good' | 'evil' {
  if (!unit) return 'good'
  if (unit.ownerRef && unit.ownerRef !== unit) {
    return resolveUnitAlignmentSide113c(unit.ownerRef, referenceOwner)
  }
  if (
    unit.unitType === 'player' ||
    unit.unitType === 'mercenary' ||
    unit.unitType === 'party' ||
    unit.unitType === 'party_mercenary' ||
    unit.unitType === 'minion'
  ) {
    return 'good'
  }
  if (unit.unitType === 'monster') {
    if (
      referenceOwner &&
      unit.ownerUnitId !== undefined &&
      (unit.ownerUnitId === referenceOwner.id || unit.ownerUnitId === referenceOwner.ownerUnitId)
    ) {
      return resolveUnitAlignmentSide113c(referenceOwner)
    }
    return 'evil'
  }
  // When `unitType` is omitted in unit tests:
  // - If `unit` is the missile owner (no `referenceOwner` or `unit === referenceOwner`), it is player-side unless `monHcIdx` is set.
  if (!referenceOwner || unit.id === referenceOwner.id) {
    return getUnitMonHcIdx(unit) !== undefined ? 'evil' : 'good'
  }
  if (
    unit.ownerUnitId !== undefined &&
    (unit.ownerUnitId === referenceOwner.id || unit.ownerUnitId === referenceOwner.ownerUnitId)
  ) {
    return resolveUnitAlignmentSide113c(referenceOwner)
  }
  const ownerSide = resolveUnitAlignmentSide113c(referenceOwner)
  if (ownerSide === 'good') {
    return 'evil'
  }
  if (getUnitMonHcIdx(unit) !== undefined) {
    return 'evil'
  }
  return 'good'
}

/**
 * 1.13c `D2Game.dll` `0x6FC58FB0` (`MISSMODE_IsTargetEnemy`) + `0x6FD00A60` (`SUNIT_IsEnemy`):
 * Returns `true` when `owner` and `target` are hostile enemies, `false` when friendly/allied or same unit.
 */
export function areUnitsEnemies113c(
  owner: CombatUnitContext | undefined,
  target: CombatUnitContext | undefined,
): boolean {
  if (!owner || !target) return false
  if (owner.id === target.id) return false
  const rootOwnerId = owner.ownerRef?.id ?? owner.ownerUnitId ?? owner.id
  const rootTargetId = target.ownerRef?.id ?? target.ownerUnitId ?? target.id
  if (rootOwnerId === rootTargetId) return false
  const ownerSide = resolveUnitAlignmentSide113c(owner)
  const targetSide = resolveUnitAlignmentSide113c(target, owner)
  return ownerSide !== targetSide
}

/**
 * 1.13c unit collision gate (`0x6FC5F3FB..0x6FC5F426` -> `0x6FC5AD30/0x6FC5AD70/0x6FC5ADD0` -> `0x6FC5AA20` -> `0x6FC58FB0` / `0x6FC5EDE0`):
 * 1. `CollideType` `0, 4, 6` (`callbackVa == 0`) and `7` (`0x40` missile-only) never collide with player/monster units.
 * 2. `LastCollide` (`+0x04` bit `0x01`, initialized to `pOwner` at `0x6FC8FDA3`): a missile never collides with its own caster.
 * 3. `CollideType = 1` (`0x0084`, `0x6FC5AD70` / `0x6FC5ACB0`) only collides with player-aligned (`'good'`) units.
 * 4. `CollideType = 2` or `5` (`0x0104`, `0x6FC5ADD0` / `0x6FC5AC00`) only collides with monster (`dwUnitType == 1`) units.
 * 5. `0x6FC58FB0` (`SUNIT_IsEnemy`): if target is not an enemy of `missile.owner`, only collides when `MissilesTxt.CollideFriend == 1`.
 */
export function canMissileCollideWithUnit113c(
  missileOrRecord:
    | {
        readonly record: Pick<MissileRecord, 'collideType' | 'collideFriend' | 'lastCollide' | 'size'>
        readonly owner?: CombatUnitContext | undefined
      }
    | Pick<MissileRecord, 'collideType' | 'collideFriend' | 'lastCollide' | 'size'>,
  targetOrOwner: CombatUnitContext,
  maybeTarget?: CombatUnitContext | undefined,
): boolean {
  const isWrapper = 'record' in missileOrRecord
  const record = isWrapper ? missileOrRecord.record : missileOrRecord
  const owner = isWrapper ? missileOrRecord.owner : targetOrOwner
  const target = isWrapper ? targetOrOwner : maybeTarget!
  const entry = getMissileCollideEntry113c(record.collideType)
  if (entry.callbackVa === 0 || (!entry.collidesWithPlayers && !entry.collidesWithMonsters)) {
    return false
  }
  if (owner && target.id === owner.id) {
    return false
  }
  const targetSide = resolveUnitAlignmentSide113c(target, owner)
  const isPlayerUnit = target.unitType === 'player' || target.unitType === 'party'
  if (entry.collideType === 1) {
    // 0x6FC5AD70 -> 0x6FC5ACB0: only players (dwUnitType == 0) or good-aligned monsters (mercenaries/summons)
    if (targetSide !== 'good') return false
  } else if (entry.collideType === 2 || entry.collideType === 5) {
    // 0x6FC5ADD0 -> 0x6FC5AC00: only dwUnitType == 1 (monsters), never players
    if (isPlayerUnit) return false
  }
  const isEnemy = areUnitsEnemies113c(owner, target)
  if (!isEnemy && !record.collideFriend) {
    return false
  }
  return true
}

/**
 * Resolve a unit's 1.13c subtile footprint size (`1..3`, `D2Common.#10336`):
 * - Players (`dwUnitType == 0`): `SizeX = 2`.
 * - Monsters (`dwUnitType == 1`): `MonStats2.SizeX` (`1..3`), defaulting to `2`.
 */
export function resolveUnitSubtileSize113c(
  unit:
    | CombatUnitContext
    | {
        readonly unitType?: string | undefined
        readonly monHcIdx?: number | undefined
        readonly hcIdx?: number | undefined
        readonly sizeX?: number | undefined
      },
): number {
  const explicitSize = (unit as { readonly sizeX?: number | undefined }).sizeX
  if (explicitSize !== undefined && explicitSize >= 1 && explicitSize <= 3) {
    return Math.trunc(explicitSize)
  }
  if (unit.unitType === 'player' || unit.unitType === 'party') {
    return 2
  }
  const monHcIdx = getUnitMonHcIdx(unit)
  if (monHcIdx !== undefined && monHcIdx >= 0) {
    const rec = getMonsterPathRecord(monHcIdx)
    if (rec && rec.sizeX >= 1 && rec.sizeX <= 3) {
      return rec.sizeX
    }
  }
  return 2
}

export { checkMissileSizeFootprintOverlap113c } from '../../common/skills/missile-size-footprint-113c.ts'

/** `stepMissileSubtileRay113c` of missile-size-footprint-113c.ts with the server's pixel sub-tile size. */
export function stepMissileSubtileRay113c(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  subtilePx: number = MISSILE_SUBTILE_FLAT_PX,
): { readonly x: number; readonly y: number }[] {
  return stepMissileSubtileRayCommon113c(x0, y0, x1, y1, subtilePx)
}

/** `checkMissileSegmentFootprintOverlap113c` of missile-size-footprint-113c.ts with the server's pixel sub-tile size. */
export function checkMissileSegmentFootprintOverlap113c(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tx: number,
  ty: number,
  missileSize: number,
  targetSize: number = 2,
  subtilePx: number = MISSILE_SUBTILE_FLAT_PX,
  yAspect: number = 1,
): boolean {
  return checkMissileSegmentFootprintOverlapCommon113c(x0, y0, x1, y1, tx, ty, missileSize, targetSize, subtilePx, yAspect)
}

export interface MissileTerrainCollision {
  readonly overlap?: ((x: number, y: number) => number) | undefined
  readonly isMissileBlocked?:
    | ((x: number, y: number, fromX?: number, fromY?: number, mask?: number) => boolean)
    | undefined
}

export interface MissileStepResult {
  readonly hits: {
    readonly missileName: string
    readonly targetId: string
    readonly damage: number
    readonly immune: boolean
  }[]
  readonly subMissilesSpawned: string[]
}

/**
 * A sub-missile named by a Missiles.txt column of `row` (ExplosionMissile / CltHitSubMissile*). The column must be
 * filled: a missing value is a data error, never replaced by another row's name (Issue #1090).
 */
function requireRowMissile(value: string | undefined, row: string, column: string): string {
  const v = (value ?? '').trim()
  if (v === '') throw new Error(`Missiles.txt '${row}' has no ${column}`)
  return v
}

export class MissileEngine {
  readonly registry: D2DataRegistry
  private readonly missiles: ActiveMissile[] = []
  private readonly nextDelayExpireByTarget = new Map<string, number>()
  private readonly volleyHits = new Set<string>()
  private srvMissileSkillMap?: Map<string, SkillRecord>
  private uidCounter = 1
  private readonly rng = new D2Rng(0x4d534c45)
  terrain?: MissileTerrainCollision | undefined

  constructor(registry: D2DataRegistry, terrain?: MissileTerrainCollision) {
    this.registry = registry
    this.terrain = terrain
  }

  setTerrain(terrain?: MissileTerrainCollision): void {
    this.terrain = terrain
  }

  spawnMissile(params: {
    missileNameOrId: string | number
    sourceSkillId: number
    slvl: number
    owner: CombatUnitContext
    startX: number
    startY: number
    targetX: number
    targetY: number
    dmgPacket?: SUnitDmgPacket | undefined
    chainCount?: number
    chainRemaining?: number
    lastHitTargetId?: string
    fireCadenceTicks?: number
    spawnMissileType?: string
    maxRangeTicks?: number
    nextHit?: boolean
    nextDelayFrames?: number
    altitude?: number
    seed?: number
    jitterIndex?: number
    vx?: number
    vy?: number
    angleRad?: number
    velocityOverride?: number
    velocityIs256?: boolean
    loops?: number
    isoGroundForeshorten?: boolean
    volleyId?: string
    canTriggerProcs?: boolean
    isSlowed?: boolean
    slowMultiplier?: number
    linkedUnit?: CombatUnitContext
    lockedTargetId?: string
  }): ActiveMissile | null {
    const rec =
      typeof params.missileNameOrId === 'number'
        ? this.registry.getMissileById(params.missileNameOrId)
        : this.registry.getMissileByName(params.missileNameOrId)

    if (!rec) {
      throw new Error(`Missiles.txt row '${String(params.missileNameOrId)}' not found`)
    }
    const effectiveRec: MissileRecord = rec

    const dx = params.targetX - params.startX
    const dy = params.targetY - params.startY
    const calculatedAngleRad = dx === 0 && dy === 0 ? Math.PI / 2 : Math.atan2(dy, dx)
    const angleRad = params.angleRad ?? calculatedAngleRad
    const isStationary = effectiveRec.vel === 0 || effectiveRec.pCltDoFunc === 13
    const slvlInt = Math.max(0, Math.trunc(params.slvl))
    let vel256: number
    if (isStationary) {
      vel256 = 0
    } else if (params.velocityOverride !== undefined) {
      // 1.13c D2Game.dll 0x6FC8FA05..0x6FC8FA13: flags 0x04 / 0x10 velocity override
      const rawOverride = Math.trunc(params.velocityOverride)
      vel256 = params.velocityIs256 ? rawOverride : rawOverride << 8
    } else {
      // 1.13c D2Game.dll 0x6FC8FA15..0x6FC8FA36: rawVel = Vel + trunc((VelLev * slvl) / 8), vel256 = rawVel << 8
      const rawVel = effectiveRec.vel + Math.trunc((effectiveRec.velLev * slvlInt) / 8)
      vel256 = rawVel << 8
    }

    // 1.13c D2Game.dll 0x6FC8FA54..0x6FC8FA9F:
    // One-time creation Slow Missiles check when Missiles.txt CanSlow is set and owner has STATE_SLOWMISSILES (87).
    // Reads STAT_SKILL_HANDOFATHENA (161) from the slowmissiles state's stat list and scales vel256 = trunc((vel256 * handOfAthena) / 100).
    const canSlowRecord = effectiveRec.canSlow
    let slowedAtCreation = Boolean(params.isSlowed)
    if (!isStationary && canSlowRecord) {
      const slowState =
        params.owner?.stateBus?.getState?.('slowmissiles') ??
        params.owner?.stateBus?.getState?.(87 as any)
      const hasSlowState =
        slowState !== undefined ||
        (params.owner?.stateBus?.hasState?.('slowmissiles') ?? false) ||
        (params.owner?.stateBus?.hasState?.(87 as any) ?? false)
      const stateHandOfAthena = slowState?.stats?.['skill_handofathena'] ?? slowState?.stats?.['161']
      const statListHandOfAthena = params.owner?.statList?.getAccruedStat?.('skill_handofathena') ?? 0
      if (hasSlowState) {
        const handOfAthena =
          stateHandOfAthena !== undefined
            ? stateHandOfAthena
            : statListHandOfAthena
        vel256 = Math.trunc((vel256 * handOfAthena) / 100)
        slowedAtCreation = true
      } else if (params.slowMultiplier !== undefined) {
        vel256 = Math.trunc(vel256 * params.slowMultiplier)
        slowedAtCreation = true
      } else if (params.isSlowed || statListHandOfAthena > 0) {
        vel256 = Math.trunc((vel256 * statListHandOfAthena) / 100)
        slowedAtCreation = true
      }
    }

    // 1.13c D2Game.dll 0x6FC8FAA3..0x6FC8FAB8: global 75% velocity multiplier for all non-zero-velocity missiles
    if (vel256 !== 0) {
      vel256 = Math.trunc((vel256 * 75) / 100)
    }

    // 1.13c D2Game.dll 0x6FC8FB13..0x6FC8FB5A:
    // PATH_SetVelocity sets nVelocity = vel256 and nMaxVelocity = vel256;
    // when Missiles.txt Accel != 0, PATH_SetAcceleration(Accel) and PATH_SetMaxVelocity(MaxVel << 8) are applied.
    const accel = isStationary ? 0 : effectiveRec.accel
    const maxVel256 = isStationary ? 0 : accel !== 0 ? effectiveRec.maxVel << 8 : vel256
    const foreshortenY = params.isoGroundForeshorten ? ISO_GROUND_ASPECT_RATIO : 1
    const speedPxPerTick = isStationary ? 0 : vel256 / 256
    const vx = params.vx !== undefined ? params.vx : (isStationary ? 0 : Math.cos(angleRad) * speedPxPerTick)
    const vy =
      params.vy !== undefined
        ? params.vy
        : isStationary
          ? 0
          : Math.sin(angleRad) * speedPxPerTick * foreshortenY
    if (!isStationary && params.velocityOverride === undefined && (params.vx !== undefined || params.vy !== undefined)) {
      const explicitSpeed = Math.hypot(vx, vy / foreshortenY)
      vel256 = Math.round(explicitSpeed * 256)
    }
    const initialSpeed = isStationary ? 0 : vel256 / 256

    // 1.13c D2Game.dll 0x6FC8FC75..0x6FC8FCC8:
    // range = Range + slvl * LevRange (+ (SubStop - SubStart) * nLoops when SubLoop != 0 and nLoops > 0)
    const baseRange = effectiveRec.range ?? 0
    let calculatedRange = baseRange + slvlInt * (effectiveRec.levRange || 0)
    const loopsInt = params.loops !== undefined ? Math.trunc(params.loops) : 0
    if (effectiveRec.subLoop && loopsInt > 0) {
      calculatedRange += (effectiveRec.subStop - effectiveRec.subStart) * loopsInt
    }
    const maxRangeTicks = params.maxRangeTicks ?? calculatedRange

    const missile: ActiveMissile = {
      uid: `msl-${String(this.uidCounter++)}`,
      missileId: effectiveRec.id,
      name: effectiveRec.name,
      celFile: effectiveRec.celFile || effectiveRec.name,
      sourceSkillId: params.sourceSkillId,
      slvl: params.slvl,
      owner: params.owner,
      record: effectiveRec,
      x: params.startX,
      y: params.startY,
      vx,
      vy,
      vel256,
      maxVel256,
      accel,
      speed: initialSpeed,
      ...(params.isoGroundForeshorten !== undefined ? { isoGroundForeshorten: params.isoGroundForeshorten } : {}),
      ...(params.loops !== undefined ? { loops: loopsInt } : {}),
      angleRad,
      ageTicks: 0,
      maxRangeTicks,
      nextHit:
        params.nextHit ??
        (params.nextDelayFrames !== undefined ? params.nextDelayFrames > 0 : effectiveRec.nextHit),
      nextDelayFrames: params.nextDelayFrames ?? effectiveRec.nextDelay,
      // 1.13c `0x6FC8F660`: only the Missiles.txt `Pierce` flag enables the roll; the count is rolled once here from
      // the owner's `item_pierce + skill_pierce` (Issue #1420). `CollideKill = 0` is a separate, unrelated property.
      canPierce: effectiveRec.pierce,
      pierceIdx: resolveMissilePierceIdx(effectiveRec, params.owner, this.registry),
      pierceCount: 0,
      hitTargetIds: new Set<string>(),
      dmgPacket: (() => {
        const linkedSkill =
          effectiveRec.skill !== ''
            ? this.registry.getSkillByName(effectiveRec.skill)
            : undefined
        const resolvedMissileSrcDam =
          effectiveRec.srcDamage > 0
            ? effectiveRec.srcDamage
            : effectiveRec.srcDamage === 0 &&
                linkedSkill !== undefined &&
                linkedSkill.srcDam > 0 &&
                (effectiveRec.toHit ||
                  effectiveRec.id === 86 ||
                  effectiveRec.id === 205 ||
                  effectiveRec.id === 206)
              ? linkedSkill.srcDam
              : 0
        const baseDmgPkt: SUnitDmgPacket =
          params.dmgPacket ??
          (resolvedMissileSrcDam > 0
            ? {
                skillId: params.sourceSkillId,
                attackKind: 'missile',
                srcDam: resolvedMissileSrcDam,
                elemType: 'none',
                autoHit: Number(params.sourceSkillId) === 22 || !effectiveRec.toHit,
                elemMin256: 0,
                elemMax256: 0,
              }
            : {
                skillId: params.sourceSkillId,
                attackKind: 'spell',
                elemType: 'none',
                autoHit: false,
                elemMin256: 0,
                elemMax256: 0,
              })
        const withSrcDam: SUnitDmgPacket =
          resolvedMissileSrcDam > 0 &&
          baseDmgPkt.srcDam === undefined &&
          baseDmgPkt.attackKind !== 'spell'
            ? { ...baseDmgPkt, srcDam: resolvedMissileSrcDam }
            : baseDmgPkt
        const withSkipMastery: SUnitDmgPacket =
          withSrcDam.skipElemMastery === undefined &&
          effectiveRec.skill === '' &&
          !effectiveRec.applyMastery &&
          (effectiveRec.eMin > 0 || effectiveRec.eMax > 0)
            ? { ...withSrcDam, skipElemMastery: true }
            : withSrcDam
        return params.canTriggerProcs !== undefined && withSkipMastery.canTriggerProcs === undefined
          ? { ...withSkipMastery, canTriggerProcs: params.canTriggerProcs }
          : withSkipMastery
      })(),
      chainRemaining:
        params.chainRemaining ??
        params.chainCount ??
        this.resolveInitialChainCount(effectiveRec, params.sourceSkillId, slvlInt, params.owner),
      lastHitTargetId: params.lastHitTargetId,
      expired: false,
      ...(params.volleyId !== undefined ? { volleyId: params.volleyId } : {}),
      ...(params.canTriggerProcs !== undefined ? { canTriggerProcs: params.canTriggerProcs } : {}),
      ...(params.altitude !== undefined ? { altitude: params.altitude } : {}),
      ...(params.fireCadenceTicks !== undefined ? { fireCadenceTicks: params.fireCadenceTicks } : {}),
      ...(params.spawnMissileType !== undefined ? { spawnMissileType: params.spawnMissileType } : {}),
      ...(params.seed !== undefined ? { seed: params.seed } : {}),
      ...(params.jitterIndex !== undefined
        ? { jitterIndex: params.jitterIndex }
        : params.seed !== undefined
          ? { jitterIndex: Math.abs(params.seed) % 32 }
          : {}),
      originX: params.startX,
      originY: params.startY,
      spiralTheta: angleRad,
      targetOffsetX:
        Math.abs(dx) >= 8 || Math.abs(dy / foreshortenY) >= 8
          ? Math.round(dx)
          : Math.round(Math.cos(angleRad) * 30),
      targetOffsetY:
        Math.abs(dx) >= 8 || Math.abs(dy / foreshortenY) >= 8
          ? Math.round(dy / foreshortenY)
          : Math.round(Math.sin(angleRad) * 30),
      ...(slowedAtCreation ? { isSlowed: true } : {}),
      ...(params.slowMultiplier !== undefined ? { slowMultiplier: params.slowMultiplier } : {}),
      ...(params.linkedUnit !== undefined ? { linkedUnit: params.linkedUnit } : {}),
      ...(params.lockedTargetId !== undefined ? { lockedTargetId: params.lockedTargetId } : {}),
    }

    this.missiles.push(missile)
    return missile
  }

  /**
   * 1.13c `MISSMODE_SrvHit12_ChainLightning` (`0x6FC5D020`) & `SKILLS_SrvDo` initial bounce count:
   * - `MissilesTxt.sHitPar2 > 0` (`chainlightning2` #267 has `sHitPar2 = 5`);
   * - `SkillsTxt.calc2` (`Lightning Strike` #34 has `calc2 = 'ln34'` = `1 + slvl`, where 1 is the melee hit and `calc2 - 1` is the missile's remaining jumps);
   * - `SkillsTxt.calc1` (`Chain Lightning` #53 has `calc1 = 'ln34 / 5'` = `5 + floor(slvl / 5)`).
   */
  private resolveInitialChainCount(
    rec: MissileRecord,
    sourceSkillId: number,
    slvl: number,
    owner: CombatUnitContext,
  ): number {
    if (rec.pSrvHitFunc !== 12) return 0
    if (rec.sHitPar2 > 0) return rec.sHitPar2
    const skill =
      (sourceSkillId > 0 ? this.registry.getSkillById(sourceSkillId) : undefined) ??
      (rec.skill ? this.registry.getSkillByName(rec.skill) : undefined)
    if (!skill) return 0
    const evalExpr = (expr: string): number =>
      evaluateCalc(expr, {
        registry: this.registry,
        activeSkill: skill,
        activeMissile: rec,
        slvl,
        blvl: slvl,
        getBaseSkillLevel: (id) => owner.statList.getBaseSkillLevel(id),
      })
    if (skill.calc2.trim().length > 0) {
      return Math.max(0, evalExpr(skill.calc2) - 1)
    }
    if (skill.calc1.trim().length > 0) {
      return Math.max(0, evalExpr(skill.calc1))
    }
    if (skill.param2 > 0) {
      // 1.13c D2Game.dll sub_6FCB3D60 (0x6FCB4314..0x6FCB434C): TargetX = SkillsTxt[280].Param2 + 1 = 7 (6 remaining jumps after first hit)
      return skill.param2
    }
    return 0
  }

  private resolveMissileSkillRecord(m: ActiveMissile): SkillRecord | undefined {
    const direct =
      (m.sourceSkillId > 0 ? this.registry.getSkillById(m.sourceSkillId) : undefined) ??
      (m.record.skill ? this.registry.getSkillByName(m.record.skill) : undefined)
    if (direct) return direct
    if (!this.srvMissileSkillMap) {
      const map = new Map<string, SkillRecord>()
      for (let id = 0; id < 360; id += 1) {
        const sk = this.registry.getSkillById(id)
        if (!sk) continue
        for (const col of [sk.srvMissile, sk.srvMissileA, sk.srvMissileB, sk.srvMissileC]) {
          const key = col.trim().toLowerCase()
          if (key && !map.has(key)) {
            map.set(key, sk)
          }
        }
      }
      this.srvMissileSkillMap = map
    }
    return this.srvMissileSkillMap.get(m.record.name.toLowerCase())
  }

  /**
   * 1.13c `SKILLS_CalculateElementalLength` (`0x6FD8A320`) / `MISSILES_CalculateDamageData` (`0x6FC5D9D0`):
   * Evaluates elemental duration in frames (`ELen` + stepped `ELevLen1..3`, scaled by `ELenSymPerCalc` synergy)
   * from the linked `Skills.txt` row or the `Missiles.txt` row.
   */
  private resolveMissileElemDurationFrames(m: ActiveMissile): number {
    const skill = this.resolveMissileSkillRecord(m)
    const slvl = Math.max(1, Math.trunc(m.slvl))
    const computeFromBands = (
      baseLen: number,
      lev1: number,
      lev2: number,
      lev3: number,
    ): number => {
      if (baseLen <= 0 && lev1 === 0 && lev2 === 0 && lev3 === 0) return 0
      const t1 = Math.min(Math.max(0, slvl - 1), 7)
      const t2 = Math.min(Math.max(0, slvl - 8), 8)
      const t3 = Math.max(0, slvl - 16)
      return baseLen + t1 * lev1 + t2 * lev2 + t3 * lev3
    }
    if (skill) {
      let len = computeFromBands(skill.eLen, skill.eLevLen1, skill.eLevLen2, skill.eLevLen3)
      if (len === 0 && skill.auraLenCalc.trim().length > 0) {
        len = Math.max(
          0,
          evaluateCalc(skill.auraLenCalc, {
            registry: this.registry,
            activeSkill: skill,
            activeMissile: m.record,
            slvl,
            blvl: slvl,
            getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
          }),
        )
      }
      if (len > 0 && skill.eLenSymPerCalc.trim().length > 0) {
        const synPct = evaluateCalc(skill.eLenSymPerCalc, {
          registry: this.registry,
          activeSkill: skill,
          activeMissile: m.record,
          slvl,
          blvl: slvl,
          getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
        })
        if (synPct !== 0) {
          len = Math.trunc((len * (100 + synPct)) / 100)
        }
      }
      if (len > 0) return len
    }
    let mLen = computeFromBands(
      m.record.eLen,
      m.record.eLevLen1,
      m.record.eLevLen2,
      m.record.eLevLen3,
    )
    if (mLen > 0 && skill && m.record.eDmgSymPerCalc.trim().length > 0) {
      const synPct = evaluateCalc(m.record.eDmgSymPerCalc, {
        registry: this.registry,
        activeSkill: skill,
        activeMissile: m.record,
        slvl,
        blvl: slvl,
        getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
      })
      if (synPct !== 0) {
        mLen = Math.trunc((mLen * (100 + synPct)) / 100)
      }
    }
    return mLen
  }

  /**
   * 1.13c `MISSILES_CalculateDamageData` (`0x6FC5D9D0`) stepped elemental damage (`<< HitShift`)
   * for a `Missiles.txt` row (`row`) or its linked `Skills.txt` row (`skill`).
   */
  private evaluateMissileRowElemDamage256(
    m: ActiveMissile,
    row: MissileRecord,
    useSkillRow: boolean = false,
  ): { min256: number; max256: number } {
    const skill =
      (row.skill ? this.registry.getSkillByName(row.skill) : undefined) ??
      this.resolveMissileSkillRecord(m)
    const slvl = Math.max(1, Math.trunc(m.slvl))
    const computeTiered = (
      base: number,
      l1: number,
      l2: number,
      l3: number,
      l4: number,
      l5: number,
    ): number => {
      const t1 = Math.min(Math.max(0, slvl - 1), 7)
      const t2 = Math.min(Math.max(0, slvl - 8), 8)
      const t3 = Math.min(Math.max(0, slvl - 16), 6)
      const t4 = Math.min(Math.max(0, slvl - 22), 6)
      const t5 = Math.max(0, slvl - 28)
      return base + t1 * l1 + t2 * l2 + t3 * l3 + t4 * l4 + t5 * l5
    }
    if (useSkillRow && skill && (skill.eMin > 0 || skill.eMax > 0)) {
      let minRaw = computeTiered(
        skill.eMin,
        skill.eMinLev1,
        skill.eMinLev2,
        skill.eMinLev3,
        skill.eMinLev4,
        skill.eMinLev5,
      )
      let maxRaw = computeTiered(
        skill.eMax,
        skill.eMaxLev1,
        skill.eMaxLev2,
        skill.eMaxLev3,
        skill.eMaxLev4,
        skill.eMaxLev5,
      )
      if (skill.eDmgSymPerCalc.trim().length > 0) {
        const synPct = evaluateCalc(skill.eDmgSymPerCalc, {
          registry: this.registry,
          activeSkill: skill,
          activeMissile: row,
          slvl,
          blvl: slvl,
          getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
        })
        if (synPct !== 0) {
          minRaw = Math.trunc((minRaw * (100 + synPct)) / 100)
          maxRaw = Math.trunc((maxRaw * (100 + synPct)) / 100)
        }
      }
      const shift = skill.hitShift
      return {
        min256: minRaw * (1 << shift),
        max256: maxRaw * (1 << shift),
      }
    }
    let minRaw = computeTiered(
      row.eMin,
      row.eMinLev1,
      row.eMinLev2,
      row.eMinLev3,
      row.eMinLev4,
      row.eMinLev5,
    )
    let maxRaw = computeTiered(
      row.eMax,
      row.eMaxLev1,
      row.eMaxLev2,
      row.eMaxLev3,
      row.eMaxLev4,
      row.eMaxLev5,
    )
    if (skill && row.eDmgSymPerCalc.trim().length > 0) {
      const synPct = evaluateCalc(row.eDmgSymPerCalc, {
        registry: this.registry,
        activeSkill: skill,
        activeMissile: row,
        slvl,
        blvl: slvl,
        getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
      })
      if (synPct !== 0) {
        minRaw = Math.trunc((minRaw * (100 + synPct)) / 100)
        maxRaw = Math.trunc((maxRaw * (100 + synPct)) / 100)
      }
    }
    const shift = row.hitShift
    return {
      min256: minRaw * (1 << shift),
      max256: maxRaw * (1 << shift),
    }
  }

  /**
   * `D2Common_10234` equivalent: report whether the missile's dynamic path advanced into a new
   * sub-tile since the previous server frame. Returns at most one step per frame (the 1.13c
   * predicate is a boolean), carrying the remainder so the long-run rate is exactly one step per
   * sub-tile travelled (flat, 2:1-corrected distance, `MISSILE_SUBTILE_FLAT_PX` per sub-tile).
   */
  private consumeMissilePathStep(m: ActiveMissile): boolean {
    const lastX = m.pathLastX ?? m.originX ?? m.x
    const lastY = m.pathLastY ?? m.originY ?? m.y
    const dist = Math.hypot(m.x - lastX, (m.y - lastY) / ISO_GROUND_ASPECT_RATIO)
    m.pathLastX = m.x
    m.pathLastY = m.y
    const accum = (m.pathStepAccumPx ?? 0) + dist
    if (accum + 1e-6 >= MISSILE_SUBTILE_FLAT_PX) {
      m.pathStepAccumPx = accum - MISSILE_SUBTILE_FLAT_PX
      return true
    }
    m.pathStepAccumPx = accum
    return false
  }

  /** `SKILLS_EvaluateSkillFormula(pOwner, calc, nSkillId, nLevel)` for the missile's skill. */
  private evalMissileSkillCalc(m: ActiveMissile, expr: string): number {
    const skill = this.registry.getSkillById(m.sourceSkillId)
    if (!skill) {
      throw new Error(`missile-engine: ${m.name} (pSrvDoFunc ${m.record.pSrvDoFunc}) has no Skills.txt row for skill ${m.sourceSkillId}`)
    }
    return evaluateCalc(expr, {
      registry: this.registry,
      activeSkill: skill,
      activeMissile: m.record,
      slvl: m.slvl,
      blvl: m.owner.statList.getBaseSkillLevel(m.sourceSkillId),
      getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
      getEffectiveSkillLevel: (id) => m.owner.statList.getEffectiveSkillLevel(id),
      getUnitStat: (statNameOrId, baseOnly) => m.owner.statList.getAccruedStat(statNameOrId, baseOnly),
      randFn: (lo, hi) => (lo >= hi ? lo : lo + this.rng.rand(hi - lo + 1)),
    })
  }

  /**
   * 1.13c `D2Game.dll` `gpMissileSrvHitFnTable` (`0x6FD2DA48`) explosion / splash / bounce search radius (in sub-tiles):
   * - Reads `MissilesTxt.sHitPar1` (`+0x4C`, or `sHitPar2` `+0x50` when `useHitPar2 = true`).
   * - When `<= 0`, falls back to `max(1, SKILLS_EvaluateSkillFormula(pOwner, skill[calcField], skillId, slvl))`
   *   (`SrvHit01` -> `calc1` `+0x138`; `SrvHit09` -> `calc2` `+0x13C`;
   *    `SrvHit03`/`12`/`13`/`14`/`20`/`22`/`44`/`47`/`48`/`51` -> `auraRangeCalc` `+0x64`).
   */
  public resolveSrvHitRadiusSubtiles(
    m: ActiveMissile,
    calcField: 'calc1' | 'calc2' | 'calc3' | 'calc4' | 'auraRangeCalc' | 'auraLenCalc',
    opts?: {
      useHitPar2?: boolean
      alsoCheckHitPar1?: boolean
      fallbackSubtiles?: number
    },
  ): number {
    const primaryHitPar = opts?.useHitPar2 ? m.record.sHitPar2 : m.record.sHitPar1
    if (primaryHitPar > 0) {
      return primaryHitPar
    }
    if (opts?.alsoCheckHitPar1 && m.record.sHitPar1 > 0) {
      return m.record.sHitPar1
    }
    const skill =
      (m.sourceSkillId > 0 ? this.registry.getSkillById(m.sourceSkillId) : undefined) ??
      (m.record.skill ? this.registry.getSkillByName(m.record.skill) : undefined)
    const expr = skill?.[calcField]?.trim() ?? ''
    if (skill && expr.length > 0) {
      const val = evaluateCalc(expr, {
        registry: this.registry,
        activeSkill: skill,
        activeMissile: m.record,
        slvl: m.slvl,
        blvl: m.slvl,
        getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
      })
      return val > 0 ? val : 1
    }
    return opts?.fallbackSubtiles ?? 1
  }

  /**
   * 1.13c `D2Game.dll` `gpMissileSrvHitFnTable` (`0x6FD2DA48`) explosion / splash / bounce search radius
   * in flat ground pixels (`radiusSubtiles * MISSILE_SUBTILE_FLAT_PX`, where `1 sub-tile = 20 px`).
   */
  public resolveSrvHitRadiusPx(
    m: ActiveMissile,
    calcField: 'calc1' | 'calc2' | 'calc3' | 'calc4' | 'auraRangeCalc' | 'auraLenCalc',
    opts?: {
      useHitPar2?: boolean
      alsoCheckHitPar1?: boolean
      fallbackSubtiles?: number
    },
  ): number {
    return this.resolveSrvHitRadiusSubtiles(m, calcField, opts) * MISSILE_SUBTILE_FLAT_PX
  }

  private resolveUnitPosition(
    unit: CombatUnitContext,
    targetPositions: ReadonlyMap<string, { x: number; y: number }>,
  ): { x: number; y: number } | undefined {
    const pos = targetPositions.get(unit.id)
    if (pos) return pos
    if (unit.x !== undefined && unit.y !== undefined) return { x: unit.x, y: unit.y }
    return undefined
  }

  /**
   * 1.13c `D2Game.dll` `0x6FD2D970` (`gMissileSrvDoFuncTable[38]`) server missile `pSrvDoFunc` dispatch (`0..37`).
   * Keys strictly on `Missiles.txt` `pSrvDoFunc` (`m.record.pSrvDoFunc`) and `Skills.txt` / `Missiles.txt` columns.
   * Returns `true` when the `pSrvDoFunc` handler terminates the missile early (`return 2` in 1.13c).
   */
  public dispatchSrvDo(
    m: ActiveMissile,
    ctx: {
      readonly currentTick: number
      readonly targets: readonly CombatUnitContext[]
      readonly targetPositions: ReadonlyMap<string, { x: number; y: number }>
      readonly collision: MissileTerrainCollision | undefined
      readonly hits: { missileName: string; targetId: string; damage: number; immune: boolean }[]
      readonly subMissilesSpawned: string[]
    },
  ): boolean {
    const rec = m.record
    const fn = rec.pSrvDoFunc
    if (fn <= 0 || fn >= MISSILE_SRV_DO_TABLE_113C.length) return false
    const remaining = m.maxRangeTicks - m.ageTicks
    const sub1 = rec.subMissile1

    const spawnSub = (opts: {
      missileNameOrId?: string | number
      owner: CombatUnitContext
      startX: number
      startY: number
      targetX: number
      targetY: number
      dmgPacket?: SUnitDmgPacket | undefined
      maxRangeTicks?: number | undefined
    }): void => {
      const subNameOrId = opts.missileNameOrId ?? sub1
      if (!subNameOrId) return
      const spawned = this.spawnMissile({
        missileNameOrId: subNameOrId,
        sourceSkillId: m.sourceSkillId,
        slvl: m.slvl,
        owner: opts.owner,
        startX: opts.startX,
        startY: opts.startY,
        targetX: opts.targetX,
        targetY: opts.targetY,
        dmgPacket: opts.dmgPacket ?? m.dmgPacket,
        ...(opts.maxRangeTicks !== undefined ? { maxRangeTicks: opts.maxRangeTicks } : {}),
      })
      if (spawned) {
        ctx.subMissilesSpawned.push(spawned.name)
      }
    }

    const createSubWithCollisionCheck = (
      nRange: number,
      nFrames: number,
      collisionMask: number,
    ): void => {
      // 1.13c D2Game.dll 0x6FC5D1E0 (MISSMODE_CreateMissileWithCollisionCheck):
      // - Checks remaining % nFrames === 0
      // - Seeds pMissile->pSeed via SEED_InitLowSeed(remaining + unitX)
      // - Rolls offX, offY in [-(nRange - 1), +(nRange - 2)] via ITEMS_RollLimitedRandomNumber(2 * (nRange - 1)) - (nRange - 1)
      // - Checks COLLISION_CheckMask(pRoom, sx, sy, collisionMask) before spawning SubMissile1 (sub1).
      if (!sub1 || nFrames <= 0 || remaining % nFrames !== 0) return
      const rng = (m.doFuncRng ??= new D2Rng(0, 666))
      rng.setSeed(Math.floor(m.x) + remaining, 666)
      const nMax = Math.max(0, nRange - 1)
      const span = 2 * nMax
      const offX = span > 0 ? rng.rand(span) - nMax : 0
      const offY = span > 0 ? rng.rand(span) - nMax : 0
      const sx = m.x + offX * MISSILE_SUBTILE_FLAT_PX
      const sy = m.y + offY * MISSILE_SUBTILE_FLAT_PX * ISO_GROUND_ASPECT_RATIO
      const terrain = ctx.collision ?? this.terrain
      if (terrain !== undefined) {
        const blocked =
          terrain.isMissileBlocked !== undefined
            ? terrain.isMissileBlocked(sx, sy, m.x, m.y, collisionMask)
            : terrain.overlap !== undefined && terrain.overlap(sx, sy) > 0
        if (blocked) return
      }
      spawnSub({ owner: m.owner, startX: sx, startY: sy, targetX: sx, targetY: sy })
    }

    switch (fn) {
      // 1: MISSMODE_SrvDo01_StandardMove (0x6FC5F540)
      case 1: {
        // When a non-colliding aura/controller missile (`CollideType = 0`, `pSrvHitFunc = 0`) is bound to a periodic cold radial skill (`srvDoFunc = 124`, #250 Hurricane),
        // follow the caster and pulse every `skill.param3` frames within `skill.auraRangeCalc` subtiles.
        if (rec.collideType === 0 && rec.pSrvHitFunc === 0 && m.sourceSkillId > 0) {
          const skillRec = this.registry.getSkillById(m.sourceSkillId)
          if (
            skillRec &&
            skillRec.srvDoFunc === 124 &&
            skillRec.eType === 'cold' &&
            skillRec.auraRangeCalc.trim().length > 0
          ) {
            const ownerPos = this.resolveUnitPosition(m.owner, ctx.targetPositions)
            if (ownerPos) {
              m.x = ownerPos.x
              m.y = ownerPos.y
            }
            const cadence = Math.max(1, skillRec.param4 || skillRec.param3)
            if (m.ageTicks === 1 || m.ageTicks % cadence === 0) {
              const radiusSubtiles = Math.max(1, this.evalMissileSkillCalc(m, skillRec.auraRangeCalc))
              const radiusPx = radiusSubtiles * MISSILE_SUBTILE_FLAT_PX
              const chillFrames = m.dmgPacket.elemDurationFrames ?? this.resolveMissileElemDurationFrames(m)
              const pulseHitName = skillRec.name.toLowerCase()
              for (const target of ctx.targets) {
                if (target.statList.getHp256() <= 0) continue
                if (!areUnitsEnemies113c(m.owner, target)) continue
                const pos = this.resolveUnitPosition(target, ctx.targetPositions)
                if (!pos) continue
                if (Math.hypot(pos.x - m.x, (pos.y - m.y) / ISO_GROUND_ASPECT_RATIO) <= radiusPx) {
                  const dmgOut = executeSUnitDmg(m.owner, target, m.dmgPacket, m.doFuncRng ?? this.rng)
                  ctx.hits.push({
                    missileName: pulseHitName,
                    targetId: target.id,
                    damage: dmgOut.totalDamage,
                    immune: dmgOut.immuneToElem || dmgOut.immuneToPhys,
                  })
                  if (
                    chillFrames > 0 &&
                    !dmgOut.immuneToElem &&
                    !target.statList.getAccruedStat('item_cannotbefrozen')
                  ) {
                    target.stateBus.applyState({
                      stateNameOrId: 'chill',
                      sourceSkillId: m.sourceSkillId,
                      slvl: m.slvl,
                      durationFrames: chillFrames,
                    })
                  }
                }
              }
            }
          }
        }
        return false
      }
      // 2: MISSMODE_SrvDo02_PoisonJavelin (0x6FC61B80)
      // 3: MISSMODE_SrvDo03_PoisonCloudTrail (0x6FC61AE0)
      case 2:
      case 3: {
        if (sub1 && (m.ageTicks === 1 || this.consumeMissilePathStep(m))) {
          const cloudPacket: SUnitDmgPacket = {
            skillId: m.sourceSkillId,
            slvl: m.slvl,
            attackKind: 'spell',
            srcDam: 0,
            elemType: 'pois',
            elemMin256: m.dmgPacket.elemMin256 ?? 0,
            elemMax256: m.dmgPacket.elemMax256 ?? 0,
            ...(m.dmgPacket.elemDurationFrames !== undefined
              ? { elemDurationFrames: m.dmgPacket.elemDurationFrames }
              : {}),
            autoHit: true,
            unblockable: true,
            canTriggerProcs: false,
          }
          spawnSub({
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x,
            targetY: m.y,
            dmgPacket: cloudPacket,
          })
        }
        return false
      }
      // 5: MISSMODE_SrvDo05_FireWallSegment (0x6FC61980: blaze, firewall, meteorfire, immolationfire, moltenboulderfirepath)
      case 5: {
        if ((m.dmgPacket.elemMax256 ?? 0) === 0) {
          const rowElem = this.evaluateMissileRowElemDamage256(
            m,
            rec,
            rec.eMin === 0 && rec.eMax === 0,
          )
          if (rowElem.max256 > 0) {
            m.dmgPacket = {
              ...m.dmgPacket,
              skillId: m.sourceSkillId,
              slvl: m.slvl,
              attackKind: 'spell',
              srcDam: 0,
              elemType: (rec.eType as SUnitDmgPacket['elemType']) || 'fire',
              elemMin256: rowElem.min256,
              elemMax256: rowElem.max256,
              autoHit: true,
              unblockable: true,
              isPersistentGroundFire: true,
              noHitRecovery: true,
              canTriggerProcs: false,
              ...(rec.skill === '' && !rec.applyMastery ? { skipElemMastery: true } : {}),
              ...(rec.damageRate > 0 ? { frameRate1024: rec.damageRate } : {}),
            }
          }
        }
        return false
      }
      // 6: MISSMODE_SrvDo06_FireWallMaker_MoltenBoulder (0x6FC61850): SubMissile1 once per path step.
      case 6: {
        if (!sub1) {
          m.expired = true
          return true
        }
        if (this.consumeMissilePathStep(m)) {
          const dmgPacket: SUnitDmgPacket =
            rec.pSrvDmgFunc === 14
              ? {
                  skillId: m.sourceSkillId,
                  slvl: m.slvl,
                  attackKind: 'spell',
                  srcDam: 0,
                  elemType: 'fire',
                  elemMin256: m.dmgPacket.elemMin256 ?? 0,
                  elemMax256: m.dmgPacket.elemMax256 ?? 0,
                  autoHit: true,
                }
              : m.dmgPacket
          spawnSub({ owner: m.owner, startX: m.x, startY: m.y, targetX: m.x, targetY: m.y, dmgPacket })
        }
        return false
      }
      // 7: MISSMODE_SrvDo07_GuidedArrow_BoneSpirit (0x6FC61710 & sub_6FC61580):
      // Re-paths an already-locked target while within 25 sub-tiles, or acquires the nearest enemy
      // within `Param2` sub-tiles (15 for Guided Arrow #86 / Bone Spirit #193; 0 for monbonespirit #329).
      case 7: {
        let closestTarget: { x: number; y: number } | null = null
        let closestDist = Infinity
        const lockedTrackDistPx =
          rec.sHitPar1 > 0 ? rec.sHitPar1 * MISSILE_SUBTILE_FLAT_PX : 25 * MISSILE_SUBTILE_FLAT_PX
        const scanAcquireDistPx =
          rec.sHitPar1 > 0
            ? rec.sHitPar1 * MISSILE_SUBTILE_FLAT_PX
            : rec.param2 > 0
              ? rec.param2 * MISSILE_SUBTILE_FLAT_PX
              : 0
        if (m.canPierce && m.ageTicks > 0 && m.ageTicks % 5 === 0 && m.hitTargetIds.size > 0) {
          for (const hitId of Array.from(m.hitTargetIds)) {
            const hitUnit = ctx.targets.find((t) => t.id === hitId)
            const hitPos = hitUnit ? this.resolveUnitPosition(hitUnit, ctx.targetPositions) : undefined
            if (
              !hitPos ||
              !checkMissileSizeFootprintOverlap113c(
                Math.abs(hitPos.x - m.x) / MISSILE_SUBTILE_FLAT_PX,
                Math.abs(hitPos.y - m.y) / MISSILE_SUBTILE_FLAT_PX,
                rec.size,
                hitUnit ? resolveUnitSubtileSize113c(hitUnit) : 2,
              )
            ) {
              m.hitTargetIds.delete(hitId)
            }
          }
        }
        if (m.lockedTargetId !== undefined && !m.hitTargetIds.has(m.lockedTargetId)) {
          const lockedUnit = ctx.targets.find((t) => t.id === m.lockedTargetId && t.statList.getHp256() > 0)
          const pos =
            lockedUnit && areUnitsEnemies113c(m.owner, lockedUnit)
              ? this.resolveUnitPosition(lockedUnit, ctx.targetPositions)
              : undefined
          if (pos) {
            const dx = pos.x - m.x
            const dy = (pos.y - m.y) / ISO_GROUND_ASPECT_RATIO
            const dist = Math.hypot(dx, dy)
            if (dist <= lockedTrackDistPx) {
              closestTarget = pos
              closestDist = dist
            } else {
              m.lockedTargetId = undefined
            }
          } else {
            m.lockedTargetId = undefined
          }
        }
        if (!closestTarget && scanAcquireDistPx > 0) {
          let closestId: string | undefined
          for (const target of ctx.targets) {
            if (target.statList.getHp256() <= 0) continue
            if (m.hitTargetIds.has(target.id)) continue
            if (!areUnitsEnemies113c(m.owner, target)) continue
            const pos = this.resolveUnitPosition(target, ctx.targetPositions)
            if (!pos) continue
            const dx = pos.x - m.x
            const dy = (pos.y - m.y) / ISO_GROUND_ASPECT_RATIO
            const dist = Math.hypot(dx, dy)
            if (dist <= scanAcquireDistPx && dist < closestDist) {
              closestDist = dist
              closestTarget = pos
              closestId = target.id
            }
          }
          if (closestId !== undefined) {
            m.lockedTargetId = closestId
          }
        }
        if (closestTarget) {
          const speed = m.speed > 0 ? m.speed : (rec.vel * 75) / 100
          const targetAngle = Math.atan2((closestTarget.y - m.y) / ISO_GROUND_ASPECT_RATIO, closestTarget.x - m.x)
          m.angleRad = targetAngle
          m.vx = Math.cos(m.angleRad) * speed
          m.vy = Math.sin(m.angleRad) * speed * ISO_GROUND_ASPECT_RATIO
        }
        return false
      }
      // 8: MISSMODE_SrvDo08_MonBlizzCenter (0x6FC61670)
      case 8: {
        if (!sub1) {
          m.expired = true
          return true
        }
        const lvlDiv = Math.trunc(m.slvl / Math.max(1, rec.param3))
        const nRange = rec.param1 + Math.max(2, lvlDiv)
        const nFrames = Math.max(3, rec.param2 - lvlDiv)
        createSubWithCollisionCheck(nRange, nFrames, 0x05)
        return false
      }
      // 9: MISSMODE_SrvDo09_BatLightning (0x6FC61520)
      // 12: MISSMODE_SrvDo12_DiabloWallMaker (0x6FC61110)
      // 13: MISSMODE_SrvDo13_BoneWallMaker (0x6FC60EB0)
      case 9:
      case 12:
      case 13: {
        if (sub1 && this.consumeMissilePathStep(m)) {
          spawnSub({ owner: m.owner, startX: m.x, startY: m.y, targetX: m.x, targetY: m.y })
        }
        return false
      }
      // 10: MISSMODE_SrvDo10_BlizzardCenter (0x6FC613D0)
      case 10: {
        const skillRec = this.resolveMissileSkillRecord(m)
        if (!sub1 || !skillRec) {
          m.expired = true
          return true
        }
        const nRange = evaluateCalc(skillRec.calc1, {
          registry: this.registry,
          activeSkill: skillRec,
          activeMissile: rec,
          slvl: m.slvl,
          blvl: m.slvl,
          getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
        })
        const nFrames = evaluateCalc(skillRec.calc2, {
          registry: this.registry,
          activeSkill: skillRec,
          activeMissile: rec,
          slvl: m.slvl,
          blvl: m.slvl,
          getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
        })
        createSubWithCollisionCheck(nRange, nFrames, 0x05)
        return false
      }
      // 11: MISSMODE_SrvDo11_FingerMageSpider (0x6FC61240)
      case 11:
        return false
      // 14: MISSMODE_SrvDo14_GrimWardDelay (0x6FC60E10: grimwardsmall/medium/large periodic terror pulse)
      case 14: {
        const cadence = Math.max(1, rec.param1 || 25)
        if (m.ageTicks === 1 || m.ageTicks % cadence === 0) {
          const radiusPx = this.resolveSrvHitRadiusPx(m, 'auraRangeCalc', { fallbackSubtiles: 6 })
          const skillRec = this.resolveMissileSkillRecord(m)
          const rawDur = skillRec ? Math.max(25, skillRec.param6 || 150) : 150
          for (const target of ctx.targets) {
            if (target.statList.getHp256() <= 0) continue
            if (!areUnitsEnemies113c(m.owner, target)) continue
            if (target.isBoss || target.rank === 'boss' || target.rank === 'unique' || target.rank === 'champion') {
              continue
            }
            const pos = this.resolveUnitPosition(target, ctx.targetPositions)
            if (!pos) continue
            if (Math.hypot(pos.x - m.x, (pos.y - m.y) / ISO_GROUND_ASPECT_RATIO) <= radiusPx) {
              const div = resolveAiCurseDivisor('normal')
              if (div > 0) {
                target.stateBus.applyState({
                  stateNameOrId: 56,
                  sourceUnitId: m.owner.id,
                  sourceSkillId: m.sourceSkillId,
                  slvl: m.slvl,
                  durationFrames: Math.max(1, Math.trunc(rawDur / div)),
                  currentFrame: ctx.currentTick,
                })
              }
            }
          }
        }
        return false
      }
      // 15: MISSMODE_SrvDo15_FrozenOrb (0x6FC60CA0)
      case 15: {
        const nFrames = Math.max(1, rec.param1)
        if (m.ageTicks % nFrames === 0 || remaining % nFrames <= 0) {
          if (sub1) {
            const idx = Math.abs((m.subMissileIdx ?? 0) % 64)
            const offX = FROZEN_ORB_X_POSITIONS[idx]!
            const offY = FROZEN_ORB_Y_POSITIONS[idx]! * ISO_GROUND_ASPECT_RATIO
            spawnSub({
              owner: m.owner,
              startX: m.x,
              startY: m.y,
              targetX: m.x + offX * 10,
              targetY: m.y + offY * 10,
            })
            m.subMissileIdx = (idx + rec.param2) % 64
          }
        }
        return false
      }
      // 16: MISSMODE_SrvDo16_FrozenOrbNova (0x6FC60BD0)
      case 16: {
        // 1.13c D2Game.dll 0x6FC60BD0:
        // Reads target offset (a, b) via MISSILE_GetTargetX (0x6FC2B24C) / MISSILE_GetTargetY (0x6FC2B288),
        // rotates by +45 deg via newA = trunc((a - b) / 2), newB = trunc((a + b) / 2),
        // re-aims path toward (unitX + newA, unitY + newB) via D2Common.#10170/#10142 at unchanged scalar speed,
        // and stores (newA, newB) back via MISSILE_SetTargetX (0x6FC2A50E) / MISSILE_SetTargetY (0x6FC2AF5E).
        const threshold = rec.param1
        const nParam = Math.max(1, rec.param2)
        if (remaining < threshold && remaining % nParam === 0) {
          const foreshortenY = m.isoGroundForeshorten ? ISO_GROUND_ASPECT_RATIO : 1
          const a = m.targetOffsetX ?? Math.round(Math.cos(m.angleRad) * 30)
          const b = m.targetOffsetY ?? Math.round(Math.sin(m.angleRad) * 30)
          const newA = Math.trunc((a - b) / 2)
          const newB = Math.trunc((a + b) / 2)
          m.targetOffsetX = newA
          m.targetOffsetY = newB
          if (newA !== 0 || newB !== 0) {
            m.angleRad = Math.atan2(newB, newA)
            m.vx = Math.cos(m.angleRad) * m.speed
            m.vy = Math.sin(m.angleRad) * m.speed * foreshortenY
          }
        }
        return false
      }
      // 20: MISSMODE_SrvDo20_BladeCreeper (0x6FC60860: 392:blade creeper back-and-forth sentinel patrol)
      case 20: {
        if (remaining <= 1 && (m.loops ?? 0) > 0) {
          m.loops = (m.loops ?? 0) - 1
          m.vx = -m.vx
          m.vy = -m.vy
          m.angleRad = Math.atan2(m.vy, m.vx)
          m.ageTicks = 0
        }
        return false
      }
      // 21: MISSMODE_SrvDo21_distraction (0x6FC61EB0)
      case 21: {
        if (sub1 && remaining % Math.max(1, rec.param1 || 10) === 0) {
          spawnSub({ owner: m.owner, startX: m.x, startY: m.y, targetX: m.x, targetY: m.y })
        }
        return false
      }
      // 22: MISSMODE_SrvDo22_LightningTrailingJavelin (0x6FC606D0)
      // 23: MISSMODE_SrvDo23_SuccubusFireball (0x6FC605E0)
      // 24: MISSMODE_SrvDo24_FirestormMaker (0x6FC605E0)
      case 22:
      case 23:
      case 24: {
        if (!sub1) {
          m.expired = true
          return true
        }
        if (this.consumeMissilePathStep(m)) {
          spawnSub({ owner: m.owner, startX: m.x, startY: m.y, targetX: m.x, targetY: m.y })
        }
        return false
      }
      // 25: MISSMODE_SrvDo25_EruptionCenter (0x6FC604D0)
      case 25: {
        const skill = this.registry.getSkillById(m.sourceSkillId)
        if (!sub1 || !skill) {
          m.expired = true
          return true
        }
        const nRange = this.evalMissileSkillCalc(m, skill.calc1)
        const nFrames = this.evalMissileSkillCalc(m, skill.calc2)
        createSubWithCollisionCheck(nRange, nFrames, 0x45)
        return false
      }
      // 26: MISSMODE_SrvDo26_Vines (0x6FC60420)
      case 26: {
        if (!sub1) {
          m.expired = true
          return true
        }
        if (remaining % Math.max(rec.param1, 1) === 0) {
          spawnSub({ owner: m.owner, startX: m.x, startY: m.y, targetX: m.x, targetY: m.y })
        }
        return false
      }
      // 27: MISSMODE_SrvDo27_Tornado (0x6FC60280)
      case 27: {
        const skill = this.registry.getSkillById(m.sourceSkillId)
        if (!skill) {
          m.expired = true
          return true
        }
        const cadence = rec.param1 > 0 ? rec.param1 : Math.max(this.evalMissileSkillCalc(m, skill.calc4), 1)
        if (remaining % cadence !== 0) return false
        const radiusSubtiles =
          rec.param2 > 0 ? rec.param2 : Math.max(this.evalMissileSkillCalc(m, skill.auraRangeCalc), 1)
        const radiusPx = radiusSubtiles * MISSILE_SUBTILE_FLAT_PX
        for (const target of ctx.targets) {
          if (target.statList.getHp256() <= 0) continue
          if (target.id === m.owner.id) continue
          const pos = this.resolveUnitPosition(target, ctx.targetPositions)
          if (!pos) continue
          if (Math.hypot(pos.x - m.x, (pos.y - m.y) / ISO_GROUND_ASPECT_RATIO) > radiusPx) continue
          const dmgOut = executeSUnitDmg(m.owner, target, m.dmgPacket, m.doFuncRng ?? this.rng)
          ctx.hits.push({
            missileName: m.name,
            targetId: target.id,
            damage: dmgOut.totalDamage,
            immune: dmgOut.immuneToElem || dmgOut.immuneToPhys,
          })
        }
        return false
      }
      // 28: MISSMODE_SrvDo28_Volcano (0x6FC60070)
      case 28: {
        const skill = this.registry.getSkillById(m.sourceSkillId)
        if (!sub1 || !skill) {
          m.expired = true
          return true
        }
        const nAuraRange =
          rec.param2 > 0 ? rec.param2 : Math.max(this.evalMissileSkillCalc(m, skill.auraRangeCalc), 1)
        const nFrames = rec.param1 > 0 ? rec.param1 : Math.max(this.evalMissileSkillCalc(m, skill.calc4), 1)
        if (remaining > rec.param3 && remaining < rec.param4 && remaining % nFrames === 0) {
          const rng = (m.doFuncRng ??= new D2Rng(Math.floor(m.x) >>> 0, 666))
          rng.setSeed(rng.lo, 666)
          const offX = rng.rand(2 * nAuraRange + 1) - nAuraRange
          const offY = rng.rand(2 * nAuraRange + 1) - nAuraRange
          spawnSub({
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x + offX * MISSILE_SUBTILE_FLAT_PX,
            targetY: m.y + offY * MISSILE_SUBTILE_FLAT_PX * ISO_GROUND_ASPECT_RATIO,
          })
        }
        return false
      }
      // 29: MISSMODE_SrvDo29_RecyclerDelay (0x6FC5FED0)
      // 33: MISSMODE_SrvDo33_VineRecyclerDelay (0x6FC5FD30)
      case 29:
      case 33: {
        const skill = this.resolveMissileSkillRecord(m)
        if (!skill) {
          m.expired = true
          return true
        }
        const owner = m.owner
        if (remaining === rec.param1 && owner.statList.getHp256() > 0 && skill.calc1.trim().length > 0) {
          const pct = evaluateCalc(skill.calc1, {
            registry: this.registry,
            activeSkill: skill,
            activeMissile: rec,
            slvl: m.slvl,
            blvl: m.slvl,
            getBaseSkillLevel: (id) => owner.statList.getBaseSkillLevel(id),
          })
          if (fn === 33) {
            const mana = owner.statList.getMana256() >> 8
            const maxMana = owner.statList.getMaxMana256() >> 8
            if (mana < maxMana && maxMana > 0) {
              const newMana = Math.min(Math.trunc((maxMana * pct) / 100) + mana, maxMana)
              owner.statList.setMana256(newMana << 8)
            }
          } else {
            const hp = owner.statList.getHp256() >> 8
            const maxHp = owner.statList.getMaxHp256() >> 8
            if (hp < maxHp && maxHp > 0) {
              const newHp = Math.min(Math.trunc((maxHp * pct) / 100) + hp, maxHp)
              owner.statList.setHp256(newHp << 8)
            }
          }
        }
        return false
      }
      // 30: MISSMODE_SrvDo30_RabiesPlague (0x6FC5FB40)
      case 30: {
        const caster = m.linkedUnit
        if (!sub1 || !caster || m.owner.statList.getHp256() <= 0) {
          m.expired = true
          return true
        }
        const ownerPos = this.resolveUnitPosition(m.owner, ctx.targetPositions)
        if (ownerPos) {
          m.x = ownerPos.x
          m.y = ownerPos.y
        }
        if (remaining % Math.max(rec.param1, 1) === 0) {
          const rng = (m.doFuncRng ??= new D2Rng(hashString32(caster.id), 666))
          const nRange = 2 * rec.param2 + 1
          const offX = rng.rand(nRange) - rec.param2
          const offY = rng.rand(nRange) - rec.param2
          spawnSub({
            owner: caster,
            startX: m.x,
            startY: m.y,
            targetX: m.x + offX * MISSILE_SUBTILE_FLAT_PX,
            targetY: m.y + offY * MISSILE_SUBTILE_FLAT_PX * ISO_GROUND_ASPECT_RATIO,
          })
        }
        return false
      }
      // 31: MISSMODE_SrvDo31_WakeOfDestructionMaker (0x6FC5F9F0: wake of destruction maker #517, baal cold maker #589)
      case 31: {
        if (rec.param2 > 0) {
          if (remaining === rec.param2) {
            if (sub1) {
              spawnSub({ owner: m.owner, startX: m.x, startY: m.y, targetX: m.x, targetY: m.y })
            }
            if (rec.subMissile2) {
              spawnSub({
                missileNameOrId: rec.subMissile2,
                owner: m.owner,
                startX: m.x,
                startY: m.y,
                targetX: m.x,
                targetY: m.y,
              })
            }
          }
          return false
        }
        if (sub1 && this.consumeMissilePathStep(m)) {
          const perpA = m.angleRad + Math.PI / 2
          const perpB = m.angleRad - Math.PI / 2
          spawnSub({
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x + Math.cos(perpA) * 40,
            targetY: m.y + Math.sin(perpA) * 40 * ISO_GROUND_ASPECT_RATIO,
          })
          spawnSub({
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x + Math.cos(perpB) * 40,
            targetY: m.y + Math.sin(perpB) * 40 * ISO_GROUND_ASPECT_RATIO,
          })
        }
        return false
      }
      // 37: MISSMODE_SrvDo37_Diablogeddon (0x6FC5F550)
      case 37: {
        if (remaining === rec.param2) {
          if (sub1) {
            spawnSub({ owner: m.owner, startX: m.x, startY: m.y, targetX: m.x, targetY: m.y })
          }
          if (rec.subMissile2) {
            spawnSub({
              missileNameOrId: rec.subMissile2,
              owner: m.owner,
              startX: m.x,
              startY: m.y,
              targetX: m.x,
              targetY: m.y,
            })
          }
        }
        return false
      }
      // 32: MISSMODE_SrvDo32_TigerFury (0x6FC61DE0: 520:tigerfury homing + trail)
      case 32: {
        if (rec.vel === 0) {
          const ownerPos = this.resolveUnitPosition(m.owner, ctx.targetPositions)
          if (ownerPos) {
            m.x = ownerPos.x
            m.y = ownerPos.y
          }
          return false
        }
        if (sub1 && this.consumeMissilePathStep(m)) {
          spawnSub({ owner: m.owner, startX: m.x, startY: m.y, targetX: m.x, targetY: m.y })
        }
        return false
      }
      // 34: MISSMODE_SrvDo34_BaalTauntControl (0x6FC61C30)
      case 34: {
        if (sub1 && remaining % Math.max(1, rec.param1 || 25) === 0) {
          spawnSub({ owner: m.owner, startX: m.x, startY: m.y, targetX: m.x, targetY: m.y })
        }
        return false
      }
      // 35: MISSMODE_SrvDo35_RoyalStrikeChaosIce (0x6FC5F890)
      case 35: {
        const cadence = Math.max(1, rec.param1 || 3)
        if (m.ageTicks % cadence === 0 && m.speed > 0) {
          const foreshortenY = m.isoGroundForeshorten ? ISO_GROUND_ASPECT_RATIO : 1
          m.angleRad += 0.25
          m.vx = Math.cos(m.angleRad) * m.speed
          m.vy = Math.sin(m.angleRad) * m.speed * foreshortenY
        }
        return false
      }
      // 36: MISSMODE_SrvDo36_BaalFxControl (0x6FC5F670)
      case 36:
        return false
      default:
        return false
    }
  }

  /**
   * 1.13c `D2Game.dll` `0x6FD2DB68` (`gpMissileSrvDmgFnTable[16]`) server missile `pSrvDmgFunc` dispatch (`0..15`).
   * Modifies the outgoing `SUnitDmgPacket` and returns post-hit state/knockback instructions per `Missiles.txt`
   * `pSrvDmgFunc`, `dParam1`, `dParam2`, `sHitCalc1`, and `eType`.
   */
  public dispatchSrvDmg(
    m: ActiveMissile,
    target: CombatUnitContext,
    basePacket: SUnitDmgPacket,
  ): {
    readonly packet: SUnitDmgPacket
    readonly stateOnHit?: {
      readonly stateNameOrId: string | number
      readonly durationFrames: number
      readonly nonBossOnly?: boolean
    }
    readonly knockbackNonLargeBoss?: boolean
  } {
    const rec = m.record
    const fn = rec.pSrvDmgFunc
    const skill = this.resolveMissileSkillRecord(m)
    let packet: SUnitDmgPacket = basePacket
    let stateOnHit:
      | {
          readonly stateNameOrId: string | number
          readonly durationFrames: number
          readonly nonBossOnly?: boolean
        }
      | undefined
    let knockbackNonLargeBoss = false

    const baseElemDuration = m.dmgPacket.elemDurationFrames ?? this.resolveMissileElemDurationFrames(m)
    if (baseElemDuration > 0) {
      if (rec.eType === 'frze') {
        stateOnHit = { stateNameOrId: 'freeze', durationFrames: baseElemDuration }
      } else if (rec.eType === 'cold') {
        stateOnHit = { stateNameOrId: 'chill', durationFrames: baseElemDuration }
      }
    }

    switch (fn) {
      // 1: MISSMODE_SrvDmg01_ArrowPhysToElemConvert (0x6FC59CE0, firearrow/magicarrow/coldarrow)
      // 12: MISSMODE_SrvDmg12_LightningJavelinConvert (0x6FC5A850, lightningjavelin)
      case 1:
      case 12: {
        const calcExpr = rec.dmgCalc1.trim() || rec.sHitCalc1.trim()
        if (skill && calcExpr.length > 0) {
          const pct = Math.min(
            100,
            Math.max(
              0,
              evaluateCalc(calcExpr, {
                registry: this.registry,
                activeSkill: skill,
                activeMissile: rec,
                slvl: m.slvl,
                blvl: m.slvl,
                getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
              }),
            ),
          )
          if (pct > 0 && packet.physToElemPct === undefined) {
            const convType =
              fn === 12
                ? 'ltng'
                : rec.eType === 'fire' || rec.eType === 'cold' || rec.eType === 'mag' || rec.eType === 'ltng'
                  ? rec.eType
                  : packet.elemType
            packet = {
              ...packet,
              physToElemPct: pct,
              ...(convType && convType !== 'none' ? { elemType: convType } : {}),
            }
          }
        }
        break
      }
      // 2: MISSMODE_SrvDmg02_ColdToFreezeScale (0x6FC59080, icearrow / royalstrikechaosice)
      case 2: {
        const rawLen = baseElemDuration
        const scalePct = rec.dParam1 > 0 ? rec.dParam1 : 100
        const frzFrames = Math.trunc((rawLen * scalePct) / 100)
        if (frzFrames > 0) {
          stateOnHit = { stateNameOrId: 'freeze', durationFrames: frzFrames }
        }
        break
      }
      // 3: MISSMODE_SrvDmg03_GroundFireDamage (0x6FC59670: blaze, firewall, meteorfire, immolationfire, vampirefirewall)
      case 3: {
        let elemMin256 = packet.elemMin256 ?? 0
        let elemMax256 = packet.elemMax256 ?? 0
        if (elemMax256 === 0) {
          const rowElem = this.evaluateMissileRowElemDamage256(
            m,
            rec,
            rec.eMin === 0 && rec.eMax === 0,
          )
          elemMin256 = rowElem.min256
          elemMax256 = rowElem.max256
        }
        packet = {
          ...packet,
          attackKind: 'spell',
          elemType: (rec.eType as SUnitDmgPacket['elemType']) || packet.elemType || 'fire',
          elemMin256,
          elemMax256,
          autoHit: true,
          unblockable: true,
          isPersistentGroundFire: true,
          noHitRecovery: true,
          canTriggerProcs: false,
          ...(rec.skill === '' && !rec.applyMastery ? { skipElemMastery: true } : {}),
          frameRate1024: rec.damageRate > 0 ? rec.damageRate : (packet.frameRate1024 ?? 41),
        }
        break
      }
      // 4: MISSMODE_SrvDmg04_IceBlastColdToFreeze (0x6FC58E70, iceblast)
      // 10: MISSMODE_SrvDmg10_BladesOfIceFreeze (0x6FC59040, bladesoficecubes)
      case 4:
      case 10: {
        if (baseElemDuration > 0) {
          stateOnHit = { stateNameOrId: 'freeze', durationFrames: baseElemDuration }
        }
        break
      }
      // 5: MISSMODE_SrvDmg05_BlessedHammerUndeadDemon (0x6FC5A790, blessedhammer: dParam1=50 (+50% undead), dParam2=50 (+50% demon))
      // 13: MISSMODE_SrvDmg13_BlessedHammerExConcentration (0x6FC5AAA0)
      case 5:
      case 13: {
        // Note: executeSUnitDmg (combat-pipeline.ts) already applies +50% Undead bonus for skillId === 112.
        let scalePct = 100
        if (target.isUndead && rec.dParam1 > 0 && packet.skillId !== 112) {
          scalePct = rec.dParam1 < 100 ? 100 + rec.dParam1 : rec.dParam1
        } else if (target.isDemon && rec.dParam2 > 0 && packet.skillId !== 112) {
          scalePct = rec.dParam2 < 100 ? 100 + rec.dParam2 : rec.dParam2
        }
        if (scalePct !== 100 && packet.elemType === 'mag') {
          packet = {
            ...packet,
            elemMin256: Math.trunc(((packet.elemMin256 ?? 0) * scalePct) / 100),
            elemMax256: Math.trunc(((packet.elemMax256 ?? 0) * scalePct) / 100),
          }
        }
        break
      }
      // 7: MISSMODE_SrvDmg07_Warcry_ShockWaveStun (0x6FC59600, warcry #235 / shockwave #511)
      // Evaluates dParam1 > 0 ? dParam1 : SKILLS_GetLinearValue(skill.param1, skill.param2, slvl) without any 250-frame cap!
      case 7: {
        let stunFrames = rec.dParam1
        if (stunFrames <= 0 && skill) {
          if (rec.dmgCalc1.trim().length > 0) {
            stunFrames = evaluateCalc(rec.dmgCalc1, {
              registry: this.registry,
              activeSkill: skill,
              activeMissile: rec,
              slvl: m.slvl,
              blvl: m.slvl,
              getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
            })
          } else {
            stunFrames = skill.param1 + (Math.max(1, m.slvl) - 1) * skill.param2
          }
        }
        if (stunFrames > 0) {
          stateOnHit = { stateNameOrId: 'stun', durationFrames: stunFrames, nonBossOnly: true }
        }
        break
      }
      // 8: MISSMODE_SrvDmg08_EruptionCrackOverlay (0x6FC58FF0, erruption crack 1/2)
      case 8: {
        if ((packet.elemMax256 ?? 0) === 0) {
          const rowElem = this.evaluateMissileRowElemDamage256(
            m,
            rec,
            rec.eMin === 0 && rec.eMax === 0,
          )
          if (rowElem.max256 > 0) {
            packet = {
              ...packet,
              attackKind: 'spell',
              elemType: (rec.eType as SUnitDmgPacket['elemType']) || skill?.eType as SUnitDmgPacket['elemType'] || 'fire',
              elemMin256: rowElem.min256,
              elemMax256: rowElem.max256,
              autoHit: true,
              unblockable: true,
            }
          }
        }
        break
      }
      // 9: MISSMODE_SrvDmg09_TwisterStun (0x6FC59560, twister #477: dParam1 > 0 ? dParam1 : skill.param2)
      case 9: {
        const stunFrames = rec.dParam1 > 0 ? rec.dParam1 : (skill?.param2 ?? 0)
        if (stunFrames > 0) {
          stateOnHit = { stateNameOrId: 'stun', durationFrames: stunFrames, nonBossOnly: true }
        }
        break
      }
      // 11: MISSMODE_SrvDmg11_RabiesContagion (0x6FC59BD0, rabiescontagion #516)
      case 11: {
        if ((packet.elemMax256 ?? 0) === 0) {
          const rowElem = this.evaluateMissileRowElemDamage256(
            m,
            rec,
            rec.eMin === 0 && rec.eMax === 0,
          )
          const dur = baseElemDuration > 0 ? baseElemDuration : Math.max(1, m.maxRangeTicks - m.ageTicks)
          if (rowElem.max256 > 0) {
            packet = {
              ...packet,
              attackKind: 'spell',
              elemType: 'pois',
              elemMin256: rowElem.min256,
              elemMax256: rowElem.max256,
              elemDurationFrames: dur,
              autoHit: true,
              unblockable: true,
              canTriggerProcs: false,
            }
          }
        }
        break
      }
      // 14: MISSMODE_SrvDmg14_MoltenBoulderKnockback (0x6FC59A40, moltenboulder: dParam1 > 0)
      case 14: {
        if (rec.dParam1 > 0) {
          knockbackNonLargeBoss = true
        }
        break
      }
      default:
        break
    }

    const hitSubRec = rec.hitSubMissile1 ? this.registry.getMissileByName(rec.hitSubMissile1) : undefined
    if (
      (rec.pSrvHitFunc === 13 || rec.eType === 'frze' || hitSubRec?.eType === 'frze') &&
      baseElemDuration > 0
    ) {
      stateOnHit = { stateNameOrId: 'freeze', durationFrames: baseElemDuration }
    }

    return {
      packet,
      ...(stateOnHit !== undefined ? { stateOnHit } : {}),
      ...(knockbackNonLargeBoss ? { knockbackNonLargeBoss: true } : {}),
    }
  }

  /**
   * 1.13c `gpMissileSrvHitFnTable` (`D2Game.dll` `0x6FD2DA48`, entries `0..64`) + `MISSILES_SrvHitDispatch` (`0x6FC5EDE0`).
   * Dispatches strictly by `m.record.pSrvHitFunc`.
   *
   * Returns:
   * - `'pierce'`: force-pierce without consuming Amazon `Pierce` (e.g. `pSrvHitFunc = 8` Blaze/Fire Wall, or `pSrvHitFunc = 47` Molten Boulder on non-large/non-boss)
   * - `'expire'`: force-expire missile immediately (e.g. `pSrvHitFunc = 47` Molten Boulder on large/boss, `pSrvHitFunc = 7` Holy Bolt, range expiry)
   * - `'default'`: proceed to standard `MISSILES_SrvHitDispatch` (`0x6FC5EDE0`) `Pierce` & `CollideKill` resolution
   */
  private dispatchSrvHit(
    m: ActiveMissile,
    hitTarget: CombatUnitContext | undefined,
    impactX: number,
    impactY: number,
    ctx: {
      currentTick: number
      targets: readonly CombatUnitContext[]
      targetPositions: ReadonlyMap<string, { x: number; y: number }>
      collision?: MissileTerrainCollision | undefined
      hits: Array<{ missileName: string; targetId: string; damage: number; immune: boolean }>
      subMissilesSpawned: string[]
      trigger: 'unit' | 'wall' | 'expire'
      dmgSuccess?: boolean | undefined
    },
  ): 'default' | 'pierce' | 'expire' {
    const rec = m.record
    const fnId = rec.pSrvHitFunc
    const entry = MISSILE_SRV_HIT_TABLE_113C[fnId] ?? MISSILE_SRV_HIT_TABLE_113C[0]!
    if (!entry) return 'default'

    // On range expiry without AlwaysExplode, only expiration-capable pSrvHitFunc handlers run in 1.13c (0x6FC5EDE0).
    if (
      ctx.trigger === 'expire' &&
      !rec.alwaysExplode &&
      fnId !== 2 &&
      fnId !== 3 &&
      fnId !== 4 &&
      fnId !== 9 &&
      fnId !== 14 &&
      fnId !== 20 &&
      fnId !== 22 &&
      fnId !== 23 &&
      fnId !== 29 &&
      fnId !== 30 &&
      fnId !== 31 &&
      fnId !== 32 &&
      fnId !== 34 &&
      fnId !== 36 &&
      fnId !== 37 &&
      fnId !== 42 &&
      fnId !== 43 &&
      fnId !== 44 &&
      fnId !== 47 &&
      fnId !== 48 &&
      fnId !== 56 &&
      fnId !== 59
    ) {
      return 'expire'
    }

    switch (fnId) {
      // 1: MISSMODE_SrvHit01_FireBallRadialSplash (0x6FC5B990, fireball #62 / #513, sHitPar1=4)
      case 1: {
        const splashRadius = this.resolveSrvHitRadiusPx(m, 'calc1', { fallbackSubtiles: 4 })
        for (const other of ctx.targets) {
          if (other.id === hitTarget?.id || other.statList.getHp256() <= 0) continue
          if (!areUnitsEnemies113c(m.owner, other)) continue
          const oPos = this.resolveUnitPosition(other, ctx.targetPositions)
          if (!oPos) continue
          if (
            Math.hypot(oPos.x - impactX, (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO) <=
            splashRadius
          ) {
            const splashOut = executeSUnitDmg(m.owner, other, m.dmgPacket, m.doFuncRng ?? this.rng)
            ctx.hits.push({
              missileName: `${m.name}:splash`,
              targetId: other.id,
              damage: splashOut.totalDamage,
              immune: splashOut.immuneToElem || splashOut.immuneToPhys,
            })
          }
        }
        const expName = rec.explosionMissile
        if (expName) {
          this.spawnMissile({
            missileNameOrId: expName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: undefined,
          })
          ctx.subMissilesSpawned.push(expName)
        }
        return 'default'
      }

      // 18: MISSMODE_SrvHit18_ShoutWarCryState (0x6FC5EA60: shout #149, battlecommand #236, battleorders #237)
      // Pure friendly party/ally/minion warcry buff ring; never deals enemy splash damage and pierces continuously.
      case 18:
        return 'pierce'

      // 2: MISSMODE_SrvHit02_PlagueJavelin (0x6FC5E330, plaguejavelin #43)
      case 2: {
        this.triggerPlagueJavelinBurst({
          missile: m,
          impactX,
          impactY,
          targets: ctx.targets,
          targetPositions: ctx.targetPositions,
          hits: ctx.hits,
          subMissilesSpawned: ctx.subMissilesSpawned,
          excludeTargetId: hitTarget?.id,
        })
        return 'default'
      }

      // 3: MISSMODE_SrvHit03_PotionFireSplash (0x6FC5BB60, explosivepotion #45 / oilpotion #44 / fulminatingpotion #46)
      case 3: {
        const splashRadius = this.resolveSrvHitRadiusPx(m, 'auraRangeCalc', { fallbackSubtiles: 3 })
        for (const other of ctx.targets) {
          if (other.id === hitTarget?.id || other.statList.getHp256() <= 0) continue
          if (!areUnitsEnemies113c(m.owner, other)) continue
          const oPos = this.resolveUnitPosition(other, ctx.targetPositions)
          if (!oPos) continue
          if (
            Math.hypot(oPos.x - impactX, (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO) <=
            splashRadius
          ) {
            const splashOut = executeSUnitDmg(m.owner, other, m.dmgPacket, m.doFuncRng ?? this.rng)
            ctx.hits.push({
              missileName: `${m.name}:splash`,
              targetId: other.id,
              damage: splashOut.totalDamage,
              immune: splashOut.immuneToElem || splashOut.immuneToPhys,
            })
          }
        }
        const subCloud = rec.explosionMissile || rec.hitSubMissile1
        if (subCloud) {
          this.spawnMissile({
            missileNameOrId: subCloud,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: m.dmgPacket,
          })
          ctx.subMissilesSpawned.push(subCloud)
        }
        return 'default'
      }

      // 4: MISSMODE_SrvHit04_SubMissileExplosionTrigger (0x6FC5F220, explodingarrow #41 / freezingarrow #87 / royalstrikemeteorcenter #564)
      // 9: MISSMODE_SrvHit09_ImmolationArrow (0x6FC5E0B0, immolationarrow #85)
      case 4:
      case 9: {
        if (fnId === 4 && rec.sHitPar1 > 0 && rec.hitSubMissile1) {
          // 1.13c D2Game.dll MISSMODE_SrvHit04 (0x6FC5F220..0x6FC5F2EF):
          // royalstrikemeteorcenter (#564, Range=26, sHitPar1=1) spawns HitSubMissile1 = royalstrikemeteor (#563)
          // and immediately dispatches its pSrvHitFunc = 14 (MISSMODE_SrvHit14_MeteorCenter @ 0x6FC5DEF0).
          const subRec = this.registry.getMissileByName(rec.hitSubMissile1)
          const rowElem = subRec ? this.evaluateMissileRowElemDamage256(m, subRec) : undefined
          const subPacket: SUnitDmgPacket =
            rowElem && rowElem.max256 > 0
              ? {
                  skillId: m.sourceSkillId,
                  slvl: m.slvl,
                  attackKind: 'spell',
                  srcDam: 0,
                  elemType: (subRec?.eType as SUnitDmgPacket['elemType']) || 'fire',
                  elemMin256: rowElem.min256,
                  elemMax256: rowElem.max256,
                  autoHit: true,
                  unblockable: true,
                  canTriggerProcs: false,
                }
              : m.dmgPacket
          const subM = this.spawnMissile({
            missileNameOrId: rec.hitSubMissile1,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: subPacket,
          })
          ctx.subMissilesSpawned.push(rec.hitSubMissile1)
          if (subM && rec.sHitPar1 > 0) {
            this.dispatchSrvHit(subM, hitTarget, impactX, impactY, ctx)
            subM.expired = true
          }
          return 'expire'
        }
        this.triggerBowExplosionAoE({
          missile: m,
          impactX,
          impactY,
          targets: ctx.targets,
          targetPositions: ctx.targetPositions,
          hits: ctx.hits,
          subMissilesSpawned: ctx.subMissilesSpawned,
          excludeTargetId: hitTarget?.id,
        })
        return 'default'
      }

      // 5: MISSMODE_SrvHit05_MonsterRancidGasPotion (0x6FC5C700)
      case 5: {
        const subName = rec.hitSubMissile1
        if (subName) {
          const ringCount = Math.max(1, rec.sHitPar1 || 8)
          const ringRadiusPx = Math.max(1, rec.sHitPar2 || 2) * MISSILE_SUBTILE_FLAT_PX
          for (let i = 0; i < ringCount; i += 1) {
            const theta = (i * Math.PI * 2) / ringCount
            const cx = impactX + Math.cos(theta) * ringRadiusPx
            const cy = impactY + Math.sin(theta) * ringRadiusPx * ISO_GROUND_ASPECT_RATIO
            this.spawnMissile({
              missileNameOrId: subName,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: impactX,
              startY: impactY,
              targetX: cx,
              targetY: cy,
              dmgPacket: m.dmgPacket,
            })
            ctx.subMissilesSpawned.push(subName)
          }
        }
        return 'default'
      }

      // 6: MISSMODE_SrvHit06_GrimWardCreate (0x6FC5BD10)
      case 6:
        return 'default'

      // 7: MISSMODE_SrvHit07_HolyBolt (0x6FC59FD0, holybolt #55 / fistoftheheavensbolt #234)
      case 7:
        return 'expire'

      // 8: MISSMODE_SrvHit08_BlazeFirestormPersist (0x6FC59F70, blaze / firewall continuous patch)
      case 8:
        return 'pierce'

      // 10: MISSMODE_SrvHit10_GuidedArrow_BoneSpirit (0x6FC5B140, guidedarrow #42 / bonespirit #107)
      case 10:
        return 'default'

      // 11: MISSMODE_SrvHit11_CreateMonFromMissile (0x6FC5F120)
      case 11: {
        const subName = rec.hitSubMissile1
        if (subName) {
          this.spawnMissile({
            missileNameOrId: subName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: m.dmgPacket,
          })
          ctx.subMissilesSpawned.push(subName)
        }
        return 'default'
      }

      // 12: MISSMODE_SrvHit12_ChainLightning (0x6FC5D020, chainlightning #93 / lightningstrike #232 / chainlightning2 #267)
      case 12: {
        if (m.chainRemaining > 0 && hitTarget !== undefined) {
          const searchRadiusPx = this.resolveSrvHitRadiusPx(m, 'auraRangeCalc', {
            fallbackSubtiles: 20,
          })
          let nearestEnemy: CombatUnitContext | undefined
          let nearestDist = Infinity
          let nearestPos: { x: number; y: number } | undefined

          for (const other of ctx.targets) {
            if (other.id === hitTarget.id) continue
            if (other.statList.getHp256() <= 0) continue
            if (!areUnitsEnemies113c(m.owner, other)) continue
            if (this.isTargetInJustHit(other, ctx.currentTick)) continue
            const oPos = this.resolveUnitPosition(other, ctx.targetPositions)
            if (!oPos) continue
            const d = Math.hypot(
              oPos.x - impactX,
              (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO,
            )
            if (d <= searchRadiusPx && d < nearestDist) {
              nearestDist = d
              nearestEnemy = other
              nearestPos = oPos
            }
          }

          if (nearestEnemy && nearestPos) {
            this.spawnMissile({
              missileNameOrId: m.name,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: impactX,
              startY: impactY,
              targetX: nearestPos.x,
              targetY: nearestPos.y,
              dmgPacket: m.dmgPacket,
              chainCount: m.chainRemaining - 1,
              lastHitTargetId: hitTarget.id,
            })
            ctx.subMissilesSpawned.push(m.name)
          }
        }
        if (rec.explosionMissile) {
          this.spawnMissile({
            missileNameOrId: rec.explosionMissile,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: undefined,
          })
          ctx.subMissilesSpawned.push(rec.explosionMissile)
        }
        return 'default'
      }

      // 13: MISSMODE_SrvHit13_GlacialSpike (0x6FC5B3E0, glacialspike #96)
      // - Radius: sHitPar1 > 0 ? sHitPar1 : evalSkillCalc(skill.auraRangeCalc) (4 subtiles = 80px)
      // - Freeze length: sHitPar2 > 0 ? sHitPar2 : SKILLS_GetElementalLength(pOwner, skillId, slvl, 1) (auraLenCalc on #55 Glacial Spike)
      case 13: {
        const splashRadius = this.resolveSrvHitRadiusPx(m, 'auraRangeCalc', { fallbackSubtiles: 4 })
        const frzFrames =
          rec.sHitPar2 > 0
            ? rec.sHitPar2
            : (m.dmgPacket.elemDurationFrames ?? this.resolveMissileElemDurationFrames(m))

        for (const other of ctx.targets) {
          if (other.id === hitTarget?.id || other.statList.getHp256() <= 0) continue
          if (!areUnitsEnemies113c(m.owner, other)) continue
          const oPos = this.resolveUnitPosition(other, ctx.targetPositions)
          if (!oPos) continue
          if (
            Math.hypot(oPos.x - impactX, (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO) <=
            splashRadius
          ) {
            const splashOut = executeSUnitDmg(m.owner, other, m.dmgPacket, m.doFuncRng ?? this.rng)
            ctx.hits.push({
              missileName: `${m.name}:splash`,
              targetId: other.id,
              damage: splashOut.totalDamage,
              immune: splashOut.immuneToElem || splashOut.immuneToPhys,
            })
            if (
              !splashOut.immuneToElem &&
              !other.statList.getAccruedStat('item_cannotbefrozen') &&
              frzFrames > 0
            ) {
              other.stateBus.applyState({
                stateNameOrId: 'freeze',
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                durationFrames: frzFrames,
              })
            }
          }
        }

        const exp1 = rec.cltHitSubMissile1
        if (exp1) {
          this.spawnMissile({
            missileNameOrId: exp1,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: undefined,
          })
          ctx.subMissilesSpawned.push(exp1)
        }
        const exp2 = rec.cltHitSubMissile2
        if (exp2) {
          this.spawnMissile({
            missileNameOrId: exp2,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: undefined,
          })
          ctx.subMissilesSpawned.push(exp2)
        }
        return 'default'
      }

      // 14: MISSMODE_SrvHit14_MeteorCenter (0x6FC5DEF0, meteorcenter #101 / royalstrikemeteor #563)
      case 14: {
        if (m.currentHitFrame && m.currentHitFrame > 0) return 'expire'
        m.currentHitFrame = 1

        const blastRadius = this.resolveSrvHitRadiusPx(m, 'auraRangeCalc', { fallbackSubtiles: 6 })
        const hitName = rec.explosionMissile || rec.cltHitSubMissile1 || m.name
        let impactPacket = m.dmgPacket
        if ((impactPacket.elemMax256 ?? 0) === 0 && (rec.eMin > 0 || rec.eMax > 0)) {
          const selfRowElem = this.evaluateMissileRowElemDamage256(m, rec)
          if (selfRowElem.max256 > 0) {
            impactPacket = {
              ...impactPacket,
              skillId: m.sourceSkillId,
              slvl: m.slvl,
              attackKind: 'spell',
              srcDam: 0,
              elemType: (rec.eType as SUnitDmgPacket['elemType']) || 'fire',
              elemMin256: selfRowElem.min256,
              elemMax256: selfRowElem.max256,
              autoHit: true,
              unblockable: true,
            }
          }
        }
        for (const target of ctx.targets) {
          if (target.statList.getHp256() <= 0) continue
          if (!areUnitsEnemies113c(m.owner, target)) continue
          const pos = this.resolveUnitPosition(target, ctx.targetPositions)
          if (!pos) continue
          const inRange =
            Math.hypot(pos.x - impactX, (pos.y - impactY) / ISO_GROUND_ASPECT_RATIO) <= blastRadius
          if (inRange) {
            const dmgOut = executeSUnitDmg(m.owner, target, impactPacket, m.doFuncRng ?? this.rng)
            ctx.hits.push({
              missileName: hitName,
              targetId: target.id,
              damage: dmgOut.totalDamage,
              immune: dmgOut.immuneToElem || dmgOut.immuneToPhys,
            })
          }
        }

        const expName = rec.explosionMissile
        if (expName) {
          this.spawnMissile({
            missileNameOrId: expName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: impactPacket,
          })
          ctx.subMissilesSpawned.push(expName)
        }

        const subFireName = rec.hitSubMissile1
        if (subFireName) {
          const skill = this.resolveMissileSkillRecord(m)
          let fireDuration = 90 + (Math.max(1, m.slvl) - 1) * 15
          if (skill && skill.calc1.trim().length > 0) {
            const evalDur = evaluateCalc(skill.calc1, {
              registry: this.registry,
              activeSkill: skill,
              activeMissile: rec,
              slvl: m.slvl,
              blvl: m.slvl,
              getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
            })
            if (evalDur > 0) fireDuration = evalDur
          } else if (skill && (skill.param3 > 0 || skill.param4 > 0)) {
            // 1.13c D2Game.dll MISSMODE_SrvHit14 (0x6FC5E072) -> SKILLS_GetParam34Linear (0x6FC21A40): Param3 + (slvl - 1) * Param4
            fireDuration = skill.param3 + (Math.max(1, m.slvl) - 1) * skill.param4
          }
          const subFireRec = this.registry.getMissileByName(subFireName)
          const rowElem = subFireRec
            ? this.evaluateMissileRowElemDamage256(m, subFireRec)
            : undefined
          const fireDmg = calculateMeteorResidualFireDamage(m.slvl)
          const fireDmgPacket: SUnitDmgPacket = {
            skillId: m.sourceSkillId,
            slvl: m.slvl,
            attackKind: 'spell',
            elemType: 'fire',
            elemMin256: rowElem && rowElem.max256 > 0 ? rowElem.min256 : fireDmg.min * 8,
            elemMax256: rowElem && rowElem.max256 > 0 ? rowElem.max256 : fireDmg.max * 8,
            autoHit: true,
            unblockable: true,
            isPersistentGroundFire: true,
            noHitRecovery: true,
            canTriggerProcs: false,
            frameRate1024: subFireRec && subFireRec.damageRate > 0 ? subFireRec.damageRate : 41,
          }
          const effectiveTerrain = ctx.collision ?? this.terrain
          const step = Math.max(1, rec.sHitPar2 || 1)
          for (let i = 0; i < METEOR_FIRE_SUBTILE_OFFSETS.length; i += step) {
            const off = METEOR_FIRE_SUBTILE_OFFSETS[i]!
            const fx = impactX + off.x * 20
            const fy = impactY + off.y * 10
            if (effectiveTerrain !== undefined) {
              const blocked =
                effectiveTerrain.isMissileBlocked !== undefined
                  ? effectiveTerrain.isMissileBlocked(fx, fy, impactX, impactY)
                  : effectiveTerrain.overlap !== undefined && effectiveTerrain.overlap(fx, fy) > 0
              if (blocked) {
                continue
              }
            }
            this.spawnMissile({
              missileNameOrId: subFireName,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: fx,
              startY: fy,
              targetX: fx,
              targetY: fy,
              dmgPacket: fireDmgPacket,
              maxRangeTicks: fireDuration,
            })
            ctx.subMissilesSpawned.push(subFireName)
          }
        }
        return 'expire'
      }

      // 15: MISSMODE_SrvHit15_SpiderGooLay (0x6FC5CDD0, spidergoolay #109)
      case 15: {
        const subName = rec.hitSubMissile1
        if (subName) {
          this.spawnMissile({
            missileNameOrId: subName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: m.dmgPacket,
          })
          ctx.subMissilesSpawned.push(subName)
        }
        return 'default'
      }

      // 16: MISSMODE_SrvHit16_SpiderGooSlow (0x6FC5EC10: spidergoo #108, vines trail #483, vines wither #485)
      case 16: {
        if (ctx.trigger === 'unit' && hitTarget !== undefined && areUnitsEnemies113c(m.owner, hitTarget)) {
          const slowPct = Math.max(25, rec.sHitPar1 || 25)
          const slowFrames = Math.max(25, rec.sHitPar2 || 100)
          hitTarget.stateBus.applyState({
            stateNameOrId: 'slow',
            sourceUnitId: m.owner.id,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            durationFrames: slowFrames,
            currentFrame: ctx.currentTick,
            stats: { item_slow: slowPct },
          })
        }
        return 'default'
      }

      // 17: MISSMODE_SrvHit17_HowlFlee (0x6FC5EAE0: howl #148)
      // 28: MISSMODE_SrvHit28_GrimWardScare (0x6FC5EC80: grimwardscare #259)
      case 17:
      case 28: {
        const subName = rec.hitSubMissile1
        if (subName) {
          this.spawnMissile({
            missileNameOrId: subName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: undefined,
          })
          ctx.subMissilesSpawned.push(subName)
        }
        return 'pierce'
      }

      // 19: MISSMODE_SrvHit19_FingerMageSpiderHit (0x6FC5C150: fingermagespider #181)
      // 55: MISSMODE_SrvHit55_BaalInfernoManaDrain (0x6FC5EE60: baal inferno #558)
      case 19:
      case 55: {
        if (ctx.trigger === 'unit' && hitTarget !== undefined && areUnitsEnemies113c(m.owner, hitTarget)) {
          const curMana256 = hitTarget.statList.getMana256()
          if (curMana256 > 0) {
            const drain256 =
              fnId === 55
                ? Math.max(256, Math.trunc(curMana256 / 8))
                : Math.max(512, Math.trunc(curMana256 / 4))
            hitTarget.statList.setMana256(Math.max(0, curMana256 - drain256))
          }
        }
        return fnId === 55 ? 'pierce' : 'default'
      }

      // 20: MISSMODE_SrvHit20_LightningFury (0x6FC5DD60, lightningfury #228)
      case 20: {
        this.triggerLightningFuryBolts({
          missile: m,
          impactX,
          impactY,
          targets: ctx.targets,
          targetPositions: ctx.targetPositions,
          subMissilesSpawned: ctx.subMissilesSpawned,
          excludeTargetId: hitTarget?.id,
        })
        return 'default'
      }

      // 21: MISSMODE_SrvHit21_BattleCryDebuff (0x6FC5CE90: battlecry #219)
      case 21:
        return 'pierce'

      // 22: MISSMODE_SrvHit22_FistOfTheHeavensDelay (0x6FC5DB30, fistoftheheavensdelay #233)
      // 23: MISSMODE_SrvHit23_MissileSkillCast (0x6FC59DA0)
      // On impact/expiry, deals primary lightning strike to closest target at impact point (if not already hit),
      // then scans enemies within sHitPar1 > 0 ? sHitPar1 : evalSkillCalc(skill.auraRangeCalc)
      // and spawns HitSubMissile1 ('fistoftheheavensbolt' #234) toward each surrounding enemy.
      case 22:
      case 23: {
        if (m.currentHitFrame && m.currentHitFrame > 0) return 'expire'
        m.currentHitFrame = 1

        let excludeId = hitTarget?.id
        if (
          excludeId === undefined &&
          ((m.dmgPacket.elemMin256 ?? 0) > 0 || (m.dmgPacket.elemMax256 ?? 0) > 0)
        ) {
          let closestPrimary: CombatUnitContext | undefined
          let closestPrimaryDist = Infinity
          for (const target of ctx.targets) {
            if (target.statList.getHp256() <= 0) continue
            if (!areUnitsEnemies113c(m.owner, target)) continue
            const pos = this.resolveUnitPosition(target, ctx.targetPositions)
            if (!pos) continue
            const d = Math.hypot(
              pos.x - impactX,
              (pos.y - impactY) / ISO_GROUND_ASPECT_RATIO,
            )
            if (d <= 40 && d < closestPrimaryDist) {
              closestPrimaryDist = d
              closestPrimary = target
            }
          }
          if (closestPrimary) {
            const primaryOut = executeSUnitDmg(
              m.owner,
              closestPrimary,
              m.dmgPacket,
              m.doFuncRng ?? this.rng,
            )
            ctx.hits.push({
              missileName: m.name,
              targetId: closestPrimary.id,
              damage: primaryOut.totalDamage,
              immune: primaryOut.immuneToElem || primaryOut.immuneToPhys,
            })
            excludeId = closestPrimary.id
          }
        }

        const subBolt = rec.hitSubMissile1
        if (subBolt) {
          const subBoltRec = this.registry.getMissileByName(subBolt)
          const rowElem = subBoltRec
            ? this.evaluateMissileRowElemDamage256(m, subBoltRec)
            : undefined
          const fohSearchRadiusPx = this.resolveSrvHitRadiusPx(m, 'auraRangeCalc', {
            fallbackSubtiles: 20,
          })
          const fohBoltPacket: SUnitDmgPacket = {
            skillId: m.sourceSkillId,
            slvl: m.slvl,
            attackKind: 'spell',
            srcDam: 0,
            elemType: (subBoltRec?.eType as SUnitDmgPacket['elemType']) || 'mag',
            elemMin256: rowElem ? rowElem.min256 : 0,
            elemMax256: rowElem ? rowElem.max256 : 0,
            bypassUndeadMagicRes: true,
            autoHit: true,
            unblockable: true,
            canTriggerProcs: false,
          }
          for (const other of ctx.targets) {
            if (other.id === excludeId || other.statList.getHp256() <= 0) continue
            if (!areUnitsEnemies113c(m.owner, other)) continue
            const oPos = this.resolveUnitPosition(other, ctx.targetPositions)
            if (!oPos) continue
            const dist = Math.hypot(
              oPos.x - impactX,
              (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO,
            )
            if (dist <= fohSearchRadiusPx) {
              this.spawnMissile({
                missileNameOrId: subBolt,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: impactX,
                startY: impactY,
                targetX: oPos.x,
                targetY: oPos.y,
                dmgPacket: fohBoltPacket,
              })
              ctx.subMissilesSpawned.push(subBolt)
            }
          }
        }
        return 'expire'
      }

      // 24..27: PantherPotions (#240..#243) & GrimWard (#257..#258) sub-missile spawn
      case 24:
      case 25:
      case 26:
      case 27: {
        const subName = rec.hitSubMissile1
        if (subName) {
          const count = Math.max(1, rec.sHitPar1 || 1)
          if (count === 1) {
            this.spawnMissile({
              missileNameOrId: subName,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: impactX,
              startY: impactY,
              targetX: impactX,
              targetY: impactY,
              dmgPacket: m.dmgPacket,
            })
            ctx.subMissilesSpawned.push(subName)
          } else {
            for (let i = 0; i < count; i += 1) {
              const theta = (i * Math.PI * 2) / count
              this.spawnMissile({
                missileNameOrId: subName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: impactX,
                startY: impactY,
                targetX: impactX + Math.cos(theta) * 60,
                targetY: impactY + Math.sin(theta) * 60 * ISO_GROUND_ASPECT_RATIO,
                dmgPacket: m.dmgPacket,
                angleRad: theta,
                isoGroundForeshorten: true,
              })
              ctx.subMissilesSpawned.push(subName)
            }
          }
        }
        return 'default'
      }

      // 29: MISSMODE_SrvHit29_FrozenOrb (0x6FC5C850, frozenorb #260)
      // - Triggers only on first frame of hit (currentHitFrame === 0)
      // - Loop with step sHitPar1 = 4 over 64 directions -> 16 frozenorbnova missiles
      // - Stores (FROZEN_ORB_X_POSITIONS[i], FROZEN_ORB_Y_POSITIONS[i]) via MISSILE_SetTargetX/Y (0x6FC2A50E/0x6FC2AF5E)
      case 29: {
        if (m.currentHitFrame && m.currentHitFrame > 0) return 'expire'
        m.currentHitFrame = 1
        const subName = rec.hitSubMissile1
        if (subName) {
          const step = Math.max(1, rec.sHitPar1 || 4)
          for (let i = 0; i < 64; i += step) {
            const rawOffX = FROZEN_ORB_X_POSITIONS[i]!
            const rawOffY = FROZEN_ORB_Y_POSITIONS[i]!
            const offX = rawOffX
            const offY = rawOffY * ISO_GROUND_ASPECT_RATIO
            const sub = this.spawnMissile({
              missileNameOrId: subName,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: impactX,
              startY: impactY,
              targetX: impactX + offX * 10,
              targetY: impactY + offY * 10,
              dmgPacket: m.dmgPacket,
            })
            if (sub) {
              sub.targetOffsetX = rawOffX
              sub.targetOffsetY = rawOffY
            }
            ctx.subMissilesSpawned.push(subName)
          }
        }
        const explosionName = rec.explosionMissile
        if (explosionName) {
          this.spawnMissile({
            missileNameOrId: explosionName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: m.dmgPacket,
          })
          ctx.subMissilesSpawned.push(explosionName)
        }
        return 'expire'
      }

      // 30, 34, 42, 46: null (0x00000000 in gpMissileSrvHitFnTable)
      case 30:
      case 34:
      case 42:
      case 46:
        return 'default'

      // 31: MISSMODE_SrvHit31_Firehead (0x6FC5A920: firehead #277 / #333 VampireMissile 100% life steal, #2007)
      case 31: {
        if (ctx.trigger === 'unit' && hitTarget !== undefined && ctx.dmgSuccess !== false) {
          const lastHit = ctx.hits[ctx.hits.length - 1]
          const dealt256 =
            lastHit !== undefined && lastHit.targetId === hitTarget.id && lastHit.damage > 0
              ? Math.round(lastHit.damage * 256)
              : 0
          if (dealt256 > 0 && m.owner.statList.getHp256() > 0) {
            const maxHp256 = m.owner.statList.getAccruedStat('maxhp')
            const curHp256 = m.owner.statList.getHp256()
            m.owner.statList.setHp256(
              maxHp256 > 0 ? Math.min(maxHp256, curHp256 + dealt256) : curHp256 + dealt256,
            )
          }
        }
        return 'default'
      }

      // 32: MISSMODE_SrvHit32_CairnStones (0x6FC5BE70)
      case 32: {
        const subName = rec.hitSubMissile1
        if (subName) {
          const count = Math.max(1, rec.sHitPar2 || 8)
          for (let i = 0; i < count; i += 1) {
            const theta = (i * Math.PI * 2) / count
            this.spawnMissile({
              missileNameOrId: subName,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: impactX,
              startY: impactY,
              targetX: impactX + Math.cos(theta) * 80,
              targetY: impactY + Math.sin(theta) * 80 * ISO_GROUND_ASPECT_RATIO,
              dmgPacket: m.dmgPacket,
              angleRad: theta,
              isoGroundForeshorten: true,
            })
            ctx.subMissilesSpawned.push(subName)
          }
        }
        return 'default'
      }

      // 36: MISSMODE_SrvHit36_BombInAirGroundSpawn (0x6FC5AB30: shockfieldinair #305 -> shockfieldonground #306)
      // 38: MISSMODE_SrvHit38_CatapultChargedBall (0x6FC5CD30)
      // 40: MISSMODE_SrvHit40_CatapultPlagueBall (0x6FC5CA20)
      // 58: MISSMODE_SrvHit58_BaalTauntLightningControl (0x6FC5D620)
      // 59: MISSMODE_SrvHit59_BaalTauntPoisonControl (0x6FC5D800)
      case 36:
      case 38:
      case 40:
      case 58:
      case 59: {
        for (const subCol of [rec.hitSubMissile1, rec.hitSubMissile2, rec.explosionMissile]) {
          if (!subCol) continue
          const subRec = this.registry.getMissileByName(subCol)
          const rowElem = subRec
            ? this.evaluateMissileRowElemDamage256(m, subRec)
            : undefined
          const subPacket: SUnitDmgPacket =
            rowElem && rowElem.max256 > 0
              ? {
                  skillId: m.sourceSkillId,
                  slvl: m.slvl,
                  attackKind: 'spell',
                  srcDam: 0,
                  elemType: (subRec?.eType as SUnitDmgPacket['elemType']) || 'fire',
                  elemMin256: rowElem.min256,
                  elemMax256: rowElem.max256,
                  autoHit: true,
                  unblockable: true,
                  canTriggerProcs: false,
                }
              : m.dmgPacket
          this.spawnMissile({
            missileNameOrId: subCol,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: subPacket,
          })
          ctx.subMissilesSpawned.push(subCol)
        }
        return 'expire'
      }

      // 37: MISSMODE_SrvHit37_BladeCreeperHit (0x6FC58E90: blade creeper #324)
      case 37:
        return 'pierce'

      // 43: MISSMODE_SrvHit43_HealingBoltFriendly (0x6FC59E30: healing vortex #425)
      case 43:
        return 'expire'

      // 44: MISSMODE_SrvHit44_JavelinArmageddonSplash (0x6FC5B5F0, explodingjavalin #429 / armageddonrock #476)
      // 56: MISSMODE_SrvHit56_ArmageddonControl (0x6FC5B210, armageddoncontrol #577)
      case 44:
      case 56: {
        const splashRadius = this.resolveSrvHitRadiusPx(m, 'auraRangeCalc', {
          fallbackSubtiles: fnId === 56 ? 3 : 2,
        })
        for (const other of ctx.targets) {
          if (other.id === hitTarget?.id || other.statList.getHp256() <= 0) continue
          if (!areUnitsEnemies113c(m.owner, other)) continue
          const oPos = this.resolveUnitPosition(other, ctx.targetPositions)
          if (!oPos) continue
          if (
            Math.hypot(oPos.x - impactX, (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO) <=
            splashRadius
          ) {
            const splashOut = executeSUnitDmg(m.owner, other, m.dmgPacket, m.doFuncRng ?? this.rng)
            ctx.hits.push({
              missileName: `${m.name}:splash`,
              targetId: other.id,
              damage: splashOut.totalDamage,
              immune: splashOut.immuneToElem || splashOut.immuneToPhys,
            })
          }
        }
        if (rec.explosionMissile) {
          this.spawnMissile({
            missileNameOrId: rec.explosionMissile,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: undefined,
          })
          ctx.subMissilesSpawned.push(rec.explosionMissile)
        }
        if (rec.hitSubMissile1) {
          this.spawnMissile({
            missileNameOrId: rec.hitSubMissile1,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: m.dmgPacket,
          })
          ctx.subMissilesSpawned.push(rec.hitSubMissile1)
        }
        return fnId === 56 ? 'expire' : 'default'
      }

      // 45: MISSMODE_SrvHit45_PlagueVinesDamage (0x6FC5C3B0: plague vines #484)
      // 50: MISSMODE_SrvHit50_VinesDamage (0x6FC591A0: vines #482)
      case 45:
      case 50: {
        const subName = rec.hitSubMissile1
        if (subName) {
          const count = Math.max(1, rec.sHitPar2 || rec.sHitPar1 || 1)
          if (count === 1) {
            this.spawnMissile({
              missileNameOrId: subName,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: impactX,
              startY: impactY,
              targetX: impactX,
              targetY: impactY,
              dmgPacket: m.dmgPacket,
            })
            ctx.subMissilesSpawned.push(subName)
          } else {
            for (let i = 0; i < count; i += 1) {
              const theta = (i * Math.PI * 2) / count
              this.spawnMissile({
                missileNameOrId: subName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: impactX,
                startY: impactY,
                targetX: impactX + Math.cos(theta) * 60,
                targetY: impactY + Math.sin(theta) * 60 * ISO_GROUND_ASPECT_RATIO,
                dmgPacket: m.dmgPacket,
                angleRad: theta,
                isoGroundForeshorten: true,
              })
              ctx.subMissilesSpawned.push(subName)
            }
          }
        }
        return 'default'
      }

      // 47: MISSMODE_SrvHit47_MoltenBoulderKnockbackExplode (0x6FC5D8C0, moltenboulder #452)
      // - Small/Medium non-boss targets: knockback + continue rolling ('pierce')
      // - Large (sizeX === 3) or Boss targets or wall/expiry: detonate AoE + spawn ExplosionMissile ('expire')
      case 47: {
        if (ctx.trigger === 'unit' && hitTarget !== undefined) {
          const isLargeOrBoss = Boolean(
            (hitTarget as { sizeX?: number }).sizeX === 3 ||
              hitTarget.isBoss ||
              hitTarget.rank === 'boss',
          )
          if (!isLargeOrBoss) {
            ;(hitTarget as { knockedBack?: boolean }).knockedBack = true
            m.pierceCount += 1
            return 'pierce'
          }
        }

        const splashRadiusPx = this.resolveSrvHitRadiusPx(m, 'auraRangeCalc', {
          fallbackSubtiles: 7,
        })
        for (const other of ctx.targets) {
          if (other.id === hitTarget?.id || other.statList.getHp256() <= 0) continue
          if (!areUnitsEnemies113c(m.owner, other)) continue
          const oPos = this.resolveUnitPosition(other, ctx.targetPositions)
          if (!oPos) continue
          if (
            Math.hypot(oPos.x - impactX, (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO) <=
            splashRadiusPx
          ) {
            const splashOut = executeSUnitDmg(m.owner, other, m.dmgPacket, m.doFuncRng ?? this.rng)
            ctx.hits.push({
              missileName: `${m.name}:explode`,
              targetId: other.id,
              damage: splashOut.totalDamage,
              immune: splashOut.immuneToElem || splashOut.immuneToPhys,
            })
          }
        }

        if (rec.explosionMissile) {
          this.spawnMissile({
            missileNameOrId: rec.explosionMissile,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: undefined,
          })
          ctx.subMissilesSpawned.push(rec.explosionMissile)
        }
        return 'expire'
      }

      // 48: MISSMODE_SrvHit48_MoltenBoulderEmerge (0x6FC5C260, moltenboulderemerge #453)
      // 52: MISSMODE_SrvHit52_BladeFuryShrapnel (0x6FC5C030, bladefury1..3 #496..#498)
      case 48:
      case 52: {
        for (const subCol of [rec.hitSubMissile1, rec.hitSubMissile2, rec.hitSubMissile3]) {
          if (!subCol) continue
          const subRec = this.registry.getMissileByName(subCol)
          const isVisualShrapnel =
            subRec !== undefined &&
            subRec.eMin === 0 &&
            subRec.eMax === 0 &&
            subRec.srcDamage === 0 &&
            subRec.pSrvHitFunc === 0 &&
            subRec.pSrvDmgFunc === 0
          this.spawnMissile({
            missileNameOrId: subCol,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: isVisualShrapnel ? undefined : m.dmgPacket,
          })
          ctx.subMissilesSpawned.push(subCol)
        }
        return 'default'
      }

      // 51: MISSMODE_SrvHit51_VolcanoDebrisFire (0x6FC5CF40: volcano debris 2 #461 -> volcano small fire #463)
      case 51: {
        const splashRadiusPx = this.resolveSrvHitRadiusPx(m, 'auraRangeCalc', {
          fallbackSubtiles: Math.max(2, rec.sHitPar1 || 2),
        })
        for (const other of ctx.targets) {
          if (other.id === hitTarget?.id || other.statList.getHp256() <= 0) continue
          if (!areUnitsEnemies113c(m.owner, other)) continue
          const oPos = this.resolveUnitPosition(other, ctx.targetPositions)
          if (!oPos) continue
          if (
            Math.hypot(oPos.x - impactX, (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO) <=
            splashRadiusPx
          ) {
            const splashOut = executeSUnitDmg(m.owner, other, m.dmgPacket, m.doFuncRng ?? this.rng)
            ctx.hits.push({
              missileName: `${m.name}:splash`,
              targetId: other.id,
              damage: splashOut.totalDamage,
              immune: splashOut.immuneToElem || splashOut.immuneToPhys,
            })
          }
        }
        if (rec.hitSubMissile1) {
          const subRec = this.registry.getMissileByName(rec.hitSubMissile1)
          const rowElem = subRec
            ? this.evaluateMissileRowElemDamage256(m, subRec, subRec.eMin === 0 && subRec.eMax === 0)
            : undefined
          const subPacket: SUnitDmgPacket =
            rowElem && rowElem.max256 > 0
              ? {
                  skillId: m.sourceSkillId,
                  slvl: m.slvl,
                  attackKind: 'spell',
                  srcDam: 0,
                  elemType: (subRec?.eType as SUnitDmgPacket['elemType']) || 'fire',
                  elemMin256: rowElem.min256,
                  elemMax256: rowElem.max256,
                  autoHit: true,
                  unblockable: true,
                  canTriggerProcs: false,
                }
              : m.dmgPacket
          this.spawnMissile({
            missileNameOrId: rec.hitSubMissile1,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: subPacket,
          })
          ctx.subMissilesSpawned.push(rec.hitSubMissile1)
        }
        return 'expire'
      }

      // 53: MISSMODE_SrvHit53_VineDeathPoison (0x6FC5F7D0)
      case 53: {
        const subName = rec.hitSubMissile1
        if (subName) {
          this.spawnMissile({
            missileNameOrId: subName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: impactX,
            startY: impactY,
            targetX: impactX,
            targetY: impactY,
            dmgPacket: m.dmgPacket,
          })
          ctx.subMissilesSpawned.push(subName)
        }
        return 'default'
      }

      default:
        return 'default'
    }
  }

  /**
   * Check if a target unit is currently within its `NextDelay` immunity period (`STATE_JUSTHIT = 86`).
   */
  isTargetInNextDelay(targetId: string, currentTick: number): boolean {
    const exp = this.nextDelayExpireByTarget.get(targetId)
    return exp !== undefined && exp > currentTick
  }

  /**
   * 1.13c D2Game.dll MISSILE_CheckNextHit (0x6FC5E590 / 0x6FC5EE80) + States.txt ID 86 (`justhit`):
   * Checks unit-global `STATE_JUSTHIT (86)` across ALL missile sources / engines, auto-expiring stale frames.
   */
  isTargetInJustHit(target: CombatUnitContext, currentTick: number): boolean {
    const st = target.stateBus.getState(86) ?? target.stateBus.getState('justhit')
    if (st) {
      if (st.expireFrame === 0 || st.expireFrame > currentTick) {
        return true
      }
      target.stateBus.removeState(86)
      target.stateBus.removeState('justhit')
    }
    return this.isTargetInNextDelay(target.id, currentTick)
  }

  /**
   * Applies unit-global `STATE_JUSTHIT (86)` for `durationFrames` (`NextDelay > 0`) on `target.stateBus`.
   */
  applyTargetJustHit(
    target: CombatUnitContext,
    ownerId: string,
    durationFrames: number,
    currentTick: number,
  ): void {
    if (durationFrames <= 0) return
    const newExpire = currentTick + durationFrames
    const prevMapExp = this.nextDelayExpireByTarget.get(target.id) ?? 0
    if (newExpire > prevMapExp) {
      this.nextDelayExpireByTarget.set(target.id, newExpire)
    }
    const existing = target.stateBus.getState(86) ?? target.stateBus.getState('justhit')
    if (existing) {
      if (existing.expireFrame === 0 || existing.expireFrame >= newExpire) {
        return
      }
      target.stateBus.removeState(86)
      target.stateBus.removeState('justhit')
    }
    target.stateBus.applyState({
      stateNameOrId: 86,
      sourceUnitId: ownerId,
      slvl: 1,
      durationFrames,
      currentFrame: currentTick,
    })
  }

  /**
   * Step all active missiles by 1 tick (`25 Hz`), resolving movement (`pSrvDoFunc`),
   * collisions (`pSrvHitFunc`), `NextDelay` gating, `Pierce`, and sub-missiles.
   */
  tick(
    currentTick: number = 0,
    targets: readonly CombatUnitContext[] = [],
    targetPositions: ReadonlyMap<string, { x: number; y: number }> = new Map(),
    collision?: MissileTerrainCollision,
  ): MissileStepResult {
    const hits: { missileName: string; targetId: string; damage: number; immune: boolean }[] = []
    const subMissilesSpawned: string[] = []

    for (const m of [...this.missiles]) {
      if (m.expired) continue
      m.ageTicks += 1

      if (m.altitude !== undefined) {
        m.altitude = Math.max(0, m.altitude - 25)
      }

      // 1. Dispatch 1.13c gMissileSrvDoFuncTable (D2Game.dll 0x6FD2D970, entries 0..37) by m.record.pSrvDoFunc
      if (
        this.dispatchSrvDo(m, {
          currentTick,
          targets,
          targetPositions,
          collision,
          hits,
          subMissilesSpawned,
        })
      ) {
        continue
      }

      // 2. 1.13c D2Common.dll PATH_StepVelocity (0x6FD5CEB0):
      // Step fixed-point velocity by Accel each frame; clamp to MaxVel<<8 when Accel > 0 or 0 when Accel < 0.
      const isStationaryRow =
        m.record.vel === 0 && m.record.pCltDoFunc !== 2 && m.record.pSrvDmgFunc !== 5
      if (!isStationaryRow && m.accel !== 0) {
        m.vel256 += m.accel
        if (m.accel > 0) {
          if (m.vel256 > m.maxVel256) {
            m.vel256 = m.maxVel256
          }
        } else if (m.vel256 < 0) {
          m.vel256 = 0
        }
        m.speed = m.vel256 / 256
        const foreshortenY = m.isoGroundForeshorten ? ISO_GROUND_ASPECT_RATIO : 1
        const curFlatVx = m.vx
        const curFlatVy = m.vy / foreshortenY
        const curFlatMag = Math.hypot(curFlatVx, curFlatVy)
        if (curFlatMag > 0) {
          const scale = m.speed / curFlatMag
          m.vx = curFlatVx * scale
          m.vy = curFlatVy * scale * foreshortenY
        } else {
          m.vx = Math.cos(m.angleRad) * m.speed
          m.vy = Math.sin(m.angleRad) * m.speed * foreshortenY
        }
      }

      const tickStartX = m.x
      const tickStartY = m.y

      // 3. Advance position via path mode + raycast against obstacle collision grid
      if (!isStationaryRow) {
        // Blessed Hammer spiral path mode (D2Common.dll 0x6FDA43F0, pCltDoFunc === 2 or pSrvDmgFunc === 5)
        if (m.record.pCltDoFunc === 2 || m.record.pSrvDmgFunc === 5) {
          const prevX = m.x
          const prevY = m.y
          const cx = m.originX ?? m.x
          const cy = m.originY ?? m.y
          m.spiralTheta = (m.spiralTheta ?? 0) + 0.16
          const theta = m.spiralTheta
          const r = Math.max(12, 13 * theta)
          m.x = cx + r * Math.cos(theta)
          m.y = cy + r * Math.sin(theta) * ISO_GROUND_ASPECT_RATIO
          const foreshortenY = m.isoGroundForeshorten ? ISO_GROUND_ASPECT_RATIO : 1
          m.vx = Math.cos(theta) * m.speed
          m.vy = Math.sin(theta) * m.speed * foreshortenY

          const collideEntry = getMissileCollideEntry113c(m.record.collideType)
          const terrainMask = collideEntry.terrainMask
          const effectiveTerrain = collision ?? this.terrain
          if (terrainMask !== 0 && effectiveTerrain !== undefined) {
            const rayPoints = stepMissileSubtileRay113c(
              prevX,
              prevY,
              m.x,
              m.y,
              MISSILE_SUBTILE_FLAT_PX,
            )
            let blocked = false
            let checkPrevX = prevX
            let checkPrevY = prevY
            for (let s = 1; s < rayPoints.length; s++) {
              const pt = rayPoints[s]!
              const isHit =
                effectiveTerrain.isMissileBlocked !== undefined
                  ? effectiveTerrain.isMissileBlocked(
                      pt.x,
                      pt.y,
                      checkPrevX,
                      checkPrevY,
                      terrainMask,
                    )
                  : effectiveTerrain.overlap !== undefined &&
                    effectiveTerrain.overlap(pt.x, pt.y) > 0
              if (isHit) {
                m.x = pt.x
                m.y = pt.y
                blocked = true
                break
              }
              checkPrevX = pt.x
              checkPrevY = pt.y
            }
            if (blocked) {
              this.dispatchSrvHit(m, undefined, m.x, m.y, {
                currentTick,
                targets,
                targetPositions,
                collision,
                hits,
                subMissilesSpawned,
                trigger: 'wall',
              })
              m.expired = true
              continue
            }
          }
        } else {
          const prevX = m.x
          const prevY = m.y

          // D2Common.dll path mode 6 (0x6FDA3E80): orthogonal lateral jitter for Charged Bolt / Twister / Vine rows
          const isChargedBoltJitter =
            m.record.id === 56 || m.record.id === 495 || m.record.pSrvDoFunc === 11 ||
            m.record.pCltDoFunc === 11 ||
            (m.record.pSrvDoFunc === 1 &&
              m.record.vel > 0 &&
              !m.record.pierce &&
              m.record.nextHit &&
              m.record.nextDelay === 0 &&
              m.record.eType === 'ltng')
          const isTwisterOrVineJitter =

            m.record.pSrvDmgFunc === 9 ||
            m.record.pSrvDoFunc === 23 ||
            m.record.pSrvDoFunc === 24 ||
            m.record.pSrvDoFunc === 27
          if (isChargedBoltJitter || isTwisterOrVineJitter) {
            const currentSpeed = Math.hypot(m.vx, m.vy)
            if (currentSpeed > 0.001) {
              const idx = m.jitterIndex ?? 0
              m.jitterIndex = (idx + 1) % 32
              const offsetVal = GAT_CHARGED_BOLT_OFFSETS[idx] ?? 0
              const angleOffset = offsetVal * (isChargedBoltJitter ? 0.14 : 0.18)
              const cosA = Math.cos(angleOffset)
              const sinA = Math.sin(angleOffset)
              const nvx = m.vx * cosA - m.vy * sinA
              const nvy = m.vx * sinA + m.vy * cosA
              const newLen = Math.hypot(nvx, nvy)
              if (newLen > 0.001) {
                m.vx = (nvx / newLen) * currentSpeed
                m.vy = (nvy / newLen) * currentSpeed
              }
            }
          }

          m.x += m.vx
          m.y += m.vy

          const collideEntry = getMissileCollideEntry113c(m.record.collideType)
          const terrainMask = collideEntry.terrainMask
          const effectiveTerrain = collision ?? this.terrain
          if (
            terrainMask !== 0 &&
            effectiveTerrain !== undefined &&
            (m.altitude === undefined || m.altitude <= 0)
          ) {
            const rayPoints = stepMissileSubtileRay113c(
              prevX,
              prevY,
              m.x,
              m.y,
              MISSILE_SUBTILE_FLAT_PX,
            )
            let blocked = false
            let checkPrevX = prevX
            let checkPrevY = prevY
            let hitWallX = m.x
            let hitWallY = m.y
            for (let s = 1; s < rayPoints.length; s++) {
              const pt = rayPoints[s]!
              const isHit =
                effectiveTerrain.isMissileBlocked !== undefined
                  ? effectiveTerrain.isMissileBlocked(
                      pt.x,
                      pt.y,
                      checkPrevX,
                      checkPrevY,
                      terrainMask,
                    )
                  : effectiveTerrain.overlap !== undefined &&
                    effectiveTerrain.overlap(pt.x, pt.y) > 0
              if (isHit) {
                blocked = true
                hitWallX = pt.x
                hitWallY = pt.y
                break
              }
              checkPrevX = pt.x
              checkPrevY = pt.y
            }
            if (blocked) {
              m.x = hitWallX
              m.y = hitWallY
              this.dispatchSrvHit(m, undefined, hitWallX, hitWallY, {
                currentTick,
                targets,
                targetPositions,
                collision,
                hits,
                subMissilesSpawned,
                trigger: 'wall',
              })
              if (
                m.record.explosionMissile &&
                !subMissilesSpawned.includes(m.record.explosionMissile)
              ) {
                this.spawnMissile({
                  missileNameOrId: m.record.explosionMissile,
                  sourceSkillId: m.sourceSkillId,
                  slvl: m.slvl,
                  owner: m.owner,
                  startX: hitWallX,
                  startY: hitWallY,
                  targetX: hitWallX,
                  targetY: hitWallY,
                  dmgPacket: undefined,
                })
                subMissilesSpawned.push(m.record.explosionMissile)
              }
              m.expired = true
              continue
            }
          }
        }
      }

      // 4. CollideType === 7 (COLLIDE_MISSILE): destroys enemy projectiles in path when otherM.record.canDestroy is set
      if (m.record.collideType === 7) {
        const sweeperSize = Math.max(1, m.record.size)
        for (const otherM of this.missiles) {
          if (otherM === m || otherM.expired) continue
          if (!otherM.record.canDestroy) continue
          if (!areUnitsEnemies113c(m.owner, otherM.owner)) continue
          const otherSize = Math.max(1, otherM.record.size)
          if (
            checkMissileSegmentFootprintOverlap113c(
              tickStartX,
              tickStartY,
              m.x,
              m.y,
              otherM.x,
              otherM.y,
              sweeperSize,
              otherSize,
              MISSILE_SUBTILE_FLAT_PX,
            )
          ) {
            otherM.expired = true
          }
        }
      }

      // 5. Continuous ground fire / stream re-hit reset (MISSMODE_SrvDo05_FireWallSegment 0x6FC61980 / MISSMODE_SrvDmg03_ContinuousGroundFire 0x6FC58D80)
      if (
        m.record.pSrvDoFunc === 5 ||
        (m.record.pSrvDmgFunc === 3 &&
          (m.record.vel === 0 ? (m.record.nextDelay > 0 ? m.ageTicks % 5 === 0 : true) : true)) ||
        (m.record.vel === 0 && !m.record.collideKill && m.record.eType === 'fire' && m.record.eMax > 0) ||
        m.record.pCltDoFunc === 15
      ) {
        m.hitTargetIds.clear()
      }

      // 6. Unit collision loop & MISSILES_SrvHitDispatch (0x6FC5EDE0)
      // Non-colliding spawner/controller rows do not directly hit units on travel frames.
      const isControllerOrVisualOnly =
        m.record.pSrvDoFunc === 10 ||
        m.record.pSrvDoFunc === 15 ||
        m.record.pSrvHitFunc === 14 ||
        m.record.pSrvHitFunc === 56 ||
        ((m.record.pSrvDoFunc === 6 ||
          m.record.pSrvDoFunc === 23 ||
          m.record.pSrvDoFunc === 24) &&
          m.record.pSrvHitFunc === 0) ||
        (m.record.vel === 0 &&
          m.record.pSrvDoFunc <= 1 &&
          m.record.pSrvHitFunc === 0 &&
          m.record.pSrvDmgFunc === 0 &&
          m.record.eMin === 0 &&
          m.record.eMax === 0 &&
          (m.dmgPacket.elemMin256 ?? 0) === 0 &&
          (m.dmgPacket.elemMax256 ?? 0) === 0)

      // 1.13c `D2Game.dll` `0x6FC8FCE8` (`nActivateFrame = nTotalFrames - nActivate`) &
      // `MISSMODE_MoveMissile` (`0x6FC5F403..0x6FC5F413`, #1997):
      // Skip unit collision while `ageTicks < record.activate` (`Activate >= 2`: `#195`, `#215`, `#225`, `#234`, `#502`, `#516`),
      // while movement and terrain barrier collision remain active.
      const isBeforeActivate113c = m.record.activate > 1 && m.ageTicks < m.record.activate

      for (const target of targets) {
        if (isControllerOrVisualOnly || isBeforeActivate113c) break
        if (target.statList.getHp256() <= 0) continue

        const pos = this.resolveUnitPosition(target, targetPositions)
        if (!pos) continue

        // Footprint overlap check (D2Common.dll sub-tile footprint overlap)
        const targetSize = resolveUnitSubtileSize113c(target)
        const isGroundPatch =
          m.record.vel === 0 &&
          (m.record.pSrvDoFunc === 5 ||
            m.record.pSrvDmgFunc === 3 ||
            m.record.pSrvDmgFunc === 15 ||
            m.record.eType === 'fire' ||
            m.record.eType === 'pois')
        const overlapsFootprint = checkMissileSegmentFootprintOverlap113c(
          tickStartX,
          tickStartY,
          m.x,
          m.y,
          pos.x,
          pos.y,
          m.record.size,
          targetSize,
          MISSILE_SUBTILE_FLAT_PX,
          isGroundPatch ? ISO_GROUND_ASPECT_RATIO : 1,
        )
        if (!overlapsFootprint) continue

        // 1.13c MISSMODE_SrvHit18_ShoutWarCryState (0x6FC5EA60: shout #149, battlecommand #236, battleorders #237):
        // Buffs friendly units (caster, party players, friendly mercenaries, friendly minions) and deals ZERO damage to enemies.
        if (m.record.pSrvHitFunc === 18) {
          if (areUnitsEnemies113c(m.owner, target)) continue
          if (m.hitTargetIds.has(target.id)) continue
          const skillRec = this.resolveMissileSkillRecord(m)
          const stateName = skillRec?.auraState
            ? skillRec.auraState.toLowerCase()
            : m.record.id === 149
              ? 'shout'
              : m.record.id === 237
                ? 'battleorders'
                : 'battlecommand'
          const evalCtx = skillRec
            ? {
                registry: this.registry,
                activeSkill: skillRec,
                activeMissile: m.record,
                slvl: m.slvl,
                blvl: m.slvl,
                getBaseSkillLevel: (id: number) => m.owner.statList.getBaseSkillLevel(id),
              }
            : undefined
          const durationFrames =
            skillRec && evalCtx && skillRec.auraLenCalc.trim().length > 0
              ? evaluateCalc(skillRec.auraLenCalc, evalCtx)
              : 0
          const stats: Record<string, number> = {}
          if (skillRec && evalCtx) {
            const statPairs: [string, string][] = [
              [skillRec.auraStat1, skillRec.auraStatCalc1],
              [skillRec.auraStat2, skillRec.auraStatCalc2],
              [skillRec.auraStat3, skillRec.auraStatCalc3],
              [skillRec.auraStat4, skillRec.auraStatCalc4],
              [skillRec.auraStat5, skillRec.auraStatCalc5],
              [skillRec.auraStat6, skillRec.auraStatCalc6],
            ]
            for (const [sName, sCalc] of statPairs) {
              if (sName.trim().length > 0 && sCalc.trim().length > 0) {
                stats[sName.trim().toLowerCase()] = evaluateCalc(sCalc, evalCtx)
              }
            }
          }
          const prevMaxHp256 = target.statList.getMaxHp256()
          const prevHp256 = target.statList.getHp256()
          const prevMaxMana256 = target.statList.getMaxMana256()
          const prevMana256 = target.statList.getMana256()
          target.stateBus.applyState({
            stateNameOrId: stateName,
            sourceUnitId: m.owner.id,
            sourceSkillId: skillRec?.id ?? m.sourceSkillId,
            slvl: m.slvl,
            durationFrames,
            currentFrame: currentTick,
            stats,
          })
          if (stateName === 'battleorders') {
            const newMaxHp256 = target.statList.getMaxHp256()
            if (prevMaxHp256 > 0 && newMaxHp256 > prevMaxHp256 && prevHp256 > 0) {
              target.statList.setHp256(
                Math.min(newMaxHp256, Math.trunc((prevHp256 * newMaxHp256) / prevMaxHp256)),
              )
            }
            const newMaxMana256 = target.statList.getMaxMana256()
            if (prevMaxMana256 > 0 && newMaxMana256 > prevMaxMana256 && prevMana256 > 0) {
              target.statList.setMana256(
                Math.min(newMaxMana256, Math.trunc((prevMana256 * newMaxMana256) / prevMaxMana256)),
              )
            }
          }
          m.hitTargetIds.add(target.id)
          continue
        }

        // 1.13c MISSMODE_SrvHit17_HowlFlee (0x6FC5EAE0: howl #148) & MISSMODE_SrvHit28_GrimWardScare (0x6FC5EC80: grimwardscare #259):
        // Applies non-damaging `terror` (state 56) to non-boss/non-unique/non-champion hostile enemies.
        if (m.record.pSrvHitFunc === 17 || m.record.pSrvHitFunc === 28) {
          if (!areUnitsEnemies113c(m.owner, target)) continue
          if (m.hitTargetIds.has(target.id)) continue
          m.hitTargetIds.add(target.id)
          const isBossOrUnique = Boolean(
            target.isBoss ||
              target.rank === 'boss' ||
              target.rank === 'unique' ||
              target.rank === 'champion',
          )
          if (!isBossOrUnique) {
            const ownerLvl = m.owner.statList.getBaseStat('level')
            const targetLvl = target.statList.getBaseStat('level')
            const passesHowlLevelCheck =
              m.record.pSrvHitFunc !== 17 ||
              ownerLvl <= 0 ||
              targetLvl <= 0 ||
              ownerLvl + m.slvl > targetLvl
            if (passesHowlLevelCheck) {
              const skillRec = this.resolveMissileSkillRecord(m)
              const dur =
                skillRec && skillRec.auraLenCalc.trim().length > 0
                  ? evaluateCalc(skillRec.auraLenCalc, {
                      registry: this.registry,
                      activeSkill: skillRec,
                      activeMissile: m.record,
                      slvl: m.slvl,
                      blvl: m.slvl,
                      getBaseSkillLevel: (id: number) => m.owner.statList.getBaseSkillLevel(id),
                    })
                  : Math.max(50, 50 + m.slvl * 25)
              target.stateBus.applyState({
                stateNameOrId: 'terror',
                sourceUnitId: m.owner.id,
                sourceSkillId: skillRec?.id ?? m.sourceSkillId,
                slvl: m.slvl,
                durationFrames: dur,
                currentFrame: currentTick,
              })
            }
          }
          continue
        }

        // 1.13c MISSMODE_SrvHit21_BattleCryDebuff (0x6FC5CE90: battlecry #219):
        // Applies non-damaging `battlecry` debuff (`state 89`) to hostile enemies (`skill_armor_percent`, `damagepercent`).
        if (m.record.pSrvHitFunc === 21) {
          if (!areUnitsEnemies113c(m.owner, target)) continue
          if (m.hitTargetIds.has(target.id)) continue
          m.hitTargetIds.add(target.id)
          const skillRec = this.resolveMissileSkillRecord(m)
          const evalCtx = skillRec
            ? {
                registry: this.registry,
                activeSkill: skillRec,
                activeMissile: m.record,
                slvl: m.slvl,
                blvl: m.slvl,
                getBaseSkillLevel: (id: number) => m.owner.statList.getBaseSkillLevel(id),
              }
            : undefined
          const dur =
            skillRec && evalCtx && skillRec.auraLenCalc.trim().length > 0
              ? evaluateCalc(skillRec.auraLenCalc, evalCtx)
              : 300
          const stats: Record<string, number> = {}
          if (skillRec && evalCtx) {
            if (skillRec.auraStat1.trim().length > 0 && skillRec.auraStatCalc1.trim().length > 0) {
              stats[skillRec.auraStat1.trim().toLowerCase()] = evaluateCalc(
                skillRec.auraStatCalc1,
                evalCtx,
              )
            }
            if (skillRec.auraStat2.trim().length > 0 && skillRec.auraStatCalc2.trim().length > 0) {
              stats[skillRec.auraStat2.trim().toLowerCase()] = evaluateCalc(
                skillRec.auraStatCalc2,
                evalCtx,
              )
            }
          }
          target.stateBus.applyState({
            stateNameOrId: 'battlecry',
            sourceUnitId: m.owner.id,
            sourceSkillId: skillRec?.id ?? m.sourceSkillId,
            slvl: m.slvl,
            durationFrames: dur,
            currentFrame: currentTick,
            stats,
          })
          continue
        }

        // 1.13c MISSMODE_SrvHit43_HealingBoltFriendly (0x6FC59E30: healing vortex #425):
        // Monster friendly heal bolt heals an allied unit and expires with zero enemy damage.
        if (m.record.pSrvHitFunc === 43) {
          if (areUnitsEnemies113c(m.owner, target) || target.id === m.owner.id) continue
          const curHp256 = target.statList.getHp256()
          const maxHp256 = target.statList.getMaxHp256()
          if (maxHp256 > 0 && curHp256 < maxHp256) {
            const heal256 = Math.max(256, Math.trunc(maxHp256 / 8))
            target.statList.setHp256(Math.min(maxHp256, curHp256 + heal256))
          }
          m.hitTargetIds.add(target.id)
          m.expired = true
          break
        }

        // Holy Bolt / Fist of the Heavens Holy Bolt (pSrvHitFunc === 7, MISSMODE_SrvHit07_HolyBolt @ 0x6FC59FD0):
        // - Hostile units: only hits Undead ((m.record.holy || 1) & 1)
        // - Friendly units: heals ally when Missiles.txt Skill is 'Holy Bolt' (sHitPar1 !== 0 and directSkill has calc1/calc2)
        if (m.record.pSrvHitFunc === 7) {
          if (areUnitsEnemies113c(m.owner, target)) {
            const holyMask = m.record.holy || 1
            const hitsUndead = (holyMask & 1) !== 0 && Boolean(target.isUndead)
            const hitsDemon = (holyMask & 2) !== 0 && Boolean(target.isDemon)
            if (!hitsUndead && !hitsDemon) continue
          } else {
            if (target.id === m.owner.id || m.record.sHitPar1 === 0) continue
            const directSkill = m.record.skill
              ? this.registry.getSkillByName(m.record.skill)
              : undefined
            if (
              !directSkill ||
              directSkill.calc1.trim().length === 0 ||
              directSkill.calc2.trim().length === 0
            ) {
              continue
            }
            const evalCtx = {
              registry: this.registry,
              activeSkill: directSkill,
              activeMissile: m.record,
              slvl: m.slvl,
              blvl: m.slvl,
              getBaseSkillLevel: (id: number) => m.owner.statList.getBaseSkillLevel(id),
            }
            let healMin = evaluateCalc(directSkill.calc1, evalCtx)
            let healMax = evaluateCalc(directSkill.calc2, evalCtx)
            if (directSkill.eDmgSymPerCalc.trim().length > 0) {
              const synPct = evaluateCalc(directSkill.eDmgSymPerCalc, evalCtx)
              healMin = Math.floor((healMin * (100 + synPct)) / 100)
              healMax = Math.floor((healMax * (100 + synPct)) / 100)
            }
            const curHp256 = target.statList.getHp256()
            const maxHp256 = target.statList.getMaxHp256()
            const healPts = Math.floor((healMin + healMax) / 2)
            if (maxHp256 > 0 && curHp256 < maxHp256) {
              target.statList.setHp256(Math.min(maxHp256, curHp256 + healPts * 256))
            }
            m.hitTargetIds.add(target.id)
            hits.push({
              missileName: m.name,
              targetId: target.id,
              damage: 0,
              immune: false,
            })
            m.expired = true
            break
          }
        }

        if (!canMissileCollideWithUnit113c(m, target)) continue
        if (m.hitTargetIds.has(target.id)) continue

        // 1.13c D2Game.dll MISSILE_CheckNextHit (0x6FC5E590 / 0x6FC5EE80) + States.txt ID 86 (`justhit`):
        // When `NextHit === 1` (`m.nextHit`), a target currently in unit-global `STATE_JUSTHIT (86)` causes
        // this missile to pass straight through harmlessly without expiring (`CollideKill` skipped).
        if (m.nextHit) {
          if (this.isTargetInJustHit(target, currentTick)) {
            continue
          }
        }

        // Multiple Shot / volley single-target immunity (fallback for NextHit === 0 synthetic volleys)
        if (m.volleyId) {
          const vKey = `${m.volleyId}:${target.id}`
          if (this.volleyHits.has(vKey)) {
            m.hitTargetIds.add(target.id)
            if (m.canPierce && m.pierceIdx > 0 && ownerCanConsumePierce(m.owner, this.registry)) {
              m.pierceIdx -= 1
              m.pierceCount += 1
            } else if (!m.record.collideKill) {
              m.pierceCount += 1
            } else {
              m.expired = true
              break
            }
            continue
          }
          this.volleyHits.add(vKey)
        }

        // Apply unit-global `STATE_JUSTHIT (86)` when `NextHit === 1` and `NextDelay > 0`
        if (m.nextHit && m.nextDelayFrames > 0) {
          this.applyTargetJustHit(target, m.owner.id, m.nextDelayFrames, currentTick)
        }

        m.hitTargetIds.add(target.id)

        // Prepare packet & execute 1.13c gpMissileSrvDmgFnTable (D2Game.dll 0x6FD2DB68, entries 0..15)
        let basePacket: SUnitDmgPacket = {
          ...m.dmgPacket,
          canTriggerProcs: m.canTriggerProcs,
          ...(m.record.pSrvHitFunc === 7 ? { bypassUndeadMagicRes: true } : {}),
        }
        if (
          m.record.vel === 0 &&
          (basePacket.elemMax256 ?? 0) === 0 &&
          (m.record.eMin > 0 || m.record.eMax > 0)
        ) {
          const selfRowElem = this.evaluateMissileRowElemDamage256(m, m.record)
          if (selfRowElem.max256 > 0) {
            basePacket = {
              ...basePacket,
              attackKind: 'spell',
              elemType: (m.record.eType as SUnitDmgPacket['elemType']) || 'fire',
              elemMin256: selfRowElem.min256,
              elemMax256: selfRowElem.max256,
              autoHit: true,
              unblockable: true,
              ...(m.record.skill === '' && !m.record.applyMastery ? { skipElemMastery: true } : {}),
              ...(m.record.eType === 'fire' && !m.record.collideKill
                ? {
                    isPersistentGroundFire: true,
                    noHitRecovery: true,
                    frameRate1024: m.record.damageRate > 0 ? m.record.damageRate : 41,
                  }
                : {}),
            }
          }
        }
        if (m.record.pSrvHitFunc === 4 || m.record.pSrvHitFunc === 9) {
          basePacket = this.mergeBowHitFlagsItemElem(m, basePacket)
        }
        const dmgPrep = this.dispatchSrvDmg(m, target, basePacket)
        const dmgOut = executeSUnitDmg(m.owner, target, dmgPrep.packet, m.doFuncRng ?? this.rng)


        hits.push({
          missileName: m.name,
          targetId: target.id,
          damage: dmgOut.totalDamage,
          immune: dmgOut.immuneToElem || dmgOut.immuneToPhys,
        })

        // Apply stateOnHit resolved by dispatchSrvDmg
        if (dmgPrep.stateOnHit && dmgPrep.stateOnHit.durationFrames > 0) {
          const st = dmgPrep.stateOnHit
          if (st.stateNameOrId === 'chill' || st.stateNameOrId === 'freeze') {
            if (!dmgOut.immuneToElem && !target.statList.getAccruedStat('item_cannotbefrozen')) {
              const coldOrFreezeDivisor =
                target.unitType === 'monster'
                  ? st.stateNameOrId === 'freeze'
                    ? Math.max(1, target.monsterFreezeDivisor ?? 1)
                    : Math.max(1, target.monsterColdDivisor ?? 1)
                  : 1
              const scaledDuration = Math.trunc(st.durationFrames / coldOrFreezeDivisor)
              if (scaledDuration > 0) {
                target.stateBus.applyState({
                  stateNameOrId: st.stateNameOrId,
                  sourceSkillId: m.sourceSkillId,
                  slvl: m.slvl,
                  durationFrames: scaledDuration,
                })
              }
            }
          } else if (st.stateNameOrId === 'stun') {
            const isBoss = Boolean(
              target.isBoss ||
                target.rank === 'boss',
            )
            if (!st.nonBossOnly || !isBoss) {
              target.stateBus.applyState({
                stateNameOrId: 'stun',
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                durationFrames: st.durationFrames,
              })
            }
          }
        }

        // Dispatch 1.13c gpMissileSrvHitFnTable (D2Game.dll 0x6FD2DA48, entries 0..64)
        const hitAction = this.dispatchSrvHit(m, target, pos.x, pos.y, {
          currentTick,
          targets,
          targetPositions,
          collision,
          hits,
          subMissilesSpawned,
          trigger: 'unit',
          dmgSuccess: dmgOut.hit,
        })

        if (hitAction === 'pierce') {
          continue
        }
        if (hitAction === 'expire') {
          m.expired = true
          break
        }

        // Standard MISSILES_SrvHitDispatch (0x6FC5EDE0) Pierce & CollideKill resolution
        if (m.record.pSrvHitFunc === 8 || (m.record.vel === 0 && !m.record.collideKill)) {
          // Stationary fire / poison patches remain active for their Range lifetime
        } else if (
          m.canPierce &&
          m.pierceIdx > 0 &&
          ownerCanConsumePierce(m.owner, this.registry)
        ) {
          m.pierceIdx -= 1
          m.pierceCount += 1
        } else if (!m.record.collideKill) {
          m.pierceCount += 1
          if (m.record.pCltHitFunc === 26 && m.record.explosionMissile) {
            this.spawnMissile({
              missileNameOrId: m.record.explosionMissile,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: pos.x,
              startY: pos.y,
              targetX: pos.x,
              targetY: pos.y,
              dmgPacket: undefined,
            })
            subMissilesSpawned.push(m.record.explosionMissile)
          }
        } else {
          if (
            m.record.explosionMissile &&
            !subMissilesSpawned.includes(m.record.explosionMissile)
          ) {
            this.spawnMissile({
              missileNameOrId: m.record.explosionMissile,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: pos.x,
              startY: pos.y,
              targetX: pos.x,
              targetY: pos.y,
              dmgPacket: undefined,
            })
            subMissilesSpawned.push(m.record.explosionMissile)
          }
          m.expired = true
          break
        }
      }

      // 7. Range expiry check (ageTicks >= maxRangeTicks)
      if (m.ageTicks >= m.maxRangeTicks) {
        if (!m.expired) {
          this.dispatchSrvHit(m, undefined, m.x, m.y, {
            currentTick,
            targets,
            targetPositions,
            collision,
            hits,
            subMissilesSpawned,
            trigger: 'expire',
          })
          // Falling shards (e.g. Blizzard shards with ExplosionMissile in Missiles.txt) spawn ExplosionMissile on ground expiry
          if (
            m.record.explosionMissile &&
            (!m.currentHitFrame || m.currentHitFrame === 0) &&
            !subMissilesSpawned.includes(m.record.explosionMissile)
          ) {
            m.currentHitFrame = 1
            this.spawnMissile({
              missileNameOrId: m.record.explosionMissile,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: m.x,
              startY: m.y,
              targetX: m.x,
              targetY: m.y,
              dmgPacket: m.dmgPacket,
            })
            subMissilesSpawned.push(m.record.explosionMissile)
          }
        }
        m.expired = true
      }
    }

    // Purge expired missiles
    for (let i = this.missiles.length - 1; i >= 0; i -= 1) {
      if (this.missiles[i]!.expired) {
        this.missiles.splice(i, 1)
      }
    }

    return { hits, subMissilesSpawned }
  }

  /**
   * 1.13c Plague Javelin (#25) radial cloud burst (`pSrvHitFunc = 2`, `MISSMODE_SrvHit02_PlagueJavelin` @ 0x6FC5E330, `AlwaysExplode = 1`):
   * - Spawns expanding concentric ring of `plaguejavcloud` (#221) around `(impactX, impactY)`.
   * - Applies pure skill poison damage (`srcDam = 0`, `attackKind = 'spell'`, `autoHit = true`) to enemies within burst radius (120 px).
   */
  private triggerPlagueJavelinBurst(params: {
    missile: ActiveMissile
    impactX: number
    impactY: number
    targets: readonly CombatUnitContext[]
    targetPositions: ReadonlyMap<string, { x: number; y: number }>
    hits: Array<{ missileName: string; targetId: string; damage: number; immune: boolean }>
    subMissilesSpawned: string[]
    excludeTargetId?: string | undefined
  }): void {
    const {
      missile: m,
      impactX,
      impactY,
      targets,
      targetPositions,
      hits,
      subMissilesSpawned,
      excludeTargetId,
    } = params
    const subCloud = m.record.hitSubMissile1 || m.record.subMissile1
    const cloudPacket: SUnitDmgPacket = {
      skillId: m.sourceSkillId,
      slvl: m.slvl,
      attackKind: 'spell',
      srcDam: 0,
      elemType: 'pois',
      elemMin256: m.dmgPacket.elemMin256 ?? 0,
      elemMax256: m.dmgPacket.elemMax256 ?? 0,
      ...(m.dmgPacket.elemDurationFrames !== undefined
        ? { elemDurationFrames: m.dmgPacket.elemDurationFrames }
        : {}),
      autoHit: true,
      unblockable: true,
      canTriggerProcs: false,
    }

    if (subCloud) {
      const ringCount = 8
      const ringRadiusPx = 60
      for (let i = 0; i < ringCount; i += 1) {
        const theta = (i * Math.PI * 2) / ringCount
        const cx = impactX + Math.cos(theta) * ringRadiusPx
        const cy = impactY + Math.sin(theta) * ringRadiusPx * ISO_GROUND_ASPECT_RATIO
        this.spawnMissile({
          missileNameOrId: subCloud,
          sourceSkillId: m.sourceSkillId,
          slvl: m.slvl,
          owner: m.owner,
          startX: cx,
          startY: cy,
          targetX: cx,
          targetY: cy,
          dmgPacket: cloudPacket,
        })
        subMissilesSpawned.push(subCloud)
      }
    }

    const burstSubtiles =
      m.record.sHitPar1 > 1
        ? m.record.sHitPar1
        : (m.record.sHitPar2 || 2) * (m.record.sHitPar3 || 3)
    const burstRadius = burstSubtiles * MISSILE_SUBTILE_FLAT_PX
    for (const other of targets) {
      if (other.id === excludeTargetId || other.statList.getHp256() <= 0) continue
      if (!areUnitsEnemies113c(m.owner, other)) continue
      const oPos = this.resolveUnitPosition(other, targetPositions)
      if (!oPos) continue
      if (
        Math.hypot(oPos.x - impactX, (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO) <= burstRadius
      ) {
        const splashOut = executeSUnitDmg(m.owner, other, cloudPacket, m.doFuncRng ?? this.rng)
        hits.push({
          missileName: `${m.name}:plagueburst`,
          targetId: other.id,
          damage: splashOut.totalDamage,
          immune: splashOut.immuneToElem,
        })
      }
    }
  }

  /**
   * 1.13c Lightning Fury (#35) bolt release (`pSrvHitFunc = 20`, `MISSMODE_SrvHit20_LightningFury` @ 0x6FC5DD60):
   * - Scans alive enemies within `sHitPar1 > 0 ? sHitPar1 : max(1, evalSkillCalc(skill.auraRangeCalc))` subtiles (`15` subtiles = `300 px`)
   *   of `(impactX, impactY)` in 2:1 isometric ground space (excluding `excludeTargetId`).
   * - Releases up to `sHitPar2 > 0 ? sHitPar2 : max(1, evalSkillCalc(skill.calc1))` (`1 + slvl`) `furylightning` (#231) bolts (`ToHit = 0`, `SrcDamage = -1`, `NextDelay = 0`).
   */
  private triggerLightningFuryBolts(params: {
    missile: ActiveMissile
    impactX: number
    impactY: number
    targets: readonly CombatUnitContext[]
    targetPositions: ReadonlyMap<string, { x: number; y: number }>
    subMissilesSpawned: string[]
    excludeTargetId?: string | undefined
  }): void {
    const {
      missile: m,
      impactX,
      impactY,
      targets,
      targetPositions,
      subMissilesSpawned,
      excludeTargetId,
    } = params
    const subBolt = m.record.hitSubMissile1
    if (!subBolt) return
    const maxBolts = this.resolveSrvHitRadiusSubtiles(m, 'calc1', {
      useHitPar2: true,
      fallbackSubtiles: 1 + Math.max(1, m.slvl),
    })
    const searchRadiusPx = this.resolveSrvHitRadiusPx(m, 'auraRangeCalc', { fallbackSubtiles: 15 })
    const boltPacket: SUnitDmgPacket = {
      skillId: m.sourceSkillId,
      slvl: m.slvl,
      attackKind: 'spell',
      srcDam: 0,
      elemType: 'ltng',
      elemMin256: m.dmgPacket.elemMin256 ?? 0,
      elemMax256: m.dmgPacket.elemMax256 ?? 0,
      autoHit: true,
      unblockable: true,
      canTriggerProcs: false,
    }

    let boltsSpawned = 0
    for (const other of targets) {
      if (boltsSpawned >= maxBolts) break
      if (other.id === excludeTargetId || other.statList.getHp256() <= 0) continue
      if (!areUnitsEnemies113c(m.owner, other)) continue
      const oPos = this.resolveUnitPosition(other, targetPositions)
      if (!oPos) continue
      const dist = Math.hypot(
        oPos.x - impactX,
        (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO,
      )

      if (dist <= searchRadiusPx) {
        this.spawnMissile({
          missileNameOrId: subBolt,
          sourceSkillId: m.sourceSkillId,
          slvl: m.slvl,
          owner: m.owner,
          startX: impactX,
          startY: impactY,
          targetX: oPos.x,
          targetY: oPos.y,
          dmgPacket: boltPacket,
        })
        subMissilesSpawned.push(subBolt)
        boltsSpawned += 1
      }
    }
  }

  /**
   * 1.13c `HitFlags & 2`: Exploding Arrow (#16), Immolation Arrow (#27), and Freezing Arrow (#31)
   * merge item flat fire/cold damage (`firemindam`/`firemaxdam` or `coldmindam`/`coldmaxdam`) into the explosion.
   */
  private mergeBowHitFlagsItemElem(m: ActiveMissile, basePacket: SUnitDmgPacket): SUnitDmgPacket {
    const hitSubRec = m.record.hitSubMissile1
      ? this.registry.getMissileByName(m.record.hitSubMissile1)
      : undefined
    const isCold =
      m.record.eType === 'cold' ||
      m.record.eType === 'frze' ||
      hitSubRec?.eType === 'cold' ||
      hitSubRec?.eType === 'frze' ||
      m.record.pCltHitFunc === 14 ||
      basePacket.elemType === 'cold'
    const minStat = isCold ? 'coldmindam' : 'firemindam'
    const maxStat = isCold ? 'coldmaxdam' : 'firemaxdam'
    const itemMin = Math.max(0, m.owner.statList.getAccruedStat(minStat))
    const itemMax = Math.max(itemMin, m.owner.statList.getAccruedStat(maxStat))
    if (itemMin === 0 && itemMax === 0) {
      return basePacket
    }
    return {
      ...basePacket,
      elemType: isCold ? 'cold' : 'fire',
      elemMin256: (basePacket.elemMin256 ?? 0) + itemMin * 256,
      elemMax256: (basePacket.elemMax256 ?? 0) + itemMax * 256,
      mergedBowHitFlagElem: isCold ? 'cold' : 'fire',
    } as SUnitDmgPacket
  }

  /**
   * 1.13c Two-Stage Bow Explosion (`pSrvHitFunc = 4` / `9`, `MISSMODE_SrvHit04_SubMissileExplosionTrigger` @ `0x6FC5F220` & `MISSMODE_SrvHit09_ImmolationArrow` @ `0x6FC5E0B0`):
   * - Stage 2 explosion deals ONLY elemental damage (`srcDam = 0`, `attackKind = 'spell'`, `autoHit = true`, `unblockable = true`)
   *   plus item flat fire/cold damage (`HitFlags & 2`), NEVER physical weapon damage.
   * - Splash radius resolved from `sHitPar1`/`sHitPar2` or `Skills.txt` `calc1`/`calc2`.
   * - Spawns explosion sub-missiles from `Missiles.txt` columns (`ExplosionMissile`, `HitSubMissile1`, `CltHitSubMissile1`, `CltHitSubMissile2`).
   */
  private triggerBowExplosionAoE(params: {
    missile: ActiveMissile
    impactX: number
    impactY: number
    targets: readonly CombatUnitContext[]
    targetPositions: ReadonlyMap<string, { x: number; y: number }>
    hits: Array<{ missileName: string; targetId: string; damage: number; immune: boolean }>
    subMissilesSpawned: string[]
    excludeTargetId?: string | undefined
  }): void {
    const {
      missile: m,
      impactX,
      impactY,
      targets,
      targetPositions,
      hits,
      subMissilesSpawned,
      excludeTargetId,
    } = params
    const hitSubRec = m.record.hitSubMissile1
      ? this.registry.getMissileByName(m.record.hitSubMissile1)
      : undefined
    const isFreezing =
      m.record.eType === 'frze' ||
      hitSubRec?.eType === 'frze' ||
      m.record.pCltHitFunc === 14 ||
      m.dmgPacket.elemType === 'cold'
    const isImmolation = m.record.pSrvHitFunc === 9
    const mergedPacket = this.mergeBowHitFlagsItemElem(m, m.dmgPacket)
    const explosionPacket: SUnitDmgPacket = {
      skillId: m.sourceSkillId,
      slvl: m.slvl,
      attackKind: 'spell',
      srcDam: 0,
      elemType: isFreezing ? 'cold' : 'fire',
      elemMin256: mergedPacket.elemMin256 ?? 0,
      elemMax256: mergedPacket.elemMax256 ?? 0,
      autoHit: true,
      unblockable: true,
      canTriggerProcs: false,
    }

    const splashRadius = isImmolation
      ? this.resolveSrvHitRadiusPx(m, 'calc2', {
          useHitPar2: true,
          alsoCheckHitPar1: true,
          fallbackSubtiles: 4,
        })
      : this.resolveSrvHitRadiusPx(m, 'calc1', { fallbackSubtiles: 4 })
    const freezeFrames = isFreezing ? this.resolveMissileElemDurationFrames(m) : 0

    for (const other of targets) {
      if (other.id === excludeTargetId || other.statList.getHp256() <= 0) continue
      if (!areUnitsEnemies113c(m.owner, other)) continue
      const oPos = this.resolveUnitPosition(other, targetPositions)
      if (!oPos) continue
      if (
        Math.hypot(oPos.x - impactX, (oPos.y - impactY) / ISO_GROUND_ASPECT_RATIO) <= splashRadius
      ) {
        const splashOut = executeSUnitDmg(m.owner, other, explosionPacket, m.doFuncRng ?? this.rng)
        hits.push({
          missileName: `${m.name}:splash`,
          targetId: other.id,
          damage: splashOut.totalDamage,
          immune: splashOut.immuneToElem,
        })
        if (isFreezing && freezeFrames > 0) {
          if (!splashOut.immuneToElem && !other.statList.getAccruedStat('item_cannotbefrozen')) {
            other.stateBus.applyState({
              stateNameOrId: 'freeze',
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              durationFrames: freezeFrames,
            })
          }
        }
      }
    }

    const expName = m.record.explosionMissile
    if (expName) {
      this.spawnMissile({
        missileNameOrId: expName,
        sourceSkillId: m.sourceSkillId,
        slvl: m.slvl,
        owner: m.owner,
        startX: impactX,
        startY: impactY,
        targetX: impactX,
        targetY: impactY,
        dmgPacket: undefined,
      })
      subMissilesSpawned.push(expName)
    }

    if (isImmolation && m.record.hitSubMissile1) {
      const patchName = m.record.hitSubMissile1
      const expBlvl = m.owner.statList.getBaseSkillLevel(16)
      const fireBlvl = m.owner.statList.getBaseSkillLevel(7)
      const immStats = calculateImmolationArrowStats(m.slvl, {
        explodingArrow: expBlvl,
        fireArrow: fireBlvl,
      })
      const patchPacket: SUnitDmgPacket = {
        skillId: m.sourceSkillId,
        slvl: m.slvl,
        attackKind: 'spell',
        srcDam: 0,
        elemType: 'fire',
        elemMin256: Math.round((immStats.firePatchMinDamagePerSec * 256) / 5),
        elemMax256: Math.round((immStats.firePatchMaxDamagePerSec * 256) / 5),
        autoHit: true,
        unblockable: true,
        canTriggerProcs: false,
      }
      this.spawnMissile({
        missileNameOrId: patchName,
        sourceSkillId: m.sourceSkillId,
        slvl: m.slvl,
        owner: m.owner,
        startX: impactX,
        startY: impactY,
        targetX: impactX,
        targetY: impactY,
        dmgPacket: patchPacket,
        maxRangeTicks: 75,
      })
      subMissilesSpawned.push(patchName)
    }

    if (isFreezing) {
      const skill = this.resolveMissileSkillRecord(m)
      const sourceRow =
        m.record.cltHitSubMissile1 && m.record.cltHitSubMissile2
          ? m.record
          : (skill?.srvMissile ? this.registry.getMissileByName(skill.srvMissile) : undefined) ??
            m.record
      if (sourceRow.cltHitSubMissile1) {
        this.spawnMissile({
          missileNameOrId: sourceRow.cltHitSubMissile1,
          sourceSkillId: m.sourceSkillId,
          slvl: m.slvl,
          owner: m.owner,
          startX: impactX,
          startY: impactY,
          targetX: impactX,
          targetY: impactY,
          dmgPacket: undefined,
        })
        subMissilesSpawned.push(sourceRow.cltHitSubMissile1)
      }
      if (sourceRow.cltHitSubMissile2) {
        this.spawnMissile({
          missileNameOrId: sourceRow.cltHitSubMissile2,
          sourceSkillId: m.sourceSkillId,
          slvl: m.slvl,
          owner: m.owner,
          startX: impactX,
          startY: impactY,
          targetX: impactX,
          targetY: impactY,
          dmgPacket: undefined,
        })
        subMissilesSpawned.push(sourceRow.cltHitSubMissile2)
      }
    }
  }

  getActiveMissiles(): readonly ActiveMissile[] {
    return this.missiles
  }

  // ---------------------------------------------------------------------------------------------
  // #1790 online-room bridge: `GameInstance.stepMissiles` routes every server missile's per-frame
  // `pSrvDoFunc` (`gMissileSrvDoFuncTable` @ `0x6FD2D970`) and collision `pSrvHitFunc`
  // (`gpMissileSrvHitFnTable` @ `0x6FD2DA48`) through the methods below. They work in sub-tile
  // space (the room's coordinates) and only decide motion, child missiles and splash radii; the room
  // keeps applying damage through its own `SUNITDMG` pipeline. See
  // `kb/skills/missiles/d2game-missile-srv-tables-113c.md` and `kb/skills/missiles/d2game-srvhit-radius-113c.md`.
  // ---------------------------------------------------------------------------------------------

  /** `Skills.txt` row of an online missile: the casting skill, else the row's `Skill` column. */
  resolveOnlineSkill113c(row: MissileRecord, sourceSkillId: number): SkillRecord | undefined {
    return (
      (sourceSkillId > 0 ? this.registry.getSkillById(sourceSkillId) : undefined) ??
      (row.skill ? this.registry.getSkillByName(row.skill) : undefined)
    )
  }

  /** `SKILLS_EvaluateSkillFormula` of the missile's skill (`NaN`-free, `0` for an empty cell). */
  evalOnlineSkillCalc113c(row: MissileRecord, sourceSkillId: number, slvl: number, expr: string): number {
    const skill = this.resolveOnlineSkill113c(row, sourceSkillId)
    if (skill === undefined || expr.trim().length === 0) return 0
    const v = evaluateCalc(expr, {
      registry: this.registry,
      activeSkill: skill,
      activeMissile: row,
      slvl: Math.max(1, Math.trunc(slvl)),
      blvl: Math.max(1, Math.trunc(slvl)),
      getBaseSkillLevel: () => 0,
    })
    return Number.isFinite(v) ? v : 0
  }

  /**
   * SrvHit radius rule shared by `SrvHit01/03/09/12/13/14/20/22/47/48/51`:
   * `sHitPar > 0 ? sHitPar : max(1, evalSkillCalc(skill[calcField]))` (sub-tiles).
   */
  resolveOnlineHitRadius113c(
    row: MissileRecord,
    sourceSkillId: number,
    slvl: number,
    hitPar: number,
    calcField: 'calc1' | 'calc2' | 'auraRangeCalc' | 'auraLenCalc',
    fallbackSubtiles: number,
  ): number {
    if (hitPar > 0) return hitPar
    const skill = this.resolveOnlineSkill113c(row, sourceSkillId)
    const expr = skill?.[calcField]?.trim() ?? ''
    if (skill === undefined || expr.length === 0) return fallbackSubtiles
    return Math.max(1, this.evalOnlineSkillCalc113c(row, sourceSkillId, slvl, expr))
  }

  /**
   * Remaining Chain Lightning style bounces after the first hit (`SrvHit12` @ `0x6FC5D020`):
   * `sHitPar2` when set, else the skill's hit count `calc1` (Chain Lightning `ln34 / 5` = 5 hits at
   * slvl 1, 9 at slvl 20) minus the first hit.
   */
  resolveOnlineChainBounces113c(row: MissileRecord, sourceSkillId: number, slvl: number): number {
    if (row.pSrvHitFunc !== 12) return 0
    if (row.sHitPar2 > 0) return row.sHitPar2
    const skill = this.resolveOnlineSkill113c(row, sourceSkillId)
    if (skill === undefined) return 0
    if (skill.calc1.trim().length > 0) {
      return Math.max(0, Math.trunc(this.evalOnlineSkillCalc113c(row, sourceSkillId, slvl, skill.calc1)) - 1)
    }
    return Math.max(0, skill.param2)
  }

  /**
   * Leveled `EMin..EMax` of a `Missiles.txt` row in 1/256 (`MISSILES_CalculateDamageData` `0x6FC5D9D0`:
   * 5-band `EMinLev1..5` / `EMaxLev1..5`, `<< HitShift`). `undefined` when the row has no own damage.
   */
  evaluateOnlineRowElem256113c(row: MissileRecord, slvl: number): { min256: number; max256: number } | undefined {
    if (row.eMin <= 0 && row.eMax <= 0) return undefined
    const lvl = Math.max(1, Math.trunc(slvl))
    const tiered = (base: number, l1: number, l2: number, l3: number, l4: number, l5: number): number =>
      base +
      Math.min(Math.max(0, lvl - 1), 7) * l1 +
      Math.min(Math.max(0, lvl - 8), 8) * l2 +
      Math.min(Math.max(0, lvl - 16), 6) * l3 +
      Math.min(Math.max(0, lvl - 22), 6) * l4 +
      Math.max(0, lvl - 28) * l5
    const shift = Math.max(0, Math.trunc(row.hitShift))
    const min = tiered(row.eMin, row.eMinLev1, row.eMinLev2, row.eMinLev3, row.eMinLev4, row.eMinLev5)
    const max = Math.max(min, tiered(row.eMax, row.eMaxLev1, row.eMaxLev2, row.eMaxLev3, row.eMaxLev4, row.eMaxLev5))
    return { min256: min * (1 << shift), max256: max * (1 << shift) }
  }

  /** Online behavior class of a `pSrvDoFunc` (the room-side `gMissileSrvDoFuncTable` coverage). */
  classifyOnlineSrvDo113c(row: MissileRecord): OnlineMissileSrvDoKind113c {
    if (row.pSrvDmgFunc === 5 || row.pCltDoFunc === 2) return 'spiral'
    return classifyOnlineSrvDoFunc113c(row.pSrvDoFunc)
  }

  /** Online behavior class of a `pSrvHitFunc` (the room-side `gpMissileSrvHitFnTable` coverage). */
  classifyOnlineSrvHit113c(row: MissileRecord): OnlineMissileSrvHitKind113c {
    return classifyOnlineSrvHitFunc113c(row.pSrvHitFunc)
  }

  /** New online missile state for a freshly created room missile. */
  createOnlineMissileState113c(params: {
    readonly row: MissileRecord
    readonly sourceSkillId: number
    readonly slvl: number
    readonly x: number
    readonly y: number
    readonly vx: number
    readonly vy: number
    readonly remainingFrames: number
    readonly lockedTargetKey?: string | undefined
    readonly groundLegFrames?: number | undefined
    readonly chainRemaining?: number | undefined
    readonly targetOffsetX?: number | undefined
    readonly targetOffsetY?: number | undefined
  }): OnlineMissileState113c {
    return {
      row: params.row,
      sourceSkillId: params.sourceSkillId,
      slvl: params.slvl,
      x: params.x,
      y: params.y,
      vx: params.vx,
      vy: params.vy,
      originX: params.x,
      originY: params.y,
      ageFrames: 0,
      remainingFrames: params.remainingFrames,
      subMissileIdx: 0,
      pathCursor: 0,
      lockedTargetKey: params.lockedTargetKey,
      groundLegFrames: params.groundLegFrames ?? 0,
      targetOffsetX: params.targetOffsetX,
      targetOffsetY: params.targetOffsetY,
      pathLastX: params.x,
      pathLastY: params.y,
      pathStepAccum: 0,
      chainRemaining:
        params.chainRemaining ?? this.resolveOnlineChainBounces113c(params.row, params.sourceSkillId, params.slvl),
      hitFired: false,
    }
  }

  /**
   * Path-mode motion that replaces the linear `vx/vy` step. Only the Blessed Hammer Archimedean spiral
   * (`PATHTYPE_BLESSEDHAMMER` 14, `D2Common` `0x6FDAB3C0`): 77 points around the caster,
   * `dTheta = 2 * PI / 32`, `dR = 9600 / 65536` sub-tiles per point, starting north-west. The
   * missile walks the polyline at its scalar speed; `false` = linear motion, `'end'` = path consumed.
   */
  advanceOnlineMissile113c(state: OnlineMissileState113c): boolean | 'end' {
    if (this.classifyOnlineSrvDo113c(state.row) !== 'spiral') return false
    const speed = Math.max(1e-3, Math.hypot(state.vx, state.vy))
    let budget = speed
    let cursor = state.pathCursor
    let pos = blessedHammerPathPoint113c(state.originX, state.originY, Math.floor(cursor))
    while (budget > 1e-9) {
      const k = Math.floor(cursor)
      if (k >= BLESSED_HAMMER_PATH_POINTS_113C - 1) {
        state.pathCursor = BLESSED_HAMMER_PATH_POINTS_113C - 1
        const last = blessedHammerPathPoint113c(state.originX, state.originY, BLESSED_HAMMER_PATH_POINTS_113C - 1)
        state.x = last.x
        state.y = last.y
        return 'end'
      }
      const a = blessedHammerPathPoint113c(state.originX, state.originY, k)
      const b = blessedHammerPathPoint113c(state.originX, state.originY, k + 1)
      const segLen = Math.hypot(b.x - a.x, b.y - a.y)
      const frac = cursor - k
      const left = segLen * (1 - frac)
      if (segLen <= 1e-9 || budget >= left) {
        budget -= Math.max(0, left)
        cursor = k + 1
        pos = b
      } else {
        const nf = frac + budget / segLen
        cursor = k + nf
        pos = { x: a.x + (b.x - a.x) * nf, y: a.y + (b.y - a.y) * nf }
        budget = 0
      }
    }
    state.pathCursor = cursor
    state.x = pos.x
    state.y = pos.y
    return true
  }

  /**
   * Per-frame `pSrvDoFunc` after the missile moved (`MISSILE_SrvTick` `0x6FC5E4E0`). Mutates the
   * state's velocity / cursors and returns the child missiles to create.
   */
  stepOnlineMissileSrvDo113c(
    state: OnlineMissileState113c,
    targets: readonly OnlineMissileTarget113c[],
    isBlocked?: (x: number, y: number) => boolean,
  ): OnlineMissileSrvDoResult113c {
    const row = state.row
    const spawns: OnlineMissileSpawn113c[] = []
    const kind = this.classifyOnlineSrvDo113c(row)
    const sub1 = row.subMissile1.trim()
    const subDamage = (name: string): OnlineMissileChildDamage113c => {
      const subRow = this.registry.getMissileByName(name)
      if (subRow === undefined) throw new Error(`Missiles.txt row '${name}' (SubMissile1 of '${row.name}') not found`)
      if (subRow.pSrvDoFunc === 5 || subRow.pSrvDmgFunc === 3) return 'groundfire'
      if (subRow.skill === '' && (subRow.eMin > 0 || subRow.minDamage > 0)) return 'own'
      return 'inherit'
    }
    switch (kind) {
      // 6 FireWallMaker / MoltenBoulder, 9 BatLightning, 12 DiabloWallMaker, 13 BoneWallMaker:
      // `SubMissile1` once per sub-tile the path advances (`D2Common_10234`).
      case 'pathspawner': {
        if (sub1 === '') return { spawns, terminate: true }
        const dist = Math.hypot(state.x - state.pathLastX, state.y - state.pathLastY)
        state.pathLastX = state.x
        state.pathLastY = state.y
        state.pathStepAccum += dist
        while (state.pathStepAccum + 1e-6 >= 1) {
          state.pathStepAccum -= 1
          spawns.push({ missileName: sub1, x: state.x, y: state.y, targetX: state.x, targetY: state.y, damage: subDamage(sub1) })
        }
        return { spawns, terminate: false }
      }
      // 7 GuidedArrow / BoneSpirit (`0x6FC61710`): every `Param1` frames re-steer toward the locked unit
      // while `3 < dist < 25`; a ground-targeted arrow whose first leg ended searches `Param2` sub-tiles.
      case 'homing': {
        const period = Math.max(1, row.param1)
        if (state.ageFrames % period !== 0) return { spawns, terminate: false }
        let locked = state.lockedTargetKey !== undefined ? targets.find((t) => t.key === state.lockedTargetKey) : undefined
        if (state.lockedTargetKey !== undefined && locked === undefined) state.lockedTargetKey = undefined
        if (locked === undefined && state.ageFrames >= state.groundLegFrames) {
          const searchR = Math.max(1, row.param2)
          let best = Infinity
          for (const t of targets) {
            const d = Math.hypot(t.x - state.x, t.y - state.y)
            if (d <= searchR && d < best) {
              best = d
              locked = t
            }
          }
          if (locked !== undefined) state.lockedTargetKey = locked.key
        }
        if (locked !== undefined) {
          const d = Math.hypot(locked.x - state.x, locked.y - state.y)
          if (d > 1e-6 && d < 25) {
            const speed = Math.hypot(state.vx, state.vy)
            state.vx = ((locked.x - state.x) / d) * speed
            state.vy = ((locked.y - state.y) / d) * speed
          }
        }
        return { spawns, terminate: false }
      }
      // 8 MonBlizzCenter / 10 BlizzardCenter (`0x6FC61670` / `0x6FC613D0` -> `0x6FC5D1E0`): every
      // `nFrames` remaining frames, `SubMissile1` at a seeded offset inside `nRange` unless blocked.
      case 'areaspawner': {
        if (sub1 === '') return { spawns, terminate: true }
        let nRange: number
        let nFrames: number
        if (row.pSrvDoFunc === 8) {
          const lvlDiv = Math.trunc(state.slvl / Math.max(1, row.param3))
          nRange = row.param1 + Math.max(2, lvlDiv)
          nFrames = Math.max(3, row.param2 - lvlDiv)
        } else {
          const skill = this.resolveOnlineSkill113c(row, state.sourceSkillId)
          if (skill === undefined) return { spawns, terminate: true }
          nRange = Math.trunc(this.evalOnlineSkillCalc113c(row, state.sourceSkillId, state.slvl, skill.calc1))
          nFrames = Math.trunc(this.evalOnlineSkillCalc113c(row, state.sourceSkillId, state.slvl, skill.calc2))
        }
        if (nFrames <= 0 || state.remainingFrames % nFrames !== 0) return { spawns, terminate: false }
        const rng = new D2Rng(0, 666)
        rng.setSeed(Math.floor(state.x * MISSILE_SUBTILE_FLAT_PX) + state.remainingFrames, 666)
        const nMax = Math.max(0, nRange - 1)
        const span = 2 * nMax
        const sx = state.x + (span > 0 ? rng.rand(span) - nMax : 0)
        const sy = state.y + (span > 0 ? rng.rand(span) - nMax : 0)
        if (isBlocked !== undefined && isBlocked(sx, sy)) return { spawns, terminate: false }
        spawns.push({ missileName: sub1, x: sx, y: sy, targetX: sx, targetY: sy, damage: subDamage(sub1) })
        return { spawns, terminate: false }
      }
      // 15 FrozenOrb (`0x6FC60CA0`): every `Param1` frames one `SubMissile1` along the radius-30 circle
      // table, index advancing by `Param2` (19, gcd(19, 64) = 1) modulo 64.
      case 'orb': {
        if (sub1 === '') return { spawns, terminate: false }
        const nFrames = Math.max(1, row.param1)
        if (state.ageFrames % nFrames === 0) {
          const idx = Math.abs(state.subMissileIdx % 64)
          const offX = FROZEN_ORB_X_POSITIONS[idx]!
          const offY = FROZEN_ORB_Y_POSITIONS[idx]!
          spawns.push({
            missileName: sub1,
            x: state.x,
            y: state.y,
            targetX: state.x + offX,
            targetY: state.y + offY,
            damage: 'inherit',
          })
          state.subMissileIdx = (idx + row.param2) % 64
        }
        return { spawns, terminate: false }
      }
      // 16 FrozenOrbNova (`0x6FC60BD0`): while `remaining < Param1` and `remaining % Param2 == 0`,
      // rotate the stored target vector by 45 degrees: `(a - b) / 2`, `(a + b) / 2`.
      case 'orbnova': {
        const nParam = Math.max(1, row.param2)
        if (state.remainingFrames < row.param1 && state.remainingFrames % nParam === 0) {
          const speed = Math.hypot(state.vx, state.vy)
          const a = state.targetOffsetX ?? Math.round((state.vx / Math.max(1e-9, speed)) * 30)
          const b = state.targetOffsetY ?? Math.round((state.vy / Math.max(1e-9, speed)) * 30)
          const newA = Math.trunc((a - b) / 2)
          const newB = Math.trunc((a + b) / 2)
          state.targetOffsetX = newA
          state.targetOffsetY = newB
          const len = Math.hypot(newA, newB)
          if (len > 0) {
            state.vx = (newA / len) * speed
            state.vy = (newB / len) * speed
          }
        }
        return { spawns, terminate: false }
      }
      default:
        return { spawns, terminate: false }
    }
  }

  /**
   * Collision / expiry `pSrvHitFunc` (`MISSILE_Collide` `0x6FC5EDE0`). `hitKey` is the struck unit
   * (`trigger === 'unit'`); `targets` are the hostile units the function may search (the struck unit
   * included). Returns the children to create, an optional radial splash, and how the missile
   * continues: `'default'` (row `Pierce` / `CollideKill` rules), `'pierce'` (keeps flying, return 2),
   * `'expire'` (destroyed, return 3) or `'passthrough'` (the unit is not a valid target, no damage).
   */
  resolveOnlineMissileSrvHit113c(
    state: OnlineMissileState113c,
    trigger: OnlineMissileHitTrigger113c,
    impactX: number,
    impactY: number,
    hitKey: string | undefined,
    targets: readonly OnlineMissileTarget113c[],
    isBlocked?: (x: number, y: number) => boolean,
  ): OnlineMissileSrvHitResult113c {
    const row = state.row
    const spawns: OnlineMissileSpawn113c[] = []
    const kind = this.classifyOnlineSrvHit113c(row)
    const none = (outcome: OnlineMissileSrvHitResult113c['outcome']): OnlineMissileSrvHitResult113c => ({
      spawns,
      splash: undefined,
      outcome,
    })
    // On range expiry without `AlwaysExplode` only the expiry-capable handlers run (`0x6FC5EDE0`).
    if (trigger === 'expire' && !row.alwaysExplode && !ONLINE_EXPIRE_CAPABLE_SRV_HIT_113C.has(row.pSrvHitFunc)) {
      return none('expire')
    }
    switch (kind) {
      // 1 FireBall (`0x6FC5B990`) / 24 PantherPotOrange (`0x6FC5B7C0`): `sHitPar1` else `max(1, calc1)`.
      case 'splash': {
        const fallback = row.pSrvHitFunc === 24 ? 1 : 4
        const r = this.resolveOnlineHitRadius113c(row, state.sourceSkillId, state.slvl, row.sHitPar1, 'calc1', fallback)
        return { spawns, splash: { radiusSubtiles: r, excludeKey: hitKey }, outcome: 'default' }
      }
      // 3 FirePotion (`0x6FC5BB60`, ground/wall only: `pTarget == NULL`) / 13 GlacialSpike (`0x6FC5B3E0`) /
      // 44 ExplodingJavalin (`0x6FC5B5F0`): `sHitPar1` else `max(1, auraRangeCalc)`.
      case 'aurasplash': {
        if (row.pSrvHitFunc === 3 && trigger === 'unit') return none('default')
        const fallback = row.pSrvHitFunc === 13 ? 4 : 1
        const r = this.resolveOnlineHitRadius113c(row, state.sourceSkillId, state.slvl, row.sHitPar1, 'auraRangeCalc', fallback)
        return { spawns, splash: { radiusSubtiles: r, excludeKey: hitKey }, outcome: 'default' }
      }
      // 2 PlagueJavelin / GasPotions (`0x6FC5E330` -> `0x6FC5D680`): 16-dir outer (`sHitPar2`, `Param1 << 7`)
      // + 15-entry inner (`sHitPar1`, `Param2 << 7`) `HitSubMissile1` gas clouds.
      case 'gasring16': {
        if (state.hitFired) return none('expire')
        state.hitFired = true
        const subName = row.hitSubMissile1.trim()
        if (subName !== '') {
          const subRow = this.registry.getMissileByName(subName)
          if (subRow === undefined) throw new Error(`Missiles.txt row '${subName}' not found`)
          const childDamage: OnlineMissileChildDamage113c =
            subRow.eMin > 0 || subRow.minDamage > 0 ? 'own' : 'inherit'
          const slowSpeed = subRow.param1 > 0 ? subRow.param1 / 2 / 16 : 0
          const outerStep = Math.max(1, row.sHitPar2)
          for (let i = 0; i < 16; i += outerStep) {
            const offX = GAS_CLOUD_RING16_X_113C[i]!
            const offY = GAS_CLOUD_RING16_Y_113C[i]!
            spawns.push({
              missileName: subName,
              x: impactX,
              y: impactY,
              targetX: impactX + offX,
              targetY: impactY + offY,
              damage: childDamage,
              speedSubTilesPerFrame: slowSpeed,
            })
          }
          if (row.sHitPar1 > 0) {
            const fastSpeed = subRow.param2 > 0 ? subRow.param2 / 2 / 16 : slowSpeed
            const innerStep = Math.max(1, row.sHitPar1)
            for (let i = 1; i < 16; i += innerStep) {
              const offX = GAS_CLOUD_RING16_X_113C[i]!
              const offY = GAS_CLOUD_RING16_Y_113C[i]!
              spawns.push({
                missileName: subName,
                x: impactX,
                y: impactY,
                targetX: impactX + offX,
                targetY: impactY + offY,
                damage: childDamage,
                speedSubTilesPerFrame: fastSpeed,
              })
            }
          }
        }
        return { spawns, splash: undefined, outcome: 'expire' }
      }
      // 25 PantherPotGreen (`0x6FC5DA60` -> `0x6FC5CB00`): 8-dir `HitSubMissile1` (`rancidgascloud`) ring at `Param1 << 7`.
      case 'gasring8': {
        if (state.hitFired) return none('expire')
        state.hitFired = true
        const subName = row.hitSubMissile1.trim()
        if (subName !== '') {
          const subRow = this.registry.getMissileByName(subName)
          if (subRow === undefined) throw new Error(`Missiles.txt row '${subName}' not found`)
          const childDamage: OnlineMissileChildDamage113c =
            subRow.eMin > 0 || subRow.minDamage > 0 ? 'own' : 'inherit'
          const slowSpeed = subRow.param1 > 0 ? subRow.param1 / 2 / 16 : 0
          const step = Math.max(1, row.sHitPar1)
          for (let i = 0; i < 8; i += step) {
            const offX = GAS_CLOUD_RING8_X_113C[i]!
            const offY = GAS_CLOUD_RING8_Y_113C[i]!
            spawns.push({
              missileName: subName,
              x: impactX,
              y: impactY,
              targetX: impactX + offX,
              targetY: impactY + offY,
              damage: childDamage,
              speedSubTilesPerFrame: slowSpeed,
            })
          }
        }
        return { spawns, splash: undefined, outcome: 'expire' }
      }
      // 4 Exploding / Freezing Arrow (`0x6FC5F220`): `HitSubMissile1` explodes at once with its own
      // `pSrvHitFunc` (`SrvHit01` radius `sHitPar1 = 5`, or `SrvHit14` for Royal Strike).
      case 'subexplode': {
        if (state.hitFired) return none('expire')
        state.hitFired = true
        const subName = row.hitSubMissile1.trim()
        const subRow = subName !== '' ? this.registry.getMissileByName(subName) : undefined
        if (subName !== '' && subRow === undefined) throw new Error(`Missiles.txt row '${subName}' not found`)
        if (subRow === undefined) {
          const r = this.resolveOnlineHitRadius113c(row, state.sourceSkillId, state.slvl, row.sHitPar1, 'calc1', 3)
          return { spawns, splash: { radiusSubtiles: r, excludeKey: hitKey }, outcome: 'expire' }
        }
        const sub = this.resolveOnlineMissileSrvHit113c(
          { ...state, row: subRow, hitFired: false },
          'expire',
          impactX,
          impactY,
          hitKey,
          targets,
          isBlocked,
        )
        return { spawns: sub.spawns, splash: sub.splash, outcome: 'expire' }
      }
      // 9 Immolation Arrow (`0x6FC5E0B0`): explosion radius `sHitPar2` else `max(1, calc2)`; fire patch
      // grid radius `sHitPar1` else `calc1`, patch life `sHitPar3` else `auraLenCalc`.
      case 'immolation': {
        if (state.hitFired) return none('expire')
        state.hitFired = true
        const r2 = this.resolveOnlineHitRadius113c(row, state.sourceSkillId, state.slvl, row.sHitPar2, 'calc2', 1)
        const sub = row.hitSubMissile1.trim()
        if (sub !== '') {
          const skill = this.resolveOnlineSkill113c(row, state.sourceSkillId)
          const r1 =
            row.sHitPar1 > 0
              ? row.sHitPar1
              : Math.trunc(this.evalOnlineSkillCalc113c(row, state.sourceSkillId, state.slvl, skill?.calc1 ?? ''))
          const len =
            row.sHitPar3 > 0
              ? row.sHitPar3
              : Math.trunc(this.evalOnlineSkillCalc113c(row, state.sourceSkillId, state.slvl, skill?.auraLenCalc ?? ''))
          for (let dy = -r1; dy <= r1; dy++) {
            for (let dx = -r1; dx <= r1; dx++) {
              if (dx * dx + dy * dy > r1 * r1) continue
              const fx = Math.round(impactX) + dx
              const fy = Math.round(impactY) + dy
              if (isBlocked !== undefined && isBlocked(fx, fy)) continue
              spawns.push({
                missileName: sub,
                x: fx,
                y: fy,
                targetX: fx,
                targetY: fy,
                damage: 'groundfire',
                ...(len > 0 ? { lifetimeFrames: len } : {}),
              })
            }
          }
        }
        return { spawns, splash: { radiusSubtiles: r2, excludeKey: hitKey }, outcome: 'expire' }
      }
      // 8 Blaze / Fire Wall persistent patch: never consumed by a hit.
      case 'persist':
        return none('pierce')
      // 10 GuidedArrow / BoneSpirit (`0x6FC5B140`): a unit-locked arrow passes cleanly through every
      // unit that is not its locked target.
      case 'homing': {
        if (trigger === 'unit' && state.lockedTargetKey !== undefined && hitKey !== state.lockedTargetKey) {
          const lockedAlive = targets.some((t) => t.key === state.lockedTargetKey)
          if (lockedAlive) return none('passthrough')
        }
        return none('default')
      }
      // 12 ChainLightning (`0x6FC5D020`): bounce to the nearest other hostile within `sHitPar1` else
      // `max(1, auraRangeCalc)` sub-tiles.
      case 'chain': {
        if (trigger === 'unit' && state.chainRemaining > 0 && hitKey !== undefined) {
          const r = this.resolveOnlineHitRadius113c(row, state.sourceSkillId, state.slvl, row.sHitPar1, 'auraRangeCalc', 20)
          let best: OnlineMissileTarget113c | undefined
          let bestD = Infinity
          for (const t of targets) {
            if (t.key === hitKey) continue
            const d = Math.hypot(t.x - impactX, t.y - impactY)
            if (d <= r && d < bestD) {
              bestD = d
              best = t
            }
          }
          if (best !== undefined) {
            spawns.push({
              missileName: row.name,
              x: impactX,
              y: impactY,
              targetX: best.x,
              targetY: best.y,
              damage: 'inherit',
              chainRemaining: state.chainRemaining - 1,
              excludeKey: hitKey,
            })
          }
        }
        return none('default')
      }
      // 14 MeteorCenter (`0x6FC5DEF0`): expiry-only (`(dwFlags >> 10) & 1` @ `0x6FC5DF84`, #2007) radial blast
      // `sHitPar1` else `max(1, auraRangeCalc)`, then `HitSubMissile1` ground fire over the 18-offset circle table,
      // life `Param3 + (slvl - 1) * Param4` (`SKILLS_GetParam34Linear` `0x6FC21A40` @ `0x6FC5E072`).
      case 'meteor': {
        if (trigger !== 'expire') return none(trigger === 'unit' ? 'passthrough' : 'expire')
        if (state.hitFired) return none('expire')
        state.hitFired = true
        const r1 = this.resolveOnlineHitRadius113c(row, state.sourceSkillId, state.slvl, row.sHitPar1, 'auraRangeCalc', 6)
        const sub = row.hitSubMissile1.trim()
        if (sub !== '') {
          const skill = this.resolveOnlineSkill113c(row, state.sourceSkillId)
          const life =
            skill !== undefined && (skill.param3 > 0 || skill.param4 > 0)
              ? skill.param3 + (Math.max(1, state.slvl) - 1) * skill.param4
              : 0
          const step = Math.max(1, row.sHitPar2 || 1)
          for (let i = 0; i < METEOR_FIRE_SUBTILE_OFFSETS.length; i += step) {
            const off = METEOR_FIRE_SUBTILE_OFFSETS[i]!
            const fx = impactX + off.x
            const fy = impactY + off.y
            if (isBlocked !== undefined && isBlocked(fx, fy)) continue
            spawns.push({
              missileName: sub,
              x: fx,
              y: fy,
              targetX: fx,
              targetY: fy,
              damage: 'groundfire',
              ...(life > 0 ? { lifetimeFrames: life } : {}),
            })
          }
        }
        return { spawns, splash: { radiusSubtiles: r1, excludeKey: undefined }, outcome: 'expire' }
      }
      // 20 Lightning Fury (`0x6FC5DD60`): up to `sHitPar2` else `max(1, calc1)` (= 1 + slvl) bolts at
      // the other hostiles within `sHitPar1` else `max(1, auraRangeCalc)` (15) sub-tiles. The javelin
      // (`CollideKill = 1`) is consumed by the impact.
      case 'fury': {
        if (trigger !== 'unit') return none('expire')
        if (state.hitFired) return none('expire')
        state.hitFired = true
        const sub = row.hitSubMissile1.trim()
        if (sub !== '') {
          const maxBolts = this.resolveOnlineHitRadius113c(row, state.sourceSkillId, state.slvl, row.sHitPar2, 'calc1', 1 + Math.max(1, state.slvl))
          const r = this.resolveOnlineHitRadius113c(row, state.sourceSkillId, state.slvl, row.sHitPar1, 'auraRangeCalc', 15)
          const inRange = targets
            .filter((t) => t.key !== hitKey && Math.hypot(t.x - impactX, t.y - impactY) <= r)
            .sort((a, b) => Math.hypot(a.x - impactX, a.y - impactY) - Math.hypot(b.x - impactX, b.y - impactY))
          for (const t of inRange.slice(0, Math.max(0, Math.trunc(maxBolts)))) {
            spawns.push({
              missileName: sub,
              x: impactX,
              y: impactY,
              targetX: t.x,
              targetY: t.y,
              damage: 'inherit',
              ...(hitKey !== undefined ? { excludeKey: hitKey } : {}),
            })
          }
        }
        return none('expire')
      }
      // 29 FrozenOrb (`0x6FC5C850`): a mid-flight unit touch returns 2 (damage, orb survives, no nova);
      // range end or a wall releases `HitSubMissile1` every `sHitPar1` (4) circle entries = 16 novas.
      case 'orbnova': {
        if (trigger === 'unit') return none('pierce')
        if (state.hitFired) return none('expire')
        state.hitFired = true
        const sub = row.hitSubMissile1.trim()
        if (sub !== '') {
          const step = Math.max(1, row.sHitPar1)
          for (let i = 0; i < 64; i += step) {
            const offX = FROZEN_ORB_X_POSITIONS[i]!
            const offY = FROZEN_ORB_Y_POSITIONS[i]!
            spawns.push({
              missileName: sub,
              x: impactX,
              y: impactY,
              targetX: impactX + offX,
              targetY: impactY + offY,
              damage: 'inherit',
              targetOffsetX: offX,
              targetOffsetY: offY,
            })
          }
        }
        return none('expire')
      }
      default:
        return none('default')
    }
  }

  /**
   * Spawns authentic 1.13c 64-bolt circular Nova ring with 2:1 isometric ground foreshortening.
   * Velocity and acceleration (`Vel = 24, MaxVel = 24, Accel = -1000`, `× 75/100`) are derived from `Missiles.txt`.
   */
  spawnNovaRing(params: {
    sourceSkillId?: number
    slvl?: number
    owner: CombatUnitContext
    startX: number
    startY: number
    dmgPacket: SUnitDmgPacket
    missileName?: string
  }): ActiveMissile[] {
    const spawned: ActiveMissile[] = []
    const skillId = params.sourceSkillId ?? 48
    const slvl = params.slvl ?? 1
    const skillRec = this.registry.getSkillById(skillId)
    const missileName =
      params.missileName ?? (skillRec?.srvMissileA || skillRec?.srvMissile || 'nova')
    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * 2 * Math.PI
      const m = this.spawnMissile({
        missileNameOrId: missileName,
        sourceSkillId: skillId,
        slvl,
        owner: params.owner,
        startX: params.startX,
        startY: params.startY,
        targetX: params.startX + Math.cos(angle) * 100,
        targetY: params.startY + Math.sin(angle) * 100 * ISO_GROUND_ASPECT_RATIO,
        dmgPacket: params.dmgPacket,
        angleRad: angle,
        isoGroundForeshorten: true,
      })
      if (m) spawned.push(m)
    }
    return spawned
  }

  /**
   * Spawns authentic 1.13c Multiple Shot volley (Skill 12):
   * - Arrow count: min(24, 1 + slvl)
   * - Fan arc spread (~45-50 degrees) symmetric around aim vector
   * - 75% weapon damage (srcDam = 96)
   * - Center 2 arrows flagged to trigger procs; outer arrows cannot
   * - Shared volleyId enforces single-target hit immunity
   */
  spawnMultipleShotVolley(params: {
    sourceSkillId?: number
    slvl: number
    owner: CombatUnitContext
    startX: number
    startY: number
    targetX: number
    targetY: number
    dmgPacket: SUnitDmgPacket
    missileName?: string
  }): ActiveMissile[] {
    const stats = calculateMultipleShotStats(params.slvl)
    const arrowCount = stats.arrowCount
    const dx = params.targetX - params.startX
    const dy = (params.targetY - params.startY) / ISO_GROUND_ASPECT_RATIO
    const aimAngleRad = dx === 0 && dy === 0 ? Math.PI / 2 : Math.atan2(dy, dx)
    const angles = generateMultipleShotAngles(aimAngleRad, arrowCount, (50 * Math.PI) / 180)
    const volleyId = `ms-volley-${String(this.uidCounter++)}`
    const missiles: ActiveMissile[] = []
    const missileName = params.missileName || 'arrow'

    for (let i = 0; i < arrowCount; i += 1) {
      const angle = angles[i]!
      const canTriggerProcs = isMultipleShotCenterArrow(i, arrowCount)
      const m = this.spawnMissile({
        missileNameOrId: missileName,
        sourceSkillId: params.sourceSkillId ?? 12,
        slvl: params.slvl,
        owner: params.owner,
        startX: params.startX,
        startY: params.startY,
        targetX: params.startX + Math.cos(angle) * 200,
        targetY: params.startY + Math.sin(angle) * 200 * ISO_GROUND_ASPECT_RATIO,
        angleRad: angle,
        dmgPacket: {
          ...params.dmgPacket,
          srcDam: 96,
          canTriggerProcs,
        },
        volleyId,
        canTriggerProcs,
      })
      if (m) missiles.push(m)
    }
    return missiles
  }

  /**
   * Spawns authentic 1.13c Strafe sequence (Skill 26):
   * - Arrow count: min(10, 3 + slvl), clamped by alive target count with floor minArrows = 2 + floor(slvl/4)
   * - Cycles target acquisition among alive nearby enemies
   * - 75% weapon damage (srcDam = 96) + Enhanced Damage bonus (+5%/lvl)
   * - Locks caster in stationary state for lockInFrames
   */
  spawnStrafeVolley(params: {
    sourceSkillId?: number
    slvl: number
    owner: CombatUnitContext
    startX: number
    startY: number
    targets?: readonly CombatUnitContext[]
    targetPositions?: ReadonlyMap<string, { x: number; y: number }>
    targetX?: number
    targetY?: number
    dmgPacket: SUnitDmgPacket
    missileName?: string
  }): ActiveMissile[] {
    const stats = calculateStrafeStats(params.slvl)
    const aliveTargets = params.targets ? params.targets.filter(t => t.statList.getHp256() > 0) : []
    const arrowCount =
      aliveTargets.length > 0
        ? Math.min(stats.arrowCount, Math.max(stats.minArrows, aliveTargets.length))
        : stats.arrowCount
    const missiles: ActiveMissile[] = []
    const missileName = params.missileName || 'arrow'

    // Strafe stationary lock-in state on player
    params.owner.stateBus.applyState({
      stateNameOrId: 'strafe_lockin',
      sourceSkillId: 26,
      slvl: params.slvl,
      durationFrames: stats.lockInFrames,
    })

    for (let i = 0; i < arrowCount; i += 1) {
      let tX = params.targetX ?? params.startX + 200
      let tY = params.targetY ?? params.startY
      if (aliveTargets.length > 0) {
        const assignedTarget = aliveTargets[i % aliveTargets.length]!
        const pos = params.targetPositions
          ? this.resolveUnitPosition(assignedTarget, params.targetPositions)
          : assignedTarget.x !== undefined && assignedTarget.y !== undefined
            ? { x: assignedTarget.x, y: assignedTarget.y }
            : undefined
        if (pos) {
          tX = pos.x
          tY = pos.y
        }
      }
      const dx = tX - params.startX
      const dy = (tY - params.startY) / ISO_GROUND_ASPECT_RATIO
      const angle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx)
      const m = this.spawnMissile({
        missileNameOrId: missileName,
        sourceSkillId: params.sourceSkillId ?? 26,
        slvl: params.slvl,
        owner: params.owner,
        startX: params.startX,
        startY: params.startY,
        targetX: tX,
        targetY: tY,
        angleRad: angle,
        dmgPacket: {
          ...params.dmgPacket,
          srcDam: 96,
          physDamagePct: (params.dmgPacket.physDamagePct ?? 0) + stats.enhancedDamagePct,
          canTriggerProcs: true,
        },
        canTriggerProcs: true,
      })
      if (m) missiles.push(m)
    }
    return missiles
  }

  /**
   * Executes authentic 1.13c instantaneous 360° Static Field discharge with difficulty floors and LOS.
   * Cuts 25% current HP with Normal (1 HP), Nightmare (33% max HP), and Hell (50% max HP) pre-check clamps.
   */
  executeStaticField(params: {
    caster: CombatUnitContext
    casterPos: { x: number; y: number }
    slvl?: number
    targets: readonly CombatUnitContext[]
    targetPositions: ReadonlyMap<string, { x: number; y: number }>
    difficulty?: 'normal' | 'nightmare' | 'hell'
    terrain?: MissileTerrainCollision
  }): {
    hits: {
      targetId: string
      damage: number
      immune: boolean
      blockedByFloor: boolean
      blockedByLos: boolean
    }[]
    radiusPx: number
  } {
    const slvl = params.slvl ?? 1
    const radiusPx = calculateStaticFieldRadiusPx(slvl)
    const difficulty = params.difficulty ?? 'normal'
    const effectiveTerrain = params.terrain ?? this.terrain
    const hits: {
      targetId: string
      damage: number
      immune: boolean
      blockedByFloor: boolean
      blockedByLos: boolean
    }[] = []

    for (const target of params.targets) {
      if (target.statList.getHp256() <= 0) continue
      const pos = this.resolveUnitPosition(target, params.targetPositions)
      if (!pos) continue
      const dist = Math.hypot(pos.x - params.casterPos.x, pos.y - params.casterPos.y)
      if (dist > radiusPx) continue

      const los = effectiveTerrain
        ? hasLineOfSight(params.casterPos.x, params.casterPos.y, pos.x, pos.y, effectiveTerrain)
        : true
      if (!los) {
        hits.push({
          targetId: target.id,
          damage: 0,
          immune: false,
          blockedByFloor: false,
          blockedByLos: true,
        })
        continue
      }

      const currentHp = target.statList.getHp()
      const maxHp = target.statList.getMaxHp() || currentHp
      const ltngRes = target.statList.getAccruedStat('lightresist') || 0
      const res = calculateStaticFieldDamage(currentHp, maxHp, difficulty, ltngRes)

      if (res.damage > 0) {
        target.statList.setHp256(target.statList.getHp256() - res.damage * 256)
      }

      hits.push({
        targetId: target.id,
        damage: res.damage,
        immune: res.immune,
        blockedByFloor: res.blockedByFloor,
        blockedByLos: false,
      })
    }

    return { hits, radiusPx }
  }
}

/**
 * Standalone helper to spawn 64 radial Projectile objects for Nova with 2:1 isometric ground foreshortening.
 */
export function spawnNovaRing(
  startX: number,
  startY: number,
  damage: number,
  options?: {
    skillId?: string
    missileType?: string
    fromPlayer?: boolean
    speed?: number
    ttl?: number
    statusEffect?: 'chill' | 'freeze' | 'poison'
    statusDuration?: number
  }
): {
  skillId: string
  missileType: string
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  ttl: number
  fromPlayer: boolean
  nextDelay: number
  statusEffect?: 'chill' | 'freeze' | 'poison'
  statusDuration?: number
}[] {
  const speed = options?.speed ?? 24 // 1.13c Missiles.txt: vel = 24 (600 px/s)
  const ttl = options?.ttl ?? 13
  const skillId = options?.skillId ?? '48'
  const missileType = options?.missileType ?? 'nova'
  const fromPlayer = options?.fromPlayer ?? true
  const statusEffect = options?.statusEffect
  const statusDuration = options?.statusDuration
  const bolts: {
    skillId: string
    missileType: string
    x: number
    y: number
    vx: number
    vy: number
    damage: number
    ttl: number
    fromPlayer: boolean
    nextDelay: number
    statusEffect?: 'chill' | 'freeze' | 'poison'
    statusDuration?: number
  }[] = []

  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * 2 * Math.PI
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed * ISO_GROUND_ASPECT_RATIO

    bolts.push({
      skillId,
      missileType,
      x: startX,
      y: startY,
      vx,
      vy,
      damage,
      ttl,
      fromPlayer,
      nextDelay: 4,
      ...(statusEffect !== undefined ? { statusEffect } : {}),
      ...(statusDuration !== undefined ? { statusDuration } : {}),
    })
  }

  return bolts
}

/**
 * Spawns 64 radial Frost Nova (Skill 44) missiles with 2:1 isometric ground foreshortening.
 * In 1.13c: Exactly 64 missiles emitted radially (360 degrees), Vel = 24 (600 px/s), Range = 14 frames (336 px).
 */
export function spawnFrostNovaRing(
  startX: number,
  startY: number,
  damage: number,
  options?: {
    skillId?: string
    fromPlayer?: boolean
    speed?: number
    ttl?: number
    slvl?: number
    statusDuration?: number
  }
) {
  const slvl = options?.slvl ?? 1
  const statusDuration = options?.statusDuration ?? calculateFrostNovaChillLength(slvl)
  return spawnNovaRing(startX, startY, damage, {
    skillId: options?.skillId ?? '44',
    missileType: 'frostnova',
    fromPlayer: options?.fromPlayer ?? true,
    speed: options?.speed ?? 24,
    ttl: options?.ttl ?? 14,
    statusEffect: 'chill',
    statusDuration,
  })
}

/**
 * Spawns 64 radial Poison Nova (Skill 92) missiles with 2:1 isometric ground foreshortening.
 * In 1.13c: Exactly 64 missiles emitted radially (360 degrees), fixed 2.0s duration (50 frames).
 */
export function spawnPoisonNovaRing(
  startX: number,
  startY: number,
  damage: number,
  options?: {
    skillId?: string
    fromPlayer?: boolean
    ttl?: number
  }
) {
  return spawnNovaRing(startX, startY, damage, {
    skillId: options?.skillId ?? '92',
    missileType: 'poisonnova',
    fromPlayer: options?.fromPlayer ?? true,
    speed: 12,
    ttl: options?.ttl ?? 50,
    statusEffect: 'poison',
    statusDuration: 50,
  })
}

export interface StaticFieldTarget {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly currentHp: number
  readonly maxHp: number
  readonly lightResist?: number
}

/**
 * Standalone helper to execute 1.13c Static Field on target records.
 */
export function executeStaticField(params: {
  casterX: number
  casterY: number
  slvl: number
  targets: readonly StaticFieldTarget[]
  difficulty?: 'normal' | 'nightmare' | 'hell'
  isBlocked?: ((x: number, y: number, fromX?: number, fromY?: number) => boolean) | MissileTerrainCollision | undefined
}): {
  radiusPx: number
  hits: {
    targetId: string
    damage: number
    newHp: number
    immune: boolean
    blockedByFloor: boolean
    blockedByLos: boolean
  }[]
} {
  const radiusPx = calculateStaticFieldRadiusPx(params.slvl)
  const difficulty = params.difficulty ?? 'normal'
  const hits: {
    targetId: string
    damage: number
    newHp: number
    immune: boolean
    blockedByFloor: boolean
    blockedByLos: boolean
  }[] = []

  for (const t of params.targets) {
    const dist = Math.hypot(t.x - params.casterX, t.y - params.casterY)
    if (dist > radiusPx) continue

    if (params.isBlocked && !hasLineOfSight(params.casterX, params.casterY, t.x, t.y, params.isBlocked)) {
      hits.push({
        targetId: t.id,
        damage: 0,
        newHp: t.currentHp,
        immune: false,
        blockedByFloor: false,
        blockedByLos: true,
      })
      continue
    }

    const res = calculateStaticFieldDamage(t.currentHp, t.maxHp, difficulty, t.lightResist ?? 0)
    hits.push({
      targetId: t.id,
      damage: res.damage,
      newHp: res.newHp,
      immune: res.immune,
      blockedByFloor: res.blockedByFloor,
      blockedByLos: false,
    })
  }

  return { radiusPx, hits }
}

/**
 * Authentic 1.13c Lightning Mastery (Skill 63) passive bonus percentage:
 * Skills.txt row 63: Param1: 50, Param2: 12.
 * Formula: 50 + (slvl - 1) * 12 percent.
 * Level 1 -> 50%, Level 2 -> 62%, Level 10 -> 158%, Level 20 -> 278%.
 */
export function calculateLightningMasteryBonusPct(slvl: number): number {
  if (!Number.isFinite(slvl) || slvl <= 0) return 0
  const lvl = Math.floor(slvl)
  return 50 + (lvl - 1) * 12
}

/**
 * Authentic 1.13c Thunder Storm (Skill 57) duration in frames (Skills.txt row 57):
 * Param1: 800, Param2: 200.
 * Duration: 800 + (slvl - 1) * 200 frames (32s base + 8s/lvl).
 */
export function calculateThunderStormDuration(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 800 + (lvl - 1) * 200
}

/**
 * Authentic 1.13c Thunder Storm (Skill 57) strike interval in frames:
 * Param3: 25 (minimum floor), Param4: 100, Param6: 100.
 * Standard 1.13c hyperbolic cadence formula:
 * interval = Math.max(25, 125 - Math.floor((110 * slvl) / (slvl + 6))) frames.
 * Level 1 -> 110 frames (4.4s), Level 10 -> 57 frames (2.28s), Level 20 -> 41 frames (1.64s).
 */
export function calculateThunderStormInterval(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return Math.max(25, 125 - Math.floor((110 * lvl) / (lvl + 6)))
}

/**
 * Authentic 1.13c Thunder Storm (Skill 57) 5-band damage scaling (Skills.txt row 57):
 * EMin: 1, EMinLev1..5: 10, 10, 11, 11, 11
 * EMax: 100, EMaxLev1..5: 10, 10, 11, 11, 11
 * 0 synergies in 1.13c.
 * Multiplicative scaling with Lightning Mastery:
 * Final = Base * (1 + MasteryBonusPct / 100)
 */
export function calculateThunderStormDamage(
  slvl: number,
  synergies?: {
    readonly lightningMastery?: number | undefined
  } | number,
  lightningMastery?: number,
): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let min = 1
  let max = 100
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    min += b1 * 10
    max += b1 * 10
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * 10
      max += b2 * 10
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * 11
      max += b3 * 11
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * 11
      max += b4 * 11
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * 11
      max += b5 * 11
    }
  }

  const masteryLvl =
    typeof lightningMastery === 'number'
      ? lightningMastery
      : typeof synergies === 'object' && synergies !== null
        ? synergies.lightningMastery ?? 0
        : 0
  const masteryBonus = masteryLvl > 0 ? calculateLightningMasteryBonusPct(masteryLvl) : 0
  const synMult = typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0

  min = Math.floor(min * synMult * (1 + masteryBonus / 100))
  max = Math.floor(max * synMult * (1 + masteryBonus / 100))
  return { min, max }
}

/**
 * Authentic 1.13c Energy Shield (Skill 58) duration in frames (Skills.txt row 58):
 * Param1: 3600, Param2: 1500.
 * Duration: 3600 + (slvl - 1) * 1500 frames (144s base + 60s/lvl).
 */
export function calculateEnergyShieldDuration(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 3600 + (lvl - 1) * 1500
}

/**
 * Authentic 1.13c Energy Shield (Skill 58) damage absorption percentage (Skills.txt row 58):
 * EMin: 20, EMinLev1: 5 (lvl 2-8), EMinLev2: 2 (lvl 9-16), EMinLev3..5: 1 (lvl 17+).
 * Hard cap: 95% (achieved at level 40).
 */
export function calculateEnergyShieldAbsorbPct(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let pct = 20
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    pct += b1 * 5
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      pct += b2 * 2
    }
    if (lvl > 16) {
      const b3 = lvl - 16
      pct += b3 * 1
    }
  }
  return Math.min(95, pct)
}

/**
 * Authentic 1.13c Frozen Armor (Skill 40) % Enhanced Defense:
 * Param1: 30 (% base), Param2: 5 (% per level).
 * Formula: 30 + (slvl - 1) * 5.
 * Level 1 -> 30%, Level 10 -> 75%, Level 20 -> 125%.
 */
export function calculateFrozenArmorDefense(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 30 + (lvl - 1) * 5
}

/**
 * Authentic 1.13c Frozen Armor (Skill 40) duration in frames:
 * Param3: 3000 (120s base), Param4: 300 (+12s/lvl), Param7: 250 (+10s/syn).
 * Default 1.13c: 3000 + (slvl - 1) * 300 + synPoints * 250.
 * If options.base1200 is set: 1200 + (slvl - 1) * 120 + synPoints * 120.
 */
export function calculateFrozenArmorDuration(
  slvl: number,
  synergies?: { shiverArmor?: number; chillingArmor?: number } | number,
  options?: { base1200?: boolean },
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const synPoints = Math.max(
    0,
    typeof synergies === 'number'
      ? synergies
      : (synergies?.shiverArmor ?? 0) + (synergies?.chillingArmor ?? 0),
  )
  if (options?.base1200) {
    return Math.floor((1200 + (lvl - 1) * 120) * (1 + (synPoints * 10) / 100))
  }
  return 3000 + (lvl - 1) * 300 + synPoints * 250
}

/**
 * Authentic 1.13c Frozen Armor (Skill 40) freeze length in frames (calc1):
 * Param5: 30 (1.2s base), Param6: 3 (+0.12s/lvl), Param8: 5 (+5% freeze length per synergy point).
 * Formula: Math.floor((30 + (slvl - 1) * 3) * (100 + synPoints * 5) / 100).
 * Level 1 -> 30 frames (1.20s), Level 10 -> 57 frames (2.28s), Level 20 -> 87 frames (3.48s).
 */
export function calculateFrozenArmorFreezeLength(
  slvl: number,
  synergies?: { shiverArmor?: number; chillingArmor?: number } | number,
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const synPoints = Math.max(
    0,
    typeof synergies === 'number'
      ? synergies
      : (synergies?.shiverArmor ?? 0) + (synergies?.chillingArmor ?? 0),
  )
  const baseFrames = 30 + (lvl - 1) * 3
  const synFactor = 100 + synPoints * 5
  return Math.floor((baseFrames * synFactor) / 100)
}

/**
 * Authentic 1.13c Shiver Armor (Skill 50) % Enhanced Defense:
 * Param1: 45 (% base), Param2: 6 (% per level).
 * Formula: 45 + (slvl - 1) * 6.
 * Level 1 -> 45%, Level 10 -> 99%, Level 20 -> 159%.
 */
export function calculateShiverArmorDefense(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 45 + (lvl - 1) * 6
}

/**
 * Authentic 1.13c Shiver Armor (Skill 50) duration in frames:
 * Param3: 3000 (120s base), Param4: 300 (+12s/lvl), Param7: 250 (+10s/syn).
 * Default 1.13c: 3000 + (slvl - 1) * 300 + synPoints * 250.
 */
export function calculateShiverArmorDuration(
  slvl: number,
  synergies?: { frozenArmor?: number; chillingArmor?: number } | number,
  options?: { base1200?: boolean },
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const synPoints = Math.max(
    0,
    typeof synergies === 'number'
      ? synergies
      : (synergies?.frozenArmor ?? 0) + (synergies?.chillingArmor ?? 0),
  )
  if (options?.base1200) {
    return Math.floor((1200 + (lvl - 1) * 120) * (1 + (synPoints * 10) / 100))
  }
  return 3000 + (lvl - 1) * 300 + synPoints * 250
}

/**
 * Authentic 1.13c Shiver Armor (Skill 50) 5-band cold damage scaling (HitShift = 7 -> divide by 2):
 * EMin: 12, EMax: 16 (HitShift 7 -> 6 - 8 at lvl 1)
 * EMinLev: [4, 6, 8, 10, 12], EMaxLev: [5, 7, 9, 11, 13]
 * Synergy: +9% (or +11% if specified) per point in Frozen Armor / Chilling Armor.
 */
export function calculateShiverArmorDamage(
  slvl: number,
  synergies?: { frozenArmor?: number; chillingArmor?: number; synPctPerLvl?: number } | number,
  options?: { synPctPerLvl?: number; synMultiplier?: number },
): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let rawMin = 12
  let rawMax = 16
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    rawMin += b1 * 4
    rawMax += b1 * 5
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      rawMin += b2 * 6
      rawMax += b2 * 7
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      rawMin += b3 * 8
      rawMax += b3 * 9
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      rawMin += b4 * 10
      rawMax += b4 * 11
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      rawMin += b5 * 12
      rawMax += b5 * 13
    }
  }

  let min = rawMin / 2
  let max = rawMax / 2

  let synMultiplier = 1.0
  if (typeof options?.synMultiplier === 'number' && Number.isFinite(options.synMultiplier)) {
    synMultiplier = Math.max(0, options.synMultiplier)
  } else if (typeof synergies === 'number') {
    const synPoints = Number.isFinite(synergies) ? Math.max(0, synergies) : 0
    const pctPerLvl = options?.synPctPerLvl ?? 9
    synMultiplier = 1.0 + (synPoints * pctPerLvl) / 100
  } else if (typeof synergies === 'object' && synergies !== null) {
    const synPoints = Math.max(0, (synergies.frozenArmor ?? 0) + (synergies.chillingArmor ?? 0))
    const pctPerLvl = options?.synPctPerLvl ?? synergies.synPctPerLvl ?? 9
    synMultiplier = 1.0 + (synPoints * pctPerLvl) / 100
  }

  min = Math.floor((min * synMultiplier + 1e-9) * 10) / 10
  max = Math.floor((max * synMultiplier + 1e-9) * 10) / 10
  return { min, max }
}

/**
 * Authentic 1.13c Shiver Armor (Skill 50) chill length in frames:
 * ELen: 100 frames base (4.0s). ELevLen1: 0, ELevLen2: 25 frames (lvl 9-16), ELevLen3: 50 frames (lvl 17+).
 * Level 1-8: 100 frames (4.0s), Level 10: 150 frames (6.0s), Level 20: 500 frames (20.0s).
 * Optional synergy: +7% chill length per synergy point.
 */
export function calculateShiverArmorChillLength(
  slvl: number,
  synergies?: { frozenArmor?: number; chillingArmor?: number } | number,
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let frames = 100
  if (lvl > 8) {
    const b2 = Math.min(lvl - 8, 8)
    frames += b2 * 25
  }
  if (lvl > 16) {
    const b3 = lvl - 16
    frames += b3 * 50
  }
  const synPoints = Math.max(
    0,
    typeof synergies === 'number'
      ? synergies
      : (synergies?.frozenArmor ?? 0) + (synergies?.chillingArmor ?? 0),
  )
  if (synPoints > 0) {
    frames = Math.floor((frames * (100 + synPoints * 7)) / 100)
  }
  return frames
}

/**
 * Authentic 1.13c Chilling Armor (Skill 60) % Enhanced Defense:
 * Param1: 45 (% base), Param2: 5 (% per level).
 * Formula: 45 + (slvl - 1) * 5.
 * Level 1 -> 45%, Level 10 -> 90%, Level 20 -> 140%.
 */
export function calculateChillingArmorDefense(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 45 + (lvl - 1) * 5
}

/**
 * Authentic 1.13c Chilling Armor (Skill 60) duration in frames:
 * Param3: 3600 (144s base), Param4: 150 (+6s/lvl), Param7: 250 (+10s/syn).
 * Default 1.13c: 3600 + (slvl - 1) * 150 + synPoints * 250.
 */
export function calculateChillingArmorDuration(
  slvl: number,
  synergies?: { frozenArmor?: number; shiverArmor?: number } | number,
  options?: { base1200?: boolean },
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const synPoints = Math.max(
    0,
    typeof synergies === 'number'
      ? synergies
      : (synergies?.frozenArmor ?? 0) + (synergies?.shiverArmor ?? 0),
  )
  if (options?.base1200) {
    return Math.floor((1200 + (lvl - 1) * 120) * (1 + (synPoints * 10) / 100))
  }
  return 3600 + (lvl - 1) * 150 + synPoints * 250
}

/**
 * Authentic 1.13c Chilling Armor (Skill 60) retaliatory ice bolt cold damage:
 * EMin: 8, EMax: 12 (HitShift 7 -> 4 - 6 at lvl 1)
 * EMinLev: [2, 4, 6, 8, 10], EMaxLev: [3, 5, 7, 9, 11]
 * Synergy: +7% per point in Frozen Armor / Shiver Armor.
 */
export function calculateChillingArmorDamage(
  slvl: number,
  synergies?: { frozenArmor?: number; shiverArmor?: number; synPctPerLvl?: number } | number,
  options?: { synPctPerLvl?: number; synMultiplier?: number },
): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let rawMin = 8
  let rawMax = 12
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    rawMin += b1 * 2
    rawMax += b1 * 3
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      rawMin += b2 * 4
      rawMax += b2 * 5
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      rawMin += b3 * 6
      rawMax += b3 * 7
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      rawMin += b4 * 8
      rawMax += b4 * 9
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      rawMin += b5 * 10
      rawMax += b5 * 11
    }
  }

  let min = rawMin / 2
  let max = rawMax / 2

  let synMultiplier = 1.0
  if (typeof options?.synMultiplier === 'number' && Number.isFinite(options.synMultiplier)) {
    synMultiplier = Math.max(0, options.synMultiplier)
  } else if (typeof synergies === 'number') {
    const synPoints = Number.isFinite(synergies) ? Math.max(0, synergies) : 0
    const pctPerLvl = options?.synPctPerLvl ?? 7
    synMultiplier = 1.0 + (synPoints * pctPerLvl) / 100
  } else if (typeof synergies === 'object' && synergies !== null) {
    const synPoints = Math.max(0, (synergies.frozenArmor ?? 0) + (synergies.shiverArmor ?? 0))
    const pctPerLvl = options?.synPctPerLvl ?? synergies.synPctPerLvl ?? 7
    synMultiplier = 1.0 + (synPoints * pctPerLvl) / 100
  }

  min = Math.floor((min * synMultiplier + 1e-9) * 10) / 10
  max = Math.floor((max * synMultiplier + 1e-9) * 10) / 10
  return { min, max }
}

/**
 * Authentic 1.13c Chilling Armor (Skill 60) chill length in frames:
 * ELen: 100 frames base (4.0s). ELevLen1: 0, ELevLen2: 25 frames, ELevLen3: 25 frames.
 * Level 1-8: 100 frames (4.0s), Level 10: 150 frames (6.0s), Level 20: 400 frames (16.0s).
 * Optional synergy: +10% chill length per synergy point.
 */
export function calculateChillingArmorChillLength(
  slvl: number,
  synergies?: { frozenArmor?: number; shiverArmor?: number } | number,
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let frames = 100
  if (lvl > 8) {
    const b2 = Math.min(lvl - 8, 8)
    frames += b2 * 25
  }
  if (lvl > 16) {
    const b3 = lvl - 16
    frames += b3 * 25
  }
  const synPoints = Math.max(
    0,
    typeof synergies === 'number'
      ? synergies
      : (synergies?.frozenArmor ?? 0) + (synergies?.shiverArmor ?? 0),
  )
  if (synPoints > 0) {
    frames = Math.floor((frames * (100 + synPoints * 10)) / 100)
  }
  return frames
}

/**
 * Standard Cold Armor base duration calculator (1200f base + 120f/lvl = 48s + 4.8s/lvl):
 */
export function calculateColdArmorDuration(
  slvl: number,
  baseFrames = 1200,
  perLvlFrames = 120,
  synBonusPct = 10,
  synPoints = 0,
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const safeSyn = Math.max(0, synPoints)
  return Math.floor((baseFrames + (lvl - 1) * perLvlFrames) * (1 + (safeSyn * synBonusPct) / 100))
}

/**
 * Authentic 1.13c Ice Blast (Skill 45) 5-band cold damage scaling (HitShift = 7 -> divide by 2):
 * EMin: 16, EMax: 24 (HitShift 7 -> 8 - 12 at lvl 1)
 * EMinLev: [14, 28, 42, 56, 70] / 2 -> [7, 14, 21, 28, 35]
 * EMaxLev: [15, 29, 43, 57, 71] / 2 -> [7.5, 14.5, 21.5, 28.5, 35.5]
 * Level 1: 8 - 12
 * Level 2-8: +7 min, +7.5 max per level (b1 = slvl - 1)
 * Level 9-16: +14 min, +14.5 max per level (b2 = slvl - 8)
 * Level 17-22: +21 min, +21.5 max per level (b3 = slvl - 16)
 * Level 23-28: +28 min, +28.5 max per level (b4 = slvl - 22)
 * Level 29+: +35 min, +35.5 max per level (b5 = slvl - 28)
 * Level 1: 8 - 12
 * Level 10: 85 - 93.5
 * Level 20: 253 - 266.5
 * Synergies: +8% cold damage per point from Ice Bolt, Blizzard, Frozen Orb, Glacial Spike.
 */
export function calculateIceBlastDamage(
  slvl: number,
  synergies?: {
    iceBolt?: number
    blizzard?: number
    frozenOrb?: number
    glacialSpike?: number
    synPctPerLvl?: number
  } | number,
  options?: { synPctPerLvl?: number; synMultiplier?: number },
): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let rawMin = 16
  let rawMax = 24
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    rawMin += b1 * 14
    rawMax += b1 * 15
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      rawMin += b2 * 28
      rawMax += b2 * 29
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      rawMin += b3 * 42
      rawMax += b3 * 43
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      rawMin += b4 * 56
      rawMax += b4 * 57
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      rawMin += b5 * 70
      rawMax += b5 * 71
    }
  }

  let min = rawMin / 2
  let max = rawMax / 2

  let synMultiplier = 1.0
  if (typeof options?.synMultiplier === 'number' && Number.isFinite(options.synMultiplier)) {
    synMultiplier = Math.max(0, options.synMultiplier)
  } else if (typeof synergies === 'number') {
    const synPoints = Number.isFinite(synergies) ? Math.max(0, synergies) : 0
    const pctPerLvl = options?.synPctPerLvl ?? 8
    synMultiplier = 1.0 + (synPoints * pctPerLvl) / 100
  } else if (typeof synergies === 'object' && synergies !== null) {
    const synPoints = Math.max(
      0,
      (synergies.iceBolt ?? 0) +
        (synergies.blizzard ?? 0) +
        (synergies.frozenOrb ?? 0) +
        (synergies.glacialSpike ?? 0),
    )
    const pctPerLvl = options?.synPctPerLvl ?? synergies.synPctPerLvl ?? 8
    synMultiplier = 1.0 + (synPoints * pctPerLvl) / 100
  }

  min = Math.floor((min * synMultiplier + 1e-9) * 10) / 10
  max = Math.floor((max * synMultiplier + 1e-9) * 10) / 10
  return { min, max }
}

/**
 * Authentic 1.13c Ice Blast (Skill 45) freeze length in frames:
 * Param1: 75 frames base (3.0s), Param2 / ELevLen1: 5 frames/lvl (0.20s/lvl).
 * Formula: 75 + (slvl - 1) * 5.
 * Level 1 -> 75 frames (3.00s), Level 10 -> 120 frames (4.80s), Level 20 -> 170 frames (6.80s).
 * Synergy: +10% freeze length per point from Glacial Spike (and Ice Bolt if passed).
 * Formula: Math.floor(((75 + (slvl - 1) * 5) * (100 + synPoints * 10)) / 100).
 */
export function calculateIceBlastFreezeLength(
  slvl: number,
  synergies?: { glacialSpike?: number; iceBolt?: number } | number,
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const synPoints = Math.max(
    0,
    typeof synergies === 'number'
      ? synergies
      : (synergies?.glacialSpike ?? 0) + (synergies?.iceBolt ?? 0),
  )
  const baseFrames = 75 + (lvl - 1) * 5
  const synFactor = 100 + synPoints * 10
  return Math.floor((baseFrames * synFactor) / 100)
}

/**
 * Authentic 1.13c Glacial Spike (Skill 55) 5-band cold damage scaling (HitShift = 7 -> divide by 2):
 * EMin: 32, EMax: 48 (HitShift 7 -> 16 - 24 at lvl 1)
 * EMinLev: [14, 26, 28, 30, 32] / 2 -> [7, 13, 14, 15, 16]
 * EMaxLev: [15, 27, 29, 31, 33] / 2 -> [7.5, 13.5, 14.5, 15.5, 16.5]
 * Level 1: 16 - 24
 * Level 2-8: +7 min, +7.5 max per level (b1 = slvl - 1)
 * Level 9-16: +13 min, +13.5 max per level (b2 = slvl - 8)
 * Level 17-22: +14 min, +14.5 max per level (b3 = slvl - 16)
 * Level 23-28: +15 min, +15.5 max per level (b4 = slvl - 22)
 * Level 29+: +16 min, +16.5 max per level (b5 = slvl - 28)
 * Level 1: 16 - 24
 * Level 10: 91 - 103.5
 * Level 20: 225 - 242.5
 * Synergies: +5% cold damage per point from Ice Bolt, Ice Blast, Blizzard, Frozen Orb.
 */
export function calculateGlacialSpikeDamage(
  slvl: number,
  synergies?: {
    iceBolt?: number
    iceBlast?: number
    blizzard?: number
    frozenOrb?: number
    synPctPerLvl?: number
  } | number,
  options?: { synPctPerLvl?: number; synMultiplier?: number },
): { min: number; max: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let rawMin = 32
  let rawMax = 48
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    rawMin += b1 * 14
    rawMax += b1 * 15
    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      rawMin += b2 * 26
      rawMax += b2 * 27
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      rawMin += b3 * 28
      rawMax += b3 * 29
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      rawMin += b4 * 30
      rawMax += b4 * 31
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      rawMin += b5 * 32
      rawMax += b5 * 33
    }
  }

  let min = rawMin / 2
  let max = rawMax / 2

  let synMultiplier = 1.0
  if (typeof options?.synMultiplier === 'number' && Number.isFinite(options.synMultiplier)) {
    synMultiplier = Math.max(0, options.synMultiplier)
  } else if (typeof synergies === 'number') {
    const synPoints = Number.isFinite(synergies) ? Math.max(0, synergies) : 0
    const pctPerLvl = options?.synPctPerLvl ?? 5
    synMultiplier = 1.0 + (synPoints * pctPerLvl) / 100
  } else if (typeof synergies === 'object' && synergies !== null) {
    const synPoints = Math.max(
      0,
      (synergies.iceBolt ?? 0) +
        (synergies.iceBlast ?? 0) +
        (synergies.blizzard ?? 0) +
        (synergies.frozenOrb ?? 0),
    )
    const pctPerLvl = options?.synPctPerLvl ?? synergies.synPctPerLvl ?? 5
    synMultiplier = 1.0 + (synPoints * pctPerLvl) / 100
  }

  min = Math.floor((min * synMultiplier + 1e-9) * 10) / 10
  max = Math.floor((max * synMultiplier + 1e-9) * 10) / 10
  return { min, max }
}

/**
 * Authentic 1.13c Glacial Spike (Skill 55) freeze length in frames:
 * Param3: 50 frames base (2.0s), Param4: 3 frames/lvl (0.12s/lvl).
 * Formula: 50 + (slvl - 1) * 3.
 * Level 1 -> 50 frames (2.00s), Level 10 -> 77 frames (3.08s), Level 20 -> 107 frames (4.28s).
 * Synergy: +3% freeze length per point from Blizzard (and Ice Bolt, Ice Blast if passed).
 * Formula: Math.floor(((50 + (slvl - 1) * 3) * (100 + synPoints * 3)) / 100).
 */
export function calculateGlacialSpikeFreezeLength(
  slvl: number,
  synergies?: { blizzard?: number; iceBolt?: number; iceBlast?: number } | number,
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const synPoints = Math.max(
    0,
    typeof synergies === 'number'
      ? synergies
      : (synergies?.blizzard ?? 0) + (synergies?.iceBolt ?? 0) + (synergies?.iceBlast ?? 0),
  )
  const baseFrames = 50 + (lvl - 1) * 3
  const synFactor = 100 + synPoints * 3
  return Math.floor((baseFrames * synFactor) / 100)
}

/**
 * Authentic 1.13c Cold Mastery (Skill 65) passive enemy cold resistance reduction:
 * Param1: 20 (% base), Param2: 5 (% per level).
 * Formula: 20 + (slvl - 1) * 5.
 * Level 1 -> 20% (-20%), Level 10 -> 65% (-65%), Level 20 -> 115% (-115%), Level 30 -> 165% (-165%).
 * Clamped: Returns 0 for slvl <= 0.
 */
export function calculateColdMasteryPierce(slvl: number): number {
  if (!Number.isFinite(slvl) || slvl <= 0) return 0
  const lvl = Math.floor(slvl)
  return 20 + (lvl - 1) * 5
}

/**
 * Authentic 1.13c Fire Wall (Skill 51) 5-band fire damage progression (HitShift = 4 -> multiply raw by 16 into 256ths):
 * EMin: 15, EMinLev: [9, 14, 21, 21, 21]
 * EMax: 20, EMaxLev: [9, 14, 21, 21, 21]
 * Level 1: raw 15 - 20 -> in 256ths: 240 - 320 (23.44 - 31.25 fire dmg/sec)
 * Level 10: raw 106 - 111 -> in 256ths: 1696 - 1776 (165.62 - 173.44 fire dmg/sec)
 * Level 20: raw 274 - 279 -> in 256ths: 4384 - 4464 (428.12 - 435.94 fire dmg/sec)
 * Synergies: Warmth (+4%/lvl), Inferno (+1%/lvl).
 */
export function calculateFireWallDamage(
  slvl: number,
  synergies?: { warmth?: number; inferno?: number; fireMastery?: number; synPctPerLvl?: number } | number,
  options?: { synMultiplier?: number; asPerSecond?: boolean },
): { min: number; max: number; perSecMin: number; perSecMax: number; min256: number; max256: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let rawMin = 15
  let rawMax = 20

  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    rawMin += b1 * 9
    rawMax += b1 * 9
  }
  if (lvl > 8) {
    const b2 = Math.min(lvl - 8, 8)
    rawMin += b2 * 14
    rawMax += b2 * 14
  }
  if (lvl > 16) {
    const b3 = Math.min(lvl - 16, 6)
    rawMin += b3 * 21
    rawMax += b3 * 21
  }
  if (lvl > 22) {
    const b4 = Math.min(lvl - 22, 6)
    rawMin += b4 * 21
    rawMax += b4 * 21
  }
  if (lvl > 28) {
    const b5 = lvl - 28
    rawMin += b5 * 21
    rawMax += b5 * 21
  }

  let synMultiplier = 1.0
  if (typeof options?.synMultiplier === 'number' && Number.isFinite(options.synMultiplier)) {
    synMultiplier = Math.max(0, options.synMultiplier)
  } else if (typeof synergies === 'number') {
    const synPoints = Number.isFinite(synergies) ? Math.max(0, synergies) : 0
    synMultiplier = 1.0 + (synPoints * 4) / 100
  } else if (typeof synergies === 'object' && synergies !== null) {
    const warmthPts = Math.max(0, synergies.warmth ?? 0)
    const infernoPts = Math.max(0, synergies.inferno ?? 0)
    const synPct = warmthPts * 4 + infernoPts * 1
    const masteryPct = synergies.fireMastery && synergies.fireMastery > 0
      ? 30 + (synergies.fireMastery - 1) * 7
      : 0
    synMultiplier = (1.0 + synPct / 100) * (1.0 + masteryPct / 100)
  }

  const min256 = Math.floor(rawMin * 16 * synMultiplier)
  const max256 = Math.floor(rawMax * 16 * synMultiplier)
  const perSecMin = Math.floor(((rawMin * 25) / 16) * synMultiplier * 100) / 100
  const perSecMax = Math.floor(((rawMax * 25) / 16) * synMultiplier * 100) / 100

  let min = Math.floor((rawMin * synMultiplier + 1e-9) * 10) / 10
  let max = Math.floor((rawMax * synMultiplier + 1e-9) * 10) / 10
  if (options?.asPerSecond) {
    min = perSecMin
    max = perSecMax
  }

  return { min, max, perSecMin, perSecMax, min256, max256 }
}

/**
 * Authentic 1.13c Blaze (Skill 46) 5-band fire damage progression (HitShift = 4 -> multiply raw by 16 into 256ths):
 * EMin: 4, EMinLev: [2, 3, 4, 6, 9]
 * EMax: 8, EMaxLev: [2, 3, 4, 6, 9]
 * Level 1: raw 4 - 8 -> in 256ths: 64 - 128 (6.25 - 12.50 fire dmg/sec)
 * Level 10: raw 24 - 28 -> in 256ths: 384 - 448 (37.50 - 43.75 fire dmg/sec)
 * Level 20: raw 58 - 62 -> in 256ths: 928 - 992 (90.62 - 96.88 fire dmg/sec)
 * Synergies: Warmth (+4%/lvl), Fire Wall (+1%/lvl).
 */
export function calculateBlazeDamage(
  slvl: number,
  synergies?: { warmth?: number; fireWall?: number; fireMastery?: number; synPctPerLvl?: number } | number,
  options?: { synMultiplier?: number; asPerSecond?: boolean },
): { min: number; max: number; perSecMin: number; perSecMax: number; min256: number; max256: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let rawMin = 4
  let rawMax = 8

  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    rawMin += b1 * 2
    rawMax += b1 * 2
  }
  if (lvl > 8) {
    const b2 = Math.min(lvl - 8, 8)
    rawMin += b2 * 3
    rawMax += b2 * 3
  }
  if (lvl > 16) {
    const b3 = Math.min(lvl - 16, 6)
    rawMin += b3 * 4
    rawMax += b3 * 4
  }
  if (lvl > 22) {
    const b4 = Math.min(lvl - 22, 6)
    rawMin += b4 * 6
    rawMax += b4 * 6
  }
  if (lvl > 28) {
    const b5 = lvl - 28
    rawMin += b5 * 9
    rawMax += b5 * 9
  }

  let synMultiplier = 1.0
  if (typeof options?.synMultiplier === 'number' && Number.isFinite(options.synMultiplier)) {
    synMultiplier = Math.max(0, options.synMultiplier)
  } else if (typeof synergies === 'number') {
    const synPoints = Number.isFinite(synergies) ? Math.max(0, synergies) : 0
    synMultiplier = 1.0 + (synPoints * 4) / 100
  } else if (typeof synergies === 'object' && synergies !== null) {
    const warmthPts = Math.max(0, synergies.warmth ?? 0)
    const fireWallPts = Math.max(0, synergies.fireWall ?? 0)
    const synPct = warmthPts * 4 + fireWallPts * 1
    const masteryPct = synergies.fireMastery && synergies.fireMastery > 0
      ? 30 + (synergies.fireMastery - 1) * 7
      : 0
    synMultiplier = (1.0 + synPct / 100) * (1.0 + masteryPct / 100)
  }

  const min256 = Math.floor(rawMin * 16 * synMultiplier)
  const max256 = Math.floor(rawMax * 16 * synMultiplier)
  const perSecMin = Math.floor(((rawMin * 25) / 16) * synMultiplier * 100) / 100
  const perSecMax = Math.floor(((rawMax * 25) / 16) * synMultiplier * 100) / 100

  let min = Math.floor((rawMin * synMultiplier + 1e-9) * 10) / 10
  let max = Math.floor((rawMax * synMultiplier + 1e-9) * 10) / 10
  if (options?.asPerSecond) {
    min = perSecMin
    max = perSecMax
  }

  return { min, max, perSecMin, perSecMax, min256, max256 }
}

/**
 * Authentic 1.13c Inferno (Skill 41) 5-band fire damage progression (HitShift = 2 -> multiply raw by 4 into 256ths):
 * EMin: 32, EMinLev: [24, 26, 28, 32, 36]
 * EMax: 64, EMaxLev: [24, 27, 29, 33, 37]
 * Level 1: raw 32 - 64 -> in 256ths: 128 - 256 (12.50 - 25.00 fire dmg/sec)
 * Level 10: raw 252 - 286 -> in 256ths: 1008 - 1144 (98.44 - 111.72 fire dmg/sec)
 * Level 20: raw 520 - 564 -> in 256ths: 2080 - 2256 (203.12 - 220.31 fire dmg/sec)
 * Synergies: Warmth (+13%/lvl).
 */
export function calculateInfernoDamage(
  slvl: number,
  synergies?: { warmth?: number; fireMastery?: number; synPctPerLvl?: number } | number,
  options?: { synMultiplier?: number; asPerSecond?: boolean },
): { min: number; max: number; perSecMin: number; perSecMax: number; min256: number; max256: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let rawMin = 32
  let rawMax = 64

  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    rawMin += b1 * 24
    rawMax += b1 * 24
  }
  if (lvl > 8) {
    const b2 = Math.min(lvl - 8, 8)
    rawMin += b2 * 26
    rawMax += b2 * 27
  }
  if (lvl > 16) {
    const b3 = Math.min(lvl - 16, 6)
    rawMin += b3 * 28
    rawMax += b3 * 29
  }
  if (lvl > 22) {
    const b4 = Math.min(lvl - 22, 6)
    rawMin += b4 * 32
    rawMax += b4 * 33
  }
  if (lvl > 28) {
    const b5 = lvl - 28
    rawMin += b5 * 36
    rawMax += b5 * 37
  }

  let synMultiplier = 1.0
  if (typeof options?.synMultiplier === 'number' && Number.isFinite(options.synMultiplier)) {
    synMultiplier = Math.max(0, options.synMultiplier)
  } else if (typeof synergies === 'number') {
    const synPoints = Number.isFinite(synergies) ? Math.max(0, synergies) : 0
    synMultiplier = 1.0 + (synPoints * 13) / 100
  } else if (typeof synergies === 'object' && synergies !== null) {
    const warmthPts = Math.max(0, synergies.warmth ?? 0)
    const synPct = warmthPts * 13
    const masteryPct = synergies.fireMastery && synergies.fireMastery > 0
      ? 30 + (synergies.fireMastery - 1) * 7
      : 0
    synMultiplier = (1.0 + synPct / 100) * (1.0 + masteryPct / 100)
  }

  const min256 = Math.floor(rawMin * 4 * synMultiplier)
  const max256 = Math.floor(rawMax * 4 * synMultiplier)
  const perSecMin = Math.floor(((rawMin * 25) / 64) * synMultiplier * 100) / 100
  const perSecMax = Math.floor(((rawMax * 25) / 64) * synMultiplier * 100) / 100

  let min = Math.floor((rawMin * synMultiplier + 1e-9) * 10) / 10
  let max = Math.floor((rawMax * synMultiplier + 1e-9) * 10) / 10
  if (options?.asPerSecond) {
    min = perSecMin
    max = perSecMax
  }

  return { min, max, perSecMin, perSecMax, min256, max256 }
}

/**
 * Authentic 1.13c Blaze (Skill 46) buff duration in frames:
 * Formula: auralencalc = dm12 (Param1=50, Param2=500) → D2Common 0x6FD9DC30 (issue #1678).
 * Level 1 -> 117 frames, Level 10 -> 356 frames, Level 20 -> 428 frames.
 */
export function calculateBlazeDuration(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return computeDiminishingReturns(50, 500, lvl)
}

/**
 * Authentic 1.13c Blaze (Skill 46) ground fire patch duration in frames:
 * Formula: 90 + slvl * 25.
 * Level 1 -> 115 frames (4.60s), Level 10 -> 340 frames (13.60s), Level 20 -> 590 frames (23.60s).
 */
export function calculateBlazePatchDuration(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 90 + lvl * 25
}

/**
 * Authentic 1.13c Inferno (Skill 41) stream length in yards:
 * Formula: (20 + 3 * (slvl - 1)) / 2.
 * Level 1 -> 10.0 yards, Level 10 -> 23.5 yards, Level 20 -> 38.5 yards.
 */
export function calculateInfernoRange(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return (20 + 3 * (lvl - 1)) / 2
}

/**
 * Authentic 1.13c Inferno (Skill 41) stream length in pixels:
 * Formula: calculateInfernoRange(slvl) * 32 (1 yard = 1 subtile = 32 horizontal pixels).
 * Level 1 -> 320.0 px, Level 10 -> 752.0 px, Level 20 -> 1232.0 px.
 */
export function calculateInfernoRangePx(slvl: number): number {
  return calculateInfernoRange(slvl) * 32
}

/**
 * Authentic 1.13c Inferno (Skill 41) continuous mana drain per frame in 256ths:
 * Formula: (36 + (slvl - 1)) * 4.
 * Level 1 -> 144 / 256 mana/frame, Level 10 -> 180, Level 20 -> 220.
 */
export function calculateInfernoContinuousMana256(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return (36 + (lvl - 1)) * 4
}

/**
 * Authentic 1.13c Fire Wall (Skill 51) 15-patch perpendicular line emitter geometry:
 * Given caster (cx, cy) and target (tx, ty):
 * Normal vector is perpendicular to (tx - cx, ty - cy): (-dy, dx) / len.
 * Generates 15 patches with indices i in [-7, +7] spaced 24px apart,
 * with Y coordinates scaled by ISO_GROUND_ASPECT_RATIO (0.5).
 * If options.isBlocked is supplied, patches landing on solid obstacles are omitted.
 */
export function calculateFireWallPatches(
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  options?: {
    count?: number
    spacing?: number
    isBlocked?: (x: number, y: number) => boolean
  },
): Array<{ x: number; y: number; index: number }> {
  const count = options?.count ?? 15
  const spacing = options?.spacing ?? 24
  const dx = targetX - casterX
  const dy = targetY - casterY
  const len = Math.hypot(dx, dy)

  let nx = 0
  let ny = 1
  if (len > 1e-6) {
    nx = -dy / len
    ny = dx / len
  }

  const half = Math.floor(count / 2)
  const patches: Array<{ x: number; y: number; index: number }> = []

  for (let i = -half; i <= half; i++) {
    const px = Math.round(targetX + i * spacing * nx)
    const py = Math.round(targetY + i * spacing * ny * ISO_GROUND_ASPECT_RATIO)
    if (options?.isBlocked && options.isBlocked(px, py)) {
      continue
    }
    patches.push({ x: px, y: py, index: i })
  }

  return patches
}

/**
 * Authentic 1.13c Fire Mastery (Skill 61) passive percentage fire damage bonus:
 * Param1: 30 (% base at slvl 1), Param2: 7 (% per level thereafter).
 * Formula: slvl <= 0 ? 0 : 30 + (slvl - 1) * 7.
 * Level 1 -> +30%, Level 10 -> +93%, Level 20 -> +163%, Level 30 -> +233%.
 * Clamped: Returns 0 for slvl <= 0.
 */
export function calculateFireMasteryBonus(slvl: number): number {
  if (!Number.isFinite(slvl) || slvl <= 0) return 0
  const lvl = Math.floor(slvl)
  return 30 + (lvl - 1) * 7
}

/**
 * Authentic 1.13c Enchant (Skill 52) duration in frames at 25 fps:
 * Formula (ln12): 3600 + (slvl - 1) * 600 frames (144s base + 24s/lvl).
 * Level 1 -> 3600 frames (144.0s), Level 10 -> 9000 frames (360.0s), Level 20 -> 15000 frames (600.0s).
 * Clamped: Returns 0 for slvl <= 0.
 */
export function calculateEnchantDuration(slvl: number): number {
  if (!Number.isFinite(slvl) || slvl <= 0) return 0
  const lvl = Math.floor(slvl)
  return 3600 + (lvl - 1) * 600
}

/**
 * Authentic 1.13c Enchant (Skill 52) Attack Rating percentage bonus:
 * ToHit: 20 (% base at slvl 1), LevToHit: 9 (% per level thereafter).
 * Formula: 20 + (slvl - 1) * 9.
 * Level 1 -> +20%, Level 10 -> +101%, Level 20 -> +191%.
 * Clamped: Returns 0 for slvl <= 0.
 */
export function calculateEnchantAttackRating(slvl: number): number {
  if (!Number.isFinite(slvl) || slvl <= 0) return 0
  const lvl = Math.floor(slvl)
  return 20 + (lvl - 1) * 9
}

/**
 * Authentic 1.13c Enchant (Skill 52) 5-band weapon fire damage progression:
 * HitShift = 7 (128/256 precision -> 0.5 fire damage per integer step).
 * EMin: 16, EMinLev: [3, 7, 11, 15, 19]
 * EMax: 20, EMaxLev: [5, 9, 13, 17, 21]
 * Level 1: 16 - 20 raw -> 8.0 - 10.0 fire dmg (2048 - 2560 in 256ths)
 * Level 10: 51 - 73 raw -> 25.5 - 36.5 fire dmg (6528 - 9344 in 256ths)
 * Level 20: 137 - 179 raw -> 68.5 - 89.5 fire dmg (17536 - 22912 in 256ths)
 * Warmth synergy: +9% per hard point (blvl).
 * Fire Mastery multiplier upon cast: damage * (1 + calculateFireMasteryBonus(fmSlvl) / 100).
 */
export function calculateEnchantDamage(
  slvl: number,
  synergies?: { warmth?: number | undefined; fireMastery?: number | undefined } | number | undefined,
  fireMasterySlvl?: number | undefined,
): { min: number; max: number; min256: number; max256: number } {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let rawMin = 16
  let rawMax = 20

  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    rawMin += b1 * 3
    rawMax += b1 * 5
  }
  if (lvl > 8) {
    const b2 = Math.min(lvl - 8, 8)
    rawMin += b2 * 7
    rawMax += b2 * 9
  }
  if (lvl > 16) {
    const b3 = Math.min(lvl - 16, 6)
    rawMin += b3 * 11
    rawMax += b3 * 13
  }
  if (lvl > 22) {
    const b4 = Math.min(lvl - 22, 6)
    rawMin += b4 * 15
    rawMax += b4 * 17
  }
  if (lvl > 28) {
    const b5 = lvl - 28
    rawMin += b5 * 19
    rawMax += b5 * 21
  }

  let warmthPts = 0
  let fmLvl = 0
  if (typeof synergies === 'number') {
    warmthPts = Number.isFinite(synergies) ? Math.max(0, synergies) : 0
  } else if (typeof synergies === 'object' && synergies !== null) {
    warmthPts = Math.max(0, synergies.warmth ?? 0)
    fmLvl = Math.max(0, synergies.fireMastery ?? 0)
  }
  if (fireMasterySlvl !== undefined && Number.isFinite(fireMasterySlvl)) {
    fmLvl = Math.max(0, fireMasterySlvl)
  }

  const warmthMultiplier = 1.0 + (warmthPts * 9) / 100
  const fmMultiplier = 1.0 + calculateFireMasteryBonus(fmLvl) / 100
  const totalMultiplier = warmthMultiplier * fmMultiplier

  const min256 = Math.floor(rawMin * 128 * totalMultiplier)
  const max256 = Math.floor(rawMax * 128 * totalMultiplier)

  // Floating point 0.5 step rounded to 1 decimal place
  const min = Math.round((rawMin * 0.5 * totalMultiplier) * 10) / 10
  const max = Math.round((rawMax * 0.5 * totalMultiplier) * 10) / 10

  return { min, max, min256, max256 }
}

/**
 * Authentic 1.13c Enchant attack damage calculation including:
 * - Ranged attack penalty: Ranged attacks (bow/crossbow/throwing) receive only 33% of the Enchant fire damage bonus.
 * - Sorceress Melee Double-Dip: When a Sorceress with Fire Mastery attacks in melee while buffed with Enchant,
 *   her outgoing fire damage is multiplied by (1 + calculateFireMasteryBonus(fmSlvl) / 100) again!
 *   Ranged attacks do NOT get the second melee multiplier.
 * - Fire resistance and immunity: Fire Mastery does NOT pierce fire resistance and CANNOT break fire immunities (Res >= 100%).
 */
export function calculateEnchantAttackDamage(params: {
  enchantDamage: { min: number; max: number }
  isRanged?: boolean | undefined
  isSorceress?: boolean | undefined
  fireMasterySlvl?: number | undefined
  targetFireResist?: number | undefined
}): { min: number; max: number; average: number } {
  let min = params.enchantDamage.min
  let max = params.enchantDamage.max

  if (params.isRanged) {
    // Ranged attack penalty: 33% of Enchant fire damage bonus, no second Fire Mastery
    min = Math.round(min * 0.33 * 10) / 10
    max = Math.round(max * 0.33 * 10) / 10
  } else {
    // Melee attack: full Enchant fire damage
    // Sorceress Melee Double-Dip:
    if (params.isSorceress && params.fireMasterySlvl && params.fireMasterySlvl > 0) {
      const fmMul = 1.0 + calculateFireMasteryBonus(params.fireMasterySlvl) / 100
      min = Math.round(min * fmMul * 10) / 10
      max = Math.round(max * fmMul * 10) / 10
    }
  }

  // Fire resistance / immunity check
  if (params.targetFireResist !== undefined) {
    if (params.targetFireResist >= 100) {
      // Fire Mastery cannot break fire immunity (Res >= 100%)
      return { min: 0, max: 0, average: 0 }
    }
    const resFactor = Math.max(0, 100 - params.targetFireResist) / 100
    min = Math.round(min * resFactor * 10) / 10
    max = Math.round(max * resFactor * 10) / 10
  }

  const average = Math.round(((min + max) / 2) * 10) / 10
  return { min, max, average }
}

/* ========================================================================= */
/* Necromancer Poison & Bone Spells (Milestone M2, IDs 67, 68, 73, 74, 78,   */
/* 83, 84, 88, 92, 93) Ground Truth 1.13c Decoupled Simulation & Damage    */
/* ========================================================================= */

/**
 * Calculates Teeth (Skill 67) synergy multiplier:
 * +15% magic damage per hard point in Bone Wall (78), Bone Prison (88), Bone Spear (84), Bone Spirit (93).
 */
export function calculateTeethSynergyMultiplier(synergies: {
  readonly boneWall?: number | undefined
  readonly bonePrison?: number | undefined
  readonly boneSpear?: number | undefined
  readonly boneSpirit?: number | undefined
} | number = {}): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  }
  const points =
    (synergies.boneWall ?? 0) +
    (synergies.bonePrison ?? 0) +
    (synergies.boneSpear ?? 0) +
    (synergies.boneSpirit ?? 0)
  return 1.0 + points * 0.15
}

/**
 * Calculates number of teeth fired by Teeth (Skill 67):
 * min(ln12, 24) where par1=2, par2=1 -> min(2 + (slvl - 1) * 1, 24).
 */
export function calculateTeethCount(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return Math.min(24, Math.max(2, 2 + (lvl - 1) * 1))
}

/**
 * Calculates Teeth (Skill 67) magic damage range:
 * 1.13c ground truth:
 * - EMin: 4, EMax: 8
 * - eMinLev: [2, 2, 3, 4, 5]
 * - eMaxLev: [2, 3, 4, 5, 6]
 * - HitShift: 7 (half-point scaling, 128/256 precision)
 * - Synergies: +15% per hard point from Bone Wall, Bone Prison, Bone Spear, Bone Spirit.
 */
export function calculateTeethDamage(
  slvl: number,
  synergies: {
    readonly boneWall?: number | undefined
    readonly bonePrison?: number | undefined
    readonly boneSpear?: number | undefined
    readonly boneSpirit?: number | undefined
  } | number = {},
): DamageRange {
  const syn = calculateTeethSynergyMultiplier(synergies)
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1

  const baseMin = compute5BandScaling(lvl, 4, 2, 2, 3, 4, 5)
  const baseMax = compute5BandScaling(lvl, 8, 2, 3, 4, 5, 6)

  // HitShift 7 = factor 0.5 (or << 7 then / 256)
  const min = Math.floor((baseMin * 0.5) * syn)
  const max = Math.floor((baseMax * 0.5) * syn)

  return { min, max }
}

/**
 * Calculates Bone Armor (Skill 68) synergy absorption bonus:
 * +15 physical damage absorbed per hard point in Bone Wall (78) and Bone Prison (88).
 */
export function calculateBoneArmorSynergyBonus(synergies: {
  readonly boneWall?: number | undefined
  readonly bonePrison?: number | undefined
} | number = {}): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 0
  }
  const points = (synergies.boneWall ?? 0) + (synergies.bonePrison ?? 0)
  return points * 15
}

/**
 * Calculates Bone Armor (Skill 68) total physical damage absorption capacity:
 * 1.13c ground truth:
 * - ln12: par1=20, par2=10 -> 20 + (slvl - 1) * 10
 * - Synergies: +15 damage per hard point from Bone Wall and Bone Prison
 * Absorbs PHYSICAL melee and missile damage only.
 */
export function calculateBoneArmorCapacity(
  slvl: number,
  synergies: {
    readonly boneWall?: number | undefined
    readonly bonePrison?: number | undefined
  } | number = {},
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const baseCapacity = 20 + (lvl - 1) * 10
  const synBonus = calculateBoneArmorSynergyBonus(synergies)
  return baseCapacity + synBonus
}

/**
 * Calculates Poison Dagger (Skill 73) synergy multiplier:
 * +20% poison damage per hard point in Poison Explosion (83) and Poison Nova (92).
 */
export function calculatePoisonDaggerSynergyMultiplier(synergies: {
  readonly poisonExplosion?: number | undefined
  readonly poisonNova?: number | undefined
} | number = {}): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  }
  const points = (synergies.poisonExplosion ?? 0) + (synergies.poisonNova ?? 0)
  return 1.0 + points * 0.20
}

/**
 * Calculates Poison Dagger (Skill 73) attack rating bonus %:
 * ln12 (par1=30, par2=20) -> +30% at slvl 1, +20%/lvl (+30% to +410% at slvl 20).
 */
export function calculatePoisonDaggerAttackRatingBonus(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 30 + (lvl - 1) * 20
}

/**
 * Calculates Poison Dagger (Skill 73) poison damage specification:
 * 1.13c ground truth:
 * - eMin: 18, eMax: 40
 * - elev: [10, 15, 20, 23, 26]
 * - HitShift: 1 (rate = base << 1 in 256ths/frame)
 * - Duration: 50 + (slvl - 1) * 10 frames (2.0s to 9.6s)
 * - Synergies: +20% per hard point from Poison Explosion and Poison Nova
 */
export function calculatePoisonDaggerDamage(
  slvl: number,
  synergies: {
    readonly poisonExplosion?: number | undefined
    readonly poisonNova?: number | undefined
  } | number = {},
): PoisonDamageSpec {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const syn = calculatePoisonDaggerSynergyMultiplier(synergies)

  const baseMin = compute5BandScaling(lvl, 18, 10, 15, 20, 23, 26)
  const baseMax = compute5BandScaling(lvl, 40, 10, 15, 20, 23, 26)

  const minRate = (baseMin << 1)
  const maxRate = (baseMax << 1)

  const minRateScaled = Math.trunc(minRate * syn)
  const maxRateScaled = Math.trunc(maxRate * syn)

  const durationFrames = 50 + (lvl - 1) * 10
  const durationSeconds = durationFrames / 25

  const minDamage = Math.floor((minRateScaled * durationFrames) / 256)
  const maxDamage = Math.floor((maxRateScaled * durationFrames) / 256)

  return {
    minDamage,
    maxDamage,
    durationFrames,
    durationSeconds,
    minRate: minRateScaled,
    maxRate: maxRateScaled,
  }
}

/**
 * Calculates Corpse Explosion (Skill 74) damage from base unscaled monster hit points:
 * 1.13c ground truth:
 * - 70% to 120% of base monster HP (unscaled by player count / difficulty)
 * - Exactly 50% physical damage and 50% fire damage.
 */
export function calculateCorpseExplosionDamage(
  monsterBaseHp: number,
  rollPct?: number,
): {
  phys: number
  fire: number
  minPhys: number
  maxPhys: number
  minFire: number
  maxFire: number
  minTotal: number
  maxTotal: number
} {
  const hp = Math.max(0, monsterBaseHp)
  const roll = rollPct !== undefined ? Math.max(70, Math.min(120, rollPct)) : 95
  const rawTotal = Math.trunc((hp * roll) / 100)
  const fire = Math.trunc((rawTotal * 50) / 100)
  const phys = rawTotal - fire

  const minTotal = Math.trunc((hp * 70) / 100)
  const minFire = Math.trunc((minTotal * 50) / 100)
  const minPhys = minTotal - minFire

  const maxTotal = Math.trunc((hp * 120) / 100)
  const maxFire = Math.trunc((maxTotal * 50) / 100)
  const maxPhys = maxTotal - maxFire

  return {
    phys,
    fire,
    minPhys,
    maxPhys,
    minFire,
    maxFire,
    minTotal,
    maxTotal,
  }
}

/**
 * Calculates Corpse Explosion (Skill 74) radius in yards:
 * In D2 1.13c, 1 subtile = 1/3 yard (par3=8, par4=1 subtiles -> subtiles * 1/3):
 * slvl 1: 2.67 yards; slvl 10: 5.67 yards; slvl 20: 9.0 yards.
 */
export function calculateCorpseExplosionRadiusYards(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const subtiles = 8 + (lvl - 1) * 1
  return Math.round((subtiles * (1 / 3)) * 100) / 100
}

/**
 * Calculates Corpse Explosion (Skill 74) radius in pixels on 2D ground plane (40 px / yard).
 */
export function calculateCorpseExplosionRadiusPx(slvl: number): number {
  return Math.round(calculateCorpseExplosionRadiusYards(slvl) * 40)
}

/**
 * Calculates Bone Wall (Skill 78) stats:
 * 1.13c ground truth:
 * - Base HP: 19 + (slvl - 1) * 4.6
 * - Synergies: +10% per hard point from Bone Armor (68) and Bone Prison (88)
 * - Duration: fixed 24.0s (600 frames)
 * - Segments: 5 destructible segments
 */
export function calculateBoneWallStats(
  slvl: number,
  synergies: {
    readonly boneArmor?: number | undefined
    readonly bonePrison?: number | undefined
  } | number = {},
  difficulty?: 'normal' | 'nightmare' | 'hell' | 0 | 1 | 2,
): {
  hp: number
  hp113c: number
  bonusHpPct113c: number
  difficultyBaseHp: number
  durationFrames: number
  durationSeconds: number
  segmentCount: number
} {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let syn = 1.0
  let synPoints = 0
  if (typeof synergies === 'number') {
    syn = Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
    synPoints = Math.max(0, Math.round((syn - 1.0) / 0.10))
  } else {
    synPoints = (synergies.boneArmor ?? 0) + (synergies.bonePrison ?? 0)
    syn = 1.0 + synPoints * 0.10
  }
  const baseHp = 19 + (lvl - 1) * 4.6
  const legacyHp = Math.floor(baseHp * syn)
  const difficultyBaseHp =
    difficulty === 'hell' || difficulty === 2
      ? 431
      : difficulty === 'nightmare' || difficulty === 1
        ? 147
        : 19
  // 1.13c Skills.txt #78 calc1 = (lvl-1)*par1 + (skill('Bone Armor'.blvl)+skill('Bone Prison'.blvl))*par2
  // with Param1=25 (+25% HP per slvl above 1), Param2=10 (+10% HP per blvl)
  const bonusHpPct113c = (lvl - 1) * 25 + synPoints * 10
  const hp113c = Math.floor((difficultyBaseHp * (100 + bonusHpPct113c)) / 100)

  return {
    hp: difficulty !== undefined ? hp113c : legacyHp,
    hp113c,
    bonusHpPct113c,
    difficultyBaseHp,
    durationFrames: 600,
    durationSeconds: 24.0,
    segmentCount: 5,
  }
}

/**
 * Calculates Poison Explosion (Skill 83) synergy multiplier:
 * +15% poison damage per hard point in Poison Dagger (73) and Poison Nova (92).
 */
export function calculatePoisonExplosionSynergyMultiplier(synergies: {
  readonly poisonDagger?: number | undefined
  readonly poisonNova?: number | undefined
} | number = {}): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  }
  const points = (synergies.poisonDagger ?? 0) + (synergies.poisonNova ?? 0)
  return 1.0 + points * 0.15
}

/**
 * Calculates Poison Explosion (Skill 83) poison damage specification:
 * 1.13c ground truth:
 * - eMin: 8, eMax: 24
 * - elev: [2, 4, 6, 8, 10]
 * - HitShift: 4 (rate = base << 4 in 256ths/frame)
 * - Duration: 50 + (slvl - 1) * 10 frames (2.0s to 9.6s)
 * - Synergies: +15% per hard point from Poison Dagger and Poison Nova
 */
export function calculatePoisonExplosionDamage(
  slvl: number,
  synergies: {
    readonly poisonDagger?: number | undefined
    readonly poisonNova?: number | undefined
  } | number = {},
): PoisonDamageSpec {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const syn = calculatePoisonExplosionSynergyMultiplier(synergies)

  const baseMin = compute5BandScaling(lvl, 8, 2, 4, 6, 8, 10)
  const baseMax = compute5BandScaling(lvl, 24, 2, 4, 6, 8, 10)

  const minRate = (baseMin << 4)
  const maxRate = (baseMax << 4)

  const minRateScaled = Math.trunc(minRate * syn)
  const maxRateScaled = Math.trunc(maxRate * syn)

  const durationFrames = 50 + (lvl - 1) * 10
  const durationSeconds = durationFrames / 25

  const minDamage = Math.floor((minRateScaled * durationFrames) / 256)
  const maxDamage = Math.floor((maxRateScaled * durationFrames) / 256)

  return {
    minDamage,
    maxDamage,
    durationFrames,
    durationSeconds,
    minRate: minRateScaled,
    maxRate: maxRateScaled,
  }
}

/**
 * Calculates Bone Spear (Skill 84) synergy multiplier:
 * +7% magic damage per hard point in Teeth (67), Bone Wall (78), Bone Prison (88), Bone Spirit (93).
 */
export function calculateBoneSpearSynergyMultiplier(synergies: {
  readonly teeth?: number | undefined
  readonly boneWall?: number | undefined
  readonly bonePrison?: number | undefined
  readonly boneSpirit?: number | undefined
} | number = {}): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  }
  const points =
    (synergies.teeth ?? 0) +
    (synergies.boneWall ?? 0) +
    (synergies.bonePrison ?? 0) +
    (synergies.boneSpirit ?? 0)
  return 1.0 + points * 0.07
}

/**
 * Calculates Bone Spear (Skill 84) magic damage range:
 * 1.13c ground truth:
 * - eMin: 16, eMax: 24
 * - eMinLev: [8, 9, 12, 18, 24]
 * - eMaxLev: [8, 9, 13, 19, 25]
 * - HitShift: 8 (1:1 precision)
 * - Synergies: +7% per hard point from Teeth, Bone Wall, Bone Prison, Bone Spirit.
 * - Kinematic: Piercing magic projectile (collideKill = 0, Vel 24, Range 40).
 */
export function calculateBoneSpearDamage(
  slvl: number,
  synergies: {
    readonly teeth?: number | undefined
    readonly boneWall?: number | undefined
    readonly bonePrison?: number | undefined
    readonly boneSpirit?: number | undefined
  } | number = {},
): DamageRange {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const syn = calculateBoneSpearSynergyMultiplier(synergies)

  const baseMin = compute5BandScaling(lvl, 16, 8, 9, 12, 18, 24)
  const baseMax = compute5BandScaling(lvl, 24, 8, 9, 13, 19, 25)

  const min = Math.floor(baseMin * syn)
  const max = Math.floor(baseMax * syn)

  return { min, max }
}

/**
 * Calculates Bone Prison (Skill 88) stats:
 * 1.13c ground truth:
 * - Base HP: 19 + (slvl - 1) * 4.6
 * - Synergies: +8% per hard point from Bone Armor (68) and Bone Wall (78)
 * - Duration: fixed 24.0s (600 frames)
 * - Structure: Ring of bone segments encircling target unit.
 */
export function calculateBonePrisonStats(
  slvl: number,
  synergies: {
    readonly boneArmor?: number | undefined
    readonly boneWall?: number | undefined
  } | number = {},
  difficulty?: 'normal' | 'nightmare' | 'hell' | 0 | 1 | 2,
): {
  hp: number
  hp113c: number
  bonusHpPct113c: number
  difficultyBaseHp: number
  durationFrames: number
  durationSeconds: number
  segmentCount: number
} {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let syn = 1.0
  let synPoints = 0
  if (typeof synergies === 'number') {
    syn = Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
    synPoints = Math.max(0, Math.round((syn - 1.0) / 0.08))
  } else {
    synPoints = (synergies.boneArmor ?? 0) + (synergies.boneWall ?? 0)
    syn = 1.0 + synPoints * 0.08
  }
  const baseHp = 19 + (lvl - 1) * 4.6
  const legacyHp = Math.floor(baseHp * syn)
  const difficultyBaseHp =
    difficulty === 'hell' || difficulty === 2
      ? 431
      : difficulty === 'nightmare' || difficulty === 1
        ? 147
        : 19
  // 1.13c Skills.txt #88 calc1 = (lvl-1)*par1 + (skill('Bone Armor'.blvl)+skill('Bone Wall'.blvl))*par2
  // with Param1=25 (+25% HP per slvl above 1), Param2=8 (+8% HP per blvl)
  const bonusHpPct113c = (lvl - 1) * 25 + synPoints * 8
  const hp113c = Math.floor((difficultyBaseHp * (100 + bonusHpPct113c)) / 100)

  return {
    hp: difficulty !== undefined ? hp113c : legacyHp,
    hp113c,
    bonusHpPct113c,
    difficultyBaseHp,
    durationFrames: 600,
    durationSeconds: 24.0,
    segmentCount: 16,
  }
}

/**
 * Calculates Poison Nova (Skill 92) synergy multiplier:
 * +10% poison damage per hard point in Poison Dagger (73) and Poison Explosion (83).
 */
export function calculatePoisonNovaSynergyMultiplier(synergies: {
  readonly poisonDagger?: number | undefined
  readonly poisonExplosion?: number | undefined
} | number = {}): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  }
  const points = (synergies.poisonDagger ?? 0) + (synergies.poisonExplosion ?? 0)
  return 1.0 + points * 0.10
}

/**
 * Calculates Poison Nova (Skill 92) poison damage specification:
 * 1.13c ground truth:
 * - eMin: 16, eMax: 29
 * - elev: [4, 6, 9, 14, 16]
 * - HitShift: 4 (rate = base << 4 in 256ths/frame)
 * - Duration: Strictly FIXED at 50 frames (2.0s) for all levels!
 * - Synergies: +10% per hard point from Poison Dagger and Poison Explosion.
 * - Kinematic: Exactly 64 radial poison missiles (360 degrees).
 */
export function calculatePoisonNovaDamage(
  slvl: number,
  synergies: {
    readonly poisonDagger?: number | undefined
    readonly poisonExplosion?: number | undefined
  } | number = {},
): PoisonDamageSpec {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const syn = calculatePoisonNovaSynergyMultiplier(synergies)

  const baseMin = compute5BandScaling(lvl, 16, 4, 6, 9, 14, 16)
  const baseMax = compute5BandScaling(lvl, 29, 4, 6, 9, 14, 16)

  const minRate = (baseMin << 4)
  const maxRate = (baseMax << 4)

  const minRateScaled = Math.trunc(minRate * syn)
  const maxRateScaled = Math.trunc(maxRate * syn)

  const durationFrames = 50
  const durationSeconds = 2.0

  const minDamage = Math.floor((minRateScaled * durationFrames) / 256)
  const maxDamage = Math.floor((maxRateScaled * durationFrames) / 256)

  return {
    minDamage,
    maxDamage,
    durationFrames,
    durationSeconds,
    minRate: minRateScaled,
    maxRate: maxRateScaled,
  }
}

/**
 * Calculates Bone Spirit (Skill 93) synergy multiplier:
 * +6% magic damage per hard point in Teeth (67), Bone Wall (78), Bone Spear (84), Bone Prison (88).
 */
export function calculateBoneSpiritSynergyMultiplier(synergies: {
  readonly teeth?: number | undefined
  readonly boneWall?: number | undefined
  readonly boneSpear?: number | undefined
  readonly bonePrison?: number | undefined
} | number = {}): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  }
  const points =
    (synergies.teeth ?? 0) +
    (synergies.boneWall ?? 0) +
    (synergies.boneSpear ?? 0) +
    (synergies.bonePrison ?? 0)
  return 1.0 + points * 0.06
}

/**
 * Calculates Bone Spirit (Skill 93) magic damage range:
 * 1.13c ground truth:
 * - eMin: 20, eMax: 30
 * - eMinLev: [16, 17, 18, 19, 20]
 * - eMaxLev: [17, 18, 19, 20, 21]
 * - HitShift: 8 (1:1 precision)
 * - Synergies: +6% per hard point from Teeth, Bone Wall, Bone Spear, Bone Prison.
 * - Kinematic: Homing missile (Vel 12, Range 128) tracking target.
 */
export function calculateBoneSpiritDamage(
  slvl: number,
  synergies: {
    readonly teeth?: number | undefined
    readonly boneWall?: number | undefined
    readonly boneSpear?: number | undefined
    readonly bonePrison?: number | undefined
  } | number = {},
): DamageRange {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const syn = calculateBoneSpiritSynergyMultiplier(synergies)

  const baseMin = compute5BandScaling(lvl, 20, 16, 17, 18, 19, 20)
  const baseMax = compute5BandScaling(lvl, 30, 17, 18, 19, 20, 21)

  const min = Math.floor(baseMin * syn)
  const max = Math.floor(baseMax * syn)

  return { min, max }
}

export interface CurseOpts {
  readonly vsPlayer?: boolean | undefined
  readonly difficulty?: 'normal' | 'nightmare' | 'hell' | undefined
}

export interface CurseSpec {
  readonly skillId: number
  readonly skillName: string
  readonly stateName: string
  readonly curseType: number
  readonly radiusYards: number
  readonly radiusPx: number
  readonly durationFrames: number
  readonly durationSeconds: number
  readonly debuffStats: Readonly<Record<string, number>>
}

/**
 * Calculates authentic 1.13c Necromancer curse radius in yards.
 * Formula: subtiles * (2 / 3).
 *
 * Skill 66 (Amplify Damage): 3 + (slvl - 1) * 1 subtiles (2.0y to 14.67y)
 * Skill 71 (Dim Vision): 4 + (slvl - 1) * 1 subtiles (2.67y to 15.33y)
 * Skill 72 (Weaken): 9 + (slvl - 1) * 1 subtiles (6.0y to 18.67y)
 * Skill 76 (Iron Maiden): Fixed 7 subtiles = 4.67y (187 px)
 * Skill 77 (Terror): Fixed 4 subtiles = 2.67y (107 px)
 * Skill 81 (Confuse): 6 + (slvl - 1) * 1 subtiles (4.0y to 16.67y)
 * Skill 82 (Life Tap): 4 + (slvl - 1) * 1 subtiles (2.67y to 15.33y)
 * Skill 86 (Attract): Fixed 6.0y single-target search radius (240 px)
 * Skill 87 (Decrepify): Fixed 6 subtiles = 4.0y (160 px)
 * Skill 91 (Lower Resist): 7 + (slvl - 1) * 1 subtiles (4.67y to 17.33y)
 */
export function calculateCurseRadiusYards(skillId: number, slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let subtiles = 0
  switch (skillId) {
    case 66: // Amplify Damage
      subtiles = 3 + (lvl - 1) * 1
      break
    case 71: // Dim Vision
      subtiles = 4 + (lvl - 1) * 1
      break
    case 72: // Weaken
      subtiles = 9 + (lvl - 1) * 1
      break
    case 76: // Iron Maiden (fixed 7 subtiles)
      return 4.67
    case 77: // Terror (fixed 4 subtiles)
      return 2.67
    case 81: // Confuse
      subtiles = 6 + (lvl - 1) * 1
      break
    case 82: // Life Tap
      subtiles = 4 + (lvl - 1) * 1
      break
    case 86: // Attract (fixed 6.0y)
      return 6.0
    case 87: // Decrepify (fixed 6 subtiles)
      return 4.0
    case 91: // Lower Resist
      subtiles = 7 + (lvl - 1) * 1
      break
    default:
      return 0
  }
  return Math.round((subtiles * (2 / 3)) * 100) / 100
}

/**
 * Calculates authentic 1.13c Necromancer curse radius in pixels on 2D ground plane (40 px / yard).
 */
export function calculateCurseRadiusPx(skillId: number, slvl: number): number {
  return Math.round(calculateCurseRadiusYards(skillId, slvl) * 40)
}

/**
 * Calculates authentic 1.13c Necromancer curse duration in frames (25 fps).
 *
 * Skill 66 (Amplify Damage): 200 + (slvl - 1) * 75 frames (8.0s to 65.0s @ lvl 20)
 * Skill 71 (Dim Vision): 175 + (slvl - 1) * 50 frames (reduced by 50% in NM, 75% in Hell)
 * Skill 72 (Weaken): 350 + (slvl - 1) * 60 frames (14.0s to 59.6s @ lvl 20)
 * Skill 76 (Iron Maiden): 300 + (slvl - 1) * 60 frames (12.0s to 57.6s @ lvl 20)
 * Skill 77 (Terror): 200 + (slvl - 1) * 25 frames (8.0s to 27.0s @ lvl 20)
 * Skill 81 (Confuse): 250 + (slvl - 1) * 50 frames (10.0s to 48.0s @ lvl 20)
 * Skill 82 (Life Tap): 400 + (slvl - 1) * 60 frames (16.0s to 61.6s @ lvl 20)
 * Skill 86 (Attract): 300 + (slvl - 1) * 90 frames (12.0s to 80.4s @ lvl 20)
 * Skill 87 (Decrepify): 100 + (slvl - 1) * 15 frames (4.0s to 15.4s @ lvl 20)
 * Skill 91 (Lower Resist): 500 + (slvl - 1) * 50 frames (20.0s to 58.0s @ lvl 20)
 */
export function calculateCurseDurationFrames(
  skillId: number,
  slvl: number,
  difficulty?: 'normal' | 'nightmare' | 'hell',
): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const aiCurseDiv = resolveAiCurseDivisor(difficulty ?? 0)
  let frames = 0
  switch (skillId) {
    case 66:
      frames = 200 + (lvl - 1) * 75
      break
    case 71:
      frames = Math.floor((175 + (lvl - 1) * 50) / aiCurseDiv)
      break
    case 72:
      frames = 350 + (lvl - 1) * 60
      break
    case 76:
      frames = 300 + (lvl - 1) * 60
      break
    case 77:
      frames = Math.floor((200 + (lvl - 1) * 25) / aiCurseDiv)
      break
    case 81:
      frames = Math.floor((250 + (lvl - 1) * 50) / aiCurseDiv)
      break
    case 82:
      frames = 400 + (lvl - 1) * 60
      break
    case 86:
      frames = Math.floor((300 + (lvl - 1) * 90) / aiCurseDiv)
      break
    case 87:
      frames = 100 + (lvl - 1) * 15
      break
    case 91:
      frames = 500 + (lvl - 1) * 50
      break
    default:
      frames = 0
  }
  return frames
}

/**
 * Calculates Amplify Damage debuff values:
 * -100% physical resistance (`damageresist = -100`).
 */
export function calculateAmplifyDamageDebuff(): { damageresist: number } {
  return { damageresist: -100 }
}

/**
 * Calculates Weaken debuff values:
 * -33% damage dealt by affected targets (`damagepercent = -33`).
 */
export function calculateWeakenDebuff(): { damagepercent: number } {
  return { damagepercent: -33 }
}

/**
 * Calculates Iron Maiden melee reflection percentage:
 * 200 + (slvl - 1) * 25 % (slvl 1: 200%, 10: 425%, 20: 675%).
 * Divided by 4 in PvP.
 */
export function calculateIronMaidenReturnPct(slvl: number, vsPlayer = false): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const basePct = 200 + (lvl - 1) * 25
  return vsPlayer ? Math.floor(basePct / 4) : basePct
}

/**
 * Calculates Terror fleeing distance in subtiles:
 * 24 + (slvl - 1) * 2 subtiles.
 */
export function calculateTerrorDistance(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return 24 + (lvl - 1) * 2
}

/**
 * Calculates Decrepify tri-debuff values:
 * -50% walk/run speed, -50% attack speed, -50% damage dealt, -50% physical resistance.
 */
export function calculateDecrepifyDebuff(): {
  velocitypercent: number
  attackrate: number
  damagepercent: number
  damageresist: number
  item_slow: number
} {
  return {
    velocitypercent: -50,
    attackrate: -50,
    damagepercent: -50,
    damageresist: -50,
    item_slow: 50,
  }
}

/**
 * Calculates Lower Resist reduction percentage on Fire, Lightning, Cold, Poison resistances:
 * dm56(25, 70): slvl 1: -32%, 10: -55%, 20: -63%.
 */
export function calculateLowerResistReduction(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return computeDiminishingReturns(25, 70, lvl)
}

/**
 * Evaluates 1.13c immunity breaking rule:
 * When base resistance >= 100% (immune), piercing applies at 1/5th effectiveness (floor(piercePct / 5)).
 * Immunity is broken if effective resistance drops below 100%.
 */
export function computeImmunityBreak(
  baseRes: number,
  piercePct: number,
): { effectiveRes: number; wasImmune: boolean; broken: boolean } {
  const bRes = Math.trunc(baseRes)
  const rawPierce = Math.max(0, Math.trunc(piercePct))
  if (bRes >= 100) {
    const wasImmune = true
    const appliedPierce = Math.floor(rawPierce / 5)
    const effectiveRes = bRes - appliedPierce
    const broken = effectiveRes < 100
    return { effectiveRes, wasImmune, broken }
  }
  const wasImmune = false
  const effectiveRes = Math.max(-100, bRes - rawPierce)
  return { effectiveRes, wasImmune, broken: false }
}

/**
 * Calculates comprehensive curse specification for a given skill ID and slvl.
 */
export function calculateCurseEffect(
  skillId: number,
  slvl: number,
  opts: CurseOpts = {},
): CurseSpec {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const radiusYards = calculateCurseRadiusYards(skillId, lvl)
  const radiusPx = calculateCurseRadiusPx(skillId, lvl)
  const durationFrames = calculateCurseDurationFrames(skillId, lvl, opts.difficulty)
  const durationSeconds = Math.round((durationFrames / 25) * 10) / 10

  let skillName = ''
  let stateName = ''
  let curseType = 1
  let debuffStats: Record<string, number> = {}

  switch (skillId) {
    case 66:
      skillName = 'Amplify Damage'
      stateName = 'amplifydamage'
      curseType = 1
      debuffStats = calculateAmplifyDamageDebuff()
      break
    case 71:
      skillName = 'Dim Vision'
      stateName = 'dimvision'
      curseType = 1
      debuffStats = {}
      break
    case 72:
      skillName = 'Weaken'
      stateName = 'weaken'
      curseType = 1
      debuffStats = calculateWeakenDebuff()
      break
    case 76:
      skillName = 'Iron Maiden'
      stateName = 'ironmaiden'
      curseType = 1
      debuffStats = { thorns_percent: calculateIronMaidenReturnPct(lvl, opts.vsPlayer) }
      break
    case 77:
      skillName = 'Terror'
      stateName = 'terror'
      curseType = 1
      debuffStats = {}
      break
    case 81:
      skillName = 'Confuse'
      stateName = 'confuse'
      curseType = 1
      debuffStats = {}
      break
    case 82:
      skillName = 'Life Tap'
      stateName = 'lifetap'
      curseType = 1
      debuffStats = { lifedrainmindam: 50 }
      break
    case 86:
      skillName = 'Attract'
      stateName = 'attract'
      curseType = 2
      debuffStats = {}
      break
    case 87:
      skillName = 'Decrepify'
      stateName = 'decrepify'
      curseType = 1
      debuffStats = calculateDecrepifyDebuff()
      break
    case 91: {
      skillName = 'Lower Resist'
      stateName = 'lowerresist'
      curseType = 1
      const red = calculateLowerResistReduction(lvl)
      debuffStats = {
        fireresist: -red,
        lightresist: -red,
        coldresist: -red,
        poisonresist: -red,
      }
      break
    }
  }

  return {
    skillId,
    skillName,
    stateName,
    curseType,
    radiusYards,
    radiusPx,
    durationFrames,
    durationSeconds,
    debuffStats,
  }
}

// =========================================================================
// Milestone M4: Necromancer Summoning Spells Tree Formulas (1.13c Parity)
// Skills: 69, 70, 75, 79, 80, 85, 89, 90, 94, 95
// =========================================================================

export interface SkeletonMasteryStats {
  readonly skeletonHp: number
  readonly skeletonDamage: number
  readonly reviveHpPct: number
  readonly damagePct: number
  readonly defense: number
}

export interface GolemMasteryStats {
  readonly hpBonusPct: number
  readonly speedBonusPct: number
  readonly attackRatingBonus: number
}

export interface GolemSynergies {
  readonly clayGolemBlvl?: number
  readonly bloodGolemBlvl?: number
  readonly ironGolemBlvl?: number
  readonly fireGolemBlvl?: number
  readonly difficulty?: 0 | 1 | 2
}

export interface ClayGolemStats {
  readonly slowPct: number
  readonly baseHp: number
  readonly selfHpPct: number
  readonly synergyHpPct: number
  readonly hpBonusPct: number
  readonly maxHp: number
  readonly attackRatingBonusPct: number
  readonly attackRatingBonus: number
  readonly attackRating: number
  readonly defenseBonus: number
  readonly defense: number
  readonly damageBonusPct: number
  readonly minDamage: number
  readonly maxDamage: number
}

export interface BloodGolemStats {
  readonly lifeLeechPct: number
  readonly ownerHealSplitPct: number
  readonly golemHealSplitPct: number
  readonly damageSharePct: number
  readonly baseHp: number
  readonly hpBonusPct: number
  readonly maxHp: number
  readonly attackRatingBonus: number
  readonly attackRating: number
  readonly defenseBonus: number
  readonly defense: number
  readonly damageBonusPct: number
  readonly minDamage: number
  readonly maxDamage: number
}

export interface IronGolemItemProps {
  readonly minDamage?: number | undefined
  readonly maxDamage?: number | undefined
  readonly baseDamage?: number | undefined
  readonly defense?: number | undefined
  readonly isEthereal?: boolean | undefined
  readonly isMetallic?: boolean | undefined
  readonly auras?: number[] | undefined
}

export interface IronGolemStats {
  readonly thornsReturnPct: number
  readonly defenseBonus: number
  readonly defense: number
  readonly baseHp: number
  readonly hpBonusPct: number
  readonly maxHp: number
  readonly attackRatingBonus: number
  readonly attackRating: number
  readonly damageBonusPct: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly inheritedDamage: number
  readonly inheritedDefense: number
  readonly inheritedAuras: number[]
  readonly translucentFade: number
}

export interface FireGolemStats {
  readonly holyFireAuraLevel: number
  readonly holyFirePulseDmg: number
  readonly holyFirePulseMin: number
  readonly holyFirePulseMax: number
  readonly holyFirePulseMin256: number
  readonly holyFirePulseMax256: number
  readonly holyFireRadiusSubtiles: number
  readonly meleeFireMin: number
  readonly meleeFireMax: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly fireAbsorbPct: number
  readonly fireResist: number
  readonly deathExplosionDmg: number
  readonly baseHp: number
  readonly hpBonusPct: number
  readonly maxHp: number
  readonly defenseBonus: number
  readonly defense: number
  readonly attackRatingBonus: number
  readonly attackRating: number
}

export interface ReviveStats {
  readonly maxCount: number
  readonly hpBonusPct: number
  readonly hpMultiplier: number
  readonly damageBonusPct: number
  readonly damageMultiplier: number
  readonly velocityBonusPct: number
  readonly durationFrames: number
  readonly clampedCorpseBaseHp: number
  readonly maxHp: number
  readonly minDamage: number
  readonly maxDamage: number
}

export interface RaiseSkeletonStats {
  readonly maxCount: number
  readonly baseHp: number
  readonly flatHpBonus: number
  readonly hpBonusPct: number
  readonly maxHp: number
  readonly baseMinDamage: number
  readonly baseMaxDamage: number
  readonly edmnBonus: number
  readonly flatDamageBonus: number
  readonly damageBonusPct: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly attackRating: number
  readonly defense: number
  readonly shieldChancePct: number
}

export interface SkeletalMageStats {
  readonly maxCount: number
  readonly baseHp: number
  readonly flatHpBonus: number
  readonly hpBonusPct: number
  readonly maxHp: number
  readonly defense: number
  readonly missileLevel: number
}

export interface NecromageMissileStats {
  readonly missileName: 'necromage1' | 'necromage2' | 'necromage3' | 'necromage4'
  readonly elemType: 'pois' | 'cold' | 'fire' | 'ltng'
  readonly missileLevel: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly minDamage256: number
  readonly maxDamage256: number
  readonly durationFrames: number
}

/**
 * 1.13c Raise Skeleton (Skill 70) and Skeletal Mage (Skill 80) Max Count Formula:
 * (slvl < 4) ? slvl : (2 + floor(slvl / 3))
 * Levels: 1->1, 2->2, 3->3, 4->3, 5->3, 6->4, 10->5, 20->8.
 */
export function calculateSkeletonMaxCount(slvl: number): number {
  if (!Number.isFinite(slvl) || slvl <= 0) return 0
  const lvl = Math.floor(slvl)
  return lvl < 4 ? lvl : 2 + Math.floor(lvl / 3)
}

/**
 * 1.13c Raise Skeletal Mage (Skill 80) Max Count Formula:
 * Same progression as Raise Skeleton: (slvl < 4) ? slvl : (2 + floor(slvl / 3))
 */
export function calculateSkeletalMageMaxCount(slvl: number): number {
  return calculateSkeletonMaxCount(slvl)
}

/**
 * 1.13c Revive (Skill 95) Max Count Formula:
 * Exactly slvl (1 at lvl 1, 10 at lvl 10, 20 at lvl 20).
 */
export function calculateReviveMaxCount(slvl: number): number {
  if (!Number.isFinite(slvl) || slvl <= 0) return 0
  return Math.floor(slvl)
}

/**
 * 1.13c Skeleton Mastery (Skill 69) Passive Bonuses:
 * - Flat HP to Skeletons: +8 * slvl
 * - Flat Dmg to Skeletons & Mages: +2 * slvl
 * - Life % to Revives: +5% * slvl (par3 = 5)
 * - Dmg % to Skeletons, Mages, Revives: +10% * slvl (par4 = 10)
 * - Defense: +10 * slvl
 */
export function calculateSkeletonMasteryStats(slvl: number): SkeletonMasteryStats {
  if (!Number.isFinite(slvl) || slvl <= 0) {
    return { skeletonHp: 0, skeletonDamage: 0, reviveHpPct: 0, damagePct: 0, defense: 0 }
  }
  const lvl = Math.floor(slvl)
  return {
    skeletonHp: 8 * lvl,
    skeletonDamage: 2 * lvl,
    reviveHpPct: 5 * lvl,
    damagePct: 10 * lvl,
    defense: 10 * lvl,
  }
}

/**
 * 1.13c Golem Mastery (Skill 79) Passive Bonuses (Skills.txt row 79):
 * - passivestat1 = maxhp (`ln12`, Param1=20, Param2=20): 20 * slvl % (slvl 1: 20%, 10: 200%, 20: 400%)
 * - passivestat2 = velocitypercent (`dm34`, Param3=0, Param4=40): dm(0, 40, slvl) (slvl 1: 6%, 10: 27%, 20: 33%)
 * - passivestat3 = tohit (`ln56`, Param5=25, Param6=25): 25 * slvl flat Attack Rating (slvl 1: 25, 10: 250, 20: 500)
 */
export function calculateGolemMasteryStats(slvl: number): GolemMasteryStats {
  if (!Number.isFinite(slvl) || slvl <= 0) {
    return { hpBonusPct: 0, speedBonusPct: 0, attackRatingBonus: 0 }
  }
  const lvl = Math.floor(slvl)
  const hpBonusPct = 20 * lvl
  const speedBonusPct = computeDiminishingReturns(0, 40, lvl)
  const attackRatingBonus = 25 * lvl
  return { hpBonusPct, speedBonusPct, attackRatingBonus }
}

/**
 * 1.13c Summon Resist (Skill 89) Diminishing Passive Resistances:
 * dm12 curve with Param1=20, Param2=75: computeDiminishingReturns(20, 75, slvl)
 * slvl 1: 28%, slvl 5: 47%, slvl 10: 57%, slvl 20: 66%, slvl 60: 75%. Hard cap at 75%.
 */
export function calculateSummonResistPct(slvl: number): number {
  if (!Number.isFinite(slvl) || slvl <= 0) return 0
  return computeDiminishingReturns(20, 75, Math.floor(slvl))
}

/**
 * 1.13c Clay Golem (Skill 75) Stats & Synergies (`Skills.txt` row 75 + `MonStats.txt` `claygolem` #289):
 * - Base HP by difficulty: 100 (Normal), 175 (Nightmare), 275 (Hell)
 * - calc1 (multiplicative HP %): (100 + 35 * (slvl - 1)) * (100 + GM.ln12 + 5 * BG.blvl) / 100 - 100
 * - Slow % (`aurastat1 = item_slow`): dm34(0, 75) (slvl 1: 11%, slvl 10: 51%, slvl 20: 63%)
 * - Defense (`passivestat1 = armorclass`): 100 + 35 * IronGolem.blvl
 * - Attack Rating (`passivestat2 = tohit`): baseTH (40/66/92) + 25 * GM.lvl + 20 * slvl
 * - Damage (`passivestat3 = damagepercent`): 35 * (slvl - 1) + 6 * FireGolem.blvl %
 */
export function calculateClayGolemStats(
  slvl: number,
  golemMasteryLvl = 0,
  bloodGolemSynergyLvl = 0,
  synergies?: GolemSynergies,
): ClayGolemStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const diff = synergies?.difficulty ?? 0
  const gmStats = calculateGolemMasteryStats(golemMasteryLvl)
  const slowPct = computeDiminishingReturns(0, 75, lvl)
  const baseHpTable = [100, 175, 275] as const
  const baseHp = baseHpTable[diff] ?? 100
  const selfHpPct = (lvl - 1) * 35
  const bgBlvl = Math.max(0, Math.floor(synergies?.bloodGolemBlvl ?? bloodGolemSynergyLvl))
  const igBlvl = Math.max(0, Math.floor(synergies?.ironGolemBlvl ?? 0))
  const fgBlvl = Math.max(0, Math.floor(synergies?.fireGolemBlvl ?? 0))
  const synergyHpPct = gmStats.hpBonusPct + bgBlvl * 5
  const hpBonusPct = Math.floor(((100 + selfHpPct) * (100 + synergyHpPct)) / 100) - 100
  const maxHp = Math.floor((baseHp * (100 + hpBonusPct)) / 100)

  const baseArTable = [40, 66, 92] as const
  const baseAr = baseArTable[diff] ?? 40
  const attackRatingBonus = 20 * lvl + gmStats.attackRatingBonus
  const attackRating = baseAr + attackRatingBonus

  const defenseBonus = igBlvl * 35
  const defense = 100 + defenseBonus

  const baseMinTable = [2, 2, 3] as const
  const baseMaxTable = [5, 6, 7] as const
  const baseMin = baseMinTable[diff] ?? 2
  const baseMax = baseMaxTable[diff] ?? 5
  const damageBonusPct = (lvl - 1) * 35 + fgBlvl * 6
  const minDamage = Math.floor((baseMin * (100 + damageBonusPct)) / 100)
  const maxDamage = Math.floor((baseMax * (100 + damageBonusPct)) / 100)

  return {
    slowPct,
    baseHp,
    selfHpPct,
    synergyHpPct,
    hpBonusPct,
    maxHp,
    attackRatingBonusPct: 20 * lvl,
    attackRatingBonus,
    attackRating,
    defenseBonus,
    defense,
    damageBonusPct,
    minDamage,
    maxDamage,
  }
}

/**
 * 1.13c Blood Golem (Skill 85) Stats (`Skills.txt` row 85 + `MonStats.txt` `bloodgolem` #290):
 * - Base HP by difficulty: 201 (Normal), 388 (Nightmare), 637 (Hell)
 * - calc1 (HP %): GM.ln12 (20 * GM.lvl)
 * - Life Steal % (`dm12(75, 150)`): 86% at slvl 1, 126% at slvl 10, 138% at slvl 20
 *   Split: Param3 = 30% to Necromancer owner, 70% to Blood Golem (EventFunc23)
 * - Damage Share (`Param6 = 25%`): 25% of damage taken transferred to Necromancer (clamped >= 1 HP) (EventFunc26)
 * - Defense: 120 + 35 * IronGolem.blvl
 * - Attack Rating: baseTH (60/104/148) + 25 * GM.lvl + 20 * ClayGolem.blvl
 * - Damage: 35 * (slvl - 1) + 6 * FireGolem.blvl %
 */
export function calculateBloodGolemStats(
  slvl: number,
  golemMasteryLvl = 0,
  synergies?: GolemSynergies,
): BloodGolemStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const diff = synergies?.difficulty ?? 0
  const gmStats = calculateGolemMasteryStats(golemMasteryLvl)
  const baseHpTable = [201, 388, 637] as const
  const baseHp = baseHpTable[diff] ?? 201
  const hpBonusPct = gmStats.hpBonusPct
  const maxHp = Math.floor((baseHp * (100 + hpBonusPct)) / 100)
  const lifeLeechPct = computeDiminishingReturns(75, 150, lvl)

  const cgBlvl = Math.max(0, Math.floor(synergies?.clayGolemBlvl ?? 0))
  const igBlvl = Math.max(0, Math.floor(synergies?.ironGolemBlvl ?? 0))
  const fgBlvl = Math.max(0, Math.floor(synergies?.fireGolemBlvl ?? 0))

  const baseArTable = [60, 104, 148] as const
  const attackRatingBonus = gmStats.attackRatingBonus + cgBlvl * 20
  const attackRating = (baseArTable[diff] ?? 60) + attackRatingBonus
  const defenseBonus = igBlvl * 35
  const defense = 120 + defenseBonus

  const baseMinTable = [6, 9, 10] as const
  const baseMaxTable = [16, 23, 27] as const
  const damageBonusPct = (lvl - 1) * 35 + fgBlvl * 6
  const minDamage = Math.floor(((baseMinTable[diff] ?? 6) * (100 + damageBonusPct)) / 100)
  const maxDamage = Math.floor(((baseMaxTable[diff] ?? 16) * (100 + damageBonusPct)) / 100)

  return {
    lifeLeechPct,
    ownerHealSplitPct: 30,
    golemHealSplitPct: 70,
    damageSharePct: 25,
    baseHp,
    hpBonusPct,
    maxHp,
    attackRatingBonus,
    attackRating,
    defenseBonus,
    defense,
    damageBonusPct,
    minDamage,
    maxDamage,
  }
}

/**
 * 1.13c Iron Golem (Skill 90) Stats (`Skills.txt` row 90 + `MonStats.txt` `irongolem` #291):
 * - Base HP by difficulty: 306 (Normal), 595 (Nightmare), 980 (Hell)
 * - calc1 (HP %): GM.ln12 + 5 * BloodGolem.blvl
 * - Innate Thorns reflection (`ln12`, Param1=150, Param2=15): 150 + (slvl - 1) * 15 %
 * - Defense bonus (`passivestat3 = armorclass`, `lvl * par8`): 35 * slvl (35 at slvl 1, 700 at slvl 20)
 * - Attack Rating: baseTH (80/138/197) + 25 * GM.lvl + 20 * ClayGolem.blvl
 * - Damage: 6 * FireGolem.blvl %
 */
export function calculateIronGolemStats(
  slvl: number,
  itemProps?: IronGolemItemProps,
  golemMasteryLvl = 0,
  synergies?: GolemSynergies,
): IronGolemStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const diff = synergies?.difficulty ?? 0
  const gmStats = calculateGolemMasteryStats(golemMasteryLvl)
  const thornsReturnPct = 150 + (lvl - 1) * 15
  const defenseBonus = 35 * lvl
  const baseHpTable = [306, 595, 980] as const
  const baseHp = baseHpTable[diff] ?? 306

  const cgBlvl = Math.max(0, Math.floor(synergies?.clayGolemBlvl ?? 0))
  const bgBlvl = Math.max(0, Math.floor(synergies?.bloodGolemBlvl ?? 0))
  const fgBlvl = Math.max(0, Math.floor(synergies?.fireGolemBlvl ?? 0))

  const hpBonusPct = gmStats.hpBonusPct + bgBlvl * 5
  const maxHp = Math.floor((baseHp * (100 + hpBonusPct)) / 100)

  const inheritedDamage = Math.max(0, itemProps?.baseDamage ?? 0)
  const inheritedDefense = Math.max(0, itemProps?.defense ?? 0)
  const inheritedAuras = itemProps?.auras ? [...itemProps.auras] : []
  const defense = 140 + defenseBonus + inheritedDefense

  const baseArTable = [80, 138, 197] as const
  const attackRatingBonus = gmStats.attackRatingBonus + cgBlvl * 20
  const attackRating = (baseArTable[diff] ?? 80) + attackRatingBonus

  const baseMinTable = [7, 11, 12] as const
  const baseMaxTable = [19, 30, 33] as const
  const damageBonusPct = fgBlvl * 6
  const minDamage = Math.floor((((baseMinTable[diff] ?? 7) + inheritedDamage) * (100 + damageBonusPct)) / 100)
  const maxDamage = Math.floor((((baseMaxTable[diff] ?? 19) + inheritedDamage) * (100 + damageBonusPct)) / 100)

  return {
    thornsReturnPct,
    defenseBonus,
    defense,
    baseHp,
    hpBonusPct,
    maxHp,
    attackRatingBonus,
    attackRating,
    damageBonusPct,
    minDamage,
    maxDamage,
    inheritedDamage,
    inheritedDefense,
    inheritedAuras,
    translucentFade: itemProps?.isEthereal ? 16 : 0,
  }
}

/**
 * 1.13c Fire Golem (Skill 94) Stats (`Skills.txt` row 94 + `MonStats.txt` `firegolem` #292):
 * - Base HP by difficulty: 313 (Normal), 613 (Nightmare), 1013 (Hell)
 * - calc1 (HP %): GM.ln12 + 5 * BloodGolem.blvl
 * - Holy Fire aura level (`sumsk1calc = min(ln56, 30)` with Param5=8, Param6=1): min(30, 7 + slvl)
 * - Holy Fire radial pulse damage (`#102 Holy Fire` at `holyFireAuraLevel`, HitShift=7, EMin=2 [1,2,3,5,7], EMax=6 [1,2,3,5,7])
 * - Melee Fire Damage (`aurastat3/4 = edmn/edmx` + Holy Fire `par5 = 6` added fire damage)
 * - Fire Absorption (`aurastat2 = item_absorbfire_percent = dm12(25, 100)`): 33% at slvl 1, 74% at slvl 10, 87% at slvl 20
 * - Innate Fire Resistance (`aurastat1 = fireresist = 100 - dm12`): 67% at slvl 1, 26% at slvl 10, 13% at slvl 20
 * - No death explosion in 1.13c (`deathExplosionDmg = 0`)
 */
export function calculateFireGolemStats(
  slvl: number,
  golemMasteryLvl = 0,
  synergies?: GolemSynergies,
): FireGolemStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const diff = synergies?.difficulty ?? 0
  const gmStats = calculateGolemMasteryStats(golemMasteryLvl)
  const holyFireAuraLevel = Math.min(30, 7 + lvl)
  const hfMinRaw = compute5BandScaling(holyFireAuraLevel, 2, 1, 2, 3, 5, 7)
  const hfMaxRaw = compute5BandScaling(holyFireAuraLevel, 6, 1, 2, 3, 5, 7)
  const holyFirePulseMin256 = hfMinRaw << 7
  const holyFirePulseMax256 = hfMaxRaw << 7
  const holyFirePulseMin = holyFirePulseMin256 >> 8
  const holyFirePulseMax = holyFirePulseMax256 >> 8
  const holyFirePulseDmg = holyFirePulseMin
  const holyFireRadiusSubtiles = 6 + (holyFireAuraLevel - 1)

  const edmn = compute5BandScaling(lvl, 10, 9, 10, 11, 12, 13)
  const edmx = compute5BandScaling(lvl, 27, 10, 11, 12, 13, 14)
  const meleeFireMin = edmn + holyFirePulseMin * 6
  const meleeFireMax = edmx + holyFirePulseMax * 6

  const fireAbsorbPct = computeDiminishingReturns(25, 100, lvl)
  const fireResist = 100 - fireAbsorbPct
  const baseHpTable = [313, 613, 1013] as const
  const baseHp = baseHpTable[diff] ?? 313

  const cgBlvl = Math.max(0, Math.floor(synergies?.clayGolemBlvl ?? 0))
  const bgBlvl = Math.max(0, Math.floor(synergies?.bloodGolemBlvl ?? 0))
  const igBlvl = Math.max(0, Math.floor(synergies?.ironGolemBlvl ?? 0))

  const hpBonusPct = gmStats.hpBonusPct + bgBlvl * 5
  const maxHp = Math.floor((baseHp * (100 + hpBonusPct)) / 100)
  const defenseBonus = igBlvl * 35
  const defense = 200 + defenseBonus

  const baseArTable = [120, 209, 298] as const
  const attackRatingBonus = gmStats.attackRatingBonus + cgBlvl * 20
  const attackRating = (baseArTable[diff] ?? 120) + attackRatingBonus

  const baseMinTable = [10, 15, 18] as const
  const baseMaxTable = [27, 39, 47] as const

  return {
    holyFireAuraLevel,
    holyFirePulseDmg,
    holyFirePulseMin,
    holyFirePulseMax,
    holyFirePulseMin256,
    holyFirePulseMax256,
    holyFireRadiusSubtiles,
    meleeFireMin,
    meleeFireMax,
    minDamage: baseMinTable[diff] ?? 10,
    maxDamage: baseMaxTable[diff] ?? 27,
    fireAbsorbPct,
    fireResist,
    deathExplosionDmg: 0,
    baseHp,
    hpBonusPct,
    maxHp,
    defenseBonus,
    defense,
    attackRatingBonus,
    attackRating,
  }
}

/**
 * 1.13c Raise Skeleton (Skill 70) Stats (Skills.txt + MonStats.txt `necroskeleton` #363):
 * - Base HP by difficulty: 21 (Normal), 30 (Nightmare), 42 (Hell)
 * - passivestat1 = maxhp: +8 * SM.lvl
 * - calc1 (hp % adjustment): (slvl < 4) ? 0 : 50 * (slvl - 3)
 * - Base Damage: 1–2
 * - EMin / EMinLev1..5 (edmn): 0, 0, 1, 2, 3, 4
 * - passivestat2 = item_normaldamage: 2 * SM.lvl + edmn(slvl)
 * - aurastat1 = damagepercent: (slvl < 4) ? 0 : 7 * (slvl - 3)
 * - aurastat2 = tohit: baseTH + 15 * (slvl + SM.lvl) (baseTH = 5 / 4 / 6)
 * - aurastat3 = armorclass: baseAC + 15 * (slvl + SM.lvl) (baseAC = 5 / 5 / 6)
 * - Param1 (% chance of shield): 5%
 */
export function calculateRaiseSkeletonStats(
  slvl: number,
  skeletonMasteryLvl = 0,
  difficulty: 0 | 1 | 2 = 0,
): RaiseSkeletonStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const smLvl = Number.isFinite(skeletonMasteryLvl) ? Math.max(0, Math.floor(skeletonMasteryLvl)) : 0
  const maxCount = calculateSkeletonMaxCount(lvl)
  const baseHp = difficulty === 2 ? 42 : difficulty === 1 ? 30 : 21
  const flatHpBonus = 8 * smLvl
  const hpBonusPct = lvl < 4 ? 0 : 50 * (lvl - 3)
  const maxHp = Math.floor(((baseHp + flatHpBonus) * (100 + hpBonusPct)) / 100)

  const baseMinDamage = 1
  const baseMaxDamage = 2
  const edmnBonus = compute5BandScaling(lvl, 0, 0, 1, 2, 3, 4)
  const flatDamageBonus = 2 * smLvl + edmnBonus
  const damageBonusPct = lvl < 4 ? 0 : 7 * (lvl - 3)
  const minDamage = Math.floor(((baseMinDamage + flatDamageBonus) * (100 + damageBonusPct)) / 100)
  const maxDamage = Math.floor(((baseMaxDamage + flatDamageBonus) * (100 + damageBonusPct)) / 100)

  const baseTH = difficulty === 2 ? 6 : difficulty === 1 ? 4 : 5
  const baseAC = difficulty === 2 ? 6 : 5
  const attackRating = baseTH + 15 * (lvl + smLvl)
  const defense = baseAC + 15 * (lvl + smLvl)

  return {
    maxCount,
    baseHp,
    flatHpBonus,
    hpBonusPct,
    maxHp,
    baseMinDamage,
    baseMaxDamage,
    edmnBonus,
    flatDamageBonus,
    damageBonusPct,
    minDamage,
    maxDamage,
    attackRating,
    defense,
    shieldChancePct: 5,
  }
}

/**
 * 1.13c Raise Skeletal Mage (Skill 80) Stats (Skills.txt + MonStats.txt `necromage` #364):
 * - Base HP by difficulty: 61 (Normal), 88 (Nightmare), 123 (Hell)
 * - passivestat1 = maxhp: +8 * SM.lvl
 * - calc1 (hp % adjustment): (slvl < 4) ? 0 : 7 * (slvl - 3)
 * - aurastat1 = armorclass: baseAC + 10 * (slvl + SM.lvl) (baseAC = 24 / 26 / 28)
 * - sumskill1 = NecromageMissile (#338), sumsk1calc: SM.lvl + ((slvl < 4) ? 0 : floor((slvl - 2) / 2))
 */
export function calculateSkeletalMageStats(
  slvl: number,
  skeletonMasteryLvl = 0,
  difficulty: 0 | 1 | 2 = 0,
): SkeletalMageStats {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  const smLvl = Number.isFinite(skeletonMasteryLvl) ? Math.max(0, Math.floor(skeletonMasteryLvl)) : 0
  const maxCount = calculateSkeletalMageMaxCount(lvl)
  const baseHp = difficulty === 2 ? 123 : difficulty === 1 ? 88 : 61
  const flatHpBonus = 8 * smLvl
  const hpBonusPct = lvl < 4 ? 0 : 7 * (lvl - 3)
  const maxHp = Math.floor(((baseHp + flatHpBonus) * (100 + hpBonusPct)) / 100)
  const baseAC = difficulty === 2 ? 28 : difficulty === 1 ? 26 : 24
  const defense = baseAC + 10 * (lvl + smLvl)
  const missileLevel = Math.max(1, smLvl + (lvl < 4 ? 0 : Math.floor((lvl - 2) / 2)))
  return {
    maxCount,
    baseHp,
    flatHpBonus,
    hpBonusPct,
    maxHp,
    defense,
    missileLevel,
  }
}

/**
 * 1.13c Sub-Skill #338 `NecromageMissile` (`SrvDoFunc[149]` `0x6FD0DA10` + `Missiles.txt` #208..#211):
 * - `'poison'` (COMP_RH=0) -> `necromage1` (#208): EType='pois', EMin/EMax=6, Lev1..5=1,2,4,6,8, ELen=500, ELevLen1..3=250
 * - `'cold'`   (COMP_RH=1) -> `necromage2` (#209): EType='cold', HitShift=8, EMin=1, EMax=4, Lev1..5=1,2,3,4,5, ELen=25, ELevLen1..3=25
 * - `'fire'`   (COMP_RH=2) -> `necromage3` (#210): EType='fire', HitShift=8, EMin=2, EMax=6, Lev1..5=2,3,5,7,9
 * - `'lightning'` (COMP_RH=3) -> `necromage4` (#211): EType='ltng', HitShift=8, EMin=1 (Lev1..5=1), EMax=7 (Lev1..5=3,5,8,11,14)
 */
export function calculateNecromageMissileDamage(
  element: 'poison' | 'cold' | 'fire' | 'lightning',
  slvl: number,
  skeletonMasteryLvl = 0,
): NecromageMissileStats {
  const { missileLevel } = calculateSkeletalMageStats(slvl, skeletonMasteryLvl, 0)
  if (element === 'poison') {
    const rate = compute5BandScaling(missileLevel, 6, 1, 2, 4, 6, 8)
    const durationFrames = compute3BandDuration(missileLevel, 500, 250, 250, 250)
    const totalDmg256 = rate * durationFrames
    const totalDmg = Math.floor(totalDmg256 / 256)
    return {
      missileName: 'necromage1',
      elemType: 'pois',
      missileLevel,
      minDamage: totalDmg,
      maxDamage: totalDmg,
      minDamage256: totalDmg256,
      maxDamage256: totalDmg256,
      durationFrames,
    }
  }
  if (element === 'cold') {
    const minDamage = compute5BandScaling(missileLevel, 1, 1, 2, 3, 4, 5)
    const maxDamage = compute5BandScaling(missileLevel, 4, 1, 2, 3, 4, 5)
    const durationFrames = compute3BandDuration(missileLevel, 25, 25, 25, 25)
    return {
      missileName: 'necromage2',
      elemType: 'cold',
      missileLevel,
      minDamage,
      maxDamage,
      minDamage256: minDamage * 256,
      maxDamage256: maxDamage * 256,
      durationFrames,
    }
  }
  if (element === 'lightning') {
    const minDamage = compute5BandScaling(missileLevel, 1, 1, 1, 1, 1, 1)
    const maxDamage = compute5BandScaling(missileLevel, 7, 3, 5, 8, 11, 14)
    return {
      missileName: 'necromage4',
      elemType: 'ltng',
      missileLevel,
      minDamage,
      maxDamage,
      minDamage256: minDamage * 256,
      maxDamage256: maxDamage * 256,
      durationFrames: 0,
    }
  }
  const minDamage = compute5BandScaling(missileLevel, 2, 2, 3, 5, 7, 9)
  const maxDamage = compute5BandScaling(missileLevel, 6, 2, 3, 5, 7, 9)
  return {
    missileName: 'necromage3',
    elemType: 'fire',
    missileLevel,
    minDamage,
    maxDamage,
    minDamage256: minDamage * 256,
    maxDamage256: maxDamage * 256,
    durationFrames: 0,
  }
}

/**
 * 1.13c Revive (Skill 95) Stats (Skills.txt row #95 & SKILLS_SrvDo058_Revive @ 0x6FC71340):
 * - Lifespan: calc2 = ln34 (Param3 = 4500, Param4 = 0) -> 4500 frames (180 seconds @ 25Hz)
 * - Caster Level Clamping (0x6FC71340): if casterLevel < monsterLevel, base HP is scaled by
 *   floor(corpseBaseHp * casterLevel / monsterLevel) before applying calc1
 * - calc1 (HP % adjustment): par1 + SM.lvl * SM.par3 = 200% + 5% * SM.lvl -> 3.0 + SM.lvl * 0.05
 * - aurastat1 = damagepercent: SM.lvl * SM.par4 = +10% * SM.lvl (0% base bonus!) -> 1.0 + SM.lvl * 0.10
 * - passivestat1 = velocitypercent: par5 = +50%
 */
export function calculateReviveStats(
  slvl: number,
  skeletonMasteryLvl = 0,
  corpseOpts?: {
    readonly baseMaxHp?: number | undefined
    readonly monsterLevel?: number | undefined
    readonly casterLevel?: number | undefined
    readonly baseMinDamage?: number | undefined
    readonly baseMaxDamage?: number | undefined
  },
): ReviveStats {
  const maxCount = calculateReviveMaxCount(slvl)
  const smLvl = Math.max(0, Math.floor(skeletonMasteryLvl))
  const hpBonusPct = 200 + smLvl * 5
  const hpMultiplier = (100 + hpBonusPct) / 100
  const damageBonusPct = smLvl * 10
  const damageMultiplier = (100 + damageBonusPct) / 100
  const velocityBonusPct = 50
  const durationFrames = 4500

  const rawCorpseHp = Math.max(1, Math.floor(corpseOpts?.baseMaxHp ?? 1000))
  const monLvl =
    corpseOpts?.monsterLevel !== undefined && corpseOpts.monsterLevel > 0
      ? Math.floor(corpseOpts.monsterLevel)
      : undefined
  const cLvl =
    corpseOpts?.casterLevel !== undefined && corpseOpts.casterLevel > 0
      ? Math.floor(corpseOpts.casterLevel)
      : undefined
  const clampedCorpseBaseHp =
    monLvl !== undefined && cLvl !== undefined && cLvl < monLvl
      ? Math.max(1, Math.floor((rawCorpseHp * cLvl) / monLvl))
      : rawCorpseHp
  const maxHp = Math.floor((clampedCorpseBaseHp * (100 + hpBonusPct)) / 100)

  const baseMinDmg = Math.max(0, Math.floor(corpseOpts?.baseMinDamage ?? 10))
  const baseMaxDmg = Math.max(baseMinDmg, Math.floor(corpseOpts?.baseMaxDamage ?? Math.max(baseMinDmg, 20)))
  const minDamage = Math.floor((baseMinDmg * (100 + damageBonusPct)) / 100)
  const maxDamage = Math.floor((baseMaxDmg * (100 + damageBonusPct)) / 100)

  return {
    maxCount,
    hpBonusPct,
    hpMultiplier,
    damageBonusPct,
    damageMultiplier,
    velocityBonusPct,
    durationFrames,
    clampedCorpseBaseHp,
    maxHp,
    minDamage,
    maxDamage,
  }
}



// -------------------------------------------------------------------------------------------------
// #1790 online-room bridge types (sub-tile space). See `MissileEngine.stepOnlineMissileSrvDo113c` /
// `MissileEngine.resolveOnlineMissileSrvHit113c`.
// -------------------------------------------------------------------------------------------------

export type OnlineMissileHitTrigger113c = 'unit' | 'wall' | 'expire'

/** Per-missile state the room keeps for its `pSrvDoFunc` / `pSrvHitFunc` dispatch. */
export interface OnlineMissileState113c {
  readonly row: MissileRecord
  readonly sourceSkillId: number
  readonly slvl: number
  x: number
  y: number
  vx: number
  vy: number
  readonly originX: number
  readonly originY: number
  ageFrames: number
  remainingFrames: number
  /** `MISSILE_GetTargetX` circle index of `SrvDo15` (Frozen Orb). */
  subMissileIdx: number
  /** Fractional point cursor along a path-mode trajectory (Blessed Hammer spiral). */
  pathCursor: number
  /** Unit-locked homing target (`SrvDo07` / `SrvHit10`). */
  lockedTargetKey: string | undefined
  /** Frames of a ground-targeted homing arrow's first leg (`TargetX & 2`). */
  groundLegFrames: number
  /** Stored path target vector of `SrvDo16` (Frozen Orb nova curl). */
  targetOffsetX: number | undefined
  targetOffsetY: number | undefined
  pathLastX: number
  pathLastY: number
  pathStepAccum: number
  /** Remaining `SrvHit12` bounces. */
  chainRemaining: number
  /** One-shot hit functions (`SrvHit04/09/14/20/29`) already ran. */
  hitFired: boolean
}

/** A hostile unit a srvdo/srvhit function may search (room key + sub-tile position). */
export interface OnlineMissileTarget113c {
  readonly key: string
  readonly x: number
  readonly y: number
}

/**
 * Damage carried by a child missile: `'inherit'` = the parent's rolled packet, `'groundfire'` =
 * per-frame burning damage (`SrvDo05` / `SrvDmg03`), `'own'` = the child's own `Missiles.txt`
 * `D2Common#10413` damage (`rancidgascloud` / `chokinggascloud` / `stranglinggascloud`), `'none'` = no damage.
 */
export type OnlineMissileChildDamage113c = 'inherit' | 'none' | 'groundfire' | 'own'

export interface OnlineMissileSpawn113c {
  readonly missileName: string
  readonly x: number
  readonly y: number
  readonly targetX: number
  readonly targetY: number
  readonly damage: OnlineMissileChildDamage113c
  readonly speedSubTilesPerFrame?: number
  readonly lifetimeFrames?: number
  readonly chainRemaining?: number
  /** Unit the child must not hit first (the bounce source). */
  readonly excludeKey?: string | undefined
  readonly targetOffsetX?: number
  readonly targetOffsetY?: number
}

/** 8-direction sub-tile offsets used by `MISSILES_SpawnGasCloudGrid` (`0x6FD1C890` / `0x6FD1C8B0`). */
export const GAS_CLOUD_RING8_X_113C = [2, 2, 0, -2, -2, -2, 0, 2] as const
export const GAS_CLOUD_RING8_Y_113C = [0, 2, 2, 2, 0, -2, -2, -2] as const

/** 16-direction sub-tile offsets used by `SrvHit02` (`sub_6FC5D680`, `0x6FD1CBA0` / `0x6FD1CB60`). */
export const GAS_CLOUD_RING16_X_113C = [0, 1, 2, 2, 2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2, -1] as const
export const GAS_CLOUD_RING16_Y_113C = [2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2, -1, 0, 1, 2, 2] as const

export interface OnlineMissileSplash113c {
  readonly radiusSubtiles: number
  /** The directly struck unit, already damaged by the collision. */
  readonly excludeKey: string | undefined
}

export interface OnlineMissileSrvDoResult113c {
  readonly spawns: OnlineMissileSpawn113c[]
  readonly terminate: boolean
}

export interface OnlineMissileSrvHitResult113c {
  readonly spawns: OnlineMissileSpawn113c[]
  readonly splash: OnlineMissileSplash113c | undefined
  readonly outcome: 'default' | 'pierce' | 'expire' | 'passthrough'
}

export type OnlineMissileSrvDoKind113c =
  | 'standard'
  | 'groundfire'
  | 'pathspawner'
  | 'homing'
  | 'areaspawner'
  | 'orb'
  | 'orbnova'
  | 'spiral'
  | 'engine-only'

export type OnlineMissileSrvHitKind113c =
  | 'none'
  | 'splash'
  | 'aurasplash'
  | 'gasring16'
  | 'gasring8'
  | 'subexplode'
  | 'immolation'
  | 'persist'
  | 'homing'
  | 'chain'
  | 'meteor'
  | 'fury'
  | 'orbnova'
  | 'engine-only'

/** `gMissileSrvDoFuncTable` entries the room dispatches (everything else stays `MissileEngine.tick`-only). */
export function classifyOnlineSrvDoFunc113c(fn: number): OnlineMissileSrvDoKind113c {
  switch (fn) {
    case 0:
    case 1:
      return 'standard'
    case 5:
      return 'groundfire'
    case 6:
    case 9:
    case 12:
    case 13:
      return 'pathspawner'
    case 7:
      return 'homing'
    case 8:
    case 10:
      return 'areaspawner'
    case 15:
      return 'orb'
    case 16:
      return 'orbnova'
    default:
      return 'engine-only'
  }
}

/** `gpMissileSrvHitFnTable` entries the room dispatches (everything else stays `MissileEngine.tick`-only). */
export function classifyOnlineSrvHitFunc113c(fn: number): OnlineMissileSrvHitKind113c {
  switch (fn) {
    case 0:
      return 'none'
    case 1:
    case 24:
      return 'splash'
    case 2:
      return 'gasring16'
    case 3:
    case 13:
    case 44:
      return 'aurasplash'
    case 4:
      return 'subexplode'
    case 9:
      return 'immolation'
    case 8:
      return 'persist'
    case 10:
      return 'homing'
    case 12:
      return 'chain'
    case 14:
      return 'meteor'
    case 20:
      return 'fury'
    case 25:
      return 'gasring8'
    case 29:
      return 'orbnova'
    default:
      return 'engine-only'
  }
}

/** `pSrvHitFunc`s that also run on range expiry without `AlwaysExplode` (`MISSILE_Collide` `0x6FC5EDE0`). */
export const ONLINE_EXPIRE_CAPABLE_SRV_HIT_113C: ReadonlySet<number> = new Set([
  2, 3, 4, 9, 14, 20, 22, 23, 29, 30, 31, 32, 34, 36, 37, 42, 43, 44, 47, 48, 56, 59,
])

/** Blessed Hammer path length (`PATH_ComputePathBlessedHammer`, `i = 0..76`). */
export const BLESSED_HAMMER_PATH_POINTS_113C = 77
/** `9600 / 65536` sub-tiles of radius per path point. */
export const BLESSED_HAMMER_DR_SUBTILES_113C = 9600 / 65536
/** 32 path points per revolution (`16` binary-256 angle units per point). */
export const BLESSED_HAMMER_POINTS_PER_TURN_113C = 32
/** Start angle: screen north-west, i.e. world `-x`, independent of the caster's facing. */
export const BLESSED_HAMMER_START_ANGLE_113C = Math.PI

/** Point `k` of the Blessed Hammer spiral around `(x0, y0)` in sub-tile coordinates. */
export function blessedHammerPathPoint113c(x0: number, y0: number, k: number): { x: number; y: number } {
  const theta = BLESSED_HAMMER_START_ANGLE_113C + (2 * Math.PI * k) / BLESSED_HAMMER_POINTS_PER_TURN_113C
  const r = k * BLESSED_HAMMER_DR_SUBTILES_113C
  return { x: x0 + r * Math.cos(theta), y: y0 + r * Math.sin(theta) }
}
