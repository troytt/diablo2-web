import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import { INVENTORY_AppendItemGuidNode113c } from '../../../src/d2kern-113c/common/inventory.js'
import {
  D2COMMON_LOG_LOCK_VA_113C,
  LOGGING_WriteLockedEntry113c,
} from '../../../src/d2kern-113c/common/logging.js'
import {
  PLAYER_StoreLeftSkill113c,
  PLAYER_StoreRightSkill113c,
  PLAYER_StoreSwitchLeftSkill113c,
  PLAYER_StoreSwitchRightSkill113c,
} from '../../../src/d2kern-113c/common/quest-record.js'
import {
  ITEMMODS_GetOrCreateStatList113c,
  STATES_CheckStateMaskOnUnit113c,
} from '../../../src/d2kern-113c/common/statlist.js'
import {
  UNITROOM_ClearUnitRoom113c,
  UNITROOM_UnlinkUnitFromUpdateList113c,
  UNITROOM_ValidateUnitInRoom113c,
  UNITS_AreInAdjacentRooms113c,
  UNITS_FreeUnit113c,
  UNITS_GetUnitSizeY113c,
  UNITS_IsAttackAnimMode113c,
} from '../../../src/d2kern-113c/common/unit.js'
import { UNITS_IsInMovingMode113c } from '../../../src/d2kern-113c/common/waypoint.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'
import { SEED_PickRandomListNode113c } from '../../../src/d2kern-113c/prng.js'

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

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b048-vectors.ndjson')

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
  '0x6FD62450': (m, a) => UNITS_AreInAdjacentRooms113c(m, a[0]!, a[1]!),
  '0x6FD69A50': (m, a) => SEED_PickRandomListNode113c(m, a[0]!),
  '0x6FD6E4F0': (m, a) => INVENTORY_AppendItemGuidNode113c(m, a[0]!, a[1]!),
  '0x6FD80590': (m, a) => PLAYER_StoreSwitchLeftSkill113c(m, a[0]!),
  '0x6FD80600': (m, a) => PLAYER_StoreSwitchRightSkill113c(m, a[0]!),
  '0x6FD80670': (m, a) => PLAYER_StoreLeftSkill113c(m, a[0]!),
  '0x6FD806D0': (m, a) => PLAYER_StoreRightSkill113c(m, a[0]!),
  '0x6FD80BD0': (m, a) => UNITS_IsAttackAnimMode113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD80EE0': (m, a) => UNITS_GetUnitSizeY113c(m, a[0]!),
  '0x6FD813F0': (m, a) => UNITS_IsInMovingMode113c(m, a[0]!),
  '0x6FD83990': (m, a) => UNITS_FreeUnit113c(m, a[0]!),
  '0x6FD97020': (m, a) => ITEMMODS_GetOrCreateStatList113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FDB6410': (m, a) => UNITROOM_UnlinkUnitFromUpdateList113c(m, a[0]!),
  '0x6FDB6630': (m, a) => UNITROOM_ValidateUnitInRoom113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FDB68A0': (m, a) => UNITROOM_ClearUnitRoom113c(m, a[0]!),
}

