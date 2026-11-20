/**
 * [K1-5] DRLG D2TV Binary Vector Parser, Canonical Serializer & SHA-256 Digest Verifier.
 *
 * Shared contract with `tools/oracle/vectors/drlg-emitter.c`:
 *   - `DRLGDIG`  (56 B / record, 20,400 records = 50 seeds x 3 diffs x 136 levels)
 *   - `DRLGROOM` (48 B / record, level header marker `0xFFFF` + RoomEx list for seed 12345 x diffs 0..2)
 *   - `DRLGCOLL` (7,232 B / record, 169 town room collision grids for seed 12345, diff 0)
 */
import { createHash } from 'node:crypto'
import { parseVectorHeader, type VectorHeader } from './vector-format.ts'

export const DRLGDIG_RECORD_SIZE = 56
export const DRLGROOM_RECORD_SIZE = 48
export const DRLGCOLL_RECORD_SIZE = 7232
export const DRLG_LEVEL_HEADER_MARKER = 0xffff
export const DRLG_TOWN_LEVEL_IDS = [1, 40, 75, 103, 109] as const

function splitMix32Next(state: { s: number }): number {
  state.s = (state.s + 0x9e3779b9) >>> 0
  let z = state.s
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0
  return (z ^ (z >>> 16)) >>> 0
}

export function buildFrozenDrlgSeeds(): Uint32Array {
  const seeds = new Uint32Array(50)
  const fixed = [12345, 0, 1, 2, 0x7fffffff, 0x80000000, 0xffffffff, 0xdeadbeef, 777]
  for (let i = 0; i < fixed.length; i++) {
    seeds[i] = fixed[i]! >>> 0
  }
  const st = { s: 0x9e3779b9 }
  for (let i = fixed.length; i < 50; i++) {
    seeds[i] = splitMix32Next(st)
  }
  return seeds
}

export const DRLG_FROZEN_SEEDS: Uint32Array = buildFrozenDrlgSeeds()

export function fnv64Bytes(bytes: Uint8Array): bigint {
  let h = 14695981039346656037n
  const prime = 1099511628211n
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < bytes.length; i++) {
    h ^= BigInt(bytes[i]!)
    h = (h * prime) & mask
  }
  return h
}

export const DRLG_SEED_LIST_FNV64: bigint = (() => {
  const buf = new Uint8Array(50 * 4)
  const dv = new DataView(buf.buffer)
  for (let i = 0; i < 50; i++) {
    dv.setUint32(i * 4, DRLG_FROZEN_SEEDS[i]!, true)
  }
  return fnv64Bytes(buf)
})()

export function sha256Low64LE(chunks: readonly Uint8Array[]): bigint {
  const hash = createHash('sha256')
  for (const c of chunks) {
    hash.update(c)
  }
  const digest = hash.digest()
  return digest.readBigUInt64LE(0)
}

export interface DrlgDigestRecord {
  seed: number
  diff: number
  act: number
  levelId: number
  drlgType: number
  flags: number
  preAllocated: boolean
  wasInit: boolean
  nRoomList: number
  posX: number
  posY: number
  sizeX: number
  sizeY: number
  nRoomsField: number
  layoutHash: bigint
  collHash: bigint
  nCollRooms: number
  totalSubtiles: number
}

export interface DrlgLevelHeaderRecord {
  marker: number
  levelId: number
  act: number
  diff: number
  flags: number
  reserved: number
  drlgType: number
  dwFlags: number
  nRooms: number
  posX: number
  posY: number
  sizeX: number
  sizeY: number
  nLevelType: number
  seedLo: number
  seedHi: number
}

export interface DrlgRoomRecord {
  levelId: number
  idx: number
  x: number
  y: number
  w: number
  h: number
  nType: number
  dwFlags: number
  presetId: number
  presetSub: number
  dwInitSeed: number
  seedLo: number
  seedHi: number
}

export interface DrlgLevelRoomsGroup {
  header: DrlgLevelHeaderRecord
  rooms: DrlgRoomRecord[]
}

export interface DrlgCollRecord {
  nSubtileX: number
  nSubtileY: number
  nSubtileWidth: number
  nSubtileHeight: number
  nTileX: number
  nTileY: number
  nTileWidth: number
  nTileHeight: number
  headerBytes: Uint8Array
  mapWords: Uint16Array
  activeMapBytes: Uint8Array
}

