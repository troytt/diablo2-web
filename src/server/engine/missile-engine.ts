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
import type { D2DataRegistry, MissileRecord } from '../../common/data/data-registry.ts'
import { executeSUnitDmg, type CombatUnitContext, type SUnitDmgPacket } from './combat-pipeline.ts'
import { getBlizzardDropOffset } from '../../common/data/blizzard-table.ts'
import { METEOR_FIRE_SUBTILE_OFFSETS } from '../../common/data/meteor-table.ts'
import {
  calculateMeteorResidualFireDamage,
  calculateFistOfTheHeavensHolyBoltDamage,
} from '../skills/skills.ts'
import { FIXED_ONE } from './stat-list.ts'
import { compute3BandDuration, compute5BandScaling, computeDiminishingReturns, evaluateCalc } from '../../common/data/calc-ast.ts'
import { D2Rng, hashString32 } from '../../common/rng/d2-rng.ts'
import { ownerCanConsumePierce, resolveMissilePierceIdx } from './missile-pierce.ts'
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

  min = Math.floor(min * synMult * (1 + masteryBonus / 100))
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

  min = Math.floor(min * synMult * (1 + masteryBonus / 100))
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
 * Replicated byte-for-byte from D2Game.dll 0x6FC581F0 (MISSMODE_SrvDo15_FrozenOrb)
 * and 0x6FC5CE10 (MISSMODE_SrvHit29_FrozenOrb).
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
  readonly loops?: number | undefined
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
  readonly dmgPacket: SUnitDmgPacket
  chainRemaining: number
  lastHitTargetId?: string | undefined
  expired: boolean
  subMissileIdx?: number
  currentHitFrame?: number
  isTurret?: boolean | undefined
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
  /** Per-missile `pSeed` used by `SEED_InitLowSeed` / `ITEMS_RollLimitedRandomNumber` in SrvDo25/28/30. */
  doFuncRng?: D2Rng | undefined
  /** Locked target unit id for homing missiles (`MISSMODE_SrvDo07_GuidedArrow_BoneSpirit` `0x6FC59DC0`). */
  lockedTargetId?: string | undefined
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

/**
 * 1.13c `D2Common.#10389` (`0x6FDCF6A0`, 9-case jump table at `0x6FDCF8E8`):
 * Subtile footprint overlap between a missile of size `missileSize` (`1..3`, `Missiles.txt` `Size`)
 * and a target unit of size `targetSize` (`1..3`, `MonStats2.txt` `SizeX` or `2` for players).
 */
export function checkMissileSizeFootprintOverlap113c(
  dxSub: number,
  dySub: number,
  missileSize: number,
  targetSize: number = 2,
): boolean {
  const mSize = Math.trunc(missileSize)
  const tSize = Math.trunc(targetSize)
  if (mSize < 1 || mSize > 3 || tSize < 1 || tSize > 3) {
    return false
  }
  const dx = Math.abs(dxSub)
  const dy = Math.abs(dySub)
  const caseIdx = (mSize - 1) * 3 + (tSize - 1)
  switch (caseIdx) {
    case 0: // (1, 1): dx == 0 && dy == 0
      return dx < 1 && dy < 1
    case 1: // (1, 2): dx + dy <= 1
    case 3: // (2, 1): dx + dy <= 1
      return dx + dy <= 1
    case 4: // (2, 2): dx + dy <= 2
      return dx + dy <= 2
    case 2: // (1, 3): dx <= 1 && dy <= 1
    case 6: // (3, 1): dx <= 1 && dy <= 1
      return dx <= 1 && dy <= 1
    case 5: // (2, 3): (dx <= 2 && dy <= 1) || (dy <= 2 && dx <= 1)
    case 7: // (3, 2): (dx <= 2 && dy <= 1) || (dy <= 2 && dx <= 1)
      return (dx <= 2 && dy <= 1) || (dy <= 2 && dx <= 1)
    case 8: // (3, 3): dx <= 2 && dy <= 2
      return dx <= 2 && dy <= 2
    default:
      return false
  }
}

/**
 * 1.13c `D2Common.#10229` (`PATH_StepMissile`, `0x6FD80F80` -> `0x6FD5D420` -> `0x6FD5D580` / `0x6FD8E110`):
 * Halves `(dx, dy)` (`sar 1`) until both `|stepX| <= subtilePx` (`< 0x10000` in 16.16 fixed-point) and
 * `|stepY| <= subtilePx`, returning the sequence of stepped points from `(x0, y0)` to `(x1, y1)`.
 */
export function stepMissileSubtileRay113c(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  subtilePx: number = MISSILE_SUBTILE_FLAT_PX,
): { readonly x: number; readonly y: number }[] {
  let stepX = x1 - x0
  let stepY = y1 - y0
  let steps = 1
  const limit = Math.max(1e-6, subtilePx)
  while ((Math.abs(stepX) > limit || Math.abs(stepY) > limit) && steps < 256) {
    stepX *= 0.5
    stepY *= 0.5
    steps <<= 1
  }
  const points: { readonly x: number; readonly y: number }[] = [{ x: x0, y: y0 }]
  for (let i = 1; i <= steps; i++) {
    points.push({
      x: i === steps ? x1 : x0 + stepX * i,
      y: i === steps ? y1 : y0 + stepY * i,
    })
  }
  return points
}

