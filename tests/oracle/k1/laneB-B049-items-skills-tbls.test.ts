import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_CalculateAdditionalCostsForBonusStats113c,
  ITEMS_CanItemBePersonalizedOrRepaired113c,
  ITEMS_CheckAffixAssignableToItem113c,
  ITEMS_CheckIfImbueable113c,
  ITEMS_CheckQualityItemMatch113c,
  ITEMS_ComputeGambleBaseCost113c,
  ITEMS_EncodeCompactAndBasicItemStream113c,
  ITEMS_EvalItemCalc113c,
  ITEMS_GetBitField2FromItem113c,
  ITEMS_GetGambleCostFromItem113c,
  ITEMS_GetGemApplyTypeFromItem113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetMagicLevelFromItem113c,
  ITEMS_GetTotalMaxStack113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { SKILLS_AddOrRemoveItemChargedSkill113c } from '../../../src/d2kern-113c/common/skills.ts'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { DRLG_ValidateAndRebaseLevelRooms113c } from '../../../src/d2kern-113c/tables/datatbls-113c.ts'

interface VectorRecord {
  va: string
  name: string
  caseId: string
  args: number[]
  retMask: number
  eax: number
  pre: { addr: number; hex: string }[]
  /** Present when the real DLL hit its Fog assert (0x6FD5921C, captured line) instead of returning. */
  expectedAssert?: { line: number }
  post: { addr: number; hex: string }[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b049-vectors.ndjson')

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
  '0x6FD730F0': (m, a) => ITEMS_GetItemTypeFromItem113c(m, a[0]!) >>> 0,
  '0x6FD73CE0': (m, a) => ITEMS_EvalItemCalc113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD745D0': (m, a) => ITEMS_GetGemApplyTypeFromItem113c(m, a[0]!) >>> 0,
  '0x6FD74710': (m, a) => ITEMS_GetMagicLevelFromItem113c(m, a[0]!) >>> 0,
  '0x6FD747C0': (m, a) => ITEMS_GetGambleCostFromItem113c(m, a[0]!) >>> 0,
  '0x6FD74800': (m, a) => ITEMS_GetBitField2FromItem113c(m, a[0]!) >>> 0,
  '0x6FD74840': (m, a) => ITEMS_ComputeGambleBaseCost113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD74F00': (m, a) => ITEMS_CanItemBePersonalizedOrRepaired113c(m, a[0]!) >>> 0,
  '0x6FD750B0': (m, a) => ITEMS_CheckIfImbueable113c(m, a[0]!) >>> 0,
  '0x6FD75C10': (m, a) => {
    ITEMS_EncodeCompactAndBasicItemStream113c(m, a[0]!, a[1]!, a[2]!)
    return 0
  },
  '0x6FD760F0': (m, a) => ITEMS_GetTotalMaxStack113c(m, a[0]!) >>> 0,
  '0x6FD78850': (m, a) => {
    ITEMS_CalculateAdditionalCostsForBonusStats113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!)
    return 0
  },
  '0x6FD7D660': (m, a) => {
    DRLG_ValidateAndRebaseLevelRooms113c(m, a[0]!)
    return 0
  },
  '0x6FD95BE0': (m, a) => ITEMS_CheckQualityItemMatch113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD95D30': (m, a) => ITEMS_CheckAffixAssignableToItem113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD9EE00': (m, a) => {
    SKILLS_AddOrRemoveItemChargedSkill113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!)
    return 0
  },
}

describe('K1r2 Iteration 8 Lane B — B049 items, skills, datatbls hostImport differential verification (16 functions)', () => {
  it('loads all 16 B049 function VAs and >= 55 real-DLL vectors', () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(55)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(16)
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
      if (v.expectedAssert !== undefined) {
        let thrown: unknown
        try {
          fn!(m, v.args)
        } catch (e) {
          thrown = e
        }
        expect(thrown).toBeInstanceOf(D2CommonAssertError)
        expect((thrown as D2CommonAssertError).line).toBe(v.expectedAssert.line)
        return
      }
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

  describe('Fog.#10023 assert paths on NULL or non-item units', () => {
    it('throws D2CommonAssertError with exact file and line numbers on Fog.#10023 paths', () => {
      const m = new StrictMem()
      m.stage(0x20000800, '01000000' + '00'.repeat(0x90))
      expect(() => ITEMS_GetItemTypeFromItem113c(m, 0)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x67e),
      )
      expect(() => ITEMS_GetGemApplyTypeFromItem113c(m, 0)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0xf3e),
      )
      expect(() => ITEMS_GetGemApplyTypeFromItem113c(m, 0x20000800)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0xf3f),
      )
      expect(() => ITEMS_GetMagicLevelFromItem113c(m, 0)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0xdad),
      )
      expect(() => ITEMS_GetMagicLevelFromItem113c(m, 0x20000800)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0xdae),
      )
      expect(() => ITEMS_GetGambleCostFromItem113c(m, 0)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0xd94),
      )
      expect(() => ITEMS_GetBitField2FromItem113c(m, 0)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0xd7c),
      )
      expect(() => ITEMS_GetBitField2FromItem113c(m, 0x20000800)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0xd7d),
      )
      expect(() => ITEMS_CanItemBePersonalizedOrRepaired113c(m, 0)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x67e),
      )
      expect(() => ITEMS_CheckIfImbueable113c(m, 0)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x67e),
      )
      expect(() => ITEMS_GetTotalMaxStack113c(m, 0)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0xd5b),
      )
      expect(() => ITEMS_GetTotalMaxStack113c(m, 0x20000800)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0xd5c),
      )
      m.stage(0x6fdeff6c, '000a0020')
      m.stage(0x20000a00, '0100000000000000100a002000000000')
      m.stage(0x20000a10, '6861782001000000')
      m.stage(0x6fdefb94, '0100000000200020')
      m.stage(0x20002080, '6861782068617820')
      m.stage(0x20000900, '0400000000000000')
      expect(() => ITEMS_ComputeGambleBaseCost113c(m, 0x20000900, 10)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0xb1b),
      )
      expect(() => ITEMS_CheckAffixAssignableToItem113c(m, 0, 0x20000880)).toThrowError(
        new D2CommonAssertError('Items.cpp', 0x1505),
      )
    })
  })
})

