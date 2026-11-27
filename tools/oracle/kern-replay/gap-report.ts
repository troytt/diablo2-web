/**
 * Dynamic manifest + runtime execution gap report for K1/K2 replay scenarios:
 *   npx tsx tools/oracle/kern-replay/gap-report.ts [scenario...]
 *
 * Compares:
 *   1. `dllExecutedVas` (`tests/fixtures/oracle/k1/replay/<scenario>.coverage.ndjson.gz`): every manifest
 *      `D2Game` / `D2Common` entry executed on the server frame thread by the original 1.13c DLLs.
 *   2. `manifestGap` (`gaps`): DLL-executed VAs whose manifest status is `unported`.
 *   3. `runtimeExecGap`: DLL-executed VAs that were NOT actually executed at runtime by TS
 *      (`!tsExecutedSet.has(key)`) during `runReplay113c(scenario)`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { collectImportGraph, legacyReachable } from './import-graph.ts'
import { REPO_ROOT_113C, loadManifest113c, manifestKey113c, runReplay113c } from './replay-113c.ts'

export interface CoverageHit113c {
  readonly module: string
  readonly va: number
  readonly firstFrame: number
}

export interface Coverage113c {
  readonly from: number
  readonly to: number
  readonly entries: number
  readonly hit: number
  readonly otherThreadHits: number
  readonly hits: readonly CoverageHit113c[]
}

export function coveragePath113c(name: string): string {
  return join(REPO_ROOT_113C, 'tests/fixtures/oracle/k1/replay', `${name}.coverage.ndjson.gz`)
}

export function loadCoverage113c(name: string): Coverage113c {
  const lines = gunzipSync(readFileSync(coveragePath113c(name)))
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
  if (hits.length !== hdr.hit) throw new Error(`${name}: coverage header says ${hdr.hit} hits, file has ${hits.length}`)
  return {
    from: hdr.from,
    to: hdr.to,
    entries: hdr.entries,
    hit: hdr.hit,
    otherThreadHits: hdr.otherThreadHits,
    hits,
  }
}

export interface GapRow113c {
  readonly module: string
  readonly va: number
  readonly name: string
  readonly size: number
  readonly status: string
  readonly firstFrame: number
}

export interface RuntimeModuleCoverage113c {
  readonly dllExecuted: number
  /** DLL-executed VAs in this module that were ALSO executed at runtime by TS (`dll ∩ ts`). */
  readonly tsExecuted: number
  /** Total TS-executed VAs in this module across boot + stepped frames (including helpers not hit in DLL frame window). */
  readonly tsTotalExecuted: number
  readonly runtimeGap: number
  readonly runtimeGapBytes: number
}

export interface GapSummary113c {
  readonly scenario: string
  readonly coverage: Coverage113c
  readonly executed: Record<string, { total: number; done: number; gap: number; gapBytes: number }>
  readonly gaps: readonly GapRow113c[]
  /** Executed ported/diff-verified functions whose kernFile reaches legacy src/common or src/server. */
  readonly impure: readonly (GapRow113c & { readonly kernFile: string })[]
}

export interface ScenarioGap113c extends GapSummary113c {
  readonly dllExecutedVas: readonly string[]
  readonly tsExecutedVas: readonly string[]
  /** DLL-executed VAs whose manifest status is `unported`. */
  readonly manifestGap: readonly GapRow113c[]
  /** DLL-executed VAs (`dllExecutedVas`) NOT executed at runtime by TS (`!tsExecutedSet.has(key)`). */
  readonly runtimeExecGap: readonly GapRow113c[]
  readonly runtimeExecuted: Record<string, RuntimeModuleCoverage113c>
}

export interface ComputeGapsOptions113c {
  readonly tsExecutedVas?: ReadonlyArray<string> | ReadonlySet<string>
}

const DONE = new Set(['ported', 'diff-verified'])

