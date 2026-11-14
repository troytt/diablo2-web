import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MISSILE_GetActivateFrame113c,
  MISSILE_GetActivateFrameFromUnit113c,
  MISSILE_GetClassId113c,
  MISSILE_GetElapsedFrames113c,
  MISSILE_GetHitShiftFromId113c,
  MISSILE_GetLevel113c,
  MISSILE_GetRemainingFrames113c,
  MISSILE_GetSkill113c,
  MISSILE_GetStreamFlags113c,
  MISSILE_GetTargetX113c,
  MISSILE_GetTargetY113c,
  MISSILE_GetTotalFrames113c,
  MISSILE_IsOwnedByUnit113c,
  MISSILE_ScaleDamageDataBy128thsInline113c,
  MISSILE_SetActivateFrame113c,
  MISSILE_SetLevel113c,
  MISSILE_SetOwner113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetSkill113c,
  MISSILE_SetStreamFlags113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MISSILE_SetTotalFrames113c,
  MONSTERS_GetHirelingTypeId113c,
} from '../../../src/d2kern-113c/common/missile.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b023-vectors.ndjson')

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

type B023Runner = (mem: Memory113c, args: number[]) => number

const B023_DISPATCH: Readonly<Record<string, B023Runner>> = {
  '0x6FD6A2D0': (mem, [pUnit]) => MONSTERS_GetHirelingTypeId113c(mem, pUnit!),
  '0x6FDB9C60': (mem, [pDmgData, nScale128]) => {
    MISSILE_ScaleDamageDataBy128thsInline113c(mem, pDmgData!, nScale128!)
    return 0
  },
  '0x6FDB9E70': (mem, [nMissileId]) => MISSILE_GetHitShiftFromId113c(mem, nMissileId!),
  '0x6FDB9F50': (mem, [pMissile]) => MISSILE_GetTargetY113c(mem, pMissile!),
  '0x6FDB9F70': (mem, [pMissile, nTargetY]) => {
    MISSILE_SetTargetY113c(mem, pMissile!, nTargetY!)
    return 0
  },
  '0x6FDB9F90': (mem, [pMissile]) => MISSILE_GetTargetX113c(mem, pMissile!),
  '0x6FDB9FB0': (mem, [pMissile, nTargetX]) => {
    MISSILE_SetTargetX113c(mem, pMissile!, nTargetX!)
    return 0
  },
  '0x6FDBA030': (mem, [pMissile]) => MISSILE_GetActivateFrame113c(mem, pMissile!),
  '0x6FDBA050': (mem, [pMissile]) => MISSILE_GetActivateFrameFromUnit113c(mem, pMissile!),
  '0x6FDBA130': (mem, [pMissile, pOwner]) => MISSILE_IsOwnedByUnit113c(mem, pMissile!, pOwner!),
  '0x6FDBA1B0': (mem, [pMissile, pOwner]) => {
    MISSILE_SetOwner113c(mem, pMissile!, pOwner!)
    return 0
  },
  '0x6FDBA220': (mem, [pMissile]) => MISSILE_GetClassId113c(mem, pMissile!),
  '0x6FDBA240': (mem, [pMissile]) => MISSILE_GetElapsedFrames113c(mem, pMissile!),
  '0x6FDBA270': (mem, [pMissile]) => MISSILE_GetRemainingFrames113c(mem, pMissile!),
  '0x6FDBA290': (mem, [pMissile]) => MISSILE_GetTotalFrames113c(mem, pMissile!),
  '0x6FDBA2B0': (mem, [pMissile]) => MISSILE_GetSkill113c(mem, pMissile!),
  '0x6FDBA2D0': (mem, [pMissile]) => MISSILE_GetLevel113c(mem, pMissile!),
  '0x6FDBA2F0': (mem, [pMissile, nLevel]) => {
    MISSILE_SetLevel113c(mem, pMissile!, nLevel!)
    return 0
  },
  '0x6FDBA310': (mem, [pMissile, dwStreamFlags]) => {
    MISSILE_SetStreamFlags113c(mem, pMissile!, dwStreamFlags!)
    return 0
  },
  '0x6FDBA330': (mem, [pMissile]) => MISSILE_GetStreamFlags113c(mem, pMissile!),
  '0x6FDBA690': (mem, [pMissile, nActivateFrame]) => {
    MISSILE_SetActivateFrame113c(mem, pMissile!, nActivateFrame!)
    return 0
  },
  '0x6FDBA6D0': (mem, [pMissile, nRemainingFrames]) => {
    MISSILE_SetRemainingFrames113c(mem, pMissile!, nRemainingFrames!)
    return 0
  },
  '0x6FDBA710': (mem, [pMissile, nTotalFrames]) => {
    MISSILE_SetTotalFrames113c(mem, pMissile!, nTotalFrames!)
    return 0
  },
  '0x6FDBA750': (mem, [pMissile, nSkill]) => {
    MISSILE_SetSkill113c(mem, pMissile!, nSkill!)
    return 0
  },
}

function verifyVector(rec: VectorRecord, overrideRet?: number, mutatePostAddr?: number): void {
  const runner = B023_DISPATCH[rec.va]
  if (!runner) throw new Error(`Missing B023 runner for ${rec.va}`)
  const { raw, mem, rogueReads, rogueWrites } = createGuardedMemory(rec.pre)
  const actualRet = overrideRet !== undefined ? overrideRet : runner(mem, rec.args)
  if (mutatePostAddr !== undefined) {
    raw.setU8(mutatePostAddr, raw.u8(mutatePostAddr) ^ 0xff)
  }
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

describe('Lane A B023 — Real D2Common.dll Differential Replay & Negative Controls (24 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord)

  it('loads all 24 B023 function VAs with >= 5 real-DLL vectors each (146 vectors total)', () => {
    expect(vectors.length).toBe(146)
    const expectedVas = Object.keys(B023_DISPATCH)
    expect(expectedVas.length).toBe(24)
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(5)
    }
  })

  for (const [va, runner] of Object.entries(B023_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte for ${va}`, () => {
      expect(runner).toBeTypeOf('function')
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length).toBeGreaterThanOrEqual(5)
      for (const rec of fnVectors) {
        verifyVector(rec)
      }
    })
  }

  it('negative control: mutating return value, post-memory bytes, or unmapped memory access is caught for every B023 function', () => {
    for (const va of Object.keys(B023_DISPATCH)) {
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
