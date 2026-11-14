/**
 * Level links: the baked description of every way out of a level.
 *
 * The world graph in `world-graph.ts` says *that* the Cold Plains connects to
 * the Stony Field. It cannot say *where*, because "where" depends on the roll
 * of the generator that built this particular copy of the Cold Plains. This
 * module is the other half: the shapes that carry the coordinates, and the
 * geometry helpers that recover them when the generator did not hand them over.
 *
 * Three kinds of link, because the player crosses them in three different ways:
 *
 * - {@link SceneEntrance} — a gap in the border that the player simply walks
 *   through. No click, no click target, and in the original game no loading
 *   screen either; the engine streams the neighbouring level in behind a very
 *   short fade.
 * - {@link SceneWarp} — a stair, cave mouth or door. Clickable, described by a
 *   row of `LvlWarp.txt`, and always a full transition.
 * - {@link SceneWaypoint} — the blue portal ring. Not a link to one place but
 *   to every activated waypoint at once, so it carries a network id rather than
 *   a destination.
 *
 * ## Coordinates
 *
 * Everything here is in **sub-tiles**, the five-to-a-cell grid the collision
 * map and the player's position both use, with `(0, 0)` at the level's origin.
 * The generators work in cells and `LvlWarp.txt` works in pixels; both are
 * converted on the way in, so that nothing downstream has to remember which
 * unit a given number is in.
 *
 * ## Browser safety
 *
 * Imported by the runtime, so the same rules as `maze.ts` and `wilderness.ts`
 * apply: no `node:` builtins, no `Buffer`, no `Math.random`, no `process.env`.
 */

import type { Side } from './world-graph.ts'
import { SUB_TILES_PER_TILE } from './map.ts'

/**
 * How close the player must be to a border seam for it to fire, in sub-tiles.
 *
 * Generous: a seam is a gap several tiles wide and the player should cross it
 * by walking at it, not by finding one exact sub-tile. Three sub-tiles is a
 * little over half a cell either side of the recorded midpoint.
 *
 * Lives here rather than in the scene because `verify-world-walk` has to agree
 * with the scene about what counts as standing on a link; two copies of the
 * number would let the guardrail pass while the game does something else.
 */
export const SEAM_TRIGGER_SUBTILES = 3

/**
 * How close the player must be to a warp for the use key to take it.
 *
 * Tighter than a seam, because warps sit in open ground and two of them can be
 * in the same room.
 */
export const WARP_TRIGGER_SUBTILES = 5


/**
 * A collision map, reduced to what the geometry helpers need.
 *
 * Structurally satisfied by both `IsoMapScene` and `CollisionGrid`, so callers
 * can pass either without adapting.
 */
export interface LinkGrid {
  /** Cells across and down. */
  readonly cellsX: number
  readonly cellsY: number
  /** Sub-tiles across; `cellsX * 5`. */
  readonly gridWidth: number
  /** Sub-tiles down; `cellsY * 5`. */
  readonly gridHeight: number
  /** One byte per sub-tile, non-zero meaning impassable. */
  readonly blocked: Uint8Array
}

/** A gap in the border the player walks through. */
export interface SceneEntrance {
  /** The level on the other side. */
  readonly toLevelId: number
  /** Which edge of this level the gap is in. */
  readonly side: Side
  /** The generator's name for it, e.g. `Cold Plains Exit`. */
  readonly label: string
  /** The gap itself, in sub-tiles: cross this and you have left. */
  readonly x: number
  readonly y: number
  /**
   * Where to put the player when they arrive *here* through this gap.
   *
   * One step inside the level, never on the gap itself: landing on the trigger
   * would bounce the player straight back out.
   */
  readonly arriveX: number
  readonly arriveY: number
}

/** A stair, cave mouth or door. */
export interface SceneWarp {
  /** The level on the other side, or -1 when the bake could not resolve one. */
  readonly toLevelId: number
  /** The `LvlWarp.txt` row describing it, or -1 when there is no row. */
  readonly warpId: number
  /**
   * Which way it goes. `down`/`up` are the two ends of a dungeon staircase;
   * `in`/`out` are a preset's mouth, where there is no depth to speak of.
   */
  readonly direction: 'up' | 'down' | 'in' | 'out'
  /** The generator's name for it. */
  readonly label: string
  /** The anchor sub-tile: what the click target is measured from. */
  readonly x: number
  readonly y: number
  /** Where the player lands when arriving here, in sub-tiles. */
  readonly arriveX: number
  readonly arriveY: number
  /**
   * The click target, in pixels relative to the anchor sub-tile's bottom
   * corner, straight from `LvlWarp.txt`. A zero-sized box means the warp has no
   * clickable tile and is triggered by walking into it.
   */
  readonly selectX: number
  readonly selectY: number
  readonly selectDX: number
  readonly selectDY: number
  /** The short auto-walk away from the warp on arrival, in sub-tiles. */
  readonly exitWalkX: number
  readonly exitWalkY: number
  /**
   * How the bake found this warp.
   *
   * - `tile` — the map's own special tile said so. This is the real position.
   * - `room` — the maze generator stamped a staircase room and the warp was
   *   matched to it by direction. Right room, approximate spot within it.
   * - `fallback` — neither existed, and the warp was put on open ground so the
   *   level is not a trap. The position is invented and says nothing about
   *   where the original game put the stairs.
   *
   * The last case only happens for level types whose DRLG staircase pass is not
   * transcribed yet, and `verify-packs` counts them so the number cannot creep
   * up unnoticed.
   */
  readonly source: 'tile' | 'room' | 'fallback'
}

