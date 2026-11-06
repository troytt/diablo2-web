/**
 * Diablo II: Lord of Destruction v1.13c — Wave-4 Player Skill & Construct Helpers
 *
 * Pure authoritative 1.13c formulas & spatial generators for:
 * - #112 Blessed Hammer Concentration 50% cast-time snapshot (`D2Game.dll` `0x6FC9A8D0`)
 * - #116 Conversion level/HP scaling (`state 53` + `state 109` `conversion_save`)
 * - #150 Grim Ward corpse totem aura (`Skills.txt` `Param1=1000`, `calc1=par3+(lvl-1)*par4`, `state 56` `terror`)
 * - #78 Bone Wall & #88 Bone Prison multi-segment collision constructs (`MonStats` `hcIdx=344` `bonewall`, `600`f)
 * - #257 Blade Sentinel back-and-forth patrol trajectory (`Missiles.txt` `#392` `blade creeper`)
 * - #17 Slow Missiles (`States.txt` `#87` `slowmissiles`, `Param1=33%`, `300+150*(slvl-1)`f, `radius=20`)
 * - #238 Rabies contagion (`Missiles.txt` `#515` `rabiesplague`: `Param1=4`f interval, `Param2=7` sub-tiles, `state 112`)
 */

export interface ConversionSavedStats113c {
  readonly origLevel: number
  readonly origMaxHp: number
  readonly origHp: number
}

export interface BladeSentinelPatrolState113c {
  x: number
  y: number
  readonly originX: number
  readonly originY: number
  readonly targetX: number
  readonly targetY: number
  headingToTarget: boolean
  readonly speed: number
}

export const STATE_SLOWMISSILES_113C = 87
export const STATE_CONVERSION_113C = 53
export const STATE_CONVERSION_SAVE_113C = 109
export const STATE_TERROR_113C = 56
export const STATE_RABIES_113C = 112
export const STATE_BLADESHIELD_113C = 158
export const STATE_DELERIUM_113C = 177

export const RABIES_CONTAGION_INTERVAL_FRAMES_113C = 4
export const RABIES_CONTAGION_RADIUS_SUBTILES_113C = 7

/**
 * 1.13c `D2Game.dll` `0x6FC9A8D0`: Blessed Hammer (`#112`) snapshots half (`floor(concEd / 2)`)
 * of the caster's active Concentration (`#113`, `state 42`) `%ED` into its magic damage at cast time.
 */
export function snapshotBlessedHammerDamage256_113c(
  rawElem256: number,
  concDamagePct: number,
): number {
  const concHalfPct = concDamagePct > 0 ? Math.trunc(concDamagePct / 2) : 0
  return Math.trunc((rawElem256 * (100 + concHalfPct)) / 100)
}

/**
 * 1.13c `D2Game.dll` `SrvDo079_Conversion` (`0x6FCB9830`):
 * When `clvl < mlvl`, saves original `mlvl/maxHp/hp` (`state 109` `conversion_save`)
 * and scales the converted monster's `level` and `hp/maxHp` by `clvl / mlvl` while converted.
 */
export function computeConversionLevelScaling113c(
  clvl: number,
  mlvl: number,
  hp: number,
  maxHp: number,
): {
  readonly scaled: boolean
  readonly newLevel: number
  readonly newHp: number
  readonly newMaxHp: number
  readonly saved?: ConversionSavedStats113c
} {
  if (clvl <= 0 || mlvl <= 0 || clvl >= mlvl) {
    return {
      scaled: false,
      newLevel: mlvl,
      newHp: hp,
      newMaxHp: maxHp,
    }
  }
  const newMaxHp = Math.max(1, Math.floor((maxHp * clvl) / mlvl))
  const newHp = Math.max(1, Math.min(newMaxHp, Math.floor((hp * clvl) / mlvl)))
  return {
    scaled: true,
    newLevel: clvl,
    newHp,
    newMaxHp,
    saved: {
      origLevel: mlvl,
      origMaxHp: maxHp,
      origHp: hp,
    },
  }
}

export function restoreConversionLevelScaling113c(
  saved: ConversionSavedStats113c,
  currentHp: number,
  currentMaxHp: number,
): {
  readonly restoredLevel: number
  readonly restoredHp: number
  readonly restoredMaxHp: number
} {
  const safeScaledMax = Math.max(1, currentMaxHp)
  const restoredMaxHp = Math.max(1, saved.origMaxHp)
  const restoredHp =
    currentHp >= safeScaledMax
      ? Math.min(restoredMaxHp, Math.max(1, saved.origHp))
      : Math.max(1, Math.min(restoredMaxHp, Math.floor((currentHp * restoredMaxHp) / safeScaledMax)))
  return {
    restoredLevel: saved.origLevel,
    restoredHp,
    restoredMaxHp,
  }
}

/**
 * 1.13c `Skills.txt` `#150 Grim Ward`:
 * - `Param1 = 1000` frames (`40s` totem lifetime)
 * - `Param3 = 3`, `Param4 = 1`, `calc1 = par3 + (lvl - 1) * par4` (`3 + (slvl - 1)` sub-tiles = `2 + 2*(slvl-1)/3` yards)
 * - Pulses `STATE_TERROR` (`56`) every `25` frames (`1s`).
 */
