/**
 * DRLG Map Generation Worker & Engine (`src/client/map/map-worker.ts`, Feature F12).
 *
 * Runs `createDrlgActSession`, `drlgLevelInputFromSession`, `buildDrlgLevelMap`, and
 * `buildLevelView` off the main thread (in a Web Worker) or in-process via
 * `MapWorkerEngine`. Supports:
 *   - Loading from the pre-packed `drlg-bundle.json` + `drlg-bundle.bin` + `index.json`
 *     (zero MPQ dependency at runtime)
 *   - Loading directly from an existing `DrlgEnv` + `DrlgMapContext`
 *   - Full-level mode (`revealMode: 'all'`) and progressive room-reveal mode
 *     (`revealMode: 'revealed-only'`) driven by `0x03 LoadAct`, `0x07 AddRoomData`,
 *     and `0x08 RemoveRoomData`.
 */

import {
  createDrlgActSession,
  type DrlgActSession,
  type DrlgMapContext,
  type DrlgSessionRoom,
} from '../../common/drlg/drlg-map.ts'
import {
  DRLG_TABLE_NAMES,
  createDrlgEnv,
  memoryDrlgSource,
  normalizeDrlgPath,
} from '../../common/drlg/drlg-source.ts'
import { loadDrlgTables, type DrlgTableName } from '../../common/drlg/drlg-tables.ts'
import type { D2DrlgRoomStrc, DrlgEnv } from '../../common/drlg/drlg-types.ts'
import {
  UNIVERSAL_DT1_PATHS,
  type PackedDrlgBundleManifest,
  type PackedTileCatalogIndex,
} from '../../common/pack-contract/index.ts'
import { buildLevelViewFromSession, type LevelRoomView, type LevelView } from './level-view.ts'
import { TileAtlas } from './tile-atlas.ts'

export interface LevelPreloadPlan {
  readonly areaId: number
  readonly actId: number
  readonly currentTilePages: readonly { readonly act: number; readonly page: number }[]
  readonly currentMonsterHcIndices: readonly number[]
  readonly currentObjectClassIds: readonly number[]
  readonly neighborAreaIds: readonly number[]
  readonly neighborTilePages: readonly { readonly act: number; readonly page: number }[]
  readonly neighborMonsterHcIndices: readonly number[]
}

export type MapWorkerRequest =
  | {
      readonly id: number
      readonly type: 'initFromBundle'
      readonly manifest: PackedDrlgBundleManifest
      readonly bundleBytes: Uint8Array
      readonly catalogIndex: PackedTileCatalogIndex
    }
  | {
      readonly id: number
      readonly type: 'loadAct'
      readonly act: number
      readonly seed: number
      readonly difficulty?: 0 | 1 | 2
      readonly areaId?: number
      readonly revealMode?: 'all' | 'revealed-only'
    }
  | {
      readonly id: number
      readonly type: 'getLevelView'
      readonly areaId: number
      readonly revealMode?: 'all' | 'revealed-only'
    }
  | {
      readonly id: number
      readonly type: 'revealRoom'
      readonly areaId: number
      readonly roomX: number
      readonly roomY: number
      readonly rebuildView?: boolean
      readonly revealMode?: 'all' | 'revealed-only'
    }
  | {
      readonly id: number
      readonly type: 'hideRoom'
      readonly areaId: number
      readonly roomX: number
      readonly roomY: number
      readonly rebuildView?: boolean
      readonly revealMode?: 'all' | 'revealed-only'
    }

export type MapWorkerResponse =
  | {
      readonly id: number
      readonly ok: true
      readonly type: 'initFromBundle'
    }
  | {
      readonly id: number
      readonly ok: true
      readonly type: 'loadAct'
      readonly view: LevelView | null
    }
  | {
      readonly id: number
      readonly ok: true
      readonly type: 'getLevelView'
      readonly view: LevelView
    }
  | {
      readonly id: number
      readonly ok: true
      readonly type: 'revealRoom'
      readonly room: LevelRoomView | null
      readonly view: LevelView | null
    }
  | {
      readonly id: number
      readonly ok: true
      readonly type: 'hideRoom'
      readonly room: LevelRoomView | null
      readonly view: LevelView | null
    }
  | {
      readonly id: number
      readonly ok: false
      readonly error: string
    }

