/**
 * Generates src/common/world/levels-monlvl-113c.ts from the 1.13c `data\\global\\excel\\levels.txt`
 * (Patch_D2.mpq wins over d2exp.mpq / d2data.mpq through the normal mount order).
 *
 * One record per Levels.txt `Id` (0..136) with the columns the server item-drop paths read (#1326):
 *   Id, Name, Act, MonLvl1..3 (classic), MonLvl1Ex..3Ex (expansion).
 *
 * D2Common's level monster-level getter (D2Game import thunk 0x6fc2ada8, called as
 * `(levelId, nDifficulty = pGame+0x6d, bExpansion = pGame+0x70)`) returns `MonLvl{diff+1}Ex` in expansion
 * games and `MonLvl{diff+1}` otherwise. D2Game 0x6fc8b570 (chest drop) uses it to pick the
 * `Act N Chest A/B/C` treasure class.
 *
 * Empty numeric cells read as 0, which is how the game's own txt compiler treats them. Any other non-integer
 * cell, a missing column, a short row, a duplicated Id or an Id gap fails the run.
 *
 * Usage: npm run extract:levels-monlvl   (MPQs from D2_DATA_DIR or samples/d2)
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cell, parseTable, type D2Table } from '../../common/world/acts.ts'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from '../mpq-archive-source.ts'

const LEVELS_MEMBER = 'data\\global\\excel\\levels.txt'
/** Fog drops the row whose first field is this text before compiling. */
const EXPANSION_ROW = 'Expansion'
/** 1.13c Levels.txt has 137 records (Id 0..136). */
const RECORD_COUNT = 137
const U8_MAX = 0xff

const COLUMNS = ['Name', 'Id', 'Act', 'MonLvl1', 'MonLvl2', 'MonLvl3', 'MonLvl1Ex', 'MonLvl2Ex', 'MonLvl3Ex'] as const

/** One compiled Levels.txt record, as the generated module stores it. */
export interface LevelsMonLvlRow {
  readonly id: number
  readonly name: string
  readonly act: number
  readonly monLvl: readonly [number, number, number]
  readonly monLvlEx: readonly [number, number, number]
}

function intCell(table: D2Table, row: readonly string[], column: string, where: string, max: number): number {
  const raw = cell(table, row, column).trim()
  if (raw === '') return 0
  if (!/^\d+$/.test(raw)) throw new Error(`levels.txt ${where}: column ${column} is not an unsigned integer: '${raw}'`)
  const value = Number(raw)
  if (value > max) throw new Error(`levels.txt ${where}: column ${column} = ${raw} exceeds ${String(max)}`)
  return value
}

/** Prettier-style quoting: single quotes unless the text contains one. Printable ASCII only. */
function quote(text: string): string {
  if (!/^[\x20-\x7e]*$/.test(text) || text.includes('\\')) throw new Error(`unsupported character in '${text}'`)
  if (!text.includes("'")) return `'${text}'`
  if (text.includes('"')) throw new Error(`string contains both quote kinds: ${text}`)
  return `"${text}"`
}

/**
 * Reads the parsed levels.txt into Id-ordered records.
 *
 * @param table - parsed `data\global\excel\levels.txt`.
 * @returns the 137 records, index = Id.
 */
export function readLevelsMonLvlRows(table: D2Table): LevelsMonLvlRow[] {
  for (const column of COLUMNS) {
    if (!table.header.includes(column)) throw new Error(`levels.txt has no column ${column}`)
  }
  const rows: LevelsMonLvlRow[] = []
  for (const row of table.rows) {
    if (row[0] === EXPANSION_ROW) continue
    const where = `row ${String(rows.length)}`
    if (row.length !== table.header.length) {
      throw new Error(`levels.txt ${where}: ${String(row.length)} cells, header has ${String(table.header.length)}`)
    }
    const id = intCell(table, row, 'Id', where, 0xffff)
    if (id !== rows.length) throw new Error(`levels.txt ${where}: Id ${String(id)} is not the next record index ${String(rows.length)}`)
    rows.push({
      id,
      name: cell(table, row, 'Name').trim(),
      act: intCell(table, row, 'Act', where, 4),
      monLvl: [
        intCell(table, row, 'MonLvl1', where, U8_MAX),
        intCell(table, row, 'MonLvl2', where, U8_MAX),
        intCell(table, row, 'MonLvl3', where, U8_MAX),
      ],
      monLvlEx: [
        intCell(table, row, 'MonLvl1Ex', where, U8_MAX),
        intCell(table, row, 'MonLvl2Ex', where, U8_MAX),
        intCell(table, row, 'MonLvl3Ex', where, U8_MAX),
      ],
    })
  }
  if (rows.length !== RECORD_COUNT) throw new Error(`levels.txt: ${String(rows.length)} records, 1.13c has ${String(RECORD_COUNT)}`)
  return rows
}

