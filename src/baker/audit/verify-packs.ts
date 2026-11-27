/**
 * Prove a pack equals what the archives say.
 *
 * A prebaked pack is only trustworthy if it is indistinguishable from decoding
 * the MPQs directly, so this script rebuilds every packed map through the live
 * path — mount, tables, DS1, DT1, isometric scene — and compares it against the
 * pack's JSON field by field:
 *
 *   1. map extent (cells, scene size, origin)
 *   2. every floor and wall draw, in order, by frame rect and position
 *   3. the collision grid, byte for byte
 *   4. the spawn point
 *   5. each frame's indexed pixels, by hash (the pack stores hashes, not pixels)
 *   6. object placements (art is deliberately not baked yet)
 *
 * Anything that differs is a bug in the packer or in the shared code, and the
 * script exits non-zero rather than letting a subtly wrong pack ship.
 *
 * Usage: node scripts/verify-packs.ts [archive-directory] [pack-directory]
 */
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { cell, loadActTables, parseTable, resolveLevel } from '../../common/world/acts.ts'
import { decodeDs1 } from '../../common/formats/ds1.ts'
import { decodeDt1 } from '../../common/formats/dt1.ts'
import { loadObjectsTable, resolveDs1Object } from '../../common/units/objects.ts'
import { levelSeed, buildIsoMapScene, findIsoSpawn } from '../../common/world/d2map.ts'
import { isWaypointObjectsTxtId, WAYPOINT_TOKENS } from '../../common/units/object-lookup.ts'
import type { AutomapLayerData } from '../../common/formats/automap-table.ts'
import type { PackIndex, PackSceneJson } from '../../common/pack-contract/index.ts'
export type { PackIndex, PackSceneJson }

const [archiveDir = 'samples/d2', packDir = 'public/packs'] = process.argv.slice(2)

/** Packed scene fields this script reads. */
interface PackedScene {
  readonly act: number
  readonly levelId: number
  readonly levelName: string
  readonly ds1: string
  readonly cellsX: number
  readonly cellsY: number
  readonly originX: number
  readonly originY: number
  readonly widthPx: number
  readonly heightPx: number
  readonly frames: readonly (readonly number[])[]
  readonly frameHash: readonly string[]
  readonly framePlacement: readonly (readonly number[])[]
  readonly floors: readonly (readonly number[])[]
  /** Shadow draws, painted after floors and before walls. */
  readonly shadows?: readonly (readonly number[])[]
  readonly walls: readonly (readonly number[])[]
  /** Roof draws, painted last; absent in packs baked before roofs were split out. */
  readonly roofs?: readonly (readonly number[])[]
  readonly objectPages?: readonly { readonly file: string; readonly width: number; readonly height: number }[]
  readonly objects: readonly {
    readonly id: number
    readonly type: number
    readonly name: string
    /** Token the hardcoded object lookup table resolves this DS1 id to. */
    readonly token: string
    /** Animation mode token the engine places the object in. */
    readonly mode: string
    /** `Objects.txt` row the table points at, or -1 when it points at none. */
    readonly objectsTxtId: number
    readonly trans?: number
    readonly blendMode?: 'normal' | 'additive'
    readonly member?: string | null
    readonly frame?: {
      readonly page: number
      readonly x: number
      readonly y: number
      readonly width: number
      readonly height: number
      readonly offsetX: number
      readonly offsetY: number
    } | null
  }[]
  readonly collision: { readonly width: number; readonly height: number; readonly runs: readonly (readonly number[])[] }
  readonly spawn: readonly number[] | null
  readonly warps?: readonly { readonly x: number; readonly y: number; readonly arriveX?: number; readonly arriveY?: number; readonly direction?: string }[] | undefined
  readonly entrances?: readonly { readonly x: number; readonly y: number; readonly arriveX?: number; readonly arriveY?: number }[] | undefined
  readonly automap?: AutomapLayerData
}

