import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import { MISSILE_CalculateDamageData113c } from '../../../src/d2kern-113c/common/missile.js'
import {
  ITEMMODS_ApplyItemModProperty113c,
  ITEMMODS_ApplyStateSkillTripletMod113c,
  ITEMMODS_RemoveItemModProperty113c,
  ITEMS_LoadStatsFromBitstream113c,
  ITEMS_ReadCompactEarItemFromBitstream113c,
  ITEMS_ReadItemBitstream113c,
  MISSILE_ApplyDamageDataToStatList113c,
} from '../../../src/d2kern-113c/common/statlist.js'
import {
  UNITS_GetAnimDataRecord113c,
  UNITS_SetUnitAnimMode113c,
  UNITS_UpdateAnimFrame113c,
} from '../../../src/d2kern-113c/common/unit.js'
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

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i13a-2-vectors.ndjson')

const DISPATCH: Record<string, (m: SparseMemory113c, args: number[]) => number | void> = {
  '0x6FD7A600': (m, a) => ITEMS_ReadItemBitstream113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD7C0C0': (m, a) => ITEMS_ReadCompactEarItemFromBitstream113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD7C470': (m, a) => ITEMS_LoadStatsFromBitstream113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FD82670': (m, a) => UNITS_GetAnimDataRecord113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD83110': (m, a) => UNITS_SetUnitAnimMode113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD835F0': (m, a) => UNITS_UpdateAnimFrame113c(m, a[0]!),
  '0x6FD98BD0': (m, a) => ITEMMODS_ApplyStateSkillTripletMod113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FD99AF0': (m, a) => ITEMMODS_ApplyItemModProperty113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FD99F30': (m, a) => ITEMMODS_RemoveItemModProperty113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FDBB4A0': (m, a) => MISSILE_ApplyDamageDataToStatList113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FDBBAA0': (m, a) => MISSILE_CalculateDamageData113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
}

