/**
 * Generates src/client/world/quest-fx-data-113c.ts from the 1.13c excel tables (Patch_D2.mpq wins over
 * d2exp.mpq / d2data.mpq through the normal mount order): the data the quest special ambient lights
 * (D2Client `CLIENT_GetAmbientLight` 0x6fb59a20 steps 1–3, issue #826) read at run time.
 *
 * - States.txt rows whose `setfunc` is 2. Entry 2 of the D2Client state set-function table 0x6fb92678
 *   is the fade starter 0x6fb223d0; the dispatcher 0x6fb22530 reads `setfunc` from states.bin +0x1a.
 *   The dispatcher skips a state of a dead unit when states.bin byte +0x14 has bit 0x80 set
 *   (0x6fb2256f-92), so that bit is required clear (the check is moot). Bit 0x10 is required clear too:
 *   with it clear the state set 0x6fb23760 frees the state's old statlist on every re-set
 *   (0x6fb237df-f5), so only a packet that adds stats leaves a statlist for 0x6fb223d0 to read.
 * - The Skills.txt record count (sgptDataTables +0xba0, range check 0x6fb22415-2b) and every
 *   non-empty `auralencalc` with Param1..Param8: the fade length X = #10786(auralencalc, skill, slvl)
 *   (0x6fb22447-4e).
 * - Missiles.txt row 288 `cairnstones`: the special quest event 1 handler 0x6fb02d00 ramps in and out
 *   over Param1 ticks (missiles.bin +0x38) and runs Range ticks in total (missiles.bin +0x96).
 *
 * D2Common loads the compiled .bin twins, so states.bin, skills.bin and missiles.bin are cross-checked
 * against the .txt values. Any mismatch, missing column or non-integer cell fails the run.
 *
 * Usage: npm run extract:quest-fx-data   (MPQs from D2_DATA_DIR or samples/d2)
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cell, parseTable, type D2Table } from '../../common/world/acts.ts'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from '../mpq-archive-source.ts'

export const QUEST_FX_MEMBERS = {
  statesTxt: 'data\\global\\excel\\states.txt',
  statesBin: 'data\\global\\excel\\states.bin',
  skillsTxt: 'data\\global\\excel\\skills.txt',
  skillsBin: 'data\\global\\excel\\skills.bin',
  missilesTxt: 'data\\global\\excel\\missiles.txt',
  missilesBin: 'data\\global\\excel\\missiles.bin',
} as const

export type QuestFxSourceFiles = { readonly [K in keyof typeof QUEST_FX_MEMBERS]: Uint8Array }

/** D2Client 0x6fb92678[2] = 0x6fb223d0: the `setfunc` id of the global fade starter. */
const SETFUNC_FADE = 2
/** StatesTxt record size (0x6fb22548-69). */
const STATES_BIN_RECORD = 0x3c
/** SkillsTxt record size (0x6fb22431-41). */
const SKILLS_BIN_RECORD = 0x23c
/** MissilesTxt record size (record 288 at +0x1d880, 0x6fb02d49-81). */
const MISSILES_BIN_RECORD = 0x1a4
/** Client missile of special quest event 1 (0x6fb02d27-44). */
const CAIRN_STONES_ID = 0x120
const CAIRN_STONES_NAME = 'cairnstones'
/**
 * Quest FX client missiles (Issue #873: 287 denofevillight, 288 cairnstones, 290 cairnstonesground, 99 lightninghit,
 * 372 diablo appears, 384 cairn stones bolt; Issue #915, special quest event 3 0x6fb03450 / CltDoFunc 31 0x6fb64b80:
 * 338 horadricstaff, 339 horadriclightning, 340 horadriclight, 150 dust; Issue #917, compelling orb death 0x6fb030d0 /
 * CltDoFunc 25 0x6fb683d0: 368 orbmist, 369 orbmisttrail, 370 orbmistfade; Issue #1215, Countess death 0x6fb02860 /
 * CltDoFunc 25 + CltDoFunc 30 0x6fb679f0: 291 towermist, 292 towermisttrail, 330 towermistfade, 332 towerchestspawner).
 */
