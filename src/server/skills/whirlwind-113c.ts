/**
 * Diablo II: Lord of Destruction v1.13c — Barbarian / Chaos Assassin Whirlwind (`#151`) Runtime
 * (`src/server/skills/whirlwind-113c.ts`).
 *
 * Authoritative 1.13c Ground Truth (`D2Game.dll` `SrvSt38_Whirlwind` @ `0x6FC48290`,
 * `SrvDo076_Whirlwind` @ `0x6FC48BE0`, `Skills.txt` row `#151`, `Weapons.txt`):
 * 1. Continuous straight-line subtile movement toward `(destX, destY)` passing through unit
 *    footprints (`COLLIDE_MASK_PLAYER_WW = 0x0C01`: walls / barriers / void stop pathing,
 *    monsters and players do not).
 * 2. Movement speed uses player walk speed scaled by FRW, `velocitypercent`, armor speed penalty,
 *    and chill/slow/freeze (`STATE_COLD` `11`, `STATE_FREEZE` `1`, `holywindcold` `44`,
 *    `decrepify` `60`, `item_slow`), clamped at `>= 25%`. Chilling slows movement velocity ONLY
 *    (increasing spin frames and therefore hit density per yard) and NEVER slows weapon hit-check
 *    frame intervals.
 * 3. Hit-check frame cadence:
 *    - Frame `startFrame + 4` performs the 1st hit check (primary hand ONLY, even when dual-wielding).
 *    - Subsequent hit checks occur strictly on each hand's own weapon-IAS-only interval:
 *      `effIas = onWeaponIas - weaponBaseSpeed` (off-weapon IAS on gloves/amulet/armor and skill
 *      IAS buffs such as Fanaticism / Frenzy / Burst of Speed have ZERO effect on Whirlwind):
 *      - 1H weapons, Claws (`h2h`/`h2h2`), and 2H Swords (`swor` / `oneOrTwoHanded`):
 *        `>= 34 -> 4f`, `>= 10 -> 6f`, `>= -15 -> 8f`, `>= -34 -> 10f`, `>= -59 -> 12f`,
 *        `>= -85 -> 14f`, `< -85 -> 16f`
 *      - 2H Non-Sword weapons (`pole`, `spea`, `axe`, `hamm`, `staf`, etc.):
 *        `>= 60 -> 4f`, `>= 35 -> 6f`, `>= 15 -> 8f`, `>= 0 -> 10f`, `>= -15 -> 12f`,
 *        `>= -35 -> 14f`, `< -35 -> 16f`
 *    - When dual-wielding two melee weapons (two 1H weapons, two 2H swords on Barbarian, or two
 *      claws on Chaos Assassin), from the 2nd check onward (`startFrame + 4 + interval`), BOTH
 *      hands roll independent target selection, hit checks, and weapon damage on their respective
 *      breakpoints (`2` hits every `4` frames for dual `4f` weapons such as dual Grief Phase Blades).
 * 4. Modifier & CtC rules:
 *    - Applies Whirlwind `%ED = -50 + 8 * (slvl - 1)` and `%AR = 5 * (slvl - 1)`, weapon elemental
 *      damage, Crushing Blow (`136`), Deadly Strike (`141`) / Mastery Critical Strike, Open Wounds
 *      (`135`), and Life/Mana Steal (`60`/`62`).
 *    - Strictly suppresses `item_skillonattack` (`195`) and `item_skillonhit` (`198`) CtC procs
 *      (`suppressSkillOnAttack: true`, `suppressSkillOnHit: true`).
 * 5. While spinning, drinking potions and casting/switching skills are locked out until reaching
 *    `(destX, destY)`.
 */

import type { WeaponBase } from '../../common/items/weapons.ts'
import { resolveWeaponBase113c } from '../../common/units/char-anim-speed.ts'
import type { ItemStat } from '../../netproto/index.ts'

/** 1.13c base player walk speed in subtiles per second (`6 yards/s = 9 subtiles/s`, `0.36/tick`). */
export const WHIRLWIND_BASE_WALK_SUBTILES_PER_FRAME_113C = 9 / 25

/** Maximum single-cast Whirlwind straight-line travel distance in subtiles (`SrvSt38`). */
export const WHIRLWIND_MAX_RANGE_SUBTILES_113C = 50

/** Minimum spin distance (subtiles) when casting on top of the caster's own subtile. */
export const WHIRLWIND_MIN_SPIN_SUBTILES_113C = 3

