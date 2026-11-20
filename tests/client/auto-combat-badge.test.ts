import { describe, expect, it } from 'vitest'
import { autoCombatBadgeLook } from '../../src/client/ui/auto-combat-badge.ts'

describe('auto-fight indicator', () => {
  it('names the state and shows the toggle key as a hint', () => {
    expect(autoCombatBadgeLook({ on: true, key: 'E' }, 'ENG')).toMatchObject({ label: 'Auto-Fight on', hint: 'E', color: 'white' })
    expect(autoCombatBadgeLook({ on: false, key: 'SPACE' }, 'ENG')).toEqual({ label: 'Auto-Fight off', hint: 'Space', color: 'gray', pip: null })
    expect(autoCombatBadgeLook({ on: true, key: 'SPACE' }, 'CHI')).toMatchObject({ label: '自动战斗 开', hint: '空格' })
  })
})