export function computeGaps113c(name: string, opts?: ComputeGapsOptions113c): ScenarioGap113c {
  const coverage = loadCoverage113c(name)
  const manifest = loadManifest113c()
  const rawTsVas = opts?.tsExecutedVas !== undefined ? opts.tsExecutedVas : runReplay113c(name).tsExecutedVas
  const tsExecutedSet = new Set<string>(rawTsVas)
  const tsExecutedVas = [...tsExecutedSet].sort()

  const executed: GapSummary113c['executed'] = {}
  const runtimeMutable: Record<
    string,
    { dllExecuted: number; tsExecuted: number; tsTotalExecuted: number; runtimeGap: number; runtimeGapBytes: number }
  > = {
    D2Common: { dllExecuted: 0, tsExecuted: 0, tsTotalExecuted: 0, runtimeGap: 0, runtimeGapBytes: 0 },
    D2Game: { dllExecuted: 0, tsExecuted: 0, tsTotalExecuted: 0, runtimeGap: 0, runtimeGapBytes: 0 },
  }
  for (const key of tsExecutedVas) {
    const colon = key.indexOf(':')
    const mod = colon >= 0 ? key.slice(0, colon) : key
    let rm = runtimeMutable[mod]
    if (rm === undefined) {
      rm = { dllExecuted: 0, tsExecuted: 0, tsTotalExecuted: 0, runtimeGap: 0, runtimeGapBytes: 0 }
      runtimeMutable[mod] = rm
    }
    rm.tsTotalExecuted++
  }

  const dllExecutedVas: string[] = []
  const manifestGap: GapRow113c[] = []
  const runtimeExecGap: GapRow113c[] = []
  const impure: Array<GapRow113c & { kernFile: string }> = []
  const purity = new Map<string, boolean>()
  const isPure = (kf: string): boolean => {
    let v = purity.get(kf)
    if (v === undefined) {
      v = legacyReachable(collectImportGraph(REPO_ROOT_113C, [kf]), [kf]).length === 0
      purity.set(kf, v)
    }
    return v
  }

  for (const h of coverage.hits) {
    const key = manifestKey113c(h.module, h.va)
    dllExecutedVas.push(key)
    const f = manifest.get(key)
    if (f === undefined) throw new Error(`${name}: covered ${key} is not a manifest function`)

    let e = executed[h.module]
    if (e === undefined) {
      e = { total: 0, done: 0, gap: 0, gapBytes: 0 }
      executed[h.module] = e
    }
    e.total++

    let rm = runtimeMutable[h.module]
    if (rm === undefined) {
      rm = { dllExecuted: 0, tsExecuted: 0, tsTotalExecuted: 0, runtimeGap: 0, runtimeGapBytes: 0 }
      runtimeMutable[h.module] = rm
    }
    rm.dllExecuted++

    if (tsExecutedSet.has(key)) {
      rm.tsExecuted++
    } else {
      rm.runtimeGap++
      rm.runtimeGapBytes += f.size
      runtimeExecGap.push({
        module: h.module,
        va: h.va,
        name: f.name,
        size: f.size,
        status: f.status,
        firstFrame: h.firstFrame,
      })
    }

    if (DONE.has(f.status)) {
      e.done++
      if (typeof f.kernFile === 'string' && !isPure(f.kernFile)) {
        impure.push({
          module: h.module,
          va: h.va,
          name: f.name,
          size: f.size,
          status: f.status,
          firstFrame: h.firstFrame,
          kernFile: f.kernFile,
        })
      }
      continue
    }
    e.gap++
    e.gapBytes += f.size
    manifestGap.push({
      module: h.module,
      va: h.va,
      name: f.name,
      size: f.size,
      status: f.status,
      firstFrame: h.firstFrame,
    })
  }

  dllExecutedVas.sort()
  manifestGap.sort((a, b) => a.firstFrame - b.firstFrame || a.va - b.va)
  runtimeExecGap.sort((a, b) => a.firstFrame - b.firstFrame || a.va - b.va)
  impure.sort((a, b) => a.firstFrame - b.firstFrame || a.va - b.va)

  return {
    scenario: name,
    coverage,
    executed,
    gaps: manifestGap,
    impure,
    dllExecutedVas,
    tsExecutedVas,
    manifestGap,
    runtimeExecGap,
    runtimeExecuted: runtimeMutable,
  }
}

