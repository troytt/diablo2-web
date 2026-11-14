import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  INVENTORY_CanStackIntoBeltRow113c,
  INVENTORY_CopyGrid2Cells113c,
  INVENTORY_FindBackpackItemByType113c,
  INVENTORY_FindBestFitReverse113c,
  INVENTORY_FindBestFitRowMajor113c,
  INVENTORY_FindFirstFitColMajor113c,
  INVENTORY_FindFirstFitRightToLeft113c,
  INVENTORY_FindItemGfxCodeIndex113c,
  INVENTORY_RemoveItemInternal113c,
  INVENTORY_UpdateWeaponGuidOnInsert113c,
  INVENTORY_UpdateWeaponGuidOnRemoval113c,
  ITEMS_DecodeItemCompactBitstreamV96_113c,
} from '../../../src/d2kern-113c/common/inventory.js'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import { MISSILE_RollLimitedFromUnitSeed113c } from '../../../src/d2kern-113c/common/missile.js'
import { HIRELING_GetActIndex113c } from '../../../src/d2kern-113c/common/quest-record.js'
import { STATES_CheckStateMask33OnUnit113c } from '../../../src/d2kern-113c/common/statlist.js'
import {
  UNITS_GetTransformGfx113c,
  UNITS_GetUnitSizeX113c,
  UNITS_IsCastAnimMode113c,
  UNITS_StepAnimSeqFrame113c,
} from '../../../src/d2kern-113c/common/unit.js'
import { UNITS_IsCorpseUseable113c } from '../../../src/d2kern-113c/common/waypoint.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'

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

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b051-vectors.ndjson')

function loadVectors(): VectorRecord[] {
  const raw = readFileSync(FIXTURE_PATH, 'utf8').trim()
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

const DISPATCH: Record<string, (m: SparseMemory113c, args: number[]) => number | void> = {
  '0x6FD6E7B0': (m, a) => INVENTORY_CopyGrid2Cells113c(m, a[0]!, a[1]!),
  '0x6FD6EEE0': (m, a) => INVENTORY_CanStackIntoBeltRow113c(m, a[0]!, a[1]!),
  '0x6FD6F370': (m, a) => INVENTORY_FindFirstFitColMajor113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD6F410': (m, a) => INVENTORY_FindBestFitRowMajor113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD6F4E0': (m, a) => INVENTORY_FindFirstFitRightToLeft113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD6F580': (m, a) => INVENTORY_FindBestFitReverse113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD6FB50': (m, a) => INVENTORY_FindItemGfxCodeIndex113c(m, a[0]!, a[1]!),
  '0x6FD6FC70': (m, a) => INVENTORY_UpdateWeaponGuidOnRemoval113c(m, a[0]!, a[1]!),
  '0x6FD6FE10': (m, a) => INVENTORY_FindBackpackItemByType113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD70620': (m, a) => INVENTORY_UpdateWeaponGuidOnInsert113c(m, a[0]!, a[1]!),
  '0x6FD71640': (m, a) => INVENTORY_RemoveItemInternal113c(m, a[0]!),
  '0x6FD72150': (m, a) => ITEMS_DecodeItemCompactBitstreamV96_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD7C9E0': (m, a) => HIRELING_GetActIndex113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD7F100': (m, a) => UNITS_StepAnimSeqFrame113c(m, a[0]!, a[1]!),
  '0x6FD80B80': (m, a) => UNITS_IsCastAnimMode113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD80F80': (m, a) => UNITS_GetUnitSizeX113c(m, a[0]!),
  '0x6FD811B0': (m, a) => UNITS_IsCorpseUseable113c(m, a[0]!),
  '0x6FD83D60': (m, a) => STATES_CheckStateMask33OnUnit113c(m, a[0]!),
  '0x6FDA01E0': (m, a) => UNITS_GetTransformGfx113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FDBB140': (m, a) => MISSILE_RollLimitedFromUnitSeed113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
}

describe('K1 Iteration 9 Lane A — B051 inventory/unit/statlist/missile differential replay', () => {
  const vectors = loadVectors()

  it('covers all 20 diff-verified B051 VAs with >= 2 vectors each', () => {
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
        const actual = ((rawRet ?? 0) >>> 0) & mask
        const expected = expectedEax & mask
        expect(actual).toBe(expected >>> 0)
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
