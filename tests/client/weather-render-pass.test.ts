/**
 * WeatherScenePass (src/client/weather/weather-render-pass.ts): what the scene draws for the 1.13c
 * weather. Splashes / bubbles (DrawCels 0x6fb2fc70, additive) are anchored at the last step's camera
 * origin, the rain / snow lines (DrawParticles 0x6fb2fe80) are one solid pixel per written palette
 * index, and a 136-level sweep through controller + pass shows lines exactly on the Levels.txt
 * `Rain` levels and bubbles exactly on the `Mud` levels.
 */

import { describe, expect, it, vi } from 'vitest'
import type { AtlasHandle } from '../../src/client/render/renderer.ts'
import {
  DT1_MATERIAL_WATER,
  FLOOR_TILE_HALF_WIDTH,
  WeatherController,
  type WeatherFloorTile,
} from '../../src/client/weather/weather-controller.ts'
import { rasterizeWeatherLines, type WeatherPanel } from '../../src/client/weather/weather-raster.ts'
import {
  WeatherScenePass,
  weatherPanelFromSidePanels,
  type SceneWeatherFrame,
  type WeatherDrawTarget,
} from '../../src/client/weather/weather-render-pass.ts'
import type { WeatherOverride } from '../../src/client/weather/weather-sim.ts'
import type { PackedWeatherCelFrame } from '../../src/common/pack-contract/index.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { PeriodOfDay } from '../../src/common/world/environment.ts'
import { loadWeatherManifest } from './weather-golden-scenes.ts'

type Rgba = readonly [number, number, number, number]

interface DrawCall {
  readonly src: { x: number; y: number; width: number; height: number }
  readonly x: number
  readonly y: number
  readonly atlas: AtlasHandle | undefined
  readonly blendMode: string | undefined
}

/** Records every renderer call the weather makes. */
class RecordingTarget implements WeatherDrawTarget {
  readonly atlases: Array<{ indices: Uint8Array; width: number; height: number; handle: AtlasHandle }> = []
  readonly draws: DrawCall[] = []
  readonly solids: Array<[number, number, number, number, Rgba]> = []

  addIndexedAtlas(indices: Uint8Array, width: number, height: number): AtlasHandle {
    const handle = { texture: {} as WebGLTexture, width, height, indexed: true }
    this.atlases.push({ indices, width, height, handle })
    return handle
  }

  draw(...[frame, x, y, options]: Parameters<WeatherDrawTarget['draw']>): void {
    this.draws.push({
      src: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      x,
      y,
      atlas: options?.atlas,
      blendMode: options?.blendMode,
    })
  }

  drawSolid(...[x, y, w, h, color]: Parameters<WeatherDrawTarget['drawSolid']>): void {
    this.solids.push([x, y, w, h, color])
  }
}

const W = 800
const H = 600
const CAM_X = 1000
const CAM_Y = 2000
/** Screen (0, 0) in world pixels for the camera above. */
const ORIGIN_X = CAM_X - W / 2
const ORIGIN_Y = CAM_Y - H / 2

function frame(over: Partial<SceneWeatherFrame> = {}): SceneWeatherFrame {
  return { levelId: 1, tick: 1, camX: CAM_X, camY: CAM_Y, width: W, height: H, floorTiles: [], ...over }
}

function setup(
  options: { override?: WeatherOverride; panel?: () => WeatherPanel; levelId?: number; seed?: number } = {},
): { c: WeatherController; pass: WeatherScenePass } {
  const c = new WeatherController({ rng: new D2Rng(options.seed ?? 7, 0x5eed) })
  c.setAssets(loadWeatherManifest())
  c.onGameInit()
  if (options.override !== undefined) c.setOverride(options.override)
  c.onLoadAct(options.levelId ?? 1)
  const pass = new WeatherScenePass({
    controller: c,
    period: () => PeriodOfDay.Day,
    panel: options.panel ?? (() => 0),
    worldDrawn: () => true,
    fps: () => 25,
  })
  return { c, pass }
}

