import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DATATBLS_GetLevelDefRecord113c,
  DATATBLS_GetLevelsTxtRecord113c,
  DATATBLS_GetLvlTypesTxtRecord113c,
  DATATBLS_UnusedStub10469_113c,
} from '../../../src/d2kern-113c/tables/lvl-tbls-113c.ts'
import {
  DATATBLS_GetGambleDataTables113c,
  DATATBLS_GetItemDataTables113c,
  DATATBLS_GetMagicAffixDataTables113c,
  DATATBLS_GetRareAffixDataTables113c,
  PATH_AStar_FindPointInVisitedCache113c,
  PATH_AStar_GetNodeFromPendingCache113c,
  PATH_AStar_PropagateNewFScoreToChildren113c,
} from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'
import {
  DATATBLS_CalcMissileSubLoopFrames113c,
  DRLGROOM_SetStatusLink0_113c,
  DRLGROOM_SetStatusLink113c,
  DRLGROOM_SetStatusLink1_113c,
  DRLGROOM_SetStatusLink3_113c,
} from '../../../src/d2kern-113c/tables/missile-tbls-113c.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b006-vectors.json')

interface MemBlockJson {
  addr: string
  hex: string
}

interface VectorCaseJson {
  va: string
  name: string
  caseId: string
  compareMode: 'eax' | 'al' | 'void'
  regs: { eax: number; ebx: number; ecx: number; edx: number; esi: number; edi: number }
  stack: number[]
  outEax: number
  preBlocks: MemBlockJson[]
  postBlocks: MemBlockJson[]
}

interface VectorFileJson {
  batch: string
  module: string
  cases: VectorCaseJson[]
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >>> 1)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, '0')
  }
  return s
}

function u32(hex: string): number {
  return parseInt(hex, 16) >>> 0
}

function createGuardedMemory(preBlocks: MemBlockJson[]): {
  raw: SparseMemory113c
  mem: Memory113c
  rogueWrites: number[]
} {
  const raw = new SparseMemory113c()
  const spans: Array<{ start: number; end: number }> = []
  for (const blk of preBlocks) {
    const start = u32(blk.addr)
    const bytes = hexToBytes(blk.hex)
    raw.loadBlock(start, bytes)
    spans.push({ start, end: (start + bytes.length) >>> 0 })
  }
  const rogueWrites: number[] = []
  const checkWrite = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const a = (addr + i) >>> 0
      if (!spans.some(s => a >= s.start && a < s.end)) {
        rogueWrites.push(a)
      }
    }
  }
  const mem: Memory113c = {
    alloc: size => raw.alloc(size),
    u8: p => raw.u8(p),
    u16: p => raw.u16(p),
    u32: p => raw.u32(p),
    setU8: (p, v) => {
      checkWrite(p, 1)
      raw.setU8(p, v)
    },
    setU16: (p, v) => {
      checkWrite(p, 2)
      raw.setU16(p, v)
    },
    setU32: (p, v) => {
      checkWrite(p, 4)
      raw.setU32(p, v)
    },
    get: (base, f, idx) => raw.get(base, f, idx),
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      checkWrite((base + f.off + idx * width) >>> 0, width)
      raw.set(base, f, v, idx)
    },
    fill: (p, len, v) => {
      checkWrite(p, len)
      raw.fill(p, len, v)
    },
  }
  return { raw, mem, rogueWrites }
}