export function parseDrlgDigestFile(buffer: Uint8Array): {
  header: VectorHeader
  records: DrlgDigestRecord[]
} {
  const header = parseVectorHeader(buffer)
  if (header.kind !== 'DRLGDIG') {
    throw new Error(`Expected kind 'DRLGDIG', got '${header.kind}'`)
  }
  if (header.recordSize !== DRLGDIG_RECORD_SIZE) {
    throw new Error(`Expected recordSize ${DRLGDIG_RECORD_SIZE}, got ${header.recordSize}`)
  }
  const dv = new DataView(buffer.buffer, buffer.byteOffset + 32, header.recordCount * DRLGDIG_RECORD_SIZE)
  const records: DrlgDigestRecord[] = new Array(header.recordCount)
  for (let i = 0; i < header.recordCount; i++) {
    const off = i * DRLGDIG_RECORD_SIZE
    const flags = dv.getUint8(off + 9)
    records[i] = {
      seed: dv.getUint32(off + 0, true),
      diff: dv.getUint8(off + 4),
      act: dv.getUint8(off + 5),
      levelId: dv.getUint16(off + 6, true),
      drlgType: dv.getUint8(off + 8),
      flags,
      preAllocated: (flags & 1) !== 0,
      wasInit: (flags & 2) !== 0,
      nRoomList: dv.getUint16(off + 10, true),
      posX: dv.getInt32(off + 12, true),
      posY: dv.getInt32(off + 16, true),
      sizeX: dv.getInt32(off + 20, true),
      sizeY: dv.getInt32(off + 24, true),
      nRoomsField: dv.getUint32(off + 28, true),
      layoutHash: dv.getBigUint64(off + 32, true),
      collHash: dv.getBigUint64(off + 40, true),
      nCollRooms: dv.getUint32(off + 48, true),
      totalSubtiles: dv.getUint32(off + 52, true),
    }
  }
  return { header, records }
}

export function serializeDrlgLevelHeader(h: DrlgLevelHeaderRecord): Uint8Array {
  const out = new Uint8Array(DRLGROOM_RECORD_SIZE)
  const dv = new DataView(out.buffer)
  dv.setUint16(0, h.marker, true)
  dv.setUint16(2, h.levelId, true)
  dv.setUint8(4, h.act)
  dv.setUint8(5, h.diff)
  dv.setUint8(6, h.flags)
  dv.setUint8(7, h.reserved)
  dv.setUint32(8, h.drlgType >>> 0, true)
  dv.setUint32(12, h.dwFlags >>> 0, true)
  dv.setUint32(16, h.nRooms >>> 0, true)
  dv.setInt32(20, h.posX | 0, true)
  dv.setInt32(24, h.posY | 0, true)
  dv.setInt32(28, h.sizeX | 0, true)
  dv.setInt32(32, h.sizeY | 0, true)
  dv.setUint32(36, h.nLevelType >>> 0, true)
  dv.setUint32(40, h.seedLo >>> 0, true)
  dv.setUint32(44, h.seedHi >>> 0, true)
  return out
}

export function serializeDrlgRoomRecord(r: DrlgRoomRecord): Uint8Array {
  const out = new Uint8Array(DRLGROOM_RECORD_SIZE)
  const dv = new DataView(out.buffer)
  dv.setUint16(0, r.levelId, true)
  dv.setUint16(2, r.idx, true)
  dv.setInt32(4, r.x | 0, true)
  dv.setInt32(8, r.y | 0, true)
  dv.setInt32(12, r.w | 0, true)
  dv.setInt32(16, r.h | 0, true)
  dv.setUint32(20, r.nType >>> 0, true)
  dv.setUint32(24, r.dwFlags >>> 0, true)
  dv.setInt32(28, r.presetId | 0, true)
  dv.setInt32(32, r.presetSub | 0, true)
  dv.setUint32(36, r.dwInitSeed >>> 0, true)
  dv.setUint32(40, r.seedLo >>> 0, true)
  dv.setUint32(44, r.seedHi >>> 0, true)
  return out
}

export function computeDrlgLevelLayoutHash(
  header: DrlgLevelHeaderRecord,
  rooms: readonly DrlgRoomRecord[],
): bigint {
  const chunks: Uint8Array[] = new Array(1 + rooms.length)
  chunks[0] = serializeDrlgLevelHeader(header)
  for (let i = 0; i < rooms.length; i++) {
    chunks[i + 1] = serializeDrlgRoomRecord(rooms[i]!)
  }
  return sha256Low64LE(chunks)
}

