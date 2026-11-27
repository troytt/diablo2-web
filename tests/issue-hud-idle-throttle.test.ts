/**
 * HUD 2D layer idle throttle: while the mouse rests, the HUD repaints at most
 * every 40ms (25fps — the server logic rate; orbs/belt are event-driven), and
 * immediately whenever the cursor moves (the software cursor is drawn on this
 * canvas). Previously it repainted on every rAF (measured 60.5 clears +
 * ~2965 drawImage/s standing still).
 */
import { describe, expect, it, vi } from 'vitest'
import { HudManager, shouldRenderHudFrame } from '../src/client/ui/hud-manager.ts'
import { hudRepaintUnchanged } from '../src/client/ui/hud-world-overlays.ts'
import { InventoryPanel, hasAnyOwnKey } from '../src/client/ui/inventory.ts'
import { Minimap, type MinimapLevel } from '../src/client/ui/minimap.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import type { D2FontRenderer } from '../src/client/ui/font.ts'
import type { AtlasHandle, SpriteRenderer } from '../src/client/render/renderer.ts'

describe('[hud idle throttle] shouldRenderHudFrame', () => {
  it('1. first frame always renders', () => {
    expect(shouldRenderHudFrame(null, 400, 300, 1000)).toBe(true)
  })

  it('2. mouse movement renders immediately (cursor smoothness)', () => {
    const prev = { mouseX: 400, mouseY: 300, drawMs: 1000 }
    expect(shouldRenderHudFrame(prev, 401, 300, 1005)).toBe(true)
    expect(shouldRenderHudFrame(prev, 400, 301, 1005)).toBe(true)
  })

  it('3. idle frame inside the 40ms window is skipped, at/after it renders', () => {
    const prev = { mouseX: 400, mouseY: 300, drawMs: 1000 }
    expect(shouldRenderHudFrame(prev, 400, 300, 1039)).toBe(false)
    expect(shouldRenderHudFrame(prev, 400, 300, 1040)).toBe(true)
  })

  it('4. InventoryPanel.draw resolves itemRects in O(1) without calling Object.keys per item (#1704)', () => {
    expect(hasAnyOwnKey({})).toBe(false)
    expect(hasAnyOwnKey(BAKED_UI_MANIFEST.itemRects)).toBe(true)

    const inv = new InventoryPanel()
    inv.visible = true
    inv.equipped.helm = {
      id: 'helm-1',
      code: 'cap',
      invFile: 'invcap',
      name: 'Cap',
      nameZh: '帽子',
      baseNameZh: '帽子',
      quality: 'normal',
      invWidth: 2,
      invHeight: 2,
      allowedSlots: ['helm'],
      stats: [],
    }
    for (let col = 0; col < 10; col += 1) {
      inv.gridItems.push({
        col,
        row: 0,
        item: {
          id: `cm1-${col}`,
          code: 'cm1',
          invFile: 'invch1',
          name: 'Small Charm',
          nameZh: '小護身符',
          baseNameZh: '小護身符',
          quality: 'magic',
          invWidth: 1,
          invHeight: 1,
          allowedSlots: [],
          stats: [],
        },
      })
    }

    const noop = () => {}
    const ctx = {
      drawImage: noop,
      fillRect: noop,
      strokeRect: noop,
      save: noop,
      restore: noop,
    } as unknown as CanvasRenderingContext2D
    const font = {
      drawText: noop,
      measureText: () => 24,
    } as unknown as D2FontRenderer

    const spy = vi.spyOn(Object, 'keys')
    try {
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
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('5. hudRepaintUnchanged skips redundant repaints while Inventory panel is open and invalidates on hover change (#1704)', () => {
    const hudCanvas = { width: 800, height: 600, clientWidth: 800, clientHeight: 600, style: {} } as HTMLCanvasElement
    const cursorCanvas = { width: 800, height: 600, clientWidth: 800, clientHeight: 600, style: {} } as HTMLCanvasElement
    const hud = new HudManager(hudCanvas, {}, cursorCanvas)
    hud.currentClass = 'sor'
    hud.syncPlayerContext()
    hud.rightPanel = 'inv'
    hud.inventory.visible = true
    ;(hud as unknown as { lastFullHudRepaintMs: number }).lastFullHudRepaintMs = 1000

    // First call seeds lastIdleRepaintSignature
    hudRepaintUnchanged(hud, 1010)
    // Subsequent syncPlayerContext + hudRepaintUnchanged with identical state skips repaint even with rightPanel === 'inv'
    hud.syncPlayerContext()
    expect(hudRepaintUnchanged(hud, 1020)).toBe(true)

    // Moving the mouse across the world (with dedicated cursorCanvas) does not invalidate HUD canvas
    hud.mouseX = 220
    hud.mouseY = 240
    expect(hudRepaintUnchanged(hud, 1030)).toBe(true)

    // Hovering an inventory item invalidates the signature immediately
    hud.inventory.hoveredItem = {
      item: {
        id: 'ring-1',
        code: 'rin',
        invFile: 'invrin',
        name: 'Ring',
        nameZh: '戒指',
        baseNameZh: '戒指',
        quality: 'rare',
        invWidth: 1,
        invHeight: 1,
        allowedSlots: [],
        stats: [],
      },
      x: 500,
      y: 320,
    }
    expect(hudRepaintUnchanged(hud, 1040)).toBe(false)
    expect(hudRepaintUnchanged(hud, 1050)).toBe(true)
  })

  it('6. Minimap.draw caches waypoint cells and cellX/cellY in spatial index (#1704)', () => {
    const minimap = new Minimap()
    for (const key of ['MaxiMap', 'MaxiMapS', 'Act2Map', 'Act2MapS', 'Act4Map', 'Act4MapS', 'ExTnMap', 'ExTnMapS'] as const) {
      const meta = minimap.getSheetMeta(key)
      minimap.setAtlasHandle(key, {
        texture: key as unknown as WebGLTexture,
        width: meta.atlasWidth,
        height: meta.atlasHeight,
      } as AtlasHandle)
    }

    const floors: { cellNo: number; xPixel: number; yPixel: number; cellX?: number; cellY?: number }[] = Array.from(
      { length: 300 },
      (_, i) => ({
        cellNo: i === 15 ? 307 : 1,
        xPixel: (i % 20) * 8,
        yPixel: Math.floor(i / 20) * 4,
      }),
    )
    const level: MinimapLevel = {
      key: 'test-lvl-1704',
      cellsX: 40,
      cellsY: 40,
      blocked: new Uint8Array(40 * 5 * 40 * 5),
      gridWidth: 200,
      markers: [],
      preRevealTown: true,
      automap: {
        layerId: 1,
        levelTypeId: 1,
        floors: floors as unknown as MinimapLevel['automap'] extends { readonly floors: infer F } ? F : never,
        walls: [],
        objects: [],
        extras: [],
      },
    }
    const renderer = {
      gl: null,
      flush() {},
      draw() {},
      drawSolid() {},
      drawSolidQuad() {},
    } as unknown as SpriteRenderer

    minimap.draw(renderer, level, 10, 10, { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 }, { highlightWaypoints: true })
    expect(minimap.lastRenderStats.spritesDrawn.waypoints).toBe(1)
    expect(typeof floors[15]!.cellX).toBe('number')
    expect(typeof floors[15]!.cellY).toBe('number')
  })
})
