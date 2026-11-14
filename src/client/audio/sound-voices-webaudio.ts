/**
 * Diablo II v1.13c Web Audio Voice Backend (`src/client/audio/sound-voices-webaudio.ts`, #944 F9).
 *
 * Implements `SoundVoiceBackend` on top of Web Audio API nodes:
 * - Each active voice creates one `AudioBufferSourceNode` routed through per-voice L/R `GainNode`s
 *   and a 2-channel `ChannelMergerNode` into the SFX bus `GainNode`.
 * - `offsetFrames` is converted to seconds using the **source** WAV sample rate (`22,050 Hz`),
 *   not `AudioBuffer.sampleRate` (`48,000 Hz`), so stolen/resumed voices restart at the exact
 *   1.13c frame offset (`D2Client.dll` `0x6fb0d2d0`).
 * - In 3D/EAX sound mode (`D2sound.#10059 == 2`), `0x6fb0cf90` (`D2sound.#10058`) configures a
 *   `ConvolverNode` wet reverb bus keyed by `SoundEnviron.txt` `eaxEnviron` (`#1758`), and
 *   `StartSound` (`0x6fb0d8fb..0x6fb0d921` -> `D2sound.#10052`) routes non-stereo voices whose
 *   `Sounds.txt` row has `Reverb = 1` (`reverb: true`) through the wet reverb send (`1.0f` vs `0.0f`).
 */

import { SOUNDS_113C } from '../../common/audio/sounds-113c.ts'
import {
  scaleSoundEnvironEaxPreset113c,
  type SoundEnvironEaxPreset113c,
} from './sound-environ-113c.ts'
import type { SoundVoiceBackend } from './sound-records-113c.ts'

export interface WebAudioOutputBus113c {
  readonly ctx: AudioContext
  readonly node: GainNode
}

export interface ResolvedVoiceBuffer113c {
  readonly buffer: AudioBuffer
  readonly sourceSampleRate: number
}

interface ActiveVoiceNodes {
  readonly voice: number
  readonly soundId: number
  readonly source: AudioBufferSourceNode
  readonly splitter: ChannelSplitterNode | null
  readonly leftGain: GainNode
  readonly rightGain: GainNode
  readonly merger: ChannelMergerNode
  readonly reverbSendGain: GainNode | null
}

interface ContextReverbBus {
  readonly ctx: AudioContext
  readonly busNode: GainNode
  readonly convolver: ConvolverNode
  readonly wetGain: GainNode
  readonly impulseCache: Map<number, AudioBuffer>
  activeEaxEnviron: number
  wetConnected: boolean
}

/** Converts EAX millibels (`-10000..2000`) to linear amplitude (`0` at `-10000`). */
export function eaxMillibelsToGain113c(mb: number): number {
  if (!Number.isFinite(mb) || mb <= -10000) return 0
  return 10 ** (Math.min(2000, mb) / 2000)
}

/** Computes the wet reverb return gain for a `SoundEnvironEaxPreset113c`. */
export function computeEaxWetReverbGain113c(preset: SoundEnvironEaxPreset113c | null): number {
  if (preset === null || preset.eaxEnviron <= 0 || preset.eaxRoomVol <= -10000) {
    return 0
  }
  const combinedMb = preset.eaxRoomVol + Math.min(0, preset.eaxReverb)
  return eaxMillibelsToGain113c(combinedMb)
}

/**
 * Generates a deterministic stereo impulse response `AudioBuffer` for `ConvolverNode`
 * parameterized by the `SoundEnviron.txt` EAX preset (`eaxEnviron`, `eaxDecayTime`,
 * `eaxDecayHF`, `eaxReflectDelay`, `eaxRevDelay`, `eaxEnvDiff`).
 */
