import type { UpgradeVerdict } from '../../common/items/item-comparison.ts'
import type { D2FontRenderer } from './font.ts'

const CROSS_CELL = 8
const CROSS_ARM = 3
const CROSS_LIFT = 5
const CROSS_COLOR = '#38d838'
const CROSS_EDGE = 'rgba(0, 0, 0, 0.85)'

const CROSS_COUNT: Record<UpgradeVerdict, number> = { 'much-better': 2, better: 1, unsure: 0 }
const SUFFIX: Record<UpgradeVerdict, string> = { 'much-better': ' '.repeat(3), better: ' '.repeat(2), unsure: ' ÿc;?' }

export const upgradeSuffix = (verdict: UpgradeVerdict | null): string => (verdict ? SUFFIX[verdict] : '')

export function drawUpgradeCrosses(ctx: CanvasRenderingContext2D, font: D2FontRenderer, text: string, verdict: UpgradeVerdict | null, centerX: number, baselineY: number): void {
  const count = verdict ? CROSS_COUNT[verdict] : 0
  if (count === 0) return
  const right = centerX + font.measureText(text, 'font16') / 2
  const cy = baselineY - CROSS_LIFT
  ctx.save()
  ctx.lineCap = 'square'
  Array.from({ length: count }, (_, i) => right - CROSS_CELL * (count - i) + CROSS_CELL / 2).forEach((cx) => {
    ctx.beginPath()
    ctx.moveTo(cx - CROSS_ARM, cy)
    ctx.lineTo(cx + CROSS_ARM, cy)
    ctx.moveTo(cx, cy - CROSS_ARM)
    ctx.lineTo(cx, cy + CROSS_ARM)
    ;([[CROSS_EDGE, 3.2], [CROSS_COLOR, 1.6]] as const).forEach(([strokeStyle, lineWidth]) => Object.assign(ctx, { strokeStyle, lineWidth }).stroke())
  })
  ctx.restore()
}
