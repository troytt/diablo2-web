import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ITEMS_CheckItemTypeIdEquivalent113c,
  SKILLS_Calc5BandLinear113c,
  SKILLS_CalcDiminishingReturns113c,
  SKILLS_GetClassSkillCount113c,
  SKILLS_GetClassSkillId113c,
  SKILLS_GetFirstSkillFromSkillList113c,
  SKILLS_GetHighestLevelSkillFromUnitAndId113c,
  SKILLS_GetLeftSkillFromSkillList113c,
  SKILLS_GetNextSkill113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillSlotIndex113c,
  SKILLS_GetSkillsTxtFromSkill113c,
  SKILLS_SetSkillSlotIndex113c,
  STATES_CheckStateMaskOnUnitFast113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b003-vectors.json')

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

const B003_DISPATCH: Readonly<Record<string, (m: Memory113c, v: VectorCaseJson) => number | undefined>> = {
  '0x6FD72820': (m, v) => ITEMS_CheckItemTypeIdEquivalent113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD87DB0': (m, v) => STATES_CheckStateMaskOnUnitFast113c(m, v.regs.eax >>> 0, v.regs.ecx >>> 0) >>> 0,
  '0x6FD9DC30': (m, v) =>
    SKILLS_CalcDiminishingReturns113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0, v.stack[2]! >>> 0) >>> 0,
  '0x6FD9DDB0': (m, v) => SKILLS_Calc5BandLinear113c(m, v.regs.eax >>> 0, v.regs.ecx >>> 0) >>> 0,
  '0x6FD9E180': (m, v) => SKILLS_GetLeftSkillFromSkillList113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD9E1A0': (m, v) => {
    SKILLS_SetSkillSlotIndex113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0)
    return undefined
  },
  '0x6FD9E1C0': (m, v) => SKILLS_GetSkillsTxtFromSkill113c(m, v.regs.ecx >>> 0) >>> 0,
  '0x6FD9E1D0': (m, v) =>
    SKILLS_GetSkillIdFromSkill113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0, v.stack[2]! >>> 0) >>> 0,
  '0x6FD9E3B0': (m, v) => SKILLS_GetNextSkill113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD9E3D0': (m, v) => SKILLS_GetFirstSkillFromSkillList113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD9E460': (m, v) => SKILLS_GetSkillSlotIndex113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD9E480': (m, v) =>
    SKILLS_GetHighestLevelSkillFromUnitAndId113c(m, v.regs.eax >>> 0, v.regs.esi >>> 0) >>> 0,
  '0x6FD9E520': (m, v) => SKILLS_GetClassSkillCount113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD9E550': (m, v) => SKILLS_GetClassSkillId113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
}

function verifyVector(v: VectorCaseJson, mutateReturn = false, mutatePostByte = false): void {
  const fn = B003_DISPATCH[v.va]
  if (!fn) throw new Error(`Missing B003 dispatch for ${v.va}`)
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

describe('K1 Lane B — B003 D2Common Skills Real-DLL Differential Replay (14 functions)', () => {
  const fixture: VectorFileJson = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'))

  it('loads all 14 B003 function VAs with >= 4 real-DLL vectors each', () => {
    expect(fixture.batch).toBe('B003')
    expect(fixture.module).toBe('D2Common')
    const expectedVas = Object.keys(B003_DISPATCH)
    expect(expectedVas.length).toBe(14)
    for (const va of expectedVas) {
      const fnCases = fixture.cases.filter(c => c.va === va)
      expect(fnCases.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4)
    }
  })

  for (const va of Object.keys(B003_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte with zero rogue writes for ${va}`, () => {
      const fnCases = fixture.cases.filter(c => c.va === va)
      expect(fnCases.length).toBeGreaterThan(0)
      for (const c of fnCases) {
        verifyVector(c)
      }
    })
  }

  it('negative control: mutating return value or post-memory state is caught for every B003 function', () => {
    for (const va of Object.keys(B003_DISPATCH)) {
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
