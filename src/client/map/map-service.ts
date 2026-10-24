/**
 * Client Map Service (`src/client/map/map-service.ts`, Feature F12).
 *
 * High-level runtime facade for:
 *   - Initializing DRLG & TileAtlas from packed assets (`public/act-packs/tiles`)
 *     or an existing `DrlgEnv`
 *   - Handling server `0x03 LoadAct`, `0x07 AddRoomData`, and `0x08 RemoveRoomData`
 *     packets to generate/update `LevelView`
 *   - Querying sub-tile collision and walkability in world or local coordinates
 *   - Dispatching requests either in-process (`MapWorkerEngine`) or via a Web Worker.
 */

import type { DrlgMapContext } from '../../common/drlg/drlg-map.ts'
import type { DrlgEnv } from '../../common/drlg/drlg-types.ts'
import { SharedAssetPool } from '../multibox/shared-asset-pool.ts'
import {
  UNIVERSAL_DT1_PATHS,
  validatePackManifest,
  validateUniversalDt1Libraries,
  type PackedDrlgBundleManifest,
  type PackedTileCatalogIndex,
} from '../../common/pack-contract/index.ts'
import { COLLIDE_MASK_INVALID } from '../../common/world/d2map.ts'
import {
  getCollisionLocalSubTile,
  getCollisionWorldSubTile,
  isWalkableLocalSubTile,
  isWalkableWorldSubTile,
  localSubTileToOrtho,
  localToWorldSubTile,
  orthoToLocalSubTile,
  worldToLocalSubTile,
  type LevelRoomView,
  type LevelView,
  type LevelViewOptions,
} from './level-view.ts'
import {
  MapWorkerEngine,
  createEnvFromPackedBundle,
  type LevelPreloadPlan,
  type MapWorkerRequest,
  type MapWorkerResponse,
} from './map-worker.ts'
import { TileAtlas } from './tile-atlas.ts'

export {
  UNIVERSAL_DT1_PATHS,
  validatePackManifest,
  validateUniversalDt1Libraries,
  TileAtlas,
  MapWorkerEngine,
  createEnvFromPackedBundle,
  worldToLocalSubTile,
  localToWorldSubTile,
  localSubTileToOrtho,
  orthoToLocalSubTile,
  isWalkableLocalSubTile,
  isWalkableWorldSubTile,
  getCollisionLocalSubTile,
  getCollisionWorldSubTile,
  type LevelView,
  type LevelRoomView,
  type LevelViewOptions,
  type LevelPreloadPlan,
  type MapWorkerRequest,
  type MapWorkerResponse,
}

export interface WorkerLike {
  postMessage(message: MapWorkerRequest): void
  addEventListener(
    type: 'message',
    listener: (event: { readonly data: MapWorkerResponse }) => void,
  ): void
  removeEventListener?(
    type: 'message',
    listener: (event: { readonly data: MapWorkerResponse }) => void,
  ): void
  terminate?(): void
}

export interface LoadActPacketLike {
  readonly act: number
  readonly mapSeed: number
  readonly areaId: number
  readonly unk?: number
}

export interface RoomDataPacketLike {
  readonly roomX: number
  readonly roomY: number
  readonly areaId: number
}

export interface PackedTileBundleAssets {
  readonly manifest: PackedDrlgBundleManifest
  readonly bundleBytes: Uint8Array
  readonly catalogIndex: PackedTileCatalogIndex
}

export type PackedTileBundleLoader = () => Promise<PackedTileBundleAssets> | PackedTileBundleAssets
export type PackedDirBundleLoader = (dirPath: string) => Promise<PackedTileBundleAssets>

let registeredPackedDirLoader: PackedDirBundleLoader | null = null

