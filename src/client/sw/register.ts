/**
 * Browser Service Worker Registration & Asset Cache Manager (`src/client/sw/register.ts`).
 *
 * Responsibilities:
 * - Registers `./sw.js` and waits for an active Service Worker controller
 * - Fetches `./asset-manifest.json` (`cache: 'no-store'`), validates it via `validateAssetManifest`
 *   (fail-fast on missing/corrupt manifest), and syncs per-file SHA-256 hashes to the Service Worker
 * - Requests persistent storage (`navigator.storage.persist()`)
 * - Exposes `getAssetCacheStatus()` and `clearClientAssetCache()` for the Settings / Toolbar UI
 */

import {
  validateAssetManifest,
  type AssetManifest,
} from '../../common/pack-contract/index.ts'
import {
  ASSET_CACHE_NAME,
  META_CACHE_NAME,
  type SwCacheStats,
  type SwClearCacheAck,
  type SwClientToWorkerMessage,
  type SwStatsAck,
  type SwSyncManifestAck,
  type SwWorkerToClientMessage,
} from './protocol.ts'

export interface AssetCacheStatus {
  readonly enabled: boolean
  readonly manifestVersion: string | null
  readonly evictedCount: number
  readonly unchangedCount: number
  readonly cachedAssetCount: number
  readonly usageBytes: number
  readonly quotaBytes: number
  readonly persisted: boolean
  readonly error: string | null
}

export interface RegisterAssetCacheOptions {
  readonly swUrl?: string | undefined
  readonly manifestUrl?: string | undefined
  readonly forceEnable?: boolean | undefined
  readonly fetchFn?: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined
}

let lastManifest: AssetManifest | null = null
let lastSyncAck: SwSyncManifestAck | null = null
let lastError: string | null = null
let persistedGranted = false

/**
 * Determines whether the Service Worker should be enabled in the current environment.
 * Disabled by default on Vite dev server (`:5173`) unless `?sw=1` is present in URL query.
 */
export function shouldEnableAssetCacheSw(
  loc: { readonly protocol?: string; readonly hostname?: string; readonly port?: string; readonly search?: string } | undefined =
    typeof window !== 'undefined' ? window.location : undefined,
  forceEnable = false,
): boolean {
  if (forceEnable) return true
  if (!loc) return false
  const search = loc.search ?? ''
  if (search.includes('sw=0')) return false
  if (search.includes('sw=1')) return true
  // Disable by default on Vite HMR dev server port 5173 unless ?sw=1 is set
  if (loc.port === '5173') return false
  return true
}

/**
 * Sends a typed message to a Service Worker using a `MessageChannel` and awaits its acknowledgement.
 */
export function sendMessageToSw<T extends SwWorkerToClientMessage>(
  worker: ServiceWorker,
  message: SwClientToWorkerMessage,
  timeoutMs = 8000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => {
      channel.port1.onmessage = null
      reject(new Error(`Service Worker message ${message.type} timed out after ${String(timeoutMs)}ms`))
    }, timeoutMs)

    channel.port1.onmessage = (event: MessageEvent<T>) => {
      clearTimeout(timer)
      channel.port1.onmessage = null
      resolve(event.data)
    }

    worker.postMessage(message, [channel.port2])
  })
}

/**
 * Fetches and strictly validates `asset-manifest.json` with `cache: 'no-store'`.
 * Fails fast on HTTP errors or schema violations (Anti-Silent-Failure).
 */
