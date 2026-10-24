/**
 * Runtime LevelView adapter (`src/client/map/level-view.ts`, Feature F12).
 *
 * Bridges the D2Common DRLG port (`createDrlgActSession`, `drlgLevelInputFromSession`,
 * `buildDrlgLevelMap`) with the isometric scene builder (`buildIsoMapScene`) and
 * seed-independent `TileAtlas`, producing a self-contained `LevelView` with:
 *   - World sub-tile origin (`originX = subOriginX = coord.x * 5`, `originY = subOriginY = coord.y * 5`)
 *     and sub-tile dimensions (`width = subWidth = cellsX * 5`, `height = subHeight = cellsY * 5`)
 *   - 16-bit multi-layer sub-tile collision grid (`collision: Uint16Array`) and
 *     walkability masks (`blocked: Uint8Array`, `walkable: Uint8Array`) with void cells marked
 *     `COLLIDE_MASK_INVALID`
 *   - Isometric painter's-order draw lists (`floors`, `shadows`, `walls`, `roofs`) enriched
 *     with `TileAtlas` page/UV placements and roof heights for player-occlusion fade
 *   - Entrances, warps, preset units, landmarks, grounded walkable spawn tile (`spawnX`, `spawnY`),
 *     and room reveal state (`0x07`/`0x08`).
 */

import type { AutomapLayerData, BuildLevelAutomapOptions } from '../../common/world/d2map.ts'
import {
  COLLIDE_MASK_INVALID,
  ORTHO_CELL_HEIGHT,
  ORTHO_CELL_WIDTH,
  ORTHO_SUB_TILE_HEIGHT,
  ORTHO_SUB_TILE_WIDTH,
  buildIsoMapScene,
  type IsoDraw,
} from '../../common/world/d2map.ts'
import { DRLG_GetActNoFromLevelId } from '../../common/drlg/drlg-drlg.ts'
import {
  buildDrlgLevelMap,
  drlgLevelInputFromSession,
  type DrlgActSession,
  type DrlgEntrance,
  type DrlgLandmark,
  type DrlgLevelInput,
  type DrlgLevelMap,
  type DrlgLogicalIndexGrid,
  type DrlgMapContext,
  type DrlgPopBox,
  type DrlgSessionRoom,
  type DrlgTileInput,
  type DrlgUnitInput,
  type DrlgWarpInput,
} from '../../common/drlg/drlg-map.ts'
export type { DrlgPopBox }
import {
  DATATBLS_GetLevelDefRecord,
  DATATBLS_GetLvlPrestTxtRecord,
  objectSubClass,
} from '../../common/drlg/drlg-tables.ts'
import { getCanonicalAutomapTable } from '../../common/formats/automap-canonical-data.ts'
import type { Ds1Object } from '../../common/formats/ds1.ts'
import { isAnimatedTile, type Dt1 } from '../../common/formats/dt1.ts'
import type { SpriteFrame } from '../../common/formats/sprite.ts'
import { reportMissingArt } from '../../client/scene/world-renderer.ts'
import type { PackedTilePlacement, TileAtlas } from './tile-atlas.ts'

export interface LevelDrawItem extends IsoDraw {
  readonly dt1Path: string
  readonly placement: PackedTilePlacement | null
  readonly blockCount?: number | undefined
  readonly animatedPlacements?: readonly (PackedTilePlacement | null)[]
  /** DT1 tile header `materialFlags` (u16 at +0x06) of the drawn tile (the base tile when animated). */
  readonly materialFlags?: number | undefined
  /** DT1 tile header `direction` (`pTileGfx->nLightDirection`, i32 at +0x00) of the drawn tile. */
  readonly lightDirection?: number | undefined
}

export interface LevelRoomView {
  readonly index: number
  readonly areaId: number
  readonly tileX: number
  readonly tileY: number
  readonly tileW: number
  readonly tileH: number
  readonly localTileX: number
  readonly localTileY: number
  readonly subX: number
  readonly subY: number
  readonly subW: number
  readonly subH: number
  readonly worldSubX: number
  readonly worldSubY: number
  readonly room1InitSeed: number
  readonly revealed: boolean
}

