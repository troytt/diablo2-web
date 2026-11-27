/**
 * PD2 HD cursor (D2GL `modules/hd_cursor.cpp`).
 *
 * Ground truth:
 * - Art: `pd2-data/Data/assets/textures/cursor/hand.png` (2432x128 = 19 frames) and `other.png`
 *   (1280x128 = 10 frames). There is no `Data/assets/atlases/hd_cursor.{png,txt}` in this PD2 build;
 *   the older notes naming those files were wrong.
 * - Renderer: D2GL (`Bayaraa/d2gl` @ `919df352`), which PD2 ships as `glide3x.dll.d2gl`; that DLL holds
 *   the string `assets\textures\cursor\hand.png`. The active `glide3x.dll` in this install is the D2DX
 *   copy (same MD5 as `glide3x.dll.d2dx`), so the HD cursor only shows when the player picks D2GL.
 *   `d2gl.json` ships `"hd_cursor": true`.
 * - D2GL loads each PNG as `frames` layers of 128x128, draws a 40x40 quad at `cursor - (1, 6)`, uses
 *   `other.png` frame `type - 1` for Identify/Buy/Sell/Repair and animates `hand.png` with the 162-step
 *   idle table below, one step per 150 ms.
 */

import type { UiDataMode } from './pd2-sgd2freeres.ts'

export const PD2_HD_CURSOR_FILES = {
  hand: { path: 'Data/assets/textures/cursor/hand.png', frames: 19, width: 2432, height: 128 },
  other: { path: 'Data/assets/textures/cursor/other.png', frames: 10, width: 1280, height: 128 },
} as const

/** Where `npm run bake -- pd2-hd-cursor` writes the sheets and `manifest.json`. */
export const PD2_HD_CURSOR_BASE_URL = '/cursor-pd2'
export const PD2_HD_CURSOR_MANIFEST_URL = `${PD2_HD_CURSOR_BASE_URL}/manifest.json`

/** Texture layer size (`texture_ci.size = { 128, 128 }`). */
export const HD_CURSOR_CELL = 128
/** On-screen quad (`glm::vec2(40.0f, 40.0f)`). */
export const HD_CURSOR_DRAW_SIZE = 40
/** Hotspot (`glm::vec2(1.0f, 6.0f)`): the quad's top-left is `cursor - offset`. */
export const HD_CURSOR_OFFSET = { x: 1, y: 6 } as const
/** Idle animation step (`last_time + 150 < cur_time`). */
export const HD_CURSOR_IDLE_STEP_MS = 150

/** `enum class CursorType` (`hd_cursor.h`). */
export enum HdCursorType {
  None = 0,
  Identify = 1,
  Buy = 2,
  Sell = 3,
  Repair = 4,
  Hand = 5,
  Press = 6,
  Idle = 7,
}

/** `hand_frames` (1-based frame numbers into `hand.png`). */
export const HD_CURSOR_HAND_IDLE_FRAMES: readonly number[] = [
  3, 4, 5, 6, 6, 6, 6, 6, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 14, 13, 14, 15, 15, 15, 15, 16, 17, 18, 19, 19, 19, 19, 19,
  19, 19, 19, 19, 18, 17, 17, 18, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 16, 15, 14, 13, 13, 13, 13, 13,
  13, 13, 13, 13, 13, 12, 11, 10, 9, 8, 7, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 14, 13, 14, 15, 15, 15, 15, 16, 17, 18, 19,
  19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 17, 18, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 16, 15, 14,
  13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
]

export interface CursorFrameRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Slice a horizontal strip of square cells; fails if the image is not exactly `frames` cells wide. */
export function sliceHdCursorStrip(width: number, height: number, frames: number): CursorFrameRect[] {
  if (height !== HD_CURSOR_CELL) throw new Error(`HD cursor strip must be ${HD_CURSOR_CELL}px tall, got ${height}`)
  if (width !== frames * HD_CURSOR_CELL) {
    throw new Error(`HD cursor strip is ${width}px wide; ${frames} frames need ${frames * HD_CURSOR_CELL}px`)
  }
  return Array.from({ length: frames }, (_, i) => ({ x: i * HD_CURSOR_CELL, y: 0, width: HD_CURSOR_CELL, height: HD_CURSOR_CELL }))
}

export interface HdCursorDraw {
  readonly sheet: 'hand' | 'other'
  /** 0-based cell index into the sheet. */
  readonly cell: number
  readonly x: number
  readonly y: number
  readonly size: number
}

/** The `HDCursor::draw` frame state machine. Feed it the cursor type each frame. */
export class HdCursorAnimator {
  private handFrame = 1
  private framePos = 0
  private lastStepMs: number | null = null

  draw(type: HdCursorType, cursorX: number, cursorY: number, nowMs: number): HdCursorDraw | null {
    if (type === HdCursorType.None) return null
    const x = cursorX - HD_CURSOR_OFFSET.x
    const y = cursorY - HD_CURSOR_OFFSET.y
    if (type >= HdCursorType.Hand) {
      if (type === HdCursorType.Idle) {
        if (this.lastStepMs === null) this.lastStepMs = nowMs
        this.handFrame = HD_CURSOR_HAND_IDLE_FRAMES[this.framePos]!
        if (this.lastStepMs + HD_CURSOR_IDLE_STEP_MS < nowMs) {
          this.framePos++
          if (this.framePos >= HD_CURSOR_HAND_IDLE_FRAMES.length) this.framePos = 0
          this.lastStepMs = nowMs
        }
      }
      if (type === HdCursorType.Hand || type === HdCursorType.Press) {
        this.framePos = 0
        if (this.handFrame > 2) {
          if (this.handFrame > 10) this.handFrame = 10
          this.handFrame--
          if (this.handFrame === 2 && type !== HdCursorType.Press) this.handFrame = 1
        } else {
          this.handFrame = type === HdCursorType.Press ? 2 : 1
        }
      }
      return { sheet: 'hand', cell: this.handFrame - 1, x, y, size: HD_CURSOR_DRAW_SIZE }
    }
    return { sheet: 'other', cell: type - 1, x, y, size: HD_CURSOR_DRAW_SIZE }
  }
}

/**
 * HD cursor on in PD2 mode (D2GL `hd_cursor`, the client default), off only for an explicit `'113c'`
 * (the DC6 cursor).
 */
export class HdCursorMode {
  private mode: UiDataMode = 'pd2'

  constructor(mode: UiDataMode = 'pd2') {
    this.setDataMode(mode)
  }

  setDataMode(mode: UiDataMode): void {
    if (mode !== '113c' && mode !== 'pd2') throw new Error(`HdCursorMode: unknown data mode ${String(mode)}`)
    this.mode = mode
  }

  getDataMode(): UiDataMode {
    return this.mode
  }

  isEnabled(): boolean {
    return this.mode === 'pd2'
  }

  /** Baked image URLs (`npm run bake -- pd2-hd-cursor`). */
  url(sheet: 'hand' | 'other'): string {
    return `${PD2_HD_CURSOR_BASE_URL}/${sheet}.png`
  }

  /** The baked manifest (`pack-pd2-hd-cursor.ts`). */
  manifestUrl(): string {
    return PD2_HD_CURSOR_MANIFEST_URL
  }
}
