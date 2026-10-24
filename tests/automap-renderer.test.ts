import { describe, expect, it } from 'vitest'
import {
  type AutomapLayerData,
  computeAutomapTilePixelCoords,
  getCrosshairSegments,
} from '../src/common/formats/automap-table.ts'
import type { AtlasFrame } from '../src/client/render/atlas.ts'
import type { AtlasHandle, SpriteRenderer } from '../src/client/render/renderer.ts'
import type { D2ColorCode, D2FontRenderer } from '../src/client/ui/font.ts'
import {
  AUTOMAP_CROSSHAIR_COLORS,
  AUTOMAP_FADE_ALPHAS,
  AUTOMAP_PAN_STEP_PX,
  AUTOMAP_REVEAL_DISTANCE_THRESHOLD,
  Minimap,
  type MinimapLevel,
  automapPixelToCellCoords,
  computeAutomapRevealDistance,
  computeAutomapViewport,
  projectAutomapCellScreenRect,
  resolveAutomapSheetName,
} from '../src/client/ui/minimap.ts'

interface RecordedSpriteDraw {
  readonly kind: 'sprite'
  readonly frame: AtlasFrame
  readonly x: number
  readonly y: number
  readonly atlas?: AtlasHandle
  readonly width?: number
  readonly height?: number
  readonly tint?: readonly [number, number, number, number]
}

interface RecordedSolidDraw {
  readonly kind: 'solid'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: readonly [number, number, number, number]
}

interface RecordedQuadDraw {
  readonly kind: 'quad'
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly x3: number
  readonly y3: number
  readonly color: readonly [number, number, number, number]
}

type RecordedDraw = RecordedSpriteDraw | RecordedSolidDraw | RecordedQuadDraw

function createMockRenderer(): {
  renderer: SpriteRenderer
  draws: RecordedDraw[]
  scissors: ({ x: number; y: number; width: number; height: number } | null)[]
} {
  const draws: RecordedDraw[] = []
  const scissors: ({ x: number; y: number; width: number; height: number } | null)[] = []
  let activeScissor: { x: number; y: number; width: number; height: number } | null = null

  const mockGl = {
    SCISSOR_TEST: 0x0c11,
    enable(cap: number) {
      if (cap === 0x0c11) {
        activeScissor = { x: 0, y: 0, width: 0, height: 0 }
      }
    },
    scissor(x: number, y: number, width: number, height: number) {
      activeScissor = { x, y, width, height }
      scissors.push(activeScissor)
    },
    disable(cap: number) {
      if (cap === 0x0c11) {
        activeScissor = null
        scissors.push(null)
      }
    },
  }

  const renderer = {
    gl: mockGl,
    flush() {
      // no-op in mock
    },
    draw(
      frame: AtlasFrame,
      x: number,
      y: number,
      options?: {
        atlas?: AtlasHandle
        width?: number
        height?: number
        tint?: readonly [number, number, number, number]
      },
    ) {
      draws.push({
        kind: 'sprite',
        frame,
        x,
        y,
        ...(options?.atlas ? { atlas: options.atlas } : {}),
        ...(options?.width !== undefined ? { width: options.width } : {}),
        ...(options?.height !== undefined ? { height: options.height } : {}),
        ...(options?.tint ? { tint: options.tint } : {}),
      })
    },
    drawSolid(
      x: number,
      y: number,
      width: number,
      height: number,
      color: readonly [number, number, number, number],
    ) {
      draws.push({ kind: 'solid', x, y, width, height, color })
    },
    drawSolidQuad(
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      color: readonly [number, number, number, number],
    ) {
      draws.push({ kind: 'quad', x0, y0, x1, y1, x2, y2, x3, y3, color })
    },
  } as unknown as SpriteRenderer

  return { renderer, draws, scissors }
}

function registerSyntheticAtlases(minimap: Minimap): void {
  const keys = [
    'MaxiMap',
    'MaxiMapS',
    'Act2Map',
    'Act2MapS',
    'Act4Map',
    'Act4MapS',
    'ExTnMap',
    'ExTnMapS',
  ] as const
  for (const key of keys) {
    const meta = minimap.getSheetMeta(key)
    minimap.setAtlasHandle(key, {
      texture: key as unknown as WebGLTexture,
      width: meta.atlasWidth,
      height: meta.atlasHeight,
    })
  }
}

