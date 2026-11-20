import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  UNITS_CheckStateMaskAura113c,
  UNITS_CheckStateMaskExp113c,
  UNITS_CheckStateMaskOnCurse113c,
  UNITS_ClearGfxStateFlags113c,
  UNITS_GetAnimOrSeqMode113c,
  UNITS_GetBaseAnimSpeed113c,
  UNITS_GetBaseWalkVelocity113c,
  UNITS_GetFrameAndFrameCount113c,
  UNITS_GetStateFlagsPtr113c,
  UNITS_GetWeaponSpeedAnimRate113c,
  UNITS_HasAnyGfxStateFlag113c,
  UNITS_IsGetHitModeForType113c,
  UNITS_IsRunModeForType113c,
  UNITS_IsShapeshifted113c,
  UNITS_IsWalkModeForType113c,
} from '../../../src/d2kern-113c/common/unit.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b026-vectors.ndjson')

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

function createGuardedMemory(pre: MemBlock[], post: MemBlock[]): {
  raw: SparseMemory113c
  mem: Memory113c
  rogueReads: number[]
  rogueWrites: number[]
} {
  const raw = new SparseMemory113c()
  const readSpans: Array<{ start: number; end: number }> = []
  const writeSpans: Array<{ start: number; end: number }> = []
  for (const blk of pre) {
    const start = blk.addr >>> 0
    const bytes = hexToBytes(blk.hex)
    raw.loadBlock(start, bytes)
    readSpans.push({ start, end: (start + bytes.length) >>> 0 })
    writeSpans.push({ start, end: (start + bytes.length) >>> 0 })
  }
  for (const blk of post) {
    const start = blk.addr >>> 0
    const len = blk.hex.length >>> 1
    writeSpans.push({ start, end: (start + len) >>> 0 })
  }
  const rogueReads: number[] = []
  const rogueWrites: number[] = []
  const checkSpan = (
    addr: number,
    width: number,
    spans: Array<{ start: number; end: number }>,
    target: number[],
  ): void => {
    for (let i = 0; i < width; i++) {
      const a = (addr + i) >>> 0
      if (!spans.some(s => a >= s.start && a < s.end)) {
        target.push(a)
      }
    }
  }
  const mem: Memory113c = {
    alloc: size => {
      const p = raw.alloc(size)
      readSpans.push({ start: p, end: (p + size) >>> 0 })
      writeSpans.push({ start: p, end: (p + size) >>> 0 })
      return p
    },
    u8: p => {
      checkSpan(p, 1, readSpans, rogueReads)
      return raw.u8(p)
    },
    u16: p => {
      checkSpan(p, 2, readSpans, rogueReads)
      return raw.u16(p)
    },
    u32: p => {
      checkSpan(p, 4, readSpans, rogueReads)
      return raw.u32(p)
    },
    setU8: (p, v) => {
      checkSpan(p, 1, writeSpans, rogueWrites)
      raw.setU8(p, v)
    },
    setU16: (p, v) => {
      checkSpan(p, 2, writeSpans, rogueWrites)
      raw.setU16(p, v)
    },
    setU32: (p, v) => {
      checkSpan(p, 4, writeSpans, rogueWrites)
      raw.setU32(p, v)
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      checkSpan((base + f.off + idx * width) >>> 0, width, readSpans, rogueReads)
      return raw.get(base, f, idx)
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      checkSpan((base + f.off + idx * width) >>> 0, width, writeSpans, rogueWrites)
      raw.set(base, f, v, idx)
    },
    fill: (p, len, v) => {
      checkSpan(p, len, writeSpans, rogueWrites)
      raw.fill(p, len, v)
    },
  }
  return { raw, mem, rogueReads, rogueWrites }
}

type B026Runner = (mem: Memory113c, args: number[]) => number

