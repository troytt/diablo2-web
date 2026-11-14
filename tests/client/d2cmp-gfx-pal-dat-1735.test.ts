import { describe, expect, it } from 'vitest'
import { decodePalDat, PaletteError } from '../../src/common/formats/pal.ts'

describe('issue #1735 (D2CMP-GFX-5): decodePalDat B,G,R -> R,G,B decoding (D2Win 0x6F8EEF40)', () => {
  it('swaps B and R channels for each of the 256 triples in pal.dat', () => {
    const raw = new Uint8Array(768)
    for (let i = 0; i < 256; i += 1) {
      raw[i * 3] = i & 0xff // B on disk
      raw[i * 3 + 1] = (i * 2) & 0xff // G on disk
      raw[i * 3 + 2] = (255 - i) & 0xff // R on disk
    }
    const pal = decodePalDat(raw)
    expect(pal.size).toBe(256)
    expect(pal.rgb.byteLength).toBe(768)
    for (let i = 0; i < 256; i += 1) {
      expect(pal.rgb[i * 3]).toBe((255 - i) & 0xff) // R
      expect(pal.rgb[i * 3 + 1]).toBe((i * 2) & 0xff) // G
      expect(pal.rgb[i * 3 + 2]).toBe(i & 0xff) // B
    }
  })

  it('rejects buffers shorter than 768 bytes', () => {
    expect(() => decodePalDat(new Uint8Array(767))).toThrow(PaletteError)
  })
})
