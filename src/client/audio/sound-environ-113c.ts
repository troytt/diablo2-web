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
import { getLevelLighting } from '../../common/world/levels-meta.ts'
import type { SoundRecords113c } from './sound-records-113c.ts'

/** D2Client.dll 0x6faff9ae: 250-tick (10 s at 25 Hz) crossfade duration for same-environment Day<->Night transitions. */
export const AMBIENCE_DAY_NIGHT_CROSSFADE_TICKS_113C = 0xfa // 250

/** D2Client.dll 0x6faff946: `Sounds.txt` row 64 (`scene_rain`) looped weather rain bed. */
export const WEATHER_RAIN_SOUND_ID_113C = 64

/** D2Client.dll 0x6fb30645: `Sounds.txt` row 202 (`event_thunder_1`, groupSize = 3 -> 202..204). */
export const WEATHER_THUNDER_SOUND_ID_113C = 202

/** D2Client.dll 0x6faffa68 / 0x6faffa71: weather rain volume ramp rate (`+-6` per 25 Hz tick on `0..255`). */
export const WEATHER_RAIN_VOLUME_STEP_PER_TICK_113C = 6

/** D2Client.dll 0x6faffb43-0x6faffb80: spatial offset bounds for periodic Day/Night Event one-shots. */
export const EVENT_OFFSET_MIN_ABS_X_113C = 450
export const EVENT_OFFSET_X_SPAN_113C = 301 // 450 + rand(301) -> 450..750
export const EVENT_OFFSET_MIN_Y_113C = -100
export const EVENT_OFFSET_Y_SPAN_113C = 201 // rand(201) - 100 -> -100..100
export const EVENT_OFFSET_Z_113C = 0

/** D2Client.dll 0x6fb30648-0x6fb306b0: thunder delay (`25 + rand(50)`) and spatial offset (`-200 + rand(400)`). */
export const THUNDER_DELAY_MIN_TICKS_113C = 25
export const THUNDER_DELAY_SPAN_TICKS_113C = 50
export const THUNDER_OFFSET_MIN_113C = -200
export const THUNDER_OFFSET_SPAN_113C = 400
export const THUNDER_OFFSET_Z_113C = 0

/** D2Client.dll 0x6fb87540: float scale (`0.001f`) applied by `0x6fb0cf90` to integer EAX columns before `D2sound.#10058`. */
export const EAX_FLOAT_SCALE_113C = Math.fround(0.001)

/**
 * D2Client.dll 0x6fb0cfe0-0x6fb0d06f (`ApplySoundEnvironEax`):
 * 13-field EAX environment preset struct passed in `ecx` to `D2sound.#10058` (`0x6fabd306`).
 * The 8 float members (`eaxEnvSize`, `eaxEnvDiff`, `eaxDecayTime`, `eaxDecayHF`, `eaxReflectDelay`,
 * `eaxRevDelay`, `eaxRoomRoll`, `eaxAirAbsorb`) are scaled by `0.001f` (`0x6fb87540`).
 */
export interface SoundEnvironEaxPreset113c {
  readonly eaxEnviron: number
  readonly eaxEnvSize: number
  readonly eaxEnvDiff: number
  readonly eaxRoomVol: number
  readonly eaxRoomHF: number
  readonly eaxDecayTime: number
  readonly eaxDecayHF: number
  readonly eaxReflect: number
  readonly eaxReflectDelay: number
  readonly eaxReverb: number
  readonly eaxRevDelay: number
  readonly eaxRoomRoll: number
  readonly eaxAirAbsorb: number
}

/**
 * D2Client.dll 0x6fb0cfe0-0x6fb0d06f:
 * Scales a `SoundEnvironRow113c` (or `envIdx` `0..49`) into the 13-field `D2sound.#10058` EAX preset struct.
 */
