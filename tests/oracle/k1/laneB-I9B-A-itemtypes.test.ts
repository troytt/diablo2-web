import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_CanBeEquipped113c,
  ITEMS_CheckBodyLocation113c,
  ITEMS_GetAllowedBodyLocations113c,
  ITEMS_GetClassOfClassSpecificItem113c,
  ITEMS_GetItemTypeQuiverFromItem113c,
  ITEMS_GetItemTypeShootsFromItem113c,
  ITEMS_GetMaxSocketsFromItemType113c,
  ITEMS_GetStaffModsClass113c,
  ITEMS_GetStorePage113c,
  ITEMS_GetVarInvGfxCount113c,
  ITEMS_IsAutoStack113c,
  ITEMS_IsBeltable113c,
  ITEMS_IsClassSpecific113c,
  ITEMS_IsMagicQualityAllowed113c,
  ITEMS_IsNormalQualityAllowed113c,
  ITEMS_IsRareQualityAllowed113c,
  ITEMS_IsReEquip113c,
  ITEMS_IsReload113c,
} from '../../../src/d2kern-113c/common/items.ts'
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i9b-a-vectors.ndjson')

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
  '0x6FD73130': (m, a) => {
    ITEMS_GetAllowedBodyLocations113c(m, a[0]!, a[1]!, a[2]!)
    return 0
  },
  '0x6FD73360': (m, a) => ITEMS_IsNormalQualityAllowed113c(m, a[0]!) >>> 0,
  '0x6FD733B0': (m, a) => ITEMS_IsMagicQualityAllowed113c(m, a[0]!) >>> 0,
  '0x6FD73400': (m, a) => ITEMS_IsRareQualityAllowed113c(m, a[0]!) >>> 0,
  '0x6FD73450': (m, a) => ITEMS_GetVarInvGfxCount113c(m, a[0]!) >>> 0,
  '0x6FD734A0': (m, a) => ITEMS_GetStorePage113c(m, a[0]!) >>> 0,
  '0x6FD734F0': (m, a) => ITEMS_IsReEquip113c(m, a[0]!) >>> 0,
  '0x6FD73540': (m, a) => ITEMS_IsReload113c(m, a[0]!) >>> 0,
  '0x6FD74280': (m, a) => ITEMS_GetClassOfClassSpecificItem113c(m, a[0]!) >>> 0,
  '0x6FD742D0': (m, a) => ITEMS_IsClassSpecific113c(m, a[0]!) >>> 0,
  '0x6FD743B0': (m, a) => ITEMS_CanBeEquipped113c(m, a[0]!) >>> 0,
  '0x6FD74610': (m, a) => ITEMS_GetMaxSocketsFromItemType113c(m, a[0]!) >>> 0,
  '0x6FD746A0': (m, a) => ITEMS_GetStaffModsClass113c(m, a[0]!) >>> 0,
  '0x6FD74BA0': (m, a) => ITEMS_IsBeltable113c(m, a[0]!) >>> 0,
  '0x6FD74C80': (m, a) => ITEMS_CheckBodyLocation113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD74E10': (m, a) => ITEMS_IsAutoStack113c(m, a[0]!) >>> 0,
  '0x6FD74E60': (m, a) => ITEMS_GetItemTypeShootsFromItem113c(m, a[0]!) >>> 0,
  '0x6FD74EB0': (m, a) => ITEMS_GetItemTypeQuiverFromItem113c(m, a[0]!) >>> 0,
}

function stageAll(v: VectorRecord): StrictMem {
  const m = new StrictMem()
  for (const blk of v.pre) {
    m.stage(blk.addr >>> 0, blk.hex)
  }
  return m
}

describe('K1r4 Iteration 9 Lane B Part 2 — I9B-A ItemTypes differential verification (18 functions)', () => {
  it('loads all 18 I9B-A function VAs from the real-DLL fixture', () => {
    expect(VECTORS.length).toBe(227)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(18)
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

  describe('fixture sensitivity & Fog.#10023 assert paths', () => {
    it('every function has at least one vector whose eax or memory changes are non-trivial', () => {
      for (const va of Object.keys(DISPATCH)) {
        const vs = VECTORS.filter((v) => v.va === va)
        const informative = vs.some(
          (v) =>
            (v.retMask !== 0 && new Set(vs.map((x) => x.eax)).size > 1) ||
            v.post.some((b, i) => b.hex !== v.pre[i]!.hex),
        )
        expect(informative, va).toBe(true)
      }
    })

    it('asserts Items.cpp:0x68e when dwClassId is out of range for sgnItemsTxtCount', () => {
      const m = new SparseMemory113c()
      m.setU32(0x6fde9e1c, 0x20001000)
      m.setU32(0x6fdefb94, 4)
      m.setU32(0x6fdefb98, 0x20002000)
      const pItem = 0x20004000
      m.setU32(pItem, 4)
      m.setU32(pItem + 4, 4) // classId == count -> assert 0x68e
      expect(() => ITEMS_IsNormalQualityAllowed113c(m, pItem)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x68e),
      )
    })

    it('asserts Items.cpp:0x1ef when sgpItemsTxt is NULL for an in-range dwClassId', () => {
      const m = new SparseMemory113c()
      m.setU32(0x6fde9e1c, 0x20001000)
      m.setU32(0x6fdefb94, 4)
      m.setU32(0x6fdefb98, 0)
      const pItem = 0x20004000
      m.setU32(pItem, 4)
      m.setU32(pItem + 4, 0)
      expect(() => ITEMS_IsMagicQualityAllowed113c(m, pItem)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x1ef),
      )
      expect(() => ITEMS_GetMaxSocketsFromItemType113c(m, pItem)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x1ef),
      )
    })

    it('asserts Items.cpp:0x68e in A11 ITEMS_GetMaxSocketsFromItemType113c on out-of-range dwClassId', () => {
      const m = new SparseMemory113c()
      m.setU32(0x6fde9e1c, 0x20001000)
      m.setU32(0x6fdefb94, 4)
      m.setU32(0x6fdefb98, 0x20002000)
      const pItem = 0x20004000
      m.setU32(pItem, 4)
      m.setU32(pItem + 4, 99)
      expect(() => ITEMS_GetMaxSocketsFromItemType113c(m, pItem)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x68e),
      )
    })
  })
})
