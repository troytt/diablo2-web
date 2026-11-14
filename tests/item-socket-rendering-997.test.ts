import { describe, expect, it } from 'vitest'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import type { D2FontRenderer } from '../src/client/ui/font.ts'
import {
  D2_SOCKET_COORD_TABLE_113C,
  EQUIP_SLOTS_LAYOUT,
  GEMSOCKET_ALPHA,
  INV_GRID_ORIGIN,
  InventoryPanel,
  computeItemSocketPositions113c,
  drawItemSocketOverlay,
  resolveItemSpriteRect,
  type UiInventoryItem,
} from '../src/client/ui/inventory.ts'

interface RecordedDraw {
  img: unknown
  sx: number
  sy: number
  sw: number
  sh: number
  dx: number
  dy: number
  dw: number
  dh: number
  alpha: number
}

function createRecordingCanvasContext(): {
  ctx: CanvasRenderingContext2D
  draws: RecordedDraw[]
} {
  const draws: RecordedDraw[] = []
  let currentAlpha = 1
  const stack: number[] = []
  const ctx = {
    get globalAlpha() {
      return currentAlpha
    },
    set globalAlpha(val: number) {
      currentAlpha = val
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    save() {
      stack.push(currentAlpha)
    },
    restore() {
      currentAlpha = stack.pop() ?? 1
    },
    fillRect() {},
    strokeRect() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    drawImage(
      img: unknown,
      a: number,
      b: number,
      c?: number,
      d?: number,
      e?: number,
      f?: number,
      g?: number,
      h?: number,
    ) {
      if (e !== undefined && f !== undefined && g !== undefined && h !== undefined) {
        draws.push({
          img,
          sx: a,
          sy: b,
          sw: c!,
          sh: d!,
          dx: e,
          dy: f,
          dw: g,
          dh: h,
          alpha: currentAlpha,
        })
      } else {
        draws.push({
          img,
          sx: 0,
          sy: 0,
          sw: c ?? 28,
          sh: d ?? 28,
          dx: a,
          dy: b,
          dw: c ?? 28,
          dh: d ?? 28,
          alpha: currentAlpha,
        })
      }
    },
  } as unknown as CanvasRenderingContext2D
  return { ctx, draws }
}

function createDummyImage(tag: string, width = 2048, height = 2048): HTMLImageElement {
  return {
    tag,
    complete: true,
    naturalWidth: width,
    naturalHeight: height,
    width,
    height,
  } as unknown as HTMLImageElement
}

function createMockFont(): D2FontRenderer {
  return {
    measureText: (text: string) => text.length * 7,
    drawText: () => {},
  } as unknown as D2FontRenderer
}

function makeSocketedClub(
  id = 'club-2os',
  sockets = 2,
  socketedItems: readonly UiInventoryItem[] = [],
): UiInventoryItem {
  return {
    id,
    code: 'clb',
    name: 'Club',
    nameZh: '木棒',
    baseNameZh: '木棒',
    quality: 'normal',
    invFile: 'invclb',
    invWidth: 1,
    invHeight: 2,
    allowedSlots: ['weapon1', 'weapon2'],
    stats: [],
    sockets,
    socketedItems,
  }
}

describe('Diablo II v1.13c Item Socket Rendering (D2Client.dll 0x6FB45140 — Issue #997)', () => {
  it('packs gemsocket.dc6 (28x28) into baked UI manifest and items-atlas.png away from inv2ax (0,0)', () => {
    expect(BAKED_UI_MANIFEST.images.gemSocket).toBe('/ui/gemsocket.png')
    const gemSocketRect = BAKED_UI_MANIFEST.itemRects['gemsocket']
    expect(gemSocketRect).toBeDefined()
    expect(gemSocketRect!.w).toBe(28)
    expect(gemSocketRect!.h).toBe(28)
    // Must never collide with inv2ax at (0, 0)
    expect(gemSocketRect!.x > 0 || gemSocketRect!.y > 0).toBe(true)
  })

  it('matches D2Client.dll 0x6FB80A98 48-entry socket coordinate table and formula (0x6FB45196..0x6FB4525F)', () => {
    expect(D2_SOCKET_COORD_TABLE_113C).toHaveLength(48)

    // 1x2 Club with 2 sockets in weapon1 paperdoll slot (rArmWidth=55, rArmHeight=112 in Inventory.txt):
    // tableIdx = 2 + 4 * (1 + 2 * 2) - 13 = 9 -> [[1, 1], [1, 3]]
    const slotW1 = EQUIP_SLOTS_LAYOUT.weapon1
    const clubPositions = computeItemSocketPositions113c(2, 1, 2, slotW1.x, slotW1.y, slotW1.w, slotW1.h)
    expect(clubPositions).toHaveLength(2)

    const expectedItemX = slotW1.x + Math.trunc((slotW1.w - 29) / 2)
    const expectedItemY = slotW1.y + Math.trunc((slotW1.h - 58) / 2)
    // Socket 0: gx=1, gy=1 -> xLeft = itemX + 0, yBottom = itemY + 29
    expect(clubPositions[0]).toEqual({
      gx: 1,
      gy: 1,
      xLeft: expectedItemX,
      yBottom: expectedItemY + 29,
      socketFrameX: expectedItemX - 1,
      socketFrameY: expectedItemY + 1,
      childItemX: expectedItemX,
      childItemY: expectedItemY,
    })
    // Socket 1: gx=1, gy=3 -> xLeft = itemX + 0, yBottom = itemY + 58
    expect(clubPositions[1]).toEqual({
      gx: 1,
      gy: 3,
      xLeft: expectedItemX,
      yBottom: expectedItemY + 58,
      socketFrameX: expectedItemX - 1,
      socketFrameY: expectedItemY + 30,
      childItemX: expectedItemX,
      childItemY: expectedItemY + 29,
    })

    // 2x2 Helm with 3 sockets (triangle layout in 1.13c: tableIdx = 2 + 4*(2 + 6) - 13 = 21 -> [[1, 1], [3, 1], [2, 3]])
    const helm3Positions = computeItemSocketPositions113c(3, 2, 2, 100, 200, 58, 58)
    expect(helm3Positions).toHaveLength(3)
    expect(helm3Positions[0]!.childItemX).toBe(100)
    expect(helm3Positions[0]!.childItemY).toBe(200)
    expect(helm3Positions[1]!.childItemX).toBe(129)
    expect(helm3Positions[1]!.childItemY).toBe(200)
    expect(helm3Positions[2]!.childItemX).toBe(114)
    expect(helm3Positions[2]!.childItemY).toBe(229)

    // 2x3 Armor with 3 sockets (vertical centered column in 1.13c: tableIdx = 3 + 4*(2 + 6) - 13 = 22 -> [[2, 1], [2, 3], [2, 5]])
    const armor3Positions = computeItemSocketPositions113c(3, 2, 3, 100, 200, 58, 87)
    expect(armor3Positions).toHaveLength(3)
    expect(armor3Positions[0]!.childItemX).toBe(114)
    expect(armor3Positions[0]!.childItemY).toBe(200)
    expect(armor3Positions[1]!.childItemX).toBe(114)
    expect(armor3Positions[1]!.childItemY).toBe(229)
    expect(armor3Positions[2]!.childItemX).toBe(114)
    expect(armor3Positions[2]!.childItemY).toBe(258)
  })

  it('draws gemsocket.dc6 at DRAWMODE_TRANS25 (0.25 alpha) and socketed child items at DRAWMODE_NORMAL (1.0 alpha)', () => {
    expect(GEMSOCKET_ALPHA).toBe(0.25)

    const rubyGem: UiInventoryItem = {
      id: 'gem-gcr',
      code: 'gcr',
      name: 'Chipped Ruby',
      nameZh: '碎裂的红宝石',
      baseNameZh: '碎裂的红宝石',
      quality: 'normal',
      invFile: 'invgcr',
      invWidth: 1,
      invHeight: 1,
      allowedSlots: [],
      stats: [],
    }
    const club = makeSocketedClub('club-with-ruby', 2, [rubyGem])

    const itemsAtlasImg = createDummyImage('itemsAtlas')
    const gemSocketImg = createDummyImage('gemSocket', 28, 28)
    const { ctx, draws } = createRecordingCanvasContext()

    drawItemSocketOverlay(
      ctx,
      club,
      400,
      300,
      29,
      58,
      {
        itemsAtlasImg,
        gemSocketImg,
        itemRects: BAKED_UI_MANIFEST.itemRects,
      },
      { isHovered: true },
    )

    const socketDraws = draws.filter(d => d.img === gemSocketImg)
    const rubyRect = resolveItemSpriteRect(rubyGem, BAKED_UI_MANIFEST.itemRects)!
    const rubyDraws = draws.filter(d => d.img === itemsAtlasImg && d.sx === rubyRect.x && d.sy === rubyRect.y)

    expect(socketDraws).toHaveLength(2)
    expect(socketDraws[0]!.alpha).toBe(0.25)
    expect(socketDraws[0]!.dx).toBe(399)
    expect(socketDraws[0]!.dy).toBe(301)
    expect(socketDraws[1]!.alpha).toBe(0.25)
    expect(socketDraws[1]!.dx).toBe(399)
    expect(socketDraws[1]!.dy).toBe(330)

    expect(rubyDraws).toHaveLength(1)
    expect(rubyDraws[0]!.alpha).toBe(1)
    expect(rubyDraws[0]!.dx).toBe(400)
    expect(rubyDraws[0]!.dy).toBe(300)
  })

  it('draws nothing when isHovered is false (D2Client.dll 0x6FB4574F hover gate) and fails fast when gemsocket rect is missing', () => {
    const club = makeSocketedClub('club-unhovered', 2)
    const itemsAtlasImg = createDummyImage('itemsAtlas')
    const gemSocketImg = createDummyImage('gemSocket', 28, 28)
    const { ctx, draws } = createRecordingCanvasContext()

    drawItemSocketOverlay(ctx, club, 400, 300, 29, 58, {
      itemsAtlasImg,
      gemSocketImg,
      itemRects: BAKED_UI_MANIFEST.itemRects,
      isHovered: false,
    })
    expect(draws).toHaveLength(0)

    // Anti-Silent Failures: if gemSocketImg is not passed and itemRects lacks 'gemsocket', throw instead of drawing (0,0) inv2ax
    expect(() =>
      drawItemSocketOverlay(ctx, club, 400, 300, 29, 58, {
        itemsAtlasImg,
        gemSocketImg: null,
        itemRects: {},
        isHovered: true,
      }),
    ).toThrow(/gemsocket/)
  })

  it('InventoryPanel.draw only renders sockets on the hovered item or hovered equipment slot', () => {
    const inv = new InventoryPanel()
    inv.visible = true
    const equippedClub = makeSocketedClub('eq-club', 2)
    const bagClub = makeSocketedClub('bag-club', 2)
    inv.equipped.weapon1 = equippedClub
    inv.gridItems = [{ item: bagClub, col: 0, row: 0 }]

    const itemsAtlasImg = createDummyImage('itemsAtlas')
    const gemSocketImg = createDummyImage('gemSocket', 28, 28)
    const assets = {
      borderRightImg: null,
      invSheetImg: null,
      invTab0Img: null,
      invTab1Img: null,
      buySellBtnImg: null,
      goldCoinBtnImg: null,
      itemsAtlasImg,
      gemSocketImg,
      itemRects: BAKED_UI_MANIFEST.itemRects,
    }

    // 1. Nothing hovered -> 0 socket draws
    {
      const { ctx, draws } = createRecordingCanvasContext()
      inv.draw(ctx, assets, createMockFont())
      expect(draws.filter(d => d.img === gemSocketImg)).toHaveLength(0)
    }

    // 2. Hover weapon1 paperdoll slot -> 2 socket draws on weapon1 only
    {
      inv.handleMouseMove(EQUIP_SLOTS_LAYOUT.weapon1.x + 10, EQUIP_SLOTS_LAYOUT.weapon1.y + 10)
      const { ctx, draws } = createRecordingCanvasContext()
      inv.draw(ctx, assets, createMockFont())
      const socketDraws = draws.filter(d => d.img === gemSocketImg)
      expect(socketDraws).toHaveLength(2)
      expect(socketDraws[0]!.alpha).toBe(0.25)
    }

    // 3. Hover bag item at (0, 0) -> 2 socket draws on bag item only
    {
      inv.handleMouseMove(INV_GRID_ORIGIN.x + 10, INV_GRID_ORIGIN.y + 10)
      const { ctx, draws } = createRecordingCanvasContext()
      inv.draw(ctx, assets, createMockFont())
      const socketDraws = draws.filter(d => d.img === gemSocketImg)
      expect(socketDraws).toHaveLength(2)
      expect(socketDraws[0]!.dx).toBe(INV_GRID_ORIGIN.x - 1)
      expect(socketDraws[0]!.dy).toBe(INV_GRID_ORIGIN.y + 1)
    }
  })
})
