import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
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
import { UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c } from '../../../src/d2kern-113c/common/unit-finds.js'
import { DRLGPRESET_UpdateRoomTileAnims113c } from '../../../src/d2kern-113c/common/drlg/room-tile.js'
import {
  DRLGOUTPLACE_LinkAct5OutdoorLevels113c,
  DRLGOUTPLACE_PlaceAct4Levels113c,
  DRLGOUTPLACE_PlaceAct5OutdoorLevels113c,
  DRLGOUTPLACE_PlaceActLevelsByList113c,
} from '../../../src/d2kern-113c/common/drlg/out-place.js'

const FIXTURE_PATH = resolve(import.meta.dirname, '../../fixtures/oracle/k1/i14a-3-vectors.ndjson')

const DISPATCH: Record<string, (m: SparseMemory113c, args: number[]) => number | void> = {
  '0x6FD62720': (m, a) =>
    UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(
      m,
      a[0]!,
      (a[1] ?? 0) !== 0 ? (mem, unit) => ((mem.u32((unit + 4) >>> 0) & 1) === 0 ? 1 : 0) : undefined,
    ),
  '0x6FD62F80': (m, a) => DRLGPRESET_UpdateRoomTileAnims113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD65980': (m, a) => DRLGOUTPLACE_PlaceAct4Levels113c(m, a[0]!),
  '0x6FD65A80': (m, a) => DRLGOUTPLACE_PlaceAct5OutdoorLevels113c(m, a[0]!),
  '0x6FD66CF0': (m, a) => DRLGOUTPLACE_LinkAct5OutdoorLevels113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD66E10': (m, a) => DRLGOUTPLACE_PlaceActLevelsByList113c(m, a[0]!, a[1]!),
}

describe('K1 Iteration 14 Lane A — I14A-3 differential replay', () => {
  const vectors = loadVectors(FIXTURE_PATH)

  it('covers all 6 VAs in i14a-3-vectors.ndjson with >= 3 non-degenerate vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(6)
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
      for (const blk of rec.outputs.memory) {
        const start = Number.parseInt(blk.base, 16) >>> 0
        const len = blk.hex.length >>> 1
        expect(dumpHex(start, len), `post-mem ${blk.base}`).toBe(blk.hex)
      }
    })
  }
})

