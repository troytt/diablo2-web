import {
  ORTHO_SUB_TILE_HEIGHT,
  ORTHO_SUB_TILE_WIDTH,
  SEAM_FADE_MS,
  WARP_FADE_MS,
  subTileToScene,
} from './d2map.ts'
import {
  SEAM_TRIGGER_SUBTILES,
  WARP_TRIGGER_SUBTILES,
  type SceneEntrance,
  type SceneWarp,
  type SceneWaypoint,
} from './level-links.ts'
import { getLevelNames, levelDisplayName } from './level-names-zh.ts'
import { getTblLang } from '../i18n/lang.ts'

export {
  SEAM_FADE_MS,
  SEAM_TRIGGER_SUBTILES,
  WARP_FADE_MS,
  WARP_TRIGGER_SUBTILES,
  subTileToScene,
  type SceneEntrance,
  type SceneWarp,
  type SceneWaypoint,
}

/** Maximum range in scene pixels for Telekinesis (Skill 43) warp activation. */
export const TELEKINESIS_RANGE_PX = 320
/** Radial proximity click tolerance in scene pixels for a SceneWarp. */
export const WARP_CLICK_RADIUS_PX = 56
/** Radial proximity click tolerance in scene pixels for a SceneEntrance. */
export const ENTRANCE_CLICK_RADIUS_PX = 56

/**
 * Convert scene pixel coordinates back to isometric sub-tile coordinates.
 */
export function sceneToSubTile(
  worldX: number,
  worldY: number,
  grid: { readonly originX: number; readonly originY: number },
): { x: number; y: number } {
  const dx = (worldX - grid.originX) / ORTHO_SUB_TILE_WIDTH
  const dy = (worldY - grid.originY) / ORTHO_SUB_TILE_HEIGHT
  return { x: Math.round((dy + dx) / 2), y: Math.round((dy - dx) / 2) }
}

/**
 * Compute the scene coordinate for a `SceneWarp` overhead destination badge.
 */
export function getWarpLabelWorldPos(
  warp: SceneWarp,
  grid: { readonly originX: number; readonly originY: number },
): { x: number; y: number } {
  const anchor = subTileToScene(warp.x, warp.y, grid)
  if (warp.selectDX > 0 && warp.selectDY > 0) {
    return {
      x: anchor.x + warp.selectX + warp.selectDX * 0.5,
      y: anchor.y + warp.selectY - 6,
    }
  }
  return {
    x: anchor.x,
    y: anchor.y - 48,
  }
}

/**
 * Compute the scene coordinate for a `SceneEntrance` overhead destination badge.
 */
export function getEntranceLabelWorldPos(
  entrance: SceneEntrance,
  grid: { readonly originX: number; readonly originY: number },
): { x: number; y: number } {
  const anchor = subTileToScene(entrance.x, entrance.y, grid)
  return {
    x: anchor.x,
    y: anchor.y - 48,
  }
}

/**
 * Hit-test a world-space pointer position against a `SceneWarp` (`LvlWarp.txt`
 * selection bounding box when non-zero, overhead badge footprint, plus radial
 * proximity to anchor, walkable arrival point, and overhead label).
 */
export function hitTestWarp(
  warp: SceneWarp,
  worldX: number,
  worldY: number,
  grid: { readonly originX: number; readonly originY: number },
): {
  hit: boolean
  dist: number
  anchorPos: { x: number; y: number }
  arrivePos: { x: number; y: number }
} {
  const anchorPos = subTileToScene(warp.x, warp.y, grid)
  const arrivePos = subTileToScene(warp.arriveX, warp.arriveY, grid)
  if (!(warp.toLevelId > 0)) {
    return {
      hit: false,
      dist: Infinity,
      anchorPos,
      arrivePos,
    }
  }
  const labelPos = getWarpLabelWorldPos(warp, grid)

  let boxDist = Infinity
  let inBox = false
  if (warp.selectDX > 0 && warp.selectDY > 0) {
    const minX = anchorPos.x + warp.selectX
    const maxX = minX + warp.selectDX
    const minY = anchorPos.y + warp.selectY
    const maxY = minY + warp.selectDY
    if (worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY) {
      inBox = true
      const cx = (minX + maxX) * 0.5
      const cy = (minY + maxY) * 0.5
      boxDist = Math.hypot(worldX - cx, worldY - cy)
    }
  }

  const badgeText = getTblLang() === 'ENG'
    ? `To ${levelDisplayName(warp.toLevelId, 'ENG')}`
    : `通往 ${getLevelNames(warp.toLevelId).nameZh}`
  const badgeHalfWidth = Math.max(64, Math.ceil((badgeText.length * 14 + 16) * 0.5))
  const inBadge =
    Math.abs(worldX - labelPos.x) <= badgeHalfWidth &&
    worldY >= labelPos.y - 28 &&
    worldY <= labelPos.y + 8
  const badgeDist = inBadge
    ? Math.hypot((worldX - labelPos.x) * 0.5, worldY - (labelPos.y - 12)) * 0.1
    : Infinity

  const distAnchor = Math.hypot(worldX - anchorPos.x, worldY - anchorPos.y)
  const distArrive = Math.hypot(worldX - arrivePos.x, worldY - arrivePos.y)
  const distLabel = Math.hypot(worldX - labelPos.x, worldY - labelPos.y)
  const distAnchorBody = Math.hypot(worldX - anchorPos.x, worldY - (anchorPos.y - 48))
  const radialDist = Math.min(distAnchor, distArrive, distLabel, distAnchorBody)
  const inRadius = radialDist <= WARP_CLICK_RADIUS_PX

  return {
    hit: inBox || inBadge || inRadius,
    dist: Math.min(boxDist, badgeDist, radialDist),
    anchorPos,
    arrivePos,
  }
}

/**
 * The facing index for a screen-space direction.
 *
 * @param x - screen x direction, -1..1.
 * @param y - screen y direction, -1..1 (down positive).
 * @returns the facing index, 0 = south, turning clockwise (west).
 */
export function facingOf(x: number, y: number): number {
  const angle = Math.atan2(-x, y)
  return Math.round((angle / (Math.PI / 4)) + 8) % 8
}

export interface ScreenToWorldParams {
  readonly clientX: number
  readonly clientY: number
  readonly rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
  readonly canvas: { readonly width: number; readonly height: number }
  readonly camX: number
  readonly camY: number
  readonly cameraZoom: number
}

/**
 * Maps screen client coordinates (pixels) to world coordinates using the exact
 * inverse camera transform.
 */
export function screenToWorld(params: ScreenToWorldParams): { x: number; y: number } {
  const scaleX = params.canvas.width > 0 ? params.rect.width / params.canvas.width : 1
  const scaleY = params.canvas.height > 0 ? params.rect.height / params.canvas.height : 1
  const worldX = params.camX + (params.clientX - params.rect.left - params.rect.width * 0.5) / (params.cameraZoom * scaleX)
  const worldY = params.camY + (params.clientY - params.rect.top - params.rect.height * 0.5) / (params.cameraZoom * scaleY)
  return { x: worldX, y: worldY }
}