export interface LevelView {
  /** Level ID (`1..136`), alias for `areaId` / `levelId`. */
  readonly id: number
  readonly areaId: number
  readonly levelId: number
  /** Act index (`0..4`, matching DRLG act number `0 = Act I .. 4 = Act V`). */
  readonly act: number
  readonly seed: number
  readonly difficulty: 0 | 1 | 2
  /** World sub-tile X origin (`coord.x * 5`). */
  readonly originX: number
  /** World sub-tile Y origin (`coord.y * 5`). */
  readonly originY: number
  /** Alias for `originX` (`SubTileWalkabilityGrid` compatibility). */
  readonly subOriginX: number
  /** Alias for `originY` (`SubTileWalkabilityGrid` compatibility). */
  readonly subOriginY: number
  /** Sub-tile grid width (`cellsX * 5`). */
  readonly width: number
  /** Sub-tile grid height (`cellsY * 5`). */
  readonly height: number
  /** Sub-tile grid width (`cellsX * 5`). */
  readonly subWidth: number
  /** Sub-tile grid height (`cellsY * 5`). */
  readonly subHeight: number
  /** World tile X origin (`coord.x`). */
  readonly tileOriginX: number
  /** World tile Y origin (`coord.y`). */
  readonly tileOriginY: number
  /** Level width in tiles (`coord.width`). */
  readonly tileWidth: number
  /** Level height in tiles (`coord.height`). */
  readonly tileHeight: number
  /**
   * Logical-room coord-list `nIndex` per level-local cell (`D2Common.#10916`), used for the local player's
   * position by the 1.13c wall occlusion fade (D2Client `0x6fb2ac47` -> `0x6fbc3b1c`). `-1` = no list.
   */
  readonly logicalIndex?: DrlgLogicalIndexGrid | undefined
  /**
   * Preset POPS bounding boxes (`D2DrlgMapStrc::pPopsLocation` / `pPopsIndex` / `pPopsSubIndex`) in level-local
   * cell coordinates for 1.13c `DRLGPRESET_UpdatePops` (`0x6fd5a6a0`) and `DRLGPRESET_TogglePopsVisibility` (`0x6fd5a180`).
   */
  readonly pops?: readonly DrlgPopBox[] | undefined
  /** DS1 canvas width in cells (`coord.width + 1`). */
  readonly cellsX: number
  /** DS1 canvas height in cells (`coord.height + 1`). */
  readonly cellsY: number
  /** Alias for `width` (`cellsX * 5`) for `IsoMapScene` / `LinkGrid` compatibility. */
  readonly gridWidth: number
  /** Alias for `height` (`cellsY * 5`) for `IsoMapScene` / `LinkGrid` compatibility. */
  readonly gridHeight: number
  /** Grounded walkable spawn tile X in level-local tile coordinates (`0 .. cellsX - 1`). */
  readonly spawnX: number
  /** Grounded walkable spawn tile Y in level-local tile coordinates (`0 .. cellsY - 1`). */
  readonly spawnY: number
  /** Isometric pixel X shift (`scene.originX`). */
  readonly isoOriginX: number
  /** Isometric pixel Y shift (`scene.originY`). */
  readonly isoOriginY: number
  /** Total isometric scene width in pixels. */
  readonly widthPx: number
  /** Total isometric scene height in pixels. */
  readonly heightPx: number
  /** 16-bit multi-layer collision masks (`subWidth * subHeight`, row-major). */
  readonly collision: Uint16Array
  /** Alias for `collision` (`IsoMapScene` compatibility). */
  readonly collisionMasks: Uint16Array
  /** Blocked grid (`subWidth * subHeight`, row-major, `1` = blocked, `0` = walkable). */
  readonly blocked: Uint8Array
  /** Walkable grid (`subWidth * subHeight`, row-major, `1` = walkable, `0` = blocked). */
  readonly walkable: Uint8Array
  /** Total number of walkable sub-tiles (`walkable[i] === 1`). */
  readonly walkableCellCount: number
  /** Normalized DT1 library paths in renderer order (`dt1Mask` bit order). */
  readonly dt1Names: readonly string[]
  /** Isometric floor draws in painter's order. */
  readonly floors: readonly LevelDrawItem[]
  /** Isometric shadow draws in painter's order. */
  readonly shadows: readonly LevelDrawItem[]
  /** Isometric wall draws in painter's order. */
  readonly walls: readonly LevelDrawItem[]
  /** Isometric roof draws (`wall.type === 15`) in painter's order. */
  readonly roofs: readonly LevelDrawItem[]
  /** Composited `SpriteFrame`s referenced by `frameIndex`. */
  readonly frames: readonly SpriteFrame[]
  /** DS1-encoded preset objects & monsters. */
  readonly ds1Objects: readonly Ds1Object[]
  /** Raw DRLG preset units in level-local sub-tile coordinates. */
  readonly presetUnits: readonly DrlgUnitInput[]
  /** Level entrances (seams and warps). */
  readonly entrances: readonly DrlgEntrance[]
  /** Level warp definitions. */
  readonly warps: readonly DrlgWarpInput[]
  /** Fixed monster landmarks (SuperUniques, Blood Raven). */
  readonly landmarks: readonly DrlgLandmark[]
  /** Rooms belonging to this level with reveal status. */
  readonly rooms: readonly LevelRoomView[]
  /** Optional tile animation speed from `LvlPrest.txt`. */
  readonly animSpeed?: number
  /** 4-layer automap data (`floors`, `walls`, `objects`, `extras`). */
  readonly automap: AutomapLayerData
  /** Number of missing tile references during isometric scene construction. */
  readonly missingTiles?: number
  /** Descriptions of missing tile references during isometric scene construction. */
  readonly missingRefs?: readonly string[]
}

