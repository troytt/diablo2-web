/**
 * Diablo II v1.13c Core SFX Chunk Loader (`src/client/audio/sfx-chunk-loader.ts`, #944 F8).
 *
 * Implements single-flight pack fetching (`sfx-core.bin`, `sfx-core-2.bin`, `sfx-core-3.bin`),
 * `D2SP` v2 header + size validation, per-chunk `ArrayBuffer.prototype.slice` (D5: Web Audio
 * `decodeAudioData` detaches its input buffer), bounded-LRU `AudioBuffer` cache (D6), and
 * `SoundRecords113c` async-pending handshake (`prepareRecordPlayback`).
 */

import {
  SFX_PACKS_113C,
  getSfxPackEntry113c,
  getSfxPackMeta113c,
  validateSfxChunkSlice113c,
  validateSfxPackHeader113c,
  type SfxPackEntry113c,
  type SfxPackMeta113c,
} from '../../common/audio/sfx-pack-index-113c.ts'

export const DEFAULT_SFX_CACHE_MAX_BYTES_113C = 16 * 1024 * 1024

export type SfxFetchPackFn = (
  packId: string,
  url: string,
) => Promise<ArrayBuffer | Uint8Array | Response>

export type SfxFetchUrlFn = (
  url: string,
  packId?: string,
) => Promise<ArrayBuffer | Uint8Array | Response>

export interface SfxChunkLoaderOptions {
  readonly fetchPack?: SfxFetchPackFn | undefined
  readonly fetch?: SfxFetchUrlFn | undefined
  readonly fetchFn?: SfxFetchUrlFn | undefined
  readonly getContext?: (() => BaseAudioContext | null) | undefined
  readonly audioContext?: BaseAudioContext | (() => BaseAudioContext | null) | null | undefined
  readonly ctx?: BaseAudioContext | (() => BaseAudioContext | null) | null | undefined
  readonly maxCacheBytes?: number | undefined
}

export interface SfxChunkLoaderStats {
  readonly packFetches: number
  readonly decodes: number
  readonly decodeErrors: number
  readonly unbakedRequests: number
}

export interface AsyncRecordController113c {
  setAsyncReady(handle: number): void
  stop(handle: number): void
}

interface CachedBufferEntry {
  readonly buffer: AudioBuffer
  readonly byteLength: number
}

async function defaultFetchPack(packId: string, url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`SfxChunkLoader: failed to fetch ${packId} (${url}): HTTP ${String(res.status)}`)
  }
  return await res.arrayBuffer()
}

async function toOwnedUint8Array(
  raw: ArrayBuffer | Uint8Array | Response | { readonly ok?: boolean; readonly status?: number; arrayBuffer(): Promise<ArrayBuffer> },
): Promise<Uint8Array> {
  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw)
  }
  if (raw instanceof Uint8Array) {
    if (raw.byteOffset === 0 && raw.byteLength === raw.buffer.byteLength) {
      return raw
    }
    return new Uint8Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
  }
  if (typeof Response !== 'undefined' && raw instanceof Response) {
    if (!raw.ok) {
      throw new Error(`SfxChunkLoader: HTTP ${String(raw.status)}`)
    }
    return new Uint8Array(await raw.arrayBuffer())
  }
  if (
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as { readonly arrayBuffer?: unknown }).arrayBuffer === 'function'
  ) {
    const respLike = raw as {
      readonly ok?: boolean
      readonly status?: number
      arrayBuffer(): Promise<ArrayBuffer>
    }
    if (respLike.ok === false) {
      throw new Error(`SfxChunkLoader: HTTP ${String(respLike.status ?? 0)}`)
    }
    return new Uint8Array(await respLike.arrayBuffer())
  }
  throw new TypeError('SfxChunkLoader: fetchPack returned unsupported payload type')
}

