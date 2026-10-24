/**
 * Skills: table-driven definitions, casting, and projectiles.
 *
 * Diablo II skills are rows in `Skills.txt`: a mana cost, a cooldown, a range,
 * and damage that scales with the skill's level in bands. This module reads that
 * shape and turns it into something castable, in three parts:
 *
 * - a **definition** read from a table row (never a constant in code, so a real
 *   `Skills.txt` changes the game without touching this file);
 * - a **cast** step that checks mana and cooldown and produces either an instant
 *   effect or a projectile;
 * - a **projectile** step that flies at the simulation rate, dies on walls,
 *   expires on its own timer, and reports what it hit.
 *
 * Damage progression is the one place where a simplification is visible in the
 * code: the real table scales damage through five level bands
 * (`MinLevDam1..5`), and this reads a single `PerLevel` slope instead. The band
 * columns are a mapping-layer problem — they carry no new mechanics, only a
 * different interpolation — so the formula is isolated in {@link skillDamageAt}
 * where the bands can replace it.
 */
import type { Rng } from '../../common/rng/d2-rng.ts'
import { getSharedDataRegistry } from '../../common/data/data-registry.ts'
import { MISSILE_PIERCE_ROLL_CAP, rollMissilePierceIdx } from '../engine/missile-pierce.ts'
import type { CharacterClassCode } from '../../common/units/classes.ts'
import type { CombatPlayer } from '../../common/units/unit-types.ts'
import { FACING_VECTORS, parseColorChannel, type Caster, type CastResult } from '../../common/skills/missiles-data.ts'
export { parseColorChannel }
import {
  FROZEN_ORB_X_POSITIONS,
  FROZEN_ORB_Y_POSITIONS,
  calculateFrostNovaDamage,
  calculateFrostNovaChillLength,
  calculateFrostNovaSynergyMultiplier,
  spawnFrostNovaRing,
  calculateNovaDamage,
  calculateStaticFieldDamage,
  calculateStaticFieldRadiusYards,
  calculateStaticFieldRadiusPx,
  hasLineOfSight,
  spawnNovaRing,
  executeStaticField,
  calculateLightningDamage,
  calculateLightningSynergyMultiplier,
  calculateChainLightningDamage,
  calculateChainLightningSynergyMultiplier,
  calculateChainLightningJumps,
  type StaticFieldResult,
  type StaticFieldTarget,
  GAT_CHARGED_BOLT_OFFSETS,
  calculateChargedBoltCount,
  calculateChargedBoltSynergyMultiplier,
  calculateChargedBoltDamage,
  calculateEnergyShieldManaRatio,
  calculateEnergyShieldDuration,
  calculateEnergyShieldAbsorbPct,
  calculateThunderStormDuration,
  calculateThunderStormInterval,
  calculateThunderStormDamage,
  calculateLightningMasteryBonusPct,
  calculateTelekinesisDamage,
  isTelekinesisItemAllowed,
  isTelekinesisObjectAllowed,
  calculateFrozenArmorDefense,
  calculateFrozenArmorDuration,
  calculateFrozenArmorFreezeLength,
  calculateShiverArmorDefense,
  calculateShiverArmorDuration,
  calculateShiverArmorDamage,
  calculateShiverArmorChillLength,
  calculateChillingArmorDefense,
  calculateChillingArmorDuration,
  calculateChillingArmorDamage,
  calculateChillingArmorChillLength,
  calculateColdArmorDuration,
  calculateIceBlastDamage,
  calculateIceBlastFreezeLength,
  calculateGlacialSpikeDamage,
  calculateGlacialSpikeFreezeLength,
  calculateColdMasteryPierce,
  calculateFireWallDamage,
  calculateBlazeDamage,
  calculateInfernoDamage,
  calculateBlazeDuration,
  calculateBlazePatchDuration,
  calculateInfernoRange,
  calculateInfernoRangePx,
  calculateInfernoContinuousMana256,
  calculateFireWallPatches,
  calculateEnchantDamage,
  calculateEnchantAttackRating,
  calculateEnchantDuration,
  calculateFireMasteryBonus,
  calculateEnchantAttackDamage,
  calculateTeethDamage,
  calculateTeethSynergyMultiplier,
  calculateTeethCount,
  calculateBoneArmorCapacity,
  calculateBoneArmorSynergyBonus,
  calculatePoisonDaggerDamage,
  calculatePoisonDaggerSynergyMultiplier,
  calculatePoisonDaggerAttackRatingBonus,
  calculateCorpseExplosionDamage,
  calculateCorpseExplosionRadiusYards,
  calculateCorpseExplosionRadiusPx,
  calculateBoneWallStats,
  calculatePoisonExplosionDamage,
  calculatePoisonExplosionSynergyMultiplier,
  calculateBoneSpearDamage,
  calculateBoneSpearSynergyMultiplier,
  calculateBonePrisonStats,
  calculatePoisonNovaDamage,
  calculatePoisonNovaSynergyMultiplier,
  calculateBoneSpiritDamage,
  calculateBoneSpiritSynergyMultiplier,
  spawnPoisonNovaRing,
  calculateCurseRadiusYards,
  calculateCurseRadiusPx,
  calculateCurseDurationFrames,
  calculateAmplifyDamageDebuff,
  calculateWeakenDebuff,
  calculateIronMaidenReturnPct,
  calculateTerrorDistance,
  calculateDecrepifyDebuff,
  calculateLowerResistReduction,
  computeImmunityBreak,
  calculateCurseEffect,
  calculateSkeletonMaxCount,
  calculateSkeletalMageMaxCount,
  calculateReviveMaxCount,
  calculateSkeletonMasteryStats,
  calculateGolemMasteryStats,
  calculateSummonResistPct,
  calculateClayGolemStats,
  calculateBloodGolemStats,
  calculateIronGolemStats,
  calculateFireGolemStats,
  calculateReviveStats,
  calculateRaiseSkeletonStats,
  calculateSkeletalMageStats,
  calculateNecromageMissileDamage,
  type SkeletonMasteryStats,
  type GolemMasteryStats,
  type GolemSynergies,
  type ClayGolemStats,
  type BloodGolemStats,
  type IronGolemItemProps,
  type IronGolemStats,
  type FireGolemStats,
  type ReviveStats,
  type RaiseSkeletonStats,
  type SkeletalMageStats,
  type NecromageMissileStats,
  type CurseOpts,
  type CurseSpec,
  type DamageRange,
  type PoisonDamageSpec,
  type SynergyState,
  getMissileCollideEntry113c,
  stepMissileSubtileRay113c,
} from '../engine/missile-engine.ts'
export {
  calculateFrostNovaDamage,
  calculateFrostNovaChillLength,
  calculateFrostNovaSynergyMultiplier,
  spawnFrostNovaRing,
  calculateNovaDamage,
  calculateStaticFieldDamage,
  calculateStaticFieldRadiusYards,
  calculateStaticFieldRadiusPx,
  hasLineOfSight,
  spawnNovaRing,
  executeStaticField,
  calculateLightningDamage,
  calculateLightningSynergyMultiplier,
  calculateChainLightningDamage,
  calculateChainLightningSynergyMultiplier,
  calculateChainLightningJumps,
  type StaticFieldResult,
  type StaticFieldTarget,
  GAT_CHARGED_BOLT_OFFSETS,
  calculateChargedBoltCount,
  calculateChargedBoltSynergyMultiplier,
  calculateChargedBoltDamage,
  calculateEnergyShieldManaRatio,
  calculateEnergyShieldDuration,
  calculateEnergyShieldAbsorbPct,
  calculateThunderStormDuration,
  calculateThunderStormInterval,
  calculateThunderStormDamage,
  calculateLightningMasteryBonusPct,
  calculateTelekinesisDamage,
  isTelekinesisItemAllowed,
  isTelekinesisObjectAllowed,
  calculateFrozenArmorDefense,
  calculateFrozenArmorDuration,
  calculateFrozenArmorFreezeLength,
  calculateShiverArmorDefense,
  calculateShiverArmorDuration,
  calculateShiverArmorDamage,
  calculateShiverArmorChillLength,
  calculateChillingArmorDefense,
  calculateChillingArmorDuration,
  calculateChillingArmorDamage,
  calculateChillingArmorChillLength,
  calculateColdArmorDuration,
  calculateIceBlastDamage,
  calculateIceBlastFreezeLength,
  calculateGlacialSpikeDamage,
  calculateGlacialSpikeFreezeLength,
  calculateColdMasteryPierce,
  calculateFireWallDamage,
  calculateBlazeDamage,
  calculateInfernoDamage,
  calculateBlazeDuration,
  calculateBlazePatchDuration,
  calculateInfernoRange,
  calculateInfernoRangePx,
  calculateInfernoContinuousMana256,
  calculateFireWallPatches,
  calculateEnchantDamage,
  calculateEnchantAttackRating,
  calculateEnchantDuration,
  calculateFireMasteryBonus,
  calculateEnchantAttackDamage,
  calculateTeethDamage,
  calculateTeethSynergyMultiplier,
  calculateTeethCount,
  calculateBoneArmorCapacity,
  calculateBoneArmorSynergyBonus,
  calculatePoisonDaggerDamage,
  calculatePoisonDaggerSynergyMultiplier,
  calculatePoisonDaggerAttackRatingBonus,
  calculateCorpseExplosionDamage,
  calculateCorpseExplosionRadiusYards,
  calculateCorpseExplosionRadiusPx,
  calculateBoneWallStats,
  calculatePoisonExplosionDamage,
  calculatePoisonExplosionSynergyMultiplier,
  calculateBoneSpearDamage,
  calculateBoneSpearSynergyMultiplier,
  calculateBonePrisonStats,
  calculatePoisonNovaDamage,
  calculatePoisonNovaSynergyMultiplier,
  calculateBoneSpiritDamage,
  calculateBoneSpiritSynergyMultiplier,
  spawnPoisonNovaRing,
  calculateCurseRadiusYards,
  calculateCurseRadiusPx,
  calculateCurseDurationFrames,
  calculateAmplifyDamageDebuff,
  calculateWeakenDebuff,
  calculateIronMaidenReturnPct,
  calculateTerrorDistance,
  calculateDecrepifyDebuff,
  calculateLowerResistReduction,
  computeImmunityBreak,
  calculateCurseEffect,
  calculateSkeletonMaxCount,
  calculateSkeletalMageMaxCount,
  calculateReviveMaxCount,
  calculateSkeletonMasteryStats,
  calculateGolemMasteryStats,
  calculateSummonResistPct,
  calculateClayGolemStats,
  calculateBloodGolemStats,
  calculateIronGolemStats,
  calculateFireGolemStats,
  calculateReviveStats,
  calculateRaiseSkeletonStats,
  calculateSkeletalMageStats,
  calculateNecromageMissileDamage,
  type SkeletonMasteryStats,
  type GolemMasteryStats,
  type GolemSynergies,
  type ClayGolemStats,
  type BloodGolemStats,
  type IronGolemItemProps,
  type IronGolemStats,
  type FireGolemStats,
  type ReviveStats,
  type RaiseSkeletonStats,
  type SkeletalMageStats,
  type NecromageMissileStats,
  type CurseOpts,
  type CurseSpec,
  type DamageRange,
  type PoisonDamageSpec,
  type SynergyState,
  getMissileCollideEntry113c,
  stepMissileSubtileRay113c,
} from '../engine/missile-engine.ts'
import {
  BLIZZARD_CIRCLE_X,
  BLIZZARD_CIRCLE_Y,
  getBlizzardDropOffset,
} from '../../common/data/blizzard-table.ts'
export { BLIZZARD_CIRCLE_X, BLIZZARD_CIRCLE_Y, getBlizzardDropOffset } from '../../common/data/blizzard-table.ts'
import {
  METEOR_FIRE_SUBTILE_OFFSETS,
  type MeteorFireSubtileOffset,
} from '../../common/data/meteor-table.ts'
export {
  METEOR_FIRE_SUBTILE_OFFSETS,
  type MeteorFireSubtileOffset,
} from '../../common/data/meteor-table.ts'
import {
  calculateMagicArrowStats,
  calculateFireArrowStats,
  calculateColdArrowStats,
  calculateMultipleShotStats,
  calculateExplodingArrowStats,
  calculateIceArrowStats,
  calculateGuidedArrowStats,
  calculateStrafeStats,
  calculateImmolationArrowStats,
  calculateFreezingArrowStats,
  generateMultipleShotAngles,
  isMultipleShotCenterArrow,
  type MagicArrowStats,
  type FireArrowStats,
  type ColdArrowStats,
  type MultipleShotStats,
  type ExplodingArrowStats,
  type IceArrowStats,
  type GuidedArrowStats,
  type StrafeStats,
  type ImmolationArrowStats,
  type FreezingArrowStats,
} from '../../common/skills/amazon-bow.ts'
export {
  calculateMagicArrowStats,
  calculateFireArrowStats,
  calculateColdArrowStats,
  calculateMultipleShotStats,
  calculateExplodingArrowStats,
  calculateIceArrowStats,
  calculateGuidedArrowStats,
  calculateStrafeStats,
  calculateImmolationArrowStats,
  calculateFreezingArrowStats,
  generateMultipleShotAngles,
  isMultipleShotCenterArrow,
  type MagicArrowStats,
  type FireArrowStats,
  type ColdArrowStats,
  type MultipleShotStats,
  type ExplodingArrowStats,
  type IceArrowStats,
  type GuidedArrowStats,
  type StrafeStats,
  type ImmolationArrowStats,
  type FreezingArrowStats,
} from '../../common/skills/amazon-bow.ts'
import {
  calculateInnerSightStats,
  calculateCriticalStrikeStats,
  calculateDodgeStats,
  calculateSlowMissilesStats,
  calculateAvoidStats,
  calculatePenetrateStats,
  calculateDecoyStats,
  calculateEvadeStats,
  calculateValkyrieStats,
  calculatePierceStats,
  type InnerSightStats,
  type CriticalStrikeStats,
  type DodgeStats,
  type SlowMissilesStats,
  type AvoidStats,
  type PenetrateStats,
  type DecoyStats,
  type EvadeStats,
  type ValkyrieStats,
  type ValkyrieEquipmentTier,
  type PierceStats,
} from '../../common/skills/amazon-passive.ts'
export {
  calculateInnerSightStats,
  calculateCriticalStrikeStats,
  calculateDodgeStats,
  calculateSlowMissilesStats,
  calculateAvoidStats,
  calculatePenetrateStats,
  calculateDecoyStats,
  calculateEvadeStats,
  calculateValkyrieStats,
  calculatePierceStats,
  type InnerSightStats,
  type CriticalStrikeStats,
  type DodgeStats,
  type SlowMissilesStats,
  type AvoidStats,
  type PenetrateStats,
  type DecoyStats,
  type EvadeStats,
  type ValkyrieStats,
  type ValkyrieEquipmentTier,
} from '../../common/skills/amazon-passive.ts'
import {
  calculateJabStats,
  calculatePowerStrikeStats,
  calculatePoisonJavelinStats,
  calculateImpaleStats,
  calculateLightningBoltStats,
  calculateChargedStrikeStats,
  calculatePlagueJavelinStats,
  calculateFendStats,
  calculateLightningStrikeStats,
  calculateLightningFuryStats,
  type JabStats,
  type PowerStrikeStats,
  type PoisonJavelinStats,
  type ImpaleStats,
  type LightningBoltStats,
  type ChargedStrikeStats,
  type PlagueJavelinStats,
  type FendStats,
  type LightningStrikeStats,
  type LightningFuryStats,
  type PowerStrikeSynergies,
  type PoisonJavelinSynergies,
  type LightningBoltSynergies,
  type ChargedStrikeSynergies,
  type PlagueJavelinSynergies,
  type LightningStrikeSynergies,
  type LightningFurySynergies,
} from '../../common/skills/amazon-javelin-spear.ts'
export {
  calculateJabStats,
  calculatePowerStrikeStats,
  calculatePoisonJavelinStats,
  calculateImpaleStats,
  calculateLightningBoltStats,
  calculateChargedStrikeStats,
  calculatePlagueJavelinStats,
  calculateFendStats,
  calculateLightningStrikeStats,
  calculateLightningFuryStats,
  type JabStats,
  type PowerStrikeStats,
  type PoisonJavelinStats,
  type ImpaleStats,
  type LightningBoltStats,
  type ChargedStrikeStats,
  type PlagueJavelinStats,
  type FendStats,
  type LightningStrikeStats,
  type LightningFuryStats,
  type PowerStrikeSynergies,
  type PoisonJavelinSynergies,
  type LightningBoltSynergies,
  type ChargedStrikeSynergies,
  type PlagueJavelinSynergies,
  type LightningStrikeSynergies,
  type LightningFurySynergies,
} from '../../common/skills/amazon-javelin-spear.ts'
export {
  calculateRavenStats,
  calculatePoisonCreeperStats,
  calculateOakSageStats,
  calculateSummonSpiritWolfStats,
  calculateSpiritWolfStats,
  calculateCarrionVineStats,
  calculateHeartOfWolverineStats,
  calculateSummonDireWolfStats,
  calculateDireWolfStats,
  calculateSolarCreeperStats,
  calculateSpiritOfBarbsStats,
  calculateSummonGrizzlyStats,
  calculateGrizzlyStats,
  calculateSpiritWolfTeleportStats,
  calculateVineAttackStats,
  calculateCorpseCyclerStats,
  calculateFenrisRageStats,
  calculateVineCyclerStats,
  calculateBearSmiteStats,
  resolveDruidTotemResistances,
  type DruidTotemResistances,
  type RavenStats,
  type PoisonCreeperStats,
  type OakSageStats,
  type SummonSpiritWolfStats,
  type CarrionVineStats,
  type HeartOfWolverineStats,
  type SummonDireWolfStats,
  type SolarCreeperStats,
  type SpiritOfBarbsStats,
  type SummonGrizzlyStats,
  type SpiritWolfTeleportStats,
  type VineAttackStats,
  type CorpseCyclerStats,
  type FenrisRageStats,
  type VineCyclerStats,
  type BearSmiteStats,
} from './druid-summoning.ts'


import {
  type SkillDef,
  type Projectile,
  type MissileTxtData,
  CANONICAL_113C_MISSILES,
  ISO_GROUND_ASPECT_RATIO,
  parseMissilesTxt,
  getMissileTxtData,
  type OverlayTxtData,
  CANONICAL_113C_OVERLAYS,
  parseOverlayTxt,
  getOverlayTxtData,
  type ActiveOverlay,
  type CreateActiveOverlayOptions,
  resetOverlaySeqCounter,
  createActiveOverlay,
  PALADIN_AURA_OVERLAYS,
  PALADIN_AURA_OVERLAY_PARTS,
  PALADIN_AURA_SKILL_IDS,
  isAuraSkill,
  getAuraOverlayName,
  getAuraOverlayNames,
  SORCERESS_SKILL_CAST_OVERLAYS,
  getSkillCastOverlay,
  type SkillExecutionContext,
  type SkillType,
  type Batch1SkillDef,
  BATCH1_SKILLS,
  getBatch1SkillDef,
  isBatch1Skill,
  getSkillManaCost,
  getSkillCooldownTicks,
} from '../../common/skills/missiles-data.ts'
export {
  type SkillDef,
  type Projectile,
  type MissileTxtData,
  CANONICAL_113C_MISSILES,
  ISO_GROUND_ASPECT_RATIO,
  parseMissilesTxt,
  getMissileTxtData,
  type OverlayTxtData,
  CANONICAL_113C_OVERLAYS,
  parseOverlayTxt,
  getOverlayTxtData,
  type ActiveOverlay,
  type CreateActiveOverlayOptions,
  resetOverlaySeqCounter,
  createActiveOverlay,
  PALADIN_AURA_OVERLAYS,
  PALADIN_AURA_OVERLAY_PARTS,
  PALADIN_AURA_SKILL_IDS,
  isAuraSkill,
  getAuraOverlayName,
  getAuraOverlayNames,
  SORCERESS_SKILL_CAST_OVERLAYS,
  getSkillCastOverlay,
  type SkillExecutionContext,
  type SkillType,
  type Batch1SkillDef,
  BATCH1_SKILLS,
  getBatch1SkillDef,
  isBatch1Skill,
  getSkillManaCost,
  getSkillCooldownTicks,
} from '../../common/skills/missiles-data.ts'

/**
 * Damage of a skill at a level.
 *
 * @param skill - the definition.
 * @param level - skill level, 1-based.
 * @param rng - random source for the roll inside the damage range.
 * @returns the damage.
 */
function skillDamageAt(skill: SkillDef, level: number, rng: Rng): number {
  const steps = Math.max(0, level - 1)
  const min = skill.baseMinDamage + skill.damagePerLevel * steps
  const max = skill.baseMaxDamage + skill.damagePerLevel * steps
  return rng.int(Math.round(min), Math.round(Math.max(min, max)))
}

/**
 * Cast a skill.
 *
 * Mana and cooldown are checked here rather than by the caller so that every
 * route to casting (a hotkey, an AI, a script) obeys the same rules.
 *
 * @param skill - the definition.
 * @param caster - position and facing.
 * @param level - skill level.
 * @param rng - random source.
 * @param cooldownLeft - ticks of cooldown still owed.
 * @param mana - mana available.
 * @param aim - optional aim point; defaults to straight ahead of the facing.
 * @returns what the cast produced.
 */
export function castSkillDef(
  skill: SkillDef,
  caster: Caster,
  level: number,
  rng: Rng,
  cooldownLeft: number,
  mana: number,
  aim?: { readonly x: number; readonly y: number },
): CastResult {
  if (cooldownLeft > 0) return { kind: 'cooldown', ticksLeft: cooldownLeft }
  if (mana < skill.manaCost) return { kind: 'mana', cost: skill.manaCost }
  const damage = skillDamageAt(skill, level, rng)
  if (!skill.projectile) return { kind: 'instant', radius: skill.radius, damage }

  let dx: number
  let dy: number
  if (aim !== undefined) {
    dx = aim.x - caster.x
    dy = aim.y - caster.y
  } else {
    const vector = FACING_VECTORS[caster.facing] ?? FACING_VECTORS[0]!
    dx = vector[0]
    dy = vector[1]
  }
  const length = Math.hypot(dx, dy)
  if (length === 0) return { kind: 'instant', radius: skill.radius, damage }
  const perTick = skill.speed / 25
  const ttl = Math.max(1, Math.round(skill.range / perTick))
  return {
    kind: 'projectile',
    projectile: {
      skillId: skill.id,
      x: caster.x,
      y: caster.y,
      vx: (dx / length) * perTick,
      vy: (dy / length) * perTick,
      damage,
      ttl,
      fromPlayer: true,
      missileType: skill.id === '36' || skill.id === 'firebolt' ? 'firebolt' : undefined,
    },
  }
}

export function castSkill(
  skillId: number | string,
  targetX: number,
  targetY: number,
  context: SkillCastContext,
): boolean
export function castSkill(
  skill: SkillDef,
  caster: Caster,
  level: number,
  rng: Rng,
  cooldownLeft: number,
  mana: number,
  aim?: { readonly x: number; readonly y: number },
): CastResult
export function castSkill(
  skillOrId: number | string | SkillDef,
  arg2: number | Caster,
  arg3: number,
  arg4: SkillCastContext | Rng,
  cooldownLeft?: number,
  mana?: number,
  aim?: { readonly x: number; readonly y: number },
): boolean | CastResult {
  if (typeof skillOrId === 'object' && skillOrId !== null) {
    return castSkillDef(
      skillOrId,
      arg2 as Caster,
      arg3,
      arg4 as Rng,
      cooldownLeft ?? 0,
      mana ?? 0,
      aim,
    )
  }
  return castSceneSkill113c(
    typeof skillOrId === 'string' ? Number(skillOrId) : skillOrId,
    arg2 as number,
    arg3,
    arg4 as SkillCastContext,
  )
}


/** A body a projectile can hit. */
export interface ProjectileTarget {
  /** Stable identity, echoed back on a hit. */
  readonly index: number
  /** World x. */
  readonly x: number
  /** World y. */
  readonly y: number
  /** Radius for hit testing. */
  readonly radius: number
  /** Whether the target is alive; dead targets are not hit. */
  readonly alive: boolean
}

/** What happened to projectiles during a tick. */
export interface ProjectileOutcome {
  /** Projectiles still in flight. */
  readonly alive: readonly Projectile[]
  /** Hits, one per projectile that struck. */
  readonly hits: readonly {
    readonly targetIndex: number
    readonly damage: number
    readonly x: number
    readonly y: number
    readonly skillId?: string | undefined
    readonly missileType?: string | undefined
    readonly aoeRadius?: number | undefined
    readonly aoeDamage?: number | undefined
    readonly statusEffect?: 'chill' | 'freeze' | 'poison' | undefined
    readonly statusDuration?: number | undefined
    readonly stunDuration?: number | undefined
    readonly knockback?: boolean | undefined
    readonly isUndeadOnly?: boolean | undefined
  }[]
  /** Projectiles that died on a wall or expired. */
  readonly expired: number
  /** Projectiles that stopped against terrain. */
  readonly wallHits: number
  /** Terrain wall collision events for visual impacts/explosions. */
  readonly wallHitEvents?: readonly {
    readonly x: number
    readonly y: number
    readonly skillId?: string | undefined
    readonly missileType?: string | undefined
    readonly aoeRadius?: number | undefined
    readonly damage?: number | undefined
    readonly statusEffect?: 'chill' | 'freeze' | 'poison' | undefined
    readonly statusDuration?: number | undefined
  }[] | undefined
  /** Newly spawned child projectiles during this tick (e.g. Frozen Orb bolts / nova). */
  readonly spawnedProjectiles?: readonly Projectile[] | undefined
}

function getBlizzardExplosionMissile(missileType: string): string {
  switch (missileType) {
    case 'blizzard1':
      return 'blizzardexplode1'
    case 'blizzard2':
      return 'blizzardexplode2'
    case 'blizzard3':
      return 'blizzardexplode3'
    case 'blizzard4':
      return 'blizzardexplode1'
    default:
      return 'blizzardexplode1'
  }
}

function isBlizzardShard(missileType?: string): boolean {
  return (
    missileType === 'blizzard1' ||
    missileType === 'blizzard2' ||
    missileType === 'blizzard3' ||
    missileType === 'blizzard4'
  )
}

/**
 * Advance every projectile one tick.
 *
 * @param projectiles - projectiles in flight.
 * @param targets - candidate targets.
 * @param options - terrain overlap test and projectile radius.
 * @returns the surviving projectiles and what they hit.
 */
export function tickProjectiles(
  projectiles: readonly Projectile[],
  targets: readonly ProjectileTarget[],
  options: {
    readonly overlap: (x: number, y: number) => number
    readonly isMissileBlocked?: ((x: number, y: number, fromX?: number, fromY?: number, mask?: number) => boolean) | undefined
    readonly radius?: number
    readonly nextDelayByTarget?: Map<number | string, number> | Map<number, number> | undefined
    readonly currentTick?: number | undefined
    readonly onMissileStep?: ((missileType: string, prevX: number, prevY: number, curX: number, curY: number, projectile: Projectile) => void) | undefined
    readonly rng?: (() => number) | undefined
  },
): ProjectileOutcome {
  const radius = options.radius ?? 8
  const alive: Projectile[] = []
  const spawned: Projectile[] = []
  const waveNextDelayHits = new Set<number>()
  const hits: {
    targetIndex: number
    damage: number
    x: number
    y: number
    skillId?: string | undefined
    missileType?: string | undefined
    aoeRadius?: number | undefined
    aoeDamage?: number | undefined
    statusEffect?: 'chill' | 'freeze' | 'poison' | undefined
    statusDuration?: number | undefined
    stunDuration?: number | undefined
    knockback?: boolean | undefined
    isUndeadOnly?: boolean | undefined
  }[] = []
  const wallHitEvents: {
    x: number
    y: number
    skillId?: string | undefined
    missileType?: string | undefined
    aoeRadius?: number | undefined
    damage?: number | undefined
    statusEffect?: 'chill' | 'freeze' | 'poison' | undefined
    statusDuration?: number | undefined
  }[] = []
  let expired = 0
  let wallHits = 0

  for (const projectile of projectiles) {
    const isExpired = projectile.missileType === 'meteorcenter' ? projectile.ttl <= 1 : projectile.ttl <= 0
    if (isExpired) {
      expired += 1
      if (projectile.missileType === 'frozenorb') {
        // Authentic D2 1.13c MISSMODE_SrvHit29_FrozenOrb (0x6FC5CE10):
        // Detonates into 16 frozenorbnova missiles + frozenorbexplode explosion at expiry
        for (let i = 0; i < 64; i += 4) {
          const offX = FROZEN_ORB_X_POSITIONS[i]!
          const offY = FROZEN_ORB_Y_POSITIONS[i]! * ISO_GROUND_ASPECT_RATIO
          const angle = Math.atan2(offY, offX)
          const speed = 24
          spawned.push({
            skillId: projectile.skillId,
            x: projectile.x,
            y: projectile.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: projectile.damage > 0 ? projectile.damage : 40,
            ttl: 25,
            fromPlayer: projectile.fromPlayer,
            missileType: 'frozenorbnova',
            statusEffect: 'chill',
            statusDuration: 100,
            isNovaCurl: true,
            pierce: false,
          })
        }
        wallHitEvents.push({
          x: projectile.x,
          y: projectile.y,
          skillId: projectile.skillId,
          missileType: 'frozenorb',
          aoeRadius: 24,
        })
      } else if (isBlizzardShard(projectile.missileType)) {
        const expType = getBlizzardExplosionMissile(projectile.missileType!)
        spawned.push({
          skillId: projectile.skillId,
          x: projectile.x,
          y: projectile.y,
          vx: 0,
          vy: 0,
          damage: projectile.damage,
          ttl: 6,
          fromPlayer: projectile.fromPlayer,
          missileType: expType,
          statusEffect: 'chill',
          statusDuration: 100,
          aoeRadius: 32,
          pierce: false,
        })
      } else if (projectile.missileType === 'fireball') {
        const blastRadius = projectile.aoeRadius ?? 80
        for (const target of targets) {
          if (!target.alive) continue
          const inRange =
            Math.hypot(target.x - projectile.x, (target.y - projectile.y) / ISO_GROUND_ASPECT_RATIO) <= blastRadius
          if (inRange) {
            hits.push({
              targetIndex: target.index,
              damage: projectile.damage,
              x: target.x,
              y: target.y,
              skillId: projectile.skillId,
              missileType: 'fireball',
              aoeRadius: blastRadius,
            })
          }
        }
        spawned.push({
          skillId: projectile.skillId,
          x: projectile.x,
          y: projectile.y,
          vx: 0,
          vy: 0,
          damage: 0,
          ttl: 16,
          fromPlayer: projectile.fromPlayer,
          missileType: 'explodingarrowexp',
          aoeRadius: blastRadius,
          pierce: true,
        })
        wallHitEvents.push({
          x: projectile.x,
          y: projectile.y,
          skillId: projectile.skillId,
          missileType: 'explodingarrowexp',
          aoeRadius: blastRadius,
        })
      } else if (
        projectile.missileType === 'explodingarrow' ||
        projectile.missileType === 'immolationarrow' ||
        projectile.missileType === 'freezingarrow'
      ) {
        // Authentic 1.13c AlwaysExplode = 1 for Exploding Arrow (#16), Immolation Arrow (#27), Freezing Arrow (#31):
        const blastRadius = projectile.aoeRadius ?? 80
        const blastDamage = projectile.aoeDamage ?? projectile.damage
        for (const target of targets) {
          if (!target.alive) continue
          const inRange =
            Math.hypot(target.x - projectile.x, (target.y - projectile.y) / ISO_GROUND_ASPECT_RATIO) <= blastRadius
          if (inRange) {
            hits.push({
              targetIndex: target.index,
              damage: blastDamage,
              x: target.x,
              y: target.y,
              skillId: projectile.skillId,
              missileType: projectile.missileType,
              aoeRadius: 0,
              statusEffect: projectile.statusEffect,
              statusDuration: projectile.statusDuration,
            })
          }
        }
        if (projectile.missileType === 'freezingarrow') {
          spawned.push({
            skillId: projectile.skillId,
            x: projectile.x,
            y: projectile.y,
            vx: 0,
            vy: 0,
            damage: 0,
            ttl: 15,
            fromPlayer: projectile.fromPlayer,
            missileType: 'freezingarrowexp1',
            aoeRadius: blastRadius,
            pierce: true,
          })
          spawned.push({
            skillId: projectile.skillId,
            x: projectile.x,
            y: projectile.y,
            vx: 0,
            vy: 0,
            damage: 0,
            ttl: 15,
            fromPlayer: projectile.fromPlayer,
            missileType: 'freezingarrowexp2',
            aoeRadius: blastRadius,
            pierce: true,
          })
          wallHitEvents.push({
            x: projectile.x,
            y: projectile.y,
            skillId: projectile.skillId,
            missileType: 'freezingarrowexp1',
            aoeRadius: blastRadius,
          })
        } else {
          spawned.push({
            skillId: projectile.skillId,
            x: projectile.x,
            y: projectile.y,
            vx: 0,
            vy: 0,
            damage: 0,
            ttl: 16,
            fromPlayer: projectile.fromPlayer,
            missileType: 'explodingarrowexp',
            aoeRadius: blastRadius,
            pierce: true,
          })
          wallHitEvents.push({
            x: projectile.x,
            y: projectile.y,
            skillId: projectile.skillId,
            missileType: 'explodingarrowexp',
            aoeRadius: blastRadius,
          })
          if (projectile.missileType === 'immolationarrow') {
            const fireDuration = projectile.fireDuration ?? 75
            spawned.push({
              skillId: projectile.skillId,
              x: projectile.x,
              y: projectile.y,
              vx: 0,
              vy: 0,
              damage: projectile.residualDamage ?? 2,
              ttl: fireDuration,
              fireDuration,
              fromPlayer: projectile.fromPlayer,
              missileType: 'immolationfire',
              aoeRadius: 48,
              pierce: true,
            })
          }
        }
      } else if (projectile.missileType === 'plaguejavelin') {
        // Authentic 1.13c AlwaysExplode = 1 for Plague Javelin (#25) -> MISSMODE_SrvHit02_PlagueJavelin:
        // Spawns radial expanding ring of plaguejavcloud missiles (Missiles.txt #221 Range=60)
        const cloudTtl = 60
        const cloudDmg = projectile.residualDamage ?? projectile.aoeDamage ?? Math.max(1, Math.floor(projectile.damage / 6))
        for (let i = 0; i < 64; i += 4) {
          const offX = FROZEN_ORB_X_POSITIONS[i]!
          const offY = FROZEN_ORB_Y_POSITIONS[i]! * ISO_GROUND_ASPECT_RATIO
          const angle = Math.atan2(offY, offX)
          const speed = 8
          spawned.push({
            skillId: projectile.skillId,
            x: projectile.x,
            y: projectile.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: cloudDmg,
            ttl: cloudTtl,
            fromPlayer: projectile.fromPlayer,
            missileType: 'plaguejavcloud',
            statusEffect: 'poison',
            statusDuration: projectile.statusDuration ?? 75,
            aoeRadius: 24,
            pierce: true,
          })
        }
      } else if (projectile.missileType === 'meteorcenter') {
        // Authentic D2 1.13c MISSMODE_SrvHit14_MeteorCenter (0x6FC5DEF0) & 0x6FC5CEC0:
        // 1. Primary explosion AOE damage (Radius = 6 subtiles = 120px) in 2:1 isometric ground perspective
        const blastRadius = projectile.aoeRadius ?? 120
        for (const target of targets) {
          if (!target.alive) continue
          const inRange =
            Math.hypot(target.x - projectile.x, (target.y - projectile.y) / ISO_GROUND_ASPECT_RATIO) <= blastRadius
          if (inRange) {
            hits.push({
              targetIndex: target.index,
              damage: projectile.damage,
              x: target.x,
              y: target.y,
              skillId: projectile.skillId,
              missileType: 'meteorexplode',
              aoeRadius: blastRadius,
            })
          }
        }

        // 2. Spawn explosion missile: meteorexplode (ID 103, Range 16)
        spawned.push({
          skillId: projectile.skillId,
          x: projectile.x,
          y: projectile.y,
          vx: 0,
          vy: 0,
          damage: 0,
          ttl: 16,
          fromPlayer: projectile.fromPlayer,
          missileType: 'meteorexplode',
          aoeRadius: blastRadius,
          pierce: true,
        })
        wallHitEvents.push({
          x: projectile.x,
          y: projectile.y,
          skillId: projectile.skillId,
          missileType: 'meteorexplode',
          aoeRadius: blastRadius,
        })

        // 3. Spawn 18 meteorfire submissiles using 18-offset table
        const slvl = Math.max(1, projectile.slvl ?? 1)
        const fireDuration = projectile.fireDuration ?? (90 + (slvl - 1) * 15)
        const residualDmg = projectile.residualDamage ?? calculateMeteorResidualFireDamage(slvl).min
        for (const off of METEOR_FIRE_SUBTILE_OFFSETS) {
          const fx = projectile.x + off.x * 20
          const fy = projectile.y + off.y * 10
          const blocked =
            options.isMissileBlocked !== undefined
              ? options.isMissileBlocked(fx, fy, projectile.x, projectile.y)
              : options.overlap(fx, fy) > 0
          if (!blocked) {
            spawned.push({
              skillId: projectile.skillId,
              x: fx,
              y: fy,
              vx: 0,
              vy: 0,
              damage: residualDmg,
              ttl: fireDuration,
              fromPlayer: projectile.fromPlayer,
              missileType: 'meteorfire',
              aoeRadius: 16,
              pierce: true,
              slvl,
              fireDuration,
            })
          }
        }
      } else if (projectile.missileType === 'moltenboulder') {
        const blastRadius = projectile.aoeRadius ?? 80
        const blastDamage = projectile.aoeDamage ?? projectile.damage
        for (const target of targets) {
          if (!target.alive) continue
          const inRange =
            Math.hypot(target.x - projectile.x, (target.y - projectile.y) / ISO_GROUND_ASPECT_RATIO) <= blastRadius
          if (inRange) {
            hits.push({
              targetIndex: target.index,
              damage: blastDamage,
              x: target.x,
              y: target.y,
              skillId: projectile.skillId,
              missileType: 'moltenboulderemerge',
              aoeRadius: 0,
            })
          }
        }
        spawned.push({
          skillId: projectile.skillId,
          x: projectile.x,
          y: projectile.y,
          vx: 0,
          vy: 0,
          damage: 0,
          ttl: 12,
          fromPlayer: projectile.fromPlayer,
          missileType: 'moltenboulderemerge',
          aoeRadius: blastRadius,
          pierce: true,
        })
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4
          spawned.push({
            skillId: projectile.skillId,
            x: projectile.x,
            y: projectile.y,
            vx: Math.cos(angle) * 8,
            vy: Math.sin(angle) * 8 * ISO_GROUND_ASPECT_RATIO,
            damage: 0,
            ttl: 15,
            fromPlayer: projectile.fromPlayer,
            missileType: 'moltenboulder-flyingrocks',
            aoeRadius: 32,
            pierce: true,
          })
        }
        wallHitEvents.push({
          x: projectile.x,
          y: projectile.y,
          skillId: projectile.skillId,
          missileType: 'moltenboulderemerge',
          aoeRadius: blastRadius,
        })
      } else if (projectile.missileType === 'armageddonrock') {
        const blastRadius = projectile.aoeRadius ?? 40
        for (const target of targets) {
          if (!target.alive) continue
          const inRange =
            Math.hypot(target.x - projectile.x, (target.y - projectile.y) / ISO_GROUND_ASPECT_RATIO) <= blastRadius
          if (inRange) {
            hits.push({
              targetIndex: target.index,
              damage: projectile.damage,
              x: target.x,
              y: target.y,
              skillId: projectile.skillId,
              missileType: 'armageddonrock',
              aoeRadius: 0,
            })
          }
        }
        spawned.push({
          skillId: projectile.skillId,
          x: projectile.x,
          y: projectile.y,
          vx: 0,
          vy: 0,
          damage: projectile.residualDamage ?? Math.max(1, Math.floor(projectile.damage / 6)),
          ttl: 38,
          fromPlayer: projectile.fromPlayer,
          missileType: 'armageddonfire',
          aoeRadius: 24,
          pierce: true,
          nextHit: 1,
          nextDelay: 4,
        })
        wallHitEvents.push({
          x: projectile.x,
          y: projectile.y,
          skillId: projectile.skillId,
          missileType: 'armageddonfire',
          aoeRadius: blastRadius,
        })
      }
      continue
    }

    let vx = projectile.vx
    let vy = projectile.vy
    let x = projectile.x + vx
    let y = projectile.y + vy
    let spiral = projectile.spiral
    let subMissileIdx = projectile.subMissileIdx
    let jitterIndex = projectile.jitterIndex ?? (projectile.seed !== undefined ? Math.abs(projectile.seed) % 32 : undefined)

    // 0. Frozen Orb Nova affine rotation & damping curl in final frames
    // Authentic D2 1.13c MISSMODE_SrvDo16_FrozenOrbNova (0x6FC58340):
    // In final 6 frames before expiry, every 2 frames apply: x' = (x - y) / 2, y' = (x + y) / 2
    if (
      (projectile.isNovaCurl || projectile.missileType === 'frozenorbnova') &&
      projectile.ttl <= 6 &&
      projectile.ttl % 2 === 0
    ) {
      const diff = vx - vy
      const sum = vx + vy
      vx = diff / 2
      vy = sum / 2
      x = projectile.x + vx
      y = projectile.y + vy
    } else if (spiral !== undefined) {
      // 1. Archimedean spiral trajectory (e.g. Blessed Hammer)
      // The hammer traces an Archimedean spiral on the map ground plane. In oblique/isometric
      // perspective (2:1 projection), a circular ground expansion projects to an ellipse with a 2:1 aspect ratio.
      const nextAngle = spiral.angle + 0.12435
      const nextRadius = spiral.radius + 1.855
      spiral = { ...spiral, angle: nextAngle, radius: nextRadius }
      x = spiral.originX + Math.cos(nextAngle) * nextRadius
      y = spiral.originY + Math.sin(nextAngle) * (nextRadius * ISO_GROUND_ASPECT_RATIO)
      vx = -Math.sin(nextAngle) * 18
      vy = Math.cos(nextAngle) * (18 * ISO_GROUND_ASPECT_RATIO)
    } else if (projectile.homing) {
      // 2. Homing trajectory (1.13c MISSMODE_SrvDo07_GuidedArrow_BoneSpirit 0x6FC59DC0):
      // Re-path directly toward nearest unhit living hostile target within 25 sub-tiles (500px).
      let nearestDist = Number.POSITIVE_INFINITY
      let targetX = 0
      let targetY = 0
      let foundTarget = false
      const isBoneSpirit = projectile.missileType === 'bonespirit' || projectile.skillId === '93'
      const maxSearchDistPx = isBoneSpirit ? 500 : Number.POSITIVE_INFINITY
      for (const t of targets) {
        if (!t.alive) continue
        if (projectile.hitTargets?.has(t.index)) continue
        const d = Math.hypot(t.x - projectile.x, t.y - projectile.y)
        if (d <= maxSearchDistPx && d < nearestDist && d > 0) {
          nearestDist = d
          targetX = t.x
          targetY = t.y
          foundTarget = true
        }
      }
      if (foundTarget) {
        const targetAngle = Math.atan2(targetY - projectile.y, targetX - projectile.x)
        const speed = Math.hypot(vx, vy)
        vx = Math.cos(targetAngle) * speed
        vy = Math.sin(targetAngle) * speed
        x = projectile.x + vx
        y = projectile.y + vy
      }
    } else if (projectile.jitter !== false && (projectile.jitter || projectile.missileType === 'chargedbolt' || projectile.skillId === '38' || projectile.skillId === 'chargedbolt')) {
      // 3. Jitter trajectory (e.g. Charged Bolt) - discrete orthogonal jitter lookup table
      // Authentic D2 1.13c PATH_ComputePathChargedBolt (0x6FD85470):
      // 32-entry lookup table gatChargedBoltOffsets applied perpendicularly to main propagation vector per step.
      let flatVx = vx
      let flatVy = vy / ISO_GROUND_ASPECT_RATIO
      const currentSpeed = Math.hypot(flatVx, flatVy)
      if (currentSpeed > 0) {
        const perpX = -flatVy / currentSpeed
        const perpY = flatVx / currentSpeed
        const idx = Math.abs((jitterIndex ?? (projectile.seed !== undefined ? projectile.seed : projectile.ttl)) % 32)
        const offset = GAT_CHARGED_BOLT_OFFSETS[idx]! * 3
        flatVx += perpX * offset
        flatVy += perpY * offset
        const newSpeed = Math.hypot(flatVx, flatVy)
        if (newSpeed > 0) {
          const scaleDown = currentSpeed / newSpeed
          flatVx *= scaleDown
          flatVy *= scaleDown
        }
        vx = flatVx
        vy = flatVy * ISO_GROUND_ASPECT_RATIO
        x = projectile.x + vx
        y = projectile.y + vy
        jitterIndex = (idx + 1) % 32
      }
    }

    // 4. Frozen Orb sub-missile emitter (pSrvDoFunc = 15, frequency = 1, step = 19)
    // Authentic D2 1.13c MISSMODE_SrvDo15_FrozenOrb (0x6FC581F0):
    // Emits 1 radial frozenorbbolt along 64-point circle table, advancing by step 19
    if (projectile.missileType === 'frozenorb') {
      const idx = Math.abs((subMissileIdx ?? 0) % 64)
      const offX = FROZEN_ORB_X_POSITIONS[idx]!
      const offY = FROZEN_ORB_Y_POSITIONS[idx]! * ISO_GROUND_ASPECT_RATIO
      const angle = Math.atan2(offY, offX)
      const speed = 18 // vel = 18 in 1.13c Missiles.txt (450 px/s)
      spawned.push({
        skillId: projectile.skillId,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: projectile.damage > 0 ? projectile.damage : 40,
        ttl: 25,
        fromPlayer: projectile.fromPlayer,
        missileType: 'frozenorbbolt',
        statusEffect: 'chill',
        statusDuration: 100,
        pierce: false,
      })
      subMissileIdx = (idx + 19) % 64
    }

    // 5. Stationary Turret Emitter (e.g. Hydra, Skill 62)
    const isTurretEmitter =
      projectile.isTurret === true ||
      projectile.missileType === 'hydra_turret' ||
      (projectile.missileType === 'hydra' && projectile.vx === 0 && projectile.vy === 0)

    if (isTurretEmitter) {
      x = projectile.x
      y = projectile.y
      vx = 0
      vy = 0
      const currentAge = (projectile.ageTicks ?? 0) + 1
      const cadence = projectile.fireCadenceTicks ?? 25
      if (currentAge % cadence === 0) {
        let targetX: number | undefined
        let targetY: number | undefined
        let minDistance = Infinity
        const maxRangePx = 480 // 1.13c Range = 30, Vel = 16 -> 480 px

        for (const target of targets) {
          if (!target.alive) continue
          const dx = target.x - x
          const dy = (target.y - y) / ISO_GROUND_ASPECT_RATIO
          const dist = Math.hypot(dx, dy)
          if (dist <= maxRangePx && dist < minDistance) {
            minDistance = dist
            targetX = target.x
            targetY = target.y
          }
        }

        if (targetX !== undefined && targetY !== undefined) {
          const dx = targetX - x
          const dy = targetY - y
          const angle = Math.atan2(dy, dx)
          const speed = 16 // 1.13c Missiles.txt: vel = 16 (400 px/s)
          spawned.push({
            skillId: projectile.skillId,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: projectile.damage > 0 ? projectile.damage : 28,
            ttl: 30, // 1.13c Missiles.txt: range = 30
            fromPlayer: projectile.fromPlayer,
            missileType: projectile.spawnMissileType ?? 'hydra',
            statusEffect: projectile.statusEffect,
            statusDuration: projectile.statusDuration,
            pierce: false,
          })
        }
      }
    }

    // 6. Blizzard Center Emitter (pSrvDoFunc = 10, Skill 59)
    // Authentic D2 1.13c MISSMODE_SrvDo10_blizzardcenter (0x6FC60CA0):
    // Emits 1 falling shard every 4 ticks (Param3 = 4) across 64-entry circle table (Radius 7)
    // with step 13, for a total of exactly 25 shards over 100 ticks.
    if (projectile.missileType === 'blizzardcenter') {
      const currentAge = (projectile.ageTicks ?? 0) + 1
      if (currentAge % 4 === 0) {
        const idx = Math.abs((subMissileIdx ?? 0) % 64)
        const offset = getBlizzardDropOffset(idx, 7)
        const shardVariants = ['blizzard1', 'blizzard2', 'blizzard3', 'blizzard4'] as const
        const shardType = shardVariants[Math.floor((currentAge / 4) - 1) % shardVariants.length]!
        spawned.push({
          skillId: projectile.skillId,
          x: projectile.x + offset.dx,
          y: projectile.y + offset.dy,
          vx: 0,
          vy: 0,
          altitude: 120,
          damage: projectile.damage,
          ttl: 9,
          fromPlayer: projectile.fromPlayer,
          missileType: shardType,
          statusEffect: 'chill',
          statusDuration: 100,
          pierce: false,
        })
        subMissileIdx = (idx + 13) % 64
      }
    }

    // 7. Poison Javelin (#15) & Plague Javelin (#25) trailing poison cloud (pSrvDoFunc = 2 / 3, Missiles.txt #39 / #221 Range = 60)
    if (projectile.missileType === 'poisonjav' || projectile.missileType === 'plaguejavelin') {
      const trailCloudType =
        projectile.missileType === 'plaguejavelin' ? 'plaguejavcloud' : 'poisonjavcloud'
      spawned.push({
        skillId: projectile.skillId,
        x: projectile.x,
        y: projectile.y,
        vx: 0,
        vy: 0,
        damage: projectile.residualDamage ?? Math.max(1, Math.floor(projectile.damage / 6)),
        ttl: 60,
        fromPlayer: projectile.fromPlayer,
        missileType: trailCloudType,
        statusEffect: 'poison',
        statusDuration: projectile.statusDuration ?? (projectile.missileType === 'plaguejavelin' ? 75 : 200),
        aoeRadius: 24,
        pierce: true,
      })
    }

    // 8. Druid Elemental controllers & wavy trajectories (#225, #229, #234, #240, #244, #245)
    const nextAge = (projectile.ageTicks ?? 0) + 1
    if (projectile.missileType === 'firestormmaker') {
      const speed = Math.hypot(vx, vy)
      if (speed > 0) {
        const perpX = -vy / speed
        const perpY = vx / speed
        const phase = ((projectile.headIndex ?? 0) * Math.PI * 2) / 3
        const wave = Math.sin(nextAge * 0.45 + phase) * 5
        x = projectile.x + vx + perpX * wave
        y = projectile.y + vy + perpY * wave
      }
      spawned.push({
        skillId: projectile.skillId,
        x: projectile.x,
        y: projectile.y,
        vx: 0,
        vy: 0,
        damage: projectile.damage,
        ttl: 18,
        fromPlayer: projectile.fromPlayer,
        missileType: 'firestorm',
        aoeRadius: 20,
        pierce: true,
        nextHit: 1,
        nextDelay: 4,
      })
    } else if (projectile.missileType === 'moltenboulder') {
      spawned.push({
        skillId: projectile.skillId,
        x: projectile.x,
        y: projectile.y,
        vx: 0,
        vy: 0,
        damage: projectile.residualDamage ?? Math.max(1, Math.floor(projectile.damage / 5)),
        ttl: projectile.fireDuration ?? 125,
        fromPlayer: projectile.fromPlayer,
        missileType: 'moltenboulderfirepath',
        aoeRadius: 24,
        pierce: true,
        nextHit: 1,
        nextDelay: 4,
      })
    } else if (projectile.missileType === 'erruption center') {
      x = projectile.x
      y = projectile.y
      vx = 0
      vy = 0
      if (nextAge % 5 === 0) {
        const step = Math.floor(nextAge / 5)
        const angle = step * 2.39996
        const dist = ((step * 17) % 60)
        spawned.push({
          skillId: projectile.skillId,
          x: projectile.x + Math.cos(angle) * dist,
          y: projectile.y + Math.sin(angle) * dist * ISO_GROUND_ASPECT_RATIO,
          vx: 0,
          vy: 0,
          damage: projectile.damage,
          ttl: 20,
          fromPlayer: projectile.fromPlayer,
          missileType: 'erruption crack 1',
          aoeRadius: 24,
          pierce: true,
          nextHit: 1,
          nextDelay: 5,
        })
      }
    } else if (projectile.missileType === 'volcano') {
      x = projectile.x
      y = projectile.y
      vx = 0
      vy = 0
      if (nextAge % 5 === 0) {
        const step = Math.floor(nextAge / 5)
        const angle = step * 2.39996
        const speed = 6
        spawned.push({
          skillId: projectile.skillId,
          x: projectile.x,
          y: projectile.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * ISO_GROUND_ASPECT_RATIO,
          damage: projectile.damage,
          ttl: 25,
          fromPlayer: projectile.fromPlayer,
          missileType: 'volcano small fire',
          aoeRadius: 24,
          pierce: false,
          nextHit: 1,
          nextDelay: 5,
        })
      }
    } else if (projectile.missileType === 'twister' || projectile.missileType === 'tornado') {
      const speed = Math.hypot(vx, vy)
      if (speed > 0) {
        const perpX = -vy / speed
        const perpY = vx / speed
        const phase = (projectile.headIndex ?? 0) * 1.5
        const wave = Math.sin(nextAge * 0.5 + phase) * (projectile.missileType === 'tornado' ? 3.5 : 4.5)
        x = projectile.x + vx + perpX * wave
        y = projectile.y + vy + perpY * wave
      }
    }

    let altitude = projectile.altitude
    if (isBlizzardShard(projectile.missileType)) {
      if (altitude === undefined) altitude = 120
      altitude = Math.max(0, altitude - (120 / 9))
    } else if (projectile.missileType === 'meteor' || projectile.missileType === 'meteortail' || projectile.missileType === 'armageddonrock') {
      if (altitude === undefined) altitude = 60 * 25
      altitude = Math.max(0, altitude - 25)
    }

    const hitTargets = projectile.hitTargets ?? new Set<number>()
    const currentAge = (projectile.ageTicks ?? 0) + 1
    if (
      (projectile.missileType === 'guidedarrow' || projectile.skillId === '22') &&
      currentAge % 5 === 0 &&
      hitTargets.size > 0
    ) {
      for (const hitIdx of Array.from(hitTargets)) {
        const hitTarget = targets.find(t => t.index === hitIdx)
        if (!hitTarget || Math.hypot(hitTarget.x - x, hitTarget.y - y) > hitTarget.radius + radius) {
          hitTargets.delete(hitIdx)
        }
      }
    }
    if (
      (projectile.missileType === 'meteorfire' && currentAge % 5 === 0) ||
      (projectile.missileType === 'immolationfire' && currentAge % 5 === 0) ||
      (projectile.missileType === 'poisonjavcloud' && currentAge % 5 === 0) ||
      (projectile.missileType === 'plaguejavcloud' && currentAge % 5 === 0) ||
      (projectile.missileType === 'firestorm' && currentAge % 4 === 0) ||
      (projectile.missileType === 'moltenboulderfirepath' && currentAge % 4 === 0) ||
      (projectile.missileType === 'erruption crack 1' && currentAge % 5 === 0) ||
      (projectile.missileType === 'armageddonfire' && currentAge % 4 === 0) ||
      (projectile.missileType === 'tornado' && currentAge % 25 === 0) ||
      projectile.missileType === 'firewall' ||
      projectile.missileType === 'blaze' ||
      projectile.missileType === 'infernoflame1' ||
      projectile.missileType === 'infernoflame2'
    ) {
      hitTargets.clear()
    }
    if (options.onMissileStep !== undefined && (projectile.x !== x || projectile.y !== y)) {
      options.onMissileStep(projectile.missileType ?? '', projectile.x, projectile.y, x, y, projectile)
    }
    const moved: Projectile = {
      ...projectile,
      x,
      y,
      vx,
      vy,
      prevX: projectile.x,
      prevY: projectile.y,
      spiral,
      subMissileIdx,
      jitterIndex,
      altitude,
      hitTargets,
      ageTicks: currentAge,
      ttl: projectile.ttl - 1,
    }

    // Walls first: a projectile dies against missile barriers (solid walls, closed doors) per 1.13c CollideType (0x6FD2D928)
    const missileRow = projectile.missileType ? getSharedDataRegistry().getMissileByName(projectile.missileType) : undefined
    const collideEntry = getMissileCollideEntry113c(missileRow?.collideType ?? 3)
    const terrainMask = collideEntry.terrainMask
    const isAirborne =
      (projectile.missileType === 'meteor' || projectile.missileType === 'meteortail' || projectile.missileType === 'armageddonrock') &&
      altitude !== undefined &&
      altitude > 0
    let blockedByTerrain = false
    if (!isAirborne && terrainMask !== 0) {
      const raySteps = stepMissileSubtileRay113c(projectile.x, projectile.y, x, y, 20)
      let checkPrevX = projectile.x
      let checkPrevY = projectile.y
      for (let s = 1; s < raySteps.length; s++) {
        const pt = raySteps[s]!
        const curX = pt.x
        const curY = pt.y
        if (options.isMissileBlocked !== undefined) {
          if (options.isMissileBlocked(curX, curY, checkPrevX, checkPrevY, terrainMask)) {
            blockedByTerrain = true
            break
          }
        } else if (options.overlap(curX, curY) > 0) {
          blockedByTerrain = true
          break
        }
        checkPrevX = curX
        checkPrevY = curY
      }
    }
    if (blockedByTerrain) {
      wallHits += 1
      wallHitEvents.push({
        x,
        y,
        skillId: projectile.skillId,
        missileType: projectile.missileType,
        aoeRadius: projectile.aoeRadius,
        damage: projectile.aoeDamage ?? projectile.damage,
        statusEffect: projectile.statusEffect,
        statusDuration: projectile.statusDuration,
      })
      if (projectile.missileType === 'frozenorb') {
        for (let i = 0; i < 64; i += 4) {
          const offX = FROZEN_ORB_X_POSITIONS[i]!
          const offY = FROZEN_ORB_Y_POSITIONS[i]! * ISO_GROUND_ASPECT_RATIO
          const angle = Math.atan2(offY, offX)
          const speed = 24
          spawned.push({
            skillId: projectile.skillId,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: projectile.damage > 0 ? projectile.damage : 40,
            ttl: 25,
            fromPlayer: projectile.fromPlayer,
            missileType: 'frozenorbnova',
            statusEffect: 'chill',
            statusDuration: 100,
            isNovaCurl: true,
            pierce: false,
          })
        }
      } else if (projectile.missileType === 'glacialspike') {
        spawned.push({
          skillId: projectile.skillId,
          x,
          y,
          vx: 0,
          vy: 0,
          damage: 0,
          ttl: 15,
          fromPlayer: projectile.fromPlayer,
          missileType: 'freezingarrowexp1',
          aoeRadius: projectile.aoeRadius ?? 64,
          pierce: true,
        })
        spawned.push({
          skillId: projectile.skillId,
          x,
          y,
          vx: 0,
          vy: 0,
          damage: 0,
          ttl: 15,
          fromPlayer: projectile.fromPlayer,
          missileType: 'freezingarrowexp2',
          aoeRadius: projectile.aoeRadius ?? 64,
          pierce: true,
        })
      } else if (isBlizzardShard(projectile.missileType)) {
        const expType = getBlizzardExplosionMissile(projectile.missileType!)
        spawned.push({
          skillId: projectile.skillId,
          x,
          y,
          vx: 0,
          vy: 0,
          damage: 0,
          ttl: 6,
          fromPlayer: projectile.fromPlayer,
          missileType: expType,
          statusEffect: 'chill',
          statusDuration: 100,
          aoeRadius: 32,
          pierce: false,
        })
      } else if (
        projectile.missileType === 'fireball' ||
        projectile.missileType === 'explodingarrow' ||
        projectile.missileType === 'immolationarrow'
      ) {
        spawned.push({
          skillId: projectile.skillId,
          x,
          y,
          vx: 0,
          vy: 0,
          damage: 0,
          ttl: 16,
          fromPlayer: projectile.fromPlayer,
          missileType: 'explodingarrowexp',
          aoeRadius: projectile.aoeRadius ?? 80,
          pierce: true,
        })
        if (projectile.missileType === 'immolationarrow') {
          const fireDuration = projectile.fireDuration ?? 75
          spawned.push({
            skillId: projectile.skillId,
            x,
            y,
            vx: 0,
            vy: 0,
            damage: projectile.residualDamage ?? 2,
            ttl: fireDuration,
            fireDuration,
            fromPlayer: projectile.fromPlayer,
            missileType: 'immolationfire',
            aoeRadius: 48,
            pierce: true,
          })
        }
      } else if (projectile.missileType === 'freezingarrow') {
        spawned.push({
          skillId: projectile.skillId,
          x,
          y,
          vx: 0,
          vy: 0,
          damage: 0,
          ttl: 15,
          fromPlayer: projectile.fromPlayer,
          missileType: 'freezingarrowexp1',
          aoeRadius: projectile.aoeRadius ?? 80,
          pierce: true,
        })
        spawned.push({
          skillId: projectile.skillId,
          x,
          y,
          vx: 0,
          vy: 0,
          damage: 0,
          ttl: 15,
          fromPlayer: projectile.fromPlayer,
          missileType: 'freezingarrowexp2',
          aoeRadius: projectile.aoeRadius ?? 80,
          pierce: true,
        })
      } else if (projectile.missileType === 'poisonjav') {
        spawned.push({
          skillId: projectile.skillId,
          x,
          y,
          vx: 0,
          vy: 0,
          damage: projectile.residualDamage ?? Math.max(1, Math.floor(projectile.damage / 6)),
          ttl: 60,
          fromPlayer: projectile.fromPlayer,
          missileType: 'poisonjavcloud',
          statusEffect: 'poison',
          statusDuration: projectile.statusDuration ?? 200,
          aoeRadius: 24,
          pierce: true,
        })
      } else if (projectile.missileType === 'plaguejavelin') {
        const cloudTtl = 60
        const cloudDmg = projectile.residualDamage ?? projectile.aoeDamage ?? Math.max(1, Math.floor(projectile.damage / 6))
        for (let i = 0; i < 64; i += 4) {
          const offX = FROZEN_ORB_X_POSITIONS[i]!
          const offY = FROZEN_ORB_Y_POSITIONS[i]! * ISO_GROUND_ASPECT_RATIO
          const angle = Math.atan2(offY, offX)
          const speed = 8
          spawned.push({
            skillId: projectile.skillId,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: cloudDmg,
            ttl: cloudTtl,
            fromPlayer: projectile.fromPlayer,
            missileType: 'plaguejavcloud',
            statusEffect: 'poison',
            statusDuration: projectile.statusDuration ?? 75,
            aoeRadius: 24,
            pierce: true,
          })
        }
      } else if (projectile.missileType === 'lightningfury') {
        const searchRadiusPx = projectile.aoeRadius ?? 300
        const maxBolts = 1 + Math.max(1, projectile.slvl ?? 1)
        const boltDamage = projectile.aoeDamage ?? projectile.damage
        const nearby = targets.filter(t => t.alive && Math.hypot(t.x - x, t.y - y) <= searchRadiusPx)
        const count = nearby.length > 0 ? Math.min(nearby.length, maxBolts) : 1
        for (let i = 0; i < count; i++) {
          const tgt = nearby[i]
          const angle = tgt ? Math.atan2(tgt.y - y, tgt.x - x) : 0
          const speed = 30
          spawned.push({
            skillId: projectile.skillId,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: boltDamage,
            ttl: 40,
            fromPlayer: projectile.fromPlayer,
            missileType: 'furylightning',
            pierce: true,
          })
        }
      } else if (projectile.missileType === 'moltenboulder') {
        const blastRadius = projectile.aoeRadius ?? 80
        spawned.push({
          skillId: projectile.skillId,
          x,
          y,
          vx: 0,
          vy: 0,
          damage: 0,
          ttl: 12,
          fromPlayer: projectile.fromPlayer,
          missileType: 'moltenboulderemerge',
          aoeRadius: blastRadius,
          pierce: true,
        })
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4
          spawned.push({
            skillId: projectile.skillId,
            x,
            y,
            vx: Math.cos(angle) * 8,
            vy: Math.sin(angle) * 8 * ISO_GROUND_ASPECT_RATIO,
            damage: 0,
            ttl: 15,
            fromPlayer: projectile.fromPlayer,
            missileType: 'moltenboulder-flyingrocks',
            aoeRadius: 32,
            pierce: true,
          })
        }
      }
      continue
    }

    let struck = false
    const isHarmlessEmitter =
      collideEntry.callbackVa === 0 ||
      collideEntry.collideType === 7 ||
      projectile.missileType === 'frozenorb' ||
      projectile.missileType === 'blizzardcenter' ||
      projectile.missileType === 'meteorcenter' ||
      projectile.missileType === 'meteor' ||
      projectile.missileType === 'meteortail' ||
      projectile.missileType === 'firewallmaker' ||
      projectile.missileType === 'firestormmaker' ||
      projectile.missileType === 'erruption center' ||
      projectile.missileType === 'volcano' ||
      projectile.missileType === 'armageddonrock' ||
      projectile.missileType === 'moltenboulderemerge' ||
      projectile.missileType === 'moltenboulder-flyingrocks' ||
      projectile.missileType === 'explodingarrowexp' ||
      projectile.missileType === 'freezingarrowexp1' ||
      projectile.missileType === 'freezingarrowexp2' ||
      projectile.missileType === 'icearrowexplode' ||
      projectile.missileType === 'iceexplode' ||
      projectile.missileType === 'fireexplode' ||
      projectile.missileType === 'thunderstorm1' ||
      projectile.missileType === 'lightninghit' ||
      isTurretEmitter
    if (!isHarmlessEmitter) {
      const collideFriend = Boolean(missileRow?.collideFriend || (projectile as { isFriendlyHeal?: boolean }).isFriendlyHeal)
      for (const target of targets) {
        if (!target.alive) continue
        if (hitTargets.has(target.index)) continue // already struck by piercing projectile
        const tgtAny = target as { isPlayer?: boolean; isMonster?: boolean; isAlly?: boolean }
        const targetIsPlayerOrAlly = Boolean(tgtAny.isPlayer || tgtAny.isAlly)
        if (collideEntry.unitTypeMask === 0x0080 && tgtAny.isPlayer === false && !tgtAny.isAlly) {
          continue
        }
        if (collideEntry.unitTypeMask === 0x0100 && targetIsPlayerOrAlly) {
          continue
        }
        if (projectile.fromPlayer !== false && targetIsPlayerOrAlly && !collideFriend) {
          continue
        }
        if (projectile.fromPlayer === false && (tgtAny.isMonster === true || tgtAny.isPlayer === false) && !collideFriend) {
          continue
        }
        const isGroundPatch =
          projectile.missileType === 'meteorfire' ||
          projectile.missileType === 'immolationfire' ||
          projectile.missileType === 'poisonjavcloud' ||
          projectile.missileType === 'plaguejavcloud' ||
          projectile.missileType === 'firestorm' ||
          projectile.missileType === 'moltenboulderfirepath' ||
          projectile.missileType === 'erruption crack 1' ||
          projectile.missileType === 'armageddonfire' ||
          projectile.missileType === 'firewall' ||
          projectile.missileType === 'blaze'
        const isHomingProjectile =
          Boolean(projectile.homing) ||
          projectile.missileType === 'guidedarrow' ||
          projectile.missileType === 'bonespirit'
        const distToSeg = (tx: number, ty: number): number => {
          const segDx = x - projectile.x
          const segDy = y - projectile.y
          const segLenSq = segDx * segDx + segDy * segDy
          if (segLenSq <= 1e-6) return Math.hypot(tx - x, ty - y)
          const t = Math.max(0, Math.min(1, ((tx - projectile.x) * segDx + (ty - projectile.y) * segDy) / segLenSq))
          return Math.hypot(tx - (projectile.x + segDx * t), ty - (projectile.y + segDy * t))
        }
        const dist = isGroundPatch
          ? Math.hypot(target.x - x, (target.y - y) / ISO_GROUND_ASPECT_RATIO)
          : isHomingProjectile
            ? distToSeg(target.x, target.y)
            : Math.hypot(target.x - x, target.y - y)
        const hitRadius =
          projectile.missileType === 'immolationfire' ||
          projectile.missileType === 'poisonjavcloud' ||
          projectile.missileType === 'plaguejavcloud' ||
          projectile.missileType === 'firestorm' ||
          projectile.missileType === 'moltenboulderfirepath' ||
          projectile.missileType === 'erruption crack 1' ||
          projectile.missileType === 'armageddonfire' ||
          projectile.missileType === 'tornado'
            ? Math.max(radius, projectile.aoeRadius ?? 24)
            : radius
        if (dist > target.radius + hitRadius) continue

        const hasNextDelay =
          (projectile.nextDelay !== undefined && projectile.nextDelay > 0) ||
          projectile.missileType === 'nova'
        const nextDelayFrames = projectile.nextDelay ?? 4

        if (hasNextDelay) {
          if (waveNextDelayHits.has(target.index)) continue
          if (options.nextDelayByTarget && options.currentTick !== undefined) {
            const exp = options.nextDelayByTarget.get(target.index)
            if (exp !== undefined && exp > options.currentTick) continue
          }
        }

        const statusEffect =
          projectile.statusEffect ??
          (isBlizzardShard(projectile.missileType) || projectile.missileType?.startsWith('blizzardexplode')
            ? 'chill'
            : undefined)
        const statusDuration =
          projectile.statusDuration ??
          (isBlizzardShard(projectile.missileType) || projectile.missileType?.startsWith('blizzardexplode')
            ? 100
            : undefined)

        hits.push({
          targetIndex: target.index,
          damage: projectile.damage,
          x,
          y,
          skillId: projectile.skillId,
          missileType: projectile.missileType,
          aoeRadius:
            projectile.missileType === 'immolationfire' ||
            projectile.missileType === 'poisonjavcloud' ||
            projectile.missileType === 'plaguejavcloud' ||
            projectile.missileType === 'firestorm' ||
            projectile.missileType === 'moltenboulderfirepath' ||
            projectile.missileType === 'erruption crack 1' ||
            projectile.missileType === 'armageddonfire' ||
            projectile.missileType === 'tornado'
              ? 0
              : projectile.aoeRadius,
          aoeDamage: projectile.aoeDamage,
          statusEffect,
          statusDuration,
          stunDuration: projectile.stunDuration ?? (projectile.missileType === 'twister' ? 10 : undefined),
          knockback: projectile.knockback ?? (projectile.missileType === 'moltenboulder' ? true : undefined),
          isUndeadOnly: projectile.isUndeadOnly,
        })

        if (hasNextDelay) {
          waveNextDelayHits.add(target.index)
          if (options.nextDelayByTarget && options.currentTick !== undefined) {
            options.nextDelayByTarget.set(target.index, options.currentTick + nextDelayFrames)
          }
        }

        hitTargets.add(target.index)

        // Authentic 1.13c Chain Lightning / Lightning Strike (#34) retargeting / jump
        const isChainLightning =
          projectile.missileType === 'chainlightning' ||
          projectile.missileType === 'lightningstrike' ||
          (projectile.chainRemaining !== undefined && projectile.chainRemaining > 0)
        if (isChainLightning) {
          const jumpsLeft = projectile.chainRemaining !== undefined ? projectile.chainRemaining : 0
          if (jumpsLeft > 0) {
            // Search radius: 20 subtiles (400 px) for Chain Lightning & Lightning Strike
            const searchRadiusPx = projectile.aoeRadius ?? 400
            let closestCand: ProjectileTarget | null = null
            let closestDist = Infinity
            for (const cand of targets) {
              if (!cand.alive || cand.index === target.index) continue
              // Authentic ping-pong: only exclude immediate prior victim (target.index)
              const d = Math.hypot(cand.x - target.x, cand.y - target.y)
              if (d <= searchRadiusPx && d < closestDist) {
                closestDist = d
                closestCand = cand
              }
            }
            if (closestCand) {
              const dx = closestCand.x - target.x
              const dy = closestCand.y - target.y
              const len = Math.hypot(dx, dy)
              const speed = 30 // 1.13c Missiles.txt vel = 30 (750 px/s)
              const pVx = len > 0 ? (dx / len) * speed : speed
              const pVy = len > 0 ? (dy / len) * speed : 0
              spawned.push({
                skillId: projectile.skillId,
                x: target.x,
                y: target.y,
                vx: pVx,
                vy: pVy,
                damage: projectile.damage,
                ttl: 25,
                fromPlayer: projectile.fromPlayer,
                missileType: projectile.missileType === 'lightningstrike' ? 'lightningstrike' : 'chainlightning',
                aoeRadius: projectile.aoeRadius,
                chainRemaining: jumpsLeft - 1,
                lastHitTargetIndex: target.index,
                nextHit: 1,
                nextDelay: 4,
              })
            }
          }
          struck = true
          break
        }

        // Authentic 1.13c: Exploding Arrow (#16), Immolation Arrow (#27), Freezing Arrow (#31),
        // Plague Javelin (#25), and Lightning Fury (#35) trigger their on-hit sub-missiles on EVERY target hit, even when piercing!
        if (projectile.missileType === 'explodingarrow' || projectile.missileType === 'immolationarrow') {
          spawned.push({
            skillId: projectile.skillId,
            x,
            y,
            vx: 0,
            vy: 0,
            damage: 0,
            ttl: 16,
            fromPlayer: projectile.fromPlayer,
            missileType: 'explodingarrowexp',
            aoeRadius: projectile.aoeRadius ?? 80,
            pierce: true,
          })
          if (projectile.missileType === 'immolationarrow') {
            const fireDuration = projectile.fireDuration ?? 75
            spawned.push({
              skillId: projectile.skillId,
              x,
              y,
              vx: 0,
              vy: 0,
              damage: projectile.residualDamage ?? 2,
              ttl: fireDuration,
              fireDuration,
              fromPlayer: projectile.fromPlayer,
              missileType: 'immolationfire',
              aoeRadius: 48,
              pierce: true,
            })
          }
        } else if (projectile.missileType === 'freezingarrow') {
          spawned.push({
            skillId: projectile.skillId,
            x,
            y,
            vx: 0,
            vy: 0,
            damage: 0,
            ttl: 15,
            fromPlayer: projectile.fromPlayer,
            missileType: 'freezingarrowexp1',
            aoeRadius: projectile.aoeRadius ?? 80,
            pierce: true,
          })
          spawned.push({
            skillId: projectile.skillId,
            x,
            y,
            vx: 0,
            vy: 0,
            damage: 0,
            ttl: 15,
            fromPlayer: projectile.fromPlayer,
            missileType: 'freezingarrowexp2',
            aoeRadius: projectile.aoeRadius ?? 80,
            pierce: true,
          })
        } else if (projectile.missileType === 'plaguejavelin') {
          const cloudTtl = 60
          const cloudDmg = projectile.residualDamage ?? projectile.aoeDamage ?? Math.max(1, Math.floor(projectile.damage / 6))
          for (let i = 0; i < 64; i += 4) {
            const offX = FROZEN_ORB_X_POSITIONS[i]!
            const offY = FROZEN_ORB_Y_POSITIONS[i]! * ISO_GROUND_ASPECT_RATIO
            const angle = Math.atan2(offY, offX)
            const speed = 8
            spawned.push({
              skillId: projectile.skillId,
              x,
              y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              damage: cloudDmg,
              ttl: cloudTtl,
              fromPlayer: projectile.fromPlayer,
              missileType: 'plaguejavcloud',
              statusEffect: 'poison',
              statusDuration: projectile.statusDuration ?? 75,
              aoeRadius: 24,
              pierce: true,
            })
          }
        } else if (projectile.missileType === 'lightningfury') {
          // Authentic 1.13c MISSMODE_SrvHit21_LightningFury (0x6FC5E2B0):
          // Releases 1 furylightning bolt per living monster within 15 subtiles (300px, excluding hit target), capped at 1 + slvl
          const searchRadiusPx = projectile.aoeRadius ?? 300
          const maxBolts = 1 + Math.max(1, projectile.slvl ?? 1)
          const boltDamage = projectile.aoeDamage ?? projectile.damage
          const nearby = targets.filter(
            t => t.alive && t.index !== target.index && Math.hypot(t.x - x, t.y - y) <= searchRadiusPx,
          )
          const count = Math.min(nearby.length, maxBolts)
          for (let i = 0; i < count; i++) {
            const tgt = nearby[i]!
            const angle = Math.atan2(tgt.y - y, tgt.x - x)
            const speed = 30
            spawned.push({
              skillId: projectile.skillId,
              x,
              y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              damage: boltDamage,
              ttl: 40,
              fromPlayer: projectile.fromPlayer,
              missileType: 'furylightning',
              pierce: true,
            })
          }
        }

        let canPierceTarget = Boolean(projectile.pierce)
        if (canPierceTarget && (projectile.pierceChancePct !== undefined || projectile.maxPierceCount !== undefined)) {
          // 1.13c `pierce_idx` (Issue #1420): the pierce count is rolled once (`D2Game.dll` `0x6FC8F660`:
          // consecutive `rand % 100 < item_pierce + skill_pierce`, at most 4) and consumed per hit (`0x6FC58F40`).
          // No pierce total means no pierce at all (never a 100% default).
          const mv = moved as { pierceCount?: number; pierceIdx?: number }
          const currentPierceCount = mv.pierceCount ?? projectile.pierceCount ?? 0
          let remaining = mv.pierceIdx ?? projectile.pierceIdx
          if (remaining === undefined) {
            const total = Math.trunc(projectile.pierceChancePct ?? 0)
            const cap = Math.min(MISSILE_PIERCE_ROLL_CAP, projectile.maxPierceCount ?? MISSILE_PIERCE_ROLL_CAP)
            if (options.rng) {
              remaining = 0
              while (remaining < cap && total !== 0 && Math.floor(options.rng() * 100) < total) remaining += 1
            } else {
              remaining = Math.min(cap, rollMissilePierceIdx(total, projectile.seed ?? 0))
            }
          }
          canPierceTarget = remaining > 0
          if (canPierceTarget) {
            mv.pierceIdx = remaining - 1
            mv.pierceCount = currentPierceCount + 1
          } else {
            mv.pierceIdx = 0
          }
        }

        if (!canPierceTarget) {
          struck = true
          if (projectile.missileType === 'glacialspike') {
            spawned.push({
              skillId: projectile.skillId,
              x,
              y,
              vx: 0,
              vy: 0,
              damage: 0,
              ttl: 15,
              fromPlayer: projectile.fromPlayer,
              missileType: 'freezingarrowexp1',
              aoeRadius: projectile.aoeRadius ?? 64,
              pierce: true,
            })
            spawned.push({
              skillId: projectile.skillId,
              x,
              y,
              vx: 0,
              vy: 0,
              damage: 0,
              ttl: 15,
              fromPlayer: projectile.fromPlayer,
              missileType: 'freezingarrowexp2',
              aoeRadius: projectile.aoeRadius ?? 64,
              pierce: true,
            })
          } else if (isBlizzardShard(projectile.missileType)) {
            const expType = getBlizzardExplosionMissile(projectile.missileType!)
            spawned.push({
              skillId: projectile.skillId,
              x,
              y,
              vx: 0,
              vy: 0,
              damage: 0,
              ttl: 6,
              fromPlayer: projectile.fromPlayer,
              missileType: expType,
              statusEffect: 'chill',
              statusDuration: 100,
              aoeRadius: 32,
              pierce: false,
            })
          } else if (projectile.missileType === 'poisonjav') {
            spawned.push({
              skillId: projectile.skillId,
              x,
              y,
              vx: 0,
              vy: 0,
              damage: projectile.residualDamage ?? Math.max(1, Math.floor(projectile.damage / 6)),
              ttl: 60,
              fromPlayer: projectile.fromPlayer,
              missileType: 'poisonjavcloud',
              statusEffect: 'poison',
              statusDuration: projectile.statusDuration ?? 200,
              aoeRadius: 24,
              pierce: true,
            })
          } else if (projectile.missileType === 'fireball') {
            spawned.push({
              skillId: projectile.skillId,
              x,
              y,
              vx: 0,
              vy: 0,
              damage: 0,
              ttl: 16,
              fromPlayer: projectile.fromPlayer,
              missileType: 'explodingarrowexp',
              aoeRadius: projectile.aoeRadius ?? 80,
              pierce: true,
            })
          }
          break
        }
      }
    }

    if (!struck) {
      alive.push(moved)
    }
  }

  alive.push(...spawned)
  return { alive, hits, expired, wallHits, wallHitEvents, spawnedProjectiles: spawned }
}

// ============================================================================
// 1.13c Batch 1 Skills Execution, Synergy Integration, and Combat Calculations
// ============================================================================

/**
 * Computes min/max skill damage based on 1.13c 5-level-band progressions, HitShift precision,
 * hard-point synergy multiplier integration, and weapon damage scaling.
 *
 * @param skillId - Canonical numeric skill ID.
 * @param effectiveLevel - Current effective skill level (hard + soft points).
 * @param synergyMultiplier - Evaluated synergy multiplier: 1.0 + (synergyBonusPct / 100).
 * @param weaponDamage - Optional base weapon damage range { min, max }.
 */
export function calculateSkillDamage(
  skillId: number | string,
  slvl: number,
  synergies?: number | {
    readonly iceBolt?: number | undefined
    readonly iceBlast?: number | undefined
    readonly glacialSpike?: number | undefined
    readonly blizzard?: number | undefined
    readonly frozenOrb?: number | undefined
    readonly fireBolt?: number | undefined
    readonly fireBall?: number | undefined
    readonly fireMastery?: number | undefined
    readonly inferno?: number | undefined
    readonly [key: string]: any
  },
  weaponDamage?: { min: number; max: number }
): { min: number; max: number } {
  if (skillId === 6 || skillId === '6' || skillId === 'magicarrow' || skillId === 'magic arrow') {
    if (!weaponDamage) {
      return { min: 0, max: 0 }
    }
    const stats = calculateMagicArrowStats(slvl)
    const baseMin = weaponDamage.min ?? 0
    const baseMax = weaponDamage.max ?? 0
    return { min: baseMin + stats.flatMagicDamage, max: baseMax + stats.flatMagicDamage }
  }
  if (skillId === 7 || skillId === '7' || skillId === 'firearrow' || skillId === 'fire arrow') {
    const stats = calculateFireArrowStats(slvl, synergies as any)
    const baseMin = weaponDamage?.min ?? 0
    const baseMax = weaponDamage?.max ?? 0
    return { min: baseMin + stats.minDamage, max: baseMax + stats.maxDamage }
  }
  if (skillId === 'jab') {
    const stats = calculateJabStats(slvl)
    const ed = Math.max(0, 1 + stats.enhancedDamagePct / 100)
    const baseMin = Number.isFinite(weaponDamage?.min) ? Math.max(0, Math.floor(weaponDamage!.min)) : 0
    const baseMax = Number.isFinite(weaponDamage?.max) ? Math.max(0, Math.floor(weaponDamage!.max)) : 0
    return { min: Math.floor(baseMin * ed), max: Math.floor(baseMax * ed) }
  }
  if (skillId === 11 || skillId === '11' || skillId === 'coldarrow' || skillId === 'cold arrow') {
    const stats = calculateColdArrowStats(slvl, synergies as any)
    const baseMin = weaponDamage?.min ?? 0
    const baseMax = weaponDamage?.max ?? 0
    return { min: baseMin + stats.minDamage, max: baseMax + stats.maxDamage }
  }
  if (skillId === 12 || skillId === '12' || skillId === 'multipleshot' || skillId === 'multiple shot') {
    const stats = calculateMultipleShotStats(slvl)
    const baseMin = weaponDamage?.min ?? 0
    const baseMax = weaponDamage?.max ?? 0
    return { min: Math.floor(baseMin * stats.damageMultiplier), max: Math.floor(baseMax * stats.damageMultiplier) }
  }
  if (
    skillId === 'powerstrike' ||
    skillId === 'power strike' ||
    ((skillId === 14 || skillId === '14') && synergies !== undefined && typeof synergies === 'object')
  ) {
    const stats = calculatePowerStrikeStats(slvl, synergies as any)
    const baseMin = Number.isFinite(weaponDamage?.min) ? Math.max(0, Math.floor(weaponDamage!.min)) : 0
    const baseMax = Number.isFinite(weaponDamage?.max) ? Math.max(0, Math.floor(weaponDamage!.max)) : 0
    return { min: baseMin + stats.minDamage, max: baseMax + stats.maxDamage }
  }
  if (skillId === 15 || skillId === '15' || skillId === 'poisonjavelin' || skillId === 'poison javelin') {
    const stats = calculatePoisonJavelinStats(slvl, synergies as any)
    const baseMin = Number.isFinite(weaponDamage?.min) ? Math.max(0, Math.floor(weaponDamage!.min)) : 0
    const baseMax = Number.isFinite(weaponDamage?.max) ? Math.max(0, Math.floor(weaponDamage!.max)) : 0
    return { min: baseMin + stats.minDamage, max: baseMax + stats.maxDamage }
  }
  if (skillId === 16 || skillId === '16' || skillId === 'explodingarrow' || skillId === 'exploding arrow') {
    const stats = calculateExplodingArrowStats(slvl, synergies as any)
    const baseMin = weaponDamage?.min ?? 0
    const baseMax = weaponDamage?.max ?? 0
    return { min: baseMin + stats.minBlastDamage, max: baseMax + stats.maxBlastDamage }
  }
  if (skillId === 19 || skillId === '19' || skillId === 'impale') {
    const stats = calculateImpaleStats(slvl)
    const ed = 1 + stats.enhancedDamagePct / 100
    const baseMin = Number.isFinite(weaponDamage?.min) ? Math.max(0, Math.floor(weaponDamage!.min)) : 0
    const baseMax = Number.isFinite(weaponDamage?.max) ? Math.max(0, Math.floor(weaponDamage!.max)) : 0
    return { min: Math.floor(baseMin * ed), max: Math.floor(baseMax * ed) }
  }
  if (skillId === 20 || skillId === '20' || skillId === 'lightningbolt' || skillId === 'lightning bolt') {
    const stats = calculateLightningBoltStats(slvl, synergies as any)
    const baseMin = Number.isFinite(weaponDamage?.min) ? Math.max(0, Math.floor(weaponDamage!.min)) : 0
    const baseMax = Number.isFinite(weaponDamage?.max) ? Math.max(0, Math.floor(weaponDamage!.max)) : 0
    return { min: baseMin + stats.minDamage, max: baseMax + stats.maxDamage }
  }
  if (skillId === 21 || skillId === '21' || skillId === 'icearrow' || skillId === 'ice arrow') {
    const stats = calculateIceArrowStats(slvl, synergies as any)
    const baseMin = weaponDamage?.min ?? 0
    const baseMax = weaponDamage?.max ?? 0
    return { min: baseMin + stats.minDamage, max: baseMax + stats.maxDamage }
  }
  if (skillId === 22 || skillId === '22' || skillId === 'guidedarrow' || skillId === 'guided arrow') {
    const stats = calculateGuidedArrowStats(slvl)
    const ed = 1 + stats.enhancedDamagePct / 100
    const baseMin = weaponDamage?.min ?? 0
    const baseMax = weaponDamage?.max ?? 0
    return { min: Math.floor(baseMin * ed), max: Math.floor(baseMax * ed) }
  }
  if (skillId === 24 || skillId === '24' || skillId === 'chargedstrike' || skillId === 'charged strike') {
    const stats = calculateChargedStrikeStats(slvl, synergies as any)
    const baseMin = Number.isFinite(weaponDamage?.min) ? Math.max(0, Math.floor(weaponDamage!.min)) : 0
    const baseMax = Number.isFinite(weaponDamage?.max) ? Math.max(0, Math.floor(weaponDamage!.max)) : 0
    return { min: baseMin + stats.minDamage, max: baseMax + stats.maxDamage }
  }
  if (skillId === 25 || skillId === '25' || skillId === 'plaguejavelin' || skillId === 'plague javelin') {
    const stats = calculatePlagueJavelinStats(slvl, synergies as any)
    const baseMin = Number.isFinite(weaponDamage?.min) ? Math.max(0, Math.floor(weaponDamage!.min)) : 0
    const baseMax = Number.isFinite(weaponDamage?.max) ? Math.max(0, Math.floor(weaponDamage!.max)) : 0
    return { min: baseMin + stats.minDamage, max: baseMax + stats.maxDamage }
  }
  if (skillId === 26 || skillId === '26' || skillId === 'strafe') {
    const stats = calculateStrafeStats(slvl)
    const mult = stats.damageMultiplier * (1 + stats.enhancedDamagePct / 100)
    const baseMin = weaponDamage?.min ?? 0
    const baseMax = weaponDamage?.max ?? 0
    return { min: Math.floor(baseMin * mult), max: Math.floor(baseMax * mult) }
  }
  if (skillId === 27 || skillId === '27' || skillId === 'immolationarrow' || skillId === 'immolation arrow') {
    const stats = calculateImmolationArrowStats(slvl, synergies as any)
    const baseMin = weaponDamage?.min ?? 0
    const baseMax = weaponDamage?.max ?? 0
    return { min: baseMin + stats.minExplosionDamage, max: baseMax + stats.maxExplosionDamage }
  }
  if (skillId === 30 || skillId === '30' || skillId === 'fend') {
    const stats = calculateFendStats(slvl)
    const ed = 1 + stats.enhancedDamagePct / 100
    const baseMin = Number.isFinite(weaponDamage?.min) ? Math.max(0, Math.floor(weaponDamage!.min)) : 0
    const baseMax = Number.isFinite(weaponDamage?.max) ? Math.max(0, Math.floor(weaponDamage!.max)) : 0
    return { min: Math.floor(baseMin * ed), max: Math.floor(baseMax * ed) }
  }
  if (skillId === 31 || skillId === '31' || skillId === 'freezingarrow' || skillId === 'freezing arrow') {
    const stats = calculateFreezingArrowStats(slvl, synergies as any)
    const baseMin = weaponDamage?.min ?? 0
    const baseMax = weaponDamage?.max ?? 0
    return { min: baseMin + stats.minColdDamage, max: baseMax + stats.maxColdDamage }
  }
  if (skillId === 34 || skillId === '34' || skillId === 'lightningstrike' || skillId === 'lightning strike') {
    const stats = calculateLightningStrikeStats(slvl, synergies as any)
    const baseMin = Number.isFinite(weaponDamage?.min) ? Math.max(0, Math.floor(weaponDamage!.min)) : 0
    const baseMax = Number.isFinite(weaponDamage?.max) ? Math.max(0, Math.floor(weaponDamage!.max)) : 0
    return { min: baseMin + stats.minDamage, max: baseMax + stats.maxDamage }
  }
  if (skillId === 35 || skillId === '35' || skillId === 'lightningfury' || skillId === 'lightning fury') {
    const stats = calculateLightningFuryStats(slvl, synergies as any)
    const baseMin = Number.isFinite(weaponDamage?.min) ? Math.max(0, Math.floor(weaponDamage!.min)) : 0
    const baseMax = Number.isFinite(weaponDamage?.max) ? Math.max(0, Math.floor(weaponDamage!.max)) : 0
    return { min: baseMin + stats.minDamage, max: baseMax + stats.maxDamage }
  }
  if (
    skillId === 8 || skillId === '8' || skillId === 'innersight' || skillId === 'inner sight' ||
    skillId === 9 || skillId === '9' || skillId === 'criticalstrike' || skillId === 'critical strike' ||
    skillId === 13 || skillId === '13' || skillId === 'dodge' ||
    skillId === 17 || skillId === '17' || skillId === 'slowmissiles' || skillId === 'slow missiles' ||
    skillId === 18 || skillId === '18' || skillId === 'avoid' ||
    skillId === 23 || skillId === '23' || skillId === 'penetrate' ||
    skillId === 28 || skillId === '28' || skillId === 'decoy' || skillId === 'dopplezon' ||
    skillId === 29 || skillId === '29' || skillId === 'evade' ||
    skillId === 32 || skillId === '32' || skillId === 'valkyrie' ||
    skillId === 33 || skillId === '33' || skillId === 'pierce'
  ) {
    return { min: 0, max: 0 }
  }
  if (skillId === 38 || skillId === '38' || skillId === 'chargedbolt' || skillId === 'charged bolt') {
    return calculateChargedBoltDamage(slvl, synergies as any)
  }
  if (skillId === 47 || skillId === '47' || skillId === 'fireball' || skillId === 'fire ball') {
    return calculateFireBallDamage(slvl, synergies as any)
  }
  if (skillId === 41 || skillId === '41' || skillId === 'inferno') {
    return calculateInfernoDamage(slvl, synergies as any)
  }
  if (skillId === 46 || skillId === '46' || skillId === 'blaze') {
    return calculateBlazeDamage(slvl, synergies as any)
  }
  if (skillId === 51 || skillId === '51' || skillId === 'firewall' || skillId === 'fire wall') {
    return calculateFireWallDamage(slvl, synergies as any)
  }
  if (skillId === 52 || skillId === '52' || skillId === 'enchant') {
    return calculateEnchantDamage(slvl, synergies as any)
  }
  if (skillId === 40 || skillId === '40' || skillId === 'frozenarmor' || skillId === 'frozen armor') {
    return { min: 0, max: 0 }
  }
  if (skillId === 43 || skillId === '43' || skillId === 'telekinesis') {
    return calculateTelekinesisDamage(slvl)
  }
  if (skillId === 44 || skillId === '44' || skillId === 'frostnova' || skillId === 'frost nova') {
    return calculateFrostNovaDamage(slvl, synergies as any)
  }
  if (skillId === 48 || skillId === '48' || skillId === 'nova') {
    return calculateNovaDamage(slvl, synergies as any)
  }
  if (skillId === 42 || skillId === '42' || skillId === 'staticfield' || skillId === 'static field') {
    return { min: 0, max: 0 }
  }
  if (skillId === 45 || skillId === '45' || skillId === 'iceblast' || skillId === 'ice blast') {
    return calculateIceBlastDamage(slvl, synergies as any)
  }
  if (skillId === 50 || skillId === '50' || skillId === 'shiverarmor' || skillId === 'shiver armor') {
    return calculateShiverArmorDamage(slvl, synergies as any)
  }
  if (skillId === 53 || skillId === '53' || skillId === 'chainlightning' || skillId === 'chain lightning') {
    return calculateChainLightningDamage(slvl, synergies as any)
  }
  if (skillId === 55 || skillId === '55' || skillId === 'glacialspike' || skillId === 'glacial spike') {
    return calculateGlacialSpikeDamage(slvl, synergies as any)
  }
  if (skillId === 60 || skillId === '60' || skillId === 'chillingarmor' || skillId === 'chilling armor') {
    return calculateChillingArmorDamage(slvl, synergies as any)
  }
  if (skillId === 49 || skillId === '49' || skillId === 'lightning') {
    return calculateLightningDamage(slvl, synergies as any)
  }
  if (skillId === 57 || skillId === '57' || skillId === 'thunderstorm' || skillId === 'thunder storm') {
    return calculateThunderStormDamage(slvl, synergies as any)
  }
  if (skillId === 58 || skillId === '58' || skillId === 'energyshield' || skillId === 'energy shield') {
    return { min: 0, max: 0 }
  }
  if (skillId === 61 || skillId === '61' || skillId === 'firemastery' || skillId === 'fire mastery') {
    return { min: 0, max: 0 }
  }
  if (skillId === 63 || skillId === '63' || skillId === 'lightningmastery' || skillId === 'lightning mastery') {
    return { min: 0, max: 0 }
  }
  if (skillId === 65 || skillId === '65' || skillId === 'coldmastery' || skillId === 'cold mastery') {
    return { min: 0, max: 0 }
  }
  if (skillId === 59 || skillId === '59' || skillId === 'blizzard') {
    return calculateBlizzardDamage(slvl, synergies)
  }
  if (skillId === 56 || skillId === '56' || skillId === 'meteor') {
    return calculateMeteorDamage(slvl, synergies as any)
  }
  if (skillId === 62 || skillId === '62' || skillId === 'hydra') {
    return calculateHydraDamage(slvl, synergies as any)
  }
  if (skillId === 67 || skillId === '67' || skillId === 'teeth') {
    return calculateTeethDamage(slvl, synergies as any)
  }
  if (skillId === 68 || skillId === '68' || skillId === 'bonearmor' || skillId === 'bone armor') {
    const lvl = Math.max(1, Math.floor(slvl))
    const base = 20 + (lvl - 1) * 10
    let cap = base
    if (typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0) {
      cap = Math.floor(base * synergies)
    } else if (synergies && typeof synergies === 'object') {
      cap = calculateBoneArmorCapacity(slvl, synergies as any)
    }
    return { min: cap, max: cap }
  }
  if (skillId === 70 || skillId === '70' || skillId === 'raiseskeleton' || skillId === 'raise skeleton') {
    return { min: 0, max: 0 }
  }
  if (skillId === 73 || skillId === '73' || skillId === 'poisondagger' || skillId === 'poison dagger') {
    const p = calculatePoisonDaggerDamage(slvl, synergies as any)
    return { min: p.minDamage, max: p.maxDamage }
  }
  if (skillId === 74 || skillId === '74' || skillId === 'corpseexplosion' || skillId === 'corpse explosion') {
    const hp = weaponDamage?.max ?? 1000
    const ce = calculateCorpseExplosionDamage(hp)
    const syn = typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
    return { min: Math.floor(ce.minTotal * syn), max: Math.floor(ce.maxTotal * syn) }
  }
  if (skillId === 78 || skillId === '78' || skillId === 'bonewall' || skillId === 'bone wall') {
    const bw = calculateBoneWallStats(slvl, synergies as any)
    return { min: bw.hp, max: bw.hp }
  }
  if (skillId === 83 || skillId === '83' || skillId === 'poisonexplosion' || skillId === 'poison explosion') {
    const pe = calculatePoisonExplosionDamage(slvl, synergies as any)
    return { min: pe.minDamage, max: pe.maxDamage }
  }
  if (skillId === 84 || skillId === '84' || skillId === 'bonespear' || skillId === 'bone spear') {
    return calculateBoneSpearDamage(slvl, synergies as any)
  }
  if (skillId === 88 || skillId === '88' || skillId === 'boneprison' || skillId === 'bone prison') {
    const bp = calculateBonePrisonStats(slvl, synergies as any)
    return { min: bp.hp, max: bp.hp }
  }
  if (skillId === 92 || skillId === '92' || skillId === 'poisonnova' || skillId === 'poison nova') {
    const pn = calculatePoisonNovaDamage(slvl, synergies as any)
    return { min: pn.minDamage, max: pn.maxDamage }
  }
  if (skillId === 93 || skillId === '93' || skillId === 'bonespirit' || skillId === 'bone spirit') {
    return calculateBoneSpiritDamage(slvl, synergies as any)
  }

  const numericSkillId = typeof skillId === 'number' ? skillId : Number(skillId)
  if ([66, 71, 72, 76, 77, 81, 82, 86, 87, 91].includes(numericSkillId)) {
    return { min: 0, max: 0 }
  }
  const def = Number.isFinite(numericSkillId) ? getBatch1SkillDef(numericSkillId) : undefined
  if (!def) {
    if (weaponDamage) {
      const wMin = Number.isFinite(weaponDamage.min) ? Math.max(0, Math.floor(weaponDamage.min)) : 0
      const wMax = Number.isFinite(weaponDamage.max) ? Math.max(0, Math.floor(weaponDamage.max)) : 0
      return { min: wMin, max: wMax }
    }
    return { min: 0, max: 0 }
  }

  const lvl = Number.isFinite(slvl) ? Math.max(1, Math.floor(slvl)) : 1
  let min = def.emin
  let max = def.emax

  // Level bands (Level 2..8: lev1, 9..16: lev2, 17..22: lev3, 23..28: lev4, 29+: lev5)
  if (lvl > 1) {
    const maxElev1 = def.emaxlev1 ?? def.elev1
    const maxElev2 = def.emaxlev2 ?? def.elev2
    const maxElev3 = def.emaxlev3 ?? def.elev3
    const maxElev4 = def.emaxlev4 ?? def.elev4
    const maxElev5 = def.emaxlev5 ?? def.elev5

    const b1 = Math.min(lvl - 1, 7)
    min += b1 * def.elev1
    max += b1 * maxElev1

    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * def.elev2
      max += b2 * maxElev2
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * def.elev3
      max += b3 * maxElev3
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * def.elev4
      max += b4 * maxElev4
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * def.elev5
      max += b5 * maxElev5
    }
  }

  // Precision shift: HitShift 7 = 0.5 (128/256), HitShift 8 = 1.0 (256/256)
  const hitShift = def.hitshift ?? 8
  const shiftMultiplier = 2 ** (hitShift - 8)
  min *= shiftMultiplier
  max *= shiftMultiplier

  // Apply synergy multiplier
  const syn = typeof synergies === 'number' && Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  min = Math.floor(min * syn)
  max = Math.floor(max * syn)

  // Weapon damage scaling via SrcDam (128 = 100% weapon damage)
  if (weaponDamage && def.srcDamage > 0) {
    const wpnMult = def.srcDamage / 128.0
    const wMin = Number.isFinite(weaponDamage.min) ? Math.max(0, Math.floor(weaponDamage.min)) : 0
    const wMax = Number.isFinite(weaponDamage.max) ? Math.max(0, Math.floor(weaponDamage.max)) : 0
    min += Math.floor(wMin * wpnMult)
    max += Math.floor(wMax * wpnMult)
  }

  return { min, max }
}

/**
 * Calculates Blizzard (Skill 59) synergy multiplier:
 * +5% damage per hard point in Ice Bolt (39), Ice Blast (45), and Glacial Spike (55).
 */
export function calculateBlizzardSynergyMultiplier(synergies: {
  readonly iceBolt?: number | undefined
  readonly iceBlast?: number | undefined
  readonly glacialSpike?: number | undefined
}): number {
  const points = (synergies.iceBolt ?? 0) + (synergies.iceBlast ?? 0) + (synergies.glacialSpike ?? 0)
  return 1.0 + points * 0.05
}

/**
 * Calculates Blizzard (Skill 59) min and max damage with 1.13c 5-band level scaling and synergies.
 */
export function calculateBlizzardDamage(
  effectiveLevel: number,
  synergies: {
    readonly iceBolt?: number | undefined
    readonly iceBlast?: number | undefined
    readonly glacialSpike?: number | undefined
  } | number = {},
): { min: number; max: number } {
  let syn = 1.0
  if (typeof synergies === 'number') {
    syn = Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  } else if (synergies && typeof synergies === 'object') {
    syn = calculateBlizzardSynergyMultiplier(synergies)
  }
  const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
  let min = 45
  let max = 75
  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    min += b1 * 15
    max += b1 * 16

    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * 30
      max += b2 * 31
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * 45
      max += b3 * 46
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * 55
      max += b4 * 56
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * 65
      max += b5 * 66
    }
  }
  return {
    min: Math.floor(min * syn),
    max: Math.floor(max * syn),
  }
}

/**
 * Calculates Meteor (Skill 56) synergy multiplier:
 * +5% fire damage per hard point in Fire Bolt (36) and Fire Ball (47).
 * Fire Mastery (61): +30% base, +7%/lvl if present.
 */
export function calculateMeteorSynergyMultiplier(synergies: {
  readonly fireBolt?: number | undefined
  readonly fireBall?: number | undefined
  readonly fireMastery?: number | undefined
}): number {
  const points = (synergies.fireBolt ?? 0) + (synergies.fireBall ?? 0)
  const synPct = points * 5 // +5% per hard point
  const masteryPct = synergies.fireMastery && synergies.fireMastery > 0
    ? 30 + (synergies.fireMastery - 1) * 7 // Fire Mastery: +30% base, +7%/lvl
    : 0
  return (1.0 + synPct / 100) * (1.0 + masteryPct / 100)
}

/**
 * Calculates Meteor (Skill 56) primary detonation fire damage with 1.13c 5-band level scaling and synergies.
 * Base: 80 - 100
 * 5 bands: [23, 39, 79, 81, 83] min / [25, 41, 81, 83, 85] max.
 */
export function calculateMeteorDamage(
  effectiveLevel: number,
  synergies: {
    readonly fireBolt?: number | undefined
    readonly fireBall?: number | undefined
    readonly fireMastery?: number | undefined
  } | number = {},
): { min: number; max: number } {
  let syn = 1.0
  if (typeof synergies === 'number') {
    syn = Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  } else if (synergies && typeof synergies === 'object') {
    syn = calculateMeteorSynergyMultiplier(synergies)
  }

  const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
  let min = 80
  let max = 100

  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    min += b1 * 23
    max += b1 * 25

    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * 39
      max += b2 * 41
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * 79
      max += b3 * 81
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * 81
      max += b4 * 83
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * 83
      max += b5 * 85
    }
  }

  return {
    min: Math.floor(min * syn),
    max: Math.floor(max * syn),
  }
}

/**
 * Calculates Meteor residual ground fire (meteorfire, ID 240) periodic damage.
 * 1.13c Ground Truth:
 * - Base: 15 - 25
 * - 5 bands: [4, 5, 6, 6, 6] min/max
 * - Synergies: +3% per hard point of Inferno (41); Fire Mastery (61) applies.
 * - HitShift: 3 (8/256 internal precision per tick).
 * - Per-second multiplier: 25 * 8 / 256 = 200 / 256 = 0.78125.
 */
export function calculateMeteorResidualFireDamage(
  effectiveLevel: number,
  synergies: {
    readonly inferno?: number | undefined
    readonly fireMastery?: number | undefined
  } | number = {},
): {
  min: number
  max: number
  perSecMin: number
  perSecMax: number
} {
  let syn = 1.0
  if (typeof synergies === 'number') {
    syn = Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  } else if (synergies && typeof synergies === 'object') {
    const infernoPts = synergies.inferno ?? 0
    const infernoPct = infernoPts * 3 // +3% per point
    const masteryPct = synergies.fireMastery && synergies.fireMastery > 0
      ? 30 + (synergies.fireMastery - 1) * 7
      : 0
    syn = (1.0 + infernoPct / 100) * (1.0 + masteryPct / 100)
  }

  const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
  let min = 15
  let max = 25

  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    min += b1 * 4
    max += b1 * 4

    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * 5
      max += b2 * 5
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * 6
      max += b3 * 6
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * 6
      max += b4 * 6
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * 6
      max += b5 * 6
    }
  }

  const rawMin = Math.floor(min * syn)
  const rawMax = Math.floor(max * syn)

  // In 1.13c HitShift is 3 (8/256) at 25 fps: per-second multiplier is 200/256 = 0.78125
  const perSecMin = Math.floor((rawMin * 200) / 256)
  const perSecMax = Math.floor((rawMax * 200) / 256)

  return {
    min: rawMin,
    max: rawMax,
    perSecMin,
    perSecMax,
  }
}

/**
 * Calculates Meteor detailed damage profile including impact fire, optional physical split,
 * and residual ground fire damage per second.
 */
export function calculateMeteorDetailedDamage(
  effectiveLevel: number,
  synergies: {
    readonly fireBolt?: number | undefined
    readonly fireBall?: number | undefined
    readonly fireMastery?: number | undefined
    readonly inferno?: number | undefined
  } = {},
  options?: { readonly physRatio?: number | undefined }
): {
  impactFire: { min: number; max: number }
  impactPhys: { min: number; max: number }
  residualFire: { min: number; max: number; perSecMin: number; perSecMax: number }
} {
  const det = calculateMeteorDamage(effectiveLevel, synergies)
  const physRatio = Math.max(0, Math.min(1, options?.physRatio ?? 0)) // 0 in vanilla 1.13c
  const fireRatio = 1.0 - physRatio

  const impactFire = {
    min: Math.floor(det.min * fireRatio),
    max: Math.floor(det.max * fireRatio),
  }
  const impactPhys = {
    min: Math.floor(det.min * physRatio),
    max: Math.floor(det.max * physRatio),
  }
  const residualFire = calculateMeteorResidualFireDamage(effectiveLevel, synergies)

  return {
    impactFire,
    impactPhys,
    residualFire,
  }
}

/**
 * Calculates Hydra (Skill 62) synergy multiplier:
 * +3% fire damage per hard point in Fire Bolt (36) and Fire Ball (47).
 */
function calculateHydraSynergyMultiplier(synergies: {
  readonly fireBolt?: number | undefined
  readonly fireBall?: number | undefined
  readonly fireMastery?: number | undefined
} | number = {}): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  }
  const points = (synergies.fireBolt ?? 0) + (synergies.fireBall ?? 0)
  return 1.0 + points * 0.03
}

/**
 * Calculates Hydra (Skill 62) min and max damage with 1.13c 5-band level scaling and synergies.
 * 1.13c Ground Truth:
 * - EMin: 28, EMax: 39
 * - 5 bands: elev = [11, 15, 19, 23, 27], emaxlev = [13, 17, 21, 25, 29]
 * - HitShift: 7 (factor = 0.5)
 * - Synergies: +3% per hard point of Fire Bolt (36) and Fire Ball (47).
 */
function calculateHydraDamage(
  effectiveLevel: number,
  synergies: {
    readonly fireBolt?: number | undefined
    readonly fireBall?: number | undefined
    readonly fireMastery?: number | undefined
  } | number = {},
): { min: number; max: number } {
  let syn = 1.0
  if (typeof synergies === 'number') {
    syn = Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  } else if (synergies && typeof synergies === 'object') {
    syn = calculateHydraSynergyMultiplier(synergies)
  }
  const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
  let min = 28
  let max = 39

  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    min += b1 * 11
    max += b1 * 13

    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * 15
      max += b2 * 17
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * 19
      max += b3 * 21
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * 23
      max += b4 * 25
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * 27
      max += b5 * 29
    }
  }

  // HitShift 7 = 0.5 (128/256 precision)
  min *= 0.5
  max *= 0.5

  return {
    min: Math.floor(min * syn),
    max: Math.floor(max * syn),
  }
}

/**
 * Calculates Fire Ball (Skill 47) synergy multiplier:
 * +14% fire damage per hard point in Fire Bolt (36) and Meteor (56).
 * Fire Mastery (61): +30% base, +7%/lvl if present.
 */
function calculateFireBallSynergyMultiplier(synergies: {
  readonly fireBolt?: number | undefined
  readonly meteor?: number | undefined
  readonly fireMastery?: number | undefined
} | number = {}): number {
  if (typeof synergies === 'number') {
    return Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  }
  const points = (synergies.fireBolt ?? 0) + (synergies.meteor ?? 0)
  const synPct = points * 14 // +14% per hard point
  const masteryPct = synergies.fireMastery && synergies.fireMastery > 0
    ? 30 + (synergies.fireMastery - 1) * 7 // Fire Mastery: +30% base, +7%/lvl
    : 0
  return (1.0 + synPct / 100) * (1.0 + masteryPct / 100)
}

/**
 * Calculates Fire Ball (Skill 47) min and max damage with 1.13c 5-band level scaling and synergies.
 * 1.13c Ground Truth (`Skills.txt` row 47):
 * - EMin: 12, EMax: 28
 * - 5 bands: elev = [13, 23, 28, 33, 38], emaxlev = [15, 25, 30, 35, 40]
 * - HitShift: 7 (factor = 0.5)
 * - Synergies: +14% per hard point in Fire Bolt (36) and Meteor (56).
 */
function calculateFireBallDamage(
  effectiveLevel: number,
  synergies: {
    readonly fireBolt?: number | undefined
    readonly meteor?: number | undefined
    readonly fireMastery?: number | undefined
  } | number = {},
): { min: number; max: number } {
  let syn = 1.0
  if (typeof synergies === 'number') {
    syn = Number.isFinite(synergies) && synergies > 0 ? synergies : 1.0
  } else if (synergies && typeof synergies === 'object') {
    syn = calculateFireBallSynergyMultiplier(synergies)
  }

  const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
  let min = 12
  let max = 28

  if (lvl > 1) {
    const b1 = Math.min(lvl - 1, 7)
    min += b1 * 13
    max += b1 * 15

    if (lvl > 8) {
      const b2 = Math.min(lvl - 8, 8)
      min += b2 * 23
      max += b2 * 25
    }
    if (lvl > 16) {
      const b3 = Math.min(lvl - 16, 6)
      min += b3 * 28
      max += b3 * 30
    }
    if (lvl > 22) {
      const b4 = Math.min(lvl - 22, 6)
      min += b4 * 33
      max += b4 * 35
    }
    if (lvl > 28) {
      const b5 = lvl - 28
      min += b5 * 38
      max += b5 * 40
    }
  }

  min *= 0.5
  max *= 0.5

  return {
    min: Math.floor(min * syn),
    max: Math.floor(max * syn),
  }
}

/** Result of executing a Batch 1 skill. */
export type SkillExecutionResult =
  | { readonly kind: 'cooldown'; readonly ticksLeft: number }
  | { readonly kind: 'mana'; readonly cost: number; readonly currentMana: number }
  | {
      readonly kind: 'projectile'
      readonly skillId: number
      readonly skillName: string
      readonly projectile: Projectile
      readonly manaCost: number
      readonly cooldownTicks: number
      readonly damage: { min: number; max: number }
    }
  | {
      readonly kind: 'melee'
      readonly skillId: number
      readonly skillName: string
      readonly damage: { min: number; max: number }
      readonly manaCost: number
      readonly cooldownTicks: number
      readonly hits: number
      readonly knockback: boolean
      readonly autoHit: boolean
      readonly selfDamagePct?: number | undefined
    }
  | {
      readonly kind: 'area'
      readonly skillId: number
      readonly skillName: string
      readonly radius: number
      readonly damage: { min: number; max: number }
      readonly manaCost: number
      readonly cooldownTicks: number
    }
  | {
      readonly kind: 'buff'
      readonly skillId: number
      readonly skillName: string
      readonly durationSeconds: number
      readonly manaCost: number
      readonly cooldownTicks: number
      readonly buffEffect: Readonly<Record<string, number>>
    }
  | {
      readonly kind: 'curse'
      readonly skillId: number
      readonly skillName: string
      readonly radius: number
      readonly durationSeconds: number
      readonly manaCost: number
      readonly cooldownTicks: number
      readonly debuffEffect: Readonly<Record<string, number>>
    }
  | {
      readonly kind: 'movement'
      readonly skillId: number
      readonly skillName: string
      readonly destination: { readonly x: number; readonly y: number }
      readonly manaCost: number
      readonly cooldownTicks: number
    }
  | {
      readonly kind: 'summon'
      readonly skillId: number
      readonly skillName: string
      readonly summonType: string
      readonly manaCost: number
      readonly cooldownTicks: number
      readonly count: number
    }
  | {
      readonly kind: 'aura'
      readonly skillId: number
      readonly skillName: string
      readonly radius: number
      readonly manaCost: number
      readonly cooldownTicks: number
      readonly auraBonusPct: number
    }
  | {
      readonly kind: 'passive'
      readonly skillId: number
      readonly skillName: string
      readonly passiveBonus: Readonly<Record<string, number>>
    }

/**
 * Executes combat mechanics for any of the Batch 1 essential combat skills across all 7 classes.
 * Enforces resource checks (cooldown, mana) and produces typed execution outcomes (projectile,
 * melee, area, buff, curse, movement, summon, aura, passive).
 */
export function executeSkill(
  skillId: number,
  context: SkillExecutionContext,
  options?: {
    readonly rng?: Rng
    readonly weaponDamage?: { min: number; max: number }
    readonly deductResources?: boolean
  }
): SkillExecutionResult {
  const def = getBatch1SkillDef(skillId)
  if (!def) {
    return {
      kind: 'melee',
      skillId,
      skillName: 'Unknown',
      damage: options?.weaponDamage
        ? { min: Math.max(0, options.weaponDamage.min), max: Math.max(0, options.weaponDamage.max) }
        : { min: 0, max: 0 },
      manaCost: 0,
      cooldownTicks: 0,
      hits: 1,
      knockback: false,
      autoHit: false,
    }
  }

  const { caster, target, skillLevel } = context
  const synergyMultiplier = context.synergyMultiplier ?? 1.0
  const cooldownLeft = caster.cooldown ?? 0
  if (cooldownLeft > 0 && def.delay > 0) {
    return { kind: 'cooldown', ticksLeft: cooldownLeft }
  }

  const manaCost = getSkillManaCost(skillId, skillLevel)
  const currentMana = Number.isFinite(caster.mana) ? caster.mana! : 0
  if (currentMana < manaCost) {
    return { kind: 'mana', cost: manaCost, currentMana }
  }

  const damage = calculateSkillDamage(skillId, skillLevel, synergyMultiplier, options?.weaponDamage)
  const cooldownTicks = def.delay

  if (options?.deductResources !== false) {
    caster.mana = Math.max(0, currentMana - manaCost)
    if (cooldownTicks > 0) {
      caster.cooldown = Math.max(caster.cooldown ?? 0, cooldownTicks)
    }
  }

  const facing = caster.facing ?? 0
  const vector = FACING_VECTORS[facing] ?? FACING_VECTORS[0]!
  let dx = vector[0]
  let dy = vector[1]
  if (target !== undefined) {
    const tdx = target.x - caster.x
    const tdy = target.y - caster.y
    const len = Math.hypot(tdx, tdy)
    if (len > 0) {
      dx = tdx / len
      dy = tdy / len
    }
  }

  switch (def.type) {
    case 'projectile': {
      const speed = def.speed ?? 450
      const range = def.range ?? 400
      const perTick = speed / 25
      const ttl = Math.max(1, Math.round(range / perTick))
      const projDamage = options?.rng
        ? options.rng.int(damage.min, Math.max(damage.min, damage.max))
        : Math.round((damage.min + damage.max) / 2)
      const projectile: Projectile = {
        skillId: String(skillId),
        x: caster.x,
        y: caster.y,
        vx: dx * perTick,
        vy: dy * perTick,
        damage: projDamage,
        ttl,
        fromPlayer: true,
      }
      return {
        kind: 'projectile',
        skillId,
        skillName: def.name,
        projectile,
        manaCost,
        cooldownTicks,
        damage,
      }
    }

    case 'melee': {
      let hits = 1
      let knockback = false
      let autoHit = false
      let selfDamagePct: number | undefined

      if (skillId === 10) hits = 3 // Jab: 3 strikes
      if (skillId === 106) hits = Math.min(Math.max(1, Math.floor(skillLevel)) + 1, 5) // Zeal: min(lvl+1, 5)
      if (skillId === 133) hits = 2 // Double Swing: 2 hits
      if (skillId === 126) knockback = true // Bash: knockback
      if (skillId === 97) { autoHit = true; knockback = true } // Smite: 100% hit, knockback
      if (skillId === 96) selfDamagePct = 8 // Sacrifice: 8% self-damage

      return {
        kind: 'melee',
        skillId,
        skillName: def.name,
        damage,
        manaCost,
        cooldownTicks,
        hits,
        knockback,
        autoHit,
        selfDamagePct,
      }
    }

    case 'area': {
      const radius = skillId === 44 ? 240 : skillId === 74 ? 80 + 20 * (skillLevel - 1) : 120
      return {
        kind: 'area',
        skillId,
        skillName: def.name,
        radius,
        damage,
        manaCost,
        cooldownTicks,
      }
    }

    case 'buff': {
      const durationSeconds = skillId === 258 ? 120 + 12 * (skillLevel - 1) : skillId === 138 ? 20 + 10 * (skillLevel - 1) : 40
      const buffEffect: Record<string, number> = {}
      if (skillId === 68) buffEffect.damageAbsorption = 20 + 10 * (skillLevel - 1) // Bone Armor
      if (skillId === 138) buffEffect.defensePct = 100 + 10 * (skillLevel - 1) // Shout
      if (skillId === 258) {
        buffEffect.attackSpeedPct = 20 + 2 * (skillLevel - 1) // Burst of Speed
        buffEffect.walkRunSpeedPct = 20 + 3 * (skillLevel - 1)
      }
      if (skillId === 223) {
        buffEffect.werewolfLifePct = 25 // 1.13c Werewolf par3 = 25% Max HP
        buffEffect.staminaPct = 25 // par4 = 25% Max Stamina
        buffEffect.attackSpeedPct = Math.floor((110 * skillLevel) / (skillLevel + 6) * (80 - 10) / 100) + 10 // dm(10, 80, slvl)
        buffEffect.toHitPct = 50 + 15 * (skillLevel - 1)
      }
      return {
        kind: 'buff',
        skillId,
        skillName: def.name,
        durationSeconds,
        manaCost,
        cooldownTicks,
        buffEffect: Object.freeze(buffEffect),
      }
    }

    case 'curse': {
      const radius = 80 + 20 * (skillLevel - 1)
      const durationSeconds = skillId === 66 ? 8 + 3 * (skillLevel - 1) : 10
      const debuffEffect: Record<string, number> = {}
      if (skillId === 66) debuffEffect.physicalResistPenaltyPct = 100 // Amplify Damage
      if (skillId === 130) debuffEffect.flee = 1 // Howl
      return {
        kind: 'curse',
        skillId,
        skillName: def.name,
        radius,
        durationSeconds,
        manaCost,
        cooldownTicks,
        debuffEffect: Object.freeze(debuffEffect),
      }
    }

    case 'movement': {
      const destination = target ? { x: target.x, y: target.y } : { x: caster.x + dx * 200, y: caster.y + dy * 200 }
      return {
        kind: 'movement',
        skillId,
        skillName: def.name,
        destination,
        manaCost,
        cooldownTicks,
      }
    }

    case 'summon': {
      const summonType = skillId === 70 ? 'skeleton' : skillId === 226 ? 'oak_sage' : 'charged_bolt_sentry'
      return {
        kind: 'summon',
        skillId,
        skillName: def.name,
        summonType,
        manaCost,
        cooldownTicks,
        count: skillId === 70 ? calculateSkeletonMaxCount(skillLevel) : 1,
      }
    }

    case 'aura': {
      const auraBonusPct = 40 + 10 * (skillLevel - 1) // Might
      return {
        kind: 'aura',
        skillId,
        skillName: def.name,
        radius: 200,
        manaCost: 0,
        cooldownTicks: 0,
        auraBonusPct,
      }
    }

    case 'passive': {
      const passiveBonus: Record<string, number> = {}
      if (skillId === 37) passiveBonus.manaRegenPct = 30 + 12 * (skillLevel - 1) // Warmth
      if (skillId === 224) passiveBonus.shapeshiftLifePct = 20 + 5 * (skillLevel - 1) // Lycanthropy
      if (skillId === 252) passiveBonus.clawDamagePct = 35 + 8 * (skillLevel - 1) // Claw Mastery
      return {
        kind: 'passive',
        skillId,
        skillName: def.name,
        passiveBonus: Object.freeze(passiveBonus),
      }
    }
  }
}

// ============================================================================
// Paladin Combat Skills (Tree 1 - 10 Skills) Standalone 1.13c Formulas
// ============================================================================

/**
 * 1. Sacrifice (96)
 * - %ED: 180 + (slvl - 1) * 15%
 * - AR: 20 + (slvl - 1) * 7%
 * - Synergies: Redemption (+15%/lvl), Fanaticism (+5%/lvl)
 * - Self-damage: strictly 8% of damage dealt
 */
export function calculateSacrificeStats(
  slvl: number,
  synergies?: { redemption?: number; fanaticism?: number },
): { toHitBonusPct: number; damagePct: number; selfDamagePct: number } {
  const lvl = Math.max(1, slvl)
  const toHitBonusPct = 20 + (lvl - 1) * 7
  const baseEd = 180 + (lvl - 1) * 15
  const redemptionBlvl = synergies?.redemption ?? 0
  const fanaticismBlvl = synergies?.fanaticism ?? 0
  const synBonus = redemptionBlvl * 15 + fanaticismBlvl * 5
  return {
    toHitBonusPct,
    damagePct: baseEd + synBonus,
    selfDamagePct: 8,
  }
}

/**
 * 2. Smite (97)
 * - %ED: 15 + (slvl - 1) * 15%
 * - Stun: Math.min(250, 15 + (slvl - 1) * 5) frames
 * - Damage: shield base min/max + Holy Shield flat bonus
 */
export function calculateSmiteStats(
  slvl: number,
  shieldMin: number,
  shieldMax: number,
  holyShieldBonus?: { min: number; max: number },
): { damagePct: number; stunDurationFrames: number; minDamage: number; maxDamage: number } {
  const lvl = Math.max(1, slvl)
  const damagePct = 15 + (lvl - 1) * 15
  const stunDurationFrames = Math.min(250, 15 + (lvl - 1) * 5)
  const hsMin = holyShieldBonus?.min ?? 0
  const hsMax = holyShieldBonus?.max ?? 0
  const minDamage = shieldMin + hsMin
  const maxDamage = shieldMax + hsMax
  return {
    damagePct,
    stunDurationFrames,
    minDamage,
    maxDamage,
  }
}

/**
 * 3. Holy Bolt (101) Magic Damage vs Undead
 * 5-band scaling:
 * EMin: 8, EMinLev: 8, 10, 13, 16, 20
 * EMax: 16, EMaxLev: 8, 11, 15, 18, 23
 * Synergies: Blessed Hammer (+50%/blvl), Fist of the Heavens (+50%/blvl)
 */
export function calculateHolyBoltDamage(
  slvl: number,
  synergies?: { blessedHammer?: number; fistOfTheHeavens?: number },
): { min: number; max: number } {
  const lvl = Math.max(1, slvl)
  let min = 8
  let max = 16

  if (lvl > 1) {
    const b1 = Math.min(lvl, 8) - 1
    min += b1 * 8
    max += b1 * 8
  }
  if (lvl > 8) {
    const b2 = Math.min(lvl, 16) - 8
    min += b2 * 10
    max += b2 * 11
  }
  if (lvl > 16) {
    const b3 = Math.min(lvl, 22) - 16
    min += b3 * 13
    max += b3 * 15
  }
  if (lvl > 22) {
    const b4 = Math.min(lvl, 28) - 22
    min += b4 * 16
    max += b4 * 18
  }
  if (lvl > 28) {
    const b5 = lvl - 28
    min += b5 * 20
    max += b5 * 23
  }

  const bhBlvl = synergies?.blessedHammer ?? 0
  const fohBlvl = synergies?.fistOfTheHeavens ?? 0
  const synBonusPct = (bhBlvl + fohBlvl) * 50
  const minFinal = Math.trunc((min * (100 + synBonusPct)) / 100)
  const maxFinal = Math.trunc((max * (100 + synBonusPct)) / 100)
  return { min: minFinal, max: maxFinal }
}

/**
 * 4. Holy Bolt (101) Friendly Heal
 * Min heal: 1 + (slvl - 1) * 2
 * Max heal: 6 + (slvl - 1) * 4
 * Synergy: Prayer (+15%/blvl)
 */
export function calculateHolyBoltHeal(
  slvl: number,
  prayerBlvl: number = 0,
): { min: number; max: number } {
  const lvl = Math.max(1, slvl)
  const rawMin = 1 + (lvl - 1) * 2
  const rawMax = 6 + (lvl - 1) * 4
  const prayerBonus = prayerBlvl * 15
  const min = Math.trunc((rawMin * (100 + prayerBonus)) / 100)
  const max = Math.trunc((rawMax * (100 + prayerBonus)) / 100)
  return { min, max }
}

/**
 * 5. Zeal (106)
 * - Hits: min(slvl + 1, 5) per par5=2, par6=5 -> min(2 + slvl - 1, 5) = min(slvl + 1, 5) (lvl 1 -> 2, lvl 4+ -> 5)
 * - AR: 10 + (slvl - 1) * 10%
 * - %ED: slvl >= 5 ? (slvl - 4) * 6% : 0
 * - Synergy: Sacrifice (+12%/blvl)
 */
export function calculateZealStats(
  slvl: number,
  synergies?: { sacrifice?: number },
): { hits: number; toHitBonusPct: number; damagePct: number } {
  const lvl = Math.max(1, slvl)
  const hits = Math.min(5, Math.max(2, 1 + lvl))
  const toHitBonusPct = 10 + (lvl - 1) * 10
  const baseEd = lvl >= 5 ? (lvl - 4) * 6 : 0
  const sacBlvl = synergies?.sacrifice ?? 0
  const damagePct = baseEd + sacBlvl * 12
  return { hits, toHitBonusPct, damagePct }
}

/**
 * 6. Charge (107)
 * - AR: 50 + (slvl - 1) * 15%
 * - %ED: 100 + (slvl - 1) * 25%
 * - Synergies: Vigor (+20%/blvl), Might (+20%/blvl)
 * - Speed multiplier: 3.0 (300% base run velocity)
 */
export function calculateChargeStats(
  slvl: number,
  synergies?: { vigor?: number; might?: number },
): { toHitBonusPct: number; damagePct: number; speedMultiplier: number } {
  const lvl = Math.max(1, slvl)
  const toHitBonusPct = 50 + (lvl - 1) * 15
  const baseEd = 100 + (lvl - 1) * 25
  const vigorBlvl = synergies?.vigor ?? 0
  const mightBlvl = synergies?.might ?? 0
  const synBonus = (vigorBlvl + mightBlvl) * 20
  return {
    toHitBonusPct,
    damagePct: baseEd + synBonus,
    speedMultiplier: 3.0,
  }
}

/**
 * 7. Vengeance (111)
 * - AR: 20 + (slvl - 1) * 10%
 * - Base Elemental %: 70 + (slvl - 1) * 6%
 * - Synergies:
 *   - Fire %: + Resist Fire (+10%/blvl) + Salvation (+2%/blvl)
 *   - Cold %: + Resist Cold (+10%/blvl) + Salvation (+2%/blvl)
 *   - Lightning %: + Resist Lightning (+10%/blvl) + Salvation (+2%/blvl)
 * - Cold Chill Duration: 30 + (slvl - 1) * 15 frames (1.2s + 0.6s/lvl)
 */
export function calculateVengeanceStats(
  slvl: number,
  synergies?: {
    resistFire?: number
    resistCold?: number
    resistLightning?: number
    salvation?: number
  },
): {
  toHitBonusPct: number
  firePct: number
  coldPct: number
  ltngPct: number
  chillDurationFrames: number
} {
  const lvl = Math.max(1, slvl)
  const toHitBonusPct = 20 + (lvl - 1) * 10
  const baseElemPct = 70 + (lvl - 1) * 6
  const salvBonus = (synergies?.salvation ?? 0) * 2
  const firePct = baseElemPct + (synergies?.resistFire ?? 0) * 10 + salvBonus
  const coldPct = baseElemPct + (synergies?.resistCold ?? 0) * 10 + salvBonus
  const ltngPct = baseElemPct + (synergies?.resistLightning ?? 0) * 10 + salvBonus
  const chillDurationFrames = 30 + (lvl - 1) * 15
  return {
    toHitBonusPct,
    firePct,
    coldPct,
    ltngPct,
    chillDurationFrames,
  }
}

/**
 * 8. Blessed Hammer (112) Magic Damage
 * 5-band scaling (1.13c Skills.txt):
 * EMin: 12, EMinLev: 8, 10, 12, 13, 14
 * EMax: 16, EMaxLev: 8, 10, 12, 13, 14
 * Synergies: Blessed Aim (+14%/blvl), Vigor (+14%/blvl)
 * Concentration: receives 50% of active Concentration %ED
 */
export function calculateBlessedHammerDamage(
  slvl: number,
  synergies?: { blessedAim?: number; vigor?: number },
  concentrationEd: number = 0,
): { min: number; max: number; concentrationBonusPct: number } {
  const lvl = Math.max(1, slvl)
  const min = computeBand5(lvl, 12, 8, 10, 12, 13, 14)
  const max = computeBand5(lvl, 16, 8, 10, 12, 13, 14)

  const aimBlvl = synergies?.blessedAim ?? 0
  const vigorBlvl = synergies?.vigor ?? 0
  const synBonusPct = (aimBlvl + vigorBlvl) * 14
  const concBonusPct = Math.trunc(concentrationEd / 2)
  const totalMultPct = 100 + synBonusPct

  let minFinal = Math.trunc((min * totalMultPct) / 100)
  let maxFinal = Math.trunc((max * totalMultPct) / 100)

  if (concBonusPct > 0) {
    minFinal = Math.trunc((minFinal * (100 + concBonusPct)) / 100)
    maxFinal = Math.trunc((maxFinal * (100 + concBonusPct)) / 100)
  }

  return { min: minFinal, max: maxFinal, concentrationBonusPct: concBonusPct }
}

/**
 * 9. Conversion (116)
 * - Chance %: dm34 -> computeDiminishingReturns(0, 50, slvl) = floor((110 * slvl * 50) / (100 * (slvl + 6)))
 * - Duration: 400 frames (16.0s)
 */
export function calculateConversionStats(slvl: number): {
  chancePct: number
  durationFrames: number
  durationSeconds: number
} {
  const lvl = Math.max(1, slvl)
  const chancePct = computeDiminishingReturns(0, 50, lvl)
  return {
    chancePct,
    durationFrames: 400,
    durationSeconds: 16,
  }
}

/**
 * 10. Holy Shield (117)
 * - Duration: 750 + (slvl - 1) * 625 frames (30s + 25s/lvl)
 * - Defense %: 25 + (slvl - 1) * 15% + Defiance (+15%/blvl)
 * - Blocking %: 10 + Math.floor((slvl * 40) / (slvl + 10))% (dm56)
 * - Flat Smite Damage: 3 + (slvl - 1) * 4 min / 6 + (slvl - 1) * 4 max (per 1.13c compute5BandScaling on Holy Shield min/maxDam)
 */
export function calculateHolyShieldStats(
  slvl: number,
  defianceBlvl: number = 0,
): {
  durationFrames: number
  defensePct: number
  blockChancePct: number
  smiteMinFlat: number
  smiteMaxFlat: number
} {
  const lvl = Math.max(1, slvl)
  const durationFrames = 750 + (lvl - 1) * 625
  const defensePct = 25 + (lvl - 1) * 15 + defianceBlvl * 15
  const blockChancePct = computeDiminishingReturns(10, 40, lvl)

  // Holy Shield flat smite min/max damage progression (Skills.txt: minDam=3, maxDam=6, levDam1=2..3 etc.)
  // Let's use exact 5-band scaling: minDam=3, lev=2..3, maxDam=6, lev=2..3
  // From 1.13c Skills.txt: minDam=3, minLevDam1=2, minLevDam2=3, minLevDam3=3, minLevDam4=4, minLevDam5=4
  // maxDam=6, maxLevDam1=2, maxLevDam2=3, maxLevDam3=3, maxLevDam4=4, maxLevDam5=4
  let smiteMinFlat = 3
  let smiteMaxFlat = 6
  if (lvl > 1) {
    const b1 = Math.min(lvl, 8) - 1
    smiteMinFlat += b1 * 2
    smiteMaxFlat += b1 * 2
  }
  if (lvl > 8) {
    const b2 = Math.min(lvl, 16) - 8
    smiteMinFlat += b2 * 3
    smiteMaxFlat += b2 * 3
  }
  if (lvl > 16) {
    const b3 = Math.min(lvl, 22) - 16
    smiteMinFlat += b3 * 4
    smiteMaxFlat += b3 * 4
  }
  if (lvl > 22) {
    const b4 = Math.min(lvl, 28) - 22
    smiteMinFlat += b4 * 4
    smiteMaxFlat += b4 * 4
  }
  if (lvl > 28) {
    const b5 = lvl - 28
    smiteMinFlat += b5 * 4
    smiteMaxFlat += b5 * 4
  }

  return {
    durationFrames,
    defensePct,
    blockChancePct,
    smiteMinFlat,
    smiteMaxFlat,
  }
}

/**
 * 11. Fist of the Heavens (121) Celestial Lightning Damage
 * 5-band scaling:
 * EMin: 150, EMinLev: 15, 30, 45, 55, 65
 * EMax: 200, EMaxLev: 15, 30, 45, 55, 65
 * Synergy: Holy Shock (+7%/blvl)
 */
export function calculateFistOfTheHeavensDamage(
  slvl: number,
  synergies?: { holyShock?: number },
): { lightningMin: number; lightningMax: number } {
  const lvl = Math.max(1, slvl)
  let min = 150
  let max = 200

  if (lvl > 1) {
    const b1 = Math.min(lvl, 8) - 1
    min += b1 * 15
    max += b1 * 15
  }
  if (lvl > 8) {
    const b2 = Math.min(lvl, 16) - 8
    min += b2 * 30
    max += b2 * 30
  }
  if (lvl > 16) {
    const b3 = Math.min(lvl, 22) - 16
    min += b3 * 45
    max += b3 * 45
  }
  if (lvl > 22) {
    const b4 = Math.min(lvl, 28) - 22
    min += b4 * 55
    max += b4 * 55
  }
  if (lvl > 28) {
    const b5 = lvl - 28
    min += b5 * 65
    max += b5 * 65
  }

  const holyShockBlvl = synergies?.holyShock ?? 0
  const synBonusPct = holyShockBlvl * 7
  const lightningMin = Math.trunc((min * (100 + synBonusPct)) / 100)
  const lightningMax = Math.trunc((max * (100 + synBonusPct)) / 100)
  return { lightningMin, lightningMax }
}

/**
 * 12. Fist of the Heavens (121) Radial Holy Bolt Damage
 * Base Holy Bolt from FoH (1.13c Missiles.txt #234 fistoftheheavensbolt):
 * EMin: 40, EMinLev: 6, 10, 16, 32, 48
 * EMax: 50, EMaxLev: 6, 10, 16, 32, 48
 * Synergy: Holy Bolt (+15%/blvl)
 */
export function calculateFistOfTheHeavensHolyBoltDamage(
  slvl: number,
  holyBoltBlvl: number = 0,
): { holyBoltMin: number; holyBoltMax: number } {
  const lvl = Math.max(1, slvl)
  const min = computeBand5(lvl, 40, 6, 10, 16, 32, 48)
  const max = computeBand5(lvl, 50, 6, 10, 16, 32, 48)

  const synBonusPct = holyBoltBlvl * 15
  const holyBoltMin = Math.trunc((min * (100 + synBonusPct)) / 100)
  const holyBoltMax = Math.trunc((max * (100 + synBonusPct)) / 100)
  return { holyBoltMin, holyBoltMax }
}

/** Helper 5-band scaling matching D2 1.13c Skills.txt (levels 1, 2..8, 9..16, 17..22, 23..28, 29+) */
function computeBand5(
  lvl: number,
  base: number,
  lev1: number,
  lev2: number,
  lev3: number,
  lev4: number,
  lev5: number,
): number {
  if (lvl <= 0) return 0
  let total = base
  if (lvl > 1) {
    const b1 = Math.min(lvl, 8) - 1
    total += b1 * lev1
  }
  if (lvl > 8) {
    const b2 = Math.min(lvl, 16) - 8
    total += b2 * lev2
  }
  if (lvl > 16) {
    const b3 = Math.min(lvl, 22) - 16
    total += b3 * lev3
  }
  if (lvl > 22) {
    const b4 = Math.min(lvl, 28) - 22
    total += b4 * lev4
  }
  if (lvl > 28) {
    const b5 = lvl - 28
    total += b5 * lev5
  }
  return total
}

/**
 * Compute `D2Common` diminishing-returns formula `dm(a, b, lvl)`:
 * `floor((110 * lvl * (b - a)) / (100 * (lvl + 6))) + a`
 */
function computeDiminishingReturns(a: number, b: number, lvl: number): number {
  if (lvl <= 0) return a
  const num = 110 * lvl * (b - a)
  const den = 100 * (lvl + 6)
  return Math.trunc(num / den) + a
}


// ============================================================================
// PALADIN OFFENSIVE & DEFENSIVE AURAS (20 SKILLS) — Re-exported from shared common module
// ============================================================================

export {
  PALADIN_OFFENSIVE_AURA_IDS,
  PALADIN_DEFENSIVE_AURA_IDS,
  PALADIN_AURA_STATE_BY_SKILL_ID,
  isPaladinAuraSkill,
  calculateMightStats,
  calculateHolyFireStats,
  calculateThornsStats,
  calculateBlessedAimStats,
  calculateConcentrationStats,
  calculateHolyFreezeStats,
  calculateHolyShockStats,
  calculateSanctuaryStats,
  calculateFanaticismStats,
  calculateConvictionStats,
  calculatePrayerStats,
  calculateResistFireStats,
  calculateDefianceStats,
  calculateResistColdStats,
  calculateCleansingStats,
  calculateResistLightningStats,
  calculateVigorStats,
  calculateMeditationStats,
  calculateRedemptionStats,
  calculateSalvationStats,
} from '../../common/skills/paladin-auras.ts'

export * from './assassin-traps.ts'
export { DRUID_TRANSFORM_CLT_OVERLAYS_113C } from './druid-shapeshift.ts'
export { applyEnchantBuff, canCastEnchantOn } from '../ai/monster-ai.ts'

// ============================================================================
// 1.13c Authoritative Skill Caster Dispatcher (castSkill & SkillCastContext)
// ============================================================================

import type { ActorAnimatorLike as ActorAnimator, AnimClipMeta } from "../../common/units/unit-types.ts"
import { damageMonster, type Monster } from "../ai/monster-ai.ts"
import { isBlockedAt, isMissileBlockedAt, subTileToScene, type CollisionGrid } from "../../common/world/d2map.ts"
import type { GameEngine } from "../engine/game-engine.ts"
import { triggerFlippyBounce } from "../../common/items/ground-item-physics.ts"
import type { SceneEntrance, SceneWarp, SceneWaypoint } from "../../common/world/level-links.ts"
import { getLevelNames, levelDisplayName } from "../../common/world/level-names-zh.ts"
import { monsterDisplayName } from "../../common/units/monsters-data.ts"
import {
  MONSTATS2_FLAGINDEX,
  canMonsterTargetBeCursed113c,
  hasMonStats2Flag,
} from "../../common/units/monstats2-flags.ts"
import { isPetTypeUnsummonable113c } from "../../common/units/pet-type-table.ts"
import { isMetalItemCode113c } from "../../common/items/metal-items-113c.ts"
import type { TownPortalSlot } from "../../common/world/portal.ts"
import { calculateConcentrationStats } from "../../common/skills/paladin-auras.ts"
import { compute5BandScaling } from "../../common/data/calc-ast.ts"
import { SKILLS_BY_ID } from "../../common/data/skills-catalog.ts"
import { getTblLang } from "../../common/i18n/lang.ts"
import { getInventoryGoldLimit } from "../../common/items/inventory-model.ts"
import { itemToUiInventoryItem } from "../../common/items/item-bridge.ts"
import { getSkillName as getSkillDisplayName } from "../../common/skills/skills-meta.ts"
import { getSkillPlayerClipMode } from "../../common/skills/skill-anim-modes.ts"
import { TELEKINESIS_RANGE_PX, facingOf, hitTestWarp } from "../../common/world/scene-links-nav.ts"
import type { TownStashEntity } from "../../common/world/scene-population.ts"
import {
  checkAmmunition,
  executeNormalAttack,
  getAttackWeaponInfo,
  getSkillMana,
  getSkillRange,
  isPassiveSkill,
  PASSIVE_SKILL_IDS,
  type AttackWeaponInfo,
  type AttackWeaponInputItem,
  type AttackWeaponKind,
  type AttackWeaponSubtype,
  type HudCombatStateLike,
  type SkillCastOutcome,
  type WeaponCombatContext,
} from "../engine/combat-pipeline.ts"
export {
  checkAmmunition,
  executeNormalAttack,
  getAttackWeaponInfo,
  getSkillMana,
  getSkillRange,
  isPassiveSkill,
  PASSIVE_SKILL_IDS,
  type AttackWeaponInfo,
  type AttackWeaponInputItem,
  type AttackWeaponKind,
  type AttackWeaponSubtype,
  type HudCombatStateLike,
  type SkillCastOutcome,
  type WeaponCombatContext,
}
import { calculateThrowingMasteryStats } from "./barbarian-masteries.ts"
import {
  computeBurstOfSpeedFRW,
  computeBurstOfSpeedIAS,
  computeFadeCurseReduction,
  computeFadePhysicalReduction,
  computeFadeResistances,
  computeMindBlastConversionChance,
  computeMindBlastDamage,
  computeMindBlastStunDuration,
  computePsychicHammerDamage,
  computePsychicHammerKnockbackChance,
  computeShadowMasterResistances,
  computeShadowMaxLife,
  computeShadowMlvl,
  computeShadowWarriorResistances,
  computeVenomPoisonDamage,
  generateShadowEquipment,
} from "./assassin-shadow.ts"
import {
  calculateBashStats,
  calculateLeapStats,
  calculateDoubleSwingStats,
  calculateStunStats,
  calculateDoubleThrowStats,
  calculateLeapAttackStats,
  calculateConcentrateStats,
  calculateFrenzyStats,
  calculateFrenzyStackState,
  calculateWhirlwindStats,
  calculateWhirlwindHitFrames,
  calculateBerserkStats,
} from "./barbarian-combat.ts"
import {
  resolveThrowMissileForItemCode,
} from "../../common/skills/weapon-combat-meta.ts"
import {
  calculateHowlStats,
  calculateFindPotionStats,
  calculateTauntStats,
  calculateShoutStats,
  calculateFindItemStats,
  calculateBattleCryStats,
  calculateBattleOrdersStats,
  calculateGrimWardStats,
  calculateWarCryStats,
  calculateBattleCommandStats,
  rollFindPotionDrop113c,
  validateBarbarianCorpseTarget,
} from "./barbarian-warcries.ts"
import { resolveWeaponBase113c } from "../../common/units/char-anim-speed.ts"
import {
  DRUID_TRANSFORM_CLT_OVERLAYS_113C,
  advanceChargeOrb,
  calculateFeralRageStats,
  calculateFireClawsStats,
  calculateFuryStats,
  calculateHungerStats,
  calculateMaulStats,
  calculateRabiesStats,
  calculateShockWaveStats,
  calculateWerebearStats,
  calculateWerewolfStats,
  canCastDruidSkill,
} from "./druid-shapeshift.ts"
import {
  calculateRavenStats,
  calculatePoisonCreeperStats,
  calculateOakSageStats,
  calculateSummonSpiritWolfStats,
  calculateCarrionVineStats,
  calculateHeartOfWolverineStats,
  calculateSummonDireWolfStats,
  calculateSolarCreeperStats,
  calculateSpiritOfBarbsStats,
  calculateSummonGrizzlyStats,
} from "./druid-summoning.ts"
import {
  evaluateTigerStrikeStats,
  evaluateDragonTalonStats,
  evaluateFistsOfFireStats,
  evaluateDragonClawStats,
  evaluateCobraStrikeStats,
  evaluateClawsOfThunderStats,
  evaluateDragonTailStats,
  evaluateBladesOfIceStats,
  evaluateDragonFlightStats,
  evaluatePhoenixStrikeStats,
  resolveFinisherDischarge,
  type ActiveChargeOrb,
} from "./assassin-martial-arts.ts"
import {
  calcFireBlast113c,
  calcShockWeb113c,
  calcBladeSentinel113c,
  calcChargedBoltSentry113c,
  calcWakeOfFire113c,
  calcBladeFury113c,
  calcLightningSentry113c,
  calcWakeOfInferno113c,
  calcDeathSentry113c,
  calcBladeShield113c,
} from "./assassin-traps.ts"

const JAVELIN_ITEM_CODES = new Set([
  'jav', 'pil', 'ssp', 'glv', 'tsp',
  '9ja', '9pi', '9s9', '9gl', '9ts',
  '7ja', '7pi', '7s7', '7gl', '7ts',
  'am5', 'ama', 'amf',
])

function isJavelinWeaponItem(item: any): boolean {
  if (!item) return false
  const code = String(item.code ?? '').trim().toLowerCase()
  const wb = code ? resolveWeaponBase113c(code) : undefined
  const wbType = String(wb?.type ?? '').trim().toLowerCase()
  if (wbType === 'jave' || wbType === 'ajav') return true
  if (wbType === 'spea' || wbType === 'aspe') return false
  const type = String(item.type ?? '').trim().toLowerCase()
  if (type === 'jave' || type === 'ajav' || type === 'javelin') return true
  if (type === 'spea' || type === 'aspe' || type === 'spear') return false
  if (JAVELIN_ITEM_CODES.has(code)) return true
  const name = String(item.name ?? '').toLowerCase()
  const nameZh = String(item.nameZh ?? '').toLowerCase()
  return /javelin|pilum|glaive|harpoon|simbilan|spiculum|throwing spear|balrog spear|标枪/i.test(name) || /标枪/i.test(nameZh)
}

let hydraGroupSeqCounter = 0
let summonUnitSeqCounter = 0

function resolveCastSkillLevel(
  skillId: number,
  player: any,
  hudManager?: HudCombatStateLike | null,
  engine?: GameEngine | null,
): number {
  const fromHud =
    typeof (hudManager as any)?.getSkillLevel === 'function'
      ? Number((hudManager as any).getSkillLevel(skillId))
      : typeof (hudManager as any)?.skillLevels?.[skillId] === 'number'
        ? Number((hudManager as any).skillLevels[skillId])
        : 0
  if (Number.isFinite(fromHud) && fromHud > 0) return Math.max(1, Math.floor(fromHud))

  const fromPlayer =
    typeof player?.skills?.get === 'function'
      ? Number(player.skills.get(skillId))
      : typeof player?.skillLevels?.[skillId] === 'number'
        ? Number(player.skillLevels[skillId])
        : typeof player?.skills?.[skillId] === 'number'
          ? Number(player.skills[skillId])
          : typeof player?.combatContext?.statList?.getEffectiveSkillLevel === 'function'
            ? Number(player.combatContext.statList.getEffectiveSkillLevel(skillId))
            : 0
  if (Number.isFinite(fromPlayer) && fromPlayer > 0) return Math.max(1, Math.floor(fromPlayer))

  const fromEngine =
    typeof (engine as any)?.skillPoints?.get === 'function'
      ? Number((engine as any).skillPoints.get(skillId))
      : typeof (engine as any)?.getSkillLevel === 'function'
        ? Number((engine as any).getSkillLevel(skillId))
        : 0
  if (Number.isFinite(fromEngine) && fromEngine > 0) return Math.max(1, Math.floor(fromEngine))

  return 1
}

function resolveBaseSkillLevel(
  skillId: number,
  player: any,
  hudManager?: HudCombatStateLike | null,
  engine?: GameEngine | null,
): number {
  const fromHudBase =
    typeof (hudManager as any)?.getBaseSkillLevel === 'function'
      ? Number((hudManager as any).getBaseSkillLevel(skillId))
      : typeof (hudManager as any)?.baseSkillLevels?.[skillId] === 'number'
        ? Number((hudManager as any).baseSkillLevels[skillId])
        : typeof (hudManager as any)?.getSkillLevel === 'function'
          ? Number((hudManager as any).getSkillLevel(skillId))
          : typeof (hudManager as any)?.skillLevels?.[skillId] === 'number'
            ? Number((hudManager as any).skillLevels[skillId])
            : 0
  if (Number.isFinite(fromHudBase) && fromHudBase > 0) return Math.max(0, Math.floor(fromHudBase))

  const fromPlayerBase =
    typeof player?.combatContext?.statList?.getBaseSkillLevel === 'function'
      ? Number(player.combatContext.statList.getBaseSkillLevel(skillId))
      : typeof player?.baseSkillLevels?.[skillId] === 'number'
        ? Number(player.baseSkillLevels[skillId])
        : typeof player?.skills?.get === 'function'
          ? Number(player.skills.get(skillId))
          : typeof player?.skillLevels?.[skillId] === 'number'
            ? Number(player.skillLevels[skillId])
            : typeof player?.skills?.[skillId] === 'number'
              ? Number(player.skills[skillId])
              : 0
  if (Number.isFinite(fromPlayerBase) && fromPlayerBase > 0) return Math.max(0, Math.floor(fromPlayerBase))

  const fromEngine =
    typeof (engine as any)?.skillPoints?.get === 'function'
      ? Number((engine as any).skillPoints.get(skillId))
      : typeof (engine as any)?.getSkillLevel === 'function'
        ? Number((engine as any).getSkillLevel(skillId))
        : 0
  if (Number.isFinite(fromEngine) && fromEngine > 0) return Math.max(0, Math.floor(fromEngine))

  return 0
}

function resolveLearnedEffectiveSkillLevel(
  skillId: number,
  player: any,
  hudManager?: HudCombatStateLike | null,
  engine?: GameEngine | null,
): number {
  const baseLvl = resolveBaseSkillLevel(skillId, player, hudManager, engine)
  if (baseLvl <= 0) return 0
  return Math.max(baseLvl, resolveCastSkillLevel(skillId, player, hudManager, engine))
}

function computeCastSkillDamage(
  skillId: number,
  slvl: number,
  weaponInfo?: { readonly kind?: string; readonly damageMin: number; readonly damageMax: number } | null,
): number {
  const lvl = Math.max(1, Math.floor(slvl || 1))
  if (skillId === 130 || skillId === 138 || skillId === 146 || skillId === 149 || skillId === 155) {
    return 0
  }
  const weaponDamage =
    weaponInfo && weaponInfo.kind && weaponInfo.kind !== 'unarmed'
      ? { min: Math.max(1, weaponInfo.damageMin), max: Math.max(2, weaponInfo.damageMax) }
      : { min: Math.max(12, weaponInfo?.damageMin ?? 12), max: Math.max(20, weaponInfo?.damageMax ?? 20) }

  if (skillId === 101) {
    const hb = calculateHolyBoltDamage(lvl)
    return Math.max(1, Math.round((hb.min + hb.max) / 2))
  }
  if (skillId === 112) {
    const bh = calculateBlessedHammerDamage(lvl)
    return Math.max(1, Math.round((bh.min + bh.max) / 2))
  }
  if (skillId === 121) {
    const foh = calculateFistOfTheHeavensDamage(lvl)
    return Math.max(1, Math.round((foh.lightningMin + foh.lightningMax) / 2))
  }

  if (skillId >= 6 && skillId <= 95) {
    const calc = calculateSkillDamage(skillId, lvl, 1.0, weaponDamage)
    if (calc.min > 0 || calc.max > 0) {
      return Math.max(1, Math.round((calc.min + calc.max) / 2))
    }
  }

  const entry = SKILLS_BY_ID[skillId]
  if (entry) {
    const hs = entry.hitshift ?? 8
    const shiftMult = 2 ** (hs - 8)
    const frameMult = hs < 6 ? 25 : 1
    const [pL1 = 0, pL2 = 0, pL3 = 0, pL4 = 0, pL5 = 0] = entry.minLevDam
    const [pM1 = pL1, pM2 = pL2, pM3 = pL3, pM4 = pL4, pM5 = pL5] = entry.maxLevDam
    const [eL1 = 0, eL2 = 0, eL3 = 0, eL4 = 0, eL5 = 0] = entry.eMinLev
    const [eM1 = eL1, eM2 = eL2, eM3 = eL3, eM4 = eL4, eM5 = eL5] = entry.eMaxLev

    const pMin = compute5BandScaling(lvl, entry.minDam, pL1, pL2, pL3, pL4, pL5) * shiftMult * frameMult
    const pMax = compute5BandScaling(lvl, entry.maxDam, pM1, pM2, pM3, pM4, pM5) * shiftMult * frameMult
    const eMin = compute5BandScaling(lvl, entry.eMin, eL1, eL2, eL3, eL4, eL5) * shiftMult * frameMult
    const eMax = compute5BandScaling(lvl, entry.eMax, eM1, eM2, eM3, eM4, eM5) * shiftMult * frameMult

    const wMult = entry.srcDamage > 0 ? entry.srcDamage / 128 : 0
    const wMin = weaponDamage.min * wMult
    const wMax = weaponDamage.max * wMult

    const totalMin = pMin + eMin + wMin
    const totalMax = pMax + eMax + wMax
    if (totalMin > 0 || totalMax > 0) {
      return Math.max(1, Math.round((totalMin + totalMax) / 2))
    }
  }

  if (isBatch1Skill(skillId)) {
    const calc = calculateSkillDamage(skillId, lvl, 1.0, weaponDamage)
    if (calc.min > 0 || calc.max > 0) {
      return Math.max(1, Math.round((calc.min + calc.max) / 2))
    }
  }

  return Math.max(1, Math.round((weaponDamage.min + weaponDamage.max) / 2))
}

/** Scene-space pick radius for Unsummon's targeted pet (same metric as the corpse pick of 70/80/95). */
const UNSUMMON_PICK_RADIUS = 80

/**
 * Scene Unsummon (#3): remove and return the caster's own pet nearest `(x, y)` whose PetType.txt row has
 * `unsummon = 1` (SKILLS_SrvSt03_Unsummon 0x6FCBFEF0), or `null` when no such pet is under the cursor.
 */
export function unsummonOwnPetAt(player: any, x: number, y: number): { petType: string; uid: string } | null {
  const summons: any[] = Array.isArray(player?.summons) ? player.summons : []
  let bestIdx = -1
  let bestDist = UNSUMMON_PICK_RADIUS
  summons.forEach((s, idx) => {
    if (!s || s.alive === false || typeof s.petType !== 'string') return
    if (!isPetTypeUnsummonable113c(s.petType)) return
    const d = Math.hypot((s.x ?? 0) - x, ((s.y ?? 0) - y) / ISO_GROUND_ASPECT_RATIO)
    if (d <= bestDist) {
      bestDist = d
      bestIdx = idx
    }
  })
  if (bestIdx < 0) return null
  const [pet] = summons.splice(bestIdx, 1)
  if (pet?.petType === 'totem') {
    const sb = (player as any)?.combatContext?.stateBus
    if (sb && typeof sb.removeState === 'function') {
      sb.removeState('oaksage')
      sb.removeState('wolverine')
      sb.removeState('barbs')
    }
    ;(player as any).activeDruidTotemAura = undefined
  }
  return { petType: String(pet.petType), uid: String(pet.uid ?? pet.id) }
}

function registerCastSummon(params: {
  readonly engine: GameEngine
  readonly player: any
  readonly hudManager?: HudCombatStateLike | null
  readonly skillId: number
  readonly slvl: number
  readonly x: number
  readonly y: number
  readonly petType: string
  readonly petGroup: number
  readonly maxPets: number
  readonly hp: number
  readonly kind: string
  readonly lifespanTicks?: number | undefined
  readonly corpses?: any[] | undefined
  readonly extra?: Readonly<Record<string, any>> | undefined
  /** MonStats.txt `Id` of the summoned unit; Revive (#95) passes the corpse's own Id (SKILLS_SrvDo058 keeps classId). */
  readonly monId?: string | undefined
}): void {
  const { engine, player, hudManager, skillId, slvl, x, y, petType, petGroup, maxPets, hp, kind, lifespanTicks, corpses, extra } = params
  const monId = params.monId ?? kind
  if ((engine as any).summonManager && typeof (engine as any).summonManager.createPet === 'function') {
    const ownerCtx = (player as any).combatContext ?? {
      id: 'player',
      charClass: (player as any).charClass,
      classId: (player as any).classId,
      statList: {
        getMaxHp256: () => (player.maxHp ?? player.hp ?? 100) * 256,
        getHp256: () => (player.hp ?? 100) * 256,
        setHp256: (v: number) => {
          player.hp = Math.max(1, Math.floor(v / 256))
        },
        getAccruedStat: (stat: string) =>
          stat === 'armorclass' ? ((player as any).defense ?? 50) : stat === 'level' ? (player.level ?? 1) : 0,
        getBaseSkillLevel: (id: number) => resolveBaseSkillLevel(id, player, hudManager, engine),
        getEffectiveSkillLevel: (id: number) => resolveLearnedEffectiveSkillLevel(id, player, hudManager, engine),
      },
    }
    ;(engine as any).summonManager.createPet({
      owner: ownerCtx,
      skillId,
      slvl,
      x,
      y,
      ...(corpses ? { corpses } : {}),
    })
  }

  if (!Array.isArray((player as any).summons)) {
    ;(player as any).summons = []
  }
  const summons: any[] = (player as any).summons
  const isGolem = [75, 85, 90, 94].includes(skillId)
  if (petGroup > 0) {
    for (let i = summons.length - 1; i >= 0; i--) {
      const existing = summons[i]
      const existingIsGolem = [75, 85, 90, 94].includes(Number(existing?.skillId ?? existing?.sourceSkillId ?? 0))
      if (
        existing &&
        existing.petGroup === petGroup &&
        existingIsGolem === isGolem &&
        (existing.petType !== petType || isGolem)
      ) {
        summons.splice(i, 1)
      }
    }
  }
  const sameType = summons.filter(s => s && s.petType === petType)
  while (sameType.length >= Math.max(1, maxPets)) {
    const oldest = sameType.shift()
    const idx = summons.indexOf(oldest)
    if (idx !== -1) summons.splice(idx, 1)
  }
  summonUnitSeqCounter += 1
  const uid = `summon-${String(skillId)}-${String(summonUnitSeqCounter)}`
  const unit = {
    uid,
    id: uid,
    skillId,
    sourceSkillId: skillId,
    slvl,
    petType,
    petGroup,
    kind,
    monId,
    x,
    y,
    hp: Math.max(1, Math.round(hp)),
    maxHp: Math.max(1, Math.round(hp)),
    alive: true,
    ...(lifespanTicks !== undefined ? { lifespanTicks } : {}),
    ...(extra ?? {}),
  }
  summons.push(unit)
  ;(engine.world as any).summons = summons
}

export interface SkillCastRuntimeLike {
  readonly level: string
  readonly levelId: number
  readonly act: number
  readonly grid: CollisionGrid
  readonly waypoints?: readonly SceneWaypoint[]
  readonly stashes?: readonly TownStashEntity[]
  readonly warps?: readonly SceneWarp[]
  readonly entrances?: readonly SceneEntrance[]
}

export interface SkillCastCharacterLike {
  readonly clips?: Readonly<Record<string, AnimClipMeta>>
}

export interface SkillCastContext {
  engine: GameEngine
  runtime: SkillCastRuntimeLike
  hudManager: HudCombatStateLike | null
  status: { textContent: string | null }
  playerAnimator?: ActorAnimator | undefined
  character?: SkillCastCharacterLike | null | undefined
  equippedWeapon?: any | null | undefined
  equippedAmmo?: any | null | undefined
  hasAmmo?: boolean | undefined
  waypointNetwork?: any | undefined
  openStash?: ((stash: any) => void) | undefined
  portalSlot?: TownPortalSlot | undefined
  onEnterPortal?: (() => void) | undefined
  onCastTownPortal?: (() => boolean) | undefined
  onEnterWarp?: ((warp: SceneWarp) => void) | undefined
  onEnterEntrance?: ((entrance: SceneEntrance) => void) | undefined
  onInventoryFullFeedback?: (() => void) | undefined
  onNotify?: ((msg: string) => void) | undefined
}

export type SkillCastRuntime = SkillCastRuntimeLike
export type SkillCastHudAdapter = HudCombatStateLike
export type StatusSink = { textContent: string | null }
export type SkillCastBackendContext = Omit<SkillCastContext, 'status'> & { status?: StatusSink | null }

function castSceneSkill113c(
  skillId: number,
  targetX: number,
  targetY: number,
  context: SkillCastContext,
): boolean {
  const { engine, runtime, hudManager, status, playerAnimator, character } = context
  const player = engine.world.player
  const isEn = (hudManager?.lang ?? getTblLang()) === 'ENG'
  const globalBag = globalThis as Record<string, any>

  // 1. Cooldown check
  if (player.cooldown > 0) {
    return false
  }

  // 1a. Druid Shape-Shifting form restriction check (1.13c Skills.txt restrict & State1..3):
  // - restrict = 2: #232 Feral Rage, #238 Rabies, #248 Fury require Werewolf ('wolf');
  //   #233 Maul, #243 Shock Wave require Werebear ('bear');
  //   #239 Fire Claws, #242 Hunger require Werewolf or Werebear ('wolf' | 'bear').
  // - restrict = 0: #225, #229, #230, #234, #235, #240, #244, #245, #250 require human form (#249 Armageddon is restrict = 1).
  const activeDruidForm: 'human' | 'wolf' | 'bear' =
    (player as any).druidForm === 'wolf' || (player as any).morphForm === 'wolf' || Boolean((player as any).states?.has?.(139))
      ? 'wolf'
      : (player as any).druidForm === 'bear' || (player as any).morphForm === 'bear' || Boolean((player as any).states?.has?.(140))
        ? 'bear'
        : 'human'
  if (!canCastDruidSkill(activeDruidForm, skillId)) {
    status.textContent =
      activeDruidForm === 'human'
        ? (isEn ? 'Requires Werewolf or Werebear form!' : '需要狼人或熊人变形状态！')
        : (isEn ? 'Cannot cast this skill while shape-shifted!' : '变形状态下无法施展该技能！')
    return false
  }
  if (skillId === 224) {
    const slvl = resolveCastSkillLevel(224, player, hudManager, engine)
    status.textContent = isEn
      ? `Lycanthropy (Level ${slvl}): Passively increases shape-shifting duration and maximum life`
      : `变形术（等级 ${slvl}）：被动提升变形持续时间与生命上限`
    return true
  }

  // 1b. Shield requirement check for Smite (97) and Holy Shield (117)
  if (skillId === 97 || skillId === 117) {
    const shield =
      (context as any).equippedShield ??
      hudManager?.inventory?.equipped?.weapon2 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon2
    if (!shield) {
      status.textContent = isEn
        ? (skillId === 97 ? 'Smite requires a shield!' : 'Holy Shield requires a shield!')
        : (skillId === 97 ? '重击需要装备盾牌！' : '圣盾需要装备盾牌！')
      return false
    }
  }

  // 1b-2. Melee weapon requirement check (itypea1 = mele) for Sacrifice (96), Zeal (106), Charge (107), Vengeance (111), Conversion (116)
  const isPalMeleeWeaponSkill =
    skillId === 96 || skillId === 106 || skillId === 107 || skillId === 111 || skillId === 116
  if (
    isPalMeleeWeaponSkill &&
    (context.equippedWeapon !== undefined ||
      hudManager?.inventory?.equipped?.weapon1 !== undefined ||
      (player as any)?.equippedWeapon !== undefined)
  ) {
    const palWeapon =
      context.equippedWeapon ??
      (player as any)?.equippedWeapon ??
      hudManager?.inventory?.equipped?.weapon1 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon1 ??
      null
    const palWeaponInfo = getAttackWeaponInfo(palWeapon)
    if (!palWeapon || palWeaponInfo.kind !== 'melee' || palWeaponInfo.isRanged) {
      status.textContent = isEn ? 'Requires a melee weapon!' : '需要装备近战武器！'
      return false
    }
  }

  // 1c. Bow / Crossbow & ammunition requirement check for Amazon Bow & Crossbow skills
  const isAmaBowSkill =
    skillId === 6 ||
    skillId === 7 ||
    skillId === 11 ||
    skillId === 12 ||
    skillId === 16 ||
    skillId === 21 ||
    skillId === 22 ||
    skillId === 26 ||
    skillId === 27 ||
    skillId === 31
  if (
    isAmaBowSkill &&
    (context.equippedWeapon !== undefined ||
      context.equippedAmmo !== undefined ||
      context.hasAmmo !== undefined ||
      hudManager?.inventory?.equipped?.weapon1 !== undefined ||
      hudManager?.inventory?.equipped?.weapon2 !== undefined)
  ) {
    const rawW1 =
      hudManager?.inventory?.equipped?.weapon1 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon1 ??
      null
    const rawW2 =
      hudManager?.inventory?.equipped?.weapon2 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon2 ??
      null
    const w1Info = getAttackWeaponInfo(rawW1)
    const w2Info = getAttackWeaponInfo(rawW2)
    const swappedRanged = context.equippedWeapon === undefined && !w1Info.isRanged && w2Info.isRanged
    const bowWeapon = context.equippedWeapon ?? (swappedRanged ? rawW2 : rawW1)
    const bowWeaponInfo =
      context.equippedWeapon !== undefined ? getAttackWeaponInfo(bowWeapon) : swappedRanged ? w2Info : w1Info
    if (!bowWeaponInfo.isRanged) {
      status.textContent = isEn ? 'Requires a bow or crossbow!' : '需要装备弓或十字弓！'
      return false
    }
    // Skill #6 Magic Arrow (srvdofunc = 2) does NOT require or consume arrows/bolts in 1.13c
    if (skillId !== 6) {
      const bowAmmo = context.equippedAmmo ?? (swappedRanged ? rawW1 : rawW2)
      const hasBowAmmo =
        context.hasAmmo ??
        (bowAmmo && typeof bowAmmo.quantity === 'number' && bowAmmo.quantity <= 0
          ? false
          : checkAmmunition(bowWeaponInfo.ammoType!, bowAmmo, hudManager?.inventory))
      if (!hasBowAmmo) {
        status.textContent = isEn
          ? (bowWeaponInfo.ammoType === 'arrow' ? 'Out of arrows!' : 'Out of bolts!')
          : (bowWeaponInfo.ammoType === 'arrow' ? '缺少箭矢！' : '缺少十字弓弹！')
        return false
      }
      if (bowAmmo && typeof bowAmmo.quantity === 'number' && bowAmmo.quantity > 0) {
        bowAmmo.quantity -= 1
      }
    }
  }

  // 1d. Javelin / Spear & quantity requirement check for Amazon Javelin & Spear skills
  const isAmaJavelinThrowSkill = skillId === 15 || skillId === 20 || skillId === 25 || skillId === 35
  const isAmaSpearMeleeSkill =
    skillId === 10 || skillId === 14 || skillId === 19 || skillId === 24 || skillId === 30 || skillId === 34
  let javWeaponToDecrement: any = null
  const hudEquippedWeapon =
    (hudManager as any)?.inventory?.equipped?.weapon1 ??
    (hudManager as any)?.getEquippedItems?.()?.weapon
  if (
    (isAmaJavelinThrowSkill || isAmaSpearMeleeSkill) &&
    (context.equippedWeapon !== undefined || hudEquippedWeapon !== undefined)
  ) {
    const javWeapon =
      context.equippedWeapon ??
      hudEquippedWeapon ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon1 ??
      null
    const javWeaponInfo = getAttackWeaponInfo(javWeapon)
    if (isAmaJavelinThrowSkill) {
      if (javWeaponInfo.subtype !== 'spear' || !isJavelinWeaponItem(javWeapon)) {
        status.textContent = isEn ? 'Requires a javelin!' : '需要装备标枪！'
        return false
      }
      if (javWeapon && typeof javWeapon.quantity === 'number') {
        if (javWeapon.quantity <= 0) {
          status.textContent = isEn ? 'Out of javelins!' : '标枪数量不足！'
          return false
        }
        javWeaponToDecrement = javWeapon
      }
    } else if (javWeaponInfo.subtype !== 'spear') {
      status.textContent = isEn ? 'Requires a spear or javelin!' : '需要装备标枪或长矛！'
      return false
    }
  }

  // 1e. Barbarian Warcry pre-cast target validation (1.13c srvstfunc = 32 Taunt, 33 FindPotion/GrimWard, 34 FindItem)
  let prevalidatedBarbCorpse: Monster | null = null
  let prevalidatedTauntTarget: Monster | null = null
  if (skillId === 131 || skillId === 142 || skillId === 150) {
    let bestCorpseDist = 200
    for (const monster of engine.world.monsters) {
      if (monster.state !== 'dead' && monster.hp > 0) continue
      const check = validateBarbarianCorpseTarget(skillId, {
        consumed: Boolean((monster as any).corpseConsumed || (monster.corpseTicks !== undefined && monster.corpseTicks <= 0)),
        shattered: Boolean((monster as any).shattered || (monster as any).isShattered),
        isBoss: Boolean((monster.stats as any)?.isBoss || (monster.stats as any)?.type === 'boss' || (monster as any).isBoss || (monster as any).isSuperUnique),
        isSoft: (monster as any).isSoft ?? (monster.stats as any)?.isSoft,
        stateId: (monster as any).corpseStateId ?? (monster as any).stateId,
        states: (monster as any).states,
        noSelect: Boolean((monster as any).noSelect),
        noDraw: Boolean((monster as any).noDraw),
      })
      if (!check.valid) continue
      const d = Math.hypot(monster.x - targetX, (monster.y - targetY) / ISO_GROUND_ASPECT_RATIO)
      if (d <= bestCorpseDist) {
        bestCorpseDist = d
        prevalidatedBarbCorpse = monster
      }
    }
    if (!prevalidatedBarbCorpse) {
      status.textContent = isEn ? 'Requires a valid monster corpse!' : '需要有效的怪物尸体！'
      return false
    }
  } else if (skillId === 137) {
    let bestDist = 400
    for (const monster of engine.world.monsters) {
      if (monster.state === 'dead' || monster.hp <= 0) continue
      const isBossOrChamp = Boolean(
        (monster.stats as any)?.isBoss ||
        (monster.stats as any)?.type === 'boss' ||
        monster.stats?.rank === 'champion' ||
        monster.stats?.rank === 'unique' ||
        (monster as any).isBoss ||
        (monster as any).isChampion ||
        (monster as any).isUnique ||
        (monster as any).isSuperUnique
      )
      if (isBossOrChamp || !canMonsterTargetBeCursed113c(monster as never)) continue
      const d = Math.hypot(monster.x - targetX, (monster.y - targetY) / ISO_GROUND_ASPECT_RATIO)
      if (d <= bestDist) {
        bestDist = d
        prevalidatedTauntTarget = monster
      }
    }
    if (!prevalidatedTauntTarget) {
      status.textContent = isEn ? 'Requires a valid non-boss monster target!' : '需要有效的非首领怪物目标！'
      return false
    }
  }

  // 1f. Barbarian Combat Skills pre-cast equipment & destination checks (#126..#152)
  const isBarMeleeWeaponSkill =
    skillId === 126 ||
    skillId === 133 ||
    skillId === 139 ||
    skillId === 143 ||
    skillId === 144 ||
    skillId === 147 ||
    skillId === 151 ||
    skillId === 152
  if (
    isBarMeleeWeaponSkill &&
    (context.equippedWeapon !== undefined ||
      hudManager?.inventory?.equipped?.weapon1 !== undefined ||
      (player as any)?.equippedWeapon !== undefined)
  ) {
    const barWeapon =
      context.equippedWeapon ??
      (player as any)?.equippedWeapon ??
      hudManager?.inventory?.equipped?.weapon1 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon1 ??
      null
    const barWeaponInfo = getAttackWeaponInfo(barWeapon)
    if (barWeapon && (barWeaponInfo.kind === 'ranged' || barWeaponInfo.isRanged)) {
      status.textContent = isEn ? 'Requires a melee weapon!' : '需要装备近战武器！'
      return false
    }
  }
  if (skillId === 133 || skillId === 147 || skillId === 260) {
    const explicitNoDualWield =
      (context as any).isDualClaw === false ||
      (context as any).hasDualWield === false ||
      (context as any).isDualWielding === false ||
      (player as any)?.isDualClaw === false ||
      (player as any)?.hasDualWield === false ||
      (player as any)?.isDualWielding === false
    if (explicitNoDualWield) {
      status.textContent = isEn
        ? (skillId === 260 ? 'Dragon Claw requires dual claws!' : 'Requires dual-wield melee weapons!')
        : (skillId === 260 ? '双龙爪需要双持爪类武器！' : '需要双持近战武器！')
      return false
    }
  }
  let doubleThrowMainWeaponToDecrement: any = null
  let doubleThrowOffWeaponToDecrement: any = null
  if (skillId === 140) {
    const explicitNoDualThrow =
      (context as any).hasDualThrow === false ||
      (player as any)?.hasDualThrow === false
    if (explicitNoDualThrow) {
      status.textContent = isEn ? 'Requires dual throwing weapons!' : '需要双持投掷武器！'
      return false
    }
    const throwWep1 =
      context.equippedWeapon ??
      (player as any)?.equippedWeapon ??
      hudManager?.inventory?.equipped?.weapon1 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon1 ??
      null
    const throwWep2 =
      (context as any).equippedOffHandWeapon ??
      (player as any)?.offHandWeapon ??
      hudManager?.inventory?.equipped?.weapon2 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon2 ??
      null
    if (throwWep1 && typeof throwWep1.quantity === 'number') {
      if (throwWep1.quantity <= 0) {
        status.textContent = isEn ? 'Out of throwing weapons!' : '投掷武器数量不足！'
        return false
      }
      doubleThrowMainWeaponToDecrement = throwWep1
    }
    if (throwWep2 && typeof throwWep2.quantity === 'number') {
      if (throwWep2.quantity <= 0) {
        status.textContent = isEn ? 'Out of throwing weapons!' : '投掷武器数量不足！'
        return false
      }
      doubleThrowOffWeaponToDecrement = throwWep2
    }
  }
  if (skillId === 132 || skillId === 143) {
    const hasTargetInMelee =
      skillId === 143 &&
      engine.world.monsters.some(
        m => m.state !== 'dead' && m.hp > 0 && Math.hypot(m.x - player.x, m.y - player.y) <= 80,
      )
    if (!hasTargetInMelee && runtime?.grid && isBlockedAt(runtime.grid, targetX, targetY)) {
      status.textContent = isEn ? 'Cannot leap to blocked destination!' : '无法跳跃到受阻位置！'
      return false
    }
  }

  // 2. Mana check & deduction
  let isFirstInfernoCast = false
  if (skillId === 41) {
    const slvl = Math.max(1, (hudManager as any)?.getSkillLevel?.(41) ?? 1)
    const currentMana = hudManager !== null ? hudManager.mana : player.mana

    if (!player.infernoChanneling) {
      // Starting cast cost: 6 mana (1.13c Skills.txt)
      const startCost = 6
      if (currentMana < startCost) {
        status.textContent = isEn ? 'Not enough mana!' : '法力不足！'
        engine.world.events.push({ kind: 'noMana', x: player.x, y: player.y, text: 'no mana' } as any)
        return false
      }
      player.mana = Math.max(0, player.mana - startCost)
      if (hudManager !== null) {
        hudManager.mana = player.mana
        hudManager.syncPublishedState?.()
      }
      player.infernoChanneling = true
      player.infernoManaRemainder256 = 0
      isFirstInfernoCast = true
    } else {
      // Continuous channeling frame: drain authentically via calculateInfernoContinuousMana256 (256ths)
      if (currentMana <= 0) {
        player.infernoChanneling = false
        player.infernoManaRemainder256 = 0
        status.textContent = isEn ? 'Not enough mana!' : '法力不足！'
        engine.world.events.push({ kind: 'noMana', x: player.x, y: player.y, text: 'no mana' } as any)
        return false
      }
      const drain256 = calculateInfernoContinuousMana256(slvl)
      const total256 = (player.infernoManaRemainder256 ?? 0) + drain256
      const wholeMana = Math.floor(total256 / 256)
      player.infernoManaRemainder256 = total256 % 256
      if (wholeMana > 0) {
        player.mana = Math.max(0, player.mana - wholeMana)
        if (hudManager !== null) {
          hudManager.mana = player.mana
          hudManager.syncPublishedState?.()
        }
      }
      if (player.mana <= 0) {
        player.infernoChanneling = false
        player.infernoManaRemainder256 = 0
      }
    }
  } else {
    // Reset inferno channeling state when casting another skill
    player.infernoChanneling = false
    player.infernoManaRemainder256 = 0

    // 1.13c nocostinstate = 1: toggling off Werewolf (#223) while in wolf form or Werebear (#228) while in bear form costs 0 mana
    const isFreeUnshift =
      (skillId === 223 && activeDruidForm === 'wolf') || (skillId === 228 && activeDruidForm === 'bear')
    const manaCost = isFreeUnshift ? 0 : getSkillMana(skillId, hudManager)
    const currentMana = hudManager !== null ? hudManager.mana : player.mana
    if (currentMana < manaCost) {
      status.textContent = isEn ? 'Not enough mana!' : '法力不足！'
      engine.world.events.push({ kind: 'noMana', x: player.x, y: player.y, text: 'no mana' } as any)
      return false
    }

    // 3. Deduct mana
    if (manaCost > 0) {
      player.mana = Math.max(0, player.mana - manaCost)
      if (hudManager !== null) {
        hudManager.mana = Math.max(0, hudManager.mana - manaCost)
        hudManager.syncPublishedState?.()
      }
    }

    // 3b. Decrement thrown javelin / Double Throw stack quantity after mana check succeeds
    if (javWeaponToDecrement && typeof javWeaponToDecrement.quantity === 'number' && javWeaponToDecrement.quantity > 0) {
      javWeaponToDecrement.quantity -= 1
    }
    if (
      doubleThrowMainWeaponToDecrement &&
      typeof doubleThrowMainWeaponToDecrement.quantity === 'number' &&
      doubleThrowMainWeaponToDecrement.quantity > 0
    ) {
      doubleThrowMainWeaponToDecrement.quantity -= 1
    }
    if (
      doubleThrowOffWeaponToDecrement &&
      typeof doubleThrowOffWeaponToDecrement.quantity === 'number' &&
      doubleThrowOffWeaponToDecrement.quantity > 0
    ) {
      doubleThrowOffWeaponToDecrement.quantity -= 1
    }
  }

  // 4. Face cursor direction
  player.facing = facingOf(targetX - player.x, targetY - player.y)

  // 4b. Trigger character animation
  if (playerAnimator !== undefined && character?.clips !== undefined) {
    const clipMode = getSkillPlayerClipMode(skillId)
    const clip =
      character.clips[clipMode] ??
      (skillId === 0
        ? character.clips['a1'] ?? character.clips['a2']
        : character.clips['sc'] ?? character.clips['a1'])
    const playMode = character.clips[clipMode] ? clipMode : skillId === 0 ? 'a1' : 'sc'
    if (clip !== undefined) playerAnimator.play(playMode, clip, { restart: true })
  }

  // 5. Spawn cast overlay if defined for this skill
  if (skillId !== 0 && (skillId !== 41 || isFirstInfernoCast)) {
    const castOverlayName = getSkillCastOverlay(skillId)
    if (castOverlayName) {
      engine.spawnOverlay(castOverlayName, { x: player.x, y: player.y }, 'player', { isCastOverlay: true })
    }
  }

  // 6. Dispatch skill
  if (skillId === 0) {
    const outcome = executeNormalAttack(targetX, targetY, {
      engine,
      hudLike: hudManager,
      equippedWeapon: context.equippedWeapon,
      equippedAmmo: context.equippedAmmo,
      hasAmmo: context.hasAmmo,
    })
    if (outcome.statusMessage !== null) {
      status.textContent = outcome.statusMessage
    }
    return outcome.casted
  }

  if (skillId === 3) {
    // Unsummon (SKILLS_SrvSt03_Unsummon 0x6FCBFEF0 / SKILLS_SrvDo004_Unsummon 0x6FCC2EA0): the target must be one
    // of the caster's own pets whose PetType.txt row has `unsummon = 1`; the pet is despawned.
    const dismissed = unsummonOwnPetAt(player, targetX, targetY)
    if (!dismissed) {
      status.textContent = isEn ? 'Unsummon requires one of your summons!' : '取消召唤需要指向你自己的召唤物！'
      return false
    }
    const summonManager = (engine as any).summonManager
    if (summonManager && typeof summonManager.unsummonPet === 'function') {
      summonManager.unsummonPet('player', dismissed.petType)
    }
    ;(engine.world as any).summons = (player as any).summons
    status.textContent = isEn ? 'Summon dismissed' : '已取消召唤'
    return true
  }

  if (skillId === 54) {
    // Teleport (1.13c SOSC: 14 AnimData.d2 frames @ baseSpeed 256 => 13 ticks at 0% FCR)
    const blocked = isBlockedAt(runtime.grid, targetX, targetY)
    const overlap = engine.terrain.overlap(targetX, targetY)
    const fcrRaw = Number((player as any)?.fcr ?? (hudManager as any)?.fcr ?? 0)
    const efcr =
      fcrRaw > 0
        ? Math.min(75, Math.trunc((120 * fcrRaw) / (120 + fcrRaw)))
        : Math.max(-85, Math.trunc(fcrRaw || 0))
    const stepSpeed256 = Math.max(32, Math.floor((256 * (100 + efcr)) / 100))
    player.cooldown = Math.max(1, Math.ceil((14 * 256) / stepSpeed256) - 1)
    if (!blocked && overlap === 0) {
      player.x = targetX
      player.y = targetY
      for (const ov of engine.overlays) {
        if (ov.casterId === 'player') {
          ov.x = player.x
          ov.y = player.y
        }
      }
      status.textContent = isEn ? 'Cast Teleport' : '已施展传送'
    } else {
      status.textContent = isEn ? 'Cannot teleport there' : '无法传送到该位置'
    }
    return true
  }

  if (skillId === 42) {
    // Static Field (Skill 42): Instantaneous 360° area discharge
    const slvl = (hudManager as any)?.getSkillLevel?.(42) ?? 1
    const radiusPx = calculateStaticFieldRadiusPx(slvl)
    const difficulty = (((engine.world as any).difficulty ?? 'normal') as string).toLowerCase() as 'normal' | 'nightmare' | 'hell'
    let hitCount = 0
    for (const monster of engine.world.monsters) {
      if (monster.state === 'dead' || monster.hp <= 0) continue
      const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
      if (dist <= radiusPx) {
        if (!hasLineOfSight(player.x, player.y, monster.x, monster.y, engine.terrain)) {
          continue
        }
        const maxHp = monster.stats.hp ?? monster.hp
        const ltngRes = monster.stats.lightningResist
          ?? monster.stats.resistances?.lightning
          ?? monster.stats.resists?.lightning
          ?? (monster as any).resistances?.lightning
          ?? (monster as any).resists?.lightning
          ?? (monster.stats as any).resistLightning
          ?? 0
        const res = calculateStaticFieldDamage(monster.hp, maxHp, difficulty, ltngRes)
        if (res.damage > 0) {
          damageMonster(engine.world, monster.index, res.damage)
          engine.metrics.castHits += 1
          hitCount++
          engine.spawnOverlay('lightning', { x: monster.x, y: monster.y })
        }
      }
    }
    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn
      ? `Cast Static Field (${hitCount} targets)`
      : `施展静态力场，削弱 ${hitCount} 个目标`
    return true
  }

  if (skillId === 43) {
    // Telekinesis (Skill 43): 1.13c ground truth
    // Skills.txt #43: castoverlay = light_cast_2 (spawned on the caster by step 5 above), tgtoverlay empty;
    // SrvDo021_Telekinesis sets no overlay on the target -> no target-point / monster overlay here (#1230).
    const slvl = (hudManager as any)?.getSkillLevel?.(43) ?? 1
    const dist = Math.hypot(targetX - player.x, targetY - player.y)
    const maxRange = 600
    const refundTelekinesisMana = (): void => {
      const manaCost = getSkillMana(43, hudManager)
      if (manaCost > 0) {
        player.mana = Math.min(player.maxMana ?? player.mana + manaCost, player.mana + manaCost)
        if (hudManager !== null) {
          hudManager.mana = Math.min(hudManager.maxMana ?? hudManager.mana + manaCost, hudManager.mana + manaCost)
          hudManager.syncPublishedState?.()
        }
      }
    }

    if (dist > maxRange) {
      refundTelekinesisMana()
      status.textContent = isEn ? 'Target out of Telekinesis range!' : '目标超出心灵传动范围！'
      return false
    }

    // 1. Monster combat check: living monster within 48 px of target point
    let targetMonster: Monster | null = null
    let bestMonDist = 48
    for (const m of engine.world.monsters) {
      if (m.state === 'dead' || m.hp <= 0) continue
      const dFeet = Math.hypot(m.x - targetX, m.y - targetY)
      const dBody = Math.hypot(m.x - targetX, m.y - 16 - targetY)
      const minD = Math.min(dFeet, dBody)
      if (minD <= bestMonDist) {
        bestMonDist = minD
        targetMonster = m
      }
    }

    if (targetMonster !== null) {
      const dmgRange = calculateTelekinesisDamage(slvl)
      const dmg = engine.castRng
        ? engine.castRng.randRange(dmgRange.min, dmgRange.max)
        : dmgRange.min
      damageMonster(engine.world, targetMonster.index, Math.max(1, dmg))
      engine.metrics.playerHits += 1

      // 35% knockback away from player
      const kbRoll = engine.castRng ? engine.castRng.rand(100) : 100
      if (kbRoll < 35) {
        const kAngle = Math.atan2(targetMonster.y - player.y, targetMonster.x - player.x)
        targetMonster.x += Math.cos(kAngle) * 20
        targetMonster.y += Math.sin(kAngle) * (20 * ISO_GROUND_ASPECT_RATIO)
      }

      // 35-frame stun
      ;(targetMonster as any).stunTicks = Math.max((targetMonster as any).stunTicks ?? 0, 35)

      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Telekinesis hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
        : `心灵传动命中：${targetMonster.stats.name || targetMonster.stats.id}`
      return true
    }

    // 2. Ground item pickup check: item within 48 px of target point
    const nearbyGroundItem =
      engine.groundItems?.findAtPoint?.(targetX, targetY, 48) ??
      engine.groundItems?.all?.find(g => Math.hypot(g.x - targetX, g.y - targetY) <= 48)
    if (nearbyGroundItem) {
      if (isTelekinesisItemAllowed(nearbyGroundItem)) {
        const simTimeMs = (engine.world.tick ?? 0) * 40
        if (nearbyGroundItem.isGold) {
          const res = engine.pickupGold(nearbyGroundItem.id)
          if (res.success) {
            if (hudManager?.inventory) {
              const playerLevel = engine.world.player?.level ?? 1
              hudManager.inventory.playerLevel = playerLevel
              if (!(hudManager.inventory as any)._boundEngine) {
                hudManager.inventory.gold = engine.bag.gold
              }
              hudManager.syncPublishedState?.()
            }
            if (res.remaining && res.remaining > 0) {
              status.textContent = isEn
                ? `Telekinesis picked up gold: ${res.amount} (${res.remaining} remaining)`
                : `心灵传动拾取金币：${res.amount}（地面剩余：${res.remaining}）`
            } else {
              status.textContent = isEn
                ? `Telekinesis picked up gold: ${res.amount}`
                : `心灵传动拾取金币：${res.amount}`
            }
          } else {
            engine.metrics.inventoryRefusals += 1
            triggerFlippyBounce(nearbyGroundItem, simTimeMs)
            const playFull = context.onInventoryFullFeedback ?? globalBag.__d2PlayInventoryFullFeedback
            if (typeof playFull === 'function') playFull()
            status.textContent = isEn ? 'Gold limit reached.' : '金币已达携带上限。'
            const notify = context.onNotify ?? globalBag.__d2ShowNotification
            if (typeof notify === 'function') {
              notify(isEn ? 'Cannot carry any more gold.' : '无法携带更多金币。')
            }
          }
        } else {
          if (hudManager?.inventory) {
            const autoBelted = Boolean(hudManager.belt?.autoPlacePotion?.(nearbyGroundItem.item))
            if (!autoBelted) {
              const uiItem = itemToUiInventoryItem(nearbyGroundItem.item, engine.dropTables)
              const placed = hudManager.inventory.autoPlaceInGrid(uiItem)
              if (!placed) {
                engine.metrics.inventoryRefusals += 1
                triggerFlippyBounce(nearbyGroundItem, simTimeMs)
                status.textContent = isEn ? 'I am overburdened.' : '包裹已满。'
                return true
              }
              if (nearbyGroundItem.item && engine.bag) {
                engine.bag.add(nearbyGroundItem.item as any)
              }
            }
            engine.groundItems.remove(nearbyGroundItem.id)
            engine.metrics.pickups += 1
            hudManager.syncPublishedState?.()
            status.textContent = isEn
              ? `Telekinesis picked up: ${nearbyGroundItem.name}`
              : `心灵传动拾取物品：${nearbyGroundItem.nameZh || nearbyGroundItem.name}`
          } else {
            engine.pickupItem(nearbyGroundItem.id)
            status.textContent = isEn
              ? `Telekinesis picked up: ${nearbyGroundItem.name}`
              : `心灵传动拾取物品：${nearbyGroundItem.nameZh || nearbyGroundItem.name}`
          }
        }
      } else {
        // Equipment forbidden
        engine.metrics.inventoryRefusals += 1
        engine.world.events.push({ kind: 'itemRefused', x: nearbyGroundItem.x, y: nearbyGroundItem.y, text: 'cannot pickup equipment with telekinesis' } as any)
        status.textContent = isEn ? 'Cannot pick up equipment with Telekinesis!' : '心灵传动无法拾取装备！'
      }
      player.cooldown = 0
      engine.metrics.casts += 1
      return true
    }

    // 3. Interactive objects check (waypoints, stash, chests, portals, warps)
    if (runtime.waypoints) {
      const clickedWp = runtime.waypoints.find(wp => Math.hypot(wp.arriveX - targetX, wp.arriveY - targetY) <= 80)
      if (clickedWp) {
        if (context.waypointNetwork?.activate(clickedWp.waypointId)) {
          status.textContent = isEn ? `Waypoint activated: ${runtime.level}` : `传送点已激活：${runtime.level}`
        }
        if (hudManager?.worldPanels) {
          hudManager.worldPanels.setCurrentWaypoint(clickedWp.waypointId, runtime.levelId)
          hudManager.worldPanels.selectedActTab = runtime.act
          if (hudManager.leftPanel !== 'waypoint') {
            hudManager.toggleLeftPanel?.('waypoint')
          }
        }
        player.cooldown = 0
        engine.metrics.casts += 1
        return true
      }
    }

    if (runtime.stashes) {
      const clickedStash = runtime.stashes.find(s => Math.hypot(s.x - targetX, s.y - targetY) <= 64)
      if (clickedStash) {
        if (context.openStash) {
          context.openStash(clickedStash)
        } else if (hudManager && hudManager.leftPanel !== 'stash') {
          hudManager.toggleLeftPanel?.('stash')
        }
        player.cooldown = 0
        engine.metrics.casts += 1
        status.textContent = isEn ? 'Telekinesis opened Stash' : '心灵传动打开储物箱'
        return true
      }
    }

    if (context.portalSlot && context.onEnterPortal && runtime.grid) {
      const mouth = context.portalSlot.mouthInLevel(runtime.levelId)
      if (mouth) {
        const portalPos = subTileToScene(mouth.x, mouth.y, runtime.grid)
        const clampedPortalY = Math.max(portalPos.y - 80, Math.min(portalPos.y, targetY))
        if (Math.hypot(portalPos.x - targetX, clampedPortalY - targetY) <= 64) {
          player.cooldown = 0
          engine.metrics.casts += 1
          status.textContent = isEn ? 'Telekinesis entered Town Portal' : '心灵传动进入传送门'
          context.onEnterPortal()
          return true
        }
      }
    }

    if (runtime.warps && runtime.grid) {
      let bestWarp: { warp: SceneWarp; dist: number; anchorPos: { x: number; y: number }; arrivePos: { x: number; y: number } } | null = null
      for (const warp of runtime.warps) {
        const res = hitTestWarp(warp, targetX, targetY, runtime.grid)
        if (res.hit && (bestWarp === null || res.dist < bestWarp.dist)) {
          bestWarp = { warp, dist: res.dist, anchorPos: res.anchorPos, arrivePos: res.arrivePos }
        }
      }
      if (bestWarp !== null) {
        const warpPlayerDist = Math.min(
          Math.hypot(bestWarp.anchorPos.x - player.x, bestWarp.anchorPos.y - player.y),
          Math.hypot(bestWarp.arrivePos.x - player.x, bestWarp.arrivePos.y - player.y),
        )
        if (warpPlayerDist <= TELEKINESIS_RANGE_PX) {
          player.cooldown = 0
          engine.metrics.casts += 1
          const destName = getLevelNames(bestWarp.warp.toLevelId).nameZh
          status.textContent = isEn
            ? `Telekinesis triggered warp: To ${levelDisplayName(bestWarp.warp.toLevelId, 'ENG')}`
            : `心灵传动触发入口：通往 ${destName}`
          context.onEnterWarp?.(bestWarp.warp)
          return true
        }
        refundTelekinesisMana()
        status.textContent = isEn ? 'Target out of Telekinesis range!' : '目标超出心灵传动范围！'
        return false
      }
    }

    // 4. Generic ground cast / feedback
    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Telekinesis' : '施展心灵传动'
    return true
  }

  if (skillId === 8) {
    // Inner Sight (Skill 8)
    const slvl = resolveCastSkillLevel(8, player, hudManager, engine)
    const stats = calculateInnerSightStats(slvl)
    engine.spawnOverlay('cast_innersight', { x: player.x, y: player.y }, 'player')
    const rangePx = stats.radiusPx
    if (engine.world?.monsters) {
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        const dist = Math.hypot(m.x - player.x, m.y - player.y)
        if (dist <= rangePx) {
          m.innerSightTicks = stats.durationFrames
          m.innerSightDefReduction = stats.flatDefenseReduction
          m.lightRadiusBonus = Math.max(m.lightRadiusBonus ?? 0, (stats as any).lightRadiusBonus ?? 3)
          engine.spawnOverlay('innersight', { x: m.x, y: m.y }, `monster-${m.index}`, { loop: true, isStateOverlay: true })
        }
      }
    }
    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Inner Sight' : '施展内视'
    return true
  }

  if (skillId === 17) {
    // Slow Missiles (Skill 17)
    const slvl = resolveCastSkillLevel(17, player, hudManager, engine)
    const stats = calculateSlowMissilesStats(slvl)
    engine.spawnOverlay('cast_slowmissiles', { x: player.x, y: player.y }, 'player')
    const rangePx = stats.radiusPx
    if (engine.world?.monsters) {
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        const dist = Math.hypot(m.x - player.x, m.y - player.y)
        if (dist <= rangePx) {
          m.slowMissilesTicks = stats.durationFrames
          m.slowMissilesMult = stats.velocityMultiplier
          m.lightRadiusBonus = Math.max(m.lightRadiusBonus ?? 0, (stats as any).lightRadiusBonus ?? 3)
          engine.spawnOverlay('innersight', { x: m.x, y: m.y }, `monster-${m.index}`, { loop: true, isStateOverlay: true })
        }
      }
    }
    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Slow Missiles' : '施展慢速箭'
    return true
  }

  if (skillId === 28) {
    // Decoy (Skill 28)
    const slvl = resolveCastSkillLevel(28, player, hudManager, engine)
    const amazonHp = player.maxHp ?? player.hp ?? 100
    const amazonDef = (player as any).defense ?? 50
    const stats = calculateDecoyStats(slvl, amazonHp, amazonDef)

    registerCastSummon({
      engine,
      player,
      hudManager,
      skillId: 28,
      slvl,
      x: targetX,
      y: targetY,
      petType: 'dopplezon',
      petGroup: 0,
      maxPets: 1,
      hp: stats.hp,
      kind: 'dopplezon',
      lifespanTicks: stats.durationFrames,
      extra: {
        isStationary: true,
        defense: stats.defense,
        allResistancesPct: stats.allResistancesPct,
        drawsThreat: stats.drawsThreat,
        inheritedAvoidLvl: 0,
        inheritedEvadeLvl: 0,
      },
    })
    engine.spawnOverlay('dopllezon_appear', { x: targetX, y: targetY })
    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Decoy' : '施展诱饵'
    return true
  }

  if (skillId === 32) {
    // Valkyrie (Skill 32)
    const slvl = resolveCastSkillLevel(32, player, hudManager, engine)
    const decoyHardPoints = resolveBaseSkillLevel(28, player, hudManager, engine)
    const stats = calculateValkyrieStats(slvl, {
      decoyHardPoints,
      csLvl: resolveBaseSkillLevel(9, player, hudManager, engine),
      dodgeLvl: resolveBaseSkillLevel(13, player, hudManager, engine),
      avoidLvl: resolveBaseSkillLevel(18, player, hudManager, engine),
      evadeLvl: resolveBaseSkillLevel(29, player, hudManager, engine),
      penetrateLvl: resolveBaseSkillLevel(23, player, hudManager, engine),
    })

    registerCastSummon({
      engine,
      player,
      hudManager,
      skillId: 32,
      slvl,
      x: targetX,
      y: targetY,
      petType: 'valkyrie',
      petGroup: 0,
      maxPets: 1,
      hp: stats.finalHp,
      kind: 'valkyrie',
      extra: {
        equipmentTier: stats.equipmentTier,
        equipmentIlvl: stats.equipmentIlvl,
        allResistancesPct: stats.allResistancesPct,
        strength: stats.strength,
        dexterity: stats.dexterity,
        defenseBonusPct: stats.defenseBonusPct,
        attackRatingBonus: stats.attackRatingBonus,
        inheritedCriticalStrikeLvl: stats.inheritedCriticalStrikeLvl,
        inheritedDodgeLvl: stats.inheritedDodgeLvl,
        inheritedAvoidLvl: stats.inheritedAvoidLvl,
        inheritedEvadeLvl: stats.inheritedEvadeLvl,
        inheritedPenetrateLvl: stats.inheritedPenetrateLvl,
      },
    })
    engine.spawnOverlay('valkyriestart', { x: targetX, y: targetY })
    player.cooldown = 150
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Valkyrie' : '召唤女武神'
    return true
  }

  if (skillId === 219 || skillId === 220) {
    // Scroll of Town Portal (219) / Book of Town Portal (220)
    if (context.onCastTownPortal) {
      const ok = context.onCastTownPortal()
      if (!ok) return false
      player.cooldown = 10
      engine.metrics.casts += 1
      return true
    }
    return false
  }

  if (skillId === 59) {
    // Blizzard (Skill 59)
    const slvl = resolveCastSkillLevel(59, player, hudManager, engine)
    const dmgRange = calculateSkillDamage(59, slvl)
    const blizzardDamage = Math.round((dmgRange.min + dmgRange.max) / 2)

    engine.projectiles.push({
      skillId: '59',
      x: targetX,
      y: targetY,
      vx: 0,
      vy: 0,
      damage: blizzardDamage,
      ttl: 100,
      fromPlayer: true,
      missileType: 'blizzardcenter',
      subMissileIdx: 0,
    })

    player.cooldown = 45
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Blizzard' : '施展暴风雪'
    return true
  }

  if (skillId === 56) {
    // Meteor (Skill 56)
    const slvl = resolveCastSkillLevel(56, player, hudManager, engine)
    const dmgRange = calculateSkillDamage(56, slvl)
    const meteorDamage = Math.round((dmgRange.min + dmgRange.max) / 2)
    const resFire = calculateMeteorResidualFireDamage(slvl)
    const fireDmg = Math.round((resFire.min + resFire.max) / 2)
    const fireDuration = 30 + (slvl - 1) * 15

    engine.projectiles.push({
      skillId: '56',
      x: targetX,
      y: targetY,
      vx: 0,
      vy: 0,
      damage: meteorDamage,
      ttl: 60,
      fromPlayer: true,
      missileType: 'meteorcenter',
      slvl,
      fireDuration,
      residualDamage: fireDmg,
      subMissileIdx: 0,
    })

    player.cooldown = 30
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Meteor' : '施展陨石'
    return true
  }

  if (skillId === 51) {
    // Fire Wall (Skill 51)
    const slvl = Math.max(1, (hudManager as any)?.getSkillLevel?.(51) ?? 1)
    const dmgRange = calculateSkillDamage(51, slvl)
    const fireWallDamage = Math.round((dmgRange.min + dmgRange.max) / 2)
    const patches = calculateFireWallPatches(player.x, player.y, targetX, targetY, {
      count: 15,
      spacing: 24,
      isBlocked: (x, y) => {
        if (runtime?.grid) {
          return isMissileBlockedAt(runtime.grid, x, y, 0x05)
        }
        if ((runtime as any)?.walkable) {
          return !(runtime as any).walkable.isWalkable(x, y)
        }
        if ((runtime as any)?.collision) {
          return !(runtime as any).collision.isWalkable(x, y)
        }
        return false
      },
    })

    for (const patch of patches) {
      engine.projectiles.push({
        skillId: '51',
        x: patch.x,
        y: patch.y,
        vx: 0,
        vy: 0,
        damage: fireWallDamage,
        ttl: 90,
        fireDuration: 90,
        fromPlayer: true,
        missileType: 'firewall',
        pierce: true,
        aoeRadius: 24,
      })
    }

    player.cooldown = 35
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Fire Wall' : '施展火墙'
    return true
  }

  if (skillId === 46) {
    // Blaze (Skill 46)
    const slvl = Math.max(1, (hudManager as any)?.getSkillLevel?.(46) ?? 1)
    const duration = calculateBlazeDuration(slvl)
    const patchDuration = calculateBlazePatchDuration(slvl)
    const dmgRange = calculateSkillDamage(46, slvl)
    const blazeDmg = Math.round((dmgRange.min + dmgRange.max) / 2)

    player.blazeTicks = duration
    player.blazeSlvl = slvl
    player.blazeDamage = blazeDmg
    player.blazePatchDuration = patchDuration
    player.lastBlazeX = undefined
    player.lastBlazeY = undefined

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Blaze' : '施展烈火之径'
    return true
  }

  if (skillId === 41) {
    // Inferno (Skill 41) — 1.13c SKILLS_DoInferno (D2MOO SkillSor.cpp:50-121):
    // Initial frame only sets Param1=1 and spawns 0 missiles; subsequent channeled frames spawn 1
    // infernoflame1/infernoflame2 with Range = calc1 (ln12/2 = trunc((20 + 3*(slvl-1)) / 2)).
    const slvl = Math.max(1, (hudManager as any)?.getSkillLevel?.(41) ?? 1)
    const dmgRange = calculateSkillDamage(41, slvl)
    const infernoDmg = Math.round((dmgRange.min + dmgRange.max) / 2)
    const dx = targetX - player.x
    const dy = targetY - player.y
    const len = Math.hypot(dx, dy)
    const speed = 12
    const vx = len > 0 ? (dx / len) * speed : speed
    const vy = len > 0 ? (dy / len) * speed : 0
    const ttl = Math.max(1, Math.trunc((20 + 3 * (slvl - 1)) / 2))

    if (!isFirstInfernoCast) {
      const flameVariant = (engine.metrics.casts % 2 === 0) ? 'infernoflame1' : 'infernoflame2'
      engine.projectiles.push({
        skillId: '41',
        x: player.x,
        y: player.y,
        vx,
        vy,
        damage: infernoDmg,
        ttl,
        fromPlayer: true,
        missileType: flameVariant,
        pierce: true,
        aoeRadius: 20,
      })
    }

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Inferno' : '施展地狱火'
    return true
  }

  if (skillId === 40 || skillId === 50 || skillId === 60) {
    for (const ov of engine.overlays) {
      if (
        (ov.overlayName === 'frozenarmor' ||
          ov.overlayName === 'shiverarmor' ||
          ov.overlayName === 'chillingarmor') &&
        ov.casterId === 'player'
      ) {
        ov.expired = true
      }
    }
  }

  if (skillId === 40) {
    const slvl = resolveCastSkillLevel(40, player, hudManager, engine)
    const duration = calculateFrozenArmorDuration(slvl)
    player.coldArmorType = 'frozenarmor'
    player.coldArmorTicks = duration
    player.coldArmorSlvl = slvl
    engine.spawnOverlay('frozenarmor', { x: player.x, y: player.y }, 'player', { loop: true, isStateOverlay: true })
    player.cooldown = 0
    status.textContent = isEn ? 'Frozen Armor active' : '冰封装甲已激活'
    engine.metrics.casts += 1
    return true
  }

  if (skillId === 50) {
    const slvl = resolveCastSkillLevel(50, player, hudManager, engine)
    const duration = calculateShiverArmorDuration(slvl)
    player.coldArmorType = 'shiverarmor'
    player.coldArmorTicks = duration
    player.coldArmorSlvl = slvl
    engine.spawnOverlay('shiverarmor', { x: player.x, y: player.y }, 'player', { loop: true, isStateOverlay: true })
    player.cooldown = 0
    status.textContent = isEn ? 'Shiver Armor active' : '碎冰装甲已激活'
    engine.metrics.casts += 1
    return true
  }

  if (skillId === 60) {
    const slvl = resolveCastSkillLevel(60, player, hudManager, engine)
    const duration = calculateChillingArmorDuration(slvl)
    player.coldArmorType = 'chillingarmor'
    player.coldArmorTicks = duration
    player.coldArmorSlvl = slvl
    engine.spawnOverlay('chillingarmor', { x: player.x, y: player.y }, 'player', { loop: true, isStateOverlay: true })
    player.cooldown = 0
    status.textContent = isEn ? 'Chilling Armor active' : '寒冰装甲已激活'
    engine.metrics.casts += 1
    return true
  }

  if (skillId === 57) {
    // Thunder Storm (Skill 57)
    const slvl = Math.max(1, (hudManager as any)?.getSkillLevel?.(57) ?? 1)
    const lmSlvl = (hudManager as any)?.getSkillLevel?.(63) ?? 0
    const duration = calculateThunderStormDuration(slvl)
    const interval = calculateThunderStormInterval(slvl)
    const dmgRange = calculateThunderStormDamage(slvl, { lightningMastery: lmSlvl })
    const tsDmg = Math.round((dmgRange.min + dmgRange.max) / 2)

    player.thunderstormTicks = duration
    player.thunderstormInterval = interval
    player.thunderstormNextStrike = interval
    player.thunderstormDamage = tsDmg
    player.thunderstormDamageRange = dmgRange
    player.thunderstormSlvl = slvl

    engine.spawnOverlay('thunderstormback', { x: player.x, y: player.y }, 'player', { loop: true, isStateOverlay: true })

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Thunder Storm active' : '雷云风暴已激活'
    return true
  }

  if (skillId === 58) {
    // Energy Shield (Skill 58)
    const slvl = resolveCastSkillLevel(58, player, hudManager, engine)
    const duration = calculateEnergyShieldDuration(slvl)
    const absorbPct = calculateEnergyShieldAbsorbPct(slvl)

    player.energyshieldTicks = duration
    player.energyshieldPct = absorbPct
    player.energyshieldSlvl = slvl

    engine.spawnOverlay('energyshield', { x: player.x, y: player.y }, 'player', { loop: true, isStateOverlay: true })

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Energy Shield active' : '能量护盾已激活'
    return true
  }

  if (skillId === 52) {
    // Enchant (Skill 52) — 1.13c Skills.txt: TargetAlly=1, TargetPet=1, InTown=1, srvdofunc=25
    const slvl = Math.max(1, (hudManager as any)?.getSkillLevel?.(52) ?? 1)
    const warmthLvl = (hudManager as any)?.getSkillLevel?.(37) ?? 0
    const fireMasterySlvl = (hudManager as any)?.getSkillLevel?.(61) ?? 0
    const duration = calculateEnchantDuration(slvl)
    const arBonus = calculateEnchantAttackRating(slvl)
    const dmg = calculateEnchantDamage(slvl, { warmth: warmthLvl }, fireMasterySlvl)

    let enchantTarget: any = player
    let bestDist = 80
    const candidates: any[] = []
    const summonsList: any[] = Array.isArray((player as any).summons)
      ? (player as any).summons
      : Array.isArray((engine.world as any).summons)
        ? (engine.world as any).summons
        : []
    for (const s of summonsList) {
      if (s && s.alive !== false && (s.hp === undefined || s.hp > 0)) candidates.push(s)
    }
    if ((engine as any).mercenary && (engine as any).mercenary.alive !== false) {
      candidates.push((engine as any).mercenary)
    }
    if ((player as any).mercenary && (player as any).mercenary.alive !== false) {
      candidates.push((player as any).mercenary)
    }
    if (Array.isArray((engine.world as any).players)) {
      for (const p of (engine.world as any).players) {
        if (p && p !== player && p.alive !== false) candidates.push(p)
      }
    }
    const distToSelf = Math.hypot((player.x ?? targetX) - targetX, (player.y ?? targetY) - targetY)
    for (const c of candidates) {
      const d = Math.hypot((c.x ?? 0) - targetX, (c.y ?? 0) - targetY)
      if (d <= bestDist && (d < distToSelf || distToSelf > 1e-3)) {
        bestDist = d
        enchantTarget = c
      }
    }

    enchantTarget.enchantTicks = duration
    enchantTarget.enchantAttackRatingPercent = arBonus
    enchantTarget.enchantDamage = { min: dmg.min, max: dmg.max }
    if (enchantTarget === player) {
      player.fireMasterySlvl = fireMasterySlvl
      player.isSorceress = true
    }

    const targetXPos = enchantTarget.x ?? player.x
    const targetYPos = enchantTarget.y ?? player.y
    const targetCasterId =
      enchantTarget === player ? 'player' : String(enchantTarget.uid ?? enchantTarget.id ?? 'ally')
    engine.spawnOverlay('enchant', { x: targetXPos, y: targetYPos }, targetCasterId, { loop: false })

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Enchant active' : '强化已激活'
    return true
  }

  if (skillId === 62) {
    // Hydra (Skill 62)
    const offsets = [
      { dx: -6, dy: -11 },
      { dx: 0, dy: -7 },
      { dx: 4, dy: -15 },
    ]
    const slvl = Math.max(1, (hudManager as any)?.getSkillLevel?.(62) ?? 1)
    const dmgRange = calculateSkillDamage(62, slvl)
    const hydraDamage = Math.round((dmgRange.min + dmgRange.max) / 2)

    const MAX_ACTIVE_HYDRA_GROUPS = 6
    const activeTurrets = engine.projectiles.filter(
      p => (p.isTurret || p.missileType === 'hydra_turret') && p.ttl > 0,
    )
    const existingGroupIds = Array.from(
      new Set(activeTurrets.map(p => (p as any).groupId ?? 0)),
    ).sort((a, b) => a - b)

    if (existingGroupIds.length >= MAX_ACTIVE_HYDRA_GROUPS) {
      const groupsToEvictCount = existingGroupIds.length - MAX_ACTIVE_HYDRA_GROUPS + 1
      const evictGids = new Set(existingGroupIds.slice(0, groupsToEvictCount))
      engine.projectiles = engine.projectiles.filter(
        p => !((p.isTurret || p.missileType === 'hydra_turret') && evictGids.has((p as any).groupId ?? 0)),
      )
    }

    const currentGroupId =
      engine.hydraGroupSeqCounter !== undefined
        ? ++engine.hydraGroupSeqCounter
        : ++hydraGroupSeqCounter
    for (let i = 0; i < offsets.length; i++) {
      const off = offsets[i]!
      engine.projectiles.push({
        skillId: '62',
        x: targetX + off.dx,
        y: targetY + off.dy,
        vx: 0,
        vy: 0,
        damage: hydraDamage,
        ttl: 250,
        fromPlayer: true,
        missileType: 'hydra_turret',
        isTurret: true,
        fireCadenceTicks: 25,
        headIndex: i,
        groupId: currentGroupId,
        spawnMissileType: 'hydra',
        pierce: false,
      } as any)
    }

    player.cooldown = 40
    engine.metrics.casts += 1
    status.textContent = isEn ? 'Cast Hydra' : '施展九头海蛇'
    return true
  }

  if (skillId === 68) {
    // Bone Armor
    const slvl = resolveCastSkillLevel(68, player, hudManager, engine)
    const boneWallBlvl = resolveBaseSkillLevel(78, player, hudManager, engine)
    const bonePrisonBlvl = resolveBaseSkillLevel(88, player, hudManager, engine)
    const capacity = calculateBoneArmorCapacity(slvl, { boneWall: boneWallBlvl, bonePrison: bonePrisonBlvl })

    ;(player as any).boneArmorHp = capacity
    ;(player as any).boneArmorMaxHp = capacity

    engine.spawnOverlay('bonearmor_cast', { x: player.x, y: player.y }, 'player')
    engine.spawnOverlay('bonearmor_front', { x: player.x, y: player.y }, 'player')
    engine.spawnOverlay('bonearmor_back', { x: player.x, y: player.y }, 'player')

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn
      ? `Cast Bone Armor, absorbs ${capacity} physical damage`
      : `施展白骨装甲，吸收 ${capacity} 点物理伤害`
    return true
  }

  if (skillId === 235) {
    // Cyclone Armor (#235, 1.13c SKILLS_SrvDo117_CycloneArmor 0x6FD12E50):
    // Absorbs Fire, Cold, and Lightning damage before resistances:
    // absorb = trunc(((40 + (slvl - 1) * 12) * (100 + (blvl(240) + blvl(245) + blvl(250)) * 7)) / 100)
    const slvl = resolveCastSkillLevel(235, player, hudManager, engine)
    const twisterBlvl = resolveBaseSkillLevel(240, player, hudManager, engine)
    const tornadoBlvl = resolveBaseSkillLevel(245, player, hudManager, engine)
    const hurricaneBlvl = resolveBaseSkillLevel(250, player, hudManager, engine)
    const synergyPct = (twisterBlvl + tornadoBlvl + hurricaneBlvl) * 7
    const baseCap = 40 + (slvl - 1) * 12
    const capacity = Math.trunc((baseCap * (100 + synergyPct)) / 100)

    ;(player as any).cycloneArmorHp = capacity
    ;(player as any).cycloneArmorMaxHp = capacity
    ;(player as any).cycloneArmorSlvl = slvl
    ;(player as any).states?.add?.(151)

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn
      ? `Cast Cyclone Armor, absorbs ${capacity} elemental damage`
      : `施展旋风装甲，吸收 ${capacity} 点元素伤害`
    return true
  }

  if (skillId === 223 || skillId === 228) {
    // 1.13c SKILLS_SrvDo117_Transform (Werewolf #223 / Werebear #228)
    const isWolf = skillId === 223
    const targetForm = isWolf ? 'werewolf' : 'werebear'
    const slvl = resolveCastSkillLevel(skillId, player, hudManager, engine)
    const lycSlvl = resolveCastSkillLevel(224, player, hudManager, engine)

    const clearChargeOrbs = () => {
      ;(player as any).feralRageCharges = 0
      ;(player as any).feralRageTicks = 0
      ;(player as any).maulCharges = 0
      ;(player as any).maulTicks = 0
      if (Array.isArray(engine.overlays)) {
        engine.overlays = engine.overlays.filter(
          (ov: any) => !ov.type?.startsWith('feralrage') && !ov.type?.startsWith('maul'),
        )
      }
    }

    if ((player as any).druidForm === targetForm) {
      // Unshift back to human form (nocostinstate = 1 already handled above)
      ;(player as any).druidForm = 'human'
      ;(player as any).druidFormTicks = 0
      ;(player as any).werewolfSlvl = 0
      ;(player as any).werebearSlvl = 0
      clearChargeOrbs()
      // Survival HP clamp: 1.13c sub_6FD118C0 keeps current HP in [1, maxHp]
      if (typeof player.maxHp === 'number' && player.maxHp > 0) {
        player.hp = Math.max(1, Math.min(player.hp, player.maxHp))
      }
      // 1.13c Skills.txt cltoverlayb (wolf_undo / bear_undo) on leaving the form
      engine.spawnOverlay(DRUID_TRANSFORM_CLT_OVERLAYS_113C[skillId].undo, { x: player.x, y: player.y }, 'player')
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn ? 'Returned to Human form' : '解除变形，恢复人形'
      return true
    }

    // Morph into Werewolf or Werebear (clears opposite form's charge orbs)
    clearChargeOrbs()
    const stats = isWolf ? calculateWerewolfStats(slvl, lycSlvl) : calculateWerebearStats(slvl, lycSlvl)
    ;(player as any).druidForm = targetForm
    ;(player as any).druidFormTicks = stats.durationFrames
    ;(player as any).lycanthropySlvl = lycSlvl
    if (isWolf) {
      ;(player as any).werewolfSlvl = slvl
      ;(player as any).werebearSlvl = 0
    } else {
      ;(player as any).werebearSlvl = slvl
      ;(player as any).werewolfSlvl = 0
    }
    // 1.13c Skills.txt cltoverlaya (wolf_into / bear_into) on entering the form
    engine.spawnOverlay(DRUID_TRANSFORM_CLT_OVERLAYS_113C[skillId].into, { x: player.x, y: player.y }, 'player')
    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn
      ? `Transformed into ${isWolf ? 'Werewolf' : 'Werebear'} (${Math.round(stats.durationFrames / 25)}s)`
      : `变形为${isWolf ? '狼人' : '熊人'}（持续 ${Math.round(stats.durationFrames / 25)} 秒）`
    return true
  }

  if (
    skillId === 232 ||
    skillId === 233 ||
    skillId === 238 ||
    skillId === 239 ||
    skillId === 242 ||
    skillId === 248
  ) {
    // 1.13c Druid Shape Shifting Melee Skills:
    // #232 Feral Rage, #233 Maul, #238 Rabies, #239 Fire Claws, #242 Hunger, #248 Fury
    const slvl = resolveCastSkillLevel(skillId, player, hudManager, engine)
    const weapon =
      context.equippedWeapon ??
      hudManager?.inventory?.equipped?.weapon1 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon1
    const weaponInfo = getAttackWeaponInfo(weapon)
    const basePhysDmg = Math.max(10, Math.round((weaponInfo.damageMin + weaponInfo.damageMax) / 2))
    const meleeRangePx = Math.max(110, weaponInfo.reach)

    const aliveEnemies = engine.world.monsters.filter(
      (en: Monster) => en.state !== 'dead' && en.hp > 0 && Math.hypot(en.x - player.x, en.y - player.y) <= meleeRangePx,
    )
    if (aliveEnemies.length === 0) {
      status.textContent = isEn ? 'No target in melee range!' : '近战范围内没有目标！'
      return false
    }
    aliveEnemies.sort(
      (a: Monster, b: Monster) =>
        Math.hypot(a.x - targetX, a.y - targetY) - Math.hypot(b.x - targetX, b.y - targetY),
    )
    const primaryTarget = aliveEnemies[0]!

    if (skillId === 232) {
      // #232 Feral Rage (SKILLS_SrvDo056_FeralRage): progressive charge orb (state 120)
      const prevCharges = (player as any).feralRageCharges || 0
      const frStats = calculateFeralRageStats(slvl, prevCharges)
      const nextCharges = Math.min(frStats.maxCharges, prevCharges + 1)
      const activeStats = calculateFeralRageStats(slvl, nextCharges)
      const physDmg = Math.max(1, Math.round((basePhysDmg * (100 + activeStats.damageBonusPct)) / 100))
      damageMonster(engine.world, primaryTarget.index, physDmg)
      const leechHp = Math.floor((physDmg * activeStats.lifeLeechPct) / 100)
      if (leechHp > 0 && typeof player.maxHp === 'number') {
        player.hp = Math.min(player.maxHp, player.hp + leechHp)
      }
      ;(player as any).feralRageCharges = nextCharges
      ;(player as any).feralRageTicks = activeStats.durationFrames
      ;(player as any).feralRageSlvl = slvl
      if (Array.isArray(engine.overlays)) {
        engine.overlays = engine.overlays.filter((ov: any) => !ov.type?.startsWith('feralrage'))
      }
      engine.spawnOverlay(activeStats.overlayName, { x: player.x, y: player.y }, 'player', {
        loop: true,
        isStateOverlay: true,
      })
      player.cooldown = 8
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Feral Rage hit (${physDmg} dmg, charge ${nextCharges}/${activeStats.maxCharges})`
        : `野性狂暴命中（${physDmg} 伤害，充能 ${nextCharges}/${activeStats.maxCharges}）`
      return true
    }

    if (skillId === 233) {
      // #233 Maul (SKILLS_SrvDo057_Maul): progressive charge orb (state 117) + stun
      const prevCharges = (player as any).maulCharges || 0
      const mStats = calculateMaulStats(slvl, prevCharges)
      const nextCharges = Math.min(mStats.maxCharges, prevCharges + 1)
      const activeStats = calculateMaulStats(slvl, nextCharges)
      const physDmg = Math.max(1, Math.round((basePhysDmg * (100 + activeStats.damageBonusPct)) / 100))
      damageMonster(engine.world, primaryTarget.index, physDmg)
      const targetAny = primaryTarget as any
      if (
        primaryTarget.hp > 0 &&
        !targetAny.isBoss &&
        targetAny.rank !== 'boss' &&
        targetAny.rank !== 'unique' &&
        targetAny.rank !== 'superunique' &&
        targetAny.rank !== 'champion'
      ) {
        targetAny.stunTimer = Math.max(targetAny.stunTimer || 0, activeStats.stunDurationFrames)
        engine.spawnOverlay('stun', { x: primaryTarget.x, y: primaryTarget.y })
      }
      ;(player as any).maulCharges = nextCharges
      ;(player as any).maulTicks = activeStats.durationFrames
      ;(player as any).maulSlvl = slvl
      if (Array.isArray(engine.overlays)) {
        engine.overlays = engine.overlays.filter((ov: any) => !ov.type?.startsWith('maul'))
      }
      engine.spawnOverlay(activeStats.overlayName, { x: player.x, y: player.y }, 'player', {
        loop: true,
        isStateOverlay: true,
      })
      player.cooldown = 9
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Maul hit (${physDmg} dmg, charge ${nextCharges}/${activeStats.maxCharges})`
        : `撞击命中（${physDmg} 伤害，充能 ${nextCharges}/${activeStats.maxCharges}）`
      return true
    }

    if (skillId === 238) {
      // #238 Rabies (SKILLS_SrvDo120_Rabies): SrcDam=0 pure poison bite + contagion spread within 7 subtiles (140px)
      const creeperBlvl = resolveBaseSkillLevel(222, player, hudManager, engine)
      const rStats = calculateRabiesStats(slvl, creeperBlvl)
      const totalPoisonDmg = Math.max(1, Math.round((rStats.minPoisonDamage + rStats.maxPoisonDamage) / 2))
      const immediateTickDmg = Math.max(1, Math.round(totalPoisonDmg / Math.max(1, rStats.poisonDurationFrames / 25)))
      const contagionRadiusPx = rStats.contagionRadiusSubtiles * 20 // 7 subtiles = 140px
      let infectedCount = 0
      for (const en of engine.world.monsters) {
        if (en.state === 'dead' || en.hp <= 0) continue
        if (en === primaryTarget || Math.hypot(en.x - primaryTarget.x, en.y - primaryTarget.y) <= contagionRadiusPx) {
          damageMonster(engine.world, en.index, immediateTickDmg)
          ;(en as any).poisonTimer = Math.max((en as any).poisonTimer || 0, rStats.poisonDurationFrames)
          ;(en as any).rabiesDamagePerTick = Math.max(1, Math.round(totalPoisonDmg / rStats.poisonDurationFrames))
          engine.spawnOverlay('poison_hit', { x: en.x, y: en.y })
          infectedCount++
        }
      }
      player.cooldown = 8
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Rabies infected ${infectedCount} target(s) (${totalPoisonDmg} poison dmg over ${Math.round(rStats.poisonDurationFrames / 25)}s)`
        : `狂犬病感染 ${infectedCount} 个目标（${Math.round(rStats.poisonDurationFrames / 25)} 秒内造成 ${totalPoisonDmg} 毒素伤害）`
      return true
    }

    if (skillId === 239) {
      // #239 Fire Claws: weapon physical hit + heavy fire elemental claw damage (22% per blvl from #225/#229/#234/#244)
      const fsBlvl = resolveBaseSkillLevel(225, player, hudManager, engine)
      const mbBlvl = resolveBaseSkillLevel(229, player, hudManager, engine)
      const fisBlvl = resolveBaseSkillLevel(234, player, hudManager, engine)
      const volBlvl = resolveBaseSkillLevel(244, player, hudManager, engine)
      const fcStats = calculateFireClawsStats(slvl, fsBlvl, mbBlvl, volBlvl, fisBlvl)
      const fireDmg = Math.round((fcStats.minFireDamage + fcStats.maxFireDamage) / 2)
      const totalDmg = basePhysDmg + fireDmg
      damageMonster(engine.world, primaryTarget.index, totalDmg)
      engine.spawnOverlay('firehit1', { x: primaryTarget.x, y: primaryTarget.y })
      player.cooldown = 8
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Fire Claws dealt ${totalDmg} damage (${fireDmg} fire)`
        : `焰爪造成 ${totalDmg} 点伤害（含 ${fireDmg} 火焰伤害）`
      return true
    }

    if (skillId === 242) {
      // #242 Hunger (SKILLS_SrvDo122_Hunger): -75% physical damage penalty + massive life/mana leech dm(50, 200, slvl)
      const hStats = calculateHungerStats(slvl)
      const physDmg = Math.max(1, Math.floor((basePhysDmg * (100 + hStats.damagePenaltyPct)) / 100))
      damageMonster(engine.world, primaryTarget.index, physDmg)
      const leechHp = Math.max(1, Math.floor((physDmg * hStats.lifeLeechPct) / 100))
      const leechMp = Math.max(1, Math.floor((physDmg * hStats.manaLeechPct) / 100))
      if (typeof player.maxHp === 'number') {
        player.hp = Math.min(player.maxHp, player.hp + leechHp)
      }
      if (typeof player.maxMana === 'number') {
        player.mana = Math.min(player.maxMana, player.mana + leechMp)
      }
      player.cooldown = 7
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Hunger bit for ${physDmg} dmg, leeched +${leechHp} HP / +${leechMp} Mana`
        : `饥饿撕咬造成 ${physDmg} 伤害，吸取 +${leechHp} 生命 / +${leechMp} 法力`
      return true
    }

    if (skillId === 248) {
      // #248 Fury (SKILLS_SrvDo123_Fury): min(5, max(2, 1 + slvl)) rapid multi-hit melee sequence
      const fStats = calculateFuryStats(slvl)
      const perHitDmg = Math.max(1, Math.round((basePhysDmg * (100 + fStats.damageBonusPct)) / 100))
      let totalDealt = 0
      for (let i = 0; i < fStats.attackCount; i++) {
        const currentAlive = engine.world.monsters.filter(
          (en: Monster) => en.state !== 'dead' && en.hp > 0 && Math.hypot(en.x - player.x, en.y - player.y) <= meleeRangePx,
        )
        if (currentAlive.length === 0) break
        const target = currentAlive[i % currentAlive.length]!
        damageMonster(engine.world, target.index, perHitDmg)
        totalDealt += perHitDmg
      }
      player.cooldown = 10
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Fury unleashed ${fStats.attackCount} hits for ${totalDealt} total damage`
        : `狂怒发动 ${fStats.attackCount} 次连击，共造成 ${totalDealt} 点伤害`
      return true
    }
  }

  if (
    skillId === 254 ||
    skillId === 255 ||
    skillId === 259 ||
    skillId === 260 ||
    skillId === 265 ||
    skillId === 269 ||
    skillId === 270 ||
    skillId === 274 ||
    skillId === 275 ||
    skillId === 280
  ) {
    // 1.13c Assassin Martial Arts Tree (#254-#280):
    // Charge-ups: #254 Tiger Strike, #259 Fists of Fire, #265 Cobra Strike, #269 Claws of Thunder, #274 Blades of Ice, #280 Phoenix Strike
    // Finishers: #255 Dragon Talon, #260 Dragon Claw, #270 Dragon Tail, #275 Dragon Flight
    const slvl = resolveCastSkillLevel(skillId, player, hudManager, engine)
    const weapon =
      context.equippedWeapon ??
      hudManager?.inventory?.equipped?.weapon1 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon1
    const offWeapon =
      (context as any).equippedOffHandWeapon ??
      (player as any)?.offHandWeapon ??
      hudManager?.inventory?.equipped?.weapon2 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon2
    const weaponInfo = getAttackWeaponInfo(weapon)
    const basePhysDmg = Math.max(10, Math.round((weaponInfo.damageMin + weaponInfo.damageMax) / 2))
    const isDualClaw = Boolean(
      (context as any).isDualClaw ||
        (context as any).hasDualWield ||
        (player as any)?.isDualClaw ||
        (player as any)?.hasDualWield ||
        offWeapon,
    )

    const engageRangePx = skillId === 275 ? 450 : Math.max(110, weaponInfo.reach)
    const aliveEnemies = engine.world.monsters.filter(
      (en: Monster) =>
        en.state !== 'dead' &&
        en.hp > 0 &&
        Math.hypot(en.x - player.x, en.y - player.y) <= engageRangePx,
    )
    if (aliveEnemies.length === 0) {
      status.textContent = isEn
        ? (skillId === 275 ? 'No target in Dragon Flight range!' : 'No target in melee range!')
        : (skillId === 275 ? '飞龙在天范围内没有目标！' : '近战范围内没有目标！')
      return false
    }
    aliveEnemies.sort(
      (a: Monster, b: Monster) =>
        Math.hypot(a.x - targetX, a.y - targetY) - Math.hypot(b.x - targetX, b.y - targetY),
    )
    const primaryTarget = aliveEnemies[0]!

    if (!(player as any).martialCharges) {
      ;(player as any).martialCharges = {}
    }
    if (!(player as any).chargeCounts) {
      ;(player as any).chargeCounts = new Map<number, number>()
    }
    const martialCharges = (player as any).martialCharges as Record<
      number,
      { count: number; slvl: number; expiresAtTick: number }
    >
    const chargeCountsMap = (player as any).chargeCounts as Map<number, number>

    const isChargeUpSkill =
      skillId === 254 ||
      skillId === 259 ||
      skillId === 265 ||
      skillId === 269 ||
      skillId === 274 ||
      skillId === 280

    if (isChargeUpSkill) {
      // 1.13c SKILLS_SrvDo035 (#259, #269, #274): swings both claws when dual-wielding (up to 2 charges per cast)
      // SKILLS_SrvDo034 (#254, #265, #280): swings 1 weapon per cast
      const swingCount =
        (skillId === 259 || skillId === 269 || skillId === 274) && isDualClaw ? 2 : 1
      const totalPhysDealt = basePhysDmg * swingCount
      damageMonster(engine.world, primaryTarget.index, totalPhysDealt)

      const prevEntry = martialCharges[skillId]
      const prevCount = prevEntry?.count ?? chargeCountsMap.get(skillId) ?? 0
      const nextCount = Math.min(3, prevCount + swingCount)
      martialCharges[skillId] = {
        count: nextCount,
        slvl,
        expiresAtTick: ((engine.world as any).tick ?? 0) + 375,
      }
      chargeCountsMap.set(skillId, nextCount)

      const overlayPrefixBySkill: Record<number, { prog: string; prg?: string }> = {
        254: { prog: 'progressive_damage_', prg: 'tigerstrike' },
        265: { prog: 'progressive_steal_', prg: 'cobrastrike' },
        280: { prog: 'progressive_other_' },
        259: { prog: 'progressive_fire_' },
        269: { prog: 'progressive_lightning_' },
        274: { prog: 'progressive_cold_' },
      }
      const ovSpec = overlayPrefixBySkill[skillId]!
      if (Array.isArray(engine.overlays)) {
        engine.overlays = engine.overlays.filter(
          (ov: any) =>
            !ov.type?.startsWith(ovSpec.prog) &&
            !(ovSpec.prg && ov.type?.startsWith(ovSpec.prg)),
        )
      }
      engine.spawnOverlay(`${ovSpec.prog}${nextCount}`, { x: player.x, y: player.y }, 'player', {
        loop: true,
        isStateOverlay: true,
      })
      if (ovSpec.prg) {
        engine.spawnOverlay(`${ovSpec.prg}${nextCount}`, { x: player.x, y: player.y }, 'player', {
          loop: true,
          isStateOverlay: false,
        })
      }

      player.cooldown = 8
      engine.metrics.casts += 1
      engine.metrics.playerHits += swingCount
      const sNameZh: Record<number, string> = {
        254: '虎击',
        259: '烈焰拳',
        265: '眼镜蛇攻击',
        269: '雷电爪',
        274: '寒冰刃',
        280: '凤凰攻击',
      }
      const sNameEn = getSkillDisplayName(skillId, 'ENG')
      status.textContent = isEn
        ? `${sNameEn} hit (${totalPhysDealt} dmg, charge ${nextCount}/3)`
        : `${sNameZh[skillId] ?? sNameEn}命中（${totalPhysDealt} 伤害，聚气 ${nextCount}/3）`
      return true
    }

    // Finishing Moves (#255 Dragon Talon, #260 Dragon Claw, #270 Dragon Tail, #275 Dragon Flight)
    if (skillId === 275) {
      // Dragon Flight (#275): teleport to target and kick
      engine.spawnOverlay('dragonflight', { x: player.x, y: player.y }, 'player')
      player.x = primaryTarget.x
      player.y = primaryTarget.y
      engine.spawnOverlay('dragonflight', { x: player.x, y: player.y }, 'player')
    }

    // Compute kick physical damage per 1.13c SKILLS_CalculateKickDamage (0x6FC9AE10)
    const str = Number((player as any).strength ?? (player as any).str ?? 50)
    const dex = Number((player as any).dexterity ?? (player as any).dex ?? 50)
    const boots =
      (context as any).equippedBoots ??
      (player as any)?.equippedBoots ??
      (hudManager?.inventory?.equipped as any)?.boots
    const bootMin = Number(boots?.minDam ?? boots?.kickMinDam ?? (player as any).bootMinDam ?? 8)
    const bootMax = Number(boots?.maxDam ?? boots?.kickMaxDam ?? (player as any).bootMaxDam ?? 16)
    const kickSkillED =
      skillId === 255
        ? 5 + 7 * (slvl - 1)
        : skillId === 275
          ? 100 + 25 * (slvl - 1)
          : 0
    const attrMin = Math.max(1, Math.floor(Math.max(0, dex + str - 20) / 4))
    const attrMax = Math.max(2, Math.floor(Math.max(0, dex + str - 20) / 3))
    const strBootBonus = Math.floor((str * 120) / 100)
    const kickMin =
      Math.floor((attrMin * (100 + kickSkillED)) / 100) +
      Math.floor((bootMin * (100 + strBootBonus + kickSkillED)) / 100)
    const kickMax =
      Math.floor((attrMax * (100 + kickSkillED)) / 100) +
      Math.floor((bootMax * (100 + strBootBonus + kickSkillED)) / 100)
    const kickAvgDmg = Math.max(1, Math.round((kickMin + kickMax) / 2))

    const cmBlvl = resolveBaseSkillLevel(252, player, hudManager, engine)
    const dcStats = evaluateDragonClawStats(slvl, cmBlvl)
    const dtalonStats = evaluateDragonTalonStats(slvl)
    const dtailStats = evaluateDragonTailStats(slvl)
    const dflightStats = evaluateDragonFlightStats(slvl)

    const finisherHits =
      skillId === 255
        ? dtalonStats.kickCount
        : skillId === 260
          ? dcStats.strikesCount
          : 1
    const perHitPhysDmg =
      skillId === 260
        ? Math.max(1, Math.round((basePhysDmg * (100 + dcStats.enhancedDamagePct)) / 100))
        : kickAvgDmg

    let totalDealt = 0
    let firstHitPhysDealt = 0
    let activeFofConvPct = 0
    let discharged = false

    for (let h = 0; h < finisherHits; h += 1) {
      const curAlive = engine.world.monsters.filter(
        (en: Monster) =>
          en.state !== 'dead' &&
          en.hp > 0 &&
          Math.hypot(en.x - player.x, en.y - player.y) <= Math.max(110, weaponInfo.reach),
      )
      const hitTarget = curAlive[0] ?? primaryTarget
      if (!hitTarget || hitTarget.state === 'dead' || hitTarget.hp <= 0) break

      let strikePhys = perHitPhysDmg
      if (!discharged) {
        const activeOrbs: ActiveChargeOrb[] = []
        for (const cId of [254, 259, 265, 269, 274, 280]) {
          const count = martialCharges[cId]?.count ?? chargeCountsMap.get(cId) ?? 0
          if (count > 0) {
            const cSlvl =
              martialCharges[cId]?.slvl ?? resolveCastSkillLevel(cId, player, hudManager, engine)
            activeOrbs.push({
              skillId: cId,
              count: Math.min(3, count),
              slvl: cSlvl,
              expiresAtFrame: 375,
            })
          }
        }

        if (activeOrbs.length > 0) {
          const fofBlvl = resolveBaseSkillLevel(259, player, hudManager, engine)
          const cotBlvl = resolveBaseSkillLevel(269, player, hudManager, engine)
          const boiBlvl = resolveBaseSkillLevel(274, player, hudManager, engine)
          const rsBlvl = resolveBaseSkillLevel(280, player, hudManager, engine)
          const payloads = resolveFinisherDischarge(activeOrbs, {
            clawMasteryBlvl: cmBlvl,
            fistsOfFireBlvl: fofBlvl,
            clawsOfThunderBlvl: cotBlvl,
            bladesOfIceBlvl: boiBlvl,
            royalStrikeBlvl: rsBlvl,
          })

          for (const p of payloads) {
            if (p.enhancedDamagePct) {
              strikePhys = Math.round((strikePhys * (100 + p.enhancedDamagePct)) / 100)
            }
          }

          const fofOrb = activeOrbs.find(o => o.skillId === 259)
          if (fofOrb) {
            activeFofConvPct = Math.min(100, fofOrb.slvl * 3)
          }

          const postConvPhys = Math.floor((strikePhys * (100 - activeFofConvPct)) / 100)

          for (const p of payloads) {
            if (p.lifeStealPct && typeof player.maxHp === 'number') {
              const heal = Math.floor((postConvPhys * p.lifeStealPct) / 100)
              player.hp = Math.min(player.maxHp, player.hp + heal)
            }
            if (p.manaStealPct && typeof player.maxMana === 'number') {
              const mGain = Math.floor((postConvPhys * p.manaStealPct) / 100)
              player.mana = Math.min(player.maxMana, player.mana + mGain)
            }
            if (p.fireDamage) {
              const fDmg = Math.max(1, Math.round((p.fireDamage.min + p.fireDamage.max) / 2))
              damageMonster(engine.world, hitTarget.index, fDmg)
              totalDealt += fDmg
              if (p.chargeLevel >= 2) {
                engine.explosions.push({
                  missileType: 'fistsoffireexplode',
                  x: hitTarget.x,
                  y: hitTarget.y,
                  frame: 0,
                  maxFrames: 12,
                })
                for (const m of engine.world.monsters) {
                  if (m === hitTarget || m.state === 'dead' || m.hp <= 0) continue
                  if (Math.hypot(m.x - hitTarget.x, m.y - hitTarget.y) <= 64) {
                    damageMonster(engine.world, m.index, fDmg)
                    totalDealt += fDmg
                  }
                }
              }
              if (p.chargeLevel >= 3) {
                engine.projectiles.push({
                  skillId: '259',
                  slvl: p.slvl,
                  x: hitTarget.x,
                  y: hitTarget.y,
                  vx: 0,
                  vy: 0,
                  damage: fDmg,
                  ttl: 64,
                  fromPlayer: true,
                  missileType: 'fistsoffirefirewall',
                })
              }
            }
            if (p.ltngDamage) {
              const lDmg = Math.max(1, Math.round((p.ltngDamage.min + p.ltngDamage.max) / 2))
              damageMonster(engine.world, hitTarget.index, lDmg)
              totalDealt += lDmg
              if (p.ltngDamage.hasNova) {
                for (let nIdx = 0; nIdx < 16; nIdx += 1) {
                  const ang = (nIdx / 16) * Math.PI * 2
                  engine.projectiles.push({
                    skillId: '269',
                    slvl: p.slvl,
                    x: hitTarget.x,
                    y: hitTarget.y,
                    vx: Math.cos(ang) * 12,
                    vy: Math.sin(ang) * 12 * ISO_GROUND_ASPECT_RATIO,
                    damage: lDmg,
                    ttl: 13,
                    fromPlayer: true,
                    missileType: 'clawsofthundernova',
                    nextHit: 1,
                    nextDelay: 4,
                  })
                }
              }
              if (p.ltngDamage.chargedBoltsCount) {
                const bCount = p.ltngDamage.chargedBoltsCount
                for (let bIdx = 0; bIdx < bCount; bIdx += 1) {
                  const ang = (bIdx / bCount) * Math.PI * 2
                  engine.projectiles.push({
                    skillId: '269',
                    slvl: p.slvl,
                    x: hitTarget.x,
                    y: hitTarget.y,
                    vx: Math.cos(ang) * 8,
                    vy: Math.sin(ang) * 8 * ISO_GROUND_ASPECT_RATIO,
                    damage: lDmg,
                    ttl: 40,
                    fromPlayer: true,
                    missileType: 'clawsofthunderbolt',
                    jitter: true,
                    nextHit: 1,
                    nextDelay: 4,
                  })
                }
              }
            }
            if (p.coldDamage) {
              const cDmg = Math.max(1, Math.round((p.coldDamage.min + p.coldDamage.max) / 2))
              damageMonster(engine.world, hitTarget.index, cDmg)
              totalDealt += cDmg
              if (p.chargeLevel >= 2) {
                engine.explosions.push({
                  missileType: 'bladesoficeexplode',
                  x: hitTarget.x,
                  y: hitTarget.y,
                  frame: 0,
                  maxFrames: 12,
                })
                for (const m of engine.world.monsters) {
                  if (m === hitTarget || m.state === 'dead' || m.hp <= 0) continue
                  if (Math.hypot(m.x - hitTarget.x, m.y - hitTarget.y) <= 96) {
                    damageMonster(engine.world, m.index, cDmg)
                    ;(m as any).statusEffect = 'chill'
                    ;(m as any).statusDuration = 100 + 10 * (p.slvl - 1)
                    totalDealt += cDmg
                  }
                }
              }
              if (p.chargeLevel >= 3) {
                engine.explosions.push({
                  missileType: 'bladesoficecubes',
                  x: hitTarget.x,
                  y: hitTarget.y,
                  frame: 0,
                  maxFrames: 15,
                })
                const frzDur = p.coldDamage.freezeDurationFrames ?? 100 + 10 * (p.slvl - 1)
                for (const m of engine.world.monsters) {
                  if (m.state === 'dead' || m.hp <= 0) continue
                  if (m === hitTarget || Math.hypot(m.x - hitTarget.x, m.y - hitTarget.y) <= 48) {
                    ;(m as any).statusEffect = 'freeze'
                    ;(m as any).statusDuration = frzDur
                  }
                }
              }
            }
            if (p.phoenixPayload) {
              if (p.phoenixPayload.type === 'meteor') {
                const mDmg = Math.max(
                  1,
                  Math.round(
                    ((p.phoenixPayload.meteorDamage?.min ?? 20) +
                      (p.phoenixPayload.meteorDamage?.max ?? 40)) /
                      2,
                  ),
                )
                engine.projectiles.push({
                  skillId: '280',
                  slvl: p.slvl,
                  x: hitTarget.x,
                  y: hitTarget.y,
                  vx: 0,
                  vy: 0,
                  damage: mDmg,
                  ttl: 60,
                  fromPlayer: true,
                  missileType: 'royalstrikemeteorcenter',
                  aoeRadius: 96,
                  aoeDamage: mDmg,
                  fireDuration: 30 + 15 * (p.slvl - 1),
                })
                damageMonster(engine.world, hitTarget.index, mDmg)
                totalDealt += mDmg
              } else if (p.phoenixPayload.type === 'chain_lightning') {
                const clDmg = Math.max(
                  1,
                  Math.round((1 + (p.phoenixPayload.chainLightningDamage?.max ?? 40)) / 2),
                )
                const clCount = p.phoenixPayload.chainLightningDamage?.boltsCount ?? 7
                const clBounces = p.phoenixPayload.chainLightningDamage?.maxTargets ?? 5 + p.slvl
                for (let bIdx = 0; bIdx < clCount; bIdx += 1) {
                  const ang = (bIdx * 10 * Math.PI * 2) / 64
                  engine.projectiles.push({
                    skillId: '280',
                    slvl: p.slvl,
                    x: hitTarget.x,
                    y: hitTarget.y,
                    vx: Math.cos(ang) * 16,
                    vy: Math.sin(ang) * 16 * ISO_GROUND_ASPECT_RATIO,
                    damage: clDmg,
                    ttl: 40,
                    fromPlayer: true,
                    missileType: 'royalstrikechainlightning',
                    chainRemaining: clBounces,
                    nextHit: 1,
                    nextDelay: 4,
                  })
                }
                damageMonster(engine.world, hitTarget.index, clDmg)
                totalDealt += clDmg
              } else if (p.phoenixPayload.type === 'chaos_ice') {
                const ciDmg = Math.max(
                  1,
                  Math.round(
                    ((p.phoenixPayload.chaosIceDamage?.min ?? 16) +
                      (p.phoenixPayload.chaosIceDamage?.max ?? 32)) /
                      2,
                  ),
                )
                const ciCount = p.phoenixPayload.chaosIceDamage?.boltsCount ?? 16
                const ciFreeze = p.phoenixPayload.chaosIceDamage?.freezeFrames ?? 100
                for (let bIdx = 0; bIdx < ciCount; bIdx += 1) {
                  const ang = (bIdx / ciCount) * Math.PI * 2
                  engine.projectiles.push({
                    skillId: '280',
                    slvl: p.slvl,
                    x: hitTarget.x,
                    y: hitTarget.y,
                    vx: Math.cos(ang) * 10,
                    vy: Math.sin(ang) * 10 * ISO_GROUND_ASPECT_RATIO,
                    damage: ciDmg,
                    ttl: 40,
                    fromPlayer: true,
                    missileType: 'royalstrikechaosice',
                    pierce: true,
                    statusEffect: 'freeze',
                    statusDuration: ciFreeze,
                    spiral: { originX: hitTarget.x, originY: hitTarget.y, angle: ang, radius: 12 },
                    nextHit: 1,
                    nextDelay: 4,
                  })
                }
                damageMonster(engine.world, hitTarget.index, ciDmg)
                ;(hitTarget as any).statusEffect = 'freeze'
                ;(hitTarget as any).statusDuration = ciFreeze
                totalDealt += ciDmg
              }
            }
          }

          for (const k of Object.keys(martialCharges)) {
            delete martialCharges[Number(k)]
          }
          chargeCountsMap.clear()
          if (Array.isArray(engine.overlays)) {
            engine.overlays = engine.overlays.filter(
              (ov: any) =>
                !ov.type?.startsWith('progressive_') &&
                !ov.type?.startsWith('tigerstrike') &&
                !ov.type?.startsWith('cobrastrike'),
            )
          }
          discharged = true
        }
      }

      damageMonster(engine.world, hitTarget.index, strikePhys)
      totalDealt += strikePhys
      if (h === 0) {
        firstHitPhysDealt = strikePhys
      }
      engine.metrics.playerHits += 1
    }

    if (skillId === 270 && firstHitPhysDealt > 0) {
      // Dragon Tail (#270): 4-yard (6 subtiles = 96px) Fire explosion scaling off post-FoF-conversion physical damage,
      // hitting ALL targets in radius INCLUDING primaryTarget!
      const remainingPhys = Math.floor((firstHitPhysDealt * (100 - activeFofConvPct)) / 100)
      const fireAoeDmg = Math.floor((remainingPhys * dtailStats.fireExplosionPct) / 100)
      engine.explosions.push({
        missileType: 'dragontail missile',
        x: primaryTarget.x,
        y: primaryTarget.y,
        frame: 0,
        maxFrames: 12,
      })
      if (fireAoeDmg > 0) {
        for (const m of engine.world.monsters) {
          if (m.state === 'dead' || m.hp <= 0) continue
          if (m === primaryTarget || Math.hypot(m.x - primaryTarget.x, m.y - primaryTarget.y) <= 96) {
            damageMonster(engine.world, m.index, fireAoeDmg)
            totalDealt += fireAoeDmg
          }
        }
      }
    }

    player.cooldown = skillId === 275 ? dflightStats.nextDelayFrames * 6 + 1 : 8
    if (skillId === 275) {
      player.cooldown = 25 // 1.13c Delay = 25 frames (1.0s)
    }
    engine.metrics.casts += 1
    const finisherNamesZh: Record<number, string> = {
      255: '龙爪踢',
      260: '双龙爪',
      270: '神龙摆尾',
      275: '飞龙在天',
    }
    const fNameEn = getSkillDisplayName(skillId, 'ENG')
    status.textContent = isEn
      ? `${fNameEn} dealt ${totalDealt} total damage`
      : `${finisherNamesZh[skillId] ?? fNameEn}造成 ${totalDealt} 点总伤害`
    return true
  }

  if (
    skillId === 221 ||
    skillId === 222 ||
    skillId === 226 ||
    skillId === 227 ||
    skillId === 231 ||
    skillId === 236 ||
    skillId === 237 ||
    skillId === 241 ||
    skillId === 246 ||
    skillId === 247
  ) {
    // 1.13c Druid Summoning Skills (#221..#247): all 10 have restrict = 1 (castable in Human, Werewolf, and Werebear forms)
    const slvl = resolveCastSkillLevel(skillId, player, hudManager, engine)
    const ownerLevel = Number((player as any).level ?? (hudManager as any)?.level ?? 80)
    const diffRaw = ((engine as any)?.difficulty ?? (engine?.world as any)?.difficulty ?? 'normal') as
      | 'normal'
      | 'nightmare'
      | 'hell'
      | 0
      | 1
      | 2

    const resolveDruidSummonCrossLvl = (id: number): number => {
      if (id === skillId) return slvl
      const learned = resolveLearnedEffectiveSkillLevel(id, player, hudManager, engine)
      if (learned > 0) return learned
      const pAny = player as any
      const bonusOnly =
        typeof pAny?.bonusSkillLevels?.[id] === 'number'
          ? Number(pAny.bonusSkillLevels[id])
          : typeof pAny?.combatContext?.statList?.getEffectiveSkillLevel === 'function' &&
              pAny.combatContext.statList.getEffectiveSkillLevel(id) >
                pAny.combatContext.statList.getEffectiveSkillLevel(0)
            ? Number(pAny.combatContext.statList.getEffectiveSkillLevel(id))
            : 0
      return Math.max(0, Math.floor(bonusOnly))
    }

    const applyTotemStateToPlayer = (
      stateName: 'oaksage' | 'wolverine' | 'barbs',
      auraSkillId: number,
      statsObj: Record<string, number>,
    ) => {
      ;(player as any).activeDruidTotemAura = stateName
      const sb = (player as any)?.combatContext?.stateBus
      if (sb && typeof sb.applyState === 'function' && typeof sb.removeState === 'function') {
        for (const other of ['oaksage', 'wolverine', 'barbs'] as const) {
          if (other !== stateName) sb.removeState(other)
        }
        sb.applyState({
          stateNameOrId: stateName,
          sourceUnitId: 'totem',
          sourceSkillId: auraSkillId,
          slvl,
          durationFrames: 130,
          stats: statsObj,
          isAuraOverride: true,
        })
      }
    }

    if (skillId === 221) {
      const stats = calculateRavenStats(slvl, ownerLevel)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 221,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'raven',
        petGroup: 0,
        maxPets: stats.maxCount,
        hp: stats.hp,
        kind: 'raven',
        monId: 'raven',
        extra: {
          minDamage: stats.minDamage,
          maxDamage: stats.maxDamage,
          shotsRemaining: stats.hitCount,
          hitCount: stats.hitCount,
          petLevel: stats.petLevel,
          blindChancePct: stats.blindChancePct,
          dimVisionSlvl: stats.dimVisionSlvl,
          dimVisionDurationFrames: stats.dimVisionDurationFrames,
          unsummonable: false,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Raven (Level ${slvl}, Max ${stats.maxCount}, ${stats.hitCount} hits) summoned`
        : `乌鸦（等级 ${slvl}，上限 ${stats.maxCount} 只，${stats.hitCount} 次啄击）召唤成功`
      return true
    }

    if (skillId === 222) {
      const stats = calculatePoisonCreeperStats(slvl, ownerLevel)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 222,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'vine',
        petGroup: 2,
        maxPets: 1,
        hp: stats.hp,
        kind: 'poison_creeper',
        monId: 'plaguepoppy',
        extra: {
          poisonMinRate256: stats.poisonMinRate256,
          poisonMaxRate256: stats.poisonMaxRate256,
          poisonLengthFrames: stats.poisonLengthFrames,
          totalPoisonMin: stats.totalPoisonMin,
          totalPoisonMax: stats.totalPoisonMax,
          petLevel: stats.petLevel,
          subSkillId: 294,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Poison Creeper (Level ${slvl}, ${stats.totalPoisonMin}-${stats.totalPoisonMax} poison dmg) summoned`
        : `剧毒花藤（等级 ${slvl}，${stats.totalPoisonMin}-${stats.totalPoisonMax} 毒素伤害）召唤成功`
      return true
    }

    if (skillId === 226) {
      const stats = calculateOakSageStats(slvl, diffRaw)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 226,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'totem',
        petGroup: 1,
        maxPets: 1,
        hp: stats.hp,
        kind: 'oak_sage',
        monId: 'oaksage',
        extra: {
          auraSkillId: 296,
          auraState: 'oaksage',
          maxLifeBonusPct: stats.maxLifeBonusPct,
          radiusSubtiles: stats.auraRadiusSubtiles,
          resistances: stats.resistances,
        },
      })
      applyTotemStateToPlayer('oaksage', 296, { item_maxhp_percent: stats.maxLifeBonusPct })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Oak Sage (Level ${slvl}, +${stats.maxLifeBonusPct}% Max Life) summoned`
        : `橡木智者（等级 ${slvl}，+${stats.maxLifeBonusPct}% 最大生命）召唤成功`
      return true
    }

    if (skillId === 227) {
      const swLvl = resolveDruidSummonCrossLvl(227)
      const dwLvl = resolveDruidSummonCrossLvl(237)
      const gzLvl = resolveDruidSummonCrossLvl(247)
      const stats = calculateSummonSpiritWolfStats(swLvl, dwLvl, gzLvl)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 227,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'spiritwolf',
        petGroup: 3,
        maxPets: stats.maxCount,
        hp: stats.hp,
        kind: 'spirit_wolf',
        monId: 'spiritwolf',
        extra: {
          minDamage: stats.minDamage,
          maxDamage: stats.maxDamage,
          attackRatingBonusPct: stats.attackRatingBonusPct,
          defenseBonusPct: stats.defenseBonusPct,
          synergyLifePct: stats.synergyLifePct,
          synergyDamagePct: stats.synergyDamagePct,
          allResistancesPct: stats.allResistancesPct,
          subSkillId: 292,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Summon Spirit Wolf (Level ${slvl}, Max ${stats.maxCount}) summoned`
        : `召唤灵狼（等级 ${slvl}，上限 ${stats.maxCount} 只）召唤成功`
      return true
    }

    if (skillId === 231) {
      const stats = calculateCarrionVineStats(slvl, ownerLevel)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 231,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'vine',
        petGroup: 2,
        maxPets: 1,
        hp: stats.hp,
        kind: 'carrion_vine',
        monId: 'cycleoflife',
        extra: {
          healMaxHpPct: stats.healMaxHpPct,
          petLevel: stats.petLevel,
          subSkillId: 307,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Carrion Vine (Level ${slvl}, heals ${stats.healMaxHpPct}% Max HP per corpse) summoned`
        : `食尸藤（等级 ${slvl}，吞噬尸体回复 ${stats.healMaxHpPct}% 最大生命）召唤成功`
      return true
    }

    if (skillId === 236) {
      const stats = calculateHeartOfWolverineStats(slvl, diffRaw)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 236,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'totem',
        petGroup: 1,
        maxPets: 1,
        hp: stats.hp,
        kind: 'heart_of_wolverine',
        monId: 'heartofwolverine',
        extra: {
          auraSkillId: 297,
          auraState: 'wolverine',
          damageBonusPct: stats.damageBonusPct,
          attackRatingBonusPct: stats.attackRatingBonusPct,
          radiusSubtiles: stats.auraRadiusSubtiles,
          resistances: stats.resistances,
        },
      })
      applyTotemStateToPlayer('wolverine', 297, {
        damagepercent: stats.damageBonusPct,
        item_tohit_percent: stats.attackRatingBonusPct,
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Heart of Wolverine (Level ${slvl}, +${stats.damageBonusPct}% Damage, +${stats.attackRatingBonusPct}% AR) summoned`
        : `狼獾之心（等级 ${slvl}，+${stats.damageBonusPct}% 伤害，+${stats.attackRatingBonusPct}% 命中率）召唤成功`
      return true
    }

    if (skillId === 237) {
      const swLvl = resolveDruidSummonCrossLvl(227)
      const dwLvl = resolveDruidSummonCrossLvl(237)
      const gzLvl = resolveDruidSummonCrossLvl(247)
      const stats = calculateSummonDireWolfStats(dwLvl, swLvl, gzLvl)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 237,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'fenris',
        petGroup: 3,
        maxPets: stats.maxCount,
        hp: stats.hp,
        kind: 'dire_wolf',
        monId: 'fenris',
        extra: {
          minDamage: stats.minDamage,
          maxDamage: stats.maxDamage,
          synergyArPct: stats.synergyArPct,
          totalDefenseBonusPct: stats.totalDefenseBonusPct,
          selfLifeBonusPct: stats.selfLifeBonusPct,
          synergyDamagePct: stats.synergyDamagePct,
          fenrisRageDamageBonusPct: stats.fenrisRageDamageBonusPct,
          fenrisRageDurationFrames: stats.fenrisRageDurationFrames,
          allResistancesPct: stats.allResistancesPct,
          subSkillIds: [314, 292],
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Summon Dire Wolf (Level ${slvl}, Max ${stats.maxCount}) summoned`
        : `召唤狂狼（等级 ${slvl}，上限 ${stats.maxCount} 只）召唤成功`
      return true
    }

    if (skillId === 241) {
      const stats = calculateSolarCreeperStats(slvl, ownerLevel)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 241,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'vine',
        petGroup: 2,
        maxPets: 1,
        hp: stats.hp,
        kind: 'solar_creeper',
        monId: 'vinecreature',
        extra: {
          manaRecoverMaxPct: stats.manaRecoverMaxPct,
          petLevel: stats.petLevel,
          subSkillId: 325,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Solar Creeper (Level ${slvl}, recovers ${stats.manaRecoverMaxPct}% Max Mana per corpse) summoned`
        : `太阳藤（等级 ${slvl}，吞噬尸体回复 ${stats.manaRecoverMaxPct}% 最大法力）召唤成功`
      return true
    }

    if (skillId === 246) {
      const stats = calculateSpiritOfBarbsStats(slvl, diffRaw)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 246,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'totem',
        petGroup: 1,
        maxPets: 1,
        hp: stats.hp,
        kind: 'spirit_of_barbs',
        monId: 'spiritofbarbs',
        extra: {
          auraSkillId: 298,
          auraState: 'barbs',
          thornsReflectPct: stats.thornsReflectPct,
          radiusSubtiles: stats.auraRadiusSubtiles,
          resistances: stats.resistances,
        },
      })
      applyTotemStateToPlayer('barbs', 298, { thorns_percent: stats.thornsReflectPct })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Spirit of Barbs (Level ${slvl}, ${stats.thornsReflectPct}% damage returned) summoned`
        : `荆棘之灵（等级 ${slvl}，反弹 ${stats.thornsReflectPct}% 近战伤害）召唤成功`
      return true
    }

    if (skillId === 247) {
      const swLvl = resolveDruidSummonCrossLvl(227)
      const dwLvl = resolveDruidSummonCrossLvl(237)
      const gzLvl = resolveDruidSummonCrossLvl(247)
      const stats = calculateSummonGrizzlyStats(gzLvl, swLvl, dwLvl)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 247,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'grizzly',
        petGroup: 3,
        maxPets: 1,
        hp: stats.hp,
        kind: 'grizzly',
        monId: 'grizzly',
        extra: {
          minDamage: stats.minDamage,
          maxDamage: stats.maxDamage,
          synergyArPct: stats.synergyArPct,
          synergyDefensePct: stats.synergyDefensePct,
          synergyLifePct: stats.synergyLifePct,
          selfDamageBonusPct: stats.selfDamageBonusPct,
          bearSmiteDamageBonusPct: stats.bearSmiteDamageBonusPct,
          bearSmiteStunFrames: stats.bearSmiteStunFrames,
          allResistancesPct: stats.allResistancesPct,
          subSkillId: 326,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Summon Grizzly (Level ${slvl}, ${stats.minDamage}-${stats.maxDamage} damage) summoned`
        : `召唤灰熊（等级 ${slvl}，${stats.minDamage}-${stats.maxDamage} 伤害）召唤成功`
      return true
    }
  }

  // Assassin Shadow Disciplines Active Skills (#253, #258, #264, #267, #268, #273, #278, #279)
  if (
    skillId === 253 ||
    skillId === 258 ||
    skillId === 264 ||
    skillId === 267 ||
    skillId === 268 ||
    skillId === 273 ||
    skillId === 278 ||
    skillId === 279
  ) {
    const slvl = resolveCastSkillLevel(skillId, player, hudManager, engine)
    const sb = (player as any)?.combatContext?.stateBus

    if (skillId === 253) {
      // #253 Psychic Hammer (1.13c HitShift=7: 1-3 phys + 1-3 magic at slvl 1, tier-based knockback)
      const dmg = computePsychicHammerDamage(slvl)
      const physAvg = Math.max(1, Math.round((dmg.minPhys + dmg.maxPhys) / 2))
      const magAvg = Math.max(1, Math.round((dmg.minMagic + dmg.maxMagic) / 2))
      const totalDmg = physAvg + magAvg
      engine.spawnOverlay('psychic_hammer_curse', { x: player.x, y: player.y }, 'player')

      let targetMonster: Monster | null = null
      let bestDist = 160
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        const d = Math.hypot(m.x - targetX, m.y - targetY)
        if (d <= bestDist) {
          bestDist = d
          targetMonster = m
        }
      }
      if (targetMonster !== null) {
        damageMonster(engine.world, targetMonster.index, totalDmg)
        ;(targetMonster as any).lastMagicDamageTaken = magAvg
        engine.spawnOverlay('psychic_hammer_hit', { x: targetMonster.x, y: targetMonster.y }, `monster-${targetMonster.index}`)
        const isBoss = Boolean(
          (targetMonster.stats as any)?.isBoss ||
            (targetMonster.stats as any)?.type === 'boss' ||
            (targetMonster as any).isBoss ||
            (targetMonster as any).isSuperUnique,
        )
        const isChampOrUnique = Boolean(
          targetMonster.stats?.rank === 'champion' ||
            targetMonster.stats?.rank === 'unique' ||
            (targetMonster as any).isChampion ||
            (targetMonster as any).isUnique,
        )
        const tier: 'normal' | 'exceptional' | 'boss' = isBoss
          ? 'boss'
          : isChampOrUnique
            ? 'exceptional'
            : 'normal'
        const kbChance = computePsychicHammerKnockbackChance(slvl, tier)
        const kbRoll =
          tier === 'normal'
            ? 0
            : engine.castRng
              ? engine.castRng.rand(100)
              : (((engine.world?.tick ?? 0) * 37 + (engine.metrics.casts ?? 0) * 13) & 0x7fffffff) % 100
        if (kbRoll < kbChance) {
          const kbAngle = Math.atan2(targetMonster.y - player.y, targetMonster.x - player.x)
          targetMonster.x += Math.cos(kbAngle) * 20
          targetMonster.y += Math.sin(kbAngle) * (20 * ISO_GROUND_ASPECT_RATIO)
          ;(targetMonster as any).knockedBack = true
        }
        engine.metrics.castHits += 1
      }
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Psychic Hammer (Level ${slvl}, ${dmg.minPhys}-${dmg.maxPhys} phys + ${dmg.minMagic}-${dmg.maxMagic} magic)`
        : `心灵战锤（等级 ${slvl}，${dmg.minPhys}-${dmg.maxPhys} 物理 + ${dmg.minMagic}-${dmg.maxMagic} 魔法伤害）`
      return true
    }

    if (skillId === 258) {
      // #258 Burst of Speed (State 157 quickness, mutually exclusive with State 159 fade, duration 3000 + 300*(slvl-1) frames)
      const durationFrames = 3000 + 300 * (slvl - 1)
      const frwPct = computeBurstOfSpeedFRW(slvl)
      const iasPct = computeBurstOfSpeedIAS(slvl)
      ;(player as any).fadeTicks = 0
      ;(player as any).fadeSlvl = 0
      ;(player as any).fadeResistAll = 0
      ;(player as any).fadeCurseResistPct = 0
      ;(player as any).fadeDrPct = 0
      ;(player as any).burstOfSpeedTicks = durationFrames
      ;(player as any).burstOfSpeedSlvl = slvl
      ;(player as any).burstOfSpeedFrwPct = frwPct
      ;(player as any).burstOfSpeedIasPct = iasPct
      ;(player as any).states?.delete?.(159)
      ;(player as any).states?.add?.(157)
      if (sb && typeof sb.removeState === 'function' && typeof sb.applyState === 'function') {
        sb.removeState('fade')
        sb.removeState(159)
        sb.applyState({
          stateNameOrId: 'quickness',
          sourceUnitId: 'player',
          sourceSkillId: 258,
          slvl,
          durationFrames,
          stats: {
            velocitypercent: frwPct,
            attackrate: iasPct,
          },
        })
      }
      engine.spawnOverlay('quickness', { x: player.x, y: player.y }, 'player', { loop: false })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Burst of Speed (Level ${slvl}, +${frwPct}% FRW, +${iasPct}% IAS, ${Math.round(durationFrames / 25)}s) active`
        : `加速（等级 ${slvl}，+${frwPct}% 移速，+${iasPct}% 攻速，持续 ${Math.round(durationFrames / 25)} 秒）已开启`
      return true
    }

    if (skillId === 264) {
      // #264 Cloak of Shadows (Caster State 153 cloak_of_shadows +Def%, Enemy State 156 cloaked -Def% & blind on normal monsters, 200+25*(slvl-1) frames, 30 subtiles)
      const alreadyActive =
        Number((player as any).cloakOfShadowsTicks ?? 0) > 0 ||
        Boolean((player as any).states?.has?.(153)) ||
        Boolean(sb?.hasState?.(153)) ||
        Boolean(sb?.hasState?.('cloak_of_shadows'))
      if (alreadyActive) {
        status.textContent = isEn ? 'Cloak of Shadows is already active!' : '暗影斗篷仍在持续时间内！'
        return false
      }
      const durationFrames = 200 + 25 * (slvl - 1)
      const selfDefPct = 10 + 3 * (slvl - 1)
      const enemyDefPenaltyPct = Math.min(95, 15 + 3 * (slvl - 1))
      const radiusSubtiles = 30
      const radiusPx = radiusSubtiles * (40 * (2 / 3)) // 30 subtiles = 20 yards = 800px
      ;(player as any).cloakOfShadowsTicks = durationFrames
      ;(player as any).cloakOfShadowsSlvl = slvl
      ;(player as any).cloakOfShadowsDefensePct = selfDefPct
      ;(player as any).states?.add?.(153)
      if (sb && typeof sb.applyState === 'function') {
        sb.applyState({
          stateNameOrId: 'cloak_of_shadows',
          sourceUnitId: 'player',
          sourceSkillId: 264,
          slvl,
          durationFrames,
          stats: {
            item_armor_percent: selfDefPct,
            skill_armor_percent: selfDefPct,
          },
        })
      }

      let affectedCount = 0
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        if (!canMonsterTargetBeCursed113c(m as never)) continue
        const dist = Math.hypot(m.x - player.x, (m.y - player.y) / ISO_GROUND_ASPECT_RATIO)
        if (dist <= radiusPx) {
          const isBossOrUnique = Boolean(
            (m.stats as any)?.isBoss ||
              (m.stats as any)?.type === 'boss' ||
              m.stats?.rank === 'champion' ||
              m.stats?.rank === 'unique' ||
              (m as any).isBoss ||
              (m as any).isChampion ||
              (m as any).isUnique ||
              (m as any).isSuperUnique,
          )
          ;(m as any).cloakOfShadowsTicks = durationFrames
          ;(m as any).cloakOfShadowsDefReductionPct = enemyDefPenaltyPct
          ;(m as any).aiBlind = !isBossOrUnique
          ;(m as any).states?.add?.(156)
          if (!isBossOrUnique) {
            m.curse = {
              name: 'cloaked',
              slvl,
              curseType: 1,
              ticksRemaining: durationFrames,
              overlayName: 'cloaked',
            }
          }
          affectedCount += 1
        }
      }

      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Cloak of Shadows (+${selfDefPct}% Def, -${enemyDefPenaltyPct}% Enemy Def, ${Math.round(durationFrames / 25)}s) affected ${affectedCount} enemies`
        : `暗影斗篷（+${selfDefPct}% 防御，-${enemyDefPenaltyPct}% 敌方防御，持续 ${Math.round(durationFrames / 25)} 秒）影响 ${affectedCount} 个目标`
      return true
    }

    if (skillId === 267) {
      // #267 Fade (State 159 fade, mutually exclusive with State 157 quickness, +AllRes, +CurseRes, +1%/slvl PDR)
      const durationFrames = 3000 + 300 * (slvl - 1)
      const resAll = computeFadeResistances(slvl)
      const curseRedPct = computeFadeCurseReduction(slvl)
      const drPct = computeFadePhysicalReduction(slvl)
      ;(player as any).burstOfSpeedTicks = 0
      ;(player as any).burstOfSpeedSlvl = 0
      ;(player as any).burstOfSpeedFrwPct = 0
      ;(player as any).burstOfSpeedIasPct = 0
      ;(player as any).fadeTicks = durationFrames
      ;(player as any).fadeSlvl = slvl
      ;(player as any).fadeResistAll = resAll
      ;(player as any).fadeCurseResistPct = curseRedPct
      ;(player as any).fadeDrPct = drPct
      ;(player as any).damageResist = drPct
      ;(player as any).states?.delete?.(157)
      ;(player as any).states?.add?.(159)
      if (sb && typeof sb.removeState === 'function' && typeof sb.applyState === 'function') {
        sb.removeState('quickness')
        sb.removeState(157)
        sb.applyState({
          stateNameOrId: 'fade',
          sourceUnitId: 'player',
          sourceSkillId: 267,
          slvl,
          durationFrames,
          stats: {
            fireresist: resAll,
            coldresist: resAll,
            lightresist: resAll,
            poisonresist: resAll,
            curse_resistance: curseRedPct,
            damageresist: drPct,
          },
        })
      }
      engine.spawnOverlay('fade', { x: player.x, y: player.y }, 'player', { loop: false })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Fade (Level ${slvl}, +${resAll}% All Res, -${curseRedPct}% Curse Len, +${drPct}% PDR) active`
        : `能量消解（等级 ${slvl}，+${resAll}% 全抗，-${curseRedPct}% 诅咒时间，+${drPct}% 物免）已开启`
      return true
    }

    if (skillId === 268 || skillId === 279) {
      // #268 Shadow Warrior & #279 Shadow Master (petType='shadowwarrior', petGroup=4, maxPets=1)
      const hp = computeShadowMaxLife(slvl)
      const ownerLevel = Number((player as any).level ?? (hudManager as any)?.level ?? 80)
      const mlvl = computeShadowMlvl(ownerLevel, slvl)
      const resistAll =
        skillId === 268 ? computeShadowWarriorResistances(slvl) : computeShadowMasterResistances(slvl)
      const shadowEquipment = generateShadowEquipment(skillId as 268 | 279, slvl)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'shadowwarrior',
        petGroup: 4,
        maxPets: 1,
        hp,
        kind: skillId === 268 ? 'shadow_warrior' : 'shadow_master',
        monId: skillId === 268 ? 'shadowwarrior' : 'shadowmaster',
        extra: {
          monsterLevel: mlvl,
          resistAll,
          shadowEquipment,
          subSkillId: 292,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent =
        skillId === 268
          ? isEn
            ? `Shadow Warrior (Level ${slvl}, ${hp} HP, +${resistAll}% All Res) summoned`
            : `影子战士（等级 ${slvl}，${hp} 生命，+${resistAll}% 全抗）召唤成功`
          : isEn
            ? `Shadow Master (Level ${slvl}, ${hp} HP, +${resistAll}% All Res) summoned`
            : `影子大师（等级 ${slvl}，${hp} 生命，+${resistAll}% 全抗）召唤成功`
      return true
    }

    if (skillId === 273) {
      // #273 Mind Blast (Radius 4 subtiles = 2.6 yards, physical damage + knockback + stun + conversion State 21)
      const dmg = computeMindBlastDamage(slvl)
      const physAvg = Math.max(1, Math.round((dmg.minPhys + dmg.maxPhys) / 2))
      const stunFrames = computeMindBlastStunDuration(slvl)
      const convChance = computeMindBlastConversionChance(slvl)
      const radiusSubtiles = 4
      const radiusPx = radiusSubtiles * (40 * (2 / 3)) // 4 subtiles = 2.66 yards = 106.67px
      let hitCount = 0
      let convertedCount = 0
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        const dist = Math.hypot(m.x - targetX, (m.y - targetY) / ISO_GROUND_ASPECT_RATIO)
        if (dist <= radiusPx) {
          damageMonster(engine.world, m.index, physAvg)
          engine.spawnOverlay('fist_will_cast', { x: m.x, y: m.y }, `monster-${m.index}`, { loop: false })
          const kbAngle = Math.atan2(m.y - targetY, m.x - targetX)
          m.x += Math.cos(kbAngle) * 16
          m.y += Math.sin(kbAngle) * (16 * ISO_GROUND_ASPECT_RATIO)
          ;(m as any).knockedBack = true

          const isBossOrUnique = Boolean(
            (m.stats as any)?.isBoss ||
              (m.stats as any)?.type === 'boss' ||
              m.stats?.rank === 'champion' ||
              m.stats?.rank === 'unique' ||
              (m as any).isBoss ||
              (m as any).isChampion ||
              (m as any).isUnique ||
              (m as any).isSuperUnique,
          )
          if (!isBossOrUnique && m.hp > 0) {
            ;(m as any).stunTimer = Math.max((m as any).stunTimer ?? 0, stunFrames)
            ;(m as any).stunTicks = Math.max((m as any).stunTicks ?? 0, stunFrames)
            engine.spawnOverlay('stun', { x: m.x, y: m.y }, `monster-${m.index}`)

            const convRoll = engine.castRng
              ? engine.castRng.rand(100)
              : (((engine.world?.tick ?? 0) * 37 + m.index * 17 + (engine.metrics.casts ?? 0) * 13) & 0x7fffffff) % 100
            if (convRoll < convChance) {
              const convFrames = 150 + (convRoll % 100)
              ;(m as any).converted = true
              ;(m as any).conversionTicks = convFrames
              ;(m as any).states?.add?.(21)
              convertedCount += 1
            }
          }
          engine.metrics.castHits += 1
          hitCount += 1
        }
      }
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Mind Blast (${dmg.minPhys}-${dmg.maxPhys} dmg, ${(stunFrames / 25).toFixed(1)}s stun, ${convChance}% convert) hit ${hitCount} (${convertedCount} converted)`
        : `心灵爆震（${dmg.minPhys}-${dmg.maxPhys} 伤害，眩晕 ${(stunFrames / 25).toFixed(1)} 秒，${convChance}% 转化）命中 ${hitCount} 个目标（转化 ${convertedCount} 个）`
      return true
    }

    if (skillId === 278) {
      // #278 Venom (State 31 venomclaws only, 10-frame poison clamp, 4000+100*(slvl-1) frames duration)
      const durationFrames = 4000 + 100 * (slvl - 1)
      const vDmg = computeVenomPoisonDamage(slvl)
      ;(player as any).venomTicks = durationFrames
      ;(player as any).venomSlvl = slvl
      ;(player as any).venomMinDamage = vDmg.minDamage
      ;(player as any).venomMaxDamage = vDmg.maxDamage
      ;(player as any).venomBitrate256 = vDmg.minBitrate
      ;(player as any).venomPoisonFrames = 10
      ;(player as any).states?.add?.(31)
      ;(player as any).states?.delete?.(178)
      if (sb && typeof sb.applyState === 'function') {
        sb.applyState({
          stateNameOrId: 'venomclaws',
          sourceUnitId: 'player',
          sourceSkillId: 278,
          slvl,
          durationFrames,
          stats: {
            venom_bitrate_256: vDmg.minBitrate,
            venom_max_bitrate_256: vDmg.maxBitrate,
            skill_pois_min: vDmg.minBitrate,
            skill_pois_max: vDmg.maxBitrate,
            skill_pois_len: 10,
            skill_poison_override_length: 10,
          },
        })
      }
      engine.spawnOverlay('venomclaws', { x: player.x, y: player.y }, 'player', { loop: false })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Venom (Level ${slvl}, ${vDmg.minDamage}-${vDmg.maxDamage} poison over 0.4s, ${Math.round(durationFrames / 25)}s) active`
        : `毒牙（等级 ${slvl}，0.4 秒内 ${vDmg.minDamage}-${vDmg.maxDamage} 毒素伤害，持续 ${Math.round(durationFrames / 25)} 秒）已开启`
      return true
    }
  }

  if (skillId === 73) {
    // Poison Dagger: requires dagger weapon equipped
    const weapon =
      context.equippedWeapon ??
      hudManager?.inventory?.equipped?.weapon1 ??
      globalBag.__d2webHudInstance?.inventory?.equipped?.weapon1
    const weaponInfo = getAttackWeaponInfo(weapon)
    if (weaponInfo.subtype !== 'dagger') {
      status.textContent = isEn ? 'Poison Dagger requires a dagger equipped!' : '淬毒匕首需要装备匕首类武器！'
      return false
    }

    const slvl = resolveCastSkillLevel(73, player, hudManager, engine)
    const poisonExplosionBlvl = resolveBaseSkillLevel(83, player, hudManager, engine)
    const poisonNovaBlvl = resolveBaseSkillLevel(92, player, hudManager, engine)
    const pDmg = calculatePoisonDaggerDamage(slvl, {
      poisonExplosion: poisonExplosionBlvl,
      poisonNova: poisonNovaBlvl,
    })
    const arBonus = calculatePoisonDaggerAttackRatingBonus(slvl)

    player.cooldown = weaponInfo.cooldown
    player.swingTicks = weaponInfo.swingTicks

    let targetMonster: Monster | null = null
    let bestTargetDist = weaponInfo.reach
    for (const monster of engine.world.monsters) {
      if (monster.state === 'dead' || monster.hp <= 0) continue
      const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
      if (dist <= weaponInfo.reach) {
        const distCursor = Math.hypot(monster.x - targetX, monster.y - targetY)
        if (distCursor <= bestTargetDist) {
          bestTargetDist = distCursor
          targetMonster = monster
        }
      }
    }

    if (targetMonster !== null) {
      const baseDmg = Math.round((weaponInfo.damageMin + weaponInfo.damageMax) / 2)
      damageMonster(engine.world, targetMonster.index, baseDmg)
      ;(targetMonster as any).statusEffect = 'poison'
      ;(targetMonster as any).statusDuration = pDmg.durationFrames
      ;(targetMonster as any).poisonDamagePerTick = pDmg.minRate / 256
      damageMonster(engine.world, targetMonster.index, pDmg.minDamage)
      engine.metrics.playerHits += 1
      engine.metrics.casts += 1
      const mName = monsterDisplayName(targetMonster.stats)
      status.textContent = isEn
        ? `Poison Dagger (+${arBonus}% AR) hit: ${mName}, dealt ${pDmg.minDamage}-${pDmg.maxDamage} poison damage`
        : `淬毒匕首（+${arBonus}%命中）命中：${targetMonster.stats.name || targetMonster.stats.id}，造成 ${pDmg.minDamage}-${pDmg.maxDamage} 点毒素伤害`
    } else {
      engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Poison Dagger (+${arBonus}% AR): missed target`
        : `淬毒匕首（+${arBonus}%命中）：未命中目标`
    }
    return true
  }

  if (skillId === 74) {
    // Corpse Explosion (1.13c SKILLS_SrvDo055_CorpseExplosion 0x6FD10DC0)
    const slvl = resolveCastSkillLevel(74, player, hudManager, engine)
    const radiusPx = calculateCorpseExplosionRadiusPx(slvl)
    const rawRangeSubtiles = 8 + (slvl - 1)
    const innerPhysRadiusPx = Math.floor(rawRangeSubtiles / 2) * 16

    let targetCorpse: Monster | null = null
    let bestCorpseDist = 80
    for (const monster of engine.world.monsters) {
      if (monster.state !== 'dead' && monster.hp > 0) continue
      if ((monster as any).corpseConsumed) continue
      if ((monster.stats as any).isBoss || (monster.stats as any).type === 'boss') continue
      const d = Math.hypot(monster.x - targetX, monster.y - targetY)
      if (d <= bestCorpseDist) {
        bestCorpseDist = d
        targetCorpse = monster
      }
    }

    if (!targetCorpse) {
      status.textContent = isEn ? 'Requires a valid target corpse!' : '需要有效的目标尸体！'
      return false
    }

    ;(targetCorpse as any).corpseConsumed = true
    ;(targetCorpse as any).corpseStateId = 104 // STATE_CORPSE_NODRAW
    const cx = targetCorpse.x
    const cy = targetCorpse.y

    engine.explosions.push({
      missileType: 'corpseexplosion',
      x: cx,
      y: cy,
      frame: 0,
      maxFrames: 18,
    })
    engine.explosions.push({
      missileType: 'explodingarrowexp',
      x: cx,
      y: cy,
      frame: 0,
      maxFrames: 15,
    })

    const rawBaseHp = targetCorpse.stats.hp ?? 1000
    const casterLevel = Number((player as any)?.level ?? (hudManager as any)?.level ?? 0)
    const corpseLevel = Number((targetCorpse.stats as any)?.level ?? (targetCorpse as any)?.level ?? 0)
    const baseHp =
      casterLevel > 0 && corpseLevel > 0 && casterLevel < corpseLevel
        ? Math.floor((rawBaseHp * casterLevel) / corpseLevel)
        : rawBaseHp
    const ceDmg = calculateCorpseExplosionDamage(baseHp)

    let hitCount = 0
    for (const monster of engine.world.monsters) {
      if (monster.state === 'dead' || monster.hp <= 0) continue
      const dist = Math.hypot(monster.x - cx, (monster.y - cy) / ISO_GROUND_ASPECT_RATIO)
      if (dist <= radiusPx) {
        // 1.13c dual-radius: inner ring deals 50% Phys + 50% Fire; outer ring deals 50% Fire only
        const physComponent = dist <= innerPhysRadiusPx ? ceDmg.phys : 0
        const totalDmg = Math.max(1, physComponent + ceDmg.fire)
        damageMonster(engine.world, monster.index, totalDmg)
        engine.metrics.castHits += 1
        hitCount++
      }
    }

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn
      ? `Corpse Explosion (Radius ${(radiusPx / 40).toFixed(1)} yds) detonated corpse, hit ${hitCount} targets`
      : `尸体爆炸（范围 ${(radiusPx / 40).toFixed(1)} 码）消灭尸体，命中 ${hitCount} 个目标`
    return true
  }

  if (skillId === 78) {
    // Bone Wall
    const slvl = resolveCastSkillLevel(78, player, hudManager, engine)
    const boneArmorBlvl = resolveBaseSkillLevel(68, player, hudManager, engine)
    const bonePrisonBlvl = resolveBaseSkillLevel(88, player, hudManager, engine)
    const rawDiff = (engine as any)?.difficulty ?? (engine.world as any)?.difficulty ?? (player as any)?.difficulty
    const wallStats = calculateBoneWallStats(
      slvl,
      { boneArmor: boneArmorBlvl, bonePrison: bonePrisonBlvl },
      rawDiff,
    )

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn
      ? `Cast Bone Wall (Life ${wallStats.hp}, Duration ${wallStats.durationSeconds}s, ${wallStats.segmentCount} segments)`
      : `施展骨墙（生命 ${wallStats.hp}，持续 ${wallStats.durationSeconds} 秒，${wallStats.segmentCount} 骨节）`
    return true
  }

  if (skillId === 83) {
    // Poison Explosion
    const slvl = resolveCastSkillLevel(83, player, hudManager, engine)
    const poisonDaggerBlvl = resolveBaseSkillLevel(73, player, hudManager, engine)
    const poisonNovaBlvl = resolveBaseSkillLevel(92, player, hudManager, engine)
    const peDmg = calculatePoisonExplosionDamage(slvl, {
      poisonDagger: poisonDaggerBlvl,
      poisonNova: poisonNovaBlvl,
    })

    let targetCorpse: Monster | null = null
    let bestCorpseDist = 80
    for (const monster of engine.world.monsters) {
      if (monster.state !== 'dead' && monster.hp > 0) continue
      if ((monster as any).corpseConsumed) continue
      const d = Math.hypot(monster.x - targetX, monster.y - targetY)
      if (d <= bestCorpseDist) {
        bestCorpseDist = d
        targetCorpse = monster
      }
    }

    if (!targetCorpse) {
      status.textContent = isEn ? 'Requires a valid target corpse!' : '需要有效的目标尸体！'
      return false
    }

    ;(targetCorpse as any).corpseConsumed = true
    ;(targetCorpse as any).corpseStateId = 118 // STATE_CORPSE_NOSELECT
    const cx = targetCorpse.x
    const cy = targetCorpse.y

    engine.explosions.push({
      missileType: 'poisoncorpseexplosion',
      x: cx,
      y: cy,
      frame: 0,
      maxFrames: 18,
    })
    engine.explosions.push({
      missileType: 'poisonexplosioncloud',
      x: cx,
      y: cy,
      frame: 0,
      maxFrames: 24,
    })

    let hitCount = 0
    for (const monster of engine.world.monsters) {
      if (monster.state === 'dead' || monster.hp <= 0) continue
      const dist = Math.hypot(monster.x - cx, (monster.y - cy) / ISO_GROUND_ASPECT_RATIO)
      if (dist <= 80) {
        ;(monster as any).statusEffect = 'poison'
        ;(monster as any).statusDuration = peDmg.durationFrames
        damageMonster(engine.world, monster.index, peDmg.minDamage)
        engine.metrics.castHits += 1
        hitCount++
      }
    }

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn
      ? `Poison Explosion (Duration ${peDmg.durationSeconds.toFixed(1)}s, Damage ${peDmg.minDamage}-${peDmg.maxDamage}) hit ${hitCount} targets`
      : `毒爆（持续 ${peDmg.durationSeconds.toFixed(1)} 秒，伤害 ${peDmg.minDamage}-${peDmg.maxDamage}）命中 ${hitCount} 个目标`
    return true
  }

  if (skillId === 88) {
    // Bone Prison
    const slvl = resolveCastSkillLevel(88, player, hudManager, engine)
    const boneArmorBlvl = resolveBaseSkillLevel(68, player, hudManager, engine)
    const boneWallBlvl = resolveBaseSkillLevel(78, player, hudManager, engine)
    const rawDiff = (engine as any)?.difficulty ?? (engine.world as any)?.difficulty ?? (player as any)?.difficulty
    const prisonStats = calculateBonePrisonStats(
      slvl,
      { boneArmor: boneArmorBlvl, boneWall: boneWallBlvl },
      rawDiff,
    )

    player.cooldown = 0
    engine.metrics.casts += 1
    status.textContent = isEn
      ? `Cast Bone Prison (Life ${prisonStats.hp}, Duration ${prisonStats.durationSeconds}s, ${prisonStats.segmentCount} segments)`
      : `施展骨牢（生命 ${prisonStats.hp}，持续 ${prisonStats.durationSeconds} 秒，${prisonStats.segmentCount} 骨柱）`
    return true
  }

  if ([66, 71, 72, 76, 77, 81, 82, 86, 87, 91].includes(skillId)) {
    const slvl = resolveCastSkillLevel(skillId, player, hudManager, engine)
    const rawDiff = (engine as any)?.difficulty ?? (engine.world as any)?.difficulty ?? (player as any)?.difficulty
    const difficulty: 'normal' | 'nightmare' | 'hell' =
      rawDiff === 2 || rawDiff === 'hell'
        ? 'hell'
        : rawDiff === 1 || rawDiff === 'nightmare'
          ? 'nightmare'
          : 'normal'
    const curseEffect = calculateCurseEffect(skillId, slvl, { difficulty })

    engine.spawnOverlay('cursecast', { x: targetX, y: targetY })

    const getCurseOverhead = (id: number): string => {
      switch (id) {
        case 66: return 'curseamplifydamage'
        case 71: return 'cursedimvision'
        case 72: return 'curseweaken'
        case 76: return 'curseironmaiden'
        case 77: return 'curseterror'
        case 81: return 'curseconfuse'
        case 82: return 'cursereversevampire'
        case 86: return 'curseattract'
        case 87: return 'cursedecrepify'
        case 91: return 'curselowerresist'
        default: return 'curseamplifydamage'
      }
    }

    if (skillId === 86) {
      let targetMonster: Monster | null = null
      let bestDist = curseEffect.radiusPx
      for (const monster of engine.world.monsters) {
        if (monster.state === 'dead' || monster.hp <= 0) continue
        if (!canMonsterTargetBeCursed113c(monster as never)) continue
        const dist = Math.hypot(monster.x - targetX, (monster.y - targetY) / ISO_GROUND_ASPECT_RATIO)
        if (dist <= bestDist) {
          bestDist = dist
          targetMonster = monster
        }
      }

      if (!targetMonster) {
        status.textContent = isEn ? 'Requires a valid target!' : '需要有效的目标！'
        return false
      }

      const isBossOrChamp = Boolean(
        (targetMonster.stats as any).isBoss ||
        (targetMonster.stats as any).type === 'boss' ||
        targetMonster.stats.rank === 'champion' ||
        targetMonster.stats.rank === 'unique',
      )
      if (isBossOrChamp) {
        status.textContent = isEn ? 'Bosses and Champions are immune to Attract!' : '首领和头目免疫吸引！'
        return false
      }

      if (targetMonster.curse?.curseType === 2 || targetMonster.curse?.name === 'attract') {
        status.textContent = isEn ? 'Target is already Attracted!' : '目标已被吸引！'
        return false
      }

      targetMonster.curse = {
        name: 'attract',
        slvl,
        curseType: 2,
        ticksRemaining: curseEffect.durationFrames,
        overlayName: 'curseattract',
      }
      engine.spawnOverlay('curseattract', { x: targetMonster.x, y: targetMonster.y }, `monster-${targetMonster.index}`, { loop: true })

      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Attract (Duration ${curseEffect.durationSeconds.toFixed(1)}s) hit target`
        : `吸引（持续 ${curseEffect.durationSeconds.toFixed(1)} 秒）命中目标`
      return true
    }

    let affectedCount = 0
    const overheadOverlay = getCurseOverhead(skillId)

    for (const monster of engine.world.monsters) {
      if (monster.state === 'dead' || monster.hp <= 0) continue
      if (!canMonsterTargetBeCursed113c(monster as never)) continue
      const dist = Math.hypot(monster.x - targetX, (monster.y - targetY) / ISO_GROUND_ASPECT_RATIO)
      if (dist <= curseEffect.radiusPx) {
        if (monster.curse?.curseType === 2 || monster.curse?.name === 'attract') {
          continue
        }
        if (monster.curse?.name === curseEffect.stateName && slvl < (monster.curse.slvl ?? 1)) {
          continue
        }

        const isBossOrChamp = Boolean(
          (monster.stats as any).isBoss ||
          (monster.stats as any).type === 'boss' ||
          monster.stats.rank === 'champion' ||
          monster.stats.rank === 'unique',
        )
        if ([71, 77, 81].includes(skillId) && isBossOrChamp) {
          continue
        }

        monster.curse = {
          name: curseEffect.stateName,
          slvl,
          curseType: 1,
          ticksRemaining: curseEffect.durationFrames,
          overlayName: overheadOverlay,
          casterX: player.x,
          casterY: player.y,
          returnPct: skillId === 76 ? calculateIronMaidenReturnPct(slvl) : undefined,
        }

        if (skillId === 77) {
          const fleeDx = monster.x - player.x
          const fleeDy = monster.y - player.y
          const fleeLen = Math.hypot(fleeDx, fleeDy) || 1
          const fleeDistPx = calculateTerrorDistance(slvl) * (40 * (2 / 3))
          monster.curse.fleeTarget = {
            x: monster.x + (fleeDx / fleeLen) * fleeDistPx,
            y: monster.y + (fleeDy / fleeLen) * fleeDistPx,
          }
        }

        engine.spawnOverlay(overheadOverlay, { x: monster.x, y: monster.y }, `monster-${monster.index}`, { loop: true })
        affectedCount++
      }
    }

    player.cooldown = 0
    engine.metrics.casts += 1
    const curseName = isEn ? getSkillDisplayName(skillId, 'ENG') : curseEffect.skillName
    status.textContent = isEn
      ? `${curseName} (Radius ${(curseEffect.radiusPx / 40).toFixed(1)} yds, Duration ${curseEffect.durationSeconds.toFixed(1)}s) hit ${affectedCount} targets`
      : `${curseEffect.skillName}（范围 ${(curseEffect.radiusPx / 40).toFixed(1)} 码，持续 ${curseEffect.durationSeconds.toFixed(1)} 秒）命中 ${affectedCount} 个目标`
    return true
  }

  // Necromancer Summoning Spells Tree
  if ([69, 70, 75, 79, 80, 85, 89, 90, 94, 95].includes(skillId)) {
    const slvl = resolveCastSkillLevel(skillId, player, hudManager, engine)
    const skelMasteryLvl = (hudManager as any)?.getSkillLevel?.(69) ?? 0
    const golemMasteryLvl = (hudManager as any)?.getSkillLevel?.(79) ?? 0
    const summonResLvl = (hudManager as any)?.getSkillLevel?.(89) ?? 0
    const smStats = calculateSkeletonMasteryStats(skelMasteryLvl)
    const sumResPct = calculateSummonResistPct(summonResLvl)

    if (skillId === 69) {
      status.textContent = isEn
        ? `Skeleton Mastery (Level ${slvl}): Passively increases life and damage of raised skeletons and revived monsters`
        : `支配骷髅（等级 ${slvl}）：被动提升骷髅与复活怪物的生命与伤害`
      return true
    }
    if (skillId === 79) {
      status.textContent = isEn
        ? `Golem Mastery (Level ${slvl}): Passively increases life and velocity of Golems`
        : `支配石魔（等级 ${slvl}）：被动提升石魔的生命与移动速度`
      return true
    }
    if (skillId === 89) {
      status.textContent = isEn
        ? `Summon Resist (Level ${slvl}): Passively increases elemental resistances of all summons`
        : `召唤物抗性（等级 ${slvl}）：被动提升所有召唤物的元素抗性`
      return true
    }

    if (skillId === 70 || skillId === 80 || skillId === 95) {
      let targetCorpse: Monster | null = null
      let bestCorpseDist = 160
      for (const monster of engine.world.monsters) {
        if (monster.state !== 'dead' && monster.hp > 0) continue
        if ((monster as any).corpseConsumed) continue
        if ((monster.stats as any)?.isBoss || (monster.stats as any)?.type === 'boss') continue
        if (skillId === 95) {
          if (
            (monster.stats as any)?.revivable === false ||
            (monster.stats as any)?.rank === 'unique' ||
            (monster.stats as any)?.rank === 'champion' ||
            (monster.stats as any)?.rank === 'superunique' ||
            Boolean((monster as any).isUnique) ||
            Boolean((monster as any).isChampion) ||
            Boolean((monster as any).isSuperUnique) ||
            (monster as any).superUniqueId !== undefined ||
            Boolean((monster as any).alreadyRevived) ||
            Boolean((monster as any).states?.has?.(96))
          ) {
            continue
          }
          const cId = (monster as any).classId ?? (monster.stats as any)?.classId
          if (
            typeof cId === 'number' &&
            Number.isInteger(cId) &&
            cId >= 0 &&
            cId < 734 &&
            !hasMonStats2Flag(cId, MONSTATS2_FLAGINDEX.REVIVE)
          ) {
            continue
          }
        }
        const d = Math.hypot(monster.x - targetX, (monster.y - targetY) / ISO_GROUND_ASPECT_RATIO)
        if (d <= bestCorpseDist) {
          bestCorpseDist = d
          targetCorpse = monster
        }
      }

      if (!targetCorpse) {
        status.textContent = isEn
          ? 'Requires an unconsumed monster corpse (non-Boss)!'
          : '需要未被消耗的怪物尸体（非首领）！'
        return false
      }

      ;(targetCorpse as any).corpseConsumed = true
      if (skillId === 95) {
        ;(targetCorpse as any).alreadyRevived = true
      }
      targetCorpse.corpseTicks = 0

      if (skillId === 70 || skillId === 80) {
        engine.explosions.push({
          missileType: 'corpseexplosion',
          x: targetCorpse.x,
          y: targetCorpse.y,
          frame: 0,
          maxFrames: 18,
        })
      }

      player.cooldown = 0
      engine.metrics.casts += 1

      if (skillId === 70) {
        const skelStats = calculateRaiseSkeletonStats(slvl, skelMasteryLvl)
        const maxSkel = skelStats.maxCount
        const skelHp = skelStats.maxHp
        registerCastSummon({
          engine,
          player,
          hudManager,
          skillId: 70,
          slvl,
          x: targetCorpse.x,
          y: targetCorpse.y,
          petType: 'skeleton',
          petGroup: 0,
          maxPets: maxSkel,
          hp: skelHp,
          kind: 'skeleton',
          extra: { resistAll: sumResPct },
        })
        status.textContent = isEn
          ? `Raise Skeleton (Level ${slvl}, Max ${maxSkel}) summoned`
          : `复生骷髅（等级 ${slvl}，上限 ${maxSkel} 只）召唤成功`
      } else if (skillId === 80) {
        const mageStats = calculateSkeletalMageStats(slvl, skelMasteryLvl)
        const maxMage = mageStats.maxCount
        const mageHp = mageStats.maxHp
        const elements = ['fire', 'cold', 'lightning', 'poison'] as const
        const mageElement = elements[engine.metrics.casts % elements.length]
        registerCastSummon({
          engine,
          player,
          hudManager,
          skillId: 80,
          slvl,
          x: targetCorpse.x,
          y: targetCorpse.y,
          petType: 'skeletonmage',
          petGroup: 0,
          maxPets: maxMage,
          hp: mageHp,
          kind: 'skeleton_mage',
          extra: { mageElement, resistAll: sumResPct },
        })
        status.textContent = isEn
          ? `Raise Skeletal Mage (Level ${slvl}, Max ${maxMage}) summoned`
          : `复生骷髅法师（等级 ${slvl}，上限 ${maxMage} 只）召唤成功`
      } else {
        const maxRevive = calculateReviveMaxCount(slvl)
        const corpseBaseHp =
          (targetCorpse as any).maxHp ??
          (targetCorpse.stats as any)?.maxHp ??
          targetCorpse.stats?.hp ??
          200
        const corpseMonsterLevel =
          (targetCorpse as any).level ?? (targetCorpse.stats as any)?.level
        const casterLevel = player.level ?? 1
        const corpseMinDmg =
          (targetCorpse.stats as any)?.minDmg ??
          (targetCorpse.stats as any)?.dmg ??
          10
        const corpseMaxDmg =
          (targetCorpse.stats as any)?.maxDmg ??
          (targetCorpse.stats as any)?.dmg ??
          20
        const corpseClassId =
          (targetCorpse as any).classId ?? (targetCorpse.stats as any)?.classId
        const revStats = calculateReviveStats(slvl, skelMasteryLvl, {
          baseMaxHp: corpseBaseHp,
          monsterLevel: corpseMonsterLevel,
          casterLevel,
          baseMinDamage: corpseMinDmg,
          baseMaxDamage: corpseMaxDmg,
        })
        const reviveHp = revStats.maxHp ?? Math.floor(corpseBaseHp * revStats.hpMultiplier)

        // 1.13c SKILLS_SrvDo058_Revive (0x6FC71340): Paladin casting Revive loses 12.5% (1/8) of MaxHP
        const isPaladin =
          String((player as any).charClass ?? '').toLowerCase() === 'pal' ||
          String((player as any).charClass ?? '').toLowerCase() === 'paladin' ||
          (player as any).classId === 3
        if (isPaladin && !(engine as any).summonManager) {
          const maxPlayerHp = player.maxHp ?? player.hp ?? 100
          const costHp = Math.floor(maxPlayerHp / 8)
          if (costHp > 0 && typeof player.hp === 'number') {
            player.hp = Math.max(1, player.hp - costHp)
          }
        }

        const corpseMonId = targetCorpse.stats?.id
        if (typeof corpseMonId !== 'string' || corpseMonId === '') {
          throw new Error('Revive (#95): target corpse has no MonStats.txt Id (SKILLS_SrvDo058 revives the corpse unit itself)')
        }
        registerCastSummon({
          engine,
          player,
          hudManager,
          skillId: 95,
          slvl,
          x: targetCorpse.x,
          y: targetCorpse.y,
          petType: 'revive',
          petGroup: 0,
          maxPets: maxRevive,
          hp: reviveHp,
          kind: 'revive',
          monId: corpseMonId,
          lifespanTicks: revStats.durationFrames,
          corpses: [
            {
              id: String((targetCorpse as any).id ?? 'corpse'),
              consumed: false,
              baseMaxHp: corpseBaseHp,
              classId: corpseClassId,
              monId: targetCorpse.stats?.id,
              monsterLevel: corpseMonsterLevel,
              minDamage: corpseMinDmg,
              maxDamage: corpseMaxDmg,
            },
          ],
          extra: {
            sourceMonsterId: targetCorpse.stats?.id,
            classId: corpseClassId,
            resistAll: sumResPct,
            skeletonMasteryLevel: skelMasteryLvl,
            damageBonusPct: revStats.damageBonusPct,
            velocityBonusPct: revStats.velocityBonusPct,
            minDamage: revStats.minDamage,
            maxDamage: revStats.maxDamage,
            stateId: 96,
          },
        })
        status.textContent = isEn
          ? `Revive (Level ${slvl}, Max ${maxRevive}, Duration 180s) summoned`
          : `复生（等级 ${slvl}，上限 ${maxRevive} 只，持续 180 秒）召唤成功`
      }
      return true
    }

    const golemSynergies = {
      clayGolemBlvl: resolveBaseSkillLevel(75, player, hudManager, engine),
      bloodGolemBlvl: resolveBaseSkillLevel(85, player, hudManager, engine),
      ironGolemBlvl: resolveBaseSkillLevel(90, player, hudManager, engine),
      fireGolemBlvl: resolveBaseSkillLevel(94, player, hudManager, engine),
    }

    if (skillId === 90) {
      let targetGroundItem: any = null
      let bestItemDist = 80
      const groundAll = engine.groundItems?.all ?? (engine as any).ground ?? []
      for (const g of groundAll) {
        if (!g || g.isGold) continue
        const itemObj = g.item ?? g
        // SKILLS_SrvSt20_IronGolem (0x6FC6EDD0): ITEMS_IsMetalItem(pItem->dwClassId) = bitfield1 & 2.
        const itemCode = typeof itemObj?.code === 'string' ? itemObj.code : undefined
        if (itemCode === undefined || itemCode.trim() === '' || !isMetalItemCode113c(itemCode)) continue
        const d = Math.hypot((g.x ?? targetX) - targetX, ((g.y ?? targetY) - targetY) / ISO_GROUND_ASPECT_RATIO)
        if (d <= bestItemDist) {
          bestItemDist = d
          targetGroundItem = g
        }
      }

      if (!targetGroundItem) {
        status.textContent = isEn
          ? 'Iron Golem requires a metallic item on the ground!'
          : '钢铁石魔需要地面上的金属物品！'
        return false
      }

      const rawItem = targetGroundItem.item ?? targetGroundItem
      const itemProps = {
        minDamage: Number(rawItem?.minDamage ?? rawItem?.damageMin ?? rawItem?.baseDamage ?? 0) || undefined,
        maxDamage: Number(rawItem?.maxDamage ?? rawItem?.damageMax ?? rawItem?.baseDamage ?? 0) || undefined,
        baseDamage: Number(rawItem?.baseDamage ?? rawItem?.damageMax ?? 0) || undefined,
        defense: Number(rawItem?.defense ?? rawItem?.ac ?? 0) || undefined,
        auras: Array.isArray(rawItem?.auras) ? rawItem.auras : undefined,
        isMetallic: true,
      }
      const spawnX = targetGroundItem.x ?? targetX
      const spawnY = targetGroundItem.y ?? targetY
      if (targetGroundItem.id !== undefined && typeof engine.groundItems?.remove === 'function') {
        engine.groundItems.remove(String(targetGroundItem.id))
      } else if (Array.isArray((engine as any).ground)) {
        const idx = (engine as any).ground.indexOf(targetGroundItem)
        if (idx >= 0) (engine as any).ground.splice(idx, 1)
      }

      const igStats = calculateIronGolemStats(slvl, itemProps, golemMasteryLvl, golemSynergies)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 90,
        slvl,
        x: spawnX,
        y: spawnY,
        petType: 'golem',
        petGroup: 3,
        maxPets: 1,
        hp: igStats.maxHp,
        kind: 'iron_golem',
        extra: {
          thornsReturnPct: igStats.thornsReturnPct,
          inheritedAuras: igStats.inheritedAuras,
          defense: igStats.defense,
          attackRating: igStats.attackRating,
          resistAll: sumResPct,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Iron Golem (Level ${slvl}, inherits item properties and thorns) summoned`
        : `钢铁石魔（等级 ${slvl}，继承装备属性与反伤）召唤成功`
      return true
    }

    if (skillId === 75) {
      const cgStats = calculateClayGolemStats(slvl, golemMasteryLvl, golemSynergies.bloodGolemBlvl, golemSynergies)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 75,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'golem',
        petGroup: 3,
        maxPets: 1,
        hp: cgStats.maxHp,
        kind: 'clay_golem',
        extra: {
          slowPct: cgStats.slowPct,
          defense: cgStats.defense,
          attackRating: cgStats.attackRating,
          resistAll: sumResPct,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Clay Golem (Level ${slvl}, slows enemies on hit) summoned`
        : `粘土石魔（等级 ${slvl}，附带减速攻击与受击减速）召唤成功`
      return true
    }

    if (skillId === 85) {
      const bgStats = calculateBloodGolemStats(slvl, golemMasteryLvl, golemSynergies)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 85,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'golem',
        petGroup: 3,
        maxPets: 1,
        hp: bgStats.maxHp,
        kind: 'blood_golem',
        extra: {
          lifeLink: {
            healCasterPct: bgStats.lifeLeechPct,
            ownerSharePct: bgStats.ownerHealSplitPct,
            golemSharePct: bgStats.golemHealSplitPct,
            shareDamagePct: bgStats.damageSharePct,
          },
          defense: bgStats.defense,
          attackRating: bgStats.attackRating,
          resistAll: sumResPct,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Blood Golem (Level ${slvl}, ${bgStats.lifeLeechPct}% life steal split 30/70) summoned`
        : `鲜血石魔（等级 ${slvl}，${bgStats.lifeLeechPct}% 生命偷取 30/70 分摊与 25% 伤害链接）召唤成功`
      return true
    }

    if (skillId === 94) {
      const fgStats = calculateFireGolemStats(slvl, golemMasteryLvl, golemSynergies)
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 94,
        slvl,
        x: targetX,
        y: targetY,
        petType: 'golem',
        petGroup: 3,
        maxPets: 1,
        hp: fgStats.maxHp,
        kind: 'fire_golem',
        extra: {
          fireAbsorbPct: fgStats.fireAbsorbPct,
          fireResist: fgStats.fireResist,
          deathExplosionDmg: fgStats.deathExplosionDmg,
          defense: fgStats.defense,
          attackRating: fgStats.attackRating,
          resistAll: sumResPct,
        },
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Fire Golem (Level ${slvl}, Holy Fire aura & ${fgStats.fireAbsorbPct}% fire absorb) summoned`
        : `火焰石魔（等级 ${slvl}，附带圣火光环与 ${fgStats.fireAbsorbPct}% 火焰吸收）召唤成功`
      return true
    }
  }

  // Projectile Skills
  const castSlvl = resolveCastSkillLevel(skillId, player, hudManager, engine)
  if (isAuraSkill(skillId)) {
    engine.updateActiveAura(skillId, castSlvl)
    player.cooldown = 0
    engine.metrics.casts += 1
    const auraTitle = getSkillDisplayName(skillId, isEn ? 'ENG' : 'CHI') || `Aura #${skillId}`
    status.textContent = isEn
      ? `${auraTitle} (Level ${castSlvl}) activated`
      : `${auraTitle}（等级 ${castSlvl}）已开启`
    return true
  }
  const castWeapon =
    context.equippedWeapon ??
    hudManager?.inventory?.equipped?.weapon1 ??
    (hudManager as any)?.getEquippedItems?.()?.weapon ??
    ((globalThis as Record<string, any>).__d2webHudInstance as HudCombatStateLike | null | undefined)?.inventory?.equipped?.weapon1 ??
    null
  const castWeaponInfo = getAttackWeaponInfo(castWeapon)
  let speed = 450
  let range = 450
  let damage = computeCastSkillDamage(skillId, castSlvl, castWeaponInfo)
  let delay = 0
  let skillName = isEn ? 'Skill' : '技能'
  let missileType: string | undefined = undefined
  let pierce: boolean | undefined = undefined
  let pierceChancePct: number | undefined = undefined
  let maxPierceCount: number | undefined = undefined
  let aoeRadius: number | undefined = undefined
  let aoeDamage: number | undefined = undefined
  let residualDamage: number | undefined = undefined
  let fireDuration: number | undefined = undefined
  let statusEffect: 'chill' | 'freeze' | 'poison' | undefined = undefined
  let statusDuration: number | undefined = undefined
  let homing: boolean | undefined = undefined
  let spiral: { originX: number; originY: number; angle: number; radius: number } | undefined = undefined
  let jitter: boolean | undefined = undefined
  let isUndeadOnly: boolean | undefined = undefined
  let multiCount = 1
  let spreadAngle = 0
  let isNova = false
  let chainRemaining: number | undefined = undefined
  let nextHit: boolean | number | undefined = undefined
  let nextDelay: number | undefined = undefined
  let customTargetAngles: number[] | undefined = undefined
  const pierceSlvl = resolveLearnedEffectiveSkillLevel(33, player, hudManager, engine)
  const itemPiercePct = Number((player as any).itemPiercePct ?? 0)
  const amaPierceChancePct =
    pierceSlvl > 0
      ? Math.min(100, calculatePierceStats(pierceSlvl, skillId).chancePct + itemPiercePct)
      : (player as any).pierce === true
        ? 100
        : Math.min(100, Math.max(0, itemPiercePct))
  const hasAmaPierce = amaPierceChancePct > 0
  const csSlvl = resolveLearnedEffectiveSkillLevel(9, player, hudManager, engine)
  const csChancePct = csSlvl > 0 ? calculateCriticalStrikeStats(csSlvl).chancePct : 0
  const csRoll =
    typeof (player as any).criticalStrikeRoll === 'number'
      ? Number((player as any).criticalStrikeRoll)
      : (Math.floor(engine?.world?.tick ?? 0) * 37 + skillId * 17 + Math.floor(Math.abs(targetX + targetY))) % 100
  const isAmaCrit = Boolean((player as any).criticalStrikeProc) || (csChancePct > 0 && csRoll < csChancePct)
  const amaCritMult = isAmaCrit ? 2 : 1

  // Amazon Javelin & Spear Pure Melee Skills: #10 Jab, #14 Power Strike, #19 Impale, #30 Fend
  if (skillId === 10 || skillId === 14 || skillId === 19 || skillId === 30) {
    const meleeReach = Math.max(60, castWeaponInfo.reach || 60)
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo)
    player.cooldown = castWeaponInfo.cooldown || 10
    player.swingTicks = castWeaponInfo.swingTicks || 6

    const findBestTargetInReach = (): Monster | null => {
      let bestTarget: Monster | null = null
      let bestCursorDist = meleeReach + 40
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        const distPlayer = Math.hypot(m.x - player.x, m.y - player.y)
        if (distPlayer <= meleeReach) {
          const distCursor = Math.hypot(m.x - targetX, m.y - targetY)
          if (distCursor <= bestCursorDist) {
            bestCursorDist = distCursor
            bestTarget = m
          }
        }
      }
      if (bestTarget === null) {
        let bestDist = meleeReach
        for (const m of engine.world.monsters) {
          if (m.state === 'dead' || m.hp <= 0) continue
          const distPlayer = Math.hypot(m.x - player.x, m.y - player.y)
          if (distPlayer <= bestDist) {
            bestDist = distPlayer
            bestTarget = m
          }
        }
      }
      return bestTarget
    }

    if (skillId === 10) {
      // #10 Jab (SKILLS_SrvDo004_Jab: 3 rapid strikes with -15 + 3*(slvl-1)% ED, +10 + 9*(slvl-1)% AR)
      const jabStats = calculateJabStats(castSlvl)
      const strikeDmg =
        Math.max(1, Math.floor((baseWepDmg * Math.max(1, 100 + jabStats.enhancedDamagePct)) / 100)) * amaCritMult
      const targetMonster = findBestTargetInReach()
      if (targetMonster !== null) {
        for (let s = 0; s < jabStats.strikesCount; s++) {
          if (targetMonster.state === 'dead' || targetMonster.hp <= 0) break
          damageMonster(engine.world, targetMonster.index, strikeDmg)
          engine.metrics.playerHits += 1
        }
        status.textContent = isEn
          ? `Jab (${jabStats.strikesCount} strikes) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `戳刺（${jabStats.strikesCount} 连击）命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Jab' : '施展技能：戳刺'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 14) {
      // #14 Power Strike (SKILLS_SrvDo006_PowerStrike: single melee strike + 5-band lightning damage + lightning hit overlay)
      const psStats = calculatePowerStrikeStats(castSlvl, {
        lightningBolt: resolveBaseSkillLevel(20, player, hudManager, engine),
        chargedStrike: resolveBaseSkillLevel(24, player, hudManager, engine),
        lightningStrike: resolveBaseSkillLevel(34, player, hudManager, engine),
        lightningFury: resolveBaseSkillLevel(35, player, hudManager, engine),
      })
      const ltngAvg = Math.max(1, Math.round((psStats.minDamage + psStats.maxDamage) / 2))
      const totalDmg = baseWepDmg * amaCritMult + ltngAvg
      const targetMonster = findBestTargetInReach()
      if (targetMonster !== null) {
        damageMonster(engine.world, targetMonster.index, totalDmg)
        engine.spawnOverlay('lightning', { x: targetMonster.x, y: targetMonster.y })
        engine.metrics.playerHits += 1
        status.textContent = isEn
          ? `Power Strike hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `威力一击命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Power Strike' : '施展技能：威力一击'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 19) {
      // #19 Impale (SKILLS_SrvDo009_Impale: +300+25*(slvl-1)% ED, +100+25*(slvl-1)% AR, 50-dm(0,30,slvl)% durability loss chance)
      const impStats = calculateImpaleStats(castSlvl)
      const impaleDmg =
        Math.max(1, Math.floor((baseWepDmg * (100 + impStats.enhancedDamagePct)) / 100)) * amaCritMult
      const targetMonster = findBestTargetInReach()
      if (targetMonster !== null) {
        damageMonster(engine.world, targetMonster.index, impaleDmg)
        engine.metrics.playerHits += 1
        if (castWeapon && typeof castWeapon.durability === 'number' && castWeapon.durability > 0) {
          const durRoll = engine.castRng
            ? engine.castRng.rand(100)
            : (((engine.world?.tick ?? 0) * 37 + (engine.metrics.casts ?? 0) * 13) & 0x7fffffff) % 100
          if (durRoll < impStats.durabilityLossChancePct) {
            castWeapon.durability = Math.max(0, castWeapon.durability - 1)
          }
        }
        status.textContent = isEn
          ? `Impale (+${impStats.enhancedDamagePct}% ED) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `刺穿（+${impStats.enhancedDamagePct}% 伤害）命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Impale' : '施展技能：刺穿'
      }
      engine.metrics.casts += 1
      return true
    }

    // #30 Fend (SKILLS_SrvDo005_Zeal: 1 strike per distinct living monster in reach, up to 12 targets)
    const fendStats = calculateFendStats(castSlvl)
    const fendDmg =
      Math.max(1, Math.floor((baseWepDmg * (100 + fendStats.enhancedDamagePct)) / 100)) * amaCritMult
    const targetsInReach = engine.world.monsters
      .filter(m => m.state !== 'dead' && m.hp > 0 && Math.hypot(m.x - player.x, m.y - player.y) <= meleeReach)
      .sort((a, b) => Math.hypot(a.x - targetX, a.y - targetY) - Math.hypot(b.x - targetX, b.y - targetY))
      .slice(0, fendStats.maxAdjacentTargets)
    if (targetsInReach.length > 0) {
      for (const m of targetsInReach) {
        damageMonster(engine.world, m.index, fendDmg)
        engine.metrics.playerHits += 1
      }
      status.textContent = isEn
        ? `Fend hit ${targetsInReach.length} targets`
        : `急刺命中 ${targetsInReach.length} 个目标`
    } else {
      engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
      status.textContent = isEn ? 'Cast skill: Fend' : '施展技能：急刺'
    }
    engine.metrics.casts += 1
    return true
  }

  // Paladin Combat Skills: #96 Sacrifice, #97 Smite, #106 Zeal, #107 Charge, #111 Vengeance, #116 Conversion, #117 Holy Shield
  if (
    skillId === 96 ||
    skillId === 97 ||
    skillId === 106 ||
    skillId === 107 ||
    skillId === 111 ||
    skillId === 116 ||
    skillId === 117
  ) {
    if (skillId === 117) {
      // #117 Holy Shield (SKILLS_SrvDo077_HolyShield: state 101 holyshield)
      const defianceBlvl = resolveBaseSkillLevel(104, player, hudManager, engine)
      const hsStats = calculateHolyShieldStats(castSlvl, defianceBlvl)
      ;(player as any).holyShieldTicks = hsStats.durationFrames
      ;(player as any).holyShieldSlvl = castSlvl
      ;(player as any).holyShieldDefensePct = hsStats.defensePct
      ;(player as any).holyShieldBlockBonus = hsStats.blockChancePct
      ;(player as any).holyShieldSmiteDamageMin = hsStats.smiteMinFlat
      ;(player as any).holyShieldSmiteDamageMax = hsStats.smiteMaxFlat
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn
        ? `Holy Shield (Level ${castSlvl}, +${hsStats.defensePct}% Def, +${hsStats.blockChancePct}% Block) activated`
        : `神圣之盾（等级 ${castSlvl}，+${hsStats.defensePct}% 防御，+${hsStats.blockChancePct}% 格挡）已开启`
      return true
    }

    const meleeReach = Math.max(60, castWeaponInfo.reach || 60)
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo)
    player.cooldown = castWeaponInfo.cooldown || 10
    player.swingTicks = castWeaponInfo.swingTicks || 6

    const findBestTargetInReach = (maxDist = meleeReach): Monster | null => {
      let bestTarget: Monster | null = null
      let bestCursorDist = maxDist + 40
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        const distPlayer = Math.hypot(m.x - player.x, m.y - player.y)
        if (distPlayer <= maxDist) {
          const distCursor = Math.hypot(m.x - targetX, m.y - targetY)
          if (distCursor <= bestCursorDist) {
            bestCursorDist = distCursor
            bestTarget = m
          }
        }
      }
      if (bestTarget === null) {
        let bestDist = maxDist
        for (const m of engine.world.monsters) {
          if (m.state === 'dead' || m.hp <= 0) continue
          const distPlayer = Math.hypot(m.x - player.x, m.y - player.y)
          if (distPlayer <= bestDist) {
            bestDist = distPlayer
            bestTarget = m
          }
        }
      }
      return bestTarget
    }

    if (skillId === 96) {
      // #96 Sacrifice (SKILLS_SrvDo069_Sacrifice: 8% self-damage mitigated by caster damageresist capped at 50%, can be lethal)
      const redemptionBlvl = resolveBaseSkillLevel(124, player, hudManager, engine)
      const fanatBlvl = resolveBaseSkillLevel(122, player, hudManager, engine)
      const sacStats = calculateSacrificeStats(castSlvl, { redemption: redemptionBlvl, fanaticism: fanatBlvl })
      const sacDmg = Math.max(1, Math.floor((baseWepDmg * (100 + sacStats.damagePct)) / 100))
      const targetMonster = findBestTargetInReach()
      if (targetMonster !== null) {
        const hpBefore = targetMonster.hp
        damageMonster(engine.world, targetMonster.index, sacDmg)
        engine.metrics.playerHits += 1
        const cappedBaseDmg = Math.min(sacDmg, Math.max(0, hpBefore))
        const rawSelfDmg = Math.floor((cappedBaseDmg * sacStats.selfDamagePct) / 100)
        const drPct = Math.max(-100, Math.min(50, Number((player as any).damageResist ?? (player as any).drPct ?? 0)))
        const selfDmg = Math.max(0, Math.floor((rawSelfDmg * (100 - drPct)) / 100))
        if (typeof player.hp === 'number') {
          player.hp = Math.max(0, player.hp - selfDmg)
        }
        status.textContent = isEn
          ? `Sacrifice (+${sacStats.damagePct}% ED) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `牺牲（+${sacStats.damagePct}% 伤害）命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Sacrifice' : '施展技能：牺牲'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 97) {
      // #97 Smite (SKILLS_SrvDo073_Smite: ToHitCalc=0 auto-hit, shield base + Holy Shield bonus, knockback + stun)
      const shield =
        (context as any).equippedShield ??
        hudManager?.inventory?.equipped?.weapon2 ??
        globalBag.__d2webHudInstance?.inventory?.equipped?.weapon2
      const shieldMin = Number(shield?.smiteMin ?? shield?.minDam ?? 2)
      const shieldMax = Number(shield?.smiteMax ?? shield?.maxDam ?? 6)
      const hsBonusMin = Number((player as any).holyShieldTicks > 0 ? (player as any).holyShieldSmiteDamageMin ?? 0 : 0)
      const hsBonusMax = Number((player as any).holyShieldTicks > 0 ? (player as any).holyShieldSmiteDamageMax ?? 0 : 0)
      const smStats = calculateSmiteStats(castSlvl, shieldMin, shieldMax, { min: hsBonusMin, max: hsBonusMax })
      const smiteDmg = Math.max(1, Math.round((smStats.minDamage + smStats.maxDamage) / 2))
      const targetMonster = findBestTargetInReach()
      if (targetMonster !== null) {
        damageMonster(engine.world, targetMonster.index, smiteDmg)
        ;(targetMonster as any).stunTicks = Math.max((targetMonster as any).stunTicks ?? 0, smStats.stunDurationFrames)
        const kAngle = Math.atan2(targetMonster.y - player.y, targetMonster.x - player.x)
        targetMonster.x += Math.cos(kAngle) * 16
        targetMonster.y += Math.sin(kAngle) * (16 * ISO_GROUND_ASPECT_RATIO)
        engine.spawnOverlay('stun', { x: targetMonster.x, y: targetMonster.y }, `monster-${targetMonster.index}`)
        engine.metrics.playerHits += 1
        status.textContent = isEn
          ? `Smite (+${smStats.damagePct}% ED, ${(smStats.stunDurationFrames / 25).toFixed(1)}s stun) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `重击（+${smStats.damagePct}% 伤害，眩晕 ${(smStats.stunDurationFrames / 25).toFixed(1)} 秒）命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Smite' : '施展技能：重击'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 106) {
      // #106 Zeal (SKILLS_SrvDo005_Zeal: min(5, 1 + slvl) strikes across living monsters in reach)
      const sacBlvl = resolveBaseSkillLevel(96, player, hudManager, engine)
      const zealStats = calculateZealStats(castSlvl, { sacrifice: sacBlvl })
      const strikeDmg = Math.max(1, Math.floor((baseWepDmg * (100 + zealStats.damagePct)) / 100))
      const candidates = engine.world.monsters
        .filter(m => m.state !== 'dead' && m.hp > 0 && Math.hypot(m.x - player.x, m.y - player.y) <= meleeReach)
        .sort((a, b) => Math.hypot(a.x - targetX, a.y - targetY) - Math.hypot(b.x - targetX, b.y - targetY))
      if (candidates.length > 0) {
        let hitsDealt = 0
        for (let s = 0; s < zealStats.hits; s++) {
          const aliveCandidates = candidates.filter(m => m.state !== 'dead' && m.hp > 0)
          if (aliveCandidates.length === 0) break
          const tgt = aliveCandidates[s % aliveCandidates.length]!
          damageMonster(engine.world, tgt.index, strikeDmg)
          engine.metrics.playerHits += 1
          hitsDealt += 1
        }
        status.textContent = isEn
          ? `Zeal (${hitsDealt}/${zealStats.hits} strikes) hit`
          : `白热（${hitsDealt}/${zealStats.hits} 连击）命中`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Zeal' : '施展技能：白热'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 107) {
      // #107 Charge (SKILLS_SrvDo075_Charge: sprint toward target, impact damage + knockback + charge overlay)
      const vigorBlvl = resolveBaseSkillLevel(115, player, hudManager, engine)
      const mightBlvl = resolveBaseSkillLevel(98, player, hudManager, engine)
      const chgStats = calculateChargeStats(castSlvl, { vigor: vigorBlvl, might: mightBlvl })
      const chgDmg = Math.max(1, Math.floor((baseWepDmg * (100 + chgStats.damagePct)) / 100))
      const targetMonster = findBestTargetInReach(480)
      if (targetMonster !== null) {
        const approachAngle = Math.atan2(player.y - targetMonster.y, player.x - targetMonster.x)
        const nextX = targetMonster.x + Math.cos(approachAngle) * 24
        const nextY = targetMonster.y + Math.sin(approachAngle) * 24
        if (!isBlockedAt(runtime.grid, nextX, nextY)) {
          player.x = nextX
          player.y = nextY
        }
        damageMonster(engine.world, targetMonster.index, chgDmg)
        const kbAngle = Math.atan2(targetMonster.y - player.y, targetMonster.x - player.x)
        targetMonster.x += Math.cos(kbAngle) * 20
        targetMonster.y += Math.sin(kbAngle) * (20 * ISO_GROUND_ASPECT_RATIO)
        engine.spawnOverlay('charge', { x: targetMonster.x, y: targetMonster.y })
        engine.metrics.playerHits += 1
        status.textContent = isEn
          ? `Charge (+${chgStats.damagePct}% ED) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `冲锋（+${chgStats.damagePct}% 伤害）命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        if (!isBlockedAt(runtime.grid, targetX, targetY)) {
          player.x = targetX
          player.y = targetY
        }
        status.textContent = isEn ? 'Cast skill: Charge' : '施展技能：冲锋'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 111) {
      // #111 Vengeance (SKILLS_SrvDo071_Vengeance: base weapon physical + tri-elemental Fire/Cold/Lightning + chill)
      const vngStats = calculateVengeanceStats(castSlvl, {
        resistFire: resolveBaseSkillLevel(100, player, hudManager, engine),
        resistCold: resolveBaseSkillLevel(105, player, hudManager, engine),
        resistLightning: resolveBaseSkillLevel(110, player, hudManager, engine),
        salvation: resolveBaseSkillLevel(125, player, hudManager, engine),
      })
      const fireDmg = Math.floor((baseWepDmg * vngStats.firePct) / 100)
      const coldDmg = Math.floor((baseWepDmg * vngStats.coldPct) / 100)
      const ltngDmg = Math.floor((baseWepDmg * vngStats.ltngPct) / 100)
      const totalDmg = Math.max(1, baseWepDmg + fireDmg + coldDmg + ltngDmg)
      const targetMonster = findBestTargetInReach()
      if (targetMonster !== null) {
        damageMonster(engine.world, targetMonster.index, totalDmg)
        targetMonster.chillTicks = Math.max(targetMonster.chillTicks ?? 0, vngStats.chillDurationFrames)
        engine.metrics.playerHits += 1
        status.textContent = isEn
          ? `Vengeance (+${vngStats.firePct}% Fire / +${vngStats.coldPct}% Cold / +${vngStats.ltngPct}% Ltng) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `复仇（+${vngStats.firePct}% 火焰 / +${vngStats.coldPct}% 冰冷 / +${vngStats.ltngPct}% 闪电）命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Vengeance' : '施展技能：复仇'
      }
      engine.metrics.casts += 1
      return true
    }

    // #116 Conversion (SKILLS_SrvDo079_Conversion: melee hit first, then dm34 conversion roll on living non-Boss/Champion)
    const convStats = calculateConversionStats(castSlvl)
    const targetMonster = findBestTargetInReach()
    if (targetMonster !== null) {
      damageMonster(engine.world, targetMonster.index, baseWepDmg)
      engine.metrics.playerHits += 1
      const isBossOrChamp = Boolean(
        (targetMonster.stats as any)?.isBoss ||
          (targetMonster.stats as any)?.type === 'boss' ||
          (targetMonster.stats as any)?.rank === 'champion' ||
          (targetMonster.stats as any)?.rank === 'unique' ||
          (targetMonster.stats as any)?.rank === 'superunique',
      )
      if (targetMonster.state !== 'dead' && targetMonster.hp > 0 && !isBossOrChamp) {
        const roll = engine.castRng
          ? engine.castRng.rand(100)
          : (((engine.world?.tick ?? 0) * 37 + (engine.metrics.casts ?? 0) * 19) & 0x7fffffff) % 100
        if (roll < convStats.chancePct) {
          ;(targetMonster as any).convertedTicks = convStats.durationFrames
          const clvl = Number(player.level ?? 1)
          const mlvl = Number((targetMonster.stats as any)?.level ?? (targetMonster as any).level ?? clvl)
          if (clvl < mlvl && mlvl > 0) {
            ;(targetMonster as any).conversionSavedLevel = mlvl
            ;(targetMonster as any).level = clvl
            targetMonster.hp = Math.max(1, Math.floor((targetMonster.hp * clvl) / mlvl))
          }
          engine.spawnOverlay('conversionaura', { x: targetMonster.x, y: targetMonster.y }, `monster-${targetMonster.index}`, { loop: true, isStateOverlay: true })
        }
      }
      status.textContent = isEn
        ? `Conversion (${convStats.chancePct}% chance) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
        : `感化（${convStats.chancePct}% 几率）命中：${targetMonster.stats.name || targetMonster.stats.id}`
    } else {
      engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
      status.textContent = isEn ? 'Cast skill: Conversion' : '施展技能：感化'
    }
    engine.metrics.casts += 1
    return true
  }

  // Barbarian Combat Skills: #126 Bash, #132 Leap, #133 Double Swing, #139 Stun, #143 Leap Attack, #144 Concentrate, #147 Frenzy, #151 Whirlwind, #152 Berserk
  if (
    skillId === 126 ||
    skillId === 132 ||
    skillId === 133 ||
    skillId === 139 ||
    skillId === 143 ||
    skillId === 144 ||
    skillId === 147 ||
    skillId === 151 ||
    skillId === 152
  ) {
    const meleeReach = Math.max(60, castWeaponInfo.reach || 60)
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo)
    player.cooldown = castWeaponInfo.cooldown || 10
    player.swingTicks = castWeaponInfo.swingTicks || 6

    const findBestTargetInReach = (maxDist = meleeReach): Monster | null => {
      let bestTarget: Monster | null = null
      let bestCursorDist = maxDist + 40
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        const distPlayer = Math.hypot(m.x - player.x, m.y - player.y)
        if (distPlayer <= maxDist) {
          const distCursor = Math.hypot(m.x - targetX, m.y - targetY)
          if (distCursor <= bestCursorDist) {
            bestCursorDist = distCursor
            bestTarget = m
          }
        }
      }
      if (bestTarget === null) {
        let bestDist = maxDist
        for (const m of engine.world.monsters) {
          if (m.state === 'dead' || m.hp <= 0) continue
          const distPlayer = Math.hypot(m.x - player.x, m.y - player.y)
          if (distPlayer <= bestDist) {
            bestDist = distPlayer
            bestTarget = m
          }
        }
      }
      return bestTarget
    }

    if (skillId === 126) {
      // #126 Bash: +50 + 5*(slvl-1) + 5*blvl(139)% ED, +slvl flat physical damage, +20 + 5*(slvl-1) + 5*blvl(144)% AR, 100% knockback (no srvoverlay, #1079)
      const stunBlvl = resolveBaseSkillLevel(139, player, hudManager, engine)
      const concBlvl = resolveBaseSkillLevel(144, player, hudManager, engine)
      const bashStats = calculateBashStats(castSlvl, stunBlvl, concBlvl)
      const bashDmg = Math.max(
        1,
        Math.floor((baseWepDmg * (100 + bashStats.damageBonusPct)) / 100) + bashStats.flatPhysicalMin,
      )
      const targetMonster = findBestTargetInReach()
      if (targetMonster !== null) {
        damageMonster(engine.world, targetMonster.index, bashDmg)
        const kbAngle = Math.atan2(targetMonster.y - player.y, targetMonster.x - player.x)
        targetMonster.x += Math.cos(kbAngle) * 16
        targetMonster.y += Math.sin(kbAngle) * (16 * ISO_GROUND_ASPECT_RATIO)
        ;(targetMonster as any).knockedBack = true
        engine.metrics.playerHits += 1
        status.textContent = isEn
          ? `Bash (+${bashStats.damageBonusPct}% ED, +${bashStats.flatPhysicalMin} Dmg) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `重击（+${bashStats.damageBonusPct}% 伤害，+${bashStats.flatPhysicalMin} 平伤）命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Bash' : '施展技能：重击'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 132) {
      // #132 Leap (SKILLS_SrvDo077_Leap): pure parabolic movement (0 damage) + radial knockback on landing
      const leapStats = calculateLeapStats(castSlvl)
      const maxLeapPx = leapStats.leapDistanceSubtiles * (40 * (2 / 3))
      const dxLeap = targetX - player.x
      const dyLeap = targetY - player.y
      const distLeap = Math.hypot(dxLeap, dyLeap)
      const landX = distLeap > maxLeapPx && distLeap > 0 ? player.x + (dxLeap / distLeap) * maxLeapPx : targetX
      const landY = distLeap > maxLeapPx && distLeap > 0 ? player.y + (dyLeap / distLeap) * maxLeapPx : targetY
      if (!runtime?.grid || !isBlockedAt(runtime.grid, landX, landY)) {
        player.x = landX
        player.y = landY
      }
      const kbRadiusPx = leapStats.knockbackRadiusSubtiles * (40 * (2 / 3))
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        const isBoss = Boolean(
          (m.stats as any)?.isBoss || (m.stats as any)?.type === 'boss' || (m as any).isBoss || (m as any).isSuperUnique,
        )
        if (isBoss) continue
        if (Math.hypot(m.x - player.x, (m.y - player.y) / ISO_GROUND_ASPECT_RATIO) <= kbRadiusPx) {
          const kbAngle = Math.atan2(m.y - player.y, m.x - player.x)
          m.x += Math.cos(kbAngle) * 20
          m.y += Math.sin(kbAngle) * (20 * ISO_GROUND_ASPECT_RATIO)
          ;(m as any).knockedBack = true
        }
      }
      player.cooldown = 0
      engine.metrics.casts += 1
      status.textContent = isEn ? 'Cast skill: Leap' : '施展技能：跳跃'
      return true
    }

    if (skillId === 133) {
      // #133 Double Swing (SKILLS_SrvDo070_DoubleSwing): 2 rapid dual-wield swings, +10%*blvl(126) ED, mana cost decreases to 0 at slvl 9+
      const bashBlvl = resolveBaseSkillLevel(126, player, hudManager, engine)
      const dsStats = calculateDoubleSwingStats(castSlvl, bashBlvl)
      const swingDmg = Math.max(1, Math.floor((baseWepDmg * (100 + dsStats.damageBonusPct)) / 100))
      const candidates = engine.world.monsters
        .filter(m => m.state !== 'dead' && m.hp > 0 && Math.hypot(m.x - player.x, m.y - player.y) <= meleeReach)
        .sort((a, b) => Math.hypot(a.x - targetX, a.y - targetY) - Math.hypot(b.x - targetX, b.y - targetY))
      if (candidates.length > 0) {
        let hitsDealt = 0
        for (let s = 0; s < 2; s++) {
          const alive = candidates.filter(m => m.state !== 'dead' && m.hp > 0)
          if (alive.length === 0) break
          const tgt = alive[s % alive.length]!
          damageMonster(engine.world, tgt.index, swingDmg)
          engine.metrics.playerHits += 1
          hitsDealt += 1
        }
        status.textContent = isEn
          ? `Double Swing (${hitsDealt}/2 strikes) hit`
          : `双手挥击（${hitsDealt}/2 连击）命中`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Double Swing' : '施展技能：双手挥击'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 139) {
      // #139 Stun: +8%*blvl(126) ED, +15+5*(slvl-1)+5*blvl(144)% AR, 3-band stun duration + 5%*blvl(154) capped at 250f
      const bashBlvl = resolveBaseSkillLevel(126, player, hudManager, engine)
      const wcBlvl = resolveBaseSkillLevel(154, player, hudManager, engine)
      const concBlvl = resolveBaseSkillLevel(144, player, hudManager, engine)
      const stunStats = calculateStunStats(castSlvl, bashBlvl, wcBlvl, concBlvl)
      const stunDmg = Math.max(1, Math.floor((baseWepDmg * (100 + stunStats.damageBonusPct)) / 100))
      const targetMonster = findBestTargetInReach()
      if (targetMonster !== null) {
        damageMonster(engine.world, targetMonster.index, stunDmg)
        const isBoss = Boolean(
          (targetMonster.stats as any)?.isBoss ||
            (targetMonster.stats as any)?.type === 'boss' ||
            (targetMonster as any).isBoss ||
            (targetMonster as any).isSuperUnique,
        )
        if (!isBoss) {
          ;(targetMonster as any).stunTicks = Math.max((targetMonster as any).stunTicks ?? 0, stunStats.stunDurationFrames)
          engine.spawnOverlay('stun', { x: targetMonster.x, y: targetMonster.y }, `monster-${targetMonster.index}`)
        }
        engine.metrics.playerHits += 1
        status.textContent = isEn
          ? `Stun (${(stunStats.stunDurationFrames / 25).toFixed(2)}s) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `击昏（眩晕 ${(stunStats.stunDurationFrames / 25).toFixed(2)} 秒）命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Stun' : '施展技能：击昏'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 143) {
      // #143 Leap Attack (SKILLS_SrvSt41 & SKILLS_SrvDo078): in-melee ground strike fallback or parabolic jump + melee strike + knockback
      const leapBlvl = resolveBaseSkillLevel(132, player, hudManager, engine)
      const laStats = calculateLeapAttackStats(castSlvl, leapBlvl)
      const laDmg = Math.max(1, Math.floor((baseWepDmg * (100 + laStats.damageBonusPct)) / 100))
      const inMeleeTarget = findBestTargetInReach(meleeReach)
      let targetMonster = inMeleeTarget
      if (inMeleeTarget !== null) {
        ;(player as any).lastLeapAttackInMelee = true
      } else {
        ;(player as any).lastLeapAttackInMelee = false
        targetMonster = findBestTargetInReach(540)
        const destX = targetMonster ? targetMonster.x : targetX
        const destY = targetMonster ? targetMonster.y : targetY
        if (!runtime?.grid || !isBlockedAt(runtime.grid, destX, destY)) {
          player.x = destX
          player.y = destY
        }
      }
      const kbRadiusPx = laStats.knockbackRadiusSubtiles * (40 * (2 / 3))
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        const isBoss = Boolean(
          (m.stats as any)?.isBoss || (m.stats as any)?.type === 'boss' || (m as any).isBoss || (m as any).isSuperUnique,
        )
        if (isBoss) continue
        if (Math.hypot(m.x - player.x, (m.y - player.y) / ISO_GROUND_ASPECT_RATIO) <= kbRadiusPx) {
          const kbAngle = Math.atan2(m.y - player.y, m.x - player.x)
          m.x += Math.cos(kbAngle) * 16
          m.y += Math.sin(kbAngle) * (16 * ISO_GROUND_ASPECT_RATIO)
          ;(m as any).knockedBack = true
        }
      }
      if (targetMonster !== null) {
        damageMonster(engine.world, targetMonster.index, laDmg)
        engine.spawnOverlay('bash', { x: targetMonster.x, y: targetMonster.y }, `monster-${targetMonster.index}`)
        engine.metrics.playerHits += 1
        status.textContent = isEn
          ? `Leap Attack (+${laStats.damageBonusPct}% ED) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `跳跃攻击（+${laStats.damageBonusPct}% 伤害）命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        status.textContent = isEn ? 'Cast skill: Leap Attack' : '施展技能：跳跃攻击'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 144) {
      // #144 Concentrate: uninterruptible swing, State #15 concentrate (+100+10*(slvl-1)+10*blvl(145)% Def), +1%/blvl(152) Magic conversion
      const bashBlvl = resolveBaseSkillLevel(126, player, hudManager, engine)
      const boBlvl = resolveBaseSkillLevel(149, player, hudManager, engine)
      const berserkBlvl = resolveBaseSkillLevel(152, player, hudManager, engine)
      const ironSkinBlvl = resolveBaseSkillLevel(145, player, hudManager, engine)
      const concStats = calculateConcentrateStats(castSlvl, bashBlvl, boBlvl, berserkBlvl, ironSkinBlvl)
      ;(player as any).concentrateTicks = 25
      ;(player as any).concentrateDefensePct = concStats.defenseBonusPct
      ;(player as any).uninterruptibleAttack = true
      const totalDmg = Math.max(1, Math.floor((baseWepDmg * (100 + concStats.damageBonusPct)) / 100))
      const magicDmg = Math.floor((totalDmg * concStats.magicConversionPct) / 100)
      const physDmg = totalDmg - magicDmg
      const targetMonster = findBestTargetInReach()
      if (targetMonster !== null) {
        damageMonster(engine.world, targetMonster.index, physDmg + magicDmg)
        ;(targetMonster as any).lastMagicDamageTaken = magicDmg
        engine.spawnOverlay('doubledamage1', { x: targetMonster.x, y: targetMonster.y }, `monster-${targetMonster.index}`)
        engine.metrics.playerHits += 1
        status.textContent = isEn
          ? `Concentrate (+${concStats.damageBonusPct}% ED, +${concStats.defenseBonusPct}% Def) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
          : `专心（+${concStats.damageBonusPct}% 伤害，+${concStats.defenseBonusPct}% 防御）命中：${targetMonster.stats.name || targetMonster.stats.id}`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Concentrate' : '施展技能：专心'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 147) {
      // #147 Frenzy: 2 dual-wield swings, stacking State #9 frenzy (`nValue = min(slvl, prev + 1)`, dm34 FRW, dm56 IAS, 150 + 10*blvl(141) frames)
      const dsBlvl = resolveBaseSkillLevel(133, player, hudManager, engine)
      const tauntBlvl = resolveBaseSkillLevel(137, player, hudManager, engine)
      const berserkBlvl = resolveBaseSkillLevel(152, player, hudManager, engine)
      const incStamBlvl = resolveBaseSkillLevel(141, player, hudManager, engine)
      const frzStats = calculateFrenzyStats(castSlvl, dsBlvl, tauntBlvl, berserkBlvl, incStamBlvl)
      const swingDmg = Math.max(1, Math.floor((baseWepDmg * (100 + frzStats.damageBonusPct)) / 100))
      const candidates = engine.world.monsters
        .filter(m => m.state !== 'dead' && m.hp > 0 && Math.hypot(m.x - player.x, m.y - player.y) <= meleeReach)
        .sort((a, b) => Math.hypot(a.x - targetX, a.y - targetY) - Math.hypot(b.x - targetX, b.y - targetY))
      if (candidates.length > 0) {
        let hitsDealt = 0
        for (let s = 0; s < 2; s++) {
          const alive = candidates.filter(m => m.state !== 'dead' && m.hp > 0)
          if (alive.length === 0) break
          const tgt = alive[s % alive.length]!
          damageMonster(engine.world, tgt.index, swingDmg)
          engine.metrics.playerHits += 1
          hitsDealt += 1
        }
        const prevStacks = Number((player as any).frenzyTicks ?? 0) > 0 ? Number((player as any).frenzyStacks ?? 0) : 0
        const stackState = calculateFrenzyStackState(prevStacks, hitsDealt, castSlvl, 0, 0, incStamBlvl)
        ;(player as any).frenzyStacks = stackState.activeStacks
        ;(player as any).frenzyTicks = frzStats.durationFrames
        ;(player as any).frenzyRunSpeedPct = stackState.currentRunSpeedBonusPct
        ;(player as any).frenzyAttackSpeedPct = stackState.currentAttackSpeedBonusPct
        engine.spawnOverlay('frenzy1', { x: player.x, y: player.y }, 'player', { loop: true, isStateOverlay: true })
        status.textContent = isEn
          ? `Frenzy (Stack ${stackState.activeStacks}, +${stackState.currentRunSpeedBonusPct}% FRW, +${stackState.currentAttackSpeedBonusPct}% IAS) hit`
          : `狂乱（第 ${stackState.activeStacks} 层，+${stackState.currentRunSpeedBonusPct}% 移速，+${stackState.currentAttackSpeedBonusPct}% 攻速）命中`
      } else {
        engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
        status.textContent = isEn ? 'Cast skill: Frenzy' : '施展技能：狂乱'
      }
      engine.metrics.casts += 1
      return true
    }

    if (skillId === 151) {
      // #151 Whirlwind (SKILLS_SrvDo076_Whirlwind): -50+8*(slvl-1)% ED, initial hit checks at frames 0 & 4 + weapon IAS breakpoints, suppresses CtC
      const wwStats = calculateWhirlwindStats(castSlvl)
      const wwFrames = calculateWhirlwindHitFrames(
        16,
        Number((castWeapon as any)?.ias ?? (player as any).weaponIas ?? 0),
        Number((castWeapon as any)?.wsm ?? (player as any).weaponBaseSpeed ?? 0),
        Boolean((player as any).hasDualWield || (player as any).isDualWielding),
        Boolean((castWeaponInfo as any).isTwoHanded && castWeaponInfo.subtype !== 'sword'),
      )
      ;(player as any).whirlwindTicks = 16
      ;(player as any).skillMoveTicks = 16
      ;(player as any).whirlwindHitFrames = wwFrames.hitFrames
      ;(player as any).whirlwindSuppressCtc = true
      const strikeDmg = Math.max(1, Math.floor((baseWepDmg * Math.max(1, 100 + wwStats.damageBonusPct)) / 100))
      const startX = player.x
      const startY = player.y
      if (!runtime?.grid || !isBlockedAt(runtime.grid, targetX, targetY)) {
        player.x = targetX
        player.y = targetY
      }
      let hitsDealt = 0
      for (let idx = 0; idx < wwFrames.hitFrames.length; idx++) {
        const t = wwFrames.hitFrames.length > 1 ? idx / (wwFrames.hitFrames.length - 1) : 1
        const checkX = startX + (player.x - startX) * t
        const checkY = startY + (player.y - startY) * t
        const aliveInReach = engine.world.monsters.filter(
          m => m.state !== 'dead' && m.hp > 0 && Math.hypot(m.x - checkX, m.y - checkY) <= meleeReach + 32,
        )
        if (aliveInReach.length > 0) {
          const tgt = aliveInReach[idx % aliveInReach.length]!
          damageMonster(engine.world, tgt.index, strikeDmg)
          engine.metrics.playerHits += 1
          hitsDealt += 1
        }
      }
      status.textContent = isEn
        ? `Whirlwind (${hitsDealt} hits) executed`
        : `旋风斩（命中 ${hitsDealt} 次）已施展`
      engine.metrics.casts += 1
      return true
    }

    // #152 Berserk (SKILLS_SrvSt39_Berserk): 100% physical converted to Magic damage, State #95 berserk zeroes Defense for 75 - dm(25, 75, slvl) frames
    const howlBlvl = resolveBaseSkillLevel(130, player, hudManager, engine)
    const shoutBlvl = resolveBaseSkillLevel(138, player, hudManager, engine)
    const bzkStats = calculateBerserkStats(castSlvl, howlBlvl, shoutBlvl)
    ;(player as any).berserkTicks = bzkStats.zeroDefenseDurationFrames
    ;(player as any).berserkDefenseZero = true
    ;(player as any).berserkSlvl = castSlvl
    ;(player as any).berserkEdPct = bzkStats.damageBonusPct
    engine.spawnOverlay('berserkfront', { x: player.x, y: player.y }, 'player', { loop: true, isStateOverlay: true })
    const bzkMagicDmg = Math.max(1, Math.floor((baseWepDmg * (100 + bzkStats.damageBonusPct)) / 100))
    const targetMonster = findBestTargetInReach()
    if (targetMonster !== null) {
      damageMonster(engine.world, targetMonster.index, bzkMagicDmg)
      ;(targetMonster as any).lastMagicDamageTaken = bzkMagicDmg
      engine.metrics.playerHits += 1
      status.textContent = isEn
        ? `Berserk (+${bzkStats.damageBonusPct}% Magic Dmg, 0 Def for ${(bzkStats.zeroDefenseDurationFrames / 25).toFixed(2)}s) hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
        : `狂暴（+${bzkStats.damageBonusPct}% 魔法伤害，防御归零 ${(bzkStats.zeroDefenseDurationFrames / 25).toFixed(2)} 秒）命中：${targetMonster.stats.name || targetMonster.stats.id}`
    } else {
      engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
      status.textContent = isEn ? 'Cast skill: Berserk' : '施展技能：狂暴'
    }
    engine.metrics.casts += 1
    return true
  }

  if (skillId === 36) {
    const missile = getMissileTxtData('firebolt')
    speed = missile.speedPxPerSec || 500
    range = missile.distancePx || 1000
    damage = computeCastSkillDamage(36, castSlvl, castWeaponInfo)
    delay = 0
    missileType = 'firebolt'
    skillName = '火弹'
  } else if (skillId === 47) {
    const missile = getMissileTxtData('fireball')
    speed = missile.speedPxPerSec || 500
    range = missile.distancePx || 1000
    const slvl = Math.max(1, (hudManager as any)?.getSkillLevel?.(47) ?? castSlvl)
    const fireBoltBlvl = (hudManager as any)?.getSkillLevel?.(36) ?? 0
    const meteorBlvl = (hudManager as any)?.getSkillLevel?.(56) ?? 0
    const fireMasterySlvl = (hudManager as any)?.getSkillLevel?.(61) ?? 0
    const dmgRange = calculateSkillDamage(47, slvl, { fireBolt: fireBoltBlvl, meteor: meteorBlvl, fireMastery: fireMasterySlvl })
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    aoeRadius = 80
    missileType = 'fireball'
    skillName = '火球'
  } else if (skillId === 39) {
    const missile = getMissileTxtData('icebolt')
    speed = missile.speedPxPerSec || 300
    range = missile.distancePx || 600
    damage = computeCastSkillDamage(39, castSlvl, castWeaponInfo)
    delay = 0
    statusEffect = 'chill'
    statusDuration = 50
    missileType = 'icebolt'
    skillName = '冰弹'
  } else if (skillId === 45) {
    const missile = getMissileTxtData('iceblast')
    speed = missile.speedPxPerSec || 300
    range = missile.distancePx || 600
    const slvl = (hudManager as any)?.getSkillLevel?.(45) ?? castSlvl
    const iceBoltBlvl = (hudManager as any)?.getSkillLevel?.(39) ?? 0
    const blizzardBlvl = (hudManager as any)?.getSkillLevel?.(59) ?? 0
    const frozenOrbBlvl = (hudManager as any)?.getSkillLevel?.(64) ?? 0
    const glacialSpikeBlvl = (hudManager as any)?.getSkillLevel?.(55) ?? 0
    const synergies = {
      iceBolt: iceBoltBlvl,
      blizzard: blizzardBlvl,
      frozenOrb: frozenOrbBlvl,
      glacialSpike: glacialSpikeBlvl,
    }
    const dmgRange = calculateSkillDamage(45, slvl, synergies)
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    statusEffect = 'freeze'
    statusDuration = calculateIceBlastFreezeLength(slvl, synergies)
    missileType = 'iceblast'
    skillName = '冰风暴'
  } else if (skillId === 55) {
    const missile = getMissileTxtData('glacialspike')
    speed = missile.speedPxPerSec || 400
    range = missile.distancePx || 640
    const slvl = (hudManager as any)?.getSkillLevel?.(55) ?? castSlvl
    const iceBoltBlvl = (hudManager as any)?.getSkillLevel?.(39) ?? 0
    const iceBlastBlvl = (hudManager as any)?.getSkillLevel?.(45) ?? 0
    const blizzardBlvl = (hudManager as any)?.getSkillLevel?.(59) ?? 0
    const frozenOrbBlvl = (hudManager as any)?.getSkillLevel?.(64) ?? 0
    const synergies = {
      iceBolt: iceBoltBlvl,
      iceBlast: iceBlastBlvl,
      blizzard: blizzardBlvl,
      frozenOrb: frozenOrbBlvl,
    }
    const dmgRange = calculateSkillDamage(55, slvl, synergies)
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    aoeRadius = 64
    statusEffect = 'freeze'
    statusDuration = calculateGlacialSpikeFreezeLength(slvl, synergies)
    missileType = 'glacialspike'
    skillName = '冰尖柱'
  } else if (skillId === 38) {
    const missile = getMissileTxtData('chargedbolt')
    speed = missile.speedPxPerSec || 300
    range = missile.distancePx || 1176
    const slvl = (hudManager as any)?.getSkillLevel?.(38) ?? castSlvl
    const lightningBlvl = (hudManager as any)?.getSkillLevel?.(49) ?? 0
    const dmgRange = calculateSkillDamage(38, slvl, { lightning: lightningBlvl } as any)
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    missileType = 'chargedbolt'
    jitter = true
    multiCount = calculateChargedBoltCount(slvl)
    spreadAngle = 0.55
    skillName = '充能弹'
  } else if (skillId === 67) {
    const missile = getMissileTxtData('teeth')
    speed = missile.speedPxPerSec || 400
    range = missile.distancePx || 800
    const slvl = resolveCastSkillLevel(67, player, hudManager, engine)
    const boneWallBlvl = resolveBaseSkillLevel(78, player, hudManager, engine)
    const bonePrisonBlvl = resolveBaseSkillLevel(88, player, hudManager, engine)
    const boneSpearBlvl = resolveBaseSkillLevel(84, player, hudManager, engine)
    const boneSpiritBlvl = resolveBaseSkillLevel(93, player, hudManager, engine)
    const synergies = { boneWall: boneWallBlvl, bonePrison: bonePrisonBlvl, boneSpear: boneSpearBlvl, boneSpirit: boneSpiritBlvl }
    const dmgRange = calculateTeethDamage(slvl, synergies)
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    missileType = 'teeth'
    multiCount = calculateTeethCount(slvl)
    spreadAngle = Math.min(1.2, 0.25 + multiCount * 0.04)
    nextDelay = 4
    skillName = '牙'
  } else if (skillId === 84) {
    const missile = getMissileTxtData('bonespear')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 960
    const slvl = resolveCastSkillLevel(84, player, hudManager, engine)
    const teethBlvl = resolveBaseSkillLevel(67, player, hudManager, engine)
    const boneWallBlvl = resolveBaseSkillLevel(78, player, hudManager, engine)
    const bonePrisonBlvl = resolveBaseSkillLevel(88, player, hudManager, engine)
    const boneSpiritBlvl = resolveBaseSkillLevel(93, player, hudManager, engine)
    const synergies = { teeth: teethBlvl, boneWall: boneWallBlvl, bonePrison: bonePrisonBlvl, boneSpirit: boneSpiritBlvl }
    const dmgRange = calculateBoneSpearDamage(slvl, synergies)
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    pierce = true
    missileType = 'bonespear'
    skillName = '骨矛'
  } else if (skillId === 93) {
    const missile = getMissileTxtData('bonespirit')
    speed = missile.speedPxPerSec || 300
    range = missile.distancePx || 1536
    const slvl = resolveCastSkillLevel(93, player, hudManager, engine)
    const teethBlvl = resolveBaseSkillLevel(67, player, hudManager, engine)
    const boneWallBlvl = resolveBaseSkillLevel(78, player, hudManager, engine)
    const boneSpearBlvl = resolveBaseSkillLevel(84, player, hudManager, engine)
    const bonePrisonBlvl = resolveBaseSkillLevel(88, player, hudManager, engine)
    const synergies = { teeth: teethBlvl, boneWall: boneWallBlvl, boneSpear: boneSpearBlvl, bonePrison: bonePrisonBlvl }
    const dmgRange = calculateBoneSpiritDamage(slvl, synergies)
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    homing = true
    missileType = 'bonespirit'
    skillName = '骨魂'
  } else if (skillId === 92) {
    const missile = getMissileTxtData('poisonnova')
    speed = missile.speedPxPerSec || 300
    range = missile.distancePx || 360
    const slvl = resolveCastSkillLevel(92, player, hudManager, engine)
    const poisonDaggerBlvl = resolveBaseSkillLevel(73, player, hudManager, engine)
    const poisonExplosionBlvl = resolveBaseSkillLevel(83, player, hudManager, engine)
    const synergies = { poisonDagger: poisonDaggerBlvl, poisonExplosion: poisonExplosionBlvl }
    const pnDmg = calculatePoisonNovaDamage(slvl, synergies)
    damage = Math.round((pnDmg.minDamage + pnDmg.maxDamage) / 2)
    delay = 0
    statusEffect = 'poison'
    statusDuration = pnDmg.durationFrames
    missileType = 'poisonnova'
    isNova = true
    multiCount = 64
    nextDelay = 4
    skillName = '剧毒新星'
  } else if (skillId === 48) {
    const missile = getMissileTxtData('nova')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 312
    const slvl = (hudManager as any)?.getSkillLevel?.(48) ?? castSlvl
    const dmgRange = calculateSkillDamage(48, slvl)
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    missileType = 'nova'
    isNova = true
    multiCount = 64
    skillName = '新星'
  } else if (skillId === 44) {
    const missile = getMissileTxtData('frostnova')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 336
    const slvl = Math.max(1, (hudManager as any)?.getSkillLevel?.(44) ?? castSlvl)
    const blizzardBlvl = (hudManager as any)?.getSkillLevel?.(59) ?? 0
    const frozenOrbBlvl = (hudManager as any)?.getSkillLevel?.(64) ?? 0
    const synergies = { blizzard: blizzardBlvl, frozenOrb: frozenOrbBlvl }
    const dmgRange = calculateFrostNovaDamage(slvl, synergies)
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    statusEffect = 'chill'
    statusDuration = calculateFrostNovaChillLength(slvl)
    missileType = 'frostnova'
    isNova = true
    multiCount = 64
    nextDelay = 4
    skillName = '霜之新星'
  } else if (skillId === 101) {
    const missile = getMissileTxtData('holybolt')
    speed = missile.speedPxPerSec || 500
    range = missile.distancePx || 1000
    const bhBlvl = resolveBaseSkillLevel(112, player, hudManager, engine)
    const fohBlvl = resolveBaseSkillLevel(121, player, hudManager, engine)
    const prayerBlvl = resolveBaseSkillLevel(99, player, hudManager, engine)
    const hbDmg = calculateHolyBoltDamage(castSlvl, { blessedHammer: bhBlvl, fistOfTheHeavens: fohBlvl })
    const hbHeal = calculateHolyBoltHeal(castSlvl, prayerBlvl)
    damage = Math.max(1, Math.round((hbDmg.min + hbDmg.max) / 2))
    delay = 0
    isUndeadOnly = true
    missileType = 'holybolt'
    skillName = '圣光弹'
    // Heal targeted friendly summon/ally near cursor (1.13c MISSMODE_SrvHit35_HolyBolt 0x6FD0A4B0)
    const summonsList: any[] = Array.isArray((player as any).summons)
      ? (player as any).summons
      : Array.isArray((engine.world as any).summons)
        ? (engine.world as any).summons
        : []
    const healAvg = Math.max(1, Math.round((hbHeal.min + hbHeal.max) / 2))
    for (const s of summonsList) {
      if (s && s.alive !== false && s.hp > 0 && Math.hypot((s.x ?? targetX) - targetX, (s.y ?? targetY) - targetY) <= 60) {
        const maxHp = s.maxHp ?? s.hp
        s.hp = Math.min(maxHp, s.hp + healAvg)
        break
      }
    }
  } else if (skillId === 112) {
    const missile = getMissileTxtData('blessedhammer')
    speed = missile.speedPxPerSec || 450
    range = missile.distancePx || 2160
    const blessedAimBlvl = resolveBaseSkillLevel(108, player, hudManager, engine)
    const vigorBlvl = resolveBaseSkillLevel(115, player, hudManager, engine)
    const isConcActive =
      engine.activeAuraSkillId === 113 ||
      (player as any)?.activeAuraSkillId === 113 ||
      (hudManager as any)?.rightSkill === 113
    const concSlvl =
      engine.activeAuraSkillId === 113 && engine.activeAuraLevel > 0
        ? engine.activeAuraLevel
        : resolveCastSkillLevel(113, player, hudManager, engine)
    const concEd = isConcActive ? calculateConcentrationStats(concSlvl).damagePercent : 0
    const bhDmg = calculateBlessedHammerDamage(castSlvl, { blessedAim: blessedAimBlvl, vigor: vigorBlvl }, concEd)
    damage = Math.max(1, Math.round((bhDmg.min + bhDmg.max) / 2))
    delay = 0
    pierce = true
    missileType = 'blessedhammer'
    const baseAngle = Math.atan2((targetY - player.y) / ISO_GROUND_ASPECT_RATIO, targetX - player.x)
    spiral = { originX: player.x, originY: player.y, angle: baseAngle, radius: 12 }
    skillName = '祝福之槌'
  } else if (skillId === 6) {
    const missile = getMissileTxtData('magicarrow')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 960
    const maStats = calculateMagicArrowStats(castSlvl)
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    damage = Math.max(1, baseWepDmg + Math.round((maStats.minDamage + maStats.maxDamage) / 2))
    delay = 0
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    missileType = 'magicarrow'
    skillName = '魔法箭'
  } else if (skillId === 7) {
    const missile = getMissileTxtData('firearrow')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 960
    const expArrowBlvl = resolveBaseSkillLevel(16, player, hudManager, engine)
    const faStats = calculateFireArrowStats(castSlvl, { explodingArrow: expArrowBlvl })
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    damage = Math.max(1, baseWepDmg + Math.round((faStats.minDamage + faStats.maxDamage) / 2))
    delay = 0
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    missileType = 'firearrow'
    skillName = '火箭'
  } else if (skillId === 11) {
    const missile = getMissileTxtData('coldarrow')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 960
    const iceArrowBlvl = resolveBaseSkillLevel(21, player, hudManager, engine)
    const caStats = calculateColdArrowStats(castSlvl, { iceArrow: iceArrowBlvl })
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    damage = Math.max(1, baseWepDmg + Math.round((caStats.minDamage + caStats.maxDamage) / 2))
    delay = 0
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    statusEffect = 'chill'
    statusDuration = caStats.durationFrames
    missileType = 'coldarrow'
    skillName = '冰箭'
  } else if (skillId === 21) {
    const missile = getMissileTxtData('icearrow')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 960
    const coldArrowBlvl = resolveBaseSkillLevel(11, player, hudManager, engine)
    const frzArrowBlvl = resolveBaseSkillLevel(31, player, hudManager, engine)
    const iaStats = calculateIceArrowStats(castSlvl, { coldArrow: coldArrowBlvl, freezingArrow: frzArrowBlvl })
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    damage = Math.max(1, baseWepDmg + Math.round((iaStats.minDamage + iaStats.maxDamage) / 2))
    delay = 0
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    statusEffect = 'freeze'
    statusDuration = iaStats.freezeFrames
    missileType = 'icearrow'
    skillName = '急冻箭'
  } else if (skillId === 12) {
    const isXBow = Boolean((player as any).isCrossbow || castWeaponInfo.subtype === 'crossbow')
    const mKey = isXBow ? 'multipleshotbolt' : 'multipleshotarrow'
    const missile = getMissileTxtData(mKey) ?? getMissileTxtData('arrow')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 960
    const msStats = calculateMultipleShotStats(castSlvl)
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    damage = Math.max(1, Math.floor((baseWepDmg * msStats.srcDam) / 128))
    delay = 0
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    missileType = mKey
    multiCount = msStats.arrowCount
    spreadAngle = 0.50
    nextHit = 1
    nextDelay = 4
    skillName = '多重箭'
  } else if (skillId === 16) {
    const missile = getMissileTxtData('explodingarrow')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 960
    const fireArrowBlvl = resolveBaseSkillLevel(7, player, hudManager, engine)
    const eaStats = calculateExplodingArrowStats(castSlvl, { fireArrow: fireArrowBlvl })
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    aoeDamage = Math.max(1, Math.round((eaStats.minBlastDamage + eaStats.maxBlastDamage) / 2))
    damage = Math.max(1, baseWepDmg + aoeDamage)
    delay = 0
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    aoeRadius = eaStats.radiusPx
    missileType = 'explodingarrow'
    skillName = '爆裂箭'
  } else if (skillId === 15) {
    const missile = getMissileTxtData('poisonjav')
    speed = missile.speedPxPerSec || 400
    range = missile.distancePx || 640
    const plagueBlvl = resolveBaseSkillLevel(25, player, hudManager, engine)
    const pjStats = calculatePoisonJavelinStats(castSlvl, { plagueJavelin: plagueBlvl })
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    const poisonAvg = Math.round((pjStats.minDamage + pjStats.maxDamage) / 2)
    damage = Math.max(1, baseWepDmg + poisonAvg)
    delay = pjStats.cooldownFrames
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    statusEffect = 'poison'
    statusDuration = pjStats.durationFrames
    residualDamage = Math.max(1, Math.round(poisonAvg / Math.max(1, pjStats.durationSeconds)))
    missileType = 'poisonjav'
    skillName = '毒枪'
  } else if (skillId === 20) {
    const missile = getMissileTxtData('lightningjavelin')
    speed = missile.speedPxPerSec || 750
    range = missile.distancePx || 750
    const lbStats = calculateLightningBoltStats(castSlvl, {
      powerStrike: resolveBaseSkillLevel(14, player, hudManager, engine),
      chargedStrike: resolveBaseSkillLevel(24, player, hudManager, engine),
      lightningStrike: resolveBaseSkillLevel(34, player, hudManager, engine),
      lightningFury: resolveBaseSkillLevel(35, player, hudManager, engine),
    })
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    const convertedWep = Math.floor((baseWepDmg * lbStats.srcDam) / 128)
    const ltngAvg = Math.round((lbStats.minDamage + lbStats.maxDamage) / 2)
    damage = Math.max(1, convertedWep + ltngAvg)
    delay = 0
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    missileType = 'lightningjavelin'
    skillName = '闪电之枪'
  } else if (skillId === 22) {
    const missile = getMissileTxtData('guidedarrow')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 3072
    const gaStats = calculateGuidedArrowStats(castSlvl)
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo)
    const physDmg = Math.max(1, Math.floor((baseWepDmg * (100 + gaStats.enhancedDamagePct)) / 100))
    damage = physDmg * amaCritMult
    delay = 0
    homing = true
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    missileType = 'guidedarrow'
    skillName = '导引箭'
  } else if (skillId === 24) {
    const missile = getMissileTxtData('chargedstrikebolt')
    speed = missile.speedPxPerSec || 300
    range = missile.distancePx || 1176
    const csStats = calculateChargedStrikeStats(castSlvl, {
      powerStrike: resolveBaseSkillLevel(14, player, hudManager, engine),
      lightningBolt: resolveBaseSkillLevel(20, player, hudManager, engine),
      lightningStrike: resolveBaseSkillLevel(34, player, hudManager, engine),
      lightningFury: resolveBaseSkillLevel(35, player, hudManager, engine),
    })
    const boltAvg = Math.max(1, Math.round((csStats.minDamage + csStats.maxDamage) / 2))
    // Primary melee strike on closest living monster within melee reach
    const meleeReach = Math.max(60, castWeaponInfo.reach || 60)
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    let bestTarget: any = null
    let bestDist = Infinity
    for (let i = 0; i < engine.world.monsters.length; i++) {
      const m = engine.world.monsters[i]!
      if (m.state === 'dead' || m.hp <= 0) continue
      const dist = Math.hypot(m.x - player.x, m.y - player.y)
      if (dist <= meleeReach && dist < bestDist) {
        bestDist = dist
        bestTarget = { monster: m, index: i }
      }
    }
    if (bestTarget) {
      damageMonster(engine.world, bestTarget.index, baseWepDmg + boltAvg)
      engine.metrics.playerHits += 1
      engine.spawnOverlay('lightning', { x: bestTarget.monster.x, y: bestTarget.monster.y })
    }
    damage = boltAvg
    delay = 0
    missileType = 'chargedstrikebolt'
    multiCount = csStats.boltsCount
    spreadAngle = 0.55
    jitter = true
    nextHit = undefined
    nextDelay = 0
    skillName = '充能一击'
  } else if (skillId === 25) {
    const missile = getMissileTxtData('plaguejavelin')
    speed = missile.speedPxPerSec || 400
    range = missile.distancePx || 360
    const poisonBlvl = resolveBaseSkillLevel(15, player, hudManager, engine)
    const plgStats = calculatePlagueJavelinStats(castSlvl, { poisonJavelin: poisonBlvl })
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    const poisonAvg = Math.round((plgStats.minDamage + plgStats.maxDamage) / 2)
    damage = Math.max(1, baseWepDmg + poisonAvg)
    delay = plgStats.cooldownFrames
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    statusEffect = 'poison'
    statusDuration = plgStats.durationFrames
    aoeRadius = 120
    aoeDamage = poisonAvg
    residualDamage = Math.max(1, Math.round(poisonAvg / Math.max(1, plgStats.durationSeconds)))
    missileType = 'plaguejavelin'
    skillName = '瘟疫标枪'
  } else if (skillId === 26) {
    const isXBow = Boolean((player as any).isCrossbow || castWeaponInfo.subtype === 'crossbow')
    const mKey = isXBow ? 'strafebolt' : 'strafearrow'
    const missile = getMissileTxtData(mKey) ?? getMissileTxtData('strafearrow')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 960
    const stStats = calculateStrafeStats(castSlvl)
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo)
    const strafePhys = Math.floor((baseWepDmg * stStats.srcDam) / 128)
    damage = Math.max(1, Math.floor((strafePhys * (100 + stStats.enhancedDamagePct)) / 100)) * amaCritMult
    delay = 0
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    missileType = mKey
    const nearbyMonsters = engine.world.monsters.filter(
      m => m.state !== 'dead' && m.hp > 0 && Math.hypot(m.x - player.x, m.y - player.y) <= 35 * 20,
    )
    if (nearbyMonsters.length > 0) {
      multiCount = Math.min(stStats.arrowCount, Math.max(stStats.minArrows, nearbyMonsters.length))
      customTargetAngles = []
      for (let i = 0; i < multiCount; i++) {
        const tgt = nearbyMonsters[i % nearbyMonsters.length]!
        customTargetAngles.push(Math.atan2(tgt.y - player.y, tgt.x - player.x))
      }
    } else {
      multiCount = stStats.arrowCount
    }
    spreadAngle = 0.35
    nextHit = 1
    nextDelay = 4
    skillName = '炮轰'
  } else if (skillId === 27) {
    const missile = getMissileTxtData('immolationarrow')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 960
    const expArrowBlvl = resolveBaseSkillLevel(16, player, hudManager, engine)
    const fireArrowBlvl = resolveBaseSkillLevel(7, player, hudManager, engine)
    const immStats = calculateImmolationArrowStats(castSlvl, { explodingArrow: expArrowBlvl, fireArrow: fireArrowBlvl })
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    aoeDamage = Math.max(1, Math.round((immStats.minExplosionDamage + immStats.maxExplosionDamage) / 2))
    damage = Math.max(1, baseWepDmg + aoeDamage)
    delay = immStats.cooldownFrames
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    aoeRadius = 80
    fireDuration = immStats.firePatchDurationFrames
    residualDamage = Math.max(1, Math.round((immStats.firePatchMinDamagePerSec + immStats.firePatchMaxDamagePerSec) / 2 / 5))
    missileType = 'immolationarrow'
    skillName = '祭奠之箭'
  } else if (skillId === 31) {
    const missile = getMissileTxtData('freezingarrow')
    speed = missile.speedPxPerSec || 600
    range = missile.distancePx || 960
    const coldArrowBlvl = resolveBaseSkillLevel(11, player, hudManager, engine)
    const iceArrowBlvl = resolveBaseSkillLevel(21, player, hudManager, engine)
    const frzStats = calculateFreezingArrowStats(castSlvl, { coldArrow: coldArrowBlvl, iceArrow: iceArrowBlvl })
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    aoeDamage = Math.max(1, Math.round((frzStats.minColdDamage + frzStats.maxColdDamage) / 2))
    damage = Math.max(1, baseWepDmg + aoeDamage)
    delay = 0
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    statusEffect = 'freeze'
    statusDuration = frzStats.freezeFrames
    aoeRadius = frzStats.radiusPx
    missileType = 'freezingarrow'
    skillName = '冻结箭'
  } else if (skillId === 34) {
    const missile = getMissileTxtData('lightningstrike')
    speed = missile.speedPxPerSec || 750
    range = missile.distancePx || 750
    const lsStats = calculateLightningStrikeStats(castSlvl, {
      powerStrike: resolveBaseSkillLevel(14, player, hudManager, engine),
      lightningBolt: resolveBaseSkillLevel(20, player, hudManager, engine),
      chargedStrike: resolveBaseSkillLevel(24, player, hudManager, engine),
      lightningFury: resolveBaseSkillLevel(35, player, hudManager, engine),
    })
    const ltngAvg = Math.max(1, Math.round((lsStats.minDamage + lsStats.maxDamage) / 2))
    // Primary melee strike on closest living monster within melee reach
    const meleeReach = Math.max(60, castWeaponInfo.reach || 60)
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    let bestTarget: any = null
    let bestDist = Infinity
    for (let i = 0; i < engine.world.monsters.length; i++) {
      const m = engine.world.monsters[i]!
      if (m.state === 'dead' || m.hp <= 0) continue
      const dist = Math.hypot(m.x - player.x, m.y - player.y)
      if (dist <= meleeReach && dist < bestDist) {
        bestDist = dist
        bestTarget = { monster: m, index: i }
      }
    }
    if (bestTarget) {
      damageMonster(engine.world, bestTarget.index, baseWepDmg)
      engine.metrics.playerHits += 1
      engine.spawnOverlay('lightning', { x: bestTarget.monster.x, y: bestTarget.monster.y })
    }
    damage = ltngAvg
    delay = 0
    missileType = 'lightningstrike'
    chainRemaining = lsStats.chainHops
    aoeRadius = lsStats.searchRadiusSubtiles * 20
    nextHit = 1
    nextDelay = 4
    skillName = '闪电攻击'
  } else if (skillId === 35) {
    const missile = getMissileTxtData('lightningfury')
    speed = missile.speedPxPerSec || 750
    range = missile.distancePx || 750
    const lfStats = calculateLightningFuryStats(castSlvl, {
      powerStrike: resolveBaseSkillLevel(14, player, hudManager, engine),
      lightningBolt: resolveBaseSkillLevel(20, player, hudManager, engine),
      chargedStrike: resolveBaseSkillLevel(24, player, hudManager, engine),
      lightningStrike: resolveBaseSkillLevel(34, player, hudManager, engine),
    })
    const baseWepDmg = computeCastSkillDamage(0, 1, castWeaponInfo) * amaCritMult
    const boltAvg = Math.max(1, Math.round((lfStats.minDamage + lfStats.maxDamage) / 2))
    damage = Math.max(1, baseWepDmg + boltAvg)
    aoeDamage = boltAvg
    aoeRadius = lfStats.searchRadiusSubtiles * 20
    delay = 0
    pierce = hasAmaPierce
    if (hasAmaPierce) {
      pierceChancePct = amaPierceChancePct
      maxPierceCount = 4
    }
    missileType = 'lightningfury'
    multiCount = 1
    skillName = '闪电之怒'
  } else if (skillId === 41) {
    const missile = getMissileTxtData('infernoflame1')
    speed = missile.speedPxPerSec || 400
    range = missile.distancePx || 400
    damage = computeCastSkillDamage(41, castSlvl, castWeaponInfo)
    delay = 0
    missileType = 'infernoflame1'
    skillName = '地狱火'
  } else if (skillId === 64) {
    const missile = getMissileTxtData('frozenorb')
    speed = missile.speedPxPerSec || 250
    range = missile.distancePx || 300
    damage = computeCastSkillDamage(64, castSlvl, castWeaponInfo)
    delay = 25
    pierce = true
    statusEffect = 'chill'
    statusDuration = 100
    missileType = 'frozenorb'
    skillName = '冰封球'
  } else if (skillId === 49) {
    const missile = getMissileTxtData('lightningbolt')
    speed = missile.speedPxPerSec || 750
    range = missile.distancePx || 750
    const slvl = (hudManager as any)?.getSkillLevel?.(49) ?? castSlvl
    const dmgRange = calculateSkillDamage(49, slvl)
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    pierce = true
    missileType = 'lightningbolt'
    skillName = '闪电'
  } else if (skillId === 53) {
    const missile = getMissileTxtData('chainlightning')
    speed = missile.speedPxPerSec || 750
    range = missile.distancePx || 750
    const slvl = (hudManager as any)?.getSkillLevel?.(53) ?? castSlvl
    const dmgRange = calculateSkillDamage(53, slvl)
    damage = Math.round((dmgRange.min + dmgRange.max) / 2)
    delay = 0
    missileType = 'chainlightning'
    chainRemaining = calculateChainLightningJumps(slvl)
    nextHit = 1
    nextDelay = 4
    skillName = '连锁闪电'
  } else if (skillId === 121) {
    const slvl = Math.max(1, resolveCastSkillLevel(121, player, hudManager, engine))
    const holyShockBlvl = resolveBaseSkillLevel(118, player, hudManager, engine)
    const holyBoltBlvl = resolveBaseSkillLevel(101, player, hudManager, engine)
    const fohDmg = calculateFistOfTheHeavensDamage(slvl, { holyShock: holyShockBlvl })
    const fohBoltDmg = calculateFistOfTheHeavensHolyBoltDamage(slvl, holyBoltBlvl)
    const ltngAvg = Math.max(1, Math.round((fohDmg.lightningMin + fohDmg.lightningMax) / 2))
    const boltAvg = Math.max(1, Math.round((fohBoltDmg.holyBoltMin + fohBoltDmg.holyBoltMax) / 2))

    // Primary skyfall Lightning strike on target at (targetX, targetY) — affects ALL monster types (not undead-only)
    let primaryTarget: Monster | null = null
    let bestTargetDist = 80
    for (const m of engine.world.monsters) {
      if (m.state === 'dead' || m.hp <= 0) continue
      const d = Math.hypot(m.x - targetX, m.y - targetY)
      if (d <= bestTargetDist) {
        bestTargetDist = d
        primaryTarget = m
      }
    }
    const strikeX = primaryTarget ? primaryTarget.x : targetX
    const strikeY = primaryTarget ? primaryTarget.y : targetY
    engine.spawnOverlay('handofgod', { x: strikeX, y: strikeY })
    if (primaryTarget !== null) {
      damageMonster(engine.world, primaryTarget.index, ltngAvg)
      engine.metrics.castHits += 1
    }

    // Spawn radial fistoftheheavensbolt (#234) from impact position toward other enemies within 20 subtiles (400 px)
    const boltMissile = getMissileTxtData('fistoftheheavensbolt') ?? getMissileTxtData('holybolt')
    const boltSpeed = boltMissile.speedPxPerSec || 400
    const boltRange = boltMissile.distancePx || 640
    const boltStep = boltSpeed / 25
    const boltTtl = Math.max(1, Math.round(boltRange / boltStep))
    const nearbyEnemies = engine.world.monsters.filter(
      m =>
        m.state !== 'dead' &&
        m.hp > 0 &&
        (primaryTarget === null || m.index !== primaryTarget.index) &&
        Math.hypot(m.x - strikeX, m.y - strikeY) <= 400,
    )
    if (nearbyEnemies.length > 0) {
      for (const m of nearbyEnemies) {
        const ang = Math.atan2(m.y - strikeY, m.x - strikeX)
        engine.projectiles.push({
          skillId: '121',
          slvl,
          x: strikeX,
          y: strikeY,
          vx: Math.cos(ang) * boltStep,
          vy: Math.sin(ang) * boltStep,
          damage: boltAvg,
          ttl: boltTtl,
          fromPlayer: true,
          missileType: 'fistoftheheavensbolt',
          isUndeadOnly: true,
        })
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2
        engine.projectiles.push({
          skillId: '121',
          slvl,
          x: strikeX,
          y: strikeY,
          vx: Math.cos(ang) * boltStep,
          vy: Math.sin(ang) * boltStep,
          damage: boltAvg,
          ttl: boltTtl,
          fromPlayer: true,
          missileType: 'fistoftheheavensbolt',
          isUndeadOnly: true,
        })
      }
    }

    damage = primaryTarget === null ? ltngAvg : 0
    speed = 0
    range = 40
    delay = 25
    skillName = '天堂之拳'
    missileType = 'fistoftheheavensdelay'
    multiCount = 1
    isUndeadOnly = false
  } else if (skillId === 131 || skillId === 142 || skillId === 150) {
    // 1.13c Barbarian Corpse Warcries: Find Potion (#131), Find Item (#142), Grim Ward (#150)
    const corpse = prevalidatedBarbCorpse!
    ;(corpse as any).corpseConsumed = true
    ;(corpse as any).noSelect = true
    corpse.corpseTicks = 0
    if (!(corpse as any).states) (corpse as any).states = new Set<number>()
    ;(corpse as any).states.add(118)
    ;(corpse as any).corpseStateId = skillId === 150 ? 104 : 118
    if (skillId === 150) {
      ;(corpse as any).noDraw = true
      ;(corpse as any).states.add(104)
      const gwStats = calculateGrimWardStats(castSlvl, (engine as any)?.difficulty ?? 0)
      const corpseSize = (corpse as any).sizeX ?? (corpse.stats as any)?.sizeX ?? 2
      const startMissile =
        corpseSize === 1 ? 'grimwardsmallstart' : corpseSize === 3 ? 'grimwardlargestart' : 'grimwardmediumstart'
      const totemMissile =
        corpseSize === 1 ? 'grimwardsmall' : corpseSize === 3 ? 'grimwardlarge' : 'grimwardmedium'
      engine.explosions.push(
        { missileType: 'corpseexplosion', x: corpse.x, y: corpse.y, frame: 0, maxFrames: 18 },
        { missileType: startMissile, x: corpse.x, y: corpse.y, frame: 0, maxFrames: 20 },
        { missileType: totemMissile, x: corpse.x, y: corpse.y, frame: 0, maxFrames: gwStats.totemDurationFrames }
      )
      const gwRadiusPx = gwStats.fleeRadiusSubtiles * (40 * (2 / 3))
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        if (!canMonsterTargetBeCursed113c(m as never)) continue
        const isBossOrChamp = Boolean(
          (m.stats as any)?.isBoss ||
          (m.stats as any)?.type === 'boss' ||
          m.stats?.rank === 'champion' ||
          m.stats?.rank === 'unique' ||
          (m as any).isBoss ||
          (m as any).isChampion ||
          (m as any).isUnique ||
          (m as any).isSuperUnique
        )
        if (isBossOrChamp) continue
        if (Math.hypot(m.x - corpse.x, (m.y - corpse.y) / ISO_GROUND_ASPECT_RATIO) <= gwRadiusPx) {
          m.curse = {
            name: 'terror',
            slvl: castSlvl,
            curseType: 1,
            ticksRemaining: gwStats.fleeDurationFrames,
            overlayName: 'curseterror',
            casterX: corpse.x,
            casterY: corpse.y,
          }
          ;(m as any).fleeTicks = gwStats.fleeDurationFrames
        }
      }
      skillName = '残酷吓阻'
    } else if (skillId === 131) {
      const roll = ((Math.floor(engine.world.tick ?? 0) * 37 + 131) % 100 + 100) % 100
      const typeRoll = ((Math.floor(engine.world.tick ?? 0) * 53 + 17) % 100 + 100) % 100
      const actNum = Math.max(0, ((engine as any)?.act ?? 1) - 1)
      const diffNum = (engine as any)?.difficulty ?? 0
      const dropRes = rollFindPotionDrop113c(castSlvl, actNum, diffNum, roll, typeRoll)
      ;(corpse as any).lastFindPotionResult = dropRes
      if (dropRes.dropped && dropRes.potionCode) {
        engine.world.events.push({
          kind: 'findPotionDrop',
          x: corpse.x,
          y: corpse.y,
          itemCode: dropRes.potionCode,
        } as any)
      }
      skillName = '寻找药剂'
    } else {
      const fiStats = calculateFindItemStats(castSlvl)
      const roll = ((Math.floor(engine.world.tick ?? 0) * 41 + 142) % 100 + 100) % 100
      const dropped = roll < fiStats.dropChancePct
      ;(corpse as any).lastFindItemResult = { dropped, dropChancePct: fiStats.dropChancePct, noDropZero: true }
      if (dropped) {
        engine.world.events.push({
          kind: 'findItemDrop',
          x: corpse.x,
          y: corpse.y,
          noDropZero: true,
        } as any)
      }
      skillName = '寻找物品'
    }
    player.cooldown = 0
    engine.metrics.casts += 1
    const displayCorpseSkillName = isEn ? getSkillDisplayName(skillId, 'ENG') : skillName
    status.textContent = isEn ? `Cast skill: ${displayCorpseSkillName}` : `施展技能：${skillName}`
    return true
  } else if (skillId === 137) {
    // 1.13c Taunt (#137): Single-target curse forcing monster into walk_melee toward caster with -AR% and -Dmg%
    const tStats = calculateTauntStats(castSlvl)
    const targetMon = prevalidatedTauntTarget!
    const debuffVal = -tStats.targetAttackRatingReductionPct
    targetMon.curse = {
      name: 'taunt',
      slvl: castSlvl,
      curseType: 1,
      ticksRemaining: 0, // permanent until overwritten
      overlayName: 'taunt',
      casterX: player.x,
      casterY: player.y,
    }
    ;(targetMon as any).tauntArPenaltyPct = debuffVal
    ;(targetMon as any).tauntDamagePenaltyPct = debuffVal
    ;(targetMon as any).aiMode = 'walk_melee'
    ;(targetMon as any).forcedTargetId = 'player'
    engine.spawnOverlay('taunt', { x: targetMon.x, y: targetMon.y }, `monster-${targetMon.index}`, { loop: true })
    player.cooldown = 0
    engine.metrics.casts += 1
    skillName = '嘲弄'
    const displayTauntName = isEn ? getSkillDisplayName(137, 'ENG') : skillName
    status.textContent = isEn ? `Cast skill: ${displayTauntName}` : `施展技能：${skillName}`
    return true
  } else if (skillId === 130 || skillId === 138 || skillId === 146 || skillId === 149 || skillId === 155) {
    const boBlvl = resolveBaseSkillLevel(149, player, hudManager, engine)
    const bcBlvl = resolveBaseSkillLevel(155, player, hudManager, engine)
    const shoutBlvl = resolveBaseSkillLevel(138, player, hudManager, engine)
    const diff = (engine as any)?.difficulty ?? 0
    delay = 0
    damage = 0
    isNova = true
    // SrvDo068 / SrvDo022 -> sub_6FD14170 (D2Game 0x6FD14170): 64 missiles on the radius-30 table.
    multiCount = 64
    if (skillId === 130) {
      const howlStats = calculateHowlStats(castSlvl, diff)
      speed = howlStats.missileVel * 25
      range = howlStats.missileRangeFrames * howlStats.missileVel
      missileType = 'howl'
      skillName = '嚎叫'
      const radiusPx = howlStats.radiusSubtiles * (40 * (2 / 3))
      const casterClvl = Number((player as any).level ?? (hudManager as any)?.level ?? 99)
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        if (!canMonsterTargetBeCursed113c(m as never)) continue
        const isBossOrChamp = Boolean(
          (m.stats as any)?.isBoss ||
          (m.stats as any)?.type === 'boss' ||
          m.stats?.rank === 'champion' ||
          m.stats?.rank === 'unique' ||
          (m as any).isBoss ||
          (m as any).isChampion ||
          (m as any).isUnique ||
          (m as any).isSuperUnique
        )
        if (isBossOrChamp || !canMonsterTargetBeCursed113c(m as never)) continue
        const mLvl = Number((m.stats as any)?.level ?? (m as any).level ?? 1)
        if (casterClvl + castSlvl + 1 <= mLvl) continue
        if (Math.hypot(m.x - player.x, (m.y - player.y) / ISO_GROUND_ASPECT_RATIO) <= radiusPx) {
          m.curse = {
            name: 'terror',
            slvl: castSlvl,
            curseType: 1,
            ticksRemaining: howlStats.fleeDurationFrames,
            overlayName: 'curseterror',
            casterX: player.x,
            casterY: player.y,
          }
          ;(m as any).fleeTicks = howlStats.fleeDurationFrames
          ;(m as any).fleeRangeSubtiles = howlStats.fleeRangeSubtiles
        }
      }
    } else if (skillId === 138) {
      const sStats = calculateShoutStats(castSlvl, boBlvl, bcBlvl)
      speed = getMissileTxtData('shout').speedPxPerSec
      range = getMissileTxtData('shout').distancePx
      missileType = 'shout'
      skillName = '大吼'
      const curShoutSlvl = Number((player as any).shoutSlvl ?? 0)
      const curShoutTicks = Number((player as any).shoutTicks ?? 0)
      if (castSlvl >= curShoutSlvl || curShoutTicks <= 0) {
        ;(player as any).shoutSlvl = castSlvl
        ;(player as any).shoutDefensePct = sStats.defenseBonusPct
        ;(player as any).shoutTicks = sStats.durationFrames
      }
      engine.spawnOverlay('shoutstart', { x: player.x, y: player.y }, 'player', { isCastOverlay: true })
    } else if (skillId === 146) {
      const bcStats = calculateBattleCryStats(castSlvl, diff)
      speed = getMissileTxtData('battlecry').speedPxPerSec
      range = getMissileTxtData('battlecry').distancePx
      missileType = 'battlecry'
      skillName = '战嗥'
      const radiusPx = Math.max(160, bcStats.radiusSubtiles * (40 * (2 / 3)))
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        if (!canMonsterTargetBeCursed113c(m as never)) continue
        if (Math.hypot(m.x - player.x, (m.y - player.y) / ISO_GROUND_ASPECT_RATIO) <= radiusPx) {
          m.curse = {
            name: 'battlecry',
            slvl: castSlvl,
            curseType: 1,
            ticksRemaining: bcStats.durationFrames,
            overlayName: 'battlecry',
            casterX: player.x,
            casterY: player.y,
          }
          ;(m as any).battleCryDefPenaltyPct = -bcStats.targetDefenseReductionPct
          ;(m as any).battleCryDmgPenaltyPct = -bcStats.targetDamageReductionPct
        }
      }
    } else if (skillId === 149) {
      const boStats = calculateBattleOrdersStats(castSlvl, shoutBlvl, bcBlvl)
      speed = getMissileTxtData('battleorders').speedPxPerSec
      range = getMissileTxtData('battleorders').distancePx
      missileType = 'battleorders'
      skillName = '战斗体制'
      const curBoSlvl = Number((player as any).battleOrdersSlvl ?? 0)
      const curBoTicks = Number((player as any).battleOrdersTicks ?? 0)
      if (castSlvl >= curBoSlvl || curBoTicks <= 0) {
        ;(player as any).battleOrdersSlvl = castSlvl
        ;(player as any).battleOrdersBonusPct = boStats.maxLifeBonusPct
        ;(player as any).battleOrdersTicks = boStats.durationFrames
      }
      engine.spawnOverlay('battleorderscast', { x: player.x, y: player.y }, 'player', { isCastOverlay: true })
    } else {
      const cmdStats = calculateBattleCommandStats(castSlvl, shoutBlvl, boBlvl)
      speed = getMissileTxtData('battlecommand').speedPxPerSec
      range = getMissileTxtData('battlecommand').distancePx
      missileType = 'battlecommand'
      skillName = '战斗指挥'
      const curCmdSlvl = Number((player as any).battleCommandSlvl ?? 0)
      const curCmdTicks = Number((player as any).battleCommandTicks ?? 0)
      if (castSlvl >= curCmdSlvl || curCmdTicks <= 0) {
        ;(player as any).battleCommandSlvl = castSlvl
        ;(player as any).battleCommandBonus = cmdStats.allSkillsBonus
        ;(player as any).battleCommandTicks = cmdStats.durationFrames
      }
      engine.spawnOverlay('battlecommandcast', { x: player.x, y: player.y }, 'player', { isCastOverlay: true })
    }
  } else if (skillId === 154) {
    const howlBlvl = resolveBaseSkillLevel(130, player, hudManager, engine)
    const tauntBlvl = resolveBaseSkillLevel(137, player, hudManager, engine)
    const bcBlvl = resolveBaseSkillLevel(146, player, hudManager, engine)
    const wcStats = calculateWarCryStats(castSlvl, howlBlvl, tauntBlvl, bcBlvl)
    speed = getMissileTxtData('warcry').speedPxPerSec
    range = getMissileTxtData('warcry').distancePx
    damage = Math.floor((wcStats.minPhysicalDamage + wcStats.maxPhysicalDamage) / 2)
    delay = 0
    missileType = 'warcry'
    isNova = true
    multiCount = 64
    skillName = '战争狂嗥'
    const radiusPx = Math.max(160, wcStats.radiusSubtiles * (40 * (2 / 3)))
    for (const m of engine.world.monsters) {
      if (m.state === 'dead' || m.hp <= 0) continue
      if (Math.hypot(m.x - player.x, (m.y - player.y) / ISO_GROUND_ASPECT_RATIO) <= radiusPx) {
        const isBossOrChamp = Boolean(
          (m.stats as any)?.isBoss ||
          (m.stats as any)?.type === 'boss' ||
          m.stats?.rank === 'champion' ||
          m.stats?.rank === 'unique' ||
          (m as any).isBoss ||
          (m as any).isChampion ||
          (m as any).isUnique ||
          (m as any).isSuperUnique
        )
        if (!isBossOrChamp) {
          ;(m as any).stunTicks = wcStats.stunDurationFrames
        }
      }
    }
  } else if (skillId === 140) {
    speed = 600
    range = 600
    const baseThrowDmg = computeCastSkillDamage(140, castSlvl, castWeaponInfo)
    const dsBlvl = resolveBaseSkillLevel(133, player, hudManager, engine)
    const tmSlvl = resolveLearnedEffectiveSkillLevel(135, player, hudManager, engine)
    const tmStats = tmSlvl > 0 ? calculateThrowingMasteryStats(tmSlvl) : null
    const totalEdPct = dsBlvl * 8 + (tmStats ? tmStats.damageBonusPct : 0)
    const tmCritProc =
      tmStats !== null &&
      (Boolean((player as any).criticalStrikeProc) ||
        (typeof (player as any).criticalStrikeRoll === 'number' &&
          Number((player as any).criticalStrikeRoll) < tmStats.criticalStrikeChancePct))
    const dsPct = Number((player as any).deadlyStrikePct ?? 0)
    const dsProc =
      !tmCritProc &&
      (Boolean((player as any).deadlyStrikeProc) ||
        (typeof (player as any).deadlyStrikeRoll === 'number' &&
          Number((player as any).deadlyStrikeRoll) < dsPct))
    const throwCritMult = tmCritProc || dsProc ? 2 : 1
    damage = Math.max(1, Math.floor((baseThrowDmg * (100 + totalEdPct)) / 100)) * throwCritMult
    delay = 10
    const wCode = typeof (castWeapon as any)?.code === 'string' ? (castWeapon as any).code : undefined
    const wTypeKey = String((castWeapon as any)?.type ?? (castWeapon as any)?.itemType ?? '').toLowerCase()
    const wTypeDefaultCode =
      wTypeKey === 'tkni' ? 'tkf' : wTypeKey === 'taxe' ? 'tax' : wTypeKey === 'jave' || wTypeKey === 'ajav' ? 'jav' : undefined
    missileType =
      (wCode ? resolveThrowMissileForItemCode(wCode) : undefined) ??
      (wTypeDefaultCode ? resolveThrowMissileForItemCode(wTypeDefaultCode) : undefined) ??
      (castWeaponInfo.subtype === 'axe'
        ? 'throwaxe'
        : castWeaponInfo.subtype === 'dagger'
          ? 'throwknife'
          : 'javelin')
    multiCount = 2
    spreadAngle = 0.2
    skillName = '双手投掷'
  } else if (skillId === 225) {
    const mbBlvl = resolveBaseSkillLevel(229, player, hudManager, engine)
    const fisBlvl = resolveBaseSkillLevel(234, player, hudManager, engine)
    const synMult = 1 + ((mbBlvl + fisBlvl) * 23) / 100
    speed = 400
    range = 512
    damage = Math.max(1, Math.round(computeCastSkillDamage(225, castSlvl, castWeaponInfo) * synMult))
    delay = 15
    missileType = 'firestormmaker'
    multiCount = 3
    spreadAngle = 0.5
    pierce = true
    nextHit = 1
    nextDelay = 4
    skillName = '火风暴'
  } else if (skillId === 229) {
    const fsBlvl = resolveBaseSkillLevel(225, player, hudManager, engine)
    const volBlvl = resolveBaseSkillLevel(244, player, hudManager, engine)
    const synMult = 1 + (volBlvl * 10 + fsBlvl * 8) / 200
    speed = 200
    range = 600
    damage = Math.max(1, Math.round(computeCastSkillDamage(229, castSlvl, castWeaponInfo) * synMult))
    delay = 50
    missileType = 'moltenboulder'
    pierce = true
    aoeRadius = 80
    fireDuration = 125
    residualDamage = Math.max(1, Math.round(damage / 5))
    nextHit = 1
    nextDelay = 25
    skillName = '熔岩巨石'
  } else if (skillId === 230) {
    const caBlvl = resolveBaseSkillLevel(235, player, hudManager, engine)
    const hurBlvl = resolveBaseSkillLevel(250, player, hudManager, engine)
    const synMult = 1 + ((caBlvl + hurBlvl) * 15) / 100
    const rangeSubtiles = 12 + Math.floor(((33 - 12) * Math.floor((110 * castSlvl) / (castSlvl + 6))) / 100)
    speed = 400
    range = rangeSubtiles * 20
    damage = Math.max(1, Math.round(computeCastSkillDamage(230, castSlvl, castWeaponInfo) * synMult))
    delay = 0
    statusEffect = 'chill'
    statusDuration = 100 + (castSlvl - 1) * 15
    missileType = 'arcticblast1'
    pierce = true
    nextHit = 1
    nextDelay = 4
    skillName = '极地风暴'
  } else if (skillId === 234) {
    const fsBlvl = resolveBaseSkillLevel(225, player, hudManager, engine)
    const volBlvl = resolveBaseSkillLevel(244, player, hudManager, engine)
    const synMult = 1 + ((fsBlvl + volBlvl) * 12) / 100
    speed = 0
    range = 80
    damage = Math.max(1, Math.round(computeCastSkillDamage(234, castSlvl, castWeaponInfo) * synMult))
    delay = 50
    missileType = 'erruption center'
    aoeRadius = 60
    nextHit = 1
    nextDelay = 5
    skillName = '火山爆'
  } else if (skillId === 240) {
    const torBlvl = resolveBaseSkillLevel(245, player, hudManager, engine)
    const hurBlvl = resolveBaseSkillLevel(250, player, hudManager, engine)
    const synMult = 1 + ((torBlvl + hurBlvl) * 10) / 100
    speed = 475
    range = 475
    damage = Math.max(1, Math.round(computeCastSkillDamage(240, castSlvl, castWeaponInfo) * synMult))
    delay = 0
    missileType = 'twister'
    multiCount = 3
    spreadAngle = 0.6
    pierce = true
    nextHit = 1
    nextDelay = 25
    skillName = '小旋风'
  } else if (skillId === 243) {
    const maulBlvl = resolveBaseSkillLevel(233, player, hudManager, engine)
    const swStats = calculateShockWaveStats(castSlvl, maulBlvl)
    speed = 450
    range = 450
    damage = Math.max(1, Math.round((swStats.minPhysicalDamage + swStats.maxPhysicalDamage) / 2))
    delay = 0
    missileType = 'shockwave'
    multiCount = 5
    spreadAngle = 0.8
    pierce = true
    nextHit = 1
    nextDelay = 4
    // 1.13c Shock Wave: stuns non-boss enemies in the cone for min(250, 40 + 15*(slvl-1)) frames
    const aimAngle = Math.atan2(targetY - player.y, targetX - player.x)
    for (const en of engine.world.monsters) {
      if (en.state === 'dead' || en.hp <= 0) continue
      const d = Math.hypot(en.x - player.x, en.y - player.y)
      if (d <= range) {
        const angleDiff = Math.abs(Math.atan2(Math.sin(Math.atan2(en.y - player.y, en.x - player.x) - aimAngle), Math.cos(Math.atan2(en.y - player.y, en.x - player.x) - aimAngle)))
        const enAny = en as any
        if (angleDiff <= 0.65 && !enAny.isBoss && enAny.rank !== 'boss' && enAny.rank !== 'unique' && enAny.rank !== 'superunique' && enAny.rank !== 'champion') {
          enAny.stunTimer = Math.max(enAny.stunTimer || 0, swStats.stunDurationFrames)
          engine.spawnOverlay('stun', { x: en.x, y: en.y })
        }
      }
    }
    skillName = '冲击波'
  } else if (skillId === 244) {
    const mbBlvl = resolveBaseSkillLevel(229, player, hudManager, engine)
    const fisBlvl = resolveBaseSkillLevel(234, player, hudManager, engine)
    const armBlvl = resolveBaseSkillLevel(249, player, hudManager, engine)
    const synMult = 1 + (mbBlvl * 12 + (fisBlvl + armBlvl) * 12) / 200
    speed = 0
    range = 150
    damage = Math.max(1, Math.round(computeCastSkillDamage(244, castSlvl, castWeaponInfo) * synMult))
    delay = 100
    missileType = 'volcano'
    aoeRadius = 24
    nextHit = 1
    nextDelay = 5
    skillName = '火山'
  } else if (skillId === 245) {
    const caBlvl = resolveBaseSkillLevel(235, player, hudManager, engine)
    const twBlvl = resolveBaseSkillLevel(240, player, hudManager, engine)
    const hurBlvl = resolveBaseSkillLevel(250, player, hudManager, engine)
    const synMult = 1 + ((caBlvl + twBlvl + hurBlvl) * 9) / 100
    speed = 475
    range = 760
    damage = Math.max(1, Math.round(computeCastSkillDamage(245, castSlvl, castWeaponInfo) * synMult))
    delay = 0
    missileType = 'tornado'
    pierce = true
    aoeRadius = 60
    nextHit = 1
    nextDelay = 25
    skillName = '龙卷风'
  } else if (skillId === 249) {
    const fsBlvl = resolveBaseSkillLevel(225, player, hudManager, engine)
    const mbBlvl = resolveBaseSkillLevel(229, player, hudManager, engine)
    const volBlvl = resolveBaseSkillLevel(244, player, hudManager, engine)
    const fisBlvl = resolveBaseSkillLevel(234, player, hudManager, engine)
    const synMult = 1 + ((fsBlvl + mbBlvl + volBlvl) * 14) / 100
    const durationFrames = 250 + fisBlvl * 50
    speed = 200
    range = 50
    damage = Math.max(1, Math.round(computeCastSkillDamage(249, castSlvl, castWeaponInfo) * synMult))
    delay = 150
    missileType = 'armageddonrock'
    aoeRadius = 160
    ;(player as any).armageddonTicks = durationFrames
    ;(player as any).armageddonDamage = damage
    ;(player as any).armageddonResidualDamage = Math.max(1, Math.round(damage / 4))
    ;(player as any).armageddonSlvl = castSlvl
    skillName = '末日浩劫'
    player.cooldown = 150
    engine.metrics.casts += 1
    const displaySkillName = isEn ? getSkillDisplayName(skillId, 'ENG') : skillName
    status.textContent = isEn ? `Cast skill: ${displaySkillName}` : `施展技能：${skillName}`
    return true
  } else if (skillId === 250) {
    const caBlvl = resolveBaseSkillLevel(235, player, hudManager, engine)
    const twBlvl = resolveBaseSkillLevel(240, player, hudManager, engine)
    const torBlvl = resolveBaseSkillLevel(245, player, hudManager, engine)
    const synMult = 1 + ((twBlvl + torBlvl) * 9) / 100
    const durationFrames = 250 + caBlvl * 50
    speed = 100
    range = 50
    damage = Math.max(1, Math.round(computeCastSkillDamage(250, castSlvl, castWeaponInfo) * synMult))
    delay = 150
    statusEffect = 'chill'
    statusDuration = 50
    aoeRadius = 180
    missileType = 'hurricaneswoosh'
    ;(player as any).hurricaneTicks = durationFrames
    ;(player as any).hurricaneDamage = damage
    ;(player as any).hurricaneChillFrames = 50
    ;(player as any).hurricaneRadiusPx = 180
    ;(player as any).hurricaneSlvl = castSlvl
    skillName = '暴风'
    player.cooldown = 150
    engine.metrics.casts += 1
    const displaySkillName = isEn ? getSkillDisplayName(skillId, 'ENG') : skillName
    status.textContent = isEn ? `Cast skill: ${displaySkillName}` : `施展技能：${skillName}`
    return true
  } else if (
    skillId === 251 ||
    skillId === 256 ||
    skillId === 257 ||
    skillId === 261 ||
    skillId === 262 ||
    skillId === 266 ||
    skillId === 271 ||
    skillId === 272 ||
    skillId === 276 ||
    skillId === 277
  ) {
    const trapSynergies = {
      fireBlastBlvl: resolveBaseSkillLevel(251, player, hudManager, engine),
      shockWebBlvl: resolveBaseSkillLevel(256, player, hudManager, engine),
      chargedBoltSentryBlvl: resolveBaseSkillLevel(261, player, hudManager, engine),
      wakeOfFireBlvl: resolveBaseSkillLevel(262, player, hudManager, engine),
      lightningSentryBlvl: resolveBaseSkillLevel(271, player, hudManager, engine),
      wakeOfInfernoBlvl: resolveBaseSkillLevel(272, player, hudManager, engine),
      deathSentryBlvl: resolveBaseSkillLevel(276, player, hudManager, engine),
    }
    const is2HWeapon = Boolean(
      (castWeapon as any)?.twoHanded ||
        (castWeaponInfo as any)?.twoHanded ||
        (player as any)?.isTwoHanded,
    )

    if (
      skillId === 261 ||
      skillId === 262 ||
      skillId === 271 ||
      skillId === 272 ||
      skillId === 276
    ) {
      let kind = 'charged_bolt_sentry'
      let monId = 'chargeboltsentry'
      let zhName = '充能弹哨卫'
      let extra: Record<string, any> = {}
      if (skillId === 261) {
        const st = calcChargedBoltSentry113c(castSlvl, trapSynergies)
        kind = 'charged_bolt_sentry'
        monId = 'chargeboltsentry'
        zhName = '充能弹哨卫'
        extra = {
          hcIdx: st.hcIdx,
          minDamage: st.minDmg,
          maxDamage: st.maxDmg,
          shotsRemaining: st.totalShots,
          boltsPerShot: st.boltsPerShot,
          missileName: st.missileName,
          subSkillId: 306,
        }
      } else if (skillId === 262) {
        const st = calcWakeOfFire113c(castSlvl, trapSynergies)
        kind = 'wake_of_fire'
        monId = 'wakeofdestruction'
        zhName = '火焰复苏'
        extra = {
          hcIdx: st.hcIdx,
          minDamage: st.minDmg,
          maxDamage: st.maxDmg,
          shotsRemaining: st.totalShots,
          missileName: st.missileName,
          makerMissileName: st.makerMissileName,
          nextDelayFrames: st.nextDelayFrames,
          subSkillId: 281,
        }
      } else if (skillId === 271) {
        const st = calcLightningSentry113c(castSlvl, trapSynergies)
        kind = 'lightning_sentry'
        monId = 'lightningsentry'
        zhName = '闪电哨卫'
        extra = {
          hcIdx: st.hcIdx,
          minDamage: st.minDmg,
          maxDamage: st.maxDmg,
          shotsRemaining: st.totalShots,
          missileName: st.missileName,
          pierce: st.pierce,
          subSkillId: 313,
        }
      } else if (skillId === 272) {
        const st = calcWakeOfInferno113c(castSlvl, trapSynergies)
        kind = 'wake_of_inferno'
        monId = 'infernosentry'
        zhName = '地狱火复苏'
        extra = {
          hcIdx: st.hcIdx,
          minDamage: st.minDmg,
          maxDamage: st.maxDmg,
          shotsRemaining: st.totalShots,
          missileName: st.missileName,
          subSkillId: 311,
        }
      } else {
        const st = calcDeathSentry113c(castSlvl, trapSynergies)
        kind = 'death_sentry'
        monId = 'deathsentry'
        zhName = '死亡哨卫'
        extra = {
          hcIdx: st.hcIdx,
          minDamage: st.minDmg,
          maxDamage: st.maxDmg,
          shotsRemaining: st.totalShots,
          missileName: st.missileName,
          pierce: st.pierce,
          corpseExplosionRadiusSubtiles: st.corpseExplosionRadiusSubtiles,
          subSkillIds: [312, 324],
        }
      }
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId,
        slvl: castSlvl,
        x: targetX,
        y: targetY,
        petType: 'assassintrap',
        petGroup: 0,
        maxPets: 5,
        hp: 100,
        kind,
        monId,
        extra,
      })
      player.cooldown = 0
      engine.metrics.casts += 1
      const displayName = isEn ? getSkillDisplayName(skillId, 'ENG') : zhName
      status.textContent = isEn ? `Cast skill: ${displayName}` : `施展技能：${zhName}`
      return true
    }

    if (skillId === 277) {
      const bsh = calcBladeShield113c(
        castSlvl,
        castWeaponInfo.damageMin,
        castWeaponInfo.damageMax,
      )
      const pulseDmg = Math.max(1, Math.round((bsh.totalMin + bsh.totalMax) / 2))
      ;(player as any).bladeShieldTicks = bsh.durationFrames
      ;(player as any).bladeShieldSlvl = castSlvl
      ;(player as any).bladeShieldPerDelayFrames = bsh.perDelayFrames
      ;(player as any).bladeShieldRadiusSubtiles = bsh.radiusSubtiles
      ;(player as any).bladeShieldDamage = pulseDmg
      engine.spawnOverlay('bladeshield', { x: player.x, y: player.y }, 'player', {
        loop: true,
        isStateOverlay: true,
      })
      const radiusPx = bsh.radiusSubtiles * 20
      for (const m of engine.world.monsters) {
        if (m.state === 'dead' || m.hp <= 0) continue
        if (Math.hypot(m.x - player.x, m.y - player.y) <= radiusPx) {
          damageMonster(engine.world, m.index, pulseDmg)
        }
      }
      player.cooldown = 0
      engine.metrics.casts += 1
      const displayName = isEn ? getSkillDisplayName(277, 'ENG') : '刀刃之盾'
      status.textContent = isEn ? `Cast skill: ${displayName}` : '施展技能：刀刃之盾'
      return true
    }

    if (skillId === 251) {
      const fb = calcFireBlast113c(castSlvl, trapSynergies)
      speed = 450
      range = 400
      damage = Math.max(1, Math.round((fb.minDmg + fb.maxDmg) / 2))
      delay = 0
      missileType = 'bomb in air'
      aoeRadius = fb.explosionRadiusSubtiles * 20 // 3 sub-tiles = 60px
      aoeDamage = damage
      skillName = '火焰爆震'
    } else if (skillId === 256) {
      const sw = calcShockWeb113c(castSlvl, trapSynergies)
      speed = 450
      range = 400
      damage = Math.max(1, Math.round((sw.minDmg + sw.maxDmg) / 2))
      delay = 15
      missileType = 'shock field on ground'
      multiCount = sw.spikeCount
      spreadAngle = 0.6
      fireDuration = 90
      residualDamage = damage
      nextHit = 1
      nextDelay = 25
      skillName = '雷电网'
    } else if (skillId === 257) {
      const bs = calcBladeSentinel113c(
        castSlvl,
        castWeaponInfo.damageMin,
        castWeaponInfo.damageMax,
        is2HWeapon,
      )
      speed = 250
      range = 250 * 4 // 100 frames
      damage = Math.max(1, Math.round((bs.totalMin + bs.totalMax) / 2))
      delay = 50
      missileType = 'blade creeper'
      pierce = true
      nextHit = 1
      nextDelay = 25
      skillName = '刀刃守卫'
      registerCastSummon({
        engine,
        player,
        hudManager,
        skillId: 257,
        slvl: castSlvl,
        x: targetX,
        y: targetY,
        petType: 'bladesentinel',
        petGroup: 0,
        maxPets: Number.POSITIVE_INFINITY,
        hp: 100,
        kind: 'blade_sentinel',
        monId: 'bladecreeper',
        lifespanTicks: 100,
        extra: {
          hcIdx: 413,
          classId: 413,
          missileName: 'blade creeper',
          missileId: 392,
        },
      })
    } else if (skillId === 266) {
      const bf = calcBladeFury113c(
        castSlvl,
        castWeaponInfo.damageMin,
        castWeaponInfo.damageMax,
        is2HWeapon,
      )
      speed = 550
      range = 880 // 40 frames at Vel=22 (Missiles.txt #506 bladefragment1)
      damage = Math.max(1, Math.round((bf.totalMin + bf.totalMax) / 2))
      delay = 0
      missileType = 'bladefragment1'
      multiCount = 1
      skillName = '刀刃之怒'
    }
  } else if (isBatch1Skill(skillId)) {
    const def = getBatch1SkillDef(skillId)!
    speed = def.speed ?? 450
    range = def.range ?? 400
    damage = computeCastSkillDamage(skillId, castSlvl, castWeaponInfo)
    delay = def.delay
    skillName = def.name
  }

  const dx = targetX - player.x
  const dy = targetY - player.y
  const baseAngle = Math.atan2(dy, dx)
  const perTick = speed / 25
  const ttl = perTick > 0 ? Math.max(1, Math.round(range / perTick)) : Math.max(1, Math.round(range))

  if (isNova) {
    for (let i = 0; i < multiCount; i++) {
      const angle = (i / multiCount) * 2 * Math.PI
      const pVx = Math.cos(angle) * perTick
      const pVy = Math.sin(angle) * (perTick * ISO_GROUND_ASPECT_RATIO)
      engine.projectiles.push({
        skillId: String(skillId), x: player.x, y: player.y, vx: pVx, vy: pVy,
        damage, ttl, fromPlayer: true, missileType, statusEffect, statusDuration,
        nextHit: 1, nextDelay: 4,
      })
    }
  } else if (multiCount > 1) {
    const startAngle = baseAngle - spreadAngle / 2
    const step = spreadAngle / (multiCount - 1)
    for (let i = 0; i < multiCount; i++) {
      const hasCustomAngle = customTargetAngles !== undefined && customTargetAngles[i] !== undefined
      const angle = hasCustomAngle ? customTargetAngles![i]! : startAngle + i * step
      const pVx = Math.cos(angle) * perTick
      const pVy =
        Math.sin(angle) *
        (perTick * (!hasCustomAngle && (skillId === 67 || skillId === 38 || skillId === 12 || skillId === 26) ? ISO_GROUND_ASPECT_RATIO : 1))
      engine.projectiles.push({
        skillId: String(skillId), slvl: castSlvl, x: player.x, y: player.y, vx: pVx, vy: pVy,
        damage, ttl, fromPlayer: true, missileType, jitter, seed: i,
        jitterIndex: (i * 7) % 32, pierce, pierceChancePct, maxPierceCount, aoeRadius, aoeDamage,
        residualDamage, fireDuration, statusEffect, statusDuration,
        isUndeadOnly, nextHit, nextDelay,
      })
    }
  } else {
    let pVx: number
    let pVy: number
    let pX = player.x
    let pY = player.y
    if (skillId === 234 || skillId === 244) {
      pX = targetX
      pY = targetY
      pVx = 0
      pVy = 0
    } else if (spiral !== undefined) {
      pX = spiral.originX + Math.cos(spiral.angle) * spiral.radius
      pY = spiral.originY + Math.sin(spiral.angle) * (spiral.radius * ISO_GROUND_ASPECT_RATIO)
      pVx = -Math.sin(spiral.angle) * 18
      pVy = Math.cos(spiral.angle) * (18 * ISO_GROUND_ASPECT_RATIO)
    } else {
      const len = Math.hypot(dx, dy)
      pVx = len > 0 ? (dx / len) * perTick : perTick
      pVy = len > 0 ? (dy / len) * perTick : 0
    }
    engine.projectiles.push({
      skillId: String(skillId), slvl: castSlvl, x: pX, y: pY, vx: pVx, vy: pVy,
      damage, ttl, fromPlayer: true, missileType, pierce, pierceChancePct, maxPierceCount, aoeRadius, aoeDamage,
      residualDamage, fireDuration, statusEffect, statusDuration, homing, spiral, jitter, isUndeadOnly,
      chainRemaining, nextHit, nextDelay,
      ...(skillId === 257
        ? {
            isPatrol: true,
            patrolOriginX: player.x,
            patrolOriginY: player.y,
            patrolTargetX: targetX,
            patrolTargetY: targetY,
          }
        : {}),
    })
  }

  const cdTicks = getSkillCooldownTicks(skillId)
  const fallbackCd =
    skillId === 38 || skillId === 43 || skillId === 44 || skillId === 48 || skillId === 49 || skillId === 53 || skillId === 42 ||
    skillId === 130 || skillId === 131 || skillId === 137 || skillId === 138 || skillId === 142 ||
    skillId === 146 || skillId === 149 || skillId === 150 || skillId === 154 || skillId === 155 ||
    skillId === 230 || skillId === 235 || skillId === 240 || skillId === 243 || skillId === 245 ||
    skillId === 251 || skillId === 266
      ? 0
      : isAmaBowSkill && castWeaponInfo.isRanged
        ? castWeaponInfo.cooldown
        : 10
  player.cooldown = cdTicks > 0 ? cdTicks : (delay > 0 ? delay : fallbackCd)
  engine.metrics.casts += 1
  const displaySkillName = isEn ? getSkillDisplayName(skillId, 'ENG') : skillName
  status.textContent = isEn ? `Cast skill: ${displaySkillName}` : `施展技能：${skillName}`
  return true
}
