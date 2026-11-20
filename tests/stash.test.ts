/**
 * tests/stash.test.ts
 *
 * Comprehensive Unit and Parity Test Suite for Milestone M5 (Issue #150):
 * Camp Town Stash Entities Across 5 Acts & 6x8 Storage Panel.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  STASH_PANEL_ORIGIN,
  STASH_GRID_ORIGIN,
  STASH_GOLD_CAP,
  STASH_HEADER_ICON_SOCKET,
  STASH_HEADER_TOP_RECESS,
  STASH_HEADER_BOTTOM_RECESS,
  WorldPanelsHud,
} from '../src/client/ui/world-panels.ts'
import type { D2FontRenderer } from '../src/client/ui/font.ts'
import {
  InventoryPanel,
  type UiInventoryItem,
  INV_GRID_ORIGIN,
} from '../src/client/ui/inventory.ts'
import { type TownStashEntity, CANONICAL_TOWN_STASHES } from '../src/common/world/scene-population.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import { createIsoTerrain } from '../src/common/world/iso-terrain.ts'
import { WaypointNetwork } from '../src/common/world/portal.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'

class MockWindow extends EventTarget {
  innerWidth = 1920
  innerHeight = 1080
  devicePixelRatio = 1
}

if (typeof globalThis.window === 'undefined') {
  // @ts-ignore
  globalThis.window = new MockWindow()
}
if (typeof globalThis.HTMLInputElement === 'undefined') {
  // @ts-ignore
  globalThis.HTMLInputElement = class HTMLInputElement {}
}
if (typeof globalThis.HTMLSelectElement === 'undefined') {
  // @ts-ignore
  globalThis.HTMLSelectElement = class HTMLSelectElement {}
}

function createDummyItem(id: string, code: string, w: number, h: number, nameZh: string): UiInventoryItem {
  return {
    id,
    code,
    invFile: code,
    name: nameZh,
    nameZh,
    baseNameZh: nameZh,
    quality: 'normal',
    invWidth: w,
    invHeight: h,
    allowedSlots: [],
    stats: [],
  }
}

describe('Milestone M5 (Issue #150): Camp Town Stash Entities Across 5 Acts & 6x8 Storage Panel', () => {
  describe('1. Authentic Town Stash Entities Across Acts 1..5', () => {
    it('defines canonical stash entities for all 5 acts with Objects.txt row 267 B6 token', () => {
      for (let act = 1; act <= 5; act++) {
        const stash = CANONICAL_TOWN_STASHES[act]
        expect(stash, `Expected canonical stash for Act ${act}`).toBeDefined()
        expect(stash.act).toBe(act)
        expect(stash.objectsTxtId).toBe(267)
        expect(stash.token).toBe('B6')
        expect(stash.clickRadiusPx).toBe(48)
        expect(stash.interactionRangePx).toBe(80)
        expect(stash.x).toBeGreaterThan(0)
        expect(stash.y).toBeGreaterThan(0)
      }
    })

    it('verifies exact 1.13c coordinates for all 5 act towns', () => {
      // Act 1: Rogue Encampment (towne1 default)
      expect(CANONICAL_TOWN_STASHES[1].x).toBe(4512)
      expect(CANONICAL_TOWN_STASHES[1].y).toBe(1720)
      expect(CANONICAL_TOWN_STASHES[1].subTileX).toBe(112)
      expect(CANONICAL_TOWN_STASHES[1].subTileY).toBe(86)

      // Act 2: Lut Gholein
      expect(CANONICAL_TOWN_STASHES[2].x).toBe(5328)
      expect(CANONICAL_TOWN_STASHES[2].y).toBe(1568)

      // Act 3: Kurast Docks
      expect(CANONICAL_TOWN_STASHES[3].x).toBe(5264)
      expect(CANONICAL_TOWN_STASHES[3].y).toBe(1584)

      // Act 4: The Pandemonium Fortress
      expect(CANONICAL_TOWN_STASHES[4].x).toBe(704)
      expect(CANONICAL_TOWN_STASHES[4].y).toBe(552)

      // Act 5: Harrogath
      expect(CANONICAL_TOWN_STASHES[5].x).toBe(3792)
      expect(CANONICAL_TOWN_STASHES[5].y).toBe(1448)
    })

    it('verifies prebaked town scenes in public/packs contain the B6 stash object', () => {
      const townScenes: Record<number, string> = {
        1: 'public/packs/act1/1-act-1-town-towne1/scene.json',
        2: 'public/packs/act2/40-act-2-town-lutn/scene.json',
        3: 'public/packs/act3/75-act-3-town-docktown3/scene.json',
        4: 'public/packs/act4/103-act-4-town-fortress/scene.json',
        5: 'public/packs/act5/109-act-5-town-townwest/scene.json',
      }

      for (let act = 1; act <= 5; act++) {
        const p = join(process.cwd(), townScenes[act]!)
        if (existsSync(p)) {
          const raw = readFileSync(p, 'utf-8')
          const scene = JSON.parse(raw)
          const stashObj = scene.objects?.find((o: any) => o.objectsTxtId === 267 || o.token === 'B6')
          expect(stashObj, `Expected B6 stash object in scene ${townScenes[act]}`).toBeDefined()
          expect(stashObj.token).toBe('B6')
          expect(stashObj.objectsTxtId).toBe(267)
        }
      }
    })
  })

  describe('2. Stash Panel & 6x8 Grid Layout & Dimensions', () => {
    it('defines authentic 6x8 grid origin and 29x29 cell size inside 320x432 panel', () => {
      expect(STASH_PANEL_ORIGIN.w).toBe(320)
      expect(STASH_PANEL_ORIGIN.h).toBe(432)
      expect(STASH_GRID_ORIGIN.cols).toBe(6)
      expect(STASH_GRID_ORIGIN.rows).toBe(8)
      expect(STASH_GRID_ORIGIN.cellPx).toBe(29)

      // Absolute grid top-left: ox (80) + 74 = 154, oy (60) + 82 = 142
      expect(STASH_GRID_ORIGIN.x).toBe(154)
      expect(STASH_GRID_ORIGIN.y).toBe(142)

      // Absolute grid width: 6 * 29 = 174px -> right boundary = 154 + 174 = 328
      // Absolute grid height: 8 * 29 = 232px -> bottom boundary = 142 + 232 = 374
      expect(STASH_GRID_ORIGIN.x + STASH_GRID_ORIGIN.cols * STASH_GRID_ORIGIN.cellPx).toBe(328)
      expect(STASH_GRID_ORIGIN.y + STASH_GRID_ORIGIN.rows * STASH_GRID_ORIGIN.cellPx).toBe(374)
    })

    it('does not render non-authentic deposit or withdraw buttons over bottom keyhole area', () => {
      const panels = new WorldPanelsHud()
      const drawTextCalls: string[] = []
      const mockFont = {
        drawText: (_ctx: CanvasRenderingContext2D, text: string) => {
          drawTextCalls.push(text)
        },
        measureText: (text: string) => text.length * 6.5,
      } as unknown as D2FontRenderer
      const mockCtx = {
        drawImage: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillStyle: '',
        strokeStyle: '',
      } as unknown as CanvasRenderingContext2D

      panels.drawLeftDockPanel(
        mockCtx,
        'stash',
        {
          questBgImg: null,
          waypointBgImg: null,
          borderLeftImg: null,
          stashBgImg: null,
          cubeBgImg: null,
          vendorBgImg: null,
          buySellBtnImg: null,
        },
        mockFont,
      )

      expect(drawTextCalls).not.toContain('存入')
      expect(drawTextCalls).not.toContain('取出')
    })

    it('confirms stash background graphic asset exists in public/ui/stash-bg.png', () => {
      const bgPath = join(process.cwd(), 'public/ui/stash-bg.png')
      expect(existsSync(bgPath)).toBe(true)
    })
  })

  describe('3. Stash Grid Placement, Collision, and Bounds Validation', () => {
    let panels: WorldPanelsHud

    beforeEach(() => {
      panels = new WorldPanelsHud()
    })

    it('places an item in free stash cells and checks collision overlaps', () => {
      const ring = createDummyItem('ring1', 'rin', 1, 1, '乔丹之石 (Stone of Jordan)')
      expect(panels.canPlaceInStash(0, 0, 1, 1)).toBe(true)
      panels.stashItems.push({ item: ring, col: 0, row: 0 })

      // Same cell is now blocked
      expect(panels.canPlaceInStash(0, 0, 1, 1)).toBe(false)
      expect(panels.getStashOverlaps(0, 0, 1, 1)).toHaveLength(1)
      expect(panels.getStashOverlaps(0, 0, 1, 1)[0]!.item.id).toBe('ring1')

      // Adjacent cell (1, 0) is free
      expect(panels.canPlaceInStash(1, 0, 1, 1)).toBe(true)
    })

    it('rejects multi-cell items overlapping existing items', () => {
      const sword = createDummyItem('sword1', 'crs', 2, 3, '水晶剑 (Crystal Sword)')
      panels.stashItems.push({ item: sword, col: 1, row: 1 })

      // An overlapping 2x2 shield at (0, 1) overlaps sword at col 1
      expect(panels.canPlaceInStash(0, 1, 2, 2)).toBe(false)
      const overlaps = panels.getStashOverlaps(0, 1, 2, 2)
      expect(overlaps).toHaveLength(1)
      expect(overlaps[0]!.item.id).toBe('sword1')

      // Non-overlapping placement at (3, 1) is allowed
      expect(panels.canPlaceInStash(3, 1, 2, 2)).toBe(true)
    })

    it('strictly enforces 6x8 bounds (throws RangeError in getStashOverlaps, returns false in canPlaceInStash)', () => {
      // 2x2 item at col 5, row 0 exceeds 6 cols (5 + 2 = 7 > 6)
      expect(panels.canPlaceInStash(5, 0, 2, 2)).toBe(false)
      expect(() => panels.getStashOverlaps(5, 0, 2, 2)).toThrow(RangeError)

      // 1x3 item at col 0, row 6 exceeds 8 rows (6 + 3 = 9 > 8)
      expect(panels.canPlaceInStash(0, 6, 1, 3)).toBe(false)
      expect(() => panels.getStashOverlaps(0, 6, 1, 3)).toThrow(RangeError)

      // Negative coordinates
      expect(panels.canPlaceInStash(-1, 0, 1, 1)).toBe(false)
      expect(() => panels.getStashOverlaps(-1, 0, 1, 1)).toThrow(RangeError)
    })

    it('autoPlaceInStash finds the first free slot or returns false when full', () => {
      const grandCharm = createDummyItem('gc1', 'cm3', 1, 3, '超大型护身符 (Grand Charm)')
      const placed = panels.autoPlaceInStash(grandCharm)
      expect(placed).toBe(true)
      expect(panels.stashItems).toHaveLength(1)
      expect(panels.stashItems[0]!.col).toBe(0)
      expect(panels.stashItems[0]!.row).toBe(0)

      // Second grand charm should be placed at col 0, row 3 (underneath)
      const gc2 = createDummyItem('gc2', 'cm3', 1, 3, '超大型护身符 (Grand Charm 2)')
      expect(panels.autoPlaceInStash(gc2)).toBe(true)
      expect(panels.stashItems[1]!.col).toBe(0)
      expect(panels.stashItems[1]!.row).toBe(3)
    })

    it('clickStashCell handles picking up, placing, and swapping items', () => {
      const helm = createDummyItem('helm1', 'cap', 2, 2, '军帽 (Shako)')
      panels.stashItems.push({ item: helm, col: 0, row: 0 })

      // 1. Pick up item with empty cursor
      const pickRes = panels.clickStashCell(0, 0, null)
      expect(pickRes.handled).toBe(true)
      expect(pickRes.newCursorItem?.id).toBe('helm1')
      expect(panels.stashItems).toHaveLength(0)

      // 2. Place item down at (2, 2)
      const placeRes = panels.clickStashCell(2, 2, pickRes.newCursorItem)
      expect(placeRes.handled).toBe(true)
      expect(placeRes.newCursorItem).toBeNull()
      expect(panels.stashItems).toHaveLength(1)
      expect(panels.stashItems[0]!.col).toBe(2)
      expect(panels.stashItems[0]!.row).toBe(2)

      // 3. Swap with held ring
      const ring = createDummyItem('ring2', 'rin', 1, 1, '布尔凯索之戒')
      const swapRes = panels.clickStashCell(2, 2, ring)
      expect(swapRes.handled).toBe(true)
      expect(swapRes.newCursorItem?.id).toBe('helm1')
      expect(panels.stashItems).toHaveLength(1)
      expect(panels.stashItems[0]!.item.id).toBe('ring2')
    })
  })

  describe('4. Quick Transfer Between Inventory and Stash', () => {
    let panels: WorldPanelsHud
    let inv: InventoryPanel

    beforeEach(() => {
      panels = new WorldPanelsHud()
      inv = new InventoryPanel()
    })

    it('quickTransferToStash moves item from inventory to stash and removes from inventory', () => {
      const item = createDummyItem('transfer1', 'rin', 1, 1, '测试戒指')
      inv.gridItems = [{ item, col: 0, row: 0 }]
      expect(panels.stashItems).toHaveLength(0)

      const success = panels.quickTransferToStash(item, inv)
      expect(success).toBe(true)
      expect(inv.gridItems).toHaveLength(0)
      expect(panels.stashItems).toHaveLength(1)
      expect(panels.stashItems[0]!.item.id).toBe('transfer1')
    })

    it('quickTransferToStash fails without removing item if stash is full', () => {
      // Fill stash with 48 1x1 items
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 6; c++) {
          panels.stashItems.push({
            item: createDummyItem(`fill-${r}-${c}`, 'rin', 1, 1, '填充物'),
            col: c,
            row: r,
          })
        }
      }
      expect(panels.stashItems).toHaveLength(48)

      const overflowItem = createDummyItem('overflow', 'rin', 1, 1, '溢出物品')
      inv.gridItems = [{ item: overflowItem, col: 0, row: 0 }]

      const success = panels.quickTransferToStash(overflowItem, inv)
      expect(success).toBe(false)
      expect(inv.gridItems).toHaveLength(1)
      expect(panels.stashItems).toHaveLength(48)
    })

    it('quickTransferFromStash moves item from stash to inventory and removes from stash', () => {
      const item = createDummyItem('fromStash1', 'rin', 1, 1, '储物箱戒指')
      panels.stashItems = [{ item, col: 0, row: 0 }]
      inv.gridItems = []

      const success = panels.quickTransferFromStash(item, inv)
      expect(success).toBe(true)
      expect(panels.stashItems).toHaveLength(0)
      expect(inv.gridItems).toHaveLength(1)
      expect(inv.gridItems[0]!.item.id).toBe('fromStash1')
    })

    it('quickTransferFromStash fails without removing item if inventory is full', () => {
      // Fill inventory with 40 1x1 items
      inv.gridItems = []
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 10; c++) {
          inv.gridItems.push({
            item: createDummyItem(`inv-fill-${r}-${c}`, 'rin', 1, 1, '背包填充'),
            col: c,
            row: r,
          })
        }
      }
      expect(inv.gridItems).toHaveLength(40)

      const stashItem = createDummyItem('cantTransfer', 'rin', 1, 1, '无法转移')
      panels.stashItems = [{ item: stashItem, col: 0, row: 0 }]

      const success = panels.quickTransferFromStash(stashItem, inv)
      expect(success).toBe(false)
      expect(panels.stashItems).toHaveLength(1)
      expect(inv.gridItems).toHaveLength(40)
    })
  })

  describe('5. Stash Gold Cap (server-driven transfers)', () => {
    it('exposes STASH_GOLD_CAP = 2,500,000 (D2Common #11060) and performs no local gold mutation', () => {
      expect(STASH_GOLD_CAP).toBe(2_500_000)
      const panels = new WorldPanelsHud()
      // Deposit/withdraw are ClickButton commands sent by HudModel; D2Game owns the balances.
      expect((panels as unknown as Record<string, unknown>)['depositGold']).toBeUndefined()
      expect((panels as unknown as Record<string, unknown>)['withdrawGold']).toBeUndefined()
    })
  })

  describe('7. HUD Manager Integration & Split Dock Synergy', () => {
    let hudCanvas: HTMLCanvasElement
    let hud: HudManager

    beforeEach(() => {
      hudCanvas = {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: () => null,
        style: { cursor: '' },
      } as unknown as HTMLCanvasElement

      hud = new HudManager(hudCanvas, {
        onWaypointTeleport: () => {},
        onToggleAutomap: () => {},
      })
    })

    it('toggleLeftPanel("stash") automatically opens inventory on the right dock', () => {
      expect(hud.leftPanel).toBe('none')
      expect(hud.rightPanel).toBe('none')

      hud.toggleLeftPanel('stash')
      expect(hud.leftPanel).toBe('stash')
      expect(hud.rightPanel).toBe('inv')
      expect(hud.inventory.visible).toBe(true)

      // Toggling stash off leaves right panel intact or allows closing all
      hud.toggleLeftPanel('stash')
      expect(hud.leftPanel).toBe('none')
    })

    it('closeAllPanels closes stash and inventory together', () => {
      hud.toggleLeftPanel('stash')
      expect(hud.leftPanel).toBe('stash')
      expect(hud.rightPanel).toBe('inv')

      const closed = hud.closeAllPanels()
      expect(closed).toBe(true)
      expect(hud.leftPanel).toBe('none')
      expect(hud.rightPanel).toBe('none')
      expect(hud.inventory.visible).toBe(false)
    })
  })

  describe('8. Stash Header Recessed Boxes & Text Alignment Parity (Issue #493)', () => {
    it('defines exact TradeStash.dc6 recessed box bounds and centered baselines', () => {
      // Left square icon socket in top row: relX = 74..93, relY = 24..38 (20x15)
      expect(STASH_HEADER_ICON_SOCKET).toEqual({
        x: 80 + 74,
        y: 60 + 24,
        relX: 74,
        relY: 24,
        w: 20,
        h: 15,
      })

      // Right title recess in top row (after relX = 94..96 divider): relX = 97..247, relY = 24..38 (151x15)
      expect(STASH_HEADER_TOP_RECESS).toEqual({
        x: 80 + 97,
        y: 60 + 24,
        relX: 97,
        relY: 24,
        w: 151,
        h: 15,
        textX: 80 + 172,
        textY: 60 + 35,
      })

      // Full-width gold readout recess in bottom row: relX = 75..246, relY = 49..65 (172x17)
      expect(STASH_HEADER_BOTTOM_RECESS).toEqual({
        x: 80 + 75,
        y: 60 + 49,
        relX: 75,
        relY: 49,
        w: 172,
        h: 17,
        textX: 80 + 160,
        textY: 60 + 61,
      })
    })

    it('renders Private Stash title and gold readout centered inside their respective recessed boxes without crossing dividers', () => {
      const panels = new WorldPanelsHud()
      panels.stashGold = 2_500_000

      const drawTextCalls: Array<{
        text: string
        x: number
        y: number
        opts?: { font?: string; color?: string; align?: string }
      }> = []

      const mockFont = {
        drawText: (_ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts?: any) => {
          drawTextCalls.push({ text, x, y, opts })
        },
        measureText: (text: string) => text.length * 6.5,
      } as unknown as D2FontRenderer

      const mockCtx = {
        drawImage: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillStyle: '',
        strokeStyle: '',
      } as unknown as CanvasRenderingContext2D

      panels.drawLeftDockPanel(
        mockCtx,
        'stash',
        {
          questBgImg: null,
          waypointBgImg: null,
          borderLeftImg: null,
          stashBgImg: null,
          cubeBgImg: null,
          vendorBgImg: null,
          buySellBtnImg: null,
        },
        mockFont,
      )

      const titleCall = drawTextCalls.find(c => c.text.includes('你的私人儲藏箱')) // tbl 'bank'
      const goldCall = drawTextCalls.find(c => c.text.includes('儲藏起來的金錢：')) // tbl 'strGoldInStash'

      expect(titleCall).toBeDefined()
      expect(goldCall).toBeDefined()

      // 1. Top title must be centered in the right compartment (relX = 97..247 -> center ox + 172 = 252)
      // and vertically centered in relY = 24..38 (alphabetic baseline oy + 35 = 95)
      expect(titleCall!.x).toBe(STASH_HEADER_TOP_RECESS.textX)
      expect(titleCall!.y).toBe(STASH_HEADER_TOP_RECESS.textY)
      expect(titleCall!.opts?.font).toBe('font8')
      expect(titleCall!.opts?.color).toBe('gold')
      expect(titleCall!.opts?.align).toBe('center')

      // Verify title glyph vertical span [y - 9, y + 1] stays strictly inside top recess [oy + 24, oy + 38]
      const topRecessTop = STASH_HEADER_TOP_RECESS.y
      const topRecessBottom = STASH_HEADER_TOP_RECESS.y + STASH_HEADER_TOP_RECESS.h - 1
      expect(titleCall!.y - 9).toBeGreaterThanOrEqual(topRecessTop)
      expect(titleCall!.y + 1).toBeLessThanOrEqual(topRecessBottom)

      // Verify title horizontal span (~130px in font8) stays strictly inside [ox + 97, ox + 247] (never crossing relX = 94..96 divider)
      const approxTitleWidth = 130
      expect(titleCall!.x - approxTitleWidth / 2).toBeGreaterThan(STASH_HEADER_TOP_RECESS.x)
      expect(titleCall!.x + approxTitleWidth / 2).toBeLessThan(STASH_HEADER_TOP_RECESS.x + STASH_HEADER_TOP_RECESS.w)

      // 2. Bottom gold text must be centered in the bottom recess (relX = 75..246 -> center ox + 160 = 240)
      // and vertically centered in relY = 49..65 (alphabetic baseline oy + 61 = 121)
      expect(goldCall!.x).toBe(STASH_HEADER_BOTTOM_RECESS.textX)
      expect(goldCall!.y).toBe(STASH_HEADER_BOTTOM_RECESS.textY)
      expect(goldCall!.opts?.font).toBe('font8')
      expect(goldCall!.opts?.color).toBe('white')
      expect(goldCall!.opts?.align).toBe('center')

      // Verify gold glyph vertical span [y - 9, y + 1] stays strictly inside bottom recess [oy + 49, oy + 65]
      const bottomRecessTop = STASH_HEADER_BOTTOM_RECESS.y
      const bottomRecessBottom = STASH_HEADER_BOTTOM_RECESS.y + STASH_HEADER_BOTTOM_RECESS.h - 1
      expect(goldCall!.y - 9).toBeGreaterThanOrEqual(bottomRecessTop)
      expect(goldCall!.y + 1).toBeLessThanOrEqual(bottomRecessBottom)
    })
  })
})
