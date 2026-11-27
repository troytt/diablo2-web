/**
 * M21-P3 (#945) — Tier 4 end-to-end scenarios (`T4-P3-01`..`T4-P3-04`):
 * - T4-P3-01: Frontend title → character select → lobby (`music_options` 4668 continuous) →
 *   enter Act 1 Rogue Encampment (level 1, Song 4675) dual-deck crossfade with zero `decodeAudioData`.
 * - T4-P3-02: Act 5 siege multi-level traversal (Harrogath 109 → Bloody Foothills 110 →
 *   Frigid Highlands 111 → Arreat Plateau 112): town→siege crossfades once, then adjacent levels
 *   sharing Song 4682 (`music_xsiege`) keep playing continuously without restarting.
 * - T4-P3-03: Town ↔ wilderness round-trip with `Block 1..3` offset progression.
 * - T4-P3-04: Combined `AudioRuntime113c` + `MusicStreamer` + `SfxChunkLoader`: first-screen BGM +
 *   `sfx-core.bin` UI clicks coexist on one `FakeAudioContext` with ≤ 2 first-screen audio assets
 *   and zero `decodeAudioData` on BGM.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  PRODUCT,
  getOracle113c,
  loadProductModule,
  requireExport,
  type Oracle113c,
} from './harness-113c.ts'
import {
  FakeAudioContext,
  FakeGainNode,
  FakeHTMLAudioElement,
  FakeMediaElementAudioSourceNode,
  FakePackServer,
  flushAsync,
  installFakeAudioContext,
} from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const S3 = '#945 Tier-4 BGM scenarios'

async function createStreamerHarness() {
  const m = await loadProductModule(PRODUCT.musicStreamer, S3)
  const Ctor = (m.MusicStreamer ?? m.MusicStreamer113c) as
    | (new (opts?: Record<string, unknown>) => Record<string, unknown>)
    | undefined
  if (typeof Ctor !== 'function') {
    throw new Error(`[${S3}] ${PRODUCT.musicStreamer} does not export MusicStreamer`)
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

  const harness = {
    raw,
    ctx,
    musicGain,
    masterGain,
    playTrack(soundId: number, opts?: { blockIndex?: number; immediate?: boolean }): void {
      if (typeof raw.playTrack === 'function') (raw.playTrack as (id: number, o?: unknown) => void)(soundId, opts)
      else if (typeof raw.playSong === 'function') (raw.playSong as (id: number, o?: unknown) => void)(soundId, opts)
      else if (typeof raw.playMusic === 'function') (raw.playMusic as (id: number, o?: unknown) => void)(soundId, opts)
      else if (typeof raw.play === 'function') (raw.play as (id: number, o?: unknown) => void)(soundId, opts)
      else throw new Error(`[${S3}] MusicStreamer has no playTrack/playSong/playMusic/play method`)
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
      else throw new Error(`[${S3}] MusicStreamer has no onEnterArea(levelId) method`)
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

describe('M21-P3 #945 — Tier 4 realistic BGM streaming scenarios', () => {
  it('[T4-P3-01] Title screen -> Character Select -> Lobby (continuous music_options 4668) -> Enter Act 1 Rogue Encampment (crossfade to 4673 music_town_1)', async () => {
    uninstallAudio = installFakeAudioContext()
    const sh = await createStreamerHarness()
    const lvl1Song = oracle.soundEnviron[oracle.levels.get(1)!.soundEnv]!.song
    expect(lvl1Song).toBe(4673)

    // Title screen starts music_options (4668)
    sh.playOptionsMusic()
    expect(sh.activeSongId()).toBe(4668)
    const deck0 = sh.decks().find((d) => !d.paused)!
    expect(deck0).toBeDefined()
    deck0.currentTime = 14.2
    const initialPlays = deck0.playCalls

    // Navigating to character select and lobby keeps music_options playing without restarting
    sh.playOptionsMusic()
    sh.playOptionsMusic()
    expect(deck0.playCalls).toBe(initialPlays)
    expect(deck0.currentTime).toBeCloseTo(14.2, 2)

    // Enter Act 1 Rogue Encampment (level 1 -> Song 4673 music_town_1)
    sh.onEnterArea(1)
    expect(sh.activeSongId()).toBe(lvl1Song)
    const otherDeck = sh.decks().find((d) => d !== deck0)!
    expect(otherDeck.playCalls).toBe(1)
    sh.tick(200)
    expect(deck0.paused).toBe(true)
    expect(otherDeck.paused).toBe(false)
    expect(sh.ctx.decodes.length).toBe(0)
  })

  it('[T4-P3-02] Act 5 multi-level siege walk (109 Harrogath -> 110 Bloody Foothills -> 111 Frigid Highlands -> 112 Arreat Plateau): continuous same-Song playback across 110..112', async () => {
    uninstallAudio = installFakeAudioContext()
    const sh = await createStreamerHarness()

    const song109 = oracle.soundEnviron[oracle.levels.get(109)!.soundEnv]!.song
    const song110 = oracle.soundEnviron[oracle.levels.get(110)!.soundEnv]!.song
    const song111 = oracle.soundEnviron[oracle.levels.get(111)!.soundEnv]!.song
    const song112 = oracle.soundEnviron[oracle.levels.get(112)!.soundEnv]!.song
    expect(song109).not.toBe(song110)
    expect(song110).toBe(song111)
    expect(song111).toBe(song112)

    sh.onEnterArea(109)
    sh.tick(150)
    expect(sh.activeSongId()).toBe(song109)

    // Step out of Harrogath into Bloody Foothills (110): crossfades to siege song
    sh.onEnterArea(110)
    sh.tick(150)
    expect(sh.activeSongId()).toBe(song110)
    const siegeDeck = sh.decks().find((d) => !d.paused)!
    expect(siegeDeck).toBeDefined()
    siegeDeck.currentTime = 88.4
    const playsAt110 = siegeDeck.playCalls

    // Walk into Frigid Highlands (111) and Arreat Plateau (112): zero restarts!
    sh.onEnterArea(111)
    sh.tick(25)
    expect(siegeDeck.playCalls).toBe(playsAt110)
    expect(siegeDeck.currentTime).toBeGreaterThanOrEqual(88.4)

    sh.onEnterArea(112)
    sh.tick(25)
    expect(siegeDeck.playCalls).toBe(playsAt110)
    expect(sh.activeSongId()).toBe(song112)
  })

  it('[T4-P3-03] Town <-> wilderness transitions advance or seek across Block offsets of music_wilderness (4679, nBlocks=2) and music_town_1 (4673, nBlocks=1)', async () => {
    uninstallAudio = installFakeAudioContext()
    const sh = await createStreamerHarness()
    const wildRow = oracle.sounds[4679]!
    expect(wildRow.nBlocks).toBe(2)

    for (let blockIdx = 0; blockIdx < wildRow.nBlocks; blockIdx += 1) {
      sh.playTrack(4679, { blockIndex: blockIdx + 1 })
      sh.tick(150)
      const active = sh.decks().find((d) => !d.paused)!
      const expectedFrames = [wildRow.block1, wildRow.block2, wildRow.block3][blockIdx]!
      expect(active.seekHistory.some((s) => Math.abs(s - expectedFrames / 22050) < 0.05)).toBe(true)
      // Step into town (level 1 -> 4673) so the next iteration switches back to 4679
      sh.onEnterArea(1)
      sh.tick(150)
    }
  })

  it('[T4-P3-04] First-screen budget & dual-path coexistence: sfx-core.bin (1 pack fetch) + BGM stream (1 <audio> src) with zero decodeAudioData on music', async () => {
    uninstallAudio = installFakeAudioContext()
    const idxMod = await loadProductModule(PRODUCT.sfxPackIndex, S3)
    const packs = requireExport<readonly { readonly packId: string; readonly url: string }[]>(
      idxMod,
      'SFX_PACKS_113C',
      PRODUCT.sfxPackIndex,
      S3,
    )
    const loaderMod = await loadProductModule(PRODUCT.sfxChunkLoader, S3)
    const LoaderCtor = requireExport<new (o: Record<string, unknown>) => Record<string, unknown>>(
      loaderMod,
      'SfxChunkLoader',
      PRODUCT.sfxChunkLoader,
      S3,
    )
    const rtMod = await loadProductModule(PRODUCT.audioRuntime, S3)
    const RuntimeCtor = requireExport<new (o: Record<string, unknown>) => Record<string, unknown>>(
      rtMod,
      'AudioRuntime113c',
      PRODUCT.audioRuntime,
      S3,
    )

    const srv = new FakePackServer(packs)
    const loader = new LoaderCtor({ packs, fetchPack: srv.fetchPack })
    const rt = new RuntimeCtor({
      rng: new D2Rng(99),
      listenerPos: () => ({ x: 0, y: 0 }),
      loader,
      settings: { masterVolume: () => 0.8, muted: () => false },
    })
    if (typeof rt.unlock === 'function') (rt.unlock as () => void)()

    const sh = await createStreamerHarness()
    sh.playOptionsMusic()
    // Play a UI button click from sfx-core.bin (row 4 cursor_button_click)
    if (typeof rt.playUi === 'function') (rt.playUi as (id: number) => number)(4)
    await flushAsync()
    if (typeof rt.soundTick === 'function') (rt.soundTick as (t: number) => boolean)(1)

    // Exactly 1 .bin pack request on the first screen (sfx-core) + 1 BGM stream URL
    expect(srv.calls.map((c) => c.packId)).toEqual(['sfx-core'])
    expect(sh.ctx.decodes.length).toBe(0)
  })
})