/** A waypoint pedestal. */
export interface SceneWaypoint {
  /** `Levels.txt` `Waypoint`, 0..38. The network is keyed on this. */
  readonly waypointId: number
  /** The pedestal, in sub-tiles. */
  readonly x: number
  readonly y: number
  /** Where the player lands when arriving by waypoint. */
  readonly arriveX: number
  readonly arriveY: number
  /**
   * How the position was decided.
   *
   * - `object` — read off a waypoint object baked into the level's artwork.
   *   This is the real position.
   * - `placed` — chosen by {@link findWaypointSpot} because the generator does
   *   not yet run `DRLGOUTDOORS_SpawnAct12Waypoint`. An approximation.
   */
  readonly source: 'object' | 'placed'
}

/** Everything the runtime needs to leave a level. */
export interface SceneLinks {
  readonly entrances: readonly SceneEntrance[]
  readonly warps: readonly SceneWarp[]
  readonly waypoints: readonly SceneWaypoint[]
  /**
   * Graph edges this level could not place an opening for.
   *
   * Recorded rather than silently dropped: an edge with nowhere to stand is a
   * hole in the world, and the verifier reports on this list.
   */
  readonly unplacedEdges: readonly { readonly toLevelId: number; readonly reason: string }[]
  /** Diagnostic notes and warnings from link resolution (e.g. fallback warps placed). */
  readonly notes?: readonly string[]
}

/**
 * Convert a cell coordinate to the sub-tile at its centre.
 *
 * @param cell - the cell coordinate.
 * @returns the centre sub-tile.
 */
export function cellToSubTile(cell: number): number {
  return cell * SUB_TILES_PER_TILE + 2
}

/**
 * Whether a sub-tile can be stood on.
 *
 * @param grid - the collision map.
 * @param x - sub-tile x.
 * @param y - sub-tile y.
 * @returns true when in bounds and not blocked.
 */
export function isWalkable(grid: LinkGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.gridWidth || y >= grid.gridHeight) return false
  return grid.blocked[y * grid.gridWidth + x] === 0
}

/**
 * A subset of a level's walkable sub-tiles, one byte each.
 *
 * Used to mean "the part of the map the player can actually get to", so that a
 * puddle of open ground outside the town wall is not mistaken for a gate.
 */
export type WalkableRegion = Uint8Array

/**
 * The biggest connected patch of open ground in a level.
 *
 * Maps are not one connected space. A town's artwork leaves walkable sub-tiles
 * in the moat outside its wall; a cave's rock has pockets the layout never
 * joins up. Anything placed in one of those is a link the player can see on the
 * minimap and never touch, which is exactly the failure this pass exists to
 * prevent. Taking the largest component is a blunt rule, but on every map
 * measured the main play area dwarfs the leftovers by an order of magnitude.
 *
 * Four-connected, matching the engine's axis-aligned feet box: a diagonal
 * squeeze between two blocked corners is not somewhere a player can walk.
 *
 * @param grid - the collision map.
 * @returns one byte per sub-tile, 1 inside the main region.
 */
export function largestWalkableRegion(grid: LinkGrid): WalkableRegion {
  const width = grid.gridWidth
  const height = grid.gridHeight
  const component = new Int32Array(width * height).fill(-1)
  const sizes: number[] = []
  // An explicit stack rather than recursion: the biggest maps are 425x425,
  // which is deep enough to overflow the call stack.
  const stack: number[] = []

  for (let seed = 0; seed < component.length; seed += 1) {
    if (component[seed] !== -1 || grid.blocked[seed] !== 0) continue
    const label = sizes.length
    let size = 0
    component[seed] = label
    stack.push(seed)
    while (stack.length > 0) {
      const here = stack.pop()!
      size += 1
      const x = here % width
      const y = (here - x) / width
      if (x > 0) { const n = here - 1; if (component[n] === -1 && grid.blocked[n] === 0) { component[n] = label; stack.push(n) } }
      if (x < width - 1) { const n = here + 1; if (component[n] === -1 && grid.blocked[n] === 0) { component[n] = label; stack.push(n) } }
      if (y > 0) { const n = here - width; if (component[n] === -1 && grid.blocked[n] === 0) { component[n] = label; stack.push(n) } }
      if (y < height - 1) { const n = here + width; if (component[n] === -1 && grid.blocked[n] === 0) { component[n] = label; stack.push(n) } }
    }
    sizes.push(size)
  }

  let best = -1
  let bestSize = 0
  sizes.forEach((size, label) => { if (size > bestSize) { bestSize = size; best = label } })

  const region = new Uint8Array(component.length)
  if (best < 0) return region
  for (let at = 0; at < component.length; at += 1) if (component[at] === best) region[at] = 1
  return region
}

