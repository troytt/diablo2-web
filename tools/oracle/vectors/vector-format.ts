/**
 * Binary Test Vector format for Diablo II v1.13c Subsystem Validation.
 *
 * Designed per plan §3.6.2 and Gitea Milestone 31 [K0].
 * Shared contract between C test vector emitters (MinGW / original DLL harness)
 * and TypeScript kernel verification runners.
 *
 * Header (32 bytes, Little-Endian):
 *   [0..3]   magic: 'D','2','T','V' (0x56543244)
 *   [4..5]   version: 1
 *   [6..7]   flags: reserved (0)
 *   [8..15]  kind: 8-byte ASCII string, right-padded with 0 (e.g. "PRNG\0\0\0\0", "EVTWHEEL")
 *   [16..19] recordSize: byte length of a single test record
 *   [20..23] recordCount: number of records in this vector file
 *   [24..31] seed: u64 generator seed / hash for reproducibility
 *
 * Payload:
 *   recordCount * recordSize bytes immediately following the header.
 */

export const D2TV_MAGIC = 0x56543244 // 'D2TV'

export interface VectorHeader {
  magic: number
  version: number
  flags: number
  kind: string
  recordSize: number
  recordCount: number
  seed: bigint
}

export function parseVectorHeader(buffer: Uint8Array): VectorHeader {
  if (buffer.length < 32) {
    throw new Error(`Buffer too small for D2TV header: ${buffer.length} < 32`)
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, 32)
  const magic = view.getUint32(0, true)
  if (magic !== D2TV_MAGIC) {
    throw new Error(`Invalid D2TV magic: 0x${magic.toString(16)} (expected 0x${D2TV_MAGIC.toString(16)})`)
  }
  const version = view.getUint16(4, true)
  const flags = view.getUint16(6, true)

  // Read 8-byte ASCII kind
  let kindStr = ''
  for (let i = 0; i < 8; i++) {
    const b = buffer[8 + i]!
    if (b !== 0) kindStr += String.fromCharCode(b)
  }

  const recordSize = view.getUint32(16, true)
  const recordCount = view.getUint32(20, true)
  const seed = view.getBigUint64(24, true)

  const expectedPayload = recordSize * recordCount
  const actualPayload = buffer.length - 32
  if (actualPayload < expectedPayload) {
    throw new Error(`Truncated vector file: payload has ${actualPayload} bytes, expected ${expectedPayload}`)
  }

  return {
    magic,
    version,
    flags,
    kind: kindStr,
    recordSize,
    recordCount,
    seed,
  }
}

export function writeVectorHeader(
  kind: string,
  recordSize: number,
  recordCount: number,
  seed: bigint = 0n,
  version: number = 1,
): Uint8Array {
  const header = new Uint8Array(32)
  const view = new DataView(header.buffer, header.byteOffset, 32)
  view.setUint32(0, D2TV_MAGIC, true)
  view.setUint16(4, version, true)
  view.setUint16(6, 0, true)

  for (let i = 0; i < 8; i++) {
    header[8 + i] = i < kind.length ? kind.charCodeAt(i) : 0
  }

  view.setUint32(16, recordSize, true)
  view.setUint32(20, recordCount, true)
  view.setBigUint64(24, seed, true)

  return header
}
