/**
 * Cross-instance static resource memory pool (`SharedAssetPool`) for single-Tab
 * multi-instance (`multibox`) architecture (#1362).
 *
 * Ensures static read-only game data, DRLG bundles, UI images, and SFX chunk
 * buffers are fetched and decoded once in browser memory, while each game
 * instance owns its own isolated WebGL2 context, network sockets, and unit state.
 */

import { SfxChunkLoader, type SfxChunkLoaderOptions } from '../audio/sfx-chunk-loader.ts'
import { createEnvFromPackedBundle } from '../map/map-worker.ts'
import type { DrlgMapContext } from '../../common/drlg/drlg-map.ts'
import type {
  PackedDrlgBundleManifest,
  PackedTileCatalogIndex,
} from '../../common/pack-contract/index.ts'
import type { DrlgEnv } from '../../common/drlg/drlg-types.ts'
import type { TileAtlas } from '../map/tile-atlas.ts'

export interface SharedDrlgBundleEntry {
  readonly env: DrlgEnv
  readonly ctx: DrlgMapContext
  readonly tileAtlas: TileAtlas
}

export class SharedAssetPool {
  private static instance: SharedAssetPool | null = null

  static getGlobal(): SharedAssetPool {
    if (!SharedAssetPool.instance) {
      SharedAssetPool.instance = new SharedAssetPool()
    }
    return SharedAssetPool.instance
  }

  static resetGlobalForTesting(): void {
    SharedAssetPool.instance = null
  }

  private readonly drlgBundlePromises = new Map<string, Promise<SharedDrlgBundleEntry>>()
  private readonly drlgBundleEntries = new Map<string, SharedDrlgBundleEntry>()
  private readonly jsonCache = new Map<string, Promise<unknown>>()
  private readonly binaryCache = new Map<string, Promise<ArrayBuffer>>()
  private readonly blobCache = new Map<string, Promise<Blob>>()
  private readonly imageCache = new Map<string, Promise<HTMLImageElement | null>>()
  private sharedSfxLoader: SfxChunkLoader | null = null

  /**
   * Returns a shared `SfxChunkLoader` so `.bin` sound packs and decoded
   * `AudioBuffer` LRU entries are shared across all instances in the tab.
   */
  getSharedSfxChunkLoader(options?: SfxChunkLoaderOptions): SfxChunkLoader {
    if (!this.sharedSfxLoader) {
      this.sharedSfxLoader = new SfxChunkLoader(options)
    }
    return this.sharedSfxLoader
  }

  getSharedSfxLoader(options?: SfxChunkLoaderOptions): SfxChunkLoader {
    return this.getSharedSfxChunkLoader(options)
  }

  clear(): void {
    this.drlgBundlePromises.clear()
    this.drlgBundleEntries.clear()
    this.jsonCache.clear()
    this.binaryCache.clear()
    this.blobCache.clear()
    this.imageCache.clear()
    this.sharedSfxLoader = null
  }

  /**
   * Loads (or returns the cached) DRLG bundle (`index.json` + `drlg-bundle.json` + `drlg-bundle.bin`)
   * and `TileAtlas` for a given `baseUrl`. Avoids duplicating the ~30MB ArrayBuffer across instances.
   */
  async getOrLoadDrlgBundle(baseUrl: string): Promise<SharedDrlgBundleEntry> {
    const cleanBase = baseUrl.replace(/\/+$/, '')
    const cached = this.drlgBundleEntries.get(cleanBase)
    if (cached) return cached

    let pending = this.drlgBundlePromises.get(cleanBase)
    if (!pending) {
      pending = (async () => {
        const [indexRes, manifestRes, bundleRes] = await Promise.all([
          fetch(`${cleanBase}/index.json`),
          fetch(`${cleanBase}/drlg-bundle.json`),
          fetch(`${cleanBase}/drlg-bundle.bin`),
        ])
        if (!indexRes.ok) {
          throw new Error(
            `MapService.fromPackedUrlsLazy: failed to fetch index.json (${String(indexRes.status)})`,
          )
        }
        if (!manifestRes.ok) {
          throw new Error(
            `MapService.fromPackedUrlsLazy: failed to fetch drlg-bundle.json (${String(manifestRes.status)})`,
          )
        }
        if (!bundleRes.ok) {
          throw new Error(
            `MapService.fromPackedUrlsLazy: failed to fetch drlg-bundle.bin (${String(bundleRes.status)})`,
          )
        }
        const [catalogIndex, manifest, bundleBuffer] = await Promise.all([
          indexRes.json() as Promise<PackedTileCatalogIndex>,
          manifestRes.json() as Promise<PackedDrlgBundleManifest>,
          bundleRes.arrayBuffer(),
        ])
        const entry = createEnvFromPackedBundle(
          manifest,
          new Uint8Array(bundleBuffer),
          catalogIndex,
        )
        this.drlgBundleEntries.set(cleanBase, entry)
        return entry
      })()
      pending.catch(() => {
        this.drlgBundlePromises.delete(cleanBase)
      })
      this.drlgBundlePromises.set(cleanBase, pending)
    }
    return pending
  }

