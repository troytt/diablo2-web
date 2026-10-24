/**
 * The 1.13c D2Client sound-record layer and the D2sound output math it drives.
 *
 * D2Client keeps a pool of 200 sound records (0x59 bytes each at 0x6fbbf2f8). PlaySound 0x6fb38a70
 * fills one and returns a handle; SoundUpdate 0x6fb38dd0 (once per SoundTick 0x6fb0f020, after the
 * ambient manager) starts, fades, stops and frees records and pushes each playing one to its
 * channel through UpdateChannel 0x6fb0d1d0; Fn_6fb0d080 (right after SoundUpdate) retires the
 * one-shots whose buffer has ended; then the clock `[0x6fbcc268]` advances.
 *
 * Decision for the port: the logic never looks at WebAudio. Handles, timers, fades and RNG draws
 * are identical whether the AudioContext exists, is suspended or muted; only the audible output
 * goes through {@link SoundVoiceBackend}.
 *
 * Implemented 1.13c binary mechanics (`D2Client.dll`, `D2sound.dll`, `D2Common.dll` 1.13c; the
 * reverse-engineering notes are in `kb/audio/sound-records-113c.md`):
 * - 200-record pool (AllocRec 0x6fb37d80 scans `0x6fbbf2f8..0x6fbc3880` step `0x59`; new records are
 *   prepended to the active list `[0x6fbcbf30]`, D2sound #10034) and the 25 Hz `SoundTick` clock.
 * - Active-list bubble sort 0x6fb38e00..0x6fb38e6c: priority desc, dist² asc, start desc, address desc.
 * - `pickVariant` 0x6fb0ee70 with the 2-slot `recent` anti-repeat history of the requested row.
 * - StartSound 0x6fb0d7a0: the variant pick is stored in the record at once (0x6fb0d7dd); the same-id
 *   `< 2`-tick debounce compares the SCHEDULED start ticks unsigned, `(u32)(rec.start − other.start) < 2`,
 *   against the earliest-start playing channel of that id (FindChannel 0x6fb0cc10), skipped when that
 *   record is flagged stop, and blocks iff `other.priority ≥ rec.priority` (0x6fb0d7e4–0x6fb0d808);
 *   `recent` is updated right after it (0x6fb0d82e–0x6fb0d837), before the sample check.
 * - 16 channels = 4 stereo (flags 1) + 12 mono 2D (flags 0) (init 0x6fb0d577); a record uses the
 *   partition of its row's `Stereo` (0x6fb0d87c–0x6fb0d8a7) and AllocChannel 0x6fb0ce70 only looks at
 *   that partition: a free channel first, else the victim min priority → max dist² → min start → min
 *   address, stolen iff `request.priority > victim.priority`, or equal and `victim.address < request.address`
 *   (0x6fb0cf14–0x6fb0cf33).
 * - Defer Inst / Stop Inst 0x6fb39214..0x6fb392ac: FindGroupConflict 0x6fb37c30 (same groupBase, playing,
 *   earliest start, unit-filtered) when either flag is set; FindSpeechConflict 0x6fb37bd0 (ids
 *   2934..4656) whenever the record has exactly one unit, regardless of the flags; a Defer row without
 *   units at a non-zero position skips the check; on a conflict Stop Inst flags ONE conflicting record
 *   stop and frees it, otherwise the NEW record is flagged stop and freed (0x6fb3929e–0x6fb392ac).
 * - Compound 0x6fb38ac8 → 0x6fb37fe0: the first active record of the same groupBase with stop == 0 and
 *   `Compound < 0` or `(u32)(now − start) ≤ Compound` is reused.
 * - `+80` local-player boost 0x6fb38b72 `add byte ptr [esi+0x3c],0x50`: a byte add (wraps), applied to
 *   new and Compound-reused records.
 * - SetSoundPos 0x6fb38ba0: `pos = (x, y, z + 640)` on any record (no unit check, no channel update).
 * - Unit positions 0x6fb37f30 in screen coordinates `(Δcx, 2·Δcy, 640)` from D2Common #10628 client
 *   coordinates (`cx = (X32 − Y32) >> 1`, `cy = (X32 + Y32) >> 2`, `X32 = ⌊subtile·32⌋`), with the
 *   sound-2599 (`object_river`) projection; Tracking 0x6fb38f6f re-syncs to the closest unit.
 * - Sample starts: a non-streamed buffer always starts at position 0 (D2sound #10005 / #10069) and its
 *   saved position is 0 (#10032 returns 0 without a stream), so only streamed rows resume; `nBlocks == 1`
 *   rows loop from `Block 1` (StartSound 0x6fb0d8d4–0x6fb0d8e4, #10050).
 * - Fade 0x6fb38230 is ignored for records with two or more units (0x6fb38266 → 0x6fb37e90).
 * - soloDuck (70 % floor) and pauseDuck 0x6fb39449..0x6fb3957e; UpdateChannel 0x6fb0d1d0 output.
 *
 * Sample facts (PROJECT.md override iv): the record layer never synthesizes a duration. The facts of the
 * ORIGINAL 1.13c WAV (frames / sample rate / channels) are injected through `sampleFacts`; a missing source
 * or a missing entry for a played sound throws; `none.wav` rows (1.13c: LoadSound 0x6fb0ebc0 fails, row
 * +0x81 = 1, StartSound returns 0 at 0x6fb0d867) and source-declared unavailable samples fail the start
 * explicitly and are counted (`unavailableCounts()`).
 */

import { SFX_PACK_INDEX_113C } from '../../common/audio/sfx-pack-index-113c.ts'
import { SOUNDS_113C, SOUNDS_ROW_COUNT_113C, type SoundsRow113c } from '../../common/audio/sounds-113c.ts'
import {
  D9_UNSHIPPED_MONSTER_SOUND_IDS_113C,
  D9_UNSHIPPED_SOUND_IDS_113C,
  D9_UNSHIPPED_SOUND_IDS_SET_113C,
  D9_UNSHIPPED_SPEECH_IDS_113C,
  D9_UNSHIPPED_SPEECH_SOUND_IDS_113C,
  isUnshippedSoundId113c,
} from '../../common/audio/speech-index-113c.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'

export {
  D9_UNSHIPPED_MONSTER_SOUND_IDS_113C,
  D9_UNSHIPPED_SOUND_IDS_113C,
  D9_UNSHIPPED_SOUND_IDS_SET_113C,
  D9_UNSHIPPED_SPEECH_IDS_113C,
  D9_UNSHIPPED_SPEECH_SOUND_IDS_113C,
  isUnshippedSoundId113c,
}
export const UNSHIPPED_SOUND_IDS_113C = D9_UNSHIPPED_SOUND_IDS_113C
export const MISSING_WAV_SOUND_IDS_113C = D9_UNSHIPPED_SOUND_IDS_113C
export const D9_EXCEPTION_SOUND_IDS_113C = D9_UNSHIPPED_SOUND_IDS_113C

/** Records in the pool (0x6fbbf2f8–0x6fbc3880, stride 0x59). */
export const SOUND_RECORD_POOL_SIZE = 200
/** Physical channels in D2Client (0x6fbc75c0..0x6fbc77c0, stride 0x20). */
export const SOUND_MAX_CHANNELS = 16
/** Channels 0..3 are stereo channels (flags 1); channels 4..15 are 2D mono channels (flags 0) (0x6fb0d577). */
export const SOUND_STEREO_CHANNELS_113C = 4
/** Ticks per second of the sound clock (one SoundTick per 40 ms game frame). */
export const SOUND_TICKS_PER_SECOND = 25
/** Local speech sound id range checked by FindSpeechConflict 0x6fb37bd0 / SoundUpdate 0x6fb39236 (`0x0B76..0x1230`). */
export const LOCAL_SPEECH_SOUND_RANGE_113C: readonly [number, number] = [2934, 4656] as const
/** Local player priority boost in PlaySound (`add byte ptr [esi+0x3c], 0x50` at 0x6fb38b72; a byte add). */
export const LOCAL_PLAYER_PRIORITY_BOOST_113C = 80

/** SoundUpdate / UpdateChannel maxDist per Falloff (jump tables 0x6fb39590 / 0x6fb0dcc4; Falloff > 4 → 700). */
const FALLOFF_MAX_DIST = [400, 700, 1000, 1500, 2000] as const
const FALLOFF_MAX_DIST_DEFAULT = 700
/** UpdateChannel minDist per Falloff (0x6fb0dce0, jump table 0x6fb0dd30; Falloff > 4 → 60). */
const FALLOFF_MIN_DIST = [60, 60, 200, 400, 2000] as const
const FALLOFF_MIN_DIST_DEFAULT = 60
/** SetPos 0x6fb38350 clamps x / y to ±2000 (0x6fb87574 / 0x6fb87548) for dist². */
const DIST_CLAMP = 2000
/** SetSoundPos 0x6fb38ba0 adds 640.0f (0x6fb87584) to z; 0x6fb37f30 stores z = 640.0f (0x44200000). */
const SOUND_POS_Z = 640
/** PlaySound without a unit: SetPos(0, 0, 320.0f) (0x6fb38b4d–0x6fb38b65). */
const NO_UNIT_Z = 320
/** SoundUpdate 0x6fb39297: a record restarted from a saved position fades in over 3 ticks. */
const RESUME_FADE_TICKS = 3
/** Sound 0xa27 (`object_river`) gets the river projection in 0x6fb37f54–0x6fb37fa2. */
const OBJECT_RIVER_SOUND_ID = 0xa27
/** Unit type numbers of the 1.13c unit structs (player, monster, object, missile, item, tile). */
const UNIT_TYPE_NAMES = ['player', 'monster', 'object', 'missile', 'item', 'tile'] as const

