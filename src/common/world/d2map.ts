/**
 * Diablo II's own map projection: a DS1 level plus the DT1 libraries it
 * references, composited into something renderable and walkable.
 *
 * This is deliberately *not* `map.ts`. That module places one library on a
 * rectangular grid, which is what the synthetic fixtures look like. Real Diablo
 * II levels use an isometric lattice, and the difference is not cosmetic:
 *
 * 1. **Cells are diamonds.** A cell at `(cx, cy)` sits at
 *    `((cx - cy) * 80, (cx + cy) * 40)` — the projection OpenDiablo2's viewport
 *    calls `WorldToOrtho`. The 5×5 collision grid inside a cell is therefore
 *    16×8 per sub-tile, not 32×32.
 * 2. **A DS1 cell's `style` picks the library, not the tile.** Style indexes the
 *    level type's `File 1..File 32` list (`LvlTypes.txt`), and each DT1 in that
 *    list numbers its own tiles by `sequence` — so a lookup keyed on
 *    `style:sequence` inside one merged library (what `map.ts` does) finds
 *    nothing as soon as a level uses more than one library.
 * 3. **Empty slots are explicit.** A cell carries a fixed number of wall slots
 *    and most of them are placeholders: in Act 1's town, 4275 of 4674 wall
 *    entries have `prop1 == 0`. Drawing them paints garbage, which is why the
 *    reference renderer tests `prop1 != 0`.
 * 4. **Walls hang above their cell.** A wall's art starts at a negative block
 *    `y` and is shifted down by `-minBlockY` when decoded, so it must be drawn
 *    at `cell + minBlockY + 80`; floors ignore that term entirely.
 */
import type { Ds1 } from '../formats/ds1.ts'
import type { Dt1, Dt1Tile } from '../formats/dt1.ts'
import { isAnimatedTile } from '../formats/dt1.ts'
import type { SpriteFrame, SpriteSheet } from '../formats/sprite.ts'
import {
  computeAutomapObjectPixelCoords,
  computeAutomapTilePixelCoords,
  deduplicateAutomapCells,
  generateTownSavedExtras,
  getAutomapCellWeight,
  getAutomapLevelTypeId,
  resolveMonsterAutomapCellId,
  resolveObjectAutomapCellId,
  resolveTileAutomapCellId,
  type AutomapCell,
  type AutomapLayerData,
  type AutomapTable,
} from '../formats/automap-table.ts'
import {
  CANONICAL_MON_PRESET_HCIDX_BY_ACT,
  CANONICAL_MONSTER_AUTOMAP_BY_HCIDX,
  CANONICAL_OBJECT_AUTOMAP_BY_ID,
  getCanonicalAutomapTable,
} from '../formats/automap-canonical-data.ts'
import { cell } from './acts.ts'
import { lookupObject } from '../units/object-lookup.ts'
import { getMonsterRowByHcIdx, resolveDs1Object, type MonstersTable, type ObjectsTable } from '../units/objects.ts'
import { SUB_TILES_PER_TILE } from './map.ts'

export type { AutomapCell, AutomapLayerData }

/** Cell width in screen pixels (the isometric diamond's width). */
export const ORTHO_CELL_WIDTH = 80
/** Cell height in screen pixels (half the diamond's width: a 2:1 projection). */
export const ORTHO_CELL_HEIGHT = 40
/** Sub-tile width in screen pixels. */
export const ORTHO_SUB_TILE_WIDTH = ORTHO_CELL_WIDTH / SUB_TILES_PER_TILE
/** Sub-tile height in screen pixels. */
export const ORTHO_SUB_TILE_HEIGHT = ORTHO_CELL_HEIGHT / SUB_TILES_PER_TILE
/** Horizontal shift applied to every tile bitmap (half a cell). */
const TILE_ANCHOR_X = -80
/** Vertical shift added to walls: the tail of `YAdjust = minBlockY + 80`. */
const WALL_SURFACE_HEIGHT = 80
/**
 * DT1 `type` of a shadow tile.
 *
 * The engine asks for the shadow art with this type (`d2maprenderer/renderer.go`
 * `getImageCacheRecord(style, sequence, 13, ...)`), so a DS1 shadow layer's
 * reference is resolved against type 13 tiles, not against floors or walls.
 */
const SHADOW_TILE_TYPE = 13
/**
 * DT1 `type` of a floor tile.
 *
 * DS1 floor records carry no type field; the engine resolves them as DT1 type 0
 * (`d2mapstamp/stamp.go` asks for `TileData(style, sequence, 0)`), and it is the
 * only type a floor slot may draw.
 */
const FLOOR_TILE_TYPE = 0
/**
 * DS1 wall type of a roof tile.
 *
 * OpenDiablo2's tile-type enum puts `TileRoof` at 15 (`d2enum/tile.go`), and the
 * engine draws roofs in a pass of their own, last of all, with a different
 * vertical offset: `YAdjust = -roofHeight` instead of `minBlockY + 80`
 * (`d2maprenderer/tile_cache.go`). A roof therefore has to stay out of the wall
 * painter order and out of the wall offset rule.
 */
const ROOF_WALL_TYPE = 15
/**
 * DS1 wall types of the two halves of a "top" (north) corner.
 *
 * The engine never draws the right half alone: `DRLGROOMTILE_InitWallTileData`
 * (`D2Common/DRLG/RoomTile.cpp`) adds a `TILETYPE_WALL_TOP_CORNER_RIGHT` wall and
 * then, in the same cell and with the same packed tile information, a second
 * `TILETYPE_WALL_TOP_CORNER_LEFT` tile — fetched from the tile cache with the same
 * style/sequence. Without that companion the corner is missing its left face, which
 * is what a "broken corner block" looks like on screen.
 */
const TOP_CORNER_RIGHT_TYPE = 3
/** The companion half of {@link TOP_CORNER_RIGHT_TYPE}. */
const TOP_CORNER_LEFT_TYPE = 4
/** DS1 wall type for left-facing door wall (`TILETYPE_WALL_LEFT_DOOR`). */
const LEFT_DOOR_WALL_TYPE = 8
/** DS1 wall type for right-facing door wall (`TILETYPE_WALL_RIGHT_DOOR`). */
const RIGHT_DOOR_WALL_TYPE = 9
/** DT1/DS1 wall type of the first lower ("down") wall orientation (`TILETYPE_LEFT_WALL_DOWN`). */
export const LOWER_WALL_FIRST_TYPE = 16
/** DT1/DS1 wall type of the last lower ("down") wall orientation (`TILETYPE_FRONT_WALL_DOWN`). */
export const LOWER_WALL_LAST_TYPE = 19

/**
 * True when a DT1/DS1 wall orientation `type` is a lower ("down") wall: `16..19`
 * (`TILETYPE_LEFT_WALL_DOWN`, `_RIGHT_WALL_DOWN`, `_FULL_WALL_DOWN`, `_FRONT_WALL_DOWN`).
 *
 * D2Client 1.13c `0x6fb2a72e` routes a room wall tile by `nTileType` alone: `15` goes to the roof list
 * (`0x6fb29d30`, cell `+0x1c`), `16..19` to the lower-wall list (`0x6fb29e20`, cell `+0x20`), and every
 * other type — including the exit walls `10` / `11` — to the upper-wall list (`0x6fb2a340`). The frame
 * callback `0x6fb3b110` paints the lower-wall list (`0x6fb4ec10`) *before* the floor pass (`0x6fac4050`),
 * so a lower wall only shows where no floor covers it (cliff faces seen through a chasm).
 */
export function isLowerWallType(type: number | undefined): boolean {
  return type !== undefined && type >= LOWER_WALL_FIRST_TYPE && type <= LOWER_WALL_LAST_TYPE
}

/**
 * Blizzard D2 1.13c 16-bit Multi-Layer Collision Mask Flags (`D2C_CollisionMaskFlags`).
 * Reference: D2Common.dll (v1.13c) / D2MOO `include/D2Collision.h`.
 */
export const COLLIDE_NONE = 0x0000
/** 'black space' in arcane sanctuary, cliff walls, water/river walk barriers. Blocks ground walking. */
export const COLLIDE_WALL = 0x0001
/** Tile-based solid obstacles that block line of sight (LoS) and ranged targeting. */
export const COLLIDE_VISIBLE = 0x0002
/** Obstacles that block flying projectiles / missiles and leap/teleport barriers. */
export const COLLIDE_MISSILE_BARRIER = 0x0004
/** Blocks player movement specifically (but not necessarily monsters). */
export const COLLIDE_NOPLAYER = 0x0008
/** Preset floor/tile flag. */
export const COLLIDE_PRESET = 0x0010
/** Returned if the sub-tile is out-of-bounds / invalid. */
export const COLLIDE_BLANK = 0x0020
/** Occupied by an active missile. */
export const COLLIDE_MISSILE = 0x0040
/** Occupied by a player unit. */
export const COLLIDE_PLAYER = 0x0080
/** Water / river terrain flag. */
export const COLLIDE_WATER = 0x00c0
/** Occupied by a monster unit. */
export const COLLIDE_MONSTER = 0x0100
/** Occupied by a ground item. */
export const COLLIDE_ITEM = 0x0200
/** Solid object (shrine, chest, barrel, obstacle). */
export const COLLIDE_OBJECT = 0x0400
/** Closed door barrier (can be cleared via `collisionResetMask` when opened). */
export const COLLIDE_DOOR = 0x0800
/** Unit / pathing restriction flag. */
export const COLLIDE_NO_PATH = 0x1000
/** Attackable pet / summon presence. */
export const COLLIDE_PET = 0x2000
export const COLLIDE_4000 = 0x4000
/** Dead monster corpse / portal flag. */
export const COLLIDE_CORPSE = 0x8000
export const COLLIDE_ALL_MASK = 0xffff

/** Composite mask for invalid sub-tiles (`D2Collision.h`). */
export const COLLIDE_MASK_INVALID =
  COLLIDE_BLANK | COLLIDE_MISSILE_BARRIER | COLLIDE_VISIBLE | COLLIDE_WALL
