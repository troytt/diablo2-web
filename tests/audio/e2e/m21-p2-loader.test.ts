/**
 * M21-P2 (#944) — F8 `SfxChunkLoader` (src/client/audio/sfx-chunk-loader.ts) driven with the REAL
 * baked packs from `public/sound/packs/`.
 *
 * Requirements (request R2, PROJECT.md D4–D6, reland_plan §E.2):
 * - fetch each pack once (single-flight; a failed fetch is retried, never cached);
 * - slice chunks with exactly one chunk-sized copy (`ArrayBuffer.prototype.slice`) because
 *   `decodeAudioData` DETACHES its input — the resident pack buffer must stay intact (D5);
 * - decoded buffers live in a bounded LRU (`maxCacheBytes`, D6);
 * - background packs are prefetched without blocking (D4); Async Only / cold records stay pending in
 *   the record layer until the buffer is ready, then start on the next SoundTick; errors are surfaced
 *   (counted + record stopped), never swallowed.
 * The only doubles are the browser platform (`fetch` → file read, `AudioContext.decodeAudioData` →
 * `FakeAudioContext`, which validates each chunk with the harness's independent Ogg reader and
 * detaches its input like browsers do) and the record layer's voice sink (`RecordingVoices`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
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
  oracleSampleFacts,
  oracleStream0Rows,
  requireExport,
  sha256Hex,
  summarize,
  type OracleSoundRow,
} from './harness-113c.ts'
import { FakeAudioBuffer, FakeAudioContext, FakePackServer, flushAsync } from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F8 = '#944 F8 SfxChunkLoader'

// ── Contract (reland_plan §E.2) ──────────────────────────────────────────────────────────────────
type TupleC = readonly [packId: string, byteOffset: number, byteLength: number, sampleRate: number, frames: number, channels: number]
interface PackMetaC {
  readonly packId: string
  readonly url: string
  readonly bytes: number
  readonly sha256: string
  readonly chunkCount: number
  readonly tier: string
}
interface EntryC {
  readonly packId: string
  readonly byteOffset: number
  readonly byteLength: number
  readonly sampleRate: number
  readonly frames: number
  readonly channels: number
}
interface RecordsLike {
  setAsyncReady(h: number): void
  stop(h: number): void
}
interface LoaderC {
  hasEntry(id: number): boolean
  getEntry(id: number): EntryC | null
  loadPackBytes(packId: string): Promise<Uint8Array>
  prefetch(packId: string): void
  sliceChunk(id: number): Promise<ArrayBuffer | null>
  loadSoundBuffer(id: number, ctx?: unknown): Promise<FakeAudioBuffer | null>
  getCachedBuffer(id: number): FakeAudioBuffer | undefined
  prepareRecordPlayback(id: number, handle: number, records: RecordsLike, ctx?: unknown): Promise<FakeAudioBuffer | null>
  readonly stats: { readonly packFetches: number; readonly decodes: number; readonly decodeErrors: number; readonly unbakedRequests: number }
}
type LoaderCtor = new (o?: Record<string, unknown>) => LoaderC

interface RecordViewC {
  readonly handle: number
  readonly id: number
  readonly state: number
}
interface SoundRecordsC extends RecordsLike {
  play(id: number, o?: { readonly asyncPending?: boolean }): number
  update(): void
  endTick(): void
  records(): RecordViewC[]
  record(h: number): RecordViewC | undefined
  readonly now: number
}
interface RecordsModuleC {
  readonly SoundRecords113c: { fromSounds113c(o?: Record<string, unknown>): SoundRecordsC }
}

async function loaderCtor(): Promise<LoaderCtor> {
  const m = await loadProductModule(PRODUCT.sfxChunkLoader, F8)
  return requireExport<LoaderCtor>(m, 'SfxChunkLoader', PRODUCT.sfxChunkLoader, F8)
}

async function index(): Promise<{ tuples: Readonly<Record<number, TupleC>>; packs: readonly PackMetaC[] }> {
  const m = await loadProductModule(PRODUCT.sfxPackIndex, F8)
  return {
    tuples: requireExport<Readonly<Record<number, TupleC>>>(m, 'SFX_PACK_INDEX_113C', PRODUCT.sfxPackIndex, F8),
    packs: requireExport<readonly PackMetaC[]>(m, 'SFX_PACKS_113C', PRODUCT.sfxPackIndex, F8),
  }
}

async function recordsModule(): Promise<RecordsModuleC> {
  const m = await loadProductModule(PRODUCT.records, F8)
  requireExport(m, 'SoundRecords113c', PRODUCT.records, F8)
  return m as unknown as RecordsModuleC
}

interface Rig {
  readonly loader: LoaderC
  readonly server: FakePackServer
  readonly ctx: FakeAudioContext
}

async function rig(opts: { maxCacheBytes?: number } = {}): Promise<Rig> {
  const Ctor = await loaderCtor()
  const { packs } = await index()
  const server = new FakePackServer(packs)
  const ctx = new FakeAudioContext()
  const loader = new Ctor({ fetchPack: server.fetchPack, getContext: () => ctx, ...(opts.maxCacheBytes !== undefined ? { maxCacheBytes: opts.maxCacheBytes } : {}) })
  return { loader, server, ctx }
}

let FIRST: OracleSoundRow[] = []
let BACKGROUND: OracleSoundRow[] = []

beforeAll(() => {
  getOracle113c()
  FIRST = oracleStream0Rows(R2_FIRST_SCREEN_PREFIXES_113C)
  BACKGROUND = oracleStream0Rows(R2_BACKGROUND_PREFIXES_113C)
}, 600_000)

/** First `n` rows with distinct FileNames (distinct chunks). */
function distinctFiles(rows: readonly OracleSoundRow[], n: number, pred: (r: OracleSoundRow) => boolean = () => true): OracleSoundRow[] {
  const seen = new Set<string>()
  const out: OracleSoundRow[] = []
  for (const r of rows) {
    const f = normSoundFile(r.fileName)
    if (seen.has(f) || !pred(r)) continue
    seen.add(f)
    out.push(r)
    if (out.length === n) break
  }
  if (out.length < n) throw new Error(`only ${String(out.length)} distinct rows`)
  return out
}

