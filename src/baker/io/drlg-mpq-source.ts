/**
 * MPQ-backed game data for the DRLG port (offline bake and tooling).
 *
 * The port reads its inputs synchronously, exactly like D2Common does from the mounted archives
 * (see src/game/drlg/drlg-source.ts). MPQ reads are asynchronous, so this module preloads every file
 * the port can open for one act and serves them from memory:
 *   - the compiled tables `data\global\excel\<name>.bin` ({@link DRLG_TABLE_NAMES});
 *   - every DS1 the tables reference (LvlPrest File1..6, LvlSub File), for all acts, because level
 *     generation behind warps (sub_6FD77BB0 -> DRLG_InitLevel) opens presets of any level it reaches;
 *   - the DT1 libraries of the act's level types (LvlTypes File1..32, loaded by
 *     DRLGROOMTILE_LoadDT1FilesForRoom for activated rooms) plus the hardcoded libraries of
 *     DRLGROOMTILE_LoadDT1FilesForRoom (DrlgRoomTile.cpp:1249-1256) and DRLG_AllocDrlg
 *     (DrlgDrlg.cpp:47-76).
 * Anything else is not loaded and reading it throws (memoryDrlgSource), so a gap fails the bake
 * instead of silently changing the generated map. The file list is the same one
 * scripts/extract-d2moo-tables.ts extracts for the native oracle (the DT1 list restricted to the act),
 * and the reads use the game's archive priority, so the bake and the oracle consume identical bytes.
 */

import { decodeDt1, type Dt1 } from '../../common/formats/dt1.ts'
import { cell, type D2Table } from '../../common/world/acts.ts'
import type { DrlgLevelInput } from '../../common/drlg/drlg-map.ts'
import { loadDrlgTables, type DrlgDataSource, type DrlgTableName, type DrlgTables } from '../../common/drlg/drlg-tables.ts'
import { DRLG_TABLE_NAMES, drlgReferencedDs1Files, memoryDrlgSource, normalizeDrlgPath } from '../../common/drlg/drlg-source.ts'

/**
 * DT1 libraries D2Common opens by hardcoded name (full archive paths, as the port requests them):
 * the three universal libraries of DRLGROOMTILE_LoadDT1FilesForRoom (Blank, InvisWal, Warp) and the
 * act libraries of DRLG_AllocDrlg.
 */
export const DRLG_HARDCODED_DT1_FILES: readonly string[] = [
  'DATA\\GLOBAL\\TILES\\Act1\\Outdoors\\Blank.dt1',
  'DATA\\GLOBAL\\TILES\\Act1\\Barracks\\InvisWal.dt1',
  'DATA\\GLOBAL\\TILES\\Act1\\Barracks\\Warp.dt1',
  'DATA\\GLOBAL\\TILES\\Act1\\Town\\Floor.dt1',
  'DATA\\GLOBAL\\TILES\\Act2\\Town\\Ground.dt1',
  'DATA\\GLOBAL\\TILES\\ACT3\\Kurast\\sets.dt1',
]

/** Reads one archive member (backslash path, case-insensitive), throwing when it does not exist. */
export type ArchiveReader = (mpqPath: string) => Promise<Uint8Array>

export interface DrlgMpqData {
  /** Synchronous source over the preloaded bytes (throws for anything not preloaded). */
  readonly source: DrlgDataSource
  /** The parsed tables (immutable; pass them to createDrlgEnv to avoid re-parsing). */
  readonly tables: DrlgTables
  /** Archive paths of the preloaded DS1 and DT1 files. */
  readonly ds1Files: readonly string[]
  readonly dt1Files: readonly string[]
}

/**
 * DT1 libraries of every level type of one act: the non-placeholder LvlTypes File columns of the rows
 * whose `Act` (D2LvlTypesTxt.nAct, 1-based as in LvlTypes.txt) is `act1Based`, plus
 * {@link DRLG_HARDCODED_DT1_FILES}.
 */
export function drlgActDt1Files(t: DrlgTables, act1Based: number): string[] {
  if (!Number.isInteger(act1Based) || act1Based < 1 || act1Based > 5) {
    throw new Error(`drlgActDt1Files: act ${act1Based} is not 1..5`)
  }
  const out = new Map<string, string>()
  const add = (path: string): void => {
    const key = normalizeDrlgPath(path)
    if (!out.has(key)) out.set(key, path)
  }
  const extraLevelTypes = new Set<number>()
  if (act1Based === 5) {
    for (let id = 109; id < t.levelDefs.length; id += 1) {
      const def = t.levelDefs[id]
      if (def && def.dwLevelType > 0) extraLevelTypes.add(def.dwLevelType)
    }
  }
  let rows = 0
  for (let typeId = 0; typeId < t.lvlTypes.length; typeId += 1) {
    const rec = t.lvlTypes[typeId]!
    if (rec.nAct !== act1Based && !extraLevelTypes.has(typeId)) continue
    rows += 1
    // DATATBLS_LoadLevelTypesTxt leaves names of one character or less ("0", "") unprefixed: they are
    // unused slots that DRLGROOMTILE_LoadDT1FilesForRoom never opens.
    for (const f of rec.szFile) if (f.length > 1) add(f)
  }
  if (rows === 0) throw new Error(`drlgActDt1Files: LvlTypes has no rows for act ${act1Based}`)
  for (const f of DRLG_HARDCODED_DT1_FILES) add(f)
  return [...out.values()].sort((a, b) => normalizeDrlgPath(a).localeCompare(normalizeDrlgPath(b)))
}

