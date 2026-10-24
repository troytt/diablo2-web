/**
 * Diablo II v1.13c 25 Hz Acoustic Environment & Weather Controller (`src/client/audio/sound-environ-113c.ts`).
 *
 * Implements D2Client.dll 0x6faff700-0x6faffbea (`SoundEnvironTick` at 0x6faff860, `IsNightTime` at
 * 0x6faff700, `GetRainIntensity` at 0x6faff770, `AmbientReset` at 0x6faff7c0) and weather thunder
 * (`0x6fb30645`) over the shared `SoundRecords113c` pool and deterministic `D2Rng`.
 */

import {
  LEVEL_SOUND_ENV_113C,
  SOUND_ENVIRON_113C,
  SOUND_ENVIRON_ROW_COUNT_113C,
  type SoundEnvironRow113c,
} from '../../common/audio/sound-environ-113c.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import type { SoundRecords113c } from './sound-records-113c.ts'

/** D2Client.dll 0x6faff9ae: 250-tick (10 s at 25 Hz) crossfade duration for same-environment Day<->Night transitions. */
export const AMBIENCE_DAY_NIGHT_CROSSFADE_TICKS_113C = 0xfa // 250

/** D2Client.dll 0x6faff952: `Sounds.txt` row 64 (`scene_rain`) looped weather rain bed. */
export const WEATHER_RAIN_SOUND_ID_113C = 64

/** D2Client.dll 0x6fb30645: `Sounds.txt` row 202 (`event_thunder_1`, groupSize = 3 -> 202..204). */
export const WEATHER_THUNDER_SOUND_ID_113C = 202

/** F17 weather rain volume ramp rate (`+-6` per 25 Hz tick on the `0..255` record volume scale). */
export const WEATHER_RAIN_VOLUME_STEP_PER_TICK_113C = 6

/** D2Client.dll 0x6faffb35-0x6faffb80: spatial offset bounds for periodic Day/Night Event one-shots. */
export const EVENT_OFFSET_MIN_ABS_X_113C = 450
export const EVENT_OFFSET_X_SPAN_113C = 301 // 450 + rand(301) -> 450..750
export const EVENT_OFFSET_MIN_Y_113C = -100
export const EVENT_OFFSET_Y_SPAN_113C = 201 // rand(201) - 100 -> -100..100
export const EVENT_OFFSET_Z_113C = 0

/** Compensates `SOUND_POS_Z = 640` added inside `SoundRecords113c.setSoundPos` so `RecordView.z === 0`. */
const SET_SOUND_POS_Z_COMPENSATION_113C = -640

export interface WeatherAudioStateInput113c {
  readonly raining?: boolean | undefined
  readonly rainVolume?: number | undefined
  readonly rainIntensity?: number | undefined
}

export interface SoundEnvironTickOptions113c {
  readonly levelId?: number | undefined
  readonly tod?: number | undefined
  readonly raining?: boolean | undefined
  readonly rainVolume?: number | undefined
}

export interface SoundEnvironOptions113c {
  readonly records: SoundRecords113c
  readonly rng?: D2Rng | undefined
  readonly preloadAct?: ((act: number) => void) | undefined
  readonly onEnterAct?: ((act: number) => void) | undefined
  readonly preloadPack?: ((packId: string) => void) | undefined
  readonly prefetchPack?: ((packId: string) => void) | undefined
  readonly onPreloadPack?: ((packId: string) => void) | undefined
}

/**
 * D2Client.dll 0x6faff700 (`IsNightTime`) & 0x6faff8af-0x6faff8c2:
 * `tod in {1, 2, 3}` (DAWN, DAY, DUSK_EARLY) -> Day (`false`);
 * `tod < 1 || tod > 3` (`0` = NIGHT, `4` = DUSK) -> Night (`true`).
 */
export function isNightTimeOfDay113c(tod: number): boolean {
  return tod < 1 || tod > 3
}

/**
 * Maps `PeriodOfDay` (`Day = 0, Dusk = 1, Night = 2, Dawn = 3`) from `src/common/world/environment.ts`
 * to `SoundEnviron113c`'s 1.13c `tod` code (`0` = Night, `1..3` = Dawn/Day/Dusk).
 */
