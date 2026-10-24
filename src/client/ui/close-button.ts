/**
 * Shared 1.13c close-button widget for the panel `X` buttons drawn from
 * `Panel\buysellbtn.dc6` 32x32 cells: frame 10 = raised, frame 11 = pressed/depressed.
 *
 * Interaction semantics match `LevelPlusButton` (see `level-button.ts`) and the 1.13c
 * mouse driver: mouse-down only latches the depressed cell (visual), the close action
 * fires on mouse-up and only when the release lands back inside the same button —
 * dragging off the button and releasing cancels it.
 */

/** `buysellbtn.dc6` cell index of the raised (normal) close `X`. */
export const CLOSE_BTN_NORMAL_FRAME = 10

/** `buysellbtn.dc6` cell index of the pressed (depressed) close `X`. */
export const CLOSE_BTN_PRESSED_FRAME = 11

export interface CloseButtonRect {
  readonly x: number
  readonly y: number
  readonly w?: number
  readonly h?: number
  readonly width?: number
  readonly height?: number
}

/** `buysellbtn.dc6` frame pick: pressed cell 11 only while the button is held down. */
export function closeButtonFrame(pressed: boolean): number {
  return pressed ? CLOSE_BTN_PRESSED_FRAME : CLOSE_BTN_NORMAL_FRAME
}

export class PanelCloseButton {
  private pressed = false

  constructor(private readonly getRect: () => CloseButtonRect | null) {}

  get isPressed(): boolean {
    return this.pressed
  }

  contains(logicalX: number, logicalY: number): boolean {
    const r = this.getRect()
    if (!r) return false
    const w = r.w ?? r.width ?? 0
    const h = r.h ?? r.height ?? 0
    return logicalX >= r.x && logicalX <= r.x + w && logicalY >= r.y && logicalY <= r.y + h
  }

  /**
   * Mouse-down over the panel: latches the depressed cell — the close itself never
   * fires here, only on the matching `release` landing back inside the button.
   */
  press(logicalX: number, logicalY: number): void {
    this.pressed = this.contains(logicalX, logicalY)
  }

  /**
   * Mouse-up: clears the latch and reports whether the panel should close — true only
   * when the button was pressed AND the release landed back inside its rect.
   */
  release(logicalX: number, logicalY: number): boolean {
    const triggered = this.pressed && this.contains(logicalX, logicalY)
    this.pressed = false
    return triggered
  }

  /** `buysellbtn.dc6` cell index to draw right now. */
  frame(): number {
    return closeButtonFrame(this.pressed)
  }
}
