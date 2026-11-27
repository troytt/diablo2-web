/**
 * Diablo II v1.13c weather drawing in pure, testable form: the DirectDraw line rasteriser, the
 * DrawParticles view rect and particle → pixel rules, and the DrawCels overlay visibility test.
 *
 * Coordinates are those of the last weather step (`WeatherSim` screen space). The renderer anchors
 * them to the world at the step's camera origin (see `weather-controller.ts`).
 */

import type { FogPool } from './fog-pool.ts'
import { fogCos, fogSin } from './fog-sin-table.ts'
import type { WeatherOverlay, WeatherParticle } from './weather-sim.ts'

/**
 * `[0x6fbcc414]`: 0 no side panel; 1 only the right panel is open, so the view is the left half;
 * 2 only the left panel is open, so the view is the right half. Both panels open counts as 0.
 */
export type WeatherPanel = 0 | 1 | 2

/** The view rect of DrawParticles 0x6fb2fe80 and DrawCels 0x6fb2fc70: `x ∈ [xmin, xmax)`, `y ∈ [0, ymax)`. */
export interface WeatherClipRect {
  readonly xmin: number
  readonly xmax: number
  /** `H − 47`: the control panel rows are excluded. */
  readonly ymax: number
}

/** Pixel callback of {@link drawLine113c}. */
export type WeatherPlot = (x: number, y: number) => void

/**
 * Snow flake segments, D2Client 0x6fb84988: nine `{x1, y1, x2, y2}` int32 rows. A flake of size `s`
 * draws rows `s` and `s + 1`.
 */
export const SNOW_SEGMENTS_113C: readonly (readonly [number, number, number, number])[] = Object.freeze([
  [0, 0, 0, 1],
  [-1, -1, 0, 0],
  [0, -1, 0, 1],
  [1, 0, -1, 1],
  [1, 0, 0, 1],
  [2, -1, -1, 1],
  [1, 1, -2, -1],
  [2, 1, -2, -1],
  [2, -1, -2, 2],
] as const)

/** Rows below the view that belong to the 1.13c control panel (DrawParticles / DrawCels). */
export const WEATHER_CONTROL_PANEL_ROWS = 47

/**
 * View rect for a screen of `width × height` (DrawParticles 0x6fb2fe80, DrawCels 0x6fb2fc70).
 * `W / 4` is a signed division that truncates toward zero.
 */
export function weatherClipRect(width: number, height: number, panel: WeatherPanel): WeatherClipRect {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= WEATHER_CONTROL_PANEL_ROWS) {
    throw new Error(`weatherClipRect: bad screen ${String(width)}x${String(height)}`)
  }
  const quarter = Math.trunc(width / 4)
  const ymax = height - WEATHER_CONTROL_PANEL_ROWS
  switch (panel) {
    case 0:
      return { xmin: 0, xmax: width, ymax }
    case 1:
      return { xmin: 0, xmax: width - 2 * quarter, ymax }
    case 2:
      return { xmin: 2 * quarter, xmax: width, ymax }
    default:
      throw new Error(`weatherClipRect: panel ${String(panel)} is not 0, 1 or 2`)
  }
}

/** Palette index DrawFlash 0x6fb2fe10 fills with (`push 0xff`); white in every act palette. */
export const LIGHTNING_FLASH_PALETTE_INDEX_113C = 0xff

/** The lightning flash: fill columns `[x1, x2)` × rows `[0, ymax)` with palette index 255, opaque. */
export interface LightningFlashRect {
  readonly x1: number
  readonly x2: number
  readonly ymax: number
}

/**
 * DrawFlash 0x6fb2fe10: D2gfx #10014 DrawRect(x1, 0, x2, H − 47, 0xff, mode 5) over the world view
 * (`x1 = 2·trunc(W/4)` when only the left panel is open, `x2 = W − 2·trunc(W/4)` when only the right
 * one is). D2gfx 0x6fa8ba30 drops it when `x2 < x1 || y2 < y1`; the D2DDraw fill 0x6f8c6720 clamps
 * every coordinate to `[0, W−1]` / `[0, H−1]` (0x6f8c673b..0x6f8c679a), skips an empty result and
 * fills `[x1', x2') × [y1', y2')`, so the rightmost column is never flashed. Mode 5 remaps to the
 * opaque mode 0 (table 0x6f8ceb98). D2Gdi and D2Direct3D clamp the same way; the D2Glide bound is
 * UNVERIFIED.
 *
 * @returns `null` when nothing is filled.
 */
