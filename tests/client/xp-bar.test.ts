import { describe, expect, it } from 'vitest'
import { D2_EXPERIENCE_TABLE_99 } from '../../src/common/skills/formulas.ts'
import { XpGainFeed, XpRateTracker, drawXpBar, drawXpGains, formatTimeToLevel, formatXpRate, xpBarLabel, xpProgress, xpGainAnchor, xpRatePlacement } from '../../src/client/ui/xp-bar.ts'
import type { D2FontRenderer } from '../../src/client/ui/font.ts'

const canvas = (fillRect: (...r: number[]) => void = () => {}) =>
  ({ save() {}, restore() {}, strokeRect() {}, fillRect, createLinearGradient: () => ({ addColorStop() {} }) }) as unknown as CanvasRenderingContext2D
const measuring = (drawText: (_: unknown, text: string, x: number, y: number) => void) =>
  ({ drawText, measureText: (t: string) => t.length * 6, renderedWidth: (_: unknown, t: string) => t.length * 6 }) as unknown as D2FontRenderer

const at = (level: number, fraction: number) => {
  const currentLevelXp = D2_EXPERIENCE_TABLE_99[level]!
  const nextLevelXp = D2_EXPERIENCE_TABLE_99[level + 1]!
  return { level, xp: currentLevelXp + (nextLevelXp - currentLevelXp) * fraction, currentLevelXp, nextLevelXp }
}

