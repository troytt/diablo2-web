/**
 * [K6] Wave 4 Multi-Class & Act 2-5 kernel-driven longitudinal replay runner, INT3 DLL coverage
 * analyzer, and upward-only horizon ratchet:
 *   npx tsx tools/oracle/k6-s2/k6-s2-replay.ts [--update-horizons] [scenario...]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import { computeK6SteppedRuntimeExecSummary113c } from '../k6/k6-runtime-exec-exemptions.ts'
import type { Coverage113c } from '../kern-replay/gap-report.ts'
import {
  REPO_ROOT_113C,
  UnportedFunction113c,
  bootFromSnapshot113c,
  diffFrame113c,
  loadManifest113c,
  loadSnapshotFile113c,
  manifestKey113c,
  sampleFrame113c,
  stepFrame113c,
  type FieldDivergence113c,
  type ReplayResult113c,
  type ReplayScenario113c,
} from '../kern-replay/replay-113c.ts'
import { mergeHorizons113c, type Horizon113c } from '../kern-replay/report.ts'
import { parseTrace, type Trace } from '../lib/trace-diff.ts'

export const K6_S2_REPLAY_SCENARIOS_113C = [
  'k6s2-amazon-skills',
  'k6s2-sorceress-skills',
  'k6s2-necromancer-skills',
  'k6s2-paladin-skills',
  'k6s2-barbarian-skills',
  'k6s2-act2-sewers-cube-merc',
  'k6s2-act4-hell-chaos-shrines',
  'k6s2-act5-harrogath-shenk-anya',
] as const

export type K6S2ReplayScenarioName113c = (typeof K6_S2_REPLAY_SCENARIOS_113C)[number]

export const K6_S2_SCENARIOS_DIR_113C = join(REPO_ROOT_113C, 'tools/oracle/k6-s2/scenarios')
export const K6_S2_FIXTURES_DIR_113C = join(REPO_ROOT_113C, 'tests/fixtures/oracle/k6-s2')
export const K6_S2_HORIZONS_PATH_113C = join(K6_S2_FIXTURES_DIR_113C, 'horizons.json')

export function k6S2GoldenPath113c(name: string): string {
  return join(K6_S2_FIXTURES_DIR_113C, `${name}.oracle.ndjson.gz`)
}

export function k6S2SnapshotPath113c(name: string, bootFrame = 2): string {
  return join(K6_S2_FIXTURES_DIR_113C, `${name}.snap-f${String(bootFrame).padStart(3, '0')}.ndjson.gz`)
}

export function k6S2CoveragePath113c(name: string): string {
  return join(K6_S2_FIXTURES_DIR_113C, `${name}.coverage.ndjson.gz`)
}

export function k6S2ScenarioPath113c(name: string): string {
  return join(K6_S2_SCENARIOS_DIR_113C, `${name}.json`)
}

export function loadK6S2Golden113c(name: string): Trace {
  return parseTrace(gunzipSync(readFileSync(k6S2GoldenPath113c(name))).toString('utf8'))
}

export function loadK6S2Scenario113c(name: string): ReplayScenario113c {
  return JSON.parse(readFileSync(k6S2ScenarioPath113c(name), 'utf8')) as ReplayScenario113c
}

export function loadK6S2Horizons113c(): Record<string, Horizon113c> {
  if (!existsSync(K6_S2_HORIZONS_PATH_113C)) return {}
  return JSON.parse(readFileSync(K6_S2_HORIZONS_PATH_113C, 'utf8')) as Record<string, Horizon113c>
}

export function loadK6S2Coverage113c(name: string): Coverage113c {
  const lines = gunzipSync(readFileSync(k6S2CoveragePath113c(name)))
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

function hexBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '')
  const out = new Uint8Array(clean.length >>> 1)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export interface K6S2RuntimeExecSummary113c {
  readonly d2CommonDll: number
  readonly d2CommonTs: number
  readonly d2CommonRuntimeExecGap: number
  readonly d2GameDll: number
  readonly d2GameTs: number
  readonly d2GameRuntimeExecGap: number
  readonly missingD2CommonVas: readonly string[]
  readonly missingD2GameVas: readonly string[]
}

export function computeK6S2RuntimeExecSummary113c(
  coverage: Coverage113c,
  tsExecutedVas: ReadonlyArray<string>,
): K6S2RuntimeExecSummary113c {
  const tsSet = new Set(tsExecutedVas)
  const missingD2Common: string[] = []
  const missingD2Game: string[] = []
  let d2CommonDll = 0
  let d2GameDll = 0
  for (const h of coverage.hits) {
    const key = manifestKey113c(h.module, h.va)
    if (h.module === 'D2Common') {
      d2CommonDll++
      if (!tsSet.has(key)) missingD2Common.push(key)
    } else if (h.module === 'D2Game') {
      d2GameDll++
      if (!tsSet.has(key)) missingD2Game.push(key)
    }
  }
  missingD2Common.sort()
  missingD2Game.sort()
  let d2CommonTs = 0
  let d2GameTs = 0
  for (const k of tsSet) {
    if (k.startsWith('D2Common:')) d2CommonTs++
    else if (k.startsWith('D2Game:')) d2GameTs++
  }
  return {
    d2CommonDll,
    d2CommonTs,
    d2CommonRuntimeExecGap: missingD2Common.length,
    d2GameDll,
    d2GameTs,
    d2GameRuntimeExecGap: missingD2Game.length,
    missingD2CommonVas: missingD2Common,
    missingD2GameVas: missingD2Game,
  }
}

/** Boots from `tests/fixtures/oracle/k6-s2/<name>.snap-f002.ndjson.gz` and steps until first pos divergence or golden end. */
export function runK6S2Replay113c(name: string, bootFrame = 2): ReplayResult113c {
  const golden = loadK6S2Golden113c(name)
  const scenario = loadK6S2Scenario113c(name)
  const saveBytes =
    scenario.save !== undefined
      ? new Uint8Array(readFileSync(join(REPO_ROOT_113C, scenario.save)))
      : undefined
  const snap = loadSnapshotFile113c(k6S2SnapshotPath113c(name, bootFrame))
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
          let key: string | null = null
          let status = 'unported'
          let reason = ''
          if (e instanceof UnportedFunction113c) {
            key = manifestKey113c(e.module, e.va)
            status = e.status
            reason = e.reason
          } else if (e instanceof Error) {
            const m = /^Unsupported monster pfnThink VA: 0x([0-9a-f]+)$/i.exec(e.message)
            if (m) {
              key = manifestKey113c('D2Game', parseInt(m[1]!, 16))
              status = 'unported-pfnThink'
              reason = e.message
            }
          }
          if (key === null) throw e
          const d: FieldDivergence113c = {
            frame: f,
            key: 'step',
            id: null,
            field: `<unported ${key}>`,
            expected: 'frame simulated by the original game',
            actual: e instanceof Error ? e.message : String(e),
          }
          unportedHit = {
            frame: f,
            key,
            status,
            reason,
          }
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
  } finally {
    tsExecutedVas = [...endVaTrace113c()].sort()
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
    tsExecutedVas,
  }
}

