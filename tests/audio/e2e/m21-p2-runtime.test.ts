/**
 * M21-P2 (#944) — F9 audio graph, `WebAudioSoundVoices` and `AudioRuntime113c`.
 *
 * Requirements (request R2, PROJECT.md § Architecture / F9 / override v, reland_plan §C.2/§E.2):
 * - graph: voices → sfxGain → masterGain → destination, musicGain → masterGain;
 * - ONE session record layer (`AudioRuntime113c.records`, shared later by #945–#948);
 * - SoundTick: update()+endTick() once per NEW game tick, no catch-up, throws on regression;
 * - voice start offset is measured in SOURCE frames (22,050 Hz), not the decoded buffer's rate;
 * - `masterVolume` (0..1) → record-layer master `Math.round(v·100)` (D2Client UpdateChannel
 *   `0x6fb0d26a–0x6fb0d27b`: vol = vol·master/100); `audioMuted` → masterGain 0 ONLY (records,
 *   timers and RNG draws unchanged);
 * - background packs are prefetched after game entry (D4).
 * Doubles: the browser only (`FakeAudioContext` installed as `globalThis.AudioContext`,
 * `FakePackServer` for fetch) and the record layer's voice sink (`RecordingVoices`). The reference
 * used for the master mapping is the PRODUCT's own `SoundRecords113c` replaying the exact calls the
 * runtime made — no record-layer logic is re-implemented here.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  PRODUCT,
  R2_FIRST_SCREEN_PREFIXES_113C,
  REPO_ROOT,
  RecordingVoices,
  getOracle113c,
  loadProductModule,
  oracleSampleFacts,
  oracleStream0Rows,
  requireExport,
  sha256Hex,
  type OracleSoundRow,
} from './harness-113c.ts'
import {
  FakeAudioBuffer,
  FakeAudioBufferSourceNode,
  FakeAudioContext,
  FakeChannelMergerNode,
  FakeGainNode,
  FakePackServer,
  downstream,
  flushAsync,
  installFakeAudioContext,
  reaches,
} from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F9 = '#944 F9 audio graph / WebAudioSoundVoices / AudioRuntime113c'

// ── Contracts (reland_plan §E.2) ─────────────────────────────────────────────────────────────────
type TupleC = readonly [packId: string, byteOffset: number, byteLength: number, sampleRate: number, frames: number, channels: number]
interface PackMetaC {
  readonly packId: string
  readonly url: string
  readonly tier: string
}
interface VoicesC {
  start(voice: number, soundId: number, loop: boolean, offsetFrames: number): void
  setGains(voice: number, left: number, right: number): void
  stop(voice: number): void
  stopAll(): void
}
type VoicesCtor = new (
  output: () => { readonly ctx: FakeAudioContext; readonly node: FakeGainNode } | null,
  buffers: (id: number) => { readonly buffer: FakeAudioBuffer; readonly sourceSampleRate: number } | undefined,
) => VoicesC
interface RecordViewC {
  readonly handle: number
  readonly id: number
  readonly state: number
}
interface SoundRecordsC {
  play(id: number, o?: Record<string, unknown>): number
  update(): void
  endTick(): void
  stopAll(): void
  setVoices(v: unknown): void
  records(): RecordViewC[]
  readonly now: number
}
interface RuntimeC {
  readonly records: SoundRecordsC
  unlock(): void
  gameInit(): void
  gameExit(): void
  soundTick(gameTick: number): boolean
  playUi(soundId: number): number
  applySettings(): void
  prefetchBackground(): void
}
interface RuntimeOpts {
  readonly rng: D2Rng
  readonly listenerPos: () => { x: number; y: number }
  readonly loader?: unknown
  readonly settings: { masterVolume(): number; muted(): boolean }
}
type RuntimeCtor = new (o: RuntimeOpts) => RuntimeC
type LoaderC = { loadSoundBuffer(id: number, ctx?: unknown): Promise<FakeAudioBuffer | null>; getCachedBuffer(id: number): FakeAudioBuffer | undefined }
type LoaderCtor = new (o?: Record<string, unknown>) => LoaderC
interface RecordsModuleC {
  readonly SoundRecords113c: (new (...a: never[]) => SoundRecordsC) & { fromSounds113c(o?: Record<string, unknown>): SoundRecordsC }
}

async function voicesCtor(): Promise<VoicesCtor> {
  const m = await loadProductModule(PRODUCT.soundVoices, F9)
  return requireExport<VoicesCtor>(m, 'WebAudioSoundVoices', PRODUCT.soundVoices, F9)
}
async function runtimeCtor(): Promise<RuntimeCtor> {
  const m = await loadProductModule(PRODUCT.audioRuntime, F9)
  return requireExport<RuntimeCtor>(m, 'AudioRuntime113c', PRODUCT.audioRuntime, F9)
}
async function loaderCtor(): Promise<LoaderCtor> {
  const m = await loadProductModule(PRODUCT.sfxChunkLoader, F9)
  return requireExport<LoaderCtor>(m, 'SfxChunkLoader', PRODUCT.sfxChunkLoader, F9)
}
async function recordsModule(): Promise<RecordsModuleC> {
  const m = await loadProductModule(PRODUCT.records, F9)
  requireExport(m, 'SoundRecords113c', PRODUCT.records, F9)
  return m as unknown as RecordsModuleC
}
async function index(): Promise<{ tuples: Readonly<Record<number, TupleC>>; packs: readonly PackMetaC[] }> {
  const m = await loadProductModule(PRODUCT.sfxPackIndex, F9)
  return {
    tuples: requireExport<Readonly<Record<number, TupleC>>>(m, 'SFX_PACK_INDEX_113C', PRODUCT.sfxPackIndex, F9),
    packs: requireExport<readonly PackMetaC[]>(m, 'SFX_PACKS_113C', PRODUCT.sfxPackIndex, F9),
  }
}

async function chunkSha(id: number): Promise<string> {
  const { tuples, packs } = await index()
  const t = tuples[id]!
  const meta = packs.find((p) => p.packId === t[0])!
  const b = new Uint8Array(readFileSync(join(REPO_ROOT, 'public', meta.url.replace(/^\/+/, ''))))
  return sha256Hex(b.subarray(t[1], t[1] + t[2]))
}

interface RuntimeRig {
  readonly rt: RuntimeC
  readonly loader: LoaderC
  readonly server: FakePackServer
  readonly settings: { volume: number; muted: boolean }
  readonly listener: { x: number; y: number }
  ctx(): FakeAudioContext
}

let uninstall: (() => void) | null = null
afterEach(() => {
  uninstall?.()
  uninstall = null
})

async function runtimeRig(o: { volume?: number; muted?: boolean; seed?: readonly [number, number] } = {}): Promise<RuntimeRig> {
  uninstall?.()
  uninstall = installFakeAudioContext()
  const Loader = await loaderCtor()
  const { packs } = await index()
  const server = new FakePackServer(packs)
  const loader = new Loader({ fetchPack: server.fetchPack, getContext: () => FakeAudioContext.instances.at(-1) ?? null })
  const settings = { volume: o.volume ?? 1, muted: o.muted ?? false }
  const listener = { x: 0, y: 0 }
  const Runtime = await runtimeCtor()
  const seed = o.seed ?? [0x2c0ffee, 0x944]
  const rt = new Runtime({
    rng: new D2Rng(seed[0], seed[1]),
    listenerPos: () => listener,
    loader,
    settings: { masterVolume: () => settings.volume, muted: () => settings.muted },
  })
  return {
    rt,
    loader,
    server,
    settings,
    listener,
    ctx: () => {
      const c = FakeAudioContext.instances.at(-1)
      if (c === undefined) throw new Error('the runtime created no AudioContext (unlock() must create it)')
      return c
    },
  }
}

/** The masterGain: the unique GainNode connected straight to the destination. */
function masterGainOf(ctx: FakeAudioContext): FakeGainNode {
  const m = ctx.nodes.filter((n): n is FakeGainNode => n instanceof FakeGainNode && n.outputs.some((e) => e.node === ctx.destination))
  if (m.length !== 1) throw new Error(`expected exactly one GainNode → destination, found ${String(m.length)}`)
  return m[0]!
}

