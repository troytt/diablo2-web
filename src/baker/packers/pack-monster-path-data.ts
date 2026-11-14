/**
 * Offline packer for the monster data the 1.13c dynamic-path port needs (Refs #808).
 *
 * Usage:
 *   npx tsx src/baker/packers/pack-monster-path-data.ts           # (re)write the table
 *   npx tsx src/baker/packers/pack-monster-path-data.ts --check   # verify the committed table
 *
 * Reads the authoritative 1.13c `MonStats.txt` / `MonStats2.txt` through the shared MPQ data registry and
 * writes `src/common/path/monster-path-data.ts`. Rows are laid out exactly like the compiled
 * `D2MonStatsTxt` / `D2MonStats2Txt` tables: the txt compiler skips the `Expansion` marker row, so the
 * record index is the `hcIdx` (MonStats) / the row index without `Expansion` (MonStats2). Name-to-index
 * links (`BaseId`, `MonStatsEx`) are resolved like the compiler's linkers. Any missing or unresolvable
 * cell that the 1.13c binary would need throws: no silent defaults.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AnimDataFile } from '../../common/formats/animdata.ts'
import type { DataTable } from '../../common/items/tables.ts'
import { getSharedDataRegistry, getSharedMountedArchives } from '../mpq-archive-source.ts'

/** `MONSTATSFLAGINDEX_*` bit indices of `D2MonStatsTxt::dwMonStatsFlags` (D2MOO `DataTbls/MonsterTbls.h`). */
export const MONSTATS_FLAG_COLUMNS: ReadonlyArray<readonly [column: string, bit: number]> = [
  ['opendoors', 3],
  ['npc', 8],
  ['interact', 9],
  ['inTown', 10],
  ['flying', 14],
]

/** `MONSTATS2FLAG_*` bits of `D2MonStats2Txt::dwFlags` (+0x04; 1.13c reads byte +0x05 at 0x6FD853D0). */
export const MONSTATS2_FLAG_COLUMNS: ReadonlyArray<readonly [column: string, mask: number]> = [
  ['revive', 0x100],
  ['isAtt', 0x200],
  ['small', 0x400],
]

export const MONSTATS_BIN_PATH = 'data\\global\\excel\\monstats.bin'
export const MONSTATS2_BIN_PATH = 'data\\global\\excel\\monstats2.bin'
/** `sizeof(D2MonStatsTxt)` (`0x6FAB152B`: `imul eax, eax, 0x1a8`). */
export const MONSTATS_BIN_RECORD_SIZE = 0x1a8
/** `sizeof(D2MonStats2Txt)` (`0x6FAB1548`: `imul eax, eax, 0x134`). */
export const MONSTATS2_BIN_RECORD_SIZE = 0x134
/** Classic vs Expansion MonStats index threshold in `DATATBLS_LoadMonStatsTxt` (`MonsterTbls.cpp:528`: `nCounter < 410`). */
const CLASSIC_MONSTATS_COUNT = 410
/** `DATATBLS_LoadAnimDataD2` (`AnimTbls.cpp:26`): `tDefaultRecord.dwAnimSpeed = 256`. */
const DEFAULT_ANIM_SPEED = 256

/** Values per monster in `MONSTER_PATH_DATA`. */
export const MONSTER_PATH_DATA_STRIDE = 27

/**
 * Per-mode AnimData COF tokens for monster modes 0..12 (`MONMODE_*`, `path/types.ts`),
 * in mode order: DT(0), NU(1), WL(2), GH(3), A1(4), A2(5), BL(6), SC(7), S1(8), S2(9), S3(10), S4(11), DD(12).
 * The engine reads these per unit at runtime via `DATATBLS_GetAnimDataRecord`
 * (`AnimTbls.cpp:86`) with the unit's OWN `Code`+`BaseW` (no base-monster velocity scaling —
 * that applies to walk only). WL slot mirrors `nWalkAnimSpeed` (which IS velocity-scaled);
 * RN(15) maps to `nRunAnimSpeed` and KB(13) to walk at lookup time.
 */
