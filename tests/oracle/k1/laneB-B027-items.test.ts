import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ITEMS_GetAltGfxOrBaseCode113c,
  ITEMS_GetBaseSpeed113c,
  ITEMS_GetBeltTypeIndex113c,
  ITEMS_GetBitField2113c,
  ITEMS_GetComponentByte113c,
  ITEMS_GetGambleCost113c,
  ITEMS_GetGemApplyType113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemDropSound113c,
  ITEMS_GetItemFormat113c,
  ITEMS_GetQuestItemByte113c,
  ITEMS_GetSubTypeByte113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_IsScrollOrTome113c,
  ITEMS_IsThrowableBit113c,
} from '../../../src/d2kern-113c/common/items.ts'

const ITEMS_TXT_COUNT_VA_113C = 0x6fdefb94
const ITEMS_TXT_PTR_VA_113C = 0x6fdefb98
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b027-vectors.ndjson')

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

  stage(addr: number, hex: string): void {
    const bytes = fromHex(hex)
    const u = addr >>> 0
    for (let i = 0; i < bytes.length; i++) {
      this.allowed.add((u + i) >>> 0)
    }
    this.loadBlock(u, bytes)
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
  '0x6FD721C0': (m, a) => ITEMS_GetItemFormat113c(m, a[0]!) >>> 0,
  '0x6FD722B0': (m, a) => ITEMS_GetItemDropSound113c(m, a[0]!) >>> 0,
  '0x6FD72380': (m, a) => ITEMS_GetQuestItemByte113c(m, a[0]!) >>> 0,
  '0x6FD72640': (m, a) => ITEMS_GetItemCell113c(m, a[0]!) >>> 0,
  '0x6FD72690': (m, a) => ITEMS_IsScrollOrTome113c(m, a[0]!) >>> 0,
  '0x6FD727C0': (m, a) => ITEMS_IsThrowableBit113c(m, a[0]!) >>> 0,
  '0x6FD72880': (m, a) => ITEMS_GetGemApplyType113c(m, a[0]!) >>> 0,
  '0x6FD728D0': (m, a) => ITEMS_GetBeltTypeIndex113c(m, a[0]!) >>> 0,
  '0x6FD72920': (m, a) => ITEMS_GetSubTypeByte113c(m, a[0]!) >>> 0,
  '0x6FD72AD0': (m, a) => ITEMS_GetGambleCost113c(m, a[0]!) >>> 0,
  '0x6FD72B20': (m, a) => ITEMS_GetBitField2113c(m, a[0]!) >>> 0,
  '0x6FD72B70': (m, a) => ITEMS_GetBaseSpeed113c(m, a[0]!) >>> 0,
  '0x6FD72BC0': (m, a) => ITEMS_GetComponentByte113c(m, a[0]!) >>> 0,
  '0x6FD72E20': (m, a) => ITEMS_GetTwoHandedFlag113c(m, a[0]!) >>> 0,
  '0x6FD72FF0': (m, a) => ITEMS_GetAltGfxOrBaseCode113c(m, a[0]!) >>> 0,
}

describe('K1r2 Iteration 6 Lane B — B027 items.ts differential verification (15 functions)', () => {
  it('loads all 15 B027 function VAs and >= 50 real-DLL vectors', () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(50)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(15)
    for (const va of Object.keys(DISPATCH)) {
      expect(uniqueVas.has(va)).toBe(true)
    }
  })

  for (const v of VECTORS) {
    it(`${v.va} ${v.name} [${v.caseId}]`, () => {
      const m = new StrictMem()
      for (const blk of v.pre) {
        m.stage(blk.addr >>> 0, blk.hex)
      }
      const fn = DISPATCH[v.va]
      expect(fn).toBeDefined()
      const eax = fn!(m, v.args) >>> 0
      const mask = v.retMask >>> 0
      expect((eax & mask) >>> 0).toBe((v.eax & mask) >>> 0)
      expect(m.rogueWrites).toEqual([])
      for (const blk of v.post) {
        const actual = m.readBytes(blk.addr >>> 0, blk.hex.length >>> 1)
        expect(toHex(actual)).toBe(blk.hex)
      }
    })
  }

  describe('Fog.#10023 assert paths and negative-control mutation sensitivity', () => {
    it('throws D2CommonAssertError with exact Items.cpp line numbers on invalid units or out-of-range item IDs', () => {
      const m = new StrictMem()
      m.stage(ITEMS_TXT_COUNT_VA_113C, '0200000000100020')
      m.stage(0x20000000, '00'.repeat(244))
      m.setU32(0x20000000, 1) // non-item unit

      expect(() => ITEMS_GetItemFormat113c(m, 0)).toThrowError(new D2CommonAssertError('Items.cpp', 0x1505))
      expect(() => ITEMS_GetItemFormat113c(m, 0x20000000)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x1506),
      )
      expect(() => ITEMS_GetItemDropSound113c(m, 0)).toThrowError(new D2CommonAssertError('Items.cpp', 0x12e1))
      expect(() => ITEMS_GetQuestItemByte113c(m, 0)).toThrowError(new D2CommonAssertError('Items.cpp', 0x1190))
      expect(() => ITEMS_GetItemCell113c(m, 0)).toThrowError(new D2CommonAssertError('Items.cpp', 0x1071))
      expect(() => ITEMS_IsScrollOrTome113c(m, 5)).toThrowError(new D2CommonAssertError('Items.cpp', 0x105f))
      expect(() => ITEMS_IsThrowableBit113c(m, 5)).toThrowError(new D2CommonAssertError('Items.cpp', 0x1041))
      expect(() => ITEMS_GetGemApplyType113c(m, 5)).toThrowError(new D2CommonAssertError('Items.cpp', 0xf29))
      expect(() => ITEMS_GetGambleCost113c(m, 5)).toThrowError(new D2CommonAssertError('Items.cpp', 0xd8b))
      expect(() => ITEMS_GetBitField2113c(m, 5)).toThrowError(new D2CommonAssertError('Items.cpp', 0xd6d))
      expect(() => ITEMS_GetBaseSpeed113c(m, 5)).toThrowError(new D2CommonAssertError('Items.cpp', 0xd50))
      expect(() => ITEMS_GetComponentByte113c(m, 0)).toThrowError(new D2CommonAssertError('Items.cpp', 0x9db))
      expect(() => ITEMS_GetAltGfxOrBaseCode113c(m, 0)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x798),
      )
      expect(ITEMS_TXT_PTR_VA_113C).toBe(0x6fdefb98)
    })

    it('detects mutated return values across all 15 B027 functions', () => {
      for (const va of Object.keys(DISPATCH)) {
        const sample = VECTORS.find((v) => v.va === va)!
        const m = new StrictMem()
        for (const blk of sample.pre) {
          m.stage(blk.addr >>> 0, blk.hex)
        }
        const eax = DISPATCH[va]!(m, sample.args) >>> 0
        const mask = sample.retMask >>> 0
        const mutated = ((eax ^ 1) & mask) >>> 0
        expect(mutated).not.toBe((sample.eax & mask) >>> 0)
      }
    })
  })
})
