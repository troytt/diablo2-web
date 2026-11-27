/**
 * Generator for `src/client/ui-model/stat-engine/generated-states-skills.ts`.
 *
 * Reads the 1.13c `States.txt`, `Skills.txt`, `SkillDesc.txt`, `ElemTypes.txt` and `ItemStatCost.txt`
 * from the user's mounted MPQs (`MPQ_LOAD_ORDER`, patch_d2.mpq wins) and emits the subset of columns
 * the character-sheet stat engine needs (PROJECT.md rules 10, 16, 20):
 * - States.txt: the char-screen colour flags (`attblue/damblue/armblue/r?blue/attred/damred/armred/r?red`).
 * - Skills.txt (+ SkillDesc.txt `SkillPage`, ElemTypes.txt index of `EType`): the fields used by
 *   D2Common `SKILLS_GetBonusSkillLevel` (#D2Skills.cpp 0x6FDB1580) and `SKILLS_RefreshSkill`
 *   (#10940): charclass, page, element, passivestate/passiveitype/passivestat1..5/passivecalc1..5,
 *   aurastate, auratargetstate, Param1..8.
 *
 * The embedded table keeps vitest and the browser deterministic (no MPQ needed at runtime) and is
 * NEVER hand-edited: re-run this script against a 1.13c install to regenerate it.
 *
 * Usage: npx tsx tools/gen-stat-engine-tables.ts [mpqDir]   (default: samples/d2)
 */
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createNodeMpqArchiveSource } from '../src/baker/mpq-archive-source.ts'