async function chunkSha(id: number): Promise<string> {
  const { tuples, packs } = await index()
  const t = tuples[id]!
  const meta = packs.find((p) => p.packId === t[0])!
  const b = new Uint8Array(readFileSync(join(REPO_ROOT, 'public', meta.url.replace(/^\/+/, ''))))
  return sha256Hex(b.subarray(t[1], t[1] + t[2]))
}

const metaOf = async (packId: string): Promise<PackMetaC> => (await index()).packs.find((p) => p.packId === packId)!

describe('M21-P2 #944 — F8 SfxChunkLoader on the real packs', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F8-01] single-flight: concurrent loadPackBytes calls share ONE fetch of /sound/packs/sfx-core.bin and one resident buffer', async () => {
      const { loader, server } = await rig()
      let open!: () => void
      server.hold = new Promise<void>((r) => (open = r))
      const a = loader.loadPackBytes('sfx-core')
      const b = loader.loadPackBytes('sfx-core')
      open()
      const [x, y] = await Promise.all([a, b])
      expect(server.fetchesOf('sfx-core')).toBe(1)
      expect(server.calls[0]!.url).toMatch(/(^|\/)sound\/packs\/sfx-core\.bin$/)
      const meta = await metaOf('sfx-core')
      expect(sha256Hex(x)).toBe(meta.sha256.toLowerCase())
      expect(y.buffer, 'one resident ArrayBuffer per pack').toBe(x.buffer)
      await loader.loadPackBytes('sfx-core')
      expect(server.fetchesOf('sfx-core'), 'resolved pack is reused').toBe(1)
      expect(loader.stats.packFetches).toBe(1)
    })

    it('[T1-F8-02] sliceChunk returns a private ArrayBuffer of exactly byteLength holding the indexed bytes (one chunk-sized copy, D5)', async () => {
      const { loader } = await rig()
      const { tuples } = await index()
      for (const id of [4, 17, 2548]) {
        const t = tuples[id]!
        const ab = await loader.sliceChunk(id)
        expect(ab, `row ${String(id)}`).toBeInstanceOf(ArrayBuffer)
        expect(ab!.byteLength).toBe(t[2])
        expect(sha256Hex(new Uint8Array(ab!))).toBe(await chunkSha(id))
        const pack = await loader.loadPackBytes(t[0])
        expect(ab, 'not the pack buffer').not.toBe(pack.buffer)
        new Uint8Array(ab!).fill(0)
        expect(sha256Hex(pack), 'writing the slice leaves the pack intact').toBe((await metaOf(t[0])).sha256.toLowerCase())
      }
    })

    it('[T1-F8-03] D5: after 25 decodes (each detaching its input) the resident pack is still intact, and every decode received exactly one whole chunk', async () => {
      const { loader, ctx } = await rig()
      const rows = distinctFiles(FIRST, 25)
      for (const r of rows) expect(await loader.loadSoundBuffer(r.id), `row ${String(r.id)}`).toBeInstanceOf(FakeAudioBuffer)
      const pack = await loader.loadPackBytes('sfx-core')
      const meta = await metaOf('sfx-core')
      expect(pack.byteLength).toBe(meta.bytes)
      expect(sha256Hex(pack)).toBe(meta.sha256.toLowerCase())
      const want = new Set(await Promise.all(rows.map((r) => chunkSha(r.id))))
      expect(ctx.decodes.every((d) => d.ok)).toBe(true)
      expect(new Set(ctx.decodes.map((d) => d.sha256)), 'decodeAudioData inputs = exactly the requested chunks').toEqual(want)
      expect(ctx.decodes.some((d) => d.byteLength === meta.bytes), 'the whole pack is never handed to decodeAudioData').toBe(false)
    })

    it('[T1-F8-04] decoded buffers are cached: a second request does not decode again; getCachedBuffer returns the same AudioBuffer (right chunk, channels, length)', async () => {
      const { loader, ctx } = await rig()
      const { tuples } = await index()
      for (const id of [4, 17]) {
        const b1 = await loader.loadSoundBuffer(id)
        const before = ctx.decodes.length
        const b2 = await loader.loadSoundBuffer(id)
        expect(ctx.decodes.length, `row ${String(id)} decoded once`).toBe(before)
        expect(b2).toBe(b1)
        expect(loader.getCachedBuffer(id)).toBe(b1)
        expect(b1!.sourceSha256).toBe(await chunkSha(id))
        expect(b1!.numberOfChannels).toBe(tuples[id]![5])
        expect(Math.abs(b1!.duration - tuples[id]![4] / 22_050)).toBeLessThanOrEqual(0.002)
      }
      expect(loader.stats.decodes).toBe(2)
    })

    it('[T1-F8-05] D6 bounded LRU: with maxCacheBytes ≈ 2.5 decoded buffers, a third decode evicts the least-recently-used one', async () => {
      const { tuples } = await index()
      const rows = distinctFiles(FIRST, 3, (r) => {
        const t = tuples[r.id]
        return t !== undefined && t[5] === 1 && t[4] >= 11_025 && t[4] <= 13_230 // 0.5–0.6 s mono
      })
      const decodedBytes = (id: number): number => Math.round((tuples[id]![4] / 22_050) * 48_000) * 4
      const maxCacheBytes = Math.floor(2.5 * Math.max(...rows.map((r) => decodedBytes(r.id))))
      const { loader } = await rig({ maxCacheBytes })
      for (const r of rows) await loader.loadSoundBuffer(r.id)
      expect(loader.getCachedBuffer(rows[0]!.id), 'oldest evicted').toBeUndefined()
      expect(loader.getCachedBuffer(rows[1]!.id)).toBeInstanceOf(FakeAudioBuffer)
      expect(loader.getCachedBuffer(rows[2]!.id)).toBeInstanceOf(FakeAudioBuffer)
      const big = await rig({ maxCacheBytes: 64 * 1024 * 1024 })
      for (const r of rows) await big.loader.loadSoundBuffer(r.id)
      expect(rows.every((r) => big.loader.getCachedBuffer(r.id) !== undefined), 'nothing evicted under a large bound').toBe(true)
    })

    it('[T1-F8-06] prefetch(background part) fetches it without being awaited; later loads reuse it; prefetching twice is still one fetch (D4)', async () => {
      const { loader, server } = await rig()
      const { packs, tuples } = await index()
      const bg = packs.filter((p) => p.tier === 'background')
      expect(bg.length).toBeGreaterThanOrEqual(1)
      const ret: unknown = loader.prefetch(bg[0]!.packId)
      expect(ret instanceof Promise, 'prefetch is fire-and-forget (returns void)').toBe(false)
      loader.prefetch(bg[0]!.packId)
      await flushAsync()
      expect(server.fetchesOf(bg[0]!.packId)).toBe(1)
      const id = Number(Object.entries(tuples).find(([, t]) => t[0] === bg[0]!.packId)![0])
      expect(await loader.loadSoundBuffer(id)).toBeInstanceOf(FakeAudioBuffer)
      expect(server.fetchesOf(bg[0]!.packId)).toBe(1)
      expect(server.fetchesOf('sfx-core'), 'prefetching a background part does not fetch sfx-core').toBe(0)
    })

    it('[T1-F8-07] Async pending with the REAL record layer: a cold record stays silent across SoundTicks; prepareRecordPlayback makes it start on the next tick', async () => {
      const R = await recordsModule()
      const { loader } = await rig()
      const row = BACKGROUND.find((r) => isPlainOneShot(r))!
      const voices = new RecordingVoices()
      const rec = R.SoundRecords113c.fromSounds113c({
        rng: new D2Rng(0x1234, 0x5678),
        master: () => 100,
        paused: () => false,
        listenerPos: () => ({ x: 0, y: 0 }),
        voices,
        sampleFacts: (id: number) => (id === row.id ? { kind: 'pcm', ...oracleSampleFacts(id) } : undefined),
      })
      const step = (): void => {
        voices.tick = rec.now
        rec.update()
        rec.endTick()
      }
      const h = rec.play(row.id, { asyncPending: true })
      expect(h).toBeGreaterThan(0)
      for (let i = 0; i < 3; i += 1) step()
      expect(voices.starts(), 'pending record must not start before its buffer exists').toEqual([])
      const ready = vi.spyOn(rec, 'setAsyncReady')
      const buf = await loader.prepareRecordPlayback(row.id, h, rec)
      expect(buf).toBeInstanceOf(FakeAudioBuffer)
      expect(ready).toHaveBeenCalledWith(h)
      step()
      expect(voices.starts().map((s) => s.soundId)).toEqual([row.id])
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F8-01] a failed fetch is surfaced and NOT cached: the next request fetches again and succeeds', async () => {
      const { loader, server } = await rig()
      server.failures.set('sfx-core', 1)
      await expect(loader.loadPackBytes('sfx-core')).rejects.toThrow()
      const pack = await loader.loadPackBytes('sfx-core')
      expect(server.fetchesOf('sfx-core')).toBe(2)
      expect(sha256Hex(pack)).toBe((await metaOf('sfx-core')).sha256.toLowerCase())
    })

    it('[T2-F8-02] corrupted packs are rejected before use: legacy magic, stale v1 header, truncated body', async () => {
      const cases: [string, (b: Uint8Array) => Uint8Array][] = [
        ['magic DSPK', (b) => (b.set([0x44, 0x53, 0x50, 0x4b], 0), b)],
        ['version 1', (b) => (new DataView(b.buffer, b.byteOffset).setUint32(4, 1, true), b)],
        ['truncated', (b) => b.slice(0, b.length - 333)],
      ]
      for (const [name, fn] of cases) {
        const { loader, server } = await rig()
        server.corrupt.set('sfx-core', fn)
        await expect(loader.loadPackBytes('sfx-core'), name).rejects.toThrow()
        server.corrupt.delete('sfx-core')
        const ok = await loader.loadPackBytes('sfx-core')
        expect(sha256Hex(ok), `${name}: a later clean fetch is accepted`).toBe((await metaOf('sfx-core')).sha256.toLowerCase())
      }
    })

    it('[T2-F8-03] rows with no SFX-pack chunk (Stream=1 speech/music) are an explicit, counted "unbaked" outcome: no entry, null buffer, no fetch, no decode', async () => {
      const { loader, server, ctx } = await rig()
      const unbaked = [2961, 4379, 4657]
      for (const id of unbaked) {
        expect(getOracle113c().sounds[id]!.stream, `row ${String(id)} is Stream=1`).toBe(true)
        expect(loader.hasEntry(id)).toBe(false)
        expect(loader.getEntry(id)).toBeNull()
      }
      const before = loader.stats.unbakedRequests
      for (const id of unbaked) expect(await loader.loadSoundBuffer(id), `row ${String(id)}`).toBeNull()
      expect(await loader.sliceChunk(2961)).toBeNull()
      expect(loader.stats.unbakedRequests - before).toBeGreaterThanOrEqual(unbaked.length)
      expect(server.calls).toEqual([])
      expect(ctx.decodes).toEqual([])
      expect(loader.hasEntry(332), 'none.wav row has no chunk').toBe(false)
    })

    it('[T2-F8-04] a platform decode failure is surfaced: decodeErrors +1, the pending record is stopped (not left dangling), never marked ready', async () => {
      const R = await recordsModule()
      const { loader } = await rig()
      const row = BACKGROUND.find((r) => isPlainOneShot(r))!
      FakeAudioContext.failDecodeSha = new Set([await chunkSha(row.id)])
      try {
        const rec = R.SoundRecords113c.fromSounds113c({
          rng: new D2Rng(7, 9),
          master: () => 100,
          paused: () => false,
          listenerPos: () => ({ x: 0, y: 0 }),
          voices: new RecordingVoices(),
          sampleFacts: (id: number) => ({ kind: 'pcm', ...oracleSampleFacts(id) }),
        })
        const h = rec.play(row.id, { asyncPending: true })
        const stop = vi.spyOn(rec, 'stop')
        const ready = vi.spyOn(rec, 'setAsyncReady')
        const outcome = await loader.prepareRecordPlayback(row.id, h, rec).then(
          (v) => ({ settled: 'resolved' as const, v }),
          (e: unknown) => ({ settled: 'rejected' as const, e }),
        )
        expect(['resolved', 'rejected']).toContain(outcome.settled)
        if (outcome.settled === 'resolved') expect(outcome.v).toBeNull()
        expect(loader.stats.decodeErrors).toBe(1)
        expect(stop).toHaveBeenCalledWith(h)
        expect(ready).not.toHaveBeenCalled()
      } finally {
        FakeAudioContext.failDecodeSha = new Set()
      }
      expect(await loader.loadSoundBuffer(4), 'other chunks still decode').toBeInstanceOf(FakeAudioBuffer)
    })

    it('[T2-F8-05] concurrent loadSoundBuffer calls for one id share a single decode', async () => {
      const { loader, ctx } = await rig()
      const [a, b, c] = await Promise.all([loader.loadSoundBuffer(17), loader.loadSoundBuffer(17), loader.loadSoundBuffer(17)])
      expect(ctx.decodes.length).toBe(1)
      expect(b).toBe(a)
      expect(c).toBe(a)
    })

    it('[T2-F8-06] hasEntry/getEntry mirror the generated index for every core id of both tiers', async () => {
      const { loader } = await rig()
      const { tuples } = await index()
      const bad: string[] = []
      for (const r of [...FIRST, ...BACKGROUND]) {
        const t = tuples[r.id]
        const e = loader.getEntry(r.id)
        if (t === undefined || !loader.hasEntry(r.id) || e === null || e.packId !== t[0] || e.byteOffset !== t[1] || e.byteLength !== t[2] || e.sampleRate !== t[3] || e.frames !== t[4] || e.channels !== t[5]) {
          bad.push(`row ${String(r.id)}: entry ${JSON.stringify(e)} tuple ${JSON.stringify(t)}`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T2-F8-07] LRU recency: touching an entry with getCachedBuffer protects it; the untouched one is evicted instead', async () => {
      const { tuples } = await index()
      const rows = distinctFiles(FIRST, 3, (r) => {
        const t = tuples[r.id]
        return t !== undefined && t[5] === 1 && t[4] >= 11_025 && t[4] <= 13_230
      })
      const decodedBytes = (id: number): number => Math.round((tuples[id]![4] / 22_050) * 48_000) * 4
      const { loader } = await rig({ maxCacheBytes: Math.floor(2.5 * Math.max(...rows.map((r) => decodedBytes(r.id)))) })
      await loader.loadSoundBuffer(rows[0]!.id)
      await loader.loadSoundBuffer(rows[1]!.id)
      expect(loader.getCachedBuffer(rows[0]!.id)).toBeInstanceOf(FakeAudioBuffer) // touch
      await loader.loadSoundBuffer(rows[2]!.id)
      expect(loader.getCachedBuffer(rows[1]!.id), 'least recently used').toBeUndefined()
      expect(loader.getCachedBuffer(rows[0]!.id)).toBeInstanceOf(FakeAudioBuffer)
      expect(loader.getCachedBuffer(rows[2]!.id)).toBeInstanceOf(FakeAudioBuffer)
    })

    it('[T2-F8-08] packs are fetched lazily per tier: background ids fetch only their part, first-screen ids only sfx-core', async () => {
      const { tuples } = await index()
      const bgRow = BACKGROUND[0]!
      const a = await rig()
      await a.loader.loadSoundBuffer(bgRow.id)
      expect(a.server.calls.map((c) => c.packId)).toEqual([tuples[bgRow.id]![0]])
      const b = await rig()
      await b.loader.loadSoundBuffer(FIRST[0]!.id)
      expect(b.server.calls.map((c) => c.packId)).toEqual(['sfx-core'])
    })
  })
})
