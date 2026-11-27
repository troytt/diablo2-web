/**
 * tests/world-panels.test.ts
 *
 * Unit tests for Diablo II 1.13c Waypoint and World Panels UI Parity (Issue #378).
 */

import { describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  WorldPanelsHud,
  ACT_WAYPOINTS,
  CUBE_TRANSMUTE_BTN_BOUNDS,
  CUBE_CLOSE_BTN_BOUNDS,
  VENDOR_GOLD_BOX_RECESS,
  VENDOR_STATUS_TEXT_POS,
} from '../src/client/ui/world-panels.ts'
import { getTownNpcDescriptorByHcIdx } from '../src/common/units/npc-table.ts'
import { createDemoWorldPanels } from './fixtures/hud-demo-state.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import { D2FontRenderer } from '../src/client/ui/font.ts'
import { encodeIndexedPng } from '../src/baker/io/png.ts'
import { decodeDc6 } from '../src/common/formats/dc6.ts'
import { decodePl2 } from '../src/common/formats/pl2.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'

function getPngDimensions(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath)
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error('Not a PNG file')
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  return { width, height }
}

describe('Issue #378: Diablo II 1.13c Waypoint Panel Tabs & Icons', () => {
  it('verifies waypoint-tabs.png, waypoint-icons.png, and quest-tabs.png asset dimensions', () => {
    const waypointTabsPath = join(process.cwd(), 'public/ui/waypoint-tabs.png')
    const waypointIconsPath = join(process.cwd(), 'public/ui/waypoint-icons.png')
    const questTabsPath = join(process.cwd(), 'public/ui/quest-tabs.png')

    expect(existsSync(waypointTabsPath)).toBe(true)
    expect(existsSync(waypointIconsPath)).toBe(true)
    expect(existsSync(questTabsPath)).toBe(true)

    // 10 frames of 63x31 = 630x31
    const wpTabsDim = getPngDimensions(waypointTabsPath)
    expect(wpTabsDim.width).toBe(630)
    expect(wpTabsDim.height).toBe(31)

    // 5 frames of 30x30 = 150x30
    const wpIconsDim = getPngDimensions(waypointIconsPath)
    expect(wpIconsDim.width).toBe(150)
    expect(wpIconsDim.height).toBe(30)

    // 10 frames of 63x31 = 630x31
    const qTabsDim = getPngDimensions(questTabsPath)
    expect(qTabsDim.width).toBe(630)
    expect(qTabsDim.height).toBe(31)
  })

  it('renders waypoint tabs and icons using drawImage slices when assets are present', () => {
    // Explicitly seed the legacy all-waypoints-unlocked demo state (the HUD starts with all waypoints locked).
    const hud = createDemoWorldPanels()
    const font = new D2FontRenderer()

    const drawImageCalls: any[] = []
    const ctx = {
      drawImage: vi.fn((...args: any[]) => {
        drawImageCalls.push(args)
      }),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn(() => ({ width: 60 })),
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D

    const mockTabsImg = {
      complete: true,
      naturalWidth: 630,
      naturalHeight: 31,
    } as unknown as HTMLImageElement

    const mockIconsImg = {
      complete: true,
      naturalWidth: 150,
      naturalHeight: 30,
    } as unknown as HTMLImageElement

    hud.selectedActTab = 2
    // Set current waypoint to Lut Gholein (waypointId: 9, levelId: 40)
    hud.setCurrentWaypoint(9, 40)

    hud.drawLeftDockPanel(
      ctx,
      'waypoint',
      {
        questBgImg: null,
        waypointBgImg: null,
        borderLeftImg: null,
        stashBgImg: null,
        cubeBgImg: null,
        vendorBgImg: null,
        buySellBtnImg: null,
        waypointTabsImg: mockTabsImg,
        waypointIconsImg: mockIconsImg,
      },
      font,
    )

    // Verify 5 tab draws from mockTabsImg:
    // Act 1 (inactive, frame 1 -> sx 1 * 63 = 63)
    // Act 2 (active, frame 2 -> sx 2 * 63 = 126)
    // Act 3 (inactive, frame 5 -> sx 5 * 63 = 315)
    // Act 4 (inactive, frame 7 -> sx 7 * 63 = 441)
    // Act 5 (inactive, frame 9 -> sx 9 * 63 = 567)
    const tabDraws = drawImageCalls.filter((c) => c[0] === mockTabsImg)
    expect(tabDraws.length).toBe(5)
    expect(tabDraws[0][1]).toBe(1 * 63) // Act 1 (inactive) sx = 63
    expect(tabDraws[1][1]).toBe(2 * 63) // Act 2 (active) sx = 126
    expect(tabDraws[2][1]).toBe(5 * 63) // Act 3 (inactive) sx = 315

    // Verify waypoint icons drawn from mockIconsImg for Act 2:
    // Ground Truth D2Client.dll 1.13c:
    // - Index 0 (Lut Gholein): current waypoint -> Frame 0 (sx = 0)
    // - Indices 1..8: activated destination waypoints -> Frame 3 (sx = 90)
    const iconDraws = drawImageCalls.filter((c) => c[0] === mockIconsImg)
    const act2WpCount = (ACT_WAYPOINTS[2] ?? []).length
    expect(iconDraws.length).toBe(act2WpCount)
    expect(iconDraws[0][1]).toBe(0) // Current waypoint: Frame 0 (sx = 0)
    for (let i = 1; i < act2WpCount; i++) {
      expect(iconDraws[i][1]).toBe(90) // Destination waypoints: Frame 3 (sx = 90)
      expect(iconDraws[i][3]).toBe(30)
      expect(iconDraws[i][4]).toBe(30)
    }
  })

  it('Issue #393: renders hovered states and omits locked waypoint icons per D2 1.13c parity', () => {
    // Explicitly seed the legacy all-waypoints-unlocked demo state (the HUD starts with all waypoints locked).
    const hud = createDemoWorldPanels()
    const font = new D2FontRenderer()

    const mockTabsImg = {
      complete: true,
      naturalWidth: 630,
      naturalHeight: 31,
    } as unknown as HTMLImageElement

    const mockIconsImg = {
      complete: true,
      naturalWidth: 150,
      naturalHeight: 30,
    } as unknown as HTMLImageElement

    const assets = {
      questBgImg: null,
      waypointBgImg: null,
      borderLeftImg: null,
      stashBgImg: null,
      cubeBgImg: null,
      vendorBgImg: null,
      buySellBtnImg: null,
      waypointTabsImg: mockTabsImg,
      waypointIconsImg: mockIconsImg,
    }

    // 1. In Act 4 (3 waypoints: Pandemonium Fortress, City of the Damned, River of Flame)
    hud.selectedActTab = 4
    hud.setCurrentWaypoint(27, 103) // Pandemonium Fortress is current waypoint

    // Hover over current waypoint (index 0) — issue #933: hovering keeps the raised
    // icon cells (0 current / 3 destination); only the label brightens on hover.
    hud.hoveredWaypointIdx = 0
    let drawCalls: any[] = []
    const ctx = {
      drawImage: vi.fn((...args: any[]) => drawCalls.push(args)),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn(() => ({ width: 60 })),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    hud.drawLeftDockPanel(ctx, 'waypoint', assets, font)
    let iconDraws = drawCalls.filter((c) => c[0] === mockIconsImg)
    expect(iconDraws.length).toBe(3)
    expect(iconDraws[0][1]).toBe(0) // Hovered current waypoint stays Frame 0 (sx = 0)
    expect(iconDraws[1][1]).toBe(90) // Destination waypoint: Frame 3 (sx = 90)
    expect(iconDraws[2][1]).toBe(90) // Destination waypoint: Frame 3 (sx = 90)

    // Hover over destination waypoint (index 1: City of the Damned) — still raised
    hud.hoveredWaypointIdx = 1
    drawCalls = []
    hud.drawLeftDockPanel(ctx, 'waypoint', assets, font)
    iconDraws = drawCalls.filter((c) => c[0] === mockIconsImg)
    expect(iconDraws.length).toBe(3)
    expect(iconDraws[0][1]).toBe(0) // Current waypoint: Frame 0 (sx = 0)
    expect(iconDraws[1][1]).toBe(90) // Hovered destination waypoint stays Frame 3 (sx = 90)
    expect(iconDraws[2][1]).toBe(90) // Destination waypoint: Frame 3 (sx = 90)

    // Holding a row down shows the pressed cells (1 current / 4 destination) until release
    hud.hoveredWaypointIdx = null
    hud.pressedWaypointIdx = 1
    drawCalls = []
    hud.drawLeftDockPanel(ctx, 'waypoint', assets, font)
    iconDraws = drawCalls.filter((c) => c[0] === mockIconsImg)
    expect(iconDraws.length).toBe(3)
    expect(iconDraws[0][1]).toBe(0) // Current waypoint: Frame 0
    expect(iconDraws[1][1]).toBe(120) // Pressed destination waypoint: Frame 4 (sx = 120)
    expect(iconDraws[2][1]).toBe(90) // Frame 3
    hud.pressedWaypointIdx = 0
    drawCalls = []
    hud.drawLeftDockPanel(ctx, 'waypoint', assets, font)
    iconDraws = drawCalls.filter((c) => c[0] === mockIconsImg)
    expect(iconDraws[0][1]).toBe(30) // Pressed current waypoint: Frame 1 (sx = 30)
    hud.pressedWaypointIdx = null

    // 2. Locked waypoint: locked waypoints have NO icon drawn per D2Client.dll 0x6fb5b308 (je 0x6fb5b355)
    hud.setWaypointUnlocked(29, false) // Lock River of Flame (index 2)
    drawCalls = []
    hud.drawLeftDockPanel(ctx, 'waypoint', assets, font)
    iconDraws = drawCalls.filter((c) => c[0] === mockIconsImg)
    expect(iconDraws.length).toBe(2) // Only index 0 and 1 drawn, index 2 omitted
    expect(iconDraws[0][1]).toBe(0) // Frame 0
    expect(iconDraws[1][1]).toBe(90) // Frame 3
  })

  it('updates hoveredWaypointIdx on mouse move and highlights hovered waypoint', () => {
    const hud = new WorldPanelsHud()
    hud.selectedActTab = 1
    const ox = 80
    const oy = 60

    // Hover over first waypoint (i = 0): wy = oy + 62 = 122 .. 153
    hud.handleMouseMove(ox + 50, oy + 70)
    expect(hud.hoveredWaypointIdx).toBe(0)

    // Move away
    hud.handleMouseMove(ox + 50, oy + 500)
    expect(hud.hoveredWaypointIdx).toBeNull()
  })

  it('handles clicking waypoint tabs and locked vs unlocked waypoints', () => {
    // Explicitly seed the legacy all-waypoints-unlocked demo state (the HUD starts with all waypoints locked).
    const hud = createDemoWorldPanels()
    const onWaypointTeleport = vi.fn()
    const onClose = vi.fn()

    const ox = 80
    const oy = 60

    // 1. Click Act 3 tab (tab 3: logicalX approx ox + 8 + 2 * 61 + 10 = ox + 140, logicalY oy + 20)
    const tabClickHandled = hud.handleLeftDockClick('waypoint', ox + 140, oy + 20, {
      onWaypointTeleport,
      onClose,
    })
    expect(tabClickHandled).toBe(true)
    expect(hud.selectedActTab).toBe(3)

    // 2. In Act 3:
    // Set Kurast Docks (index 0, waypointId: 18, levelId: 75) as current waypoint
    hud.setCurrentWaypoint(18, 75)
    const wps = ACT_WAYPOINTS[3]!

    // Mark index 1 (Spider Forest, waypointId: 19) as locked via hud method
    hud.setWaypointUnlocked(19, false)

    // Click locked waypoint (index 1): should NOT trigger teleport or close
    const lockedWy = oy + 62 + 1 * 36 + 10
    const lockedClick = hud.handleLeftDockClick('waypoint', ox + 50, lockedWy, {
      onWaypointTeleport,
      onClose,
    })
    expect(lockedClick).toBe(true)
    expect(onWaypointTeleport).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    // Click current waypoint (index 0, Kurast Docks): should NOT trigger teleport (player already here)
    const currentWy = oy + 62 + 0 * 36 + 10
    const currentClick = hud.handleLeftDockClick('waypoint', ox + 50, currentWy, {
      onWaypointTeleport,
      onClose,
    })
    expect(currentClick).toBe(true)
    expect(onWaypointTeleport).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    // Click unlocked destination waypoint (index 2, Great Marsh) — 1.13c semantics
    // (issue #933): mouse-down latches the depressed icon, the teleport + close fire
    // on mouse-up landing back on the same row.
    const destWy = oy + 62 + 2 * 36 + 10
    const destClick = hud.handleLeftDockClick('waypoint', ox + 50, destWy, {
      onWaypointTeleport,
      onClose,
    })
    expect(destClick).toBe(true)
    expect(hud.pressedWaypointIdx).toBe(2)
    expect(onWaypointTeleport).not.toHaveBeenCalled()
    expect(hud.releaseWaypointButton(ox + 50, destWy)).toBe(true)
    expect(hud.pressedWaypointIdx).toBeNull()
    expect(onWaypointTeleport).toHaveBeenCalledWith(3, wps[2]!.slug, wps[2]!.levelId)
    expect(onClose).toHaveBeenCalled()
  })
})

describe('Diablo II 1.13c Horadric Cube Transmute & Close Button Parity', () => {
  it('verifies miniconvert.png dimensions, manifest entry, and byte-exact parity against MPQ miniconvert.dc6', async () => {
    expect(BAKED_UI_MANIFEST.images.miniConvert).toBe('/ui/miniconvert.png')
    const miniConvertPath = join(process.cwd(), 'public/ui/miniconvert.png')
    expect(existsSync(miniConvertPath)).toBe(true)
    expect(getPngDimensions(miniConvertPath)).toEqual({ width: 64, height: 32 })

    expect(CUBE_TRANSMUTE_BTN_BOUNDS).toEqual({
      x: 224,
      y: 320,
      relX: 144,
      relY: 260,
      w: 32,
      h: 32,
      hitMinX: 224,
      hitMaxX: 264,
      hitMinY: 317,
      hitMaxY: 357,
      tooltipCenterX: 238,
      tooltipAnchorY: 317,
      strIdx: 3341,
      labelZh: '改變',
      labelEn: 'Transmute',
    })
    expect(CUBE_CLOSE_BTN_BOUNDS).toEqual({
      x: 355,
      y: 443,
      relX: 275,
      relY: 383,
      w: 32,
      h: 32,
      hitMinX: 355,
      hitMaxX: 395,
      hitMinY: 440,
      hitMaxY: 480,
      tooltipCenterX: 369,
      tooltipAnchorY: 440,
      strIdx: 4144,
      labelZh: '關閉',
      labelEn: 'Close',
    })

    const d2dataPath = join(process.cwd(), 'samples/d2/d2data.mpq')
    const d2expPath = join(process.cwd(), 'samples/d2/d2exp.mpq')
    if (existsSync(d2dataPath) && existsSync(d2expPath)) {
      const archives = new MountedArchives()
      archives.add('d2data.mpq', await MpqArchive.open(await fileSource(d2dataPath)))
      archives.add('d2exp.mpq', await MpqArchive.open(await fileSource(d2expPath)))
      const pl2 = decodePl2(await archives.read('data/global/palette/ACT1/pal.pl2'))
      const sheet = decodeDc6(await archives.read('data/global/ui/Panel/miniconvert.dc6'))
      const frames = sheet.groups[0]!.frames
      expect(frames).toHaveLength(2)
      expect(frames[0]!.width).toBe(32)
      expect(frames[0]!.height).toBe(32)
      expect(frames[1]!.width).toBe(32)
      expect(frames[1]!.height).toBe(32)

      const pixels = new Uint8Array(64 * 32)
      for (let i = 0; i < 2; i++) {
        const f = frames[i]!
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            const idx = y * 32 + x
            if (f.mask[idx] !== 0 && f.indices[idx] !== 0) {
              pixels[y * 64 + i * 32 + x] = f.indices[idx]!
            }
          }
        }
      }
      const expectedPng = encodeIndexedPng({
        width: 64,
        height: 32,
        pixels,
        palette: pl2.rgb,
        transparentIndex: 0,
      })
      const actualBytes = readFileSync(miniConvertPath)
      expect(Buffer.compare(actualBytes, Buffer.from(expectedPng))).toBe(0)
    }
  })

  it('draws Horadric Cube Transmute button (miniconvert.png) at (ox+144, oy+260) and Close button at (ox+275, oy+383), switching frames on press and rendering hover tooltips', () => {
    const hud = new WorldPanelsHud()
    const drawImageCalls: any[] = []
    const textCalls: Array<{ text: string; x: number; y: number; opts?: any }> = []

    const ctx = {
      drawImage: vi.fn((...args: any[]) => drawImageCalls.push(args)),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
    } as unknown as CanvasRenderingContext2D

    const font = {
      measureText: vi.fn((text: string) => text.length * 16),
      drawText: vi.fn((_ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts?: any) => {
        textCalls.push({ text, x, y, opts })
      }),
    } as unknown as D2FontRenderer

    const mockCubeBg = { tag: 'cubeBg' } as unknown as HTMLImageElement
    const mockBuySellBtn = { tag: 'buySellBtn' } as unknown as HTMLImageElement
    const mockMiniConvert = { tag: 'miniConvert' } as unknown as HTMLImageElement

    const assets = {
      borderLeftImg: null,
      questBgImg: null,
      waypointBgImg: null,
      stashBgImg: null,
      cubeBgImg: mockCubeBg,
      vendorBgImg: null,
      buySellBtnImg: mockBuySellBtn,
      miniConvertImg: mockMiniConvert,
    }

    // 1. Unpressed render
    hud.drawLeftDockPanel(ctx, 'cube', assets, font)
    const transmuteDraws = drawImageCalls.filter(c => c[0] === mockMiniConvert)
    const closeDraws = drawImageCalls.filter(c => c[0] === mockBuySellBtn)
    expect(transmuteDraws).toHaveLength(1)
    expect(transmuteDraws[0].slice(1)).toEqual([0, 0, 32, 32, 80 + 144, 60 + 260, 32, 32])
    expect(closeDraws).toHaveLength(1)
    expect(closeDraws[0].slice(1)).toEqual([10 * 32, 0, 32, 32, 80 + 275, 60 + 383, 32, 32])

    // 2. Click Transmute button (`ox + 160, oy + 276`) -> increments count, sets pressedCubeButton = 'transmute' (frame 1 -> sx = 32)
    const onClose = vi.fn()
    hud.handleLeftDockClick('cube', 80 + 160, 60 + 276, {
      onClose,
      onWaypointTeleport: () => {},
    })
    expect(hud.cubeTransmuteCount).toBe(1)
    expect(hud.pressedCubeButton).toBe('transmute')

    // Hover over Transmute button -> hoveredCubeButton = 'transmute'
    hud.handleMouseMove(80 + 160, 60 + 276)
    expect(hud.hoveredCubeButton).toBe('transmute')
    expect(hud.pressedCubeButton).toBe('transmute')

    drawImageCalls.length = 0
    textCalls.length = 0
    hud.drawLeftDockPanel(ctx, 'cube', assets, font)
    const pressedTransmuteDraws = drawImageCalls.filter(c => c[0] === mockMiniConvert)
    expect(pressedTransmuteDraws).toHaveLength(1)
    expect(pressedTransmuteDraws[0].slice(1)).toEqual([32, 0, 32, 32, 80 + 144, 60 + 260, 32, 32])
    const transmuteTooltip = textCalls.find(c => c.text === '改變')
    expect(transmuteTooltip).toBeDefined()
    expect(transmuteTooltip!.x).toBe(80 + 158)
    expect(transmuteTooltip!.opts?.font).toBe('font16')

    // 3. Moving cursor outside Transmute button clears pressedCubeButton per D2Client.dll 0x6fb49783
    hud.handleMouseMove(80 + 290, 60 + 395)
    expect(hud.hoveredCubeButton).toBe('close')
    expect(hud.pressedCubeButton).toBeNull()

    textCalls.length = 0
    hud.drawLeftDockPanel(ctx, 'cube', assets, font)
    const closeTooltip = textCalls.find(c => c.text === '關閉')
    expect(closeTooltip).toBeDefined()
    expect(closeTooltip!.x).toBe(80 + 289)
    expect(closeTooltip!.opts?.font).toBe('font16')

    // 4. Close button follows 1.13c semantics: mouse-down latches the depressed X,
    //    the close fires on mouse-up landing back on the button (issue #927).
    const closeHandled = hud.handleLeftDockClick('cube', 80 + 290, 60 + 395, {
      onClose,
      onWaypointTeleport: () => {},
    })
    expect(closeHandled).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    expect(hud.hasPendingCloseRelease()).toBe(true)
    hud.releaseCloseButton(80 + 290, 60 + 395, 80 + 290, 60 + 395)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(hud.hasPendingCloseRelease()).toBe(false)
  })
})