const F32_0P003125 = Math.fround(0.003125) // 0x6fb87580
const F32_0P8 = Math.fround(0.8) // D2sound 0x6f9c09a0
const F32_0P05 = Math.fround(0.05)
const F32_1EM4 = Math.fround(1e-4)
const F32_MINUS_0P4 = Math.fround(-0.4) // 0x6fb87564
const F32_0P5 = Math.fround(0.5) // 0x6fb87568
const F32_MINUS_2 = Math.fround(-2) // 0x6fb8756c

/** A channel as the WebAudio side plays it (one `voice` id per started playback). */
export interface SoundVoiceBackend {
  /**
   * A channel starts `soundId`'s sample at `offsetFrames` (looped for Loop rows; a looped buffer restarts at
   * `loopStartFrames`), silent until `setGains`.
   */
  start(voice: number, soundId: number, loop: boolean, offsetFrames: number, loopStartFrames: number): void
  /** The DirectSound volume / pan of the channel as linear left / right amplitudes. */
  setGains(voice: number, left: number, right: number): void
  /** The channel stops (StopChannel, end of buffer, StopAll). */
  stop(voice: number): void
}

/** No output (tests, or before a backend exists). */
export const SILENT_SOUND_VOICES: SoundVoiceBackend = {
  start() {},
  setGains() {},
  stop() {},
}

/** Attached unit reference for unit-bound sounds (PlaySound `unit` argument, 0x6fb38b26). */
export interface SoundUnitRef113c {
  readonly unitType?: 'player' | 'monster' | 'object' | 'missile' | string | number | undefined
  readonly id: number
  /** The unit is the local player (`unit == [0x6fbcbbfc]`, PlaySound 0x6fb38b6a): +80 priority. */
  readonly isLocalPlayer?: boolean | undefined
  /** Sub-tile position (D2Common #10628 derives the client coordinates from it). */
  x?: number | undefined
  y?: number | undefined
  /** `false` once the client removed the unit (port detection of the unit-free path, see `update()`). */
  alive?: boolean | undefined
  /** Live sub-tile position; `null` once the unit is gone. */
  readonly getPos?: (() => { x: number; y: number } | null) | undefined
}

export interface PlaySoundOptions {
  /** Attached unit (or `null` / `undefined` for non-unit sounds). */
  readonly unit?: SoundUnitRef113c | null | undefined
  /** PlaySound `delay` (arg 2): `start = now + delay`. */
  readonly delayTicks?: number | undefined
  /** PlaySound `a2` (rec+0x38): bit 0 skips the variant pick (0x6fb0d7d1), bit 1 the fade-in (0x6fb392bd). */
  readonly a2?: number | undefined
  /** PlaySound `a3` (rec+0x24): start position of a streamed row (D2sound #10039). */
  readonly a3?: number | undefined
  /**
   * Port hold: keeps the record pending in state 0 until `setAsyncReady(handle)`. The faithful Async Only
   * mechanism is the `sampleState` option (row +0x86 load state, 0x6fb3932a–0x6fb3934e).
   */
  readonly asyncPending?: boolean | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly local?: boolean | undefined
  readonly volume?: number | undefined
  readonly overrideVol?: number | undefined
}

/** Row input accepted by `SoundRecords113c` (the generated `SoundsRow113c`, or test rows). */
export interface SoundRecordRowInput113c {
  readonly id: number
  readonly sound: string
  readonly fileName: string
  readonly volume: number
  readonly groupSize: number
  readonly groupBase: number
  readonly loop: boolean | number
  readonly fadeIn: number
  readonly fadeOut: number
  readonly deferInst?: boolean | number | undefined
  readonly stopInst?: boolean | number | undefined
  readonly duration: number
  readonly compound?: number | undefined
  readonly reverb: boolean | number
  readonly falloff: number
  readonly cache: boolean | number
  readonly asyncOnly: boolean | number
  readonly priority: number
  readonly stream?: boolean | number | undefined
  readonly stereo?: boolean | number | undefined
  readonly tracking?: boolean | number | undefined
  readonly solo: boolean | number
  readonly musicVol?: boolean | number | undefined
  readonly block1?: number | undefined
  readonly block2?: number | undefined
  readonly block3?: number | undefined
  readonly nBlocks: number
}

/** Normalized internal row representation. */
interface NormalizedSoundRow113c {
  readonly id: number
  readonly sound: string
  readonly fileName: string
  readonly isNoneWav: boolean
  readonly volume: number
  readonly groupSize: number
  readonly groupBase: number
  readonly loop: boolean
  readonly fadeIn: number
  readonly fadeOut: number
  readonly deferInst: boolean
  readonly stopInst: boolean
  readonly duration: number
  readonly compound: number
  readonly falloff: number
  readonly asyncOnly: boolean
  readonly priority: number
  readonly stream: boolean
  readonly stereo: number
  readonly tracking: boolean
  readonly solo: boolean
  readonly block1: number
  readonly nBlocks: number
}

function normalizeRow(row: SoundRecordRowInput113c): NormalizedSoundRow113c {
  return {
    id: row.id,
    sound: row.sound,
    fileName: row.fileName,
    isNoneWav: row.fileName.trim().toLowerCase() === 'none.wav',
    volume: row.volume,
    groupSize: row.groupSize,
    groupBase: row.groupBase,
    loop: Boolean(row.loop),
    fadeIn: row.fadeIn,
    fadeOut: row.fadeOut,
    deferInst: Boolean(row.deferInst),
    stopInst: Boolean(row.stopInst),
    duration: row.duration,
    compound: row.compound ?? 0,
    falloff: row.falloff,
    asyncOnly: Boolean(row.asyncOnly),
    priority: row.priority,
    stream: Boolean(row.stream),
    stereo: typeof row.stereo === 'boolean' ? (row.stereo ? 1 : 0) : (row.stereo ?? 0),
    tracking: Boolean(row.tracking),
    solo: Boolean(row.solo),
    block1: row.block1 ?? -1,
    nBlocks: row.nBlocks,
  }
}

/** Why a Sounds.txt row has no PCM to start (all explicit, counted, never synthesized). */
export type SoundSampleUnavailable113c =
  /** FileName `none.wav`: LoadSound 0x6fb0ebc0 fails to open it → row +0x81 = 1 → StartSound returns 0 (0x6fb0d867). */
  | 'none.wav'
  /** The WAV is absent from every 1.13c MPQ (D9; the list is baker-generated). */
  | 'unshipped'
  /** Stream = 1 row owned by the streaming path (music / speech), not by an SFX pack. */
  | 'streamed'

/** Facts of the ORIGINAL 1.13c WAV of a Sounds.txt row (frames / sample rate of the source PCM). */
export type SoundSampleFacts113c =
  | { readonly kind: 'pcm'; readonly sampleRate: number; readonly frames: number; readonly channels: 1 | 2 }
  | { readonly kind: 'unavailable'; readonly reason: SoundSampleUnavailable113c }

/** Sample facts source: `undefined` means "not provided" and fails fast when the sound is started. */
export type SoundSampleFactsSource113c = (soundId: number) => SoundSampleFacts113c | undefined

type PcmFacts113c = Extract<SoundSampleFacts113c, { kind: 'pcm' }>

/** Inputs of UpdateChannel 0x6fb0d1d0 (Music Vol = 0 rows; 2D or stereo channel). */
export interface ChannelInput113c {
  /** Record volume rec+0x1c (0..255). */
  readonly vol: number
  /** Sounds.txt Volume. */
  readonly volume: number
  /** D2sound #10001 master volume (0..100). */
  readonly master: number
  readonly pauseDuck: number
  readonly soloDuck: number
  /** The record's id is in 1–15, 52–71 or 0x1231–0x125a (no pause duck). */
  readonly pauseExempt: boolean
  /** Sounds.txt Solo of the record's row (no solo duck). */
  readonly soloRow: boolean
  /** Record position (rec+0xc / +0x10 / +0x14). */
  readonly x: number
  readonly y: number
  readonly z: number
  readonly minDist: number
  readonly maxDist: number
  /** The record plays on a stereo channel (flags 1): #10047 / #10028 are skipped (0x6fb0d4a5–0x6fb0d4c7). */
  readonly stereoChannel?: boolean | undefined
}

export interface ChannelOutput113c {
  /** Volume after master / ducks / falloff. */
  readonly v: number
  /** D2sound #10047 attenuation (0..255) and pan (0..255, 128 = centre); 255 / 128 on a stereo channel. */
  readonly att: number
  readonly pan: number
  /** Value given to D2sound #10008. */
  readonly v2: number
  /** DirectSound volume and pan in millibels. */
  readonly volMb: number
  readonly panMb: number
  /** Linear amplitudes `10^(mB/2000)` (0 at -10000 mB); the side opposite the pan is attenuated. */
  readonly left: number
  readonly right: number
}

