/**
 * [K2] Interactive Visual Showcase — gap-convergence history generator
 * (`tools/oracle/k2-showcase-gen.ts`).
 *
 *   npx tsx tools/oracle/k2-showcase-gen.ts [--out showcase/k2/data/gap-history.json]
 *
 * Walks every commit reachable from `HEAD` that touched the K1/K2 replay gap reports
 * (`docs/oracle/k1-replay/gap-*.md`) or the coverage ratchet
 * (`tests/oracle/k2/replay-k2-coverage.test.ts`) and, for each commit, MEASURES the `D2Game`
 * runtime execution gap instead of trusting commit messages:
 *
 *   1. `measured` — the commit's `src/`, `tools/` and `tests/fixtures/oracle/` trees are extracted
 *      with `git archive` into a scratch directory under `os.tmpdir()`, and that commit's own
 *      `runReplay113c` is executed for the 5 K1/K2 scenarios. The union gap is
 *      `|dll_union − ts_union|` where `dll_union` is the union of DLL-executed `D2Game` VAs over
 *      the 5 recorded coverage fixtures and `ts_union` is the union of TS-executed `D2Game` VAs
 *      over the 5 live replays (the definition used by the coverage ratchet test).
 *   2. `reportMd` — the `D2Game` runtime-gap tables of the 5 `gap-<scenario>.md` files committed
 *      at that commit; their union is `|∪ (dll_s − ts_s)|` (per-scenario gaps), which is an upper
 *      bound of (1) and is reported separately because the two definitions differ.
 *   3. `ratchetCeiling` — `MAX_K1_K2_UNION_D2GAME_RUNTIME_EXEC_GAP` as written in the test file.
 *   4. `manifest` — `D2Game` / `D2Common` status tallies of `manifest-113c.json` at that commit.
 *
 * Nothing is hard-coded: every number in the emitted JSON is derived from the files of the commit.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const K2_SHOWCASE_SCENARIOS = [
  'a1-town-walk',
  'a1c-bloodmoor-fallen',
  'a1-bloodmoor-melee',
  'p52-dot-ticks',
  'p52-item-defense',
] as const

export const K2_GAP_HISTORY_PATHS = [
  'docs/oracle/k1-replay',
  'tests/oracle/k2/replay-k2-coverage.test.ts',
] as const

export const K2_GAP_HISTORY_SCHEMA = 'k2-showcase-gap-history/1'

export interface K2GapScenarioMeasure {
  readonly scenario: string
  readonly error: string | null
  readonly dllExecuted: number
  readonly tsExecutedInDll: number
  readonly gap: number
  readonly strictHorizon: number
  readonly lastGoldenFrame: number
  readonly zeroDivergence: boolean
}

export interface K2GapMeasure {
  readonly scenarios: readonly K2GapScenarioMeasure[]
  /** `|∪ dll_s|` over the scenarios that could be replayed. */
  readonly dllUnion: number
  /** `|dll_union ∩ ts_union|`. */
  readonly tsUnionInDll: number
  /** `|dll_union − ts_union|` — the ratchet definition of the union gap. */
  readonly unionGap: number
  /** `|∪ (dll_s − ts_s)|` — union of the per-scenario gaps (upper bound of `unionGap`). */
  readonly unionOfScenarioGaps: number
  readonly unionGapVas: readonly string[]
  readonly framesReplayed: number
  readonly allZeroDivergence: boolean
}

export interface K2GapReportMd {
  readonly perScenario: Readonly<Record<string, number | null>>
  /** `|∪ (dll_s − ts_s)|` parsed from the committed `gap-<scenario>.md` runtime-gap tables. */
  readonly unionOfScenarioGaps: number | null
}

export interface K2ManifestTally {
  readonly d2GameTotal: number
  readonly d2GameDiffVerified: number
  readonly d2GamePorted: number
  readonly d2GameUnported: number
  readonly d2CommonTotal: number
  readonly d2CommonDiffVerified: number
}

export interface K2GapHistoryPoint {
  readonly sha: string
  readonly shortSha: string
  readonly committedAt: string
  readonly subject: string
  readonly measured: K2GapMeasure | null
  readonly measureError: string | null
  readonly reportMd: K2GapReportMd
  readonly ratchetCeiling: number | null
  readonly manifest: K2ManifestTally | null
}

export interface K2GapHistoryFile {
  readonly schema: typeof K2_GAP_HISTORY_SCHEMA
  readonly generator: string
  readonly headSha: string
  readonly definitions: {
    readonly unionGap: string
    readonly unionOfScenarioGaps: string
  }
  readonly scenarios: readonly string[]
  readonly points: readonly K2GapHistoryPoint[]
}

const DEFAULT_REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

