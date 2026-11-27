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
const PINNED_RAW_SHA256 = '7d35dcb158a1748828a953ad5eb19972e881eca4503793761a775ec5c93a653f'

/** All 136 Diablo II v1.13c levels (`1..136`), including all 38 Act 1 wilderness/dungeon levels (`2..39`). */
const ALL_136_LEVEL_IDS = Array.from({ length: 136 }, (_, i) => i + 1)
const ACT1_WILDERNESS_DUNGEON_LEVELS = Array.from({ length: 38 }, (_, i) => i + 2)

describe('[K2] Exit-Gate MONSPAWN D2TV binary vector suite (v1.13c DLL parity)', () => {
  const gzBytes = readFileSync(FIXTURE_GZ_PATH)
  const rawBytes = gunzipSync(gzBytes)

  it('validates D2TV header, pinned SHA-256 digest, compact size, and full 136-level / Act 1..5 / Difficulty coverage', () => {
    expect(statSync(FIXTURE_GZ_PATH).size).toBeLessThan(256 * 1024)

    const sha = createHash('sha256').update(rawBytes).digest('hex')
    expect(sha).toBe(PINNED_RAW_SHA256)

    const { header, records } = parseMonSpawnVectors(rawBytes)
    expect(header.magic).toBe(D2TV_MAGIC)
    expect(header.version).toBe(1)
    expect(header.kind).toBe('MONSPAWN')
    expect(header.recordSize).toBe(MONSPAWN_RECORD_SIZE)
    expect(header.recordCount).toBe(2448)
    expect(records.length).toBe(2448)

    const levels = new Set(records.map(r => r.levelId))
    expect([...levels].sort((a, b) => a - b)).toEqual(ALL_136_LEVEL_IDS)

    for (const lvl of ACT1_WILDERNESS_DUNGEON_LEVELS) {
      expect(levels.has(lvl), `Act 1 level ${lvl} must be covered`).toBe(true)
    }

    // Every one of the 136 levels must cover all 3 difficulties and all 3 boss modes.
    for (const lvl of ALL_136_LEVEL_IDS) {
      const lvlRecs = records.filter(r => r.levelId === lvl)
      expect(lvlRecs.length).toBe(18)
      expect([...new Set(lvlRecs.map(r => r.difficulty))].sort()).toEqual([0, 1, 2])
      expect([...new Set(lvlRecs.map(r => r.bossMode))].sort()).toEqual([0, 1, 2])
    }

    // All 125 monster-spawnable levels (126 with non-empty Levels.txt pool minus lvl 120 Arreat Summit Ancients isSpawn=0)
    // must produce non-empty pools and chosen monsters.
    const spawnedLevels = new Set(records.filter(r => r.poolCount > 0 && r.chosenClassId >= 0).map(r => r.levelId))
    expect(spawnedLevels.size).toBe(125)

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
    expect(champCount).toBeGreaterThan(100)
    expect(uniqCount).toBeGreaterThan(600)
    expect(normalCount).toBeGreaterThan(400)
  })

  it('achieves 100% bit-exact parity (0 mismatches across all 2,448 records / 136 levels including post-call 64-bit PRNG seed)', () => {
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
    expect(result.totalRecords).toBe(2448)
  })

  it('negative tamper control: flipping 1 bit of a MONSPAWN record output fails verification', () => {
    const tampered = new Uint8Array(rawBytes)
    // Flip 1 bit inside record #1 (Blood Moor levelId=2) outSeedLo (+56)
    tampered[32 + MONSPAWN_RECORD_SIZE + 56] ^= 0x01
    const result = verifyMonSpawnVectors(tampered)
    expect(result.mismatches.length).toBeGreaterThanOrEqual(1)
    expect(result.mismatches.some(m => m.index === 1 && m.field === 'outSeedLo')).toBe(true)
  })
})
