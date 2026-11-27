import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { doesSkillUseAttackRating } from '../../src/client/ui/character-sheet.ts'
import { SKILL_DESC_BY_SKILL_ID } from '../../src/common/data/skilldesc-table.ts'

/**
 * Issue #1591: D2Client.dll 0x6FADE350 shows the character-sheet Attack Rating box iff
 * SkillDesc.txt `descatt` selects a populated slot (1..5) of the descatt table at 0x6FBA52A0.
 */
describe('character sheet Attack Rating gate follows SkillDesc descatt (0x6FADE350)', () => {
  it('matches descatt for every skill in the baked SkillDesc table', () => {
    for (const rec of Object.values(SKILL_DESC_BY_SKILL_ID)) {
      expect(doesSkillUseAttackRating(rec.skillId), `skill ${rec.skillId} ${rec.skillDesc}`).toBe(rec.descatt >= 1 && rec.descatt <= 5)
    }
  })

  it('fixes the former hard-coded list mismatches', () => {
    expect(doesSkillUseAttackRating(25)).toBe(true) // Plague Javelin (descatt=1)
    for (const id of [1, 5, 9, 20, 24, 34, 257, 266, 277]) expect(doesSkillUseAttackRating(id)).toBe(false)
    expect(doesSkillUseAttackRating(-1)).toBe(false)
    expect(doesSkillUseAttackRating(null)).toBe(false)
  })

  const raw = join(process.cwd(), 'samples', 'd2', 'excel', 'SkillDesc.txt')
  it.runIf(existsSync(raw))('baked descatt equals the raw SkillDesc.txt column (49 skills)', () => {
    const lines = readFileSync(raw, 'latin1').split(/\r?\n/)
    const h = lines[0]!.split('\t')
    const iName = h.indexOf('skilldesc')
    const iAtt = h.indexOf('descatt')
    const byName = new Map(lines.slice(1).map(l => l.split('\t')).map(c => [c[iName], Number(c[iAtt] || 0)]))
    let withAtt = 0
    for (const rec of Object.values(SKILL_DESC_BY_SKILL_ID)) {
      expect(rec.descatt).toBe(byName.get(rec.skillDesc) ?? 0)
      if (rec.descatt && rec.skillId < 281) withAtt++
    }
    expect(withAtt).toBe(49)
  })
})