export const MONSTER_MODE_ANIM_TOKENS = ['DT', 'NU', 'WL', 'GH', 'A1', 'A2', 'BL', 'SC', 'S1', 'S2', 'S3', 'S4', 'DD'] as const

export interface PackedMonsterPathData {
  readonly monStatsCount: number
  readonly monStats2Count: number
  readonly ids: readonly string[]
  /**
   * Flattened `[baseId, monStatsFlags, velocity, run, monStatsEx, sizeX, sizeY, monStats2Flags,
   * walkAnimSpeed, runAnimSpeed, splEndDeath, splClientEnd, modeFlags, moveInAnimFlags,
   * ...13 per-mode AnimData base speeds (MONSTER_MODE_ANIM_TOKENS order)]` rows.
   */
  readonly rows: readonly number[]
}

function isExpansionRow(row: Readonly<Record<string, string>>): boolean {
  return (row['Id'] ?? '').toLowerCase() === 'expansion'
}

function intCell(row: Readonly<Record<string, string>>, column: string, where: string): number {
  const raw = row[column]
  if (raw === undefined || raw === '') return 0 // empty numeric txt cell compiles to 0
  const v = Number(raw)
  if (!Number.isInteger(v)) throw new Error(`${where}: column ${column} is not an integer (${JSON.stringify(raw)})`)
  return v
}

function boolCell(row: Readonly<Record<string, string>>, column: string, where: string): boolean {
  return intCell(row, column, where) !== 0
}

function requireColumns(table: DataTable, name: string, columns: readonly string[]): void {
  for (const c of columns) {
    if (!table.columns.includes(c)) throw new Error(`${name}: missing column ${c}`)
  }
}

function readCountedBin(bin: Uint8Array, recordSize: number, label: string, expectedCount: number): DataView {
  if (bin.byteLength < 4) throw new Error(`${label} too short`)
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
  const count = dv.getUint32(0, true)
  if (count !== expectedCount) {
    throw new Error(`${label} count ${count} != expected ${expectedCount}`)
  }
  if (4 + count * recordSize !== bin.byteLength) {
    throw new Error(`${label} size ${bin.byteLength} != 4 + ${count} * 0x${recordSize.toString(16)}`)
  }
  return dv
}

function lookupMonsterAnimSpeed(animData: AnimDataFile, code: string, modeToken: string, baseW: string): number {
  const wClass = (baseW || 'hth').trim() || 'hth'
  const key = `${code.trim()}${modeToken}${wClass}`.toUpperCase()
  const rec = animData.records.get(key)
  return rec ? rec.animationSpeed : DEFAULT_ANIM_SPEED
}