const QUEST_FX_MISSILE_IDS = [99, 150, 287, 288, 290, 291, 292, 330, 332, 338, 339, 340, 368, 369, 370, 372, 384] as const
const PARAM_COLUMNS = ['Param1', 'Param2', 'Param3', 'Param4', 'Param5', 'Param6', 'Param7', 'Param8'] as const

type Params8 = readonly [number, number, number, number, number, number, number, number]

export interface AuraLenCalcRow {
  readonly skill: string
  readonly calc: string
  readonly params: Params8
}

export interface QuestFxMissileRow113c {
  readonly id: number
  readonly name: string
  readonly pCltDoFunc: number
  readonly range: number
  readonly vel: number
  readonly maxVel: number
  readonly param1: number
  readonly cltParam1: number
  readonly cltParam2: number
  readonly cltParam3: number
  readonly cltSubMissile1: number
  readonly cltSubMissile2: number
  readonly travelSound: number
  readonly light: number
  readonly flicker: number
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly animLen: number
}

export interface QuestFxData {
  readonly setfuncFadeStates: readonly number[]
  readonly skillsTxtRowCount: number
  readonly auraLenCalcBySkill: ReadonlyMap<number, AuraLenCalcRow>
  readonly cairnStones: { readonly id: number; readonly name: string; readonly param1: number; readonly range: number }
  readonly questFxMissiles: ReadonlyMap<number, QuestFxMissileRow113c>
}

function requireColumns(table: D2Table, file: string, columns: readonly string[]): void {
  for (const column of columns) {
    if (!table.header.includes(column)) throw new Error(`${file} has no column ${column}`)
  }
}

function intCell(table: D2Table, row: readonly string[], column: string, where: string): number {
  const raw = cell(table, row, column).trim()
  if (raw === '') return 0
  if (!/^-?\d+$/.test(raw)) throw new Error(`${where}: column ${column} is not an integer: '${raw}'`)
  return Number(raw)
}

/** Rows that carry a numeric id, in file order; the id must equal the row's record index. */
function indexedRows(table: D2Table, file: string, idColumn: string): (readonly string[])[] {
  const rows: (readonly string[])[] = []
  for (const row of table.rows) {
    const idText = cell(table, row, idColumn).trim()
    if (idText === '') continue
    if (!/^\d+$/.test(idText)) throw new Error(`${file}: ${idColumn} '${idText}' is not an integer`)
    if (Number(idText) !== rows.length) {
      throw new Error(`${file}: ${idColumn} ${idText} at record ${rows.length} (records must be dense)`)
    }
    rows.push(row)
  }
  return rows
}

/** A compiled excel .bin: u32 record count, then fixed-size records. */
function binRecords(bin: Uint8Array, file: string, recordSize: number): { count: number; view: DataView } {
  if (bin.byteLength < 4) throw new Error(`${file} is ${bin.byteLength} bytes`)
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
  const count = view.getUint32(0, true)
  if (bin.byteLength !== 4 + count * recordSize) {
    throw new Error(`${file}: ${bin.byteLength} bytes is not 4 + ${count} x 0x${recordSize.toString(16)}`)
  }
  return { count, view }
}