describe('Issue #833: Diablo II 1.13c Vendor Stash Gold Readout (D2Client.dll 0x6fb3cfb0 mode 2)', () => {
  it('renders left-aligned Stash label and right-aligned stashGold inside buysell.dc6 bottom-left recess (relX 17..200, relY 359..375)', () => {
    expect(VENDOR_GOLD_BOX_RECESS).toEqual({
      x: 97,
      y: 419,
      relX: 17,
      relY: 359,
      w: 184,
      h: 17,
      labelRelX: 21,
      amountRightRelX: 198,
      textRelY: 371,
      labelX: 101,
      amountRightX: 278,
      textY: 431,
    })

    const hud = new WorldPanelsHud()
    const charsi = getTownNpcDescriptorByHcIdx(154)!
    const gheed = getTownNpcDescriptorByHcIdx(147)!
    const textCalls: Array<{ text: string; x: number; y: number; opts?: any }> = []

    const ctx = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
    } as unknown as CanvasRenderingContext2D

    const font = {
      measureText: vi.fn((text: string) => text.length * 7),
      drawText: vi.fn((_ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts?: any) => {
        textCalls.push({ text, x, y, opts })
      }),
    } as unknown as D2FontRenderer

    const assets = {
      borderLeftImg: null,
      questBgImg: null,
      waypointBgImg: null,
      stashBgImg: null,
      cubeBgImg: null,
      vendorBgImg: { tag: 'vendorBg' } as unknown as HTMLImageElement,
      vendorTabsImg: { tag: 'vendorTabs' } as unknown as HTMLImageElement,
      buySellBtnImg: { tag: 'buySellBtn' } as unknown as HTMLImageElement,
    }

    // 1. CHI trade mode with 0 stash gold
    hud.lang = 'CHI'
    hud.stashGold = 0
    hud.setVendorShop({ npcId: 6, descriptor: charsi, mode: 'trade', items: [] })
    hud.drawLeftDockPanel(ctx, 'vendor', assets, font)

    const chiLabel = textCalls.find(c => c.text === '儲藏箱')
    const zeroAmount = textCalls.find(c => c.text === '0')
    expect(chiLabel).toEqual({
      text: '儲藏箱',
      x: VENDOR_GOLD_BOX_RECESS.labelX,
      y: VENDOR_GOLD_BOX_RECESS.textY,
      opts: { font: 'font8', color: 'white', align: 'left' },
    })
    expect(zeroAmount).toEqual({
      text: '0',
      x: VENDOR_GOLD_BOX_RECESS.amountRightX,
      y: VENDOR_GOLD_BOX_RECESS.textY,
      opts: { font: 'font8', color: 'white', align: 'right' },
    })

    // 2. ENG gamble mode with 2,500,000 stash gold
    textCalls.length = 0
    hud.lang = 'ENG'
    hud.stashGold = 2500000
    hud.setVendorShop({ npcId: 7, descriptor: gheed, mode: 'gamble', items: [] })
    hud.drawLeftDockPanel(ctx, 'vendor', assets, font)

    const engLabel = textCalls.find(c => c.text === 'Stash')
    const maxAmount = textCalls.find(c => c.text === '2500000')
    expect(engLabel).toEqual({
      text: 'Stash',
      x: VENDOR_GOLD_BOX_RECESS.labelX,
      y: VENDOR_GOLD_BOX_RECESS.textY,
      opts: { font: 'font8', color: 'white', align: 'left' },
    })
    expect(maxAmount).toEqual({
      text: '2500000',
      x: VENDOR_GOLD_BOX_RECESS.amountRightX,
      y: VENDOR_GOLD_BOX_RECESS.textY,
      opts: { font: 'font8', color: 'white', align: 'right' },
    })

    // Verify horizontal and vertical containment inside buysell.dc6 recess [ox+17..ox+200, oy+359..oy+375] without overlap
    const recessLeft = VENDOR_GOLD_BOX_RECESS.x
    const recessRight = VENDOR_GOLD_BOX_RECESS.x + VENDOR_GOLD_BOX_RECESS.w - 1
    const recessTop = VENDOR_GOLD_BOX_RECESS.y
    const recessBottom = VENDOR_GOLD_BOX_RECESS.y + VENDOR_GOLD_BOX_RECESS.h - 1

    const labelWidth = 5 * 7 // 'Stash' in font8
    const amountWidth = 7 * 7 // '2500000' in font8
    expect(engLabel!.x).toBeGreaterThan(recessLeft)
    expect(engLabel!.x + labelWidth).toBeLessThan(maxAmount!.x - amountWidth)
    expect(maxAmount!.x).toBeLessThan(recessRight)
    expect(engLabel!.y - 9).toBeGreaterThanOrEqual(recessTop)
    expect(engLabel!.y + 2).toBeLessThanOrEqual(recessBottom)

    // 3. Temporary status toast overrides recess cleanly while active, and restores Stash Gold once expired
    textCalls.length = 0
    const now = performance.now()
    hud.showVendorStatus('Not enough gold', 'white', now)
    hud.drawLeftDockPanel(ctx, 'vendor', assets, font)
    expect(textCalls.find(c => c.text === 'Not enough gold')).toEqual({
      text: 'Not enough gold',
      x: 80 + VENDOR_STATUS_TEXT_POS.relX,
      y: 60 + VENDOR_STATUS_TEXT_POS.relY,
      opts: { font: 'font8', color: 'white', align: 'center' },
    })
    expect(textCalls.find(c => c.text === 'Stash')).toBeUndefined()
    expect(textCalls.find(c => c.text === '2500000')).toBeUndefined()

    // Expire status toast
    textCalls.length = 0
    hud.vendorStatusMsg = { text: 'Not enough gold', color: 'white', untilMs: now - 1 }
    hud.drawLeftDockPanel(ctx, 'vendor', assets, font)
    expect(textCalls.find(c => c.text === 'Stash')).toBeDefined()
    expect(textCalls.find(c => c.text === '2500000')).toBeDefined()
  })
})
