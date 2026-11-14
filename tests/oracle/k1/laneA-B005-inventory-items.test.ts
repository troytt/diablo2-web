import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import {
  INVENTORY_GetItemExtraData113c,
  INVENTORY_GetItemIfOwnedByInventory113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_IsGridRectEmpty113c,
  INVENTORY_IsItemOwnedByInventory113c,
  INVENTORY_LinkItemToGridList113c,
  INVENTORY_LinkItemToInventoryList113c,
  INVENTORY_UnitIsItem113c,
  INVENTORY_UnlinkItemFromList113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  ITEMS_ApplyClassLifePotionScale113c,
  ITEMS_ApplyClassManaPotionScale113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_NoOpReturnZero113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetOrClearFlagMask113c,
  ITEMS_TestFlagMask113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'laneA')

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

interface D2TVRecord {
  va: number
  caseIdx: number
  outEax: number
  postHash: number
}

function parseD2tv(buf: Buffer): { fnName: string; count: number; records: D2TVRecord[] } {
  expect(buf.subarray(0, 4).toString('ascii')).toBe('D2TV')
  expect(buf.readUInt16LE(4)).toBe(1)
  const fnName = buf.subarray(8, 16).toString('ascii').replace(/\0+$/, '')
  const recSize = buf.readUInt32LE(16)
  expect(recSize).toBe(16)
  const count = buf.readUInt32LE(20)
  const records: D2TVRecord[] = []
  for (let i = 0; i < count; i++) {
    const off = 32 + i * 16
    records.push({
      va: buf.readUInt32LE(off),
      caseIdx: buf.readUInt32LE(off + 4),
      outEax: buf.readUInt32LE(off + 8),
      postHash: buf.readUInt32LE(off + 12),
    })
  }
  return { fnName, count, records }
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

function fnv1aUpdate(h: number, data: Uint8Array): number {
  let hash = h >>> 0
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i]!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
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
 * Dispatch map for all 17 leaf functions in B005 (`0x6FD6E360..0x6FD73C50`, excluding `0x6FD6E920` which has its own suite).
 */
const B005_LEAF_DISPATCH: Record<string, (m: Memory113c, v: VectorCaseJson) => number | undefined> = {
  '0x6FD6E360': (m, v) =>
    INVENTORY_IsGridRectEmpty113c(
      m,
      v.regs.eax >>> 0,
      v.regs.ecx >>> 0,
      v.regs.edx >>> 0,
      v.stack[0]! >>> 0,
      v.stack[1]! >>> 0,
    ) >>> 0,
  '0x6FD6E400': (m, v) => INVENTORY_UnitIsItem113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD6E790': (m, v) => INVENTORY_GetItemExtraData113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD6E880': (m, v) =>
    INVENTORY_GetItemIfOwnedByInventory113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD6E8C0': (m, v) => INVENTORY_GetItemNodePositionOther113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD6E8F0': (m, v) => INVENTORY_GetNextItem113c(m, v.stack[0]! >>> 0) >>> 0,
  '0x6FD6F630': (m, v) => {
    INVENTORY_LinkItemToGridList113c(m, v.regs.ecx >>> 0, v.regs.esi >>> 0, v.stack[0]! >>> 0)
    return undefined
  },
  '0x6FD6F690': (m, v) => {
    INVENTORY_LinkItemToInventoryList113c(m, v.regs.ecx >>> 0, v.regs.esi >>> 0)
    return undefined
  },
  '0x6FD6F6E0': (m, v) =>
    INVENTORY_IsItemOwnedByInventory113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD6F8F0': (m, v) => {
    INVENTORY_UnlinkItemFromList113c(m, v.regs.edx >>> 0, v.regs.esi >>> 0)
    return undefined
  },
  '0x6FD71F60': (m, v) => ITEMS_NoOpReturnZero113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD71FB0': (m, v) =>
    ITEMS_SetOrClearFlagMask113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0, v.stack[2]! >>> 0) >>> 0,
  '0x6FD71FE0': (m, v) => ITEMS_TestFlagMask113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD72210': (m, v) =>
    ITEMS_ApplyClassManaPotionScale113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD72260': (m, v) =>
    ITEMS_ApplyClassLifePotionScale113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0) >>> 0,
  '0x6FD737A0': (m, v) => {
    ITEMS_SetInvPage113c(m, v.stack[0]! >>> 0, v.stack[1]! >>> 0)
    return undefined
  },
  '0x6FD73C50': (m, v) => ITEMS_GetBodyLocation113c(m, v.stack[0]! >>> 0) & 0xff,
}