/** Builds the packed rows from the registry tables and compiled `.bin` files (pure; used by the packer and parity test). */
export function buildMonsterPathData(
  monStats: DataTable,
  monStats2: DataTable,
  monStatsBin: Uint8Array,
  monStats2Bin: Uint8Array,
  animData: AnimDataFile,
): PackedMonsterPathData {
  requireColumns(monStats, 'MonStats.txt', ['Id', 'hcIdx', 'BaseId', 'MonStatsEx', 'Code', 'Velocity', 'Run', ...MONSTATS_FLAG_COLUMNS.map(c => c[0])])
  requireColumns(monStats2, 'MonStats2.txt', ['Id', 'SizeX', 'SizeY', 'BaseW', ...MONSTATS2_FLAG_COLUMNS.map(c => c[0])])

  const ms2Rows = monStats2.rows.filter(r => !isExpansionRow(r))
  const ms2Index = new Map<string, number>()
  ms2Rows.forEach((r, i) => {
    const id = (r['Id'] ?? '').toLowerCase()
    if (id === '') throw new Error(`MonStats2.txt record ${i}: empty Id`)
    if (!ms2Index.has(id)) ms2Index.set(id, i)
  })

  const msRows = monStats.rows.filter(r => !isExpansionRow(r))
  const msIndex = new Map<string, number>()
  msRows.forEach((r, i) => {
    const id = (r['Id'] ?? '').toLowerCase()
    if (id === '') throw new Error(`MonStats.txt record ${i}: empty Id`)
    if (intCell(r, 'hcIdx', `MonStats.txt ${id}`) !== i) throw new Error(`MonStats.txt ${id}: hcIdx ${r['hcIdx']} != compiled index ${i}`)
    if (!msIndex.has(id)) msIndex.set(id, i)
  })

  const msBinDv = readCountedBin(monStatsBin, MONSTATS_BIN_RECORD_SIZE, 'monstats.bin', msRows.length)
  const ms2BinDv = readCountedBin(monStats2Bin, MONSTATS2_BIN_RECORD_SIZE, 'monstats2.bin', ms2Rows.length)

  // First pass: resolve baseIds, velocities, runs, and base walkAnimSpeeds (MonsterTbls.cpp:496-559)
  const baseIds: number[] = []
  const exIds: number[] = []
  const velocities: number[] = []
  const runs: number[] = []
  const codes: string[] = []
  const baseWs: string[] = []
  for (let i = 0; i < msRows.length; i++) {
    const r = msRows[i]!
    const id = r['Id']!
    const where = `MonStats.txt ${id} (hcIdx ${i})`
    const rawBaseId = msIndex.get((r['BaseId'] ?? '').toLowerCase())
    if (rawBaseId === undefined) throw new Error(`${where}: unresolved BaseId ${JSON.stringify(r['BaseId'])}`)
    const baseId = rawBaseId < 0 || rawBaseId >= msRows.length ? i : rawBaseId
    const ex = ms2Index.get((r['MonStatsEx'] ?? '').toLowerCase())
    if (ex === undefined) throw new Error(`${where}: unresolved MonStatsEx ${JSON.stringify(r['MonStatsEx'])}`)
    const r2 = ms2Rows[ex]!
    baseIds.push(baseId)
    exIds.push(ex)
    velocities.push(intCell(r, 'Velocity', where))
    runs.push(intCell(r, 'Run', where))
    codes.push(r['Code'] ?? '')
    baseWs.push(r2['BaseW'] ?? 'hth')
  }

  const walkAnimSpeeds: number[] = new Array(msRows.length).fill(0)
  const runAnimSpeeds: number[] = new Array(msRows.length).fill(0)
  // Pass 1a: compute walkAnimSpeed for every record (needed before classic runAnimSpeed reads base walkAnimSpeed)
  for (let i = 0; i < msRows.length; i++) {
    const nBaseId = baseIds[i]!
    let nWalkAnimSpeed = lookupMonsterAnimSpeed(animData, codes[nBaseId]!, 'WL', baseWs[nBaseId]!)
    if (nBaseId !== i && velocities[nBaseId]! > 0) {
      nWalkAnimSpeed = Math.trunc((nWalkAnimSpeed * velocities[i]!) / velocities[nBaseId]!)
    }
    if (nWalkAnimSpeed <= 0) walkAnimSpeeds[i] = 0
    else if (nWalkAnimSpeed >= 32767) walkAnimSpeeds[i] = 32767
    else walkAnimSpeeds[i] = nWalkAnimSpeed
  }
  // Pass 1b: compute runAnimSpeed (MonsterTbls.cpp:528-555)
  for (let i = 0; i < msRows.length; i++) {
    const nBaseId = baseIds[i]!
    let nRunAnimSpeed: number
    if (i < CLASSIC_MONSTATS_COUNT) {
      const v21 = walkAnimSpeeds[nBaseId]!
      nRunAnimSpeed = Math.trunc(v21 / 2)
    } else {
      nRunAnimSpeed = lookupMonsterAnimSpeed(animData, codes[nBaseId]!, 'RN', baseWs[nBaseId]!)
    }
    if (nBaseId !== i && runs[nBaseId]! > 0) {
      nRunAnimSpeed = Math.trunc((nRunAnimSpeed * runs[i]!) / runs[nBaseId]!)
    }
    if (nRunAnimSpeed <= 0) runAnimSpeeds[i] = 0
    else if (nRunAnimSpeed >= 32767) runAnimSpeeds[i] = 32767
    else runAnimSpeeds[i] = nRunAnimSpeed
  }

  // Pass 1c: per-mode AnimData base speeds (modes 0..12) from the unit's OWN Code+BaseW,
  // mirroring DATATBLS_GetAnimDataRecord lookups (AnimTbls.cpp:86). WL mirrors the
  // velocity-scaled walkAnimSpeed so every mode slot has one authoritative value.
  const modeAnimSpeeds: number[][] = []
  for (let i = 0; i < msRows.length; i++) {
    const speeds: number[] = []
    for (let m = 0; m < MONSTER_MODE_ANIM_TOKENS.length; m++) {
      speeds.push(m === 2 ? walkAnimSpeeds[i]! : lookupMonsterAnimSpeed(animData, codes[i]!, MONSTER_MODE_ANIM_TOKENS[m]!, baseWs[i]!))
    }
    modeAnimSpeeds.push(speeds)
  }

  const ids: string[] = []
  const rows: number[] = []
  msRows.forEach((r, i) => {
    const id = r['Id']!
    const where = `MonStats.txt ${id} (hcIdx ${i})`
    const baseId = baseIds[i]!
    const ex = exIds[i]!
    let flags = 0
    for (const [column, bit] of MONSTATS_FLAG_COLUMNS) if (boolCell(r, column, where)) flags |= 1 << bit
    const r2 = ms2Rows[ex]!
    const where2 = `MonStats2.txt ${r2['Id']}`
    let flags2 = 0
    for (const [column, mask] of MONSTATS2_FLAG_COLUMNS) if (boolCell(r2, column, where2)) flags2 |= mask

    const msOff = 4 + i * MONSTATS_BIN_RECORD_SIZE
    const ms2Off = 4 + ex * MONSTATS2_BIN_RECORD_SIZE
    const splEndDeath = msBinDv.getUint8(msOff + 0x1a4)
    const splClientEnd = msBinDv.getUint8(msOff + 0x1a7)
    const modeFlags = ms2BinDv.getUint16(ms2Off + 0xf0, true)
    const moveInAnimFlags = ms2BinDv.getUint16(ms2Off + 0x104, true)

    ids.push(id)
    rows.push(
      baseId,
      flags,
      velocities[i]!,
      runs[i]!,
      ex,
      intCell(r2, 'SizeX', where2),
      intCell(r2, 'SizeY', where2),
      flags2,
      walkAnimSpeeds[i]!,
      runAnimSpeeds[i]!,
      splEndDeath,
      splClientEnd,
      modeFlags,
      moveInAnimFlags,
      ...modeAnimSpeeds[i]!,
    )
  })
  return { monStatsCount: msRows.length, monStats2Count: ms2Rows.length, ids, rows }
}

