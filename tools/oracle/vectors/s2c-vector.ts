import {
  evaluateS2CVector113c,
  type S2CVectorInput113c,
  type S2CVectorOutput113c,
} from '../../../src/d2kern-113c/game/k4-s2c-d2tv-evaluators-113c.ts'
import {
  type CopyOnWritePageMemory113c,
  createK2DatatblsMemory113c,
} from './monspawn-vector.ts'
import { parseVectorHeader, type VectorHeader } from './vector-format.ts'

export const S2C_INPUT_BYTES = 16
export const S2C_OUTPUT_BYTES = 48
export const S2C_RECORD_SIZE = 64

export interface S2CVectorRecord
  extends S2CVectorInput113c,
    Omit<S2CVectorOutput113c, 'roundtripExact'> {
  readonly index: number
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0')
  }
  return out
}

export function parseS2CVectors(rawBuffer: Uint8Array): {
  header: VectorHeader
  records: S2CVectorRecord[]
} {
  const header = parseVectorHeader(rawBuffer)
  if (header.kind !== 'S2C') {
    throw new Error(`Expected D2TV kind 'S2C', got '${header.kind}'`)
  }
  if (header.recordSize !== S2C_RECORD_SIZE) {
    throw new Error(`Expected S2C recordSize ${S2C_RECORD_SIZE}, got ${header.recordSize}`)
  }

  const view = new DataView(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength)
  const records: S2CVectorRecord[] = []
  let off = 32
  for (let i = 0; i < header.recordCount; i++) {
    records.push({
      index: i,
      opKind: rawBuffer[off + 0]!,
      flags: rawBuffer[off + 1]!,
      u16A: view.getUint16(off + 2, true),
      u32A: view.getUint32(off + 4, true),
      u32B: view.getUint32(off + 8, true),
      u16B: view.getUint16(off + 12, true),
      u16C: view.getUint16(off + 14, true),
      rawLen: view.getUint16(off + 16, true),
      framedLen: view.getUint16(off + 18, true),
      decompLen: view.getUint16(off + 20, true),
      firstPktSize: view.getUint16(off + 22, true),
      pktCount: rawBuffer[off + 24]!,
      wireHdr0: rawBuffer[off + 25]!,
      wireHdr1: rawBuffer[off + 26]!,
      firstOpcode: rawBuffer[off + 27]!,
      rawFnv1a32: view.getUint32(off + 28, true),
      rawMix32: view.getUint32(off + 32, true),
      framedFnv1a32: view.getUint32(off + 36, true),
      framedMix32: view.getUint32(off + 40, true),
      rawPrefix: rawBuffer.slice(off + 44, off + 56),
      framedPrefix: rawBuffer.slice(off + 56, off + 64),
    })
    off += S2C_RECORD_SIZE
  }
  return { header, records }
}

export const readS2CVectors = parseS2CVectors

export interface S2CVectorMismatch {
  readonly index: number
  readonly field: string
  readonly expected: number | string | boolean
  readonly actual: number | string | boolean
  readonly record: S2CVectorRecord
}

export function verifyS2CVectors(
  rawBuffer: Uint8Array,
  mem?: CopyOnWritePageMemory113c,
): {
  header: VectorHeader
  totalRecords: number
  mismatches: S2CVectorMismatch[]
} {
  const { header, records } = parseS2CVectors(rawBuffer)
  const m = mem ?? createK2DatatblsMemory113c()
  const mismatches: S2CVectorMismatch[] = []

  const check = (
    rec: S2CVectorRecord,
    field: string,
    expected: number | string | boolean,
    actual: number | string | boolean,
  ) => {
    if (expected !== actual) {
      mismatches.push({ index: rec.index, field, expected, actual, record: rec })
    }
  }

  for (const rec of records) {
    m.resetOverlay()
    const out = evaluateS2CVector113c(m, rec)
    check(rec, 'rawLen', rec.rawLen, out.rawLen)
    check(rec, 'framedLen', rec.framedLen, out.framedLen)
    check(rec, 'decompLen', rec.decompLen, out.decompLen)
    check(rec, 'firstPktSize', rec.firstPktSize, out.firstPktSize)
    check(rec, 'pktCount', rec.pktCount, out.pktCount)
    check(rec, 'wireHdr0', rec.wireHdr0, out.wireHdr0)
    check(rec, 'wireHdr1', rec.wireHdr1, out.wireHdr1)
    check(rec, 'firstOpcode', rec.firstOpcode, out.firstOpcode)
    check(rec, 'rawFnv1a32', rec.rawFnv1a32, out.rawFnv1a32)
    check(rec, 'rawMix32', rec.rawMix32, out.rawMix32)
    check(rec, 'framedFnv1a32', rec.framedFnv1a32, out.framedFnv1a32)
    check(rec, 'framedMix32', rec.framedMix32, out.framedMix32)
    check(rec, 'rawPrefix', bytesToHex(rec.rawPrefix), bytesToHex(out.rawPrefix))
    check(rec, 'framedPrefix', bytesToHex(rec.framedPrefix), bytesToHex(out.framedPrefix))
    check(rec, 'roundtripExact', true, out.roundtripExact)
  }

  return { header, totalRecords: records.length, mismatches }
}
