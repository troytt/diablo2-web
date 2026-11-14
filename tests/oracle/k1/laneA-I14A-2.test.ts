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
  DRLGMAZE_BuildSpiderCavernRing113c,
  DRLGMAZE_BuildSquarePerimeterRooms113c,
  DRLGMAZE_FinalizeAct1JailConnect113c,
  DRLGMAZE_FinalizeAct5HellBarrow113c,
  DRLGMAZE_GenerateMazeLevel113c,
  DRLGMAZE_PlaceAct1CatacombsPresets113c,
  DRLGMAZE_PlaceAct1CavesPresets113c,
  DRLGMAZE_PlaceAct1CryptsPresets113c,
  DRLGMAZE_PlaceAct1JailPresets113c,
  DRLGMAZE_PlaceAct2MaggotLairPresets113c,
  DRLGMAZE_PlaceAct2PalaceCellarPresets113c,
  DRLGMAZE_PlaceAct2SewersPresets113c,
  DRLGMAZE_PlaceAct2TombPresets113c,
  DRLGMAZE_PlaceAct3DurancePresets113c,
  DRLGMAZE_PlaceAct3FlayerDungeonPresets113c,
  DRLGMAZE_PlaceAct3SewersPresets113c,
  DRLGMAZE_PlaceAct5BaalKeepPresets113c,
  DRLGMAZE_PlaceAct5GlacialPresets113c,
  DRLGMAZE_PlaceAct5IceCavesPresets113c,
  DRLGMAZE_ReplaceMazeRoomWithPresetRooms113c,
} from '../../../src/d2kern-113c/common/drlg/maze.js'

const FIXTURE_PATH = resolve(import.meta.dirname, '../../fixtures/oracle/k1/i14a-2-vectors.ndjson')

const DISPATCH: Record<string, (m: SparseMemory113c, args: number[]) => number | void> = {
  '0x6FD5F110': (m, a) => DRLGMAZE_ReplaceMazeRoomWithPresetRooms113c(m, a[0]!, a[1]!),
  '0x6FD5F220': (m, a) => DRLGMAZE_BuildSpiderCavernRing113c(m, a[0]!),
  '0x6FD602F0': (m, a) => DRLGMAZE_BuildSquarePerimeterRooms113c(m, a[0]!, a[1]!),
  '0x6FD60BE0': (m, a) => DRLGMAZE_PlaceAct5IceCavesPresets113c(m, a[0]!),
  '0x6FD60CA0': (m, a) => DRLGMAZE_FinalizeAct5HellBarrow113c(m, a[0]!),
  '0x6FD60EB0': (m, a) => DRLGMAZE_FinalizeAct1JailConnect113c(m, a[0]!),
  '0x6FD61170': (m, a) => DRLGMAZE_PlaceAct5GlacialPresets113c(m, a[0]!),
  '0x6FD611E0': (m, a) => DRLGMAZE_PlaceAct5BaalKeepPresets113c(m, a[0]!),
  '0x6FD61280': (m, a) => DRLGMAZE_PlaceAct3DurancePresets113c(m, a[0]!),
  '0x6FD61320': (m, a) => DRLGMAZE_PlaceAct3SewersPresets113c(m, a[0]!),
  '0x6FD61380': (m, a) => DRLGMAZE_PlaceAct3FlayerDungeonPresets113c(m, a[0]!),
  '0x6FD613E0': (m, a) => DRLGMAZE_PlaceAct2PalaceCellarPresets113c(m, a[0]!),
  '0x6FD61430': (m, a) => DRLGMAZE_PlaceAct2MaggotLairPresets113c(m, a[0]!),
  '0x6FD614C0': (m, a) => DRLGMAZE_PlaceAct2TombPresets113c(m, a[0]!),
  '0x6FD616B0': (m, a) => DRLGMAZE_PlaceAct2SewersPresets113c(m, a[0]!),
  '0x6FD61940': (m, a) => DRLGMAZE_PlaceAct1CatacombsPresets113c(m, a[0]!),
  '0x6FD619B0': (m, a) => DRLGMAZE_PlaceAct1JailPresets113c(m, a[0]!),
  '0x6FD61A70': (m, a) => DRLGMAZE_PlaceAct1CryptsPresets113c(m, a[0]!),
  '0x6FD61B30': (m, a) => DRLGMAZE_PlaceAct1CavesPresets113c(m, a[0]!),
  '0x6FD61BF0': (m, a) => DRLGMAZE_GenerateMazeLevel113c(m, a[0]!),
}