/** Pure ranged / thrown-potion weapon types ineligible for melee Whirlwind (`Skills.txt` `itypea1=mele`). */
const NON_MELEE_WEAPON_TYPES_113C: ReadonlySet<string> = new Set([
  'bow',
  'xbow',
  'abow',
  'tpot',
])

export interface WhirlwindHandWeaponSpec113c {
  readonly hand: 'primary' | 'secondary'
  readonly itemUnitId: number | undefined
  readonly itemCode: string | undefined
  readonly base: WeaponBase | undefined
  readonly onWeaponIas: number
  readonly baseSpeedWsm: number
  readonly effectiveWeaponIas: number
  readonly isTwoHandedNonSword: boolean
  readonly useTwoHandDamage: boolean
  readonly hitIntervalFrames: number
  readonly rangeAdder: number
  readonly stats: readonly ItemStat[]
}

export interface WhirlwindSpinState113c {
  readonly skillId: number
  readonly slvl: number
  readonly areaId: number
  readonly startFrame: number
  readonly startX: number
  readonly startY: number
  readonly destX: number
  readonly destY: number
  readonly dirX: number
  readonly dirY: number
  readonly totalDistance: number
  traveledDistance: number
  currentX: number
  currentY: number
  nextPrimaryHitFrame: number
  nextSecondaryHitFrame: number | null
  readonly primaryHand: WhirlwindHandWeaponSpec113c
  readonly secondaryHand: WhirlwindHandWeaponSpec113c | null
  /** Explicit 1.13c CtC suppression markers (`stat 195` & `stat 198` never fire during Whirlwind). */
  readonly suppressAttackHitProcs: true
  readonly suppressSkillOnAttack: true
  readonly suppressSkillOnHit: true
}

export interface WhirlwindEquippedHandInput113c {
  readonly unitId?: number | undefined
  readonly code: string
  readonly bodyLoc: number
  readonly stats: readonly ItemStat[]
}

/**
 * Computes the 1.13c Whirlwind frame interval (`4 | 6 | 8 | 10 | 12 | 14 | 16`) from ONLY
 * on-weapon IAS (`stat 93` `item_fasterattackrate` on that specific weapon + its socketed items)
 * and `Weapons.txt` `speed` (`WSM`). Off-weapon IAS, Fanaticism, Frenzy, Burst of Speed, and
 * chill/slow states are completely ignored.
 */
export function computeWhirlwindWeaponHitInterval113c(
  onWeaponIas: number,
  weaponBaseSpeedWsm: number,
  isTwoHandedNonSword: boolean,
): 4 | 6 | 8 | 10 | 12 | 14 | 16 {
  const effIas = Math.trunc(onWeaponIas) - Math.trunc(weaponBaseSpeedWsm)
  if (isTwoHandedNonSword) {
    if (effIas >= 60) return 4
    if (effIas >= 35) return 6
    if (effIas >= 15) return 8
    if (effIas >= 0) return 10
    if (effIas >= -15) return 12
    if (effIas >= -35) return 14
    return 16
  }
  if (effIas >= 34) return 4
  if (effIas >= 10) return 6
  if (effIas >= -15) return 8
  if (effIas >= -34) return 10
  if (effIas >= -59) return 12
  if (effIas >= -85) return 14
  return 16
}

export function isMeleeWhirlwindWeaponBase113c(base: WeaponBase | undefined): base is WeaponBase {
  if (base === undefined) return false
  const t = base.type.trim().toLowerCase()
  return !NON_MELEE_WEAPON_TYPES_113C.has(t)
}

function extractOnWeaponIas113c(stats: readonly ItemStat[]): number {
  let ias = 0
  for (const s of stats) {
    // Only stat 93 (`item_fasterattackrate`) on this weapon instance counts for Whirlwind.
    if (s.statId === 93) {
      ias += s.value
    }
  }
  return ias
}