export function periodOfDayToSoundEnvironTod113c(period: number): number {
  switch (period) {
    case 2: // PeriodOfDay.Night
      return 0
    case 3: // PeriodOfDay.Dawn
      return 1
    case 0: // PeriodOfDay.Day
      return 2
    case 1: // PeriodOfDay.Dusk
      return 3
    default:
      return 2
  }
}

/**
 * Resolves `levelId (1..136)` -> Act number `1..5` (`Levels.txt` Act boundaries), or `0` if invalid.
 */
export function levelIdToAct113c(levelId: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > 136) return 0
  if (levelId < 40) return 1
  if (levelId < 75) return 2
  if (levelId < 103) return 3
  if (levelId < 109) return 4
  return 5
}

/**
 * Resolves `levelId (1..136)` -> `SoundEnvironRow113c` (`0..49`), or `SOUND_ENVIRON_113C[0]` (`none`)
 * when `levelId` is out of range.
 */
export function resolveLevelSoundEnviron113c(levelId: number): SoundEnvironRow113c {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > 136) {
    return SOUND_ENVIRON_113C[0]!
  }
  const envIdx = LEVEL_SOUND_ENV_113C[levelId] ?? 0
  if (envIdx < 0 || envIdx >= SOUND_ENVIRON_ROW_COUNT_113C) {
    return SOUND_ENVIRON_113C[0]!
  }
  return SOUND_ENVIRON_113C[envIdx] ?? SOUND_ENVIRON_113C[0]!
}

/**
 * D2Client.dll 0x6faffad3-0x6faffaf5 & 0x6faffb93-0x6faffbc3:
 * Computes jittered event delay in ticks: `EventDelay - floor(EventDelay/6) + rng.rand(2 * floor(EventDelay/6) + 1)`.
 */
export function rollEventDelayTicks113c(eventDelay: number, rng: D2Rng): number {
  if (eventDelay <= 0) return 0
  const jitter = Math.floor(eventDelay / 6)
  const span = jitter * 2 + 1
  const draw = span > 1 ? rng.rand(span) : 0
  return eventDelay - jitter + draw
}

/**
 * D2Client.dll 0x6faffb35-0x6faffb80:
 * Draws spatial offset `(x, y, z)` for a periodic environment event one-shot:
 * `|x| in [450, 750]`, `y in [-100, 100]`, `z = 0`.
 */
export function rollEventSpatialOffset113c(rng: D2Rng): { x: number; y: number; z: number } {
  const mag = EVENT_OFFSET_MIN_ABS_X_113C + rng.rand(EVENT_OFFSET_X_SPAN_113C)
  const sign = rng.rand(2) !== 0 ? 1 : -1
  const x = sign * mag
  const y = rng.rand(EVENT_OFFSET_Y_SPAN_113C) + EVENT_OFFSET_MIN_Y_113C
  return { x, y, z: EVENT_OFFSET_Z_113C }
}

export class SoundEnviron113c {
  private readonly records: SoundRecords113c
  private readonly rng: D2Rng
  private readonly preloadActCb: ((act: number) => void) | undefined
  private readonly onEnterActCb: ((act: number) => void) | undefined
  private readonly preloadPackCb: ((packId: string) => void) | undefined
  private readonly prefetchPackCb: ((packId: string) => void) | undefined
  private readonly onPreloadPackCb: ((packId: string) => void) | undefined

  private levelIdValue = 0
  private envIndexValue = 0
  private lastTickEnvIndex = 0
  private todValue = 2 // default Day
  private lastTickValue: number | null = null
  private lastPreloadedAct = 0

  // BSS [0x6fbcc314], [0x6fbcc31c]
  private ambienceHandleValue = 0
  private currentAmbienceId = 0
  private fadingAmbienceHandles: number[] = []

  // BSS [0x6fbcc324], [0x6fbcc328], [0x6fbcc32c]
  private eventHandleValue = 0
  private currentEventId = 0
  private eventDelayTicks = 0
  private lastEventTick = 0

