/**
 * Generates src/common/units/light-sources-113c.ts from the 1.13c excel tables (Patch_D2.mpq wins over d2exp.mpq /
 * d2data.mpq through the normal mount order). Issue #830.
 *
 * - MonStats2.txt `Light`, `light-r`, `light-g`, `light-b` (compiled record +0x11e, +0x11f..+0x121) for every
 *   MonStats.txt `hcIdx`, resolved through MonStats.txt `MonStatsEx` (the MonStats2 `Id` key, like the compiled
 *   `wMonStatsEx`). D2Client reads them for the monster light (CreateLight at 0x6fafc24e) and the MonUMod "light"
 *   handler (0x6fad05df).
 * - Missiles.txt `Light`, `Flicker`, `Red`, `Green`, `Blue` (compiled +0x130, +0x131, +0x132..+0x134) for every
 *   Missiles.txt `Id`. D2Client reads them for the missile-unit light (0x6fb636a7) and its flicker (0x6fb60df0).
 *
 * Empty numeric cells read as 0, which is how the game's own txt compiler treats them. A missing column, a
 * non-integer cell, a value outside 0..255, a duplicate or missing id, or an unresolvable MonStatsEx fails the run.
 *
 * Usage: npm run extract:light-sources   (MPQs from D2_DATA_DIR or samples/d2)
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cell, parseTable, type D2Table } from '../../common/world/acts.ts'
import { DEFAULT_NODE_MPQ_DIR, NodeMpqArchiveSource, mountNodeArchives } from '../mpq-archive-source.ts'

const MONSTATS_MEMBER = 'data\\global\\excel\\monstats.txt'
const MONSTATS2_MEMBER = 'data\\global\\excel\\monstats2.txt'
const MISSILES_MEMBER = 'data\\global\\excel\\missiles.txt'
const SKILLS_MEMBER = 'data\\global\\excel\\skills.txt'

/** [Light, light-r, light-g, light-b] of one MonStats hcIdx. */
export type MonsterLightRow = readonly [light: number, red: number, green: number, blue: number]
/** [Light, Flicker, Red, Green, Blue] of one Missiles.txt Id. */
export type MissileLightRow = readonly [light: number, flicker: number, red: number, green: number, blue: number]
/** [Light, Red, Green, Blue] of one Skills.txt Id from its cltmissile row in Missiles.txt. */
export type SkillCastLightRow = readonly [light: number, red: number, green: number, blue: number]

function requireColumns(table: D2Table, file: string, columns: readonly string[]): void {
  for (const column of columns) {
    if (!table.header.includes(column)) throw new Error(`${file} has no column ${column}`)
  }
}

function byteCell(table: D2Table, row: readonly string[], column: string, where: string): number {
  const raw = cell(table, row, column).trim()
  if (raw === '') return 0
  if (!/^\d+$/.test(raw)) throw new Error(`${where}: column ${column} is not an unsigned integer: '${raw}'`)
  const value = Number(raw)
  if (value > 255) throw new Error(`${where}: column ${column} = ${value} does not fit the compiled byte`)
  return value
}

/** Rows whose id column is a decimal integer (separator rows such as "Expansion" have none). */
function idRows(table: D2Table, file: string, idColumn: string): Map<number, readonly string[]> {
  const out = new Map<number, readonly string[]>()
  for (const row of table.rows) {
    const text = cell(table, row, idColumn).trim()
    if (!/^\d+$/.test(text)) continue
    const id = Number(text)
    if (out.has(id)) throw new Error(`${file}: duplicate ${idColumn}=${id}`)
    out.set(id, row)
  }
  return out
}

function denseIds(rows: Map<number, readonly string[]>, file: string, idColumn: string): number {
  const count = rows.size
  for (let id = 0; id < count; id += 1) {
    if (!rows.has(id)) throw new Error(`${file}: missing ${idColumn}=${id} (ids must be 0..${count - 1})`)
  }
  return count
}