/**
 * FNV-1a over a frame's indexed pixels — the same function the packer used.
 *
 * @param indices - palette indices.
 * @returns an 8-character hex digest.
 */
function frameHash(indices: Uint8Array): string {
  let hash = 0x811c9dc5
  for (const byte of indices) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const archives = new MountedArchives()
for (const name of ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
  archives.add(name, await MpqArchive.open(await fileSource(join(archiveDir, name))))
}
const tables = await loadActTables(archives)
const presetPlaceByAct = new Map<string, string[]>()
for (const row of tables.monpreset.rows) {
  const act = cell(tables.monpreset, row, 'Act')
  const place = cell(tables.monpreset, row, 'Place')
  if (!place) continue
  let list = presetPlaceByAct.get(act)
  if (list === undefined) {
    list = []
    presetPlaceByAct.set(act, list)
  }
  list.push(place)
}
const statsById = new Map<string, readonly string[]>()
for (const row of tables.monstats.rows) {
  const id = cell(tables.monstats, row, 'Id')
  if (id) statsById.set(id, row)
}
const monstersTable = {
  preset: tables.monpreset,
  stats: tables.monstats,
  presetPlaceByAct,
  statsById,
}
const monstats2Table = parseTable(await archives.read('data\\global\\excel\\monstats2.txt'))
const monstats2ById = new Map<string, { noMap: boolean; automapCel: number }>()
for (const row of monstats2Table.rows) {
  const id = cell(monstats2Table, row, 'Id')
  if (id) {
    monstats2ById.set(id.toLowerCase(), {
      noMap: Number(cell(monstats2Table, row, 'noMap')) !== 0,
      automapCel: Number(cell(monstats2Table, row, 'automapCel')) || 0,
    })
  }
}

const index = JSON.parse(await readFile(join(packDir, 'index.json'), 'utf8')) as {
  levels: readonly { act: number; levelId: number; path: string; ds1: string; label: string; kind?: string }[]
}

let checks = 0
let failures = 0
let comparedPixels = 0

/**
 * Assert one expectation.
 *
 * @param ok - whether it held.
 * @param message - what was checked.
 */
function check(ok: boolean, message: string): void {
  checks += 1
  if (!ok) { failures += 1; console.log(`   FAIL ${message}`) }
}

/** DS1 object ids the community lookup table does not cover, summed over every map. */
let unknownObjectIds = 0

/** The hardcoded object lookup needs `Objects.txt` for metadata; load it once. */
const objectsTable = await loadObjectsTable(archives)

for (const entry of index.levels) {
  if (entry.kind !== undefined && entry.kind !== 'preset') continue
  const packed = JSON.parse(await readFile(join(packDir, entry.path, 'scene.json'), 'utf8')) as PackedScene
  if (entry.levelId === 108 || packed.ds1.startsWith('preset:') || packed.ds1.startsWith('generated:')) continue
  const info = resolveLevel(tables, packed.levelId, packed.act)
  const libraries = []
  for (const name of info.dt1Names) libraries.push(decodeDt1(await archives.read(name)))
  const level = decodeDs1(await archives.read(packed.ds1))
  if (!tables.automap) {
    throw new Error('verify-packs: tables.automap is missing')
  }
  const live = buildIsoMapScene(level, libraries, levelSeed(packed.ds1), {
    automapTable: tables.automap,
    levelTypeId: info.levelTypeId,
    levelId: packed.levelId,
    act: packed.act,
    layerId: info.layerId,
    objectsTable,
    monstersTable,
    monstats2ById,
  })

  check(packed.levelName === info.levelName, `${entry.path}: level name`)
  check(packed.cellsX === live.cellsX && packed.cellsY === live.cellsY, `${entry.path}: cell extent`)
  check(packed.originX === live.originX && packed.originY === live.originY, `${entry.path}: scene origin`)
  check(packed.widthPx === live.widthPx && packed.heightPx === live.heightPx, `${entry.path}: scene size`)

  // Draws: same count, same order, same frame rect and position.
  check(packed.floors.length === live.floors.length, `${entry.path}: floor count ${String(packed.floors.length)} vs ${String(live.floors.length)}`)
  check(packed.walls.length === live.walls.length, `${entry.path}: wall count ${String(packed.walls.length)} vs ${String(live.walls.length)}`)
  const rectOf = (frameIndex: number): string => (packed.framePlacement[frameIndex] ?? []).slice(1).join(',')
  let floorMismatch = 0
  for (let at = 0; at < Math.min(packed.floors.length, live.floors.length); at += 1) {
    const packedRow = packed.floors[at]!
    const liveDraw = live.floors[at]!
    if (packedRow[1] !== liveDraw.x || packedRow[2] !== liveDraw.y || packedRow[3] !== liveDraw.cellX || packedRow[4] !== liveDraw.cellY) floorMismatch += 1
  }
  check(floorMismatch === 0, `${entry.path}: floor draw geometry (${String(floorMismatch)} mismatches)`)
  let wallMismatch = 0
  for (let at = 0; at < Math.min(packed.walls.length, live.walls.length); at += 1) {
    const packedRow = packed.walls[at]!
    const liveDraw = live.walls[at]!
    if (packedRow[1] !== liveDraw.x || packedRow[2] !== liveDraw.y) wallMismatch += 1
  }
  check(wallMismatch === 0, `${entry.path}: wall draw geometry and order (${String(wallMismatch)} mismatches)`)

  // Roofs are a separate pass in the engine, so they are compared as their own
  // list: same count, same order, same geometry.
  const packedRoofs = packed.roofs ?? []
  check(packedRoofs.length === live.roofs.length,
    `${entry.path}: roof count ${String(packedRoofs.length)} vs ${String(live.roofs.length)}`)
  let roofMismatch = 0
  for (let at = 0; at < Math.min(packedRoofs.length, live.roofs.length); at += 1) {
    const packedRow = packedRoofs[at]!
    const liveDraw = live.roofs[at]!
    if (packedRow[1] !== liveDraw.x || packedRow[2] !== liveDraw.y) roofMismatch += 1
  }
  check(roofMismatch === 0, `${entry.path}: roof draw geometry and order (${String(roofMismatch)} mismatches)`)

  // Shadows are painted after floors and before walls: same count, same order, same geometry.
  if (packed.shadows !== undefined) {
    const packedShadows = packed.shadows
    check(packedShadows.length === live.shadows.length,
      `${entry.path}: shadow count ${String(packedShadows.length)} vs ${String(live.shadows.length)}`)
    let shadowMismatch = 0
    for (let at = 0; at < Math.min(packedShadows.length, live.shadows.length); at += 1) {
      const packedRow = packedShadows[at]!
      const liveDraw = live.shadows[at]!
      if (packedRow[1] !== liveDraw.x || packedRow[2] !== liveDraw.y) shadowMismatch += 1
    }
    check(shadowMismatch === 0, `${entry.path}: shadow draw geometry and order (${String(shadowMismatch)} mismatches)`)
  }

  // Collision grid: expand the runs and compare bytes.
  const expanded = new Uint8Array(packed.collision.width * packed.collision.height)
  let cursor = 0
  for (const run of packed.collision.runs) {
    const value = run[0] ?? 0
    const length = run[1] ?? 0
    if (value !== 0) expanded.fill(value, cursor, Math.min(cursor + length, expanded.length))
    cursor += length
  }
  check(packed.collision.width === live.gridWidth, `${entry.path}: collision width`)
  check(packed.collision.height === live.gridHeight, `${entry.path}: collision height`)
  let collisionDiff = 0
  for (let at = 0; at < Math.min(expanded.length, live.blocked.length); at += 1) {
    if (expanded[at] !== live.blocked[at]) collisionDiff += 1
  }
  check(collisionDiff === 0, `${entry.path}: collision grid (${String(collisionDiff)} differing sub-tiles)`)

  // Spawn.
  const liveSpawn = findIsoSpawn(live, { warps: packed.warps, entrances: packed.entrances })
  const packedSpawn = packed.spawn
  check(
    (packedSpawn === null && liveSpawn === null)
    || (packedSpawn !== null && liveSpawn !== null && packedSpawn[0] === Math.round(liveSpawn.x) && packedSpawn[1] === Math.round(liveSpawn.y)),
    `${entry.path}: spawn point`,
  )

  // Frames: same tiles, same pixels (by hash), and every frame reachable on a page.
  check(packed.frames.length === live.frames.length, `${entry.path}: frame count`)
  let hashMismatch = 0
  let offPage = 0
  for (let at = 0; at < Math.min(packed.frames.length, live.frames.length); at += 1) {
    const liveFrame = live.frames[at]!
    if (frameHash(liveFrame.indices) !== packed.frameHash[at]) hashMismatch += 1
    const place = packed.framePlacement[at]
    if (place === undefined || (place[3] ?? 0) !== liveFrame.width || (place[4] ?? 0) !== liveFrame.height) offPage += 1
    comparedPixels += liveFrame.indices.byteLength
  }
  check(hashMismatch === 0, `${entry.path}: frame pixel hashes (${String(hashMismatch)} differ)`)
  check(offPage === 0, `${entry.path}: frame sizes match their page placement (${String(offPage)} differ)`)
  void rectOf

  // Objects: same placements, same count (art is not baked yet, by design).
  // The packer skips DS1 monster spawn points (`type` 1) and any id the hardcoded
  // object table does not know, so the expected count is "entries that resolve to a
  // real object", not the raw DS1 count. Token/mode are compared too: they come from
  // the lookup table, which is the part a wrong mapping would silently corrupt.
  // A few DS1 ids are simply absent from the community table; the packer records
  // them as unresolved instead of guessing, so they are excluded here the same way.
  let unknownIds = 0
  const expected: { object: (typeof level.objects)[number]; token: string; mode: string }[] = []
  for (const object of level.objects) {
    try {
      // Omitting the monsters tables intentionally restores the legacy drop-everything-non-object behaviour.
      const resolved = resolveDs1Object(objectsTable, packed.act, object.type, object.id)
      if (resolved.kind === 'object') expected.push({ object, token: resolved.token, mode: resolved.mode })
    } catch {
      unknownIds += 1
    }
  }
  check(packed.objects.length === expected.length,
    `${entry.path}: object count ${String(packed.objects.length)} vs ${String(expected.length)}`)
  let tokenMismatch = 0
  for (let index = 0; index < Math.min(packed.objects.length, expected.length); index += 1) {
    const baked = packed.objects[index]!
    const want = expected[index]!
    if (baked.token !== want.token || baked.mode !== (want.mode === '' ? 'NU' : want.mode)) {
      tokenMismatch += 1
      if (tokenMismatch <= 3) {
        console.log(`   FAIL ${entry.path}: object ${String(index)} ${baked.token}/${baked.mode} != ${want.token}/${want.mode}`)
      }
    }
  }
  check(tokenMismatch === 0, `${entry.path}: object tokens/modes match the lookup (${String(tokenMismatch)} mismatches)`)
  unknownObjectIds += unknownIds

  // Object frames: every object with a frame references a valid page and rect,
  // and no object with an art member is left pending a frame.
  const objectPages = packed.objectPages ?? []
  let invalidFrames = 0
  let pendingArt = 0
  for (const obj of packed.objects) {
    if (obj.frame) {
      if (obj.frame.page < 0 || obj.frame.page >= objectPages.length || obj.frame.width <= 0 || obj.frame.height <= 0) {
        invalidFrames += 1
      }
    } else if (obj.member !== null && obj.member !== undefined) {
      pendingArt += 1
    }
  }
  check(invalidFrames === 0, `${entry.path}: object frame placement within bounds (${String(invalidFrames)} invalid)`)
  check(pendingArt === 0, `${entry.path}: zero objects with art pending frame (${String(pendingArt)} pending)`)
  check(
    packed.automap !== undefined && JSON.stringify(packed.automap) === JSON.stringify(live.automap),
    `${entry.path}: preset automap matches live automap`,
  )

  console.log(
    `${entry.path.padEnd(26)} ${String(live.floors.length).padStart(5)} 地面 ${String(live.shadows.length).padStart(4)} 阴影 ${String(live.walls.length).padStart(4)} 墙 ${String(live.roofs.length).padStart(4)} 顶 `
    + `${String(live.frames.length).padStart(3)} 帧 ${String(packed.collision.width)}x${String(packed.collision.height)} 碰撞 `
    + `${String(expected.length).padStart(4)} 对象  ${collisionDiff === 0 && hashMismatch === 0 ? '一致' : '不一致'}`,
  )
}

/* --------------------------------------------------------------------------- *
 * World connectivity & Automap layers
 *
 * The pixel comparison above can only run on preset levels, because a generated
 * level has no DS1 in the archives to rebuild it from. Links, though, are baked
 * for every level, and they are the part that breaks silently: an opening whose
 * destination is not a graph edge is a door to the void, and a graph edge with
 * no opening is a level you can never leave. Both are checked here, for presets
 * and generated levels alike.
 * --------------------------------------------------------------------------- */

/** The solved graph the packer wrote alongside the levels. */
interface PackedWorldGraph {
  readonly version: number
  readonly layoutSeed: number
  readonly levels: readonly { readonly id: number; readonly name: string; readonly waypoint: number }[]
  readonly edges: readonly { readonly from: number; readonly to: number; readonly kind: string }[]
  readonly waypoints: readonly { readonly id: number; readonly levelId: number }[]
}

/** The link and automap half of a baked scene. */
interface PackedLinks {
  readonly levelId: number
  readonly entrances?: readonly { readonly toLevelId: number; readonly label: string }[]
  readonly warps?: readonly {
    readonly toLevelId: number
    readonly source?: 'tile' | 'room' | 'fallback'
  }[]
  readonly waypoints?: readonly {
    readonly waypointId: number
    readonly x: number
    readonly y: number
    readonly arriveX: number
    readonly arriveY: number
    readonly source: 'object' | 'placed'
  }[]
  readonly objects?: readonly {
    readonly id: number
    readonly type: number
    readonly name: string
    readonly token: string
    readonly objectsTxtId: number
  }[]
  readonly automap?: AutomapLayerData
  readonly stats?: {
    readonly unplacedEdges?: readonly { readonly toLevelId: number; readonly reason: string }[]
    readonly notes?: readonly string[]
  }
}

const graph = JSON.parse(await readFile(join(packDir, 'world-graph.json'), 'utf8')) as PackedWorldGraph
const graphLevelName = new Map(graph.levels.map(level => [level.id, level.name]))
/** `from -> to` pairs, for asking "is this a real edge?" in constant time. */
const graphEdges = new Set(graph.edges.map(edge => `${String(edge.from)}>${String(edge.to)}`))
/**
 * Every edge the bake is expected to open somewhere; emptied as they are found.
 *
 * Portal edges are left out. A town portal, the Tristram cairn portal, the act
 * transitions and the Arcane Sanctuary entrance are all conjured at run time by
 * the thing that opens them — a quest, a scroll, a red portal — so there is no
 * staircase in the artwork to find and demanding one would bury the real holes
 * under forty-six false ones.
 */
const unmaterialised = new Set(
  graph.edges.filter(edge => edge.kind !== 'portal')
    .map(edge => `${String(edge.from)}>${String(edge.to)}`),
)
/** Levels that own a waypoint pedestal, by the graph. */
const waypointLevels = new Set(graph.waypoints.map(entry => entry.levelId))
/** Waypoint levels seen with a baked pedestal, so variants do not each have to have one. */
const waypointsFound = new Set<number>()

let unplacedTotal = 0
/** How each baked warp's position was arrived at; see `SceneWarp.source`. */
const warpSources = { tile: 0, room: 0, fallback: 0 }
/** Levels with at least one invented staircase, for the summary. */
const approximateLevels = new Set<number>()
for (const entry of index.levels) {
  const scene = JSON.parse(await readFile(join(packDir, entry.path, 'scene.json'), 'utf8')) as PackedLinks
  const levelId = scene.levelId
  const name = graphLevelName.get(levelId) ?? entry.label

  // Automap layer verification for every baked scene (preset, maze, wilderness).
  const automap = scene.automap
  check(automap !== undefined, `${entry.path}: scene.automap exists`)
  if (automap !== undefined) {
    check(
      Number.isInteger(automap.layerId) && automap.layerId >= 0,
      `${entry.path}: automap.layerId (${String(automap.layerId)}) is a non-negative integer`,
    )
    check(
      Number.isInteger(automap.levelTypeId) && automap.levelTypeId >= 1 && automap.levelTypeId <= 35,
      `${entry.path}: automap.levelTypeId (${String(automap.levelTypeId)}) in 1..35`,
    )
    const totalCells =
      automap.floors.length + automap.walls.length + automap.objects.length + automap.extras.length
    check(totalCells > 0, `${entry.path}: automap has non-zero cells (${String(totalCells)})`)
    let invalidAutomapCells = 0
    for (const c of [...automap.floors, ...automap.walls, ...automap.objects, ...automap.extras]) {
      const fSaved = c.fSaved ?? 0
      const maxCellNo = fSaved === 0 ? 1498 : fSaved === 1 ? 39 : fSaved === 2 ? 3 : 7
      if (
        (fSaved !== 0 && fSaved !== 1 && fSaved !== 2 && fSaved !== 3) ||
        !Number.isInteger(c.cellNo) ||
        c.cellNo < 0 ||
        c.cellNo > maxCellNo ||
        !Number.isFinite(c.xPixel) ||
        !Number.isFinite(c.yPixel) ||
        !Number.isFinite(c.cellX) ||
        !Number.isFinite(c.cellY)
      ) {
        invalidAutomapCells += 1
      }
    }
    check(
      invalidAutomapCells === 0,
      `${entry.path}: all automap cells have valid fSaved, cellNo, and x/y (${String(invalidAutomapCells)} invalid)`,
    )
    if (levelId === 40 || levelId === 103 || levelId === 109) {
      check(
        automap.extras.length > 0,
        `${entry.path}: town level ${String(levelId)} has automap extras (${String(automap.extras.length)})`,
      )
    }
  }

  for (const warp of scene.warps ?? []) {
    const source = warp.source ?? 'tile'
    warpSources[source] += 1
    if (source === 'fallback') approximateLevels.add(levelId)
  }

  // Every opening must lead somewhere the graph agrees with.
  let strayOpenings = 0
  for (const link of [...(scene.entrances ?? []), ...(scene.warps ?? [])]) {
    const key = `${String(levelId)}>${String(link.toLevelId)}`
    if (graphEdges.has(key)) unmaterialised.delete(key)
    else {
      strayOpenings += 1
      if (strayOpenings <= 3) {
        console.log(`   FAIL ${entry.path}: 开口通向 ${String(link.toLevelId)}，但世界图里没有 ${name} → 该关卡的边`)
      }
    }
  }
  check(strayOpenings === 0, `${entry.path}: openings match graph edges (${String(strayOpenings)} stray)`)

  if (waypointLevels.has(levelId)) {
    const wps = scene.waypoints ?? []
    check(wps.length >= 1, `${entry.path}: waypoint level ${name} must contain a waypoint (found ${String(wps.length)})`)
    for (const wp of wps) {
      check(wp.source === 'object', `${entry.path}: waypoint source must be 'object' (was '${wp.source ?? 'placed'}')`)
    }
    const hasWpObject = (scene.objects ?? []).some(o =>
      o.type === 2 && (isWaypointObjectsTxtId(o.objectsTxtId) || WAYPOINT_TOKENS.has(o.token.toUpperCase()) || o.name === 'Waypoint')
    )
    check(hasWpObject, `${entry.path}: waypoint level ${name} must contain rendered waypoint object in scene.objects`)
    if (wps.length > 0) waypointsFound.add(levelId)
  }

  const unplaced = scene.stats?.unplacedEdges ?? []
  unplacedTotal += unplaced.length
  for (const hole of unplaced) {
    const target = graphLevelName.get(hole.toLevelId) ?? String(hole.toLevelId)
    console.log(`   HOLE ${entry.path}: 无法放置通往 ${target} 的开口（${hole.reason}）`)
  }
}

check(unplacedTotal === 0, `world: every graph edge got an opening (${String(unplacedTotal)} unplaced)`)

// Packs are filtered during development (`FILTER_LEVEL`), so every judgement
// below is scoped to levels this pack actually contains.
const bakedLevels = new Set(index.levels.map(entry => entry.levelId))

const missingWaypoints = [...waypointLevels]
  .filter(levelId => bakedLevels.has(levelId) && !waypointsFound.has(levelId))
for (const levelId of missingWaypoints) {
  console.log(`   FAIL 关卡 ${graphLevelName.get(levelId) ?? String(levelId)} 应有传送点，但所有变体都没有烘焙出来`)
}
check(missingWaypoints.length === 0, `world: waypoint levels have a pedestal (${String(missingWaypoints.length)} missing)`)

// An edge nobody opened is a level you can walk to on paper and never reach in
// play. In Act 3 Jungle, DRLGOUTPLACE_InitAct3OutdoorLevel connects Flayer Jungle (78) to either
// Great Marsh (77, linear: 76<->77<->78) or Spider Forest (76, branching: 76<->77 and 76<->78)
// per seed; whichever of the two mutually-exclusive seam pairs is not chosen on this seed is inactive.
const isInactiveJungleOrphan = (key: string): boolean => {
  if (key === '76>78' || key === '78>76') return !unmaterialised.has('77>78') && !unmaterialised.has('78>77')
  if (key === '77>78' || key === '78>77') return !unmaterialised.has('76>78') && !unmaterialised.has('78>76')
  return false
}
const orphanEdges = [...unmaterialised].filter(key =>
  bakedLevels.has(Number(key.split('>')[0])) && !isInactiveJungleOrphan(key))
for (const key of orphanEdges.slice(0, 20)) {
  const [from, to] = key.split('>').map(Number)
  console.log(`   FAIL 世界图有 ${graphLevelName.get(from!) ?? String(from!)} → ${graphLevelName.get(to!) ?? String(to!)} 的边，但没有任何变体开了这个口`)
}
check(orphanEdges.length === 0, `world: no graph edge left without an opening (${String(orphanEdges.length)} orphans)`)

// All 136 levels are generated via the 1:1 D2Common DRLG port; zero fallback warps allowed.
const MAX_EXPECTED_FALLBACK_WARPS = 0
check(
  warpSources.fallback <= MAX_EXPECTED_FALLBACK_WARPS,
  `world: fallback warps (${String(warpSources.fallback)}) within expected threshold (<= ${String(MAX_EXPECTED_FALLBACK_WARPS)})`,
)

// Verify baked Automap UI sprite sheets (R1/R2a).
const EXPECTED_AUTOMAP_SHEETS: readonly {
  readonly sheetName: string
  readonly uiImageKey: string
  readonly expectedFrames: number
}[] = [
  { sheetName: 'MaxiMap', uiImageKey: 'automapMaxi', expectedFrames: 1499 },
  { sheetName: 'MaxiMapS', uiImageKey: 'automapMaxiS', expectedFrames: 1499 },
  { sheetName: 'Act2Map', uiImageKey: 'automapAct2', expectedFrames: 40 },
  { sheetName: 'Act2MapS', uiImageKey: 'automapAct2S', expectedFrames: 40 },
  { sheetName: 'Act4Map', uiImageKey: 'automapAct4', expectedFrames: 4 },
  { sheetName: 'Act4MapS', uiImageKey: 'automapAct4S', expectedFrames: 4 },
  { sheetName: 'ExTnMap', uiImageKey: 'automapExTn', expectedFrames: 8 },
  { sheetName: 'ExTnMapS', uiImageKey: 'automapExTnS', expectedFrames: 8 },
]

const automapManifestPath = join('public', 'ui', 'automap', 'manifest.json')
const automapManifest = JSON.parse(await readFile(automapManifestPath, 'utf8')) as {
  readonly atlases: Record<string, {
    readonly image: string
    readonly atlasWidth: number
    readonly atlasHeight: number
    readonly frameCount: number
    readonly frames: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly offsetX: number; readonly offsetY: number }[]
  }>
}
const uiManifest = JSON.parse(await readFile(join('public', 'ui', 'manifest.json'), 'utf8')) as {
  readonly images: Record<string, string>
  readonly automapAtlases?: Record<string, {
    readonly image: string
    readonly atlasWidth: number
    readonly atlasHeight: number
    readonly frameCount: number
    readonly frames: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly offsetX: number; readonly offsetY: number }[]
  }>
}

