const WARN_BELOW = 0.4
const FULL_AT = 0.12

export const lowLifeIntensity = (hp: number, maxHp: number): number =>
  maxHp <= 0 || hp <= 0 ? 0 : Math.max(0, Math.min(1, (WARN_BELOW - hp / maxHp) / (WARN_BELOW - FULL_AT)))

export const lowLifePulse = (intensity: number, nowMs: number): number => {
  const periodMs = 1300 - 650 * intensity
  return 0.6 + 0.4 * Math.sin((nowMs / periodMs) * Math.PI * 2)
}

export function drawLowLifeWarning(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, nowMs: number): void {
  if (intensity <= 0) return
  const alpha = (0.22 + 0.4 * intensity) * lowLifePulse(intensity, nowMs)
  const [cx, cy] = [width / 2, height / 2]
  const glow = ctx.createRadialGradient(cx, cy, Math.min(width, height) * (0.42 - 0.1 * intensity), cx, cy, Math.hypot(cx, cy))
  glow.addColorStop(0, 'rgba(110, 0, 0, 0)')
  glow.addColorStop(0.7, `rgba(130, 6, 6, ${(alpha * 0.55).toFixed(3)})`)
  glow.addColorStop(1, `rgba(160, 10, 10, ${alpha.toFixed(3)})`)
  ctx.save()
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}