/** C signed integer division (truncates toward zero). */
function tdiv(a: number, b: number): number {
  return Math.trunc(a / b)
}

/** D2sound 0x6f9b8830(0, hi, v): `2000*log10(v/hi)` with the -10000 / 0 clamps, truncated. */
function dsMb(v: number, hi: number): number {
  if (!(v > F32_1EM4)) return -10000
  if (!(hi - F32_1EM4 > v)) return 0
  return Math.trunc(2000 * Math.log10(v / hi))
}

/** DirectSound linear gain of a millibel value; DSBVOLUME_MIN / DSBPAN extremes (-10000) are silence. */
function amp(mb: number): number {
  return mb <= -10000 ? 0 : 10 ** (mb / 2000)
}

/** D2sound #10047 (0x6f9b8b50): distance attenuation and pan from the scaled position. */
export function attenuationPan113c(x: number, y: number, z: number): { att: number; pan: number } {
  const X = Math.fround(x * F32_0P003125)
  const Y = Math.fround(y * F32_0P003125)
  const Z = Math.fround(z * F32_0P003125)
  const d = Math.sqrt(X * X + Y * Y + Z * Z)
  const L = Math.fround(d < 2 ? 0 : (6 * Math.log(Math.min(d, 100) * 0.5)) / Math.log(2))
  const att = Math.max(0, Math.min(255, Math.trunc(255 / 10 ** (L * F32_0P05))))
  const pan = Math.max(0, Math.min(255, Math.trunc(X * 127 * F32_0P8 + 128)))
  return { att, pan }
}

/**
 * UpdateChannel 0x6fb0d1d0 for a Music Vol = 0 row, then D2sound #10008 (volume, scale 255, occlusion 0) and,
 * on a 2D channel (flags 0), #10047 / #10028 (attenuation and pan).
 */
export function channelOutput113c(input: ChannelInput113c): ChannelOutput113c {
  let v = tdiv(input.master * input.vol, 100) // 0x6fb0d269..0x6fb0d288
  if (input.pauseDuck !== 100 && !input.pauseExempt) v = tdiv(input.pauseDuck * v, 100) // 0x6fb0d2ba
  if (input.soloDuck !== 100 && !input.soloRow) v = tdiv(input.soloDuck * v, 100) // 0x6fb0d2eb
  const fx = Math.fround(input.x)
  const fy = Math.fround(input.y)
  const d = Math.sqrt(fx * fx + fy * fy)
  if (d > input.minDist) v = Math.trunc(((input.maxDist - d) * v) / (input.maxDist - input.minDist)) // 0x6fb0d428..0x6fb0d450
  let v2 = tdiv(input.volume * v, 255) // 0x6fb0d45d..0x6fb0d4a3
  if (input.stereoChannel === true) {
    // 0x6fb0d4a5: a stereo channel skips #10047 / #10028 (no attenuation, pan left at the buffer's centre).
    const volMb = dsMb(v2, 255)
    const both = amp(volMb)
    return { v, att: 255, pan: 128, v2, volMb, panMb: 0, left: both, right: both }
  }
  const { att, pan } = attenuationPan113c(input.x, input.y, input.z)
  v2 = tdiv(att * v2, 255) // 0x6fb0d4cc..0x6fb0d4e6
  const volMb = dsMb(v2, 255) // #10008 0x6f9b6e20: v' = v2 * 255 / 255
  let panMb = 0
  let left = amp(volMb)
  let right = left
  if (pan > 128) {
    panMb = -dsMb(255 - pan, 127) // #10028 0x6f9b6d80: positive → left attenuated
    left *= amp(-panMb)
  } else if (pan < 128) {
    panMb = dsMb(pan, 127) // negative → right attenuated
    right *= amp(panMb)
  }
  return { v, att, pan, v2, volMb, panMb, left, right }
}

/** UpdateChannel's pause-duck exemption (0x6fb0d293–0x6fb0d2b8): ids 1–15, 52–71, 0x1231–0x125a. */
export function isPauseDuckExempt113c(id: number): boolean {
  return (id >= 1 && id <= 15) || (id >= 52 && id <= 71) || (id >= 0x1231 && id <= 0x125a)
}

/**
 * D2Common #10628 (0x6fd7ffe0) client coordinates of a unit at sub-tile `(x, y)`.
 * Dynamic paths (players, monsters, missiles): `X32 = precise >> 11 = ⌊x·32⌋`, `cx = (X32 − Y32) >> 1`,
 * `cy = (X32 + Y32) >> 2` (D2Common 0x6fd5da71–0x6fd5da93). Static paths (objects, items, tiles) store
 * `16·(x − y)` / `8·(x + y)` (0x6fd7ff0e–0x6fd7ff22), the same values for integer sub-tiles.
 */
export function unitClientCoords113c(x: number, y: number): { cx: number; cy: number } {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`unitClientCoords113c: position (${String(x)}, ${String(y)})`)
  const x32 = Math.floor(x * 32)
  const y32 = Math.floor(y * 32)
  return { cx: (x32 - y32) >> 1, cy: (x32 + y32) >> 2 }
}

/**
 * 0x6fb37f30: the record position of a unit-attached sound relative to the local player, in screen
 * coordinates `(Δcx, 2·Δcy, 640)` (both through D2Common #10628). Sound 0xa27 (`object_river`) replaces the
 * unit's client coordinates by a projection of the listener (0x6fb37f54–0x6fb37fa2, x87 with the f32
 * constants −2.0 / 0.5 / −0.4 and `_ftol` truncation; exact in doubles for in-game coordinates).
 */
export function unitSoundPosition113c(
  unit: { readonly x: number; readonly y: number },
  listener: { readonly x: number; readonly y: number },
  soundId: number,
): { x: number; y: number; z: number } {
  const p = unitClientCoords113c(listener.x, listener.y)
  const u = unitClientCoords113c(unit.x, unit.y)
  let ucx = u.cx
  let ucy = u.cy
  if (soundId === OBJECT_RIVER_SOUND_ID) {
    const t = (p.cx * F32_MINUS_2 - u.cx * F32_0P5 + p.cy - u.cy) * F32_MINUS_0P4
    ucx = Math.trunc(t)
    ucy = Math.trunc(p.cx * F32_MINUS_2 - t * F32_MINUS_2 + p.cy)
  }
  return { x: ucx - p.cx, y: 2 * (ucy - p.cy), z: SOUND_POS_Z }
}

/** One pool record (field offsets of the 0x59-byte 1.13c record). */
interface SoundRecord {
  /** Pool index; records lie at `0x6fbbf2f8 + slot·0x59`, so slot order is address order. */
  readonly slot: number
  /** Initial requested sound id before variant pick. */
  readonly rootId: number
  /** +4: Sounds id; StartSound replaces it with the variant pick. */
  id: number
  /** +8 */
  readonly handle: number
  /** +0xc / +0x10 / +0x14 (f32) and +0x18 dist² (f32, x / y clamped). */
  x: number
  y: number
  z: number
  dist2: number
  /** World coordinates (when played with `{ x, y }` or updated via `setSoundPos`). */
  worldX: number
  worldY: number
  local: boolean
  /** +0x1c, 0..255 */
  vol: number
  /** +0x24 */
  a3: number
  /** +0x28: attached units (D2sound list; #10034 prepends, no de-duplication). */
  units: SoundUnitRef113c[]
  /** +0x2c: the channel index (0..15), −1 = none. */
  channel: number
  /** Backend voice id of the channel's current playback, 0 = none. */
  voice: number
  /** +0x30: 0 pending, 1 playing, 2 stopped. */
  state: 0 | 1 | 2
  /** +0x34 (u32) */
  readonly start: number
  /** +0x38 */
  readonly a2: number
  /** +0x3c (byte) */
  priority: number
  /** +0x3d */
  stop: boolean
  /** +0x41: position saved by StopChannel (#10032: stream position, 0 for non-streamed buffers). */
  savedPos: number
  /** +0x45 / +0x49 / +0x4d / +0x51 / +0x55 */
  fading: boolean
  fsv: number
  ft: number
  fs: number
  fe: number
  /** Port: tick and frame offset the voice started at, and the facts of the playing sample. */
  playTick: number
  playOffset: number
  facts: PcmFacts113c | null
  /** Port hold (`PlaySoundOptions.asyncPending`). */
  asyncPending: boolean
}

/** A D2Client channel (`0x6fbc75c0 + 0x20·index`: handle, flags, record). */
interface SoundChannel113c {
  readonly index: number
  /** +4: 1 = stereo channel, 0 = 2D mono channel (2D sound mode). */
  readonly flags: 0 | 1
  /** +8 */
  record: SoundRecord | null
}