export class MapService {
  private readonly engine: MapWorkerEngine | null
  private readonly worker: WorkerLike | null
  private tileAtlas: TileAtlas | null
  private activeAct: number | null = null
  private activeSeed: number | null = null
  private activeDifficulty: 0 | 1 | 2 = 0
  private activeAreaId: number | null = null
  private activeView: LevelView | null = null
  /**
   * `Map` insertion order doubles as the view LRU order (`touchLoadedView`
   * re-inserts on access). `retainLevelViews` evicts everything outside the
   * caller's keep-set (active level + its connected neighbours); evicted areas
   * rebuild on demand via the worker engine, whose DRLG room state — including
   * `0x07` reveal flags — survives view eviction.
   */
  private readonly loadedViewsByArea = new Map<number, LevelView>()
  /**
   * Areas dropped by the last `retainLevelViews` (cleared on act/seed/difficulty
   * change and whenever the area is loaded again by any other path). Consulted
   * by `getConnectedLevelViews` to avoid speculative candidate peeks
   * resurrecting freshly evicted views every frame.
   */
  private readonly evictedAreaIds = new Set<number>()
  private nextRequestId = 1
  private readonly pendingWorkerRequests = new Map<
    number,
    {
      readonly resolve: (res: Extract<MapWorkerResponse, { readonly ok: true }>) => void
      readonly reject: (err: Error) => void
    }
  >()

  private readyPromise: Promise<MapService> | null = null

  constructor(
    options: {
      readonly engine?: MapWorkerEngine | null
      readonly worker?: WorkerLike | null
      readonly tileAtlas?: TileAtlas | null
    } = {},
  ) {
    this.engine = options.engine ?? null
    this.worker = options.worker ?? null
    this.tileAtlas = options.tileAtlas ?? this.engine?.getTileAtlas() ?? null

    if (this.worker) {
      this.worker.addEventListener('message', event => {
        const res = event.data
        const pending = this.pendingWorkerRequests.get(res.id)
        if (!pending) return
        this.pendingWorkerRequests.delete(res.id)
        if (!res.ok) {
          pending.reject(new Error(res.error))
        } else {
          pending.resolve(res)
        }
      })
    }
  }

  /**
   * Whether the map service has its underlying DRLG bundle and tile atlas initialized.
   */
  isLoaded(): boolean {
    return this.engine !== null && (this.readyPromise === null || this.tileAtlas !== null)
  }

  /**
   * Asynchronously awaits until the underlying packed DRLG bundle and tile atlas are ready.
   */
  async ensureLoaded(): Promise<this> {
    if (this.readyPromise) {
      await this.readyPromise
    }
    return this
  }

  /**
   * Register a platform-specific directory loader (e.g. from `tools/lib/node-map-loader.ts`).
   */
  static registerPackedDirLoader(loader: PackedDirBundleLoader): void {
    registeredPackedDirLoader = loader
  }

  /**
   * Create a `MapService` backed by an in-process `MapWorkerEngine` initialized from
   * an existing `DrlgEnv` and `DrlgMapContext`.
   */
  static fromEnv(env: DrlgEnv, ctx: DrlgMapContext, tileAtlas?: TileAtlas): MapService {
    const engine = new MapWorkerEngine()
    engine.initWithEnv(env, ctx, tileAtlas)
    return new MapService({ engine, tileAtlas: engine.getTileAtlas() })
  }

  /**
   * Create a `MapService` from in-memory packed bundle artifacts.
   */
  static fromPackedBundle(
    manifest: PackedDrlgBundleManifest,
    bundleBytes: Uint8Array,
    catalogIndex: PackedTileCatalogIndex,
  ): MapService {
    const engine = new MapWorkerEngine()
    engine.initFromBundle(manifest, bundleBytes, catalogIndex)
    return new MapService({ engine, tileAtlas: engine.getTileAtlas() })
  }

  /**
   * Create a `MapService` using an injected `PackedTileBundleLoader`.
   */
  static async fromLoader(loader: PackedTileBundleLoader): Promise<MapService> {
    const { manifest, bundleBytes, catalogIndex } = await loader()
    return MapService.fromPackedBundle(manifest, bundleBytes, catalogIndex)
  }

  /**
   * Create a `MapService` in Node/CLI/test environments using a registered directory loader.
   */
  static async fromPackedDir(dirPath = 'public/act-packs/tiles'): Promise<MapService> {
    if (!registeredPackedDirLoader) {
      throw new Error(
        'MapService.fromPackedDir requires a registered directory loader (import tools/lib/node-map-loader.ts)',
      )
    }
    return MapService.fromLoader(() => registeredPackedDirLoader!(dirPath))
  }

