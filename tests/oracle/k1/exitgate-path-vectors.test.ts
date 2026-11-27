import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { FOG_SIN_TABLE } from '../../../src/client/weather/fog-sin-table.ts'
import * as d2kern from '../../../src/d2kern-113c/index.ts'
import {
  D2CommonAssertError,
  PATH_AllocDynamicPath113c,
  PATH_Compute113c,
  PATH_SetTargetPos113c,
  PATH_SetType113c,
  SparseMemory113c,
  type FieldLayout113c,
  type Memory113c,
} from '../../../src/d2kern-113c/index.ts'
import {
  PATH_META_MAGIC,
  PATH_PREFLAG_SET_PREV_TYPE,
  PATH_PREFLAG_SET_TARGET_UNIT,
  PATH_PREFLAG_SET_VELOCITY,
  PATH_PREFLAG_SKIP_SET_TYPE,
  type PageImageRecord,
  type PathVectorRecord,
  type PathWorldMetaHeader,
  loadPathWorldIntoMemory,
  parsePathVectors,
  parsePathWorldImage,
} from '../../../tools/oracle/vectors/path-vector.ts'
import { parseDrlgCollFile } from '../../../tools/oracle/vectors/drlg-vector.ts'
import { D2TV_MAGIC } from '../../../tools/oracle/vectors/vector-format.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const FIXTURES_DIR = resolve(REPO_ROOT, 'tests/fixtures/oracle/vectors')
const MANIFEST_PATH = resolve(REPO_ROOT, 'tools/oracle/callgraph/manifest-113c.json')

const PINNED_SHA256 = {
  vectorsRaw: 'eb59554dc7b5d0bb4e79211c8042fa24ca1a5a6e61e56fd3a919c9ec7d9068dc',
  worldImgRaw: '7938797317be1ce51e911a6788ceb886fa8437d5c59bb0230a2b18520546123b',
} as const

const PATH_ENTRY_VAS = ['0x6FD86030', '0x6FD86230', '0x6FD84F80', '0x6FD849D0'] as const

const HANDLER_BY_PATHTYPE: Readonly<Record<number, string>> = {
  0: '0x6FDC0E40',
  1: '0x6FDCB630',
  2: '0x6FDB78B0',
  3: '0x6FDB7B70',
  4: '0x6FD85780',
  5: '0x6FDB78B0',
  6: '0x6FDB78B0',
  7: '0x6FDB7AD0',
  8: '0x6FDB7390',
  9: '0x6FDB77F0',
  10: '0x6FD85780',
  11: '0x6FDB77C0',
  12: '0x6FDB7850',
  13: '0x6FDB78B0',
  14: '0x6FD85780',
  15: '0x6FD68C40',
  16: '0x6FDC0E40',
  17: '0x6FD86230',
}

interface ManifestFunctionEntry {
  va: string
  name: string
  module: string
  size: number
  status: 'unported' | 'ported' | 'diff-verified'
  tsSymbol?: string | null
  kernFile?: string | null
  callees?: string[]
}

interface ManifestFile {
  functions: ManifestFunctionEntry[]
}

interface ClosureInfo {
  entryVas: string[]
  totalFunctions: number
  portedFunctions: number
  unportedFunctions: number
  unportedBytes: number
  unportedVas: string[]
  portedEntries: ManifestFunctionEntry[]
}

interface ExpectedDivergenceItem {
  status: 'blocked' | 'diverge'
  reason: string
  vas?: string[]
}

interface ExpectedDivergenceFile {
  schema: number
  closures: Record<
    string,
    {
      entryVas: string[]
      totalFunctions: number
      portedFunctions: number
      unportedFunctions: number
      unportedBytes: number
      unportedVas: string[]
    }
  >
  items: Record<string, ExpectedDivergenceItem>
}

function normalizeVa(va: string): string {
  const stripped = va.includes(':') ? va.split(':', 2)[1]! : va
  const hex = stripped.toLowerCase().startsWith('0x') ? stripped.slice(2) : stripped
  return `0x${hex.toUpperCase()}`
}

function computeManifestClosure(
  byVa: ReadonlyMap<string, ManifestFunctionEntry>,
  entryVas: readonly string[],
): ClosureInfo {
  const visited = new Map<string, ManifestFunctionEntry>()
  const queue = entryVas.map(normalizeVa)
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (visited.has(cur)) continue
    const fn = byVa.get(cur)
    if (!fn) continue
    visited.set(cur, fn)
    for (const callee of fn.callees ?? []) {
      const cva = normalizeVa(callee)
      if (!visited.has(cva) && byVa.has(cva)) {
        queue.push(cva)
      }
    }
  }
  const unportedVas: string[] = []
  const portedEntries: ManifestFunctionEntry[] = []
  let unportedBytes = 0
  for (const [va, fn] of [...visited.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (fn.status === 'unported') {
      unportedVas.push(va)
      unportedBytes += fn.size
    } else {
      portedEntries.push(fn)
    }
  }
  return {
    entryVas: entryVas.map(normalizeVa),
    totalFunctions: visited.size,
    portedFunctions: portedEntries.length,
    unportedFunctions: unportedVas.length,
    unportedBytes,
    unportedVas,
    portedEntries,
  }
}

