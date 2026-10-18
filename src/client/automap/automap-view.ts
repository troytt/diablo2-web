import { DRLG_GetActNoFromLevelId } from '../../common/drlg/drlg-drlg.ts'
import { getMonsterKindByClassId } from '../../common/units/monsters-data.ts'
import { NPC_HCIDX_TO_DESCRIPTOR_ID } from '../../common/units/npc-table.ts'
import { levelDisplayName } from '../../common/world/level-names-zh.ts'
import { getTblLang, lookupTbl, type TblLang } from '../i18n/lang.ts'
import type {
  MinimapLevel,
  MinimapMarker,
} from '../ui/minimap.ts'
import {
  type LevelRoomView,
  type LevelView,
} from '../map/level-view.ts'
import { MapService } from '../map/map-service.ts'
import type {
  AutomapRadarConfig,
  AutomapRevealMode,
} from '../settings/client-settings.ts'
import type { RenderableUnitInput } from '../view/unit-drawables.ts'

export interface MinimapEntityDot {
  readonly worldX: number
  readonly worldY: number
  readonly kind: 'ally' | 'monster' | 'corpse' | 'npc'
  readonly name?: string | undefined
}

export interface MinimapPortalIcon {
  readonly worldX: number
  readonly worldY: number
  readonly active: boolean
}

export interface MinimapStashIcon {
  readonly worldX: number
  readonly worldY: number
}

export type ActId = 1 | 2 | 3 | 4 | 5
export type DifficultyId = 0 | 1 | 2

/**
 * Resolves the 1-based Act ID (1..5) for a given level areaId using canonical DRLG table logic
 * (D2Common.0x6FD75300 #10001 DRLG_GetActNoFromLevelId).
 */
export function getActForArea(areaId: number): ActId {
  const act0 = DRLG_GetActNoFromLevelId(areaId)
  return (act0 + 1) as ActId
}

/**
 * Localized difficulty string ('Normal' | 'Nightmare' | 'Hell' / '普通' | '惡夢' | '地獄')
 * wired to .tbl string keys (strNormal, strNightmare, strHell) per Issue #628.
 */
export function getLocalizedDifficulty(
  difficulty: DifficultyId,
  lang: TblLang = getTblLang(),
): string {
  const isZh = lang === 'CHI'
  if (difficulty === 1) {
    return lookupTbl('strNightmare', lang) ?? (isZh ? '惡夢' : 'Nightmare')
  }
  if (difficulty === 2) {
    return lookupTbl('strHell', lang) ?? (isZh ? '地獄' : 'Hell')
  }
  return lookupTbl('strNormal', lang) ?? (isZh ? '普通' : 'Normal')
}

/**
 * Canonical preset town levels with AutoMap=1 in LvlPrest.txt (DrlgPreset.cpp:1794-1823):
 * 1 (Rogue Encampment), 40 (Lut Gholein), 75 (Kurast Docks), 103 (Pandemonium Fortress), 109 (Harrogath).
 */
export const TOWN_LEVEL_IDS: ReadonlySet<number> = new Set([1, 40, 75, 103, 109])

/**
 * Canonical Objects.txt waypoint class IDs across Acts 1-5 (`kb/ui/d2client-automap-waypoint-parity.md`).
 */
export const WAYPOINT_OBJECT_CLASS_IDS: ReadonlySet<number> = new Set([
  119, 145, 156, 157, 237, 238, 288, 323, 324, 398, 402, 429, 494, 496, 511, 539,
])

export function isTownLevel(levelId: number): boolean {
  return TOWN_LEVEL_IDS.has(levelId)
}

/**
 * Primary outdoor/dungeon progression level IDs per Act for `'act'` reveal mode.
 */
export const ACT_PRIMARY_LEVEL_IDS: Readonly<Record<ActId, readonly number[]>> = {
  1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 26, 27, 28, 29, 32, 34, 35, 36, 37],
  2: [40, 41, 42, 43, 44, 45, 46, 47, 50, 56, 58, 62, 65, 66, 74],
  3: [75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 88, 92, 100, 101, 102],
  4: [103, 104, 105, 106, 107, 108],
  5: [109, 110, 111, 112, 113, 115, 117, 118, 120, 121, 128, 129, 130, 131, 132],
}

export interface AutomapRoomSummary {
  readonly areaId: number
  readonly roomX: number
  readonly roomY: number
  readonly roomW: number
  readonly roomH: number
  readonly revealedByServer: boolean
}

export interface AutomapWarpMarker {
  readonly fromAreaId: number
  readonly toAreaId: number
  readonly cellX: number
  readonly cellY: number
  readonly label: string
}

export interface AutomapSnapshot {
  readonly mode: AutomapRevealMode
  readonly actId: ActId
  readonly currentAreaId: number
  readonly visibleAreaIds: readonly number[]
  readonly visibleRoomCount: number
  readonly serverRevealedRoomCount: number
  readonly visibleRooms: readonly AutomapRoomSummary[]
  readonly warpMarkers: readonly AutomapWarpMarker[]
  readonly entityDots: readonly MinimapEntityDot[]
  readonly portalIcons: readonly MinimapPortalIcon[]
  readonly stashIcons: readonly MinimapStashIcon[]
}

export interface AutomapViewOptions {
  readonly mapService?: MapService | null | undefined
  readonly initialMode?: AutomapRevealMode | undefined
  readonly initialRadar?: AutomapRadarConfig | undefined
  readonly actRevealLevelIds?: Readonly<Record<ActId, readonly number[]>> | undefined
}

