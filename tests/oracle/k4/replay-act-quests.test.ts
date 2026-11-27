/**
 * K4 longitudinal quest replay suite (Acts 1-5) against real Wine 1.13c golden traces
 * (tests/fixtures/oracle/k4/k4-act{1..5}-quest.oracle.ndjson.gz) and F2 memory snapshots
 * (tests/fixtures/oracle/k4/k4-act{1..5}-quest.snap-f002.ndjson.gz).
 *
 * Ratchet horizons: tests/fixtures/oracle/k4/horizons.json
 * Divergence artifacts & root-cause report: docs/oracle/k4-replay/
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { D2GameStrc, D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import { collectImportGraph, legacyReachable } from '../../../tools/oracle/kern-replay/import-graph.ts'
import type { Coverage113c } from '../../../tools/oracle/kern-replay/gap-report.ts'
import { parseTrace, type Trace, type TraceHeader, type UnitRow } from '../../../tools/oracle/lib/trace-diff.ts'
import {
  REPO_ROOT_113C,
  UnportedFunction113c,
  bootFromSnapshot113c,
  diffFrame113c,
  loadManifest113c,
  loadScenario113c,
  loadSnapshotFile113c,
  manifestKey113c,
  sampleFrame113c,
  stepFrame113c,
  type FieldDivergence113c,
  type ReplayResult113c,
} from '../../../tools/oracle/kern-replay/replay-113c.ts'
import type { DivergenceArtifact113c, Horizon113c } from '../../../tools/oracle/kern-replay/report.ts'

const K4_FIXTURES_DIR = join(REPO_ROOT_113C, 'tests/fixtures/oracle/k4')
const K4_HORIZONS_PATH = join(K4_FIXTURES_DIR, 'horizons.json')
const K4_DIVERGENCE_DIR = join(REPO_ROOT_113C, 'docs/oracle/k4-replay')

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function hexBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex.replace(/\s+/g, ''), 'hex'))
}

function k4GoldenPath(name: string): string {
  return join(K4_FIXTURES_DIR, `${name}.oracle.ndjson.gz`)
}

function k4SnapshotPath(name: string, bootFrame: number): string {
  return join(K4_FIXTURES_DIR, `${name}.snap-f${String(bootFrame).padStart(3, '0')}.ndjson.gz`)
}

function k4CoveragePath(name: string): string {
  return join(K4_FIXTURES_DIR, `${name}.coverage.ndjson.gz`)
}

function loadK4Coverage113c(name: string): Coverage113c {
  const lines = gunzipSync(readFileSync(k4CoveragePath(name)))
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
  const hdr = JSON.parse(lines[0] as string) as {
    k: string
    from: number
    to: number
    entries: number
    hit: number
    otherThreadHits: number
  }
  if (hdr.k !== 'hdr') throw new Error(`${name}: coverage has no header`)
  const hits = lines.slice(1).map((l) => {
    const o = JSON.parse(l) as { m: string; va: string; f: number }
    return { module: o.m, va: parseInt(o.va, 16), firstFrame: o.f }
  })
  if (hits.length !== hdr.hit) {
    throw new Error(`${name}: coverage header says ${hdr.hit} hits, file has ${hits.length}`)
  }
  return {
    from: hdr.from,
    to: hdr.to,
    entries: hdr.entries,
    hit: hdr.hit,
    otherThreadHits: hdr.otherThreadHits,
    hits,
  }
}

function loadK4Golden(name: string): Trace {
  return parseTrace(gunzipSync(readFileSync(k4GoldenPath(name))).toString('utf8'))
}

function loadK4Horizons(): Record<string, Horizon113c> {
  return JSON.parse(readFileSync(K4_HORIZONS_PATH, 'utf8')) as Record<string, Horizon113c>
}

function playerStat(header: TraceHeader, row: UnitRow, statId: number): number {
  const idx = header.statIds.indexOf(statId)
  if (idx < 0) throw new Error(`statId ${statId} not present in trace header`)
  const val = row[header.unitFields.length + idx]
  if (val === undefined || val === null) throw new Error(`missing stat column ${statId} in player row`)
  return val
}

function runK4QuestReplay113c(name: string, bootFrame = 2): { result: ReplayResult113c; golden: Trace } {
  const golden = loadK4Golden(name)
  const scenario = loadScenario113c(name)
  const saveBytes =
    scenario.save !== undefined
      ? new Uint8Array(readFileSync(join(REPO_ROOT_113C, scenario.save)))
      : undefined
  const snap = loadSnapshotFile113c(k4SnapshotPath(name, bootFrame))
  const header = golden.header
  let lastGoldenFrame = 0
  for (const f of golden.frames.keys()) if (f > lastGoldenFrame) lastGoldenFrame = f
  const bootGolden = golden.frames.get(bootFrame)
  if (bootGolden === undefined) throw new Error(`golden has no frame ${bootFrame}`)

  beginVaTrace113c()
  let bootCheck: FieldDivergence113c | null = null
  let strictHorizon = bootFrame
  let posHorizon = bootFrame
  let firstStrict: FieldDivergence113c | null = null
  let firstPos: FieldDivergence113c | null = null
  let unportedHit: ReplayResult113c['unportedHit'] = null
  let framesStepped = 0
  let tsExecutedVas: string[] = []

  try {
    const world = bootFromSnapshot113c(snap, saveBytes)
    if (world.bootFrame !== bootFrame) {
      throw new Error(`snapshot boots at F${world.bootFrame}, expected F${bootFrame}`)
    }
    bootCheck = diffFrame113c(bootGolden, sampleFrame113c(world, header), header, 'strict')
    firstStrict = bootCheck
    firstPos =
      bootCheck === null ? null : diffFrame113c(bootGolden, sampleFrame113c(world, header), header, 'pos')

    if (bootCheck === null) {
      for (let f = bootFrame + 1; f <= lastGoldenFrame; f++) {
        const g = golden.frames.get(f)
        if (g === undefined) throw new Error(`golden has no frame ${f}`)
        const packets = scenario.inputs.filter((i) => i.frame === f).map((i) => hexBytes(i.c2s))
        try {
          stepFrame113c(world, packets)
        } catch (e) {
          if (e instanceof UnportedFunction113c) {
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
          if (e instanceof Error && e.message.startsWith('SparseMemory113c:')) {
            const d: FieldDivergence113c = {
              frame: f,
              key: 'step',
              id: null,
              field: '<unhydrated SparseMemory113c>',
              expected: 'frame simulated by the original game',
              actual: e.message,
            }
            if (firstStrict === null) firstStrict = d
            if (firstPos === null) firstPos = d
            break
          }
          throw e
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
  } finally {
    tsExecutedVas = [...endVaTrace113c()].sort()
  }

  return {
    golden,
    result: {
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
      tsExecutedVas,
    },
  }
}

interface K4QuestSpec {
  readonly name: string
  readonly expectedTownLevelId: number
  readonly frames: number
  readonly totalHits: number
  readonly d2CommonExecuted: number
  readonly d2GameExecuted: number
  /** Pre-boot (`firstFrame <= bootFrame`, i.e. `F1..F2`) `D2Common` gap ceiling before `snap-f002` capture. */
  readonly maxD2CommonPreBootGap: number
  /** Pre-boot (`firstFrame <= bootFrame`, i.e. `F1..F2`) `D2Game` gap ceiling before `snap-f002` capture. */
  readonly maxD2GamePreBootGap: number
  /** Stepped (`firstFrame >= bootFrame + 1`, i.e. `F3..FN`) `D2Common` runtime execution gap ceiling. */
  readonly maxD2CommonSteppedRuntimeExecGap: number
  /** Stepped (`firstFrame >= bootFrame + 1`, i.e. `F3..FN`) `D2Game` runtime execution gap ceiling. */
  readonly maxD2GameSteppedRuntimeExecGap: number
  readonly maxD2CommonRuntimeExecGap: number
  readonly maxD2GameRuntimeExecGap: number
  readonly expectedCoverageSha256: string
  readonly verifyGoldenQuestOutcome: (golden: Trace, lastFrame: number) => void
}