  /**
   * Create a `MapService` in browser environments by fetching `index.json`,
   * `drlg-bundle.json`, and `drlg-bundle.bin` from `baseUrl`.
   */
  static async fromPackedUrls(baseUrl = '/act-packs/tiles'): Promise<MapService> {
    return MapService.fromLoader(async () => {
      const cleanBase = baseUrl.replace(/\/+$/, '')
      const [indexRes, manifestRes, bundleRes] = await Promise.all([
        fetch(`${cleanBase}/index.json`),
        fetch(`${cleanBase}/drlg-bundle.json`),
        fetch(`${cleanBase}/drlg-bundle.bin`),
      ])
      if (!indexRes.ok) {
        throw new Error(`MapService.fromPackedUrls: failed to fetch index.json (${String(indexRes.status)})`)
      }
      if (!manifestRes.ok) {
        throw new Error(
          `MapService.fromPackedUrls: failed to fetch drlg-bundle.json (${String(manifestRes.status)})`,
        )
      }
      if (!bundleRes.ok) {
        throw new Error(
          `MapService.fromPackedUrls: failed to fetch drlg-bundle.bin (${String(bundleRes.status)})`,
        )
      }
      const [catalogIndex, manifest, bundleBuffer] = await Promise.all([
        indexRes.json() as Promise<PackedTileCatalogIndex>,
        manifestRes.json() as Promise<PackedDrlgBundleManifest>,
        bundleRes.arrayBuffer(),
      ])
      return {
        manifest,
        bundleBytes: new Uint8Array(bundleBuffer),
        catalogIndex,
      }
    })
  }

  /**
   * Alias of `fromPackedUrls` for callers using singular `fromPackedUrl`.
   */
  static async fromPackedUrl(baseUrl = '/act-packs/tiles'): Promise<MapService> {
    return MapService.fromPackedUrls(baseUrl)
  }

  /**
   * Create a `MapService` immediately with an in-process engine, while asynchronously
   * streaming `index.json`, `drlg-bundle.json`, and `drlg-bundle.bin` in the background.
   * Shares the ~30MB DRLG bundle & TileAtlas via `SharedAssetPool` across multibox instances (#1362).
   */
  static fromPackedUrlsLazy(baseUrl = '/act-packs/tiles'): MapService {
    const engine = new MapWorkerEngine()
    const mapService = new MapService({ engine })
    const cleanBase = baseUrl.replace(/\/+$/, '')
    const pool = SharedAssetPool.getGlobal()
    const cached = pool.getCachedDrlgBundle(cleanBase)
    if (cached) {
      engine.initWithEnv(cached.env, cached.ctx, cached.tileAtlas)
      mapService.tileAtlas = engine.getTileAtlas()
      mapService.readyPromise = Promise.resolve(mapService)
      return mapService
    }
    mapService.readyPromise = (async (): Promise<MapService> => {
      const entry = await pool.getOrLoadDrlgBundle(cleanBase)
      engine.initWithEnv(entry.env, entry.ctx, entry.tileAtlas)
      mapService.tileAtlas = engine.getTileAtlas()
      return mapService
    })()
    return mapService
  }

  /**
   * Alias of `fromPackedUrlsLazy` for callers using singular `fromPackedUrlLazy`.
   */
  static fromPackedUrlLazy(baseUrl = '/act-packs/tiles'): MapService {
    return MapService.fromPackedUrlsLazy(baseUrl)
  }

  /**
   * Create a `MapService` backed by a Web Worker (`WorkerLike`).
   */
  static fromWorker(worker: WorkerLike, tileAtlas?: TileAtlas): MapService {
    return new MapService({ worker, tileAtlas: tileAtlas ?? null })
  }

  getTileAtlas(): TileAtlas | null {
    return this.tileAtlas
  }

  getActiveAct(): number | null {
    return this.activeAct
  }

  getActiveSeed(): number | null {
    return this.activeSeed
  }

  getActiveDifficulty(): 0 | 1 | 2 {
    return this.activeDifficulty
  }

  getActiveAreaId(): number | null {
    return this.activeAreaId
  }

  getActiveLevelView(): LevelView | null {
    return this.activeView
  }

  getLoadedLevelView(areaId: number): LevelView | undefined {
    const view = this.loadedViewsByArea.get(areaId)
    if (view !== undefined) this.touchLoadedView(areaId, view)
    return view
  }

