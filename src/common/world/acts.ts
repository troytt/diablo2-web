/**
 * Resolving one act's town from Diablo II's own tables.
 *
 * The chain is three tables deep and every link is data, so nothing here is
 * hard-coded per act — which is the point, because five towns with different
 * sizes, different tile sets and different palettes cannot be a lookup table
 * anyone maintains by hand:
 *
 *   `Levels.txt`    `Act N - Town`     → level id, act, palette index, level type
 *   `LvlTypes.txt`  level type id      → `File 1..File 32` (the DT1 libraries)
 *   `LvlPrest.txt`  level id (`LevelId`) → `File1..File6` (the DS1 variants / versions), Dt1Mask
 *   `data\\global\\palette\\actN\\pal.pl2` → the act's palette
 *
 * Two details cost real time to find and are encoded here:
 *
 * 1. **`LvlPrest` joins on `LevelId`, not on `Def`.** `Def` is the preset's own
 *    id (Act 2's town has `Def = 301`, `LevelId = 40`), so joining on the wrong
 *    column silently returns *other levels'* maps for four of the five acts.
 * 2. **`Dt1Mask` filters the file list.** Its bits correspond to `File 1..N`;
 *    for all five towns the mask happens to be saturated, but a level whose mask
 *    is not would otherwise load libraries the map never references and index
 *    the rest incorrectly.
 */
import { decodeDs1 } from '../formats/ds1.ts'
import type { Ds1 } from '../formats/ds1.ts'
import { decodeDt1 } from '../formats/dt1.ts'
import type { Dt1 } from '../formats/dt1.ts'
import { decodePl2 } from '../formats/pl2.ts'
import type { Pl2 } from '../formats/pl2.ts'
import { getAutomapLevelTypeId, parseAutomapTable, type AutomapTable } from '../formats/automap-table.ts'
import type { MountedArchives } from '../mpq/mount.ts'

/** Where the data tables live inside an archive. */
const EXCEL = 'data\\global\\excel\\'
/** Tile libraries and levels are addressed relative to this prefix. */
const TILES = 'data\\global\\tiles\\'

/** A tab-separated table with its header row. */
export interface D2Table {
  /** Column names, in file order. */
  readonly header: readonly string[]
  /** Data rows. */
  readonly rows: readonly (readonly string[])[]
}

/**
 * Decode bytes as Latin-1 without touching Node APIs.
 *
 * The tables are ASCII, but this module is imported by the browser bundle, so
 * no `Buffer` and no Node-only globals: chunks keep `String.fromCharCode` from
 * blowing the argument limit on a 130 KB table.
 *
 * @param bytes - the bytes.
 * @returns the text.
 */
function latin1(bytes: Uint8Array): string {
  const chunk = 8192
  let out = ''
  for (let at = 0; at < bytes.length; at += chunk) {
    out += String.fromCharCode(...bytes.subarray(at, Math.min(at + chunk, bytes.length)))
  }
  return out
}

const headerIndexByTable = new WeakMap<D2Table, Map<string, number>>()

function getHeaderIndexMap(table: D2Table): Map<string, number> {
  let indexMap = headerIndexByTable.get(table)
  if (indexMap === undefined) {
    indexMap = new Map<string, number>()
    for (let i = 0; i < table.header.length; i += 1) {
      const col = table.header[i]!
      if (!indexMap.has(col)) {
        indexMap.set(col, i)
      }
    }
    headerIndexByTable.set(table, indexMap)
  }
  return indexMap
}

/**
 * Parse one of Diablo II's tab-separated tables.
 *
 * Rows end with CRLF and the last line may be empty; both are tolerated because
 * `Patch_D2.mpq` and `d2data.mpq` disagree about the trailing newline.
 *
 * @param bytes - the decoded member.
 * @returns the table.
 */
export function parseTable(bytes: Uint8Array): D2Table {
  const text = latin1(bytes)
  const lines = text.split(/\r?\n/).filter(line => line.length > 0)
  if (lines.length === 0) {
    throw new Error('parseTable: empty table data')
  }
  const header = (lines.shift() ?? '').split('\t')
  const table: D2Table = { header, rows: lines.map(line => line.split('\t')) }
  getHeaderIndexMap(table)
  return table
}

