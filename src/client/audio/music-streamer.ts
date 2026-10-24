/**
 * Diablo II v1.13c Dual-Deck BGM & Quest Stinger Streamer (`src/client/audio/music-streamer.ts`, #945 F13).
 *
 * Ground truth (`D2Client.dll` `0x6faf54e0–0x6faf5962`):
 * - Uses two persistent `<audio>` elements (`Deck A` and `Deck B`) routed through
 *   `MediaElementAudioSourceNode -> deck fade GainNode -> musicGain -> masterGain -> destination`.
 * - Streams `.webm` Opus BGM files progressively via the browser media pipeline.
 * - Crossfades over `Fade Out` / `Fade In` ticks (25 Hz, default 35 ticks = 1.4 s when 0) when
 *   changing tracks, and preserves continuous playback without restarting when moving between
 *   adjacent levels that share the same `SoundEnviron.txt` `Song` ID.
 * - Supports `Block 1..3` section/loop offsets (22,050 Hz frame offsets converted to seconds).
 * - Supports quest resolution stinger overrides (`4685..4698`, `Loop = 0`) with automatic
 *   restoration of the interrupted looping BGM track when the stinger finishes.
 */

import {
  getMusicTrack113c,
  type MusicTrackMeta113c,
} from '../../common/audio/music-tracks-113c.ts'
import { getSoundEnvironForLevel113c } from '../../common/audio/sound-environ-113c.ts'

export const MUSIC_OPTIONS_SOUND_ID_113C = 4668
export const MUSIC_TITLE_SOUND_ID_113C = 4699
export const MUSIC_ACT5_INTRO_SOUND_ID_113C = 4684
export const MUSIC_QUEST_STINGER_RANGE_113C: readonly [number, number] = [4685, 4698]
export const DEFAULT_CROSSFADE_TICKS_113C = 35

export interface MusicAudioElementLike {
  src: string
  loop: boolean
  preload: string
  volume: number
  muted: boolean
  currentTime: number
  readonly duration: number
  readonly paused: boolean
  readonly ended?: boolean | undefined
  play(): Promise<void>
  pause(): void
  load?(): void
  advance?(dtSec: number): void
  addEventListener(type: string, cb: (ev?: unknown) => void): void
  removeEventListener(type: string, cb: (ev?: unknown) => void): void
}

export interface MusicStreamerOptions {
  readonly ctx?: AudioContext | null | undefined
  readonly context?: AudioContext | null | undefined
  readonly getContext?: (() => AudioContext | null) | undefined
  readonly output?: AudioNode | null | undefined
  readonly outputNode?: AudioNode | null | undefined
  readonly musicGain?: GainNode | null | undefined
  readonly masterGain?: GainNode | null | undefined
  readonly getOutput?: (() => { readonly ctx: AudioContext; readonly node: AudioNode } | null) | undefined
  readonly createAudioElement?: ((src?: string) => MusicAudioElementLike) | undefined
  readonly getMusicVolume?: (() => number) | undefined
  readonly getSfxVolume?: (() => number) | undefined
  readonly getMasterVolume?: (() => number) | undefined
  readonly isMuted?: (() => boolean) | undefined
}

export interface PlayTrackOptions {
  readonly blockIndex?: number | undefined
  readonly randomBlock?: boolean | undefined
  readonly seed?: number | undefined
  readonly immediate?: boolean | undefined
  readonly loop?: boolean | undefined
  readonly onEnded?: (() => void) | undefined
}

interface DeckFadeState {
  readonly fromGain: number
  readonly toGain: number
  elapsedTicks: number
  readonly durationTicks: number
  readonly pauseOnComplete: boolean
}

interface MusicDeckSlot {
  readonly label: 'A' | 'B'
  readonly element: MusicAudioElementLike
  sourceNode: MediaElementAudioSourceNode | null
  gainNode: GainNode | null
  trackId: number
  gainValue: number
  fade: DeckFadeState | null
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 1
  return Math.max(0, Math.min(1, v))
}

