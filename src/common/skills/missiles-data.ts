import type { CharacterClassCode } from '../units/classes.ts'
import type { CombatPlayer } from '../units/unit-types.ts'
import { OVERLAY_TXT_ROWS } from '../data/overlay-txt-rows.ts'
import { SKILL_OVERLAY_ROWS_113C, type SkillOverlayRow113c } from './skill-state-overlays-113c.ts'
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
} from './amazon-bow.ts'
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
} from './amazon-passive.ts'
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
} from './amazon-javelin-spear.ts'

/** One castable skill, read from a table row. */
export interface SkillDef {
  /** Table id. */
  readonly id: string
  /** Display name, resolved through the text table when the row names an index. */
  readonly name: string
  /** Mana spent per cast. */
  readonly manaCost: number
  /** Ticks between casts. */
  readonly cooldownTicks: number
  /** Maximum cast distance; also the projectile's lifetime in pixels. */
  readonly range: number
  /** Whether the skill spawns a projectile (as opposed to striking instantly). */
  readonly projectile: boolean
  /** Projectile speed in pixels per second. */
  readonly speed: number
  /** Damage at skill level 1. */
  readonly baseMinDamage: number
  /** Damage at skill level 1. */
  readonly baseMaxDamage: number
  /** Damage added per additional skill level. */
  readonly damagePerLevel: number
  /** Radius of the instant effect, for non-projectile skills. */
  readonly radius: number
  /** Cast overlay identifier from Skills.txt castoverlay column (e.g. 'fire_cast_1'). */
  readonly castOverlay?: string | undefined
}

/** A projectile in flight. */
export interface Projectile {
  /** Skill it came from. */
  readonly skillId: string
  /** World x. */
  readonly x: number
  /** World y. */
  readonly y: number
  /** Velocity x, pixels per tick. */
  readonly vx: number
  /** Velocity y, pixels per tick. */
  readonly vy: number
  /** Damage on hit. */
  readonly damage: number
  /** Ticks left before it expires. */
  readonly ttl: number
  /** Whether the player fired it (projectiles hit the other side). */
  readonly fromPlayer: boolean
  /** Optional missile type / token (e.g. 'firebolt'). */
  readonly missileType?: string | undefined
  /** Pierces through enemies without expiring until range or wall hit. */
  readonly pierce?: boolean | undefined
  /**
   * Owner `item_pierce + skill_pierce` total. 1.13c rolls it ONCE into the missile's `pierce_idx`
   * (`D2Game.dll` `0x6FC8F660`: consecutive `rand % 100 < total`, at most 4) — never per hit (Issue #1420).
   */
  readonly pierceChancePct?: number | undefined
  /** Remaining pierces (`pierce_idx`, stat #328) once rolled; decremented per hit (`D2Game.dll` `0x6FC58F40`). */
  readonly pierceIdx?: number | undefined
  /** Number of times this projectile has already pierced a target. */
  readonly pierceCount?: number | undefined
  /** Maximum number of pierces allowed before expiring (1.13c cap = 4 pierces / 5 total hits). */
  readonly maxPierceCount?: number | undefined
  /** Set of monster indices already hit by this projectile (for pierce/nextHit). */
  readonly hitTargets?: Set<number> | undefined
  /** Area of effect splash radius in pixels upon impact. */
  readonly aoeRadius?: number | undefined
  /** Area of effect splash damage upon impact (if distinct from direct hit damage, e.g. Exploding/Immolation/Freezing Arrow). */
  readonly aoeDamage?: number | undefined
  /** Elemental status effect applied on hit: chill, freeze, poison. */
  readonly statusEffect?: 'chill' | 'freeze' | 'poison' | undefined
  /** Duration in ticks of the status effect. */
  readonly statusDuration?: number | undefined
  /** Stun duration in ticks on hit (e.g. Twister 10 frames = 0.4s). */
  readonly stunDuration?: number | undefined
  /** Knockback on hit (e.g. Molten Boulder). */
  readonly knockback?: boolean | undefined
  /** Homing missile: steers towards nearest alive monster. */
  readonly homing?: boolean | undefined
  /** Archimedean spiral trajectory (e.g. Blessed Hammer). */
  readonly spiral?: {
    readonly originX: number
    readonly originY: number
    readonly angle: number
    readonly radius: number
  } | undefined
  /** Random perpendicular trajectory wobble (e.g. Charged Bolt). */
  readonly jitter?: boolean | undefined
  /** PRNG seed for projectile variance (e.g. Charged Bolt). */
  readonly seed?: number | undefined
  /** Current index in the discrete orthogonal jitter table (0-31). */
  readonly jitterIndex?: number | undefined
  /** Target restriction: only hits undead monsters. */
  readonly isUndeadOnly?: boolean | undefined
  /** Sub-missile emission index along the 64-point discrete circle table (e.g. Frozen Orb). */
  readonly subMissileIdx?: number | undefined
  /** Affine curl damping trajectory in last 6 frames (e.g. Frozen Orb Nova). */
  readonly isNovaCurl?: boolean | undefined
  /** Stationary turret emitter (e.g. Hydra, Skill 62). */
  readonly isTurret?: boolean | undefined
  /** Fire cadence interval in ticks for turret emitters (e.g. 25). */
  readonly fireCadenceTicks?: number | undefined
  /** Head index within multi-head cluster (e.g. 0, 1, 2). */
  readonly headIndex?: number | undefined
  /** Pre-configured target world coordinate when targets array is empty. */
  readonly targetX?: number | undefined
  readonly targetY?: number | undefined
  /** Missile type spawned by turret (defaults to 'hydra'). */
  readonly spawnMissileType?: string | undefined
  /** Number of elapsed ticks this projectile has lived. */
  readonly ageTicks?: number | undefined
  /** Altitude above ground in pixels for falling missiles (e.g. Blizzard shards). */
  readonly altitude?: number | undefined
  /** Skill level of the source skill (for dynamic duration/damage scaling). */
  readonly slvl?: number | undefined
  /** Residual ground fire duration in ticks. */
  readonly fireDuration?: number | undefined
  /** Residual ground fire damage per tick. */
  readonly residualDamage?: number | undefined
  /** Authentic 1.13c NextHit flag and NextDelay immunity window in frames. */
  readonly nextHit?: boolean | number | undefined
  readonly nextDelay?: number | undefined
  /** Number of jumps remaining for chaining projectiles (e.g. Chain Lightning). */
  readonly chainRemaining?: number | undefined
  /** Previous target index hit by this chain projectile to avoid immediately retargeting it. */
  readonly lastHitTargetIndex?: number | undefined
  /** Previous position before last tick step (for client-side trail generation). */
  readonly prevX?: number | undefined
  readonly prevY?: number | undefined
}

/**
 * In Diablo II's 2:1 isometric projection (orthogonal diamond grid: 80x40 cells, 16x8 sub-tiles),
 * any horizontal circular curve on the map ground plane projects into scene-pixel coordinates
 * as an ellipse with a 2:1 aspect ratio (vertical scale / horizontal scale = 8 / 16 = 0.5).
 *
 * NOTE: The calculated coordinates (x, y) are physical MAP coordinates on the level plane,
 * NOT the rendered sprite icon offsets. Rendered icons are pre-rendered 2.5D DCC billboards
 * positioned via sprite frame anchors, while map coordinates govern physical trajectory and collision.
 */
export const ISO_GROUND_ASPECT_RATIO = 0.5

/** What a cast produced. */
export type CastResult =
  | { readonly kind: 'mana'; readonly cost: number }
  | { readonly kind: 'cooldown'; readonly ticksLeft: number }
  | { readonly kind: 'projectile'; readonly projectile: Projectile }
  | { readonly kind: 'instant'; readonly radius: number; readonly damage: number }

/** A caster's position and facing. */
export interface Caster {
  /** World x. */
  readonly x: number
  /** World y. */
  readonly y: number
  /** Facing index (0 = south, turning west). */
  readonly facing: number
}

/** Direction vectors, in the same order as sprite groups (0 = south, turning west). */
export const FACING_VECTORS: readonly (readonly [number, number])[] = [
  [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1],
]

/**
 * Data extracted from Diablo II 1.13c Missiles.txt for projectile physics.
 */
export interface MissileTxtData {
  readonly name: string
  readonly id: number
  readonly vel: number
  readonly maxVel: number
  readonly velLev?: number | undefined
  readonly accel?: number | undefined
  readonly range: number
  readonly levRange: number
  readonly celFile: string
  readonly animLen: number
  readonly animSpeed: number
  readonly loopAnim: number
  readonly numDirections: number
  readonly explosionMissile: string
  readonly light: number
  readonly red: number
  readonly green: number
  readonly blue: number
  /** Calculated speed in pixels per second: vel * 25 */
  readonly speedPxPerSec: number
  /** Calculated flight distance in pixels: vel * range */
  readonly distancePx: number
  readonly nextHit?: number | boolean | undefined
  readonly nextDelay?: number | undefined
  readonly trans?: number | undefined
  readonly subLoop?: number | undefined
  readonly subStart?: number | undefined
  readonly subStop?: number | undefined
  readonly alwaysExplode?: number | boolean | undefined
  readonly pierce?: number | boolean | undefined
  readonly pCltDoFunc?: number | undefined
  readonly pCltHitFunc?: number | undefined
  readonly param1?: number | undefined
  readonly param2?: number | undefined
  readonly cltParam1?: number | undefined
  readonly cltParam2?: number | undefined
  readonly cltParam3?: number | undefined
  readonly cltParam4?: number | undefined
  readonly cltParam5?: number | undefined
  readonly cHitPar1?: number | undefined
  readonly cHitPar2?: number | undefined
  readonly cHitPar3?: number | undefined
  readonly cHitCalc1?: string | undefined
  readonly cltSubMissile1?: string | undefined
  readonly cltSubMissile2?: string | undefined
  readonly cltSubMissile3?: string | undefined
  readonly cltHitSubMissile1?: string | undefined
  readonly cltHitSubMissile2?: string | undefined
  readonly cltHitSubMissile3?: string | undefined
  readonly cltHitSubMissile4?: string | undefined
  readonly progOverlay?: string | undefined
  readonly collideFriend?: number | boolean | undefined
  readonly holy?: number | undefined
  readonly randStart?: number | undefined
}

/**
 * Canonical 1.13c Missiles.txt rows: exactly the 684 rows of the table, keyed by the lower-case `Missile` name, with
 * the row's own `Id` (Issue #1089: no client aliases / invented rows).
 */
