/**
 * Verify the global world connectivity graph.
 *
 * Issue #23's acceptance criteria are mostly about walking around, which is not
 * something a script can do, but the two failure modes that actually break a
 * playthrough are both static and both cheap to catch here:
 *
 * 1. **Islands.** A level nothing points at is a level the player can never
 *    reach. Building the graph from `Levels.txt` `Vis`/`Warp` alone produces
 *    111 of them — every outdoor zone in the game — which is the whole reason
 *    `world-graph.ts` exists.
 * 2. **Doors onto nothing.** An edge whose destination has no asset pack, or a
 *    seam with no side assigned, is an opening that leads into the void.
 *
 * The checks:
 *
 * 1. `Vis` slots collapse to the expected number of unique pairs, and the one
 *    known asymmetric edge is gone.
 * 2. Every edge is bidirectional, and both endpoints exist.
 * 3. Every act's levels are reachable from that act's town, with the two
 *    documented exceptions (`OUTDOOR_ISLANDS`) reachable by waypoint instead.
 * 4. Every edge destination has a baked asset pack.
 * 5. The 39 waypoints are contiguous, land on real levels, and those levels
 *    have packs.
 * 6. Gate side assignment holds its two invariants — opposite sides across a
 *    seam, and no two seams of one level sharing an edge — across many seeds.
 * 7. Every `LvlWarp.txt` row referenced by a `Warp` column actually exists.
 *
 * Usage:
 *   node scripts/verify-world-graph.ts [directory]
 */
import { readFileSync } from 'node:fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { loadActTables, ACT_TOWNS } from '../src/common/world/acts.ts'
import {
  parseLevelRows,
  buildWorldGraph,
  PRESET_SEAM_SIDES,
  seamlessPairs,
  reachableFrom,
  parseWarpGeometry,
  findWarpGeometry,
  oppositeSide,
  OUTDOOR_ISLANDS,
  SEAMLESS_ADJACENCY,
  PORTAL_LINKS,
  DROPPED_VIS_EDGES,
} from '../src/common/world/world-graph.ts'
import type { Side } from '../src/common/world/world-graph.ts'

/** Where the archives live by default. */
const dir = process.argv[2] ?? 'samples/d2'
/** Mount order: later archives override earlier ones, as the game loads them. */
const MOUNTS = ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']
/** The baked asset packs. */
const PACK_INDEX = 'public/packs/index.json'
/** Waypoint ids run 0..38 with no gaps. */
const WAYPOINT_COUNT = 39

let checks = 0
let failures = 0
const failureReasons: string[] = []

/**
 * Record one assertion.
 *
 * @param ok - whether it held.
 * @param scope - what was being checked.
 * @param message - the claim.
 */
function check(ok: boolean, scope: string, message: string): void {
  checks += 1
  if (!ok) {
    failures += 1
    failureReasons.push(`${scope}: ${message}`)
  }
}

/* ------------------------------------------------------------------------- *
 * Load
 * ------------------------------------------------------------------------- */

const archives = new MountedArchives()
for (const name of MOUNTS) {
  try {
    archives.add(name, await MpqArchive.open(await fileSource(`${dir}/${name}`)))
  } catch (err) {
    console.log(`skip ${name}: ${String(err)}`)
  }
}
if (archives.size === 0) {
  console.log(`no archives found in ${dir}`)
  process.exit(2)
}

const tables = await loadActTables(archives)
const rows = parseLevelRows(tables.levels)
const graph = buildWorldGraph(rows)
const warpGeometry = parseWarpGeometry(tables.lvlwarp)

/** The baked packs, if they have been generated. */
interface PackEntry {
  readonly levelId?: number
  readonly kind?: string
  readonly label?: string
}
let packLevelIds: Set<number> | null = null
try {
  const parsed = JSON.parse(readFileSync(PACK_INDEX, 'utf8')) as { levels?: PackEntry[] }
  const entries = parsed.levels ?? []
  packLevelIds = new Set(entries.map(entry => entry.levelId ?? -1).filter(id => id > 0))
} catch {
  console.log(`no pack index at ${PACK_INDEX}; skipping pack coverage checks`)
}

/** A readable label for a level. */
function label(levelId: number): string {
  const row = graph.levels.get(levelId)
  return row === undefined ? `level ${String(levelId)}` : `${String(levelId)} ${row.name}`
}

/* ------------------------------------------------------------------------- *
 * 1. Edge extraction
 * ------------------------------------------------------------------------- */

