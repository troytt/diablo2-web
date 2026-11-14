import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  DATATBLS_GetDirectionOffset113c,
  DATATBLS_NormalizeDirection113c,
  DATATBLS_UnusedStub10182_113c,
  DRLG_ApplyOutdoorVertexFlags113c,
  DRLG_CheckAct1LinkOverlap113c,
  DRLG_CheckAct1WildLinkOverlap113c,
  DRLG_CheckAct2LinkOverlap113c,
  DRLG_CheckAct4LinkOverlap113c,
  DRLG_CheckMonasteryLinkOverlap113c,
  DRLG_GetLevelBorderStyle113c,
  DRLG_LinkOutdoorLevels113c,
  DRLG_RandomizePresetRooms113c,
  DRLG_ReplacePresetRoom113c,
  MONSTERS_CheckMonStatsFlagBit6_113c,
  MONSTERS_IsDead113c,
  MONSTERS_IsDemonOrUndead113c,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b018-vectors.ndjson')

interface MemBlock {
  addr: number
  hex: string
}

interface VectorRecord {
  va: string
  name: string
  caseId: string
  args: number[]
  retMask: number
  eax: number
  pre: MemBlock[]
  post: MemBlock[]
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >>> 1)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0')
  }
  return out
}

function createGuardedMemory(pre: MemBlock[]): {
  raw: SparseMemory113c
  mem: Memory113c
  rogueWrites: number[]
} {
  const raw = new SparseMemory113c()
  const spans: Array<{ start: number; end: number }> = []
  for (const blk of pre) {
    const start = blk.addr >>> 0
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

type B018Runner = (mem: Memory113c, args: number[]) => number

const B018_DISPATCH: Readonly<Record<string, B018Runner>> = {
  '0x6FD5E430': (mem, [pLevel, nOldPrestId, nNewPrestId, nNewOrient, bClearBit1]) =>
    DRLG_ReplacePresetRoom113c(mem, pLevel!, nOldPrestId!, nNewPrestId!, nNewOrient!, bClearBit1!),
  '0x6FD5E700': (mem, [pLevel]) => {
    DRLG_RandomizePresetRooms113c(mem, pLevel!)
    return 0
  },
  '0x6FD63FD0': (mem, [pLevel, nVertexIndex, pDirArray]) => {
    DRLG_ApplyOutdoorVertexFlags113c(mem, pLevel!, nVertexIndex!, pDirArray!)
    return 0
  },
  '0x6FD644C0': (mem, [pLinkData]) => DRLG_LinkOutdoorLevels113c(mem, pLinkData!),
  '0x6FD645A0': (mem, [pLevel, bFlag]) => DRLG_GetLevelBorderStyle113c(mem, pLevel!, bFlag!),
  '0x6FD64630': (mem, [pLinkData, nIteration]) => DRLG_CheckAct1LinkOverlap113c(mem, pLinkData!, nIteration!),
  '0x6FD646C0': (mem, [pLinkData, nIteration]) => DRLG_CheckAct1WildLinkOverlap113c(mem, pLinkData!, nIteration!),
  '0x6FD64750': (mem, [pLinkData, nIteration]) => DRLG_CheckAct2LinkOverlap113c(mem, pLinkData!, nIteration!),
  '0x6FD647E0': (mem, [pLinkData, nIteration]) => DRLG_CheckAct4LinkOverlap113c(mem, pLinkData!, nIteration!),
  '0x6FD64870': (mem, [pLinkData, nIteration]) => DRLG_CheckMonasteryLinkOverlap113c(mem, pLinkData!, nIteration!),
  '0x6FD6A270': (mem, [nDir, pOutX, pOutY]) => {
    DATATBLS_GetDirectionOffset113c(mem, nDir!, pOutX!, pOutY!)
    return 0
  },
  '0x6FD6A2B0': (mem, [nDir]) => DATATBLS_NormalizeDirection113c(mem, nDir!),
  '0x6FD6A3C0': (mem, [a0, a1]) => {
    DATATBLS_UnusedStub10182_113c(mem, a0!, a1!)
    return 0
  },
  '0x6FD6A520': (mem, [pUnit]) => MONSTERS_IsDead113c(mem, pUnit!),
  '0x6FD6A550': (mem, [pMonStatsTxt, pUnit]) => MONSTERS_CheckMonStatsFlagBit6_113c(mem, pMonStatsTxt!, pUnit!),
  '0x6FD6A5B0': (mem, [pUnit]) => MONSTERS_IsDemonOrUndead113c(mem, pUnit!),
}

function verifyVector(rec: VectorRecord, overrideRet?: number, mutatePostAddr?: number): void {
  const runner = B018_DISPATCH[rec.va]
  if (!runner) throw new Error(`Missing B018 runner for ${rec.va}`)
  const { raw, mem, rogueWrites } = createGuardedMemory(rec.pre)
  const actualRet = overrideRet !== undefined ? overrideRet : runner(mem, rec.args)
  if (mutatePostAddr !== undefined) {
    raw.setU8(mutatePostAddr, raw.u8(mutatePostAddr) ^ 0xff)
  }
  const mask = rec.retMask >>> 0
  if (mask !== 0) {
    const got = ((actualRet >>> 0) & mask) >>> 0
    const exp = ((rec.eax >>> 0) & mask) >>> 0
    if (got !== exp) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] eax mismatch: got 0x${got.toString(16)}, expected 0x${exp.toString(16)}`,
      )
    }
  }
  if (rogueWrites.length > 0) {
    throw new Error(
      `${rec.va} ${rec.name} [${rec.caseId}] wrote outside tracked blocks at 0x${rogueWrites[0]!.toString(16)}`,
    )
  }
  for (const blk of rec.post) {
    const start = blk.addr >>> 0
    const len = blk.hex.length >>> 1
    const actualHex = bytesToHex(raw.readBytes(start, len))
    if (actualHex !== blk.hex) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] post-memory mismatch at 0x${start.toString(16)}: got ${actualHex}, expected ${blk.hex}`,
      )
    }
  }
}

describe('K1 Lane B — B018 D2Common DRLG, DataTbls, and Monster Table Leaf Functions Real-DLL Differential Replay (16 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord)

  it('loads all 16 B018 function VAs with >= 4 real-DLL vectors each', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(126)
    const expectedVas = Object.keys(B018_DISPATCH)
    expect(expectedVas.length).toBe(16)
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4)
    }
  })

  for (const [va, runner] of Object.entries(B018_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte with zero rogue writes for ${va}`, () => {
      expect(runner).toBeTypeOf('function')
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length).toBeGreaterThan(0)
      for (const rec of fnVectors) {
        verifyVector(rec)
      }
    })
  }

  it('negative control: mutating return value or post-memory state is caught for every B018 function', () => {
    for (const va of Object.keys(B018_DISPATCH)) {
      if (va === '0x6FD6A3C0') continue // pure 0-op ret 8 stub
      const rec = vectors.find(v => v.va === va && (v.retMask !== 0 || v.post.length > 0))!
      expect(rec).toBeDefined()
      if (rec.retMask !== 0) {
        expect(() => verifyVector(rec, (rec.eax ^ 1) >>> 0)).toThrow(/eax mismatch/)
      }
      if (rec.post.length > 0) {
        const firstAddr = rec.post[0]!.addr >>> 0
        expect(() => verifyVector(rec, undefined, firstAddr)).toThrow(/post-memory mismatch/)
      }
    }
  })
})