export function createEaxImpulseResponse113c(
  ctx: AudioContext,
  preset: SoundEnvironEaxPreset113c,
): AudioBuffer {
  const sampleRate = ctx.sampleRate > 0 ? ctx.sampleRate : 48_000
  const decaySec = Math.max(0.05, Math.min(8.0, preset.eaxDecayTime > 0 ? preset.eaxDecayTime : 1.0))
  const preDelaySec = Math.max(0, Math.min(0.3, (preset.eaxReflectDelay || 0) + (preset.eaxRevDelay || 0)))
  const totalSec = Math.min(8.5, preDelaySec + decaySec)
  const length = Math.max(64, Math.round(totalSec * sampleRate))
  const buffer = ctx.createBuffer(2, length, sampleRate)
  const preDelayFrames = Math.min(length - 1, Math.round(preDelaySec * sampleRate))
  const decayFrames = Math.max(1, length - preDelayFrames)
  const hfRatio = Math.max(0.1, Math.min(2.0, preset.eaxDecayHF > 0 ? preset.eaxDecayHF : 0.5))
  const diffusion = Math.max(0.1, Math.min(1.0, preset.eaxEnvDiff > 0 ? preset.eaxEnvDiff : 1.0))

  // Deterministic PRNG seeded from eaxEnviron so impulse responses are reproducible.
  let seed = ((preset.eaxEnviron * 0x45d9f3b) ^ 0x6fb0cf90) >>> 0
  const nextSample = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return (seed / 0x80000000) - 1.0
  }

  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch)
    let lpState = 0
    const lpAlpha = Math.max(0.05, Math.min(0.95, hfRatio * 0.5))
    for (let i = preDelayFrames; i < length; i += 1) {
      const t = (i - preDelayFrames) / decayFrames
      // -60 dB decay over decaySec (`10^(-3 * t)`)
      const env = Math.pow(10, -3 * t) * diffusion
      const raw = nextSample() * env
      lpState = lpState + lpAlpha * (raw - lpState)
      data[i] = lpState
    }
  }
  return buffer
}

export class WebAudioSoundVoices implements SoundVoiceBackend {
  private readonly getOutput: () => WebAudioOutputBus113c | null
  private readonly getBuffer: (id: number) => ResolvedVoiceBuffer113c | undefined
  private readonly loadBuffer:
    | ((id: number) => Promise<ResolvedVoiceBuffer113c | undefined>)
    | undefined
  private readonly voices = new Map<number, ActiveVoiceNodes>()
  private readonly lastGains = new Map<number, { left: number; right: number }>()
  private readonly pendingTokens = new Map<number, number>()
  private readonly voiceReverbMix = new Map<number, number>()
  private focusMuted = false
  private threeDSoundEnabled = false
  private currentEaxPreset: SoundEnvironEaxPreset113c | null = null
  private currentEaxEnvIdx = 0
  private reverbBus: ContextReverbBus | null = null

  constructor(
    output: () => WebAudioOutputBus113c | null,
    buffers: (id: number) => ResolvedVoiceBuffer113c | undefined,
    loadBuffer?: (id: number) => Promise<ResolvedVoiceBuffer113c | undefined>,
  ) {
    this.getOutput = output
    this.getBuffer = buffers
    this.loadBuffer = loadBuffer
  }

  setFocusMuted(muted: boolean): void {
    this.focusMuted = muted
  }

  isFocusMuted(): boolean {
    return this.focusMuted
  }

  /** Enables or disables 3D/EAX reverb routing (`D2sound.#10059 == 2`). */
  set3DSoundEnabled(enabled: boolean): void {
    this.threeDSoundEnabled = Boolean(enabled)
    if (!this.threeDSoundEnabled && this.reverbBus !== null) {
      this.reverbBus.wetGain.gain.value = 0
    } else if (this.threeDSoundEnabled && this.currentEaxPreset !== null) {
      this.syncReverbBusPreset()
    }
  }

  is3DSoundEnabled(): boolean {
    return this.threeDSoundEnabled
  }

