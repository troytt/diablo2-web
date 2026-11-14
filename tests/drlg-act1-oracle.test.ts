/**
 * Act I outdoor DRLG: bit-exact parity of the TypeScript port (src/game/drlg) with the native D2MOO
 * oracle (tools/d2moo-oracle), and of the level maps the bake makes from it (src/common/drlg/drlg-map.ts).
 *
 * - The committed fixtures are the oracle's schema-3 dumps of four game seeds: 0x12345678 and the
 *   three seeds the bake generates Act I from (0x5eed0100..0102). The port, fed from the MPQ data
 *   exactly as the bake feeds it (scripts/lib/drlg-mpq-source.ts), must reproduce every stage: the act
 *   layout, the level grids, the rooms, every room's activation and its tile lists.
 * - The oracle's dump and the port's dump then go through the same adapter; the canvases, DT1 library
 *   lists, entrances and landmarks must be identical, so a baked map is the map the oracle generates.
 * - With the oracle binary built, one seed is re-run live and its RNG trace compared roll by roll.
 * - Anti-cheat guards keep fixture data, seed literals and level-name branches out of the port.
 *
 * The MPQ data (samples/d2) is required: without it the suite fails instead of skipping.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Dt1 } from '../src/common/formats/dt1.ts'
import { parseTable } from '../src/common/world/acts.ts'
import { DrlgTraceWriter, dumpAct1, type DrlgDump } from '../src/common/drlg/drlg-dump.ts'
import { act1OutdoorLevelIds, buildDrlgLevelMap, drlgLevelInputFromDump, type DrlgLevelMap } from '../src/common/drlg/drlg-map.ts'
import { createDrlgEnv } from '../src/common/drlg/drlg-source.ts'
import { loadDrlgTables } from '../src/common/drlg/drlg-tables.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { drlgLevelDt1s, drlgSuperUniqueIds, loadDrlgMpqData, type DrlgMpqData } from '../src/baker/io/drlg-mpq-source.ts'
import {
  firstDiff,
  firstTraceDivergence,
  formatDiff,
  fsDrlgSource,
  ORACLE_BIN,
  ORACLE_DATA,
  runOracle,
} from '../tools/lib/drlg-oracle.ts'

/** The Act I levels Levels.txt generates with the outdoor DRLG (checked against the table below). */
const ACT1_OUTDOOR_LEVELS = [2, 3, 4, 5, 6, 7, 17, 39]
const FIXTURE_DIR = resolve(import.meta.dirname, 'fixtures/d2moo-oracle')
const FIXTURE_SEEDS = [0x12345678, 0x5eed0100, 0x5eed0101, 0x5eed0102]
const ARCHIVE_DIR = resolve(import.meta.dirname, '../samples/d2')
const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
const SUPERUNIQUES_TXT = 'data\\global\\excel\\SuperUniques.txt'

function hexSeed(seed: number): string {
  return seed.toString(16).padStart(8, '0')
}

function readFixture(seed: number): DrlgDump {
  const doc = JSON.parse(gunzipSync(readFileSync(resolve(FIXTURE_DIR, `act1-seed-${hexSeed(seed)}.json.gz`))).toString('utf8')) as DrlgDump
  delete doc.oracle
  return doc
}

/** What the bake takes from a mapped level: the canvas and everything it links or places. */
function bakedPart(map: DrlgLevelMap): unknown {
  return { ds1: map.ds1, dt1Names: map.dt1Names, entrances: map.entrances, landmarks: map.landmarks, stats: map.stats }
}

