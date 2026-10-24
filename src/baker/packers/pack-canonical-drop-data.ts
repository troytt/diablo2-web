/**
 * scripts/pack-canonical-drop-data.ts
 *
 * Offline extraction & packaging script for Diablo II v1.13c canonical drop tables:
 * - MonStats.txt: Extracts 19 essential drop & level columns across 3 difficulties
 * - SuperUniques.txt: Extracts 21 columns including multi-difficulty TC columns (TC, TC(N), TC(H))
 * - Difficultylevels.txt: Extracts 9 columns: base upgrade odds plus ResistPenalty / DeathExpPenalty and
 *   LifeStealDivisor / ManaStealDivisor (D2Game 0x6FCFBA40 life/mana steal) for Normal, Nightmare, Hell
 *
 * Aligns offline extraction with runtime contracts in `src/data/canonical-drop-data.ts`
 * and `src/game/embedded-drop-tables.ts` per Diablo II 1.13c ground truth parity rules.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { parseTable, cell } from '../../common/world/acts.ts'
import { readMonsterKinds, readSuperUniques } from '../../common/units/monsters-data.ts'
import { RAW_MONSTATS, RAW_SUPERUNIQUES, RAW_DIFFICULTY_LEVELS } from '../../common/data/canonical-drop-data.ts'
import { parseDifficultyLevelsTable } from '../../common/items/item-upgrade.ts'

export const MONSTATS_DROP_COLUMNS = [
  'Id',
  'BaseId',
  'NameStr',
  'DescStr',
  'lUndead',
  'hUndead',
  'demon',
  'killable',
  'inTown',
  'boss',
  'noRatio',
  'Level',
  'Level(N)',
  'Level(H)',
  'ResDm',
  'ResMa',
  'ResFi',
  'ResLi',
  'ResCo',
  'ResPo',
  'ResDm(N)',
  'ResMa(N)',
  'ResFi(N)',
  'ResLi(N)',
  'ResCo(N)',
  'ResPo(N)',
  'ResDm(H)',
  'ResMa(H)',
  'ResFi(H)',
  'ResLi(H)',
  'ResCo(H)',
  'ResPo(H)',
  'TreasureClass1',
  'TreasureClass2',
  'TreasureClass3',
  'TreasureClass4',
  'TreasureClass1(N)',
  'TreasureClass2(N)',
  'TreasureClass3(N)',
  'TreasureClass4(N)',
  'TreasureClass1(H)',
  'TreasureClass2(H)',
  'TreasureClass3(H)',
  'TreasureClass4(H)',
] as const

export const SUPERUNIQUES_DROP_COLUMNS = [
  'Superunique',
  'Name',
  'Class',
  'hcIdx',
  'MonSound',
  'Mod1',
  'Mod2',
  'Mod3',
  'MinGrp',
  'MaxGrp',
  'EClass',
  'AutoPos',
  'Stacks',
  'Replaceable',
  'Utrans',
  'Utrans(N)',
  'Utrans(H)',
  'TC',
  'TC(N)',
  'TC(H)',
  '*eol',
] as const

export const DIFFICULTY_LEVELS_DROP_COLUMNS = [
  'Name',
  'ResistPenalty',
  'DeathExpPenalty',
  'UberCodeOddsNormal',
  'UberCodeOddsGood',
  'UltraCodeOddsNormal',
  'UltraCodeOddsGood',
  'LifeStealDivisor',
  'ManaStealDivisor',
] as const

/**
 * Mounts standard 1.13c MPQ archives for table extraction.
 */
export async function openDropDataArchives(baseDir = 'samples/d2'): Promise<MountedArchives> {
  const archives = new MountedArchives()
  for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    const fullPath = join(baseDir, name)
    if (!existsSync(fullPath)) {
      throw new Error(`Required MPQ archive not found: ${fullPath}`)
    }
    archives.add(name, await MpqArchive.open(await fileSource(fullPath)))
  }
  return archives
}

/**
 * Extracts canonical MonStats drop columns into TSV format matching RAW_MONSTATS.
 */
export async function extractCanonicalMonStats(archives: MountedArchives): Promise<string> {
  const bytes = await archives.read('data\\global\\excel\\monstats.txt')
  const table = parseTable(bytes)

  let tsv = MONSTATS_DROP_COLUMNS.join('\t') + '\r\n'
  for (const row of table.rows) {
    const values = MONSTATS_DROP_COLUMNS.map(col => cell(table, row, col))
    tsv += values.join('\t') + '\r\n'
  }
  return tsv
}

