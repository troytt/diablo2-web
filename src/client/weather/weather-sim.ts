/**
 * Diablo II v1.13c client weather simulation: rain / snow particles, water splashes and mud bubbles.
 *
 * Ground truth is D2Client.dll 1.13c (ImageBase 0x6FAB0000). Every method names the function it
 * reproduces; the reverse-engineering notes (globals, call sites, open questions) live in
 * `docs/weather_113c.md`.
 *
 * Port decisions (all documented there):
 * - The RNG is a dedicated D2 seed. Vanilla draws from the local player's unit seed, which other client
 *   code shares, so its exact sequence cannot be reproduced. Every draw still happens in vanilla order.
 * - Snow colours follow the GDI / DirectDraw / Direct3D branch of SnowColor (0x6fb304c0). The
 *   Glide-only bright grey ramp is not used.
 * - Lightning (only started by Thunder Storm: S2C 0xA3 → skill fn #84 → ForceLightning 0x6fb301f0) is
 *   {@link WeatherLightning113c}. Its driver 0x6fb305a0 runs once per weather frame (one new game
 *   tick) instead of once per rendered frame, so a flash lasts one tick; `WeatherController` gates it
 *   on the world being drawn and on the FPS counter (see docs/weather_113c.md §9).
 * - `setOverride()` is NOT 1.13c behaviour. It backs the weather-override plugin and is built only
 *   from vanilla code paths (see the method).
 *
 * State that vanilla keeps in BSS (state machine, wind, snow flags, floor-pass tick stamps) lives on
 * the instance and is never reset per game or per level, so one instance must live as long as the
 * client process does (the page).
 */

import type { D2Rng } from '../../common/rng/d2-rng.ts'
import { PeriodOfDay } from '../../common/world/environment.ts'
import { FogPool, type FogPoolRecord } from './fog-pool.ts'
import { fogCos, fogSin } from './fog-sin-table.ts'

/** Fog pool capacities (0x6fb30320): particles 0x100 × 0x28 B, splashes 0x200 × 0x18, bubbles 0x80 × 0x18. */
export const WEATHER_PARTICLE_CAPACITY = 0x100
export const WEATHER_SPLASH_CAPACITY = 0x200
export const WEATHER_BUBBLE_CAPACITY = 0x80

/** Rows of the 160×80 floor-tile diamond that splash / bubble spawns pick from (0x6fb30a70, 0x6fb30940). */
const TILE_DIAMOND_ROWS = 80

/** 0x6fb875a0 (0x3f59999a), 0x6fb875a4 (0x3e19999a), 0x6fb875a8: rain / snow speed factors. */
export const F32_RAIN_SPEED_BASE = Math.fround(0.85)
export const F32_RAIN_SPEED_INTENSITY = Math.fround(0.15)
export const F32_SNOW_SPEED_MIN = 0.25

/** byte_6fb3167c / byte_6fb30e14: Act V level 109..121 → switch case (others take case 3). */
const ACT5_CASE_BY_LEVEL: readonly number[] = [0, 0, 0, 0, 3, 3, 3, 3, 1, 3, 3, 2, 2]

/** byte_6fb84a19 (stride 2): snow alpha byte by period of day. Ignored by the DirectDraw renderer. */
const SNOW_ALPHA_BY_PERIOD: readonly number[] = [200, 160, 80, 160]

/** One `Environment Particles` record (0x28 bytes). */
export interface WeatherParticle extends FogPoolRecord {
  /** +0x04 screen x (px). */
  x: number
  /** +0x08 screen y (px). */
  y: number
  /** +0x0c landing line (screen px); not camera-adjusted. */
  yEnd: number
  /** +0x10 snow: flake size 0..7; rain: streak length (px). */
  sizeOrLen: number
  /** +0x14 px per tick before the speed factor. */
  speed: number
  /** +0x18 snow sway phase 0..511. */
  phase: number
  /** +0x1c 1 once the particle passed `yEnd`. */
  landed: number
  /** +0x20 ticks to linger after landing. */
  landTicks: number
  /** +0x24 palette index. */
  color: number
  /** +0x25 alpha byte (the DirectDraw line draw ignores it). */
  alpha: number
}

/** One `Environment Splashes` / `Environment Bubbles` record (0x18 bytes, screen-space mode). */
export interface WeatherOverlay extends FogPoolRecord {
  /** +0x04 anchor x in the coordinates of the last weather step (px). */
  x: number
  /** +0x08 anchor y in the coordinates of the last weather step (px). */
  y: number
  /** +0x0c index into the cel handle array: splash 2 (Rain3) or 3 (Rain4); bubble 2 (bubble3). */
  type: number
  /** +0x10 current DC6 frame. */
  frame: number
  /** +0x14 ticks left on this frame. */
  delay: number
}

/** The four LoadWeather colour ramps (0x6fb31750), 12 palette indices each. */
export interface WeatherColorTables {
  /** 0x6fbc38d4: rain by DAY. */
  readonly rainDay: readonly number[]
  /** 0x6fbc38a0: rain at DUSK / DAWN. */
  readonly rainDuskDawn: readonly number[]
  /** 0x6fbc38f8: rain at NIGHT. */
  readonly rainNight: readonly number[]
  /** 0x6fbc38e0: snow grey ramp. */
  readonly snowGray: readonly number[]
}