  /**
   * D2Client.dll 0x6fb0cf90 -> D2sound.#10058 (`0x6fabd306`):
   * Sets the active `SoundEnviron.txt` EAX preset for the wet `ConvolverNode` reverb bus.
   */
  setEaxPreset(preset: SoundEnvironEaxPreset113c | null, envIdx = 0): void {
    this.currentEaxPreset = preset
    this.currentEaxEnvIdx = envIdx
    if (preset !== null && preset.eaxEnviron > 0 && preset.eaxRoomVol > -10000) {
      this.threeDSoundEnabled = true
    }
    this.syncReverbBusPreset()
  }

  /** Convenience helper: scales `SOUND_ENVIRON_113C[envIdx]` via `0x6fb0cf90` and applies it. */
  setEaxEnvironmentByIndex(envIdx: number): void {
    if (!Number.isInteger(envIdx) || envIdx <= 0) {
      this.setEaxPreset(scaleSoundEnvironEaxPreset113c(0), 0)
      return
    }
    this.setEaxPreset(scaleSoundEnvironEaxPreset113c(envIdx), envIdx)
  }

  getEaxPreset(): SoundEnvironEaxPreset113c | null {
    return this.currentEaxPreset
  }

  getEaxEnvironmentIndex(): number {
    return this.currentEaxEnvIdx
  }

  /**
   * D2Client.dll 0x6fb0d8fb..0x6fb0d921 -> D2sound.#10052 (`0x6fabd33c`):
   * Sets the per-voice wet reverb send mix (`1.0` when `Reverb = 1`, `0.0` when `Reverb = 0`).
   */
  setReverbMix(voice: number, mix: number): void {
    const normalized = Number.isFinite(mix) && mix > 0 ? Math.min(1, mix) : 0
    this.voiceReverbMix.set(voice, normalized)
    const active = this.voices.get(voice)
    if (active?.reverbSendGain !== null && active?.reverbSendGain !== undefined) {
      active.reverbSendGain.gain.value = normalized
    }
  }

  getVoiceReverbMix(voice: number): number {
    return this.voiceReverbMix.get(voice) ?? 0
  }

  /** Returns `true` when `voice` is actively routed into the wet `ConvolverNode` reverb send. */
  isVoiceReverbActive(voice: number): boolean {
    const active = this.voices.get(voice)
    return (
      active !== undefined &&
      active.reverbSendGain !== null &&
      active.reverbSendGain.gain.value > 0
    )
  }

  /** Returns the active `ConvolverNode` when the EAX reverb bus has been instantiated. */
  getConvolverNode(): ConvolverNode | null {
    return this.reverbBus?.convolver ?? null
  }

  start(voice: number, soundId: number, loop: boolean, offsetFrames: number, _loopStartFrames = 0): void {
    const preconfiguredMix = this.voiceReverbMix.get(voice)
    this.stop(voice)
    if (preconfiguredMix !== undefined) {
      this.voiceReverbMix.set(voice, preconfiguredMix)
    }
    // #1363: When focus-muted in background instance, skip creating WebAudio nodes for
    // transient one-shot SFX (!loop) to save CPU/WebAudio graph overhead while keeping
    // looping ambient/environment voices alive for seamless focus restoration.
    if (this.focusMuted && !loop) return
    const out = this.getOutput()
    if (out === null) return
    const resolved = this.getBuffer(soundId)
    if (resolved !== undefined) {
      this.startWithResolved(voice, soundId, loop, offsetFrames, out, resolved)
      return
    }
    if (this.loadBuffer === undefined) return

    const token = (this.pendingTokens.get(voice) ?? 0) + 1
    this.pendingTokens.set(voice, token)
    void this.loadBuffer(soundId)
      .then((loaded) => {
        if (loaded === undefined) return
        if (this.pendingTokens.get(voice) !== token) return
        const currentOut = this.getOutput()
        if (currentOut === null) return
        this.startWithResolved(voice, soundId, loop, offsetFrames, currentOut, loaded)
      })
      .catch(() => {
        /* ignore decode failure */
      })
  }