/** Puts one overlay into `pool` and returns it. */
function inject(
  pool: WeatherController['sim']['splashes'],
  o: { x: number; y: number; type: number; frame: number },
): void {
  const index = pool.alloc()
  if (index < 0) throw new Error('pool full')
  Object.assign(pool.records[index]!, o, { delay: 2 })
}

function expectedDraw(f: PackedWeatherCelFrame, x: number, y: number, atlas: AtlasHandle): DrawCall {
  return {
    src: { x: f.ax, y: f.ay, width: f.w, height: f.h },
    x: ORIGIN_X + x + f.ox,
    y: ORIGIN_Y + y + f.oy - f.h,
    atlas,
    blendMode: 'additive',
  }
}

describe('weatherPanelFromSidePanels ([0x6fbcc414])', () => {
  it('is 1 with only the right panel, 2 with only the left panel, otherwise 0', () => {
    expect(weatherPanelFromSidePanels(false, false)).toBe(0)
    expect(weatherPanelFromSidePanels(false, true)).toBe(1)
    expect(weatherPanelFromSidePanels(true, false)).toBe(2)
    expect(weatherPanelFromSidePanels(true, true)).toBe(0)
  })
})

describe('WeatherScenePass', () => {
  it('draws nothing (and uploads nothing) while the weather is inactive', () => {
    const c = new WeatherController({ rng: new D2Rng(1, 0x5eed) })
    c.setAssets(loadWeatherManifest())
    c.onGameInit()
    const panel = vi.fn((): WeatherPanel => 1)
    const pass = new WeatherScenePass({
      controller: c,
      period: () => PeriodOfDay.Day,
      panel,
      worldDrawn: () => true,
      fps: () => 25,
    })
    const target = new RecordingTarget()
    pass.beginFrame(frame())
    pass.drawGround(target)
    pass.drawLines(target)
    expect(target.atlases).toHaveLength(0)
    expect(target.draws).toHaveLength(0)
    expect(target.solids).toHaveLength(0)
    expect(panel).not.toHaveBeenCalled()
  })

  it('draws splashes then bubbles world-anchored at the step origin, additive, from one atlas upload per target', () => {
    const data = loadWeatherManifest()
    const { c, pass } = setup()
    pass.beginFrame(frame())
    expect([c.originX, c.originY]).toEqual([ORIGIN_X, ORIGIN_Y])
    c.sim.splashes.clearAll()
    c.sim.bubbles.clearAll()
    inject(c.sim.splashes, { x: 100, y: 200, type: 2, frame: 0 })
    inject(c.sim.splashes, { x: 300, y: 50, type: 3, frame: data.cels.rain4.length - 1 })
    // Outside the view rect (y >= H − 47, x < 0): kept in the pool, not drawn.
    inject(c.sim.splashes, { x: 10, y: H - 47, type: 2, frame: 0 })
    inject(c.sim.splashes, { x: -1, y: 10, type: 2, frame: 0 })
    inject(c.sim.bubbles, { x: 500, y: 400, type: 2, frame: 1 })

    const target = new RecordingTarget()
    pass.drawGround(target)
    expect(target.atlases).toHaveLength(1)
    const upload = target.atlases[0]!
    expect([upload.width, upload.height]).toEqual([data.atlas.width, data.atlas.height])
    expect(upload.indices).toBe(data.atlas.indices)
    expect(target.draws).toEqual([
      expectedDraw(data.cels.rain3[0]!, 100, 200, upload.handle),
      expectedDraw(data.cels.rain4[data.cels.rain4.length - 1]!, 300, 50, upload.handle),
      expectedDraw(data.cels.bubble3[1]!, 500, 400, upload.handle),
    ])
    expect(target.solids).toHaveLength(0)
    expect(c.sim.splashes.count).toBe(4)

    pass.drawGround(target)
    expect(target.atlases).toHaveLength(1)
    const other = new RecordingTarget()
    pass.drawGround(other)
    expect(other.atlases).toHaveLength(1)
    expect(other.draws.map((d) => d.atlas)).toEqual([other.atlases[0]!.handle, other.atlases[0]!.handle, other.atlases[0]!.handle])
  })

  it('clips overlays and lines to the view half of a single open side panel', () => {
    const { c, pass } = setup({ override: 'rain', panel: () => 1 })
    for (let tick = 1; tick <= 120; tick += 1) pass.beginFrame(frame({ tick }))
    c.sim.splashes.clearAll()
    c.sim.bubbles.clearAll()
    inject(c.sim.splashes, { x: W / 2 - 1, y: 100, type: 2, frame: 0 })
    inject(c.sim.splashes, { x: W / 2, y: 100, type: 2, frame: 0 })
    const target = new RecordingTarget()
    pass.drawGround(target)
    expect(target.draws).toHaveLength(1)
    expect(target.draws[0]!.x - ORIGIN_X).toBe(W / 2 - 1 + loadWeatherManifest().cels.rain3[0]!.ox)

    pass.drawLines(target)
    expect(target.solids.length).toBeGreaterThan(0)
    // A streak drawn because its start is in view may run a few pixels past the half; nothing starts far right.
    expect(Math.min(...target.solids.map(([x]) => x - ORIGIN_X))).toBeGreaterThanOrEqual(0)
    expect(Math.max(...target.solids.map(([x]) => x - ORIGIN_X))).toBeLessThan(W / 2 + 64)
  })

  it('writes every DrawParticles pixel as coalesced solid spans in the act palette colour, at the step origin', () => {
    const { c, pass } = setup({ override: 'rain' })
    for (let tick = 1; tick <= 200; tick += 1) pass.beginFrame(frame({ tick, camX: CAM_X + tick, camY: CAM_Y }))
    expect(c.sim.particles.count).toBeGreaterThan(0)

    const target = new RecordingTarget()
    pass.drawLines(target)
    const palette = c.palette
    const expectedPixels = new Map<string, Rgba>()
    let rawPixelWrites = 0
    rasterizeWeatherLines({ particles: c.sim.particles, snow: c.sim.snow, angle: c.sim.angle }, W, H, 0, (x, y, color) => {
      rawPixelWrites += 1
      expectedPixels.set(`${String(c.originX + x)},${String(c.originY + y)}`, [
        palette[color * 3]! / 255,
        palette[color * 3 + 1]! / 255,
        palette[color * 3 + 2]! / 255,
        1,
      ])
    })
    const actualPixels = new Map<string, Rgba>()
    let expandedPixelWrites = 0
    for (const [sx, sy, sw, sh, color] of target.solids) {
      for (let dy = 0; dy < sh; dy += 1) {
        for (let dx = 0; dx < sw; dx += 1) {
          expandedPixelWrites += 1
          actualPixels.set(`${String(sx + dx)},${String(sy + dy)}`, color)
        }
      }
    }
    expect(rawPixelWrites).toBeGreaterThan(100)
    expect(expandedPixelWrites).toBe(rawPixelWrites)
    expect(target.solids.length).toBeLessThan(rawPixelWrites)
    expect(actualPixels).toEqual(expectedPixels)
    expect(c.originX).toBe(ORIGIN_X + 200)
  })

  it('fails fast on an overlay type or frame without a cel', () => {
    const { c, pass } = setup()
    pass.beginFrame(frame())
    c.sim.splashes.clearAll()
    c.sim.bubbles.clearAll()
    inject(c.sim.splashes, { x: 100, y: 100, type: 1, frame: 0 })
    expect(() => pass.drawGround(new RecordingTarget())).toThrow(/splash type 1 has no cel/)

    c.sim.splashes.clearAll()
    inject(c.sim.splashes, { x: 100, y: 100, type: 2, frame: 999 })
    expect(() => pass.drawGround(new RecordingTarget())).toThrow(/Rain3 frame 999 of /)

    c.sim.splashes.clearAll()
    inject(c.sim.bubbles, { x: 100, y: 100, type: 3, frame: 0 })
    expect(() => pass.drawGround(new RecordingTarget())).toThrow(/bubble type 3 has no cel/)
  })
})

