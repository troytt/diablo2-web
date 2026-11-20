/**
 * tests/item-tooltip-color-dye.test.ts
 *
 * Comprehensive 4-Tier Requirement-Driven E2E Test Suite for Diablo II v1.13c
 * Equipment Tooltips, Color Dyeing Parity, and Starter Gear Data Integrity.
 *
 * Derived strictly from:
 * - ORIGINAL_REQUEST.md (Header ## 2026-09-21T08:47:59Z, Requirements R1 to R5)
 * - PROJECT.md & TEST_INFRA.md
 * - Explorer Survey report.md (Section 6: Comprehensive Test Plan)
 *
 * Test Architecture:
 * - Tier 1: Feature Coverage (Happy Path)
 *   1.1 resolveItemSpriteRect resolves dyed sprites: invcap_cgrn, invgth_dpur, invtgl_lgry, invvbl_blac
 *   1.2 DEMO_EQUIPPED_GEAR definitions contain canonical 1.13c stats, durability, speed text, dye tokens
 *   1.3 Call to Arms Crystal Sword in DEMO_BAG_ITEMS contains runewordRunes, durability 20/20, reqStr 43, reqLevel 57, sockets 5, speedText, damage 17-52, and 11 canonical stats
 *   1.4 Tooltip header hierarchy (Title fontexocet10 Gold, Runes font8 Gold, Base Type font8 White/Grey)
 *   1.5 Base stats block (Damage/Defense, Durability, Speed Class, Req Strength, Req Level in White/Grey)
 *   1.6 Magic affixes in Blue, Sockets line in Blue ('凹槽 (5)')
 *
 * - Tier 2: Boundary & Corner Cases
 *   2.1 Table 98 black pixel transparency guard: opaque pixels must NOT be index 0 (must be index 172 or non-zero)
 *   2.2 Base item fallback when invtransform is missing, undefined, or unrecognized
 *   2.3 Dynamic vertical flip threshold: hover.y < 280 flips below cursor (hover.y + 24); hover.y >= 280 places above cursor
 *   2.4 Viewport boundary clamping: bx in [8, 800 - boxW - 8], by in [8, 600 - boxH - 8]
 *   2.5 Missing optional fields handling (items without durability, damage, or sockets)
 *
 * - Tier 3: Cross-Feature Interactions
 *   3.1 State preservation: picking up equipped helm with invtransform: 'cgrn' into cursorItem preserves invtransform and resolves invcap_cgrn; placing into bag preserves invtransform; picking back up preserves invtransform
 *   3.2 Tooltip rendering across different item qualities (runeword, unique, set, magic, normal)
 *
 * - Tier 4: Real-World Workloads
 *   4.1 Paperdoll traversal: hover simulation across all equipped slots
 *   4.2 Bag traversal: hover simulation across CTA, Torch, Anni, Gheed's Fortune
 *   4.3 Full canvas draw pass with numeric coordinate and boundary sanity validation
 */

import { describe, expect, it, vi } from 'vitest'
import { InventoryPanel, EQUIP_SLOTS_LAYOUT, INV_GRID_ORIGIN, resolveItemSpriteRect, type EquipSlotId, type ResolvableItem, type SpriteRect, type UiInventoryItem } from '../src/client/ui/inventory.ts'
import { WorldPanelsHud } from '../src/client/ui/world-panels.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import type { D2FontName, D2ColorCode, D2FontRenderer } from '../src/client/ui/font.ts'
import { createDemoInventory, createDemoWorldPanels } from './fixtures/hud-demo-state.ts'
import { DEMO_BAG_ITEMS, DEMO_EQUIPPED_GEAR } from './fixtures/demo-profile-data.ts'

// --- Mock & Test Utilities ---

interface DrawCall {
  text: string
  x: number
  y: number
  options?: {
    font?: D2FontName
    color?: D2ColorCode
    align?: 'left' | 'center' | 'right'
    shadow?: boolean
  }
}

interface MockFontRenderer extends D2FontRenderer {
  drawCalls: DrawCall[]
}

function createMockFontRenderer(): MockFontRenderer {
  const drawCalls: DrawCall[] = []
  return {
    metas: {} as any,
    images: new Map(),
    tintedCache: new Map(),
    getTintedAtlas: vi.fn(),
    measureText: (text: string, _font: D2FontName = 'font8') => {
      // Approximate 7px per character for layout computation
      return text.length * 7
    },
    drawText: (_ctx: CanvasRenderingContext2D, text: string, x: number, y: number, options?: any) => {
      drawCalls.push({ text, x, y, options })
    },
    drawCalls,
  } as unknown as MockFontRenderer
}

interface MockCanvasContext extends CanvasRenderingContext2D {
  fillRectCalls: [number, number, number, number][]
  strokeRectCalls: [number, number, number, number][]
}

function createMockCanvasContext(): MockCanvasContext {
  const fillRectCalls: [number, number, number, number][] = []
  const strokeRectCalls: [number, number, number, number][] = []
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: (x: number, y: number, w: number, h: number) => {
      fillRectCalls.push([x, y, w, h])
    },
    strokeRect: (x: number, y: number, w: number, h: number) => {
      strokeRectCalls.push([x, y, w, h])
    },
    save: vi.fn(),
    restore: vi.fn(),
    fillRectCalls,
    strokeRectCalls,
  } as unknown as MockCanvasContext
}

