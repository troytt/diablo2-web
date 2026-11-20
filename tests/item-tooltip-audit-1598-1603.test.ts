import { describe, expect, it } from 'vitest'
import {
  aggregateAndSortProperties,
  formatItemTooltip,
  formatPropertyCode,
  formatReplenishDurability,
  formatStatByIscDescFunc,
} from '../src/common/items/item-tooltip.ts'
import { encodeChargedSkillValue } from '../src/common/items/charged-skill.ts'
import { encodeByTimeStat113c } from '../src/server/engine/stat-list.ts'
import type { Item } from '../src/common/items/items.ts'

describe('D2Client.dll 1.13c Item Tooltip Parity (#1598, #1600, #1602, #1603)', () => {
  describe('#1598 — Enhanced Damage (stat 17 item_maxdamage_percent + stat 18 item_mindamage_percent, 0x6FB04000 / 0x6FB04594)', () => {
    it('merges item_mindamage_percent and item_maxdamage_percent when both are > 0, displaying stat 18 (+min% Enhanced Damage) and suppressing stat 17', () => {
      const mergedEqual = aggregateAndSortProperties([
        { code: 'item_maxdamage_percent', min: 150, max: 150, value: 150 },
        { code: 'item_mindamage_percent', min: 150, max: 150, value: 150 },
      ])
      expect(mergedEqual).toEqual([
        { code: 'dmg%', min: 150, max: 150, value: 150 },
      ])

      const mergedUnequal = aggregateAndSortProperties([
        { code: 'item_maxdamage_percent', min: 80, max: 80, value: 80 },
        { code: 'item_mindamage_percent', min: 45, max: 45, value: 45 },
      ])
      expect(mergedUnequal).toEqual([
        { code: 'dmg%', min: 45, max: 45, value: 45 },
      ])
      expect(formatPropertyCode('dmg%', 45)).toBe('+45% Enhanced Damage')
    })

    it('formats lone item_maxdamage_percent (stat 17) and lone item_mindamage_percent (stat 18) via descfunc=3, descval=0 (ModStr2j / ModStr2k)', () => {
      const loneMax = aggregateAndSortProperties([
        { code: 'item_maxdamage_percent', min: 50, max: 50, value: 50 },
      ])
      expect(loneMax).toEqual([
        { code: 'item_maxdamage_percent', min: 50, max: 50, value: 50 },
      ])
      expect(formatPropertyCode('item_maxdamage_percent', 50, 50, 50, undefined, 'en')).toBe(
        'Enhanced Maximum Damage',
      )
      expect(formatPropertyCode('item_maxdamage_percent', 50, 50, 50, undefined, 'zh')).toBe(
        '增加傷害上限',
      )

      const loneMin = aggregateAndSortProperties([
        { code: 'item_mindamage_percent', min: 35, max: 35, value: 35 },
      ])
      expect(loneMin).toEqual([
        { code: 'item_mindamage_percent', min: 35, max: 35, value: 35 },
      ])
      expect(formatPropertyCode('item_mindamage_percent', 35, 35, 35, undefined, 'en')).toBe(
        'Enhanced Minimum Damage',
      )
      expect(formatPropertyCode('item_mindamage_percent', 35, 35, 35, undefined, 'zh')).toBe(
        '增加傷害底限',
      )
    })

    it('applies separate edMinPct and edMaxPct to weapon damage in formatItemTooltip', () => {
      const item: Item = {
        id: 'test-ed-split',
        name: 'Magic Sword',
        quality: 'magic',
        level: 20,
        base: {
          id: 'lsd',
          name: 'Long Sword',
          kind: 'weapon',
          slot: 'weapon',
          width: 2,
          height: 3,
          defense: 0,
          mindam: 10,
          maxdam: 20,
          durability: 44,
        } as any,
        stats: {},
        rolledProps: [
          { code: 'item_mindamage_percent', min: 50, max: 50, value: 50 },
          { code: 'item_maxdamage_percent', min: 100, max: 100, value: 100 },
        ],
      } as any
      const tip = formatItemTooltip(item, 'en')
      expect(tip.oneHandDamage?.min).toBe(15)
      expect(tip.oneHandDamage?.max).toBe(40)
      expect(tip.lines.some(l => l.text === '+50% Enhanced Damage')).toBe(true)
    })
  })

  describe('#1600 — descfunc=11 item_replenish_durability (0x6FB051A5)', () => {
    it('matches D2Client.dll 0x6FB051A5 frame-based formula (v<=0 -> 25/sec, t<=30 -> 1/sec, else (t+12)/25 sec)', () => {
      expect(formatReplenishDurability(0, 'en')).toBe('Repairs 25 durability per second')
      expect(formatReplenishDurability(-5, 'en')).toBe('Repairs 25 durability per second')
      expect(formatReplenishDurability(0, 'zh')).toBe('每秒修复 25 点耐久度')

      // v=100 -> t=25 <= 30 -> ModStre9t(1)
      expect(formatReplenishDurability(100, 'en')).toBe('Repairs 1 durability per second')
      expect(formatReplenishDurability(84, 'en')).toBe('Repairs 1 durability per second')
      expect(formatReplenishDurability(100, 'zh')).toBe('每秒修复 1 点耐久度')

      // v=83 -> t=30 <= 30 -> ModStre9t(1); v=80 -> t=31 > 30 -> trunc(43/25)=1 sec in ModStre9u
      expect(formatReplenishDurability(83, 'en')).toBe('Repairs 1 durability per second')
      expect(formatReplenishDurability(80, 'en')).toBe('Repairs 1 durability in 1 seconds')

      // v=6 -> t=416 -> trunc((416+12)/25) = 17 seconds (not floor(100/6)=16)
      expect(formatReplenishDurability(6, 'en')).toBe('Repairs 1 durability in 17 seconds')
      expect(formatReplenishDurability(6, 'zh')).toBe('每 17 秒修复 1 点耐久度')

      // v=5 -> t=500 -> trunc(512/25) = 20 seconds
      expect(formatPropertyCode('rep-dur', 0, 0, 0, 5, 'en')).toBe('Repairs 1 durability in 20 seconds')
      expect(formatPropertyCode('rep-dur', 0, 0, 0, 5, 'zh')).toBe('每 20 秒修复 1 点耐久度')
      expect(formatStatByIscDescFunc('item_replenish_durability', 3, 3, 3, undefined, 'en')).toBe(
        'Repairs 1 durability in 33 seconds',
      )
    })
  })

  describe('#1602 — formatStatByIscDescFunc descFunc 13..18, 22..24, 27, 28 (0x6FB04E10)', () => {
    it('formats descFunc 13 (item_addclassskills) and descFunc 14 (item_addskill_tab)', () => {
      expect(formatStatByIscDescFunc('item_addclassskills', 2, 2, 2, 0, 'en')).toBe(
        '+2 to Amazon Skill Levels',
      )
      expect(formatStatByIscDescFunc('item_addclassskills', 2, 2, 2, 3, 'en')).toBe(
        '+2 to Paladin Skill Levels',
      )
      expect(formatStatByIscDescFunc('item_addclassskills', 2, 2, 2, 5, 'en')).toBe(
        '+2 to Druid Skills',
      )
      expect(formatStatByIscDescFunc('item_addskill_tab', 1, 1, 1, 0, 'en')).toBe(
        '+1 to Bow and Crossbow Skills (Amazon Only)',
      )
      expect(formatStatByIscDescFunc('item_addskill_tab', 3, 3, 3, 3, 'en')).toBe(
        '+3 to Fire Skills (Sorceress Only)',
      )
      // Packed binary param: class 3 (Paladin) << 3 | tab 0 (Combat) = 24
      expect(formatStatByIscDescFunc('item_addskill_tab', 2, 2, 2, (3 << 3) | 0, 'en')).toBe(
        '+2 to Combat Skills (Paladin Only)',
      )
    })

    it('formats descFunc 15 (proc skills) and descFunc 16 (item_aura)', () => {
      expect(formatStatByIscDescFunc('item_skillonattack', 10, 10, 3, 47, 'en')).toBe(
        '10% Chance to cast level 3 Fire Ball on attack',
      )
      expect(formatStatByIscDescFunc('item_skillonhit', 15, 15, 5, 53, 'en')).toBe(
        '15% Chance to cast level 5 Chain Lightning on striking',
      )
      expect(formatStatByIscDescFunc('item_aura', 12, 12, 12, 123, 'en')).toBe(
        'Level 12 Conviction Aura When Equipped',
      )
    })

    it('formats descFunc 17 & 18 (bytime stats 268..303) across all 4 periods (0x6FB85E20[0..3]) and packed encode=4', () => {
      // Period 0 = Daytime (ModStre9e), 1 = Dusk (ModStre9g), 2 = Nighttime (ModStre9d), 3 = Dawn (ModStre9f)
      expect(formatPropertyCode('ac/time', 50, 10, 50, 0, 'en')).toBe(
        '+50 Defense (Increases During Daytime)',
      )
      expect(formatPropertyCode('ac/time', 50, 10, 50, 1, 'en')).toBe(
        '+50 Defense (Increases Near Dusk)',
      )
      expect(formatPropertyCode('ac/time', 50, 10, 50, 2, 'en')).toBe(
        '+50 Defense (Increases During Nighttime)',
      )
      expect(formatPropertyCode('ac/time', 50, 10, 50, 3, 'en')).toBe(
        '+50 Defense (Increases Near Dawn)',
      )

      // Packed 22-bit encode=4 value via D2Common.#10449 (encodeByTimeStat113c)
      const packedDuskAc = encodeByTimeStat113c(1, 10, 45)
      expect(formatStatByIscDescFunc('item_armor_bytime', packedDuskAc, packedDuskAc, packedDuskAc, undefined, 'en')).toBe(
        '+45 Defense (Increases Near Dusk)',
      )

      // descFunc 18 (unsigned % value)
      const packedDawnMf = encodeByTimeStat113c(3, 5, 30)
      expect(formatStatByIscDescFunc('item_find_magic_bytime', packedDawnMf, packedDawnMf, packedDawnMf, undefined, 'en')).toBe(
        '30% Better Chance of Getting Magic Items (Increases Near Dawn)',
      )
    })

    it('formats descFunc 22 (attack/damage_vs_montype), 23 (item_reanimate), 24 (item_charged_skill), 27 (item_singleskill), and 28 (item_nonclassskill with +3 same-class cap)', () => {
      expect(formatStatByIscDescFunc('attack_vs_montype', 50, 50, 50, 12, 'en')).toBe(
        '+50% to Attack Rating versus: Fallen',
      )
      expect(formatStatByIscDescFunc('damage_vs_montype', 40, 40, 40, 13, 'en')).toBe(
        '+40% to Damage versus: Yeti',
      )
      expect(formatStatByIscDescFunc('item_reanimate', 10, 10, 10, 1, 'en')).toBe(
        '10% Reanimate as: Returned',
      )
      expect(formatStatByIscDescFunc('item_reanimate', 10, 10, 10, 2, 'en')).toBe(
        '10% Reanimate as: Bone Warrior',
      )
      const packedCharges = encodeChargedSkillValue(10, 25)
      expect(formatStatByIscDescFunc('item_charged_skill', packedCharges, 25, 3, 54, 'en')).toBe(
        'Level 3 Teleport (10/25 Charges)',
      )
      expect(formatStatByIscDescFunc('item_singleskill', 3, 3, 3, 47, 'en')).toBe(
        '+3 to Fire Ball (Sorceress Only)',
      )
      expect(formatStatByIscDescFunc('item_singleskill', 0, 0, 0, 47, 'en')).toBe('')

      // descFunc 28 (item_nonclassskill / oskill): +6 Teleport (Sorceress skill 54) is +6 for Paladin, capped at +3 for Sorceress (0x6FB0593E)
      expect(formatStatByIscDescFunc('item_nonclassskill', 6, 6, 6, 54, 'en', 1, 'pal')).toBe(
        '+6 to Teleport',
      )
      expect(formatStatByIscDescFunc('item_nonclassskill', 6, 6, 6, 54, 'en', 1, 'sor')).toBe(
        '+3 to Teleport',
      )
    })
  })

  describe('#1603 — Automatic Indestructible line when base.durability > 0 && !base.nodurability && item.maxDurability === 0 (0x6FB05E58)', () => {
    it('appends Indestructible (blue) when base item has durability > 0 and runtime maxDurability is 0 without duplicating explicit indestruct', () => {
      const zeroMaxDurArmor: Item = {
        id: 'test-indestruct-auto',
        name: 'Magic Plate',
        quality: 'magic',
        level: 30,
        durability: 0,
        maxDurability: 0,
        base: {
          id: 'plt',
          name: 'Plate Mail',
          kind: 'armor',
          slot: 'body',
          width: 2,
          height: 3,
          defense: 100,
          durability: 60,
        } as any,
        stats: {},
        rolledProps: [],
      } as any

      const tipEn = formatItemTooltip(zeroMaxDurArmor, 'en')
      expect(tipEn.lines.filter(l => l.text === 'Indestructible')).toHaveLength(1)
      expect(tipEn.durability).toBeUndefined()

      const tipZh = formatItemTooltip(zeroMaxDurArmor, 'zh')
      expect(tipZh.lines.filter(l => l.text === '无法破坏')).toHaveLength(1)

      // When item also has explicit `indestruct` property, it must not emit two Indestructible lines
      const withExplicitProp: Item = {
        ...zeroMaxDurArmor,
        rolledProps: [{ code: 'indestruct', min: 1, max: 1, value: 1 }],
      } as any
      const tipExplicit = formatItemTooltip(withExplicitProp, 'en')
      expect(tipExplicit.lines.filter(l => l.text === 'Indestructible')).toHaveLength(1)
    })
  })
})
