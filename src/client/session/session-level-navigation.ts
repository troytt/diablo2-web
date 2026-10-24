/**
 * Session Level Navigation, Cross-Area Neighbour Prefetching, Sub-Tile Collision,
 * Active Area Synchronization, Quest Object Proximity Triggers, and Town Detection
 * (`src/client/session/session-level-navigation.ts`).
 *
 * Extracted from `src/client/session/online-session.ts` (Phase 3 — Step 3.5, Refs #985).
 * Strict import boundary: imports only from `src/netproto/index.ts` (never `bncs/mcp/d2gs/crypto`).
 */

import {
  unitTypeToId,
  type ClientCommand,
  type ServerEvent,
  type StateSetEntry,
  type UnitType,
} from '../../netproto/index.ts'
import type { Environment } from '../../common/world/environment.ts'
import { isObjectInInteractRange113c } from '../../common/world/objects-meta.ts'
import { isTownLevel } from '../../common/world/scene-population.ts'
import type { AudioRuntime113c } from '../audio/audio-runtime-113c.ts'
import { periodOfDayToSoundEnvironTod113c } from '../audio/sound-environ-113c.ts'
import type { AutomapView } from '../automap/automap-view.ts'
import type { LevelRoomView, LevelView } from '../map/level-view.ts'
import type { MapService } from '../map/map-service.ts'
import type { RemoteEntityInterpolator } from '../motion/interpolate.ts'
import type { LocalMovementPredictor, ServerPositionSource } from '../motion/predictor.ts'
import type { HudManager } from '../ui/hud-manager.ts'
import type { HudModel } from '../ui-model/hud-model.ts'
import type { SceneAmbientState } from '../view/scene-source.ts'
import type { ClientUnit } from '../world/client-unit.ts'
import type { ClientWorld } from '../world/client-world.ts'
import { SETFUNC_FADE_STATES } from '../world/quest-fx-data-113c.ts'
import { HORADRIC_ORIFICE_OBJECT_CLASS } from '../world/quest-fx-horadric-113c.ts'
import {
   type QuestFxLight,
  resolveRoomAmbient,
  STONE_ALPHA_OBJECT_CLASS,
} from '../world/quest-fx-light.ts'
import type { OnlineSessionPhase } from './online-session.ts'

export interface SessionLevelNavigationHost {
  readonly world: ClientWorld
  readonly hudManager: HudManager
  readonly hudModel: HudModel
  readonly mapService: MapService | null
  readonly automapView: AutomapView
  readonly predictor: LocalMovementPredictor
  readonly interpolator: RemoteEntityInterpolator
  readonly audioRuntime: AudioRuntime113c
  readonly pingMs: number
  levelView?: LevelView | null | undefined
  phaseValue: OnlineSessionPhase
  environmentValue: Environment
  readonly questFx: QuestFxLight
  readonly knownAreaIds: Set<number>
  viewRetentionPrimaryAreaId: number
  viewRetentionStableSinceMs: number
  viewRetentionSignature: string | null
  cachedCollisionViewAreaId: number
  cachedCollisionViewSubX: number
  cachedCollisionViewSubY: number
  cachedCollisionRevealedAreas: readonly number[] | null
  cachedCollisionView: LevelView | null
  prefetchedGateForAreaId: number
  lastSyncedAreaId: number
  forwardCommandToAdapter(cmd: ClientCommand, nowMs?: number): void
  isLocalPlayerInTown(): boolean | null
  resolveCollisionLevelView(): LevelView | null | undefined
  isSubTileBlockedInView(activeView: LevelView, subX: number, subY: number): boolean
  isSubTileMissileBlockedInView(
    activeView: LevelView,
    subX: number,
    subY: number,
    collideType?: number,
  ): boolean
  getCandidateAreaIds(): number[]
  applyViewRetention(primaryView: LevelView, neighbours: readonly LevelView[]): void
  pruneMissingInterpolatorEntities(): void
  prefetchGateNeighbourLevels(view: LevelView): void
  resolveUnitRoomLevelId(ref: { readonly unitType: UnitType; readonly id: number }): number | null
  findObjectNearLocalPlayer(classId: number): ClientUnit | null
  findObjectNearSubTile(px: number, py: number, classId: number): ClientUnit | null
}

