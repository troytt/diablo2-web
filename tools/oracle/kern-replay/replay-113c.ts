/**
 * K1 exit gate: kernel-driven longitudinal replay of the recorded oracle goldens
 * (docs/oracle/k1-replay/README.md, tests/oracle/k1/replay-*.test.ts).
 *
 * 1. Boot: hydrate a raw-memory snapshot recorded by the oracle hook (`snapshot FRAME`,
 *    tools/oracle/hook/d2oracle.c) into `SparseMemory113c` at the original addresses, so intrusive
 *    pointers stay valid. Nothing is synthesised: a read of an address that was not recorded throws.
 * 2. Step: every frame first delivers the scenario's C2S packets for that frame through the D2Game
 *    C2S dispatcher (`0x6FCEC550`) and then runs `GAME_UpdateGameFrame` (`0x6FC4E050`), both resolved
 *    through `KERNEL_REGISTRY_113C`. A VA without a pure kernel port throws `UnportedFunction113c`;
 *    there is no fallback to the legacy `src/common` / `src/server` code (purity guard:
 *    tests/oracle/k1/replay-purity.test.ts).
 * 3. Sample: walk the `pGame` unit hash lists exactly like the hook's `dump_units` and compare every
 *    golden field (strict: all unit fields incl. seeds and level, all stats, `gs`; pos: id/class/mode/x/y).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { D2DynamicPathStrc, D2GameStrc, D2StaticPathStrc, D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { STATLIST_GetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import { UNITS_GetRoom113c } from '../../../src/d2kern-113c/common/unit.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from '../../../src/d2kern-113c/common/dungeon.ts'
import {
  C2S_DispatchFromMem113c,
  configureReplayHydrationAssets113c,
  GAME_UpdateGameFrame113c,
  hydrateSnapshotKernelTables113c,
  type ReplayHydrationAssets113c,
} from '../../../src/d2kern-113c/game/replay-kernel-113c.ts'
import { parseTrace, type Trace, type TraceFrame, type TraceHeader, type UnitRow } from '../lib/trace-diff.ts'
import { collectImportGraph, legacyReachable } from './import-graph.ts'

export const REPO_ROOT_113C = fileURLToPath(new URL('../../../', import.meta.url))

// ---------------------------------------------------------------- snapshot

export interface SnapshotBlock113c {
  readonly n: string
  readonly a: number
  readonly h: string | null
}

export interface SnapshotRecord113c {
  readonly k: 'game' | 'unit' | 'act' | 'room' | 'gamestate' | 'drlg'
  readonly type?: number
  readonly id?: number
  readonly list?: number
  readonly bucket?: number
  readonly act?: number
  readonly blocks: readonly SnapshotBlock113c[]
}

export interface Snapshot113c {
  readonly frame: number
  readonly game: number
  readonly d2game: number
  readonly d2common: number
  readonly records: readonly SnapshotRecord113c[]
}

export function parseSnapshot113c(text: string): Snapshot113c {
  type Hdr = { frame: number; game: number; d2game: number; d2common: number }
  let hdr: Hdr | null = null
  const records: SnapshotRecord113c[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.length === 0) continue
    const obj = JSON.parse(line) as { k: string } & Record<string, unknown>
    if (obj.k === 'hdr') hdr = obj as unknown as Hdr
    else if (
      obj.k === 'game' ||
      obj.k === 'unit' ||
      obj.k === 'act' ||
      obj.k === 'room' ||
      obj.k === 'gamestate' ||
      obj.k === 'drlg'
    )
      records.push(obj as unknown as SnapshotRecord113c)
    else throw new Error(`snapshot: unknown record kind '${obj.k}'`)
  }
  const h = hdr as Hdr | null
  if (h === null) throw new Error('snapshot: missing hdr record')
  return { frame: h.frame, game: h.game, d2game: h.d2game, d2common: h.d2common, records }
}

export function loadSnapshotFile113c(path: string): Snapshot113c {
  return parseSnapshot113c(gunzipSync(readFileSync(path)).toString('utf8'))
}

// ------------------------------------------------------------------- world

export interface KernWorld113c {
  readonly m: SparseMemory113c
  readonly pGame: number
  readonly bootFrame: number
}

let loadedReplayHydrationAssets113c: ReplayHydrationAssets113c | null = null

function ensureReplayHydrationAssetsLoaded113c(): void {
  if (loadedReplayHydrationAssets113c !== null) return
  const drlgDataTblsImg = new Uint8Array(
    gunzipSync(readFileSync(join(REPO_ROOT_113C, 'tests/fixtures/oracle/vectors/drlg-datatbls-113c.img.gz'))),
  )
  const d2gameDataTblsImg = new Uint8Array(
    gunzipSync(readFileSync(join(REPO_ROOT_113C, 'tests/fixtures/oracle/k1/d2game-datatbls-113c.img.gz'))),
  )
  const animDataBytes = new Uint8Array(
    gunzipSync(readFileSync(join(REPO_ROOT_113C, 'tests/fixtures/oracle/k1/animdata-113c.bin.gz'))),
  )
  const raw = JSON.parse(
    gunzipSync(readFileSync(join(REPO_ROOT_113C, 'tests/fixtures/oracle/k1/drlg-act1-ds1-dt1-113c.json.gz'))).toString('utf8'),
  ) as { ds1: Record<string, string>; dt1: Record<string, string> }
  const ds1 = new Map<string, Uint8Array>()
  const dt1 = new Map<string, Uint8Array>()
  for (const [k, b64] of Object.entries(raw.ds1)) {
    ds1.set(k.replace(/\//g, '\\').toLowerCase(), new Uint8Array(Buffer.from(b64, 'base64')))
  }
  for (const [k, b64] of Object.entries(raw.dt1)) {
    dt1.set(k.replace(/\//g, '\\').toLowerCase(), new Uint8Array(Buffer.from(b64, 'base64')))
  }
  loadedReplayHydrationAssets113c = {
    drlgDataTblsImg,
    d2gameDataTblsImg,
    animDataBytes,
    act1Ds1Dt1: { ds1, dt1 },
  }
  configureReplayHydrationAssets113c(loadedReplayHydrationAssets113c)
}

/** Hydrates every recorded block at its original address. Unreadable blocks (`h: null`) stay absent. */
export function bootFromSnapshot113c(snap: Snapshot113c): KernWorld113c {
  ensureReplayHydrationAssetsLoaded113c()
  const m = new SparseMemory113c()
  let loaded = 0
  for (const rec of snap.records) {
    for (const b of rec.blocks) {
      if (b.h === null) continue
      m.loadBlock(b.a >>> 0, Uint8Array.from(Buffer.from(b.h, 'hex')))
      loaded++
    }
  }
  if (loaded === 0) throw new Error('snapshot has no readable blocks')
  const pGame = snap.game >>> 0
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  if (frame !== snap.frame) {
    throw new Error(`snapshot pGame->dwGameFrame ${frame} != recorded frame ${snap.frame}`)
  }
  hydrateSnapshotKernelTables113c(m, pGame, snap.d2game >>> 0)
  return { m, pGame, bootFrame: frame }
}

