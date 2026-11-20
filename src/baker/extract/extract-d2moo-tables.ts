/**
 * Extracts the game data the native D2MOO oracle (tools/d2moo-oracle) loads:
 *   <out>/tables/<name>.bin                  compiled 1.13c data tables
 *   <out>/mpq/data/global/tiles/<path>.ds1   every DS1 referenced by LvlPrest.txt / LvlSub.txt
 *   <out>/mpq/data/global/tiles/<path>.dt1   every DT1 the DRLG loads (LvlTypes.txt + hardcoded ones)
 *
 * Files are resolved with the game's MPQ priority (Patch_D2 > d2exp > d2data), the same archives
 * the asset packer reads, so the oracle and the TypeScript port consume identical game data.
 * Any missing table, DS1 or DT1 is a hard error.
 *
 * Usage: npx tsx scripts/extract-d2moo-tables.ts [d2Dir=samples/d2] [outDir=tools/d2moo-oracle/data]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'

const d2Dir = resolve(process.argv[2] ?? 'samples/d2')
const outDir = resolve(process.argv[3] ?? 'tools/d2moo-oracle/data')

const MPQ_PRIORITY = ['Patch_D2.mpq', 'd2exp.mpq', 'd2data.mpq'] as const
// Tables loaded by D2MOO's LevelsTbls.cpp plus the ones DRLGPRESET_LoadDrlgFile consults.
const TABLES = [
  'levels', 'leveldefs', 'lvlprest', 'lvltypes', 'lvlwarp', 'lvlmaze', 'lvlsub',
  'objects', 'monpreset', 'superuniques', 'monstats',
] as const

const archives: { name: string; mpq: MpqArchive }[] = []
for (const name of MPQ_PRIORITY) {
  archives.push({ name, mpq: await MpqArchive.open(await fileSource(join(d2Dir, name))) })
}

async function readFirst(mpqPath: string): Promise<Uint8Array> {
  for (const { mpq } of archives) {
    const entry = mpq.find(mpqPath)
    if (entry !== undefined) return mpq.read(entry)
  }
  throw new Error(`${mpqPath} not found in ${MPQ_PRIORITY.join(', ')} under ${d2Dir}`)
}

function write(path: string, bytes: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, bytes)
}

for (const table of TABLES) {
  const bytes = await readFirst(`data\\global\\excel\\${table}.bin`)
  write(join(outDir, 'tables', `${table}.bin`), bytes)
}

const ds1Paths = new Set<string>()
for (const txt of ['LvlPrest.txt', 'LvlSub.txt']) {
  const text = new TextDecoder().decode(await readFirst(`data\\global\\excel\\${txt}`))
  for (const line of text.split(/\r?\n/).slice(1)) {
    for (const column of line.split('\t')) {
      const value = column.trim()
      if (value.toLowerCase().endsWith('.ds1')) ds1Paths.add(value.replace(/\//g, '\\'))
    }
  }
}

for (const rel of ds1Paths) {
  const bytes = await readFirst(`data\\global\\tiles\\${rel}`)
  write(join(outDir, 'mpq', 'data', 'global', 'tiles', ...rel.toLowerCase().split('\\')), bytes)
}

// DT1 tile libraries: every LvlTypes.txt File column (DATATBLS_LoadLevelTypesTxt prefixes them with
// DATA\GLOBAL\TILES), the three universal libraries of DRLGROOMTILE_LoadDT1FilesForRoom
// (DrlgRoomTile.cpp:1249-1256) and the act libraries of DRLG_AllocDrlg (DrlgDrlg.cpp:47-76).
// D2CMP's tile lookups feed rarity sums into the room seed during LvlSub shadow stamping.
const dt1Paths = new Set<string>([
  'Act1\\Outdoors\\Blank.dt1',
  'Act1\\Barracks\\InvisWal.dt1',
  'Act1\\Barracks\\Warp.dt1',
  'Act1\\Town\\Floor.dt1',
  'Act2\\Town\\Ground.dt1',
  'ACT3\\Kurast\\sets.dt1',
])
{
  const text = new TextDecoder().decode(await readFirst('data\\global\\excel\\LvlTypes.txt'))
  for (const line of text.split(/\r?\n/).slice(1)) {
    for (const column of line.split('\t')) {
      const value = column.trim()
      if (value.toLowerCase().endsWith('.dt1')) dt1Paths.add(value.replace(/\//g, '\\'))
    }
  }
}

for (const rel of dt1Paths) {
  const bytes = await readFirst(`data\\global\\tiles\\${rel}`)
  write(join(outDir, 'mpq', 'data', 'global', 'tiles', ...rel.toLowerCase().split('\\')), bytes)
}

console.log(`extracted ${TABLES.length} tables, ${ds1Paths.size} DS1 files and ${dt1Paths.size} DT1 files from ${d2Dir} to ${outDir}`)
