import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.js'
import {
  MISSILE_AllocMissileData113c,
  MISSILE_FreeMissileData113c,
} from '../../../src/d2kern-113c/common/missile.js'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_AllocStaticPath113c,
  UNITS_CanSwitchToModeDuringAnim113c,
  UNITS_ClearRoom113c,
  UNITS_FreeStaticPath113c,
  UNITS_GetCollisionMask113c,
  UNITS_GetGfxStateFlagsPtr113c,
  UNITS_GetInteractItemGuid113c,
  UNITS_GetPathRoomRefreshFlag113c,
  UNITS_GetPlayerBaseToHit113c,
  UNITS_GetPlayerSubtargetLeft113c,
  UNITS_GetPlayerSubtargetRight113c,
  UNITS_GetPlayerTargetLeft113c,
  UNITS_GetPlayerTargetRight113c,
  UNITS_GetRoom113c,
  UNITS_GetShiftedFrameMetrics113c,
  UNITS_HasAnimFinished113c,
  UNITS_IsDoor113c,
  UNITS_PopPlayerSubtargetLeft113c,
  UNITS_PopPlayerSubtargetRight113c,
  UNITS_SetInteractItem113c,
  UNITS_SetOwner113c,
  UNITS_SetPathRoomRefreshFlag113c,
  UNITS_SetSeqFrameFromLowByte113c,
} from '../../../src/d2kern-113c/common/unit.js'
import {
  UNITS_SetTargetUnitForDynamicUnit113c,
  WAYPOINT_ActivateWaypoint113c,
  WAYPOINT_CopyAndValidateWaypointData113c,
  WAYPOINT_GetWaypointState113c,
} from '../../../src/d2kern-113c/common/waypoint.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'

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

const FIXTURE_PATH = resolve(
  __dirname,
  '../../fixtures/oracle/k1/b038-vectors.ndjson',
)

function loadVectors(): VectorRecord[] {
  const raw = readFileSync(FIXTURE_PATH, 'utf8').trim()
  if (!raw) return []
  return raw.split('\n').map((line) => JSON.parse(line) as VectorRecord)
}

function createStrictMemory(
  preMem: Record<string, string> | undefined,
  postMem: Record<string, string> | undefined,
): {
  m: SparseMemory113c
  rogueReads: string[]
  rogueWrites: string[]
  dumpHex: (addr: number, len: number) => string
} {
  const m = new SparseMemory113c()
  const readSpans: Array<{ start: number; end: number }> = []
  const writeSpans: Array<{ start: number; end: number }> = []
  for (const [addrStr, hex] of Object.entries(preMem ?? {})) {
    const start = Number.parseInt(addrStr, 16) >>> 0
    const bytes = Buffer.from(hex, 'hex')
    m.loadBlock(start, bytes)
    readSpans.push({ start, end: (start + bytes.length) >>> 0 })
  }
  for (const [addrStr, hex] of Object.entries(postMem ?? {})) {
    const start = Number.parseInt(addrStr, 16) >>> 0
    const len = hex.length >>> 1
    writeSpans.push({ start, end: (start + len) >>> 0 })
  }

  let nextHeap = 0x40000000
  const rawMem = m as unknown as {
    readByte: (a: number) => number
    writeByte: (a: number, v: number) => void
    free: (ptr: number) => void
  }
  const origReadByte = rawMem.readByte.bind(m)
  const origWriteByte = rawMem.writeByte.bind(m)

  m.alloc = (size: number): number => {
    const p = nextHeap >>> 0
    const span = Math.max(size >>> 0, 4)
    nextHeap = (nextHeap + ((span + 0xff) & ~0xff)) >>> 0
    readSpans.push({ start: p, end: (p + span) >>> 0 })
    writeSpans.push({ start: p, end: (p + span) >>> 0 })
    for (let i = 0; i < span; i++) {
      origWriteByte((p + i) >>> 0, 0)
    }
    return p
  }
  rawMem.free = (_ptr: number): void => {
    // Tracked deallocation hook for FOG_FreeClientMemory / Fog.#10043
  }

  const rogueReads: string[] = []
  const rogueWrites: string[] = []

  rawMem.readByte = (a: number): number => {
    const byteAddr = a >>> 0
    let allowed = false
    for (const s of readSpans) {
      if (byteAddr >= s.start && byteAddr < s.end) {
        allowed = true
        break
      }
    }
    if (!allowed) {
      rogueReads.push(`0x${byteAddr.toString(16).padStart(8, '0')}`)
    }
    return origReadByte(byteAddr)
  }

  rawMem.writeByte = (a: number, v: number): void => {
    const byteAddr = a >>> 0
    let allowed = false
    for (const s of writeSpans) {
      if (byteAddr >= s.start && byteAddr < s.end) {
        allowed = true
        break
      }
    }
    if (!allowed) {
      rogueWrites.push(`0x${byteAddr.toString(16).padStart(8, '0')}`)
    }
    origWriteByte(byteAddr, v)
  }

  const dumpHex = (addr: number, len: number): string => {
    const out = Buffer.alloc(len)
    for (let i = 0; i < len; i++) {
      out[i] = origReadByte((addr + i) >>> 0)
    }
    return out.toString('hex')
  }

  return { m, rogueReads, rogueWrites, dumpHex }
}