export function isWorldSubTileBlocked(
  host: SessionLevelNavigationHost,
  subX: number,
  subY: number,
): boolean {
  const activeView = host.resolveCollisionLevelView()
  // 1.13c Parity: Missing LevelView or out-of-bounds sub-tiles must fail closed (blocked = true).
  if (!activeView) {
    return (
      host.levelView !== undefined ||
      host.world.areaId > 0 ||
      host.world.getRevealedAreaIds().length > 0 ||
      Boolean(host.mapService) ||
      Boolean(host.automapView.getLevelView())
    )
  }
  if (!host.isSubTileBlockedInView(activeView, subX, subY)) {
    return false
  }
  if (host.levelView === undefined && host.mapService) {
    const candidates = host.getCandidateAreaIds()
    if (typeof host.mapService.findAllLevelViewsAtWorldSubTile === 'function') {
      const matchingViews = host.mapService.findAllLevelViewsAtWorldSubTile(
        subX,
        subY,
        candidates,
      )
      for (const v of matchingViews) {
        if (v !== activeView && !host.isSubTileBlockedInView(v, subX, subY)) {
          return false
        }
      }
    } else if (typeof host.mapService.findLevelViewAtWorldSubTile === 'function') {
      const v = host.mapService.findLevelViewAtWorldSubTile(subX, subY, candidates)
      if (v && v !== activeView && !host.isSubTileBlockedInView(v, subX, subY)) {
        return false
      }
    }
  }
  return true
}

export function isWorldSubTileMissileBlocked(
  host: SessionLevelNavigationHost,
  subX: number,
  subY: number,
  collideType: number,
): boolean {
  if (collideType === 0) return false
  const activeView = host.resolveCollisionLevelView()
  if (!activeView) {
    return (
      host.levelView !== undefined ||
      host.world.areaId > 0 ||
      host.world.getRevealedAreaIds().length > 0 ||
      Boolean(host.mapService) ||
      Boolean(host.automapView.getLevelView())
    )
  }
  if (!host.isSubTileMissileBlockedInView(activeView, subX, subY, collideType)) {
    return false
  }
  if (host.levelView === undefined && host.mapService) {
    const candidates = host.getCandidateAreaIds()
    if (typeof host.mapService.findAllLevelViewsAtWorldSubTile === 'function') {
      const matchingViews = host.mapService.findAllLevelViewsAtWorldSubTile(
        subX,
        subY,
        candidates,
      )
      for (const v of matchingViews) {
        if (
          v !== activeView &&
          !host.isSubTileMissileBlockedInView(v, subX, subY, collideType)
        ) {
          return false
        }
      }
    } else if (typeof host.mapService.findLevelViewAtWorldSubTile === 'function') {
      const v = host.mapService.findLevelViewAtWorldSubTile(subX, subY, candidates)
      if (
        v &&
        v !== activeView &&
        !host.isSubTileMissileBlockedInView(v, subX, subY, collideType)
      ) {
        return false
      }
    }
  }
  return true
}

/**
 * Check an authoritative local-player position with the 1.13c tolerance gate (D2Client
 * 0x6FADA1B0, `LocalMovementPredictor.verifyServerPosition`). The player is never moved toward
 * it: out of tolerance the client sends C2S `0x5F` with its own sub-tile, and the server
 * answers with `0x15` if it disagrees.
 *
 * `.d2cap` replay is not part of the game: it feeds no local input to the predictor and has no
 * server to answer `0x5F`, so there the local player takes the captured position directly.
 */
export function verifyLocalPlayerPosition(
  host: SessionLevelNavigationHost,
  x: number,
  y: number,
  source: ServerPositionSource,
): void {
  if (host.phaseValue === 'replay') {
    if (x !== 0 && y !== 0) host.predictor.setPosition(x, y)
    return
  }
  const inTown = host.isLocalPlayerInTown()
  // No loaded level contains the player, i.e. it has no room yet. The gate's hard branch
  // skips a unit without a room when the server position has none either
  // (0x6FAB1400 / 0x6FABC2E0), so there is nothing to verify against.
  if (inTown === null) return
  const verdict = host.predictor.verifyServerPosition({
    x,
    y,
    source,
    rttMs: host.pingMs,
    inTown,
  })
  if (verdict.action === 'request-resync') {
    host.forwardCommandToAdapter({
      type: 'UpdatePlayerPos',
      x: verdict.clientX,
      y: verdict.clientY,
    })
  }
}