  /** Area ids currently resident in `loadedViewsByArea` (#954 stray-view audits). */
  getLoadedAreaIds(): number[] {
    return [...this.loadedViewsByArea.keys()]
  }

  getLoadedLevelViews(): LevelView[] {
    return Array.from(this.loadedViewsByArea.values())
  }

  /** Refresh `loadedViewsByArea` insertion order so it tracks view recency. */
  private touchLoadedView(areaId: number, view: LevelView): void {
    this.loadedViewsByArea.delete(areaId)
    this.loadedViewsByArea.set(areaId, view)
  }

  /**
   * Evict every loaded `LevelView` whose `areaId` is not in `keepAreaIds`
   * (#954 retention policy: keep the active level plus its connected
   * neighbours, drop the rest). The worker engine keeps its own DRLG room
   * state — geometry, seeds and `0x07` reveal flags — so an evicted area
   * rebuilds identically via `peekLevelView`/`getLevelView` when visited
   * again. Returns the number of evicted views.
   */
  retainLevelViews(keepAreaIds: Iterable<number>): number {
    const keep = new Set<number>()
    for (const id of keepAreaIds) {
      if (id > 0) keep.add(id)
    }
    let evicted = 0
    for (const id of [...this.loadedViewsByArea.keys()]) {
      if (!keep.has(id)) {
        this.loadedViewsByArea.delete(id)
        this.evictedAreaIds.add(id)
        evicted += 1
      }
    }
    for (const id of keep) {
      this.evictedAreaIds.delete(id)
    }
    return evicted
  }

  /**
   * Fetch or build a `LevelView` for `areaId` without changing `activeView` or `activeAreaId`.
   */
  peekLevelView(areaId: number, revealMode: 'all' | 'revealed-only' = 'all'): LevelView | null {
    if (areaId <= 0) return null
    if (revealMode === 'all') {
      const existing = this.loadedViewsByArea.get(areaId)
      if (existing) {
        this.touchLoadedView(areaId, existing)
        return existing
      }
    }
    if (!this.engine || this.activeSeed === null) {
      return this.loadedViewsByArea.get(areaId) ?? null
    }
    const view = this.engine.getLevelView(areaId, revealMode)
    if (revealMode === 'all') {
      // An explicit (re)build is a real demand signal (0x07 reveal, automap,
      // player crossing): lift any retention-eviction mark for this area.
      this.evictedAreaIds.delete(areaId)
      this.touchLoadedView(areaId, view)
    }
    return view
  }

  /**
   * Synchronous `loadAct` (requires in-process `MapWorkerEngine`).
   */
  loadAct(options: {
    readonly act: number
    readonly seed: number
    readonly difficulty?: 0 | 1 | 2
    readonly areaId?: number
    readonly revealMode?: 'all' | 'revealed-only'
  }): LevelView | null {
    if (!this.engine) {
      throw new Error('MapService.loadAct: synchronous call requires in-process engine (use loadActAsync for worker)')
    }
    if (this.readyPromise && !this.tileAtlas) {
      throw new Error('MapService.loadAct: packed bundle is still loading (await mapService.ensureLoaded() first)')
    }
    const difficulty = options.difficulty ?? this.activeDifficulty
    const normalizedSeed = options.seed >>> 0
    if (
      this.activeAct !== options.act ||
      this.activeSeed !== normalizedSeed ||
      this.activeDifficulty !== difficulty
    ) {
      this.loadedViewsByArea.clear()
      this.evictedAreaIds.clear()
    }
    this.activeAct = options.act
    this.activeSeed = normalizedSeed
    this.activeDifficulty = difficulty
    if (options.areaId !== undefined && options.areaId > 0) {
      this.activeAreaId = options.areaId
    }
    const view = this.engine.loadAct(options)
    if (view) {
      this.activeView = view
      this.activeAreaId = view.id
      this.touchLoadedView(view.id, view)
    }
    return view
  }

