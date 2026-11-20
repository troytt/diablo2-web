/**
 * P5.3 formula goldens: TS formula implementations vs vectors produced by the
 * original 1.13c DLL functions (tools/oracle/fn-sweep.ts + tools/oracle/hook/fnharness.dll.c).
 * Runs without Wine. Known mismatch classes are `it.fails` with the mismatch id
 * documented in docs/oracle/P5-formula-sweep.md, so the suite stays green while the
 * debt stays visible: fixing a class makes its `it.fails` fail -> regenerate goldens.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NODE_MPQ_DIR, getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import type { D2DataRegistry } from '../../src/common/data/data-registry.ts'
import { envFromHeader, evalLine, type FnFileHeader, type FnLine } from '../../tools/oracle/lib/fn-golden.ts'

const DIR = new URL('../fixtures/oracle/formulas/', import.meta.url)
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => f.endsWith('.ndjson')).sort() : []
const NEEDS_DATA = new Set(['skills', 'skilleval', 'stats', 'block', 'resist', 'dmg'])
const HAVE_DATA = existsSync(DEFAULT_NODE_MPQ_DIR)
const TIMEOUT = 600_000

let reg: D2DataRegistry | undefined
function registry(): D2DataRegistry {
  reg ??= getSharedDataRegistry()
  return reg
}

/** Oracle values that are numbers (a faulting oracle call is recorded as a string). */
function numericPairs(l: FnLine, ts: readonly number[]): { oracle: number[]; ts: number[] } {
  const o: number[] = []
  const t: number[] = []
  l.v.forEach((v, i) => {
    if (typeof v === 'number') {
      o.push(v)
      const x = ts[i] ?? NaN
      t.push(x === 0 ? 0 : x) // -0 from JS arithmetic equals the oracle's 0
    }
  })
  return { oracle: o, ts: t }
}

function describeLine(l: FnLine): string {
  const { v: _v, mm: _mm, ...rest } = l
  return JSON.stringify(rest)
}

for (const file of files) {
  const text = readFileSync(new URL(file, DIR), 'utf8').trim().split('\n')
  const header = JSON.parse(text[0]!) as FnFileHeader
  const cat = header.cat ?? file.replace('.ndjson', '')
  const lines = text.slice(1).map(t => JSON.parse(t) as FnLine)
  const env = envFromHeader(header)
  const groups = new Map<string, FnLine[]>()
  for (const l of lines) {
    const key = l.mm?.length ? `mm\t${l.mm[0]}` : `ok\t${l.f}`
    const g = groups.get(key) ?? []
    g.push(l)
    groups.set(key, g)
  }
  describe.skipIf(NEEDS_DATA.has(cat) && !HAVE_DATA)(`1.13c formula goldens: ${cat}`, () => {
    for (const [key, ls] of [...groups].sort()) {
      const [kind, name] = key.split('\t') as [string, string]
      const check = (): void => {
        for (const l of ls) {
          const { oracle, ts } = numericPairs(l, evalLine(registry(), env, l))
          expect(ts, describeLine(l)).toEqual(oracle)
        }
      }
      if (kind === 'ok') it(`${name} agrees with the oracle (${ls.length} lines)`, check, TIMEOUT)
      else it.fails(`${name}: known mismatch (docs/oracle/P5-formula-sweep.md, ${ls.length} lines)`, check, TIMEOUT)
    }
  })
}

describe('1.13c formula goldens', () => {
  it('has golden files', () => {
    expect(files.length).toBeGreaterThan(0)
  })
})