/** DC6 frame counts of the overlay cels that are drawn (D2CMP #10086 in LoadWeather). */
export interface WeatherFrameCounts {
  /** `Rain3.dc6`, splash type 2. */
  readonly rain3: number
  /** `Rain4.dc6`, splash type 3. */
  readonly rain4: number
  /** `bubble3.dc6`, bubble type 2. */
  readonly bubble3: number
}

/** What the weather reads from Levels.txt for a level id. */
export interface WeatherLevelInfo {
  /** Act 1..5 (D2Common #10459 + 1). */
  readonly act: number
  /** Levels.txt `Rain` (D2Common #10215). */
  readonly rain: boolean
  /** Levels.txt `Mud` (D2Common #10499). */
  readonly mud: boolean
}

/** NOT 1.13c: the weather-override plugin's forced precipitation. */
export type WeatherOverride = 'off' | 'rain' | 'snow'

export interface WeatherSimOptions {
  /** Dedicated D2 seed (see the file comment). */
  readonly rng: D2Rng
  /** Levels.txt lookup; must throw for unknown ids. */
  readonly levels: (levelId: number) => WeatherLevelInfo
}

export interface WeatherLoadInput {
  /** Colour ramps built against the act palette of the LoadAct level. */
  readonly colors: WeatherColorTables
  readonly frameCounts: WeatherFrameCounts
}

export interface WeatherStepInput {
  /** Level id of the local player's room. */
  readonly levelId: number
  /** Game-frame counter (`ds:0x6fbc97f8`, +1 per 40 ms tick, reset per game). */
  readonly tick: number
  /** Camera movement since the previous weather step, in screen pixels. */
  readonly camDx: number
  readonly camDy: number
  /** Period of day of the client act (D2Common #11044). */
  readonly period: PeriodOfDay
  /** Screen size (`ds:0x6fb8bc48` / `ds:0x6fb8bc4c`). */
  readonly width: number
  readonly height: number
}

/** A visible water floor tile for the floor pass: top-vertex position in weather-step coordinates. */
export interface WeatherWaterTile {
  readonly sx: number
  readonly sy: number
}

/** Persistent scalar state, for tests and diagnostics. */
export interface WeatherSimState {
  readonly state: number
  readonly countdown: number
  readonly total: number
  readonly max: number
  readonly target: number
  readonly intensity: number
  readonly snow: number
  readonly bigFlakes: number
  readonly forced: number
  readonly angle: number
  readonly angleTarget: number
  readonly angleCountdown: number
  readonly lightCountdown: number
  readonly snowAngleBase: number
  readonly snowAngleRange: number
  readonly lightningEnabled: number
  readonly lightningTrigger: number
  readonly flashState: number
  readonly thunderArmed: number
  readonly lastTick: number
  readonly moveFrame: number
  readonly firstLoadDone: number
  readonly prevRain: number
  readonly prevMud: number
  readonly durationBase: readonly number[]
  readonly durationRange: readonly number[]
  readonly lastSplashTick: number
  readonly lastBubbleTick: number
}

/** SeedRange 0x6fab18d0: `range <= 0` returns `base` without advancing the seed. */
function seedRange(rng: D2Rng, range: number, base: number): number {
  return range <= 0 ? base : base + rng.rand(range)
}

/** The driver draws the flash only while the FPS counter `[0x6fbcc2ac]` is >= 10 (`cmp 0xa; jb` @0x6fb306c2). */
export const LIGHTNING_MIN_FPS_113C = 10

/** What the lightning driver did in one weather frame. */
export interface LightningFrame113c {
  /** DrawFlash 0x6fb2fe10 replaces DrawParticles (tail jump 0x6fb306d1): no rain / snow lines. */
  readonly flash: boolean
}

/** The driver did nothing (lightning off, no trigger, or the driver did not run). */
export const NO_LIGHTNING_113C: LightningFrame113c = Object.freeze({ flash: false })

/**
 * The 1.13c lightning globals and every write to them, except ResetWind's countdown roll
 * (0x6fb30c4c), which stays in {@link WeatherSim} because it is part of that draw sequence:
 * - ForceLightning 0x6fb301f0, only caller skill fn #84 (call 0x6fb24445, Thunder Storm);
 * - game init 0x6fb30320 (0x6fb30394 / 0x6fb3039a);
 * - the disable writes: EnterState(3) 0x6fb311b7, FullState 0x6fb30dcb / 0x6fb30dfb, SetSnow(1)
 *   0x6fb3147d;
 * - the SpawnAndWind tail 0x6fb30f3c..0x6fb30f4e (once per weather step, so Rain levels only);
 * - the lightning part of the driver 0x6fb305a0 (called at 0x6fb3b2c6, end of the world draw).
 *
 * All fields are BSS / .data in vanilla: one instance per client process.
 */
export class WeatherLightning113c {
  /** 0x6fbcbf6c (BSS); only ForceLightning sets it. */
  enabled = 0
  /** 0x6fbc393c (BSS); effectively boolean (writers set 1, the driver decrements). */
  trigger = 0
  /** 0x6fbc38bc (BSS): weather steps until the tail sets `trigger`. */
  countdown = 0
  /** 0x6fbc38c0 (BSS): 0 when the next flash opens a pair, 1 when it closes one. */
  flashState = 0
  /** 0x6fb91380 (.data, 1); ForceLightning overwrites it before it can be read. */
  thunderArmed = 1