/**
 * Check `0x6FDCF6A0` `Size` footprint overlap along a missile's per-tick movement segment `(x0, y0) -> (x1, y1)`.
 */
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
  const stepPoints = stepMissileSubtileRay113c(x0, y0, x1, y1, subtilePx)
  for (const pt of stepPoints) {
    const dxSub = Math.abs(tx - pt.x) / subtilePx
    const dySub = Math.abs((ty - pt.y) / yAspect) / subtilePx
    if (checkMissileSizeFootprintOverlap113c(dxSub, dySub, missileSize, targetSize)) {
      return true
    }
  }
  const segDx = x1 - x0
  const segDy = (y1 - y0) / yAspect
  const segLenSq = segDx * segDx + segDy * segDy
  if (segLenSq > 1e-6) {
    const relY = (ty - y0) / yAspect
    const t = Math.max(0, Math.min(1, ((tx - x0) * segDx + relY * segDy) / segLenSq))
    const cx = x0 + segDx * t
    const cy = y0 + (y1 - y0) * t
    const dxSub = Math.abs(tx - cx) / subtilePx
    const dySub = Math.abs((ty - cy) / yAspect) / subtilePx
    if (checkMissileSizeFootprintOverlap113c(dxSub, dySub, missileSize, targetSize)) {
      return true
    }
  }
  return false
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
    isTurret?: boolean
    fireCadenceTicks?: number
    spawnMissileType?: string
    maxRangeTicks?: number
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

    const fallbackName = String(params.missileNameOrId).trim().toLowerCase()
    const effectiveRec: MissileRecord =
      rec ?? {
        id: 0,
        name: fallbackName || 'defaultmissile',
        pCltDoFunc: 1,
        pCltHitFunc: 0,
        pSrvDoFunc: 1,
        pSrvHitFunc: 0,
        pSrvDmgFunc: 0,
        srvCalc1: '',
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        param5: 0,
        cltCalc1: '',
        cParam1: 0,
        cParam2: 0,
        cParam3: 0,
        cParam4: 0,
        cParam5: 0,
        sHitCalc1: '',
        sHitPar1: 0,
        sHitPar2: 0,
        sHitPar3: 0,
        cHitCalc1: '',
        cHitPar1: 0,
        cHitPar2: 0,
        cHitPar3: 0,
        dmgCalc1: '',
        dParam1: 0,
        dParam2: 0,
        vel: 16,
        maxVel: 24,
        velLev: 0,
        accel: 0,
        range: 40,
        levRange: 0,
        light: 0,
        flicker: 0,
        red: 255,
        green: 255,
        blue: 255,
        initSteps: 0,
        activate: 0,
        loopAnim: 0,
        celFile: fallbackName || 'fireball',
        animRate: 1024,
        animLen: 8,
        animSpeed: 16,
        subLoop: false,
        subStart: 0,
        subStop: 0,
        collideType: 3,
        collideKill: true,
        collideFriend: false,
        lastCollide: false,
        collision: true,
        clientCol: true,
        nextHit: false,
        nextDelay: 0,
        size: 2,
        returnFire: false,
        trans: 1,
        alwaysExplode: false,
        explosion: false,
        town: true,
        noUniqueMod: false,
        noMultiShot: false,
        holy: 0,
        canSlow: false,
        canDestroy: false,
        toHit: false,
        pierce: false,
        skill: '',
        hitShift: 8,
        srcDamage: 0,
        minDamage: 0,
        minLevDam1: 0,
        minLevDam2: 0,
        minLevDam3: 0,
        minLevDam4: 0,
        minLevDam5: 0,
        maxDamage: 0,
        maxLevDam1: 0,
        maxLevDam2: 0,
        maxLevDam3: 0,
        maxLevDam4: 0,
        maxLevDam5: 0,
        dmgSymPerCalc: '',
        eType: 'fire',
        eMin: 0,
        eMinLev1: 0,
        eMinLev2: 0,
        eMinLev3: 0,
        eMinLev4: 0,
        eMinLev5: 0,
        eMax: 0,
        eMaxLev1: 0,
        eMaxLev2: 0,
        eMaxLev3: 0,
        eMaxLev4: 0,
        eMaxLev5: 0,
        eDmgSymPerCalc: '',
        eLen: 0,
        eLevLen1: 0,
        eLevLen2: 0,
        eLevLen3: 0,
        hitClass: 0,
        numDirections: 16,
        localBlood: 0,
        damageRate: 0,
        explosionMissile: '',
        subMissile1: '',
        subMissile2: '',
        subMissile3: '',
        hitSubMissile1: '',
        hitSubMissile2: '',
        hitSubMissile3: '',
        hitSubMissile4: '',
        cltSubMissile1: '',
        cltSubMissile2: '',
        cltSubMissile3: '',
        cltHitSubMissile1: '',
        cltHitSubMissile2: '',
        cltHitSubMissile3: '',
        cltHitSubMissile4: '',
        raw: {},
      }

    const dx = params.targetX - params.startX
    const dy = params.targetY - params.startY
    const calculatedAngleRad = dx === 0 && dy === 0 ? Math.PI / 2 : Math.atan2(dy, dx)
    const angleRad = params.angleRad ?? calculatedAngleRad
    const isTurret = Boolean(params.isTurret || effectiveRec.name.toLowerCase() === 'hydra_turret')
    const isStationary =
      isTurret ||
      effectiveRec.vel === 0 ||
      effectiveRec.name.toLowerCase().startsWith('blizzard') ||
      effectiveRec.name.toLowerCase().startsWith('meteor') ||
      effectiveRec.name.toLowerCase() === 'erruption center' ||
      effectiveRec.name.toLowerCase() === 'volcano' ||
      effectiveRec.name.toLowerCase() === 'armageddoncontrol' ||
      effectiveRec.name.toLowerCase() === 'hurricaneswoosh'
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
    const canSlowRecord = rec === undefined || effectiveRec.canSlow
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
    const baseRange = effectiveRec.range !== undefined && effectiveRec.range > 0 ? effectiveRec.range : 35
    let calculatedRange = baseRange + slvlInt * (effectiveRec.levRange || 0)
    const loopsInt = params.loops !== undefined ? Math.trunc(params.loops) : 0
    if (effectiveRec.subLoop && loopsInt > 0) {
      calculatedRange += (effectiveRec.subStop - effectiveRec.subStart) * loopsInt
    }
    const maxRangeTicks = params.maxRangeTicks ?? (
      isTurret
        ? 250 // 1.13c Hydra duration: 250 frames (10 seconds)
        : calculatedRange
    )

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
      nextHit: effectiveRec.nextHit || (params.nextDelayFrames ?? 0) > 0,
      nextDelayFrames: params.nextDelayFrames ?? effectiveRec.nextDelay,
      // 1.13c `0x6FC8F660`: only the Missiles.txt `Pierce` flag enables the roll; the count is rolled once here from
      // the owner's `item_pierce + skill_pierce` (Issue #1420). `CollideKill = 0` is a separate, unrelated property.
      canPierce: effectiveRec.pierce,
      pierceIdx: resolveMissilePierceIdx(effectiveRec, params.owner, this.registry),
      pierceCount: 0,
      hitTargetIds: new Set<string>(),
      dmgPacket:
        params.canTriggerProcs !== undefined && params.dmgPacket && params.dmgPacket.canTriggerProcs === undefined
          ? { ...params.dmgPacket, canTriggerProcs: params.canTriggerProcs }
          : (params.dmgPacket ?? {
              skillId: params.sourceSkillId,
              attackKind: 'spell',
              elemType: 'none',
              autoHit: false,
              elemMin256: 0,
              elemMax256: 0,
            }),
      chainRemaining:
        params.chainRemaining ??
        params.chainCount ??
        (effectiveRec.pSrvHitFunc === 12
          ? params.sourceSkillId === 34 || effectiveRec.name === 'lightningstrike'
            ? params.slvl
            : 5 + Math.trunc(params.slvl / 5)
          : 0),
      lastHitTargetId: params.lastHitTargetId,
      expired: false,
      isTurret,
      ...(params.volleyId !== undefined ? { volleyId: params.volleyId } : {}),
      ...(params.canTriggerProcs !== undefined ? { canTriggerProcs: params.canTriggerProcs } : {}),
      ...(params.altitude !== undefined ? { altitude: params.altitude } : {}),
      ...(params.fireCadenceTicks !== undefined
        ? { fireCadenceTicks: params.fireCadenceTicks }
        : isTurret
          ? { fireCadenceTicks: 25 }
          : {}),
      ...(params.spawnMissileType !== undefined
        ? { spawnMissileType: params.spawnMissileType }
        : isTurret
          ? { spawnMissileType: 'hydra' }
          : {}),
      ...(params.seed !== undefined ? { seed: params.seed } : {}),
      ...(params.jitterIndex !== undefined
        ? { jitterIndex: params.jitterIndex }
        : params.seed !== undefined
          ? { jitterIndex: Math.abs(params.seed) % 32 }
          : {}),
      originX: params.startX,
      originY: params.startY,
      spiralTheta: angleRad,
      ...(slowedAtCreation ? { isSlowed: true } : {}),
      ...(params.slowMultiplier !== undefined ? { slowMultiplier: params.slowMultiplier } : {}),
      ...(params.linkedUnit !== undefined ? { linkedUnit: params.linkedUnit } : {}),
      ...(params.lockedTargetId !== undefined ? { lockedTargetId: params.lockedTargetId } : {}),
    }

    this.missiles.push(missile)
    return missile
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
      blvl: m.slvl,
      getBaseSkillLevel: (id) => m.owner.statList.getBaseSkillLevel(id),
    })
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
   * Server missile `pSrvDoFunc` dispatch for the 1.13c `D2Game` SrvDo table entries
   * 6 and 23..30 (D2MOO `MissMode.cpp` `MISSMODE_SrvDo06/23_24/25/26/27/28/29/30`).
   * Keys strictly on the Missiles.txt `pSrvDoFunc` column; the sub-missile is always the
   * row's own `SubMissile1` (never a substitute name). Returns `true` when the DoFunc
   * killed the missile (the 1.13c functions `return 2`).
   */
  private stepSrvDoFunc(
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
    if (fn !== 6 && (fn < 23 || fn > 30)) return false
    const remaining = m.maxRangeTicks - m.ageTicks
    const sub1 = rec.subMissile1

    const spawnSub = (opts: {
      owner: CombatUnitContext
      startX: number
      startY: number
      targetX: number
      targetY: number
      dmgPacket?: SUnitDmgPacket | undefined
    }): void => {
      this.spawnMissile({
        missileNameOrId: sub1,
        sourceSkillId: m.sourceSkillId,
        slvl: m.slvl,
        owner: opts.owner,
        startX: opts.startX,
        startY: opts.startY,
        targetX: opts.targetX,
        targetY: opts.targetY,
        dmgPacket: opts.dmgPacket ?? m.dmgPacket,
      })
      ctx.subMissilesSpawned.push(sub1)
    }

    switch (fn) {
      // D2Game.SrvDo06 (MoltenBoulder / FireWallMaker): SubMissile1 once per path step.
      case 6: {
        if (!sub1) {
          m.expired = true
          return true
        }
        if (this.consumeMissilePathStep(m)) {
          // `moltenboulder` (pSrvDmgFunc 14) carries physical boulder damage; its fire path only
          // inherits the elemental (fire) component.
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
      // D2Game.SrvDo23/24 (sucfireball / firestormmaker): SubMissile1 once per path step
      // (`nLoops = Param1` when > 0 only affects the child's animation loop count).
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
      // D2Game.0x6FC58E10 SrvDo25 (erruption center): every `calc2` remaining frames, SubMissile1 at a
      // random offset within `calc1 - 1` sub-tiles (MISSMODE_CreateMissileWithCollisionCheck, mask 0x45).
      case 25: {
        const skill = this.registry.getSkillById(m.sourceSkillId)
        if (!sub1 || !skill) {
          m.expired = true
          return true
        }
        const nRange = this.evalMissileSkillCalc(m, skill.calc1)
        const nFrames = this.evalMissileSkillCalc(m, skill.calc2)
        if (!nFrames || remaining % nFrames !== 0) return false
        const rng = (m.doFuncRng ??= new D2Rng(0, 666))
        rng.setSeed(Math.floor(m.x) + remaining, 666)
        const nMax = nRange - 1
        const offX = rng.rand(2 * nMax) - nMax
        const offY = rng.rand(2 * nMax) - nMax
        const sx = m.x + offX * MISSILE_SUBTILE_FLAT_PX
        const sy = m.y + offY * MISSILE_SUBTILE_FLAT_PX * ISO_GROUND_ASPECT_RATIO
        const terrain = ctx.collision ?? this.terrain
        if (terrain !== undefined) {
          const blocked =
            terrain.isMissileBlocked !== undefined
              ? terrain.isMissileBlocked(sx, sy, m.x, m.y)
              : terrain.overlap !== undefined && terrain.overlap(sx, sy) > 0
          if (blocked) return false
        }
        spawnSub({ owner: m.owner, startX: sx, startY: sy, targetX: sx, targetY: sy })
        return false
      }
      // D2Game.0x6FC58F30 SrvDo26 (vines / plague vines): SubMissile1 when remaining % max(Param1, 1) == 0.
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
      // D2Game.0x6FC59040 SrvDo27 (tornado): periodic area damage only — no sub-missile.
      // Cadence = Param1 > 0 ? Param1 : max(calc4, 1); radius = Param2 > 0 ? Param2 : max(aurarangecalc, 1) sub-tiles.
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
      // D2Game.0x6FC591C0 SrvDo28 (volcano): SubMissile1 lobbed to a random point within aura range
      // while Param3 < remaining < Param4 and remaining % nFrames == 0.
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
          // SEED_InitLowSeed(&pSeed, targetX); roll x/y; MISSILE_SetTargetX(lowSeed)
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
      // D2Game.0x6FC594B0 SrvDo29 (recycler delay): heals the owner by calc1 % max life exactly when
      // remaining == Param1. Creates no missile.
      case 29: {
        const skill = this.registry.getSkillById(m.sourceSkillId)
        if (!skill) {
          m.expired = true
          return true
        }
        const owner = m.owner
        if (remaining === rec.param1 && owner.statList.getHp256() > 0) {
          const hp = owner.statList.getHp256() >> 8
          const maxHp = owner.statList.getMaxHp256() >> 8
          if (hp < maxHp) {
            const pct = this.evalMissileSkillCalc(m, skill.calc1)
            const newHp = Math.min(Math.trunc((maxHp * pct) / 100) + hp, maxHp)
            owner.statList.setHp256(newHp << 8)
          }
        }
        return false
      }
      // D2Game.0x6FC598D0 SrvDo30 (rabiesplague): follows its owner (the infected unit) and every
      // max(Param1, 1) remaining frames releases SubMissile1 owned by the unit stored in targetX/targetY
      // (the casting druid, set by SKILLS_SrvDo121_Rabies) at a random ±Param2 sub-tile offset.
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
      default:
        return false
    }
  }

  /**
   * Check if a target unit is currently within its `NextDelay` immunity period.
   */
  isTargetInNextDelay(targetId: string, currentTick: number): boolean {
    const exp = this.nextDelayExpireByTarget.get(targetId)
    return exp !== undefined && exp > currentTick
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

      if (m.name === 'meteor' || m.name === 'meteortail') {
        if (m.altitude === undefined) m.altitude = 60 * 25
        m.altitude = Math.max(0, m.altitude - 25)
      }

      // `pSrvDoFunc = 15` (`frozenorb`): emits radial `frozenorbbolt` sub-missiles while flying
      // Authentic D2Game.0x6FC581F0 (MISSMODE_SrvDo15_FrozenOrb):
      // - 64-entry discrete circle lookup table (radius 30)
      // - Trigger frequency: dwParam[0] (1 frame)
      // - Angular step: dwParam[1] (19 directions per step, coprime with 64)
      // - Foreshortened by ISO_GROUND_ASPECT_RATIO = 0.5 in 2:1 isometric ground perspective
      if (m.record.pSrvDoFunc === 15) {
        const nFrames = Math.max(1, m.record.param1 || 1)
        if (m.ageTicks % nFrames === 0 || (m.maxRangeTicks - m.ageTicks) % nFrames <= 0) {
          const subName = m.record.subMissile1 || 'frozenorbbolt'
          const idx = Math.abs((m.subMissileIdx ?? 0) % 64)
          const offX = FROZEN_ORB_X_POSITIONS[idx]!
          const offY = FROZEN_ORB_Y_POSITIONS[idx]! * ISO_GROUND_ASPECT_RATIO
          this.spawnMissile({
            missileNameOrId: subName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x + offX * 10,
            targetY: m.y + offY * 10,
            dmgPacket: m.dmgPacket,
          })
          subMissilesSpawned.push(subName)
          const step = m.record.param2 || 19
          m.subMissileIdx = (idx + step) % 64
        }
      }

      // `pSrvDoFunc = 16` (`frozenorbnova`): authentic D2Game.0x6FC58340
      // In the final frames before expiry (dwParam[0] = 6), every dwParam[1] = 2 frames,
      // apply affine rotation & damping curl: x' = (x - y) / 2, y' = (x + y) / 2
      if (m.record.pSrvDoFunc === 16) {
        const remaining = m.maxRangeTicks - m.ageTicks
        const threshold = m.record.param1 || 6
        const nParam = Math.max(1, m.record.param2 || 2)
        if (remaining < threshold && remaining % nParam === 0) {
          const diff = m.vx - m.vy
          const sum = m.vx + m.vy
          m.vx = diff / 2
          m.vy = sum / 2
        }
      }

      // `pSrvDoFunc = 10` (`blizzardcenter`): emits falling shards across 64-entry circle table
      // Authentic D2Game.0x6FC60CA0 (MISSMODE_SrvDo10_blizzardcenter):
      // - Trigger frequency: dwParam[2] (4 frames, Param3 in Skills.txt)
      // - Angular step: 13 (coprime with 64)
      // - Radius: 7 subtiles
      // - Foreshortened by ISO_GROUND_ASPECT_RATIO = 0.5 in 2:1 isometric ground perspective
      if (m.record.pSrvDoFunc === 10 || m.name === 'blizzardcenter') {
        const cadence = Math.max(1, m.record.param3 || 4)
        if (m.ageTicks % cadence === 0) {
          const idx = Math.abs((m.subMissileIdx ?? 0) % 64)
          const offset = getBlizzardDropOffset(idx, 7)
          const shardVariants = ['blizzard1', 'blizzard2', 'blizzard3', 'blizzard4'] as const
          const shardName = shardVariants[Math.floor((m.ageTicks / cadence) - 1) % shardVariants.length]!
          this.spawnMissile({
            missileNameOrId: shardName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: m.x + offset.dx,
            startY: m.y + offset.dy,
            targetX: m.x + offset.dx,
            targetY: m.y + offset.dy,
            dmgPacket: m.dmgPacket,
          })
          subMissilesSpawned.push(shardName)
          m.subMissileIdx = (idx + 13) % 64
        }
      }

      // 1.13c D2Game SrvDo table entries 6 and 23..30 (see `stepSrvDoFunc`).
      if (this.stepSrvDoFunc(m, { currentTick, targets, targetPositions, collision, hits, subMissilesSpawned })) continue

      // Druid #249 Armageddon: `armageddoncontrol` is Missiles.txt pSrvDoFunc 1 / pSrvHitFunc 56 — it is NOT the
      // SrvDo30 (rabiesplague) path. Pre-existing name-keyed emitter: follows caster & drops rocks every 8 frames.
      if (m.name === 'armageddoncontrol') {
        if (m.owner.x !== undefined) m.x = m.owner.x
        if (m.owner.y !== undefined) m.y = m.owner.y
        const cadence = 8
        if (m.ageTicks === 1 || m.ageTicks % cadence === 0) {
          const idx = Math.abs((m.subMissileIdx ?? 0) % 64)
          const offX = (FROZEN_ORB_X_POSITIONS[idx]! * 160) / 30
          const offY = ((FROZEN_ORB_Y_POSITIONS[idx]! * 160) / 30) * ISO_GROUND_ASPECT_RATIO
          const subName = m.record.subMissile1 || 'armageddonrock'
          this.spawnMissile({
            missileNameOrId: subName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: m.x + offX,
            startY: m.y + offY,
            targetX: m.x + offX,
            targetY: m.y + offY,
            dmgPacket: m.dmgPacket,
          })
          subMissilesSpawned.push(subName)
          m.subMissileIdx = (idx + 23) % 64
        }
      }

      // Druid #250 Hurricane (`hurricaneswoosh` / `sourceSkillId === 250`): follows caster & pulses Cold damage + 50f chill every 20 frames within 9 subtiles (180px)
      if (m.name === 'hurricaneswoosh' && m.sourceSkillId === 250) {
        if (m.owner.x !== undefined) m.x = m.owner.x
        if (m.owner.y !== undefined) m.y = m.owner.y
        if (m.ageTicks === 1 || m.ageTicks % 20 === 0) {
          const radiusPx = 180 // 9 subtiles = 6.0 yards = 180px
          for (const target of targets) {
            if (target.statList.getHp256() <= 0) continue
            if (!areUnitsEnemies113c(m.owner, target)) continue
            const pos = targetPositions.get(target.id) ?? { x: m.x, y: m.y }
            if (Math.hypot(pos.x - m.x, (pos.y - m.y) / ISO_GROUND_ASPECT_RATIO) <= radiusPx) {
              const dmgOut = executeSUnitDmg(m.owner, target, m.dmgPacket, m.doFuncRng ?? this.rng)
              hits.push({
                missileName: 'hurricane',
                targetId: target.id,
                damage: dmgOut.totalDamage,
                immune: dmgOut.immuneToElem || dmgOut.immuneToPhys,
              })
              if (!dmgOut.immuneToElem && !target.statList.getAccruedStat('item_cannotbefrozen')) {
                const chillFrames = m.dmgPacket.elemDurationFrames ?? 50
                target.stateBus.applyState({
                  stateNameOrId: 'chill',
                  sourceSkillId: 250,
                  slvl: m.slvl,
                  durationFrames: chillFrames,
                })
              }
            }
          }
        }
      }

      // `pSrvDoFunc = 2` (`poisonjav` #38) & `pSrvDoFunc = 3` (`plaguejavelin` #43):
      // Authentic D2Game.0x6FC61B80 (MISSMODE_SrvDo02_PoisonJavelin) & 0x6FC61AE0 (MISSMODE_SrvDo03):
      // Spawns stationary poison cloud (`poisonjavcloud` #39 or `plaguejavcloud` #221) on each flight step
      if (
        m.record.pSrvDoFunc === 2 ||
        m.name === 'poisonjav' ||
        m.name === 'poisonjavelin' ||
        m.name === 'plaguejavelin' ||
        (m.record.pSrvDoFunc === 3 && Boolean(m.record.subMissile1))
      ) {
        const subName =
          m.record.subMissile1 ||
          (m.name === 'plaguejavelin' || m.sourceSkillId === 25 ? 'plaguejavcloud' : 'poisonjavcloud')
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
        this.spawnMissile({
          missileNameOrId: subName,
          sourceSkillId: m.sourceSkillId,
          slvl: m.slvl,
          owner: m.owner,
          startX: m.x,
          startY: m.y,
          targetX: m.x,
          targetY: m.y,
          dmgPacket: cloudPacket,
        })
        subMissilesSpawned.push(subName)
      }

      // Turret emitter (Hydra heads): stationary emitter periodically firing bolts at nearest target
      const isTurretEmitter = Boolean(m.isTurret || m.name.toLowerCase() === 'hydra_turret')
      if (isTurretEmitter) {
        const cadence = m.fireCadenceTicks ?? 25
        if (m.ageTicks % cadence === 0) {
          let closestTargetId: string | null = null
          let closestDist = Infinity
          const maxRangePx = 480 // 1.13c Range = 30, Vel = 16 -> 480 px

          for (const target of targets) {
            if (target.statList.getHp256() <= 0) continue
            const pos = targetPositions.get(target.id) ?? { x: 0, y: 120 }
            const dx = pos.x - m.x
            const dy = (pos.y - m.y) / ISO_GROUND_ASPECT_RATIO
            const dist = Math.hypot(dx, dy)
            if (dist <= maxRangePx && dist < closestDist) {
              closestDist = dist
              closestTargetId = target.id
            }
          }

          if (closestTargetId) {
            const targetPos = targetPositions.get(closestTargetId) ?? { x: 0, y: 120 }
            const subName = m.spawnMissileType || 'hydra'
            this.spawnMissile({
              missileNameOrId: subName,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: m.x,
              startY: m.y,
              targetX: targetPos.x,
              targetY: targetPos.y,
              dmgPacket: m.dmgPacket,
            })
            subMissilesSpawned.push(subName)
          }
        }
      }

      // 1.13c D2Common.dll PATH_StepVelocity (0x6FD5CEB0):
      // Step fixed-point velocity by Accel each frame; clamp to MaxVel<<8 when Accel > 0 or 0 when Accel < 0.
      if (!isTurretEmitter && m.accel !== 0) {
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

      // Spiral flight for Blessed Hammer (`blessedhammer`, `skillId = 112`)
      // Authentic Archimedean spiral: r = a * theta, foreshortened by 0.5 on y-axis in 2:1 isometric space
      if (isTurretEmitter) {
        // Stationary turret does not move
      } else if (m.sourceSkillId === 112 || m.name.toLowerCase() === 'blessedhammer') {
        const cx = m.originX ?? m.x
        const cy = m.originY ?? m.y
        m.spiralTheta = (m.spiralTheta ?? 0) + 0.16
        const theta = m.spiralTheta
        // Radial expansion speed: a = 12..14 px per radian
        const r = Math.max(12, 13 * theta)
        m.x = cx + r * Math.cos(theta)
        m.y = cy + r * Math.sin(theta) * ISO_GROUND_ASPECT_RATIO
        const foreshortenY = m.isoGroundForeshorten ? ISO_GROUND_ASPECT_RATIO : 1
        m.vx = Math.cos(theta) * m.speed
        m.vy = Math.sin(theta) * m.speed * foreshortenY
      } else {
        // Authentic 1.13c Homing mechanics (Bone Spirit / Guided Arrow, pSrvDoFunc = 7):
        // Continuously tracks and steers toward closest active hostile target in 2:1 isometric perspective
        if (
          (m.name.toLowerCase() === 'bonespirit' ||
            m.name.toLowerCase() === 'guidedarrow' ||
            m.sourceSkillId === 22 ||
            m.record.pSrvDoFunc === 7) &&
          !m.name.includes('explode')
        ) {
          let closestTarget: { x: number; y: number } | null = null
          let closestDist = Infinity
          const isBoneSpirit =
            m.name.toLowerCase() === 'bonespirit' ||
            m.name.toLowerCase() === 'monbonespirit' ||
            m.sourceSkillId === 93 ||
            m.sourceSkillId === 211
          const maxAcquireDistPx = isBoneSpirit ? 25 * 16 : Infinity
          if (
            (m.name.toLowerCase() === 'guidedarrow' || m.sourceSkillId === 22) &&
            m.ageTicks > 0 &&
            m.ageTicks % 5 === 0 &&
            m.hitTargetIds.size > 0
          ) {
            for (const hitId of Array.from(m.hitTargetIds)) {
              const hitUnit = targets.find((t) => t.id === hitId)
              const hitPos = hitUnit
                ? (targetPositions.get(hitUnit.id) ?? {
                    x: hitUnit.statList.getAccruedStat('x') || 0,
                    y: hitUnit.statList.getAccruedStat('y') || 0,
                  })
                : undefined
              if (
                !hitPos ||
                !checkMissileSizeFootprintOverlap113c(
                  Math.abs(hitPos.x - m.x) / MISSILE_SUBTILE_FLAT_PX,
                  Math.abs(hitPos.y - m.y) / MISSILE_SUBTILE_FLAT_PX,
                  m.record.size || 1,
                  hitUnit ? resolveUnitSubtileSize113c(hitUnit) : 2,
                )
              ) {
                m.hitTargetIds.delete(hitId)
              }
            }
          }
          if (m.lockedTargetId !== undefined && !m.hitTargetIds.has(m.lockedTargetId)) {
            const lockedUnit = targets.find((t) => t.id === m.lockedTargetId && t.statList.getHp256() > 0)
            if (lockedUnit && areUnitsEnemies113c(m.owner, lockedUnit)) {
              const pos = targetPositions.get(lockedUnit.id) ?? {
                x: lockedUnit.statList.getAccruedStat('x') || 0,
                y: lockedUnit.statList.getAccruedStat('y') || 0,
              }
              const dx = pos.x - m.x
              const dy = (pos.y - m.y) / ISO_GROUND_ASPECT_RATIO
              const dist = Math.hypot(dx, dy)
              if (dist <= maxAcquireDistPx) {
                closestTarget = pos
                closestDist = dist
              } else {
                m.lockedTargetId = undefined
              }
            } else {
              m.lockedTargetId = undefined
            }
          }
          if (!closestTarget) {
            let closestId: string | undefined
            for (const target of targets) {
              if (target.statList.getHp256() <= 0) continue
              if (m.hitTargetIds.has(target.id)) continue
              if (!areUnitsEnemies113c(m.owner, target)) continue
              const pos = targetPositions.get(target.id) ?? {
                x: target.statList.getAccruedStat('x') || 0,
                y: target.statList.getAccruedStat('y') || 0,
              }
              const dx = pos.x - m.x
              const dy = (pos.y - m.y) / ISO_GROUND_ASPECT_RATIO
              const dist = Math.hypot(dx, dy)
              if (dist <= maxAcquireDistPx && dist < closestDist) {
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
            const speed = m.speed > 0 ? m.speed : (m.record.vel ? (m.record.vel * 75) / 100 : 12)
            const targetAngle = Math.atan2((closestTarget.y - m.y) / ISO_GROUND_ASPECT_RATIO, closestTarget.x - m.x)
            // 1.13c MISSMODE_SrvDo07_GuidedArrow_BoneSpirit (0x6FC59DC0): re-paths directly to target without turn-rate cap.
            m.angleRad = targetAngle
            m.vx = Math.cos(m.angleRad) * speed
            m.vy = Math.sin(m.angleRad) * speed * ISO_GROUND_ASPECT_RATIO
          }
        }

        const prevX = m.x
        const prevY = m.y
        // Authentic 1.13c Charged Bolt (Skill 38 / missile 56 / pDoFunc 11):
        // Discrete orthogonal jitter table: 32-entry lookup table gatChargedBoltOffsets
        // applied perpendicularly to main propagation vector per step (2 subtiles/step) with individual low-seed PRNG.
        if (m.name === 'chargedbolt' || m.sourceSkillId === 38 || m.record.pSrvDoFunc === 11 || m.record.pCltDoFunc === 11) {
          let flatVx = m.vx
          let flatVy = m.vy / ISO_GROUND_ASPECT_RATIO
          const currentSpeed = Math.hypot(flatVx, flatVy)
          if (currentSpeed > 0) {
            const perpX = -flatVy / currentSpeed
            const perpY = flatVx / currentSpeed
            const idx = Math.abs((m.jitterIndex ?? m.ageTicks) % 32)
            const offset = GAT_CHARGED_BOLT_OFFSETS[idx]! * 3
            flatVx += perpX * offset
            flatVy += perpY * offset
            const newSpeed = Math.hypot(flatVx, flatVy)
            if (newSpeed > 0) {
              const scaleDown = currentSpeed / newSpeed
              flatVx *= scaleDown
              flatVy *= scaleDown
            }
            m.vx = flatVx
            m.vy = flatVy * ISO_GROUND_ASPECT_RATIO
            m.jitterIndex = (idx + 1) % 32
          }
        } else if (
          m.name === 'twister' ||
          m.name === 'tornado' ||
          m.name === 'firestormmaker'
        ) {
          // Twister / Tornado / Firestorm lateral serpentine jitter (name-keyed; NOT applied to
          // pSrvDoFunc 25 `erruption center` or 26 `vines` / `plague vines`, which SrvDo25/26 never steer).
          let flatVx = m.vx
          let flatVy = m.vy / ISO_GROUND_ASPECT_RATIO
          const currentSpeed = Math.hypot(flatVx, flatVy)
          if (currentSpeed > 0) {
            const perpX = -flatVy / currentSpeed
            const perpY = flatVx / currentSpeed
            const idx = Math.abs((m.jitterIndex ?? m.ageTicks) % 32)
            const offset =
              m.name === 'firestormmaker'
                ? Math.sin(m.ageTicks * 0.7) * 5
                : GAT_CHARGED_BOLT_OFFSETS[idx]! * 4
            flatVx += perpX * offset
            flatVy += perpY * offset
            const newSpeed = Math.hypot(flatVx, flatVy)
            if (newSpeed > 0) {
              const scaleDown = currentSpeed / newSpeed
              flatVx *= scaleDown
              flatVy *= scaleDown
            }
            m.vx = flatVx
            m.vy = flatVy * ISO_GROUND_ASPECT_RATIO
            m.jitterIndex = (idx + 1) % 32
          }
        }

        // 1.13c D2Game.dll 0x6FC8FA54: Slow Missiles was already applied once at creation in `spawnMissile`;
        // `MISSMODE_MoveMissile` (0x6FC5F320) / `PATH_Step` (0x6FD5E230) never re-reads owner's slowmissiles state in flight.
        m.x += m.vx
        m.y += m.vy

        // 1.13c D2Game.dll 0x6FD2D928 + D2Common.#10229 (PATH_StepMissile 0x6FD80F80 -> 0x6FD5D580):
        // Step by halved subtile increments and test terrain collision with the CollideType's terrainMask
        // (`0x00` for CollideType 0/4/7 -> no terrain collision; `0x04` for 1/2/3/5/6; `0x05` for 8).
        const collideEntry = getMissileCollideEntry113c(m.record.collideType)
        const terrainMask = collideEntry.terrainMask
        const effectiveTerrain = collision ?? this.terrain
        if (
          effectiveTerrain !== undefined &&
          terrainMask !== 0 &&
          !isTurretEmitter &&
          (m.altitude === undefined || m.altitude <= 0)
        ) {
          const raySteps = stepMissileSubtileRay113c(prevX, prevY, m.x, m.y, MISSILE_SUBTILE_FLAT_PX)
          let blocked = false
          let checkPrevX = prevX
          let checkPrevY = prevY
          let hitWallX = m.x
          let hitWallY = m.y
          for (let s = 1; s < raySteps.length; s++) {
            const pt = raySteps[s]!
            const curX = pt.x
            const curY = pt.y
            if (effectiveTerrain.isMissileBlocked !== undefined) {
              if (effectiveTerrain.isMissileBlocked(curX, curY, checkPrevX, checkPrevY, terrainMask)) {
                blocked = true
                hitWallX = curX
                hitWallY = curY
                break
              }
            } else if (effectiveTerrain.overlap !== undefined && effectiveTerrain.overlap(curX, curY) > 0) {
              blocked = true
              hitWallX = curX
              hitWallY = curY
              break
            }
            checkPrevX = curX
            checkPrevY = curY
          }
          if (blocked) {
            m.x = hitWallX
            m.y = hitWallY
            // Glacial Spike (pSrvHitFunc === 13) explodes at wall collision coordinates (64px AoE burst)
            if (m.record.pSrvHitFunc === 13 || m.name === 'glacialspike' || m.sourceSkillId === 55) {
              const splashRadius = 64
              for (const other of targets) {
                if (other.statList.getHp256() <= 0) continue
                if (!areUnitsEnemies113c(m.owner, other)) continue
                const oPos = targetPositions.get(other.id) ?? { x: 0, y: 120 }
                if (Math.hypot(oPos.x - hitWallX, oPos.y - hitWallY) <= splashRadius) {
                  const splashOut = executeSUnitDmg(m.owner, other, m.dmgPacket, m.doFuncRng ?? this.rng)
                  hits.push({
                    missileName: `${m.name}:splash`,
                    targetId: other.id,
                    damage: splashOut.totalDamage,
                    immune: splashOut.immuneToElem || splashOut.immuneToPhys,
                  })
                  if (!splashOut.immuneToElem && !other.statList.getAccruedStat('item_cannotbefrozen')) {
                    const frzFrames = m.dmgPacket.elemDurationFrames ?? calculateGlacialSpikeFreezeLength(m.slvl)
                    other.stateBus.applyState({
                      stateNameOrId: 'freeze',
                      sourceSkillId: 55,
                      slvl: m.slvl,
                      durationFrames: frzFrames,
                    })
                  }
                }
              }
              const gsRow = this.hitFuncRow(m, 'glacialspike')
              const expName = requireRowMissile(gsRow.cltHitSubMissile1, gsRow.name, 'CltHitSubMissile1')
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: hitWallX,
                startY: hitWallY,
                targetX: hitWallX,
                targetY: hitWallY,
                dmgPacket: m.dmgPacket,
              })
              this.spawnMissile({
                missileNameOrId: requireRowMissile(gsRow.cltHitSubMissile2, gsRow.name, 'CltHitSubMissile2'),
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: hitWallX,
                startY: hitWallY,
                targetX: hitWallX,
                targetY: hitWallY,
                dmgPacket: m.dmgPacket,
              })
              subMissilesSpawned.push(expName)
              subMissilesSpawned.push(gsRow.cltHitSubMissile2)
            } else if (m.name === 'iceblast' || m.sourceSkillId === 45) {
              const ibRow = this.hitFuncRow(m, 'iceblast')
              const expName = requireRowMissile(ibRow.explosionMissile, ibRow.name, 'ExplosionMissile')
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: hitWallX,
                startY: hitWallY,
                targetX: hitWallX,
                targetY: hitWallY,
                dmgPacket: m.dmgPacket,
              })
              subMissilesSpawned.push(expName)
            } else if (
              m.name === 'explodingarrow' ||
              m.sourceSkillId === 16 ||
              m.name === 'immolationarrow' ||
              m.sourceSkillId === 27 ||
              m.name === 'freezingarrow' ||
              m.sourceSkillId === 31
            ) {
              // 1.13c AlwaysExplode = 1: Exploding/Immolation/Freezing Arrow detonate on wall collision!
              this.triggerBowExplosionAoE({
                missile: m,
                impactX: hitWallX,
                impactY: hitWallY,
                targets,
                targetPositions,
                hits,
                subMissilesSpawned,
              })
            } else if (m.name === 'plaguejavelin' || m.record.pSrvHitFunc === 2) {
              // 1.13c AlwaysExplode = 1 / pSrvHitFunc = 2: Plague Javelin (#25) / Gas Potions (#47..#49) burst on wall collision!
              this.triggerPlagueJavelinBurst({
                missile: m,
                impactX: hitWallX,
                impactY: hitWallY,
                targets,
                targetPositions,
                hits,
                subMissilesSpawned,
              })
            } else if (m.record.pSrvHitFunc === 3) {
              // 1.13c pSrvHitFunc = 3 (Fire Potions #44..#46, CollideType = 6): detonate on terrain barrier impact!
              const expName = m.record.explosionMissile || m.record.hitSubMissile1 || 'fireexplode'
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: hitWallX,
                startY: hitWallY,
                targetX: hitWallX,
                targetY: hitWallY,
                dmgPacket: m.dmgPacket,
              })
              subMissilesSpawned.push(expName)
            } else if (m.name === 'lightningfury' || m.record.pSrvHitFunc === 20) {
              // 1.13c pSrvHitFunc = 20: Lightning Fury (#35) releases furylightning bolts on wall collision!
              this.triggerLightningFuryBolts({
                missile: m,
                impactX: hitWallX,
                impactY: hitWallY,
                targets,
                targetPositions,
                subMissilesSpawned,
              })
            } else if (
              m.name === 'moltenboulder' ||
              m.name === 'moltenboulderemerge' ||
              m.record.pSrvHitFunc === 42
            ) {
              // 1.13c Molten Boulder (#229, pSrvHitFunc = 42, AlwaysExplode = 1): radial fire + phys burst on wall collision!
              const splashRadius = 140
              for (const other of targets) {
                if (other.statList.getHp256() <= 0) continue
                if (!areUnitsEnemies113c(m.owner, other)) continue
                const oPos = targetPositions.get(other.id) ?? { x: 0, y: 120 }
                if (Math.hypot(oPos.x - hitWallX, oPos.y - hitWallY) <= splashRadius) {
                  const splashOut = executeSUnitDmg(m.owner, other, m.dmgPacket, m.doFuncRng ?? this.rng)
                  hits.push({
                    missileName: `${m.name}:explode`,
                    targetId: other.id,
                    damage: splashOut.totalDamage,
                    immune: splashOut.immuneToElem || splashOut.immuneToPhys,
                  })
                }
              }
              const expName = m.record.explosionMissile || 'moltenboulderexplode'
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: hitWallX,
                startY: hitWallY,
                targetX: hitWallX,
                targetY: hitWallY,
                dmgPacket: undefined,
              })
              subMissilesSpawned.push(expName)
            }
            m.expired = true
            continue
          }
        }
      }

      // 1.13c CollideType = 7 (0x6FC59510, mask 0x0040 COLLIDE_MISSILE):
      // Destroys overlapping missiles that have MissilesTxt.CanDestroy (+0x04 bit 0x08).
      if (m.record.collideType === 7) {
        const sweeperSize = Math.max(1, m.record.size || 1)
        for (const otherM of this.missiles) {
          if (otherM === m || otherM.expired || !otherM.record.canDestroy) continue
          if (
            checkMissileSegmentFootprintOverlap113c(
              tickStartX,
              tickStartY,
              m.x,
              m.y,
              otherM.x,
              otherM.y,
              sweeperSize,
              Math.max(1, otherM.record.size || 1),
              MISSILE_SUBTILE_FLAT_PX,
            )
          ) {
            otherM.expired = true
            if (m.record.collideKill) {
              m.expired = true
              break
            }
          }
        }
      }

      // Check collision against target units per 1.13c g_aMissileCollideTypes (0x6FD2D928),
      // SUNIT_IsEnemy + CollideFriend (0x6FC58FB0), and D2Common.#10389 Size footprint (0x6FDCF6A0)
      if (
        (m.name === 'meteorfire' && m.ageTicks % 5 === 0) ||
        (m.name === 'immolationfire' && m.ageTicks % 5 === 0) ||
        m.name === 'firewall' ||
        m.name === 'blaze' ||
        m.name === 'infernoflame1' ||
        m.name === 'infernoflame2'
      ) {
        m.hitTargetIds.clear()
      }
      for (const target of targets) {
        if (target.statList.getHp256() <= 0) continue
        if (m.hitTargetIds.has(target.id)) continue
        if (!canMissileCollideWithUnit113c(m, target)) {
          continue
        }

        // 1.13c MISSMODE_SrvHit07_HolyBolt (0x6FC5E220, pSrvHitFunc = 7):
        // - Reached on allies because Missiles.txt CollideFriend = 1 (#55 holybolt, #234 fistoftheheavensbolt).
        // - Calls 0x6FC58FB0(pMissile, pTarget):
        //   * If enemy (isEnemyTarget): tests MONSTERS_IsUndead (0x6FD60950). If not undead, returns 0 (passes through).
        //   * If friendly (!isEnemyTarget): tests MissilesTxt.nHoly & 1; heals friendly target and consumes bolt.
        const isHolyBoltMissile =
          m.record.pSrvHitFunc === 7 ||
          m.name.toLowerCase() === 'holybolt' ||
          m.name.toLowerCase() === 'fistoftheheavensbolt'
        const isEnemyTarget = areUnitsEnemies113c(m.owner, target)

        if (isHolyBoltMissile) {
          if (isEnemyTarget) {
            if (!target.isUndead) {
              continue
            }
          } else if (((m.record.holy || 1) & 1) === 0) {
            continue
          }
        }

        // Main Frozen Orb (pSrvDoFunc === 15), Blizzard Center (pSrvDoFunc === 10), Meteor Center (pSrvHitFunc === 14 / meteorcenter),
        // firewallmaker emitter (pSrvDoFunc === 6), Hydra turret emitters, and visual bow explosion sub-missiles do not deal direct contact damage.
        if (
          m.record.pSrvDoFunc === 15 ||
          m.record.pSrvDoFunc === 10 ||
          m.name === 'blizzardcenter' ||
          m.record.pSrvHitFunc === 14 ||
          m.name === 'meteorcenter' ||
          m.name === 'meteor' ||
          m.name === 'meteortail' ||
          m.name === 'firewallmaker' ||
          m.record.pSrvDoFunc === 6 ||
          m.name === 'firestormmaker' ||
          m.name === 'erruption center' ||
          m.name === 'volcano' ||
          m.name === 'armageddoncontrol' ||
          m.name === 'hurricaneswoosh' ||
          m.name === 'explodingarrowexp' ||
          m.name === 'freezingarrowexp1' ||
          m.name === 'freezingarrowexp2' ||
          m.name === 'freezingarrowexp' ||
          m.name === 'icearrowexplode' ||
          m.name === 'iceexplode' ||
          m.name === 'fireexplode' ||
          m.name === 'fireexplosion' ||
          m.name === 'moltenboulderexplode' ||
          isTurretEmitter
        ) {
          continue
        }

        const pos = targetPositions.get(target.id) ?? { x: 0, y: 120 }
        const isGroundPatch =
          m.name === 'meteorfire' ||
          m.name === 'immolationfire' ||
          m.name === 'firewall' ||
          m.name === 'blaze' ||
          m.name === 'poisonjavcloud' ||
          m.name === 'plaguejavcloud'
        const targetSize = resolveUnitSubtileSize113c(target)
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
        if (overlapsFootprint) {
          // Multiple Shot volley multi-hit immunity
          if (m.volleyId) {
            const vKey = `${m.volleyId}:${target.id}`
            if (this.volleyHits.has(vKey)) {
              continue
            }
            this.volleyHits.add(vKey)
          }

          // Enforce `NextDelay` immunity gate if `nextHit` / `nextDelayFrames > 0`
          if (m.nextDelayFrames > 0 && this.isTargetInNextDelay(target.id, currentTick)) {
            continue
          }

          m.hitTargetIds.add(target.id)
          if (m.nextDelayFrames > 0) {
            this.nextDelayExpireByTarget.set(target.id, currentTick + m.nextDelayFrames)
          }

          // Holy Bolt friendly heal (`#101 holybolt`: 1+2*(slvl-1) to 6+4*(slvl-1) + Prayer 15%/blvl;
          // `#234 fistoftheheavensbolt`: 1+2*(slvl-1) to 6+2*(slvl-1), no Prayer synergy)
          if (isHolyBoltMissile && !isEnemyTarget) {
            const isFohBolt = m.name.toLowerCase() === 'fistoftheheavensbolt'
            const prayerBlvl = isFohBolt ? 0 : m.owner.statList.getBaseSkillLevel(99)
            const rawHealMin = 1 + (m.slvl - 1) * 2
            const rawHealMax = isFohBolt ? 6 + (m.slvl - 1) * 2 : 6 + (m.slvl - 1) * 4
            const prayerBonus = prayerBlvl * 15
            const healAmount = Math.trunc(((rawHealMin + rawHealMax) / 2) * (100 + prayerBonus) / 100)
            const curHp = target.statList.getHp256()
            const maxHp = target.statList.getMaxHp256()
            target.statList.setHp256(Math.min(maxHp, curHp + healAmount * 256))
            hits.push({
              missileName: m.name,
              targetId: target.id,
              damage: 0,
              immune: false,
            })
            m.expired = true
            break
          }

          const isBowExplosionMissile =
            m.sourceSkillId === 16 ||
            m.sourceSkillId === 27 ||
            m.sourceSkillId === 31 ||
            m.name === 'explodingarrow' ||
            m.name === 'immolationarrow' ||
            m.name === 'freezingarrow'
          const basePacket: SUnitDmgPacket =
            m.canTriggerProcs !== undefined
              ? { ...m.dmgPacket, canTriggerProcs: m.canTriggerProcs }
              : isHolyBoltMissile
                ? { ...m.dmgPacket, bypassUndeadMagicRes: true }
                : m.dmgPacket
          // 1.13c HitFlags = 2: Exploding/Immolation/Freezing Arrow merge item flat fire/cold damage into explosion
          const packet: SUnitDmgPacket = isBowExplosionMissile
            ? this.mergeBowHitFlagsItemElem(m, basePacket)
            : isHolyBoltMissile && basePacket.bypassUndeadMagicRes !== true
              ? { ...basePacket, bypassUndeadMagicRes: true }
              : basePacket
          const dmgOut = executeSUnitDmg(m.owner, target, packet, m.doFuncRng ?? this.rng)
          hits.push({
            missileName: m.name,
            targetId: target.id,
            damage: dmgOut.totalDamage,
            immune: dmgOut.immuneToElem || dmgOut.immuneToPhys,
          })

          // Solid freeze on hit:
          // Ice Blast (pSrvDmgFunc = 4 or skillId 45): converts cold chill into solid freeze
          if (m.name === 'iceblast' || m.sourceSkillId === 45 || m.record.pSrvDmgFunc === 4) {
            if (!dmgOut.immuneToElem && !target.statList.getAccruedStat('item_cannotbefrozen')) {
              const frzFrames = m.dmgPacket.elemDurationFrames ?? calculateIceBlastFreezeLength(m.slvl)
              target.stateBus.applyState({
                stateNameOrId: 'freeze',
                sourceSkillId: 45,
                slvl: m.slvl,
                durationFrames: frzFrames,
              })
            }
          }
          // Glacial Spike (skillId 55 or pSrvHitFunc = 13): freezes primary target solid
          if (m.name === 'glacialspike' || m.sourceSkillId === 55 || m.record.pSrvHitFunc === 13) {
            if (!dmgOut.immuneToElem && !target.statList.getAccruedStat('item_cannotbefrozen')) {
              const frzFrames = m.dmgPacket.elemDurationFrames ?? calculateGlacialSpikeFreezeLength(m.slvl)
              target.stateBus.applyState({
                stateNameOrId: 'freeze',
                sourceSkillId: 55,
                slvl: m.slvl,
                durationFrames: frzFrames,
              })
            }
          }

          // Frost Nova (Skill 44 / missile frostnova) & Arctic Blast (Skill 230 / missile arcticblast1): applies chilling slow
          if (
            m.name === 'frostnova' ||
            m.sourceSkillId === 44 ||
            m.name === 'arcticblast1' ||
            m.name === 'arcticblast2' ||
            m.sourceSkillId === 230
          ) {
            if (!dmgOut.immuneToElem && !target.statList.getAccruedStat('item_cannotbefrozen')) {
              const chillFrames =
                m.dmgPacket.elemDurationFrames ??
                (m.sourceSkillId === 230 || m.name.startsWith('arcticblast')
                  ? 100 + (m.slvl - 1) * 15
                  : calculateFrostNovaChillLength(m.slvl))
              target.stateBus.applyState({
                stateNameOrId: 'chill',
                sourceSkillId: m.sourceSkillId || 44,
                slvl: m.slvl,
                durationFrames: chillFrames,
              })
            }
          }

          // Druid #240 Twister (`twister`): applies 10 frames (0.4s, Param2=10) stun on hit to non-bosses
          if (m.name === 'twister' || m.sourceSkillId === 240) {
            const isBoss = Boolean(
              target.isBoss || target.rank === 'boss' || target.statList.getAccruedStat('is_boss') > 0,
            )
            if (!isBoss) {
              target.stateBus.applyState({
                stateNameOrId: 'stun',
                sourceSkillId: 240,
                slvl: m.slvl,
                durationFrames: 10,
              })
            }
          }

          // Druid #243 Shock Wave (`shockwave`): MISSMODE_SrvDmg07_Warcry_ShockWave (0x6FC59600)
          // Applies min(250, 40 + (slvl - 1) * 15) frames stun on hit to non-bosses
          if (m.name === 'shockwave' || m.sourceSkillId === 243) {
            const isBoss = Boolean(
              target.isBoss || target.rank === 'boss' || target.statList.getAccruedStat('is_boss') > 0,
            )
            if (!isBoss) {
              target.stateBus.applyState({
                stateNameOrId: 'stun',
                sourceSkillId: 243,
                slvl: m.slvl,
                durationFrames: Math.min(250, 40 + (m.slvl - 1) * 15),
              })
            }
          }

          // Druid #229 Molten Boulder (`moltenboulder` / `moltenboulderemerge`):
          // - Knocks back and pierces Size 1/2 non-bosses
          // - Detonates radially (`moltenboulderexplode`) on Size 3 or Boss targets
          if (
            m.name === 'moltenboulder' ||
            m.name === 'moltenboulderemerge' ||
            m.sourceSkillId === 229
          ) {
            const isLargeOrBoss = Boolean(
              (target as { sizeX?: number }).sizeX === 3 ||
                target.isBoss ||
                target.rank === 'boss' ||
                target.statList.getAccruedStat('is_boss') > 0,
            )
            if (!isLargeOrBoss) {
              ;(target as { knockedBack?: boolean }).knockedBack = true
              m.pierceCount += 1
              continue
            } else {
              const expName = m.record.explosionMissile || 'moltenboulderexplode'
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: pos.x,
                startY: pos.y,
                targetX: pos.x,
                targetY: pos.y,
                dmgPacket: undefined,
              })
              subMissilesSpawned.push(expName)
              m.expired = true
              break
            }
          }

          // Cold Arrow (Skill 11 / missile coldarrow): applies chilling slow with Ice Arrow (+12%/blvl) length synergy
          if (m.name === 'coldarrow' || m.sourceSkillId === 11) {
            if (!dmgOut.immuneToElem && !target.statList.getAccruedStat('item_cannotbefrozen')) {
              const iceBlvl = m.owner.statList.getBaseSkillLevel(21)
              const chillFrames =
                m.dmgPacket.elemDurationFrames ??
                calculateColdArrowStats(m.slvl, { iceArrow: iceBlvl }).durationFrames
              target.stateBus.applyState({
                stateNameOrId: 'chill',
                sourceSkillId: 11,
                slvl: m.slvl,
                durationFrames: chillFrames,
              })
            }
          }

          // Ice Arrow (Skill 21 / missile icearrow): freezes primary target solid with Freezing Arrow (+5%/blvl) length synergy
          if (m.name === 'icearrow' || m.sourceSkillId === 21) {
            if (!dmgOut.immuneToElem && !target.statList.getAccruedStat('item_cannotbefrozen')) {
              const frzBlvl = m.owner.statList.getBaseSkillLevel(31)
              const frzFrames =
                m.dmgPacket.elemDurationFrames ??
                calculateIceArrowStats(m.slvl, { freezingArrow: frzBlvl }).freezeFrames
              target.stateBus.applyState({
                stateNameOrId: 'freeze',
                sourceSkillId: 21,
                slvl: m.slvl,
                durationFrames: frzFrames,
              })
            }
          }

          // Freezing Arrow (Skill 31 / missile freezingarrow): freezes primary target solid with Ice Arrow (+5%/blvl) length synergy
          if (m.name === 'freezingarrow' || m.sourceSkillId === 31) {
            if (!dmgOut.immuneToElem && !target.statList.getAccruedStat('item_cannotbefrozen')) {
              const iceBlvl = m.owner.statList.getBaseSkillLevel(21)
              const frzFrames =
                m.dmgPacket.elemDurationFrames ??
                calculateFreezingArrowStats(m.slvl, { iceArrow: iceBlvl }).freezeFrames
              target.stateBus.applyState({
                stateNameOrId: 'freeze',
                sourceSkillId: 31,
                slvl: m.slvl,
                durationFrames: frzFrames,
              })
            }
          }

          // 1.13c Amazon Bow explosion AoE + sub-missiles on every monster hit (including each pierced monster!)
          if (isBowExplosionMissile) {
            this.triggerBowExplosionAoE({
              missile: m,
              impactX: pos.x,
              impactY: pos.y,
              targets,
              targetPositions,
              hits,
              subMissilesSpawned,
              excludeTargetId: !dmgOut.hit ? undefined : target.id,
            })
          } else if (m.name === 'plaguejavelin' || m.record.pSrvHitFunc === 2) {
            this.triggerPlagueJavelinBurst({
              missile: m,
              impactX: pos.x,
              impactY: pos.y,
              targets,
              targetPositions,
              hits,
              subMissilesSpawned,
              excludeTargetId: !dmgOut.hit ? undefined : target.id,
            })
          } else if (m.name === 'icearrow' || m.sourceSkillId === 21) {
            const expName = m.record.explosionMissile || 'icearrowexplode'
            this.spawnMissile({
              missileNameOrId: expName,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: m.x,
              startY: m.y,
              targetX: m.x,
              targetY: m.y,
              dmgPacket: undefined,
            })
            subMissilesSpawned.push(expName)
          } else if (m.name === 'magicarrow' || m.sourceSkillId === 6) {
            const expName = m.record.explosionMissile || 'teethexplode'
            this.spawnMissile({
              missileNameOrId: expName,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: m.x,
              startY: m.y,
              targetX: m.x,
              targetY: m.y,
              dmgPacket: undefined,
            })
            subMissilesSpawned.push(expName)
          }

          // `pSrvHitFunc = 1` or `13`: radial splash damage (`Fire Ball`, `Glacial Spike`)
          if (
            !isBowExplosionMissile &&
            (m.record.pSrvHitFunc === 1 ||
              m.record.pSrvHitFunc === 13 ||
              m.name === 'glacialspike' ||
              m.sourceSkillId === 55)
          ) {
            const splashRadius =
              m.record.pSrvHitFunc === 13 || m.name === 'glacialspike' || m.sourceSkillId === 55 ? 64 : 85
            for (const other of targets) {
              if (other.id === target.id || other.statList.getHp256() <= 0) continue
              if (!areUnitsEnemies113c(m.owner, other)) continue
              const oPos = targetPositions.get(other.id) ?? { x: 0, y: 120 }
              if (Math.hypot(oPos.x - pos.x, oPos.y - pos.y) <= splashRadius) {
                const splashOut = executeSUnitDmg(m.owner, other, m.dmgPacket, m.doFuncRng ?? this.rng)
                hits.push({
                  missileName: `${m.name}:splash`,
                  targetId: other.id,
                  damage: splashOut.totalDamage,
                  immune: splashOut.immuneToElem || splashOut.immuneToPhys,
                })
                // Glacial Spike splash targets also receive solid freeze
                if (m.name === 'glacialspike' || m.sourceSkillId === 55 || m.record.pSrvHitFunc === 13) {
                  if (!splashOut.immuneToElem && !other.statList.getAccruedStat('item_cannotbefrozen')) {
                    const frzFrames = m.dmgPacket.elemDurationFrames ?? calculateGlacialSpikeFreezeLength(m.slvl)
                    other.stateBus.applyState({
                      stateNameOrId: 'freeze',
                      sourceSkillId: 55,
                      slvl: m.slvl,
                      durationFrames: frzFrames,
                    })
                  }
                }
              }
            }
          }

          // `pSrvHitFunc = 12` (`Chain Lightning` 53, `Lightning Strike` 34, `royalstrikechainlightning` 568):
          // Authentic 1.13c ping-pong chaining: excludes the target just hit (target.id),
          // searches up to 20 subtiles (10 yards = 400 px), and leaps to the closest valid alive enemy.
          if (m.record.pSrvHitFunc === 12 && m.chainRemaining > 0) {
            const searchRadiusPx = 400
            let nextTarget: CombatUnitContext | undefined
            let minDistance = Infinity
            for (const cand of targets) {
              if (cand.id === target.id || cand.statList.getHp256() <= 0) continue
              if (!areUnitsEnemies113c(m.owner, cand)) continue
              const candPos = targetPositions.get(cand.id) ?? { x: 0, y: 120 }
              const dist = Math.hypot(candPos.x - pos.x, candPos.y - pos.y)
              if (dist <= searchRadiusPx && dist < minDistance) {
                minDistance = dist
                nextTarget = cand
              }
            }
            if (nextTarget) {
              const nPos = targetPositions.get(nextTarget.id) ?? { x: 0, y: 120 }
              this.spawnMissile({
                missileNameOrId: m.name,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: pos.x,
                startY: pos.y,
                targetX: nPos.x,
                targetY: nPos.y,
                dmgPacket: m.dmgPacket,
                chainCount: m.chainRemaining - 1,
                lastHitTargetId: target.id,
              })
              subMissilesSpawned.push(m.name)
            }
          }

          // `pSrvHitFunc = 20` (`Lightning Fury` 35): release up to `1 + slvl` `furylightning` (#231) bolts
          // toward enemies within 15 subtiles (300 px) on each hit/pierce (`MISSMODE_SrvHit20` @ 0x6FC5DD60).
          if (m.record.pSrvHitFunc === 20 || m.name === 'lightningfury') {
            this.triggerLightningFuryBolts({
              missile: m,
              impactX: pos.x,
              impactY: pos.y,
              targets,
              targetPositions,
              subMissilesSpawned,
              excludeTargetId: target.id,
            })
          }

          // `pSrvHitFunc = 22` (`Fist of the Heavens` 121, `fistoftheheavensdelay` #233):
          // Release radial `fistoftheheavensbolt` (#234) toward enemies within 20 subtiles (400 px)
          // with 1.13c FoH Holy Bolt magic damage (40-50 base + 15%/blvl Holy Bolt #101 synergy).
          // Do NOT trigger on secondary `fistoftheheavensbolt` missiles!
          if (
            (m.record.pSrvHitFunc === 22 || m.name === 'fistoftheheavensdelay') &&
            (!m.currentHitFrame || m.currentHitFrame === 0)
          ) {
            m.currentHitFrame = 1
            const subBolt = m.record.hitSubMissile1 || 'fistoftheheavensbolt'
            const hbBlvl = m.owner.statList.getBaseSkillLevel(101)
            const fohBoltDmg = calculateFistOfTheHeavensHolyBoltDamage(m.slvl, hbBlvl)
            const fohBoltPacket: SUnitDmgPacket = {
              skillId: 121,
              slvl: m.slvl,
              attackKind: 'spell',
              srcDam: 0,
              elemType: 'mag',
              elemMin256: fohBoltDmg.holyBoltMin * FIXED_ONE,
              elemMax256: fohBoltDmg.holyBoltMax * FIXED_ONE,
              autoHit: true,
              bypassUndeadMagicRes: true,
            }
            const fohSearchRadiusPx = 400 // 20 subtiles = 400 px
            for (const other of targets) {
              if (other.id === target.id || other.statList.getHp256() <= 0) continue
              if (!areUnitsEnemies113c(m.owner, other)) continue
              const oPos = targetPositions.get(other.id) ?? { x: 0, y: 120 }
              if (Math.hypot(oPos.x - pos.x, oPos.y - pos.y) > fohSearchRadiusPx) continue
              this.spawnMissile({
                missileNameOrId: subBolt,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: pos.x,
                startY: pos.y,
                targetX: oPos.x,
                targetY: oPos.y,
                dmgPacket: fohBoltPacket,
              })
              subMissilesSpawned.push(subBolt)
            }
          }

          // 1.13c unit-collision outcome (`0x6FC5EDE0`, Issue #1420):
          // - `Pierce` row + owner has skill_pierce/item_pierce + `pierce_idx > 0` => `pierce_idx -= 1`, keep flying
          //   (`0x6FC58F40` returns 2);
          // - otherwise `CollideKill` decides: `CollideKill = 0` rows (lightningbolt, bonespear, blessedhammer,
          //   shockwave, ...) are never removed by a unit hit, `CollideKill = 1` rows end here.
          if (
            m.name === 'meteorfire' ||
            m.name === 'immolationfire' ||
            m.name === 'firewall' ||
            m.name === 'blaze' ||
            m.name === 'firestorm' ||
            m.name === 'moltenboulderfirepath' ||
            m.name === 'erruption crack 1' ||
            m.name === 'erruption crack 2' ||
            m.name === 'armageddonfire' ||
            m.name === 'infernoflame1' ||
            m.name === 'infernoflame2' ||
            m.name === 'arcticblast1' ||
            m.name === 'arcticblast2' ||
            m.name === 'poisonjavcloud' ||
            m.name === 'plaguejavcloud'
          ) {
            // Ground fire, poison clouds, and stream flames persist for their full duration and do not die on hit
          } else if (m.canPierce && m.pierceIdx > 0 && ownerCanConsumePierce(m.owner, this.registry)) {
            m.pierceIdx -= 1
            m.pierceCount += 1
          } else if (!m.record.collideKill) {
            m.pierceCount += 1
            if (m.name === 'bonespear') {
              const expName = m.record.explosionMissile || 'bonespearexplode'
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: m.x,
                startY: m.y,
                targetX: m.x,
                targetY: m.y,
                dmgPacket: m.dmgPacket,
              })
              subMissilesSpawned.push(expName)
            }
          } else {
            if (
              m.name.startsWith('blizzard') &&
              !m.name.includes('explode') &&
              m.name !== 'blizzardcenter'
            ) {
              const expName = m.record.explosionMissile || 'blizzardexplode1'
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: m.x,
                startY: m.y,
                targetX: m.x,
                targetY: m.y,
                dmgPacket: m.dmgPacket,
              })
              subMissilesSpawned.push(expName)
            } else if (m.name === 'iceblast' || m.sourceSkillId === 45) {
              const ibRow = this.hitFuncRow(m, 'iceblast')
              const expName = requireRowMissile(ibRow.explosionMissile, ibRow.name, 'ExplosionMissile')
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: m.x,
                startY: m.y,
                targetX: m.x,
                targetY: m.y,
                dmgPacket: m.dmgPacket,
              })
              subMissilesSpawned.push(expName)
            } else if (m.name === 'glacialspike' || m.sourceSkillId === 55 || m.record.pSrvHitFunc === 13) {
              const gsRow = this.hitFuncRow(m, 'glacialspike')
              const expName = requireRowMissile(gsRow.cltHitSubMissile1, gsRow.name, 'CltHitSubMissile1')
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: m.x,
                startY: m.y,
                targetX: m.x,
                targetY: m.y,
                dmgPacket: m.dmgPacket,
              })
              this.spawnMissile({
                missileNameOrId: requireRowMissile(gsRow.cltHitSubMissile2, gsRow.name, 'CltHitSubMissile2'),
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: m.x,
                startY: m.y,
                targetX: m.x,
                targetY: m.y,
                dmgPacket: m.dmgPacket,
              })
              subMissilesSpawned.push(expName)
              subMissilesSpawned.push(gsRow.cltHitSubMissile2)
            } else if (m.name === 'teeth') {
              const expName = m.record.explosionMissile || 'teethexplode'
              const isVisualOnly =
                expName === 'teethexplode' ||
                this.registry.getMissileByName(expName)?.collideType === 0
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: m.x,
                startY: m.y,
                targetX: m.x,
                targetY: m.y,
                dmgPacket: isVisualOnly ? undefined : (m.dmgPacket ? { ...m.dmgPacket } : undefined),
              })
              subMissilesSpawned.push(expName)
            } else if (m.name === 'bonespirit') {
              const expName = m.record.explosionMissile || 'bonespiritexplode'
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: m.x,
                startY: m.y,
                targetX: m.x,
                targetY: m.y,
                dmgPacket: m.dmgPacket,
              })
              subMissilesSpawned.push(expName)
            } else if (m.name === 'firearrow' || m.sourceSkillId === 7) {
              const expName = m.record.explosionMissile || 'fireexplode'
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: m.x,
                startY: m.y,
                targetX: m.x,
                targetY: m.y,
                dmgPacket: undefined,
              })
              subMissilesSpawned.push(expName)
            } else if (m.name === 'coldarrow' || m.sourceSkillId === 11) {
              const expName = m.record.explosionMissile || 'iceexplode'
              this.spawnMissile({
                missileNameOrId: expName,
                sourceSkillId: m.sourceSkillId,
                slvl: m.slvl,
                owner: m.owner,
                startX: m.x,
                startY: m.y,
                targetX: m.x,
                targetY: m.y,
                dmgPacket: undefined,
              })
              subMissilesSpawned.push(expName)
            }
            m.expired = true
            break
          }
        }
      }

      if (m.ageTicks >= m.maxRangeTicks) {
        // 1.13c AlwaysExplode = 1: Exploding/Immolation/Freezing Arrow & Plague Javelin detonate when reaching max range!
        if (
          !m.expired &&
          (m.name === 'explodingarrow' ||
            m.sourceSkillId === 16 ||
            m.name === 'immolationarrow' ||
            m.sourceSkillId === 27 ||
            m.name === 'freezingarrow' ||
            m.sourceSkillId === 31)
        ) {
          this.triggerBowExplosionAoE({
            missile: m,
            impactX: m.x,
            impactY: m.y,
            targets,
            targetPositions,
            hits,
            subMissilesSpawned,
          })
        } else if (!m.expired && (m.name === 'plaguejavelin' || m.record.pSrvHitFunc === 2)) {
          this.triggerPlagueJavelinBurst({
            missile: m,
            impactX: m.x,
            impactY: m.y,
            targets,
            targetPositions,
            hits,
            subMissilesSpawned,
          })
        } else if (!m.expired && m.record.pSrvHitFunc === 3) {
          // 1.13c pSrvHitFunc = 3 (Fire Potions #44..#46, CollideType = 6): detonate at landing / range expiry!
          const expName = m.record.explosionMissile || m.record.hitSubMissile1 || 'fireexplode'
          this.spawnMissile({
            missileNameOrId: expName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x,
            targetY: m.y,
            dmgPacket: m.dmgPacket,
          })
          subMissilesSpawned.push(expName)
        } else if (
          !m.expired &&
          (m.name === 'moltenboulder' ||
            m.name === 'moltenboulderemerge' ||
            m.record.pSrvHitFunc === 42)
        ) {
          // 1.13c Molten Boulder AlwaysExplode = 1 at max range
          const splashRadius = 140
          for (const other of targets) {
            if (other.statList.getHp256() <= 0) continue
            if (!areUnitsEnemies113c(m.owner, other)) continue
            const oPos = targetPositions.get(other.id) ?? { x: 0, y: 120 }
            if (Math.hypot(oPos.x - m.x, oPos.y - m.y) <= splashRadius) {
              const splashOut = executeSUnitDmg(m.owner, other, m.dmgPacket, m.doFuncRng ?? this.rng)
              hits.push({
                missileName: `${m.name}:explode`,
                targetId: other.id,
                damage: splashOut.totalDamage,
                immune: splashOut.immuneToElem || splashOut.immuneToPhys,
              })
            }
          }
          const expName = m.record.explosionMissile || 'moltenboulderexplode'
          this.spawnMissile({
            missileNameOrId: expName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x,
            targetY: m.y,
            dmgPacket: undefined,
          })
          subMissilesSpawned.push(expName)
        } else if (
          !m.expired &&
          (m.name === 'armageddonrock' || m.record.pSrvHitFunc === 44)
        ) {
          const expName = m.record.explosionMissile || 'armageddonexplosion'
          const fireName = m.record.hitSubMissile1 || 'armageddonfire'
          this.spawnMissile({
            missileNameOrId: expName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x,
            targetY: m.y,
            dmgPacket: undefined,
          })
          this.spawnMissile({
            missileNameOrId: fireName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x,
            targetY: m.y,
            dmgPacket: m.dmgPacket,
          })
          subMissilesSpawned.push(expName)
          subMissilesSpawned.push(fireName)
        } else if (
          (m.record.pSrvHitFunc === 22 || m.name === 'fistoftheheavensdelay') &&
          (!m.currentHitFrame || m.currentHitFrame === 0)
        ) {
          m.currentHitFrame = 1
          // `fistoftheheavensdelay` (#233, `CollideType = 0`, `Vel = 0`, `Range = 10`) is stationary at the primary target:
          // apply primary lightning strike on the enemy at (m.x, m.y) if not yet struck, then release radial Holy Bolts
          // toward all other enemies within 20 subtiles (400 px).
          let primaryTargetId: string | undefined
          if ((m.dmgPacket.elemMin256 ?? 0) > 0 || (m.dmgPacket.elemMax256 ?? 0) > 0) {
            let closestPrimary: CombatUnitContext | undefined
            let closestPrimaryDist = Infinity
            for (const cand of targets) {
              if (cand.statList.getHp256() <= 0) continue
              if (!areUnitsEnemies113c(m.owner, cand)) continue
              const cPos = targetPositions.get(cand.id) ?? { x: 0, y: 120 }
              const dist = Math.hypot(cPos.x - m.x, cPos.y - m.y)
              if (dist <= 40 && dist < closestPrimaryDist) {
                closestPrimaryDist = dist
                closestPrimary = cand
              }
            }
            if (closestPrimary && !m.hitTargetIds.has(closestPrimary.id)) {
              m.hitTargetIds.add(closestPrimary.id)
              primaryTargetId = closestPrimary.id
              const dmgOut = executeSUnitDmg(m.owner, closestPrimary, m.dmgPacket, m.doFuncRng ?? this.rng)
              hits.push({
                missileName: m.name,
                targetId: closestPrimary.id,
                damage: dmgOut.totalDamage,
                immune: dmgOut.immuneToElem || dmgOut.immuneToPhys,
              })
            }
          }
          const subBolt = m.record.hitSubMissile1 || 'fistoftheheavensbolt'
          const hbBlvl = m.owner.statList.getBaseSkillLevel(101)
          const fohBoltDmg = calculateFistOfTheHeavensHolyBoltDamage(m.slvl, hbBlvl)
          const fohBoltPacket: SUnitDmgPacket = {
            skillId: 121,
            slvl: m.slvl,
            attackKind: 'spell',
            srcDam: 0,
            elemType: 'mag',
            elemMin256: fohBoltDmg.holyBoltMin * FIXED_ONE,
            elemMax256: fohBoltDmg.holyBoltMax * FIXED_ONE,
            autoHit: true,
            bypassUndeadMagicRes: true,
          }
          const fohSearchRadiusPx = 400
          for (const other of targets) {
            if (other.id === primaryTargetId || other.statList.getHp256() <= 0) continue
            if (!areUnitsEnemies113c(m.owner, other)) continue
            const oPos = targetPositions.get(other.id) ?? { x: 0, y: 120 }
            if (Math.hypot(oPos.x - m.x, oPos.y - m.y) > fohSearchRadiusPx) continue
            this.spawnMissile({
              missileNameOrId: subBolt,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: m.x,
              startY: m.y,
              targetX: oPos.x,
              targetY: oPos.y,
              dmgPacket: fohBoltPacket,
            })
            subMissilesSpawned.push(subBolt)
          }
        }
        // `pSrvHitFunc = 14` (`Meteor` detonation and ground fire patch cascade)
        // Authentic D2Game 0x6FC5DEF0 (MISSMODE_SrvHit14_MeteorCenter) & 0x6FC5CEC0:
        if (
          (m.record.pSrvHitFunc === 14 || m.name === 'meteorcenter') &&
          (!m.currentHitFrame || m.currentHitFrame === 0)
        ) {
          m.currentHitFrame = 1
          // 1. Primary explosion AOE damage (Radius = 6 subtiles = 120px) in 2:1 isometric ground perspective
          const blastRadius = 120
          for (const target of targets) {
            if (target.statList.getHp256() <= 0) continue
            if (!areUnitsEnemies113c(m.owner, target)) continue
            const pos = targetPositions.get(target.id) ?? { x: 0, y: 120 }
            const inRange =
              Math.hypot(pos.x - m.x, (pos.y - m.y) / ISO_GROUND_ASPECT_RATIO) <= blastRadius
            if (inRange) {
              const dmgOut = executeSUnitDmg(m.owner, target, m.dmgPacket, m.doFuncRng ?? this.rng)
              hits.push({
                missileName: 'meteorexplode',
                targetId: target.id,
                damage: dmgOut.totalDamage,
                immune: dmgOut.immuneToElem || dmgOut.immuneToPhys,
              })
            }
          }

          // 2. Spawn explosion missile: meteorexplode (ID 103)
          const expName = m.record.explosionMissile || 'meteorexplode'
          this.spawnMissile({
            missileNameOrId: expName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x,
            targetY: m.y,
            dmgPacket: m.dmgPacket,
          })
          subMissilesSpawned.push(expName)

          // 3. Spawn 18 meteorfire submissiles using 18-offset table
          const subFireName = m.record.hitSubMissile1 || 'meteorfire'
          const fireDuration = 90 + (Math.max(1, m.slvl) - 1) * 15
          const fireDmg = calculateMeteorResidualFireDamage(m.slvl)
          const fireDmgPacket: SUnitDmgPacket = {
            skillId: m.sourceSkillId,
            attackKind: 'spell',
            elemType: 'fire',
            elemMin256: fireDmg.min * 8, // HitShift 3: << 3 = * 8
            elemMax256: fireDmg.max * 8,
          }
          const effectiveTerrain = collision ?? this.terrain
          for (const off of METEOR_FIRE_SUBTILE_OFFSETS) {
            const fx = m.x + off.x * 20
            const fy = m.y + off.y * 10
            if (effectiveTerrain !== undefined) {
              const blocked =
                effectiveTerrain.isMissileBlocked !== undefined
                  ? effectiveTerrain.isMissileBlocked(fx, fy, m.x, m.y)
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
            subMissilesSpawned.push(subFireName)
          }
        }
        // Blizzard falling shard ground impact explosion (Missiles 159..162)
        if (
          m.name.startsWith('blizzard') &&
          !m.name.includes('explode') &&
          m.name !== 'blizzardcenter' &&
          (!m.currentHitFrame || m.currentHitFrame === 0)
        ) {
          m.currentHitFrame = 1
          const expName = m.record.explosionMissile || 'blizzardexplode1'
          this.spawnMissile({
            missileNameOrId: expName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x,
            targetY: m.y,
            dmgPacket: m.dmgPacket,
          })
          subMissilesSpawned.push(expName)
        }

        // `pSrvHitFunc = 29` (`Frozen Orb` expiration burst)
        // Authentic D2Game.0x6FC5CE10 (MISSMODE_SrvHit29_FrozenOrb):
        // - Triggers only on first frame of hit (currentHitFrame === 0)
        // - Loop with step sHitPar1 = 4 over 64 directions -> exactly 16 frozenorbnova missiles!
        // - Foreshortened by ISO_GROUND_ASPECT_RATIO = 0.5 in 2:1 isometric ground perspective
        if (m.record.pSrvHitFunc === 29 && (!m.currentHitFrame || m.currentHitFrame === 0)) {
          m.currentHitFrame = 1
          const subName = m.record.hitSubMissile1 || 'frozenorbnova'
          const step = Math.max(1, m.record.sHitPar1 || 4)
          for (let i = 0; i < 64; i += step) {
            const offX = FROZEN_ORB_X_POSITIONS[i]!
            const offY = FROZEN_ORB_Y_POSITIONS[i]! * ISO_GROUND_ASPECT_RATIO
            this.spawnMissile({
              missileNameOrId: subName,
              sourceSkillId: m.sourceSkillId,
              slvl: m.slvl,
              owner: m.owner,
              startX: m.x,
              startY: m.y,
              targetX: m.x + offX * 10,
              targetY: m.y + offY * 10,
              dmgPacket: m.dmgPacket,
            })
            subMissilesSpawned.push(subName)
          }
          const explosionName = m.record.explosionMissile || 'frozenorbexplode'
          this.spawnMissile({
            missileNameOrId: explosionName,
            sourceSkillId: m.sourceSkillId,
            slvl: m.slvl,
            owner: m.owner,
            startX: m.x,
            startY: m.y,
            targetX: m.x,
            targetY: m.y,
            dmgPacket: m.dmgPacket,
          })
          subMissilesSpawned.push(explosionName)
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
    const { missile: m, impactX, impactY, targets, targetPositions, hits, subMissilesSpawned, excludeTargetId } = params
    const subCloud = m.record.hitSubMissile1 || m.record.subMissile1 || 'plaguejavcloud'
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

    const burstRadius = 120
    for (const other of targets) {
      if (other.id === excludeTargetId || other.statList.getHp256() <= 0) continue
      if (!areUnitsEnemies113c(m.owner, other)) continue
      const oPos = targetPositions.get(other.id) ?? { x: 0, y: 120 }
      if (Math.hypot(oPos.x - impactX, oPos.y - impactY) <= burstRadius) {
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
   * - Scans alive enemies within `15` subtiles (`300 px`) of `(impactX, impactY)` (excluding `excludeTargetId`).
   * - Releases up to `calc1 = 2 + (slvl - 1) = 1 + slvl` `furylightning` (#231) bolts (`ToHit = 0`, `SrcDamage = -1`, `NextDelay = 0`).
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
    const { missile: m, impactX, impactY, targets, targetPositions, subMissilesSpawned, excludeTargetId } = params
    const subBolt = m.record.hitSubMissile1 || 'furylightning'
    const maxBolts = 1 + Math.max(1, m.slvl)
    const searchRadiusPx = 15 * 20 // 15 subtiles = 300 px
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
      const oPos = targetPositions.get(other.id) ?? { x: 0, y: 120 }
      const dist = Math.hypot(oPos.x - impactX, oPos.y - impactY)
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
   * The Missiles.txt row whose hit columns drive a skill's impact burst: the missile's own row, or the skill's
   * source row when the burst is triggered by one of its sub-missiles (they carry the same source skill).
   */
  private hitFuncRow(m: ActiveMissile, sourceRow: string): MissileRecord {
    if (m.record.name.toLowerCase() === sourceRow || (sourceRow === 'glacialspike' && m.record.pSrvHitFunc === 13)) {
      return m.record
    }
    const row = this.registry.getMissileByName(sourceRow)
    if (row === undefined) throw new Error(`Missiles.txt row '${sourceRow}' missing`)
    return row
  }

  /**
   * 1.13c HitFlags = 2: Exploding Arrow (#16), Immolation Arrow (#27), and Freezing Arrow (#31)
   * merge item flat fire/cold damage (`firemindam`/`firemaxdam` or `coldmindam`/`coldmaxdam`) into the explosion.
   */
  private mergeBowHitFlagsItemElem(m: ActiveMissile, basePacket: SUnitDmgPacket): SUnitDmgPacket {
    const isFreezing = m.sourceSkillId === 31 || m.name === 'freezingarrow'
    const minStat = isFreezing ? 'coldmindam' : 'firemindam'
    const maxStat = isFreezing ? 'coldmaxdam' : 'firemaxdam'
    const itemMin = Math.max(0, m.owner.statList.getAccruedStat(minStat))
    const itemMax = Math.max(itemMin, m.owner.statList.getAccruedStat(maxStat))
    if (itemMin === 0 && itemMax === 0) {
      return basePacket
    }
    return {
      ...basePacket,
      elemType: isFreezing ? 'cold' : 'fire',
      elemMin256: (basePacket.elemMin256 ?? 0) + itemMin * 256,
      elemMax256: (basePacket.elemMax256 ?? 0) + itemMax * 256,
    }
  }

  /**
   * 1.13c Two-Stage Bow Explosion (`pSrvHitFunc = 4` / `9` / `AlwaysExplode = 1`):
   * - Stage 2 explosion deals ONLY elemental damage (`srcDam = 0`, `attackKind = 'spell'`, `autoHit = true`, `unblockable = true`)
   *   plus item flat fire/cold damage (`HitFlags = 2`), NEVER physical weapon damage.
   * - Splash radius = 4 subtiles = 80 px (`3.3 yards`).
   * - Spawns explosion sub-missiles (`explodingarrowexp`, `immolationfire`, `freezingarrowexp1`, `freezingarrowexp2`).
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
    const { missile: m, impactX, impactY, targets, targetPositions, hits, subMissilesSpawned, excludeTargetId } = params
    const isFreezing = m.sourceSkillId === 31 || m.name === 'freezingarrow'
    const isImmolation = m.sourceSkillId === 27 || m.name === 'immolationarrow'
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

    const splashRadius = 80
    for (const other of targets) {
      if (other.id === excludeTargetId || other.statList.getHp256() <= 0) continue
      if (!areUnitsEnemies113c(m.owner, other)) continue
      const oPos = targetPositions.get(other.id) ?? { x: 0, y: 120 }
      if (Math.hypot(oPos.x - impactX, oPos.y - impactY) <= splashRadius) {
        const splashOut = executeSUnitDmg(m.owner, other, explosionPacket, m.doFuncRng ?? this.rng)
        hits.push({
          missileName: `${m.name}:splash`,
          targetId: other.id,
          damage: splashOut.totalDamage,
          immune: splashOut.immuneToElem,
        })
        if (isFreezing) {
          if (!splashOut.immuneToElem && !other.statList.getAccruedStat('item_cannotbefrozen')) {
            const iceBlvl = m.owner.statList.getBaseSkillLevel(21)
            const frzFrames =
              m.dmgPacket.elemDurationFrames ??
              calculateFreezingArrowStats(m.slvl, { iceArrow: iceBlvl }).freezeFrames
            other.stateBus.applyState({
              stateNameOrId: 'freeze',
              sourceSkillId: 31,
              slvl: m.slvl,
              durationFrames: frzFrames,
            })
          }
        }
      }
    }

    if (m.name === 'explodingarrow' || m.sourceSkillId === 16) {
      const expName = m.record.explosionMissile || 'explodingarrowexp'
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
    } else if (isImmolation) {
      const expName = m.record.explosionMissile || 'explodingarrowexp'
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

      const patchName = m.record.hitSubMissile1 || 'immolationfire'
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
    } else if (isFreezing) {
      // Missiles.txt freezingarrow pCltHitFunc 14: CltHitSubMissile1 / CltHitSubMissile2 of the freezingarrow row (also
      // when the burst is triggered by one of its own sub-missiles).
      const freezeRow = this.registry.getMissileByName('freezingarrow')
      if (freezeRow === undefined) throw new Error("Missiles.txt row 'freezingarrow' missing")
      const expName = requireRowMissile(freezeRow.cltHitSubMissile1, freezeRow.name, 'CltHitSubMissile1')
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

      const subExp2 = requireRowMissile(freezeRow.cltHitSubMissile2, freezeRow.name, 'CltHitSubMissile2')
      this.spawnMissile({
        missileNameOrId: subExp2,
        sourceSkillId: m.sourceSkillId,
        slvl: m.slvl,
        owner: m.owner,
        startX: impactX,
        startY: impactY,
        targetX: impactX,
        targetY: impactY,
        dmgPacket: undefined,
      })
      subMissilesSpawned.push(subExp2)
    }
  }

  getActiveMissiles(): readonly ActiveMissile[] {
    return this.missiles
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
    const missileName = params.missileName ?? (skillId === 44 ? 'frostnova' : 'nova')
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
        const pos = params.targetPositions?.get(assignedTarget.id) ?? { x: tX, y: tY }
        tX = pos.x
        tY = pos.y
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
      const pos = params.targetPositions.get(target.id) ?? { x: 0, y: 0 }
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
 * Formula (dm12): Math.floor((110 * slvl * 450) / (100 * (slvl + 6))) + 50.
 * Level 1 -> 120 frames (4.80s), Level 10 -> 359 frames (14.36s), Level 20 -> 430 frames (17.20s).
 */
export function calculateBlazeDuration(slvl: number): number {
  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  return Math.floor((110 * lvl * 450) / (100 * (lvl + 6))) + 50
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
  const aiCurseDiv = difficulty === 'hell' ? 4 : difficulty === 'nightmare' ? 2 : 1
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
 * -100% physical resistance (`damageresist = -100`, `amplify_phys_pierce = 100`).
 */
export function calculateAmplifyDamageDebuff(): { damageresist: number; amplify_phys_pierce: number } {
  return { damageresist: -100, amplify_phys_pierce: 100 }
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
  amplify_phys_pierce: number
  item_slow: number
} {
  return {
    velocitypercent: -50,
    attackrate: -50,
    damagepercent: -50,
    damageresist: -50,
    amplify_phys_pierce: 50,
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
      debuffStats = { sight_radius: 1, stop_ranged: 1 }
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
      debuffStats = { ironmaiden_return_pct: calculateIronMaidenReturnPct(lvl, opts.vsPlayer) }
      break
    case 77:
      skillName = 'Terror'
      stateName = 'terror'
      curseType = 1
      debuffStats = { terror_flee_distance: calculateTerrorDistance(lvl) }
      break
    case 81:
      skillName = 'Confuse'
      stateName = 'confuse'
      curseType = 1
      debuffStats = { confuse_targeting: 1 }
      break
    case 82:
      skillName = 'Life Tap'
      stateName = 'lifetap'
      curseType = 1
      debuffStats = { lifetap_leech_pct: 50 }
      break
    case 86:
      skillName = 'Attract'
      stateName = 'attract'
      curseType = 2
      debuffStats = { attract_target: 1 }
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
        lowerresist_pierce: red,
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
  const lvl = Math.floor(slvl)
  const num = 110 * lvl * (75 - 20)
  const den = 100 * (lvl + 6)
  return Math.min(75, Math.trunc(num / den) + 20)
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