/**
 * Extracts canonical SuperUniques columns into TSV format matching RAW_SUPERUNIQUES.
 */
export async function extractCanonicalSuperUniques(archives: MountedArchives): Promise<string> {
  const bytes = await archives.read('data\\global\\excel\\SuperUniques.txt')
  const table = parseTable(bytes)

  let tsv = SUPERUNIQUES_DROP_COLUMNS.join('\t') + '\r\n'
  for (const row of table.rows) {
    const values = SUPERUNIQUES_DROP_COLUMNS.map(col => cell(table, row, col))
    tsv += values.join('\t') + '\r\n'
  }
  return tsv
}

/**
 * Extracts canonical DifficultyLevels columns into TSV format matching RAW_DIFFICULTY_LEVELS.
 */
export async function extractCanonicalDifficultyLevels(archives: MountedArchives): Promise<string> {
  const bytes = await archives.read('data\\global\\excel\\difficultylevels.txt')
  const table = parseTable(bytes)

  let tsv = DIFFICULTY_LEVELS_DROP_COLUMNS.join('\t') + '\r\n'
  for (const row of table.rows) {
    const values = DIFFICULTY_LEVELS_DROP_COLUMNS.map(col => cell(table, row, col))
    tsv += values.join('\t') + '\r\n'
  }
  return tsv
}

/**
 * Packs extracted canonical drop data into src/data/canonical-drop-data.ts
 */
export async function packCanonicalDropData(options: {
  baseDir?: string
  targetFile?: string
} = {}): Promise<{ monstatsBytes: number; superUniquesBytes: number; difficultyLevelsBytes: number }> {
  const { readFileSync, writeFileSync } = await import('node:fs')
  const baseDir = options.baseDir ?? 'samples/d2'
  const targetFile = options.targetFile ?? join(process.cwd(), 'src/common/data/canonical-drop-data.ts')

  const archives = await openDropDataArchives(baseDir)
  const monstatsTsv = await extractCanonicalMonStats(archives)
  const superUniquesTsv = await extractCanonicalSuperUniques(archives)
  const difficultyLevelsTsv = await extractCanonicalDifficultyLevels(archives)

  let content = readFileSync(targetFile, 'utf-8')
  // Update RAW_MONSTATS export
  const monstatsPattern = /export const RAW_MONSTATS: string = "[\s\S]*?"\r?\n/
  const newMonstatsExport = `export const RAW_MONSTATS: string = ${JSON.stringify(monstatsTsv)}\r\n`
  if (monstatsPattern.test(content)) {
    content = content.replace(monstatsPattern, newMonstatsExport)
  } else {
    content += `\r\n${newMonstatsExport}`
  }

  // Update RAW_SUPERUNIQUES export
  const suPattern = /export const RAW_SUPERUNIQUES: string = "[\s\S]*?"\r?\n/
  const newSuExport = `export const RAW_SUPERUNIQUES: string = ${JSON.stringify(superUniquesTsv)}\r\n`
  if (suPattern.test(content)) {
    content = content.replace(suPattern, newSuExport)
  } else {
    content += `\r\n${newSuExport}`
  }

  // Update RAW_DIFFICULTY_LEVELS export
  const diffPattern = /export const RAW_DIFFICULTY_LEVELS: string = "[\s\S]*?"\r?\n/
  const newDiffExport = `export const RAW_DIFFICULTY_LEVELS: string = ${JSON.stringify(difficultyLevelsTsv)}\r\n`
  if (diffPattern.test(content)) {
    content = content.replace(diffPattern, newDiffExport)
  } else {
    content += `\r\n${newDiffExport}`
  }

  writeFileSync(targetFile, content, 'utf-8')
  return {
    monstatsBytes: Buffer.byteLength(monstatsTsv, 'utf-8'),
    superUniquesBytes: Buffer.byteLength(superUniquesTsv, 'utf-8'),
    difficultyLevelsBytes: Buffer.byteLength(difficultyLevelsTsv, 'utf-8'),
  }
}

/**
 * Audits 1.13c ground truth parity between MPQ archives and embedded constants.
 */