function makeRoomKey(areaId: number, roomX: number, roomY: number): string {
  return `${areaId}:${roomX},${roomY}`
}

/**
 * Online & offline Automap Reveal controller (`off` | `level` | `act`) consuming
 * `LevelView` and `MapService` (`src/client/map/`).
 *
 * - `'off'`: Only rooms explicitly revealed by D2GS `0x07 AddMapRoom` (minus `0x08 RemoveMapRoom`) are visible.
 * - `'level'`: All DRLG rooms in the active `areaId` are revealed.
 * - `'act'`: All DRLG levels and rooms in the active Act are generated and revealed with cross-level warp markers.
 */
export class AutomapView {
  private mapService: MapService | null
  private readonly actRevealLevelIds: Readonly<Record<ActId, readonly number[]>>
  private mode: AutomapRevealMode
  private radarConfig: AutomapRadarConfig
  private showWaypoints = false
  private mapSeed = 0
  private difficulty: DifficultyId = 0
  private currentAreaId = 1
  private currentActId: ActId = 1
  private pendingVisibilityToggle = false
  private dirtyVersion = 1
  private cachedMinimapLevel: { readonly key: string; readonly level: MinimapLevel } | null = null
  private cachedRoomSnapshot: {
    readonly key: string
    readonly visibleAreaIds: readonly number[]
    readonly visibleRooms: readonly AutomapRoomSummary[]
    readonly warpMarkers: readonly AutomapWarpMarker[]
    readonly serverRevealedCount: number
  } | null = null
  private readonly levelViews = new Map<number, LevelView>()
  private readonly serverRevealedRooms = new Map<
    string,
    { readonly areaId: number; readonly roomX: number; readonly roomY: number }
  >()
  private readonly serverRevealedRoomsByArea = new Map<
    number,
    Map<string, { readonly areaId: number; readonly roomX: number; readonly roomY: number }>
  >()

  /**
   * Drop cached `LevelView`s outside `keepAreaIds` (#954 view retention): the
   * reveal history (`serverRevealedRooms*`) is kept verbatim, and a dropped
   * view is rebuilt through `ensureLevelView` the next time it is drawn, so
   * automap exploration never regresses — only the render projection is freed.
   */
  dropLevelViewsExcept(keepAreaIds: Iterable<number>): number {
    const keep = new Set<number>()
    for (const id of keepAreaIds) {
      if (id > 0) keep.add(id)
    }
    let dropped = 0
    for (const id of [...this.levelViews.keys()]) {
      if (!keep.has(id)) {
        this.levelViews.delete(id)
        dropped += 1
      }
    }
    return dropped
  }

  constructor(options?: AutomapViewOptions) {
    const initialMode = options?.initialMode ?? 'off'
    if (initialMode !== 'off' && initialMode !== 'level' && initialMode !== 'act') {
      throw new Error(`Invalid automap reveal mode: ${String(initialMode)}`)
    }
    this.mapService = options?.mapService ?? null
    this.mode = initialMode
    this.radarConfig = {
      automapShowMonsters: options?.initialRadar?.automapShowMonsters === true,
      automapShowShrines: options?.initialRadar?.automapShowShrines === true,
    }
    this.showWaypoints = options?.initialRadar?.automapShowWaypoints === true
    this.actRevealLevelIds = options?.actRevealLevelIds ?? ACT_PRIMARY_LEVEL_IDS
  }

  getMode(): AutomapRevealMode {
    return this.mode
  }

  setMode(mode: AutomapRevealMode): void {
    if (mode !== 'off' && mode !== 'level' && mode !== 'act') {
      throw new Error(`Invalid automap reveal mode: ${String(mode)}`)
    }
    if (this.mode !== mode) {
      this.mode = mode
      this.dirtyVersion += 1
    }
    this.applyRevealModeToViews()
  }

  getRadarConfig(): AutomapRadarConfig {
    return this.radarConfig
  }

  getShowWaypoints(): boolean {
    return this.showWaypoints
  }

  setRadarConfig(patch: Partial<AutomapRadarConfig>): void {
    const nextMonsters =
      typeof patch.automapShowMonsters === 'boolean'
        ? patch.automapShowMonsters
        : this.radarConfig.automapShowMonsters
    const nextShrines =
      typeof patch.automapShowShrines === 'boolean'
        ? patch.automapShowShrines
        : this.radarConfig.automapShowShrines
    const nextWaypoints =
      typeof patch.automapShowWaypoints === 'boolean'
        ? patch.automapShowWaypoints
        : this.showWaypoints
    if (
      nextMonsters !== this.radarConfig.automapShowMonsters ||
      nextShrines !== this.radarConfig.automapShowShrines ||
      nextWaypoints !== this.showWaypoints
    ) {
      this.radarConfig = {
        automapShowMonsters: nextMonsters,
        automapShowShrines: nextShrines,
      }
      this.showWaypoints = nextWaypoints
      this.dirtyVersion += 1
    }
  }

  requestVisibilityToggle(): void {
    this.pendingVisibilityToggle = true
  }

  consumeVisibilityToggleRequest(): boolean {
    if (!this.pendingVisibilityToggle) return false
    this.pendingVisibilityToggle = false
    return true
  }

  getCurrentAreaId(): number {
    return this.currentAreaId
  }

