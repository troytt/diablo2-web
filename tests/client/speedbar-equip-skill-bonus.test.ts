import { describe, expect, it } from 'vitest'
import { computeTotalSkillBonus } from '../../src/client/ui-model/hud-model.ts'

/**
 * Regression tests for issue #848: equipment "+X to skill" grants must count
 * toward the Speedbar availability even at 0 hard skill points - the #737
 * aggregation previously dropped equipBonus when `hard === 0`, hiding the
 * starting staff's +1 Firebolt from the right-click skill selection.
 */
describe('computeTotalSkillBonus (issue #848)', () => {
  it('applies an equipment grant at 0 hard points (starting staff +1 Firebolt)', () => {
    expect(computeTotalSkillBonus(undefined, 1)).toBe(1)
    expect(computeTotalSkillBonus(0, 1)).toBe(1)
  })

  it('stacks server-reported and equipment bonuses on invested skills', () => {
    expect(computeTotalSkillBonus(2, 1)).toBe(3)
    expect(computeTotalSkillBonus(0, 4)).toBe(4)
  })

  it('clamps negative sums to 0', () => {
    expect(computeTotalSkillBonus(-2, 1)).toBe(0)
  })

  it('returns 0 with no bonuses of any kind', () => {
    expect(computeTotalSkillBonus(undefined, 0)).toBe(0)
  })
})
