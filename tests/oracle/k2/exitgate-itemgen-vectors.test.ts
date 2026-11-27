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
const PINNED_RAW_SHA256 = '10c61d8fc4b1b4f97fcfc98a380df690d84caa31c21102dd636018afd3812ce9'

/** All 8 Diablo II v1.13c item qualities: Low, Normal, Superior, Magic, Set, Rare, Unique, Crafted. */
const ALL_8_QUALITIES = [1, 2, 3, 4, 5, 6, 7, 8]
const ALL_99_ILVLS = Array.from({ length: 99 }, (_, i) => i + 1)

describe('[K2] Exit-Gate ITEMGEN D2TV binary vector suite (v1.13c unhooked DLL + #10987 bitstream parity)', () => {
  const gzBytes = readFileSync(FIXTURE_GZ_PATH)
  const rawBytes = gunzipSync(gzBytes)

  it('validates D2TV header, pinned SHA-256 digest, full 8 qualities (incl. Set/Unique/Crafted), ilvl 1..99, and #10987 bitstream fields', () => {
    expect(statSync(FIXTURE_GZ_PATH).size).toBeLessThan(256 * 1024)

    const sha = createHash('sha256').update(rawBytes).digest('hex')
    expect(sha).toBe(PINNED_RAW_SHA256)

    const { header, records } = parseItemGenVectors(rawBytes)
    expect(header.magic).toBe(D2TV_MAGIC)
    expect(header.version).toBe(1)
    expect(header.kind).toBe('ITEMGEN')
    expect(header.recordSize).toBe(ITEMGEN_RECORD_SIZE)
    expect(header.recordCount).toBe(2400)
    expect(records.length).toBe(2400)

    const diffs = new Set(records.map(r => r.difficulty))
    expect([...diffs].sort()).toEqual([0, 1, 2])

    const requestedQualities = new Set(records.map(r => r.quality))
    expect([...requestedQualities].sort((a, b) => a - b)).toEqual(ALL_8_QUALITIES)

    const finalQualities = new Set(records.map(r => r.finalQuality))
    expect([...finalQualities].sort((a, b) => a - b)).toEqual(ALL_8_QUALITIES)

    const ilvls = new Set(records.map(r => r.ilvl))
    expect([...ilvls].sort((a, b) => a - b)).toEqual(ALL_99_ILVLS)

    const formats = new Set(records.map(r => r.itemFormat))
    expect([...formats].sort((a, b) => a - b)).toEqual([0, 100])

    // Every single record must carry a real non-empty D2Common.#10987 serialized bitstream & SHA-256.
    for (const r of records) {
      expect(r.bitstreamBytes).toBeGreaterThanOrEqual(12)
      expect(r.bitstreamSha256).toMatch(/^[0-9a-f]{64}$/)
    }

    const ethCount = records.filter(r => (r.itemFlags & 0x400000) !== 0).length
    expect(ethCount).toBeGreaterThan(200)

    const socketCount = records.filter(r => r.sockets > 0).length
    expect(socketCount).toBeGreaterThan(200)

    const magicWithAffix = records.filter(
      r => r.finalQuality === 4 && (r.magicPrefix[0] > 0 || r.magicSuffix[0] > 0),
    ).length
    expect(magicWithAffix).toBeGreaterThan(200)

    const setGenerated = records.filter(r => r.finalQuality === 5 && r.fileIndex >= 0).length
    expect(setGenerated).toBeGreaterThan(200)

    const failedSetDowngraded = records.filter(r => r.quality === 5 && r.finalQuality === 4).length
    expect(failedSetDowngraded).toBeGreaterThan(20)

    const rareWithAffix = records.filter(
      r => r.finalQuality === 6 && r.rarePrefix > 0 && r.rareSuffix > 0,
    ).length
    expect(rareWithAffix).toBeGreaterThan(200)

    const uniqueGenerated = records.filter(r => r.finalQuality === 7 && r.fileIndex >= 0).length
    expect(uniqueGenerated).toBeGreaterThan(200)

    const failedUniqueDowngraded = records.filter(r => r.quality === 7 && r.finalQuality === 6).length
    expect(failedUniqueDowngraded).toBeGreaterThan(20)

    const craftedGenerated = records.filter(
      r => r.finalQuality === 8 && r.rarePrefix > 0 && r.rareSuffix > 0,
    ).length
    expect(craftedGenerated).toBeGreaterThan(200)
  })

  it('achieves 100% bit-exact parity (0 mismatches across all 2,400 records including #10987 serialized bitstream SHA-256 and 64-bit PRNG seed)', () => {
    const result = verifyItemGenVectors(rawBytes)
    if (result.mismatches.length > 0) {
      const preview = result.mismatches
        .slice(0, 15)
        .map(
          m =>
            `rec#${m.index} (itemId=${m.record.itemId} ilvl=${m.record.ilvl} q=${m.record.quality}->${m.record.finalQuality} diff=${m.record.difficulty} df=0x${m.record.dropFlags.toString(16)} fmt=${m.record.itemFormat}) ${m.field}: expected=${m.expected} actual=${m.actual}`,
        )
        .join('\n')
      expect.fail(`ITEMGEN mismatches (${result.mismatches.length}):\n${preview}`)
    }
    expect(result.mismatches.length).toBe(0)
    expect(result.totalRecords).toBe(2400)
  })

  it('negative tamper control: flipping 1 bit of a #10987 bitstream SHA-256 fails verification', () => {
    const tampered = new Uint8Array(rawBytes)
    // Flip 1 bit inside record #0 bitstreamSha256 (+68)
    tampered[32 + 68] ^= 0x01
    const result = verifyItemGenVectors(tampered)
    expect(result.mismatches.length).toBeGreaterThanOrEqual(1)
    expect(result.mismatches.some(m => m.index === 0 && m.field === 'bitstreamSha256')).toBe(true)
  })
})