function toRoomView(r: DrlgSessionRoom | null): LevelRoomView | null {
  if (!r) return null
  return {
    index: r.index,
    areaId: r.areaId,
    tileX: r.tileX,
    tileY: r.tileY,
    tileW: r.tileW,
    tileH: r.tileH,
    localTileX: r.localTileX,
    localTileY: r.localTileY,
    subX: r.subX,
    subY: r.subY,
    subW: r.subW,
    subH: r.subH,
    worldSubX: r.worldSubX,
    worldSubY: r.worldSubY,
    room1InitSeed: r.room1InitSeed,
    revealed: r.revealed,
  }
}

/**
 * Reconstruct a `DrlgEnv`, `TileAtlas`, and `DrlgMapContext` from a packed
 * `drlg-bundle.json` + `drlg-bundle.bin` + `index.json`.
 */
export function createEnvFromPackedBundle(
  manifest: PackedDrlgBundleManifest,
  bundleBytes: Uint8Array,
  catalogIndex: PackedTileCatalogIndex,
): {
  readonly env: DrlgEnv
  readonly tileAtlas: TileAtlas
  readonly ctx: DrlgMapContext
} {
  const tableMap = new Map<DrlgTableName, Uint8Array>()
  for (const name of DRLG_TABLE_NAMES) {
    const slice = manifest.tables[name]
    if (!slice) {
      throw new Error(`createEnvFromPackedBundle: missing table ${name} in manifest`)
    }
    tableMap.set(name, bundleBytes.subarray(slice.offset, slice.offset + slice.length))
  }

  const fileMap = new Map<string, Uint8Array>()
  for (const [key, slice] of Object.entries(manifest.ds1Files)) {
    fileMap.set(normalizeDrlgPath(key), bundleBytes.subarray(slice.offset, slice.offset + slice.length))
  }
  for (const [key, slice] of Object.entries(manifest.dt1HeaderFiles)) {
    fileMap.set(normalizeDrlgPath(key), bundleBytes.subarray(slice.offset, slice.offset + slice.length))
  }

  const source = memoryDrlgSource(tableMap, fileMap)
  const tables = loadDrlgTables(source)
  const env = createDrlgEnv(source, tables)
  const tileAtlas = TileAtlas.fromCatalogIndex(catalogIndex)
  const ctx: DrlgMapContext = {
    tables,
    dt1: tileAtlas.toLazyDt1Map(),
    superUniqueIds: manifest.superUniqueIds,
  }
  return { env, tileAtlas, ctx }
}

export class MapWorkerEngine {
  private env: DrlgEnv | null = null
  private ctx: DrlgMapContext | null = null
  private tileAtlas: TileAtlas | null = null
  private session: DrlgActSession | null = null
  private activeAct: number | null = null
  private readonly viewCache = new Map<string, LevelView>()

  initWithEnv(env: DrlgEnv, ctx: DrlgMapContext, tileAtlas?: TileAtlas): void {
    this.env = env
    this.ctx = ctx
    this.tileAtlas = tileAtlas ?? TileAtlas.fromDt1Map(ctx.dt1)
    this.session = null
    this.activeAct = null
    this.viewCache.clear()
  }

  initFromBundle(
    manifest: PackedDrlgBundleManifest,
    bundleBytes: Uint8Array,
    catalogIndex: PackedTileCatalogIndex,
  ): void {
    const { env, ctx, tileAtlas } = createEnvFromPackedBundle(manifest, bundleBytes, catalogIndex)
    this.initWithEnv(env, ctx, tileAtlas)
  }

