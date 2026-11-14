import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import { INVENTORY_GetEquippedWeaponHandClass113c } from '../../../src/d2kern-113c/common/inventory.js'
import {
  STATES_CheckStateMask2OnUnit113c,
  STATES_CheckStateMask4OnUnit113c,
  STATES_CheckStateMask6OnUnit113c,
  STATES_CheckStateMask30OnUnit113c,
  STATES_CheckStateMask32OnUnit113c,
  STATES_CheckStateMaskByIndexOnUnit113c,
  STATES_SetUnitSourceUnit113c,
  STATLIST_DeactivateWeaponDamageStats113c,
  STATLIST_GetTotalStatWithLayerInline113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitHirelingResurrectCost113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitMaxDamage113c,
  STATLIST_GetUnitMinDamage113c,
  STATLIST_NotifyIfStatModified113c,
  STATLIST_ReactivateWeaponDamageStats113c,
  STATLIST_SetFullStatEntry113c,
  STATLIST_SetWeaponStatListActive113c,
} from '../../../src/d2kern-113c/common/statlist.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'
import { DRLGOUTJUNG_BuildJunglePresets113c } from '../../../src/d2kern-113c/prng.js'

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

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i10a-1-vectors.ndjson')

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
  '0x6FD6FB80': (m, a) => INVENTORY_GetEquippedWeaponHandClass113c(m, a[0]!, a[1]!),
  '0x6FD7CC60': (m, a) => STATLIST_GetUnitHirelingResurrectCost113c(m, a[0]!),
  '0x6FD81940': (m, a) => STATLIST_GetUnitGoldBankLimit113c(m, a[0]!),
  '0x6FD82330': (m, a) => STATLIST_GetUnitLifePercent113c(m, a[0]!),
  '0x6FD82CA0': (m, a) => STATES_SetUnitSourceUnit113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD83D10': (m, a) => STATES_CheckStateMaskByIndexOnUnit113c(m, a[0]!, a[1]!),
  '0x6FD83D80': (m, a) => STATES_CheckStateMask32OnUnit113c(m, a[0]!),
  '0x6FD83DC0': (m, a) => STATES_CheckStateMask30OnUnit113c(m, a[0]!),
  '0x6FD83FE0': (m, a) => STATES_CheckStateMask6OnUnit113c(m, a[0]!),
  '0x6FD84020': (m, a) => STATES_CheckStateMask2OnUnit113c(m, a[0]!),
  '0x6FD84040': (m, a) => STATES_CheckStateMask4OnUnit113c(m, a[0]!),
  '0x6FD888E0': (m, a) =>
    STATLIST_NotifyIfStatModified113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[1]! !== 0
        ? (m2, u, s, v, arg) => {
            m2.setU32(arg >>> 0, u >>> 0)
            m2.setU32((arg + 4) >>> 0, s >>> 0)
            m2.setU32((arg + 8) >>> 0, v >>> 0)
            m2.setU32((arg + 12) >>> 0, 0xcafe0001)
          }
        : undefined,
    ),
  '0x6FD88940': (m, a) =>
    STATLIST_SetFullStatEntry113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      (m2, g, o, u, k, ov, nv) => {
        const d = 0x03505c00
        m2.setU32(d, g >>> 0)
        m2.setU32(d + 4, o >>> 0)
        m2.setU32(d + 8, u >>> 0)
        m2.setU32(d + 12, k >>> 0)
        m2.setU32(d + 16, ov >>> 0)
        m2.setU32(d + 20, nv >>> 0)
      },
    ),
  '0x6FD88BD0': (m, a) => STATLIST_GetTotalStatWithLayerInline113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD88ED0': (m, a) => STATLIST_GetUnitMinDamage113c(m, a[0]!, a[1]!),
  '0x6FD88F60': (m, a) => STATLIST_GetUnitMaxDamage113c(m, a[0]!, a[1]!),
  '0x6FD8A030': (m, a) => STATLIST_DeactivateWeaponDamageStats113c(m, a[0]!, a[1]!),
  '0x6FD8A100': (m, a) => STATLIST_ReactivateWeaponDamageStats113c(m, a[0]!, a[1]!),
  '0x6FD8AC90': (m, a) => STATLIST_SetWeaponStatListActive113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FDD54C0': (m, a) => DRLGOUTJUNG_BuildJunglePresets113c(m, a[0]!),
}

