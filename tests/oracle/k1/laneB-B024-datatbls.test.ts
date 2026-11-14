import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  DATATBLS_AdjustMonsterPresetIndex113c,
  DATATBLS_GetBeltsTxtRecordCountPtr113c,
  DATATBLS_GetBooksTxtRecordCountPtr113c,
  DATATBLS_GetChestTreasureClass113c,
  DATATBLS_GetCompCodeString113c,
  DATATBLS_GetCurrentLevelFromExp113c,
  DATATBLS_GetExpRatio113c,
  DATATBLS_GetLevelMonsterLevel113c,
  DATATBLS_GetMaxLevel113c,
  DATATBLS_GetMonLvlTxtRecord113c,
  DATATBLS_GetObjGroupTxtRecordCount113c,
  DATATBLS_GetQualityItemsTxtRecordCountPtr113c,
  DATATBLS_GetShrinesTxtRecord113c,
  DATATBLS_GetStartExpForLevel113c,
  UNITS_IsPointWithinRadius113c,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b024-vectors.ndjson')

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

interface StrictMem {
  raw: SparseMemory113c
  mem: Memory113c
  rogueWrites: number[]
}

function createStrictMem(pre: MemBlock[], post: MemBlock[]): StrictMem {
  const raw = new SparseMemory113c()
  for (const blk of pre) {
    raw.loadBlock(blk.addr >>> 0, hexToBytes(blk.hex))
  }
  const allowedWriteSpans: Array<{ start: number; end: number }> = []
  for (let i = 0; i < post.length; i++) {
    const postBlk = post[i]!
    const preBlk = pre[i]
    if (!preBlk || preBlk.hex !== postBlk.hex) {
      const start = postBlk.addr >>> 0
      const len = postBlk.hex.length >>> 1
      allowedWriteSpans.push({ start, end: (start + len) >>> 0 })
    }
  }
  const rogueWrites: number[] = []
  const checkWrite = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const a = (addr + i) >>> 0
      if (!allowedWriteSpans.some(s => a >= s.start && a < s.end)) {
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

type B024Runner = (mem: Memory113c, args: number[]) => number

const B024_DISPATCH: Readonly<Record<string, B024Runner>> = {
  '0x6FD8E900': mem => DATATBLS_GetObjGroupTxtRecordCount113c(mem),
  '0x6FD8E960': (mem, [nIndex]) => DATATBLS_GetShrinesTxtRecord113c(mem, nIndex!),
  '0x6FDA3AA0': (mem, [nType, nIndex]) => DATATBLS_AdjustMonsterPresetIndex113c(mem, nType!, nIndex!),
  '0x6FDA43C0': (mem, [nDifficulty, nAct, nTier]) =>
    DATATBLS_GetChestTreasureClass113c(mem, nDifficulty!, nAct!, nTier!),
  '0x6FDAE1C0': (mem, [nIndex]) => DATATBLS_GetCompCodeString113c(mem, nIndex!),
  '0x6FDAE7E0': (mem, [nClass]) => DATATBLS_GetMaxLevel113c(mem, nClass!),
  '0x6FDAE810': (mem, [nClass, nLevel]) => DATATBLS_GetStartExpForLevel113c(mem, nClass!, nLevel!),
  '0x6FDAE840': (mem, [nLevel]) => DATATBLS_GetExpRatio113c(mem, nLevel!),
  '0x6FDB03C0': (mem, [nLevel]) => DATATBLS_GetMonLvlTxtRecord113c(mem, nLevel!),
  '0x6FDB08D0': (mem, [nClass, dwExp]) => DATATBLS_GetCurrentLevelFromExp113c(mem, nClass!, dwExp!),
  '0x6FDBE0C0': (mem, [nLevelId, nDifficulty, bExpansion]) =>
    DATATBLS_GetLevelMonsterLevel113c(mem, nLevelId!, nDifficulty!, bExpansion!),
  '0x6FDC1480': mem => DATATBLS_GetBooksTxtRecordCountPtr113c(mem),
  '0x6FDC1520': mem => DATATBLS_GetQualityItemsTxtRecordCountPtr113c(mem),
  '0x6FDC1660': mem => DATATBLS_GetBeltsTxtRecordCountPtr113c(mem),
  '0x6FDCF550': (mem, [pUnit, pPoint, nRadius]) =>
    UNITS_IsPointWithinRadius113c(mem, pUnit!, pPoint!, nRadius!),
}

function verifyVector(rec: VectorRecord, overrideRet?: number, mutatePostAddr?: number): void {
  const runner = B024_DISPATCH[rec.va]
  if (!runner) throw new Error(`Missing B024 runner for ${rec.va}`)
  const { raw, mem, rogueWrites } = createStrictMem(rec.pre, rec.post)
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
      `${rec.va} ${rec.name} [${rec.caseId}] wrote outside expected post blocks at 0x${rogueWrites[0]!.toString(16)}`,
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

describe('K1 Lane B — B024 D2Common DataTbls & Units Leaf Functions Real-DLL Differential Replay (15 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord)

  it('loads all 15 B024 function VAs with >= 4 real-DLL vectors each (81 total)', () => {
    expect(vectors.length).toBe(81)
    const expectedVas = Object.keys(B024_DISPATCH)
    expect(expectedVas.length).toBe(15)
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4)
    }
  })

  for (const [va, runner] of Object.entries(B024_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte with StrictMem zero rogue writes for ${va}`, () => {
      expect(runner).toBeTypeOf('function')
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length).toBeGreaterThan(0)
      for (const rec of fnVectors) {
        verifyVector(rec)
      }
    })
  }

  it('negative control: mutating return value or post-memory state is caught for every B024 function', () => {
    for (const va of Object.keys(B024_DISPATCH)) {
      const rec = vectors.find(v => v.va === va && v.retMask !== 0)!
      expect(rec).toBeDefined()
      expect(() => verifyVector(rec, (rec.eax ^ 1) >>> 0)).toThrow(/eax mismatch/)
      if (rec.post.length > 0) {
        const firstAddr = rec.post[0]!.addr >>> 0
        expect(() => verifyVector(rec, undefined, firstAddr)).toThrow(/post-memory mismatch/)
      }
    }
  })
})