let FIRST: OracleSoundRow[] = []
let UI: OracleSoundRow[] = []

beforeAll(() => {
  getOracle113c()
  FIRST = oracleStream0Rows(R2_FIRST_SCREEN_PREFIXES_113C)
  // Standalone cursor rows (UI clicks) of the first-screen pack. Every 1.13c cursor row carries Stop
  // or Defer Inst (oracle), which is irrelevant for single plays of distinct rows.
  UI = FIRST.filter((r) => {
    const f = r.fileName.toLowerCase()
    return f.startsWith('cursor\\') && !f.startsWith('cursor\\intro\\') && r.groupSize === 1 && r.groupBase === r.id && !r.loop && r.volume > 0 && r.compound === 0 && r.stereo === 0
  })
  if (UI.length < 6) throw new Error(`oracle: only ${String(UI.length)} standalone cursor rows`)
}, 600_000)

describe('M21-P2 #944 — F9 WebAudioSoundVoices (product) on a Web Audio platform fake', () => {
  const mk = async (): Promise<{ v: VoicesC; ctx: FakeAudioContext; sfx: FakeGainNode; buf: FakeAudioBuffer; stereo: FakeAudioBuffer }> => {
    const Voices = await voicesCtor()
    const ctx = new FakeAudioContext()
    const sfx = ctx.createGain()
    sfx.connect(ctx.destination)
    const buf = new FakeAudioBuffer(1, 96_000, 48_000) // decoded at the CONTEXT rate (48 kHz)
    const stereo = new FakeAudioBuffer(2, 48_000, 48_000)
    const v = new Voices(
      () => ({ ctx, node: sfx }),
      (id) => (id === 4 ? { buffer: buf, sourceSampleRate: 22_050 } : id === 17 ? { buffer: stereo, sourceSampleRate: 22_050 } : undefined),
    )
    return { v, ctx, sfx, buf, stereo }
  }

  describe('Tier 1 — feature', () => {
    it('[T1-F9-01] start(voice, id, loop, offsetFrames) plays the id\'s buffer with offset = offsetFrames / 22050 s (source rate, not the 48 kHz decoded rate)', async () => {
      const { v, ctx, buf } = await mk()
      v.start(0, 4, false, 11_025)
      const src = ctx.sources()
      expect(src.length).toBe(1)
      expect(src[0]!.buffer).toBe(buf)
      expect(src[0]!.loop).toBe(false)
      expect(src[0]!.started, 'source started').not.toBeNull()
      expect(src[0]!.started!.offset).toBeCloseTo(0.5, 9)
    })

    it('[T1-F9-02] each voice is one AudioBufferSourceNode → L/R GainNodes → ChannelMerger(2) → the sfx node; setGains sets left/right', async () => {
      const { v, ctx, sfx } = await mk()
      v.start(3, 4, false, 0)
      v.setGains(3, 0.25, 0.75)
      const src = ctx.sources()[0]!
      expect(reaches(src, sfx), 'voice reaches sfxGain').toBe(true)
      const down = [...downstream(src)]
      const merger = down.find((n): n is FakeChannelMergerNode => n instanceof FakeChannelMergerNode && n.numberOfInputs >= 2)
      expect(merger, 'a ChannelMerger with ≥ 2 inputs on the voice path').toBeDefined()
      const feeding = (input: number): FakeGainNode[] =>
        down.filter((n): n is FakeGainNode => n instanceof FakeGainNode && n.outputs.some((e) => e.node === merger && e.input === input))
      expect(feeding(0).map((g) => g.gain.value), 'left gain → merger input 0').toEqual([0.25])
      expect(feeding(1).map((g) => g.gain.value), 'right gain → merger input 1').toEqual([0.75])
    })

    it('[T1-F9-03] loop flag is honoured; stop(voice) stops and disconnects that voice only; stopAll() stops the rest', async () => {
      const { v, ctx } = await mk()
      v.start(0, 4, true, 0)
      v.start(1, 4, false, 0)
      v.start(2, 17, false, 0)
      const [a, b, c] = ctx.sources() as [FakeAudioBufferSourceNode, FakeAudioBufferSourceNode, FakeAudioBufferSourceNode]
      expect(a.loop).toBe(true)
      v.stop(0)
      expect(a.stopped, 'voice 0 stopped').not.toBeNull()
      expect(a.outputs.length === 0 || a.disconnectCalls > 0, 'voice 0 disconnected').toBe(true)
      expect(b.stopped).toBeNull()
      v.stopAll()
      expect(b.stopped).not.toBeNull()
      expect(c.stopped).not.toBeNull()
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F9-01] a resumed/stolen voice restarts at its saved SOURCE position: offset 22,050 frames → 1.0 s (the d1c015fc bug used the buffer rate → 0.459 s)', async () => {
      const { v, ctx } = await mk()
      v.start(5, 4, false, 22_050)
      expect(ctx.sources()[0]!.started!.offset).toBeCloseTo(1.0, 9)
    })

    it('[T2-F9-02] a stereo buffer still uses one source per voice and reaches the sfx node; gains apply', async () => {
      const { v, ctx, sfx } = await mk()
      v.start(7, 17, false, 0)
      v.setGains(7, 0.5, 0.5)
      const srcs = ctx.sources()
      expect(srcs.length).toBe(1)
      expect(srcs[0]!.buffer!.numberOfChannels).toBe(2)
      expect(reaches(srcs[0]!, sfx)).toBe(true)
    })
  })
})