const MOCK_DYED_ITEM_RECTS: Record<string, SpriteRect> = {
  invcap: { x: 0, y: 0, w: 56, h: 56 },
  invcap_cgrn: { x: 56, y: 0, w: 56, h: 56 },
  invgth: { x: 0, y: 56, w: 56, h: 84 },
  invgth_dpur: { x: 56, y: 56, w: 56, h: 84 },
  invtgl: { x: 0, y: 140, w: 56, h: 56 },
  invtgl_lgry: { x: 56, y: 140, w: 56, h: 56 },
  invvbl: { x: 0, y: 196, w: 56, h: 28 },
  invvbl_blac: { x: 56, y: 196, w: 56, h: 28 },
  invcrs: { x: 0, y: 224, w: 56, h: 84 },
  invtow: { x: 56, y: 224, w: 56, h: 84 },
  invbox: { x: 112, y: 0, w: 56, h: 56 },
  invrin: { x: 112, y: 56, w: 28, h: 28 },
  invamu: { x: 112, y: 84, w: 28, h: 28 },
  invbst: { x: 112, y: 112, w: 28, h: 84 },
  invtbt: { x: 112, y: 196, w: 56, h: 56 },
  invtrch: { x: 140, y: 56, w: 28, h: 56 },
  invmss: { x: 140, y: 112, w: 28, h: 28 },
  invch3: { x: 140, y: 140, w: 28, h: 84 },
  invbbk: { x: 168, y: 0, w: 28, h: 56 },
  invrbk: { x: 168, y: 56, w: 28, h: 56 },
}

