import type { D2ColorCode, D2FontRenderer } from './font.ts'

export const BADGE_BASELINE_Y = 500
const HEIGHT = 17
const PIP_SPACE = 15
const PAD_RIGHT = 8
const KEY_GAP = 6
const KEY_PAD = 4

export interface FramedBadge {
  readonly label: string
  readonly color: D2ColorCode
  readonly pip: string | null
  readonly hint?: string
}

const textWidth = (ctx: CanvasRenderingContext2D, font: D2FontRenderer, text: string) => font.renderedWidth(ctx, text, 'font8')

export const vertical = (ctx: CanvasRenderingContext2D, top: number, height: number, from: string, to: string) => {
  const gradient = ctx.createLinearGradient(0, top, 0, top + height)
  gradient.addColorStop(0, from)
  gradient.addColorStop(1, to)
  return gradient
}

export const framedBadgeWidth = (ctx: CanvasRenderingContext2D, font: D2FontRenderer, { label, hint }: FramedBadge): number =>
  PIP_SPACE + textWidth(ctx, font, label) + (hint ? KEY_GAP + textWidth(ctx, font, hint) + KEY_PAD * 2 : 0) + PAD_RIGHT

export function drawBronzePlate(ctx: CanvasRenderingContext2D, left: number, top: number, width: number, height: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillRect(left - 1, top - 1, width + 2, height + 2)
  ctx.fillStyle = vertical(ctx, top, height, 'rgba(38, 30, 19, 0.93)', 'rgba(9, 7, 4, 0.93)')
  ctx.fillRect(left, top, width, height)
  ctx.lineWidth = 1
  ctx.strokeStyle = vertical(ctx, top, height, '#b09660', '#4c3d24')
  ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1)
  ctx.strokeStyle = 'rgba(255, 228, 168, 0.08)'
  ctx.strokeRect(left + 1.5, top + 1.5, width - 3, height - 3)
  ctx.fillStyle = '#d8bc78'
  for (const [x, y] of [[left, top], [left + width - 2, top], [left, top + height - 2], [left + width - 2, top + height - 2]] as const) ctx.fillRect(x, y, 2, 2)
}

function drawPip(ctx: CanvasRenderingContext2D, x: number, y: number, color: string | null): void {
  ctx.beginPath()
  ctx.moveTo(x, y - 4)
  ctx.lineTo(x + 4, y)
  ctx.lineTo(x, y + 4)
  ctx.lineTo(x - 4, y)
  ctx.closePath()
  ctx.save()
  if (color) Object.assign(ctx, { shadowColor: color, shadowBlur: 7 })
  ctx.fillStyle = color ?? '#2a241a'
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = color ? 'rgba(255, 255, 255, 0.35)' : '#5e4c2e'
  ctx.stroke()
}

function drawKeycap(ctx: CanvasRenderingContext2D, font: D2FontRenderer, hint: string, left: number, top: number, baseline: number): void {
  const width = textWidth(ctx, font, hint) + KEY_PAD * 2
  const height = HEIGHT - 6
  ctx.fillStyle = vertical(ctx, top, height, 'rgba(92, 78, 52, 0.55)', 'rgba(30, 24, 15, 0.55)')
  ctx.fillRect(left, top, width, height)
  ctx.fillStyle = 'rgba(200, 170, 110, 0.35)'
  ctx.fillRect(left, top, width, 1)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(left, top + height - 1, width, 1)
  font.drawText(ctx, hint, left + width / 2, baseline, { font: 'font8', color: 'tan', align: 'center', shadow: true })
}

export function drawFramedBadge(ctx: CanvasRenderingContext2D, font: D2FontRenderer, badge: FramedBadge, centerX: number, baseline: number): void {
  const width = framedBadgeWidth(ctx, font, badge)
  const [left, top] = [Math.round(centerX - width / 2), Math.round(baseline - HEIGHT + 5)]
  ctx.save()
  drawBronzePlate(ctx, left, top, width, HEIGHT)
  drawPip(ctx, left + 8.5, top + HEIGHT / 2, badge.pip)
  const labelW = textWidth(ctx, font, badge.label)
  font.drawText(ctx, badge.label, left + PIP_SPACE + labelW / 2, baseline, { font: 'font8', color: badge.color, align: 'center', shadow: true })
  if (badge.hint) drawKeycap(ctx, font, badge.hint, left + PIP_SPACE + labelW + KEY_GAP, top + 3, baseline)
  ctx.restore()
}
