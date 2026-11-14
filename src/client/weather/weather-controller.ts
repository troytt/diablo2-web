/**
 * Drives the 1.13c client weather (`WeatherSim`) from the online session and the renderer.
 *
 * Event hooks (all from `OnlineSession`):
 * - {@link WeatherController.onGameInit}: game init 0x6fb30320 (from 0x6faf45f1);
 * - {@link WeatherController.onLoadAct}: S2C `0x03` LoadAct. Vanilla runs LoadWeather 0x6fb31750 from
 *   the render callback while the act load is pending (0x6fb714f0), so the load is queued and runs at
 *   the start of the next frame that draws the world;
 * - {@link WeatherController.onLocalReassign}: S2C `0x15` for the local player (0x6fb57e20 → 0x6fb31720),
 *   queued for the start of the next frame;
 * - {@link WeatherController.forceLightning}: S2C `0xA3` that reaches skill fn #84 (Thunder Storm,
 *   see {@link unitSkillEventForcesLightning113c}) → ForceLightning 0x6fb301f0, applied at once (no RNG).
 *
 * Per render frame, {@link WeatherController.beginFrame} runs the queued reassigns, the pending
 * LoadWeather, the update 0x6fb31340, the floor pass (0x6fac4050 / 0x6fac3ce0) and the lightning
 * driver 0x6fb305a0.
 *
 * Camera: the simulation works in screen pixels of the moment it steps. The port keeps the camera
 * origin (screen top-left in world pixels) of the last step; the next step gets the camera movement
 * since then as its delta (vanilla only passes the delta of the render frame that steps and loses
 * the rest, which at the port's frame rates would make the weather drift against the world), and
 * everything is drawn world-anchored at that origin between steps.
 */

import type { WeatherManifestData } from '../../common/pack-contract/index.ts'
import type { D2Rng } from '../../common/rng/d2-rng.ts'
import type { PeriodOfDay } from '../../common/world/environment.ts'
import { getLevelLighting } from '../../common/world/levels-meta.ts'
import {
  isSkillsTxtRow113c,
  skillCltPrgFunc1Of113c,
  skillHasWarp113c,
  skillIsProgressive113c,
} from '../input/click-rules-113c.ts'
import { buildWeatherColorTables, type WeatherColorTables113c } from './weather-colors.ts'
import {
  NO_LIGHTNING_113C,
  WeatherSim,
  type LightningFrame113c,
  type WeatherLevelInfo,
  type WeatherOverride,
  type WeatherWaterTile,
} from './weather-sim.ts'

/** DT1 tile header byte +0x06 bit 1: the floor-pass water test (`byte [tile+6] & 2`, 0x6fac3e86). */
export const DT1_MATERIAL_WATER = 0x02
/** The floor diamond is 160 × 80; a floor bitmap's left edge is 80 px left of the diamond's top vertex. */
export const FLOOR_TILE_HALF_WIDTH = 80
export const FLOOR_TILE_HEIGHT = 80

/** Levels.txt `Act` / `Rain` / `Mud` as baked into levels-meta (D2Common #10459 / #10215 / #10499). */
export function weatherLevelInfo113c(levelId: number): WeatherLevelInfo {
  const meta = getLevelLighting(levelId)
  if (meta === undefined) throw new Error(`weather: Levels.txt has no level ${String(levelId)}`)
  return { act: meta.act, rain: meta.rain, mud: meta.mud }
}

/** The local player as 0x6fb57e20 sees it, before the S2C `0x15` move is applied. */
export interface LocalReassignWeatherInput {
  /** Packet byte `@0x0A` (non-zero). */
  readonly snap: boolean
  /** Unit flag `[unit+0xC4] & 0x10000` (dead). */
  readonly dead: boolean
  /** Player mode (`[unit+0x10]`). */
  readonly mode: number
  /** Skills.txt row of the used skill (`[unit+0xA8]+0x10`, D2Common #10511); `undefined` when none. */
  readonly usedSkillId: number | undefined
}

