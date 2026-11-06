import { D2_COLOR_HEX, type D2ColorCode, type D2FontRenderer } from './font.ts'
import { drawBronzePlate } from './framed-badge.ts'

const LIFE_MS = 5200
const ENTER_MS = 220
const LEAVE_MS = 700
const MAX_SHOWN = 3
const GAP = 4
const PAD_X = 12
const ACCENT = 3
const TITLE_STYLE = { font: 'font16', align: 'center', shadow: true } as const
const DETAIL_STYLE = { font: 'font8', align: 'center', shadow: true, color: 'tan' } as const

export interface ToastSpec {
  readonly title: string
  readonly detail?: string | undefined
  readonly color: D2ColorCode
}

interface Toast extends ToastSpec {
  readonly atMs: number
}

export class ToastFeed {
  private toasts: Toast[] = []

  push(spec: ToastSpec, nowMs: number): void {
    this.toasts = [...this.live(nowMs), { ...spec, atMs: nowMs }].slice(-MAX_SHOWN)
  }

  live(nowMs: number): readonly Toast[] {
    return this.toasts.filter((t) => nowMs - t.atMs < LIFE_MS)
  }
}

export const toastOpacity = (ageMs: number): number =>
  ageMs < 0 || ageMs >= LIFE_MS ? 0 : Math.min(1, ageMs / ENTER_MS, (LIFE_MS - ageMs) / LEAVE_MS)

const easeOut = (t: number) => 1 - (1 - t) ** 3

function drawToast(ctx: CanvasRenderingContext2D, font: D2FontRenderer, toast: Toast, centerX: number, top: number, ageMs: number): number {
  const titleW = font.renderedWidth(ctx, toast.title, 'font16')
  const detailW = toast.detail ? font.renderedWidth(ctx, toast.detail, 'font8') : 0
  const [width, height] = [Math.round(Math.max(titleW, detailW) + PAD_X * 2 + ACCENT), toast.detail ? 34 : 22]
  const left = Math.round(centerX - width / 2)
  const y = Math.round(top - 8 * (1 - easeOut(Math.min(1, ageMs / ENTER_MS))))
  const accent = D2_COLOR_HEX[toast.color]
  ctx.save()
  ctx.globalAlpha = toastOpacity(ageMs)
  drawBronzePlate(ctx, left, y, width, height)
  ctx.save()
  Object.assign(ctx, { shadowColor: accent, shadowBlur: 8, fillStyle: accent })
  ctx.fillRect(left + 2, y + 3, ACCENT, height - 6)
  ctx.restore()
  const textX = left + ACCENT + (width - ACCENT) / 2
  font.drawText(ctx, toast.title, textX, y + 17, { ...TITLE_STYLE, color: toast.color })
  if (toast.detail) font.drawText(ctx, toast.detail, textX, y + 29, DETAIL_STYLE)
  ctx.restore()
  return height
}

export function drawToasts(ctx: CanvasRenderingContext2D, font: D2FontRenderer, feed: ToastFeed, nowMs: number, centerX: number, top: number): void {
  ;[...feed.live(nowMs)].reverse().reduce((y, toast) => y + drawToast(ctx, font, toast, centerX, y, nowMs - toast.atMs) + GAP, top)
}