function defaultCreateAudioElement(src = ''): MusicAudioElementLike {
  const g = globalThis as {
    Audio?: new (s?: string) => MusicAudioElementLike
    HTMLAudioElement?: new (s?: string) => MusicAudioElementLike
  }
  const Ctor = g.Audio ?? g.HTMLAudioElement
  if (typeof Ctor === 'function') {
    const el = new Ctor(src)
    el.preload = 'auto'
    return el
  }
  // Headless fallback if neither Audio nor HTMLAudioElement is installed globally
  let currentSrc = src
  let currentTime = 0
  let paused = true
  let ended = false
  const listeners = new Map<string, Set<(ev?: unknown) => void>>()
  return {
    get src(): string {
      return currentSrc
    },
    set src(v: string) {
      currentSrc = v
      currentTime = 0
      ended = false
    },
    loop: false,
    preload: 'auto',
    volume: 1,
    muted: false,
    get currentTime(): number {
      return currentTime
    },
    set currentTime(sec: number) {
      if (!Number.isFinite(sec) || sec < 0) {
        throw new RangeError(`HTMLAudioElement.currentTime: invalid value ${String(sec)}`)
      }
      currentTime = sec
    },
    duration: Number.NaN,
    get paused(): boolean {
      return paused
    },
    get ended(): boolean {
      return ended
    },
    play(): Promise<void> {
      paused = false
      ended = false
      return Promise.resolve()
    },
    pause(): void {
      paused = true
    },
    load(): void {
      /* no-op */
    },
    addEventListener(type: string, cb: (ev?: unknown) => void): void {
      let set = listeners.get(type)
      if (!set) {
        set = new Set()
        listeners.set(type, set)
      }
      set.add(cb)
    },
    removeEventListener(type: string, cb: (ev?: unknown) => void): void {
      listeners.get(type)?.delete(cb)
    },
  }
}

export class MusicStreamer {
  private readonly options: MusicStreamerOptions
  private readonly createAudioElementFn: (src?: string) => MusicAudioElementLike
  private deckA: MusicDeckSlot | null = null
  private deckB: MusicDeckSlot | null = null
  private activeDeck: MusicDeckSlot | null = null
  private activeTrackId = 0
  private boundContext: AudioContext | null = null
  private internalMasterGain: GainNode | null = null
  private internalMusicGain: GainNode | null = null
  private pendingResumeDeck: MusicDeckSlot | null = null
  private savedBgmState: {
    readonly soundId: number
    readonly resumeTimeSec: number
  } | null = null
  private stingerOnEnded: (() => void) | null = null

  private musicVolume = 1
  private sfxVolume = 1
  private masterVolume = 1
  private muted = false
  private soloDuckRatio = 1

  constructor(options: MusicStreamerOptions = {}) {
    this.options = options
    this.createAudioElementFn = options.createAudioElement ?? defaultCreateAudioElement
    if (options.getMusicVolume) this.musicVolume = clamp01(options.getMusicVolume())
    if (options.getSfxVolume) this.sfxVolume = clamp01(options.getSfxVolume())
    if (options.getMasterVolume) this.masterVolume = clamp01(options.getMasterVolume())
    if (options.isMuted) this.muted = Boolean(options.isMuted())

    // If audio element constructor or factory is available at construction time, initialize the 2 decks immediately.
    const g = globalThis as { Audio?: unknown; HTMLAudioElement?: unknown }
    if (options.createAudioElement !== undefined || typeof g.Audio === 'function' || typeof g.HTMLAudioElement === 'function') {
      this.ensureDecks()
      this.ensureGraph()
    }
  }

  get soloDuck(): number {
    return Math.round(this.soloDuckRatio * 100)
  }

  getSoloDuck(): number {
    return this.soloDuckRatio
  }

  setSoloDuck(active: boolean | number): void {
    if (typeof active === 'number') {
      this.soloDuckRatio = active > 1 ? Math.max(0, Math.min(1, active / 100)) : Math.max(0, Math.min(1, active))
    } else {
      this.soloDuckRatio = active ? 0.7 : 1
    }
    this.applySettings()
  }

  setSoloActive(active: boolean): void {
    this.setSoloDuck(active)
  }

  get currentSongId(): number {
    return this.activeTrackId
  }

