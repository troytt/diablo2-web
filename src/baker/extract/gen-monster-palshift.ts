/**
 * Generates src/common/units/monster-palshift-113c.ts: the per-monster colormaps D2Client.dll selects through the
 * unit's palette index (gfx+0x38). Issue #1516 / #1517.
 *
 * - `data\global\monsters\<token>\cof\palshift.dat` (8 x 256-byte index remaps, 2048 bytes). D2Client loads it per
 *   monster class in 0x6fb03c30 (path built from MonStats Code + `\Cof\palshift.dat`); a class whose token ships no
 *   palshift.dat keeps a NULL entry, and 0x6fb03a30 then draws it without any colormap whatever its palette index.
 * - MonStats.txt `TransLvl` (compiled +0x4D), read by the monster create path 0x6fb57a5e.
 * - MonStats2.txt `Utrans`, `Utrans(N)`, `Utrans(H)` (compiled +0x122 + difficulty), read at 0x6fb57ab0.
 * - SuperUniques.txt `Utrans`, `Utrans(N)`, `Utrans(H)` (compiled +0x28 + difficulty), read at 0x6fb57b0f.
 *
 * Identical 256-byte tables are stored once. Empty numeric cells read as 0 (the txt compiler's rule); a value outside
 * 0..255, a palshift.dat that is not 2048 bytes, or a MonStatsEx without a MonStats2 row fails the run.
 *
 * Usage: npm run extract:monster-palshift   (MPQs from D2_DATA_DIR or samples/d2)
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cell, parseTable, type D2Table } from '../../common/world/acts.ts'
import { mountNodeArchives } from '../mpq-archive-source.ts'

const PALSHIFT_BYTES = 8 * 256

function byteCell(table: D2Table, row: readonly string[], column: string, where: string): number {
  if (!table.header.includes(column)) throw new Error(`${where}: no column ${column}`)
  const raw = cell(table, row, column).trim()
  if (raw === '') return 0
  if (!/^\d+$/.test(raw)) throw new Error(`${where}: ${column} is not an unsigned integer: '${raw}'`)
  const value = Number(raw)
  if (value > 255) throw new Error(`${where}: ${column} = ${value} does not fit a byte`)
  return value
}

export interface MonsterPalshiftData {
  /** Unique 256-byte remap tables. */
  readonly tables: Uint8Array[]
  /** Lower-case token -> 8 indices into `tables`. */
  readonly byToken: Map<string, number[]>
  /** Per MonStats hcIdx: [token (lower case), TransLvl, Utrans, Utrans(N), Utrans(H)]. */
  readonly monsters: [string, number, number, number, number][]
  /** Per SuperUniques hcIdx: [Utrans, Utrans(N), Utrans(H)]. */
  readonly superUniques: [number, number, number][]
}

export function readMonsterPalshift(readFile: (path: string) => Uint8Array | null, readTable: (path: string) => D2Table): MonsterPalshiftData {
  const monStats = readTable('data\\global\\excel\\monstats.txt')
  const monStats2 = readTable('data\\global\\excel\\monstats2.txt')
  const superUniques = readTable('data\\global\\excel\\superuniques.txt')
  const ms2ById = new Map<string, readonly string[]>()
  for (const row of monStats2.rows) {
    const key = cell(monStats2, row, 'Id').trim()
    if (key === '' || key.toLowerCase() === 'expansion') continue
    ms2ById.set(key, row)
  }
  const tables: Uint8Array[] = []
  const tableIndex = new Map<string, number>()
  const byToken = new Map<string, number[]>()
  const monsterRows = new Map<number, readonly string[]>()
  for (const row of monStats.rows) {
    const id = cell(monStats, row, 'hcIdx').trim()
    if (/^\d+$/.test(id)) monsterRows.set(Number(id), row)
  }
  const monsters: [string, number, number, number, number][] = []
  for (let hcIdx = 0; hcIdx < monsterRows.size; hcIdx += 1) {
    const row = monsterRows.get(hcIdx)
    if (row === undefined) throw new Error(`MonStats.txt: missing hcIdx ${hcIdx}`)
    const where = `MonStats.txt hcIdx ${hcIdx}`
    const token = cell(monStats, row, 'Code').trim().toLowerCase()
    const ex = cell(monStats, row, 'MonStatsEx').trim()
    const ms2 = ms2ById.get(ex)
    if (ms2 === undefined) throw new Error(`${where}: MonStatsEx '${ex}' has no MonStats2.txt row`)
    const w2 = `MonStats2.txt Id ${ex}`
    monsters.push([
      token,
      byteCell(monStats, row, 'TransLvl', where),
      byteCell(monStats2, ms2, 'Utrans', w2),
      byteCell(monStats2, ms2, 'Utrans(N)', w2),
      byteCell(monStats2, ms2, 'Utrans(H)', w2),
    ])
    if (token === '' || byToken.has(token)) continue
    const bytes = readFile(`data\\global\\monsters\\${token}\\cof\\palshift.dat`)
    if (bytes === null) continue
    if (bytes.length !== PALSHIFT_BYTES) throw new Error(`${token}\\cof\\palshift.dat is ${bytes.length} bytes, expected ${PALSHIFT_BYTES}`)
    const indices: number[] = []
    for (let k = 0; k < 8; k += 1) {
      const table = bytes.slice(k * 256, (k + 1) * 256)
      const key = Buffer.from(table).toString('base64')
      let idx = tableIndex.get(key)
      if (idx === undefined) {
        idx = tables.length
        tables.push(table)
        tableIndex.set(key, idx)
      }
      indices.push(idx)
    }
    byToken.set(token, indices)
  }
  const suRows = new Map<number, readonly string[]>()
  for (const row of superUniques.rows) {
    const id = cell(superUniques, row, 'hcIdx').trim()
    if (/^\d+$/.test(id)) suRows.set(Number(id), row)
  }
  const su: [number, number, number][] = []
  for (let id = 0; id < suRows.size; id += 1) {
    const row = suRows.get(id)
    if (row === undefined) throw new Error(`SuperUniques.txt: missing hcIdx ${id}`)
    const where = `SuperUniques.txt hcIdx ${id}`
    su.push([byteCell(superUniques, row, 'Utrans', where), byteCell(superUniques, row, 'Utrans(N)', where), byteCell(superUniques, row, 'Utrans(H)', where)])
  }
  return { tables, byToken, monsters, superUniques: su }
}