  /**
   * Asynchronous `loadAct` (works with both in-process engine and Web Worker).
   */
  async loadActAsync(options: {
    readonly act: number
    readonly seed: number
    readonly difficulty?: 0 | 1 | 2
    readonly areaId?: number
    readonly revealMode?: 'all' | 'revealed-only'
  }): Promise<LevelView | null> {
    if (this.readyPromise) {
      await this.readyPromise
    }
    if (this.engine) {
      return this.loadAct(options)
    }
    const id = this.nextRequestId++
    const res = await this.sendWorkerRequest({
      id,
      type: 'loadAct',
      act: options.act,
      seed: options.seed >>> 0,
      ...(options.difficulty !== undefined ? { difficulty: options.difficulty } : {}),
      ...(options.areaId !== undefined ? { areaId: options.areaId } : {}),
      ...(options.revealMode !== undefined ? { revealMode: options.revealMode } : {}),
    })
    if (res.type !== 'loadAct') {
      throw new Error(`Unexpected worker response type: ${res.type}`)
    }
    const normalizedSeed = options.seed >>> 0
    const nextDiff = options.difficulty ?? this.activeDifficulty
    if (
      this.activeAct !== options.act ||
      this.activeSeed !== normalizedSeed ||
      this.activeDifficulty !== nextDiff
    ) {
      this.loadedViewsByArea.clear()
      this.evictedAreaIds.clear()
    }
    this.activeAct = options.act
    this.activeSeed = normalizedSeed
    if (options.difficulty !== undefined) {
      this.activeDifficulty = options.difficulty
    }
    if (res.view) {
      this.activeView = res.view
      this.activeAreaId = res.view.id
      this.touchLoadedView(res.view.id, res.view)
    }
    return res.view
  }

  /**
   * Synchronous `getLevelView` for `areaId`.
   */
  getLevelView(
    areaId: number,
    revealMode: 'all' | 'revealed-only' = 'all',
    forceRebuild = false,
  ): LevelView {
    if (!this.engine) {
      throw new Error('MapService.getLevelView: synchronous call requires in-process engine')
    }
    const view = this.engine.getLevelView(areaId, revealMode, forceRebuild)
    this.activeView = view
    this.activeAreaId = areaId
    if (revealMode === 'all' || !this.loadedViewsByArea.has(areaId)) {
      this.touchLoadedView(areaId, view)
    }
    return view
  }

  /**
   * Asynchronous `getLevelView` for `areaId`.
   */
  async getLevelViewAsync(
    areaId: number,
    revealMode: 'all' | 'revealed-only' = 'all',
  ): Promise<LevelView> {
    if (this.engine) {
      return this.getLevelView(areaId, revealMode)
    }
    const id = this.nextRequestId++
    const res = await this.sendWorkerRequest({
      id,
      type: 'getLevelView',
      areaId,
      revealMode,
    })
    if (res.type !== 'getLevelView') {
      throw new Error(`Unexpected worker response type: ${res.type}`)
    }
    this.activeView = res.view
    this.activeAreaId = areaId
    if (revealMode === 'all' || !this.loadedViewsByArea.has(areaId)) {
      this.touchLoadedView(areaId, res.view)
    }
    return res.view
  }

  /**
   * Handle server S2C `0x03 LoadAct` packet (`{ act, mapSeed, areaId, unk }`).
   */
  onLoadActPacket(
    packet: LoadActPacketLike,
    options: { readonly difficulty?: 0 | 1 | 2; readonly revealMode?: 'all' | 'revealed-only' } = {},
  ): LevelView | null {
    return this.loadAct({
      act: packet.act,
      seed: packet.mapSeed >>> 0,
      ...(options.difficulty !== undefined ? { difficulty: options.difficulty } : {}),
      ...(packet.areaId > 0 ? { areaId: packet.areaId } : {}),
      ...(options.revealMode !== undefined ? { revealMode: options.revealMode } : {}),
    })
  }

  /**
   * Handle server S2C `0x07 AddRoomData` packet (`{ roomX, roomY, areaId }`).
   */
  onAddRoomDataPacket(
    packet: RoomDataPacketLike,
    options: { readonly rebuildView?: boolean; readonly revealMode?: 'all' | 'revealed-only' } = {},
  ): { readonly room: LevelRoomView | null; readonly view: LevelView | null } {
    if (!this.engine) {
      throw new Error('MapService.onAddRoomDataPacket: synchronous call requires in-process engine')
    }
    const res = this.engine.revealRoom(packet.areaId, packet.roomX, packet.roomY, options)
    if (res.view) {
      this.activeView = res.view
      this.activeAreaId = res.view.id
      this.touchLoadedView(res.view.id, res.view)
    }
    return res
  }