function makeAutomapTestLevel(overrides?: Partial<MinimapLevel>): MinimapLevel {
  const cellsX = 24
  const cellsY = 24
  const gridWidth = cellsX * 5
  const blocked = new Uint8Array(gridWidth * cellsY * 5)
  const nearCoords = computeAutomapTilePixelCoords(4, 4, 0)
  const farCoords = computeAutomapTilePixelCoords(20, 20, 0)

  const automap: AutomapLayerData = {
    layerId: 1,
    levelTypeId: 1,
    floors: [
      { cellNo: 5, xPixel: nearCoords.xPixel, yPixel: nearCoords.yPixel, cellX: 4, cellY: 4, fSaved: 0, weight: 0 },
      { cellNo: 6, xPixel: farCoords.xPixel, yPixel: farCoords.yPixel, cellX: 20, cellY: 20, fSaved: 0, weight: 0 }, // far unrevealed room (room 2,2)
    ],
    walls: [
      { cellNo: 42, xPixel: nearCoords.xPixel, yPixel: nearCoords.yPixel, cellX: 4, cellY: 4, fSaved: 0, weight: 0 },
      { cellNo: -1, xPixel: nearCoords.xPixel, yPixel: nearCoords.yPixel, cellX: 4, cellY: 4, fSaved: 0, weight: 0 }, // cellNo < 0 must be skipped
    ],
    objects: [
      { cellNo: 318, xPixel: nearCoords.xPixel, yPixel: nearCoords.yPixel, cellX: 4, cellY: 4, fSaved: 0, weight: 0 },
    ],
    extras: [
      { cellNo: 309, xPixel: nearCoords.xPixel, yPixel: nearCoords.yPixel, cellX: 4, cellY: 4, fSaved: 0, weight: 0 },
    ],
  }
  return {
    key: 'act1-town',
    cellsX,
    cellsY,
    blocked,
    gridWidth,
    originX: 0,
    originY: 0,
    automap,
    levelId: 1,
    levelName: '罗格营地',
    difficulty: '普通',
    markers: [
      { cellX: 5, cellY: 4, kind: 'exit', toLevelId: 2, targetName: '鲜血荒地' },
      { cellX: 4, cellY: 5, kind: 'waypoint' },
    ],
    ...overrides,
  }
}