/**
 * Read a column out of a row by name.
 *
 * @param table - the table.
 * @param row - the row.
 * @param column - column name.
 * @returns the cell, or an empty string when the column is absent.
 */
export function cell(table: D2Table, row: readonly string[], column: string): string {
  const index = getHeaderIndexMap(table).get(column)
  return index === undefined ? '' : (row[index] ?? '')
}

/**
  * Canonical set of outdoor levels that contain a Waypoint across Acts 1..5.
  * Used as a fast fallback when the complete `Levels.txt` table is not loaded.
  */
export const OUTDOOR_WAYPOINT_LEVELS = new Set([
  3, 4, 5, 6, 27, // Act 1: Cold Plains, Stony Field, Dark Wood, Black Marsh, Outer Cloister
  42, 43, 44, 46, 48, // Act 2: Dry Hills, Far Oasis, Lost City, Canyon of the Magi, Arcane Sanctuary
  76, 77, 78, 79, 80, 81, 83, // Act 3: Spider Forest, Great Marsh, Flayer Jungle, Lower Kurast, Kurast Bazaar, Upper Kurast, Travincal
  106, 107, // Act 4: City of the Damned, River of Flame
  111, 112, 113, 115, 117, // Act 5: Frigid Highlands, Arreat Plateau, Crystalline Passage, Glacial Trail, Ancients' Way
])

/**
 * Determines whether an outdoor level carries a Waypoint.
 * Reads `Levels.txt Waypoint != 255` when levels table is provided, with cached fallback matching canonical levels.
 */
export function hasOutdoorWaypoint(levelId: number, levelsTable?: D2Table): boolean {
  if (levelsTable) {
    const row = levelsTable.rows.find(candidate => Number(cell(levelsTable, candidate, 'Id')) === levelId)
    if (row) {
      const wp = cell(levelsTable, row, 'Waypoint')
      const wpNum = wp === '' ? 255 : Number(wp)
      const drlgType = cell(levelsTable, row, 'DrlgType')
      const isTown = [1, 40, 75, 103, 109].includes(levelId)
      const isOutdoor = drlgType === '3' || (!isTown && OUTDOOR_WAYPOINT_LEVELS.has(levelId))
      return isOutdoor && wpNum !== 255 && !isNaN(wpNum)
    }
  }
  return OUTDOOR_WAYPOINT_LEVELS.has(levelId)
}

/**
 * Resolves the numeric Act (1..5) for a given levelId, levelTypeName, and/or levels table.
 * Reads `Levels.txt Act` column when table is provided, with fallback to levelId / levelTypeName / fallbackAct.
 */
export function actOfLevel(
  levelId: number,
  levelTypeNameOrTable?: string | D2Table,
  fallbackActOrTable?: number | D2Table,
  maybeTable?: D2Table,
): number {
  const table =
    (levelTypeNameOrTable && typeof levelTypeNameOrTable === 'object' && 'rows' in levelTypeNameOrTable ? levelTypeNameOrTable : undefined) ??
    (fallbackActOrTable && typeof fallbackActOrTable === 'object' && 'rows' in fallbackActOrTable ? fallbackActOrTable : undefined) ??
    maybeTable

  const levelTypeName = typeof levelTypeNameOrTable === 'string' ? levelTypeNameOrTable : undefined
  const fallbackAct = typeof fallbackActOrTable === 'number' ? fallbackActOrTable : undefined

  if (table) {
    const row = table.rows.find(candidate => Number(cell(table, candidate, 'Id')) === levelId)
    if (row) {
      if (levelId >= 109 && levelId <= 136) return 5
      const actVal = cell(table, row, 'Act')
      if (actVal !== '') {
        const parsed = Number(actVal) + 1
        if (parsed >= 1 && parsed <= 5) return parsed
      }
    }
  }

  if (levelTypeName) {
    const m = /^Act\s*([1-5])/i.exec(levelTypeName)
    if (m && m[1]) return Number(m[1])
  }

  if (levelId >= 1 && levelId <= 39) return 1
  if (levelId >= 40 && levelId <= 74) return 2
  if (levelId >= 75 && levelId <= 102) return 3
  if (levelId >= 103 && levelId <= 108) return 4
  if (levelId >= 109 && levelId <= 136) return 5
  if (fallbackAct !== undefined && fallbackAct >= 1 && fallbackAct <= 5) return fallbackAct
  return 1
}