/** Composite mask for player ground pathfinding (`COLLIDE_MASK_PLAYER_PATH`). */
export const COLLIDE_MASK_PLAYER_PATH =
  COLLIDE_WALL | COLLIDE_NOPLAYER | COLLIDE_OBJECT | COLLIDE_DOOR | COLLIDE_NO_PATH
/** Composite mask for flying skills / leap (`COLLIDE_MASK_PLAYER_FLYING`). */
export const COLLIDE_MASK_PLAYER_FLYING =
  COLLIDE_DOOR | COLLIDE_MISSILE_BARRIER
/** Composite mask for Whirlwind (`COLLIDE_MASK_PLAYER_WW`). */
export const COLLIDE_MASK_PLAYER_WW =
  COLLIDE_WALL | COLLIDE_OBJECT | COLLIDE_DOOR
/** Composite mask for projectiles / missiles (arrows, bolts, spells: 0x0804). */
export const COLLIDE_MASK_MISSILE =
  COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR
/** Composite mask for Line-of-Sight (LoS) raycasting. */
export const COLLIDE_MASK_LOS =
  COLLIDE_VISIBLE | COLLIDE_DOOR
/** Composite mask for drop spawning placement (D2Common COLLISION_GetFreeCoordinatesImpl: 0x3E01). */
export const COLLIDE_MASK_SPAWN =
  COLLIDE_WALL | COLLIDE_ITEM | COLLIDE_OBJECT | COLLIDE_DOOR | COLLIDE_NO_PATH | COLLIDE_PET
/** Composite mask for drop spawning Line-of-Sight raycast (nFieldMask = 0x0801). */
export const COLLIDE_MASK_SPAWN_LOS =
  COLLIDE_WALL | COLLIDE_DOOR

/** Result of a 1.13c sub-tile `COLLISION_RayTrace` check. */
export interface RayTraceResult {
  /** True if the ray struck a sub-tile matching the collision mask before reaching the target. */
  readonly hit: boolean
  /** Sub-tile X where the ray terminated (either the hit sub-tile or the target sub-tile). */
  readonly hitSubX: number
  /** Sub-tile Y where the ray terminated (either the hit sub-tile or the target sub-tile). */
  readonly hitSubY: number
  /** Scene-space X corresponding to `hitSubX` / `hitSubY`. */
  readonly hitX: number
  /** Scene-space Y corresponding to `hitSubX` / `hitSubY`. */
  readonly hitY: number
  /** Number of sub-tile steps traversed along the ray. */
  readonly steps: number
}

/** One tile to draw, in screen pixels. */
export interface IsoDraw {
  /** Index into {@link IsoMapScene.frames}. */
  readonly frameIndex: number
  /**
   * Sequence of frame indices for animated tiles (e.g. water ripples, torches, fountains, lava).
   *
   * When present and containing more than 1 frame, the tile is animated and
   * the renderer can cycle through these frame indices over time or game ticks.
   */
  readonly animatedFrames?: readonly number[] | undefined
  /** Screen x of the bitmap's left edge, origin applied. */
  readonly x: number
  /** Screen y of the bitmap's top edge, origin applied. */
  readonly y: number
  /** Cell coordinates, for depth sorting and entity insertion. */
  readonly cellX: number
  readonly cellY: number
  /** Library index this tile came from, for diagnostics. */
  readonly library: number
  /** The library's tile index, for diagnostics. */
  readonly tile: number
  /** DT1/DS1 tile orientation type (`0` = floor, `1..12, 14` = upper wall, `13` = shadow, `15` = roof, `16..19` = lower wall). */
  readonly type?: number | undefined
  /** DT1 tile `style` index (`D2CMP_10081_GetTileStyle`), matched against `pPopsSubIndex` by `0x6fd5a180`. */
  readonly style?: number | undefined
  /** True when this wall draw is a lower ("down") wall (`16..19`, see {@link isLowerWallType}). */
  readonly isLowerWall?: boolean | undefined
  /** Roof elevation height from DT1 tile record, if this is a roof tile. */
  readonly roofHeight?: number
  /**
   * The wall's logical-room coord list (`D2DrlgTileDataStrc::unk0x10`, set by `DRLGLOGIC_SetCoordListForTiles`):
   * its `nIndex` and the level-local `pBox[0].nPosX/nPosY`. Absent when `unk0x10` is NULL (rooms whose
   * logical info carries `DRLGLOGIC_ROOMINFO_HAS_COORD_LIST`, e.g. outdoor rooms) — such walls never fade.
   */
  readonly fadeBox?: WallFadeBox | undefined
  /** `dwFlags & MAPTILE_TREES (0x4)`: D2Client `0x6fb2a3a7` skips the occlusion-fade test for this wall. */
  readonly noFade?: boolean | undefined
  /**
   * `dwFlags & MAPTILE_UNK_0x200 (0x200)` (`bRevealHidden`): cutaway interior wall cap that starts hidden
   * (`MAPTILE_HIDDEN`, no collision) and is revealed while an enclosing POPS box is active (`0x6fd5a180`).
   */
  readonly revealHidden?: boolean | undefined
  /**
   * `dwFlags & MAPTILE_FLOOR_LINKER_PATH (0x100)` (`bLinkage`): exempts the wall/roof from POPS style-matching
   * fade (`0x6fd5a25b: test ah, 1`).
   */
  readonly popLinkage?: boolean | undefined
}

/** The fields of a wall's `D2RoomCoordListStrc` that the 1.13c occlusion fade (`0x6fb29f20`) reads. */
export interface WallFadeBox {
  /** `D2RoomCoordListStrc::nIndex` (`+0x28`). */
  readonly index: number
  /** `pBox[0].nPosX` (`+0x00`), level-local tile X. */
  readonly x: number
  /** `pBox[0].nPosY` (`+0x04`), level-local tile Y. */
  readonly y: number
}

/** A renderable, walkable Diablo II level. */
export interface IsoMapScene {
  /** One frame per distinct tile this level actually uses. */
  readonly frames: readonly SpriteFrame[]
  /** The same frames as a sheet, ready for the atlas packer. */
  readonly sheet: SpriteSheet
  /** Cells horizontally. */
  readonly cellsX: number
  /** Cells vertically. */
  readonly cellsY: number
  /** Scene width in pixels, origin applied. */
  readonly widthPx: number
  /** Scene height in pixels, origin applied. */
  readonly heightPx: number
  /** Screen x added to every coordinate so the minimum is 0. */
  readonly originX: number
  /** Screen y added to every coordinate so the minimum is 0. */
  readonly originY: number
  /** Floor draws, in cell order. */
  readonly floors: readonly IsoDraw[]
  /** Shadow draws, in cell order (type 13, rendered after floors and before walls). */
  readonly shadows: readonly IsoDraw[]
  /** Wall draws, in painter's order (isometric depth). */
  readonly walls: readonly IsoDraw[]
  /** Lower ("down") wall draws (`type 16..19`), painted before the floors (D2Client `0x6fb4ec10`). */
  readonly lowerWalls: readonly IsoDraw[]
  /** Upper wall draws (every wall type except `15` and `16..19`), interleaved with entities by `sortY`. */
  readonly upperWalls: readonly IsoDraw[]
  /**
   * Roof draws, in painter's order.
   *
   * The engine paints roofs in a pass of their own, after everything else
   * (`d2maprenderer/renderer.go` pass 4), so they must not be mixed into
   * {@link IsoMapScene.walls}: a roof covers the floor, the walls *and* whatever
   * walks under it.
   */
  readonly roofs: readonly IsoDraw[]
  /** Collision grid, row-major, 1 = blocked, 5×5 per cell. */
  readonly blocked: Uint8Array
  /**
   * 16-bit multi-layer collision masks per sub-tile (`D2C_CollisionMaskFlags`).
   * Row-major, 5×5 per cell (`gridWidth * gridHeight`).
   */
  readonly collisionMasks: Uint16Array
  /** Collision grid width in sub-tiles. */
  readonly gridWidth: number
  /** Collision grid height in sub-tiles. */
  readonly gridHeight: number
  /** References that resolved to no tile (missing library or sequence). */
  readonly missingTiles: number
  /**
   * The unresolved references themselves, capped for display.
   *
   * Diablo II's DS1 files contain a few slots that reference nothing in any
   * library — Act 2's town has one wall at `style 30`, a style no Act 2 library
   * defines. The game draws nothing for those, so the count is reported rather
   * than treated as a decoding failure; a real chain break shows up as hundreds
   * of them, which is why the caller can still threshold on the count.
   */
  readonly missingRefs: readonly string[]
  /**
   * Wall references whose art needed a taller bitmap than the tile's declared
   * height (an expected quirk of real libraries, not an error).
   */
  readonly clippedTiles: number
  /** References that several libraries could satisfy (first library wins). */
  readonly duplicateRefs: number
  /**
   * Sub-tiles that became blocked **only** because a shadow layer blocked them.
   *
   * The engine unions the sub-tile flags of every layer of a cell before reading
   * walkability, and shadows are a layer of their own (`type 13`). If this is ever
   * non-zero, dropping shadows from the union would have changed the map.
   */
  readonly shadowBlockedSubtiles: number
  /**
   * References that only the type-agnostic fallback could satisfy.
   *
   * Should be 0: a non-zero value means a reference drew a tile of the wrong
   * *type* (a wall where a floor belongs), which is exactly the defect
   * `npm run verify:tiles` exists to catch.
   */
  readonly looseRefs: number
  /**
   * Top-corner-right walls that got their left half drawn as well.
   *
   * The engine always adds the companion tile (`DRLGROOMTILE_InitWallTileData`), so
   * this should equal the number of type-3 walls in the level.
   */
  readonly cornerPairs: number
  /** Top-corner-right walls whose left half could not be resolved (should be 0). */
  readonly missingCornerPairs: number
  /** Number of animated tiles in this scene. */
  readonly animatedTileCount?: number | undefined
  /** Pre-computed 4-layer automap data (floors, walls, objects, extras) when automap options are provided. */
  readonly automap?: AutomapLayerData | undefined
}

/**
 * Composite a library tile's blocks into one indexed bitmap.
 *
 * The bitmap is the size Diablo II allocates for the tile: `width` by
 * `|height|`. Blocks were already shifted into that box by the decoder.
 *
 * @param tile - the library tile.
 * @returns the frame.
 */
