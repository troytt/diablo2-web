/**
 * Area-of-Interest (AOI) Spatial Filtering (`src/server/net/aoi.ts`).
 *
 * Filters S2C entity broadcasts by sub-tile radius and areaId, and computes
 * enter/exit visibility diffs per connected player.
 * Strictly isomorphic: zero DOM globals, zero Node built-ins, zero `Math.random()` or wall-clock calls.
 */

import type { UnitType } from '../../netproto/index.ts'

export const DEFAULT_AOI_RADIUS_SUBTILES = 80

export interface AoiEntityPos {
  readonly unitType: UnitType
  readonly unitId: number
  readonly areaId: number
  readonly x: number
  readonly y: number
}

export interface AoiDiff {
  readonly entered: readonly AoiEntityPos[]
  readonly exited: readonly AoiEntityPos[]
  readonly stayed: readonly AoiEntityPos[]
}

function makeEntityKey(unitType: UnitType, unitId: number): string {
  return `${unitType}:${unitId}`
}

export class AoiFilter {
  readonly radius: number
  private readonly visibleByViewer = new Map<number, Map<string, AoiEntityPos>>()

  constructor(radius: number = DEFAULT_AOI_RADIUS_SUBTILES) {
    this.radius = Math.max(1, radius)
  }

  isInRange(
    viewer: { readonly areaId: number; readonly x: number; readonly y: number },
    target: { readonly areaId: number; readonly x: number; readonly y: number },
    radiusOverride?: number,
  ): boolean {
    if (viewer.areaId !== target.areaId) return false
    const r = radiusOverride ?? this.radius
    return Math.hypot(viewer.x - target.x, viewer.y - target.y) <= r
  }

  isVisible(viewerUnitId: number, unitType: UnitType, unitId: number): boolean {
    const map = this.visibleByViewer.get(viewerUnitId)
    if (!map) return false
    return map.has(makeEntityKey(unitType, unitId))
  }

  markVisible(viewerUnitId: number, entity: AoiEntityPos): void {
    let map = this.visibleByViewer.get(viewerUnitId)
    if (!map) {
      map = new Map()
      this.visibleByViewer.set(viewerUnitId, map)
    }
    map.set(makeEntityKey(entity.unitType, entity.unitId), entity)
  }

  markHidden(viewerUnitId: number, unitType: UnitType, unitId: number): boolean {
    const map = this.visibleByViewer.get(viewerUnitId)
    if (!map) return false
    return map.delete(makeEntityKey(unitType, unitId))
  }

  computeViewerDiff(
    viewerUnitId: number,
    viewerPos: { readonly areaId: number; readonly x: number; readonly y: number },
    entities: readonly AoiEntityPos[],
  ): AoiDiff {
    let prevMap = this.visibleByViewer.get(viewerUnitId)
    if (!prevMap) {
      prevMap = new Map()
      this.visibleByViewer.set(viewerUnitId, prevMap)
    }

    const nextMap = new Map<string, AoiEntityPos>()
    const entered: AoiEntityPos[] = []
    const stayed: AoiEntityPos[] = []
    const exited: AoiEntityPos[] = []

    for (const ent of entities) {
      if (ent.unitType === 'player' && ent.unitId === viewerUnitId) {
        continue
      }
      if (this.isInRange(viewerPos, ent)) {
        const key = makeEntityKey(ent.unitType, ent.unitId)
        nextMap.set(key, ent)
        if (prevMap.has(key)) {
          stayed.push(ent)
        } else {
          entered.push(ent)
        }
      }
    }

    for (const [key, oldEnt] of prevMap.entries()) {
      if (!nextMap.has(key)) {
        exited.push(oldEnt)
      }
    }

    this.visibleByViewer.set(viewerUnitId, nextMap)
    return { entered, exited, stayed }
  }

  removeViewer(viewerUnitId: number): void {
    this.visibleByViewer.delete(viewerUnitId)
  }

  removeEntity(unitType: UnitType, unitId: number): void {
    const key = makeEntityKey(unitType, unitId)
    for (const map of this.visibleByViewer.values()) {
      map.delete(key)
    }
  }
}