export interface BuildLevelViewOptions {
  readonly input: DrlgLevelInput
  readonly ctx: DrlgMapContext
  readonly seed: number
  readonly difficulty?: 0 | 1 | 2
  readonly tileAtlas?: TileAtlas
  readonly rooms?: readonly DrlgSessionRoom[]
  /**
   * `'all'` (default): include all rooms in the level (deterministic full-level view).
   * `'revealed-only'`: include only rooms whose `revealed === true`.
   */
  readonly revealMode?: 'all' | 'revealed-only'
  readonly automapOptions?: Partial<Omit<BuildLevelAutomapOptions, 'levelId' | 'act' | 'seed'>>
}

export type LevelViewOptions = BuildLevelViewOptions

function filterInputByRevealedRooms(
  input: DrlgLevelInput,
  rooms: readonly DrlgSessionRoom[],
): DrlgLevelInput {
  const revealedRoomIndices = new Set<number>()
  for (const r of rooms) {
    if (r.revealed) revealedRoomIndices.add(r.index)
  }
  const tiles: DrlgTileInput[] = input.tiles.filter(t => {
    const slash1 = t.key.indexOf('/')
    const slash2 = slash1 >= 0 ? t.key.indexOf('/', slash1 + 1) : -1
    if (slash1 < 0 || slash2 < 0) return true
    const ownerLevel = Number(t.key.slice(0, slash1))
    const ownerRoom = Number(t.key.slice(slash1 + 1, slash2))
    if (ownerLevel !== input.levelId) {
      return rooms.some(
        r =>
          r.revealed &&
          t.x >= r.localTileX &&
          t.x <= r.localTileX + r.tileW &&
          t.y >= r.localTileY &&
          t.y <= r.localTileY + r.tileH,
      )
    }
    return revealedRoomIndices.has(ownerRoom)
  })
  const units: DrlgUnitInput[] = input.units.filter(u => revealedRoomIndices.has(u.room))
  const warps: DrlgWarpInput[] = input.warps.filter(w => revealedRoomIndices.has(w.room))
  return {
    ...input,
    tiles,
    units,
    warps,
  }
}