function tileToFrame(tile: Dt1Tile): SpriteFrame {
  const width = Math.max(tile.width, 1)
  const height = Math.max(tile.bitmapHeight, 1)
  const indices = new Uint8Array(width * height)
  const mask = new Uint8Array(width * height)
  for (const block of tile.blocks) {
    for (let at = 0; at < indices.length && at < block.pixels.length; at += 1) {
      const value = block.pixels[at]!
      if (value === 0) continue
      indices[at] = value
      mask[at] = 1
    }
  }
  return { width, height, indices, mask }
}

/** One tile of the merged pool. */
export interface PoolTile {
  readonly library: number
  readonly tile: number
  /** Variant weight (`Dt1Tile.rarityFrameIndex`) used when picking per cell. */
  readonly weight: number
  /** Whether this tile is part of an animated sequence. */
  readonly animated: boolean
  /** 0-based animation frame index when animated is true. */
  readonly frameIndex: number
  /** DT1 tile Type field at offset +20 (`0` for floors, `1..19` for walls/shadows/roofs). */
  readonly type?: number | undefined
}

/** The merged pool a DS1's references are resolved against. */
interface TilePool {
  readonly exact: Map<string, PoolTile[]>
  readonly loose: Map<string, PoolTile[]>
  /** References that more than one tile could satisfy (the random variants). */
  duplicates: number
}

/**
 * Merge every library of a level into one lookup pool.
 *
 * The key insight — and the one that a single-library reader gets wrong — is
 * that a DS1 cell's `style` matches the **tile's own `style` field inside a
 * DT1**, not the position of the DT1 in the level type's file list. Act 1's
 * `River.dt1` holds tiles with internal styles 2 and 3 while `Fence.dt1` holds
 * only style 0, so treating `style` as a library index looks plausible (it
 * resolves most of the town) and then misses every reference the real styles
 * would have caught.
 *
 * @param libraries - the level type's libraries, in file-list order.
 * @returns the pool.
 */
function mergeLibraries(libraries: readonly Dt1[]): TilePool {
  const exact = new Map<string, PoolTile[]>()
  const loose = new Map<string, PoolTile[]>()
  let duplicates = 0
  const push = (map: Map<string, PoolTile[]>, key: string, entry: PoolTile, countDuplicate: boolean): void => {
    const bucket = map.get(key)
    if (bucket === undefined) { map.set(key, [entry]); return }
    if (countDuplicate) duplicates += 1
    bucket.push(entry)
  }
  libraries.forEach((library, libraryIndex) => {
    library.tiles.forEach((tile, tileIndex) => {
      const animated = isAnimatedTile(tile)
      const entry: PoolTile = {
        library: libraryIndex,
        tile: tileIndex,
        weight: tile.rarityFrameIndex,
        animated,
        frameIndex: animated ? Math.max(0, tile.rarityFrameIndex) : 0,
        type: tile.type,
      }
      // The third component is the DS1 wall `type` and it matches the DT1 tile's
      // **`Type` field at offset +20**, not its `Direction` field at +0. `Direction`
      // is the orientation/variant index (1..5 in practice) and never equals the
      // semantic types (14 tree, 15 roof, ...); keying on it sent every roof/tree
      // reference through the loose fallback, which drew a floor tile where a tent
      // canopy belonged. Multiple tiles can share style:sequence:type — those are
      // the real variants `pickVariant` draws among.
      push(exact, `${String(tile.style)}:${String(tile.sequence)}:${String(tile.type)}`, entry, true)
      push(loose, `${String(tile.style)}:${String(tile.sequence)}`, entry, false)
    })
  })
  return { exact, loose, duplicates }
}

/**
 * Pick one variant out of a `style:sequence` group, the way the engine does.
 *
 * A DT1 ships several tiles for the same `style`/`sequence` (different grass
 * patches, stone patterns, torch variants), and the engine chooses **per cell**
 * with a weighted random draw whose weight is the tile's `RarityFrameIndex`,
 * seeded from the map seed and the cell's own `x`/`y`. This is the port of
 * OpenDiablo2's `getRandomTile` (`d2mapengine/map_tile.go`):
 *
 *     tileSeed = (seed + x) * y; tileSeed ^= tileSeed << 13; ^= >> 17; ^= << 5
 *     random   = tileSeed % Σ weight;  first tile whose running sum >= random wins
 *
 * The seed is a per-level constant (the DS1 member name hashed) rather than a
 * random game seed, so the offline bake and the in-browser decode pick the *same*
 * variant — that is what keeps `verify:packs` a byte comparison.
 *
 * @param candidates - the group, in library/file order.
 * @param cellX - cell x, the way the engine seeds it.
 * @param cellY - cell y.
 * @param seed - per-level seed.
 * @returns the chosen tile, or undefined for an empty group.
 */
export function pickVariant<T extends { readonly weight?: number; readonly rarity?: number } = PoolTile>(
  candidates: readonly T[] | undefined,
  cellX: number,
  cellY: number,
  seed: number,
  extraY?: number,
): T | undefined {
  if (candidates === undefined || candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0]
  const effX = extraY !== undefined ? seed : cellX
  const effY = extraY !== undefined ? extraY : cellY
  const effSeed = extraY !== undefined ? (((cellX >>> 0) * 0x9e3779b1) ^ (cellY >>> 0)) >>> 0 : seed
  const mask = (1n << 64n) - 1n
  const x = BigInt(effX >>> 0)
  const y = BigInt(effY >>> 0)
  const s = BigInt(effSeed >>> 0)
  let state = (s ^ (x * 0x9e3779b97f4a7c15n) ^ (y * 0xc6a4a7935bd1e995n)) & mask
  state = (state + ((x << 32n) | y)) & mask
  state = (state ^ (state >> 30n)) * 0xbf58476d1ce4e5b9n & mask
  state = (state ^ (state >> 27n)) * 0x94d049bb133111ebn & mask
  state = (state ^ (state >> 31n)) & mask

  const weightOf = (c: T): number => Math.max(0, (c.weight ?? c.rarity ?? 1) | 0)

  let total = 0
  for (const candidate of candidates) total += weightOf(candidate)
  if (total === 0) return candidates[0]
  const roll = Number(state % BigInt(total))
  let running = 0
  for (const candidate of candidates) {
    running += weightOf(candidate)
    if (running > roll) return candidate
  }
  return candidates[candidates.length - 1]
}

/**
 * Result of resolving a candidate group.
 */
interface ResolvedCandidates {
  readonly tile: PoolTile | undefined
  readonly animatedTiles?: readonly PoolTile[] | undefined
}

/**
 * Resolve a candidate group from the pool:
 * If the candidates are animated tiles, sort them by frameIndex (0..N-1) and return
 * the base frame as `tile` and the sequence as `animatedTiles`.
 * Otherwise, pick one variant per cell using weighted random draw.
 */
function resolveCandidates(
  candidates: readonly PoolTile[] | undefined,
  cellX: number,
  cellY: number,
  seed: number,
): ResolvedCandidates {
  if (candidates === undefined || candidates.length === 0) {
    return { tile: undefined }
  }
  const isAnim = candidates.some(c => c.animated)
  if (isAnim) {
    const sorted = [...candidates].sort((a, b) => a.frameIndex - b.frameIndex)
    return {
      tile: sorted[0],
      animatedTiles: sorted.length > 1 ? sorted : undefined,
    }
  }
  return {
    tile: pickVariant(candidates, cellX, cellY, seed),
  }
}

/**
 * Whether a cell's DT1 mask lets the renderer draw a tile of `library` (libraries from index 21 on are
 * never filtered).
 *
 * @param dt1Mask - the cell's `dt1Mask`.
 * @param library - index into the scene's library list.
 * @returns true when the library's tiles are candidates for the cell.
 */
export function dt1MaskAllows(dt1Mask: number, library: number): boolean {
  return library >= 21 || ((dt1Mask >>> 0) & (1 << library)) !== 0
}

export function filterByDt1Mask(
  candidates: readonly PoolTile[] | undefined,
  dt1Mask: number | undefined,
): readonly PoolTile[] | undefined {
  if (candidates === undefined || candidates.length === 0 || dt1Mask === undefined) {
    return candidates
  }
  return candidates.filter(c => dt1MaskAllows(dt1Mask, c.library))
}

/**
 * Resolve a DRLG-pinned DT1 library and tile index directly, bypassing `pickVariant`.
 */
function resolvePinnedTile(
  pool: TilePool,
  libraries: readonly Dt1[],
  dt1Library: number | undefined,
  dt1Tile: number | undefined,
  style: number,
  sequence: number,
  type: number,
): ResolvedCandidates | undefined {
  if (dt1Library === undefined || dt1Tile === undefined) return undefined
  const rawTile = libraries[dt1Library]?.tiles[dt1Tile]
  if (rawTile === undefined) return undefined
  const animated = isAnimatedTile(rawTile)
  const tile: PoolTile = {
    library: dt1Library,
    tile: dt1Tile,
    weight: rawTile.rarityFrameIndex,
    animated,
    frameIndex: animated ? Math.max(0, rawTile.rarityFrameIndex) : 0,
    type: rawTile.type,
  }
  if (!animated) return { tile }
  const candidates = pool.exact.get(`${String(style)}:${String(sequence)}:${String(type)}`)
  const animatedTiles = candidates
    ?.filter(c => c.animated && c.library === dt1Library)
    .slice()
    .sort((a, b) => a.frameIndex - b.frameIndex || a.tile - b.tile)
  return {
    tile,
    ...(animatedTiles && animatedTiles.length > 1 ? { animatedTiles } : {}),
  }
}

/**
 * Resolve a DS1 reference against the pool.
 *
 * @param pool - the merged pool.
 * @param style - DS1 style field.
 * @param sequence - DS1 sequence field.
 * @param type - DS1 wall type (the third field of the reference).
 * @returns the resolved pool tile and animated sequence.
 */
function resolveExactType(
  pool: TilePool,
  style: number,
  sequence: number,
  type: number,
  cellX: number,
  cellY: number,
  seed: number,
  dt1Mask?: number,
): ResolvedCandidates {
  const raw = pool.exact.get(`${String(style)}:${String(sequence)}:${String(type)}`)
  return resolveCandidates(filterByDt1Mask(raw, dt1Mask), cellX, cellY, seed)
}

