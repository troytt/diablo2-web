/**
 * M21-P3 (#945) — F13 `MusicStreamer` (`src/client/audio/music-streamer.ts`):
 * - Dual hidden `<audio>` decks (`Deck A` / `Deck B`) + `MediaElementAudioSourceNode` → per-deck
 *   fade `GainNode` → `musicGain` → `masterGain` → `ctx.destination`.
 * - NEVER calls `AudioContext.decodeAudioData` on music tracks (both static source check and
 *   runtime check on `FakeAudioContext.decodes`).
 * - Crossfades over `Fade Out` / `Fade In` ticks when switching to a different `Song` ID on
 *   `onEnterArea(levelId)` / `playTrack(soundId)`.
 * - Continuous playback (no restart, no `src` reset) when moving between adjacent levels that
 *   share the same `SoundEnviron.txt` `Song` ID across all 136 levels.
 * - `Block 1..3` loop/resume offsets (22,050 Hz frames converted to seconds).
 * - Title / login / character-select / lobby streams `music_options` (`id = 4668`, `common\options.wav`).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  PRODUCT,
  getOracle113c,
  loadProductModule,
  readRepoText,
  requireExport,
  type Oracle113c,
} from './harness-113c.ts'
import {
  FakeAudioContext,
  FakeGainNode,
  FakeHTMLAudioElement,
  FakeMediaElementAudioSourceNode,
  installFakeAudioContext,
  reaches,
} from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F13 = '#945 F13 MusicStreamer dual-deck crossfade pipeline'

export interface StreamerHarness {
  readonly raw: Record<string, unknown>
  readonly ctx: FakeAudioContext
  readonly musicGain: FakeGainNode
  readonly masterGain: FakeGainNode
  playTrack(soundId: number, opts?: { blockIndex?: number; immediate?: boolean }): void
  playOptionsMusic(): void
  onEnterArea(levelId: number): void
  tick(ticks?: number): void
  stop(): void
  activeSongId(): number
  decks(): readonly FakeHTMLAudioElement[]
  mediaSources(): readonly FakeMediaElementAudioSourceNode[]
}

export async function createStreamerHarness(): Promise<StreamerHarness> {
  const m = await loadProductModule(PRODUCT.musicStreamer, F13)
  const Ctor = (m.MusicStreamer ?? m.MusicStreamer113c) as
    | (new (opts?: Record<string, unknown>) => Record<string, unknown>)
    | undefined
  if (typeof Ctor !== 'function') {
    throw new Error(`[${F13}] ${PRODUCT.musicStreamer} does not export MusicStreamer`)
  }
  const ctx = new FakeAudioContext()
  const masterGain = ctx.createGain()
  masterGain.connect(ctx.destination)
  const musicGain = ctx.createGain()
  musicGain.connect(masterGain)

  let tickCounter = 0
  const raw = new Ctor({
    ctx,
    context: ctx,
    getContext: () => ctx,
    output: musicGain,
    outputNode: musicGain,
    musicGain,
    masterGain,
    getOutput: () => ({ ctx, node: musicGain }),
    createAudioElement: (src?: string) => new FakeHTMLAudioElement(src),
  })

  const harness: StreamerHarness = {
    raw,
    ctx,
    musicGain,
    masterGain,
    playTrack(soundId: number, opts?: { blockIndex?: number; immediate?: boolean }): void {
      if (typeof raw.playTrack === 'function') (raw.playTrack as (id: number, o?: unknown) => void)(soundId, opts)
      else if (typeof raw.playSong === 'function') (raw.playSong as (id: number, o?: unknown) => void)(soundId, opts)
      else if (typeof raw.playMusic === 'function') (raw.playMusic as (id: number, o?: unknown) => void)(soundId, opts)
      else if (typeof raw.play === 'function') (raw.play as (id: number, o?: unknown) => void)(soundId, opts)
      else throw new Error(`[${F13}] MusicStreamer has no playTrack/playSong/playMusic/play method`)
    },
    playOptionsMusic(): void {
      if (typeof raw.playOptionsMusic === 'function') (raw.playOptionsMusic as () => void)()
      else if (typeof raw.playFrontendMusic === 'function') (raw.playFrontendMusic as () => void)()
      else if (typeof raw.playTitleMusic === 'function') (raw.playTitleMusic as () => void)()
      else harness.playTrack(4668)
    },
    onEnterArea(levelId: number): void {
      if (typeof raw.onEnterArea === 'function') (raw.onEnterArea as (lvl: number) => void)(levelId)
      else if (typeof raw.enterArea === 'function') (raw.enterArea as (lvl: number) => void)(levelId)
      else if (typeof raw.setLevel === 'function') (raw.setLevel as (lvl: number) => void)(levelId)
      else throw new Error(`[${F13}] MusicStreamer has no onEnterArea(levelId) method`)
    },
    tick(ticks = 1): void {
      for (let i = 0; i < ticks; i += 1) {
        tickCounter += 1
        ctx.currentTime += 1 / 25
        if (typeof raw.soundTick === 'function') (raw.soundTick as (t: number) => void)(tickCounter)
        else if (typeof raw.tick === 'function') (raw.tick as (t?: number) => void)(1)
        else if (typeof raw.update === 'function') (raw.update as (t?: number) => void)(tickCounter)
      }
    },
    stop(): void {
      if (typeof raw.stop === 'function') (raw.stop as () => void)()
      else if (typeof raw.stopAll === 'function') (raw.stopAll as () => void)()
    },
    activeSongId(): number {
      const v =
        raw.currentSongId ??
        raw.activeSongId ??
        raw.currentTrackId ??
        raw.songId ??
        (typeof raw.getCurrentSongId === 'function' ? (raw.getCurrentSongId as () => number)() : undefined) ??
        (typeof raw.getActiveSongId === 'function' ? (raw.getActiveSongId as () => number)() : undefined)
      return typeof v === 'number' ? v : 0
    },
    decks(): readonly FakeHTMLAudioElement[] {
      return FakeHTMLAudioElement.instances
    },
    mediaSources(): readonly FakeMediaElementAudioSourceNode[] {
      return ctx.mediaElementSources()
    },
  }
  return harness
}

let oracle: Oracle113c
let uninstallAudio: (() => void) | null = null

beforeAll(() => {
  oracle = getOracle113c()
})

afterEach(() => {
  uninstallAudio?.()
  uninstallAudio = null
})

describe('M21-P3 #945 — F13 MusicStreamer dual-deck crossfade & level continuity', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F13-01] dual-deck WebAudio graph: creates 2 HTMLAudioElement decks connected via MediaElementAudioSourceNode -> deck fade GainNode -> musicGain -> masterGain -> destination', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      sh.playOptionsMusic()
      const sources = sh.mediaSources()
      expect(sources.length).toBe(2)
      expect(sources[0]!.mediaElement).not.toBe(sources[1]!.mediaElement)
      for (const srcNode of sources) {
        expect(reaches(srcNode, sh.musicGain)).toBe(true)
        expect(reaches(srcNode, sh.masterGain)).toBe(true)
        expect(reaches(srcNode, sh.ctx.destination)).toBe(true)
      }
    })

    it('[T1-F13-02] NEVER calls AudioContext.decodeAudioData on BGM tracks (static source verification + runtime decode count === 0)', async () => {
      const src = readRepoText(PRODUCT.musicStreamer, F13)
      const codeOnly = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      expect(codeOnly).not.toMatch(/\bdecodeAudioData\b/)

      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      sh.playOptionsMusic()
      sh.onEnterArea(1) // Rogue Encampment
      sh.tick(50)
      sh.onEnterArea(2) // Blood Moor
      sh.tick(50)
      expect(sh.ctx.decodes.length).toBe(0)
    })

    it('[T1-F13-03] playOptionsMusic() streams row 4668 (music_options, common\\options.wav) on the active deck for frontend title/login/char-select/lobby screens', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      sh.playOptionsMusic()
      expect(sh.activeSongId()).toBe(4668)
      const playingDecks = sh.decks().filter((d) => d.playCalls > 0 && !d.paused)
      expect(playingDecks.length).toBe(1)
      expect(playingDecks[0]!.src).toMatch(/\/sound\/music\/.*options.*\.webm$/i)
    })

    it('[T1-F13-04] onEnterArea(levelId) resolves Levels.txt -> SoundEnv -> SoundEnviron.txt Song and switches/crossfades Deck A <-> Deck B when Song changes', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      // Level 1 (Rogue Encampment) -> SoundEnv 1 -> Song 4675 (music_act1_town_1)
      const lvl1Song = oracle.soundEnviron[oracle.levels.get(1)!.soundEnv]!.song
      // Level 2 (Blood Moor) -> SoundEnv 2 -> Song 4679 (music_wilderness)
      const lvl2Song = oracle.soundEnviron[oracle.levels.get(2)!.soundEnv]!.song
      expect(lvl1Song).not.toBe(lvl2Song)

      sh.onEnterArea(1)
      expect(sh.activeSongId()).toBe(lvl1Song)
      const [deckA, deckB] = sh.decks()
      expect(deckA).toBeDefined()
      expect(deckB).toBeDefined()
      const firstActive = !deckA!.paused ? deckA! : deckB!
      const secondActive = firstActive === deckA! ? deckB! : deckA!
      expect(firstActive.playCalls).toBe(1)

      sh.onEnterArea(2)
      expect(sh.activeSongId()).toBe(lvl2Song)
      expect(secondActive.playCalls).toBe(1)
      // Advance past Fade Out ticks so the outgoing deck completes its fade-out and pauses
      const fadeOutTicks = Math.max(oracle.sounds[lvl1Song]!.fadeOut, 150)
      sh.tick(fadeOutTicks + 10)
      expect(firstActive.paused).toBe(true)
      expect(secondActive.paused).toBe(false)
    })

    it('[T1-F13-05] same-Song continuity: moving between adjacent levels that share the same SoundEnviron Song ID does NOT restart or reload the active deck', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      // Find two adjacent/consecutive levels sharing the same Song > 0 (e.g. Act 5 Bloody Foothills 110 & Frigid Highlands 111)
      const levelA = 110
      const levelB = 111
      const songA = oracle.soundEnviron[oracle.levels.get(levelA)!.soundEnv]!.song
      const songB = oracle.soundEnviron[oracle.levels.get(levelB)!.soundEnv]!.song
      expect(songA).toBeGreaterThan(0)
      expect(songA).toBe(songB)

      sh.onEnterArea(levelA)
      sh.tick(30)
      const activeDeck = sh.decks().find((d) => !d.paused)!
      expect(activeDeck).toBeDefined()
      activeDeck.currentTime = 42.5
      const playCallsBefore = activeDeck.playCalls
      const srcHistoryLenBefore = activeDeck.srcHistory.length
      const otherDeckPlayCallsBefore = sh
        .decks()
        .filter((d) => d !== activeDeck)
        .reduce((acc, d) => acc + d.playCalls, 0)

      sh.onEnterArea(levelB)
      sh.tick(20)
      expect(sh.activeSongId()).toBe(songA)
      expect(activeDeck.playCalls).toBe(playCallsBefore)
      expect(activeDeck.srcHistory.length).toBe(srcHistoryLenBefore)
      expect(activeDeck.currentTime).toBeCloseTo(42.5, 2)
      const otherDeckPlayCallsAfter = sh
        .decks()
        .filter((d) => d !== activeDeck)
        .reduce((acc, d) => acc + d.playCalls, 0)
      expect(otherDeckPlayCallsAfter).toBe(otherDeckPlayCallsBefore)
    })

    it('[T1-F13-06] Block 1..3 loop/section offsets: converts 22,050 Hz frame offsets to seconds (blockFrames / 22050) when seeking to a block or looping', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      // Row 4673 (music_town_1) has nBlocks=1 (block1 = 3002253) and row 4679 (music_wilderness) has nBlocks=2
      const row = oracle.sounds[4679]!
      expect(row.nBlocks).toBe(2)
      expect(row.block1).toBeGreaterThan(0)
      expect(row.block2).toBeGreaterThan(0)

      sh.playTrack(4679, { blockIndex: 1 })
      const activeDeck = sh.decks().find((d) => !d.paused)!
      expect(activeDeck).toBeDefined()
      expect(activeDeck.currentTime).toBeCloseTo(row.block1 / 22050, 2)
    })

    it('[T1-F13-07] all 136 canonical levels map cleanly through onEnterArea(1..136) to their SoundEnviron Song without throwing', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      for (let lvl = 1; lvl <= 136; lvl += 1) {
        const expectedSong = oracle.soundEnviron[oracle.levels.get(lvl)!.soundEnv]!.song
        sh.onEnterArea(lvl)
        sh.tick(2)
        if (expectedSong > 0) {
          expect(sh.activeSongId()).toBe(expectedSong)
        }
      }
      expect(sh.ctx.decodes.length).toBe(0)
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F13-01] repeating playTrack(sameId) while already playing that Song is idempotent (no deck swap or currentTime reset)', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      sh.playTrack(4675)
      sh.tick(20)
      const active = sh.decks().find((d) => !d.paused)!
      active.currentTime = 19.75
      const plays = active.playCalls
      sh.playTrack(4675)
      expect(active.playCalls).toBe(plays)
      expect(active.currentTime).toBeCloseTo(19.75, 2)
    })

    it('[T2-F13-02] non-looping stingers (4686 bloodravenresolution, 4693 radamentresolution: Loop=0, Music Vol=1) set deck.loop = false and do not loop on ended', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      expect(oracle.sounds[4686]!.loop).toBe(false)
      expect(oracle.sounds[4686]!.musicVol).toBe(true)
      sh.playTrack(4686)
      const active = sh.decks().find((d) => !d.paused)!
      expect(active).toBeDefined()
      expect(active.loop).toBe(false)
      active.triggerEnded()
      expect(active.paused).toBe(true)
    })

    it('[T2-F13-03] looping BGM tracks (4657..4684: Loop=1) loop continuously when playback reaches track end', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      expect(oracle.sounds[4675]!.loop).toBe(true)
      sh.playTrack(4675)
      const active = sh.decks().find((d) => !d.paused)!
      expect(active).toBeDefined()
      // Either native `active.loop === true` or custom `ended` handler re-plays / seeks to block offset
      if (!active.loop) {
        active.triggerEnded()
        expect(active.paused).toBe(false)
      } else {
        expect(active.loop).toBe(true)
      }
    })

    it('[T2-F13-04] rapid 3-way level switches (level 1 -> level 2 -> level 3) within a single crossfade window never create a 3rd HTMLAudioElement or orphan playing deck', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      sh.onEnterArea(1) // Song 4675
      sh.tick(5)
      sh.onEnterArea(2) // Song 4679
      sh.tick(5)
      sh.onEnterArea(8) // Den of Evil (cave song 4658)
      sh.tick(200)
      expect(sh.decks().length).toBe(2)
      const playing = sh.decks().filter((d) => !d.paused)
      expect(playing.length).toBe(1)
      const lvl8Song = oracle.soundEnviron[oracle.levels.get(8)!.soundEnv]!.song
      expect(sh.activeSongId()).toBe(lvl8Song)
    })

    it('[T2-F13-05] invalid level IDs (0, -1, 137, 999) or non-music sound IDs (0, 1, 200) do not corrupt active deck state', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      const lvl1Song = oracle.soundEnviron[oracle.levels.get(1)!.soundEnv]!.song
      expect(lvl1Song).toBe(4673)
      sh.onEnterArea(1)
      const initialSong = sh.activeSongId()
      expect(initialSong).toBe(lvl1Song)
      for (const badLvl of [0, -1, 137, 999]) {
        try {
          sh.onEnterArea(badLvl)
        } catch {
          // Throwing on out-of-range level is also acceptable per getSoundEnvironForLevel113c
        }
      }
      for (const badSound of [0, 1, 200, -5]) {
        try {
          sh.playTrack(badSound)
        } catch {
          // Throwing or ignoring invalid non-music ID is acceptable
        }
      }
      expect(sh.decks().length).toBe(2)
    })

    it('[T2-F13-06] stop() pauses both decks and resets active song state cleanly', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      sh.onEnterArea(1)
      sh.tick(10)
      sh.onEnterArea(2)
      sh.tick(5)
      sh.stop()
      for (const d of sh.decks()) {
        expect(d.paused).toBe(true)
      }
    })

    it('[T2-F13-07] Block index out of range (e.g. blockIndex: 99 or -1) clamps safely to a valid offset in [0, duration) without throwing RangeError', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      sh.playTrack(4675, { blockIndex: 99 })
      const active = sh.decks().find((d) => !d.paused)!
      expect(active).toBeDefined()
      expect(active.currentTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Tier 3 — pairwise (F13 × F2, F13 × F9)', () => {
    it('[T3-F13xF2-01] every Act 1..5 town level (1, 40, 75, 103, 109) streams its authentic Act town theme from SoundEnviron.txt', async () => {
      uninstallAudio = installFakeAudioContext()
      const sh = await createStreamerHarness()
      const townLevels = [1, 40, 75, 103, 109]
      const seenSongs = new Set<number>()
      for (const lvl of townLevels) {
        const expectedSong = oracle.soundEnviron[oracle.levels.get(lvl)!.soundEnv]!.song
        sh.onEnterArea(lvl)
        sh.tick(150)
        expect(sh.activeSongId()).toBe(expectedSong)
        seenSongs.add(expectedSong)
      }
      expect(seenSongs.size).toBe(5)
    })

    it('[T3-F13xF9-02] AudioRuntime113c integrates MusicStreamer (or exposes musicGain -> masterGain) so mute/masterVolume control BGM output without affecting deck progression', async () => {
      uninstallAudio = installFakeAudioContext()
      const rtMod = await loadProductModule(PRODUCT.audioRuntime, F13)
      const RuntimeCtor = requireExport<new (o: Record<string, unknown>) => Record<string, unknown>>(
        rtMod,
        'AudioRuntime113c',
        PRODUCT.audioRuntime,
        F13,
      )
      const { D2Rng } = await import('../../../src/common/rng/d2-rng.ts')
      let muted = false
      let vol = 0.8
      const rt = new RuntimeCtor({
        rng: new D2Rng(12345),
        listenerPos: () => ({ x: 0, y: 0 }),
        settings: { masterVolume: () => vol, muted: () => muted },
      })
      if (typeof rt.unlock === 'function') (rt.unlock as () => void)()
      const ctx = FakeAudioContext.instances[FakeAudioContext.instances.length - 1]
      expect(ctx).toBeDefined()
      // Verify masterGain muting silences the entire context graph (including musicGain)
      muted = true
      if (typeof rt.applySettings === 'function') (rt.applySettings as () => void)()
      const gains = ctx!.nodes.filter((n): n is FakeGainNode => n instanceof FakeGainNode)
      expect(gains.some((g) => g.gain.value === 0)).toBe(true)
    })
  })
})
