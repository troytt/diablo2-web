import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ITEMS_AccumulateItemLevelReq113c,
  ITEMS_CheckItemFlag113c,
  ITEMS_CheckQualityTradable113c,
  ITEMS_GetAutoAffixData113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetEarLevel113c,
  ITEMS_GetEarName113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetItemLevel113c,
  ITEMS_GetItemTypeNormal113c,
  ITEMS_GetItemTypeShoots113c,
  ITEMS_GetNodePage113c,
  ITEMS_PackColorIndex113c,
  ITEMS_ReturnZero113c,
  ITEMS_SetCmdFlagsByte113c,
  ITEMS_SetEarLevel113c,
  ITEMS_SetEarName113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetItemLevel113c,
  ITEMS_SetNodePage113c,
  ITEMS_SetVarGfxIndex113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b015-vectors.ndjson')

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

type B015Runner = (mem: Memory113c, args: number[]) => number

const B015_DISPATCH: Readonly<Record<string, B015Runner>> = {
  '0x6FD71F70': (mem, [nVal]) => ITEMS_CheckQualityTradable113c(mem, nVal!),
  '0x6FD71F90': (mem, [eax, ecx]) => ITEMS_PackColorIndex113c(mem, eax!, ecx!),
  '0x6FD71FF0': mem => ITEMS_ReturnZero113c(mem),
  '0x6FD72590': (mem, [pItem, pOut1C, pOut20]) => {
    ITEMS_GetAutoAffixData113c(mem, pItem!, pOut1C!, pOut20!)
    return 0
  },
  '0x6FD72F80': (mem, [nItemType]) => ITEMS_GetItemTypeNormal113c(mem, nItemType!),
  '0x6FD72FC0': (mem, [nCurrentReq, pItemsTxt, pUnit]) =>
    ITEMS_AccumulateItemLevelReq113c(mem, nCurrentReq!, pItemsTxt!, pUnit!),
  '0x6FD735D0': (mem, [nItemType]) => ITEMS_GetItemTypeShoots113c(mem, nItemType!),
  '0x6FD73650': (mem, [pItem, nIndex]) => {
    ITEMS_SetVarGfxIndex113c(mem, pItem!, nIndex!)
    return 0
  },
  '0x6FD73690': (mem, [pItem, nEarLevel]) => {
    ITEMS_SetEarLevel113c(mem, pItem!, nEarLevel!)
    return 0
  },
  '0x6FD736B0': (mem, [pItem]) => ITEMS_GetEarLevel113c(mem, pItem!),
  '0x6FD736D0': (mem, [pItem, szName]) => {
    ITEMS_SetEarName113c(mem, pItem!, szName!)
    return 0
  },
  '0x6FD73700': (mem, [pItem]) => ITEMS_GetEarName113c(mem, pItem!),
  '0x6FD73720': (mem, [pItem, nNodePage]) => {
    ITEMS_SetNodePage113c(mem, pItem!, nNodePage!)
    return 0
  },
  '0x6FD73740': (mem, [pItem]) => ITEMS_GetNodePage113c(mem, pItem!),
  '0x6FD73760': (mem, [pItem, nVal]) => {
    ITEMS_SetCmdFlagsByte113c(mem, pItem!, nVal!)
    return 0
  },
  '0x6FD737C0': (mem, [pItem]) => ITEMS_GetInvPage113c(mem, pItem!),
  '0x6FD737E0': (mem, [pItem, nItemLevel]) => {
    ITEMS_SetItemLevel113c(mem, pItem!, nItemLevel!)
    return 0
  },
  '0x6FD73810': (mem, [pItem]) => ITEMS_GetItemLevel113c(mem, pItem!),
  '0x6FD73870': (mem, [pItem, dwFlag, bSet]) => {
    ITEMS_SetItemFlag113c(mem, pItem!, dwFlag!, bSet!)
    return 0
  },
  '0x6FD738B0': (mem, [pItem, dwFlag]) => ITEMS_CheckItemFlag113c(mem, pItem!, dwFlag!),
  '0x6FD738E0': (mem, [pItem]) => ITEMS_GetCommandFlags113c(mem, pItem!),
}

function verifyVector(rec: VectorRecord, overrideRet?: number, mutatePostAddr?: number): void {
  const runner = B015_DISPATCH[rec.va]
  if (!runner) throw new Error(`Missing B015 runner for ${rec.va}`)
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

describe('K1 Lane B — B015 D2Common Item Leaf Functions Real-DLL Differential Replay (21 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord)

  it('loads all 21 B015 function VAs with >= 4 real-DLL vectors each', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(114)
    const expectedVas = Object.keys(B015_DISPATCH)
    expect(expectedVas.length).toBe(21)
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4)
    }
  })

  for (const [va, runner] of Object.entries(B015_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte with zero rogue writes for ${va}`, () => {
      expect(runner).toBeTypeOf('function')
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length).toBeGreaterThan(0)
      for (const rec of fnVectors) {
        verifyVector(rec)
      }
    })
  }

  it('negative control: mutating return value or post-memory state is caught for every B015 function', () => {
    for (const va of Object.keys(B015_DISPATCH)) {
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