export function parseDrlgRoomsFile(buffer: Uint8Array): {
  header: VectorHeader
  levels: DrlgLevelRoomsGroup[]
} {
  const header = parseVectorHeader(buffer)
  if (header.kind !== 'DRLGROOM') {
    throw new Error(`Expected kind 'DRLGROOM', got '${header.kind}'`)
  }
  if (header.recordSize !== DRLGROOM_RECORD_SIZE) {
    throw new Error(`Expected recordSize ${DRLGROOM_RECORD_SIZE}, got ${header.recordSize}`)
  }
  const dv = new DataView(buffer.buffer, buffer.byteOffset + 32, header.recordCount * DRLGROOM_RECORD_SIZE)
  const levels: DrlgLevelRoomsGroup[] = []
  let currentGroup: DrlgLevelRoomsGroup | null = null

  for (let i = 0; i < header.recordCount; i++) {
    const off = i * DRLGROOM_RECORD_SIZE
    const w0 = dv.getUint16(off + 0, true)
    if (w0 === DRLG_LEVEL_HEADER_MARKER) {
      const lvlHdr: DrlgLevelHeaderRecord = {
        marker: w0,
        levelId: dv.getUint16(off + 2, true),
        act: dv.getUint8(off + 4),
        diff: dv.getUint8(off + 5),
        flags: dv.getUint8(off + 6),
        reserved: dv.getUint8(off + 7),
        drlgType: dv.getUint32(off + 8, true),
        dwFlags: dv.getUint32(off + 12, true),
        nRooms: dv.getUint32(off + 16, true),
        posX: dv.getInt32(off + 20, true),
        posY: dv.getInt32(off + 24, true),
        sizeX: dv.getInt32(off + 28, true),
        sizeY: dv.getInt32(off + 32, true),
        nLevelType: dv.getUint32(off + 36, true),
        seedLo: dv.getUint32(off + 40, true),
        seedHi: dv.getUint32(off + 44, true),
      }
      currentGroup = { header: lvlHdr, rooms: [] }
      levels.push(currentGroup)
    } else {
      if (!currentGroup) {
        throw new Error(`DRLGROOM record ${i} (levelId=${w0}) encountered before any 0xFFFF level header`)
      }
      const rr: DrlgRoomRecord = {
        levelId: w0,
        idx: dv.getUint16(off + 2, true),
        x: dv.getInt32(off + 4, true),
        y: dv.getInt32(off + 8, true),
        w: dv.getInt32(off + 12, true),
        h: dv.getInt32(off + 16, true),
        nType: dv.getUint32(off + 20, true),
        dwFlags: dv.getUint32(off + 24, true),
        presetId: dv.getInt32(off + 28, true),
        presetSub: dv.getInt32(off + 32, true),
        dwInitSeed: dv.getUint32(off + 36, true),
        seedLo: dv.getUint32(off + 40, true),
        seedHi: dv.getUint32(off + 44, true),
      }
      currentGroup.rooms.push(rr)
    }
  }
  return { header, levels }
}

export function parseDrlgCollFile(buffer: Uint8Array): {
  header: VectorHeader
  records: DrlgCollRecord[]
} {
  const header = parseVectorHeader(buffer)
  if (header.kind !== 'DRLGCOLL') {
    throw new Error(`Expected kind 'DRLGCOLL', got '${header.kind}'`)
  }
  if (header.recordSize !== DRLGCOLL_RECORD_SIZE) {
    throw new Error(`Expected recordSize ${DRLGCOLL_RECORD_SIZE}, got ${header.recordSize}`)
  }
  const records: DrlgCollRecord[] = new Array(header.recordCount)
  for (let i = 0; i < header.recordCount; i++) {
    const base = 32 + i * DRLGCOLL_RECORD_SIZE
    const dv = new DataView(buffer.buffer, buffer.byteOffset + base, DRLGCOLL_RECORD_SIZE)
    const nSubtileX = dv.getInt32(0, true)
    const nSubtileY = dv.getInt32(4, true)
    const nSubtileWidth = dv.getInt32(8, true)
    const nSubtileHeight = dv.getInt32(12, true)
    const nTileX = dv.getInt32(16, true)
    const nTileY = dv.getInt32(20, true)
    const nTileWidth = dv.getInt32(24, true)
    const nTileHeight = dv.getInt32(28, true)
    const cells = Math.max(0, nSubtileWidth * nSubtileHeight)
    const headerBytes = buffer.subarray(base, base + 32)
    const activeMapBytes = buffer.subarray(base + 32, base + 32 + cells * 2)
    const mapWords = new Uint16Array(cells)
    for (let c = 0; c < cells; c++) {
      mapWords[c] = dv.getUint16(32 + c * 2, true)
    }
    records[i] = {
      nSubtileX,
      nSubtileY,
      nSubtileWidth,
      nSubtileHeight,
      nTileX,
      nTileY,
      nTileWidth,
      nTileHeight,
      headerBytes,
      mapWords,
      activeMapBytes,
    }
  }
  return { header, records }
}

export function computeDrlgLevelCollHash(records: readonly DrlgCollRecord[]): bigint {
  const chunks: Uint8Array[] = []
  for (const r of records) {
    chunks.push(r.headerBytes)
    if (r.activeMapBytes.length > 0) {
      chunks.push(r.activeMapBytes)
    }
  }
  return sha256Low64LE(chunks)
}
