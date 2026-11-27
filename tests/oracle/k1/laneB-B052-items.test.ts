import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_AreStackableWeaponsCompatible113c,
  ITEMS_B043_GetMaxDurabilityFromUnit113c,
  ITEMS_B043_GetStatDiffAfterClear113c,
  ITEMS_B043_GetTotalStatFromUnitFast113c,
  ITEMS_CanItemBeShownInTradeOrStash113c,
  ITEMS_CanItemLoseDurability113c,
  ITEMS_CheckItemIdMatchesItemType113c,
  ITEMS_CountSocketedItemsInGemSocketable113c,
  ITEMS_EvalItemStatCallback113c,
  ITEMS_FindMatchingRunesTxtRecord113c,
  ITEMS_GetActiveWeaponClassCodeIdx113c,
  ITEMS_GetEquippedSetItemsMask113c,
  ITEMS_GetInvWidthFromItem113c,
  ITEMS_GetSetItemsSetId113c,
  ITEMS_GetSetItemsTxtRecordFromItem113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_GetUnitHitClass113c,
  ITEMS_RollItemOrUnitSeedRange113c,
  ITEMS_RollRandomInRangeCallback113c,
  ITEMS_SumStatAcrossSocketedItems113c,
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
  /** Present when the real DLL hit its Fog assert (0x6FD5921C, captured line) instead of returning. */
  expectedAssert?: { line: number }
  post: { addr: number; hex: string }[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b052-vectors.ndjson')

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
  '0x6FD73D70': (m, a) => ITEMS_GetSetItemsSetId113c(m, a[0]!) >>> 0,
  '0x6FD73F40': (m, a) => ITEMS_GetSetItemsTxtRecordFromItem113c(m, a[0]!) >>> 0,
  '0x6FD73F90': (m, a) => ITEMS_GetEquippedSetItemsMask113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD741D0': (m, a) => ITEMS_CanItemBeShownInTradeOrStash113c(m, a[0]!) >>> 0,
  '0x6FD74500': (m, a) => ITEMS_CheckItemIdMatchesItemType113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD746F0': (m, a) => ITEMS_GetSubTypeFromItem113c(m, a[0]!) >>> 0,
  '0x6FD74BF0': (m, a) => ITEMS_GetInvWidthFromItem113c(m, a[0]!) >>> 0,
  '0x6FD74F90': (m, a) => ITEMS_CountSocketedItemsInGemSocketable113c(m, a[0]!) >>> 0,
  '0x6FD766E0': (m, a) => {
    ITEMS_SumStatAcrossSocketedItems113c(m, a[0]!, a[1]!, a[2]!)
    return 0
  },
  '0x6FD767C0': (m, a) => ITEMS_RollRandomInRangeCallback113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD76930': (m, a) => ITEMS_AreStackableWeaponsCompatible113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD76BA0': (m, a) => ITEMS_FindMatchingRunesTxtRecord113c(m, a[0]!) >>> 0,
  '0x6FD76D40': (m, a) => ITEMS_CanItemLoseDurability113c(m, a[0]!) >>> 0,
  '0x6FD77120': (m, a) => ITEMS_EvalItemStatCallback113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD821C0': (m, a) => ITEMS_GetActiveWeaponClassCodeIdx113c(m, a[0]!) >>> 0,
  '0x6FD821E0': (m, a) => ITEMS_GetUnitHitClass113c(m, a[0]!) >>> 0,
  '0x6FD965B0': (m, a) => ITEMS_RollItemOrUnitSeedRange113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD88FF0': (m, a) => ITEMS_B043_GetMaxDurabilityFromUnit113c(m, a[0]!) >>> 0,
  '0x6FD89380': (m, a) => ITEMS_B043_GetStatDiffAfterClear113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD89430': (m, a) => ITEMS_B043_GetTotalStatFromUnitFast113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
}

describe('K1r2 Iteration 8 Lane B — B052 items internalComposite differential verification (17 functions + 3 B043 callees)', () => {
  it('loads all 20 function VAs (17 B052 + 3 B043 callees) and >= 75 real-DLL vectors', () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(75)
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(20)
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
})
