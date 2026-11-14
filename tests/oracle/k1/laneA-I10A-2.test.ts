import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import {
  MONSTERS_ApplyClassicConversionStats113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATLIST_ClampUnitPoolStatsToMax113c,
  STATLIST_ClearMonsterSkillIconStatList113c,
  STATLIST_ExpireOrphanStateSubLists113c,
  STATLIST_ExpireTimedSubLists113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetExtendedUnitStatsById113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetStatListFromUnitStateOrFlag113c,
  STATLIST_GetUnitStatBonus113c,
  STATLIST_SetBaseStatExIfValid113c,
  STATLIST_UpdateUnitByTimeStats113c,
} from '../../../src/d2kern-113c/common/statlist.js'
import {
  UNITS_GetAnimStartFrame113c,
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_HasCollisionBetweenUnits113c,
  UNITS_IsUnitMovingBool113c,
  UNITS_SetCollisionMaskAtCoords113c,
  UNITS_SyncDualWieldWeaponStatLists113c,
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

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i10a-2-vectors.ndjson')

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
  '0x6FD6B1D0': (m, a) => MONSTERS_ApplyClassicConversionStats113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD814A0': (m, a) => UNITS_HasCollisionBetweenUnits113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD81850': (m, a) => UNITS_SetCollisionMaskAtCoords113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD819A0': (m, a) => UNITS_IsUnitMovingBool113c(m, a[0]!),
  '0x6FD82220': (m, a) => UNITS_GetAnimStartFrame113c(m, a[0]!),
  '0x6FD82C10': (m, a) => STATES_SetMonsterSkillIconOnUnit113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD82EF0': (m, a) => UNITS_SyncDualWieldWeaponStatLists113c(m, a[0]!, a[1]!),
  '0x6FD884B0': (m, a) => STATLIST_GetStatListFromUnitStateOrFlag113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD884F0': (m, a) => STATLIST_GetStatListFromUnitAndFlag113c(m, a[0]!, a[1]!),
  '0x6FD886E0': (m, a) => STATLIST_GetExtendedUnitStatsById113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD89B60': (m, a) => STATLIST_UpdateUnitByTimeStats113c(m, a[0]!, a[1]!),
  '0x6FD89CC0': (m, a) => STATLIST_GetUnitStatBonus113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD8A790': (m, a) => STATLIST_SetBaseStatExIfValid113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD8AB30': (m, a) => STATLIST_ClampUnitPoolStatsToMax113c(m, a[0]!),
  '0x6FD8AC50': (m, a) => STATLIST_ClearMonsterSkillIconStatList113c(m, a[0]!),
  '0x6FD8AD40': (m, a) => STATLIST_FreeStatListIfNonExtended113c(m, a[0]!),
  '0x6FD8AD60': (m, a) => STATLIST_ExpireOrphanStateSubLists113c(m, a[0]!),
  '0x6FD8ADD0': (m, a) => STATLIST_ExpireTimedSubLists113c(m, a[0]!, a[1]!),
  '0x6FDCFCD0': (m, a) => UNITS_GetDistanceToOtherUnit113c(m, a[0]!, a[1]!),
}

