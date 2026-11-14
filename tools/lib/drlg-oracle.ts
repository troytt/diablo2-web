/**
 * Node-side helpers for the DRLG port's differential tooling (tools/drlg-diff.ts and
 * tests/drlg-act1-oracle.test.ts):
 *   - fsDrlgSource: a DrlgDataSource over the oracle data directory, with the exact path mapping of
 *     tools/d2moo-oracle/src/stubs.cpp ('\\' -> '/', lower case, under <data>/mpq and <data>/tables),
 *     so the port and the native oracle read byte-identical inputs;
 *   - runOracle: runs the native D2MOO oracle binary and parses its schema-2 JSON (and RNG trace);
 *   - firstDiff: structural comparison reporting the first differing JSON path.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { DrlgDataSource, DrlgTableName } from '../../src/common/drlg/drlg-tables.ts'
import type { DrlgDump } from '../../src/common/drlg/drlg-dump.ts'

export const ORACLE_DIR = resolve(import.meta.dirname, '../../tools/d2moo-oracle')
export const ORACLE_BIN = join(ORACLE_DIR, 'build', 'd2moo-oracle')
export const ORACLE_DATA = join(ORACLE_DIR, 'data')

/** Same layout as the oracle's LoadBinTable / ARCHIVE_AllocateBufferAndReadFile stubs. */
export function fsDrlgSource(dataDir: string = ORACLE_DATA): DrlgDataSource {
  if (!existsSync(join(dataDir, 'tables'))) {
    throw new Error(`${dataDir}/tables is missing: run npx tsx src/baker/extract/extract-d2moo-tables.ts samples/d2 ${dataDir}`)
  }
  return {
    readTable(name: DrlgTableName): Uint8Array {
      return new Uint8Array(readFileSync(join(dataDir, 'tables', `${name.toLowerCase()}.bin`)))
    },
    readFile(path: string): Uint8Array {
      const rel = path.replace(/\\/g, '/').toLowerCase()
      return new Uint8Array(readFileSync(join(dataDir, 'mpq', rel)))
    },
  }
}

export interface OracleRunOptions {
  readonly seed: number
  /** Empty: act stage only. */
  readonly levels: readonly number[]
  readonly act?: number
  readonly difficulty?: number
  readonly isolated?: boolean
  readonly trace?: boolean
  readonly dataDir?: string
}

export interface OracleRunResult {
  readonly doc: DrlgDump
  readonly trace: string[] | null
}

export function runOracle(opts: OracleRunOptions): OracleRunResult {
  if (!existsSync(ORACLE_BIN)) throw new Error(`${ORACLE_BIN} is missing: run ./tools/d2moo-oracle/build.sh`)
  const dir = mkdtempSync(join(tmpdir(), 'd2moo-oracle-'))
  try {
    const out = join(dir, 'out.json')
    const tracePath = join(dir, 'trace.txt')
    const args = ['--data', opts.dataDir ?? ORACLE_DATA, '--seed', `0x${(opts.seed >>> 0).toString(16)}`, '--out', out]
    if (opts.levels.length > 0) args.push('--levels', opts.levels.join(','))
    if (opts.act !== undefined) args.push('--act', String(opts.act))
    if (opts.difficulty !== undefined) args.push('--difficulty', String(opts.difficulty))
    if (opts.isolated) args.push('--isolated')
    if (opts.trace) args.push('--trace', tracePath)
    execFileSync(ORACLE_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
    const doc = JSON.parse(readFileSync(out, 'utf8')) as DrlgDump
    const trace = opts.trace ? readFileSync(tracePath, 'utf8').split('\n').filter(l => l.length > 0) : null
    return { doc, trace }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export interface JsonDiff {
  readonly path: string
  readonly expected: unknown
  readonly actual: unknown
}

const describe = (v: unknown): string => {
  const s = JSON.stringify(v)
  return s === undefined ? 'undefined' : s.length > 200 ? `${s.slice(0, 200)}...` : s
}

/** First difference between two JSON values (arrays by index, objects by key union), or null. */
export function firstDiff(expected: unknown, actual: unknown, path = '$'): JsonDiff | null {
  if (expected === actual) return null
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const n = Math.min(expected.length, actual.length)
    for (let i = 0; i < n; i += 1) {
      const d = firstDiff(expected[i], actual[i], `${path}[${i}]`)
      if (d) return d
    }
    if (expected.length !== actual.length) {
      return { path: `${path}.length`, expected: expected.length, actual: actual.length }
    }
    return null
  }
  if (expected && actual && typeof expected === 'object' && typeof actual === 'object' && !Array.isArray(expected) && !Array.isArray(actual)) {
    const e = expected as Record<string, unknown>
    const a = actual as Record<string, unknown>
    const keys = [...new Set([...Object.keys(e), ...Object.keys(a)])]
    for (const k of keys) {
      if (!(k in e)) return { path: `${path}.${k}`, expected: undefined, actual: a[k] }
      if (!(k in a)) return { path: `${path}.${k}`, expected: e[k], actual: undefined }
      const d = firstDiff(e[k], a[k], `${path}.${k}`)
      if (d) return d
    }
    return null
  }
  return { path, expected, actual }
}

export function formatDiff(d: JsonDiff): string {
  return `${d.path}: expected ${describe(d.expected)}, got ${describe(d.actual)}`
}

/** Index of the first differing trace line and a few lines of context from both sides. */
export function firstTraceDivergence(expected: readonly string[], actual: readonly string[], context = 6): string | null {
  const n = Math.min(expected.length, actual.length)
  let i = 0
  while (i < n && expected[i] === actual[i]) i += 1
  if (i === n && expected.length === actual.length) return null
  let ctx = ''
  for (let j = i - 1; j >= 0; j -= 1) {
    if (expected[j]!.startsWith('# ')) {
      ctx = expected[j]!
      break
    }
  }
  const lo = Math.max(0, i - context)
  const lines = [`first RNG divergence at trace line ${i + 1} (context "${ctx.slice(2)}"):`]
  for (let j = lo; j < i; j += 1) lines.push(`    ${expected[j]}`)
  lines.push(`  oracle: ${expected[i] ?? '<end of trace>'}`)
  lines.push(`  port:   ${actual[i] ?? '<end of trace>'}`)
  return lines.join('\n')
}