export async function fetchAssetManifest(
  manifestUrl = './asset-manifest.json',
  fetchFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = (input, init) =>
    fetch(input, init),
): Promise<AssetManifest> {
  const response = await fetchFn(manifestUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${manifestUrl}: HTTP ${String(response.status)}`,
    )
  }
  const raw: unknown = await response.json()
  return validateAssetManifest(raw)
}

async function resolveActiveWorker(
  reg: ServiceWorkerRegistration,
): Promise<ServiceWorker | null> {
  if (reg.active) return reg.active
  const installingOrWaiting = reg.installing ?? reg.waiting
  if (!installingOrWaiting) return null

  return await new Promise<ServiceWorker | null>((resolve) => {
    const onStateChange = (): void => {
      if (installingOrWaiting.state === 'activated') {
        installingOrWaiting.removeEventListener('statechange', onStateChange)
        resolve(reg.active ?? installingOrWaiting)
      } else if (installingOrWaiting.state === 'redundant') {
        installingOrWaiting.removeEventListener('statechange', onStateChange)
        resolve(reg.active ?? null)
      }
    }
    installingOrWaiting.addEventListener('statechange', onStateChange)
    onStateChange()
  })
}

/**
 * Formats byte count into a human-readable megabyte label (e.g. `"14.2 MB"` or `"0.0 MB"`).
 */
export function formatCacheBytesMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 0.1) return '0.1 MB'
  return `${mb.toFixed(1)} MB`
}

/**
 * Registers `./sw.js`, requests persistent storage, fetches `./asset-manifest.json`,
 * and performs incremental per-file cache invalidation on the Service Worker.
 */
export async function registerAssetCache(
  options?: RegisterAssetCacheOptions,
): Promise<AssetCacheStatus> {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !navigator.serviceWorker
  ) {
    return await getAssetCacheStatus()
  }

  if (!shouldEnableAssetCacheSw(window.location, options?.forceEnable ?? false)) {
    return await getAssetCacheStatus()
  }

  const swUrl = options?.swUrl ?? './sw.js'
  const manifestUrl = options?.manifestUrl ?? './asset-manifest.json'
  const fetchFn = options?.fetchFn ?? ((input, init) => fetch(input, init))

  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      persistedGranted = await navigator.storage.persist().catch(() => false)
    }
  } catch {
    persistedGranted = false
  }

  try {
    const manifest = await fetchAssetManifest(manifestUrl, fetchFn)
    lastManifest = manifest

    const reg = await navigator.serviceWorker.register(swUrl, {
      scope: './',
      type: 'module',
    })
    const worker = (await resolveActiveWorker(reg)) ?? navigator.serviceWorker.controller
    if (!worker) {
      throw new Error('Service Worker registered but failed to activate')
    }

    const ack = await sendMessageToSw<SwSyncManifestAck>(worker, {
      type: 'D2_SW_SYNC_MANIFEST',
      manifest,
    })
    if (!ack.ok) {
      throw new Error(ack.error ?? 'Service Worker rejected asset-manifest.json')
    }
    lastSyncAck = ack
    lastError = null
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
    console.warn('[d2web-cache] Asset cache initialization failed:', lastError)
  }

  return await getAssetCacheStatus()
}

/**
 * Queries current Cache Storage entry count and browser storage estimate.
 */
export async function getAssetCacheStatus(): Promise<AssetCacheStatus> {
  let cachedAssetCount = 0
  let usageBytes = 0
  let quotaBytes = 0

  try {
    if (typeof caches !== 'undefined' && typeof caches.open === 'function') {
      const cache = await caches.open(ASSET_CACHE_NAME)
      const keys = await cache.keys()
      cachedAssetCount = keys.length
    }
  } catch {
    // Ignore in environments without CacheStorage
  }

  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.estimate === 'function'
    ) {
      const est = await navigator.storage.estimate()
      usageBytes = est.usage ?? 0
      quotaBytes = est.quota ?? 0
    }
  } catch {
    // Ignore in environments without StorageManager
  }

  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.serviceWorker?.controller
    ) {
      const ack = await sendMessageToSw<SwStatsAck>(
        navigator.serviceWorker.controller,
        { type: 'D2_SW_GET_STATS' },
        2000,
      )
      if (ack.ok && ack.stats) {
        cachedAssetCount = ack.stats.cachedAssetCount
      }
    }
  } catch {
    // Fallback to direct caches.open count above
  }

  return {
    enabled: lastSyncAck !== null && lastError === null,
    manifestVersion: lastSyncAck?.version ?? lastManifest?.version ?? null,
    evictedCount: lastSyncAck?.evictedCount ?? 0,
    unchangedCount: lastSyncAck?.unchangedCount ?? 0,
    cachedAssetCount,
    usageBytes,
    quotaBytes,
    persisted: persistedGranted,
    error: lastError,
  }
}

/**
 * Clears all cached art and JSON assets from Cache Storage (`d2web-assets-v1`)
 * and re-primes the active manifest so subsequent loads in the session can cache cleanly.
 */
export async function clearClientAssetCache(): Promise<{
  readonly deletedEntries: number
  readonly status: AssetCacheStatus
}> {
  let deletedEntries = 0

  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.serviceWorker?.controller
    ) {
      const ack = await sendMessageToSw<SwClearCacheAck>(
        navigator.serviceWorker.controller,
        { type: 'D2_SW_CLEAR_CACHE' },
        4000,
      )
      if (ack.ok) {
        deletedEntries = ack.deletedEntries
      }
    }
  } catch {
    // Also clear directly via window.caches below
  }

  try {
    if (typeof caches !== 'undefined') {
      if (deletedEntries === 0) {
        const c = await caches.open(ASSET_CACHE_NAME)
        deletedEntries = (await c.keys()).length
      }
      await caches.delete(ASSET_CACHE_NAME)
      await caches.delete(META_CACHE_NAME)
    }
  } catch {
    // Ignore if CacheStorage unavailable
  }

  // Re-sync manifest if we already have one in memory so future loads in this session still cache
  try {
    if (
      lastManifest &&
      typeof navigator !== 'undefined' &&
      navigator.serviceWorker?.controller
    ) {
      lastSyncAck = await sendMessageToSw<SwSyncManifestAck>(
        navigator.serviceWorker.controller,
        {
          type: 'D2_SW_SYNC_MANIFEST',
          manifest: lastManifest,
        },
        4000,
      )
    }
  } catch {
    // Ignore
  }

  const status = await getAssetCacheStatus()
  return { deletedEntries, status }
}

export type { SwCacheStats }
