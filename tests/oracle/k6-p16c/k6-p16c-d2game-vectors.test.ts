/**
 * [K6-P16C] Final Real-DLL D2Game.dll Closure Parity Vector Suite (23 Target VAs).
 *
 * Covers the final 23 scenario-only D2Game.dll VAs:
 *   - 8 fixable functions (>= 4 real-DLL cases & >= 2 distinct signatures each)
 *   - 15 documented single-signature constant-return / free / pool-alloc stubs (>= 3 real-DLL cases each)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  PACKET_C2S2E_PlaySoundNoop113c,
  PACKET_C2S42_ClearCursorNoop113c,
  PACKET_C2S43_QuestInitNoop113c,
  PACKET_C2S66_WardenResponseNoop113c,
} from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c'
import {
  ITEMS_UpdateScrollOrTomeSkillCharges113c,
  SKILLS_CallbackStaticField113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import { AIGENERAL_FreeMinionList_6FC40B30_113c } from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import { QUESTS_FreeUnitQuestChain_6FC53FF0_113c } from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import {
  ACT3Q0_ActiveFilter113c,
  SKILLS_SrvSt18_ReturnOne113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c'
import { SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c } from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import {
  MONAI_NoOpRet4_6FCC3880_113c,
  MONAI_NoOpRet4_6FCC3930_113c,
} from '../../../src/d2kern-113c/game/k2-w2b5-113c'
import { ACT4_InitObjectNoop_6FCD8930_113c } from '../../../src/d2kern-113c/game/k2-w2b6-113c'
import {
  ACT2Q2_NoOp_6FCE2450_113c,
  ACT2Q3_NoOpA_6FCE2350_113c,
  ACT2Q8_ActiveFilter_6FCE25D0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b7-113c'
import { ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c } from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import { SKILLS_SrvDo141_SpawnPartyMinionsAndDistributeExp_6FCD65E0_113c } from '../../../src/d2kern-113c/game/k2-w4b8-113c'
import { MONSTER_GetModeEntryVa113c } from '../../../src/d2kern-113c/game/monster-events'
import { OBJECTS_AllocInteractStrc113c } from '../../../src/d2kern-113c/game/objects-populate-113c'
import { MONSTER_InitMonsterUnit113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import { PLAYER_FinishModeAndResetToNeutral113c } from '../../../src/d2kern-113c/game/town-runtime-gap-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: CoWSparseMemory113c, a: readonly number[]) => unknown

const EXPECTED_VA_COUNT = 23

const FIXABLE_VAS = new Set<string>([
  '0x6FC62EC0',
  '0x6FCF43E0',
  '0x6FC949A0',
  '0x6FC99850',
  '0x6FCB5D50',
  '0x6FCBD6F0',
  '0x6FCD0320',
  '0x6FCD65E0',
])

const DOCUMENTED_SINGLE_SIG_STUB_VAS = new Set<string>([
  '0x6FC40B30',
  '0x6FC4E7D0',
  '0x6FC53FF0',
  '0x6FC6DFD0',
  '0x6FCC3880',
  '0x6FCC3930',
  '0x6FCD8930',
  '0x6FCE2350',
  '0x6FCE2450',
  '0x6FCE25D0',
  '0x6FCEB190',
  '0x6FCEB1B0',
  '0x6FCEB1C0',
  '0x6FCEB1D0',
  '0x6FD028A0',
])

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  '0x6FC62EC0': (m, a) => SKILLS_CallbackStaticField113c(m, a[0]!, a[1]!),
  '0x6FCF43E0': (m, a) => ITEMS_UpdateScrollOrTomeSkillCharges113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC949A0': (m, a) => MONSTER_GetModeEntryVa113c(m, a[0]!, a[1]!),
  '0x6FC99850': (m, a) => PLAYER_FinishModeAndResetToNeutral113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB5D50': (m, a) =>
    SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
    ),
  '0x6FCBD6F0': (m, a) => ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c(m, a[0]!, a[1]!),
  '0x6FCD0320': (m, a) => MONSTER_InitMonsterUnit113c(m, a[0]!, a[1]!, a[2]!, a[3]!, true),
  '0x6FCD65E0': (m, a) =>
    SKILLS_SrvDo141_SpawnPartyMinionsAndDistributeExp_6FCD65E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),

  '0x6FC40B30': (m, a) => AIGENERAL_FreeMinionList_6FC40B30_113c(m, a[0]!, a[1]!),
  '0x6FC4E7D0': (m, a) => OBJECTS_AllocInteractStrc113c(m, a[0]!),
  '0x6FC53FF0': (m, a) => QUESTS_FreeUnitQuestChain_6FC53FF0_113c(m, a[0]!, a[1]!),
  '0x6FC6DFD0': (m, a) => SKILLS_SrvSt18_ReturnOne113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC3880': (m, a) => MONAI_NoOpRet4_6FCC3880_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC3930': (m, a) => MONAI_NoOpRet4_6FCC3930_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCD8930': (m, a) => ACT4_InitObjectNoop_6FCD8930_113c(m, a[0]!),
  '0x6FCE2350': (m) => ACT2Q3_NoOpA_6FCE2350_113c(m),
  '0x6FCE2450': (m) => ACT2Q2_NoOp_6FCE2450_113c(m),
  '0x6FCE25D0': (m, a) => ACT2Q8_ActiveFilter_6FCE25D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCEB190': (m, a) => PACKET_C2S66_WardenResponseNoop113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEB1B0': (m, a) => PACKET_C2S43_QuestInitNoop113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEB1C0': (m, a) => PACKET_C2S42_ClearCursorNoop113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEB1D0': (m, a) => PACKET_C2S2E_PlaySoundNoop113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD028A0': (m, a) => ACT3Q0_ActiveFilter113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P16CVectorRecord {
  va: string
  name: string
  caseIdx: number
  label: string
  tsArgs: number[]
  extraCaps: ExtraCapRecord[]
  retMask: string
  asserted: boolean
  assertLine: number
  ret: string
  setupTop: string
  preMem: MemRunRecord[]
  postMem: MemRunRecord[]
  heapTop: string
  heapHex: string
}

const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_CS_GAME = 0x30010000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

class CoWSparseMemory113c extends SparseMemory113c {
  private readonly basePages = new Map<number, Uint8Array>()
  private readonly baseKnown = new Map<number, Uint8Array>()
  private readonly overlayPages = new Map<number, Uint8Array>()
  private readonly overlayKnown = new Map<number, Uint8Array>()
  private heapCursor = HEAP_BASE

  commitOverlayToBase(): void {
    for (const [pg, data] of this.overlayPages.entries()) {
      this.basePages.set(pg, data)
      this.baseKnown.set(pg, this.overlayKnown.get(pg)!)
    }
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  resetOverlay(): void {
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  getHeapTop(): number {
    return this.heapCursor >>> 0
  }

  override alloc(size: number): number {
    const effSize = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    if (p > this.heapCursor) {
      this.fill(this.heapCursor, p - this.heapCursor, 0)
    }
    this.fill(p, effSize, 0)
    this.heapCursor = (p + effSize) >>> 0
    return p
  }

  override loadBlock(addr: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.setU8((addr + i) >>> 0, data[i]!)
    }
  }

  override readBytes(addr: number, len: number): Uint8Array {
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      out[i] = this.u8((addr + i) >>> 0)
    }
    return out
  }

  override u8(p: number): number {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    const ok = this.overlayKnown.get(pg)
    if (ok !== undefined && ok[off] !== 0) {
      return this.overlayPages.get(pg)![off]!
    }
    const bk = this.baseKnown.get(pg)
    if (bk !== undefined && bk[off] !== 0) {
      return this.basePages.get(pg)![off]!
    }
    throw new Error(`CoWSparseMemory113c: read of unloaded byte 0x${addr.toString(16)}`)
  }

  override u16(p: number): number {
    return this.u8(p) | (this.u8((p + 1) >>> 0) << 8)
  }

  override u32(p: number): number {
    return (this.u16(p) | (this.u16((p + 2) >>> 0) << 16)) >>> 0
  }

  override setU8(p: number, v: number): void {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    let od = this.overlayPages.get(pg)
    let ok = this.overlayKnown.get(pg)
    if (od === undefined || ok === undefined) {
      const bd = this.basePages.get(pg)
      const bk = this.baseKnown.get(pg)
      od = bd !== undefined ? bd.slice() : new Uint8Array(PAGE_SIZE)
      ok = bk !== undefined ? bk.slice() : new Uint8Array(PAGE_SIZE)
      this.overlayPages.set(pg, od)
      this.overlayKnown.set(pg, ok)
    }
    od[off] = v & 0xff
    ok[off] = 1
  }

  override setU16(p: number, v: number): void {
    this.setU8(p, v & 0xff)
    this.setU8((p + 1) >>> 0, (v >>> 8) & 0xff)
  }

  override setU32(p: number, v: number): void {
    this.setU16(p, v & 0xffff)
    this.setU16((p + 2) >>> 0, (v >>> 16) & 0xffff)
  }

  override fill(p: number, len: number, v: number): void {
    const byte = v & 0xff
    for (let i = 0; i < len; i++) {
      this.setU8((p + i) >>> 0, byte)
    }
  }

  override get(base: number, f: FieldLayout113c, index = 0): number {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }

  override set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }
}

const HEX_CHARS = '0123456789abcdef'

function hexToBytes(hex: string): Uint8Array {
  const n = hex.length >>> 1
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    out += HEX_CHARS[(b >>> 4) & 0x0f]! + HEX_CHARS[b & 0x0f]!
  }
  return out
}
function extractMemRunsRange(
  mem: CoWSparseMemory113c,
  startAddr: number,
  endAddr: number,
  out: MemRunRecord[],
): void {
  let a = startAddr >>> 0
  const end = endAddr >>> 0
  while (a < end) {
    let anyNz = false
    for (let i = 0; i < 16 && a + i < end; i++) {
      if (mem.u8((a + i) >>> 0) !== 0) {
        anyNz = true
        break
      }
    }
    if (!anyNz) {
      a += 16
      continue
    }
    const runStart = a
    while (a < end && (a - runStart) < 512) {
      let chunkNz = false
      for (let i = 0; i < 16 && a + i < end; i++) {
        if (mem.u8((a + i) >>> 0) !== 0) {
          chunkNz = true
          break
        }
      }
      if (!chunkNz) break
      a += 16
    }
    const runEnd = a < end ? a : end
    const len = runEnd - runStart
    out.push({
      addr: `0x${runStart.toString(16).toUpperCase().padStart(8, '0')}`,
      hex: bytesToHex(mem.readBytes(runStart, len)),
    })
  }
}

function extractStageRuns(
  mem: CoWSparseMemory113c,
  setupTop: number,
  extraCaps: readonly ExtraCapRecord[],
): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6P16CVectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p16c/k6-p16c-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P16CVectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P16CVectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe(`[K6-P16C] Final Real-DLL D2Game.dll Closure Parity Vector Suite (${EXPECTED_VA_COUNT} VAs)`, () => {
  let mem: CoWSparseMemory113c

  beforeAll(() => {
    const imgPath = resolve(
      import.meta.dirname,
      '../../fixtures/oracle/k1/d2game-datatbls-113c.img.gz',
    )
    const raw = gunzipSync(readFileSync(imgPath))
    const hdr = parseVectorHeader(raw)
    expect(hdr.kind).toBe('PAGEIMG')
    expect(hdr.recordSize).toBe(4100)

    mem = new CoWSparseMemory113c()
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    let off = 32
    for (let i = 0; i < hdr.recordCount; i++) {
      const va = view.getUint32(off, true) >>> 0
      mem.loadBlock(va, raw.subarray(off + 4, off + 4 + 4096))
      off += 4100
    }
    mem.fill(0x6fd30000, 0x3000, 0)
    bindK2KernelGlobals113c(mem)
    // Hydrate SGPT_ITEMS_LINKER_PTR_VA (0x6FDEFF6C) from loaded Items.txt rows
    const nItems = mem.u32(0x6fdefb94) >>> 0
    const pItems = mem.u32(0x6fdefb98) >>> 0
    if (nItems > 0 && nItems < 4096 && pItems !== 0) {
      const nodes: Array<{ code: number; row: number }> = []
      for (let r = 0; r < nItems; r++) {
        const code = mem.u32((pItems + r * 0x1a8 + 0x80) >>> 0) >>> 0
        nodes.push({ code, row: r })
      }
      nodes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.row - b.row))
      const hdrVa = 0x20fe0000
      const nodesVa = 0x20fe0010
      mem.setU32(hdrVa, nItems)
      mem.setU32((hdrVa + 4) >>> 0, 0)
      mem.setU32((hdrVa + 8) >>> 0, nodesVa)
      for (let i = 0; i < nodes.length; i++) {
        mem.setU32((nodesVa + i * 8) >>> 0, nodes[i]!.code)
        mem.setU32((nodesVa + i * 8 + 4) >>> 0, nodes[i]!.row >>> 0)
      }
      mem.setU32(0x6fdeff6c, hdrVa)
    }
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.fill(STAGE_CS_GAME, 0x1000, 0)
    mem.fill(0x28000000, 0x4000, 0)
    mem.setU32(0x28000004, 1)
    mem.setU32(0x6fd18d10, 100000)
    mem.setU32(0x6fdd91fc, 0)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd2e360, 4, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f80, 0x20, 0)
    mem.commitOverlayToBase()
  })

  it(`covers all ${EXPECTED_VA_COUNT} final D2Game VAs (8 fixable + 15 stubs, >= 3 cases each)`, () => {
    expect(VECTORS_BY_VA.size).toBe(EXPECTED_VA_COUNT)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(FIXABLE_VAS.size).toBe(8)
    expect(DOCUMENTED_SINGLE_SIG_STUB_VAS.size).toBe(15)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      expect(
        FIXABLE_VAS.has(va) || DOCUMENTED_SINGLE_SIG_STUB_VAS.has(va),
        `${va} missing from VA classification sets`,
      ).toBe(true)
      expect(cases.length).toBeGreaterThanOrEqual(FIXABLE_VAS.has(va) ? 4 : 3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const cap of vec.extraCaps) {
          const capStart = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capStart, cap.len, 0)
        }
        for (const blk of vec.preMem) {
          const addr = Number.parseInt(blk.addr, 16) >>> 0
          mem.loadBlock(addr, hexToBytes(blk.hex))
        }

        beginVaTrace113c()
        let retVal: unknown = 0
        let caughtErr: unknown = null
        try {
          retVal = fn!(mem, vec.tsArgs)
        } catch (err) {
          caughtErr = err
        }
        const hits = endVaTrace113c()
        expect(
          hits.has(`D2Game:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit D2Game:${va}`,
        ).toBe(true)

        if (vec.asserted) {
          expect(
            caughtErr,
            `${va} case ${vec.caseIdx} (${vec.label}) expected D2CommonAssertError(${vec.assertLine})`,
          ).toBeInstanceOf(D2CommonAssertError)
          expect((caughtErr as D2CommonAssertError).line).toBe(vec.assertLine)
          continue
        }

        if (caughtErr !== null) {
          const detail = caughtErr instanceof Error && caughtErr.stack ? caughtErr.stack : String(caughtErr)
          throw new Error(
            `${va} case ${vec.caseIdx} (${vec.label}) threw unexpected error: ${detail}`,
          )
        }

        const retMask = Number.parseInt(vec.retMask, 16) >>> 0
        if (retMask !== 0) {
          const coerced =
            typeof retVal === 'boolean'
              ? retVal
                ? 1
                : 0
              : typeof retVal === 'number'
                ? retVal >>> 0
                : 0
          const actualRet = (coerced & retMask) >>> 0
          const expectedRet = ((Number.parseInt(vec.ret, 16) >>> 0) & retMask) >>> 0
          expect(
            `0x${actualRet.toString(16).toUpperCase().padStart(8, '0')}`,
            `${va} case ${vec.caseIdx} (${vec.label}) return value mismatch`,
          ).toBe(`0x${expectedRet.toString(16).toUpperCase().padStart(8, '0')}`)
        }

        const normalizeRuns = (runs: readonly MemRunRecord[]): MemRunRecord[] => {
          if (va !== '0x6FCF43E0') return [...runs]
          return runs.map((r) => {
            if (r.addr !== '0x30002600') return r
            const bytes = hexToBytes(r.hex)
            if (bytes.length < 4) return r
            const pktLen =
              (bytes[0]! | (bytes[1]! << 8) | (bytes[2]! << 16) | (bytes[3]! << 24)) >>> 0
            let off = 4
            const end = Math.min(bytes.length, 4 + pktLen)
            while (off < end) {
              const op = bytes[off]!
              if (op === 0x21 && off + 12 <= end) {
                // `0x6FCAD5F0` leaves byte +0x0B uninitialized on the stack
                bytes[off + 0x0b] = 0
                off += 12
              } else if (op === 0x22 && off + 12 <= end) {
                // `0x6FCAD570` leaves bytes +0x02 and +0x0A uninitialized on the stack
                bytes[off + 0x02] = 0
                bytes[off + 0x0a] = 0
                off += 12
              } else if (op === 0x23 && off + 13 <= end) {
                off += 13
              } else {
                break
              }
            }
            return { addr: r.addr, hex: bytesToHex(bytes) }
          })
        }
        const actualPost = normalizeRuns(extractStageRuns(mem, setupTop, vec.extraCaps))
        const expectedPost = normalizeRuns(vec.postMem)
        expect(
          actualPost,
          `${va} case ${vec.caseIdx} (${vec.label}) postMem mismatch`,
        ).toEqual(expectedPost)

        const actualHeapTop = mem.getHeapTop() >>> 0
        expect(
          `0x${actualHeapTop.toString(16).toUpperCase().padStart(8, '0')}`,
          `${va} case ${vec.caseIdx} (${vec.label}) heapTop mismatch`,
        ).toBe(vec.heapTop)

        if (actualHeapTop > HEAP_BASE) {
          const actualHeapHex = bytesToHex(mem.readBytes(HEAP_BASE, actualHeapTop - HEAP_BASE))
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heapHex mismatch`,
          ).toBe(vec.heapHex)
        }
      }
    })
  }
})