function runCli(): void {
  const args = process.argv.slice(2)
  const updateHorizons = args.includes('--update-horizons')
  const requested = args.filter((a) => !a.startsWith('--'))
  const names = requested.length > 0 ? requested : [...K6_S2_REPLAY_SCENARIOS_113C]
  const manifest = loadManifest113c()
  if (manifest.size < 4800) throw new Error(`unexpected manifest size: ${manifest.size}`)

  const results: ReplayResult113c[] = []
  for (const name of names) {
    const r = runK6S2Replay113c(name, 2)
    results.push(r)
    const cov = loadK6S2Coverage113c(name)
    const exec = computeK6S2RuntimeExecSummary113c(cov, r.tsExecutedVas)
    const stepped = computeK6SteppedRuntimeExecSummary113c(name, cov, r.tsExecutedVas, 2)
    const divStr =
      r.firstStrictDivergence === null
        ? 'FULL-HORIZON ZERO DIVERGENCE'
        : `firstStrict=F${r.firstStrictDivergence.frame} ${r.firstStrictDivergence.key}[${String(r.firstStrictDivergence.id ?? '-')}] .${r.firstStrictDivergence.field} (exp=${JSON.stringify(r.firstStrictDivergence.expected)} act=${JSON.stringify(r.firstStrictDivergence.actual)})`
    console.log(
      `${name.padEnd(32)} boot=${r.bootCheck === null ? 'OK' : 'FAIL'} strict=F${String(r.strictHorizon).padStart(3)}/F${String(r.lastGoldenFrame).padStart(3)} pos=F${String(r.posHorizon).padStart(3)} dll=(C:${exec.d2CommonDll},G:${exec.d2GameDll}) f3Gap=(C:${stepped.d2CommonUnexemptedGap},G:${stepped.d2GameUnexemptedGap}) prebootGap=(C:${stepped.d2CommonPrebootExemptedGap},G:${stepped.d2GamePrebootExemptedGap}) | ${divStr}`,
    )
  }

  if (updateHorizons) {
    const prev = loadK6S2Horizons113c()
    const { next, regressions } = mergeHorizons113c(prev, results)
    if (regressions.length > 0) {
      throw new Error(`horizon regressions detected: ${regressions.join('; ')}`)
    }
    writeFileSync(K6_S2_HORIZONS_PATH_113C, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    console.log(`wrote ${K6_S2_HORIZONS_PATH_113C}`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli()
}
