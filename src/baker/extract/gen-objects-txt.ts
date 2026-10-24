/**
 * Generates src/common/world/objects-txt-113c.ts from the 1.13c `data\\global\\excel\\objects.txt`
 * (Patch_D2.mpq wins over d2exp.mpq / d2data.mpq through the normal mount order).
 *
 * One record per compiled Objects.txt record (D2Common loader 0x6fd8f0c0, record size 0x1C0, 573 records)
 * with the columns the client object light and animation paths read (#827):
 *   Name, Lit0..7, Red, Green, Blue, FrameCnt0..7, FrameDelta0..7, CycleAnim0..7, Start0..7, Sync, IsDoor,
 *   EnvEffect, ClientFn, plus OperateFn for the server object operate dispatch (D2Game table 0x6fd27bb8, #1326).
 *
 * The record index is the row index after Fog 0x6ff628c8 drops the row whose first field is `Expansion`.
 * The Id column is NOT the index (it is wrong for records 410, 411 and 412), so it only appears in comments.
 * `Flicker` is deliberately not extracted: the 1.13c Objects.txt binfield table has no entry for it (the only
 * "Flicker" string xref in D2Common is the Missiles.txt loader 0x6fdcdc1f).
 *
 * Empty numeric cells read as 0, which is how the game's own txt compiler treats them. Any other non-integer
 * cell, a value outside its binfield type, a missing column, a short row, a missing or duplicated `Expansion`
 * row or a record count other than 573 fails the run.
 *
 * Usage: npm run extract:objects-txt   (MPQs from D2_DATA_DIR or samples/d2)
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cell, parseTable, type D2Table } from '../../common/world/acts.ts'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from '../mpq-archive-source.ts'

const OBJECTS_MEMBER = 'data\\global\\excel\\objects.txt'
/** Fog 0x6ff628c8 drops the row whose first field is this text. */
const EXPANSION_ROW = 'Expansion'
/** D2Common 0x6fd8f0c0: 573 records of 0x1C0 bytes in 1.13c. */
const RECORD_COUNT = 573
const MODES = 8
const U8_MAX = 0xff
const U16_MAX = 0xffff
const U32_MAX = 0xffffffff

const PER_MODE_COLUMNS = ['Lit', 'FrameCnt', 'FrameDelta', 'CycleAnim', 'Start'] as const
const SCALAR_COLUMNS = ['Name', 'Id', 'Red', 'Green', 'Blue', 'Sync', 'IsDoor', 'Lockable', 'EnvEffect', 'ClientFn', 'OperateFn'] as const

/** One compiled record, as the generated module stores it. */
export interface ObjectsTxtRow {
  /** Compiled record index (the object class id). */
  readonly index: number
  /** Objects.txt Id column (informational; differs from `index` for records 410..412). */
  readonly idColumn: number
  readonly name: string
  readonly lit: readonly number[]
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly frameCnt: readonly number[]
  readonly frameDelta: readonly number[]
  readonly cycleAnim: readonly number[]
  readonly start: readonly number[]
  readonly sync: number
  readonly isDoor: number
  readonly lockable: number
  readonly envEffect: number
  readonly clientFn: number
  readonly operateFn: number
}

function requiredColumns(): string[] {
  const columns: string[] = [...SCALAR_COLUMNS]
  for (const prefix of PER_MODE_COLUMNS) {
    for (let mode = 0; mode < MODES; mode += 1) columns.push(`${prefix}${String(mode)}`)
  }
  return columns
}

function intCell(table: D2Table, row: readonly string[], column: string, where: string, max: number): number {
  const raw = cell(table, row, column).trim()
  if (raw === '') return 0
  if (!/^\d+$/.test(raw)) throw new Error(`objects.txt ${where}: column ${column} is not an unsigned integer: '${raw}'`)
  const value = Number(raw)
  if (value > max) throw new Error(`objects.txt ${where}: column ${column} = ${raw} exceeds ${String(max)}`)
  return value
}

function perMode(table: D2Table, row: readonly string[], prefix: string, where: string, max: number): number[] {
  const values: number[] = []
  for (let mode = 0; mode < MODES; mode += 1) values.push(intCell(table, row, `${prefix}${String(mode)}`, where, max))
  return values
}

/** Prettier-style quoting: single quotes unless the text contains one. Printable ASCII only. */
function quote(text: string): string {
  if (!/^[\x20-\x7e]*$/.test(text) || text.includes('\\')) throw new Error(`unsupported character in '${text}'`)
  if (!text.includes("'")) return `'${text}'`
  if (text.includes('"')) throw new Error(`string contains both quote kinds: ${text}`)
  return `"${text}"`
}

/**
 * Compiles the parsed objects.txt the way D2Common 0x6fd8f0c0 indexes it.
 *
 * @param table - parsed `data\global\excel\objects.txt`.
 * @returns the 573 records in compiled order.
 */
