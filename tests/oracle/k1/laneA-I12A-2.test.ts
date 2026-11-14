import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'
import {
  INVENTORY_AutoPlaceItemInBelt113c,
  INVENTORY_AutoPlaceItemInBeltSlot113c,
  INVENTORY_AutoPlaceItemInGrid113c,
  INVENTORY_CanAutoEquipItem113c,
  INVENTORY_CanAutoEquipToBodyLoc113c,
  INVENTORY_CanBodyLocFitInGrid113c,
  INVENTORY_CanTradeInventoriesSwap113c,
  INVENTORY_CheckGrid2ItemsFitClone113c,
  INVENTORY_PlaceItemInBodyLoc113c,
  INVENTORY_PlaceItemInGridCell113c,
  INVENTORY_ReserveGridFreePosition113c,
} from '../../../src/d2kern-113c/common/inventory.js'
import {
  ITEMMODS_ApplyPropertyCondResetAndRoll113c,
  ITEMMODS_ApplyPropertyCondResetAndSeedRoll113c,
  ITEMMODS_ApplyPropertyOskill113c,
  ITEMMODS_ApplyPropertyResetAndRoll113c,
  ITEMMODS_ApplyPropertyResetAndSeedRoll113c,
  ITEMMODS_ApplyPropertySimpleLayer0_113c,
} from '../../../src/d2kern-113c/common/logging.js'
import {
  ITEMMODS_ApplyPropertyCondResetRollDurability113c,
  ITEMMODS_ApplyPropertyIndestructible113c,
  ITEMMODS_ApplyPropertyPackedDuration113c,
} from '../../../src/d2kern-113c/common/statlist.js'

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

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i12a-2-vectors.ndjson')

const DISPATCH: Record<string, (m: SparseMemory113c, args: number[]) => number | void> = {
  '0x6FD70A30': (m, a) => INVENTORY_ReserveGridFreePosition113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD70B50': (m, a) => INVENTORY_CanBodyLocFitInGrid113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD70D20': (m, a) => INVENTORY_CheckGrid2ItemsFitClone113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD70DB0': (m, a) => INVENTORY_CanAutoEquipToBodyLoc113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD711D0': (m, a) => INVENTORY_CanAutoEquipItem113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD71C50': (m, a) => INVENTORY_CanTradeInventoriesSwap113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD71D70': (m, a) => INVENTORY_AutoPlaceItemInBeltSlot113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD71DA0': (m, a) => INVENTORY_PlaceItemInBodyLoc113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD71DD0': (m, a) => INVENTORY_PlaceItemInGridCell113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FD71E10': (m, a) => INVENTORY_AutoPlaceItemInGrid113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FD71E80': (m, a) => INVENTORY_AutoPlaceItemInBelt113c(m, a[0]!, a[1]!),
  '0x6FD98550': (m, a) => ITEMMODS_ApplyPropertyOskill113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD985D0': (m, a) => ITEMMODS_ApplyPropertySimpleLayer0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD98960': (m, a) => ITEMMODS_ApplyPropertyResetAndRoll113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD989D0': (m, a) => ITEMMODS_ApplyPropertyCondResetAndRoll113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD98A40': (m, a) => ITEMMODS_ApplyPropertyResetAndSeedRoll113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD98AE0': (m, a) => ITEMMODS_ApplyPropertyCondResetAndSeedRoll113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD972E0': (m, a) => ITEMMODS_ApplyPropertyIndestructible113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD97350': (m, a) => ITEMMODS_ApplyPropertyPackedDuration113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
  '0x6FD98070': (m, a) => ITEMMODS_ApplyPropertyCondResetRollDurability113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!),
}

describe('K1 Iteration 12 Lane A — I12A-2 inventory/logging/statlist differential replay', () => {
  const vectors = loadVectors(FIXTURE_PATH)

  it('covers all 20 net-new VAs in i12a-2-vectors.ndjson with >= 2 non-degenerate vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(20)
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