export function isSubTileBlockedInView(
  activeView: LevelView,
  subX: number,
  subY: number,
): boolean {
  if (typeof (activeView as any).isWalkableWorldSubTile === 'function') {
    return !(activeView as any).isWalkableWorldSubTile(subX, subY)
  }
  const localX = Math.floor(subX - (activeView.subOriginX ?? 0))
  const localY = Math.floor(subY - (activeView.subOriginY ?? 0))
  if (
    localX < 0 ||
    localY < 0 ||
    localX >= activeView.subWidth ||
    localY >= activeView.subHeight
  ) {
    return true
  }
  const idx = localY * activeView.subWidth + localX
  const collisionMask = ((activeView as any).collision ??
    (activeView as any).collisionMask ??
    (activeView as any).collisionMasks) as Uint16Array | undefined
  if (collisionMask) {
    const mask = collisionMask[idx] ?? 0xffff
    // COLLIDE_MASK_WALK (0x1c09) or COLLIDE_BLOCK_MISSILE / wall bits
    if ((mask & 0x1c09) !== 0 || (mask & 0x0004) !== 0) return true
  }
  if (activeView.blocked && activeView.blocked[idx] === 1) return true
  if (activeView.walkable) return activeView.walkable[idx] === 0
  return false
}

export function isSubTileMissileBlockedInView(
  activeView: LevelView,
  subX: number,
  subY: number,
  collideType = 3,
): boolean {
  if (collideType === 0) return false
  const localX = Math.floor(subX - (activeView.subOriginX ?? 0))
  const localY = Math.floor(subY - (activeView.subOriginY ?? 0))
  if (
    localX < 0 ||
    localY < 0 ||
    localX >= activeView.subWidth ||
    localY >= activeView.subHeight
  ) {
    return true
  }
  const idx = localY * activeView.subWidth + localX
  const collisionMask = ((activeView as any).collision ??
    (activeView as any).collisionMask ??
    (activeView as any).collisionMasks) as Uint16Array | undefined
  if (collisionMask) {
    const mask = collisionMask[idx] ?? 0xffff
    // 1.13c D2Client.dll 0x6FB81340 / D2Game.dll 0x6FD2A5B0:
    // CollideType 8 (floor-hugging missiles): 0x0805 (COLLIDE_WALL | COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR)
    // CollideType 1, 3, 6 (flying missiles):  0x0804 (COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR)
    const missileMask = collideType === 8 ? 0x0805 : 0x0804
    return (mask & missileMask) !== 0
  }
  if (typeof (activeView as any).isWalkableWorldSubTile === 'function') {
    return !(activeView as any).isWalkableWorldSubTile(subX, subY)
  }
  if (activeView.blocked && activeView.blocked[idx] === 1) return true
  if (activeView.walkable) return activeView.walkable[idx] === 0
  return false
}

export function prefetchGateNeighbourLevels(
  host: SessionLevelNavigationHost,
  view: LevelView,
): void {
  if (!host.mapService || !Array.isArray(view.entrances)) return
  for (const ent of view.entrances) {
    if (ent.kind === 'gate' && ent.targetLevelId > 0 && ent.targetLevelId !== view.areaId) {
      host.knownAreaIds.add(ent.targetLevelId)
      if (typeof host.mapService.peekLevelView === 'function') {
        try {
          host.mapService.peekLevelView(ent.targetLevelId)
        } catch {
          // Ignore if target area is not available in a partial mock MapService
        }
      }
    }
  }
}

export function resolveNeighbourLevelViews(
  host: SessionLevelNavigationHost,
  primaryView: LevelView | null | undefined,
): readonly LevelView[] {
  if (!primaryView || primaryView.areaId <= 0 || host.levelView !== undefined) {
    return []
  }
  const candidateIds = host.getCandidateAreaIds()
  if (host.mapService && typeof host.mapService.getConnectedLevelViews === 'function') {
    try {
      const neighbours = host.mapService.getConnectedLevelViews(primaryView.areaId, candidateIds)
      host.applyViewRetention(primaryView, neighbours)
      return neighbours
    } catch {
      return []
    }
  }
  return []
}

/**
 * #954 view retention: keep only the active level plus its connected
 * neighbours in `MapService.loadedViewsByArea` and `AutomapView.levelViews`.
 * Without this, every area ever visited in a session stays resident (a full
 * Act 1→5 run accumulated 4+ heavyweight `LevelView`s per act — measured
 * 75.6MB for 4 areas in River of Flame). The 1.5s dwell on a stable primary
 * area prevents evict/rebuild churn while the player oscillates across a
 * level boundary; the worker engine retains DRLG room state and `0x07`
 * reveal flags, so an evicted area rebuilds identically on return.
 */