/**
 * The tables a level needs to be resolved and populated.
 *
 * The first five place and draw the level; the rest describe what lives in it.
 * They are loaded together because every caller that wants one wants the level
 * it belongs to as well, and because mounting the archives is the expensive
 * part — a table read is a few hundred kilobytes off an already-open handle.
 */
export interface ActTables {
  readonly levels: D2Table
  readonly lvltypes: D2Table
  readonly lvlprest: D2Table
  readonly monstats: D2Table
  readonly monpreset: D2Table
  /** `MonStats2.txt` — body size, melee range, and which COF layers exist. */
  readonly monstats2: D2Table
  /** `MonLvl.txt` — the per-level scaling curve, read but not yet applied (M9). */
  readonly monlvl: D2Table
  /** `MonType.txt` — family equivalences, e.g. `lowundead` → `undead`. */
  readonly montype: D2Table
  /** `MonUMod.txt` — the elite modifiers and their shared constants. */
  readonly monumod: D2Table
  /** `SuperUniques.txt` — the named bosses, e.g. Bishibosh, Rakanishu. */
  readonly superuniques: D2Table
  /**
   * `LvlWarp.txt`: the geometry of every stair, cave mouth and door.
   *
   * Referenced by `Levels.txt` `Warp0..7` — and only by those columns.
   * `LevelWarp` is *not* an index into this table; it holds a string-table key
   * for the hover text (`"To The Blood Moor"`).
   *
   * Rows must be keyed on `(Id, Direction)`, not on `Id` alone: ids 71, 73, 74,
   * 81 and 82 each appear twice, once with `Direction = l` and once with `r`,
   * for the Act 5 barricades. There is also one `Expansion` separator row with
   * no usable data.
   */
  readonly lvlwarp: D2Table
  /** Optional CharStats.txt for character class baselines */
  readonly charstats?: D2Table | undefined
  /** Optional Skills.txt for skill properties & prerequisites */
  readonly skills?: D2Table | undefined
  /** Optional SkillDesc.txt for skill tree page/row/col UI placement */
  readonly skilldesc?: D2Table | undefined
  /** Optional Missiles.txt for projectile physics, velocity, range & explosions */
  readonly missiles?: D2Table | undefined
  /** Optional AutoMap.txt parsed table for automap cell resolution */
  readonly automap?: AutomapTable | undefined
}

/** Everything needed to place and render one level. */
export interface LevelInfo {
  /** Act number, 1..5. */
  readonly act: number
  /** `Levels.txt` name, e.g. `Act 1 - Town`. */
  readonly levelName: string
  /** `Levels.txt` id. */
  readonly levelId: number
  /** `Levels.txt` `Layer` column (persistent automap layer ID across shared outdoor areas). */
  readonly layerId: number
  /** `Levels.txt` `LevelType` numeric ID (1..35, matching `AUTOMAP_LEVEL_NAMES`). */
  readonly levelTypeId: number
  /** Palette slot from `Levels.txt` (`Pal`), 0-based. */
  readonly paletteIndex: number
  /** `LvlTypes.txt` name. */
  readonly levelTypeName: string
  /** DS1 members, full archive paths. */
  readonly ds1Names: readonly string[]
  /** DT1 members, full archive paths, in `File 1..N` order after the mask. */
  readonly dt1Names: readonly string[]
  /** `LvlPrest.Dt1Mask`, kept for reporting. */
  readonly dt1Mask: number
  /** Level extent in cells, from `Levels.txt`. */
  readonly sizeX: number
  readonly sizeY: number
  /** Palette member path. */
  readonly paletteName: string
  /**
   * `Vis0..7`: the level reachable through each warp slot, 0 when unused.
   *
   * Only half the world's connectivity. Outdoor levels that simply abut each
   * other — town to Blood Moor, Blood Moor to Cold Plains — are absent from
   * these columns entirely; see `world-graph.ts`.
   */
  readonly vis: readonly number[]
  /**
   * `Warp0..7`: the `LvlWarp.txt` row for each slot, -1 when the slot has no
   * warp tile.
   *
   * A slot with a `Vis` but no `Warp` is an opening the player walks through
   * rather than clicks.
   */
  readonly warp: readonly number[]
  /** `Waypoint`, 0..38, or 255 when the level has none. */
  readonly waypoint: number
  /** `Position`; 1 marks a level that something teleports into. */
  readonly position: number
  /** `Portal`. */
  readonly portal: number
  /** Animated tile playback speed from `LvlPrest.txt` `Animate` column (0 or undefined defaults to 80). */
  readonly animSpeed?: number
}