export function renderMonsterPalshiftModule(data: MonsterPalshiftData): string {
  const lines: string[] = []
  lines.push('/**')
  lines.push(' * Diablo II v1.13c per-monster colormaps (`data\\\\global\\\\monsters\\\\<token>\\\\cof\\\\palshift.dat`) and the')
  lines.push(' * palette-index columns D2Client.dll reads when it creates a monster unit (issue #1516 / #1517):')
  lines.push(' * MonStats.txt `TransLvl` (+0x4D), MonStats2.txt `Utrans`/`Utrans(N)`/`Utrans(H)` (+0x122) and SuperUniques.txt')
  lines.push(' * `Utrans`/`Utrans(N)`/`Utrans(H)` (+0x28). Extracted from the 1.13c MPQs (Patch_D2 > d2exp > d2data).')
  lines.push(' *')
  lines.push(' * GENERATED by src/baker/extract/gen-monster-palshift.ts (`npm run extract:monster-palshift`). Do not edit by hand.')
  lines.push(' */')
  lines.push('')
  lines.push(`/** ${data.tables.length} distinct 256-byte palette index remap tables, base64, concatenated. */`)
  lines.push('export const MONSTER_PALSHIFT_TABLES_B64 =')
  const all = Buffer.concat(data.tables.map(t => Buffer.from(t))).toString('base64')
  for (let i = 0; i < all.length; i += 100) {
    lines.push(`  '${all.slice(i, i + 100)}'${i + 100 < all.length ? ' +' : ''}`)
  }
  lines.push('')
  lines.push('/** Lower-case token -> the 8 palshift.dat entries as indices into the table blob. Tokens without palshift.dat are absent. */')
  lines.push('export const MONSTER_PALSHIFT_BY_TOKEN: Readonly<Record<string, readonly number[]>> = {')
  for (const [token, idx] of [...data.byToken].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    lines.push(`  ${JSON.stringify(token)}: [${idx.join(', ')}],`)
  }
  lines.push('}')
  lines.push('')
  lines.push('/** Per MonStats hcIdx: [token (lower case), TransLvl, Utrans, Utrans(N), Utrans(H)]. */')
  lines.push('export const MONSTER_PALETTE_COLUMNS_113C: readonly (readonly [string, number, number, number, number])[] = [')
  data.monsters.forEach((m, i) => lines.push(`  [${JSON.stringify(m[0])}, ${m[1]}, ${m[2]}, ${m[3]}, ${m[4]}], // ${i}`))
  lines.push(']')
  lines.push('')
  lines.push('/** Per SuperUniques hcIdx: [Utrans, Utrans(N), Utrans(H)]. */')
  lines.push('export const SUPERUNIQUE_UTRANS_113C: readonly (readonly [number, number, number])[] = [')
  data.superUniques.forEach((s, i) => lines.push(`  [${s.join(', ')}], // ${i}`))
  lines.push(']')
  lines.push('')
  return lines.join('\n')
}

export function main(): void {
  const mounted = mountNodeArchives()
  const data = readMonsterPalshift(
    path => mounted.readFile(path),
    path => parseTable(mounted.readBytes(path)),
  )
  const out = resolve(import.meta.dirname, '..', '..', 'common', 'units', 'monster-palshift-113c.ts')
  writeFileSync(out, renderMonsterPalshiftModule(data))
  console.log(`wrote ${out}: ${data.tables.length} tables, ${data.byToken.size} tokens, ${data.monsters.length} monsters`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