/**
 * Whether a sub-tile is inside a region, or walkable when there is no region.
 *
 * @param grid - the collision map.
 * @param region - the region to test against, or undefined for "anywhere open".
 * @param x - sub-tile x.
 * @param y - sub-tile y.
 * @returns true when the sub-tile qualifies.
 */
function inRegion(grid: LinkGrid, region: WalkableRegion | undefined, x: number, y: number): boolean {
  if (!isWalkable(grid, x, y)) return false
  return region === undefined || region[y * grid.gridWidth + x] === 1
}

/**
 * The nearest walkable sub-tile to a point.
 *
 * Searches outwards in square rings, so the first hit is the closest by
 * Chebyshev distance and ties break in a fixed order rather than by chance.
 *
 * @param grid - the collision map.
 * @param x - sub-tile x to search around.
 * @param y - sub-tile y to search around.
 * @param maxRadius - how far out to give up, in sub-tiles.
 * @param region - when given, only sub-tiles inside it count.
 * @returns the sub-tile, or null if everything within `maxRadius` is blocked.
 */
export function nearestWalkable(
  grid: LinkGrid,
  x: number,
  y: number,
  maxRadius = 24,
  region?: WalkableRegion,
): { x: number; y: number } | null {
  if (inRegion(grid, region, x, y)) return { x, y }
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        // Only the ring, not its interior: the interior was covered by the
        // smaller radii already.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
        if (inRegion(grid, region, x + dx, y + dy)) return { x: x + dx, y: y + dy }
      }
    }
  }
  return null
}

/**
 * Whether a link here could be set off by a player standing in a region.
 *
 * The runtime fires a link when the player's sub-tile is within the link's
 * trigger radius of it. That test says nothing about whether the player can
 * *get* to such a sub-tile: a staircase surrounded by open ground that is
 * walled off from the rest of the map passes it and is still unreachable. So
 * the question worth asking at bake time is the trigger test restricted to the
 * region the player actually inhabits.
 *
 * With no region this degenerates to "is there open ground in the box", which
 * is the weaker check the bake used before regions existed.
 *
 * @param grid - the collision map.
 * @param region - the ground the player can reach, or undefined for anywhere.
 * @param x - the link's sub-tile x.
 * @param y - the link's sub-tile y.
 * @param radius - the link's trigger radius, in sub-tiles.
 * @returns true when some sub-tile of the region lies inside the trigger box.
 */
export function triggerableFrom(
  grid: LinkGrid,
  region: WalkableRegion | undefined,
  x: number,
  y: number,
  radius: number,
): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (inRegion(grid, region, x + dx, y + dy)) return true
    }
  }
  return false
}

/**
 * The inward direction for a side, in sub-tiles.
 *
 * @param side - the edge.
 * @returns a unit step pointing into the level.
 */
function inwardStep(side: Side): { x: number; y: number } {
  switch (side) {
    case 'north':
      return { x: 0, y: 1 }
    case 'south':
      return { x: 0, y: -1 }
    case 'west':
      return { x: 1, y: 0 }
    case 'east':
      return { x: -1, y: 0 }
  }
}

/**
 * Choose an arrival sub-tile inward from a border seam so arriving cannot
 * immediately re-trigger the seam.
 *
 * Searches outward in square rings around a point `SEAM_TRIGGER_SUBTILES + 3`
 * steps inside the level from `(x, y)`, accepting only sub-tiles in `region`
 * that lie strictly outside the trigger box around `(x, y)`.
 *
 * @param grid - the collision map.
 * @param x - the seam trigger's sub-tile x.
 * @param y - the seam trigger's sub-tile y.
 * @param side - which edge of the level the seam sits on.
 * @param region - when given, only sub-tiles inside it qualify.
 * @returns an arrival sub-tile safe from immediate re-triggering.
 */
export function seamArrivalSpot(
  grid: LinkGrid,
  x: number,
  y: number,
  side: Side,
  region?: WalkableRegion,
): { x: number; y: number } {
  const step = inwardStep(side)
  const targetX = x + step.x * (SEAM_TRIGGER_SUBTILES + 3)
  const targetY = y + step.y * (SEAM_TRIGGER_SUBTILES + 3)
  const maxRadius = Math.max(grid.gridWidth, grid.gridHeight, 64)
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
        const px = targetX + dx
        const py = targetY + dy
        if (!inRegion(grid, region, px, py)) continue
        if (Math.abs(px - x) <= SEAM_TRIGGER_SUBTILES && Math.abs(py - y) <= SEAM_TRIGGER_SUBTILES) continue
        return { x: px, y: py }
      }
    }
  }
  // Never place the player directly back on or inside the trigger box around (x, y),
  // which would trigger an immediate bounce back in an infinite ping-pong loop.
  const clampedX = Math.max(0, Math.min(grid.gridWidth - 1, targetX))
  const clampedY = Math.max(0, Math.min(grid.gridHeight - 1, targetY))
  if (Math.abs(clampedX - x) <= SEAM_TRIGGER_SUBTILES && Math.abs(clampedY - y) <= SEAM_TRIGGER_SUBTILES) {
    return { x: targetX, y: targetY }
  }
  return { x: clampedX, y: clampedY }
}