  get activeSongId(): number {
    return this.activeTrackId
  }

  get currentTrackId(): number {
    return this.activeTrackId
  }

  get songId(): number {
    return this.activeTrackId
  }

  getCurrentSongId(): number {
    return this.activeTrackId
  }

  getActiveSongId(): number {
    return this.activeTrackId
  }

  getDecks(): readonly [MusicAudioElementLike, MusicAudioElementLike] {
    const [a, b] = this.ensureDecks()
    return [a.element, b.element]
  }

  private ensureDecks(): [MusicDeckSlot, MusicDeckSlot] {
    if (this.deckA !== null && this.deckB !== null) {
      return [this.deckA, this.deckB]
    }
    const elA = this.createAudioElementFn()
    const elB = this.createAudioElementFn()
    elA.preload = 'auto'
    elB.preload = 'auto'
    const slotA: MusicDeckSlot = {
      label: 'A',
      element: elA,
      sourceNode: null,
      gainNode: null,
      trackId: 0,
      gainValue: 0,
      fade: null,
    }
    const slotB: MusicDeckSlot = {
      label: 'B',
      element: elB,
      sourceNode: null,
      gainNode: null,
      trackId: 0,
      gainValue: 0,
      fade: null,
    }
    elA.addEventListener('ended', () => this.handleDeckEnded(slotA))
    elB.addEventListener('ended', () => this.handleDeckEnded(slotB))
    this.deckA = slotA
    this.deckB = slotB
    return [slotA, slotB]
  }

  private resolveContext(): AudioContext | null {
    return (
      this.options.ctx ??
      this.options.context ??
      this.options.getContext?.() ??
      this.options.getOutput?.()?.ctx ??
      null
    )
  }

  private resolveOutputNode(ctx: AudioContext): AudioNode {
    const explicitOut =
      this.options.output ??
      this.options.outputNode ??
      this.options.musicGain ??
      this.options.getOutput?.()?.node
    if (explicitOut !== undefined && explicitOut !== null) {
      return explicitOut
    }
    if (this.internalMusicGain !== null && this.boundContext === ctx) {
      return this.internalMusicGain
    }
    const master = this.options.masterGain ?? ctx.createGain()
    if (this.options.masterGain === undefined || this.options.masterGain === null) {
      master.connect(ctx.destination)
    }
    const music = ctx.createGain()
    music.connect(master)
    this.internalMasterGain = master
    this.internalMusicGain = music
    return music
  }

  private ensureGraph(): void {
    const ctx = this.resolveContext()
    if (ctx === null) return
    const [slotA, slotB] = this.ensureDecks()
    if (this.boundContext === ctx && slotA.sourceNode !== null && slotB.sourceNode !== null) {
      return
    }
    const outputNode = this.resolveOutputNode(ctx)
    this.boundContext = ctx
    for (const slot of [slotA, slotB]) {
      const gain = ctx.createGain()
      gain.gain.value = slot.gainValue
      gain.connect(outputNode)
      slot.gainNode = gain
      if (typeof ctx.createMediaElementSource === 'function') {
        const srcNode = ctx.createMediaElementSource(slot.element as unknown as HTMLMediaElement)
        srcNode.connect(gain)
        slot.sourceNode = srcNode
      }
    }
  }

  private computeTrackTargetGain(track: MusicTrackMeta113c): number {
    this.refreshVolumesFromOptions()
    if (this.muted) return 0
    const rowGain = Math.max(0, Math.min(1, track.volume / 255))
    const busGain = track.musicVol ? this.musicVolume : this.sfxVolume
    return rowGain * busGain * this.masterVolume
  }

  private refreshVolumesFromOptions(): void {
    if (this.options.getMusicVolume) this.musicVolume = clamp01(this.options.getMusicVolume())
    if (this.options.getSfxVolume) this.sfxVolume = clamp01(this.options.getSfxVolume())
    if (this.options.getMasterVolume) this.masterVolume = clamp01(this.options.getMasterVolume())
    if (this.options.isMuted) this.muted = Boolean(this.options.isMuted())
  }

