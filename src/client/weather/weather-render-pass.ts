/**
 * Draws the 1.13c client weather into the scene. `world-renderer.ts` calls, per frame:
 *
 * 1. {@link SceneWeatherPass.beginFrame} right after the camera is set: the render callback's
 *    pending LoadWeather, the update 0x6fb31340, the floor pass and the lightning driver (see
 *    `WeatherController`);
 * 2. {@link SceneWeatherPass.drawGround} after the floors: splashes, then bubbles (DrawCels
 *    0x6fb2fc70 with draw mode 3, additive), before anything that stands on the floor;
 * 3. {@link SceneWeatherPass.drawLines} after the roofs, with world lighting off: the rain / snow
 *    lines (DrawParticles 0x6fb2fe80). DrawLine stores raw palette indices, so the lines are never
 *    lit; only the period-of-day colour ramps change them. On a lightning flash frame the driver
 *    draws the flash (DrawFlash 0x6fb2fe10, opaque palette index 255) instead of the lines.
 *
 * Everything but the flash is drawn world-anchored at the camera origin of the last weather step;
 * the flash is a screen rect.
 */

import type { PeriodOfDay } from '../../common/world/environment.ts'
import type { PackedWeatherCelFrame, WeatherManifestData } from '../../common/pack-contract/index.ts'
import type { AtlasHandle, SpriteRenderer } from '../render/renderer.ts'
import type { WeatherController, WeatherFloorTile } from './weather-controller.ts'
import {
  forEachVisibleWeatherOverlay,
  LIGHTNING_FLASH_PALETTE_INDEX_113C,
  lightningFlashRect113c,
  rasterizeWeatherLineSpans,
  type WeatherPanel,
} from './weather-raster.ts'
import type { WeatherOverlay } from './weather-sim.ts'

/** The renderer calls the weather needs. */
export type WeatherDrawTarget = Pick<SpriteRenderer, 'draw' | 'drawSolid' | 'addIndexedAtlas'>

/** One scene frame as the weather sees it. */
export interface SceneWeatherFrame {
  /** Level of the local player. */
  readonly levelId: number
  /** Game-frame counter (25 Hz). */
  readonly tick: number
  /** Renderer camera centre in world pixels. */
  readonly camX: number
  readonly camY: number
  /** Screen size in pixels. */
  readonly width: number
  readonly height: number
  /** Floor tiles drawn this frame. */
  readonly floorTiles: readonly WeatherFloorTile[]
}

/** What `renderSceneSourceFrame` drives. */
export interface SceneWeatherPass {
  beginFrame(frame: SceneWeatherFrame): void
  drawGround(target: WeatherDrawTarget): void
  drawLines(target: WeatherDrawTarget): void
}

/**
 * `[0x6fbcc414]` from the open side panels: 1 when only the right panel is open (the view is the
 * left half), 2 when only the left panel is open, otherwise 0.
 */
export function weatherPanelFromSidePanels(leftOpen: boolean, rightOpen: boolean): WeatherPanel {
  if (rightOpen && !leftOpen) return 1
  if (leftOpen && !rightOpen) return 2
  return 0
}

/**
 * Whether vanilla draws the world: not when both side panels are open (`[0x6fbcc414] == 3`, test at
 * 0x6faf4361), which skips the floor pass and the lightning driver. The port's renderer still
 * draws the world then (its viewports can be wider than the two panels).
 */
export function weatherWorldDrawnFromSidePanels(leftOpen: boolean, rightOpen: boolean): boolean {
  return !(leftOpen && rightOpen)
}

export interface WeatherScenePassOptions {
  readonly controller: WeatherController
  /** Period of day of the client act. */
  readonly period: () => PeriodOfDay
  /** Current `[0x6fbcc414]` (see {@link weatherPanelFromSidePanels}). */
  readonly panel: () => WeatherPanel
  /** Whether vanilla would draw the world (see {@link weatherWorldDrawnFromSidePanels}). */
  readonly worldDrawn: () => boolean
  /** FPS counter `[0x6fbcc2ac]` (`FpsCounter113c.fps`). */
  readonly fps: () => number
}

type Rgba = readonly [number, number, number, number]