/** Where an edge of a level opens, and how convincing the opening is. */
export interface BorderOpening {
  /** The gap itself, in sub-tiles. */
  readonly x: number
  readonly y: number
  /** One step inside, where an arriving player is put. */
  readonly arriveX: number
  readonly arriveY: number
  /**
   * How far in from the border the gap was found, in sub-tiles.
   *
   * Zero means the walkable area runs off the edge of the map, which is what a
   * real gate looks like. Anything larger means the scan gave up on the border
   * and settled for the walkable area's closest approach to it.
   */
  readonly inset: number
  /** How wide the gap is along the edge, in sub-tiles. */
  readonly width: number
}

/**
 * Find the gap in one edge of a level's border.
 *
 * For generated levels the generator already knows where it cut the border, and
 * this is not needed. Preset levels are the reason it exists: the Rogue
 * Encampment's gate is painted into fixed artwork, and the only way to find it
 * without hand-measuring every town is to look at what the artwork left
 * walkable.
 *
 * The scan works inwards from the edge because a border is a band, not a line:
 * the outermost sub-tiles of a town are solid cliff, and the gate first becomes
 * walkable a little way in. The first band row with any walkable run wins, and
 * within it the longest run, whose middle is the gap.
 *
 * How far in is worth looking is not a small fixed number. Measured on the
 * baked collision maps, Kurast 4's west margin is 55 sub-tiles of solid jungle
 * and its east margin 48, and the Act 3 docks are walled 45 sub-tiles deep on
 * the east; an earlier flat limit of 40 declared all three edges solid. The
 * default is therefore half the level's depth: past the midpoint a gap is no
 * longer on the side we were asked about, so that is the natural place to stop
 * rather than an arbitrary one.
 *
 * Passing `region` is strongly recommended. Without it the Rogue Encampment's
 * four variants all report a gate on whichever side they were asked about,
 * because every one of them has walkable sand in the moat *outside* the camp
 * wall — a gate the player can see and never reach.
 *
 * @param grid - the collision map.
 * @param side - which edge to search.
 * @param region - when given, only gaps inside it count as gaps.
 * @param bandDepth - how many sub-tiles inwards to look before giving up.
 *   Defaults to half the level's depth on the axis being searched.
 * @param range - when given, only this stretch of the edge is searched (sub-tiles along the side,
 *   `from` inclusive, `to` exclusive). Generated levels whose generator knows which part of the edge
 *   opens onto the neighbour pass it, so a gap elsewhere on the same edge is never taken for it.
 * @returns the opening, or null if the edge is solid all the way in.
 */
export function findBorderOpening(
  grid: LinkGrid,
  side: Side,
  region?: WalkableRegion,
  bandDepth?: number,
  range?: { readonly from: number; readonly to: number },
): BorderOpening | null {
  const horizontal = side === 'north' || side === 'south'
  const span = horizontal ? grid.gridWidth : grid.gridHeight
  const depth = horizontal ? grid.gridHeight : grid.gridWidth
  const limit = Math.min(bandDepth ?? Math.floor(depth / 2), depth)
  const lo = range?.from ?? 0
  const hi = range?.to ?? span
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 0 || hi > span || lo >= hi) {
    throw new Error(`findBorderOpening: range ${String(lo)}..${String(hi)} is not inside the ${side} edge (0..${String(span)})`)
  }

  for (let inset = 0; inset < limit; inset += 1) {
    const fixed = side === 'north' || side === 'west' ? inset : depth - 1 - inset

    let bestStart = -1
    let bestLength = 0
    let runStart = -1
    for (let along = lo; along <= hi; along += 1) {
      const open = along < hi
        && (horizontal ? inRegion(grid, region, along, fixed) : inRegion(grid, region, fixed, along))
      if (open) {
        if (runStart < 0) runStart = along
        continue
      }
      if (runStart >= 0) {
        const length = along - runStart
        if (length > bestLength) {
          bestLength = length
          bestStart = runStart
        }
        runStart = -1
      }
    }
    if (bestLength === 0) continue

    const middle = bestStart + Math.floor(bestLength / 2)
    const x = horizontal ? middle : fixed
    const y = horizontal ? fixed : middle
    const arrive = seamArrivalSpot(grid, x, y, side, region)
    return { x, y, arriveX: arrive.x, arriveY: arrive.y, inset, width: bestLength }
  }
  return null
}