  // BSS [0x6fbcc318], [0x6fbcc320] + F17 +-6/tick ramp state
  private rainingValue = false
  private targetRainVolume = 0
  private currentRainVolume = 0
  private rainHandleValue = 0

  constructor(options: SoundEnvironOptions113c) {
    if (!options || !options.records) {
      throw new Error('SoundEnviron113c: options.records (SoundRecords113c) is required')
    }
    this.records = options.records
    this.rng = options.rng ?? new D2Rng(1)
    this.preloadActCb = options.preloadAct
    this.onEnterActCb = options.onEnterAct !== options.preloadAct ? options.onEnterAct : undefined
    this.preloadPackCb = options.preloadPack
    this.prefetchPackCb = options.prefetchPack !== options.preloadPack ? options.prefetchPack : undefined
    this.onPreloadPackCb =
      options.onPreloadPack !== options.preloadPack && options.onPreloadPack !== options.prefetchPack
        ? options.onPreloadPack
        : undefined
  }

  get levelId(): number {
    return this.levelIdValue
  }

  get currentLevelId(): number {
    return this.levelIdValue
  }

  get envIndex(): number {
    return this.envIndexValue
  }

  get currentEnvId(): number {
    return this.envIndexValue
  }

  get timeOfDay(): number {
    return this.todValue
  }

  get raining(): boolean {
    return this.rainingValue
  }

  get rainVolume(): number {
    return this.currentRainVolume
  }

  get ambienceHandle(): number {
    return this.ambienceHandleValue
  }

  get eventHandle(): number {
    return this.eventHandleValue
  }

  get rainHandle(): number {
    return this.rainHandleValue
  }

  /** Enters or switches to `levelId` (1..136) and optional `tod` (0..4). */
  enterLevel(levelId: number, tod?: number): void {
    if (tod !== undefined && Number.isInteger(tod)) {
      this.todValue = tod
    }
    const prevLevel = this.levelIdValue
    this.levelIdValue = Number.isInteger(levelId) ? levelId : 0
    const envRow = resolveLevelSoundEnviron113c(this.levelIdValue)
    this.envIndexValue = envRow.index

    const act = levelIdToAct113c(this.levelIdValue)
    if (act > 0 && (act !== this.lastPreloadedAct || this.levelIdValue !== prevLevel)) {
      this.preloadAmbientAct(act)
    }
  }

  /** Alias of {@link enterLevel}. */
  onEnterArea(levelId: number, tod?: number): void {
    this.enterLevel(levelId, tod)
  }

  /** Alias of {@link enterLevel}. */
  setLevel(levelId: number, tod?: number): void {
    this.enterLevel(levelId, tod)
  }

  /** Notifies registered preload callbacks for the given Act (`1..5`). */
  preloadAmbientAct(act: number): void {
    if (!Number.isInteger(act) || act < 1 || act > 5) return
    this.lastPreloadedAct = act
    const packId = `sfx-ambient-act${String(act)}`
    this.preloadActCb?.(act)
    this.onEnterActCb?.(act)
    this.preloadPackCb?.(packId)
    this.prefetchPackCb?.(packId)
    this.onPreloadPackCb?.(packId)
  }

  /** Updates the current period of day (`0..4`). */
  setTimeOfDay(tod: number): void {
    if (Number.isInteger(tod)) {
      this.todValue = tod
    }
  }

  /** Sets weather rain state and target volume (`0..255`). */
  setRaining(raining: boolean, targetVolume = 255): void {
    this.rainingValue = Boolean(raining)
    if (!this.rainingValue) {
      this.targetRainVolume = 0
      return
    }
    const clamped = Math.max(
      0,
      Math.min(255, Math.trunc(Number.isFinite(targetVolume) ? targetVolume : 255)),
    )
    this.targetRainVolume = clamped
  }

