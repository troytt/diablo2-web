import { drawBronzePlate, vertical } from './framed-badge.ts'
import type { D2FontRenderer } from './font.ts'

const BAR_WIDTH = 300
const BAR_HEIGHT = 13
const BAR_TOP = 4
const RATE_GAP = 6
const RATE_WINDOW_MS = 15 * 60_000
const SAMPLE_EVERY_MS = 2_000
const MIN_ELAPSED_MS = 5_000
const MS_PER_HOUR = 3_600_000
const LABEL_STYLE = { font: 'font8', align: 'center', shadow: true } as const
const GAIN_LIFE_MS = 1800
const GAIN_MERGE_MS = 250
const GAIN_DRIFT = 40
const GAIN_LINE = 16

export interface XpBarState {
  readonly level: number
  readonly xp: number
  readonly currentLevelXp: number
  readonly nextLevelXp: number
}

interface Sample {
  readonly atMs: number
  readonly xp: number
}

export class XpRateTracker {
  private samples: Sample[] = []

  record(xp: number, nowMs: number): void {
    const last = this.samples.at(-1)
    if (last && xp < last.xp) this.samples = []
    else if (last && nowMs - last.atMs < SAMPLE_EVERY_MS) return
    this.samples = [...this.samples.filter((s) => nowMs - s.atMs <= RATE_WINDOW_MS), { atMs: nowMs, xp }]
  }

  perHour(nowMs: number): number {
    const [first, last] = [this.samples[0], this.samples.at(-1)]
    if (!first || !last || nowMs - first.atMs < MIN_ELAPSED_MS) return 0
    return ((last.xp - first.xp) * MS_PER_HOUR) / (nowMs - first.atMs)
  }
}

interface XpGain {
  readonly amount: number
  readonly atMs: number
}

export class XpGainFeed {
  private lastXp: number | null = null
  private gains: XpGain[] = []

  record(xp: number, nowMs: number): void {
    const gained = this.lastXp !== null && this.lastXp > 0 ? xp - this.lastXp : 0
    this.lastXp = xp
    const live = this.gains.filter((g) => nowMs - g.atMs < GAIN_LIFE_MS)
    const last = live.at(-1)
    this.gains = gained <= 0 ? live : last && nowMs - last.atMs < GAIN_MERGE_MS ? [...live.slice(0, -1), { ...last, amount: last.amount + gained }] : [...live, { amount: gained, atMs: nowMs }]
  }

  active(nowMs: number): readonly XpGain[] {
    return this.gains.filter((g) => nowMs - g.atMs < GAIN_LIFE_MS)
  }

  isActive(nowMs: number): boolean {
    return this.active(nowMs).length > 0
  }
}

export const formatXpGain = (amount: number): string => `+${amount.toLocaleString('en-US')} xp`

export interface XpGainAnchor {
  readonly x: number
  readonly y: number
  readonly align: 'left' | 'right' | 'center'
}

export function drawXpGains(ctx: CanvasRenderingContext2D, font: D2FontRenderer, feed: XpGainFeed, nowMs: number, anchor: XpGainAnchor): void {
  const restY = anchor.y + GAIN_LINE
  const rows = [...feed.active(nowMs)].reverse().reduce<{ text: string; y: number; t: number }[]>((placed, g) => {
    const t = (nowMs - g.atMs) / GAIN_LIFE_MS
    return [...placed, { text: formatXpGain(g.amount), t, y: Math.min(restY + GAIN_DRIFT * (1 - t), (placed.at(-1)?.y ?? Infinity) - GAIN_LINE) }]
  }, [])
  ctx.save()
  for (const { text, y, t } of rows.filter((r) => r.y >= restY)) {
    ctx.globalAlpha = 1 - t * t
    font.drawText(ctx, text, anchor.x, Math.round(y), { font: 'font16', color: 'white', align: anchor.align, shadow: true })
  }
  ctx.restore()
}

export const xpProgress = ({ xp, currentLevelXp, nextLevelXp }: XpBarState): number =>
  nextLevelXp > currentLevelXp ? Math.max(0, Math.min(1, (xp - currentLevelXp) / (nextLevelXp - currentLevelXp))) : 1

export const xpBarLabel = (state: XpBarState, lang: 'ENG' | 'CHI'): string =>
  `${lang === 'ENG' ? 'Level' : '等级'} ${state.level}: ${(Math.floor(xpProgress(state) * 1000) / 10).toFixed(1)}%`

export const formatXpRate = (perHour: number): string => {
  const rate = Math.max(0, Math.floor(perHour))
  const amount = rate >= 1_000_000 ? `${(Math.floor(rate / 100_000) / 10).toFixed(1)}m` : rate >= 10_000 ? `${Math.floor(rate / 1000)}k` : String(rate)
  return `${amount} xp/hr`
}