/**
 * Choose a topologically suitable spot to place an outdoor or indoor waypoint.
 *
 * Evaluates candidate clearance (at least 3x3 sub-tiles of clear walkable space)
 * and topological suitability, avoiding map edges and narrow dead-ends.
 *
 * @param grid - the collision map.
 * @param region - when given, only sub-tiles inside it count.
 * @param options - optional clearance and edge margin thresholds.
 * @returns the chosen sub-tile coordinate, or null when the level has no open ground at all.
 */
export function findWaypointSpot(
  grid: LinkGrid,
  region?: WalkableRegion,
  options?: {
    minClearance?: number
    edgeMargin?: number
  },
): { x: number; y: number } | null {
  const W = grid.gridWidth
  const H = grid.gridHeight
  if (W <= 0 || H <= 0) return null

  const centreX = Math.floor(W / 2)
  const centreY = Math.floor(H / 2)

  // Distance transform: calculate clearance (Chebyshev distance to blocked / non-region tile)
  // dist = 1 means 1x1 walkable, dist = 2 means 3x3 walkable, dist = 3 means 5x5 walkable, etc.
  const dist = new Int32Array(W * H)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      dist[y * W + x] = inRegion(grid, region, x, y) ? 999999 : 0
    }
  }

  // Forward pass
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const idx = y * W + x
      if (dist[idx] === 0) continue
      let minVal = dist[idx]
      if (y > 0 && x > 0) minVal = Math.min(minVal, dist[(y - 1) * W + (x - 1)] + 1)
      else minVal = 1
      if (y > 0) minVal = Math.min(minVal, dist[(y - 1) * W + x] + 1)
      else minVal = 1
      if (y > 0 && x < W - 1) minVal = Math.min(minVal, dist[(y - 1) * W + (x + 1)] + 1)
      else minVal = 1
      if (x > 0) minVal = Math.min(minVal, dist[y * W + (x - 1)] + 1)
      else minVal = 1

      dist[idx] = minVal
    }
  }

  // Backward pass
  for (let y = H - 1; y >= 0; y -= 1) {
    for (let x = W - 1; x >= 0; x -= 1) {
      const idx = y * W + x
      if (dist[idx] === 0) continue
      let minVal = dist[idx]
      if (x < W - 1) minVal = Math.min(minVal, dist[y * W + (x + 1)] + 1)
      else minVal = 1
      if (y < H - 1 && x > 0) minVal = Math.min(minVal, dist[(y + 1) * W + (x - 1)] + 1)
      else minVal = 1
      if (y < H - 1) minVal = Math.min(minVal, dist[(y + 1) * W + x] + 1)
      else minVal = 1
      if (y < H - 1 && x < W - 1) minVal = Math.min(minVal, dist[(y + 1) * W + (x + 1)] + 1)
      else minVal = 1

      dist[idx] = minVal
    }
  }

  // Required clearance: default 2 (meaning >= 3x3 clear sub-tiles)
  const reqClearance = options?.minClearance !== undefined
    ? Math.max(1, options.minClearance >= 3 && options.minClearance % 2 === 1 ? Math.floor(options.minClearance / 2) + 1 : options.minClearance)
    : 2

  // Default edge margin: at least 3, up to 15 or 1/8 of level
  const defaultMargin = Math.min(15, Math.max(3, Math.floor(Math.min(W, H) / 8)))
  const edgeMargin = options?.edgeMargin ?? defaultMargin

  // Candidate search: try with edgeMargin first, then relax if no candidates found
  const marginsToTry = [edgeMargin, Math.min(3, edgeMargin), 1]
  const clearancesToTry = [Math.max(reqClearance, 3), reqClearance, 1]

  for (const minC of clearancesToTry) {
    for (const m of marginsToTry) {
      let bestSpot: { x: number; y: number } | null = null
      let bestScore = -Infinity

      for (let y = m; y < H - m; y += 1) {
        for (let x = m; x < W - m; x += 1) {
          const c = dist[y * W + x]!
          if (c < minC) continue

          // Topological suitability score: prioritize higher clearance, penalize distance to map center
          const distToCenter = Math.hypot(x - centreX, y - centreY)
          const score = c * 1000 - distToCenter

          if (score > bestScore) {
            bestScore = score
            bestSpot = { x, y }
          }
        }
      }

      if (bestSpot !== null) {
        return bestSpot
      }
    }
  }

  return nearestWalkable(grid, centreX, centreY, Math.max(W, H), region)
}

/** Cell width in screen pixels (the isometric diamond's width). */
const ORTHO_CELL_WIDTH = 80
/** Cell height in screen pixels (half the diamond's width: a 2:1 projection). */
const ORTHO_CELL_HEIGHT = 40