export function scaleSoundEnvironEaxPreset113c(
  rowOrEnvIdx: SoundEnvironRow113c | number,
): SoundEnvironEaxPreset113c {
  const row =
    typeof rowOrEnvIdx === 'number'
      ? (SOUND_ENVIRON_113C[rowOrEnvIdx] ?? SOUND_ENVIRON_113C[0]!)
      : rowOrEnvIdx
  return {
    eaxEnviron: row.eaxEnviron | 0,
    eaxEnvSize: Math.fround(row.eaxEnvSize * EAX_FLOAT_SCALE_113C),
    eaxEnvDiff: Math.fround(row.eaxEnvDiff * EAX_FLOAT_SCALE_113C),
    eaxRoomVol: row.eaxRoomVol | 0,
    eaxRoomHF: row.eaxRoomHF | 0,
    eaxDecayTime: Math.fround(row.eaxDecayTime * EAX_FLOAT_SCALE_113C),
    eaxDecayHF: Math.fround(row.eaxDecayHF * EAX_FLOAT_SCALE_113C),
    eaxReflect: row.eaxReflect | 0,
    eaxReflectDelay: Math.fround(row.eaxReflectDelay * EAX_FLOAT_SCALE_113C),
    eaxReverb: row.eaxReverb | 0,
    eaxRevDelay: Math.fround(row.eaxRevDelay * EAX_FLOAT_SCALE_113C),
    eaxRoomRoll: Math.fround(row.eaxRoomRoll * EAX_FLOAT_SCALE_113C),
    eaxAirAbsorb: Math.fround(row.eaxAirAbsorb * EAX_FLOAT_SCALE_113C),
  }
}

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
  /** D2sound.#10059 sound mode (`0` = 2D default, `1` = 3D DirectSound3D, `2` = 3D EAX). */
  readonly soundMode?: (() => 0 | 1 | 2) | (0 | 1 | 2) | undefined
  /** Convenience toggle for 3D/EAX mode (`true` -> soundMode `2`, `false` -> soundMode `0`). */
  readonly threeDSound?: (() => boolean) | boolean | undefined
  /** Callback invoked when `0x6fb0cf90` (`ApplySoundEnvironEax`) dispatches a preset to `D2sound.#10058`. */
  readonly onEaxChange?: ((preset: SoundEnvironEaxPreset113c, envIdx: number, row: SoundEnvironRow113c) => void) | undefined
}

/**
 * D2Client.dll 0x6faff700 (`IsNightTime`) & 0x6faff8af-0x6faff8c2:
 * `tod` is the environment cycle index from `D2Common.#10396` (`0` = Sunrise, `1` = Morning,
 * `2` = Noon, `3` = Afternoon, `4` = Sunset, `5` = Night):
 * - `tod in {1, 2, 3}` (Morning, Noon, Afternoon) -> Day (`false`);
 * - `tod < 1 || tod > 3` (`0` = Sunrise, `4` = Sunset, `5` = Night) -> Night (`true`).
 */
export function isNightTimeOfDay113c(tod: number): boolean {
  return tod < 1 || tod > 3
}

/**
 * D2Client.dll 0x6faff700 -> D2Common.#10396: normalizes the environment cycle index (`0..5`:
 * `0` Sunrise, `1` Morning, `2` Noon, `3` Afternoon, `4` Sunset, `5` Night) for `SoundEnviron113c`.
 */
export function periodOfDayToSoundEnvironTod113c(cycleIndex: number): number {
  if (Number.isInteger(cycleIndex) && cycleIndex >= 0 && cycleIndex <= 5) {
    return cycleIndex
  }
  return 2
}

/**
 * D2Client.dll 0x6faffa28 -> 0x6fb30450 -> D2Common.#10215: returns true when `Levels.txt` `Rain`
 * is non-zero for `levelId` (1..136).
 */
export function isLevelRainable113c(levelId: number): boolean {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > 136) return false
  return getLevelLighting(levelId)?.rain === true
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
 * D2Client.dll 0x6faffad3-0x6faffaf5 & 0x6faffb8e-0x6faffbaa:
 * Computes jittered event delay in ticks: `EventDelay - floor(EventDelay/6) + rng.rand(2 * floor(EventDelay/6) + 1)`.
 */
export function rollEventDelayTicks113c(eventDelay: number, rng: D2Rng): number {
  if (eventDelay <= 0) return 0
  const jitter = Math.floor(eventDelay / 6)
  const span = jitter * 2 + 1
  const draw = rng.rand(span)
  return eventDelay - jitter + draw
}