export function computeGrimWardStats113c(slvl: number): {
  readonly durationFrames: number
  readonly pulseIntervalFrames: number
  readonly fleeDurationFrames: number
  readonly radiusSubtiles: number
  readonly radiusYards: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const radiusSubtiles = 3 + (lvl - 1)
  return {
    durationFrames: 1000,
    pulseIntervalFrames: 25,
    fleeDurationFrames: 60,
    radiusSubtiles,
    radiusYards: (radiusSubtiles * 2) / 3,
  }
}

/**
 * 1.13c `D2Game.dll` `SrvDo060_BoneWall` (`0x6FC70FE0`):
 * Generates 9 contiguous `bonewall` sub-tile coordinates centered on `(targetX, targetY)`
 * along the axis perpendicular to `(targetX - casterX, targetY - casterY)`.
 */
export function computeBoneWallSegmentPositions113c(
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
): Array<{ readonly x: number; readonly y: number }> {
  const cx = Math.round(targetX)
  const cy = Math.round(targetY)
  const dx = targetX - casterX
  const dy = targetY - casterY
  const len = Math.hypot(dx, dy)
  const perpX = len > 1e-6 ? -dy / len : 0
  const perpY = len > 1e-6 ? dx / len : 1
  const seen = new Set<string>()
  const out: Array<{ readonly x: number; readonly y: number }> = []
  for (let offset = -4; offset <= 4; offset++) {
    const x = Math.round(cx + perpX * offset)
    const y = Math.round(cy + perpY * offset)
    const key = `${x},${y}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push({ x, y })
    }
  }
  return out
}

/**
 * 1.13c `D2Game.dll` `SrvDo062_BonePrison` (`0x6FC71E70`):
 * Generates the 12-segment circular `bonewall` ring enclosing `(targetX, targetY)`.
 */
export function computeBonePrisonRingPositions113c(
  targetX: number,
  targetY: number,
): Array<{ readonly x: number; readonly y: number }> {
  const cx = Math.round(targetX)
  const cy = Math.round(targetY)
  const xOffsets = [-1, 1, 3, 4, 4, 3, -1, 1, -3, -4, -4, -3] as const
  const yOffsets = [-4, -4, -3, -1, 1, 3, 4, 4, 3, -1, 1, -3] as const
  const out: Array<{ readonly x: number; readonly y: number }> = []
  for (let i = 0; i < xOffsets.length; i++) {
    out.push({ x: cx + xOffsets[i]!, y: cy + yOffsets[i]! })
  }
  return out
}

/**
 * 1.13c `Missiles.txt` `#392 blade creeper` (`SrvDo045` / `CltMove` back-and-forth shuttle):
 * Shuttles between `(originX, originY)` and `(targetX, targetY)` at `speed` sub-tiles/frame,
 * reversing direction upon reaching each endpoint.
 */
export function stepBladeSentinelPatrol113c(
  state: BladeSentinelPatrolState113c,
): { readonly vx: number; readonly vy: number } {
  const stepDist = Math.max(0.05, state.speed)
  const goalX = state.headingToTarget ? state.targetX : state.originX
  const goalY = state.headingToTarget ? state.targetY : state.originY
  const dx = goalX - state.x
  const dy = goalY - state.y
  const dist = Math.hypot(dx, dy)
  if (dist <= stepDist) {
    state.x = goalX
    state.y = goalY
    state.headingToTarget = !state.headingToTarget
    const nextGoalX = state.headingToTarget ? state.targetX : state.originX
    const nextGoalY = state.headingToTarget ? state.targetY : state.originY
    const ndx = nextGoalX - state.x
    const ndy = nextGoalY - state.y
    const nd = Math.hypot(ndx, ndy)
    return nd > 1e-6
      ? { vx: (ndx / nd) * stepDist, vy: (ndy / nd) * stepDist }
      : { vx: 0, vy: 0 }
  }
  const vx = (dx / dist) * stepDist
  const vy = (dy / dist) * stepDist
  state.x += vx
  state.y += vy
  return { vx, vy }
}

/**
 * 1.13c `Skills.txt` `#17 Slow Missiles`:
 * - `auratargetstate = slowmissiles` (`state 87`)
 * - `Param1 = 33` (`33%` projectile velocity factor)
 * - `Param3 = 300`, `Param4 = 150` (`300 + 150 * (slvl - 1)` frames duration)
 * - `Param5 = 20` (`20` sub-tiles radius)
 */
export function computeSlowMissilesStats113c(slvl: number): {
  readonly stateId: number
  readonly velocityFactorPct: number
  readonly durationFrames: number
  readonly radiusSubtiles: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  return {
    stateId: STATE_SLOWMISSILES_113C,
    velocityFactorPct: 33,
    durationFrames: 300 + 150 * (lvl - 1),
    radiusSubtiles: 20,
  }
}