function buildHandSpec113c(
  hand: 'primary' | 'secondary',
  item: WhirlwindEquippedHandInput113c | undefined,
  hasOtherHandWeapon: boolean,
): WhirlwindHandWeaponSpec113c {
  if (item === undefined) {
    const hitIntervalFrames = computeWhirlwindWeaponHitInterval113c(0, 0, false)
    return {
      hand,
      itemUnitId: undefined,
      itemCode: undefined,
      base: undefined,
      onWeaponIas: 0,
      baseSpeedWsm: 0,
      effectiveWeaponIas: 0,
      isTwoHandedNonSword: false,
      useTwoHandDamage: false,
      hitIntervalFrames,
      rangeAdder: 0,
      stats: [],
    }
  }
  const base = resolveWeaponBase113c(item.code)
  const onWeaponIas = extractOnWeaponIas113c(item.stats)
  const baseSpeedWsm = base?.speed ?? 0
  const isSword = base?.type.trim().toLowerCase() === 'swor'
  const isTwoHandedNonSword = Boolean(base?.twoHanded && !base.oneOrTwoHanded && !isSword)
  const useTwoHandDamage = Boolean(
    base?.twoHanded &&
      base.twoHandedMindam !== undefined &&
      base.twoHandedMaxdam !== undefined &&
      (!base.oneOrTwoHanded || !hasOtherHandWeapon),
  )
  const hitIntervalFrames = computeWhirlwindWeaponHitInterval113c(
    onWeaponIas,
    baseSpeedWsm,
    isTwoHandedNonSword,
  )
  return {
    hand,
    itemUnitId: item.unitId,
    itemCode: item.code,
    base,
    onWeaponIas,
    baseSpeedWsm,
    effectiveWeaponIas: onWeaponIas - baseSpeedWsm,
    isTwoHandedNonSword,
    useTwoHandDamage,
    hitIntervalFrames,
    rangeAdder: base?.rangeadder ?? 0,
    stats: item.stats,
  }
}

/**
 * Resolves the active primary and optional secondary melee weapon hands for Whirlwind (`SrvDo076`).
 * Returns `null` ONLY if the player has equipped non-melee weapon(s) (e.g. a Bow / Crossbow) and
 * zero melee weapons; synthetic unarmed players (`equippedHands.length === 0`) fall back cleanly
 * to an unarmed primary hand so unequipped skill tests remain valid.
 */
export function resolveWhirlwindWeaponHands113c(
  rightArm: WhirlwindEquippedHandInput113c | undefined,
  leftArm: WhirlwindEquippedHandInput113c | undefined,
): {
  readonly primaryHand: WhirlwindHandWeaponSpec113c
  readonly secondaryHand: WhirlwindHandWeaponSpec113c | null
} | null {
  const rightBase = rightArm ? resolveWeaponBase113c(rightArm.code) : undefined
  const leftBase = leftArm ? resolveWeaponBase113c(leftArm.code) : undefined
  const rightMelee = isMeleeWhirlwindWeaponBase113c(rightBase) ? rightArm : undefined
  const leftMelee = isMeleeWhirlwindWeaponBase113c(leftBase) ? leftArm : undefined

  // If the player explicitly equipped a bow/crossbow and has no melee weapon, Whirlwind is invalid.
  if (rightMelee === undefined && leftMelee === undefined) {
    if ((rightArm !== undefined && rightBase !== undefined) || (leftArm !== undefined && leftBase !== undefined)) {
      return null
    }
    return {
      primaryHand: buildHandSpec113c('primary', undefined, false),
      secondaryHand: null,
    }
  }

  if (rightMelee !== undefined && leftMelee !== undefined) {
    return {
      primaryHand: buildHandSpec113c('primary', rightMelee, true),
      secondaryHand: buildHandSpec113c('secondary', leftMelee, true),
    }
  }

  const single = rightMelee ?? leftMelee
  // Note: if the other arm holds a shield (`leftBase === undefined` because shields are in Armor.txt),
  // a `oneOrTwoHanded` Barbarian 2H sword is held in ONE hand (`hasOtherHandItem = true` -> 1H damage)!
  const otherArmOccupied =
    single === rightMelee ? leftArm !== undefined : rightArm !== undefined
  return {
    primaryHand: buildHandSpec113c('primary', single, otherArmOccupied),
    secondaryHand: null,
  }
}

/**
 * Ray-marches along the straight line `(startX, startY) -> (targetX, targetY)` up to
 * `maxRangeSubtiles`, stopping at the last walkable subtile before any terrain wall/void barrier
 * (ignoring unit footprints so the spinning player passes straight through monsters).
 */