/** The compiled tables `data\global\excel\<name>.bin` of {@link DRLG_TABLE_NAMES}. */
async function readDrlgTableBytes(read: ArchiveReader): Promise<Map<DrlgTableName, Uint8Array>> {
  const tableBytes = new Map<DrlgTableName, Uint8Array>()
  for (const name of DRLG_TABLE_NAMES) {
    tableBytes.set(name, await read(`data\\global\\excel\\${name}.bin`))
  }
  return tableBytes
}

/**
 * Load only the compiled tables: enough to map a generated level (src/game/drlg/drlg-map.ts), not to
 * generate one.
 *
 * @param read - archive reader with the game's priority (e.g. MountedArchives.read).
 */
export async function loadDrlgMpqTables(read: ArchiveReader): Promise<DrlgTables> {
  return loadDrlgTables(memoryDrlgSource(await readDrlgTableBytes(read), new Map()))
}

/**
 * Preload the DRLG inputs for one act from the archives.
 *
 * @param read - archive reader with the game's priority (e.g. MountedArchives.read).
 * @param act1Based - the act whose level types' DT1 libraries are loaded (1..5).
 */
export async function loadDrlgMpqData(read: ArchiveReader, act1Based: number): Promise<DrlgMpqData> {
  const tableBytes = await readDrlgTableBytes(read)
  const tables = loadDrlgTables(memoryDrlgSource(tableBytes, new Map()))
  const files = new Map<string, Uint8Array>()
  const ds1Files = drlgReferencedDs1Files(tables)
  const dt1Files = drlgActDt1Files(tables, act1Based)
  for (const path of [...ds1Files, ...dt1Files]) {
    const key = normalizeDrlgPath(path)
    if (!files.has(key)) files.set(key, await read(path))
  }
  return { source: memoryDrlgSource(tableBytes, files), tables, ds1Files, dt1Files }
}

/**
 * SuperUniques.txt `Superunique` ids in record order: the landmark ids of SuperUnique preset units
 * (src/game/drlg/drlg-map.ts `DrlgMapContext.superUniqueIds`).
 *
 * The compiled table has no record for the text file's `Expansion` separator row, so the text rows are
 * filtered the same way; each remaining row's `hcIdx` must equal its record index and the row count
 * must equal the compiled table's.
 *
 * @param superuniques - SuperUniques.txt.
 * @param tables - the compiled tables the DRLG uses.
 * @returns the ids, by SuperUniques record.
 */
export function drlgSuperUniqueIds(superuniques: D2Table, tables: DrlgTables): string[] {
  const ids = superuniques.rows
    .filter(row => cell(superuniques, row, 'Superunique') !== 'Expansion')
    .map((row, at) => {
      const hcIdx = Number(cell(superuniques, row, 'hcIdx'))
      if (hcIdx !== at) throw new Error(`SuperUniques.txt record ${String(at)} has hcIdx ${String(hcIdx)}`)
      return cell(superuniques, row, 'Superunique').trim()
    })
  if (ids.length !== tables.nSuperUniquesTxtRecordCount) {
    throw new Error(`SuperUniques.txt has ${String(ids.length)} records, superuniques.bin ${String(tables.nSuperUniquesTxtRecordCount)}`)
  }
  return ids
}

/**
 * The decoded DT1 libraries the tiles of one generated level come from, read through a synchronous
 * DRLG source (the same bytes the generator loaded).
 *
 * @param input - the level, from src/game/drlg/drlg-map.ts `drlgLevelInputFromDump`.
 * @param source - the DRLG data source the level was generated from.
 * @param cache - decoded libraries by normalized path, shared across levels.
 * @returns the libraries the level's tiles name, by normalized path.
 */
export function drlgLevelDt1s(input: DrlgLevelInput, source: DrlgDataSource, cache: Map<string, Dt1>): Map<string, Dt1> {
  const out = new Map<string, Dt1>()
  for (const t of input.tiles) {
    if (t.tile === null || out.has(t.tile.library)) continue
    let lib = cache.get(t.tile.library)
    if (lib === undefined) {
      lib = decodeDt1(source.readFile(t.tile.library))
      cache.set(t.tile.library, lib)
    }
    out.set(t.tile.library, lib)
  }
  return out
}
