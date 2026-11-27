/**
 * M21-P2 (#944) — Tier 4 realistic scenarios across F7–F11 (real baked packs, product loader,
 * product runtime + record layer; browser platform faked by `FakeAudioContext` / `FakePackServer`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  PRODUCT,
  R2_BACKGROUND_PREFIXES_113C,
  R2_FIRST_SCREEN_PREFIXES_113C,
  REPO_ROOT,
  RecordingVoices,
  getOracle113c,
  isPlainOneShot,
  loadProductModule,
  normSoundFile,
  oracleStream0Rows,
  requireExport,
  sha256Hex,
  type OracleSoundRow,
} from './harness-113c.ts'
import { FakeAudioBuffer, FakeAudioContext, FakeGainNode, FakePackServer, flushAsync, installFakeAudioContext } from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 600_000 })

const P2 = '#944 scenarios'

type TupleC = readonly [packId: string, byteOffset: number, byteLength: number, sampleRate: number, frames: number, channels: number]
interface PackMetaC {
  readonly packId: string
  readonly url: string
  readonly tier: string
}
interface SoundRecordsC {
  setVoices(v: unknown): void
  records(): { readonly id: number; readonly state: number }[]
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
type RuntimeCtor = new (o: Record<string, unknown>) => RuntimeC
type LoaderC = { loadSoundBuffer(id: number, ctx?: unknown): Promise<FakeAudioBuffer | null>; readonly stats: { readonly decodes: number } }
type LoaderCtor = new (o?: Record<string, unknown>) => LoaderC

async function mods(): Promise<{ Runtime: RuntimeCtor; Loader: LoaderCtor; tuples: Readonly<Record<number, TupleC>>; packs: readonly PackMetaC[] }> {
  const rt = await loadProductModule(PRODUCT.audioRuntime, P2)
  const ld = await loadProductModule(PRODUCT.sfxChunkLoader, P2)
  const ix = await loadProductModule(PRODUCT.sfxPackIndex, P2)
  return {
    Runtime: requireExport<RuntimeCtor>(rt, 'AudioRuntime113c', PRODUCT.audioRuntime, P2),
    Loader: requireExport<LoaderCtor>(ld, 'SfxChunkLoader', PRODUCT.sfxChunkLoader, P2),
    tuples: requireExport<Readonly<Record<number, TupleC>>>(ix, 'SFX_PACK_INDEX_113C', PRODUCT.sfxPackIndex, P2),
    packs: requireExport<readonly PackMetaC[]>(ix, 'SFX_PACKS_113C', PRODUCT.sfxPackIndex, P2),
  }
}

let uninstall: (() => void) | null = null
afterEach(() => {
  uninstall?.()
  uninstall = null
})

async function session(o: { muted?: boolean; seed?: readonly [number, number] } = {}): Promise<{
  rt: RuntimeC
  loader: LoaderC
  server: FakePackServer
  settings: { volume: number; muted: boolean }
  ctx(): FakeAudioContext
}> {
  uninstall?.()
  uninstall = installFakeAudioContext()
  const { Runtime, Loader, packs } = await mods()
  const server = new FakePackServer(packs)
  const loader = new Loader({ fetchPack: server.fetchPack, getContext: () => FakeAudioContext.instances.at(-1) ?? null })
  const settings = { volume: 1, muted: o.muted ?? false }
  const seed = o.seed ?? [0x944, 0x2]
  const rt = new Runtime({
    rng: new D2Rng(seed[0], seed[1]),
    listenerPos: () => ({ x: 0, y: 0 }),
    loader,
    settings: { masterVolume: () => settings.volume, muted: () => settings.muted },
  })
  return { rt, loader, server, settings, ctx: () => FakeAudioContext.instances.at(-1)! }
}

const masterOf = (ctx: FakeAudioContext): FakeGainNode => {
  const m = ctx.nodes.filter((n): n is FakeGainNode => n instanceof FakeGainNode && n.outputs.some((e) => e.node === ctx.destination))
  if (m.length !== 1) throw new Error(`expected one masterGain, found ${String(m.length)}`)
  return m[0]!
}

let FIRST: OracleSoundRow[] = []
let BACKGROUND: OracleSoundRow[] = []
const distinct = (rows: readonly OracleSoundRow[], n: number, pred: (r: OracleSoundRow) => boolean): OracleSoundRow[] => {
  const seen = new Set<string>()
  const out: OracleSoundRow[] = []
  for (const r of rows) {
    const f = normSoundFile(r.fileName)
    if (seen.has(f) || !pred(r)) continue
    seen.add(f)
    out.push(r)
    if (out.length === n) return out
  }
  throw new Error(`only ${String(out.length)}/${String(n)} rows`)
}

beforeAll(() => {
  getOracle113c()
  FIRST = oracleStream0Rows(R2_FIRST_SCREEN_PREFIXES_113C)
  BACKGROUND = oracleStream0Rows(R2_BACKGROUND_PREFIXES_113C)
}, 600_000)

/** One variant-less, non-looping, audible row (Stop/Defer Inst allowed: every cursor/item row has one). */
const standalone = (r: OracleSoundRow): boolean => r.groupSize === 1 && r.groupBase === r.id && !r.loop && r.volume > 0 && r.compound === 0 && r.stereo === 0
const under = (r: OracleSoundRow, prefix: string): boolean => normSoundFile(r.fileName).startsWith(prefix)