  getCurrentActId(): ActId {
    return this.currentActId
  }

  /**
   * Bind or update the active map seed, difficulty, and current `areaId`.
   */
  setContext(
    mapSeed: number,
    difficulty: DifficultyId,
    areaId: number,
    existingLevelView?: LevelView,
  ): LevelView {
    const nextActId = getActForArea(areaId)
    const seedChanged = this.mapSeed !== (mapSeed >>> 0) || this.difficulty !== difficulty
    const actChanged = this.levelViews.size > 0 && this.currentActId !== nextActId
    this.mapSeed = mapSeed >>> 0
    this.difficulty = difficulty
    this.currentAreaId = areaId
    this.currentActId = nextActId
    this.dirtyVersion += 1

    if (seedChanged || actChanged) {
      this.levelViews.clear()
      this.serverRevealedRooms.clear()
      this.serverRevealedRoomsByArea.clear()
      if (this.mapService && typeof (this.mapService as Partial<MapService>).loadAct === 'function') {
        try {
          const loaded = this.mapService.loadAct({
            act: this.currentActId - 1,
            seed: this.mapSeed,
            difficulty: this.difficulty,
            areaId,
            revealMode: 'all',
          })
          if (loaded) {
            this.levelViews.set(areaId, loaded)
          }
        } catch {
          // Ignore if mapService fails synchronously
        }
      }
    }

    if (existingLevelView) {
      this.levelViews.set(areaId, existingLevelView)
    } else if (this.mapService && !this.levelViews.has(areaId)) {
      this.ensureLevelView(areaId)
    }

    this.applyRevealModeToViews()
    return this.levelViews.get(areaId)!
  }

  /**
   * Switch the active level (`currentAreaId` / `currentActId`) within the current game session
   * without clearing `levelViews` or `serverRevealedRooms` (#549).
   */
  syncActiveLevel(areaId: number, existingLevelView?: LevelView): LevelView {
    const prevAreaId = this.currentAreaId
    if (areaId > 0) {
      this.currentAreaId = areaId
      this.currentActId = getActForArea(areaId)
    }
    const targetAreaId = this.currentAreaId
    const prevView = this.levelViews.get(targetAreaId)
    if (
      prevAreaId === targetAreaId &&
      prevView !== undefined &&
      (existingLevelView === undefined || existingLevelView === prevView)
    ) {
      return prevView
    }
    this.dirtyVersion += 1
    if (existingLevelView && existingLevelView.areaId === targetAreaId) {
      this.levelViews.set(targetAreaId, existingLevelView)
    } else if (this.mapService && !this.levelViews.has(targetAreaId)) {
      this.ensureLevelView(targetAreaId)
    }
    this.applyRevealModeToViews()
    return this.levelViews.get(targetAreaId)!
  }

  /**
   * Record a server `0x07 AddMapRoom` event.
   */
  onServerAddRoom(
    roomX: number,
    roomY: number,
    areaId: number = this.currentAreaId,
    options?: { readonly notifyMapService?: boolean },
  ): void {
    if (this.mapService && !this.levelViews.has(areaId)) {
      if (typeof (this.mapService as Partial<MapService>).getLoadedLevelView === 'function') {
        const loaded = this.mapService.getLoadedLevelView(areaId)
        if (loaded) {
          this.levelViews.set(areaId, loaded)
        }
      }
      if (!this.levelViews.has(areaId)) {
        this.ensureLevelView(areaId)
      }
    }
    const roomKey = makeRoomKey(areaId, roomX, roomY)
    if (!this.serverRevealedRooms.has(roomKey)) {
      this.dirtyVersion += 1
    }
    const entry = {
      areaId,
      roomX,
      roomY,
    }
    this.serverRevealedRooms.set(roomKey, entry)
    let byArea = this.serverRevealedRoomsByArea.get(areaId)
    if (!byArea) {
      byArea = new Map()
      this.serverRevealedRoomsByArea.set(areaId, byArea)
    }
    byArea.set(roomKey, entry)
    if (
      options?.notifyMapService !== false &&
      this.mapService &&
      typeof this.mapService.onAddRoomDataPacket === 'function'
    ) {
      this.mapService.onAddRoomDataPacket(
        { areaId, roomX, roomY },
        { rebuildView: false },
      )
    }
  }

  /**
   * Record a server `0x08 RemoveMapRoom` event.
   */
  onServerRemoveRoom(
    roomX: number,
    roomY: number,
    areaId: number = this.currentAreaId,
    options?: { readonly notifyMapService?: boolean },
  ): void {
    const roomKey = makeRoomKey(areaId, roomX, roomY)
    if (this.serverRevealedRooms.delete(roomKey)) {
      this.dirtyVersion += 1
    }
    const byArea = this.serverRevealedRoomsByArea.get(areaId)
    if (byArea) {
      byArea.delete(roomKey)
      if (byArea.size === 0) {
        this.serverRevealedRoomsByArea.delete(areaId)
      }
    }
    if (
      options?.notifyMapService !== false &&
      this.mapService &&
      typeof this.mapService.onRemoveRoomDataPacket === 'function'
    ) {
      this.mapService.onRemoveRoomDataPacket(
        { areaId, roomX, roomY },
        { rebuildView: false },
      )
    }
  }

  getLevelView(areaId: number = this.currentAreaId): LevelView | undefined {
    return this.levelViews.get(areaId)
  }

