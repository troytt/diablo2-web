/**
 * Service Worker for Diablo II Web Client (`src/client/sw/sw.ts`).
 *
 * Implements:
 * - On-demand `cache-first` caching in Cache Storage (`d2web-assets-v1`) for loaded art/JSON/bin assets
 * - Per-file SHA-256 incremental cache invalidation driven by `asset-manifest.json`
 * - Strict 200-only response filter (never caches 206 Range, 304, 4xx, 5xx, or opaque responses)
 * - Direct pass-through for `.mpq` archives and HTTP `Range` requests (handled by `BrowserOpfsChunkCache`)
 * - Fail-fast manifest validation (never serves stale cached pack assets before a valid manifest is synced)
 */

import {
  diffAssetManifests,
  isCacheableAssetPath,
  normalizeAssetManifestPath,
  validateAssetManifest,
  type AssetManifest,
} from '../../common/pack-contract/index.ts'
import {
  ASSET_CACHE_NAME,
  META_CACHE_NAME,
  StoredManifestUrl,
  type CacheStorageLike,
  type SwCacheStats,
  type SwClearCacheAck,
  type SwClientToWorkerMessage,
  type SwStatsAck,
  type SwSyncManifestAck,
} from './protocol.ts'

const IMMUTABLE_VITE_ASSET_RE = /^assets\/.+-[a-zA-Z0-9_-]{8,}\.(?:js|css|woff2?|ttf|otf)$/i

/**
 * D15 Service Worker audio pre-cache policy:
 * Only `sound/packs/sfx-core.bin` is eligible for install/boot pre-caching.
 * Ambient packs, skill packs, monster packs, music `.webm`, and speech `.webm`
 * are cached on demand (`cache-first` upon first HTTP 200 fetch).
 */
export const PRECACHE_AUDIO_URLS_113C: readonly string[] = Object.freeze(['/sound/packs/sfx-core.bin'])
export const SW_PRECACHE_URLS: readonly string[] = PRECACHE_AUDIO_URLS_113C
export const PRECACHE_URLS: readonly string[] = PRECACHE_AUDIO_URLS_113C

export interface AssetCacheControllerOptions {
  readonly caches: CacheStorageLike
  readonly fetchFn: (input: Request | string, init?: RequestInit) => Promise<Response>
  readonly origin: string
  readonly onQuotaError?: ((url: string, err: unknown) => void) | undefined
}

/**
 * Returns true if the asset path is a Vite content-hashed immutable bundle (`assets/*-[hash].js|css`).
 */
export function isImmutableHashedAsset(urlOrPath: string): boolean {
  const norm = normalizeAssetManifestPath(urlOrPath)
  return IMMUTABLE_VITE_ASSET_RE.test(norm)
}

/**
 * Returns true if the request must bypass Service Worker Cache Storage interception:
 * - Non-GET requests
 * - Cross-origin requests
 * - Requests carrying a `Range` header (e.g. MPQ range reads)
 * - HTML navigation requests (`mode === 'navigate'`)
 * - `.mpq` files, `asset-manifest.json`, `sw.js`, `/d2net`, `/ws/`
 */
export function shouldBypassCache(request: Request, scopeOrigin: string): boolean {
  if (request.method !== 'GET') return true
  if (request.mode === 'navigate') return true
  if (request.headers.get('range') !== null || request.headers.get('Range') !== null) {
    return true
  }

  let parsed: URL
  try {
    parsed = new URL(request.url, scopeOrigin)
  } catch {
    return true
  }

  if (parsed.origin !== scopeOrigin) {
    return true
  }

  return !isCacheableAssetPath(parsed.pathname)
}

/**
 * Returns true ONLY for full HTTP 200 OK non-opaque responses.
 * Never caches 206 Partial Content, 304 Not Modified, 4xx/5xx errors, or opaque responses.
 */
export function isCacheableResponse(response: Response): boolean {
  if (!response) return false
  if (response.status !== 200 || !response.ok) return false
  if (response.type === 'opaque' || response.type === 'error' || response.type === 'opaqueredirect') {
    return false
  }
  return true
}

/**
 * Returns true if the error thrown by `Cache.put()` is an actual storage quota error
 * (`QuotaExceededError` / `NS_ERROR_DOM_QUOTA_REACHED`) rather than a transient stream/network abort.
 */
