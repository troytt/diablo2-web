import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_AccumulateSocketedItemCosts113c,
  ITEMS_AllocItemData113c,
  ITEMS_ApplyEtherealBonusStats113c,
  ITEMS_CheckItemTypeRarityUnder7113c,
  ITEMS_DecodeAndSetSaveStat113c,
  ITEMS_EnsureMinimumBaseDamageAndACStats113c,
  ITEMS_GetBaseCode113c,
  ITEMS_GetItemsTxtRecordFromUnitOrAlt113c,
  ITEMS_GetMaxSockets113c,
  ITEMS_IsTome113c,
  ITEMS_ResetBaseDamageOrACStatFromTxt113c,
  ITEMS_SetOwnerGuid113c,
  ITEMS_WriteBitsClamped113c,
} from '../../../src/d2kern-113c/common/items.ts'

const ITEMS_TXT_COUNT_VA_113C = 0x6fdefb94
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b030-vectors.ndjson')

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

  override alloc(size: number): number {
    const p = super.alloc(size)
    const u = p >>> 0
    for (let i = 0; i < size; i++) {
      this.allowed.add((u + i) >>> 0)
    }
    this.rogueWrites.length = 0
    return p
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
  '0x6FD730A0': (m, a) => ITEMS_IsTome113c(m, a[0]!) >>> 0,
  '0x6FD73290': (m, a) => ITEMS_GetBaseCode113c(m, a[0]!) >>> 0,
  '0x6FD73B70': (m, a) => {
    ITEMS_SetOwnerGuid113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD73C70': (m, a) => {
    ITEMS_AllocItemData113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD73DD0': (m, a) => {
    ITEMS_WriteBitsClamped113c(m, a[0]!, a[1]!, a[2]!)
    return 0
  },
  '0x6FD74320': (m, a) => ITEMS_CheckItemTypeRarityUnder7113c(m, a[0]!) >>> 0,
  '0x6FD74A50': (m, a) => {
    ITEMS_AccumulateSocketedItemCosts113c(m, a[0]!, a[1]!, a[2]!, a[3]!)
    return 0
  },
  '0x6FD76080': (m, a) => ITEMS_GetMaxSockets113c(m, a[0]!) >>> 0,
  '0x6FD79D90': (m, a) => {
    ITEMS_DecodeAndSetSaveStat113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!)
    return 0
  },
  '0x6FD79F30': (m, a) => {
    ITEMS_EnsureMinimumBaseDamageAndACStats113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD7D0F0': (m, a) => DRLGWARP_TestRoomTileBit113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD95A40': (m, a) => ITEMS_GetItemsTxtRecordFromUnitOrAlt113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD96A40': (m, a) => {
    ITEMS_ApplyEtherealBonusStats113c(m, a[0]!)
    return 0
  },
  '0x6FD96E50': (m, a) => {
    ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, a[0]!, a[1]!)
    return 0
  },
}

describe('K1r2 Iteration 6 Lane B — B030 items.ts differential verification (14 functions)', () => {
  it('loads all 14 B030 function VAs and >= 80 real-DLL vectors', () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(80)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(14)
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
    it('throws D2CommonAssertError with exact Items.cpp line numbers on invalid inputs', () => {
      const m = new StrictMem()
      m.stage(ITEMS_TXT_COUNT_VA_113C, '0200000000100020')
      m.stage(0x20000000, '00'.repeat(244))
      m.setU32(0x20000000, 1) // non-item unit

      expect(() => ITEMS_IsTome113c(m, -1)).toThrowError(new D2CommonAssertError('Items.cpp', 0x68e))
      expect(() => ITEMS_GetBaseCode113c(m, 0)).toThrowError(new D2CommonAssertError('Items.cpp', 0x61b))
      expect(() => ITEMS_SetOwnerGuid113c(m, 0, 1)).toThrowError(new D2CommonAssertError('Items.cpp', 0x188))
      expect(() => ITEMS_SetOwnerGuid113c(m, 0x20000000, 1)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x189),
      )
      expect(() => ITEMS_CheckItemTypeRarityUnder7113c(m, 99)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x68e),
      )
      expect(() => ITEMS_GetMaxSockets113c(m, 0)).toThrowError(new D2CommonAssertError('Items.cpp', 0xea7))
      expect(() => ITEMS_EnsureMinimumBaseDamageAndACStats113c(m, 0, 0x10)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x61b),
      )
      expect(() => ITEMS_ApplyEtherealBonusStats113c(m, 0)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x706),
      )
      expect(() => ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, 0, 0x10)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x61b),
      )
    })

    it('detects mutated post-state across all 14 B030 functions', () => {
      for (const va of Object.keys(DISPATCH)) {
        const sample =
          VECTORS.find(
            (v) =>
              v.va === va &&
              (v.retMask !== 0 || v.post.some((blk, idx) => blk.hex !== v.pre[idx]?.hex)),
          ) ?? VECTORS.find((v) => v.va === va)!
        const m = new StrictMem()
        for (const blk of sample.pre) {
          m.stage(blk.addr >>> 0, blk.hex)
        }
        const eax = DISPATCH[va]!(m, sample.args) >>> 0
        if (sample.retMask !== 0) {
          const mask = sample.retMask >>> 0
          expect(((eax ^ 1) & mask) >>> 0).not.toBe((sample.eax & mask) >>> 0)
        } else {
          const firstBlk = sample.post[0]!
          const actual = m.readBytes(firstBlk.addr >>> 0, firstBlk.hex.length >>> 1)
          actual[0] ^= 0xff
          expect(toHex(actual)).not.toBe(firstBlk.hex)
        }
      }
    })
  })
})
