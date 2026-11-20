/**
 * The isometric collision grid as a *counting* terrain predicate.
 *
 * `combat.ts` does not ask "is this point blocked?" — it asks "how much of the
 * body is inside something?", and then only allows a move that does not make
 * that number worse:
 *
 * ```ts
 * if (dx !== 0 && terrain.overlap(x + dx, y) <= current) x += dx
 * ```
 *
 * The difference matters the moment a body starts *inside* geometry, which a
 * spawn point picked from a cell centre can do: a wall's art hangs above its
 * cell, so a cell that looks free can still have blocked sub-tiles under the
 * feet. With a count, a body five sub-tiles deep may step to a position three
 * deep and keep descending until it is out — the predicate is a gradient. With
 * a boolean the same body reads `1` everywhere inside, `1 <= 1` holds for every
 * direction, and it random-walks until it happens to leave. It escapes either
 * way, which is why the boolean version looks fine in a demo, but only the
 * count escapes *reliably* and in a *direction*.
 *
 * Why this cannot reuse `map.ts`'s `blockedOverlap`: that one walks a
 * rectangular range of grid indices, which is correct only when a sub-tile is a
 * screen-space rectangle. Here it is a diamond — 16 wide by 8 tall — so a
 * screen-space box maps to a sheared, staggered set of grid cells with no
 * rectangular index range to iterate. Sampling a lattice over the box and
 * asking {@link isBlockedAt} per sample sidesteps the inversion entirely and
 * stays correct under the 2:1 projection.
 */
import {
  COLLIDE_MASK_LOS,
  COLLIDE_MASK_MISSILE,
  ORTHO_SUB_TILE_HEIGHT,
  ORTHO_SUB_TILE_WIDTH,
  isBlockedAt,
  isMissileBlockedAt,
  rayTraceScene,
} from './d2map.ts'
import type { CollisionGrid } from './d2map.ts'

/**
 * Sample spacing as a fraction of one sub-tile.
 *
 * Half a sub-tile: fine enough that a body cannot straddle a blocked diamond
 * without any sample landing on it, coarse enough that a 20×10 feet box costs
 * 4×4 = 16 lookups rather than hundreds. The lattice is fixed rather than
 * adaptive so that the count is a pure function of position — the simulation
 * has to stay reproducible for saves and for lockstep.
 */
const SAMPLE_FRACTION = 0.5

/**
 * How many samples span one axis of the body box.
 *
 * @param extent - the box's size on that axis, in screen pixels.
 * @param subTile - the sub-tile's size on that axis, in screen pixels.
 * @returns at least two samples, so both edges are always tested.
 */
function sampleCount(extent: number, subTile: number): number {
  return Math.max(2, Math.ceil(extent / (subTile * SAMPLE_FRACTION)) + 1)
}

/**
 * How many sample points of a body box land on blocked sub-tiles.
 *
 * Out-of-bounds counts as blocked, matching {@link isBlockedAt}, so walking off
 * the edge of a level is refused by the same rule that refuses walls instead of
 * needing a separate bounds check at every call site.
 *
 * @param grid - the level's collision grid.
 * @param x - body centre, scene-space x.
 * @param y - body centre, scene-space y.
 * @param width - body width in screen pixels.
 * @param height - body height in screen pixels.
 * @returns the blocked sample count, 0 when the body is entirely clear.
 */
export function isoOverlap(
  grid: CollisionGrid,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const cols = sampleCount(width, ORTHO_SUB_TILE_WIDTH)
  const rows = sampleCount(height, ORTHO_SUB_TILE_HEIGHT)
  let blocked = 0
  for (let row = 0; row < rows; row += 1) {
    // Spread samples across the full extent inclusive of both edges, so a body
    // touching a wall with its edge is already counted as overlapping by one
    // rather than only once its centre crosses.
    const sampleY = y - height / 2 + (height * row) / (rows - 1)
    for (let col = 0; col < cols; col += 1) {
      const sampleX = x - width / 2 + (width * col) / (cols - 1)
      if (isBlockedAt(grid, sampleX, sampleY)) blocked += 1
    }
  }
  return blocked
}

/** A body's footprint, in screen pixels. */
export interface BodySize {
  /** Width of the collision box at the feet. */
  readonly width: number
  /** Height of the collision box at the feet. */
  readonly height: number
}

/**
 * The shape `GameEngine` and `combat.ts` consume.
 *
 * Declared here rather than imported so this module stays a leaf: the engine
 * depends on the terrain, not the other way round.
 */
export interface CountingTerrain {
  /** Level width in screen pixels. */
  readonly widthPx: number
  /** Level height in screen pixels. */
  readonly heightPx: number
  /** The underlying collision grid if available. */
  readonly grid?: CollisionGrid
  /** Origin X coordinate of map grid. */
  readonly originX?: number
  /** Origin Y coordinate of map grid. */
  readonly originY?: number
  /**
   * Blocked sample count for a body centred here.
   *
   * @param x - scene-space x.
   * @param y - scene-space y.
   * @returns 0 when clear, larger the deeper the body is inside geometry.
   */
  overlap(x: number, y: number): number
  /**
   * Whether a projectile / missile is blocked at `(x, y)` or along the segment from `(fromX, fromY)` to `(x, y)`.
   * Uses `COLLIDE_MASK_MISSILE` (`0x0804`) by default, or checks the caller-provided 1.13c `CollideType` terrain mask
   * (e.g. `0x05` for `CollideType = 8`, which includes `COLLIDE_WALL` `0x01`).
   */
  isMissileBlocked?(x: number, y: number, fromX?: number, fromY?: number, mask?: number): boolean
  /**
   * Whether there is an unobstructed Line-of-Sight (LoS) between `(fromX, fromY)` and `(toX, toY)` (`COLLIDE_MASK_LOS`).
   */
  hasLineOfSight?(fromX: number, fromY: number, toX: number, toY: number): boolean
}

/**
 * Wrap an isometric collision grid as a counting terrain.
 *
 * @param grid - the level's collision grid.
 * @param widthPx - level width in screen pixels.
 * @param heightPx - level height in screen pixels.
 * @param body - the moving body's footprint.
 * @returns a terrain the combat simulation can consume directly.
 */
export function createIsoTerrain(
  grid: CollisionGrid,
  widthPx: number,
  heightPx: number,
  body: BodySize,
): CountingTerrain {
  return {
    widthPx,
    heightPx,
    grid,
    originX: grid.originX,
    originY: grid.originY,
    overlap: (x: number, y: number): number => isoOverlap(grid, x, y, body.width, body.height),
    isMissileBlocked: (x: number, y: number, fromX?: number, fromY?: number, mask?: number): boolean => {
      if (mask === 0) return false
      const effectiveMask = mask !== undefined ? (mask | 0x0800) : COLLIDE_MASK_MISSILE
      if (fromX !== undefined && fromY !== undefined) {
        return rayTraceScene(grid, fromX, fromY, x, y, effectiveMask).hit
      }
      return isMissileBlockedAt(grid, x, y, effectiveMask)
    },
    hasLineOfSight: (fromX: number, fromY: number, toX: number, toY: number): boolean => {
      return !rayTraceScene(grid, fromX, fromY, toX, toY, COLLIDE_MASK_LOS).hit
    },
  }
}
