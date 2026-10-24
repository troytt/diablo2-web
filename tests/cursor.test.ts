/**
 * Unit & Parity Tests for Diablo II v1.13c Authentic Dynamic Cursor System (Issue #148).
 *
 * Verifies:
 * 1. Offline DC6 Cursor Extraction & Metadata Parity:
 *    - All 8 frames for protate.dc6, ohand.dc6, and orotate.dc6.
 *    - Zero runtime MPQ/DLL dependencies.
 * 2. 3-State Cursor State Machine Transitions:
 *    - Initial state is POINTING.
 *    - Inactivity >= 2000ms advances to OPENING (plays ohand 8 frames sequentially).
 *    - Completion of OPENING advances to OPEN_IDLE (loops orotate 8 frames).
 *    - Any mouse movement or mouse event (mousedown/mouseup) resets the timer and reverts to POINTING.
 * 3. Coordinates, Hotspot Alignment, and Rendering Bounds:
 *    - (mouseX, mouseY) tracking and bounds calculation.
 *    - Held items (cursorItem) rendered centered at cursor hotspot.
 * 4. Integration with HudManager & Canvas.
 */

import { describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CursorController,
  type CursorState,
  type CursorRenderInfo,
} from '../src/client/ui/cursor.ts'
import {
  BUYSELL_CURSOR_FRAMES,
  CURSOR_METADATA,
  type CursorAtlasMetadata,
  type CursorFrameMeta,
} from '../src/common/items/cursor-meta.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import { HudManager, type HudCommandSink } from '../src/client/ui/hud-manager.ts'
import { FrontendRenderer } from '../src/client/frontend/frontend-renderer.ts'
import { createInitialFlowState } from '../src/client/frontend/flow-state.ts'
import { openGeneratedVendorShop } from './helpers/vendor-shop-fixture.ts'
import { VENDOR_BUTTON_TABLE_X } from '../src/client/ui/world-panels.ts'
import { seedDemoHud } from './fixtures/hud-demo-state.ts'

