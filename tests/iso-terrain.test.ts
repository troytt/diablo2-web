/**
 * Isometric collision counting.
 *
 * The point of {@link isoOverlap} is that it returns a *count*, not a boolean.
 * `combat.ts` escapes geometry with `if (terrain.overlap(next) <= current)`, so
 * a boolean predicate reads `1` everywhere inside a wall, `1 <= 1` always holds,
 * and a body that spawns inside geometry random-walks out. A count gives that
 * rule a gradient to descend. These tests therefore assert the *shape* of the
 * returned numbers, not just "blocked or not".
 *
 * The grid is synthetic rather than a decoded DS1 so the expected values can be
 * reasoned about by hand; the DS1 path is already covered by the act tests.
 */
import { describe, expect, it } from 'vitest'
import { isoOverlap } from '../src/common/world/iso-terrain.ts'
import { createIsoTerrain } from '../src/common/world/iso-terrain.ts'
import { isBlockedAt } from '../src/common/world/d2map.ts'
import type { CollisionGrid } from '../src/common/world/d2map.ts'

/** Sub-tiles per tile edge, matching `d2map.ts`. */
const SUB = 5
/** Grid size in cells. Large enough to hold a wall block and clear space. */
const CELLS = 10
/**
 * Origin large enough that every cell of the grid maps to a positive scene x.
 *
 * `cx - cy` ranges over ±9, and a cell is 80 wide in x, so 900 clears it.
 */
const ORIGIN_X = 900

/** The player's feet box in `act-scene.ts`. Deliberately 2:1, like the tiles. */
const FEET_WIDTH = 20
const FEET_HEIGHT = 10

/**
 * An empty collision grid.
 *
 * @returns a grid with nothing blocked.
 */
function makeGrid(): CollisionGrid {
  return {
    originX: ORIGIN_X,
    originY: 0,
    cellsX: CELLS,
    cellsY: CELLS,
    blocked: new Uint8Array(CELLS * SUB * CELLS * SUB),
    gridWidth: CELLS * SUB,
  }
}

/**
 * Mark every sub-tile of one cell blocked.
 *
 * @param grid - the grid to mutate.
 * @param cellX - cell column.
 * @param cellY - cell row.
 */
function blockCell(grid: CollisionGrid, cellX: number, cellY: number): void {
  for (let sy = 0; sy < SUB; sy += 1) {
    for (let sx = 0; sx < SUB; sx += 1) {
      grid.blocked[(cellY * SUB + sy) * grid.gridWidth + cellX * SUB + sx] = 1
    }
  }
}

/**
 * Fractional cell coordinates as a scene-space point.
 *
 * Forward of `cellAt`'s inversion: `x = (cx - cy) * 80`, `y = (cx + cy) * 40`.
 *
 * @param cellX - fractional cell column.
 * @param cellY - fractional cell row.
 * @returns the scene point.
 */
function pointAt(cellX: number, cellY: number): { x: number; y: number } {
  return { x: (cellX - cellY) * 80 + ORIGIN_X, y: (cellX + cellY) * 40 }
}

/**
 * A grid with cells 2..5 in both axes blocked — a wall four cells thick.
 *
 * Thick enough that a body at its centre is fully enclosed, so the count
 * saturates and the walk outwards has somewhere to descend from.
 *
 * @returns the grid.
 */
function gridWithWallBlock(): CollisionGrid {
  const grid = makeGrid()
  for (let cy = 2; cy <= 5; cy += 1) {
    for (let cx = 2; cx <= 5; cx += 1) blockCell(grid, cx, cy)
  }
  return grid
}

/** Samples taken for the feet box: 4 columns × 4 rows. */
const FEET_SAMPLES = 16