function enrichDraws(
  draws: readonly IsoDraw[],
  dt1Names: readonly string[],
  libraries: readonly Dt1[],
  tileAtlas?: TileAtlas,
): LevelDrawItem[] {
  return draws.map(draw => {
    const dt1Path = dt1Names[draw.library]
    if (!dt1Path) {
      reportMissingArt('tile', `library-${String(draw.library)}`, `Invalid draw library index ${String(draw.library)}`)
      throw new Error(
        `[LevelView] Invalid draw library index ${String(draw.library)} (dt1Names length: ${String(dt1Names.length)})`,
      )
    }
    const atlasEntry = tileAtlas?.getFrameByLibraryTile(dt1Path, draw.tile)
    const libTile = libraries[draw.library]?.tiles[draw.tile]
    const blockCount = atlasEntry?.blockCount ?? libTile?.blocks.length
    if (tileAtlas && (!atlasEntry || (!atlasEntry.placement && blockCount !== 0))) {
      reportMissingArt('tile', dt1Path, `Missing tile placement for tileIndex=${String(draw.tile)}`)
    }
    const placement = atlasEntry?.placement ?? null
    let animatedPlacements: (PackedTilePlacement | null)[] | undefined
    if (draw.animatedFrames && draw.animatedFrames.length > 1 && tileAtlas) {
      const tile = libTile
      if (tile && isAnimatedTile(tile)) {
        const candidates = tileAtlas
          .getFramesByStyleSeqType(dt1Path, tile.style, tile.sequence, tile.type)
          .filter(c => isAnimatedTile(c))
          .slice()
          .sort((a, b) => a.rarityFrameIndex - b.rarityFrameIndex || a.index - b.index)
        if (candidates.length > 1) {
          for (const c of candidates) {
            if (!c.placement && c.blockCount > 0) {
              reportMissingArt(
                'tile',
                dt1Path,
                `Missing animated tile placement for candidate tile ${String(c.index)}`,
              )
            }
          }
          animatedPlacements = candidates.map(c => c.placement)
        }
      }
    }
    const resolvedType = draw.type ?? libTile?.type
    const materialFlags = atlasEntry?.materialFlags ?? libTile?.materialFlags
    const lightDirection = atlasEntry?.direction ?? libTile?.direction
    return {
      ...draw,
      ...(resolvedType !== undefined ? { type: resolvedType } : {}),
      dt1Path,
      placement,
      ...(blockCount !== undefined ? { blockCount } : {}),
      ...(animatedPlacements !== undefined ? { animatedPlacements } : {}),
      ...(materialFlags !== undefined ? { materialFlags } : {}),
      ...(lightDirection !== undefined ? { lightDirection } : {}),
    }
  })
}

function findLargestConnectedComponent(
  subWidth: number,
  subHeight: number,
  walkable: Uint8Array,
): { readonly label: Int32Array; readonly mainComponentId: number; readonly mainComponentSize: number } {
  const total = subWidth * subHeight
  const label = new Int32Array(total).fill(-1)
  const queue = new Int32Array(total)
  let maxCompId = -1
  let maxCompSize = 0
  let nextId = 0

  for (let start = 0; start < total; start++) {
    if (walkable[start] !== 1 || label[start]! >= 0) continue
    const compId = nextId++
    let size = 0
    let head = 0
    let tail = 0
    label[start] = compId
    queue[tail++] = start
    while (head < tail) {
      const idx = queue[head++]!
      size++
      const x = idx % subWidth
      const y = Math.floor(idx / subWidth)
      if (x + 1 < subWidth) {
        const r = idx + 1
        if (walkable[r] === 1 && label[r]! < 0) {
          label[r] = compId
          queue[tail++] = r
        }
      }
      if (x > 0) {
        const l = idx - 1
        if (walkable[l] === 1 && label[l]! < 0) {
          label[l] = compId
          queue[tail++] = l
        }
      }
      if (y + 1 < subHeight) {
        const d = idx + subWidth
        if (walkable[d] === 1 && label[d]! < 0) {
          label[d] = compId
          queue[tail++] = d
        }
      }
      if (y > 0) {
        const u = idx - subWidth
        if (walkable[u] === 1 && label[u]! < 0) {
          label[u] = compId
          queue[tail++] = u
        }
      }
    }
    if (size > maxCompSize) {
      maxCompSize = size
      maxCompId = compId
    }
  }

  return { label, mainComponentId: maxCompId, mainComponentSize: maxCompSize }
}

/**
 * Ground player spawn strictly on valid DRLG entrance coordinates and walkable connected floor tiles.
 * Eliminates sub-tile centroid and geometric center fallbacks.
 */