  /** Game init 0x6fb30320: flashState 0 (0x6fb30394), enabled 0 (0x6fb3039a); trigger, countdown and thunderArmed stay. */
  gameInit(): void {
    this.flashState = 0
    this.enabled = 0
  }

  /**
   * ForceLightning 0x6fb301f0 (`ret 4`): a no-op while lightning is on; otherwise enabled 1
   * (0x6fb301fe), trigger 1 (0x6fb30203), flashState 0 (0x6fb3020c), thunderArmed = arg (0x6fb30216).
   * The only caller pushes 0 (0x6fb24444), so the first pair after enabling is silent.
   */
  force(arg: 0 | 1): void {
    if (arg !== 0 && arg !== 1) throw new Error(`WeatherLightning113c.force: arg ${String(arg)} is not 0 or 1`)
    if (this.enabled) return
    this.enabled = 1
    this.trigger = 1
    this.flashState = 0
    this.thunderArmed = arg
  }

  /** The disable writes (EnterState(3), FullState default case, SetSnow(1)). */
  disable(): void {
    this.enabled = 0
  }

  /** SpawnAndWind tail 0x6fb30f3c..0x6fb30f4e: `if (enabled && --countdown == 0) trigger = 1` (32-bit). */
  tail(): void {
    if (!this.enabled) return
    this.countdown = (this.countdown - 1) | 0
    if (this.countdown === 0) this.trigger = 1
  }

  /**
   * The lightning part of the driver 0x6fb305a0. The first flash of a pair sets the countdown to 3
   * (0x6fb30632); the second rolls `500 + RNG(1500)` (0x6fb30655) and arms `thunderArmed` when
   * unarmed (0x6fb306b7). `trigger` and the draws are consumed even when `fps < 10`; the flash is
   * then not drawn.
   *
   * @param rng - the weather stream (vanilla: the player seed at 0x6fb30606).
   * @param fps - FPS counter `[0x6fbcc2ac]` published by earlier rendered frames.
   */
  drive(rng: D2Rng, fps: number, thunder?: () => number): LightningFrame113c {
    if (!Number.isInteger(fps) || fps < 0) throw new Error(`WeatherLightning113c.drive: fps ${String(fps)}`)
    if (!this.enabled || !this.trigger) return NO_LIGHTNING_113C // 0x6fb3060b / 0x6fb30618
    this.trigger = (this.trigger - 1) | 0 // 0x6fb3061f
    if (this.trigger === 0) {
      if (this.flashState === 0) {
        this.countdown = 3
        this.flashState = 1
      } else {
        this.countdown = seedRange(rng, 1500, 500)
        this.flashState = 0
        if (this.thunderArmed) {
          thunder?.()
        } else {
          this.thunderArmed = 1
        }
      }
    }
    return { flash: fps >= LIGHTNING_MIN_FPS_113C }
  }
}

/** The Act V switch of SelectPrecip / FullState: `cmp eax,0xc; ja` on `lvl - 109` (unsigned). */
export function act5WeatherCase(levelId: number): number {
  const k = (levelId - 109) >>> 0
  return k <= 12 ? ACT5_CASE_BY_LEVEL[k]! : 3
}

