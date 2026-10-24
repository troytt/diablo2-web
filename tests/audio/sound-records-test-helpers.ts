/**
 * Shared test inputs for the `SoundRecords113c` unit tests (#943): explicit test rows, explicit PCM facts,
 * logging / strict voice backends and an RNG that records its draws. Nothing here re-implements the record layer.
 */
import type {
  SoundRecordRowInput113c,
  SoundRecords113c,
  SoundSampleFacts113c,
  SoundVoiceBackend,
} from '../../src/client/audio/sound-records-113c.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'

/** A test Sounds.txt row: every field explicit, defaults of a plain one-shot (Volume 200, Priority 100, Falloff 1). */
export function makeTestRow(overrides: Partial<SoundRecordRowInput113c> & { id: number }): SoundRecordRowInput113c {
  return {
    id: overrides.id,
    sound: overrides.sound ?? `test_sound_${String(overrides.id)}`,
    fileName: overrides.fileName ?? `test_${String(overrides.id)}.wav`,
    volume: overrides.volume ?? 200,
    groupSize: overrides.groupSize ?? 1,
    groupBase: overrides.groupBase ?? overrides.id,
    loop: overrides.loop ?? false,
    fadeIn: overrides.fadeIn ?? 0,
    fadeOut: overrides.fadeOut ?? 0,
    deferInst: overrides.deferInst ?? false,
    stopInst: overrides.stopInst ?? false,
    duration: overrides.duration ?? 0,
    compound: overrides.compound ?? 0,
    reverb: overrides.reverb ?? false,
    falloff: overrides.falloff ?? 1,
    cache: overrides.cache ?? false,
    asyncOnly: overrides.asyncOnly ?? false,
    priority: overrides.priority ?? 100,
    stream: overrides.stream ?? false,
    stereo: overrides.stereo ?? 0,
    tracking: overrides.tracking ?? false,
    solo: overrides.solo ?? false,
    musicVol: overrides.musicVol ?? false,
    block1: overrides.block1 ?? -1,
    block2: overrides.block2 ?? -1,
    block3: overrides.block3 ?? -1,
    nBlocks: overrides.nBlocks ?? 0,
  }
}

/** Test input facts: `ticks` SoundTicks of 22,050 Hz PCM (882 frames per tick). */
export function pcm(ticks: number, channels: 1 | 2 = 1): SoundSampleFacts113c {
  return { kind: 'pcm', sampleRate: 22050, frames: ticks * 882, channels }
}

/** `n` SoundTicks: SoundUpdate, then Fn_6fb0d080 and the clock increment. */
export function step(rec: SoundRecords113c, n = 1): void {
  for (let i = 0; i < n; i += 1) {
    rec.update()
    rec.endTick()
  }
}

export interface StartCall {
  readonly voice: number
  readonly soundId: number
  readonly loop: boolean
  readonly offsetFrames: number
  readonly loopStartFrames: number
}

/** A backend that only logs what the record layer asks for. */
export function createVoiceLogger(): {
  starts: StartCall[]
  gains: Array<{ voice: number; left: number; right: number }>
  stops: number[]
  backend: SoundVoiceBackend
} {
  const starts: StartCall[] = []
  const gains: Array<{ voice: number; left: number; right: number }> = []
  const stops: number[] = []
  return {
    starts,
    gains,
    stops,
    backend: {
      start(voice, soundId, loop, offsetFrames, loopStartFrames) {
        starts.push({ voice, soundId, loop, offsetFrames, loopStartFrames })
      },
      setGains(voice, left, right) {
        gains.push({ voice, left, right })
      },
      stop(voice) {
        stops.push(voice)
      },
    },
  }
}

/** Strict output backend: fails on a double start and on gains / stops for voices that are not playing. */
export class RecordingVoices implements SoundVoiceBackend {
  readonly log: string[] = []
  readonly playing = new Map<number, { soundId: number; loop: boolean; offset: number; loopStart: number }>()
  readonly gains = new Map<number, readonly [number, number]>()

  start(voice: number, soundId: number, loop: boolean, offsetFrames: number, loopStartFrames: number): void {
    if (this.playing.has(voice)) throw new Error(`voice ${String(voice)} started twice`)
    this.playing.set(voice, { soundId, loop, offset: offsetFrames, loopStart: loopStartFrames })
    this.log.push(`start ${String(voice)} ${String(soundId)} @${String(offsetFrames)}`)
  }

  setGains(voice: number, left: number, right: number): void {
    if (!this.playing.has(voice)) throw new Error(`gains for voice ${String(voice)}, not playing`)
    this.gains.set(voice, [left, right])
  }

  stop(voice: number): void {
    if (!this.playing.delete(voice)) throw new Error(`stop of voice ${String(voice)}, not playing`)
    this.log.push(`stop ${String(voice)}`)
  }

  /** Gains of the playing voice of `soundId` (exactly one). */
  gainsOf(soundId: number): readonly [number, number] {
    const voices = [...this.playing].filter(([, v]) => v.soundId === soundId)
    if (voices.length !== 1) throw new Error(`${String(voices.length)} voices of ${String(soundId)}`)
    const g = this.gains.get(voices[0]![0])
    if (g === undefined) throw new Error(`no gains for ${String(soundId)}`)
    return g
  }
}

/** D2Rng that logs every `rand(n)` with its result. */
export class CountingRng extends D2Rng {
  readonly draws: { max: number; value: number }[] = []

  override rand(max: number): number {
    const value = super.rand(max)
    this.draws.push({ max, value })
    return value
  }
}