export function readMonsterLights(monStats: D2Table, monStats2: D2Table): MonsterLightRow[] {
  requireColumns(monStats, 'MonStats.txt', ['Id', 'hcIdx', 'MonStatsEx'])
  requireColumns(monStats2, 'MonStats2.txt', ['Id', 'Light', 'light-r', 'light-g', 'light-b'])
  const ms2ById = new Map<string, readonly string[]>()
  for (const row of monStats2.rows) {
    const key = cell(monStats2, row, 'Id').trim()
    if (key === '' || key.toLowerCase() === 'expansion') continue
    if (ms2ById.has(key)) throw new Error(`MonStats2.txt: duplicate Id '${key}'`)
    ms2ById.set(key, row)
  }
  const rows = idRows(monStats, 'MonStats.txt', 'hcIdx')
  const count = denseIds(rows, 'MonStats.txt', 'hcIdx')
  const out: MonsterLightRow[] = []
  for (let hcIdx = 0; hcIdx < count; hcIdx += 1) {
    const row = rows.get(hcIdx)!
    const ex = cell(monStats, row, 'MonStatsEx').trim()
    const ms2 = ms2ById.get(ex)
    if (ms2 === undefined) throw new Error(`MonStats.txt hcIdx=${hcIdx}: MonStatsEx '${ex}' has no MonStats2.txt row`)
    const where = `MonStats2.txt Id=${ex} (hcIdx ${hcIdx})`
    out.push([
      byteCell(monStats2, ms2, 'Light', where),
      byteCell(monStats2, ms2, 'light-r', where),
      byteCell(monStats2, ms2, 'light-g', where),
      byteCell(monStats2, ms2, 'light-b', where),
    ])
  }
  return out
}

export function readMissileLights(missiles: D2Table): MissileLightRow[] {
  requireColumns(missiles, 'Missiles.txt', ['Missile', 'Id', 'Light', 'Flicker', 'Red', 'Green', 'Blue'])
  const rows = idRows(missiles, 'Missiles.txt', 'Id')
  const count = denseIds(rows, 'Missiles.txt', 'Id')
  const out: MissileLightRow[] = []
  for (let id = 0; id < count; id += 1) {
    const row = rows.get(id)!
    const where = `Missiles.txt Id=${id} (${cell(missiles, row, 'Missile').trim()})`
    out.push([
      byteCell(missiles, row, 'Light', where),
      byteCell(missiles, row, 'Flicker', where),
      byteCell(missiles, row, 'Red', where),
      byteCell(missiles, row, 'Green', where),
      byteCell(missiles, row, 'Blue', where),
    ])
  }
  return out
}

export function readSkillCastLights(
  skills: D2Table,
  missilesTable: D2Table,
  missiles: readonly MissileLightRow[],
): SkillCastLightRow[] {
  requireColumns(skills, 'Skills.txt', ['skill', 'Id', 'cltmissile'])
  requireColumns(missilesTable, 'Missiles.txt', ['Missile', 'Id'])
  const missileIdByName = new Map<string, number>()
  for (const row of missilesTable.rows) {
    const name = cell(missilesTable, row, 'Missile').trim().toLowerCase()
    const idStr = cell(missilesTable, row, 'Id').trim()
    if (name === '' || !/^\d+$/.test(idStr)) continue
    const id = Number(idStr)
    if (missileIdByName.has(name)) throw new Error(`Missiles.txt: duplicate Missile '${name}'`)
    missileIdByName.set(name, id)
  }
  const rows = idRows(skills, 'Skills.txt', 'Id')
  const count = denseIds(rows, 'Skills.txt', 'Id')
  const out: SkillCastLightRow[] = []
  for (let id = 0; id < count; id += 1) {
    const row = rows.get(id)!
    const raw = cell(skills, row, 'cltmissile').trim()
    if (raw === '') {
      out.push([0, 0, 0, 0])
      continue
    }
    const resolvedId = missileIdByName.get(raw.toLowerCase()) ?? (/^\d+$/.test(raw) ? Number(raw) : undefined)
    if (resolvedId === undefined) {
      throw new Error(`Skills.txt Id=${id}: cltmissile '${raw}' does not resolve to a Missiles.txt row`)
    }
    if (resolvedId >= missiles.length) {
      out.push([0, 0, 0, 0])
      continue
    }
    const [light, _flicker, red, green, blue] = missiles[resolvedId]!
    out.push([light, red, green, blue])
  }
  return out
}

function tupleLines(rows: readonly (readonly number[])[], perLine: number): string[] {
  const lines: string[] = []
  for (let i = 0; i < rows.length; i += perLine) {
    const chunk = rows.slice(i, i + perLine).map((r) => `[${r.join(', ')}]`)
    lines.push(`  ${chunk.join(', ')}, // ${i}`)
  }
  return lines
}