export function extractQuestFxData(files: QuestFxSourceFiles): QuestFxData {
  // States.txt / states.bin.
  const states = parseTable(files.statesTxt)
  requireColumns(states, 'States.txt', ['state', 'id', 'setfunc'])
  const stateRows = indexedRows(states, 'States.txt', 'id')
  const statesBin = binRecords(files.statesBin, 'states.bin', STATES_BIN_RECORD)
  if (statesBin.count !== stateRows.length) {
    throw new Error(`states.bin has ${statesBin.count} records, States.txt ${stateRows.length}`)
  }
  const setfuncFadeStates: number[] = []
  stateRows.forEach((row, id) => {
    const setfunc = intCell(states, row, 'setfunc', `States.txt id=${id}`)
    const rec = 4 + id * STATES_BIN_RECORD
    const binState = statesBin.view.getUint16(rec, true)
    const binSetfunc = statesBin.view.getUint16(rec + 0x1a, true)
    if (binState !== id || binSetfunc !== setfunc) {
      throw new Error(`states.bin record ${id}: state ${binState} setfunc ${binSetfunc}, States.txt setfunc ${setfunc}`)
    }
    if (setfunc !== SETFUNC_FADE) return
    const flags = statesBin.view.getUint8(rec + 0x14)
    if ((flags & 0x80) !== 0 || (flags & 0x10) !== 0) {
      throw new Error(
        `states.bin record ${id} (${cell(states, row, 'state')}): byte +0x14 = 0x${flags.toString(16)}; the fade ` +
          'port needs bit 0x80 (dead-unit skip) and bit 0x10 (statlist kept on re-set) clear',
      )
    }
    setfuncFadeStates.push(id)
  })

  // Skills.txt / skills.bin.
  const skills = parseTable(files.skillsTxt)
  requireColumns(skills, 'Skills.txt', ['skill', 'Id', 'auralencalc', ...PARAM_COLUMNS])
  const skillRows = indexedRows(skills, 'Skills.txt', 'Id')
  const skillsBin = binRecords(files.skillsBin, 'skills.bin', SKILLS_BIN_RECORD)
  if (skillsBin.count !== skillRows.length) {
    throw new Error(`skills.bin has ${skillsBin.count} records, Skills.txt ${skillRows.length}`)
  }
  const auraLenCalcBySkill = new Map<number, AuraLenCalcRow>()
  skillRows.forEach((row, id) => {
    const calc = cell(skills, row, 'auralencalc').trim()
    if (calc === '') return
    const where = `Skills.txt Id=${id}`
    const params = PARAM_COLUMNS.map(column => intCell(skills, row, column, where)) as unknown as Params8
    auraLenCalcBySkill.set(id, { skill: cell(skills, row, 'skill').trim(), calc, params })
  })

  // Missiles.txt / missiles.bin row 288 and quest FX missiles (Issue #873).
  const missiles = parseTable(files.missilesTxt)
  requireColumns(missiles, 'Missiles.txt', [
    'Missile',
    'Id',
    'pCltDoFunc',
    'Vel',
    'MaxVel',
    'Range',
    'Param1',
    'CltParam1',
    'CltParam2',
    'CltParam3',
    'CltSubMissile1',
    'CltSubMissile2',
    'TravelSound',
    'Light',
    'Flicker',
    'Red',
    'Green',
    'Blue',
    'AnimLen',
  ])
  const missileRows = indexedRows(missiles, 'Missiles.txt', 'Id')
  const missilesBin = binRecords(files.missilesBin, 'missiles.bin', MISSILES_BIN_RECORD)
  if (missilesBin.count !== missileRows.length || missilesBin.count <= CAIRN_STONES_ID) {
    throw new Error(`missiles.bin has ${missilesBin.count} records, Missiles.txt ${missileRows.length}`)
  }
  const missileIdByName = new Map<string, number>()
  missileRows.forEach((r, idx) => {
    const n = cell(missiles, r, 'Missile').trim()
    if (n !== '') missileIdByName.set(n, idx)
  })
  const resolveSubMissileId = (subName: string, where: string): number => {
    const trimmed = subName.trim()
    if (trimmed === '') return -1
    const subId = missileIdByName.get(trimmed)
    if (subId === undefined) throw new Error(`${where}: unknown sub-missile '${trimmed}'`)
    return subId
  }

  const questFxMissiles = new Map<number, QuestFxMissileRow113c>()
  for (const id of QUEST_FX_MISSILE_IDS) {
    const row = missileRows[id]
    if (!row) throw new Error(`Missiles.txt missing row ${id}`)
    const name = cell(missiles, row, 'Missile').trim()
    const where = `Missiles.txt Id=${id}`
    const pCltDoFunc = intCell(missiles, row, 'pCltDoFunc', where)
    const range = intCell(missiles, row, 'Range', where)
    const vel = intCell(missiles, row, 'Vel', where)
    const maxVel = intCell(missiles, row, 'MaxVel', where)
    const param1 = intCell(missiles, row, 'Param1', where)
    const cltParam1 = intCell(missiles, row, 'CltParam1', where)
    const cltParam2 = intCell(missiles, row, 'CltParam2', where)
    const cltParam3 = intCell(missiles, row, 'CltParam3', where)
    const cltSubMissile1 = resolveSubMissileId(cell(missiles, row, 'CltSubMissile1'), where)
    const cltSubMissile2 = resolveSubMissileId(cell(missiles, row, 'CltSubMissile2'), where)
    const light = intCell(missiles, row, 'Light', where)
    const flicker = intCell(missiles, row, 'Flicker', where)
    const red = intCell(missiles, row, 'Red', where)
    const green = intCell(missiles, row, 'Green', where)
    const blue = intCell(missiles, row, 'Blue', where)
    const animLen = intCell(missiles, row, 'AnimLen', where)

    const rec = 4 + id * MISSILES_BIN_RECORD
    const binId = missilesBin.view.getUint32(rec, true)
    const binPCltDoFunc = missilesBin.view.getUint16(rec + 0x08, true)
    const binTravelSound = missilesBin.view.getInt16(rec + 0x12, true)
    const binCltSubMissile1 = missilesBin.view.getInt16(rec + 0x1e, true)
    const binCltSubMissile2 = missilesBin.view.getInt16(rec + 0x20, true)
    const binParam1 = missilesBin.view.getInt32(rec + 0x38, true)
    const binCltParam1 = missilesBin.view.getInt32(rec + 0x58, true)
    const binCltParam2 = missilesBin.view.getInt32(rec + 0x5c, true)
    const binCltParam3 = missilesBin.view.getInt32(rec + 0x60, true)
    const binRange = missilesBin.view.getInt16(rec + 0x96, true)
    const binVel = missilesBin.view.getUint8(rec + 0x9a)
    const binMaxVel = missilesBin.view.getUint8(rec + 0x9c)
    const binLight = missilesBin.view.getUint8(rec + 0x130)
    const binFlicker = missilesBin.view.getUint8(rec + 0x131)
    const binRed = missilesBin.view.getUint8(rec + 0x132)
    const binGreen = missilesBin.view.getUint8(rec + 0x133)
    const binBlue = missilesBin.view.getUint8(rec + 0x134)
    const binAnimLen = missilesBin.view.getUint8(rec + 0x178)

    if (
      binId !== id ||
      binPCltDoFunc !== pCltDoFunc ||
      binCltSubMissile1 !== cltSubMissile1 ||
      binCltSubMissile2 !== cltSubMissile2 ||
      binParam1 !== param1 ||
      binCltParam1 !== cltParam1 ||
      binCltParam2 !== cltParam2 ||
      binCltParam3 !== cltParam3 ||
      binRange !== range ||
      binVel !== vel ||
      binMaxVel !== maxVel ||
      binLight !== light ||
      binFlicker !== flicker ||
      binRed !== red ||
      binGreen !== green ||
      binBlue !== blue ||
      binAnimLen !== animLen
    ) {
      throw new Error(`missiles.bin record ${id} (${name}) disagrees with Missiles.txt`)
    }
    const txtTravelSound = cell(missiles, row, 'TravelSound').trim()
    if ((txtTravelSound === '') !== (binTravelSound === 0)) {
      throw new Error(`missiles.bin record ${id} (${name}) TravelSound ${binTravelSound} disagrees with '${txtTravelSound}'`)
    }

    questFxMissiles.set(id, {
      id,
      name,
      pCltDoFunc,
      range,
      vel,
      maxVel,
      param1,
      cltParam1,
      cltParam2,
      cltParam3,
      cltSubMissile1,
      cltSubMissile2,
      travelSound: binTravelSound,
      light,
      flicker,
      red,
      green,
      blue,
      animLen,
    })
  }

  const cairnRow = questFxMissiles.get(CAIRN_STONES_ID)!
  if (cairnRow.name !== CAIRN_STONES_NAME) {
    throw new Error(`Missiles.txt Id=${CAIRN_STONES_ID} is '${cairnRow.name}', expected '${CAIRN_STONES_NAME}'`)
  }

  return {
    setfuncFadeStates,
    skillsTxtRowCount: skillsBin.count,
    auraLenCalcBySkill,
    cairnStones: { id: CAIRN_STONES_ID, name: cairnRow.name, param1: cairnRow.param1, range: cairnRow.range },
    questFxMissiles,
  }
}

