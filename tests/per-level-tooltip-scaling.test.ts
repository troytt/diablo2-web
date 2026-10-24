import { describe, expect, it, vi } from 'vitest'
import { formatItemTooltip, formatPropertyCode, formatStatByIscDescFunc } from '../src/common/items/item-tooltip.ts'
import type { Item } from '../src/common/items/items.ts'
import { formatPropertyCodeI18n } from '../src/common/i18n/tooltip-i18n.ts'
import {
  convertOnlineItemStatsToRolledProps,
  itemToUiInventoryItem,
  onlineItemDataToUiInventoryItem,
  rolledPropsToItemStats,
} from '../src/common/items/item-bridge.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { InventoryPanel } from '../src/client/ui/inventory.ts'
import { WorldPanelsHud } from '../src/client/ui/world-panels.ts'
import type { D2ColorCode, D2FontName, D2FontRenderer } from '../src/client/ui/font.ts'

describe('Per-Level Item Property Tooltip Scaling (1.13c D2Client.dll 0x6FB046E0 & 0x6FB04E10)', () => {
  it('scales Enigma str/lvl (6 eighths = 0.75/lvl) and mag%/lvl (8 eighths = 1/lvl) by character level in zh and en', () => {
    // At level 90:
    // str/lvl: floor(6 * 90 / 8) = floor(67.5) = 67
    // mag%/lvl: floor(8 * 90 / 8) = 90
    expect(formatPropertyCode('str/lvl', 0, 0, 0, 6, 'zh', 90)).toBe('+67 力量 (依角色等级提升)')
    expect(formatPropertyCode('str/lvl', 0, 0, 0, 6, 'en', 90)).toBe(
      '+67 to Strength (Based on Character Level)',
    )
    expect(formatPropertyCode('mag%/lvl', 0, 0, 0, 8, 'zh', 90)).toBe(
      '90% 获得魔法装备几率 (依角色等级提升)',
    )
    expect(formatPropertyCode('mag%/lvl', 0, 0, 0, 8, 'en', 90)).toBe(
      '90% Better Chance of Getting Magic Items (Based on Character Level)',
    )

    // At level 99:
    // str/lvl: floor(6 * 99 / 8) = floor(74.25) = 74
    // mag%/lvl: floor(8 * 99 / 8) = 99
    expect(formatPropertyCodeI18n('str/lvl', 0, 0, 0, 6, 'zh', 99)).toBe('+74 力量 (依角色等级提升)')
    expect(formatPropertyCodeI18n('mag%/lvl', 0, 0, 0, 8, 'zh', 99)).toBe(
      '99% 获得魔法装备几率 (依角色等级提升)',
    )
  })

  it('normalizes ValShift=8 on hp/lvl (statId 216) and mana/lvl (statId 217) for both .txt and wire values', () => {
    // Shako: 12 eighths (1.5 per level) -> at level 80: floor(12 * 80 / 8) = 120
    expect(formatPropertyCode('hp/lvl', 12, 12, 12, undefined, 'zh', 80)).toBe(
      '+120 生命 (依角色等级提升)',
    )
    expect(formatPropertyCode('mana/lvl', 12, 12, 12, undefined, 'en', 80)).toBe(
      '+120 to Mana (Based on Character Level)',
    )

    // Wire-decoded packet value with ValShift=8 (12 << 8 = 3072)
    const { props } = convertOnlineItemStatsToRolledProps([
      { statId: 216, param: 0, value: 12 << 8 },
      { statId: 217, param: 0, value: 12 << 8 },
    ])
    expect(props).toEqual([
      { code: 'hp/lvl', min: 12, max: 12, value: 12 },
      { code: 'mana/lvl', min: 12, max: 12, value: 12 },
    ])

    // Even if a shifted value (3072) is passed directly to formatPropertyCode / formatStatByIscDescFunc
    expect(formatPropertyCode('hp/lvl', 12 << 8, 12 << 8, 12 << 8, undefined, 'zh', 80)).toBe(
      '+120 生命 (依角色等级提升)',
    )
    expect(formatStatByIscDescFunc('item_hp_perlevel', 12 << 8, 12 << 8, 12 << 8, undefined, 'en', 80)).toBe(
      '+120 to Life (Based on Character Level)',
    )
  })

  it('preserves eighths rate in rolledPropsToItemStats when per-level prop stores rate in param with value=0', () => {
    const stats = rolledPropsToItemStats([
      { code: 'str/lvl', param: 6, min: 0, max: 0, value: 0 },
      { code: 'mag%/lvl', param: 8, min: 0, max: 0, value: 0 },
    ])
    expect(stats).toEqual([
      { statId: 220, value: 6 },
      { statId: 240, value: 8 },
    ])
  })

  it('formats full Enigma tooltip at character level 85 without raw per-level decimals', () => {
    const enigmaItem = {
      id: 101,
      code: 'xtp',
      name: 'Enigma',
      quality: 'rune',
      identified: true,
      charLevel: 85,
      runewordRunes: "'JahIthBer'",
      totalSockets: 3,
      base: {
        id: 'xtp',
        name: 'Mage Plate',
        kind: 'armor',
        defense: 250,
        durability: 60,
        reqStr: 55,
        reqLevel: 25,
        invWidth: 2,
        invHeight: 3,
        maxStack: 1,
        value: 1000,
        damage: 0,
        tags: ['tors', 'armo'],
        level: 65,
      },
      rolledProps: [
        { code: 'allskills', min: 2, max: 2, value: 2 },
        { code: 'frw', min: 45, max: 45, value: 45 },
        { code: 'oskill', param: 'Teleport', min: 1, max: 1, value: 1 },
        { code: 'ac', min: 750, max: 775, value: 762 },
        { code: 'str/lvl', param: 6, min: 0, max: 0, value: 0 },
        { code: 'hp%', min: 5, max: 5, value: 5 },
        { code: 'dmg-to-mana', min: 15, max: 15, value: 15 },
        { code: ' heal-kill', min: 14, max: 14, value: 14 },
        { code: 'red-dmg%', min: 8, max: 8, value: 8 },
        { code: 'mag%/lvl', param: 8, min: 0, max: 0, value: 0 },
      ],
    } as unknown as Item

    const ttZh = formatItemTooltip(enigmaItem, 'zh')
    const ttEn = formatItemTooltip(enigmaItem, 'en')

    const zhTexts = ttZh.lines.map(l => l.text)
    const enTexts = ttEn.lines.map(l => l.text)

    // floor(6 * 85 / 8) = 63; floor(8 * 85 / 8) = 85
    expect(zhTexts).toContain('+63 力量 (依角色等级提升)')
    expect(zhTexts).toContain('85% 获得魔法装备几率 (依角色等级提升)')
    expect(zhTexts.some(t => t.includes('+0.8'))).toBe(false)

    expect(enTexts).toContain('+63 to Strength (Based on Character Level)')
    expect(enTexts).toContain('85% Better Chance of Getting Magic Items (Based on Character Level)')
  })

  it('recomputes per-level tooltip lines in WorldPanelsHud.drawItemTooltip when playerContext.level changes', () => {
    const inv = new InventoryPanel()
    inv.setPlayerContext({ level: 88, str: 150, dex: 100 })
    const hud = new WorldPanelsHud()
    hud.activePlayerInventory = inv

    // Create item without explicit charLevel on domain Item (defaults to 1 at construction time)
    const uiItem = itemToUiInventoryItem({
      id: 202,
      code: 'xtp',
      name: 'Enigma',
      quality: 'rune',
      identified: true,
      runewordRunes: "'JahIthBer'",
      totalSockets: 3,
      base: {
        id: 'xtp',
        name: 'Mage Plate',
        kind: 'armor',
        defense: 250,
        durability: 60,
        reqStr: 55,
        reqLevel: 25,
        invWidth: 2,
        invHeight: 3,
        maxStack: 1,
        value: 1000,
        damage: 0,
        tags: ['tors', 'armo'],
        level: 65,
      },
      rolledProps: [
        { code: 'str/lvl', param: 6, min: 0, max: 0, value: 0 },
        { code: 'mag%/lvl', param: 8, min: 0, max: 0, value: 0 },
      ],
    } as unknown as Item)

    const drawnTexts: string[] = []
    const mockFont = {
      metas: {} as any,
      images: new Map(),
      tintedCache: new Map(),
      getTintedAtlas: vi.fn(),
      measureText: (text: string, _font: D2FontName = 'font16') => text.length * 8,
      drawText: (_ctx: CanvasRenderingContext2D, text: string, _x: number, _y: number, _opts?: { color?: D2ColorCode }) => {
        drawnTexts.push(text)
      },
    } as unknown as D2FontRenderer

    const mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    hud.lang = 'CHI'
    hud.drawItemTooltip(mockCtx, { item: uiItem, x: 400, y: 300 }, mockFont)

    // At playerContext.level = 88: floor(6 * 88 / 8) = 66, floor(8 * 88 / 8) = 88
    expect(drawnTexts).toContain('+66 力量 (依角色等级提升)')
    expect(drawnTexts).toContain('88% 获得魔法装备几率 (依角色等级提升)')
  })

  it('scales onlineItemDataToUiInventoryItem per-level stats with playerLevel', () => {
    const uiItem = onlineItemDataToUiInventoryItem(
      {
        id: 303,
        code: 'xtp',
        name: 'Enigma',
        quality: 4,
        identified: true,
        runewordId: 37,
        stats: [
          { statId: 220, param: 0, value: 6 },
          { statId: 240, param: 0, value: 8 },
        ],
      } as any,
      undefined,
      undefined,
      92,
    )
    // At level 92: floor(6 * 92 / 8) = 69, floor(8 * 92 / 8) = 92
    expect(uiItem.stats.map(s => s.text)).toContain('+69 力量 (依角色等级提升)')
    expect(uiItem.stats.map(s => s.text)).toContain('92% 获得魔法装备几率 (依角色等级提升)')
    expect(uiItem.statsEn?.map(s => s.text)).toContain('+69 to Strength (Based on Character Level)')
    expect(uiItem.statsEn?.map(s => s.text)).toContain(
      '92% Better Chance of Getting Magic Items (Based on Character Level)',
    )
  })
})
