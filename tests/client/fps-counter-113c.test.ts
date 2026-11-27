/**
 * #829 — the 1.13c client FPS counter 0x6fb0a9a0 (called at 0x6faf4392), whose value gates the
 * lightning flash (`cmp [0x6fbcc2ac], 0xa; jb` @0x6fb306c2).
 */

import { describe, expect, it } from 'vitest'
import { FpsCounter113c } from '../../src/client/render/fps-counter-113c.ts'

describe('FpsCounter113c (0x6fb0a9a0)', () => {
  it('publishes 0 on the first frame and stays 0 until the first full window closes', () => {
    const f = new FpsCounter113c()
    for (let now = 5000; now < 6040; now += 40) expect(f.frame(now)).toBe(0)
    // The window opened at 5000 counted 25 frames (5040..6000); 6040 − 5000 > 1000 publishes them.
    expect(f.frame(6040)).toBe(25)
    expect(f.fps).toBe(25)
  })

  it('111 ms frames publish 9, below the lightning gate', () => {
    const f = new FpsCounter113c()
    for (let now = 5000; now < 6110; now += 111) f.frame(now)
    expect(f.frame(6110)).toBe(9)
  })

  it('the window bound is inclusive (`ja` @0x6fb0a9de) and the subtraction wraps like a DWORD', () => {
    const f = new FpsCounter113c()
    f.frame(2000)
    expect(f.frame(3000)).toBe(0)
    expect(f.frame(3001)).toBe(1)
    const g = new FpsCounter113c()
    g.frame(0xffffff00)
    expect(g.frame(0x100)).toBe(0) // (0x100 − 0xffffff00) mod 2^32 = 512
    expect(g.frame(0x500)).toBe(1) // 1536 > 1000
  })

  it('rejects non-integer or negative times', () => {
    const f = new FpsCounter113c()
    expect(() => f.frame(1.5)).toThrow(/now 1.5/)
    expect(() => f.frame(-1)).toThrow(/now -1/)
  })
})