describe('WeatherScenePass 136-level sweep', () => {
  const range = (lo: number, hi: number): number[] => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  /** Levels.txt `Rain` (1.13c): the levels that draw rain or snow lines. */
  const RAIN = new Set([...range(1, 7), 17, 38, 39, ...range(75, 83), ...range(109, 112), 117, 120, 121, 136])
  /** Levels.txt `Mud` (1.13c): the levels that draw bubbles on water tiles. */
  const MUD = new Set(range(75, 83))

  /** 24 visible orientation-0 water floor tiles (diamond tops at screen (80..640, 100..340)). */
  const WATER: readonly WeatherFloorTile[] = Array.from({ length: 24 }, (_, i) => ({
    worldX: ORIGIN_X + 80 + (i % 8) * 80 - FLOOR_TILE_HALF_WIDTH,
    worldY: ORIGIN_Y + 100 + Math.floor(i / 8) * 120,
    type: 0,
    materialFlags: DT1_MATERIAL_WATER,
  }))

  /** Counts the draws by cel. */
  class CountingTarget implements WeatherDrawTarget {
    lines = 0
    splashes = 0
    bubbles = 0
    private readonly bubbleKeys: ReadonlySet<string>
    private readonly splashKeys: ReadonlySet<string>

    constructor() {
      const data = loadWeatherManifest()
      const key = (f: PackedWeatherCelFrame): string => `${String(f.ax)},${String(f.ay)},${String(f.w)},${String(f.h)}`
      this.bubbleKeys = new Set(data.cels.bubble3.map(key))
      this.splashKeys = new Set([...data.cels.rain3, ...data.cels.rain4].map(key))
    }

    addIndexedAtlas(_indices: Uint8Array, width: number, height: number): AtlasHandle {
      return { texture: {} as WebGLTexture, width, height, indexed: true }
    }

    draw(...[f]: Parameters<WeatherDrawTarget['draw']>): void {
      const key = `${String(f.x)},${String(f.y)},${String(f.width)},${String(f.height)}`
      if (this.bubbleKeys.has(key)) this.bubbles += 1
      else if (this.splashKeys.has(key)) this.splashes += 1
      else throw new Error(`draw of an unknown cel ${key}`)
    }

    drawSolid(): void {
      this.lines += 1
    }
  }

  it('draws lines exactly on the Rain levels and bubbles exactly on the Mud levels (all 136)', () => {
    const got: Array<[number, { lines: boolean; bubbles: boolean; splashes: boolean }]> = []
    const want: Array<[number, { lines: boolean; bubbles: boolean; splashes: boolean }]> = []
    for (let id = 1; id <= 136; id += 1) {
      const { pass } = setup({ levelId: id, seed: 1000 + id })
      const target = new CountingTarget()
      // Ramp-up lasts 250..500 ticks and the full state at least 3000, so 600 ticks end at full strength.
      for (let tick = 1; tick <= 600; tick += 1) {
        pass.beginFrame(frame({ levelId: id, tick, floorTiles: WATER }))
        if (tick % 5 === 0) {
          pass.drawGround(target)
          pass.drawLines(target)
        }
      }
      got.push([id, { lines: target.lines > 0, bubbles: target.bubbles > 0, splashes: target.splashes > 0 }])
      want.push([id, { lines: RAIN.has(id), bubbles: MUD.has(id), splashes: target.splashes > 0 && RAIN.has(id) }])
    }
    expect(got).toEqual(want)
    // Splashes need intensity, so they only ever show on Rain levels; with water tiles they do show there.
    expect(got.filter(([, g]) => g.splashes).map(([id]) => id)).toEqual(
      expect.arrayContaining(range(75, 83)),
    )
  })
})