describe('K1 Iteration 10 Lane A — I10A-2 unit/statlist differential replay', () => {
  const vectors = loadVectors()

  it('covers all 19 diff-verified I10A-2 VAs with >= 2 vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(19)
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

  describe('I10A-2 boundary and edge-case unit tests', () => {
    const allocMem = (): SparseMemory113c => {
      const m = new SparseMemory113c()
      m.loadBlock(0, new Uint8Array(0x30000))
      m.loadBlock(0x6fdd0000, new Uint8Array(0x20000))
      return m
    }

    it('0x6FD6B1D0 MONSTERS_ApplyClassicConversionStats113c indexes monId * 0x1A8 and respects monId === dwMonStatsCount', () => {
      const m = allocMem()
      const sgpt = 0x10000
      const pMonBase = 0x12000
      const pIsc = 0x16000
      const pUnit = 0x18000
      const pList = 0x19000
      const pStats = 0x1a000
      const pFull = 0x1b000
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(sgpt + 0xa78, pMonBase)
      m.setU32(sgpt + 0xa80, 3) // count = 3
      m.setU32(sgpt + 0xbcc, pIsc)
      m.setU32(sgpt + 0xbd4, 40)
      // monId = 2 -> pMon = pMonBase + 2 * 0x1a8 = pMonBase + 0x350
      const pMon2 = pMonBase + 2 * 0x1a8
      m.setU16(pMon2 + 0xaa, 10) // wLvl = 10 -> newLvl = 10 + 1 * 25 = 35
      m.setU32(pUnit + 0x00, 1) // monster
      m.setU32(pUnit + 0x04, 2) // monId = 2
      m.setU32(pUnit + 0x5c, pList)
      m.setU32(pList + 0x10, 0x80000000)
      m.setU32(pList + 0x24, pStats)
      m.setU16(pList + 0x28, 1)
      m.setU16(pList + 0x2a, 8)
      m.setU32(pStats + 0x00, 0x000c0000) // stat 12 (level) = 5
      m.setU32(pStats + 0x04, 5)
      m.setU32(pList + 0x48, pFull)
      m.setU16(pList + 0x4c, 1)
      m.setU16(pList + 0x4e, 8)
      m.setU32(pFull + 0x00, 0x000c0000)
      m.setU32(pFull + 0x04, 5)

      // Boundary monId === dwMonStatsCount (2 === 2) -> pMon = 0 -> early return
      m.setU32(sgpt + 0xa80, 2)
      MONSTERS_ApplyClassicConversionStats113c(m, pUnit, 0, 1)
      expect(m.u32(pStats + 0x04)).toBe(5)

      // monId < dwMonStatsCount (2 < 3) -> reads pMon2 at +0x350 and sets level to 35
      m.setU32(sgpt + 0xa80, 3)
      MONSTERS_ApplyClassicConversionStats113c(m, pUnit, 0, 1)
      expect(m.u32(pStats + 0x04)).toBe(35)
    })

    it('0x6FD814A0 UNITS_HasCollisionBetweenUnits113c reads StaticPath (+0x0C/+0x10) when unit2 has type 5 (Tile)', () => {
      const m = allocMem()
      const sgpt = 0x10000
      const u1 = 0x11000
      const u2 = 0x12000
      const p1 = 0x13000
      const p2 = 0x14000
      const room = 0x15000
      const coll = 0x16000
      const grid = 0x17000
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(u1 + 0x00, 0) // player (DynamicPath, sizeX = 2)
      m.setU32(u1 + 0x2c, p1)
      m.setU16(p1 + 0x02, 5)
      m.setU16(p1 + 0x06, 10)
      m.setU32(p1 + 0x1c, room)

      m.setU32(u2 + 0x00, 5) // tile (StaticPath: t2 === 5, sizeX = 0)
      m.setU32(u2 + 0x2c, p2)
      m.setU16(p2 + 0x02, 5) // DynamicPath x2 = 5 (if StaticPath branch skipped, ray from (5,10) to (5,2) misses wall)
      m.setU16(p2 + 0x06, 2) // DynamicPath y2 = 2
      m.setU32(p2 + 0x0c, 15) // StaticPath x2 = 15
      m.setU32(p2 + 0x10, 10) // StaticPath y2 = 10 at +0x10 (while p2 - 0x10 is 0)

      m.setU32(room + 0x20, coll)
      m.setU32(room + 0x4c, 0)
      m.setU32(room + 0x50, 0)
      m.setU32(room + 0x54, 20)
      m.setU32(room + 0x58, 20)
      m.setU32(coll + 0x00, 0)
      m.setU32(coll + 0x04, 0)
      m.setU32(coll + 0x08, 20)
      m.setU32(coll + 0x0c, 20)
      m.setU32(coll + 0x20, grid)
      // Place wall mask at (10, 10) on horizontal ray from (5, 10) to (15, 10); clear everywhere else
      m.setU16(grid + (10 * 20 + 10) * 2, 0x0001)
      expect(UNITS_HasCollisionBetweenUnits113c(m, u1, u2, 0x0001)).toBe(1)
    })

    it('0x6FD81850 UNITS_SetCollisionMaskAtCoords113c handles (szX,szY)=(1,1) and skips when szY===0', () => {
      const m = allocMem()
      const sgpt = 0x10000
      const pObjTxt = 0x12000
      const u = 0x14000
      const pObjData = 0x15000
      const room = 0x16000
      const coll = 0x17000
      const grid = 0x18000
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(u + 0x00, 2) // Object
      m.setU32(u + 0x14, pObjData)
      m.setU32(pObjData + 0x00, pObjTxt)
      m.setU32(room + 0x20, coll)
      m.setU32(room + 0x4c, 0)
      m.setU32(room + 0x50, 0)
      m.setU32(room + 0x54, 10)
      m.setU32(room + 0x58, 10)
      m.setU32(coll + 0x00, 0)
      m.setU32(coll + 0x04, 0)
      m.setU32(coll + 0x08, 10)
      m.setU32(coll + 0x0c, 10)
      m.setU32(coll + 0x20, grid)

      // (szX, szY) = (1, 0) -> must NOT call UNITS_GetCollisionMask113c
      m.setU32(pObjTxt + 0xd0, 1) // dwSizeX = 1
      m.setU32(pObjTxt + 0xd4, 0) // dwSizeY = 0
      const origU32 = m.u32.bind(m)
      let readMode = false
      m.u32 = (addr: number): number => {
        if ((addr >>> 0) === u + 0x10) readMode = true
        return origU32(addr)
      }
      UNITS_SetCollisionMaskAtCoords113c(m, u, room, 5, 5)
      expect(readMode).toBe(false)

      // (szX, szY) = (0, 1) -> must NOT call UNITS_GetCollisionMask113c
      m.setU32(pObjTxt + 0xd0, 0) // dwSizeX = 0
      m.setU32(pObjTxt + 0xd4, 1) // dwSizeY = 1
      UNITS_SetCollisionMaskAtCoords113c(m, u, room, 5, 5)
      expect(readMode).toBe(false)
      m.u32 = origU32

      // (szX, szY) = (1, 1) -> writes collision mask at (5, 5)
      m.setU32(pObjTxt + 0xd0, 1) // dwSizeX = 1
      m.setU32(pObjTxt + 0xd4, 1) // dwSizeY = 1
      UNITS_SetCollisionMaskAtCoords113c(m, u, room, 5, 5)
      expect(m.u16(grid + (5 * 10 + 5) * 2)).toBeGreaterThan(0)
    })

    it('0x6FD82220 UNITS_GetAnimStartFrame113c handles player mode 8 (Attack2) and mode 16 (rel === 9)', () => {
      const m = allocMem()
      const sgpt = 0x10000
      const pCharStats = 0x11000
      const pTransformStates = 0x12000
      const pStatesTxt = 0x13000
      const u = 0x14000
      const pEx = 0x15000
      const pStateFlags = 0x16000
      const pBitMasks = 0x17000
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(sgpt + 0xa80, 10)
      m.setU32(0x6fde9e20, pCharStats)
      m.setU32(0x6fdd90b0, pBitMasks)
      m.setU32(pBitMasks + 4, 2) // state 1 mask
      m.setU32(u + 0x00, 0) // Player
      m.setU32(u + 0x04, 0) // Amazon (START_FRAME_TABLE_6FDE4480[0 * 7 + 0] = 1)

      // mode = 8 (Attack2) -> table 0x6FDE4480[0 * 7 + 0] = 1
      m.setU32(u + 0x10, 8)
      expect(UNITS_GetAnimStartFrame113c(m, u)).toBe(1)

      // mode = 16 (Seq, rel = 9): Amazon cannot dual-wield -> 0
      m.setU32(u + 0x10, 16)
      expect(UNITS_GetAnimStartFrame113c(m, u)).toBe(0)

      // Barbarian (u + 0x04 = 4, can dual-wield) with nGfxType = 2 transform to classId = 0 on mode = 16 -> 1
      m.setU32(u + 0x04, 4)
      m.setU32(u + 0xc8, 8) // bit 3 set (has transform state)
      m.setU16(sgpt + 0x180, 1)
      m.setU32(sgpt + 0x17c, pTransformStates)
      m.setU16(pTransformStates, 1) // state 1
      m.setU32(sgpt + 0xc4, 10)
      m.setU32(sgpt + 0xbc, pStatesTxt)
      m.setU8(pStatesTxt + 0x3c + 0x2d, 2) // nGfxType = 2 (player gfx)
      m.setU16(pStatesTxt + 0x3c + 0x2e, 0) // nGfxClass = 0 (Amazon)
      m.setU32(u + 0x5c, pEx)
      m.setU32(pEx + 0x10, 0x80000000)
      m.setU32(pEx + 0x58, pStateFlags)
      m.setU32(pStateFlags, 2) // state 1 active
      expect(UNITS_GetAnimStartFrame113c(m, u)).toBe(1)
    })

    it('0x6FD884B0, 0x6FD884F0, 0x6FD886E0 handle pEx.dwFlags === 0 and pEx === 1', () => {
      const m = allocMem()
      const u = 0x10000
      const pEx = 0x11000
      const pSub = 0x12000
      const pOut = 0x13000
      const pStats = 0x14000
      m.setU32(u + 0x5c, pEx)
      m.setU32(pEx + 0x10, 0) // non-negative -> must return 0 BEFORE walking pPrevLink (+0x2c) or pBaseStats (+0x24)
      m.setU32(pEx + 0x2c, pSub)
      m.setU32(pEx + 0x3c, pSub)
      m.setU32(pSub + 0x10, 0x40)
      m.setU32(pSub + 0x14, 5)
      m.setU32(pEx + 0x24, pStats)
      m.setU16(pEx + 0x28, 1)
      m.setU16(pEx + 0x2a, 4)
      m.setU32(pEx + 0x48, pStats)
      m.setU16(pEx + 0x4c, 1)
      m.setU16(pEx + 0x4e, 4)
      m.setU32(pStats + 0x00, 0x00070000)
      m.setU32(pStats + 0x04, 12)

      expect(STATLIST_GetStatListFromUnitStateOrFlag113c(m, u, 0, 0x40)).toBe(0)
      expect(STATLIST_GetStatListFromUnitAndFlag113c(m, u, 0x40)).toBe(0)
      expect(STATLIST_GetExtendedUnitStatsById113c(m, u, 7, pOut, 4)).toBe(0)

      // Now test pEx === 1 (at address 1) with extended flag 0x80000000
      m.setU32(u + 0x5c, 1)
      m.setU32(1 + 0x10, 0x80000000)
      m.setU32(1 + 0x3c, pSub)
      m.setU32(1 + 0x48, pStats)
      m.setU16(1 + 0x4c, 1)
      m.setU16(1 + 0x4e, 4)
      expect(STATLIST_GetStatListFromUnitAndFlag113c(m, u, 0x40)).toBe(pSub)
      expect(STATLIST_GetExtendedUnitStatsById113c(m, u, 7, pOut, 4)).toBe(1)
    })

    it('0x6FD89B60 STATLIST_UpdateUnitByTimeStats113c ignores out-of-range statId >= dwItemStatCostCount', () => {
      const m = allocMem()
      const sgpt = 0x10000
      const u = 0x11000
      const pEx = 0x12000
      const pStats = 0x13000
      const pIsc0 = 0x20000
      const pBitMasks = 0x18000
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(0x6fdd90b0, pBitMasks)
      m.setU32(sgpt + 0xbd4, 5) // count = 5
      m.setU32(sgpt + 0xbcc, pIsc0)
      m.setU8(pIsc0 + 0x50, 1) // bKeepZero = 1 on stat 0
      // Poison address 1 + 0x54 so if pIsc defaults to 1 instead of 0, it triggers op 6 on target stat 0
      m.setU8(1 + 0x54, 6)
      m.setU16(1 + 0x58, 0)
      m.setU16(1 + 0x5a, 0xffff)
      m.setU32(u + 0x5c, pEx)
      m.setU32(pEx + 0x10, 0xa0000000)
      m.setU32(pEx + 0x48, pStats)
      m.setU16(pEx + 0x4c, 1)
      m.setU16(pEx + 0x4e, 4)
      m.setU32(pStats + 0x00, 0x00090000) // statId = 9 >= 5
      m.setU32(pStats + 0x04, 100)
      STATLIST_UpdateUnitByTimeStats113c(m, u, u)
      expect(m.u16(pEx + 0x4c)).toBe(1)
    })

    it('0x6FD8AB30 STATLIST_ClampUnitPoolStatsToMax113c reads pIsc6 at +0x798 and respects dwItemStatCostCount === 10', () => {
      const m = allocMem()
      const sgpt = 0x10000
      const pIscBase = 0x12000
      const u = 0x14000
      const pList = 0x15000
      const pBase = 0x16000
      const pFull = 0x17000
      const pBitMasks = 0x18000
      m.setU32(0x6fde9e1c, sgpt)
      m.setU32(0x6fdd90b0, pBitMasks)
      for (let i = 0; i < 32; i++) {
        m.setU32(pBitMasks + i * 4, (1 << i) >>> 0)
      }
      m.setU32(sgpt + 0xbcc, pIscBase)
      m.setU32(sgpt + 0xbd4, 10) // count === 10 (boundary for > 0x0a)
      // At pIsc6 (pIscBase + 0x798), set fMin (0x04 at +0x05) and dwMinAccr = 500 at +0x2c
      m.setU8(pIscBase + 0x798 + 0x05, 0x04)
      m.setU32(pIscBase + 0x798 + 0x2c, 500)

      m.setU32(u + 0x00, 0) // player
      m.setU32(u + 0x5c, pList)
      m.setU32(pList + 0x08, 0) // player owner
      m.setU32(pList + 0x10, 0x80000000)
      m.setU32(pList + 0x44, u)
      m.setU32(pList + 0x24, pBase)
      m.setU16(pList + 0x28, 3)
      m.setU16(pList + 0x2a, 8)
      m.setU32(pBase + 0x00, 0x00060000) // hp = 100 (clamped up to 500 via pIsc6 fMin)
      m.setU32(pBase + 0x04, 100)
      m.setU32(pBase + 0x08, 0x00070000) // maxhp = 200
      m.setU32(pBase + 0x0c, 200)
      m.setU32(pBase + 0x10, 0x000a0000) // stam = 900 (must NOT be clamped when count === 10)
      m.setU32(pBase + 0x14, 900)
      m.setU32(pList + 0x48, pFull)
      m.setU16(pList + 0x4c, 3)
      m.setU16(pList + 0x4e, 8)
      m.setU32(pFull + 0x00, 0x00060000)
      m.setU32(pFull + 0x04, 100)
      m.setU32(pFull + 0x08, 0x00070000)
      m.setU32(pFull + 0x0c, 200)
      m.setU32(pFull + 0x10, 0x000a0000)
      m.setU32(pFull + 0x14, 900)

      STATLIST_ClampUnitPoolStatsToMax113c(m, u)
      expect(m.u32(pBase + 0x04) | 0).toBe(-200) // 100 + (200 - 500) = -200 because pIsc6 at +0x798 raised curHp to 500
      expect(m.u32(pFull + 0x04) | 0).toBe(-200)
      expect(m.u32(pBase + 0x14)).toBe(900) // stam untouched because count === 10 is not > 10
    })

    it('0x6FD8AC50, 0x6FD8AD40, 0x6FD8AD60, 0x6FD8ADD0, 0x6FDCFCD0 boundary cases', () => {
      const m = allocMem()
      const u = 0x10000
      const pEx = 0x11000
      const pSub = 0x12000
      const pStats = 0x13000

      // 0x6FD8AC50: clears 0x100 -> 0x00000000 (>= 0), and returns without walking pPrevLink (+0x2c)
      m.setU32(u + 0x5c, pEx)
      m.setU32(pEx + 0x10, 0x00000100) // after & 0xfffffeff -> 0x00000000 (kills >= 0 -> > 0)
      m.setU32(pEx + 0x2c, pSub)
      m.setU32(pEx + 0x3c, pSub)
      m.setU32(pSub + 0x10, 0x80)
      m.setU32(pSub + 0x24, pStats)
      m.setU16(pSub + 0x28, 1)
      m.setU16(pSub + 0x2a, 4)
      m.setU32(pStats + 0x00, 0x015e0000)
      STATLIST_ClearMonsterSkillIconStatList113c(m, u)
      expect(m.u32(pEx + 0x10)).toBe(0)
      expect(m.u16(pSub + 0x28)).toBe(1) // untouched because pEx2.dwFlags === 0

      // 0x6FD8AD40: frees non-extended list when dwFlags === 0
      const pFree = 0x14000
      const pParent = 0x15000
      m.setU32(pFree + 0x10, 0) // dwFlags === 0
      m.setU32(pFree + 0x34, pParent) // pParent at +0x34
      m.setU32(pParent + 0x10, 0x80000000) // parent is extended
      m.setU32(pParent + 0x3c, pFree)
      STATLIST_FreeStatListIfNonExtended113c(m, pFree)
      expect(m.u32(pParent + 0x3c)).toBe(0)

      // 0x6FD8AD60 & 0x6FD8ADD0: return early when pEx.dwFlags === 0; client/server flag & 0x02 === 0
      m.setU32(u + 0x5c, pEx)
      m.setU32(pEx + 0x10, 0) // non-extended (dwFlags === 0)
      m.setU32(pEx + 0x3c, pSub)
      m.setU32(pSub + 0x10, 0x02)
      m.setU32(pSub + 0x14, 0)
      m.setU32(pSub + 0x18, 5)
      m.setU32(pSub + 0x2c, 0)
      m.setU32(pSub + 0x34, pEx)
      STATLIST_ExpireOrphanStateSubLists113c(m, u)
      expect(m.u32(pSub + 0x34)).toBe(pEx)
      STATLIST_ExpireTimedSubLists113c(m, u, 0)
      expect(m.u32(pSub + 0x18)).toBe(5) // must not decrement when pEx.dwFlags === 0

      // Now set pEx.dwFlags = 0x80000000 and pSub.dwFlags = 0 (bit 0x02 clear): neither frame=0 nor frame=10 expires it
      m.setU32(pEx + 0x10, 0x80000000)
      m.setU32(pSub + 0x10, 0)
      m.setU32(pSub + 0x18, 5)
      STATLIST_ExpireTimedSubLists113c(m, u, 10) // frame=10 >= 5, but flags & 0x02 === 0 -> untouched
      expect(m.u32(pEx + 0x3c)).toBe(pSub)
      STATLIST_ExpireTimedSubLists113c(m, u, 0) // frame=0, flags & 0x02 === 0 -> dwExpireFrame stays 5
      expect(m.u32(pSub + 0x18)).toBe(5)

      // 0x6FDCFCD0: unit2 with type 3 (Missile -> DynamicPath at +0x02/+0x06)
      const u1 = 0x16000
      const u2 = 0x17000
      const path1 = 0x18000
      const path2 = 0x19000
      m.setU32(u1 + 0x00, 0)
      m.setU32(u1 + 0x2c, path1)
      m.setU16(path1 + 0x02, 10)
      m.setU16(path1 + 0x06, 20)
      m.setU32(u2 + 0x00, 3) // Missile (ebp === 3)
      m.setU32(u2 + 0x2c, path2)
      m.setU16(path2 + 0x02, 13)
      m.setU16(path2 + 0x06, 24)
      m.setU32(path2 + 0x0c, 999)
      m.setU32(path2 + 0x10, 999)
      expect(UNITS_GetDistanceToOtherUnit113c(m, u1, u2)).toBe(5)
    })
  })
})