  private ensureLevelView(areaId: number): LevelView | undefined {
    let view = this.levelViews.get(areaId)
    if (!view) {
      if (!this.mapService) {
        return undefined
      }
      try {
        if (typeof (this.mapService as Partial<MapService>).loadAct === 'function') {
          const activeAct =
            typeof (this.mapService as Partial<MapService>).getActiveAct === 'function'
              ? this.mapService.getActiveAct()
              : null
          if (activeAct !== getActForArea(areaId) - 1) {
            this.mapService.loadAct({
              act: getActForArea(areaId) - 1,
              seed: this.mapSeed,
              difficulty: this.difficulty,
              areaId,
              revealMode: 'all',
            })
          }
        }
        if (
          areaId !== this.currentAreaId &&
          typeof (this.mapService as Partial<MapService>).peekLevelView === 'function'
        ) {
          view = this.mapService.peekLevelView(areaId, 'all') ?? undefined
        } else if (typeof (this.mapService as Partial<MapService>).getLevelView === 'function') {
          view = this.mapService.getLevelView(areaId, 'all') ?? undefined
        }
        if (view) {
          this.levelViews.set(areaId, view)
        }
      } catch {
        return undefined
      }
    }
    return view
  }

  private syncConnectedLevelViewsFromMapService(): void {
    if (!this.mapService) return
    if (typeof (this.mapService as Partial<MapService>).getConnectedLevelViews === 'function') {
      const connected = this.mapService.getConnectedLevelViews(this.currentAreaId)
      for (const cv of connected) {
        if (cv.areaId > 0 && !this.levelViews.has(cv.areaId)) {
          this.levelViews.set(cv.areaId, cv)
          this.dirtyVersion += 1
        }
      }
    }
    if (typeof (this.mapService as Partial<MapService>).getLoadedLevelView === 'function') {
      for (const [revAreaId, byArea] of this.serverRevealedRoomsByArea) {
        if (
          byArea.size > 0 &&
          revAreaId > 0 &&
          getActForArea(revAreaId) === this.currentActId &&
          !this.levelViews.has(revAreaId)
        ) {
          const loaded = this.mapService.getLoadedLevelView(revAreaId)
          if (loaded) {
            this.levelViews.set(revAreaId, loaded)
            this.dirtyVersion += 1
          }
        }
      }
    }
  }

  private applyRevealModeToViews(): void {
    if (!this.mapService) {
      return
    }
    const currentView = this.ensureLevelView(this.currentAreaId)
    this.syncConnectedLevelViewsFromMapService()
    if (currentView && Array.isArray(currentView.entrances)) {
      for (const ent of currentView.entrances) {
        if (
          ent.toLevelId > 0 &&
          ent.toLevelId !== this.currentAreaId &&
          getActForArea(ent.toLevelId) === this.currentActId &&
          (this.mode === 'level' ||
            ent.kind === 'gate' ||
            isTownLevel(ent.toLevelId) ||
            isTownLevel(this.currentAreaId))
        ) {
          this.ensureLevelView(ent.toLevelId)
        }
      }
    }
    if (this.mode === 'act' && this.mapService) {
      const actLevels = this.actRevealLevelIds[this.currentActId] ?? [this.currentAreaId]
      const idsToReveal = actLevels.includes(this.currentAreaId)
        ? actLevels
        : [this.currentAreaId, ...actLevels]
      for (const lvlId of idsToReveal) {
        this.ensureLevelView(lvlId)
      }
    }
  }

  private resolveStitchedAreaIds(primaryView?: LevelView): number[] {
    if (this.mode === 'act') {
      return Array.from(
        new Set([
          this.currentAreaId,
          ...(this.actRevealLevelIds[this.currentActId] ?? []),
          ...Array.from(this.levelViews.keys()).filter(
            (id) => getActForArea(id) === this.currentActId,
          ),
        ]),
      )
    }
    const result: number[] = [this.currentAreaId]
    const view = primaryView ?? this.levelViews.get(this.currentAreaId)
    if (!view) return result
    const primaryLayerId = view.automap?.layerId ?? 0
    const gateNeighbourIds = new Set<number>()
    if (Array.isArray(view.entrances)) {
      for (const ent of view.entrances) {
        if (ent.toLevelId > 0 && ent.kind === 'gate') {
          gateNeighbourIds.add(ent.toLevelId)
        }
      }
    }
    for (const [otherAreaId, otherView] of this.levelViews) {
      if (otherAreaId === this.currentAreaId) continue
      if (getActForArea(otherAreaId) !== this.currentActId) continue
      const sameLayer =
        primaryLayerId > 0 && (otherView.automap?.layerId ?? 0) === primaryLayerId
      const isGateLinked =
        gateNeighbourIds.has(otherAreaId) ||
        Boolean(
          otherView.entrances?.some(
            (e) => e.toLevelId === this.currentAreaId && e.kind === 'gate',
          ),
        )
      if (sameLayer || isGateLinked) {
        result.push(otherAreaId)
      }
    }
    return result
  }

  private hasServerRevealedRoomsForArea(areaId: number): boolean {
    const byArea = this.serverRevealedRoomsByArea.get(areaId)
    return byArea !== undefined && byArea.size > 0
  }

