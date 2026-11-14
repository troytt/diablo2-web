/**
 * #940 R3 — dedicated cursor layer regression tests.
 *
 * Ground truth: with a `cursorCanvas`, `render()` repaints the cursor layer every
 * call (ahead of both idle gates) while the HUD canvas itself is skipped when the
 * repaint signature is unchanged — cursor animation no longer forces HUD repaints.
 * Leaving the in-game view must clear and hide the layer (no stale cursor over the
 * front-end); a HudManager constructed WITHOUT the layer keeps the legacy inline
 * cursor draw and `setCursorLayerActive` must stay a no-op there.
 */
import { describe, expect, it, vi } from 'vitest'
import { HudManager } from '../../src/client/ui/hud-manager.ts'

function createMockCanvas(width = 800, height = 600) {
  const ctx: any = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    createImageData: vi.fn((w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
  }
  const canvas: any = {
    width,
    height,
    style: {},
    getContext: vi.fn(() => ctx),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  }
  return { canvas, ctx }
}

describe('#940 R3 dedicated cursor layer', () => {
  it('skips unchanged cursor frames, repaints on mouse move, and hides when deactivated', () => {
    const hud = createMockCanvas()
    const layer = createMockCanvas()
    const m = new HudManager(hud.canvas, undefined, layer.canvas)
    m.enableIdleThrottle = true

    // First call: full HUD paint + first layer paint (sizes the layer canvas).
    m.render(1000)
    expect(hud.ctx.clearRect).toHaveBeenCalled()

    // 5ms later, nothing changed: neither the HUD canvas nor the cursor layer
    // may rasterize (both layers hit their own skip signature).
    hud.ctx.clearRect.mockClear()
    layer.ctx.clearRect.mockClear()
    m.render(1005)
    expect(hud.ctx.clearRect).not.toHaveBeenCalled()
    expect(layer.ctx.clearRect).not.toHaveBeenCalled()

    // A mouse move must repaint the cursor layer even while the HUD itself is
    // still within the idle window (the HUD signature also contains the mouse,
    // so both repaint here — the point is the layer never lags behind).
    m.handleMouseMove(320, 240)
    m.render(1010)
    expect(layer.ctx.clearRect).toHaveBeenCalled()

    // 250ms safety net: a due full repaint must clear the HUD canvas again.
    hud.ctx.clearRect.mockClear()
    m.render(1400)
    expect(hud.ctx.clearRect).toHaveBeenCalled()

    // Leaving the in-game view clears and hides the layer.
    m.setCursorLayerActive(false)
    expect(layer.canvas.style.display).toBe('none')
    expect(layer.ctx.clearRect).toHaveBeenCalled()
  })

  it('without a cursor layer the cursor keeps the legacy inline path (setCursorLayerActive is a no-op)', () => {
    const hud = createMockCanvas()
    const m = new HudManager(hud.canvas)
    m.render(1000)
    expect(hud.ctx.clearRect).toHaveBeenCalled()
    expect(() => m.setCursorLayerActive(false)).not.toThrow()
    expect(hud.canvas.style.display).toBeUndefined()
  })
})