export interface IsoSpawnOptions {
  /** Optional warps to prioritize for spawn placement (e.g. entrance warps). */
  readonly warps?: readonly (SceneWarp | { readonly x: number; readonly y: number; readonly arriveX?: number; readonly arriveY?: number; readonly direction?: string })[] | undefined
  /** Optional entrances to prioritize. */
  readonly entrances?: readonly (SceneEntrance | { readonly x: number; readonly y: number; readonly arriveX?: number; readonly arriveY?: number })[] | undefined
  /** Optional list of floor placements if not present on scene. */
  readonly floors?: readonly { readonly cellX: number; readonly cellY: number }[] | undefined
}

export interface IsoSpawnTarget {
  readonly cellsX: number
  readonly cellsY: number
  readonly blocked: Uint8Array
  readonly gridWidth?: number
  readonly gridHeight?: number
  readonly originX?: number
  readonly originY?: number
  readonly collisionMasks?: Uint16Array | undefined
  readonly floors?: readonly { readonly cellX: number; readonly cellY: number }[] | undefined
  readonly warps?: readonly (SceneWarp | { readonly x: number; readonly y: number; readonly arriveX?: number; readonly arriveY?: number; readonly direction?: string })[] | undefined
  readonly entrances?: readonly (SceneEntrance | { readonly x: number; readonly y: number; readonly arriveX?: number; readonly arriveY?: number })[] | undefined
}

function subTileAtCoords(
  originX: number,
  originY: number,
  cellsX: number,
  cellsY: number,
  x: number,
  y: number,
): { subX: number; subY: number; inBounds: boolean } {
  const px = x - originX
  const py = y - originY
  const cx = (px / ORTHO_CELL_WIDTH + py / ORTHO_CELL_HEIGHT) / 2
  const cy = (py / ORTHO_CELL_HEIGHT - px / ORTHO_CELL_WIDTH) / 2
  const cellX = Math.floor(cx)
  const cellY = Math.floor(cy)
  const inBounds = cellX >= 0 && cellY >= 0 && cellX < cellsX && cellY < cellsY
  const localSubX = Math.min(Math.max(0, Math.floor((cx - cellX) * SUB_TILES_PER_TILE)), SUB_TILES_PER_TILE - 1)
  const localSubY = Math.min(Math.max(0, Math.floor((cy - cellY) * SUB_TILES_PER_TILE)), SUB_TILES_PER_TILE - 1)
  const subX = cellX * SUB_TILES_PER_TILE + localSubX
  const subY = cellY * SUB_TILES_PER_TILE + localSubY
  return { subX, subY, inBounds }
}

function cellCentreCoords(originX: number, originY: number, cellX: number, cellY: number): { x: number; y: number } {
  return {
    x: (cellX - cellY) * ORTHO_CELL_WIDTH + originX,
    y: (cellX + cellY) * ORTHO_CELL_HEIGHT + originY + ORTHO_CELL_HEIGHT / 2,
  }
}

function subTileCentreCoords(
  originX: number,
  originY: number,
  subX: number,
  subY: number,
): { x: number; y: number } {
  const cx = (subX + 0.5) / SUB_TILES_PER_TILE
  const cy = (subY + 0.5) / SUB_TILES_PER_TILE
  return {
    x: (cx - cy) * ORTHO_CELL_WIDTH + originX,
    y: (cx + cy) * ORTHO_CELL_HEIGHT + originY,
  }
}

/**
 * Find the largest connected walkable region that contains at least one floor tile.
 *
 * @param grid - the collision map.
 * @param hasFloor - whether a cell coordinate contains a valid floor.
 * @returns one byte per sub-tile, 1 inside the largest floor-containing region.
 */
export function largestWalkableRegionWithFloors(
  grid: LinkGrid,
  hasFloor?: (cellX: number, cellY: number) => boolean,
): WalkableRegion {
  const width = grid.gridWidth
  const height = grid.gridHeight
  const component = new Int32Array(width * height).fill(-1)
  const sizes: number[] = []
  const containsFloor: boolean[] = []
  const stack: number[] = []

  for (let seed = 0; seed < component.length; seed += 1) {
    if (component[seed] !== -1 || grid.blocked[seed] !== 0) continue
    const label = sizes.length
    let size = 0
    let floorFound = false
    component[seed] = label
    stack.push(seed)
    while (stack.length > 0) {
      const here = stack.pop()!
      size += 1
      const x = here % width
      const y = Math.floor(here / width)
      const cx = Math.floor(x / SUB_TILES_PER_TILE)
      const cy = Math.floor(y / SUB_TILES_PER_TILE)
      if (hasFloor === undefined || hasFloor(cx, cy)) {
        floorFound = true
      }
      if (x > 0) { const n = here - 1; if (component[n] === -1 && grid.blocked[n] === 0) { component[n] = label; stack.push(n) } }
      if (x < width - 1) { const n = here + 1; if (component[n] === -1 && grid.blocked[n] === 0) { component[n] = label; stack.push(n) } }
      if (y > 0) { const n = here - width; if (component[n] === -1 && grid.blocked[n] === 0) { component[n] = label; stack.push(n) } }
      if (y < height - 1) { const n = here + width; if (component[n] === -1 && grid.blocked[n] === 0) { component[n] = label; stack.push(n) } }
    }
    sizes.push(size)
    containsFloor.push(floorFound)
  }

  let best = -1
  let bestSize = 0
  for (let label = 0; label < sizes.length; label += 1) {
    if (containsFloor[label] && sizes[label]! > bestSize) {
      bestSize = sizes[label]!
      best = label
    }
  }
  if (best < 0) {
    for (let label = 0; label < sizes.length; label += 1) {
      if (sizes[label]! > bestSize) {
        bestSize = sizes[label]!
        best = label
      }
    }
  }

  const region = new Uint8Array(component.length)
  if (best < 0) return region
  for (let at = 0; at < component.length; at += 1) {
    if (component[at] === best) region[at] = 1
  }
  return region
}

