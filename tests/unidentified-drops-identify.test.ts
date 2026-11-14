import { describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import {
  createDroppedItem,
  shouldSpawnIdentifiedByDefault,
} from '../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import {
  GroundItemManager,
  isGroundSourceUnidentified,
  resolveGroundItemMetadata,
} from '../src/common/items/ground-items.ts'
import {
  calculateTransactionCost,
  TransactionType,
} from '../src/common/items/item-cost.ts'
import { ItemFlag, ItemQuality, type Item } from '../src/common/items/items.ts'
import { VendorNpcId } from '../src/common/units/npc-table.ts'
import {
  generateGambleInventory,
  generateVendorStoreItem,
  resolveGambledItem,
} from '../src/common/items/vendor-generator.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import type { D2ColorCode, D2FontName, D2FontRenderer } from '../src/client/ui/font.ts'
import {
  EQUIP_SLOTS_LAYOUT,
  identifyUiItem,
  INV_GRID_ORIGIN,
  InventoryPanel,
  isUiItemUnidentified,
  itemToUiInventoryItem,
  resolveItemSpriteRect,
  type UiInventoryItem,
} from '../src/client/ui/inventory.ts'
import { WorldPanelsHud } from '../src/client/ui/world-panels.ts'
import { createDemoInventory } from './fixtures/hud-demo-state.ts'

function createMockTooltipCanvas() {
  const fontCalls: Array<{ text: string; color?: D2ColorCode | undefined; font?: D2FontName | undefined }> = []
  const fillStyles: string[] = []
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(function (this: { fillStyle: string }) {
      fillStyles.push(this.fillStyle)
    }),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D

  const font = {
    loaded: true,
    measureText: vi.fn((text: string) => text.length * 8),
    drawText: vi.fn(
      (
        _ctx: CanvasRenderingContext2D,
        text: string,
        _x: number,
        _y: number,
        opts?: { font?: D2FontName; color?: D2ColorCode },
      ) => {
        fontCalls.push({ text, color: opts?.color, font: opts?.font })
      },
    ),
  } as unknown as D2FontRenderer

  return { ctx, font, fontCalls, fillStyles }
}