  /**
   * Handle server S2C `0x08 RemoveRoomData` packet (`{ roomX, roomY, areaId }`).
   */
  onRemoveRoomDataPacket(
    packet: RoomDataPacketLike,
    options: { readonly rebuildView?: boolean; readonly revealMode?: 'all' | 'revealed-only' } = {},
  ): { readonly room: LevelRoomView | null; readonly view: LevelView | null } {
    if (!this.engine) {
      throw new Error('MapService.onRemoveRoomDataPacket: synchronous call requires in-process engine')
    }
    const res = this.engine.hideRoom(packet.areaId, packet.roomX, packet.roomY, options)
    if (res.view) {
      this.activeView = res.view
      this.activeAreaId = res.view.id
      this.touchLoadedView(res.view.id, res.view)
    }
    return res
  }

  /**
   * Query whether world sub-tile `(worldSubX, worldSubY)` is walkable in the active `LevelView`.
   */
  isWalkableWorldSubTile(worldSubX: number, worldSubY: number): boolean {
    if (!this.activeView) return false
    return isWalkableWorldSubTile(this.activeView, worldSubX, worldSubY)
  }

  /**
   * Query the 16-bit collision mask at world sub-tile `(worldSubX, worldSubY)` in the active `LevelView`.
   */
  getCollisionWorldSubTile(worldSubX: number, worldSubY: number): number {
    if (!this.activeView) {
      throw new Error('[MapService] getCollisionWorldSubTile: active LevelView is not set')
    }
    return getCollisionWorldSubTile(this.activeView, worldSubX, worldSubY)
  }

  /**
   * Resolve the full-level `LevelView` (among `areaIds`, in order) whose DRLG sub-tile canvas
   * contains world sub-tile `(worldSubX, worldSubY)` on a non-void cell.
   *
   * This is how the renderer picks the level to draw around a server-positioned unit (1.13c: the
   * unit's room → `pRoom->pLevel`, levels of an act occupy disjoint DRLG coordinate rectangles).
   * It deliberately does NOT use {@link getActiveLevelView}: that is "the last view built", which
   * `AutomapView` changes as a side effect when it builds neighbouring levels for `0x07` reveals
   * (e.g. Blood Moor rooms next to the Rogue Encampment spawn) — issue #539.
   *
   * Returns `null` when no candidate level has real floor/wall data at that sub-tile (DRLG mismatch
   * or not yet loaded); callers must treat that as not-ready rather than guessing a level.
   */
  findLevelViewAtWorldSubTile(
    worldSubX: number,
    worldSubY: number,
    areaIds: Iterable<number>,
  ): LevelView | null {
    const matches = this.findAllLevelViewsAtWorldSubTile(worldSubX, worldSubY, areaIds)
    return matches[0] ?? null
  }

  /**
   * Resolve all full-level `LevelView`s (among `areaIds`, in order) whose DRLG sub-tile canvas
   * contains world sub-tile `(worldSubX, worldSubY)` on a non-void cell.
   *
   * Near an outdoor seam (where Level A copies a 1-room border strip from Level B), both Level A
   * and Level B may contain `(worldSubX, worldSubY)` in their bounding boxes, with one level having
   * walkable floor while the other has border padding.
   */
  findAllLevelViewsAtWorldSubTile(
    worldSubX: number,
    worldSubY: number,
    areaIds: Iterable<number>,
  ): LevelView[] {
    if (!this.engine && this.loadedViewsByArea.size === 0) {
      throw new Error('MapService.findLevelViewAtWorldSubTile: synchronous call requires in-process engine')
    }
    if (this.activeSeed === null && this.loadedViewsByArea.size === 0) return []
    const seen = new Set<number>()
    const out: LevelView[] = []
    const sx = Math.floor(worldSubX)
    const sy = Math.floor(worldSubY)
    for (const areaId of areaIds) {
      if (areaId <= 0 || seen.has(areaId)) continue
      seen.add(areaId)
      const view = this.peekLevelView(areaId, 'all')
      if (!view) continue
      const lx = sx - view.subOriginX
      const ly = sy - view.subOriginY
      if (lx < 0 || ly < 0 || lx >= view.subWidth || ly >= view.subHeight) continue
      const mask = view.collision[ly * view.subWidth + lx] ?? COLLIDE_MASK_INVALID
      if ((mask & COLLIDE_MASK_INVALID) === COLLIDE_MASK_INVALID) continue
      out.push(view)
    }
    return out
  }