function hex(va: number): string {
  return `0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

export function renderScenarioGapMd113c(s: ScenarioGap113c): string {
  const c = s.coverage
  const lines = [
    `# Replay coverage & runtime execution gap list: ${s.scenario}`,
    '',
    'Generated by `npx tsx tools/oracle/kern-replay/gap-report.ts`; do not edit by hand.',
    '',
    `Source: \`tests/fixtures/oracle/k1/replay/${s.scenario}.coverage.ndjson.gz\` (original 1.13c DLL coverage,`,
    `frames F${c.from}..F${c.to}, ${c.hit}/${c.entries} manifest entries hit) vs live TS \`va-trace-113c\``,
    `execution across \`runReplay113c('${s.scenario}')\`.`,
    '',
    '| Module | DLL executed | TS executed (`dll ∩ ts`) | TS total hit | manifest unported | manifest gap bytes | runtime exec gap (`dll - ts`) | runtime gap bytes |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ]
  for (const mod of ['D2Common', 'D2Game']) {
    const e = s.executed[mod] ?? { total: 0, done: 0, gap: 0, gapBytes: 0 }
    const r = s.runtimeExecuted[mod] ?? {
      dllExecuted: 0,
      tsExecuted: 0,
      tsTotalExecuted: 0,
      runtimeGap: 0,
      runtimeGapBytes: 0,
    }
    lines.push(
      `| ${mod} | ${e.total} | ${r.tsExecuted} / ${r.dllExecuted} | ${r.tsTotalExecuted} | ${e.gap} | ${e.gapBytes} | ${r.runtimeGap} | ${r.runtimeGapBytes} |`,
    )
  }
  for (const mod of ['D2Common', 'D2Game']) {
    const rows = s.manifestGap.filter((g) => g.module === mod)
    lines.push(
      '',
      `## ${mod} Manifest Unported (${rows.length})`,
      '',
      '| first | VA | size | status | name |',
      '|---:|---|---:|---|---|',
    )
    for (const g of rows) {
      lines.push(`| F${g.firstFrame} | \`${hex(g.va)}\` | ${g.size} | ${g.status} | ${g.name} |`)
    }
  }
  for (const mod of ['D2Common', 'D2Game']) {
    const rows = s.runtimeExecGap.filter((g) => g.module === mod)
    lines.push(
      '',
      `## ${mod} Runtime Execution Gap — DLL Hit Not Executed by TS (${rows.length})`,
      '',
      '| first | VA | size | manifest status | name |',
      '|---:|---|---:|---|---|',
    )
    for (const g of rows) {
      lines.push(`| F${g.firstFrame} | \`${hex(g.va)}\` | ${g.size} | ${g.status} | ${g.name} |`)
    }
  }
  lines.push(
    '',
    `## Executed ported/diff-verified functions on an impure kernFile (${s.impure.length})`,
    '',
    '| first | module | VA | size | status | name | kernFile |',
    '|---:|---|---|---:|---|---|---|',
  )
  for (const g of s.impure) {
    lines.push(
      `| F${g.firstFrame} | ${g.module} | \`${hex(g.va)}\` | ${g.size} | ${g.status} | ${g.name} | \`${g.kernFile}\` |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}

export const gapMarkdown113c = renderScenarioGapMd113c

export function renderCombinedGapMd113c(summaries: readonly ScenarioGap113c[]): string {
  const lines = [
    '# Combined K1/K2 Replay Runtime Execution vs DLL Coverage Summary',
    '',
    'Generated by `npx tsx tools/oracle/kern-replay/gap-report.ts`; do not edit by hand.',
    '',
    '| Scenario | `tsExecutedD2GameVas / dllExecutedD2GameVas` | `D2Game` manifestUnported | `D2Game` runtimeExecGap | `tsExecutedD2CommonVas / dllExecutedD2CommonVas` | `D2Common` manifestUnported | `D2Common` runtimeExecGap |',
    '|---|---:|---:|---:|---:|---:|---:|',
  ]
  for (const s of summaries) {
    const eg = s.executed.D2Game ?? { total: 0, done: 0, gap: 0, gapBytes: 0 }
    const rg = s.runtimeExecuted.D2Game ?? {
      dllExecuted: 0,
      tsExecuted: 0,
      tsTotalExecuted: 0,
      runtimeGap: 0,
      runtimeGapBytes: 0,
    }
    const ec = s.executed.D2Common ?? { total: 0, done: 0, gap: 0, gapBytes: 0 }
    const rc = s.runtimeExecuted.D2Common ?? {
      dllExecuted: 0,
      tsExecuted: 0,
      tsTotalExecuted: 0,
      runtimeGap: 0,
      runtimeGapBytes: 0,
    }
    lines.push(
      `| \`${s.scenario}\` | \`${rg.tsExecuted} / ${rg.dllExecuted}\` (\`${rg.tsTotalExecuted}\` total TS) | ${eg.gap} | ${rg.runtimeGap} | \`${rc.tsExecuted} / ${rc.dllExecuted}\` (\`${rc.tsTotalExecuted}\` total TS) | ${ec.gap} | ${rc.runtimeGap} |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}

function main(argv: readonly string[]): void {
  const names =
    argv.length > 0
      ? argv
      : ['a1-town-walk', 'a1c-bloodmoor-fallen', 'a1-bloodmoor-melee', 'p52-dot-ticks', 'p52-item-defense']
  const dir = join(REPO_ROOT_113C, 'docs/oracle/k1-replay')
  mkdirSync(dir, { recursive: true })
  const summaries: ScenarioGap113c[] = []
  for (const n of names) {
    const s = computeGaps113c(n)
    summaries.push(s)
    writeFileSync(join(dir, `gap-${n}.md`), renderScenarioGapMd113c(s))
    const rg = s.runtimeExecuted.D2Game!
    const eg = s.executed.D2Game ?? { total: 0, done: 0, gap: 0, gapBytes: 0 }
    const rc = s.runtimeExecuted.D2Common!
    console.log(
      `${n}: D2Game tsExec=${rg.tsExecuted}/${rg.dllExecuted} (totalTS=${rg.tsTotalExecuted}, manifestUnported=${eg.gap}, runtimeExecGap=${rg.runtimeGap}); ` +
        `D2Common tsExec=${rc.tsExecuted}/${rc.dllExecuted} (runtimeExecGap=${rc.runtimeGap}); impure=${s.impure.length}`,
    )
  }
  if (argv.length === 0) {
    writeFileSync(join(dir, 'gap-summary.md'), renderCombinedGapMd113c(summaries))
  }
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main(process.argv.slice(2))
}
