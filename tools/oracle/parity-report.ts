/**
 * Oracle parity ratchet: replays every golden oracle scenario on the TS
 * server and finds the first frame where it diverges from the original game.
 *
 *   npx tsx tools/oracle/parity-report.ts            # print the table
 *   npx tsx tools/oracle/parity-report.ts --write    # also update the baseline
 *
 * Goldens: tests/fixtures/oracle/golden/<name>.oracle.ndjson.gz (recorded by
 * tools/oracle/run-oracle-scenario.sh from tests/fixtures/oracle/scenarios/<name>.json).
 * Baseline: tests/fixtures/oracle/golden/parity-baseline.json, consumed by
 * tests/oracle/golden-parity.test.ts (which fails if any scenario regresses).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { loadReplicaEnvironment, loadScenarioFile, runReplica, type ReplicaEnvironment } from './lib/replica.ts'
import { diffTraces, formatDivergence, parseTrace, type DiffOptions, type Divergence } from './lib/trace-diff.ts'

export const REPO = resolve(import.meta.dirname, '../..')
export const GOLDEN_DIR = join(REPO, 'tests/fixtures/oracle/golden')
export const SCENARIO_DIR = join(REPO, 'tests/fixtures/oracle/scenarios')
export const BASELINE_PATH = join(GOLDEN_DIR, 'parity-baseline.json')

/**
 * Comparison policy shared by the report and the test. Frame 1 is skipped (the
 * original adds the player during frame 2); missiles (t3) are compared once the
 * replica models D2 missile units 1:1.
 */
export const PARITY_DIFF_OPTIONS: DiffOptions = { types: [0, 1], fromFrame: 2, context: 3 }

export interface ParityRow {
  name: string
  frames: number
  /** First divergent frame, or frames + 1 when the whole run matches. */
  firstDivergenceFrame: number
  divergence: Divergence | null
  summary: string
}

export function goldenNames(): string[] {
  return readdirSync(GOLDEN_DIR)
    .filter((f) => f.endsWith('.oracle.ndjson.gz'))
    .map((f) => f.replace(/\.oracle\.ndjson\.gz$/, ''))
    .sort()
}

export function parityForScenario(name: string, env: ReplicaEnvironment): ParityRow {
  const scenario = loadScenarioFile(join(SCENARIO_DIR, `${name}.json`))
  const oracle = parseTrace(gunzipSync(readFileSync(join(GOLDEN_DIR, `${name}.oracle.ndjson.gz`))).toString('utf8'))
  const replica = parseTrace(runReplica(scenario, env, { repoRoot: REPO }).lines.join('\n'))
  const res = diffTraces(oracle, replica, PARITY_DIFF_OPTIONS)
  const d = res.firstDivergence
  return {
    name,
    frames: scenario.frames,
    firstDivergenceFrame: d ? d.frame : scenario.frames + 1,
    divergence: d,
    summary: formatDivergence(d, oracle.header, replica.header).split('\n').slice(0, 2).join(' | '),
  }
}

export function readBaseline(): Record<string, number> {
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, number>
}

async function main(): Promise<void> {
  const env = await loadReplicaEnvironment({ packsDir: process.env.D2_ACT_PACKS_DIR ?? 'public/act-packs/tiles' })
  const rows = goldenNames().map((n) => parityForScenario(n, env))
  for (const r of rows) {
    const pct = (((r.firstDivergenceFrame - 1) / r.frames) * 100).toFixed(1)
    process.stdout.write(`${r.name.padEnd(28)} matched ${String(r.firstDivergenceFrame - 1).padStart(5)}/${r.frames} frames (${pct}%)  ${r.summary}\n`)
  }
  if (process.argv.includes('--write')) {
    const out: Record<string, number> = {}
    for (const r of rows) out[r.name] = r.firstDivergenceFrame
    writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2) + '\n')
    process.stdout.write(`baseline written: ${BASELINE_PATH}\n`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
