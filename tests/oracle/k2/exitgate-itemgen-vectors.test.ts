import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  ITEMGEN_RECORD_SIZE,
  parseItemGenVectors,
  verifyItemGenVectors,
} from '../../../tools/oracle/vectors/itemgen-vector.ts'
import { D2TV_MAGIC } from '../../../tools/oracle/vectors/vector-format.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const FIXTURE_GZ_PATH = resolve(REPO_ROOT, 'tests/fixtures/oracle/k2/itemgen-113c.d2tv.gz')
const PINNED_RAW_SHA256 = 'b1083a706519feb4915c9bc5f2f7c7aa23d6d129fd315dca6f918a02c4e3c723'

describe('[K2] Exit-Gate ITEMGEN D2TV binary vector suite (v1.13c DLL parity)', () => {
  const gzBytes = readFileSync(FIXTURE_GZ_PATH)
  const rawBytes = gunzipSync(gzBytes)

  it('validates D2TV header, pinned SHA-256 digest, compact size, and quality/socket/ethereal/affix diversity', () => {
    expect(statSync(FIXTURE_GZ_PATH).size).toBeLessThan(200 * 1024)

    const sha = createHash('sha256').update(rawBytes).digest('hex')
    expect(sha).toBe(PINNED_RAW_SHA256)

    const { header, records } = parseItemGenVectors(rawBytes)
    expect(header.magic).toBe(D2TV_MAGIC)
    expect(header.version).toBe(1)
    expect(header.kind).toBe('ITEMGEN')
    expect(header.recordSize).toBe(ITEMGEN_RECORD_SIZE)
    expect(header.recordCount).toBeGreaterThanOrEqual(500)
    expect(records.length).toBe(1200)

    const diffs = new Set(records.map(r => r.difficulty))
    expect([...diffs].sort()).toEqual([0, 1, 2])

    const qualities = new Set(records.map(r => r.quality))
    expect([...qualities].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 6])

    const formats = new Set(records.map(r => r.itemFormat))
    expect([...formats].sort((a, b) => a - b)).toEqual([0, 100])

    const ethCount = records.filter(r => (r.itemFlags & 0x400000) !== 0).length
    expect(ethCount).toBeGreaterThan(100)

    const socketCount = records.filter(r => r.sockets > 0).length
    expect(socketCount).toBeGreaterThan(200)

    const magicWithAffix = records.filter(
      r => r.finalQuality === 4 && (r.magicPrefix[0] > 0 || r.magicSuffix[0] > 0),
    ).length
    expect(magicWithAffix).toBeGreaterThan(150)

    const rareWithAffix = records.filter(
      r => r.finalQuality === 6 && r.rarePrefix > 0 && r.rareSuffix > 0,
    ).length
    expect(rareWithAffix).toBeGreaterThan(150)
  })

  it('achieves 100% bit-exact parity (0 mismatches across all 1,200 records including post-call 64-bit PRNG seed)', () => {
    const result = verifyItemGenVectors(rawBytes)
    if (result.mismatches.length > 0) {
      const preview = result.mismatches
        .slice(0, 10)
        .map(
          m =>
            `rec#${m.index} (itemId=${m.record.itemId} ilvl=${m.record.ilvl} q=${m.record.quality} diff=${m.record.difficulty} df=0x${m.record.dropFlags.toString(16)} fmt=${m.record.itemFormat}) ${m.field}: expected=${m.expected} actual=${m.actual}`,
        )
        .join('\n')
      expect.fail(`ITEMGEN mismatches (${result.mismatches.length}):\n${preview}`)
    }
    expect(result.mismatches.length).toBe(0)
    expect(result.totalRecords).toBeGreaterThanOrEqual(500)
  })
})
