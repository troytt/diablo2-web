/**
 * Browser DRLG host for the Single Player game server's area bootstrap (issue #1325).
 *
 * The local `GameInstance` resolves areas on demand through `createAreaBootstrapResolver`
 * (`src/server/world/area-bootstrap.ts`); in the browser the DRLG level build lives in `MapService`, so
 * this adapter (handed to the local server through the netproto `LobbyEnterGameTarget.areaLevelSource`)
 * only converts a built `LevelView` into the server's `AreaLevelGeometry` (collision grid,
 * rooms, preset units, warps, start cell). All game semantics stay on the server side.
 */

import type {
  LocalAreaLevelGeometry as AreaLevelGeometry,
  LocalAreaLevelRequest as AreaLevelRequest,
  LocalAreaLevelSource as AreaLevelSource,
} from '../../netproto/index.ts'
import type { LevelView } from './level-view.ts'
import type { MapService } from './map-service.ts'

/** Server geometry of one built level view. */
export function levelViewToAreaGeometry(
  view: LevelView,
  adjacentAreaIds: readonly number[] = [],
): AreaLevelGeometry {
  return {
    areaId: view.areaId,
    adjacentAreaIds,
    originX: view.originX,
    originY: view.originY,
    subWidth: view.subWidth,
    subHeight: view.subHeight,
    blocked: view.blocked,
    spawnTileX: view.spawnX,
    spawnTileY: view.spawnY,
    rooms: view.rooms.map((r) => ({ areaId: r.areaId, tileX: r.tileX, tileY: r.tileY })),
    roomRects: view.rooms
      .filter((r) => r.areaId === view.areaId)
      .map((r) => ({
        index: r.index,
        x: r.worldSubX,
        y: r.worldSubY,
        w: r.subW,
        h: r.subH,
        seed: r.room1InitSeed >>> 0,
      })),
    presetUnits: view.presetUnits.map((u) => ({
      type: u.type,
      index: u.index,
      mode: u.mode,
      subX: u.subX,
      subY: u.subY,
    })),
    warps: view.entrances.flatMap((e) =>
      e.warp !== undefined
        ? [{ lvlWarpId: e.warp.lvlWarpId, subX: e.warp.subX, subY: e.warp.subY, toLevelId: e.toLevelId }]
        : [],
    ),
  }
}

/**
 * `AreaLevelSource` over a `MapService`: a level of the act already loaded with the same seed and
 * difficulty is built without touching the active view (`peekLevelView`); another act is loaded first.
 * Returns `null` while the packed map bundle is not loaded.
 */
export function createMapServiceAreaLevelSource(mapService: MapService): AreaLevelSource {
  return (request: AreaLevelRequest) => {
    if (!mapService.isLoaded()) return null
    const seed = request.mapSeed >>> 0
    const sameAct =
      mapService.getActiveAct() === request.act &&
      mapService.getActiveSeed() === seed &&
      mapService.getActiveDifficulty() === request.difficulty
    const view = sameAct
      ? mapService.peekLevelView(request.areaId, 'all')
      : mapService.loadAct({
          act: request.act,
          seed,
          difficulty: request.difficulty,
          areaId: request.areaId,
          revealMode: 'all',
        })
    if (!view) return null
    if (view.areaId !== request.areaId) {
      throw new Error(
        `MapService area level source: built level ${view.areaId} for requested area ${request.areaId}`,
      )
    }
    // #1335: expose the level graph's 1-hop neighbours so the server can
    // preload the regions that share an outdoor seam and composite collision.
    const plan = mapService.getLevelPreloadPlan(request.areaId)
    return levelViewToAreaGeometry(view, plan?.neighborAreaIds ?? [])
  }
}