/**
 * D2Client.dll 0x6faffb43-0x6faffb80:
 * Draws spatial offset `(x, y, z)` for a periodic environment event one-shot:
 * `|x| in [450, 750]`, `y in [-100, 100]`, `z = 0` (passed to `SetSoundPos(h, x, y, 0)` -> record `z = 640`).
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
  private readonly soundModeCb: (() => 0 | 1 | 2) | undefined
  private readonly onEaxChangeCb:
    | ((preset: SoundEnvironEaxPreset113c, envIdx: number, row: SoundEnvironRow113c) => void)
    | undefined

  private levelIdValue = 0
  private envIndexValue = 0
  private todValue = 2 // default Noon (Day)
  private lastTickValue: number | null = null
  private lastPreloadedAct = 0

  // BSS [0x6fba16c0]: last applied EAX SoundEnv index (0x6fb0cf90)
  private lastEaxEnvIdx = 0
  private soundModeValue: 0 | 1 | 2 = 0
  private currentEaxPresetValue: SoundEnvironEaxPreset113c = scaleSoundEnvironEaxPreset113c(0)

  // BSS [0x6fbcc314], [0x6fbcc31c]
  private ambienceHandleValue = 0
  private currentAmbienceId = 0
  private fadingAmbienceHandles: number[] = []

  // BSS [0x6fbcc324], [0x6fbcc328], [0x6fbcc32c]
  private eventHandleValue = 0
  private currentEventId = 0
  private eventDelayTicks = 0
  private lastEventTick = 0

  // BSS [0x6fbcc318], [0x6fbcc320]
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
    this.onEaxChangeCb = options.onEaxChange

    if (typeof options.soundMode === 'function') {
      this.soundModeCb = options.soundMode
    } else if (options.soundMode === 1 || options.soundMode === 2) {
      this.soundModeValue = options.soundMode
    } else if (typeof options.threeDSound === 'function') {
      const fn = options.threeDSound
      this.soundModeCb = () => (fn() ? 2 : 0)
    } else if (options.threeDSound === true) {
      this.soundModeValue = 2
    }
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

  /** D2sound.#10059 sound mode (`0` = 2D, `1` = 3D DirectSound3D, `2` = 3D EAX). */
  get soundMode(): 0 | 1 | 2 {
    if (this.soundModeCb !== undefined) {
      return this.soundModeCb()
    }
    if (typeof this.records.getSoundMode === 'function') {
      const m = this.records.getSoundMode()
      if (m === 1 || m === 2) return m
    }
    return this.soundModeValue
  }

  /** Sets `D2sound.#10059` sound mode (`0` = 2D, `1` = 3D DirectSound3D, `2` = 3D EAX). */
  setSoundMode(mode: 0 | 1 | 2): void {
    const normalized: 0 | 1 | 2 = mode === 2 ? 2 : mode === 1 ? 1 : 0
    this.soundModeValue = normalized
    this.records.setSoundMode?.(normalized)
    if (normalized === 2 && this.envIndexValue > 0) {
      this.lastEaxEnvIdx = 0
      this.applySoundEnvironEax113c(this.envIndexValue)
    } else if (normalized !== 2) {
      this.currentEaxPresetValue = scaleSoundEnvironEaxPreset113c(0)
      this.records.setEaxPreset?.(null, 0)
    }
  }

  /** Convenience toggle for 3D/EAX sound mode (`true` -> mode `2`, `false` -> mode `0`). */
  set3DSoundEnabled(enabled: boolean): void {
    this.setSoundMode(enabled ? 2 : 0)
  }

  /** Returns `true` when 3D/EAX sound mode (`D2sound.#10059 == 2`) is active. */
  is3DSoundEnabled(): boolean {
    return this.soundMode === 2
  }

  /** BSS `[0x6fba16c0]`: last `SoundEnv` index checked by `0x6fb0cf90`. */
  get lastAppliedEaxEnvIndex(): number {
    return this.lastEaxEnvIdx
  }

  /** Last EAX preset computed and dispatched by `0x6fb0cf90`. */
  get eaxPreset(): SoundEnvironEaxPreset113c {
    return this.currentEaxPresetValue
  }

  /** Enters or switches to `levelId` (1..136) and optional environment cycle index `tod` (`0..5`). */
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

  /** Updates the current environment cycle index (`0..5`). */
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
      (state.rainIntensity !== undefined ? Math.trunc(state.rainIntensity * 255) : 255)
    this.setRaining(true, vol)
  }

  /** Sets weather rain from normalized intensity (`0..1` or `0..255`). */
  setWeatherIntensity(intensity: number): void {
    if (!Number.isFinite(intensity) || intensity <= 0) {
      this.setRaining(false, 0)
      return
    }
    const vol = intensity <= 1 ? Math.trunc(intensity * 255) : Math.trunc(intensity)
    this.setRaining(true, vol)
  }

  /**
   * D2Client.dll 0x6fb30645-0x6fb306b5: Triggers a one-shot thunder variant in `202..204` (`event_thunder_1..3`)
   * with a `25 + rand(50)` tick delay (`25..74` ticks) and `SetSoundPos(h, x, y, 0)` where `y = -200 + rand(400)`
   * (drawn first at 0x6fb3067a) and `x = -200 + rand(400)` (drawn second at 0x6fb30690).
   */
  triggerThunder(rngOverride?: D2Rng): number {
    if (this.levelIdValue !== 0 && !isLevelRainable113c(this.levelIdValue)) {
      return 0
    }
    const rng = rngOverride ?? this.rng
    const delayTicks = THUNDER_DELAY_MIN_TICKS_113C + rng.rand(THUNDER_DELAY_SPAN_TICKS_113C)
    const h = this.records.play(WEATHER_THUNDER_SOUND_ID_113C, { delayTicks })
    if (h !== 0) {
      const y = THUNDER_OFFSET_MIN_113C + rng.rand(THUNDER_OFFSET_SPAN_113C)
      const x = THUNDER_OFFSET_MIN_113C + rng.rand(THUNDER_OFFSET_SPAN_113C)
      this.records.setSoundPos(h, x, y, THUNDER_OFFSET_Z_113C)
    }
    return h
  }

  /** Alias of {@link triggerThunder}. */
  playThunder(rngOverride?: D2Rng): number {
    return this.triggerThunder(rngOverride)
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
    this.envIndexValue = envRow.index

    // 1. Invalid level or SoundEnv = 0 (`none`): stop active ambience, events, and rain.
    if (envRow.index === 0) {
      this.stopAmbienceAndEventsImmediate()
      this.stopRainImmediate()
      this.applySoundEnvironEax113c(0)
      return
    }

    // 2. Resolve Day vs Night targets (0x6faff8af-0x6faff939).
    const night = isNightTimeOfDay113c(this.todValue)
    const wantAmbience = night ? envRow.nightAmbience : envRow.dayAmbience
    const wantEvent = night ? envRow.nightEvent : envRow.dayEvent
    const rainId = isLevelRainable113c(this.levelIdValue) ? WEATHER_RAIN_SOUND_ID_113C : 0

    // Prune any fading ambience handles that have already been freed by SoundRecords113c.
    if (this.fadingAmbienceHandles.length > 0) {
      this.fadingAmbienceHandles = this.fadingAmbienceHandles.filter((h) => this.records.record(h) !== undefined)
    }

    // 3. Ambience transition (0x6faff973-0x6faffa24): only when wantAmbience != [0x6fbcc31c].
    const activeAmbRec = this.ambienceHandleValue !== 0 ? this.records.record(this.ambienceHandleValue) : undefined
    const ambAlive = activeAmbRec !== undefined && !activeAmbRec.stop

    if (wantAmbience !== this.currentAmbienceId || (wantAmbience > 0 && !ambAlive)) {
      const isDayNightSwap =
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
        // 0x6faff9bf-0x6faff9d6: StopWithFade (0x6fb38550) every ambience record (52..71) whose groupBase
        // is neither wantAmbience nor rainId (0x6fb38810), and every event record (72..201) whose groupBase
        // is not wantEvent (0x6fb38770).
        this.stopNonSwapAmbienceAndEvents(wantAmbience, rainId, wantEvent)
        this.ambienceHandleValue = 0
      }

      if (wantAmbience > 0) {
        this.ambienceHandleValue = this.records.play(wantAmbience)
        if (isDayNightSwap && this.ambienceHandleValue !== 0) {
          // 0x6faff9f9-0x6faffa0d: SetVolume(h, 0) + Fade(h, 250, 255) on incoming Day/Night ambience.
          this.records.setVolume(this.ambienceHandleValue, 0)
          this.records.fade(this.ambienceHandleValue, AMBIENCE_DAY_NIGHT_CROSSFADE_TICKS_113C, 255)
        }
        this.currentAmbienceId = wantAmbience
      } else {
        this.ambienceHandleValue = 0
        this.currentAmbienceId = 0
      }
    }

    // 4. Weather rain loop (0x6faffa24-0x6faffab4, id 64 `scene_rain`).
    this.stepWeatherRain(rainId)

    // 4.5. EAX environment preset (0x6faffab4-0x6faffab8 -> 0x6fb0cf90).
    this.applySoundEnvironEax113c(envRow.index)

    // 5. Periodic Day/Night Event timer & spatial offset (0x6faffabd-0x6faffbaa).
    this.stepPeriodicEvent(resolvedTick, envRow, wantEvent)
  }

  /**
   * D2Client.dll 0x6fb0cf90 (`ApplySoundEnvironEax`):
   * When `envIdx != [0x6fba16c0]`:
   * - If `D2sound.#10059 == 2` (3D/EAX mode) or `envIdx == 0`, scales the row's EAX block
   *   (`+0x24..+0x54`, float fields `x 0.001f` via `0x6fb87540`) and passes it to `D2sound.#10058`.
   * - Updates `[0x6fba16c0] = envIdx`.
   */
  applySoundEnvironEax113c(envIdx: number): void {
    if (envIdx === this.lastEaxEnvIdx) {
      return
    }
    const valid =
      Number.isInteger(envIdx) && envIdx >= 0 && envIdx < SOUND_ENVIRON_ROW_COUNT_113C
    const row = valid ? SOUND_ENVIRON_113C[envIdx] : undefined
    const mode = this.soundMode
    if (row !== undefined && (mode === 2 || envIdx === 0)) {
      const preset = scaleSoundEnvironEaxPreset113c(row)
      this.currentEaxPresetValue = preset
      this.records.setEaxPreset?.(preset, envIdx)
      this.onEaxChangeCb?.(preset, envIdx, row)
    }
    this.lastEaxEnvIdx = envIdx
  }

  /**
   * D2Client.dll 0x6faff7c0 (`AmbientReset`): stops active ambience, event, and rain handles
   * and resets controller state.
   */
  stopAll(): void {
    this.stopAmbienceAndEventsImmediate()
    this.stopRainImmediate()
    this.levelIdValue = 0
    this.envIndexValue = 0
    this.lastEaxEnvIdx = 0
    this.currentEaxPresetValue = scaleSoundEnvironEaxPreset113c(0)
    this.records.setEaxPreset?.(null, 0)
    this.lastTickValue = null
    this.lastPreloadedAct = 0
    this.rainingValue = false
    this.targetRainVolume = 0
  }

  /** Alias of {@link stopAll}. */
  reset(): void {
    this.stopAll()
  }

  private stepWeatherRain(rainId: number): void {
    if (this.rainHandleValue !== 0) {
      const rec = this.records.record(this.rainHandleValue)
      if (rec === undefined || rec.stop) {
        this.rainHandleValue = 0
      }
    }

    if (rainId === 0) {
      // 0x6faffaa3-0x6faffab3: StopSound([0x6fbcc318]) -> StopWithFade, clear [0x6fbcc318] and [0x6fbcc320]
      if (this.rainHandleValue !== 0) {
        this.records.stop(this.rainHandleValue)
      }
      this.rainHandleValue = 0
      this.currentRainVolume = 0
      return
    }

    const target = this.rainingValue ? this.targetRainVolume : 0
    if (target !== 0 && this.rainHandleValue === 0) {
      // 0x6faffa3a-0x6faffa56: PlaySound(64, 0, 0, 0, 0) + SetVolume(h, target)
      const h = this.records.play(WEATHER_RAIN_SOUND_ID_113C)
      this.rainHandleValue = h
      if (h === 0) {
        this.currentRainVolume = 0
        return
      }
      this.records.setVolume(h, target)
    }

    if (this.rainHandleValue === 0) {
      this.currentRainVolume = 0
      return
    }

    // 0x6faffa5f-0x6faffa9b: step GetVolume([0x6fbcc318]) toward target by at most +-6 per tick
    let vol =
      typeof this.records.getVolume === 'function'
        ? this.records.getVolume(this.rainHandleValue)
        : this.currentRainVolume
    if (target > vol) {
      vol = Math.min(target, vol + WEATHER_RAIN_VOLUME_STEP_PER_TICK_113C)
    } else if (target < vol) {
      vol = Math.max(target, vol - WEATHER_RAIN_VOLUME_STEP_PER_TICK_113C)
    }

    this.currentRainVolume = vol
    if (vol !== 0) {
      this.records.setVolume(this.rainHandleValue, vol)
    } else {
      // 0x6faffa8c: StopSound([0x6fbcc318]) -> StopWithFade (Fade Out = 12 ticks)
      this.records.stop(this.rainHandleValue)
      this.rainHandleValue = 0
    }
  }

  private stepPeriodicEvent(gameTick: number, envRow: SoundEnvironRow113c, wantEvent: number): void {
    // 0x6faffabd-0x6faffac3: when wantEvent == 0, skip the event block leaving timer state untouched.
    if (wantEvent <= 0) {
      return
    }

    // 0x6faffac9-0x6faffb12: Event ID changed -> arm jittered timer and initial phase.
    if (wantEvent !== this.currentEventId) {
      this.currentEventId = wantEvent
      this.eventDelayTicks = rollEventDelayTicks113c(envRow.eventDelay, this.rng)
      const initialPhase = this.eventDelayTicks > 0 ? this.rng.rand(this.eventDelayTicks) : 0
      this.lastEventTick = (gameTick - initialPhase) >>> 0
    }

    // 0x6faffb20-0x6faffb28: unsigned elapsed tick comparison `(u32)(now - lastEventTick) < eventDelayTicks`.
    const elapsed = (gameTick - this.lastEventTick) >>> 0
    if (elapsed < (this.eventDelayTicks >>> 0)) {
      return
    }

    // 0x6faffb2e-0x6faffb80: Play event variant; only on a non-zero handle draw spatial offset and advance timer.
    const h = this.records.play(wantEvent)
    this.eventHandleValue = h
    if (h === 0) {
      return
    }
    const offset = rollEventSpatialOffset113c(this.rng)
    this.records.setSoundPos(h, offset.x, offset.y, offset.z)

    // 0x6faffb85-0x6faffbaa: Reset timer reference and roll next jittered delay.
    this.lastEventTick = gameTick >>> 0
    this.eventDelayTicks = rollEventDelayTicks113c(envRow.eventDelay, this.rng)
  }

  private stopNonSwapAmbienceAndEvents(wantAmbience: number, rainId: number, wantEvent: number): void {
    if (typeof this.records.stopAmbienceExcept113c === 'function') {
      this.records.stopAmbienceExcept113c(wantAmbience, rainId)
    } else if (this.ambienceHandleValue !== 0) {
      this.records.stop(this.ambienceHandleValue)
    }
    if (typeof this.records.stopEventsExcept113c === 'function') {
      this.records.stopEventsExcept113c(wantEvent)
    } else if (this.eventHandleValue !== 0) {
      this.records.stop(this.eventHandleValue)
    }
    this.fadingAmbienceHandles = []
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
    this.lastEventTick = 0
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
    if (typeof this.records.stopImmediate === 'function') {
      this.records.stopImmediate(handle)
    } else {
      this.records.stop(handle)
    }
  }
}

export { SoundEnviron113c as SoundEnvironController113c }