describe('K1 Iteration 13 Lane A — I13A-2 differential replay', () => {
  const vectors = loadVectors(FIXTURE_PATH)

  it('covers all 11 net-new VAs in i13a-2-vectors.ndjson with >= 3 non-degenerate vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(11)
    for (const va of Object.keys(DISPATCH)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3)
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

describe('K1 Iteration 13 Lane A — I13A-2 unit edge-case coverage', () => {
  function makeTestMem(): SparseMemory113c {
    const m = new SparseMemory113c()
    m.loadBlock(0x00000000, new Uint8Array(0x1000))
    m.loadBlock(0x03500000, new Uint8Array(0x50000))
    m.loadBlock(0x6fdd0000, new Uint8Array(0x28000))
    const sgpt = 0x03500000
    m.setU32(0x6fde9e1c, sgpt)
    m.setU32(0x6fdefb94, 16)
    m.setU32(0x6fdefb98, 0x03510000) // ItemsTxt
    m.setU32(0x6fdefbbc, 0x03518000) // MagicAffix
    m.setU32(0x6fdefbc4, 0x03518000)
    m.setU32(0x6fdefbc8, 0x03518000)
    m.setU32(0x6fdef020, 2)
    m.setU32(0x6fdef028, 0x20687468); m.setU16(0x6fdef02c, 0) // 'hth '
    m.setU32(0x6fdef030, 0x20736831); m.setU16(0x6fdef034, 2) // '1hs '
    m.setU32(0x6fdf0b4c, 0x03520000) // AnimDataTable
    m.setU32(0x6fdf13a4, 16); m.setU32(0x6fdf13b0, 0x03522000)
    m.setU32(0x6fdf13c4, 20); m.setU32(0x6fdf13c8, 1)
    m.setU32(0x6fdf13cc, 0x03523000); m.setU32(0x6fdf13d0, 0x03524000)
    m.setU32(0x6fdf0950, 0x03525000); m.setU32(0x6fdf0954, 0x03528000); m.setU32(0x6fdf0958, 100)
    m.setU32(0x6fddc5f8, 0x0352a000); m.setU32(0x6fde4608, 0x0352b000)
    m.setU32(0x6fddf088, 0); m.setU32(0x6fdd90b0, 0x0352c000); m.setU32(0x0352c000 + (0x65 & 0x1f) * 4, 1 << (0x65 & 31)) // gdwBitMasks
    m.setU32(sgpt + 0x0bc, 0x0352d000); m.setU32(sgpt + 0x0c4, 185)
    m.setU32(sgpt + 0xa78, 0x03525000); m.setU32(sgpt + 0xa80, 100)
    m.setU32(sgpt + 0xa90, 0x03528000); m.setU32(sgpt + 0xa98, 100)
    m.setU32(sgpt + 0xb64, 0x0352e000); m.setU32(sgpt + 0xb6c, 16)
    m.setU32(sgpt + 0xb98, 0x03530000); m.setU32(sgpt + 0xba0, 32)
    m.setU32(sgpt + 0xbc0, 100); m.setU32(sgpt + 0xbc4, 0x03534000); m.setU32(sgpt + 0xbc8, 7)
    m.setU32(sgpt + 0xbcc, 0x03535000); m.setU32(sgpt + 0xbd4, 359)
    m.setU32(sgpt + 0xbf8, 0x03514000); m.setU32(sgpt + 0xbfc, 96)
    m.setU32(sgpt + 0xc00, 96); m.setU32(sgpt + 0xc04, 0x03516000)
    m.setU32(0x6fdefb98, 0x03510000)
    m.setU32(0x6fdeff6c, 0x03517000) // ItemsCodeLink
    m.setU32(0x03517000, 3); m.setU32(0x03517008, 0x03517010)
    m.setU32(0x03517010, 0x20637374); m.setU32(0x03517014, 1) // 'tsc '
    m.setU32(0x03517018, 0x20706163); m.setU32(0x0351701c, 2) // 'cap '
    m.setU32(0x03517020, 0x20736831); m.setU32(0x03517024, 0) // '1hs '
    // Item 0: '1hs ', Item 1: 'tsc ' (misc), Item 2: 'cap ' (type 0x25->0x32)
    m.setU32(0x03510000 + 0 * 0x1a8 + 0x80, 0x20736831); m.setU16(0x03510000 + 0 * 0x1a8 + 0x11e, 0x1e)
    m.setU32(0x03510000 + 1 * 0x1a8 + 0x80, 0x20637374); m.setU16(0x03510000 + 1 * 0x1a8 + 0x11e, 0x16)
    m.setU8(0x03510000 + 1 * 0x1a8 + 0x12a, 1); m.setU8(0x03510000 + 1 * 0x1a8 + 0x12b, 1)
    m.setU32(0x03510000 + 2 * 0x1a8 + 0x80, 0x20706163); m.setU16(0x03510000 + 2 * 0x1a8 + 0x11e, 0x25)
    m.setU32(0x03516000 + 0x25 * 12 + 4, 1 << (0x32 - 32))
    for (let s = 0; s < 359; s++) m.setU8(0x03535000 + s * 0x144 + 0x19, 8)
    for (let b = 0; b < 256; b++) m.setU32(0x03520000 + 4 + b * 4, 0x035204b0)
    m.setU32(0x03520000 + 0x40c, 8); m.setU32(0x03520000 + 0x410, 256)
    for (let i = 0; i < 20; i++) m.setU32(0x03524000 + i * 0x34 + 0x20, i === 2 ? 0x20204c57 : 0x20204e54)
    for (let i = 0; i < 16; i++) m.setU32(0x03522000 + i * 0x34 + 0x20, 0x2020554e)
    return m
  }

  function writeBits(m: SparseMemory113c, buf: number, vals: Array<[number, number]>): void {
    let bit = 0
    for (const [v, n] of vals) {
      for (let i = 0; i < n; i++) {
        if (((v >>> i) & 1) !== 0) {
          const byteAddr = (buf + (bit >>> 3)) >>> 0
          m.setU8(byteAddr, m.u8(byteAddr) | (1 << (bit & 7)))
        }
        bit++
      }
    }
  }

  it('ITEMS_ReadItemBitstream113c respects nIscCount === 0x1f boundary', () => {
    const m = makeTestMem()
    const item = 0x03501000
    const pd = 0x03501200
    const bs = 0x03501400
    const data = 0x03501500
    m.setU32(item + 0x14, pd)
    m.setU32(bs, data); m.setU32(bs + 4, 256)

    // Armor 'cap ' with nIscCount === 0x1f boundary
    m.setU32(item, 4); m.setU32(item + 0x2c, 0x03501300)
    m.setU32(0x03500000 + 0xbd4, 0x1f)
    m.setU32(0x0000001c, 5) // when pIsc1f===0 reads -5; when pIsc1f!=0 reads 0 -> diff acVal
    for (let i = 0; i < 64; i++) m.setU8(data + i, 0)
    writeBits(m, data, [[0, 28], [0x20706163, 32], [0, 3], [1, 32], [10, 7], [2, 4], [0, 1], [0, 1]])
    m.setU32(bs + 8, 0); m.setU32(bs + 12, 0); m.setU32(bs + 16, 0)
    const sl = 0x03501700
    m.setU32(item + 0x5c, sl); m.setU32(sl + 0x10, 0x80000000)
    m.setU32(sl + 0x48, 0x03501800); m.setU16(sl + 0x4e, 8)
    ITEMS_ReadItemBitstream113c(m, item, bs, 0, 0, 0x03501600, 0x60)
    expect(m.u16(sl + 0x4c)).toBe(0)
  })

  it('ITEMS_ReadCompactEarItemFromBitstream113c & ITEMS_LoadStatsFromBitstream113c handle 0x164 assert and res===0', () => {
    const m = makeTestMem()
    const item = 0x03501000
    const pd = 0x03501200
    const bs = 0x03501400
    const data = 0x03501500
    m.setU32(item, 4); m.setU32(item + 0x14, pd); m.setU32(item + 0x2c, 0x03501300)
    m.setU32(bs, data); m.setU32(bs + 4, 256)
    writeBits(m, data, [[0, 28], [0x20637374, 32]])

    // nIscCount === 0x164 asserts at L7305
    m.setU32(0x03500000 + 0xbd4, 0x164)
    expect(() => ITEMS_ReadCompactEarItemFromBitstream113c(m, item, bs, 0, 0x60)).toThrowError(D2CommonAssertError)

    // ITEMS_LoadStatsFromBitstream113c res <= 0 (ear bit 0x200000 with bad baseCode at L7300 -> returns -1)
    for (let i = 0; i < 64; i++) m.setU8(data + i, 0)
    m.setU32(item, 4); m.setU32(pd + 0x18, 0)
    m.setU32(0x03510000 + 1 * 0x1a8 + 0x80, 0x78787878) // L7276 finds idx=1 ('tsc '), L7298 gets 0x78787878 -> L7300 returns -1
    writeBits(m, data, [[0x200000, 32], [0, 28], [0x20637374, 32]])
    const outFail = 0x03501900
    m.setU32(outFail, 0)
    ITEMS_LoadStatsFromBitstream113c(m, item, data, 64, 0, 0x03501600, 0x60, outFail)
    expect(m.u32(outFail)).toBe(1)
  })

  it('UNITS_SetUnitAnimMode113c & UNITS_UpdateAnimFrame113c cover walk state 0x65, mode0 reset, and object mode 8', () => {
    const m = makeTestMem()
    const u = 0x03501000
    const sl = 0x03501200
    const sf = 0x03501300
    m.setU32(u, 0); m.setU32(u + 0x10, 2); m.setU32(u + 0x5c, sl)
    m.setU32(sl + 0x10, 0x80000000); m.setU32(sl + 0x58, sf)
    m.setU32(sf + (0x65 >> 5) * 4, 1 << (0x65 & 31))
    // Make AnimData dwAnimSpeed = 256 (+0x0c = 256)
    m.setU32(0x03520000 + 0x40c, 8); m.setU32(0x03520000 + 0x4b0 + 0x0c, 256)
    // Walk mode 9 (player walk!) with state 0x65 -> basePct = 100 -> 256
    m.setU32(u + 0x10, 9)
    UNITS_SetUnitAnimMode113c(m, u, 0, 0)
    expect(m.u16(u + 0x4c)).toBe(256)
    // Walk mode 9 with state 0x65 cleared -> basePct = 50 -> 128
    m.setU32(sf + (0x65 >> 5) * 4, 0)
    UNITS_SetUnitAnimMode113c(m, u, 0, 0)
    expect(m.u16(u + 0x4c)).toBe(128)

    // UNITS_UpdateAnimFrame113c mode 0 (not run/seq) calls SetUnitAnimMode(u, 0, 0) -> 48 (vs mode 1 WL -> 128!)
    m.setU32(u + 0x10, 2)
    m.setU32(0x03524000 + 1 * 0x34 + 0x20, 0x20204c57)
    UNITS_UpdateAnimFrame113c(m, u)
    expect(m.u16(u + 0x4c)).toBe(38)

    // Object mode >= 8 asserts
    m.setU32(u, 2); m.setU32(u + 0x10, 8)
    expect(() => UNITS_UpdateAnimFrame113c(m, u)).toThrowError(D2CommonAssertError)
  })

  it('ITEMMODS_ApplyStateSkillTripletMod113c handles itemType === 0 throwable & MISSILE_CalculateDamageData113c negative s21', () => {
    const m = makeTestMem()
    const item = 0x03501000
    const sl = 0x03501200
    const prop = 0x03501400
    m.setU32(item, 4); m.setU32(item + 4, 0); m.setU32(item + 0x5c, sl)
    m.setU16(0x03510000 + 0 * 0x1a8 + 0x11e, 0) // itemType = 0!
    m.setU32(sl + 0x10, 0x80000000); m.setU32(sl + 0x48, 0x03501500); m.setU16(sl + 0x4e, 8)
    m.setU8(0x03514000 + 0x10, 1) // ItemTypes[0].throwable = 1
    m.setU32(prop + 8, 10); m.setU32(prop + 12, 20)
    ITEMMODS_ApplyStateSkillTripletMod113c(m, 0, 0, item, prop, 0x15, 0, 0, 0x40)
    expect(m.u16(sl + 0x4c)).toBe(6) // 0x15, 0x16, 0x17, 0x18, 0x9f, 0xa0 (throwable itemType===0!)

    // Negative s21 (-3) with scale128 = 64
    const dmg = 0x03502000
    const owner = 0x03502100
    const alt = 0x03502200
    const mis = 0x03502300
    const altSl = 0x03502400
    const altStats = 0x03502500
    m.setU32(owner, 0); m.setU32(mis, 3); m.setU32(mis + 4, 1); m.setU32(mis + 0x14, 0x03502600)
    m.setU32(alt, 0); m.setU32(alt + 0x5c, altSl)
    m.setU32(altSl + 0x10, 0x80000000); m.setU32(altSl + 0x48, altStats); m.setU16(altSl + 0x4c, 1); m.setU16(altSl + 0x4e, 4)
    m.setU32(altStats, 0x00150000); m.setU32(altStats + 4, (-3) >>> 0)
    m.setU16(0x0352e000 + 1 * 0x1a4 + 0x194, 0xffff)
    m.setU8(0x0352e000 + 1 * 0x1a4 + 0x12e, 64)
    MISSILE_CalculateDamageData113c(m, dmg, owner, alt, mis, 1)
    expect(m.u32(dmg + 4) | 0).toBe(-1)
  })
})