export interface LivePathStatus {
  status: 'match' | 'diverge' | 'blocked'
  reason: string
  vas: string[]
}

export function verifyPathRatchet(
  liveByIdx: ReadonlyMap<string, LivePathStatus>,
  expected: ExpectedDivergenceFile,
  liveClosure: ClosureInfo,
): { matchCount: number; blockedCount: number; divergeCount: number } {
  if (expected.schema !== 1) {
    throw new Error(`Unsupported expected-divergence schema: ${expected.schema}`)
  }
  const expCl = expected.closures['path']
  if (!expCl) {
    throw new Error(`Missing closure 'path' in path-expected-divergence.json`)
  }
  if (
    expCl.unportedVas.length !== liveClosure.unportedVas.length ||
    expCl.unportedVas.some((v, idx) => v !== liveClosure.unportedVas[idx])
  ) {
    throw new Error(
      `Closure 'path' unportedVas mismatch: expected ${expCl.unportedVas.length} VAs, live manifest has ${liveClosure.unportedVas.length}`,
    )
  }

  let matchCount = 0
  let blockedCount = 0
  let divergeCount = 0

  for (const [key, live] of liveByIdx.entries()) {
    const exp = expected.items[key]
    if (live.status === 'match') {
      matchCount++
      if (exp) {
        throw new Error(
          `Ratchet violation (b): vector '${key}' now matches real DLL; remove it from path-expected-divergence.json`,
        )
      }
      continue
    }

    if (live.status === 'blocked') blockedCount++
    else divergeCount++

    if (!exp) {
      throw new Error(
        `Ratchet violation (a): unlisted vector '${key}' has non-match status '${live.status}' (${live.reason})`,
      )
    }
    if (exp.status !== live.status) {
      throw new Error(
        `Ratchet violation: vector '${key}' expected status '${exp.status}', got '${live.status}'`,
      )
    }
    if (live.status === 'blocked') {
      const expVas = exp.vas ?? []
      if (expVas.length !== live.vas.length || expVas.some((v, i) => v !== live.vas[i])) {
        throw new Error(
          `Ratchet violation (c): blocked vector '${key}' VA list mismatch: expected [${expVas.join(',')}], live [${live.vas.join(',')}]`,
        )
      }
    }
  }

  for (const key of Object.keys(expected.items)) {
    if (!liveByIdx.has(key)) {
      throw new Error(`Ratchet violation: stale vector key '${key}' in path-expected-divergence.json`)
    }
  }

  return { matchCount, blockedCount, divergeCount }
}

class FastPageMemory113c implements Memory113c {
  private static readonly PAGE_BITS = 12
  private static readonly PAGE_SIZE = 1 << FastPageMemory113c.PAGE_BITS
  private readonly basePages = new Map<number, Uint8Array>()
  private readonly baseKnown = new Map<number, Uint8Array>()
  private readonly pages = new Map<number, Uint8Array>()
  private readonly known = new Map<number, Uint8Array>()
  private readonly dirty = new Set<number>()
  private allocTop = 0x40000000

  loadBasePage(va: number, data: Uint8Array): void {
    const page = (va >>> 0) >>> FastPageMemory113c.PAGE_BITS
    const pCopy = data.slice()
    const kCopy = new Uint8Array(FastPageMemory113c.PAGE_SIZE)
    kCopy.fill(1)
    this.basePages.set(page, pCopy)
    this.baseKnown.set(page, kCopy)
    this.pages.set(page, pCopy.slice())
    this.known.set(page, kCopy.slice())
  }

  writeBaseU32(addr: number, v: number): void {
    this.setU32(addr, v)
    const a = addr >>> 0
    for (let i = 0; i < 4; i++) {
      const byteAddr = (a + i) >>> 0
      const page = byteAddr >>> FastPageMemory113c.PAGE_BITS
      let bp = this.basePages.get(page)
      let bk = this.baseKnown.get(page)
      if (!bp || !bk) {
        bp = new Uint8Array(FastPageMemory113c.PAGE_SIZE)
        bk = new Uint8Array(FastPageMemory113c.PAGE_SIZE)
        this.basePages.set(page, bp)
        this.baseKnown.set(page, bk)
      }
      bp[byteAddr & (FastPageMemory113c.PAGE_SIZE - 1)] = (v >>> (i * 8)) & 0xff
      bk[byteAddr & (FastPageMemory113c.PAGE_SIZE - 1)] = 1
    }
    this.dirty.clear()
  }

  reset(): void {
    for (const page of this.dirty) {
      const bp = this.basePages.get(page)
      const bk = this.baseKnown.get(page)
      if (bp && bk) {
        this.pages.get(page)!.set(bp)
        this.known.get(page)!.set(bk)
      } else {
        this.pages.delete(page)
        this.known.delete(page)
      }
    }
    this.dirty.clear()
    this.allocTop = 0x40000000
  }