describe('Diablo II v1.13c Unidentified Equipment Drops & Identification System', () => {
  const dropTables = getEmbeddedDropTables()
  const shakoBase = dropTables.getBase('uap')!
  const harlequinDef = dropTables.uniques.getEnabledByCode('uap')[0]!

  function makeDroppedShako(qualityTier: 'normal' | 'magic' | 'rare' | 'unique', seed = 101): Item {
    const rng = new D2Rng(seed)
    return createDroppedItem(shakoBase, qualityTier, {
      uniqueItem: qualityTier === 'unique' ? harlequinDef : undefined,
      itemTypes: dropTables.itemTypes,
      ilvl: 85,
      dwInitSeed: seed,
      itemRng: rng,
    })
  }

  describe('1. Drop Pipeline Unidentified Spawn Rules (D2Game.dll / Items.cpp)', () => {
    it('spawns low, normal, superior, and quest items as identified, and magic/rare/set/unique/crafted items as unidentified', () => {
      expect(shakoBase).toBeDefined()
      expect(harlequinDef).toBeDefined()

      expect(shouldSpawnIdentifiedByDefault(shakoBase, 'low')).toBe(true)
      expect(shouldSpawnIdentifiedByDefault(shakoBase, 'normal')).toBe(true)
      expect(shouldSpawnIdentifiedByDefault(shakoBase, 'superior')).toBe(true)
      expect(shouldSpawnIdentifiedByDefault(shakoBase, 'magic')).toBe(false)
      expect(shouldSpawnIdentifiedByDefault(shakoBase, 'rare')).toBe(false)
      expect(shouldSpawnIdentifiedByDefault(shakoBase, 'set')).toBe(false)
      expect(shouldSpawnIdentifiedByDefault(shakoBase, 'unique')).toBe(false)
      expect(shouldSpawnIdentifiedByDefault(shakoBase, 'crafted' as any)).toBe(false)

      // Quest items (base.quest > 0) always spawn identified regardless of quality tier
      const cubeBase = dropTables.getBase('box')!
      expect(cubeBase.quest).toBeGreaterThan(0)
      expect(shouldSpawnIdentifiedByDefault(cubeBase, 'unique')).toBe(true)

      // Verify concrete createDroppedItem outputs
      const normalItem = makeDroppedShako('normal', 1)
      expect(normalItem.identified).toBe(true)
      expect(normalItem.flags?.identified).toBe(true)
      expect((normalItem.rawFlags! & ItemFlag.IDENTIFIED) !== 0).toBe(true)

      const magicItem = makeDroppedShako('magic', 2)
      expect(magicItem.identified).toBe(false)
      expect(magicItem.flags?.identified).toBe(false)
      expect((magicItem.rawFlags! & ItemFlag.IDENTIFIED) !== 0).toBe(false)

      const rareItem = makeDroppedShako('rare', 3)
      expect(rareItem.identified).toBe(false)
      expect(rareItem.flags?.identified).toBe(false)
      expect((rareItem.rawFlags! & ItemFlag.IDENTIFIED) !== 0).toBe(false)

      const uniqueShako = makeDroppedShako('unique', 4)
      expect(uniqueShako.quality).toBe(ItemQuality.UNIQUE)
      expect(uniqueShako.name).toBe('Harlequin Crest')
      expect(uniqueShako.identified).toBe(false)
      expect(uniqueShako.flags?.identified).toBe(false)
      expect((uniqueShako.rawFlags! & ItemFlag.IDENTIFIED) !== 0).toBe(false)
    })
  })

  describe('2. Vendor Store, Gambling Reveal & Unidentified Transaction Cost', () => {
    it('spawns vendor trade items and resolved gamble items as pre-identified', () => {
      const rng = new D2Rng(42)
      const capBase = dropTables.getBase('cap')!
      const vendorMagic = generateVendorStoreItem({
        base: capBase,
        vendorId: VendorNpcId.CHARSI,
        qualityTier: 'magic',
        cLvl: 25,
        nItemLevel: 30,
        difficulty: 0,
        permStore: false,
        tables: dropTables,
        rng,
      })
      expect(vendorMagic).not.toBeNull()
      expect(vendorMagic!.identified).toBe(true)
      expect(vendorMagic!.flags?.identified).toBe(true)
      expect((vendorMagic!.rawFlags! & ItemFlag.IDENTIFIED) !== 0).toBe(true)

      const gambleGrid = generateGambleInventory({
        vendorId: VendorNpcId.GHEED,
        cLvl: 30,
        tables: dropTables,
        rng,
      })
      const mystery = gambleGrid.list()[0]!.item
      expect(mystery.isGambleMystery).toBe(true)
      expect(mystery.identified).toBe(false)

      const gambled = resolveGambledItem({
        mysteryItem: mystery,
        cLvl: 30,
        tables: dropTables,
        rng,
      })
      expect(gambled.identified).toBe(true)
      expect(gambled.flags?.identified).toBe(true)
      expect(gambled.isGambleMystery).toBe(false)
    })

    it('discounts sell price of unidentified magic/unique items until identified (0x6FD9B1C0)', () => {
      const uniqueShako = makeDroppedShako('unique', 7)
      expect(uniqueShako.identified).toBe(false)

      const unidSellCost = calculateTransactionCost({
        item: uniqueShako,
        transactionType: TransactionType.SELL,
        vendorId: VendorNpcId.CHARSI,
        difficulty: 2,
        tables: dropTables,
      })
      const idShako: Item = {
        ...uniqueShako,
        identified: true,
        flags: { ...uniqueShako.flags!, identified: true },
        rawFlags: uniqueShako.rawFlags! | ItemFlag.IDENTIFIED,
      }
      const idSellCost = calculateTransactionCost({
        item: idShako,
        transactionType: TransactionType.SELL,
        vendorId: VendorNpcId.CHARSI,
        difficulty: 2,
        tables: dropTables,
      })

      expect(unidSellCost).toBeGreaterThan(0)
      expect(idSellCost).toBeGreaterThan(unidSellCost)
    })
  })

  describe('4. UI Item Bridge, Sprite/Dye Masking, Tooltip Masking & Equipping Gate', () => {
    it('masks unique dye transform and custom unique invFile while unidentified and restores them upon identification', () => {
      const uniqueShako = makeDroppedShako('unique', 19)
      const uiShako = itemToUiInventoryItem(uniqueShako, dropTables)

      expect(isUiItemUnidentified(uiShako)).toBe(true)
      expect(uiShako.invtransform).toBeTruthy()
      expect(uiShako.baseInvFile).toBe('invcap')

      const unidSprite = resolveItemSpriteRect(uiShako)
      const baseCapSprite = BAKED_UI_MANIFEST.itemRects['invcap']
      const dyedCapSprite = BAKED_UI_MANIFEST.itemRects[`invcap_${uiShako.invtransform}`]
      expect(unidSprite).toEqual(baseCapSprite)
      if (dyedCapSprite) {
        expect(unidSprite).not.toEqual(dyedCapSprite)
      }

      // Identify and verify dyed sprite is now resolved
      identifyUiItem(uiShako)
      expect(isUiItemUnidentified(uiShako)).toBe(false)
      if (dyedCapSprite) {
        expect(resolveItemSpriteRect(uiShako)).toEqual(dyedCapSprite)
      }
    })

    it('renders red cell backdrop in InventoryPanel.draw and hides secret name/affixes in drawItemTooltip while unidentified', () => {
      const uniqueShako = makeDroppedShako('unique', 23)
      const uiShako = itemToUiInventoryItem(uniqueShako, dropTables)

      const inv = new InventoryPanel()
      inv.visible = true
      inv.gridItems = [{ item: uiShako, col: 0, row: 0 }]

      const { ctx, font, fontCalls, fillStyles } = createMockTooltipCanvas()
      inv.draw(
        ctx,
        {
          borderRightImg: null,
          invSheetImg: null,
          invTab0Img: null,
          invTab1Img: null,
          buySellBtnImg: null,
          itemsAtlasImg: null,
          itemRects: BAKED_UI_MANIFEST.itemRects,
        },
        font,
      )
      expect(fillStyles).toContain('rgba(72, 18, 18, 0.50)')

      // Hover tooltip while unidentified
      const wp = new WorldPanelsHud()
      fontCalls.length = 0
      wp.drawItemTooltip(ctx, { item: uiShako, x: 450, y: 300 }, font, false)

      const texts = fontCalls.map(c => c.text)
      expect(texts[0]).toContain('军帽')
      expect(texts.some(t => t.includes('Harlequin Crest') || t.includes('谐角之冠'))).toBe(false)
      expect(texts).toContain('未辨识')
      expect(texts).toContain('无法使用')

      // Verify ENG unidentified tooltip
      wp.lang = 'ENG'
      fontCalls.length = 0
      wp.drawItemTooltip(ctx, { item: uiShako, x: 450, y: 300 }, font, false)
      const textsEn = fontCalls.map(c => c.text)
      expect(textsEn[0]).toBe('Shako')
      expect(textsEn).toContain('Unidentified')
      expect(textsEn).toContain('Cannot be Equipped')
      wp.lang = 'CHI'

      // Hover tooltip after identification
      identifyUiItem(uiShako)
      fontCalls.length = 0
      wp.drawItemTooltip(ctx, { item: uiShako, x: 450, y: 300 }, font, false)
      const identifiedTexts = fontCalls.map(c => c.text)
      expect(identifiedTexts[0]).toContain('谐角之冠')
      expect(identifiedTexts).not.toContain('未辨识')
      expect(identifiedTexts).not.toContain('无法使用')
      expect(identifiedTexts.length).toBeGreaterThan(texts.length)
    })
  })

  describe('5. End-to-End Identification Flows: Scroll (isc), Tome (ibk), and Deckard Cain', () => {
    it('identifies an item using a Scroll of Identify (isc), consumes the scroll, and unlocks equipping', () => {
      const inv = createDemoInventory() // seeded level-85 Sorceress requirement context
      inv.visible = true
      delete inv.equipped.helm

      const uniqueShako = itemToUiInventoryItem(makeDroppedShako('unique', 31), dropTables)
      const iscBase = dropTables.getBase('isc')!
      const scrollItem = itemToUiInventoryItem(
        createDroppedItem(iscBase, 'normal', {
          itemTypes: dropTables.itemTypes,
          ilvl: 1,
          dwInitSeed: 32,
          itemRng: new D2Rng(32),
        }),
        dropTables,
      )

      inv.gridItems = [
        { item: uniqueShako, col: 0, row: 0 },
        { item: scrollItem, col: 2, row: 0 },
      ]

      // Right-click Scroll of Identify at (2, 0) via handleClick(button=2) to enter Identify Cursor Mode
      const scrollX = INV_GRID_ORIGIN.x + 2 * INV_GRID_ORIGIN.cellPx + 5
      const scrollY = INV_GRID_ORIGIN.y + 5
      expect(inv.handleClick(scrollX, scrollY, undefined, 2)).toBe(true)
      expect(inv.isIdentifyMode()).toBe(true)

      // Left-click the unidentified Shako at (0, 0) via handleClick(button=0) to identify it
      const shakoX = INV_GRID_ORIGIN.x + 5
      const shakoY = INV_GRID_ORIGIN.y + 5
      expect(inv.handleClick(shakoX, shakoY, undefined, 0)).toBe(true)
      expect(inv.isIdentifyMode()).toBe(false)
      expect(isUiItemUnidentified(uniqueShako)).toBe(false)
      expect((uniqueShako.rawItem!.rawFlags! & ItemFlag.IDENTIFIED) !== 0).toBe(true)

      // Scroll was consumed and removed from inventory
      expect(inv.gridItems.some(p => p.item.id === scrollItem.id)).toBe(false)

      // Now pick up the identified Shako and equip it into the helm slot
      expect(inv.clickGridCell(0, 0)).toBe(true)
      expect(inv.cursorItem?.id).toBe(uniqueShako.id)
      expect(inv.clickEquipSlot('helm')).toBe(true)
      expect((inv.equipped.helm as UiInventoryItem | undefined)?.id).toBe(uniqueShako.id)
      expect(inv.cursorItem).toBeNull()
    })

    it('identifies an item using a Tome of Identify (ibk) and decrements tome quantity', () => {
      const inv = new InventoryPanel()
      inv.visible = true
      const rinBase = dropTables.getBase('rin')!
      const ibkBase = dropTables.getBase('ibk')!

      const rareRing = itemToUiInventoryItem(
        createDroppedItem(rinBase, 'rare', {
          itemTypes: dropTables.itemTypes,
          ilvl: 60,
          dwInitSeed: 41,
          itemRng: new D2Rng(41),
        }),
        dropTables,
      )
      const tomeItem = itemToUiInventoryItem(
        {
          ...createDroppedItem(ibkBase, 'normal', {
            itemTypes: dropTables.itemTypes,
            ilvl: 1,
            dwInitSeed: 42,
            itemRng: new D2Rng(42),
          }),
          quantity: 5,
          stack: 5,
        },
        dropTables,
      )

      inv.gridItems = [
        { item: rareRing, col: 0, row: 0 },
        { item: tomeItem, col: 1, row: 0 },
      ]

      const tomeX = INV_GRID_ORIGIN.x + 1 * INV_GRID_ORIGIN.cellPx + 5
      const tomeY = INV_GRID_ORIGIN.y + 5
      expect(inv.handleClick(tomeX, tomeY, undefined, 2)).toBe(true)
      expect(inv.isIdentifyMode()).toBe(true)

      const ringX = INV_GRID_ORIGIN.x + 5
      const ringY = INV_GRID_ORIGIN.y + 5
      expect(inv.handleClick(ringX, ringY, undefined, 0)).toBe(true)
      expect(isUiItemUnidentified(rareRing)).toBe(false)
      expect(tomeItem.quantity).toBe(4)
      expect(inv.gridItems.some(p => p.item.id === tomeItem.id)).toBe(true)
    })

    it('immediately refreshes hoveredItem tooltip upon identification without requiring mouse movement (#803)', () => {
      const inv = new InventoryPanel()
      inv.visible = true
      const uniqueShako = itemToUiInventoryItem(makeDroppedShako('unique', 51), dropTables)
      const iscBase = dropTables.getBase('isc')!
      const scrollItem = itemToUiInventoryItem(
        createDroppedItem(iscBase, 'normal', {
          itemTypes: dropTables.itemTypes,
          ilvl: 1,
          dwInitSeed: 52,
          itemRng: new D2Rng(52),
        }),
        dropTables,
      )

      inv.gridItems = [
        { item: uniqueShako, col: 0, row: 0 },
        { item: scrollItem, col: 2, row: 0 },
      ]

      // Right-click Scroll of Identify at (2, 0)
      const scrollX = INV_GRID_ORIGIN.x + 2 * INV_GRID_ORIGIN.cellPx + 5
      const scrollY = INV_GRID_ORIGIN.y + 5
      expect(inv.handleClick(scrollX, scrollY, undefined, 2)).toBe(true)

      // Hover over the unidentified Shako at (0, 0) before clicking
      const shakoX = INV_GRID_ORIGIN.x + 5
      const shakoY = INV_GRID_ORIGIN.y + 5
      inv.handleMouseMove(shakoX, shakoY)
      const prevHoveredRef = inv.hoveredItem?.item
      expect(prevHoveredRef).toBeDefined()
      expect(isUiItemUnidentified(inv.hoveredItem!.item)).toBe(true)

      // Left-click to identify WITHOUT moving the mouse afterwards
      expect(inv.handleClick(shakoX, shakoY, undefined, 0)).toBe(true)
      expect(inv.hoveredItem).not.toBeNull()
      expect(inv.hoveredItem!.item).not.toBe(prevHoveredRef)
      expect(isUiItemUnidentified(inv.hoveredItem!.item)).toBe(false)

      const { ctx, font, fontCalls } = createMockTooltipCanvas()
      const wp = new WorldPanelsHud()
      wp.drawItemTooltip(ctx, inv.hoveredItem!, font, false)
      const texts = fontCalls.map(c => c.text)
      expect(texts[0]).toContain('谐角之冠')
      expect(texts).not.toContain('未辨识')
    })
  })
})
