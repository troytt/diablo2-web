/**
 * Deterministic weather scenes shared by the raster golden tests and the PNG export script.
 *
 * Each scene runs the 1.13c weather simulation from a fixed seed (with the weather-override
 * plugin's forced precipitation, so the state machine is at full strength) and rasterises the
 * lines exactly as DrawParticles 0x6fb2fe80 writes them into an 800 × 600 palette-index surface.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateWeatherManifest, type WeatherManifestData } from '../../src/common/pack-contract/index.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { PeriodOfDay } from '../../src/common/world/environment.ts'
import { buildWeatherColorTables } from '../../src/client/weather/weather-colors.ts'
import { weatherLevelInfo113c } from '../../src/client/weather/weather-controller.ts'
import { rasterizeWeatherLines, type WeatherPanel } from '../../src/client/weather/weather-raster.ts'
import { WeatherSim, type WeatherOverride } from '../../src/client/weather/weather-sim.ts'

export const GOLDEN_WIDTH = 800
export const GOLDEN_HEIGHT = 600

let manifest: WeatherManifestData | null = null

/** The checked-in `public/weather/weather.json`, validated. */
export function loadWeatherManifest(): WeatherManifestData {
  manifest ??= validateWeatherManifest(
    JSON.parse(readFileSync(join(process.cwd(), 'public/weather/weather.json'), 'utf8')) as unknown,
  )
  return manifest
}

export interface WeatherGoldenScene {
  readonly name: string
  readonly levelId: number
  readonly override: Exclude<WeatherOverride, 'off'>
  readonly period: PeriodOfDay
  readonly panel: WeatherPanel
  readonly seed: number
  readonly ticks: number
}

export const WEATHER_GOLDEN_SCENES: readonly WeatherGoldenScene[] = [
  // Rogue Encampment, day.
  { name: 'rain-act1-day', levelId: 1, override: 'rain', period: PeriodOfDay.Day, panel: 0, seed: 0x1234, ticks: 300 },
  // Rogue Encampment, night, right panel open (left half of the view).
  { name: 'rain-act1-night-panel1', levelId: 1, override: 'rain', period: PeriodOfDay.Night, panel: 1, seed: 0x77, ticks: 300 },
  // Frigid Highlands, day.
  { name: 'snow-act5-day', levelId: 111, override: 'snow', period: PeriodOfDay.Day, panel: 0, seed: 0xbeef, ticks: 400 },
]

export interface RenderedWeatherScene {
  readonly width: number
  readonly height: number
  /** Palette index per pixel; 0 where nothing was written. */
  readonly indices: Uint8Array
  /** RGB palette (768 bytes) of the scene's act. */
  readonly palette: Uint8Array
  readonly particleCount: number
}

/** Runs `scene` and rasterises its last step. */
export function renderWeatherScene(scene: WeatherGoldenScene): RenderedWeatherScene {
  const data = loadWeatherManifest()
  const act = weatherLevelInfo113c(scene.levelId).act
  const palette = data.palettes[act - 1]!
  const sim = new WeatherSim({ rng: new D2Rng(scene.seed, 0x5eed), levels: weatherLevelInfo113c })
  sim.onGameInit()
  sim.loadWeather(scene.levelId, scene.levelId, {
    colors: buildWeatherColorTables(palette),
    frameCounts: { rain3: data.cels.rain3.length, rain4: data.cels.rain4.length, bubble3: data.cels.bubble3.length },
  })
  sim.setOverride(scene.override, scene.levelId)
  for (let tick = 1; tick <= scene.ticks; tick += 1) {
    sim.update({
      levelId: scene.levelId,
      tick,
      camDx: 0,
      camDy: 0,
      period: scene.period,
      width: GOLDEN_WIDTH,
      height: GOLDEN_HEIGHT,
    })
  }
  const indices = new Uint8Array(GOLDEN_WIDTH * GOLDEN_HEIGHT)
  rasterizeWeatherLines(
    { particles: sim.particles, snow: sim.snow, angle: sim.angle },
    GOLDEN_WIDTH,
    GOLDEN_HEIGHT,
    scene.panel,
    (x, y, color) => {
      indices[y * GOLDEN_WIDTH + x] = color
    },
  )
  return { width: GOLDEN_WIDTH, height: GOLDEN_HEIGHT, indices, palette, particleCount: sim.particles.count }
}

/** FNV-1a 32-bit. */
export function fnv1a32(bytes: Uint8Array): number {
  let h = 0x811c9dc5
  for (const b of bytes) {
    h ^= b
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}