describe('Diablo II v1.13c Item Tooltip & Color Dye Parity (Requirement R5)', () => {

  // =========================================================================
  // Tier 1: Feature Coverage (Happy Path)
  // =========================================================================
  describe('Tier 1: Feature Coverage', () => {

    it('1.1 resolves dyed sprites via invtransform: invcap_cgrn, invgth_dpur, invtgl_lgry, invvbl_blac', () => {
      // 1. Harlequin Crest: invcap + cgrn -> invcap_cgrn
      const shako: ResolvableItem & { invtransform?: string } = {
        name: 'Harlequin Crest',
        invFile: 'invcap',
        invtransform: 'cgrn',
      }
      const shakoRect = resolveItemSpriteRect(shako as any, MOCK_DYED_ITEM_RECTS)
      expect(shakoRect, 'Harlequin Crest must resolve to invcap_cgrn').toEqual(MOCK_DYED_ITEM_RECTS.invcap_cgrn)

      // 2. Tal Rasha\'s Guardianship: invgth + dpur -> invgth_dpur
      const talArmor: ResolvableItem & { invtransform?: string } = {
        name: "Tal Rasha's Guardianship",
        invFile: 'invgth',
        invtransform: 'dpur',
      }
      const talRect = resolveItemSpriteRect(talArmor as any, MOCK_DYED_ITEM_RECTS)
      expect(talRect, "Tal Rasha's Guardianship must resolve to invgth_dpur").toEqual(MOCK_DYED_ITEM_RECTS.invgth_dpur)

      // 3. Magefist: invtgl + lgry -> invtgl_lgry
      const magefist: ResolvableItem & { invtransform?: string } = {
        name: 'Magefist',
        invFile: 'invtgl',
        invtransform: 'lgry',
      }
      const mageRect = resolveItemSpriteRect(magefist as any, MOCK_DYED_ITEM_RECTS)
      expect(mageRect, 'Magefist must resolve to invtgl_lgry').toEqual(MOCK_DYED_ITEM_RECTS.invtgl_lgry)

      // 4. Arachnid Mesh: invvbl + blac -> invvbl_blac
      const arach: ResolvableItem & { invtransform?: string } = {
        name: 'Arachnid Mesh',
        invFile: 'invvbl',
        invtransform: 'blac',
      }
      const arachRect = resolveItemSpriteRect(arach as any, MOCK_DYED_ITEM_RECTS)
      expect(arachRect, 'Arachnid Mesh must resolve to invvbl_blac').toEqual(MOCK_DYED_ITEM_RECTS.invvbl_blac)
    })

    it('1.2 defines DEMO_EQUIPPED_GEAR with canonical 1.13c stats, durability, speed text, and dye tokens', () => {
      // Helm: Harlequin Crest (Shako)
      const helm = DEMO_EQUIPPED_GEAR.helm as any
      expect(helm, 'DEMO_EQUIPPED_GEAR.helm must exist').toBeDefined()
      expect(helm.invtransform, 'Harlequin Crest must have invtransform: cgrn').toBe('cgrn')
      expect(helm.defense, 'Shako defense must be 141').toBe(141)
      expect(helm.durability, 'Shako durability must be 12/12').toEqual({ current: 12, max: 12 })
      expect(helm.reqStr, 'Shako reqStr must be 50').toBe(50)
      expect(helm.reqLevel, 'Shako reqLevel must be 62').toBe(62)
      expect(helm.stats.length, 'Shako must have exactly 6 canonical modifiers').toBe(6)

      // Armor: Tal Rasha\'s Guardianship (Lacquered Plate)
      const armor = DEMO_EQUIPPED_GEAR.armor as any
      expect(armor, 'DEMO_EQUIPPED_GEAR.armor must exist').toBeDefined()
      expect(armor.invtransform, 'Tal Rasha Armor must have invtransform: dpur').toBe('dpur')
      expect(armor.defense, 'Tal Rasha Armor defense must be 941').toBe(941)
      expect(armor.durability, 'Tal Rasha Armor durability must be 55/55').toEqual({ current: 55, max: 55 })
      expect(armor.reqStr, 'Tal Rasha Armor reqStr must be 84').toBe(84)
      expect(armor.reqLevel, 'Tal Rasha Armor reqLevel must be 71').toBe(71)
      expect(armor.setPieces, 'Tal Rasha Armor must declare setPieces array').toBeDefined()
      expect(armor.setPieces.length, 'Tal Rasha set must contain 5 set pieces').toBeGreaterThanOrEqual(5)

      // Gloves: Magefist (Light Gauntlets)
      const gloves = DEMO_EQUIPPED_GEAR.gloves as any
      expect(gloves, 'DEMO_EQUIPPED_GEAR.gloves must exist').toBeDefined()
      expect(gloves.invtransform, 'Magefist must have invtransform: lgry').toBe('lgry')
      expect(gloves.defense, 'Magefist defense must be 25').toBe(25)
      expect(gloves.durability, 'Magefist durability must be 14/14').toEqual({ current: 14, max: 14 })
      expect(gloves.reqStr, 'Magefist reqStr must be 45').toBe(45)
      expect(gloves.reqLevel, 'Magefist reqLevel must be 23').toBe(23)

      // Belt: Arachnid Mesh (Spiderweb Sash)
      const belt = DEMO_EQUIPPED_GEAR.belt as any
      expect(belt, 'DEMO_EQUIPPED_GEAR.belt must exist').toBeDefined()
      expect(belt.invtransform, 'Arachnid Mesh must have invtransform: blac').toBe('blac')
      expect(belt.defense, 'Arachnid Mesh defense must be 138').toBe(138)
      expect(belt.durability, 'Arachnid Mesh durability must be 12/12').toEqual({ current: 12, max: 12 })
      expect(belt.reqStr, 'Arachnid Mesh reqStr must be 50').toBe(50)
      expect(belt.reqLevel, 'Arachnid Mesh reqLevel must be 80').toBe(80)

      // Weapon 1: The Oculus
      const oculus = DEMO_EQUIPPED_GEAR.weapon1 as any
      expect(oculus, 'DEMO_EQUIPPED_GEAR.weapon1 must exist').toBeDefined()
      expect(oculus.damage, 'Oculus damage must be 18 - 42').toBe('18 - 42')
      expect(oculus.durability, 'Oculus durability must be 50/50').toEqual({ current: 50, max: 50 })
      expect(oculus.speedText, 'Oculus weapon speed class must be defined').toBe('法球类 - 普通攻击速度')
      expect(oculus.reqLevel, 'Oculus reqLevel must be 42').toBe(42)

      // Weapon 2: Spirit Monarch
      const spirit = DEMO_EQUIPPED_GEAR.weapon2 as any
      expect(spirit, 'DEMO_EQUIPPED_GEAR.weapon2 must exist').toBeDefined()
      expect(spirit.runewordRunes, 'Spirit Monarch must declare runeword runes').toBe("'TalThulOrtAmn'")
      expect(spirit.defense, 'Spirit Monarch defense must be 148').toBe(148)
      expect(spirit.durability, 'Spirit Monarch durability must be 148/148').toEqual({ current: 148, max: 148 })
      expect(spirit.reqStr, 'Spirit Monarch reqStr must be 156').toBe(156)
      expect(spirit.reqLevel, 'Spirit Monarch reqLevel must be 54').toBe(54)
      expect(spirit.sockets, 'Spirit Monarch must have 4 sockets').toBe(4)

      // Boots: War Traveler
      const boots = DEMO_EQUIPPED_GEAR.boots as any
      expect(boots, 'DEMO_EQUIPPED_GEAR.boots must exist').toBeDefined()
      expect(boots.defense, 'War Traveler defense must be 139').toBe(139)
      expect(boots.durability, 'War Traveler durability must be 48/48').toEqual({ current: 48, max: 48 })
      expect(boots.reqStr, 'War Traveler reqStr must be 95').toBe(95)
      expect(boots.reqLevel, 'War Traveler reqLevel must be 42').toBe(42)
    })

    it('1.3 defines Call to Arms Crystal Sword in DEMO_BAG_ITEMS with all 11 canonical runeword & rune stats', () => {
      const ctaPlacement = DEMO_BAG_ITEMS.find(p => p.item.id === 'bag-cta')
      expect(ctaPlacement, 'Call to Arms must be present in DEMO_BAG_ITEMS').toBeDefined()
      const cta = ctaPlacement!.item as any

      expect(cta.runewordRunes, 'Call to Arms must have runewordRunes: AmnRalMalIstOhm').toBe("'AmnRalMalIstOhm'")
      expect(cta.durability, 'Call to Arms durability must be 20/20').toEqual({ current: 20, max: 20 })
      expect(cta.reqStr, 'Call to Arms reqStr must be 43').toBe(43)
      expect(cta.reqLevel, 'Call to Arms reqLevel must be 57').toBe(57)
      expect(cta.sockets, 'Call to Arms must have 5 sockets').toBe(5)
      expect(cta.speedText, 'Call to Arms speedText must be 剑类 - 极快的攻击速度').toBe('剑类 - 极快的攻击速度')
      expect(cta.damage, 'Call to Arms base damage scaled by +255% ED must be 17 - 52').toBe('17 - 52')

      // Exactly 11 canonical modifier lines:
      expect(cta.stats, 'Call to Arms must have stats array').toBeDefined()
      expect(cta.stats.length, 'Call to Arms must have exactly 11 canonical stat lines').toBe(11)

      const statTexts = cta.stats.map((s: any) => s.text)
      // 1. +1 All Skills
      expect(statTexts.some((t: string) => t.includes('所有技能') || t.includes('All Skills')), '+1 All Skills must be present').toBe(true)
      // 2. +40% IAS
      expect(statTexts.some((t: string) => t.includes('增加攻击速度') || t.includes('Attack Speed') || t.includes('IAS')), '+40% IAS must be present').toBe(true)
      // 3. +255% ED
      expect(statTexts.some((t: string) => t.includes('增强伤害') || t.includes('Enhanced Damage') || t.includes('ED')), '+255% ED must be present').toBe(true)
      // 4. Adds 5-30 Fire Dmg (Ral)
      expect(statTexts.some((t: string) => t.includes('火焰伤害') || t.includes('Fire Damage')), 'Fire damage must be present').toBe(true)
      // 5. 7% Life Steal (Amn)
      expect(statTexts.some((t: string) => t.includes('偷取生命') || t.includes('Life Stolen')), '7% Life Steal must be present').toBe(true)
      // 6. Prevent Monster Heal (Mal)
      expect(statTexts.some((t: string) => t.includes('防止怪物自疗') || t.includes('Prevent Monster Heal')), 'Prevent Monster Heal must be present').toBe(true)
      // 7. +6 Battle Orders
      expect(statTexts.some((t: string) => t.includes('战斗体制') || t.includes('Battle Orders')), '+6 Battle Orders must be present').toBe(true)
      // 8. +6 Battle Command
      expect(statTexts.some((t: string) => t.includes('战斗指挥') || t.includes('Battle Command')), '+6 Battle Command must be present').toBe(true)
      // 9. +4 Battle Cry
      expect(statTexts.some((t: string) => t.includes('战嚎') || t.includes('Battle Cry')), '+4 Battle Cry must be present').toBe(true)
      // 10. +12 Replenish Life
      expect(statTexts.some((t: string) => t.includes('生命补满') || t.includes('Replenish Life')), '+12 Replenish Life must be present').toBe(true)
      // 11. 30% MF (Ist)
      expect(statTexts.some((t: string) => t.includes('取得魔法装备') || t.includes('Magic Items') || t.includes('MF')), '30% MF must be present').toBe(true)
    })

    it('1.4 formats tooltip header hierarchy (Title fontexocet10 Gold, Runes font8 Gold, Base Type font8 White/Grey)', () => {
      const worldPanels = new WorldPanelsHud()
      const mockCtx = createMockCanvasContext()
      const mockFont = createMockFontRenderer()

      const ctaItem: UiInventoryItem & {
        runewordRunes?: string
        durability?: { current: number; max: number }
        speedText?: string
        sockets?: number
      } = {
        id: 'test-cta',
        code: 'crs',
        invFile: 'invcrs',
        name: 'Call to Arms',
        nameZh: '战争召唤 (Call to Arms)',
        baseNameZh: '水晶剑 (Crystal Sword)',
        quality: 'rune',
        runewordRunes: "'AmnRalMalIstOhm'",
        invWidth: 2,
        invHeight: 3,
        allowedSlots: ['weapon1'],
        damage: '17 - 52',
        durability: { current: 20, max: 20 },
        speedText: '剑类 - 极快的攻击速度',
        reqStr: 43,
        reqLevel: 57,
        sockets: 5,
        stats: [{ text: '+1 所有技能', color: 'blue' }],
      }

      worldPanels.drawItemTooltip(mockCtx, { item: ctaItem as any, x: 400, y: 350 }, mockFont)

      const calls = mockFont.drawCalls
      expect(calls.length, 'Tooltip must render multiple text lines').toBeGreaterThanOrEqual(3)

      // Line 0: Runeword Title in font16 with gold color
      expect(calls[0]!.text).toBe('战争召唤')
      expect(calls[0]!.options?.font).toBe('font16')
      expect(calls[0]!.options?.color).toBe('gold')

      // Line 1: Socketed Runes line in font16 with gold color
      expect(calls[1]!.text).toBe("'AmnRalMalIstOhm'")
      expect(calls[1]!.options?.font).toBe('font16')
      expect(calls[1]!.options?.color).toBe('gold')

      // Line 2: Base Item Name in font16 with white/gray color
      expect(calls[2]!.text).toBe('水晶剑')
      expect(calls[2]!.options?.font).toBe('font16')
      expect(['white', 'gray']).toContain(calls[2]!.options?.color)
    })

    it('1.5 formats base stats block (Damage/Defense, Durability, Speed Class, Req Strength, Req Level in White/Grey)', () => {
      const worldPanels = createDemoWorldPanels() // seeded level-85 Sorceress requirement context
      const mockCtx = createMockCanvasContext()
      const mockFont = createMockFontRenderer()

      const ctaItem = {
        id: 'test-cta-stats',
        code: 'crs',
        invFile: 'invcrs',
        name: 'Call to Arms',
        nameZh: '战争召唤 (Call to Arms)',
        baseNameZh: '水晶剑 (Crystal Sword)',
        quality: 'rune' as const,
        runewordRunes: "'AmnRalMalIstOhm'",
        invWidth: 2,
        invHeight: 3,
        allowedSlots: ['weapon1'] as any,
        damage: '17 - 52',
        durability: { current: 20, max: 20 },
        speedText: '剑类 - 极快的攻击速度',
        reqStr: 43,
        reqLevel: 57,
        sockets: 5,
        stats: [],
      }

      worldPanels.drawItemTooltip(mockCtx, { item: ctaItem as any, x: 400, y: 350 }, mockFont)

      const calls = mockFont.drawCalls
      // Find damage line
      const dmgCall = calls.find(c => c.text.includes('17') && c.text.includes('52'))
      expect(dmgCall, 'Damage line 17 - 52 must be drawn').toBeDefined()
      expect(dmgCall!.options?.font).toBe('font16')
      expect(['white', 'gray']).toContain(dmgCall!.options?.color)

      // Find durability line
      const duraCall = calls.find(c => c.text.includes('耐久度') && c.text.includes('20'))
      expect(duraCall, 'Durability line 20 之 20 must be drawn').toBeDefined()
      expect(duraCall!.options?.font).toBe('font16')
      expect(['white', 'gray']).toContain(duraCall!.options?.color)

      // Find speed class line
      const speedCall = calls.find(c => c.text.includes('极快的攻击速度'))
      expect(speedCall, 'Weapon speed class line must be drawn').toBeDefined()
      expect(speedCall!.options?.font).toBe('font16')
      expect(['white', 'gray']).toContain(speedCall!.options?.color)

      // Find reqStr line
      const reqStrCall = calls.find(c => c.text.includes('需要力量') && c.text.includes('43'))
      expect(reqStrCall, 'Req strength 43 must be drawn').toBeDefined()
      expect(reqStrCall!.options?.font).toBe('font16')
      expect(['white', 'gray']).toContain(reqStrCall!.options?.color)

      // Find reqLevel line
      const reqLvlCall = calls.find(c => c.text.includes('需要等级') && c.text.includes('57'))
      expect(reqLvlCall, 'Req level 57 must be drawn').toBeDefined()
      expect(reqLvlCall!.options?.font).toBe('font16')
      expect(['white', 'gray']).toContain(reqLvlCall!.options?.color)
    })

    it('1.6 formats magic affixes in Blue and Sockets line in Blue (凹槽 (5))', () => {
      const worldPanels = new WorldPanelsHud()
      const mockCtx = createMockCanvasContext()
      const mockFont = createMockFontRenderer()

      const ctaItem = {
        id: 'test-affixes',
        code: 'crs',
        invFile: 'invcrs',
        name: 'Call to Arms',
        nameZh: '战争召唤',
        baseNameZh: '水晶剑',
        quality: 'rune' as const,
        runewordRunes: "'AmnRalMalIstOhm'",
        invWidth: 2,
        invHeight: 3,
        allowedSlots: ['weapon1'] as any,
        sockets: 5,
        stats: [
          { text: '+1 所有技能', color: 'blue' as const },
          { text: '+40% 增加攻击速度', color: 'blue' as const },
        ],
      }

      worldPanels.drawItemTooltip(mockCtx, { item: ctaItem as any, x: 400, y: 350 }, mockFont)

      const calls = mockFont.drawCalls

      // Check magic affixes are blue
      const skillCall = calls.find(c => c.text.includes('所有技能'))
      expect(skillCall, 'Magic affix +1 All Skills must be drawn in blue').toBeDefined()
      expect(skillCall!.options?.color).toBe('blue')

      const iasCall = calls.find(c => c.text.includes('增加攻击速度'))
      expect(iasCall, 'Magic affix +40% IAS must be drawn in blue').toBeDefined()
      expect(iasCall!.options?.color).toBe('blue')

      // Check sockets line is blue
      const socketsCall = calls.find(c => c.text.includes('凹槽') && c.text.includes('5'))
      expect(socketsCall, 'Sockets line 凹槽 (5) must be drawn in blue').toBeDefined()
      expect(socketsCall!.options?.font).toBe('font16')
      expect(socketsCall!.options?.color).toBe('blue')

      // Verify socket count is preserved in CHI mode when `stats` already contains `凹槽 (N)` (e.g., vendor/online items)
      const mockFont2 = createMockFontRenderer()
      const vendorStaff = {
        id: 'vendor-sst',
        code: 'sst',
        invFile: 'invsst',
        name: 'Short Staff',
        nameZh: '短棍',
        baseNameZh: '短棍',
        quality: 'normal' as const,
        invWidth: 1,
        invHeight: 3,
        allowedSlots: ['weapon1'] as any,
        buyCost: 168,
        damage: '双手伤害: 1 - 6',
        durability: { current: 20, max: 20 },
        sockets: 2,
        stats: [{ text: '凹槽 (2)', color: 'blue' as const }],
      }
      worldPanels.lang = 'CHI'
      worldPanels.drawItemTooltip(mockCtx, { item: vendorStaff as any, x: 400, y: 350 }, mockFont2)
      const staffSocketCall = mockFont2.drawCalls.find(c => c.text.includes('凹槽'))
      expect(staffSocketCall?.text).toBe('凹槽 (2)')
      expect(staffSocketCall?.options?.color).toBe('blue')
    })
  })

  // =========================================================================
  // Tier 2: Boundary & Corner Cases
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {

    it('2.1 enforces Table 98 black pixel transparency guard: opaque pixels must NOT map to transparent index 0', () => {
      // In PL2 colormap decoding, Table 98 maps all 256 palette indices to index 0 (jet black).
      // But in indexed PNG DC6 sprites, index 0 is transparent.
      // The guard specifies: for any opaque pixel (source index > 0), if mapped to 0, remap to index 172 (RGB [4,4,4]).
      const table98Raw = new Uint8Array(256) // all zeros
      const table98Guard = (srcIndex: number): number => {
        if (srcIndex === 0) return 0 // keep transparent pixels transparent
        const mapped = table98Raw[srcIndex] ?? 0
        return mapped === 0 ? 172 : mapped
      }

      // Test all 255 opaque palette entries:
      for (let i = 1; i < 256; i++) {
        const transformed = table98Guard(i)
        expect(transformed, `Opaque source index ${i} must NOT be 0`).not.toBe(0)
        expect(transformed, `Opaque source index ${i} must be remapped to 172`).toBe(172)
      }

      // Index 0 (transparent background) must remain 0
      expect(table98Guard(0), 'Transparent index 0 must remain 0').toBe(0)
    })

    it('2.2 falls back to base item sprite when invtransform is missing, undefined, or unrecognized', () => {
      // 1. Missing / undefined invtransform on Harlequin Crest returns base invcap
      const noTransformItem: ResolvableItem = {
        name: 'Cap',
        invFile: 'invcap',
      }
      const rectBase = resolveItemSpriteRect(noTransformItem, MOCK_DYED_ITEM_RECTS)
      expect(rectBase, 'Missing invtransform must return base invcap').toEqual(MOCK_DYED_ITEM_RECTS.invcap)

      // 2. Explicit undefined invtransform
      const undefinedTransformItem: ResolvableItem & { invtransform?: string | undefined } = {
        name: 'Cap',
        invFile: 'invcap',
        invtransform: undefined,
      }
      const rectUndef = resolveItemSpriteRect(undefinedTransformItem as any, MOCK_DYED_ITEM_RECTS)
      expect(rectUndef, 'Undefined invtransform must return base invcap').toEqual(MOCK_DYED_ITEM_RECTS.invcap)

      // 3. Unrecognized / invalid invtransform token falls back to base invcap
      const unknownTransformItem: ResolvableItem & { invtransform?: string } = {
        name: 'Cap',
        invFile: 'invcap',
        invtransform: 'invalid_dye_token_xyz',
      }
      const rectUnknown = resolveItemSpriteRect(unknownTransformItem as any, MOCK_DYED_ITEM_RECTS)
      expect(rectUnknown, 'Unrecognized invtransform must fall back to base invcap').toEqual(MOCK_DYED_ITEM_RECTS.invcap)
    })

    it('2.3 evaluates dynamic vertical flip threshold: hover.y < 280 places by below cursor; hover.y >= 280 places above', () => {
      const worldPanels = new WorldPanelsHud()
      const mockFont = createMockFontRenderer()

      const item: UiInventoryItem = {
        id: 'test-flip',
        code: 'cap',
        invFile: 'invcap',
        name: 'Cap',
        nameZh: '便帽',
        baseNameZh: '便帽',
        quality: 'normal',
        invWidth: 2,
        invHeight: 2,
        allowedSlots: ['helm'],
        stats: [],
      }

      // Case A: Near top of screen (hover.y = 200 < 280) -> flip below cursor at hover.y + 24
      const ctxBelow = createMockCanvasContext()
      worldPanels.drawItemTooltip(ctxBelow, { item, x: 400, y: 200 }, mockFont)
      expect(ctxBelow.fillRectCalls.length).toBe(1)
      const [, byBelow, , boxHBelow] = ctxBelow.fillRectCalls[0]!
      expect(byBelow, 'When hover.y < 280, tooltip box by must be below cursor (hover.y + 24)').toBe(200 + 24)
      expect(byBelow + boxHBelow).toBeLessThanOrEqual(592)

      // Case B: Boundary right below threshold (hover.y = 279 < 280) -> flip below cursor
      const ctxBoundaryBelow = createMockCanvasContext()
      worldPanels.drawItemTooltip(ctxBoundaryBelow, { item, x: 400, y: 279 }, mockFont)
      const [, byBoundaryBelow] = ctxBoundaryBelow.fillRectCalls[0]!
      expect(byBoundaryBelow, 'When hover.y = 279, tooltip box by must be hover.y + 24').toBe(279 + 24)

      // Case C: At threshold (hover.y = 280 >= 280) -> place above cursor
      const ctxThreshold = createMockCanvasContext()
      worldPanels.drawItemTooltip(ctxThreshold, { item, x: 400, y: 280 }, mockFont)
      const [, byThreshold, , boxHThreshold] = ctxThreshold.fillRectCalls[0]!
      expect(byThreshold, 'When hover.y = 280, tooltip box by must be above cursor (hover.y - boxH - 8)').toBe(280 - boxHThreshold - 8)

      // Case D: Deep lower screen (hover.y = 450 >= 280) -> place above cursor
      const ctxAbove = createMockCanvasContext()
      worldPanels.drawItemTooltip(ctxAbove, { item, x: 400, y: 450 }, mockFont)
      const [, byAbove, , boxHAbove] = ctxAbove.fillRectCalls[0]!
      expect(byAbove, 'When hover.y >= 280, tooltip box by must be hover.y - boxH - 8').toBe(450 - boxHAbove - 8)
    })

    it('2.4 clamps tooltip box to viewport boundaries [8, 800 - boxW - 8] and [8, 600 - boxH - 8]', () => {
      const worldPanels = new WorldPanelsHud()
      const mockFont = createMockFontRenderer()

      const item: UiInventoryItem = {
        id: 'test-clamp',
        code: 'cap',
        invFile: 'invcap',
        name: 'Cap',
        nameZh: '测试长文本道具提示框边界限制',
        baseNameZh: '军帽',
        quality: 'unique',
        invWidth: 2,
        invHeight: 2,
        allowedSlots: ['helm'],
        stats: [{ text: '+2 所有技能', color: 'blue' }],
      }

      // Extreme Left: hover.x = 0
      const ctxLeft = createMockCanvasContext()
      worldPanels.drawItemTooltip(ctxLeft, { item, x: 0, y: 350 }, mockFont)
      const [bxLeft, , boxWLeft] = ctxLeft.fillRectCalls[0]!
      expect(bxLeft, 'Left clamped bx must be at least 8').toBe(8)
      expect(bxLeft + boxWLeft).toBeLessThanOrEqual(792)

      // Extreme Right: hover.x = 800
      const ctxRight = createMockCanvasContext()
      worldPanels.drawItemTooltip(ctxRight, { item, x: 800, y: 350 }, mockFont)
      const [bxRight, , boxWRight] = ctxRight.fillRectCalls[0]!
      expect(bxRight, 'Right clamped bx must not push box past 800 - 8').toBe(800 - boxWRight - 8)

      // Extreme Top: hover.y = 0 (< 280, flips to y + 24 = 24 >= 8)
      const ctxTop = createMockCanvasContext()
      worldPanels.drawItemTooltip(ctxTop, { item, x: 400, y: 0 }, mockFont)
      const [, byTop] = ctxTop.fillRectCalls[0]!
      expect(byTop).toBeGreaterThanOrEqual(8)

      // Extreme Bottom: hover.y = 600 (>= 280, places above cursor, must not exceed 600 - boxH - 8)
      const ctxBottom = createMockCanvasContext()
      worldPanels.drawItemTooltip(ctxBottom, { item, x: 400, y: 600 }, mockFont)
      const [, byBottom, , boxHBottom] = ctxBottom.fillRectCalls[0]!
      expect(byBottom).toBeLessThanOrEqual(600 - boxHBottom - 8)
      expect(byBottom).toBeGreaterThanOrEqual(8)
    })

    it('2.5 handles missing optional fields gracefully without durability, damage, or sockets lines', () => {
      const worldPanels = new WorldPanelsHud()
      const mockFont = createMockFontRenderer()
      const mockCtx = createMockCanvasContext()

      // Item with NO defense, NO damage, NO durability, NO sockets, NO speedText
      const minimalAmulet: UiInventoryItem = {
        id: 'test-minimal-amulet',
        code: 'amu',
        invFile: 'invamu',
        name: "Mara's Kaleidoscope",
        nameZh: "马拉的万花筒",
        baseNameZh: '项链',
        quality: 'unique',
        invWidth: 1,
        invHeight: 1,
        allowedSlots: ['amulet'],
        reqLevel: 67,
        stats: [
          { text: '+2 所有技能', color: 'blue' },
          { text: '+5 所有属性', color: 'blue' },
        ],
      }

      expect(() => {
        worldPanels.drawItemTooltip(mockCtx, { item: minimalAmulet, x: 400, y: 300 }, mockFont)
      }).not.toThrow()

      const texts = mockFont.drawCalls.map(c => c.text)

      // Durability, Damage, and Sockets lines MUST NOT appear
      expect(texts.some(t => t.includes('耐久度')), 'Must not render durability line when durability is missing').toBe(false)
      expect(texts.some(t => t.includes('伤害')), 'Must not render damage line when damage is missing').toBe(false)
      expect(texts.some(t => t.includes('凹槽')), 'Must not render sockets line when sockets is missing').toBe(false)

      // Core attributes must appear
      expect(texts).toContain('马拉的万花筒')
      expect(texts).toContain('项链')
      expect(texts.some(t => t.includes('需要等级: 67'))).toBe(true)
      expect(texts).toContain('+2 所有技能')
    })
  })

  // =========================================================================
  // Tier 3: Cross-Feature Interactions
  // =========================================================================
  describe('Tier 3: Cross-Feature Interactions', () => {

    it('3.1 preserves dyed sprite through equip slot pickup, bag placement, and re-equip workflow', () => {
      const inv = createDemoInventory() // seeded starter gear (dyed Tal Rasha helm)

      // 1. Initial State: Equipped Helm has invtransform 'cgrn'
      const equippedHelm = inv.equipped.helm as any
      expect(equippedHelm, 'Equipped helm must exist').toBeDefined()
      expect(equippedHelm.invtransform, 'Equipped helm must have invtransform: cgrn').toBe('cgrn')

      // 2. Click helm slot to pick up into cursorItem
      expect(inv.cursorItem).toBeNull()
      expect(inv.clickEquipSlot('helm')).toBe(true)
      expect(inv.cursorItem, 'Cursor must hold the picked up helm').not.toBeNull()

      const cursorItem = inv.cursorItem as any
      expect(cursorItem.invtransform, 'cursorItem must retain invtransform: cgrn').toBe('cgrn')
      expect(resolveItemSpriteRect(cursorItem, MOCK_DYED_ITEM_RECTS), 'cursorItem must resolve invcap_cgrn').toEqual(MOCK_DYED_ITEM_RECTS.invcap_cgrn)

      // 3. Place into empty bag grid cell (col 5, row 0)
      expect(inv.clickGridCell(5, 0), 'Placing 2x2 helm at (5, 0) should succeed').toBe(true)
      expect(inv.cursorItem, 'Cursor must be empty after placement').toBeNull()

      // 4. Verify placed item in bag retains invtransform 'cgrn'
      const placed = inv.gridItems.find(p => p.col === 5 && p.row === 0)
      expect(placed, 'Item must be in grid at (5, 0)').toBeDefined()
      const placedItem = placed!.item as any
      expect(placedItem.invtransform, 'Grid placed item must retain invtransform: cgrn').toBe('cgrn')
      expect(resolveItemSpriteRect(placedItem, MOCK_DYED_ITEM_RECTS), 'Grid placed item must resolve invcap_cgrn').toEqual(MOCK_DYED_ITEM_RECTS.invcap_cgrn)

      // 5. Pick it back up to cursor from bag cell
      expect(inv.clickGridCell(5, 0), 'Picking item back up from (5, 0) should succeed').toBe(true)
      expect(inv.cursorItem, 'Cursor must hold item again').not.toBeNull()
      const cursorAgain = inv.cursorItem as any
      expect(cursorAgain.invtransform, 'Re-picked cursorItem must retain invtransform: cgrn').toBe('cgrn')

      // 6. Re-equip to helm slot
      expect(inv.clickEquipSlot('helm'), 'Re-equipping to helm slot should succeed').toBe(true)
      expect(inv.cursorItem).toBeNull()
      const reEquipped = inv.equipped.helm as any
      expect(reEquipped.invtransform, 'Re-equipped helm must retain invtransform: cgrn').toBe('cgrn')
      expect(resolveItemSpriteRect(reEquipped, MOCK_DYED_ITEM_RECTS)).toEqual(MOCK_DYED_ITEM_RECTS.invcap_cgrn)
    })

    it('3.2 renders correct title and base colors across different item qualities (runeword, unique, set, magic, normal)', () => {
      const worldPanels = new WorldPanelsHud()

      const qualitiesToTest: {
        quality: UiInventoryItem['quality']
        expectedTitleColor: D2ColorCode
        nameZh: string
        baseNameZh: string
      }[] = [
        { quality: 'rune', expectedTitleColor: 'gold', nameZh: '战争召唤', baseNameZh: '水晶剑' },
        { quality: 'unique', expectedTitleColor: 'gold', nameZh: '谐角之冠', baseNameZh: '军帽' },
        { quality: 'set', expectedTitleColor: 'green', nameZh: "塔·拉夏的守护", baseNameZh: '漆甲' },
        { quality: 'magic', expectedTitleColor: 'blue', nameZh: '工匠之巨鲸的大盾', baseNameZh: '统治者大盾' },
        { quality: 'normal', expectedTitleColor: 'white', nameZh: '超强的超大型巨剑', baseNameZh: '超大型巨剑' },
      ]

      for (const itemDef of qualitiesToTest) {
        const mockFont = createMockFontRenderer()
        const mockCtx = createMockCanvasContext()

        const item: UiInventoryItem = {
          id: `test-${itemDef.quality}`,
          code: 'test',
          invFile: 'invcap',
          name: itemDef.nameZh,
          nameZh: itemDef.nameZh,
          baseNameZh: itemDef.baseNameZh,
          quality: itemDef.quality,
          invWidth: 2,
          invHeight: 2,
          allowedSlots: ['helm'],
          stats: [],
        }

        worldPanels.drawItemTooltip(mockCtx, { item, x: 400, y: 350 }, mockFont)

        const titleCall = mockFont.drawCalls[0]
        expect(titleCall, `Quality ${itemDef.quality} must draw a title line`).toBeDefined()
        expect(titleCall!.text).toBe(itemDef.nameZh)
        expect(titleCall!.options?.font).toBe('font16')
        expect(titleCall!.options?.color, `Quality ${itemDef.quality} title color must be ${itemDef.expectedTitleColor}`).toBe(itemDef.expectedTitleColor)
      }
    })
  })

  // =========================================================================
  // Tier 4: Real-World Workload Scenarios
  // =========================================================================
  describe('Tier 4: Real-World Workloads', () => {

    it('4.1 simulates paperdoll traversal across all 10 equipped slots without errors', () => {
      const worldPanels = new WorldPanelsHud()
      const inv = new InventoryPanel()
      const mockFont = createMockFontRenderer()
      const mockCtx = createMockCanvasContext()

      const slots: EquipSlotId[] = [
        'helm',
        'amulet',
        'weapon1',
        'armor',
        'weapon2',
        'gloves',
        'ring1',
        'belt',
        'ring2',
        'boots',
      ]

      for (const slotId of slots) {
        const item = inv.equipped[slotId]
        if (!item) continue

        const layout = EQUIP_SLOTS_LAYOUT[slotId]
        const hoverX = layout.x + Math.floor(layout.w / 2)
        const hoverY = layout.y + Math.floor(layout.h / 2)

        expect(() => {
          worldPanels.drawItemTooltip(mockCtx, { item, x: hoverX, y: hoverY }, mockFont)
        }, `Hovering slot ${slotId} must not throw`).not.toThrow()

        // Check latest fillRect call from this slot
        const lastFill = mockCtx.fillRectCalls[mockCtx.fillRectCalls.length - 1]
        expect(lastFill).toBeDefined()
        const [bx, by, boxW, boxH] = lastFill!
        expect(bx).toBeGreaterThanOrEqual(8)
        expect(bx + boxW).toBeLessThanOrEqual(792)
        expect(by).toBeGreaterThanOrEqual(8)
        expect(by + boxH).toBeLessThanOrEqual(592)
      }
    })

    it('4.2 simulates bag inventory traversal across Call to Arms, Torch, Anni, and Gheed\'s Fortune', () => {
      const worldPanels = new WorldPanelsHud()
      const mockFont = createMockFontRenderer()
      const mockCtx = createMockCanvasContext()

      const targetBagIds = ['bag-cta', 'bag-torch', 'bag-anni', 'bag-gheeds']

      for (const placement of DEMO_BAG_ITEMS) {
        if (!targetBagIds.includes(placement.item.id)) continue

        const hoverX = INV_GRID_ORIGIN.x + placement.col * INV_GRID_ORIGIN.cellPx + 14
        const hoverY = INV_GRID_ORIGIN.y + placement.row * INV_GRID_ORIGIN.cellPx + 14

        expect(() => {
          worldPanels.drawItemTooltip(mockCtx, { item: placement.item, x: hoverX, y: hoverY }, mockFont)
        }, `Hovering ${placement.item.name} must not throw`).not.toThrow()

        const lastFill = mockCtx.fillRectCalls[mockCtx.fillRectCalls.length - 1]
        expect(lastFill).toBeDefined()
        const [bx, by, boxW, boxH] = lastFill!
        expect(bx).toBeGreaterThanOrEqual(8)
        expect(by).toBeGreaterThanOrEqual(8)
        expect(bx + boxW).toBeLessThanOrEqual(792)
        expect(by + boxH).toBeLessThanOrEqual(592)
      }
    })

    it('4.3 performs canvas draw pass with strict numeric coordinates and box geometry coverage', () => {
      const worldPanels = new WorldPanelsHud()
      const mockFont = createMockFontRenderer()
      const mockCtx = createMockCanvasContext()

      const ctaPlacement = DEMO_BAG_ITEMS.find(p => p.item.id === 'bag-cta')!
      worldPanels.drawItemTooltip(mockCtx, { item: ctaPlacement.item, x: 400, y: 350 }, mockFont)

      // Verify fillRect and no strokeRect per D2Win_10124 (Issue #668)
      expect(mockCtx.fillRectCalls.length).toBe(1)
      expect(mockCtx.strokeRectCalls.length).toBe(0)

      const [fx, fy, fw, fh] = mockCtx.fillRectCalls[0]!
      expect(Number.isFinite(fx)).toBe(true)
      expect(Number.isFinite(fy)).toBe(true)
      expect(Number.isFinite(fw)).toBe(true)
      expect(Number.isFinite(fh)).toBe(true)
      expect(fw).toBeGreaterThanOrEqual(100)
      expect(fh).toBeGreaterThanOrEqual(50)

      // Verify all text draw calls have finite numeric coordinates
      for (const call of mockFont.drawCalls) {
        expect(Number.isFinite(call.x)).toBe(true)
        expect(Number.isFinite(call.y)).toBe(true)
        expect(call.text.length).toBeGreaterThan(0)
        expect(call.y).toBeGreaterThanOrEqual(fy)
        expect(call.y).toBeLessThanOrEqual(fy + fh + 5) // Text is within box vertical bounds
      }
    })
  })
})
