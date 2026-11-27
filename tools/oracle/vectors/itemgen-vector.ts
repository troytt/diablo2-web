import { createHash } from 'node:crypto'
import {
  evaluateItemgenVector113c,
  type ItemGenVectorInput113c,
  type ItemGenVectorOutput113c,
} from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c.ts'
import {
  type CopyOnWritePageMemory113c,
  createK2DatatblsMemory113c,
} from './monspawn-vector.ts'
import { parseVectorHeader, type VectorHeader } from './vector-format.ts'

export const ITEMGEN_INPUT_BYTES = 16
export const ITEMGEN_OUTPUT_BYTES = 84
export const ITEMGEN_RECORD_SIZE = 100

export interface ItemGenVectorRecord
  extends ItemGenVectorInput113c,
    Omit<ItemGenVectorOutput113c, 'bitstream'> {
  readonly index: number
  readonly bitstreamSha256: string
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0')
  }
  return out
}

export function parseItemGenVectors(rawBuffer: Uint8Array): {
  header: VectorHeader
  records: ItemGenVectorRecord[]
} {
  const header = parseVectorHeader(rawBuffer)
  if (header.kind !== 'ITEMGEN') {
    throw new Error(`Expected D2TV kind 'ITEMGEN', got '${header.kind}'`)
  }
  if (header.recordSize !== ITEMGEN_RECORD_SIZE) {
    throw new Error(`Expected ITEMGEN recordSize ${ITEMGEN_RECORD_SIZE}, got ${header.recordSize}`)
  }
  const view = new DataView(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength)
  const records: ItemGenVectorRecord[] = []
  let off = 32
  for (let i = 0; i < header.recordCount; i++) {
    records.push({
      index: i,
      initSeedLo: view.getUint32(off + 0, true),
      initSeedHi: view.getUint32(off + 4, true),
      itemId: view.getUint16(off + 8, true),
      ilvl: rawBuffer[off + 10]!,
      quality: rawBuffer[off + 11]!,
      difficulty: rawBuffer[off + 12]!,
      dropFlags: rawBuffer[off + 13]!,
      itemFormat: view.getUint16(off + 14, true),
      itemFlags: view.getUint32(off + 16, true),
      fileIndex: view.getInt32(off + 20, true),
      magicPrefix: [
        view.getUint16(off + 24, true),
        view.getUint16(off + 26, true),
        view.getUint16(off + 28, true),
      ],
      magicSuffix: [
        view.getUint16(off + 30, true),
        view.getUint16(off + 32, true),
        view.getUint16(off + 34, true),
      ],
      rarePrefix: view.getUint16(off + 36, true),
      rareSuffix: view.getUint16(off + 38, true),
      defense: view.getInt16(off + 40, true),
      durability: view.getInt16(off + 42, true),
      maxDurability: view.getInt16(off + 44, true),
      minDamage: view.getInt16(off + 46, true),
      maxDamage: view.getInt16(off + 48, true),
      secMinDamage: view.getInt16(off + 50, true),
      secMaxDamage: view.getInt16(off + 52, true),
      finalQuality: rawBuffer[off + 54]!,
      sockets: rawBuffer[off + 55]!,
      outSeedLo: view.getUint32(off + 56, true),
      outSeedHi: view.getUint32(off + 60, true),
      autoAffix: view.getUint16(off + 64, true),
      bitstreamBytes: view.getUint16(off + 66, true),
      bitstreamSha256: bytesToHex(rawBuffer.subarray(off + 68, off + 100)),
    })
    off += ITEMGEN_RECORD_SIZE
  }
  return { header, records }
}

export const readItemgenVectors = parseItemGenVectors

export interface ItemGenMismatch {
  readonly index: number
  readonly field: string
  readonly expected: number | string
  readonly actual: number | string
  readonly record: ItemGenVectorRecord
}

export function verifyItemGenVectors(
  rawBuffer: Uint8Array,
  mem?: CopyOnWritePageMemory113c,
): {
  header: VectorHeader
  totalRecords: number
  mismatches: ItemGenMismatch[]
} {
  const { header, records } = parseItemGenVectors(rawBuffer)
  const m = mem ?? createK2DatatblsMemory113c()
  const mismatches: ItemGenMismatch[] = []

  const check = (
    rec: ItemGenVectorRecord,
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
    const out = evaluateItemgenVector113c(m, rec)
    const actualSha = createHash('sha256').update(out.bitstream).digest('hex')
    check(rec, 'itemFlags', rec.itemFlags, out.itemFlags)
    check(rec, 'fileIndex', rec.fileIndex, out.fileIndex)
    check(rec, 'magicPrefix', rec.magicPrefix.join(','), out.magicPrefix.join(','))
    check(rec, 'magicSuffix', rec.magicSuffix.join(','), out.magicSuffix.join(','))
    check(rec, 'rarePrefix', rec.rarePrefix, out.rarePrefix)
    check(rec, 'rareSuffix', rec.rareSuffix, out.rareSuffix)
    check(rec, 'defense', rec.defense, out.defense)
    check(rec, 'durability', rec.durability, out.durability)
    check(rec, 'maxDurability', rec.maxDurability, out.maxDurability)
    check(rec, 'minDamage', rec.minDamage, out.minDamage)
    check(rec, 'maxDamage', rec.maxDamage, out.maxDamage)
    check(rec, 'secMinDamage', rec.secMinDamage, out.secMinDamage)
    check(rec, 'secMaxDamage', rec.secMaxDamage, out.secMaxDamage)
    check(rec, 'finalQuality', rec.finalQuality, out.finalQuality)
    check(rec, 'sockets', rec.sockets, out.sockets)
    check(rec, 'outSeedLo', rec.outSeedLo, out.outSeedLo)
    check(rec, 'outSeedHi', rec.outSeedHi, out.outSeedHi)
    check(rec, 'autoAffix', rec.autoAffix, out.autoAffix)
    check(rec, 'bitstreamBytes', rec.bitstreamBytes, out.bitstreamBytes)
    check(rec, 'bitstreamSha256', rec.bitstreamSha256, actualSha)
  }

  return { header, totalRecords: records.length, mismatches }
}

export const verifyItemgenVectors = verifyItemGenVectors