  private syncDeckGain(slot: MusicDeckSlot): void {
    const effective = this.muted ? 0 : Math.max(0, Math.min(1, slot.gainValue * this.soloDuckRatio))
    if (slot.gainNode !== null) {
      slot.gainNode.gain.value = effective
    }
    if (slot.sourceNode !== null && slot.gainNode !== null) {
      slot.element.volume = effective === 0 ? 0 : 1
    } else {
      slot.element.volume = effective
    }
  }

  private resolveSeekSeconds(track: MusicTrackMeta113c, opts?: PlayTrackOptions): number {
    const validBlocks = [track.block1, track.block2, track.block3].filter(
      (b) => b >= 0 && b < track.frames,
    )
    if (opts?.blockIndex !== undefined) {
      if (typeof opts.blockIndex === 'number' && Number.isFinite(opts.blockIndex)) {
        const idx = Math.floor(opts.blockIndex)
        if (idx >= 1 && idx <= validBlocks.length) {
          return validBlocks[idx - 1]! / track.sampleRate
        }
      }
      return 0
    }
    if (opts?.randomBlock === true && validBlocks.length > 0) {
      const pick = Math.abs(Math.trunc(opts.seed ?? 0)) % (validBlocks.length + 1)
      if (pick >= 1 && pick <= validBlocks.length) {
        return validBlocks[pick - 1]! / track.sampleRate
      }
    }
    return 0
  }

