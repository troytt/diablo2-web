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
import {
  DRLGPRESET_AcquireCachedPresetFile113c,
  DRLGPRESET_AllocLevelPresetInfo113c,
  DRLGPRESET_BuildPresetRoomsFromMap113c,
  DRLGPRESET_FreeDrlgMapList113c,
  DRLGPRESET_InitLevelPresetRooms113c,
  DRLGPRESET_LoadFileFromArchive113c,
  DRLGPRESET_LoadPresetRoomMap113c,
  DRLGPRESET_ParseDS1File113c,
  DRLGPRESET_ProcessPresetMap113c,
  DRLGPRESET_SpawnPresetUnits113c,
} from '../../../src/d2kern-113c/common/drlg/preset.js'
import { DRLG_LoadActTownTileLibrary113c } from '../../../src/d2kern-113c/common/drlg/drlg.js'
import {
  DRLGROOM_LoadDt1Files113c,
  DRLGWARP_GetWarpDstAdjustData113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.js'
import { DRLGROOMTILE_BuildPresetRoomTiles113c } from '../../../src/d2kern-113c/common/drlg/room-tile.js'

const FIXTURE_PATH = resolve(import.meta.dirname, '../../fixtures/oracle/k1/i14a-1-vectors.ndjson')

const DISPATCH: Record<string, (m: SparseMemory113c, args: number[]) => number | void> = {
  '0x6FD5A8E0': (m, a) => DRLGPRESET_FreeDrlgMapList113c(m, a[0]!, a[1]!),
  '0x6FD5B320': (m, a) => DRLGPRESET_SpawnPresetUnits113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD5B560': (m, a) => DRLGPRESET_ParseDS1File113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD5BBC0': (m, a) => DRLGPRESET_AllocLevelPresetInfo113c(m, a[0]!),
  '0x6FD5BE50': (m, a) => DRLGPRESET_AcquireCachedPresetFile113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD5BF70': (m, a) => DRLGPRESET_LoadPresetRoomMap113c(m, a[0]!),
  '0x6FD5C060': (m, a) => DRLGPRESET_ProcessPresetMap113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD5C690': (m, a) => DRLGPRESET_BuildPresetRoomsFromMap113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD5C940': (m, a) => DRLGROOMTILE_BuildPresetRoomTiles113c(m, a[0]!),
  '0x6FD5CD10': (m, a) => DRLGPRESET_InitLevelPresetRooms113c(m, a[0]!),
}

describe('K1 Iteration 14 Lane A — I14A-1 differential replay', () => {
  const vectors = loadVectors(FIXTURE_PATH)

  it('covers all 10 VAs in i14a-1-vectors.ndjson with >= 3 non-degenerate vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(10)
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

describe('K1 Iteration 14 Lane A — I14A-1 AST mutation coverage', () => {
  const vectors = loadVectors(FIXTURE_PATH)
  function memFromVec(va: string, idx = 0): { m: SparseMemory113c; args: number[] } {
    const rec = vectors.find((v) => v.va === va && v.caseIndex === idx)!
    const m = new SparseMemory113c()
    for (const blk of rec.inputs.memory) {
      m.loadBlock(Number.parseInt(blk.base, 16) >>> 0, Buffer.from(blk.hex, 'hex'))
    }
    return { m, args: rec.inputs.args.map(parseArg) }
  }

  it('FreeDrlgMapList113c handles null, unit+coords, and pSaveHdr', () => {
    const { m } = memFromVec('0x6FD5A8E0', 1)
    DRLGPRESET_FreeDrlgMapList113c(m, 0, 0)
    const freed: number[] = []
    ;(m as unknown as { free?: (p: number) => void }).free = (p: number) => {
      freed.push(p >>> 0)
    }
    const pMap = m.alloc(0x60); m.fill(pMap, 0x60, 0)
    const pUnit = m.alloc(0x20); m.fill(pUnit, 0x20, 0)
    const pHdr = m.alloc(0x20); m.fill(pHdr, 0x20, 0)
    m.setU32(pUnit + 0x0c, 0)
    m.setU32(pUnit + 0x10, pHdr)
    m.setU32(pHdr + 0x04, 0xdeadbeef)
    m.setU32(pMap + 0x38, pUnit)
    DRLGPRESET_FreeDrlgMapList113c(m, 0, pMap)
    expect(freed).toContain(0xdeadbeef)
    expect(freed.filter((x) => x === pHdr).length).toBe(1)
  })

  it('SpawnPresetUnits113c handles nClassId === 0 vs < 0', () => {
    const { m, args } = memFromVec('0x6FD5B320', 2)
    expect(() => DRLGPRESET_SpawnPresetUnits113c(m, args[0]!, args[1]!, args[2]!)).not.toThrow()
  })

  it('ParseDS1File113c handles nVersion=2 objType=2 and nVersion=8 nAct=0 remap + objType=4 code shift', () => {
    // Case A: nVersion=2, nObjType=2, nObjId=5 (kills n=9)
    {
      const { m, args } = memFromVec('0x6FD5B560', 0)
      const pFile = args[1]!
      const szFile = args[2]!
      const pDs1 = m.alloc(0x200); m.fill(pDs1, 0x200, 0)
      m.setU32(szFile + 0x10, pDs1)
      m.setU32(pDs1, 2) // nVersion = 2
      m.setU32(pDs1 + 4, 1) // nWidth = 1
      m.setU32(pDs1 + 8, 1) // nHeight = 1 -> nCells = 4, 5 layers * 16B = 80B -> objects at +92
      m.setU32(pDs1 + 92, 1) // nObjects = 1
      m.setU32(pDs1 + 96, 2) // nObjType = 2
      m.setU32(pDs1 + 100, 5) // nObjId = 5
      m.setU32(pDs1 + 104, 10) // nX
      m.setU32(pDs1 + 108, 20) // nY
      const origAlloc = m.alloc.bind(m)
      let first = true
      m.alloc = (sz: number): number => {
        if (first) {
          first = false
          return pDs1
        }
        return origAlloc(sz)
      }
      m.setU32(pFile + 0x54, 0)
      DRLGPRESET_ParseDS1File113c(m, args[0]!, pFile, szFile)
      expect(m.u32(pFile + 0x54)).not.toBe(0)
    }
    // Case B: nVersion=8, nAct=0, objType=1 remap (kills n=8) + objType=4 3rd char shift (kills n=10)
    {
      const { m, args } = memFromVec('0x6FD5B560', 0)
      const pFile = args[1]!
      const szFile = args[2]!
      const pDs1 = m.alloc(0x200); m.fill(pDs1, 0x200, 0)
      m.setU32(szFile + 0x10, pDs1)
      m.setU32(pDs1, 8) // nVersion = 8
      m.setU32(pDs1 + 4, 1) // nWidth = 1
      m.setU32(pDs1 + 8, 1) // nHeight = 1
      m.setU32(pDs1 + 12, 0) // nAct = 0
      m.setU32(pDs1 + 16, 0) // nFiles = 0
      m.setU32(pDs1 + 20, 0) // nWalls = 0 (nFloors = 1 -> 16B at +24..+39, plus 16B at +40..+55)
      // Objects start at +56
      m.setU32(pDs1 + 56, 2) // nObjects = 2
      // Object 0: nObjType=1, nObjId=0, nX=1, nY=1, dwFlags=0
      m.setU32(pDs1 + 60, 1)
      m.setU32(pDs1 + 64, 0)
      m.setU32(pDs1 + 68, 1)
      m.setU32(pDs1 + 72, 1)
      m.setU32(pDs1 + 76, 0)
      // Object 1: nObjType=4, nObjId=0x00434241 ('ABC'), nX=2, nY=2, dwFlags=0
      m.setU32(pDs1 + 80, 4)
      m.setU32(pDs1 + 84, 0x00434241)
      m.setU32(pDs1 + 88, 2)
      m.setU32(pDs1 + 92, 2)
      m.setU32(pDs1 + 96, 0)

      const pRemapTbl = m.alloc(0x10); m.fill(pRemapTbl, 0x10, 0)
      m.setU8(pRemapTbl + 1, 1) // mode = 1
      m.setU16(pRemapTbl + 2, 77) // val = 77
      m.setU32(0x6fdf0980, 1)
      m.setU32(0x6fdf0984, pRemapTbl)
      m.setU32(0x6fdf0998, 2)

      const pLinker = m.alloc(0x10); m.fill(pLinker, 0x10, 0)
      const pEntry = m.alloc(0x10); m.fill(pEntry, 0x10, 0)
      m.setU32(pLinker, 1)
      m.setU32(pLinker + 0x08, pEntry)
      m.setU32(pEntry, 0x20434241) // 'ABC '
      m.setU32(pEntry + 0x04, 99)
      m.setU32(0x6fdeff6c, pLinker)

      const origAlloc = m.alloc.bind(m)
      let first = true
      m.alloc = (sz: number): number => {
        if (first) {
          first = false
          return pDs1
        }
        return origAlloc(sz)
      }
      m.setU32(pFile + 0x54, 0)
      DRLGPRESET_ParseDS1File113c(m, args[0]!, pFile, szFile)
      const u2 = m.u32(pFile + 0x54)
      const u1 = m.u32(u2 + 0x0c)
      expect(m.u32(u2 + 0x04)).toBe(99)
      expect(m.u32(u1 + 0x04)).toBe(77)
    }
  })

  it('AllocLevelPresetInfo113c computes rolled variant', () => {
    const { m, args } = memFromVec('0x6FD5BBC0', 0)
    const pPrest = (m.u32(0x6fdf0b3c) + 0x1b0) >>> 0
    m.setU32(pPrest + 0x40, 7)
    m.setU32(args[0]! + 0x1d0, 1)
    m.setU32(args[0]! + 0x1c4, 1)
    m.setU32(args[0]! + 0x1c8, 0)
    DRLGPRESET_AllocLevelPresetInfo113c(m, args[0]!)
    const pInfo = m.u32(args[0]! + 0x14)
    expect(pInfo).toBeGreaterThan(0)
    expect(m.u32(pInfo + 0x04)).toBe(1)
  })

  it('AcquireCachedPresetFile113c skips partial prefix match in cache list', () => {
    const { m, args } = memFromVec('0x6FD5BE50', 0)
    const pNode1 = m.alloc(0x110); m.fill(pNode1, 0x110, 0)
    const pNode2 = m.alloc(0x110); m.fill(pNode2, 0x110, 0)
    const szName = args[1]!
    m.setU8(szName, 0x61) // 'a'
    m.setU8(szName + 1, 0x63) // 'c'
    m.setU8(szName + 2, 0)
    m.setU8(pNode1, 0x61) // 'a'
    m.setU8(pNode1 + 1, 0x62) // 'b' != 'c'
    m.setU8(pNode1 + 2, 0)
    m.setU32(pNode1 + 0x108, 0x11111111)
    m.setU32(pNode1 + 0x10c, pNode2)
    m.setU8(pNode2, 0x61) // 'a'
    m.setU8(pNode2 + 1, 0x63) // 'c'
    m.setU8(pNode2 + 2, 0)
    m.setU32(pNode2 + 0x104, 1)
    m.setU32(pNode2 + 0x108, 0x22222222)
    m.setU32(0x6fdf147c, pNode1)
    DRLGPRESET_AcquireCachedPresetFile113c(m, args[0]!, szName, args[2]!)
    expect(m.u32(args[0]!)).toBe(0x22222222)
    expect(m.u32(pNode2 + 0x104)).toBe(2)
  })

  it('LoadPresetRoomMap113c handles nType=0x1c vs nType=2', () => {
    // nType = 0x1c triggers BuildFortressAndMapAIPaths113c (kills n=23)
    {
      const { m, args } = memFromVec('0x6FD5BF70', 1)
      const roomEx = args[0]!
      const pPreset = m.u32(roomEx + 0x20)
      const pMap = m.u32(pPreset + 0x08)
      const pLvlPrest = m.u32(pMap + 0x08)
      m.setU32(pMap, 0x1c)
      m.setU32(pMap + 0x3c, 1)
      m.setU32(pMap + 0x18, 1)
      m.setU32(pMap + 0x1c, 1)
      m.setU32(pLvlPrest, 0)
      m.setU32(roomEx + 0x28, 0x40000)
      const origU32 = m.u32.bind(m)
      m.u32 = (a: number): number => {
        const pFile = origU32((pMap + 0x0c) >>> 0)
        if (pFile !== 0 && (a >>> 0) === ((pFile + 0x3c) >>> 0)) {
          throw new Error('reached BuildFortressAndMapAIPaths113c')
        }
        return origU32(a)
      }
      expect(() => DRLGPRESET_LoadPresetRoomMap113c(m, roomEx)).toThrow('reached BuildFortressAndMapAIPaths113c')
    }
    // nType = 2 does NOT trigger BuildFortressAndMapAIPaths113c (kills n=21)
    {
      const { m, args } = memFromVec('0x6FD5BF70', 1)
      const roomEx = args[0]!
      const pPreset = m.u32(roomEx + 0x20)
      const pMap = m.u32(pPreset + 0x08)
      const pLvlPrest = m.u32(pMap + 0x08)
      m.setU32(pMap, 2)
      m.setU32(pMap + 0x3c, 1)
      m.setU32(pMap + 0x18, 1)
      m.setU32(pMap + 0x1c, 1)
      m.setU32(pLvlPrest, 0)
      m.setU32(roomEx + 0x28, 0x40000)
      const origU32 = m.u32.bind(m)
      m.u32 = (a: number): number => {
        const pFile = origU32((pMap + 0x0c) >>> 0)
        if (pFile !== 0 && (a >>> 0) === ((pFile + 0x3c) >>> 0)) {
          throw new Error('reached BuildFortressAndMapAIPaths113c')
        }
        return origU32(a)
      }
      expect(() => DRLGPRESET_LoadPresetRoomMap113c(m, roomEx)).not.toThrow()
    }
  })

  it('ProcessPresetMap113c processes prop 10 and fh bounds', () => {
    const { m, args } = memFromVec('0x6FD5C060', 2)
    const lvl = args[0]!
    const grid = args[1]!
    const map = args[3]!
    const pLvlPrest = m.u32(map + 0x08)
    m.setU32(pLvlPrest + 0x34, 1) // bScan = 1
    m.setU32(pLvlPrest + 0x38, 0) // nPops = 0
    const nFileIdx = m.u32(map + 0x04) | 0
    const szFile = (Math.imul(nFileIdx, 0x3c) + pLvlPrest + 0x44) >>> 0
    m.setU8(szFile, 0)

    const pBuf = m.alloc(0x200); m.fill(pBuf, 0x200, 0)
    const pFile = (pBuf + 0x20) >>> 0 // pFile - 0x10 is 0 (kills n=26)
    const pWallProp = (pBuf + 0x80) >>> 0
    const pWallTile = (pBuf + 0x100) >>> 0
    m.setU32(pFile + 0x0c, 3) // fw = 3 (stride = 4)
    m.setU32(pFile + 0x10, 1) // fh = 1
    m.setU32(pFile + 0x14, 1) // nWalls = 1
    m.setU32(pFile + 0x1c, pWallProp)
    m.setU32(pFile + 0x2c, pWallTile)
    m.setU32(map + 0x18, 3)
    m.setU32(map + 0x1c, 1)

    // y=0, x=0: prop=10, style=0x1e (warp) -> +1 warp
    m.setU32(pWallProp + 0, 10)
    m.setU32(pWallTile + 0, (0x1e << 20) | (2 << 8))
    // y=0, x=1..2: prop=0, style=0x1e (if n=25 mutates prop===10 to prop!==10, counts 2 warps!)
    m.setU32(pWallProp + 4, 0)
    m.setU32(pWallTile + 4, (0x1e << 20) | (3 << 8))
    m.setU32(pWallProp + 8, 0)
    m.setU32(pWallTile + 8, (0x1e << 20) | (4 << 8))
    // y=1, x=0 (offset 4*4=16): prop=10, style=0x1e (if n=27 mutates y < fh to y <= fh, counts 2 warps!)
    m.setU32(pWallProp + 16, 10)
    m.setU32(pWallTile + 16, (0x1e << 20) | (5 << 8))

    const pNode = m.alloc(0x110); m.fill(pNode, 0x110, 0)
    m.setU8(pNode, 0)
    m.setU32(pNode + 0x104, 1)
    m.setU32(pNode + 0x108, pFile)
    m.setU32(0x6fdf147c, pNode)
    m.setU32(lvl + 0x1d8, 0)

    DRLGPRESET_ProcessPresetMap113c(m, lvl, grid, args[2]!, map, args[4]!)
    expect(m.u32(lvl + 0x1d8)).toBe(1)
  })

  it('BuildPresetRoomsFromMap113c handles hSub and remX===8', () => {
    const { m, args } = memFromVec('0x6FD5C690', 0)
    const map = args[1]!
    const pLvlPrest = m.u32(map + 0x08)
    m.setU32(pLvlPrest + 0x10, 1) // flags |= 0x80000
    m.setU32(map + 0x18, 8)
    m.setU32(map + 0x1c, 16) // hSub = 3 (gy=0, 1)
    m.setU32(map + 0x20, 0) // if n=28 reads +0x20 instead of +0x1c, hSub = 1, so gy=1 has rFlags=0
    const r = DRLGPRESET_BuildPresetRoomsFromMap113c(m, args[0]!, map, 0x40000, 0)
    expect(r).not.toBe(0)
    expect(m.u32(r + 0x3c)).toBe(8)
    expect(m.u32(r + 0x28) & 0x40000).toBe(0x40000)
  })

  it('InitLevelPresetRooms113c handles pfnErr short-circuit and pDstAdj loop bound', () => {
    // Case 1: nLevelId = 0x28, pfnErr = 0 -> must short-circuit before reading pPrest + 0x30 (kills n=37, n=38)
    {
      const { m, args } = memFromVec('0x6FD5CD10', 1)
      const lvl = args[0]!
      const pDrlg = m.u32(lvl + 0x1b4)
      m.setU32(lvl + 0x1d0, 0x28)
      m.setU32(pDrlg + 0x488, 0) // pfnErrorCallback = 0
      const pPrest30 = (m.u32(0x6fdf0b3c) + 0x28 * 0x1b0 + 0x30) >>> 0
      const origU32 = m.u32.bind(m)
      m.u32 = (a: number): number => {
        if ((a >>> 0) === pPrest30) {
          throw new Error('short-circuit violated: read pPrest + 0x30 when pfnErr === 0')
        }
        return origU32(a)
      }
      expect(() => DRLGPRESET_InitLevelPresetRooms113c(m, lvl)).not.toThrow()
    }
    // Case 2: nLevelId = 3, pfnAutomapInit != 0 -> loop i < 8 must not read pDstAdj + 32 (kills n=39)
    {
      const { m, args } = memFromVec('0x6FD5CD10', 2)
      const lvl = args[0]!
      const pDrlg = m.u32(lvl + 0x1b4)
      m.setU32(pDrlg + 0x454, 1) // pfnAutomapInit != 0
      m.setU32((m.u32(0x6fdf0b3c) + 3 * 0x1b0 + 0x30) >>> 0, 1)
      const pDstAdj = DRLGWARP_GetWarpDstAdjustData113c(m, pDrlg, m.u32(lvl + 0x1d0) | 0)
      const forbiddenAddr = (pDstAdj + 32) >>> 0
      const origU32 = m.u32.bind(m)
      m.u32 = (a: number): number => {
        if ((a >>> 0) === forbiddenAddr) {
          throw new Error('loop bound violated: read pDstAdj[8]')
        }
        return origU32(a)
      }
      expect(() => DRLGPRESET_InitLevelPresetRooms113c(m, lvl)).not.toThrow()
    }
  })

  it('BuildPresetRoomTiles113c handles bOutdoors=0, nType=2, and pTG+0x08 anim count', () => {
    // Subcase 1: bOutdoors = 0 on vector #2 must not set 0x08000000 on roomEx + 0x28 (kills n=32)
    {
      const { m, args } = memFromVec('0x6FD5C940', 2)
      const roomEx = args[0]!
      const pPreset = m.u32(roomEx + 0x20)
      const pMap = m.u32(pPreset + 0x08)
      const pLvlPrest = m.u32(pMap + 0x08)
      m.setU32(pLvlPrest + 0x14, 0) // bOutdoors = 0
      DRLGROOMTILE_BuildPresetRoomTiles113c(m, roomEx)
      expect(m.u32(roomEx + 0x28) & 0x08000000).toBe(0)
    }
    // Subcase 2: nType = 2 must not initialize stack grid (kills n=33)
    {
      const { m, args } = memFromVec('0x6FD5C940', 0)
      const roomEx = args[0]!
      const pPreset = m.u32(roomEx + 0x20)
      const pMap = m.u32(pPreset + 0x08)
      const pFile = m.u32(pMap + 0x0c)
      const pLvlPrest = m.u32(pMap + 0x08)
      m.setU32(pPreset, 2) // nType = 2
      m.setU32(pFile + 0x14, 0) // nWalls = 0
      m.setU32(pFile + 0x18, 0) // nFloors = 0
      m.setU32(pLvlPrest + 0x14, 0) // bOutdoors = 0
      m.setU32(pLvlPrest + 0x18, 0) // hasFiles = 0
      m.setU32(pLvlPrest + 0x0c, 0)
      let reads3c = 0
      const origU32 = m.u32.bind(m)
      m.u32 = (a: number): number => {
        if ((a >>> 0) === ((roomEx + 0x3c) >>> 0)) reads3c++
        return origU32(a)
      }
      DRLGROOMTILE_BuildPresetRoomTiles113c(m, roomEx)
      // 3 reads in 0x6FD5C940 itself + 1 read in the (now real, previously stubbed) 0x6FDB9B50 roof pass;
      // an nType=2 mutant entering the stack-grid branch would add 1 more.
      expect(reads3c).toBe(4)
    }
    // Subcase 3: bOutdoors = 1 reads nWallCount from pTG + 0x08, not pTG - 0x08 (kills n=34)
    {
      const { m, args } = memFromVec('0x6FD5C940', 2)
      const roomEx = args[0]!
      const pPreset = m.u32(roomEx + 0x20)
      const pMap = m.u32(pPreset + 0x08)
      const pFile = m.u32(pMap + 0x0c)
      const pLvlPrest = m.u32(pMap + 0x08)
      m.setU32(pPreset, 2) // nType = 2
      m.setU32(pFile + 0x14, 0) // nWalls = 0
      m.setU32(pFile + 0x18, 0) // nFloors = 0
      m.setU32(pLvlPrest + 0x14, 1) // bOutdoors = 1
      m.setU32(pPreset + 0xd8 + 0x08, 0)
      m.setU32(pPreset + 0xd8 + 0x0c, 0)
      const pBuf = m.alloc(0x100); m.fill(pBuf, 0x100, 0)
      m.setU32(m.u32(m.u32(roomEx + 0x58) + 0x1b4) + 0x478, (pBuf + 0xc0) >>> 0)
      m.setU32(pMap + 0x24, 0)
      m.setU32(pPreset + 0x10, (pBuf + 0xe0) >>> 0)
      m.setU32(pPreset + 0x14, (pBuf + 0xe0) >>> 0)
      const pTG = (pBuf + 0x20) >>> 0 // pTG - 0x08 is 0
      const pWalls = (pBuf + 0x60) >>> 0
      const pEntry = (pBuf + 0xa0) >>> 0
      m.setU16(pEntry + 0x06, 0x100) // animated tile flag
      m.setU32(pWalls + 0x18, pEntry)
      m.setU32(pWalls + 0x14, 1 << 14)
      m.setU32(pTG + 0x14, pWalls)
      m.setU32(pTG + 0x08, 1) // nWallCount = 1 at pTG + 0x08
      m.setU32(roomEx + 0x54, pTG)
      expect(() => DRLGROOMTILE_BuildPresetRoomTiles113c(m, roomEx)).toThrow(D2CommonAssertError)
    }
  })

  it('verifies bSingleRoom pRoomEx return, lvl+0x1c4 seed advance, and MPQ DS1/DT1 hooks', () => {
    // 1. 0x6FD5C690 bSingleRoom !== 0 returns pRoomEx (not 0)
    {
      const { m, args } = memFromVec('0x6FD5C690', 0)
      const lvl = args[0]!
      const map = args[1]!
      const pRoomEx = DRLGPRESET_BuildPresetRoomsFromMap113c(m, lvl, map, 0x40000, 1)
      expect(pRoomEx).not.toBe(0)
      expect(pRoomEx).toBe(m.u32(lvl + 0x10))
    }

    // 2. 0x6FD5C060 advances lvl + 0x1c4 (sSeed) rather than corrupting lvl + 0x14 (pOutdoors)
    {
      const { m, args } = memFromVec('0x6FD5C060', 2)
      const lvl = args[0]!
      const grid = args[1]!
      const map = args[3]!
      const pLvlPrest = m.u32(map + 0x08)
      m.setU32(pLvlPrest + 0x34, 1)
      m.setU32(pLvlPrest + 0x38, 0)
      const nFileIdx = m.u32(map + 0x04) | 0
      m.setU8((Math.imul(nFileIdx, 0x3c) + pLvlPrest + 0x44) >>> 0, 0)
      const pBuf = m.alloc(0x200)
      m.fill(pBuf, 0x200, 0)
      const pFile = (pBuf + 0x20) >>> 0
      const pUnit = (pBuf + 0xc0) >>> 0
      m.setU32(pFile + 0x0c, 1)
      m.setU32(pFile + 0x10, 1)
      m.setU32(pFile + 0x14, 0)
      m.setU32(pFile + 0x54, pUnit)
      m.setU32(pUnit + 0x14, 2) // object
      m.setU32(pUnit + 0x04, 0xc4) // RNG-gated preset object
      m.setU32(map + 0x18, 1)
      m.setU32(map + 0x1c, 1)
      const pNode = m.alloc(0x110)
      m.fill(pNode, 0x110, 0)
      m.setU32(pNode + 0x104, 1)
      m.setU32(pNode + 0x108, pFile)
      m.setU32(0x6fdf147c, pNode)
      m.setU32(lvl + 0x14, 0xdeadbeef)
      m.setU32(lvl + 0x1c4, 12345)
      m.setU32(lvl + 0x1c8, 666)
      const pObjTxt = m.alloc(0x100 * 0x1c0)
      m.fill(pObjTxt, 0x100 * 0x1c0, 0)
      m.setU32(0x6fdf0b98, 0x100)
      m.setU32(0x6fdf0b94, pObjTxt)
      DRLGPRESET_ProcessPresetMap113c(m, lvl, grid, args[2]!, map, args[4]!)
      expect(m.u32(lvl + 0x14)).toBe(0xdeadbeef)
      expect(m.u32(lvl + 0x1c4)).not.toBe(12345)
    }

    // 3. __d2LoadMpqDs1 and __d2LoadMpqDt1Hash optional hooks
    const g = globalThis as unknown as {
      __d2LoadMpqDs1?: (mem: SparseMemory113c, relPath: string) => Uint8Array | null
      __d2LoadMpqDt1Hash?: (mem: SparseMemory113c, path: string) => number
    }
    try {
      const m = new SparseMemory113c()
      const szPath = m.alloc(32)
      const ds1Name = 'Act1\\Town\\townE1.ds1'
      for (let i = 0; i < ds1Name.length; i++) m.setU8(szPath + i, ds1Name.charCodeAt(i))
      m.setU8(szPath + ds1Name.length, 0)
      const pdwSize = m.alloc(4)
      g.__d2LoadMpqDs1 = (_mem, relPath) => {
        expect(relPath).toBe(ds1Name)
        return new Uint8Array([0x12, 0x34, 0x56, 0x78])
      }
      const pBuf = DRLGPRESET_LoadFileFromArchive113c(m, szPath, 0, pdwSize)
      expect(pBuf).not.toBe(0)
      expect(m.u32(pdwSize)).toBe(4)
      expect(m.u32(pBuf)).toBe(0x78563412)

      let dt1Calls = 0
      g.__d2LoadMpqDt1Hash = (_mem, path) => {
        dt1Calls++
        return path.toLowerCase().includes('town') ? 0x30001000 : 0x30002000 + dt1Calls * 0x100
      }
      const pDrlg = m.alloc(0x500)
      m.fill(pDrlg, 0x500, 0)
      m.setU8(pDrlg + 0x480, 0)
      const wStr = (va: number, s: string): void => {
        for (let i = 0; i < s.length; i++) m.setU8(va + i, s.charCodeAt(i))
        m.setU8(va + s.length, 0)
      }
      wStr(0x6fddad5c, 'DATA\\GLOBAL')
      wStr(0x6fde46e4, '%s\\TILES\\ACT1\\TOWN\\TOWN.DT1')
      DRLG_LoadActTownTileLibrary113c(m, pDrlg)
      expect(m.u32(pDrlg + 0x0c)).toBe(0x30001000)

      wStr(0x6fddffb4, '%s\\TILES\\ACT1\\OUTDOORS\\BLANK.DT1')
      wStr(0x6fddff90, '%s\\TILES\\ACT1\\OUTDOORS\\INVISWAL.DT1')
      wStr(0x6fddff70, '%s\\TILES\\ACT1\\OUTDOORS\\WARP.DT1')
      const pLvlTypes = m.alloc(0x1000)
      m.fill(pLvlTypes, 0x1000, 0)
      wStr(pLvlTypes, 'Act1\\Town\\floor.dt1')
      wStr(pLvlTypes + 0x3c, '0')
      m.setU32(0x6fdf141c, pLvlTypes)
      const pLvl = m.alloc(0x230)
      m.fill(pLvl, 0x230, 0)
      m.setU32(pLvl + 0x1c0, 0)
      const pRoomEx = m.alloc(0xec)
      m.fill(pRoomEx, 0xec, 0)
      m.setU32(pRoomEx + 0x58, pLvl)
      m.setU32(pRoomEx + 0x50, 0x03) // bit 0 = floor.dt1, bit 1 = "0" (skipped)
      DRLGROOM_LoadDt1Files113c(m, pRoomEx)
      expect(m.u32(pRoomEx + 0x68)).not.toBe(0)
      expect(m.u32(pRoomEx + 0x74)).not.toBe(0) // 4 non-zero DT1s in slots 0..3
      expect(m.u32(pRoomEx + 0x78)).toBe(0)
    } finally {
      delete g.__d2LoadMpqDs1
      delete g.__d2LoadMpqDt1Hash
    }
  })
})
