/**
 * Turning a decoded DS1 map and its DT1 library into something renderable and
 * walkable.
 *
 * Three translations happen here, and each is the reason a map and a tile
 * library cannot be used apart:
 *
 * 1. **A cell reference becomes a tile bitmap.** A DS1 cell holds `(style,
 *    sequence)` per layer plus a wall orientation; the DT1 library is keyed by
 *    exactly those fields. A miss is not an error — real maps reference
 *    substitutions and trimmed libraries — so misses fall back from
 *    `(style, sequence, orientation)` to `(style, sequence)` and then to
 *    nothing, and are reported as counts.
 * 2. **Cells become a draw order.** Diablo's map is drawn back to front:
 *    floors first in cell order, then walls in screen order (further rows
 *    first, so a nearer wall covers the one behind it). Depth is paint order,
 *    never the depth buffer.
 * 3. **Sub-tile flags become a collision grid.** Each tile carries a 5×5 grid
 *    of flags, so collision resolution is `tileEdge / 5` — 32 pixels for the
 *    standard 160-pixel tile — and a blocked sub-tile blocks walking for the
 *    whole world, whatever layer placed it.
 */
/** Sub-tiles per tile edge (the collision grid's resolution). */
export const SUB_TILES_PER_TILE = 5

/** One tile draw: which library tile, and where in the world. */
export interface MapDraw {
  /** Index into library frames. */
  readonly tileIndex: number
  /** World-space left edge. */
  readonly x: number
  /** World-space top edge. */
  readonly y: number
  /** Cell coordinates, for debugging and sorting. */
  readonly cellX: number
  readonly cellY: number
}

/**
 * Where an actor belongs inside a wall draw list.
 *
 * Walls are drawn far to near, so an actor is inserted at the first wall that is
 * *nearer* than it — the index whose depth key (`cellY + cellX`) first exceeds the
 * actor's. That single rule is what makes standing behind a wall look right
 * without a depth buffer, and keeping it a pure function keeps it testable
 * without a renderer.
 *
 * @param walls - wall draws, in painter's order.
 * @param cellX - the actor's cell column.
 * @param cellY - the actor's cell row.
 * @returns the index to insert at (equal to the wall count when the actor is
 * nearest and goes last).
 */
export function depthInsertIndex(
  walls: readonly Pick<MapDraw, 'cellX' | 'cellY'>[],
  cellX: number,
  cellY: number,
): number {
  const depth = cellX + cellY
  for (let index = 0; index < walls.length; index += 1) {
    const wall = walls[index]!
    if (wall.cellX + wall.cellY > depth) return index
  }
  return walls.length
}

