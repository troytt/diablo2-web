/**
 * Draws the 1.13c level backdrops (`backdrop-113c.ts`) into the scene before the floors, unlit (they are raw
 * DrawCelContext / DrawLine screen draws in 1.13c). Issues #1537 / #1538.
 */

import type { BackdropManifestData, PackedBackdropCelFrame } from '../../common/pack-contract/backdrop-manifest.ts'
import { SEED_InitLowSeed, SEED_InitSeed, type D2SeedStrc } from '../../common/rng/d2-rng.ts'
import type { AtlasHandle, SpriteRenderer } from '../render/renderer.ts'
import {
  ARCANE_SANCTUARY_LEVEL_ID,
  ARREAT_SUMMIT_LEVEL_ID,
  ArcaneStarfield113c,
  ArreatClouds113c,
  summitTiles113c,
  timeSeed113c,
} from './backdrop-113c.ts'

export type BackdropDrawTarget = Pick<SpriteRenderer, 'draw' | 'drawSolid' | 'addIndexedAtlas'>

export interface SceneBackdropFrame {
  readonly levelId: number
  /** Act of the level (1..5), selecting the palette of the starfield colour search. */
  readonly actId: number
  /** 25 Hz game frame counter. */
  readonly tick: number
  readonly nowMs: number
  /** World pixel of the viewport's top-left corner (the 1.13c screen origin). */
  readonly originX: number
  readonly originY: number
  readonly width: number
  readonly height: number
  /** Local player precise position in sub-tiles. */
  readonly playerX: number
  readonly playerY: number
}

export interface SceneBackdropPass {
  draw(target: BackdropDrawTarget, frame: SceneBackdropFrame): void
}

/** #10651 dwClientCoordX of a dynamic unit: `((precX >> 11) - (precY >> 11)) >> 1` (PATH_UpdateClientCoords). */
export function playerClientX113c(x: number, y: number): number {
  const px = Math.floor(x * 65536) >>> 11
  const py = Math.floor(y * 65536) >>> 11
  return (px - py) >> 1
}

function newTimeSeed(): D2SeedStrc {
  const seed = { lo: 1, hi: 666 }
  SEED_InitSeed(seed)
  SEED_InitLowSeed(seed, timeSeed113c(Math.floor(Date.now() / 1000), Math.floor(performance.now()), 0))
  return seed
}

export class BackdropScenePass implements SceneBackdropPass {
  private starfield: ArcaneStarfield113c | null = null
  private clouds: ArreatClouds113c | null = null
  private lastCloudTick = -1
  private atlas: AtlasHandle | null = null
  private atlasTarget: BackdropDrawTarget | null = null

  constructor(
    private readonly assets: () => BackdropManifestData | null,
    private readonly seedFactory: () => D2SeedStrc = newTimeSeed,
  ) {}

  draw(target: BackdropDrawTarget, frame: SceneBackdropFrame): void {
    const assets = this.assets()
    if (assets === null) return
    if (frame.levelId === ARCANE_SANCTUARY_LEVEL_ID) this.drawStarfield(target, frame, assets)
    if (frame.levelId === ARREAT_SUMMIT_LEVEL_ID) this.drawArreat(target, frame, assets)
  }

  private drawStarfield(target: BackdropDrawTarget, frame: SceneBackdropFrame, assets: BackdropManifestData): void {
    const palette = assets.palettes[frame.actId - 1]
    if (palette === undefined) throw new Error(`BackdropScenePass: no palette for act ${String(frame.actId)}`)
    this.starfield ??= new ArcaneStarfield113c(this.seedFactory(), frame.width, frame.height, palette)
    for (const star of this.starfield.stars) {
      const i = star.color * 3
      target.drawSolid(frame.originX + star.x, frame.originY + star.y, 1, 1, [
        palette[i]! / 255,
        palette[i + 1]! / 255,
        palette[i + 2]! / 255,
        1,
      ])
    }
    this.starfield.step(frame.nowMs)
  }

  private drawArreat(target: BackdropDrawTarget, frame: SceneBackdropFrame, assets: BackdropManifestData): void {
    const atlas = this.atlasFor(target, assets)
    const cel = (f: PackedBackdropCelFrame, x: number, bottomY: number, blendMode: 'normal' | 'additive'): void => {
      target.draw({ x: f.ax, y: f.ay, width: f.w, height: f.h }, frame.originX + x + f.ox, frame.originY + bottomY + f.oy - f.h, {
        atlas,
        blendMode,
      })
    }
    const rows1132 = frame.width >= 800 ? 3 : 2
    for (const t of summitTiles113c(playerClientX113c(frame.playerX, frame.playerY), frame.width, frame.height, rows1132)) {
      cel(assets.cels.summit01[t.frame]!, t.x, t.y, 'normal')
    }
    this.clouds ??= new ArreatClouds113c(this.seedFactory(), frame.width)
    if (frame.tick !== this.lastCloudTick) {
      if (this.lastCloudTick >= 0) this.clouds.step()
      this.lastCloudTick = frame.tick
    }
    const [c0, c1] = assets.cels.cloud01
    for (const c of this.clouds.clouds) {
      const x = ArreatClouds113c.screenX(c)
      // DrawCelContext mode 3 = additive (kb/render/d2gfx-draw-mode-113c.md); colour 0xDDDDDDDD.
      cel(c0!, x, c.y, 'additive')
      cel(c1!, x + 256, c.y, 'additive')
    }
  }

  private atlasFor(target: BackdropDrawTarget, assets: BackdropManifestData): AtlasHandle {
    if (this.atlas === null || this.atlasTarget !== target) {
      this.atlas = target.addIndexedAtlas(assets.atlas.indices, assets.atlas.width, assets.atlas.height)
      this.atlasTarget = target
    }
    return this.atlas
  }
}