/**
 * Find a valid, walkable spawn point on a floor tile.
 *
 * Ensures:
 * 1. The spawn is located on a valid floor tile and blocked === 0.
 * 2. If available, prioritizes entrance warps / entrances.
 * 3. Falls back to the largest walkable region that contains floors,
 *    avoiding pure void cells even when canvas center is void.
 *
 * @param scene - the scene or collision grid.
 * @param options - optional warps, entrances, or floor placements.
 * @returns a scene-space point in pixels, or null when nothing is walkable.
 */
export function findIsoSpawn(
  scene: IsoSpawnTarget | { readonly width: number; readonly height: number; readonly collisionMask: Uint16Array; readonly rooms?: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[] },
  options?: IsoSpawnOptions,
): { x: number; y: number } | null {
  if (!('cellsX' in scene)) {
    const w = scene.width
    const h = scene.height
    const cm = scene.collisionMask
    const isWalkable = (gx: number, gy: number): boolean => {
      if (gx < 0 || gy < 0 || gx >= w || gy >= h) return false
      return (cm[gy * w + gx]! & 0x3c8f) === 0
    }
    const blocked = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) {
      blocked[i] = (cm[i]! & 0x3c8f) !== 0 ? 1 : 0
    }
    const directGrid: LinkGrid = {
      cellsX: w,
      cellsY: h,
      gridWidth: w,
      gridHeight: h,
      blocked,
    }
    const region = largestWalkableRegionWithFloors(directGrid)
    let count = 0
    let sx = 0
    let sy = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (region[y * w + x] === 1) {
          count++
          sx += x
          sy += y
        }
      }
    }
    if (count === 0) return null
    const cx = Math.round(sx / count)
    const cy = Math.round(sy / count)
    if (isWalkable(cx, cy) && region[cy * w + cx] === 1) {
      return { x: cx, y: cy }
    }
    const maxR = Math.max(w, h)
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const nx = cx + dx
          const ny = cy + dy
          if (isWalkable(nx, ny) && region[ny * w + nx] === 1) {
            return { x: nx, y: ny }
          }
        }
      }
    }
    return null
  }
  const cellsX = scene.cellsX
  const cellsY = scene.cellsY
  const gridWidth = scene.gridWidth ?? cellsX * SUB_TILES_PER_TILE
  const gridHeight = scene.gridHeight
    ?? (scene.blocked.length ? Math.floor(scene.blocked.length / gridWidth) : cellsY * SUB_TILES_PER_TILE)
  const originX = scene.originX ?? 0
  const originY = scene.originY ?? 0

  const floors = options?.floors ?? scene.floors
  let hasFloorCell: (cx: number, cy: number) => boolean
  if (floors !== undefined && floors.length > 0) {
    const floorSet = new Set<string>()
    for (const f of floors) {
      floorSet.add(`${f.cellX},${f.cellY}`)
    }
    hasFloorCell = (cx, cy) => floorSet.has(`${cx},${cy}`)
  } else {
    hasFloorCell = (cx, cy) => {
      if (cx < 0 || cy < 0 || cx >= cellsX || cy >= cellsY) return false
      for (let sy = 0; sy < SUB_TILES_PER_TILE; sy += 1) {
        for (let sx = 0; sx < SUB_TILES_PER_TILE; sx += 1) {
          const gx = cx * SUB_TILES_PER_TILE + sx
          const gy = cy * SUB_TILES_PER_TILE + sy
          const idx = gy * gridWidth + gx
          if (scene.blocked[idx] === 0) {
            if (scene.collisionMasks && (scene.collisionMasks[idx]! & 0x0020) !== 0) {
              continue
            }
            return true
          }
        }
      }
      return false
    }
  }

  const linkGrid: LinkGrid = {
    cellsX,
    cellsY,
    gridWidth,
    gridHeight,
    blocked: scene.blocked,
  }

  const isSubTileWalkable = (sx: number, sy: number): boolean => {
    if (sx < 0 || sy < 0 || sx >= gridWidth || sy >= gridHeight) return false
    return scene.blocked[sy * gridWidth + sx] === 0
  }

  // 1. Prioritize entrance warps or entrances if available.
  const warps = options?.warps ?? scene.warps
  if (warps !== undefined && warps.length > 0) {
    const sortedWarps = [...warps].sort((a, b) => {
      const dirScore = (w: any) =>
        w.direction === 'in' ? 4 : w.direction === 'up' ? 3 : w.direction === 'down' ? 2 : 1
      return dirScore(b) - dirScore(a)
    })
    for (const warp of sortedWarps) {
      const ax = ('arriveX' in warp && typeof warp.arriveX === 'number') ? warp.arriveX : warp.x
      const ay = ('arriveY' in warp && typeof warp.arriveY === 'number') ? warp.arriveY : warp.y
      const cx = Math.floor(ax / SUB_TILES_PER_TILE)
      const cy = Math.floor(ay / SUB_TILES_PER_TILE)
      if (hasFloorCell(cx, cy)) {
        const pt = subTileCentreCoords(originX, originY, ax, ay)
        const sub = subTileAtCoords(originX, originY, cellsX, cellsY, pt.x, pt.y)
        if (sub.inBounds && isSubTileWalkable(sub.subX, sub.subY)) {
          return pt
        }
        const near = nearestWalkable(linkGrid, ax, ay, 5)
        if (near !== null) {
          const ncx = Math.floor(near.x / SUB_TILES_PER_TILE)
          const ncy = Math.floor(near.y / SUB_TILES_PER_TILE)
          if (hasFloorCell(ncx, ncy)) {
            const npt = subTileCentreCoords(originX, originY, near.x, near.y)
            const nsub = subTileAtCoords(originX, originY, cellsX, cellsY, npt.x, npt.y)
            if (nsub.inBounds && isSubTileWalkable(nsub.subX, nsub.subY)) {
              return npt
            }
          }
        }
      }
    }
  }

  const entrances = options?.entrances ?? scene.entrances
  if (entrances !== undefined && entrances.length > 0) {
    for (const ent of entrances) {
      const ax = ('arriveX' in ent && typeof ent.arriveX === 'number') ? ent.arriveX : ent.x
      const ay = ('arriveY' in ent && typeof ent.arriveY === 'number') ? ent.arriveY : ent.y
      const cx = Math.floor(ax / SUB_TILES_PER_TILE)
      const cy = Math.floor(ay / SUB_TILES_PER_TILE)
      if (hasFloorCell(cx, cy)) {
        const pt = subTileCentreCoords(originX, originY, ax, ay)
        const sub = subTileAtCoords(originX, originY, cellsX, cellsY, pt.x, pt.y)
        if (sub.inBounds && isSubTileWalkable(sub.subX, sub.subY)) {
          return pt
        }
      }
    }
  }

  // 2. Locate within the largest walkable region containing floors.
  const region = largestWalkableRegionWithFloors(linkGrid, hasFloorCell)
  let regionCount = 0
  let sumX = 0
  let sumY = 0
  for (let sy = 0; sy < gridHeight; sy += 1) {
    for (let sx = 0; sx < gridWidth; sx += 1) {
      if (region[sy * gridWidth + sx] === 1) {
        regionCount += 1
        sumX += sx
        sumY += sy
      }
    }
  }

  const centreX =
    regionCount > 0 ? Math.round(sumX / regionCount / SUB_TILES_PER_TILE) : Math.floor(cellsX / 2)
  const centreY =
    regionCount > 0 ? Math.round(sumY / regionCount / SUB_TILES_PER_TILE) : Math.floor(cellsY / 2)

  const maxRadius = Math.max(cellsX, cellsY)
  for (let radius = 0; radius < maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
        const cellX = centreX + dx
        const cellY = centreY + dy
        if (cellX < 0 || cellY < 0 || cellX >= cellsX || cellY >= cellsY) continue
        if (!hasFloorCell(cellX, cellY)) continue

        // Check centre of the cell
        const pt = cellCentreCoords(originX, originY, cellX, cellY)
        const sub = subTileAtCoords(originX, originY, cellsX, cellsY, pt.x, pt.y)
        if (sub.inBounds && isSubTileWalkable(sub.subX, sub.subY) && (regionCount === 0 || region[sub.subY * gridWidth + sub.subX] === 1)) {
          return pt
        }

        // If centre sub-tile was blocked, check other sub-tiles in this cell
        for (let lsy = 0; lsy < SUB_TILES_PER_TILE; lsy += 1) {
          for (let lsx = 0; lsx < SUB_TILES_PER_TILE; lsx += 1) {
            const sx = cellX * SUB_TILES_PER_TILE + lsx
            const sy = cellY * SUB_TILES_PER_TILE + lsy
            if (isSubTileWalkable(sx, sy) && (regionCount === 0 || region[sy * gridWidth + sx] === 1)) {
              const spt = subTileCentreCoords(originX, originY, sx, sy)
              const ssub = subTileAtCoords(originX, originY, cellsX, cellsY, spt.x, spt.y)
              if (ssub.inBounds && isSubTileWalkable(ssub.subX, ssub.subY)) {
                return spt
              }
            }
          }
        }
      }
    }
  }

  return null
}

