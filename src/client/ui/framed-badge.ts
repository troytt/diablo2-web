import type { D2ColorCode, D2FontRenderer } from './font.ts'

const HEIGHT = 14
const PADDING = 12
export const BADGE_BASELINE_Y = 500

export function drawFramedBadge(ctx: CanvasRenderingContext2D, font: D2FontRenderer, label: string, x: number, y: number, frame: string, color: D2ColorCode, width = font.measureText(label, 'font8') + PADDING): void {
  ctx.save()
  ctx.fillStyle = 'rgba(8, 6, 4, 0.72)'
  ctx.fillRect(x - width / 2, y - HEIGHT + 3, width, HEIGHT)
  ctx.strokeStyle = frame
  ctx.strokeRect(x - width / 2 + 0.5, y - HEIGHT + 3.5, width - 1, HEIGHT - 1)
  font.drawText(ctx, label, x, y, { font: 'font8', color, align: 'center', shadow: true })
  ctx.restore()
}
