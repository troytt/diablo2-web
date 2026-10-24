/**
 * Diablo II v1.13c Life & Mana Globe and `overlap.dc6` Coordinate Alignment Tests (Issue #863).
 *
 * Ground Truth:
 * - `D2Client.dll 0x6fad7bd0` (`UI_DrawLifeGlobe`):
 *   - Life liquid (`Hlthmana.dc6` frame 0 / poison frame 2, `80x80`):
 *     `xLeft = 29` (`0x1D`), `yBottom = SCREEN_HEIGHT - 13` (`587` at 800x600 -> `yTop = 507`; `467` at 640x480 -> `yTop = 387`).
 *   - Left gargoyle overlap (`overlap.dc6` frame 0, `82x88`):
 *     `xLeft = 28` (`0x1C`), `yBottom = SCREEN_HEIGHT - 5` (`595` at 800x600 -> `yTop = 507`; `475` at 640x480 -> `yTop = 387`).
 * - `D2Client.dll 0x6fad7a90` (`UI_DrawManaGlobe`):
 *   - Mana liquid (`Hlthmana.dc6` frame 1, `80x80`):
 *     `xLeft = SCREEN_WIDTH - 111` (`689` at 800x600, `529` at 640x480),
 *     `yBottom = SCREEN_HEIGHT - 13` (`587` at 800x600 -> `yTop = 507`; `467` at 640x480 -> `yTop = 387`).
 *   - Right angel overlap (`overlap.dc6` frame 1, `82x88`):
 *     `xLeft = SCREEN_WIDTH - 110` (`690` at 800x600, `530` at 640x480),
 *     `yBottom = SCREEN_HEIGHT - 9` (`591` at 800x600 -> `yTop = 503`; `471` at 640x480 -> `yTop = 383`).
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { D2FontRenderer } from '../src/client/ui/font.ts'
import {
  GlobesHud,
  LIFE_GLOBE_BOUNDS,
  LIFE_GLOBE_BOUNDS_640,
  MANA_GLOBE_BOUNDS,
  MANA_GLOBE_BOUNDS_640,
} from '../src/client/ui/globes.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'

function createMockCanvasCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D
}

function createMockFont(): D2FontRenderer {
  return {
    drawText: vi.fn(),
    measureText: vi.fn((text: string) => text.length * 6),
  } as unknown as D2FontRenderer
}

function createMockImg(name: string, width: number, height: number): HTMLImageElement {
  return { name, width, height, complete: true, naturalWidth: width, naturalHeight: height } as unknown as HTMLImageElement
}

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath)
  // PNG IHDR starts at byte 8 (length 4, 'IHDR' 4, width 4 BE, height 4 BE)
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  }
}

describe('Diablo II v1.13c Globe & Overlap Alignment (Issue #863)', () => {
  it('defines exact 1.13c 800x600 and 640x480 Life and Mana globe bounds per D2Client.dll 0x6fad7bd0 / 0x6fad7a90', () => {
    // 800x600: yBottom = 600 - 13 = 587 -> yTop = 587 - 80 = 507
    expect(LIFE_GLOBE_BOUNDS).toEqual({ x: 29, y: 507, width: 80, height: 80 })
    expect(MANA_GLOBE_BOUNDS).toEqual({ x: 689, y: 507, width: 80, height: 80 })
    expect(LIFE_GLOBE_BOUNDS.y + LIFE_GLOBE_BOUNDS.height).toBe(600 - 13)
    expect(MANA_GLOBE_BOUNDS.x).toBe(800 - 111)
    expect(MANA_GLOBE_BOUNDS.y + MANA_GLOBE_BOUNDS.height).toBe(600 - 13)

    // 640x480: yBottom = 480 - 13 = 467 -> yTop = 467 - 80 = 387
    expect(LIFE_GLOBE_BOUNDS_640).toEqual({ x: 29, y: 387, width: 80, height: 80 })
    expect(MANA_GLOBE_BOUNDS_640).toEqual({ x: 529, y: 387, width: 80, height: 80 })
    expect(LIFE_GLOBE_BOUNDS_640.y + LIFE_GLOBE_BOUNDS_640.height).toBe(480 - 13)
    expect(MANA_GLOBE_BOUNDS_640.x).toBe(640 - 111)
    expect(MANA_GLOBE_BOUNDS_640.y + MANA_GLOBE_BOUNDS_640.height).toBe(480 - 13)
  })

  it('draws full and partial Life/Mana globes and overlap.dc6 masks at exact 800x600 1.13c coordinates', () => {
    const globes = new GlobesHud()
    globes.is640 = false
    const ctx = createMockCanvasCtx()
    const font = createMockFont()

    const lifeImg = createMockImg('globe-life', 80, 80)
    const manaImg = createMockImg('globe-mana', 80, 80)
    const poisonImg = createMockImg('globe-poison', 80, 80)
    const overlapLeftImg = createMockImg('overlap-left', 82, 88)
    const overlapRightImg = createMockImg('overlap-right', 82, 88)

    // 1. Full globes (100% HP & Mana) at 800x600
    globes.draw(
      ctx,
      { hp: 500, maxHp: 500, mana: 300, maxMana: 300 },
      { lifeImg, manaImg, poisonImg, overlapLeftImg, overlapRightImg },
      font,
    )

    // Socket bowls centered at (29 + 40, 507 + 40) = (69, 547) and (689 + 40, 507 + 40) = (729, 547)
    expect(ctx.arc).toHaveBeenCalledWith(69, 547, 38, 0, Math.PI * 2)
    expect(ctx.arc).toHaveBeenCalledWith(729, 547, 38, 0, Math.PI * 2)

    // Life liquid at (29, 507), Mana liquid at (689, 507)
    expect(ctx.drawImage).toHaveBeenCalledWith(lifeImg, 0, 0, 80, 80, 29, 507, 80, 80)
    expect(ctx.drawImage).toHaveBeenCalledWith(manaImg, 0, 0, 80, 80, 689, 507, 80, 80)

    // Overlap left at (28, 507) [yBottom = 507 + 88 = 595 = 600 - 5]
    // Overlap right at (690, 503) [xLeft = 800 - 110 = 690, yBottom = 503 + 88 = 591 = 600 - 9]
    expect(ctx.drawImage).toHaveBeenCalledWith(overlapLeftImg, 28, 507)
    expect(ctx.drawImage).toHaveBeenCalledWith(overlapRightImg, 690, 503)

    // 2. Partial globes (50% HP, 25% Mana, poisoned) anchored to yBottom = 587
    vi.clearAllMocks()
    globes.draw(
      ctx,
      { hp: 250, maxHp: 500, mana: 75, maxMana: 300, poisoned: true },
      { lifeImg, manaImg, poisonImg, overlapLeftImg, overlapRightImg },
      font,
    )

    // 50% of 80px = 40px -> srcY = 40, dstY = 507 + 40 = 547 (547 + 40 = 587 = yBottom)
    expect(ctx.drawImage).toHaveBeenCalledWith(poisonImg, 0, 40, 80, 40, 29, 547, 80, 40)
    // 25% of 80px = 20px -> srcY = 60, dstY = 507 + 60 = 567 (567 + 20 = 587 = yBottom)
    expect(ctx.drawImage).toHaveBeenCalledWith(manaImg, 0, 60, 80, 20, 689, 567, 80, 20)
  })

  it('draws Life/Mana globes and overlap.dc6 masks at exact 640x480 1.13c coordinates', () => {
    const globes = new GlobesHud()
    globes.is640 = true
    const ctx = createMockCanvasCtx()
    const font = createMockFont()

    const lifeImg = createMockImg('globe-life', 80, 80)
    const manaImg = createMockImg('globe-mana', 80, 80)
    const overlapLeftImg = createMockImg('overlap-left', 82, 88)
    const overlapRightImg = createMockImg('overlap-right', 82, 88)

    globes.draw(
      ctx,
      { hp: 100, maxHp: 100, mana: 100, maxMana: 100 },
      { lifeImg, manaImg, poisonImg: null, overlapLeftImg, overlapRightImg },
      font,
    )

    // Socket bowls centered at (29 + 40, 387 + 40) = (69, 427) and (529 + 40, 387 + 40) = (569, 427)
    expect(ctx.arc).toHaveBeenCalledWith(69, 427, 38, 0, Math.PI * 2)
    expect(ctx.arc).toHaveBeenCalledWith(569, 427, 38, 0, Math.PI * 2)

    // Life liquid at (29, 387) [yBottom = 467 = 480 - 13], Mana liquid at (529, 387)
    expect(ctx.drawImage).toHaveBeenCalledWith(lifeImg, 0, 0, 80, 80, 29, 387, 80, 80)
    expect(ctx.drawImage).toHaveBeenCalledWith(manaImg, 0, 0, 80, 80, 529, 387, 80, 80)

    // Overlap left at (28, 387) [yBottom = 387 + 88 = 475 = 480 - 5]
    // Overlap right at (530, 383) [xLeft = 640 - 110 = 530, yBottom = 383 + 88 = 471 = 480 - 9]
    expect(ctx.drawImage).toHaveBeenCalledWith(overlapLeftImg, 28, 387)
    expect(ctx.drawImage).toHaveBeenCalledWith(overlapRightImg, 530, 383)
  })

  it('enforces 1.13c boundary rules: hp=0 draws no liquid, hp=1 clamps Life to 2px (0x6fad7bd0), and mp=1 stays un-clamped (0x6fad7a90)', () => {
    const globes = new GlobesHud()
    const ctx = createMockCanvasCtx()
    const font = createMockFont()

    const lifeImg = createMockImg('globe-life', 80, 80)
    const manaImg = createMockImg('globe-mana', 80, 80)
    const poisonImg = createMockImg('globe-poison', 80, 80)
    const overlapLeftImg = createMockImg('overlap-left', 82, 88)
    const overlapRightImg = createMockImg('overlap-right', 82, 88)
    const assets = { lifeImg, manaImg, poisonImg, overlapLeftImg, overlapRightImg }

    // 1. Direct computeClipRect boundary checks (800x600 & 640x480, both 4-arg and 3-arg default)
    // hp = 0 -> clipH === 0
    expect(GlobesHud.computeClipRect(LIFE_GLOBE_BOUNDS, 0, 500, 2)).toEqual({
      srcY: 80,
      dstY: 587,
      clipH: 0,
      ratio: 0,
    })
    expect(GlobesHud.computeClipRect(LIFE_GLOBE_BOUNDS, 0, 500)).toEqual({
      srcY: 80,
      dstY: 587,
      clipH: 0,
      ratio: 0,
    })
    expect(GlobesHud.computeClipRect(LIFE_GLOBE_BOUNDS_640, 0, 500, 2)).toEqual({
      srcY: 80,
      dstY: 467,
      clipH: 0,
      ratio: 0,
    })

    // hp = 1 across maxHp = 80 and maxHp = 500 -> clamped to clipH === 2, srcY === 78
    expect(GlobesHud.computeClipRect(LIFE_GLOBE_BOUNDS, 1, 80, 2)).toEqual({
      srcY: 78,
      dstY: 585,
      clipH: 2,
      ratio: 1 / 80,
    })
    expect(GlobesHud.computeClipRect(LIFE_GLOBE_BOUNDS, 1, 80)).toEqual({
      srcY: 78,
      dstY: 585,
      clipH: 2,
      ratio: 1 / 80,
    })
    expect(GlobesHud.computeClipRect(LIFE_GLOBE_BOUNDS, 1, 500, 2)).toEqual({
      srcY: 78,
      dstY: 585,
      clipH: 2,
      ratio: 1 / 500,
    })
    expect(GlobesHud.computeClipRect(LIFE_GLOBE_BOUNDS, 1, 500)).toEqual({
      srcY: 78,
      dstY: 585,
      clipH: 2,
      ratio: 1 / 500,
    })
    expect(GlobesHud.computeClipRect(LIFE_GLOBE_BOUNDS_640, 1, 80, 2)).toEqual({
      srcY: 78,
      dstY: 465,
      clipH: 2,
      ratio: 1 / 80,
    })
    expect(GlobesHud.computeClipRect(LIFE_GLOBE_BOUNDS_640, 1, 500, 2)).toEqual({
      srcY: 78,
      dstY: 465,
      clipH: 2,
      ratio: 1 / 500,
    })

    // Mana at mp = 1, maxMp = 500 stays un-clamped (clipH === 0) per 0x6fad7a90
    expect(GlobesHud.computeClipRect(MANA_GLOBE_BOUNDS, 1, 500)).toEqual({
      srcY: 80,
      dstY: 587,
      clipH: 0,
      ratio: 1 / 500,
    })
    expect(GlobesHud.computeClipRect(MANA_GLOBE_BOUNDS_640, 1, 500)).toEqual({
      srcY: 80,
      dstY: 467,
      clipH: 0,
      ratio: 1 / 500,
    })
    // Mana at mp = 1, maxMp = 80 stays 1px (clipH === 1, srcY === 79, dstY === 586)
    expect(GlobesHud.computeClipRect(MANA_GLOBE_BOUNDS, 1, 80)).toEqual({
      srcY: 79,
      dstY: 586,
      clipH: 1,
      ratio: 1 / 80,
    })

    // 2. End-to-end GlobesHud.draw: hp = 0 -> no liquid draw (only overlapLeftImg & overlapRightImg)
    for (const is640 of [false, true]) {
      for (const poisoned of [false, true]) {
        vi.clearAllMocks()
        globes.is640 = is640
        globes.draw(ctx, { hp: 0, maxHp: 500, mana: 0, maxMana: 500, poisoned }, assets, font)
        const drawnImgs = vi.mocked(ctx.drawImage).mock.calls.map((c) => c[0])
        expect(drawnImgs).not.toContain(lifeImg)
        expect(drawnImgs).not.toContain(poisonImg)
        expect(drawnImgs).not.toContain(manaImg)
        expect(ctx.drawImage).toHaveBeenCalledTimes(2)
      }
    }

    // 3. End-to-end GlobesHud.draw at 800x600: hp = 1 (maxHp = 80 and maxHp = 500) -> dstY = 585, clipH = 2; Mana (1/500) un-clamped (no draw)
    globes.is640 = false
    for (const maxHp of [80, 500]) {
      vi.clearAllMocks()
      globes.draw(ctx, { hp: 1, maxHp, mana: 1, maxMana: 500 }, assets, font)
      expect(ctx.drawImage).toHaveBeenCalledWith(lifeImg, 0, 78, 80, 2, 29, 585, 80, 2)
      expect(vi.mocked(ctx.drawImage).mock.calls.filter((c) => c[0] === manaImg)).toHaveLength(0)
    }

    // Poisoned hp = 1, maxHp = 500 at 800x600 -> poisonImg clamped to 2px at dstY = 585
    vi.clearAllMocks()
    globes.draw(ctx, { hp: 1, maxHp: 500, mana: 1, maxMana: 500, poisoned: true }, assets, font)
    expect(ctx.drawImage).toHaveBeenCalledWith(poisonImg, 0, 78, 80, 2, 29, 585, 80, 2)
    expect(vi.mocked(ctx.drawImage).mock.calls.filter((c) => c[0] === manaImg)).toHaveLength(0)

    // Asymmetric 1px check at 800x600: hp = 1/80 clamps Life to 2px (dstY = 585), while mp = 1/80 stays 1px (dstY = 586)
    vi.clearAllMocks()
    globes.draw(ctx, { hp: 1, maxHp: 80, mana: 1, maxMana: 80 }, assets, font)
    expect(ctx.drawImage).toHaveBeenCalledWith(lifeImg, 0, 78, 80, 2, 29, 585, 80, 2)
    expect(ctx.drawImage).toHaveBeenCalledWith(manaImg, 0, 79, 80, 1, 689, 586, 80, 1)

    // 4. End-to-end GlobesHud.draw at 640x480: hp = 1 (maxHp = 80 and maxHp = 500) -> dstY = 465, clipH = 2; Mana (1/500) un-clamped (no draw)
    globes.is640 = true
    for (const maxHp of [80, 500]) {
      vi.clearAllMocks()
      globes.draw(ctx, { hp: 1, maxHp, mana: 1, maxMana: 500 }, assets, font)
      expect(ctx.drawImage).toHaveBeenCalledWith(lifeImg, 0, 78, 80, 2, 29, 465, 80, 2)
      expect(vi.mocked(ctx.drawImage).mock.calls.filter((c) => c[0] === manaImg)).toHaveLength(0)
    }
  })

  it('hit-tests globe hover centers accurately across 800x600, 640x480, and extended 1280x720 viewports', () => {
    const hud = new HudManager()

    // 800x600 viewport (barOffsetX = 0, barOffsetY = 0)
    hud.setViewportProfile('800x600')
    hud.handleMouseMove(29 + 40, 507 + 40) // (69, 547)
    expect(hud.globes.lifeHovered).toBe(true)
    expect(hud.globes.manaHovered).toBe(false)

    hud.handleMouseMove(689 + 40, 507 + 40) // (729, 547)
    expect(hud.globes.lifeHovered).toBe(false)
    expect(hud.globes.manaHovered).toBe(true)

    // 640x480 viewport (barOffsetX = 0, barOffsetY = 0)
    hud.setViewportProfile('640x480')
    hud.handleMouseMove(29 + 40, 387 + 40) // (69, 427)
    expect(hud.globes.lifeHovered).toBe(true)
    expect(hud.globes.manaHovered).toBe(false)

    hud.handleMouseMove(529 + 40, 387 + 40) // (569, 427)
    expect(hud.globes.lifeHovered).toBe(false)
    expect(hud.globes.manaHovered).toBe(true)

    // 1280x720 extended viewport (barOffsetX = (1280-800)/2 = 240, barOffsetY = 720-600 = 120)
    hud.setViewportProfile('1280x720')
    expect(hud.viewportProfile.barOffsetX).toBe(240)
    expect(hud.viewportProfile.barOffsetY).toBe(120)

    hud.handleMouseMove(240 + 69, 120 + 547)
    expect(hud.globes.lifeHovered).toBe(true)
    expect(hud.globes.manaHovered).toBe(false)

    hud.handleMouseMove(240 + 729, 120 + 547)
    expect(hud.globes.lifeHovered).toBe(false)
    expect(hud.globes.manaHovered).toBe(true)
  })

  it('verifies baked UI PNG dimensions match 1.13c Hlthmana.dc6 (80x80) and overlap.dc6 (82x88) contracts', () => {
    const uiDir = path.resolve(process.cwd(), 'public/ui')
    expect(readPngDimensions(path.join(uiDir, 'globe-life.png'))).toEqual({ width: 80, height: 80 })
    expect(readPngDimensions(path.join(uiDir, 'globe-mana.png'))).toEqual({ width: 80, height: 80 })
    expect(readPngDimensions(path.join(uiDir, 'globe-poison.png'))).toEqual({ width: 80, height: 80 })
    expect(readPngDimensions(path.join(uiDir, 'overlap-left.png'))).toEqual({ width: 82, height: 88 })
    expect(readPngDimensions(path.join(uiDir, 'overlap-right.png'))).toEqual({ width: 82, height: 88 })
    expect(readPngDimensions(path.join(uiDir, 'ctrlpnl-800.png'))).toEqual({ width: 800, height: 104 })
    expect(readPngDimensions(path.join(uiDir, 'ctrlpnl-640.png'))).toEqual({ width: 640, height: 104 })
  })
})