/** Renders the generated TypeScript module (deterministic). */
export function renderMonsterPathDataModule(data: PackedMonsterPathData): string {
  const lines: string[] = []
  lines.push('/**')
  lines.push(' * 1.13c monster records used by the dynamic-path and NpcMotion port (Refs #808).')
  lines.push(' *')
  lines.push(' * GENERATED by `src/baker/packers/pack-monster-path-data.ts` from `MonStats.txt` / `MonStats2.txt`')
  lines.push(' * and compiled `monstats.bin` / `monstats2.bin` (Patch_D2.mpq overlay); do not edit by hand.')
  lines.push(' */')
  lines.push('')
  lines.push('/** `sgptDataTables->nMonStatsTxtRecordCount` (+0xA80): compiled MonStats records. */')
  lines.push(`export const MONSTATS_TXT_RECORD_COUNT = ${data.monStatsCount}`)
  lines.push('/** `sgptDataTables->nMonStats2TxtRecordCount` (+0xA98): compiled MonStats2 records. */')
  lines.push(`export const MONSTATS2_TXT_RECORD_COUNT = ${data.monStats2Count}`)
  lines.push(`/** Values per monster in {@link MONSTER_PATH_DATA}. */`)
  lines.push(`export const MONSTER_PATH_DATA_STRIDE = ${MONSTER_PATH_DATA_STRIDE}`)
  lines.push('')
  lines.push('/** MonStats `Id` per hcIdx. */')
  lines.push('export const MONSTER_PATH_IDS: readonly string[] = Object.freeze([')
  for (let i = 0; i < data.ids.length; i += 8) {
    lines.push('  ' + data.ids.slice(i, i + 8).map(s => JSON.stringify(s)).join(', ') + ',')
  }
  lines.push('])')
  lines.push('')
  lines.push('/**')
  lines.push(' * Per hcIdx: `[wBaseId, dwMonStatsFlags (opendoors/npc/interact/inTown/flying bits only), Velocity, Run,')
  lines.push(' * wMonStatsEx, MonStats2.nSizeX, MonStats2.nSizeY, MonStats2.dwFlags (revive/isAtt/small bits only),')
  lines.push(' * nWalkAnimSpeed (+0x36), nRunAnimSpeed (+0x38), nSplEndDeath (+0x1A4), nSplClientEnd (+0x1A7),')
  lines.push(' * MonStats2.dwModeFlags (+0xF0), MonStats2.nModeEnabledWhenMovingFlags (+0x104),')
  lines.push(' * ...13 per-mode AnimData base speeds for modes 0..12 (DT,NU,WL,GH,A1,A2,BL,SC,S1,S2,S3,S4,DD)]`.')
  lines.push(' */')
  lines.push('export const MONSTER_PATH_DATA: readonly number[] = Object.freeze([')
  for (let i = 0; i < data.ids.length; i++) {
    const row = data.rows.slice(i * MONSTER_PATH_DATA_STRIDE, (i + 1) * MONSTER_PATH_DATA_STRIDE)
    lines.push(`  ${row.join(', ')}, // ${i} ${data.ids[i]}`)
  }
  lines.push('])')
  lines.push('')
  return lines.join('\n')
}