  /** Sets weather state from a structured state object (`raining`, `rainVolume`, `rainIntensity`) or boolean. */
  setWeather(state: WeatherAudioStateInput113c | boolean, targetVolume?: number): void {
    if (typeof state === 'boolean') {
      this.setRaining(state, targetVolume ?? (state ? 255 : 0))
      return
    }
    const raining = Boolean(state?.raining)
    if (!raining) {
      this.setRaining(false, 0)
      return
    }
    const vol =
      targetVolume ??
      state.rainVolume ??
      (state.rainIntensity !== undefined ? Math.round(state.rainIntensity * 255) : 255)
    this.setRaining(true, vol)
  }

  /** Sets weather rain from normalized intensity (`0..1` or `0..255`). */
  setWeatherIntensity(intensity: number): void {
    if (!Number.isFinite(intensity) || intensity <= 0) {
      this.setRaining(false, 0)
      return
    }
    const vol = intensity <= 1 ? Math.round(intensity * 255) : Math.round(intensity)
    this.setRaining(true, vol)
  }

  /**
   * D2Client.dll 0x6fb30645: Triggers a one-shot thunder variant in `202..204` (`event_thunder_1..3`).
   * Suppressed when indoors (`SoundEnviron.txt Indoors = 1` or invalid level `envIndex === 0`).
   */
  triggerThunder(): number {
    const envRow = resolveLevelSoundEnviron113c(this.levelIdValue)
    if (envRow.index === 0 || envRow.indoors !== 0) {
      return 0
    }
    return this.records.play(WEATHER_THUNDER_SOUND_ID_113C)
  }

  /** Alias of {@link triggerThunder}. */
  playThunder(): number {
    return this.triggerThunder()
  }

  /**
   * D2Client.dll 0x6faff860-0x6faffbea (`SoundEnvironTick`):
   * Steps the 25 Hz environment ambience, periodic event timer, and weather rain ramp.
   * Idempotent when called multiple times with the same `gameTick` (`[T2-F16-02]`).
   */
  tick(gameTick?: number, opts?: SoundEnvironTickOptions113c): void {
    if (opts?.levelId !== undefined && opts.levelId !== this.levelIdValue) {
      this.enterLevel(opts.levelId, opts.tod)
    } else if (opts?.tod !== undefined && opts.tod !== this.todValue) {
      this.setTimeOfDay(opts.tod)
    }
    if (opts?.raining !== undefined) {
      this.setRaining(opts.raining, opts.rainVolume ?? (opts.raining ? (this.targetRainVolume || 255) : 0))
    }

    const resolvedTick = gameTick !== undefined ? gameTick : (this.lastTickValue ?? 0) + 1
    if (this.lastTickValue === resolvedTick) {
      return
    }
    this.lastTickValue = resolvedTick

    const envRow = resolveLevelSoundEnviron113c(this.levelIdValue)
    const envChanged = this.lastTickEnvIndex !== 0 && envRow.index !== this.lastTickEnvIndex
    this.envIndexValue = envRow.index
    this.lastTickEnvIndex = envRow.index

    // 1. Invalid level or SoundEnv = 0 (`none`): stop all active ambience, events, and rain immediately.
    if (envRow.index === 0) {
      this.stopAmbienceAndEventsImmediate()
      this.stopRainImmediate()
      return
    }

    // 2. Resolve Day vs Night targets (0x6faff8af-0x6faff939).
    const night = isNightTimeOfDay113c(this.todValue)
    const wantAmbience = night ? envRow.nightAmbience : envRow.dayAmbience
    const wantEvent = night ? envRow.nightEvent : envRow.dayEvent

    // Prune any fading ambience handles that have already been freed by SoundRecords113c.
    if (this.fadingAmbienceHandles.length > 0) {
      this.fadingAmbienceHandles = this.fadingAmbienceHandles.filter((h) => this.records.record(h) !== undefined)
    }

    // 3. Ambience transition (0x6faff973-0x6faffa24).
    const activeAmbRec = this.ambienceHandleValue !== 0 ? this.records.record(this.ambienceHandleValue) : undefined
    const ambAlive = activeAmbRec !== undefined && !activeAmbRec.stop

    if (envChanged || wantAmbience !== this.currentAmbienceId || (wantAmbience > 0 && !ambAlive)) {
      const isDayNightSwap =
        !envChanged &&
        ambAlive &&
        this.currentAmbienceId > 0 &&
        wantAmbience > 0 &&
        wantAmbience !== this.currentAmbienceId &&
        ((wantAmbience === envRow.dayAmbience && this.currentAmbienceId === envRow.nightAmbience) ||
          (wantAmbience === envRow.nightAmbience && this.currentAmbienceId === envRow.dayAmbience))

      if (isDayNightSwap) {
        // 0x6faff9a8-0x6faff9bd: 250-tick (0xfa) crossfade of outgoing Day/Night ambience.
        this.records.fade(this.ambienceHandleValue, AMBIENCE_DAY_NIGHT_CROSSFADE_TICKS_113C, 0)
        this.fadingAmbienceHandles.push(this.ambienceHandleValue)
        this.ambienceHandleValue = 0
      } else {
        // 0x6faff9bf-0x6faff9d6: Area/environment change -> stop previous ambience and events immediately.
        this.stopAmbienceAndEventsImmediate()
      }

      if (wantAmbience > 0) {
        this.ambienceHandleValue = this.records.play(wantAmbience)
        this.currentAmbienceId = wantAmbience
      } else {
        this.ambienceHandleValue = 0
        this.currentAmbienceId = 0
      }
    }

    // 4. Weather rain loop (0x6faffa24-0x6faffabc, id 64 `scene_rain`, +-6/tick ramp).
    this.stepWeatherRain(envRow)

    // 5. Periodic Day/Night Event timer & spatial offset (0x6faffac0-0x6faffbea).
    this.stepPeriodicEvent(resolvedTick, envRow, wantEvent)
  }