export function applyViewRetention(
  host: SessionLevelNavigationHost,
  primaryView: LevelView,
  neighbours: readonly LevelView[],
): void {
  const nowMs = performance.now()
  if (host.viewRetentionPrimaryAreaId !== primaryView.areaId) {
    host.viewRetentionPrimaryAreaId = primaryView.areaId
    host.viewRetentionStableSinceMs = nowMs
    host.viewRetentionSignature = null
  }
  if (nowMs - host.viewRetentionStableSinceMs < 1500) return
  const keepAreaIds = [primaryView.areaId, ...neighbours.map((v) => v.areaId)]
  const signature = [...keepAreaIds].sort((a, b) => a - b).join(',')
  if (signature === host.viewRetentionSignature) {
    // A late `0x07` reveal can rebuild an evicted view after the keep-set
    // stopped changing (peek lifts the eviction mark); re-run the eviction
    // whenever a stray view has crept back into the registry.
    const keep = new Set(keepAreaIds)
    const hasStray = (host.mapService?.getLoadedAreaIds?.() ?? []).some((id) => !keep.has(id))
    if (!hasStray) return
  }
  host.viewRetentionSignature = signature
  if (host.mapService && typeof host.mapService.retainLevelViews === 'function') {
    try {
      host.mapService.retainLevelViews(keepAreaIds)
    } catch {
      // Best-effort hygiene; the registry rebuilds on demand either way.
    }
  }
  if (typeof host.automapView.dropLevelViewsExcept === 'function') {
    try {
      host.automapView.dropLevelViewsExcept(keepAreaIds)
    } catch {
      // Best-effort hygiene; reveal history is unaffected.
    }
  }
}

export function resolveCollisionLevelView(
  host: SessionLevelNavigationHost,
): LevelView | null | undefined {
  if (host.levelView !== undefined && host.levelView !== null) {
    return host.levelView
  }
  const predSnap = host.predictor.getSnapshot()
  const px = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.x : host.world.self.x
  const py = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.y : host.world.self.y
  if (host.mapService && host.world.areaId > 0 && (px !== 0 || py !== 0)) {
    const ix = Math.floor(px)
    const iy = Math.floor(py)
    const revealedAreas = host.world.getRevealedAreaIds()
    const cachedAreas = host.cachedCollisionRevealedAreas
    const areasMatch =
      cachedAreas === revealedAreas ||
      (cachedAreas !== null &&
        cachedAreas.length === revealedAreas.length &&
        cachedAreas.every((v, idx) => v === revealedAreas[idx]))
    const loadedInService =
      host.cachedCollisionView !== null && typeof host.mapService.getLoadedLevelView === 'function'
        ? host.mapService.getLoadedLevelView(host.cachedCollisionView.areaId)
        : undefined
    if (
      host.cachedCollisionView !== null &&
      host.cachedCollisionViewAreaId === host.world.areaId &&
      host.cachedCollisionViewSubX === ix &&
      host.cachedCollisionViewSubY === iy &&
      (loadedInService === undefined || loadedInService === host.cachedCollisionView) &&
      areasMatch
    ) {
      host.cachedCollisionRevealedAreas = revealedAreas
      return host.cachedCollisionView
    }
    const found = host.mapService.findLevelViewAtWorldSubTile(px, py, [
      host.world.areaId,
      ...revealedAreas,
    ])
    if (found) {
      host.cachedCollisionViewAreaId = host.world.areaId
      host.cachedCollisionViewSubX = ix
      host.cachedCollisionViewSubY = iy
      host.cachedCollisionRevealedAreas = revealedAreas
      host.cachedCollisionView = found
      return found
    }
  }
  return host.mapService?.getActiveLevelView() ?? host.automapView.getLevelView()
}

export function getCandidateAreaIds(host: SessionLevelNavigationHost): number[] {
  const out: number[] = []
  if (host.world.areaId > 0) {
    out.push(host.world.areaId)
  }
  for (const id of host.world.getRevealedAreaIds()) {
    if (id > 0 && !out.includes(id)) {
      out.push(id)
    }
  }
  for (const id of host.knownAreaIds) {
    if (id > 0 && !out.includes(id)) {
      out.push(id)
    }
  }
  return out
}

export function pruneMissingInterpolatorEntities(host: SessionLevelNavigationHost): void {
  for (const state of host.interpolator.getAllStates()) {
    if (!host.world.getUnit(state.unitType as UnitType, state.unitId)) {
      host.interpolator.removeEntity(state.unitType, state.unitId)
    }
  }
}

/**
 * Resolve the `LevelView` containing the local player's current world sub-tile and synchronize
 * `world.areaId` and `automapView` whenever the player crosses into a different area (#549).
 */