export function renderLightSources(
  monsters: readonly MonsterLightRow[],
  missiles: readonly MissileLightRow[],
  skills: readonly SkillCastLightRow[],
): string {
  return [
    '/**',
    ' * Diablo II v1.13c light-source columns (issue #830, #876).',
    ' *',
    ' * GENERATED by src/baker/extract/gen-light-sources.ts (`npm run extract:light-sources`) from the 1.13c',
    ' * MonStats.txt / MonStats2.txt / Missiles.txt / Skills.txt. Do not edit by hand.',
    ' */',
    '',
    '/** MonStats2.txt [Light, light-r, light-g, light-b] (compiled +0x11e..+0x121). */',
    'export type MonsterLight113c = readonly [light: number, red: number, green: number, blue: number]',
    '/** Missiles.txt [Light, Flicker, Red, Green, Blue] (compiled +0x130..+0x134). */',
    'export type MissileLight113c = readonly [light: number, flicker: number, red: number, green: number, blue: number]',
    '/** Skills.txt -> cltmissile -> Missiles.txt [Light, Red, Green, Blue] (compiled skills.bin +0xe8 -> missiles.bin +0x130, +0x132..+0x134). */',
    'export type SkillCastLight113c = readonly [light: number, red: number, green: number, blue: number]',
    '',
    '/** Indexed by MonStats.txt hcIdx (resolved through MonStatsEx, like the compiled wMonStatsEx). */',
    'export const MONSTER_LIGHT_113C: readonly MonsterLight113c[] = Object.freeze([',
    ...tupleLines(monsters, 6),
    '])',
    '',
    '/** Indexed by Missiles.txt Id. */',
    'export const MISSILE_LIGHT_113C: readonly MissileLight113c[] = Object.freeze([',
    ...tupleLines(missiles, 5),
    '])',
    '',
    '/** Indexed by Skills.txt Id (compiled cltmissile -> Missiles.txt Light / RGB; 0x6fb50f60 cast light). */',
    'export const SKILL_CAST_LIGHT_113C: readonly SkillCastLight113c[] = Object.freeze([',
    ...tupleLines(skills, 6),
    '])',
    '',
    '/** MonStats2 light columns of a monster class (MonStats hcIdx); an unknown class throws. */',
    'export function monsterLight113c(hcIdx: number): MonsterLight113c {',
    '  const row = Number.isInteger(hcIdx) ? MONSTER_LIGHT_113C[hcIdx] : undefined',
    '  if (row === undefined) throw new RangeError(`no MonStats2 light row for monster class ${String(hcIdx)}`)',
    '  return row',
    '}',
    '',
    '/** Missiles.txt light columns of a missile row id; an unknown id throws. */',
    'export function missileLight113c(id: number): MissileLight113c {',
    '  const row = Number.isInteger(id) ? MISSILE_LIGHT_113C[id] : undefined',
    '  if (row === undefined) throw new RangeError(`no Missiles.txt light row for missile id ${String(id)}`)',
    '  return row',
    '}',
    '',
    '/** Missiles.txt light columns of a skill cast light (0x6fb50f60); an unknown skill id throws. */',
    'export function skillCastLight113c(skillId: number): SkillCastLight113c {',
    '  const row = Number.isInteger(skillId) ? SKILL_CAST_LIGHT_113C[skillId] : undefined',
    '  if (row === undefined) throw new RangeError(`no Skills.txt cast light row for skill id ${String(skillId)}`)',
    '  return row',
    '}',
    '',
  ].join('\n')
}

/** Compiled record layouts (D2Client 0x6fab152b / 0x6fab1548; missiles.bin stride 0x1a4). */
const MONSTATS_BIN_RECORD_SIZE = 0x1a8
const MONSTATS_WMONSTATSEX_OFFSET = 0x18
const MONSTATS2_BIN_RECORD_SIZE = 0x134
const MONSTATS2_LIGHT_OFFSET = 0x11e
const MISSILES_BIN_RECORD_SIZE = 0x1a4
const MISSILES_LIGHT_OFFSET = 0x130
const SKILLS_BIN_RECORD_SIZE = 0x23c
const SKILLS_CLTMISSILE_OFFSET = 0xe8

function binRecords(bin: Uint8Array, recordSize: number, label: string): { view: DataView; count: number } {
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
  const count = bin.byteLength >= 4 ? view.getUint32(0, true) : -1
  if (count < 0 || 4 + count * recordSize !== bin.byteLength) {
    throw new Error(`${label}: size ${bin.byteLength} is not 4 + count * 0x${recordSize.toString(16)}`)
  }
  return { view, count }
}

/**
 * The txt columns must equal the compiled records D2Client reads (monstats.bin `wMonStatsEx` → monstats2.bin
 * +0x11e..+0x121; missiles.bin +0x130..+0x134; skills.bin +0xe8 → missiles.bin), so the empty-cell rule and the links
 * are verified.
 */
