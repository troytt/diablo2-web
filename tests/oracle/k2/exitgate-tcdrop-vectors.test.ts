import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  parseTcDropVectors,
  TCDROP_RECORD_SIZE,
  verifyTcDropVectors,
} from '../../../tools/oracle/vectors/tcdrop-vector.ts'
import { D2TV_MAGIC } from '../../../tools/oracle/vectors/vector-format.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const FIXTURE_GZ_PATH = resolve(REPO_ROOT, 'tests/fixtures/oracle/k2/tcdrop-113c.d2tv.gz')
const PINNED_RAW_SHA256 = 'bf091c145fad1d71dba1aa2d8794a09d3ba1746477f5ed7d4f257f3c9368c0e5'

describe('[K2] Exit-Gate TCDROP D2TV binary vector suite (v1.13c DLL parity)', () => {
  const gzBytes = readFileSync(FIXTURE_GZ_PATH)
  const rawBytes = gunzipSync(gzBytes)

  it('validates D2TV header, pinned SHA-256 digest, compact size, and TC/Difficulty/MF/Party diversity', () => {
    expect(statSync(FIXTURE_GZ_PATH).size).toBeLessThan(200 * 1024)

    const sha = createHash('sha256').update(rawBytes).digest('hex')
    expect(sha).toBe(PINNED_RAW_SHA256)

    const { header, records } = parseTcDropVectors(rawBytes)
    expect(header.magic).toBe(D2TV_MAGIC)
    expect(header.version).toBe(1)
    expect(header.kind).toBe('TCDROP')
    expect(header.recordSize).toBe(TCDROP_RECORD_SIZE)
    expect(header.recordCount).toBeGreaterThanOrEqual(1000)
    expect(records.length).toBe(1200)

    const diffs = new Set(records.map(r => r.difficulty))
    expect([...diffs].sort()).toEqual([0, 1, 2])

    const partyFactors = new Set(records.map(r => r.nPartyFactor))
    expect([...partyFactors].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    const distinctTcs = new Set(records.map(r => r.tcId))
    expect(distinctTcs.size).toBeGreaterThan(800)

    const withDrops = records.filter(r => r.droppedCount > 0).length
    expect(withDrops).toBeGreaterThan(600)
  })

  it('achieves 100% bit-exact parity (0 mismatches across all 1,200 records including post-call 64-bit PRNG seed)', () => {
    const result = verifyTcDropVectors(rawBytes)
    if (result.mismatches.length > 0) {
      const preview = result.mismatches
        .slice(0, 10)
        .map(
          m =>
            `rec#${m.index} (tc=${m.record.tcId} diff=${m.record.difficulty} exp=${m.record.bExpansion} pf=${m.record.nPartyFactor} mf=${m.record.mfBonus}) ${m.field}: expected=${m.expected} actual=${m.actual}`,
        )
        .join('\n')
      expect.fail(`TCDROP mismatches (${result.mismatches.length}):\n${preview}`)
    }
    expect(result.mismatches.length).toBe(0)
    expect(result.totalRecords).toBeGreaterThanOrEqual(1000)
  })
})