export function syncActiveAreaFromPlayerPosition(
  host: SessionLevelNavigationHost,
  options?: { readonly emitHudSync?: boolean },
): LevelView | null {
  const predSnap = host.predictor.getSnapshot()
  const playerSubX = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.x : host.world.self.x
  const playerSubY = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.y : host.world.self.y
  const ix = Math.floor(playerSubX)
  const iy = Math.floor(playerSubY)
  const revealedAreas = host.world.getRevealedAreaIds()
  if (
    host.levelView === undefined &&
    host.mapService &&
    (playerSubX !== 0 || playerSubY !== 0) &&
    host.cachedCollisionView !== null &&
    host.cachedCollisionView.areaId > 0 &&
    host.cachedCollisionViewAreaId === host.world.areaId &&
    host.cachedCollisionViewSubX === ix &&
    host.cachedCollisionViewSubY === iy &&
    host.lastSyncedAreaId === host.cachedCollisionView.areaId &&
    host.prefetchedGateForAreaId === host.cachedCollisionView.areaId &&
    host.automapView.getCurrentAreaId() === host.cachedCollisionView.areaId &&
    host.automapView.getLevelView(host.cachedCollisionView.areaId) !== undefined
  ) {
    const cachedAreas = host.cachedCollisionRevealedAreas
    const areasMatch =
      cachedAreas === revealedAreas ||
      (cachedAreas !== null &&
        cachedAreas.length === revealedAreas.length &&
        cachedAreas.every((v, idx) => v === revealedAreas[idx]))
    const loadedInService =
      typeof host.mapService.getLoadedLevelView === 'function'
        ? host.mapService.getLoadedLevelView(host.cachedCollisionView.areaId)
        : undefined
    if (
      areasMatch &&
      (loadedInService === undefined || loadedInService === host.cachedCollisionView)
    ) {
      host.cachedCollisionRevealedAreas = revealedAreas
      return host.cachedCollisionView
    }
  }
  const candidateIds = host.getCandidateAreaIds()
  const levelView =
    host.levelView ??
    (host.mapService && candidateIds.length > 0 && (playerSubX !== 0 || playerSubY !== 0)
      ? host.mapService.findLevelViewAtWorldSubTile(playerSubX, playerSubY, candidateIds)
      : null)

  if (levelView && levelView.areaId > 0) {
    const prevAreaId = host.lastSyncedAreaId > 0 ? host.lastSyncedAreaId : host.world.areaId
    const areaChanged = prevAreaId !== levelView.areaId
    const automapOutOfSync =
      host.automapView.getCurrentAreaId() !== levelView.areaId ||
      host.automapView.getLevelView(levelView.areaId) === undefined
    if (areaChanged) {
      host.world.areaId = levelView.areaId
      host.lastSyncedAreaId = levelView.areaId
      host.world.bumpCollisionRevision()
      if (prevAreaId > 0 && (playerSubX !== 0 || playerSubY !== 0)) {
        host.world.pruneStaleUnitsOutsideArea(playerSubX, playerSubY)
        host.pruneMissingInterpolatorEntities()
      }
      // Keep knownAreaIds bounded to active + revealed areas (+ immediate previous area + gate neighbours)
      host.knownAreaIds.clear()
      host.knownAreaIds.add(levelView.areaId)
      for (const revId of host.world.getRevealedAreaIds()) {
        if (revId > 0) host.knownAreaIds.add(revId)
      }
      if (prevAreaId > 0) {
        host.knownAreaIds.add(prevAreaId)
      }
      host.prefetchGateNeighbourLevels(levelView)
      host.prefetchedGateForAreaId = levelView.areaId
    } else {
      if (host.lastSyncedAreaId === 0) {
        host.lastSyncedAreaId = levelView.areaId
      }
      host.knownAreaIds.add(levelView.areaId)
      if (host.prefetchedGateForAreaId !== levelView.areaId) {
        host.prefetchGateNeighbourLevels(levelView)
        host.prefetchedGateForAreaId = levelView.areaId
      }
    }
    if (areaChanged || automapOutOfSync) {
      host.automapView.syncActiveLevel(levelView.areaId, levelView)
    }
    if (host.levelView === undefined && (playerSubX !== 0 || playerSubY !== 0)) {
      host.cachedCollisionView = levelView
      host.cachedCollisionViewSubX = ix
      host.cachedCollisionViewSubY = iy
      host.cachedCollisionViewAreaId = host.world.areaId
      host.cachedCollisionRevealedAreas = revealedAreas
    }
    if (areaChanged) {
      host.audioRuntime.enterLevel(
        levelView.areaId,
        periodOfDayToSoundEnvironTod113c(host.environmentValue.period),
      )
      host.audioRuntime.playLevelMusic(levelView.areaId)
      if (options?.emitHudSync) {
        host.hudModel.syncFromWorld()
      }
    }
  } else if (host.world.areaId > 0 && host.world.areaId !== host.lastSyncedAreaId) {
    host.lastSyncedAreaId = host.world.areaId
    host.knownAreaIds.add(host.world.areaId)
    host.audioRuntime.enterLevel(
      host.world.areaId,
      periodOfDayToSoundEnvironTod113c(host.environmentValue.period),
    )
    host.audioRuntime.playLevelMusic(host.world.areaId)
    if (options?.emitHudSync) {
      host.hudModel.syncFromWorld()
    }
  }
  return levelView
}

