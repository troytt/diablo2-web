import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ITEMS_AutoPlaceIntoBelt113c,
  ITEMS_ComputeTransactionCost113c,
  ITEMS_GetItemColorColormap113c,
  ITEMS_SerializeItemBitstream113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { DRLGOUTANIM_PlaceLevelPresets113c } from '../../../src/d2kern-113c/tables/anim-tbls-113c.ts'
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i13b-1-vectors.ndjson')

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
  '0x6FD71EE0': (m, a) => ITEMS_AutoPlaceIntoBelt113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD751C0': (m, a) => ITEMS_GetItemColorColormap113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD77180': (m, a) => {
    ITEMS_SerializeItemBitstream113c(m, a[0]!, a[1]!, a[2]!, a[3]!)
    return 0
  },
  '0x6FD78E80': (m, a) =>
    ITEMS_ComputeTransactionCost113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) >>> 0,
  '0x6FD91A20': (m, a) => {
    DRLGOUTANIM_PlaceLevelPresets113c(m, a[0]!)
    return 0
  },
}

function stageAll(v: VectorRecord): StrictMem {
  const m = new StrictMem()
  for (const blk of v.pre) {
    m.stage(blk.addr >>> 0, blk.hex)
  }
  return m
}

describe('K1r11 Iteration 13 Lane B — I13B-1 differential verification (5 functions)', () => {
  it('loads all 5 I13B-1 function VAs from the real-DLL fixture', () => {
    const uniqueVas = new Set(VECTORS.map((v) => v.va))
    expect(uniqueVas.size).toBe(5)
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

  it('covers I13B-1 assertions and edge branches', () => {
    const m = new SparseMemory113c()
    m.fill(0x1000, 0x100, 0)
    m.fill(0x2000, 0x200, 0)
    m.setU32(0x6fdefb94, 0)
    m.setU32(0x2000, 4) // UNIT_ITEM
    expect(ITEMS_AutoPlaceIntoBelt113c(m, 0x1000, 0, 0)).toBe(0)
    const vBelt = VECTORS.find(
      (x) => x.name === 'ITEMS_AutoPlaceIntoBelt113c' && x.caseId === 'beltable_slot0',
    )!
    expect(ITEMS_AutoPlaceIntoBelt113c(stageAll(vBelt), 0, vBelt.args[1]!, 0)).toBe(0)
    m.setU32(0x2000, 3) // not UNIT_ITEM
    expect(ITEMS_AutoPlaceIntoBelt113c(m, 0x1000, 0x2000, 0)).toBe(0)
    expect(ITEMS_GetItemColorColormap113c(m, 0x1000, 0, 0x1100, 0)).toBe(0)
    expect(() => ITEMS_SerializeItemBitstream113c(m, 0, 0x1000, 0, 0)).toThrowError(
      D2CommonAssertError,
    )
    expect(() => ITEMS_SerializeItemBitstream113c(m, 0x2000, 0x1000, 0, 0)).toThrowError(
      D2CommonAssertError,
    )
    expect(ITEMS_ComputeTransactionCost113c(m, 0x1000, 0, 0, 0, 0, 0)).toBe(0x7fffffff)
    expect(ITEMS_ComputeTransactionCost113c(m, 0, 0x2000, 0, 0, 0, 0)).toBe(0x7fffffff)
    expect(ITEMS_ComputeTransactionCost113c(m, 0x1000, 0x2000, 0, 0, 0, 0)).toBe(0x7fffffff)

    // pData === 0 fallback in ITEMS_GetItemColorColormap113c (kills 0 -> 1 mutant on pData !== 0)
    const vPlain = VECTORS.find(
      (x) => x.name === 'ITEMS_GetItemColorColormap113c' && x.caseId === 'plain_no_color_zero',
    )!
    const mColor = stageAll(vPlain)
    mColor.setU32((vPlain.args[1]! + 0x14) >>> 0, 0)
    expect(
      ITEMS_GetItemColorColormap113c(
        mColor,
        vPlain.args[0]!,
        vPlain.args[1]!,
        vPlain.args[2]!,
        vPlain.args[3]!,
      ),
    ).toBe(0)

    const getVec = (name: string, caseId: string): VectorRecord => {
      const found = VECTORS.find((x) => x.name === name && x.caseId === caseId)
      if (!found) throw new D2CommonAssertError('test', 0)
      return found
    }

    // n=2: w === 1 && h === 2 in ITEMS_AutoPlaceIntoBelt113c (kills || -> &&)
    {
      const v = getVec('ITEMS_AutoPlaceIntoBelt113c', 'beltable_slot0')
      const mh = stageAll(v)
      const pTxt = (mh.u32(0x6fdefb98) + 2 * 0x1a8) >>> 0
      mh.setU8((pTxt + 0x110) >>> 0, 2)
      expect(ITEMS_AutoPlaceIntoBelt113c(mh, v.args[0]!, v.args[1]!, v.args[2]!)).toBe(0)
    }

    // n=6: socketed_gem_color with nItemTypes>=32 and bBelt=3 reaches pGemsTxt + 0x2f (color 9 -> 0x6fe425a8)
    {
      const v = getVec('ITEMS_GetItemColorColormap113c', 'socketed_gem_color')
      const mg = stageAll(v)
      const sgpt = mg.u32(0x6fde9e1c)
      mg.setU32((sgpt + 0xbfc) >>> 0, 32)
      const pTxt = (mg.u32(0x6fdefb98) + 1 * 0x1a8) >>> 0
      mg.setU8((pTxt + 0x138) >>> 0, 3)
      const ret = ITEMS_GetItemColorColormap113c(mg, v.args[0]!, v.args[1]!, v.args[2]!, v.args[3]!)
      expect(ret).toBe(0x6fe425a8)
      expect(mg.u8(v.args[2]!)).toBe(0x49)
    }

    // n=7: SET item with invCol === 0 and valid invTransform=2 when bInventory = 1 (kills invCol < 0 -> <= 0)
    {
      const v = getVec('ITEMS_GetItemColorColormap113c', 'set_char_color')
      const ms = stageAll(v)
      const sgpt = ms.u32(0x6fde9e1c)
      const pSet = (ms.u32((sgpt + 0xc18) >>> 0) + 1 * 0x1b8) >>> 0
      ms.setU8((pSet + 0x41) >>> 0, 0)
      const classId = ms.u32((v.args[1]! + 4) >>> 0)
      const pTxt = (ms.u32(0x6fdefb98) + classId * 0x1a8) >>> 0
      ms.setU8((pTxt + 0x142) >>> 0, 2)
      expect(ITEMS_GetItemColorColormap113c(ms, v.args[0]!, v.args[1]!, v.args[2]!, 1)).not.toBe(0)
    }

    // n=8: SerializeItemBitstream paramBits === 1 writes 1 param bit (kills paramBits > 0 -> paramBits > 1)
    {
      const v = getVec('ITEMS_SerializeItemBitstream113c', 'magic_armor_srv')
      const m0 = stageAll(v)
      ITEMS_SerializeItemBitstream113c(m0, v.args[0]!, v.args[1]!, 1, 0)
      const bitsBase = ((m0.u32((v.args[1]! + 8) >>> 0) << 3) + m0.u32((v.args[1]! + 0x0c) >>> 0)) | 0

      const mp = stageAll(v)
      const pIsc = (mp.u32((mp.u32(0x6fde9e1c) + 0xbcc) >>> 0) + 0x10 * 0x144) >>> 0
      mp.setU32((pIsc + 0x24) >>> 0, 1)
      ITEMS_SerializeItemBitstream113c(mp, v.args[0]!, v.args[1]!, 1, 0)
      const bitsParam = ((mp.u32((v.args[1]! + 8) >>> 0) << 3) + mp.u32((v.args[1]! + 0x0c) >>> 0)) | 0
      expect(bitsParam).toBe(bitsBase + 1)
    }

    // n=11: SerializeItemBitstream autoAffix === nAutoBase (12)
    {
      const v = getVec('ITEMS_SerializeItemBitstream113c', 'normal_sword_no_srv')
      const m0 = stageAll(v)
      ITEMS_SerializeItemBitstream113c(m0, v.args[0]!, v.args[1]!, 0, 0)
      const bitsBase = ((m0.u32((v.args[1]! + 8) >>> 0) << 3) + m0.u32((v.args[1]! + 0x0c) >>> 0)) | 0

      const ma = stageAll(v)
      const pData = ma.u32((v.args[0]! + 0x14) >>> 0)
      ma.setU16((pData + 0x36) >>> 0, 12)
      ITEMS_SerializeItemBitstream113c(ma, v.args[0]!, v.args[1]!, 0, 0)
      const bitsAuto = ((ma.u32((v.args[1]! + 8) >>> 0) << 3) + ma.u32((v.args[1]! + 0x0c) >>> 0)) | 0
      expect(bitsAuto).toBe(bitsBase + 11)
    }

    // n=10: MAGIC quality (4) unidentified (cmdFlags=0) with srv=0 skips magic prefix/suffix (kills & -> |)
    {
      const v = getVec('ITEMS_SerializeItemBitstream113c', 'magic_armor_srv')
      const mh0 = stageAll(v)
      const pData = mh0.u32((v.args[0]! + 0x14) >>> 0)
      mh0.setU32(pData, 4) // MAGIC
      mh0.setU32((pData + 0x18) >>> 0, 0) // unidentified
      ITEMS_SerializeItemBitstream113c(mh0, v.args[0]!, v.args[1]!, 0, 0)
      const bitsUnid = ((mh0.u32((v.args[1]! + 8) >>> 0) << 3) + mh0.u32((v.args[1]! + 0x0c) >>> 0)) | 0

      const mhId = stageAll(v)
      const pData2 = mhId.u32((v.args[0]! + 0x14) >>> 0)
      mhId.setU32(pData2, 4) // MAGIC
      mhId.setU32((pData2 + 0x18) >>> 0, 0x10) // identified
      ITEMS_SerializeItemBitstream113c(mhId, v.args[0]!, v.args[1]!, 0, 0)
      const bitsId = ((mhId.u32((v.args[1]! + 8) >>> 0) << 3) + mhId.u32((v.args[1]! + 0x0c) >>> 0)) | 0
      expect(bitsUnid).toBe(76)
      expect(bitsId).toBe(145)
    }

    // n=12: Ethereal sellCost / 4 vs / 8
    {
      const v = getVec('ITEMS_ComputeTransactionCost113c', 'sell_unique_hell_capped')
      const me = stageAll(v)
      const pData = me.u32((v.args[1]! + 0x14) >>> 0)
      me.setU32((pData + 0x18) >>> 0, me.u32((pData + 0x18) >>> 0) | 0x400000)
      const ethSell = ITEMS_ComputeTransactionCost113c(
        me, v.args[0]!, v.args[1]!, v.args[2]!, v.args[3]!, v.args[4]!, v.args[5]!,
      )
      expect(ethSell).toBeGreaterThanOrEqual(45)
    }

    // n=13: qId === 0 NPC quest slot must not apply quest discount even if quest bit 0 is set
    {
      const v = getVec('ITEMS_ComputeTransactionCost113c', 'buy_magic_armor')
      const mq = stageAll(v)
      const pQBits = mq.u32(v.args[3]!)
      mq.setU8(pQBits, mq.u8(pQBits) | 1)
      const pNpc = mq.u32(0x6fdf0880)
      mq.setU32((pNpc + 0x20) >>> 0, 512)
      expect(
        ITEMS_ComputeTransactionCost113c(
          mq, v.args[0]!, v.args[1]!, v.args[2]!, v.args[3]!, v.args[4]!, v.args[5]!,
        ),
      ).toBe(v.eax)
    }

    // n=15: wItemFormat === 1 in GAMBLE branch (kills >= 1 -> > 1)
    {
      const v = getVec('ITEMS_ComputeTransactionCost113c', 'gamble_sword')
      const mf = stageAll(v)
      const pData = mf.u32((v.args[1]! + 0x14) >>> 0)
      mf.setU16((pData + 0x30) >>> 0, 1)
      expect(
        ITEMS_ComputeTransactionCost113c(
          mf, v.args[0]!, v.args[1]!, v.args[2]!, v.args[3]!, v.args[4]!, v.args[5]!,
        ),
      ).toBe(v.eax)
    }
  })
})
