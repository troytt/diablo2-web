/**
 * D2gfx eDrawMode resolution for Missiles.txt / Overlay.txt `Trans` (Diablo II 1.13c).
 *
 * Ground truth (kb/render/d2gfx-draw-mode-113c.md):
 * - Overlay.txt: D2Client reads `pOverlayTxt+0x7C` (Trans) at 0x6FB1B11D / 0x6FB1B2B2 and pushes it UNCHANGED as the
 *   eDrawMode argument of D2gfx #10041 DrawCelContext (0x6FB1B143 / 0x6FB1B2D0). D2gfx 0x6FA8B080 forwards it as-is.
 * - Missiles.txt: D2Client 0x6FB1CF2A-0x6FB1CF87 reads `missiles.bin+0x18D` (Trans) and remaps it:
 *   `edx=5; if (cl==1) edx=3; if (cl==2) edx=4;` (edx=7 while the missile is hovered) before calling #10041.
 * - D2Direct3D 0x6F886B90 per eDrawMode:
 *   0/1/2 SRCALPHA/INVSRCALPHA with vertex alpha 0x40/0x80/0xC0 (25/50/75 %), 3 ONE/ONE (additive, 0x6F886BF4),
 *   4 ZERO/SRCCOLOR (multiply, 0x6F886C41), 5 blend off (opaque, 0x6F886BA7), 6 and >=8 default branch with alpha 0xFF
 *   (opaque), 7 opaque with the brightened (selected unit) texture variant. Palette index 0 is the only transparent
 *   texel in every mode (no black colour-keying).
 */

/** Canonical 6-entry set of port blend modes that a D2gfx eDrawMode resolves to. */
export const D2_DRAW_MODE_BLENDS = [
  'normal',
  'additive',
  'trans25',
  'trans50',
  'trans75',
  'burn',
] as const

/** Port blend mode a D2gfx eDrawMode resolves to (a subset of the client renderer's DrawBlendMode). */
export type D2DrawModeBlend = (typeof D2_DRAW_MODE_BLENDS)[number]

function assertByte(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(`${what} must be a byte, got ${String(value)}`)
  }
}

/**
 * Overlay.txt `Trans` -> eDrawMode: identity (0x6FB1B11D `movzx ecx, byte [ebx+0x7C]` -> 0x6FB1B12E `push ecx`).
 */
export function overlayTransToDrawMode(trans: number): number {
  assertByte(trans, 'Overlay.txt Trans')
  return trans
}

/**
 * Missiles.txt `Trans` -> eDrawMode (D2Client 0x6FB1CF32-0x6FB1CF4C): 1 -> 3, 2 -> 4, anything else (0 / empty) -> 5.
 * The hover-highlight override (eDrawMode 7) is a UI state, not a table value, and is not modelled here.
 */
export function missileTransToDrawMode(trans: number): number {
  assertByte(trans, 'Missiles.txt Trans')
  if (trans === 1) return 3
  if (trans === 2) return 4
  return 5
}

/**
 * eDrawMode -> port blend mode, from the D2Direct3D 0x6F886B90 blend states:
 * 0 trans25, 1 trans50, 2 trans75, 3 additive (ONE,ONE), 4 'burn' = multiply (ZERO,SRC_COLOR; D2MOO name
 * DRAWMODE_BURN), 5 normal, 6 normal (alpha 0xFF), 7 normal (opaque; the hover-brightened texture variant is a UI
 * state), >=8 normal (default branch alpha 0xFF; GDI `ja` -> direct copy).
 */
export function drawModeToBlendMode(drawMode: number): D2DrawModeBlend {
  assertByte(drawMode, 'eDrawMode')
  switch (drawMode) {
    case 0:
      return 'trans25'
    case 1:
      return 'trans50'
    case 2:
      return 'trans75'
    case 3:
      return 'additive'
    case 4:
      return 'burn'
    default:
      return 'normal'
  }
}

/** Overlay.txt `Trans` -> port blend mode (identity eDrawMode). */
export function overlayTransToDrawBlend(trans: number): D2DrawModeBlend {
  return drawModeToBlendMode(overlayTransToDrawMode(trans))
}

/** Missiles.txt `Trans` -> port blend mode (0 normal, 1 additive, 2 multiply/'burn'). */
export function missileTransToDrawBlend(trans: number): D2DrawModeBlend {
  return drawModeToBlendMode(missileTransToDrawMode(trans))
}
