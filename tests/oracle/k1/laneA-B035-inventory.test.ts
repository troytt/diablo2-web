import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COMPOSIT_GetItemPageLimitByBodyLoc113c,
  DATATBLS_GetInventoryTxtRecord113c,
  INVENTORY_AllocCorpse113c,
  INVENTORY_AllocInventory113c,
  INVENTORY_FreeAllNodes113c,
  INVENTORY_FreeCorpse113c,
  INVENTORY_GetItemSaveGridPageLimits113c,
  ITEMS_CanPlayerClassUseItem113c,
  ITEMS_CheckItemFlagCompactSaveByClassId113c,
  ITEMS_DecodeItemCompactBitstream113c,
  ITEMS_GetCellOverwrite113c,
  ITEMS_GetComponentFromItem113c,
  ITEMS_GetInvWidthFromId113c,
  ITEMS_GetWeaponClassCodeIdx113c,
  ITEMS_SetCellOverwrite113c,
  ITEMS_SetItemFormat113c,
  UNITS_GetBeltTypeFromItem113c,
  UNITS_GetInventoryRecordId113c,
  UNITS_SetStaticPathPosX113c,
  UNITS_SetStaticPathPosY113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'b035-vectors.ndjson')

interface VectorRecord {
  va: string
  name: string
  caseId: string
  args: number[]
  retMask: string
  pre: {
    mem: Record<string, string>
  }
  expectedAssert?: {
    line: number
  }
  post: {
    eax: number
    mem: Record<string, string>
  }
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

function createStrictMemory(
  preMem: Record<string, string>,
  postMem: Record<string, string>,
): {
  raw: SparseMemory113c
  mem: Memory113c
  rogueWrites: number[]
} {
  const raw = new SparseMemory113c()
  const writeSpans: Array<{ start: number; end: number }> = []
  for (const [addrStr, hex] of Object.entries(preMem)) {
    const start = parseInt(addrStr, 16) >>> 0
    const bytes = hexToBytes(hex)
    raw.loadBlock(start, bytes)
    writeSpans.push({ start, end: (start + bytes.length) >>> 0 })
  }
  for (const [addrStr, hex] of Object.entries(postMem)) {
    const start = parseInt(addrStr, 16) >>> 0
    const len = hex.length >>> 1
    writeSpans.push({ start, end: (start + len) >>> 0 })
  }
  const rogueWrites: number[] = []
  const checkWriteSpan = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const a = (addr + i) >>> 0
      if (!writeSpans.some(s => a >= s.start && a < s.end)) {
        rogueWrites.push(a)
      }
    }
  }
  const mem: Memory113c = {
    alloc: size => {
      const p = raw.alloc(size)
      writeSpans.push({ start: p, end: (p + size) >>> 0 })
      return p
    },
    u8: p => raw.u8(p),
    u16: p => raw.u16(p),
    u32: p => raw.u32(p),
    setU8: (p, v) => {
      checkWriteSpan(p, 1)
      raw.setU8(p, v)
    },
    setU16: (p, v) => {
      checkWriteSpan(p, 2)
      raw.setU16(p, v)
    },
    setU32: (p, v) => {
      checkWriteSpan(p, 4)
      raw.setU32(p, v)
    },
    get: (base, f, idx = 0) => raw.get(base, f, idx),
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      checkWriteSpan((base + f.off + idx * width) >>> 0, width)
      raw.set(base, f, v, idx)
    },
    fill: (p, len, v) => {
      checkWriteSpan(p, len)
      raw.fill(p, len, v)
    },
  }
  return { raw, mem, rogueWrites }
}

type B035Runner = (mem: Memory113c, args: number[]) => number

const B035_DISPATCH: Readonly<Record<string, B035Runner>> = {
  '0x6FD632A0': (mem, [nInvId, bHigherRes, pOutRecord]) => {
    DATATBLS_GetInventoryTxtRecord113c(mem, nInvId!, bHigherRes!, pOutRecord!)
    return 0
  },
  '0x6FD6DD40': (mem, [pInventory, dwUnitId, bCountAsCorpse]) =>
    INVENTORY_FreeCorpse113c(mem, pInventory!, dwUnitId!, bCountAsCorpse!),
  '0x6FD6DDD0': (mem, [pInventory, dwUnitId, eClass, bCountAsCorpse]) =>
    INVENTORY_AllocCorpse113c(mem, pInventory!, dwUnitId!, eClass!, bCountAsCorpse!),
  '0x6FD6DF20': (mem, [pInventory]) => {
    INVENTORY_FreeAllNodes113c(mem, pInventory!)
    return 0
  },
  '0x6FD6E420': (mem, [pItem, pOutPageLimits6]) => {
    INVENTORY_GetItemSaveGridPageLimits113c(mem, pItem!, pOutPageLimits6!)
    return 0
  },
  '0x6FD6E710': (mem, [pMemPool, pOwnerUnit]) =>
    INVENTORY_AllocInventory113c(mem, pMemPool!, pOwnerUnit!),
  '0x6FD72000': (mem, [pBitstreamData, nDataSize, bCheckHeader, pOutHeader, nVersion]) =>
    ITEMS_DecodeItemCompactBitstream113c(
      mem,
      pBitstreamData!,
      nDataSize!,
      bCheckHeader!,
      pOutHeader!,
      nVersion!,
    ),
  '0x6FD72170': (mem, [pItem, wFormat]) => {
    ITEMS_SetItemFormat113c(mem, pItem!, wFormat!)
    return 0
  },
  '0x6FD72310': (mem, [pPlayer, pItem]) =>
    ITEMS_CanPlayerClassUseItem113c(mem, pPlayer!, pItem!),
  '0x6FD72430': (mem, [pItem]) => ITEMS_GetWeaponClassCodeIdx113c(mem, pItem!),
  '0x6FD724C0': (mem, [pItem]) => ITEMS_GetCellOverwrite113c(mem, pItem!),
  '0x6FD72510': (mem, [pItem, nCell]) => {
    ITEMS_SetCellOverwrite113c(mem, pItem!, nCell!)
    return 0
  },
  '0x6FD72760': (mem, [nItemId]) => ITEMS_CheckItemFlagCompactSaveByClassId113c(mem, nItemId!),
  '0x6FD72E70': (mem, [nItemId]) => ITEMS_GetInvWidthFromId113c(mem, nItemId!),
  '0x6FD731E0': (mem, [pItem]) => ITEMS_GetComponentFromItem113c(mem, pItem!),
  '0x6FD7F270': (mem, [pUnit, nPosY]) => {
    UNITS_SetStaticPathPosY113c(mem, pUnit!, nPosY!)
    return 0
  },
  '0x6FD7F2C0': (mem, [pUnit, nPosX]) => {
    UNITS_SetStaticPathPosX113c(mem, pUnit!, nPosX!)
    return 0
  },
  '0x6FD7F8A0': (mem, [pItem]) => UNITS_GetBeltTypeFromItem113c(mem, pItem!),
  '0x6FD7FB60': (mem, [pUnit, nInvPage, bLoD]) =>
    UNITS_GetInventoryRecordId113c(mem, pUnit!, nInvPage!, bLoD!),
  '0x6FD93710': (mem, [nBodyLoc, pPageLimits6]) =>
    COMPOSIT_GetItemPageLimitByBodyLoc113c(mem, nBodyLoc!, pPageLimits6!),
}

