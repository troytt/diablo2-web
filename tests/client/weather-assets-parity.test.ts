/**
 * public/assets/weather/weather.json must be exactly what pack-weather derives from the 1.13c MPQs
 * (re-derived from the mounted archives, no skip), and must carry the cels LoadWeather 0x6fb31750
 * draws with the geometry of docs/weather_113c.md.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getSharedMountedArchives } from '../../src/baker/mpq-archive-source.ts'
import {
  buildWeatherManifest,
  renderWeatherManifest,
  WEATHER_CEL_MEMBERS,
  WEATHER_OUT_FILE,
  weatherPaletteMember,
} from '../../src/baker/packers/pack-weather.ts'
import {
  decodeBase64Strict,
  encodeBase64,
  validateWeatherManifest,
  WEATHER_CEL_NAMES,
} from '../../src/common/pack-contract/index.ts'

/** `[w, h, ox, oy]` per frame (DC6 headers of Rain3 / Rain4 / bubble3). */
const GEOMETRY: Readonly<Record<(typeof WEATHER_CEL_NAMES)[number], ReadonlyArray<readonly [number, number, number, number]>>> = {
  rain3: [
    [5, 3, -2, 1],
    [11, 5, -5, 1],
    [13, 8, -6, 2],
    [19, 11, -9, 4],
    [23, 13, -11, 5],
    [24, 15, -11, 6],
    [30, 18, -15, 7],
    [33, 19, -16, 8],
    [33, 21, -16, 9],
    [33, 21, -16, 9],
  ],
  rain4: [
    [3, 2, -1, 1],
    [6, 4, -3, 1],
    [7, 5, -3, 1],
    [10, 5, -5, 1],
    [12, 7, -6, 2],
    [13, 8, -6, 3],
    [16, 9, -8, 3],
    [17, 11, -8, 4],
    [18, 11, -9, 4],
    [18, 11, -9, 4],
  ],
  bubble3: [
    [2, 2, 0, 0],
    [11, 12, -13, 35],
    [15, 16, -16, 34],
    [13, 17, -16, 31],
    [13, 19, -15, 30],
    [13, 20, -14, 29],
    [15, 21, -15, 25],
    [19, 15, -16, 20],
    [25, 15, -19, 19],
    [29, 11, -22, 17],
    [34, 15, -25, 20],
    [40, 17, -28, 22],
  ],
}

const ON_DISK = readFileSync(new URL(`../../${WEATHER_OUT_FILE}`, import.meta.url), 'utf8')