export const CANONICAL_113C_MISSILES: Readonly<Record<string, MissileTxtData>> = Object.freeze({
  arrow: { name: "arrow", id: 0, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 0, pierce: true },
  javelin: { name: "javelin", id: 1, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 0, pierce: true },
  bighead1: { name: "bighead1", id: 2, vel: 8, maxVel: 8, range: 40, levRange: 0, celFile: "BigheadLightningMissile", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "bigheadexp", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 200, distancePx: 320, trans: 1 },
  bighead2: { name: "bighead2", id: 3, vel: 12, maxVel: 12, range: 40, levRange: 0, celFile: "BigheadLightningMissile", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "bigheadexp", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 300, distancePx: 480, trans: 1 },
  bighead3: { name: "bighead3", id: 4, vel: 14, maxVel: 14, range: 40, levRange: 0, celFile: "BigheadLightningMissile", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "bigheadexp", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 350, distancePx: 560, trans: 1 },
  bighead4: { name: "bighead4", id: 5, vel: 10, maxVel: 10, range: 40, levRange: 0, celFile: "BigheadLightningMissile", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "bigheadexp", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 250, distancePx: 400, trans: 1 },
  bighead5: { name: "bighead5", id: 6, vel: 16, maxVel: 16, range: 40, levRange: 0, celFile: "BigheadLightningMissile", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "bigheadexp", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 400, distancePx: 640, trans: 1 },
  spike1: { name: "spike1", id: 7, vel: 10, maxVel: 10, velLev: 8, range: 40, levRange: 0, celFile: "SpikeFiendMissle", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 250, distancePx: 400 },
  spike2: { name: "spike2", id: 8, vel: 13, maxVel: 13, velLev: 7, range: 40, levRange: 0, celFile: "SpikeFiendMissle", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 325, distancePx: 520 },
  spike3: { name: "spike3", id: 9, vel: 16, maxVel: 16, velLev: 6, range: 40, levRange: 0, celFile: "SpikeFiendMissle", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 400, distancePx: 640 },
  spike4: { name: "spike4", id: 10, vel: 20, maxVel: 20, velLev: 4, range: 40, levRange: 0, celFile: "SpikeFiendMissle", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 800 },
  spike5: { name: "spike5", id: 11, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "SpikeFiendMissle", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960 },
  firearrow: { name: "firearrow", id: 12, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "FireArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "fireexplode", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 600, distancePx: 960, trans: 1, pierce: true },
  cr_arrow1: { name: "cr_arrow1", id: 13, vel: 14, maxVel: 14, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 350, distancePx: 560, pierce: true },
  cr_arrow2: { name: "cr_arrow2", id: 14, vel: 16, maxVel: 16, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 400, distancePx: 640, pierce: true },
  cr_arrow3: { name: "cr_arrow3", id: 15, vel: 18, maxVel: 18, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 450, distancePx: 720, pierce: true },
  cr_arrow4: { name: "cr_arrow4", id: 16, vel: 20, maxVel: 20, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 800, pierce: true },
  cr_arrow5: { name: "cr_arrow5", id: 17, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, pierce: true },
  blood1: { name: "blood1", id: 18, vel: 3, maxVel: 3, range: 128, levRange: 0, celFile: "BloodSmall01", animLen: 9, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 75, distancePx: 384 },
  blood2: { name: "blood2", id: 19, vel: 4, maxVel: 4, range: 128, levRange: 0, celFile: "BloodSmall02", animLen: 9, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 100, distancePx: 512 },
  bigblood1: { name: "bigblood1", id: 20, vel: 3, maxVel: 3, range: 128, levRange: 0, celFile: "BloodLarge01", animLen: 9, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 75, distancePx: 384 },
  bigblood2: { name: "bigblood2", id: 21, vel: 4, maxVel: 4, range: 128, levRange: 0, celFile: "BloodLarge02", animLen: 9, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 100, distancePx: 512 },
  shafire1: { name: "shafire1", id: 22, vel: 8, maxVel: 8, range: 40, levRange: 0, celFile: "ShamanFireball", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 200, distancePx: 320, trans: 1, pierce: true },
  shafire2: { name: "shafire2", id: 23, vel: 10, maxVel: 10, range: 40, levRange: 0, celFile: "ShamanFireball", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 250, distancePx: 400, trans: 1, pierce: true },
  shafire3: { name: "shafire3", id: 24, vel: 12, maxVel: 12, range: 40, levRange: 0, celFile: "ShamanFireball", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 480, trans: 1, pierce: true },
  shafire4: { name: "shafire4", id: 25, vel: 16, maxVel: 16, range: 40, levRange: 0, celFile: "ShamanFireball", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 400, distancePx: 640, trans: 1, pierce: true },
  shafire5: { name: "shafire5", id: 26, vel: 20, maxVel: 20, range: 40, levRange: 0, celFile: "ShamanFireball", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 500, distancePx: 800, trans: 1, pierce: true },
  magicarrow: { name: "magicarrow", id: 27, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "SafeArrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "teethexplode", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 1, pierce: true },
  icearrow: { name: "icearrow", id: 28, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "IceArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "iceexplode", light: 5, red: 81, green: 81, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 1, pierce: true },
  fireexplode: { name: "fireexplode", id: 29, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "FireArrowExplode2", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 13, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  iceexplode: { name: "iceexplode", id: 30, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "IceArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 11, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  bolt: { name: "bolt", id: 31, vel: 24, maxVel: 24, range: 50, levRange: 0, celFile: "XBowBolt", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 1200, trans: 0, pierce: true },
  andarielspray: { name: "andarielspray", id: 32, vel: 15, maxVel: 15, range: 40, levRange: 0, celFile: "AndarielSpell", animLen: 24, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 375, distancePx: 600, trans: 1, pierce: true },
  bigheadexp: { name: "bigheadexp", id: 33, vel: 0, maxVel: 0, range: 6, levRange: 0, celFile: "BigheadLightningExplosion", animLen: 7, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 8, red: 143, green: 143, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  shamanexp: { name: "shamanexp", id: 34, vel: 0, maxVel: 0, range: 11, levRange: 0, celFile: "ShamanFireballExplodeFinal", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 8, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  throwaxe: { name: "throwaxe", id: 35, vel: 24, maxVel: 24, range: 20, levRange: 0, celFile: "MissileHandAxe", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 480, trans: 0, pierce: true },
  throwknife: { name: "throwknife", id: 36, vel: 24, maxVel: 24, range: 20, levRange: 0, celFile: "MissileDagger", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 480, trans: 0, pierce: true },
  glaive: { name: "glaive", id: 37, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Glaive", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 0, pierce: true },
  poisonjav: { name: "poisonjav", id: 38, vel: 24, maxVel: 24, range: 25, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 128, green: 255, blue: 128, speedPxPerSec: 600, distancePx: 600, trans: 0, pierce: true, pCltDoFunc: 3, cltSubMissile1: "poisonjavcloud" },
  poisonjavcloud: { name: "poisonjavcloud", id: 39, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 128, green: 255, blue: 128, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19, pCltDoFunc: 4, param1: 2, param2: 4, cltParam1: 24, cltParam2: 1, cltParam3: 6, cltSubMissile1: "poisonpuff" },
  coldarrow: { name: "coldarrow", id: 40, vel: 24, maxVel: 24, range: 20, levRange: 0, celFile: "IceArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "iceexplode", light: 5, red: 81, green: 81, blue: 255, speedPxPerSec: 600, distancePx: 480, trans: 1, pierce: true },
  explodingarrow: { name: "explodingarrow", id: 41, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "FireArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "explodingarrowexp", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 600, distancePx: 960, trans: 1, alwaysExplode: true, pierce: true, pCltHitFunc: 1, cHitPar1: 3, cHitPar2: 1, cltHitSubMissile1: "fireexplosion2" },
  explodingarrowexp: { name: "explodingarrowexp", id: 42, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "ExpArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 15, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  plaguejavelin: { name: "plaguejavelin", id: 43, vel: 24, maxVel: 24, range: 15, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 4, red: 128, green: 255, blue: 128, speedPxPerSec: 600, distancePx: 360, alwaysExplode: true, pierce: true, pCltDoFunc: 3, cltSubMissile1: "plaguejavcloud", pCltHitFunc: 2, cHitPar1: 1, cHitPar2: 2, cHitPar3: 3, cltHitSubMissile1: "plaguejavcloud" },
  oilpotion: { name: "oilpotion", id: 44, vel: 16, maxVel: 16, range: 30, levRange: 0, celFile: "mslops", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 128, blue: 128, speedPxPerSec: 400, distancePx: 480, alwaysExplode: true, pCltDoFunc: 2, pCltHitFunc: 3, cltHitSubMissile1: "fireexplode" },
  explosivepotion: { name: "explosivepotion", id: 45, vel: 16, maxVel: 16, range: 30, levRange: 0, celFile: "mslopm", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 128, blue: 128, speedPxPerSec: 400, distancePx: 480, alwaysExplode: true, pCltDoFunc: 2, pCltHitFunc: 3, cltHitSubMissile1: "explodingarrowexp" },
  fulminatingpotion: { name: "fulminatingpotion", id: 46, vel: 16, maxVel: 16, range: 30, levRange: 0, celFile: "mslopl", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 128, blue: 128, speedPxPerSec: 400, distancePx: 480, alwaysExplode: true, pCltDoFunc: 2, pCltHitFunc: 3, cltHitSubMissile1: "explosivepotionexp", cltHitSubMissile2: "explosivepotiondebris1", cltHitSubMissile3: "explosivepotiondebris3" },
  rancidgasepotion: { name: "rancidgasepotion", id: 47, vel: 16, maxVel: 16, range: 30, levRange: 0, celFile: "mslgps", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 128, green: 255, blue: 128, speedPxPerSec: 400, distancePx: 480, alwaysExplode: true, pCltDoFunc: 2, pCltHitFunc: 2, cHitPar1: 0, cHitPar2: 2, cHitPar3: 3, cltHitSubMissile1: "rancidgascloud" },
  chokinggaspoition: { name: "chokinggaspoition", id: 48, vel: 16, maxVel: 16, range: 30, levRange: 0, celFile: "mslgpm", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 128, green: 255, blue: 128, speedPxPerSec: 400, distancePx: 480, alwaysExplode: true, pCltDoFunc: 2, pCltHitFunc: 2, cHitPar1: 2, cHitPar2: 2, cHitPar3: 3, cltHitSubMissile1: "chokinggascloud" },
  stranglinggaspotion: { name: "stranglinggaspotion", id: 49, vel: 16, maxVel: 16, range: 30, levRange: 0, celFile: "mslgpl", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 128, green: 255, blue: 128, speedPxPerSec: 400, distancePx: 480, alwaysExplode: true, pCltDoFunc: 2, pCltHitFunc: 2, cHitPar1: 1, cHitPar2: 2, cHitPar3: 3, cltHitSubMissile1: "stranglinggascloud" },
  notused50: { name: "notused50", id: 50, vel: 0, maxVel: 0, range: 0, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  explosivepotionexp: { name: "explosivepotionexp", id: 51, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "PotionExplode", animLen: 29, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 13, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  explosivepotiondebris1: { name: "explosivepotiondebris1", id: 52, vel: 0, maxVel: 0, range: 0, levRange: 0, celFile: "PotionExplodeDebris01", animLen: 29, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  explosivepotiondebris2: { name: "explosivepotiondebris2", id: 53, vel: 0, maxVel: 0, range: 0, levRange: 0, celFile: "PotionExplodeDebris02", animLen: 29, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  explosivepotiondebris3: { name: "explosivepotiondebris3", id: 54, vel: 0, maxVel: 0, range: 0, levRange: 0, celFile: "PotionExplodeDebris03", animLen: 29, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  holybolt: { name: "holybolt", id: 55, vel: 20, maxVel: 20, range: 50, levRange: 0, celFile: "HolyBoltMissile", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 7, red: 222, green: 222, blue: 255, speedPxPerSec: 500, distancePx: 1000, trans: 1, progOverlay: "healing", pCltHitFunc: 9, cHitPar1: 1, cHitPar2: 1, cltHitSubMissile1: "teethexplode", collideFriend: 1, holy: 1 },
  chargedbolt: { name: "chargedbolt", id: 56, vel: 12, maxVel: 12, range: 98, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1176, trans: 1, subLoop: 1, subStart: 2, subStop: 8, progOverlay: "lightning", pCltHitFunc: 10 },
  sanctuarybolt: { name: "sanctuarybolt", id: 57, vel: 0, maxVel: 0, range: 14, levRange: 0, celFile: "Gleam", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 222, green: 222, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  firebolt: { name: "firebolt", id: 58, vel: 20, maxVel: 20, range: 50, levRange: 0, celFile: "Firebolt", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "fireexplode", light: 7, red: 255, green: 178, blue: 64, speedPxPerSec: 500, distancePx: 1000, trans: 1 },
  icebolt: { name: "icebolt", id: 59, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "Icebolt", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "iceexplode", light: 7, red: 81, green: 81, blue: 255, speedPxPerSec: 300, distancePx: 600, trans: 1 },
  infernoflame1: { name: "infernoflame1", id: 60, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "Flamethrower", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  infernoflame2: { name: "infernoflame2", id: 61, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "Flamethrower2", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  fireball: { name: "fireball", id: 62, vel: 20, maxVel: 20, range: 50, levRange: 0, celFile: "Fireball", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "explodingarrowexp", light: 7, red: 255, green: 178, blue: 64, speedPxPerSec: 500, distancePx: 1000, trans: 1, pCltHitFunc: 1, cHitPar1: 3, cHitPar2: 1, cltHitSubMissile1: "fireexplosion2" },
  mummy1: { name: "mummy1", id: 63, vel: 5, maxVel: 5, range: 24, levRange: 0, celFile: "GreaterMummyBreath", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 125, distancePx: 120, trans: 1 },
  mummy2: { name: "mummy2", id: 64, vel: 5, maxVel: 5, range: 24, levRange: 0, celFile: "GreaterMummyBreath", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 125, distancePx: 120, trans: 1 },
  mummy3: { name: "mummy3", id: 65, vel: 5, maxVel: 5, range: 24, levRange: 0, celFile: "GreaterMummyBreath", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 125, distancePx: 120, trans: 1 },
  mummy4: { name: "mummy4", id: 66, vel: 5, maxVel: 5, range: 24, levRange: 0, celFile: "GreaterMummyBreath", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 125, distancePx: 120, trans: 1 },
  blaze: { name: "blaze", id: 67, vel: 0, maxVel: 0, range: 90, levRange: 25, celFile: "groundFireBig", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  firewallmaker: { name: "firewallmaker", id: 68, vel: 12, maxVel: 12, range: 7, levRange: 2, celFile: "groundFireBig", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 8, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 84, trans: 1, subLoop: 1, subStart: 1, subStop: 2 },
  firewall: { name: "firewall", id: 69, vel: 0, maxVel: 0, range: 90, levRange: 0, celFile: "groundFireBig", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  goospit1: { name: "goospit1", id: 70, vel: 10, maxVel: 10, range: 24, levRange: 0, celFile: "SandMaggotGooSpit", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "goosplat", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 250, distancePx: 240 },
  goospit2: { name: "goospit2", id: 71, vel: 10, maxVel: 10, range: 24, levRange: 0, celFile: "SandMaggotGooSpit", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "goosplat", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 250, distancePx: 240 },
  goospit3: { name: "goospit3", id: 72, vel: 10, maxVel: 10, range: 24, levRange: 0, celFile: "SandMaggotGooSpit", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "goosplat", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 250, distancePx: 240 },
  goospit4: { name: "goospit4", id: 73, vel: 10, maxVel: 10, range: 24, levRange: 0, celFile: "SandMaggotGooSpit", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "goosplat", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 250, distancePx: 240 },
  goospit5: { name: "goospit5", id: 74, vel: 10, maxVel: 10, range: 24, levRange: 0, celFile: "SandMaggotGooSpit", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "goosplat", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 250, distancePx: 240 },
  goosplat: { name: "goosplat", id: 75, vel: 0, maxVel: 0, range: 15, levRange: 0, celFile: "GooHit", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  "sand pile": { name: "sand pile", id: 76, vel: 0, maxVel: 0, range: 128, levRange: 0, celFile: "SandMaggotSandPile", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  unholybolt1: { name: "unholybolt1", id: 77, vel: 12, maxVel: 12, range: 40, levRange: 0, celFile: "UnholyBolt", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 0, green: 0, blue: 0, speedPxPerSec: 300, distancePx: 480, trans: 2 },
  unholybolt2: { name: "unholybolt2", id: 78, vel: 12, maxVel: 12, range: 40, levRange: 0, celFile: "UnholyBolt", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 0, green: 0, blue: 0, speedPxPerSec: 300, distancePx: 480, trans: 2 },
  unholybolt3: { name: "unholybolt3", id: 79, vel: 12, maxVel: 12, range: 40, levRange: 0, celFile: "UnholyBolt", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 0, green: 0, blue: 0, speedPxPerSec: 300, distancePx: 480, trans: 2 },
  unholybolt4: { name: "unholybolt4", id: 80, vel: 12, maxVel: 12, range: 40, levRange: 0, celFile: "UnholyBolt", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 0, green: 0, blue: 0, speedPxPerSec: 300, distancePx: 480, trans: 2 },
  sanctuarycenter: { name: "sanctuarycenter", id: 81, vel: 0, maxVel: 0, range: 125, levRange: 0, celFile: "sanctuary", animLen: 40, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, subLoop: 1, subStart: 10, subStop: 30 },
  fireexplosion: { name: "fireexplosion", id: 82, vel: 0, maxVel: 0, range: 15, levRange: 0, celFile: "FireArrowExplode2", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  stuckarrow: { name: "stuckarrow", id: 83, vel: 1, maxVel: 1, range: 128, levRange: 0, celFile: "ArrowInGround", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 25, distancePx: 128 },
  footprint: { name: "footprint", id: 84, vel: 0, maxVel: 0, range: 128, levRange: 0, celFile: "Footsteps01", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  immolationarrow: { name: "immolationarrow", id: 85, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "FireArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 9, red: 255, green: 178, blue: 64, speedPxPerSec: 600, distancePx: 960, trans: 1, alwaysExplode: true, pierce: true, pCltHitFunc: 12, cHitCalc1: "100", cHitPar1: 0, cHitPar2: 100, cltHitSubMissile1: "firewall", cltHitSubMissile2: "firesmall", cltHitSubMissile3: "firemedium" },
  guidedarrow: { name: "guidedarrow", id: 86, vel: 24, maxVel: 24, range: 128, levRange: 0, celFile: "SafeArrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 3072, trans: 1, alwaysExplode: true },
  freezingarrow: { name: "freezingarrow", id: 87, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "IceArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 5, red: 81, green: 81, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 1, alwaysExplode: true, pierce: true, pCltHitFunc: 14, cltHitSubMissile1: "freezingarrowexp1", cltHitSubMissile2: "freezingarrowexp2" },
  freezingarrowexp1: { name: "freezingarrowexp1", id: 88, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "FreezeExplodeCenter", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 11, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  freezingarrowexp2: { name: "freezingarrowexp2", id: 89, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "FreezeExplodeEjecta", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  nova: { name: "nova", id: 90, vel: 24, maxVel: 24, accel: -1000, range: 13, levRange: 0, celFile: "ElectricNova", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 312, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "lightning", pCltHitFunc: 10 },
  iceblast: { name: "iceblast", id: 91, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "IceBlast", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "freezingarrowexp1", light: 7, red: 81, green: 81, blue: 255, speedPxPerSec: 300, distancePx: 600, trans: 1 },
  blessedhammer: { name: "blessedhammer", id: 92, vel: 18, maxVel: 30, accel: 250, range: 120, levRange: 0, celFile: "blessedhammer", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 5, red: 222, green: 222, blue: 255, speedPxPerSec: 450, distancePx: 2160, trans: 1, pierce: true },
  chainlightning: { name: "chainlightning", id: 93, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "lightning", pCltDoFunc: 8, cltParam1: 3, cltSubMissile1: "lightninghit", pCltHitFunc: 16 },
  fistofares: { name: "fistofares", id: 94, vel: 12, maxVel: 12, range: 128, levRange: 0, celFile: "FOAorbiter", animLen: 9, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1536, trans: 1 },
  chillblood: { name: "chillblood", id: 95, vel: 8, maxVel: 8, range: 128, levRange: 0, celFile: "ChillBlood", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 4, red: 81, green: 81, blue: 255, speedPxPerSec: 200, distancePx: 1024, trans: 1 },
  glacialspike: { name: "glacialspike", id: 96, vel: 16, maxVel: 16, range: 40, levRange: 0, celFile: "GlacialSpike", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 5, red: 81, green: 81, blue: 255, speedPxPerSec: 400, distancePx: 640, trans: 1, pCltHitFunc: 14, cltHitSubMissile1: "freezingarrowexp1", cltHitSubMissile2: "freezingarrowexp2" },
  teleport: { name: "teleport", id: 97, vel: 0, maxVel: 0, range: 18, levRange: 0, celFile: "Teleport", animLen: 18, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 6, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  lightningbolt: { name: "lightningbolt", id: 98, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, trans: 1, pCltDoFunc: 8, cltParam1: 3, cltSubMissile1: "lightninghit" },
  lightninghit: { name: "lightninghit", id: 99, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStop: 7, progOverlay: "lightning", pCltHitFunc: 10 },
  meteor: { name: "meteor", id: 100, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "Meteor", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 0 },
  meteorcenter: { name: "meteorcenter", id: 101, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "MeteorTargetIndicator", animLen: 17, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 64, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  meteortail: { name: "meteortail", id: 102, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "MeteorTail", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  meteorexplode: { name: "meteorexplode", id: 103, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "ExpArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 13, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  firesmall: { name: "firesmall", id: 104, vel: 0, maxVel: 0, range: 90, levRange: 25, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 2, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  firemedium: { name: "firemedium", id: 105, vel: 0, maxVel: 0, range: 90, levRange: 25, celFile: "groundFireMedium", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 3, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  monblizcenter: { name: "monblizcenter", id: 106, vel: 0, maxVel: 0, range: 25, levRange: 15, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 9, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, pCltDoFunc: 13, cltSubMissile1: "monbliz1", cltSubMissile2: "monbliz4" },
  monbliz1: { name: "monbliz1", id: 107, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "icestormfallvar01", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "monblizexplode1", cltHitSubMissile2: "monblizexplode3" },
  monbliz2: { name: "monbliz2", id: 108, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "icestormfallvar02", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "monblizexplode1", cltHitSubMissile2: "monblizexplode3" },
  monbliz3: { name: "monbliz3", id: 109, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "icestormfallvar03", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "monblizexplode1", cltHitSubMissile2: "monblizexplode3" },
  monbliz4: { name: "monbliz4", id: 110, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "icestormfallvar04", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "monblizexplode1", cltHitSubMissile2: "monblizexplode3" },
  monblizexplode1: { name: "monblizexplode1", id: 111, vel: 0, maxVel: 0, range: 6, levRange: 0, celFile: "icestormimpactvar01", animLen: 6, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  monblizexplode2: { name: "monblizexplode2", id: 112, vel: 0, maxVel: 0, range: 6, levRange: 0, celFile: "icestormimpactvar02", animLen: 6, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  monblizexplode3: { name: "monblizexplode3", id: 113, vel: 0, maxVel: 0, range: 6, levRange: 0, celFile: "icestormimpactvar02", animLen: 6, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  teeth: { name: "teeth", id: 114, vel: 16, maxVel: 16, range: 50, levRange: 0, celFile: "teethMissile", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "teethexplode", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 400, distancePx: 800, nextHit: 1, nextDelay: 4, trans: 1, subLoop: 1, subStop: 15 },
  corpseexplosion: { name: "corpseexplosion", id: 115, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "CorpseExplodeGuts", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0 },
  poisoncorpseexplosion: { name: "poisoncorpseexplosion", id: 116, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "CorpseExplodeGutsPoison", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0 },
  monstercorpseexplode: { name: "monstercorpseexplode", id: 117, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "CorpseExplodeGuts", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0 },
  poisonnova: { name: "poisonnova", id: 118, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "poisonNova", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 300, distancePx: 360, nextHit: 1, nextDelay: 4, trans: 1 },
  frostnova: { name: "frostnova", id: 119, vel: 24, maxVel: 24, accel: -1000, range: 14, levRange: 0, celFile: "FrostNova", animLen: 14, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 81, green: 81, blue: 255, speedPxPerSec: 600, distancePx: 336, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "ice_explode", pCltHitFunc: 10 },
  rogue1: { name: "rogue1", id: 120, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, alwaysExplode: true, pierce: true },
  rogue2: { name: "rogue2", id: 121, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "FireArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "fireexplode", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 600, distancePx: 960, trans: 1, alwaysExplode: true, pierce: true },
  rogue3: { name: "rogue3", id: 122, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "IceArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "iceexplode", light: 5, red: 81, green: 81, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 1, alwaysExplode: true, pierce: true },
  "bat lightning bolt": { name: "bat lightning bolt", id: 123, vel: 16, maxVel: 16, range: 16, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 400, distancePx: 256, trans: 1 },
  "bat lightning trail": { name: "bat lightning trail", id: 124, vel: 0, maxVel: 0, range: 10, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 2, subStop: 8 },
  skmage1: { name: "skmage1", id: 125, vel: 9, maxVel: 9, range: 40, levRange: 0, celFile: "poisonNova", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 225, distancePx: 360, trans: 1 },
  skmage2: { name: "skmage2", id: 126, vel: 12, maxVel: 12, range: 40, levRange: 0, celFile: "Icebolt", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "iceexplode", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 480, trans: 1 },
  skmage3: { name: "skmage3", id: 127, vel: 14, maxVel: 14, range: 40, levRange: 0, celFile: "Firebolt", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "fireexplode", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 350, distancePx: 560, trans: 1 },
  skmage4: { name: "skmage4", id: 128, vel: 14, maxVel: 14, range: 40, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 350, distancePx: 560, trans: 1 },
  vampirefireball: { name: "vampirefireball", id: 129, vel: 14, maxVel: 14, range: 30, levRange: 0, celFile: "Fireball", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "explodingarrowexp", light: 8, red: 255, green: 178, blue: 64, speedPxPerSec: 350, distancePx: 420, trans: 1, alwaysExplode: true, pCltHitFunc: 1, cHitPar1: 3, cHitPar2: 1, cltHitSubMissile1: "fireexplosion2" },
  vampirefirewallmaker: { name: "vampirefirewallmaker", id: 130, vel: 12, maxVel: 12, range: 10, levRange: 0, celFile: "groundFireBig", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 8, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 120, trans: 1, subLoop: 1, subStart: 1, subStop: 2 },
  vampirefirewall: { name: "vampirefirewall", id: 131, vel: 0, maxVel: 0, range: 90, levRange: 0, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 2, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  vampiremeteor: { name: "vampiremeteor", id: 132, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "Meteor", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 0 },
  vampiremeteorcenter: { name: "vampiremeteorcenter", id: 133, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "MeteorTargetIndicator", animLen: 17, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 64, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  vampiremeteorexp: { name: "vampiremeteorexp", id: 134, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "ExpArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 13, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  raven1: { name: "raven1", id: 135, vel: 16, maxVel: 16, range: 50, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 400, distancePx: 800 },
  raven2: { name: "raven2", id: 136, vel: 16, maxVel: 16, range: 50, levRange: 0, celFile: "FireArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "fireexplode", light: 9, red: 255, green: 178, blue: 64, speedPxPerSec: 400, distancePx: 800, trans: 1 },
  amphibiangoo1: { name: "amphibiangoo1", id: 137, vel: 12, maxVel: 12, range: 15, levRange: 0, celFile: "FrogPoisonMissile", animLen: 7, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 2, red: 64, green: 255, blue: 64, speedPxPerSec: 300, distancePx: 180, trans: 1 },
  amphibiangoo2: { name: "amphibiangoo2", id: 138, vel: 12, maxVel: 12, range: 18, levRange: 0, celFile: "FrogPoisonMissile", animLen: 7, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 2, red: 64, green: 255, blue: 64, speedPxPerSec: 300, distancePx: 216, trans: 1 },
  tentaclegoo: { name: "tentaclegoo", id: 139, vel: 12, maxVel: 12, range: 40, levRange: 0, celFile: "FrogPoisonMissile", animLen: 7, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "amphibianexplode", light: 2, red: 64, green: 255, blue: 64, speedPxPerSec: 300, distancePx: 480, trans: 1, alwaysExplode: true },
  amphibianexplode: { name: "amphibianexplode", id: 140, vel: 0, maxVel: 0, range: 15, levRange: 0, celFile: "GooHit", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  poisonpuff: { name: "poisonpuff", id: 141, vel: 1, maxVel: 15, range: 25, levRange: 0, celFile: "PoisonSmokePuff", animLen: 26, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 25, distancePx: 25, trans: 1 },
  curseeffectred: { name: "curseeffectred", id: 142, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 1, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  spidergoolay: { name: "spidergoolay", id: 143, vel: 1, maxVel: 1, range: 16, levRange: 0, celFile: "Spider_Goo_Missile", animLen: 17, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "spidergoo", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 25, distancePx: 16, trans: 1, alwaysExplode: true },
  fetishinferno1: { name: "fetishinferno1", id: 144, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "Flamethrower", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  fetishinferno2: { name: "fetishinferno2", id: 145, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "Flamethrower2", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  spidergoo: { name: "spidergoo", id: 146, vel: 0, maxVel: 0, range: 200, levRange: 0, celFile: "Spider_Goo_Disappear", animLen: 9, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStop: 1 },
  cursecast: { name: "cursecast", id: 147, vel: 3, maxVel: 5, range: 20, levRange: 0, celFile: "CurseCast", animLen: 25, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 1, red: 255, green: 0, blue: 0, speedPxPerSec: 75, distancePx: 60, trans: 1 },
  howl: { name: "howl", id: 148, vel: 12, maxVel: 12, accel: -1000, range: 12, levRange: 0, celFile: "BAYellShockWave01", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 192, green: 192, blue: 192, speedPxPerSec: 300, distancePx: 144, nextHit: 1, nextDelay: 4, trans: 1 },
  shout: { name: "shout", id: 149, vel: 30, maxVel: 30, accel: -500, range: 15, levRange: 0, celFile: "BAYellShockWave01", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 192, green: 192, blue: 192, speedPxPerSec: 750, distancePx: 450, nextHit: 1, nextDelay: 4, trans: 1 },
  dust: { name: "dust", id: 150, vel: 4, maxVel: 4, range: 100, levRange: 0, celFile: "FireSmoke", animLen: 26, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 100, distancePx: 400, trans: 1 },
  redlightmissile: { name: "redlightmissile", id: 151, vel: 0, maxVel: 0, range: 10, levRange: 10, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0 },
  greenlightmissile: { name: "greenlightmissile", id: 152, vel: 0, maxVel: 0, range: 10, levRange: 10, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 128, green: 255, blue: 128, speedPxPerSec: 0, distancePx: 0 },
  bluelightmissile: { name: "bluelightmissile", id: 153, vel: 0, maxVel: 0, range: 10, levRange: 10, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  whitelightmissile: { name: "whitelightmissile", id: 154, vel: 0, maxVel: 0, range: 10, levRange: 10, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  corpsepoisoncloud: { name: "corpsepoisoncloud", id: 155, vel: 0, maxVel: 0, range: 80, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 2, red: 128, green: 255, blue: 128, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19, pCltDoFunc: 4, param1: 2, param2: 4, cltParam1: 24, cltParam2: 1, cltParam3: 6, cltSubMissile1: "poisonpuff" },
  chillbloodcloud: { name: "chillbloodcloud", id: 156, vel: 4, maxVel: 4, range: 80, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 3, red: 81, green: 81, blue: 255, speedPxPerSec: 100, distancePx: 320, trans: 1 },
  chillbloodpuff: { name: "chillbloodpuff", id: 157, vel: 1, maxVel: 15, range: 25, levRange: 0, celFile: "ChillBloodPuff", animLen: 26, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 3, red: 81, green: 81, blue: 255, speedPxPerSec: 25, distancePx: 25, trans: 1 },
  blizzardcenter: { name: "blizzardcenter", id: 158, vel: 0, maxVel: 0, range: 100, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 9, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, pCltDoFunc: 13, cltSubMissile1: "blizzard1", cltSubMissile2: "blizzard4" },
  blizzard1: { name: "blizzard1", id: 159, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "icestormfallvar01", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "blizzardexplode1", cltHitSubMissile2: "blizzardexplode3" },
  blizzard2: { name: "blizzard2", id: 160, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "icestormfallvar02", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "blizzardexplode1", cltHitSubMissile2: "blizzardexplode3" },
  blizzard3: { name: "blizzard3", id: 161, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "Blizzard", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "blizzardexplode1", cltHitSubMissile2: "blizzardexplode3" },
  blizzard4: { name: "blizzard4", id: 162, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "Blizzard", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "blizzardexplode1", cltHitSubMissile2: "blizzardexplode3" },
  blizzardexplode1: { name: "blizzardexplode1", id: 163, vel: 0, maxVel: 0, range: 6, levRange: 0, celFile: "icestormimpactvar01", animLen: 6, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  blizzardexplode2: { name: "blizzardexplode2", id: 164, vel: 0, maxVel: 0, range: 6, levRange: 0, celFile: "icestormimpactvar02", animLen: 6, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  blizzardexplode3: { name: "blizzardexplode3", id: 165, vel: 0, maxVel: 0, range: 6, levRange: 0, celFile: "icestormimpactvar02", animLen: 6, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  thunderstorm1: { name: "thunderstorm1", id: 166, vel: 2, maxVel: 2, range: 9, levRange: 0, celFile: "LightningboltBig", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 10, red: 255, green: 255, blue: 255, speedPxPerSec: 50, distancePx: 18, trans: 1, alwaysExplode: true },
  thunderstorm2: { name: "thunderstorm2", id: 167, vel: 2, maxVel: 2, range: 9, levRange: 0, celFile: "LightningboltBig", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 10, red: 255, green: 255, blue: 255, speedPxPerSec: 50, distancePx: 18, trans: 1, alwaysExplode: true },
  thunderstorm3: { name: "thunderstorm3", id: 168, vel: 2, maxVel: 2, range: 9, levRange: 0, celFile: "LightningboltBig", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 10, red: 255, green: 255, blue: 255, speedPxPerSec: 50, distancePx: 18, trans: 1, alwaysExplode: true },
  thunderstorm4: { name: "thunderstorm4", id: 169, vel: 2, maxVel: 2, range: 9, levRange: 0, celFile: "LightningboltBig", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 10, red: 255, green: 255, blue: 255, speedPxPerSec: 50, distancePx: 18, trans: 1, alwaysExplode: true },
  monsterlight: { name: "monsterlight", id: 170, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, trans: 1, progOverlay: "lightning", pCltHitFunc: 10 },
  poisonball: { name: "poisonball", id: 171, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "poisonNova", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  diablight: { name: "diablight", id: 172, vel: 20, maxVel: 20, range: 30, levRange: 0, celFile: "DiabloLightning", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 600, nextDelay: 3, trans: 1, pierce: true, progOverlay: "diablolightning", pCltHitFunc: 10 },
  redemption: { name: "redemption", id: 173, vel: 0, maxVel: 0, range: 18, levRange: 0, celFile: "RedemptionGhost", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 6, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  redemptionfail: { name: "redemptionfail", id: 174, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "CorpseExplodeGuts", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0 },
  handofgod: { name: "handofgod", id: 175, vel: 2, maxVel: 2, range: 9, levRange: 0, celFile: "LightningBolt", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 10, red: 255, green: 255, blue: 255, speedPxPerSec: 50, distancePx: 18, trans: 1, alwaysExplode: true },
  diabfire: { name: "diabfire", id: 176, vel: 30, maxVel: 30, range: 50, levRange: 0, celFile: "groundFireBig", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 1500, nextHit: 1, nextDelay: 4, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  fingermagespider: { name: "fingermagespider", id: 177, vel: 6, maxVel: 6, range: 80, levRange: 0, celFile: "FingerMageSpider", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 178, blue: 178, speedPxPerSec: 150, distancePx: 480, trans: 1, progOverlay: "fingermagespiderexplode", pCltDoFunc: 15, pCltHitFunc: 10, cltParam1: 3, cltParam2: 20, cltParam3: 5, cltParam4: 20, cltParam5: 2, cltSubMissile1: "fingermagespider" },
  "electric throwaxe": { name: "electric throwaxe", id: 178, vel: 24, maxVel: 24, range: 20, levRange: 0, celFile: "MissileHandAxe", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 480, pierce: true, progOverlay: "lightning", pCltHitFunc: 10 },
  diabwallmaker: { name: "diabwallmaker", id: 179, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "groundFireMedium", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 3, red: 255, green: 178, blue: 64, speedPxPerSec: 500, distancePx: 1600, trans: 1, subLoop: 1, subStart: 1, subStop: 2 },
  diabwall: { name: "diabwall", id: 180, vel: 0, maxVel: 0, range: 36, levRange: 0, celFile: "groundFireMedium", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 3, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  curseamplifydamage: { name: "curseamplifydamage", id: 181, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  cursedimvision: { name: "cursedimvision", id: 182, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  curseweaken: { name: "curseweaken", id: 183, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  curseironmaiden: { name: "curseironmaiden", id: 184, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  curseterror: { name: "curseterror", id: 185, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  curseattract: { name: "curseattract", id: 186, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  cursereversevampire: { name: "cursereversevampire", id: 187, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  curseconfuse: { name: "curseconfuse", id: 188, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  cursedecrepify: { name: "cursedecrepify", id: 189, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  curselowerresist: { name: "curselowerresist", id: 190, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "CurseArea", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  cursecenter: { name: "cursecenter", id: 191, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  bonespear: { name: "bonespear", id: 192, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "BoneSpear", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "bonespearexplode", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 1 },
  bonespirit: { name: "bonespirit", id: 193, vel: 12, maxVel: 12, range: 128, levRange: 0, celFile: "BoneSpirit", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "bonespiritexplode", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1536, trans: 1, alwaysExplode: true },
  coldunique: { name: "coldunique", id: 194, vel: 24, maxVel: 24, accel: -1000, range: 14, levRange: 0, celFile: "FrostNova", animLen: 14, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 81, green: 81, blue: 255, speedPxPerSec: 600, distancePx: 336, nextHit: 1, nextDelay: 3, trans: 1 },
  lightunique: { name: "lightunique", id: 195, vel: 12, maxVel: 12, range: 98, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1176, trans: 1, subLoop: 1, subStart: 2, subStop: 8, pCltHitFunc: 10 },
  skbowarrow1: { name: "skbowarrow1", id: 196, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, pierce: true },
  skbowarrow2: { name: "skbowarrow2", id: 197, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, pierce: true },
  skbowarrow3: { name: "skbowarrow3", id: 198, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, pierce: true },
  skbowarrow4: { name: "skbowarrow4", id: 199, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "FireArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 600, distancePx: 960, trans: 1, pierce: true },
  skbowarrow5: { name: "skbowarrow5", id: 200, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "SafeArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 1, pierce: true },
  nova1: { name: "nova1", id: 201, vel: 24, maxVel: 24, accel: -1000, range: 13, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 312, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "lightning", pCltHitFunc: 10 },
  nova2: { name: "nova2", id: 202, vel: 24, maxVel: 24, accel: -1000, range: 13, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 312, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "lightning", pCltHitFunc: 10 },
  andypoisonbolt: { name: "andypoisonbolt", id: 203, vel: 20, maxVel: 20, range: 50, levRange: 0, celFile: "poisonNova", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 1000, trans: 1 },
  teethexplode: { name: "teethexplode", id: 204, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "teethexplode", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  lightningjavelin: { name: "lightningjavelin", id: 205, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "LightningJavelin", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 6, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, trans: 1, pierce: true, progOverlay: "lightning", pCltDoFunc: 1, pCltHitFunc: 10 },
  lightningfury: { name: "lightningfury", id: 206, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "LightningJavelin", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 6, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, trans: 1, pierce: true, pCltDoFunc: 1, pCltHitFunc: 25, cltHitSubMissile1: "furylightning" },
  bonewallmaker: { name: "bonewallmaker", id: 207, vel: 12, maxVel: 12, range: 7, levRange: 2, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 84, trans: 1 },
  necromage1: { name: "necromage1", id: 208, vel: 14, maxVel: 14, range: 30, levRange: 0, celFile: "poisonNova", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 350, distancePx: 420, trans: 1 },
  necromage2: { name: "necromage2", id: 209, vel: 14, maxVel: 14, range: 30, levRange: 0, celFile: "Icebolt", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 350, distancePx: 420, trans: 1 },
  necromage3: { name: "necromage3", id: 210, vel: 14, maxVel: 14, range: 30, levRange: 0, celFile: "Firebolt", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 350, distancePx: 420, trans: 1 },
  necromage4: { name: "necromage4", id: 211, vel: 14, maxVel: 14, range: 30, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 350, distancePx: 420, trans: 1 },
  sparkle: { name: "sparkle", id: 212, vel: 4, maxVel: 4, range: 30, levRange: 0, celFile: "Gleam", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 100, distancePx: 120, trans: 1 },
  multipleshotarrow: { name: "multipleshotarrow", id: 213, vel: 24, maxVel: 24, range: 50, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 1200, nextHit: 1, nextDelay: 4, pierce: true },
  multipleshotbolt: { name: "multipleshotbolt", id: 214, vel: 24, maxVel: 24, range: 50, levRange: 0, celFile: "XBowBolt", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 1200, nextHit: 1, nextDelay: 4, pierce: true },
  chargedstrikebolt: { name: "chargedstrikebolt", id: 215, vel: 12, maxVel: 12, range: 98, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1176, trans: 1, subLoop: 1, subStart: 2, subStop: 8, pCltHitFunc: 10 },
  bonespearexplode: { name: "bonespearexplode", id: 216, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "teethexplode", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  poisonexplosioncloud: { name: "poisonexplosioncloud", id: 217, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 128, green: 255, blue: 128, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19, pCltDoFunc: 4, param1: 2, param2: 4, cltParam1: 24, cltParam2: 1, cltParam3: 6, cltSubMissile1: "poisonpuff" },
  bonecast: { name: "bonecast", id: 218, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "BoneCast", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  battlecry: { name: "battlecry", id: 219, vel: 12, maxVel: 12, accel: -1000, range: 12, levRange: 0, celFile: "BAYellShockWave01", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 192, green: 192, blue: 192, speedPxPerSec: 300, distancePx: 144, nextHit: 1, nextDelay: 4, trans: 1 },
  primepoisoncloud: { name: "primepoisoncloud", id: 220, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19, pCltDoFunc: 4, param1: 2, param2: 4, cltParam1: 24, cltParam2: 1, cltParam3: 6, cltSubMissile1: "poisonpuff" },
  plaguejavcloud: { name: "plaguejavcloud", id: 221, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19, pCltDoFunc: 4, param1: 2, param2: 4, cltParam1: 24, cltParam2: 1, cltParam3: 6, cltSubMissile1: "poisonpuff" },
  rancidgascloud: { name: "rancidgascloud", id: 222, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19, pCltDoFunc: 4, param1: 2, param2: 4, cltParam1: 24, cltParam2: 1, cltParam3: 6, cltSubMissile1: "poisonpuff" },
  chokinggascloud: { name: "chokinggascloud", id: 223, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19, pCltDoFunc: 4, param1: 2, param2: 4, cltParam1: 24, cltParam2: 1, cltParam3: 6, cltSubMissile1: "poisonpuff" },
  stranglinggascloud: { name: "stranglinggascloud", id: 224, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19, pCltDoFunc: 4, param1: 2, param2: 4, cltParam1: 24, cltParam2: 1, cltParam3: 6, cltSubMissile1: "poisonpuff" },
  buglightning: { name: "buglightning", id: 225, vel: 12, maxVel: 12, range: 98, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1176, trans: 1, subLoop: 1, subStart: 2, subStop: 8, pCltHitFunc: 10 },
  pantherjav1: { name: "pantherjav1", id: 226, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 1600, pierce: true },
  pantherjav2: { name: "pantherjav2", id: 227, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 1600, pierce: true },
  pantherjav3: { name: "pantherjav3", id: 228, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 1600, pierce: true },
  pantherjav4: { name: "pantherjav4", id: 229, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 1600, pierce: true },
  immolationfire: { name: "immolationfire", id: 230, vel: 0, maxVel: 0, range: 100, levRange: 0, celFile: "groundFireBig", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  furylightning: { name: "furylightning", id: 231, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, trans: 1, subLoop: 1, subStop: 7, pCltDoFunc: 1 },
  lightningstrike: { name: "lightningstrike", id: 232, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "lightning", pCltDoFunc: 8, cltParam1: 3, cltSubMissile1: "lightninghit", pCltHitFunc: 16 },
  fistoftheheavensdelay: { name: "fistoftheheavensdelay", id: 233, vel: 0, maxVel: 0, range: 10, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  fistoftheheavensbolt: { name: "fistoftheheavensbolt", id: 234, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "HolyBoltMissile", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "teethexplode", light: 8, red: 222, green: 222, blue: 255, speedPxPerSec: 300, distancePx: 600, nextDelay: 4, trans: 1, pCltHitFunc: 9, cHitPar1: 1, cHitPar2: 1, cltHitSubMissile1: "teethexplode", collideFriend: 1, holy: 3 },
  warcry: { name: "warcry", id: 235, vel: 12, maxVel: 12, accel: -600, range: 16, levRange: 0, celFile: "WarcryShockwave", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 192, green: 192, blue: 192, speedPxPerSec: 300, distancePx: 192, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "doubledamage1", pCltHitFunc: 10 },
  battlecommand: { name: "battlecommand", id: 236, vel: 30, maxVel: 30, accel: -500, range: 15, levRange: 0, celFile: "BAYellShockWave01", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 192, green: 192, blue: 192, speedPxPerSec: 750, distancePx: 450, nextHit: 1, nextDelay: 4, trans: 1 },
  battleorders: { name: "battleorders", id: 237, vel: 30, maxVel: 30, accel: -500, range: 15, levRange: 0, celFile: "BAYellShockWave01", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 192, green: 192, blue: 192, speedPxPerSec: 750, distancePx: 450, nextHit: 1, nextDelay: 4, trans: 1 },
  pantherpotorange: { name: "pantherpotorange", id: 238, vel: 16, maxVel: 16, range: 128, levRange: 0, celFile: "mslops", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 128, blue: 128, speedPxPerSec: 400, distancePx: 2048, alwaysExplode: true, pCltDoFunc: 2, pCltHitFunc: 3, cltHitSubMissile1: "explodingarrowexp" },
  pantherpotgreen: { name: "pantherpotgreen", id: 239, vel: 16, maxVel: 16, range: 128, levRange: 0, celFile: "mslgps", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 128, green: 255, blue: 128, speedPxPerSec: 400, distancePx: 2048, alwaysExplode: true, pCltDoFunc: 2, pCltHitFunc: 28, cHitPar1: 1, cltHitSubMissile1: "rancidgascloud" },
  meteorfire: { name: "meteorfire", id: 240, vel: 0, maxVel: 0, range: 90, levRange: 0, celFile: "groundFireMedium", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 3, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  "trap spike right": { name: "trap spike right", id: 241, vel: 9, maxVel: 9, range: 50, levRange: 0, celFile: "SpikeRight", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 225, distancePx: 450 },
  "trap spike left": { name: "trap spike left", id: 242, vel: 9, maxVel: 9, range: 50, levRange: 0, celFile: "SpikeLeft", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 225, distancePx: 450 },
  "trap cursed skull right": { name: "trap cursed skull right", id: 243, vel: 6, maxVel: 6, range: 50, levRange: 0, celFile: "SkullRight", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 150, distancePx: 300 },
  "trap cursed skull left": { name: "trap cursed skull left", id: 244, vel: 6, maxVel: 6, range: 50, levRange: 0, celFile: "SkullLeft", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 150, distancePx: 300 },
  "trap poison ball right": { name: "trap poison ball right", id: 245, vel: 6, maxVel: 6, range: 50, levRange: 0, celFile: "PoisonRight", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 150, distancePx: 300 },
  "trap poison ball left": { name: "trap poison ball left", id: 246, vel: 6, maxVel: 6, range: 50, levRange: 0, celFile: "PoisonLeft", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 150, distancePx: 300 },
  hydra: { name: "hydra", id: 247, vel: 16, maxVel: 16, range: 30, levRange: 0, celFile: "Firebolt", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "fireexplode", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 400, distancePx: 480, trans: 1 },
  bonespeartrail: { name: "bonespeartrail", id: 248, vel: 0, maxVel: 0, range: 8, levRange: 0, celFile: "BoneSpearTrail", animLen: 9, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  grimwardsmallstart: { name: "grimwardsmallstart", id: 249, vel: 0, maxVel: 0, range: 5, levRange: 0, celFile: "GrimWardSmallStart", animLen: 5, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  grimwardsmall: { name: "grimwardsmall", id: 250, vel: 0, maxVel: 0, range: 200, levRange: 0, celFile: "GrimWardSmall", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  grimwardsmallstop: { name: "grimwardsmallstop", id: 251, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "GrimWardSmallStop", animLen: 9, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  grimwardmediumstart: { name: "grimwardmediumstart", id: 252, vel: 0, maxVel: 0, range: 8, levRange: 0, celFile: "GrimWardMediumStart", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  grimwardmedium: { name: "grimwardmedium", id: 253, vel: 0, maxVel: 0, range: 200, levRange: 0, celFile: "GrimWardMedium", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  grimwardmediumstop: { name: "grimwardmediumstop", id: 254, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "GrimWardMediumStop", animLen: 9, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  grimwardlargestart: { name: "grimwardlargestart", id: 255, vel: 0, maxVel: 0, range: 8, levRange: 0, celFile: "GrimWardLargeStart", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  grimwardlarge: { name: "grimwardlarge", id: 256, vel: 0, maxVel: 0, range: 200, levRange: 0, celFile: "GrimWardLarge", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  grimwardlargestop: { name: "grimwardlargestop", id: 257, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "GrimWardLargeStop", animLen: 9, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  zakarumlight: { name: "zakarumlight", id: 258, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStop: 7 },
  grimwardscare: { name: "grimwardscare", id: 259, vel: 2, maxVel: 2, range: 24, levRange: 12, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 50, distancePx: 48, nextHit: 1, nextDelay: 6, trans: 1 },
  frozenorb: { name: "frozenorb", id: 260, vel: 10, maxVel: 10, range: 30, levRange: 0, celFile: "IceOrb", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 6, red: 81, green: 81, blue: 255, speedPxPerSec: 250, distancePx: 300, trans: 1, alwaysExplode: true, pCltDoFunc: 19, cltParam1: 1, cltParam2: 19, cltSubMissile1: "frozenorbbolt", pCltHitFunc: 30, cHitPar1: 4, cltHitSubMissile1: "frozenorbnova" },
  frozenorbbolt: { name: "frozenorbbolt", id: 261, vel: 18, maxVel: 18, range: 25, levRange: 0, celFile: "IceBolt", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 4, red: 81, green: 81, blue: 255, speedPxPerSec: 450, distancePx: 450, trans: 1 },
  frozenorbnova: { name: "frozenorbnova", id: 262, vel: 24, maxVel: 24, range: 25, levRange: 0, celFile: "IceBolt", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 4, red: 81, green: 81, blue: 255, speedPxPerSec: 600, distancePx: 600, trans: 1, pCltDoFunc: 20, param1: 6, param2: 2, cltParam1: 6, cltParam2: 2 },
  frozenorbexplode: { name: "frozenorbexplode", id: 263, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "IceOrbExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 6, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  chillingarmorbolt: { name: "chillingarmorbolt", id: 264, vel: 18, maxVel: 18, range: 25, levRange: 0, celFile: "IceBolt", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 4, red: 81, green: 81, blue: 255, speedPxPerSec: 450, distancePx: 450, trans: 1 },
  fireexplosion2: { name: "fireexplosion2", id: 265, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "FireArrowExplode2", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, randStart: 5 },
  blowgun: { name: "blowgun", id: 266, vel: 20, maxVel: 20, range: 90, levRange: 0, celFile: "Blowdart", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 1800, pierce: true },
  chainlightning2: { name: "chainlightning2", id: 267, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "lightning", pCltHitFunc: 16 },
  revivesmall: { name: "revivesmall", id: 268, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "Revive", animLen: 25, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  revivemedium: { name: "revivemedium", id: 269, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "Revive", animLen: 25, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  revivelarge: { name: "revivelarge", id: 270, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "Revive", animLen: 25, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  monglacialspike: { name: "monglacialspike", id: 271, vel: 18, maxVel: 18, range: 40, levRange: 0, celFile: "GlacialSpike", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 5, red: 81, green: 81, blue: 255, speedPxPerSec: 450, distancePx: 720, trans: 1, pCltHitFunc: 14, cltHitSubMissile1: "freezingarrowexp1", cltHitSubMissile2: "freezingarrowexp2" },
  icebreaksmall: { name: "icebreaksmall", id: 272, vel: 0, maxVel: 0, range: 30, levRange: 0, celFile: "IceBreakSmall", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 31 },
  icebreakmedium: { name: "icebreakmedium", id: 273, vel: 0, maxVel: 0, range: 30, levRange: 0, celFile: "IceBreakLarge", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 31 },
  icebreaklarge: { name: "icebreaklarge", id: 274, vel: 0, maxVel: 0, range: 30, levRange: 0, celFile: "IceBreakLarge", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltHitFunc: 31 },
  icebreaksmoke: { name: "icebreaksmoke", id: 275, vel: 0, maxVel: 0, range: 15, levRange: 0, celFile: "IceBreakSmoke", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  mephisto: { name: "mephisto", id: 276, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "MephistoMissile", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "mephistoexplosion", light: 9, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 1 },
  firehead: { name: "firehead", id: 277, vel: 14, maxVel: 14, range: 40, levRange: 0, celFile: "VampireMissile", animLen: 19, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 8, red: 255, green: 178, blue: 64, speedPxPerSec: 350, distancePx: 560, trans: 1, alwaysExplode: true, progOverlay: "vampiresteal", pCltHitFunc: 32, cltHitSubMissile1: "explodingarrowexp" },
  whilrwind: { name: "whilrwind", id: 278, vel: 12, maxVel: 12, range: 3, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 300, distancePx: 36 },
  arcanelightningbolt: { name: "arcanelightningbolt", id: 279, vel: 32, maxVel: 32, range: 40, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 8, red: 178, green: 178, blue: 255, speedPxPerSec: 800, distancePx: 1280, trans: 1 },
  frogfire: { name: "frogfire", id: 280, vel: 15, maxVel: 15, range: 40, levRange: 0, celFile: "Fireball", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 4, red: 255, green: 64, blue: 64, speedPxPerSec: 375, distancePx: 600, trans: 1 },
  frogcold: { name: "frogcold", id: 281, vel: 12, maxVel: 12, range: 35, levRange: 0, celFile: "Icebolt", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "iceexplode", light: 4, red: 64, green: 64, blue: 255, speedPxPerSec: 300, distancePx: 420, trans: 1 },
  frogpois: { name: "frogpois", id: 282, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "FrogPoisonMissile", animLen: 7, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 4, red: 64, green: 255, blue: 64, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  desertfireball: { name: "desertfireball", id: 283, vel: 16, maxVel: 16, range: 40, levRange: 0, celFile: "Fireball", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "explodingarrowexp", light: 6, red: 255, green: 64, blue: 64, speedPxPerSec: 400, distancePx: 640, trans: 1 },
  brdeathcontrol: { name: "brdeathcontrol", id: 284, vel: 0, maxVel: 0, range: 375, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 6, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  brdeathlightningbolt: { name: "brdeathlightningbolt", id: 285, vel: 32, maxVel: 32, range: 20, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 800, distancePx: 640, trans: 1 },
  brdeathlightninghit: { name: "brdeathlightninghit", id: 286, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStop: 7 },
  denofevillight: { name: "denofevillight", id: 287, vel: 0, maxVel: 0, range: 300, levRange: 0, celFile: "LightBeams", animLen: 21, animSpeed: 16, loopAnim: 1, numDirections: 4, explosionMissile: "", light: 10, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  cairnstones: { name: "cairnstones", id: 288, vel: 0, maxVel: 0, range: 300, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  cairnstonessky: { name: "cairnstonessky", id: 289, vel: 0, maxVel: 0, range: 5, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  cairnstonesground: { name: "cairnstonesground", id: 290, vel: 20, maxVel: 20, range: 30, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 600, trans: 1, alwaysExplode: true },
  towermist: { name: "towermist", id: 291, vel: 2, maxVel: 2, range: 400, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 2, red: 255, green: 255, blue: 255, speedPxPerSec: 50, distancePx: 800, trans: 1, alwaysExplode: true, pCltDoFunc: 25, cltParam1: 10, cltParam2: 3, cltParam3: 1, cltSubMissile1: "towermisttrail" },
  towermisttrail: { name: "towermisttrail", id: 292, vel: 3, maxVel: 3, range: 50, levRange: 0, celFile: "mist", animLen: 14, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "towermistfade", light: 2, red: 255, green: 255, blue: 255, speedPxPerSec: 75, distancePx: 150, trans: 1, pCltDoFunc: 1 },
  brdeathsmokes1: { name: "brdeathsmokes1", id: 293, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "BRSmokeS1", animLen: 20, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "brdeathsmokenu", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  brdeathsmokenu: { name: "brdeathsmokenu", id: 294, vel: 0, maxVel: 0, range: 340, levRange: 0, celFile: "BRSmokeNU", animLen: 20, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "brdeathsmokedt", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  brdeathsmokedt: { name: "brdeathsmokedt", id: 295, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "BRSmokeDT", animLen: 20, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  brdeathspirits1: { name: "brdeathspirits1", id: 296, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "BRSpiritS1", animLen: 20, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "brdeathspiritnu", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  brdeathspiritnu: { name: "brdeathspiritnu", id: 297, vel: 0, maxVel: 0, range: 340, levRange: 0, celFile: "BRSpiritNU", animLen: 20, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "brdeathspiritdt", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  brdeathspiritdt: { name: "brdeathspiritdt", id: 298, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "BRSpiritDT", animLen: 20, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  mephistodeathcontrol: { name: "mephistodeathcontrol", id: 299, vel: 0, maxVel: 0, range: 275, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 6, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  mephistofirewallmaker: { name: "mephistofirewallmaker", id: 300, vel: 8, maxVel: 8, range: 50, levRange: 0, celFile: "groundFireSmall", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 200, distancePx: 400, trans: 1, subLoop: 1, subStart: 1, subStop: 2 },
  mephistofirewall: { name: "mephistofirewall", id: 301, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  mephistoflyingrocksbig: { name: "mephistoflyingrocksbig", id: 302, vel: 12, maxVel: 12, range: 10, levRange: 3, celFile: "ExplosionSpark", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "mephistoexplosionbig", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 300, distancePx: 120, alwaysExplode: true },
  mephistoexplosionbig: { name: "mephistoexplosionbig", id: 303, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "FireArrowExplode2", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 13, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  mephistoflyingrockssmall: { name: "mephistoflyingrockssmall", id: 304, vel: 12, maxVel: 12, range: 5, levRange: 3, celFile: "ExplosionSparkSmall", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "mephistoexplosionsmall", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 300, distancePx: 60, alwaysExplode: true },
  mephistoexplosionsmall: { name: "mephistoexplosionsmall", id: 305, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "FireArrowExplode2", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 13, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  mephistodonotdraw: { name: "mephistodonotdraw", id: 306, vel: 0, maxVel: 0, range: 70, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  andycontrol0: { name: "andycontrol0", id: 307, vel: 0, maxVel: 0, range: 350, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  andyfirewallmaker: { name: "andyfirewallmaker", id: 308, vel: 8, maxVel: 8, range: 50, levRange: 0, celFile: "groundFireSmall", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 8, red: 255, green: 178, blue: 64, speedPxPerSec: 200, distancePx: 400, trans: 1, subLoop: 1, subStart: 1, subStop: 2 },
  andyfirewall: { name: "andyfirewall", id: 309, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  andycolumnfirebase: { name: "andycolumnfirebase", id: 310, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "groundFireMedium", animLen: 37, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  andycolumnfire: { name: "andycolumnfire", id: 311, vel: 0, maxVel: 0, range: 15, levRange: 0, celFile: "AndarielFlameDeath", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 192, green: 128, blue: 128, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  andyfallingdebris1: { name: "andyfallingdebris1", id: 312, vel: 0, maxVel: 0, range: 8, levRange: 0, celFile: "CeilingChunkFall01", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "andydebrisexplosion1", cltHitSubMissile2: "andydebrisexplosion5" },
  andyfallingdebris2: { name: "andyfallingdebris2", id: 313, vel: 0, maxVel: 0, range: 8, levRange: 0, celFile: "CeilingChunkFall02", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "andydebrisexplosion1", cltHitSubMissile2: "andydebrisexplosion5" },
  andyfallingdebris3: { name: "andyfallingdebris3", id: 314, vel: 0, maxVel: 0, range: 8, levRange: 0, celFile: "CeilingChunkFall03", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true, pCltHitFunc: 19, cltHitSubMissile1: "andydebrisexplosion1", cltHitSubMissile2: "andydebrisexplosion5" },
  andydebrisexplosion1: { name: "andydebrisexplosion1", id: 315, vel: 0, maxVel: 0, range: 11, levRange: 0, celFile: "CeilingChunkVanish01", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  andydebrisexplosion2: { name: "andydebrisexplosion2", id: 316, vel: 0, maxVel: 0, range: 11, levRange: 0, celFile: "CeilingChunkVanish02", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  andydebrisexplosion3: { name: "andydebrisexplosion3", id: 317, vel: 0, maxVel: 0, range: 11, levRange: 0, celFile: "CeilingChunkRemain01", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  andydebrisexplosion4: { name: "andydebrisexplosion4", id: 318, vel: 0, maxVel: 0, range: 11, levRange: 0, celFile: "CeilingChunkRemain02", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  andydebrisexplosion5: { name: "andydebrisexplosion5", id: 319, vel: 0, maxVel: 0, range: 11, levRange: 0, celFile: "CeilingChunkRemain03", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  willowisplightningbolt: { name: "willowisplightningbolt", id: 320, vel: 32, maxVel: 32, range: 40, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 8, red: 178, green: 178, blue: 255, speedPxPerSec: 800, distancePx: 1280, trans: 1 },
  queenpoisoncloud: { name: "queenpoisoncloud", id: 321, vel: 8, maxVel: 64, accel: 400, range: 92, levRange: 0, celFile: "poisonNova", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 4, red: 64, green: 255, blue: 64, speedPxPerSec: 200, distancePx: 736, trans: 1 },
  "dirt pile": { name: "dirt pile", id: 322, vel: 0, maxVel: 0, range: 128, levRange: 0, celFile: "SandMaggotDirtPile", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  undeadmissile1: { name: "undeadmissile1", id: 323, vel: 20, maxVel: 20, range: 40, levRange: 0, celFile: "SkullPoison", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 9, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 800, trans: 1 },
  undeadmissile2: { name: "undeadmissile2", id: 324, vel: 20, maxVel: 20, range: 40, levRange: 0, celFile: "SkullFire", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 9, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 800, trans: 1 },
  undeadmissile3: { name: "undeadmissile3", id: 325, vel: 20, maxVel: 20, range: 40, levRange: 0, celFile: "SkullIce", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 9, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 800, trans: 1 },
  undeadmissile4: { name: "undeadmissile4", id: 326, vel: 20, maxVel: 20, range: 40, levRange: 0, celFile: "SkullUnholy", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 9, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 800, trans: 1 },
  bonespiritexplode: { name: "bonespiritexplode", id: 327, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "BoneSpiritExplode", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  dopplezonexplode: { name: "dopplezonexplode", id: 328, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "DopplezonExplode", animLen: 25, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  monbonespirit: { name: "monbonespirit", id: 329, vel: 12, maxVel: 12, range: 128, levRange: 0, celFile: "BoneSpirit", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "bonespiritexplode", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1536, trans: 1, alwaysExplode: true },
  towermistfade: { name: "towermistfade", id: 330, vel: 0, maxVel: 0, range: 128, levRange: 1, celFile: "Mist_fade", animLen: 14, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  countessfirewall: { name: "countessfirewall", id: 331, vel: 0, maxVel: 0, range: 1000, levRange: 1, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  towerchestspawner: { name: "towerchestspawner", id: 332, vel: 0, maxVel: 0, range: 400, levRange: 1, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 15, red: 192, green: 192, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true, pCltDoFunc: 30, param1: 150, param2: 2, param3: 5, cltParam1: 150, cltParam2: 2, cltParam3: 5, cltSubMissile1: "towermisttrail" },
  hellmeteorlaunch1: { name: "hellmeteorlaunch1", id: 333, vel: 0, maxVel: 0, range: 22, levRange: 0, celFile: "meteorlavaburst", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  hellmeteorlaunch2: { name: "hellmeteorlaunch2", id: 334, vel: 0, maxVel: 0, range: 22, levRange: 0, celFile: "meteorlavaburst2", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  hellmeteorup: { name: "hellmeteorup", id: 335, vel: 0, maxVel: 0, range: 50, levRange: 0, celFile: "meteorlavaup", animLen: 9, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  hellmeteordown: { name: "hellmeteordown", id: 336, vel: 0, maxVel: 0, range: 225, levRange: 0, celFile: "meteorlavadown", animLen: 9, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  hellmeteorball: { name: "hellmeteorball", id: 337, vel: 0, maxVel: 0, range: 225, levRange: 0, celFile: "meteorlavarock", animLen: 9, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  horadricstaff: { name: "horadricstaff", id: 338, vel: 0, maxVel: 0, range: 440, levRange: 0, celFile: "HoradricStaff", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  horadriclightning: { name: "horadriclightning", id: 339, vel: 20, maxVel: 20, range: 30, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 600, trans: 1 },
  horadriclight: { name: "horadriclight", id: 340, vel: 0, maxVel: 0, range: 225, levRange: 0, celFile: "HoradricLightBeamstreaks", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 2, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  regurgitatorcorpse: { name: "regurgitatorcorpse", id: 341, vel: 14, maxVel: 14, range: 200, levRange: 0, celFile: "SlugMissile", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "regurgitatorcorpseexpl", light: 2, red: 255, green: 64, blue: 64, speedPxPerSec: 350, distancePx: 2800, trans: 1, alwaysExplode: true },
  regurgitatorcorpseexpl: { name: "regurgitatorcorpseexpl", id: 342, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "Slug Missile Explode", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 13, red: 255, green: 64, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  highpriestlightning: { name: "highpriestlightning", id: 343, vel: 20, maxVel: 20, range: 15, levRange: 0, celFile: "HighPriestLightning", animLen: 9, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 1, red: 255, green: 64, blue: 64, speedPxPerSec: 500, distancePx: 300, trans: 1, alwaysExplode: true },
  icebreaksmallmelt: { name: "icebreaksmallmelt", id: 344, vel: 0, maxVel: 0, range: 150, levRange: 0, celFile: "IceBreakSmallMelt", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  icebreaklargemelt: { name: "icebreaklargemelt", id: 345, vel: 0, maxVel: 0, range: 150, levRange: 0, celFile: "IceBreakLargeMelt", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  leapknockback: { name: "leapknockback", id: 346, vel: 0, maxVel: 0, range: 2, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  radamentdeath: { name: "radamentdeath", id: 347, vel: 0, maxVel: 0, range: 400, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 15, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  radamenthandofgod: { name: "radamenthandofgod", id: 348, vel: 0, maxVel: 0, range: 21, levRange: 0, celFile: "HandOfGod", animLen: 21, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  radamentholybolt: { name: "radamentholybolt", id: 349, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "HolyBoltMissile", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 600, trans: 1 },
  taintedsuncontrol: { name: "taintedsuncontrol", id: 350, vel: 0, maxVel: 0, range: 300, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  taintedsunflash: { name: "taintedsunflash", id: 351, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "yellowBallGlowIntro", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  taintedsunball: { name: "taintedsunball", id: 352, vel: 12, maxVel: 12, range: 300, levRange: 0, celFile: "yellowBallGlow2", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 3600, trans: 1 },
  queendeathcenter: { name: "queendeathcenter", id: 353, vel: 0, maxVel: 0, range: 100, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  queendeathglob: { name: "queendeathglob", id: 354, vel: 6, maxVel: 6, range: 20, levRange: 0, celFile: "QueenDeathGuts", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 150, distancePx: 120, alwaysExplode: true },
  queendeathsplat1: { name: "queendeathsplat1", id: 355, vel: 0, maxVel: 0, range: 50, levRange: 0, celFile: "QueenDeathPuddle", animLen: 5, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  queendeathsplat2: { name: "queendeathsplat2", id: 356, vel: 0, maxVel: 0, range: 50, levRange: 0, celFile: "QueenDeathPuddle2", animLen: 5, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  healingbolt: { name: "healingbolt", id: 357, vel: 14, maxVel: 14, range: 30, levRange: 0, celFile: "HolyBoltMissile", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 2, red: 222, green: 222, blue: 255, speedPxPerSec: 350, distancePx: 420, trans: 1 },
  mephistoholedelay: { name: "mephistoholedelay", id: 358, vel: 0, maxVel: 0, range: 50, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "mephistoholebirth", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  mephistoholebirth: { name: "mephistoholebirth", id: 359, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "smithholebirth", animLen: 21, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "mephistoholeneutral", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  mephistoholeneutral: { name: "mephistoholeneutral", id: 360, vel: 0, maxVel: 0, range: 225, levRange: 0, celFile: "smithholeneutral", animLen: 21, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "mephistoholedeath", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  mephistoholedeath: { name: "mephistoholedeath", id: 361, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "smithholedeath", animLen: 21, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "mephistoholedead", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  mephistoholedead: { name: "mephistoholedead", id: 362, vel: 0, maxVel: 0, range: 400, levRange: 0, celFile: "smithholedead", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  durieldeathcontrol: { name: "durieldeathcontrol", id: 363, vel: 0, maxVel: 0, range: 400, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  durieldeathrock: { name: "durieldeathrock", id: 364, vel: 0, maxVel: 0, range: 40, levRange: 0, celFile: "Rock_large", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  durieldeathdebris: { name: "durieldeathdebris", id: 365, vel: 12, maxVel: 12, range: 40, levRange: 0, celFile: "Rock_small", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 300, distancePx: 480, alwaysExplode: true },
  durieldeathsmoke: { name: "durieldeathsmoke", id: 366, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "FireSmoke", animLen: 26, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  mephistoexplosion: { name: "mephistoexplosion", id: 367, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "MephistoMissileExplosion", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  orbmist: { name: "orbmist", id: 368, vel: 2, maxVel: 2, range: 400, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 2, red: 255, green: 125, blue: 125, speedPxPerSec: 50, distancePx: 800, trans: 1, alwaysExplode: true, pCltDoFunc: 25, cltParam1: 10, cltParam2: 3, cltParam3: 1, cltSubMissile1: "orbmisttrail" },
  orbmisttrail: { name: "orbmisttrail", id: 369, vel: 3, maxVel: 3, range: 50, levRange: 0, celFile: "mist_Fade_Orb_Loop", animLen: 14, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "orbmistfade", light: 2, red: 255, green: 125, blue: 125, speedPxPerSec: 75, distancePx: 150, trans: 1, alwaysExplode: true, pCltDoFunc: 1 },
  orbmistfade: { name: "orbmistfade", id: 370, vel: 3, maxVel: 3, range: 15, levRange: 0, celFile: "mist_Fade_Orb", animLen: 14, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 2, red: 255, green: 125, blue: 125, speedPxPerSec: 75, distancePx: 45, trans: 1 },
  pilum: { name: "pilum", id: 371, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Pilum", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, pierce: true },
  "diablo appears": { name: "diablo appears", id: 372, vel: 0, maxVel: 0, range: 300, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  hfcontrol: { name: "hfcontrol", id: 373, vel: 0, maxVel: 0, range: 200, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 8, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  hffragment1: { name: "hffragment1", id: 374, vel: 6, maxVel: 6, range: 16, levRange: 0, celFile: "SoulForgeShard", animLen: 47, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 150, distancePx: 96, trans: 1, subLoop: 1, subStart: 8, subStop: 30, alwaysExplode: true },
  hffragment2: { name: "hffragment2", id: 375, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "SoulForgeShard", animLen: 47, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 8, subStop: 30, alwaysExplode: true },
  hffragment3: { name: "hffragment3", id: 376, vel: 0, maxVel: 0, range: 10, levRange: 0, celFile: "SoulForgeShard", animLen: 47, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 8, subStop: 30, alwaysExplode: true },
  hfspirit1: { name: "hfspirit1", id: 377, vel: 8, maxVel: 4, range: 55, levRange: 0, celFile: "SoulForgeRisingSoul", animLen: 33, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 200, distancePx: 440, trans: 1, subLoop: 1, subStart: 8, subStop: 19, alwaysExplode: true },
  hfreserved3: { name: "hfreserved3", id: 378, vel: 0, maxVel: 0, range: 0, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  "izual control": { name: "izual control", id: 379, vel: 0, maxVel: 0, range: 200, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  "izual mist loop": { name: "izual mist loop", id: 380, vel: 4, maxVel: 4, range: 50, levRange: 0, celFile: "IzualDeathClouds", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "izual mist fade", light: 2, red: 255, green: 255, blue: 255, speedPxPerSec: 100, distancePx: 200, trans: 1, alwaysExplode: true },
  "izual mist fade": { name: "izual mist fade", id: 381, vel: 0, maxVel: 0, range: 15, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "izual lightning": { name: "izual lightning", id: 382, vel: 3, maxVel: 3, range: 50, levRange: 0, celFile: "IzualDeathParticles", animLen: 25, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 2, red: 255, green: 255, blue: 255, speedPxPerSec: 75, distancePx: 150, trans: 1 },
  "izual lightning trail": { name: "izual lightning trail", id: 383, vel: 3, maxVel: 3, range: 50, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 75, distancePx: 150, trans: 1 },
  "cairn stones bolt": { name: "cairn stones bolt", id: 384, vel: 0, maxVel: 0, range: 9, levRange: 0, celFile: "LightningboltBig", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 10, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  "bomb in air": { name: "bomb in air", id: 385, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "expansion\\FireTraumaMissile", animLen: 20, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 600, alwaysExplode: true },
  "bomb on ground": { name: "bomb on ground", id: 386, vel: 0, maxVel: 0, range: 5, levRange: 0, celFile: "expansion\\FireTraumaGround", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "bomb explosion", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "bomb explosion": { name: "bomb explosion", id: 387, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "expansion\\FireTraumaXplosion", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "shock field in air": { name: "shock field in air", id: 388, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "expansion\\caltrops", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 600, subLoop: 1, subStop: 7, alwaysExplode: true },
  "shock field on ground": { name: "shock field on ground", id: 389, vel: 0, maxVel: 0, range: 90, levRange: 0, celFile: "Expansion\\ShockField", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, nextHit: 1, nextDelay: 25, trans: 1 },
  throwingstar: { name: "throwingstar", id: 390, vel: 24, maxVel: 24, range: 100, levRange: 50, celFile: "expansion\\ThrowingStarMissile", animLen: 7, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 2400, trans: 1, subLoop: 1, subStart: 4, subStop: 7 },
  acidspray: { name: "acidspray", id: 391, vel: 12, maxVel: 12, range: 6, levRange: 2, celFile: "frogpoisonmissile", animLen: 7, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 72, trans: 1, alwaysExplode: true },
  "blade creeper": { name: "blade creeper", id: 392, vel: 0, maxVel: 0, range: 10, levRange: 5, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, nextHit: 1, nextDelay: 25, trans: 1 },
  distraction: { name: "distraction", id: 393, vel: 0, maxVel: 0, range: 100, levRange: 0, celFile: "BigheadLightningMissile", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "distraction fog": { name: "distraction fog", id: 394, vel: 0, maxVel: 0, range: 10, levRange: 5, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "distraction puff": { name: "distraction puff", id: 395, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "FireSmoke", animLen: 26, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "distraction start": { name: "distraction start", id: 396, vel: 0, maxVel: 0, range: 11, levRange: 0, celFile: "ExpArrowExplode", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "distraction end": { name: "distraction end", id: 397, vel: 0, maxVel: 0, range: 11, levRange: 0, celFile: "ExpArrowExplode", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  impinfernoflame1: { name: "impinfernoflame1", id: 398, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Flamethrower", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 500, distancePx: 1600, trans: 1 },
  impinfernoflame2: { name: "impinfernoflame2", id: 399, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Flamethrower2", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 500, distancePx: 1600, trans: 1 },
  baallightningbolt: { name: "baallightningbolt", id: 400, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  baallightningtrail: { name: "baallightningtrail", id: 401, vel: 0, maxVel: 0, range: 5, levRange: 0, celFile: "expansion\\lightningpiece", animLen: 1, animSpeed: 16, loopAnim: 2, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  baallightningbolt2: { name: "baallightningbolt2", id: 402, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  baallightningtrail2: { name: "baallightningtrail2", id: 403, vel: 0, maxVel: 0, range: 5, levRange: 0, celFile: "expansion\\lightningpiece", animLen: 1, animSpeed: 16, loopAnim: 2, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  impfireball: { name: "impfireball", id: 404, vel: 18, maxVel: 18, range: 50, levRange: 0, celFile: "expansion\\ImpFireball", animLen: 20, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "impfireballexplode", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 450, distancePx: 900, trans: 1, alwaysExplode: true },
  impfireballexplode: { name: "impfireballexplode", id: 405, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "ExpArrowExplode", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "catapultchargedball on": { name: "catapultchargedball on", id: 406, vel: 0, maxVel: 0, range: 10, levRange: 0, celFile: "BigheadLightningMissile", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  catapultchargedball: { name: "catapultchargedball", id: 407, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "BigheadLightningMissile", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  catapultchargedballbolt: { name: "catapultchargedballbolt", id: 408, vel: 12, maxVel: 12, range: 20, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 240, trans: 1, subLoop: 1, subStart: 2, subStop: 8, progOverlay: "lightning", pCltHitFunc: 10 },
  "imp spawn monsters": { name: "imp spawn monsters", id: 409, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "ExpArrowExplode", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "catapult spike ball on": { name: "catapult spike ball on", id: 410, vel: 0, maxVel: 0, range: 50, levRange: 0, celFile: "Meteor", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  "catapult spike ball": { name: "catapult spike ball", id: 411, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "Meteor", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, subLoop: 1, subStop: 7, alwaysExplode: true },
  "catapult spike in air": { name: "catapult spike in air", id: 412, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "expansion\\FireSpikes", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 600, subLoop: 1, subStop: 7, alwaysExplode: true },
  "catapult spike on ground": { name: "catapult spike on ground", id: 413, vel: 0, maxVel: 0, range: 180, levRange: 0, celFile: "expansion\\FireSpikesGround", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "catapult spike explosion", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "catapult spike explosion": { name: "catapult spike explosion", id: 414, vel: 0, maxVel: 0, range: 36, levRange: 0, celFile: "expansion\\FireSpikeExplode", animLen: 14, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  "catapult cold ball on": { name: "catapult cold ball on", id: 415, vel: 0, maxVel: 0, range: 50, levRange: 0, celFile: "IceOrb", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "catapult cold ball": { name: "catapult cold ball", id: 416, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "IceOrb", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  "catapult cold explosion": { name: "catapult cold explosion", id: 417, vel: 6, maxVel: 6, range: 15, levRange: 0, celFile: "IceBreakLarge", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 150, distancePx: 90, trans: 1, alwaysExplode: true, pCltHitFunc: 31 },
  "catapult plague ball on": { name: "catapult plague ball on", id: 418, vel: 0, maxVel: 0, range: 50, levRange: 0, celFile: "expansion\\catapultpoisonbomb", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "catapult plague ball": { name: "catapult plague ball", id: 419, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "expansion\\catapultpoisonbomb", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  "catapult plague cloud": { name: "catapult plague cloud", id: 420, vel: 0, maxVel: 0, range: 80, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 128, green: 255, blue: 128, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19, alwaysExplode: true },
  "catapult meteor ball on": { name: "catapult meteor ball on", id: 421, vel: 0, maxVel: 0, range: 50, levRange: 0, celFile: "Meteor", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "catapult meteor ball": { name: "catapult meteor ball", id: 422, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "Meteor", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  "catapult meteor fire": { name: "catapult meteor fire", id: 423, vel: 0, maxVel: 0, range: 90, levRange: 25, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  "tower death": { name: "tower death", id: 424, vel: 0, maxVel: 0, range: 1, levRange: 0, celFile: "expansion\\TowerDebris", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, pCltDoFunc: 11 },
  "healing vortex": { name: "healing vortex", id: 425, vel: 12, maxVel: 12, range: 100, levRange: 25, celFile: "expansion\\overseer_missile", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 1200, trans: 1, progOverlay: "healing", collideFriend: 1 },
  suicidecorpseexplode: { name: "suicidecorpseexplode", id: 426, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "CorpseExplodeGuts", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0 },
  suicidefireexplode: { name: "suicidefireexplode", id: 427, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "Fsexplode", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  suicideiceexplode: { name: "suicideiceexplode", id: 428, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "FreezeExplodeCenter", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  explodingjavalin: { name: "explodingjavalin", id: 429, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "explodingjavalinexp", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, alwaysExplode: true, pierce: true },
  explodingjavalinexp: { name: "explodingjavalinexp", id: 430, vel: 25, maxVel: 25, range: 12, levRange: 0, celFile: "ExpArrowExplode", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 15, red: 255, green: 178, blue: 64, speedPxPerSec: 625, distancePx: 300, trans: 1 },
  lightingtrailingjavalin: { name: "lightingtrailingjavalin", id: 431, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "lightjavalinexplosion", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, alwaysExplode: true },
  lightjavalintrail: { name: "lightjavalintrail", id: 432, vel: 12, maxVel: 12, range: 20, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 240, trans: 1, subLoop: 1, subStart: 2, subStop: 8 },
  lightjavalinexplosion: { name: "lightjavalinexplosion", id: 433, vel: 12, maxVel: 12, range: 20, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 240, trans: 1, subLoop: 1, subStart: 2, subStop: 8 },
  icejavalin: { name: "icejavalin", id: 434, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "icejavalinexplode", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, alwaysExplode: true, pierce: true },
  icejavalinexplode: { name: "icejavalinexplode", id: 435, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "IceArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 11, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  plaguejavelin2: { name: "plaguejavelin2", id: 436, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "plaguejavlinexplode", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, alwaysExplode: true, pierce: true },
  plaguejavlinexplode: { name: "plaguejavlinexplode", id: 437, vel: 0, maxVel: 15, range: 25, levRange: 0, celFile: "PoisonSmokePuff", animLen: 26, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  advlighttrailingjav: { name: "advlighttrailingjav", id: 438, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "advlightjavexplode", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960 },
  advlighttrailingjav2: { name: "advlighttrailingjav2", id: 439, vel: 12, maxVel: 12, range: 20, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 240, trans: 1, subLoop: 1, subStart: 2, subStop: 8 },
  advlightjavexplode: { name: "advlightjavexplode", id: 440, vel: 12, maxVel: 12, range: 20, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 240, trans: 1, subLoop: 1, subStart: 2, subStop: 8 },
  sucfireball: { name: "sucfireball", id: 441, vel: 18, maxVel: 18, range: 50, levRange: 0, celFile: "Fireball", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 10, red: 255, green: 178, blue: 64, speedPxPerSec: 450, distancePx: 900, trans: 1 },
  sucfireballexplode: { name: "sucfireballexplode", id: 442, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "FireArrowExplode2", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 13, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  sucfireballtrail: { name: "sucfireballtrail", id: 443, vel: 0, maxVel: 0, range: 36, levRange: 0, celFile: "groundFiresmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  sucshockfieldmissile: { name: "sucshockfieldmissile", id: 444, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "LightningJavelin", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 6, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, trans: 1 },
  sucshockfieldmissileexp: { name: "sucshockfieldmissileexp", id: 445, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "teethexplode", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  sucshockfield: { name: "sucshockfield", id: 446, vel: 0, maxVel: 0, range: 36, levRange: 0, celFile: "expansion\\FireSpikeExplode", animLen: 14, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  hellfiremissile: { name: "hellfiremissile", id: 447, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "MeteorTail", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  hellfireexa: { name: "hellfireexa", id: 448, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "BoneSpiritExplode", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  hellfireexb: { name: "hellfireexb", id: 449, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "DopplezonExplode", animLen: 25, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "imp charged bolt": { name: "imp charged bolt", id: 450, vel: 12, maxVel: 12, range: 98, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1176, trans: 1, subLoop: 1, subStart: 2, subStop: 8 },
  "imp teleport": { name: "imp teleport", id: 451, vel: 1, maxVel: 15, range: 14, levRange: 0, celFile: "expansion\\impteleport", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 25, distancePx: 14, trans: 1 },
  moltenboulder: { name: "moltenboulder", id: 452, vel: 4, maxVel: 4, range: 100, levRange: 0, celFile: "expansion\\MoltenBoulderRoll", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 100, distancePx: 400, alwaysExplode: true },
  moltenboulderemerge: { name: "moltenboulderemerge", id: 453, vel: 3, maxVel: 3, range: 5, levRange: 0, celFile: "expansion\\MoltenBoulderEmerge", animLen: 6, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 75, distancePx: 15, alwaysExplode: true },
  moltenboulderexplode: { name: "moltenboulderexplode", id: 454, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  moltenboulderfirepath: { name: "moltenboulderfirepath", id: 455, vel: 0, maxVel: 0, range: 37, levRange: 0, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  "moltenboulder-flyingrocks": { name: "moltenboulder-flyingrocks", id: 456, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "expansion\\MoltenFragmentD", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  firestorm: { name: "firestorm", id: 457, vel: 0, maxVel: 0, range: 15, levRange: 0, celFile: "groundFiresmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  firestormmaker: { name: "firestormmaker", id: 458, vel: 8, maxVel: 8, range: 40, levRange: 0, celFile: "expansion\\FirestormEmitter", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 200, distancePx: 320, trans: 1 },
  arcticblast1: { name: "arcticblast1", id: 459, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "expansion\\ArcticBlastIce", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  arcticblast2: { name: "arcticblast2", id: 460, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "expansion\\ArcticBlastIce_2", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  "erruption center": { name: "erruption center", id: 461, vel: 0, maxVel: 0, range: 80, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "erruption crack 1": { name: "erruption crack 1", id: 462, vel: 0, maxVel: 0, range: 84, levRange: 0, celFile: "expansion\\EruptionCrack", animLen: 41, animSpeed: 16, loopAnim: 1, numDirections: 4, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, nextHit: 1, nextDelay: 5, progOverlay: "fire_hit" },
  "erruption crack 2": { name: "erruption crack 2", id: 463, vel: 0, maxVel: 0, range: 84, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, nextHit: 1, nextDelay: 5, progOverlay: "fire_hit" },
  "erruption smoke 1": { name: "erruption smoke 1", id: 464, vel: 0, maxVel: 0, range: 84, levRange: 0, celFile: "expansion\\EruptionSmoke", animLen: 41, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "erruption smoke 2": { name: "erruption smoke 2", id: 465, vel: 0, maxVel: 0, range: 84, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "vine beast walk 1": { name: "vine beast walk 1", id: 466, vel: 0, maxVel: 0, range: 200, levRange: 0, celFile: "expansion\\Pod_walk_1", animLen: 31, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "vine beast walk 1 fade", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "vine beast walk 2": { name: "vine beast walk 2", id: 467, vel: 0, maxVel: 0, range: 200, levRange: 0, celFile: "expansion\\Pod_walk_2", animLen: 31, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "vine beast walk 2 fade", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "vine beast neutral": { name: "vine beast neutral", id: 468, vel: 0, maxVel: 0, range: 200, levRange: 0, celFile: "expansion\\Pod_neutral_1", animLen: 31, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "vine beast neutral fade", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "vine beast attack": { name: "vine beast attack", id: 469, vel: 0, maxVel: 0, range: 75, levRange: 0, celFile: "expansion\\Pod_attack_1", animLen: 51, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "vine beast death": { name: "vine beast death", id: 470, vel: 0, maxVel: 0, range: 51, levRange: 0, celFile: "expansion\\Pod_death_1", animLen: 21, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  vines: { name: "vines", id: 471, vel: 7, maxVel: 7, range: 20, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 175, distancePx: 140 },
  "vines trail": { name: "vines trail", id: 472, vel: 0, maxVel: 0, range: 100, levRange: 25, celFile: "Expansion\\vines", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "vines wither": { name: "vines wither", id: 473, vel: 0, maxVel: 0, range: 100, levRange: 0, celFile: "Expansion\\Vines_Death", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  "plague vines": { name: "plague vines", id: 474, vel: 7, maxVel: 7, range: 20, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 175, distancePx: 140 },
  "plague vines trail": { name: "plague vines trail", id: 475, vel: 0, maxVel: 0, range: 100, levRange: 25, celFile: "Expansion\\vines", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "plague vines wither": { name: "plague vines wither", id: 476, vel: 0, maxVel: 0, range: 100, levRange: 0, celFile: "Expansion\\Vines_Death", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  twister: { name: "twister", id: 477, vel: 10, maxVel: 10, range: 50, levRange: 0, celFile: "expansion\\twister", animLen: 40, animSpeed: 16, loopAnim: 1, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 250, distancePx: 500, nextHit: 1, nextDelay: 25, trans: 1, subLoop: 1, subStart: 18, subStop: 36 },
  tornado: { name: "tornado", id: 478, vel: 8, maxVel: 8, range: 75, levRange: 0, celFile: "expansion\\tornado", animLen: 40, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 200, distancePx: 600, nextHit: 1, nextDelay: 25, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  volcano: { name: "volcano", id: 479, vel: 0, maxVel: 0, range: 150, levRange: 0, celFile: "Expansion\\volcano_base", animLen: 30, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, nextHit: 1, nextDelay: 10, trans: 0, subLoop: 1, subStart: 17, subStop: 18 },
  "volcano overlay fire": { name: "volcano overlay fire", id: 480, vel: 0, maxVel: 0, range: 150, levRange: 0, celFile: "Expansion\\volcano_Fire", animLen: 30, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 10, red: 255, green: 64, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 6, subStop: 14 },
  "volcano debris 2": { name: "volcano debris 2", id: 481, vel: 14, maxVel: 14, range: 16, levRange: 0, celFile: "expansion\\volcano_rock", animLen: 15, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 350, distancePx: 224, trans: 1, alwaysExplode: true },
  "volcano explosion": { name: "volcano explosion", id: 482, vel: 0, maxVel: 0, range: 18, levRange: 0, celFile: "Expansion\\rock_lava_explosion", animLen: 18, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "volcano small fire": { name: "volcano small fire", id: 483, vel: 0, maxVel: 0, range: 18, levRange: 0, celFile: "Expansion\\rock_lava_pool", animLen: 18, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, nextHit: 1, nextDelay: 5 },
  "dragonbreath missile": { name: "dragonbreath missile", id: 484, vel: 12, maxVel: 12, range: 15, levRange: 0, celFile: "Expansion\\firenova", animLen: 11, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 180, nextHit: 1, nextDelay: 4, trans: 1, subLoop: 1, subStart: 6, subStop: 7 },
  lureprojectile: { name: "lureprojectile", id: 485, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "expansion\\FireSpikes", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 600, subLoop: 1, subStop: 7, alwaysExplode: true },
  lurecenter: { name: "lurecenter", id: 486, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "Expansion\\LureCloud", animLen: 26, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 3, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  lurecloud: { name: "lurecloud", id: 487, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "Expansion\\LureCloud", animLen: 26, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  impmiss1: { name: "impmiss1", id: 488, vel: 10, maxVel: 10, range: 80, levRange: 0, celFile: "Expansion\\impmissile01", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 250, distancePx: 800, trans: 1 },
  impmiss2: { name: "impmiss2", id: 489, vel: 12, maxVel: 12, range: 80, levRange: 0, celFile: "Expansion\\impmissile01", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 300, distancePx: 960, trans: 1 },
  impmiss3: { name: "impmiss3", id: 490, vel: 14, maxVel: 14, range: 80, levRange: 0, celFile: "Expansion\\impmissile01", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 350, distancePx: 1120, trans: 1 },
  impmiss4: { name: "impmiss4", id: 491, vel: 16, maxVel: 16, range: 80, levRange: 0, celFile: "Expansion\\impmissile01", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 400, distancePx: 1280, trans: 1 },
  impmiss5: { name: "impmiss5", id: 492, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Expansion\\impmissile01", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 500, distancePx: 1600, trans: 1 },
  "frozenhorror arcticblast1": { name: "frozenhorror arcticblast1", id: 493, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "expansion\\ArcticBlastIce", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  "frozenhorror arcticblast2": { name: "frozenhorror arcticblast2", id: 494, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "expansion\\ArcticBlastIce_2", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  sentrychargedbolt: { name: "sentrychargedbolt", id: 495, vel: 12, maxVel: 12, range: 98, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1176, trans: 1, subLoop: 1, subStart: 2, subStop: 8, pCltHitFunc: 10 },
  sentryspikeinair: { name: "sentryspikeinair", id: 496, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "expansion\\FireSpikes", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 600, subLoop: 1, subStop: 7, alwaysExplode: true },
  sentryspikeonground: { name: "sentryspikeonground", id: 497, vel: 0, maxVel: 0, range: 180, levRange: 60, celFile: "expansion\\FireSpikesGround", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "bomb explosion", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "recycler delay": { name: "recycler delay", id: 498, vel: 0, maxVel: 0, range: 47, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, progOverlay: "steallife", pCltDoFunc: 51, cltParam1: 40, cltSubMissile1: "recycler explosion", cltSubMissile2: "recycler vine" },
  "recycler vine": { name: "recycler vine", id: 499, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "Expansion\\vines", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "recycler fade": { name: "recycler fade", id: 500, vel: 0, maxVel: 0, range: 100, levRange: 0, celFile: "Expansion\\Vines_Death", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  "recycler explosion": { name: "recycler explosion", id: 501, vel: 0, maxVel: 0, range: 13, levRange: 0, celFile: "CorpseExplodeGuts", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0 },
  "death mauler": { name: "death mauler", id: 502, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "expansion\\deathmaulerfingers", animLen: 8, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, nextHit: 1, nextDelay: 10, alwaysExplode: true },
  "death mauler trail": { name: "death mauler trail", id: 503, vel: 0, maxVel: 0, range: 36, levRange: 0, celFile: "expansion\\deathmaulermissile", animLen: 31, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true, pCltHitFunc: 44, param1: 6, param2: 4, cltHitSubMissile1: "death mauler trail fade" },
  "death mauler trail fade": { name: "death mauler trail fade", id: 504, vel: 0, maxVel: 0, range: 36, levRange: 0, celFile: "expansion\\deathmaulerfadeout", animLen: 31, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  bladefury1: { name: "bladefury1", id: 505, vel: 18, maxVel: 18, range: 22, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 396, alwaysExplode: true },
  bladefragment1: { name: "bladefragment1", id: 506, vel: 22, maxVel: 22, range: 40, levRange: 0, celFile: "Expansion\\bladefury", animLen: 7, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 550, distancePx: 880, alwaysExplode: true },
  bladefury2: { name: "bladefury2", id: 507, vel: 18, maxVel: 18, range: 22, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 396, alwaysExplode: true },
  bladefragment2: { name: "bladefragment2", id: 508, vel: 22, maxVel: 22, range: 33, levRange: 0, celFile: "Expansion\\bladefury_B", animLen: 7, animSpeed: 32, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 550, distancePx: 726, alwaysExplode: true },
  bladefury3: { name: "bladefury3", id: 509, vel: 18, maxVel: 18, range: 22, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 396, alwaysExplode: true },
  bladefragment3: { name: "bladefragment3", id: 510, vel: 22, maxVel: 22, range: 25, levRange: 0, celFile: "Expansion\\bladefury_C", animLen: 7, animSpeed: 32, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 550, distancePx: 550, alwaysExplode: true },
  shockwave: { name: "shockwave", id: 511, vel: 20, maxVel: 20, range: 14, levRange: 0, celFile: "expansion\\shockwave", animLen: 7, animSpeed: 8, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 280, nextHit: 1, nextDelay: 4, trans: 1 },
  lightningtalons: { name: "lightningtalons", id: 512, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, trans: 1 },
  lightningtalonstrail: { name: "lightningtalonstrail", id: 513, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStop: 7 },
  phoenixtrail: { name: "phoenixtrail", id: 514, vel: 0, maxVel: 0, range: 90, levRange: 25, celFile: "groundFireBig", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  rabiesplague: { name: "rabiesplague", id: 515, vel: 0, maxVel: 0, range: 10, levRange: 5, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  rabiescontagion: { name: "rabiescontagion", id: 516, vel: 5, maxVel: 5, range: 20, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 125, distancePx: 100 },
  "wake of destruction maker": { name: "wake of destruction maker", id: 517, vel: 10, maxVel: 10, range: 25, levRange: 2, celFile: "groundFireSmall", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 8, red: 255, green: 178, blue: 64, speedPxPerSec: 250, distancePx: 250, nextHit: 1, nextDelay: 4, trans: 1, subLoop: 1, subStart: 1, subStop: 2 },
  "wake of destruction": { name: "wake of destruction", id: 518, vel: 8, maxVel: 8, range: 20, levRange: 0, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 200, distancePx: 160, nextHit: 1, nextDelay: 4, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  deathsentryexplode: { name: "deathsentryexplode", id: 519, vel: 0, maxVel: 0, range: 24, levRange: 0, celFile: "Expansion\\dethsentry02", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  tigerfury: { name: "tigerfury", id: 520, vel: 12, maxVel: 12, range: 128, levRange: 0, celFile: "BoneSpirit", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "tigerfurytrail2", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1536, trans: 1, alwaysExplode: true },
  tigerfurytrail: { name: "tigerfurytrail", id: 521, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "groundFireMedium", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  tigerfurytrail2: { name: "tigerfurytrail2", id: 522, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "BoneSpiritExplode", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "inferno sentry 1": { name: "inferno sentry 1", id: 523, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "Flamethrower", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 600, trans: 1 },
  "inferno sentry 2": { name: "inferno sentry 2", id: 524, vel: 12, maxVel: 12, range: 50, levRange: 0, celFile: "Flamethrower2", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 600, trans: 1 },
  "ancient throwing axe": { name: "ancient throwing axe", id: 525, vel: 24, maxVel: 24, range: 20, levRange: 0, celFile: "MissileHandAxe", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 480, pierce: true },
  sentrylightningbolt: { name: "sentrylightningbolt", id: 526, vel: 30, maxVel: 30, range: 10, levRange: 2, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 300, trans: 1 },
  sentrylightninghit: { name: "sentrylightninghit", id: 527, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStop: 7, progOverlay: "lightning", pCltHitFunc: 10 },
  "anya center": { name: "anya center", id: 528, vel: 0, maxVel: 0, range: 300, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  "anya icicle": { name: "anya icicle", id: 529, vel: 0, maxVel: 0, range: 1, levRange: 0, celFile: "expansion\\icicle", animLen: 10, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "anya iceimpact", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  "anya iceimpact": { name: "anya iceimpact", id: 530, vel: 0, maxVel: 0, range: 10, levRange: 0, celFile: "expansion\\iceimpact", animLen: 10, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "anya icesteam": { name: "anya icesteam", id: 531, vel: 0, maxVel: 0, range: 30, levRange: 0, celFile: "expansion\\icecavequest_steam", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "anya icemagic": { name: "anya icemagic", id: 532, vel: 0, maxVel: 0, range: 30, levRange: 0, celFile: "expansion\\icecavequest_magic", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "dragontail missile": { name: "dragontail missile", id: 533, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "ExpArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  dragonflight: { name: "dragonflight", id: 534, vel: 0, maxVel: 0, range: 15, levRange: 0, celFile: "expansion\\FirestormEmitter", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  dragonflightmaker: { name: "dragonflightmaker", id: 535, vel: 8, maxVel: 8, range: 20, levRange: 0, celFile: "expansion\\FirestormEmitter", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 200, distancePx: 160, trans: 1 },
  "progressive radius damage": { name: "progressive radius damage", id: 536, vel: 8, maxVel: 8, range: 20, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 200, distancePx: 160, trans: 1 },
  "vine beast walk 1 fade": { name: "vine beast walk 1 fade", id: 537, vel: 0, maxVel: 0, range: 11, levRange: 0, celFile: "expansion\\Pod_Jump_FadeOut", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  "vine beast walk 2 fade": { name: "vine beast walk 2 fade", id: 538, vel: 0, maxVel: 0, range: 31, levRange: 0, celFile: "expansion\\deathmaulerfadeout", animLen: 31, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  "vine beast neutral fade": { name: "vine beast neutral fade", id: 539, vel: 0, maxVel: 0, range: 11, levRange: 0, celFile: "expansion\\Pod_Neutral_FadeOut", animLen: 11, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0 },
  "vine recycler delay": { name: "vine recycler delay", id: 540, vel: 0, maxVel: 0, range: 47, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, progOverlay: "stealmana", pCltDoFunc: 51, cltParam1: 40, cltSubMissile1: "recycler explosion", cltSubMissile2: "recycler vine" },
  "ancient death center": { name: "ancient death center", id: 541, vel: 3, maxVel: 3, range: 400, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 2, red: 255, green: 125, blue: 125, speedPxPerSec: 75, distancePx: 1200, trans: 1, alwaysExplode: true },
  "ancient death cloud": { name: "ancient death cloud", id: 542, vel: 3, maxVel: 3, range: 50, levRange: 0, celFile: "expansion\\AncientDeathMissile", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 2, red: 255, green: 125, blue: 125, speedPxPerSec: 75, distancePx: 150, trans: 1, subLoop: 1, subStart: 4, subStop: 12, alwaysExplode: true },
  "lightning charge up nova": { name: "lightning charge up nova", id: 543, vel: 24, maxVel: 24, accel: -1000, range: 13, levRange: 0, celFile: "ElectricNova", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 312, nextHit: 1, nextDelay: 4, trans: 1 },
  "chainlightningcharge up": { name: "chainlightningcharge up", id: 544, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, nextHit: 1, nextDelay: 4, trans: 1 },
  "pain worm appear": { name: "pain worm appear", id: 545, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "Revive", animLen: 25, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "baal taunt control": { name: "baal taunt control", id: 546, vel: 0, maxVel: 0, range: 75, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "baal taunt lightning": { name: "baal taunt lightning", id: 547, vel: 30, maxVel: 30, range: 10, levRange: 2, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 300, nextHit: 1, nextDelay: 10, trans: 1 },
  "baal taunt lightning trail": { name: "baal taunt lightning trail", id: 548, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, nextHit: 1, nextDelay: 10, trans: 1 },
  "baal taunt poison": { name: "baal taunt poison", id: 549, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19 },
  "baal spawn monsters": { name: "baal spawn monsters", id: 550, vel: 12, maxVel: 12, range: 60, levRange: 0, celFile: "Expansion\\baalsummonmissile2", animLen: 8, animSpeed: 8, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 81, green: 81, blue: 255, speedPxPerSec: 300, distancePx: 720, trans: 1, alwaysExplode: true, pCltHitFunc: 57, cHitPar1: 10, cHitPar2: 20, cltHitSubMissile1: "baal spawn monsters exp" },
  "mindblast hit": { name: "mindblast hit", id: 551, vel: 0, maxVel: 0, range: 10, levRange: 0, celFile: "Expansion\\Mindblast", animLen: 10, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  "blade shield missile": { name: "blade shield missile", id: 552, vel: 18, maxVel: 30, accel: 250, range: 100, levRange: 0, celFile: "Expansion\\blade_shield_missile", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 450, distancePx: 1800, trans: 1 },
  "blade shield attachment": { name: "blade shield attachment", id: 553, vel: 0, maxVel: 0, range: 500, levRange: 100, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  "baal inferno": { name: "baal inferno", id: 554, vel: 20, maxVel: 40, accel: 250, range: 2048, levRange: 0, celFile: "Expansion\\baalmissile", animLen: 14, animSpeed: 12, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 40960, nextHit: 1, nextDelay: 4, trans: 1, alwaysExplode: true },
  "baal nova": { name: "baal nova", id: 555, vel: 20, maxVel: 20, range: 40, levRange: 0, celFile: "Expansion\\baalsummonmissile", animLen: 8, animSpeed: 12, loopAnim: 0, numDirections: 8, explosionMissile: "shamanexp", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 800, nextHit: 1, nextDelay: 4, trans: 1 },
  fistsoffireexplode: { name: "fistsoffireexplode", id: 556, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "ExpArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 15, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  fistsoffirefirewall: { name: "fistsoffirefirewall", id: 557, vel: 0, maxVel: 0, range: 64, levRange: 0, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  clawsofthunderbolt: { name: "clawsofthunderbolt", id: 558, vel: 12, maxVel: 12, range: 98, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 1176, nextHit: 1, nextDelay: 4, trans: 1, subLoop: 1, subStart: 2, subStop: 8 },
  clawsofthundernova: { name: "clawsofthundernova", id: 559, vel: 24, maxVel: 24, accel: -1000, range: 13, levRange: 0, celFile: "ElectricNova", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 312, nextHit: 1, nextDelay: 4, trans: 1 },
  bladesoficeexplode: { name: "bladesoficeexplode", id: 560, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "IceArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 11, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  bladesoficecubes: { name: "bladesoficecubes", id: 561, vel: 0, maxVel: 0, range: 30, levRange: 0, celFile: "IceBreakSmall", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  bladesoficecubesmelt: { name: "bladesoficecubesmelt", id: 562, vel: 0, maxVel: 0, range: 150, levRange: 0, celFile: "IceBreakSmallMelt", animLen: 12, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  royalstrikemeteor: { name: "royalstrikemeteor", id: 563, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "Meteor", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 0 },
  royalstrikemeteorcenter: { name: "royalstrikemeteorcenter", id: 564, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "MeteorTargetIndicator", animLen: 17, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 64, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  royalstrikemeteortail: { name: "royalstrikemeteortail", id: 565, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "MeteorTail", animLen: 12, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  royalstrikemeteorexplode: { name: "royalstrikemeteorexplode", id: 566, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "ExpArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 13, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  royalstrikemeteorfire: { name: "royalstrikemeteorfire", id: 567, vel: 0, maxVel: 0, range: 37, levRange: 0, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  royalstrikechainlightning: { name: "royalstrikechainlightning", id: 568, vel: 30, maxVel: 30, range: 60, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 1800, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "lightning" },
  royalstrikechaosice: { name: "royalstrikechaosice", id: 569, vel: 16, maxVel: 16, range: 40, levRange: 0, celFile: "IceBolt", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 4, red: 81, green: 81, blue: 255, speedPxPerSec: 400, distancePx: 640, nextHit: 1, nextDelay: 4, trans: 1 },
  "world stone chip 1": { name: "world stone chip 1", id: 570, vel: 1, maxVel: 1, range: 500, levRange: 0, celFile: "expansion\\wstonechips1", animLen: 25, animSpeed: 12, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 25, distancePx: 500 },
  "world stone chip 2": { name: "world stone chip 2", id: 571, vel: 1, maxVel: 1, range: 500, levRange: 0, celFile: "expansion\\wstonechips2", animLen: 33, animSpeed: 12, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 25, distancePx: 500 },
  "world stone chip 3": { name: "world stone chip 3", id: 572, vel: 1, maxVel: 1, range: 500, levRange: 0, celFile: "expansion\\wstonechips3", animLen: 25, animSpeed: 12, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 25, distancePx: 500 },
  "world stone chip 4": { name: "world stone chip 4", id: 573, vel: 1, maxVel: 1, range: 500, levRange: 0, celFile: "expansion\\wstonechips4", animLen: 17, animSpeed: 12, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 25, distancePx: 500 },
  highpriestlightning2: { name: "highpriestlightning2", id: 574, vel: 8, maxVel: 8, range: 16, levRange: 0, celFile: "HighPriestLightning", animLen: 9, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 12, red: 255, green: 64, blue: 64, speedPxPerSec: 200, distancePx: 128, trans: 1, alwaysExplode: true },
  infernoflame3: { name: "infernoflame3", id: 575, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "Flamethrower", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  "mindblast center": { name: "mindblast center", id: 576, vel: 0, maxVel: 0, range: 10, levRange: 0, celFile: "Expansion\\Mindblast", animLen: 10, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  armageddoncontrol: { name: "armageddoncontrol", id: 577, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  armageddonrock: { name: "armageddonrock", id: 578, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "expansion\\armageddon_rock", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  armageddontail: { name: "armageddontail", id: 579, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "expansion\\armageddon_fire", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  armageddonexplosion: { name: "armageddonexplosion", id: 580, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "ExpArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  hurricaneswoosh: { name: "hurricaneswoosh", id: 581, vel: 20, maxVel: 20, range: 22, levRange: 0, celFile: "expansion\\hurricane_swoosh", animLen: 11, animSpeed: 8, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 500, distancePx: 440, trans: 1 },
  hurricanecart: { name: "hurricanecart", id: 582, vel: 18, maxVel: 18, range: 20, levRange: 0, celFile: "expansion\\hurricane_cart", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 360 },
  hurricanerock: { name: "hurricanerock", id: 583, vel: 18, maxVel: 18, range: 20, levRange: 0, celFile: "expansion\\hurricane_rocks", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 360 },
  hurricanesack: { name: "hurricanesack", id: 584, vel: 18, maxVel: 18, range: 20, levRange: 0, celFile: "expansion\\hurricane_sack", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 360 },
  hurricanetree: { name: "hurricanetree", id: 585, vel: 18, maxVel: 18, range: 20, levRange: 0, celFile: "expansion\\hurricane_tree", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 360 },
  hurricanevase: { name: "hurricanevase", id: 586, vel: 18, maxVel: 18, range: 20, levRange: 0, celFile: "expansion\\hurricane_vase", animLen: 20, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 360 },
  baalcorpseexplodedelay: { name: "baalcorpseexplodedelay", id: 587, vel: 0, maxVel: 0, range: 10, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "baalcorpseexplodeexpl", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true, pCltHitFunc: 44, cltHitSubMissile1: "baalcorpseexplodeexpl" },
  baalcorpseexplodeexpl: { name: "baalcorpseexplodeexpl", id: 588, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "expansion\\CEBaal", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true, pCltHitFunc: 44, cltHitSubMissile1: "baalcorpseexplodefade" },
  "baal cold maker": { name: "baal cold maker", id: 589, vel: 20, maxVel: 20, range: 50, levRange: 0, celFile: "BlueNovaB", animLen: 8, animSpeed: 8, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 500, distancePx: 1000, nextHit: 1, nextDelay: 4, trans: 1 },
  "baal cold trail": { name: "baal cold trail", id: 590, vel: 13, maxVel: 13, range: 20, levRange: 0, celFile: "BlueNovaB", animLen: 8, animSpeed: 8, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 5, red: 143, green: 143, blue: 255, speedPxPerSec: 325, distancePx: 260, nextHit: 1, nextDelay: 4, trans: 1 },
  "baal spawn monsters exp": { name: "baal spawn monsters exp", id: 591, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "Expansion\\baalsummonsmall", animLen: 11, animSpeed: 15, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 81, green: 81, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  impmiss21: { name: "impmiss21", id: 592, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Expansion\\impmissile2", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 500, distancePx: 1600, trans: 1 },
  impmiss22: { name: "impmiss22", id: 593, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Expansion\\impmissile2", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 500, distancePx: 1600, trans: 1 },
  impmiss23: { name: "impmiss23", id: 594, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Expansion\\impmissile2", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 500, distancePx: 1600, trans: 1 },
  impmiss24: { name: "impmiss24", id: 595, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Expansion\\impmissile2", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 500, distancePx: 1600, trans: 1 },
  impmiss25: { name: "impmiss25", id: 596, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Expansion\\impmissile2", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 500, distancePx: 1600, trans: 1 },
  anyasteam1: { name: "anyasteam1", id: 597, vel: 0, maxVel: 0, range: 26, levRange: 0, celFile: "ChillBloodPuff", animLen: 26, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  anyasteam2: { name: "anyasteam2", id: 598, vel: 0, maxVel: 0, range: 26, levRange: 0, celFile: "ChillBloodPuff", animLen: 26, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  ancientsguide: { name: "ancientsguide", id: 599, vel: 0, maxVel: 0, range: 0, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  ancientsmarker: { name: "ancientsmarker", id: 600, vel: 0, maxVel: 0, range: 0, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  ancientscontrol: { name: "ancientscontrol", id: 601, vel: 0, maxVel: 0, range: 0, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  overseercontrol: { name: "overseercontrol", id: 602, vel: 0, maxVel: 0, range: 500, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  nihlithak1: { name: "nihlithak1", id: 603, vel: 0, maxVel: 0, range: 32, levRange: 0, celFile: "expansion\\Nihlathak A", animLen: 16, animSpeed: 8, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  nihlithak2: { name: "nihlithak2", id: 604, vel: 0, maxVel: 0, range: 192, levRange: 0, celFile: "expansion\\Nihlathak B", animLen: 8, animSpeed: 8, loopAnim: 1, numDirections: 1, explosionMissile: "nihlithak3", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  nihlithak3: { name: "nihlithak3", id: 605, vel: 0, maxVel: 0, range: 34, levRange: 0, celFile: "expansion\\Nihlathak C", animLen: 17, animSpeed: 8, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  nehlithakcontrol: { name: "nehlithakcontrol", id: 606, vel: 0, maxVel: 0, range: 224, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  nehlithakswoosh: { name: "nehlithakswoosh", id: 607, vel: 20, maxVel: 20, range: 22, levRange: 0, celFile: "expansion\\nehlthak_Swoosh", animLen: 11, animSpeed: 8, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 500, distancePx: 440, trans: 1 },
  nehlithakdebris1: { name: "nehlithakdebris1", id: 608, vel: 18, maxVel: 18, range: 16, levRange: 0, celFile: "expansion\\Skeleton_pieces_A", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 288 },
  nehlithakdebris2: { name: "nehlithakdebris2", id: 609, vel: 18, maxVel: 18, range: 16, levRange: 0, celFile: "expansion\\Skeleton_pieces_B", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 288 },
  nehlithakdebris3: { name: "nehlithakdebris3", id: 610, vel: 18, maxVel: 18, range: 16, levRange: 0, celFile: "expansion\\Skeleton_pieces_C", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 288 },
  nehlithakdebris4: { name: "nehlithakdebris4", id: 611, vel: 18, maxVel: 18, range: 16, levRange: 0, celFile: "expansion\\Skeleton_pieces_D", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 450, distancePx: 288 },
  nehlithakglow: { name: "nehlithakglow", id: 612, vel: 0, maxVel: 0, range: 0, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  baalteleport: { name: "baalteleport", id: 613, pCltDoFunc: 1, pSrvDoFunc: 1, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "Expansion\\Baalsummonoverlay", animLen: 20, animSpeed: 24, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 3, red: 128, green: 64, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  baalclonedeath: { name: "baalclonedeath", id: 614, pCltDoFunc: 1, pSrvDoFunc: 1, vel: 0, maxVel: 0, range: 20, levRange: 0, celFile: "Expansion\\Baalteleport", animLen: 20, animSpeed: 24, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 3, red: 128, green: 64, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  anyasteamvent: { name: "anyasteamvent", id: 615, vel: 0, maxVel: 0, range: 82, levRange: 0, celFile: "expansion\\IceCaveEruption", animLen: 41, animSpeed: 8, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  anyasteam: { name: "anyasteam", id: 616, vel: 0, maxVel: 0, range: 82, levRange: 0, celFile: "expansion\\Ice_Smoke", animLen: 41, animSpeed: 8, loopAnim: 0, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  nehlithakhole: { name: "nehlithakhole", id: 617, vel: 0, maxVel: 0, range: 250, levRange: 0, celFile: "expansion\\nehlthak_Hole", animLen: 41, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, subLoop: 1, subStart: 25, subStop: 29 },
  nehlithakholelight: { name: "nehlithakholelight", id: 618, vel: 0, maxVel: 0, range: 250, levRange: 0, celFile: "expansion\\nehlthak_Hole_light", animLen: 41, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 25, subStop: 29 },
  volcanofiretrail: { name: "volcanofiretrail", id: 619, vel: 12, maxVel: 12, range: 0, levRange: 0, celFile: "expansion\\wallfire_low_Tiny", animLen: 25, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 300, distancePx: 0, trans: 1 },
  nehlithakglow2: { name: "nehlithakglow2", id: 620, vel: 0, maxVel: 0, range: 192, levRange: 0, celFile: "expansion\\NehlithakGlow", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  nehlithakbonechips: { name: "nehlithakbonechips", id: 621, vel: 0, maxVel: 0, range: 192, levRange: 0, celFile: "expansion\\BonePieces", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  baalcorpseexplodefade: { name: "baalcorpseexplodefade", id: 622, vel: 0, maxVel: 0, range: 443, levRange: 0, celFile: "expansion\\CEBaalFade", animLen: 11, animSpeed: 4, loopAnim: 1, numDirections: 4, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  armageddonfire: { name: "armageddonfire", id: 623, vel: 0, maxVel: 0, range: 37, levRange: 0, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  icesparkle: { name: "icesparkle", id: 624, vel: 0, maxVel: 0, range: 250, levRange: 0, celFile: "expansion\\iceglint", animLen: 6, animSpeed: 12, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 2, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "baalfx control": { name: "baalfx control", id: 625, vel: 0, maxVel: 0, range: 650, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 10, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "baalfx spirit 1": { name: "baalfx spirit 1", id: 626, vel: 10, maxVel: 10, range: 250, levRange: 0, celFile: "expansion\\baaldeathghostie02", animLen: 8, animSpeed: 6, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 250, distancePx: 2500, trans: 1 },
  "baalfx spirit 2": { name: "baalfx spirit 2", id: 627, vel: 10, maxVel: 10, range: 250, levRange: 0, celFile: "expansion\\baaldeathghostie01", animLen: 8, animSpeed: 6, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 250, distancePx: 2500, trans: 1 },
  "baalfx spirit 3": { name: "baalfx spirit 3", id: 628, vel: 10, maxVel: 10, range: 250, levRange: 0, celFile: "null", animLen: 1, animSpeed: 8, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 250, distancePx: 2500, trans: 1 },
  "baalfx spirit 4": { name: "baalfx spirit 4", id: 629, vel: 10, maxVel: 10, range: 250, levRange: 0, celFile: "null", animLen: 1, animSpeed: 8, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 250, distancePx: 2500, trans: 1 },
  "baalfx spirit 5": { name: "baalfx spirit 5", id: 630, vel: 10, maxVel: 10, range: 250, levRange: 0, celFile: "null", animLen: 1, animSpeed: 8, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 250, distancePx: 2500, trans: 1 },
  "baalfx baal head appear": { name: "baalfx baal head appear", id: 631, vel: 0, maxVel: 0, range: 455, levRange: 0, celFile: "expansion\\baaldeathswirl", animLen: 36, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "baalfx baal head 1": { name: "baalfx baal head 1", id: 632, vel: 0, maxVel: 0, range: 390, levRange: 0, celFile: "expansion\\baaldeathhead01", animLen: 42, animSpeed: 12, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "baalfx baal head 2": { name: "baalfx baal head 2", id: 633, vel: 0, maxVel: 0, range: 390, levRange: 0, celFile: "expansion\\baaldeathhead02", animLen: 42, animSpeed: 12, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "baalfx baal head 3": { name: "baalfx baal head 3", id: 634, vel: 0, maxVel: 0, range: 390, levRange: 0, celFile: "expansion\\baaldeathhead03", animLen: 42, animSpeed: 12, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  "baalfx tyreal debris 1": { name: "baalfx tyreal debris 1", id: 635, vel: 0, maxVel: 0, range: 40, levRange: 0, celFile: "expansion\\BCeilingChunkFall1", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "baalfx tyreal debris break", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "baalfx tyreal debris 2": { name: "baalfx tyreal debris 2", id: 636, vel: 0, maxVel: 0, range: 40, levRange: 0, celFile: "expansion\\BCeilingChunkFall2", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "baalfx tyreal debris break", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "baalfx tyreal debris 3": { name: "baalfx tyreal debris 3", id: 637, vel: 0, maxVel: 0, range: 40, levRange: 0, celFile: "expansion\\BCeilingChunkFall3", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "baalfx tyreal debris break", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "baalfx tyreal debris break": { name: "baalfx tyreal debris break", id: 638, vel: 0, maxVel: 0, range: 1365, levRange: 0, celFile: "expansion\\BCeilingChunkBreak", animLen: 12, animSpeed: 12, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  "worldstone shake": { name: "worldstone shake", id: 639, vel: 0, maxVel: 0, range: 200, levRange: 0, celFile: "null", animLen: 1, animSpeed: 12, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  blessedhammerex: { name: "blessedhammerex", id: 640, vel: 18, maxVel: 30, accel: 250, range: 120, levRange: 0, celFile: "blessedhammer", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 5, red: 222, green: 222, blue: 255, speedPxPerSec: 450, distancePx: 2160, trans: 1 },
  sentrylightningbolt2: { name: "sentrylightningbolt2", id: 641, vel: 30, maxVel: 30, range: 10, levRange: 2, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 300, trans: 1, pierce: true },
  sentrylightninghit2: { name: "sentrylightninghit2", id: 642, vel: 0, maxVel: 0, range: 12, levRange: 0, celFile: "LightningStrike", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStop: 7, progOverlay: "lightning", pCltHitFunc: 10 },
  lightningtowernova: { name: "lightningtowernova", id: 643, vel: 24, maxVel: 24, accel: -1000, range: 13, levRange: 0, celFile: "ElectricNova", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 312, nextHit: 1, nextDelay: 4, trans: 1, pCltHitFunc: 10 },
  skbowarrow6: { name: "skbowarrow6", id: 644, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "FireArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 2, red: 255, green: 178, blue: 64, speedPxPerSec: 600, distancePx: 960, trans: 1, pierce: true },
  skbowarrow7: { name: "skbowarrow7", id: 645, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "IceArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 2, red: 81, green: 81, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 1, pierce: true },
  skbowarrow8: { name: "skbowarrow8", id: 646, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "SafeArrow", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 2, red: 255, green: 178, blue: 64, speedPxPerSec: 600, distancePx: 960, trans: 1, pierce: true },
  bighead6: { name: "bighead6", id: 647, vel: 16, maxVel: 16, range: 40, levRange: 0, celFile: "BigheadLightningMissile", animLen: 3, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "bigheadexp", light: 3, red: 143, green: 143, blue: 255, speedPxPerSec: 400, distancePx: 640, trans: 1 },
  viper_poisjav: { name: "viper_poisjav", id: 648, vel: 24, maxVel: 24, range: 15, levRange: 0, celFile: "poisonNova", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 360, trans: 1, pierce: true },
  viper_poisjavcloud: { name: "viper_poisjavcloud", id: 649, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 128, green: 255, blue: 128, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19 },
  viper_fire: { name: "viper_fire", id: 650, vel: 24, maxVel: 24, range: 15, levRange: 0, celFile: "Firebolt", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 360, trans: 1 },
  viper_firecloud: { name: "viper_firecloud", id: 651, vel: 0, maxVel: 0, range: 10, levRange: 0, celFile: "Flamethrower", animLen: 15, animSpeed: 7, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, nextHit: 1, nextDelay: 4, trans: 1 },
  viper_bonespear: { name: "viper_bonespear", id: 652, vel: 24, maxVel: 24, range: 40, levRange: 0, celFile: "BoneSpear", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "bonespearexplode", light: 3, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 960, trans: 1 },
  countessfirewallmaker: { name: "countessfirewallmaker", id: 653, vel: 12, maxVel: 12, range: 7, levRange: 0, celFile: "groundFireBig", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 8, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 84, trans: 1, subLoop: 1, subStart: 1, subStop: 2 },
  "baal taunt lightning control": { name: "baal taunt lightning control", id: 654, vel: 0, maxVel: 0, range: 1, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  "baal taunt poison control": { name: "baal taunt poison control", id: 655, vel: 0, maxVel: 0, range: 1, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  explodingarrowexp2: { name: "explodingarrowexp2", id: 656, vel: 0, maxVel: 0, range: 1, levRange: 0, celFile: "null", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  freezingarrowexp3: { name: "freezingarrowexp3", id: 657, vel: 0, maxVel: 0, range: 1, levRange: 0, celFile: "null", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1, alwaysExplode: true },
  pantherjav5: { name: "pantherjav5", id: 658, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Javelin", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 1600, pierce: true },
  spike6: { name: "spike6", id: 659, vel: 30, maxVel: 30, range: 40, levRange: 0, celFile: "SpikeFiendMissle", animLen: 2, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 1200 },
  cr_arrow6: { name: "cr_arrow6", id: 660, vel: 26, maxVel: 26, range: 40, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 1, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 650, distancePx: 1040, pierce: true },
  skmagepois: { name: "skmagepois", id: 661, vel: 12, maxVel: 12, range: 40, levRange: 0, celFile: "poisonNova", animLen: 30, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 2, red: 255, green: 255, blue: 255, speedPxPerSec: 300, distancePx: 480, trans: 1 },
  skmagecold: { name: "skmagecold", id: 662, vel: 14, maxVel: 14, range: 40, levRange: 0, celFile: "Icebolt", animLen: 6, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "iceexplode", light: 2, red: 255, green: 255, blue: 255, speedPxPerSec: 350, distancePx: 560, trans: 1 },
  skmagefire: { name: "skmagefire", id: 663, vel: 18, maxVel: 18, range: 40, levRange: 0, celFile: "Firebolt", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "fireexplode", light: 2, red: 255, green: 255, blue: 255, speedPxPerSec: 450, distancePx: 720, trans: 1 },
  skmageltng: { name: "skmageltng", id: 664, vel: 20, maxVel: 20, range: 40, levRange: 0, celFile: "ChargedBolt", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "", light: 2, red: 255, green: 255, blue: 255, speedPxPerSec: 500, distancePx: 800, trans: 1 },
  succubusmiss: { name: "succubusmiss", id: 665, vel: 10, maxVel: 10, range: 80, levRange: 0, celFile: "Expansion\\impmissile01", animLen: 10, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "teethexplode", light: 2, red: 255, green: 64, blue: 64, speedPxPerSec: 250, distancePx: 800, trans: 1 },
  willowisplightningbolt2: { name: "willowisplightningbolt2", id: 666, vel: 32, maxVel: 32, range: 40, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 8, red: 178, green: 178, blue: 255, speedPxPerSec: 800, distancePx: 1280, trans: 1 },
  mummyex: { name: "mummyex", id: 667, vel: 5, maxVel: 5, range: 24, levRange: 0, celFile: "GreaterMummyBreath", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 8, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 125, distancePx: 120, trans: 1 },
  goospitex: { name: "goospitex", id: 668, vel: 10, maxVel: 10, range: 24, levRange: 0, celFile: "SandMaggotGooSpit", animLen: 24, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "goosplat", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 250, distancePx: 240 },
  impmissex: { name: "impmissex", id: 669, vel: 20, maxVel: 20, range: 80, levRange: 0, celFile: "Expansion\\impmissile2", animLen: 8, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "shamanexp", light: 5, red: 255, green: 64, blue: 64, speedPxPerSec: 500, distancePx: 1600, trans: 1 },
  diablogeddoncontrol: { name: "diablogeddoncontrol", id: 670, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "null", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0 },
  diablogeddonrock: { name: "diablogeddonrock", id: 671, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "expansion\\armageddon_rock", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, alwaysExplode: true },
  diablogeddontail: { name: "diablogeddontail", id: 672, vel: 0, maxVel: 0, range: 25, levRange: 0, celFile: "expansion\\armageddon_fire", animLen: 16, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 0, red: 0, green: 0, blue: 0, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  diablogeddonexplosion: { name: "diablogeddonexplosion", id: 673, vel: 0, maxVel: 0, range: 16, levRange: 0, celFile: "ExpArrowExplode", animLen: 16, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 255, blue: 255, speedPxPerSec: 0, distancePx: 0, trans: 1 },
  diablogeddonfire: { name: "diablogeddonfire", id: 674, vel: 0, maxVel: 0, range: 37, levRange: 0, celFile: "groundFireSmall", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 5, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  megademoninferno: { name: "megademoninferno", id: 675, vel: 12, maxVel: 12, range: 30, levRange: 0, celFile: "Flamethrower", animLen: 15, animSpeed: 16, loopAnim: 0, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 178, blue: 64, speedPxPerSec: 300, distancePx: 360, trans: 1 },
  trapfirebolt: { name: "trapfirebolt", id: 676, vel: 20, maxVel: 20, range: 50, levRange: 0, celFile: "Firebolt", animLen: 5, animSpeed: 16, loopAnim: 1, numDirections: 16, explosionMissile: "fireexplode", light: 7, red: 255, green: 178, blue: 64, speedPxPerSec: 500, distancePx: 1000, trans: 1 },
  trappoisonjavcloud: { name: "trappoisonjavcloud", id: 677, vel: 0, maxVel: 0, range: 60, levRange: 0, celFile: "PoisonSparks", animLen: 31, animSpeed: 16, loopAnim: 1, numDirections: 8, explosionMissile: "", light: 0, red: 128, green: 255, blue: 128, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 10, subStop: 19, pCltDoFunc: 4, param1: 2, param2: 4, cltParam1: 24, cltParam2: 1, cltParam3: 6, cltSubMissile1: "poisonpuff" },
  trapnova: { name: "trapnova", id: 678, vel: 24, maxVel: 24, accel: -1000, range: 13, levRange: 0, celFile: "ElectricNova", animLen: 13, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 312, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "lightning", pCltHitFunc: 10 },
  mephfrostnova: { name: "mephfrostnova", id: 679, vel: 24, maxVel: 24, accel: -1000, range: 14, levRange: 0, celFile: "FrostNova", animLen: 14, animSpeed: 16, loopAnim: 0, numDirections: 16, explosionMissile: "", light: 0, red: 81, green: 81, blue: 255, speedPxPerSec: 600, distancePx: 336, nextHit: 1, nextDelay: 4, trans: 1, progOverlay: "ice_explode", pCltHitFunc: 10 },
  mephlight: { name: "mephlight", id: 680, vel: 30, maxVel: 30, range: 25, levRange: 0, celFile: "null", animLen: 2, animSpeed: 16, loopAnim: 2, numDirections: 1, explosionMissile: "", light: 4, red: 255, green: 255, blue: 255, speedPxPerSec: 750, distancePx: 750, trans: 1, progOverlay: "lightning", pCltHitFunc: 10 },
  vampiremeteorfire: { name: "vampiremeteorfire", id: 681, vel: 0, maxVel: 0, range: 90, levRange: 0, celFile: "groundFireMedium", animLen: 37, animSpeed: 16, loopAnim: 1, numDirections: 1, explosionMissile: "", light: 3, red: 255, green: 178, blue: 64, speedPxPerSec: 0, distancePx: 0, trans: 1, subLoop: 1, subStart: 12, subStop: 36 },
  strafearrow: { name: "strafearrow", id: 682, vel: 24, maxVel: 24, range: 50, levRange: 0, celFile: "Arrow", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 1200, nextHit: 1, nextDelay: 4, pierce: true },
  strafebolt: { name: "strafebolt", id: 683, vel: 24, maxVel: 24, range: 50, levRange: 0, celFile: "XBowBolt", animLen: 1, animSpeed: 16, loopAnim: 0, numDirections: 32, explosionMissile: "", light: 0, red: 255, green: 255, blue: 255, speedPxPerSec: 600, distancePx: 1200, nextHit: 1, nextDelay: 4, pierce: true },
})

/** Alias of CANONICAL_113C_MISSILES for direct Missiles.txt table lookup. */
export const MISSILE_DATA: Readonly<Record<string, MissileTxtData>> = CANONICAL_113C_MISSILES

/**
 * Lookup from 1.13c Missiles.txt numeric `Id` to canonical missile key.
 */
export const MISSILE_CLASS_ID_TO_KEY: Readonly<Record<number, string>> = Object.freeze(
  (() => {
    const map: Record<number, string> = {}
    for (const [key, data] of Object.entries(CANONICAL_113C_MISSILES)) {
      map[data.id] = key
    }
    return map
  })(),
)


/**
 * Safely parse an RGB color channel (0..255) with fallback (default 255).
 * Preserves authentic 0 values while mapping empty/unspecified cells to fallback.
 */
export function parseColorChannel(raw: string | undefined, fallback = 255): number {
  if (raw === undefined) return fallback
  const trimmed = raw.trim()
  if (trimmed === '') return fallback
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Parses raw Missiles.txt text into a Map of missile records.
 */
export function parseMissilesTxt(content: string): Map<string, MissileTxtData> {
  const map = new Map<string, MissileTxtData>()
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length < 2) return map
  const headers = lines[0]!.split('\t').map(h => h.trim())
  const col = (name: string) => headers.indexOf(name)

  const missileIdx = col('Missile')
  const idIdx = col('Id')
  const velIdx = col('Vel')
  const maxVelIdx = col('MaxVel')
  const velLevIdx = col('VelLev')
  const accelIdx = col('Accel')
  const rangeIdx = col('Range')
  const levRangeIdx = col('LevRange')
  const celFileIdx = col('CelFile')
  const animLenIdx = col('AnimLen')
  const animSpeedIdx = col('AnimSpeed')
  const loopAnimIdx = col('LoopAnim')
  const subLoopIdx = col('SubLoop')
  const subStartIdx = col('SubStart')
  const subStopIdx = col('SubStop')
  const numDirIdx = col('NumDirections')
  const explIdx = col('ExplosionMissile')
  const lightIdx = col('Light')
  const redIdx = col('Red')
  const greenIdx = col('Green')
  const blueIdx = col('Blue')
  const nextHitIdx = col('NextHit')
  const nextDelayIdx = col('NextDelay')
  const transIdx = col('Trans')
  const progOverlayIdx = col('ProgOverlay')
  const pCltDoFuncIdx = col('pCltDoFunc')
  const pCltHitFuncIdx = col('pCltHitFunc')
  const cHitPar1Idx = col('cHitPar1')
  const cHitPar2Idx = col('cHitPar2')
  const cltSubMissile1Idx = col('CltSubMissile1')
  const cltSubMissile2Idx = col('CltSubMissile2')
  const cltHitSubMissile1Idx = col('CltHitSubMissile1')
  const cltHitSubMissile2Idx = col('CltHitSubMissile2')
  const collideFriendIdx = col('CollideFriend')
  const holyIdx = col('Holy')

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split('\t')
    const name = (cells[missileIdx] ?? '').trim().toLowerCase()
    if (!name || name === 'expansion') continue

    const vel = Number(cells[velIdx] ?? 0) || 0
    const maxVel = Number(cells[maxVelIdx] ?? 0) || vel
    const velLev = velLevIdx !== -1 ? Number(cells[velLevIdx] ?? 0) || 0 : 0
    const accel = accelIdx !== -1 ? Number(cells[accelIdx] ?? 0) || 0 : 0
    const range = Number(cells[rangeIdx] ?? 0) || 0
    const levRange = Number(cells[levRangeIdx] ?? 0) || 0
    const celFile = (cells[celFileIdx] ?? '').trim()
    const animLen = Number(cells[animLenIdx] ?? 0) || 0
    const animSpeed = Number(cells[animSpeedIdx] ?? 0) || 0
    const loopAnim = Number(cells[loopAnimIdx] ?? 0) || 0
    const subLoop = subLoopIdx !== -1 ? Number(cells[subLoopIdx] ?? 0) || 0 : 0
    const subStart = subStartIdx !== -1 ? Number(cells[subStartIdx] ?? 0) || 0 : 0
    const subStop = subStopIdx !== -1 ? Number(cells[subStopIdx] ?? 0) || 0 : 0
    const numDirections = Number(cells[numDirIdx] ?? 0) || 1
    const explosionMissile = (cells[explIdx] ?? '').trim()
    const light = Number(cells[lightIdx] ?? 0) || 0
    const red = parseColorChannel(cells[redIdx])
    const green = parseColorChannel(cells[greenIdx])
    const blue = parseColorChannel(cells[blueIdx])
    const nextHit = Number(cells[nextHitIdx] ?? 0) || 0
    const nextDelay = Number(cells[nextDelayIdx] ?? 0) || 0
    const trans = Number(cells[transIdx] ?? 0) || 0
    const progOverlay = progOverlayIdx !== -1 ? (cells[progOverlayIdx] ?? '').trim().toLowerCase() : ''
    const pCltDoFunc = pCltDoFuncIdx !== -1 ? Number(cells[pCltDoFuncIdx] ?? 0) || 0 : 0
    const pCltHitFunc = pCltHitFuncIdx !== -1 ? Number(cells[pCltHitFuncIdx] ?? 0) || 0 : 0
    const cHitPar1 = cHitPar1Idx !== -1 ? Number(cells[cHitPar1Idx] ?? 0) || 0 : 0
    const cHitPar2 = cHitPar2Idx !== -1 ? Number(cells[cHitPar2Idx] ?? 0) || 0 : 0
    const cltSubMissile1 = cltSubMissile1Idx !== -1 ? (cells[cltSubMissile1Idx] ?? '').trim().toLowerCase() : ''
    const cltSubMissile2 = cltSubMissile2Idx !== -1 ? (cells[cltSubMissile2Idx] ?? '').trim().toLowerCase() : ''
    const cltHitSubMissile1 = cltHitSubMissile1Idx !== -1 ? (cells[cltHitSubMissile1Idx] ?? '').trim().toLowerCase() : ''
    const cltHitSubMissile2 = cltHitSubMissile2Idx !== -1 ? (cells[cltHitSubMissile2Idx] ?? '').trim().toLowerCase() : ''
    const collideFriend = collideFriendIdx !== -1 ? Number(cells[collideFriendIdx] ?? 0) || 0 : 0
    const holy = holyIdx !== -1 ? Number(cells[holyIdx] ?? 0) || 0 : 0

    const rec: MissileTxtData = {
      name,
      id: Number(cells[idIdx] ?? 0) || 0,
      vel,
      maxVel,
      ...(velLev !== 0 ? { velLev } : {}),
      ...(accel !== 0 ? { accel } : {}),
      range,
      levRange,
      celFile,
      animLen,
      animSpeed,
      loopAnim,
      ...(subLoop !== 0 ? { subLoop } : {}),
      ...(subStart !== 0 ? { subStart } : {}),
      ...(subStop !== 0 ? { subStop } : {}),
      numDirections,
      explosionMissile,
      light,
      red,
      green,
      blue,
      nextHit,
      nextDelay,
      trans,
      ...(progOverlay !== '' ? { progOverlay } : {}),
      ...(pCltDoFunc !== 0 ? { pCltDoFunc } : {}),
      ...(pCltHitFunc !== 0 ? { pCltHitFunc } : {}),
      ...(cHitPar1 !== 0 ? { cHitPar1 } : {}),
      ...(cHitPar2 !== 0 ? { cHitPar2 } : {}),
      ...(cltSubMissile1 !== '' ? { cltSubMissile1 } : {}),
      ...(cltSubMissile2 !== '' ? { cltSubMissile2 } : {}),
      ...(cltHitSubMissile1 !== '' ? { cltHitSubMissile1 } : {}),
      ...(cltHitSubMissile2 !== '' ? { cltHitSubMissile2 } : {}),
      ...(collideFriend !== 0 ? { collideFriend } : {}),
      ...(holy !== 0 ? { holy } : {}),
      speedPxPerSec: vel * 25,
      distancePx: vel * range,
    }
    map.set(name, rec)
  }
  return map
}

/**
 * Extracts missile speed and flight distance from a Missiles.txt table or parsed records.
 */
export function getMissileTxtData(
  missileName: string,
  missilesSource?:
    | Map<string, MissileTxtData>
    | { rows: readonly Readonly<Record<string, string>>[] }
    | { header: readonly string[]; rows: readonly (readonly string[])[] }
    | string
    | undefined,
): MissileTxtData {
  const key = missileName.trim().toLowerCase()
  if (!missilesSource) {
    const canonical = CANONICAL_113C_MISSILES[key]
    if (!canonical) {
      throw new Error(`Unknown missile "${missileName}" in Missiles.txt`)
    }
    return canonical
  }

  if (typeof missilesSource === 'string') {
    const parsed = parseMissilesTxt(missilesSource)
    return parsed.get(key) ?? getMissileTxtData(missileName, undefined)
  }

  if (missilesSource instanceof Map) {
    return missilesSource.get(key) ?? getMissileTxtData(missileName, undefined)
  }

  // D2Table ({ header, rows })
  if ('header' in missilesSource && Array.isArray((missilesSource as any).header)) {
    const t = missilesSource as { header: readonly string[]; rows: readonly (readonly string[])[] }
    const mIdx = t.header.indexOf('Missile')
    if (mIdx !== -1) {
      const row = t.rows.find(r => (r[mIdx] ?? '').trim().toLowerCase() === key)
      if (row) {
        const vel = Number(row[t.header.indexOf('Vel')] ?? 0) || 0
        const maxVel = Number(row[t.header.indexOf('MaxVel')] ?? 0) || vel
        const velLevColIdx = t.header.indexOf('VelLev')
        const velLev = velLevColIdx !== -1 ? Number(row[velLevColIdx] ?? 0) || 0 : 0
        const accelColIdx = t.header.indexOf('Accel')
        const accel = accelColIdx !== -1 ? Number(row[accelColIdx] ?? 0) || 0 : 0
        const range = Number(row[t.header.indexOf('Range')] ?? 0) || 0
        const levRange = Number(row[t.header.indexOf('LevRange')] ?? 0) || 0
        const celFile = (row[t.header.indexOf('CelFile')] ?? '').trim()
        const animLen = Number(row[t.header.indexOf('AnimLen')] ?? 0) || 0
        const animSpeed = Number(row[t.header.indexOf('AnimSpeed')] ?? 0) || 0
        const loopAnim = Number(row[t.header.indexOf('LoopAnim')] ?? 0) || 0
        const numDirections = Number(row[t.header.indexOf('NumDirections')] ?? 0) || 1
        const explosionMissile = (row[t.header.indexOf('ExplosionMissile')] ?? '').trim()
        const light = Number(row[t.header.indexOf('Light')] ?? 0) || 0
        const red = parseColorChannel(row[t.header.indexOf('Red')])
        const green = parseColorChannel(row[t.header.indexOf('Green')])
        const blue = parseColorChannel(row[t.header.indexOf('Blue')])
        const transColIdx = t.header.indexOf('Trans')
        const trans = transColIdx !== -1 ? Number(row[transColIdx] ?? 0) || 0 : 0
        return {
          name: key,
          id: Number(row[t.header.indexOf('Id')] ?? 0) || 0,
          vel,
          maxVel,
          ...(velLev !== 0 ? { velLev } : {}),
          ...(accel !== 0 ? { accel } : {}),
          range,
          levRange,
          celFile,
          animLen,
          animSpeed,
          loopAnim,
          numDirections,
          explosionMissile,
          light,
          red,
          green,
          blue,
          trans,
          speedPxPerSec: vel * 25,
          distancePx: vel * range,
        }
      }
    }
  }

  // DataTable ({ rows: Record<string, string>[] })
  if ('rows' in missilesSource && !('header' in missilesSource)) {
    const tableRows = missilesSource.rows as readonly Readonly<Record<string, string>>[]
    const row = tableRows.find(
      r => (r['Missile'] ?? r['missile'] ?? '').trim().toLowerCase() === key,
    )
    if (row) {
      const vel = Number(row['Vel'] ?? row['vel'] ?? 0) || 0
      const maxVel = Number(row['MaxVel'] ?? row['maxvel'] ?? 0) || vel
      const velLev = Number(row['VelLev'] ?? row['vellev'] ?? 0) || 0
      const accel = Number(row['Accel'] ?? row['accel'] ?? 0) || 0
      const range = Number(row['Range'] ?? row['range'] ?? 0) || 0
      const levRange = Number(row['LevRange'] ?? row['levrange'] ?? 0) || 0
      const celFile = (row['CelFile'] ?? row['celfile'] ?? '').trim()
      const animLen = Number(row['AnimLen'] ?? row['animlen'] ?? 0) || 0
      const animSpeed = Number(row['AnimSpeed'] ?? row['animspeed'] ?? 0) || 0
      const loopAnim = Number(row['LoopAnim'] ?? row['loopanim'] ?? 0) || 0
      const numDirections = Number(row['NumDirections'] ?? row['numdirections'] ?? 0) || 1
      const explosionMissile = (row['ExplosionMissile'] ?? row['explosionmissile'] ?? '').trim()
      const light = Number(row['Light'] ?? row['light'] ?? 0) || 0
      const red = parseColorChannel(row['Red'] ?? row['red'])
      const green = parseColorChannel(row['Green'] ?? row['green'])
      const blue = parseColorChannel(row['Blue'] ?? row['blue'])
      const trans = Number(row['Trans'] ?? row['trans'] ?? 0) || 0
      return {
        name: key,
        id: Number(row['Id'] ?? row['id'] ?? 0) || 0,
        vel,
        maxVel,
        ...(velLev !== 0 ? { velLev } : {}),
        ...(accel !== 0 ? { accel } : {}),
        range,
        levRange,
        celFile,
        animLen,
        animSpeed,
        loopAnim,
        numDirections,
        explosionMissile,
        light,
        red,
        green,
        blue,
        trans,
        speedPxPerSec: vel * 25,
        distancePx: vel * range,
      }
    }
  }

  return getMissileTxtData(missileName, undefined)
}

/**
 * Data extracted from Diablo II 1.13c Overlay.txt for visual overlay effects.
 */
export interface OverlayTxtData {
  readonly id?: number
  readonly overlay: string
  readonly filename: string
  readonly frames: number
  readonly animRate: number
  readonly trans: number
  readonly preDraw: boolean
  readonly initRadius: number
  readonly radius: number
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly numDirections?: number
  readonly xOffset?: number
  readonly yOffset?: number
  readonly height1?: number
  readonly height2?: number
  readonly height3?: number
  readonly height4?: number
}

/**
 * Every Diablo II 1.13c `Overlay.txt` row (293 compiled `overlay.bin` records, OVERLAY_TXT_ROWS), keyed by the
 * lower-cased row name. Generated from the table — never hand-written — so frames / AnimRate / Trans / PreDraw /
 * light / offsets always equal the 1.13c data (Issues #1067, #1068).
 */
export const CANONICAL_113C_OVERLAYS: Readonly<Record<string, OverlayTxtData>> = Object.freeze(
  Object.fromEntries(
    OVERLAY_TXT_ROWS.map((r, id): [string, OverlayTxtData] => [
      r.name.trim().toLowerCase(),
      Object.freeze({
        id,
        overlay: r.name,
        filename: r.filename,
        frames: r.frames,
        animRate: r.animRate,
        trans: r.trans,
        preDraw: r.preDraw !== 0,
        initRadius: r.initRadius,
        radius: r.radius,
        red: r.red,
        green: r.green,
        blue: r.blue,
        numDirections: r.numDirections,
        xOffset: r.xOffset,
        yOffset: r.yOffset,
        height1: r.height[0],
        height2: r.height[1],
        height3: r.height[2],
        height4: r.height[3],
      }),
    ]),
  ),
)

/** The 1.13c `Overlay.txt` row for `overlayName` (case-insensitive row name), or `undefined`. */
export function findOverlayTxtData(overlayName: string): OverlayTxtData | undefined {
  return CANONICAL_113C_OVERLAYS[overlayName.trim().toLowerCase()]
}

/**
 * Parses raw Overlay.txt text into a Map of overlay records.
 */
export function parseOverlayTxt(content: string): Map<string, OverlayTxtData> {
  const map = new Map<string, OverlayTxtData>()
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length < 2) return map
  const headers = lines[0]!.split('\t').map(h => h.trim())
  const col = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())

  const overlayIdx = col('overlay')
  const filenameIdx = col('Filename')
  const framesIdx = col('Frames')
  const animRateIdx = col('AnimRate')
  const transIdx = col('Trans')
  const preDrawIdx = col('PreDraw')
  const initRadiusIdx = col('InitRadius')
  const radiusIdx = col('Radius')
  const redIdx = col('Red')
  const greenIdx = col('Green')
  const blueIdx = col('Blue')
  const numDirIdx = col('NumDirections')
  const xOffsetIdx = col('Xoffset')
  const yOffsetIdx = col('Yoffset')

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split('\t')
    const rawName = (cells[overlayIdx] ?? '').trim()
    const name = rawName.toLowerCase()
    if (!name || name === 'expansion') continue

    const filename = (cells[filenameIdx] ?? '').trim()
    const frames = Number(cells[framesIdx] ?? 1) || 1
    const animRate = Number(cells[animRateIdx] ?? 16) || 16
    const trans = Number(cells[transIdx] ?? 0) || 0
    const preDraw = Number(cells[preDrawIdx] ?? 0) !== 0
    const initRadius = Number(cells[initRadiusIdx] ?? 0) || 0
    const radius = Number(cells[radiusIdx] ?? 0) || 0
    const red = parseColorChannel(cells[redIdx])
    const green = parseColorChannel(cells[greenIdx])
    const blue = parseColorChannel(cells[blueIdx])
    const numDirections = Number(cells[numDirIdx] ?? 1) || 1
    const xOffset = Number(cells[xOffsetIdx] ?? 0) || 0
    const yOffset = Number(cells[yOffsetIdx] ?? 0) || 0

    const rec: OverlayTxtData = {
      overlay: rawName,
      filename,
      frames,
      animRate,
      trans,
      preDraw,
      initRadius,
      radius,
      red,
      green,
      blue,
      numDirections,
      xOffset,
      yOffset,
    }
    map.set(name, rec)
    if (filename) {
      map.set(filename.toLowerCase(), rec)
    }
  }
  return map
}

/**
 * Extracts overlay data from an Overlay.txt table or parsed records.
 */
export function getOverlayTxtData(
  overlayName: string,
  overlaySource?:
    | Map<string, OverlayTxtData>
    | { rows: readonly Readonly<Record<string, string>>[] }
    | { header: readonly string[]; rows: readonly (readonly string[])[] }
    | string
    | undefined,
): OverlayTxtData {
  const key = overlayName.trim().toLowerCase()
  if (!overlaySource) {
    const row = CANONICAL_113C_OVERLAYS[key]
    if (row === undefined) {
      // Anti-silent-failure (Issue #1068): an unknown name is an invented token, never a fabricated row.
      throw new Error(`getOverlayTxtData: '${overlayName}' is not a 1.13c Overlay.txt row`)
    }
    return row
  }

  if (typeof overlaySource === 'string') {
    const parsed = parseOverlayTxt(overlaySource)
    return parsed.get(key) ?? getOverlayTxtData(overlayName, undefined)
  }

  if (overlaySource instanceof Map) {
    return overlaySource.get(key) ?? getOverlayTxtData(overlayName, undefined)
  }

  // D2Table ({ header, rows })
  if ('header' in overlaySource && Array.isArray((overlaySource as any).header)) {
    const t = overlaySource as { header: readonly string[]; rows: readonly (readonly string[])[] }
    const oIdx = t.header.indexOf('Overlay')
    const fIdx = t.header.indexOf('Filename')
    const row = t.rows.find(
      r => (oIdx !== -1 && (r[oIdx] ?? '').trim().toLowerCase() === key) ||
           (fIdx !== -1 && (r[fIdx] ?? '').trim().toLowerCase() === key),
    )
    if (row) {
      return {
        overlay: oIdx !== -1 ? (row[oIdx] ?? key).trim() : key,
        filename: fIdx !== -1 ? (row[fIdx] ?? '').trim() : '',
        frames: Number(row[t.header.indexOf('Frames')] ?? 1) || 1,
        animRate: Number(row[t.header.indexOf('AnimRate')] ?? 16) || 16,
        trans: Number(row[t.header.indexOf('Trans')] ?? 0) || 0,
        preDraw: Number(row[t.header.indexOf('PreDraw')] ?? 0) !== 0,
        initRadius: Number(row[t.header.indexOf('InitRadius')] ?? 0) || 0,
        radius: Number(row[t.header.indexOf('Radius')] ?? 0) || 0,
        red: parseColorChannel(row[t.header.indexOf('Red')]),
        green: parseColorChannel(row[t.header.indexOf('Green')]),
        blue: parseColorChannel(row[t.header.indexOf('Blue')]),
        numDirections: Number(row[t.header.indexOf('NumDirections')] ?? 1) || 1,
        xOffset: Number(row[t.header.indexOf('Xoffset')] ?? 0) || 0,
        yOffset: Number(row[t.header.indexOf('Yoffset')] ?? 0) || 0,
      }
    }
  }

  // DataTable ({ rows: Record<string, string>[] })
  if ('rows' in overlaySource && !('header' in overlaySource)) {
    const tableRows = overlaySource.rows as readonly Readonly<Record<string, string>>[]
    const row = tableRows.find(
      r => (r['overlay'] ?? r['Overlay'] ?? '').trim().toLowerCase() === key ||
           (r['Filename'] ?? r['filename'] ?? '').trim().toLowerCase() === key,
    )
    if (row) {
      return {
        overlay: (row['overlay'] ?? row['Overlay'] ?? key).trim(),
        filename: (row['Filename'] ?? row['filename'] ?? '').trim(),
        frames: Number(row['Frames'] ?? row['frames'] ?? 1) || 1,
        animRate: Number(row['AnimRate'] ?? row['animrate'] ?? 16) || 16,
        trans: Number(row['Trans'] ?? row['trans'] ?? 0) || 0,
        preDraw: Number(row['PreDraw'] ?? row['predraw'] ?? 0) !== 0,
        initRadius: Number(row['InitRadius'] ?? row['initradius'] ?? 0) || 0,
        radius: Number(row['Radius'] ?? row['radius'] ?? 0) || 0,
        red: parseColorChannel(row['Red'] ?? row['red']),
        green: parseColorChannel(row['Green'] ?? row['green']),
        blue: parseColorChannel(row['Blue'] ?? row['blue']),
        numDirections: Number(row['NumDirections'] ?? row['numdirections'] ?? 1) || 1,
        xOffset: Number(row['Xoffset'] ?? row['xoffset'] ?? 0) || 0,
        yOffset: Number(row['Yoffset'] ?? row['yoffset'] ?? 0) || 0,
      }
    }
  }

  return getOverlayTxtData(overlayName, undefined)
}

/**
 * An active unit overlay in the world (e.g. cast overlay, aura, buff visual).
 */
export interface ActiveOverlay {
  readonly id: string
  readonly overlayName: string
  readonly casterId: string
  x: number
  y: number
  frame: number
  readonly maxFrames: number
  readonly animRate: number
  readonly preDraw: boolean
  readonly trans: number
  readonly lightRadius: number
  readonly lightColor: readonly [number, number, number]
  expired: boolean
  readonly loop?: boolean | undefined
  readonly targetMonsterIndex?: number | undefined
  readonly isAura?: boolean | undefined
  readonly auraSkillId?: number | undefined
  readonly isCastOverlay?: boolean | undefined
  readonly isStateOverlay?: boolean | undefined
  readonly stateGroup?: number | undefined
}

export interface CreateActiveOverlayOptions {
  readonly id?: string | undefined
  readonly loop?: boolean | undefined
  readonly targetMonsterIndex?: number | undefined
  readonly isAura?: boolean | undefined
  readonly auraSkillId?: number | undefined
  readonly isCastOverlay?: boolean | undefined
  readonly isStateOverlay?: boolean | undefined
  readonly stateGroup?: number | undefined
}

let overlaySeqCounter = 0

export function resetOverlaySeqCounter(): void {
  overlaySeqCounter = 0
}

const reportedInventedOverlayTokens = new Set<string>()

/**
 * Runtime overlay lookup for the attach/spawn paths: the real Overlay.txt row, or — for a legacy invented token that is
 * not an Overlay.txt row (tracked by Issue #1069, which replaces every such call site with the real row) — a loudly
 * reported neutral placeholder (no light, 1-frame-per-tick default timing) so one bad token cannot abort a frame.
 * Callers that need the authoritative row must use {@link getOverlayTxtData}, which throws on unknown names.
 */
export function resolveRuntimeOverlayTxtData(
  overlayName: string,
  overlaySource?: Map<string, OverlayTxtData> | string,
): OverlayTxtData {
  try {
    return getOverlayTxtData(overlayName, overlaySource)
  } catch (err) {
    const key = overlayName.trim().toLowerCase()
    if (!reportedInventedOverlayTokens.has(key)) {
      reportedInventedOverlayTokens.add(key)
      console.error(`[overlay] ${(err as Error).message} (invented token, Issue #1069)`)
    }
    return {
      overlay: overlayName,
      filename: overlayName,
      frames: 14,
      animRate: 16,
      trans: 3,
      preDraw: false,
      initRadius: 0,
      radius: 0,
      red: 255,
      green: 255,
      blue: 255,
    }
  }
}

/**
 * Creates an ActiveOverlay entity initialized at the caster's coordinates.
 */
export function createActiveOverlay(
  overlayName: string,
  caster: { x: number; y: number },
  casterId = 'player',
  overlaySource?: Map<string, OverlayTxtData> | string,
  options?: CreateActiveOverlayOptions,
): ActiveOverlay {
  const data = resolveRuntimeOverlayTxtData(overlayName, overlaySource)
  const cleanName = overlayName.trim().toLowerCase()
  const isColdArmor = ['frozenarmor', 'shiverarmor', 'chillingarmor', 'chillarmor'].includes(cleanName)
  const isKnownState = [
    'frozenarmor',
    'shiverarmor',
    'chillingarmor',
    'chillarmor',
    'energyshield',
    'enchant',
    'thunderstormback',
    'cyclonearmor',
    'cyclone_armor',
    'cyclonearmor1front',
    'cyclonearmor2front',
    'cyclonearmor3front',
  ].includes(cleanName)
  const isStateOverlay = options?.isStateOverlay ?? isKnownState
  const isCastOverlay = options?.isCastOverlay ?? (!isStateOverlay && !options?.isAura)
  const stateGroup = options?.stateGroup ?? (isColdArmor ? 1 : 0)

  return {
    id: options?.id ?? `overlay_${overlayName}_${++overlaySeqCounter}`,
    overlayName: data.overlay,
    casterId,
    x: caster.x,
    y: caster.y,
    frame: 0,
    maxFrames: data.frames,
    animRate: data.animRate,
    preDraw: data.preDraw,
    trans: data.trans,
    lightRadius: data.radius,
    lightColor: [data.red, data.green, data.blue] as const,
    expired: false,
    loop: options?.loop,
    targetMonsterIndex: options?.targetMonsterIndex,
    isAura: options?.isAura,
    auraSkillId: options?.auraSkillId,
    isCastOverlay,
    isStateOverlay,
    stateGroup,
  }
}

/**
 * Authentic Diablo II v1.13c Paladin aura overlay parts, resolved from the data chain
 * Skills.txt `aurastate` -> States.txt `overlay1` / `overlay2` -> Overlay.txt row name.
 * - 13 auras have TWO visible parts: front (Overlay.txt PreDraw=0) + back (PreDraw=1).
 * - 7 auras are a single visible ring. States.txt also lists a second Overlay.txt row whose
 *   Filename is `null` (convictionfront, meditationback, redemptionfront: 2 empty frames) for
 *   Conviction / Meditation / Redemption; those rows draw nothing and are therefore not spawned.
 * Every name here is a real Overlay.txt row (CANONICAL_113C_OVERLAYS), never an invented token (Issue #1069).
 */
export const PALADIN_AURA_OVERLAY_PARTS: Readonly<Record<number, readonly string[]>> = Object.freeze({
  98: ['aura_might_front', 'aura_might_back'], // Might -> state might
  99: ['aura_prayer_front', 'aura_prayer_back'], // Prayer -> state prayer
  100: ['aura_resistfire'], // Resist Fire -> state resistfire
  102: ['aura_holyfire_front', 'aura_holyfire_back'], // Holy Fire -> state holyfire
  103: ['aura_thorns_front', 'aura_thorns_back'], // Thorns -> state thorns
  104: ['aura_defiance_front', 'aura_defiance_back'], // Defiance -> state defiance
  105: ['aura_resistcold'], // Resist Cold -> state resistcold
  108: ['blessedaimfront', 'blessedaimback'], // Blessed Aim -> state blessedaim
  109: ['cleansingfront', 'cleansingback'], // Cleansing -> state cleansing
  110: ['aura_resistlight'], // Resist Lightning -> state resistlight
  113: ['concentrationfront', 'concentrationback'], // Concentration -> state concentration
  114: ['holyfreeze'], // Holy Freeze -> state holywind
  115: ['staminafront', 'staminaback'], // Vigor -> state stamina
  118: ['holyshockfront', 'holyshockback'], // Holy Shock -> state holyshock
  119: ['sanctuaryfront', 'sanctuaryback'], // Sanctuary -> state sanctuary
  120: ['meditationfront'], // Meditation -> state meditation (meditationback Filename=null)
  122: ['fanaticismfront', 'fanaticismback'], // Fanaticism -> state fanaticism
  123: ['convictionback'], // Conviction -> state conviction (convictionfront Filename=null)
  124: ['redemptionback'], // Redemption -> state redemption (redemptionfront Filename=null)
  125: ['aura_resistall_front', 'aura_resistall_back'], // Salvation -> state resistall
})

/** Canonical 1.13c primary (first visible) Overlay.txt row for every Paladin aura skill (IDs 98..125). */
export const PALADIN_AURA_OVERLAYS: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(PALADIN_AURA_OVERLAY_PARTS).map(([id, parts]): [string, string] => [id, parts[0]!]),
  ),
)

export const PALADIN_AURA_SKILL_IDS: ReadonlySet<number> = new Set(
  Object.keys(PALADIN_AURA_OVERLAYS).map(Number),
)

export function isAuraSkill(skillId: number): boolean {
  return PALADIN_AURA_SKILL_IDS.has(skillId)
}

export function getAuraOverlayName(skillId: number): string | null {
  return PALADIN_AURA_OVERLAYS[skillId] ?? null
}

export function getAuraOverlayNames(skillId: number): readonly string[] {
  return PALADIN_AURA_OVERLAY_PARTS[skillId] ?? (PALADIN_AURA_OVERLAYS[skillId] ? [PALADIN_AURA_OVERLAYS[skillId]] : [])
}

const SKILL_OVERLAY_ROW_BY_ID_113C: ReadonlyMap<number, SkillOverlayRow113c> = new Map(
  SKILL_OVERLAY_ROWS_113C.map(r => [r.id, r] as const),
)

const normalizeSkillName113c = (name: string): string => name.toLowerCase().replace(/[\s_-]/g, '')

const SKILL_OVERLAY_ROW_BY_NAME_113C: ReadonlyMap<string, SkillOverlayRow113c> = new Map(
  SKILL_OVERLAY_ROWS_113C.map(r => [normalizeSkillName113c(r.skill), r] as const),
)

/** The generated 1.13c Skills.txt overlay row (castoverlay / prgoverlay / cltstfunc) for a skill id, if any. */
export function getSkillOverlayRow113c(skillId: number): SkillOverlayRow113c | undefined {
  return SKILL_OVERLAY_ROW_BY_ID_113C.get(skillId)
}

/** Sorceress (Skills.txt ids 36-65) `castoverlay` column, derived from the generated Skills.txt table. */
export const SORCERESS_SKILL_CAST_OVERLAYS: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(
    SKILL_OVERLAY_ROWS_113C.filter(r => r.id >= 36 && r.id <= 65 && r.castOverlay !== '').map(r => [
      r.id,
      r.castOverlay,
    ]),
  ),
)

/**
 * Skills.txt `castoverlay` (+0x106) for a skill id (number or numeric string) or Skills.txt `skill` name
 * (case / space / underscore insensitive). Read straight from the generated 1.13c table for all 357 rows,
 * including monster skills (Issue #1066); `prgoverlay` is NOT a cast overlay (Issue #1065).
 */
export function getSkillCastOverlay(skillId: number | string): string | undefined {
  let row: SkillOverlayRow113c | undefined
  if (typeof skillId === 'number') {
    row = SKILL_OVERLAY_ROW_BY_ID_113C.get(skillId)
  } else {
    const num = parseInt(skillId, 10)
    row = !Number.isNaN(num)
      ? SKILL_OVERLAY_ROW_BY_ID_113C.get(num)
      : SKILL_OVERLAY_ROW_BY_NAME_113C.get(normalizeSkillName113c(skillId.trim()))
  }
  return row !== undefined && row.castOverlay !== '' ? row.castOverlay : undefined
}


export interface SkillExecutionContext {
  readonly caster: CombatPlayer
  readonly target?: { x: number; y: number; id?: string } | undefined
  readonly skillLevel: number       // effective level: hardPoints + softPoints
  readonly hardPoints?: number | undefined       // base points blvl: 0..20 (for synergy evaluation)
  readonly synergyMultiplier?: number | undefined // computed from skill-tree
}

export type SkillType =
  | 'projectile'
  | 'melee'
  | 'area'
  | 'buff'
  | 'curse'
  | 'movement'
  | 'summon'
  | 'aura'
  | 'passive'

export interface Batch1SkillDef {
  readonly id: number
  readonly name: string
  readonly classCode: CharacterClassCode
  readonly charClass: string
  readonly type: SkillType
  readonly mana: number
  readonly lvlmana: number
  readonly minmana: number
  readonly manashift: number
  readonly delay: number
  readonly hitshift: number
  readonly emin: number
  readonly emax: number
  readonly elev1: number
  readonly elev2: number
  readonly elev3: number
  readonly elev4: number
  readonly elev5: number
  readonly emaxlev1?: number
  readonly emaxlev2?: number
  readonly emaxlev3?: number
  readonly emaxlev4?: number
  readonly emaxlev5?: number
  readonly srcDamage: number
  readonly range?: number
  readonly speed?: number
  readonly castOverlay?: string
  readonly srvdofunc?: number | undefined
  readonly castDelay?: number | undefined
}

export const BATCH1_SKILLS: Readonly<Record<number, Batch1SkillDef>> = Object.freeze({
  // Amazon (5 skills)
  6: { id: 6, name: 'Magic Arrow', classCode: 'ama', charClass: 'amazon', type: 'projectile', mana: 12, lvlmana: -1, minmana: 0, manashift: 5, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 128, range: 480, speed: 600 },
  7: { id: 7, name: 'Fire Arrow', classCode: 'ama', charClass: 'amazon', type: 'projectile', mana: 24, lvlmana: 1, minmana: 1, manashift: 5, delay: 0, hitshift: 8, emin: 1, emax: 4, elev1: 2, elev2: 3, elev3: 6, elev4: 12, elev5: 24, emaxlev1: 2, emaxlev2: 3, emaxlev3: 7, emaxlev4: 14, emaxlev5: 27, srcDamage: 128, range: 480, speed: 600 },
  10: { id: 10, name: 'Jab', classCode: 'ama', charClass: 'amazon', type: 'melee', mana: 8, lvlmana: 1, minmana: 1, manashift: 6, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 128 },
  11: { id: 11, name: 'Cold Arrow', classCode: 'ama', charClass: 'amazon', type: 'projectile', mana: 28, lvlmana: 1, minmana: 1, manashift: 5, delay: 0, hitshift: 7, emin: 6, emax: 8, elev1: 4, elev2: 5, elev3: 8, elev4: 16, elev5: 42, emaxlev1: 4, emaxlev2: 5, emaxlev3: 9, emaxlev4: 17, emaxlev5: 44, srcDamage: 128, range: 480, speed: 600 },
  14: { id: 14, name: 'Power Strike', classCode: 'ama', charClass: 'amazon', type: 'melee', mana: 8, lvlmana: 1, minmana: 1, manashift: 6, delay: 0, hitshift: 8, emin: 1, emax: 16, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, emaxlev1: 18, emaxlev2: 36, emaxlev3: 54, emaxlev4: 72, emaxlev5: 90, srcDamage: 128 },

  // Sorceress (6 skills)
  36: { id: 36, name: 'Fire Bolt', classCode: 'sor', charClass: 'sorceress', type: 'projectile', mana: 5, lvlmana: 0, minmana: 1, manashift: 7, delay: 0, hitshift: 7, emin: 6, emax: 12, elev1: 3, elev2: 4, elev3: 8, elev4: 18, elev5: 54, emaxlev1: 3, emaxlev2: 6, emaxlev3: 10, emaxlev4: 20, emaxlev5: 56, srcDamage: 0, range: 1000, speed: 500, castOverlay: 'fire_cast_1' },
  37: { id: 37, name: 'Warmth', classCode: 'sor', charClass: 'sorceress', type: 'passive', mana: 0, lvlmana: 0, minmana: 0, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  39: { id: 39, name: 'Ice Bolt', classCode: 'sor', charClass: 'sorceress', type: 'projectile', mana: 3, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 7, emin: 6, emax: 10, elev1: 2, elev2: 4, elev3: 6, elev4: 8, elev5: 10, emaxlev1: 3, emaxlev2: 5, emaxlev3: 7, emaxlev4: 9, emaxlev5: 11, srcDamage: 0, range: 400, speed: 450, castOverlay: 'ice_cast_1' },
  44: { id: 44, name: 'Frost Nova', classCode: 'sor', charClass: 'sorceress', type: 'area', mana: 9, lvlmana: 1, minmana: 1, manashift: 8, delay: 0, hitshift: 7, emin: 4, emax: 8, elev1: 4, elev2: 6, elev3: 8, elev4: 10, elev5: 12, emaxlev1: 5, emaxlev2: 7, emaxlev3: 9, emaxlev4: 11, emaxlev5: 13, srcDamage: 0, castOverlay: 'ice_cast_2' },
  47: { id: 47, name: 'Fire Ball', classCode: 'sor', charClass: 'sorceress', type: 'projectile', mana: 10, lvlmana: 1, minmana: 1, manashift: 7, delay: 0, hitshift: 7, emin: 12, emax: 28, elev1: 13, elev2: 23, elev3: 28, elev4: 33, elev5: 38, emaxlev1: 15, emaxlev2: 25, emaxlev3: 30, emaxlev4: 35, emaxlev5: 40, srcDamage: 0, range: 450, speed: 450, castOverlay: 'fire_cast_2' },
  54: { id: 54, name: 'Teleport', classCode: 'sor', charClass: 'sorceress', type: 'movement', mana: 24, lvlmana: -1, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0, castOverlay: 'teleport' },

  // Necromancer (5 skills)
  66: { id: 66, name: 'Amplify Damage', classCode: 'nec', charClass: 'necromancer', type: 'curse', mana: 4, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  67: { id: 67, name: 'Teeth', classCode: 'nec', charClass: 'necromancer', type: 'area', mana: 6, lvlmana: 1, minmana: 1, manashift: 7, delay: 0, hitshift: 7, emin: 4, emax: 8, elev1: 2, elev2: 2, elev3: 3, elev4: 4, elev5: 5, emaxlev1: 2, emaxlev2: 3, emaxlev3: 4, emaxlev4: 5, emaxlev5: 6, srcDamage: 0 },
  68: { id: 68, name: 'Bone Armor', classCode: 'nec', charClass: 'necromancer', type: 'buff', mana: 11, lvlmana: 1, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  70: { id: 70, name: 'Raise Skeleton', classCode: 'nec', charClass: 'necromancer', type: 'summon', mana: 6, lvlmana: 1, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 1, elev3: 2, elev4: 3, elev5: 4, srcDamage: 0 },
  74: { id: 74, name: 'Corpse Explosion', classCode: 'nec', charClass: 'necromancer', type: 'area', mana: 15, lvlmana: 1, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },

  // Paladin (6 skills)
  96: { id: 96, name: 'Sacrifice', classCode: 'pal', charClass: 'paladin', type: 'melee', mana: 0, lvlmana: 0, minmana: 0, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 128 },
  97: { id: 97, name: 'Smite', classCode: 'pal', charClass: 'paladin', type: 'melee', mana: 2, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  98: { id: 98, name: 'Might', classCode: 'pal', charClass: 'paladin', type: 'aura', mana: 0, lvlmana: 0, minmana: 0, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  101: { id: 101, name: 'Holy Bolt', classCode: 'pal', charClass: 'paladin', type: 'projectile', mana: 32, lvlmana: 1, minmana: 1, manashift: 4, delay: 0, hitshift: 8, emin: 8, emax: 16, elev1: 8, elev2: 10, elev3: 13, elev4: 16, elev5: 20, emaxlev1: 8, emaxlev2: 11, emaxlev3: 15, emaxlev4: 18, emaxlev5: 23, srcDamage: 0, range: 450, speed: 450 },
  106: { id: 106, name: 'Zeal', classCode: 'pal', charClass: 'paladin', type: 'melee', mana: 2, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 128 },
  112: { id: 112, name: 'Blessed Hammer', classCode: 'pal', charClass: 'paladin', type: 'area', mana: 20, lvlmana: 1, minmana: 1, manashift: 6, delay: 0, hitshift: 8, emin: 12, emax: 16, elev1: 8, elev2: 10, elev3: 12, elev4: 13, elev5: 14, srcDamage: 0 },

  // Barbarian (6 skills)
  126: { id: 126, name: 'Bash', classCode: 'bar', charClass: 'barbarian', type: 'melee', mana: 2, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 128 },
  130: { id: 130, name: 'Howl', classCode: 'bar', charClass: 'barbarian', type: 'curse', mana: 4, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  132: { id: 132, name: 'Leap', classCode: 'bar', charClass: 'barbarian', type: 'movement', mana: 2, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  133: { id: 133, name: 'Double Swing', classCode: 'bar', charClass: 'barbarian', type: 'melee', mana: 8, lvlmana: -1, minmana: 0, manashift: 5, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 128 },
  138: { id: 138, name: 'Shout', classCode: 'bar', charClass: 'barbarian', type: 'buff', mana: 6, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  143: { id: 143, name: 'Leap Attack', classCode: 'bar', charClass: 'barbarian', type: 'melee', mana: 9, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 128 },

  // Druid (5 skills)
  223: { id: 223, name: 'Werewolf', classCode: 'dru', charClass: 'druid', type: 'buff', mana: 15, lvlmana: 0, minmana: 1, manashift: 8, delay: 25, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 128 },
  224: { id: 224, name: 'Lycanthropy', classCode: 'dru', charClass: 'druid', type: 'passive', mana: 0, lvlmana: 0, minmana: 0, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  225: { id: 225, name: 'Firestorm', classCode: 'dru', charClass: 'druid', type: 'area', mana: 4, lvlmana: 0, minmana: 1, manashift: 8, delay: 15, hitshift: 2, emin: 3, emax: 6, elev1: 3, elev2: 5, elev3: 7, elev4: 14, elev5: 21, emaxlev1: 3, emaxlev2: 6, emaxlev3: 8, emaxlev4: 15, emaxlev5: 23, srcDamage: 0, castOverlay: 'druid_fire_cast_1' },
  226: { id: 226, name: 'Oak Sage', classCode: 'dru', charClass: 'druid', type: 'summon', mana: 15, lvlmana: 1, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  229: { id: 229, name: 'Molten Boulder', classCode: 'dru', charClass: 'druid', type: 'projectile', mana: 20, lvlmana: 1, minmana: 1, manashift: 7, delay: 50, hitshift: 8, emin: 6, emax: 12, elev1: 4, elev2: 7, elev3: 10, elev4: 13, elev5: 16, emaxlev1: 5, emaxlev2: 8, emaxlev3: 11, emaxlev4: 14, emaxlev5: 17, srcDamage: 0, range: 450, speed: 300, castOverlay: 'druid_fire_cast_1' },

  // Assassin (5 skills)
  251: { id: 251, name: 'Fire Blast', classCode: 'ass', charClass: 'assassin', type: 'projectile', mana: 24, lvlmana: 1, minmana: 1, manashift: 5, delay: 0, hitshift: 7, emin: 6, emax: 8, elev1: 3, elev2: 8, elev3: 20, elev4: 38, elev5: 58, emaxlev1: 5, emaxlev2: 11, emaxlev3: 24, emaxlev4: 44, emaxlev5: 66, srcDamage: 0, range: 350, speed: 400 },
  252: { id: 252, name: 'Claw Mastery', classCode: 'ass', charClass: 'assassin', type: 'passive', mana: 0, lvlmana: 0, minmana: 0, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  254: { id: 254, name: 'Tiger Strike', classCode: 'ass', charClass: 'assassin', type: 'melee', mana: 1, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 128 },
  258: { id: 258, name: 'Burst of Speed', classCode: 'ass', charClass: 'assassin', type: 'buff', mana: 10, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 8, emin: 0, emax: 0, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, srcDamage: 0 },
  261: { id: 261, name: 'Charged Bolt Sentry', classCode: 'ass', charClass: 'assassin', type: 'summon', mana: 13, lvlmana: 0, minmana: 1, manashift: 8, delay: 0, hitshift: 7, emin: 2, emax: 14, elev1: 0, elev2: 0, elev3: 0, elev4: 0, elev5: 0, emaxlev1: 6, emaxlev2: 8, emaxlev3: 12, emaxlev4: 14, emaxlev5: 16, srcDamage: 0 },
})

/**
 * Returns the metadata definition for a Batch 1 combat skill, or undefined if not in Batch 1.
 */
export function getBatch1SkillDef(skillId: number): Batch1SkillDef | undefined {
  return BATCH1_SKILLS[skillId]
}

/**
 * Checks whether a skill ID belongs to the canonical Batch 1 essential combat skills.
 */
export function isBatch1Skill(skillId: number): boolean {
  return skillId in BATCH1_SKILLS
}

/**
 * Computes 1.13c mana cost with 24.8 fixed-point precision scaling and minmana clamping.
 *
 * Formula: Math.max(minmana, (mana + lvlmana * (effectiveLevel - 1)) * 2^(manashift - 8))
 * - Decreasing mana skills reach 0.0 at high levels (Magic Arrow, Double Swing).
 * - Minimum mana clamping prevents dropping below minmana (Teleport clamps at 1).
 * - Resilience: Invalid / NaN / non-positive levels default to level 1.
 */
export function getSkillManaCost(skillId: number, effectiveLevel: number): number {
  if (skillId === 6) {
    return calculateMagicArrowStats(effectiveLevel).manaCost
  }
  if (skillId === 7) {
    return calculateFireArrowStats(effectiveLevel).manaCost
  }
  if (skillId === 8) {
    return calculateInnerSightStats(effectiveLevel).manaCost
  }
  if (skillId === 9) {
    return calculateCriticalStrikeStats(effectiveLevel).manaCost
  }
  if (skillId === 10) {
    return calculateJabStats(effectiveLevel).manaCost
  }
  if (skillId === 11) {
    return calculateColdArrowStats(effectiveLevel).manaCost
  }
  if (skillId === 12) {
    return calculateMultipleShotStats(effectiveLevel).manaCost
  }
  if (skillId === 13) {
    return calculateDodgeStats(effectiveLevel).manaCost
  }
  if (skillId === 14) {
    return calculatePowerStrikeStats(effectiveLevel).manaCost
  }
  if (skillId === 15) {
    return calculatePoisonJavelinStats(effectiveLevel).manaCost
  }
  if (skillId === 16) {
    return calculateExplodingArrowStats(effectiveLevel).manaCost
  }
  if (skillId === 17) {
    return calculateSlowMissilesStats(effectiveLevel).manaCost
  }
  if (skillId === 18) {
    return calculateAvoidStats(effectiveLevel).manaCost
  }
  if (skillId === 19) {
    return calculateImpaleStats(effectiveLevel).manaCost
  }
  if (skillId === 20) {
    return calculateLightningBoltStats(effectiveLevel).manaCost
  }
  if (skillId === 21) {
    return calculateIceArrowStats(effectiveLevel).manaCost
  }
  if (skillId === 22) {
    return calculateGuidedArrowStats(effectiveLevel).manaCost
  }
  if (skillId === 23) {
    return calculatePenetrateStats(effectiveLevel).manaCost
  }
  if (skillId === 24) {
    return calculateChargedStrikeStats(effectiveLevel).manaCost
  }
  if (skillId === 25) {
    return calculatePlagueJavelinStats(effectiveLevel).manaCost
  }
  if (skillId === 26) {
    return calculateStrafeStats(effectiveLevel).manaCost
  }
  if (skillId === 27) {
    return calculateImmolationArrowStats(effectiveLevel).manaCost
  }
  if (skillId === 28) {
    return calculateDecoyStats(effectiveLevel).manaCost
  }
  if (skillId === 29) {
    return calculateEvadeStats(effectiveLevel).manaCost
  }
  if (skillId === 30) {
    return calculateFendStats(effectiveLevel).manaCost
  }
  if (skillId === 31) {
    return calculateFreezingArrowStats(effectiveLevel).manaCost
  }
  if (skillId === 32) {
    return calculateValkyrieStats(effectiveLevel).manaCost
  }
  if (skillId === 33) {
    return calculatePierceStats(effectiveLevel).manaCost
  }
  if (skillId === 34) {
    return calculateLightningStrikeStats(effectiveLevel).manaCost
  }
  if (skillId === 35) {
    return calculateLightningFuryStats(effectiveLevel).manaCost
  }
  if (skillId === 38) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 24, lvlmana = 4, manashift = 5 (factor = 0.125)
    // Formula: (24 + 4 * (lvl - 1)) * 0.125 = 3 + 0.5 * (lvl - 1)
    return (24 + 4 * (lvl - 1)) * 0.125
  }
  if (skillId === 40) {
    // 1.13c Skills.txt: mana = 7, lvlmana = 0, manashift = 8
    return 7
  }
  if (skillId === 41) {
    // 1.13c Skills.txt: mana = 6, lvlmana = 0, manashift = 8
    return 6
  }
  if (skillId === 46) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 22, lvlmana = 1, manashift = 7 (factor = 0.5)
    return Math.floor((22 + (lvl - 1)) * 0.5)
  }
  if (skillId === 51) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 22, lvlmana = 1, manashift = 8 (factor = 1.0)
    return 22 + (lvl - 1)
  }
  if (skillId === 52) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 25, lvlmana = 1, manashift = 8 (factor = 1.0)
    return 25 + (lvl - 1)
  }
  if (skillId === 43) {
    // 1.13c Skills.txt: mana = 7, lvlmana = 0, manashift = 8
    return 7
  }
  if (skillId === 48) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 15, lvlmana = 1, manashift = 8
    return 15 + (lvl - 1)
  }
  if (skillId === 42) {
    // 1.13c Skills.txt: mana = 9, lvlmana = 0, manashift = 8
    return 9
  }
  if (skillId === 45) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 12, lvlmana = 1, manashift = 7 (factor = 0.5)
    return (12 + (lvl - 1)) * 0.5
  }
  if (skillId === 49) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 16, lvlmana = 1, manashift = 7 (factor = 0.5)
    return (16 + (lvl - 1)) * 0.5
  }
  if (skillId === 50) {
    // 1.13c Skills.txt: mana = 11, lvlmana = 0, manashift = 8
    return 11
  }
  if (skillId === 53) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 9, lvlmana = 1, manashift = 8 (factor = 1.0)
    return 9 + (lvl - 1)
  }
  if (skillId === 55) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 20, lvlmana = 1, manashift = 7 (factor = 0.5)
    return (20 + (lvl - 1)) * 0.5
  }
  if (skillId === 56) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 34, lvlmana = 1, manashift = 7 (factor = 0.5)
    return (34 + (lvl - 1)) * 0.5
  }
  if (skillId === 57) {
    // 1.13c Skills.txt: mana = 19, lvlmana = 0, manashift = 8
    return 19
  }
  if (skillId === 58) {
    // 1.13c Skills.txt: mana = 5, lvlmana = 0, manashift = 8
    return 5
  }
  if (skillId === 59) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 23, lvlmana = 1, manashift = 8 (factor = 1.0)
    return 23 + (lvl - 1)
  }
  if (skillId === 60) {
    // 1.13c Skills.txt: mana = 17, lvlmana = 0, manashift = 8
    return 17
  }
  if (skillId === 61) {
    // Fire Mastery: passive
    return 0
  }
  if (skillId === 62) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 40, lvlmana = 1, manashift = 7 (factor = 0.5)
    return (40 + (lvl - 1)) * 0.5
  }
  if (skillId === 63) {
    // Lightning Mastery: passive
    return 0
  }
  if (skillId === 64) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // 1.13c Skills.txt: mana = 30, lvlmana = 1, manashift = 8 (factor = 1.0)
    return 30 + (lvl - 1)
  }
  if (skillId === 65) {
    // Cold Mastery: passive
    return 0
  }
  if (skillId === 126) {
    // Bash: mana = 2, lvlmana = 0, manashift = 8
    return 2
  }
  if (skillId === 130) {
    // Howl: mana = 4, lvlmana = 0, manashift = 8
    return 4
  }
  if (skillId === 131) {
    // Find Potion: mana = 2, lvlmana = 0, manashift = 8
    return 2
  }
  if (skillId === 132) {
    // Leap: mana = 2, lvlmana = 0, manashift = 8
    return 2
  }
  if (skillId === 133) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // Double Swing: mana = 8, lvlmana = -1, minmana = 0, manashift = 5 (factor = 0.125)
    return Math.max(0, (8 - (lvl - 1)) * 0.125)
  }
  if (skillId === 137) {
    // Taunt: mana = 3, lvlmana = 0, manashift = 8
    return 3
  }
  if (skillId === 138) {
    // Shout: mana = 6, lvlmana = 0, manashift = 8
    return 6
  }
  if (skillId === 139) {
    // Stun: mana = 2, lvlmana = 0, manashift = 8
    return 2
  }
  if (skillId === 140) {
    // Double Throw: mana = 1, lvlmana = 0, manashift = 8
    return 1
  }
  if (skillId === 142) {
    // Find Item: mana = 7, lvlmana = 0, manashift = 8
    return 7
  }
  if (skillId === 143) {
    // Leap Attack: mana = 9, lvlmana = 0, manashift = 8
    return 9
  }
  if (skillId === 144) {
    // Concentrate: mana = 2, lvlmana = 0, manashift = 8
    return 2
  }
  if (skillId === 146) {
    // Battle Cry: mana = 5, lvlmana = 0, manashift = 8
    return 5
  }
  if (skillId === 147) {
    // Frenzy: mana = 3, lvlmana = 0, manashift = 7 (factor = 0.5)
    return 1.5
  }
  if (skillId === 149) {
    // Battle Orders: mana = 7, lvlmana = 0, manashift = 8
    return 7
  }
  if (skillId === 150) {
    // Grim Ward: mana = 4, lvlmana = 0, manashift = 8
    return 4
  }
  if (skillId === 151) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // Whirlwind: mana = 25, lvlmana = 1, manashift = 7 (factor = 0.5)
    return (25 + (lvl - 1)) * 0.5
  }
  if (skillId === 152) {
    // Berserk: mana = 4, lvlmana = 0, manashift = 8
    return 4
  }
  if (skillId === 154) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // War Cry: mana = 10, lvlmana = 1, manashift = 8
    return 10 + (lvl - 1)
  }
  if (skillId === 155) {
    // Battle Command: mana = 11, lvlmana = 0, manashift = 8
    return 11
  }
  // Druid Elemental Skills (#225-#250) 1.13c Skills.txt
  if (skillId === 225) {
    // Firestorm: mana = 4, lvlmana = 0, manashift = 8
    return 4
  }
  if (skillId === 229) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // Molten Boulder: mana = 20, lvlmana = 1, manashift = 7 (factor = 0.5)
    return (20 + (lvl - 1)) * 0.5
  }
  if (skillId === 230) {
    // Arctic Blast: startmana = 4 (channel drain is 24 * 2^(2-8) = 0.375/tick, or 12.5/s display)
    return 4
  }
  if (skillId === 234) {
    // Fissure (Eruption): mana = 15, lvlmana = 0, manashift = 8
    return 15
  }
  if (skillId === 235) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    // Cyclone Armor: mana = 5, lvlmana = 1, manashift = 8
    return 5 + (lvl - 1)
  }
  if (skillId === 240) {
    // Twister: mana = 7, lvlmana = 0, manashift = 8
    return 7
  }
  if (skillId === 244) {
    // Volcano: mana = 25, lvlmana = 0, manashift = 8
    return 25
  }
  if (skillId === 245) {
    // Tornado: mana = 10, lvlmana = 0, manashift = 8
    return 10
  }
  if (skillId === 249) {
    // Armageddon: mana = 35, lvlmana = 0, manashift = 8
    return 35
  }
  if (skillId === 250) {
    // Hurricane: mana = 30, lvlmana = 0, manashift = 8
    return 30
  }
  // Assassin Martial Arts Skills (#254-#280)
  if (skillId === 254) {
    return 1
  }
  if (skillId === 255) {
    return 10
  }
  if (skillId === 259) {
    return 2
  }
  if (skillId === 260) {
    return 2
  }
  if (skillId === 265) {
    return 2
  }
  if (skillId === 269) {
    const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
    return 4 + 0.25 * (lvl - 1)
  }
  if (skillId === 270) {
    return 10
  }
  if (skillId === 274) {
    return 3
  }
  if (skillId === 275) {
    return 15
  }
  if (skillId === 280) {
    return 4
  }
  // Assassin Traps (#251-#277) 1.13c Skills.txt mana costs
  const assTrapLvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1
  if (skillId === 251) return 3 + 0.125 * (assTrapLvl - 1) // Fire Blast: mana=24, lvlmana=1, manashift=5
  if (skillId === 256) return 6 // Shock Web
  if (skillId === 257) return 7 // Blade Sentinel
  if (skillId === 261 || skillId === 262) return 13 // Charged Bolt Sentry / Wake of Fire
  if (skillId === 266) return 1 + 0.125 * (assTrapLvl - 1) // Blade Fury: mana=8, lvlmana=1, manashift=5
  if (skillId === 271 || skillId === 272 || skillId === 276) return 20 // Lightning / Inferno / Death Sentry
  if (skillId === 277) return 27 + 2 * (assTrapLvl - 1) // Blade Shield: mana=27, lvlmana=2, manashift=8
  const def = getBatch1SkillDef(skillId)
  if (!def) return 0
  if (def.mana === 0 && def.lvlmana === 0) return 0
  const lvl = Number.isFinite(effectiveLevel) ? Math.max(1, Math.floor(effectiveLevel)) : 1

  const shiftFactor = 2 ** ((def.manashift ?? 8) - 8)
  const rawCost = (def.mana + def.lvlmana * (lvl - 1)) * shiftFactor
  return Math.max(def.minmana ?? 0, rawCost)
}

/**
 * Returns casting delay cooldown in frames at 25 fps.
 * - Werewolf: 25 frames (1.0s)
 * - Firestorm: 15 frames (0.6s)
 * - Molten Boulder: 50 frames (2.0s)
 * - Meteor: 30 frames (1.2s)
 * - Blizzard: 45 frames (1.8s)
 * - Hydra: 40 frames (1.6s)
 * - Frozen Orb: 25 frames (1.0s)
 * - All other Batch 1 skills: 0 frames
 */
export function getSkillCooldownTicks(skillId: number): number {
  if (
    skillId === 6 ||
    skillId === 7 ||
    skillId === 8 ||
    skillId === 9 ||
    skillId === 10 ||
    skillId === 11 ||
    skillId === 12 ||
    skillId === 13 ||
    skillId === 14 ||
    skillId === 16 ||
    skillId === 17 ||
    skillId === 18 ||
    skillId === 19 ||
    skillId === 20 ||
    skillId === 21 ||
    skillId === 22 ||
    skillId === 23 ||
    skillId === 24 ||
    skillId === 26 ||
    skillId === 28 ||
    skillId === 29 ||
    skillId === 30 ||
    skillId === 31 ||
    skillId === 33 ||
    skillId === 34 ||
    skillId === 35 ||
    skillId === 38 ||
    skillId === 40 ||
    skillId === 41 ||
    skillId === 42 ||
    skillId === 43 ||
    skillId === 44 ||
    skillId === 45 ||
    skillId === 46 ||
    skillId === 48 ||
    skillId === 49 ||
    skillId === 50 ||
    skillId === 52 ||
    skillId === 53 ||
    skillId === 55 ||
    skillId === 57 ||
    skillId === 58 ||
    skillId === 60 ||
    skillId === 61 ||
    skillId === 63 ||
    skillId === 65 ||
    skillId === 126 ||
    skillId === 130 ||
    skillId === 131 ||
    skillId === 132 ||
    skillId === 133 ||
    skillId === 137 ||
    skillId === 138 ||
    skillId === 139 ||
    skillId === 140 ||
    skillId === 142 ||
    skillId === 143 ||
    skillId === 144 ||
    skillId === 146 ||
    skillId === 147 ||
    skillId === 149 ||
    skillId === 150 ||
    skillId === 151 ||
    skillId === 152 ||
    skillId === 154 ||
    skillId === 155
  ) {
    return 0
  }
  if (skillId === 15) {
    return 15 // Poison Javelin: 15 frames (0.6s) casting delay
  }
  if (skillId === 25) {
    return 100 // Plague Javelin: 100 frames (4.0s) casting delay
  }
  if (skillId === 27) {
    return 25 // Immolation Arrow: 25 frames (1.0s)
  }
  if (skillId === 32) {
    return 150 // Valkyrie: 150 frames (6.0s) casting delay
  }
  if (skillId === 51) {
    return 35
  }
  if (skillId === 56) {
    return 30
  }
  if (skillId === 59) {
    return 45
  }
  if (skillId === 62) {
    return 40
  }
  if (skillId === 64) {
    return 25
  }
  if (skillId === 121) {
    return 25
  }
  // Druid Elemental Skills (#225-#250) 1.13c Skills.txt `delay`
  if (skillId === 225) {
    return 15 // Firestorm: 15f (0.6s)
  }
  if (skillId === 229 || skillId === 234) {
    return 50 // Molten Boulder / Fissure: 50f (2.0s)
  }
  if (skillId === 230 || skillId === 235 || skillId === 240 || skillId === 245) {
    return 0 // Arctic Blast / Cyclone Armor / Twister / Tornado: 0f
  }
  if (skillId === 244) {
    return 100 // Volcano: 100f (4.0s)
  }
  if (skillId === 249 || skillId === 250) {
    return 150 // Armageddon / Hurricane: 150f (6.0s)
  }
  // Assassin Martial Arts Skills (#254-#280)
  if (
    skillId === 254 ||
    skillId === 255 ||
    skillId === 259 ||
    skillId === 260 ||
    skillId === 265 ||
    skillId === 269 ||
    skillId === 270 ||
    skillId === 274 ||
    skillId === 280
  ) {
    return 0
  }
  if (skillId === 275) {
    return 25 // Dragon Flight: 25f (1.0s) casting delay
  }
  // Assassin Traps (#251-#277) 1.13c Skills.txt `delay`
  if (skillId === 256) return 15 // Shock Web: 15f (0.6s)
  if (skillId === 257) return 50 // Blade Sentinel: 50f (2.0s)
  if (
    skillId === 251 ||
    skillId === 261 ||
    skillId === 262 ||
    skillId === 266 ||
    skillId === 271 ||
    skillId === 272 ||
    skillId === 276 ||
    skillId === 277
  ) {
    return 0
  }
  const def = getBatch1SkillDef(skillId)
  return def?.delay ?? 0
}
