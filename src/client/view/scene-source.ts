import { steadyLightSub } from '../loop/steady-light.ts'
import {
  COLLIDE_BLANK,
  COLLIDE_MASK_INVALID,
  COLLIDE_WALL,
  isLowerWallType,
  type CollisionGrid,
} from '../../common/world/d2map.ts'
import type { AmbientLight } from '../../common/world/ambient-light.ts'
import { CANONICAL_LEVEL_LIGHTING } from '../../common/world/levels-meta.ts'
import type { LightingAmbientInputs, LightingInputs, LightingPreset } from '../../client/scene/lighting-presets.ts'
import {
  getCollisionWorldSubTile,
  isWalkableWorldSubTile,
  type DrlgPopBox,
  type LevelDrawItem,
  type LevelView,
} from '../map/level-view.ts'
import type { PackedTilePlacement, TileAtlas } from '../map/tile-atlas.ts'
import {
  buildSceneDrawables,
  type BuildSceneDrawablesResult,
  type RenderableUnitInput,
  type SceneUnitDrawable,
} from './unit-drawables.ts'

export type UnitState = RenderableUnitInput
import {
  CAMERA_Y_OFFSET,
  computePanelCameraShift,
  panelDockWidth,
  getViewportProfile,
  screenToWorld,
  subTileToWorldOrtho,
  DEFAULT_VIEWPORT_PROFILE,
  type ViewportProfile,
  type ViewportResolution,
} from './viewport-profile.ts'

export interface SceneTileQuad {
  readonly cellX: number
  readonly cellY: number
  readonly worldX: number
  readonly worldY: number
  readonly sortY: number
  readonly act: number
  readonly library: number
  readonly tile: number
  readonly type?: number | undefined
  /** DT1/DS1 tile `nStyle` (`[pTile+0x0c]`): matched against `pPopsSubIndex` by `DRLGPRESET_TogglePopsVisibility` (`0x6fd5a180`). */
  readonly style?: number | undefined
  /** DT1 tile header `direction` (`[pTileGfx+0x00]`, 0..9): indexes the 1.13c wall light tables `0x6fb80a70` / `0x6fb8ed18` / `0x6fb8eef8`. */
  readonly lightDirection?: number | undefined
  /** DT1 tile header `roofHeight` (`[pTileGfx+0x04]`, px): vertical roof shift subtracted by `0x6fac3a00`. */
  readonly roofHeight?: number | undefined
  /** 1.13c wall occlusion fade flag (`[tile+0x24] & 1`), selecting `0x6fb8eef8` over `0x6fb8ed18`. */
  readonly faded?: boolean | undefined
  readonly dt1Path: string
  readonly placement: PackedTilePlacement | null
  readonly blockCount?: number | undefined
  readonly animatedPlacements?: readonly (PackedTilePlacement | null)[] | null | undefined
  /** DT1 tile header `materialFlags` (u16 at +0x06); bit 0x02 marks water for the weather floor pass. */
  readonly materialFlags?: number | undefined
  /**
   * Walls only: `D2DrlgTileDataStrc::unk0x10` coord list (`nIndex`, `pBox[0]` in the active level's local
   * cells) read by the 1.13c occlusion fade `0x6fb29f20`. Absent = NULL = never fades.
   */
  readonly fadeBox?: { readonly index: number; readonly x: number; readonly y: number } | undefined
  /** Walls only: `dwFlags & MAPTILE_TREES`, which makes `0x6fb2a340` skip the occlusion-fade update. */
  readonly noFade?: boolean | undefined
  /** Walls only: `dwFlags & MAPTILE_UNK_0x200 (0x200)` cutaway wall cap revealed when an enclosing POPS box is active (`0x6fd5a180`). */
  readonly revealHidden?: boolean | undefined
  /** Walls only: `dwFlags & MAPTILE_FLOOR_LINKER_PATH (0x100)` POPS linkage flag (`0x6fd5a180` skips `style == subIndex` match). */
  readonly popLinkage?: boolean | undefined
}

/**
 * The local player's inputs to the 1.13c wall occlusion fade, refreshed every frame by D2Client `0x6fb2ab3d..0x6fb2ac51`:
 * `0x6fbc3b18 = pathX / 5`, `0x6fbc3b20 = pathY / 5` (cells) and `0x6fbc3b1c = D2Common.#10916(room, x, y)`.
 */
export interface SceneWallFadePlayer {
  /** Level-local cell X of the player (`floor(subX / 5)`). */
  readonly cellX: number
  /** Level-local cell Y of the player (`floor(subY / 5)`). */
  readonly cellY: number
  /** Logical-room coord-list `nIndex` at the player's cell, `-1` when none. */
  readonly logicalIndex: number
}

export interface SceneFrameSnapshot {
  readonly tick: number
  readonly actId: 1 | 2 | 3 | 4 | 5
  readonly levelId: number
  readonly viewportProfile: ViewportProfile
  /** `true` once a LevelView and a server-assigned player position exist (see `isWorldReady`). */
  readonly worldReady: boolean
  /** Absolute world sub-tile of the local player (D2GS coordinates). */
  readonly playerSubTile: { readonly x: number; readonly y: number }
  /** Level-local sub-tile of the local player (`world - levelView.subOrigin`). */
  readonly playerLocalSubTile: { readonly x: number; readonly y: number }
  readonly playerWorld: { readonly x: number; readonly y: number }
  readonly cameraTopLeft: { readonly x: number; readonly y: number }
  readonly panelShiftX?: number
  readonly shakeOffsetX?: number
  readonly shakeOffsetY?: number
  readonly floorQuads: readonly SceneTileQuad[]
  readonly shadowQuads: readonly SceneTileQuad[]
  readonly lowerWallQuads: readonly SceneTileQuad[]
  readonly upperWallQuads: readonly SceneTileQuad[]
  readonly roofQuads: readonly SceneTileQuad[]
  /** Local player's wall occlusion-fade inputs; absent when the level has no logical-room grid. */
  readonly wallFadePlayer?: SceneWallFadePlayer | undefined
  /** Preset POPS boxes (`D2DrlgMapStrc::pPopsLocation` / `pPopsIndex` / `pPopsSubIndex`) in level-local cells. */
  readonly pops?: readonly DrlgPopBox[] | undefined
  readonly entities: BuildSceneDrawablesResult
}

/**
 * Engine-agnostic interface feeding `WorldRenderer`, `lighting-presets`, and `mouse-controller`
 * from either online `ClientWorld` + `LevelView` or single-player state.
 */
export interface SceneSource {
  getViewportProfile(): ViewportProfile
  setViewportProfile(profile: ViewportProfile | ViewportResolution): ViewportProfile
  beginFrame?(): void
  endFrame?(): void
  getActId(): 1 | 2 | 3 | 4 | 5
  getLevelId(): number
  getTick(): number
  getPlayerSubTile(): { readonly x: number; readonly y: number }
  /** LevelView loaded and local player position assigned by the server. */
  isWorldReady(): boolean
  getPlayerLocalSubTile(): { readonly x: number; readonly y: number }
  getPlayerWorldOrtho(): { readonly x: number; readonly y: number }
  getCameraTopLeft(profile?: ViewportProfile): { readonly x: number; readonly y: number }
  getLevelView(): LevelView | null
  getNeighbourLevelViews?(): readonly LevelView[]
  isSubTileWalkable(subX: number, subY: number): boolean
  buildFrameSnapshot(cullPaddingPx?: number): SceneFrameSnapshot
  buildLightingInputs(preset: LightingPreset): LightingInputs
  pickUnitAtScreen(
    screenX: number,
    screenY: number,
    hitRadiusPx?: number,
    profile?: ViewportProfile,
  ): SceneUnitDrawable | null
}