function resolveGroundedSpawnTile(
  cellsX: number,
  cellsY: number,
  subWidth: number,
  subHeight: number,
  walkable: Uint8Array,
  entrances: readonly DrlgEntrance[],
): { readonly spawnX: number; readonly spawnY: number } {
  const { label, mainComponentId } = findLargestConnectedComponent(subWidth, subHeight, walkable)

  const isTileOnConnectedFloor = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= cellsX || ty >= cellsY) return false
    for (let dy = 0; dy < 5; dy++) {
      const sy = ty * 5 + dy
      if (sy >= subHeight) continue
      for (let dx = 0; dx < 5; dx++) {
        const sx = tx * 5 + dx
        if (sx >= subWidth) continue
        const idx = sy * subWidth + sx
        if (walkable[idx] === 1 && (mainComponentId < 0 || label[idx] === mainComponentId)) {
          return true
        }
      }
    }
    return false
  }

  const isTileWalkable = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= cellsX || ty >= cellsY) return false
    for (let dy = 0; dy < 5; dy++) {
      const sy = ty * 5 + dy
      if (sy >= subHeight) continue
      for (let dx = 0; dx < 5; dx++) {
        const sx = tx * 5 + dx
        if (sx >= subWidth) continue
        if (walkable[sy * subWidth + sx] === 1) return true
      }
    }
    return false
  }

  // 1. Prioritize DRLG entrances landing on the main connected walkable floor
  for (const ent of entrances) {
    if (isTileOnConnectedFloor(ent.interiorX, ent.interiorY)) {
      return { spawnX: ent.interiorX, spawnY: ent.interiorY }
    }
    if (isTileOnConnectedFloor(ent.x, ent.y)) {
      return { spawnX: ent.x, spawnY: ent.y }
    }
  }

  // 2. Fall back to any entrance with a walkable sub-tile
  for (const ent of entrances) {
    if (isTileWalkable(ent.interiorX, ent.interiorY)) {
      return { spawnX: ent.interiorX, spawnY: ent.interiorY }
    }
    if (isTileWalkable(ent.x, ent.y)) {
      return { spawnX: ent.x, spawnY: ent.y }
    }
  }

  // 3. Ground strictly on the first tile belonging to the main connected walkable floor
  if (mainComponentId >= 0) {
    for (let ty = 0; ty < cellsY; ty++) {
      for (let tx = 0; tx < cellsX; tx++) {
        if (isTileOnConnectedFloor(tx, ty)) {
          return { spawnX: tx, spawnY: ty }
        }
      }
    }
  }

  // 4. In unrevealed views (walkableCellCount === 0), fall back to primary DRLG entrance coordinates
  let walkableCount = 0
  for (let i = 0; i < walkable.length; i++) {
    if (walkable[i] === 1) walkableCount++
  }
  if (walkableCount === 0) {
    if (entrances.length > 0 && entrances[0]) {
      return { spawnX: entrances[0].interiorX, spawnY: entrances[0].interiorY }
    }
    return { spawnX: 0, spawnY: 0 }
  }

  // Fail-fast: no connected walkable floor exists
  throw new Error(
    `[LevelView] Failed to resolve grounded spawn: no valid walkable connected floor tiles in ${String(cellsX)}x${String(cellsY)} level grid`,
  )
}

/**
 * Build a complete {@link LevelView} from a {@link DrlgLevelInput} and {@link DrlgMapContext}.
 */