describe('K1 Iteration 14 Lane A — I14A-2 differential replay', () => {
  const vectors = loadVectors(FIXTURE_PATH)

  it('covers all 20 VAs in i14a-2-vectors.ndjson with >= 3 non-degenerate vectors each', () => {
    const counts = new Map<string, number>()
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1)
    }
    expect(Object.keys(DISPATCH).length).toBe(20)
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

describe('K1 Iteration 14 Lane A — I14A-2 AST mutation coverage', () => {
  const vectors = loadVectors(FIXTURE_PATH)
  function memFromVec(va: string, idx = 0): { m: SparseMemory113c; args: number[] } {
    const rec = vectors.find((v) => v.va === va && v.caseIndex === idx)!
    const m = new SparseMemory113c()
    for (const blk of rec.inputs.memory) {
      m.loadBlock(Number.parseInt(blk.base, 16) >>> 0, Buffer.from(blk.hex, 'hex'))
    }
    return { m, args: rec.inputs.args.map(parseArg) }
  }

  function roomPresets(m: SparseMemory113c, lvl: number): number[] {
    const out: number[] = []
    let p = m.u32(lvl + 0x10)
    while (p !== 0) {
      out.push(m.u32(m.u32(p + 0x20)))
      p = m.u32(p + 0x24)
    }
    return out
  }

  it('ReplaceMazeRoomWithPresetRooms113c checks rh === 0x0c boundary at roomEx+0x40', () => {
    const { m, args } = memFromVec('0x6FD5F110', 0)
    const lvl = args[0]!
    const roomEx = args[1]!
    m.setU32(roomEx + 0x3c, 0x0c)
    m.setU32(roomEx + 0x40, 0x0c)
    m.setU32(roomEx + 0x44, 20)
    DRLGMAZE_ReplaceMazeRoomWithPresetRooms113c(m, lvl, roomEx)
    expect(m.u32(lvl + 0x08)).toBe(1)
  })

  it('PlaceAct5IceCavesPresets113c, Glacial, BaalKeep, Crypts, Jail, Caves branches', () => {
    const e1 = memFromVec('0x6FD60BE0', 0)
    mSet(e1, 0x71, 0)
    DRLGMAZE_PlaceAct5IceCavesPresets113c(e1.m, e1.args[0]!)
    expect(roomPresets(e1.m, e1.args[0]!)).toContain(1037)

    const e2 = memFromVec('0x6FD61170', 0)
    mSet(e2, 0x81, 1)
    DRLGMAZE_PlaceAct5GlacialPresets113c(e2.m, e2.args[0]!)
    expect(roomPresets(e2.m, e2.args[0]!).length).toBe(3)

    const e3 = memFromVec('0x6FD611E0', 0)
    mSet(e3, 0x7b, 1)
    DRLGMAZE_PlaceAct5BaalKeepPresets113c(e3.m, e3.args[0]!)
    expect(roomPresets(e3.m, e3.args[0]!)).toEqual([1050, 1046, 61])

    const e4a = memFromVec('0x6FD61A70', 0)
    mSet(e4a, 0x13, 1)
    DRLGMAZE_PlaceAct1CryptsPresets113c(e4a.m, e4a.args[0]!)
    expect(roomPresets(e4a.m, e4a.args[0]!)).toContain(153)

    const e4b = memFromVec('0x6FD61A70', 0)
    mSet(e4b, 0x18, 1)
    DRLGMAZE_PlaceAct1CryptsPresets113c(e4b.m, e4b.args[0]!)
    expect(roomPresets(e4b.m, e4b.args[0]!)).toContain(145)

    const e5 = memFromVec('0x6FD619B0', 0)
    mSet(e5, 0x1e, 1)
    DRLGMAZE_PlaceAct1JailPresets113c(e5.m, e5.args[0]!)
    expect(roomPresets(e5.m, e5.args[0]!)).toContain(254)

    const e6 = memFromVec('0x6FD61B30', 0)
    mSet(e6, 0x08, 1)
    DRLGMAZE_PlaceAct1CavesPresets113c(e6.m, e6.args[0]!)
    expect(roomPresets(e6.m, e6.args[0]!)).toContain(97)
  })

  function mSet(e: { m: SparseMemory113c; args: number[] }, lid: number, seedLo: number) {
    e.m.setU32(e.args[0]! + 0x1d0, lid)
    e.m.setU32(e.args[0]! + 0x1c4, seedLo)
    e.m.setU32(e.args[0]! + 0x1c8, 0)
  }

  it('FinalizeAct1JailConnect113c dirMode === 1 vs dirMode === 2', () => {
    const e1 = memFromVec('0x6FD60EB0', 0)
    const lvl1 = e1.args[0]!
    const pDrlg1 = e1.m.u32(lvl1 + 0x1b4)
    let pTarget1 = e1.m.u32(pDrlg1 + 0x47c)
    while (pTarget1 !== 0 && (e1.m.u32(pTarget1 + 0x1d0) | 0) !== 0x1b) {
      pTarget1 = e1.m.u32(pTarget1 + 0x1ac)
    }
    e1.m.setU32(e1.m.u32(pTarget1 + 0x14) + 0x04, 1)
    DRLGMAZE_FinalizeAct1JailConnect113c(e1.m, lvl1)
    const x0Mode1 = e1.m.u32(lvl1 + 0x1c) | 0

    const e2 = memFromVec('0x6FD60EB0', 0)
    const lvl2 = e2.args[0]!
    const pDrlg2 = e2.m.u32(lvl2 + 0x1b4)
    let pTarget2 = e2.m.u32(pDrlg2 + 0x47c)
    while (pTarget2 !== 0 && (e2.m.u32(pTarget2 + 0x1d0) | 0) !== 0x1b) {
      pTarget2 = e2.m.u32(pTarget2 + 0x1ac)
    }
    e2.m.setU32(e2.m.u32(pTarget2 + 0x14) + 0x04, 2)
    DRLGMAZE_FinalizeAct1JailConnect113c(e2.m, lvl2)
    const x0Mode2 = e2.m.u32(lvl2 + 0x1c) | 0

    expect(x0Mode1).toBe(-14)
    expect(x0Mode2).toBe(0)
  })

  it('PlaceAct2TombPresets113c covers 0x39, 0x3b, 0x42..0x48', () => {
    const allPresets: number[][] = []
    for (const lid of [0x39, 0x3b, 0x42]) {
      const e = memFromVec('0x6FD614C0', 0)
      e.m.setU32(e.args[0]! + 0x1d0, lid)
      const pRoom = e.m.u32(e.args[0]! + 0x10)
      const pType = e.m.u32(pRoom + 0x20)
      e.m.setU32(pType, 0x1bd)
      const pDrlg = e.m.u32(e.args[0]! + 0x1b4)
      e.m.setU32(pDrlg + 0x480, 0x43)
      e.m.setU32(pDrlg + 0x484, 0x99)
      DRLGMAZE_PlaceAct2TombPresets113c(e.m, e.args[0]!)
      allPresets.push(roomPresets(e.m, e.args[0]!))
    }
    expect(allPresets[0]!.length).toBe(3)
    expect(allPresets[1]!.length).toBe(4)
    expect(allPresets[2]!.length).toBe(2)
    expect(allPresets[0]).not.toEqual(allPresets[1])
    expect(allPresets[2]![0]).not.toBe(0x1bd)
  })

  it('PlaceAct2SewersPresets113c covers 0x41 and 0x2f', () => {
    const e1 = memFromVec('0x6FD616B0', 0)
    mSet(e1, 0x41, 1)
    DRLGMAZE_PlaceAct2SewersPresets113c(e1.m, e1.args[0]!)
    expect(roomPresets(e1.m, e1.args[0]!)).toContain(351)

    const e2 = memFromVec('0x6FD616B0', 0)
    mSet(e2, 0x2f, 1)
    let readsFirstRoom = 0
    const origU32 = e2.m.u32.bind(e2.m)
    const firstRoomAddr = (e2.args[0]! + 0x10) >>> 0
    e2.m.u32 = (a: number): number => {
      if ((a >>> 0) === firstRoomAddr) readsFirstRoom++
      return origU32(a)
    }
    DRLGMAZE_PlaceAct2SewersPresets113c(e2.m, e2.args[0]!)
    expect(readsFirstRoom).toBe(30)
  })

  it('GenerateMazeLevel113c covers room count increment, case 18, and case 25 (0x5c)', () => {
    // Default case verifies lvl + 0x08 incremented by +1 (kills n=75)
    {
      const e = memFromVec('0x6FD61BF0', 0)
      e.m.setU32(e.args[0]! + 0x08, 0)
      e.m.setU32(e.args[0]! + 0x1c0, 0)
      expect(() => DRLGMAZE_GenerateMazeLevel113c(e.m, e.args[0]!)).toThrow(D2CommonAssertError)
      expect(e.m.u32(e.args[0]! + 0x08)).toBe(1)
    }
    // Case 18 builds perimeter rooms before presets (kills n=73)
    {
      const e = memFromVec('0x6FD61BF0', 0)
      mSet(e, 0x40, 7)
      e.m.setU32(e.args[0]! + 0x08, 0)
      e.m.setU32(e.args[0]! + 0x1c0, 18)
      e.m.setU32(e.args[0]! + 0x10, 0)
      e.m.setU32(e.args[0]! + 0x24, 1000)
      e.m.setU32(e.args[0]! + 0x28, 1000)
      try { DRLGMAZE_GenerateMazeLevel113c(e.m, e.args[0]!) } catch { /* expected after perimeter */ }
      expect(e.m.u32(e.args[0]! + 0x08)).toBeGreaterThan(2)
    }
    // Case 25 with nLevelId === 0x5c builds 5x5 perimeter (16 rooms) (kills n=74)
    {
      const e = memFromVec('0x6FD61BF0', 0)
      mSet(e, 0x5c, 7)
      e.m.setU32(e.args[0]! + 0x08, 0)
      e.m.setU32(e.args[0]! + 0x1c0, 25)
      e.m.setU32(e.args[0]! + 0x10, 0)
      e.m.setU32(e.args[0]! + 0x24, 1000)
      e.m.setU32(e.args[0]! + 0x28, 1000)
      try { DRLGMAZE_GenerateMazeLevel113c(e.m, e.args[0]!) } catch { /* expected at ReplacePresetRoom assert */ }
      expect(e.m.u32(e.args[0]! + 0x08)).toBeGreaterThanOrEqual(16)
    }
    // Case 10 (Catacombs 0x22 = all 4 dirs -> 5 rooms before expand; 0x23 = pair -> 3 rooms before expand)
    {
      const e22 = memFromVec('0x6FD61BF0', 0)
      mSet(e22, 0x22, 0)
      e22.m.setU32(e22.args[0]! + 0x08, 0)
      e22.m.setU32(e22.args[0]! + 0x1c0, 10)
      e22.m.setU32(e22.args[0]! + 0x10, 0)
      e22.m.setU32(e22.args[0]! + 0x24, 1000)
      e22.m.setU32(e22.args[0]! + 0x28, 1000)
      try { DRLGMAZE_GenerateMazeLevel113c(e22.m, e22.args[0]!) } catch { /* expected at Catacombs presets */ }
      expect(e22.m.u32(e22.args[0]! + 0x08)).toBe(5)

      const e23 = memFromVec('0x6FD61BF0', 0)
      mSet(e23, 0x23, 0)
      e23.m.setU32(e23.args[0]! + 0x08, 0)
      e23.m.setU32(e23.args[0]! + 0x1c0, 10)
      e23.m.setU32(e23.args[0]! + 0x10, 0)
      e23.m.setU32(e23.args[0]! + 0x24, 1000)
      e23.m.setU32(e23.args[0]! + 0x28, 1000)
      try { DRLGMAZE_GenerateMazeLevel113c(e23.m, e23.args[0]!) } catch { /* expected at Catacombs presets */ }
      expect(e23.m.u32(e23.args[0]! + 0x08)).toBe(4)
    }
  })
})