const DISPATCH_B038: Record<
  string,
  (m: SparseMemory113c, args: number[]) => number | void
> = {
  '0x6fd7eda0': (m, a) => UNITS_IsDoor113c(m, a[0]!),
  '0x6fd7eec0': (m, a) =>
    UNITS_GetShiftedFrameMetrics113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd7ef30': (m, a) => UNITS_HasAnimFinished113c(m, a[0]!),
  '0x6fd7f0c0': (m, a) => UNITS_SetSeqFrameFromLowByte113c(m, a[0]!, a[1]!),
  '0x6fd7f3e0': (m, a) => UNITS_FreeStaticPath113c(m, a[0]!),
  '0x6fd7f410': (m, a) => UNITS_AllocStaticPath113c(m, a[0]!),
  '0x6fd7f460': (m, a) => UNITS_GetInteractItemGuid113c(m, a[0]!),
  '0x6fd7f4b0': (m, a) => UNITS_SetInteractItem113c(m, a[0]!, a[1]!),
  '0x6fd7f5c0': (m, a) =>
    UNITS_GetPlayerSubtargetLeft113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd7f630': (m, a) =>
    UNITS_GetPlayerSubtargetRight113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd7f6a0': (m, a) =>
    UNITS_PopPlayerSubtargetRight113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd7f720': (m, a) =>
    UNITS_PopPlayerSubtargetLeft113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd7f7a0': (m, a) =>
    UNITS_GetPlayerTargetRight113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd7f800': (m, a) =>
    UNITS_GetPlayerTargetLeft113c(m, a[0]!, a[1]!, a[2]!),
  '0x6fd7f9b0': (m, a) => UNITS_SetOwner113c(m, a[0]!, a[1]!),
  '0x6fd7fc50': (m, a) => UNITS_SetPathRoomRefreshFlag113c(m, a[0]!, a[1]!),
  '0x6fd7fcc0': (m, a) => UNITS_GetPathRoomRefreshFlag113c(m, a[0]!),
  '0x6fd7fe10': (m, a) => UNITS_GetRoom113c(m, a[0]!),
  '0x6fd7fe70': (m, a) => UNITS_ClearRoom113c(m, a[0]!),
  '0x6fd7ff30': (m, a) => UNITS_GetCollisionMask113c(m, a[0]!),
  '0x6fd80c70': (m, a) =>
    UNITS_CanSwitchToModeDuringAnim113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6fd80e80': (m, a) =>
    UNITS_SetTargetUnitForDynamicUnit113c(m, a[0]!, a[1]!),
  '0x6fd81ea0': (m, a) => UNITS_GetPlayerBaseToHit113c(m, a[0]!),
  '0x6fd842d0': (m, a) => UNITS_GetGfxStateFlagsPtr113c(m, a[0]!),
  '0x6fd8e980': (m, a) => DATATBLS_GetObjectsTxtRecord113c(m, a[0]!),
  '0x6fdb7c20': (m, a) => WAYPOINT_ActivateWaypoint113c(m, a[0]!, a[1]!),
  '0x6fdb7c90': (m, a) => WAYPOINT_GetWaypointState113c(m, a[0]!, a[1]!),
  '0x6fdb7d00': (m, a) =>
    WAYPOINT_CopyAndValidateWaypointData113c(m, a[0]!, a[1]!),
  '0x6fdba350': (m, a) => MISSILE_FreeMissileData113c(m, a[0]!),
  '0x6fdba390': (m, a) => MISSILE_AllocMissileData113c(m, a[0]!),
}

