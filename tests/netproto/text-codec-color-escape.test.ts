import { describe, expect, it } from 'vitest'
import { defaultTextCodec } from '../../src/netproto/core/text-codec.ts'
import { computeFontMetrics113c, D2FontRenderer, parseColoredText } from '../../src/client/ui/font.ts'
import { D2_FONT_NAME_TO_D2GL_ID } from '../../src/common/ui/pd2-d2gl.ts'
import { buildFontAtlas, IN_GAME_FONT_NAMES } from '../../src/baker/packers/pack-ui.ts'
import type { SpriteSheet } from '../../src/common/formats/sprite.ts'

describe('GBK decode keeps D2 colour escapes', () => {
  it('decodes 0xFF as the colour marker so the colour parser sees it', () => {
    const bytes = new Uint8Array([0xff, 0x63, 0x38, ...new TextEncoder().encode('[D2GS] hello')])
    const text = defaultTextCodec.decode(bytes)
    expect(text).toBe('\xffc8[D2GS] hello')
    expect(parseColoredText(text)).toEqual([{ text: '[D2GS] hello', color: 'orange' }])
  })

  it('still decodes GBK characters around colour escapes', () => {
    const gbkNi = [0xc4, 0xe3]
    const text = defaultTextCodec.decode(new Uint8Array([...gbkNi, 0xff, 0x63, 0x31, ...gbkNi]))
    expect(text).toBe('你\xffc1你')
  })

  // Issue #1745: D2Win.dll 0x6F8F2750 / 0x6F8F1F20 / 0x6F8F1FB0 / 0x6F8F20C0 colour-code edge handling
  it('matches D2Win.dll draw and width colour-code edge handling (#1745)', () => {
    // 1. U+FFFD ('\ufffd') is never treated as a 0xFF colour escape
    expect(parseColoredText('\ufffdc8hello')).toEqual([{ text: '\ufffdc8hello', color: 'white' }])

    // 2. Draw (0x6F8F2800..0x6F8F285C): 0xFF not followed by 'c' draws 0xFF ('ÿ') as a literal glyph
    expect(parseColoredText('\xffx1hello')).toEqual([{ text: 'ÿx1hello', color: 'white' }])
    // Out-of-range colour index (< '0' or >= '0' + 13) or trailing 'ÿc' resets to white (0)
    expect(parseColoredText('\xffc8orange\xffc=white')).toEqual([
      { text: 'orange', color: 'orange' },
      { text: 'white', color: 'white' },
    ])
    expect(parseColoredText('\xffc8orange\xffc')).toEqual([{ text: 'orange', color: 'orange' }])

    // 3. Width (0x6F8F1F20 / 0x6F8F1FB0): 0xFF + 2 chars is skipped with zero advance even without 'c'
    const font = new D2FontRenderer('113c')
    const baseW = font.measureText('AB', 'font16')
    expect(font.measureText('\xffx1AB', 'font16')).toBe(baseW)
    expect(font.measureText('\xffc8AB', 'font16')).toBe(baseW)

    // 4. Partial width (0x6F8F20C0): only ÿc0..ÿc6 are skipped when i + 3 < maxChars; ÿc7..ÿc< are measured as glyphs
    expect(font.measureTextPartial113c('\xffc4AB', 5, 'font16')).toBe(baseW)
    expect(font.measureTextPartial113c('\xffc8AB', 5, 'font16')).toBeGreaterThan(baseW)
  })

  // Issue #1740: D2Win.dll 0x6F8F19E3..0x6F8F1A0D / 0x6F8F1F8E / 0x6F8F2856 verbatim font tbl/dc6 baker
  it('bakes font tbl metrics and dc6 glyphs verbatim without synthetic replacements (#1740)', () => {
    const tbl = new Uint8Array(12 + 256 * 14)
    tbl.set([0x57, 0x6f, 0x6f, 0x21, 0x01], 0) // "Woo!\x01"
    tbl[10] = 9  // nHeight
    tbl[11] = 10 // nWidth
    for (let i = 0; i < 256; i++) {
      const off = 12 + i * 14
      tbl[off] = i & 0xff
      tbl[off + 1] = 0
      tbl[off + 3] = i === 0xaa ? 0 : 7 // 0xAA has 0 width in FontExocet8
      tbl[off + 4] = 9
      tbl[off + 8] = i & 0xff
      tbl[off + 9] = 0
    }
    // Set u16 frame index > 255 on code 0x96 to verify u16 rec+8 read
    const off96 = 12 + 0x96 * 14
    tbl[off96 + 8] = 0x00
    tbl[off96 + 9] = 0x01 // frame 256

    const makeFrame = (pixelIdx: number, w = 4, h = 4) => ({
      width: w,
      height: h,
      indices: new Uint8Array(w * h).fill(pixelIdx),
      mask: new Uint8Array(w * h).fill(1),
    })
    const frames = Array.from({ length: 257 }, (_, idx) => makeFrame(idx === 256 ? 25 : 20))
    const dc6: SpriteSheet = {
      width: null,
      groups: [{ frames }],
    }

    const { meta, pixels } = buildFontAtlas('fontexocet10', dc6, tbl)
    // 1. 0-width glyph (0xAA) keeps width 0 (not replaced with 6)
    expect(meta.glyphs[0xaa]!.width).toBe(0)
    // 2. Glyph sharing '?' frame is NOT blanked out
    expect(meta.glyphs[0x80]!.frameW).toBe(4)
    // 3. u16 frameIdx (256) on 0x96 is read verbatim and not replaced by '-'
    const g96 = meta.glyphs[0x96]!
    expect(pixels[g96.y * meta.atlasWidth + g96.x]).toBe(25)
    // 4. fontexocet10 palette index 20 in 15..32 is NOT inverted to 26
    const g41 = meta.glyphs[0x41]!
    expect(pixels[g41.y * meta.atlasWidth + g41.x]).toBe(20)
  })

  // Issue #1741: D2Win.dll 0x6F8F3110 / 0x6F8F1ED7 / 0x6F8F2ADB / 0x6F8F352A truncating division & runtime line advance
  it('truncates (mult * tbl[10]) / 10 in computeFontMetrics113c and drives runtime multi-line advance (#1741)', () => {
    // FontExocet10 / Font6 (tbl[10] = 9): (16*9)/10 = 14, (3*9)/10 = 2.7 -> truncates to 2 (not 3)
    expect(computeFontMetrics113c(9, 'ENG')).toEqual({ lineHeight: 14, lineAdvance: 14, baseline: 2 })
    // Font8 (tbl[10] = 8): (16*8)/10 = 12.8 -> truncates to 12 (not 13), (3*8)/10 = 2.4 -> 2
    expect(computeFontMetrics113c(8, 'ENG')).toEqual({ lineHeight: 12, lineAdvance: 12, baseline: 2 })
    // CHI locale (mults 14, 14, 2): (14*9)/10 = 12.6 -> 12, (2*9)/10 = 1.8 -> 1
    expect(computeFontMetrics113c(9, 'CHI')).toEqual({ lineHeight: 12, lineAdvance: 12, baseline: 1 })

    const font = new D2FontRenderer('pd2')
    expect(font.getLineAdvance113c('font8', 'ENG')).toBe(12)
    expect(font.getLineAdvance113c('fontexocet10', 'ENG')).toBe(14)

    const ys: number[] = []
    const ctx = {
      save: () => {},
      restore: () => {},
      fillText: (_t: string, _x: number, y: number) => ys.push(y),
      measureText: (s: string) => ({ width: s.length * 6 }),
      font: '',
      fillStyle: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
    } as unknown as CanvasRenderingContext2D
    font.drawText(ctx, 'Line 1\nLine 2', 10, 100, { font: 'font8', lang: 'ENG' })
    expect(ys).toEqual([100, 112])
  })

  // Issue #1738: D2Win.dll 0x6F9AA380 in-game font set includes font42 (3), fontformal10 (4), fontformal11 (8), fontingamechat (13)
  it('registers all 10 D2Client in-game fonts in IN_GAME_FONT_NAMES, D2_FONT_NAME_TO_D2GL_ID, and D2FontRenderer (#1738)', () => {
    expect(IN_GAME_FONT_NAMES).toEqual([
      'font6',
      'font8',
      'font16',
      'font30',
      'font42',
      'fontformal10',
      'fontformal11',
      'fontformal12',
      'fontexocet10',
      'fontingamechat',
    ])
    expect(D2_FONT_NAME_TO_D2GL_ID.font42).toBe(3)
    expect(D2_FONT_NAME_TO_D2GL_ID.fontformal10).toBe(4)
    expect(D2_FONT_NAME_TO_D2GL_ID.fontformal11).toBe(8)
    expect(D2_FONT_NAME_TO_D2GL_ID.fontingamechat).toBe(13)

    const font = new D2FontRenderer('pd2')
    for (const fn of ['font42', 'fontformal10', 'fontformal11', 'fontingamechat'] as const) {
      expect(font.measureText('Hello', fn)).toBeGreaterThan(0)
      expect(font.getLineAdvance113c(fn, 'ENG')).toBeGreaterThan(0)
    }
  })
})
