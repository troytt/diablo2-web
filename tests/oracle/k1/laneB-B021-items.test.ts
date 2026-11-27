import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DATATBLS_FindCodeRecord4C113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckEtherealFlag113c,
  ITEMS_CountEquippedOrCarryItems113c,
  ITEMS_GetAutoAffix113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemSeed113c,
  ITEMS_GetMagicPrefix113c,
  ITEMS_GetMagicSuffix113c,
  ITEMS_GetOwnerGuid113c,
  ITEMS_GetRarePrefix113c,
  ITEMS_GetRareSuffix113c,
  ITEMS_HasSocketedItems113c,
  ITEMS_InitItemSeed113c,
  ITEMS_IsHighQualityItem113c,
  ITEMS_MaxIntFastcall113c,
  ITEMS_MinIntFastcall113c,
  ITEMS_SetAutoAffix113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetItemQuality113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b021-vectors.ndjson')

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

type B021Runner = (mem: Memory113c, args: number[]) => number

const B021_DISPATCH: Readonly<Record<string, B021Runner>> = {
  '0x6FD73900': (mem, [pItem, dwFlag, bSet]) => {
    ITEMS_SetOrClearCommandFlags113c(mem, pItem!, dwFlag!, bSet!)
    return 0
  },
  '0x6FD73940': (mem, [pItem, dwFlag, u3, u4]) =>
    ITEMS_CheckCommandFlags113c(mem, pItem!, dwFlag!, u3, u4),
  '0x6FD73990': (mem, [pItem]) => ITEMS_GetRareSuffix113c(mem, pItem!),
  '0x6FD739E0': (mem, [pItem]) => ITEMS_GetRarePrefix113c(mem, pItem!),
  '0x6FD73A40': (mem, [pItem, nIndex]) => ITEMS_GetMagicSuffix113c(mem, pItem!, nIndex!),
  '0x6FD73A70': (mem, [pItem, wAffix]) => {
    ITEMS_SetAutoAffix113c(mem, pItem!, wAffix!)
    return 0
  },
  '0x6FD73A90': (mem, [pItem]) => ITEMS_GetAutoAffix113c(mem, pItem!),
  '0x6FD73AF0': (mem, [pItem, nIndex]) => ITEMS_GetMagicPrefix113c(mem, pItem!, nIndex!),
  '0x6FD73B20': (mem, [pItem, nQuality]) => {
    ITEMS_SetItemQuality113c(mem, pItem!, nQuality!)
    return 0
  },
  '0x6FD73B40': (mem, [pItem]) => ITEMS_GetItemQuality113c(mem, pItem!),
  '0x6FD73BC0': (mem, [pItem]) => ITEMS_GetOwnerGuid113c(mem, pItem!),
  '0x6FD73BE0': (mem, [pItem]) => {
    ITEMS_InitItemSeed113c(mem, pItem!)
    return 0
  },
  '0x6FD73C10': (mem, [pItem]) => ITEMS_GetItemSeed113c(mem, pItem!),
  '0x6FD73C30': (mem, [pItem, nBodyLoc]) => {
    ITEMS_SetBodyLocation113c(mem, pItem!, nBodyLoc!)
    return 0
  },
  '0x6FD73D50': (mem, [a, b, s0, s1]) => ITEMS_MaxIntFastcall113c(mem, a!, b!, s0, s1),
  '0x6FD73D60': (mem, [a, b, s0, s1]) => ITEMS_MinIntFastcall113c(mem, a!, b!, s0, s1),
  '0x6FD73E00': (mem, [pItem]) => ITEMS_CheckEtherealFlag113c(mem, pItem!),
  '0x6FD73E30': (mem, [pUnit]) => ITEMS_CountEquippedOrCarryItems113c(mem, pUnit!),
  '0x6FD741A0': (mem, [pItem]) => ITEMS_HasSocketedItems113c(mem, pItem!),
  '0x6FD74210': (mem, [pItem]) => ITEMS_IsHighQualityItem113c(mem, pItem!),
  '0x6FDA3020': (mem, [dwCode]) => DATATBLS_FindCodeRecord4C113c(mem, dwCode!),
}

function verifyVector(rec: VectorRecord, overrideRet?: number, mutatePostAddr?: number): void {
  const runner = B021_DISPATCH[rec.va]
  if (!runner) throw new Error(`Missing B021 runner for ${rec.va}`)
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

describe('K1 Lane B — B021 D2Common Item Leaf Functions Real-DLL Differential Replay (21 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord)

  it('loads all 21 B021 function VAs with >= 5 real-DLL vectors each (114 total)', () => {
    expect(vectors.length).toBe(114)
    const expectedVas = Object.keys(B021_DISPATCH)
    expect(expectedVas.length).toBe(21)
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(5)
    }
  })

  for (const [va, runner] of Object.entries(B021_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte with StrictMem zero rogue writes for ${va}`, () => {
      expect(runner).toBeTypeOf('function')
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length).toBeGreaterThan(0)
      for (const rec of fnVectors) {
        verifyVector(rec)
      }
    })
  }

  it('negative control: mutating return value or post-memory state is caught for every B021 function', () => {
    for (const va of Object.keys(B021_DISPATCH)) {
      const rec = vectors.find(
        v =>
          v.va === va &&
          (v.retMask !== 0 || v.post.some((b, idx) => b.hex !== v.pre[idx]?.hex)),
      )!
      expect(rec).toBeDefined()
      if (rec.retMask !== 0) {
        expect(() => verifyVector(rec, (rec.eax ^ 1) >>> 0)).toThrow(/eax mismatch/)
      }
      const changedIdx = rec.post.findIndex((b, idx) => b.hex !== rec.pre[idx]?.hex)
      if (changedIdx >= 0) {
        const firstAddr = rec.post[changedIdx]!.addr >>> 0
        expect(() => verifyVector(rec, undefined, firstAddr)).toThrow(/post-memory mismatch/)
      }
    }
  })
})
