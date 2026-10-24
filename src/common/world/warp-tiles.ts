/**
 * Find the staircases a map's artwork declares.
 *
 * Diablo II does not store level exits in a table of coordinates. It stores
 * them in the map itself: a DS1 cell may carry a wall of **type 10 or 11**,
 * which the engine calls a *special* tile. A special tile draws nothing — it is
 * a marker — and its `style` field says what it marks.
 *
 * For styles 0..7 the meaning is a warp, and the style **is the `Warp0..7` slot
 * index** from `Levels.txt`. So a tile with `style` 3 in the Act 2 town is the
 * staircase for whatever `Vis3` points at, which is the second sewer entrance.
 * That is the whole join between the table and the artwork, and it was verified
 * against the shipped data before this module was written:
 *
 * | level | special tile styles | `Warp0..7` populated |
 * |-------|---------------------|----------------------|
 * | 20 Forgotten Tower entrance | 0, 1    | `Warp0=11`, `Warp1=12`       |
 * | 40 Lut Gholein              | 2, 3, 4 | `Warp2=19, Warp3=20, Warp4=24` |
 * | 50 Harem                    | 0, 2, 3 | `Warp0=25, Warp2=28, Warp3=29` |
 * | 33 Cathedral                | 1       | `Warp1=15`                   |
 *
 * Ten levels were checked and ten matched, including every case where a level
 * skips a slot.
 *
 * Styles of 8 and above are other kinds of marker — town entry points, player
 * start positions, act-specific arrival spots — and this module ignores them,
 * because `Warp0..7` has only eight slots and anything outside that range
 * cannot be a warp.
 *
 * A single staircase covers more than one cell: `LvlWarp.txt` `Tiles` is 2 for
 * almost every warp in the game and 4 for the two Act 5 barricade gates, and
 * the DS1 marks each covered cell separately with a rising `sequence`. Those
 * cells are grouped back together here, so the caller gets one position per
 * staircase rather than one per tile.
 *
 * Generated levels get this for free: the maze and wilderness generators stamp
 * whole DS1 pieces, and the special tiles come along with the walls. That is
 * why this module takes a `Ds1` and not a file name — it works the same on a
 * shipped preset and on a level that was assembled a millisecond ago.
 *
 * Browser-safe: no `node:` imports, no `Math.random`, no `process`.
 */
import type { Ds1 } from '../formats/ds1.ts'

/**
 * DS1 wall types that mark something instead of drawing something.
 *
 * Both values mean "special"; the game uses two so that a cell can hold two
 * markers at once, which happens in towns where a warp and an entry point sit
 * on the same tile.
 */
const SPECIAL_WALL_TYPES = [10, 11] as const

/** `Levels.txt` has `Warp0` through `Warp7`, so a style above this is not a warp. */
const MAX_WARP_SLOT = 7

/**
 * Cells this far apart still count as the same staircase.
 *
 * A warp is 2 or 4 cells in a row, so anything touching or diagonally adjacent
 * belongs together. Two genuinely different staircases sharing a slot are
 * always further apart than this — they are in different rooms.
 */
const GROUP_RADIUS = 1

/** One staircase, as the artwork placed it. */
export interface WarpTile {
  /** The `Warp0..7` slot, which is the DS1 special tile's `style`. */
  readonly slot: number
  /** Centre of the marked cells, in cells. */
  readonly cellX: number
  readonly cellY: number
  /** How many cells the marker covered; 2 for most warps, 4 for a few. */
  readonly tiles: number
  /** Top-left of the marked cells, for callers that want the corner. */
  readonly minCellX: number
  readonly minCellY: number
}

/** A cell carrying a marker, before grouping. */
interface MarkedCell {
  readonly slot: number
  readonly x: number
  readonly y: number
}

/**
 * Collect every special tile in the range that can be a warp.
 *
 * @param ds1 - the map.
 * @returns the marked cells, in scan order.
 */
function markedCells(ds1: Ds1): MarkedCell[] {
  const found: MarkedCell[] = []
  for (let y = 0; y < ds1.height; y += 1) {
    const row = ds1.cells[y]
    if (row === undefined) continue
    for (let x = 0; x < ds1.width; x += 1) {
      const cell = row[x]
      if (cell === undefined) continue
      for (const wall of cell.walls) {
        if (!SPECIAL_WALL_TYPES.includes(wall.type as 10 | 11)) continue
        if (wall.style > MAX_WARP_SLOT) continue
        found.push({ slot: wall.style, x, y })
      }
    }
  }
  return found
}

/**
 * Find the staircases in a map.
 *
 * Cells are grouped per slot, so a two-tile staircase produces one result. When
 * a slot is marked in two places — which the shipped maps never do but a
 * generated level can, because a generator may stamp the same stair piece
 * twice — every group is returned, in scan order, and the caller decides. The
 * first one is the natural choice and the order is deterministic.
 *
 * @param ds1 - the map to scan.
 * @returns one entry per staircase, sorted by slot and then by position.
 */
export function findWarpTiles(ds1: Ds1): WarpTile[] {
  const bySlot = new Map<number, MarkedCell[]>()
  for (const cell of markedCells(ds1)) {
    const list = bySlot.get(cell.slot)
    if (list === undefined) bySlot.set(cell.slot, [cell])
    else list.push(cell)
  }

  const out: WarpTile[] = []
  for (const [slot, cells] of [...bySlot].sort((left, right) => left[0] - right[0])) {
    // Flood the adjacency so a 2-tile or 4-tile marker collapses to one warp.
    const unvisited = new Set(cells.map((_, index) => index))
    while (unvisited.size > 0) {
      const first = unvisited.values().next().value as number
      unvisited.delete(first)
      const group = [cells[first]!]
      const queue = [cells[first]!]
      while (queue.length > 0) {
        const here = queue.pop()!
        for (const index of [...unvisited]) {
          const other = cells[index]!
          if (Math.abs(other.x - here.x) > GROUP_RADIUS) continue
          if (Math.abs(other.y - here.y) > GROUP_RADIUS) continue
          unvisited.delete(index)
          group.push(other)
          queue.push(other)
        }
      }

      let minX = group[0]!.x
      let minY = group[0]!.y
      let maxX = minX
      let maxY = minY
      for (const cell of group) {
        if (cell.x < minX) minX = cell.x
        if (cell.y < minY) minY = cell.y
        if (cell.x > maxX) maxX = cell.x
        if (cell.y > maxY) maxY = cell.y
      }
      out.push({
        slot,
        cellX: Math.floor((minX + maxX) / 2),
        cellY: Math.floor((minY + maxY) / 2),
        tiles: group.length,
        minCellX: minX,
        minCellY: minY,
      })
    }
  }

  out.sort((left, right) =>
    left.slot - right.slot || left.cellY - right.cellY || left.cellX - right.cellX)
  return out
}
