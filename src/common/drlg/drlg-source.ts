/**
 * Game data access for the DRLG port.
 *
 * D2Common reads the compiled tables and DS1/DT1 files synchronously from the mounted archives; the
 * port keeps that shape: a {@link DrlgDataSource} returns bytes synchronously, so callers either read
 * from disk (Node tooling) or preload the files into memory ({@link memoryDrlgSource}) before
 * generating. Archive paths are case-insensitive and use backslashes, exactly like the MPQ hash.
 */

import { loadDrlgTables, type DrlgDataSource, type DrlgTableName, type DrlgTables } from './drlg-tables.ts'
import type { DrlgEnv } from './drlg-types.ts'

/** The compiled tables the port loads (data\global\excel\<name>.bin). */
export const DRLG_TABLE_NAMES: readonly DrlgTableName[] = [
  'levels',
  'leveldefs',
  'lvlprest',
  'lvltypes',
  'lvlwarp',
  'lvlmaze',
  'lvlsub',
  'objects',
  'monpreset',
  'monstats',
  'superuniques',
]

/** MPQ-style path key: backslashes, lower case. */
export function normalizeDrlgPath(path: string): string {
  return path.replace(/\//g, '\\').toLowerCase()
}

/** A source over preloaded bytes. Missing tables or files are hard errors. */
export function memoryDrlgSource(
  tables: ReadonlyMap<DrlgTableName, Uint8Array>,
  files: ReadonlyMap<string, Uint8Array>,
): DrlgDataSource {
  return {
    readTable(name: DrlgTableName): Uint8Array {
      const bytes = tables.get(name)
      if (!bytes) throw new Error(`DRLG data: table ${name}.bin was not loaded`)
      return bytes
    },
    readFile(path: string): Uint8Array {
      const bytes = files.get(normalizeDrlgPath(path))
      if (!bytes) throw new Error(`DRLG data: ${path} was not loaded`)
      return bytes
    },
  }
}

/**
 * Every DS1 the DRLG may open through DRLGPRESET_LoadDrlgFile: the LvlPrest File1..6 and LvlSub
 * File columns, as converted by DATATBLS_LoadLvlPrestTxt / LoadLvlSubTxt (names of one character
 * or less are unused placeholders and are never prefixed).
 */
export function drlgReferencedDs1Files(t: DrlgTables): string[] {
  const out = new Set<string>()
  const add = (name: string): void => {
    if (name.length > 1) out.add(name)
  }
  for (const rec of t.lvlPrest) for (const f of rec.szFile) add(f)
  for (const rec of t.lvlSub) add(rec.szFile)
  return [...out].sort()
}

/**
 * A fresh DRLG environment: parsed tables plus an empty DS1 cache (gpLevelFilesList_6FDEA700).
 * Pass `tables` to reuse an already parsed set (the tables are immutable; the DS1 cache is not, since
 * DRLGPRESET_InitPresetRoomGrids edits cached layers in place).
 */
export function createDrlgEnv(data: DrlgDataSource, tables: DrlgTables = loadDrlgTables(data)): DrlgEnv {
  return { tables, data, fileCache: new Map(), lvlSubFiles: new Map(), dt1Cache: new Map() }
}