export function resolveWhirlwindStraightDestination113c(
  startX: number,
  startY: number,
  rawTargetX: number,
  rawTargetY: number,
  isSubTileBlocked?: ((sx: number, sy: number) => boolean) | null,
  maxRangeSubtiles = WHIRLWIND_MAX_RANGE_SUBTILES_113C,
): {
  readonly destX: number
  readonly destY: number
  readonly dirX: number
  readonly dirY: number
  readonly totalDistance: number
} {
  let dx = rawTargetX - startX
  let dy = rawTargetY - startY
  let rawDist = Math.hypot(dx, dy)
  if (rawDist < 0.001) {
    dx = 1
    dy = 0
    rawDist = WHIRLWIND_MIN_SPIN_SUBTILES_113C
  }
  const dirX = dx / rawDist
  const dirY = dy / rawDist
  const clampedDist = Math.min(maxRangeSubtiles, Math.max(WHIRLWIND_MIN_SPIN_SUBTILES_113C, rawDist))

  let validDist = 0
  const stepSize = 0.5
  for (let d = stepSize; d <= clampedDist + 1e-6; d = Math.min(clampedDist, d + stepSize)) {
    const cx = startX + dirX * d
    const cy = startY + dirY * d
    if (isSubTileBlocked && isSubTileBlocked(Math.round(cx), Math.round(cy))) {
      break
    }
    validDist = d
    if (d >= clampedDist) break
  }

  return {
    destX: startX + dirX * validDist,
    destY: startY + dirY * validDist,
    dirX,
    dirY,
    totalDistance: validDist,
  }
}

/**
 * Computes effective subtile step distance for 1 server frame (40ms) during Whirlwind:
 * - Item FRW uses 1.13c diminishing returns `trunc(150 * frw / (150 + frw))`.
 * - Skill velocity (`Increased Speed`, `Burst of Speed`, `Frenzy`, `Vigor`) adds directly.
 * - Chill/Freeze/Decrepify/Holy Freeze/`item_slow` subtract from velocity percent (clamped `>= 25%`),
 *   slowing travel speed without altering weapon hit-check frame intervals!
 */
export function computeWhirlwindStepDistancePerFrame113c(params: {
  readonly itemFrwPercent: number
  readonly skillVelocityPercent: number
  readonly armorSpeedPenaltyPercent: number
  readonly slowPercent: number
}): { readonly stepSubtiles: number; readonly velocityPercent: number } {
  const frw = Math.max(0, Math.trunc(params.itemFrwPercent))
  const effectiveItemFrw = frw > 0 ? Math.trunc((150 * frw) / (150 + frw)) : 0
  const velocityPercent = Math.max(
    25,
    100 +
      effectiveItemFrw +
      Math.trunc(params.skillVelocityPercent) +
      Math.trunc(params.armorSpeedPenaltyPercent) -
      Math.max(0, Math.trunc(params.slowPercent)),
  )
  return {
    stepSubtiles: WHIRLWIND_BASE_WALK_SUBTILES_PER_FRAME_113C * (velocityPercent / 100),
    velocityPercent,
  }
}

/**
 * Creates a new `WhirlwindSpinState113c` at `startFrame`.
 * - Frame `startFrame + 4`: 1st hit check (primary hand only).
 * - Frame `startFrame + 4 + interval`: 2nd+ hit checks (primary and, if dual-wielding, secondary
 *   hand each rolling independently on their own weapon-only IAS intervals).
 */
export function createWhirlwindSpinState113c(params: {
  readonly skillId: number
  readonly slvl: number
  readonly areaId: number
  readonly startFrame: number
  readonly startX: number
  readonly startY: number
  readonly targetX: number
  readonly targetY: number
  readonly primaryHand: WhirlwindHandWeaponSpec113c
  readonly secondaryHand: WhirlwindHandWeaponSpec113c | null
  readonly isSubTileBlocked?: ((sx: number, sy: number) => boolean) | null
}): WhirlwindSpinState113c | null {
  const path = resolveWhirlwindStraightDestination113c(
    params.startX,
    params.startY,
    params.targetX,
    params.targetY,
    params.isSubTileBlocked,
  )
  if (path.totalDistance <= 0) {
    return null
  }
  return {
    skillId: params.skillId,
    slvl: params.slvl,
    areaId: params.areaId,
    startFrame: params.startFrame,
    startX: params.startX,
    startY: params.startY,
    destX: path.destX,
    destY: path.destY,
    dirX: path.dirX,
    dirY: path.dirY,
    totalDistance: path.totalDistance,
    traveledDistance: 0,
    currentX: params.startX,
    currentY: params.startY,
    nextPrimaryHitFrame: params.startFrame + 4,
    nextSecondaryHitFrame:
      params.secondaryHand !== null
        ? params.startFrame + 4 + params.secondaryHand.hitIntervalFrames
        : null,
    primaryHand: params.primaryHand,
    secondaryHand: params.secondaryHand,
    suppressAttackHitProcs: true,
    suppressSkillOnAttack: true,
    suppressSkillOnHit: true,
  }
}

