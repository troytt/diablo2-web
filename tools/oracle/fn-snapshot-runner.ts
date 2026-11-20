/**
 * Single-Function Snapshot Differential Harness (`Plan §3.3`).
 *
 * Bridges the two complementary function-level verification paths required to scale to all
 * `D2Game`/`D2Common` server functions:
 * 1. Offline `fnrec` pre/post sparse-memory block replay (`SparseMemory113c` + write-set verification).
 * 2. Live warm `FnOracleDaemon` (`fnharness v2` `SNAP_CALL` `op 200`) comparing return `eax`,
 *    PRNG `D2SeedStrc`, `D2StatListExStrc` `[base, full]` stats, `STATES` `[active, dirty]`
 *    masks, and outbound `D2Net.#10002` S2C packets, emitting minimal JSON reproducers on mismatch.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SparseMemory113c,
  type FieldLayout113c,
  type Memory113c,
} from '../../src/d2kern-113c/index.ts'
import {
  SNAP_PTR_BUF,
  SNAP_PTR_GAME,
  SNAP_PTR_MONSTER,
  SNAP_PTR_PLAYER,
  type FnOracleDaemon,
  type SnapCallRequest113c,
  type SnapCallResponse113c,
} from './fn-daemon.ts'

export { SNAP_PTR_BUF, SNAP_PTR_GAME, SNAP_PTR_MONSTER, SNAP_PTR_PLAYER }

export interface FnrecCallRecord113c {
  readonly fn: string
  readonly va: number
  readonly frame: number
  readonly args: readonly number[]
  readonly ret?: number
  readonly pre: readonly (readonly [number, string])[]
  readonly post: readonly (readonly [number, string])[]
}

export interface SnapshotExpected113c {
  readonly eax?: number
  readonly gameSeed?: readonly [number, number]
  readonly pSeed?: readonly [number, number]
  readonly qStats?: readonly (readonly [number, number, number])[]
  readonly qStates?: readonly (readonly [number, number, number])[]
  readonly s2cHex?: readonly string[]
}

export interface SnapshotCase113c<TCtx = unknown> {
  readonly label: string
  readonly request: SnapCallRequest113c
  readonly evalTs: () => SnapshotExpected113c
  readonly context?: TCtx
}

export interface SnapshotMismatch113c {
  readonly index: number
  readonly label: string
  readonly field: string
  readonly expected: unknown
  readonly actual: unknown
  readonly request: SnapCallRequest113c
  readonly response: SnapCallResponse113c
}

export interface SnapshotSweepReport113c {
  readonly fnName: string
  readonly totalCases: number
  readonly passedCases: number
  readonly elapsedMs: number
  readonly mismatches: readonly SnapshotMismatch113c[]
  readonly reproducerFiles: readonly string[]
}

/**
 * `Memory113c` wrapper over `SparseMemory113c` that records every post-load written byte address
 * and `alloc()` range so `fnrec` replay verifies:
 * 1. Every pre+post block byte-for-byte.
 * 2. Every written byte inside post-only blocks against the DLL's post block.
 * 3. Zero unexpected writes outside `post` blocks and `alloc()` ranges.
 */
export class TrackedMemory113c implements Memory113c {
  private readonly inner = new SparseMemory113c()
  readonly writtenAddrs = new Set<number>()
  readonly allocRanges: Array<readonly [number, number]> = []

  loadPreBlock(addr: number, data: Uint8Array): void {
    this.inner.loadBlock(addr, data)
  }

  readBytes(addr: number, len: number): Uint8Array {
    return this.inner.readBytes(addr, len)
  }

  alloc(size: number): number {
    const p = this.inner.alloc(size)
    this.allocRanges.push([p, (p + size) >>> 0])
    return p
  }

  u8(p: number): number {
    return this.inner.u8(p)
  }

  u16(p: number): number {
    return this.inner.u16(p)
  }

  u32(p: number): number {
    return this.inner.u32(p)
  }

  setU8(p: number, v: number): void {
    const a = p >>> 0
    this.writtenAddrs.add(a)
    this.inner.setU8(a, v)
  }

  setU16(p: number, v: number): void {
    const a = p >>> 0
    this.writtenAddrs.add(a)
    this.writtenAddrs.add((a + 1) >>> 0)
    this.inner.setU16(a, v)
  }

  setU32(p: number, v: number): void {
    const a = p >>> 0
    this.writtenAddrs.add(a)
    this.writtenAddrs.add((a + 1) >>> 0)
    this.writtenAddrs.add((a + 2) >>> 0)
    this.writtenAddrs.add((a + 3) >>> 0)
    this.inner.setU32(a, v)
  }

  fill(p: number, len: number, v: number): void {
    const base = p >>> 0
    for (let i = 0; i < len; i++) {
      this.writtenAddrs.add((base + i) >>> 0)
    }
    this.inner.fill(base, len, v)
  }