/**
 * The weather call of 0x6fb57e20 for the local player: `null` when it returns before the call
 * (0x6fb57e80 dead flag, 0x6fb57eb4 player mode 0 / 17), otherwise the arg passed to 0x6fb31720 at
 * 0x6fb5800e: the packet byte, zeroed at 0x6fb57efe when the used skill has Skills.txt `warp`. (The
 * warp test is skipped when the player has no room, 0x6fb57ed9; the port's player always has one.)
 */
export function localReassignWeatherArg113c(input: LocalReassignWeatherInput): 0 | 1 | null {
  if (input.dead || input.mode === 0 || input.mode === 17) return null
  if (!input.snap) return 0
  if (input.usedSkillId !== undefined && skillHasWarp113c(input.usedSkillId)) return 0
  return 1
}

/** Skill fn #84 (0x6fb24350, table 0x6fb8ea48): the only caller of ForceLightning (call 0x6fb24445). */
export const SKILL_FN_THUNDER_STORM_113C = 84

/** One S2C `0xA3` as the client resolves it. */
export interface UnitSkillEventLightningInput {
  /** Skills.txt row (packet i16 `@2`). */
  readonly skill: number
  /** The caster unit is known to the client (0x6fb54e20 lookup). */
  readonly casterKnown: boolean
  /** The target unit is known to the client (second 0x6fb54e20 lookup). */
  readonly targetKnown: boolean
}

/**
 * Whether one S2C `0xA3` reaches ForceLightning(0) (call 0x6fb24445):
 * - unknown caster: the handler returns (0x6fb5efd7);
 * - skill outside Skills.txt: it returns (0x6fb5f012 / 0x6fb5f01d);
 * - progressive skill: 0x6fb52950 runs instead (0x6fb5f03e);
 * - otherwise 0x6fb51b10 dispatches `cltprgfunc1` through the table 0x6fb8ea48, and only fn #84
 *   (Thunder Storm) calls ForceLightning. fn #84's `cltmissilea` range check (0x6fb24399 /
 *   0x6fb243a5) always passes for the 1.13c data (row 57 → `thunderstorm1`);
 * - fn #84 returns before ForceLightning when the caster's path target is NULL (0x6fb243b7).
 *   0x6fb51b10 sets the packet's target unit as path target; with an unknown target vanilla keeps
 *   the caster's previous (stale) path target. The port has no client path target, so an unknown
 *   target never flashes (divergence, docs/weather_113c.md §9).
 *
 * There is no local-player or own-caster filter: any strike the client receives counts.
 */
export function unitSkillEventForcesLightning113c(input: UnitSkillEventLightningInput): boolean {
  if (!input.casterKnown) return false
  if (!isSkillsTxtRow113c(input.skill)) return false
  if (skillIsProgressive113c(input.skill)) return false
  if (skillCltPrgFunc1Of113c(input.skill) !== SKILL_FN_THUNDER_STORM_113C) return false
  return input.targetKnown
}

/** A floor tile as the scene draws it. */
export interface WeatherFloorTile {
  /** World pixel of the bitmap's left edge (the diamond's top vertex is 80 px to the right). */
  readonly worldX: number
  /** World pixel of the bitmap's top edge (the diamond's top vertex). */
  readonly worldY: number
  /** DT1 orientation; the floor pass only takes orientation 0. */
  readonly type?: number | undefined
  /** DT1 tile header `materialFlags` (u16 at +0x06). */
  readonly materialFlags?: number | undefined
}