async function chunkShaOf(id: number): Promise<string> {
  const { tuples, packs } = await mods()
  const t = tuples[id]!
  const meta = packs.find((p) => p.packId === t[0])!
  const b = new Uint8Array(readFileSync(join(REPO_ROOT, 'public', meta.url.replace(/^\/+/, ''))))
  return sha256Hex(b.subarray(t[1], t[1] + t[2]))
}

describe('M21-P2 #944 — Tier 4 scenarios', () => {
  it('[T4-P2-01] first screen then game entry: UI clicks fetch ONLY sfx-core.bin; after entering, the background parts are prefetched once and object sounds play from them without another request (D4)', async () => {
    const s = await session()
    s.rt.unlock()
    s.rt.gameInit()
    const ui = distinct(FIRST, 5, (r) => standalone(r) && under(r, 'cursor\\') && !under(r, 'cursor\\intro\\'))
    let tick = 1
    for (const r of ui) s.rt.playUi(r.id)
    for (let i = 0; i < 8; i += 1) {
      await flushAsync()
      s.rt.soundTick(tick++)
    }
    expect(s.server.calls.map((c) => c.packId), 'first screen: exactly one .bin request').toEqual(['sfx-core'])
    expect(s.ctx().sources().length, 'every UI click became a voice').toBe(ui.length)
    s.rt.prefetchBackground()
    await flushAsync()
    const { packs } = await mods()
    const bg = packs.filter((p) => p.tier === 'background').map((p) => p.packId).sort()
    expect(s.server.calls.slice(1).map((c) => c.packId).sort(), 'background parts prefetched once each').toEqual(bg)
    const obj = distinct(BACKGROUND, 3, (r) => isPlainOneShot(r) && normSoundFile(r.fileName).startsWith('object\\'))
    const before = s.ctx().sources().length
    for (const r of obj) s.rt.playUi(r.id)
    for (let i = 0; i < 8; i += 1) {
      await flushAsync()
      s.rt.soundTick(tick++)
    }
    expect(s.server.calls.length, 'no further network request').toBe(1 + bg.length)
    const started = s.ctx().sources().slice(before).map((src) => src.buffer!.sourceSha256)
    expect(new Set(started)).toEqual(new Set(await Promise.all(obj.map((r) => chunkShaOf(r.id)))))
  })

  it('[T4-P2-02] combat burst: 30 distinct impact one-shots in one tick never exceed the 12-voice mono partition (D22) and each chunk is decoded once', async () => {
    const s = await session({ seed: [31, 41] })
    s.rt.unlock()
    s.rt.gameInit()
    const { tuples } = await mods()
    const firstIds = new Set(FIRST.map((r) => r.id))
    // 1.13c combat sounds are variant groups: request the leaders; PickVariant may start any id in [id, id+g).
    const burst = distinct(FIRST, 30, (r) => {
      if (!under(r, 'combat\\') || r.groupBase !== r.id || r.loop || r.volume === 0 || r.stereo !== 0) return false
      for (let k = 0; k < Math.max(1, r.groupSize); k += 1) if (!firstIds.has(r.id + k) || tuples[r.id + k]?.[5] !== 1) return false
      return true
    })
    const variantIds = [...new Set(burst.flatMap((r) => Array.from({ length: Math.max(1, r.groupSize) }, (_, k) => r.id + k)))]
    for (const id of variantIds) await s.loader.loadSoundBuffer(id, s.ctx())
    const decodes = s.loader.stats.decodes
    const chunks = new Set(variantIds.map((id) => `${tuples[id]![0]}@${String(tuples[id]![1])}`))
    expect([chunks.size, variantIds.length], 'one decode per distinct chunk (or per id when FileNames are shared)').toContain(decodes)
    const voices = new RecordingVoices()
    s.rt.records.setVoices(voices)
    for (const r of burst) s.rt.playUi(r.id)
    voices.tick = 1
    s.rt.soundTick(1)
    expect(voices.liveVoices().length, 'live voices after the burst').toBeLessThanOrEqual(12)
    expect(voices.starts().length).toBeGreaterThan(0)
    for (const e of voices.starts()) expect(variantIds, `started id ${String(e.soundId)} is a requested variant`).toContain(e.soundId)
    for (let t = 2; t <= 60; t += 1) {
      voices.tick = t
      s.rt.soundTick(t)
      expect(voices.liveVoices().length, `tick ${String(t)}`).toBeLessThanOrEqual(12)
    }
    expect(s.loader.stats.decodes, 'no re-decode of cached chunks').toBe(decodes)
  })

  it('[T4-P2-03] muting mid-session (tick 50) and unmuting (tick 120) only moves masterGain: record-layer output equals an always-unmuted session over 200 ticks', async () => {
    const run = async (toggle: boolean): Promise<{ events: string; timeline: number[] }> => {
      const s = await session({ seed: [5, 6] })
      s.rt.unlock()
      s.rt.gameInit()
      s.rt.applySettings()
      const ids = distinct(FIRST, 6, (r) => standalone(r) && under(r, 'item\\')).map((r) => r.id)
      for (const id of ids) await s.loader.loadSoundBuffer(id, s.ctx())
      const v = new RecordingVoices()
      s.rt.records.setVoices(v)
      const timeline: number[] = []
      for (let t = 1; t <= 200; t += 1) {
        if (toggle && (t === 50 || t === 120)) {
          s.settings.muted = t === 50
          s.rt.applySettings()
        }
        if (t % 7 === 0) s.rt.playUi(ids[t % ids.length]!)
        v.tick = t
        s.rt.soundTick(t)
        if (t === 49 || t === 50 || t === 119 || t === 120) timeline.push(masterOf(s.ctx()).gain.value)
      }
      return { events: JSON.stringify(v.events), timeline }
    }
    const toggled = await run(true)
    const plain = await run(false)
    expect(toggled.timeline, 'masterGain at ticks 49/50/119/120').toEqual([1, 0, 0, 1])
    expect(toggled.events).toBe(plain.events)
  })

  it('[T4-P2-04] cold background cache under load: 20 object sounds requested while the game keeps ticking; soundTick never blocks, nothing starts before its chunk is decoded, every one starts once decoded', async () => {
    const s = await session({ seed: [8, 13] })
    s.rt.unlock()
    s.rt.gameInit()
    const objs = distinct(BACKGROUND, 20, (r) => isPlainOneShot(r))
    const voices = new RecordingVoices()
    s.rt.records.setVoices(voices)
    for (const r of objs) s.rt.playUi(r.id)
    voices.tick = 1
    const t0 = Date.now()
    expect(s.rt.soundTick(1), 'soundTick is synchronous').toBe(true)
    expect(Date.now() - t0, 'the tick does not wait for network/decoding').toBeLessThan(1000)
    expect(voices.starts().length, 'nothing starts before its buffer exists').toBe(0)
    for (let t = 2; t <= 40; t += 1) {
      await flushAsync(2)
      voices.tick = t
      s.rt.soundTick(t)
    }
    const startedIds = new Set(voices.starts().map((e) => e.soundId))
    expect(objs.filter((r) => !startedIds.has(r.id)).map((r) => r.id), 'every requested object sound eventually starts').toEqual([])
    expect(s.server.calls.every((c) => c.packId !== 'sfx-core'), 'background sounds never pull sfx-core').toBe(true)
  })
})