/** Monotonic ceiling on the 5-scenario K4 union of `D2Common` total `runtimeExecGap` (`444 / 445` hit in TS). */
const MAX_K4_UNION_D2COMMON_RUNTIME_EXEC_GAP = 1
/** Monotonic ceiling on the 5-scenario K4 union of `D2Game` total `runtimeExecGap` (`459 / 475` hit in TS). */
const MAX_K4_UNION_D2GAME_RUNTIME_EXEC_GAP = 16
/** Monotonic ceiling on the 5-scenario K4 union of `D2Common` stepped `F3+` `runtimeExecGap` (`0`). */
const MAX_K4_UNION_D2COMMON_STEPPED_RUNTIME_EXEC_GAP = 0
/** Monotonic ceiling on the 5-scenario K4 union of `D2Game` stepped `F3+` `runtimeExecGap` (`0`). */
const MAX_K4_UNION_D2GAME_STEPPED_RUNTIME_EXEC_GAP = 0

const DONE_STATUSES_113C = new Set(['ported', 'diff-verified'])

const K4_QUEST_SPECS: readonly K4QuestSpec[] = [
  {
    name: 'k4-act1-quest',
    expectedTownLevelId: 1, // Rogue Encampment
    frames: 160,
    totalHits: 620,
    d2CommonExecuted: 347,
    d2GameExecuted: 273,
    maxD2CommonPreBootGap: 1,
    maxD2GamePreBootGap: 0,
    maxD2CommonSteppedRuntimeExecGap: 0,
    maxD2GameSteppedRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 1,
    maxD2GameRuntimeExecGap: 0,
    expectedCoverageSha256: 'ea0e4c11e3814b3642e676a3c76ce55ddde4b03fb7e22a8751292e0c10ee9b6d',
    verifyGoldenQuestOutcome: (golden, lastFrame) => {
      const f2 = golden.frames.get(2)!.t0![0]!
      const end = golden.frames.get(lastFrame)!.t0![0]!
      expect(playerStat(golden.header, f2, 5)).toBe(12)
      expect(playerStat(golden.header, end, 5)).toBe(13) // A1Q1 Den of Evil +1 skill point
    },
  },
  {
    name: 'k4-act2-quest',
    expectedTownLevelId: 40, // Lut Gholein
    frames: 140,
    totalHits: 671,
    d2CommonExecuted: 366,
    d2GameExecuted: 305,
    maxD2CommonPreBootGap: 3,
    maxD2GamePreBootGap: 6,
    maxD2CommonSteppedRuntimeExecGap: 0,
    maxD2GameSteppedRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 3,
    maxD2GameRuntimeExecGap: 6,
    expectedCoverageSha256: 'a0853ff409ef51fe4f6021c0227d3baa418cbd20babbe5c39c72f07c1db46e87',
    verifyGoldenQuestOutcome: (golden, lastFrame) => {
      const f2 = golden.frames.get(2)!.t0![0]!
      const end = golden.frames.get(lastFrame)!.t0![0]!
      expect(playerStat(golden.header, f2, 5)).toBe(12)
      expect(playerStat(golden.header, end, 5)).toBe(13) // A2Q1 Book of Skill +1 skill point
    },
  },
  {
    name: 'k4-act3-quest',
    expectedTownLevelId: 75, // Kurast Docks
    frames: 130,
    totalHits: 648,
    d2CommonExecuted: 329,
    d2GameExecuted: 319,
    maxD2CommonPreBootGap: 16,
    maxD2GamePreBootGap: 22,
    maxD2CommonSteppedRuntimeExecGap: 0,
    maxD2GameSteppedRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 16,
    maxD2GameRuntimeExecGap: 22,
    expectedCoverageSha256: '1d25006045304249b98a40287b87f2d3e3a94b107ef7032c834f8bf7071b25c0',
    verifyGoldenQuestOutcome: (golden) => {
      // A3Q1 Meshif (wScrollId 0x0211 at F42) deletes 'j34 ' and mints 'g34 ' via QUESTS_CreateItem,
      // advancing pGame->pGameSeed (gs) deterministically on F42.
      const f41 = golden.frames.get(41)!
      const f42 = golden.frames.get(42)!
      expect(f41.gs).toEqual([3213594174, 158754329])
      expect(f42.gs).toEqual([1040732530, 1118359132])
    },
  },
  {
    name: 'k4-act4-quest',
    expectedTownLevelId: 103, // Pandemonium Fortress
    frames: 140,
    totalHits: 547,
    d2CommonExecuted: 281,
    d2GameExecuted: 266,
    maxD2CommonPreBootGap: 19,
    maxD2GamePreBootGap: 24,
    maxD2CommonSteppedRuntimeExecGap: 0,
    maxD2GameSteppedRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 19,
    maxD2GameRuntimeExecGap: 24,
    expectedCoverageSha256: '76112783e0560d1eef61f6e3fc93357170bc505cbe03e82ffe3bd5889ab6dead',
    verifyGoldenQuestOutcome: (golden, lastFrame) => {
      const f2 = golden.frames.get(2)!.t0![0]!
      const end = golden.frames.get(lastFrame)!.t0![0]!
      expect(playerStat(golden.header, f2, 5)).toBe(12)
      expect(playerStat(golden.header, end, 5)).toBe(14) // A4Q1 The Fallen Angel +2 skill points
    },
  },
  {
    name: 'k4-act5-quest',
    expectedTownLevelId: 109, // Harrogath
    frames: 140,
    totalHits: 652,
    d2CommonExecuted: 329,
    d2GameExecuted: 323,
    maxD2CommonPreBootGap: 20,
    maxD2GamePreBootGap: 31,
    maxD2CommonSteppedRuntimeExecGap: 0,
    maxD2GameSteppedRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 20,
    maxD2GameRuntimeExecGap: 31,
    expectedCoverageSha256: '1accd1305a73a78f0d0e7b282539b25f754c12d9f7c4f7fc19c765fb2b05d7f3',
    verifyGoldenQuestOutcome: (golden, lastFrame) => {
      const f2 = golden.frames.get(2)!.t0![0]!
      const end = golden.frames.get(lastFrame)!.t0![0]!
      for (const resistStat of [39, 41, 43, 45]) {
        expect(playerStat(golden.header, f2, resistStat)).toBe(0)
        expect(playerStat(golden.header, end, resistStat)).toBe(10) // A5Q3 Scroll of Resistance +10 all resists
      }
    },
  },
]

