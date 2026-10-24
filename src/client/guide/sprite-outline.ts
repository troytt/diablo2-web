import type { AtlasFrame } from '../render/atlas.ts'
import type { AtlasHandle, PagedAtlasFrame, SpriteRenderer } from '../render/renderer.ts'

export type OutlineTint = readonly [number, number, number]

const PAD = 3
const CACHE_LIMIT = 96

interface Outline {
  readonly handle: AtlasHandle
  readonly frame: AtlasFrame
}

export function outlinePixels(mask: Uint8Array, width: number, height: number, pad = PAD): Uint8ClampedArray {
  const [w, h] = [width + pad * 2, height + pad * 2]
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] !== 0
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [sx, sy] = [x - pad, y - pad]
      if (solid(sx, sy)) continue
      let nearest = Infinity
      for (let dy = -pad; dy <= pad; dy++) for (let dx = -pad; dx <= pad; dx++) if (solid(sx + dx, sy + dy)) nearest = Math.min(nearest, Math.hypot(dx, dy))
      const alpha = nearest <= 1.5 ? 1 : Math.max(0, 1 - (nearest - 1) / pad) * 0.45
      if (alpha > 0) out.set([255 * alpha, 255 * alpha, 255 * alpha, 255], (y * w + x) * 4)
    }
  return out
}

export class SpriteOutlines {
  private wanted: ReadonlyMap<number, OutlineTint> = new Map()
  private readonly cache = new Map<string, Outline | null>()
  private readonly textureIds = new WeakMap<WebGLTexture, number>()
  private reader: WebGLFramebuffer | null = null
  private nextTextureId = 1

  mark(units: ReadonlyMap<number, OutlineTint>): void {
    this.wanted = units
  }

  draw(renderer: SpriteRenderer, unitId: number, frame: AtlasFrame, atlas: AtlasHandle | undefined, x: number, y: number, nowMs = performance.now()): void {
    const tint = this.wanted.get(unitId)
    const page = (frame as PagedAtlasFrame).atlas ?? atlas
    const outline = tint && page ? this.outlineOf(renderer, page, frame) : null
    if (!tint || !outline) return
    const glow = 0.8 + 0.2 * Math.sin(nowMs / 320)
    renderer.draw(outline.frame, x - PAD, y - PAD, { atlas: outline.handle, blendMode: 'additive', tint: [tint[0] * glow, tint[1] * glow, tint[2] * glow, 1] })
  }

  private outlineOf(renderer: SpriteRenderer, page: AtlasHandle, frame: AtlasFrame): Outline | null {
    const key = `${this.textureId(page.texture)}:${frame.x},${frame.y},${frame.width},${frame.height}`
    if (this.cache.has(key)) return this.cache.get(key)!
    const outline = this.build(renderer, page, frame)
    this.cache.set(key, outline)
    if (this.cache.size > CACHE_LIMIT) {
      const [oldest, evicted] = this.cache.entries().next().value!
      this.cache.delete(oldest)
      if (evicted) renderer.deleteAtlas(evicted.handle)
    }
    return outline
  }

  private build(renderer: SpriteRenderer, page: AtlasHandle, frame: AtlasFrame): Outline | null {
    try {
      const mask = this.readMask(renderer.gl, page, frame)
      const [width, height] = [frame.width + PAD * 2, frame.height + PAD * 2]
      const handle = renderer.addAtlas({ pixels: outlinePixels(mask, frame.width, frame.height), width, height })
      return { handle, frame: { x: 0, y: 0, width, height } }
    } catch {
      return null
    }
  }

  private readMask(gl: WebGL2RenderingContext, page: AtlasHandle, frame: AtlasFrame): Uint8Array {
    const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    this.reader ??= gl.createFramebuffer()
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.reader)
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, page.texture, 0)
    const rgba = new Uint8Array(frame.width * frame.height * 4)
    gl.readPixels(frame.x, frame.y, frame.width, frame.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous)
    const channel = page.indexed ? 0 : 3
    return Uint8Array.from({ length: frame.width * frame.height }, (_, i) => rgba[i * 4 + channel]!)
  }

  private textureId(texture: WebGLTexture): number {
    if (!this.textureIds.has(texture)) this.textureIds.set(texture, this.nextTextureId++)
    return this.textureIds.get(texture)!
  }
}

export const spriteOutlines = new SpriteOutlines()