describe('K1 Iteration 14 Lane A — I14A-3 AST mutation coverage', () => {
  const vectors = loadVectors(FIXTURE_PATH)
  function memFromVec(va: string, idx = 0): { m: SparseMemory113c; args: number[] } {
    const rec = vectors.find((v) => v.va === va && v.caseIndex === idx)!
    const m = new SparseMemory113c()
    for (const blk of rec.inputs.memory) {
      m.loadBlock(Number.parseInt(blk.base, 16) >>> 0, Buffer.from(blk.hex, 'hex'))
    }
    return { m, args: rec.inputs.args.map(parseArg) }
  }

  it('UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c handles interior room', () => {
    const { m, args } = memFromVec('0x6FD62720', 1)
    const pData = args[0]!
    const pRoom = m.u32(pData + 0x08)
    m.setU32(pData + 0x0c, 1)
    m.setU32(pData + 0x14, 0)
    m.setU32(pData + 0x28, 2)
    m.setU32(pRoom + 0x24, 0)
    const r = UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pData, () => 1)
    expect(r).toBe(1)
  })

  it('DRLGPRESET_UpdateRoomTileAnims113c updates multiple anim tiles', () => {
    const { m, args } = memFromVec('0x6FD62F80', 1)
    const pTileData = args[0]!
    const pRoomEx = args[1]!
    const pGridBase = args[4]!
    const pEntry0 = m.alloc(0x30)
    const pEntry1 = m.alloc(0x30)
    m.setU16(pEntry0 + 0x06, 0x0100)
    m.setU32(pEntry0 + 0x20, 0)
    m.setU16(pEntry1 + 0x06, 0x0100)
    m.setU32(pEntry1 + 0x20, 1)
    m.setU32(pTileData + 0x08, 0)
    m.setU32(pTileData + 0x0c, 0)
    m.setU32(pTileData + 0x14, 1 << 14)
    m.setU32(pTileData + 0x18, pEntry0)
    m.setU32(pTileData + 0x1c, 0)
    const pCells = m.alloc(0x20)
    const pRowOff = m.alloc(0x20)
    m.setU32(pGridBase, pCells)
    m.setU32(pGridBase + 0x04, pRowOff)
    const pHash = m.alloc(0x200)
    const pNode = m.alloc(0x20)
    const pBlk0 = m.alloc(0x08)
    const pBlk1 = m.alloc(0x08)
    m.setU32(pBlk0, pEntry0)
    m.setU32(pBlk0 + 0x04, pBlk1)
    m.setU32(pBlk1, pEntry1)
    m.setU32(pNode + 0x0c, pBlk0)
    m.setU32(pHash, pNode)
    m.setU32(pRoomEx + 0x68, pHash)
    const pTG = m.alloc(0x40)
    const pFloors = m.alloc(0x100)
    m.setU32(pTG + 0x0c, 1)
    m.setU32(pTG + 0x1c, pFloors)
    m.setU32(pRoomEx + 0x54, pTG)
    DRLGPRESET_UpdateRoomTileAnims113c(m, pTileData, pRoomEx, 0, 1, pGridBase)
    expect(m.u32(pTG + 0x0c)).toBe(2)
    const pAnimHdr = m.u32(pTG + 0x04)
    expect(pAnimHdr).not.toBe(0)
    expect(m.u32(m.u32(pAnimHdr) + 0x04)).toBe((pFloors + 0x30) >>> 0)
  })

  it('DRLGOUTPLACE_PlaceAct4Levels113c handles nLevelId boundary', () => {
    const { m, args } = memFromVec('0x6FD65980', 0)
    m.fill(0, 0x100, 0)
    const sgpt = m.u32(0x6fde9e1c)
    m.setU32(sgpt + 0xc5c, 0x53)
    DRLGOUTPLACE_PlaceAct4Levels113c(m, args[0]!)
    const pDrlg = m.u32(args[0]! + 0x1b4)
    let pLvl83 = m.u32(pDrlg + 0x47c)
    while (pLvl83 !== 0 && (m.u32(pLvl83 + 0x1d0) | 0) !== 0x53) {
      pLvl83 = m.u32(pLvl83 + 0x1ac)
    }
    expect(pLvl83).not.toBe(0)
    expect(m.u32(pLvl83 + 0x24)).toBe(0)
  })

  it('DRLGOUTPLACE_PlaceAct5OutdoorLevels113c multi-seed order/sort coverage', () => {
    let checksum = 0
    for (const s of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12345, 54321]) {
      const { m, args } = memFromVec('0x6FD65A80', 0)
      const pLvlDef = m.u32(0x6fdf0b38) + 0x2e50
      m.setU32(pLvlDef + 0x0c, 64)
      m.setU32(pLvlDef + 0x18, 192)
      const pDrlg = m.u32(args[0]! + 0x1b4)
      m.setU32(pDrlg, s)
      const pOut = DRLGOUTPLACE_PlaceAct5OutdoorLevels113c(m, args[0]!)
      expect(pOut).not.toBe(0)
      let pLvl = m.u32(pDrlg + 0x47c)
      const ys: number[] = []
      while (pLvl !== 0) {
        const lid = m.u32(pLvl + 0x1d0) | 0
        if (lid >= 0x4c && lid <= 0x4e) {
          ys.push(m.u32(pLvl + 0x20) | 0)
          checksum = (checksum + (m.u32(pLvl + 0x1c) | 0) * (lid - 0x4b) + (m.u32(pLvl + 0x20) | 0) * 3 + (m.u32(pLvl + 0x1b8) | 0) * 7) | 0
          const rGrid = m.u32(pLvl + 0x1bc)
          for (let k = 0; k < 12; k++) {
            checksum = (Math.imul(checksum, 31) + (m.u32(rGrid + k * 4) | 0)) | 0
          }
        }
        pLvl = m.u32(pLvl + 0x1ac)
      }
      expect(ys.length).toBe(3)
    }
    expect(checksum).toBe(-1233436129)
  })

  it('DRLGOUTPLACE_PlaceActLevelsByList113c processes non-empty pList', () => {
    const { m, args } = memFromVec('0x6FD66E10', 0)
    const pDrlg = args[0]!
    const pList = args[1]!
    const pLvl0 = m.u32(pDrlg + 0x47c)
    const pLvl1 = m.u32(pLvl0 + 0x1ac)
    const pLvl2 = m.u32(pLvl1 + 0x1ac)
    const pRoomEx1b = m.alloc(0x40)
    m.setU32(pLvl0 + 0x1d0, 6)
    m.setU32(pLvl1 + 0x1d0, 1)
    m.setU32(pLvl2 + 0x14, pRoomEx1b)
    m.setU32(pLvl2 + 0x1d0, 0x1b)
    m.setU32(pList + 0x04, 6)
    m.setU32(pList + 0x08, 0xffffffff)
    m.setU32(pList + 0x0c, 0xffffffff)
    m.setU32(pList + 0x14, 1)
    m.setU32(pList + 0x18, 0xffffffff)
    m.setU32(pList + 0x1c, 0xffffffff)
    m.setU32(pList + 0x24, 0)
    let calls = 0
    let postState1 = 0
    let rand0Tail14 = 0
    let guardTail = -1
    const seenLinkPtrs: number[] = []
    const seenIters: number[] = []
    const seenLvlIds: number[] = []
    const pRoomEx28 = m.alloc(0x40)
    const pLvl28 = m.alloc(0x200)
    m.setU32(pLvl28, 2)
    m.setU32(pLvl28 + 0x14, pRoomEx28)
    m.setU32(pLvl28 + 0x1d0, 0x28)
    m.setU32(pLvl2 + 0x1ac, pLvl28)
    m.setU32(pList + 0x24, 0x28)
    m.setU32(pList + 0x28, 0xffffffff)
    m.setU32(pList + 0x2c, 0xffffffff)
    m.setU32(pList + 0x34, 0)
    DRLGOUTPLACE_PlaceActLevelsByList113c(
      m,
      pDrlg,
      pList,
      (sm, pLinkData, idx, nLevelId) => {
        calls++
        seenLinkPtrs.push(sm.u32((pLinkData + 0xf8) >>> 0))
        seenIters.push(sm.u32((pLinkData + 0x1ec) >>> 0))
        seenLvlIds.push(sm.u32((pLinkData + 0x1f0) >>> 0))
        expect(nLevelId).toBe(idx === 0 ? 6 : idx === 1 ? 1 : 0x28)
        if (idx === 1 && calls === 2) return 0
        if (idx === 2) sm.setU32((pLinkData + 0xfc + 12) >>> 0, 2)
        return 1
      },
      (sm, frameBase, idx) => {
        if (idx === 0) {
          sm.setU32((frameBase + 0xfc) >>> 0, 1)
          if (calls === 1) sm.setU32((frameBase + 0x1b0 + 4) >>> 0, 0x12345678)
        }
        return 1
      },
      (sm, _pLvl, idx, pStates) => {
        if (idx === 1) {
          postState1 = sm.u32((pStates - 0xfc + 0x1b0 + 4) >>> 0)
          rand0Tail14 = sm.u32((pStates + 14 * 4) >>> 0)
          guardTail = sm.u32((pStates - 0xfc + 0x1ec) >>> 0)
        }
      },
    )
    expect(seenLinkPtrs).toEqual([pList, pList, pList, pList, pList])
    expect(seenIters).toEqual([0, 1, 0, 1, 2])
    expect(seenLvlIds).toEqual([6, 1, 6, 1, 0x28])
    expect(m.u32(pRoomEx1b + 0x04)).toBeGreaterThan(0)
    expect(m.u32(pRoomEx28 + 0x04)).toBe(2)
    expect(postState1).toBe(0xffffffff)
    expect(rand0Tail14).toBe(0xffffffff)
    expect(guardTail).toBe(2)
  })

  it('DRLGOUTPLACE_PlaceActLevelsByList113c dispatches entryPtr linker VAs and .rdata Act 1 link list', () => {
    const { m, args } = memFromVec('0x6FD66E10', 0)
    const pDrlg = args[0]!
    m.setU32(pDrlg, 0x12345678)
    m.setU32(pDrlg + 0x04, 0x29a)
    m.setU8(pDrlg + 0x450, 0)
    m.setU8(pDrlg + 0x480, 0)

    const sgpt = m.u32(0x6fde9e1c)
    m.setU32(sgpt + 0xc5c, 0x20)
    const lvlDefBase = m.alloc(0x20 * 0x9c)
    m.setU32(0x6fdf0b38, lvlDefBase)

    const setLvlDef = (id: number, w: number, h: number, offX: number, offY: number): void => {
      const rec = (lvlDefBase + Math.imul(id, 0x9c)) >>> 0
      m.setU32(rec + 0x0c, w)
      m.setU32(rec + 0x18, h)
      m.setU32(rec + 0x24, offX)
      m.setU32(rec + 0x28, offY)
    }
    setLvlDef(4, 32, 32, 200, 200)
    setLvlDef(3, 32, 32, 0, 0)
    setLvlDef(2, 32, 32, 0, 0)
    setLvlDef(1, 24, 24, 0, 0)
    setLvlDef(0x11, 24, 24, 0, 0)

    // Pre-allocate levels 4, 3, 2, 1 (town, drlgType=2), and 17 (drlgType=3) on pDrlg->pLevel (+0x47c)
    const lvlIds = [4, 3, 2, 1, 0x11]
    const lvlPtrs = new Map<number, number>()
    let prev = 0
    for (const id of lvlIds) {
      const pLvl = m.alloc(0x200)
      const pSub = m.alloc(0x80)
      m.setU32(pLvl, id === 1 ? 2 : 3)
      m.setU32(pLvl + 0x14, pSub)
      m.setU32(pLvl + 0x1b4, pDrlg)
      m.setU32(pLvl + 0x1d0, id)
      if (prev === 0) m.setU32(pDrlg + 0x47c, pLvl)
      else m.setU32(prev + 0x1ac, pLvl)
      prev = pLvl
      lvlPtrs.set(id, pLvl)
    }

    // Run end-to-end against real .rdata ACT1_LINK_DEFS_VA (0x6fddcbe8),
    // real overlap validator VA (0x6fd64a00), and real vertex-flag post VA (0x6fd63fd0)
    DRLGOUTPLACE_PlaceActLevelsByList113c(m, pDrlg, 0x6fddcbe8, undefined, 0x6fd64a00, 0x6fd63fd0)

    const pLvl4 = lvlPtrs.get(4)!
    expect(m.u32(pLvl4 + 0x1c)).toBe(200)
    expect(m.u32(pLvl4 + 0x20)).toBe(200)
    expect(m.u32(pLvl4 + 0x24)).toBe(32)
    expect(m.u32(pLvl4 + 0x28)).toBe(32)

    for (const id of [3, 2, 1, 0x11]) {
      const pLvl = lvlPtrs.get(id)!
      expect(m.u32(pLvl + 0x24)).toBeGreaterThan(0)
      expect(m.u32(pLvl + 0x28)).toBeGreaterThan(0)
    }

    const pTownRoomEx = m.u32(lvlPtrs.get(1)! + 0x14)
    expect(m.u32(pTownRoomEx + 0x04)).toBeLessThan(4)
  })
})