/**
 * Ambient light of the local player's room and of its revealed near rooms: the inputs of the
 * D2Client light-grid prefill 0x6fb59c90, which asks `CLIENT_GetAmbientLight` with the quest special
 * lights enabled (steps 1–3 from `questFx`, then Levels.txt / act clock). The near rooms come from
 * the in-process DRLG session; a test-injected `levelView` has no rooms, so only the player's room
 * light is used then.
 */
function revealedNearRooms(mapService: NonNullable<SessionLevelNavigationHost['mapService']>, areaId: number, subX: number, subY: number): ReturnType<NonNullable<SessionLevelNavigationHost['mapService']>['getRevealedNearRooms']> {
  try {
    return mapService.getRevealedNearRooms(areaId, subX, subY)
  } catch {
    return []
  }
}

export function resolveSceneAmbient(
  host: SessionLevelNavigationHost,
  levelView: LevelView,
  playerSubX: number,
  playerSubY: number,
): SceneAmbientState {
  const env = host.environmentValue
  const nearRooms =
    host.levelView == null && host.mapService
      ? revealedNearRooms(host.mapService, levelView.areaId, playerSubX, playerSubY).map((room) => ({
          worldSubX: room.worldSubX,
          worldSubY: room.worldSubY,
          subW: room.subW,
          subH: room.subH,
          ambient: resolveRoomAmbient(room.areaId, env, host.questFx),
        }))
      : []
  return { playerRoom: resolveRoomAmbient(levelView.areaId, env, host.questFx), nearRooms }
}

/**
 * The state set-function dispatch 0x6fb22530 for the states of an S2C 0xA8 / 0xAA the client applied
 * to a known unit: 0xA8 reaches it only after the 0x1ff stat terminator (0x6fb5dea3), 0xAA after each
 * state (0x6fb5dcfa). 0xA7 carries no stats, so a re-set state has no statlist when 0xA7's dispatch runs
 * and the fade starter returns; 0xA5 does not go through the dispatch.
 */
export function runStateSetFunctions(
  host: SessionLevelNavigationHost,
  ev: Extract<ServerEvent, { type: 'StateSet' }>,
): void {
  let entries: readonly StateSetEntry[]
  if (ev.origin === 0xa8) {
    entries = [{ state: ev.state, stats: ev.stats, complete: ev.complete === true }]
  } else if (ev.origin === 0xaa) {
    if (ev.states === undefined) {
      throw new Error('S2C 0xAA AddUnitState event without its state list')
    }
    entries = ev.states
  } else {
    return
  }
  for (const entry of entries) {
    if (!entry.complete || !SETFUNC_FADE_STATES.includes(entry.state)) continue
    host.questFx.onStateSetFunc(entry.state, entry.stats, host.resolveUnitRoomLevelId(ev.unit))
  }
}

/**
 * Level of the room a unit stands in (D2Common #10331 GetRoom → #10826), `null` while no loaded level
 * contains its sub-tile. The local player's position is the predictor's, like `isLocalPlayerInTown`
 * (sub-tile = `Math.round` of the logical position).
 */
export function resolveUnitRoomLevelId(
  host: SessionLevelNavigationHost,
  ref: { readonly unitType: UnitType; readonly id: number },
): number | null {
  if (!host.mapService) return null
  const unit = host.world.getUnit(ref.unitType, ref.id)
  if (unit === undefined) return null
  let x = unit.x
  let y = unit.y
  if (unitTypeToId(ref.unitType) === 0 && ref.id === host.world.selfId) {
    const snap = host.predictor.getSnapshot()
    x = snap.logicalX
    y = snap.logicalY
  }
  if (x === 0 && y === 0) return null
  const levelView = host.mapService.findLevelViewAtWorldSubTile(
    Math.round(x),
    Math.round(y),
    host.getCandidateAreaIds(),
  )
  return levelView === null ? null : levelView.areaId
}

/**
 * Special quest event 1 (0x6fb02d00): D2Common #10754(GetRoom(gpPlayer), UNIT_OBJECT, 17) walks the
 * player's room and its near rooms (room list +0x00, count +0x24; 0x6fd622b0) for an object of class
 * 17 `StoneAlpha`, returning its sub-tile coordinates (or `null` without a local player / room).
 */