export function readObjectsTxtRows(table: D2Table): ObjectsTxtRow[] {
  for (const column of requiredColumns()) {
    if (!table.header.includes(column)) throw new Error(`objects.txt has no column ${column}`)
  }
  const expansionRows = table.rows.filter(row => row[0] === EXPANSION_ROW).length
  if (expansionRows !== 1) throw new Error(`objects.txt: expected exactly one '${EXPANSION_ROW}' row, found ${String(expansionRows)}`)
  const rows: ObjectsTxtRow[] = []
  for (const row of table.rows) {
    if (row[0] === EXPANSION_ROW) continue // Fog 0x6ff628c8 memmoves it out before the record loop
    const index = rows.length
    const where = `record ${String(index)}`
    if (row.length !== table.header.length) {
      throw new Error(`objects.txt ${where}: ${String(row.length)} cells, header has ${String(table.header.length)}`)
    }
    rows.push({
      index,
      idColumn: intCell(table, row, 'Id', where, U32_MAX),
      name: cell(table, row, 'Name').trim(),
      lit: perMode(table, row, 'Lit', where, U8_MAX),
      red: intCell(table, row, 'Red', where, U8_MAX),
      green: intCell(table, row, 'Green', where, U8_MAX),
      blue: intCell(table, row, 'Blue', where, U8_MAX),
      frameCnt: perMode(table, row, 'FrameCnt', where, U32_MAX),
      frameDelta: perMode(table, row, 'FrameDelta', where, U16_MAX),
      cycleAnim: perMode(table, row, 'CycleAnim', where, U8_MAX),
      start: perMode(table, row, 'Start', where, U8_MAX),
      sync: intCell(table, row, 'Sync', where, U8_MAX),
      isDoor: intCell(table, row, 'IsDoor', where, U8_MAX),
      lockable: intCell(table, row, 'Lockable', where, U8_MAX),
      envEffect: intCell(table, row, 'EnvEffect', where, U8_MAX),
      clientFn: intCell(table, row, 'ClientFn', where, U8_MAX),
      operateFn: intCell(table, row, 'OperateFn', where, U8_MAX),
    })
  }
  if (rows.length !== RECORD_COUNT) throw new Error(`objects.txt: ${String(rows.length)} records, 1.13c has ${String(RECORD_COUNT)}`)
  return rows
}

const list = (values: readonly number[]): string => `[${values.join(', ')}]`

