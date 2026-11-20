import { describe, expect, it } from 'vitest'
import { formatPropertyCode } from '../../src/common/items/item-tooltip.ts'
import { chargedSkillChargesOf, decodeChargedSkillValue, encodeChargedSkillValue } from '../../src/common/items/charged-skill.ts'

/** Issue #1599: D2Client.dll 0x6FB056C2 prints "(cur/max Charges)" from the packed stat 204 value. */
describe('charged skill tooltip (descfunc 24)', () => {
  it('decodes / encodes (max << 8) | cur', () => {
    expect(decodeChargedSkillValue((15 << 8) | 7)).toEqual({ current: 7, max: 15 })
    expect(encodeChargedSkillValue(7, 15)).toBe((15 << 8) | 7)
    expect(chargedSkillChargesOf(12, 12)).toEqual({ current: 12, max: 12 })
  })

  it('shows current/max charges for online items and full charges for fresh rolls', () => {
    // Venom runeword: charged 83 (Poison Explosion) 27 charges level 15 — partly used
    expect(formatPropertyCode('charged', (27 << 8) | 4, 4, 15, 83, 'en')).toMatch(/^Level 15 .+ \(4\/27 Charges\)$/)
    expect(formatPropertyCode('charged', 27, 27, 15, 83, 'en')).toMatch(/\(27\/27 Charges\)$/)
    expect(formatPropertyCode('charged', (27 << 8) | 4, 4, 15, 83, 'zh')).toContain('4/27')
  })
})