/**
 * Resolve a DS1 reference against the pool.
 *
 * @param pool - the merged pool.
 * @param style - DS1 style field.
 * @param sequence - DS1 sequence field.
 * @param type - DS1 wall type (the third field of the reference), or null for floors.
 * @returns the pool tile, animated tiles if any, and whether it matched via loose fallback.
 */
function resolveWithSource(
  pool: TilePool,
  style: number,
  sequence: number,
  type: number,
  cellX: number,
  cellY: number,
  seed: number,
  dt1Mask?: number,
): { tile: PoolTile | undefined; animatedTiles?: readonly PoolTile[] | undefined; viaLoose: boolean } {
  const key = `${String(style)}:${String(sequence)}`
  const exact = resolveExactType(pool, style, sequence, type, cellX, cellY, seed, dt1Mask)
  if (exact.tile !== undefined) return { tile: exact.tile, animatedTiles: exact.animatedTiles, viaLoose: false }
  const looseBucket = pool.loose.get(key)?.filter(c =>
    type === FLOOR_TILE_TYPE ? (c.type ?? FLOOR_TILE_TYPE) === FLOOR_TILE_TYPE : (c.type ?? 1) !== FLOOR_TILE_TYPE,
  )
  const loose = resolveCandidates(filterByDt1Mask(looseBucket, dt1Mask), cellX, cellY, seed)
  return { tile: loose.tile, animatedTiles: loose.animatedTiles, viaLoose: true }
}

/**
 * The per-level variant seed for {@link buildIsoMapScene}.
 *
 * Derived from the DS1 member name so it is stable across processes: the packer
 * hashes the name it read out of the archives, and the browser hashes the name it
 * is about to fetch, so both draw the same tile variants.
 *
 * @param name - the DS1 member name, e.g. `data\global\tiles\Act1\Town\townN1.ds1`.
 * @returns a 32-bit seed.
 */
