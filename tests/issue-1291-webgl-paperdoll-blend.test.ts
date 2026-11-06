import { describe, expect, it } from 'vitest'
import { SpriteRenderer } from '../src/client/render/renderer.ts'
import { blitWithRemap, packAppearanceSheetToR8 } from '../src/common/units/char-appearance.ts'
import type { SpriteFrame } from '../src/common/formats/sprite.ts'

const GL = { ZERO: 0, ONE: 1, SRC_COLOR: 768, SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771, DST_COLOR: 774 }

function createMockWebGl2Renderer() {
  const blendFuncSeparates: [number, number, number, number][] = []
  let contextAttributes: Record<string, unknown> | undefined
  let id = 1
  const base: Record<string, unknown> = {
    ...GL,
    drawingBufferWidth: 640,
    drawingBufferHeight: 480,
    isContextLost: () => false,
    getParameter: (p: number) => (p === 3379 ? 8192 : 16),
    getProgramParameter: () => true,
    getShaderParameter: () => true,
    getProgramInfoLog: () => '',
    getShaderInfoLog: () => '',
    getAttribLocation: () => 0,
    getUniformLocation: (_p: unknown, name: string) => ({ name }),
    blendFunc: () => {},
    blendFuncSeparate: (srcRgb: number, dstRgb: number, srcA: number, dstA: number) => {
      blendFuncSeparates.push([srcRgb, dstRgb, srcA, dstA])
    },
  }
  const gl = new Proxy(base, {
    get(target, prop) {
      if (typeof prop === 'string' && prop in target) return target[prop]
      if (typeof prop === 'string' && /^[A-Z0-9_]+$/.test(prop)) return 0x9000 + prop.length
      if (typeof prop === 'string' && prop.startsWith('create')) return () => ({ id: id++ })
      return () => undefined
    },
  })
  const canvas = {
    getContext: (t: string, attrs?: Record<string, unknown>) => {
      if (t === 'webgl2') {
        contextAttributes = attrs
        return gl
      }
      return null
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    width: 640,
    height: 480,
  }
  const renderer = new SpriteRenderer(canvas as unknown as HTMLCanvasElement)
  return { renderer, blendFuncSeparates, contextAttributes }
}

describe('Issue #1291: WebGL2 alpha:false + blendFuncSeparate and paperdoll COF translucent/glow shadow-index suppression', () => {
  it('requests WebGL2 context with alpha:false and preserves opaque destination alpha via blendFuncSeparate across all blend modes', () => {
    const { renderer, blendFuncSeparates, contextAttributes } = createMockWebGl2Renderer()
    expect(contextAttributes?.alpha).toBe(false)
    expect(contextAttributes?.antialias).toBe(false)
    // Initial normal/additive premultiplied-alpha batch state: (ONE, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)
    expect(blendFuncSeparates.at(-1)).toEqual([GL.ONE, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA])

    // Additive batches in group 0 with v_additive=1 (outColor.a = 0 -> dst.a = 0*1 + 1*(1-0) = 1)
    renderer.setBlendMode('additive')
    expect(blendFuncSeparates.at(-1)).toEqual([GL.ONE, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA])

    renderer.setBlendMode('burn')
    expect(blendFuncSeparates.at(-1)).toEqual([GL.ZERO, GL.SRC_COLOR, GL.ZERO, GL.ONE])

    renderer.setBlendMode('modulate')
    expect(blendFuncSeparates.at(-1)).toEqual([GL.DST_COLOR, GL.ZERO, GL.ZERO, GL.ONE])

    renderer.setBlendMode('trans50')
    expect(blendFuncSeparates.at(-1)).toEqual([GL.ONE, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA])
  })

  it('skips baked shadow index 172 (0xAC) and 0 when blitting translucent/additive character COF layers onto paperdoll R8 frames', () => {
    const target = {
      width: 3,
      height: 1,
      indices: new Uint8Array([80, 0, 0]),
      mask: new Uint8Array([1, 0, 0]),
    }
    const glowSource: SpriteFrame = {
      width: 3,
      height: 1,
      indices: new Uint8Array([172, 172, 210]),
      mask: new Uint8Array([1, 1, 1]),
    }

    // With skipShadowIndex = true (for COF layer with transparent=true, drawEffect<=3):
    // - Pixel 0 had opaque body index 80; glow layer's shadow index 172 must NOT overwrite 80!
    // - Pixel 1 was empty; glow layer's shadow index 172 must remain transparent (mask 0, index 0)!
    // - Pixel 2 receives bright glow index 210 (mask 1).
    blitWithRemap(target, glowSource, 0, 0, null, true)
    expect(target.indices[0]).toBe(80)
    expect(target.mask[0]).toBe(1)
    expect(target.indices[1]).toBe(0)
    expect(target.mask[1]).toBe(0)
    expect(target.indices[2]).toBe(210)
    expect(target.mask[2]).toBe(1)

    const packed = packAppearanceSheetToR8({
      groups: [{ frames: [target] }],
      width: null,
    })
    const [x, y] = packed.groups[0]![0]!
    const rowStart = y * packed.width + x
    expect(packed.r8[rowStart + 0]).toBe(80)
    expect(packed.r8[rowStart + 1]).toBe(0) // stays transparent, not 172 black border!
    expect(packed.r8[rowStart + 2]).toBe(210)
  })
})