  private resolveEffectiveReverbMix(voice: number, soundId: number): number {
    if (!this.threeDSoundEnabled) return 0
    const preset = this.currentEaxPreset
    if (preset === null || preset.eaxEnviron <= 0 || preset.eaxRoomVol <= -10000) {
      return 0
    }
    const explicit = this.voiceReverbMix.get(voice)
    if (explicit !== undefined) {
      return explicit
    }
    const row = SOUNDS_113C[soundId]
    if (row === undefined || row.stereo || !row.reverb) {
      return 0
    }
    return 1
  }

  private ensureReverbBus(out: WebAudioOutputBus113c): ContextReverbBus | null {
    const { ctx, node: busNode } = out
    if (typeof (ctx as { createConvolver?: unknown }).createConvolver !== 'function') {
      return null
    }
    if (this.reverbBus === null || this.reverbBus.ctx !== ctx || this.reverbBus.busNode !== busNode) {
      const convolver = ctx.createConvolver()
      const wetGain = ctx.createGain()
      wetGain.gain.value = 0
      convolver.connect(wetGain)
      wetGain.connect(busNode)
      this.reverbBus = {
        ctx,
        busNode,
        convolver,
        wetGain,
        impulseCache: new Map<number, AudioBuffer>(),
        activeEaxEnviron: 0,
        wetConnected: true,
      }
    }
    this.syncReverbBusPreset(out)
    return this.reverbBus
  }

  private syncReverbBusPreset(outOverride?: WebAudioOutputBus113c): void {
    const preset = this.currentEaxPreset
    if (!this.threeDSoundEnabled || preset === null || preset.eaxEnviron <= 0 || preset.eaxRoomVol <= -10000) {
      if (this.reverbBus !== null) {
        this.reverbBus.wetGain.gain.value = 0
        this.reverbBus.activeEaxEnviron = 0
        if (this.reverbBus.wetConnected) {
          try {
            this.reverbBus.wetGain.disconnect()
          } catch {
            // Ignore if already disconnected
          }
          this.reverbBus.wetConnected = false
        }
        if (preset === null) {
          try {
            this.reverbBus.convolver.buffer = null
          } catch {
            // Ignore engines disallowing null buffer reset
          }
          this.reverbBus.impulseCache.clear()
        }
      }
      return
    }
    const out = outOverride ?? this.getOutput()
    if (out === null) return
    if (typeof (out.ctx as { createConvolver?: unknown }).createConvolver !== 'function') {
      return
    }
    if (
      this.reverbBus === null ||
      this.reverbBus.ctx !== out.ctx ||
      this.reverbBus.busNode !== out.node
    ) {
      const convolver = out.ctx.createConvolver()
      const wetGain = out.ctx.createGain()
      convolver.connect(wetGain)
      wetGain.connect(out.node)
      this.reverbBus = {
        ctx: out.ctx,
        busNode: out.node,
        convolver,
        wetGain,
        impulseCache: new Map<number, AudioBuffer>(),
        activeEaxEnviron: 0,
        wetConnected: true,
      }
    } else if (!this.reverbBus.wetConnected) {
      this.reverbBus.wetGain.connect(out.node)
      this.reverbBus.wetConnected = true
    }
    const bus = this.reverbBus
    if (bus.activeEaxEnviron !== preset.eaxEnviron) {
      let ir = bus.impulseCache.get(preset.eaxEnviron)
      if (ir === undefined) {
        ir = createEaxImpulseResponse113c(bus.ctx, preset)
        bus.impulseCache.set(preset.eaxEnviron, ir)
      }
      bus.convolver.buffer = ir
      bus.activeEaxEnviron = preset.eaxEnviron
    }
    bus.wetGain.gain.value = computeEaxWetReverbGain113c(preset)
  }