/** One near room's ambient light in absolute world sub-tiles. */
export interface SceneAmbientRoom {
  readonly worldSubX: number
  readonly worldSubY: number
  readonly subW: number
  readonly subH: number
  readonly ambient: AmbientLight
}

/** Ambient light of the local player's room and of its revealed near rooms (D2Client 0x6fb59c90). */
export interface SceneAmbientState {
  readonly playerRoom: AmbientLight
  /** Near rooms of the player's room, in list order, without the player's room itself. */
  readonly nearRooms: readonly SceneAmbientRoom[]
}

export interface ClientSceneWorldAdapter {
  readonly tick?: number | undefined
  readonly actId?: 1 | 2 | 3 | 4 | 5 | undefined
  readonly levelId?: number | undefined
  readonly playerSubX: number
  readonly playerSubY: number
  readonly lightSubX?: number | undefined
  readonly lightSubY?: number | undefined
  /** Local player unit id: the owner of the player light (type 0). The light exists only once it is known. */
  readonly playerUnitId?: number | undefined
  readonly playerLightRadiusBonus?: number | undefined
  /** Stat 90 item_lightcolor of the local player (0xRRGGBB, 0 = white). */
  readonly playerLightColor?: number | undefined
  /** Room ambient light for the lighting pass; `null` while the local player has no room. */
  readonly ambient: SceneAmbientState | null
  readonly panelShiftX?: number | undefined
  readonly leftPanelOpen?: boolean | undefined
  readonly rightPanelOpen?: boolean | undefined
  /** 1.13c UpdateScreenShake (0x6fb3afd0) camera pixel offset (e.g. Diablo Appears CltDoFunc 37). */
  readonly shakeOffsetX?: number | undefined
  readonly shakeOffsetY?: number | undefined
  readonly units: Iterable<RenderableUnitInput>
  readonly levelView?: LevelView | null | undefined
  readonly neighbourLevelViews?: readonly LevelView[] | undefined
  readonly tileAtlas?: TileAtlas | null | undefined
}

const mergedCollisionGridCache = new WeakMap<
  LevelView,
  { readonly key: string; readonly grid: CollisionGrid }
>()

/**
 * Build a `CollisionGrid` view over a `LevelView`'s sub-tile collision map for the 1.13c light grid (obstacle flags
 * 0x6fb58880 and type-2 occlusion caches 0x6fb59100 read the words with mask 0x22; issue #830),
 * seamlessly patching border void cells (`COLLIDE_MASK_INVALID`) from overlapping `neighbourLevelViews`.
 */
export function buildCollisionGridFromLevelView(
  levelView: LevelView | null | undefined,
  neighbourLevelViews?: readonly LevelView[] | undefined,
): CollisionGrid {
  if (!levelView || levelView.rooms.length === 0) {
    throw new Error('buildCollisionGridFromLevelView: missing room data')
  }
  const neighbours = neighbourLevelViews?.filter(
    nv =>
      nv &&
      nv.areaId !== levelView.areaId &&
      nv.act === levelView.act &&
      nv.subOriginX < levelView.subOriginX + levelView.subWidth &&
      nv.subOriginX + nv.subWidth > levelView.subOriginX &&
      nv.subOriginY < levelView.subOriginY + levelView.subHeight &&
      nv.subOriginY + nv.subHeight > levelView.subOriginY,
  )
  if (!neighbours || neighbours.length === 0) {
    return {
      originX: levelView.isoOriginX,
      originY: levelView.isoOriginY,
      cellsX: levelView.cellsX,
      cellsY: levelView.cellsY,
      blocked: levelView.blocked,
      gridWidth: levelView.gridWidth,
      collisionMasks: levelView.collisionMasks,
    }
  }

  const key = neighbours.map(n => `${n.areaId}:${n.seed}`).join(',')
  const cached = mergedCollisionGridCache.get(levelView)
  if (cached && cached.key === key) {
    return cached.grid
  }

  const blocked = new Uint8Array(levelView.blocked)
  const collisionMasks = new Uint16Array(levelView.collisionMasks)
  const w = levelView.gridWidth
  const h = levelView.subHeight

  for (const nv of neighbours) {
    const startWX = Math.max(levelView.subOriginX, nv.subOriginX)
    const endWX = Math.min(
      levelView.subOriginX + w,
      nv.subOriginX + nv.subWidth,
    )
    const startWY = Math.max(levelView.subOriginY, nv.subOriginY)
    const endWY = Math.min(
      levelView.subOriginY + h,
      nv.subOriginY + nv.subHeight,
    )
    for (let wy = startWY; wy < endWY; wy += 1) {
      const ly = wy - levelView.subOriginY
      const nly = wy - nv.subOriginY
      const rowOffset = ly * w
      const nRowOffset = nly * nv.gridWidth
      for (let wx = startWX; wx < endWX; wx += 1) {
        const lx = wx - levelView.subOriginX
        const idx = rowOffset + lx
        const curMask = collisionMasks[idx] ?? COLLIDE_MASK_INVALID
        if ((curMask & COLLIDE_MASK_INVALID) !== COLLIDE_MASK_INVALID) continue
        const nlx = wx - nv.subOriginX
        const nIdx = nRowOffset + nlx
        const nMask = nv.collisionMasks[nIdx] ?? COLLIDE_MASK_INVALID
        if ((nMask & COLLIDE_MASK_INVALID) === COLLIDE_MASK_INVALID) continue
        collisionMasks[idx] = nMask
        blocked[idx] = nv.blocked[nIdx] ?? 1
      }
    }
  }

  const grid: CollisionGrid = {
    originX: levelView.isoOriginX,
    originY: levelView.isoOriginY,
    cellsX: levelView.cellsX,
    cellsY: levelView.cellsY,
    blocked,
    gridWidth: w,
    collisionMasks,
  }
  mergedCollisionGridCache.set(levelView, { key, grid })
  return grid
}

/**
 * Diablo II 1.13c isometric intra-cell baseline offset (`sortY` delta in ortho pixels)
 * for a wall tile of a given DT1/DS1 orientation `type`.
 *
 * Each DS1 cell spans 5×5 sub-tiles (`ORTHO_CELL_HEIGHT = 40`, `ORTHO_SUB_TILE_HEIGHT = 8`),
 * so a unit at sub-cell offset `(dx, dy) ∈ [0..4]` has `worldY = (cellX + cellY) * 40 + (dx + dy) * 8`.
 * - Left/right/door walls (`type 1, 2, 6, 7, 8, 9`) run across the cell center (`dx + dy = 5` -> `+40`).
 * - North corner walls (`type 3, 4`) sit near the upper-middle baseline (`+24`).
 * - Left/right walls & doors (`type 1, 2, 6, 7, 8, 9`) sit along the north-west (`dx = 0`) or north-east (`dy = 0`)
 *   edge of cell `(cellX, cellY)` (`+8`), so any unit on a walkable foreground subtile inside `(cellX, cellY)`
 *   (`dx >= 1` or `dy >= 1`, `(dx + dy) * 8 >= 8`) sorts in front of its own cell's north wall, while any unit
 *   in a behind-wall cell (`uCellX + uCellY < cellX + cellY`) is occluded by DrawGrid cell-row ordering (`0x6fb4ee90`).
 * - North corner / pillar / tree walls (`type 3, 4, 5, 12, 14`) occupy the north corner (`dx in {0,1}, dy in {0,1}`,
 *   `+16`), so any unit on a walkable foreground subtile inside `(cellX, cellY)` (`dx + dy >= 2 -> +16..+64`) sorts
 *   in front of the cell's pillar/palm tree/corner wall (#1330).
 * - Exit walls (`type 10, 11`), lower walls (`16..19`), floors (`0`), shadows (`13`), roofs (`15`): `+0`.
 */
