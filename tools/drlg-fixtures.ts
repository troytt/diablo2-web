/**
 * Regenerates the committed native-oracle fixtures of tests/drlg-act1-oracle.test.ts.
 *
 * Each fixture is the D2MOO oracle's dump (tools/d2moo-oracle, schema 3) of the Act I outdoor levels
 * for one game seed: difficulty 0, one shared act, every room activated through
 * DRLGROOMTILE_AddRoomMapTiles. The test diffs the TypeScript port against them without needing the
 * native binary.
 *
 * Usage: npx tsx scripts/drlg-fixtures.ts [output-directory]
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { act1OutdoorLevelIds } from '../src/common/drlg/drlg-map.ts'
import { loadDrlgTables } from '../src/common/drlg/drlg-tables.ts'
import { fsDrlgSource, ORACLE_DATA, runOracle } from './lib/drlg-oracle.ts'

/** The seeds the test pins: an arbitrary one plus the three Act I layouts the bake ships (0x5eed0100 + v). */
export const DRLG_FIXTURE_SEEDS: readonly number[] = [0x12345678, 0x5eed0100, 0x5eed0101, 0x5eed0102]

function main(): void {
  const outDir = resolve(process.argv[2] ?? join(import.meta.dirname, '../tests/fixtures/d2moo-oracle'))
  mkdirSync(outDir, { recursive: true })
  const levels = act1OutdoorLevelIds(loadDrlgTables(fsDrlgSource(ORACLE_DATA)))
  for (const seed of DRLG_FIXTURE_SEEDS) {
    const { doc } = runOracle({ seed, levels, difficulty: 0, isolated: false })
    if (doc.schema !== 3) throw new Error(`oracle wrote schema ${String(doc.schema)}, expected 3 (rebuild it with tools/d2moo-oracle/build.sh)`)
    const json = JSON.stringify(doc)
    const path = join(outDir, `act1-seed-${(seed >>> 0).toString(16).padStart(8, '0')}.json.gz`)
    const gz = gzipSync(json, { level: 9 })
    writeFileSync(path, gz)
    console.log(`${path}: ${(json.length / 1048576).toFixed(1)} MB JSON, ${(gz.length / 1024).toFixed(0)} KB gzip`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