interface RawTable {
  readonly name: string
  readonly sha256: string
  readonly header: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const mpqDir = process.argv[2] ?? join(repoRoot, 'samples', 'd2')
const outPath = join(repoRoot, 'src', 'client', 'ui-model', 'stat-engine', 'generated-states-skills.ts')

const archives = createNodeMpqArchiveSource(mpqDir)

function readTable(name: string): RawTable {
  const text = archives.readText(`data\\global\\excel\\${name}`)
  const lines = text.split(/\r?\n/).filter(line => line.length > 0)
  const headerLine = lines.shift()
  if (headerLine === undefined) throw new Error(`${name}: empty table`)
  return {
    name,
    sha256: createHash('sha256').update(text, 'latin1').digest('hex'),
    header: headerLine.split('\t'),
    rows: lines.map(line => line.split('\t')),
  }
}

function col(table: RawTable, column: string): number {
  const index = table.header.indexOf(column)
  if (index === -1) throw new Error(`${table.name}: missing column '${column}'`)
  return index
}

function cellAt(table: RawTable, row: readonly string[], column: string): string {
  return (row[col(table, column)] ?? '').trim()
}

function intOrThrow(table: RawTable, row: readonly string[], column: string): number {
  const text = cellAt(table, row, column)
  const n = Number(text)
  if (text === '' || !Number.isInteger(n)) throw new Error(`${table.name}: non-integer '${column}'='${text}'`)
  return n
}

/** Numeric cell where blank means the engine's zero-initialised field (D2 txt loader semantics). */
function intOrBlankZero(table: RawTable, row: readonly string[], column: string): number {
  const text = cellAt(table, row, column)
  if (text === '') return 0
  const n = Number(text)
  if (!Number.isInteger(n)) throw new Error(`${table.name}: non-integer '${column}'='${text}'`)
  return n
}

const states = readTable('States.txt')
const skills = readTable('Skills.txt')
const skillDesc = readTable('SkillDesc.txt')
const elemTypes = readTable('ElemTypes.txt')
const isc = readTable('ItemStatCost.txt')

// ---- name -> index resolvers (the D2 txt linker resolves these columns by row key) ----
const stateIdByName = new Map<string, number>()
for (const row of states.rows) {
  const name = cellAt(states, row, 'state')
  if (name === '' || name === 'Expansion') continue
  stateIdByName.set(name, intOrThrow(states, row, 'id'))
}
function stateRef(name: string, context: string): number | null {
  if (name === '') return null
  const id = stateIdByName.get(name)
  if (id === undefined) throw new Error(`unresolved state '${name}' (${context})`)
  return id
}

const iscIdByName = new Map<string, number>()
for (const row of isc.rows) {
  const name = cellAt(isc, row, 'Stat')
  if (name === '' || name === 'Expansion') continue
  iscIdByName.set(name, intOrThrow(isc, row, 'ID'))
}

const elemIndexByCode = new Map<string, number>()
elemTypes.rows.forEach((row, index) => {
  const code = cellAt(elemTypes, row, 'Code')
  if (code !== '') elemIndexByCode.set(code, index)
})

const skillPageByDesc = new Map<string, number>()
for (const row of skillDesc.rows) {
  const key = cellAt(skillDesc, row, 'skilldesc')
  if (key === '' || key === 'Expansion') continue
  skillPageByDesc.set(key, intOrBlankZero(skillDesc, row, 'SkillPage'))
}

// ---- States.txt colour flags (rule 16) ----
const STATE_FLAG_COLUMNS = [
  'attblue', 'damblue', 'armblue', 'rfblue', 'rlblue', 'rcblue', 'rpblue',
  'attred', 'damred', 'armred', 'rfred', 'rlred', 'rcred', 'rpred',
] as const
const stateLines: string[] = []
for (const row of states.rows) {
  const name = cellAt(states, row, 'state')
  if (name === '' || name === 'Expansion') continue
  const id = intOrThrow(states, row, 'id')
  const flags = STATE_FLAG_COLUMNS.filter(c => {
    const v = cellAt(states, row, c)
    if (v !== '' && v !== '0' && v !== '1') throw new Error(`States.txt: flag ${c}='${v}' for ${name}`)
    return v === '1'
  })
  stateLines.push(`  { id: ${id}, state: ${JSON.stringify(name)}, flags: [${flags.map(f => JSON.stringify(f)).join(', ')}] },`)
}

// ---- Skills.txt subset (rules 10, 21; effectiveSkillLevel) ----
const skillLines: string[] = []
for (const row of skills.rows) {
  const name = cellAt(skills, row, 'skill')
  if (name === '' || name === 'Expansion') continue
  const id = intOrThrow(skills, row, 'Id')
  const charclass = cellAt(skills, row, 'charclass')
  const desc = cellAt(skills, row, 'skilldesc')
  let skillPage = 0
  if (desc !== '') {
    const page = skillPageByDesc.get(desc)
    if (page === undefined) throw new Error(`Skills.txt ${name}: unresolved skilldesc '${desc}'`)
    skillPage = page
  }
  const eTypeCode = cellAt(skills, row, 'EType')
  let eType = 0
  if (eTypeCode !== '') {
    const idx = elemIndexByCode.get(eTypeCode)
    if (idx === undefined) throw new Error(`Skills.txt ${name}: unresolved EType '${eTypeCode}'`)
    eType = idx
  }
  const passiveStats: string[] = []
  for (let i = 1; i <= 5; i++) {
    const statName = cellAt(skills, row, `passivestat${i}`)
    const calc = cellAt(skills, row, `passivecalc${i}`)
    if (statName === '') {
      // SKILLS_RefreshSkill stops at the first invalid passivestat (D2Skills.cpp #10940 loop `break`).
      break
    }
    const statId = iscIdByName.get(statName)
    if (statId === undefined) throw new Error(`Skills.txt ${name}: unresolved passivestat${i} '${statName}'`)
    passiveStats.push(`{ stat: ${statId}, calc: ${JSON.stringify(calc)} }`)
  }
  const params: number[] = []
  for (let i = 1; i <= 8; i++) params.push(intOrBlankZero(skills, row, `Param${i}`))
  const passiveState = stateRef(cellAt(skills, row, 'passivestate'), `${name}.passivestate`)
  const auraState = stateRef(cellAt(skills, row, 'aurastate'), `${name}.aurastate`)
  const auraTargetState = stateRef(cellAt(skills, row, 'auratargetstate'), `${name}.auratargetstate`)
  const passiveItype = cellAt(skills, row, 'passiveitype')
  skillLines.push(
    `  { id: ${id}, skill: ${JSON.stringify(name)}, charclass: ${JSON.stringify(charclass)}, skillPage: ${skillPage}, ` +
      `eType: ${eType}, passiveState: ${passiveState === null ? 'null' : passiveState}, ` +
      `passiveItype: ${JSON.stringify(passiveItype)}, passiveStats: [${passiveStats.join(', ')}], ` +
      `auraState: ${auraState === null ? 'null' : auraState}, auraTargetState: ${auraTargetState === null ? 'null' : auraTargetState}, ` +
      `params: [${params.join(', ')}] },`,
  )
}

const provenance = [states, skills, skillDesc, elemTypes, isc]
  .map(t => `  { file: 'data\\\\global\\\\excel\\\\${t.name}', sha256: '${t.sha256}', rows: ${t.rows.length} },`)
  .join('\n')

const out = `/**
 * GENERATED FILE — do not edit by hand. Regenerate with:
 *   npx tsx tools/gen-stat-engine-tables.ts [mpqDir]
 *
 * Subset of the Diablo II v1.13c MPQ tables (mounted in MPQ_LOAD_ORDER, Patch_D2.mpq first) used by
 * the character-sheet stat engine (PROJECT.md rules 10, 16, 20). Name references are resolved the way
 * the D2 txt linker resolves them (state / ItemStatCost / ElemTypes / SkillDesc row keys).
 */

/** Source tables and their SHA-256 (latin1 text) for provenance. */
export const GENERATED_SOURCE_TABLES: readonly { readonly file: string; readonly sha256: string; readonly rows: number }[] = [
${provenance}
]

/** States.txt colour columns that the character screen honours (rule 16). */
export type StatesTxtColorFlag =
${STATE_FLAG_COLUMNS.map(c => `  | '${c}'`).join('\n')}

export interface StatesTxtColorRow {
  readonly id: number
  readonly state: string
  readonly flags: readonly StatesTxtColorFlag[]
}

/** Every States.txt row: id, key and the set colour flags (\`1\` cells). */
export const STATES_TXT_COLOR_ROWS: readonly StatesTxtColorRow[] = [
${stateLines.join('\n')}
]

export interface SkillsTxtPassiveStat {
  /** ItemStatCost id of \`passivestatN\`. */
  readonly stat: number
  /** Raw \`passivecalcN\` expression. */
  readonly calc: string
}

export interface SkillsTxtRow {
  readonly id: number
  readonly skill: string
  /** \`charclass\` code ('' for non-class skills). */
  readonly charclass: string
  /** SkillDesc.txt \`SkillPage\` of the row's \`skilldesc\` (0 = none). */
  readonly skillPage: number
  /** ElemTypes.txt row index of \`EType\` (0 = none). */
  readonly eType: number
  readonly passiveState: number | null
  readonly passiveItype: string
  readonly passiveStats: readonly SkillsTxtPassiveStat[]
  readonly auraState: number | null
  readonly auraTargetState: number | null
  /** Param1..Param8 (blank = 0). */
  readonly params: readonly number[]
}

export const SKILLS_TXT_ROWS: readonly SkillsTxtRow[] = [
${skillLines.join('\n')}
]
`

writeFileSync(outPath, out)
console.log(`wrote ${outPath}: ${stateLines.length} states, ${skillLines.length} skills`)