describe('experience bar', () => {
  it('measures progress within the current level, not total experience', () => {
    expect(xpProgress(at(1, 0))).toBe(0)
    expect(xpProgress(at(30, 0.374))).toBeCloseTo(0.374)
    expect(xpProgress({ level: 99, xp: 3_520_485_254, currentLevelXp: 3_520_485_254, nextLevelXp: 0 })).toBe(1)
  })

  it('labels the level and the percentage rounded down to a tenth', () => {
    expect(xpBarLabel(at(12, 0.3749), 'ENG')).toBe('Level 12: 37.4%')
    expect(xpBarLabel(at(12, 0.9999), 'CHI')).toBe('等级 12: 99.9%')
  })

  it('frames the bar and fills it in proportion to progress, centred in the viewport', () => {
    const rects: number[][] = []
    const texts: string[] = []
    expect(drawXpBar(canvas((...r) => void rects.push(r)), measuring((_, text) => void texts.push(text)), at(5, 0.5), 800, 'ENG')).toBeNull()
    expect(rects[1]).toEqual([250, 4, 300, 13])
    expect(rects.find((r) => r[0] === 252 && r[1] === 6)?.[2]).toBe(148)
    expect(texts).toEqual(['Level 5: 50.0%'])
  })

  it('formats the hourly rate as a full number under 10k, whole k under 1m, and m with one decimal', () => {
    expect([9_999, 10_000, 153_499, 999_999, 1_000_000, 1_549_000, 23_000_000].map(formatXpRate)).toEqual([
      '9999 xp/hr', '10k xp/hr', '153k xp/hr', '999k xp/hr', '1.0m xp/hr', '1.5m xp/hr', '23.0m xp/hr',
    ])
    expect(formatXpRate(-5)).toBe('0 xp/hr')
  })

  it('measures experience per hour over a rolling window and restarts after an experience loss', () => {
    const tracker = new XpRateTracker()
    tracker.record(1000, 0)
    expect(tracker.perHour(3_000)).toBe(0)
    tracker.record(6000, 60_000)
    expect(tracker.perHour(60_000)).toBe(300_000)
    tracker.record(5000, 61_000)
    expect(tracker.perHour(61_000)).toBe(0)
  })

  it('shows the time until the next level as minutes:seconds, or hours when needed', () => {
    const state = { level: 10, xp: 0, currentLevelXp: 0, nextLevelXp: 10_000 }
    expect(formatTimeToLevel(state, 59_504, 'ENG')).toBe('10:05 until next level')
    expect(formatTimeToLevel(state, 5_000, 'ENG')).toBe('2:00:00 until next level')
    expect(formatTimeToLevel(state, 0, 'ENG')).toBe('No experience gained yet')
    expect(formatTimeToLevel(state, 59_504, 'CHI')).toBe('距下一级 10:05')
  })

  it('draws the rate to the right of the bar and the time-to-level tooltip only on hover', () => {
    const run = (mouseX: number) => {
      const texts: string[] = []
      drawXpBar(canvas(), measuring((_, text) => void texts.push(text)), at(5, 0.5), 800, 'ENG', { perHour: 12_400, mouseX, mouseY: 10 })
      return texts
    }
    expect(run(0)).toEqual(['Level 5: 50.0%', '12k xp/hr'])
    expect(run(560)[2]).toMatch(/until next level$/)
  })

  it('moves the rate to the left of the bar when the area title takes the right, keeping clear of the monster bar below', () => {
    const drawn: { text: string; x: number; y: number }[] = []
    const anchor = drawXpBar(canvas(), measuring((_, text, x, y) => void drawn.push({ text, x, y })), at(5, 0.5), 800, 'ENG', { perHour: 12_400, mouseX: 200, mouseY: 10, rightLimit: 590 })
    expect(drawn[1]).toEqual({ text: '12k xp/hr', x: 190, y: 15 })
    expect(anchor).toEqual({ x: 244, y: 15, align: 'right' })
    expect(drawn[2]!.text).toMatch(/until next level$/)
    expect(drawn[2]!.y).toBeGreaterThan(15)
    expect(xpRatePlacement(10, 54, 15, 300)).toEqual([133, 28])
  })

  it('hangs gains under the rate readout on whichever side of the bar it sits', () => {
    expect(xpGainAnchor(250, 556, 54, 15)).toEqual({ x: 556, y: 15, align: 'left' })
    expect(xpGainAnchor(250, 190, 54, 15)).toEqual({ x: 244, y: 15, align: 'right' })
    expect(xpGainAnchor(250, 373, 54, 28)).toEqual({ x: 400, y: 28, align: 'center' })
  })

  it('floats each experience gain up into the rate readout and fades it out', () => {
    const feed = new XpGainFeed()
    feed.record(500, 0)
    feed.record(500, 100)
    expect(feed.isActive(100)).toBe(false)
    feed.record(1_700, 200)
    feed.record(1_800, 300)
    expect(feed.active(300).map((g) => g.amount)).toEqual([1_300])
    const draw = (nowMs: number) => {
      const drawn: { text: string; y: number }[] = []
      const ctx = { save() {}, restore() {}, globalAlpha: 1 } as unknown as CanvasRenderingContext2D
      const font = { drawText: (_: unknown, text: string, _x: number, y: number) => void drawn.push({ text, y }) } as unknown as D2FontRenderer
      drawXpGains(ctx, font, feed, nowMs, { x: 556, y: 282, align: 'left' })
      return drawn
    }
    expect(draw(200)).toEqual([{ text: '+1,300 xp', y: 338 }])
    expect(draw(1_100)[0]!.y).toBeLessThan(338)
    expect(draw(1_100)[0]!.y).toBeGreaterThanOrEqual(298)
    expect(feed.isActive(2_000)).toBe(false)
  })

  it('ignores the jump from an unloaded zero and experience losses', () => {
    const feed = new XpGainFeed()
    feed.record(0, 0)
    feed.record(90_000, 100)
    feed.record(80_000, 200)
    expect(feed.isActive(200)).toBe(false)
  })

  it('keeps stacked gains below the readout instead of pushing them onto it', () => {
    const feed = new XpGainFeed()
    feed.record(100, 0)
    ;[300, 600, 900, 1_200].forEach((at, i) => feed.record(200 + i * 100, at))
    const ys: number[] = []
    const ctx = { save() {}, restore() {}, globalAlpha: 1 } as unknown as CanvasRenderingContext2D
    const font = { drawText: (_: unknown, _t: string, _x: number, y: number) => void ys.push(y) } as unknown as D2FontRenderer
    drawXpGains(ctx, font, feed, 1_200, { x: 556, y: 282, align: 'left' })
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(298)
    expect(ys.every((y, i) => i === 0 || ys[i - 1]! - y >= 16)).toBe(true)
  })
})
