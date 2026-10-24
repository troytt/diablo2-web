import { describe, expect, it } from 'vitest'
import { ToastFeed, toastOpacity } from '../../src/client/ui/toasts.ts'
import { lowLifeIntensity, lowLifePulse } from '../../src/client/ui/low-life-warning.ts'

describe('toasts', () => {
  it('fades in, holds and fades out', () => {
    expect(toastOpacity(0)).toBe(0)
    expect(toastOpacity(110)).toBeCloseTo(0.5)
    expect(toastOpacity(2000)).toBe(1)
    expect(toastOpacity(5200)).toBe(0)
  })

  it('keeps the three newest and drops expired ones', () => {
    const feed = new ToastFeed()
    ;['a', 'b', 'c', 'd'].forEach((title, i) => feed.push({ title, color: 'gold' }, i * 100))
    expect(feed.live(400).map((t) => t.title)).toEqual(['b', 'c', 'd'])
    expect(feed.live(5350).map((t) => t.title)).toEqual(['c', 'd'])
  })
})

describe('low-life warning', () => {
  it('starts below 40% life, peaks near 12% and stays off when dead', () => {
    expect(lowLifeIntensity(50, 100)).toBe(0)
    expect(lowLifeIntensity(40, 100)).toBe(0)
    expect(lowLifeIntensity(26, 100)).toBeCloseTo(0.5)
    expect(lowLifeIntensity(5, 100)).toBe(1)
    expect(lowLifeIntensity(0, 100)).toBe(0)
  })

  it('pulses faster as life drops', () => {
    const period = (intensity: number) => [...Array(4000).keys()].findIndex((ms) => ms > 0 && lowLifePulse(intensity, ms) >= 0.9999 && lowLifePulse(intensity, ms - 1) < lowLifePulse(intensity, ms) && lowLifePulse(intensity, ms + 1) < lowLifePulse(intensity, ms))
    expect(period(1)).toBeLessThan(period(0))
  })
})