export interface SoundRecordsOptions {
  /** The local player's seed stream (unit +0x20 / +0x24, used by 0x6fb39640 and 0x6fb0ee70). Required for variant groups. */
  readonly rng?: D2Rng | undefined
  /** D2sound #10001 master volume, 0..100 (default 100). */
  readonly master?: (() => number) | undefined
  /** The pause test of 0x6fb39449 (local game with a menu open); always false online (default). */
  readonly paused?: (() => boolean) | undefined
  /** The local player's sub-tile position (D2Common #10628 of `[0x6fbcbbfc]`). Required for unit-attached sounds. */
  readonly listenerPos?: (() => { x: number; y: number }) | undefined
  readonly voices?: SoundVoiceBackend | undefined
  readonly rows?: readonly SoundRecordRowInput113c[] | undefined
  readonly rowCount?: number | undefined
  /** Facts of the original WAV per Sounds.txt id. REQUIRED before any record reaches StartSound. */
  readonly sampleFacts?: SoundSampleFactsSource113c | undefined
  /** Load state of a sample (row +0x86): `'loading'` fails StartSound and keeps an Async Only record pending. Default: all resident. */
  readonly sampleState?: ((soundId: number) => 'ready' | 'loading') | undefined
  /** Called for every start that fails because the sample is unavailable (counts are always kept). */
  readonly onUnavailable?: ((soundId: number, reason: SoundSampleUnavailable113c) => void) | undefined
}

/** Read-only view of a record, for tests and tools. */
export interface SoundRecordView {
  readonly handle: number
  readonly id: number
  readonly rootId: number
  readonly state: 0 | 1 | 2
  readonly vol: number
  readonly fading: boolean
  readonly stop: boolean
  readonly voice: number
  /** Channel index 0..15 (0..3 stereo partition), −1 = none. */
  readonly channel: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly worldX: number
  readonly worldY: number
  readonly pan: number
  readonly attenuationDb: number
  readonly delayRemainingTicks: number
  readonly dist2: number
  readonly priority: number
  readonly start: number
  readonly savedPos: number
  readonly units: readonly SoundUnitRef113c[]
  readonly asyncPending: boolean
}

export type { SoundsRow113c, SoundsRow113c as FullSoundsRow113c }

function defaultBakedSampleFacts113c(soundId: number): SoundSampleFacts113c | undefined {
  const tuple = SFX_PACK_INDEX_113C[soundId]
  if (tuple !== undefined) {
    return {
      kind: 'pcm',
      sampleRate: tuple[3],
      frames: tuple[4],
      channels: tuple[5] === 2 ? 2 : 1,
    }
  }
  const sRow = SOUNDS_113C[soundId]
  if (sRow === undefined) {
    return undefined
  }
  if (sRow.stream) {
    return { kind: 'unavailable', reason: 'streamed' }
  }
  return { kind: 'unavailable', reason: 'unshipped' }
}

function normalizeUnitType(t: SoundUnitRef113c['unitType']): string {
  if (typeof t === 'number') return UNIT_TYPE_NAMES[t] ?? `type${String(t)}`
  return t ?? ''
}

/** D2sound #10053 compares unit pointers; a port unit is identified by its type and id. */
function sameUnit(a: SoundUnitRef113c, b: SoundUnitRef113c): boolean {
  return a === b || (a.id === b.id && normalizeUnitType(a.unitType) === normalizeUnitType(b.unitType))
}

function unitPresent(u: SoundUnitRef113c): boolean {
  return u.alive !== false && (u.getPos === undefined || u.getPos() !== null)
}

/** SoundUpdate bubble sort 0x6fb38e00..0x6fb38e6c: priority desc, dist² asc, start desc (u32), record address desc. */
function compareActive113c(a: SoundRecord, b: SoundRecord): number {
  return b.priority - a.priority || a.dist2 - b.dist2 || (b.start >>> 0) - (a.start >>> 0) || b.slot - a.slot
}

export class SoundRecords113c {
  private readonly rng: D2Rng | undefined
  private readonly masterOf: () => number
  private readonly pausedOf: () => boolean
  private readonly listenerPosOf: (() => { x: number; y: number }) | undefined
  private explicitListener: { x: number; y: number } | null = null
  private voicesValue: SoundVoiceBackend
  private readonly rows = new Map<number, NormalizedSoundRow113c>()
  private readonly rowCount: number
  private readonly sampleFactsOf: SoundSampleFactsSource113c | undefined
  private readonly sampleStateOf: ((soundId: number) => 'ready' | 'loading') | undefined
  private readonly onUnavailable: ((soundId: number, reason: SoundSampleUnavailable113c) => void) | undefined
  private readonly unavailable: Record<SoundSampleUnavailable113c, number> = { 'none.wav': 0, unshipped: 0, streamed: 0 }
  private readonly pool: (SoundRecord | null)[] = new Array<SoundRecord | null>(SOUND_RECORD_POOL_SIZE).fill(null)
  private readonly channels: readonly SoundChannel113c[] = Array.from({ length: SOUND_MAX_CHANNELS }, (_, index) => ({
    index,
    flags: index < SOUND_STEREO_CHANNELS_113C ? 1 : 0,
    record: null,
  }))
  /** Active list `[0x6fbcbf30]`. */
  private active: SoundRecord[] = []
  /** Row +0x64 / +0x68 recent picks, by requested id; zeroed by the per-game table reload. */
  private readonly recent = new Map<number, [number, number]>()
  /** `[0x6fbcc268]` (u32) */
  private clock = 0
  /** `[0x6fbcbf38]` */
  private handleCounter = 0
  /** `[0x6fb91374]` / `[0x6fb91378]` (.data 100, never reset) and `[0x6fbcbf3c]` (bss). */
  private pauseDuckValue = 100
  private soloDuckValue = 100
  private lastDuckNow = 0
  private nextVoice = 1
  private readonly eagerStartOnPlay: boolean
  private externalSoloActive = false

  constructor(options?: SoundRecordsOptions) {
    this.rng = options?.rng
    this.masterOf = options?.master ?? (() => 100)
    this.pausedOf = options?.paused ?? (() => false)
    this.listenerPosOf = options?.listenerPos
    this.voicesValue = options?.voices ?? SILENT_SOUND_VOICES
    for (const row of options?.rows ?? SOUNDS_113C) this.rows.set(row.id, normalizeRow(row))
    this.rowCount = options?.rowCount ?? SOUNDS_ROW_COUNT_113C
    this.eagerStartOnPlay = options?.rows === undefined
    this.sampleFactsOf =
      options?.sampleFacts ??
      (options?.rows === undefined ? defaultBakedSampleFacts113c : undefined)
    this.sampleStateOf = options?.sampleState
    this.onUnavailable = options?.onUnavailable
  }

  /** Creates a `SoundRecords113c` instance over all 4,699 rows of `SOUNDS_113C`. */
  static fromSounds113c(options: Omit<SoundRecordsOptions, 'rows'> = {}): SoundRecords113c {
    return new SoundRecords113c({ ...options, rows: SOUNDS_113C })
  }

  /** Sets the explicit listener world position `(x, y)` for coordinate-based playback and `setSoundPos`. */
  setListenerPosition(x: number, y: number): void {
    this.explicitListener = { x: Math.trunc(x), y: Math.trunc(y) }
  }

  /** Sound clock (`now` of PlaySound / Fade / SoundUpdate). */
  get now(): number {
    return this.clock
  }

  get pauseDuck(): number {
    return this.pauseDuckValue
  }

  get soloDuck(): number {
    return this.soloDuckValue
  }

  /** Immediately activates or clears external Solo=1 ducking (70% floor) and updates active channels. */
  setSoloActive(active: boolean): void {
    this.externalSoloActive = Boolean(active)
    this.soloDuckValue = this.externalSoloActive ? 70 : 100
    for (const r of this.active) {
      if (r.state === 1) {
        this.updateChannel(r, this.row(r.id))
      }
    }
  }

  /** Sets Solo=1 ducking by boolean or percentage/ratio (`70` or `0.7`). */
  setSoloDuck(active: boolean | number): void {
    if (typeof active === 'number') {
      const pct = active > 1 ? Math.max(0, Math.min(100, Math.round(active))) : Math.max(0, Math.min(100, Math.round(active * 100)))
      this.externalSoloActive = pct < 100
      this.soloDuckValue = pct
      for (const r of this.active) {
        if (r.state === 1) {
          this.updateChannel(r, this.row(r.id))
        }
      }
    } else {
      this.setSoloActive(active)
    }
  }

  /** Returns the resolved sound ID of `handle` (after variant pick), or 0 if not found. */
  getRecordSoundId(handle: number): number {
    return this.find(handle)?.id ?? 0
  }

  /** Channels currently holding a record (`0..SOUND_MAX_CHANNELS`). */
  activeChannelCount(): number {
    let count = 0
    for (const ch of this.channels) if (ch.record !== null) count += 1
    return count
  }

  /** Starts that failed because the sample is unavailable, per reason (explicit, never synthesized). */
  unavailableCounts(): Readonly<Record<SoundSampleUnavailable113c, number>> {
    return { ...this.unavailable }
  }

  /** Replaces the output backend (stops nothing; call between games or before the first). */
  setVoices(voices: SoundVoiceBackend): void {
    this.voicesValue = voices
  }

