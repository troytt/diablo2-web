import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { INVENTORY_InitItemGfxCodeTable113c } from '../../../src/d2kern-113c/common/inventory.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

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

function createGuardedMemory(preBlocks: MemBlockJson[], postBlocks: MemBlockJson[]) {
  const m = new SparseMemory113c()
  for (const blk of preBlocks) {
    m.loadBlock(u32(blk.addr), hexToBytes(blk.hex))
  }
  const postRanges = postBlocks.map(b => ({
    start: u32(b.addr),
    end: (u32(b.addr) + b.hex.length / 2) >>> 0,
  }))
  const rogueWrites: number[] = []
  const checkWrite = (addr: number, len: number) => {
    const start = addr >>> 0
    for (let off = 0; off < len; off++) {
      const a = (start + off) >>> 0
      if (!postRanges.some(r => a >= r.start && a < r.end)) {
        rogueWrites.push(a)
      }
    }
  }
  const origSetU8 = m.setU8.bind(m)
  const origSetU16 = m.setU16.bind(m)
  const origSetU32 = m.setU32.bind(m)
  const origSet = m.set.bind(m)
  m.setU8 = (addr: number, val: number) => {
    checkWrite(addr, 1)
    origSetU8(addr, val)
  }
  m.setU16 = (addr: number, val: number) => {
    checkWrite(addr, 2)
    origSetU16(addr, val)
  }
  m.setU32 = (addr: number, val: number) => {
    checkWrite(addr, 4)
    origSetU32(addr, val)
  }
  m.set = (base, f, v, idx = 0) => {
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    checkWrite((base + f.off + idx * width) >>> 0, width)
    origSet(base, f, v, idx)
  }
  return { m, rogueWrites }
}

function replayGfxCacheVector(
  v: VectorCaseJson,
  mutateCacheByte = false,
): { ok: boolean; reason?: string; postHash: number } {
  if (v.va !== '0x6FD6E920') {
    return { ok: false, reason: `Unexpected VA ${v.va}`, postHash: 0 }
  }
  const { m, rogueWrites } = createGuardedMemory(v.preBlocks, v.postBlocks)
  INVENTORY_InitItemGfxCodeTable113c(m)

  if (rogueWrites.length > 0) {
    return {
      ok: false,
      reason: `${v.va} ${v.caseId}: rogue write outside postBlocks at 0x${rogueWrites[0]!.toString(16)}`,
      postHash: 0,
    }
  }

  if (mutateCacheByte) {
    m.setU8(0x6fdf0bb0, m.u8(0x6fdf0bb0) ^ 0xff)
  }

  let postHash = 0x811c9dc5
  for (const blk of v.postBlocks) {
    const addr = u32(blk.addr)
    const expectedBytes = hexToBytes(blk.hex)
    const actualBytes = m.readBytes(addr, expectedBytes.length)
    postHash = fnv1aUpdate(postHash, actualBytes)
    const actualHex = bytesToHex(actualBytes)
    if (actualHex !== blk.hex) {
      return {
        ok: false,
        reason: `${v.va} ${v.caseId} @ ${blk.addr}: postBlock mismatch`,
        postHash,
      }
    }
  }

  return { ok: true, postHash }
}

describe('K1 Lane A — B005 0x6FD6E920 INVENTORY_InitItemGfxCodeTable Real-DLL Differential Replay', () => {
  const b002Fixture: VectorFileJson = JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'b002-vectors.json'), 'utf-8'),
  )
  const b005Fixture: VectorFileJson = JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'b005-vectors.json'), 'utf-8'),
  )
  const fixture: VectorFileJson = JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'b005-gfx-cache-vectors.json'), 'utf-8'),
  )
  const d2tv = parseD2tv(fs.readFileSync(path.join(FIXTURE_DIR, 'laneA-b002-b005.d2tv')))

  it('replays all 10 cases of 0x6FD6E920 (guard, zero/negative count, nt boundary, multi-item collisions, s>=255 backfill, dwCode==0, and NT=3/37/51) byte-identically against D2Common.dll', () => {
    expect(fixture.cases.length).toBe(10)
    const baseIdx = b002Fixture.cases.length + b005Fixture.cases.length
    expect(baseIdx + fixture.cases.length).toBe(d2tv.count)

    for (let i = 0; i < fixture.cases.length; i++) {
      const v = fixture.cases[i]!
      expect(v.va).toBe('0x6FD6E920')
      const res = replayGfxCacheVector(v)
      expect(res.ok, res.reason).toBe(true)

      const tvRec = d2tv.records[baseIdx + i]!
      expect(tvRec.va).toBe(u32(v.va))
      expect(tvRec.caseIdx).toBe(baseIdx + i)
      expect(tvRec.outEax).toBe(0)
      expect(tvRec.postHash).toBe(res.postHash)
    }
  })

  it('enforces negative control: mutating a byte in the 255-slot gfx cache table fails comparison', () => {
    const multiVec = fixture.cases.find(v => v.caseId === 'mixed_items_and_static_table_collisions')!
    expect(multiVec).toBeDefined()
    expect(replayGfxCacheVector(multiVec, false).ok).toBe(true)
    const mutated = replayGfxCacheVector(multiVec, true)
    expect(mutated.ok).toBe(false)
    expect(mutated.reason).toContain('postBlock mismatch')
  })
})
