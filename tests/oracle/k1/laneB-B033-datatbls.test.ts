import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  DATATBLS_GetArenaTxtRecord113c,
  DATATBLS_GetBeltsTxtRecord113c,
  DATATBLS_GetBooksTxtRecord113c,
  DATATBLS_GetCharTemplateStartLevel113c,
  DATATBLS_GetGemsTxtRecord113c,
  DATATBLS_GetInventoryGridInfo113c,
  DATATBLS_GetItemsTxtRecordByCode113c,
  DATATBLS_GetLvlSubTxtRecordBySubType113c,
  DATATBLS_GetLvlWarpTxtRecordByIdAndDir113c,
  DATATBLS_GetMagicAffixTxtRecord113c,
  DATATBLS_GetObjGroupTxtRecord113c,
  DATATBLS_GetQualityItemsTxtRecord113c,
  ITEMS_CheckIfUnique113c,
  ITEMS_CheckIfUseable113c,
  ITEMS_Get2HandedWClass113c,
  ITEMS_GetBaseLevel113c,
  MONSTER_GetSubClassVelocityInfo113c,
  PATH_GetTargetUnitCoordsWithTrigOffset113c,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'

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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b033-vectors.ndjson')

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
  '0x6FD6A330': (m, a) => {
    MONSTER_GetSubClassVelocityInfo113c(m, a[0]!, a[1]!, a[2]!)
    return 0
  },
  '0x6FD72C20': (m, a) => ITEMS_CheckIfUnique113c(m, a[0]!) >>> 0,
  '0x6FD72C80': (m, a) => ITEMS_CheckIfUseable113c(m, a[0]!) >>> 0,
  '0x6FD73050': (m, a) => ITEMS_GetBaseLevel113c(m, a[0]!) >>> 0,
  '0x6FD732E0': (m, a) => ITEMS_Get2HandedWClass113c(m, a[0]!) >>> 0,
  '0x6FD8E310': (m, a) => {
    PATH_GetTargetUnitCoordsWithTrigOffset113c(m, a[0]!, a[1]!)
    return 0
  },
  '0x6FD8E910': (m, a) => DATATBLS_GetObjGroupTxtRecord113c(m, a[0]!) >>> 0,
  '0x6FDBC4D0': (m, a) => DATATBLS_GetLvlSubTxtRecordBySubType113c(m, a[0]!) >>> 0,
  '0x6FDBC5D0': (m, a) => DATATBLS_GetLvlWarpTxtRecordByIdAndDir113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDC1430': (m, a) => DATATBLS_GetBooksTxtRecord113c(m, a[0]!) >>> 0,
  '0x6FDC14D0': (m, a) => DATATBLS_GetQualityItemsTxtRecord113c(m, a[0]!) >>> 0,
  '0x6FDC1570': (m, a) => DATATBLS_GetGemsTxtRecord113c(m, a[0]!) >>> 0,
  '0x6FDC1610': (m, a) => DATATBLS_GetBeltsTxtRecord113c(m, a[0]!) >>> 0,
  '0x6FDC1820': (m, a) => DATATBLS_GetMagicAffixTxtRecord113c(m, a[0]!) >>> 0,
  '0x6FDC1960': (m, a) => DATATBLS_GetItemsTxtRecordByCode113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDCFF80': (m, a) => DATATBLS_GetArenaTxtRecord113c(m, a[0]!) >>> 0,
  '0x6FDCFFB0': (m, a) => DATATBLS_GetCharTemplateStartLevel113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDD1FB0': (m, a) => {
    DATATBLS_GetInventoryGridInfo113c(m, a[0]!, a[1]!, a[2]!)
    return 0
  },
}

describe('K1r2 Iteration 7 Lane B — B033 datatbls-113c.ts differential verification (18 functions)', () => {
  it('loads all 18 B033 function VAs and >= 54 real-DLL vectors', () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(54)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(18)
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

  describe('Fog.#10023 assert paths and negative-control mutation sensitivity', () => {
    it('throws D2CommonAssertError with exact file and line numbers on Fog.#10023 paths', () => {
      const m = new StrictMem()
      m.stage(0x6fdf0b90, '03000000') // nObjGroupTxtRecordCount = 3
      m.stage(0x6fdf142c, '00000000') // pLvlWarpTxt = 0
      m.stage(0x6fdefa5c, '00400020') // pInventoryTxt = 0x20004000
      m.stage(0x6fdefa58, '02000000') // nInventoryTxtMaxIndex = 2

      expect(() => MONSTER_GetSubClassVelocityInfo113c(m, 0, 0x20004100, 0x20004104)).toThrowError(
        new D2CommonAssertError('Monsters.cpp', 0x2bc),
      )
      expect(() => ITEMS_CheckIfUnique113c(m, 0)).toThrowError(new D2CommonAssertError('Items.cpp', 0x9ce))
      expect(() => ITEMS_GetBaseLevel113c(m, 0)).toThrowError(new D2CommonAssertError('Items.cpp', 0x697))
      expect(() => ITEMS_Get2HandedWClass113c(m, 0)).toThrowError(new D2CommonAssertError('Items.cpp', 0x609))
      expect(() => PATH_GetTargetUnitCoordsWithTrigOffset113c(m, 0, 0x20004100)).toThrowError(
        new D2CommonAssertError('PathUtil.cpp', 0x201),
      )
      expect(() => DATATBLS_GetObjGroupTxtRecord113c(m, 5)).toThrowError(
        new D2CommonAssertError('ObjectsTbls.cpp', 0x15f),
      )
      expect(() => DATATBLS_GetLvlSubTxtRecordBySubType113c(m, -1)).toThrowError(
        new D2CommonAssertError('LvlTbls.cpp', 0x402),
      )
      expect(() => DATATBLS_GetLvlWarpTxtRecordByIdAndDir113c(m, 0, 0x62)).toThrowError(
        new D2CommonAssertError('LvlTbls.cpp', 0x32b),
      )
      expect(() => DATATBLS_GetArenaTxtRecord113c(m, 1)).toThrowError(
        new D2CommonAssertError('ArenaTbls.cpp', 0x41),
      )
      expect(() => DATATBLS_GetCharTemplateStartLevel113c(m, 0, 0)).toThrowError(
        new D2CommonAssertError('CharTemplateTbls.cpp', 0xf5),
      )
      expect(() => DATATBLS_GetInventoryGridInfo113c(m, 5, 0, 0x20004100)).toThrowError(
        new D2CommonAssertError('InvTbls.cpp', 0x97),
      )
    })

    it('detects mutated return values or output memory across all 18 B033 functions', () => {
      for (const va of Object.keys(DISPATCH)) {
        const sample = VECTORS.find((v) => v.va === va)!
        const m = new StrictMem()
        for (const blk of sample.pre) {
          m.stage(blk.addr >>> 0, blk.hex)
        }
        const eax = DISPATCH[va]!(m, sample.args) >>> 0
        const mask = sample.retMask >>> 0
        if (mask !== 0) {
          const mutated = ((eax ^ 1) & mask) >>> 0
          expect(mutated).not.toBe((sample.eax & mask) >>> 0)
        } else {
          const outBlk = sample.post[sample.post.length - 1]!
          const actual = m.readBytes(outBlk.addr >>> 0, outBlk.hex.length >>> 1)
          actual[0] ^= 0xff
          expect(toHex(actual)).not.toBe(outBlk.hex)
        }
      }
    })
  })
})