export function renderObjectsTxt(rows: readonly ObjectsTxtRow[]): string {
  const lines: string[] = [
    '/**',
    ' * Diablo II v1.13c Objects.txt: the columns the client object light and animation paths read (#827).',
    ' * Extracted directly from 1.13c Patch_D2.mpq data\\\\global\\\\excel\\\\objects.txt.',
    ' * Enforces Zero Runtime MPQ/DLL Architectural Invariant.',
    ' *',
    ' * The array index is the compiled record index (D2Common loader 0x6fd8f0c0: 573 records of 0x1C0 bytes), i.e.',
    " * the row order after Fog 0x6ff628c8 drops the `Expansion` separator row. The Id column is NOT the index: it",
    ' * differs for records 410 (Siege Control, Id 408), 411 (ptox, Id 409) and 412 (pyox, Id 410); the trailing',
    ' * comment of each row gives the record index and, where it differs, the Id column.',
    ' * Objects.txt `Flicker` is intentionally absent: 1.13c has no binfield for it, so it has no effect.',
    ' *',
    ' * GENERATED by src/baker/extract/gen-objects-txt.ts (`npm run extract:objects-txt`). Do not edit by hand.',
    ' */',
    '',
    '/** One compiled Objects.txt record. Every number is the raw table value (unsigned). */',
    'export interface ObjectsTxtRecord113c {',
    '  /** Name column */',
    '  readonly name: string',
    '  /** Lit0..7 (record +0x110, u8). SetObjectLight 0x6fad4920 gives the object a light of Lit >> 1 sub-tiles. */',
    '  readonly lit: readonly number[]',
    '  /** Red (record +0x164, u8): light colour, applied when the light is allocated */',
    '  readonly red: number',
    '  /** Green (record +0x165, u8) */',
    '  readonly green: number',
    '  /** Blue (record +0x166, u8) */',
    '  readonly blue: number',
    '  /** FrameCnt0..7 (record +0xD8, u32) as written in the table; the loader shifts it << 8 (0x6fd90b70..0x6fd90bc7) */',
    '  readonly frameCnt: readonly number[]',
    '  /** FrameDelta0..7 (record +0xF8, u16): animation speed in 1/256 frame per 25 Hz game frame */',
    '  readonly frameDelta: readonly number[]',
    '  /** CycleAnim0..7 (record +0x108, u8): 0 = one-shot animation */',
    '  readonly cycleAnim: readonly number[]',
    '  /** Start0..7 (record +0x129, u8): start frame */',
    '  readonly start: readonly number[]',
    '  /** Sync (record +0x175, u8): non-zero = the animation speed is FrameDelta exactly (no random part) */',
    '  readonly sync: number',
    '  /** IsDoor (record +0x13A, u8) */',
    '  readonly isDoor: number',
    '  /** EnvEffect (record +0x139, u8): day/night switch, D2Client 0x6fad5280 */',
    '  readonly envEffect: number',
    '  /** ClientFn (record +0x1B4, u8): client update function index (table 0x6fba54e8) */',
    '  readonly clientFn: number',
    '  /** OperateFn: server operate function index into the D2Game.dll table at 0x6fd27bb8 (#1326) */',
    '  readonly operateFn: number',
    '}',
    '',
    '/**',
    ' * One record, positional so the 573 rows stay one line each:',
    ' * name, Lit0..7, [Red, Green, Blue], FrameCnt0..7, FrameDelta0..7, CycleAnim0..7, Start0..7,',
    ' * Sync, IsDoor, EnvEffect, ClientFn, OperateFn.',
    ' */',
    'function rec(',
    '  name: string,',
    '  lit: readonly number[],',
    '  rgb: readonly [number, number, number],',
    '  frameCnt: readonly number[],',
    '  frameDelta: readonly number[],',
    '  cycleAnim: readonly number[],',
    '  start: readonly number[],',
    '  sync: number,',
    '  isDoor: number,',
    '  envEffect: number,',
    '  clientFn: number,',
    '  operateFn: number,',
    '): ObjectsTxtRecord113c {',
    '  return Object.freeze({',
    '    name,',
    '    lit: Object.freeze(lit),',
    '    red: rgb[0],',
    '    green: rgb[1],',
    '    blue: rgb[2],',
    '    frameCnt: Object.freeze(frameCnt),',
    '    frameDelta: Object.freeze(frameDelta),',
    '    cycleAnim: Object.freeze(cycleAnim),',
    '    start: Object.freeze(start),',
    '    sync,',
    '    isDoor,',
    '    envEffect,',
    '    clientFn,',
    '    operateFn,',
    '  })',
    '}',
    '',
    '/** All 573 compiled records, indexed by object class id (= compiled record index). */',
    'export const OBJECTS_TXT_113C: readonly ObjectsTxtRecord113c[] = Object.freeze([',
  ]
  for (const row of rows) {
    const comment = row.idColumn === row.index ? `${String(row.index)}` : `${String(row.index)} (Id column ${String(row.idColumn)})`
    lines.push(
      `  rec(${quote(row.name)}, ${list(row.lit)}, [${String(row.red)}, ${String(row.green)}, ${String(row.blue)}], ` +
        `${list(row.frameCnt)}, ${list(row.frameDelta)}, ${list(row.cycleAnim)}, ${list(row.start)}, ` +
        `${String(row.sync)}, ${String(row.isDoor)}, ${String(row.envEffect)}, ${String(row.clientFn)}, ${String(row.operateFn)}), // ${comment}`,
    )
  }
  lines.push(
    '])',
    '',
    '/** Objects.txt `Lockable` column, indexed by class id. */',
    'export const OBJECTS_LOCKABLE_113C: ReadonlySet<number> = new Set([',
  )
  for (const row of rows) {
    if (row.lockable !== 0) lines.push(`  ${String(row.index)}, // ${row.name}`)
  }
  lines.push(
    '])',
    '',
    '/**',
    ' * The compiled record of an object class (D2Common #10688 0x6fd8e980 asserts the id is in range).',
    ' *',
    ' * @param classId - object class id (compiled record index).',
    ' * @returns the record.',
    ' * @throws RangeError for a non-integer or out-of-range class id.',
    ' */',
    'export function getObjectsTxtRecord113c(classId: number): ObjectsTxtRecord113c {',
    '  const record = Number.isInteger(classId) ? OBJECTS_TXT_113C[classId] : undefined',
    '  if (record === undefined) {',
    '    throw new RangeError(`Objects.txt has no record ${String(classId)} (1.13c has 0..${String(OBJECTS_TXT_113C.length - 1)})`)',
    '  }',
    '  return record',
    '}',
    '',
  )
  return lines.join('\n')
}

async function main(): Promise<void> {
  const archives = mountNodeArchives(DEFAULT_NODE_MPQ_DIR)
  const table = parseTable(await archives.read(OBJECTS_MEMBER))
  const rows = readObjectsTxtRows(table)
  const target = resolve('src/common/world/objects-txt-113c.ts')
  writeFileSync(target, renderObjectsTxt(rows))
  const lit = rows.filter(r => r.lit.some(v => v !== 0)).length
  const envEffect = rows.filter(r => r.envEffect !== 0).map(r => r.index)
  console.log(`wrote ${target}: ${String(rows.length)} records; ${String(lit)} lit; EnvEffect=[${envEffect.join(',')}]`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