export function levelSeed(name: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** Options for building a level's 4-layer automap data (pFloors, pWalls, pObjects, pExtras). */
export interface BuildLevelAutomapOptions {
  readonly automapTable?: AutomapTable | undefined
  readonly levelId: number
  readonly layerId: number
  readonly levelTypeId: number | string
  readonly act: number
  readonly seed?: number | undefined
  readonly ds1Name?: string | undefined
  readonly objectsTable?: ObjectsTable | undefined
  readonly monstersTable?: MonstersTable | undefined
  readonly monstats2ById?: ReadonlyMap<string, { readonly automapCel: number; readonly noMap: boolean }> | undefined
  readonly waypoints?: readonly { readonly x: number; readonly y: number }[] | undefined
}

/**
 * Generates the authentic 4-layer AutomapLayerData (floors, walls, objects, extras)
 * for a DS1 level using AutoMap.txt [36][20] bucket lookup, 0x6fba1528 priority weight
 * deduplication, 1.13c tile/object/monster overrides, and 0x6fb12760 town pre-baked chunks.
 */
export function buildLevelAutomap(
  level: Ds1,
  options: BuildLevelAutomapOptions,
): AutomapLayerData {
  const {
    automapTable = getCanonicalAutomapTable(),
    levelId,
    layerId,
    act,
    seed = 0,
    ds1Name,
    objectsTable,
    monstersTable,
    monstats2ById,
    waypoints,
  } = options
  const levelTypeId = getAutomapLevelTypeId(options.levelTypeId)

  const rawFloorCells: AutomapCell[] = []
  const rawWallCells: AutomapCell[] = []
  const rawObjectCells: AutomapCell[] = []

  const cellsX = level.width
  const cellsY = level.height

  // Per D2Common.dll DRLGPRESET_GenerateLevel (0x6FD886F0) and D2Client.dll AUTOMAP_RevealRoom (0x6fb12580):
  // Lut Gholein (40), Pandemonium Fortress (103), and Harrogath (109) use pre-baked town chunk art
  // (Act2Map, Act4Map, ExTnMap in pExtras) rather than generic tile-by-tile pfAutomap floor/wall cells,
  // with the sole exception of the Palace Cellar stairs override in Level 40 (tileType=8, style=25, seq=0 -> 305).
  const isSavedTownMap = levelId === 40 || levelId === 103 || levelId === 109

  for (let cellY = 0; cellY < cellsY; cellY += 1) {
    for (let cellX = 0; cellX < cellsX; cellX += 1) {
      const ds1Cell = level.cells[cellY]?.[cellX]
      if (ds1Cell === undefined) continue

      if (!isSavedTownMap) {
        // 1. Floors (tileType === 0)
        for (const floor of ds1Cell.floors) {
          if (floor.hidden || floor.prop1 === 0) continue
          const cellNo = resolveTileAutomapCellId(automapTable, {
            levelId,
            levelTypeId,
            tileType: FLOOR_TILE_TYPE,
            style: floor.style,
            sequence: floor.sequence,
            flags: floor.hidden ? 1 : 0,
            cellX,
            cellY,
            seed,
          })
          if (cellNo >= 0) {
            const { xPixel, yPixel } = computeAutomapTilePixelCoords(cellX, cellY, FLOOR_TILE_TYPE)
            rawFloorCells.push({
              cellNo,
              xPixel,
              yPixel,
              cellX,
              cellY,
              fSaved: 0,
              weight: getAutomapCellWeight(cellNo),
            })
          }
        }

        // 2. Shadows (tileType === 13 -> pWalls)
        for (const shadow of ds1Cell.shadows) {
          if (shadow.hidden || shadow.prop1 === 0) continue
          const cellNo = resolveTileAutomapCellId(automapTable, {
            levelId,
            levelTypeId,
            tileType: SHADOW_TILE_TYPE,
            style: shadow.style,
            sequence: shadow.sequence,
            flags: shadow.hidden ? 1 : 0,
            cellX,
            cellY,
            seed,
          })
          if (cellNo >= 0) {
            const { xPixel, yPixel } = computeAutomapTilePixelCoords(cellX, cellY, SHADOW_TILE_TYPE)
            rawWallCells.push({
              cellNo,
              xPixel,
              yPixel,
              cellX,
              cellY,
              fSaved: 0,
              weight: getAutomapCellWeight(cellNo),
            })
          }
        }
      }

      // 3. Walls (tileType 1..19 -> pWalls)
      for (const wall of ds1Cell.walls) {
        if (wall.hidden || wall.prop1 === 0) continue
        if (wall.type < 0 || wall.type >= 20) continue
        if (isSavedTownMap && !(levelId === 40 && wall.type === 8 && wall.style === 25 && wall.sequence === 0)) {
          continue
        }
        const cellNo = resolveTileAutomapCellId(automapTable, {
          levelId,
          levelTypeId,
          tileType: wall.type,
          style: wall.style,
          sequence: wall.sequence,
          flags: wall.hidden ? 1 : 0,
          cellX,
          cellY,
          seed,
        })
        if (cellNo >= 0) {
          const { xPixel, yPixel } = computeAutomapTilePixelCoords(cellX, cellY, wall.type)
          rawWallCells.push({
            cellNo,
            xPixel,
            yPixel,
            cellX,
            cellY,
            fSaved: 0,
            weight: getAutomapCellWeight(cellNo),
          })
        }

        // Top-corner-right (type 3) companion top-corner-left (type 4)
        if (!isSavedTownMap && wall.type === TOP_CORNER_RIGHT_TYPE) {
          const companionCellNo = resolveTileAutomapCellId(automapTable, {
            levelId,
            levelTypeId,
            tileType: TOP_CORNER_LEFT_TYPE,
            style: wall.style,
            sequence: wall.sequence,
            flags: wall.hidden ? 1 : 0,
            cellX,
            cellY,
            seed,
          })
          if (companionCellNo >= 0) {
            const { xPixel, yPixel } = computeAutomapTilePixelCoords(cellX, cellY, TOP_CORNER_LEFT_TYPE)
            rawWallCells.push({
              cellNo: companionCellNo,
              xPixel,
              yPixel,
              cellX,
              cellY,
              fSaved: 0,
              weight: getAutomapCellWeight(companionCellNo),
            })
          }
        }
      }
    }
  }

  // 4. Static Objects & NPCs (pObjects)
  if (objectsTable) {
    for (const object of level.objects) {
      let resolved
      try {
        resolved = resolveDs1Object(objectsTable, act, object.type, object.id, monstersTable)
      } catch {
        continue
      }
      const cellX = Math.trunc(object.x / SUB_TILES_PER_TILE)
      const cellY = Math.trunc(object.y / SUB_TILES_PER_TILE)

      if (object.type === 2 && !resolved.entry?.baseIsMonsters) {
        const objectClassId = resolved.entry?.objectsTxtId ?? resolved.row?.id ?? -1
        if (objectClassId < 0) continue
        const autoMapCol = resolved.row?.autoMap ?? 0
        const mode = resolved.mode === 'ON' || resolved.mode === 'OP' ? 2 : 0
        const cellNo = resolveObjectAutomapCellId({
          objectClassId,
          autoMapCol,
          levelId,
          mode,
        })
        if (cellNo >= 0) {
          const { xPixel, yPixel } = computeAutomapObjectPixelCoords(object.x, object.y)
          rawObjectCells.push({
            cellNo,
            xPixel,
            yPixel,
            cellX,
            cellY,
            fSaved: 0,
            weight: getAutomapCellWeight(cellNo),
          })
        }
      } else if (object.type === 1 && monstersTable) {
        const presets = monstersTable.presetPlaceByAct.get(String(act))
        let place = presets && object.id >= 0 && object.id < presets.length ? presets[object.id] : undefined
        let statRow = place ? monstersTable.statsById.get(place) : undefined
        if (!statRow && object.id >= 1000) {
          statRow = getMonsterRowByHcIdx(monstersTable.stats, object.id - 1000)
          place = statRow ? cell(monstersTable.stats, statRow, 'Id').trim() : undefined
        }
        if (!statRow) continue
        const monsterClassId = Number(cell(monstersTable.stats, statRow, 'hcIdx') || '-1')
        if (monsterClassId < 0) continue
        const monStatsEx = (cell(monstersTable.stats, statRow, 'MonStatsEx') || place || '').trim().toLowerCase()
        const m2 = monstats2ById?.get(monStatsEx)
        const automapCel = m2?.automapCel ?? 0
        const noMap = m2?.noMap ?? false
        const cellNo = resolveMonsterAutomapCellId({
          monsterClassId,
          automapCel,
          noMap,
          isAlive: true,
        })
        if (cellNo >= 0) {
          const { xPixel, yPixel } = computeAutomapObjectPixelCoords(object.x, object.y)
          rawObjectCells.push({
            cellNo,
            xPixel,
            yPixel,
            cellX,
            cellY,
            fSaved: 0,
            weight: getAutomapCellWeight(cellNo),
          })
        }
      }
    }
  } else {
    for (const object of level.objects) {
      const objAct = object.act ?? act
      const cellX = Math.trunc(object.x / SUB_TILES_PER_TILE)
      const cellY = Math.trunc(object.y / SUB_TILES_PER_TILE)

      if (object.type === 2) {
        const entry = lookupObject(objAct, 2, object.id)
        if (entry?.baseIsMonsters) continue
        const objectClassId =
          entry && entry.objectsTxtId >= 0
            ? entry.objectsTxtId
            : object.id >= 150
              ? object.id - 150
              : -1
        if (objectClassId < 0) continue
        const autoMapCol = CANONICAL_OBJECT_AUTOMAP_BY_ID[objectClassId] ?? 0
        const mode = entry?.mode === 'ON' || entry?.mode === 'OP' ? 2 : 0
        const cellNo = resolveObjectAutomapCellId({
          objectClassId,
          autoMapCol,
          levelId,
          mode,
        })
        if (cellNo >= 0) {
          const { xPixel, yPixel } = computeAutomapObjectPixelCoords(object.x, object.y)
          rawObjectCells.push({
            cellNo,
            xPixel,
            yPixel,
            cellX,
            cellY,
            fSaved: 0,
            weight: getAutomapCellWeight(cellNo),
          })
        }
      } else if (object.type === 1) {
        const monsterClassId =
          object.id >= 1000
            ? object.id - 1000
            : (CANONICAL_MON_PRESET_HCIDX_BY_ACT[objAct]?.[object.id] ?? -1)
        if (monsterClassId < 0) continue
        const m2 = CANONICAL_MONSTER_AUTOMAP_BY_HCIDX[monsterClassId]
        const cellNo = resolveMonsterAutomapCellId({
          monsterClassId,
          automapCel: m2?.automapCel ?? 0,
          noMap: m2?.noMap ?? false,
          isAlive: true,
        })
        if (cellNo >= 0) {
          const { xPixel, yPixel } = computeAutomapObjectPixelCoords(object.x, object.y)
          rawObjectCells.push({
            cellNo,
            xPixel,
            yPixel,
            cellX,
            cellY,
            fSaved: 0,
            weight: getAutomapCellWeight(cellNo),
          })
        }
      }
    }
  }

  // Ensure generated/outdoor waypoints are also represented in pObjects when passed,
  // conforming strictly to D2Client.dll 0x6fb11d00..0x6fb11e60:
  // - Floor-rule levels (where AutoMap.txt has style=0 seq=54 -> 307, or level 46 floor tiles 617..619)
  //   and saved town maps (levels 40, 103, 109 in pExtras) MUST NOT have a duplicate 307 injected into pObjects.
  // - Canyon of the Magi (level 46) uses floor tiles and explicitly skips object waypoint (0x6fb11db5).
  // - Level 74 (Arcane Sanctuary) uses waypoint cell 307 (never sparkly chest 318).
  if (waypoints && waypoints.length > 0 && !isSavedTownMap) {
    const wpCellNo = 307
    for (const wp of waypoints) {
      if (levelId === 46) continue
      const cellX = Math.trunc(wp.x / SUB_TILES_PER_TILE)
      const cellY = Math.trunc(wp.y / SUB_TILES_PER_TILE)
      const alreadyHasWp =
        rawFloorCells.some(
          c =>
            (c.cellNo === 307 || (c.cellNo >= 617 && c.cellNo <= 619)) &&
            Math.abs(c.cellX - cellX) <= 2 &&
            Math.abs(c.cellY - cellY) <= 2,
        ) ||
        rawObjectCells.some(
          c => c.cellNo === 307 && Math.abs(c.cellX - cellX) <= 2 && Math.abs(c.cellY - cellY) <= 2,
        )
      if (!alreadyHasWp) {
        // In 1.13c, only level 74 or Act 5 levels (where Objects.txt has AutoMap == 307) use object-layer waypoint 307
        if (levelId === 74 || levelId >= 110) {
          const { xPixel, yPixel } = computeAutomapObjectPixelCoords(wp.x, wp.y)
          rawObjectCells.push({
            cellNo: wpCellNo,
            xPixel,
            yPixel,
            cellX,
            cellY,
            fSaved: 0,
            weight: getAutomapCellWeight(wpCellNo),
          })
        }
      }
    }
  }

  // 5. Pre-baked town base map chunks (pExtras)
  const pickedFile = ds1Name !== undefined && /(?:lutw|townw1)/i.test(ds1Name) ? 1 : 0
  const extras = generateTownSavedExtras(levelId, cellsX, cellsY, pickedFile)

  return {
    layerId,
    levelTypeId,
    floors: deduplicateAutomapCells(rawFloorCells),
    walls: deduplicateAutomapCells(rawWallCells),
    objects: deduplicateAutomapCells(rawObjectCells),
    extras,
  }
}

/**
 * Build the renderable scene.
 *
 * @param level - the decoded DS1.
 * @param libraries - the level type's DT1 libraries, in `File 1..N` order, so a
 *   cell's `style` can index straight into it.
 * @param seed - per-level seed for the per-cell tile variant draw. Both the
 *   offline bake and the in-browser decode must pass the same value (the packer
 *   uses {@link levelSeed}); 0 keeps the old deterministic first-variant result.
 * @param automapOptions - optional parameters to also compute `scene.automap`.
 * @returns the scene.
 */
export function buildIsoMapScene(
  level: Ds1,
  libraries: readonly Dt1[],
  seed = 0,
  automapOptions?: BuildLevelAutomapOptions,
): IsoMapScene {
  const pool = mergeLibraries(libraries)
  const frames: SpriteFrame[] = []
  /** `library:tile` → frame index, so repeated references share one frame. */
  const frameOfTile = new Map<string, number>()
  const frameFor = (libraryIndex: number, tileIndex: number): number => {
    const key = `${String(libraryIndex)}:${String(tileIndex)}`
    const existing = frameOfTile.get(key)
    if (existing !== undefined) return existing
    const index = frames.length
    frames.push(tileToFrame(libraries[libraryIndex]!.tiles[tileIndex]!))
    frameOfTile.set(key, index)
    return index
  }

  const cellsX = level.width
  const cellsY = level.height
  const gridWidth = cellsX * SUB_TILES_PER_TILE
  const gridHeight = cellsY * SUB_TILES_PER_TILE
  const blocked = new Uint8Array(gridWidth * gridHeight)
  const collisionMasks = new Uint16Array(gridWidth * gridHeight)
  const rawFloors: IsoDraw[] = []
  const rawShadows: IsoDraw[] = []
  const rawWalls: IsoDraw[] = []
  /** Roof draws (`wall.type` 15): kept apart so they can be painted last. */
  const rawRoofs: IsoDraw[] = []
  let missingTiles = 0
  let clippedTiles = 0
  const missingRefs: string[] = []
  const noteMissing = (kind: string, style: number, sequence: number, direction: number | null, cellX: number, cellY: number): void => {
    missingTiles += 1
    if (missingRefs.length < 20) {
      const dirText = direction === null ? '' : `:${String(direction)}`
      missingRefs.push(`${kind} style=${String(style)} sequence=${String(sequence)}${dirText} @cell(${String(cellX)},${String(cellY)})`)
    }
  }

  // The engine ORs the sub-tile flags of *every* layer of a cell (floor, wall,
  // shadow) and then reads walkability off the combined flags — OpenDiablo2's
  // `SubTileFlags.Combine` is a plain `||` of every bit (`d2dt1/subtile.go`),
  // and D2MOO `sub_6FD411F0` (`D2Collision.cpp`) bitwise-ORs each DT1 subtile
  // byte directly into the 16-bit `pCollisionMask` array.
  let shadowBlocked = 0
  let looseRefs = 0
  let cornerPairs = 0
  let missingCornerPairs = 0
  const stamp = (cellX: number, cellY: number, tile: Dt1Tile, isDoorWall = false): void => {
    for (let subY = 0; subY < SUB_TILES_PER_TILE; subY += 1) {
      for (let subX = 0; subX < SUB_TILES_PER_TILE; subX += 1) {
        const flags = tile.subTileFlags[subY * SUB_TILES_PER_TILE + subX]
        if (flags === undefined) continue
        const gx = cellX * SUB_TILES_PER_TILE + subX
        const gy = cellY * SUB_TILES_PER_TILE + subY
        if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) continue
        const idx = gy * gridWidth + gx
        if (flags.raw !== 0) {
          let maskBits = flags.raw & 0xffff
          if (isDoorWall && (flags.blockWalk || flags.blockPlayerWalk)) {
            maskBits |= COLLIDE_DOOR
          }
          collisionMasks[idx] = (collisionMasks[idx] ?? 0) | maskBits
        }
        if (!flags.blockWalk && !flags.blockPlayerWalk) continue
        blocked[idx] = 1
      }
    }
  }

  for (let cellY = 0; cellY < cellsY; cellY += 1) {
    for (let cellX = 0; cellX < cellsX; cellX += 1) {
      const cell = level.cells[cellY]?.[cellX]
      const isLavaOnlyFloor =
        level.floorLayers >= 2
        && cell !== undefined
        && cell.floors[0] !== undefined
        && !cell.floors[0].hidden
        && cell.floors[0].prop1 !== 0
        && cell.floors[0].style === 20
        && (cell.floors[0].unknown1 & 8) !== 0
        && cell.floors.slice(1).every(f => f.hidden || f.prop1 === 0)
      const hasArcaneBlankFloor =
        cell !== undefined
        && cell.floors.some(f => f.prop1 !== 0 && f.style === 30 && f.sequence === 1)
      const hasUnwalkableVisibleFloor =
        cell !== undefined
        && (isLavaOnlyFloor || cell.floors.some(f => !f.hidden && f.prop1 !== 0 && f.unwalkable === true))
      const hasNoValidFloor =
        cell === undefined
        || cell.floors.length === 0
        || cell.floors.every(f => f.hidden || f.prop1 === 0 || f.unwalkable === true)
        || isLavaOnlyFloor
      let hasHiddenCollisionFloor = false

      if (cell !== undefined) {
        const orthoX = (cellX - cellY) * ORTHO_CELL_WIDTH
        const orthoY = (cellX + cellY) * ORTHO_CELL_HEIGHT

        for (const floor of cell.floors) {
          // A zero `prop1` marks an unused slot, which most wall slots are.
          if (floor.prop1 === 0) continue
          // A DS1 floor record has no `type` field: the engine reads it as DT1
          // **type 0**. Passing `null` here (before this fix) sent every floor through
          // the type-agnostic fallback, whose pool mixes floors, walls, pillars,
          // shadows, trees and roofs — so a weighted-random draw could put a dark wall
          // tile in a floor slot, drawn with the floor's offset (no `minBlockY + 80`),
          // which is the "misplaced black block on the ground" defect.
          const pinned = resolvePinnedTile(pool, libraries, floor.dt1Library, floor.dt1Tile, floor.style, floor.sequence, FLOOR_TILE_TYPE)
          const picked = pinned !== undefined
            ? { tile: pinned.tile, animatedTiles: pinned.animatedTiles, viaLoose: false }
            : resolveWithSource(pool, floor.style, floor.sequence, FLOOR_TILE_TYPE, cellX, cellY, seed, cell.dt1Mask)
          if (!floor.hidden && picked.viaLoose) looseRefs += 1
          const found = picked.tile
          if (found === undefined) {
            if (!floor.hidden) noteMissing('floor', floor.style, floor.sequence, FLOOR_TILE_TYPE, cellX, cellY)
            continue
          }
          const tile = libraries[found.library]!.tiles[found.tile]!
          if (floor.hidden) {
            // 1.13c D2Common.dll sub_6FD413E0 (0x6FD413E0): MAPTILE_HIDDEN (dwFlags & 0x08) only
            // suppresses visual floor rendering; hidden collision floor tiles (e.g. tomb.dt1 /
            // maggot/floor.dt1 style=50 seq=0..2 chasm borders, Blank.dt1 style=30 seq=0..1,
            // InvisWal.dt1 style=49) still stamp their DT1 5x5 nSubtileFlags into pCollisionMask.
            if (tile.subTileFlags.some(f => f.raw !== 0)) {
              stamp(cellX, cellY, tile)
              if (!hasArcaneBlankFloor) {
                hasHiddenCollisionFloor = true
              }
            }
            continue
          }
          const animatedFrames = picked.animatedTiles?.map(t => frameFor(t.library, t.tile))
          rawFloors.push({
            frameIndex: frameFor(found.library, found.tile),
            ...(animatedFrames && animatedFrames.length > 1 ? { animatedFrames } : {}),
            x: orthoX + TILE_ANCHOR_X,
            y: orthoY,
            cellX, cellY, library: found.library, tile: found.tile,
          })
          stamp(cellX, cellY, tile)
        }
      }

      if (hasNoValidFloor) {
        const invalidMask =
          hasArcaneBlankFloor || hasUnwalkableVisibleFloor
            ? COLLIDE_WALL | COLLIDE_BLANK
            : hasHiddenCollisionFloor
              ? COLLIDE_WALL
              : COLLIDE_MASK_INVALID
        for (let subY = 0; subY < SUB_TILES_PER_TILE; subY += 1) {
          for (let subX = 0; subX < SUB_TILES_PER_TILE; subX += 1) {
            const gx = cellX * SUB_TILES_PER_TILE + subX
            const gy = cellY * SUB_TILES_PER_TILE + subY
            const idx = gy * gridWidth + gx
            blocked[idx] = 1
            collisionMasks[idx] = (collisionMasks[idx] ?? 0) | invalidMask
          }
        }
      }
      if (cell === undefined) continue
      const orthoX = (cellX - cellY) * ORTHO_CELL_WIDTH
      const orthoY = (cellX + cellY) * ORTHO_CELL_HEIGHT

      // Shadows are drawn on top of floors and beneath walls/actors. In the engine,
      // they are resolved as `type 13` tiles and blended with 50% transparency onto the ground.
      for (const shadow of cell.shadows) {
        if (shadow.prop1 === 0) continue
        // Shadows must come from a **type 13** tile specifically: the loose
        // fallback ignores the type field and would happily return a wall tile,
        // stamping its blocking flags as if they were a shadow's.
        const picked = resolvePinnedTile(pool, libraries, shadow.dt1Library, shadow.dt1Tile, shadow.style, shadow.sequence, SHADOW_TILE_TYPE)
          ?? resolveExactType(pool, shadow.style, shadow.sequence, SHADOW_TILE_TYPE, cellX, cellY, seed, cell.dt1Mask)
        const found = picked.tile
        if (found === undefined) continue
        const tile = libraries[found.library]!.tiles[found.tile]!
        const animatedFrames = picked.animatedTiles?.map(t => frameFor(t.library, t.tile))
        rawShadows.push({
          frameIndex: frameFor(found.library, found.tile),
          ...(animatedFrames && animatedFrames.length > 1 ? { animatedFrames } : {}),
          x: orthoX + TILE_ANCHOR_X,
          y: orthoY,
          cellX, cellY, library: found.library, tile: found.tile,
        })
        for (let sub = 0; sub < SUB_TILES_PER_TILE * SUB_TILES_PER_TILE; sub += 1) {
          const flags = tile.subTileFlags[sub]
          if (flags === undefined) continue
          const gx = cellX * SUB_TILES_PER_TILE + (sub % SUB_TILES_PER_TILE)
          const gy = cellY * SUB_TILES_PER_TILE + Math.floor(sub / SUB_TILES_PER_TILE)
          if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) continue
          const idx = gy * gridWidth + gx
          if (flags.raw !== 0) {
            collisionMasks[idx] = (collisionMasks[idx] ?? 0) | (flags.raw & 0xffff)
          }
          if (!flags.blockWalk && !flags.blockPlayerWalk) continue
          if (blocked[idx] === 0) shadowBlocked += 1
          blocked[idx] = 1
        }
      }

      for (const wall of cell.walls) {
        if ((wall.hidden && !wall.revealHidden) || wall.prop1 === 0) continue
        const pinnedWall = resolvePinnedTile(pool, libraries, wall.dt1Library, wall.dt1Tile, wall.style, wall.sequence, wall.type)
        const pickedWall = pinnedWall !== undefined
          ? { tile: pinnedWall.tile, animatedTiles: pinnedWall.animatedTiles, viaLoose: false }
          : resolveWithSource(pool, wall.style, wall.sequence, wall.type, cellX, cellY, seed, cell.dt1Mask)
        if (pickedWall.viaLoose) looseRefs += 1
        const found = pickedWall.tile
        if (found === undefined) { noteMissing('wall', wall.style, wall.sequence, wall.type, cellX, cellY); continue }
        const tile = libraries[found.library]!.tiles[found.tile]!
        if (tile.bitmapHeight > Math.abs(tile.height)) clippedTiles += 1
        const animatedFrames = pickedWall.animatedTiles?.map(t => frameFor(t.library, t.tile))
        const wallType = tile.type ?? wall.type
        const lowerWall = isLowerWallType(wallType) || isLowerWallType(wall.type)
        const draw: IsoDraw = {
          frameIndex: frameFor(found.library, found.tile),
          ...(animatedFrames && animatedFrames.length > 1 ? { animatedFrames } : {}),
          x: orthoX + TILE_ANCHOR_X,
          // A wall's art extends above its cell, so it is pushed back down by
          // exactly the block shift the decoder applied, plus one cell height.
          y: orthoY + tile.minBlockY + WALL_SURFACE_HEIGHT,
          cellX, cellY, library: found.library, tile: found.tile,
          type: wallType,
          style: tile.style,
          ...(lowerWall ? { isLowerWall: true } : {}),
        }
        // D2DrlgTileDataStrc::unk0x10, MAPTILE_TREES, MAPTILE_UNK_0x200 (`bRevealHidden`), and
        // MAPTILE_FLOOR_LINKER_PATH (`bLinkage`), read by the occlusion fade (0x6fb2a340 / 0x6fb29f20) and POPS
        // visibility toggle (0x6fd5a180). The type-4 companion is its own tile data in the same cell, so it shares them.
        const wallPopFields = {
          ...(wall.revealHidden === true ? { revealHidden: true } : {}),
          ...(wall.popLinkage === true ? { popLinkage: true } : {}),
        }
        const wallFadeFields = {
          ...(wall.fadeBox !== undefined ? { fadeBox: wall.fadeBox } : {}),
          ...(wall.noFade === true ? { noFade: true } : {}),
          ...wallPopFields,
        }
        if (wall.type === ROOF_WALL_TYPE) {
          // Roofs use the engine's own roof offset and are painted after
          // everything else, so they leave the wall painter order entirely.
          rawRoofs.push({
            ...draw,
            y: orthoY - tile.roofHeight,
            roofHeight: tile.roofHeight,
            type: ROOF_WALL_TYPE,
            ...wallPopFields,
          })
        } else {
          rawWalls.push({ ...draw, ...wallFadeFields })
        }
        const isDoorWall = wall.type === LEFT_DOOR_WALL_TYPE || wall.type === RIGHT_DOOR_WALL_TYPE
        // D2Common sub_6FD413E0 (0x6fd413e0): non-floor tiles with MAPTILE_HIDDEN (0x8) at room init
        // (such as 0x200 bRevealHidden cutaway interior wall caps) do not stamp collision.
        if (!wall.hidden) {
          stamp(cellX, cellY, tile, isDoorWall)
        }

        // A top-corner-right wall drags its left half along (see
        // {@link TOP_CORNER_RIGHT_TYPE}): same cell, same style/sequence, resolved as
        // a type-4 tile, drawn with its own block shift like any other wall. The
        // engine's DS1s never list the left half themselves, so this is the only way
        // the corner gets both faces — 411 of them across the 35 preset levels.
        if (tile.type === TOP_CORNER_RIGHT_TYPE) {
          const companionPicked = resolvePinnedTile(pool, libraries, wall.companionDt1Library, wall.companionDt1Tile, wall.style, wall.sequence, TOP_CORNER_LEFT_TYPE)
            ?? resolveExactType(pool, wall.style, wall.sequence, TOP_CORNER_LEFT_TYPE, cellX, cellY, seed, cell.dt1Mask)
          const companion = companionPicked.tile
          if (companion === undefined) {
            missingCornerPairs += 1
            noteMissing('corner-left', wall.style, wall.sequence, TOP_CORNER_LEFT_TYPE, cellX, cellY)
          } else {
            const leftTile = libraries[companion.library]!.tiles[companion.tile]!
            const companionAnim = companionPicked.animatedTiles?.map(t => frameFor(t.library, t.tile))
            rawWalls.push({
              frameIndex: frameFor(companion.library, companion.tile),
              ...(companionAnim && companionAnim.length > 1 ? { animatedFrames: companionAnim } : {}),
              x: orthoX + TILE_ANCHOR_X,
              y: orthoY + leftTile.minBlockY + WALL_SURFACE_HEIGHT,
              cellX, cellY, library: companion.library, tile: companion.tile,
              type: TOP_CORNER_LEFT_TYPE,
              style: leftTile.style,
              ...wallFadeFields,
            })
            cornerPairs += 1
            if (!wall.hidden) {
              stamp(cellX, cellY, leftTile)
            }
          }
        }
      }
    }
  }

  // Isometric painter's order: depth grows along the diagonal, so walls sort by
  // (cellX + cellY) and then row, which keeps a nearer wall in front of the one
  // behind it without any depth buffer.
  rawShadows.sort((a, b) => (a.cellY + a.cellX) - (b.cellY + b.cellX) || a.cellY - b.cellY || a.x - b.x)
  rawWalls.sort((a, b) => (a.cellY + a.cellX) - (b.cellY + b.cellX) || a.cellY - b.cellY || a.x - b.x)
  rawRoofs.sort((a, b) => (a.cellY + a.cellX) - (b.cellY + b.cellX) || a.cellY - b.cellY || a.x - b.x)

  // Shift everything positive: `(cellX - cellY)` is negative on half the map.
  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0
  for (const draw of [...rawFloors, ...rawShadows, ...rawWalls, ...rawRoofs]) {
    if (draw.revealHidden) continue
    const frame = frames[draw.frameIndex]!
    minX = Math.min(minX, draw.x)
    minY = Math.min(minY, draw.y)
    maxX = Math.max(maxX, draw.x + frame.width)
    maxY = Math.max(maxY, draw.y + frame.height)
  }
  const originX = -minX
  const originY = -minY
  const shift = (draw: (typeof rawFloors)[number]): IsoDraw => ({ ...draw, x: draw.x + originX, y: draw.y + originY })

  const floors = rawFloors.map(shift)
  const shadows = rawShadows.map(shift)
  const walls = rawWalls.map(shift)
  const lowerWalls = walls.filter(w => isLowerWallType(w.type) || w.isLowerWall === true)
  const upperWalls = walls.filter(w => !isLowerWallType(w.type) && w.isLowerWall !== true)
  const roofs = rawRoofs.map(shift)
  const animatedTileCount = [...floors, ...shadows, ...walls, ...roofs].filter(
    d => d.animatedFrames && d.animatedFrames.length > 1
  ).length

  const automap = automapOptions
    ? buildLevelAutomap(level, { ...automapOptions, seed: automapOptions.seed ?? seed })
    : undefined

  return {
    frames,
    sheet: { groups: [{ frames }], width: null },
    cellsX,
    cellsY,
    widthPx: maxX - minX,
    heightPx: maxY - minY,
    originX,
    originY,
    floors,
    shadows,
    walls,
    lowerWalls,
    upperWalls,
    roofs,
    blocked,
    collisionMasks,
    gridWidth,
    gridHeight,
    missingTiles,
    missingRefs,
    clippedTiles,
    shadowBlockedSubtiles: shadowBlocked,
    looseRefs,
    cornerPairs,
    missingCornerPairs,
    duplicateRefs: pool.duplicates,
    animatedTileCount,
    ...(automap !== undefined ? { automap } : {}),
  }
}

