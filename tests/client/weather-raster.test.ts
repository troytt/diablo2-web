/**
 * 1.13c weather drawing (src/client/weather/weather-raster.ts): the D2DDraw line rasteriser behind
 * D2gfx #10010, the DrawParticles 0x6fb2fe80 view rect and particle rules, the DrawCels 0x6fb2fc70
 * overlay visibility test, and pinned raster goldens of full-strength rain / snow.
 */

import { describe, expect, it } from 'vitest'
import { FogPool } from '../../src/client/weather/fog-pool.ts'
import { FOG_SIN_TABLE, fogCos, fogSin } from '../../src/client/weather/fog-sin-table.ts'
import {
  drawLine113c,
  forEachVisibleWeatherOverlay,
  rasterizeWeatherLines,
  SNOW_SEGMENTS_113C,
  WEATHER_CONTROL_PANEL_ROWS,
  weatherClipRect,
  type WeatherPanel,
} from '../../src/client/weather/weather-raster.ts'
import type { WeatherOverlay, WeatherParticle } from '../../src/client/weather/weather-sim.ts'
import { fnv1a32, renderWeatherScene, WEATHER_GOLDEN_SCENES } from './weather-golden-scenes.ts'

type Px = readonly [number, number]

function line(x1: number, y1: number, x2: number, y2: number): Px[] {
  const out: Px[] = []
  drawLine113c(x1, y1, x2, y2, (x, y) => out.push([x, y]))
  return out
}

function zeroParticle(p: WeatherParticle): void {
  p.x = 0
  p.y = 0
  p.yEnd = 0
  p.sizeOrLen = 0
  p.speed = 0
  p.phase = 0
  p.landed = 0
  p.landTicks = 0
  p.color = 0
  p.alpha = 0
}

function particlePool(): FogPool<WeatherParticle> {
  return new FogPool<WeatherParticle>(
    16,
    () => ({ serial: 0, x: 0, y: 0, yEnd: 0, sizeOrLen: 0, speed: 0, phase: 0, landed: 0, landTicks: 0, color: 0, alpha: 0 }),
    zeroParticle,
  )
}

function addParticle(pool: FogPool<WeatherParticle>, fields: Partial<WeatherParticle>): number {
  const i = pool.alloc()
  if (i < 0) throw new Error('pool full')
  Object.assign(pool.records[i]!, fields)
  return i
}

function overlayPool(): FogPool<WeatherOverlay> {
  return new FogPool<WeatherOverlay>(
    8,
    () => ({ serial: 0, x: 0, y: 0, type: 0, frame: 0, delay: 0 }),
    (o) => {
      o.x = 0
      o.y = 0
      o.type = 0
      o.frame = 0
      o.delay = 0
    },
  )
}

interface Written {
  readonly x: number
  readonly y: number
  readonly color: number
}

function raster(
  particles: FogPool<WeatherParticle>,
  opts: { snow?: boolean; angle?: number; width?: number; height?: number; panel?: WeatherPanel } = {},
): Written[] {
  const out: Written[] = []
  rasterizeWeatherLines(
    { particles, snow: opts.snow ?? false, angle: opts.angle ?? 128 },
    opts.width ?? 800,
    opts.height ?? 600,
    opts.panel ?? 0,
    (x, y, color) => out.push({ x, y, color }),
  )
  return out
}

