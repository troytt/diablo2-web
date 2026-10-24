/**
 * Overlay.txt / Missiles.txt `Trans` -> D2gfx eDrawMode -> port blend mode (Issues #1050, #1051, #1052, #1055).
 *
 * Ground truth (kb/render/d2gfx-draw-mode-113c.md):
 * - Overlay.txt Trans is passed UNCHANGED as eDrawMode: D2Client 0x6FB1B11D `movzx ecx, byte [ebx+0x7C]` ->
 *   0x6FB1B12E `push ecx` -> 0x6FB1B143 call D2gfx #10041 (same at 0x6FB1B2B2 / 0x6FB1B2D0).
 * - Missiles.txt Trans is remapped at D2Client 0x6FB1CF32-0x6FB1CF4C: 0/empty -> 5, 1 -> 3, 2 -> 4.
 * - D2Direct3D 0x6F886B90: 0/1/2 alpha 25/50/75 %, 3 ONE/ONE additive, 4 ZERO/SRCCOLOR multiply, 5 opaque,
 *   6 and >=8 default branch alpha 0xFF (opaque), 7 opaque (hover texture).
 */
import { describe, expect, it } from 'vitest'
import {
  overlayTransToBlendMode,
  transToBlendMode,
} from '../src/client/view/unit-drawables.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import {
  drawModeToBlendMode,
  missileTransToDrawMode,
  overlayTransToDrawMode,
} from '../src/common/gfx/draw-mode.ts'

describe('[overlay trans blend] Overlay.txt Trans = D2gfx eDrawMode', () => {
  it('1. identity eDrawMode mapping 0..8', () => {
    for (let t = 0; t <= 8; t += 1) expect(overlayTransToDrawMode(t)).toBe(t)
    expect(overlayTransToBlendMode(0)).toBe('trans25')
    expect(overlayTransToBlendMode(1)).toBe('trans50')
    expect(overlayTransToBlendMode(2)).toBe('trans75')
    expect(overlayTransToBlendMode(3)).toBe('additive')
    expect(overlayTransToBlendMode(4)).toBe('burn')
    expect(overlayTransToBlendMode(5)).toBe('normal')
    expect(overlayTransToBlendMode(6)).toBe('normal')
    expect(overlayTransToBlendMode(7)).toBe('normal')
    expect(overlayTransToBlendMode(8)).toBe('normal')
  })

  it('2. compiled overlay.bin: fire_cast_2 (sorceress cast fire) is Trans 3 -> additive', () => {
    const fireCast2 = OVERLAY_TXT_ROWS.find(r => r.name === 'fire_cast_2')
    expect(fireCast2).toBeDefined()
    expect(fireCast2!.trans).toBe(3)
    expect(overlayTransToBlendMode(fireCast2!.trans)).toBe('additive')
  })

  it('3. the bulk of vanilla overlays are Trans 3 and must not render 50% translucent', () => {
    const trans3 = OVERLAY_TXT_ROWS.filter(r => r.trans === 3).length
    expect(trans3).toBeGreaterThanOrEqual(280)
  })

  it('4. overlay Trans 3 and missile Trans 1 share eDrawMode 3', () => {
    expect(missileTransToDrawMode(1)).toBe(overlayTransToDrawMode(3))
    expect(transToBlendMode(1)).toBe(overlayTransToBlendMode(3))
  })

  it('5. missile Trans 0/1/2 -> eDrawMode 5/3/4 (D2Client 0x6FB1CF32) -> normal/additive/multiply', () => {
    expect(missileTransToDrawMode(0)).toBe(5)
    expect(missileTransToDrawMode(1)).toBe(3)
    expect(missileTransToDrawMode(2)).toBe(4)
    expect(transToBlendMode(0)).toBe('normal')
    expect(transToBlendMode(undefined)).toBe('normal')
    expect(transToBlendMode(1)).toBe('additive')
    expect(transToBlendMode(2)).toBe('burn')
  })

  it('6. non-byte draw modes fail fast', () => {
    expect(() => drawModeToBlendMode(-1)).toThrow()
    expect(() => overlayTransToDrawMode(1.5)).toThrow()
    expect(() => missileTransToDrawMode(256)).toThrow()
  })
})
