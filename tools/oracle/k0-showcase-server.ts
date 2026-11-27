/**
 * [K0] Phase 0 Foundation & Go/No-Go Interactive Visual Showcase Backend
 * (`tools/oracle/k0-showcase-server.ts`).
 *
 * Serves authentic Phase 0 deliverables under `/api/k0-showcase/*`:
 *   - `/api/k0-showcase/overview` — Callgraph manifest stats (`4,810` fns, SCCs, layers),
 *     `dispatch-tables-113c.json`, `route2-layout.json` (18 structs), `tests/fixtures/oracle/route2/`
 *     & `vectors/` real record counts & SHA-256 digests.
 *   - `/api/k0-showcase/layouts`  — All 18 frozen 1.13c structs from `docs/oracle/route2-layout.json`.
 *   - `/api/k0-showcase/vectors`  — Live decoded `prng-10k.d2tv` records + `eventwheel-113c.d2tv`
 *     header/summary + 11-slot `D2Game.dll -> D2Net.dll` IAT contract table.
 *   - `/api/k0-showcase/replay`   — Live `src/d2kern-113c` replay of `a1c-bloodmoor-fallen` focused
 *     on the K0 vertical slice `F786..F825` (with `F790`, `F801`, `F821` milestones).
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { D2GAME_D2NET_IAT_113C } from '../../src/d2kern-113c/net/packet-sink.ts'
import {
  DEFAULT_REPO_ROOT,
  canonVa,
  loadManifestCached,
  parseShowcaseRequest,
  runLockstepReplayPayload,
  sendJson,
  sha256Buffer,
  tallyManifestModules,
  type ManifestModuleTotals,
  type SharedReplayPayload,
} from './showcase-common.ts'
import { decodePrngRecord, PRNG_RECORD_SIZE, type PrngRecord } from './vectors/prng-vector.ts'
import { parseVectorHeader } from './vectors/vector-format.ts'

export interface K0FixtureArtifact {
  readonly id: string
  readonly label: string
  readonly relPath: string
  readonly bytes: number
  readonly recordCount: number
  readonly sha256: string
}

export interface K0OverviewResponse {
  readonly ok: true
  readonly manifest: {
    readonly total: number
    readonly sccCount: number
    readonly topoLayers: number
    readonly totals: readonly ManifestModuleTotals[]
  }
  readonly dispatchTables: {
    readonly totalTables: number
    readonly rootEntryPoints: number
    readonly d2GameTables: number
    readonly d2CommonTables: number
  }
  readonly frozenStructsCount: number
  readonly totalStructFields: number
  readonly fixtures: readonly K0FixtureArtifact[]
  readonly totalDiffRecords: number
  readonly iatSlotCount: number
}

export interface K0LayoutField {
  readonly name: string
  readonly off: number
  readonly type: string
  readonly count: number
  readonly byteSize: number
  readonly comment: string | null
}

export interface K0LayoutStruct {
  readonly name: string
  readonly size: number
  readonly allocEvidence: string
  readonly fields: readonly K0LayoutField[]
  readonly coveredBytes: number
  readonly coveragePct: number
}

export interface K0LayoutsResponse {
  readonly ok: true
  readonly sourcePath: string
  readonly structCount: number
  readonly totalFields: number
  readonly structs: readonly K0LayoutStruct[]
}

export interface K0D2NetIatSlot {
  readonly slotIndex: number
  readonly iatVa: string
  readonly d2gameThunkVa: string
  readonly ordinal: number
  readonly d2netVa: string
  readonly argCount: number
  readonly stackBytes: number
  readonly name: string
}

export interface K0VectorsResponse {
  readonly ok: true
  readonly prng: {
    readonly relPath: string
    readonly sha256: string
    readonly recordCount: number
    readonly recordSize: number
    readonly offset: number
    readonly limit: number
    readonly records: readonly (PrngRecord & { readonly index: number })[]
  }
  readonly eventWheel: {
    readonly relPath: string
    readonly sha256: string
    readonly recordCount: number
    readonly recordSize: number
    readonly magic: string
    readonly kind: string
  }
  readonly d2NetIat: readonly K0D2NetIatSlot[]
}

const D2NET_IAT_SLOTS: readonly K0D2NetIatSlot[] = D2GAME_D2NET_IAT_113C.map((s) => ({
  slotIndex: s.slotIndex,
  iatVa: canonVa(s.iatVa),
  d2gameThunkVa: canonVa(s.d2gameThunkVa),
  ordinal: s.ordinal,
  d2netVa: canonVa(s.d2netVa),
  argCount: s.argCount,
  stackBytes: s.stackBytes,
  name: s.name,
}))

function fieldByteWidth(type: string, count: number): number {
  const t = type.toLowerCase()
  const base =
    t === 'u8' || t === 'i8' || t === 'bool' || t === 'char'
      ? 1
      : t === 'u16' || t === 'i16'
        ? 2
        : t === 'u64' || t === 'i64'
          ? 8
          : 4
  return base * Math.max(1, count)
}

function countGzLines(absPath: string): number {
  const txt = gunzipSync(readFileSync(absPath)).toString('utf8')
  let count = 0
  for (const line of txt.split('\n')) {
    if (line.trim().length > 0) count++
  }
  return count
}

const layoutsCache = new Map<string, K0LayoutsResponse>()
const overviewCache = new Map<string, K0OverviewResponse>()
const k0ReplayCache = new Map<string, SharedReplayPayload>()

export function getK0LayoutsData(rootDir: string = DEFAULT_REPO_ROOT): K0LayoutsResponse {
  const hit = layoutsCache.get(rootDir)
  if (hit) return hit
  const relPath = 'docs/oracle/route2-layout.json'
  const raw = JSON.parse(readFileSync(resolve(rootDir, relPath), 'utf8')) as {
    structs: Record<
      string,
      {
        size: number
        allocEvidence?: string
        fields: { name: string; off: number; type: string; count?: number; $comment?: string }[]
      }
    >
  }
  const structs: K0LayoutStruct[] = []
  let totalFields = 0
  for (const [name, def] of Object.entries(raw.structs)) {
    const fields: K0LayoutField[] = def.fields
      .map((f) => {
        const count = f.count ?? 1
        return {
          name: f.name,
          off: f.off,
          type: f.type,
          count,
          byteSize: fieldByteWidth(f.type, count),
          comment: f.$comment ?? null,
        }
      })
      .sort((a, b) => a.off - b.off || a.name.localeCompare(b.name))
    totalFields += fields.length
    const covered = new Uint8Array(Math.max(1, def.size))
    for (const f of fields) {
      for (let i = 0; i < f.byteSize; i++) {
        const pos = f.off + i
        if (pos >= 0 && pos < covered.length) covered[pos] = 1
      }
    }
    let coveredBytes = 0
    for (let i = 0; i < covered.length; i++) if (covered[i] === 1) coveredBytes++
    structs.push({
      name,
      size: def.size,
      allocEvidence: def.allocEvidence ?? '',
      fields,
      coveredBytes,
      coveragePct: def.size > 0 ? Number(((coveredBytes / def.size) * 100).toFixed(1)) : 0,
    })
  }
  const res: K0LayoutsResponse = {
    ok: true,
    sourcePath: relPath,
    structCount: structs.length,
    totalFields,
    structs,
  }
  layoutsCache.set(rootDir, res)
  return res
}

export function getK0OverviewData(rootDir: string = DEFAULT_REPO_ROOT): K0OverviewResponse {
  const hit = overviewCache.get(rootDir)
  if (hit) return hit
  const manifest = loadManifestCached(rootDir)
  const layouts = getK0LayoutsData(rootDir)

  const dtRaw = JSON.parse(
    readFileSync(resolve(rootDir, 'tools/oracle/callgraph/dispatch-tables-113c.json'), 'utf8'),
  ) as {
    rootEntryPoints?: unknown[]
    dispatchTables?: { module?: string }[]
    tables?: { module?: string }[]
  }
  const tablesList = dtRaw.dispatchTables ?? dtRaw.tables ?? []
  const d2GameTables = tablesList.filter((t) => t.module === 'D2Game').length
  const d2CommonTables = tablesList.filter((t) => t.module === 'D2Common').length

  const fixtureSpecs: readonly { id: string; label: string; relPath: string; kind: 'gz-ndjson' | 'd2tv' }[] = [
    { id: 'kern-10k-diff', label: 'FnOracleDaemon 13,100 差分记录', relPath: 'tests/fixtures/oracle/route2/kern-10k-diff.ndjson.gz', kind: 'gz-ndjson' },
    { id: 'a1c-fnrec-k0', label: 'Live Game fnrec 状态/事件快照', relPath: 'tests/fixtures/oracle/route2/a1c-fnrec-k0.ndjson.gz', kind: 'gz-ndjson' },
    { id: 'a1c-fnrec-setevent', label: 'Live EVENT_SetEvent fnrec 快照', relPath: 'tests/fixtures/oracle/route2/a1c-fnrec-setevent-f700.ndjson.gz', kind: 'gz-ndjson' },
    { id: 'prng-10k', label: 'PRNG 10,000 D2TV 实机向量', relPath: 'tests/fixtures/oracle/vectors/prng-10k.d2tv', kind: 'd2tv' },
    { id: 'eventwheel-113c', label: 'EventWheel 256 场景 D2TV 向量', relPath: 'tests/fixtures/oracle/vectors/eventwheel-113c.d2tv', kind: 'd2tv' },
  ]

  const fixtures: K0FixtureArtifact[] = []
  let totalDiffRecords = 0
  for (const spec of fixtureSpecs) {
    const abs = resolve(rootDir, spec.relPath)
    if (!existsSync(abs)) continue
    const rawBuf = readFileSync(abs)
    const bytes = statSync(abs).size
    const sha = sha256Buffer(rawBuf)
    let recordCount = 0
    if (spec.kind === 'd2tv') {
      recordCount = parseVectorHeader(rawBuf).recordCount
    } else {
      recordCount = countGzLines(abs)
    }
    if (spec.id !== 'prng-10k') totalDiffRecords += recordCount
    fixtures.push({
      id: spec.id,
      label: spec.label,
      relPath: spec.relPath,
      bytes,
      recordCount,
      sha256: sha,
    })
  }

  const res: K0OverviewResponse = {
    ok: true,
    manifest: {
      total: manifest.list.length,
      sccCount: manifest.sccCount,
      topoLayers: manifest.maxTopoLevel + 1,
      totals: tallyManifestModules(manifest.list),
    },
    dispatchTables: {
      totalTables: tablesList.length,
      rootEntryPoints: dtRaw.rootEntryPoints?.length ?? 0,
      d2GameTables,
      d2CommonTables,
    },
    frozenStructsCount: layouts.structCount,
    totalStructFields: layouts.totalFields,
    fixtures,
    totalDiffRecords,
    iatSlotCount: D2NET_IAT_SLOTS.length,
  }
  overviewCache.set(rootDir, res)
  return res
}

export function getK0VectorsData(
  rootDir: string = DEFAULT_REPO_ROOT,
  offset = 0,
  limit = 160,
): K0VectorsResponse {
  const prngRel = 'tests/fixtures/oracle/vectors/prng-10k.d2tv'
  const prngBuf = readFileSync(resolve(rootDir, prngRel))
  const prngHdr = parseVectorHeader(prngBuf)
  const clampedOff = Math.max(0, Math.min(prngHdr.recordCount, Math.trunc(offset)))
  const clampedLim = Math.max(1, Math.min(500, Math.trunc(limit)))
  const end = Math.min(prngHdr.recordCount, clampedOff + clampedLim)
  const records: (PrngRecord & { readonly index: number })[] = []
  for (let i = clampedOff; i < end; i++) {
    records.push({
      index: i,
      ...decodePrngRecord(prngBuf, 32 + i * PRNG_RECORD_SIZE),
    })
  }

  const ewRel = 'tests/fixtures/oracle/vectors/eventwheel-113c.d2tv'
  const ewBuf = readFileSync(resolve(rootDir, ewRel))
  const ewHdr = parseVectorHeader(ewBuf)

  return {
    ok: true,
    prng: {
      relPath: prngRel,
      sha256: sha256Buffer(prngBuf),
      recordCount: prngHdr.recordCount,
      recordSize: prngHdr.recordSize,
      offset: clampedOff,
      limit: clampedLim,
      records,
    },
    eventWheel: {
      relPath: ewRel,
      sha256: sha256Buffer(ewBuf),
      recordCount: ewHdr.recordCount,
      recordSize: ewHdr.recordSize,
      magic: `0x${ewHdr.magic.toString(16).toUpperCase()}`,
      kind: ewHdr.kind,
    },
    d2NetIat: D2NET_IAT_SLOTS,
  }
}

export function getK0VerticalSliceReplay(rootDir: string = DEFAULT_REPO_ROOT): SharedReplayPayload {
  const hit = k0ReplayCache.get(rootDir)
  if (hit) return hit
  const scenario = 'a1c-bloodmoor-fallen'
  const { payload } = runLockstepReplayPayload({
    scenarioName: scenario,
    goldenPath: resolve(rootDir, 'tests/fixtures/oracle/golden', `${scenario}.oracle.ndjson.gz`),
    snapshotPath: resolve(rootDir, 'tests/fixtures/oracle/k1/replay', `${scenario}.snap-f002.ndjson.gz`),
    scenarioPath: resolve(rootDir, 'tests/fixtures/oracle/scenarios', `${scenario}.json`),
    coveragePath: resolve(rootDir, 'tests/fixtures/oracle/k1/replay', `${scenario}.coverage.ndjson.gz`),
    rootDir,
    bootFrame: 2,
    frameWindow: [786, 825],
  })
  k0ReplayCache.set(rootDir, payload)
  return payload
}

export interface K0ShowcaseMiddlewareOptions {
  readonly rootDir?: string
}

export function createK0ShowcaseHttpMiddleware(options?: K0ShowcaseMiddlewareOptions) {
  const rootDir = options?.rootDir ?? DEFAULT_REPO_ROOT
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const parsed = parseShowcaseRequest(req, '/api/k0-showcase/')
    if (!parsed) {
      next()
      return
    }
    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'Method Not Allowed' })
      return
    }
    try {
      if (parsed.subRoute === 'overview') {
        sendJson(res, 200, getK0OverviewData(rootDir))
        return
      }
      if (parsed.subRoute === 'layouts') {
        sendJson(res, 200, getK0LayoutsData(rootDir))
        return
      }
      if (parsed.subRoute === 'vectors') {
        const off = Number(parsed.params.get('offset') ?? '0')
        const lim = Number(parsed.params.get('limit') ?? '160')
        sendJson(res, 200, getK0VectorsData(rootDir, Number.isFinite(off) ? off : 0, Number.isFinite(lim) ? lim : 160))
        return
      }
      if (parsed.subRoute === 'replay') {
        sendJson(res, 200, getK0VerticalSliceReplay(rootDir))
        return
      }
      sendJson(res, 404, { ok: false, error: `Unknown K0 showcase route: ${parsed.normPath}` })
    } catch (err: unknown) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
}