export function wallSortOffset(wallType: number | undefined): number {
  switch (wallType) {
    case 1:
    case 2:
    case 6:
    case 7:
    case 8:
    case 9:
      return 8
    case 3:
    case 4:
    case 5:
    case 12:
    case 14:
      return 16
    default:
      return 0
  }
}

export function wallSortY(cellX: number, cellY: number, wallType?: number): number {
  return (cellX + cellY) * 40 + wallSortOffset(wallType)
}

/** Mutable mirror of `SceneTileQuad` for the in-place rebuild pool (#941). */
type PooledSceneTileQuad = { -readonly [K in keyof SceneTileQuad]: SceneTileQuad[K] }

function acquirePooledQuad(pool: PooledSceneTileQuad[], cursor: number): PooledSceneTileQuad {
  let quad = pool[cursor]
  if (quad === undefined) {
    quad = {} as PooledSceneTileQuad
    pool.push(quad)
  }
  return quad
}

/**
 * In-place variant of the old `mapLevelDrawToQuad` (#941): writes the same
 * field set into a pooled quad instead of allocating a fresh object per visible
 * tile per frame. Optional fields are `delete`d when absent so a recycled quad
 * never carries stale keys.
 */
function fillQuadFromLevelDraw(
  quad: PooledSceneTileQuad,
  item: LevelDrawItem,
  fallbackActId: number,
  dCellX = 0,
  dCellY = 0,
  dIsoX = 0,
  dIsoY = 0,
): void {
  const cellX = item.cellX + dCellX
  const cellY = item.cellY + dCellY
  quad.cellX = cellX
  quad.cellY = cellY
  quad.worldX = item.x + dIsoX
  quad.worldY = item.y + dIsoY
  quad.sortY = wallSortY(cellX, cellY, item.type)
  quad.act = item.placement?.act ?? fallbackActId
  quad.library = item.library
  quad.tile = item.tile
  if (item.type !== undefined) {
    quad.type = item.type
  } else {
    delete quad.type
  }
  if (item.style !== undefined) {
    quad.style = item.style
  } else {
    delete quad.style
  }
  if (item.lightDirection !== undefined) {
    quad.lightDirection = item.lightDirection
  } else {
    delete quad.lightDirection
  }
  if (item.roofHeight !== undefined) {
    quad.roofHeight = item.roofHeight
  } else {
    delete quad.roofHeight
  }
  quad.dt1Path = item.dt1Path
  quad.placement = item.placement
  if (item.blockCount !== undefined) {
    quad.blockCount = item.blockCount
  } else {
    delete quad.blockCount
  }
  quad.animatedPlacements = item.animatedPlacements
  if (item.materialFlags !== undefined) {
    quad.materialFlags = item.materialFlags
  } else {
    delete quad.materialFlags
  }
  if (item.fadeBox !== undefined) {
    let fadeBox = quad.fadeBox as { index: number; x: number; y: number } | undefined
    if (fadeBox === undefined) {
      fadeBox = { index: 0, x: 0, y: 0 }
      quad.fadeBox = fadeBox
    }
    fadeBox.index = item.fadeBox.index
    fadeBox.x = item.fadeBox.x + dCellX
    fadeBox.y = item.fadeBox.y + dCellY
  } else {
    delete quad.fadeBox
  }
  if (item.noFade === true) {
    quad.noFade = true
  } else {
    delete quad.noFade
  }
  if (item.revealHidden === true) {
    quad.revealHidden = true
  } else {
    delete quad.revealHidden
  }
  if (item.popLinkage === true) {
    quad.popLinkage = true
  } else {
    delete quad.popLinkage
  }
}

/**
 * Level-local sub-tile shift for the active `LevelView`.
 *
 * Contract: every unit / player coordinate fed into a `ClientWorldSceneSource` is an absolute
 * world sub-tile coordinate as sent by D2GS (`0x15`, `0x59`, `0x95`, `0xAC`, ...). The level-local
 * sub-tile is always `world - levelView.subOrigin` (`subOrigin = DRLG coord * 5`). There is no
 * heuristic "already local?" guess any more (the old `player < origin * 0.5` probe silently accepted
 * two coordinate contracts). Without a `LevelView` there is no level to anchor to: shift is zero and
 * `isWorldReady()` reports not-ready so the renderer does not draw units at arbitrary positions.
 */
function resolveLevelSubTileShift(
  levelView: LevelView | null | undefined,
): { readonly shiftX: number; readonly shiftY: number } {
  if (!levelView) {
    return { shiftX: 0, shiftY: 0 }
  }
  return { shiftX: levelView.subOriginX, shiftY: levelView.subOriginY }
}

/** Move the adapter's world-space near-room rectangles into the lighting pass's level-local sub-tiles. */
function toLocalAmbient(
  ambient: SceneAmbientState | null,
  shiftX: number,
  shiftY: number,
): LightingAmbientInputs | null {
  if (ambient === null) return null
  return {
    playerRoom: ambient.playerRoom,
    nearRooms: ambient.nearRooms.map(room => ({
      subX: room.worldSubX - shiftX,
      subY: room.worldSubY - shiftY,
      subW: room.subW,
      subH: room.subH,
      ambient: room.ambient,
    })),
  }
}

function normalizeUnitsToLocalSubTiles(
  units: Iterable<RenderableUnitInput>,
  shiftX: number,
  shiftY: number,
): RenderableUnitInput[] {
  if (shiftX === 0 && shiftY === 0) {
    return Array.from(units)
  }
  const result: RenderableUnitInput[] = []
  for (const u of units) {
    result.push({
      ...u,
      x: u.x - shiftX,
      y: u.y - shiftY,
      ...(u.targetX !== undefined ? { targetX: u.targetX - shiftX } : {}),
      ...(u.targetY !== undefined ? { targetY: u.targetY - shiftY } : {}),
      ...(u.lightX !== undefined ? { lightX: u.lightX - shiftX } : {}),
      ...(u.lightY !== undefined ? { lightY: u.lightY - shiftY } : {}),
    })
  }
  return result
}

function getIterableUnitCount(units: Iterable<RenderableUnitInput>): number | null {
  if (Array.isArray(units)) {
    return units.length
  }
  if (
    typeof units === 'object' &&
    units !== null &&
    'size' in units &&
    typeof (units as { readonly size?: unknown }).size === 'number'
  ) {
    return (units as { readonly size: number }).size
  }
  return null
}

/** Default padded-view cull margin shared by the static tile pass and the entity pass. */
export const SCENE_CULL_PADDING_PX = 240

/**
 * Extra cull margin for the entity pass on top of `SCENE_CULL_PADDING_PX`: art anchored at a
 * unit's feet can reach well past the anchor (tall sprites, auras) and a culled unit's light
 * emitter is dropped with it, so the bound must also cover light falloff that still touches
 * the viewport. 256px ≈ the largest sprites/auras; light falloff beyond it is imperceptible.
 */
const UNIT_CULL_EXTRA_PX = 256

/**
 * Single-pass level-local sub-tile normalization + padded viewport cull for the per-frame
 * entity pass (#1031): tests the projected isometric position against the camera rect padded
 * by `cullPaddingPx + UNIT_CULL_EXTRA_PX` BEFORE allocating the shifted unit clone, avoiding
 * intermediate array allocations and off-screen object clones.
 */