describe('K1 Iteration 9 Lane A — B048 unit/statlist/quest/inventory differential replay', () => {
  const vectors = loadVectors()

  it('covers all 15 diff-verified B048 VAs with >= 2 vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(15)
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

  describe('0x6FD62C00 LOGGING_WriteLockedEntry113c (ported host-I/O probe coverage)', () => {
    it('returns early without scanning string when lock flag 0x6FDF1470 is 0', () => {
      const m = new SparseMemory113c()
      m.setU32(D2COMMON_LOG_LOCK_VA_113C, 0)
      // 0x2000 / 0x3000 are intentionally unloaded: scanning szFile/szFormat when lock==0 would throw!
      LOGGING_WriteLockedEntry113c(m, 0, 0, 0, 0, 0x2000, 12, 0x3000, 0)
      expect(m.u32(D2COMMON_LOG_LOCK_VA_113C)).toBe(0)
    })

    it('scans NUL-terminated szFile/szFormat/vaList and re-reads 0x6FDF1470 when lock flag is non-zero', () => {
      const m = new SparseMemory113c()
      m.setU32(D2COMMON_LOG_LOCK_VA_113C, 1)
      m.setU32(0x6fdf1474, 1)
      const fileAddr = 0x2500
      m.setU8(fileAddr + 0, 0x61)
      m.setU8(fileAddr + 1, 0)
      const fmtAddr = 0x3000
      m.setU8(fmtAddr + 0, 0x25) // '%'
      m.setU8(fmtAddr + 1, 0x64) // 'd'
      m.setU8(fmtAddr + 2, 0)
      const vaAddr = 0x3500
      m.setU32(vaAddr, 42)
      const reads: number[] = []
      const origU32 = m.u32.bind(m)
      m.u32 = (p: number): number => {
        reads.push(p >>> 0)
        return origU32(p)
      }
      LOGGING_WriteLockedEntry113c(m, 0, 0, 0, 0, fileAddr, 10, fmtAddr, vaAddr)
      expect(reads.filter((a) => a === D2COMMON_LOG_LOCK_VA_113C).length).toBe(2)
      expect(reads).toContain(vaAddr)
    })

    it('handles omitted pVaList default=0 without reading va_list when format contains %d', () => {
      const m = new SparseMemory113c()
      m.setU32(D2COMMON_LOG_LOCK_VA_113C, 1)
      m.setU32(0x6fdf1474, 1)
      m.setU8(0x4000, 0)
      m.setU8(0x4100, 0x25)
      m.setU8(0x4101, 0x64)
      m.setU8(0x4102, 0)
      LOGGING_WriteLockedEntry113c(m, 0, 0, 0, 0, 0x4000, 1, 0x4100)
    })
  })

  describe('0x6FD6E4F0, 0x6FD80590..0x6FD806D0, 0x6FD97020 & 0x6FD83C20 edge paths', () => {
    it('all 4 PLAYER_Store*Skill113c functions zero target skillId slot before asserting line 0x638 (1592) on null skill', () => {
      const cases: Array<{
        fn: (m: SparseMemory113c, pUnit: number) => void
        skillOff: number
        ownerOff: number
      }> = [
        { fn: PLAYER_StoreSwitchLeftSkill113c, skillOff: 0x84, ownerOff: 0x8c },
        { fn: PLAYER_StoreSwitchRightSkill113c, skillOff: 0x80, ownerOff: 0x88 },
        { fn: PLAYER_StoreLeftSkill113c, skillOff: 0x74, ownerOff: 0x7c },
        { fn: PLAYER_StoreRightSkill113c, skillOff: 0x70, ownerOff: 0x78 },
      ]
      for (const { fn, skillOff, ownerOff } of cases) {
        const m = new SparseMemory113c()
        const pUnit = 0x14000
        const pPlr = 0x14200
        const pSkList = 0x14400
        m.loadBlock(pUnit, new Uint8Array(0xc0))
        m.loadBlock(pPlr, new Uint8Array(0xa0))
        m.loadBlock(pSkList, new Uint8Array(0x20))
        m.setU32(pUnit, 0)
        m.setU32(pUnit + 0x14, pPlr)
        m.setU32(pUnit + 0xa8, pSkList)
        m.setU32(pPlr + skillOff, 0xdeadbeef)
        m.setU32(pPlr + ownerOff, 0xcafebabe)
        let caught: unknown
        try {
          fn(m, pUnit)
        } catch (err) {
          caught = err
        }
        expect(caught).toBeInstanceOf(D2CommonAssertError)
        expect((caught as D2CommonAssertError).line).toBe(0x638)
        expect(m.u32(pPlr + skillOff)).toBe(0)
        expect(m.u32(pPlr + ownerOff)).toBe(0xcafebabe)
      }
    })
    it('INVENTORY_AppendItemGuidNode113c throws D2CommonAssertError line 0xd0b when node alloc returns 0', () => {
      const m = new SparseMemory113c()
      const pInv = 0x12000
      const pItem = 0x13000
      m.loadBlock(pInv, new Uint8Array(0x40))
      m.loadBlock(pItem, new Uint8Array(0x20))
      m.setU32(pInv, 0x01020304)
      m.setU32(pItem, 4)
      m.setU32(pItem + 0x0c, 0x4455)
      m.alloc = () => 0
      let caught: unknown
      try {
        INVENTORY_AppendItemGuidNode113c(m, pInv, pItem)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(D2CommonAssertError)
      expect((caught as D2CommonAssertError).line).toBe(0xd0b)
    })

    it('throws D2CommonAssertError line 0x201 when statlist allocation returns 0', () => {
      const m = new SparseMemory113c()
      const pItem = 0x10000
      m.loadBlock(pItem, new Uint8Array(0x80))
      m.setU32(pItem, 4)
      m.setU32(pItem + 0x0c, 123)
      m.alloc = () => 0
      let caught: unknown
      try {
        ITEMMODS_GetOrCreateStatList113c(m, pItem, 0, 5, 0x40)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(D2CommonAssertError)
      expect((caught as D2CommonAssertError).line).toBe(0x201)
    })

    it('STATES_CheckStateMaskOnUnit113c honors dynamic state count <= -32 (0 dwords)', () => {
      const m = new SparseMemory113c()
      const sgpt = 0x20000
      const pUnit = 0x21000
      const pListEx = 0x22000
      m.loadBlock(sgpt, new Uint8Array(0x100))
      m.loadBlock(pUnit, new Uint8Array(0x80))
      m.loadBlock(pListEx, new Uint8Array(0x64))
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(sgpt + 0xc4, (-32) >>> 0)
      m.setU32(pUnit + 0x5c, pListEx)
      m.setU32(pListEx + 0x10, 0x80000000)
      m.setU32(pListEx + 0x58, 0x30000) // unloaded: must NOT be read when nDwords == 0!
      expect(STATES_CheckStateMaskOnUnit113c(m, pUnit, 0x40000)).toBe(0)
    })
  })
})
