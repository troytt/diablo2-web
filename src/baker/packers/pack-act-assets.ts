/**
 * Bake map assets out of the archives into web-native packs.
 *
 * The page can already read the real archives, but doing so costs it 38 MB and
 * ~11k range requests per visit (measured), because it decodes DS1/DT1/PL2 and
 * builds an atlas in the browser every time. This script moves all of that
 * offline: it walks the same code the page walks — `resolveLevel`, `decodeDs1`,
 * `decodeDt1`, `buildIsoMapScene`, `decodeDc6` — and writes the *result* as
 * indexed PNG tile pages plus one JSON scene per map. The page then decodes
 * nothing but PNG.
 *
 * Design decisions worth knowing:
 *
 * - **Indexed PNG, one palette per act.** Diablo II art is palette-indexed and
 *   each act ships its own `pal.pl2`; PNG colour type 3 carries both, so the
 *   browser's own decoder does the palette expansion on the GPU upload path.
 * - **Pages of at most 2048², hot frames first.** Frames used near the spawn go
 *   into the first page(s), so the page can paint after loading one or two PNGs
 *   instead of the whole map.
 * - **The scene JSON is the authority, not a re-derivation.** Draw lists are
 *   already in painter's order and the collision grid is exactly the one the
 *   live path produces; `scripts/verify-packs.ts` re-derives both from the MPQs
 *   and fails if they differ by a byte.
 *
 * Usage: node scripts/pack-act-assets.ts [archive-directory] [output-directory]
 */