  getTileAtlas(): TileAtlas | null {
    return this.tileAtlas
  }

  getSession(): DrlgActSession | null {
    return this.session
  }

  loadAct(options: {
    readonly act: number
    readonly seed: number
    readonly difficulty?: 0 | 1 | 2
    readonly areaId?: number
    readonly revealMode?: 'all' | 'revealed-only'
  }): LevelView | null {
    if (!this.env || !this.ctx) {
      throw new Error('MapWorkerEngine.loadAct: engine not initialized')
    }
    const difficulty = options.difficulty ?? 0
    const normalizedSeed = options.seed >>> 0
    const actChanged = this.activeAct !== null && this.activeAct !== options.act
    this.activeAct = options.act
    if (
      !this.session ||
      this.session.seed !== normalizedSeed ||
      this.session.difficulty !== difficulty
    ) {
      this.session = createDrlgActSession(this.env, {
        act: options.act,
        seed: normalizedSeed,
        difficulty,
      })
      this.viewCache.clear()
    } else if (actChanged) {
      this.viewCache.clear()
    }
    if (options.areaId !== undefined && options.areaId > 0) {
      return this.getLevelView(options.areaId, options.revealMode ?? 'all')
    }
    return null
  }

  getLevelView(areaId: number, revealMode: 'all' | 'revealed-only' = 'all', forceRebuild = false): LevelView {
    if (!this.env || !this.ctx) {
      throw new Error('MapWorkerEngine.getLevelView: engine not initialized')
    }
    if (!this.session) {
      throw new Error('MapWorkerEngine.getLevelView: no active DRLG session (call loadAct first)')
    }
    const cacheKey = `${String(this.session.seed)}:${String(this.session.difficulty)}:${String(areaId)}:${revealMode}`
    if (!forceRebuild && revealMode === 'all') {
      const cached = this.viewCache.get(cacheKey)
      if (cached) return cached
    }
    const view = buildLevelViewFromSession(this.session, areaId, this.ctx, {
      ...(this.tileAtlas ? { tileAtlas: this.tileAtlas } : {}),
      revealMode,
    })
    if (revealMode === 'all') {
      this.viewCache.set(cacheKey, view)
    }
    return view
  }

  revealRoom(
    areaId: number,
    roomX: number,
    roomY: number,
    options: { readonly rebuildView?: boolean; readonly revealMode?: 'all' | 'revealed-only' } = {},
  ): { readonly room: LevelRoomView | null; readonly view: LevelView | null } {
    if (!this.session) {
      throw new Error('MapWorkerEngine.revealRoom: no active DRLG session')
    }
    const room = this.session.revealRoom(areaId, roomX, roomY)
    const view =
      options.rebuildView === true
        ? this.getLevelView(areaId, options.revealMode ?? 'revealed-only', true)
        : null
    return { room: toRoomView(room), view }
  }

  hideRoom(
    areaId: number,
    roomX: number,
    roomY: number,
    options: { readonly rebuildView?: boolean; readonly revealMode?: 'all' | 'revealed-only' } = {},
  ): { readonly room: LevelRoomView | null; readonly view: LevelView | null } {
    if (!this.session) {
      throw new Error('MapWorkerEngine.hideRoom: no active DRLG session')
    }
    const room = this.session.hideRoom(areaId, roomX, roomY)
    const view =
      options.rebuildView === true
        ? this.getLevelView(areaId, options.revealMode ?? 'revealed-only', true)
        : null
    return { room: toRoomView(room), view }
  }

