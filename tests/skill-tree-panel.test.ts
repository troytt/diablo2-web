import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SkillTreePanel,
  SKILL_PANEL_ORIGIN,
  SKILL_CLOSE_BTN_BOUNDS,
  SKILL_CLOSE_BTN_OFFSET_X,
  remapSkillIconPixelToTextShift5,
} from '../src/client/ui/skill-tree-panel.ts'
import { createDemoSkillTree } from './fixtures/hud-demo-state.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import type { D2FontRenderer } from '../src/client/ui/font.ts'

describe('Authentic D2 v1.13c Skill Tree Panel Layout & Alignment', () => {
  it('manifest contains skillTabs and skillPoints image references', () => {
    expect(BAKED_UI_MANIFEST.images.skillTabs).toBe('/ui/skill-tree-tabs.png')
    expect(BAKED_UI_MANIFEST.images.skillPoints).toBe('/ui/skillpoints.png')

    const tabsPath = join(process.cwd(), 'public', 'ui', 'skill-tree-tabs.png')
    const spPath = join(process.cwd(), 'public', 'ui', 'skillpoints.png')

    expect(existsSync(tabsPath), 'skill-tree-tabs.png must exist in public/ui').toBe(true)
    expect(existsSync(spPath), 'skillpoints.png must exist in public/ui').toBe(true)
  })

  it('skill-tree-tabs.png has authentic 192x432 strip dimensions (3 states x 64x432)', () => {
    const tabsPath = join(process.cwd(), 'public', 'ui', 'skill-tree-tabs.png')
    const buf = readFileSync(tabsPath)
    // PNG width and height at bytes 16..24
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    expect(width).toBe(192)
    expect(height).toBe(432)
  })

  it('draws authentic 64x432 tab column slice according to activeTab', () => {
    // Explicitly seeded legacy Sorceress tree (the panel starts class-less until the server assigns it).
    const panel = createDemoSkillTree()
    panel.visible = true

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D

    const mockFont = {
      drawText: vi.fn(),
      measureText: vi.fn(() => 50),
    } as unknown as D2FontRenderer

    const mockTabsImg = {
      complete: true,
      naturalWidth: 192,
      naturalHeight: 432,
    } as unknown as HTMLImageElement

    const mockSpImg = {
      complete: true,
      naturalWidth: 135,
      naturalHeight: 23,
    } as unknown as HTMLImageElement

    // 1. Tab 2 (Cold Spells, Top Tab): slice sx = 0
    panel.activeTab = 2
    panel.draw(mockCtx, {
      borderRightImg: null,
      skillPointsImg: mockSpImg,
      buySellBtnImg: null,
      skillTabsImg: mockTabsImg,
    }, mockFont)

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockTabsImg,
      0, // sx = 0
      0,
      64,
      432,
      SKILL_PANEL_ORIGIN.x + 256,
      SKILL_PANEL_ORIGIN.y,
      64,
      432,
    )

    // 2. Tab 1 (Lightning Spells, Middle Tab): slice sx = 64
    vi.clearAllMocks()
    panel.activeTab = 1
    panel.draw(mockCtx, {
      borderRightImg: null,
      skillPointsImg: mockSpImg,
      buySellBtnImg: null,
      skillTabsImg: mockTabsImg,
    }, mockFont)

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockTabsImg,
      64, // sx = 64
      0,
      64,
      432,
      SKILL_PANEL_ORIGIN.x + 256,
      SKILL_PANEL_ORIGIN.y,
      64,
      432,
    )

    // 3. Tab 0 (Fire Spells, Bottom Tab): slice sx = 128
    vi.clearAllMocks()
    panel.activeTab = 0
    panel.draw(mockCtx, {
      borderRightImg: null,
      skillPointsImg: mockSpImg,
      buySellBtnImg: null,
      skillTabsImg: mockTabsImg,
    }, mockFont)

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockTabsImg,
      128, // sx = 128
      0,
      64,
      432,
      SKILL_PANEL_ORIGIN.x + 256,
      SKILL_PANEL_ORIGIN.y,
      64,
      432,
    )
  })

  it('aligns top-right remaining skill points inside built-in DC6 recessed box and omits redundant bottom skillpoints banner', () => {
    // Explicitly seeded legacy Sorceress tree (the panel starts class-less until the server assigns it).
    const panel = createDemoSkillTree()
    panel.visible = true
    panel.unspentSkillPoints = 12

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D

    const mockFont = {
      drawText: vi.fn(),
      measureText: vi.fn(() => 50),
    } as unknown as D2FontRenderer

    const mockTabsImg = {
      complete: true,
      naturalWidth: 192,
      naturalHeight: 432,
    } as unknown as HTMLImageElement

    const mockSpImg = {
      complete: true,
      naturalWidth: 135,
      naturalHeight: 23,
    } as unknown as HTMLImageElement

    panel.draw(mockCtx, {
      borderRightImg: null,
      skillPointsImg: mockSpImg,
      buySellBtnImg: null,
      skillTabsImg: mockTabsImg,
    }, mockFont)

    // Top-right remaining skill points 3-line TBL header (StrSklTree1..StrSklTree3) and number aligned to recessed stone box center (ox + 276, oy + 78)
    expect(mockFont.drawText).toHaveBeenCalledWith(
      mockCtx,
      '技能',
      SKILL_PANEL_ORIGIN.x + 276,
      SKILL_PANEL_ORIGIN.y + 26,
      expect.objectContaining({ font: 'font8', color: 'gold', align: 'center' }),
    )
    expect(mockFont.drawText).toHaveBeenCalledWith(
      mockCtx,
      '選擇',
      SKILL_PANEL_ORIGIN.x + 276,
      SKILL_PANEL_ORIGIN.y + 38,
      expect.objectContaining({ font: 'font8', color: 'gold', align: 'center' }),
    )
    expect(mockFont.drawText).toHaveBeenCalledWith(
      mockCtx,
      '剩餘',
      SKILL_PANEL_ORIGIN.x + 276,
      SKILL_PANEL_ORIGIN.y + 50,
      expect.objectContaining({ font: 'font8', color: 'gold', align: 'center' }),
    )
    expect(mockFont.drawText).toHaveBeenCalledWith(
      mockCtx,
      '12',
      SKILL_PANEL_ORIGIN.x + 276,
      SKILL_PANEL_ORIGIN.y + 78,
      expect.objectContaining({ font: 'font16', color: 'red', align: 'center' }),
    )

    // Redundant bottom skillpoints.png banner is NOT drawn
    expect(mockCtx.drawImage).not.toHaveBeenCalledWith(
      mockSpImg,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })

  it('places and hit-tests the 32x32 Close Button inside the authentic per-tab DC6 stone socket', () => {
    // Explicitly seeded legacy Sorceress tree (the panel starts class-less until the server assigns it).
    const panel = createDemoSkillTree()
    panel.visible = true

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D

    const mockFont = {
      drawText: vi.fn(),
      measureText: vi.fn(() => 50),
    } as unknown as D2FontRenderer

    const mockBuySellImg = {
      complete: true,
      naturalWidth: 512,
      naturalHeight: 32,
    } as unknown as HTMLImageElement

    // Default Sorceress Cold tab (tab 2): socket at ox + 171, oy + 385
    expect(SKILL_CLOSE_BTN_BOUNDS).toEqual({
      x: SKILL_PANEL_ORIGIN.x + 171,
      y: SKILL_PANEL_ORIGIN.y + 385,
      w: 32,
      h: 32,
    })
    expect(panel.getCloseButtonBounds()).toEqual(SKILL_CLOSE_BTN_BOUNDS)

    panel.draw(mockCtx, {
      borderRightImg: null,
      skillPointsImg: null,
      buySellBtnImg: mockBuySellImg,
    }, mockFont)

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockBuySellImg,
      10 * 32,
      0,
      32,
      32,
      SKILL_PANEL_ORIGIN.x + 171,
      SKILL_PANEL_ORIGIN.y + 385,
      32,
      32,
    )

    // Switch to Sorceress Fire tab (tab 0): socket at ox + 16, oy + 385
    panel.activeTab = 0
    expect(panel.getCloseButtonBounds()).toEqual({
      x: SKILL_PANEL_ORIGIN.x + 16,
      y: SKILL_PANEL_ORIGIN.y + 385,
      w: 32,
      h: 32,
    })

    // Close button follows 1.13c semantics (issue #927): mouse-down latches the
    // depressed socket cell, the panel closes on mouse-up landing back on it.
    expect(panel.handleClick(SKILL_PANEL_ORIGIN.x + 16 + 16, SKILL_PANEL_ORIGIN.y + 385 + 16)).toBe(true)
    expect(panel.visible).toBe(true)
    expect(panel.handleMouseUp(SKILL_PANEL_ORIGIN.x + 16 + 16, SKILL_PANEL_ORIGIN.y + 385 + 16)).toBe(true)
    expect(panel.visible).toBe(false)

    // Verify all 7 classes x 3 tabs have valid authentic socket X offsets (16, 101, or 171)
    for (const offsets of Object.values(SKILL_CLOSE_BTN_OFFSET_X)) {
      expect(offsets).toHaveLength(3)
      for (const ox of offsets) {
        expect([16, 101, 171]).toContain(ox)
      }
    }
  })

  it('displays total effective skill level in font8 inside stone sockets instead of x+y format', () => {
    const panel = new SkillTreePanel('sor')
    panel.visible = true
    panel.activeTab = 0 // Fire Spells
    panel.hardPoints.set(36, 1) // Fire Bolt: hard = 1
    panel.bonusLevels.set(36, 2) // Fire Bolt: bonus = +2 -> total = 3
    panel.hardPoints.set(37, 1) // Warmth: hard = 1, bonus = 0 -> total = 1
    panel.bonusLevels.set(41, 2) // Inferno: hard = 0, bonus = +2 -> unlearned (empty)

    expect(SkillTreePanel.formatSkillSocketLabel(1, 2)).toEqual({
      text: '3',
      font: 'font8',
      color: 'blue',
    })
    expect(SkillTreePanel.formatSkillSocketLabel(1, 0)).toEqual({
      text: '1',
      font: 'font8',
      color: 'white',
    })
    expect(SkillTreePanel.formatSkillSocketLabel(0, 2)).toBeNull()

    expect(panel.formatSkillSocketLabel(36)).toBe('3')
    expect(panel.formatSkillSocketLabel(37)).toBe('1')
    expect(panel.formatSkillSocketLabel(41)).toBe('')

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D

    const mockFont = {
      drawText: vi.fn(),
      measureText: vi.fn(() => 50),
    } as unknown as D2FontRenderer

    panel.draw(mockCtx, {
      borderRightImg: null,
      skillPointsImg: null,
      buySellBtnImg: null,
      skillTabsImg: null,
    }, mockFont)

    const fbPos = SkillTreePanel.nodeScreenPos(panel.getSkillTree().find(n => n.skillId === 36)!)
    const warmthPos = SkillTreePanel.nodeScreenPos(panel.getSkillTree().find(n => n.skillId === 37)!)
    const infernoPos = SkillTreePanel.nodeScreenPos(panel.getSkillTree().find(n => n.skillId === 41)!)

    expect(mockFont.drawText).toHaveBeenCalledWith(
      mockCtx,
      '3',
      fbPos.x + 51,
      fbPos.y + 59,
      expect.objectContaining({ font: 'font8', color: 'blue', align: 'center' }),
    )
    expect(mockFont.drawText).toHaveBeenCalledWith(
      mockCtx,
      '1',
      warmthPos.x + 51,
      warmthPos.y + 59,
      expect.objectContaining({ font: 'font8', color: 'white', align: 'center' }),
    )
    expect(mockFont.drawText).not.toHaveBeenCalledWith(
      mockCtx,
      expect.anything(),
      infernoPos.x + 51,
      infernoPos.y + 59,
      expect.anything(),
    )
  })
})

