/**
 * HUD 2D layer idle throttle: while the mouse rests, the HUD repaints at most
 * every 40ms (25fps — the server logic rate; orbs/belt are event-driven), and
 * immediately whenever the cursor moves (the software cursor is drawn on this
 * canvas). Previously it repainted on every rAF (measured 60.5 clears +
 * ~2965 drawImage/s standing still).
 */
import { describe, expect, it } from 'vitest'
import { shouldRenderHudFrame } from '../src/client/ui/hud-manager.ts'

describe('[hud idle throttle] shouldRenderHudFrame', () => {
  it('1. first frame always renders', () => {
    expect(shouldRenderHudFrame(null, 400, 300, 1000)).toBe(true)
  })

  it('2. mouse movement renders immediately (cursor smoothness)', () => {
    const prev = { mouseX: 400, mouseY: 300, drawMs: 1000 }
    expect(shouldRenderHudFrame(prev, 401, 300, 1005)).toBe(true)
    expect(shouldRenderHudFrame(prev, 400, 301, 1005)).toBe(true)
  })

  it('3. idle frame inside the 40ms window is skipped, at/after it renders', () => {
    const prev = { mouseX: 400, mouseY: 300, drawMs: 1000 }
    expect(shouldRenderHudFrame(prev, 400, 300, 1039)).toBe(false)
    expect(shouldRenderHudFrame(prev, 400, 300, 1040)).toBe(true)
  })
})