export const formatTimeToLevel = (state: XpBarState, perHour: number, lang: 'ENG' | 'CHI'): string => {
  const remaining = state.nextLevelXp - state.xp
  if (state.nextLevelXp <= state.currentLevelXp || remaining <= 0) return lang === 'ENG' ? 'Max level' : '已满级'
  if (perHour <= 0) return lang === 'ENG' ? 'No experience gained yet' : '尚未获得经验'
  const seconds = Math.round((remaining / perHour) * 3600)
  const [h, m, s] = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${h > 0 ? `${h}:${pad(m)}` : m}:${pad(s)}`
  return lang === 'ENG' ? `${clock} until next level` : `距下一级 ${clock}`
}

export const xpRatePlacement = (barX: number, rateW: number, baseline: number, rightLimit: number): readonly [number, number] =>
  barX + BAR_WIDTH + 2 * RATE_GAP + rateW <= rightLimit ? [barX + BAR_WIDTH + RATE_GAP, baseline]
  : barX - 2 * RATE_GAP - rateW >= 0 ? [barX - RATE_GAP - rateW, baseline]
  : [Math.round(barX + (BAR_WIDTH - rateW) / 2), baseline + BAR_HEIGHT]

export interface XpBarExtras {
  readonly perHour: number
  readonly mouseX: number
  readonly mouseY: number
  readonly rightLimit?: number
}

export const xpGainAnchor = (barX: number, rateX: number, rateW: number, rateBaseline: number): XpGainAnchor =>
  rateX >= barX + BAR_WIDTH ? { x: rateX, y: rateBaseline, align: 'left' }
  : rateX + rateW <= barX ? { x: rateX + rateW, y: rateBaseline, align: 'right' }
  : { x: rateX + rateW / 2, y: rateBaseline, align: 'center' }

function drawTrack(ctx: CanvasRenderingContext2D, x: number, progress: number): void {
  drawBronzePlate(ctx, x, BAR_TOP, BAR_WIDTH, BAR_HEIGHT)
  const [left, top, width, height] = [x + 2, BAR_TOP + 2, Math.round((BAR_WIDTH - 4) * progress), BAR_HEIGHT - 4]
  if (width > 0) {
    ctx.fillStyle = vertical(ctx, top, height, '#e2c27a', '#7a5a24')
    ctx.fillRect(left, top, width, height)
    ctx.fillStyle = 'rgba(255, 244, 210, 0.45)'
    ctx.fillRect(left, top, width, 1)
    ctx.fillStyle = 'rgba(255, 236, 180, 0.7)'
    ctx.fillRect(left + width - 1, top, 1, height)
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  for (let tick = 1; tick < 10; tick++) ctx.fillRect(left + Math.round(((BAR_WIDTH - 4) * tick) / 10), top + 1, 1, height - 2)
}

export function drawXpBar(ctx: CanvasRenderingContext2D, font: D2FontRenderer, state: XpBarState, viewportWidth: number, lang: 'ENG' | 'CHI', extras?: XpBarExtras): XpGainAnchor | null {
  const x = Math.round((viewportWidth - BAR_WIDTH) / 2)
  const baseline = BAR_TOP + BAR_HEIGHT - 2
  ctx.save()
  drawTrack(ctx, x, xpProgress(state))
  font.drawText(ctx, xpBarLabel(state, lang), x + BAR_WIDTH / 2, baseline, { ...LABEL_STYLE, color: 'white' })
  ctx.restore()
  if (!extras) return null
  ctx.save()
  const rateText = formatXpRate(extras.perHour)
  const rateW = font.renderedWidth(ctx, rateText, 'font8')
  const [rateX, rateBaseline] = xpRatePlacement(x, rateW, baseline, extras.rightLimit ?? viewportWidth)
  font.drawText(ctx, rateText, rateX, rateBaseline, { ...LABEL_STYLE, color: 'gold', align: 'left' })
  if (extras.mouseX >= Math.min(x, rateX) && extras.mouseX <= Math.max(x + BAR_WIDTH, rateX + rateW) && extras.mouseY >= BAR_TOP && extras.mouseY <= rateBaseline + 2) drawTimeToLevelTooltip(ctx, font, formatTimeToLevel(state, extras.perHour, lang), rateX + rateW / 2, rateBaseline + 5, viewportWidth)
  ctx.restore()
  return xpGainAnchor(x, rateX, rateW, rateBaseline)
}

function drawTimeToLevelTooltip(ctx: CanvasRenderingContext2D, font: D2FontRenderer, text: string, anchorX: number, top: number, viewportWidth: number): void {
  const width = font.renderedWidth(ctx, text, 'font8') + 12
  const left = Math.max(4, Math.min(viewportWidth - width - 4, Math.round(anchorX - width / 2)))
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.fillRect(left, top, width, 15)
  font.drawText(ctx, text, left + width / 2, top + 11, { ...LABEL_STYLE, color: 'white' })
}