const B026_DISPATCH: Readonly<Record<string, B026Runner>> = {
  '0x6FD7EE60': (mem, [pUnit, pFrame, pFrameCount]) => {
    UNITS_GetFrameAndFrameCount113c(mem, pUnit!, pFrame!, pFrameCount!)
    return 0
  },
  '0x6FD7EF90': (mem, [nUnitType, nMode]) => UNITS_IsWalkModeForType113c(mem, nUnitType!, nMode!),
  '0x6FD7EFC0': (mem, [nUnitType, nMode]) => UNITS_IsGetHitModeForType113c(mem, nUnitType!, nMode!),
  '0x6FD7F010': (mem, [nUnitType, nMode]) => UNITS_IsRunModeForType113c(mem, nUnitType!, nMode!),
  '0x6FD7F1B0': (mem, [pUnit]) => UNITS_GetAnimOrSeqMode113c(mem, pUnit!),
  '0x6FD7FAC0': (mem, [nUnitType, nWeapClass, nClassId]) =>
    UNITS_GetWeaponSpeedAnimRate113c(mem, nUnitType!, nWeapClass!, nClassId!),
  '0x6FD7FB10': (mem, [nUnitType, nClassId, nAnimMode]) =>
    UNITS_GetBaseAnimSpeed113c(mem, nUnitType!, nClassId!, nAnimMode!),
  '0x6FD80D50': (mem, [nUnitType, nClassId]) =>
    UNITS_GetBaseWalkVelocity113c(mem, nUnitType!, nClassId!),
  '0x6FD83A70': (mem, [nState]) => UNITS_CheckStateMaskOnCurse113c(mem, nState!),
  '0x6FD83B00': (mem, [nState]) => UNITS_CheckStateMaskExp113c(mem, nState!),
  '0x6FD83B40': (mem, [nState]) => UNITS_CheckStateMaskAura113c(mem, nState!),
  '0x6FD83B80': (mem, [pUnit]) => UNITS_IsShapeshifted113c(mem, pUnit!),
  '0x6FD83CA0': (mem, [pUnit]) => UNITS_GetStateFlagsPtr113c(mem, pUnit!),
  '0x6FD84330': (mem, [pUnit]) => UNITS_HasAnyGfxStateFlag113c(mem, pUnit!),
  '0x6FD84390': (mem, [pUnit]) => {
    UNITS_ClearGfxStateFlags113c(mem, pUnit!)
    return 0
  },
}

function verifyVector(rec: VectorRecord, overrideRet?: number): void {
  const runner = B026_DISPATCH[rec.va]
  if (!runner) throw new Error(`Missing B026 runner for ${rec.va}`)
  const { raw, mem, rogueReads, rogueWrites } = createGuardedMemory(rec.pre, rec.post)
  const actualRet = overrideRet !== undefined ? overrideRet : runner(mem, rec.args)
  if (rogueReads.length > 0) {
    throw new Error(
      `${rec.va} ${rec.name} [${rec.caseId}] read outside pre.mem at 0x${rogueReads[0]!.toString(16)}`,
    )
  }
  if (rogueWrites.length > 0) {
    throw new Error(
      `${rec.va} ${rec.name} [${rec.caseId}] wrote outside allowed memory at 0x${rogueWrites[0]!.toString(16)}`,
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

describe('Lane A B026 — Real D2Common.dll Differential Replay & Negative Controls (15 functions in unit.ts)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord)

  it('loads all 15 B026 function VAs with >= 3 real-DLL vectors each (78 vectors total)', () => {
    expect(vectors.length).toBe(78)
    const expectedVas = Object.keys(B026_DISPATCH)
    expect(expectedVas.length).toBe(15)
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(3)
    }
  })

  for (const [va, runner] of Object.entries(B026_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte for ${va}`, () => {
      expect(runner).toBeTypeOf('function')
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length).toBeGreaterThanOrEqual(3)
      for (const rec of fnVectors) {
        verifyVector(rec)
      }
    })
  }

  it('negative control: mutating return value or accessing unmapped memory is caught for B026 functions', () => {
    for (const va of Object.keys(B026_DISPATCH)) {
      const rec = vectors.find(v => v.va === va)!
      expect(rec).toBeDefined()
      if ((rec.retMask >>> 0) !== 0) {
        expect(() => verifyVector(rec, (rec.eax ^ 1) >>> 0)).toThrow(/eax mismatch/)
      }
    }
    const sample = vectors[0]!
    const { mem, rogueReads, rogueWrites } = createGuardedMemory(sample.pre, sample.post)
    expect(() => mem.u8(0x0badf00d)).toThrow(/read of unloaded byte/)
    expect(rogueReads.length).toBe(1)
    mem.setU8(0x0badf00e, 1)
    expect(rogueWrites.length).toBe(1)
  })
})