export function verifyAgainstBins(
  monsters: readonly MonsterLightRow[],
  missiles: readonly MissileLightRow[],
  skills: readonly SkillCastLightRow[],
  readBytes: (member: string) => Uint8Array,
): void {
  const ms = binRecords(readBytes('data\\global\\excel\\monstats.bin'), MONSTATS_BIN_RECORD_SIZE, 'monstats.bin')
  const ms2 = binRecords(readBytes('data\\global\\excel\\monstats2.bin'), MONSTATS2_BIN_RECORD_SIZE, 'monstats2.bin')
  const mis = binRecords(readBytes('data\\global\\excel\\missiles.bin'), MISSILES_BIN_RECORD_SIZE, 'missiles.bin')
  const sk = binRecords(readBytes('data\\global\\excel\\skills.bin'), SKILLS_BIN_RECORD_SIZE, 'skills.bin')
  if (ms.count !== monsters.length) throw new Error(`monstats.bin has ${ms.count} records, MonStats.txt ${monsters.length}`)
  if (mis.count !== missiles.length) throw new Error(`missiles.bin has ${mis.count} records, Missiles.txt ${missiles.length}`)
  if (sk.count !== skills.length) throw new Error(`skills.bin has ${sk.count} records, Skills.txt ${skills.length}`)
  for (let hcIdx = 0; hcIdx < ms.count; hcIdx += 1) {
    const ex = ms.view.getInt16(4 + hcIdx * MONSTATS_BIN_RECORD_SIZE + MONSTATS_WMONSTATSEX_OFFSET, true)
    if (ex < 0 || ex >= ms2.count) throw new Error(`monstats.bin hcIdx=${hcIdx}: wMonStatsEx ${ex} out of range`)
    const at = 4 + ex * MONSTATS2_BIN_RECORD_SIZE + MONSTATS2_LIGHT_OFFSET
    const bin = [0, 1, 2, 3].map((k) => ms2.view.getUint8(at + k))
    if (bin.join() !== monsters[hcIdx]!.join()) {
      throw new Error(`hcIdx=${hcIdx}: MonStats2.txt light ${monsters[hcIdx]!.join()} != monstats2.bin ${bin.join()}`)
    }
  }
  for (let id = 0; id < mis.count; id += 1) {
    const at = 4 + id * MISSILES_BIN_RECORD_SIZE + MISSILES_LIGHT_OFFSET
    const bin = [0, 1, 2, 3, 4].map((k) => mis.view.getUint8(at + k))
    if (bin.join() !== missiles[id]!.join()) {
      throw new Error(`missile Id=${id}: Missiles.txt light ${missiles[id]!.join()} != missiles.bin ${bin.join()}`)
    }
  }
  for (let id = 0; id < sk.count; id += 1) {
    const clt = sk.view.getUint16(4 + id * SKILLS_BIN_RECORD_SIZE + SKILLS_CLTMISSILE_OFFSET, true)
    const expected =
      clt === 0xffff || clt >= missiles.length
        ? [0, 0, 0, 0]
        : [missiles[clt]![0], missiles[clt]![2], missiles[clt]![3], missiles[clt]![4]]
    if (expected.join() !== skills[id]!.join()) {
      throw new Error(`skill Id=${id}: Skills.txt cast light ${skills[id]!.join()} != skills.bin cltmissile ${clt}`)
    }
  }
}

async function main(): Promise<void> {
  const archives = mountNodeArchives(DEFAULT_NODE_MPQ_DIR)
  const monStats = parseTable(await archives.read(MONSTATS_MEMBER))
  const monStats2 = parseTable(await archives.read(MONSTATS2_MEMBER))
  const missiles = parseTable(await archives.read(MISSILES_MEMBER))
  const skills = parseTable(await archives.read(SKILLS_MEMBER))
  const monsterRows = readMonsterLights(monStats, monStats2)
  const missileRows = readMissileLights(missiles)
  const skillRows = readSkillCastLights(skills, missiles, missileRows)
  const bins = new NodeMpqArchiveSource(DEFAULT_NODE_MPQ_DIR)
  verifyAgainstBins(monsterRows, missileRows, skillRows, (member) => bins.readBytes(member))
  const target = resolve('src/common/units/light-sources-113c.ts')
  writeFileSync(target, renderLightSources(monsterRows, missileRows, skillRows))
  const litMonsters = monsterRows.filter((r) => r[0] > 0).length
  const litMissiles = missileRows.filter((r) => r[0] > 0).length
  const flickering = missileRows.filter((r) => r[1] > 0).length
  const litSkills = skillRows.filter((r) => r[0] > 0).length
  console.log(
    `wrote ${target}: ${monsterRows.length} monster classes (${litMonsters} lit), ` +
      `${missileRows.length} missiles (${litMissiles} lit, ${flickering} flicker), ` +
      `${skillRows.length} skills (${litSkills} lit); all rows equal the compiled bins`,
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