const B006_DISPATCH: Readonly<Record<string, (m: Memory113c, v: VectorCaseJson) => number | undefined>> = {
  '0x6FDBC230': (m, v) => {
    DATATBLS_UnusedStub10469_113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0)
    return undefined
  },
  '0x6FDBC990': (m, v) => DATATBLS_GetLvlTypesTxtRecord113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FDBCB20': (m, v) => DATATBLS_GetLevelDefRecord113c(m, v.regs.ecx >>> 0) >>> 0,
  '0x6FDBCCC0': (m, v) => DATATBLS_GetLevelsTxtRecord113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FDC1280': m => DATATBLS_GetGambleDataTables113c(m) >>> 0,
  '0x6FDC17E0': m => DATATBLS_GetRareAffixDataTables113c(m) >>> 0,
  '0x6FDC1870': m => DATATBLS_GetMagicAffixDataTables113c(m) >>> 0,
  '0x6FDC1A40': m => DATATBLS_GetItemDataTables113c(m) >>> 0,
  '0x6FDCAC50': (m, v) => {
    PATH_AStar_PropagateNewFScoreToChildren113c(m, v.regs.eax >>> 0, v.regs.edx >>> 0)
    return undefined
  },
  '0x6FDCAED0': (m, v) => PATH_AStar_FindPointInVisitedCache113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FDCAF20': (m, v) => PATH_AStar_GetNodeFromPendingCache113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FDCBB70': (m, v) => DRLGROOM_SetStatusLink113c(m, v.regs.eax >>> 0, v.regs.ebx >>> 0) >>> 0,
  '0x6FDCBC60': (m, v) => {
    DRLGROOM_SetStatusLink3_113c(m, v.regs.eax >>> 0)
    return undefined
  },
  '0x6FDCBCD0': (m, v) => {
    DRLGROOM_SetStatusLink1_113c(m, v.regs.eax >>> 0)
    return undefined
  },
  '0x6FDCBD40': (m, v) => {
    DRLGROOM_SetStatusLink0_113c(m, v.regs.eax >>> 0)
    return undefined
  },
  '0x6FDCC4A0': (m, v) => DATATBLS_CalcMissileSubLoopFrames113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
}

function verifyVector(v: VectorCaseJson, mutateReturn = false, mutatePostByte = false): void {
  const fn = B006_DISPATCH[v.va]
  if (!fn) throw new Error(`Missing B006 dispatch for ${v.va}`)
  const { raw, mem, rogueWrites } = createGuardedMemory(v.preBlocks)
  let ret = fn(mem, v)
  if (mutateReturn && ret !== undefined) {
    ret = (ret ^ 1) >>> 0
  }
  if (mutatePostByte && v.postBlocks.length > 0) {
    const firstAddr = u32(v.postBlocks[0]!.addr)
    raw.setU8(firstAddr, raw.u8(firstAddr) ^ 0xff)
  }
  if (v.compareMode === 'eax') {
    const got = (ret ?? 0) >>> 0
    const exp = v.outEax >>> 0
    if (got !== exp) {
      throw new Error(
        `${v.va} ${v.name} [${v.caseId}] eax mismatch: got 0x${got.toString(16)}, expected 0x${exp.toString(16)}`,
      )
    }
  }
  if (rogueWrites.length > 0) {
    throw new Error(
      `${v.va} ${v.name} [${v.caseId}] wrote outside tracked blocks at 0x${rogueWrites[0]!.toString(16)}`,
    )
  }
  for (const blk of v.postBlocks) {
    const start = u32(blk.addr)
    const len = blk.hex.length >>> 1
    const actualHex = bytesToHex(raw.readBytes(start, len))
    if (actualHex !== blk.hex) {
      throw new Error(
        `${v.va} ${v.name} [${v.caseId}] post-memory mismatch at ${blk.addr}: got ${actualHex}, expected ${blk.hex}`,
      )
    }
  }
}

describe('K1 Lane B — B006 D2Common Table & DRLG Room Leaf Functions Real-DLL Differential Replay (16 functions)', () => {
  const fixture: VectorFileJson = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'))

  it('loads all 16 B006 function VAs with >= 4 real-DLL vectors each', () => {
    expect(fixture.batch).toBe('B006')
    expect(fixture.module).toBe('D2Common')
    const expectedVas = Object.keys(B006_DISPATCH)
    expect(expectedVas.length).toBe(16)
    for (const va of expectedVas) {
      const fnCases = fixture.cases.filter(c => c.va === va)
      expect(fnCases.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4)
    }
  })

  for (const va of Object.keys(B006_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte with zero rogue writes for ${va}`, () => {
      const fnCases = fixture.cases.filter(c => c.va === va)
      expect(fnCases.length).toBeGreaterThan(0)
      for (const c of fnCases) {
        verifyVector(c)
      }
    })
  }

  it('negative control: mutating return value or post-memory state is caught for every B006 function', () => {
    for (const va of Object.keys(B006_DISPATCH)) {
      const c = fixture.cases.find(x => x.va === va)!
      expect(c).toBeDefined()
      if (c.compareMode === 'eax') {
        expect(() => verifyVector(c, true, false)).toThrow(/eax mismatch/)
      }
      if (c.postBlocks.length > 0) {
        expect(() => verifyVector(c, false, true)).toThrow(/post-memory mismatch/)
      }
    }
  })
})