/**
 * The parts of a scene that collision and projection need.
 *
 * A packed map and a freshly decoded one share these fields but not their
 * storage (one has an atlas, the other PNG pages), so the helpers below ask for
 * this shape instead of the whole scene.
 */
export interface CollisionGrid {
  /** Screen x added to every coordinate so the minimum is 0. */
  readonly originX: number
  /** Screen y added to every coordinate so the minimum is 0. */
  readonly originY: number
  /** Cells horizontally. */
  readonly cellsX: number
  /** Cells vertically. */
  readonly cellsY: number
  /** Collision grid, 1 = blocked. */
  readonly blocked: Uint8Array
  /** Collision grid width in sub-tiles. */
  readonly gridWidth: number
  /** Optional 16-bit collision mask array (Blizzard D2 1.13c D2C_CollisionMaskFlags). */
  readonly collisionMasks?: Uint16Array | undefined
}

/**
 * The cell containing a scene-space point.
 *
 * Inverts the isometric projection: `cx = (x/80 + y/40) / 2`, `cy = (y/40 -
 * x/80) / 2`.
 *
 * @param scene - the scene.
 * @param x - scene-space x.
 * @param y - scene-space y.
 * @returns cell coordinates, unrounded.
 */
export function cellAt(scene: CollisionGrid, x: number, y: number): { x: number; y: number } {
  const px = x - scene.originX
  const py = y - scene.originY
  return {
    x: (px / ORTHO_CELL_WIDTH + py / ORTHO_CELL_HEIGHT) / 2,
    y: (py / ORTHO_CELL_HEIGHT - px / ORTHO_CELL_WIDTH) / 2,
  }
}

