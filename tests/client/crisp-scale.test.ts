import { describe, expect, it } from 'vitest'
import { crispPixelScale, crispRenderDpr } from '../../src/client/view/crisp-scale.ts'

describe('crisp scaling', () => {
  it('rounds fractional display scales up to a whole pixel multiple', () => {
    expect(crispPixelScale(1)).toBe(1)
    expect(crispPixelScale(1.25)).toBe(2)
    expect(crispPixelScale(1.5)).toBe(2)
    expect(crispPixelScale(2)).toBe(2)
    expect(crispPixelScale(2.01)).toBe(2)
    expect(crispPixelScale(2.6)).toBe(3)
  })

  it('never goes below native or above the cap', () => {
    expect(crispPixelScale(0.7)).toBe(1)
    expect(crispPixelScale(Number.NaN)).toBe(1)
    expect(crispPixelScale(9)).toBe(4)
  })

  it('picks a render dpr that makes the HUD art scale a whole number', () => {
    for (const [uiScale, dpr] of [
      [1.5, 1],
      [1.37, 1.25],
      [0.9, 1],
      [2.4, 1.5],
    ] as const) {
      const physical = uiScale * crispRenderDpr(uiScale, dpr)
      expect(Math.abs(physical - Math.round(physical))).toBeLessThan(1e-9)
      expect(physical).toBeGreaterThanOrEqual(Math.min(4, uiScale * dpr) - 0.02)
    }
  })
})
