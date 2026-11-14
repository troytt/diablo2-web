/**
 * Unit & Parity Tests for Diablo II v1.13c Ethereal Item UI Translucency (`D2Client.dll` `GFX_DrawItem` @ `0x6FB1B5A0`).
 *
 * Ground Truth:
 * - `D2Client.dll` `0x6FB1B684..0x6FB1B6B2` (`ENGINE\Gfx.cpp` line 2754):
 *   Calls `D2Common.dll!#10202` (`ITEMS_CheckItemFlag(pItem, IFLAG_ETHEREAL = 0x00400000, 2754, ...)`).
 *   If non-zero, overrides `eDrawMode` from `DRAWMODE_NORMAL (5)` (100% opaque) to `DRAWMODE_TRANS50 (1)` (50% opacity).
 * - `D2Direct3D.dll` (`0x6F886CD3..0x6F886CEF`): `DRAWMODE_TRANS50 (1)` maps to `alpha = 0x80` (`128 / 255` ≈ 50% opacity).
 * - `D2Client.dll` `0x6FB4525F` (`UI\inv.cpp`): Socketed Gems/Runes/Jewels inside an Ethereal host item
 *   are drawn individually via `GFX_DrawItem(pSocketedItem)` and remain 100% opaque (`DRAWMODE_NORMAL = 5`).
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ETHEREAL_ITEM_ALPHA,
  InventoryPanel,
  drawItemSocketOverlay,
  isUiItemEthereal,
  resolveItemSpriteRect,
  type UiInventoryItem,
} from '../src/client/ui/inventory.ts'
import { WorldPanelsHud } from '../src/client/ui/world-panels.ts'
import { getTownNpcDescriptorByHcIdx } from '../src/common/units/npc-table.ts'
import { CursorController } from '../src/client/ui/cursor.ts'
import { CURSOR_METADATA } from '../src/common/items/cursor-meta.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'

interface RecordedImageDraw {
  readonly img: unknown
  readonly sx: number
  readonly sy: number
  readonly sw: number
  readonly sh: number
  readonly alpha: number
}

function createRecordingCanvasContext(): {
  ctx: CanvasRenderingContext2D
  draws: RecordedImageDraw[]
} {
  const draws: RecordedImageDraw[] = []
  const alphaStack: number[] = []
  const state = {
    globalAlpha: 1,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
  }
  const ctx = {
    get globalAlpha() {
      return state.globalAlpha
    },
    set globalAlpha(v: number) {
      state.globalAlpha = v
    },
    get fillStyle() {
      return state.fillStyle
    },
    set fillStyle(v: string) {
      state.fillStyle = v
    },
    get strokeStyle() {
      return state.strokeStyle
    },
    set strokeStyle(v: string) {
      state.strokeStyle = v
    },
    get lineWidth() {
      return state.lineWidth
    },
    set lineWidth(v: number) {
      state.lineWidth = v
    },
    save: vi.fn(() => {
      alphaStack.push(state.globalAlpha)
    }),
    restore: vi.fn(() => {
      if (alphaStack.length > 0) {
        state.globalAlpha = alphaStack.pop()!
      }
    }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    fillText: vi.fn(),
    drawImage: vi.fn((img: unknown, sx: number, sy: number, sw: number, sh: number) => {
      draws.push({
        img,
        sx,
        sy,
        sw,
        sh,
        alpha: state.globalAlpha,
      })
    }),
  } as unknown as CanvasRenderingContext2D

  return { ctx, draws }
}

function createDummyAtlasImage(tag: string): HTMLImageElement {
  return {
    tag,
    complete: true,
    naturalWidth: 2048,
    naturalHeight: 2048,
    width: 2048,
    height: 2048,
  } as unknown as HTMLImageElement
}

function createMockFont() {
  return {
    measureText: vi.fn((text: string) => text.length * 7),
    drawText: vi.fn(),
  } as any
}

function makeQuiltedArmorItem(overrides: Partial<UiInventoryItem> = {}): UiInventoryItem {
  return {
    id: 'eth-quilted-1',
    code: 'qui',
    name: '痛苦之投掷 布甲',
    nameZh: '痛苦之投掷',
    baseNameZh: '布甲',
    quality: 'rare',
    invFile: 'invqui',
    invWidth: 2,
    invHeight: 3,
    allowedSlots: ['armor'],
    stats: [{ text: '无形 (无法修复)', color: 'blue' }],
    ethereal: true,
    ...overrides,
  }
}

function makeDockPanelAssets(dummyImg: HTMLImageElement, itemsAtlasImg: HTMLImageElement) {
  return {
    borderLeftImg: dummyImg,
    questBgImg: dummyImg,
    waypointBgImg: dummyImg,
    stashBgImg: dummyImg,
    cubeBgImg: dummyImg,
    vendorBgImg: dummyImg,
    vendorTabsImg: dummyImg,
    buySellBtnImg: dummyImg,
    miniConvertImg: dummyImg,
    itemsAtlasImg,
  }
}

describe('Diablo II v1.13c Ethereal Item UI Translucency (`GFX_DrawItem` @ `0x6FB1B5A0`)', () => {
  it('verifies ETHEREAL_ITEM_ALPHA is 0.5 (DRAWMODE_TRANS50 = 1 -> 0x80 / 0xFF) and isUiItemEthereal checks all 1.13c representations', () => {
    expect(ETHEREAL_ITEM_ALPHA).toBe(0.5)

    expect(isUiItemEthereal(null)).toBe(false)
    expect(isUiItemEthereal(undefined)).toBe(false)
    expect(isUiItemEthereal(makeQuiltedArmorItem({ ethereal: true }))).toBe(true)
    expect(isUiItemEthereal(makeQuiltedArmorItem({ ethereal: false }))).toBe(false)

    // Raw Item flags.ethereal
    expect(
      isUiItemEthereal(
        makeQuiltedArmorItem({
          ethereal: undefined,
          rawItem: { flags: { ethereal: true } } as any,
        }),
      ),
    ).toBe(true)

    // 1.13c rawFlags bitmask IFLAG_ETHEREAL (0x00400000)
    expect(
      isUiItemEthereal(
        makeQuiltedArmorItem({
          ethereal: undefined,
          rawItem: { rawFlags: 0x00400000 } as any,
        }),
      ),
    ).toBe(true)

    // Gamble mystery items never render as ethereal prior to purchase
    expect(
      isUiItemEthereal(
        makeQuiltedArmorItem({
          ethereal: true,
          isGambleMystery: true,
        }),
      ),
    ).toBe(false)
  })

  it('renders ethereal items at 50% opacity in Inventory bag grid and Equipped paperdoll slots, and normal items at 100% opacity', () => {
    const inv = new InventoryPanel()
    inv.visible = true

    const ethArmor = makeQuiltedArmorItem({ id: 'bag-eth-qui', ethereal: true })
    const normalSword: UiInventoryItem = {
      id: 'bag-norm-bsd',
      code: 'bsd',
      name: 'Broad Sword',
      nameZh: '阔剑',
      baseNameZh: '阔剑',
      quality: 'normal',
      invFile: 'invbsd',
      invWidth: 2,
      invHeight: 3,
      allowedSlots: ['weapon1', 'weapon2'],
      stats: [],
      ethereal: false,
    }
    const ethHelm: UiInventoryItem = {
      id: 'eq-eth-cap',
      code: 'cap',
      name: 'Cap',
      nameZh: '帽子',
      baseNameZh: '帽子',
      quality: 'magic',
      invFile: 'invcap',
      invWidth: 2,
      invHeight: 2,
      allowedSlots: ['helm'],
      stats: [],
      ethereal: true,
    }

    inv.gridItems = [
      { item: ethArmor, col: 0, row: 0 },
      { item: normalSword, col: 2, row: 0 },
    ]
    inv.equipped.helm = ethHelm

    const itemsAtlasImg = createDummyAtlasImage('itemsAtlas')
    const { ctx, draws } = createRecordingCanvasContext()

    inv.draw(
      ctx,
      {
        borderRightImg: null,
        invSheetImg: null,
        invTab0Img: null,
        invTab1Img: null,
        buySellBtnImg: null,
        goldCoinBtnImg: null,
        itemsAtlasImg,
        itemRects: BAKED_UI_MANIFEST.itemRects,
      },
      createMockFont(),
    )

    const quiRect = resolveItemSpriteRect(ethArmor, BAKED_UI_MANIFEST.itemRects)!
    const bsdRect = resolveItemSpriteRect(normalSword, BAKED_UI_MANIFEST.itemRects)!
    const capRect = resolveItemSpriteRect(ethHelm, BAKED_UI_MANIFEST.itemRects)!

    const itemDraws = draws.filter(d => d.img === itemsAtlasImg)
    const quiDraw = itemDraws.find(d => d.sx === quiRect.x && d.sy === quiRect.y)
    const bsdDraw = itemDraws.find(d => d.sx === bsdRect.x && d.sy === bsdRect.y)
    const capDraw = itemDraws.find(d => d.sx === capRect.x && d.sy === capRect.y)

    expect(quiDraw).toBeDefined()
    expect(quiDraw!.alpha).toBe(0.5)

    expect(bsdDraw).toBeDefined()
    expect(bsdDraw!.alpha).toBe(1)

    expect(capDraw).toBeDefined()
    expect(capDraw!.alpha).toBe(0.5)

    // Ensure globalAlpha is restored to 1 after drawing
    expect(ctx.globalAlpha).toBe(1)
  })

  it('renders non-ethereal socketed Gems/Runes at 100% opacity inside an ethereal host item per D2Client.dll 0x6FB4525F', () => {
    const rubyGem: UiInventoryItem = {
      id: 'sock-ruby',
      code: 'gsr',
      name: 'Ruby',
      nameZh: '红宝石',
      baseNameZh: '红宝石',
      quality: 'normal',
      invFile: 'invgsr',
      invWidth: 1,
      invHeight: 1,
      allowedSlots: [],
      stats: [],
      ethereal: false,
    }
    const ethArmorWithSocket = makeQuiltedArmorItem({
      id: 'eth-socketed-qui',
      ethereal: true,
      sockets: 2,
      usedSockets: 1,
      socketedItems: [rubyGem],
    })

    const inv = new InventoryPanel()
    inv.visible = true
    inv.gridItems = [{ item: ethArmorWithSocket, col: 0, row: 0 }]
    // Hover over the item so socket overlay is rendered
    inv.hoveredItem = { item: ethArmorWithSocket, x: 420, y: 320 }

    const itemsAtlasImg = createDummyAtlasImage('itemsAtlas')
    const gemSocketImg = createDummyAtlasImage('gemSocket')
    const { ctx, draws } = createRecordingCanvasContext()

    inv.draw(
      ctx,
      {
        borderRightImg: null,
        invSheetImg: null,
        invTab0Img: null,
        invTab1Img: null,
        buySellBtnImg: null,
        goldCoinBtnImg: null,
        itemsAtlasImg,
        gemSocketImg,
        itemRects: BAKED_UI_MANIFEST.itemRects,
      },
      createMockFont(),
    )

    const quiRect = resolveItemSpriteRect(ethArmorWithSocket, BAKED_UI_MANIFEST.itemRects)!
    const rubyRect = resolveItemSpriteRect(rubyGem, BAKED_UI_MANIFEST.itemRects)!

    const baseDraw = draws.find(d => d.img === itemsAtlasImg && d.sx === quiRect.x && d.sy === quiRect.y)
    const socketFrameDraws = draws.filter(d => d.img === gemSocketImg)
    const rubyDraw = draws.find(d => d.img === itemsAtlasImg && d.sx === rubyRect.x && d.sy === rubyRect.y)

    // Ethereal host armor sprite is 50% translucent
    expect(baseDraw).toBeDefined()
    expect(baseDraw!.alpha).toBe(0.5)

    // Gemsocket frames use DRAWMODE_TRANS25 (0.25 alpha) while non-ethereal socketed Ruby remains 100% opaque
    expect(socketFrameDraws).toHaveLength(2)
    for (const sd of socketFrameDraws) {
      expect(sd.alpha).toBe(0.25)
    }
    expect(rubyDraw).toBeDefined()
    expect(rubyDraw!.alpha).toBe(1)
  })

  it('renders ethereal items at 50% opacity in Stash, Horadric Cube, Vendor store, and Quest item slot', () => {
    const wp = new WorldPanelsHud()
    const ethArmor = makeQuiltedArmorItem({ id: 'stash-eth-qui', ethereal: true })
    const normalBelt: UiInventoryItem = {
      id: 'stash-norm-lbl',
      code: 'lbl',
      name: 'Sash',
      nameZh: '束带',
      baseNameZh: '束带',
      quality: 'normal',
      invFile: 'invlbl',
      invWidth: 2,
      invHeight: 1,
      allowedSlots: ['belt'],
      stats: [],
      ethereal: false,
    }

    const itemsAtlasImg = createDummyAtlasImage('itemsAtlas')
    const dummyImg = createDummyAtlasImage('panelBg')
    const dockAssets = makeDockPanelAssets(dummyImg, itemsAtlasImg)
    const quiRect = resolveItemSpriteRect(ethArmor, BAKED_UI_MANIFEST.itemRects)!
    const lblRect = resolveItemSpriteRect(normalBelt, BAKED_UI_MANIFEST.itemRects)!

    // 1. Stash
    wp.stashItems = [
      { item: ethArmor, col: 0, row: 0 },
      { item: normalBelt, col: 2, row: 0 },
    ]
    {
      const { ctx, draws } = createRecordingCanvasContext()
      wp.drawLeftDockPanel(ctx, 'stash', dockAssets, createMockFont())
      const quiDraw = draws.find(d => d.img === itemsAtlasImg && d.sx === quiRect.x && d.sy === quiRect.y)
      const lblDraw = draws.find(d => d.img === itemsAtlasImg && d.sx === lblRect.x && d.sy === lblRect.y)
      expect(quiDraw?.alpha).toBe(0.5)
      expect(lblDraw?.alpha).toBe(1)
    }

    // 2. Horadric Cube
    wp.cubeItems = [{ item: ethArmor, col: 0, row: 0 }]
    {
      const { ctx, draws } = createRecordingCanvasContext()
      wp.drawLeftDockPanel(ctx, 'cube', dockAssets, createMockFont())
      const quiDraw = draws.find(d => d.img === itemsAtlasImg && d.sx === quiRect.x && d.sy === quiRect.y)
      expect(quiDraw?.alpha).toBe(0.5)
    }

    // 3. Vendor Store Grid
    const charsi = getTownNpcDescriptorByHcIdx(154)!
    wp.setVendorShop({
      npcId: 101,
      descriptor: charsi,
      mode: 'trade',
      items: [
        { storePage: 1, placement: { item: ethArmor, col: 0, row: 0 } },
        { storePage: 1, placement: { item: normalBelt, col: 2, row: 0 } },
      ],
    })
    {
      const { ctx, draws } = createRecordingCanvasContext()
      wp.drawLeftDockPanel(ctx, 'vendor', dockAssets, createMockFont())
      const quiDraw = draws.find(d => d.img === itemsAtlasImg && d.sx === quiRect.x && d.sy === quiRect.y)
      const lblDraw = draws.find(d => d.img === itemsAtlasImg && d.sx === lblRect.x && d.sy === lblRect.y)
      expect(quiDraw?.alpha).toBe(0.5)
      expect(lblDraw?.alpha).toBe(1)
    }

    // 4. WorldPanels.drawItemSprite (used by Quest reward slots: Imbue / Add Sockets / Personalize)
    {
      const { ctx, draws } = createRecordingCanvasContext()
      wp.drawItemSprite(ctx, ethArmor, 100, 120, 88, 116, itemsAtlasImg)
      const quiDraw = draws.find(d => d.img === itemsAtlasImg && d.sx === quiRect.x && d.sy === quiRect.y)
      expect(quiDraw?.alpha).toBe(0.5)
    }
  })

  it('renders held ethereal cursorItem at 50% opacity via CursorController.render and HudManager.renderCursor', () => {
    const cursor = new CursorController(CURSOR_METADATA, 0)
    cursor.handleMouseMove(400, 300, 0)

    const itemsAtlasImg = createDummyAtlasImage('itemsAtlas')
    const cursorAtlasImg = createDummyAtlasImage('cursorAtlas')

    // Direct CursorController.render with ethereal: true vs false
    {
      const { ctx, draws } = createRecordingCanvasContext()
      cursor.render(ctx, cursorAtlasImg, 0, {
        atlas: itemsAtlasImg,
        rect: { x: 10, y: 20, w: 56, h: 84 },
        ethereal: true,
      })
      expect(draws).toHaveLength(1)
      expect(draws[0]!.alpha).toBe(0.5)
      expect(ctx.globalAlpha).toBe(1)
    }
    {
      const { ctx, draws } = createRecordingCanvasContext()
      cursor.render(ctx, cursorAtlasImg, 0, {
        atlas: itemsAtlasImg,
        rect: { x: 10, y: 20, w: 56, h: 84 },
        ethereal: false,
      })
      expect(draws).toHaveLength(1)
      expect(draws[0]!.alpha).toBe(1)
    }

    // HudManager.renderCursor integration with inventory.cursorItem
    const { ctx: hudCtx, draws: hudDraws } = createRecordingCanvasContext()
    const mockCanvas = {
      style: {} as CSSStyleDeclaration,
      width: 800,
      height: 600,
      getContext: vi.fn(() => hudCtx),
      addEventListener: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
    } as unknown as HTMLCanvasElement

    const hud = new HudManager(mockCanvas, {
      onToggleAutomap: vi.fn(),
    })
    ;(hud as any).images.set('itemsAtlas', itemsAtlasImg)
    ;(hud as any).images.set('cursorAtlas', cursorAtlasImg)

    hud.inventory.cursorItem = makeQuiltedArmorItem({ ethereal: true })
    hud.renderCursor(hudCtx, 0)

    expect(hudDraws).toHaveLength(1)
    expect(hudDraws[0]!.img).toBe(itemsAtlasImg)
    expect(hudDraws[0]!.alpha).toBe(0.5)
    expect(hudCtx.globalAlpha).toBe(1)
  })
})