export interface WeatherFrameInput {
  /** Level of the local player's room. */
  readonly levelId: number
  /** Game-frame counter (25 Hz). */
  readonly tick: number
  /** Camera centre in world pixels, as the renderer uses it. */
  readonly camX: number
  readonly camY: number
  /** Screen size in pixels. */
  readonly width: number
  readonly height: number
  /** Period of day of the client act. */
  readonly period: PeriodOfDay
  /** Floor tiles in draw order. */
  readonly floorTiles: readonly WeatherFloorTile[]
  /**
   * Whether vanilla would draw the world this frame: false exactly when both side panels are open
   * (`[0x6fbcc414] == 3`, 0x6faf4361), which skips the floor pass and the lightning driver.
   */
  readonly worldDrawn: boolean
  /** FPS counter `[0x6fbcc2ac]` (`FpsCounter113c`) as published by earlier rendered frames. */
  readonly fps: number
}

export interface WeatherControllerOptions {
  /** Dedicated seed (vanilla draws from the local player's unit seed; see `weather-sim.ts`). */
  readonly rng: D2Rng
  /** Levels.txt lookup; defaults to the baked 1.13c table. */
  readonly levels?: ((levelId: number) => WeatherLevelInfo) | undefined
  /** Optional 0x6fb30645 thunder callback invoked when an armed lightning pair completes. */
  readonly thunder?: (() => number) | undefined
}

export class WeatherController {
  readonly sim: WeatherSim
  private readonly levels: (levelId: number) => WeatherLevelInfo
  private readonly thunder: (() => number) | undefined
  private assetsValue: WeatherManifestData | null = null
  private readonly colorTablesByAct = new Map<number, WeatherColorTables113c>()
  /** LoadAct level waiting for LoadWeather; 0 when none. */
  private pendingLoadActLevelId = 0
  /** Local-player S2C `0x15` args waiting for the next frame, in arrival order. */
  private readonly pendingReassignArgs: (0 | 1)[] = []
  /** LoadWeather ran for the current game. */
  private activeValue = false
  private paletteValue: Uint8Array | null = null
  private originXValue = 0
  private originYValue = 0
  private hasOrigin = false
  private frameOriginXValue = 0
  private frameOriginYValue = 0
  private widthValue = 0
  private heightValue = 0
  private lastPlayerLevelId = 0
  private overrideValue: WeatherOverride = 'off'
  private lightningFrameValue: LightningFrame113c = NO_LIGHTNING_113C
  /** Game tick of the last lightning driver run (port: at most one run per tick). */
  private lastDriverTick = 0

  constructor(options: WeatherControllerOptions) {
    this.levels = options.levels ?? weatherLevelInfo113c
    this.thunder = options.thunder
    this.sim = new WeatherSim({ rng: options.rng, levels: this.levels })
  }

  /** Whether the weather runs and draws (LoadWeather ran in this game). */
  get active(): boolean {
    return this.activeValue
  }

  get assets(): WeatherManifestData | null {
    return this.assetsValue
  }

  /** Camera origin of the last weather step: world pixel of screen (0, 0). */
  get originX(): number {
    return this.originXValue
  }

  get originY(): number {
    return this.originYValue
  }

  /**
   * World pixel of screen (0, 0) in the current frame, unrounded (the renderer's camera). The flash
   * is a screen rect (DrawFlash 0x6fb2fe10), so it is anchored here rather than at the step origin.
   */
  get frameOriginX(): number {
    return this.frameOriginXValue
  }

  get frameOriginY(): number {
    return this.frameOriginYValue
  }

  /** Screen size of the last frame. */
  get width(): number {
    return this.widthValue
  }

  get height(): number {
    return this.heightValue
  }

  /** RGB palette (768 bytes) of the act LoadWeather built its colour ramps for. */
  get palette(): Uint8Array {
    if (this.paletteValue === null) throw new Error('WeatherController.palette before LoadWeather')
    return this.paletteValue
  }

  get override(): WeatherOverride {
    return this.overrideValue
  }

  /**
   * What the lightning driver did in the current weather frame. The port runs the driver once per
   * weather frame (new game tick), so a flash is held for every render frame of that tick.
   */
  get lightningFrame(): LightningFrame113c {
    return this.lightningFrameValue
  }

  /** Installs the baked assets (once). LoadWeather waits for them. */
  setAssets(data: WeatherManifestData): void {
    if (this.assetsValue !== null) throw new Error('WeatherController.setAssets called twice')
    this.assetsValue = data
  }