export function buildLevelView(options: BuildLevelViewOptions): LevelView {
  const {
    input: rawInput,
    ctx,
    seed,
    difficulty = 0,
    tileAtlas,
    rooms = [],
    revealMode = 'all',
    automapOptions,
  } = options

  const activeInput =
    revealMode === 'revealed-only' && rooms.length > 0
      ? filterInputByRevealedRooms(rawInput, rooms)
      : rawInput

  const map: DrlgLevelMap = buildDrlgLevelMap(activeInput, ctx)
  const libraries: Dt1[] = map.dt1Names.map(name => {
    const lib = ctx.dt1.get(name)
    if (lib === undefined) {
      throw new Error(`buildLevelView(level ${String(map.levelId)}): missing DT1 library ${name}`)
    }
    return lib
  })

  const actNo = DRLG_GetActNoFromLevelId(map.levelId)
  const levelDef = DATATBLS_GetLevelDefRecord(ctx.tables, map.levelId)
  const scene = buildIsoMapScene(map.ds1, libraries, seed, {
    automapTable: automapOptions?.automapTable ?? getCanonicalAutomapTable(),
    layerId: automapOptions?.layerId ?? levelDef.dwLayer,
    levelTypeId: automapOptions?.levelTypeId ?? levelDef.dwLevelType,
    ...automapOptions,
    levelId: map.levelId,
    act: actNo + 1,
    seed,
  })
  if (!scene.automap) {
    throw new Error(`buildLevelView(level ${String(map.levelId)}): missing automap layer data`)
  }

  if (scene.missingTiles > 0) {
    for (const ref of scene.missingRefs) {
      reportMissingArt('tile', `level-${String(map.levelId)}`, ref)
    }
    if (scene.missingRefs.length === 0) {
      reportMissingArt(
        'tile',
        `level-${String(map.levelId)}`,
        `Missing ${String(scene.missingTiles)} tiles in level ${String(map.levelId)}`,
      )
    }
  }

  const collision = new Uint16Array(scene.collisionMasks)
  const blocked = new Uint8Array(scene.blocked)

  // If revealMode is 'revealed-only', ensure any sub-tile outside revealed rooms is marked blocked + COLLIDE_MASK_INVALID
  if (revealMode === 'revealed-only' && rooms.length > 0) {
    const insideRevealed = new Uint8Array(scene.gridWidth * scene.gridHeight)
    for (const r of rooms) {
      if (!r.revealed) continue
      const x0 = Math.max(0, r.subX)
      const y0 = Math.max(0, r.subY)
      const x1 = Math.min(scene.gridWidth, r.subX + r.subW)
      const y1 = Math.min(scene.gridHeight, r.subY + r.subH)
      for (let sy = y0; sy < y1; sy += 1) {
        insideRevealed.fill(1, sy * scene.gridWidth + x0, sy * scene.gridWidth + x1)
      }
    }
    for (let i = 0; i < insideRevealed.length; i += 1) {
      if (insideRevealed[i] === 0) {
        blocked[i] = 1
        collision[i] = (collision[i] ?? 0) | COLLIDE_MASK_INVALID
      }
    }
  }

  const walkable = new Uint8Array(blocked.length)
  let walkableCellCount = 0
  for (let i = 0; i < blocked.length; i += 1) {
    if (blocked[i] === 0) {
      walkable[i] = 1
      walkableCellCount += 1
    }
  }

  const { spawnX, spawnY } = resolveGroundedSpawnTile(
    scene.cellsX,
    scene.cellsY,
    scene.gridWidth,
    scene.gridHeight,
    walkable,
    map.entrances,
  )

  const roomViews: LevelRoomView[] = rooms.map(r => ({
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
    revealed: revealMode === 'all' ? true : r.revealed,
  }))

  const originX = map.coord.x * 5
  const originY = map.coord.y * 5
  const subWidth = scene.gridWidth
  const subHeight = scene.gridHeight

  return {
    id: map.levelId,
    areaId: map.levelId,
    levelId: map.levelId,
    act: actNo,
    seed: seed >>> 0,
    difficulty,
    originX,
    originY,
    subOriginX: originX,
    subOriginY: originY,
    width: scene.cellsX,
    height: scene.cellsY,
    subWidth,
    subHeight,
    tileOriginX: map.coord.x,
    tileOriginY: map.coord.y,
    tileWidth: map.coord.width,
    tileHeight: map.coord.height,
    ...(map.logicalIndex !== undefined ? { logicalIndex: map.logicalIndex } : {}),
    ...(map.pops !== undefined ? { pops: map.pops } : {}),
    cellsX: scene.cellsX,
    cellsY: scene.cellsY,
    gridWidth: subWidth,
    gridHeight: subHeight,
    spawnX,
    spawnY,
    isoOriginX: scene.originX,
    isoOriginY: scene.originY,
    widthPx: scene.widthPx,
    heightPx: scene.heightPx,
    collision,
    collisionMasks: collision,
    blocked,
    walkable,
    walkableCellCount,
    dt1Names: map.dt1Names,
    floors: enrichDraws(scene.floors, map.dt1Names, libraries, tileAtlas),
    shadows: enrichDraws(scene.shadows, map.dt1Names, libraries, tileAtlas),
    walls: enrichDraws(scene.walls, map.dt1Names, libraries, tileAtlas),
    roofs: enrichDraws(scene.roofs, map.dt1Names, libraries, tileAtlas),
    frames: scene.frames,
    ds1Objects: map.ds1.objects,
    presetUnits: activeInput.units,
    entrances: map.entrances,
    warps: activeInput.warps,
    landmarks: map.landmarks,
    rooms: roomViews,
    missingTiles: scene.missingTiles,
    missingRefs: scene.missingRefs,
    ...(map.animSpeed !== undefined ? { animSpeed: map.animSpeed } : {}),
    automap: scene.automap,
  }
}

/**
 * Build a {@link LevelView} directly from an active {@link DrlgActSession}.
 */