  get(base: number, f: FieldLayout113c, index = 0): number {
    return this.inner.get(base, f, index)
  }

  set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    if (base === 0) throw new Error('SparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`SparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }
}

function decodeHex(h: string): Uint8Array {
  return Uint8Array.from(Buffer.from(h, 'hex'))
}

export function verifyTrackedPostState113c(
  rec: FnrecCallRecord113c,
  m: TrackedMemory113c,
): string | null {
  const preMap = new Map<number, Uint8Array>()
  for (const [rawAddr, h] of rec.pre) {
    if (h !== '') preMap.set(rawAddr >>> 0, decodeHex(h))
  }
  // Identify untouched event-pool free-list lookahead nodes (`*(chunk+0x7080)` -> `oldFree+0x1c`)
  // that `d2oracle` snapshots after `pFreeHead` advances without the callee touching the next node.
  const lookaheadFreeNodes = new Set<number>()
  for (const [, b] of preMap) {
    if (b.length === 8) {
      const oldFree = (b[0]! | (b[1]! << 8) | (b[2]! << 16) | (b[3]! << 24)) >>> 0
      const oldNode = preMap.get(oldFree)
      if (oldNode !== undefined && oldNode.length === 0x30) {
        const nextFree =
          (oldNode[0x1c]! | (oldNode[0x1d]! << 8) | (oldNode[0x1e]! << 16) | (oldNode[0x1f]! << 24)) >>> 0
        if (nextFree !== 0 && !preMap.has(nextFree)) {
          lookaheadFreeNodes.add(nextFree)
        }
      }
    }
  }

  const postSpans: Array<readonly [number, number]> = []
  const usedAllocIndices = new Set<number>()

  for (const [rawAddr, h] of rec.post) {
    if (h === '') continue
    const addr = rawAddr >>> 0
    const want = decodeHex(h)
    postSpans.push([addr, (addr + want.length) >>> 0])

    if (preMap.has(addr)) {
      const got = m.readBytes(addr, want.length)
      for (let i = 0; i < want.length; i++) {
        if (want[i] !== got[i]) {
          return (
            `F${rec.frame} ${rec.fn} args=${JSON.stringify(rec.args)}: ` +
            `block 0x${addr.toString(16)}+0x${i.toString(16)} got 0x${got[i]!.toString(16)}, want 0x${want[i]!.toString(16)}`
          )
        }
      }
    } else {
      // Post-only block: compare the full block bytes against the recorded DLL post dump
      // (either at `addr` or in a matching newly `alloc()`'d block), failing on any missing write or wrong byte.
      let hasDirectWrite = false
      for (let i = 0; i < want.length; i++) {
        if (m.writtenAddrs.has((addr + i) >>> 0)) {
          hasDirectWrite = true
          break
        }
      }
      if (!hasDirectWrite && lookaheadFreeNodes.has(addr)) {
        continue
      }

      let targetAddr = addr
      if (!hasDirectWrite) {
        for (let aIdx = 0; aIdx < m.allocRanges.length; aIdx++) {
          if (usedAllocIndices.has(aIdx)) continue
          const [lo, hi] = m.allocRanges[aIdx]!
          if ((hi - lo) >>> 0 === want.length) {
            targetAddr = lo
            usedAllocIndices.add(aIdx)
            break
          }
        }
      }

      for (let i = 0; i < want.length; i++) {
        const byteAddr = (targetAddr + i) >>> 0
        if (!m.writtenAddrs.has(byteAddr)) {
          return (
            `F${rec.frame} ${rec.fn} args=${JSON.stringify(rec.args)}: ` +
            `post-only block 0x${addr.toString(16)}+0x${i.toString(16)} missing write (want 0x${want[i]!.toString(16)})`
          )
        }
        const gotByte = m.u8(byteAddr)
        if (want[i] !== gotByte) {
          return (
            `F${rec.frame} ${rec.fn} args=${JSON.stringify(rec.args)}: ` +
            `post-only block 0x${addr.toString(16)}+0x${i.toString(16)} got 0x${gotByte.toString(16)}, want 0x${want[i]!.toString(16)}`
          )
        }
      }
    }
  }

  for (const wAddr of m.writtenAddrs) {
    let covered = false
    for (let i = 0; i < postSpans.length; i++) {
      const [lo, hi] = postSpans[i]!
      if (wAddr >= lo && wAddr < hi) {
        covered = true
        break
      }
    }
    if (!covered) {
      for (let i = 0; i < m.allocRanges.length; i++) {
        const [lo, hi] = m.allocRanges[i]!
        if (wAddr >= lo && wAddr < hi) {
          covered = true
          break
        }
      }
    }
    if (!covered) {
      return (
        `F${rec.frame} ${rec.fn} args=${JSON.stringify(rec.args)}: ` +
        `unexpected write outside recorded post blocks at 0x${wAddr.toString(16)}`
      )
    }
  }

  return null
}

/**
 * Replay a recorded `fnrec` pre/post memory record through a TypeScript port operating on `Memory113c`.
 * Returns `null` when every pre/post block and write-set check matches identically, or a diagnostic string on mismatch.
 */
export function runFnrecDifferential113c(
  rec: FnrecCallRecord113c,
  invokeTs: (m: Memory113c, args: readonly number[]) => number | void,
): string | null {
  const m = new TrackedMemory113c()
  for (const [addr, h] of rec.pre) {
    if (h !== '') m.loadPreBlock(addr >>> 0, decodeHex(h))
  }
  let tsRet: number | void
  try {
    tsRet = invokeTs(m, rec.args)
  } catch (err) {
    return `F${rec.frame} ${rec.fn}: TS threw ${(err as Error).message}`
  }
  if (rec.ret !== undefined && tsRet !== undefined && (tsRet | 0) !== (rec.ret | 0)) {
    return `F${rec.frame} ${rec.fn}: eax got ${tsRet | 0}, want ${rec.ret | 0}`
  }
  return verifyTrackedPostState113c(rec, m)
}

/**
 * Execute a batch of `SnapshotCase113c` against the warm `FnOracleDaemon` (`SNAP_CALL` `op 200`)
 * and compare against the TypeScript kernel's expected outputs, writing minimal JSON reproducers
 * if `reproducerDir` is supplied.
 */
export async function runLiveSnapshotSweep113c(
  daemon: FnOracleDaemon,
  fnName: string,
  cases: readonly SnapshotCase113c[],
  reproducerDir?: string,
): Promise<SnapshotSweepReport113c> {
  if (cases.length === 0) {
    return {
      fnName,
      totalCases: 0,
      passedCases: 0,
      elapsedMs: 0,
      mismatches: [],
      reproducerFiles: [],
    }
  }

  const requests = cases.map((c) => c.request)
  const { responses, elapsedMs } = await daemon.execSnapBatch(requests)

  const mismatches: SnapshotMismatch113c[] = []
  const reproducerFiles: string[] = []
  let passedCases = 0

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!
    const resp = responses[i]!
    const exp = c.evalTs()
    let failed = false

    const recordMismatch = (field: string, expected: unknown, actual: unknown): void => {
      failed = true
      const mm: SnapshotMismatch113c = {
        index: i,
        label: c.label,
        field,
        expected,
        actual,
        request: c.request,
        response: resp,
      }
      mismatches.push(mm)
      if (reproducerDir && reproducerFiles.length < 20) {
        mkdirSync(reproducerDir, { recursive: true })
        const safeName = `${fnName.replace(/[^a-zA-Z0-9_-]/g, '_')}-case-${i}.json`
        const outPath = join(reproducerDir, safeName)
        writeFileSync(outPath, JSON.stringify(mm, null, 2) + '\n')
        reproducerFiles.push(outPath)
      }
    }

    if (resp.fault !== 0) {
      recordMismatch('fault', 0, resp.fault)
      continue
    }
    if (exp.eax !== undefined && (resp.eax | 0) !== (exp.eax | 0)) {
      recordMismatch('eax', exp.eax | 0, resp.eax | 0)
    }
    if (
      exp.gameSeed !== undefined &&
      (resp.gameSeed[0] !== exp.gameSeed[0] >>> 0 || resp.gameSeed[1] !== exp.gameSeed[1] >>> 0)
    ) {
      recordMismatch('gameSeed', [exp.gameSeed[0] >>> 0, exp.gameSeed[1] >>> 0], resp.gameSeed)
    }
    if (
      exp.pSeed !== undefined &&
      (resp.pSeed[0] !== exp.pSeed[0] >>> 0 || resp.pSeed[1] !== exp.pSeed[1] >>> 0)
    ) {
      recordMismatch('pSeed', [exp.pSeed[0] >>> 0, exp.pSeed[1] >>> 0], resp.pSeed)
    }
    if (exp.qStats !== undefined && JSON.stringify(resp.qStats) !== JSON.stringify(exp.qStats)) {
      recordMismatch('qStats', exp.qStats, resp.qStats)
    }
    if (exp.qStates !== undefined && JSON.stringify(resp.qStates) !== JSON.stringify(exp.qStates)) {
      recordMismatch('qStates', exp.qStates, resp.qStates)
    }
    if (exp.s2cHex !== undefined) {
      const gotHex = resp.s2c.map((p) => p.hex)
      if (JSON.stringify(gotHex) !== JSON.stringify(exp.s2cHex)) {
        recordMismatch('s2cHex', exp.s2cHex, gotHex)
      }
    }

    if (!failed) passedCases++
  }

  return {
    fnName,
    totalCases: cases.length,
    passedCases,
    elapsedMs,
    mismatches,
    reproducerFiles,
  }
}
