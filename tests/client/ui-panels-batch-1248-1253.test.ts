import { describe, expect, it, vi } from 'vitest'
import { GlobesHud, LIFE_GLOBE_BOUNDS, MANA_GLOBE_BOUNDS } from '../../src/client/ui/globes.ts'
import { D2FontRenderer } from '../../src/client/ui/font.ts'
import {
  InventoryPanel,
  EQUIP_SLOTS_LAYOUT,
  INV_CLOSE_BTN_BOUNDS,
  INV_GOLD_BTN_BOUNDS,
  INV_GRID_ORIGIN,
  getStashGoldLimit,
  getInventoryGoldLimit,
  STASH_GOLD_CAP,
  type UiInventoryItem,
} from '../../src/client/ui/inventory.ts'
import { WorldPanelsHud, STASH_GRID_ORIGIN, CUBE_GRID_ORIGIN } from '../../src/client/ui/world-panels.ts'
import {
  CharacterSheetPanel,
  CHAR_PANEL_ORIGIN,
  CHAR_CLOSE_BTN_BOUNDS,
  doesSkillUseAttackRating,
  computeCharSheetHitChancePct,
  computeCharacterBlockChancePct,
} from '../../src/client/ui/character-sheet.ts'
import { goldDialogBalance, openGoldDialog } from '../../src/client/ui/hud-gold-dialog.ts'
import { addGoldToPurse } from '../../src/common/items/vendor-service.ts'
import { handleHudMouseDown } from '../../src/client/ui/hud-input-router.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'

function createMockCtx() {
  const drawnTexts: Array<{ text: string; x: number; y: number; color?: string }> = []
  const drawnImages: Array<{ img: unknown; dx: number; dy: number; alpha: number }> = []
  const filledRects: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> = []
  const ctx: any = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      filledRects.push({ x, y, w, h, fillStyle: String(ctx.fillStyle) })
    }),
    strokeRect: vi.fn(),
    drawImage: vi.fn((...args: any[]) => {
      const dx = args.length >= 9 ? args[5] : args[1]
      const dy = args.length >= 9 ? args[6] : args[2]
      drawnImages.push({ img: args[0], dx, dy, alpha: ctx.globalAlpha })
    }),
  }
  const font = new D2FontRenderer()
  vi.spyOn(font, 'drawText').mockImplementation((_c, text, x, y, opts) => {
    drawnTexts.push({ text, x, y, ...(opts?.color !== undefined ? { color: opts.color } : {}) })
  })
  return { ctx: ctx as CanvasRenderingContext2D, font, drawnTexts, drawnImages, filledRects }
}