/**
 * The same shape under the name the act pages used before levels were generic.
 *
 * @deprecated use {@link LevelInfo}; kept so existing call sites keep reading.
 */
export type ActTown = LevelInfo
export type LevelEntry = LevelInfo
export type ResolvedLevel = LevelInfo

/**
 * Town level IDs for Acts 1..5 in order:
 * Act 1: Rogue Encampment (1)
 * Act 2: Lut Gholein (40)
 * Act 3: Kurast Docks (75)
 * Act 4: The Pandemonium Fortress (103)
 * Act 5: Harrogath (109)
 */
export const ACT_TOWNS: readonly number[] = [1, 40, 75, 103, 109]

/**
 * Returns the town level ID for an act (1..5).
 * Defaults to Act 5 Harrogath (109) for acts >= 5, or Act 1 Rogue Encampment (1) for acts <= 1.
 */
export function townLevelForAct(act: number): number {
  if (act >= 1 && act <= 5) {
    return ACT_TOWNS[act - 1]!
  }
  if (act <= 1) return ACT_TOWNS[0]!
  return ACT_TOWNS[4]!
}

/** Turn a table-relative tile path into a member name. */
export function tileMemberPath(relative: string): string {
  return `${TILES}${relative.replaceAll('/', '\\')}`
}

/**
 * Universal DT1 files unconditionally appended by D2Common.dll
 * (DRLGROOM_LoadDt1Files @ 0x6fdb8400) after loading LvlTypes.txt.
 *
 * Blank.dt1: blank placeholder tiles
 * InvisWal.dt1: invisible walls, including style=49 sequence=7 floor tile (walk-blocking collision)
 * Warp.dt1: generic warp tiles
 */
export const UNIVERSAL_DT1S: readonly string[] = [
  tileMemberPath('Act1/Outdoors/Blank.dt1'),
  tileMemberPath('Act1/Barracks/InvisWal.dt1'),
  tileMemberPath('Act1/Barracks/Warp.dt1'),
]

/**
 * Load the tables from a mounted stack.
 *
 * @param archives - the mounted archives.
 * @returns the parsed tables.
 */
export async function loadActTables(archives: MountedArchives): Promise<ActTables> {
  const read = async (name: string): Promise<D2Table> => parseTable(await archives.read(`${EXCEL}${name}`))
  const tryRead = async (name: string): Promise<D2Table | undefined> => {
    const member = `${EXCEL}${name}`
    if (!archives.has(member)) return undefined
    try {
      return parseTable(await archives.read(member))
    } catch {
      return undefined
    }
  }
  const tryReadAutomap = async (): Promise<AutomapTable | undefined> => {
    const member = `${EXCEL}AutoMap.txt`
    if (!archives.has(member)) return undefined
    try {
      return parseAutomapTable(await archives.read(member))
    } catch {
      return undefined
    }
  }
  return {
    levels: await read('levels.txt'),
    lvltypes: await read('lvltypes.txt'),
    lvlprest: await read('lvlprest.txt'),
    monstats: await read('monstats.txt'),
    monpreset: await read('MonPreset.txt'),
    monstats2: await read('MonStats2.txt'),
    monlvl: await read('MonLvl.txt'),
    montype: await read('MonType.txt'),
    monumod: await read('MonUMod.txt'),
    superuniques: await read('SuperUniques.txt'),
    lvlwarp: await read('LvlWarp.txt'),
    charstats: await tryRead('CharStats.txt'),
    skills: await tryRead('Skills.txt'),
    skilldesc: await tryRead('SkillDesc.txt'),
    missiles: await tryRead('Missiles.txt'),
    automap: await tryReadAutomap(),
  }
}