const horizons = loadK4Horizons()
const k4ExecutedVaUnion = new Set<string>()
const cachedK4ReplayByScenario = new Map<string, ReplayResult113c>()
const cachedK4CoverageByScenario = new Map<string, Coverage113c>()
const k4PurityCache = new Map<string, boolean>()

function isPureKernFile113c(kf: string): boolean {
  let v = k4PurityCache.get(kf)
  if (v === undefined) {
    v = legacyReachable(collectImportGraph(REPO_ROOT_113C, [kf]), [kf]).length === 0
    k4PurityCache.set(kf, v)
  }
  return v
}

for (const spec of K4_QUEST_SPECS) {
  const { name, expectedTownLevelId } = spec
  const H = horizons[name]
  if (H === undefined) throw new Error(`k4/horizons.json has no entry for ${name}`)
  const { result: r, golden } = runK4QuestReplay113c(name, H.bootFrame)
  const cov = loadK4Coverage113c(name)
  cachedK4ReplayByScenario.set(name, r)
  cachedK4CoverageByScenario.set(name, cov)
  for (const va of r.tsExecutedVas) k4ExecutedVaUnion.add(va.toUpperCase())

  describe(`K4 quest replay ${name} (boot F${H.bootFrame}, strict F${H.strict}, pos F${H.pos})`, () => {
    it('hydrates F2 boot snapshot identically to the 1.13c Wine golden in the expected Act town', () => {
      expect(r.bootCheck).toBeNull()
      const levelIdx = golden.header.unitFields.indexOf('level')
      expect(levelIdx).toBeGreaterThanOrEqual(0)
      const f2Player = golden.frames.get(H.bootFrame)!.t0![0]!
      expect(f2Player[levelIdx]).toBe(expectedTownLevelId)
    })

    it('detects a single corrupted player seed bit at F2 (negative control)', () => {
      const scenario = loadScenario113c(name)
      const saveBytes =
        scenario.save !== undefined
          ? new Uint8Array(readFileSync(join(REPO_ROOT_113C, scenario.save)))
          : undefined
      const world = bootFromSnapshot113c(loadSnapshotFile113c(k4SnapshotPath(name, H.bootFrame)), saveBytes)
      const pPlayer = world.m.get(world.pGame, D2GameStrc.pUnitHash, 1)
      expect(pPlayer).not.toBe(0)
      expect(world.m.get(pPlayer, D2UnitStrc.dwUnitId)).toBe(1)
      world.m.set(pPlayer, D2UnitStrc.seedLo, (world.m.get(pPlayer, D2UnitStrc.seedLo) ^ 1) >>> 0)
      const bootGolden = golden.frames.get(H.bootFrame)!
      const d = diffFrame113c(bootGolden, sampleFrame113c(world, golden.header), golden.header, 'strict')
      expect(d).toMatchObject({ key: 't0', id: 1, field: 'seedLo' })
      expect(diffFrame113c(bootGolden, sampleFrame113c(world, golden.header), golden.header, 'pos')).toBeNull()
    })

    it('verifies the 1.13c golden trace executes the authentic Act quest state/reward transition', () => {
      spec.verifyGoldenQuestOutcome(golden, r.lastGoldenFrame)
    })

    it('matches the golden on every frame through the committed strict and position horizons', () => {
      expect(r.bootFrame).toBe(H.bootFrame)
      expect(r.strictHorizon).toBeGreaterThanOrEqual(H.strict)
      expect(r.posHorizon).toBeGreaterThanOrEqual(H.pos)
      expect(r.posHorizon).toBeGreaterThanOrEqual(r.strictHorizon)
    })

    it('stops at an explicit first divergence and matches SHA-256 fixture provenance', () => {
      const art = JSON.parse(
        readFileSync(join(K4_DIVERGENCE_DIR, `${name}.divergence.json`), 'utf8'),
      ) as DivergenceArtifact113c
      expect(art.scenario).toBe(name)
      expect(art.strictHorizon).toBeLessThanOrEqual(r.strictHorizon)
      expect(art.posHorizon).toBeLessThanOrEqual(r.posHorizon)
      expect(art.goldenSha256).toBe(sha256(k4GoldenPath(name)))
      expect(art.snapshotSha256).toBe(sha256(k4SnapshotPath(name, H.bootFrame)))

      if (r.strictHorizon === r.lastGoldenFrame) {
        expect(r.firstStrictDivergence).toBeNull()
        return
      }
      expect(r.firstStrictDivergence).not.toBeNull()
      expect(r.firstStrictDivergence!.frame).toBe(r.strictHorizon + 1)
    })

    it('verifies real 1.13c DLL coverage (.coverage.ndjson.gz), 0 manifest unported/impure VAs, and monotonic runtimeExecGap bounds', () => {
      const scenario = loadScenario113c(name)
      const manifest = loadManifest113c()
      expect(sha256(k4CoveragePath(name))).toBe(spec.expectedCoverageSha256)
      expect(cov.from).toBe(1)
      expect(cov.to).toBe(spec.frames)
      expect(cov.to).toBe(scenario.frames)
      expect(cov.entries).toBe(manifest.size)
      expect(cov.otherThreadHits).toBe(0)
      expect(cov.hit).toBe(spec.totalHits)
      expect(cov.hits.length).toBe(spec.totalHits)

      const byKey = new Map(cov.hits.map((h) => [manifestKey113c(h.module, h.va), h.firstFrame]))
      expect(byKey.get('D2Game:0x6FC4E050')).toBe(1)
      const firstInput = Math.min(...scenario.inputs.map((i) => i.frame))
      expect(byKey.get('D2Game:0x6FCEC550')).toBe(firstInput)

      const tsSet = new Set(r.tsExecutedVas)
      let d2CommonDll = 0
      let d2GameDll = 0
      let d2CommonTsExec = 0
      let d2GameTsExec = 0
      const d2CommonPreBootGapVas: string[] = []
      const d2CommonSteppedGapVas: string[] = []
      const d2GamePreBootGapVas: string[] = []
      const d2GameSteppedGapVas: string[] = []
      const unportedVas: string[] = []
      const impureVas: string[] = []

      for (const h of cov.hits) {
        const key = manifestKey113c(h.module, h.va)
        const fn = manifest.get(key)
        expect(fn, `${name}: covered ${key} must exist in manifest-113c.json`).toBeDefined()
        if (!DONE_STATUSES_113C.has(fn!.status)) unportedVas.push(key)
        if (typeof fn!.kernFile === 'string' && !isPureKernFile113c(fn!.kernFile)) impureVas.push(key)
        if (h.module === 'D2Common') {
          d2CommonDll++
          if (tsSet.has(key)) d2CommonTsExec++
          else if (h.firstFrame <= H.bootFrame) d2CommonPreBootGapVas.push(key)
          else d2CommonSteppedGapVas.push(`${key}@F${h.firstFrame}`)
        } else if (h.module === 'D2Game') {
          d2GameDll++
          if (tsSet.has(key)) d2GameTsExec++
          else if (h.firstFrame <= H.bootFrame) d2GamePreBootGapVas.push(key)
          else d2GameSteppedGapVas.push(`${key}@F${h.firstFrame}`)
        }
      }

      expect(unportedVas).toEqual([])
      expect(impureVas).toEqual([])
      expect(d2CommonDll).toBe(spec.d2CommonExecuted)
      expect(d2GameDll).toBe(spec.d2GameExecuted)
      expect(d2CommonTsExec).toBeGreaterThan(0)
      expect(d2GameTsExec).toBeGreaterThan(0)

      expect(
        d2CommonSteppedGapVas,
        `${name} D2Common steppedRuntimeExecGap (F${H.bootFrame + 1}+) must stay <= ${spec.maxD2CommonSteppedRuntimeExecGap}`,
      ).toHaveLength(spec.maxD2CommonSteppedRuntimeExecGap)
      expect(
        d2GameSteppedGapVas,
        `${name} D2Game steppedRuntimeExecGap (F${H.bootFrame + 1}+) must stay <= ${spec.maxD2GameSteppedRuntimeExecGap}`,
      ).toHaveLength(spec.maxD2GameSteppedRuntimeExecGap)
      expect(
        d2CommonPreBootGapVas.length,
        `${name} D2Common preBootGap (F1..F${H.bootFrame}) exceeded ceiling (${spec.maxD2CommonPreBootGap})`,
      ).toBeLessThanOrEqual(spec.maxD2CommonPreBootGap)
      expect(
        d2GamePreBootGapVas.length,
        `${name} D2Game preBootGap (F1..F${H.bootFrame}) exceeded ceiling (${spec.maxD2GamePreBootGap})`,
      ).toBeLessThanOrEqual(spec.maxD2GamePreBootGap)

      const d2CommonRuntimeGap = d2CommonDll - d2CommonTsExec
      const d2GameRuntimeGap = d2GameDll - d2GameTsExec
      expect(
        d2CommonRuntimeGap,
        `${name} D2Common runtimeExecGap (${d2CommonRuntimeGap}) exceeded monotonic ratchet ceiling (${spec.maxD2CommonRuntimeExecGap})`,
      ).toBeLessThanOrEqual(spec.maxD2CommonRuntimeExecGap)
      expect(
        d2GameRuntimeGap,
        `${name} D2Game runtimeExecGap (${d2GameRuntimeGap}) exceeded monotonic ratchet ceiling (${spec.maxD2GameRuntimeExecGap})`,
      ).toBeLessThanOrEqual(spec.maxD2GameRuntimeExecGap)
    })

    if (H.strict >= r.lastGoldenFrame) {
      it(`gate: zero divergence F${H.bootFrame + 1}..F${r.lastGoldenFrame}`, () => {
        expect(r.firstStrictDivergence).toBeNull()
      })
    } else {
      it.todo(
        `gate: zero divergence F${H.bootFrame + 1}..F${r.lastGoldenFrame} (enabled once k4/horizons.json strict reaches F${r.lastGoldenFrame})`,
      )
    }
  })
}

