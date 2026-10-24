/**
 * Differential gate of the DRLG port: runs the native D2MOO oracle and the TypeScript port on the
 * same game seeds and compares their schema-2 dumps stage by stage (drlg -> act -> per level
 * levelGrid -> rooms -> maps -> warp -> activation). On a mismatch both sides are re-run with the RNG
 * trace enabled and the first diverging seed operation is printed.
 *
 * Seeds are drawn at run time (crypto) unless given explicitly, so the gate cannot be satisfied by
 * special-casing known seeds.
 *
 * Usage:
 *   npx tsx scripts/drlg-diff.ts [--levels 2-7,17,39] [--seeds 32 | --seed 0x12345678,0x5eed0100]
 *                                [--difficulty 0] [--isolated] [--data tools/d2moo-oracle/data]
 *                                [--stop-on-first] [--report out.json] [--no-activation] [--trace-check]
 * Without --levels only the act stage (DRLG_AllocDrlg: layout, links, town) is compared.
 * --no-activation compares every stage except room activation (the port does not activate rooms).
 * --trace-check always traces both sides and also requires the complete RNG traces to be identical,
 *   which covers seed streams that are not dumped (e.g. the maze levels behind warps that room
 *   activation initialises through sub_6FD77BB0 -> DRLG_InitLevel).
 */

import { webcrypto } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { createDrlgEnv } from '../src/common/drlg/drlg-source.ts'
import { loadDrlgTables } from '../src/common/drlg/drlg-tables.ts'
import { DrlgTraceWriter, dumpAct1, type DrlgDump } from '../src/common/drlg/drlg-dump.ts'
import { firstDiff, firstTraceDivergence, formatDiff, fsDrlgSource, ORACLE_DATA, runOracle } from './lib/drlg-oracle.ts'

interface Args {
  act: number | undefined
  levels: number[]
  seeds: number[]
  difficulty: number
  isolated: boolean
  dataDir: string
  stopOnFirst: boolean
  report: string | null
  /** Compare every stage except `activation` (the port then skips room activation). */
  noActivation: boolean
  /** Trace both sides on every seed and require identical RNG traces. */
  traceCheck: boolean
}

const ACT_DEFAULT_OUTDOOR_LEVELS: Record<number, number[]> = {
  0: [2, 3, 4, 5, 6, 7, 17, 26, 27, 28, 32, 33, 39],
  1: [41, 42, 43, 44, 45, 46],
  2: [76, 77, 78, 79, 80, 81, 82, 83],
  3: [104, 105, 106, 108],
  4: [110, 111, 112, 117, 134],
}

function parseLevels(spec: string): number[] {
  const out: number[] = []
  for (const part of spec.split(',')) {
    if (!part) continue
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim())
    if (!m) throw new Error(`bad --levels item "${part}"`)
    const a = Number(m[1])
    const b = m[2] !== undefined ? Number(m[2]) : a
    if (b < a) throw new Error(`bad --levels range "${part}"`)
    for (let i = a; i <= b; i += 1) out.push(i)
  }
  return out
}

function parseArgs(argv: string[]): Args {
  const args: Args = { act: undefined, levels: [], seeds: [], difficulty: 0, isolated: false, dataDir: ORACLE_DATA, stopOnFirst: false, report: null, noActivation: false, traceCheck: false }
  let nRandom = 0
  const positionals: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!
    const next = (): string => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`missing value for ${a}`)
      return v
    }
    if (a === '--act') args.act = Number(next())
    else if (a === '--levels') args.levels = parseLevels(next())
    else if (a === '--seeds') nRandom = Number(next())
    else if (a === '--seed') args.seeds.push(...next().split(',').filter(Boolean).map(s => Number(s) >>> 0))
    else if (a === '--difficulty') args.difficulty = Number(next())
    else if (a === '--isolated') args.isolated = true
    else if (a === '--data') args.dataDir = next()
    else if (a === '--stop-on-first') args.stopOnFirst = true
    else if (a === '--report') args.report = next()
    else if (a === '--no-activation') args.noActivation = true
    else if (a === '--trace-check') args.traceCheck = true
    else if (!a.startsWith('-')) positionals.push(a)
    else throw new Error(`unknown argument ${a}`)
  }
  if (positionals.length > 0) {
    const posAct = Number(positionals[0])
    const actIdx = posAct >= 1 && posAct <= 5 ? posAct - 1 : posAct
    if (!Number.isInteger(actIdx) || actIdx < 0 || actIdx > 4) throw new Error(`bad positional act "${positionals[0]}"`)
    args.act = actIdx
    if (args.levels.length === 0) args.levels = [...ACT_DEFAULT_OUTDOOR_LEVELS[actIdx]!]
    if (positionals.length >= 2 && nRandom === 0 && args.seeds.length === 0) {
      nRandom = Number(positionals[1])
    }
  }
  if (args.act !== undefined && (!Number.isInteger(args.act) || args.act < 0 || args.act > 4)) {
    throw new Error('--act must be 0..4')
  }
  if (!Number.isInteger(nRandom) || nRandom < 0) throw new Error('--seeds must be a non-negative integer')
  if (nRandom > 0) args.seeds.push(...webcrypto.getRandomValues(new Uint32Array(nRandom)))
  if (args.seeds.length === 0) throw new Error('give --seeds N or --seed X')
  if (![0, 1, 2].includes(args.difficulty)) throw new Error('--difficulty must be 0..2')
  return args
}

