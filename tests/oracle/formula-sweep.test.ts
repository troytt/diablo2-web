/**
 * Plan §4.1 #2 Formula Sweep Gate (`npx vitest run tests/oracle/formula-sweep.test.ts`).
 *
 * Verifies 1.13c DLL-recorded formula golden suites (`tests/fixtures/oracle/formulas/*.ndjson`,
 * collected via `tools/oracle/fn-sweep.ts` + `tools/oracle/hook/fnharness.dll.c` `op 1..101`)
 * with zero regressions, plus `d2kern-113c` `mulDiv113c` (`0x6FD511E0` / `0x6FC214D0`) parity on the
 * `primitives.ndjson` DLL golden lines.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NODE_MPQ_DIR, getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import type { D2DataRegistry } from '../../src/common/data/data-registry.ts'
import { mulDiv113c } from '../../src/d2kern-113c/common/int-math.ts'
import {
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../../src/d2kern-113c/common/statlist.ts'
import { Heap113c } from '../../src/d2kern-113c/mem/heap.ts'
import { D2UnitStrc, D2UnitStrc_SIZE } from '../../src/d2kern-113c/mem/layout.generated.ts'
import { seedInit, seedNext, seedRoll } from '../../src/d2kern-113c/prng.ts'
import { envFromHeader, evalLine, type FnFileHeader, type FnLine } from '../../tools/oracle/lib/fn-golden.ts'

const DIR = new URL('../fixtures/oracle/formulas/', import.meta.url)
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.ndjson')).sort() : []
const HAVE_DATA = existsSync(DEFAULT_NODE_MPQ_DIR)
const TIMEOUT = 600_000

let reg: D2DataRegistry | undefined
function registry(): D2DataRegistry {
  reg ??= getSharedDataRegistry()
  return reg
}

function numericPairs(l: FnLine, ts: readonly number[]): { oracle: number[]; ts: number[] } {
  const o: number[] = []
  const t: number[] = []
  l.v.forEach((v, i) => {
    if (typeof v === 'number') {
      o.push(v)
      const x = ts[i] ?? NaN
      t.push(x === 0 ? 0 : x)
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
  const lines = text.slice(1).map((t) => JSON.parse(t) as FnLine)
  const env = envFromHeader(header)
  const groups = new Map<string, FnLine[]>()
  for (const l of lines) {
    const key = l.mm?.length ? `mm\t${l.mm[0]}` : `ok\t${l.f}`
    const g = groups.get(key) ?? []
    g.push(l)
    groups.set(key, g)
  }
  describe(`1.13c formula sweep: ${cat}`, () => {
    for (const [key, ls] of [...groups].sort()) {
      const [kind, name] = key.split('\t') as [string, string]
      const check = (): void => {
        expect(HAVE_DATA).toBe(true)
        for (const l of ls) {
          const { oracle, ts } = numericPairs(l, evalLine(registry(), env, l))
          expect(ts, describeLine(l)).toEqual(oracle)
        }
      }
      if (kind === 'ok') it(`${name} agrees with D2 1.13c DLL oracle (${ls.length} lines)`, check, TIMEOUT)
      else it.fails(`${name}: tracked legacy mismatch (docs/oracle/P5-formula-sweep.md, ${ls.length} lines)`, check, TIMEOUT)
    }
  })
}

describe('d2kern-113c direct kernel primitives (mulDiv113c, seedRoll, STATLIST) vs 1.13c DLL oracle', () => {
  it('matches 100% of non-faulting muldiv / muldiv.game lines recorded from D2Common/D2Game (including shortcut branch)', () => {
    expect(files.length).toBe(12)
    const primText = readFileSync(new URL('primitives.ndjson', DIR), 'utf8').trim().split('\n')
    const mulDivLines = primText
      .slice(1)
      .map((t) => JSON.parse(t) as FnLine)
      .filter((l) => l.f === 'muldiv' || l.f === 'muldiv.game')

    expect(mulDivLines.length).toBeGreaterThan(0)
    let checked = 0
    for (const l of mulDivLines) {
      const expected = l.v[0]
      if (typeof expected !== 'number') continue
      const [edx = 0, eax = 0, ecx = 0] = l.a ?? []
      const actual = mulDiv113c(eax, edx, ecx)
      expect(actual === 0 ? 0 : actual, `${l.f}(eax=${eax}, edx=${edx}, ecx=${ecx})`).toBe(expected)
      checked++
    }
    expect(checked).toBeGreaterThan(1000)
  })

  it('verifies d2kern-113c seedRoll / seedNext 64-bit LCG (0x6AC690C5) exact step & range invariants', () => {
    const s = seedInit(12345, 666)
    // Step 1: 12345 * 0x6AC690C5 + 666 = 0x141D015B2E77 -> lo = 0x015B2E77, hi = 0x0000141D
    const r0 = seedNext(s)
    expect(r0 >>> 0).toBe(0x015b2e77)
    expect(s.lo).toBe(0x015b2e77)
    expect(s.hi).toBe(0x0000141d)
    expect(seedRoll(s, 0)).toBe(0)
    expect(seedRoll(s, -5)).toBe(0)
    const r1 = seedRoll(s, 100)
    expect(r1).toBeGreaterThanOrEqual(0)
    expect(r1).toBeLessThan(100)
  })

  it('verifies d2kern-113c STATLIST (STATLIST_CreateEx113c, SetUnitStat, MergeStatLists, EvalStatWithOps op 2/8/9/11) against 1.13c rules', () => {
    const m = new Heap113c()
    const pUnit = m.alloc(D2UnitStrc_SIZE)
    m.set(pUnit, D2UnitStrc.dwUnitType, 0) // UNIT_PLAYER
    m.set(pUnit, D2UnitStrc.dwClassId, 4) // Barbarian (`LifePerVitality=16`, `StaminaPerVitality=4`, `ManaPerMagic=4`)
    m.set(pUnit, D2UnitStrc.dwUnitId, 1)

    const pListEx = STATLIST_CreateEx113c(m, pUnit, 0, 0)
    expect(m.get(pUnit, D2UnitStrc.pStatListEx)).toBe(pListEx)

    // Base stats on player: level = 20, maxhp = 100 << 8, maxmana = 50 << 8, vitality = 25, energy = 10
    STATLIST_SetUnitStat113c(m, pUnit, 12, 20, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 7, 100 << 8, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 9, 50 << 8, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 3, 25, 0)
    STATLIST_SetUnitStat113c(m, pUnit, 1, 10, 0)

    // Attach equipment sub-list granting +10 vitality (op 9 -> +10 * 16 << 6 = +10240 maxhp),
    // +10 energy (op 8 -> +10 * 4 << 6 = +2560 maxmana), and +20% item_maxhp_percent (stat 76, op 11)
    const pSub = STATLIST_AllocList113c(m, 0, 4, 100, 0, 0)
    STATLIST_SetStat113c(m, pSub, 3, 10, 0)
    STATLIST_SetStat113c(m, pSub, 1, 10, 0)
    STATLIST_SetStat113c(m, pSub, 76, 20, 0)
    STATLIST_MergeStatLists113c(m, pUnit, pSub, 1)

    // Accrued vitality = 35, energy = 20
    expect(STATLIST_GetUnitStat113c(m, pUnit, 3, 0)).toBe(35)
    expect(STATLIST_GetUnitStat113c(m, pUnit, 1, 0)).toBe(20)
    // Accrued maxhp = 25600 + 20% of 25600 (5120) + 10 * 1024 (10240) = 40960 (`160 << 8`)
    expect(STATLIST_GetUnitStat113c(m, pUnit, 7, 0)).toBe(40960)
    // Accrued maxmana = 12800 + 10 * 256 (2560) = 15360 (`60 << 8`)
    expect(STATLIST_GetUnitStat113c(m, pUnit, 9, 0)).toBe(15360)
  })
})