export interface WhirlwindFrameAdvanceResult113c {
  readonly x: number
  readonly y: number
  readonly dueHands: readonly WhirlwindHandWeaponSpec113c[]
  readonly finished: boolean
}

/**
 * Advances `spin` by 1 server frame to `currentFrame`:
 * 1. Moves smoothly along `(dirX, dirY)` by `stepSubtiles` (clamped to `totalDistance`).
 * 2. Evaluates whether `primaryHand` and/or `secondaryHand` hit checks are due on `currentFrame`
 *    (at `startFrame + 4` ONLY `primaryHand` fires; from `startFrame + 4 + interval` onward each
 *    weapon fires independently on its own `hitIntervalFrames`).
 * 3. Marks `finished = true` once `traveledDistance >= totalDistance` (after executing any hit
 *    checks due on the arrival frame).
 */
export function advanceWhirlwindSpinFrame113c(
  spin: WhirlwindSpinState113c,
  currentFrame: number,
  stepSubtiles: number,
): WhirlwindFrameAdvanceResult113c {
  const nextDist = Math.min(spin.totalDistance, spin.traveledDistance + Math.max(0.01, stepSubtiles))
  spin.traveledDistance = nextDist
  spin.currentX = nextDist >= spin.totalDistance ? spin.destX : spin.startX + spin.dirX * nextDist
  spin.currentY = nextDist >= spin.totalDistance ? spin.destY : spin.startY + spin.dirY * nextDist

  const dueHands: WhirlwindHandWeaponSpec113c[] = []
  if (currentFrame >= spin.nextPrimaryHitFrame) {
    dueHands.push(spin.primaryHand)
    spin.nextPrimaryHitFrame = currentFrame + spin.primaryHand.hitIntervalFrames
  }
  if (spin.secondaryHand !== null && spin.nextSecondaryHitFrame !== null && currentFrame >= spin.nextSecondaryHitFrame) {
    dueHands.push(spin.secondaryHand)
    spin.nextSecondaryHitFrame = currentFrame + spin.secondaryHand.hitIntervalFrames
  }

  const finished =
    spin.traveledDistance >= spin.totalDistance - 1e-6 && currentFrame >= spin.startFrame + 4
  return {
    x: spin.currentX,
    y: spin.currentY,
    dueHands,
    finished,
  }
}

/**
 * 1.13c Whirlwind skill `%ED` (`Param1 = -50`, `Param2 = 8`: `-50 + 8 * (slvl - 1)`) and
 * `%AR` (`ToHit = 0`, `LevToHit = 5`: `5 * (slvl - 1)`).
 */
export function computeWhirlwindDamageAndAr113c(slvl: number): {
  readonly damagePercent: number
  readonly attackRatingPercent: number
} {
  const lvl = Math.max(1, Math.trunc(slvl))
  return {
    damagePercent: -50 + 8 * (lvl - 1),
    attackRatingPercent: 5 * (lvl - 1),
  }
}

/**
 * 1.13c Open Wounds (`STATE_OPENWOUNDS = 62`, 200 frames = 8.0s, `D2Game.dll` `0x6FCCCF40`):
 * Computes per-frame 1/256 HP bleed rate from attacker character level `clvl` (`1..99`) and
 * defender unit category (bosses take `1/2` bleed rate vs normal monsters).
 */
export function computeOpenWoundsBitrate256113c(clvl: number, isBoss: boolean): number {
  const lvl = Math.max(1, Math.min(99, Math.trunc(clvl)))
  let raw256: number
  if (lvl <= 15) {
    raw256 = (9 * lvl + 31) >> 2 // * 64 / 256 -> in 256ths: 9 * lvl + 31
    raw256 = 9 * lvl + 31
  } else if (lvl <= 30) {
    raw256 = 18 * (lvl - 15) + 166
  } else if (lvl <= 45) {
    raw256 = 27 * (lvl - 30) + 436
  } else if (lvl <= 60) {
    raw256 = 36 * (lvl - 45) + 841
  } else {
    raw256 = 45 * (lvl - 60) + 1381
  }
  return isBoss ? Math.max(1, raw256 >> 1) : Math.max(1, raw256)
}