export function buildLevelViewFromSession(
  session: DrlgActSession,
  areaId: number,
  ctx: DrlgMapContext,
  options: {
    readonly tileAtlas?: TileAtlas
    readonly revealMode?: 'all' | 'revealed-only'
    readonly automapOptions?: Partial<Omit<BuildLevelAutomapOptions, 'levelId' | 'act' | 'seed'>>
  } = {},
): LevelView {
  const input = drlgLevelInputFromSession(session, areaId, ctx.tables)
  const rooms = session.getAllLevelRooms(areaId)
  const difficulty = (session.difficulty === 1 || session.difficulty === 2 ? session.difficulty : 0) as 0 | 1 | 2
  const act = DRLG_GetActNoFromLevelId(areaId)
  const dump = session.getDump(act)
  const actLevel = dump.act.find(a => a.id === areaId)
  let ds1Name: string | undefined = actLevel?.preset?.map?.file || undefined
  if (!ds1Name) {
    const dumpLevel = dump.levels.find(l => l.id === areaId)
    for (const room of dumpLevel?.rooms ?? []) {
      if (room.preset && room.preset.prest > 0) {
        const prest = DATATBLS_GetLvlPrestTxtRecord(ctx.tables, room.preset.prest)
        ds1Name = prest.szFile[room.preset.picked] || prest.szFile[0] || undefined
        if (ds1Name) break
      }
    }
  }
  const automapOptions =
    ds1Name !== undefined || options.automapOptions !== undefined
      ? {
          ...(ds1Name !== undefined ? { ds1Name } : {}),
          ...options.automapOptions,
        }
      : undefined
  return buildLevelView({
    input,
    ctx,
    seed: session.seed,
    difficulty,
    rooms,
    ...(options.tileAtlas !== undefined ? { tileAtlas: options.tileAtlas } : {}),
    ...(options.revealMode !== undefined ? { revealMode: options.revealMode } : {}),
    ...(automapOptions !== undefined ? { automapOptions } : {}),
  })
}

/** Convert world sub-tile coordinates `(worldSubX, worldSubY)` to level-local sub-tile coordinates. */
export function worldToLocalSubTile(
  view: { readonly originX?: number; readonly originY?: number; readonly subOriginX?: number; readonly subOriginY?: number },
  worldSubX: number,
  worldSubY: number,
): { readonly x: number; readonly y: number; readonly localSubX: number; readonly localSubY: number } {
  const ox = view.subOriginX ?? view.originX ?? 0
  const oy = view.subOriginY ?? view.originY ?? 0
  const localSubX = worldSubX - ox
  const localSubY = worldSubY - oy
  return {
    x: localSubX,
    y: localSubY,
    localSubX,
    localSubY,
  }
}

/** Convert level-local sub-tile coordinates `(localSubX, localSubY)` to world sub-tile coordinates. */
export function localToWorldSubTile(
  view: { readonly originX?: number; readonly originY?: number; readonly subOriginX?: number; readonly subOriginY?: number },
  localSubX: number,
  localSubY: number,
): { readonly x: number; readonly y: number; readonly worldSubX: number; readonly worldSubY: number } {
  const ox = view.subOriginX ?? view.originX ?? 0
  const oy = view.subOriginY ?? view.originY ?? 0
  const worldSubX = ox + localSubX
  const worldSubY = oy + localSubY
  return {
    x: worldSubX,
    y: worldSubY,
    worldSubX,
    worldSubY,
  }
}

/** Convert level-local sub-tile coordinates `(localSubX, localSubY)` to isometric scene pixel coordinates. */
export function localSubTileToOrtho(
  viewOrX: Pick<LevelView, 'isoOriginX' | 'isoOriginY'> | number,
  localSubXOrY: number,
  maybeLocalSubY?: number,
): { readonly x: number; readonly y: number; readonly orthoX: number; readonly orthoY: number } {
  const isoOriginX = typeof viewOrX === 'number' ? 0 : viewOrX.isoOriginX
  const isoOriginY = typeof viewOrX === 'number' ? 0 : viewOrX.isoOriginY
  const localSubX = typeof viewOrX === 'number' ? viewOrX : localSubXOrY
  const localSubY = typeof viewOrX === 'number' ? localSubXOrY : (maybeLocalSubY ?? 0)
  const orthoX = (localSubX - localSubY) * ORTHO_SUB_TILE_WIDTH + isoOriginX
  const orthoY = (localSubX + localSubY) * ORTHO_SUB_TILE_HEIGHT + isoOriginY
  return {
    x: orthoX,
    y: orthoY,
    orthoX,
    orthoY,
  }
}

