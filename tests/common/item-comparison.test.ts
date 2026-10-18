import { describe, expect, it } from 'vitest'
import { compareItems, upgradeVerdict } from '../../src/common/items/item-comparison.ts'
import type { UiInventoryItem } from '../../src/common/items/inventory-model.ts'

const stat = (statId: number, value: number, param = 0) => ({ statId, param, value })
const item = ({ mods = [], ...fields }: Partial<Omit<UiInventoryItem, 'stats'>> & { mods?: ReturnType<typeof stat>[] }): UiInventoryItem =>
  ({ id: Math.random().toString(), allowedSlots: ['helm'], ...fields, rawItem: { stats: mods } }) as unknown as UiInventoryItem
const usable = { canUse: true, unidentified: false }

describe('item comparison', () => {
  it('calls an item better only when it is at least as good everywhere and better somewhere', () => {
    const worn = item({ defense: 20, mods: [stat(0, 5)] })
    expect(compareItems(item({ defense: 24, mods: [stat(0, 5)] }), worn)).toBe('better')
    expect(compareItems(item({ defense: 20, mods: [stat(0, 5), stat(39, 10)] }), worn)).toBe('better')
    expect(compareItems(item({ defense: 18, mods: [stat(0, 5)] }), worn)).toBeNull()
    expect(compareItems(item({ defense: 20, mods: [stat(0, 5)] }), worn)).toBeNull()
  })

  it('is unsure when the item trades one stat for another', () => {
    expect(compareItems(item({ defense: 40 }), item({ defense: 20, mods: [stat(7, 10)] }))).toBe('unsure')
  })

  it('calls it much better for a big jump in damage or defence, or an empty slot', () => {
    const sword = (min: number, max: number) => item({ allowedSlots: ['weapon1'], oneHandDamage: { min, max } })
    expect(compareItems(sword(10, 20), sword(4, 8))).toBe('much-better')
    expect(compareItems(sword(5, 9), sword(4, 8))).toBe('better')
    expect(compareItems(sword(5, 9), null)).toBe('much-better')
  })

  it('compares rings against the weaker ring and ignores items you cannot use', () => {
    const ring = (life: number) => item({ allowedSlots: ['ring1', 'ring2'], mods: [stat(7, life)] })
    const equipped = { ring1: ring(40), ring2: ring(5) }
    expect(upgradeVerdict(ring(10), equipped, usable)).toBe('better')
    expect(upgradeVerdict(ring(10), equipped, { canUse: false, unidentified: false })).toBeNull()
    expect(upgradeVerdict(ring(10), equipped, { canUse: true, unidentified: true })).toBe('unsure')
  })

  it('does not weigh a shield against a weapon or flag a two-hander as a clear win over sword and board', () => {
    const shield = item({ allowedSlots: ['weapon2'], defense: 10 })
    const sword = item({ allowedSlots: ['weapon1', 'weapon2'], oneHandDamage: { min: 4, max: 8 } })
    const bigSword = item({ allowedSlots: ['weapon1', 'weapon2'], oneHandDamage: { min: 9, max: 14 } })
    const twoHander = item({ allowedSlots: ['weapon1'], twoHanded: true, twoHandDamage: { min: 20, max: 30 } })
    expect(upgradeVerdict(bigSword, { weapon1: sword, weapon2: shield }, usable)).toBe('much-better')
    expect(upgradeVerdict(twoHander, { weapon1: sword, weapon2: shield }, usable)).toBe('unsure')
  })

  describe('for your class and build', () => {
    const NEC = 2
    const necro = (points: Record<number, number>) => ({ classIndex: NEC, skillPoints: new Map(Object.entries(points).map(([id, p]) => [Number(id), p])) })
    const summoner = necro({ 70: 10, 69: 5 })
    const wand = (mods: ReturnType<typeof stat>[], min = 2, max = 4) => item({ allowedSlots: ['weapon1'], oneHandDamage: { min, max }, mods })
    const wear = (candidate: UiInventoryItem, current: UiInventoryItem, build = summoner) => upgradeVerdict(candidate, { weapon1: current }, { ...usable, build })

    it('values +skills to your own class and ignores other classes', () => {
      expect(wear(wand([stat(83, 1, NEC)]), wand([]))).toBe('better')
      expect(wear(wand([stat(83, 2, 4)]), wand([]))).toBeNull()
    })

    it('counts a skill tab only if you have points in it', () => {
      const summoning = stat(188, 2, NEC * 8 + 2)
      const curses = stat(188, 2, NEC * 8 + 0)
      expect(wear(wand([summoning]), wand([]))).toBe('better')
      expect(wear(wand([curses]), wand([]))).toBeNull()
    })

    it('counts single-skill bonuses only for skills you use', () => {
      expect(wear(wand([stat(107, 3, 70)]), wand([]))).toBe('better')
      expect(wear(wand([stat(107, 3, 74)]), wand([]))).toBeNull()
    })

    it('ignores weapon damage and attack-only stats for a caster build', () => {
      expect(wear(wand([], 20, 30), wand([stat(83, 1, NEC)]))).toBeNull()
      expect(wear(wand([stat(19, 50), stat(83, 1, NEC)]), wand([stat(83, 1, NEC)]))).toBeNull()
      expect(wear(wand([], 20, 30), wand([]), necro({ 0: 0 }))).toBe('much-better')
    })
  })
})