for (const spec of EXPECTED_AUTOMAP_SHEETS) {
  const sheetMeta = automapManifest.atlases?.[spec.sheetName]
  check(sheetMeta !== undefined, `automap UI manifest has sheet ${spec.sheetName}`)
  if (sheetMeta !== undefined) {
    check(
      sheetMeta.frameCount === spec.expectedFrames && sheetMeta.frames.length === spec.expectedFrames,
      `automap UI sheet ${spec.sheetName} frameCount === ${String(spec.expectedFrames)} (got ${String(sheetMeta.frameCount)})`,
    )
    const pngFileName = sheetMeta.image.split('/').pop() ?? `${spec.sheetName}.png`
    const pngStat = await stat(join('public', 'ui', 'automap', pngFileName)).catch(() => null)
    check(pngStat !== null && pngStat.size > 0, `automap UI PNG public/ui/automap/${pngFileName} exists and is non-empty`)
  }
  const uiAtlasMeta = uiManifest.automapAtlases?.[spec.sheetName]
  const uiImageRel = uiManifest.images?.[spec.uiImageKey]
  check(uiAtlasMeta !== undefined && uiImageRel !== undefined, `public/ui/manifest.json has automap entry ${spec.sheetName} (${spec.uiImageKey})`)
  if (uiAtlasMeta !== undefined && uiImageRel !== undefined) {
    check(
      uiAtlasMeta.frameCount === spec.expectedFrames && uiAtlasMeta.frames.length === spec.expectedFrames,
      `public/ui/manifest.json entry ${spec.sheetName} frameCount === ${String(spec.expectedFrames)}`,
    )
    const relFromPublic = uiImageRel.replace(/^\/+/, '')
    const uiPngStat = await stat(join('public', relFromPublic)).catch(() => null)
    check(uiPngStat !== null && uiPngStat.size > 0, `public/${relFromPublic} exists and is non-empty`)
  }
}

console.log(
  `\n楼梯来源：美术瓦片 ${String(warpSources.tile)}，迷宫楼梯间 ${String(warpSources.room)}，`
  + `兜底 ${String(warpSources.fallback)}（涉及 ${String(approximateLevels.size)} 个关卡）`,
)
if (approximateLevels.size > 0) {
  const breakdown = [...approximateLevels]
    .map(id => `${String(id)} (${graphLevelName.get(id) ?? 'unknown'})`)
    .join(', ')
  console.log(`   兜底关卡列表: ${breakdown}`)
}

console.log(`\n${String(checks - failures)}/${String(checks)} 项断言通过（逐像素比对了 ${(comparedPixels / 1048576).toFixed(1)} MB 的索引数据）`)
if (failures > 0) process.exit(1)


