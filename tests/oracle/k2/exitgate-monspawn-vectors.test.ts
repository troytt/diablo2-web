import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  MONSPAWN_RECORD_SIZE,
  parseMonSpawnVectors,
  verifyMonSpawnVectors,
} from '../../../tools/oracle/vectors/monspawn-vector.ts'
import { D2TV_MAGIC } from '../../../tools/oracle/vectors/vector-format.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const FIXTURE_GZ_PATH = resolve(REPO_ROOT, 'tests/fixtures/oracle/k2/monspawn-113c.d2tv.gz')
const PINNED_RAW_SHA256 = '281bf495e257a8482faad1e036f1cacc8c47c91c6b90bc51e08c43a94099edf6'

describe('[K2] Exit-Gate MONSPAWN D2TV binary vector suite (v1.13c DLL parity)', () => {
  const gzBytes = readFileSync(FIXTURE_GZ_PATH)
  const rawBytes = gunzipSync(gzBytes)

  it('validates D2TV header, pinned SHA-256 digest, compact size, and Act/Difficulty diversity', () => {
    expect(statSync(FIXTURE_GZ_PATH).size).toBeLessThan(256 * 1024)

    const sha = createHash('sha256').update(rawBytes).digest('hex')
    expect(sha).toBe(PINNED_RAW_SHA256)

    const { header, records } = parseMonSpawnVectors(rawBytes)
    expect(header.magic).toBe(D2TV_MAGIC)
    expect(header.version).toBe(1)
    expect(header.kind).toBe('MONSPAWN')
    expect(header.recordSize).toBe(MONSPAWN_RECORD_SIZE)
    expect(header.recordCount).toBeGreaterThanOrEqual(1000)
    expect(records.length).toBe(1200)

    const diffs = new Set(records.map(r => r.difficulty))
    expect([...diffs].sort()).toEqual([0, 1, 2])

    const acts = new Set(
      records.map(r => {
        if (r.levelId < 40) return 1
        if (r.levelId < 75) return 2
        if (r.levelId < 103) return 3
        if (r.levelId < 109) return 4
        return 5
      }),
    )
    expect([...acts].sort()).toEqual([1, 2, 3, 4, 5])

    const champCount = records.filter(r => (r.monFlags & 0x04) !== 0).length
    const uniqCount = records.filter(r => (r.monFlags & 0x08) !== 0).length
    const normalCount = records.filter(r => r.monFlags === 0 && r.packCount > 0).length
    expect(champCount).toBeGreaterThan(50)
    expect(uniqCount).toBeGreaterThan(300)
    expect(normalCount).toBeGreaterThan(200)
  })

  it('achieves 100% bit-exact parity (0 mismatches across all 1,200 records including post-call 64-bit PRNG seed)', () => {
    const result = verifyMonSpawnVectors(rawBytes)
    if (result.mismatches.length > 0) {
      const preview = result.mismatches
        .slice(0, 10)
        .map(
          m =>
            `rec#${m.index} (lvl=${m.record.levelId} diff=${m.record.difficulty} cid=${m.record.chosenClassId}) ${m.field}: expected=${m.expected} actual=${m.actual}`,
        )
        .join('\n')
      expect.fail(`MONSPAWN mismatches (${result.mismatches.length}):\n${preview}`)
    }
    expect(result.mismatches.length).toBe(0)
    expect(result.totalRecords).toBeGreaterThanOrEqual(1000)
  })
})