  private startWithResolved(
    voice: number,
    soundId: number,
    loop: boolean,
    offsetFrames: number,
    out: WebAudioOutputBus113c,
    resolved: ResolvedVoiceBuffer113c,
  ): void {
    const { ctx, node: busNode } = out
    const { buffer, sourceSampleRate } = resolved
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = loop

    const leftGain = ctx.createGain()
    const rightGain = ctx.createGain()
    const prev = this.lastGains.get(voice)
    leftGain.gain.value = prev !== undefined ? prev.left : 1
    rightGain.gain.value = prev !== undefined ? prev.right : 1

    const merger = ctx.createChannelMerger(2)
    let splitter: ChannelSplitterNode | null = null
    if (buffer.numberOfChannels >= 2) {
      splitter = ctx.createChannelSplitter(2)
      source.connect(splitter)
      splitter.connect(leftGain, 0, 0)
      splitter.connect(rightGain, 1, 0)
    } else {
      source.connect(leftGain)
      source.connect(rightGain)
    }
    leftGain.connect(merger, 0, 0)
    rightGain.connect(merger, 0, 1)
    merger.connect(busNode)

    // #1758 (0x6fb0cf90 / 0x6fb0d8fb..0x6fb0d921): Connect Reverb=1 voices to the EAX ConvolverNode send in 3D mode.
    let reverbSendGain: GainNode | null = null
    const reverbMix = this.resolveEffectiveReverbMix(voice, soundId)
    this.voiceReverbMix.set(voice, reverbMix)
    if (reverbMix > 0) {
      const bus = this.ensureReverbBus(out)
      if (bus !== null) {
        reverbSendGain = ctx.createGain()
        reverbSendGain.gain.value = reverbMix
        merger.connect(reverbSendGain)
        reverbSendGain.connect(bus.convolver)
      }
    }

    const rate = sourceSampleRate > 0 ? sourceSampleRate : 22_050
    const rawOffsetSec = Math.max(0, offsetFrames) / rate
    const offsetSec =
      buffer.duration > 0 && !loop
        ? Math.min(rawOffsetSec, Math.max(0, buffer.duration - 1e-6))
        : rawOffsetSec

    const entry: ActiveVoiceNodes = {
      voice,
      soundId,
      source,
      splitter,
      leftGain,
      rightGain,
      merger,
      reverbSendGain,
    }
    this.voices.set(voice, entry)
    source.onended = () => {
      const current = this.voices.get(voice)
      if (current === entry) {
        this.voices.delete(voice)
        this.voiceReverbMix.delete(voice)
        this.disconnectNodes(entry)
      }
    }
    source.start(0, offsetSec)
  }

  setGains(voice: number, left: number, right: number): void {
    this.lastGains.set(voice, { left, right })
    const active = this.voices.get(voice)
    if (active === undefined) return
    active.leftGain.gain.value = left
    active.rightGain.gain.value = right
  }

  stop(voice: number): void {
    this.pendingTokens.set(voice, (this.pendingTokens.get(voice) ?? 0) + 1)
    this.voiceReverbMix.delete(voice)
    const active = this.voices.get(voice)
    if (active === undefined) return
    this.voices.delete(voice)
    try {
      active.source.onended = null
      active.source.stop()
    } catch {
      // Ignore if already stopped
    }
    this.disconnectNodes(active)
  }

  stopAll(): void {
    for (const voice of [...this.voices.keys()]) {
      this.stop(voice)
    }
    this.pendingTokens.clear()
    this.lastGains.clear()
    this.voiceReverbMix.clear()
  }

  private disconnectNodes(active: ActiveVoiceNodes): void {
    try {
      active.source.disconnect()
    } catch {
      /* ignore */
    }
    if (active.splitter !== null) {
      try {
        active.splitter.disconnect()
      } catch {
        /* ignore */
      }
    }
    try {
      active.leftGain.disconnect()
    } catch {
      /* ignore */
    }
    try {
      active.rightGain.disconnect()
    } catch {
      /* ignore */
    }
    try {
      active.merger.disconnect()
    } catch {
      /* ignore */
    }
    if (active.reverbSendGain !== null) {
      try {
        active.reverbSendGain.disconnect()
      } catch {
        /* ignore */
      }
    }
  }
}