  /** Records in active-list order (sorted by the last update; records played since are at the front). */
  records(): SoundRecordView[] {
    return this.active.map((r) => {
      const row = this.rows.get(r.id)
      const maxDist = falloffMaxDist(row?.falloff ?? 0)
      const d = Math.hypot(r.x, r.y)
      let pan = 0
      let attenuationDb = 0
      if (!r.local && (r.x !== 0 || r.y !== 0)) {
        pan = r.x === 0 ? 0 : Math.max(-1, Math.min(1, r.x / 400))
        attenuationDb = d >= maxDist ? -100 : -((d / maxDist) * 60)
      }
      const delayRemainingTicks = Math.max(0, (r.start >>> 0) - (this.clock >>> 0))
      return {
        handle: r.handle,
        id: r.id,
        rootId: r.rootId,
        state: r.state,
        vol: r.vol,
        fading: r.fading,
        stop: r.stop,
        voice: r.voice,
        channel: r.channel,
        x: r.x,
        y: r.y,
        z: r.z,
        worldX: r.worldX,
        worldY: r.worldY,
        pan,
        attenuationDb,
        delayRemainingTicks,
        dist2: r.dist2,
        priority: r.priority,
        start: r.start,
        savedPos: r.savedPos,
        units: [...r.units],
        asyncPending: r.asyncPending,
      }
    })
  }

  record(handle: number): SoundRecordView | undefined {
    return this.records().find((r) => r.handle === handle)
  }

  /** Returns the 2-slot recent variant pick history `[mostRecent, secondMostRecent]` for `id`. */
  recentOf(id: number): [number, number] {
    let recent = this.recent.get(id)
    if (recent === undefined) {
      recent = [0, 0]
      this.recent.set(id, recent)
    }
    return recent
  }

  /**
   * Per-game init 0x6fb0ef90 (with the StopAll 0x6fb38d20 of the previous game's exit): every record
   * freed, Sounds.txt reloaded (recent picks zeroed), handle counter and clock reset to 0.
   */
  gameInit(): void {
    this.stopAll()
    this.recent.clear()
    this.handleCounter = 0
    this.clock = 0
  }

  /** StopAll 0x6fb38d20 (game exit): every channel stopped and every record freed. */
  stopAll(): void {
    for (const r of this.active) this.freeRecord(r)
    this.active = []
  }

  /**
   * PlaySound 0x6fb38a70 (`unit`, `delay`, `a2`, `a3`).
   *
   * @returns the handle, or 0 when `id ≤ 0` (0x6fb38a81), the row's Volume is 0 (0x6fb38ab7) or the pool is
   *   full (AllocRec 0x6fb37d80). A `none.wav` row allocates a record like any other; its start fails in the
   *   first SoundUpdate. The return value never depends on master volume, mute or WebAudio.
   */
  play(id: number, options: PlaySoundOptions = {}): number {
    if (!Number.isInteger(id)) throw new Error(`SoundRecords113c.play: id ${String(id)}`)
    if (id <= 0) return 0 // 0x6fb38a81
    if (id >= this.rowCount) {
      throw new Error(`SoundRecords113c.play: id ${String(id)} ≥ ${String(this.rowCount)} (1.13c dereferences a NULL row)`)
    }
    const row = this.row(id)
    if (row.volume === 0) return 0 // 0x6fb38ab7
    const delay = options.delayTicks ?? 0
    if (!Number.isInteger(delay) || delay < 0) throw new Error(`SoundRecords113c.play: delay ${String(delay)}`)
    const a2 = options.a2 ?? (options.volume !== undefined ? 2 : 0)
    const a3 = options.a3 ?? 0
    if (!Number.isInteger(a2) || !Number.isInteger(a3)) throw new Error(`SoundRecords113c.play: a2 ${String(a2)} / a3 ${String(a3)}`)
    const unit = options.unit ?? null
    const now = this.clock

    // D9 unshipped WAV exception check: immediately record unshipped and return 0 without throwing
    if (D9_UNSHIPPED_SOUND_IDS_SET_113C.has(id)) {
      const picked = (a2 & 1) === 0 && row.groupSize > 1 && this.rng !== undefined ? this.pickVariant(id) : id
      if (D9_UNSHIPPED_SOUND_IDS_SET_113C.has(picked)) {
        const recent = this.recentOf(id)
        recent[1] = recent[0]
        recent[0] = picked
        this.unavailable.unshipped += 1
        this.onUnavailable?.(picked, 'unshipped')
        return 0
      }
    }

    // Compound 0x6fb38ac8 → 0x6fb37fe0: reuse the first active record of the group (any state, stop == 0)
    // within `Compound` ticks (unsigned age) or without an age limit for a negative Compound.
    if (row.compound !== 0) {
      const existing = this.active.find((cand) => {
        if (this.row(cand.id).groupBase !== row.groupBase || cand.stop) return false
        return row.compound < 0 || ((now - cand.start) >>> 0) <= row.compound
      })
      if (existing !== undefined) {
        this.attachUnit(existing, unit) // jumps to 0x6fb38b6a
        return existing.handle
      }
    }

    const slot = this.pool.indexOf(null) // AllocRec 0x6fb37d80: first free record
    if (slot < 0) return 0
    this.handleCounter += 1
    const isLocal = Boolean(options.local ?? unit?.isLocalPlayer)
    const explicitVol = options.volume ?? options.overrideVol
    const initialVol =
      explicitVol !== undefined && Number.isFinite(explicitVol) && explicitVol > 0
        ? Math.max(0, Math.min(255, Math.trunc(explicitVol)))
        : 255
    const r: SoundRecord = {
      slot,
      rootId: id,
      id,
      handle: this.handleCounter,
      x: 0,
      y: 0,
      z: 0,
      dist2: 0,
      worldX: 0,
      worldY: 0,
      local: isLocal,
      vol: initialVol, // 0x6fb38b17
      a3, // 0x6fb38b14
      units: [],
      channel: -1,
      voice: 0,
      state: 0,
      start: (now + delay) >>> 0, // 0x6fb38b0a / 0x6fb38b11
      a2, // 0x6fb38b03
      priority: ((row.priority & 0xff) + (options.local === true && unit === null ? LOCAL_PLAYER_PRIORITY_BOOST_113C : 0)) & 0xff, // 0x6fb38b1e
      stop: false,
      savedPos: 0,
      fading: false,
      fsv: 0,
      ft: 0,
      fs: 0,
      fe: 0,
      playTick: 0,
      playOffset: 0,
      facts: null,
      asyncPending: options.asyncPending ?? false,
    }
    if (unit !== null) {
      const p = this.unitPosition(unit, id) // 0x6fb38b26–0x6fb38b35
      r.worldX = unit.x !== undefined ? Math.trunc(unit.x) : p.x
      r.worldY = unit.y !== undefined ? Math.trunc(unit.y) : p.y
      setPos(r, p.x, p.y, p.z)
    } else if (
      options.x !== undefined &&
      options.y !== undefined &&
      Number.isFinite(options.x) &&
      Number.isFinite(options.y)
    ) {
      const wx = Math.trunc(options.x)
      const wy = Math.trunc(options.y)
      r.worldX = wx
      r.worldY = wy
      if (isLocal) {
        setPos(r, 0, 0, NO_UNIT_Z)
      } else if (this.explicitListener !== null) {
        setPos(r, wx - this.explicitListener.x, wy - this.explicitListener.y, SOUND_POS_Z)
      } else {
        setPos(r, wx, wy, SOUND_POS_Z)
      }
    } else {
      setPos(r, 0, 0, NO_UNIT_Z) // 0x6fb38b47–0x6fb38b65
    }
    this.pool[slot] = r
    this.active.unshift(r) // D2sound #10034 prepends to [0x6fbcbf30]
    this.attachUnit(r, unit)

    if (this.eagerStartOnPlay && delay === 0 && !r.asyncPending && this.master() > 0) {
      const maxDist2 = Math.fround(falloffMaxDist(row.falloff) ** 2)
      if (r.dist2 <= maxDist2) {
        const started = this.startSound(r, now)
        if (started) {
          r.state = 1
          this.updateChannel(r, this.row(r.id))
        } else {
          const playRow = this.row(r.id)
          if (!playRow.loop && !(playRow.asyncOnly && this.sampleStateOf?.(r.id) === 'loading')) {
            const idx = this.active.indexOf(r)
            if (idx >= 0) this.active.splice(idx, 1)
            this.freeRecord(r)
            if (D9_UNSHIPPED_SOUND_IDS_SET_113C.has(r.id)) return 0
          }
        }
      }
    }

    return r.handle
  }

