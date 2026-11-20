/**
 * Issue #1315: the first in-game `font6` panel used to run a synchronous `getImageData`/pixel
 * tint/`putImageData` pass inside a render frame. `D2FontRenderer.load()` must prebuild the common
 * `font6` tinted atlases while the loading screen is still up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { D2FontRenderer } from '../../src/client/ui/font.ts'

const FONT6_COLORS = ['black', 'blue', 'gold', 'red', 'tan', 'white']

function stubBrowserFontEnvironment(): { getImageData: ReturnType<typeof vi.fn> } {
  const metrics = {
    font6: {
      name: 'font6',
      lineHeight: 10,
      capHeight: 8,
      atlasWidth: 8,
      atlasHeight: 8,
      glyphs: Array.from({ length: 50 }, (_, code) => ({
        code,
        width: 8,
        height: 10,
        x: 0,
        y: 0,
        frameW: code === 32 ? 0 : 8,
        frameH: code === 32 ? 0 : 10,
      })),
    },
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => metrics })),
  )
  vi.stubGlobal(
    'Image',
    class {
      width = 8
      height = 8
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    },
  )

  const getImageData = vi.fn((_x: number, _y: number, w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4),
  }))
  const ctx = {
    drawImage: vi.fn(),
    getImageData,
    putImageData: vi.fn(),
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    fillRect: vi.fn(),
  }
  const canvas = { width: 0, height: 0, getContext: () => ctx }
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
  return { getImageData }
}

describe('Issue #1315 font6 tint prewarm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds every common font6 tint during load()', async () => {
    const { getImageData } = stubBrowserFontEnvironment()
    const font = new D2FontRenderer('pd2')

    await font.load('http://127.0.0.1/ui/fonts')

    const cache = (font as unknown as { tintedCache: Map<string, unknown> }).tintedCache
    expect([...cache.keys()].sort()).toEqual(FONT6_COLORS.map(color => `font6:${color}`))
    expect(getImageData).toHaveBeenCalledTimes(FONT6_COLORS.length)
  })

  it('does not touch canvas pixels when drawing after the prewarm', async () => {
    const { getImageData } = stubBrowserFontEnvironment()
    const font = new D2FontRenderer('pd2')
    await font.load('http://127.0.0.1/ui/fonts')
    getImageData.mockClear()

    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 8 })),
      font: '',
      fillStyle: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
    } as unknown as CanvasRenderingContext2D

    font.drawText(ctx, '1', 0, 0, { font: 'font6', color: 'white' })

    expect(getImageData).not.toHaveBeenCalled()
    expect(ctx.drawImage).toHaveBeenCalled()
  })
})