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
const PINNED_RAW_SHA256 = '4cbc24642477c779b2506b69d115a11c3759babe384220b309ca485672602cd9'

describe('[K3] Exit-Gate SKILLCALC D2TV binary vector suite (v1.13c DLL parity)', () => {
  const gzBytes = readFileSync(FIXTURE_GZ_PATH)
  const rawBytes = gunzipSync(gzBytes)

  it('validates D2TV header, pinned SHA-256 digest, compact size, and 7-class / 210-skill / slvl / synergy / mastery diversity', () => {
    expect(statSync(FIXTURE_GZ_PATH).size).toBeLessThan(200 * 1024)

    const sha = createHash('sha256').update(rawBytes).digest('hex')
    expect(sha).toBe(PINNED_RAW_SHA256)

    const { header, records } = parseSkillCalcVectors(rawBytes)
    expect(header.magic).toBe(D2TV_MAGIC)
    expect(header.version).toBe(1)
    expect(header.kind).toBe(D2TV_KIND_SKILLCALC)
    expect(header.recordSize).toBe(SKILLCALC_RECORD_SIZE)
    expect(header.recordCount).toBeGreaterThanOrEqual(1200)
    expect(records.length).toBe(1470)

    /* All 7 playable classes (Amazon..Assassin) */
    const classes = new Set(records.map(r => r.charClass))
    expect([...classes].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6])

    /* All 210 player skills in Skills.bin (30 per class x 7 classes) */
    const distinctSkills = new Set(records.map(r => r.skillId))
    expect(distinctSkills.size).toBe(210)

    /* Base slvl spans 1..30 across all 5 progression bands */
    const baseSlvls = new Set(records.map(r => r.baseSlvl))
    expect(baseSlvls.has(1)).toBe(true)
    expect(baseSlvls.has(8)).toBe(true)
    expect(baseSlvls.has(16)).toBe(true)
    expect(baseSlvls.has(22)).toBe(true)
    expect(baseSlvls.has(28)).toBe(true)
    expect(baseSlvls.has(30)).toBe(true)
    expect(baseSlvls.size).toBe(30)

    /* All 73 SkillCalc.txt field codes (0..72) covered */
    const fieldCodes = new Set(records.map(r => r.calcFieldCode))
    expect(fieldCodes.size).toBe(73)

    /* Real synergy skills, bonus skill levels, elemental damage, physical damage, and lengths */
    expect(records.filter(r => r.synSkillId[0] !== 0xffff && r.synBaseLvl[0] > 0).length).toBeGreaterThan(600)
    expect(records.filter(r => r.bonusSlvl > 0).length).toBeGreaterThan(1200)
    expect(records.filter(r => r.formulaVal !== 0).length).toBeGreaterThan(950)
    expect(records.filter(r => r.calcFieldVal !== 0).length).toBeGreaterThan(350)
    expect(records.filter(r => r.elemMaxDmg > 0).length).toBeGreaterThan(450)
    expect(records.filter(r => r.physMaxDmg > 0).length).toBeGreaterThan(250)
    expect(records.filter(r => r.elemLength > 0).length).toBeGreaterThan(150)
    expect(records.filter(r => r.toHitBonus !== 0).length).toBeGreaterThan(300)
    expect(records.filter(r => r.manaCost > 0).length).toBeGreaterThan(1000)
  })

  it('achieves 100% bit-exact parity on strict SparseMemory113c (0 mismatches across all 1,470 records)', () => {
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
    expect(result.totalRecords).toBeGreaterThanOrEqual(1200)

    /* Negative control: corrupt one output byte and verify mismatch detection */
    const corrupted = new Uint8Array(rawBytes)
    corrupted[32 + 500 * SKILLCALC_RECORD_SIZE + 32] ^= 0x01
    const bad = verifySkillCalcVectors(corrupted)
    expect(bad.mismatches.length).toBeGreaterThan(0)
  })
})
