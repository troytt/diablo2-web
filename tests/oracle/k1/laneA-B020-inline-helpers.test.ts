import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DATATBLS_CalcSkillLinearParam12Inline113c,
  DATATBLS_CalcSkillLinearParam34Inline113c,
  DATATBLS_CalcSkillLinearParam56Inline113c,
  DATATBLS_CalcSkillLinearParam78Inline113c,
  DATATBLS_CheckMonStatsFlagInline113c,
  DATATBLS_GetItemStatCostTxtRecordInline113c,
  DATATBLS_GetSetItemsTxtRecordInline113c,
  DATATBLS_GetSetsTxtRecordInline113c,
  DATATBLS_GetSkillsTxtParam4Inline113c,
  DATATBLS_GetSkillsTxtParam5Inline113c,
  DATATBLS_GetSkillsTxtParam6Inline113c,
  DATATBLS_GetStatesTxtRecordInline113c,
  DATATBLS_GetUniqueItemsTxtRecordInline113c,
  DATATBLS_HasValidSkillDescInline113c,
  DATATBLS_WalkMonsterClassChainInline113c,
  MONSTERS_GetBaseIdFromMonsterUnitInline113c,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b020-vectors.ndjson')

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
  rogueReads: number[]
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
  const rogueReads: number[] = []
  const rogueWrites: number[] = []
  const checkSpan = (addr: number, width: number, target: number[]): void => {
    for (let i = 0; i < width; i++) {
      const a = (addr + i) >>> 0
      if (!spans.some(s => a >= s.start && a < s.end)) {
        target.push(a)
      }
    }
  }
  const mem: Memory113c = {
    alloc: size => raw.alloc(size),
    u8: p => {
      checkSpan(p, 1, rogueReads)
      return raw.u8(p)
    },
    u16: p => {
      checkSpan(p, 2, rogueReads)
      return raw.u16(p)
    },
    u32: p => {
      checkSpan(p, 4, rogueReads)
      return raw.u32(p)
    },
    setU8: (p, v) => {
      checkSpan(p, 1, rogueWrites)
      raw.setU8(p, v)
    },
    setU16: (p, v) => {
      checkSpan(p, 2, rogueWrites)
      raw.setU16(p, v)
    },
    setU32: (p, v) => {
      checkSpan(p, 4, rogueWrites)
      raw.setU32(p, v)
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      checkSpan((base + f.off + idx * width) >>> 0, width, rogueReads)
      return raw.get(base, f, idx)
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      checkSpan((base + f.off + idx * width) >>> 0, width, rogueWrites)
      raw.set(base, f, v, idx)
    },
    fill: (p, len, v) => {
      checkSpan(p, len, rogueWrites)
      raw.fill(p, len, v)
    },
  }
  return { raw, mem, rogueReads, rogueWrites }
}

type B020Runner = (mem: Memory113c, args: number[]) => number