describe('R3 Authentic 1.13c Isometric Sprite Automap & Minimap UI', () => {
  describe('8-Sheet Sprite Selection & Level Routing (resolveAutomapSheetName)', () => {
    it('routes standard Act 1-4 levels to MaxiMap (full) and MaxiMapS (minimap)', () => {
      expect(resolveAutomapSheetName(0, false, 1)).toBe('MaxiMap')
      expect(resolveAutomapSheetName(0, true, 1)).toBe('MaxiMapS')
      expect(resolveAutomapSheetName('MaxiMap', false, 1)).toBe('MaxiMap')
      expect(resolveAutomapSheetName('MaxiMap', true, 1)).toBe('MaxiMapS')
      expect(resolveAutomapSheetName(undefined, false, 75)).toBe('MaxiMap')
      expect(resolveAutomapSheetName(undefined, true, 75)).toBe('MaxiMapS')
    })

    it('routes Act 2 Sewers (fSaved=1 or levels 47, 48, 49) to Act2Map and Act2MapS', () => {
      expect(resolveAutomapSheetName(1, false)).toBe('Act2Map')
      expect(resolveAutomapSheetName(1, true)).toBe('Act2MapS')
      for (const levelId of [47, 48, 49]) {
        expect(resolveAutomapSheetName('MaxiMap', false, levelId)).toBe('Act2Map')
        expect(resolveAutomapSheetName('MaxiMap', true, levelId)).toBe('Act2MapS')
      }
      expect(resolveAutomapSheetName('Act2Map', false, 47)).toBe('Act2Map')
      expect(resolveAutomapSheetName('Act2Map', true, 47)).toBe('Act2MapS')
    })

    it('routes Act 4 Pandemonium Fortress (fSaved=2 or level 103) to Act4Map and Act4MapS', () => {
      expect(resolveAutomapSheetName(2, false)).toBe('Act4Map')
      expect(resolveAutomapSheetName(2, true)).toBe('Act4MapS')
      expect(resolveAutomapSheetName('MaxiMap', false, 103)).toBe('Act4Map')
      expect(resolveAutomapSheetName('MaxiMap', true, 103)).toBe('Act4MapS')
      expect(resolveAutomapSheetName('Act4Map', false, 103)).toBe('Act4Map')
      expect(resolveAutomapSheetName('Act4Map', true, 103)).toBe('Act4MapS')
    })

    it('routes Act 2 Palace Cellar (level 52) and Act 5 Expansion (fSaved=3 or levels >= 109) to ExTnMap and ExTnMapS', () => {
      expect(resolveAutomapSheetName(3, false)).toBe('ExTnMap')
      expect(resolveAutomapSheetName(3, true)).toBe('ExTnMapS')
      expect(resolveAutomapSheetName('MaxiMap', false, 52)).toBe('ExTnMap')
      expect(resolveAutomapSheetName('MaxiMap', true, 52)).toBe('ExTnMapS')
      expect(resolveAutomapSheetName('MaxiMap', false, 109)).toBe('ExTnMap')
      expect(resolveAutomapSheetName('MaxiMap', true, 109)).toBe('ExTnMapS')
      expect(resolveAutomapSheetName('ExTnMap', false, 136)).toBe('ExTnMap')
      expect(resolveAutomapSheetName('ExTnMap', true, 136)).toBe('ExTnMapS')
    })
  })

  describe('Isometric Projection & DC6 Baseline Offsets (D2Client.dll 0x6fb10480 / 0x6fb0f240)', () => {
    it('projects pre-divided (xPixel, yPixel) cells using nDivisor=10 (full) and nDivisor=20 (minimap)', () => {
      const tile = computeAutomapTilePixelCoords(2, 1, 0)
      const recovered = automapPixelToCellCoords(tile.xPixel, tile.yPixel)
      expect(recovered.cellX).toBe(2)
      expect(recovered.cellY).toBe(1)

      const frameFull = { width: 16, height: 24, offsetX: 0, offsetY: -3 }
      const rectFull = projectAutomapCellScreenRect(tile, frameFull, -392, -264, false)
      // screenX = Math.trunc((8 * 10) / 10) - (-392) = 400
      // screenY = Math.trunc((12 * 10) / 10) - (-264) = 276
      expect(rectFull.screenX).toBe(400)
      expect(rectFull.screenY).toBe(276)
      // drawLeft = screenX + offsetX - 8 = 392
      // drawTop = screenY - height + offsetY = 276 - 24 - 3 = 249
      expect(rectFull.drawLeft).toBe(392)
      expect(rectFull.drawTop).toBe(249)

      const frameHalf = { width: 8, height: 12, offsetX: 0, offsetY: -2 }
      const rectHalf = projectAutomapCellScreenRect(tile, frameHalf, -640, -122, true)
      // screenX = Math.trunc((8 * 10) / 20) - (-640) = 644
      // screenY = Math.trunc((12 * 10) / 20) - (-122) = 128
      expect(rectHalf.screenX).toBe(644)
      expect(rectHalf.screenY).toBe(128)
      // drawLeft = screenX + offsetX - 4 = 640
      // drawTop = screenY - height + offsetY = 128 - 12 - 2 = 114
      expect(rectHalf.drawLeft).toBe(640)
      expect(rectHalf.drawTop).toBe(114)
    })
  })

  describe('Dual Viewports & Panel Shifts (computeAutomapViewport)', () => {
    it('Issue #1319, #1371: computes 279x225 clipped Corner Minimap viewport below room HUD and keeps it fixed at top-right when right panel is open', () => {
      const vpRightClosed = computeAutomapViewport(800, 600, true, false, false, 0, 0)
      expect(vpRightClosed.bMinimap).toBe(true)
      expect(vpRightClosed.divisor).toBe(20)
      expect(vpRightClosed.x).toBe(519) // 800 - 281
      expect(vpRightClosed.y).toBe(120)
      expect(vpRightClosed.width).toBe(279)
      expect(vpRightClosed.height).toBe(225)
      expect(vpRightClosed.centerX).toBe(658) // 800 - 142
      expect(vpRightClosed.centerY).toBe(232) // 120 + 112

      const vpRightOpen = computeAutomapViewport(800, 600, true, false, true, 0, 0)
      expect(vpRightOpen.x).toBe(519)
      expect(vpRightOpen.y).toBe(120)
      expect(vpRightOpen.width).toBe(279)
      expect(vpRightOpen.height).toBe(225)
      expect(vpRightOpen.centerX).toBe(658)
      expect(vpRightOpen.centerY).toBe(232)
    })

    it('Issue #1320: cycles through 3 display modes (top-right -> center -> off -> top-right) and applies center semi-transparency in center mode', () => {
      const minimap = new Minimap()
      expect(minimap.displayMode).toBe('top-right')
      expect(minimap.visible).toBe(true)
      expect(minimap.mode).toBe('minimap')

      expect(minimap.cycleDisplayMode()).toBe('center')
      expect(minimap.displayMode).toBe('center')
      expect(minimap.visible).toBe(true)
      expect(minimap.mode).toBe('full')

      expect(minimap.cycleDisplayMode()).toBe('off')
      expect(minimap.displayMode).toBe('off')
      expect(minimap.visible).toBe(false)

      expect(minimap.cycleDisplayMode()).toBe('top-right')
      expect(minimap.displayMode).toBe('top-right')
      expect(minimap.visible).toBe(true)
      expect(minimap.mode).toBe('minimap')
    })

    it('computes Full-Screen Automap viewport [0, 0, W, H] and shifts center +-W>>2 for open side panels', () => {
      const vpNeutral = computeAutomapViewport(800, 600, false, false, false, 0, 0)
      expect(vpNeutral.bMinimap).toBe(false)
      expect(vpNeutral.divisor).toBe(10)
      expect(vpNeutral.x).toBe(0)
      expect(vpNeutral.y).toBe(0)
      expect(vpNeutral.width).toBe(800)
      expect(vpNeutral.height).toBe(600)
      expect(vpNeutral.centerX).toBe(400)
      expect(vpNeutral.centerY).toBe(280) // (600 - 40) / 2

      const vpLeftOpen = computeAutomapViewport(800, 600, false, true, false, 0, 0)
      expect(vpLeftOpen.centerX).toBe(600) // 400 + 200

      const vpRightOpen = computeAutomapViewport(800, 600, false, false, true, 0, 0)
      expect(vpRightOpen.centerX).toBe(200) // 400 - 200

      const vpBothOpen = computeAutomapViewport(800, 600, false, true, true, 0, 0)
      expect(vpBothOpen.centerX).toBe(400)
    })
  })

  describe('Strict 4-Layer Draw Order (floors -> walls -> objects -> extras) & Scissor Clipping', () => {
    it('scales the scissor rect to the renderer backing store so a 2x canvas still shows the minimap', () => {
      const minimap = new Minimap()
      registerSyntheticAtlases(minimap)
      minimap.mode = 'minimap'
      const level = makeAutomapTestLevel()
      minimap.reveal(level, 4, 4, 0, 320, true)

      const { renderer, scissors } = createMockRenderer()
      ;(renderer as { pixelScale: number }).pixelScale = 2
      minimap.draw(
        renderer,
        level,
        4,
        4,
        { x: 0, y: 320, zoom: 1 },
        { width: 800, height: 600 },
        { playerWorldX: 0, playerWorldY: 320, levelId: 1 },
      )

      const vp = minimap.lastRenderStats.viewport
      expect(scissors[0]).toEqual({
        x: vp.vpX * 2,
        y: (600 - (vp.vpY + vp.vpH)) * 2,
        width: vp.vpW * 2,
        height: vp.vpH * 2,
      })
    })

    it('draws automap sprites in exact 1.13c layer order and skips cellNo < 0', () => {
      const minimap = new Minimap()
      registerSyntheticAtlases(minimap)
      minimap.mode = 'full' // test Full Automap (bMinimap = false, MaxiMap)
      const level = makeAutomapTestLevel()
      // Player at cell (4, 4) -> isoX = 0, isoY = (4+4)*40 = 320
      minimap.reveal(level, 4, 4, 0, 320, true)

      const { renderer, draws, scissors } = createMockRenderer()
      minimap.draw(
        renderer,
        level,
        4,
        4,
        { x: 0, y: 320, zoom: 1 },
        { width: 800, height: 600 },
        { playerWorldX: 0, playerWorldY: 320, levelId: 1 },
      )

      // Scissor was enabled with WebGL bottom-left coordinates (y = 600 - 600 = 0) and disabled afterwards
      expect(scissors.length).toBe(2)
      expect(scissors[0]).toEqual({ x: 0, y: 0, width: 800, height: 600 })
      expect(scissors[1]).toBeNull()

      const spriteDraws = draws.filter((d): d is RecordedSpriteDraw => d.kind === 'sprite')
      // Cell (4,4) has 1 floor (cellNo 5), 1 valid wall (cellNo 42, cellNo -1 skipped), 1 object (cellNo 318), 1 extra (cellNo 309)
      // Cell (20,20) is in room (2,2) which is unrevealed and must be culled by fog-of-war
      expect(spriteDraws.length).toBe(4)
      expect(minimap.spritesDrawnLastFrame.total).toBe(4)
      expect(minimap.spritesDrawnLastFrame.floors).toBe(1)
      expect(minimap.spritesDrawnLastFrame.walls).toBe(1)
      expect(minimap.spritesDrawnLastFrame.objects).toBe(1)
      expect(minimap.spritesDrawnLastFrame.extras).toBe(1)

      const atlasMeta = minimap.getSheetMeta('MaxiMap')
      expect(spriteDraws[0]!.frame.x).toBe(atlasMeta.frames[5]!.x)
      expect(spriteDraws[0]!.frame.y).toBe(atlasMeta.frames[5]!.y)
      expect(spriteDraws[1]!.frame.x).toBe(atlasMeta.frames[42]!.x)
      expect(spriteDraws[1]!.frame.y).toBe(atlasMeta.frames[42]!.y)
      expect(spriteDraws[2]!.frame.x).toBe(atlasMeta.frames[318]!.x)
      expect(spriteDraws[2]!.frame.y).toBe(atlasMeta.frames[318]!.y)
      expect(spriteDraws[3]!.frame.x).toBe(atlasMeta.frames[309]!.x)
      expect(spriteDraws[3]!.frame.y).toBe(atlasMeta.frames[309]!.y)
    })
  })

  describe('Fog-of-War Room/Chunk Reveal (D2Client.dll 0x6fb12af0 / 0x6fb12580)', () => {
    it('evaluates octile distance max(|dx|,|dy|)*2 + min(|dx|,|dy|) >= 160 threshold', () => {
      expect(computeAutomapRevealDistance(50, 0)).toBe(100)
      expect(computeAutomapRevealDistance(50, 0) < AUTOMAP_REVEAL_DISTANCE_THRESHOLD).toBe(true)
      expect(computeAutomapRevealDistance(80, 0)).toBe(160)
      expect(computeAutomapRevealDistance(80, 0) >= AUTOMAP_REVEAL_DISTANCE_THRESHOLD).toBe(true)
      expect(computeAutomapRevealDistance(60, 40)).toBe(60 * 2 + 40) // 160
    })

    it('reveals 3x3 room neighborhood around player and unlocks distant room only after player approaches', () => {
      const minimap = new Minimap()
      const level = makeAutomapTestLevel()
      minimap.reveal(level, 4, 4, 0, 320, true)

      // Room (0,0) and its immediate neighbors (0,1), (1,0), (1,1) are revealed
      expect(minimap.isRoomRevealed(level.key, 0, 0)).toBe(true)
      expect(minimap.isRoomRevealed(level.key, 1, 1)).toBe(true)
      // Far room (2,2) containing cell (20,20) is unrevealed
      expect(minimap.isRoomRevealed(level.key, 2, 2)).toBe(false)

      // Moving < 160 sub-units in the same room does not reveal room (2,2)
      expect(minimap.reveal(level, 5, 5, 0, 360)).toBe(false)
      expect(minimap.isRoomRevealed(level.key, 2, 2)).toBe(false)

      // Moving to cell (20, 20) (distance >= 160) reveals room (2,2)
      expect(minimap.reveal(level, 20, 20, 0, 1600)).toBe(true)
      expect(minimap.isRoomRevealed(level.key, 2, 2)).toBe(true)
    })
  })

  describe('Controls: Tab, V (bMinimap toggle), F9 (Fade cycle), F10 (Names), Arrow Panning & Home Reset', () => {
    it('defaults to Corner Minimap (bMinimap=true) and supports V mode toggle, F9 fade cycle, F10 name toggle, arrow panning, and Home reset', () => {
      const minimap = new Minimap()
      expect(minimap.visible).toBe(true)
      expect(minimap.bMinimap).toBe(true)
      expect(minimap.mode).toBe('minimap')
      expect(minimap.divisor).toBe(20)

      // Arrow panning is ignored in Corner Minimap
      expect(minimap.panBySteps(1, 1)).toBe(false)
      expect(minimap.panX).toBe(0)
      expect(minimap.panY).toBe(0)

      // Toggle to Full Automap (V)
      expect(minimap.toggleMinimapMode()).toBe(false)
      expect(minimap.bMinimap).toBe(false)
      expect(minimap.mode).toBe('full')
      expect(minimap.divisor).toBe(10)

      // Arrow panning in Full Automap (bMinimap = false)
      expect(minimap.panBySteps(-1, 2)).toBe(true)
      expect(minimap.panX).toBe(-AUTOMAP_PAN_STEP_PX)
      expect(minimap.panY).toBe(2 * AUTOMAP_PAN_STEP_PX)

      // Home resets pan
      minimap.resetPan()
      expect(minimap.panX).toBe(0)
      expect(minimap.panY).toBe(0)

      // Switching back to Corner Minimap resets pan automatically
      minimap.panBySteps(3, 3)
      expect(minimap.toggleMinimapMode()).toBe(true)
      expect(minimap.bMinimap).toBe(true)
      expect(minimap.panX).toBe(0)
      expect(minimap.panY).toBe(0)

      // F9 fade mode cycles 0 -> 1 -> 2 -> 3 -> 0
      expect(minimap.fadeMode).toBe(0)
      expect(minimap.fadeAlpha).toBe(AUTOMAP_FADE_ALPHAS[0])
      expect(minimap.cycleFade()).toBe(1)
      expect(minimap.fadeAlpha).toBe(AUTOMAP_FADE_ALPHAS[1])
      expect(minimap.cycleFade()).toBe(2)
      expect(minimap.fadeAlpha).toBe(AUTOMAP_FADE_ALPHAS[2])
      expect(minimap.cycleFade()).toBe(3)
      expect(minimap.fadeAlpha).toBe(AUTOMAP_FADE_ALPHAS[3])
      expect(minimap.cycleFade()).toBe(0)

      // F10 name toggle
      expect(minimap.showNames).toBe(true)
      expect(minimap.toggleNames()).toBe(false)
      expect(minimap.toggleNames()).toBe(true)
    })
  })

  describe('12-Segment Closed Directional Polygon Crosshair & Dynamic Portals (D2Client.dll 0x6fb107f0)', () => {
    it('constructs a closed 12-segment polygon crosshair and renders player, NPC, boss, and portal overlays', () => {
      const segmentsFull = getCrosshairSegments(400, 276, false)
      expect(segmentsFull.length).toBe(12)
      // Verify closed polygon loop: start of segment 0 equals end of segment 11
      expect(segmentsFull[0]!.x0).toBe(segmentsFull[11]!.x1)
      expect(segmentsFull[0]!.y0).toBe(segmentsFull[11]!.y1)

      const segmentsMini = getCrosshairSegments(400, 276, true)
      expect(segmentsMini.length).toBe(12)
      // Verify (-1, +5) center shift when bMinimap === true
      expect(segmentsMini[0]!.x0).toBe(segmentsFull[0]!.x0 - 1)
      expect(segmentsMini[0]!.y0).toBe(segmentsFull[0]!.y0 + 5)

      const minimap = new Minimap()
      registerSyntheticAtlases(minimap)
      minimap.mode = 'full'
      const level = makeAutomapTestLevel()
      minimap.reveal(level, 4, 4, 0, 320, true)
      const { renderer, draws } = createMockRenderer()

      minimap.draw(
        renderer,
        level,
        4,
        4,
        { x: 0, y: 320, zoom: 1 },
        { width: 800, height: 600 },
        {
          playerWorldX: 0,
          playerWorldY: 320,
          levelId: 1,
          entities: [
            { x: 16, y: 320, kind: 'npc', name: '阿卡拉' },
            { x: -16, y: 320, kind: 'boss', name: '尸体发火' },
          ],
          portals: [
            { x: 32, y: 320, kind: 'blue', label: '传送门 -> 鲜血荒地' },
          ],
          stashes: [
            { x: 0, y: 336, label: '储物箱' },
          ],
        },
      )

      // 3 entities (player + npc + boss) -> 3 crosshairs drawn (3 * 12 = 36 quad segments)
      expect(minimap.crosshairsDrawnLastFrame.total).toBe(3)
      expect(minimap.crosshairsDrawnLastFrame.player).toBe(1)
      expect(minimap.crosshairsDrawnLastFrame.npcs).toBe(1)
      expect(minimap.crosshairsDrawnLastFrame.bosses).toBe(1)

      const quadDraws = draws.filter((d): d is RecordedQuadDraw => d.kind === 'quad')
      expect(quadDraws.length).toBe(3 * 12)
      expect(quadDraws.some(d => d.color[2] === AUTOMAP_CROSSHAIR_COLORS.player[2])).toBe(true)
      expect(quadDraws.some(d => d.color[1] === AUTOMAP_CROSSHAIR_COLORS.npc[1])).toBe(true)
      expect(quadDraws.some(d => d.color[0] === AUTOMAP_CROSSHAIR_COLORS.boss[0])).toBe(true)

      // 4 static cell sprites + 1 blue portal sprite (cellNo 306)
      expect(minimap.spritesDrawnLastFrame.total).toBe(5)
      expect(minimap.spritesDrawnLastFrame.portals).toBe(1)
      expect(minimap.warpLabelsLastFrame.some(l => l.text === '鲜血荒地' && l.kind === 'warp')).toBe(true)
      expect(minimap.warpLabelsLastFrame.some(l => l.text === '储物箱' && l.kind === 'stash')).toBe(true)
      expect(minimap.warpLabelsLastFrame.some(l => l.text === '传送门 -> 鲜血荒地' && l.kind === 'portal')).toBe(true)
    })

    it('projects Town Portal icon and owner label at exact world coordinates without 2x offset in both full-map (divisor=10) and mini-map (divisor=20) modes (Issue #806)', () => {
      const minimap = new Minimap()
      registerSyntheticAtlases(minimap)
      const level = makeAutomapTestLevel({
        originX: 4000,
        originY: 2000,
      })
      minimap.reveal(level, 4, 4, 5600, 2800, true)

      for (const mode of ['full', 'minimap'] as const) {
        minimap.mode = mode
        const isMini = mode === 'minimap'
        const { renderer, draws } = createMockRenderer()

        minimap.draw(
          renderer,
          level,
          4,
          4,
          { x: 5600, y: 2800, zoom: 1 },
          { width: 800, height: 600 },
          {
            playerWorldX: 5600,
            playerWorldY: 2800,
            levelId: 1,
            portals: [
              {
                x: 5600,
                y: 2800,
                kind: 'blue',
                label: "ttSorceress's Town Portal",
                active: true,
              },
            ],
          },
        )

        const vp = computeAutomapViewport(800, 600, isMini, false, false, 0, 0)
        expect(minimap.spritesDrawnLastFrame.portals).toBe(1)

        const portalLabel = minimap.warpLabelsLastFrame.find(
          (l) => l.kind === 'portal' && l.text === "ttSorceress's Town Portal",
        )
        expect(portalLabel).toBeDefined()
        expect(portalLabel!.x).toBe(vp.centerX)
        expect(portalLabel!.y).toBe(vp.centerY - 8)

        const sheetKey = isMini ? 'MaxiMapS' : 'MaxiMap'
        const frame306 = minimap.getSheetMeta(sheetKey).frames[306]!
        const expectedDrawLeft = vp.centerX + frame306.offsetX - (isMini ? 4 : 8)
        const expectedDrawTop = vp.centerY - frame306.height + frame306.offsetY
        const spriteDraws = draws.filter((d): d is RecordedSpriteDraw => d.kind === 'sprite')
        const portalSprite = spriteDraws.find(
          (d) => d.frame.x === frame306.x && d.frame.y === frame306.y,
        )
        expect(portalSprite).toBeDefined()
        expect(portalSprite!.x).toBe(5600 - 400 + expectedDrawLeft)
        expect(portalSprite!.y).toBe(2800 - 300 + expectedDrawTop)
      }
    })

    it('aligns player and entity crosshairs vertically with the -8px 1.13c baseline offset (D2Client.dll 0x6fb11a86 / 0x6fb10b7c) in both Full Automap and Corner Minimap modes', () => {
      const minimap = new Minimap()
      registerSyntheticAtlases(minimap)
      const level = makeAutomapTestLevel()
      // Player stands at the center of tile (4, 4): subX = 22.5, subY = 22.5 -> worldX = 0, worldY = 360
      minimap.reveal(level, 4, 4, 0, 360, true)

      for (const mode of ['full', 'minimap'] as const) {
        minimap.mode = mode
        const isMini = mode === 'minimap'
        const { renderer, draws } = createMockRenderer()

        minimap.draw(
          renderer,
          level,
          4,
          4,
          { x: 0, y: 360, zoom: 1 },
          { width: 800, height: 600 },
          {
            playerWorldX: 0,
            playerWorldY: 360,
            levelId: 1,
            entities: [{ x: 0, y: 360, kind: 'npc', name: '阿卡拉' }],
          },
        )

        const vp = computeAutomapViewport(800, 600, isMini, false, false, 0, 0)
        // D2Client.dll 0x6fb11a86: playerScreenY = trunc(playerClientY / divisor) - offsetY - 8 = vp.centerY - 8
        const expectedScreenX = vp.centerX
        const expectedScreenY = vp.centerY - 8
        const expectedSegments = getCrosshairSegments(expectedScreenX, expectedScreenY, isMini)

        const quadDraws = draws.filter((d): d is RecordedQuadDraw => d.kind === 'quad')
        const playerQuads = quadDraws.filter(
          (d) => d.color[2] === AUTOMAP_CROSSHAIR_COLORS.player[2],
        )
        const npcQuads = quadDraws.filter(
          (d) => d.color[1] === AUTOMAP_CROSSHAIR_COLORS.npc[1],
        )
        expect(playerQuads.length).toBe(12)
        expect(npcQuads.length).toBe(12)

        // Midpoint of (y0, y3) recovers y1 = toWorldY(seg.y0) = viewOffsetY + expectedSegments[0]!.y0
        const viewOffsetY = 360 - 300
        expect((playerQuads[0]!.y0 + playerQuads[0]!.y3) / 2).toBeCloseTo(
          viewOffsetY + expectedSegments[0]!.y0,
          5,
        )
        expect((npcQuads[0]!.y0 + npcQuads[0]!.y3) / 2).toBeCloseTo(
          viewOffsetY + expectedSegments[0]!.y0,
          5,
        )

        // Entity name label sits at ey - 10 = vp.centerY - 18 (D2Client.dll 0x6fb10bdb: lea edx, [ebx - 0xa])
        const npcLabel = minimap.lastRenderStats.entityLabels.find((l) => l.text === '阿卡拉')
        expect(npcLabel).toBeDefined()
        expect(npcLabel!.x).toBe(vp.centerX)
        expect(npcLabel!.y).toBe(vp.centerY - 18)
      }
    })
  })

  describe('HUD Text Overlay (drawHudOverlay: Font6 warp/stash labels & Font16 top-right Level Name + Difficulty)', () => {
    it('renders Font6 warp/stash labels and right-aligned gold Font16 Level Name + Difficulty at (W-16, 16) and (W-16, 34)', () => {
      const minimap = new Minimap()
      registerSyntheticAtlases(minimap)
      minimap.mode = 'full'
      const level = makeAutomapTestLevel()
      minimap.reveal(level, 4, 4, 0, 320, true)
      const { renderer } = createMockRenderer()

      minimap.draw(
        renderer,
        level,
        4,
        4,
        { x: 0, y: 320, zoom: 1 },
        { width: 800, height: 600 },
        {
          playerWorldX: 0,
          playerWorldY: 320,
          levelId: 1,
          stashes: [{ x: 0, y: 336, label: '储物箱' }],
        },
      )

      const drawnTexts: {
        text: string
        x: number
        y: number
        font?: string
        color?: D2ColorCode
        align?: string
      }[] = []
      const mockFont = {
        measureText: (text: string) => text.length * 10,
        drawText(
          _ctx: CanvasRenderingContext2D,
          text: string,
          x: number,
          y: number,
          opts?: Parameters<D2FontRenderer['drawText']>[4],
        ) {
          drawnTexts.push({
            text,
            x,
            y,
            ...(opts?.font ? { font: opts.font } : {}),
            ...(opts?.color ? { color: opts.color } : {}),
            ...(opts?.align ? { align: opts.align } : {}),
          })
        },
      } as unknown as D2FontRenderer

      minimap.drawHudOverlay({} as CanvasRenderingContext2D, mockFont, 800, 600)

      const levelTitle = drawnTexts.find(t => t.text === '罗格营地')
      const diffTitle = drawnTexts.find(t => t.text === '普通')
      expect(levelTitle).toBeDefined()
      expect(levelTitle!.font).toBe('font16')
      expect(levelTitle!.color).toBe('gold')
      expect(levelTitle!.align).toBe('right')
      expect(levelTitle!.x).toBe(800 - 16)
      expect(levelTitle!.y).toBe(16)

      expect(diffTitle).toBeDefined()
      expect(diffTitle!.font).toBe('font16')
      expect(diffTitle!.color).toBe('gold')
      expect(diffTitle!.align).toBe('right')
      expect(diffTitle!.x).toBe(800 - 16)
      expect(diffTitle!.y).toBe(34)

      const warpText = drawnTexts.find(t => t.text === '鲜血荒地')
      const stashText = drawnTexts.find(t => t.text === '储物箱')
      expect(warpText).toBeDefined()
      expect(warpText!.font).toBe('font6')
      expect(warpText!.align).toBe('center')
      expect(stashText).toBeDefined()
      expect(stashText!.font).toBe('font6')
      expect(stashText!.color).toBe('gold')
    })
  })
})