function zeroParticle(p: WeatherParticle): void {
  p.serial = 0
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

function zeroOverlay(o: WeatherOverlay): void {
  o.serial = 0
  o.x = 0
  o.y = 0
  o.type = 0
  o.frame = 0
  o.delay = 0
}

function newParticle(): WeatherParticle {
  return {
    serial: 0,
    x: 0,
    y: 0,
    yEnd: 0,
    sizeOrLen: 0,
    speed: 0,
    phase: 0,
    landed: 0,
    landTicks: 0,
    color: 0,
    alpha: 0,
  }
}

function newOverlay(): WeatherOverlay {
  return { serial: 0, x: 0, y: 0, type: 0, frame: 0, delay: 0 }
}

function requireInt(value: number, what: string): number {
  if (!Number.isInteger(value)) throw new Error(`WeatherSim: ${what} must be an integer, got ${String(value)}`)
  return value
}

function requireTable(table: readonly number[], what: string): Uint8Array {
  if (table.length !== 12) throw new Error(`WeatherSim: ${what} needs 12 palette indices, got ${table.length}`)
  const out = new Uint8Array(12)
  for (let i = 0; i < 12; i += 1) {
    const v = table[i]!
    if (!Number.isInteger(v) || v < 0 || v > 255) {
      throw new Error(`WeatherSim: ${what}[${i}] = ${String(v)} is not a palette index`)
    }
    out[i] = v
  }
  return out
}

export class WeatherSim {
  readonly particles = new FogPool<WeatherParticle>(WEATHER_PARTICLE_CAPACITY, newParticle, zeroParticle)
  readonly splashes = new FogPool<WeatherOverlay>(WEATHER_SPLASH_CAPACITY, newOverlay, zeroOverlay)
  readonly bubbles = new FogPool<WeatherOverlay>(WEATHER_BUBBLE_CAPACITY, newOverlay, zeroOverlay)

  private readonly rng: D2Rng
  private readonly levels: (levelId: number) => WeatherLevelInfo

  // ── Process-persistent globals (BSS in vanilla; see the file comment) ──────────────────────────
  /** 0x6fbcbf88: 0 clear, 1 ramp-up, 2 full, 3 ramp-down. */
  private stateValue = 0
  /** 0x6fbd343c: ticks left in the current state. */
  private countdown = 0
  /** 0x6fbd3438: duration of the current state. */
  private total = 0
  /** 0x6fbc3914: peak particle count. */
  private maxValue = 0
  /** 0x6fbc3934: wanted live particle count. */
  private targetValue = 0
  /** 0x6fbc38f4: target / 256 (f32). */
  private intensityValue = 0
  /** 0x6fbcbf78: 1 snow, 0 rain. */
  private snowValue = 0
  /** 0x6fbcbf7c: +1 snow flake size. */
  private bigFlakes = 0
  /** 0x6fbcbf80: state locked at 2. */
  private forced = 0
  /** 0x6fbc3918: wind angle, 512 units per turn (128 = straight down). */
  private angleValue = 0
  /** 0x6fbc394c */
  private angleTarget = 0
  /** 0x6fbc3938 */
  private angleCountdown = 0
  /** 0x6fbc392c / 0x6fbc38ec */
  private snowAngleBase = 0
  private snowAngleRange = 0
  /** Lightning globals 0x6fbcbf6c / 0x6fbc393c / 0x6fbc38bc / 0x6fbc38c0 / 0x6fb91380. */
  private readonly lightning = new WeatherLightning113c()
  /** 0x6fbcbf70: last game-frame counter value that stepped. */
  private lastTick = 0
  /** 0x6fbd3440: +1 after every Move, never reset. */
  private moveFrame = 0
  /** 0x6fbd3444 */
  private firstLoadDone = 0
  /** 0x6fbd3434 / 0x6fbd3430 */
  private prevRain = 0
  private prevMud = 0
  /** 0x6fbc38c4[4] / 0x6fbc38ac[4]: per-state duration base / range. */
  private readonly durationBase = [0, 0, 0, 0]
  private readonly durationRange = [0, 0, 0, 0]
  /** Floor-pass context 0x6fbd33b0 +0x14 / +0x18: never reset, even between games. */
  private lastSplashTick = 0
  private lastBubbleTick = 0

  // ── Per-act data from LoadWeather ──────────────────────────────────────────────────────────────
  private loaded = false
  private rainDay: Uint8Array = new Uint8Array(12)
  private rainDuskDawn: Uint8Array = new Uint8Array(12)
  private rainNight: Uint8Array = new Uint8Array(12)
  private snowGray: Uint8Array = new Uint8Array(12)
  /** Frame counts by overlay type (0x6fbc391c[] for splashes, 0x6fbc3880[] for bubbles). */
  private splashFrames: readonly number[] = [0, 0, 0, 0]
  private bubbleFrames: readonly number[] = [0, 0, 0, 0]

  // ── Context of the current call (what vanilla reads from the player / screen globals) ──────────
  private playerLevelId = 0
  private period: PeriodOfDay = PeriodOfDay.Day
  private width = 0
  private height = 0
  private overrideValue: WeatherOverride = 'off'

  constructor(options: WeatherSimOptions) {
    this.rng = options.rng
    this.levels = options.levels
  }

  // ── Read access for renderers and tests ─────────────────────────────────────────────────────────

  get isLoaded(): boolean {
    return this.loaded
  }

  get snow(): boolean {
    return this.snowValue !== 0
  }

  get angle(): number {
    return this.angleValue
  }

  get intensity(): number {
    return this.intensityValue
  }

  get target(): number {
    return this.targetValue
  }

  get override(): WeatherOverride {
    return this.overrideValue
  }

  /** Whether rain / snow runs in `levelId`: Levels.txt `Rain`, or any level while overridden. */
  isPrecipitationLevel(levelId: number): boolean {
    return this.overrideValue !== 'off' || this.levels(levelId).rain
  }

  snapshot(): WeatherSimState {
    return {
      state: this.stateValue,
      countdown: this.countdown,
      total: this.total,
      max: this.maxValue,
      target: this.targetValue,
      intensity: this.intensityValue,
      snow: this.snowValue,
      bigFlakes: this.bigFlakes,
      forced: this.forced,
      angle: this.angleValue,
      angleTarget: this.angleTarget,
      angleCountdown: this.angleCountdown,
      lightCountdown: this.lightning.countdown,
      snowAngleBase: this.snowAngleBase,
      snowAngleRange: this.snowAngleRange,
      lightningEnabled: this.lightning.enabled,
      lightningTrigger: this.lightning.trigger,
      flashState: this.lightning.flashState,
      thunderArmed: this.lightning.thunderArmed,
      lastTick: this.lastTick,
      moveFrame: this.moveFrame,
      firstLoadDone: this.firstLoadDone,
      prevRain: this.prevRain,
      prevMud: this.prevMud,
      durationBase: [...this.durationBase],
      durationRange: [...this.durationRange],
      lastSplashTick: this.lastSplashTick,
      lastBubbleTick: this.lastBubbleTick,
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────────────

  /**
   * Game init 0x6fb30320 (called from 0x6faf45f1). The pools are created fresh (here: emptied); the
   * snow angle pair is set to 42 / 170; flash state, lightning, lastTick and target are zeroed. The
   * state machine, wind, snow flags and intensity are left alone, and so are the lightning trigger,
   * countdown and thunderArmed.
   */
  onGameInit(): void {
    this.particles.clearAll()
    this.splashes.clearAll()
    this.bubbles.clearAll()
    this.snowAngleBase = 42
    this.snowAngleRange = 170
    this.lightning.gameInit()
    this.lastTick = 0
    this.targetValue = 0
  }

  /**
   * ForceLightning(0) 0x6fb301f0, from skill fn #84 (Thunder Storm, push 0 @0x6fb24444, call
   * 0x6fb24445). No `loaded` requirement: vanilla has none, the state just waits for the driver.
   */
  forceLightning(): void {
    this.lightning.force(0)
  }

  /**
   * The lightning part of the driver 0x6fb305a0 (end of the world draw), drawing from the weather
   * stream. The caller decides when the driver runs (see `WeatherController.beginFrame`).
   *
   * @param fps - FPS counter `[0x6fbcc2ac]`.
   */
  driveLightning(fps: number, thunder?: () => number): LightningFrame113c {
    if (!this.loaded) throw new Error('WeatherSim.driveLightning before loadWeather')
    return this.lightning.drive(this.rng, fps, thunder)
  }

  /**
   * LoadWeather 0x6fb31750, run once per act load (from 0x6fb714f0).
   *
   * @param loadActLevelId - the `0x03 LoadAct` level (`[0x6fbcc3c0]`); picks the Act III / V
   *   full-state duration.
   * @param playerLevelId - the local player's level (what SelectPrecip reads).
   */
  loadWeather(loadActLevelId: number, playerLevelId: number, input: WeatherLoadInput): void {
    const act = this.levels(requireInt(loadActLevelId, 'loadActLevelId')).act
    this.playerLevelId = this.requireLevel(playerLevelId)
    const colors = {
      rainDay: requireTable(input.colors.rainDay, 'rainDay'),
      rainDuskDawn: requireTable(input.colors.rainDuskDawn, 'rainDuskDawn'),
      rainNight: requireTable(input.colors.rainNight, 'rainNight'),
      snowGray: requireTable(input.colors.snowGray, 'snowGray'),
    }
    const { rain3, rain4, bubble3 } = input.frameCounts
    for (const [name, count] of [
      ['rain3', rain3],
      ['rain4', rain4],
      ['bubble3', bubble3],
    ] as const) {
      if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`WeatherSim: frame count ${name} = ${String(count)} must be a positive integer`)
      }
    }

    if (this.overrideValue !== 'off') this.applyOverride()
    else this.selectPrecip(1)
    if (this.firstLoadDone === 0) {
      this.resetWind()
      this.firstLoadDone = 1
    }
    this.durationBase[0] = 7500
    this.durationBase[1] = 250
    this.durationBase[2] = act === 3 || act === 5 ? 3000 * 3 : 3000
    this.durationBase[3] = 125
    this.durationRange[0] = 7500
    this.durationRange[1] = 250
    this.durationRange[2] = 3000
    this.durationRange[3] = 50
    this.rainDay = colors.rainDay
    this.rainDuskDawn = colors.rainDuskDawn
    this.rainNight = colors.rainNight
    this.snowGray = colors.snowGray
    this.splashFrames = [0, 0, rain3, rain4]
    this.bubbleFrames = [0, 0, bubble3, 0]
    this.intensityValue = 0
    this.loaded = true
  }

  /**
   * 0x6fb31720, reached for the local player from 0x6fb57e20 (S2C `0x15` reassign, 0x6fb58012):
   * clear splashes and bubbles, then SelectPrecip(arg) when `arg != 0`. `arg` is the packet byte
   * `@0x0A`, zeroed at 0x6fb57efe when the player's used skill has Skills.txt `warp` (Teleport,
   * Dragon Flight).
   *
   * While overridden, the override replaces SelectPrecip and only the clear runs.
   */
  onLocalReassign(arg: number, playerLevelId: number): void {
    this.splashes.clearAll()
    this.bubbles.clearAll()
    if (arg === 0) return
    this.playerLevelId = this.requireLevel(playerLevelId)
    if (this.overrideValue === 'off') this.selectPrecip(arg)
  }

  /**
   * NOT 1.13c. Forces precipitation for the weather-override plugin, using only vanilla code paths:
   * - `rain`: SelectPrecip's non-Act-V branch (rain, wind reset);
   * - `snow`: SelectPrecip's Act V default branch (wind reset, RNG(100), SetForced(0), SetSnow(1, 1));
   * - then EnterState(1)'s peak roll `max = 32 + RNG(224)` and SetForced(1), which pins the state
   *   machine at 2 (full). FullState then takes its default case in every level.
   * Every level counts as `Rain = 1` while overridden; `Mud` is unchanged.
   * `off` clears the lock and runs SelectPrecip(1), so the 1.13c cycle resumes from the full state.
   *
   * Before the first LoadWeather the mode is only recorded; LoadWeather applies it.
   */
  setOverride(mode: WeatherOverride, playerLevelId: number): void {
    if (mode !== 'off' && mode !== 'rain' && mode !== 'snow') {
      throw new Error(`WeatherSim: unknown override ${String(mode)}`)
    }
    if (mode === this.overrideValue) return
    this.overrideValue = mode
    if (!this.loaded) return
    this.playerLevelId = this.requireLevel(playerLevelId)
    if (mode === 'off') {
      this.forced = 0
      this.selectPrecip(1)
    } else {
      this.applyOverride()
    }
  }

  /**
   * Per-render-frame update 0x6fb31340 (from the render callback 0x6faf4230). Steps at most once per
   * game-frame counter value, with no catch-up.
   *
   * @returns whether a weather step ran.
   */
  update(input: WeatherStepInput): boolean {
    if (!this.loaded) throw new Error('WeatherSim.update before loadWeather')
    this.playerLevelId = this.requireLevel(input.levelId)
    const tick = requireInt(input.tick, 'tick')
    if (tick < 0) throw new Error(`WeatherSim: tick ${tick} is negative`)
    const camDx = requireInt(input.camDx, 'camDx')
    const camDy = requireInt(input.camDy, 'camDy')
    if (input.period < 0 || input.period > 3 || !Number.isInteger(input.period)) {
      throw new Error(`WeatherSim: period ${String(input.period)} is not 0..3`)
    }
    const width = requireInt(input.width, 'width')
    const height = requireInt(input.height, 'height')
    if (width <= 0 || height <= 87) throw new Error(`WeatherSim: screen ${width}x${height} is too small`)
    this.period = input.period
    this.width = width
    this.height = height

    const info = this.levels(this.playerLevelId)
    const rain = this.overrideValue !== 'off' || info.rain ? 1 : 0
    const mud = info.mud ? 1 : 0
    if (rain === 0 && this.prevRain !== 0) {
      if (this.particles.count) this.particles.clearAll()
      if (this.splashes.count) this.splashes.clearAll()
    }
    if (mud === 0 && this.prevMud !== 0) {
      if (this.bubbles.count) this.bubbles.clearAll()
    }
    this.prevRain = rain
    this.prevMud = mud
    if (tick <= this.lastTick) return false
    this.lastTick = tick
    if (rain !== 0) {
      if (this.particles.count) this.move(camDx, camDy)
      this.animOverlays(this.splashes, this.splashFrames, camDx, camDy)
      this.stateMachine()
      this.spawnAndWind()
    } else {
      this.intensityValue = 0
    }
    if (mud !== 0) this.animOverlays(this.bubbles, this.bubbleFrames, camDx, camDy)
    return true
  }

  /**
   * Floor pass, every render frame: context setup 0x6fac4050 plus the per-tile water test of
   * 0x6fac3ce0. One RNG(1000) is drawn for EVERY visible water tile, whether or not anything can
   * spawn; the same roll gates the splash (P = intensity) and the bubble (P = 10%).
   *
   * @param tiles - visible floor tiles with DT1 material bit 0x02, in draw order.
   * @param mud - Levels.txt `Mud` of the player's level (not affected by the override).
   */
  floorPass(tiles: readonly WeatherWaterTile[], tick: number, mud: boolean): void {
    if (!this.loaded) throw new Error('WeatherSim.floorPass before loadWeather')
    requireInt(tick, 'tick')
    const splashChance = Math.trunc(this.intensityValue * 1000)
    let splashEnabled = false
    let bubbleEnabled = false
    if (tick > this.lastSplashTick + 3) {
      this.lastSplashTick = tick
      if (splashChance !== 0) splashEnabled = true
    }
    if (mud && tick > this.lastBubbleTick + 25) {
      this.lastBubbleTick = tick
      bubbleEnabled = true
    }
    for (const tile of tiles) {
      const r = this.rng.rand(1000)
      if (splashEnabled && r < splashChance) this.spawnSplash(tile.sx, tile.sy)
      if (bubbleEnabled && r < 100) this.spawnBubble(tile.sx, tile.sy)
    }
  }

  // ── Activation (SelectPrecip and helpers) ────────────────────────────────────────────────────────

  private requireLevel(levelId: number): number {
    requireInt(levelId, 'levelId')
    this.levels(levelId)
    return levelId
  }

  /** SelectPrecip 0x6fb314f0 (arg 1 on act load / reassign, 0 on each ramp-up). */
  private selectPrecip(arg: number): void {
    const lvl = this.playerLevelId
    if (this.levels(lvl).act !== 5) {
      if (this.forced) this.forced = 0
      if (this.snowValue) this.particles.clearAll()
      this.snowValue = 0
      this.resetWind()
      return
    }
    this.resetWind()
    let forcedArg = 0
    let threshold = 0
    switch (act5WeatherCase(lvl)) {
      case 0:
        this.bigFlakes = 0
        threshold = 25
        break
      case 1:
        this.bigFlakes = 1
        break
      case 2:
        forcedArg = 1
        this.bigFlakes = 1
        break
      default:
        break
    }
    const r100 = this.rng.rand(100)
    if (r100 < threshold && arg === 0) {
      if (this.forced) this.forced = 0
      if (this.snowValue) this.particles.clearAll()
      this.snowValue = 0
      return
    }
    this.setForced(forcedArg)
    this.setSnow(1, arg)
  }

  /** SetForced 0x6fb312f0. The debug block flag (0x6fbcbf84) is never set in 1.13c. */
  private setForced(value: number): void {
    this.forced = value
    if (value !== 0) {
      this.stateValue = 2
      this.fullState()
    }
  }

  /** SetSnow 0x6fb31470. */
  private setSnow(value: number, arg: number): void {
    if (this.lightning.enabled && value) this.lightning.disable()
    if (this.forced && !value) this.forced = 0
    if (value !== this.snowValue || arg !== 0) this.particles.clearAll()
    this.snowValue = value
  }

  /** NOT 1.13c: see setOverride(). */
  private applyOverride(): void {
    if (this.overrideValue === 'rain') {
      if (this.forced) this.forced = 0
      if (this.snowValue) this.particles.clearAll()
      this.snowValue = 0
      this.resetWind()
    } else {
      this.resetWind()
      this.rng.rand(100)
      this.setForced(0)
      this.setSnow(1, 1)
    }
    this.maxValue = 32 + this.rng.rand(224)
    this.setForced(1)
  }

  /** ResetWind 0x6fb30be0 (player branch; the port only calls it with a resolved player level). */
  private resetWind(): void {
    this.angleCountdown = 125 + this.rng.rand(375)
    this.lightning.countdown = 500 + this.rng.rand(1500)
    this.angleValue = 92 + this.rng.rand(71)
    this.angleTarget = this.angleValue
  }

  // ── State machine ─────────────────────────────────────────────────────────────────────────────────

  /** 0x6fb311f0, once per weather tick in Rain levels. */
  private stateMachine(): void {
    let st = this.stateValue
    if (this.forced && st !== 2) {
      this.stateValue = 2
      this.fullState()
      return
    }
    if (this.countdown === 0) {
      st = (st + 1) & 3
      const dur = seedRange(this.rng, this.durationRange[st]!, this.durationBase[st]!)
      this.total = dur
      this.countdown = dur
      this.enterState(st)
    }
    this.countdown -= 1
    if (st === 1) {
      this.targetValue = Math.floor(((this.total - this.countdown) * this.maxValue) / this.total)
    } else if (st === 3) {
      this.targetValue = Math.floor((this.maxValue * this.countdown) / this.total)
    }
    this.intensityValue = Math.fround(this.targetValue / 256)
  }

  /** EnterState 0x6fb31120. Refuses everything but state 2 while forced; `st` stays local. */
  private enterState(s: number): void {
    if (s < 0 || s > 3) throw new Error(`WeatherSim: EnterState(${s})`)
    if (this.forced && s !== 2) return
    this.stateValue = s
    switch (s) {
      case 0:
        this.targetValue = 0
        break
      case 1:
        this.selectPrecip(0)
        this.maxValue = 32 + this.rng.rand(224)
        break
      case 2:
        this.fullState()
        break
      default:
        this.lightning.disable() // 0x6fb311b7
        break
    }
  }

  /** FullState 0x6fb30ca0. The override always takes the default case. */
  private fullState(): void {
    const c = this.overrideValue !== 'off' ? 3 : act5WeatherCase(this.playerLevelId)
    switch (c) {
      case 0:
        this.snowAngleBase = 42
        this.snowAngleRange = 170
        this.maxValue = 32 + this.rng.rand(56)
        this.targetValue = this.maxValue
        return
      case 1:
        this.snowAngleBase = 170
        this.snowAngleRange = 56
        this.maxValue = 32 + this.rng.rand(112)
        this.targetValue = this.maxValue
        return
      case 2:
        this.snowAngleBase = 28
        this.snowAngleRange = 28
        this.angleValue = 28
        this.angleTarget = 28
        this.maxValue = 256
        this.targetValue = 256
        return
      default:
        this.targetValue = this.maxValue
        if (this.snowValue) {
          this.lightning.disable() // 0x6fb30dcb
          return
        }
        this.rng.step()
        // 0x6fb30df0 `xor eax,eax; test eax,eax; setne`: natural lightning is the constant 0.
        this.lightning.disable() // 0x6fb30dfb
    }
  }

  // ── Particles ───────────────────────────────────────────────────────────────────────────────────

  /** SpawnAndWind 0x6fb30e30. */
  private spawnAndWind(): void {
    while (this.particles.count < this.targetValue) {
      if (this.spawnParticle() < 0) {
        throw new Error(`WeatherSim: particle pool full at ${this.particles.count} below target ${this.targetValue}`)
      }
    }
    const step = this.snowValue ? 1 : 2
    if (this.angleTarget < this.angleValue) {
      this.angleValue -= step
      if (this.angleValue < this.angleTarget) this.angleValue = this.angleTarget
    } else if (this.angleTarget > this.angleValue) {
      this.angleValue += step
      if (this.angleValue > this.angleTarget) this.angleValue = this.angleTarget
    }
    this.angleCountdown -= 1
    if (this.angleCountdown === 0) {
      if (this.snowValue) {
        this.angleCountdown = 250 + this.rng.rand(875)
        this.angleTarget = seedRange(this.rng, this.snowAngleRange, this.snowAngleBase)
      } else {
        this.angleCountdown = 125 + this.rng.rand(375)
        this.angleTarget = 92 + this.rng.rand(71)
      }
    }
    this.lightning.tail() // 0x6fb30f3c..0x6fb30f4e
  }

  /**
   * Spawn 0x6fb30700. RNG order: x, yEnd, y, phase, then (snow) one discarded draw or (rain) the
   * colour index.
   *
   * @returns the slot index, or -1 when the pool is full.
   */
  private spawnParticle(): number {
    const index = this.particles.alloc()
    if (index < 0) return -1
    const p = this.particles.records[index]!
    const w = this.width
    const h = this.height
    p.landed = 0
    p.x = seedRange(this.rng, w, 0)
    p.yEnd = seedRange(this.rng, h - 87, 40)
    p.y = seedRange(this.rng, p.yEnd + 20, -20)
    p.phase = this.rng.step() & 511
    const depth = Math.fround((p.yEnd - 40) / (h - 87))
    if (this.snowValue) {
      p.alpha = 0xff
      this.rng.step()
      p.landTicks = 1
      p.speed = 8 - Math.trunc(depth * -28)
      let size = Math.trunc(((p.yEnd - 40) * 7) / (h - 87))
      if (this.bigFlakes) size += 1
      if (size < 0 || size >= 8) throw new Error(`WeatherSim: snow flake size ${size}`)
      p.sizeOrLen = size
      this.snowColor(p, size)
    } else {
      const ci = this.rng.step() % 12
      switch (this.period) {
        case PeriodOfDay.Day:
          p.color = this.rainDay[ci]!
          p.alpha = 0x7f
          break
        case PeriodOfDay.Dusk:
        case PeriodOfDay.Dawn:
          p.color = this.rainDuskDawn[ci]!
          p.alpha = 0xff
          break
        case PeriodOfDay.Night:
          p.color = this.rainNight[ci]!
          p.alpha = 0xff
          break
        default:
          throw new Error(`WeatherSim: period ${String(this.period)}`)
      }
      p.sizeOrLen = 4 - Math.trunc(depth * -8)
      p.speed = 15 - Math.trunc(depth * -15)
      p.landTicks = 3
    }
    return index
  }

  /** SnowColor 0x6fb304c0, GDI / DirectDraw / Direct3D branch. */
  private snowColor(p: WeatherParticle, size: number): void {
    const period = this.period
    p.alpha = SNOW_ALPHA_BY_PERIOD[period]!
    const idx = Math.trunc((size * 12) / 8)
    if (period === PeriodOfDay.Day) p.color = this.snowGray[idx]!
    else if (period === PeriodOfDay.Night) p.color = this.snowGray[Math.trunc(idx / 4)]!
    else p.color = this.snowGray[Math.trunc(idx / 2)]!
  }

  /** Move 0x6fb30f60, once per weather tick while particles exist. */
  private move(camDx: number, camDy: number): void {
    let factor: number
    if (this.snowValue) {
      factor = Math.abs(fogCos(this.angleValue))
      if (factor < F32_SNOW_SPEED_MIN) factor = F32_SNOW_SPEED_MIN
    } else {
      factor = Math.fround(F32_RAIN_SPEED_BASE + this.intensityValue * F32_RAIN_SPEED_INTENSITY)
    }
    const cos = fogCos(this.angleValue)
    const sin = fogSin(this.angleValue)
    const w = this.width
    const pool = this.particles
    for (let i = 0; i <= pool.maxIndex; i += 1) {
      const p = pool.records[i]!
      if (p.serial === 0) continue
      const sp = Math.trunc(p.speed * factor)
      let dx = Math.trunc(cos * sp)
      const dy = Math.trunc(sin * sp)
      p.y = (p.y + dy - camDy) | 0
      if (p.y > p.yEnd) p.landed = 1
      if (p.landed) {
        if (p.landTicks === 0) {
          pool.free(i)
          if (pool.count < this.targetValue) this.spawnParticle()
        } else {
          dx = 0
          p.speed = 0
          p.landTicks -= 1
        }
      }
      // Re-check: the slot may now hold a particle respawned into it this very tick.
      if (p.serial !== 0) {
        if (this.snowValue && !p.landed) {
          const sway = (Math.floor(((this.moveFrame << 9) >>> 0) / 25) + p.phase) & 511
          dx += Math.trunc(2 * fogSin(sway))
        }
        p.x = (p.x - camDx + dx) | 0
        if (p.x >= w) p.x -= w
        if (p.x < 0) p.x += w
      }
    }
    this.moveFrame = (this.moveFrame + 1) >>> 0
  }

  // ── Splashes and bubbles ──────────────────────────────────────────────────────────────────────────

  /** A uniform point in the 160×80 tile diamond: row r, half-width 80 − 2|r − 40|. */
  private diamondPoint(sx: number, sy: number): { x: number; y: number } {
    const r = this.rng.rand(TILE_DIAMOND_ROWS)
    const w = 80 - 2 * Math.abs(r - 40)
    return { x: (sx + seedRange(this.rng, 2 * w, -w)) | 0, y: (sy + r) | 0 }
  }

  /** SpawnSplash 0x6fb30a70 (screen-space mode). */
  private spawnSplash(sx: number, sy: number): void {
    const index = this.splashes.alloc()
    if (index < 0) return
    const o = this.splashes.records[index]!
    const at = this.diamondPoint(sx, sy)
    o.x = at.x
    o.y = at.y
    o.type = 2 + (this.rng.step() & 1)
    o.frame = 0
    o.delay = 2
  }

  /** SpawnBubble 0x6fb30940 (screen-space mode). */
  private spawnBubble(sx: number, sy: number): void {
    const index = this.bubbles.alloc()
    if (index < 0) return
    const o = this.bubbles.records[index]!
    const at = this.diamondPoint(sx, sy)
    o.x = at.x
    o.y = (at.y - 30) | 0
    o.type = 2
    o.frame = 0
    o.delay = 2
  }

  /** Splash 0x6fb30160 / bubble 0x6fb300d0 animation (screen-space mode). */
  private animOverlays(
    pool: FogPool<WeatherOverlay>,
    frameCounts: readonly number[],
    camDx: number,
    camDy: number,
  ): void {
    for (let i = 0; i <= pool.maxIndex; i += 1) {
      const o = pool.records[i]!
      if (o.serial === 0) continue
      o.x = (o.x - camDx) | 0
      o.y = (o.y - camDy) | 0
      o.delay -= 1
      if (o.delay > 0) continue
      o.frame += 1
      o.delay = 2
      if (o.frame >= frameCounts[o.type]!) pool.free(i)
    }
  }
}