export function lightningFlashRect113c(width: number, height: number, panel: WeatherPanel): LightningFlashRect | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`lightningFlashRect113c: bad screen ${String(width)}x${String(height)}`)
  }
  const quarter = Math.trunc(width / 4)
  let x1 = 0
  let x2 = width
  if (panel === 1) x2 = width - 2 * quarter
  else if (panel === 2) x1 = 2 * quarter
  else if (panel !== 0) throw new Error(`lightningFlashRect113c: panel ${String(panel)} is not 0, 1 or 2`)
  const y2 = height - WEATHER_CONTROL_PANEL_ROWS
  if (x2 < x1 || y2 < 0) return null
  const clampX = (v: number): number => Math.min(Math.max(v, 0), width - 1)
  const clampY = (v: number): number => Math.min(Math.max(v, 0), height - 1)
  const cx1 = clampX(x1)
  const cx2 = clampX(x2)
  const cy2 = clampY(y2)
  if (cx1 === cx2 || cy2 === 0) return null
  return { x1: cx1, x2: cx2, ymax: cy2 }
}

function inRect(clip: WeatherClipRect, x: number, y: number): boolean {
  return x >= clip.xmin && x < clip.xmax && y >= 0 && y < clip.ymax
}

/**
 * D2gfx #10010 DrawLine as implemented by the DirectDraw renderer (D2gfx 0x6fa8b9c0 → D2DDraw
 * 0x6f8c65c0). It is a biased Bresenham: the start pixel is plotted, then one pixel per major-axis
 * step, and the minor axis only advances once the error is strictly greater than the major delta.
 * The minor axis therefore ends one step short of the end point, e.g. (0,0)→(2,2) plots
 * (0,0), (1,0), (2,1). A zero-length line plots one pixel. The write is an opaque palette store; the
 * alpha argument is ignored. `plot` receives every pixel; surface clipping is the caller's job.
 */
export function drawLine113c(x1: number, y1: number, x2: number, y2: number, plot: WeatherPlot): void {
  let dx = x2 - x1
  let dy = y2 - y1
  const sx = dx < 0 ? -1 : 1
  const sy = dy < 0 ? -1 : 1
  dx = Math.abs(dx)
  dy = Math.abs(dy)
  let x = x1
  let y = y1
  plot(x, y)
  let err = 0
  if (dx < dy) {
    for (let n = dy; n > 0; n -= 1) {
      y += sy
      err += dx
      if (err > dy) {
        x += sx
        err -= dy
      }
      plot(x, y)
    }
  } else {
    for (let n = dx; n > 0; n -= 1) {
      x += sx
      err += dy
      if (err > dx) {
        y += sy
        err -= dx
      }
      plot(x, y)
    }
  }
}

/** What DrawParticles reads from the simulation. */
export interface WeatherLineSource {
  readonly particles: FogPool<WeatherParticle>
  /** `[0x6fbcbf78]`. */
  readonly snow: boolean
  /** Wind angle `[0x6fbc3918]`, 512 units per turn. */
  readonly angle: number
}

/** Receives one written pixel: position in weather-step coordinates and its palette index. */
export type WeatherPixelSink = (x: number, y: number, color: number) => void

/** Receives one coalesced axis-aligned pixel span in weather-step coordinates and its palette index. */
export type WeatherSpanSink = (x: number, y: number, w: number, h: number, color: number) => void

/**
 * Coalesces contiguous horizontal or vertical pixel runs from {@link rasterizeWeatherLines} into axis-aligned
 * `w × 1` or `1 × h` spans with identical pixel coverage and write order.
 */
export function rasterizeWeatherLineSpans(
  src: WeatherLineSource,
  width: number,
  height: number,
  panel: WeatherPanel,
  sink: WeatherSpanSink,
): void {
  let spanX = 0
  let spanY = 0
  let spanW = 0
  let spanH = 0
  let spanColor = -1
  let dir = 0

  const flush = (): void => {
    if (spanW > 0) {
      sink(spanX, spanY, spanW, spanH, spanColor)
      spanW = 0
      spanH = 0
      dir = 0
    }
  }

  rasterizeWeatherLines(src, width, height, panel, (x, y, color) => {
    if (spanW === 0) {
      spanX = x
      spanY = y
      spanW = 1
      spanH = 1
      spanColor = color
      dir = 0
      return
    }
    if (color === spanColor) {
      if (dir === 0) {
        if (x === spanX && y === spanY + 1) {
          spanH = 2
          dir = 1
          return
        }
        if (x === spanX && y === spanY - 1) {
          spanY = y
          spanH = 2
          dir = -1
          return
        }
        if (y === spanY && x === spanX + 1) {
          spanW = 2
          dir = 2
          return
        }
        if (y === spanY && x === spanX - 1) {
          spanX = x
          spanW = 2
          dir = -2
          return
        }
      } else if (dir === 1 && x === spanX && y === spanY + spanH) {
        spanH += 1
        return
      } else if (dir === -1 && x === spanX && y === spanY - 1) {
        spanY = y
        spanH += 1
        return
      } else if (dir === 2 && y === spanY && x === spanX + spanW) {
        spanW += 1
        return
      } else if (dir === -2 && y === spanY && x === spanX - 1) {
        spanX = x
        spanW += 1
        return
      }
    }
    flush()
    spanX = x
    spanY = y
    spanW = 1
    spanH = 1
    spanColor = color
    dir = 0
  })
  flush()
}

