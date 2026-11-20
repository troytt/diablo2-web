import {
  evaluateTcdropVector113c,
  type TcDropVectorInput113c,
  type TcDropVectorOutput113c,
} from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c.ts'
import {
  type CopyOnWritePageMemory113c,
  createK2DatatblsMemory113c,
} from './monspawn-vector.ts'
import { parseVectorHeader, type VectorHeader } from './vector-format.ts'

export const TCDROP_INPUT_BYTES = 18
export const TCDROP_OUTPUT_BYTES = 46
export const TCDROP_RECORD_SIZE = 64

export interface TcDropVectorRecord extends TcDropVectorInput113c, TcDropVectorOutput113c {
  readonly index: number
}

export function parseTcDropVectors(rawBuffer: Uint8Array): {
  header: VectorHeader
  records: TcDropVectorRecord[]
} {
  const header = parseVectorHeader(rawBuffer)
  if (header.kind !== 'TCDROP') {
    throw new Error(`Expected D2TV kind 'TCDROP', got '${header.kind}'`)
  }
  if (header.recordSize !== TCDROP_RECORD_SIZE) {
    throw new Error(`Expected TCDROP recordSize ${TCDROP_RECORD_SIZE}, got ${header.recordSize}`)
  }
  const view = new DataView(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength)
  const records: TcDropVectorRecord[] = []
  let off = 32
  for (let i = 0; i < header.recordCount; i++) {
    records.push({
      index: i,
      initSeedLo: view.getUint32(off + 0, true),
      initSeedHi: view.getUint32(off + 4, true),
      tcId: view.getUint16(off + 8, true),
      monsterLevel: rawBuffer[off + 10]!,
      difficulty: rawBuffer[off + 11]!,
      mfBonus: view.getUint16(off + 12, true),
      bExpansion: rawBuffer[off + 14]!,
      nPartyFactor: rawBuffer[off + 15]!,
      bSkipNoDrop: rawBuffer[off + 16]!,
      maxDrops: rawBuffer[off + 17]!,
      resolvedGroup: view.getUint16(off + 18, true),
      resolvedLevel: view.getUint16(off + 20, true),
      initPicks: view.getInt16(off + 22, true),
      rootEffectiveNoDrop: view.getInt32(off + 24, true),
      droppedCount: view.getUint16(off + 28, true),
      dropClassIds: [
        view.getInt16(off + 30, true),
        view.getInt16(off + 32, true),
        view.getInt16(off + 34, true),
        view.getInt16(off + 36, true),
        view.getInt16(off + 38, true),
        view.getInt16(off + 40, true),
      ],
      dropQualities: [
        rawBuffer[off + 42]!,
        rawBuffer[off + 43]!,
        rawBuffer[off + 44]!,
        rawBuffer[off + 45]!,
        rawBuffer[off + 46]!,
        rawBuffer[off + 47]!,
      ],
      dropFlags: [
        rawBuffer[off + 48]!,
        rawBuffer[off + 49]!,
        rawBuffer[off + 50]!,
        rawBuffer[off + 51]!,
        rawBuffer[off + 52]!,
        rawBuffer[off + 53]!,
      ],
      firstUniqueSetIdx: view.getUint16(off + 54, true),
      outSeedLo: view.getUint32(off + 56, true),
      outSeedHi: view.getUint32(off + 60, true),
    })
    off += TCDROP_RECORD_SIZE
  }
  return { header, records }
}

export const readTcdropVectors = parseTcDropVectors

export interface TcDropMismatch {
  readonly index: number
  readonly field: string
  readonly expected: number | string
  readonly actual: number | string
  readonly record: TcDropVectorRecord
}

export function verifyTcDropVectors(
  rawBuffer: Uint8Array,
  mem?: CopyOnWritePageMemory113c,
): {
  header: VectorHeader
  totalRecords: number
  mismatches: TcDropMismatch[]
} {
  const { header, records } = parseTcDropVectors(rawBuffer)
  const m = mem ?? createK2DatatblsMemory113c()
  const mismatches: TcDropMismatch[] = []

  const check = (
    rec: TcDropVectorRecord,
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
    const out = evaluateTcdropVector113c(m, rec)
    check(rec, 'resolvedGroup', rec.resolvedGroup, out.resolvedGroup)
    check(rec, 'resolvedLevel', rec.resolvedLevel, out.resolvedLevel)
    check(rec, 'initPicks', rec.initPicks, out.initPicks)
    check(rec, 'rootEffectiveNoDrop', rec.rootEffectiveNoDrop, out.rootEffectiveNoDrop)
    check(rec, 'droppedCount', rec.droppedCount, out.droppedCount)
    check(rec, 'dropClassIds', rec.dropClassIds.join(','), out.dropClassIds.join(','))
    check(rec, 'dropQualities', rec.dropQualities.join(','), out.dropQualities.join(','))
    check(rec, 'dropFlags', rec.dropFlags.join(','), out.dropFlags.join(','))
    check(rec, 'firstUniqueSetIdx', rec.firstUniqueSetIdx, out.firstUniqueSetIdx)
    check(rec, 'outSeedLo', rec.outSeedLo, out.outSeedLo)
    check(rec, 'outSeedHi', rec.outSeedHi, out.outSeedHi)
  }

  return { header, totalRecords: records.length, mismatches }
}

export const verifyTcdropVectors = verifyTcDropVectors