export const MONSTER_PATH_DATA_MODULE = join('src', 'common', 'path', 'monster-path-data.ts')

/** Packs (or with `check` verifies) the generated module; returns the rendered text. */
export async function packMonsterPathData(rootDir: string = process.cwd(), check = false): Promise<string> {
  const [reg, archives] = await Promise.all([getSharedDataRegistry(), getSharedMountedArchives()])
  const text = renderMonsterPathDataModule(
    buildMonsterPathData(
      reg.monStatsTable,
      reg.monStats2Table,
      archives.readBytes(MONSTATS_BIN_PATH),
      archives.readBytes(MONSTATS2_BIN_PATH),
      reg.animData,
    ),
  )
  const target = join(rootDir, MONSTER_PATH_DATA_MODULE)
  if (check) {
    const current = readFileSync(target, 'utf-8')
    if (current !== text) throw new Error(`${MONSTER_PATH_DATA_MODULE} is stale; re-run the packer`)
  } else {
    writeFileSync(target, text)
  }
  return text
}

if (process.argv[1] && process.argv[1].endsWith('pack-monster-path-data.ts')) {
  const check = process.argv.includes('--check')
  packMonsterPathData(process.cwd(), check)
    .then(() => console.log(check ? `${MONSTER_PATH_DATA_MODULE} is up to date` : `wrote ${MONSTER_PATH_DATA_MODULE}`))
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}