/** Convert isometric scene pixel coordinates `(orthoX, orthoY)` to fractional level-local sub-tile coordinates. */
export function orthoToLocalSubTile(
  viewOrOrthoX: Pick<LevelView, 'isoOriginX' | 'isoOriginY'> | number,
  orthoXOrY: number,
  maybeOrthoY?: number,
): { readonly x: number; readonly y: number; readonly localSubX: number; readonly localSubY: number } {
  const isoOriginX = typeof viewOrOrthoX === 'number' ? 0 : viewOrOrthoX.isoOriginX
  const isoOriginY = typeof viewOrOrthoX === 'number' ? 0 : viewOrOrthoX.isoOriginY
  const orthoX = typeof viewOrOrthoX === 'number' ? viewOrOrthoX : orthoXOrY
  const orthoY = typeof viewOrOrthoX === 'number' ? orthoXOrY : (maybeOrthoY ?? 0)
  const dx = (orthoX - isoOriginX) / ORTHO_SUB_TILE_WIDTH
  const dy = (orthoY - isoOriginY) / ORTHO_SUB_TILE_HEIGHT
  const localSubX = (dx + dy) * 0.5
  const localSubY = (dy - dx) * 0.5
  return {
    x: localSubX,
    y: localSubY,
    localSubX,
    localSubY,
  }
}

/** Check whether a level-local sub-tile `(localSubX, localSubY)` is walkable (`blocked === 0`). */
export function isWalkableLocalSubTile(
  view: { readonly subWidth?: number; readonly subHeight?: number; readonly gridWidth?: number; readonly gridHeight?: number; readonly blocked: Uint8Array },
  localSubX: number,
  localSubY: number,
): boolean {
  const sw = view.subWidth ?? view.gridWidth ?? 0
  const sh = view.subHeight ?? view.gridHeight ?? 0
  const sx = Math.floor(localSubX)
  const sy = Math.floor(localSubY)
  if (sx < 0 || sx >= sw || sy < 0 || sy >= sh) return false
  return view.blocked[sy * sw + sx] === 0
}

/** Check whether a world sub-tile `(worldSubX, worldSubY)` is walkable (`blocked === 0`). */
export function isWalkableWorldSubTile(
  view: {
    readonly originX?: number
    readonly originY?: number
    readonly subOriginX?: number
    readonly subOriginY?: number
    readonly subWidth?: number
    readonly subHeight?: number
    readonly gridWidth?: number
    readonly gridHeight?: number
    readonly blocked: Uint8Array
  },
  worldSubX: number,
  worldSubY: number,
): boolean {
  const ox = view.subOriginX ?? view.originX ?? 0
  const oy = view.subOriginY ?? view.originY ?? 0
  return isWalkableLocalSubTile(view, worldSubX - ox, worldSubY - oy)
}

/** Read the 16-bit collision mask at a level-local sub-tile `(localSubX, localSubY)`. */
export function getCollisionLocalSubTile(
  view: { readonly subWidth?: number; readonly subHeight?: number; readonly gridWidth?: number; readonly gridHeight?: number; readonly collision: Uint16Array },
  localSubX: number,
  localSubY: number,
): number {
  const sw = view.subWidth ?? view.gridWidth ?? 0
  const sh = view.subHeight ?? view.gridHeight ?? 0
  const sx = Math.floor(localSubX)
  const sy = Math.floor(localSubY)
  if (sx < 0 || sx >= sw || sy < 0 || sy >= sh) return COLLIDE_MASK_INVALID
  return view.collision[sy * sw + sx] ?? COLLIDE_MASK_INVALID
}

/** Read the 16-bit collision mask at a world sub-tile `(worldSubX, worldSubY)`. */
export function getCollisionWorldSubTile(
  view: {
    readonly originX?: number
    readonly originY?: number
    readonly subOriginX?: number
    readonly subOriginY?: number
    readonly subWidth?: number
    readonly subHeight?: number
    readonly gridWidth?: number
    readonly gridHeight?: number
    readonly collision: Uint16Array
  },
  worldSubX: number,
  worldSubY: number,
): number {
  const ox = view.subOriginX ?? view.originX ?? 0
  const oy = view.subOriginY ?? view.originY ?? 0
  return getCollisionLocalSubTile(view, worldSubX - ox, worldSubY - oy)
}
