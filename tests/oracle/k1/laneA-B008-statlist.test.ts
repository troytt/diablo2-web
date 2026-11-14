import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import {
  ITEMS_SetMagicPrefix113c,
  ITEMS_SetMagicSuffix113c,
  ITEMS_SetRarePrefix113c,
  ITEMS_SetRareSuffix113c,
  STATES_CheckStateMaskExpOnUnit113c,
  STATLIST_CheckUnitStatListFlag100113c,
  STATLIST_GetOwnerAndDynamicFlag113c,
  STATLIST_GetSkillId113c,
  STATLIST_GetSkillLevel113c,
  STATLIST_GetStatListFromFlag113c,
  STATLIST_GetStatListFromUnitStateAndFlag113c,
  STATLIST_SetSkillId113c,
  STATLIST_SetSkillLevel113c,
  STATLIST_SetStatRemoveProc113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b008-vectors.json')

interface MemBlockJson {
  addr: string
  hex: string
}

interface VectorCaseJson {
  va: string
  name: string
  caseId: string
  compareMode: 'eax' | 'al' | 'void'
  regs: { eax: number; ecx: number; edx: number; esi: number; edi: number }
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
  const out = new Uint8Array(hex.length / 2)
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

/**
 * Dispatch map for all 14 leaf functions in B008 (`0x6FD73970..0x6FD87F40`).
 */
const B008_LEAF_DISPATCH: Record<string, (m: Memory113c, v: VectorCaseJson) => number | undefined> = {
  '0x6FD73970': (m, v) => {
    ITEMS_SetRareSuffix113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0)
    return undefined
  },
  '0x6FD739C0': (m, v) => {
    ITEMS_SetRarePrefix113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0)
    return undefined
  },
  '0x6FD73A10': (m, v) => {
    ITEMS_SetMagicSuffix113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0, v.stack[2]! | 0)
    return undefined
  },
  '0x6FD73AC0': (m, v) => {
    ITEMS_SetMagicPrefix113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0, v.stack[2]! | 0)
    return undefined
  },
  '0x6FD83AB0': (m, v) =>
    STATES_CheckStateMaskExpOnUnit113c(m, v.stack[0]! >>> 0, v.stack[1]! | 0) >>> 0,
  '0x6FD87D30': (m, v) => STATLIST_GetSkillLevel113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD87D40': (m, v) => {
    STATLIST_SetSkillLevel113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0)
    return undefined
  },
  '0x6FD87D50': (m, v) => STATLIST_GetSkillId113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD87D60': (m, v) => {
    STATLIST_SetSkillId113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0)
    return undefined
  },
  '0x6FD87D70': (m, v) => {
    STATLIST_SetStatRemoveProc113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0)
    return undefined
  },
  '0x6FD87DE0': (m, v) => STATLIST_CheckUnitStatListFlag100113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD87E70': (m, v) =>
    STATLIST_GetOwnerAndDynamicFlag113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD87EC0': (m, v) =>
    STATLIST_GetStatListFromUnitStateAndFlag113c(
      m,
      v.stack[0]! >>> 0,
      v.stack[1]! >>> 0,
      v.stack[2]! >>> 0,
    ) >>> 0,
  '0x6FD87F40': (m, v) =>
    STATLIST_GetStatListFromFlag113c(m, v.regs.eax >>> 0, v.regs.ecx >>> 0) >>> 0,
}