  private handleDeckEnded(slot: MusicDeckSlot): void {
    const track = getMusicTrack113c(slot.trackId)
    if (track !== undefined && slot.element.loop) {
      slot.element.currentTime = 0
      const p = slot.element.play()
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          this.pendingResumeDeck = slot
        })
      }
      return
    }
    slot.element.pause()
    if (slot !== this.activeDeck) return

    const cb = this.stingerOnEnded
    this.stingerOnEnded = null
    if (cb !== null) {
      cb()
    }
    if (this.savedBgmState !== null) {
      const saved = this.savedBgmState
      this.savedBgmState = null
      this.playTrack(saved.soundId)
      if (this.activeDeck !== null && saved.resumeTimeSec > 0) {
        try {
          this.activeDeck.element.currentTime = saved.resumeTimeSec
        } catch {
          /* ignore out-of-range resume offset */
        }
      }
    }
  }

  playTrack(soundId: number, opts?: PlayTrackOptions): boolean {
    if (typeof soundId !== 'number' || !Number.isInteger(soundId)) {
      return false
    }
    const track = getMusicTrack113c(soundId)
    if (track === undefined) {
      return false
    }

    const [slotA, slotB] = this.ensureDecks()
    this.ensureGraph()

    // Same-Song continuity: if already playing this exact track, do not restart or swap decks
    if (this.activeTrackId === soundId && this.activeDeck !== null && !this.activeDeck.element.paused) {
      if (opts?.blockIndex !== undefined) {
        const seekSec = this.resolveSeekSeconds(track, opts)
        this.activeDeck.element.currentTime = seekSec
      }
      return true
    }

    this.pendingResumeDeck = null
    const prevDeck = this.activeDeck
    const wasPlaying = prevDeck !== null && !prevDeck.element.paused
    const incomingDeck = prevDeck === slotA ? slotB : slotA

    if (!incomingDeck.element.paused) {
      incomingDeck.element.pause()
    }

    if (prevDeck !== null && prevDeck !== incomingDeck) {
      if (wasPlaying) {
        if (opts?.immediate === true) {
          prevDeck.fade = null
          prevDeck.gainValue = 0
          this.syncDeckGain(prevDeck)
          prevDeck.element.pause()
        } else {
          const prevTrack = getMusicTrack113c(prevDeck.trackId)
          const fadeOutTicks =
            prevTrack !== undefined && prevTrack.fadeOut > 0
              ? prevTrack.fadeOut
              : DEFAULT_CROSSFADE_TICKS_113C
          const fromGain =
            prevDeck.fade !== null
              ? prevDeck.gainValue
              : prevDeck.gainValue > 0
                ? prevDeck.gainValue
                : this.computeTrackTargetGain(prevTrack ?? track)
          prevDeck.fade = {
            fromGain,
            toGain: 0,
            elapsedTicks: 0,
            durationTicks: fadeOutTicks,
            pauseOnComplete: true,
          }
        }
      } else {
        prevDeck.fade = null
        prevDeck.gainValue = 0
        this.syncDeckGain(prevDeck)
        prevDeck.element.pause()
      }
    }

    const targetGain = this.computeTrackTargetGain(track)
    incomingDeck.fade = null
    incomingDeck.trackId = soundId
    incomingDeck.element.src = track.url
    incomingDeck.element.loop = opts?.loop ?? track.loop
    const seekSec = this.resolveSeekSeconds(track, opts)
    try {
      incomingDeck.element.currentTime = seekSec
    } catch {
      /* ignore browser InvalidStateError when seeking before metadata is loaded */
    }

    if (opts?.immediate === true || !wasPlaying || track.fadeIn <= 0) {
      incomingDeck.gainValue = targetGain
      this.syncDeckGain(incomingDeck)
    } else {
      const fadeInTicks = track.fadeIn
      incomingDeck.gainValue = 0
      this.syncDeckGain(incomingDeck)
      incomingDeck.fade = {
        fromGain: 0,
        toGain: targetGain,
        elapsedTicks: 0,
        durationTicks: fadeInTicks,
        pauseOnComplete: false,
      }
    }

    this.activeDeck = incomingDeck
    this.activeTrackId = soundId
    if (opts?.onEnded !== undefined) {
      this.stingerOnEnded = opts.onEnded
    }

    const playPromise = incomingDeck.element.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (this.activeDeck === incomingDeck) {
          this.pendingResumeDeck = incomingDeck
        }
      })
    }
    return true
  }

  playSong(soundId: number, opts?: PlayTrackOptions): boolean {
    return this.playTrack(soundId, opts)
  }

  playMusic(soundId: number, opts?: PlayTrackOptions): boolean {
    return this.playTrack(soundId, opts)
  }

  play(soundId: number, opts?: PlayTrackOptions): boolean {
    return this.playTrack(soundId, opts)
  }

  playOptionsMusic(): boolean {
    this.savedBgmState = null
    this.stingerOnEnded = null
    return this.playTrack(MUSIC_OPTIONS_SOUND_ID_113C)
  }

  playFrontendMusic(): boolean {
    return this.playTitleMusic()
  }

  playTitleMusic(): boolean {
    this.savedBgmState = null
    this.stingerOnEnded = null
    return this.playTrack(MUSIC_TITLE_SOUND_ID_113C)
  }

  playActIntroMusic(act: number): boolean {
    this.savedBgmState = null
    this.stingerOnEnded = null
    const targetId = act === 4 || act === 5 ? MUSIC_ACT5_INTRO_SOUND_ID_113C : MUSIC_OPTIONS_SOUND_ID_113C
    return this.playTrack(targetId)
  }

  playActIntro(act: number): boolean {
    return this.playActIntroMusic(act)
  }

  onEnterArea(levelId: number, opts?: PlayTrackOptions): boolean {
    const env = getSoundEnvironForLevel113c(levelId)
    if (env.song <= 0) {
      return false
    }
    this.savedBgmState = null
    this.stingerOnEnded = null
    const effectiveOpts =
      this.activeTrackId === MUSIC_TITLE_SOUND_ID_113C && opts?.immediate === undefined
        ? { ...opts, immediate: true }
        : opts
    return this.playTrack(env.song, effectiveOpts)
  }

  enterArea(levelId: number, opts?: PlayTrackOptions): boolean {
    return this.onEnterArea(levelId, opts)
  }

  setLevel(levelId: number, opts?: PlayTrackOptions): boolean {
    return this.onEnterArea(levelId, opts)
  }

  playLevelMusic(levelId: number, blockIndex?: number): boolean {
    return this.onEnterArea(levelId, blockIndex !== undefined ? { blockIndex } : undefined)
  }

  playQuestStinger(soundId: number, onEnded?: () => void): boolean {
    if (
      typeof soundId !== 'number' ||
      !Number.isInteger(soundId) ||
      soundId < MUSIC_QUEST_STINGER_RANGE_113C[0] ||
      soundId > MUSIC_QUEST_STINGER_RANGE_113C[1]
    ) {
      return false
    }
    const track = getMusicTrack113c(soundId)
    if (track === undefined) return false

    if (
      this.activeDeck !== null &&
      this.activeTrackId >= 4657 &&
      this.activeTrackId <= 4684
    ) {
      this.savedBgmState = {
        soundId: this.activeTrackId,
        resumeTimeSec: this.activeDeck.element.currentTime,
      }
    }
    return this.playTrack(soundId, {
      loop: false,
      ...(onEnded !== undefined ? { onEnded } : {}),
    })
  }

  private stepOneTick(): void {
    if (this.deckA === null || this.deckB === null) return
    for (const slot of [this.deckA, this.deckB]) {
      if (!slot.element.paused && typeof slot.element.advance === 'function') {
        slot.element.advance(1 / 25)
      }
      if (slot.fade !== null) {
        slot.fade.elapsedTicks += 1
        if (slot.fade.elapsedTicks >= slot.fade.durationTicks) {
          const pauseOnComplete = slot.fade.pauseOnComplete
          slot.gainValue = slot.fade.toGain
          slot.fade = null
          this.syncDeckGain(slot)
          if (pauseOnComplete) {
            slot.element.pause()
          }
        } else {
          const alpha = slot.fade.elapsedTicks / slot.fade.durationTicks
          slot.gainValue = slot.fade.fromGain + (slot.fade.toGain - slot.fade.fromGain) * alpha
          this.syncDeckGain(slot)
        }
      }
    }
  }

  tick(ticks = 1): void {
    const count = Number.isFinite(ticks) && ticks > 0 ? Math.max(1, Math.round(ticks)) : 1
    for (let i = 0; i < count; i += 1) {
      this.stepOneTick()
    }
  }

  soundTick(_gameTick?: number): void {
    this.stepOneTick()
  }

  update(_gameTick?: number): void {
    this.stepOneTick()
  }

  unlock(): void {
    this.ensureGraph()
    this.applySettings()
    const deck =
      this.pendingResumeDeck !== null && this.pendingResumeDeck === this.activeDeck
        ? this.pendingResumeDeck
        : this.activeDeck !== null && this.activeDeck.trackId > 0 && this.activeDeck.element.paused
          ? this.activeDeck
          : null
    if (deck !== null) {
      this.pendingResumeDeck = null
      const p = deck.element.play()
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          if (this.activeDeck === deck) {
            this.pendingResumeDeck = deck
          }
        })
      }
    }
  }

  onUnlock(): void {
    this.unlock()
  }

  applySettings(): void {
    this.refreshVolumesFromOptions()
    if (this.deckA === null || this.deckB === null) return
    for (const slot of [this.deckA, this.deckB]) {
      const track = getMusicTrack113c(slot.trackId)
      if (track !== undefined && slot === this.activeDeck && slot.fade === null && !slot.element.paused) {
        slot.gainValue = this.computeTrackTargetGain(track)
      }
      this.syncDeckGain(slot)
    }
  }

  setMusicVolume(v: number): void {
    this.musicVolume = clamp01(v)
    this.applySettings()
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = clamp01(v)
    this.applySettings()
  }

  setMasterVolume(v: number): void {
    this.masterVolume = clamp01(v)
    this.applySettings()
  }

  setMuted(muted: boolean): void {
    this.muted = Boolean(muted)
    this.applySettings()
  }

  stop(): void {
    this.savedBgmState = null
    this.stingerOnEnded = null
    this.pendingResumeDeck = null
    this.activeTrackId = 0
    this.activeDeck = null
    if (this.deckA === null || this.deckB === null) return
    for (const slot of [this.deckA, this.deckB]) {
      slot.fade = null
      slot.gainValue = 0
      slot.trackId = 0
      this.syncDeckGain(slot)
      slot.element.pause()
    }
  }

  stopAll(): void {
    this.stop()
  }
}

export const MusicStreamer113c = MusicStreamer