describe('weather.json parity with the 1.13c MPQs', () => {
  it('is byte-identical to the packer output', async () => {
    const archives = await getSharedMountedArchives()
    expect(ON_DISK).toBe(renderWeatherManifest(await buildWeatherManifest(archives)))
  }, 60_000)

  it('records where each member came from (Act V palettes from d2exp.mpq)', () => {
    const raw = JSON.parse(ON_DISK) as { sources: Record<string, string> }
    const expected: Record<string, string> = {}
    for (const name of WEATHER_CEL_NAMES) expected[WEATHER_CEL_MEMBERS[name]] = 'd2data.mpq'
    for (let act = 1; act <= 5; act += 1) {
      for (const file of ['pal.dat', 'pal.pl2'] as const) {
        expected[weatherPaletteMember(act, file)] = act === 5 ? 'd2exp.mpq' : 'd2data.mpq'
      }
    }
    expect(raw.sources).toEqual(expected)
  })

  it('carries the drawn cels with their DC6 frame geometry', () => {
    const data = validateWeatherManifest(JSON.parse(ON_DISK))
    for (const name of WEATHER_CEL_NAMES) {
      expect(data.cels[name].map((f) => [f.w, f.h, f.ox, f.oy])).toEqual(GEOMETRY[name])
    }
    expect(data.cels.rain3).toHaveLength(10)
    expect(data.cels.rain4).toHaveLength(10)
    expect(data.cels.bubble3).toHaveLength(12)
  })

  it('packs non-overlapping frames whose pixels use the documented palette ranges', () => {
    const data = validateWeatherManifest(JSON.parse(ON_DISK))
    const { width, indices } = data.atlas
    const owner = new Int16Array(indices.length).fill(-1)
    let id = 0
    for (const name of WEATHER_CEL_NAMES) {
      const used = new Set<number>()
      for (const f of data.cels[name]) {
        for (let y = 0; y < f.h; y += 1) {
          for (let x = 0; x < f.w; x += 1) {
            const at = (f.ay + y) * width + f.ax + x
            expect(owner[at]).toBe(-1)
            owner[at] = id
            const v = indices[at]!
            if (v !== 0) used.add(v)
          }
        }
        id += 1
      }
      const values = [...used]
      const [lo, hi] = name === 'bubble3' ? [2, 46] : [15, 205]
      expect(Math.min(...values)).toBeGreaterThanOrEqual(lo)
      expect(Math.max(...values)).toBeLessThanOrEqual(hi)
    }
    // bubble3 frame 0 is fully transparent.
    const f0 = data.cels.bubble3[0]!
    for (let y = 0; y < f0.h; y += 1) {
      for (let x = 0; x < f0.w; x += 1) expect(indices[(f0.ay + y) * width + f0.ax + x]).toBe(0)
    }
  })

  it('stores RGB act palettes with black at 0 and white at 255', () => {
    const data = validateWeatherManifest(JSON.parse(ON_DISK))
    expect(data.palettes).toHaveLength(5)
    for (const pal of data.palettes) {
      expect([...pal.subarray(0, 3)]).toEqual([0, 0, 0])
      expect([...pal.subarray(765, 768)]).toEqual([255, 255, 255])
    }
  })
})

describe('validateWeatherManifest', () => {
  const good = (): Record<string, unknown> => JSON.parse(ON_DISK) as Record<string, unknown>

  it('accepts the checked-in manifest', () => {
    expect(() => validateWeatherManifest(good())).not.toThrow()
  })

  it('rejects unknown or missing keys, bad versions and bad palettes', () => {
    expect(() => validateWeatherManifest({ ...good(), extra: 1 })).toThrow(/keys/)
    const { atlas: _atlas, ...noAtlas } = good()
    expect(() => validateWeatherManifest(noAtlas)).toThrow(/keys/)
    expect(() => validateWeatherManifest({ ...good(), version: 2 })).toThrow(/version/)
    const palettes = [...(good().palettes as string[])]
    palettes[2] = encodeBase64(new Uint8Array(767))
    expect(() => validateWeatherManifest({ ...good(), palettes })).toThrow(/767 bytes/)
    expect(() => validateWeatherManifest({ ...good(), palettes: palettes.slice(0, 4) })).toThrow(/5 act palettes/)
  })

  it('rejects frames outside the atlas', () => {
    const raw = good()
    const cels = JSON.parse(JSON.stringify(raw.cels)) as Record<string, Array<Record<string, number>>>
    cels.rain3![0]!.ax = 239
    expect(() => validateWeatherManifest({ ...raw, cels })).toThrow(/outside the atlas/)
  })
})

describe('base64 helpers', () => {
  it('round-trip every padding length', () => {
    for (let n = 0; n < 8; n += 1) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 97 + 13) & 0xff)
      expect([...decodeBase64Strict(encodeBase64(bytes), 't')]).toEqual([...bytes])
    }
    expect(encodeBase64(new TextEncoder().encode('foobar'))).toBe('Zm9vYmFy')
    expect(encodeBase64(new TextEncoder().encode('fo'))).toBe('Zm8=')
  })

  it('reject malformed input', () => {
    expect(() => decodeBase64Strict('Zm9', 't')).toThrow(/multiple of 4/)
    expect(() => decodeBase64Strict('Zm=v', 't')).toThrow(/padding/)
    expect(() => decodeBase64Strict('Zm9*', 't')).toThrow(/invalid base64/)
  })
})