/** Prettier-style quoting: single quotes unless the text contains one. */
function quote(text: string): string {
  if (text.includes('\\') || text.includes('\n')) throw new Error(`unsupported character in '${text}'`)
  if (!text.includes("'")) return `'${text}'`
  if (text.includes('"')) throw new Error(`string contains both quote kinds: ${text}`)
  return `"${text}"`
}

export function renderQuestFxData(data: QuestFxData): string {
  const lines: string[] = [
    '/**',
    ' * Diablo II v1.13c data of the quest special ambient lights (D2Client `CLIENT_GetAmbientLight`',
    ' * 0x6fb59a20 steps 1-3, `src/client/world/quest-fx-light.ts`) and quest FX client missiles',
    ' * (D2Client 0x6fb023b0 / 0x6fb03550 / CltDoFunc 23, 24, 37; Issue #873), from Patch_D2.mpq',
    ' * data\\\\global\\\\excel\\\\{States,Skills,Missiles}.txt, cross-checked against the .bin records.',
    ' *',
    ' * GENERATED by src/baker/extract/gen-quest-fx-data.ts (`npm run extract:quest-fx-data`). Do not edit by hand.',
    ' */',
    '',
    '/** One Skills.txt row with a non-empty `auralencalc` (empty Param cells read as 0). */',
    'export interface AuraLenCalcRow {',
    '  /** Skills.txt `skill` */',
    '  readonly skill: string',
    '  /** Skills.txt `auralencalc`, as written in the table */',
    '  readonly calc: string',
    '  /** Skills.txt `Param1`..`Param8` (`par1`..`par8` in the calc) */',
    '  readonly params: readonly [number, number, number, number, number, number, number, number]',
    '}',
    '',
    '/** One Missiles.txt / missiles.bin row used by quest FX client missiles (Issue #873). */',
    'export interface QuestFxMissileRow113c {',
    '  readonly id: number',
    '  readonly name: string',
    '  readonly pCltDoFunc: number',
    '  readonly range: number',
    '  readonly vel: number',
    '  readonly maxVel: number',
    '  readonly param1: number',
    '  readonly cltParam1: number',
    '  readonly cltParam2: number',
    '  readonly cltParam3: number',
    '  readonly cltSubMissile1: number',
    '  readonly cltSubMissile2: number',
    '  readonly travelSound: number',
    '  readonly light: number',
    '  readonly flicker: number',
    '  readonly red: number',
    '  readonly green: number',
    '  readonly blue: number',
    '  readonly animLen: number',
    '}',
    '',
    '/**',
    ' * States whose States.txt `setfunc` is 2: the D2Client set function 0x6fb92678[2] = 0x6fb223d0 starts',
    ' * the global fade. Their states.bin byte +0x14 has bits 0x80 and 0x10 clear.',
    ' */',
    `export const SETFUNC_FADE_STATES: readonly number[] = [${data.setfuncFadeStates.join(', ')}]`,
    '',
    '/** Skills.txt record count (sgptDataTables +0xba0): 0x6fb223d0 ignores skill ids outside [0, count). */',
    `export const SKILLS_TXT_ROW_COUNT = ${data.skillsTxtRowCount}`,
    '',
    '/** Skills.txt `auralencalc` and params by skill id, for every row whose `auralencalc` is not empty. */',
    'export const AURA_LEN_CALC_BY_SKILL: Readonly<Record<number, AuraLenCalcRow>> = Object.freeze({',
  ]
  for (const [id, row] of [...data.auraLenCalcBySkill].sort((a, b) => a[0] - b[0])) {
    lines.push(`  ${id}: { skill: ${quote(row.skill)}, calc: ${quote(row.calc)}, params: [${row.params.join(', ')}] },`)
  }
  const cairn = data.cairnStones
  lines.push(
    '})',
    '',
    '/**',
    ' * Missiles.txt row 288 `cairnstones`: special quest event 1 (0x6fb02d00) ramps the fade in and out over',
    ' * `param1` ticks (missiles.bin +0x38) and holds it for `range - 2 * param1` ticks (Range, +0x96).',
    ' */',
    'export const CAIRN_STONES_MISSILE = Object.freeze({',
    `  id: ${cairn.id},`,
    `  name: ${quote(cairn.name)},`,
    `  param1: ${cairn.param1},`,
    `  range: ${cairn.range},`,
    '})',
    '',
    '/**',
    ' * Quest FX client missiles (Missiles.txt / missiles.bin rows 99, 287, 288, 290, 372, 384, Issue #873;',
    ' * 150, 338, 339, 340, Issue #915; 368, 369, 370, Issue #917; 291, 292, 330, 332, Issue #1215).',
    ' */',
    'export const QUEST_FX_MISSILES_113C: Readonly<Record<number, QuestFxMissileRow113c>> = Object.freeze({',
  )
  for (const [id, m] of [...data.questFxMissiles].sort((a, b) => a[0] - b[0])) {
    lines.push(
      `  ${id}: { id: ${m.id}, name: ${quote(m.name)}, pCltDoFunc: ${m.pCltDoFunc}, range: ${m.range}, ` +
        `vel: ${m.vel}, maxVel: ${m.maxVel}, param1: ${m.param1}, cltParam1: ${m.cltParam1}, ` +
        `cltParam2: ${m.cltParam2}, cltParam3: ${m.cltParam3}, cltSubMissile1: ${m.cltSubMissile1}, ` +
        `cltSubMissile2: ${m.cltSubMissile2}, travelSound: ${m.travelSound}, light: ${m.light}, ` +
        `flicker: ${m.flicker}, red: ${m.red}, green: ${m.green}, blue: ${m.blue}, animLen: ${m.animLen} },`,
    )
  }
  lines.push('})', '')
  return lines.join('\n')
}

export async function readQuestFxSourceFiles(
  read: (member: string) => Promise<Uint8Array>,
): Promise<QuestFxSourceFiles> {
  const entries = await Promise.all(
    Object.entries(QUEST_FX_MEMBERS).map(async ([key, member]) => [key, await read(member)] as const),
  )
  return Object.fromEntries(entries) as unknown as QuestFxSourceFiles
}

async function main(): Promise<void> {
  const archives = mountNodeArchives(DEFAULT_NODE_MPQ_DIR)
  const data = extractQuestFxData(await readQuestFxSourceFiles(member => archives.read(member)))
  const target = resolve('src/client/world/quest-fx-data-113c.ts')
  writeFileSync(target, renderQuestFxData(data))
  console.log(
    `wrote ${target}: setfunc-2 states [${data.setfuncFadeStates.join(',')}], ${data.skillsTxtRowCount} skills ` +
      `(${data.auraLenCalcBySkill.size} with auralencalc), cairnstones Param1 ${data.cairnStones.param1} ` +
      `Range ${data.cairnStones.range}`,
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
