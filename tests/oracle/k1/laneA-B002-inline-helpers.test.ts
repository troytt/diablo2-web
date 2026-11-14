import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import {
  DATATBLS_CheckMonStats2FlagInline113c,
  DATATBLS_CheckMonStats2ModeFlagInline113c,
  DATATBLS_GetCharStatsTxtRecordInline113c,
  DATATBLS_GetItemTypesTxtRecordInline113c,
  DATATBLS_GetMissilesTxtRecordInline113c,
  DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c,
  DATATBLS_GetMonStatsTxtRecordInline113c,
  DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c,
  DATATBLS_GetSkillsTxtMaxLvlInline113c,
  DATATBLS_GetSkillsTxtParam1Inline113c,
  DATATBLS_GetSkillsTxtParam2Inline113c,
  DATATBLS_GetSkillsTxtParam3Inline113c,
  DATATBLS_GetSkillsTxtRecordInline113c,
  DATATBLS_ValidateMonStatsIdInline113c,
  PLAYER_SetPlayerData150Params113c,
  SEED_RollLimitedRandomNumberInline113c,
  SEED_RollRandomNumberInline113c,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
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
 * Dispatch map for all 17 functions in B002 (`0x6FD51000..0x6FD515B0`).
 */
const B002_DISPATCH: Record<string, (m: Memory113c, v: VectorCaseJson) => number | undefined> = {
  '0x6FD51000': (m, v) => {
    PLAYER_SetPlayerData150Params113c(
      m,
      v.regs.eax >>> 0,
      v.stack[0]! >>> 0,
      v.stack[1]! >>> 0,
      v.stack[2]! >>> 0,
    )
    return undefined
  },
  '0x6FD51100': (m, v) => SEED_RollRandomNumberInline113c(m, v.regs.ecx >>> 0, v.regs.esi >>> 0) >>> 0,
  '0x6FD51150': (m, v) => DATATBLS_GetMissilesTxtRecordInline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD51180': (m, v) =>
    SEED_RollLimitedRandomNumberInline113c(m, v.regs.ecx >>> 0, v.regs.edi >>> 0, v.regs.eax >>> 0) >>> 0,
  '0x6FD51250': (m, v) => DATATBLS_GetSkillsTxtRecordInline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD51280': (m, v) => DATATBLS_ValidateMonStatsIdInline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD512A0': (m, v) => DATATBLS_GetMonStatsTxtRecordInline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD512D0': (m, v) => DATATBLS_GetCharStatsTxtRecordInline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD51300': (m, v) => DATATBLS_GetItemTypesTxtRecordInline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD513B0': (m, v) => DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD51400': (m, v) => DATATBLS_CheckMonStats2ModeFlagInline113c(m, v.regs.eax >>> 0, v.regs.edx >>> 0) >>> 0,
  '0x6FD51470': (m, v) => DATATBLS_CheckMonStats2FlagInline113c(m, v.regs.eax >>> 0, v.regs.edx >>> 0) >>> 0,
  '0x6FD514D0': (m, v) => DATATBLS_GetSkillsTxtMaxLvlInline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD51500': (m, v) => DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD51550': (m, v) => DATATBLS_GetSkillsTxtParam1Inline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD51580': (m, v) => DATATBLS_GetSkillsTxtParam2Inline113c(m, v.regs.eax >>> 0) >>> 0,
  '0x6FD515B0': (m, v) => DATATBLS_GetSkillsTxtParam3Inline113c(m, v.regs.eax >>> 0) >>> 0,
}

function replayVector(
  v: VectorCaseJson,
  mutateReturn = false,
  mutatePostByte = false,
  injectRogueWrite = false,
): { ok: boolean; reason?: string; outEax: number; postHash: number } {
  const fn = B002_DISPATCH[v.va]
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

  const actualEax = v.compareMode === 'void' ? 0 : (ret ?? 0) >>> 0
  if (v.compareMode === 'eax') {
    const expectedEax = v.outEax >>> 0
    if (actualEax !== expectedEax) {
      return {
        ok: false,
        reason: `${v.va} ${v.caseId}: eax mismatch got=0x${actualEax.toString(16)} expected=0x${expectedEax.toString(16)}`,
        outEax: actualEax,
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
        outEax: actualEax,
        postHash,
      }
    }
  }

  return { ok: true, outEax: actualEax, postHash }
}

describe('K1 Lane A — B002 D2Common Inline Helpers Real-DLL Differential Replay', () => {
  const fixture: VectorFileJson = JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'b002-vectors.json'), 'utf-8'),
  )
  const d2tv = parseD2tv(fs.readFileSync(path.join(FIXTURE_DIR, 'laneA-b002-b005.d2tv')))

  it('covers all 17 B002 VAs with real-DLL vectors and matches eax + post-memory bytes 1:1', () => {
    expect(d2tv.fnName).toBe('LANEA_1')
    const expectedVas = Object.keys(B002_DISPATCH)
    expect(expectedVas.length).toBe(17)

    const seenVas = new Set<string>()
    for (let i = 0; i < fixture.cases.length; i++) {
      const v = fixture.cases[i]!
      seenVas.add(v.va)
      const res = replayVector(v)
      expect(res.ok, res.reason).toBe(true)

      const tvRec = d2tv.records[i]!
      expect(tvRec.va).toBe(u32(v.va))
      expect(tvRec.caseIdx).toBe(i)
      expect(tvRec.outEax).toBe(res.outEax)
      expect(tvRec.postHash).toBe(res.postHash)
    }

    for (const va of expectedVas) {
      expect(seenVas.has(va), `Missing vectors for ${va}`).toBe(true)
    }
  })

  it('enforces negative controls: mutating return value, post-memory bytes, or rogue write fails comparison', () => {
    const eaxVec = fixture.cases.find(v => v.va === '0x6FD51100' && v.caseId === 'max_eight_pow2')!
    expect(eaxVec).toBeDefined()
    expect(replayVector(eaxVec, false, false, false).ok).toBe(true)
    const mutatedRet = replayVector(eaxVec, true, false, false)
    expect(mutatedRet.ok).toBe(false)
    expect(mutatedRet.reason).toContain('eax mismatch')

    const mutatedMemSeed = replayVector(eaxVec, false, true, false)
    expect(mutatedMemSeed.ok).toBe(false)
    expect(mutatedMemSeed.reason).toContain('postBlock mismatch')

    const playerVec = fixture.cases.find(v => v.va === '0x6FD51000' && v.caseId === 'valid_player_extremes')!
    expect(playerVec).toBeDefined()
    expect(replayVector(playerVec, false, false, false).ok).toBe(true)
    const mutatedPlayerMem = replayVector(playerVec, false, true, false)
    expect(mutatedPlayerMem.ok).toBe(false)
    expect(mutatedPlayerMem.reason).toContain('postBlock mismatch')

    const rogueRes = replayVector(playerVec, false, false, true)
    expect(rogueRes.ok).toBe(false)
    expect(rogueRes.reason).toContain('rogue writes outside preBlocks')
  })
})