/**
 * Convert a scene-space point to sub-tile grid coordinates (`0 .. cellsX*5 - 1`).
 *
 * @param scene - the scene.
 * @param x - scene-space x.
 * @param y - scene-space y.
 * @returns integer sub-tile coordinates and whether they fall within the map bounds.
 */
export function subTileAt(
  scene: CollisionGrid,
  x: number,
  y: number,
): { subX: number; subY: number; inBounds: boolean } {
  const cell = cellAt(scene, x, y)
  const cellX = Math.floor(cell.x)
  const cellY = Math.floor(cell.y)
  const inBounds = cellX >= 0 && cellY >= 0 && cellX < scene.cellsX && cellY < scene.cellsY
  const localSubX = Math.min(Math.max(0, Math.floor((cell.x - cellX) * SUB_TILES_PER_TILE)), SUB_TILES_PER_TILE - 1)
  const localSubY = Math.min(Math.max(0, Math.floor((cell.y - cellY) * SUB_TILES_PER_TILE)), SUB_TILES_PER_TILE - 1)
  const subX = cellX * SUB_TILES_PER_TILE + localSubX
  const subY = cellY * SUB_TILES_PER_TILE + localSubY
  return { subX, subY, inBounds }
}

/**
 * Convert sub-tile grid coordinates (`subX, subY`) back to scene-space centre coordinates.
 *
 * @param scene - the scene.
 * @param subX - sub-tile column (`0 .. cellsX*5 - 1`).
 * @param subY - sub-tile row (`0 .. cellsY*5 - 1`).
 * @returns scene-space (x, y) centre of the sub-tile diamond.
 */
export function subTileCentre(
  scene: CollisionGrid,
  subX: number,
  subY: number,
): { x: number; y: number } {
  const cx = (subX + 0.5) / SUB_TILES_PER_TILE
  const cy = (subY + 0.5) / SUB_TILES_PER_TILE
  return {
    x: (cx - cy) * ORTHO_CELL_WIDTH + scene.originX,
    y: (cx + cy) * ORTHO_CELL_HEIGHT + scene.originY,
  }
}

/**
 * Retrieve the 16-bit `D2C_CollisionMaskFlags` value at sub-tile coordinates `(subX, subY)`.
 * Out-of-bounds returns `COLLIDE_MASK_INVALID` (`0x0027`).
 * If `scene.collisionMasks` is absent (e.g. legacy test stub), synthesizes from `scene.blocked`.
 */
export function getCollisionMask(scene: CollisionGrid, subX: number, subY: number): number {
  const gridHeight = scene.cellsY * SUB_TILES_PER_TILE
  if (
    !Number.isFinite(subX) ||
    !Number.isFinite(subY) ||
    subX < 0 ||
    subY < 0 ||
    subX >= scene.gridWidth ||
    subY >= gridHeight
  ) {
    return COLLIDE_MASK_INVALID
  }
  const idx = subY * scene.gridWidth + subX
  if (scene.collisionMasks !== undefined) {
    return scene.collisionMasks[idx] ?? COLLIDE_NONE
  }
  return scene.blocked[idx] === 1
    ? (COLLIDE_WALL | COLLIDE_VISIBLE | COLLIDE_MISSILE_BARRIER)
    : COLLIDE_NONE
}

/**
 * Retrieve the 16-bit `D2C_CollisionMaskFlags` value at a scene-space point `(x, y)`.
 */
export function getCollisionMaskAt(scene: CollisionGrid, x: number, y: number): number {
  const { subX, subY, inBounds } = subTileAt(scene, x, y)
  if (!inBounds) return COLLIDE_MASK_INVALID
  return getCollisionMask(scene, subX, subY)
}

/**
 * Blizzard D2 1.13c `COLLISION_CheckMask` (D2Common.dll Ordinal 10118).
 * Tests whether the sub-tile at `(subX, subY)` has any bit in `mask` set.
 */