// ---------------------------------------------------------------- registry

/** A kernel port callable from the replay loop; `args` follow the original call's argument order. */
export type KernelEntry113c = (world: KernWorld113c, args: readonly number[]) => number

interface ManifestFn {
  readonly module: string
  readonly va: string
  readonly name: string
  readonly status: string
  readonly size: number
  readonly kernFile?: string | null
  readonly tsSymbol?: string | null
}

let manifestCache: Map<string, ManifestFn> | null = null

export function manifestKey113c(module: string, va: number): string {
  return `${module}:0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

export function loadManifest113c(): Map<string, ManifestFn> {
  if (manifestCache !== null) return manifestCache
  const raw = JSON.parse(
    readFileSync(join(REPO_ROOT_113C, 'tools/oracle/callgraph/manifest-113c.json'), 'utf8'),
  ) as { functions: ManifestFn[] }
  const map = new Map<string, ManifestFn>()
  for (const f of raw.functions) map.set(manifestKey113c(f.module, parseInt(f.va, 16)), f)
  const bDir = join(REPO_ROOT_113C, 'tools/oracle/callgraph/bindings')
  for (const fn of readdirSync(bDir)) {
    if (!fn.endsWith('.json')) continue
    const entries = JSON.parse(readFileSync(join(bDir, fn), 'utf8')) as Array<{
      module: string
      va: string
      name: string
      kernFile: string
      tsSymbol: string
      status: string
    }>
    for (const e of entries) {
      const k = manifestKey113c(e.module, parseInt(e.va, 16))
      const prev = map.get(k)
      map.set(k, {
        module: e.module,
        va: e.va,
        name: e.name,
        status: e.status,
        size: prev !== undefined ? prev.size : 0,
        kernFile: e.kernFile,
        tsSymbol: e.tsSymbol,
      })
    }
  }
  manifestCache = map
  return map
}

/**
 * Pure kernel ports wired into the replay loop, keyed `Module:0xVA`. An entry may only be added when
 * its manifest status is `ported`/`diff-verified` and its module's import graph never reaches
 * `src/common` or `src/server` (both enforced by tests/oracle/k1/replay-purity.test.ts).
 *
 * Empty today: the frame root `GAME_UpdateGameFrame` (`0x6FC4E050`) is only implemented by the K0
 * Fallen slice driver (`stepFallenSliceFrame113c`), whose module imports the legacy `src/common`
 * path/monstats/treasure code, and the C2S dispatcher `0x6FCEC550` is unported.
 */
export const KERNEL_REGISTRY_113C: ReadonlyMap<string, KernelEntry113c> = new Map<string, KernelEntry113c>([
  ['D2Game:0x6FC4E050', (world, args) => GAME_UpdateGameFrame113c(world.m, args[0]!)],
  ['D2Game:0x6FCEC550', (world, args) => C2S_DispatchFromMem113c(world.m, args[0]!, args[1]!, args[2]!)],
])

export class UnportedFunction113c extends Error {
  constructor(
    readonly module: string,
    readonly va: number,
    readonly status: string,
    readonly reason: string,
  ) {
    super(`unported ${manifestKey113c(module, va)} (${status}): ${reason}`)
    this.name = 'UnportedFunction113c'
  }
}

/** Why a manifest function cannot be called from the pure replay path (diagnostics only). */
function unavailableReason(f: ManifestFn | undefined): { status: string; reason: string } {
  if (f === undefined) return { status: 'not-in-manifest', reason: 'VA is not a reachable manifest function' }
  if (f.status !== 'ported' && f.status !== 'diff-verified') {
    return { status: f.status, reason: `${f.name} has no kernel port` }
  }
  if (typeof f.kernFile !== 'string') {
    return { status: f.status, reason: `${f.name} has no kernFile in the manifest` }
  }
  const legacy = legacyReachable(collectImportGraph(REPO_ROOT_113C, [f.kernFile]), [f.kernFile])
  if (legacy.length > 0) {
    return {
      status: f.status,
      reason: `${f.name} is implemented by ${String(f.tsSymbol)} in ${f.kernFile}, which reaches legacy code (${legacy[0]})`,
    }
  }
  return { status: f.status, reason: `${f.name} (${String(f.tsSymbol)}) is pure but not wired into KERNEL_REGISTRY_113C` }
}

export function callKernel113c(world: KernWorld113c, module: string, va: number, args: readonly number[]): number {
  const key = manifestKey113c(module, va)
  const entry = KERNEL_REGISTRY_113C.get(key)
  if (entry === undefined) {
    const { status, reason } = unavailableReason(loadManifest113c().get(key))
    throw new UnportedFunction113c(module, va, status, reason)
  }
  return entry(world, args)
}

/** `D2Game 0x6FCEC550`: C2S packet dispatcher (ebx = packet, esi = player; stack pGame, nSize). */
export const D2GAME_C2S_DISPATCH_VA_113C = 0x6fcec550
/** `D2Game 0x6FC4E050`: `GAME_UpdateGameFrame` (eax = pGame). */
export const D2GAME_UPDATE_GAME_FRAME_VA_113C = 0x6fc4e050

/** Scratch area for staging C2S packet bytes (outside every recorded heap range). */
const PACKET_STAGING_BASE_113C = 0x7f000000

/**
 * Advances the world by one server frame: packets for frame `dwGameFrame + 1` are delivered first
 * (oracle `on_pre_frame` contract), then `GAME_UpdateGameFrame` runs.
 */
export function stepFrame113c(world: KernWorld113c, packets: readonly Uint8Array[]): void {
  for (const pkt of packets) {
    world.m.loadBlock(PACKET_STAGING_BASE_113C, pkt)
    callKernel113c(world, 'D2Game', D2GAME_C2S_DISPATCH_VA_113C, [world.pGame, PACKET_STAGING_BASE_113C, pkt.length])
  }
  callKernel113c(world, 'D2Game', D2GAME_UPDATE_GAME_FRAME_VA_113C, [world.pGame])
}

// ------------------------------------------------------------------ sample

/**
 * `type`: current hook - `tN` lists units with `dwUnitType == N` over all 5 hash lists (header has
 * the `level` column). `list`: goldens recorded before commit eb4aa6a2 - `tN` lists every unit of
 * hash list N (list 3 holds the items), identified by the missing `level` column.
 */
export type SampleMode113c = 'type' | 'list'

export function sampleMode113c(header: TraceHeader): SampleMode113c {
  return header.unitFields.includes('level') ? 'type' : 'list'
}

const SAMPLED_KEYS_113C = [0, 1, 3] as const

function unitXY(m: SparseMemory113c, pUnit: number): [number, number] {
  const t = m.get(pUnit, D2UnitStrc.dwUnitType)
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return [0, 0]
  if (t === 2 || t === 4 || t === 5) return [m.get(pPath, D2StaticPathStrc.nPosX), m.get(pPath, D2StaticPathStrc.nPosY)]
  return [m.get(pPath, D2DynamicPathStrc.wPosX), m.get(pPath, D2DynamicPathStrc.wPosY)]
}

function unitRow(world: KernWorld113c, header: TraceHeader, pUnit: number, key: number): UnitRow {
  const { m } = world
  const t = m.get(pUnit, D2UnitStrc.dwUnitType)
  const [x, y] = unitXY(m, pUnit)
  const row: number[] = []
  for (const field of header.unitFields) {
    switch (field) {
      case 'id': row.push(m.get(pUnit, D2UnitStrc.dwUnitId)); break
      case 'class': row.push(m.get(pUnit, D2UnitStrc.dwClassId)); break
      case 'mode': row.push(m.get(pUnit, D2UnitStrc.dwAnimMode)); break
      case 'x': row.push(x); break
      case 'y': row.push(y); break
      case 'seedLo': row.push(m.get(pUnit, D2UnitStrc.seedLo)); break
      case 'seedHi': row.push(m.get(pUnit, D2UnitStrc.seedHi)); break
      case 'level': {
        // Hook: types other than missiles/items -> DUNGEON_GetLevelIdFromRoom(UNITS_GetRoom(u)), else -1.
        let lvl = -1
        if (t !== 3 && t !== 4) {
          const pRoom = UNITS_GetRoom113c(m, pUnit)
          if (pRoom !== 0) lvl = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
        }
        row.push(lvl)
        break
      }
      default:
        throw new Error(`sampleFrame: unsupported unit field '${field}'`)
    }
  }
  if (key === 0 || key === 1) {
    for (const stat of header.statIds) row.push(STATLIST_GetUnitStat113c(m, pUnit, stat, 0))
  }
  return row
}

/** Samples the world the way the hook samples the original game after `GAME_UpdateGameFrame`. */
export function sampleFrame113c(world: KernWorld113c, header: TraceHeader): TraceFrame {
  const { m, pGame } = world
  const mode = sampleMode113c(header)
  const out: TraceFrame = { frame: m.get(pGame, D2GameStrc.dwGameFrame) >>> 0 }
  for (const key of SAMPLED_KEYS_113C) {
    const rows: UnitRow[] = []
    const lists = mode === 'type' ? [0, 1, 2, 3, 4] : [key]
    for (const list of lists) {
      for (let b = 0; b < 128; b++) {
        let u = m.get(pGame, D2GameStrc.pUnitHash, list * 128 + b)
        while (u !== 0) {
          if (mode === 'list' || m.get(u, D2UnitStrc.dwUnitType) === key) rows.push(unitRow(world, header, u, key))
          u = m.get(u, D2UnitStrc.pGameHashNext)
        }
      }
    }
    out[`t${key}`] = rows
  }
  out.gs = [m.get(pGame, D2GameStrc.seedLo), m.get(pGame, D2GameStrc.seedHi)]
  return out
}

// -------------------------------------------------------------------- diff

export type DiffPolicy113c = 'strict' | 'pos'

export interface FieldDivergence113c {
  readonly frame: number
  /** `t0`/`t1`/`t3`, `gs`, or `step` when the kernel could not run the frame. */
  readonly key: string
  readonly id: number | null
  readonly field: string
  readonly expected: unknown
  readonly actual: unknown
}

const POS_FIELDS_113C = new Set(['id', 'class', 'mode', 'x', 'y'])

/** First field mismatch of `actual` against `golden` under `policy` (unit rows keyed by id). */
export function diffFrame113c(
  golden: TraceFrame,
  actual: TraceFrame,
  header: TraceHeader,
  policy: DiffPolicy113c,
): FieldDivergence113c | null {
  const frame = golden.frame
  for (const key of SAMPLED_KEYS_113C) {
    const k = `t${key}` as const
    const g = golden[k]
    if (g === undefined) continue
    const a = actual[k]
    if (a === undefined) return { frame, key: k, id: null, field: 'list', expected: g.length, actual: null }
    const byId = new Map<number, UnitRow>()
    for (const row of a) byId.set(row[0] as number, row)
    const goldIds = new Set<number>()
    for (const grow of g) {
      const id = grow[0] as number
      goldIds.add(id)
      const arow = byId.get(id)
      if (arow === undefined) return { frame, key: k, id, field: 'presence', expected: grow, actual: null }
      const nCols = Math.max(grow.length, arow.length)
      for (let c = 0; c < nCols; c++) {
        const name =
          c < header.unitFields.length ? (header.unitFields[c] as string) : `stat${String(header.statIds[c - header.unitFields.length])}`
        if (policy === 'pos' && !POS_FIELDS_113C.has(name)) continue
        if (grow[c] !== arow[c]) return { frame, key: k, id, field: name, expected: grow[c], actual: arow[c] }
      }
    }
    for (const row of a) {
      const id = row[0] as number
      if (!goldIds.has(id)) return { frame, key: k, id, field: 'presence', expected: null, actual: row }
    }
  }
  if (policy === 'strict' && golden.gs !== undefined) {
    const ga = actual.gs
    if (ga === undefined || ga[0] !== golden.gs[0] || ga[1] !== golden.gs[1]) {
      return { frame, key: 'gs', id: null, field: 'gs', expected: golden.gs, actual: ga }
    }
  }
  return null
}

// ------------------------------------------------------------------ replay

export interface ReplayScenario113c {
  readonly name: string
  readonly frames: number
  readonly inputs: ReadonlyArray<{ readonly frame: number; readonly c2s: string }>
}

export interface ReplayResult113c {
  readonly scenario: string
  readonly bootFrame: number
  readonly lastGoldenFrame: number
  /** Golden vs hydrated boot state at `bootFrame` (strict); must be null for a valid snapshot. */
  readonly bootCheck: FieldDivergence113c | null
  /** Last frame through which every frame matched strictly (`bootFrame` = no kernel frame matched). */
  readonly strictHorizon: number
  /** Last frame through which every frame matched on id/class/mode/x/y. */
  readonly posHorizon: number
  readonly firstStrictDivergence: FieldDivergence113c | null
  readonly firstPosDivergence: FieldDivergence113c | null
  readonly unportedHit: { readonly frame: number; readonly key: string; readonly status: string; readonly reason: string } | null
  readonly framesStepped: number
}

export function goldenPath113c(name: string): string {
  return join(REPO_ROOT_113C, 'tests/fixtures/oracle/golden', `${name}.oracle.ndjson.gz`)
}

export function snapshotPath113c(name: string, bootFrame: number): string {
  return join(REPO_ROOT_113C, 'tests/fixtures/oracle/k1/replay', `${name}.snap-f${String(bootFrame).padStart(3, '0')}.ndjson.gz`)
}

export function loadGolden113c(name: string): Trace {
  return parseTrace(gunzipSync(readFileSync(goldenPath113c(name))).toString('utf8'))
}

export function loadScenario113c(name: string): ReplayScenario113c {
  return JSON.parse(
    readFileSync(join(REPO_ROOT_113C, 'tests/fixtures/oracle/scenarios', `${name}.json`), 'utf8'),
  ) as ReplayScenario113c
}

function hexBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '')
  return Uint8Array.from(Buffer.from(clean, 'hex'))
}

/** Boots from the recorded snapshot and steps until the first positional divergence or the golden's end. */
export function runReplay113c(name: string, bootFrame = 2): ReplayResult113c {
  const golden = loadGolden113c(name)
  const scenario = loadScenario113c(name)
  const world = bootFromSnapshot113c(loadSnapshotFile113c(snapshotPath113c(name, bootFrame)))
  if (world.bootFrame !== bootFrame) throw new Error(`snapshot boots at F${world.bootFrame}, expected F${bootFrame}`)
  const header = golden.header
  let lastGoldenFrame = 0
  for (const f of golden.frames.keys()) if (f > lastGoldenFrame) lastGoldenFrame = f
  const bootGolden = golden.frames.get(bootFrame)
  if (bootGolden === undefined) throw new Error(`golden has no frame ${bootFrame}`)
  const bootCheck = diffFrame113c(bootGolden, sampleFrame113c(world, header), header, 'strict')

  let strictHorizon = bootFrame
  let posHorizon = bootFrame
  let firstStrict: FieldDivergence113c | null = bootCheck
  let firstPos: FieldDivergence113c | null = bootCheck === null ? null : diffFrame113c(bootGolden, sampleFrame113c(world, header), header, 'pos')
  let unportedHit: ReplayResult113c['unportedHit'] = null
  let framesStepped = 0
  if (bootCheck === null) {
    for (let f = bootFrame + 1; f <= lastGoldenFrame; f++) {
      const g = golden.frames.get(f)
      if (g === undefined) throw new Error(`golden has no frame ${f}`)
      const packets = scenario.inputs.filter((i) => i.frame === f).map((i) => hexBytes(i.c2s))
      try {
        stepFrame113c(world, packets)
      } catch (e) {
        if (!(e instanceof UnportedFunction113c)) throw e
        const d: FieldDivergence113c = {
          frame: f,
          key: 'step',
          id: null,
          field: `<unported ${manifestKey113c(e.module, e.va)}>`,
          expected: 'frame simulated by the original game',
          actual: e.message,
        }
        unportedHit = { frame: f, key: manifestKey113c(e.module, e.va), status: e.status, reason: e.reason }
        if (firstStrict === null) firstStrict = d
        if (firstPos === null) firstPos = d
        break
      }
      framesStepped++
      const sample = sampleFrame113c(world, header)
      if (firstStrict === null) {
        const d = diffFrame113c(g, sample, header, 'strict')
        if (d === null) strictHorizon = f
        else firstStrict = d
      }
      const dp = diffFrame113c(g, sample, header, 'pos')
      if (dp !== null) {
        firstPos = dp
        break
      }
      posHorizon = f
    }
  }
  return {
    scenario: name,
    bootFrame,
    lastGoldenFrame,
    bootCheck,
    strictHorizon: bootCheck === null ? strictHorizon : bootFrame - 1,
    posHorizon: bootCheck === null ? posHorizon : bootFrame - 1,
    firstStrictDivergence: firstStrict,
    firstPosDivergence: firstPos,
    unportedHit,
    framesStepped,
  }
}