  /**
   * Near rooms of the room of level `areaId` that contains a world sub-tile, as the 1.13c client's
   * room list (D2Common #10383, 0x6fd8ba20) holds them: the DRLG `ppRoomsNear` of that room limited
   * to rooms the server added with S2C 0x07 (D2Common keeps only near rooms that have an active
   * room), in `ppRoomsNear` order, without the room itself. The client's list order after room
   * removals is not modelled.
   *
   * @throws when no session is active or no room of `areaId` contains the sub-tile.
   */
  getRevealedNearRooms(areaId: number, worldSubX: number, worldSubY: number): readonly LevelRoomView[] {
    if (!this.session) {
      throw new Error('MapWorkerEngine.getRevealedNearRooms: no active DRLG session')
    }
    const sx = Math.floor(worldSubX)
    const sy = Math.floor(worldSubY)
    const room = this.session
      .ensureLevelActivated(areaId)
      .rooms.find(
        r => sx >= r.worldSubX && sx < r.worldSubX + r.subW && sy >= r.worldSubY && sy < r.worldSubY + r.subH,
      )
    if (room === undefined) {
      throw new Error(
        `MapWorkerEngine.getRevealedNearRooms: level ${String(areaId)} has no room at sub-tile (${String(sx)}, ${String(sy)})`,
      )
    }
    const near: LevelRoomView[] = []
    for (let i = 0; i < room.pRoom.nRoomsNear; i += 1) {
      const pNear = room.pRoom.ppRoomsNear[i]!
      if (pNear === room.pRoom) continue
      const nearRoom = this.findSessionRoom(pNear)
      if (nearRoom.revealed) near.push(toRoomView(nearRoom)!)
    }
    return near
  }

  private readonly sessionRoomByDrlgRoom = new WeakMap<D2DrlgRoomStrc, DrlgSessionRoom>()

  private findSessionRoom(pRoom: D2DrlgRoomStrc): DrlgSessionRoom {
    const cached = this.sessionRoomByDrlgRoom.get(pRoom)
    if (cached !== undefined) return cached
    if (!this.session) {
      throw new Error('MapWorkerEngine.findSessionRoom: no active DRLG session')
    }
    for (const r of this.session.getAllLevelRooms(pRoom.pLevel.nLevelId)) {
      this.sessionRoomByDrlgRoom.set(r.pRoom, r)
    }
    const found = this.sessionRoomByDrlgRoom.get(pRoom)
    if (found === undefined) {
      throw new Error(`MapWorkerEngine.findSessionRoom: room not found in level ${String(pRoom.pLevel.nLevelId)}`)
    }
    return found
  }