function cullAndNormalizeUnitsToPaddedView(
  units: Iterable<RenderableUnitInput>,
  shiftX: number,
  shiftY: number,
  cameraTopLeft: { readonly x: number; readonly y: number },
  profile: ViewportProfile,
  cullPaddingPx: number,
  isoOriginX: number,
  isoOriginY: number,
): RenderableUnitInput[] {
  const pad = cullPaddingPx + UNIT_CULL_EXTRA_PX
  const minX = cameraTopLeft.x - pad
  const maxX = cameraTopLeft.x + profile.width + pad
  const minY = cameraTopLeft.y - pad
  const maxY = cameraTopLeft.y + profile.height + pad
  const noShift = shiftX === 0 && shiftY === 0
  const kept: RenderableUnitInput[] = []
  for (const u of units) {
    const raw = u as unknown as Record<string, unknown>
    // Mirrors the x/y resolution `buildSceneDrawables` applies to the same inputs.
    const rawX = typeof raw.x === 'number' ? raw.x : typeof raw.subtileX === 'number' ? raw.subtileX : 0
    const rawY = typeof raw.y === 'number' ? raw.y : typeof raw.subtileY === 'number' ? raw.subtileY : 0
    const x = rawX - shiftX
    const y = rawY - shiftY
    const isoX = (x - y) * 16 + isoOriginX
    const isoY = (x + y) * 8 + isoOriginY
    if (isoX >= minX && isoX <= maxX && isoY >= minY && isoY <= maxY) {
      if (noShift) {
        kept.push(u)
      } else {
        kept.push({
          ...u,
          x,
          y,
          ...(u.targetX !== undefined ? { targetX: u.targetX - shiftX } : {}),
          ...(u.targetY !== undefined ? { targetY: u.targetY - shiftY } : {}),
        })
      }
    }
  }
  return kept
}

/**
 * Returns the canonical 1.13c / SGD2FreeRes player-anchored viewport top-left coordinates
 * (`D2Client.dll` `0x6fb3b142..0x6fb3b1a7` & `0x6fb010f0..0x6fb0116c`, Issue #1401).
 *
 * Diablo II never shifts or clamps the camera center away from the local player at map boundaries;
 * shifting the render camera decouples world rendering from `ViewportCamera` / `CommandMapper`
 * mouse hit-testing, pathfinding, and Teleport targeting, and causes violent camera swings across
 * dungeon rooms. Widescreen outdoor margin corners are filled via border skirt floor quads instead.
 */
export function computeConvergedCameraTopLeft(
  baseCamX: number,
  baseCamY: number,
  _profile?: ViewportProfile,
  _levelView?: LevelView | null | undefined,
  _neighbours?: readonly LevelView[] | null | undefined,
): { readonly x: number; readonly y: number } {
  return { x: baseCamX, y: baseCamY }
}

/**
 * Concrete `SceneSource` implementation backed by `ClientWorld` unit state, `LevelView`, and `TileAtlas`.
 */
export class ClientWorldSceneSource implements SceneSource {
  private viewportProfile: ViewportProfile
  private stateProvider: () => ClientSceneWorldAdapter
  /**
   * Render-time transform of the provider's state (PD2 `d2fps` motion smoothing,
   * `loop/scene-motion-smoothing.ts`). Applied on every provider read, so the world, camera, lighting
   * and hit-testing all see the same smoothed positions.
   */
  private stateFilter: ((st: ClientSceneWorldAdapter) => ClientSceneWorldAdapter) | null = null
  private inFrame = false
  private activeFrameState: ClientSceneWorldAdapter | null = null
  private cachedSceneDrawables: readonly SceneUnitDrawable[] | null = null
  /**
   * Static tile-quad pass cache (#941). The five quad arrays depend only on the
   * level view identity, viewport, camera top-left (already includes panel shift
   * and shake), act fallback, and cull padding — never on `tick`. When that
   * signature is unchanged the previous arrays are returned as-is (identical
   * content, zero rebuild cost); on a miss the arrays are refilled in place from
   * the quad/fadeBox pools so a moving camera allocates nothing per frame.
   * Consumers treat quads as read-only and only read them synchronously within
   * the frame that produced the snapshot (`renderSceneSourceFrame` copies
   * before sorting; `lastRenderSnapshot` retains only scalars across frames).
   */
  private staticPassCache: {
    levelView: LevelView | null | undefined
    neighbours: readonly LevelView[] | null | undefined
    actId: number
    viewportWidth: number
    viewportHeight: number
    cameraBucketX: number
    cameraBucketY: number
    cullPaddingPx: number
    floorQuads: PooledSceneTileQuad[]
    shadowQuads: PooledSceneTileQuad[]
    lowerWallQuads: PooledSceneTileQuad[]
    upperWallQuads: PooledSceneTileQuad[]
    roofQuads: PooledSceneTileQuad[]
    quadPool: PooledSceneTileQuad[]
    drawnFloorCells: Set<number>
    drawnShadowCells: Set<number>
    drawnWallCells: Set<number>
    drawnRoofCells: Set<number>
  } | null = null
  private cachedSnapshotContext: {
    readonly st: ClientSceneWorldAdapter
    readonly entities: BuildSceneDrawablesResult
    readonly localPlayerSub: { readonly x: number; readonly y: number }
    readonly playerWorld: { readonly x: number; readonly y: number }
    readonly panelShiftX: number
    readonly shiftX: number
    readonly shiftY: number
    readonly isoOriginX: number
    readonly isoOriginY: number
    readonly tick: number
    readonly levelId: number
    readonly unitCount: number
  } | null = null

  constructor(
    stateProvider: () => ClientSceneWorldAdapter,
    initialViewport: ViewportProfile | ViewportResolution = DEFAULT_VIEWPORT_PROFILE,
  ) {
    this.stateProvider = stateProvider
    this.viewportProfile = getViewportProfile(initialViewport)
  }

  beginFrame(): void {
    this.inFrame = true
    this.activeFrameState = null
  }

  endFrame(): void {
    this.inFrame = false
    this.activeFrameState = null
  }

  /** Install (or clear with `null`) the render-time state transform; see {@link stateFilter}. */
  setStateFilter(filter: ((st: ClientSceneWorldAdapter) => ClientSceneWorldAdapter) | null): void {
    this.stateFilter = filter
    this.activeFrameState = null
  }

  private readState(): ClientSceneWorldAdapter {
    const st = this.stateProvider()
    return this.stateFilter ? this.stateFilter(st) : st
  }

  private getState(): ClientSceneWorldAdapter {
    if (this.inFrame) {
      if (!this.activeFrameState) {
        this.activeFrameState = this.readState()
      }
      return this.activeFrameState
    }
    return this.readState()
  }

  private resolveActId(st: ClientSceneWorldAdapter): 1 | 2 | 3 | 4 | 5 {
    if (st.actId !== undefined) return st.actId
    if (st.levelView) {
      return Math.max(1, Math.min(5, (st.levelView.act ?? 0) + 1)) as 1 | 2 | 3 | 4 | 5
    }
    return 1
  }

  private resolveLevelId(st: ClientSceneWorldAdapter): number {
    return st.levelId ?? st.levelView?.areaId ?? 1
  }

  private resolveWorldReady(st: ClientSceneWorldAdapter): boolean {
    return Boolean(st.levelView) && (st.playerSubX !== 0 || st.playerSubY !== 0)
  }

  getViewportProfile(): ViewportProfile {
    return this.viewportProfile
  }

  setViewportProfile(profile: ViewportProfile | ViewportResolution): ViewportProfile {
    this.viewportProfile = getViewportProfile(profile)
    return this.viewportProfile
  }

  getActId(): 1 | 2 | 3 | 4 | 5 {
    return this.resolveActId(this.getState())
  }

  getLevelId(): number {
    return this.resolveLevelId(this.getState())
  }

  getTick(): number {
    return this.getState().tick ?? 0
  }

  getLevelView(): LevelView | null {
    return this.getState().levelView ?? null
  }

  getNeighbourLevelViews(): readonly LevelView[] {
    return this.getState().neighbourLevelViews ?? []
  }