function verifyVector(rec: VectorRecord, overrideRet?: number): void {
  const runner = B035_DISPATCH[rec.va]
  if (!runner) throw new Error(`Missing B035 runner for ${rec.va}`)
  const { raw, mem, rogueWrites } = createStrictMemory(rec.pre.mem, rec.post.mem)
  if (rec.expectedAssert !== undefined) {
    let caught: unknown = undefined
    try {
      runner(mem, rec.args)
    } catch (err) {
      caught = err
    }
    if (!(caught instanceof D2CommonAssertError) || caught.line !== rec.expectedAssert.line) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] expected assert at line ${rec.expectedAssert.line}, got ${String(caught)}`,
      )
    }
    expect(rogueWrites).toEqual([])
    return
  }

  const actualRet = overrideRet !== undefined ? overrideRet : runner(mem, rec.args)
  expect(rogueWrites).toEqual([])
  const mask = parseInt(rec.retMask, 16) >>> 0
  if (mask !== 0) {
    const got = ((actualRet >>> 0) & mask) >>> 0
    const exp = ((rec.post.eax >>> 0) & mask) >>> 0
    if (got !== exp) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] eax mismatch: got 0x${got.toString(16)}, expected 0x${exp.toString(16)}`,
      )
    }
  }
  for (const [addrStr, expHex] of Object.entries(rec.post.mem)) {
    const start = parseInt(addrStr, 16) >>> 0
    const len = expHex.length >>> 1
    const actualHex = bytesToHex(raw.readBytes(start, len))
    if (actualHex !== expHex) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] post-memory mismatch at ${addrStr}: got ${actualHex}, expected ${expHex}`,
      )
    }
  }
}

describe('Lane A B035 — Real D2Common.dll Differential Replay & StrictMem Verification (20 hostImport functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord)

  it('loads all 20 B035 function VAs with real-DLL vectors (120 vectors total)', () => {
    expect(vectors.length).toBe(120)
    const expectedVas = Object.keys(B035_DISPATCH)
    expect(expectedVas.length).toBe(20)
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(3)
    }
  })

  for (const [va, runner] of Object.entries(B035_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte with StrictMem for ${va}`, () => {
      expect(runner).toBeTypeOf('function')
      const fnVectors = vectors.filter(v => v.va === va)
      expect(fnVectors.length).toBeGreaterThanOrEqual(3)
      for (const rec of fnVectors) {
        verifyVector(rec)
      }
    })
  }

  it('negative control & mutation kill: mutating return value, post-memory, or accessing unmapped memory fails', () => {
    for (const va of Object.keys(B035_DISPATCH)) {
      const rec = vectors.find(v => v.va === va && v.expectedAssert === undefined)!
      expect(rec).toBeDefined()
      const mask = parseInt(rec.retMask, 16) >>> 0
      if (mask !== 0) {
        expect(() => verifyVector(rec, (rec.post.eax ^ 1) >>> 0)).toThrow(/eax mismatch/)
      }
      const postEntries = Object.entries(rec.post.mem)
      if (postEntries.length > 0) {
        const [firstAddr, firstHex] = postEntries[0]!
        const mutatedByte = ((parseInt(firstHex.slice(0, 2), 16) ^ 0xff) & 0xff)
          .toString(16)
          .padStart(2, '0')
        const mutatedRec: VectorRecord = {
          ...rec,
          post: {
            ...rec.post,
            mem: {
              ...rec.post.mem,
              [firstAddr]: mutatedByte + firstHex.slice(2),
            },
          },
        }
        expect(() => verifyVector(mutatedRec)).toThrow(/post-memory mismatch/)
      }
    }
    const sample = vectors.find(v => Object.keys(v.pre.mem).length > 0)!
    const { mem, rogueWrites } = createStrictMemory(sample.pre.mem, sample.post.mem)
    expect(() => mem.u8(0x0badf00d)).toThrow(/read of unloaded byte/)
    mem.setU8(0x0badf00e, 1)
    expect(rogueWrites.length).toBe(1)
  })
})