export function collisionCheckMask(
  scene: CollisionGrid,
  subX: number,
  subY: number,
  mask: number,
): boolean {
  return (getCollisionMask(scene, subX, subY) & mask) !== 0
}

/**
 * Blizzard D2 1.13c `COLLISION_SetMask` (D2Common.dll Ordinal 10127).
 * Sets `mask` bits on a sub-tile footprint `(subX, subY)` of size `widthSubTiles × heightSubTiles`,
 * and synchronizes `scene.blocked` if any `COLLIDE_MASK_PLAYER_PATH` bit is set.
 */
export function collisionSetMask(
  scene: CollisionGrid,
  subX: number,
  subY: number,
  mask: number,
  widthSubTiles = 1,
  heightSubTiles = 1,
): void {
  const gridHeight = scene.cellsY * SUB_TILES_PER_TILE
  for (let dy = 0; dy < heightSubTiles; dy += 1) {
    const gy = subY + dy
    if (gy < 0 || gy >= gridHeight) continue
    for (let dx = 0; dx < widthSubTiles; dx += 1) {
      const gx = subX + dx
      if (gx < 0 || gx >= scene.gridWidth) continue
      const idx = gy * scene.gridWidth + gx
      if (scene.collisionMasks !== undefined) {
        scene.collisionMasks[idx] = (scene.collisionMasks[idx] ?? 0) | (mask & 0xffff)
      }
      if ((mask & COLLIDE_MASK_PLAYER_PATH) !== 0) {
        scene.blocked[idx] = 1
      }
    }
  }
}

/**
 * Blizzard D2 1.13c `COLLISION_ResetMask` (D2Common.dll Ordinal 10123).
 * Clears `mask` bits on a sub-tile footprint `(subX, subY)` (e.g., when a closed door is opened),
 * and updates `scene.blocked` according to whether any `COLLIDE_MASK_PLAYER_PATH` bit remains.
 */
export function collisionResetMask(
  scene: CollisionGrid,
  subX: number,
  subY: number,
  mask: number,
  widthSubTiles = 1,
  heightSubTiles = 1,
): void {
  const gridHeight = scene.cellsY * SUB_TILES_PER_TILE
  for (let dy = 0; dy < heightSubTiles; dy += 1) {
    const gy = subY + dy
    if (gy < 0 || gy >= gridHeight) continue
    for (let dx = 0; dx < widthSubTiles; dx += 1) {
      const gx = subX + dx
      if (gx < 0 || gx >= scene.gridWidth) continue
      const idx = gy * scene.gridWidth + gx
      if (scene.collisionMasks !== undefined) {
        const nextMask = (scene.collisionMasks[idx] ?? 0) & ~(mask & 0xffff)
        scene.collisionMasks[idx] = nextMask
        scene.blocked[idx] = (nextMask & COLLIDE_MASK_PLAYER_PATH) !== 0 ? 1 : 0
      } else if ((mask & COLLIDE_MASK_PLAYER_PATH) !== 0) {
        scene.blocked[idx] = 0
      }
    }
  }
}

/**
 * Blizzard D2 1.13c `COLLISION_RayTrace` (D2Common.dll Ordinal 11263).
 *
 * Performs a Bresenham sub-tile line trace from `(startSubX, startSubY)` to `(endSubX, endSubY)`,
 * testing each sub-tile against `mask` (e.g. `COLLIDE_MASK_MISSILE` or `COLLIDE_MASK_LOS`).
 * If any visited sub-tile matches `mask`, terminates early and reports the hit coordinate.
 */
export function collisionRayTrace(
  scene: CollisionGrid,
  startSubX: number,
  startSubY: number,
  endSubX: number,
  endSubY: number,
  mask: number = COLLIDE_MASK_MISSILE,
): RayTraceResult {
  if (
    !Number.isFinite(startSubX) ||
    !Number.isFinite(startSubY) ||
    !Number.isFinite(endSubX) ||
    !Number.isFinite(endSubY)
  ) {
    return { hit: true, hitSubX: 0, hitSubY: 0, hitX: scene.originX, hitY: scene.originY, steps: 0 }
  }
  let x0 = Math.floor(startSubX)
  let y0 = Math.floor(startSubY)
  const x1 = Math.floor(endSubX)
  const y1 = Math.floor(endSubY)

  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let steps = 0
  const maxSteps = dx + dy + 1

  while (steps <= maxSteps) {
    // Check collision on current sub-tile (skipping the shooter's exact starting sub-tile at step 0
    // so a unit standing at the edge of an obstacle can still fire outward, unless start === end).
    if ((steps > 0 || (x0 === x1 && y0 === y1)) && collisionCheckMask(scene, x0, y0, mask)) {
      const pt = subTileCentre(scene, x0, y0)
      return { hit: true, hitSubX: x0, hitSubY: y0, hitX: pt.x, hitY: pt.y, steps }
    }
    if (x0 === x1 && y0 === y1) {
      break
    }
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (e2 < dx) {
      err += dx
      y0 += sy
    }
    steps += 1
  }

  const pt = subTileCentre(scene, x1, y1)
  return { hit: false, hitSubX: x1, hitSubY: y1, hitX: pt.x, hitY: pt.y, steps }
}

/**
 * Perform a 1.13c sub-tile ray trace between two scene-space coordinates `(startX, startY)` and `(endX, endY)`.
 */
export function rayTraceScene(
  scene: CollisionGrid,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  mask: number = COLLIDE_MASK_MISSILE,
): RayTraceResult {
  const start = subTileAt(scene, startX, startY)
  const end = subTileAt(scene, endX, endY)
  return collisionRayTrace(scene, start.subX, start.subY, end.subX, end.subY, mask)
}

/**
 * Whether a scene-space point lies on a blocked sub-tile.
 *
 * When `mask` is omitted, checks `scene.blocked === 1` (`COLLIDE_MASK_PLAYER_PATH`).
 * When `mask` is provided, checks the 16-bit `collisionMasks` against `mask`.
 *
 * @param scene - the scene.
 * @param x - scene-space x.
 * @param y - scene-space y.
 * @param mask - optional 16-bit collision mask (`D2C_CollisionMaskFlags`).
 * @returns true when blocked for the given mask.
 */
export function isBlockedAt(
  scene: CollisionGrid | { readonly width: number; readonly height: number; readonly collisionMask: Uint16Array },
  x: number,
  y: number,
  mask?: number,
): boolean {
  if ('collisionMask' in scene && !('cellsX' in scene)) {
    const gx = Math.floor(x)
    const gy = Math.floor(y)
    if (gx < 0 || gy < 0 || gx >= scene.width || gy >= scene.height) return true
    const m = scene.collisionMask[gy * scene.width + gx] ?? COLLIDE_MASK_INVALID
    const checkMask = mask ?? (COLLIDE_MASK_PLAYER_PATH | COLLIDE_MASK_INVALID)
    return (m & checkMask) !== 0
  }
  const grid = scene as CollisionGrid
  const cell = cellAt(grid, x, y)
  const cellX = Math.floor(cell.x)
  const cellY = Math.floor(cell.y)
  if (cellX < 0 || cellY < 0 || cellX >= grid.cellsX || cellY >= grid.cellsY) return true
  const subX = Math.floor((cell.x - cellX) * SUB_TILES_PER_TILE)
  const subY = Math.floor((cell.y - cellY) * SUB_TILES_PER_TILE)
  const gx = cellX * SUB_TILES_PER_TILE + Math.min(subX, SUB_TILES_PER_TILE - 1)
  const gy = cellY * SUB_TILES_PER_TILE + Math.min(subY, SUB_TILES_PER_TILE - 1)
  if (mask !== undefined) {
    return collisionCheckMask(grid, gx, gy, mask)
  }
  return grid.blocked[gy * grid.gridWidth + gx] === 1
}

/**
 * Whether a projectile / missile is blocked at scene-space `(x, y)`.
 * Defaults to `COLLIDE_MASK_MISSILE` (`0x0804`: `COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR`),
 * or checks the caller-provided 1.13c `CollideType` terrain mask (e.g. `0x05` for `CollideType = 8`,
 * which includes `COLLIDE_WALL` `0x01`).
 */
export function isMissileBlockedAt(scene: CollisionGrid, x: number, y: number, mask?: number): boolean {
  if (mask === 0) return false
  return isBlockedAt(scene, x, y, mask !== undefined ? (mask | 0x0800) : COLLIDE_MASK_MISSILE)
}

/**
 * Whether Line-of-Sight (LoS) is blocked at scene-space `(x, y)` (`COLLIDE_MASK_LOS`).
 */
export function isLosBlockedAt(scene: CollisionGrid, x: number, y: number): boolean {
  return isBlockedAt(scene, x, y, COLLIDE_MASK_LOS)
}

/**
 * Scene-space centre of a cell.
 *
 * @param scene - the scene.
 * @param cellX - cell column.
 * @param cellY - cell row.
 * @returns the centre point.
 */
export function cellCentre(scene: CollisionGrid, cellX: number, cellY: number): { x: number; y: number } {
  return {
    x: (cellX - cellY) * ORTHO_CELL_WIDTH + scene.originX,
    y: (cellX + cellY) * ORTHO_CELL_HEIGHT + scene.originY + ORTHO_CELL_HEIGHT / 2,
  }
}

export {
  findIsoSpawn,
  type IsoSpawnOptions,
  type IsoSpawnTarget,
} from './level-links.ts'

/** How long the blackout lasts for a stair or a cave mouth, in milliseconds. */
export const WARP_FADE_MS = 220

/** How long the blackout lasts for a walk-through seam. */
export const SEAM_FADE_MS = 90

/** The scene-pixel position of a sub-tile. */
export interface ScenePoint {
  readonly x: number
  readonly y: number
}

/**
 * Project a sub-tile onto the isometric scene.
 */
export function subTileToScene(
  subTileX: number,
  subTileY: number,
  origin: { readonly originX: number; readonly originY: number },
): ScenePoint {
  return {
    x: (subTileX - subTileY) * ORTHO_SUB_TILE_WIDTH + origin.originX,
    y: (subTileX + subTileY) * ORTHO_SUB_TILE_HEIGHT + origin.originY,
  }
}