describe('drawLine113c (D2DDraw 0x6f8c65c0 biased Bresenham)', () => {
  it('stops the minor axis one step short: (0,0)→(2,2) plots (0,0) (1,0) (2,1)', () => {
    expect(line(0, 0, 2, 2)).toEqual([
      [0, 0],
      [1, 0],
      [2, 1],
    ])
  })

  it('plots one pixel for a zero-length line', () => {
    expect(line(5, 7, 5, 7)).toEqual([[5, 7]])
  })

  it('draws axis-aligned lines including both ends', () => {
    expect(line(0, 0, 3, 0)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ])
    expect(line(0, 0, 0, -3)).toEqual([
      [0, 0],
      [0, -1],
      [0, -2],
      [0, -3],
    ])
  })

  it('advances the minor axis only when the error exceeds the major delta (steep)', () => {
    // dx = 1, dy = 4: err reaches 4 but never exceeds it, so x never moves.
    expect(line(0, 0, 1, 4)).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ])
    expect(line(0, 0, 3, 9).at(-1)).toEqual([2, 9])
  })

  it('handles negative directions', () => {
    expect(line(0, 0, -4, -2)).toEqual([
      [0, 0],
      [-1, 0],
      [-2, 0],
      [-3, -1],
      [-4, -1],
    ])
  })

  it('always plots max(|dx|, |dy|) + 1 pixels, each one step from the previous', () => {
    for (let x2 = -6; x2 <= 6; x2 += 1) {
      for (let y2 = -6; y2 <= 6; y2 += 1) {
        const px = line(1, -2, x2, y2)
        expect(px.length).toBe(Math.max(Math.abs(x2 - 1), Math.abs(y2 + 2)) + 1)
        expect(px[0]).toEqual([1, -2])
        for (let i = 1; i < px.length; i += 1) {
          expect(Math.abs(px[i]![0] - px[i - 1]![0])).toBeLessThanOrEqual(1)
          expect(Math.abs(px[i]![1] - px[i - 1]![1])).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('weatherClipRect (DrawParticles 0x6fb2fe80 / DrawCels 0x6fb2fc70)', () => {
  it('excludes the 47 control panel rows', () => {
    expect(WEATHER_CONTROL_PANEL_ROWS).toBe(47)
    expect(weatherClipRect(800, 600, 0)).toEqual({ xmin: 0, xmax: 800, ymax: 553 })
    expect(weatherClipRect(640, 480, 0)).toEqual({ xmin: 0, xmax: 640, ymax: 433 })
  })

  it('keeps the left half for panel 1 and the right half for panel 2 (W/4 truncates)', () => {
    expect(weatherClipRect(800, 600, 1)).toEqual({ xmin: 0, xmax: 400, ymax: 553 })
    expect(weatherClipRect(800, 600, 2)).toEqual({ xmin: 400, xmax: 800, ymax: 553 })
    // W = 803: W/4 = 200, so panel 1 keeps [0, 403) and panel 2 keeps [400, 803).
    expect(weatherClipRect(803, 600, 1)).toEqual({ xmin: 0, xmax: 403, ymax: 553 })
    expect(weatherClipRect(803, 600, 2)).toEqual({ xmin: 400, xmax: 803, ymax: 553 })
  })

  it('rejects bad screens and panels', () => {
    expect(() => weatherClipRect(0, 600, 0)).toThrow(/bad screen/)
    expect(() => weatherClipRect(800, 47, 0)).toThrow(/bad screen/)
    expect(() => weatherClipRect(800.5, 600, 0)).toThrow(/bad screen/)
    expect(() => weatherClipRect(800, 600, 3 as WeatherPanel)).toThrow(/panel 3/)
  })
})

describe('rasterizeWeatherLines (DrawParticles 0x6fb2fe80)', () => {
  it('uses the Fog #10083 / #10084 table values (cos = sin shifted by 128)', () => {
    expect(fogSin(128)).toBe(1)
    expect(fogCos(0)).toBe(1)
    expect(fogCos(128)).toBe(FOG_SIN_TABLE[256])
    expect(fogCos(128)).toBeLessThan(0)
  })

  it('draws a falling streak of trunc(cos·len), trunc(sin·len)', () => {
    const pool = particlePool()
    addParticle(pool, { x: 100, y: 100, yEnd: 500, sizeOrLen: 20, color: 33 })
    // angle 128: sin = 1, cos = -8.7e-8 → dx = trunc(-1.7e-6) = 0, dy = 20.
    const px = raster(pool, { angle: 128 })
    expect(px).toHaveLength(21)
    expect(px.every((p) => p.x === 100 && p.color === 33)).toBe(true)
    expect(px[0]).toMatchObject({ x: 100, y: 100 })
    expect(px.at(-1)).toMatchObject({ x: 100, y: 120 })
  })

  it('cuts the streak at the landing line with a truncating signed division', () => {
    const pool = particlePool()
    addParticle(pool, { x: 100, y: 100, yEnd: 109, sizeOrLen: 20, color: 7 })
    // angle 96: dx = trunc(0.3827·20) = 7, dy = trunc(0.9239·20) = 18 > room 9
    // → dx = trunc(9·7/18) = 3, dy = 9; the biased line ends at (102, 109).
    expect(Math.trunc(fogCos(96) * 20)).toBe(7)
    expect(Math.trunc(fogSin(96) * 20)).toBe(18)
    const px = raster(pool, { angle: 96 })
    expect(px).toHaveLength(10)
    expect(px.at(-1)).toMatchObject({ x: 102, y: 109 })

    // Leaning left: dx = -7 → trunc(9·-7/18) = trunc(-3.5) = -3 (toward zero).
    const left = particlePool()
    addParticle(left, { x: 100, y: 100, yEnd: 109, sizeOrLen: 20, color: 7 })
    expect(Math.trunc(fogCos(160) * 20)).toBe(-7)
    const lpx = raster(left, { angle: 160 })
    expect(lpx).toHaveLength(10)
    expect(lpx.at(-1)).toMatchObject({ x: 98, y: 109 })
  })

  it('draws a falling streak when either end is in view, clipped to the surface', () => {
    const pool = particlePool()
    // Starts above the screen, ends inside it.
    addParticle(pool, { x: 10, y: -5, yEnd: 500, sizeOrLen: 10, color: 1 })
    // Starts inside the control panel rows (not in view), ends further down: skipped.
    addParticle(pool, { x: 20, y: 560, yEnd: 900, sizeOrLen: 10, color: 2 })
    // Starts in view, ends below the view rect but on the surface: drawn to the surface edge only.
    addParticle(pool, { x: 30, y: 550, yEnd: 900, sizeOrLen: 60, color: 3 })
    const px = raster(pool, { angle: 128 })
    const by = (c: number): Written[] => px.filter((p) => p.color === c)
    expect(by(1).map((p) => p.y)).toEqual([0, 1, 2, 3, 4, 5])
    expect(by(2)).toHaveLength(0)
    // y = 550..599: the rows 553..599 of the control panel are written too (DrawLine only clips
    // to the surface), rows ≥ 600 are dropped.
    expect(by(3).map((p) => p.y)).toEqual(Array.from({ length: 50 }, (_, i) => 550 + i))
  })

  it('draws a landed drop as one pixel when it is in view', () => {
    const pool = particlePool()
    addParticle(pool, { x: 5, y: 6, yEnd: 6, sizeOrLen: 30, landed: 1, color: 9 })
    addParticle(pool, { x: 5, y: 553, yEnd: 553, sizeOrLen: 30, landed: 1, color: 10 })
    expect(raster(pool)).toEqual([{ x: 5, y: 6, color: 9 }])
  })

  it('draws snow flakes as SEG rows size and size + 1, only when the anchor is in view', () => {
    for (let size = 0; size < 8; size += 1) {
      const pool = particlePool()
      addParticle(pool, { x: 50, y: 60, sizeOrLen: size, color: 4 })
      const expected: Written[] = []
      for (const row of [SNOW_SEGMENTS_113C[size]!, SNOW_SEGMENTS_113C[size + 1]!]) {
        for (const [x, y] of line(50 + row[0], 60 + row[1], 50 + row[2], 60 + row[3])) expected.push({ x, y, color: 4 })
      }
      expect(raster(pool, { snow: true })).toEqual(expected)
    }
    const pool = particlePool()
    addParticle(pool, { x: 50, y: 60, sizeOrLen: 8, color: 4 })
    addParticle(pool, { x: -1, y: 60, sizeOrLen: 1, color: 4 })
    addParticle(pool, { x: 50, y: 553, sizeOrLen: 1, color: 4 })
    expect(raster(pool, { snow: true })).toEqual([])
  })

  it('applies the panel rect to the anchors', () => {
    const pool = particlePool()
    addParticle(pool, { x: 399, y: 10, sizeOrLen: 0, color: 1 })
    addParticle(pool, { x: 400, y: 10, sizeOrLen: 0, color: 2 })
    const colors = (panel: WeatherPanel): number[] => [...new Set(raster(pool, { snow: true, panel }).map((p) => p.color))]
    expect(colors(0)).toEqual([1, 2])
    expect(colors(1)).toEqual([1])
    expect(colors(2)).toEqual([2])
  })

  it('writes in slot order so a later particle wins a shared pixel', () => {
    const pool = particlePool()
    addParticle(pool, { x: 70, y: 70, yEnd: 70, landed: 1, color: 1 })
    addParticle(pool, { x: 70, y: 70, yEnd: 70, landed: 1, color: 2 })
    expect(raster(pool).map((p) => p.color)).toEqual([1, 2])
  })

  it('skips free slots', () => {
    const pool = particlePool()
    const a = addParticle(pool, { x: 1, y: 1, landed: 1, color: 1 })
    addParticle(pool, { x: 2, y: 2, landed: 1, color: 2 })
    pool.free(a)
    expect(raster(pool)).toEqual([{ x: 2, y: 2, color: 2 }])
  })
})

describe('forEachVisibleWeatherOverlay (DrawCels 0x6fb2fc70)', () => {
  it('visits live records inside the view rect in slot order without freeing the rest', () => {
    const pool = overlayPool()
    const put = (x: number, y: number): void => {
      const i = pool.alloc()
      Object.assign(pool.records[i]!, { x, y, type: 2 })
    }
    put(10, 10)
    put(10, 553)
    put(500, 20)
    put(-1, 20)
    put(399, 552)
    const seen: Array<[number, number]> = []
    forEachVisibleWeatherOverlay(pool, 800, 600, 0, (o) => seen.push([o.x, o.y]))
    expect(seen).toEqual([
      [10, 10],
      [500, 20],
      [399, 552],
    ])
    expect(pool.count).toBe(5)
    const left: Array<[number, number]> = []
    forEachVisibleWeatherOverlay(pool, 800, 600, 1, (o) => left.push([o.x, o.y]))
    expect(left).toEqual([
      [10, 10],
      [399, 552],
    ])
  })
})

/**
 * Pinned rasters of full-strength weather (seeded; see weather-golden-scenes.ts). They change only
 * when the simulation, the line rasteriser or the colour ramps change; before re-pinning, render the
 * scene with `renderWeatherScene`, encode `indices` through its palette and inspect the image.
 */
const GOLDEN_HASHES: Readonly<Record<string, number>> = {
  'rain-act1-day': 0xe7dc16ad,
  'rain-act1-night-panel1': 0xc6feda61,
  'snow-act5-day': 0x832e7f52,
}

describe('weather raster goldens', () => {
  for (const scene of WEATHER_GOLDEN_SCENES) {
    it(`${scene.name} matches its pinned raster`, () => {
      const out = renderWeatherScene(scene)
      expect(out.particleCount).toBeGreaterThan(0)
      let written = 0
      for (const v of out.indices) if (v !== 0) written += 1
      expect(written).toBeGreaterThan(100)
      expect(fnv1a32(out.indices).toString(16)).toBe(GOLDEN_HASHES[scene.name]!.toString(16))
    })
  }
})