const triple = (v: readonly [number, number, number]): string => `[${v.join(', ')}]`

export function renderLevelsMonLvl(rows: readonly LevelsMonLvlRow[]): string {
  const lines: string[] = [
    '/**',
    ' * Diablo II v1.13c Levels.txt: Act and the monster-level columns the server item-drop paths read (#1326).',
    ' * Extracted directly from 1.13c Patch_D2.mpq data\\\\global\\\\excel\\\\levels.txt.',
    ' * Enforces Zero Runtime MPQ/DLL Architectural Invariant.',
    ' *',
    ' * The array index is the Levels.txt Id (0..136). D2Common\'s level monster-level getter (D2Game import thunk',
    ' * 0x6fc2ada8) returns `MonLvl{diff+1}Ex` in expansion games and `MonLvl{diff+1}` in classic games.',
    ' *',
    ' * GENERATED by src/baker/extract/gen-levels-monlvl-113c.ts (`npm run extract:levels-monlvl`). Do not edit by hand.',
    ' */',
    '',
    '/** One compiled Levels.txt record. */',
    'export interface LevelsMonLvlRecord113c {',
    '  /** Name column */',
    '  readonly name: string',
    '  /** Act column (0..4) */',
    '  readonly act: number',
    '  /** MonLvl1, MonLvl2, MonLvl3 (classic Normal / Nightmare / Hell) */',
    '  readonly monLvl: readonly [number, number, number]',
    '  /** MonLvl1Ex, MonLvl2Ex, MonLvl3Ex (expansion Normal / Nightmare / Hell) */',
    '  readonly monLvlEx: readonly [number, number, number]',
    '}',
    '',
    'function rec(',
    '  name: string,',
    '  act: number,',
    '  monLvl: readonly [number, number, number],',
    '  monLvlEx: readonly [number, number, number],',
    '): LevelsMonLvlRecord113c {',
    '  return Object.freeze({ name, act, monLvl: Object.freeze(monLvl), monLvlEx: Object.freeze(monLvlEx) })',
    '}',
    '',
    '/** All 137 records, indexed by Levels.txt Id. */',
    'export const LEVELS_MONLVL_113C: readonly LevelsMonLvlRecord113c[] = Object.freeze([',
  ]
  for (const row of rows) {
    lines.push(`  rec(${quote(row.name)}, ${String(row.act)}, ${triple(row.monLvl)}, ${triple(row.monLvlEx)}), // ${String(row.id)}`)
  }
  lines.push(
    '])',
    '',
    '/**',
    ' * The compiled record of a level.',
    ' *',
    ' * @param levelId - Levels.txt Id.',
    ' * @returns the record.',
    ' * @throws RangeError for a non-integer or out-of-range level id.',
    ' */',
    'export function getLevelsMonLvlRecord113c(levelId: number): LevelsMonLvlRecord113c {',
    '  const record = Number.isInteger(levelId) ? LEVELS_MONLVL_113C[levelId] : undefined',
    '  if (record === undefined) {',
    '    throw new RangeError(`Levels.txt has no record ${String(levelId)} (1.13c has 0..${String(LEVELS_MONLVL_113C.length - 1)})`)',
    '  }',
    '  return record',
    '}',
    '',
    '/**',
    ' * The level monster level D2Common returns for `(levelId, difficulty, expansion)` (thunk 0x6fc2ada8).',
    ' *',
    ' * @param levelId - Levels.txt Id.',
    ' * @param difficulty - 0 Normal, 1 Nightmare, 2 Hell.',
    ' * @param expansion - read the `Ex` columns.',
    ' * @returns the level monster level.',
    ' */',
    'export function getLevelMonsterLevel113c(levelId: number, difficulty: 0 | 1 | 2, expansion = true): number {',
    '  const record = getLevelsMonLvlRecord113c(levelId)',
    '  return (expansion ? record.monLvlEx : record.monLvl)[difficulty]',
    '}',
    '',
  )
  return lines.join('\n')
}

async function main(): Promise<void> {
  const archives = mountNodeArchives(DEFAULT_NODE_MPQ_DIR)
  const table = parseTable(await archives.read(LEVELS_MEMBER))
  const rows = readLevelsMonLvlRows(table)
  const target = resolve('src/common/world/levels-monlvl-113c.ts')
  writeFileSync(target, renderLevelsMonLvl(rows))
  console.log(`wrote ${target}: ${String(rows.length)} records`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