  private createServerRevealedCellPredicate(
    areaId: number,
    view: LevelView,
  ): (cellX: number, cellY: number) => boolean {
    const byArea = this.serverRevealedRoomsByArea.get(areaId)
    if (!byArea || byArea.size === 0) {
      return () => false
    }
    const minCellX = view.tileOriginX ?? Math.floor((view.subOriginX ?? 0) / 5)
    const minCellY = view.tileOriginY ?? Math.floor((view.subOriginY ?? 0) / 5)
    const cellsX = view.cellsX | 0
    const cellsY = view.cellsY | 0
    const useBitmap = cellsX > 0 && cellsY > 0 && cellsX * cellsY <= 262144
    const bitmap = useBitmap ? new Uint8Array(cellsX * cellsY) : null
    const stampRect = (x0: number, y0: number, w: number, h: number): void => {
      if (!bitmap) return
      const startX = Math.max(0, x0 | 0)
      const endX = Math.min(cellsX, (x0 + w) | 0)
      const startY = Math.max(0, y0 | 0)
      const endY = Math.min(cellsY, (y0 + h) | 0)
      for (let y = startY; y < endY; y++) {
        const rowOffset = y * cellsX
        bitmap.fill(1, rowOffset + startX, rowOffset + endX)
      }
    }

    const revealedRooms: LevelRoomView[] = []
    if (Array.isArray(view.rooms)) {
      for (const room of view.rooms) {
        if (!this.isRoomRevealedByServer(areaId, room)) continue
        revealedRooms.push(room)
        const localX = room.localTileX ?? room.tileX - minCellX
        const localY = room.localTileY ?? room.tileY - minCellY
        stampRect(localX, localY, room.tileW, room.tileH)
        const worldRelX = room.tileX - minCellX
        const worldRelY = room.tileY - minCellY
        if (worldRelX !== localX || worldRelY !== localY) {
          stampRect(worldRelX, worldRelY, room.tileW, room.tileH)
        }
      }
    }
    const revEntries = [...byArea.values()]
    for (const rev of revEntries) {
      stampRect(rev.roomX - minCellX, rev.roomY - minCellY, 8, 8)
      if (minCellX !== 0 || minCellY !== 0) {
        stampRect(rev.roomX, rev.roomY, 8, 8)
      }
    }

    return (cellX: number, cellY: number): boolean => {
      if (
        bitmap !== null &&
        cellX === (cellX | 0) &&
        cellY === (cellY | 0) &&
        cellX >= 0 &&
        cellX < cellsX &&
        cellY >= 0 &&
        cellY < cellsY
      ) {
        return bitmap[cellY * cellsX + cellX] === 1
      }
      const worldTileX = minCellX + cellX
      const worldTileY = minCellY + cellY
      for (let i = 0; i < revealedRooms.length; i++) {
        const room = revealedRooms[i]!
        const localX = room.localTileX ?? room.tileX - minCellX
        const localY = room.localTileY ?? room.tileY - minCellY
        if (
          (cellX >= localX &&
            cellX < localX + room.tileW &&
            cellY >= localY &&
            cellY < localY + room.tileH) ||
          (worldTileX >= room.tileX &&
            worldTileX < room.tileX + room.tileW &&
            worldTileY >= room.tileY &&
            worldTileY < room.tileY + room.tileH)
        ) {
          return true
        }
      }
      for (let i = 0; i < revEntries.length; i++) {
        const rev = revEntries[i]!
        if (
          (worldTileX >= rev.roomX &&
            worldTileX < rev.roomX + 8 &&
            worldTileY >= rev.roomY &&
            worldTileY < rev.roomY + 8) ||
          (cellX >= rev.roomX &&
            cellX < rev.roomX + 8 &&
            cellY >= rev.roomY &&
            cellY < rev.roomY + 8)
        ) {
          return true
        }
      }
      return false
    }
  }