  /**
   * Compute the 1-hop topological level-graph asset preload plan (#1025) for `areaId`
   * without generating or caching unvisited neighbor `LevelView`s.
   */
  getLevelPreloadPlan(areaId: number, existingView?: LevelView | null): LevelPreloadPlan | null {
    if (!this.env || !this.ctx || !this.tileAtlas) return null
    const tables = this.env.tables
    if (areaId <= 0 || areaId >= tables.nLevelsTxtRecordCount) return null

    const difficulty = this.session?.difficulty ?? 0
    const primaryView =
      existingView ??
      (this.session
        ? this.viewCache.get(
            `${String(this.session.seed)}:${String(this.session.difficulty)}:${String(areaId)}:all`,
          )
        : undefined) ??
      null

    const levelPool = tables.levelMonsters?.[areaId]
    const actId = Math.max(
      1,
      Math.min(5, primaryView?.act ?? (levelPool !== undefined ? levelPool.act + 1 : (this.activeAct ?? 1))),
    )

    const collectTableLibraries = (targetAreaId: number): string[] => {
      const def = tables.levelDefs[targetAreaId]
      if (!def) return []
      const lvlType = tables.lvlTypes[def.dwLevelType]
      if (!lvlType) return []
      const libs: string[] = [...UNIVERSAL_DT1_PATHS]
      let mask = 0
      if (def.dwDrlgType === 2 && def.dwSubType < 0) {
        for (const prest of tables.lvlPrest) {
          if (prest.dwLevelId === targetAreaId) {
            mask = (mask | prest.dwDt1Mask) >>> 0
          }
        }
      }
      for (let i = 0; i < lvlType.szFile.length; i += 1) {
        const f = lvlType.szFile[i]!
        if (f.length <= 1) continue
        if (mask !== 0 && ((mask >>> i) & 1) === 0) continue
        libs.push(f)
      }
      return libs
    }

    const currentLibs =
      primaryView && primaryView.dt1Names.length > 0
        ? [...primaryView.dt1Names]
        : collectTableLibraries(areaId)
    const currentTilePages = this.tileAtlas.getPagesForLibraries(currentLibs)
    const currentPageKeySet = new Set(currentTilePages.map(p => `${String(p.act)}:${String(p.page)}`))

    const addMonsterHcIdx = (rawId: number, targetSet: Set<number>, targetOut: number[]): void => {
      if (rawId < 0 || rawId >= tables.nMonStatsTxtRecordCount) return
      const rels = tables.monStatsRelatedHcIdx?.[rawId] ?? [rawId]
      for (const r of rels) {
        if (r >= 0 && r < tables.nMonStatsTxtRecordCount && !targetSet.has(r)) {
          targetSet.add(r)
          targetOut.push(r)
        }
      }
    }

    const addLevelMonsterPool = (
      targetAreaId: number,
      targetSet: Set<number>,
      targetOut: number[],
    ): void => {
      const pool = tables.levelMonsters?.[targetAreaId]
      if (!pool) return
      const mainList = difficulty > 0 ? pool.nightmareHellMonsters : pool.normalMonsters
      for (const id of mainList) addMonsterHcIdx(id, targetSet, targetOut)
      for (const id of pool.uniqueMonsters) addMonsterHcIdx(id, targetSet, targetOut)
      for (const id of pool.critterMonsters) addMonsterHcIdx(id, targetSet, targetOut)
    }

    const addPresetUnits = (
      view: LevelView,
      monsterSet: Set<number>,
      monsterOut: number[],
      objectSet?: Set<number>,
      objectOut?: number[],
    ): void => {
      for (const u of view.presetUnits) {
        if (u.type === 1) {
          if (u.index >= 0 && u.index < tables.nMonStatsTxtRecordCount) {
            addMonsterHcIdx(u.index, monsterSet, monsterOut)
          } else if (
            u.index >= tables.nMonStatsTxtRecordCount &&
            u.index < tables.nMonStatsTxtRecordCount + tables.nSuperUniquesTxtRecordCount
          ) {
            const suClassId = tables.superUniqueClassIds?.[u.index - tables.nMonStatsTxtRecordCount] ?? -1
            addMonsterHcIdx(suClassId, monsterSet, monsterOut)
          }
        } else if (u.type === 2 && u.index >= 0 && objectSet && objectOut) {
          if (!objectSet.has(u.index)) {
            objectSet.add(u.index)
            objectOut.push(u.index)
          }
        }
      }
    }

    const currentMonsterSet = new Set<number>()
    const currentMonsterHcIndices: number[] = []
    const currentObjectSet = new Set<number>()
    const currentObjectClassIds: number[] = []

    if (primaryView) {
      addPresetUnits(
        primaryView,
        currentMonsterSet,
        currentMonsterHcIndices,
        currentObjectSet,
        currentObjectClassIds,
      )
    }
    addLevelMonsterPool(areaId, currentMonsterSet, currentMonsterHcIndices)

    const neighborSet = new Set<number>()
    const neighborAreaIds: number[] = []
    const addNeighbor = (id: number): void => {
      if (id > 0 && id !== areaId && id < tables.nLevelsTxtRecordCount && !neighborSet.has(id)) {
        neighborSet.add(id)
        neighborAreaIds.push(id)
      }
    }

    const def = tables.levelDefs[areaId]
    if (def) {
      for (const visId of def.dwVis) {
        addNeighbor(visId)
      }
    }
    if (primaryView && Array.isArray(primaryView.entrances)) {
      for (const ent of primaryView.entrances) {
        addNeighbor(ent.toLevelId)
      }
    }

    const neighborLibs: string[] = []
    const neighborMonsterSet = new Set<number>(currentMonsterSet)
    const neighborMonsterHcIndices: number[] = []
    for (const neighborId of neighborAreaIds) {
      const cachedNeighborView = this.session
        ? this.viewCache.get(
            `${String(this.session.seed)}:${String(this.session.difficulty)}:${String(neighborId)}:all`,
          )
        : undefined
      if (cachedNeighborView && cachedNeighborView.dt1Names.length > 0) {
        neighborLibs.push(...cachedNeighborView.dt1Names)
        addPresetUnits(cachedNeighborView, neighborMonsterSet, neighborMonsterHcIndices)
      } else {
        neighborLibs.push(...collectTableLibraries(neighborId))
      }
      addLevelMonsterPool(neighborId, neighborMonsterSet, neighborMonsterHcIndices)
    }

    const neighborTilePages = this.tileAtlas
      .getPagesForLibraries(neighborLibs)
      .filter(p => !currentPageKeySet.has(`${String(p.act)}:${String(p.page)}`))

    return {
      areaId,
      actId,
      currentTilePages,
      currentMonsterHcIndices,
      currentObjectClassIds,
      neighborAreaIds,
      neighborTilePages,
      neighborMonsterHcIndices,
    }
  }

