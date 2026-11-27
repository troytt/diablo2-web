import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_GetRepairAllCost113c,
  ITEMS_GetTransactionCost113c,
  ITEMS_SerializeItemToBuffer113c,
  ITEMS_WriteItemStreamAndSockets113c,
} from '../../../src/d2kern-113c/common/items.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { type Memory113c, SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface VectorRecord {
  va: string
  name: string
  caseId: string
  args: number[]
  retMask: number
  eax: number
  pre: { addr: number; hex: string }[]
  post: { addr: number; hex: string }[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i13b-2-vectors.ndjson')

const VECTORS: VectorRecord[] = readFileSync(FIXTURE_PATH, 'utf8')
  .trim()
  .split('\n')
  .filter((line) => line.length > 0)
  .map((line) => JSON.parse(line) as VectorRecord)

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >>> 1)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function toHex(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, '0')
  }
  return s
}

class StrictMem extends SparseMemory113c {
  readonly allowed = new Set<number>()
  readonly rogueWrites: number[] = []
  private inAlloc = false

  stage(addr: number, hex: string): void {
    const bytes = fromHex(hex)
    const u = addr >>> 0
    for (let i = 0; i < bytes.length; i++) {
      this.allowed.add((u + i) >>> 0)
    }
    this.loadBlock(u, bytes)
  }

  override alloc(size: number): number {
    this.inAlloc = true
    try {
      const p = super.alloc(size)
      const u = p >>> 0
      for (let i = 0; i < size; i++) {
        this.allowed.add((u + i) >>> 0)
      }
      return p
    } finally {
      this.inAlloc = false
    }
  }

  private checkReadRange(p: number, width: number): void {
    const u = p >>> 0
    for (let i = 0; i < width; i++) {
      const a = (u + i) >>> 0
      if (!this.allowed.has(a)) {
        throw new Error(`Unstaged read at 0x${a.toString(16)}`)
      }
    }
  }

  private checkWriteRange(p: number, width: number): void {
    const u = p >>> 0
    for (let i = 0; i < width; i++) {
      const a = (u + i) >>> 0
      if (!this.allowed.has(a)) {
        this.rogueWrites.push(a)
      }
    }
  }

  override u8(p: number): number {
    this.checkReadRange(p, 1)
    return super.u8(p)
  }

  override u16(p: number): number {
    this.checkReadRange(p, 2)
    return super.u16(p)
  }

  override u32(p: number): number {
    this.checkReadRange(p, 4)
    return super.u32(p)
  }

  override setU8(p: number, v: number): void {
    this.checkWriteRange(p, 1)
    super.setU8(p, v)
  }

  override setU16(p: number, v: number): void {
    this.checkWriteRange(p, 2)
    super.setU16(p, v)
  }

  override setU32(p: number, v: number): void {
    this.checkWriteRange(p, 4)
    super.setU32(p, v)
  }

  override fill(p: number, len: number, v: number): void {
    if (!this.inAlloc) this.checkWriteRange(p, len)
    super.fill(p, len, v)
  }

  override get(base: number, f: FieldLayout113c, index = 0): number {
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    this.checkReadRange((base + f.off + index * width) >>> 0, width)
    return super.get(base, f, index)
  }

  override set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    this.checkWriteRange((base + f.off + index * width) >>> 0, width)
    super.set(base, f, v, index)
  }
}

const DISPATCH: Record<string, (m: StrictMem, args: number[]) => number> = {
  '0x6FD78D70': (m, a) =>
    ITEMS_WriteItemStreamAndSockets113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) >>> 0,
  '0x6FD79D00': (m, a) =>
    ITEMS_SerializeItemToBuffer113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) >>> 0,
  '0x6FD79D60': (m, a) =>
    ITEMS_GetTransactionCost113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) >>> 0,
  '0x6FD7A210': (m, a) => {
    const cbAddr = a[5]! >>> 0
    const onRepair =
      cbAddr === 0x200ff000
        ? (mem: Memory113c, ctx: number, item: number, unit: number) => {
            const idx = mem.u32(0x20000100) >>> 0
            mem.setU32(0x20000100, (idx + 1) >>> 0)
            const entryBase = (0x20000104 + idx * 12) >>> 0
            mem.setU32(entryBase, ctx >>> 0)
            mem.setU32((entryBase + 4) >>> 0, item >>> 0)
            mem.setU32((entryBase + 8) >>> 0, unit >>> 0)
          }
        : undefined
    return ITEMS_GetRepairAllCost113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, cbAddr, onRepair) >>> 0
  },
}

function stageAll(v: VectorRecord): StrictMem {
  const m = new StrictMem()
  for (const blk of v.pre) {
    m.stage(blk.addr >>> 0, blk.hex)
  }
  return m
}