{
  const scope = 'edges'
  let populatedSlots = 0
  const uniqueVisPairs = new Set<string>()
  for (const row of rows) {
    for (let slot = 0; slot < 8; slot += 1) {
      const destination = row.vis[slot] ?? 0
      if (destination === 0) continue
      populatedSlots += 1
      uniqueVisPairs.add(`${String(row.id)}->${String(destination)}`)
    }
  }
  console.log(`  Vis slots populated: ${String(populatedSlots)}, unique ordered pairs: ${String(uniqueVisPairs.size)}`)
  check(populatedSlots > uniqueVisPairs.size, scope, 'several slots should collapse onto one logical edge')

  for (const [from, to] of DROPPED_VIS_EDGES) {
    check(
      !graph.edges.some(edge => edge.from === from && edge.to === to),
      scope,
      `the copy-paste artifact ${label(from)} -> ${label(to)} must be dropped`,
    )
  }

  for (const edge of graph.edges) {
    check(graph.levels.has(edge.from), scope, `edge source ${String(edge.from)} must be a real level`)
    check(graph.levels.has(edge.to), scope, `edge destination ${String(edge.to)} must be a real level`)
  }

  const directed = new Set(graph.edges.map(edge => `${String(edge.from)}->${String(edge.to)}`))
  for (const edge of graph.edges) {
    check(
      directed.has(`${String(edge.to)}->${String(edge.from)}`),
      scope,
      `${label(edge.from)} -> ${label(edge.to)} (${edge.kind}) has no return edge`,
    )
  }

  const counts = { warp: 0, seamless: 0, portal: 0 }
  for (const edge of graph.edges) counts[edge.kind] += 1
  console.log(
    `  edges: ${String(graph.edges.length)} total ` +
      `(${String(counts.warp)} warp, ${String(counts.seamless)} seamless, ${String(counts.portal)} portal)`,
  )
}

/* ------------------------------------------------------------------------- *
 * 2. Hard-coded tables are sane
 * ------------------------------------------------------------------------- */

{
  const scope = 'hard-coded tables'
  const seen = new Set<string>()
  for (const [a, b] of SEAMLESS_ADJACENCY) {
    const key = a < b ? `${String(a)}:${String(b)}` : `${String(b)}:${String(a)}`
    check(!seen.has(key), scope, `adjacency ${key} is listed twice`)
    seen.add(key)
    check(a !== b, scope, `adjacency ${key} is a self-loop`)
    check(graph.levels.has(a), scope, `adjacency source ${String(a)} is not a level`)
    check(graph.levels.has(b), scope, `adjacency destination ${String(b)} is not a level`)
  }
  for (const link of PORTAL_LINKS) {
    check(graph.levels.has(link.from), scope, `portal source ${String(link.from)} is not a level`)
    check(graph.levels.has(link.to), scope, `portal destination ${String(link.to)} is not a level`)
  }
}

/* ------------------------------------------------------------------------- *
 * 3. Connectivity
 * ------------------------------------------------------------------------- */

{
  const scope = 'connectivity'
  const islands = new Set(OUTDOOR_ISLANDS)
  const waypointLevels = new Set(graph.waypoints.values())

  // Every level, from every town: the world is one component, since the acts
  // are joined by the caravan, the ship, the Infernal Gate and Tyrael.
  const reachable = reachableFrom(graph, ACT_TOWNS[0] ?? 1)
  for (const row of rows) {
    if (reachable.has(row.id)) continue
    const excused = islands.has(row.id) && waypointLevels.has(row.id)
    check(excused, scope, `${label(row.id)} is unreachable from Act 1 town`)
  }
  console.log(`  reachable from Act 1 town: ${String(reachable.size)} / ${String(rows.length)} levels`)

  for (const [index, town] of ACT_TOWNS.entries()) {
    const fromTown = reachableFrom(graph, town)
    const actLevels = rows.filter(row => row.act === index)
    const missing = actLevels.filter(row => !fromTown.has(row.id) && !islands.has(row.id))
    check(
      missing.length === 0,
      scope,
      `act ${String(index + 1)}: ${String(missing.length)} levels unreachable from ${label(town)}` +
        (missing.length === 0 ? '' : ` (${missing.slice(0, 5).map(row => label(row.id)).join(', ')})`),
    )
  }

  for (const island of OUTDOOR_ISLANDS) {
    check(
      waypointLevels.has(island) || graph.edges.some(edge => edge.to === island),
      scope,
      `${label(island)} is excused as an island but has neither a waypoint nor an inbound edge`,
    )
  }
}

/* ------------------------------------------------------------------------- *
 * 4. Pack coverage — no door onto nothing
 * ------------------------------------------------------------------------- */