  /**
   * Collect all neighbour `LevelView`s connected to `primaryAreaId` in the same world plane
   * (`Levels.txt` `dwLayer` / outdoor `gate` seams / revealed `0x07` rooms) for seamless rendering.
   */
  getConnectedLevelViews(
    primaryAreaId: number,
    candidateAreaIds: Iterable<number> = [],
  ): LevelView[] {
    const primaryView = this.peekLevelView(primaryAreaId, 'all')
    if (!primaryView) return []
    const primaryLayerId = primaryView.automap?.layerId ?? 0
    const neighbourAreaIds = new Set<number>()

    if (Array.isArray(primaryView.entrances)) {
      for (const ent of primaryView.entrances) {
        if (ent.kind === 'gate' && ent.toLevelId > 0 && ent.toLevelId !== primaryAreaId) {
          neighbourAreaIds.add(ent.toLevelId)
        }
      }
    }

    for (const id of candidateAreaIds) {
      if (id > 0 && id !== primaryAreaId) {
        neighbourAreaIds.add(id)
      }
    }

    for (const id of this.loadedViewsByArea.keys()) {
      if (id > 0 && id !== primaryAreaId) {
        neighbourAreaIds.add(id)
      }
    }

    const out: LevelView[] = []
    for (const otherId of neighbourAreaIds) {
      const isGateLinked =
        Array.isArray(primaryView.entrances) &&
        primaryView.entrances.some(e => e.kind === 'gate' && e.toLevelId === otherId)
      // #954: a non-gate candidate that retention already evicted must not be
      // speculatively rebuilt here — `peekLevelView('all')` would resurrect it
      // every frame just for the same-layer filter, an evict/rebuild churn
      // loop. Gate-linked neighbours are always allowed (real seam geometry).
      if (!isGateLinked && this.evictedAreaIds.has(otherId) && !this.loadedViewsByArea.has(otherId)) {
        continue
      }
      let otherView: LevelView | null = null
      try {
        otherView = this.peekLevelView(otherId, 'all')
      } catch {
        continue
      }
      if (!otherView || otherView.act !== primaryView.act) continue
      const otherLayerId = otherView.automap?.layerId ?? 0
      const isSameLayer =
        primaryLayerId > 0 && otherLayerId > 0 && primaryLayerId === otherLayerId
      if (isGateLinked || isSameLayer) {
        out.push(otherView)
      }
    }
    return out
  }

  /**
   * Revealed near rooms of the room of `areaId` containing a world sub-tile (see
   * `MapWorkerEngine.getRevealedNearRooms`).
   */
  getRevealedNearRooms(areaId: number, worldSubX: number, worldSubY: number): readonly LevelRoomView[] {
    if (!this.engine) {
      throw new Error('MapService.getRevealedNearRooms: synchronous call requires in-process engine')
    }
    return this.engine.getRevealedNearRooms(areaId, worldSubX, worldSubY)
  }

  /**
   * Compute the 1-hop topological level-graph asset preload plan (#1025) for `areaId`
   * without mutating `activeView` or generating unvisited neighbor `LevelView`s.
   */
  getLevelPreloadPlan(areaId: number): LevelPreloadPlan | null {
    if (!this.engine || areaId <= 0) return null
    const existingView =
      this.loadedViewsByArea.get(areaId) ?? (this.activeView?.id === areaId ? this.activeView : null)
    return this.engine.getLevelPreloadPlan(areaId, existingView)
  }

  private sendWorkerRequest(
    req: MapWorkerRequest,
  ): Promise<Extract<MapWorkerResponse, { readonly ok: true }>> {
    if (!this.worker) {
      return Promise.reject(new Error('MapService: no worker configured'))
    }
    return new Promise<Extract<MapWorkerResponse, { readonly ok: true }>>((resolve, reject) => {
      this.pendingWorkerRequests.set(req.id, { resolve, reject })
      this.worker!.postMessage(req)
    })
  }
}
