import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import {
  ANIMSEQ_EvaluateSequenceFrame113c,
  ANIMSEQ_GetEventAtFrame113c,
  COMPOSIT_GetWeaponClassIdFromCode113c,
  UNITS_GetStashGoldLimit113c,
  UNITS_HasObjectSubClassBit0113c,
} from '../../../src/d2kern-113c/common/composit.ts'
import { MONSTERS_IsTownOrFriendlyUnit113c } from '../../../src/d2kern-113c/common/monsters.ts'
import {
  DRLG_SetWarpId113c,
  HIRELING_GetExpForLevel113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  CHAT_CopyHoverMsg113c,
  CHAT_GetTimeoutFromHoverMsg113c,
  DRLGVER_SnapAndOffsetVertex113c,
} from '../../../src/d2kern-113c/common/text.ts'
import {
  UNITS_SetAnimSpeed113c,
  WAYPOINT_GetWaypointNoFromLevelId113c,
} from '../../../src/d2kern-113c/common/waypoint.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { SEED_InitLowSeed113c, SEED_InitSeed113c } from '../../../src/d2kern-113c/prng.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b011-vectors.json')

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
 * Dispatch map for all 15 leaf functions in B011 (`0x6FD68220..0x6FDB7E50`).
 */
const B011_LEAF_DISPATCH: Record<string, (m: Memory113c, v: VectorCaseJson) => number | undefined> = {
  '0x6FD68220': (m, v) => {
    CHAT_CopyHoverMsg113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0)
    return undefined
  },
  '0x6FD68240': (m, v) => CHAT_GetTimeoutFromHoverMsg113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD6A660': (m, v) => MONSTERS_IsTownOrFriendlyUnit113c(m, v.regs.edx >>> 0) >>> 0,
  '0x6FD7C990': (_m, v) => HIRELING_GetExpForLevel113c(v.stack[0]! | 0, v.stack[1]! | 0) >>> 0,
  '0x6FD7D210': (m, v) => {
    DRLG_SetWarpId113c(
      m,
      v.regs.eax >>> 0,
      v.regs.edx >>> 0,
      v.regs.ecx | 0,
      v.stack[0]! >>> 0,
    )
    return undefined
  },
  '0x6FD7E6B0': (m, v) => {
    ANIMSEQ_GetEventAtFrame113c(m, v.stack[0]! >>> 0, v.stack[1]! | 0, v.stack[2]! >>> 0)
    return undefined
  },
  '0x6FD7E6E0': (m, v) => {
    ANIMSEQ_EvaluateSequenceFrame113c(
      m,
      v.stack[0]! >>> 0,
      v.stack[1]! | 0,
      v.stack[2]! | 0,
      v.stack[3]! >>> 0,
      v.stack[4]! >>> 0,
      v.stack[5]! >>> 0,
      v.stack[6]! >>> 0,
    )
    return undefined
  },
  '0x6FD7E9C0': (_m, v) => UNITS_GetStashGoldLimit113c(v.stack[0]! >>> 0) >>> 0,
  '0x6FD7ED30': (m, v) => UNITS_HasObjectSubClassBit0113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD80B40': (m, v) => {
    UNITS_SetAnimSpeed113c(m, v.stack[0]! >>> 0, v.stack[1]! | 0)
    return undefined
  },
  '0x6FD86740': (m, v) => {
    SEED_InitLowSeed113c(m, v.regs.ecx >>> 0, v.regs.edx >>> 0)
    return undefined
  },
  '0x6FD86750': (m, v) => {
    SEED_InitSeed113c(m, v.regs.ecx >>> 0)
    return undefined
  },
  '0x6FD8D4A0': (m, v) => {
    DRLGVER_SnapAndOffsetVertex113c(m, v.regs.ecx >>> 0, v.regs.edx >>> 0, v.regs.esi >>> 0)
    return undefined
  },
  '0x6FD937F0': (m, v) => COMPOSIT_GetWeaponClassIdFromCode113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FDB7E50': (m, v) =>
    WAYPOINT_GetWaypointNoFromLevelId113c(m, v.stack[0]! | 0, v.stack[1]! >>> 0) >>> 0,
}

function replayVector(
  v: VectorCaseJson,
  mutateReturn = false,
  mutatePostByte = false,
  injectRogueWrite = false,
): { ok: boolean; reason?: string; outEax: number } {
  const fn = B011_LEAF_DISPATCH[v.va]
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

describe('K1 Lane A — B011 Unit-State & DRLG Leaves Real-DLL Differential Replay', () => {
  const fixture: VectorFileJson = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'))

  it('covers all 15 B011 leaf VAs with real-DLL vectors, zero rogue writes, and 1:1 return/memory parity', () => {
    const expectedVas = Object.keys(B011_LEAF_DISPATCH)
    expect(expectedVas.length).toBe(15)

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

  it('handles defensive NULL-pointer and boundary guards cleanly', () => {
    const m = new SparseMemory113c()
    expect(MONSTERS_IsTownOrFriendlyUnit113c(m, 0)).toBe(0)
    const pNonObjUnit = 0x501000
    m.setU32(pNonObjUnit, 1) // dwUnitType = 1 (UNIT_MONSTER != UNIT_OBJECT)
    expect(UNITS_HasObjectSubClassBit0113c(m, pNonObjUnit)).toBe(0)
    expect(UNITS_GetStashGoldLimit113c(0)).toBe(2500000)
    expect(HIRELING_GetExpForLevel113c(10, 100)).toBe(110000)
    const dt = 0x503000
    m.setU32(0x6fde9e1c, dt)
    m.setU32(dt + 0xc5c, 136) // nLevelsTxtRecordCount
    expect(WAYPOINT_GetWaypointNoFromLevelId113c(m, 0, 0x502000)).toBe(0)
  })

  it('enforces negative controls: mutated return value, mutated post-memory byte, or rogue write fails', () => {
    const retVec = fixture.cases.find(
      v => v.va === '0x6FD6A660' && v.caseId === 'monstats_bflags1_bit0_set',
    )!
    expect(retVec).toBeDefined()
    expect(replayVector(retVec, false, false, false).ok).toBe(true)
    const mutatedRet = replayVector(retVec, true, false, false)
    expect(mutatedRet.ok).toBe(false)
    expect(mutatedRet.reason).toContain('eax mismatch')

    const memVec = fixture.cases.find(
      v => v.va === '0x6FD86750' && v.caseId === 'from_arbitrary',
    )!
    expect(memVec).toBeDefined()
    expect(replayVector(memVec, false, false, false).ok).toBe(true)
    const mutatedMem = replayVector(memVec, false, true, false)
    expect(mutatedMem.ok).toBe(false)
    expect(mutatedMem.reason).toContain('postBlock mismatch')

    const rogueRes = replayVector(memVec, false, false, true)
    expect(rogueRes.ok).toBe(false)
    expect(rogueRes.reason).toContain('rogue writes outside preBlocks')
  })
})
