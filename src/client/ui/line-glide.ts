const GLIDE_TIME_CONSTANT_MS = 55
const SETTLED_PX = 0.2
const STALE_AFTER_MS = 250
const MAX_GLIDE_LINES = 6

export class LineGlide {
  private offsetPx = 0
  private lastMs = Number.NEGATIVE_INFINITY
  private previousWindow: readonly string[] = []

  update(keys: readonly string[], start: number, count: number, lineHeight: number, nowMs: number): number {
    const limit = MAX_GLIDE_LINES * lineHeight
    const next = this.isFresh(nowMs) ? this.offsetPx * Math.exp(-(nowMs - this.lastMs) / GLIDE_TIME_CONSTANT_MS) + this.shiftSinceLastWindow(keys, start, lineHeight) : 0
    const clamped = Math.max(-limit, Math.min(limit, next))
    this.offsetPx = Math.abs(clamped) < SETTLED_PX ? 0 : clamped
    this.lastMs = nowMs
    this.previousWindow = keys.slice(start, start + count)
    return this.offsetPx
  }

  isMoving(nowMs: number): boolean {
    return this.offsetPx !== 0 && this.isFresh(nowMs)
  }

  private isFresh(nowMs: number): boolean {
    return nowMs - this.lastMs <= STALE_AFTER_MS
  }

  private shiftSinceLastWindow(keys: readonly string[], start: number, lineHeight: number): number {
    const position = new Map(keys.map((key, index) => [key, index]))
    const row = this.previousWindow.findIndex((key) => position.has(key))
    return row < 0 ? 0 : (row - (position.get(this.previousWindow[row]!)! - start)) * lineHeight
  }
}