/** A level type's tile libraries, with the mask when the level declares one. */
export interface LevelLibraries {
  /** `LvlTypes.txt` name. */
  readonly levelTypeName: string
  /** DT1 member names, in `File 1..N` order. */
  readonly dt1Names: readonly string[]
  /**
   * `LvlPrest.Dt1Mask` when the level has preset rows, else `null`.
   *
   * Maze and wilderness levels have **no** `LvlPrest` rows at all — their fixed
   * pieces are picked by the generators — so there is no mask to apply and the
   * whole file list is in play.
   */
  readonly dt1Mask: number | null
}

/**
 * Resolve one level by its `Levels.txt` id.
 *
 * Everything after the level row is data: its level type names the DT1
 * libraries, its `LvlPrest` rows name the DS1 files, and its `Pal` slot selects
 * the act palette. Towns and dungeons differ only in which rows they hit, so one
 * function covers both — the earlier town-only version could not reach
 * Tristram, the Cathedral or the Throne Room at all.
 *
 * @param tables - the loaded tables.
 * @param levelId - `Levels.txt` `Id`.
 * @param act - act number to report (`Levels.txt` stores it 0-based and often
 *   as 0 for expansion rows, so the caller states it when it knows).
 * @returns the level description.
 */
export function resolveLevel(tables: ActTables, levelId: number, act?: number): LevelInfo {
  const row = tables.levels.rows.find(candidate => Number(cell(tables.levels, candidate, 'Id')) === levelId)
  if (row === undefined) throw new Error(`Levels.txt has no row with Id ${String(levelId)}`)
  const paletteIndex = Number(cell(tables.levels, row, 'Pal'))
  const levelTypeIdStr = cell(tables.levels, row, 'LevelType')
  const layerId = Number(cell(tables.levels, row, 'Layer') || '0')

  const typeRow = tables.lvltypes.rows.find(candidate => cell(tables.lvltypes, candidate, 'Id') === levelTypeIdStr)
  if (typeRow === undefined) throw new Error(`LvlTypes.txt has no row with Id ${levelTypeIdStr} (level ${String(levelId)})`)
  const levelTypeName = cell(tables.lvltypes, typeRow, 'Name')
  const parsedLevelTypeId = Number(levelTypeIdStr)
  const levelTypeId = Number.isInteger(parsedLevelTypeId) && parsedLevelTypeId >= 1 && parsedLevelTypeId <= 35
    ? parsedLevelTypeId
    : getAutomapLevelTypeId(levelTypeName)

  const CHAOS_PREST_DEFS = new Set([836, 856, 857, 858, 859, 860, 861, 862])
  const preset = tables.lvlprest.rows.filter(candidate =>
    Number(cell(tables.lvlprest, candidate, 'LevelId')) === levelId
    || (levelId === 108 && CHAOS_PREST_DEFS.has(Number(cell(tables.lvlprest, candidate, 'Def'))))
  )
  if (preset.length === 0) throw new Error(`LvlPrest.txt has no row with LevelId ${String(levelId)}`)

  const animSpeedRaw = parseInt(cell(tables.lvlprest, preset[0]!, 'Animate'), 10) || 0
  const animSpeed = animSpeedRaw > 0 ? animSpeedRaw : undefined
  const { dt1Names, dt1Mask } = loadDt1sForLevel(tables, levelId)

  const ds1Names: string[] = []
  for (const presetRow of preset) {
    for (let file = 1; file <= 6; file += 1) {
      const value = cell(tables.lvlprest, presetRow, `File${String(file)}`)
      if (value === '' || value === '0') continue
      ds1Names.push(tileMemberPath(value))
    }
  }

  const vis: number[] = []
  const warp: number[] = []
  for (let slot = 0; slot < 8; slot += 1) {
    vis.push(Number(cell(tables.levels, row, `Vis${String(slot)}`) || '0'))
    warp.push(Number(cell(tables.levels, row, `Warp${String(slot)}`) || '-1'))
  }

  return {
    act: act ?? actOfLevel(levelId, levelTypeName, undefined, tables.levels),
    levelName: cell(tables.levels, row, 'Name'),
    levelId,
    layerId,
    levelTypeId,
    paletteIndex,
    levelTypeName,
    ds1Names,
    dt1Names,
    dt1Mask,
    sizeX: Number(cell(tables.levels, row, 'SizeX')),
    sizeY: Number(cell(tables.levels, row, 'SizeY')),
    paletteName: `data\\global\\palette\\act${String(paletteIndex + 1)}\\pal.pl2`,
    vis,
    warp,
    waypoint: Number(cell(tables.levels, row, 'Waypoint') || '255'),
    position: Number(cell(tables.levels, row, 'Position') || '0'),
    portal: Number(cell(tables.levels, row, 'Portal') || '0'),
    ...(animSpeed !== undefined ? { animSpeed } : {}),
  }
}

