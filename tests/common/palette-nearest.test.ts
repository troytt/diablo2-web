/**
 * Nearest palette entry (src/common/formats/palette-nearest.ts), D2CMP #10049 as reached through
 * D2Win #10190: squared RGB distance, strict `<`, so the lowest index wins a tie.
 */

import { describe, expect, it } from 'vitest'
import { nearestPaletteIndex } from '../../src/common/formats/palette-nearest.ts'

function palette(entries: ReadonlyArray<readonly [number, number, number]>, fill: number): Uint8Array {
  const out = new Uint8Array(768).fill(fill)
  entries.forEach(([a, b, c], i) => {
    out[i * 3] = a
    out[i * 3 + 1] = b
    out[i * 3 + 2] = c
  })
  return out
}

describe('nearestPaletteIndex', () => {
  it('returns an exact match', () => {
    const pal = palette([], 255)
    pal.set([10, 20, 30], 77 * 3)
    expect(nearestPaletteIndex(pal, 10, 20, 30)).toBe(77)
  })

  it('lets index 0 win like any other entry', () => {
    const pal = palette([[0, 0, 0]], 200)
    expect(nearestPaletteIndex(pal, 1, 1, 1)).toBe(0)
  })

  it('breaks ties toward the lowest index (strict <)', () => {
    const pal = palette([], 255)
    pal.set([100, 100, 100], 40 * 3)
    pal.set([100, 100, 100], 12 * 3)
    pal.set([102, 100, 100], 5 * 3)
    // Distance 1 to entries 12 and 40 (and 5 is 1 too: |102 - 101|), so 5 wins.
    expect(nearestPaletteIndex(pal, 101, 100, 100)).toBe(5)
    // Distance 0 to 12 and 40 only.
    expect(nearestPaletteIndex(pal, 100, 100, 100)).toBe(12)
  })

  it('compares all three channels in squared distance', () => {
    const pal = palette([], 0)
    pal.set([50, 50, 50], 1 * 3)
    pal.set([60, 40, 50], 2 * 3)
    // To (58, 44, 50): entry 1 = 64 + 36 + 0 = 100, entry 2 = 4 + 16 + 0 = 20, entry 0 (0,0,0) is far.
    expect(nearestPaletteIndex(pal, 58, 44, 50)).toBe(2)
  })

  it('throws on a short palette', () => {
    expect(() => nearestPaletteIndex(new Uint8Array(767), 0, 0, 0)).toThrow(/need 768/)
  })
})
