import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  parseSkillCalcVectors,
  SKILLCALC_RECORD_SIZE,
  verifySkillCalcVectors,
} from '../../../tools/oracle/vectors/skillcalc-vector.ts'
import {
  D2TV_KIND_SKILLCALC,
  D2TV_MAGIC,
} from '../../../tools/oracle/vectors/vector-format.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const FIXTURE_GZ_PATH = resolve(REPO_ROOT, 'tests/fixtures/oracle/k3/skillcalc-113c.d2tv.gz')
const PINNED_RAW_SHA256 = '336145e033b11206340f76113f34794e7631c6dc93c9e237f1bdec57d801d6c1'
const EXPECTED_SLVLS_1_TO_60 = Array.from({ length: 60 }, (_, i) => i + 1)

describe('[K3] Exit-Gate SKILLCALC D2TV binary vector suite (v1.13c DLL parity)', () => {
  const gzBytes = readFileSync(FIXTURE_GZ_PATH)
  const rawBytes = gunzipSync(gzBytes)

  it('validates D2TV header, pinned SHA-256 digest, compact size, and full 210-skill x slvl 1..60 matrix', () => {
    expect(statSync(FIXTURE_GZ_PATH).size).toBeLessThan(400 * 1024)

    const sha = createHash('sha256').update(rawBytes).digest('hex')
    expect(sha).toBe(PINNED_RAW_SHA256)

    const { header, records } = parseSkillCalcVectors(rawBytes)
    expect(header.magic).toBe(D2TV_MAGIC)
    expect(header.version).toBe(1)
    expect(header.kind).toBe(D2TV_KIND_SKILLCALC)
    expect(header.recordSize).toBe(SKILLCALC_RECORD_SIZE)
    expect(header.recordCount).toBe(12_600)
    expect(records.length).toBe(12_600)

    /* All 7 playable classes (Amazon..Assassin) */
    const classes = new Set(records.map(r => r.charClass))
    expect([...classes].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6])

    /* Every one of the 210 player skills covers the exact base slvl set {1..60} */
    const slvlsBySkill = new Map<number, number[]>()
    for (const r of records) {
      let arr = slvlsBySkill.get(r.skillId)
      if (arr === undefined) {
        arr = []
        slvlsBySkill.set(r.skillId, arr)
      }
      arr.push(r.baseSlvl)
    }
    expect(slvlsBySkill.size).toBe(210)
    for (const [skillId, slvls] of slvlsBySkill) {
      expect(slvls.length, `skillId=${skillId} record count`).toBe(60)
      const uniqueSorted = [...new Set(slvls)].sort((a, b) => a - b)
      expect(uniqueSorted, `skillId=${skillId} baseSlvl set`).toEqual(EXPECTED_SLVLS_1_TO_60)
    }

    /* All 73 SkillCalc.txt field codes (0..72) covered */
    const fieldCodes = new Set(records.map(r => r.calcFieldCode))
    expect(fieldCodes.size).toBe(73)

    /* Real synergy skills, bonus skill levels, elemental damage, physical damage, and lengths */
    expect(records.filter(r => r.synSkillId[0] !== 0xffff && r.synBaseLvl[0] > 0).length).toBeGreaterThan(5000)
    expect(records.filter(r => r.bonusSlvl > 0).length).toBeGreaterThan(10000)
    expect(records.filter(r => r.formulaVal !== 0).length).toBeGreaterThan(8000)
    expect(records.filter(r => r.calcFieldVal !== 0).length).toBeGreaterThan(3000)
    expect(records.filter(r => r.elemMaxDmg > 0).length).toBeGreaterThan(3500)
    expect(records.filter(r => r.physMaxDmg > 0).length).toBeGreaterThan(2000)
    expect(records.filter(r => r.elemLength > 0).length).toBeGreaterThan(1200)
    expect(records.filter(r => r.toHitBonus !== 0).length).toBeGreaterThan(2500)
    expect(records.filter(r => r.manaCost > 0).length).toBeGreaterThan(8500)
  })

  it('achieves 100% bit-exact parity on strict SparseMemory113c (0 mismatches across all 12,600 records)', () => {
    const result = verifySkillCalcVectors(rawBytes)
    if (result.mismatches.length > 0) {
      const preview = result.mismatches
        .slice(0, 15)
        .map(
          m =>
            `rec#${m.index} (sk=${m.record.skillId} cls=${m.record.charClass} base=${m.record.baseSlvl} eff=${m.record.effSlvl} fc=${m.record.calcFieldCode} slot=0x${m.record.calcSlotOff.toString(16)} uf=0x${m.record.unitFlags.toString(16)}) ${m.field}: expected=${m.expected} actual=${m.actual}`,
        )
        .join('\n')
      expect.fail(`SKILLCALC mismatches (${result.mismatches.length}):\n${preview}`)
    }
    expect(result.mismatches.length).toBe(0)
    expect(result.totalRecords).toBe(12_600)

    /* Negative control: corrupt one output byte and verify mismatch detection */
    const corrupted = new Uint8Array(rawBytes)
    corrupted[32 + 500 * SKILLCALC_RECORD_SIZE + 32] ^= 0x01
    const bad = verifySkillCalcVectors(corrupted)
    expect(bad.mismatches.length).toBeGreaterThan(0)
  })
})