  /** Game init 0x6fb30320. The weather stays off until the game's first LoadWeather. */
  onGameInit(): void {
    this.sim.onGameInit()
    this.activeValue = false
    this.pendingLoadActLevelId = 0
    this.pendingReassignArgs.length = 0
    this.hasOrigin = false
    this.lightningFrameValue = NO_LIGHTNING_113C
    this.lastDriverTick = 0
  }

  /**
   * ForceLightning(0) 0x6fb301f0 for an S2C `0xA3` that passed
   * {@link unitSkillEventForcesLightning113c}. Vanilla runs it from the packet handler, before the
   * render callback; it draws nothing, so the port applies it at once, even before LoadWeather.
   */
  forceLightning(): void {
    this.sim.forceLightning()
  }

  /** S2C `0x03` LoadAct: queue LoadWeather for `levelId` (its act picks the palette and durations). */
  onLoadAct(levelId: number): void {
    if (!Number.isInteger(levelId)) throw new Error(`WeatherController.onLoadAct: level ${String(levelId)}`)
    this.levels(levelId)
    this.pendingLoadActLevelId = levelId
    this.lastPlayerLevelId = levelId
  }

  /**
   * 0x6fb31720 for the local player's S2C `0x15` (call site 0x6fb58012, after the move). `arg` is
   * the packet byte `@0x0A`, already zeroed when the used skill has Skills.txt `warp`.
   *
   * Vanilla calls it from the packet handler; every packet of a frame interval is handled before
   * the render callback runs LoadWeather and the update. The port queues the call and runs it at
   * the start of the next {@link beginFrame}, before those two, with that frame's player level (the
   * level of the room the player was moved into).
   */
  onLocalReassign(arg: 0 | 1): void {
    if (arg !== 0 && arg !== 1) throw new Error(`WeatherController.onLocalReassign: arg ${String(arg)}`)
    this.pendingReassignArgs.push(arg)
  }

  /** NOT 1.13c: the weather-override plugin's forced precipitation (see `WeatherSim.setOverride`). */
  setOverride(mode: WeatherOverride): void {
    this.overrideValue = mode
    this.sim.setOverride(mode, this.lastPlayerLevelId)
  }

  /**
   * One render frame: queued local reassigns, pending LoadWeather, then the update 0x6fb31340
   * (steps at most once per game-frame counter value), and, when the world is drawn, the floor pass
   * over the visible water tiles and the lightning driver 0x6fb305a0 (vanilla order of the weather
   * stream's consumers: update @0x6faf4307, floor pass @0x6fb3b235, driver @0x6fb3b2c6).
   *
   * The driver runs at most once per game tick, on the first render frame of the tick that draws
   * the world, and its result is held for the tick's later frames (vanilla runs it every rendered
   * frame, at 25 fps one per tick; see docs/weather_113c.md §9). A frame that does not draw the
   * world shows no flash.
   *
   * @returns whether the weather is active this frame (draw it).
   */
  beginFrame(input: WeatherFrameInput): boolean {
    if (typeof input.worldDrawn !== 'boolean') {
      throw new Error(`WeatherController.beginFrame: worldDrawn ${String(input.worldDrawn)} is not a boolean`)
    }
    if (!Number.isInteger(input.fps) || input.fps < 0) {
      throw new Error(`WeatherController.beginFrame: fps ${String(input.fps)} is not a non-negative integer`)
    }
    if (this.pendingReassignArgs.length > 0) {
      this.levels(input.levelId)
      this.lastPlayerLevelId = input.levelId
      for (const arg of this.pendingReassignArgs) this.sim.onLocalReassign(arg, input.levelId)
      this.pendingReassignArgs.length = 0
    }
    if (this.pendingLoadActLevelId !== 0) {
      const assets = this.assetsValue
      if (assets === null) return false
      this.loadWeather(this.pendingLoadActLevelId, input.levelId, assets)
    }
    if (!this.activeValue) return false

    const { width, height } = input
    this.widthValue = width
    this.heightValue = height
    this.lastPlayerLevelId = input.levelId
    this.frameOriginXValue = input.camX - width / 2
    this.frameOriginYValue = input.camY - height / 2
    const ox = Math.round(input.camX - width / 2)
    const oy = Math.round(input.camY - height / 2)
    if (!this.hasOrigin) {
      this.originXValue = ox
      this.originYValue = oy
      this.hasOrigin = true
    }
    const stepped = this.sim.update({
      levelId: input.levelId,
      tick: input.tick,
      camDx: ox - this.originXValue,
      camDy: oy - this.originYValue,
      period: input.period,
      width,
      height,
    })
    if (stepped) {
      this.originXValue = ox
      this.originYValue = oy
    }
    if (!input.worldDrawn) {
      // 0x6faf4361: both side panels open → no world draw, so no floor pass and no driver.
      this.lightningFrameValue = NO_LIGHTNING_113C
      return true
    }
    this.sim.floorPass(this.visibleWaterTiles(input.floorTiles, width, height), input.tick, this.levels(input.levelId).mud)
    if (input.tick > this.lastDriverTick) {
      this.lastDriverTick = input.tick
      this.lightningFrameValue = this.sim.driveLightning(input.fps, this.thunder)
    }
    return true
  }