/**
 * Resolve one act's town.
 *
 * @param tables - the loaded tables.
 * @param act - act number, 1..5.
 * @returns the town description.
 */
export function resolveActTown(tables: ActTables, act: number): LevelInfo {
  const row = tables.levels.rows.find(candidate => cell(tables.levels, candidate, 'Name') === `Act ${String(act)} - Town`)
  if (row === undefined) throw new Error(`Levels.txt has no "Act ${String(act)} - Town" row`)
  return resolveLevel(tables, Number(cell(tables.levels, row, 'Id')), act)
}

/** A resolved level with its decoded assets. */
export interface LoadedActTown {
  /** The resolution result. */
  readonly town: LevelInfo
  /** The decoded DS1 variants / versions. */
  readonly levels: readonly Ds1[]
  /** The decoded DT1 libraries, in file-list order. */
  readonly libraries: readonly Dt1[]
  /** The act palette. */
  readonly palette: Pl2
  /** Total cells across the variants. */
  readonly cells: number
}

/**
 * Resolve and decode one act's town.
 *
 * @param archives - the mounted archives.
 * @param tables - the loaded tables.
 * @param act - act number, 1..5.
 * @returns the town with assets.
 */
export async function loadActTown(
  archives: MountedArchives,
  tables: ActTables,
  act: number,
): Promise<LoadedActTown> {
  return loadLevel(archives, tables, resolveActTown(tables, act))
}

/**
 * Resolve a level's DT1 libraries and compute the actual loaded DT1 bitmask (`dt1Mask`)
 * over the non-empty `File 1..32` slots in `LvlTypes.txt` (filtered by `LvlPrest.txt` `Dt1Mask` when present).
 */