  alloc(size: number): number {
    if ((size >>> 0) === 0) return 0
    const p = ((this.allocTop + 3) & ~3) >>> 0
    this.fill(p, size, 0)
    this.allocTop = (p + size) >>> 0
    return p
  }

  private readByte(a: number): number {
    const addr = a >>> 0
    const page = addr >>> FastPageMemory113c.PAGE_BITS
    const k = this.known.get(page)
    if (k === undefined || k[addr & (FastPageMemory113c.PAGE_SIZE - 1)] === 0) {
      throw new Error(`FastPageMemory113c: read of unloaded byte 0x${addr.toString(16)}`)
    }
    return this.pages.get(page)![addr & (FastPageMemory113c.PAGE_SIZE - 1)]!
  }

  private writeByte(a: number, v: number): void {
    const addr = a >>> 0
    const page = addr >>> FastPageMemory113c.PAGE_BITS
    let data = this.pages.get(page)
    let k = this.known.get(page)
    if (data === undefined || k === undefined) {
      data = new Uint8Array(FastPageMemory113c.PAGE_SIZE)
      k = new Uint8Array(FastPageMemory113c.PAGE_SIZE)
      this.pages.set(page, data)
      this.known.set(page, k)
    }
    this.dirty.add(page)
    data[addr & (FastPageMemory113c.PAGE_SIZE - 1)] = v
    k[addr & (FastPageMemory113c.PAGE_SIZE - 1)] = 1
  }

  u8(p: number): number {
    return this.readByte(p)
  }
  u16(p: number): number {
    return this.readByte(p) | (this.readByte(p + 1) << 8)
  }
  u32(p: number): number {
    return (this.u16(p) | (this.u16(p + 2) << 16)) >>> 0
  }
  setU8(p: number, v: number): void {
    this.writeByte(p, v & 0xff)
  }
  setU16(p: number, v: number): void {
    this.writeByte(p, v & 0xff)
    this.writeByte(p + 1, (v >>> 8) & 0xff)
  }
  setU32(p: number, v: number): void {
    this.setU16(p, v & 0xffff)
    this.setU16(p + 2, (v >>> 16) & 0xffff)
  }
  fill(p: number, len: number, v: number): void {
    for (let i = 0; i < len; i++) this.writeByte(p + i, v & 0xff)
  }
  get(base: number, f: FieldLayout113c, index = 0): number {
    const { p, width } = this.addr(base, f, index)
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }
  set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    const { p, width } = this.addr(base, f, index)
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }
  private addr(base: number, f: FieldLayout113c, index: number): { p: number; width: number } {
    if (base === 0) throw new Error('FastPageMemory113c: NULL base')
    if (index < 0 || index >= f.count) throw new Error(`FastPageMemory113c: index ${index} out of range`)
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    return { p: (base + f.off + index * width) >>> 0, width }
  }
}