  private isRoomRevealedByServer(areaId: number, room: LevelRoomView): boolean {
    const byArea = this.serverRevealedRoomsByArea.get(areaId)
    if (!byArea || byArea.size === 0) return false
    if (byArea.has(makeRoomKey(areaId, room.tileX, room.tileY))) {
      return true
    }
    for (const rev of byArea.values()) {
      if (
        rev.roomX >= room.tileX &&
        rev.roomX < room.tileX + room.tileW &&
        rev.roomY >= room.tileY &&
        rev.roomY < room.tileY + room.tileH
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Build a complete `AutomapSnapshot` reflecting the active reveal mode (`off` | `level` | `act`),
   * visible rooms, cross-level warp markers, and entity/portal/stash icons.
   */
  buildSnapshot(
    units: Iterable<RenderableUnitInput> = [],
    lang: TblLang = getTblLang(),
  ): AutomapSnapshot {
    this.syncConnectedLevelViewsFromMapService()
    const roomCacheKey = `${this.dirtyVersion}:${this.currentAreaId}:${this.mode}:${lang}:${this.mapSeed}:${this.difficulty}`
    let roomSnap = this.cachedRoomSnapshot
    if (!roomSnap || roomSnap.key !== roomCacheKey) {
      this.applyRevealModeToViews()

      const visibleAreaIds: number[] = this.resolveStitchedAreaIds()

      const visibleRooms: AutomapRoomSummary[] = []
      const warpMarkers: AutomapWarpMarker[] = []

      for (const areaId of visibleAreaIds) {
        const view = this.levelViews.get(areaId)
        if (!view) continue
        if (this.mode === 'off') {
          let firstRevealed: LevelRoomView | undefined
          for (const room of view.rooms) {
            if (!this.isRoomRevealedByServer(areaId, room)) continue
            if (!firstRevealed) firstRevealed = room
            visibleRooms.push({
              areaId,
              roomX: room.tileX,
              roomY: room.tileY,
              roomW: room.tileW,
              roomH: room.tileH,
              revealedByServer: true,
            })
          }
          if (firstRevealed) {
            warpMarkers.push({
              fromAreaId: this.currentAreaId,
              toAreaId: areaId,
              cellX: firstRevealed.tileX + Math.floor(firstRevealed.tileW / 2),
              cellY: firstRevealed.tileY + Math.floor(firstRevealed.tileH / 2),
              label: levelDisplayName(areaId, lang),
            })
          }
        } else {
          for (const room of view.rooms) {
            visibleRooms.push({
              areaId,
              roomX: room.tileX,
              roomY: room.tileY,
              roomW: room.tileW,
              roomH: room.tileH,
              revealedByServer: this.isRoomRevealedByServer(areaId, room),
            })
          }
          if (view.rooms.length > 0) {
            const first = view.rooms[0]!
            warpMarkers.push({
              fromAreaId: this.currentAreaId,
              toAreaId: areaId,
              cellX: first.tileX + Math.floor(first.tileW / 2),
              cellY: first.tileY + Math.floor(first.tileH / 2),
              label: levelDisplayName(areaId, lang),
            })
          }
        }
      }

      let serverRevealedCount = 0
      const visibleSet = new Set(visibleAreaIds)
      for (const [revAreaId, byArea] of this.serverRevealedRoomsByArea) {
        if (this.mode === 'act' || visibleSet.has(revAreaId)) {
          serverRevealedCount += byArea.size
        }
      }

      roomSnap = {
        key: roomCacheKey,
        visibleAreaIds,
        visibleRooms,
        warpMarkers,
        serverRevealedCount,
      }
      this.cachedRoomSnapshot = roomSnap
    }

    const entityDots: MinimapEntityDot[] = []
    const portalIcons: MinimapPortalIcon[] = []
    const stashIcons: MinimapStashIcon[] = []

    for (const u of units) {
      if (u.kind === 'missile' || u.kind === 'item') continue
      const worldX = (u.x - u.y) * 16
      const worldY = (u.x + u.y) * 8
      if (u.kind === 'object') {
        const tok = (u.token ?? '').toUpperCase()
        if (tok === 'PF' || u.classId === 59 || u.classId === 60) {
          portalIcons.push({ worldX, worldY, active: true })
        } else if (tok === 'B6' || u.classId === 267) {
          stashIcons.push({ worldX, worldY })
        }
        continue
      }
      if (u.kind === 'player') {
        const isDeadPlayer =
          Boolean(u.isCorpse) ||
          u.mode === 17 ||
          u.mode === 0 ||
          (u.lifePct !== undefined && u.lifePct <= 0)
        entityDots.push({
          worldX,
          worldY,
          kind: isDeadPlayer ? 'corpse' : 'ally',
          name: u.name,
        })
      } else if (u.kind === 'monster') {
        // Diablo II v1.13c Parity (0x6FB12430 AUTOMAP_DrawUnits):
        // 1. NEVER draw hostile monsters or monster corpses on the automap!
        // 2. Live player mercenaries / summons (ownerType === 'player' / 0 or isPartyMember) are drawn as 'ally'.
        // 3. Live interactable NPCs (interact=1, excluding ancient statues 537..539) are drawn as 'npc'.
        const isDead =
          Boolean(u.isCorpse) ||
          u.mode === 12 ||
          u.mode === 0 ||
          (u.lifePct !== undefined && u.lifePct <= 0)
        if (isDead) {
          continue
        }
        const cid = u.classId ?? 0
        const isAncientStatue = cid >= 537 && cid <= 539
        const mk = typeof u.classId === 'number' ? getMonsterKindByClassId(u.classId) : undefined
        const isTownNpc = Boolean(NPC_HCIDX_TO_DESCRIPTOR_ID.has(cid) || NPC_HCIDX_TO_DESCRIPTOR_ID[cid])
        const isInteract = Boolean(mk?.interact || (u as { isNpc?: boolean }).isNpc || isTownNpc)
        const ownerTypeRaw = (u as { ownerType?: string | number }).ownerType
        const isFriendlySummonOrMerc =
          ownerTypeRaw === 'player' ||
          ownerTypeRaw === 0 ||
          Boolean(u.isPartyMember)
        if (isFriendlySummonOrMerc) {
          entityDots.push({
            worldX,
            worldY,
            kind: 'ally',
            name: u.name,
          })
        } else if (isInteract && !isAncientStatue) {
          entityDots.push({
            worldX,
            worldY,
            kind: 'npc',
            name: u.name,
          })
        }
      }
    }

    return {
      mode: this.mode,
      actId: this.currentActId,
      currentAreaId: this.currentAreaId,
      visibleAreaIds: roomSnap.visibleAreaIds,
      visibleRoomCount: roomSnap.visibleRooms.length,
      serverRevealedRoomCount: roomSnap.serverRevealedCount,
      visibleRooms: roomSnap.visibleRooms,
      warpMarkers: roomSnap.warpMarkers,
      entityDots,
      portalIcons,
      stashIcons,
    }
  }

  /**
   * Returns the cached `MinimapLevel` for `areaId` without deep-cloning cells.
   */
  getLevel(areaId: number = this.currentAreaId, lang: TblLang = getTblLang()): MinimapLevel {
    return this.buildMinimapLevel(lang, areaId)
  }

  /**
   * Build a `MinimapLevel` descriptor suitable for `Minimap.draw(...)` (`src/ui/minimap.ts`).
   */
  buildMinimapLevel(lang: TblLang = getTblLang(), areaId?: number): MinimapLevel {
    if (areaId !== undefined && areaId > 0 && areaId !== this.currentAreaId) {
      this.syncActiveLevel(areaId)
    }
    this.syncConnectedLevelViewsFromMapService()
    const cacheKey = `${this.dirtyVersion}:${this.currentAreaId}:${this.mode}:${lang}:${this.mapSeed}:${this.difficulty}`
    if (this.cachedMinimapLevel && this.cachedMinimapLevel.key === cacheKey) {
      return this.cachedMinimapLevel.level
    }
    this.applyRevealModeToViews()
    const view = this.ensureLevelView(this.currentAreaId)
    if (!view) {
      throw new Error(
        `[AutomapView] Failed to load LevelView for area ${this.currentAreaId} (seed: ${this.mapSeed}, difficulty: ${this.difficulty}): mapService is not initialized and packed tile bundle is unavailable`,
      )
    }

    if (
      view.cellsX <= 0 ||
      view.cellsY <= 0 ||
      !view.blocked ||
      view.blocked.length !== view.cellsX * 5 * view.cellsY * 5
    ) {
      throw new Error(
        `[AutomapView] Invalid LevelView for area ${this.currentAreaId}: cellsX=${view.cellsX}, cellsY=${view.cellsY}, blockedLength=${view.blocked?.length ?? 0} (expected ${view.cellsX * 5 * view.cellsY * 5})`,
      )
    }

    if (!view.automap) {
      throw new Error(
        `[AutomapView] Missing authentic automap layer data for area ${this.currentAreaId}`,
      )
    }

    const minCellX = view.tileOriginX ?? Math.floor((view.subOriginX ?? 0) / 5)
    const minCellY = view.tileOriginY ?? Math.floor((view.subOriginY ?? 0) / 5)
    const cellsX = view.cellsX
    const cellsY = view.cellsY
    const subW = view.gridWidth || cellsX * 5
    const blocked = view.blocked
    const originX = view.isoOriginX ?? (minCellX - minCellY) * 80
    const originY = view.isoOriginY ?? (minCellX + minCellY) * 40

    const markers: MinimapMarker[] = []
    const primaryHasServerRevealedRooms =
      this.mode === 'off' &&
      !isTownLevel(this.currentAreaId) &&
      this.hasServerRevealedRoomsForArea(this.currentAreaId)
    const isPrimaryCellRevealed = primaryHasServerRevealedRooms
      ? this.createServerRevealedCellPredicate(this.currentAreaId, view)
      : null

    if (Array.isArray(view.entrances)) {
      for (const ent of view.entrances) {
        if (ent.toLevelId > 0 && ent.toLevelId !== this.currentAreaId) {
          const entPreRevealed =
            isPrimaryCellRevealed !== null && isPrimaryCellRevealed(ent.x, ent.y)
          markers.push({
            cellX: ent.x,
            cellY: ent.y,
            kind: 'exit',
            toLevelId: ent.toLevelId,
            targetName: levelDisplayName(ent.toLevelId, lang),
            ...(entPreRevealed ? { preRevealed: true } : {}),
          })
        }
      }
    }

    const primaryHasWaypointCell =
      view.automap.floors.some((c) => c.cellNo === 307 || c.cellNo === 618) ||
      view.automap.objects.some((c) => c.cellNo === 307)
    if (!primaryHasWaypointCell && Array.isArray(view.presetUnits)) {
      for (const u of view.presetUnits) {
        if (u.type === 2 && WAYPOINT_OBJECT_CLASS_IDS.has(u.index)) {
          const wpCellX = Math.trunc(u.subX / 5)
          const wpCellY = Math.trunc(u.subY / 5)
          const wpPreRevealed =
            isPrimaryCellRevealed !== null && isPrimaryCellRevealed(wpCellX, wpCellY)
          markers.push({
            cellX: wpCellX,
            cellY: wpCellY,
            kind: 'waypoint',
            ...(wpPreRevealed ? { preRevealed: true } : {}),
          })
        }
      }
    }

    const preRevealTown =
      isTownLevel(this.currentAreaId) || this.mode === 'level' || this.mode === 'act'

    let automap = view.automap
    const visibleAreaIds = this.resolveStitchedAreaIds(view)
    if (visibleAreaIds.length > 1 || primaryHasServerRevealedRooms) {
      const mapPrimaryCell = (c: (typeof view.automap.floors)[number]) => {
        if (isPrimaryCellRevealed === null) return c
        if (
          typeof c.cellX === 'number' &&
          typeof c.cellY === 'number' &&
          isPrimaryCellRevealed(c.cellX, c.cellY)
        ) {
          return { ...c, preRevealed: true }
        }
        return c
      }
      const mergedFloors = primaryHasServerRevealedRooms
        ? view.automap.floors.map(mapPrimaryCell)
        : [...view.automap.floors]
      const mergedWalls = primaryHasServerRevealedRooms
        ? view.automap.walls.map(mapPrimaryCell)
        : [...view.automap.walls]
      const mergedObjects = primaryHasServerRevealedRooms
        ? view.automap.objects.map(mapPrimaryCell)
        : [...view.automap.objects]
      const mergedExtras = primaryHasServerRevealedRooms
        ? view.automap.extras.map(mapPrimaryCell)
        : [...view.automap.extras]

      for (const otherAreaId of visibleAreaIds) {
        if (otherAreaId === this.currentAreaId) continue
        const otherView = this.levelViews.get(otherAreaId)
        if (!otherView?.automap) continue
        const otherMinCellX =
          otherView.tileOriginX ?? Math.floor((otherView.subOriginX ?? 0) / 5)
        const otherMinCellY =
          otherView.tileOriginY ?? Math.floor((otherView.subOriginY ?? 0) / 5)
        const dCellX = otherMinCellX - minCellX
        const dCellY = otherMinCellY - minCellY
        // D2Common.0x6FD8D6E0 DUNGEON_GameTileToClientCoords exact automap pixel shift:
        // xPixel = (cellX - cellY) * 8, yPixel = (cellX + cellY) * 4 - 4
        const dxPixel = (dCellX - dCellY) * 8
        const dyPixel = (dCellX + dCellY) * 4
        const otherAlwaysPreRevealed =
          this.mode === 'level' || this.mode === 'act' || isTownLevel(otherAreaId)
        const otherHasServerRevealed =
          !otherAlwaysPreRevealed && this.hasServerRevealedRoomsForArea(otherAreaId)
        const isOtherCellRevealed = otherHasServerRevealed
          ? this.createServerRevealedCellPredicate(otherAreaId, otherView)
          : null

        const remapCell = (c: (typeof mergedFloors)[number]) => {
          const preRevealed = otherAlwaysPreRevealed
            ? true
            : isOtherCellRevealed !== null &&
                typeof c.cellX === 'number' &&
                typeof c.cellY === 'number' &&
                isOtherCellRevealed(c.cellX, c.cellY)
              ? true
              : false
          return {
            ...c,
            xPixel: c.xPixel + dxPixel,
            yPixel: c.yPixel + dyPixel,
            ...(typeof c.cellX === 'number' ? { cellX: c.cellX + dCellX } : {}),
            ...(typeof c.cellY === 'number' ? { cellY: c.cellY + dCellY } : {}),
            preRevealed,
          }
        }

        for (const c of otherView.automap.floors) mergedFloors.push(remapCell(c))
        for (const c of otherView.automap.walls) mergedWalls.push(remapCell(c))
        for (const c of otherView.automap.objects) mergedObjects.push(remapCell(c))
        for (const c of otherView.automap.extras) mergedExtras.push(remapCell(c))

        if (Array.isArray(otherView.entrances)) {
          for (const ent of otherView.entrances) {
            if (ent.toLevelId > 0 && ent.toLevelId !== otherAreaId && ent.toLevelId !== this.currentAreaId) {
              const entPreRevealed = otherAlwaysPreRevealed
                ? true
                : isOtherCellRevealed !== null && isOtherCellRevealed(ent.x, ent.y)
                  ? true
                  : false
              markers.push({
                cellX: ent.x + dCellX,
                cellY: ent.y + dCellY,
                kind: 'exit',
                toLevelId: ent.toLevelId,
                targetName: levelDisplayName(ent.toLevelId, lang),
                preRevealed: entPreRevealed,
              })
            }
          }
        }

        const otherHasWaypointCell =
          otherView.automap.floors.some((c) => c.cellNo === 307 || c.cellNo === 618) ||
          otherView.automap.objects.some((c) => c.cellNo === 307)
        if (!otherHasWaypointCell && Array.isArray(otherView.presetUnits)) {
          for (const u of otherView.presetUnits) {
            if (u.type === 2 && WAYPOINT_OBJECT_CLASS_IDS.has(u.index)) {
              const wpCellX = Math.trunc(u.subX / 5)
              const wpCellY = Math.trunc(u.subY / 5)
              const wpPreRevealed = otherAlwaysPreRevealed
                ? true
                : isOtherCellRevealed !== null && isOtherCellRevealed(wpCellX, wpCellY)
                  ? true
                  : false
              markers.push({
                cellX: wpCellX + dCellX,
                cellY: wpCellY + dCellY,
                kind: 'waypoint',
                preRevealed: wpPreRevealed,
              })
            }
          }
        }
      }

      automap = {
        ...view.automap,
        floors: mergedFloors,
        walls: mergedWalls,
        objects: mergedObjects,
        extras: mergedExtras,
      }
    }

    const layerId = view.automap.layerId || this.currentAreaId
    const result: MinimapLevel = {
      key: `automap_${this.mapSeed}_${this.difficulty}_${this.currentAreaId}`,
      layerKey: `automap_layer_${this.mapSeed}_${this.difficulty}_${this.currentActId}_${layerId}`,
      tileOriginX: minCellX,
      tileOriginY: minCellY,
      cellsX,
      cellsY,
      blocked,
      gridWidth: subW,
      markers,
      originX,
      originY,
      levelId: this.currentAreaId,
      levelName: levelDisplayName(this.currentAreaId, lang),
      difficulty: getLocalizedDifficulty(this.difficulty, lang),
      preRevealTown,
      automap,
    }
    this.cachedMinimapLevel = { key: cacheKey, level: result }
    return result
  }
}