describe('UI Panels Batch (#1248, #1249, #1250, #1252, #1253)', () => {
  describe('Issue #1252: Globes Click-to-Pin (LifeText / ManaText)', () => {
    it('toggles lifeTextPinned and manaTextPinned on left-clicking life/mana globes and keeps text visible without hover', () => {
      const globes = new GlobesHud()
      globes.lang = 'ENG'
      expect(globes.lifeTextPinned).toBe(false)
      expect(globes.manaTextPinned).toBe(false)

      // Click outside globes returns false
      expect(globes.handleClick(400, 300)).toBe(false)

      // Click inside life globe (x ∈ [30, 110], y ∈ [525, 585]) toggles lifeTextPinned and consumes click
      expect(globes.handleClick(LIFE_GLOBE_BOUNDS.x + 40, LIFE_GLOBE_BOUNDS.y + 40)).toBe(true)
      expect(globes.lifeTextPinned).toBe(true)
      expect(globes.manaTextPinned).toBe(false)

      // Click inside mana globe (x ∈ [689, 769], y ∈ [525, 585]) toggles manaTextPinned and consumes click
      expect(globes.handleClick(MANA_GLOBE_BOUNDS.x + 40, MANA_GLOBE_BOUNDS.y + 40)).toBe(true)
      expect(globes.manaTextPinned).toBe(true)

      // Even when mouse moves far away (not hovered), both Life and Mana texts are drawn
      globes.handleMouseMove(400, 100)
      expect(globes.lifeHovered).toBe(false)
      expect(globes.manaHovered).toBe(false)

      const { ctx, font, drawnTexts } = createMockCtx()
      const dummyImg = { width: 80, height: 80 } as HTMLImageElement
      globes.draw(
        ctx,
        { hp: 120, maxHp: 200, mana: 45, maxMana: 90 },
        {
          lifeImg: dummyImg,
          manaImg: dummyImg,
          poisonImg: null,
          overlapLeftImg: dummyImg,
          overlapRightImg: dummyImg,
        },
        font,
      )
      expect(drawnTexts.some((t) => t.text.includes('120 / 200'))).toBe(true)
      expect(drawnTexts.some((t) => t.text.includes('45 / 90'))).toBe(true)

      // Clicking life globe again unpins it
      expect(globes.handleClick(LIFE_GLOBE_BOUNDS.x + 40, LIFE_GLOBE_BOUNDS.y + 40)).toBe(true)
      expect(globes.lifeTextPinned).toBe(false)
    })
  })

  describe('Issue #1250: Stash Gold Limit by clvl (0x6FD5D960) & Gold Dialog Remaining Capacity Clamping', () => {
    it('computes 1.13c stash gold cap by character level (10-level tiers <30, 2-level tiers >=30, max 2.5M)', () => {
      expect(getStashGoldLimit(1)).toBe(50_000)
      expect(getStashGoldLimit(9)).toBe(50_000)
      expect(getStashGoldLimit(10)).toBe(100_000)
      expect(getStashGoldLimit(19)).toBe(100_000)
      expect(getStashGoldLimit(20)).toBe(150_000)
      expect(getStashGoldLimit(29)).toBe(150_000)
      expect(getStashGoldLimit(30)).toBe(800_000)
      expect(getStashGoldLimit(31)).toBe(800_000)
      expect(getStashGoldLimit(32)).toBe(850_000)
      expect(getStashGoldLimit(98)).toBe(STASH_GOLD_CAP)
      expect(getStashGoldLimit(99)).toBe(STASH_GOLD_CAP)

      const wp = new WorldPanelsHud()
      expect(wp.getStashMaxGold(1)).toBe(50_000)
      expect(wp.getStashMaxGold(30)).toBe(800_000)
    })

    it('caps vendor gold overflow into stash by getStashGoldLimit(cLvl) instead of flat 2,500,000', () => {
      const purse = { inventoryGold: 10_000, stashGold: 45_000, cLvl: 1 }
      addGoldToPurse(purse, 20_000)
      expect(purse.inventoryGold).toBe(getInventoryGoldLimit(1))
      expect(purse.stashGold).toBe(50_000)
    })

    it('clamps Deposit and Withdraw gold dialog max balance to remaining target container capacity and no-ops when 0', () => {
      const mockHud: any = {
        leftPanel: 'stash',
        rightPanel: 'inv',
        charSheet: { attrs: { level: 1 } },
        inventory: { playerLevel: 1, playerContext: { level: 1 }, gold: 10_000 },
        worldPanels: { localPlayerLevel: 1, stashGold: 48_000 },
        goldDialog: null,
        syncPublishedState: vi.fn(),
      }
      // Level 1 stash cap is 50,000; with 48,000 in stash, max deposit is 2,000
      expect(goldDialogBalance(mockHud, 3)).toBe(2_000)
      openGoldDialog(mockHud, 3)
      expect(mockHud.goldDialog).not.toBeNull()
      expect(mockHud.goldDialog.amount).toBe(2_000)

      // When stash is already at 50,000 capacity, Deposit (mode 3) max transfer is 0 and openGoldDialog no-ops
      mockHud.goldDialog = null
      mockHud.worldPanels.stashGold = 50_000
      expect(goldDialogBalance(mockHud, 3)).toBe(0)
      openGoldDialog(mockHud, 3)
      expect(mockHud.goldDialog).toBeNull()

      // When inventory is already at 10,000 capacity (level 1), Withdraw (mode 4) max transfer is 0 and openGoldDialog no-ops
      expect(goldDialogBalance(mockHud, 4)).toBe(0)
      openGoldDialog(mockHud, 4)
      expect(mockHud.goldDialog).toBeNull()
    })
  })

  describe('Issue #1253: Trade Panel Button Tooltips & Online Shift+Click Quick Transfer', () => {
    it('renders cancel ("CANCEL") and strParty20 ("accept trade") tooltips on trade panel buttons', () => {
      const wp = new WorldPanelsHud()
      wp.setLanguage('en')
      wp.trade = {
        active: true,
        partnerName: 'Akara',
        partnerGold: 0,
        selfGold: 100,
        partnerAccepted: false,
        selfAccepted: false,
        partnerItems: [],
        selfItems: [],
      }

      const dummyImg = { width: 320, height: 432 } as HTMLImageElement
      const tradeAssets = {
        borderLeftImg: dummyImg,
        tradeBgImg: dummyImg,
        tradeBtnImg: dummyImg,
        buySellBtnImg: dummyImg,
        goldCoinBtnImg: dummyImg,
        itemsAtlasImg: dummyImg,
      }

      // Hover Cancel button (ox + 291, oy + 400 -> 371, 460)
      wp.handleMouseMove(80 + 291, 60 + 400)
      expect(wp.hoveredTradeButton).toBe('cancel')
      const m1 = createMockCtx()
      wp.drawTradePanel(m1.ctx, 80, 60, m1.font, tradeAssets)
      expect(m1.drawnTexts.some((t) => t.text === 'CANCEL')).toBe(true)
      expect(m1.drawnTexts.some((t) => t.text.includes('cannot trade'))).toBe(false)

      // Hover Self Accept button (ox + 239, oy + 400 -> 319, 460)
      wp.handleMouseMove(80 + 239, 60 + 400)
      expect(wp.hoveredTradeButton).toBe('selfAccept')
      const m2 = createMockCtx()
      wp.drawTradePanel(m2.ctx, 80, 60, m2.font, tradeAssets)
      expect(m2.drawnTexts.some((t) => t.text.toLowerCase() === 'accept trade')).toBe(true)
    })

    it('supports Shift+Left-Click quick transfer between Inventory, Stash, Cube, and Belt when commandSink is attached', () => {
      const canvas = {
        width: 800,
        height: 600,
        clientWidth: 800,
        clientHeight: 600,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        getContext: () => null,
      } as unknown as HTMLCanvasElement
      const hud = new HudManager(canvas)
      const sink = {
        pickupItemToCursor: vi.fn(),
        placeCursorItem: vi.fn(),
        putBeltItem: vi.fn(),
      }
      hud.commandSink = sink as any
      hud.rightPanel = 'inv'
      hud.inventory.visible = true

      const sword: UiInventoryItem = {
        id: '42',
        code: 'crs',
        name: 'Crystal Sword',
        nameZh: '水晶劍',
        baseNameZh: '水晶劍',
        invFile: 'invcrs',
        invWidth: 2,
        invHeight: 3,
        quality: 'normal',
        allowedSlots: ['weapon1', 'weapon2'],
        stats: [],
      }
      hud.inventory.gridItems = [{ item: sword, col: 0, row: 0 }]

      // 1. Shift+Left-Click in Inventory while Stash is open -> transfers to Stash & emits 0x19 + 0x18 (buffer=4)
      hud.leftPanel = 'stash'
      hud.worldPanels.activePanel = 'stash'
      handleHudMouseDown(
        hud,
        {
          button: 0,
          shiftKey: true,
          ctrlKey: false,
          clientX: INV_GRID_ORIGIN.x + 10,
          clientY: INV_GRID_ORIGIN.y + 10,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as MouseEvent,
        800,
        600,
      )
      expect(hud.inventory.gridItems).toHaveLength(0)
      expect(hud.worldPanels.stashItems).toHaveLength(1)
      expect(sink.pickupItemToCursor).toHaveBeenCalledWith(42)
      expect(sink.placeCursorItem).toHaveBeenCalledWith(42, 0, 0, 4)

      // 2. Shift+Left-Click in Stash -> transfers back to Inventory & emits 0x19 + 0x18 (buffer=0)
      sink.pickupItemToCursor.mockClear()
      sink.placeCursorItem.mockClear()
      handleHudMouseDown(
        hud,
        {
          button: 0,
          shiftKey: true,
          ctrlKey: false,
          clientX: STASH_GRID_ORIGIN.x + 10,
          clientY: STASH_GRID_ORIGIN.y + 10,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as MouseEvent,
        800,
        600,
      )
      expect(hud.worldPanels.stashItems).toHaveLength(0)
      expect(hud.inventory.gridItems).toHaveLength(1)
      expect(sink.pickupItemToCursor).toHaveBeenCalledWith(42)
      expect(sink.placeCursorItem).toHaveBeenCalledWith(42, 0, 0, 0)

      // 3. Shift+Left-Click on potion in Inventory when Stash/Cube closed -> transfers to Belt & emits 0x19 + 0x23
      hud.leftPanel = 'none'
      hud.worldPanels.activePanel = 'none'
      const potion: UiInventoryItem = {
        id: '99',
        code: 'hp1',
        name: 'Minor Healing Potion',
        nameZh: '輕微治療藥水',
        baseNameZh: '輕微治療藥水',
        invFile: 'invpot',
        invWidth: 1,
        invHeight: 1,
        quality: 'normal',
        allowedSlots: [],
        stats: [],
      }
      hud.inventory.gridItems = [{ item: potion, col: 0, row: 0 }]
      sink.pickupItemToCursor.mockClear()
      handleHudMouseDown(
        hud,
        {
          button: 0,
          shiftKey: true,
          ctrlKey: false,
          clientX: INV_GRID_ORIGIN.x + 10,
          clientY: INV_GRID_ORIGIN.y + 10,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as MouseEvent,
        800,
        600,
      )
      expect(hud.inventory.gridItems).toHaveLength(0)
      expect(hud.belt.countTotalPotions()).toBe(1)
      expect(sink.pickupItemToCursor).toHaveBeenCalledWith(99)
      expect(sink.putBeltItem).toHaveBeenCalledWith(99, 0)
    })
  })

  describe('Issue #1249: Inventory 2H Off-Hand Silhouette & Gold/Close Button Tooltips', () => {
    it('renders translucent 2H weapon silhouette in opposite hand slot and shows tooltip on hover', () => {
      const inv = new InventoryPanel()
      inv.visible = true
      inv.lang = 'ENG'
      inv.playerContext = { level: 20, str: 100, dex: 100, classCode: 'ama' }

      const bow: UiInventoryItem = {
        id: 'bow-1',
        code: 'sbb',
        name: 'Short Battle Bow',
        nameZh: '短戰鬥弓',
        baseNameZh: '短戰鬥弓',
        invFile: 'invsbb',
        invWidth: 2,
        invHeight: 3,
        quality: 'normal',
        twoHanded: true,
        allowedSlots: ['weapon1', 'weapon2'],
        stats: [],
      }
      inv.equipped.weapon1 = bow

      // Hovering empty weapon2 slot resolves the 2H weapon from weapon1
      const w2 = EQUIP_SLOTS_LAYOUT.weapon2
      inv.handleMouseMove(w2.x + 10, w2.y + 10)
      expect(inv.hoveredItem?.item).toBe(bow)

      // Drawing inventory renders weapon2 slot with 0.38 translucent alpha
      const { ctx, font, drawnImages } = createMockCtx()
      const dummyImg = { width: 512, height: 512 } as HTMLImageElement
      inv.draw(
        ctx,
        {
          borderRightImg: dummyImg,
          invSheetImg: dummyImg,
          invTab0Img: dummyImg,
          invTab1Img: dummyImg,
          buySellBtnImg: dummyImg,
          goldCoinBtnImg: dummyImg,
          itemsAtlasImg: dummyImg,
          itemRects: { invsbb: { x: 0, y: 0, w: 56, h: 84 } },
        },
        font,
      )
      expect(drawnImages.some((d) => Math.abs(d.alpha - 0.38) < 1e-6)).toBe(true)
    })

    it('renders hover tooltips on Inventory and Stash gold & close buttons', () => {
      const inv = new InventoryPanel()
      inv.visible = true
      inv.lang = 'ENG'
      const dummyImg = { width: 512, height: 512 } as HTMLImageElement
      const invAssets = {
        borderRightImg: dummyImg,
        invSheetImg: dummyImg,
        invTab0Img: dummyImg,
        invTab1Img: dummyImg,
        buySellBtnImg: dummyImg,
        goldCoinBtnImg: dummyImg,
        itemsAtlasImg: dummyImg,
        itemRects: {},
      }

      // Hover inventory gold button (stash closed -> Drop Gold)
      inv.stashOpen = false
      inv.handleMouseMove(INV_GOLD_BTN_BOUNDS.x + 5, INV_GOLD_BTN_BOUNDS.y + 5)
      expect(inv.hoveredButton).toBe('gold')
      const m1 = createMockCtx()
      inv.draw(m1.ctx, invAssets, m1.font)
      expect(m1.drawnTexts.some((t) => t.text.toLowerCase().includes('drop'))).toBe(true)

      // Hover inventory close button -> Close
      inv.handleMouseMove(INV_CLOSE_BTN_BOUNDS.x + 10, INV_CLOSE_BTN_BOUNDS.y + 10)
      expect(inv.hoveredButton).toBe('close')
      const m2 = createMockCtx()
      inv.draw(m2.ctx, invAssets, m2.font)
      expect(m2.drawnTexts.some((t) => t.text === 'Close')).toBe(true)
    })
  })

  describe('Issue #1248: Character Sheet Hover Tooltips & Non-AR Spell Gating', () => {
    it('gates Attack Rating display on doesSkillUseAttackRating (blank for spells/Smite, shown for physical/bow attacks)', () => {
      expect(doesSkillUseAttackRating(0)).toBe(true) // Attack
      expect(doesSkillUseAttackRating(106)).toBe(true) // Zeal
      expect(doesSkillUseAttackRating(47)).toBe(false) // Fire Ball
      expect(doesSkillUseAttackRating(54)).toBe(false) // Teleport
      expect(doesSkillUseAttackRating(97)).toBe(false) // Smite

      const sheet = new CharacterSheetPanel()
      sheet.visible = true
      sheet.lang = 'ENG'
      sheet.attrs.level = 30
      sheet.attrs.attackRating = 1234
      sheet.attrs.leftAttackRating = 1234
      sheet.attrs.rightAttackRating = 5678
      sheet.attrs.leftSkillId = 47 // Fire Ball (spell -> no AR)
      sheet.attrs.rightSkillId = 106 // Zeal (melee -> shows AR)

      const dummyImg = { width: 320, height: 432 } as HTMLImageElement
      const { ctx, font, drawnTexts } = createMockCtx()
      sheet.draw(
        ctx,
        {
          hp: 100,
          maxHp: 100,
          mana: 50,
          maxMana: 50,
          stamina: 80,
          maxStamina: 80,
          leftSkillDmg: '100-120',
          rightSkillDmg: '50-80',
        },
        {
          borderLeftImg: dummyImg,
          charSheetImg: dummyImg,
          buySellBtnImg: dummyImg,
          levelBtnImg: dummyImg,
        },
        font,
      )
      expect(drawnTexts.some((t) => t.text === '1234')).toBe(false)
      expect(drawnTexts.some((t) => t.text === '5678')).toBe(true)
    })

    it('renders Defense (Chance to Block + Monster Hit %), Attack Rating (Chance to Hit %), and Close button hover tooltips', () => {
      const sheet = new CharacterSheetPanel()
      sheet.visible = true
      sheet.lang = 'ENG'
      sheet.attrs.level = 30
      sheet.attrs.dex = 95
      sheet.attrs.defense = 500
      sheet.attrs.attackRating = 1500
      sheet.attrs.leftAttackRating = 1500
      sheet.attrs.leftSkillId = 0
      sheet.attrs.shieldBaseBlock = 50 // floor(50 * (95 - 15) / 60) = 66%
      sheet.attrs.lastMonsterName = 'Fallen'
      sheet.attrs.lastMonsterLevel = 30
      sheet.attrs.lastMonsterAttackRating = 500
      sheet.attrs.lastMonsterDefense = 500

      expect(computeCharacterBlockChancePct(sheet.attrs)).toBe(66)
      expect(computeCharSheetHitChancePct(1500, 500, 30, 30)).toBe(75)

      // 1. Hover Defense box
      sheet.handleMouseMove(CHAR_PANEL_ORIGIN.x + 220, CHAR_PANEL_ORIGIN.y + 204)
      expect(sheet.hoveredElement).toBe('defense')
      const defLines = sheet.formatVanillaHoverTooltipLines()
      expect(defLines.join('\n')).toContain('Chance to Block: 66%')
      expect(defLines.join('\n')).toContain('Fallen')
      expect(defLines.join('\n')).toContain('50%')

      // 2. Hover Left AR box
      sheet.handleMouseMove(CHAR_PANEL_ORIGIN.x + 220, CHAR_PANEL_ORIGIN.y + 150)
      expect(sheet.hoveredElement).toBe('leftAr')
      const arLines = sheet.formatVanillaHoverTooltipLines()
      expect(arLines.join('\n')).toContain('Fallen: 75%')

      // 3. Hover Close button
      sheet.handleMouseMove(CHAR_CLOSE_BTN_BOUNDS.x + 10, CHAR_CLOSE_BTN_BOUNDS.y + 10)
      expect(sheet.hoveredElement).toBe('close')
      expect(sheet.formatVanillaHoverTooltipLines()).toEqual(['Close'])
    })
  })
})
