import { describe, expect, it } from 'vitest'
import { LineGlide } from '../../src/client/ui/line-glide.ts'

const LINE = 15

describe('LineGlide', () => {
  it('starts lines where they were when the oldest line scrolls off, then eases to rest', () => {
    const glide = new LineGlide()
    const scrolled = (nowMs: number) => glide.update(['a', 'b', 'c', 'd'], 1, 3, LINE, nowMs)
    expect(glide.update(['a', 'b', 'c'], 0, 3, LINE, 0)).toBe(0)
    const first = scrolled(16)
    expect(first).toBe(LINE)
    const later = scrolled(66)
    expect(later).toBeGreaterThan(0)
    expect(later).toBeLessThan(first)
    let t = 66
    while (glide.isMoving(t)) scrolled((t += 16))
    expect(scrolled(t + 16)).toBe(0)
    expect(t).toBeLessThan(600)
  })

  it('glides the remaining lines up when the top line expires', () => {
    const glide = new LineGlide()
    glide.update(['a', 'b', 'c'], 0, 3, LINE, 0)
    expect(glide.update(['b', 'c'], 0, 2, LINE, 16)).toBe(LINE)
  })

  it('glides downward when scrolling back through history', () => {
    const glide = new LineGlide()
    const keys = ['a', 'b', 'c', 'd', 'e', 'f']
    glide.update(keys, 3, 3, 16, 0)
    expect(glide.update(keys, 1, 3, 16, 16)).toBe(-32)
  })

  it('does not animate after the box has been hidden for a while', () => {
    const glide = new LineGlide()
    glide.update(['a', 'b'], 0, 2, LINE, 0)
    expect(glide.update(['b', 'c'], 0, 2, LINE, 5000)).toBe(0)
    expect(glide.isMoving(5000)).toBe(false)
  })
})
