import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import {
  bindK2KernelGlobals113c,
  evaluateMonSpawnVector113c,
  type MonSpawnVectorInput113c,
  type MonSpawnVectorOutput113c,
} from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c.ts'
import type { Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { parseVectorHeader, type VectorHeader } from './vector-format.ts'

export const MONSPAWN_RECORD_SIZE = 64

export interface MonSpawnVectorRecord extends MonSpawnVectorInput113c, MonSpawnVectorOutput113c {
  readonly index: number
}

export class CopyOnWritePageMemory113c implements Memory113c {
  private static readonly PAGE_BITS = 12
  private static readonly PAGE_SIZE = 1 << CopyOnWritePageMemory113c.PAGE_BITS
  private readonly basePages = new Map<number, Uint8Array>()
  private readonly overlayPages = new Map<number, Uint8Array>()
  private allocTop = 0x38000000

  loadBaseImageFile(gzPath: string): void {
    const raw = gunzipSync(readFileSync(gzPath))
    const hdr = parseVectorHeader(raw)
    if (hdr.kind !== 'PAGEIMG' || hdr.recordSize !== 4100) {
      throw new Error(`Invalid PAGEIMG header in ${gzPath}: kind=${hdr.kind} rec=${hdr.recordSize}`)
    }
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    let off = 32
    for (let i = 0; i < hdr.recordCount; i++) {
      const va = view.getUint32(off, true) >>> 0
      const page = va >>> CopyOnWritePageMemory113c.PAGE_BITS
      this.basePages.set(page, raw.subarray(off + 4, off + 4 + 4096).slice())
      off += 4100
    }
  }

  freezeOverlayIntoBase(): void {
    for (const [page, data] of this.overlayPages.entries()) {
      this.basePages.set(page, data)
    }
    this.overlayPages.clear()
  }

  resetOverlay(): void {
    this.overlayPages.clear()
    this.allocTop = 0x38000000
  }

  alloc(size: number): number {
    const aligned = (Math.max(4, size | 0) + 15) & ~15
    const ptr = this.allocTop >>> 0
    this.allocTop = (ptr + aligned) >>> 0
    this.fill(ptr, aligned, 0)
    return ptr
  }

  private readPage(page: number): Uint8Array | undefined {
    return this.overlayPages.get(page) ?? this.basePages.get(page)
  }

  private writePage(page: number): Uint8Array {
    let p = this.overlayPages.get(page)
    if (p !== undefined) return p
    const base = this.basePages.get(page)
    p = base !== undefined ? base.slice() : new Uint8Array(CopyOnWritePageMemory113c.PAGE_SIZE)
    this.overlayPages.set(page, p)
    return p
  }

  u8(addr: number): number {
    const a = addr >>> 0
    const p = this.readPage(a >>> 12)
    return p !== undefined ? p[a & 0xfff]! : 0
  }

  setU8(addr: number, val: number): void {
    const a = addr >>> 0
    this.writePage(a >>> 12)[a & 0xfff] = val & 0xff
  }

  u16(addr: number): number {
    const a = addr >>> 0
    if ((a & 0xfff) <= 0xffe) {
      const p = this.readPage(a >>> 12)
      if (p !== undefined) {
        const o = a & 0xfff
        return p[o]! | (p[o + 1]! << 8)
      }
      return 0
    }
    return this.u8(a) | (this.u8((a + 1) >>> 0) << 8)
  }

  setU16(addr: number, val: number): void {
    const a = addr >>> 0
    if ((a & 0xfff) <= 0xffe) {
      const p = this.writePage(a >>> 12)
      const o = a & 0xfff
      p[o] = val & 0xff
      p[o + 1] = (val >>> 8) & 0xff
      return
    }
    this.setU8(a, val)
    this.setU8((a + 1) >>> 0, val >>> 8)
  }

  u32(addr: number): number {
    const a = addr >>> 0
    if ((a & 0xfff) <= 0xffc) {
      const p = this.readPage(a >>> 12)
      if (p !== undefined) {
        const o = a & 0xfff
        return (p[o]! | (p[o + 1]! << 8) | (p[o + 2]! << 16) | (p[o + 3]! << 24)) >>> 0
      }
      return 0
    }
    return (
      this.u8(a) |
      (this.u8((a + 1) >>> 0) << 8) |
      (this.u8((a + 2) >>> 0) << 16) |
      (this.u8((a + 3) >>> 0) << 24)
    ) >>> 0
  }

  setU32(addr: number, val: number): void {
    const a = addr >>> 0
    if ((a & 0xfff) <= 0xffc) {
      const p = this.writePage(a >>> 12)
      const o = a & 0xfff
      p[o] = val & 0xff
      p[o + 1] = (val >>> 8) & 0xff
      p[o + 2] = (val >>> 16) & 0xff
      p[o + 3] = (val >>> 24) & 0xff
      return
    }
    this.setU8(a, val)
    this.setU8((a + 1) >>> 0, val >>> 8)
    this.setU8((a + 2) >>> 0, val >>> 16)
    this.setU8((a + 3) >>> 0, val >>> 24)
  }

  get(base: number, field: { off: number; type: 'u8' | 'u16' | 'u32' | 'ptr' }, index = 0): number {
    const width = field.type === 'u8' ? 1 : field.type === 'u16' ? 2 : 4
    const p = ((base >>> 0) + field.off + index * width) >>> 0
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }

  set(
    base: number,
    field: { off: number; type: 'u8' | 'u16' | 'u32' | 'ptr' },
    val: number,
    index = 0,
  ): void {
    const width = field.type === 'u8' ? 1 : field.type === 'u16' ? 2 : 4
    const p = ((base >>> 0) + field.off + index * width) >>> 0
    if (width === 1) this.setU8(p, val)
    else if (width === 2) this.setU16(p, val)
    else this.setU32(p, val)
  }

  fill(addr: number, byteLen: number, byteVal: number): void {
    let cur = addr >>> 0
    let rem = byteLen >>> 0
    const b = byteVal & 0xff
    while (rem > 0) {
      const pageOff = cur & 0xfff
      const chunk = Math.min(rem, 4096 - pageOff)
      const p = this.writePage(cur >>> 12)
      p.fill(b, pageOff, pageOff + chunk)
      cur = (cur + chunk) >>> 0
      rem -= chunk
    }
  }
}

export function createK2DatatblsMemory113c(repoRoot?: string): CopyOnWritePageMemory113c {
  const root = repoRoot ?? resolve(import.meta.dirname, '../../..')
  const imgPath = resolve(root, 'tests/fixtures/oracle/k1/d2game-datatbls-113c.img.gz')
  const mem = new CopyOnWritePageMemory113c()
  mem.loadBaseImageFile(imgPath)
  bindK2KernelGlobals113c(mem)
  mem.freezeOverlayIntoBase()
  return mem
}

export function parseMonSpawnVectors(rawBuffer: Uint8Array): {
  header: VectorHeader
  records: MonSpawnVectorRecord[]
} {
  const header = parseVectorHeader(rawBuffer)
  if (header.kind !== 'MONSPAWN') {
    throw new Error(`Expected D2TV kind 'MONSPAWN', got '${header.kind}'`)
  }
  if (header.recordSize !== MONSPAWN_RECORD_SIZE) {
    throw new Error(
      `Expected MONSPAWN recordSize ${MONSPAWN_RECORD_SIZE}, got ${header.recordSize}`,
    )
  }
  const view = new DataView(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength)
  const records: MonSpawnVectorRecord[] = []
  let off = 32
  for (let i = 0; i < header.recordCount; i++) {
    records.push({
      index: i,
      initSeedLo: view.getUint32(off + 0, true),
      initSeedHi: view.getUint32(off + 4, true),
      levelId: view.getUint16(off + 8, true),
      difficulty: rawBuffer[off + 10]!,
      bExpansion: rawBuffer[off + 11]!,
      nPlayers: rawBuffer[off + 12]!,
      roomsVisited: rawBuffer[off + 13]!,
      totalRooms: rawBuffer[off + 14]!,
      spawnedBosses: rawBuffer[off + 15]!,
      bossMode: rawBuffer[off + 16]!,
      superPct: rawBuffer[off + 17]!,
      poolCount: rawBuffer[off + 18]!,
      totalRarity: rawBuffer[off + 19]!,
      slot0ClassId: view.getInt16(off + 20, true),
      packRarityType: rawBuffer[off + 22]!,
      packCount: rawBuffer[off + 23]!,
      chosenClassId: view.getInt16(off + 24, true),
      monFlags: rawBuffer[off + 26]!,
      umods: [
        rawBuffer[off + 27]!,
        rawBuffer[off + 28]!,
        rawBuffer[off + 29]!,
        rawBuffer[off + 30]!,
        rawBuffer[off + 31]!,
        rawBuffer[off + 32]!,
      ],
      mlvl: view.getUint16(off + 34, true),
      maxHp: view.getInt32(off + 36, true),
      exp: view.getInt32(off + 40, true),
      ac: view.getInt16(off + 44, true),
      fireRes: view.getInt16(off + 46, true),
      lightRes: view.getInt16(off + 48, true),
      coldRes: view.getInt16(off + 50, true),
      hpRegen: view.getInt32(off + 52, true),
      outSeedLo: view.getUint32(off + 56, true),
      outSeedHi: view.getUint32(off + 60, true),
    })
    off += MONSPAWN_RECORD_SIZE
  }
  return { header, records }
}

export interface MonSpawnMismatch {
  readonly index: number
  readonly field: string
  readonly expected: number | string
  readonly actual: number | string
  readonly record: MonSpawnVectorRecord
}

export function verifyMonSpawnVectors(
  rawBuffer: Uint8Array,
  mem?: CopyOnWritePageMemory113c,
): {
  header: VectorHeader
  totalRecords: number
  mismatches: MonSpawnMismatch[]
} {
  const { header, records } = parseMonSpawnVectors(rawBuffer)
  const m = mem ?? createK2DatatblsMemory113c()
  const mismatches: MonSpawnMismatch[] = []

  const check = (
    rec: MonSpawnVectorRecord,
    field: string,
    expected: number | string,
    actual: number | string,
  ) => {
    if (expected !== actual) {
      mismatches.push({ index: rec.index, field, expected, actual, record: rec })
    }
  }

  for (const rec of records) {
    m.resetOverlay()
    const out = evaluateMonSpawnVector113c(m, rec)
    check(rec, 'poolCount', rec.poolCount, out.poolCount)
    check(rec, 'totalRarity', rec.totalRarity, out.totalRarity)
    check(rec, 'slot0ClassId', rec.slot0ClassId, out.slot0ClassId)
    check(rec, 'packRarityType', rec.packRarityType, out.packRarityType)
    check(rec, 'chosenClassId', rec.chosenClassId, out.chosenClassId)
    check(rec, 'packCount', rec.packCount, out.packCount)
    check(rec, 'monFlags', rec.monFlags, out.monFlags)
    check(rec, 'umods', rec.umods.join(','), out.umods.join(','))
    check(rec, 'mlvl', rec.mlvl, out.mlvl)
    check(rec, 'maxHp', rec.maxHp, out.maxHp)
    check(rec, 'exp', rec.exp, out.exp)
    check(rec, 'ac', rec.ac, out.ac)
    check(rec, 'fireRes', rec.fireRes, out.fireRes)
    check(rec, 'lightRes', rec.lightRes, out.lightRes)
    check(rec, 'coldRes', rec.coldRes, out.coldRes)
    check(rec, 'hpRegen', rec.hpRegen, out.hpRegen)
    check(rec, 'outSeedLo', rec.outSeedLo, out.outSeedLo)
    check(rec, 'outSeedHi', rec.outSeedHi, out.outSeedHi)
  }

  return { header, totalRecords: records.length, mismatches }
}