/**
 * DrawParticles 0x6fb2fe80 (DirectDraw path): every pixel the rain / snow lines write, in vanilla
 * write order (particle slot order; a later write to the same pixel wins). Pixels outside the
 * `width × height` surface are dropped, as D2DDraw's DrawLine does.
 *
 * - Snow: skipped unless the anchor is in view and the size is 0..7; two SEG lines.
 * - Landed rain: one pixel when the anchor is in view.
 * - Falling rain: a streak of `trunc(cos·len), trunc(sin·len)` (Fog #10083 / #10084), cut at the
 *   landing line with a signed integer division; drawn when its start OR end is in view.
 *
 * The LowQuality skip (D2gfx #10047) does not exist in the port.
 */
export function rasterizeWeatherLines(
  src: WeatherLineSource,
  width: number,
  height: number,
  panel: WeatherPanel,
  sink: WeatherPixelSink,
): void {
  const clip = weatherClipRect(width, height, panel)
  let color = 0
  const put: WeatherPlot = (x, y) => {
    if (x >= 0 && x < width && y >= 0 && y < height) sink(x, y, color)
  }
  const cos = fogCos(src.angle)
  const sin = fogSin(src.angle)
  const pool = src.particles
  for (let i = 0; i <= pool.maxIndex; i += 1) {
    const p = pool.records[i]!
    if (p.serial === 0) continue
    color = p.color
    if (src.snow) {
      const size = p.sizeOrLen
      if (!inRect(clip, p.x, p.y) || size < 0 || size >= 8) continue
      const a = SNOW_SEGMENTS_113C[size]!
      const b = SNOW_SEGMENTS_113C[size + 1]!
      drawLine113c(p.x + a[0], p.y + a[1], p.x + a[2], p.y + a[3], put)
      drawLine113c(p.x + b[0], p.y + b[1], p.x + b[2], p.y + b[3], put)
    } else if (p.landed) {
      if (inRect(clip, p.x, p.y)) drawLine113c(p.x, p.y, p.x, p.y, put)
    } else {
      let dx = Math.trunc(cos * p.sizeOrLen)
      let dy = Math.trunc(sin * p.sizeOrLen)
      const room = p.yEnd - p.y
      if (dy > room) {
        // Move sets `landed` as soon as y passes yEnd, so room >= 0 here and dy >= 1.
        if (dy === 0) throw new Error(`rasterizeWeatherLines: particle ${String(i)} would divide by zero`)
        dx = Math.trunc((room * dx) / dy)
        dy = room
      }
      const ex = p.x + dx
      const ey = p.y + dy
      if (inRect(clip, p.x, p.y) || inRect(clip, ex, ey)) drawLine113c(p.x, p.y, ex, ey, put)
    }
  }
}

/**
 * DrawCels 0x6fb2fc70, screen-space mode: the records drawn this frame, in slot order. A record
 * whose anchor is outside the view rect is skipped (not freed).
 *
 * Vanilla adds `∓W/4` to X while a single side panel is open, because it shifts the whole world
 * view. The port never shifts the world, so the anchor is tested unshifted against the same rect.
 */
export function forEachVisibleWeatherOverlay(
  pool: FogPool<WeatherOverlay>,
  width: number,
  height: number,
  panel: WeatherPanel,
  visit: (overlay: WeatherOverlay) => void,
): void {
  const clip = weatherClipRect(width, height, panel)
  for (let i = 0; i <= pool.maxIndex; i += 1) {
    const o = pool.records[i]!
    if (o.serial === 0) continue
    if (!inRect(clip, o.x, o.y)) continue
    visit(o)
  }
}
