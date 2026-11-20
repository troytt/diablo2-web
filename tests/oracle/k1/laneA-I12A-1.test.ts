import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'
import {
  INVENTORY_FreeInventory113c,
  INVENTORY_GetBeltAutoPlaceSlot113c,
  INVENTORY_GetFreePosition113c,
  INVENTORY_GetSwapWeaponItem113c,
  INVENTORY_CanDualWieldItems113c,
  INVENTORY_PlaceItemInGridPage113c,
  INVENTORY_PlaceItemInSocket113c,
} from '../../../src/d2kern-113c/common/inventory.js'
import {
  ITEMMODS_ApplyPropertyAura113c,
  ITEMMODS_ApplyPropertyClassSkill113c,
  ITEMMODS_ApplyPropertyClassSkillTab113c,
  ITEMMODS_ApplyPropertySimpleStat113c,
  ITEMMODS_ApplyPropertySingleSkill113c,
  ITEMMODS_ApplyPropertySkillOnHit113c,
} from '../../../src/d2kern-113c/common/logging.js'
import {
  UNITS_AdvanceAnimFrame113c,
  UNITS_TestCollisionBetweenUnits113c,
} from '../../../src/d2kern-113c/common/unit.js'

interface MemBlock {
  base: string
  hex: string
}

interface VectorRecord {
  va: string
  name: string
  caseIndex: number
  note: string
  inputs: {
    args: Array<string | number>
    memory: MemBlock[]
  }
  expectedAssert?: {
    line: number
  }
  outputs: {
    eax: string
    retMask: string
    memory: MemBlock[]
  }
}

function loadVectors(fixturePath: string): VectorRecord[] {
  const raw = readFileSync(fixturePath, 'utf8').trim()
  if (!raw) return []
  return raw.split('\n').map((line) => JSON.parse(line) as VectorRecord)
}

function parseArg(v: string | number): number {
  if (typeof v === 'number') return v | 0
  return Number.parseInt(v, 16) >>> 0
}

function createStrictMemory(
  preBlocks: MemBlock[],
  postBlocks: MemBlock[],
): {
  m: SparseMemory113c
  rogueReads: string[]
  rogueWrites: string[]
  dumpHex: (addr: number, len: number) => string
} {
  const m = new SparseMemory113c()
  const readSpans: Array<{ start: number; end: number }> = []
  const writeSpans: Array<{ start: number; end: number }> = []
  const writtenAddrs = new Set<number>()

  for (const blk of preBlocks) {
    const start = Number.parseInt(blk.base, 16) >>> 0
    const bytes = Buffer.from(blk.hex, 'hex')
    m.loadBlock(start, bytes)
    readSpans.push({ start, end: (start + bytes.length) >>> 0 })
  }
  for (const blk of postBlocks) {
    const start = Number.parseInt(blk.base, 16) >>> 0
    const len = blk.hex.length >>> 1
    writeSpans.push({ start, end: (start + len) >>> 0 })
  }

  const rawMem = m as unknown as {
    readByte: (a: number) => number
    writeByte: (a: number, v: number) => void
  }
  const origReadByte = rawMem.readByte.bind(m)
  const origWriteByte = rawMem.writeByte.bind(m)

  const rogueReads: string[] = []
  const rogueWrites: string[] = []

  rawMem.readByte = (a: number): number => {
    const u = a >>> 0
    const ok = readSpans.some((s) => u >= s.start && u < s.end) || writtenAddrs.has(u)
    if (!ok) {
      rogueReads.push(`0x${u.toString(16)}`)
    }
    return origReadByte(a)
  }

  rawMem.writeByte = (a: number, v: number): void => {
    const u = a >>> 0
    const ok = writeSpans.some((s) => u >= s.start && u < s.end)
    if (!ok) {
      rogueWrites.push(`0x${u.toString(16)}`)
    }
    writtenAddrs.add(u)
    origWriteByte(a, v)
  }

  const dumpHex = (addr: number, len: number): string => {
    let out = ''
    for (let i = 0; i < len; i++) {
      out += origReadByte((addr + i) >>> 0).toString(16).padStart(2, '0')
    }
    return out
  }

  return { m, rogueReads, rogueWrites, dumpHex }
}

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i12a-1-vectors.ndjson')

