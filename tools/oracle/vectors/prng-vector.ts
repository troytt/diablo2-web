/**
 * PRNG Test Vector Generator and Validator (Plan §3.6.2).
 *
 * Record format (24 bytes):
 *   [0..3]   initial_lo: uint32
 *   [4..7]   initial_hi: uint32
 *   [8..11]  n_max: uint32 (interpreted as signed int32 by 1.13c `SEED_RollLimitedRandomNumber`)
 *   [12..15] next_lo: uint32 (after roll)
 *   [16..19] next_hi: uint32 (after roll)
 *   [20..23] rolled_val: uint32
 */

import { parseVectorHeader, writeVectorHeader } from './vector-format.ts'
import { seedRoll, type D2SeedStrc } from '../../../src/d2kern-113c/prng.ts'

export const PRNG_RECORD_SIZE = 24

/** Exact 16 boundary `nMax` values from Plan §3.6.2. */
export const PRNG_EDGE_NMAX_113C = [
  0,
  1,
  2,
  3,
  4,
  7,
  8,
  15,
  16,
  255,
  256,
  65535,
  65536,
  0x7fffffff,
  0x80000000,
  0xffffffff,
] as const

export interface PrngRecord {
  initialLo: number
  initialHi: number
  nMax: number
  nextLo: number
  nextHi: number
  rolledVal: number
}

export function encodePrngRecord(rec: PrngRecord, target: Uint8Array, offset: number): void {
  const view = new DataView(target.buffer, target.byteOffset + offset, PRNG_RECORD_SIZE)
  view.setUint32(0, rec.initialLo >>> 0, true)
  view.setUint32(4, rec.initialHi >>> 0, true)
  view.setUint32(8, rec.nMax >>> 0, true)
  view.setUint32(12, rec.nextLo >>> 0, true)
  view.setUint32(16, rec.nextHi >>> 0, true)
  view.setUint32(20, rec.rolledVal >>> 0, true)
}

export function decodePrngRecord(source: Uint8Array, offset: number): PrngRecord {
  const view = new DataView(source.buffer, source.byteOffset + offset, PRNG_RECORD_SIZE)
  return {
    initialLo: view.getUint32(0, true),
    initialHi: view.getUint32(4, true),
    nMax: view.getUint32(8, true),
    nextLo: view.getUint32(12, true),
    nextHi: view.getUint32(16, true),
    rolledVal: view.getUint32(20, true),
  }
}

function getBoundarySeed(idx: number): [number, number] {
  switch (idx) {
    case 0:
      return [0, 0]
    case 1:
      return [1, 0]
    case 2:
      return [0, 1]
    case 3:
      return [0xffffffff, 0xffffffff]
    case 4:
      return [0x7fffffff, 0x7fffffff]
    case 5:
      return [0x80000000, 0x80000000]
    case 6:
      return [0xffffffff, 0]
    case 7:
      return [0, 0xffffffff]
    default:
      return [Math.imul(idx, 0x9e3779b9) >>> 0, Math.imul(idx, 0x85ebca6b) >>> 0]
  }
}

export function generatePrngVectors(count: number, masterSeed: number = 1337): Uint8Array {
  const totalSize = 32 + count * PRNG_RECORD_SIZE
  const buffer = new Uint8Array(totalSize)
  const header = writeVectorHeader('PRNG', PRNG_RECORD_SIZE, count, BigInt(masterSeed >>> 0))
  buffer.set(header, 0)

  let gen = masterSeed >>> 0
  const nextRand = () => {
    gen = (Math.imul(gen, 1103515245) + 12345) >>> 0
    return gen
  }

  for (let i = 0; i < count; i++) {
    let initLo: number
    let initHi: number
    let nMax: number
    if (i < 512) {
      ;[initLo, initHi] = getBoundarySeed(i >>> 4)
      nMax = PRNG_EDGE_NMAX_113C[i & 15]!
    } else {
      initLo = nextRand()
      initHi = nextRand()
      const r = nextRand()
      if ((r & 7) === 0) {
        nMax = PRNG_EDGE_NMAX_113C[(r >>> 3) & 15]!
      } else if ((r & 7) === 1) {
        nMax = nextRand()
      } else {
        nMax = (r % 100000) + 1
      }
    }

    const seed: D2SeedStrc = { lo: initLo, hi: initHi }
    const rolledVal = seedRoll(seed, nMax)

    encodePrngRecord(
      {
        initialLo: initLo,
        initialHi: initHi,
        nMax,
        nextLo: seed.lo,
        nextHi: seed.hi,
        rolledVal,
      },
      buffer,
      32 + i * PRNG_RECORD_SIZE,
    )
  }

  return buffer
}

export function verifyPrngVectors(vectorBytes: Uint8Array): { passed: number; total: number; errors: string[] } {
  const header = parseVectorHeader(vectorBytes)
  if (header.kind !== 'PRNG') {
    throw new Error(`Unexpected kind: ${header.kind} (expected PRNG)`)
  }
  if (header.recordSize !== PRNG_RECORD_SIZE) {
    throw new Error(`Mismatched record size: ${header.recordSize} != ${PRNG_RECORD_SIZE}`)
  }

  const errors: string[] = []
  let passed = 0

  for (let i = 0; i < header.recordCount; i++) {
    const rec = decodePrngRecord(vectorBytes, 32 + i * PRNG_RECORD_SIZE)
    const seed: D2SeedStrc = { lo: rec.initialLo, hi: rec.initialHi }
    const actualRolled = seedRoll(seed, rec.nMax)

    if (actualRolled !== rec.rolledVal || seed.lo !== rec.nextLo || seed.hi !== rec.nextHi) {
      errors.push(
        `Record #${i} mismatch: init(${rec.initialLo}, ${rec.initialHi}) roll(0x${rec.nMax.toString(16)}) -> ` +
          `expected [${rec.nextLo}, ${rec.nextHi}, ${rec.rolledVal}], got [${seed.lo}, ${seed.hi}, ${actualRolled}]`,
      )
      if (errors.length >= 10) break
    } else {
      passed++
    }
  }

  return { passed, total: header.recordCount, errors }
}