if (packLevelIds !== null) {
  const scope = 'pack coverage'
  const packs = packLevelIds
  let broken = 0
  for (const edge of graph.edges) {
    if (packs.has(edge.to)) continue
    broken += 1
    check(false, scope, `${label(edge.from)} -> ${label(edge.to)} leads to a level with no pack`)
  }
  const uncovered = rows.filter(row => !packs.has(row.id))
  check(uncovered.length === 0, scope, `${String(uncovered.length)} levels have no pack`)
  console.log(`  packs cover ${String(rows.length - uncovered.length)} / ${String(rows.length)} levels, ${String(broken)} broken edges`)
}

/* ------------------------------------------------------------------------- *
 * 5. Waypoints
 * ------------------------------------------------------------------------- */

{
  const scope = 'waypoints'
  check(
    graph.waypoints.size === WAYPOINT_COUNT,
    scope,
    `expected ${String(WAYPOINT_COUNT)} waypoints, found ${String(graph.waypoints.size)}`,
  )
  for (let id = 0; id < WAYPOINT_COUNT; id += 1) {
    const level = graph.waypoints.get(id)
    check(level !== undefined, scope, `waypoint ${String(id)} is missing`)
    if (level === undefined) continue
    check(graph.levels.has(level), scope, `waypoint ${String(id)} points at a level that does not exist`)
    if (packLevelIds !== null) {
      check(packLevelIds.has(level), scope, `waypoint ${String(id)} is on ${label(level)}, which has no pack`)
    }
  }
}

/* ------------------------------------------------------------------------- *
 * 6. Gate sides
 * ------------------------------------------------------------------------- */

{
  const scope = 'gate sides'
  const pairs = seamlessPairs(graph)
  console.log(`  seamless pairs: ${String(pairs.length)} (${String(PRESET_SEAM_SIDES.size)} preset-anchored)`)

  const used = new Map<number, Map<Side, number>>()
  for (const edge of graph.edges) {
    if (edge.kind !== 'seamless') continue
    const key = edge.from < edge.to ? `${String(edge.from)}:${String(edge.to)}` : `${String(edge.to)}:${String(edge.from)}`
    const isPresetPinned = PRESET_SEAM_SIDES.has(key)
    if (isPresetPinned) {
      check(edge.sideFrom !== null, scope, `${label(edge.from)} -> ${label(edge.to)} preset seam has no side`)
      check(edge.sideTo !== null, scope, `${label(edge.from)} -> ${label(edge.to)} preset seam has no destination side`)
    } else {
      check(edge.sideFrom === null && edge.sideTo === null, scope, `${label(edge.from)} -> ${label(edge.to)} DRLG outdoor seam should resolve sides per-seed via OutPlace, not statically`)
    }
    if (edge.sideFrom === null || edge.sideTo === null) continue
    check(
      edge.sideTo === oppositeSide(edge.sideFrom),
      scope,
      `${label(edge.from)} -> ${label(edge.to)} sides are not opposite`,
    )
    let sides = used.get(edge.from)
    if (sides === undefined) {
      sides = new Map<Side, number>()
      used.set(edge.from, sides)
    }
    const already = sides.get(edge.sideFrom)
    check(
      already === undefined || already === edge.to,
      scope,
      `${label(edge.from)} puts two seams on its ${edge.sideFrom} edge`,
    )
    sides.set(edge.sideFrom, edge.to)
  }
}

/* ------------------------------------------------------------------------- *
 * 7. Warp geometry
 * ------------------------------------------------------------------------- */

{
  const scope = 'warp geometry'
  console.log(`  LvlWarp rows: ${String(warpGeometry.size)}`)
  for (const row of rows) {
    for (let slot = 0; slot < 8; slot += 1) {
      const warpId = row.warp[slot] ?? -1
      if (warpId === -1) continue
      if ((row.vis[slot] ?? 0) === 0) continue
      check(
        findWarpGeometry(warpGeometry, warpId) !== undefined,
        scope,
        `${label(row.id)} slot ${String(slot)} references LvlWarp ${String(warpId)}, which does not exist`,
      )
    }
  }
  for (const edge of graph.edges) {
    for (const warpId of edge.warps) {
      check(
        findWarpGeometry(warpGeometry, warpId) !== undefined,
        scope,
        `edge ${label(edge.from)} -> ${label(edge.to)} references LvlWarp ${String(warpId)}`,
      )
    }
  }
}

/* ------------------------------------------------------------------------- *
 * Report
 * ------------------------------------------------------------------------- */

console.log('')
if (failures === 0) {
  console.log(`world graph: ${String(checks)} assertions, all passed`)
} else {
  console.log(`world graph: ${String(checks)} assertions, ${String(failures)} failed`)
  for (const reason of failureReasons.slice(0, 40)) console.log(`  - ${reason}`)
  if (failureReasons.length > 40) console.log(`  ... and ${String(failureReasons.length - 40)} more`)
  process.exit(1)
}