  /**
   * D2Client.dll 0x6faff7c0 (`AmbientReset`): stops all active ambience, event, and rain handles
   * immediately and resets controller state.
   */
  stopAll(): void {
    this.stopAmbienceAndEventsImmediate()
    this.stopRainImmediate()
    this.levelIdValue = 0
    this.envIndexValue = 0
    this.lastTickEnvIndex = 0
    this.lastTickValue = null
    this.lastPreloadedAct = 0
    this.rainingValue = false
    this.targetRainVolume = 0
  }

  /** Alias of {@link stopAll}. */
  reset(): void {
    this.stopAll()
  }

  private stepWeatherRain(envRow: SoundEnvironRow113c): void {
    const isIndoors = envRow.index === 0 || envRow.indoors !== 0
    const effectiveRaining = this.rainingValue && !isIndoors && this.targetRainVolume > 0

    // Check if existing rainHandle is still alive in SoundRecords113c
    if (this.rainHandleValue !== 0) {
      const rec = this.records.record(this.rainHandleValue)
      if (rec === undefined || rec.stop) {
        this.rainHandleValue = 0
      }
    }

    if (effectiveRaining) {
      if (this.rainHandleValue === 0) {
        // Start rain loop (a2 = 2 skips row.fadeIn=12 so SoundEnviron113c's own +-6/tick ramp controls rec.vol directly)
        this.rainHandleValue = this.records.play(WEATHER_RAIN_SOUND_ID_113C, { a2: 2 })
        this.currentRainVolume = 0
      }
      if (this.currentRainVolume < this.targetRainVolume) {
        this.currentRainVolume = Math.min(
          this.targetRainVolume,
          this.currentRainVolume + WEATHER_RAIN_VOLUME_STEP_PER_TICK_113C,
        )
      } else if (this.currentRainVolume > this.targetRainVolume) {
        this.currentRainVolume = Math.max(
          this.targetRainVolume,
          this.currentRainVolume - WEATHER_RAIN_VOLUME_STEP_PER_TICK_113C,
        )
      }
      // Ensure volume is at least 1 on the first active tick so SoundUpdate starts the channel immediately
      const appliedVol = Math.max(1, this.currentRainVolume)
      if (this.rainHandleValue !== 0) {
        this.records.setVolume(this.rainHandleValue, appliedVol)
      }
    } else {
      if (this.rainHandleValue !== 0 || this.currentRainVolume > 0) {
        this.currentRainVolume = Math.max(0, this.currentRainVolume - WEATHER_RAIN_VOLUME_STEP_PER_TICK_113C)
        if (this.currentRainVolume > 0 && this.rainHandleValue !== 0) {
          this.records.setVolume(this.rainHandleValue, this.currentRainVolume)
        } else {
          this.stopRainImmediate()
        }
      }
    }
  }