  getPlayerSubTile(): { readonly x: number; readonly y: number } {
    const st = this.getState()
    return { x: st.playerSubX, y: st.playerSubY }
  }

  /**
   * The world can only be drawn once D2GS has (a) loaded the act/level (`0x03 LoadAct` →
   * `LevelView`) and (b) assigned the local player a world position (`0x15` / `0x95` / ...).
   * D2 world sub-tile coordinates are always far from `(0, 0)` (DRLG act origins), so `(0, 0)`
   * means "not yet assigned". Until then nothing world-relative may be drawn (#539: never guess a
   * spawn / camera anchor).
   */
  isWorldReady(): boolean {
    return this.resolveWorldReady(this.getState())
  }

  getPlayerLocalSubTile(): { readonly x: number; readonly y: number } {
    const st = this.getState()
    const { shiftX, shiftY } = resolveLevelSubTileShift(st.levelView)
    return {
      x: st.playerSubX - shiftX,
      y: st.playerSubY - shiftY,
    }
  }

  getPlayerWorldOrtho(): { readonly x: number; readonly y: number } {
    const st = this.getState()
    const { shiftX, shiftY } = resolveLevelSubTileShift(st.levelView)
    const isoOriginX = st.levelView?.isoOriginX ?? 0
    const isoOriginY = st.levelView?.isoOriginY ?? 0
    return subTileToWorldOrtho(
      st.playerSubX - shiftX,
      st.playerSubY - shiftY,
      isoOriginX,
      isoOriginY,
    )
  }

  getCameraTopLeft(profile: ViewportProfile = this.viewportProfile): {
    readonly x: number
    readonly y: number
  } {
    const st = this.getState()
    const { shiftX, shiftY } = resolveLevelSubTileShift(st.levelView)
    const isoOriginX = st.levelView?.isoOriginX ?? 0
    const isoOriginY = st.levelView?.isoOriginY ?? 0
    const playerWorld = subTileToWorldOrtho(
      st.playerSubX - shiftX,
      st.playerSubY - shiftY,
      isoOriginX,
      isoOriginY,
    )
    const panelShiftX =
      st.panelShiftX ?? computePanelCameraShift(st.leftPanelOpen, st.rightPanelOpen, panelDockWidth(profile))
    const shakeX = st.shakeOffsetX ?? 0
    const shakeY = st.shakeOffsetY ?? 0
    const baseCamX = playerWorld.x + panelShiftX + shakeX - profile.width / 2
    const baseCamY = playerWorld.y + CAMERA_Y_OFFSET + shakeY - profile.height / 2
    return computeConvergedCameraTopLeft(
      baseCamX,
      baseCamY,
      profile,
      st.levelView,
      st.neighbourLevelViews,
    )
  }

  isSubTileWalkable(subX: number, subY: number): boolean {
    const st = this.getState()
    // No LevelView → no collision data → nothing is walkable (never a permissive `return true`).
    if (!st.levelView) return false
    const sx = Math.floor(subX)
    const sy = Math.floor(subY)
    if (isWalkableWorldSubTile(st.levelView, sx, sy)) return true
    if (st.neighbourLevelViews) {
      for (const nv of st.neighbourLevelViews) {
        if (nv && isWalkableWorldSubTile(nv, sx, sy)) return true
      }
    }
    return false
  }