export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err && typeof err.name === 'string' ? err.name : ''
  const message = 'message' in err && typeof err.message === 'string' ? err.message : ''
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota/i.test(name) ||
    /quota/i.test(message)
  )
}

export class AssetCacheServiceWorkerController {
  private readonly caches: CacheStorageLike
  private readonly fetchFn: (input: Request | string, init?: RequestInit) => Promise<Response>
  private readonly origin: string
  private readonly onQuotaError?: ((url: string, err: unknown) => void) | undefined

  private activeManifest: AssetManifest | null = null
  private manifestLoadPromise: Promise<AssetManifest | null> | null = null
  private syncInFlight: Promise<SwSyncManifestAck> | null = null
  private readonly inFlightFetches = new Map<string, Promise<Response>>()

  private cacheHits = 0
  private cacheMisses = 0
  private networkPassThroughs = 0
  private quotaErrors = 0

  constructor(options: AssetCacheControllerOptions) {
    this.caches = options.caches
    this.fetchFn = options.fetchFn
    this.origin = options.origin
    this.onQuotaError = options.onQuotaError
  }

  private async loadStoredManifest(): Promise<AssetManifest | null> {
    if (this.activeManifest) return this.activeManifest
    if (this.manifestLoadPromise) return this.manifestLoadPromise

    this.manifestLoadPromise = (async () => {
      try {
        const metaCache = await this.caches.open(META_CACHE_NAME)
        const res = await metaCache.match(StoredManifestUrl)
        if (!res) return null
        const raw: unknown = await res.json()
        const validated = validateAssetManifest(raw)
        this.activeManifest = validated
        return validated
      } catch {
        return null
      } finally {
        this.manifestLoadPromise = null
      }
    })()

    return this.manifestLoadPromise
  }