  /** LoadWeather 0x6fb31750 with the colour ramps of the LoadAct level's act palette. */
  private loadWeather(loadActLevelId: number, playerLevelId: number, assets: WeatherManifestData): void {
    const act = this.levels(loadActLevelId).act
    const palette = assets.palettes[act - 1]
    if (palette === undefined) throw new Error(`WeatherController: no palette for act ${String(act)}`)
    let colors = this.colorTablesByAct.get(act)
    if (colors === undefined) {
      colors = buildWeatherColorTables(palette)
      this.colorTablesByAct.set(act, colors)
    }
    this.sim.loadWeather(loadActLevelId, playerLevelId, {
      colors,
      frameCounts: {
        rain3: assets.cels.rain3.length,
        rain4: assets.cels.rain4.length,
        bubble3: assets.cels.bubble3.length,
      },
    })
    this.paletteValue = palette
    this.pendingLoadActLevelId = 0
    this.activeValue = true
    this.hasOrigin = false
    this.lastPlayerLevelId = playerLevelId
  }

  /**
   * The floor tiles 0x6fac3ce0 tests: drawn (on screen), orientation 0, water material bit. The
   * positions are the diamond top vertices relative to the last step's origin.
   *
   * UNVERIFIED margins: vanilla tests the tile anchor against the floor context's clip rect, whose
   * margins were not recovered; the port takes every tile whose diamond overlaps the screen. The
   * `flags & 0x408` skip of the room tile has no port equivalent (hidden floors are never built).
   */
  private visibleWaterTiles(tiles: readonly WeatherFloorTile[], width: number, height: number): WeatherWaterTile[] {
    const out: WeatherWaterTile[] = []
    for (const tile of tiles) {
      const sx = tile.worldX + FLOOR_TILE_HALF_WIDTH - this.originXValue
      const sy = tile.worldY - this.originYValue
      if (sx + FLOOR_TILE_HALF_WIDTH <= 0 || sx - FLOOR_TILE_HALF_WIDTH >= width) continue
      if (sy + FLOOR_TILE_HEIGHT <= 0 || sy >= height) continue
      if (tile.type === undefined || tile.materialFlags === undefined) {
        throw new Error(
          `WeatherController: floor tile at (${String(tile.worldX)}, ${String(tile.worldY)}) has no DT1 type/materialFlags`,
        )
      }
      if (tile.type !== 0) continue
      if ((tile.materialFlags & DT1_MATERIAL_WATER) === 0) continue
      out.push({ sx: Math.round(sx), sy: Math.round(sy) })
    }
    return out
  }
}