function replayAllPathVectorsStage1To4(
  records: readonly PathVectorRecord[],
  meta: PathWorldMetaHeader,
  pages: readonly PageImageRecord[],
  byVa: ReadonlyMap<string, ManifestFunctionEntry>,
): { liveByIdx: Map<string, LivePathStatus>; errors: number } {
  const mem = new FastPageMemory113c()
  for (const page of pages) {
    mem.loadBasePage(page.va, page.data)
  }
  const pBitMasks = mem.u32(0x6fdd90b0)
  for (let i = 0; i < 32; i++) {
    mem.writeBaseU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  const fogDllCandidates = [
    ...(process.env.D2_DATA_DIR ? [resolve(process.env.D2_DATA_DIR, 'Fog.dll')] : []),
    resolve(REPO_ROOT, 'samples/d2/Fog.dll'),
    resolve(homedir(), 'd2-data/Fog.dll'),
  ]
  const fogDllPath = fogDllCandidates.find((p) => existsSync(p))
  if (fogDllPath) {
    const fogDll = readFileSync(fogDllPath)
    for (let i = 0; i < 512; i++) {
      mem.writeBaseU32((0x6ff7f470 + i * 4) >>> 0, fogDll.readUInt32LE(0x2f470 + i * 4))
    }
  } else {
    const dv = new DataView(new ArrayBuffer(4))
    for (let i = 0; i < 512; i++) {
      dv.setFloat32(0, FOG_SIN_TABLE[i]!, true)
      mem.writeBaseU32((0x6ff7f470 + i * 4) >>> 0, dv.getUint32(0, true))
    }
  }

  const findRoomForPos = (x: number, y: number): number => {
    for (const r of meta.activeRoomVas) {
      const rx = mem.u32(r + 0x4c) | 0
      const ry = mem.u32(r + 0x50) | 0
      const rw = mem.u32(r + 0x54) | 0
      const rh = mem.u32(r + 0x58) | 0
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return r
    }
    return meta.activeRoomVas[0]!
  }

  const liveByIdx = new Map<string, LivePathStatus>()
  let errors = 0

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]!
    const candVas =
      rec.faultStage === 2
        ? ['0x6FD86030', '0x6FD84F80']
        : ['0x6FD86030', '0x6FD84F80', '0x6FD849D0', '0x6FD86230', HANDLER_BY_PATHTYPE[rec.pathType]!]
    const unpVas = [...new Set(candVas.filter((va) => byVa.get(va)?.status === 'unported'))].sort()
    if (unpVas.length > 0) {
      liveByIdx.set(String(i), {
        status: 'blocked',
        reason: 'path',
        vas: unpVas,
      })
      continue
    }

    mem.reset()
    const startRoom = findRoomForPos(rec.startX, rec.startY)
    const pUnit = meta.pUnitVa
    const pTargetUnit = meta.pTargetUnitVa
    mem.fill(pUnit, 0x100, 0)
    mem.setU32(pUnit + 0x00, rec.unitType)
    mem.setU32(pUnit + 0x04, rec.classId)
    mem.setU32(pUnit + 0x0c, 1)
    mem.setU32(pUnit + 0x10, 1)
    mem.setU32(pUnit + 0x20, rec.unitSeedLo)
    mem.setU32(pUnit + 0x24, 666)

    mem.fill(pTargetUnit, 0x200, 0)
    const pTgtPath = (pTargetUnit + 0x100) >>> 0
    if (rec.preFlags & PATH_PREFLAG_SET_TARGET_UNIT) {
      const tx = (rec.startX + rec.targetDx) & 0xffff
      const ty = (rec.startY + rec.targetDy) & 0xffff
      mem.setU32(pTargetUnit + 0x00, 1)
      mem.setU32(pTargetUnit + 0x04, 1)
      mem.setU32(pTargetUnit + 0x0c, 2)
      mem.setU32(pTargetUnit + 0x10, 1)
      mem.setU32(pTargetUnit + 0x2c, pTgtPath)
      mem.setU16(pTgtPath + 0x02, tx)
      mem.setU16(pTgtPath + 0x06, ty)
      mem.setU32(pTgtPath + 0x1c, startRoom)
    }

    let tsRet = -1
    let tsFaultKind = 0
    let tsFaultStage = 0
    let tsFaultLine = 0
    let pPath = 0

    try {
      PATH_AllocDynamicPath113c(
        mem,
        0,
        startRoom,
        rec.startX,
        rec.startY,
        pUnit,
        rec.bAllocFlag,
      )
      pPath = mem.u32(pUnit + 0x2c)
      if (!pPath) {
        tsFaultStage = 1
        tsRet = -1
      } else {
        if (rec.nDistMax !== 0xff) mem.setU8(pPath + 0x91, rec.nDistMax)
        if (rec.nStepNum !== 0) mem.setU8(pPath + 0x90, rec.nStepNum)
        if (rec.preFlags & PATH_PREFLAG_SET_PREV_TYPE) mem.setU32(pPath + 0x3c, rec.prevPathType)
        if (rec.preFlags & PATH_PREFLAG_SET_TARGET_UNIT) mem.setU32(pPath + 0x58, pTargetUnit)
        if (rec.preFlags & PATH_PREFLAG_SET_VELOCITY) mem.setU32(pPath + 0x7c, rec.velOverride >>> 0)

        if (!(rec.preFlags & PATH_PREFLAG_SKIP_SET_TYPE)) {
          try {
            PATH_SetType113c(mem, pPath, rec.pathType)
          } catch (e) {
            if (e instanceof D2CommonAssertError) {
              tsFaultKind = 2
              tsFaultStage = 2
              tsFaultLine = e.line
              tsRet = -1
            } else {
              throw e
            }
          }
        }

        if (tsFaultKind === 0) {
          if (rec.nStepNum !== 0) mem.setU8(pPath + 0x90, rec.nStepNum)
          if (rec.nDistMax !== 0xff) mem.setU8(pPath + 0x91, rec.nDistMax)

          try {
            PATH_SetTargetPos113c(mem, pPath, rec.targetX, rec.targetY)
          } catch (e) {
            if (e instanceof D2CommonAssertError) {
              tsFaultKind = 2
              tsFaultStage = 3
              tsFaultLine = e.line
              tsRet = -1
            } else {
              throw e
            }
          }
        }

        if (tsFaultKind === 0) {
          try {
            tsRet = PATH_Compute113c(mem, pPath, pUnit, rec.a2) | 0
          } catch (e) {
            if (e instanceof D2CommonAssertError) {
              tsFaultKind = 2
              tsFaultStage = 4
              tsFaultLine = e.line
              tsRet = -1
            } else {
              throw e
            }
          }
        }
      }
    } catch (e) {
      errors++
      liveByIdx.set(String(i), {
        status: 'diverge',
        reason: `idx=${i} t=${rec.pathType} exception: ${(e as Error).message}`,
        vas: [],
      })
      continue
    }

    if (
      tsFaultKind !== rec.faultKind ||
      tsFaultStage !== rec.faultStage ||
      (tsFaultKind === 2 && tsFaultLine !== rec.faultLine)
    ) {
      liveByIdx.set(String(i), {
        status: 'diverge',
        reason: `idx=${i} t=${rec.pathType} fault=(${tsFaultKind},${tsFaultStage},${tsFaultLine}) expected=(${rec.faultKind},${rec.faultStage},${rec.faultLine})`,
        vas: [],
      })
      continue
    }

    if (tsFaultKind === 2) {
      liveByIdx.set(String(i), { status: 'match', reason: 'path', vas: [] })
      continue
    }

    const tsPathPoints = mem.u32(pPath + 0x28)
    const tsFlags = mem.u32(pPath + 0x34)
    const tsPathType = mem.u32(pPath + 0x3c)
    const tsPrevPathType = mem.u32(pPath + 0x40)
    const tsOutTargetX = mem.u32(pPath + 0x10) | 0
    const tsOutTargetY = mem.u32(pPath + 0x14) | 0
    const tsCurIdx = mem.u32(pPath + 0x24)
    const tsDir = mem.u8(pPath + 0x64)
    const tsNewDir = mem.u8(pPath + 0x65)

    let ptsMatch = tsPathPoints === rec.dwPathPoints
    if (ptsMatch) {
      for (let j = 0; j < tsPathPoints && j < 78; j++) {
        const px = mem.u16(pPath + 0x9c + j * 4)
        const py = mem.u16(pPath + 0x9c + j * 4 + 2)
        if (px !== rec.pathPoints[j]!.x || py !== rec.pathPoints[j]!.y) {
          ptsMatch = false
          break
        }
      }
    }

    if (
      tsRet !== rec.ret ||
      !ptsMatch ||
      tsFlags !== rec.dwFlags ||
      tsPathType !== rec.dwPathType ||
      tsPrevPathType !== rec.dwPrevPathType ||
      tsOutTargetX !== rec.outTargetX ||
      tsOutTargetY !== rec.outTargetY ||
      tsCurIdx !== rec.dwCurrentPointIdx ||
      tsDir !== rec.nDirection ||
      tsNewDir !== rec.nNewDirection
    ) {
      liveByIdx.set(String(i), {
        status: 'diverge',
        reason: `idx=${i} t=${rec.pathType} ret=${tsRet}/${rec.ret} pts=${tsPathPoints}/${rec.dwPathPoints} ptsMatch=${ptsMatch}`,
        vas: [],
      })
      continue
    }

    liveByIdx.set(String(i), { status: 'match', reason: 'path', vas: [] })
  }

  return { liveByIdx, errors }
}