interface SeedResult {
  seed: string
  ok: boolean
  stage?: string
  diff?: string
  trace?: string | null
  error?: string
}

/** Stage-ordered comparison: the first differing stage is the one to fix first. */
function compareDumps(expected: DrlgDump, actual: DrlgDump, noActivation: boolean): { stage: string; diff: string } | null {
  const stages: [string, unknown, unknown][] = [
    ['drlg', expected.drlg, actual.drlg],
    ['act', expected.act, actual.act],
  ]
  const keys = ['id', 'levelGrid', 'nRooms', 'rooms', 'maps', 'levelSeedAfterRooms', 'warp', 'activation'] as const
  const n = Math.max(expected.levels.length, actual.levels.length)
  for (let i = 0; i < n; i += 1) {
    const e = expected.levels[i]
    const a = actual.levels[i]
    const id = e?.id ?? a?.id
    for (const key of keys) {
      if (noActivation && key === 'activation') continue
      stages.push([`L${id}.${key}`, e?.[key], a?.[key]])
    }
  }
  for (const [stage, e, a] of stages) {
    const d = firstDiff(e, a, `$.${stage}`)
    if (d) return { stage, diff: formatDiff(d) }
  }
  return null
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const source = fsDrlgSource(args.dataDir)
  const tables = loadDrlgTables(source)
  const nonOutdoor = args.levels.filter(id => tables.levelDefs[id]?.dwDrlgType !== 3)
  if (nonOutdoor.length > 0) {
    console.log(`drlg-diff: skipping non-outdoor (dwDrlgType != 3) levels [${nonOutdoor.join(',')}]`)
    args.levels = args.levels.filter(id => tables.levelDefs[id]?.dwDrlgType === 3)
  }
  const results: SeedResult[] = []
  const t0 = Date.now()
  console.log(`drlg-diff: ${args.seeds.length} seed(s), levels [${args.levels.join(',') || 'act only'}], difficulty ${args.difficulty}${args.isolated ? ', isolated' : ''}${args.noActivation ? ', no activation' : ''}${args.traceCheck ? ', trace check' : ''}`)

  const runPort = (seed: number, trace: DrlgTraceWriter | undefined): DrlgDump =>
    dumpAct1(createDrlgEnv(source, tables), seed, args.levels, {
      ...(args.act !== undefined ? { act: args.act } : {}),
      difficulty: args.difficulty,
      isolated: args.isolated,
      actOnly: args.levels.length === 0,
      skipActivation: args.noActivation,
      ...(trace ? { trace } : {}),
    })

  for (const seed of args.seeds) {
    const seedHex = `0x${seed.toString(16).padStart(8, '0')}`
    const runOpts = {
      seed,
      levels: args.levels,
      ...(args.act !== undefined ? { act: args.act } : {}),
      difficulty: args.difficulty,
      isolated: args.isolated,
      dataDir: args.dataDir,
    }
    let result: SeedResult
    try {
      const oracleRun = runOracle({ ...runOpts, trace: args.traceCheck })
      const expected = oracleRun.doc
      const writer = args.traceCheck ? new DrlgTraceWriter() : undefined
      let actual: DrlgDump | null = null
      let portError: unknown = null
      try {
        actual = runPort(seed, writer)
      } catch (e) {
        portError = e
      }
      let cmp = actual ? compareDumps(expected, actual, args.noActivation) : { stage: 'port', diff: `port threw: ${String(portError instanceof Error ? portError.stack : portError)}` }
      if (!cmp && args.traceCheck) {
        const divergence = firstTraceDivergence(oracleRun.trace!, writer!.lines)
        if (divergence) cmp = { stage: 'trace', diff: 'dumps are identical but the RNG traces differ' }
      }
      if (!cmp) {
        result = { seed: seedHex, ok: true }
      } else if (args.traceCheck) {
        result = { seed: seedHex, ok: false, stage: cmp.stage, diff: cmp.diff, trace: firstTraceDivergence(oracleRun.trace!, writer!.lines) }
      } else {
        // Re-run both sides with the RNG trace to locate the first diverging seed operation.
        const oracleTrace = runOracle({ ...runOpts, trace: true }).trace!
        const traceWriter = new DrlgTraceWriter()
        try {
          runPort(seed, traceWriter)
        } catch {
          // The trace up to the exception is still useful.
        }
        result = { seed: seedHex, ok: false, stage: cmp.stage, diff: cmp.diff, trace: firstTraceDivergence(oracleTrace, traceWriter.lines) }
      }
    } catch (e) {
      result = { seed: seedHex, ok: false, stage: 'oracle', error: String(e instanceof Error ? e.message : e) }
    }
    results.push(result)
    if (result.ok) {
      process.stdout.write('.')
    } else {
      process.stdout.write('\n')
      console.log(`seed ${seedHex}: MISMATCH in ${result.stage}`)
      if (result.diff) console.log(`  ${result.diff}`)
      if (result.error) console.log(`  ${result.error}`)
      if (result.trace) console.log(result.trace.replace(/^/gm, '  '))
      else if (result.trace === null) console.log('  (RNG traces are identical: the divergence is not in a seed operation)')
      if (args.stopOnFirst) break
    }
  }

  const failed = results.filter(r => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} seeds identical (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  if (args.report) {
    writeFileSync(args.report, JSON.stringify({ levels: args.levels, difficulty: args.difficulty, isolated: args.isolated, results }, null, 1))
  }
  process.exit(failed.length === 0 ? 0 : 1)
}

main()
