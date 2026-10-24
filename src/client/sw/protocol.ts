/**
 * Shared protocol and structural interfaces between the main browser thread
 * (`src/client/sw/register.ts`) and the Service Worker (`src/client/sw/sw.ts`).
 */

import type { AssetManifest } from '../../common/pack-contract/index.ts'

export const ASSET_CACHE_NAME = 'd2web-assets-v1'
export const META_CACHE_NAME = 'd2web-meta-v1'
export const StoredManifestUrl = 'https://d2web.internal/__meta__/asset-manifest.json'

export interface SwCacheStats {
  readonly manifestReady: boolean
  readonly manifestVersion: string | null
  readonly cacheHits: number
  readonly cacheMisses: number
  readonly networkPassThroughs: number
  readonly quotaErrors: number
  readonly cachedAssetCount: number
}

export interface SwSyncManifestMessage {
  readonly type: 'D2_SW_SYNC_MANIFEST'
  readonly manifest: AssetManifest
}

export interface SwSyncManifestAck {
  readonly type: 'D2_SW_SYNC_MANIFEST_ACK'
  readonly ok: boolean
  readonly version: string
  readonly evictedCount: number
  readonly evictedPaths: readonly string[]
  readonly unchangedCount: number
  readonly error?: string | undefined
}

export interface SwClearCacheMessage {
  readonly type: 'D2_SW_CLEAR_CACHE'
}

export interface SwClearCacheAck {
  readonly type: 'D2_SW_CLEAR_CACHE_ACK'
  readonly ok: boolean
  readonly deletedEntries: number
}

export interface SwGetStatsMessage {
  readonly type: 'D2_SW_GET_STATS'
}

export interface SwStatsAck {
  readonly type: 'D2_SW_STATS_ACK'
  readonly ok: boolean
  readonly stats: SwCacheStats
}

export type SwClientToWorkerMessage =
  | SwSyncManifestMessage
  | SwClearCacheMessage
  | SwGetStatsMessage

export type SwWorkerToClientMessage =
  | SwSyncManifestAck
  | SwClearCacheAck
  | SwStatsAck

export interface CacheLike {
  match(request: Request | string): Promise<Response | undefined>
  put(request: Request | string, response: Response): Promise<void>
  delete(request: Request | string): Promise<boolean>
  keys(): Promise<readonly Request[]>
}

export interface CacheStorageLike {
  open(cacheName: string): Promise<CacheLike>
  delete(cacheName: string): Promise<boolean>
  keys(): Promise<readonly string[]>
}