  buildFrameSnapshot(cullPaddingPx = SCENE_CULL_PADDING_PX): SceneFrameSnapshot {
    const st = this.getState()
    const profile = this.viewportProfile
    const { shiftX, shiftY } = resolveLevelSubTileShift(st.levelView)
    const isoOriginX = st.levelView?.isoOriginX ?? 0
    const isoOriginY = st.levelView?.isoOriginY ?? 0
    const playerSubTile = { x: st.playerSubX, y: st.playerSubY }
    const playerLocalSubTile = { x: st.playerSubX - shiftX, y: st.playerSubY - shiftY }
    const playerWorld = subTileToWorldOrtho(
      st.playerSubX - shiftX,
      st.playerSubY - shiftY,
      isoOriginX,
      isoOriginY,
    )
    const panelShiftX =
      st.panelShiftX ?? computePanelCameraShift(st.leftPanelOpen, st.rightPanelOpen, panelDockWidth(profile))
    const shakeX = st.shakeOffsetX ?? 0
    const shakeY = st.shakeOffsetY ?? 0
    const rawCamX = playerWorld.x + panelShiftX + shakeX - profile.width / 2
    const rawCamY = playerWorld.y + CAMERA_Y_OFFSET + shakeY - profile.height / 2
    const cameraTopLeft = computeConvergedCameraTopLeft(
      rawCamX,
      rawCamY,
      profile,
      st.levelView,
      st.neighbourLevelViews,
    )

    const actId = this.resolveActId(st)
    const levelId = this.resolveLevelId(st)
    const worldReady = this.resolveWorldReady(st)

    // #941: the five quad arrays are a pure function of the inputs below (never of
    // `tick`), so an unchanged signature reuses the previous arrays verbatim and a
    // changed one rebuilds them in place from the pooled quads — idle frames skip
    // the tile walk entirely, moving frames allocate nothing.
    // The camera is keyed by 64px buckets, not exact pixels: a walking camera only
    // rebuilds when it crosses a bucket boundary (~every 13 frames at run speed),
    // and the cached set stays a valid superset because the cull padding (240px by
    // default) dwarfs the ≤64px in-bucket drift. Small paddings fall back to exact
    // camera matching so the superset guarantee never depends on the caller.
    const CAMERA_BUCKET_PX = 64
    const cameraBucketPx = cullPaddingPx >= CAMERA_BUCKET_PX ? CAMERA_BUCKET_PX : 0
    const cameraBucketX = cameraBucketPx > 0 ? Math.floor(cameraTopLeft.x / cameraBucketPx) : cameraTopLeft.x
    const cameraBucketY = cameraBucketPx > 0 ? Math.floor(cameraTopLeft.y / cameraBucketPx) : cameraTopLeft.y
    const passCache = this.staticPassCache
    const prevNeighbours = passCache?.neighbours
    const nextNeighbours = st.neighbourLevelViews
    const neighboursMatch =
      passCache !== null &&
      (prevNeighbours === nextNeighbours ||
        (prevNeighbours != null &&
          nextNeighbours != null &&
          prevNeighbours.length === nextNeighbours.length &&
          prevNeighbours.every((nv, idx) => nv === nextNeighbours[idx])))
    const signatureHit =
      passCache !== null &&
      passCache.levelView === st.levelView &&
      neighboursMatch &&
      passCache.actId === actId &&
      passCache.viewportWidth === profile.width &&
      passCache.viewportHeight === profile.height &&
      passCache.cameraBucketX === cameraBucketX &&
      passCache.cameraBucketY === cameraBucketY &&
      passCache.cullPaddingPx === cullPaddingPx

    let floorQuads: readonly SceneTileQuad[]
    let shadowQuads: readonly SceneTileQuad[]
    let lowerWallQuads: readonly SceneTileQuad[]
    let upperWallQuads: readonly SceneTileQuad[]
    let roofQuads: readonly SceneTileQuad[]

    if (signatureHit && passCache !== null) {
      floorQuads = passCache.floorQuads
      shadowQuads = passCache.shadowQuads
      lowerWallQuads = passCache.lowerWallQuads
      upperWallQuads = passCache.upperWallQuads
      roofQuads = passCache.roofQuads
    } else {
      const c =
        passCache ?? {
          levelView: null as LevelView | null | undefined,
          neighbours: null as readonly LevelView[] | null | undefined,
          actId: 0,
          viewportWidth: 0,
          viewportHeight: 0,
          cameraBucketX: 0,
          cameraBucketY: 0,
          cullPaddingPx: 0,
          floorQuads: [] as PooledSceneTileQuad[],
          shadowQuads: [] as PooledSceneTileQuad[],
          lowerWallQuads: [] as PooledSceneTileQuad[],
          upperWallQuads: [] as PooledSceneTileQuad[],
          roofQuads: [] as PooledSceneTileQuad[],
          quadPool: [] as PooledSceneTileQuad[],
          drawnFloorCells: new Set<number>(),
          drawnShadowCells: new Set<number>(),
          drawnWallCells: new Set<number>(),
          drawnRoofCells: new Set<number>(),
        }
      this.staticPassCache = c
      c.levelView = st.levelView
      c.neighbours = st.neighbourLevelViews
      c.actId = actId
      c.viewportWidth = profile.width
      c.viewportHeight = profile.height
      c.cameraBucketX = cameraBucketX
      c.cameraBucketY = cameraBucketY
      c.cullPaddingPx = cullPaddingPx
      c.floorQuads.length = 0
      c.shadowQuads.length = 0
      c.lowerWallQuads.length = 0
      c.upperWallQuads.length = 0
      c.roofQuads.length = 0

      let quadCursor = 0
      const nextQuad = (): PooledSceneTileQuad => acquirePooledQuad(c.quadPool, quadCursor++)

      if (st.levelView) {
        const minX = cameraTopLeft.x - cullPaddingPx
        const maxX = cameraTopLeft.x + profile.width + cullPaddingPx
        const minY = cameraTopLeft.y - cullPaddingPx
        const maxY = cameraTopLeft.y + profile.height + cullPaddingPx
        const hasNeighbours = Boolean(
          st.neighbourLevelViews && st.neighbourLevelViews.length > 0,
        )
        c.drawnFloorCells.clear()
        if (hasNeighbours) {
          c.drawnShadowCells.clear()
          c.drawnWallCells.clear()
          c.drawnRoofCells.clear()
        }
        const drawnFloorCells = c.drawnFloorCells
        const drawnShadowCells = hasNeighbours ? c.drawnShadowCells : null
        const drawnWallCells = hasNeighbours ? c.drawnWallCells : null
        const drawnRoofCells = hasNeighbours ? c.drawnRoofCells : null
        const packCellKey = (cx: number, cy: number): number =>
          ((cy & 0xffff) << 16) | (cx & 0xffff)
        // A tile is kept when its bitmap rectangle overlaps the padded view (a wall's or lower wall's art can
        // reach hundreds of pixels past its top-left corner).
        const inView = (x: number, y: number, placement: PackedTilePlacement | null): boolean => {
          const w = placement?.width ?? 0
          const h = placement?.height ?? 0
          return x + w >= minX && x <= maxX && y + h >= minY && y <= maxY
        }

        let sampleFloor: LevelDrawItem | null = null
        for (const f of st.levelView.floors) {
          if (!f.placement && f.blockCount === 0) continue
          if (sampleFloor === null && f.placement) {
            sampleFloor = f
          }
          if (inView(f.x, f.y, f.placement)) {
            const quad = nextQuad()
            fillQuadFromLevelDraw(quad, f, actId)
            c.floorQuads.push(quad)
            drawnFloorCells.add(packCellKey(f.cellX, f.cellY))
          }
        }
        for (const s of st.levelView.shadows) {
          if (!s.placement && s.blockCount === 0) continue
          if (inView(s.x, s.y, s.placement)) {
            const quad = nextQuad()
            fillQuadFromLevelDraw(quad, s, actId)
            c.shadowQuads.push(quad)
            drawnShadowCells?.add(packCellKey(s.cellX, s.cellY))
          }
        }
        for (const w of st.levelView.walls) {
          if (!w.placement && w.blockCount === 0) continue
          if (inView(w.x, w.y, w.placement)) {
            const quad = nextQuad()
            fillQuadFromLevelDraw(quad, w, actId)
            if (
              isLowerWallType(w.type) || w.isLowerWall === true
            ) {
              c.lowerWallQuads.push(quad)
            } else {
              c.upperWallQuads.push(quad)
            }
            drawnWallCells?.add(packCellKey(w.cellX, w.cellY))
          }
        }
        for (const r of st.levelView.roofs) {
          if (inView(r.x, r.y, r.placement)) {
            const quad = nextQuad()
            fillQuadFromLevelDraw(quad, r, actId)
            c.roofQuads.push(quad)
            drawnRoofCells?.add(packCellKey(r.cellX, r.cellY))
          }
        }

        if (hasNeighbours && st.neighbourLevelViews) {
          for (const nv of st.neighbourLevelViews) {
            if (!nv || nv.areaId === st.levelView.areaId || nv.act !== st.levelView.act) {
              continue
            }
            const dSubX = (nv.subOriginX ?? 0) - shiftX
            const dSubY = (nv.subOriginY ?? 0) - shiftY
            const dCellX = Math.round(dSubX / 5)
            const dCellY = Math.round(dSubY / 5)
            const dIsoX = (dSubX - dSubY) * 16 + (isoOriginX - (nv.isoOriginX ?? 0))
            const dIsoY = (dSubX + dSubY) * 8 + (isoOriginY - (nv.isoOriginY ?? 0))

            // Coarse frustum check against the neighbour level's isometric canvas box
            if (nv.widthPx > 0 && nv.heightPx > 0) {
              const nvMinX = dIsoX - 160
              const nvMaxX = dIsoX + nv.widthPx + 160
              const nvMinY = dIsoY - 320
              const nvMaxY = dIsoY + nv.heightPx + 320
              if (nvMaxX < minX || nvMinX > maxX || nvMaxY < minY || nvMinY > maxY) {
                continue
              }
            }

            const nvFloorCells: number[] = []
            for (const f of nv.floors) {
              if (!f.placement && f.blockCount === 0) continue
              const wx = f.x + dIsoX
              const wy = f.y + dIsoY
              if (inView(wx, wy, f.placement)) {
                const cx = f.cellX + dCellX
                const cy = f.cellY + dCellY
                const cellKey = packCellKey(cx, cy)
                if (drawnFloorCells?.has(cellKey)) continue
                const quad = nextQuad()
                fillQuadFromLevelDraw(quad, f, actId, dCellX, dCellY, dIsoX, dIsoY)
                c.floorQuads.push(quad)
                nvFloorCells.push(cellKey)
              }
            }
            for (const k of nvFloorCells) drawnFloorCells?.add(k)

            const nvShadowCells: number[] = []
            for (const s of nv.shadows) {
              if (!s.placement && s.blockCount === 0) continue
              const wx = s.x + dIsoX
              const wy = s.y + dIsoY
              if (inView(wx, wy, s.placement)) {
                const cx = s.cellX + dCellX
                const cy = s.cellY + dCellY
                const cellKey = packCellKey(cx, cy)
                if (drawnShadowCells?.has(cellKey)) continue
                const quad = nextQuad()
                fillQuadFromLevelDraw(quad, s, actId, dCellX, dCellY, dIsoX, dIsoY)
                c.shadowQuads.push(quad)
                nvShadowCells.push(cellKey)
              }
            }
            for (const k of nvShadowCells) drawnShadowCells?.add(k)

            const nvWallCells: number[] = []
            for (const w of nv.walls) {
              if (!w.placement && w.blockCount === 0) continue
              const wx = w.x + dIsoX
              const wy = w.y + dIsoY
              if (inView(wx, wy, w.placement)) {
                const cx = w.cellX + dCellX
                const cy = w.cellY + dCellY
                const cellKey = packCellKey(cx, cy)
                if (drawnWallCells?.has(cellKey)) continue
                const quad = nextQuad()
                fillQuadFromLevelDraw(quad, w, actId, dCellX, dCellY, dIsoX, dIsoY)
                if (
                  isLowerWallType(w.type) || w.isLowerWall === true
                ) {
                  c.lowerWallQuads.push(quad)
                } else {
                  c.upperWallQuads.push(quad)
                }
                nvWallCells.push(cellKey)
              }
            }
            for (const k of nvWallCells) drawnWallCells?.add(k)

            const nvRoofCells: number[] = []
            for (const r of nv.roofs) {
              const wx = r.x + dIsoX
              const wy = r.y + dIsoY
              if (inView(wx, wy, r.placement)) {
                const cx = r.cellX + dCellX
                const cy = r.cellY + dCellY
                const cellKey = packCellKey(cx, cy)
                if (drawnRoofCells?.has(cellKey)) continue
                const quad = nextQuad()
                fillQuadFromLevelDraw(quad, r, actId, dCellX, dCellY, dIsoX, dIsoY)
                c.roofQuads.push(quad)
                nvRoofCells.push(cellKey)
              }
            }
            for (const k of nvRoofCells) drawnRoofCells?.add(k)
          }
        }

        // In widescreen modes (>800x600) on standalone outdoor levels (`IsInside == 0` in Levels.txt and no
        // stitched `neighbourLevelViews`), generate border skirt margin floor quads for any visible frustum
        // cells extending outside the map diamond (Issues #1370, #1401). Indoor dungeons (`isInside === true`,
        // e.g. Catacombs Level 4 areaId=37) must keep authentic black void outside walls instead of stamping
        // floating floor tiles, and stitched outdoor views rely on `neighbourLevelViews` for adjacent tiles.
        const isInsideLevel = CANONICAL_LEVEL_LIGHTING[levelId]?.isInside === true
        const hasStitchedNeighbours =
          st.neighbourLevelViews !== undefined &&
          st.neighbourLevelViews !== null &&
          st.neighbourLevelViews.length > 0
        if (
          !isInsideLevel &&
          !hasStitchedNeighbours &&
          profile.width > 800 &&
          sampleFloor !== null &&
          sampleFloor.placement
        ) {
          const cellsX = st.levelView.cellsX
          const cellsY = st.levelView.cellsY
          const cellMinX = Math.floor((minY - isoOriginY) / 80 + (minX - isoOriginX) / 160) - 1
          const cellMaxX = Math.ceil((maxY - isoOriginY) / 80 + (maxX - isoOriginX) / 160) + 1
          const cellMinY = Math.floor((minY - isoOriginY) / 80 - (maxX - isoOriginX) / 160) - 1
          const cellMaxY = Math.ceil((maxY - isoOriginY) / 80 - (minX - isoOriginX) / 160) + 1
          for (let cy = cellMinY; cy <= cellMaxY; cy++) {
            for (let cx = cellMinX; cx <= cellMaxX; cx++) {
              if (cx >= 0 && cx < cellsX && cy >= 0 && cy < cellsY) {
                continue
              }
              const cellKey = packCellKey(cx, cy)
              if (drawnFloorCells.has(cellKey)) {
                continue
              }
              const isoX = (cx - cy) * 80 + isoOriginX
              const isoY = (cx + cy) * 40 + isoOriginY
              if (inView(isoX, isoY, sampleFloor.placement)) {
                const quad = nextQuad()
                const dCellX = cx - sampleFloor.cellX
                const dCellY = cy - sampleFloor.cellY
                const dIsoX = isoX - sampleFloor.x
                const dIsoY = isoY - sampleFloor.y
                fillQuadFromLevelDraw(quad, sampleFloor, actId, dCellX, dCellY, dIsoX, dIsoY)
                c.floorQuads.push(quad)
                drawnFloorCells.add(cellKey)
              }
            }
          }
        }
      }

      c.lowerWallQuads.sort(
        (a, b) =>
          a.cellX + a.cellY - (b.cellX + b.cellY) ||
          a.sortY - b.sortY ||
          a.cellY - b.cellY ||
          a.cellX - b.cellX ||
          a.worldX - b.worldX ||
          a.worldY - b.worldY,
      )
      c.upperWallQuads.sort(
        (a, b) =>
          a.cellX + a.cellY - (b.cellX + b.cellY) ||
          a.sortY - b.sortY ||
          a.cellY - b.cellY ||
          a.cellX - b.cellX ||
          a.worldX - b.worldX ||
          a.worldY - b.worldY,
      )
      floorQuads = c.floorQuads
      shadowQuads = c.shadowQuads
      lowerWallQuads = c.lowerWallQuads
      upperWallQuads = c.upperWallQuads
      roofQuads = c.roofQuads
    }

    // D2Client 0x6fb2ab9c..0x6fb2ac51: player cell = path position / 5, logical index = D2Common.#10916 there.
    let wallFadePlayer: SceneWallFadePlayer | undefined
    const logicalGrid = st.levelView?.logicalIndex
    if (logicalGrid !== undefined) {
      const cellX = Math.floor(Math.floor(playerLocalSubTile.x + 0.5) / 5)
      const cellY = Math.floor(Math.floor(playerLocalSubTile.y + 0.5) / 5)
      const inside = cellX >= 0 && cellY >= 0 && cellX < logicalGrid.width && cellY < logicalGrid.height
      wallFadePlayer = {
        cellX,
        cellY,
        logicalIndex: inside ? (logicalGrid.cells[cellY * logicalGrid.width + cellX] ?? -1) : -1,
      }
    }

    const tick = st.tick ?? 0
    const localUnits = cullAndNormalizeUnitsToPaddedView(
      st.units,
      shiftX,
      shiftY,
      cameraTopLeft,
      profile,
      cullPaddingPx,
      isoOriginX,
      isoOriginY,
    )
    const entities = buildSceneDrawables(localUnits, {
      originX: isoOriginX,
      originY: isoOriginY,
      tick,
    })
    this.cachedSceneDrawables = entities.unitDrawables
    this.cachedSnapshotContext = {
      st,
      entities,
      localPlayerSub: playerLocalSubTile,
      playerWorld,
      panelShiftX,
      shiftX,
      shiftY,
      isoOriginX,
      isoOriginY,
      tick,
      levelId,
      unitCount: getIterableUnitCount(st.units) ?? localUnits.length,
    }

    return {
      tick,
      actId,
      levelId,
      viewportProfile: profile,
      worldReady,
      playerSubTile,
      playerLocalSubTile,
      playerWorld,
      cameraTopLeft,
      panelShiftX,
      shakeOffsetX: shakeX,
      shakeOffsetY: shakeY,
      floorQuads,
      shadowQuads,
      lowerWallQuads,
      upperWallQuads,
      roofQuads,
      ...(wallFadePlayer !== undefined ? { wallFadePlayer } : {}),
      ...(st.levelView?.pops !== undefined ? { pops: st.levelView.pops } : {}),
      entities,
    }
  }

