import { describe, expect, it } from 'vitest'
import { autoCombatBadgeLabel } from '../../src/client/ui/auto-combat-badge.ts'

describe('auto-fight indicator', () => {
  it('names the state and the toggle key', () => {
    expect(autoCombatBadgeLabel({ on: true, key: 'E' }, 'ENG')).toBe('Auto-Fight ON (E)')
    expect(autoCombatBadgeLabel({ on: false, key: 'SPACE' }, 'ENG')).toBe('Auto-Fight OFF (Space)')
    expect(autoCombatBadgeLabel({ on: true, key: 'SPACE' }, 'CHI')).toBe('自动战斗 开 (空格)')
  })
})