describe('K1r11 Iteration 13 Lane B — I13B-2 differential verification (4 functions)', () => {
  it('loads all 4 I13B-2 function VAs from the real-DLL fixture', () => {
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(4)
    expect(new Set(Object.keys(DISPATCH))).toEqual(uniqueVas)
  })

  for (const v of VECTORS) {
    it(`${v.va} ${v.name} [${v.caseId}]`, () => {
      const m = stageAll(v)
      const fn = DISPATCH[v.va]
      expect(fn).toBeDefined()
      const eax = fn!(m, v.args) >>> 0
      const mask = v.retMask >>> 0
      if (mask !== 0) {
        expect((eax & mask) >>> 0).toBe((v.eax & mask) >>> 0)
      }
      expect(m.rogueWrites).toEqual([])
      for (const blk of v.post) {
        const actual = m.readBytes(blk.addr >>> 0, blk.hex.length >>> 1)
        expect(toHex(actual)).toBe(blk.hex)
      }
    })
  }

  it('covers I13B-2 assertions and null-guard paths', () => {
    const m = new SparseMemory113c()
    m.fill(0x1000, 0x40, 0)
    m.fill(0x1100, 0x80, 0)
    m.setU32(0x1000, 0x1100)
    m.setU32(0x1004, 0x80 * 8)
    m.setU32(0x6fdefb94, 0)
    expect(() => ITEMS_WriteItemStreamAndSockets113c(m, 0, 0x1000, 0, 0, 0)).toThrowError(
      D2CommonAssertError,
    )
    expect(() => ITEMS_SerializeItemToBuffer113c(m, 0, 0x1100, 64, 0, 0, 0)).toThrowError(
      D2CommonAssertError,
    )
    expect(ITEMS_GetTransactionCost113c(m, 0x1000, 0, 0, 0, 0, 0)).toBe(0x7fffffff)
    expect(ITEMS_GetRepairAllCost113c(m, 0, 0, 148, 0, 0, 0)).toBe(0)
    m.fill(0x2000, 0x100, 0)
    expect(ITEMS_GetRepairAllCost113c(m, 0, 0x2000, 148, 0, 0, 0)).toBe(0)

    // Unidentified damaged item with callback (kills && -> || on CanItemBeRepairedByNpc && CanItemLoseDurability)
    const vRep = VECTORS.find(
      (x) => x.name === 'ITEMS_GetRepairAllCost113c' && x.caseId === 'two_damaged_no_cb',
    )!
    const mUnid = stageAll(vRep)
    const pGridInv = mUnid.u32((mUnid.u32((vRep.args[1]! + 0x60) >>> 0) + 0x14) >>> 0)
    const ppItems = mUnid.u32((pGridInv + 0x0c) >>> 0)
    const item0 = mUnid.u32((ppItems + 4 * 4) >>> 0)
    const item1 = mUnid.u32((ppItems + 3 * 4) >>> 0)
    mUnid.setU32((mUnid.u32((item0 + 0x14) >>> 0) + 0x18) >>> 0, 0)
    mUnid.setU32((mUnid.u32((item1 + 0x14) >>> 0) + 0x18) >>> 0, 0)
    let unidCbCalls = 0
    expect(
      ITEMS_GetRepairAllCost113c(
        mUnid,
        vRep.args[0]!,
        vRep.args[1]!,
        vRep.args[2]!,
        vRep.args[3]!,
        vRep.args[4]!,
        0x200ff000,
        () => {
          unidCbCalls++
        },
      ),
    ).toBe(0)
    expect(unidCbCalls).toBe(0)

    // n=20: hdr === 0 with socketed (0x800) & unidentified (!0x10) clears bit 0x800 in dwFlags
    {
      const vW = VECTORS.find(
        (x) => x.name === 'ITEMS_WriteItemStreamAndSockets113c' && x.caseId === 'no_hdr_no_sock',
      )!
      const mw = stageAll(vW)
      const pData = mw.u32((vW.args[0]! + 0x14) >>> 0)
      mw.setU32((pData + 0x18) >>> 0, 0x800)
      ITEMS_WriteItemStreamAndSockets113c(mw, vW.args[0]!, vW.args[1]!, 0, 0, 0)
      const pOut = mw.u32(vW.args[1]!)
      const emittedFlags = mw.u32(pOut)
      expect((emittedFlags & 0x800) >>> 0).toBe(0)
    }

    // Identified damaged item at slotOff = 0x34 (beyond 13 body slots) -> kills slotOff < 0x34 -> <= 0x34
    const mSlot13 = stageAll(vRep)
    mSlot13.setU32((ppItems + 3 * 4) >>> 0, 0)
    mSlot13.setU32((ppItems + 4 * 4) >>> 0, 0)
    mSlot13.setU32((ppItems + 0x34) >>> 0, item0)
    expect(
      ITEMS_GetRepairAllCost113c(
        mSlot13,
        vRep.args[0]!,
        vRep.args[1]!,
        vRep.args[2]!,
        vRep.args[3]!,
        vRep.args[4]!,
        0,
      ),
    ).toBe(0)
  })
})