describe('Issue #864: 1.13c 100% Opaque Dimmed Skill Icons (D2Client.dll 0x6FB28820 nDrawMode=5, nColor=5)', () => {
  it('remaps ACT1/pal.pl2 palette colors through textShifts[5] and non-palette RGB via RGB(105,105,105) luminance', () => {
    // Authentic ACT1/pal.pl2 entries
    expect(remapSkillIconPixelToTextShift5(244, 244, 244)).toEqual([100, 100, 100]) // index 32 -> shift5[32]=27
    expect(remapSkillIconPixelToTextShift5(188, 0, 0)).toEqual([76, 76, 76]) // index 10 -> shift5[10]=195
    expect(remapSkillIconPixelToTextShift5(204, 152, 80)).toEqual([84, 84, 84]) // index 100 -> shift5[100]=199
    expect(remapSkillIconPixelToTextShift5(84, 120, 188)).toEqual([32, 32, 32]) // index 150 -> shift5[150]=179

    // Synthetic / textRgb[5] fallback (RGB(105, 105, 105) luminance scale 105/255)
    expect(remapSkillIconPixelToTextShift5(255, 255, 255)).toEqual([105, 105, 105])
    expect(remapSkillIconPixelToTextShift5(255, 0, 0)).toEqual([105, 105, 105])
    expect(remapSkillIconPixelToTextShift5(0, 0, 0)).toEqual([0, 0, 0])
  })

  it('draws all skill icons at 100% opacity (globalAlpha === 1) and remaps dimmed icons via offscreen getImageData/putImageData with alpha=255', () => {
    const prevDoc = (globalThis as { document?: unknown }).document
    const createdCanvases: Array<{
      width: number
      height: number
      pixels: Uint8ClampedArray
      getImageDataSpy: ReturnType<typeof vi.fn>
      putImageDataSpy: ReturnType<typeof vi.fn>
    }> = []

    ;(globalThis as { document?: unknown }).document = {
      createElement(tag: string) {
        if (tag !== 'canvas') return {}
        const pixels = new Uint8ClampedArray(48 * 48 * 4)
        // Pixel 0: transparent corner (0,0,0,0) -> must remain alpha=0
        pixels[0] = 0
        pixels[1] = 0
        pixels[2] = 0
        pixels[3] = 0
        // Pixel 1: bright white (255, 255, 255, 255) -> must become (105, 105, 105, 255)
        pixels[4] = 255
        pixels[5] = 255
        pixels[6] = 255
        pixels[7] = 255
        // Pixel 2: ACT1/pal.pl2 fire red index 10 (188, 0, 0, 180) -> must become (76, 76, 76, 255)
        pixels[8] = 188
        pixels[9] = 0
        pixels[10] = 0
        pixels[11] = 180

        const getImageDataSpy = vi.fn(() => ({ data: pixels, width: 48, height: 48 }))
        const putImageDataSpy = vi.fn((imgData: { data: Uint8ClampedArray }) => {
          pixels.set(imgData.data)
        })
        const canvasObj = {
          width: 48,
          height: 48,
          pixels,
          getImageDataSpy,
          putImageDataSpy,
          getContext(type: string) {
            if (type !== '2d') return null
            return {
              imageSmoothingEnabled: true,
              globalAlpha: 1,
              globalCompositeOperation: 'source-over',
              fillStyle: '',
              drawImage: vi.fn(),
              getImageData: getImageDataSpy,
              putImageData: putImageDataSpy,
              fillRect: vi.fn(),
            }
          },
        }
        createdCanvases.push(canvasObj)
        return canvasObj
      },
    }

    try {
      const panel = new SkillTreePanel('sor')
      panel.visible = true
      panel.activeTab = 0 // Fire Spells
      panel.characterLevel = 6
      panel.unspentSkillPoints = 0 // unspentSkillPoints == 0: hard > 0 bright, hard == 0 dimmed

      const makeMockIcon = (id: number) =>
        ({
          id,
          complete: true,
          naturalWidth: 48,
          naturalHeight: 48,
          width: 48,
          height: 48,
        }) as unknown as HTMLImageElement

      const iconFireBolt = makeMockIcon(36)
      const iconWarmth = makeMockIcon(37)
      panel.setSkillIcon(36, iconFireBolt)
      panel.setSkillIcon(37, iconWarmth)

      panel.hardPoints.set(36, 1) // Learned -> normal bright (nColor = 0)
      panel.hardPoints.set(37, 0) // Unlearned -> dimmed (nColor = 5)

      const recordedDraws: Array<{ img: unknown; x: number; y: number; alpha: number }> = []
      const mockCtx = {
        globalAlpha: 1,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        save: vi.fn(),
        restore: vi.fn(),
        drawImage: vi.fn(function (this: { globalAlpha: number }, img: unknown, x: number, y: number) {
          recordedDraws.push({ img, x, y, alpha: this.globalAlpha })
        }),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D

      const mockFont = {
        drawText: vi.fn(),
        measureText: vi.fn(() => 50),
      } as unknown as D2FontRenderer

      panel.draw(
        mockCtx,
        { borderRightImg: null, skillPointsImg: null, buySellBtnImg: null, skillTabsImg: null },
        mockFont,
      )

      const fbPos = SkillTreePanel.nodeScreenPos(panel.getSkillTree().find(n => n.skillId === 36)!)
      const warmthPos = SkillTreePanel.nodeScreenPos(panel.getSkillTree().find(n => n.skillId === 37)!)

      const fbDraw = recordedDraws.find(d => d.x === fbPos.x && d.y === fbPos.y)
      const warmthDraw = recordedDraws.find(d => d.x === warmthPos.x && d.y === warmthPos.y)

      expect(fbDraw).toBeDefined()
      expect(warmthDraw).toBeDefined()

      // Both learned and unlearned skill icons MUST render at 100% opacity (nDrawMode = 5, globalAlpha === 1)
      expect(fbDraw!.alpha).toBe(1)
      expect(warmthDraw!.alpha).toBe(1)

      // Learned skill (36) draws the original bright icon; unlearned skill (37) draws the dimmed offscreen canvas
      expect(fbDraw!.img).toBe(iconFireBolt)
      expect(createdCanvases).toHaveLength(1)
      expect(warmthDraw!.img).toBe(createdCanvases[0])

      // Verify dimmed pixel buffer: transparent pixel stays alpha=0, non-transparent pixels become alpha=255 + textShifts[5] RGB
      const dimmedPixels = createdCanvases[0]!.pixels
      expect(Array.from(dimmedPixels.slice(0, 4))).toEqual([0, 0, 0, 0])
      expect(Array.from(dimmedPixels.slice(4, 8))).toEqual([105, 105, 105, 255])
      expect(Array.from(dimmedPixels.slice(8, 12))).toEqual([76, 76, 76, 255])

      // Second draw frame reuses the cached dimmed canvas without recomputing getImageData
      panel.draw(
        mockCtx,
        { borderRightImg: null, skillPointsImg: null, buySellBtnImg: null, skillTabsImg: null },
        mockFont,
      )
      expect(createdCanvases).toHaveLength(1)
      expect(createdCanvases[0]!.getImageDataSpy).toHaveBeenCalledTimes(1)
    } finally {
      ;(globalThis as { document?: unknown }).document = prevDoc
    }
  })

  it('enforces exact 1.13c dimming rules for both unspentSkillPoints == 0 and unspentSkillPoints > 0', () => {
    const panel = new SkillTreePanel('sor')
    panel.activeTab = 0 // Fire Spells
    panel.characterLevel = 12

    // 1. unspentSkillPoints == 0: only learned skills (hard > 0) are bright; all unlearned skills (hard == 0) are dimmed
    panel.unspentSkillPoints = 0
    panel.hardPoints.set(36, 1) // Fire Bolt learned (hard = 1)
    panel.hardPoints.set(37, 0) // Warmth unlearned (reqLevel 1, no prereqs, but 0 unspent points)
    expect(panel.isSkillDimmed(36)).toBe(false)
    expect(panel.isSkillDimmed(37)).toBe(true)

    // 2. unspentSkillPoints > 0: learned OR allocatable skills are bright; non-allocatable unlearned skills are dimmed
    panel.unspentSkillPoints = 1
    // Fire Bolt (36): learned (hard = 1) -> bright
    expect(panel.isSkillDimmed(36)).toBe(false)
    // Warmth (37): unlearned (hard = 0), reqLevel 1 <= charLevel 12, no prereqs -> canAllocate == true -> bright
    expect(panel.canAllocate(37)).toBe(true)
    expect(panel.isSkillDimmed(37)).toBe(false)
    // Blaze (46): unlearned (hard = 0), reqLevel 12 <= charLevel 12, but prereq Inferno (41) is 0 -> canAllocate == false -> dimmed
    expect(panel.canAllocate(46)).toBe(false)
    expect(panel.isSkillDimmed(46)).toBe(true)
    // Once Inferno (41) has 1 hard point, Blaze (46) becomes allocatable -> bright!
    panel.hardPoints.set(41, 1)
    expect(panel.canAllocate(46)).toBe(true)
    expect(panel.isSkillDimmed(46)).toBe(false)
    // Fire Wall (51): reqLevel 18 > charLevel 12 -> canAllocate == false -> dimmed
    expect(panel.canAllocate(51)).toBe(false)
    expect(panel.isSkillDimmed(51)).toBe(true)
    // Learned skill that cannot currently be allocated further (e.g. charLevel < reqLevel + hardPoints):
    // Blaze (46) with hard = 1 at charLevel 12 requires charLevel 13 for next point -> canAllocate(46) == false,
    // but hard > 0 so it remains bright (not dimmed) per #864 spec!
    panel.hardPoints.set(46, 1)
    expect(panel.canAllocate(46)).toBe(false)
    expect(panel.isSkillDimmed(46)).toBe(false)
  })

  it('falls back to opaque #696969 source-atop tint when canvas mock lacks getImageData', () => {
    const prevDoc = (globalThis as { document?: unknown }).document
    const fillRectSpies: Array<{ fillStyle: string; op: string }> = []

    ;(globalThis as { document?: unknown }).document = {
      createElement(tag: string) {
        if (tag !== 'canvas') return {}
        return {
          width: 48,
          height: 48,
          getContext(type: string) {
            if (type !== '2d') return null
            const state = {
              imageSmoothingEnabled: true,
              globalAlpha: 1,
              globalCompositeOperation: 'source-over',
              fillStyle: '',
              drawImage: vi.fn(),
              fillRect: vi.fn(function (this: { fillStyle: string; globalCompositeOperation: string }) {
                fillRectSpies.push({ fillStyle: this.fillStyle, op: this.globalCompositeOperation })
              }),
            }
            return state
          },
        }
      },
    }

    try {
      const panel = new SkillTreePanel('sor')
      panel.visible = true
      panel.activeTab = 0
      panel.unspentSkillPoints = 0
      panel.setSkillIcon(36, {
        complete: true,
        naturalWidth: 48,
        naturalHeight: 48,
      } as unknown as HTMLImageElement)

      const mockCtx = {
        globalAlpha: 1,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        save: vi.fn(),
        restore: vi.fn(),
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D

      const mockFont = {
        drawText: vi.fn(),
        measureText: vi.fn(() => 50),
      } as unknown as D2FontRenderer

      panel.draw(
        mockCtx,
        { borderRightImg: null, skillPointsImg: null, buySellBtnImg: null, skillTabsImg: null },
        mockFont,
      )

      expect(fillRectSpies).toEqual([{ fillStyle: '#696969', op: 'source-atop' }])
      expect(mockCtx.globalAlpha).toBe(1)
    } finally {
      ;(globalThis as { document?: unknown }).document = prevDoc
    }
  })
})