  /**
   * SetSoundPos 0x6fb38ba0: finds the handle in the active list and sets `pos = (x, y, z + 640)` from the
   * integer arguments (`fild`). No unit check and no channel update (gains follow in the next update).
   *
   * @returns whether the handle was found (0 / unknown handles are ignored).
   */
  setSoundPos(handle: number, x: number, y: number, z = 0): boolean {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
      throw new Error(`SoundRecords113c.setSoundPos: integer coordinates required (${String(x)}, ${String(y)}, ${String(z)})`)
    }
    if (handle === 0) return false // 0x6fb38ba3
    const r = this.find(handle)
    if (r === undefined) return false
    r.worldX = x
    r.worldY = y
    if (this.explicitListener !== null) {
      setPos(r, x - this.explicitListener.x, y - this.explicitListener.y, z + SOUND_POS_Z)
    } else {
      setPos(r, x, y, z + SOUND_POS_Z)
    }
    return true
  }

  /** Alias of {@link setSoundPos}. */
  setPos(handle: number, x: number, y: number, z = 0): boolean {
    return this.setSoundPos(handle, x, y, z)
  }

  /** Releases a record held by `PlaySoundOptions.asyncPending` (port hold). */
  setAsyncReady(handle: number): void {
    const r = this.find(handle)
    if (r !== undefined) r.asyncPending = false
  }

  /** SetVolume 0x6fb37ed0 (rec+0x1c). */
  setVolume(handle: number, vol: number): void {
    const r = this.find(handle)
    if (r !== undefined) r.vol = vol
  }

  /** GetVolume 0x6fb37f00: rec+0x1c, or 0 for an unknown handle. */
  getVolume(handle: number): number {
    return this.find(handle)?.vol ?? 0
  }

  /** Fade 0x6fb38230 (`a3` = 0 on every path the port uses). */
  fade(handle: number, duration: number, target: number): void {
    const r = this.find(handle)
    if (r === undefined) return
    this.fadeRecord(r, duration, target)
  }

  /** StopSound 0x6fb38bf0 → StopWithFade 0x6fb38550; no-op for h = 0 or an unknown handle. */
  stop(handle: number): void {
    if (handle === 0) return
    const r = this.find(handle)
    if (r === undefined) return
    this.stopWithFade(r)
  }

  /** Immediate stop (bypasses Fade Out so destroyed missile emitters free their record on the next update). */
  stopImmediate(handle: number): void {
    if (handle === 0) return
    const r = this.find(handle)
    if (r === undefined) return
    r.stop = true
    r.fading = false
  }

  /**
   * 0x6fad25d0: returns true when `unit` already has an active, non-stopping record in `soundId`'s
   * variant group (`[groupBase, groupBase + groupSize)`).
   */
  isUnitSoundPlaying(unit: SoundUnitRef113c, soundId: number): boolean {
    const targetRow = this.rows.get(soundId)
    if (targetRow === undefined) return false
    const groupBase = targetRow.groupBase
    const groupEnd = groupBase + Math.max(1, targetRow.groupSize)
    for (const r of this.active) {
      if (r.stop || r.state === 2) continue
      if (r.id >= groupBase && r.id < groupEnd && r.units.some((u) => sameUnit(u, unit))) {
        return true
      }
    }
    return false
  }

  /**
   * 0x6fad3070 → 0x6fb38c20(handle, unit, 0): detaches `unit` from every active looping sound record;
   * each record left with no attached units is stopped via `StopWithFade` (0x6fb38550).
   *
   * @returns number of records from which `unit` was detached.
   */
  stopUnitLoopSounds(unit: SoundUnitRef113c): number {
    let detached = 0
    for (const r of this.active) {
      const row = this.row(r.id)
      if (!row.loop) continue
      if (!r.units.some((u) => sameUnit(u, unit))) continue
      r.units = r.units.filter((u) => !sameUnit(u, unit))
      detached += 1
      if (r.units.length > 0) continue // 0x6fb38cb6: shared Compound loop stays alive for remaining units
      const keepsPlaying = r.fading && r.ft === 0 // 0x6fb38ca4..0x6fb38cb1
      if (!keepsPlaying) this.stopWithFade(r)
    }
    return detached
  }

  /**
   * 0x6fad25d0 + StopSound 0x6fb38bf0 (used by SKILLS_CltDo45_Whirlwind 0x6fb76472 / 0x6fb7655d for
   * barbarian_whirlwind 2531): detaches `unit` from active records in `soundId`'s variant group
   * (`[groupBase, groupBase + groupSize)`) and stops/fades each record left with no attached units.
   */
  stopUnitSound(unit: SoundUnitRef113c, soundId: number): number {
    const targetRow = this.rows.get(soundId)
    if (targetRow === undefined) return 0
    const groupBase = targetRow.groupBase
    const groupEnd = groupBase + Math.max(1, targetRow.groupSize)
    let stopped = 0
    for (const r of this.active) {
      if (r.stop || r.state === 2) continue
      if (r.id < groupBase || r.id >= groupEnd) continue
      if (!r.units.some((u) => sameUnit(u, unit))) continue
      r.units = r.units.filter((u) => !sameUnit(u, unit))
      stopped += 1
      if (r.units.length > 0) continue
      const keepsPlaying = r.fading && r.ft === 0
      if (!keepsPlaying) this.stopWithFade(r)
    }
    return stopped
  }

  /** SoundUpdate 0x6fb38dd0 at the current clock. */
  update(): void {
    const now = this.clock
    this.detachRemovedUnits()
    // 0x6fb38e00..0x6fb38e6c
    this.active.sort(compareActive113c)
    // Stop pass (0x6fb38e6e..0x6fb38ead).
    for (const r of this.active) {
      if (r.stop && (!r.fading || r.ft !== 0)) {
        if (r.state === 0) r.state = 2
        if (r.state === 1) this.stopChannel(r, now)
      }
    }
    const masterOn = this.master() > 0 // 0x6fb38eaf..0x6fb38ebd
    // Local free list [esp+0x14] (D2sound #10034 prepends; processed head first after the pass).
    const free: SoundRecord[] = []
    const addFree = (rec: SoundRecord): void => {
      if (!free.includes(rec)) free.unshift(rec)
    }

    for (const r of this.active) {
      const row = this.row(r.id)
      const canPlay = masterOn
      if (r.state === 2) {
        // 0x6fb38f28..0x6fb38f6a
        if (r.channel !== -1) throw new Error(`SoundRecords113c: stopped record ${String(r.handle)} holds a channel (assert 0x349)`)
        if (row.loop && row.duration === 0 && !r.stop) {
          // A stopped loop goes back to pending.
          if (r.fading) {
            r.vol = r.ft
            r.fading = false
          }
          r.state = 0
        } else {
          addFree(r)
        }
        continue
      }

      // Tracking 0x6fb38f6f..0x6fb39066: the closest attached unit (strict <, first in list order wins).
      if (row.tracking && r.units.length > 0) {
        let best: { x: number; y: number; z: number } | null = null
        let bestD2 = 0
        for (const u of r.units) {
          const p = this.unitPosition(u, r.id)
          const d2 = p.y * p.y + p.x * p.x
          if (best === null || d2 < bestD2) {
            best = p
            bestD2 = Math.fround(d2)
          }
        }
        if (best !== null) setPos(r, best.x, best.y, best.z)
      }

      if (r.fading) {
        // 0x6fb390cb..0x6fb3910e (unsigned tick compares)
        if ((now >>> 0) > (r.fe >>> 0)) {
          r.vol = r.ft
          r.fading = false
        } else if ((now >>> 0) < (r.fs >>> 0)) {
          r.vol = r.fsv
        } else {
          r.vol = r.fsv + tdiv((r.ft - r.fsv) * (now - r.fs), r.fe - r.fs)
        }
      }
      const maxDist2 = Math.fround(falloffMaxDist(row.falloff) ** 2) // 0x6fb39136..0x6fb39174
      let playRow = row
      if (r.state === 0 && (now >>> 0) >= (r.start >>> 0) && r.vol !== 0) {
        if (r.asyncPending) continue
        if (!canPlay || r.dist2 > maxDist2) {
          this.dropOrKeepPending(r, row, addFree) // 0x6fb39326
        } else {
          if (r.channel !== -1) throw new Error(`SoundRecords113c: pending record ${String(r.handle)} holds a channel (assert 0x3a1)`)
          // Defer Inst / Stop Inst (0x6fb391bd..0x6fb392ac).
          const unit = r.units.length === 1 ? r.units[0]! : null
          const positioned = r.x !== 0 || r.y !== 0 || r.z !== 0 // 0x6fb391cf..0x6fb3920b
          let conflict: SoundRecord | null = null
          if (row.deferInst || row.stopInst) conflict = this.findGroupConflict(row.groupBase, unit, r)
          if (unit !== null && r.id >= LOCAL_SPEECH_SOUND_RANGE_113C[0] && r.id <= LOCAL_SPEECH_SOUND_RANGE_113C[1]) {
            conflict = this.findSpeechConflict(unit, r) // 0x6fb3922f..0x6fb3924a
          }
          const unchecked = row.deferInst && r.units.length === 0 && positioned // 0x6fb3924c..0x6fb3925c
          if (!unchecked && conflict !== null) {
            if (row.stopInst) {
              // 0x6fb3926d..0x6fb39274: one conflicting record is flagged stop and freed after the pass.
              conflict.stop = true
              addFree(conflict)
            } else {
              // 0x6fb3929e..0x6fb392ac: the new record is flagged stop and freed.
              r.stop = true
              addFree(r)
              continue
            }
          }
          // 0x6fb39279..0x6fb392c9: a saved position restarts with a 3-tick fade, else the row's Fade In.
          let fadeTicks = 0
          let fadeTarget = 0
          if (r.savedPos !== 0) {
            r.a3 = r.savedPos
            r.savedPos = 0
            fadeTicks = RESUME_FADE_TICKS
          } else if (row.fadeIn !== 0 && !r.fading && (r.a2 & 2) === 0) {
            fadeTicks = row.fadeIn
          }
          if (fadeTicks !== 0) {
            fadeTarget = r.vol
            r.vol = 0
          }
          const started = this.startSound(r, now) // 0x6fb392cd
          if (started) {
            r.state = 1
            if (fadeTicks !== 0) {
              r.fsv = r.vol
              r.ft = fadeTarget
              r.fs = now
              r.fe = (now + fadeTicks) >>> 0
              r.fading = true
            }
          }
          playRow = this.row(r.id) // 0x6fb392fd: the row of the (possibly picked) variant
          if (!started) this.dropOrKeepPending(r, playRow, addFree)
        }
      }
      if (r.state === 1) {
        // 0x6fb39359..0x6fb393f7
        if (r.channel === -1) throw new Error(`SoundRecords113c: playing record ${String(r.handle)} has no channel (assert 0x3f3)`)
        if ((playRow.duration !== 0 && ((now - r.start) >>> 0) > playRow.duration) || !canPlay || r.dist2 > maxDist2) {
          this.stopChannel(r, now) // 0x6fb393f5
        } else {
          this.updateChannel(r, playRow) // 0x6fb3939d
        }
      }
    }
    for (const r of free) {
      // 0x6fb3940f..0x6fb3943e: off the active list, units released (0x6fb38150), StopChannel, record freed.
      const idx = this.active.indexOf(r)
      if (idx >= 0) this.active.splice(idx, 1)
      this.freeRecord(r)
    }
    // Ducks (0x6fb39449..0x6fb3957e), only when the clock moved since the last update.
    let solo = this.externalSoloActive
    for (const r of this.active) {
      if (this.row(r.id).solo && (!r.fading || r.ft !== 0)) {
        solo = true
        break
      }
    }
    if ((now >>> 0) > (this.lastDuckNow >>> 0)) {
      this.pauseDuckValue = this.pausedOf() ? Math.max(this.pauseDuckValue - 5, 0) : Math.min(this.pauseDuckValue + 5, 100)
      this.soloDuckValue = solo ? Math.max(this.soloDuckValue - 2, 70) : Math.min(this.soloDuckValue + 2, 100)
    }
    this.lastDuckNow = now
  }

  /** Fn_6fb0d080 (one-shot channels whose buffer ended → stopped, freed by the next update), then `[0x6fbcc268]++`. */
  endTick(): void {
    const now = this.clock
    for (const ch of this.channels) {
      const r = ch.record
      if (r === null || this.row(r.id).loop || !this.bufferEnded(r, now)) continue
      this.voicesValue.stop(r.voice)
      ch.record = null
      r.channel = -1
      r.voice = 0
      r.state = 2
    }
    this.clock = (this.clock + 1) >>> 0
  }

  private master(): number {
    const m = this.masterOf()
    if (!Number.isInteger(m) || m < 0 || m > 100) throw new Error(`SoundRecords113c: master volume ${String(m)}`)
    return m
  }

  private row(id: number): NormalizedSoundRow113c {
    const row = this.rows.get(id)
    if (row === undefined) throw new Error(`SoundRecords113c: Sounds.txt row ${String(id)} is not baked (npm run bake -- sound-tables)`)
    return row
  }

  private find(handle: number): SoundRecord | undefined {
    return this.active.find((r) => r.handle === handle)
  }

  /** PlaySound 0x6fb38b6a..0x6fb38b8a: +80 for the local player (byte add), then the unit is prepended to the record's list. */
  private attachUnit(r: SoundRecord, unit: SoundUnitRef113c | null): void {
    if (unit?.isLocalPlayer === true) r.priority = (r.priority + LOCAL_PLAYER_PRIORITY_BOOST_113C) & 0xff
    if (unit !== null) r.units.unshift(unit)
  }

  /**
   * Port detection of the 1.13c unit-free path (0x6fb56d61 → 0x6fad3120 → 0x6fb38c20 with flag 0): a removed
   * unit leaves every record; a record left without units keeps playing if it is a one-shot or a fading-out
   * loop, and gets StopWithFade (0x6fb38cc8) otherwise.
   */
  private detachRemovedUnits(): void {
    for (const r of this.active) {
      if (r.units.length === 0) continue
      const kept = r.units.filter(unitPresent)
      if (kept.length === r.units.length) continue
      r.units = kept
      if (kept.length > 0) continue // 0x6fb38cb6
      const row = this.row(r.id)
      const keepsPlaying = !row.loop || (r.fading && r.ft === 0) // 0x6fb38c98..0x6fb38cb1
      if (!keepsPlaying) this.stopWithFade(r)
    }
  }

  /** 0x6fb37f30 for one attached unit, relative to the local player. */
  private unitPosition(unit: SoundUnitRef113c, soundId: number): { x: number; y: number; z: number } {
    if (this.listenerPosOf === undefined) {
      throw new Error('SoundRecords113c: a unit-attached sound needs listenerPos (the local player, D2Client 0x6fb37f30)')
    }
    const pos = unit.getPos !== undefined ? unit.getPos() : unit.x !== undefined && unit.y !== undefined ? { x: unit.x, y: unit.y } : null
    if (pos === null) {
      throw new Error(`SoundRecords113c: unit ${normalizeUnitType(unit.unitType)} ${String(unit.id)} has no position`)
    }
    return unitSoundPosition113c(pos, this.listenerPosOf(), soundId)
  }

  /** StopWithFade 0x6fb38550: stop flag, then a Fade Out fade for a playing record. */
  private stopWithFade(r: SoundRecord): void {
    r.stop = true // 0x6fb3857a
    const fadeOut = this.row(r.id).fadeOut
    if (fadeOut !== 0 && r.state === 1) this.fadeRecord(r, fadeOut, 0) // 0x6fb3857d..0x6fb38594
  }

  /** Fade 0x6fb38230 on a found record. */
  private fadeRecord(r: SoundRecord, duration: number, target: number): void {
    if (r.units.length >= 2) return // 0x6fb38266 → 0x6fb37e90: records with two or more units are not faded
    const row = this.row(r.id)
    let dur = duration
    if (target === 255) dur = Math.max(dur, row.fadeIn)
    else if (target === 0) dur = Math.max(dur, row.fadeOut)
    const now = this.clock
    if (r.fading) {
      if (target === r.ft && ((now + dur) >>> 0) >= (r.fe >>> 0)) return // keep a fade that ends no later
      if (r.ft === 0 && target !== 0) return // a fade-out cannot be overridden
    }
    if (target === 0) r.stop = true
    if (dur === 0) {
      r.vol = target
      return
    }
    r.fs = now
    r.fsv = r.vol
    r.ft = target
    r.fe = (now + dur) >>> 0
    r.fading = true
  }

  /**
   * 0x6fb3932a..0x6fb3934e: a due record that could not start is freed, unless it holds a channel, is a loop,
   * or is an Async Only row whose sample is still loading (row +0x86 == 1).
   */
  private dropOrKeepPending(r: SoundRecord, row: NormalizedSoundRow113c, addFree: (rec: SoundRecord) => void): void {
    if (r.channel !== -1 || row.loop) return
    if (row.asyncOnly && this.sampleStateOf?.(r.id) === 'loading') return
    addFree(r)
  }

  /** FindGroupConflict 0x6fb37c30: the earliest-start playing record of the group (unit-filtered when a unit is given). */
  private findGroupConflict(groupBase: number, unit: SoundUnitRef113c | null, rec: SoundRecord): SoundRecord | null {
    let best: SoundRecord | null = null
    for (const other of this.active) {
      if (this.row(other.id).groupBase !== groupBase || other === rec || other.state !== 1) continue
      if (unit !== null && !other.units.some((u) => sameUnit(u, unit))) continue // #10053
      if (best === null || (other.start >>> 0) < (best.start >>> 0)) best = other
    }
    return best
  }

  /** FindSpeechConflict 0x6fb37bd0: the first playing local-speech record (2934..4656) that carries the unit. */
  private findSpeechConflict(unit: SoundUnitRef113c, rec: SoundRecord): SoundRecord | null {
    const [lo, hi] = LOCAL_SPEECH_SOUND_RANGE_113C
    for (const other of this.active) {
      if (other === rec || other.state !== 1) continue
      if (!other.units.some((u) => sameUnit(u, unit))) continue
      if (other.id >= lo && other.id <= hi) return other
    }
    return null
  }

  /** Variant pick 0x6fb0ee70 (RNG 0x6fb39640 on the local player's seed). */
  private pickVariant(id: number): number {
    const g = this.row(id).groupSize // byte +0x3d (0x6fb0eea1)
    if (g <= 1) return id
    const rng = this.rng
    if (rng === undefined) {
      throw new Error(`SoundRecords113c: variant group ${String(id)} needs the local player's RNG (D2Client 0x6fb39640)`)
    }
    let avoid = Math.min(g - 1, 2) // 0x6fb0eeb8..0x6fb0eec4
    if (g <= 3 && rng.rand(g + 1) === 0) avoid -= 1 // 0x6fb0eec9..0x6fb0eeda
    const recent = this.recentOf(id)
    let pick: number
    do pick = id + rng.rand(g) // 0x6fb0eedb..0x6fb0ef2c
    while (recent.slice(0, avoid).includes(pick)) // 0x6fb0ef35..0x6fb0ef42
    return pick
  }

  /**
   * The sample facts of `id` at its start (0x6fb0d83a–0x6fb0d86f). `none.wav` is derived from the table;
   * anything else must come from the injected source, which fails fast when missing.
   */
  private resolveFacts(id: number, row: NormalizedSoundRow113c): SoundSampleFacts113c {
    if (row.isNoneWav) return { kind: 'unavailable', reason: 'none.wav' }
    if (D9_UNSHIPPED_SOUND_IDS_SET_113C.has(id)) return { kind: 'unavailable', reason: 'unshipped' }
    if (this.sampleFactsOf === undefined) {
      throw new Error(`SoundRecords113c: no sampleFacts source injected (starting Sounds.txt row ${String(id)} ${row.sound})`)
    }
    const facts = this.sampleFactsOf(id)
    if (facts === undefined) {
      throw new Error(`SoundRecords113c: no sample facts for Sounds.txt row ${String(id)} (${row.sound}); bake its pack or list it as unshipped`)
    }
    const rawKind = (facts as { readonly kind?: string }).kind
    if (rawKind === 'pcm' || rawKind === undefined) {
      const pcm = facts as {
        readonly sampleRate: number
        readonly frames: number
        readonly channels: 1 | 2
      }
      if (
        !Number.isInteger(pcm.frames) ||
        pcm.frames <= 0 ||
        !Number.isInteger(pcm.sampleRate) ||
        pcm.sampleRate <= 0 ||
        (pcm.channels !== 1 && pcm.channels !== 2)
      ) {
        throw new Error(`SoundRecords113c: invalid PCM facts for Sounds.txt row ${String(id)}: ${JSON.stringify(facts)}`)
      }
      return {
        kind: 'pcm',
        sampleRate: pcm.sampleRate,
        frames: pcm.frames,
        channels: pcm.channels,
      }
    }
    if (facts.kind === 'unavailable' && (facts.reason === 'unshipped' || facts.reason === 'streamed')) return facts
    throw new Error(`SoundRecords113c: invalid sample facts for Sounds.txt row ${String(id)}: ${JSON.stringify(facts)}`)
  }

  /**
   * StartSound 0x6fb0d7a0: variant pick, same-id debounce (FindChannel 0x6fb0cc10), recent picks, sample check,
   * channel allocation in the row's partition (AllocChannel 0x6fb0ce70) and channel start.
   */
  private startSound(r: SoundRecord, now: number): boolean {
    const requested = r.id
    if ((r.a2 & 1) === 0) r.id = this.pickVariant(requested) // 0x6fb0d7d1..0x6fb0d7dd

    // 0x6fb0d7e4..0x6fb0d808
    const other = this.findPlayingRecordOf(r.id, now)
    if (other !== null && !other.stop && ((r.start - other.start) >>> 0) < 2 && other.priority >= r.priority) return false

    const recent = this.recentOf(requested) // 0x6fb0d82e..0x6fb0d837
    recent[1] = recent[0]
    recent[0] = r.id

    const row = this.row(r.id)
    const facts = this.resolveFacts(r.id, row)
    if (facts.kind === 'unavailable') {
      this.unavailable[facts.reason] += 1
      this.onUnavailable?.(r.id, facts.reason)
      return false
    }
    if (this.sampleStateOf?.(r.id) === 'loading') return false // row +0x86 != 2 after LoadSound (0x6fb0d85e)

    const flags: 0 | 1 = row.stereo !== 0 ? 1 : 0 // 0x6fb0d87c..0x6fb0d8a7 (2D sound mode)
    const ch = this.allocChannel(r, flags, now) // 0x6fb0d8ac
    if (ch === null) return false

    ch.record = r // 0x6fb0d8fe
    r.channel = ch.index
    r.voice = this.nextVoice
    this.nextVoice += 1
    r.facts = facts
    r.playTick = now
    // A non-streamed buffer starts at 0 (#10005 / #10069); a stream opens at rec+0x24 (#10039, 0x6fb0d97c).
    r.playOffset = row.stream ? r.a3 : 0
    // nBlocks == 1: the buffer loops from Block 1 (#10050(handle, Block1 << 1), a byte offset of 16-bit PCM).
    const loopStartFrames = row.nBlocks === 1 ? Math.floor((row.block1 * 2) / (2 * facts.channels)) : 0
    this.voicesValue.start(r.voice, r.id, row.loop, r.playOffset, loopStartFrames)
    return true
  }

  /**
   * FindChannel 0x6fb0cc10: among the channels whose buffer is playing (#10044) the record of `id` with the
   * earliest start (unsigned; the first channel wins ties).
   */
  private findPlayingRecordOf(id: number, now: number): SoundRecord | null {
    let best: SoundRecord | null = null
    for (const ch of this.channels) {
      const rec = ch.record
      if (rec === null || rec.id !== id || !this.isPlaying(rec, now)) continue
      if (best === null || (rec.start >>> 0) < (best.start >>> 0)) best = rec
    }
    return best
  }

  /** D2sound #10044: a looped buffer plays until stopped; a one-shot until its last frame. */
  private isPlaying(r: SoundRecord, now: number): boolean {
    return this.row(r.id).loop || !this.bufferEnded(r, now)
  }

  private bufferEnded(r: SoundRecord, now: number): boolean {
    const facts = r.facts
    if (facts === null) throw new Error(`SoundRecords113c: playing record ${String(r.handle)} has no sample facts`)
    return ((now - r.playTick) >>> 0) * facts.sampleRate >= (facts.frames - r.playOffset) * SOUND_TICKS_PER_SECOND
  }

  /** AllocChannel 0x6fb0ce70: a free channel of the partition, else priority voice stealing inside it. */
  private allocChannel(r: SoundRecord, flags: 0 | 1, now: number): SoundChannel113c | null {
    for (const ch of this.channels) {
      if (ch.flags === flags && ch.record === null) return ch // 0x6fb0ce80..0x6fb0ce95
    }
    let victim: SoundChannel113c | null = null
    for (const ch of this.channels) {
      // 0x6fb0ceb0..0x6fb0cf03: min priority → max dist² → min start (u32) → min record address
      const cand = ch.record
      if (ch.flags !== flags || cand === null) continue
      const worst = victim?.record ?? null
      if (worst === null) {
        victim = ch
        continue
      }
      if (worst.priority !== cand.priority) {
        if (worst.priority > cand.priority) victim = ch
        continue
      }
      if (worst.dist2 !== cand.dist2) {
        if (worst.dist2 < cand.dist2) victim = ch
        continue
      }
      if ((worst.start >>> 0) !== (cand.start >>> 0)) {
        if ((worst.start >>> 0) > (cand.start >>> 0)) victim = ch
        continue
      }
      if (cand.slot < worst.slot) victim = ch
    }
    const v = victim?.record ?? null
    if (victim === null || v === null) return null
    // 0x6fb0cf14..0x6fb0cf33: steal iff higher priority, or equal priority and a lower victim address.
    if (r.priority > v.priority || (r.priority === v.priority && v.slot < r.slot)) {
      this.stopChannel(v, now) // 0x6fb0cf35..0x6fb0cf65: position saved, channel stopped, victim state 2
      return victim
    }
    return null
  }

  /** StopChannel 0x6fb380e0: saves the position (#10032: streams only, else 0), stops the channel, state 2. */
  private stopChannel(r: SoundRecord, now: number): void {
    if (r.state !== 1) return
    const ch = this.channels[r.channel]
    if (ch === undefined) throw new Error(`SoundRecords113c: playing record ${String(r.handle)} has no channel (assert 0x93)`)
    const facts = r.facts
    if (this.row(r.id).stream && facts !== null) {
      r.savedPos = (r.playOffset + Math.floor((((now - r.playTick) >>> 0) * facts.sampleRate) / SOUND_TICKS_PER_SECOND)) % facts.frames
    } else {
      r.savedPos = 0
    }
    this.voicesValue.stop(r.voice)
    ch.record = null
    r.channel = -1
    r.voice = 0
    r.state = 2
  }

  private freeRecord(r: SoundRecord): void {
    this.stopChannel(r, this.clock)
    r.units = [] // 0x6fb38150
    this.pool[r.slot] = null
  }

  private updateChannel(r: SoundRecord, row: NormalizedSoundRow113c): void {
    const out = channelOutput113c({
      vol: r.vol,
      volume: row.volume,
      master: this.master(),
      pauseDuck: this.pauseDuckValue,
      soloDuck: this.soloDuckValue,
      pauseExempt: isPauseDuckExempt113c(r.id),
      soloRow: row.solo,
      x: r.x,
      y: r.y,
      z: r.z,
      minDist: falloffMinDist(row.falloff),
      maxDist: falloffMaxDist(row.falloff),
      stereoChannel: this.channels[r.channel]?.flags === 1,
    })
    this.voicesValue.setGains(r.voice, out.left, out.right)
  }
}

function falloffMaxDist(falloff: number): number {
  return FALLOFF_MAX_DIST[falloff] ?? FALLOFF_MAX_DIST_DEFAULT
}

function falloffMinDist(falloff: number): number {
  return FALLOFF_MIN_DIST[falloff] ?? FALLOFF_MIN_DIST_DEFAULT
}

/** SetPos 0x6fb38350: f32 position and dist² with x / y clamped to ±2000. */
function setPos(r: SoundRecord, x: number, y: number, z: number): void {
  r.x = Math.fround(x)
  r.y = Math.fround(y)
  r.z = Math.fround(z)
  const cx = Math.max(-DIST_CLAMP, Math.min(DIST_CLAMP, r.x))
  const cy = Math.max(-DIST_CLAMP, Math.min(DIST_CLAMP, r.y))
  r.dist2 = Math.fround(cx * cx + cy * cy)
}