describe('isoOverlap', () => {
  it('counts nothing on clear ground', () => {
    const grid = gridWithWallBlock()
    const clear = pointAt(8.5, 8.5)
    expect(isoOverlap(grid, clear.x, clear.y, FEET_WIDTH, FEET_HEIGHT)).toBe(0)
  })

  it('saturates when the whole body is inside geometry', () => {
    const grid = gridWithWallBlock()
    const deep = pointAt(4, 4)
    expect(isoOverlap(grid, deep.x, deep.y, FEET_WIDTH, FEET_HEIGHT)).toBe(FEET_SAMPLES)
  })

  it('treats off-grid as fully blocked, so the level edge needs no special case', () => {
    const grid = gridWithWallBlock()
    expect(isoOverlap(grid, -99_999, -99_999, FEET_WIDTH, FEET_HEIGHT)).toBe(FEET_SAMPLES)
  })

  it('falls monotonically as the body leaves a wall, and passes through partial counts', () => {
    const grid = gridWithWallBlock()
    const deep = pointAt(4, 4)
    const sweep: number[] = []
    for (let dx = 0; dx <= 400; dx += 20) {
      sweep.push(isoOverlap(grid, deep.x + dx, deep.y, FEET_WIDTH, FEET_HEIGHT))
    }

    // Never worse as we walk away: this is exactly the invariant combat.ts's
    // `overlap(next) <= current` rule needs in order to make progress.
    for (let i = 1; i < sweep.length; i += 1) expect(sweep[i]).toBeLessThanOrEqual(sweep[i - 1]!)

    expect(sweep[0]).toBe(FEET_SAMPLES)
    expect(sweep.at(-1)).toBe(0)
    // A boolean predicate could only ever produce 0 and 1 here. Partial counts
    // are the whole reason this module exists.
    expect(sweep.some(count => count > 0 && count < FEET_SAMPLES)).toBe(true)
  })

  it('counts an overlap before the body centre enters the wall', () => {
    const grid = gridWithWallBlock()
    const deep = pointAt(4, 4)
    // Found by sweeping: the feet box still clips the block here while its
    // centre is already on clear ground.
    const x = deep.x + 320
    expect(isBlockedAt(grid, x, deep.y)).toBe(false)
    expect(isoOverlap(grid, x, deep.y, FEET_WIDTH, FEET_HEIGHT)).toBeGreaterThan(0)
  })

  it('samples y twice as densely as x, because sub-tiles are 16 by 8', () => {
    const grid = gridWithWallBlock()
    const deep = pointAt(4, 4)

    // A 2:1 box matches the projection, so it costs the same on both axes.
    expect(isoOverlap(grid, deep.x, deep.y, 20, 10)).toBe(16)
    // A square box is twice as tall in sub-tiles as it is wide, so it grows
    // rows, not columns. A grid-index scan over a rectangle — what map.ts does
    // for the orthogonal fixture — cannot express this.
    expect(isoOverlap(grid, deep.x, deep.y, 20, 20)).toBe(24)
    // And doubling the width grows columns by the same ratio.
    expect(isoOverlap(grid, deep.x, deep.y, 40, 10)).toBe(24)
  })
})

describe('createIsoTerrain', () => {
  it('exposes the level size and binds the body once', () => {
    const grid = gridWithWallBlock()
    const terrain = createIsoTerrain(grid, 1234, 567, { width: FEET_WIDTH, height: FEET_HEIGHT })
    expect(terrain.widthPx).toBe(1234)
    expect(terrain.heightPx).toBe(567)

    const deep = pointAt(4, 4)
    const clear = pointAt(8.5, 8.5)
    expect(terrain.overlap(deep.x, deep.y)).toBe(FEET_SAMPLES)
    expect(terrain.overlap(clear.x, clear.y)).toBe(0)
  })

  it('is a pure function of position, so saves and lockstep stay reproducible', () => {
    const grid = gridWithWallBlock()
    const terrain = createIsoTerrain(grid, 100, 100, { width: FEET_WIDTH, height: FEET_HEIGHT })
    const p = pointAt(5.9, 4.1)
    const first = terrain.overlap(p.x, p.y)
    for (let i = 0; i < 5; i += 1) expect(terrain.overlap(p.x, p.y)).toBe(first)
  })
})
