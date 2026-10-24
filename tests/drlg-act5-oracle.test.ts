/**
 * Act V outdoor DRLG (#498): bit-exact parity of the TypeScript port (src/game/drlg) with the native
 * D2MOO oracle (tools/d2moo-oracle) across all Act V outdoor levels (110-112, 117, 134).
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { DrlgTraceWriter, dumpAct1 } from '../src/common/drlg/drlg-dump.ts'
import { drlgLevelInputFromDump } from '../src/common/drlg/drlg-map.ts'
import { createDrlgEnv } from '../src/common/drlg/drlg-source.ts'
import { loadDrlgTables } from '../src/common/drlg/drlg-tables.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { loadDrlgMpqData, type DrlgMpqData } from '../src/baker/io/drlg-mpq-source.ts'
import {
  firstDiff,
  firstTraceDivergence,
  formatDiff,
  fsDrlgSource,
  ORACLE_BIN,
  ORACLE_DATA,
  runOracle,
} from '../tools/lib/drlg-oracle.ts'

const ACT5_OUTDOOR_LEVELS = [110, 111, 112, 117, 134]
const SEEDS = [0x12345678, 0x5eed0500, 0x5eed0501, 0x5eed0502]
const ARCHIVE_DIR = resolve(import.meta.dirname, '../samples/d2')
const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const

function hexSeed(seed: number): string {
  return seed.toString(16).padStart(8, '0')
}

describe('Act V outdoor DRLG 1:1 parity against native D2MOO oracle', () => {
  let data: DrlgMpqData

  beforeAll(async () => {
    const missing = MOUNTS.filter(name => !existsSync(join(ARCHIVE_DIR, name)))
    if (missing.length > 0) {
      throw new Error(`the DRLG parity suite needs the 1.13c archives in ${ARCHIVE_DIR}; missing ${missing.join(', ')}`)
    }
    const archives = new MountedArchives()
    for (const name of MOUNTS) archives.add(name, await MpqArchive.open(await fileSource(join(ARCHIVE_DIR, name))))
    data = await loadDrlgMpqData(member => archives.read(member), 5)
  }, 120_000)

  for (const seed of SEEDS) {
    const hex = hexSeed(seed)
    it.skipIf(!existsSync(ORACLE_BIN))(
      `seed 0x${hex}: MPQ-fed port reproduces every native oracle stage and RNG trace`,
      () => {
        const oracleRun = runOracle({
          seed,
          levels: ACT5_OUTDOOR_LEVELS,
          difficulty: 0,
          isolated: false,
          dataDir: ORACLE_DATA,
          trace: true,
        })
        delete oracleRun.doc.oracle

        const trace = new DrlgTraceWriter()
        const actual = dumpAct1(createDrlgEnv(data.source, data.tables), seed, ACT5_OUTDOOR_LEVELS, {
          difficulty: 0,
          isolated: false,
          trace,
        })
        const diff = firstDiff(oracleRun.doc, actual, '$')
        if (diff) throw new Error(`Mismatch on seed 0x${hex}: ${formatDiff(diff)}`)

        const traceDiff = firstTraceDivergence(oracleRun.trace ?? [], trace.lines)
        expect(traceDiff).toBeNull()

        for (const levelId of ACT5_OUTDOOR_LEVELS) {
          const input = drlgLevelInputFromDump(actual, levelId, data.tables)
          expect(input.tiles.length).toBeGreaterThan(0)
        }
      },
      60_000,
    )
  }

  it.skipIf(!existsSync(ORACLE_BIN))('matches live native oracle in --isolated mode on seed 0x12345678', () => {
    const seed = 0x12345678
    const oracleRun = runOracle({
      seed,
      levels: ACT5_OUTDOOR_LEVELS,
      difficulty: 0,
      isolated: true,
      dataDir: ORACLE_DATA,
      trace: true,
    })
    delete oracleRun.doc.oracle
    const source = fsDrlgSource(ORACLE_DATA)
    const trace = new DrlgTraceWriter()
    const actual = dumpAct1(createDrlgEnv(source, loadDrlgTables(source)), seed, ACT5_OUTDOOR_LEVELS, {
      difficulty: 0,
      isolated: true,
      trace,
    })
    const diff = firstDiff(oracleRun.doc, actual, '$')
    if (diff) throw new Error(`Isolated dump mismatch: ${formatDiff(diff)}`)
    const traceDiff = firstTraceDivergence(oracleRun.trace ?? [], trace.lines)
    expect(traceDiff).toBeNull()
  }, 60_000)
})
