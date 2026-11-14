/**
 * Diablo II: Lord of Destruction v1.13c — Blizzard (Skill 59) Circle Table.
 *
 * Authoritative 64-entry circle lookup table from D2Game.dll (VA 0x6FD1C960, 0x6FD1CA60).
 * Table radius = 30 subtiles.
 *
 * Used by MISSMODE_SrvDo10_blizzardcenter (0x6FC60CA0) to disperse falling shards
 * across a radius of 7 subtiles with 2:1 isometric ground projection (Y * 0.5).
 */

export const BLIZZARD_CIRCLE_X: readonly number[] = Object.freeze([
  0, 2, 5, 8, 11, 14, 16, 19,
  21, 23, 24, 26, 27, 28, 29, 29,
  30, 29, 29, 28, 27, 26, 24, 23,
  21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19,
  -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23,
  -21, -19, -16, -14, -11, -8, -5, -2,
])

export const BLIZZARD_CIRCLE_Y: readonly number[] = Object.freeze([
  30, 29, 29, 28, 27, 26, 24, 23,
  21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19,
  -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23,
  -21, -19, -16, -14, -11, -8, -5, -2,
  0, 2, 5, 8, 11, 14, 16, 19,
  21, 23, 24, 26, 27, 28, 29, 29,
])

/**
 * 2:1 Isometric ground projection ratio.
 */
export const ISO_GROUND_ASPECT_RATIO = 0.5

/**
 * Default subtile to world pixel conversion ratio.
 * 1 full tile = 160x80 px = 5x5 subtiles -> 1 subtile = 16 px half-width (32 px full-width).
 */
export const SUBTILE_TO_PX = 16

/**
 * Calculates ground target offset for a Blizzard falling shard using the 64-entry circle table
 * with 2:1 isometric ground foreshortening (Y * 0.5).
 *
 * @param angleIdx - Angle index in the 64-entry table (0..63)
 * @param radiusSubtiles - Radius in subtiles (default: 7 from Skills.txt Param1)
 * @param subtileToPx - Subtile to world pixel ratio (default: 16)
 * @returns { dx, dy } in world pixel coordinates
 */
export function getBlizzardDropOffset(
  angleIdx: number,
  radiusSubtiles = 7,
  subtileToPx = SUBTILE_TO_PX,
): { dx: number; dy: number } {
  const idx = Math.abs(angleIdx % 64)
  const tblX = BLIZZARD_CIRCLE_X[idx]!
  const tblY = BLIZZARD_CIRCLE_Y[idx]!
  const scale = (radiusSubtiles * subtileToPx) / 30
  const dx = tblX * scale
  const dy = tblY * scale * ISO_GROUND_ASPECT_RATIO
  return { dx, dy }
}