function estimateAudioBufferBytes(buffer: AudioBuffer): number {
  const channels = Math.max(1, buffer.numberOfChannels || 1)
  const frames = Math.max(0, buffer.length || 0)
  return Math.max(1, frames * channels * 4)
}

function resolveContextGetter(
  options?: SfxChunkLoaderOptions,
): (() => BaseAudioContext | null) | undefined {
  if (options?.getContext !== undefined) return options.getContext
  const candidate = options?.audioContext ?? options?.ctx
  if (candidate === undefined) return undefined
  if (typeof candidate === 'function') {
    return candidate as () => BaseAudioContext | null
  }
  return () => candidate
}

export class SfxChunkLoader {
  private readonly fetchPackFn: SfxFetchPackFn
  private readonly getContextFn: (() => BaseAudioContext | null) | undefined
  private readonly maxCacheBytes: number

  private readonly packCache = new Map<string, Uint8Array>()
  private readonly inFlightPacks = new Map<string, Promise<Uint8Array>>()
  private readonly inFlightDecodes = new Map<number, Promise<AudioBuffer | null>>()
  private readonly bufferLru = new Map<number, CachedBufferEntry>()
  private cachedBytes = 0

  private _packFetches = 0
  private _decodes = 0
  private _decodeErrors = 0
  private _unbakedRequests = 0

  constructor(options?: SfxChunkLoaderOptions) {
    const urlFetcher = options?.fetch ?? options?.fetchFn
    this.fetchPackFn =
      options?.fetchPack ??
      (urlFetcher !== undefined ? (packId, url) => urlFetcher(url, packId) : defaultFetchPack)
    this.getContextFn = resolveContextGetter(options)
    const cap = options?.maxCacheBytes ?? DEFAULT_SFX_CACHE_MAX_BYTES_113C
    this.maxCacheBytes = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : DEFAULT_SFX_CACHE_MAX_BYTES_113C
  }

  get stats(): SfxChunkLoaderStats {
    return {
      packFetches: this._packFetches,
      decodes: this._decodes,
      decodeErrors: this._decodeErrors,
      unbakedRequests: this._unbakedRequests,
    }
  }

  hasEntry(id: number): boolean {
    return getSfxPackEntry113c(id) !== undefined
  }

  getEntry(id: number): SfxPackEntry113c | null {
    return getSfxPackEntry113c(id) ?? null
  }

  getPackMeta(packId: string): SfxPackMeta113c | undefined {
    return getSfxPackMeta113c(packId)
  }

  listPacks(): readonly SfxPackMeta113c[] {
    return SFX_PACKS_113C
  }

  getCachedBuffer(id: number): AudioBuffer | undefined {
    const entry = this.bufferLru.get(id)
    if (entry === undefined) return undefined
    // Refresh LRU order on read
    this.bufferLru.delete(id)
    this.bufferLru.set(id, entry)
    return entry.buffer
  }

  preloadPack(packId: string): Promise<Uint8Array> {
    return this.loadPackBytes(packId)
  }

  async loadPackBytes(packId: string): Promise<Uint8Array> {
    const cached = this.packCache.get(packId)
    if (cached !== undefined) {
      return cached
    }
    const existing = this.inFlightPacks.get(packId)
    if (existing !== undefined) {
      return await existing
    }
    const meta = getSfxPackMeta113c(packId)
    if (meta === undefined) {
      throw new Error(`SfxChunkLoader.loadPackBytes: unknown packId ${JSON.stringify(packId)}`)
    }

    const promise = (async (): Promise<Uint8Array> => {
      this._packFetches += 1
      const raw = await this.fetchPackFn(packId, meta.url)
      const bytes = await toOwnedUint8Array(raw)
      validateSfxPackHeader113c(bytes, { bytes: meta.bytes, chunkCount: meta.chunkCount })
      this.packCache.set(packId, bytes)
      return bytes
    })()

    this.inFlightPacks.set(packId, promise)
    try {
      return await promise
    } finally {
      this.inFlightPacks.delete(packId)
    }
  }