export function loadDt1sForLevel(
  tables: ActTables,
  levelId: number,
): { levelTypeName: string; dt1Names: readonly string[]; dt1Mask: number; hasPreset: boolean } {
  const row = tables.levels.rows.find(candidate => Number(cell(tables.levels, candidate, 'Id')) === levelId)
  if (row === undefined) throw new Error(`Levels.txt has no row with Id ${String(levelId)}`)
  const typeRow = tables.lvltypes.rows.find(candidate => cell(tables.lvltypes, candidate, 'Id') === cell(tables.levels, row, 'LevelType'))
  if (typeRow === undefined) throw new Error(`LvlTypes.txt has no row for level ${String(levelId)}`)
  const CHAOS_PREST_DEFS = new Set([836, 856, 857, 858, 859, 860, 861, 862])
  const preset = tables.lvlprest.rows.filter(candidate =>
    Number(cell(tables.lvlprest, candidate, 'LevelId')) === levelId
    || (levelId === 108 && CHAOS_PREST_DEFS.has(Number(cell(tables.lvlprest, candidate, 'Def'))))
  )
  const presetMask = preset.length === 0 ? null : Number(cell(tables.lvlprest, preset[0]!, 'Dt1Mask'))
  const dt1Names: string[] = []
  let loadedDt1Mask = 0
  for (let slot = 1; slot <= 32; slot += 1) {
    const value = cell(tables.lvltypes, typeRow, `File ${String(slot)}`)
    if (value === '' || value === '0') continue
    const slotBit = (1 << (slot - 1)) >>> 0
    if (presetMask !== null && ((presetMask >>> 0) & slotBit) === 0) continue
    loadedDt1Mask = (loadedDt1Mask | slotBit) >>> 0
    dt1Names.push(tileMemberPath(value))
  }
  if (cell(tables.lvltypes, typeRow, 'Name') === 'Act 5 - Barricade') {
    // Blizzard hardcoded barricade and siege floor/snow transition tiles in D2 LOD patch
    // when assembling Act 5 siege DS1 files which reference temptile.dt1.
    dt1Names.push(tileMemberPath('Expansion/Siege/temptile.dt1'))
  }
  for (const universal of UNIVERSAL_DT1S) {
    if (!dt1Names.some(existing => existing.toLowerCase() === universal.toLowerCase())) {
      dt1Names.push(universal)
    }
  }
  return {
    levelTypeName: cell(tables.lvltypes, typeRow, 'Name'),
    dt1Names,
    dt1Mask: loadedDt1Mask,
    hasPreset: preset.length > 0,
  }
}

/**
 * Resolve a level type's DT1 libraries without requiring preset rows.
 *
 * `resolveLevel` needs `LvlPrest` rows because it also wants DS1 files; the
 * generators need only the tile libraries, and 101 of the game's 136 levels have
 * no preset rows at all.
 *
 * @param tables - the loaded tables.
 * @param levelId - `Levels.txt` `Id`.
 * @returns the library list.
 */
export function resolveLevelLibraries(levelId: number): readonly string[]
export function resolveLevelLibraries(tables: ActTables, levelId: number): LevelLibraries
export function resolveLevelLibraries(
  tablesOrLevelId: ActTables | number,
  maybeLevelId?: number,
): LevelLibraries | readonly string[] {
  if (typeof tablesOrLevelId === 'number') {
    const levelId = tablesOrLevelId
    if (!Number.isInteger(levelId) || levelId < 1 || levelId > 136) {
      throw new Error(`Invalid levelId ${String(levelId)}: must be in 1..136`)
    }
    return [...UNIVERSAL_DT1S]
  }
  const loaded = loadDt1sForLevel(tablesOrLevelId, maybeLevelId!)
  return {
    levelTypeName: loaded.levelTypeName,
    dt1Names: loaded.dt1Names,
    dt1Mask: loaded.hasPreset ? loaded.dt1Mask : null,
  }
}

/**
 * Decode a resolved level's assets.
 *
 * @param archives - the mounted archives.
 * @param tables - the loaded tables (unused today; kept for symmetry with the
 *   resolver so callers can pass both without re-deriving).
 * @param town - the resolution result.
 * @returns the level with assets.
 */
export async function loadLevel(
  archives: MountedArchives,
  tables: ActTables,
  town: LevelInfo,
): Promise<LoadedActTown> {
  void tables
  const levels: Ds1[] = []
  for (const name of town.ds1Names) levels.push(decodeDs1(await archives.read(name)))
  const libraries: Dt1[] = []
  for (const name of town.dt1Names) libraries.push(decodeDt1(await archives.read(name)))
  const palette = decodePl2(await archives.read(town.paletteName))
  return {
    town,
    levels,
    libraries,
    palette,
    cells: levels.reduce((sum, level) => sum + level.width * level.height, 0),
  }
}