  buildLightingInputs(preset: LightingPreset): LightingInputs {
    if (
      this.inFrame &&
      this.cachedSnapshotContext &&
      this.activeFrameState !== null &&
      this.cachedSnapshotContext.st === this.activeFrameState
    ) {
      const { st, entities, localPlayerSub } = this.cachedSnapshotContext
      const { shiftX, shiftY } = resolveLevelSubTileShift(st.levelView)
      const collisionGrid = buildCollisionGridFromLevelView(
        st.levelView,
        st.neighbourLevelViews,
      )
      return {
        preset,
        levelId: this.resolveLevelId(st),
        collisionGrid,
        playerSubTile: steadyLightSub(st, localPlayerSub),
        playerUnitId: st.playerUnitId,
        lightEmitters: entities.lightEmitters,
        tick: st.tick ?? 0,
        playerLightRadiusBonus: st.playerLightRadiusBonus ?? 0,
        playerLightColor: st.playerLightColor ?? 0,
        ambient: toLocalAmbient(st.ambient, shiftX, shiftY),
      }
    }
    const st = this.getState()
    const { shiftX, shiftY } = resolveLevelSubTileShift(st.levelView)
    const isoOriginX = st.levelView?.isoOriginX ?? 0
    const isoOriginY = st.levelView?.isoOriginY ?? 0
    const localPlayerSub = {
      x: st.playerSubX - shiftX,
      y: st.playerSubY - shiftY,
    }
    const localUnits = normalizeUnitsToLocalSubTiles(st.units, shiftX, shiftY)
    const entities = buildSceneDrawables(localUnits, {
      originX: isoOriginX,
      originY: isoOriginY,
      tick: st.tick ?? 0,
    })
    const collisionGrid = buildCollisionGridFromLevelView(
      st.levelView,
      st.neighbourLevelViews,
    )
    return {
      preset,
      levelId: this.resolveLevelId(st),
      collisionGrid,
      playerSubTile: steadyLightSub(st, localPlayerSub),
      playerUnitId: st.playerUnitId,
      lightEmitters: entities.lightEmitters,
      tick: st.tick ?? 0,
      playerLightRadiusBonus: st.playerLightRadiusBonus ?? 0,
      playerLightColor: st.playerLightColor ?? 0,
      ambient: toLocalAmbient(st.ambient, shiftX, shiftY),
    }
  }