describe('[K1-6] PATH Real-DLL D2TV Vector Suite, World Image & Closure Ratchet', () => {
  const vecGzPath = resolve(FIXTURES_DIR, 'path-vectors-113c.d2tv.gz')
  const imgGzPath = resolve(FIXTURES_DIR, 'path-world-town-s12345.img.gz')
  const collGzPath = resolve(FIXTURES_DIR, 'drlg-coll-towns-s12345-d0.d2tv.gz')
  const expectedPath = resolve(FIXTURES_DIR, 'path-expected-divergence.json')

  const vecGz = readFileSync(vecGzPath)
  const imgGz = readFileSync(imgGzPath)
  const collGz = readFileSync(collGzPath)

  const vecRaw = new Uint8Array(gunzipSync(vecGz))
  const imgRaw = new Uint8Array(gunzipSync(imgGz))
  const collRaw = new Uint8Array(gunzipSync(collGz))

  const parsedVec = parsePathVectors(vecRaw)
  const parsedImg = parsePathWorldImage(imgRaw)
  const parsedColl = parseDrlgCollFile(collRaw)

  it('pins D2TV headers, record sizes, counts, gzip size budgets, and raw SHA-256 digests', () => {
    expect(vecGz.byteLength).toBeLessThanOrEqual(1024 * 1024)
    expect(imgGz.byteLength).toBeLessThanOrEqual(1024 * 1024)

    const shaVec = createHash('sha256').update(vecRaw).digest('hex')
    const shaImg = createHash('sha256').update(imgRaw).digest('hex')

    expect(shaVec).toBe(PINNED_SHA256.vectorsRaw)
    expect(shaImg).toBe(PINNED_SHA256.worldImgRaw)

    expect(parsedVec.header.magic).toBe(D2TV_MAGIC)
    expect(parsedVec.header.version).toBe(1)
    expect(parsedVec.header.flags).toBe(1)
    expect(parsedVec.header.kind).toBe('PATHVEC')
    expect(parsedVec.header.recordSize).toBe(460)
    expect(parsedVec.header.recordCount).toBe(6924)
    expect(parsedVec.header.seed).toBe(12345n)

    expect(parsedImg.header.magic).toBe(D2TV_MAGIC)
    expect(parsedImg.header.version).toBe(1)
    expect(parsedImg.header.flags).toBe(1)
    expect(parsedImg.header.kind).toBe('PAGEIMG')
    expect(parsedImg.header.recordSize).toBe(4100)
    expect(parsedImg.header.recordCount).toBe(66)
    expect(parsedImg.header.seed).toBe(12345n)

    expect(parsedImg.meta.magic).toBe(PATH_META_MAGIC)
    expect(parsedImg.meta.version).toBe(1)
    expect(parsedImg.meta.seed).toBe(12345)
    expect(parsedImg.meta.diff).toBe(0)
    expect(parsedImg.meta.nActiveRooms).toBe(35)
    expect(parsedImg.meta.activeRoomVas.length).toBe(35)
    expect(parsedImg.pages.length).toBe(65) // 55 arena pages + 10 D2Common pages
  })

  it('verifies full PATHTYPE 0..17 coverage table, positive returns for 0..16, and documented Fog.#10024 asserts', () => {
    const nonFaultByType = new Array<number>(18).fill(0)
    const posRetByType = new Array<number>(18).fill(0)
    const assertByType = new Array<number>(18).fill(0)
    const maxPtsByType = new Array<number>(18).fill(0)

    for (const rec of parsedVec.records) {
      expect(rec.pathType).toBeGreaterThanOrEqual(0)
      expect(rec.pathType).toBeLessThan(18)
      // Zero hardware access violations across all 6,924 vectors
      expect(rec.faultKind).not.toBe(1)

      if (rec.faultKind === 0) {
        nonFaultByType[rec.pathType]!++
        if (rec.ret > 0 && rec.dwPathPoints > 0) {
          posRetByType[rec.pathType]!++
          if (rec.dwPathPoints > maxPtsByType[rec.pathType]!) {
            maxPtsByType[rec.pathType] = rec.dwPathPoints
          }
          expect(rec.dwPathPoints).toBeLessThanOrEqual(78)
        }
      } else if (rec.faultKind === 2) {
        assertByType[rec.pathType]!++
        expect(rec.faultCode).toBe(0xe0000024)
      }
    }

    // Every PATHTYPE 0..16 must have positive-return vectors (ret > 0 && dwPathPoints > 0)
    for (let t = 0; t <= 16; t++) {
      expect(nonFaultByType[t], `PATHTYPE ${t} nonFault count`).toBeGreaterThan(0)
      expect(posRetByType[t], `PATHTYPE ${t} posRet count`).toBeGreaterThan(0)
    }

    // Specific PATHTYPE coverage invariants
    expect(posRetByType[0]).toBe(148) // IDA* (>=2 corners required by 0x6FDC0650)
    expect(posRetByType[1]).toBe(318) // A*
    expect(posRetByType[2]).toBe(160) // TOWARD (valid on monsters)
    expect(assertByType[2]).toBe(181) // TOWARD asserts at line 0x861 (2145) on players
    expect(posRetByType[4]).toBe(360) // MON_CIRCLE (requires nDistMax < 0x4E)
    expect(assertByType[4]).toBe(2) // asserts at line 0x873 (2163) when nDistMax >= 0x4E
    expect(posRetByType[8]).toBe(315) // KNOCKBACK_SERVER
    expect(posRetByType[9]).toBe(264) // LEAP
    expect(posRetByType[10]).toBe(384) // FLEE
    expect(posRetByType[11]).toBe(262) // KNOCKBACK_CLIENT
    expect(posRetByType[14]).toBe(384) // BLESSEDHAMMER (77-point spiral)
    expect(maxPtsByType[14]).toBe(77)
    expect(posRetByType[17]).toBe(0) // NULL handler in 0x6FDDE360
    expect(assertByType[17]).toBe(318) // asserts at line 0x37E (894) via IsBadCodePtr(NULL)

    // Verify the 12 explicit pre-state / assert edge-case records (indices 6912..6923)
    const expPrev11 = parsedVec.records[6912]!
    expect(expPrev11.preFlags & PATH_PREFLAG_SET_PREV_TYPE).toBeTruthy()
    expect(expPrev11.prevPathType).toBe(11)
    expect(expPrev11.faultKind).toBe(0)
    expect(expPrev11.dwPrevPathType).toBe(0) // pathType 0 has no 0x2000 bit in gdwPathTypeFlags
    expect(expPrev11.ret).toBeGreaterThan(0)

    const expPrev8 = parsedVec.records[6914]!
    expect(expPrev8.preFlags & PATH_PREFLAG_SET_PREV_TYPE).toBeTruthy()
    expect(expPrev8.prevPathType).toBe(8)
    expect(expPrev8.faultKind).toBe(0)
    expect(expPrev8.dwPrevPathType).toBe(0)
    expect(expPrev8.ret).toBeGreaterThan(0)

    const expDistMax = parsedVec.records[6916]!
    expect(expDistMax.pathType).toBe(4)
    expect(expDistMax.nDistMax).toBe(0x4e)
    expect(expDistMax.faultKind).toBe(2)
    expect(expDistMax.faultStage).toBe(2)
    expect(expDistMax.faultLine).toBe(0x873) // 2163

    const expAllocFlag = parsedVec.records[6918]!
    expect(expAllocFlag.bAllocFlag).toBe(1)
    expect(expAllocFlag.dwFlags & 0x10).toBe(0x10)

    const expVel = parsedVec.records[6920]!
    expect(expVel.preFlags & PATH_PREFLAG_SET_VELOCITY).toBeTruthy()
    expect(expVel.dwPrevPathType).toBe(7) // pathType 9 (LEAP) has 0x2000 bit -> saves prev type 7
    expect(expVel.ret).toBeGreaterThan(0)

    const expSkipPlayer = parsedVec.records[6922]!
    expect(expSkipPlayer.preFlags & PATH_PREFLAG_SKIP_SET_TYPE).toBeTruthy()
    expect(expSkipPlayer.dwPathType).toBe(7)

    const expSkipMon = parsedVec.records[6923]!
    expect(expSkipMon.preFlags & PATH_PREFLAG_SKIP_SET_TYPE).toBeTruthy()
    expect(expSkipMon.dwPathType).toBe(2)
  })

  it('loads PAGEIMG into SparseMemory113c, verifies L1 ActiveRooms/CollisionGrids, and replays ported PATH_SetType113c + PATH_SetTargetPos113c', () => {
    const mem = new SparseMemory113c()
    loadPathWorldIntoMemory(mem, parsedImg.pages)

    const { meta } = parsedImg
    expect(mem.u32(meta.pActVa + 0x0c)).toBe(12345) // pAct->dwInitSeed
    expect(mem.u32(meta.pActVa + 0x48)).toBe(meta.pDrlgVa) // pAct->pDrlg
    expect(mem.u32(meta.pLevelVa + 0x1d0)).toBe(1) // pLevel->dwLevelNo == 1 (Rogue Encampment)

    // Cross-verify the 35 ActiveRooms and their CollisionGrids in SparseMemory113c against DRLGCOLL L1 (first 35 records)
    const loadedPageSet = new Set<number>(parsedImg.pages.map((p) => p.va >>> 12))
    const l1Colls = parsedColl.records.slice(0, 35)
    expect(l1Colls.length).toBe(35)
    let roomsWithTouchedMap = 0
    for (let i = 0; i < 35; i++) {
      const roomVa = meta.activeRoomVas[i]!
      const pColl = mem.u32(roomVa + 0x20)
      expect(pColl).toBeGreaterThan(0)
      const subX = mem.u32(pColl + 0x00) | 0
      const subY = mem.u32(pColl + 0x04) | 0
      const subW = mem.u32(pColl + 0x08) | 0
      const subH = mem.u32(pColl + 0x0c) | 0
      const pMap = mem.u32(pColl + 0x20)

      expect(subX).toBe(l1Colls[i]!.nSubtileX)
      expect(subY).toBe(l1Colls[i]!.nSubtileY)
      expect(subW).toBe(40)
      expect(subH).toBe(40)

      // Check 16-bit subtile collision cells on all rooms whose map pages were touched by the 6,924 vectors
      if (
        loadedPageSet.has(pMap >>> 12) &&
        loadedPageSet.has((pMap + 799 * 2) >>> 12) &&
        loadedPageSet.has((pMap + 1599 * 2) >>> 12)
      ) {
        expect(mem.u16(pMap)).toBe(l1Colls[i]!.mapWords[0])
        expect(mem.u16(pMap + 799 * 2)).toBe(l1Colls[i]!.mapWords[799])
        expect(mem.u16(pMap + 1599 * 2)).toBe(l1Colls[i]!.mapWords[1599])
        roomsWithTouchedMap++
      }
    }
    expect(roomsWithTouchedMap).toBe(18)

    // Replay ported Stage 2 (#10647 PATH_SetType113c) & Stage 3 (#10286 PATH_SetTargetPos113c) on SparseMemory113c
    let replayedOk = 0
    let replayedStage2Asserts = 0
    for (const rec of parsedVec.records) {
      if (rec.preFlags & PATH_PREFLAG_SKIP_SET_TYPE) continue

      const pUnit = meta.pUnitVa
      const pPath = meta.pPathVa
      for (let off = 0; off < 0x200; off += 4) {
        mem.setU32(pPath + off, 0)
      }
      mem.setU32(pUnit + 0x00, rec.unitType)
      mem.setU32(pUnit + 0x04, rec.classId)
      mem.setU32(pPath + 0x30, pUnit)
      mem.setU8(pPath + 0x91, rec.nDistMax !== 0xff ? rec.nDistMax : 14)

      // Replicate #11003 initial pathType setup before the explicit #10647 call
      if (rec.unitType === 0) {
        PATH_SetType113c(mem, pPath, 7)
      } else if (rec.unitType === 1) {
        mem.setU32(pPath + 0x3c, 2)
      } else if (rec.unitType === 3) {
        PATH_SetType113c(mem, pPath, 4)
      }

      if (rec.nDistMax !== 0xff) {
        mem.setU8(pPath + 0x91, rec.nDistMax)
      }
      if (rec.preFlags & PATH_PREFLAG_SET_PREV_TYPE) {
        mem.setU32(pPath + 0x3c, rec.prevPathType)
      }

      if (rec.faultStage === 2) {
        expect(() => PATH_SetType113c(mem, pPath, rec.pathType)).toThrow(
          new RegExp(`^D2Common assertion failed at .*:${rec.faultLine}$`),
        )
        replayedStage2Asserts++
      } else {
        PATH_SetType113c(mem, pPath, rec.pathType)
        PATH_SetTargetPos113c(mem, pPath, rec.targetX, rec.targetY)
        expect(mem.u32(pPath + 0x3c)).toBe(rec.dwPathType)
        expect(mem.u32(pPath + 0x40)).toBe(rec.dwPrevPathType)
        expect(mem.u16(pPath + 0x10)).toBe(rec.targetX)
        expect(mem.u16(pPath + 0x12)).toBe(rec.targetY)
        replayedOk++
      }
    }
    expect(replayedStage2Asserts).toBe(130) // 128 line 2145 + 2 line 2163
    expect(replayedOk).toBe(6792)

    // Also verify line 2161 (dwPrevPathType == 11) and line 2162 (dwPrevPathType == 8) when switching to a 0x2000-flag pathType (9 = LEAP)
    mem.setU32(meta.pPathVa + 0x34, 0)
    mem.setU32(meta.pPathVa + 0x3c, 11)
    expect(() => PATH_SetType113c(mem, meta.pPathVa, 9)).toThrow(/^D2Common assertion failed at .*:2161$/)
    mem.setU32(meta.pPathVa + 0x34, 0)
    mem.setU32(meta.pPathVa + 0x3c, 8)
    expect(() => PATH_SetType113c(mem, meta.pPathVa, 9)).toThrow(/^D2Common assertion failed at .*:2162$/)
  })

  it('computes manifest callgraph closure, executes live Stage 1..4 D2TV replay across all 6,924 vectors, and enforces the shrink-only ratchet', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestFile
    const byVa = new Map<string, ManifestFunctionEntry>()
    for (const fn of manifest.functions) {
      byVa.set(normalizeVa(fn.va), fn)
    }

    const pathClosure = computeManifestClosure(byVa, PATH_ENTRY_VAS)
    expect(pathClosure.totalFunctions).toBe(104)
    expect(pathClosure.portedFunctions).toBe(104)
    expect(pathClosure.unportedFunctions).toBe(0)
    expect(pathClosure.unportedBytes).toBe(0)

    // Dynamically resolve all 104 ported / diff-verified symbols in the PATH closure from src/d2kern-113c/index.ts
    const kernExports = d2kern as Record<string, unknown>
    for (const fn of pathClosure.portedEntries) {
      expect(fn.tsSymbol, `Missing tsSymbol on ported manifest entry ${fn.va}`).toBeTruthy()
      expect(
        typeof kernExports[fn.tsSymbol!],
        `Ported symbol ${fn.tsSymbol} (${fn.va}) is missing from src/d2kern-113c/index.ts`,
      ).toBe('function')
    }

    const { liveByIdx, errors } = replayAllPathVectorsStage1To4(
      parsedVec.records,
      parsedImg.meta,
      parsedImg.pages,
      byVa,
    )
    expect(errors).toBe(0)

    const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as ExpectedDivergenceFile
    const summary = verifyPathRatchet(liveByIdx, expected, pathClosure)

    expect(summary).toEqual({
      matchCount: 6924,
      blockedCount: 0,
      divergeCount: 0,
    })

    // Mutation checks: prove the ratchet rejects (a) unlisted blocked entry, (b) stale entry still in list, (c) altered VA list
    const liveBlocked = new Map(liveByIdx)
    liveBlocked.set('0', { status: 'blocked', reason: 'path', vas: ['0x6FD86030'] })
    expect(() => verifyPathRatchet(liveBlocked, expected, pathClosure)).toThrow(
      /Ratchet violation \(a\)/,
    )

    const cloneStale = structuredClone(expected)
    cloneStale.items['0'] = { status: 'blocked', reason: 'path', vas: ['0x6FD86030'] }
    expect(() => verifyPathRatchet(liveByIdx, cloneStale, pathClosure)).toThrow(
      /Ratchet violation \(b\)/,
    )

    const cloneBadVas = structuredClone(expected)
    cloneBadVas.items['0'] = { status: 'blocked', reason: 'path', vas: ['0x6FD86230'] }
    expect(() => verifyPathRatchet(liveBlocked, cloneBadVas, pathClosure)).toThrow(
      /Ratchet violation \(c\)/,
    )
  })
})