  /**
   * Synchronizes a newly fetched `AssetManifest`, evicting ONLY cached entries whose
   * content hash changed or that were removed from the manifest.
   */
  async syncManifest(rawManifest: unknown): Promise<SwSyncManifestAck> {
    const run = async (): Promise<SwSyncManifestAck> => {
      const nextManifest = validateAssetManifest(rawManifest)
      const prevManifest = await this.loadStoredManifest()

      const diff = diffAssetManifests(prevManifest, nextManifest)
      const assetCache = await this.caches.open(ASSET_CACHE_NAME)
      const evictedPaths: string[] = []

      if (prevManifest === null) {
        // First sync or recovered after meta reset: evict any cached pack/art asset
        // that is not present in nextManifest (except immutable hashed JS/CSS bundles).
        const keys = await assetCache.keys()
        for (const req of keys) {
          const normPath = normalizeAssetManifestPath(req.url)
          if (!isImmutableHashedAsset(normPath) && !(normPath in nextManifest.files)) {
            const deleted = await assetCache.delete(req)
            if (deleted) evictedPaths.push(normPath)
          }
        }
      } else if (diff.changedOrRemoved.length > 0) {
        const evictSet = new Set(diff.changedOrRemoved)
        const keys = await assetCache.keys()
        for (const req of keys) {
          const normPath = normalizeAssetManifestPath(req.url)
          if (evictSet.has(normPath)) {
            const deleted = await assetCache.delete(req)
            if (deleted) evictedPaths.push(normPath)
          }
        }
      }

      const metaCache = await this.caches.open(META_CACHE_NAME)
      await metaCache.put(
        StoredManifestUrl,
        new Response(JSON.stringify(nextManifest), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      this.activeManifest = nextManifest

      return {
        type: 'D2_SW_SYNC_MANIFEST_ACK',
        ok: true,
        version: nextManifest.version,
        evictedCount: evictedPaths.length,
        evictedPaths,
        unchangedCount: diff.unchangedCount,
      }
    }

    const p = (this.syncInFlight ?? Promise.resolve()).then(run, run)
    this.syncInFlight = p
    try {
      return await p
    } finally {
      if (this.syncInFlight === p) {
        this.syncInFlight = null
      }
    }
  }

  /**
   * Clears all cached assets and stored manifest metadata.
   */
  async clearCache(): Promise<SwClearCacheAck> {
    const assetCache = await this.caches.open(ASSET_CACHE_NAME)
    const keys = await assetCache.keys()
    const deletedEntries = keys.length
    await this.caches.delete(ASSET_CACHE_NAME)
    await this.caches.delete(META_CACHE_NAME)
    this.activeManifest = null
    this.inFlightFetches.clear()
    this.cacheHits = 0
    this.cacheMisses = 0
    return {
      type: 'D2_SW_CLEAR_CACHE_ACK',
      ok: true,
      deletedEntries,
    }
  }

  /**
   * Returns current cache hit/miss and entry count statistics.
   */
  async getStats(): Promise<SwCacheStats> {
    const manifest = await this.loadStoredManifest()
    const assetCache = await this.caches.open(ASSET_CACHE_NAME)
    const keys = await assetCache.keys()
    return {
      manifestReady: manifest !== null,
      manifestVersion: manifest?.version ?? null,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      networkPassThroughs: this.networkPassThroughs,
      quotaErrors: this.quotaErrors,
      cachedAssetCount: keys.length,
    }
  }

  /**
   * Handles a `fetch` request with manifest-gated `cache-first` semantics.
   */
  async handleFetch(request: Request): Promise<Response> {
    if (shouldBypassCache(request, this.origin)) {
      this.networkPassThroughs += 1
      return await this.fetchFn(request)
    }

    try {
      if (this.syncInFlight) {
        try {
          await this.syncInFlight
        } catch {
          // Sync failure handled below by manifestReady check
        }
      }

      const immutableAsset = isImmutableHashedAsset(request.url)
      const manifest = immutableAsset ? this.activeManifest : await this.loadStoredManifest()

      // Anti-Silent-Failure: if no valid manifest has been synced and this is not a content-hashed bundle,
      // do not serve or populate potentially stale pack assets.
      if (!immutableAsset && manifest === null) {
        this.networkPassThroughs += 1
        return await this.fetchFn(request)
      }

      const assetCache = await this.caches.open(ASSET_CACHE_NAME)
      const cached = await assetCache.match(request)
      if (cached) {
        this.cacheHits += 1
        return cached.clone()
      }

      const existingInFlight = this.inFlightFetches.get(request.url)
      if (existingInFlight) {
        this.cacheHits += 1
        const shared = await existingInFlight
        return shared.clone()
      }

      this.cacheMisses += 1
      const fetchAndCachePromise = (async (): Promise<Response> => {
        const response = await this.fetchFn(request)
        if (isCacheableResponse(response)) {
          try {
            await assetCache.put(request, response.clone())
          } catch (err) {
            await assetCache.delete(request).catch(() => false)
            this.quotaErrors += 1
            this.onQuotaError?.(request.url, err)
          }
        }
        return response
      })()

      this.inFlightFetches.set(request.url, fetchAndCachePromise)
      try {
        const response = await fetchAndCachePromise
        return response.clone()
      } finally {
        if (this.inFlightFetches.get(request.url) === fetchAndCachePromise) {
          this.inFlightFetches.delete(request.url)
        }
      }
    } catch (swErr) {
      // SW cache resilience fallback: any internal CacheStorage/manifest/SW failure
      // automatically falls through to direct network fetch instead of failing the request in the page.
      console.warn(`[d2web-sw] Cache handling error for ${request.url}, falling through to network:`, swErr)
      this.networkPassThroughs += 1
      return await this.fetchFn(request)
    }
  }

  /**
   * D15 pre-caches ONLY `/sound/packs/sfx-core.bin` into Cache Storage.
   * All other audio assets (ambient/skill/monster packs, music `.webm`, speech `.webm`)
   * are populated on-demand via `handleFetch()`.
   */
  async precacheCoreAudio(): Promise<void> {
    const assetCache = await this.caches.open(ASSET_CACHE_NAME)
    for (const relUrl of PRECACHE_AUDIO_URLS_113C) {
      const fullUrl = new URL(relUrl, this.origin || 'http://localhost').toString()
      const req = new Request(fullUrl, { method: 'GET' })
      const existing = await assetCache.match(req)
      if (existing) continue
      const res = await this.fetchFn(req)
      if (isCacheableResponse(res)) {
        try {
          await assetCache.put(req, res.clone())
        } catch (err) {
          this.quotaErrors += 1
          this.onQuotaError?.(req.url, err)
        }
      }
    }
  }

  async precache(): Promise<void> {
    await this.precacheCoreAudio()
  }

  /**
   * Handles a client `postMessage` command (`D2_SW_SYNC_MANIFEST`, `D2_SW_CLEAR_CACHE`, `D2_SW_GET_STATS`).
   */
  async handleMessage(
    msg: SwClientToWorkerMessage,
  ): Promise<SwSyncManifestAck | SwClearCacheAck | SwStatsAck> {
    if (!msg || typeof msg !== 'object' || !('type' in msg)) {
      throw new Error('Invalid Service Worker message')
    }
    switch (msg.type) {
      case 'D2_SW_SYNC_MANIFEST':
        return await this.syncManifest(msg.manifest)
      case 'D2_SW_CLEAR_CACHE':
        return await this.clearCache()
      case 'D2_SW_GET_STATS':
        return {
          type: 'D2_SW_STATS_ACK',
          ok: true,
          stats: await this.getStats(),
        }
    }
  }
}

interface SwExtendableEventLike extends Event {
  waitUntil(f: Promise<unknown>): void
}

interface SwFetchEventLike extends SwExtendableEventLike {
  readonly request: Request
  respondWith(r: Promise<Response> | Response): void
}

interface SwMessageEventLike extends SwExtendableEventLike {
  readonly data: unknown
  readonly ports: readonly MessagePort[]
}

interface SwGlobalScopeLike {
  readonly location: { readonly origin: string }
  readonly caches: CacheStorageLike
  readonly clients: { claim(): Promise<void> }
  skipWaiting(): Promise<void>
  addEventListener(type: string, listener: (event: Event) => void): void
}

function bindServiceWorkerGlobal(): void {
  if (typeof self === 'undefined') return
  const scope = self as unknown as Partial<SwGlobalScopeLike>
  if (
    typeof scope.skipWaiting !== 'function' ||
    !scope.clients ||
    typeof scope.clients.claim !== 'function' ||
    !scope.caches
  ) {
    return
  }

  const controller = new AssetCacheServiceWorkerController({
    caches: scope.caches,
    fetchFn: (input, init) => fetch(input, init),
    origin: scope.location?.origin ?? '',
    onQuotaError: (url, err) => {
      if (isQuotaExceededError(err)) {
        console.warn(`[d2web-sw] Cache Storage quota exceeded for ${url}:`, err)
      } else {
        console.warn(`[d2web-sw] Cache.put skipped due to transient network/stream error for ${url}:`, err)
      }
    },
  })

  scope.addEventListener!('install', (ev) => {
    const ext = ev as SwExtendableEventLike
    ext.waitUntil(scope.skipWaiting!())
  })

  scope.addEventListener!('activate', (ev) => {
    const ext = ev as SwExtendableEventLike
    ext.waitUntil(scope.clients!.claim())
  })

  scope.addEventListener!('fetch', (ev) => {
    const fetchEv = ev as SwFetchEventLike
    if (shouldBypassCache(fetchEv.request, scope.location?.origin ?? '')) {
      return
    }
    fetchEv.respondWith(
      controller.handleFetch(fetchEv.request).catch(async (err: unknown) => {
        console.warn(
          `[d2web-sw] Unhandled handleFetch error for ${fetchEv.request.url}, falling back to network fetch:`,
          err,
        )
        return await fetch(fetchEv.request)
      }),
    )
  })

  scope.addEventListener!('message', (ev) => {
    const msgEv = ev as SwMessageEventLike
    const replyPort = msgEv.ports?.[0]
    const raw = msgEv.data as SwClientToWorkerMessage
    const work = controller
      .handleMessage(raw)
      .then((ack) => {
        replyPort?.postMessage(ack)
      })
      .catch((err: unknown) => {
        replyPort?.postMessage({
          type: 'D2_SW_SYNC_MANIFEST_ACK',
          ok: false,
          version: '',
          evictedCount: 0,
          evictedPaths: [],
          unchangedCount: 0,
          error: err instanceof Error ? err.message : String(err),
        } satisfies SwSyncManifestAck)
      })
    msgEv.waitUntil(work)
  })
}

bindServiceWorkerGlobal()