function git(rootDir: string, args: readonly string[]): string {
  return execFileSync('git', ['-C', rootDir, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function gitShowOrNull(rootDir: string, sha: string, path: string): string | null {
  try {
    return git(rootDir, ['show', `${sha}:${path}`])
  } catch {
    return null
  }
}

/** Parses the `## D2Game Runtime Execution Gap` VA table of one `gap-<scenario>.md`. */
export function parseD2GameRuntimeGapVas(md: string): string[] | null {
  const lines = md.split(/\r?\n/)
  const start = lines.findIndex((l) => l.startsWith('## D2Game Runtime Execution Gap'))
  if (start < 0) return null
  const vas: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!
    if (line.startsWith('## ')) break
    const m = /^\|\s*F\d+\s*\|\s*`(0x[0-9A-Fa-f]{8})`/.exec(line)
    if (m) vas.push(m[1]!.toUpperCase().replace('0X', '0x'))
  }
  return vas
}

export function tallyManifestJson(text: string): K2ManifestTally {
  const parsed = JSON.parse(text) as { functions: Array<{ module: string; status: string }> }
  const t = {
    d2GameTotal: 0,
    d2GameDiffVerified: 0,
    d2GamePorted: 0,
    d2GameUnported: 0,
    d2CommonTotal: 0,
    d2CommonDiffVerified: 0,
  }
  for (const f of parsed.functions) {
    if (f.module === 'D2Game') {
      t.d2GameTotal++
      if (f.status === 'diff-verified') t.d2GameDiffVerified++
      else if (f.status === 'ported') t.d2GamePorted++
      else t.d2GameUnported++
    } else if (f.module === 'D2Common') {
      t.d2CommonTotal++
      if (f.status === 'diff-verified') t.d2CommonDiffVerified++
    }
  }
  return t
}

/**
 * Probe executed with the CHECKED-OUT commit's own replay tooling (cwd = extracted tree).
 * Prints exactly one `K2GAP_JSON:` line.
 */
const PROBE_SOURCE = `
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const names = JSON.parse(process.argv[2])
const replay = await import('./tools/oracle/kern-replay/replay-113c.ts')
const keyOf = (module, va) => module + ':0x' + (va >>> 0).toString(16).toUpperCase().padStart(8, '0')
function dllD2GameVas(name) {
  const text = gunzipSync(readFileSync('tests/fixtures/oracle/k1/replay/' + name + '.coverage.ndjson.gz')).toString('utf8')
  const out = new Set()
  for (const line of text.split('\\n')) {
    if (line.trim() === '') continue
    const rec = JSON.parse(line)
    if (rec.k === 'hdr' || (rec.m ?? rec.module) !== 'D2Game' || rec.va === undefined) continue
    out.add(keyOf('D2Game', typeof rec.va === 'string' ? Number.parseInt(rec.va, 16) : rec.va))
  }
  return out
}
const dllUnion = new Set(), tsUnion = new Set(), scenarioGapUnion = new Set()
const scenarios = []
let framesReplayed = 0
let allZero = true
for (const name of names) {
  try {
    const dll = dllD2GameVas(name)
    const res = replay.runReplay113c(name)
    if (!Array.isArray(res.tsExecutedVas)) throw new Error('runReplay113c has no tsExecutedVas at this commit')
    const ts = new Set(res.tsExecutedVas.filter((k) => k.startsWith('D2Game:')))
    let gap = 0
    for (const k of dll) {
      dllUnion.add(k)
      if (!ts.has(k)) { gap++; scenarioGapUnion.add(k) }
    }
    for (const k of ts) tsUnion.add(k)
    const zero = res.bootCheck === null && res.firstStrictDivergence === null && res.strictHorizon === res.lastGoldenFrame
    if (!zero) allZero = false
    framesReplayed += res.lastGoldenFrame
    scenarios.push({ scenario: name, error: null, dllExecuted: dll.size, tsExecutedInDll: dll.size - gap, gap,
      strictHorizon: res.strictHorizon, lastGoldenFrame: res.lastGoldenFrame, zeroDivergence: zero })
  } catch (e) {
    allZero = false
    scenarios.push({ scenario: name, error: String(e && e.message ? e.message : e).slice(0, 240), dllExecuted: 0,
      tsExecutedInDll: 0, gap: 0, strictHorizon: 0, lastGoldenFrame: 0, zeroDivergence: false })
  }
}
const unionGapVas = [...dllUnion].filter((k) => !tsUnion.has(k)).sort()
console.log('K2GAP_JSON:' + JSON.stringify({ scenarios, dllUnion: dllUnion.size, tsUnionInDll: dllUnion.size - unionGapVas.length,
  unionGap: unionGapVas.length, unionOfScenarioGaps: scenarioGapUnion.size, unionGapVas, framesReplayed, allZeroDivergence: allZero }))
`

function sanitizeError(text: string, scratch: string): string {
  return text.split(scratch).join('<scratch>').replace(/\s+/g, ' ').trim().slice(0, 300)
}

/** Extracts `sha` into a scratch tree and runs that commit's own replay tooling. */
export function measureCommit(
  rootDir: string,
  sha: string,
): { measured: K2GapMeasure | null; error: string | null } {
  const scratch = mkdtempSync(join(tmpdir(), 'k2-gap-'))
  try {
    const archive = spawnSync(
      'sh',
      [
        '-c',
        'git -C "$1" archive --format=tar "$2" src tools tests/fixtures/oracle package.json tsconfig.json | tar -x -C "$3"',
        'sh',
        rootDir,
        sha,
        scratch,
      ],
      { encoding: 'utf8' },
    )
    if (archive.status !== 0) {
      return { measured: null, error: sanitizeError(`git archive failed: ${archive.stderr}`, scratch) }
    }
    symlinkSync(realpathSync(join(rootDir, 'node_modules')), join(scratch, 'node_modules'), 'dir')
    writeFileSync(join(scratch, '__k2-gap-probe.mts'), PROBE_SOURCE)
    const run = spawnSync(
      join(scratch, 'node_modules/.bin/tsx'),
      ['__k2-gap-probe.mts', JSON.stringify(K2_SHOWCASE_SCENARIOS)],
      { cwd: scratch, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 },
    )
    const line = (run.stdout ?? '').split('\n').find((l) => l.startsWith('K2GAP_JSON:'))
    if (!line) {
      return { measured: null, error: sanitizeError(`probe produced no result: ${run.stderr ?? ''}`, scratch) }
    }
    const measured = JSON.parse(line.slice('K2GAP_JSON:'.length)) as K2GapMeasure
    if (measured.scenarios.every((s) => s.error !== null)) {
      return { measured: null, error: sanitizeError(measured.scenarios[0]?.error ?? 'no scenario replayed', scratch) }
    }
    return { measured, error: null }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

export function readReportMdAt(rootDir: string, sha: string): K2GapReportMd {
  const perScenario: Record<string, number | null> = {}
  const union = new Set<string>()
  let any = false
  for (const name of K2_SHOWCASE_SCENARIOS) {
    const md = gitShowOrNull(rootDir, sha, `docs/oracle/k1-replay/gap-${name}.md`)
    const vas = md === null ? null : parseD2GameRuntimeGapVas(md)
    perScenario[name] = vas === null ? null : vas.length
    if (vas !== null) {
      any = true
      for (const v of vas) union.add(v)
    }
  }
  return { perScenario, unionOfScenarioGaps: any ? union.size : null }
}

export function generateGapHistory(
  rootDir: string = DEFAULT_REPO_ROOT,
  log: (msg: string) => void = () => {},
): K2GapHistoryFile {
  const headSha = git(rootDir, ['rev-parse', 'HEAD']).trim()
  const shas = git(rootDir, ['rev-list', '--reverse', '--topo-order', 'HEAD', '--', ...K2_GAP_HISTORY_PATHS])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const points: K2GapHistoryPoint[] = []
  for (const sha of shas) {
    const [committedAt = '', subject = ''] = git(rootDir, ['show', '-s', '--format=%cI%x09%s', sha]).trim().split('\t')
    const reportMd = readReportMdAt(rootDir, sha)
    const testText = gitShowOrNull(rootDir, sha, 'tests/oracle/k2/replay-k2-coverage.test.ts')
    const ceil = testText === null ? null : /MAX_K1_K2_UNION_D2GAME_RUNTIME_EXEC_GAP\s*=\s*(\d+)/.exec(testText)
    const manifestText = gitShowOrNull(rootDir, sha, 'tools/oracle/callgraph/manifest-113c.json')
    let manifest: K2ManifestTally | null = null
    try {
      manifest = manifestText === null ? null : tallyManifestJson(manifestText)
    } catch {
      manifest = null
    }
    const { measured, error } = measureCommit(rootDir, sha)
    log(
      `${sha.slice(0, 8)} measured=${measured ? `${measured.unionGap}/${measured.dllUnion} (∪scenario=${measured.unionOfScenarioGaps})` : `n/a (${error})`} ` +
        `md∪=${reportMd.unionOfScenarioGaps ?? 'n/a'} ceil=${ceil ? ceil[1] : 'n/a'}`,
    )
    points.push({
      sha,
      shortSha: sha.slice(0, 8),
      committedAt,
      subject,
      measured,
      measureError: error,
      reportMd,
      ratchetCeiling: ceil ? Number.parseInt(ceil[1]!, 10) : null,
      manifest,
    })
  }
  return {
    schema: K2_GAP_HISTORY_SCHEMA,
    generator: 'npx tsx tools/oracle/k2-showcase-gen.ts',
    headSha,
    definitions: {
      unionGap:
        '|dll_union − ts_union|: D2Game VAs executed by the original DLL in any of the 5 scenarios and executed by TS in none of the 5 live replays',
      unionOfScenarioGaps:
        '|∪ (dll_s − ts_s)|: D2Game VAs missing from TS in at least one scenario (upper bound of the union gap)',
    },
    scenarios: [...K2_SHOWCASE_SCENARIOS],
    points,
  }
}

function main(argv: readonly string[]): void {
  const outIdx = argv.indexOf('--out')
  const out = resolve(
    DEFAULT_REPO_ROOT,
    outIdx >= 0 && argv[outIdx + 1] ? argv[outIdx + 1]! : 'showcase/k2/data/gap-history.json',
  )
  const history = generateGapHistory(DEFAULT_REPO_ROOT, (m) => console.log(m))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify(history, null, 1)}\n`)
  console.log(`wrote ${history.points.length} commits`)
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main(process.argv.slice(2))
}