const B020_DISPATCH: Readonly<Record<string, B020Runner>> = {
  '0x6FD515E0': (mem, [nSkillId]) => DATATBLS_GetSkillsTxtParam4Inline113c(mem, nSkillId!),
  '0x6FD51610': (mem, [nSkillId]) => DATATBLS_GetSkillsTxtParam5Inline113c(mem, nSkillId!),
  '0x6FD51640': (mem, [nSkillId]) => DATATBLS_GetSkillsTxtParam6Inline113c(mem, nSkillId!),
  '0x6FD51670': (mem, [nSkillId, nLevel]) => DATATBLS_CalcSkillLinearParam12Inline113c(mem, nSkillId!, nLevel!),
  '0x6FD516B0': (mem, [nSkillId, nLevel]) => DATATBLS_CalcSkillLinearParam34Inline113c(mem, nSkillId!, nLevel!),
  '0x6FD516F0': (mem, [nSkillId, nLevel]) => DATATBLS_CalcSkillLinearParam56Inline113c(mem, nSkillId!, nLevel!),
  '0x6FD51730': (mem, [nSkillId, nLevel]) => DATATBLS_CalcSkillLinearParam78Inline113c(mem, nSkillId!, nLevel!),
  '0x6FD51770': (mem, [nStateId]) => DATATBLS_GetStatesTxtRecordInline113c(mem, nStateId!),
  '0x6FD517A0': (mem, [nStatId]) => DATATBLS_GetItemStatCostTxtRecordInline113c(mem, nStatId!),
  '0x6FD517D0': (mem, [nSetId]) => DATATBLS_GetSetsTxtRecordInline113c(mem, nSetId!),
  '0x6FD51800': (mem, [nSetItemId]) => DATATBLS_GetSetItemsTxtRecordInline113c(mem, nSetItemId!),
  '0x6FD51830': (mem, [nUniqueItemId]) => DATATBLS_GetUniqueItemsTxtRecordInline113c(mem, nUniqueItemId!),
  '0x6FD51860': (mem, [pUnit]) => MONSTERS_GetBaseIdFromMonsterUnitInline113c(mem, pUnit!),
  '0x6FD518A0': (mem, [nMonStatsId, nFlag]) => DATATBLS_CheckMonStatsFlagInline113c(mem, nMonStatsId!, nFlag!),
  '0x6FD518F0': (mem, [nSkillId]) => DATATBLS_HasValidSkillDescInline113c(mem, nSkillId!),
  '0x6FD51930': (mem, [nMonStatsId, nSteps]) => DATATBLS_WalkMonsterClassChainInline113c(mem, nMonStatsId!, nSteps!),
}

function verifyVector(rec: VectorRecord, overrideRet?: number): void {
  const runner = B020_DISPATCH[rec.va]
  if (!runner) throw new Error(`Missing B020 runner for ${rec.va}`)
  const { raw, mem, rogueReads, rogueWrites } = createGuardedMemory(rec.pre)
  const actualRet = overrideRet !== undefined ? overrideRet : runner(mem, rec.args)
  if (rogueReads.length > 0) {
    throw new Error(
      `${rec.va} ${rec.name} [${rec.caseId}] read outside pre.mem at 0x${rogueReads[0]!.toString(16)}`,
    )
  }
  if (rogueWrites.length > 0) {
    throw new Error(
      `${rec.va} ${rec.name} [${rec.caseId}] wrote outside pre.mem at 0x${rogueWrites[0]!.toString(16)}`,
    )
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

describe('Lane A B020 — Real D2Common.dll Differential Replay & Negative Controls (16 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord)

  it('loads all 16 B020 function VAs with >= 6 real-DLL vectors each (112 vectors total)', () => {
    expect(vectors.length).toBe(112)
    const expectedVas = Object.keys(B020_DISPATCH)
    expect(expectedVas.length).toBe(16)
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(6)
    }
  })

  for (const [va, runner] of Object.entries(B020_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte for ${va}`, () => {
      expect(runner).toBeTypeOf('function')
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length).toBeGreaterThanOrEqual(6)
      for (const rec of fnVectors) {
        verifyVector(rec)
      }
    })
  }

  it('negative control: mutating return value or accessing unmapped memory is caught for every B020 function', () => {
    for (const va of Object.keys(B020_DISPATCH)) {
      const rec = vectors.find(v => v.va === va)!
      expect(rec).toBeDefined()
      expect(() => verifyVector(rec, (rec.eax ^ 1) >>> 0)).toThrow(/eax mismatch/)
    }
    const sample = vectors[0]!
    const { mem, rogueReads, rogueWrites } = createGuardedMemory(sample.pre)
    expect(() => mem.u8(0x0badf00d)).toThrow(/read of unloaded byte/)
    expect(rogueReads.length).toBe(1)
    mem.setU8(0x0badf00e, 1)
    expect(rogueWrites.length).toBe(1)
  })
})