export class WeatherScenePass implements SceneWeatherPass {
  private readonly controller: WeatherController
  private readonly period: () => PeriodOfDay
  private readonly panelOf: () => WeatherPanel
  private readonly worldDrawnOf: () => boolean
  private readonly fpsOf: () => number
  private active = false
  private panel: WeatherPanel = 0
  private atlas: AtlasHandle | null = null
  private atlasTarget: WeatherDrawTarget | null = null
  private colorPalette: Uint8Array | null = null
  private colors: Rgba[] = []

  constructor(options: WeatherScenePassOptions) {
    this.controller = options.controller
    this.period = options.period
    this.panelOf = options.panel
    this.worldDrawnOf = options.worldDrawn
    this.fpsOf = options.fps
  }

  beginFrame(frame: SceneWeatherFrame): void {
    this.active = this.controller.beginFrame({
      ...frame,
      period: this.period(),
      worldDrawn: this.worldDrawnOf(),
      fps: this.fpsOf(),
    })
    this.panel = this.active ? this.panelOf() : 0
  }

  drawGround(target: WeatherDrawTarget): void {
    if (!this.active) return
    const c = this.controller
    const assets = c.assets
    if (assets === null) throw new Error('WeatherScenePass: active weather without assets')
    const atlas = this.atlasFor(target, assets)
    const draw = (o: WeatherOverlay, frames: readonly PackedWeatherCelFrame[], what: string): void => {
      const f = frames[o.frame]
      if (f === undefined) throw new Error(`WeatherScenePass: ${what} frame ${String(o.frame)} of ${String(frames.length)}`)
      target.draw({ x: f.ax, y: f.ay, width: f.w, height: f.h }, c.originX + o.x + f.ox, c.originY + o.y + f.oy - f.h, {
        atlas,
        blendMode: 'additive',
      })
    }
    forEachVisibleWeatherOverlay(c.sim.splashes, c.width, c.height, this.panel, (o) => {
      if (o.type === 2) draw(o, assets.cels.rain3, 'Rain3')
      else if (o.type === 3) draw(o, assets.cels.rain4, 'Rain4')
      else throw new Error(`WeatherScenePass: splash type ${String(o.type)} has no cel`)
    })
    forEachVisibleWeatherOverlay(c.sim.bubbles, c.width, c.height, this.panel, (o) => {
      if (o.type !== 2) throw new Error(`WeatherScenePass: bubble type ${String(o.type)} has no cel`)
      draw(o, assets.cels.bubble3, 'bubble3')
    })
  }

  drawLines(target: WeatherDrawTarget): void {
    if (!this.active) return
    const c = this.controller
    const colors = this.colorsFor(c.palette)
    if (c.lightningFrame.flash) {
      // Driver 0x6fb305a0: DrawFlash 0x6fb2fe10 (tail jump 0x6fb306d1) replaces DrawParticles.
      const rect = lightningFlashRect113c(c.width, c.height, this.panel)
      if (rect !== null) {
        target.drawSolid(
          c.frameOriginX + rect.x1,
          c.frameOriginY,
          rect.x2 - rect.x1,
          rect.ymax,
          colors[LIGHTNING_FLASH_PALETTE_INDEX_113C]!,
        )
      }
      return
    }
    const ox = c.originX
    const oy = c.originY
    rasterizeWeatherLineSpans(
      { particles: c.sim.particles, snow: c.sim.snow, angle: c.sim.angle },
      c.width,
      c.height,
      this.panel,
      (x, y, w, h, color) => {
        target.drawSolid(ox + x, oy + y, w, h, colors[color]!)
      },
    )
  }

  /** The overlay cels as one indexed (palette row 0, index 0 transparent) atlas per renderer. */
  private atlasFor(target: WeatherDrawTarget, assets: WeatherManifestData): AtlasHandle {
    if (this.atlas === null || this.atlasTarget !== target) {
      this.atlas = target.addIndexedAtlas(assets.atlas.indices, assets.atlas.width, assets.atlas.height)
      this.atlasTarget = target
    }
    return this.atlas
  }

  private colorsFor(palette: Uint8Array): readonly Rgba[] {
    if (this.colorPalette !== palette) {
      const colors: Rgba[] = []
      for (let i = 0; i < 256; i += 1) {
        colors.push([palette[i * 3]! / 255, palette[i * 3 + 1]! / 255, palette[i * 3 + 2]! / 255, 1])
      }
      this.colors = colors
      this.colorPalette = palette
    }
    return this.colors
  }
}