  /**
   * Returns synchronously if the DRLG bundle for `baseUrl` has already finished loading.
   */
  getCachedDrlgBundle(baseUrl: string): SharedDrlgBundleEntry | undefined {
    return this.drlgBundleEntries.get(baseUrl.replace(/\/+$/, ''))
  }

  /**
   * Pre-registers an already constructed DRLG bundle entry in the shared pool.
   */
  setCachedDrlgBundle(baseUrl: string, entry: SharedDrlgBundleEntry): void {
    const cleanBase = baseUrl.replace(/\/+$/, '')
    this.drlgBundleEntries.set(cleanBase, entry)
    this.drlgBundlePromises.set(cleanBase, Promise.resolve(entry))
  }

  /**
   * Fetches and caches a read-only JSON manifest by URL.
   */
  fetchJson<T = unknown>(url: string): Promise<T> {
    let pending = this.jsonCache.get(url)
    if (!pending) {
      pending = fetch(url).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch JSON ${url}: ${res.status}`)
        }
        return res.json()
      })
      pending.catch(() => {
        this.jsonCache.delete(url)
      })
      this.jsonCache.set(url, pending)
    }
    return pending as Promise<T>
  }

  /**
   * Fetches and caches a binary `ArrayBuffer` by URL.
   */
  fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
    let pending = this.binaryCache.get(url)
    if (!pending) {
      pending = fetch(url).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch binary ${url}: ${res.status}`)
        }
        return res.arrayBuffer()
      })
      pending.catch(() => {
        this.binaryCache.delete(url)
      })
      this.binaryCache.set(url, pending)
    }
    return pending
  }

  /**
   * Fetches and caches a `Blob` by URL (e.g. `/ui/items-atlas.png`).
   */
  fetchBlob(url: string): Promise<Blob> {
    let pending = this.blobCache.get(url)
    if (!pending) {
      pending = fetch(url).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch blob ${url}: ${res.status}`)
        }
        return res.blob()
      })
      pending.catch(() => {
        this.blobCache.delete(url)
      })
      this.blobCache.set(url, pending)
    }
    return pending
  }

  /**
   * Loads and caches an `HTMLImageElement` by URL so Canvas 2D UI layers
   * (`FrontendRenderer`, `HudManager`) across slots 2..8 reuse decoded images.
   */
  loadImage(url: string): Promise<HTMLImageElement | null> {
    let pending = this.imageCache.get(url)
    if (!pending) {
      pending = new Promise<HTMLImageElement | null>((resolve) => {
        if (typeof Image === 'undefined') {
          resolve(null)
          return
        }
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = url
      })
      this.imageCache.set(url, pending)
    }
    return pending
  }

  getStats(): {
    drlgBundleCount: number
    jsonCount: number
    binaryCount: number
    blobCount: number
    imageCount: number
    hasSharedSfxLoader: boolean
  } {
    return {
      drlgBundleCount: this.drlgBundleEntries.size,
      jsonCount: this.jsonCache.size,
      binaryCount: this.binaryCache.size,
      blobCount: this.blobCache.size,
      imageCount: this.imageCache.size,
      hasSharedSfxLoader: this.sharedSfxLoader !== null,
    }
  }
}