  private stepPeriodicEvent(gameTick: number, envRow: SoundEnvironRow113c, wantEvent: number): void {
    if (wantEvent <= 0 || envRow.eventDelay <= 0) {
      if (this.eventHandleValue !== 0) {
        this.stopHandleImmediate(this.eventHandleValue)
        this.eventHandleValue = 0
      }
      this.currentEventId = 0
      this.eventDelayTicks = 0
      this.lastEventTick = gameTick
      return
    }

    // Check if previous event record is still active in SoundRecords113c
    if (this.eventHandleValue !== 0) {
      const prevRec = this.records.record(this.eventHandleValue)
      if (prevRec === undefined || prevRec.stop) {
        this.eventHandleValue = 0
      }
    }

    // 0x6faffac0-0x6faffb12: Event ID changed (or first tick in environment) -> arm jittered timer and initial phase
    if (wantEvent !== this.currentEventId || this.eventDelayTicks <= 0) {
      this.currentEventId = wantEvent
      this.eventDelayTicks = rollEventDelayTicks113c(envRow.eventDelay, this.rng)
      const initialPhase = this.eventDelayTicks > 0 ? this.rng.rand(this.eventDelayTicks) : 0
      this.lastEventTick = gameTick - initialPhase
    }

    // 0x6faffb20: Check elapsed ticks since lastEventTick
    const elapsed = gameTick - this.lastEventTick
    if (elapsed < this.eventDelayTicks) {
      return
    }

    // [T2-F16-04]: Never stack a second overlapping event record while the previous event is still playing
    if (this.eventHandleValue !== 0) {
      return
    }

    // 0x6faffb2c-0x6faffb80: Play event variant and apply 1.13c spatial offset
    const h = this.records.play(wantEvent)
    this.eventHandleValue = h
    const offset = rollEventSpatialOffset113c(this.rng)
    if (h !== 0) {
      this.records.setSoundPos(h, offset.x, offset.y, offset.z + SET_SOUND_POS_Z_COMPENSATION_113C)
    }

    // 0x6faffb85-0x6faffbc3: Reset timer reference and roll next jittered delay
    this.lastEventTick = gameTick
    this.eventDelayTicks = rollEventDelayTicks113c(envRow.eventDelay, this.rng)
  }

  private stopAmbienceAndEventsImmediate(): void {
    if (this.ambienceHandleValue !== 0) {
      this.stopHandleImmediate(this.ambienceHandleValue)
      this.ambienceHandleValue = 0
    }
    if (this.fadingAmbienceHandles.length > 0) {
      for (const h of this.fadingAmbienceHandles) {
        this.stopHandleImmediate(h)
      }
      this.fadingAmbienceHandles = []
    }
    if (this.eventHandleValue !== 0) {
      this.stopHandleImmediate(this.eventHandleValue)
      this.eventHandleValue = 0
    }
    this.currentAmbienceId = 0
    this.currentEventId = 0
    this.eventDelayTicks = 0
  }

  private stopRainImmediate(): void {
    if (this.rainHandleValue !== 0) {
      this.stopHandleImmediate(this.rainHandleValue)
      this.rainHandleValue = 0
    }
    this.currentRainVolume = 0
  }

  private stopHandleImmediate(handle: number): void {
    if (handle === 0) return
    this.records.stop(handle)
    const internalActive = (
      this.records as unknown as {
        active?: Array<{ handle: number; stop: boolean; fading: boolean }>
      }
    ).active
    if (Array.isArray(internalActive)) {
      for (const rec of internalActive) {
        if (rec.handle === handle) {
          rec.stop = true
          rec.fading = false
        }
      }
    }
  }
}

export { SoundEnviron113c as SoundEnvironController113c }
