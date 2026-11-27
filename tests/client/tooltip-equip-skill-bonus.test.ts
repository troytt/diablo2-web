import { describe, expect, it } from 'vitest'
import { SkillTreePanel } from '../../src/client/ui/skill-tree-panel.ts'

/**
 * Regression tests for the #848 follow-up: skill tooltips must count equipment
 * "+X to skill" grants at 0 hard points. `getSkillCalcState` previously gated
 * `specificSoftPoints` on `hardPoints > 0`, so a fresh Sorceress relying on the
 * starting staff's +1 Firebolt saw "0+0" on hover.
 */
describe('SkillTreePanel tooltip equip bonus at 0 hard points (#848)', () => {
  it('reports effective level 1 for a 0-hard skill granted only by equipment', () => {
    const panel = new SkillTreePanel('sor')
    panel.bonusLevels.set(36, 1) // +1 Fire Bolt from the starting staff, 0 hard points

    const vm = panel.getTooltipViewModel(36)
    expect(vm).not.toBeNull()
    expect(vm!.hardPoints).toBe(0)
    expect(vm!.effectiveLevel).toBe(1)
    expect(vm!.isLearned).toBe(true)
  })

  it('still stacks equipment bonus on invested skills', () => {
    const panel = new SkillTreePanel('sor')
    panel.hardPoints.set(36, 3)
    panel.bonusLevels.set(36, 1)

    const vm = panel.getTooltipViewModel(36)
    expect(vm).not.toBeNull()
    expect(vm!.hardPoints).toBe(3)
    expect(vm!.effectiveLevel).toBe(4)
  })
})