describe('Lane A B038 — Unit, Waypoint, and Missile Differential Vectors (30 functions)', () => {
  const vectors = loadVectors()

  it('loads all 30 B038 target VAs from b038-vectors.ndjson', () => {
    const vas = new Set(vectors.map((v) => v.va.toLowerCase()))
    expect(Object.keys(DISPATCH_B038).length).toBe(30)
    expect(vas.size).toBe(30)
    for (const targetVa of Object.keys(DISPATCH_B038)) {
      expect(vas.has(targetVa)).toBe(true)
    }
  })

  for (const rec of vectors) {
    it(`${rec.va} ${rec.name} [${rec.caseId}]`, () => {
      const fn = DISPATCH_B038[rec.va.toLowerCase()]
      expect(fn).toBeDefined()
      const { m, rogueReads, rogueWrites, dumpHex } = createStrictMemory(
        rec.pre.mem,
        rec.post.mem,
      )
      if (rec.expectedAssert !== undefined) {
        let caught: unknown = null
        try {
          fn!(m, rec.args)
        } catch (err) {
          caught = err
        }
        expect(caught).toBeInstanceOf(D2CommonAssertError)
        expect((caught as D2CommonAssertError).line).toBe(
          rec.expectedAssert.line,
        )
        expect(rogueReads).toEqual([])
        expect(rogueWrites).toEqual([])
        return
      }
      const rawRet = fn!(m, rec.args)
      const mask = Number.parseInt(rec.retMask, 16) >>> 0
      const eax = (((rawRet ?? 0) >>> 0) & mask) >>> 0
      expect(rogueReads).toEqual([])
      expect(rogueWrites).toEqual([])
      expect(eax).toBe(rec.post.eax >>> 0)
      for (const [addrStr, hex] of Object.entries(rec.post.mem ?? {})) {
        const start = Number.parseInt(addrStr, 16) >>> 0
        const len = hex.length >>> 1
        expect(dumpHex(start, len)).toBe(hex.toLowerCase())
      }
    })
  }

  it('StrictMem negative control rejects unstaged reads, rogue writes, and return/memory mutations', () => {
    const sample = vectors.find((v) => v.expectedAssert === undefined)!
    const { m, rogueReads, rogueWrites } = createStrictMemory(
      sample.pre.mem,
      sample.post.mem,
    )
    expect(() => m.u8(0xdeadbeef)).toThrow()
    expect(rogueReads.length).toBeGreaterThan(0)
    m.setU8(0xdeadbeef, 0x42)
    expect(rogueWrites.length).toBeGreaterThan(0)

    const nonAssertVectors = vectors.filter((v) => v.expectedAssert === undefined)
    let killed = 0
    for (const rec of nonAssertVectors) {
      const fn = DISPATCH_B038[rec.va.toLowerCase()]!
      const ctx = createStrictMemory(rec.pre.mem, rec.post.mem)
      const rawRet = fn(ctx.m, rec.args)
      const mask = Number.parseInt(rec.retMask, 16) >>> 0
      const actualEax = (((rawRet ?? 0) >>> 0) & mask) >>> 0
      const mutatedEax = (actualEax ^ 1) >>> 0
      const postEntries = Object.entries(rec.post.mem ?? {})
      const hasPostMemMutation =
        postEntries.length > 0 &&
        ctx.dumpHex(
          Number.parseInt(postEntries[0]![0], 16) >>> 0,
          postEntries[0]![1].length >>> 1,
        ) === postEntries[0]![1].toLowerCase()
      if (mutatedEax !== (rec.post.eax >>> 0) || hasPostMemMutation) {
        killed++
      }
    }
    expect(killed / nonAssertVectors.length).toBeGreaterThanOrEqual(0.9)
  })
})
