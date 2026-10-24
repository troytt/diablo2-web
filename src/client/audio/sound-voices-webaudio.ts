/**
 * Diablo II v1.13c Web Audio Voice Backend (`src/client/audio/sound-voices-webaudio.ts`, #944 F9).
 *
 * Implements `SoundVoiceBackend` on top of Web Audio API nodes:
 * - Each active voice creates one `AudioBufferSourceNode` routed through per-voice L/R `GainNode`s
 *   and a 2-channel `ChannelMergerNode` into the SFX bus `GainNode`.
 * - `offsetFrames` is converted to seconds using the **source** WAV sample rate (`22,050 Hz`),
 *   not `AudioBuffer.sampleRate` (`48,000 Hz`), so stolen/resumed voices restart at the exact
 *   1.13c frame offset (`D2Client.dll` `0x6fb0d2d0`).
 */

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
  private focusMuted = false

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

  start(voice: number, soundId: number, loop: boolean, offsetFrames: number): void {
    this.stop(voice)
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
    }
    this.voices.set(voice, entry)
    source.onended = () => {
      const current = this.voices.get(voice)
      if (current === entry) {
        this.voices.delete(voice)
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
  }
}