describe('M21-P2 #944 — F9 AudioRuntime113c (product) — graph, record layer, SoundTick, settings', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F9-04] unlock() lazily creates ONE AudioContext, resumes it, and builds masterGain → destination with ≥ 2 bus gains (sfx, music) → masterGain; unlock() again reuses it', async () => {
      const r = await runtimeRig()
      expect(FakeAudioContext.instances.length, 'no AudioContext before the first user gesture').toBe(0)
      r.rt.unlock()
      const ctx = r.ctx()
      expect(ctx.resumeCalls).toBeGreaterThanOrEqual(1)
      expect(ctx.state).toBe('running')
      const master = masterGainOf(ctx)
      const buses = ctx.nodes.filter((n) => n instanceof FakeGainNode && n !== master && n.outputs.some((e) => e.node === master))
      expect(buses.length, 'sfxGain and musicGain feed masterGain').toBeGreaterThanOrEqual(2)
      r.rt.unlock()
      expect(FakeAudioContext.instances.length).toBe(1)
    })

    it('[T1-F9-05] the runtime owns exactly ONE session record layer (the product SoundRecords113c), stable across calls (override v)', async () => {
      const R = await recordsModule()
      const r = await runtimeRig()
      const a = r.rt.records
      expect(a).toBeInstanceOf(R.SoundRecords113c)
      expect(r.rt.records).toBe(a)
      r.rt.unlock()
      r.rt.gameInit()
      expect(r.rt.records).toBe(a)
      const n0 = a.records().length
      r.rt.playUi(UI[0]!.id)
      expect(a.records().length, 'playUi allocates in the session record layer').toBe(n0 + 1)
    })

    it('[T1-F9-06] soundTick: one update+endTick per NEW game tick (no catch-up after a jump), false for a repeated tick, throws when the tick goes backwards', async () => {
      const r = await runtimeRig()
      r.rt.unlock()
      r.rt.gameInit()
      const now0 = r.rt.records.now
      expect(r.rt.soundTick(100)).toBe(true)
      expect(r.rt.records.now).toBe(now0 + 1)
      expect(r.rt.soundTick(100)).toBe(false)
      expect(r.rt.records.now).toBe(now0 + 1)
      expect(r.rt.soundTick(105)).toBe(true)
      expect(r.rt.records.now, 'a 5-tick jump runs ONE SoundTick').toBe(now0 + 2)
      expect(() => r.rt.soundTick(104)).toThrow()
    })

    it('[T1-F9-07] playUi end-to-end: cold cache → fetch sfx-core once → decode → the record starts on a later SoundTick with THAT chunk\'s buffer, routed through masterGain', async () => {
      const r = await runtimeRig()
      r.rt.unlock()
      r.rt.gameInit()
      const id = UI[0]!.id
      const h = r.rt.playUi(id)
      expect(h).toBeGreaterThan(0)
      let tick = 1
      for (let i = 0; i < 6 && r.ctx().sources().length === 0; i += 1) {
        await flushAsync()
        r.rt.soundTick(tick++)
      }
      const srcs = r.ctx().sources()
      expect(srcs.length, 'one voice started').toBe(1)
      expect(srcs[0]!.buffer!.sourceSha256, 'the decoded chunk of that Sounds.txt row').toBe(await chunkSha(id))
      expect(reaches(srcs[0]!, masterGainOf(r.ctx())), 'voice → … → masterGain').toBe(true)
      expect(r.server.calls.map((c) => c.packId), 'first screen: only sfx-core.bin').toEqual(['sfx-core'])
    })

    it('[T1-F9-08] audioMuted → masterGain 0 and back to 1, without touching the record layer (same records before/after)', async () => {
      const r = await runtimeRig()
      r.rt.unlock()
      r.rt.gameInit()
      r.rt.playUi(UI[0]!.id)
      const before = JSON.stringify(r.rt.records.records())
      r.settings.muted = true
      r.rt.applySettings()
      expect(masterGainOf(r.ctx()).gain.value).toBe(0)
      expect(JSON.stringify(r.rt.records.records()), 'mute changes no record').toBe(before)
      r.settings.muted = false
      r.rt.applySettings()
      expect(masterGainOf(r.ctx()).gain.value).toBe(1)
    })

    it('[T1-F9-09] prefetchBackground() fetches exactly the background core parts (never sfx-core again, never other tiers) without blocking', async () => {
      const r = await runtimeRig()
      r.rt.unlock()
      r.rt.gameInit()
      const { packs } = await index()
      const bg = packs.filter((p) => p.tier === 'background').map((p) => p.packId).sort()
      const ret: unknown = r.rt.prefetchBackground()
      expect(ret instanceof Promise).toBe(false)
      await flushAsync()
      expect([...new Set(r.server.calls.map((c) => c.packId))].sort()).toEqual(bg)
      expect(r.server.calls.length, 'one fetch per part').toBe(bg.length)
    })

    it('[T1-F9-10] gameExit() stops every voice and frees every record; gameInit() starts a clean session on the same record layer', async () => {
      class SinkWithStopAll extends RecordingVoices {
        stopAllCalls = 0
        override stopAll(): void {
          this.stopAllCalls += 1
        }
      }
      const r = await runtimeRig()
      r.rt.unlock()
      r.rt.gameInit()
      const voices = new SinkWithStopAll()
      r.rt.records.setVoices(voices)
      const ids = UI.slice(0, 3).map((u) => u.id)
      for (const id of ids) await r.loader.loadSoundBuffer(id, r.ctx())
      for (const id of ids) r.rt.playUi(id)
      r.rt.soundTick(1)
      expect(voices.liveVoices().length, 'voices running').toBeGreaterThan(0)
      const layer = r.rt.records
      r.rt.gameExit()
      expect(voices.stopAllCalls > 0 || voices.liveVoices().length === 0, 'every voice stopped (per voice or stopAll)').toBe(true)
      expect(layer.records().length, 'no record survives gameExit').toBe(0)
      r.rt.gameInit()
      expect(r.rt.records).toBe(layer)
      expect(layer.records().length).toBe(0)
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    /**
     * Replays every record-layer call the runtime made onto a fresh PRODUCT SoundRecords113c
     * configured with `master` and returns both voice-event streams. Equality proves the runtime
     * passes exactly `master` to its record layer.
     */
    async function runtimeVsReference(volume: number, master: number, ids: readonly number[], ticks: number): Promise<{ runtime: string; reference: string }> {
      const R = await recordsModule()
      const r = await runtimeRig({ volume, seed: [0x51, 0x52] })
      r.rt.unlock()
      r.rt.gameInit()
      r.rt.applySettings()
      for (const id of ids) await r.loader.loadSoundBuffer(id, r.ctx()) // warm: no async pending
      const recV = new RecordingVoices()
      r.rt.records.setVoices(recV)
      const log: { m: string; a: unknown[] }[] = []
      let depth = 0 // log only the runtime's outermost calls (not the record layer's own re-entrant ones)
      for (const m of ['play', 'setSoundPos', 'setAsyncReady', 'stop', 'setVolume', 'fade'] as const) {
        const target = r.rt.records as unknown as Record<string, (...a: unknown[]) => unknown>
        if (typeof target[m] !== 'function') continue
        const orig = target[m].bind(target)
        target[m] = (...a: unknown[]) => {
          if (depth === 0) log.push({ m, a })
          depth += 1
          try {
            return orig(...a)
          } finally {
            depth -= 1
          }
        }
      }
      const tickLog: number[] = []
      for (const id of ids) r.rt.playUi(id)
      for (let t = 1; t <= ticks; t += 1) {
        recV.tick = t
        depth += 1 // calls made inside SoundTick come from the record layer itself
        const ran = r.rt.soundTick(t)
        depth -= 1
        if (ran) tickLog.push(log.length)
      }
      const refV = new RecordingVoices()
      const ref = R.SoundRecords113c.fromSounds113c({
        rng: new D2Rng(0x51, 0x52),
        master: () => master,
        paused: () => false,
        listenerPos: () => ({ x: 0, y: 0 }),
        voices: refV,
        sampleFacts: (id: number) => ({ kind: 'pcm', ...oracleSampleFacts(id) }),
      }) as unknown as Record<string, (...a: unknown[]) => unknown> & SoundRecordsC
      let li = 0
      const replayUpTo = (n: number): void => {
        for (; li < n; li += 1) ref[log[li]!.m]!(...log[li]!.a)
      }
      for (let k = 0; k < tickLog.length; k += 1) {
        replayUpTo(tickLog[k]!)
        refV.tick = k + 1
        ref.update()
        ref.endTick()
      }
      const strip = (v: RecordingVoices): string => JSON.stringify(v.events.map((e) => ({ ...e, tick: 0 })))
      return { runtime: strip(recV), reference: strip(refV) }
    }

    it('[T2-F9-03] masterVolume 0.337 → record master Math.round(33.7) = 34 exactly (D2Client 0x6fb0d26a scales channel volume by master/100)', async () => {
      const ids = UI.slice(0, 2).map((u) => u.id)
      const a = await runtimeVsReference(0.337, 34, ids, 4)
      expect(a.runtime, 'runtime output = product records with master 34').toBe(a.reference)
      const b = await runtimeVsReference(0.337, 33, ids, 4)
      expect(b.runtime, 'master 33 (floor/trunc) would differ — the check is not vacuous').not.toBe(b.reference)
    })

    it('[T2-F9-04] masterVolume 1 → master 100; masterVolume 0 → master 0 (nothing audible starts)', async () => {
      const ids = UI.slice(0, 2).map((u) => u.id)
      const full = await runtimeVsReference(1, 100, ids, 4)
      expect(full.runtime).toBe(full.reference)
      const zero = await runtimeVsReference(0, 0, ids, 4)
      expect(zero.runtime).toBe(zero.reference)
    })

    it('[T2-F9-05] playUi is non-positional: both channels receive equal gain', async () => {
      const r = await runtimeRig()
      r.rt.unlock()
      r.rt.gameInit()
      const id = UI[1]!.id
      await r.loader.loadSoundBuffer(id, r.ctx())
      const voices = new RecordingVoices()
      r.rt.records.setVoices(voices)
      r.listener.x = 1234
      r.listener.y = -777 // the listener position must not matter for UI sounds
      r.rt.playUi(id)
      r.rt.soundTick(1)
      const s = voices.starts([id])
      expect(s.length).toBe(1)
      const g = voices.lastGains(s[0]!.voice)
      expect(g, 'gains sent').toBeDefined()
      expect(g!.left).toBeGreaterThan(0)
      expect(g!.left).toBeCloseTo(g!.right, 9)
    })

    it('[T2-F9-06] a muted session produces exactly the same record-layer output as an unmuted one (mute is masterGain only)', async () => {
      const run = async (muted: boolean): Promise<string> => {
        const r = await runtimeRig({ muted, seed: [77, 88] })
        r.rt.unlock()
        r.rt.gameInit()
        r.rt.applySettings()
        const ids = UI.slice(0, 4).map((u) => u.id)
        for (const id of ids) await r.loader.loadSoundBuffer(id, r.ctx())
        const v = new RecordingVoices()
        r.rt.records.setVoices(v)
        for (let t = 1; t <= 30; t += 1) {
          if (t % 3 === 1) r.rt.playUi(ids[t % ids.length]!)
          v.tick = t
          r.rt.soundTick(t)
        }
        expect(masterGainOf(r.ctx()).gain.value).toBe(muted ? 0 : 1)
        return JSON.stringify(v.events)
      }
      expect(await run(true)).toBe(await run(false))
    })
  })
})