function replayVector(
  v: VectorCaseJson,
  mutateReturn = false,
  mutatePostByte = false,
  injectRogueWrite = false,
): { ok: boolean; reason?: string; outEax: number } {
  const fn = B008_LEAF_DISPATCH[v.va]
  if (!fn) {
    return { ok: false, reason: `Missing dispatch handler for ${v.va}`, outEax: 0 }
  }
  const { raw, mem, rogueWrites } = createGuardedMemory(v.preBlocks)
  let ret = fn(mem, v)
  if (injectRogueWrite) {
    mem.setU8(0x0dead000, 0x99)
  }
  if (rogueWrites.length > 0) {
    return {
      ok: false,
      reason: `${v.va} ${v.caseId}: rogue writes outside preBlocks @ 0x${rogueWrites[0]!.toString(16)}`,
      outEax: 0,
    }
  }
  if (mutateReturn && ret !== undefined) {
    ret = (ret ^ 1) >>> 0
  }
  if (mutatePostByte && v.postBlocks.length > 0) {
    const firstAddr = u32(v.postBlocks[0]!.addr)
    raw.setU8(firstAddr, raw.u8(firstAddr) ^ 0xff)
  }

  let actualOut = 0
  if (v.compareMode === 'eax' || v.compareMode === 'al') {
    const expected = v.compareMode === 'al' ? (v.outEax & 0xff) >>> 0 : v.outEax >>> 0
    actualOut = v.compareMode === 'al' ? (ret ?? 0) & 0xff : (ret ?? 0) >>> 0
    if (actualOut !== expected) {
      return {
        ok: false,
        reason: `${v.va} ${v.caseId}: ${v.compareMode} mismatch got=0x${actualOut.toString(16)} expected=0x${expected.toString(16)}`,
        outEax: actualOut,
      }
    }
  }

  for (const blk of v.postBlocks) {
    const addr = u32(blk.addr)
    const expectedBytes = hexToBytes(blk.hex)
    const actualBytes = raw.readBytes(addr, expectedBytes.length)
    const actualHex = bytesToHex(actualBytes)
    if (actualHex !== blk.hex) {
      return {
        ok: false,
        reason: `${v.va} ${v.caseId} @ ${blk.addr}: postBlock mismatch got=${actualHex} expected=${blk.hex}`,
        outEax: actualOut,
      }
    }
  }

  return { ok: true, outEax: actualOut }
}

describe('K1 Lane A — B008 StatList & Item Affix Leaves Real-DLL Differential Replay', () => {
  const fixture: VectorFileJson = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'))

  it('covers all 14 B008 leaf VAs with real-DLL vectors, zero rogue writes, and 1:1 return/memory parity', () => {
    const expectedVas = Object.keys(B008_LEAF_DISPATCH)
    expect(expectedVas.length).toBe(14)

    const seenVas = new Set<string>()
    for (const v of fixture.cases) {
      seenVas.add(v.va)
      const res = replayVector(v)
      expect(res.ok, res.reason).toBe(true)
    }

    for (const va of expectedVas) {
      expect(seenVas.has(va), `Missing vectors for ${va}`).toBe(true)
    }
  })

  it('handles defensive NULL-pointer guards and pUnit->pStatListEx == 0 cleanly', () => {
    const m = new SparseMemory113c()
    STATLIST_SetStatRemoveProc113c(m, 0, 0x12345678)
    expect(STATLIST_GetStatListFromFlag113c(m, 0, 0x40)).toBe(0)

    const pUnit = 0x501000
    m.setU32(pUnit + 0x5c, 0) // pStatListEx = NULL
    expect(STATLIST_CheckUnitStatListFlag100113c(m, pUnit)).toBe(0)
    expect(STATLIST_GetStatListFromUnitStateAndFlag113c(m, pUnit, 5, 0)).toBe(0)
  })

  it('enforces negative controls: mutated return value, mutated post-memory byte, or rogue write fails', () => {
    const stateVec = fixture.cases.find(
      v => v.va === '0x6FD83AB0' && v.caseId === 'player_state31_highbit',
    )!
    expect(stateVec).toBeDefined()
    expect(replayVector(stateVec, false, false, false).ok).toBe(true)
    const mutatedRet = replayVector(stateVec, true, false, false)
    expect(mutatedRet.ok).toBe(false)
    expect(mutatedRet.reason).toContain('eax mismatch')

    const rareVec = fixture.cases.find(
      v => v.va === '0x6FD73970' && v.caseId === 'valid_0x5678_trunc',
    )!
    expect(rareVec).toBeDefined()
    expect(replayVector(rareVec, false, false, false).ok).toBe(true)
    const mutatedMem = replayVector(rareVec, false, true, false)
    expect(mutatedMem.ok).toBe(false)
    expect(mutatedMem.reason).toContain('postBlock mismatch')

    const rogueRes = replayVector(rareVec, false, false, true)
    expect(rogueRes.ok).toBe(false)
    expect(rogueRes.reason).toContain('rogue writes outside preBlocks')
  })
})