import { mkdir, readdir, rm, unlink, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { isMainThread, Worker, parentPort, workerData } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import { availableParallelism } from 'node:os'
import { performance } from 'node:perf_hooks'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { cell, loadActTables, parseTable, townLevelForAct, ACT_TOWNS } from '../../common/world/acts.ts'
import type { ActTables } from '../../common/world/acts.ts'
import type { Ds1 } from '../../common/formats/ds1.ts'
import { decodeDt1 } from '../../common/formats/dt1.ts'
import type { Dt1 } from '../../common/formats/dt1.ts'
import { decodePl2 } from '../../common/formats/pl2.ts'
import { buildIsoMapScene, cellAt, findIsoSpawn, ORTHO_SUB_TILE_HEIGHT, ORTHO_SUB_TILE_WIDTH } from '../../common/world/d2map.ts'
import { frameDurationMsFromAnimSpeed } from '../../common/world/animated-tiles.ts'
import { planLevelMonsters } from '../../common/units/monsters-data.ts'
import type { IsoMapScene, IsoDraw } from '../../common/world/d2map.ts'
import { SUB_TILES_PER_TILE } from '../../common/world/map.ts'
import { loadObjectsTable, resolveDs1Object, MONSTER_ROOT, OBJECT_MODE_TOKENS, ADDITIVE_OBJECT_TOKENS, objectCofMember } from '../../common/units/objects.ts'
import { isWaypointObjectsTxtId, WAYPOINT_TOKENS } from '../../common/units/object-lookup.ts'
import { decodeCof } from '../../common/formats/cof.ts'
import { resolveCofLayerDrawMode } from '../../common/units/monster-art.ts'
import { decodeDcc } from '../../common/formats/dcc.ts'
import { decodeDc6 } from '../../common/formats/dc6.ts'
import type { SpriteFrame } from '../../common/formats/sprite.ts'
import { actLevelIds, buildDrlgLevelMap, drlgLevelInputFromDump } from '../../common/drlg/drlg-map.ts'
import type { DrlgEntrance, DrlgLevelInput } from '../../common/drlg/drlg-map.ts'
import { dumpAct1 } from '../../common/drlg/drlg-dump.ts'
import { createDrlgEnv } from '../../common/drlg/drlg-source.ts'
import type { DrlgTables } from '../../common/drlg/drlg-tables.ts'
import { WorldVariants } from '../../common/world/act-variants.ts'
import type { ActLayout, VariantEntry, VariantIndex } from '../../common/world/act-variants.ts'
import { drlgSuperUniqueIds, loadDrlgMpqData, loadDrlgMpqTables } from '../io/drlg-mpq-source.ts'

/**
 * An entrance a generator reports: the DRLG adapter's (seams carry a span) with the display label
 * the bake gives it.
 */
type GeneratorEntrance = DrlgEntrance & { readonly label: string }
import {
  buildWorldGraph, edgesFrom, findWarpGeometry, isClickableWarp,
  parseLevelRows, parseWarpGeometry, SIDES,
} from '../../common/world/world-graph.ts'
import type { Side, WorldEdge, WorldGraph } from '../../common/world/world-graph.ts'
import {
  cellToSubTile, findBorderOpening, findWaypointSpot, largestWalkableRegion, nearestWalkable,
  triggerableFrom, WARP_TRIGGER_SUBTILES,
} from '../../common/world/level-links.ts'
import type {
  BorderOpening, LinkGrid, SceneEntrance, SceneLinks, SceneWarp, SceneWaypoint, WalkableRegion,
} from '../../common/world/level-links.ts'
import { findWarpTiles } from '../../common/world/warp-tiles.ts'
import { encodeIndexedPng } from '../io/png.ts'

/**
 * Archive stack, in load order (later overrides earlier).
 *
 * `d2char.mpq` is mounted *first* so it sits at the bottom: it holds the object
 * and character art (`data\global\objects\…`) but no map data, and this order
 * keeps the map lookups resolving through `d2data` → `d2exp` → `Patch_D2` as the
 * game does.
 */
const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
/** Atlas page side limit (both dimensions). */
const PAGE_SIZE = 2048
/** Cells around the spawn whose frames go into the first page. */
const HOT_RADIUS_CELLS = 8
/** Where object art lives. */
const OBJECT_PREFIX = 'data\\global\\objects\\'
/**
 * Tokens that represent persistent environmental fire and illumination objects.
 * Ground truth parity (1.13c): Torches (TO), candles (A1, A2, 3o/3O), and fires
 * (FX, FY, FZ, BR, BF, FL) cycle continuously in ambient illumination without clamping.
 */
export const PERSISTENT_ILLUMINATION_TOKENS = new Set([
  'TO', 'A1', 'A2', '3O', '3o', 'FX', 'FY', 'FZ', 'BR', 'BF', 'FL',
])
/**
 * The player's walking speed in scene pixels, matching `act-scene.ts`.
 *
 * Monster speeds are expressed relative to it, so the baker has to know the
 * same number the browser does. Kept as a literal on both sides rather than
 * shared through a module because `act-scene.ts` is a browser entry point and
 * this script must not pull it in.
 */
const PLAYER_WALK_SPEED_PX = 170

/** Where monster and town-NPC art lives. */
/**
 * Mode directories tried in order when picking an object's art.
 *
 * Note what the object art actually *is*: under `data\global\objects` the
 * archives hold **1748 DCC and 1461 COF files against just 13 DC6**. Diablo II
 * draws objects with the same composite pipeline as characters — a COF that
 * lists layers and frames plus the DCC files behind them — so this packer
 * records each object's placement and its exact art members, and leaves the
 * pixels to the `COF`/`DCC` decoder that the character art also needs. Baking a
 * wrong file as if it were a DC6 would have produced silent garbage instead.
 */
const OBJECT_MODES = ['tr', 'nu', 's1', 's2', 's3'] as const

/**
 * The maps to bake, derived from `Levels.txt` rather than listed by hand.
 *
 * `DrlgType` picks the generator, exactly as the game does (documented in the
 * knowledge base and mirrored by OpenDiablo2):
 *
 * - **2 = preset area**: `LvlPrest` rows name fixed DS1 files, so the map is
 *   baked byte-for-byte — what `verify-packs.ts` diffs against the live decoder.
 * - **1 = random maze** / **3 = wilderness**: no fixed layout exists. Those come
 *   from the generators (`src/game/maze.ts`, `src/game/wilderness.ts`) driven by
 *   `LvlMaze`, `LvlSub` and the `LvlPrest` room pieces, and their packs are
 *   marked `approximation` because the engine's own placement is hardcoded.
 */
type LevelKind = 'preset' | 'maze' | 'wilderness'

/** One map to bake. */
interface LevelJob {
  readonly act: number
  readonly levelId: number
  readonly name: string
  readonly kind: LevelKind
  readonly slug: string
}

/** Filled in from `Levels.txt` once the tables are loaded. */
let LEVELS: readonly LevelJob[] = []

/**
 * Turn a level name into a stable, file-friendly slug.
 *
 * @param name - `Levels.txt` name, e.g. `Act 1 - Tristram`.
 * @returns the slug.
 */
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** One frame's placement inside a page. */
interface Placement {
  readonly page: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** One atlas page being packed. */
interface PackedPage {
  readonly pixels: Uint8Array
  frames: number
  maxUsedY: number
}

/** Frames, shelf-packed into pages of at most {@link PAGE_SIZE} squared. */
export class PageBuilder {
  private readonly pages: PackedPage[] = []
  /** Palette the pages are encoded against. */
  private readonly palette: Uint8Array
  private cursorX = 0
  private shelfY = 0
  private shelfHeight = 0
  private maxUsedY = 0

  constructor(palette: Uint8Array) {
    this.palette = palette
  }

  /** Frames placed so far. */
  get placed(): number {
    return this.pages.reduce((sum, page) => sum + page.frames, 0)
  }

  /** The pages, with their used height. */
  get pageCount(): number {
    return this.pages.length
  }

  /**
   * Place one indexed frame, opening pages as needed.
   *
   * Shelves keep placement trivial and predictable; frames wider than a page are
   * clamped rather than rejected, because a tile bigger than 2048 px would be a
   * broken library, not a reason to lose the whole map.
   *
   * @param frame - width, height and palette indices.
   * @returns where the frame landed.
   */
  add(frame: { width: number; height: number; indices: Uint8Array }): Placement {
    const width = Math.max(1, Math.min(frame.width, PAGE_SIZE))
    const height = Math.max(1, Math.min(frame.height, PAGE_SIZE))
    if (this.cursorX + width > PAGE_SIZE) {
      this.shelfY += this.shelfHeight
      this.shelfHeight = 0
      this.cursorX = 0
    }
    if (this.pages.length === 0 || this.shelfY + height > PAGE_SIZE) {
      this.pages.push({ pixels: new Uint8Array(PAGE_SIZE * PAGE_SIZE), frames: 0, maxUsedY: 0 })
      this.shelfY = 0
      this.shelfHeight = 0
      this.cursorX = 0
      this.maxUsedY = 0
    }
    const page = this.pages[this.pages.length - 1]!
    const placement: Placement = {
      page: this.pages.length - 1, x: this.cursorX, y: this.shelfY, width, height,
    }
    for (let row = 0; row < height; row += 1) {
      const from = row * frame.width
      const to = (this.shelfY + row) * PAGE_SIZE + this.cursorX
      page.pixels.set(frame.indices.subarray(from, from + width), to)
    }
    this.cursorX += width
    this.shelfHeight = Math.max(this.shelfHeight, height)
    this.maxUsedY = Math.max(this.maxUsedY, this.shelfY + this.shelfHeight)
    page.maxUsedY = this.maxUsedY
    page.frames += 1
    return placement
  }

  /**
   * Encode every page, trimming each to the rows it actually used.
   *
   * @param transparent - palette index to mark transparent.
   * @returns file-ready PNGs, in page order.
   */
  encode(transparent: number): { name: string; png: Uint8Array; width: number; height: number; frames: number }[] {
    return this.pages.map((page, index) => {
      const used = Math.max(1, this.usedHeight(page))
      const trimmed = new Uint8Array(PAGE_SIZE * used)
      for (let row = 0; row < used; row += 1) {
        trimmed.set(page.pixels.subarray(row * PAGE_SIZE, (row + 1) * PAGE_SIZE), row * PAGE_SIZE)
      }
      return {
        name: `tiles-${String(index)}.png`,
        png: encodeIndexedPng({
          width: PAGE_SIZE,
          height: used,
          pixels: trimmed,
          palette: this.palette,
          transparentIndex: transparent,
        }),
        width: PAGE_SIZE,
        height: used,
        frames: page.frames,
      }
    })
  }

  /**
   * Height of the last written row, bounded by the shelf packer's `maxUsedY`.
   *
   * @param page - the page.
   * @returns the used height in rows.
   */
  private usedHeight(page: PackedPage): number {
    const startRow = Math.min(PAGE_SIZE, page.maxUsedY) - 1
    for (let row = startRow; row >= 0; row -= 1) {
      const from = row * PAGE_SIZE
      for (let x = 0; x < PAGE_SIZE; x += 1) if (page.pixels[from + x] !== 0) return row + 1
    }
    return 1
  }
}

/**
 * FNV-1a over a frame's indexed pixels, so verification can compare content
 * without shipping the pixels twice.
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

const [archiveDir = 'samples/d2', outDir = 'public/packs'] = isMainThread
  ? process.argv.slice(2)
  : [
      (workerData as { archiveDir?: string } | undefined)?.archiveDir ?? process.argv[2] ?? 'samples/d2',
      (workerData as { outDir?: string } | undefined)?.outDir ?? process.argv[3] ?? 'public/packs',
    ]

interface WorkerSharedContext {
  readonly tables: ActTables
  readonly objectsTableTyped: Awaited<ReturnType<typeof loadObjectsTable>>
  readonly monstersTable: {
    readonly preset: ActTables['monpreset']
    readonly stats: ActTables['monstats']
    readonly presetPlaceByAct: Map<string, string[]>
    readonly statsById: Map<string, readonly string[]>
  }
  readonly monstats2ById: Map<string, { noMap: boolean; automapCel: number }>
  readonly worldGraph: WorldGraph
  readonly warpGeometry: ReturnType<typeof parseWarpGeometry>
  readonly townDistance: Map<number, number>
  readonly objectById: Map<number, { name: string; token: string; hp: number }>
  readonly objectMembers: Map<string, Map<string, string[]>>
  readonly monsterMembers: Map<string, Map<string, string[]>>
  readonly drlgTablesData: DrlgTables
  readonly superUniqueIds: readonly string[]
  readonly palettes: Map<string, Uint8Array>
}

const archives = new MountedArchives()
let archivesMounted = false
async function ensureArchives(): Promise<MountedArchives> {
  if (!archivesMounted) {
    for (const name of MOUNTS) {
      archives.add(name, await MpqArchive.open(await fileSource(join(archiveDir, name))))
    }
    archivesMounted = true
  }
  return archives
}

let tables!: ActTables
let objectsTableTyped!: Awaited<ReturnType<typeof loadObjectsTable>>
const presetPlaceByAct = new Map<string, string[]>()
const statsById = new Map<string, readonly string[]>()
let monstersTable!: {
  preset: ActTables['monpreset']
  stats: ActTables['monstats']
  presetPlaceByAct: Map<string, string[]>
  statsById: Map<string, readonly string[]>
}
const monstats2ById = new Map<string, { noMap: boolean; automapCel: number }>()
const ACT_LAYOUT_SEED = 0x5eed_2000
let worldGraph!: WorldGraph
let warpGeometry!: ReturnType<typeof parseWarpGeometry>
let townDistance = new Map<number, number>()
const objectById = new Map<number, { name: string; token: string; hp: number }>()
const objectMembers = new Map<string, Map<string, string[]>>()
const monsterMembers = new Map<string, Map<string, string[]>>()
let drlgTablesPromise: Promise<DrlgTables> | undefined
let superUniqueIdsCache: readonly string[] | undefined
const paletteCache = new Map<string, Uint8Array>()
let tablesInitialized = false

/**
 * Guard worker threads BEFORE main-thread MPQ mounting and `.txt` / `(listfile)` table parsing.
 * Workers hydrate pre-parsed tables from `workerData.sharedContext` and immediately start listening.
 */
if (!isMainThread) {
  const ctx = (workerData as { sharedContext?: WorkerSharedContext } | undefined)?.sharedContext
  if (ctx !== undefined) {
    tables = ctx.tables
    objectsTableTyped = ctx.objectsTableTyped
    monstersTable = ctx.monstersTable
    for (const [k, v] of ctx.monstats2ById) monstats2ById.set(k, v)
    worldGraph = ctx.worldGraph
    warpGeometry = ctx.warpGeometry
    townDistance = ctx.townDistance
    for (const [k, v] of ctx.objectById) objectById.set(k, v)
    for (const [k, v] of ctx.objectMembers) objectMembers.set(k, v)
    for (const [k, v] of ctx.monsterMembers) monsterMembers.set(k, v)
    drlgTablesPromise = Promise.resolve(ctx.drlgTablesData)
    superUniqueIdsCache = ctx.superUniqueIds
    for (const [k, v] of ctx.palettes) paletteCache.set(k, v)
    tablesInitialized = true
  }
  startWorker()
}

/**
 * Mount MPQ archives and parse `.txt` tables and `(listfile)` once on the main thread.
 */
async function initMainThreadTables(): Promise<void> {
  if (tablesInitialized) return
  const mounted = await ensureArchives()
  tables = await loadActTables(mounted)
  const objectsTable = parseTable(await mounted.read('data\\global\\excel\\objects.txt'))
  /** Same table, through the typed loader the object resolution expects. */
  objectsTableTyped = await loadObjectsTable(mounted)

  /**
   * `MonPreset.txt` `Place` values grouped by act.
   *
   * The position within an act **is** the DS1 type-1 `id`, so this array must stay
   * dense: dropping a row would renumber every entry after it and silently hand
   * each NPC its neighbour's identity.
   */
  presetPlaceByAct.clear()
  for (const row of tables.monpreset.rows) {
    const act = cell(tables.monpreset, row, 'Act')
    const place = cell(tables.monpreset, row, 'Place')
    if (!place) {
      throw new Error(
        `MonPreset.txt act ${act} has an empty Place cell; the row index is the DS1 id, `
        + 'so skipping it would shift every later NPC onto the wrong monster',
      )
    }
    let list = presetPlaceByAct.get(act)
    if (list === undefined) {
      list = []
      presetPlaceByAct.set(act, list)
    }
    list.push(place)
  }

  /** `monstats.txt` rows indexed by `Id` (the column `MonPreset.Place` points at). */
  statsById.clear()
  for (const row of tables.monstats.rows) {
    const id = cell(tables.monstats, row, 'Id')
    if (id) statsById.set(id, row)
  }

  monstersTable = {
    preset: tables.monpreset,
    stats: tables.monstats,
    presetPlaceByAct,
    statsById,
  }

  const monstats2Table = parseTable(await mounted.read('data\\global\\excel\\monstats2.txt'))
  monstats2ById.clear()
  for (const row of monstats2Table.rows) {
    const id = cell(monstats2Table, row, 'Id')
    if (id) {
      monstats2ById.set(id.toLowerCase(), {
        noMap: Number(cell(monstats2Table, row, 'noMap')) !== 0,
        automapCel: Number(cell(monstats2Table, row, 'automapCel')) || 0,
      })
    }
  }

  worldGraph = buildWorldGraph(parseLevelRows(tables.levels))
  warpGeometry = parseWarpGeometry(tables.lvlwarp)

  townDistance = ((): Map<number, number> => {
    const outgoing = new Map<number, number[]>()
    for (const edge of worldGraph.edges) {
      const list = outgoing.get(edge.from)
      if (list === undefined) outgoing.set(edge.from, [edge.to])
      else list.push(edge.to)
    }
    const distance = new Map<number, number>()
    const queue: number[] = []
    for (const town of ACT_TOWNS) {
      distance.set(town, 0)
      queue.push(town)
    }
    while (queue.length > 0) {
      const at = queue.shift()
      if (at === undefined) break
      const here = distance.get(at) ?? 0
      for (const next of outgoing.get(at) ?? []) {
        if (distance.has(next)) continue
        distance.set(next, here + 1)
        queue.push(next)
      }
    }
    return distance
  })()

  const allNames = await mounted.listFiles()

  const jobs: LevelJob[] = []
  for (const row of tables.levels.rows) {
    const levelId = Number(cell(tables.levels, row, 'Id'))
    if (!Number.isFinite(levelId) || levelId === 0) continue
    const name = cell(tables.levels, row, 'Name')
    const drlg = Number(cell(tables.levels, row, 'DrlgType'))
    const act = Number(cell(tables.levels, row, 'Act')) + 1
    let kind: LevelKind | null = null
    if (drlg === 2) kind = 'preset'
    else if (drlg === 1) kind = 'maze'
    else if (drlg === 3) kind = 'wilderness'
    if (kind === null) continue
    jobs.push({ act, levelId, name, kind, slug: `${String(levelId)}-${slugify(name)}` })
  }
  LEVELS = jobs

  objectById.clear()
  for (const row of objectsTable.rows) {
    const id = Number(cell(objectsTable, row, 'Id'))
    if (!Number.isFinite(id)) continue
    objectById.set(id, {
      name: cell(objectsTable, row, 'Name'),
      token: cell(objectsTable, row, 'Token').toUpperCase(),
      hp: Number(cell(objectsTable, row, 'HitPoints') || '0'),
    })
  }

  objectMembers.clear()
  monsterMembers.clear()
  for (const name of allNames) {
    const isObj = name.toLowerCase().startsWith(OBJECT_PREFIX.toLowerCase())
    const isMon = name.toLowerCase().startsWith(MONSTER_ROOT.toLowerCase())
    if (!isObj && !isMon) continue
    const prefixLen = isObj ? OBJECT_PREFIX.length : MONSTER_ROOT.length
    const rest = name.slice(prefixLen).split('\\')
    if (rest.length < 3) continue
    const token = (rest[0] ?? '').toUpperCase()
    const mode = (rest[1] ?? '').toLowerCase()
    const map = isObj ? objectMembers : monsterMembers
    if (!map.has(token)) map.set(token, new Map())
    const modes = map.get(token)!
    if (!modes.has(mode)) modes.set(mode, [])
    modes.get(mode)!.push(name)
  }

  tablesInitialized = true
}

/**
 * A level's display name, for labelling the openings that lead to it.
 *
 * @param levelId - the level.
 * @returns its `Levels.txt` name, or the bare id when there is no such level.
 */
function levelNameOf(levelId: number): string {
  return worldGraph.levels.get(levelId)?.name ?? `level ${String(levelId)}`
}

/* ------------------------------------------------------------------------- *
 * DRLG port (Acts I–V outdoor levels)
 * ------------------------------------------------------------------------- */

/** Copies the bake makes of every act the DRLG port generates, one game seed each. */
const DRLG_ACT_VARIANTS = 1

/** Canonical single game seed for all 5 acts (matches Act I oracle fixture seed 0x5eed0100). */
const GAME_SEED = 0x5eed_0100

/**
 * The game seed copy `variant` of `act` is generated from.
 *
 * D2 generates a whole act from one seed (DRLG_AllocDrlg -> DRLGOUTPLACE_CreateLevelConnections ->
 * DRLG_InitLevel), so the seed belongs to the (act, copy) pair, never to a level.
 *
 * @param _act - act number (1..5).
 * @param variant - copy number (0-based, the index entries' `actVariant`).
 * @returns the game seed.
 */
function actGameSeed(_act: number, variant: number): number {
  return (GAME_SEED + variant) >>> 0
}

/**
 * The levels of an act the DRLG port generates: all levels (preset, maze, outdoor) of that act.
 *
 * @param t - the DRLG tables.
 * @param act - act number (1..5).
 * @returns level ids, ascending.
 */
function drlgLevelsOf(t: DrlgTables, act: number): readonly number[] {
  return actLevelIds(t, act - 1)
}

/** One DRLG-generated copy of an act: its index record and the adapter input of each generated level. */
interface DrlgActCopy {
  readonly layout: ActLayout
  readonly inputs: ReadonlyMap<number, DrlgLevelInput>
}

/**
 * The DRLG's compiled tables, loaded once per thread (the adapter maps a level with them).
 *
 * @returns the tables.
 */
function drlgTables(): Promise<DrlgTables> {
  drlgTablesPromise ??= ensureArchives().then(mounted => loadDrlgMpqTables(member => mounted.read(member)))
  return drlgTablesPromise
}

/**
 * Generate every copy of every DRLG act that has a level to bake, on the main thread.
 *
 * One DRLG run per copy, as in D2: the act's outdoor levels, their seams and the town's gate come out
 * of the same run, so the copy is recorded as a whole (`index.json` `actLayouts`) and the runtime uses
 * one copy per act (src/game/act-variants.ts). The whole act is generated even when a filter asks for a
 * single level, because no level of it exists without the others.
 *
 * @param wanted - whether the bake's filters select a level.
 * @returns the copies by act; acts without a selected DRLG level are absent.
 */
async function generateDrlgActs(wanted: (act: number, levelId: number) => boolean): Promise<Map<number, DrlgActCopy[]>> {
  const out = new Map<number, DrlgActCopy[]>()
  const t = await drlgTables()
  const mounted = await ensureArchives()
  for (let act = 1; act <= 5; act += 1) {
    const levels = drlgLevelsOf(t, act)
    if (!levels.some(levelId => wanted(act, levelId))) continue
    const data = await loadDrlgMpqData(member => mounted.read(member), act)
    const town = townLevelForAct(act)
    const copies: DrlgActCopy[] = []
    for (let variant = 0; variant < DRLG_ACT_VARIANTS; variant += 1) {
      const gameSeed = actGameSeed(act, variant)
      const dump = dumpAct1(createDrlgEnv(data.source, data.tables), gameSeed, levels, { act: act - 1 })
      const townFile = dump.act.find(level => level.id === town)?.preset?.map?.file
      if (townFile === undefined || townFile === '') {
        throw new Error(`act ${String(act)} seed 0x${gameSeed.toString(16)}: the generated act picked no DS1 for its town (level ${String(town)})`)
      }
      copies.push({
        layout: { variant, gameSeed, levels: [...levels], presets: [{ levelId: town, ds1: townFile.replace(/\//g, '\\') }] },
        inputs: new Map(levels.map(levelId => [levelId, drlgLevelInputFromDump(dump, levelId, data.tables)])),
      })
      console.log(`DRLG act ${String(act)} copy ${String(variant)} (seed 0x${gameSeed.toString(16)}): town ${townFile}`)
    }
    out.set(act, copies)
  }
  return out
}

/**
 * Check that every DRLG act copy in the (merged) index resolves the way the runtime resolves it: each
 * generated level has exactly one copy per variant, the town file the copy fixed is baked, and no
 * other copy of a generated level is left over (e.g. from a legacy bake merged in by a filtered run).
 *
 * @param index - the index about to be written.
 */
function validateActLayouts(index: VariantIndex<VariantEntry>): void {
  for (const [actKey, layouts] of Object.entries(index.actLayouts ?? {})) {
    const act = Number(actKey)
    const generated = new Set(layouts.flatMap(layout => layout.levels))
    for (const entry of index.levels) {
      if (entry.act === act && entry.levelId !== undefined && generated.has(entry.levelId) && entry.actVariant === undefined) {
        throw new Error(`index: ${entry.label} is a copy of DRLG level ${String(entry.levelId)} without an actVariant; bake the whole act`)
      }
    }
    for (const layout of layouts) {
      // A fresh selection per copy, pinned to it the way opening one of its levels pins it.
      const variants = new WorldVariants(index)
      const member = index.levels.find(entry => entry.act === act && entry.actVariant === layout.variant)
      if (member === undefined) throw new Error(`actLayouts[${actKey}] copy ${String(layout.variant)}: no baked level belongs to it`)
      variants.pin(member)
      for (const levelId of [...layout.levels, ...layout.presets.map(preset => preset.levelId)]) {
        if (variants.entryForLevel(levelId) === null) {
          throw new Error(`actLayouts[${actKey}] copy ${String(layout.variant)}: level ${String(levelId)} is not baked`)
        }
      }
      if (variants.startEntry(act) === null) throw new Error(`actLayouts[${actKey}] copy ${String(layout.variant)}: no start level`)
    }
  }
}

/**
 * Turn a graph edge and a place into a baked warp.
 *
 * @param edge - the edge being placed.
 * @param direction - which way it goes.
 * @param cellX - the anchor cell.
 * @param cellY - the anchor cell.
 * @param grid - the collision map, for nudging the arrival point off a wall.
 * @param source - how the position was found.
 * @param region - the level's main walkable region when there is a meaningful
 *   one, keeping the arrival point out of sealed pockets; undefined for
 *   generated levels, where the unstamped void would be the largest region.
 * @param subTile - the warp's exact sub-tile when the generator knows it (the
 *   DRLG's UNIT_TILE preset unit); the anchor cell's centre otherwise.
 * @returns the warp.
 */
function makeWarp(
  edge: WorldEdge,
  direction: SceneWarp['direction'],
  cellX: number,
  cellY: number,
  grid: IsoMapScene,
  source: SceneWarp['source'],
  region: WalkableRegion | undefined,
  subTile?: { readonly x: number; readonly y: number },
): SceneWarp {
  const warpId = edge.warps[0] ?? -1
  const geometry = warpId < 0 ? undefined : findWarpGeometry(warpGeometry, warpId)
  let x = subTile?.x ?? cellToSubTile(cellX)
  let y = subTile?.y ?? cellToSubTile(cellY)
  const fullSpan = Math.max(grid.gridWidth, grid.gridHeight)
  if (region !== undefined && !triggerableFrom(grid, region, x, y, WARP_TRIGGER_SUBTILES)) {
    const snapped = nearestWalkable(grid, x, y, fullSpan, region)
    if (snapped !== null) {
      x = snapped.x
      y = snapped.y
    }
  }
  // `OffsetX/Y` is where the engine materialises the player, relative to the
  // anchor tile and usually negative so that they do not land on the trigger.
  const wanted = {
    x: x + (geometry?.offsetX ?? -2),
    y: y + (geometry?.offsetY ?? -2),
  }
  const arrive = nearestWalkable(grid, wanted.x, wanted.y, fullSpan, region) ?? { x, y }
  return {
    toLevelId: edge.to,
    warpId,
    direction,
    label: `${levelNameOf(edge.to)}`,
    x,
    y,
    arriveX: arrive.x,
    arriveY: arrive.y,
    selectX: geometry?.selectX ?? 0,
    selectY: geometry?.selectY ?? 0,
    selectDX: geometry === undefined || !isClickableWarp(geometry) ? 0 : geometry.selectDX,
    selectDY: geometry === undefined || !isClickableWarp(geometry) ? 0 : geometry.selectDY,
    exitWalkX: geometry?.exitWalkX ?? 0,
    exitWalkY: geometry?.exitWalkY ?? 0,
    source,
  }
}

/**
 * Work out every way out of one baked level.
 *
 * **Warps come from the artwork.** Every map in the game, shipped or generated,
 * marks its staircases with DS1 special tiles whose `style` is the `Warp0..7`
 * slot — see {@link findWarpTiles} — and the slot says which edge of the graph
 * the staircase is. That single rule covers presets, mazes and outdoor levels
 * alike, it gives the position the original engine would have used, and it
 * removes the need to guess which of a dungeon's two staircases goes up.
 *
 * **Seams come from the generator or the collision map.** A seamless edge has
 * no marker, because walking off the edge of the Blood Moor is not a staircase.
 * Outdoor levels report the openings they cut; presets have theirs recovered
 * from the collision map, since their artwork is fixed and nobody wrote down
 * where the gate is.
 *
 * The maze generator's staircase rooms are kept as a fallback for the handful
 * of pieces that carry no marker.
 *
 * @param levelId - the level.
 * @param kind - how it was built.
 * @param ds1 - the assembled map, for its warp markers.
 * @param grid - the baked collision map.
 * @param entrances - `stats.entrances` from the wilderness generator, or the
 *   DRLG adapter's entrances, if any.
 * @param mazeWarps - `stats.warps` from the maze generator, if any.
 * @param waypointCells - waypoint objects found in the artwork, in sub-tiles.
 * @param mazeWaypoints - `stats.waypoints` from the maze generator, if any.
 * @param options - `exactLinks`: the generator reports every seam and warp of
 *   the level exactly (the DRLG port). Nothing is then inferred: warp markers,
 *   staircase rooms, border scans and fallback warps are not used, every seam
 *   must carry the stretch of edge it opens on, and any disagreement with the
 *   world graph throws.
 * @returns the links, plus anything the graph wanted that could not be placed.
 */
function buildSceneLinks(
  levelId: number,
  kind: LevelKind,
  ds1: Ds1,
  grid: IsoMapScene,
  entrances: readonly GeneratorEntrance[],
  waypointCells: readonly { x: number; y: number }[],
  options: { readonly exactLinks?: boolean } = {},
): SceneLinks {
  const exactLinks = options.exactLinks === true
  const outEntrances: SceneEntrance[] = []
  const outWarps: SceneWarp[] = []
  const unplaced: { toLevelId: number; reason: string }[] = []
  const notes: string[] = []
  const placedSeams = new Set<number>()
  const placedWarps = new Set<number>()

  // The part of the map the player can actually stand on.
  //
  // Presets are finished artwork and outdoor levels are stamped edge to edge,
  // so in both the biggest connected patch of open ground is the play area.
  //
  // For mazes, `buildIsoMapScene` leaves unstamped void cells around the rooms
  // as `blocked = 0` (see Issue #38), so the void outside the dungeon walls
  // would be larger than the dungeon itself. Masking out cells that carry no
  // active floor tile before running `largestWalkableRegion` isolates the true
  // dungeon interior, ensuring every staircase and fallback warp lands inside
  // connected rooms rather than outside the walls.
  let regionGrid: LinkGrid = grid
  if (kind === 'maze') {
    const maskedBlocked = new Uint8Array(grid.blocked)
    for (let cy = 0; cy < grid.cellsY; cy += 1) {
      for (let cx = 0; cx < grid.cellsX; cx += 1) {
        const cell = ds1.cells[cy]?.[cx]
        const hasFloor = cell !== undefined && cell.floors.some(f => !f.hidden && f.prop1 !== 0)
        if (!hasFloor) {
          for (let sy = 0; sy < SUB_TILES_PER_TILE; sy += 1) {
            const row = (cy * SUB_TILES_PER_TILE + sy) * grid.gridWidth + cx * SUB_TILES_PER_TILE
            maskedBlocked.fill(1, row, row + SUB_TILES_PER_TILE)
          }
        }
      }
    }
    regionGrid = {
      cellsX: grid.cellsX,
      cellsY: grid.cellsY,
      gridWidth: grid.gridWidth,
      gridHeight: grid.gridHeight,
      blocked: maskedBlocked,
    }
  }
  const region = largestWalkableRegion(regionGrid)


  const warpEdgeTo = new Map<number, WorldEdge>()
  /** `Warp0..7` slot -> the edge that slot crosses. */
  const warpEdgeBySlot = new Map<number, WorldEdge>()
  for (const edge of edgesFrom(worldGraph, levelId)) {
    if (edge.kind !== 'warp') continue
    warpEdgeTo.set(edge.to, edge)
    for (const slot of edge.warpSlots) warpEdgeBySlot.set(slot, edge)
  }

  /**
   * Maximum number of simultaneous warp instances from `levelId` to `toLevelId`:
   * in Levels.txt, 4-orientation cave mouths use 4 distinct `Warp` IDs (so only 1
   * is placed per seed), whereas levels with multiple coexisting entrances to the
   * same destination (such as Kurast Bazaar 80 -> Sewers 92 and Upper Kurast 81 ->
   * Sewers 92) repeat the same `(Vis, Warp)` pair across multiple slots.
   */
  const levelRow = worldGraph.levels.get(levelId)
  const placedWarpCounts = new Map<number, number>()
  const maxWarpsTo = (toLevelId: number): number => {
    if (levelRow === undefined) return 1
    if (levelRow.drlgType !== 3) {
      let count = 0
      for (let slot = 0; slot < 8; slot += 1) {
        if ((levelRow.vis[slot] ?? 0) === toLevelId) count += 1
      }
      return Math.max(1, count)
    }
    const byWarpId = new Map<number, number>()
    let maxCount = 1
    for (let slot = 0; slot < 8; slot += 1) {
      if ((levelRow.vis[slot] ?? 0) !== toLevelId) continue
      const warpId = levelRow.warp[slot] ?? -1
      const next = (byWarpId.get(warpId) ?? 0) + 1
      byWarpId.set(warpId, next)
      if (next > maxCount) maxCount = next
    }
    return maxCount
  }

  /** Which way a crossing leads, for the runtime's benefit. */
  const here = townDistance.get(levelId) ?? Number.MAX_SAFE_INTEGER
  const directionTo = (toLevelId: number): SceneWarp['direction'] =>
    (townDistance.get(toLevelId) ?? Number.MAX_SAFE_INTEGER) < here ? 'up' : 'down'

  // 1. The staircases the artwork declares. Authoritative for every kind of
  //    level, because the slot identifies the destination outright. Skipped
  //    when the generator reports its warps exactly: the DRLG port hands over
  //    the UNIT_TILE warp units D2 itself creates for them.
  for (const tile of exactLinks ? [] : findWarpTiles(ds1)) {
    const edge = warpEdgeBySlot.get(tile.slot)
    if (edge === undefined) continue
    if (placedWarps.has(edge.to)) continue
    outWarps.push(makeWarp(edge, directionTo(edge.to), tile.cellX, tile.cellY, grid, 'tile', region))
    placedWarps.add(edge.to)
  }

  // 2. DRLG levels: the generator already cut the seams, and knows where the
  //    interior presets and warp units it stamped sit.
  for (const anchor of entrances) {
    const span = 'span' in anchor ? anchor.span : undefined
    if (anchor.kind === 'gate' && anchor.side !== null && anchor.toLevelId >= 0 && span !== undefined) {
      const range = { from: span.from * SUB_TILES_PER_TILE, to: span.to * SUB_TILES_PER_TILE }
      const opening = findBorderOpening(grid, anchor.side, region, undefined, range)
      if (opening === null) {
        throw new Error(`level ${String(levelId)}: no reachable opening on the ${anchor.side} edge in tiles `
          + `${String(span.from)}..${String(span.to)} for the seam to level ${String(anchor.toLevelId)}`)
      }
      if (placedSeams.has(anchor.toLevelId)) {
        throw new Error(`level ${String(levelId)}: two seams lead to level ${String(anchor.toLevelId)}`)
      }
      outEntrances.push({
        toLevelId: anchor.toLevelId,
        side: anchor.side,
        label: anchor.label,
        x: opening.x,
        y: opening.y,
        arriveX: opening.arriveX,
        arriveY: opening.arriveY,
      })
      placedSeams.add(anchor.toLevelId)
      continue
    }
    if (anchor.kind === 'gate') {
      throw new Error(`level ${String(levelId)}: seam to level ${String(anchor.toLevelId)} has no side and span`)
    }
    // A preset's mouth: the cave, tower or crypt that opens off this level.
    const edge = anchor.toLevelId < 0 ? undefined : warpEdgeTo.get(anchor.toLevelId)
    const warp = 'warp' in anchor ? anchor.warp : undefined
    const currentWarpCount = edge === undefined ? 0 : (placedWarpCounts.get(edge.to) ?? 0)
    const allowedWarps = edge === undefined ? 1 : maxWarpsTo(edge.to)
    if (exactLinks) {
      if (edge === undefined) {
        throw new Error(`level ${String(levelId)}: the generator has a warp to level ${String(anchor.toLevelId)}, the world graph does not`)
      }
      if (currentWarpCount >= allowedWarps) {
        throw new Error(`level ${String(levelId)}: more than ${String(allowedWarps)} warp(s) lead to level ${String(anchor.toLevelId)}`)
      }
      if (warp === undefined) {
        throw new Error(`level ${String(levelId)}: warp to level ${String(anchor.toLevelId)} has no warp unit position`)
      }
    }
    if (edge === undefined || currentWarpCount >= allowedWarps) continue
    outWarps.push(makeWarp(edge, 'in', anchor.x, anchor.y, grid, 'tile', region,
      warp === undefined ? undefined : { x: warp.subX, y: warp.subY }))
    placedWarps.add(anchor.toLevelId)
    placedWarpCounts.set(edge.to, currentWarpCount + 1)
  }

  /**
   * In Act 3 Jungle, DRLGOUTPLACE_InitAct3OutdoorLevel connects Flayer Jungle (78) to either
   * Great Marsh (77, linear: 76<->77<->78) or directly to Spider Forest (76, branching: 76<->77
   * dead-end and 76<->78). Whichever of those two alternative seams is not active on this seed
   * is not expected on this copy.
   */
  const isInactiveJungleSeam = (toLevelId: number): boolean => {
    if (levelId === 76 && toLevelId === 78) return placedSeams.has(77)
    if (levelId === 77 && toLevelId === 78) return placedSeams.has(76)
    if (levelId === 78 && toLevelId === 76) return placedSeams.has(77)
    if (levelId === 78 && toLevelId === 77) return placedSeams.has(76)
    return false
  }

  if (exactLinks) {
    // The generator's links and the world graph are two readings of the same
    // Levels.txt rows (Vis0..7 / Warp0..7); any difference is a bug in one of
    // them, never something to paper over with a guessed opening.
    for (const edge of edgesFrom(worldGraph, levelId)) {
      if (edge.kind === 'seamless' && !placedSeams.has(edge.to) && !isInactiveJungleSeam(edge.to)) {
        throw new Error(`level ${String(levelId)}: the world graph has a seam to level ${String(edge.to)}, the generator does not`)
      }
      if (edge.kind === 'warp' && !placedWarps.has(edge.to)) {
        throw new Error(`level ${String(levelId)}: the world graph has a warp to level ${String(edge.to)}, the generator does not`)
      }
    }
    for (const to of placedSeams) {
      if (!edgesFrom(worldGraph, levelId).some(edge => edge.kind === 'seamless' && edge.to === to)) {
        throw new Error(`level ${String(levelId)}: the generator has a seam to level ${String(to)}, the world graph does not`)
      }
    }
  }

  // 4. Seams nobody cut: read them off the artwork's walkable border.
  const loneSeams = [...edgesFrom(worldGraph, levelId)]
    .filter(edge => edge.kind === 'seamless' && !placedSeams.has(edge.to) && !isInactiveJungleSeam(edge.to))
  for (const edge of loneSeams) {
    const wanted = edge.sideFrom
    const measured = new Map<Side, BorderOpening>()
    for (const side of SIDES) {
      const found = findBorderOpening(grid, side, region)
      if (found !== null) measured.set(side, found)
    }

    const asked = wanted === null ? undefined : measured.get(wanted)
    let side: Side | null = asked === undefined ? null : wanted
    let opening = asked

    const atBorder = [...measured].filter(([, found]) => found.inset === 0)
    if (loneSeams.length === 1 && atBorder.length > 0 && (asked === undefined || asked.inset > 0)) {
      const [bestSide, bestOpening] = atBorder
        .reduce((best, next) => (next[1].width > best[1].width ? next : best))
      side = bestSide
      opening = bestOpening
    }

    if (opening === undefined || side === null) {
      const any = [...measured].sort((a, b) => a[1].inset - b[1].inset)[0]
      if (any === undefined) {
        unplaced.push({ toLevelId: edge.to, reason: 'every edge is solid' })
        continue
      }
      side = any[0]
      opening = any[1]
    }

    outEntrances.push({
      toLevelId: edge.to,
      side,
      label: `${levelNameOf(edge.to)} Gate`,
      x: opening.x,
      y: opening.y,
      arriveX: opening.arriveX,
      arriveY: opening.arriveY,
    })
    placedSeams.add(edge.to)
  }

  const reported = new Set(unplaced.map(hole => hole.toLevelId))
  for (const edge of edgesFrom(worldGraph, levelId)) {
    if (edge.kind === 'seamless' && !placedSeams.has(edge.to) && !reported.has(edge.to) && !isInactiveJungleSeam(edge.to)) {
      unplaced.push({ toLevelId: edge.to, reason: 'seam not cut by the generator' })
    }
  }

  // Waypoints. The DRLG port's levels always place the waypoint object in the level,
  // so a missing or unreachable waypoint is a bug and throws.
  const waypointId = worldGraph.levels.get(levelId)?.waypoint ?? 255
  const waypoints: SceneWaypoint[] = []
  // Level 134 (LEVEL_PANDEMONIUMRUN2, Forgotten Sands) stamps LVLPREST_ACT2_DESERT_VALLEY_WARP
  // in DRLGOUTDESR_InitAct2OutdoorLevel (D2Common.0x6FDD58A0), which carries the Canyon of the
  // Magi waypoint DS1 object even though Forgotten Sands has Waypoint=255 in Levels.txt.
  if (exactLinks && waypointId === 255 && waypointCells.length > 0 && levelId !== 134) {
    throw new Error(`level ${String(levelId)}: the generator placed a waypoint, Levels.txt has none`)
  }
  if (waypointId !== 255) {
    if (exactLinks && waypointCells.length !== 1) {
      throw new Error(`level ${String(levelId)}: the generator placed ${String(waypointCells.length)} waypoints for waypoint ${String(waypointId)}`)
    }
    const fromArt = waypointCells[0]
    const spot = fromArt ?? findWaypointSpot(grid, region)
    if (spot !== null && spot !== undefined) {
      const reached = nearestWalkable(grid, spot.x + 2, spot.y + 2, 16, region)
      if (exactLinks && reached === null) {
        throw new Error(`level ${String(levelId)}: waypoint at ${String(spot.x)},${String(spot.y)} is not next to the main walkable region`)
      }
      const arrive = reached ?? spot
      waypoints.push({
        waypointId,
        x: spot.x,
        y: spot.y,
        arriveX: arrive.x,
        arriveY: arrive.y,
        source: fromArt === undefined ? 'placed' : 'object',
      })
    }
  }

  return { entrances: outEntrances, warps: outWarps, waypoints, unplacedEdges: unplaced, notes }
}

/**
 * Decoded DT1 libraries, keyed by member name.
 *
 * Expanded cache limit (256): Diablo II references 242 unique DT1 files across
 * all 1,651 level references. Expanding LIBRARY_CACHE_LIMIT to 256 accommodates all
 * unique DT1 files without eviction across all acts and levels, eliminating 903
 * redundant evictions and 677 re-decodes.
 */
const libraryCache = new Map<string, Dt1>()
/** Most DT1 libraries to keep decoded at once (accommodates all 242 unique DT1s across all levels). */
const LIBRARY_CACHE_LIMIT = 256

/**
 * Decode a DT1 library, cached by member name.
 *
 * @param member - archive member name.
 * @returns the decoded library.
 */
async function libraryOf(member: string): Promise<Dt1> {
  const cached = libraryCache.get(member)
  if (cached !== undefined) return cached
  const mounted = await ensureArchives()
  const decoded = decodeDt1(await mounted.read(member))
  libraryCache.set(member, decoded)
  if (libraryCache.size > LIBRARY_CACHE_LIMIT) {
    // `Map` iterates in insertion order, so the first key is the oldest entry.
    const oldest = libraryCache.keys().next().value
    if (oldest !== undefined && oldest !== member) libraryCache.delete(oldest)
  }
  return decoded
}

const COMPONENT_PREFERENCE = ['tr', 'hd', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'lg', 'ra', 'la', 'rh', 'lh', 'sh'] as const

function compRank(path: string): number {
  const parts = path.toLowerCase().split('\\')
  const comp = parts[4] ?? ''
  const idx = COMPONENT_PREFERENCE.indexOf(comp as (typeof COMPONENT_PREFERENCE)[number])
  return idx >= 0 ? idx : 99
}

/**
 * Pick the member that stands in for an object's art.
 *
 * @param token - object token from the lookup table.
 * @param modeToken - animation mode token the engine places the object in (`NU`/`OP`/…).
 * @returns the member name and how many candidates there were.
 */
function pickObjectMember(token: string, modeToken: string, baseIsMonsters = false): { member: string; candidates: number } | null {
  const map = baseIsMonsters ? monsterMembers : objectMembers
  const dirs = map.get(token.toUpperCase())
  if (dirs === undefined) return null
  const all = [...dirs.values()].flat().filter(name => {
    const lower = name.toLowerCase()
    return lower.endsWith('.dcc') || lower.endsWith('.dc6')
  })
  const candidates = all.length
  if (candidates === 0) return null
  const wanted = modeToken.trim().toLowerCase() === '' ? 'nu' : modeToken.trim().toLowerCase()
  const order = [wanted, ...OBJECT_MODES.map(mode => mode.toLowerCase()).filter(mode => mode !== wanted)]
  for (const mode of order) {
    const files = all
      .filter(name => {
        const base = (name.split('\\').pop() ?? '').toLowerCase()
        return base.includes(mode) || (mode !== 'nu' && base.includes(`lit${mode}`))
      })
      .sort((a, b) => {
        const aDcc = a.toLowerCase().endsWith('.dcc') ? 0 : 1
        const bDcc = b.toLowerCase().endsWith('.dcc') ? 0 : 1
        if (aDcc !== bDcc) return aDcc - bDcc
        const aRank = compRank(a)
        const bRank = compRank(b)
        if (aRank !== bRank) return aRank - bRank
        return a.localeCompare(b)
      })
    if (files.length > 0) return { member: files[0]!, candidates }
  }
  // No file carries the mode token: fall back to any member, deterministically.
  const fallback = [...all].sort((a, b) => {
    const aDcc = a.toLowerCase().endsWith('.dcc') ? 0 : 1
    const bDcc = b.toLowerCase().endsWith('.dcc') ? 0 : 1
    if (aDcc !== bDcc) return aDcc - bDcc
    const aRank = compRank(a)
    const bRank = compRank(b)
    if (aRank !== bRank) return aRank - bRank
    return a.localeCompare(b)
  })[0]
  return fallback === undefined ? null : { member: fallback, candidates }
}

interface DecodedMemberFrame {
  frame: SpriteFrame
  offsetX: number
  offsetY: number
}

interface DecodedMemberArt {
  frames: DecodedMemberFrame[]
}

/** Cache decoded member frames across levels so each unique member is decoded once. */
const decodedMemberCache = new Map<string, DecodedMemberArt>()

/** Cache additive blend determination for object COFs. */
const cofAdditiveCache = new Map<string, boolean>()

async function isObjectCofAdditive(token: string, modeIndex: number, baseIsMonsters: boolean): Promise<boolean> {
  if (token === '') return false
  const member = objectCofMember(token, modeIndex >= 0 ? modeIndex : 0, baseIsMonsters)
  const cached = cofAdditiveCache.get(member)
  if (cached !== undefined) return cached
  try {
    const mounted = await ensureArchives()
    const bytes = await mounted.read(member)
    const cof = decodeCof(bytes)
    const additive = cof.layers.some(l => resolveCofLayerDrawMode(l) === 'additive')
    cofAdditiveCache.set(member, additive)
    return additive
  } catch {
    cofAdditiveCache.set(member, false)
    return false
  }
}

async function getPalette(paletteName: string): Promise<Uint8Array> {
  const cached = paletteCache.get(paletteName)
  if (cached !== undefined) return cached
  const mounted = await ensureArchives()
  const pl2 = decodePl2(await mounted.read(paletteName))
  paletteCache.set(paletteName, pl2.rgb)
  return pl2.rgb
}

interface SceneJob {
  readonly jobId: number
  readonly entry: LevelJob
  readonly type: 'drlg'
  /** The 0-based act copy (`actVariant`) for 'drlg'. */
  readonly variant: number
  readonly label: string
  readonly seed: number
  /** The level as the main thread's DRLG run of the act copy generated it. */
  readonly drlg: { readonly gameSeed: number; readonly input: DrlgLevelInput }
}

interface SceneResult {
  readonly jobId: number
  readonly indexEntry: Record<string, unknown>
  readonly pngBytes: number
  readonly sceneBytes: number
  readonly skippedArtlessSpawns: number
  readonly skippedMissingArtSpawns: number
  readonly missingTiles: number
  readonly missingRefs: unknown
  readonly logLine: string
}

async function bakeDs1Variant(
  jobId: number,
  entry: LevelJob,
  levelName: string,
  palette: Uint8Array,
  paletteName: string,
  dt1Names: readonly string[],
  libraries: Dt1[],
  level: Ds1,
  ds1Name: string,
  label: string,
  seed: number,
  generatorLinks: {
    readonly entrances: readonly GeneratorEntrance[]
    readonly landmarks?: readonly { readonly id: string; readonly tileX: number; readonly tileY: number }[]
    readonly notes?: readonly string[] | undefined
    readonly animSpeed?: number | undefined
    /** The generator reports every seam and warp exactly (see buildSceneLinks). */
    readonly exactLinks?: boolean
    /**
     * `'exact'`: every room, tile (style, sequence, type, DT1 library, and variant) and preset unit
     * is D2's own (the DRLG port).
     * `'layout'`: only the variant within a tile's (style, sequence) is the renderer's pick.
     * Unset: the generator approximates the level.
     */
    readonly fidelity?: 'exact' | 'layout'
  } = { entrances: [] },
  animSpeedOverride?: number,
): Promise<SceneResult> {
  let localSkippedArtless = 0
  let localSkippedMissingArt = 0
  const animSpeed = animSpeedOverride ?? generatorLinks.animSpeed
  const frameDurationMs = frameDurationMsFromAnimSpeed(animSpeed)
  const levelRow = tables.levels.rows.find(candidate => Number(cell(tables.levels, candidate, 'Id')) === entry.levelId)!
  const levelTypeId = Number(cell(tables.levels, levelRow, 'LevelType'))
  const layerId = Number(cell(tables.levels, levelRow, 'Layer'))
  if (!tables.automap) {
    throw new Error('pack-act-assets: tables.automap is missing')
  }
  const scene: IsoMapScene = buildIsoMapScene(level, libraries, seed, {
    automapTable: tables.automap,
    levelTypeId,
    levelId: entry.levelId,
    act: entry.act,
    layerId,
    ds1Name,
    objectsTable: objectsTableTyped,
    monstersTable,
    monstats2ById,
  })

  /**
   * Waypoint pedestals found in the artwork, in sub-tiles.
   */
  const waypointCells: { x: number; y: number }[] = []
  for (const object of level.objects) {
    try {
      const resolved = resolveDs1Object(objectsTableTyped, object.act ?? entry.act, object.type, object.id, monstersTable)
      const resolvedName = resolved.name ?? resolved.row?.name ?? resolved.token
      const isWp = isWaypointObjectsTxtId(resolved.entry?.objectsTxtId ?? resolved.row?.id)
        || WAYPOINT_TOKENS.has(resolved.token.toUpperCase())
        || resolved.token.toLowerCase() === 'wp'
        || /waypoint/i.test(resolvedName)
      if (isWp) {
        waypointCells.push({ x: object.x, y: object.y })
      }
    } catch {
      // Unresolved objects handled in main loop below
    }
  }

  const sceneLinks = buildSceneLinks(
    entry.levelId,
    entry.kind,
    level,
    scene,
    generatorLinks.entrances,
    waypointCells,
    { exactLinks: generatorLinks.exactLinks === true },
  )

  if (sceneLinks.waypoints.some(wp => wp.source !== 'object')) {
    throw new Error(`${label} (level ${String(entry.levelId)}): waypoint resolved to fallback source instead of authentic DS1 object`)
  }

  const spawn = findIsoSpawn(scene, { warps: sceneLinks.warps, entrances: sceneLinks.entrances })
  const dir = join(outDir, `act${String(entry.act)}`, label)

  // Frames used near the spawn load first; everything else follows.
  const hot = new Set<number>()
  if (spawn !== null) {
    const spawnCell = cellAt(scene, spawn.x, spawn.y)
    for (const draw of [...scene.floors, ...scene.shadows, ...scene.walls, ...scene.roofs]) {
      const distance = Math.abs(draw.cellX - spawnCell.x) + Math.abs(draw.cellY - spawnCell.y)
      if (distance <= HOT_RADIUS_CELLS) {
        hot.add(draw.frameIndex)
        if (draw.animatedFrames) {
          for (const f of draw.animatedFrames) hot.add(f)
        }
      }
    }
  }

  const firstDrawAt = new Map<number, { x: number; y: number }>()
  for (const draw of [...scene.floors, ...scene.shadows, ...scene.walls, ...scene.roofs]) {
    if (!firstDrawAt.has(draw.frameIndex)) firstDrawAt.set(draw.frameIndex, { x: draw.x, y: draw.y })
    if (draw.animatedFrames) {
      for (const f of draw.animatedFrames) {
        if (!firstDrawAt.has(f)) firstDrawAt.set(f, { x: draw.x, y: draw.y })
      }
    }
  }
  const bandOf = (frameIndex: number): number => {
    const at = firstDrawAt.get(frameIndex)
    if (at === undefined) return Number.MAX_SAFE_INTEGER
    return Math.floor(at.y / 512) * 4096 + Math.floor(at.x / 768)
  }
  const order = scene.frames.map((_, at) => at).sort((a, b) => {
    const ha = hot.has(a) ? 0 : 1
    const hb = hot.has(b) ? 0 : 1
    if (ha !== hb) return ha - hb
    const ba = bandOf(a)
    const bb = bandOf(b)
    if (ba !== bb) return ba - bb
    const fa = scene.frames[a]!
    const fb = scene.frames[b]!
    return fb.width * fb.height - fa.width * fa.height
  })
  const pages = new PageBuilder(palette)
  const placementOf = new Map<number, Placement>()
  for (const frameIndex of order) {
    const frame = scene.frames[frameIndex]!
    placementOf.set(frameIndex, pages.add(frame))
  }
  const pageFiles = pages.encode(0)
  await mkdir(dir, { recursive: true })
  for (const existing of await readdir(dir)) {
    if (existing.endsWith('.png')) {
      await unlink(join(dir, existing))
    }
  }
  const sha = createHash('sha256')
  for (const page of pageFiles) {
    await writeFile(join(dir, page.name), page.png)
    sha.update(page.png)
  }

  const objectPages = new PageBuilder(palette)
  const objects: unknown[] = []
  const npcs: unknown[] = []
  const missingObjects: string[] = []
  let objectsWithArt = 0
  interface PlacedMemberFrame {
    placement: Placement
    offsetX: number
    offsetY: number
  }
  const placementByMember = new Map<string, { frames: PlacedMemberFrame[] }>()

  for (const object of level.objects) {
    let resolved
    try {
      resolved = resolveDs1Object(objectsTableTyped, object.act ?? entry.act, object.type, object.id, monstersTable)
    } catch (err) {
      missingObjects.push((err as Error).message)
      continue
    }
    if (resolved.kind === 'monster') continue
    if (resolved.kind === 'npc' && object.type === 1 && resolved.artless) {
      localSkippedArtless += 1
      continue
    }
    const row = resolved.row
    const pick = resolved.token === '' ? null : pickObjectMember(resolved.token, resolved.mode, resolved.kind === 'npc')
    if (pick === null && resolved.kind === 'npc' && object.type === 1) {
      localSkippedMissingArt += 1
      continue
    }
    const orthoX = (object.x - object.y) * ORTHO_SUB_TILE_WIDTH + scene.originX
    const orthoY = (object.x + object.y) * ORTHO_SUB_TILE_HEIGHT + scene.originY

    let objectFrame: {
      page: number
      x: number
      y: number
      width: number
      height: number
      offsetX: number
      offsetY: number
    } | null = null
    let animatedFrames: {
      page: number
      x: number
      y: number
      width: number
      height: number
      offsetX: number
      offsetY: number
    }[] | undefined = undefined

    if (pick !== null) {
      let placed = placementByMember.get(pick.member)
      if (placed === undefined) {
        let art = decodedMemberCache.get(pick.member)
        if (art === undefined) {
          try {
            const mounted = await ensureArchives()
            const bytes = await mounted.read(pick.member)
            if (pick.member.toLowerCase().endsWith('.dc6')) {
              const sheet = decodeDc6(bytes)
              const group = sheet.groups[0]
              if (group && group.frames.length > 0) {
                const frames: DecodedMemberFrame[] = group.frames.map(f => ({
                  frame: f,
                  offsetX: -16 + f.offsetX,
                  offsetY: 16 + (f.offsetY - f.height + 1),
                }))
                art = { frames }
              }
            } else {
              const dcc = decodeDcc(bytes)
              const dir = dcc.directions[0]
              if (dir && dir.frames.length > 0) {
                const frames: DecodedMemberFrame[] = dir.frames.map(f => ({
                  frame: f.frame,
                  offsetX: -16 + dir.box.left,
                  offsetY: 16 + dir.box.top,
                }))
                art = { frames }
              }
            }
            if (art) decodedMemberCache.set(pick.member, art)
          } catch (err) {
            console.warn(`failed to decode object member ${pick.member}: ${(err as Error).message}`)
          }
        }
        if (art && art.frames.length > 0) {
          const placedFrames: PlacedMemberFrame[] = art.frames.map(item => ({
            placement: objectPages.add(item.frame),
            offsetX: item.offsetX,
            offsetY: item.offsetY,
          }))
          placed = { frames: placedFrames }
          placementByMember.set(pick.member, placed)
        }
      }
      if (placed && placed.frames.length > 0) {
        const f0 = placed.frames[0]!
        objectFrame = {
          page: f0.placement.page,
          x: f0.placement.x,
          y: f0.placement.y,
          width: f0.placement.width,
          height: f0.placement.height,
          offsetX: f0.offsetX,
          offsetY: f0.offsetY,
        }
        if (placed.frames.length > 1) {
          animatedFrames = placed.frames.map(f => ({
            page: f.placement.page,
            x: f.placement.x,
            y: f.placement.y,
            width: f.placement.width,
            height: f.placement.height,
            offsetX: f.offsetX,
            offsetY: f.offsetY,
          }))
        }
      }
    }

    const list = resolved.kind === 'npc' ? npcs : objects
    let resolvedName = resolved.name ?? row?.name ?? resolved.token
    const isWp = isWaypointObjectsTxtId(resolved.entry?.objectsTxtId ?? row?.id)
      || WAYPOINT_TOKENS.has(resolved.token.toUpperCase())
      || resolved.token.toLowerCase() === 'wp'
      || /waypoint/i.test(resolvedName)
    if (isWp) {
      waypointCells.push({ x: object.x, y: object.y })
      if (resolvedName === 'Dummy') {
        resolvedName = 'Waypoint'
      }
    }

    const modeToken = resolved.mode === '' ? 'NU' : resolved.mode
    const modeIndex = OBJECT_MODE_TOKENS.indexOf(modeToken as any)
    let frameDelta = 256
    let cycleAnim = true
    let sync = false
    if (row !== null && modeIndex >= 0) {
      const delta = row.frameDelta[modeIndex] ?? 0
      if (delta > 0) frameDelta = delta
      cycleAnim = (row.cycleAnim[modeIndex] ?? 1) !== 0
      sync = (row.sync ?? 0) === 1
    }
    const tokenUpper = resolved.token.trim().toUpperCase()
    if (PERSISTENT_ILLUMINATION_TOKENS.has(tokenUpper)) {
      cycleAnim = true
      if (frameDelta <= 0) frameDelta = 256
    }
    const frameDurationMs = Math.round((256 / frameDelta) * 40 * 100) / 100

    const isCofAdditive = await isObjectCofAdditive(resolved.token, modeIndex, resolved.kind === 'npc')
    const isAdditive = (row !== null && (row.trans === 7 || row.trans === 1)) ||
      isCofAdditive ||
      ADDITIVE_OBJECT_TOKENS.has(tokenUpper) ||
      resolved.blendMode === 'additive'

    list.push({
      id: object.id,
      type: object.type,
      name: resolvedName,
      token: resolved.token,
      mode: modeToken,
      objectsTxtId: resolved.entry?.objectsTxtId ?? -1,
      trans: row?.trans ?? 0,
      blendMode: isAdditive ? 'additive' : 'normal',
      hp: row === null ? 0 : (objectById.get(row.id)?.hp ?? 0),
      member: pick === null ? null : pick.member,
      alternatives: pick === null ? 0 : pick.candidates,
      x: Math.round(orthoX),
      y: Math.round(orthoY),
      depth: (object.x + object.y) / 5,
      frame: objectFrame,
      ...(animatedFrames ? {
        animatedFrames,
        frameDelta,
        frameDurationMs,
        cycleAnim,
        sync,
      } : {}),
    })
    if (pick !== null) objectsWithArt += 1
    else if (!resolved.artless) missingObjects.push(`${resolved.token === '' ? `id ${String(object.id)}` : resolved.token} (act ${String(object.act ?? entry.act)}) has no art members`)
  }

  const objectFiles = objectPages.encode(0)
  const shaObjects = createHash('sha256')
  for (const page of objectFiles) {
    const name = page.name.replace('tiles-', 'objects-')
    await writeFile(join(dir, name), page.png)
    shaObjects.update(page.png)
  }

  // Collision grid as runs, so the JSON stays small without a second format.
  const runs: number[][] = []
  let current = scene.blocked[0] ?? 0
  let count = 0
  for (const value of scene.blocked) {
    if (value === current) { count += 1; continue }
    runs.push([current, count])
    current = value
    count = 1
  }
  runs.push([current, count])

  const population = planLevelMonsters(
    tables,
    entry.levelId,
    scene.cellsX * scene.cellsY,
    seed,
    PLAYER_WALK_SPEED_PX,
    'normal',
    generatorLinks.landmarks ? { landmarks: generatorLinks.landmarks } : undefined,
  )


  const serializeDraw = (draw: IsoDraw): number[] => {
    if (draw.animatedFrames && draw.animatedFrames.length > 1) {
      return [draw.frameIndex, draw.x, draw.y, draw.cellX, draw.cellY, ...draw.animatedFrames]
    }
    return [draw.frameIndex, draw.x, draw.y, draw.cellX, draw.cellY]
  }

  const fidelity = entry.kind === 'preset' ? 'exact' : generatorLinks.fidelity ?? 'exact'
  const sceneJson = {
    version: 1,
    fidelity,
    act: entry.act,
    levelId: entry.levelId,
    levelName,
    ds1: ds1Name,
    ...(animSpeed !== undefined ? { animSpeed } : {}),
    frameDurationMs,
    cellsX: scene.cellsX,
    cellsY: scene.cellsY,
    originX: scene.originX,
    originY: scene.originY,
    widthPx: scene.widthPx,
    heightPx: scene.heightPx,
    pageSize: PAGE_SIZE,
    pages: pageFiles.map(page => ({ file: page.name, width: page.width, height: page.height })),
    objectPages: objectFiles.map(page => ({ file: page.name.replace('tiles-', 'objects-'), width: page.width, height: page.height })),
    frames: scene.frames.map(frame => [frame.width, frame.height]),
    frameHash: scene.frames.map(frame => frameHash(frame.indices)),
    framePlacement: scene.frames.map((_, at) => {
      const place = placementOf.get(at)!
      return [place.page, place.x, place.y, place.width, place.height]
    }),
    floors: scene.floors.map(serializeDraw),
    shadows: scene.shadows.map(serializeDraw),
    walls: scene.walls.map(serializeDraw),
    roofs: scene.roofs.map(serializeDraw),
    objects,
    npcs,
    monsters: {
      types: population.types,
      budget: population.budget,
      packs: population.packs,
    },
    collision: { width: scene.gridWidth, height: scene.gridHeight, runs },
    spawn: spawn === null ? null : [Math.round(spawn.x), Math.round(spawn.y)],
    entrances: sceneLinks.entrances,
    warps: sceneLinks.warps,
    waypoints: sceneLinks.waypoints,
    automap: scene.automap,
    stats: {
      floors: scene.floors.length,
      shadows: scene.shadows.length,
      walls: scene.walls.length,
      roofs: scene.roofs.length,
      frames: scene.frames.length,
      missingTiles: scene.missingTiles,
      missingRefs: scene.missingRefs,
      walkable: 1 - [...scene.blocked].reduce((sum, value) => sum + value, 0) / scene.blocked.length,
      objects: objects.length,
      npcs: npcs.length,
      monsters: population.packs.reduce((sum, pack) => sum + pack.members.length, 0),
      monsterPacks: population.packs.length,
      objectsWithArt,
      objectsUnresolved: missingObjects,
      objectsArtPending: (objects as any[]).filter(o => o.member !== null && o.frame === null).length,
      dt1Libraries: dt1Names.length,
      unplacedEdges: sceneLinks.unplacedEdges,
      notes: [
        ...(generatorLinks.notes ?? []),
        ...(sceneLinks.notes ?? []),
      ],
    },
  }
  const sceneBytes = new TextEncoder().encode(JSON.stringify(sceneJson))
  await writeFile(join(dir, 'scene.json'), sceneBytes)
  const manifest = {
    level: levelName,
    act: entry.act,
    levelId: entry.levelId,
    ds1: ds1Name,
    dt1: dt1Names,
    palette: paletteName,
    sceneBytes: sceneBytes.byteLength,
    sceneSha256: createHash('sha256').update(sceneBytes).digest('hex'),
    tilePagesSha256: sha.digest('hex'),
    objectPagesSha256: shaObjects.digest('hex'),
    pngBytes: pageFiles.reduce((sum, page) => sum + page.png.byteLength, 0)
      + objectFiles.reduce((sum, page) => sum + page.png.byteLength, 0),
    sourceArchive: MOUNTS,
  }
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1))
  const indexEntry = {
    act: entry.act,
    levelId: entry.levelId,
    kind: entry.kind,
    fidelity,
    slug: entry.slug,
    label,
    levelName,
    ds1: ds1Name,
    path: `act${String(entry.act)}/${label}`,
    cells: `${String(scene.cellsX)}x${String(scene.cellsY)}`,
    frames: scene.frames.length,
    objects: objects.length,
    npcs: npcs.length,
    pages: pageFiles.length,
    objectPages: objectFiles.length,
    missingTiles: scene.missingTiles,
    entrances: sceneLinks.entrances.length,
    warps: sceneLinks.warps.length,
    waypoints: sceneLinks.waypoints.length,
    unplacedEdges: sceneLinks.unplacedEdges.length,
    bytes: manifest.pngBytes + sceneBytes.byteLength,
  }

  const bakedFramesCount = (objects as any[]).filter(o => o.frame !== null).length
  const pendingCount = (objects as any[]).filter(o => o.member !== null && o.frame === null).length
  const logLine =
    `act${String(entry.act)}/${label.padEnd(35)} `
    + `${String(scene.cellsX)}x${String(scene.cellsY)} `
    + `${String(scene.frames.length).padStart(3)} 图块 → ${String(pageFiles.length)} 页 PNG `
    + `(${(manifest.pngBytes / 1024).toFixed(0)} KB) + scene.json ${(sceneBytes.byteLength / 1024).toFixed(0)} KB `
    + `· 对象 ${String(objects.length)}/${String(level.objects.length)}（已接帧：${String(bakedFramesCount)}，待解：${String(pendingCount)}）`
    + ` · 缺失瓦片 ${String(scene.missingTiles)}`

  return {
    jobId,
    indexEntry,
    pngBytes: manifest.pngBytes,
    sceneBytes: sceneBytes.byteLength,
    skippedArtlessSpawns: localSkippedArtless,
    skippedMissingArtSpawns: localSkippedMissingArt,
    missingTiles: scene.missingTiles,
    missingRefs: scene.missingRefs,
    logLine,
  }
}

/**
 * Execute a single scene baking task.
 *
 * @param job - the scene job parameters.
 * @returns the bake result for deterministic index assembly.
 */
async function bakeSceneJob(job: SceneJob): Promise<SceneResult> {
  if (!tablesInitialized) {
    await initMainThreadTables()
  }
  const levelRow = tables.levels.rows.find(candidate => Number(cell(tables.levels, candidate, 'Id')) === job.entry.levelId)!
  const paletteIndex = Number(cell(tables.levels, levelRow, 'Pal'))
  const paletteName = `data\\global\\palette\\act${String(paletteIndex + 1)}\\pal.pl2`
  const palette = await getPalette(paletteName)

  if (job.type === 'drlg') {
    const drlg = job.drlg
    const t = await drlgTables()
    // The libraries of the tiles D2 picked, for their (style, sequence, type) headers.
    const dt1 = new Map<string, Dt1>()
    for (const tile of drlg.input.tiles) {
      if (tile.tile !== null && !dt1.has(tile.tile.library)) dt1.set(tile.tile.library, await libraryOf(tile.tile.library))
    }
    const superUniqueIds = (superUniqueIdsCache ??= drlgSuperUniqueIds(tables.superuniques, t))
    const map = buildDrlgLevelMap(drlg.input, { tables: t, dt1, superUniqueIds })
    const libraries: Dt1[] = []
    for (const name of map.dt1Names) libraries.push(await libraryOf(name))
    const entrances: GeneratorEntrance[] = map.entrances.map(entrance => ({
      ...entrance,
      label: entrance.kind === 'gate' ? `${levelNameOf(entrance.toLevelId)} Seam` : levelNameOf(entrance.toLevelId),
    }))
    const s = map.stats
    const result = await bakeDs1Variant(
      job.jobId,
      job.entry, job.entry.name, palette, paletteName, map.dt1Names, libraries,
      map.ds1, `generated:${job.label}`, job.label, job.seed,
      {
        entrances,
        landmarks: map.landmarks,
        animSpeed: map.animSpeed,
        exactLinks: true,
        fidelity: 'exact',
        notes: [
          `DRLG port: act ${String(job.entry.act)} copy ${String(job.variant)}, game seed 0x${drlg.gameSeed.toString(16)}`,
          `DRLG tiles: ${String(s.walls)} walls, ${String(s.floors)} floors, ${String(s.shadows)} shadows, `
            + `${String(s.withoutTile)} without a DT1 tile; units: ${String(s.objects)} objects, ${String(s.monsters)} monsters`,
        ],
      },
    )
    return { ...result, indexEntry: { ...result.indexEntry, actVariant: job.variant } }
  }

  throw new Error(`Unknown job type: ${(job as { type: string }).type}`)
}

/**
 * Enumerate all scenes to bake in deterministic order across all valid levels.
 *
 * @param filterLevels - optional filter set of level IDs.
 * @param filterAct - optional filter for a specific act.
 * @param drlgActs - the DRLG-generated act copies ({@link generateDrlgActs}); their levels bake one
 *   'drlg' job per copy.
 * @returns ordered array of scene jobs with sequential jobIds (0..N-1).
 */
async function collectSceneJobs(
  filterLevels: Set<number> | null,
  filterAct: number | null,
  drlgActs: ReadonlyMap<number, readonly DrlgActCopy[]>,
): Promise<SceneJob[]> {
  const jobs: SceneJob[] = []
  let jobId = 0

  for (const entry of LEVELS) {
    if (filterLevels !== null && !filterLevels.has(entry.levelId)) continue
    if (filterAct !== null && entry.act !== filterAct) continue

    const copies = drlgActs.get(entry.act)
    if (copies === undefined || !copies.some(copy => copy.layout.levels.includes(entry.levelId))) {
      throw new Error(`level ${String(entry.levelId)} (${entry.name}) was not generated by DRLG for act ${String(entry.act)}`)
    }
    for (const copy of copies) {
      const input = copy.inputs.get(entry.levelId)
      if (input === undefined) {
        throw new Error(`act ${String(entry.act)} copy ${String(copy.layout.variant)} did not generate level ${String(entry.levelId)}`)
      }
      jobs.push({
        jobId: jobId++,
        entry,
        type: 'drlg',
        variant: copy.layout.variant,
        label: `${entry.slug}-var${String(copy.layout.variant + 1)}`,
        seed: 0x5eed_1000 + entry.levelId * 10 + copy.layout.variant + 1,
        drlg: { gameSeed: copy.layout.gameSeed, input },
      })
    }
  }

  for (const [act, copies] of drlgActs) {
    for (const levelId of copies[0]?.layout.levels ?? []) {
      if (filterLevels !== null && !filterLevels.has(levelId)) continue
      if (filterAct !== null && act !== filterAct) continue
      const baked = jobs.filter(job => job.type === 'drlg' && job.entry.levelId === levelId).length
      if (baked !== copies.length) {
        throw new Error(`DRLG level ${String(levelId)} of act ${String(act)} has ${String(baked)} bake jobs, expected ${String(copies.length)}`)
      }
    }
  }

  return jobs
}

/**
 * Write a JSON file atomically via a temporary file and rename.
 *
 * @param path - destination path.
 * @param data - JSON-serializable object.
 */
async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmpPath = `${path}.tmp.${String(process.pid)}`
  await writeFile(tmpPath, JSON.stringify(data, null, 1))
  await rename(tmpPath, path)
}

/**
 * Run scene jobs in parallel across a Node.js worker_threads pool.
 *
 * @param jobs - all scene baking jobs.
 * @param numWorkers - worker thread count.
 * @returns results array indexed by jobId.
 */
async function runWorkerPool(jobs: SceneJob[], numWorkers: number): Promise<SceneResult[]> {
  const drlgTablesData = await drlgTables()
  const superUniqueIds = (superUniqueIdsCache ??= drlgSuperUniqueIds(tables.superuniques, drlgTablesData))
  const sharedContext: WorkerSharedContext = {
    tables,
    objectsTableTyped,
    monstersTable,
    monstats2ById,
    worldGraph,
    warpGeometry,
    townDistance,
    objectById,
    objectMembers,
    monsterMembers,
    drlgTablesData,
    superUniqueIds,
    palettes: paletteCache,
  }

  return new Promise((resolve, reject) => {
    const bootstrap = `
      import { register } from 'tsx/esm/api'
      register()
      import(${JSON.stringify(import.meta.url)})
    `
    const results: SceneResult[] = new Array(jobs.length)
    const queue = [...jobs]
    let completedCount = 0
    let shuttingDown = false
    let isDone = false

    const workers: Worker[] = []

    const cleanup = () => {
      if (isDone) return
      isDone = true
      shuttingDown = true
      for (const w of workers) {
        w.terminate().catch(() => {})
      }
    }

    const abort = (err: Error) => {
      if (shuttingDown) return
      cleanup()
      reject(err)
    }

    const assignNextJob = (worker: Worker) => {
      if (shuttingDown) return
      if (queue.length > 0) {
        const nextJob = queue.shift()!
        worker.postMessage({ type: 'job', job: nextJob })
      } else if (completedCount === jobs.length) {
        cleanup()
        resolve(results)
      }
    }

    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(bootstrap, {
        eval: true,
        execArgv: ['--import', 'tsx'],
        workerData: { archiveDir, outDir, workerId: i + 1, sharedContext },
      })

      worker.on('message', (msg: { type: string; result?: SceneResult; jobId?: number; label?: string; message?: string; stack?: string }) => {
        if (shuttingDown) return
        if (msg.type === 'ready') {
          assignNextJob(worker)
        } else if (msg.type === 'result') {
          const res = msg.result!
          results[res.jobId] = res
          completedCount += 1
          console.log(`[${String(completedCount).padStart(3)}/${String(jobs.length)}] ${res.logLine}`)
          if (res.missingTiles > 0) {
            console.log('  missingRefs:', res.missingRefs)
          }
          assignNextJob(worker)
        } else if (msg.type === 'error') {
          console.error(`\n❌ Error baking scene ${msg.label ?? ''} (jobId ${String(msg.jobId ?? '')}): ${msg.message ?? ''}`)
          if (msg.stack) console.error(msg.stack)
          abort(new Error(`Worker failed on scene ${msg.label ?? ''}: ${msg.message ?? ''}`))
        }
      })

      worker.on('error', (err) => {
        console.error(`\n❌ Worker thread fatal error: ${err.message}`, err.stack)
        abort(err)
      })

      worker.on('exit', (code) => {
        if (code !== 0 && !shuttingDown) {
          abort(new Error(`Worker thread exited unexpectedly with code ${String(code)}`))
        }
      })

      workers.push(worker)
    }
  })
}

/**
 * Run scene jobs sequentially on the main thread (fallback or workers=1).
 *
 * @param jobs - scene baking jobs.
 * @returns results array indexed by jobId.
 */
async function runSequential(jobs: SceneJob[]): Promise<SceneResult[]> {
  const results: SceneResult[] = new Array(jobs.length)
  let completed = 0
  for (const job of jobs) {
    const result = await bakeSceneJob(job)
    results[job.jobId] = result
    completed += 1
    console.log(`[${String(completed).padStart(3)}/${String(jobs.length)}] ${result.logLine}`)
    if (result.missingTiles > 0) {
      console.log('  missingRefs:', result.missingRefs)
    }
  }
  return results
}

/**
 * Main coordinator entry point for act asset baking.
 */
async function main(): Promise<void> {
  await initMainThreadTables()

  const filterLevel = process.env.FILTER_LEVEL
  const filterLevels = filterLevel !== undefined
    ? new Set(filterLevel.split(',').map(s => Number(s.trim())))
    : null
  const filterAct = process.env.FILTER_ACT !== undefined ? Number(process.env.FILTER_ACT) : null

  const index: Record<string, unknown> = {
    version: 1,
    generated: new Date().toISOString(),
    archiveDir,
    pageSize: PAGE_SIZE,
    palettes: {} as Record<string, number[]>,
    levels: [] as unknown[],
  }

  for (let act = 1; act <= 5; act += 1) {
    const pal = await getPalette(`data\\global\\palette\\act${String(act)}\\pal.pl2`)
    ;(index.palettes as Record<string, number[]>)[`act${String(act)}`] = [...pal]
  }

  await mkdir(outDir, { recursive: true })
  for (let act = 1; act <= 5; act += 1) {
    await mkdir(join(outDir, `act${String(act)}`), { recursive: true })
  }

  const drlgActs = await generateDrlgActs((act, levelId) =>
    (filterLevels === null || filterLevels.has(levelId)) && (filterAct === null || act === filterAct))
  const sceneJobs = await collectSceneJobs(filterLevels, filterAct, drlgActs)
  if (sceneJobs.length === 0) {
    console.log('No scenes matched filter criteria.')
    return
  }

  const defaultMaxWorkers = typeof availableParallelism === 'function' ? availableParallelism() : 8
  const envWorkers = process.env.MAX_WORKERS ? parseInt(process.env.MAX_WORKERS, 10) : undefined
  const maxWorkers = Math.max(1, Math.min(envWorkers ?? defaultMaxWorkers, 16))
  const useWorkers = maxWorkers > 1
  const numWorkers = useWorkers ? Math.min(maxWorkers, sceneJobs.length) : 1

  console.log(`Baking ${String(sceneJobs.length)} scenes using ${useWorkers ? `${String(numWorkers)} worker threads` : 'sequential execution'}...`)

  const tStart = performance.now()
  const results = useWorkers
    ? await runWorkerPool(sceneJobs, numWorkers)
    : await runSequential(sceneJobs)
  const elapsedSec = ((performance.now() - tStart) / 1000).toFixed(1)

  let totalPngBytes = 0
  let totalLevels = 0
  let skippedArtlessSpawns = 0
  let skippedMissingArtSpawns = 0

  // Deterministic indexing: append results sorted strictly by jobId (0..sceneJobs.length - 1)
  for (let i = 0; i < sceneJobs.length; i++) {
    const res = results[i]!
    ;(index.levels as unknown[]).push(res.indexEntry)
    totalPngBytes += res.pngBytes
    totalLevels += 1
    skippedArtlessSpawns += res.skippedArtlessSpawns
    skippedMissingArtSpawns += res.skippedMissingArtSpawns
  }

  // The DRLG act copies the generated levels belong to (src/game/act-variants.ts reads them).
  const actLayouts: Record<string, ActLayout[]> = {}
  for (const [act, copies] of drlgActs) actLayouts[String(act)] = copies.map(copy => copy.layout)
  if (Object.keys(actLayouts).length > 0) index.actLayouts = actLayouts

  const indexPath = join(outDir, 'index.json')
  if (filterLevel !== undefined || filterAct !== null) {
    try {
      const { readFile } = await import('node:fs/promises')
      const existingRaw = await readFile(indexPath, 'utf8')
      const existing = JSON.parse(existingRaw) as {
        levels?: Array<{ label?: string }>
        actLayouts?: Record<string, ActLayout[]>
      }
      if (Array.isArray(existing.levels)) {
        const updatedByLabel = new Map<string, unknown>()
        for (const item of index.levels as Array<{ label: string }>) {
          updatedByLabel.set(item.label, item)
        }
        const merged: unknown[] = []
        const seenLabels = new Set<string>()
        for (const oldItem of existing.levels) {
          if (oldItem.label && updatedByLabel.has(oldItem.label)) {
            merged.push(updatedByLabel.get(oldItem.label)!)
            seenLabels.add(oldItem.label)
          } else {
            merged.push(oldItem)
          }
        }
        for (const [lbl, item] of updatedByLabel.entries()) {
          if (!seenLabels.has(lbl)) merged.push(item)
        }
        index.levels = merged
      }
      // An act this run generated replaces its old copies whole; other acts keep theirs.
      if (existing.actLayouts !== undefined) index.actLayouts = { ...existing.actLayouts, ...actLayouts }
    } catch {
      // No existing index.json or unreadable; write fresh index
    }
  }

  // Outside the merge's catch-all: an act copy the runtime could not resolve must fail the bake.
  validateActLayouts(index as unknown as VariantIndex<VariantEntry>)

  // Atomic writes from main thread
  await writeJsonAtomic(indexPath, index)

  if (filterLevel === undefined && filterAct === null) {
    const activeDirs = new Set((index.levels as { label: string }[]).map(entry => entry.label))
    for (let actNum = 1; actNum <= 5; actNum++) {
      const actDir = join(outDir, `act${String(actNum)}`)
      const subdirs = await readdir(actDir).catch(() => [] as string[])
      for (const d of subdirs) {
        if (/^\d+-/.test(d) && !activeDirs.has(d)) {
          await rm(join(actDir, d), { recursive: true, force: true })
        }
      }
    }
  }

  await writeJsonAtomic(join(outDir, 'world-graph.json'), {
    version: 1,
    layoutSeed: ACT_LAYOUT_SEED,
    levels: [...worldGraph.levels.values()].map(level => ({
      id: level.id,
      act: level.act + 1,
      name: level.name,
      drlgType: level.drlgType,
      waypoint: level.waypoint,
    })),
    edges: worldGraph.edges.map(edge => ({
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      sideFrom: edge.sideFrom,
      sideTo: edge.sideTo,
      warps: edge.warps,
      warpSlots: edge.warpSlots,
      source: edge.source,
    })),
    waypoints: [...worldGraph.waypoints.entries()].map(([id, levelId]) => ({ id, levelId })),
  })

  if (!process.env.SKIP_ENTITIES) {
    const { bakeEntities } = await import('./pack-entity-assets.ts')
    await bakeEntities(archiveDir, 'public')
  }

  console.log(`\n打包完成：${String(totalLevels)} 张地图，耗时 ${elapsedSec}s，PNG 合计 ${(totalPngBytes / 1048576).toFixed(1)} MB，输出 ${outDir}`)
  console.log(`Skipped artless spawns: ${String(skippedArtlessSpawns)}, Skipped no-art NPCs: ${String(skippedMissingArtSpawns)}`)
  console.log(`世界图：${String(worldGraph.levels.size)} 个关卡，${String(worldGraph.edges.length)} 条边，${String(worldGraph.waypoints.size)} 个传送点`)
}

/**
 * Worker thread execution loop.
 */
function startWorker(): void {
  process.on('unhandledRejection', (reason) => {
    console.error('Worker unhandled rejection:', reason)
    parentPort?.postMessage({
      type: 'error',
      jobId: -1,
      label: 'unhandled-rejection',
      message: String(reason),
      stack: (reason as Error)?.stack,
    })
  })

  parentPort?.on('message', async (msg: { type: string; job?: SceneJob }) => {
    if (msg.type === 'job' && msg.job) {
      try {
        const result = await bakeSceneJob(msg.job)
        parentPort?.postMessage({ type: 'result', result })
      } catch (err) {
        parentPort?.postMessage({
          type: 'error',
          jobId: msg.job.jobId,
          label: msg.job.label,
          message: (err as Error).message,
          stack: (err as Error).stack,
        })
      }
    } else if (msg.type === 'shutdown') {
      process.exit(0)
    }
  })
  parentPort?.postMessage({ type: 'ready' })
}

const isMainModule =
  isMainThread &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMainModule) {
  main().catch((err) => {
    console.error('Fatal bake error:', err)
    process.exit(1)
  })
}

