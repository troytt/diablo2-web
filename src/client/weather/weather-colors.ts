/**
 * The LoadWeather colour ramps, D2Client 0x6fb31750 (loop 0x6fb31800..0x6fb318dc).
 *
 * Each of the 12 entries is the palette index nearest (D2Win #10190 → D2CMP #10049, see
 * `src/common/formats/palette-nearest.ts`) to a fixed RGB target, searched in the act palette that is
 * installed when the act loads:
 *
 * | table        | VA         | target (i = 0..11)              |
 * |--------------|------------|---------------------------------|
 * | rainDay      | 0x6fbc38d4 | (98 − k1, 123 − k1, 98 − k1)    |
 * | rainDuskDawn | 0x6fbc38a0 | (45 − k2, 55 − k2, 45 − k2)     |
 * | rainNight    | 0x6fbc38f8 | (25 − k3, 30 − k3, 25 − k3)     |
 * | snowGray     | 0x6fbc38e0 | grey 120 + k1                   |
 * | snowGrayAlt  | 0x6fbc3940 | grey 170 + k1 (Glide only)      |
 *
 * with `k1 = trunc(80i / 12)`, `k2 = trunc(40i / 12)`, `k3 = trunc(24i / 12)`. Every target has
 * byte 0 == byte 2, so the palette's R/B byte order does not change the result.
 */

import { nearestPaletteIndex } from '../../common/formats/palette-nearest.ts'
import type { WeatherColorTables } from './weather-sim.ts'

export interface WeatherColorTables113c extends WeatherColorTables {
  /** 0x6fbc3940: built by LoadWeather but only read by the Glide branch of SnowColor (unused here). */
  readonly snowGrayAlt: readonly number[]
}

/** Builds the five ramps from a 256-entry palette (768 bytes, three per entry). */
export function buildWeatherColorTables(palette: Uint8Array): WeatherColorTables113c {
  if (palette.length !== 768) {
    throw new Error(`buildWeatherColorTables: palette has ${String(palette.length)} bytes, need 768`)
  }
  const rainDay: number[] = []
  const rainDuskDawn: number[] = []
  const rainNight: number[] = []
  const snowGray: number[] = []
  const snowGrayAlt: number[] = []
  for (let i = 0; i < 12; i += 1) {
    const k1 = Math.trunc((80 * i) / 12)
    const k2 = Math.trunc((40 * i) / 12)
    const k3 = Math.trunc((24 * i) / 12)
    rainDay.push(nearestPaletteIndex(palette, 98 - k1, 123 - k1, 98 - k1))
    rainDuskDawn.push(nearestPaletteIndex(palette, 45 - k2, 55 - k2, 45 - k2))
    rainNight.push(nearestPaletteIndex(palette, 25 - k3, 30 - k3, 25 - k3))
    snowGray.push(nearestPaletteIndex(palette, 120 + k1, 120 + k1, 120 + k1))
    snowGrayAlt.push(nearestPaletteIndex(palette, 170 + k1, 170 + k1, 170 + k1))
  }
  return { rainDay, rainDuskDawn, rainNight, snowGray, snowGrayAlt }
}
