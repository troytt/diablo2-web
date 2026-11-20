import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DATATBLS_GetMonSeqTableRecord113c,
  MISSILE_EvaluateElementalLength113c,
  SKILLS_CalcMaxCallback113c,
  SKILLS_CalcMinCallback113c,
  SKILLS_EvaluateManaCost256ths113c,
  SKILLS_GetBaseSkillLevelById113c,
  SKILLS_GetClassIdFromSkillId113c,
  SKILLS_GetPassiveState113c,
  SKILLS_GetReqLevel113c,
  SKILLS_GetRequiredLevelForNextRank113c,
  SKILLS_GetSkillById113c,
  SKILLS_MapPlayerAnimModeToMonsterMode113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b012-vectors.json')

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

const B012_DISPATCH: Readonly<Record<string, (m: Memory113c, v: VectorCaseJson) => number | undefined>> = {
  '0x6FD9E8C0': (m, v) => SKILLS_GetClassIdFromSkillId113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD9EA00': (m, v) => SKILLS_EvaluateManaCost256ths113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD9EB00': (m, v) => SKILLS_GetReqLevel113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD9F080': (m, v) => SKILLS_GetSkillById113c(m, v.regs.ecx >>> 0, v.regs.edx >>> 0, v.stack[0]! >>> 0) >>> 0,
  '0x6FD9F0C0': (m, v) =>
    SKILLS_CalcMaxCallback113c(m, v.regs.ecx >>> 0, v.regs.edx >>> 0, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD9F0D0': (m, v) =>
    SKILLS_CalcMinCallback113c(m, v.regs.ecx >>> 0, v.regs.edx >>> 0, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD9F0E0': (m, v) => SKILLS_GetPassiveState113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD9F4C0': (m, v) => SKILLS_GetBaseSkillLevelById113c(m, v.regs.eax >>> 0, v.regs.edx >>> 0) >>> 0,
  '0x6FD9F510': (m, v) => SKILLS_GetRequiredLevelForNextRank113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD9F780': (m, v) => SKILLS_MapPlayerAnimModeToMonsterMode113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FDA2E00': (m, v) => DATATBLS_GetMonSeqTableRecord113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FDB9DC0': (m, v) =>
    MISSILE_EvaluateElementalLength113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0, v.stack[2]! >>> 0, v.stack[3]! >>> 0) >>> 0,
  '0x6FDCF5E0': (m, v) =>
    UNITS_GetUnitDistanceToCoordinates113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0, v.stack[2]! >>> 0) >>> 0,
}

function verifyVector(v: VectorCaseJson, mutateReturn = false, mutatePostByte = false): void {
  const fn = B012_DISPATCH[v.va]
  if (!fn) throw new Error(`Missing B012 dispatch for ${v.va}`)
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

describe('K1 Lane B — B012 D2Common Skills, MonSeq, Missile & Unit Distance Leaf Functions Real-DLL Differential Replay (13 functions)', () => {
  const fixture: VectorFileJson = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'))

  it('loads all 13 B012 function VAs with >= 4 real-DLL vectors each', () => {
    expect(fixture.batch).toBe('B012')
    expect(fixture.module).toBe('D2Common')
    const expectedVas = Object.keys(B012_DISPATCH)
    expect(expectedVas.length).toBe(13)
    for (const va of expectedVas) {
      const fnCases = fixture.cases.filter(c => c.va === va)
      expect(fnCases.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4)
    }
  })

  for (const va of Object.keys(B012_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte with zero rogue writes for ${va}`, () => {
      const fnCases = fixture.cases.filter(c => c.va === va)
      expect(fnCases.length).toBeGreaterThan(0)
      for (const c of fnCases) {
        verifyVector(c)
      }
    })
  }

  it('negative control: mutating return value or post-memory state is caught for every B012 function', () => {
    for (const va of Object.keys(B012_DISPATCH)) {
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