export async function auditDropParity(
  baseDir = 'samples/d2',
  targetFile = join(process.cwd(), 'src/common/data/canonical-drop-data.ts'),
): Promise<{
  monstatsMatch: boolean
  superUniquesMatch: boolean
  difficultyLevelsMatch: boolean
  monsterKindsCount: number
  superUniquesCount: number
  difficultyLevelsCount: number
}> {
  const archives = await openDropDataArchives(baseDir)
  const extractedMon = await extractCanonicalMonStats(archives)
  const extractedSu = await extractCanonicalSuperUniques(archives)
  const extractedDiff = await extractCanonicalDifficultyLevels(archives)

  const { readFileSync } = await import('node:fs')
  let currentMon = RAW_MONSTATS
  let currentSu = RAW_SUPERUNIQUES
  let currentDiff = RAW_DIFFICULTY_LEVELS
  try {
    const content = readFileSync(targetFile, 'utf-8')
    const monMatch = content.match(/export const RAW_MONSTATS: string = ("[\s\S]*?")\r?\n/)
    if (monMatch) currentMon = JSON.parse(monMatch[1]!)
    const suMatch = content.match(/export const RAW_SUPERUNIQUES: string = ("[\s\S]*?")\r?\n/)
    if (suMatch) currentSu = JSON.parse(suMatch[1]!)
    const diffMatch = content.match(/export const RAW_DIFFICULTY_LEVELS: string = ("[\s\S]*?")\r?\n/)
    if (diffMatch) currentDiff = JSON.parse(diffMatch[1]!)
  } catch {
    // fallback to statically imported constants
  }

  const monstatsMatch = extractedMon === currentMon
  const superUniquesMatch = extractedSu === currentSu
  const difficultyLevelsMatch = extractedDiff === currentDiff

  const enc = new TextEncoder()
  const monKinds = readMonsterKinds(parseTable(enc.encode(currentMon)))
  const suList = readSuperUniques(parseTable(enc.encode(currentSu)))
  const diffTable = parseDifficultyLevelsTable(parseTable(enc.encode(currentDiff)))

  return {
    monstatsMatch,
    superUniquesMatch,
    difficultyLevelsMatch,
    monsterKindsCount: monKinds.size,
    superUniquesCount: suList.length,
    difficultyLevelsCount: diffTable.length,
  }
}

if (process.argv[1] && process.argv[1].endsWith('pack-canonical-drop-data.ts')) {
  const shouldPack = process.argv.includes('--pack') || process.argv.includes('--write')
  const run = async () => {
    if (shouldPack) {
      console.log('Packing canonical drop data into src/common/data/canonical-drop-data.ts...')
      const res = await packCanonicalDropData()
      console.log(`Packed MonStats (${res.monstatsBytes} bytes), SuperUniques (${res.superUniquesBytes} bytes), and DifficultyLevels (${res.difficultyLevelsBytes} bytes).`)
    }
    const result = await auditDropParity()
    console.log('=== Diablo II v1.13c Drop Data Parity Audit ===')
    console.log(`MonStats extraction matches RAW_MONSTATS: ${result.monstatsMatch ? 'PASS' : 'FAIL'}`)
    console.log(`SuperUniques extraction matches RAW_SUPERUNIQUES: ${result.superUniquesMatch ? 'PASS' : 'FAIL'}`)
    console.log(`DifficultyLevels extraction matches RAW_DIFFICULTY_LEVELS: ${result.difficultyLevelsMatch ? 'PASS' : 'FAIL'}`)
    console.log(`Monster kinds hydrated: ${result.monsterKindsCount} (expected: 734)`)
    console.log(`SuperUniques hydrated: ${result.superUniquesCount} (expected: 66)`)
    console.log(`DifficultyLevels hydrated: ${result.difficultyLevelsCount} (expected: 3)`)
    if (!result.monstatsMatch || !result.superUniquesMatch || !result.difficultyLevelsMatch || result.monsterKindsCount !== 734 || result.superUniquesCount !== 66 || result.difficultyLevelsCount !== 3) {
      process.exit(1)
    }
    console.log('All drop data contracts verified with 100% 1.13c parity.')
  }
  run().catch(err => {
    console.error('Operation failed:', err)
    process.exit(1)
  })
}