const K4_PROMOTED_DIFF_VERIFIED_VAS: readonly string[] = [
  'D2Game:0x6FC21020',
  'D2Game:0x6FC21100',
  'D2Game:0x6FC21130',
  'D2Game:0x6FC211D0',
  'D2Game:0x6FC21370',
  'D2Game:0x6FC2E1C0',
  'D2Game:0x6FC2E660',
  'D2Game:0x6FC2E7E0',
  'D2Game:0x6FC31980',
  'D2Game:0x6FC35D10',
  'D2Game:0x6FC36610',
  'D2Game:0x6FC36970',
  'D2Game:0x6FC36A30',
  'D2Game:0x6FC39880',
  'D2Game:0x6FC39BA0',
  'D2Game:0x6FC39BB0',
  'D2Game:0x6FC39C20',
  'D2Game:0x6FC3BC60',
  'D2Game:0x6FC3DB40',
  'D2Game:0x6FC4CBE0',
  'D2Game:0x6FC4CF30',
  'D2Game:0x6FC4E7D0',
  'D2Game:0x6FC4EEA0',
  'D2Game:0x6FC53800',
  'D2Game:0x6FC53880',
  'D2Game:0x6FC53920',
  'D2Game:0x6FC53EB0',
  'D2Game:0x6FC53F30',
  'D2Game:0x6FC54660',
  'D2Game:0x6FC54B20',
  'D2Game:0x6FC54C00',
  'D2Game:0x6FC55030',
  'D2Game:0x6FC55910',
  'D2Game:0x6FC55C90',
  'D2Game:0x6FC55E50',
  'D2Game:0x6FC566A0',
  'D2Game:0x6FC57220',
  'D2Game:0x6FC57680',
  'D2Game:0x6FC67CF0',
  'D2Game:0x6FC685C0',
  'D2Game:0x6FC687A0',
  'D2Game:0x6FC68B60',
  'D2Game:0x6FC69A80',
  'D2Game:0x6FC69DB0',
  'D2Game:0x6FC6B1D0',
  'D2Game:0x6FC77E80',
  'D2Game:0x6FC79680',
  'D2Game:0x6FC7A000',
  'D2Game:0x6FC7A7C0',
  'D2Game:0x6FC7B0B0',
  'D2Game:0x6FC7BEA0',
  'D2Game:0x6FC7DA70',
  'D2Game:0x6FC7F5E0',
  'D2Game:0x6FC80660',
  'D2Game:0x6FC80750',
  'D2Game:0x6FC807D0',
  'D2Game:0x6FC80820',
  'D2Game:0x6FC808B0',
  'D2Game:0x6FC80940',
  'D2Game:0x6FC80F20',
  'D2Game:0x6FC81750',
  'D2Game:0x6FC81B70',
  'D2Game:0x6FC81E30',
  'D2Game:0x6FC820E0',
  'D2Game:0x6FC82220',
  'D2Game:0x6FC82D90',
  'D2Game:0x6FC82DF0',
  'D2Game:0x6FC82FA0',
  'D2Game:0x6FC83CC0',
  'D2Game:0x6FC85990',
  'D2Game:0x6FC89200',
  'D2Game:0x6FC89590',
  'D2Game:0x6FC90D60',
  'D2Game:0x6FC97FA0',
  'D2Game:0x6FC98340',
  'D2Game:0x6FC98610',
  'D2Game:0x6FC98760',
  'D2Game:0x6FC99FE0',
  'D2Game:0x6FC9A940',
  'D2Game:0x6FC9ADF0',
  'D2Game:0x6FCAA3E0',
  'D2Game:0x6FCAA770',
  'D2Game:0x6FCAACD0',
  'D2Game:0x6FCAAD40',
  'D2Game:0x6FCAB3D0',
  'D2Game:0x6FCABD00',
  'D2Game:0x6FCABFC0',
  'D2Game:0x6FCAC810',
  'D2Game:0x6FCAF5C0',
  'D2Game:0x6FCAF620',
  'D2Game:0x6FCBCB00',
  'D2Game:0x6FCD07B0',
  'D2Game:0x6FCD0A20',
  'D2Game:0x6FCD17B0',
  'D2Game:0x6FCD8810',
  'D2Game:0x6FCD8970',
  'D2Game:0x6FCD8AE0',
  'D2Game:0x6FCD8B50',
  'D2Game:0x6FCD8B90',
  'D2Game:0x6FCD9320',
  'D2Game:0x6FCD9560',
  'D2Game:0x6FCD97D0',
  'D2Game:0x6FCD9D80',
  'D2Game:0x6FCDAE40',
  'D2Game:0x6FCDD330',
  'D2Game:0x6FCDD810',
  'D2Game:0x6FCE1C20',
  'D2Game:0x6FCE1E10',
  'D2Game:0x6FCE2080',
  'D2Game:0x6FCE2250',
  'D2Game:0x6FCE2520',
  'D2Game:0x6FCE2590',
  'D2Game:0x6FCE25D0',
  'D2Game:0x6FCE25F0',
  'D2Game:0x6FCE2750',
  'D2Game:0x6FCE3260',
  'D2Game:0x6FCE44E0',
  'D2Game:0x6FCE4570',
  'D2Game:0x6FCE4620',
  'D2Game:0x6FCE4880',
  'D2Game:0x6FCE5440',
  'D2Game:0x6FCE5690',
  'D2Game:0x6FCE5730',
  'D2Game:0x6FCE5790',
  'D2Game:0x6FCE7080',
  'D2Game:0x6FCE7B40',
  'D2Game:0x6FCE9400',
  'D2Game:0x6FCEB370',
  'D2Game:0x6FCEB690',
  'D2Game:0x6FCEC2F0',
  'D2Game:0x6FCEC9D0',
  'D2Game:0x6FCECCF0',
  'D2Game:0x6FCECF00',
  'D2Game:0x6FCED480',
  'D2Game:0x6FCEE440',
  'D2Game:0x6FCEF730',
  'D2Game:0x6FCF1AA0',
  'D2Game:0x6FCF1BC0',
  'D2Game:0x6FCF29F0',
  'D2Game:0x6FCF2D90',
  'D2Game:0x6FCF39B0',
  'D2Game:0x6FCF43E0',
  'D2Game:0x6FCF4670',
  'D2Game:0x6FCF9BF0',
  'D2Game:0x6FCFF9A0',
  'D2Game:0x6FCFFAE0',
  'D2Game:0x6FCFFF10',
  'D2Game:0x6FCFFFD0',
  'D2Game:0x6FD000C0',
  'D2Game:0x6FD00110',
  'D2Game:0x6FD007A0',
  'D2Game:0x6FD00C80',
  'D2Game:0x6FD00F40',
  'D2Game:0x6FD012D0',
  'D2Game:0x6FD013B0',
  'D2Game:0x6FD01430',
  'D2Game:0x6FD01D90',
  'D2Game:0x6FD020A0',
  'D2Game:0x6FD028A0',
  'D2Game:0x6FD028C0',
  'D2Game:0x6FD02AB0',
  'D2Game:0x6FD03000',
  'D2Game:0x6FD03B40',
  'D2Game:0x6FD03E30',
  'D2Game:0x6FD04030',
  'D2Game:0x6FD04500',
  'D2Game:0x6FD04F60',
  'D2Game:0x6FD053F0',
  'D2Game:0x6FD055C0',
  'D2Game:0x6FD05920',
  'D2Game:0x6FD06660',
  'D2Game:0x6FD06700',
  'D2Game:0x6FD07CE0',
  'D2Game:0x6FD0A080',
  'D2Game:0x6FD0F650',
  'D2Game:0x6FD11A90',
  'D2Game:0x6FD11D90',
  'D2Game:0x6FD130C0',
  'D2Game:0x6fc56470',
  'D2Game:0x6fc565e0',
  'D2Game:0x6fc7cc70',
  'D2Game:0x6fc7d5c0',
  'D2Game:0x6fc7fb50',
  'D2Game:0x6fc7fc20',
  'D2Game:0x6fc80080',
  'D2Game:0x6fc87210',
  'D2Game:0x6fc88060',
  'D2Game:0x6fc887d0',
  'D2Game:0x6fc89130',
  'D2Game:0x6fcdad40',
  'D2Game:0x6fcdc5f0',
  'D2Game:0x6fce7480',
  'D2Game:0x6fce7ed0',
  'D2Game:0x6fce8990',
  'D2Game:0x6fce9f60',
  'D2Game:0x6fcf01d0',
  'D2Game:0x6fcf0910',
  'D2Game:0x6fcf76a0',
  'D2Game:0x6fd09200',
  'D2Game:0x6fd092d0',
  'D2Game:0x6fd093c0',
  'D2Game:0x6fd09dc0',
  'D2Game:0x6FC537D0',
  'D2Game:0x6FC55890',
  'D2Game:0x6FC576F0',
  'D2Game:0x6FC77000',
  'D2Game:0x6FC77270',
  'D2Game:0x6FC77540',
  'D2Game:0x6FC775F0',
  'D2Game:0x6FC77A60',
  'D2Game:0x6FC781A0',
  'D2Game:0x6FC783C0',
  'D2Game:0x6FC787C0',
  'D2Game:0x6FC78930',
  'D2Game:0x6FC79450',
  'D2Game:0x6FC796B0',
  'D2Game:0x6FC797B0',
  'D2Game:0x6FC79BE0',
  'D2Game:0x6FC7A0A0',
  'D2Game:0x6FC7A530',
  'D2Game:0x6FC7A720',
  'D2Game:0x6FC7AE20',
  'D2Game:0x6FC7B7A0',
  'D2Game:0x6FC7D520',
  'D2Game:0x6FC7D920',
  'D2Game:0x6FC7F200',
  'D2Game:0x6FC80A80',
  'D2Game:0x6FC80E00',
  'D2Game:0x6FC81030',
  'D2Game:0x6FC81540',
  'D2Game:0x6FC81A80',
  'D2Game:0x6FC81C60',
  'D2Game:0x6FC81F50',
  'D2Game:0x6FC82410',
  'D2Game:0x6FC82490',
  'D2Game:0x6FC824D0',
  'D2Game:0x6FC82E50',
  'D2Game:0x6FC82F00',
  'D2Game:0x6FC83190',
  'D2Game:0x6FC835D0',
  'D2Game:0x6FC83870',
  'D2Game:0x6FC83AD0',
  'D2Game:0x6FC83C40',
  'D2Game:0x6FC83F90',
  'D2Game:0x6FC86960',
  'D2Game:0x6FC89360',
  'D2Game:0x6FCD8C00',
  'D2Game:0x6FCD8CE0',
  'D2Game:0x6FCD8F20',
  'D2Game:0x6FCD9070',
  'D2Game:0x6FCD9730',
  'D2Game:0x6FCD97A0',
  'D2Game:0x6FCD9830',
  'D2Game:0x6FCD9DE0',
  'D2Game:0x6FCDA100',
  'D2Game:0x6FCDB1B0',
  'D2Game:0x6FCDB250',
  'D2Game:0x6FCE2680',
  'D2Game:0x6FCE2720',
  'D2Game:0x6FCE2900',
  'D2Game:0x6FCE2B00',
  'D2Game:0x6FCE2DC0',
  'D2Game:0x6FCE3080',
  'D2Game:0x6FCE3320',
  'D2Game:0x6FCE37F0',
  'D2Game:0x6FCE3A80',
  'D2Game:0x6FCE41D0',
  'D2Game:0x6FCE4320',
  'D2Game:0x6FCE4690',
  'D2Game:0x6FCE4780',
  'D2Game:0x6FCE4900',
  'D2Game:0x6FCE4A40',
  'D2Game:0x6FCE4EA0',
  'D2Game:0x6FCE5310',
  'D2Game:0x6FCE5A60',
  'D2Game:0x6FCE5DB0',
  'D2Game:0x6FCE61C0',
  'D2Game:0x6FCE67C0',
  'D2Game:0x6FCE72C0',
  'D2Game:0x6FCE7DC0',
  'D2Game:0x6FCE85A0',
  'D2Game:0x6FCF4FF0',
  'D2Game:0x6FD03050',
  'D2Game:0x6FD03120',
  'D2Game:0x6FD033A0',
  'D2Game:0x6FD03850',
  'D2Game:0x6FD03970',
  'D2Game:0x6FD042F0',
  'D2Game:0x6FD04C90',
  'D2Game:0x6FD049E0',
  'D2Game:0x6FD050C0',
  'D2Game:0x6FD05270',
  'D2Game:0x6FD05450',
  'D2Game:0x6FD054C0',
  'D2Game:0x6FD05540',
  'D2Game:0x6FD055F0',
  'D2Game:0x6FD056E0',
  'D2Game:0x6FD06000',
  'D2Game:0x6FD06CF0',
  'D2Game:0x6FD07080',
  'D2Game:0x6FD07940',
]