  pickUnitAtScreen(
    screenX: number,
    screenY: number,
    hitRadiusPx = 36,
    profile: ViewportProfile = this.viewportProfile,
  ): SceneUnitDrawable | null {
    const cached = this.cachedSnapshotContext
    const st =
      this.inFrame && cached !== null && this.activeFrameState !== null
        ? this.activeFrameState
        : this.getState()
    const { shiftX, shiftY } = resolveLevelSubTileShift(st.levelView)
    const isoOriginX = st.levelView?.isoOriginX ?? 0
    const isoOriginY = st.levelView?.isoOriginY ?? 0
    const tick = st.tick ?? 0
    const levelId = this.resolveLevelId(st)
    const inputUnitCount = getIterableUnitCount(st.units)
    const localPlayerX = st.playerSubX - shiftX
    const localPlayerY = st.playerSubY - shiftY

    let unitDrawables: readonly SceneUnitDrawable[]
    let playerWorld: { readonly x: number; readonly y: number }
    let panelShiftX: number

    if (
      cached !== null &&
      this.cachedSceneDrawables !== null &&
      cached.tick === tick &&
      cached.levelId === levelId &&
      cached.shiftX === shiftX &&
      cached.shiftY === shiftY &&
      cached.isoOriginX === isoOriginX &&
      cached.isoOriginY === isoOriginY &&
      (inputUnitCount !== null ? cached.unitCount === inputUnitCount : cached.st.units === st.units)
    ) {
      unitDrawables = this.cachedSceneDrawables
      if (
        cached.localPlayerSub.x === localPlayerX &&
        cached.localPlayerSub.y === localPlayerY &&
        cached.st.panelShiftX === st.panelShiftX &&
        cached.st.leftPanelOpen === st.leftPanelOpen &&
        cached.st.rightPanelOpen === st.rightPanelOpen
      ) {
        playerWorld = cached.playerWorld
        panelShiftX = cached.panelShiftX
      } else {
        playerWorld = subTileToWorldOrtho(localPlayerX, localPlayerY, isoOriginX, isoOriginY)
        panelShiftX =
          st.panelShiftX ?? computePanelCameraShift(st.leftPanelOpen, st.rightPanelOpen, panelDockWidth(profile))
      }
    } else {
      playerWorld = subTileToWorldOrtho(localPlayerX, localPlayerY, isoOriginX, isoOriginY)
      panelShiftX =
        st.panelShiftX ?? computePanelCameraShift(st.leftPanelOpen, st.rightPanelOpen, panelDockWidth(profile))
      const cullCameraTopLeft = {
        x: playerWorld.x + panelShiftX + (st.shakeOffsetX ?? 0) - profile.width / 2,
        y: playerWorld.y + CAMERA_Y_OFFSET + (st.shakeOffsetY ?? 0) - profile.height / 2,
      }
      const localUnits = cullAndNormalizeUnitsToPaddedView(
        st.units,
        shiftX,
        shiftY,
        cullCameraTopLeft,
        profile,
        SCENE_CULL_PADDING_PX,
        isoOriginX,
        isoOriginY,
      )
      const entities = buildSceneDrawables(localUnits, {
        originX: isoOriginX,
        originY: isoOriginY,
        tick,
      })
      unitDrawables = entities.unitDrawables
      this.cachedSceneDrawables = unitDrawables
      this.cachedSnapshotContext = {
        st,
        entities,
        localPlayerSub: { x: localPlayerX, y: localPlayerY },
        playerWorld,
        panelShiftX,
        shiftX,
        shiftY,
        isoOriginX,
        isoOriginY,
        tick,
        levelId,
        unitCount: inputUnitCount ?? localUnits.length,
      }
    }

    const clickWorld = screenToWorld(
      screenX,
      screenY,
      playerWorld.x + panelShiftX,
      playerWorld.y + CAMERA_Y_OFFSET,
      profile,
    )

    let best: SceneUnitDrawable | null = null
    let bestDistSq = hitRadiusPx * hitRadiusPx
    let bestFromHitBox = false

    for (const u of unitDrawables) {
      if (u.noSel === true) continue
      if (u.isSel === false) continue
      if (u.isCorpse) {
        if (!u.corpseSel) continue
      }
      if (
        u.unitKind === 'player' &&
        unitDrawables.length > 1 &&
        Math.abs(u.subX - localPlayerX) < 1e-3 &&
        Math.abs(u.subY - localPlayerY) < 1e-3
      ) {
        continue
      }
      // If authentic hitbox is present and width > 0, test rectangle bounds
      if (u.hitBox && u.hitBox.width > 0 && u.hitBox.height > 0) {
        const boxLeft = u.worldX + u.hitBox.left
        const boxTop = u.worldY + u.hitBox.top
        const boxRight = boxLeft + u.hitBox.width
        const boxBottom = boxTop + u.hitBox.height
        if (
          clickWorld.x >= boxLeft &&
          clickWorld.x <= boxRight &&
          clickWorld.y >= boxTop &&
          clickWorld.y <= boxBottom
        ) {
          const centerX = (boxLeft + boxRight) / 2
          const centerY = (boxTop + boxBottom) / 2
          const distSq = (clickWorld.x - centerX) ** 2 + (clickWorld.y - centerY) ** 2
          if (!bestFromHitBox || distSq < bestDistSq) {
            bestDistSq = distSq
            best = u
            bestFromHitBox = true
          }
        }
        continue
      }
      // Prioritize units whose bounding boxes contain the click over units evaluated via radial distance fallback
      if (bestFromHitBox) {
        continue
      }
      // Sprite visual center is roughly 24px above foot anchor; warp/tile/item also test foot anchor directly
      const dx = clickWorld.x - u.worldX
      const dyBody = clickWorld.y - (u.worldY - 24)
      const distSqBody = dx * dx + dyBody * dyBody
      const isGroundAnchored =
        u.unitKind === 'warp' || u.unitKind === 'tile' || u.unitKind === 'item'
      const dyFoot = clickWorld.y - u.worldY
      const distSqFoot = dx * dx + dyFoot * dyFoot
      const distSq = isGroundAnchored ? Math.min(distSqBody, distSqFoot) : distSqBody
      if (distSq <= hitRadiusPx * hitRadiusPx && (best === null || distSq < bestDistSq)) {
        bestDistSq = distSq
        best = u
      }
    }
    return best
  }
}