const DISPATCH: Record<string, (m: SparseMemory113c, args: number[]) => number | void> = {
  '0x6FD6F980': (m, a) => INVENTORY_CanDualWieldItems113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD700D0': (m, a) => INVENTORY_GetBeltAutoPlaceSlot113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD70490': (m, a) => INVENTORY_GetSwapWeaponItem113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD708E0': (m, a) => INVENTORY_GetFreePosition113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD717F0': (m, a) => INVENTORY_PlaceItemInSocket113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD718A0': (m, a) => INVENTORY_PlaceItemInGridPage113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD71B40': (m, a) => INVENTORY_FreeInventory113c(m, a[0]!),
  '0x6FD819C0': (m, a) => UNITS_TestCollisionBetweenUnits113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD82460': (m, a) => UNITS_AdvanceAnimFrame113c(m, a[0]!),
  '0x6FD98100': (m, a) => ITEMMODS_ApplyPropertySkillOnHit113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD98190': (m, a) => ITEMMODS_ApplyPropertyAura113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD98220': (m, a) => ITEMMODS_ApplyPropertyClassSkill113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD982B0': (m, a) => ITEMMODS_ApplyPropertySingleSkill113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD98470': (m, a) => ITEMMODS_ApplyPropertyClassSkillTab113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD984F0': (m, a) => ITEMMODS_ApplyPropertySimpleStat113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
}

describe('K1 Iteration 12 Lane A — I12A-1 inventory/unit/logging differential replay', () => {
  const vectors = loadVectors(FIXTURE_PATH)

  it('covers all 15 net-new VAs in i12a-1-vectors.ndjson with >= 2 non-degenerate vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(15)
    for (const va of Object.keys(DISPATCH)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(2)
    }
  })

  for (const rec of vectors) {
    it(`${rec.va} ${rec.name} [#${rec.caseIndex}: ${rec.note}]`, () => {
      const fn = DISPATCH[rec.va]
      expect(fn, `missing dispatch for ${rec.va}`).toBeDefined()
      const { m, rogueReads, rogueWrites, dumpHex } = createStrictMemory(
        rec.inputs.memory,
        rec.outputs.memory,
      )
      const args = rec.inputs.args.map(parseArg)

      if (rec.expectedAssert !== undefined) {
        let caught: unknown
        try {
          fn!(m, args)
        } catch (err) {
          caught = err
        }
        expect(caught).toBeInstanceOf(D2CommonAssertError)
        expect((caught as D2CommonAssertError).line).toBe(rec.expectedAssert.line)
        expect(rogueReads, `rogue reads on ${rec.va} #${rec.caseIndex}`).toEqual([])
        return
      }

      const rawRet = fn!(m, args)
      const mask = Number.parseInt(rec.outputs.retMask, 16) >>> 0
      const expectedEax = Number.parseInt(rec.outputs.eax, 16) >>> 0
      if (mask !== 0) {
        const actual = (((rawRet ?? 0) >>> 0) & mask) >>> 0
        const expected = (expectedEax & mask) >>> 0
        expect(actual).toBe(expected)
      }

      expect(rogueReads, `rogue reads on ${rec.va} #${rec.caseIndex}`).toEqual([])
      expect(rogueWrites, `rogue writes on ${rec.va} #${rec.caseIndex}`).toEqual([])

      for (const post of rec.outputs.memory) {
        const base = Number.parseInt(post.base, 16) >>> 0
        const len = post.hex.length >>> 1
        expect(dumpHex(base, len), `memory mismatch at ${post.base}`).toBe(post.hex)
      }
    })
  }
})