function replayVector(
  v: VectorCaseJson,
  mutateReturn = false,
  mutatePostByte = false,
  injectRogueWrite = false,
): { ok: boolean; reason?: string; outEax: number; postHash: number } {
  const fn = B005_LEAF_DISPATCH[v.va]
  if (!fn) {
    return { ok: false, reason: `Missing dispatch handler for ${v.va}`, outEax: 0, postHash: 0 }
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
      postHash: 0,
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
        postHash: 0,
      }
    }
  }

  let postHash = 0x811c9dc5
  for (const blk of v.postBlocks) {
    const addr = u32(blk.addr)
    const expectedBytes = hexToBytes(blk.hex)
    const actualBytes = raw.readBytes(addr, expectedBytes.length)
    postHash = fnv1aUpdate(postHash, actualBytes)
    const actualHex = bytesToHex(actualBytes)
    if (actualHex !== blk.hex) {
      return {
        ok: false,
        reason: `${v.va} ${v.caseId} @ ${blk.addr}: postBlock mismatch got=${actualHex} expected=${blk.hex}`,
        outEax: actualOut,
        postHash,
      }
    }
  }

  return { ok: true, outEax: actualOut, postHash }
}

describe('K1 Lane A — B005 Inventory & Items Leaves Real-DLL Differential Replay', () => {
  const b002Fixture: VectorFileJson = JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'b002-vectors.json'), 'utf-8'),
  )
  const fixture: VectorFileJson = JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'b005-vectors.json'), 'utf-8'),
  )
  const d2tv = parseD2tv(fs.readFileSync(path.join(FIXTURE_DIR, 'laneA-b002-b005.d2tv')))

  it('covers all 17 B005 leaf VAs with real-DLL vectors and matches eax/AL + post-memory bytes 1:1', () => {
    const expectedVas = Object.keys(B005_LEAF_DISPATCH)
    expect(expectedVas.length).toBe(17)

    const baseIdx = b002Fixture.cases.length
    const seenVas = new Set<string>()
    for (let i = 0; i < fixture.cases.length; i++) {
      const v = fixture.cases[i]!
      seenVas.add(v.va)
      const res = replayVector(v)
      expect(res.ok, res.reason).toBe(true)

      const tvRec = d2tv.records[baseIdx + i]!
      expect(tvRec.va).toBe(u32(v.va))
      expect(tvRec.caseIdx).toBe(baseIdx + i)
      expect(tvRec.outEax).toBe(res.outEax)
      expect(tvRec.postHash).toBe(res.postHash)
    }

    for (const va of expectedVas) {
      expect(seenVas.has(va), `Missing vectors for ${va}`).toBe(true)
    }
  })

  it('enforces negative controls: mutating return value, post-memory bytes, or rogue write fails comparison', () => {
    const rectVec = fixture.cases.find(v => v.va === '0x6FD6E360' && v.caseId === 'rect_2x2_all_empty')!
    expect(rectVec).toBeDefined()
    expect(replayVector(rectVec, false, false, false).ok).toBe(true)
    const mutatedRet = replayVector(rectVec, true, false, false)
    expect(mutatedRet.ok).toBe(false)
    expect(mutatedRet.reason).toContain('eax mismatch')

    const linkVec = fixture.cases.find(v => v.va === '0x6FD6F690' && v.caseId === 'append_second_item')!
    expect(linkVec).toBeDefined()
    expect(replayVector(linkVec, false, false, false).ok).toBe(true)
    const mutatedLinkMem = replayVector(linkVec, false, true, false)
    expect(mutatedLinkMem.ok).toBe(false)
    expect(mutatedLinkMem.reason).toContain('postBlock mismatch')

    const bodyLocVec = fixture.cases.find(v => v.va === '0x6FD73C50' && v.caseId === 'bodyloc_0xff')!
    expect(bodyLocVec).toBeDefined()
    expect(replayVector(bodyLocVec, false, false, false).ok).toBe(true)
    const mutatedAl = replayVector(bodyLocVec, true, false, false)
    expect(mutatedAl.ok).toBe(false)
    expect(mutatedAl.reason).toContain('al mismatch')

    const rogueRes = replayVector(linkVec, false, false, true)
    expect(rogueRes.ok).toBe(false)
    expect(rogueRes.reason).toContain('rogue writes outside preBlocks')
  })
})
