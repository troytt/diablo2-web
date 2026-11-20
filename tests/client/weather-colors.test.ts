/**
 * LoadWeather colour ramps (src/client/weather/weather-colors.ts), D2Client 0x6fb31750: 12 entries
 * per table, each the nearest act-palette entry (D2CMP #10049) to a fixed RGB target.
 */

import { describe, expect, it } from 'vitest'
import { buildWeatherColorTables } from '../../src/client/weather/weather-colors.ts'
import { loadWeatherManifest } from './weather-golden-scenes.ts'

const I = Array.from({ length: 12 }, (_, i) => i)
const K1 = [0, 6, 13, 20, 26, 33, 40, 46, 53, 60, 66, 73]
const K2 = [0, 3, 6, 10, 13, 16, 20, 23, 26, 30, 33, 36]
const K3 = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]

describe('buildWeatherColorTables (LoadWeather 0x6fb31750)', () => {
  it('uses k1 = trunc(80i/12), k2 = trunc(40i/12), k3 = trunc(24i/12)', () => {
    expect(I.map((i) => Math.trunc((80 * i) / 12))).toEqual(K1)
    expect(I.map((i) => Math.trunc((40 * i) / 12))).toEqual(K2)
    expect(I.map((i) => Math.trunc((24 * i) / 12))).toEqual(K3)
  })

  it('searches the exact targets (checked against a grey ramp palette)', () => {
    // Entry j = (j, j, j). A grey target g maps to j = g; a target (a, a + d, a) maps to the integer
    // nearest to a + d/3 (the minimum of 2(j − a)² + (j − a − d)²).
    const grey = new Uint8Array(768)
    for (let j = 0; j < 256; j += 1) grey.set([j, j, j], j * 3)
    const t = buildWeatherColorTables(grey)
    expect(t.snowGray).toEqual(K1.map((k) => 120 + k))
    expect(t.snowGrayAlt).toEqual(K1.map((k) => 170 + k))
    // (98 − k1, 123 − k1, 98 − k1): 98 + 25/3 = 106.33.
    expect(t.rainDay).toEqual(K1.map((k) => 106 - k))
    // (45 − k2, 55 − k2, 45 − k2): 45 + 10/3 = 48.33.
    expect(t.rainDuskDawn).toEqual(K2.map((k) => 48 - k))
    // (25 − k3, 30 − k3, 25 − k3): 25 + 5/3 = 26.67.
    expect(t.rainNight).toEqual(K3.map((k) => 27 - k))
  })

  it('finds exact target entries wherever they sit in the palette', () => {
    const pal = new Uint8Array(768).fill(255)
    const targets: Array<[string, (i: number) => [number, number, number]]> = [
      ['rainDay', (i) => [98 - K1[i]!, 123 - K1[i]!, 98 - K1[i]!]],
      ['rainDuskDawn', (i) => [45 - K2[i]!, 55 - K2[i]!, 45 - K2[i]!]],
      ['rainNight', (i) => [25 - K3[i]!, 30 - K3[i]!, 25 - K3[i]!]],
      ['snowGray', (i) => [120 + K1[i]!, 120 + K1[i]!, 120 + K1[i]!]],
      ['snowGrayAlt', (i) => [170 + K1[i]!, 170 + K1[i]!, 170 + K1[i]!]],
    ]
    // Spread the 60 targets over the palette in reverse so no table is a contiguous run.
    targets.forEach(([, f], t) => {
      for (const i of I) pal.set(f(i), (250 - (t * 12 + i) * 4) * 3)
    })
    const tables = buildWeatherColorTables(pal) as unknown as Record<string, readonly number[]>
    targets.forEach(([name], t) => {
      expect(tables[name]).toEqual(I.map((i) => 250 - (t * 12 + i) * 4))
    })
  })

  it('rejects a palette that is not 256 RGB triplets', () => {
    expect(() => buildWeatherColorTables(new Uint8Array(767))).toThrow(/767 bytes/)
  })

  it('builds dark-to-light rain ramps and a light grey snow ramp from the 1.13c act palettes', () => {
    const data = loadWeatherManifest()
    for (let act = 1; act <= 5; act += 1) {
      const pal = data.palettes[act - 1]!
      const t = buildWeatherColorTables(pal)
      const lum = (idx: number): number => pal[idx * 3]! + pal[idx * 3 + 1]! + pal[idx * 3 + 2]!
      for (const table of [t.rainDay, t.rainDuskDawn, t.rainNight, t.snowGray, t.snowGrayAlt]) {
        expect(table).toHaveLength(12)
        for (const idx of table) expect(idx).toBeGreaterThanOrEqual(0)
      }
      // Entry 0 is the brightest rain colour; the ramps darken toward entry 11.
      expect(lum(t.rainDay[0]!)).toBeGreaterThan(lum(t.rainDay[11]!))
      expect(lum(t.rainDuskDawn[0]!)).toBeGreaterThanOrEqual(lum(t.rainDuskDawn[11]!))
      // Snow brightens toward entry 11.
      expect(lum(t.snowGray[11]!)).toBeGreaterThan(lum(t.snowGray[0]!))
      // Day rain is brighter than dusk / dawn rain, which is brighter than night rain.
      expect(lum(t.rainDay[0]!)).toBeGreaterThan(lum(t.rainDuskDawn[0]!))
      expect(lum(t.rainDuskDawn[0]!)).toBeGreaterThan(lum(t.rainNight[0]!))
    }
  })
})
