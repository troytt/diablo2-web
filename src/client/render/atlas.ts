/**
 * Sprite atlases: decoded palette-indexed frames packed once into one RGBA
 * texture.
 *
 * Indexed frames stay the source of truth in the format layer (that is what
 * makes colour variants cheap), but the GPU wants RGBA. Expanding into a single
 * atlas keeps both: one texture bind per frame batch, and a variant is another
 * atlas rather than a shader permutation.
 */
import type { SpriteSheet } from '../../common/formats/sprite.ts'

import type { AtlasFrame } from '../../common/world/animated-tiles.ts'
export type { AtlasFrame }

/** A packed sheet: pixels plus per-group frame placements. */
export interface SpriteAtlas {
  /** RGBA8 pixels, `width * height * 4`. */
  readonly pixels: Uint8ClampedArray
  /** Atlas width in pixels. */
  readonly width: number
  /** Atlas height in pixels. */
  readonly height: number
  /** Frame placements, grouped exactly like the source sheet. */
  readonly groups: readonly (readonly AtlasFrame[])[]
}

/** One pixel of padding between frames, so nearest sampling cannot bleed. */
const PADDING = 1
/** Cap on the atlas' short side, comfortably under every GL implementation's limit. */
const MAX_ATLAS_WIDTH = 2048

/**
 * Round up to a power of two (atlas dimensions stay power-of-two-ish so the
 * layout is easy to reason about, not because the hardware requires it).
 *
 * @param value - the value to round.
 * @returns the next power of two, at least 1.
 */
function nextPowerOfTwo(value: number): number {
  let result = 1
  while (result < value) result *= 2
  return result
}

/** A packed 8-bit palette-indexed sheet: 1 byte per pixel plus per-group frame placements. */
export interface IndexedSpriteAtlas {
  /** R8 palette indices, `width * height`. Index 0 = transparent. */
  readonly r8: Uint8Array
  /** Atlas width in pixels. */
  readonly width: number
  /** Atlas height in pixels. */
  readonly height: number
  /** Frame placements, grouped exactly like the source sheet. */
  readonly groups: readonly (readonly AtlasFrame[])[]
}

/**
 * Pack a decoded sheet into a single-channel 8-bit (R8) palette-indexed atlas.
 *
 * Transparent pixels (`mask[i] === 0`) are mapped to `0`. Opaque pixels whose
 * palette index happens to be `0` are remapped to `opaqueBlack` (default 172,
 * which is `rgb(4,4,4)` across all Diablo II Act palettes).
 */
export function buildIndexedAtlas(
  sheet: SpriteSheet,
  opaqueBlack = 172,
  options: { width?: number } = {},
): IndexedSpriteAtlas {
  const frames = sheet.groups.flatMap(group => group.frames)
  if (frames.length === 0) {
    return { r8: new Uint8Array(0), width: 0, height: 0, groups: [] }
  }
  const widest = Math.max(...frames.map(frame => frame.width))
  const area = frames.reduce((total, frame) => total + (frame.width + PADDING) * (frame.height + PADDING), 0)
  const square = nextPowerOfTwo(Math.ceil(Math.sqrt(area)))
  const atlasWidth = Math.max(options.width ?? 0, widest + PADDING, Math.min(square, MAX_ATLAS_WIDTH))

  const placements: AtlasFrame[] = []
  let shelfY = 0
  let shelfHeight = 0
  let cursorX = 0
  for (const frame of frames) {
    if (cursorX + frame.width + PADDING > atlasWidth) {
      shelfY += shelfHeight + PADDING
      shelfHeight = 0
      cursorX = 0
    }
    placements.push({
      x: cursorX,
      y: shelfY,
      width: frame.width,
      height: frame.height,
      ...(frame.anchorX !== undefined ? { anchorX: frame.anchorX } : {}),
      ...(frame.anchorY !== undefined ? { anchorY: frame.anchorY } : {}),
    })
    cursorX += frame.width + PADDING
    shelfHeight = Math.max(shelfHeight, frame.height)
  }
  const atlasHeight = shelfY + shelfHeight + PADDING
  const r8 = new Uint8Array(atlasWidth * atlasHeight)

  let index = 0
  for (const frame of frames) {
    const place = placements[index]!
    index += 1
    for (let row = 0; row < place.height; row += 1) {
      const fromRow = row * frame.width
      const toRow = (place.y + row) * atlasWidth + place.x
      for (let col = 0; col < place.width; col += 1) {
        const srcAt = fromRow + col
        if (frame.mask[srcAt] === 0) {
          r8[toRow + col] = 0
        } else {
          const val = frame.indices[srcAt]!
          r8[toRow + col] = val === 0 ? opaqueBlack : val
        }
      }
    }
  }

  let consumed = 0
  const groups = sheet.groups.map(group => {
    const slice = placements.slice(consumed, consumed + group.frames.length)
    consumed += group.frames.length
    return slice
  })

  return { r8, width: atlasWidth, height: atlasHeight, groups }
}

