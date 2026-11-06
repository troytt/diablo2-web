import { describe, it, expect } from 'vitest'
import {
  formatItemTooltip,
  GEM_INFO,
  RUNE_INFO,
  getSocketableInfo,
  isGemCode,
  isRuneCode,
} from '../src/common/items/item-tooltip.ts'
import type { Item } from '../src/common/items/items.ts'
import { itemToUiInventoryItem } from '../src/common/items/item-bridge.ts'
import { InventoryPanel } from '../src/client/ui/inventory.ts'
import { WorldPanelsHud } from '../src/client/ui/world-panels.ts'
import { D2FontRenderer, type D2ColorCode, type D2FontName } from '../src/client/ui/font.ts'

describe('Diablo II 1.13c Gems & Runes Authentic Display Parity', () => {
  describe('1. Perfect Skull (skz) Screenshot Parity', () => {
    const perfectSkullItem: Item = {
      name: 'Perfect Skull',
      code: 'skz',
      base: { id: 'skz', name: 'Perfect Skull', kind: 'misc' } as any,
      prefix: null,
      suffix: null,
      level: 18,
      ilvl: 18,
      stats: {},
      invWidth: 1,
      invHeight: 1,
      stack: 1,
      value: 1000,
    }

    it('1.1 English format strictly matches structure, text, and reqLevel', () => {
      const tt = formatItemTooltip(perfectSkullItem, 'en')

      // Title & Quality
      expect(tt.title).toBe('Perfect Skull')
      expect(tt.subTitle).toBeUndefined()
      expect(tt.quality).toBe('Gem')
      expect(tt.qualityColor).toBe('#ffffff')
      expect(tt.baseType).toBe('Gem')
      expect(tt.isSocketable).toBe(true)

      // 5 Lines in formatItemTooltip: Instruction + 4 slots; reqLevel carried on tt.reqLevel
      // so WorldPanelsHud.drawItemTooltip renders it once at bottom in dynamic white/red.
      expect(tt.lines).toHaveLength(5)

      // Line 0: Instruction
      expect(tt.lines[0]).toEqual({
        text: 'Can be Inserted into Socketed Items',
        color: 'instruction',
      })

      // Lines 1..4: The 4 distinct slots in pure white
      expect(tt.lines[1]).toEqual({
        text: 'Weapons: 4% Life Stolen Per Hit, 3% Mana Stolen Per Hit',
        color: 'white',
      })
      expect(tt.lines[2]).toEqual({
        text: 'Armor: Regenerate Mana 19%, Replenish Life +5',
        color: 'white',
      })
      expect(tt.lines[3]).toEqual({
        text: 'Helms: Regenerate Mana 19%, Replenish Life +5',
        color: 'white',
      })
      expect(tt.lines[4]).toEqual({
        text: 'Shields: Attacker Takes Damage of 20',
        color: 'white',
      })

      expect(tt.reqLevel).toBe(18)
      expect(tt.lines.some(l => l.text.includes('Required Level'))).toBe(false)
    })

    it('1.2 Simplified Chinese format has authentic terminology and reqLevel', () => {
      const tt = formatItemTooltip(perfectSkullItem, 'zh')

      expect(tt.title).toBe('完美的骷髅')
      expect(tt.subTitle).toBeUndefined()
      expect(tt.quality).toBe('宝石')
      expect(tt.qualityColor).toBe('#ffffff')
      expect(tt.baseType).toBe('宝石')
      expect(tt.isSocketable).toBe(true)

      expect(tt.lines).toHaveLength(5)
      expect(tt.lines[0]?.text).toBe('可镶嵌进有凹槽的装备')
      expect(tt.lines[1]).toEqual({
        text: '武器: 每次命中偷取 4% 生命, 每次命中偷取 3% 法力',
        color: 'white',
      })
      expect(tt.lines[2]).toEqual({
        text: '防具: 法力恢复速度 19%, 生命恢复 +5',
        color: 'white',
      })
      expect(tt.lines[3]).toEqual({
        text: '头盔: 法力恢复速度 19%, 生命恢复 +5',
        color: 'white',
      })
      expect(tt.lines[4]).toEqual({
        text: '盾牌: 攻击者受到伤害 20',
        color: 'white',
      })
      expect(tt.reqLevel).toBe(18)
      expect(tt.lines.some(l => l.text.includes('需要等级'))).toBe(false)
    })

    it('1.3 Bilingual format includes both English and Chinese names', () => {
      const tt = formatItemTooltip(perfectSkullItem, 'bilingual')
      expect(tt.title).toBe('Perfect Skull (完美的骷髅)')
      expect(tt.lines[0]?.text).toBe('可镶嵌进有凹槽的装备')
      expect(tt.reqLevel).toBe(18)
    })
  })

  describe('2. Full Spectrum 35 Gems Verification', () => {
    it('2.1 Exactly 35 gems exist across 7 types and 5 tiers', () => {
      const codes = Object.keys(GEM_INFO)
      expect(codes).toHaveLength(35)
    })

    it('2.2 Every gem formats correctly with 4 distinct slots and reqLevel', () => {
      for (const [code, info] of Object.entries(GEM_INFO)) {
        const item: Item = {
          name: info.nameEn,
          code,
          base: { id: code, name: info.nameEn, kind: 'misc' } as any,
          prefix: null,
          suffix: null,
          level: info.reqLevel,
          ilvl: info.reqLevel,
          stats: {},
          invWidth: 1,
          invHeight: 1,
          stack: 1,
          value: 100,
        }

        const ttEn = formatItemTooltip(item, 'en')
        expect(ttEn.title).toBe(info.nameEn)
        expect(ttEn.qualityColor).toBe('#ffffff')
        expect(ttEn.isSocketable).toBe(true)
        expect(ttEn.lines).toHaveLength(5)
        expect(ttEn.lines[0]?.text).toBe('Can be Inserted into Socketed Items')
        expect(ttEn.lines[1]?.text).toBe(`Weapons: ${info.weaponsEn}`)
        expect(ttEn.lines[2]?.text).toBe(`Armor: ${info.armorEn}`)
        expect(ttEn.lines[3]?.text).toBe(`Helms: ${info.helmsEn}`)
        expect(ttEn.lines[4]?.text).toBe(`Shields: ${info.shieldsEn}`)
        expect(ttEn.reqLevel).toBe(info.reqLevel)

        const ttZh = formatItemTooltip(item, 'zh')
        expect(ttZh.title).toBe(info.nameZh)
        expect(ttZh.lines).toHaveLength(5)
        expect(ttZh.lines[0]?.text).toBe('可镶嵌进有凹槽的装备')
        expect(ttZh.lines[1]?.text).toBe(`武器: ${info.weaponsZh}`)
        expect(ttZh.lines[2]?.text).toBe(`防具: ${info.armorZh}`)
        expect(ttZh.lines[3]?.text).toBe(`头盔: ${info.helmsZh}`)
        expect(ttZh.lines[4]?.text).toBe(`盾牌: ${info.shieldsZh}`)
        expect(ttZh.reqLevel).toBe(info.reqLevel)
      }
    })
  })

  describe('3. Full Spectrum 33 Runes Verification', () => {
    it('3.1 Exactly 33 runes exist (r01..r33)', () => {
      const runeKeys = Object.keys(RUNE_INFO)
      expect(runeKeys).toHaveLength(33)
      for (let i = 1; i <= 33; i++) {
        const key = `r${String(i).padStart(2, '0')}`
        expect(RUNE_INFO[key]).toBeDefined()
        expect(RUNE_INFO[key]?.num).toBe(i)
      }
    })

    it('3.2 Hel Rune (r15) reqLevel=0 suppresses Required Level line', () => {
      const helItem: Item = {
        name: 'Hel Rune',
        code: 'r15',
        base: { id: 'r15', name: 'Hel Rune', kind: 'misc' } as any,
        prefix: null,
        suffix: null,
        level: 1,
        ilvl: 1,
        stats: {},
        invWidth: 1,
        invHeight: 1,
        stack: 1,
        value: 100,
      }
      const tt = formatItemTooltip(helItem, 'en')
      expect(tt.title).toBe('Hel Rune')
      expect(tt.reqLevel).toBeUndefined()
      // Exactly 5 lines: instruction + 4 slots (no Required Level line)
      expect(tt.lines).toHaveLength(5)
      expect(tt.lines.some(l => l.text.includes('Required Level'))).toBe(false)
    })

    it('3.3 Ber Rune (r30) formats with orange title and correct 4 slots', () => {
      const berItem: Item = {
        name: 'Ber Rune',
        code: 'r30',
        base: { id: 'r30', name: 'Ber Rune', kind: 'misc' } as any,
        prefix: null,
        suffix: null,
        level: 63,
        ilvl: 63,
        stats: {},
        invWidth: 1,
        invHeight: 1,
        stack: 1,
        value: 100,
      }
      const ttEn = formatItemTooltip(berItem, 'en')
      expect(ttEn.title).toBe('Ber Rune')
      expect(ttEn.subTitle).toBe('Rune (30)')
      expect(ttEn.qualityColor).toBe('#ff8c00')
      expect(ttEn.lines).toHaveLength(5)
      expect(ttEn.lines[1]?.text).toBe('Weapons: 20% Chance of Crushing Blow')
      expect(ttEn.lines[2]?.text).toBe('Armor: Damage Reduced by 8%')
      expect(ttEn.lines[3]?.text).toBe('Helms: Damage Reduced by 8%')
      expect(ttEn.lines[4]?.text).toBe('Shields: Damage Reduced by 8%')
      expect(ttEn.reqLevel).toBe(63)

      const ttZh = formatItemTooltip(berItem, 'zh')
      expect(ttZh.title).toBe('贝符文')
      expect(ttZh.subTitle).toBe('符文 (30)')
      expect(ttZh.qualityColor).toBe('#ff8c00')
      expect(ttZh.lines).toHaveLength(5)
      expect(ttZh.lines[1]?.text).toBe('武器: 20% 几率造成压碎打击')
      expect(ttZh.lines[2]?.text).toBe('防具: 伤害减少 8%')
      expect(ttZh.lines[3]?.text).toBe('头盔: 伤害减少 8%')
      expect(ttZh.lines[4]?.text).toBe('盾牌: 伤害减少 8%')
      expect(ttZh.reqLevel).toBe(63)
    })

    it('3.4 Jah Rune (r31) correctly differentiates Armor/Helms (+5% max life) vs Shields (+50 life)', () => {
      const jahItem: Item = {
        name: 'Jah Rune',
        code: 'r31',
        base: { id: 'r31', name: 'Jah Rune', kind: 'misc' } as any,
        prefix: null,
        suffix: null,
        level: 65,
        ilvl: 65,
        stats: {},
        invWidth: 1,
        invHeight: 1,
        stack: 1,
        value: 100,
      }
      const tt = formatItemTooltip(jahItem, 'en')
      expect(tt.lines[1]?.text).toBe("Weapons: Ignore Target's Defense")
      expect(tt.lines[2]?.text).toBe('Armor: Increase Maximum Life 5%')
      expect(tt.lines[3]?.text).toBe('Helms: Increase Maximum Life 5%')
      expect(tt.lines[4]?.text).toBe('Shields: +50 to Life')
    })
  })

  describe('4. Helper functions parity', () => {
    it('4.1 isGemCode identifies all gems and rejects non-gems', () => {
      expect(isGemCode('skz')).toBe(true)
      expect(isGemCode('gcv')).toBe(true)
      expect(isGemCode('gpw')).toBe(true)
      expect(isGemCode('r01')).toBe(false)
      expect(isGemCode('hax')).toBe(false)
      expect(isGemCode(undefined)).toBe(false)
    })

    it('4.2 isRuneCode identifies all runes and rejects non-runes', () => {
      expect(isRuneCode('r01')).toBe(true)
      expect(isRuneCode('r33')).toBe(true)
      expect(isRuneCode('skz')).toBe(false)
      expect(isRuneCode('r00')).toBe(false)
      expect(isRuneCode('r34')).toBe(false)
      expect(isRuneCode(undefined)).toBe(false)
    })

    it('4.3 getSocketableInfo returns valid info for both gems and runes', () => {
      const skz = getSocketableInfo('skz')
      expect(skz?.nameEn).toBe('Perfect Skull')

      const r30 = getSocketableInfo('r30')
      expect(r30?.nameEn).toBe('Ber Rune')

      expect(getSocketableInfo('invalid')).toBeUndefined()
    })
  })

  describe('5. WorldPanelsHud.drawItemTooltip Dynamic Required Level & Single Occurrence (Issue #723)', () => {
    function renderLines(
      uiItem: ReturnType<typeof itemToUiInventoryItem>,
      locale: 'zh' | 'en',
      playerLevel: number,
    ): Array<{ text: string; color?: D2ColorCode }> {
      const records: Array<{ text: string; color?: D2ColorCode }> = []
      const font = new D2FontRenderer()
      font.measureText = (text: string, _font: D2FontName = 'font8') => (text ? text.length * 7 : 0)
      font.drawText = (_ctx: CanvasRenderingContext2D, text: string, _x: number, _y: number, options: any = {}) => {
        records.push({ text, color: options.color })
      }
      const ctx = {
        fillStyle: '',
        strokeStyle: '',
        fillRect: () => {},
        strokeRect: () => {},
      } as unknown as CanvasRenderingContext2D
      const inv = new InventoryPanel()
      inv.setPlayerContext({
        level: playerLevel,
        str: 50,
        dex: 50,
        classCode: 'ama',
      })
      const hud = new WorldPanelsHud()
      hud.activePlayerInventory = inv
      hud.lang = locale === 'en' ? 'ENG' : 'CHI'
      hud.drawItemTooltip(ctx, { item: uiItem, x: 400, y: 300 }, font, false)
      return records
    }

    it('5.1 renders Required Level once at bottom in white when playerLevel >= reqLevel and in red when unmet', () => {
      const gemItem: Item = {
        id: 723,
        name: 'Amethyst',
        code: 'gsv',
        base: { id: 'gsv', name: 'Amethyst', nameZh: '紫宝石', kind: 'misc', invWidth: 1, invHeight: 1 } as any,
        quality: 2,
        identified: true,
        prefix: null,
        suffix: null,
        level: 12,
        ilvl: 12,
        stats: {},
        invWidth: 1,
        invHeight: 1,
        stack: 1,
        value: 150,
      }
      const uiGem = itemToUiInventoryItem(gemItem)

      const unmetZh = renderLines(uiGem, 'zh', 10)
      expect(unmetZh.map(r => r.text)).toEqual([
        '紫宝石',
        '可镶嵌进有凹槽的装备',
        `武器: ${GEM_INFO.gsv!.weaponsZh}`,
        `防具: ${GEM_INFO.gsv!.armorZh}`,
        `头盔: ${GEM_INFO.gsv!.helmsZh}`,
        `盾牌: ${GEM_INFO.gsv!.shieldsZh}`,
        '需要等级: 12',
      ])
      expect(unmetZh.at(-1)?.color).toBe('red')

      const metZh = renderLines(uiGem, 'zh', 22)
      expect(metZh.filter(r => r.text.includes('需要等级'))).toHaveLength(1)
      expect(metZh.at(-1)).toEqual({ text: '需要等级: 12', color: 'white' })
    })
  })
})