describe('Act I outdoor DRLG 1:1 parity against native D2MOO oracle', () => {
  let data: DrlgMpqData
  let superUniqueIds: string[]
  const dt1Cache = new Map<string, Dt1>()

  beforeAll(async () => {
    const missing = MOUNTS.filter(name => !existsSync(join(ARCHIVE_DIR, name)))
    if (missing.length > 0) throw new Error(`the DRLG parity suite needs the 1.13c archives in ${ARCHIVE_DIR}; missing ${missing.join(', ')}`)
    const archives = new MountedArchives()
    for (const name of MOUNTS) archives.add(name, await MpqArchive.open(await fileSource(join(ARCHIVE_DIR, name))))
    data = await loadDrlgMpqData(member => archives.read(member), 1)
    superUniqueIds = drlgSuperUniqueIds(parseTable(await archives.read(SUPERUNIQUES_TXT)), data.tables)
  }, 120_000)

  function mapLevel(dump: DrlgDump, levelId: number): DrlgLevelMap {
    const input = drlgLevelInputFromDump(dump, levelId, data.tables)
    return buildDrlgLevelMap(input, { tables: data.tables, dt1: drlgLevelDt1s(input, data.source, dt1Cache), superUniqueIds })
  }

  it('takes the outdoor level list from Levels.txt', () => {
    expect(act1OutdoorLevelIds(data.tables)).toEqual(ACT1_OUTDOOR_LEVELS)
  })

  for (const seed of FIXTURE_SEEDS) {
    const hex = hexSeed(seed)
    it(`seed 0x${hex}: the MPQ-fed port reproduces every oracle stage, and both map to identical canvases`, () => {
      const expected = readFixture(seed)
      const actual = dumpAct1(createDrlgEnv(data.source, data.tables), seed, ACT1_OUTDOOR_LEVELS, {
        difficulty: 0,
        isolated: false,
      })
      const diff = firstDiff(expected, actual, '$')
      if (diff) throw new Error(`Mismatch on seed 0x${hex}: ${formatDiff(diff)}`)

      for (const levelId of ACT1_OUTDOOR_LEVELS) {
        const oracleMap = mapLevel(expected, levelId)
        const portMap = mapLevel(actual, levelId)
        const canvasDiff = firstDiff(bakedPart(oracleMap), bakedPart(portMap), `$.L${levelId}`)
        if (canvasDiff) throw new Error(`Canvas mismatch on seed 0x${hex}: ${formatDiff(canvasDiff)}`)

        // The canvas is the level's tile rectangle (plus the closing row/column a DS1 has), every tile
        // D2 placed is on it, and every level link and warp of the level became an entrance.
        const { coord, ds1, stats } = portMap
        expect(ds1.width).toBe(coord.width + 1)
        expect(ds1.height).toBe(coord.height + 1)
        expect(stats.floors).toBeGreaterThan(0)
        expect(stats.walls).toBeGreaterThan(0)
        const level = actual.levels.find(l => l.id === levelId)!
        const orths = level.levelGrid!.roomData.length
        const warpUnits = level.activation.reduce((n, room) => n + room.mapTiles.units.filter(u => u[0] === 5).length, 0)
        expect(portMap.entrances.filter(e => e.kind === 'gate')).toHaveLength(orths)
        expect(portMap.entrances.filter(e => e.kind === 'preset')).toHaveLength(warpUnits)
      }
    }, 60_000)
  }

  it.skipIf(!existsSync(ORACLE_BIN))('matches live native oracle + RNG trace on seed 0x12345678', () => {
    const seed = 0x12345678
    const oracleRun = runOracle({
      seed,
      levels: ACT1_OUTDOOR_LEVELS,
      difficulty: 0,
      isolated: false,
      dataDir: ORACLE_DATA,
      trace: true,
    })
    delete oracleRun.doc.oracle
    const source = fsDrlgSource(ORACLE_DATA)
    const trace = new DrlgTraceWriter()
    const actual = dumpAct1(createDrlgEnv(source, loadDrlgTables(source)), seed, ACT1_OUTDOOR_LEVELS, {
      difficulty: 0,
      isolated: false,
      trace,
    })
    const diff = firstDiff(oracleRun.doc, actual, '$')
    if (diff) {
      throw new Error(`Dump mismatch: ${formatDiff(diff)}`)
    }
    const traceDiff = firstTraceDivergence(oracleRun.trace ?? [], trace.lines)
    expect(traceDiff).toBeNull()
  }, 60_000)

  it('enforces anti-cheat guards on src/common/drlg/* (no fixture reads, no seed literal branches, no levelName conditionals)', () => {
    const drlgDir = resolve(import.meta.dirname, '../src/common/drlg')
    const files = readdirSync(drlgDir).filter(f => f.endsWith('.ts'))
    expect(files.length).toBeGreaterThan(10)
    for (const file of files) {
      const content = readFileSync(join(drlgDir, file), 'utf8')
      expect(content, `${file} must not reference tests/fixtures`).not.toContain('tests/fixtures')
      expect(content, `${file} must not reference act1-seed-`).not.toContain('act1-seed-')
      expect(content, `${file} must not hardcode fixture seed 0x12345678`).not.toMatch(/0x12345678/i)
      expect(content, `${file} must not hardcode fixture seed 0x5eed`).not.toMatch(/0x5eed/i)
      expect(content, `${file} must not branch on levelName`).not.toContain('levelName')
    }
  })
})