describe('K1 Iteration 10 Lane A — I10A-1 statlist/inventory/prng differential replay', () => {
  const vectors = loadVectors()

  it('covers all 18 diff-verified I10A-1 VAs in i10a-1-vectors.ndjson with >= 2 vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    const portedVas = new Set(['0x6FD888E0', '0x6FD88940'])
    expect(Object.keys(DISPATCH).length).toBe(20)
    for (const va of Object.keys(DISPATCH)) {
      if (portedVas.has(va)) continue
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

  describe('I10A-1 ported callback functions & boundary edge cases', () => {
    const allocMem = (): SparseMemory113c => {
      const m = new SparseMemory113c()
      m.loadBlock(0, new Uint8Array(0x30000))
      m.loadBlock(0x6fdd0000, new Uint8Array(0x20000))
      return m
    }

    it('0x6FD7CC60 STATLIST_GetUnitHirelingResurrectCost113c uses signed >>31 rounding and unsigned <=0xC350 (jbe) clamp', () => {
      const m = allocMem()
      const sgpt = 0x10000
      const pIsc = 0x12000
      const pUnit = 0x14000
      const pList = 0x15000
      const pStats = 0x16000
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(sgpt + 0xbd4, 20)
      m.setU32(sgpt + 0xbcc, pIsc)
      m.setU32(pUnit + 0x5c, pList)
      m.setU32(pList + 0x10, 0x80000000)
      m.setU32(pList + 0x48, pStats)
      m.setU16(pList + 0x4c, 1)
      m.setU16(pList + 0x4e, 4)
      m.setU32(pStats + 0x00, 0x000c0000)
      m.setU32(pStats + 0x04, 55108) // 55108^2 -> cost = 0xcd98ab78 > 0xc350 unsigned -> clamps to 0xc350
      expect(STATLIST_GetUnitHirelingResurrectCost113c(m, pUnit)).toBe(0xc350)
    })

    it('0x6FD82330 STATLIST_GetUnitLifePercent113c skips ISC lookup when dwItemStatCostCount === 6', () => {
      const m = allocMem()
      const sgpt = 0x10000
      const pUnit = 0x14000
      const pList = 0x15000
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(sgpt + 0xbd4, 6)
      m.setU32(pUnit + 0x5c, pList)
      const origU32 = m.u32.bind(m)
      m.u32 = (addr: number): number => {
        if ((addr >>> 0) === sgpt + 0xbcc) {
          throw new Error('must not read pItemStatCostTxt when count <= 6')
        }
        return origU32(addr)
      }
      expect(STATLIST_GetUnitLifePercent113c(m, pUnit)).toBe(0)
    })

    it('0x6FD82CA0 STATES_SetUnitSourceUnit113c does not search sublists when pEx.dwFlags === 0', () => {
      const m = allocMem()
      const pUnit = 0x10000
      const pEx = 0x11000
      const pSub = 0x12000
      m.setU32(pUnit + 0x5c, pEx)
      m.setU32(pEx + 0x10, 0) // non-negative (bit 31 == 0)
      m.setU32(pEx + 0x3c, pSub)
      m.setU32(pSub + 0x10, 0x01)
      m.setU32(pSub + 0x14, 0x62)
      m.setU32(pSub + 0x08, 99)
      m.setU32(pSub + 0x0c, 88)
      STATES_SetUnitSourceUnit113c(m, pUnit, 0, 0)
      expect(m.u32(pSub + 0x08)).toBe(99)
      expect(m.u32(pSub + 0x0c)).toBe(88)
    })

    it('0x6FD888E0 STATLIST_NotifyIfStatModified113c honors extended-list, pModStat, pBaseStat, and callback gates', () => {
      const m = allocMem()
      const pUnit = 0x10000
      const pEx = 0x11000
      const pBase = 0x12000
      const pMod = 0x13000
      m.setU32(pUnit + 0x5c, pEx)
      m.setU32(pEx + 0x10, 0x80000000)
      m.setU32(pEx + 0x50, pMod)
      m.setU16(pEx + 0x54, 1)
      m.setU16(pEx + 0x56, 4)
      m.setU32(pMod + 0x00, 0x00090000)
      m.setU32(pEx + 0x24, pBase)
      m.setU16(pEx + 0x28, 1)
      m.setU16(pEx + 0x2a, 4)
      m.setU32(pBase + 0x00, 0x00090000)
      m.setU32(pBase + 0x04, 777)

      let calls = 0
      let gotVal = 0
      // Null unit -> no-op
      STATLIST_NotifyIfStatModified113c(m, 0, 0x2000, 9, 0x1234, () => {
        calls++
      })
      expect(calls).toBe(0)
      // pfnCb === 0 with cb provided -> must NOT invoke cb
      STATLIST_NotifyIfStatModified113c(m, pUnit, 0x2000, 9, 0, () => {
        calls++
      })
      expect(calls).toBe(0)
      // pfnCb !== 0 with cb === undefined -> must NOT throw
      STATLIST_NotifyIfStatModified113c(m, pUnit, 0x2000, 9, 0x1234, undefined)
      // Non-extended list -> no-op
      m.setU32(pEx + 0x10, 0)
      STATLIST_NotifyIfStatModified113c(m, pUnit, 0x2000, 9, 0x1234, () => {
        calls++
      })
      expect(calls).toBe(0)
      m.setU32(pEx + 0x10, 0x80000000)
      // Absent in pModStat -> no-op
      STATLIST_NotifyIfStatModified113c(m, pUnit, 0x2000, 8, 0x1234, () => {
        calls++
      })
      expect(calls).toBe(0)
      // Present in both & pfnCb !== 0 -> invokes cb with base value
      STATLIST_NotifyIfStatModified113c(m, pUnit, 0x2000, 9, 0x1234, (_m, u, st, v, arg) => {
        calls++
        gotVal = v
        expect(u).toBe(pUnit)
        expect(st).toBe(9)
        expect(arg).toBe(0x2000)
      })
      expect(calls).toBe(1)
      expect(gotVal).toBe(777)
    })

    it('0x6FD88940 STATLIST_SetFullStatEntry113c inserts, removes, keeps zero, and fires pfOnValue when non-zero (including pfOnValue === 1)', () => {
      const m = allocMem()
      const pList = 0x10000
      const pStats = 0x11000
      const pIsc = 0x12000
      const pBitMasks = 0x13000
      m.setU32(0x6fdd90b0, pBitMasks)
      for (let i = 0; i < 32; i++) {
        m.setU32(pBitMasks + i * 4, (1 << i) >>> 0)
      }
      m.setU8(pIsc + 0x05, 0x08) // bit 3 set
      m.setU8(pIsc + 0x50, 0) // bKeepZero = 0
      m.setU8(pIsc + 0x53, 1) // bHasDynamicOp = 1
      m.setU32(pList + 0x10, 0x80000000)
      m.setU32(pList + 0x44, 0x2222)
      m.setU32(pList + 0x5c, 1) // pfOnValue === 1 (kills lit 0 -> 1 mutant)
      m.setU32(pList + 0x60, 0x3333)
      m.setU32(pList + 0x48, pStats)
      m.setU16(pList + 0x4c, 0)
      m.setU16(pList + 0x4e, 4)

      // Missing key with nValue === 0 -> no-op
      let cbCount = 0
      STATLIST_SetFullStatEntry113c(m, pList, 0x00050000, 0, pIsc, 0x4444, () => {
        cbCount++
      })
      expect(cbCount).toBe(0)
      expect(m.u16(pList + 0x4c)).toBe(0)

      // Insert new key with nValue === 42 and pfOnValue === 1 -> sets 0x20000000 and calls cb
      let lastOld = -1
      let lastNew = -1
      STATLIST_SetFullStatEntry113c(
        m,
        pList,
        0x00050000,
        42,
        pIsc,
        0x4444,
        (_m, g, o, u, k, ov, nv) => {
          cbCount++
          lastOld = ov
          lastNew = nv
          expect(g).toBe(0x3333)
          expect(o).toBe(0x2222)
          expect(u).toBe(0x4444)
          expect(k).toBe(0x00050000)
        },
      )
      expect(cbCount).toBe(1)
      expect(lastOld).toBe(0)
      expect(lastNew).toBe(42)
      expect((m.u32(pList + 0x10) & 0x20000000) !== 0).toBe(true)

      // Setting to 0 with bKeepZero === 1 -> keeps entry
      m.setU8(pIsc + 0x50, 1)
      STATLIST_SetFullStatEntry113c(m, pList, 0x00050000, 0, pIsc, 0x4444, () => {
        cbCount++
      })
      expect(cbCount).toBe(2)
      expect(m.u16(pList + 0x4c)).toBe(1)
      expect(m.u32(pStats + 4)).toBe(0)

      // Setting to 0 with bKeepZero === 0 (first set to 10, then 0) -> removes entry
      m.setU8(pIsc + 0x50, 0)
      STATLIST_SetFullStatEntry113c(m, pList, 0x00050000, 10, pIsc, 0x4444)
      STATLIST_SetFullStatEntry113c(m, pList, 0x00050000, 0, pIsc, 0x4444, () => {
        cbCount++
      })
      expect(cbCount).toBe(3)
      expect(m.u16(pList + 0x4c)).toBe(0)

      // pfOnValue === 0 -> does not invoke callback
      m.setU32(pList + 0x5c, 0)
      STATLIST_SetFullStatEntry113c(m, pList, 0x00050000, 99, pIsc, 0x4444, () => {
        cbCount++
      })
      expect(cbCount).toBe(3)
    })

    it('0x6FD88BD0, 0x6FD88ED0, 0x6FD88F60 honor exact statId === dwItemStatCostCount and pIscRec === 1 boundaries', () => {
      const m = allocMem()
      const sgpt = 0x10000
      const pList = 0x11000
      const pStats = 0x12000
      const pUnit = 0x13000
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(pUnit + 0x5c, pList)
      m.setU32(pList + 0x10, 0x80000000)
      m.setU32(pList + 0x48, pStats)
      m.setU16(pList + 0x4c, 3)
      m.setU16(pList + 0x4e, 4)
      m.setU32(pStats + 0x00, 0x00000000)
      m.setU32(pStats + 0x04, 88)
      m.setU32(pStats + 0x08, 0x00150000)
      m.setU32(pStats + 0x0c, 111)
      m.setU32(pStats + 0x10, 0x00160000)
      m.setU32(pStats + 0x14, 222)

      // pIscRec === 1 (kills pIscRec === 0 -> 1 mutant on 0x6FD88BD0)
      m.setU32(sgpt + 0xbd4, 1)
      m.setU32(sgpt + 0xbcc, 1)
      expect(STATLIST_GetTotalStatWithLayerInline113c(m, pList, 0, 0)).toBe(88)
      // statId === dwItemStatCostCount (1 >= 1 -> 0)
      expect(STATLIST_GetTotalStatWithLayerInline113c(m, pList, 1, 0)).toBe(0)

      // 0x6FD88ED0 boundary dwItemStatCostCount === 0x15
      m.setU32(sgpt + 0xbd4, 0x15)
      m.setU32(sgpt + 0xbcc, 0x20000)
      expect(STATLIST_GetUnitMinDamage113c(m, pUnit, 0)).toBe(0)

      // 0x6FD88F60 boundary dwItemStatCostCount === 0x16
      m.setU32(sgpt + 0xbd4, 0x16)
      expect(STATLIST_GetUnitMaxDamage113c(m, pUnit, 0)).toBe(0)
    })

    it('0x6FD8A030 & 0x6FD8A100 handle pItemList === 1, pOwnerEx.dwFlags === 0, and exact pEnd array bound', () => {
      const m = allocMem()
      const owner = 0x10000
      const item = 0x11000
      const pOwnerEx = 0x12000
      m.setU32(owner + 0x5c, pOwnerEx)
      m.setU32(item + 0x5c, 1) // pItemList === 1
      m.setU32(1 + 0x04, owner)
      m.setU32(1 + 0x10, 0)
      // pOwnerEx.dwFlags === 0 -> returns 0
      m.setU32(pOwnerEx + 0x10, 0)
      expect(STATLIST_DeactivateWeaponDamageStats113c(m, owner, item)).toBe(0)
      // pOwnerEx.dwFlags === 0x80000000 with pItemList === 1 -> returns 1
      m.setU32(pOwnerEx + 0x10, 0x80000000)
      expect(STATLIST_DeactivateWeaponDamageStats113c(m, owner, item)).toBe(1)

      // 0x6FD8A100: put stat 0x15 entry right at pEnd (beyond count=0) to ensure cur < pEnd stops before pEnd
      const pItemList2 = 0x13000
      const pArr = 0x14000
      m.setU32(item + 0x5c, pItemList2)
      m.setU32(pItemList2 + 0x04, owner)
      m.setU32(pItemList2 + 0x10, 0x40000000)
      m.setU32(pItemList2 + 0x24, pArr)
      m.setU16(pItemList2 + 0x28, 0) // count = 0 -> pEnd === pArr
      m.setU16(pItemList2 + 0x2a, 4)
      m.setU32(pArr + 0x00, 0x00150000) // sentinel past pEnd
      m.setU32(pArr + 0x04, 55)
      expect(STATLIST_ReactivateWeaponDamageStats113c(m, owner, item)).toBe(1)
      expect(m.u16(pOwnerEx + 0x4c)).toBe(0)
    })

    it('0x6FDD54C0 DRLGOUTJUNG_BuildJunglePresets113c handles single-column blocksX === 1', () => {
      const m = allocMem()
      const sgpt = 0x10000
      const pLevel = 0x11000
      const pDefs = 0x12000
      const pOutdoors = 0x13000
      const pRowOffsets = 0x14000
      const pCells = 0x15000
      const pCells2C = 0x15800
      const pDrlg = 0x16000
      const pLevelsTxt = 0x18000
      const pDef76 = pLevelsTxt + 0x2e50
      const pLvlPrestTxt = 0x20000
      const pPrest1 = pLvlPrestTxt + 1 * 0x1b0
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(sgpt + 0xc5c, 100)
      m.setU32(sgpt + 0xc68, 10)
      m.setU32(0x6fdf0b38, pLevelsTxt)
      m.setU32(0x6fdf0b3c, pLvlPrestTxt)
      m.setU32(pPrest1 + 0x28, 8) // sizeX = 1
      m.setU32(pPrest1 + 0x2c, 8) // sizeY = 1
      m.setU32(pPrest1 + 0x40, 2) // nFiles = 2
      m.setU32(pDef76 + 0x0c, 32) // blocksX = 1
      m.setU32(pDef76 + 0x18, 32) // blocksY = 1
      m.setU32(pLevel + 0x1b4, pDrlg)
      m.setU32(pLevel + 0x1d0, 0x4d) // Great Marsh
      m.setU32(pLevel + 0x1bc, pDefs)
      m.setU32(pDefs + 0, 1)
      m.setU32(pLevel + 0x14, pOutdoors)
      m.setU32(pOutdoors + 0x04, pCells)
      m.setU32(pOutdoors + 0x08, pRowOffsets)
      m.setU32(pOutdoors + 0x2c, pCells2C)
      m.setU32(pOutdoors + 0x30, pRowOffsets)
      m.setU32(pRowOffsets + 0, 0)
      DRLGOUTJUNG_BuildJunglePresets113c(m, pLevel)
      expect(m.u32(pCells)).toBe(1)
    })
  })
})