export function findStoneAlphaNearLocalPlayer(
  host: SessionLevelNavigationHost,
): { readonly x: number; readonly y: number } | null {
  const stone = host.findObjectNearLocalPlayer(STONE_ALPHA_OBJECT_CLASS)
  return stone ? { x: stone.x, y: stone.y } : null
}

/**
 * D2Common #10754(GetRoom(gpPlayer), UNIT_OBJECT, classId) (0x6fd622b0): the first object of `classId` in the local
 * player's room or one of its near rooms, `null` without a local player / room or when there is none.
 */
export function findObjectNearLocalPlayer(
  host: SessionLevelNavigationHost,
  classId: number,
): ClientUnit | null {
  if (!host.mapService || host.world.selfId === 0) return null
  const snap = host.predictor.getSnapshot()
  return host.findObjectNearSubTile(Math.round(snap.logicalX), Math.round(snap.logicalY), classId)
}

/**
 * D2Common #10754(room, UNIT_OBJECT, classId) (0x6fd622b0) for the room containing sub-tile (`px`, `py`): the first
 * object of `classId` in that room or one of its near rooms, `null` without a map / room or when there is none.
 */
export function findObjectNearSubTile(
  host: SessionLevelNavigationHost,
  px: number,
  py: number,
  classId: number,
): ClientUnit | null {
  if (!host.mapService) return null
  const levelView =
    host.mapService.findLevelViewAtWorldSubTile?.(px, py, host.getCandidateAreaIds()) ?? null
  if (levelView === null) return null
  const contains = (room: LevelRoomView, x: number, y: number): boolean =>
    x >= room.worldSubX &&
    x < room.worldSubX + room.subW &&
    y >= room.worldSubY &&
    y < room.worldSubY + room.subH
  const unitRoom = levelView.rooms.find((room) => contains(room, px, py))
  if (unitRoom === undefined) return null
  const nearRooms = host.mapService.getRevealedNearRooms?.(levelView.areaId, px, py) ?? []
  const rooms = [unitRoom, ...nearRooms]
  return (
    host.world
      .getUnitsByType('object')
      .find(
        (obj) =>
          obj.classId === classId &&
          rooms.some((room) => contains(room, Math.round(obj.x), Math.round(obj.y))),
      ) ?? null
  )
}

/** Special quest event 3 (0x6fb03450): the A2Q6 staff show at the orifice when #10754 finds it. */
export function spawnHoradricStaffIfOrificeNear(host: SessionLevelNavigationHost): void {
  const orifice = host.findObjectNearLocalPlayer(HORADRIC_ORIFICE_OBJECT_CLASS)
  if (orifice !== null) {
    host.world.spawnHoradricStaffAtOrifice(orifice)
    host.audioRuntime.playQuestStinger(4690)
  }
}

/**
 * Special quest event 12 (0x6fb033f0): when `GetLevelId(GetRoom(gpPlayer)) == 108` (`0x6c`, Chaos Sanctuary),
 * spawns client missile 372 (`diablo appears`) at the local player's sub-tile position (`0x6fb033fe-38`).
 */
export function spawnDiabloAppearsIfInChaosSanctuary(host: SessionLevelNavigationHost): void {
  if (host.world.selfId === 0) return
  const snap = host.predictor.getSnapshot()
  const px =
    snap.logicalX !== 0 || snap.logicalY !== 0
      ? Math.round(snap.logicalX)
      : Math.round(host.world.self.x)
  const py =
    snap.logicalX !== 0 || snap.logicalY !== 0
      ? Math.round(snap.logicalY)
      : Math.round(host.world.self.y)
  if (px === 0 && py === 0) return
  const levelId = host.mapService
    ? (host.mapService.findLevelViewAtWorldSubTile(px, py, host.getCandidateAreaIds())?.areaId ?? 0)
    : host.world.areaId
  if (levelId === 108) {
    host.world.spawnDiabloAppearsController(px, py)
  }
}

/**
 * `DUNGEON_IsRoomInTown` for the local player: whether the level containing its sub-tile is a
 * town level, or `null` while no loaded level contains it. The sub-tile is the one the gate
 * compares, `Math.round` of the logical position (logical N.0 is the centre of sub-tile N).
 */
export function isLocalPlayerInTown(host: SessionLevelNavigationHost): boolean | null {
  if (!host.mapService || host.world.areaId <= 0) return null
  const snap = host.predictor.getSnapshot()
  const levelView = host.mapService.findLevelViewAtWorldSubTile(
    Math.round(snap.logicalX),
    Math.round(snap.logicalY),
    host.getCandidateAreaIds(),
  )
  return levelView === null ? null : isTownLevel(levelView.areaId)
}