  handleRequest(req: MapWorkerRequest): MapWorkerResponse {
    try {
      switch (req.type) {
        case 'initFromBundle': {
          this.initFromBundle(req.manifest, req.bundleBytes, req.catalogIndex)
          return { id: req.id, ok: true, type: 'initFromBundle' }
        }
        case 'loadAct': {
          const view = this.loadAct({
            act: req.act,
            seed: req.seed,
            ...(req.difficulty !== undefined ? { difficulty: req.difficulty } : {}),
            ...(req.areaId !== undefined ? { areaId: req.areaId } : {}),
            ...(req.revealMode !== undefined ? { revealMode: req.revealMode } : {}),
          })
          return { id: req.id, ok: true, type: 'loadAct', view }
        }
        case 'getLevelView': {
          const view = this.getLevelView(req.areaId, req.revealMode ?? 'all')
          return { id: req.id, ok: true, type: 'getLevelView', view }
        }
        case 'revealRoom': {
          const { room, view } = this.revealRoom(req.areaId, req.roomX, req.roomY, {
            ...(req.rebuildView !== undefined ? { rebuildView: req.rebuildView } : {}),
            ...(req.revealMode !== undefined ? { revealMode: req.revealMode } : {}),
          })
          return { id: req.id, ok: true, type: 'revealRoom', room, view }
        }
        case 'hideRoom': {
          const { room, view } = this.hideRoom(req.areaId, req.roomX, req.roomY, {
            ...(req.rebuildView !== undefined ? { rebuildView: req.rebuildView } : {}),
            ...(req.revealMode !== undefined ? { revealMode: req.revealMode } : {}),
          })
          return { id: req.id, ok: true, type: 'hideRoom', room, view }
        }
      }
    } catch (err) {
      return {
        id: req.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}

// Auto-bind message listener when executed inside a Web Worker context
const globalScope = globalThis as unknown as {
  readonly document?: unknown
  readonly postMessage?: (message: MapWorkerResponse) => void
  readonly addEventListener?: (
    type: 'message',
    listener: (event: { readonly data: MapWorkerRequest }) => void,
  ) => void
}

if (
  typeof globalScope.addEventListener === 'function' &&
  typeof globalScope.postMessage === 'function' &&
  globalScope.document === undefined
) {
  const engine = new MapWorkerEngine()
  globalScope.addEventListener('message', event => {
    const res = engine.handleRequest(event.data)
    globalScope.postMessage!(res)
  })
}
