/**
 * Shared 1.13c push-button widget for the `Panel\Level.dc6` `+` buttons.
 *
 * `Level.dc6` carries 3 cells of 30x30: 0 = red lit, 1 = red pressed, 2 = gray raised.
 * Both button families draw the exact same native cells — the control-panel sockets and
 * the character-sheet stat rows — only their rect positions differ.
 *
 * Interaction semantics follow the 1.13c mouse driver: mouse-down only latches the
 * pressed cell (visual), the action fires on mouse-up and only when the release lands
 * back inside the same button — dragging off the button and releasing cancels it.
 */

import type { BaseStatKey } from '../../common/units/unit-types.ts'

/** Native `Level.dc6` cell size (width = height). */
export const LEVEL_BTN_CELL_SIZE = 30

/**
 * Rect feeding a `LevelPlusButton`. Accepts both rect spellings used by the UI layer:
 * control-bar bounds use `width/height`, the char-sheet button table uses `w/h`.
 */
export interface LevelButtonRect {
  readonly x: number
  readonly y: number
  readonly w?: number
  readonly h?: number
  readonly width?: number
  readonly height?: number
}

/**
 * `Panel/Level.dc6` frame pick: gray raised (2) with no unspent points, steady lit red
 * (0) while points are unspent, pressed cell (1) only while the button is held down.
 */
export function levelButtonFrame(unspentPoints: number, pressed: boolean): number {
  if (unspentPoints <= 0) return 2
  return pressed ? 1 : 0
}

export class LevelPlusButton {
  private pressed = false

  constructor(
    readonly id: BaseStatKey | 'stat' | 'skill',
    private readonly getRect: () => LevelButtonRect,
  ) {}

  get rect(): LevelButtonRect {
    return this.getRect()
  }

  get isPressed(): boolean {
    return this.pressed
  }

  contains(logicalX: number, logicalY: number): boolean {
    const r = this.rect
    const w = r.w ?? r.width ?? 0
    const h = r.h ?? r.height ?? 0
    return logicalX >= r.x && logicalX <= r.x + w && logicalY >= r.y && logicalY <= r.y + h
  }

  /**
   * Mouse-down over the sheet/panel: latches the pressed cell, but only when the button
   * is currently lit (points unspent) — idle gray buttons never depress.
   */
  press(logicalX: number, logicalY: number, lit: boolean): void {
    this.pressed = lit && this.contains(logicalX, logicalY)
  }

  /**
   * Mouse-up: clears the latch and reports whether the action should fire — true only
   * when the button was pressed AND the release landed back inside its rect.
   */
  release(logicalX: number, logicalY: number): boolean {
    const triggered = this.pressed && this.contains(logicalX, logicalY)
    this.pressed = false
    return triggered
  }

  /** `Level.dc6` cell index to draw for the current unspent-points state. */
  frame(unspentPoints: number): number {
    return levelButtonFrame(unspentPoints, this.pressed)
  }
}