/**
 * Resolve whether `(subX, subY)` is in a town level (`DUNGEON_IsRoomInTown` equivalent):
 * prefers the exact `LevelView` containing `(subX, subY)` when `mapService` is loaded,
 * and falls back to the active `world.areaId` / `levelView.areaId`.
 */
export function isSubTileInTown(
  host: SessionLevelNavigationHost,
  subX: number,
  subY: number,
): boolean {
  if (host.mapService && host.world.areaId > 0 && (subX !== 0 || subY !== 0)) {
    const levelView = host.mapService.findLevelViewAtWorldSubTile(
      Math.round(subX),
      Math.round(subY),
      [host.world.areaId, ...host.world.getRevealedAreaIds()],
    )
    if (levelView !== null) {
      return isTownLevel(levelView.areaId)
    }
  }
  const activeAreaId =
    host.world.areaId > 0
      ? host.world.areaId
      : (host.levelView?.areaId ??
         host.mapService?.getActiveLevelView()?.areaId ??
         host.automapView.getLevelView()?.areaId ??
         0)
  return isTownLevel(activeAreaId)
}

/**
 * Per-tick validation of the open NPC session and Stash.
 *
 * NPC: 1.13c `D2Client.dll` `0x6faf83b0`, called each frame from 0x6fb73d71 only while the NPC menu
 * (`UI_NPCMENU` 0x6fbaada0) is open. It cancels the session (0x6faf67c0 + 0x6faf8150) only when:
 * - `gpPlayerUnit` (0x6fbcbbfc) is NULL or in mode 17 (`PLRMODE_DEAD`), or
 * - the NPC hash lookup 0x6faf6150 (id 0x6fbc971d) fails, or the NPC is in mode 12 (`MONMODE_DEAD`).
 *
 * Stash: closed with `C2S 0x4F 0x12 CloseStash` when the player is dead or outside
 * `D2Common.#10594` `isObjectInInteractRange113c` of every Stash object (`classId == 0x10B`) (#866).
 */
export function enforceActiveInteractionRange113c(host: SessionLevelNavigationHost): void {
  const npcInt = host.world.npcInteraction
  const activeNpcId = npcInt.unitType !== 2 ? npcInt.npcId : null
  const isStashOpen = Boolean(npcInt.stashOpen || host.hudManager.leftPanel === 'stash')
  if (activeNpcId === null && !isStashOpen) return

  const selfUnit =
    host.world.selfId !== 0 ? host.world.getUnit('player', host.world.selfId) : undefined
  // 1.13c D2Client.dll 0x6faf83b0 (NPC_PerTickUpdate): `cmp DWORD PTR [eax+0x10], 0x11` (PLRMODE_DEAD = 17).
  // Only cancel when the player is genuinely dead (authoritative isSelfDead/isDead or PLRMODE_DEAD = 17),
  // never on single-frame transient animation jitter or 0x0D roster lifePct (#899).
  const isPlayerDead =
    Boolean(host.world.isSelfDead || host.world.isDead) || selfUnit?.mode === 17
  const predSnap = host.predictor.getSnapshot()
  const selfX = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.x : host.world.self.x
  const selfY = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.y : host.world.self.y
  const hasSelfPos = selfX !== 0 || selfY !== 0

  if (activeNpcId !== null && activeNpcId > 0) {
    const npcUnit = host.world.getUnit('monster', activeNpcId)
    const isNpcAlive =
      npcUnit !== undefined && !npcUnit.dead && npcUnit.mode !== 0 && npcUnit.mode !== 12
    if (isPlayerDead || !isNpcAlive) {
      host.hudModel.cancelNpcSession(activeNpcId)
      if (host.hudManager.leftPanel === 'vendor') {
        host.hudManager.worldPanels.clearVendorShop()
        host.hudManager.hideLeftPanelFromWorld('vendor')
      }
    }
  }

  if (host.world.npcInteraction.stashOpen || host.hudManager.leftPanel === 'stash') {
    let validStash = !isPlayerDead
    if (validStash && hasSelfPos) {
      const stashObjects = host.world
        .getUnitsByType('object')
        .filter((obj) => obj.classId === 267 && (obj.x !== 0 || obj.y !== 0))
      if (stashObjects.length > 0) {
        validStash = stashObjects.some((obj) =>
          isObjectInInteractRange113c(
            Math.round(selfX),
            Math.round(selfY),
            2,
            Math.round(obj.x),
            Math.round(obj.y),
            267,
          ),
        )
      }
    }
    if (!validStash) {
      host.hudModel.closeStash()
      if (host.hudManager.leftPanel === 'stash') {
        host.hudManager.hideLeftPanelFromWorld('stash')
      }
    }
  }
}