describe('Diablo II v1.13c Dynamic Cursor System (Issue #148 & #491)', () => {
  describe('1. Asset Extraction & Atlas Metadata', () => {
    it('verifies public/ui/cursor.png exists and is non-empty', () => {
      const atlasPath = join(process.cwd(), 'public', 'ui', 'cursor.png')
      expect(existsSync(atlasPath)).toBe(true)
      const data = readFileSync(atlasPath)
      expect(data.length).toBeGreaterThan(0)
    })

    it('loads authentic D2 1.13c cursor atlas metadata with 34 total frames (24 hand + 10 buysell)', () => {
      expect(CURSOR_METADATA.atlasWidth).toBe(256)
      expect(CURSOR_METADATA.atlasHeight).toBe(176)
      expect(CURSOR_METADATA.frameWidth).toBe(32)
      expect(CURSOR_METADATA.frameHeight).toBe(32)
      expect(CURSOR_METADATA.buysellFrameHeight).toBe(40)

      // 8 frames per hand animation + 10 frames for buysell.dc6
      expect(CURSOR_METADATA.protate).toHaveLength(8)
      expect(CURSOR_METADATA.ohand).toHaveLength(8)
      expect(CURSOR_METADATA.orotate).toHaveLength(8)
      expect(CURSOR_METADATA.buysell).toHaveLength(10)

      // 34 frames indexed in frames map
      expect(Object.keys(CURSOR_METADATA.frames)).toHaveLength(34)

      // D2Client.dll 0x6fbbb238 (+0x10) & 0x6fb36fb7 buysell.dc6 frame mapping
      expect(BUYSELL_CURSOR_FRAMES).toEqual({
        identify: 0,
        repair: 1,
        buy: 3,
        sell: 4,
      })
    })

    it('verifies all frame coordinates are bounded inside the 256x176 atlas', () => {
      const allFrames = [
        ...CURSOR_METADATA.protate,
        ...CURSOR_METADATA.ohand,
        ...CURSOR_METADATA.orotate,
        ...CURSOR_METADATA.buysell,
      ]

      for (const frame of allFrames) {
        expect(frame.x).toBeGreaterThanOrEqual(0)
        expect(frame.y).toBeGreaterThanOrEqual(0)
        expect(frame.w).toBeGreaterThan(0)
        expect(frame.h).toBeGreaterThan(0)
        expect(frame.x + frame.w).toBeLessThanOrEqual(CURSOR_METADATA.atlasWidth)
        expect(frame.y + frame.h).toBeLessThanOrEqual(CURSOR_METADATA.atlasHeight)
      }
    })

    it('verifies DC6 offset parity and hotspot anchor definitions', () => {
      // protate: offsetX = -1, hotspot = (0, 0)
      for (const frame of CURSOR_METADATA.protate) {
        expect(frame.offsetX).toBe(-1)
        expect(frame.offsetY).toBe(24)
        expect(frame.hotspotX).toBe(0)
        expect(frame.hotspotY).toBe(0)
      }

      // ohand: frames 0..3 have offsetX = -1, frames 4..7 have offsetX = -2
      for (let i = 0; i < 4; i++) {
        expect(CURSOR_METADATA.ohand[i]!.offsetX).toBe(-1)
      }
      for (let i = 4; i < 8; i++) {
        expect(CURSOR_METADATA.ohand[i]!.offsetX).toBe(-2)
      }

      // orotate: all frames have offsetX = -2
      for (const frame of CURSOR_METADATA.orotate) {
        expect(frame.offsetX).toBe(-2)
        expect(frame.offsetY).toBe(24)
      }

      // buysell: 10 frames of 32x40, offset = (0, 0), hotspot = (0, 0)
      for (const frame of CURSOR_METADATA.buysell) {
        expect(frame.w).toBe(32)
        expect(frame.h).toBe(40)
        expect(frame.offsetX).toBe(0)
        expect(frame.offsetY).toBe(0)
        expect(frame.hotspotX).toBe(0)
        expect(frame.hotspotY).toBe(0)
      }
    })

    it('verifies baked UI manifest includes cursorAtlas entry', () => {
      expect(BAKED_UI_MANIFEST.images.cursorAtlas).toBe('/ui/cursor.png')
    })
  })

  describe('2. State Machine Logic & Idle Transitions', () => {
    it('starts in POINTING state initially and while actively moving', () => {
      const cursor = new CursorController(CURSOR_METADATA, 0)
      expect(cursor.state).toBe('POINTING')

      // Mouse movements keep resetting idle timer
      cursor.handleMouseMove(100, 100, 500)
      expect(cursor.state).toBe('POINTING')
      expect(cursor.lastActivityTime).toBe(500)

      cursor.handleMouseMove(150, 120, 1200)
      expect(cursor.state).toBe('POINTING')
      expect(cursor.lastActivityTime).toBe(1200)

      // Below 5000ms idle, remains POINTING
      expect(cursor.update(6199)).toBe('POINTING')
      expect(cursor.state).toBe('POINTING')
    })

    it('transitions to OPENING after 5000ms idle and plays 8 frames sequentially', () => {
      const cursor = new CursorController(CURSOR_METADATA, 1000)
      cursor.frameDurationMs = 125
      cursor.openingFrameDurationMs = 125

      // At exactly 5000ms idle (t = 6000ms)
      const stateAt5000 = cursor.update(6000)
      expect(stateAt5000).toBe('OPENING')
      expect(cursor.state).toBe('OPENING')

      // Check frame progression during OPENING (8 frames * 125ms = 1000ms total)
      // Frame 0 at t = 6000ms (0ms into opening)
      let info = cursor.getCurrentFrame(6000)
      expect(info.state).toBe('OPENING')
      expect(info.animation).toBe('ohand')
      expect(info.frameIndex).toBe(0)

      // Frame 1 at t = 6125ms (125ms into opening)
      info = cursor.getCurrentFrame(6125)
      expect(info.frameIndex).toBe(1)

      // Frame 4 at t = 6500ms (500ms into opening)
      info = cursor.getCurrentFrame(6500)
      expect(info.frameIndex).toBe(4)

      // Frame 7 at t = 6875ms (875ms into opening)
      info = cursor.getCurrentFrame(6875)
      expect(info.frameIndex).toBe(7)

      // Frame 7 clamped right before completion at t = 6999ms
      info = cursor.getCurrentFrame(6999)
      expect(info.state).toBe('OPENING')
      expect(info.frameIndex).toBe(7)
    })

    it('advances from OPENING to OPEN_IDLE after ohand completes and loops orotate', () => {
      const cursor = new CursorController(CURSOR_METADATA, 0)
      cursor.frameDurationMs = 125
      cursor.openingFrameDurationMs = 125

      // 5000ms idle + 1000ms opening = 6000ms total to reach OPEN_IDLE
      expect(cursor.update(5999)).toBe('OPENING')
      expect(cursor.update(6000)).toBe('OPEN_IDLE')
      expect(cursor.state).toBe('OPEN_IDLE')

      // Frame 0 of orotate at t = 6000ms
      let info = cursor.getCurrentFrame(6000)
      expect(info.state).toBe('OPEN_IDLE')
      expect(info.animation).toBe('orotate')
      expect(info.frameIndex).toBe(0)

      // Frame 1 of orotate at t = 6125ms
      info = cursor.getCurrentFrame(6125)
      expect(info.frameIndex).toBe(1)

      // Frame 7 of orotate at t = 6875ms
      info = cursor.getCurrentFrame(6875)
      expect(info.frameIndex).toBe(7)

      // Loops back to frame 0 at t = 7000ms (1000ms into open idle)
      info = cursor.getCurrentFrame(7000)
      expect(info.state).toBe('OPEN_IDLE')
      expect(info.frameIndex).toBe(0)

      // Loops to frame 3 at t = 7375ms
      info = cursor.getCurrentFrame(7375)
      expect(info.frameIndex).toBe(3)
    })

    it('transitions to RELEASE and rewinds ohand upon mouse movement when open', () => {
      const cursor = new CursorController(CURSOR_METADATA, 0)

      // Fast forward to OPEN_IDLE (t = 7000ms)
      cursor.update(7000)
      expect(cursor.state).toBe('OPEN_IDLE')

      // Mouse moves -> enters RELEASE state
      cursor.handleMouseMove(400, 300, 7001)
      expect(cursor.state).toBe('RELEASE')
      expect(cursor.mouseX).toBe(400)
      expect(cursor.mouseY).toBe(300)

      let info = cursor.getCurrentFrame(7001)
      expect(info.state).toBe('RELEASE')
      expect(info.animation).toBe('ohand')

      // Ticks decrement releaseCounter until back to POINTING
      while (cursor.state === 'RELEASE') {
        cursor.update(7002)
      }
      expect(cursor.state).toBe('POINTING')
      info = cursor.getCurrentFrame(7002)
      expect(info.state).toBe('POINTING')
      expect(info.animation).toBe('protate')
    })

    it('transitions to CLICK_DOWN on mousedown and reverts to POINTING on mouseup', () => {
      const cursor = new CursorController(CURSOR_METADATA, 0)

      // In POINTING state
      cursor.handleMouseDown(500)
      expect(cursor.state).toBe('CLICK_DOWN')
      let info = cursor.getCurrentFrame(500)
      expect(info.state).toBe('CLICK_DOWN')
      expect(info.animation).toBe('protate')
      expect(info.frameIndex).toBe(0)

      // Mouseup reverts to POINTING
      cursor.handleMouseUp(600)
      expect(cursor.state).toBe('POINTING')
    })

    it('switches to buysell.dc6 frame (buy=3, sell=4, repair=1, identify=0) and suppresses idle transitions per D2CLIENT_UpdateCursorIdle (0x6fac62f0)', () => {
      const cursor = new CursorController(CURSOR_METADATA, 0)
      cursor.handleMouseMove(250, 180, 0)

      // Buy cursor -> buysell frame 3 (32x40)
      cursor.setTradeCursorMode('buy', 100)
      expect(cursor.tradeCursorMode).toBe('buy')
      let info = cursor.getCurrentFrame(100)
      expect(info.animation).toBe('buysell')
      expect(info.frameIndex).toBe(3)
      expect(info.frame).toBe(CURSOR_METADATA.buysell[3])
      expect(info.bounds).toEqual({ x: 250, y: 180, width: 32, height: 40 })

      // Even after 5000ms idle, trade cursor mode suppresses OPENING/OPEN_IDLE
      expect(cursor.update(6000)).toBe('POINTING')
      info = cursor.getCurrentFrame(6000)
      expect(info.animation).toBe('buysell')
      expect(info.frameIndex).toBe(3)

      // Sell cursor -> buysell frame 4
      cursor.setTradeCursorMode('sell', 6100)
      info = cursor.getCurrentFrame(6100)
      expect(info.animation).toBe('buysell')
      expect(info.frameIndex).toBe(4)
      expect(info.frame).toBe(CURSOR_METADATA.buysell[4])

      // Repair cursor -> buysell frame 1
      cursor.setTradeCursorMode('repair', 6200)
      info = cursor.getCurrentFrame(6200)
      expect(info.animation).toBe('buysell')
      expect(info.frameIndex).toBe(1)
      expect(info.frame).toBe(CURSOR_METADATA.buysell[1])

      // Identify cursor -> buysell frame 0
      cursor.setTradeCursorMode('identify', 6300)
      info = cursor.getCurrentFrame(6300)
      expect(info.animation).toBe('buysell')
      expect(info.frameIndex).toBe(0)
      expect(info.frame).toBe(CURSOR_METADATA.buysell[0])

      // Clearing tradeCursorMode restores standard hand cursor (protate)
      cursor.setTradeCursorMode(null, 6000)
      info = cursor.getCurrentFrame(6000)
      expect(info.state).toBe('POINTING')
      expect(info.animation).toBe('protate')
      expect(info.frameIndex).toBe(0)
    })
  })

  describe('3. Coordinates, Hotspot & Rendering Bounds', () => {
    it('accurately aligns draw coordinates with mouse position and frame hotspots', () => {
      const cursor = new CursorController(CURSOR_METADATA, 0)
      cursor.handleMouseMove(320, 240, 0)

      const info = cursor.getCurrentFrame(0)
      expect(info.drawX).toBe(320)
      expect(info.drawY).toBe(240)
      expect(info.bounds).toEqual({
        x: 320,
        y: 240,
        width: info.frame.w,
        height: info.frame.h,
      })

      const bounds = cursor.getRenderBounds(0)
      expect(bounds).toEqual(info.bounds)
    })

    it('renders 1.13c DC6 hand cursor frames onto Canvas 2D context (explicit 113c)', () => {
      const cursor = new CursorController(CURSOR_METADATA, 0, '113c')
      cursor.handleMouseMove(100, 200, 0)

      const mockCtx = {
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D

      const mockAtlas = {} as CanvasImageSource

      cursor.render(mockCtx, mockAtlas, 0)

      expect(mockCtx.drawImage).toHaveBeenCalledTimes(1)
      const frame0 = CURSOR_METADATA.protate[0]!
      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        mockAtlas,
        frame0.x,
        frame0.y,
        frame0.w,
        frame0.h,
        100,
        200,
        frame0.w,
        frame0.h,
      )
    })

    it('renders held item centered at cursor hotspot when cursorItem is present', () => {
      const cursor = new CursorController(CURSOR_METADATA, 0)
      cursor.handleMouseMove(400, 300, 0)

      const mockCtx = {
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D

      const mockItemsAtlas = {} as CanvasImageSource
      const mockCursorAtlas = {} as CanvasImageSource

      // Held 2x3 broad sword (width 28, height 84)
      cursor.render(mockCtx, mockCursorAtlas, 0, {
        atlas: mockItemsAtlas,
        rect: { x: 50, y: 100, w: 28, h: 84 },
      })

      // Held item should be drawn centered at mouseX=400, mouseY=300
      expect(mockCtx.drawImage).toHaveBeenCalledTimes(1)
      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        mockItemsAtlas,
        50,
        100,
        28,
        84,
        400 - 14, // 386
        300 - 42, // 258
        28,
        84,
      )
    })
  })

  describe('4. HudManager Integration & Vendor Buy/Sell/Repair Cursor Switching (Issue #491)', () => {
    function createTestHud() {
      const mockCanvas = {
        style: {} as CSSStyleDeclaration,
        width: 800,
        height: 600,
        getContext: vi.fn(() => ({
          save: vi.fn(),
          restore: vi.fn(),
          clearRect: vi.fn(),
          translate: vi.fn(),
          scale: vi.fn(),
          drawImage: vi.fn(),
        })),
        addEventListener: vi.fn(),
        getBoundingClientRect: vi.fn(() => ({
          left: 0,
          top: 0,
          width: 800,
          height: 600,
        })),
      } as unknown as HTMLCanvasElement

      const hud = new HudManager(mockCanvas, {
        onToggleAutomap: vi.fn(),
        onWaypointTeleport: vi.fn(),
      })

      const clickAt = (clientX: number, clientY: number, button = 0) => {
        hud.handleHudMouseDown({
          clientX,
          clientY,
          button,
          shiftKey: false,
          stopPropagation: vi.fn(),
          preventDefault: vi.fn(),
        } as unknown as MouseEvent)
        hud.worldPanels.releaseMomentaryVendorButton()
      }

      return { hud, mockCanvas, clickAt }
    }

    it('initializes HudManager with cursor: none and tracks cursor state in published state', () => {
      const { hud, mockCanvas } = createTestHud()

      // Canvas cursor style hidden
      expect(mockCanvas.style.cursor).toBe('none')

      // Initial cursor state
      expect(hud.cursor).toBeInstanceOf(CursorController)
      expect(hud.cursor.state).toBe('POINTING')
      expect(hud.state.cursorState).toBe('POINTING')
      expect(hud.state.cursorAnimation).toBe('protate')
      expect(hud.state.cursorFrameIndex).toBe(0)

      // Moving mouse updates hud.cursor position and stays POINTING
      hud.cursor.handleMouseMove(200, 150, 100)
      hud.syncPublishedState()
      expect(hud.cursor.mouseX).toBe(200)
      expect(hud.cursor.mouseY).toBe(150)
      expect(hud.state.cursorState).toBe('POINTING')

      // Advancing past 5000ms idle updates hud.cursor and published state to OPENING
      hud.cursor.update(5200)
      hud.syncPublishedState()
      expect(hud.cursor.state).toBe('OPENING')
      expect(hud.state.cursorState).toBe('OPENING')

      // Advancing past opening duration updates to OPEN_IDLE
      hud.cursor.update(6500)
      hud.syncPublishedState()
      expect(hud.cursor.state).toBe('OPEN_IDLE')
      expect(hud.state.cursorState).toBe('OPEN_IDLE')
    })

    it('switches cursor to buysell.dc6 frame 3 (Buy), frame 4 (Sell), and frame 1 (Repair) when clicking vendor buttons, and resets on toggle/right-click/close', () => {
      const { hud, clickAt } = createTestHud()

      // Explicitly seed the legacy demo Sorceress state (class, level, gold, inventory)
      seedDemoHud(hud)
      const closeNpc = vi.fn()
      hud.commandSink = { closeNpc } as unknown as HudCommandSink

      // Server opened Charsi's store (0x9C AddToShop items + NpcOpenTrade): HudModel fills and shows it
      openGeneratedVendorShop(hud.worldPanels, 'Charsi', 'trade', 24, 0, 7)
      hud.showVendorPanel()
      expect(hud.state.leftPanel).toBe('vendor')
      expect(hud.state.vendorTradeState).toBe('idle')
      expect(hud.state.cursorTradeMode).toBeNull()
      expect(hud.state.cursorAnimation).toBe('protate')

      // 1. Click Buy button (slot 0) -> switches cursor to buysell.dc6 frame 3
      clickAt(80 + VENDOR_BUTTON_TABLE_X[0] + 20, 60 + 390, 0)
      expect(hud.state.vendorTradeState).toBe('buy')
      expect(hud.state.cursorTradeMode).toBe('buy')
      expect(hud.state.cursorAnimation).toBe('buysell')
      expect(hud.state.cursorFrameIndex).toBe(3)

      // 2. Click Sell button (slot 1) -> switches cursor to buysell.dc6 frame 4
      clickAt(80 + VENDOR_BUTTON_TABLE_X[1] + 20, 60 + 390, 0)
      expect(hud.state.vendorTradeState).toBe('sell')
      expect(hud.state.cursorTradeMode).toBe('sell')
      expect(hud.state.cursorAnimation).toBe('buysell')
      expect(hud.state.cursorFrameIndex).toBe(4)

      // 3. Click Repair button (slot 2 on Charsi) -> switches cursor to buysell.dc6 frame 1
      clickAt(80 + VENDOR_BUTTON_TABLE_X[2] + 20, 60 + 390, 0)
      expect(hud.state.vendorTradeState).toBe('repair')
      expect(hud.state.cursorTradeMode).toBe('repair')
      expect(hud.state.cursorAnimation).toBe('buysell')
      expect(hud.state.cursorFrameIndex).toBe(1)

      // 4. Clicking the active Repair button again toggles back to idle and restores protate
      clickAt(80 + VENDOR_BUTTON_TABLE_X[2] + 20, 60 + 390, 0)
      expect(hud.state.vendorTradeState).toBe('idle')
      expect(hud.state.cursorTradeMode).toBeNull()
      expect(hud.state.cursorAnimation).toBe('protate')

      // 5. Activate Buy mode again, then right-click inside vendor panel -> cancels back to idle cursor
      clickAt(80 + VENDOR_BUTTON_TABLE_X[0] + 20, 60 + 390, 0)
      expect(hud.state.cursorTradeMode).toBe('buy')
      clickAt(80 + 150, 60 + 200, 2)
      expect(hud.state.vendorTradeState).toBe('idle')
      expect(hud.state.cursorTradeMode).toBeNull()
      expect(hud.state.cursorAnimation).toBe('protate')

      // 6. Activate Sell mode, then close panels -> cancels back to idle cursor
      clickAt(80 + VENDOR_BUTTON_TABLE_X[1] + 20, 60 + 390, 0)
      expect(hud.state.cursorTradeMode).toBe('sell')
      hud.closeAllPanels()
      expect(hud.state.leftPanel).toBe('none')
      expect(closeNpc).toHaveBeenCalledWith(7)
      expect(hud.state.cursorTradeMode).toBeNull()
      expect(hud.state.cursorAnimation).toBe('protate')
    })

    it('hides the native OS triangle cursor across #play-stage, #view, #bnet-canvas, and #d2-hud-canvas per D2gfx.dll #10029 (0x6fa88290) (Issue #718)', () => {
      // 1. FrontendRenderer hides native OS cursor on #bnet-canvas (D2Win.dll 0x6f8f7800 -> D2gfx.#10029)
      const bnetCanvas = {
        width: 800,
        height: 600,
        style: { cursor: 'default' },
        getContext: () => ({ imageSmoothingEnabled: true }),
      } as unknown as HTMLCanvasElement
      const fe = new FrontendRenderer(bnetCanvas, createInitialFlowState())
      expect(fe.canvas.style.cursor).toBe('none')

      // 2. HudManager hides native OS cursor on #d2-hud-canvas (D2Client.dll 0x6fac63d0 -> D2gfx.#10029)
      const { mockCanvas: hudCanvas } = createTestHud()
      expect(hudCanvas.style.cursor).toBe('none')

      // 3. play.html enforces cursor: none on #play-stage and all child canvases (#bnet-shell, #bnet-canvas, #view, #d2-hud-canvas)
      //    so pointer-events: none on #d2-hud-canvas over the game world never exposes the OS cursor on #view
      const playHtml = readFileSync(join(process.cwd(), 'play.html'), 'utf8')
      expect(playHtml).toMatch(/#play-stage\s*\{[^}]*cursor:\s*none;/s)
      expect(playHtml).toMatch(/#play-stage,\s*#play-stage\s*\*\s*\{[^}]*cursor:\s*none\s*!important;/s)
      expect(playHtml).toMatch(/#bnet-shell\s*\{[^}]*cursor:\s*none;/s)
      expect(playHtml).toMatch(/#bnet-canvas\s*\{[^}]*cursor:\s*none;/s)
      expect(playHtml).toMatch(/#view\s*\{[^}]*cursor:\s*none;/s)
      expect(playHtml).toMatch(/#d2-hud-canvas\s*\{[^}]*cursor:\s*none;/s)
    })
  })
})