  prefetch(packId: string): void {
    if (this.packCache.has(packId) || this.inFlightPacks.has(packId)) {
      return
    }
    void this.loadPackBytes(packId).catch(() => {
      // Prefetch errors are non-fatal; subsequent on-demand loadPackBytes will retry
    })
  }

  async sliceChunk(id: number): Promise<ArrayBuffer | null> {
    const entry = this.getEntry(id)
    if (entry === null) {
      this._unbakedRequests += 1
      return null
    }
    const packBytes = await this.loadPackBytes(entry.packId)
    if (!validateSfxChunkSlice113c(entry.byteOffset, entry.byteLength, packBytes.byteLength)) {
      throw new Error(
        `SfxChunkLoader.sliceChunk: invalid slice [${String(entry.byteOffset)}, +${String(entry.byteLength)}) in ${entry.packId} (${String(packBytes.byteLength)} B)`,
      )
    }
    const start = packBytes.byteOffset + entry.byteOffset
    return packBytes.buffer.slice(start, start + entry.byteLength) as ArrayBuffer
  }

  async loadSoundBuffer(id: number, ctx?: BaseAudioContext | null): Promise<AudioBuffer | null> {
    const cached = this.getCachedBuffer(id)
    if (cached !== undefined) {
      return cached
    }
    const entry = this.getEntry(id)
    if (entry === null) {
      this._unbakedRequests += 1
      return null
    }
    const inflight = this.inFlightDecodes.get(id)
    if (inflight !== undefined) {
      return await inflight
    }
    const audioCtx = ctx ?? this.getContextFn?.() ?? null
    if (audioCtx === null) {
      throw new Error(`SfxChunkLoader.loadSoundBuffer(${String(id)}): no AudioContext available`)
    }

    const promise = (async (): Promise<AudioBuffer | null> => {
      const chunkBuffer = await this.sliceChunk(id)
      if (chunkBuffer === null) return null
      try {
        const decoded = await audioCtx.decodeAudioData(chunkBuffer)
        this._decodes += 1
        this.insertCachedBuffer(id, decoded)
        return decoded
      } catch (err) {
        this._decodeErrors += 1
        throw err
      }
    })()

    this.inFlightDecodes.set(id, promise)
    try {
      return await promise
    } finally {
      this.inFlightDecodes.delete(id)
    }
  }

  async prepareRecordPlayback(
    id: number,
    handle: number,
    records: AsyncRecordController113c,
    ctx?: BaseAudioContext | null,
  ): Promise<AudioBuffer | null> {
    try {
      const buffer = await this.loadSoundBuffer(id, ctx)
      if (buffer !== null) {
        if (handle > 0) {
          records.setAsyncReady(handle)
        }
        return buffer
      }
      if (handle > 0) {
        records.stop(handle)
      }
      return null
    } catch {
      if (handle > 0) {
        records.stop(handle)
      }
      return null
    }
  }

  private insertCachedBuffer(id: number, buffer: AudioBuffer): void {
    const existing = this.bufferLru.get(id)
    if (existing !== undefined) {
      this.cachedBytes -= existing.byteLength
      this.bufferLru.delete(id)
    }
    const byteLength = estimateAudioBufferBytes(buffer)
    while (this.bufferLru.size > 0 && this.cachedBytes + byteLength > this.maxCacheBytes) {
      const oldestKey = this.bufferLru.keys().next().value
      if (oldestKey === undefined) break
      const oldest = this.bufferLru.get(oldestKey)!
      this.cachedBytes -= oldest.byteLength
      this.bufferLru.delete(oldestKey)
    }
    if (byteLength <= this.maxCacheBytes || this.bufferLru.size === 0) {
      this.bufferLru.set(id, { buffer, byteLength })
      this.cachedBytes += byteLength
    }
  }
}
