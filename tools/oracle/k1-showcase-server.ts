/**
 * [K1] D2Common 1,479-Function Isomorphic Kernel Interactive Visual Showcase Backend
 * (`tools/oracle/k1-showcase-server.ts`).
 *
 * Serves 100% authentic ground-truth oracle data and live kernel executions across 4 zones:
 *   1. `/api/k1-showcase/replay`       — Longitudinal replay (`a1-town-walk` F2..F750 & `a1c-bloodmoor-fallen` F2..F2000)
 *   2. `/api/k1-showcase/drlg`         — 20,400-vector DRLG digest catalog + live single-level `src/d2kern-113c` DRLG & `XOR=0` parity
 *   3. `/api/k1-showcase/path-world`   — `path-world-town-s12345.img.gz` pages + 35 Rogue Encampment rooms + Fog sin table
 *      `/api/k1-showcase/path-vectors` — 6,924 `PATHVEC` real-DLL vectors (JSON summary/filter + raw binary stream)
 *   4. `/api/k1-showcase/callgraph`    — `manifest-113c.json` (`1,479 / 1,479` D2Common + `3,331` D2Game)
 *      `/api/k1-showcase/fn-detail`    — Live `objdump -d -M intel` disassembly + AST-extracted `src/d2kern-113c` TS source + callers/callees
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, fstatSync, openSync, readdirSync, readFileSync, readSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import * as ts from 'typescript'
import { FOG_SIN_TABLE } from '../../src/client/weather/fog-sin-table.ts'
import { MpqArchive } from '../../src/common/mpq/archive.ts'
import type { MpqSource } from '../../src/common/mpq/source.ts'
import { LEVEL_NAMES_ZH } from '../../src/common/world/level-names-zh.ts'
import { CANONICAL_LEVEL_LIGHTING } from '../../src/common/world/levels-meta.ts'
import * as d2kern from '../../src/d2kern-113c/index.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from '../../src/d2kern-113c/common/dungeon.ts'
import {
  D2ActStrc,
  D2ActiveRoomStrc,
  D2GameStrc,
  D2PresetUnitStrc,
  D2RoomCollisionGridStrc,
  D2RoomExStrc,
} from '../../src/d2kern-113c/mem/layout.generated.ts'
import type { Memory113c, SparseMemory113c } from '../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  bootFromSnapshot113c,
  diffFrame113c,
  loadGolden113c,
  loadScenario113c,
  loadSnapshotFile113c,
  sampleFrame113c,
  snapshotPath113c,
  stepFrame113c,
  type FieldDivergence113c,
} from './kern-replay/replay-113c.ts'
import type { TraceFrame, TraceHeader, UnitRow } from './lib/trace-diff.ts'
import { DRLG_DATATBLS_IMG_PATH, parseDrlgDataTablesImage } from './vectors/drlg-ts-runner.ts'
import {
  computeDrlgLevelCollHash,
  computeDrlgLevelLayoutHash,
  DRLG_FROZEN_SEEDS,
  DRLG_LEVEL_HEADER_MARKER,
  DRLG_TOWN_LEVEL_IDS,
  parseDrlgCollFile,
  parseDrlgDigestFile,
  parseDrlgRoomsFile,
  sha256Low64LE,
  type DrlgCollRecord,
  type DrlgDigestRecord,
  type DrlgLevelHeaderRecord,
  type DrlgLevelRoomsGroup,
  type DrlgRoomRecord,
} from './vectors/drlg-vector.ts'
import {
  parsePathVectors,
  parsePathWorldImage,
  type PageImageRecord,
  type PathVectorRecord,
  type PathWorldMetaHeader,
} from './vectors/path-vector.ts'

const DEFAULT_REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

export function resolveD2DataDir(rootDir: string = DEFAULT_REPO_ROOT): string {
  const candidates = [
    ...(process.env.D2_DATA_DIR ? [resolve(process.env.D2_DATA_DIR)] : []),
    resolve(rootDir, 'samples/d2'),
    join(homedir(), 'd2-data'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'D2Common.dll')) || existsSync(join(dir, 'd2data.mpq'))) {
      return dir
    }
  }
  return join(homedir(), 'd2-data')
}

// ---------------------------------------------------------------------------
// Zone 1: Longitudinal Replay (`a1-town-walk` & `a1c-bloodmoor-fallen`)
// ---------------------------------------------------------------------------

export const SUPPORTED_REPLAY_SCENARIOS = ['a1-town-walk', 'a1c-bloodmoor-fallen'] as const
export type ReplayScenarioId = (typeof SUPPORTED_REPLAY_SCENARIOS)[number]

export interface ShowcaseReplayUnit {
  readonly type: number
  readonly id: number
  readonly classId: number
  readonly mode: number
  readonly x: number
  readonly y: number
  readonly seedLo: number
  readonly seedHi: number
  readonly level: number
  readonly hp: number
  readonly maxHp: number
  readonly mana: number
  readonly maxMana: number
  readonly xp: number
  readonly charLevel: number
}

export interface ShowcaseReplayRoom {
  readonly key: string
  readonly levelId: number
  readonly subtileX: number
  readonly subtileY: number
  readonly subtileW: number
  readonly subtileH: number
  readonly mapBase64: string
}

export interface ShowcaseReplayFrame {
  readonly frame: number
  readonly gsWine: readonly [number, number] | null
  readonly gsTs: readonly [number, number] | null
  readonly c2s: readonly string[]
  readonly diff: FieldDivergence113c | null
  readonly wineUnits: readonly ShowcaseReplayUnit[]
  readonly tsUnits: readonly ShowcaseReplayUnit[]
}

export interface ShowcaseReplayPayload {
  readonly ok: true
  readonly scenario: ReplayScenarioId
  readonly bootFrame: number
  readonly lastGoldenFrame: number
  readonly strictHorizon: number
  readonly posHorizon: number
  readonly firstStrictDivergence: FieldDivergence113c | null
  readonly firstPosDivergence: FieldDivergence113c | null
  readonly totalFramesCompared: number
  readonly computeMs: number
  readonly initSeed: number
  readonly inputCount: number
  readonly rooms: readonly ShowcaseReplayRoom[]
  readonly frames: readonly ShowcaseReplayFrame[]
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex.replace(/\s+/g, ''), 'hex'))
}

function extractFrameUnits(frame: TraceFrame, header: TraceHeader): ShowcaseReplayUnit[] {
  const idIdx = header.unitFields.indexOf('id')
  const clsIdx = header.unitFields.indexOf('class')
  const modeIdx = header.unitFields.indexOf('mode')
  const xIdx = header.unitFields.indexOf('x')
  const yIdx = header.unitFields.indexOf('y')
  const seedLoIdx = header.unitFields.indexOf('seedLo')
  const seedHiIdx = header.unitFields.indexOf('seedHi')
  const lvlIdx = header.unitFields.indexOf('level')

  const statCol = (statId: number): number => {
    const idx = header.statIds.indexOf(statId)
    return idx >= 0 ? header.unitFields.length + idx : -1
  }
  const hpCol = statCol(6)
  const maxHpCol = statCol(7)
  const manaCol = statCol(8)
  const maxManaCol = statCol(9)
  const charLvlCol = statCol(12)
  const xpCol = statCol(13)

  const numAt = (row: UnitRow, col: number, fallback = 0): number => {
    if (col < 0 || col >= row.length) return fallback
    const v = row[col]
    return typeof v === 'number' ? v : fallback
  }

  const units: ShowcaseReplayUnit[] = []
  for (const unitType of [0, 1, 3] as const) {
    const rows = frame[`t${unitType}`] ?? []
    for (const row of rows) {
      const hasStats = unitType === 0 || unitType === 1
      units.push({
        type: unitType,
        id: numAt(row, idIdx),
        classId: numAt(row, clsIdx),
        mode: numAt(row, modeIdx),
        x: numAt(row, xIdx),
        y: numAt(row, yIdx),
        seedLo: numAt(row, seedLoIdx) >>> 0,
        seedHi: numAt(row, seedHiIdx) >>> 0,
        level: lvlIdx >= 0 ? numAt(row, lvlIdx, 1) : 1,
        hp: hasStats ? numAt(row, hpCol) : 0,
        maxHp: hasStats ? numAt(row, maxHpCol) : 0,
        mana: hasStats ? numAt(row, manaCol) : 0,
        maxMana: hasStats ? numAt(row, maxManaCol) : 0,
        xp: hasStats ? numAt(row, xpCol) : 0,
        charLevel: hasStats ? numAt(row, charLvlCol, 1) : 0,
      })
    }
  }
  units.sort((a, b) => a.type - b.type || a.id - b.id)
  return units
}

function collectWorldActiveRooms(
  m: SparseMemory113c,
  pGame: number,
  into: Map<string, ShowcaseReplayRoom>,
): void {
  for (let actIdx = 0; actIdx < 5; actIdx++) {
    let pAct = 0
    try {
      pAct = m.get(pGame, D2GameStrc.pAct, actIdx)
    } catch {
      pAct = 0
    }
    if (pAct === 0) continue

    let r = 0
    try {
      r = m.get(pAct, D2ActStrc.pRoom1)
    } catch {
      r = 0
    }
    let guard = 0
    while (r !== 0 && guard++ < 512) {
      let nextR = 0
      try {
        nextR = m.get(r, D2ActiveRoomStrc.pRoomNext)
        const pColl = m.get(r, D2ActiveRoomStrc.pCollisionGrid)
        if (pColl !== 0) {
          const sx = m.get(pColl, D2RoomCollisionGridStrc.nSubtileX) | 0
          const sy = m.get(pColl, D2RoomCollisionGridStrc.nSubtileY) | 0
          const sw = m.get(pColl, D2RoomCollisionGridStrc.nSubtileWidth) | 0
          const sh = m.get(pColl, D2RoomCollisionGridStrc.nSubtileHeight) | 0
          const key = `${sx}:${sy}`
          if (!into.has(key) && sw > 0 && sh > 0 && sw <= 120 && sh <= 120) {
            const pMap = m.get(pColl, D2RoomCollisionGridStrc.pMapStart)
            if (pMap !== 0) {
              const mapBytes = m.readBytes(pMap, sw * sh * 2)
              let levelId = 1
              try {
                levelId = DUNGEON_GetLevelIdFromRoom113c(m, r)
              } catch {
                levelId = 1
              }
              into.set(key, {
                key,
                levelId,
                subtileX: sx,
                subtileY: sy,
                subtileW: sw,
                subtileH: sh,
                mapBase64: Buffer.from(mapBytes).toString('base64'),
              })
            }
          }
        }
      } catch {
        // Ignore unrecorded peripheral pointers
      }
      r = nextR
    }
  }
}

const replayCache = new Map<ReplayScenarioId, ShowcaseReplayPayload>()

export function getReplayShowcaseData(scenarioName: string): ShowcaseReplayPayload {
  if (!SUPPORTED_REPLAY_SCENARIOS.includes(scenarioName as ReplayScenarioId)) {
    throw new Error(
      `Unsupported scenario '${scenarioName}'. Expected one of: ${SUPPORTED_REPLAY_SCENARIOS.join(', ')}`,
    )
  }
  const id = scenarioName as ReplayScenarioId
  const cached = replayCache.get(id)
  if (cached) return cached

  const t0 = performance.now()
  const bootFrame = 2
  const golden = loadGolden113c(id)
  const scenario = loadScenario113c(id)
  const snap = loadSnapshotFile113c(snapshotPath113c(id, bootFrame))
  const world = bootFromSnapshot113c(snap)

  const inputsByFrame = new Map<number, string[]>()
  for (const inp of scenario.inputs) {
    let list = inputsByFrame.get(inp.frame)
    if (!list) {
      list = []
      inputsByFrame.set(inp.frame, list)
    }
    list.push(inp.c2s)
  }

  let lastGoldenFrame = 0
  for (const f of golden.frames.keys()) {
    if (f > lastGoldenFrame) lastGoldenFrame = f
  }

  const roomMap = new Map<string, ShowcaseReplayRoom>()
  collectWorldActiveRooms(world.m, world.pGame, roomMap)

  const frames: ShowcaseReplayFrame[] = []
  const bootGolden = golden.frames.get(bootFrame)
  if (!bootGolden) {
    throw new Error(`Golden trace '${id}' missing boot frame ${bootFrame}`)
  }

  const bootSample = sampleFrame113c(world, golden.header)
  const bootStrictDiff = diffFrame113c(bootGolden, bootSample, golden.header, 'strict')
  const bootPosDiff = diffFrame113c(bootGolden, bootSample, golden.header, 'pos')

  let strictHorizon = bootStrictDiff === null ? bootFrame : bootFrame - 1
  let posHorizon = bootPosDiff === null ? bootFrame : bootFrame - 1
  let firstStrictDivergence: FieldDivergence113c | null = bootStrictDiff
  let firstPosDivergence: FieldDivergence113c | null = bootPosDiff

  frames.push({
    frame: bootFrame,
    gsWine: bootGolden.gs ? [bootGolden.gs[0] >>> 0, bootGolden.gs[1] >>> 0] : null,
    gsTs: bootSample.gs ? [bootSample.gs[0] >>> 0, bootSample.gs[1] >>> 0] : null,
    c2s: inputsByFrame.get(bootFrame) ?? [],
    diff: bootStrictDiff,
    wineUnits: extractFrameUnits(bootGolden, golden.header),
    tsUnits: extractFrameUnits(bootSample, golden.header),
  })

  for (let f = bootFrame + 1; f <= lastGoldenFrame; f++) {
    const gFrame = golden.frames.get(f)
    if (!gFrame) {
      throw new Error(`Golden trace '${id}' missing frame ${f}`)
    }
    const hexInputs = inputsByFrame.get(f) ?? []
    const pktBytes = hexInputs.map(hexToBytes)
    stepFrame113c(world, pktBytes)

    if (f % 25 === 0 || f === lastGoldenFrame) {
      collectWorldActiveRooms(world.m, world.pGame, roomMap)
    }

    const tsSample = sampleFrame113c(world, golden.header)
    const strictDiff = diffFrame113c(gFrame, tsSample, golden.header, 'strict')
    const posDiff = diffFrame113c(gFrame, tsSample, golden.header, 'pos')

    if (firstStrictDivergence === null) {
      if (strictDiff === null) strictHorizon = f
      else firstStrictDivergence = strictDiff
    }
    if (firstPosDivergence === null) {
      if (posDiff === null) posHorizon = f
      else firstPosDivergence = posDiff
    }

    frames.push({
      frame: f,
      gsWine: gFrame.gs ? [gFrame.gs[0] >>> 0, gFrame.gs[1] >>> 0] : null,
      gsTs: tsSample.gs ? [tsSample.gs[0] >>> 0, tsSample.gs[1] >>> 0] : null,
      c2s: hexInputs,
      diff: strictDiff,
      wineUnits: extractFrameUnits(gFrame, golden.header),
      tsUnits: extractFrameUnits(tsSample, golden.header),
    })
  }

  const computeMs = Math.round(performance.now() - t0)
  const payload: ShowcaseReplayPayload = {
    ok: true,
    scenario: id,
    bootFrame,
    lastGoldenFrame,
    strictHorizon,
    posHorizon,
    firstStrictDivergence,
    firstPosDivergence,
    totalFramesCompared: frames.length,
    computeMs,
    initSeed: golden.header.initSeed ?? 12345,
    inputCount: scenario.inputs.length,
    rooms: [...roomMap.values()].sort((a, b) => a.subtileY - b.subtileY || a.subtileX - b.subtileX),
    frames,
  }
  replayCache.set(id, payload)
  return payload
}

// ---------------------------------------------------------------------------
// Zone 2: [K1-5] 20,400-Seed DRLG Dungeon & Collision Atlas
// ---------------------------------------------------------------------------

interface DrlgDigestCatalogCache {
  readonly digestSha256: string
  readonly digestRecords: readonly DrlgDigestRecord[]
  readonly digestByKey: ReadonlyMap<string, DrlgDigestRecord>
  readonly roomsS12345ByDiffLevel: ReadonlyMap<string, DrlgLevelRoomsGroup>
  readonly townCollS12345ByLevel: ReadonlyMap<number, readonly DrlgCollRecord[]>
}

let drlgCatalogCache: DrlgDigestCatalogCache | null = null

function getOrLoadDrlgDigestCatalog(rootDir: string = DEFAULT_REPO_ROOT): DrlgDigestCatalogCache {
  if (drlgCatalogCache) return drlgCatalogCache
  const fixturesDir = resolve(rootDir, 'tests/fixtures/oracle/vectors')
  const digRaw = new Uint8Array(gunzipSync(readFileSync(join(fixturesDir, 'drlg-digest-113c.d2tv.gz'))))
  const roomsRaw = new Uint8Array(gunzipSync(readFileSync(join(fixturesDir, 'drlg-rooms-s12345.d2tv.gz'))))
  const collRaw = new Uint8Array(gunzipSync(readFileSync(join(fixturesDir, 'drlg-coll-towns-s12345-d0.d2tv.gz'))))

  const digestSha256 = createHash('sha256').update(digRaw).digest('hex')
  const parsedDig = parseDrlgDigestFile(digRaw)
  const parsedRooms = parseDrlgRoomsFile(roomsRaw)
  const parsedColl = parseDrlgCollFile(collRaw)

  const digestByKey = new Map<string, DrlgDigestRecord>()
  for (const r of parsedDig.records) {
    digestByKey.set(`${r.seed}:${r.diff}:${r.levelId}`, r)
  }

  const roomsS12345ByDiffLevel = new Map<string, DrlgLevelRoomsGroup>()
  for (const grp of parsedRooms.levels) {
    roomsS12345ByDiffLevel.set(`${grp.header.diff}:${grp.header.levelId}`, grp)
  }

  const townCollS12345ByLevel = new Map<number, readonly DrlgCollRecord[]>()
  let cursor = 0
  for (const townId of DRLG_TOWN_LEVEL_IDS) {
    const dig = digestByKey.get(`12345:0:${townId}`)
    const count = dig ? dig.nCollRooms : 0
    townCollS12345ByLevel.set(townId, parsedColl.records.slice(cursor, cursor + count))
    cursor += count
  }

  drlgCatalogCache = {
    digestSha256,
    digestRecords: parsedDig.records,
    digestByKey,
    roomsS12345ByDiffLevel,
    townCollS12345ByLevel,
  }
  return drlgCatalogCache
}

export interface ShowcaseDrlgLevelMeta {
  readonly id: number
  readonly act: number
  readonly nameEn: string
  readonly nameZh: string
  readonly internalName: string
  readonly isInside: boolean
  readonly drlgType: number
  readonly isTown: boolean
  readonly defaultRoomsD0: number
  readonly defaultRoomsD2: number
}

export interface ShowcaseDrlgCatalogResponse {
  readonly ok: true
  readonly totalRecords: number
  readonly seedCount: number
  readonly diffCount: number
  readonly levelCount: number
  readonly digestSha256: string
  readonly frozenSeeds: readonly number[]
  readonly townLevelIds: readonly number[]
  readonly diffSensitiveLevels: readonly number[]
  readonly actSummary: ReadonlyArray<{
    readonly act: number
    readonly levelCount: number
    readonly vectorCount: number
  }>
  readonly levels: readonly ShowcaseDrlgLevelMeta[]
}

export function getDrlgCatalogData(rootDir: string = DEFAULT_REPO_ROOT): ShowcaseDrlgCatalogResponse {
  const cat = getOrLoadDrlgDigestCatalog(rootDir)
  const townSet = new Set<number>(DRLG_TOWN_LEVEL_IDS)
  const levels: ShowcaseDrlgLevelMeta[] = []
  const diffSensitiveLevels: number[] = []
  const actCounts = [0, 0, 0, 0, 0]

  for (let id = 1; id <= 136; id++) {
    const meta = CANONICAL_LEVEL_LIGHTING[id]
    const d0 = cat.digestByKey.get(`12345:0:${id}`)
    const d2 = cat.digestByKey.get(`12345:2:${id}`)
    const act = meta?.act ?? (id <= 39 ? 1 : id <= 74 ? 2 : id <= 102 ? 3 : id <= 108 ? 4 : 5)
    actCounts[act - 1] = (actCounts[act - 1] ?? 0) + 1
    if (d0 && d2 && d0.nRoomsField !== d2.nRoomsField) {
      diffSensitiveLevels.push(id)
    }
    levels.push({
      id,
      act,
      nameEn: meta?.levelName ?? `Level ${id}`,
      nameZh: LEVEL_NAMES_ZH[id] ?? meta?.levelName ?? `场景 ${id}`,
      internalName: meta?.name ?? `Level ${id}`,
      isInside: meta?.isInside ?? false,
      drlgType: d0?.drlgType ?? 1,
      isTown: townSet.has(id),
      defaultRoomsD0: d0?.nRoomsField ?? 0,
      defaultRoomsD2: d2?.nRoomsField ?? 0,
    })
  }

  return {
    ok: true,
    totalRecords: cat.digestRecords.length,
    seedCount: DRLG_FROZEN_SEEDS.length,
    diffCount: 3,
    levelCount: 136,
    digestSha256: cat.digestSha256,
    frozenSeeds: Array.from(DRLG_FROZEN_SEEDS),
    townLevelIds: [...DRLG_TOWN_LEVEL_IDS],
    diffSensitiveLevels,
    actSummary: actCounts.map((lc, idx) => ({
      act: idx + 1,
      levelCount: lc,
      vectorCount: lc * DRLG_FROZEN_SEEDS.length * 3,
    })),
    levels,
  }
}

interface SingleLevelDrlgEnv {
  readonly basePages: Map<number, Uint8Array>
  readonly dt1Pages: Map<number, Uint8Array>
  readonly createMemory: () => SparseMemory113c & { syncDt1Pages: (pages: number[]) => void }
  readonly setCurrentMemory: (m: { syncDt1Pages?: (pages: number[]) => void } | null) => void
}

let singleDrlgEnv: SingleLevelDrlgEnv | null = null

function syncMpqSource(filePath: string): MpqSource {
  const fd = openSync(filePath, 'r')
  const size = fstatSync(fd).size
  return {
    size,
    label: filePath,
    read: async (offset, length) => {
      const buf = new Uint8Array(length)
      readSync(fd, buf, 0, length, offset)
      return buf
    },
    readSync: (offset, length) => {
      const buf = new Uint8Array(length)
      readSync(fd, buf, 0, length, offset)
      return buf
    },
  }
}

function getOrInitSingleLevelDrlgEnv(rootDir: string = DEFAULT_REPO_ROOT): SingleLevelDrlgEnv {
  if (singleDrlgEnv) return singleDrlgEnv
  const dataDir = resolveD2DataDir(rootDir)
  const mpqs = [
    MpqArchive.openSync(syncMpqSource(join(dataDir, 'Patch_D2.mpq'))),
    MpqArchive.openSync(syncMpqSource(join(dataDir, 'd2exp.mpq'))),
    MpqArchive.openSync(syncMpqSource(join(dataDir, 'd2data.mpq'))),
  ]

  function readMpqFileSync(name: string): Uint8Array | undefined {
    for (const ar of mpqs) {
      const f = ar.find(name)
      if (f !== undefined) {
        return ar.readSync(f)
      }
    }
    return undefined
  }

  const imgRaw = new Uint8Array(gunzipSync(readFileSync(DRLG_DATATBLS_IMG_PATH)))
  const { pages: basePages } = parseDrlgDataTablesImage(imgRaw)

  const iatPage = basePages.get(0x6fdd9000 >>> 12)
  if (iatPage) {
    const iatDv = new DataView(iatPage.buffer, iatPage.byteOffset, iatPage.byteLength)
    const bitMasksVa = iatDv.getUint32(0x0b0, true) >>> 0
    const invBitMasksVa = iatDv.getUint32(0x078, true) >>> 0
    const writeBaseByte = (addr: number, val: number): void => {
      const a = addr >>> 0
      const pg = a >>> 12
      let page = basePages.get(pg)
      if (!page) {
        page = new Uint8Array(4096)
        basePages.set(pg, page)
      }
      page[a & 0xfff] = val & 0xff
    }
    const writeBaseU32 = (addr: number, val: number): void => {
      const v = val >>> 0
      writeBaseByte(addr, v & 0xff)
      writeBaseByte(addr + 1, (v >>> 8) & 0xff)
      writeBaseByte(addr + 2, (v >>> 16) & 0xff)
      writeBaseByte(addr + 3, (v >>> 24) & 0xff)
    }
    if (bitMasksVa !== 0) {
      for (let i = 0; i < 32; i++) writeBaseU32((bitMasksVa + i * 4) >>> 0, (1 << i) >>> 0)
    }
    if (invBitMasksVa !== 0) {
      for (let i = 0; i < 32; i++) writeBaseU32((invBitMasksVa + i * 4) >>> 0, ~(1 << i) >>> 0)
    }
  }

  const dt1Pages = new Map<number, Uint8Array>()
  let dt1AllocTop = 0x30000000
  const dt1HashCache = new Map<string, number>()
  const ds1BytesCache = new Map<string, Uint8Array>()

  const dt1WriteByte = (addr: number, val: number): void => {
    const a = addr >>> 0
    const pg = a >>> 12
    let buf = dt1Pages.get(pg)
    if (!buf) {
      buf = new Uint8Array(4096)
      dt1Pages.set(pg, buf)
    }
    buf[a & 0xfff] = val & 0xff
  }
  const dt1ReadByte = (addr: number): number => {
    const a = addr >>> 0
    const buf = dt1Pages.get(a >>> 12)
    return buf ? buf[a & 0xfff]! : 0
  }
  const dt1U32 = (addr: number): number =>
    (dt1ReadByte(addr) |
      (dt1ReadByte(addr + 1) << 8) |
      (dt1ReadByte(addr + 2) << 16) |
      ((dt1ReadByte(addr + 3) << 24) >>> 0)) >>>
    0
  const dt1SetU32 = (addr: number, val: number): void => {
    const v = val >>> 0
    dt1WriteByte(addr, v & 0xff)
    dt1WriteByte(addr + 1, (v >>> 8) & 0xff)
    dt1WriteByte(addr + 2, (v >>> 16) & 0xff)
    dt1WriteByte(addr + 3, (v >>> 24) & 0xff)
  }
  const dt1Alloc = (size: number): number => {
    const p = ((dt1AllocTop + 3) & ~3) >>> 0
    for (let i = 0; i < size; i++) dt1WriteByte(p + i, 0)
    dt1AllocTop = (p + size) >>> 0
    return p
  }

  const getOrBuildDt1Hash = (rawPath: string): { pHash: number; newPages: number[] } => {
    if (!rawPath || rawPath === '0') return { pHash: 0, newPages: [] }
    const normPath = rawPath.replace(/\//g, '\\')
    const key = normPath.toLowerCase()
    const cached = dt1HashCache.get(key)
    if (cached !== undefined) return { pHash: cached, newPages: [] }

    const bytes = readMpqFileSync(normPath)
    if (!bytes || bytes.length < 0x114) {
      dt1HashCache.set(key, 0)
      return { pHash: 0, newPages: [] }
    }
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const nTiles = dv.getInt32(0x10c, true)
    const hdrOff = dv.getUint32(0x110, true)
    if (nTiles < 0 || hdrOff < 0x114 || hdrOff > bytes.length) {
      dt1HashCache.set(key, 0)
      return { pHash: 0, newPages: [] }
    }
    const hdrBytes = hdrOff + nTiles * 0x60
    const pLib = dt1Alloc(hdrBytes)
    const copyLen = Math.min(bytes.length, hdrBytes)
    for (let i = 0; i < copyLen; i++) dt1WriteByte(pLib + i, bytes[i]!)
    for (let i = 0; i < normPath.length && i < 259; i++) {
      dt1WriteByte(pLib + 0x08 + i, normPath.charCodeAt(i) & 0xff)
    }
    dt1WriteByte(pLib + 0x08 + Math.min(normPath.length, 259), 0)
    const pTilesBase = (pLib + hdrOff) >>> 0
    dt1SetU32(pLib + 0x110, pTilesBase)
    for (let i = 0; i < nTiles; i++) {
      dt1SetU32((pTilesBase + i * 0x60 + 0x58) >>> 0, (pLib + 0x08) >>> 0)
    }
    const pHash = dt1Alloc(0x200)
    for (let i = 0; i < nTiles; i++) {
      const pTile = (pTilesBase + i * 0x60) >>> 0
      const orient = dt1U32(pTile + 0x14) | 0
      const style = dt1U32(pTile + 0x18) | 0
      const seq = dt1U32(pTile + 0x1c) | 0
      const bucket = ((((seq & 0xff) << 1) - (orient & 0xff) + (style & 0xff)) & 0x7f) >>> 0
      const bucketAddr = (pHash + bucket * 4) >>> 0
      let pNode = dt1U32(bucketAddr)
      let foundNode = 0
      while (pNode !== 0) {
        if (
          (dt1U32(pNode) | 0) === style &&
          (dt1U32(pNode + 0x04) | 0) === seq &&
          (dt1U32(pNode + 0x08) | 0) === orient
        ) {
          foundNode = pNode
          break
        }
        pNode = dt1U32(pNode + 0x10)
      }
      if (foundNode === 0) {
        const pNewNode = dt1Alloc(0x14)
        dt1SetU32(pNewNode, style >>> 0)
        dt1SetU32(pNewNode + 0x04, seq >>> 0)
        dt1SetU32(pNewNode + 0x08, orient >>> 0)
        dt1SetU32(pNewNode + 0x10, dt1U32(bucketAddr))
        dt1SetU32(bucketAddr, pNewNode)
        const pBlock = dt1Alloc(0x08)
        dt1SetU32(pBlock, pTile)
        dt1SetU32(pBlock + 0x04, 0)
        dt1SetU32(pNewNode + 0x0c, pBlock)
      } else {
        let pCurBlock = dt1U32(foundNode + 0x0c)
        let dup = false
        while (pCurBlock !== 0) {
          if (dt1U32(pCurBlock) === pTile) {
            dup = true
            break
          }
          pCurBlock = dt1U32(pCurBlock + 0x04)
        }
        if (!dup) {
          const pBlock = dt1Alloc(0x08)
          dt1SetU32(pBlock, pTile)
          dt1SetU32(pBlock + 0x04, dt1U32(foundNode + 0x0c))
          dt1SetU32(foundNode + 0x0c, pBlock)
        }
      }
    }
    dt1HashCache.set(key, pHash)
    return { pHash, newPages: [...dt1Pages.keys()] }
  }

  let currentMemInstance: { syncDt1Pages?: (pages: number[]) => void } | null = null

  const gHooks = globalThis as unknown as {
    __d2LoadMpqDs1: (m: Memory113c, relPath: string) => Uint8Array | null
    __d2LoadMpqDt1Hash: (m: Memory113c, path: string) => number
  }
  gHooks.__d2LoadMpqDs1 = (_m: Memory113c, relPath: string) => {
    const norm = relPath.replace(/\//g, '\\').replace(/^\\+/, '')
    const fullPath = /^data\\global\\tiles\\/i.test(norm)
      ? norm
      : `DATA\\GLOBAL\\TILES\\${norm}`
    const key = fullPath.toLowerCase()
    let bytes = ds1BytesCache.get(key)
    if (!bytes) {
      bytes = readMpqFileSync(fullPath)
      if (!bytes) throw new Error(`Missing DS1 in MPQ: ${fullPath}`)
      ds1BytesCache.set(key, bytes)
    }
    return bytes
  }
  gHooks.__d2LoadMpqDt1Hash = (_m: Memory113c, rawPath: string) => {
    const { pHash, newPages } = getOrBuildDt1Hash(rawPath)
    if (newPages.length > 0 && currentMemInstance?.syncDt1Pages) {
      currentMemInstance.syncDt1Pages(newPages)
    }
    return pHash
  }

  const fullKnownPage = new Uint8Array(4096).fill(1)
  const createMemory = (): SparseMemory113c & { syncDt1Pages: (pages: number[]) => void } => {
    const m = new d2kern.SparseMemory113c() as SparseMemory113c & {
      syncDt1Pages: (pages: number[]) => void
    }
    const mPriv = m as unknown as {
      pages: Map<number, Uint8Array>
      known: Map<number, Uint8Array>
    }
    for (const [pg, data] of basePages) {
      const copy = new Uint8Array(4096)
      copy.set(data)
      mPriv.pages.set(pg, copy)
      mPriv.known.set(pg, fullKnownPage)
    }
    for (const [pg, data] of dt1Pages) {
      mPriv.pages.set(pg, data)
      mPriv.known.set(pg, fullKnownPage)
    }
    m.syncDt1Pages = (pages: number[]) => {
      for (const pg of pages) {
        const data = dt1Pages.get(pg)
        if (data) {
          mPriv.pages.set(pg, data)
          mPriv.known.set(pg, fullKnownPage)
        }
      }
    }
    return m
  }

  singleDrlgEnv = {
    basePages,
    dt1Pages,
    createMemory,
    setCurrentMemory: (m) => {
      currentMemInstance = m
    },
  }
  return singleDrlgEnv
}

export interface ShowcaseDrlgPresetPoint {
  readonly roomIdx: number
  readonly unitType: number
  readonly txtId: number
  readonly mode: number
  readonly subtileX: number
  readonly subtileY: number
}

export interface ShowcaseDrlgCollRoom {
  readonly roomIdx: number
  readonly subtileX: number
  readonly subtileY: number
  readonly subtileW: number
  readonly subtileH: number
  readonly mapBase64: string
}

export interface ShowcaseDrlgLevelRunResponse {
  readonly ok: true
  readonly seed: number
  readonly diff: number
  readonly levelId: number
  readonly act: number
  readonly nameEn: string
  readonly nameZh: string
  readonly drlgType: number
  readonly computeMs: number
  readonly header: DrlgLevelHeaderRecord
  readonly rooms: readonly DrlgRoomRecord[]
  readonly presets: readonly ShowcaseDrlgPresetPoint[]
  readonly collRooms: readonly ShowcaseDrlgCollRoom[]
  readonly totalSubtiles: number
  readonly parity: {
    readonly isFrozenSeed: boolean
    readonly computedLayoutHash: string
    readonly computedCollHash: string
    readonly oracleLayoutHash: string | null
    readonly oracleCollHash: string | null
    readonly layoutXor: string | null
    readonly collXor: string | null
    readonly roomsD2tvMatch: boolean | null
    readonly townCollD2tvMatch: boolean | null
    readonly exactMatch: boolean | null
  }
}

const drlgLevelRunCache = new Map<string, ShowcaseDrlgLevelRunResponse>()

function hex64(v: bigint): string {
  return `0x${(v & 0xffffffffffffffffn).toString(16).toUpperCase().padStart(16, '0')}`
}

export function runDrlgShowcaseLevel(
  params: { seed: number; diff: number; levelId: number },
  rootDir: string = DEFAULT_REPO_ROOT,
): ShowcaseDrlgLevelRunResponse {
  const seed = params.seed >>> 0
  const diff = Math.max(0, Math.min(2, params.diff | 0))
  const levelId = Math.max(1, Math.min(136, params.levelId | 0))
  const cacheKey = `${seed}:${diff}:${levelId}`
  const cached = drlgLevelRunCache.get(cacheKey)
  if (cached) return cached

  const t0 = performance.now()
  const cat = getOrLoadDrlgDigestCatalog(rootDir)
  const env = getOrInitSingleLevelDrlgEnv(rootDir)
  const m = env.createMemory()
  env.setCurrentMemory(m)

  const kActLo = [1, 40, 75, 103, 109] as const
  const kActHi = [39, 74, 102, 108, 136] as const
  const actIdx =
    levelId <= 39 ? 0 : levelId <= 74 ? 1 : levelId <= 102 ? 2 : levelId <= 108 ? 3 : 4
  const actLo = kActLo[actIdx]!
  const actHi = kActHi[actIdx]!

  let targetPLevel = 0
  let targetHeader: DrlgLevelHeaderRecord | null = null
  let targetRooms: DrlgRoomRecord[] = []
  const targetRoomPtrs: number[] = []
  const presets: ShowcaseDrlgPresetPoint[] = []
  const collRooms: ShowcaseDrlgCollRoom[] = []
  const liveTownColls: DrlgCollRecord[] = []
  let computedLayoutHash = 0n
  let computedCollHash = 0n
  let totalSubtiles = 0

  try {
    const pAct = d2kern.DUNGEON_AllocAct113c(
      m,
      actIdx,
      seed,
      0,
      0x7f000000,
      diff & 0xff,
      0,
      actLo,
      0,
      0,
    )
    const pDrlg = m.u32((pAct + 0x48) >>> 0)

    for (let L = actLo; L <= actHi; L++) {
      let pLevel = m.u32((pDrlg + 0x47c) >>> 0)
      while (pLevel !== 0 && (m.u32((pLevel + 0x1d0) >>> 0) | 0) !== L) {
        pLevel = m.u32((pLevel + 0x1ac) >>> 0)
      }
      const preAlloc = pLevel !== 0 ? 1 : 0
      if (pLevel === 0) {
        pLevel = d2kern.DRLG_AllocAndInitLevel113c(m, pDrlg, L)
      }
      const wasInit = m.u32((pLevel + 0x10) >>> 0) !== 0 ? 1 : 0
      if (!wasInit) {
        d2kern.DRLG_InitLevelRooms113c(m, pLevel)
      }
      if (L === levelId) {
        targetPLevel = pLevel
        const flags = preAlloc | (wasInit << 1)
        targetHeader = {
          marker: DRLG_LEVEL_HEADER_MARKER,
          levelId: L,
          act: actIdx,
          diff,
          flags,
          reserved: 0,
          drlgType: m.u32(pLevel),
          dwFlags: m.u32((pLevel + 0x04) >>> 0),
          nRooms: m.u32((pLevel + 0x08) >>> 0),
          posX: m.u32((pLevel + 0x1c) >>> 0) | 0,
          posY: m.u32((pLevel + 0x20) >>> 0) | 0,
          sizeX: m.u32((pLevel + 0x24) >>> 0) | 0,
          sizeY: m.u32((pLevel + 0x28) >>> 0) | 0,
          nLevelType: m.u32((pLevel + 0x1c0) >>> 0),
          seedLo: m.u32((pLevel + 0x1c4) >>> 0),
          seedHi: m.u32((pLevel + 0x1c8) >>> 0),
        }
        const rooms: DrlgRoomRecord[] = []
        let roomIdx = 0
        for (let r = m.u32((pLevel + 0x10) >>> 0); r !== 0; r = m.u32((r + 0x24) >>> 0)) {
          targetRoomPtrs.push(r)
          const nType = m.u32((r + 0x48) >>> 0)
          const pTypeData = m.u32((r + 0x20) >>> 0)
          let presetId = -1
          let presetSub = -1
          if (nType === 2 && pTypeData !== 0) {
            presetId = m.u32(pTypeData) | 0
            presetSub = m.u32((pTypeData + 0x04) >>> 0) | 0
          }
          const rx = m.u32((r + 0x34) >>> 0) | 0
          const ry = m.u32((r + 0x38) >>> 0) | 0
          rooms.push({
            levelId: L,
            idx: roomIdx,
            x: rx,
            y: ry,
            w: m.u32((r + 0x3c) >>> 0) | 0,
            h: m.u32((r + 0x40) >>> 0) | 0,
            nType,
            dwFlags: m.u32((r + 0x28) >>> 0),
            presetId,
            presetSub,
            dwInitSeed: m.u32((r + 0x04) >>> 0),
            seedLo: m.u32((r + 0x14) >>> 0),
            seedHi: m.u32((r + 0x18) >>> 0),
          })
          roomIdx++
        }
        targetRooms = rooms
        computedLayoutHash = computeDrlgLevelLayoutHash(targetHeader, targetRooms)
      }
    }

    if (targetPLevel === 0 || targetHeader === null) {
      throw new Error(`Failed to allocate DRLG level ${levelId}`)
    }

    const collChunks: Uint8Array[] = []
    for (let idx = 0; idx < targetRoomPtrs.length; idx++) {
      const r = targetRoomPtrs[idx]!
      const roomRec = targetRooms[idx]!
      const activeRoom = d2kern.DRLGROOM_EnsureRoomAndGetRoom1_113c(m, r)

      // Collect room preset units (warps, shrines, chests, superuniques) after room tile/preset init
      let pPreset = m.get(r, D2RoomExStrc.pPresetUnits)
      let pGuard = 0
      while (pPreset !== 0 && pGuard++ < 256) {
        const uType = m.get(pPreset, D2PresetUnitStrc.nUnitType)
        const txtId = m.get(pPreset, D2PresetUnitStrc.nIndex)
        const relX = m.get(pPreset, D2PresetUnitStrc.nXpos) | 0
        const relY = m.get(pPreset, D2PresetUnitStrc.nYpos) | 0
        const mode = m.get(pPreset, D2PresetUnitStrc.nMode)
        presets.push({
          roomIdx: idx,
          unitType: uType,
          txtId,
          mode,
          subtileX: roomRec.x * 5 + relX,
          subtileY: roomRec.y * 5 + relY,
        })
        pPreset = m.get(pPreset, D2PresetUnitStrc.pNext)
      }

      if (activeRoom === 0) continue
      const cg = m.u32((activeRoom + 0x20) >>> 0)
      if (cg === 0) continue
      const w = m.u32((cg + 0x08) >>> 0)
      const h = m.u32((cg + 0x0c) >>> 0)
      const cells = (w * h) >>> 0
      const mapPtr = m.u32((cg + 0x20) >>> 0)
      const hdrBytes = m.readBytes(cg, 32)
      collChunks.push(hdrBytes)
      let mapBytes: Uint8Array = new Uint8Array(0)
      if (mapPtr !== 0 && cells > 0) {
        mapBytes = m.readBytes(mapPtr, cells * 2)
        collChunks.push(mapBytes)
      }
      totalSubtiles += cells

      const hDv = new DataView(hdrBytes.buffer, hdrBytes.byteOffset, hdrBytes.byteLength)
      const nSubtileX = hDv.getInt32(0x00, true)
      const nSubtileY = hDv.getInt32(0x04, true)
      const nSubtileWidth = hDv.getInt32(0x08, true)
      const nSubtileHeight = hDv.getInt32(0x0c, true)

      collRooms.push({
        roomIdx: idx,
        subtileX: nSubtileX,
        subtileY: nSubtileY,
        subtileW: nSubtileWidth,
        subtileH: nSubtileHeight,
        mapBase64: Buffer.from(mapBytes).toString('base64'),
      })

      const mapWords = new Uint16Array(cells)
      if (mapBytes.byteLength >= cells * 2) {
        const mDv = new DataView(mapBytes.buffer, mapBytes.byteOffset, mapBytes.byteLength)
        for (let c = 0; c < cells; c++) mapWords[c] = mDv.getUint16(c * 2, true)
      }
      liveTownColls.push({
        nSubtileX,
        nSubtileY,
        nSubtileWidth,
        nSubtileHeight,
        nTileX: hDv.getInt32(0x10, true),
        nTileY: hDv.getInt32(0x14, true),
        nTileWidth: hDv.getInt32(0x18, true),
        nTileHeight: hDv.getInt32(0x1c, true),
        headerBytes: hdrBytes,
        mapWords,
        activeMapBytes: mapBytes,
      })
    }
    computedCollHash = sha256Low64LE(collChunks)
  } finally {
    env.setCurrentMemory(null)
  }

  const expDig = cat.digestByKey.get(`${seed}:${diff}:${levelId}`) ?? null
  const expRoomsGrp = seed === 12345 ? (cat.roomsS12345ByDiffLevel.get(`${diff}:${levelId}`) ?? null) : null
  const expTownColls =
    seed === 12345 && diff === 0 ? (cat.townCollS12345ByLevel.get(levelId) ?? null) : null

  const roomsD2tvMatch =
    expRoomsGrp !== null
      ? JSON.stringify(targetHeader) === JSON.stringify(expRoomsGrp.header) &&
        JSON.stringify(targetRooms) === JSON.stringify(expRoomsGrp.rooms)
      : null

  const townCollD2tvMatch =
    expTownColls !== null
      ? computeDrlgLevelCollHash(liveTownColls) === computeDrlgLevelCollHash(expTownColls)
      : null

  const layoutXor = expDig !== null ? hex64(computedLayoutHash ^ expDig.layoutHash) : null
  const collXor = expDig !== null ? hex64(computedCollHash ^ expDig.collHash) : null
  const exactMatch =
    expDig !== null
      ? computedLayoutHash === expDig.layoutHash && computedCollHash === expDig.collHash
      : null

  const meta = CANONICAL_LEVEL_LIGHTING[levelId]
  const computeMs = Math.round(performance.now() - t0)

  const response: ShowcaseDrlgLevelRunResponse = {
    ok: true,
    seed,
    diff,
    levelId,
    act: actIdx + 1,
    nameEn: meta?.levelName ?? `Level ${levelId}`,
    nameZh: LEVEL_NAMES_ZH[levelId] ?? meta?.levelName ?? `场景 ${levelId}`,
    drlgType: targetHeader.drlgType,
    computeMs,
    header: targetHeader,
    rooms: targetRooms,
    presets,
    collRooms,
    totalSubtiles,
    parity: {
      isFrozenSeed: expDig !== null,
      computedLayoutHash: hex64(computedLayoutHash),
      computedCollHash: hex64(computedCollHash),
      oracleLayoutHash: expDig !== null ? hex64(expDig.layoutHash) : null,
      oracleCollHash: expDig !== null ? hex64(expDig.collHash) : null,
      layoutXor,
      collXor,
      roomsD2tvMatch,
      townCollD2tvMatch,
      exactMatch,
    },
  }

  if (drlgLevelRunCache.size >= 32) {
    const oldest = drlgLevelRunCache.keys().next().value
    if (oldest !== undefined) drlgLevelRunCache.delete(oldest)
  }
  drlgLevelRunCache.set(cacheKey, response)
  return response
}

// ---------------------------------------------------------------------------
// Zone 3: [K1-6] #10342 PATHTYPE 0..17 Pathfinding Sandbox
// ---------------------------------------------------------------------------

export const PATHTYPE_METADATA: ReadonlyArray<{
  readonly pathType: number
  readonly name: string
  readonly handlerVa: string
  readonly description: string
}> = [
  { pathType: 0, name: 'IDASTAR', handlerVa: '0x6FDC0E40', description: 'Iterative-Deepening A* multi-corner player/NPC navigation' },
  { pathType: 1, name: 'ASTAR', handlerVa: '0x6FDCB630', description: 'Priority-queue A* pathfinder' },
  { pathType: 2, name: 'TOWARD', handlerVa: '0x6FDB78B0', description: 'Direct monster advance toward target (asserts on player unitType=0)' },
  { pathType: 3, name: 'WALL_FOLLOW', handlerVa: '0x6FDB7B70', description: 'Right/left-hand obstacle perimeter follower' },
  { pathType: 4, name: 'MON_CIRCLE', handlerVa: '0x6FD85780', description: 'Trigonometric orbital strafing around target (Fog sin/cos)' },
  { pathType: 5, name: 'TOWARD_FINISH', handlerVa: '0x6FDB78B0', description: 'Direct monster approach finishing segment' },
  { pathType: 6, name: 'STRAIGHT_6', handlerVa: '0x6FDB78B0', description: 'Bresenham straight-line step generator' },
  { pathType: 7, name: 'MISSILE', handlerVa: '0x6FDB7AD0', description: 'Linear projectile raycast trajectory' },
  { pathType: 8, name: 'KNOCKBACK_SERVER', handlerVa: '0x6FDB7390', description: 'Server knockback raycast stopping at first blocked subtile' },
  { pathType: 9, name: 'LEAP', handlerVa: '0x6FDB77F0', description: 'Barbarian Leap / Sand Leaper ballistic landing resolver' },
  { pathType: 10, name: 'FLEE', handlerVa: '0x6FD85780', description: 'Anti-target retreat vector using Fog trig rotation' },
  { pathType: 11, name: 'KNOCKBACK_CLIENT', handlerVa: '0x6FDB77C0', description: 'Client knockback displacement trajectory' },
  { pathType: 12, name: 'BACKUP', handlerVa: '0x6FDB7850', description: 'Short tactical step-back ray' },
  { pathType: 13, name: 'STRAIGHT', handlerVa: '0x6FDB78B0', description: 'Direct line-of-walk subtile stepper' },
  { pathType: 14, name: 'BLESSEDHAMMER', handlerVa: '0x6FD85780', description: '77-point expanding Archimedean spiral via Fog.#10028 sin/cos LUT' },
  { pathType: 15, name: 'MOTION', handlerVa: '0x6FD68C40', description: 'Velocity-driven continuous subtile motion integrator' },
  { pathType: 16, name: 'CHARGEDBOLT', handlerVa: '0x6FDC0E40', description: 'Stochastic jittered bolt / IDA* variant' },
  { pathType: 17, name: 'NULL_HANDLER_17', handlerVa: '0x6FD86230', description: 'NULL dispatch slot in 0x6FDDE360 -> triggers Fog.#10024 assert line 894' },
]

export interface ShowcasePathWorldResponse {
  readonly ok: true
  readonly worldSha256: string
  readonly meta: PathWorldMetaHeader
  readonly fogSinTableU32: readonly number[]
  readonly pages: ReadonlyArray<{ readonly va: number; readonly dataBase64: string }>
  readonly rooms: ReadonlyArray<{
    readonly idx: number
    readonly roomVa: number
    readonly pMapVa: number
    readonly subtileX: number
    readonly subtileY: number
    readonly subtileW: number
    readonly subtileH: number
    readonly touchedInImg: boolean
    readonly mapBase64: string
  }>
}

interface PathFixturesCache {
  readonly worldResponse: ShowcasePathWorldResponse
  readonly vectorsRaw: Uint8Array
  readonly vectorsSha256: string
  readonly parsedVectors: readonly PathVectorRecord[]
  readonly byPathTypeSummary: ReadonlyArray<{
    readonly pathType: number
    readonly name: string
    readonly handlerVa: string
    readonly description: string
    readonly total: number
    readonly nonFault: number
    readonly posRet: number
    readonly fogAssert: number
    readonly maxPoints: number
  }>
}

let pathFixturesCache: PathFixturesCache | null = null

function getOrLoadPathFixtures(rootDir: string = DEFAULT_REPO_ROOT): PathFixturesCache {
  if (pathFixturesCache) return pathFixturesCache
  const fixturesDir = resolve(rootDir, 'tests/fixtures/oracle/vectors')
  const imgRaw = new Uint8Array(gunzipSync(readFileSync(join(fixturesDir, 'path-world-town-s12345.img.gz'))))
  const vecRaw = new Uint8Array(gunzipSync(readFileSync(join(fixturesDir, 'path-vectors-113c.d2tv.gz'))))
  const collRaw = new Uint8Array(gunzipSync(readFileSync(join(fixturesDir, 'drlg-coll-towns-s12345-d0.d2tv.gz'))))

  const worldSha256 = createHash('sha256').update(imgRaw).digest('hex')
  const vectorsSha256 = createHash('sha256').update(vecRaw).digest('hex')

  const parsedImg = parsePathWorldImage(imgRaw)
  const parsedVec = parsePathVectors(vecRaw)
  const parsedColl = parseDrlgCollFile(collRaw)

  const dataDir = resolveD2DataDir(rootDir)
  const fogDllPath = join(dataDir, 'Fog.dll')
  const fogSinTableU32: number[] = new Array<number>(512)
  if (existsSync(fogDllPath)) {
    const fogDll = readFileSync(fogDllPath)
    for (let i = 0; i < 512; i++) {
      fogSinTableU32[i] = fogDll.readUInt32LE(0x2f470 + i * 4) >>> 0
    }
  } else {
    const dv = new DataView(new ArrayBuffer(4))
    for (let i = 0; i < 512; i++) {
      dv.setFloat32(0, FOG_SIN_TABLE[i]!, true)
      fogSinTableU32[i] = dv.getUint32(0, true) >>> 0
    }
  }

  // Inspect active room pointers in SparseMemory113c to pair each roomVa with its full L1 DRLGCOLL map
  const probeMem = new d2kern.SparseMemory113c()
  for (const p of parsedImg.pages) probeMem.loadBlock(p.va, p.data)
  const loadedPageSet = new Set<number>(parsedImg.pages.map((p: PageImageRecord) => p.va >>> 12))
  const l1Colls = parsedColl.records.slice(0, 35)

  const rooms = parsedImg.meta.activeRoomVas.map((roomVa, idx) => {
    const pColl = probeMem.u32(roomVa + 0x20)
    const pMapVa = probeMem.u32(pColl + 0x20)
    const coll = l1Colls[idx]!
    const touchedInImg =
      loadedPageSet.has(pMapVa >>> 12) &&
      loadedPageSet.has((pMapVa + (coll.mapWords.length - 1) * 2) >>> 12)
    return {
      idx,
      roomVa: roomVa >>> 0,
      pMapVa: pMapVa >>> 0,
      subtileX: coll.nSubtileX,
      subtileY: coll.nSubtileY,
      subtileW: coll.nSubtileWidth,
      subtileH: coll.nSubtileHeight,
      touchedInImg,
      mapBase64: Buffer.from(coll.activeMapBytes).toString('base64'),
    }
  })

  const pages = parsedImg.pages.map((p) => ({
    va: p.va >>> 0,
    dataBase64: Buffer.from(p.data).toString('base64'),
  }))

  const totals = new Array<number>(18).fill(0)
  const nonFault = new Array<number>(18).fill(0)
  const posRet = new Array<number>(18).fill(0)
  const fogAssert = new Array<number>(18).fill(0)
  const maxPoints = new Array<number>(18).fill(0)

  for (const r of parsedVec.records) {
    const t = r.pathType
    if (t < 0 || t >= 18) continue
    totals[t]!++
    if (r.faultKind === 0) {
      nonFault[t]!++
      if (r.ret > 0 && r.dwPathPoints > 0) {
        posRet[t]!++
        if (r.dwPathPoints > maxPoints[t]!) maxPoints[t] = r.dwPathPoints
      }
    } else if (r.faultKind === 2) {
      fogAssert[t]!++
    }
  }

  const byPathTypeSummary = PATHTYPE_METADATA.map((m) => ({
    pathType: m.pathType,
    name: m.name,
    handlerVa: m.handlerVa,
    description: m.description,
    total: totals[m.pathType]!,
    nonFault: nonFault[m.pathType]!,
    posRet: posRet[m.pathType]!,
    fogAssert: fogAssert[m.pathType]!,
    maxPoints: maxPoints[m.pathType]!,
  }))

  pathFixturesCache = {
    worldResponse: {
      ok: true,
      worldSha256,
      meta: parsedImg.meta,
      fogSinTableU32,
      pages,
      rooms,
    },
    vectorsRaw: vecRaw,
    vectorsSha256,
    parsedVectors: parsedVec.records,
    byPathTypeSummary,
  }
  return pathFixturesCache
}

export function getPathWorldShowcaseData(rootDir: string = DEFAULT_REPO_ROOT): ShowcasePathWorldResponse {
  return getOrLoadPathFixtures(rootDir).worldResponse
}

export function getPathVectorsRawBinary(rootDir: string = DEFAULT_REPO_ROOT): Uint8Array {
  return getOrLoadPathFixtures(rootDir).vectorsRaw
}

export interface ShowcasePathVectorSummaryItem {
  readonly idx: number
  readonly pathType: number
  readonly unitType: number
  readonly classId: number
  readonly a2: number
  readonly bAllocFlag: number
  readonly nDistMax: number
  readonly nStepNum: number
  readonly preFlags: number
  readonly startX: number
  readonly startY: number
  readonly targetX: number
  readonly targetY: number
  readonly velOverride: number
  readonly prevPathType: number
  readonly targetDx: number
  readonly targetDy: number
  readonly unitSeedLo: number
  readonly ret: number
  readonly faultKind: number
  readonly faultStage: number
  readonly faultLine: number
  readonly dwPathPoints: number
  readonly dwFlags: number
  readonly dwPathType: number
  readonly dwPrevPathType: number
  readonly outTargetX: number
  readonly outTargetY: number
  readonly dwCurrentPointIdx: number
  readonly nDirection: number
  readonly nNewDirection: number
  readonly dwUnitSize: number
  readonly pathPoints: ReadonlyArray<{ readonly x: number; readonly y: number }>
}

export interface ShowcasePathVectorsJsonResponse {
  readonly ok: true
  readonly totalCount: number
  readonly vectorsSha256: string
  readonly filteredCount: number
  readonly offset: number
  readonly limit: number
  readonly byPathType: PathFixturesCache['byPathTypeSummary']
  readonly records: readonly ShowcasePathVectorSummaryItem[]
}

export function getPathVectorsShowcaseData(
  params: {
    pathType?: number | null
    onlyPositive?: boolean
    offset?: number
    limit?: number
  } = {},
  rootDir: string = DEFAULT_REPO_ROOT,
): ShowcasePathVectorsJsonResponse {
  const fix = getOrLoadPathFixtures(rootDir)
  const ptFilter =
    typeof params.pathType === 'number' && params.pathType >= 0 && params.pathType <= 17
      ? params.pathType
      : null
  const onlyPositive = Boolean(params.onlyPositive)
  const offset = Math.max(0, params.offset ?? 0)
  const limit = Math.max(1, Math.min(500, params.limit ?? 100))

  const matchedIndices: number[] = []
  for (let i = 0; i < fix.parsedVectors.length; i++) {
    const r = fix.parsedVectors[i]!
    if (ptFilter !== null && r.pathType !== ptFilter) continue
    if (onlyPositive && !(r.faultKind === 0 && r.ret > 0 && r.dwPathPoints > 0)) continue
    matchedIndices.push(i)
  }

  const slice = matchedIndices.slice(offset, offset + limit)
  const records: ShowcasePathVectorSummaryItem[] = slice.map((idx) => {
    const r = fix.parsedVectors[idx]!
    return {
      idx,
      pathType: r.pathType,
      unitType: r.unitType,
      classId: r.classId,
      a2: r.a2,
      bAllocFlag: r.bAllocFlag,
      nDistMax: r.nDistMax,
      nStepNum: r.nStepNum,
      preFlags: r.preFlags,
      startX: r.startX,
      startY: r.startY,
      targetX: r.targetX,
      targetY: r.targetY,
      velOverride: r.velOverride,
      prevPathType: r.prevPathType,
      targetDx: r.targetDx,
      targetDy: r.targetDy,
      unitSeedLo: r.unitSeedLo >>> 0,
      ret: r.ret,
      faultKind: r.faultKind,
      faultStage: r.faultStage,
      faultLine: r.faultLine,
      dwPathPoints: r.dwPathPoints,
      dwFlags: r.dwFlags >>> 0,
      dwPathType: r.dwPathType,
      dwPrevPathType: r.dwPrevPathType,
      outTargetX: r.outTargetX,
      outTargetY: r.outTargetY,
      dwCurrentPointIdx: r.dwCurrentPointIdx,
      nDirection: r.nDirection,
      nNewDirection: r.nNewDirection,
      dwUnitSize: r.dwUnitSize,
      pathPoints: r.pathPoints.slice(0, Math.min(78, r.dwPathPoints)),
    }
  })

  return {
    ok: true,
    totalCount: fix.parsedVectors.length,
    vectorsSha256: fix.vectorsSha256,
    filteredCount: matchedIndices.length,
    offset,
    limit,
    byPathType: fix.byPathTypeSummary,
    records,
  }
}

// ---------------------------------------------------------------------------
// Zone 4: D2Common.dll 1,479 / 1,479 (100%) Binary-Isomorphism Callgraph Explorer
// ---------------------------------------------------------------------------

export type CallgraphSubsystem =
  | 'drlg'
  | 'path'
  | 'collision'
  | 'statlist'
  | 'unit'
  | 'items'
  | 'missile'
  | 'datatbls'
  | 'skills'
  | 'monsters'
  | 'inventory'
  | 'prng'
  | 'combat'
  | 'ai'
  | 'quest'
  | 'other'

interface RawManifestFunction {
  readonly module: 'D2Common' | 'D2Game'
  readonly va: string
  readonly name: string
  readonly size: number
  readonly sccId: number
  readonly topoLevel: number
  readonly status: 'diff-verified' | 'ported' | 'unported'
  readonly callees: readonly string[]
  readonly callers: readonly string[]
  readonly externalDeps: readonly string[]
  readonly kernFile?: string | null
  readonly tsSymbol?: string | null
  readonly tsReference?: string | null
  readonly diffEvidence?: string | null
}

export interface ShowcaseCallgraphNode {
  readonly key: string
  readonly module: 'D2Common' | 'D2Game'
  readonly va: string
  readonly vaNum: number
  readonly name: string
  readonly size: number
  readonly sccId: number
  readonly topoLevel: number
  readonly status: 'diff-verified' | 'ported' | 'unported'
  readonly subsystem: CallgraphSubsystem
  readonly kernFile: string | null
  readonly tsSymbol: string | null
  readonly callerCount: number
  readonly calleeCount: number
  readonly hasEvidence: boolean
}

export interface ShowcaseModuleStats {
  readonly total: number
  readonly diffVerified: number
  readonly ported: number
  readonly unported: number
  readonly totalBytes: number
  readonly portedBytes: number
  readonly minVa: string
  readonly maxVa: string
  readonly completionPct: number
}

export interface ShowcaseCallgraphResponse {
  readonly ok: true
  readonly summary: {
    readonly totalReachable: number
    readonly d2Common: ShowcaseModuleStats
    readonly d2Game: ShowcaseModuleStats
  }
  readonly subsystems: ReadonlyArray<{
    readonly subsystem: CallgraphSubsystem
    readonly d2CommonCount: number
    readonly d2GameCount: number
    readonly diffVerifiedCount: number
    readonly portedCount: number
    readonly unportedCount: number
  }>
  readonly functions: readonly ShowcaseCallgraphNode[]
}

interface CallgraphRichEntry {
  readonly node: ShowcaseCallgraphNode
  readonly raw: RawManifestFunction
  readonly callerKeys: readonly string[]
  readonly calleeKeys: readonly string[]
}

interface CallgraphCache {
  readonly response: ShowcaseCallgraphResponse
  readonly byKey: ReadonlyMap<string, CallgraphRichEntry>
}

let callgraphCache: CallgraphCache | null = null

export function normalizeFnKey(defaultModule: 'D2Common' | 'D2Game', rawSpec: string): string {
  const trimmed = rawSpec.trim()
  let mod: 'D2Common' | 'D2Game' = defaultModule
  let hexPart = trimmed
  if (trimmed.includes(':')) {
    const [mPart, vPart] = trimmed.split(':', 2)
    if (mPart === 'D2Game' || mPart?.toLowerCase() === 'd2game') mod = 'D2Game'
    else if (mPart === 'D2Common' || mPart?.toLowerCase() === 'd2common') mod = 'D2Common'
    hexPart = vPart ?? ''
  }
  const cleanHex = hexPart.toLowerCase().startsWith('0x') ? hexPart.slice(2) : hexPart
  const vaNum = Number.parseInt(cleanHex, 16)
  if (!Number.isFinite(vaNum)) {
    throw new Error(`Invalid VA specifier: '${rawSpec}'`)
  }
  if (!trimmed.includes(':')) {
    if (vaNum >= 0x6fc20000 && vaNum < 0x6fd50000) mod = 'D2Game'
    else if (vaNum >= 0x6fd50000 && vaNum < 0x6fe00000) mod = 'D2Common'
  }
  return `${mod}:0x${(vaNum >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

function classifySubsystem(fn: RawManifestFunction): CallgraphSubsystem {
  const kf = (fn.kernFile ?? '').toLowerCase()
  const nm = fn.name.toUpperCase()

  if (kf.includes('/drlg/') || kf.endsWith('/dungeon.ts') || /^(?:DRLG|DUNGEON|ROOM)_/.test(nm)) return 'drlg'
  if (kf.endsWith('/path.ts') || /^PATH_/.test(nm)) return 'path'
  if (kf.endsWith('/collision.ts') || /^COLLISION_/.test(nm)) return 'collision'
  if (kf.endsWith('/statlist.ts') || /^STATLIST_/.test(nm)) return 'statlist'
  if (kf.includes('/unit') || /^UNITS?_/.test(nm) || /^SUNIT_/.test(nm)) return 'unit'
  if (kf.includes('item') || /^ITEMS?_/.test(nm)) return 'items'
  if (kf.includes('missile') || /^MISSILE_/.test(nm)) return 'missile'
  if (kf.includes('/tables/') || kf.includes('datatbls') || /^DATATBLS_/.test(nm)) return 'datatbls'
  if (kf.includes('skill') || /^SKILLS?_/.test(nm)) return 'skills'
  if (kf.includes('monster') || /^MONSTERS?_/.test(nm)) return 'monsters'
  if (kf.includes('inventory') || /^INVENTORY_/.test(nm)) return 'inventory'
  if (kf.endsWith('prng.ts') || /^SEED_/.test(nm)) return 'prng'
  if (kf.includes('combat') || /^SUNITDMG_/.test(nm)) return 'combat'
  if (kf.includes('-ai') || /^(?:AI|AIGENERAL)_/.test(nm)) return 'ai'
  if (kf.includes('quest') || /^QUEST/.test(nm)) return 'quest'
  return 'other'
}

function getOrLoadCallgraph(rootDir: string = DEFAULT_REPO_ROOT): CallgraphCache {
  if (callgraphCache) return callgraphCache
  const cgDir = resolve(rootDir, 'tools/oracle/callgraph')
  const rawManifest = JSON.parse(readFileSync(join(cgDir, 'manifest-113c.json'), 'utf8')) as {
    functions: RawManifestFunction[]
  }

  const mergedMap = new Map<string, RawManifestFunction>()
  for (const fn of rawManifest.functions) {
    const key = normalizeFnKey(fn.module, fn.va)
    mergedMap.set(key, fn)
  }

  const bindingsDir = join(cgDir, 'bindings')
  if (existsSync(bindingsDir)) {
    for (const file of readdirSync(bindingsDir).sort()) {
      if (!file.endsWith('.json')) continue
      const entries = JSON.parse(readFileSync(join(bindingsDir, file), 'utf8')) as Array<{
        module: 'D2Common' | 'D2Game'
        va: string
        name: string
        kernFile: string
        tsSymbol: string
        status: 'diff-verified' | 'ported' | 'unported'
        diffEvidence?: string
      }>
      for (const b of entries) {
        const key = normalizeFnKey(b.module, b.va)
        const prev = mergedMap.get(key)
        if (prev) {
          mergedMap.set(key, {
            ...prev,
            name: b.name || prev.name,
            status: b.status,
            kernFile: b.kernFile,
            tsSymbol: b.tsSymbol,
            diffEvidence: b.diffEvidence ?? prev.diffEvidence ?? null,
          })
        }
      }
    }
  }

  const byKey = new Map<string, CallgraphRichEntry>()
  const nodes: ShowcaseCallgraphNode[] = []

  const subsystemOrder: readonly CallgraphSubsystem[] = [
    'drlg',
    'path',
    'collision',
    'statlist',
    'unit',
    'items',
    'missile',
    'datatbls',
    'skills',
    'monsters',
    'inventory',
    'prng',
    'combat',
    'ai',
    'quest',
    'other',
  ]
  const subStats = new Map<
    CallgraphSubsystem,
    { d2c: number; d2g: number; dv: number; p: number; u: number }
  >()
  for (const s of subsystemOrder) subStats.set(s, { d2c: 0, d2g: 0, dv: 0, p: 0, u: 0 })

  for (const [key, fn] of mergedMap.entries()) {
    const [, vaHex] = key.split(':', 2)
    const vaNum = Number.parseInt(vaHex!.slice(2), 16) >>> 0
    const subsystem = classifySubsystem(fn)
    const callerKeys = (fn.callers ?? []).map((c) => normalizeFnKey(fn.module, c))
    const calleeKeys = (fn.callees ?? []).map((c) => normalizeFnKey(fn.module, c))

    const node: ShowcaseCallgraphNode = {
      key,
      module: fn.module,
      va: vaHex!,
      vaNum,
      name: fn.name,
      size: fn.size,
      sccId: fn.sccId,
      topoLevel: fn.topoLevel,
      status: fn.status,
      subsystem,
      kernFile: fn.kernFile ?? null,
      tsSymbol: fn.tsSymbol ?? null,
      callerCount: callerKeys.length,
      calleeCount: calleeKeys.length,
      hasEvidence: Boolean(fn.diffEvidence && fn.diffEvidence.trim().length > 0),
    }
    nodes.push(node)
    byKey.set(key, { node, raw: fn, callerKeys, calleeKeys })

    const st = subStats.get(subsystem)!
    if (fn.module === 'D2Common') st.d2c++
    else st.d2g++
    if (fn.status === 'diff-verified') st.dv++
    else if (fn.status === 'ported') st.p++
    else st.u++
  }

  nodes.sort((a, b) => {
    if (a.module !== b.module) return a.module === 'D2Common' ? -1 : 1
    return a.vaNum - b.vaNum
  })

  const buildModStats = (mod: 'D2Common' | 'D2Game'): ShowcaseModuleStats => {
    const list = nodes.filter((n) => n.module === mod)
    let dv = 0
    let p = 0
    let u = 0
    let totalBytes = 0
    let portedBytes = 0
    for (const n of list) {
      totalBytes += n.size
      if (n.status === 'diff-verified') {
        dv++
        portedBytes += n.size
      } else if (n.status === 'ported') {
        p++
        portedBytes += n.size
      } else {
        u++
      }
    }
    const total = list.length
    const minVa = list[0]?.va ?? '0x00000000'
    const maxVa = list[list.length - 1]?.va ?? '0x00000000'
    const completionPct = total > 0 ? Number((((dv + p) / total) * 100).toFixed(2)) : 0
    return {
      total,
      diffVerified: dv,
      ported: p,
      unported: u,
      totalBytes,
      portedBytes,
      minVa,
      maxVa,
      completionPct,
    }
  }

  const response: ShowcaseCallgraphResponse = {
    ok: true,
    summary: {
      totalReachable: nodes.length,
      d2Common: buildModStats('D2Common'),
      d2Game: buildModStats('D2Game'),
    },
    subsystems: subsystemOrder.map((s) => {
      const st = subStats.get(s)!
      return {
        subsystem: s,
        d2CommonCount: st.d2c,
        d2GameCount: st.d2g,
        diffVerifiedCount: st.dv,
        portedCount: st.p,
        unportedCount: st.u,
      }
    }),
    functions: nodes,
  }

  callgraphCache = { response, byKey }
  return callgraphCache
}

export function getCallgraphShowcaseData(
  rootDir: string = DEFAULT_REPO_ROOT,
): ShowcaseCallgraphResponse {
  return getOrLoadCallgraph(rootDir).response
}

export interface ShowcaseFunctionDetailResponse {
  readonly ok: true
  readonly fn: ShowcaseCallgraphNode
  readonly diffEvidence: string | null
  readonly tsReference: string | null
  readonly externalDeps: readonly string[]
  readonly disassembly: {
    readonly binaryName: string
    readonly startVa: string
    readonly stopVa: string
    readonly instructionCount: number
    readonly text: string
  }
  readonly tsSource: {
    readonly kernFile: string | null
    readonly tsSymbol: string | null
    readonly startLine: number | null
    readonly endLine: number | null
    readonly code: string | null
  }
  readonly callers: readonly ShowcaseCallgraphNode[]
  readonly callees: readonly ShowcaseCallgraphNode[]
}

const tsAstFileCache = new Map<string, { text: string; sf: ts.SourceFile }>()

function extractTsSymbolSource(
  rootDir: string,
  kernFile: string | null,
  tsSymbol: string | null,
): ShowcaseFunctionDetailResponse['tsSource'] {
  if (!kernFile || !tsSymbol) {
    return { kernFile, tsSymbol, startLine: null, endLine: null, code: null }
  }
  const absPath = resolve(rootDir, kernFile)
  if (!existsSync(absPath)) {
    return { kernFile, tsSymbol, startLine: null, endLine: null, code: null }
  }
  let parsed = tsAstFileCache.get(absPath)
  if (!parsed) {
    const text = readFileSync(absPath, 'utf8')
    const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true)
    parsed = { text, sf }
    tsAstFileCache.set(absPath, parsed)
  }
  const { text, sf } = parsed

  let matchedNode: ts.Node | null = null
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === tsSymbol) {
      matchedNode = stmt
      break
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === tsSymbol) {
          matchedNode = stmt
          break
        }
      }
      if (matchedNode) break
    }
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) {
        if (el.name.text === tsSymbol) {
          // If re-exported from another file, follow moduleSpecifier if relative
          if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
            const targetName = el.propertyName?.text ?? el.name.text
            const subRel = resolve(absPath, '..', stmt.moduleSpecifier.text)
            const relFromRoot = subRel.startsWith(rootDir) ? subRel.slice(rootDir.length).replace(/^\/+/, '') : null
            if (relFromRoot) {
              return extractTsSymbolSource(rootDir, relFromRoot, targetName)
            }
          }
          matchedNode = stmt
          break
        }
      }
      if (matchedNode) break
    }
  }

  if (!matchedNode) {
    return { kernFile, tsSymbol, startLine: null, endLine: null, code: null }
  }

  // Include leading JSDoc comment if immediately preceding the declaration
  const fullStart = matchedNode.getFullStart()
  const codeStart = matchedNode.getStart(sf)
  const leadingComments = ts.getLeadingCommentRanges(text, fullStart)
  let sliceStart = codeStart
  if (leadingComments && leadingComments.length > 0) {
    const lastComment = leadingComments[leadingComments.length - 1]!
    const between = text.slice(lastComment.end, codeStart)
    if (!between.includes('\n\n')) {
      sliceStart = lastComment.pos
    }
  }
  const sliceEnd = matchedNode.getEnd()
  const startLine = sf.getLineAndCharacterOfPosition(sliceStart).line + 1
  const endLine = sf.getLineAndCharacterOfPosition(sliceEnd).line + 1
  const code = text.slice(sliceStart, sliceEnd).trim()

  return { kernFile, tsSymbol, startLine, endLine, code }
}

function disassembleDllFunction(
  rootDir: string,
  module: 'D2Common' | 'D2Game',
  vaNum: number,
  size: number,
): ShowcaseFunctionDetailResponse['disassembly'] {
  const binaryName = module === 'D2Game' ? 'D2Game.dll' : 'D2Common.dll'
  const dllPath = join(resolveD2DataDir(rootDir), binaryName)
  const span = Math.max(1, Math.min(0x8000, size > 0 ? size : 64))
  const startVa = `0x${(vaNum >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
  const stopVa = `0x${((vaNum + span) >>> 0).toString(16).toUpperCase().padStart(8, '0')}`

  if (!existsSync(dllPath)) {
    return {
      binaryName,
      startVa,
      stopVa,
      instructionCount: 0,
      text: `; ${binaryName} not found in configured D2_DATA_DIR`,
    }
  }

  const rawOut = execFileSync(
    'objdump',
    [
      '-d',
      '-M',
      'intel',
      `--start-address=${startVa.toLowerCase()}`,
      `--stop-address=${stopVa.toLowerCase()}`,
      dllPath,
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  )

  // Sanitize header so zero host filesystem paths ever appear in output
  const lines: string[] = []
  let instructionCount = 0
  for (const rawLine of rawOut.split(/\r?\n/)) {
    if (!rawLine.trim()) continue
    if (rawLine.includes('file format')) {
      lines.push(`; ${binaryName} (PE32 i386) [${startVa} .. ${stopVa}, ${span} bytes]`)
      continue
    }
    if (rawLine.startsWith('Disassembly of section')) continue
    if (/^[0-9a-fA-F]{8}\s+<[^>]+>:$/.test(rawLine.trim())) continue
    if (/^\s*[0-9a-fA-F]{8}:\s+/.test(rawLine)) {
      instructionCount++
      lines.push(rawLine.replace(/^\s+/, ''))
    }
  }

  return {
    binaryName,
    startVa,
    stopVa,
    instructionCount,
    text: lines.join('\n'),
  }
}

export function getFunctionDetailShowcaseData(
  params: { module?: string; va: string },
  rootDir: string = DEFAULT_REPO_ROOT,
): ShowcaseFunctionDetailResponse {
  const cg = getOrLoadCallgraph(rootDir)
  const defaultMod: 'D2Common' | 'D2Game' = params.module === 'D2Game' ? 'D2Game' : 'D2Common'
  const key = normalizeFnKey(defaultMod, params.va)
  const entry = cg.byKey.get(key)
  if (!entry) {
    throw new Error(`Function '${key}' not found in manifest-113c.json`)
  }

  const disassembly = disassembleDllFunction(
    rootDir,
    entry.node.module,
    entry.node.vaNum,
    entry.node.size,
  )
  const tsSource = extractTsSymbolSource(rootDir, entry.node.kernFile, entry.node.tsSymbol)
  const callers = entry.callerKeys
    .map((k) => cg.byKey.get(k)?.node)
    .filter((n): n is ShowcaseCallgraphNode => n !== undefined)
  const callees = entry.calleeKeys
    .map((k) => cg.byKey.get(k)?.node)
    .filter((n): n is ShowcaseCallgraphNode => n !== undefined)

  return {
    ok: true,
    fn: entry.node,
    diffEvidence: entry.raw.diffEvidence ?? null,
    tsReference: entry.raw.tsReference ?? null,
    externalDeps: entry.raw.externalDeps ?? [],
    disassembly,
    tsSource,
    callers,
    callees,
  }
}

// ---------------------------------------------------------------------------
// Overview & HTTP Middleware
// ---------------------------------------------------------------------------

export interface ShowcaseOverviewResponse {
  readonly ok: true
  readonly d2Common: ShowcaseModuleStats
  readonly d2Game: ShowcaseModuleStats
  readonly drlg: {
    readonly totalVectors: number
    readonly seedCount: number
    readonly diffCount: number
    readonly levelCount: number
    readonly digestSha256: string
  }
  readonly path: {
    readonly totalVectors: number
    readonly pathTypeCount: number
    readonly activeRooms: number
    readonly vectorsSha256: string
    readonly worldSha256: string
  }
  readonly replays: ReadonlyArray<{
    readonly scenario: ReplayScenarioId
    readonly bootFrame: number
    readonly frames: number
  }>
}

export function getShowcaseOverview(rootDir: string = DEFAULT_REPO_ROOT): ShowcaseOverviewResponse {
  const cg = getOrLoadCallgraph(rootDir).response
  const drlg = getDrlgCatalogData(rootDir)
  const pathFix = getOrLoadPathFixtures(rootDir)

  return {
    ok: true,
    d2Common: cg.summary.d2Common,
    d2Game: cg.summary.d2Game,
    drlg: {
      totalVectors: drlg.totalRecords,
      seedCount: drlg.seedCount,
      diffCount: drlg.diffCount,
      levelCount: drlg.levelCount,
      digestSha256: drlg.digestSha256,
    },
    path: {
      totalVectors: pathFix.parsedVectors.length,
      pathTypeCount: 18,
      activeRooms: pathFix.worldResponse.rooms.length,
      vectorsSha256: pathFix.vectorsSha256,
      worldSha256: pathFix.worldResponse.worldSha256,
    },
    replays: [
      { scenario: 'a1-town-walk', bootFrame: 2, frames: 750 },
      { scenario: 'a1c-bloodmoor-fallen', bootFrame: 2, frames: 2000 },
    ],
  }
}

export interface K1ShowcaseMiddlewareOptions {
  readonly rootDir?: string | undefined
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(`${JSON.stringify(body)}\n`)
}

function parseUint32Param(raw: string | null, fallback: number): number {
  if (!raw || raw.trim().length === 0) return fallback >>> 0
  const trimmed = raw.trim()
  const n = trimmed.toLowerCase().startsWith('0x')
    ? Number.parseInt(trimmed.slice(2), 16)
    : Number.parseInt(trimmed, 10)
  return Number.isFinite(n) ? n >>> 0 : fallback >>> 0
}

export function createK1ShowcaseHttpMiddleware(options?: K1ShowcaseMiddlewareOptions) {
  const rootDir = options?.rootDir ?? DEFAULT_REPO_ROOT

  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (!req.url) {
      next()
      return
    }
    const qIdx = req.url.indexOf('?')
    const rawPath = qIdx >= 0 ? req.url.slice(0, qIdx) : req.url
    const queryStr = qIdx >= 0 ? req.url.slice(qIdx + 1) : ''
    const normPath = rawPath.startsWith('/diablo2/') ? rawPath.slice('/diablo2'.length) : rawPath

    if (!normPath.startsWith('/api/k1-showcase/')) {
      next()
      return
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'Method Not Allowed' })
      return
    }

    const params = new URLSearchParams(queryStr)
    const subRoute = normPath.slice('/api/k1-showcase/'.length)

    try {
      if (subRoute === 'overview') {
        sendJson(res, 200, getShowcaseOverview(rootDir))
        return
      }

      if (subRoute === 'replay') {
        const scenario = params.get('scenario')?.trim() || 'a1c-bloodmoor-fallen'
        sendJson(res, 200, getReplayShowcaseData(scenario))
        return
      }

      if (subRoute === 'drlg') {
        const levelParam = params.get('levelId')
        if (!levelParam) {
          sendJson(res, 200, getDrlgCatalogData(rootDir))
          return
        }
        const levelId = Number.parseInt(levelParam, 10)
        const diff = Number.parseInt(params.get('diff') ?? '0', 10)
        const seed = parseUint32Param(params.get('seed'), 12345)
        if (!Number.isFinite(levelId) || levelId < 1 || levelId > 136) {
          sendJson(res, 400, { ok: false, error: 'levelId must be in 1..136' })
          return
        }
        sendJson(res, 200, runDrlgShowcaseLevel({ seed, diff, levelId }, rootDir))
        return
      }

      if (subRoute === 'path-world') {
        sendJson(res, 200, getPathWorldShowcaseData(rootDir))
        return
      }

      if (subRoute === 'path-vectors') {
        if (params.get('format') === 'bin') {
          const bin = getPathVectorsRawBinary(rootDir)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/octet-stream')
          res.setHeader('Content-Length', String(bin.byteLength))
          res.setHeader('Cache-Control', 'no-store')
          res.end(Buffer.from(bin.buffer, bin.byteOffset, bin.byteLength))
          return
        }
        const ptRaw = params.get('pathType')
        const pathType =
          ptRaw !== null && ptRaw.trim() !== '' && ptRaw !== 'all'
            ? Number.parseInt(ptRaw, 10)
            : null
        const onlyPositive = params.get('onlyPositive') === '1' || params.get('onlyPositive') === 'true'
        const offset = Number.parseInt(params.get('offset') ?? '0', 10)
        const limit = Number.parseInt(params.get('limit') ?? '100', 10)
        sendJson(
          res,
          200,
          getPathVectorsShowcaseData(
            {
              pathType: pathType !== null && Number.isFinite(pathType) ? pathType : null,
              onlyPositive,
              offset: Number.isFinite(offset) ? offset : 0,
              limit: Number.isFinite(limit) ? limit : 100,
            },
            rootDir,
          ),
        )
        return
      }

      if (subRoute === 'callgraph') {
        sendJson(res, 200, getCallgraphShowcaseData(rootDir))
        return
      }

      if (subRoute === 'fn-detail') {
        const va = params.get('va')?.trim()
        if (!va) {
          sendJson(res, 400, { ok: false, error: 'Missing required query parameter: va' })
          return
        }
        const mod = params.get('module')?.trim()
        sendJson(
          res,
          200,
          getFunctionDetailShowcaseData(
            mod ? { module: mod, va } : { va },
            rootDir,
          ),
        )
        return
      }

      sendJson(res, 404, { ok: false, error: `Unknown K1 showcase route: ${normPath}` })
    } catch (err: unknown) {
      sendJson(res, 400, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