describe('K4 Act 1-5 quest & town NPC diff-verified VA execution gate', () => {
  it('executes all 301 promoted quest, NPC, packet, and DRLG VAs under full-frame strict zero divergence', () => {
    expect(K4_PROMOTED_DIFF_VERIFIED_VAS.length).toBe(301)
    const missing = K4_PROMOTED_DIFF_VERIFIED_VAS.filter((va) => !k4ExecutedVaUnion.has(va.toUpperCase()))
    expect(missing).toEqual([])
  })

  it('enforces 5-scenario union 0 stepped F3+ runtimeExecGap and D2Game (<= 16) / D2Common (<= 1) total runtimeExecGap ratchets', () => {
    const dllD2CommonUnion = new Set<string>()
    const dllD2GameUnion = new Set<string>()
    const dllSteppedD2CommonUnion = new Set<string>()
    const dllSteppedD2GameUnion = new Set<string>()
    const tsD2CommonUnion = new Set<string>()
    const tsD2GameUnion = new Set<string>()

    for (const spec of K4_QUEST_SPECS) {
      const r = cachedK4ReplayByScenario.get(spec.name)!
      const cov = cachedK4CoverageByScenario.get(spec.name)!
      expect(r.strictHorizon).toBe(r.lastGoldenFrame)
      expect(r.firstStrictDivergence).toBeNull()

      for (const h of cov.hits) {
        const key = manifestKey113c(h.module, h.va)
        if (h.module === 'D2Common') {
          dllD2CommonUnion.add(key)
          if (h.firstFrame > r.bootFrame) dllSteppedD2CommonUnion.add(key)
        }
        if (h.module === 'D2Game') {
          dllD2GameUnion.add(key)
          if (h.firstFrame > r.bootFrame) dllSteppedD2GameUnion.add(key)
        }
      }
      for (const key of r.tsExecutedVas) {
        if (key.startsWith('D2Common:')) tsD2CommonUnion.add(key)
        if (key.startsWith('D2Game:')) tsD2GameUnion.add(key)
      }
    }

    expect(dllD2CommonUnion.size).toBe(445)
    expect(dllD2GameUnion.size).toBe(475)

    const unionSteppedD2CommonGap: string[] = []
    for (const key of dllSteppedD2CommonUnion) {
      if (!tsD2CommonUnion.has(key)) unionSteppedD2CommonGap.push(key)
    }
    const unionSteppedD2GameGap: string[] = []
    for (const key of dllSteppedD2GameUnion) {
      if (!tsD2GameUnion.has(key)) unionSteppedD2GameGap.push(key)
    }
    expect(unionSteppedD2CommonGap).toHaveLength(MAX_K4_UNION_D2COMMON_STEPPED_RUNTIME_EXEC_GAP)
    expect(unionSteppedD2GameGap).toHaveLength(MAX_K4_UNION_D2GAME_STEPPED_RUNTIME_EXEC_GAP)

    let unionD2CommonGap = 0
    for (const key of dllD2CommonUnion) {
      if (!tsD2CommonUnion.has(key)) unionD2CommonGap++
    }
    let unionD2GameGap = 0
    for (const key of dllD2GameUnion) {
      if (!tsD2GameUnion.has(key)) unionD2GameGap++
    }

    expect(
      unionD2CommonGap,
      `5-scenario K4 D2Common union runtimeExecGap (${unionD2CommonGap}) exceeded monotonic ceiling (${MAX_K4_UNION_D2COMMON_RUNTIME_EXEC_GAP})`,
    ).toBeLessThanOrEqual(MAX_K4_UNION_D2COMMON_RUNTIME_EXEC_GAP)
    expect(
      unionD2GameGap,
      `5-scenario K4 D2Game union runtimeExecGap (${unionD2GameGap}) exceeded monotonic ceiling (${MAX_K4_UNION_D2GAME_RUNTIME_EXEC_GAP})`,
    ).toBeLessThanOrEqual(MAX_K4_UNION_D2GAME_RUNTIME_EXEC_GAP)
  })
})
