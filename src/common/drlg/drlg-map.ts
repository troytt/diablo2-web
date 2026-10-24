/**
 * Act I outdoor level maps from the DRLG port (M5 adapter).
 *
 * The 1:1 port of D2MOO's DRLG (src/game/drlg/drlg-*.ts) produces the level exactly as D2Common builds
 * it: rooms, their tile lists (DRLGROOMTILE_AddRoomMapTiles), preset units and warps. This module turns
 * one generated level into what the rest of the game consumes:
 *   - a DS1-shaped canvas ({@link Ds1}) for the isometric renderer (`buildIsoMapScene`), one cell per
 *     level tile, holding the exact (style, sequence, type) of every tile D2 placed;
 *   - the DT1 libraries those tiles come from, with a per-cell library mask so the renderer only draws
 *     variants from the library D2 picked the tile from;
 *   - DS1-shaped objects (the same (type, id) encoding a preset DS1 uses, so the bake resolves them
 *     through its existing object path);
 *   - the level's entrances (seams with their real sides from the DRLG level links, and warps from the
 *     UNIT_TILE preset units D2 creates for them) and SuperUnique landmarks.
 *
 * Nothing here decides anything about the layout: every value comes from the verified DRLG output
 * (the schema-3 dump, identical for the native oracle and the port), and anything unexpected throws.
 * The input is the normalized {@link DrlgLevelInput} so the same code maps the oracle's JSON and the
 * port's in-memory dump.
 */

import type { Ds1, Ds1Cell, Ds1Floor, Ds1Object, Ds1Wall } from '../formats/ds1.ts'
import type { Dt1 } from '../formats/dt1.ts'
import { dt1MaskAllows } from '../world/d2map.ts'
import {
  DRLG_COLLIDE_MASK_INVALID,
  createDrlgActSession,
  dumpRoomTiles,
  extractRoomCollisionGrid,
} from './drlg-dump.ts'
import type {
  DrlgActivatedLevel,
  DrlgActSession,
  DrlgActSessionOptions,
  DrlgDump,
  DrlgRoomCollisionGrid,
  DrlgSessionRoom,
  DumpCoord,
  DumpCoordList,
  DumpCoordListRef,
  DumpLevel,
  DumpPresetActivation,
  DumpTile,
  DumpTileRef,
} from './drlg-dump.ts'
import { DRLGLOGIC_ROOMINFO_HAS_COORD_LIST } from './drlg-logic.ts'

export {
  DRLG_COLLIDE_MASK_INVALID,
  createDrlgActSession,
  dumpRoomTiles,
  extractRoomCollisionGrid,
}
export type {
  DrlgActivatedLevel,
  DrlgActSession,
  DrlgActSessionOptions,
  DrlgRoomCollisionGrid,
  DrlgSessionRoom,
}
import { DRLG_GetActNoFromLevelId } from './drlg-drlg.ts'
import { LVLTYPE_ACT1_WILDERNESS, LVLTYPE_ACT4_MESA } from './drlg-ids.ts'
import { DRLGPRESET_GetObjectIndexFromObjPreset } from './drlg-preset.ts'
import { normalizeDrlgPath } from './drlg-source.ts'
import {
  DATATBLS_GetLevelDefRecord,
  DATATBLS_GetLvlPrestTxtRecord,
  DATATBLS_GetLvlTypesTxtRecord,
  DATATBLS_GetMonPresetTxtActSection,
} from './drlg-tables.ts'
import type { DrlgTables } from './drlg-tables.ts'
import {
  ALTDIR_EAST,
  ALTDIR_NORTH,
  ALTDIR_SOUTH,
  ALTDIR_WEST,
  DRLGTYPE_MAZE,
  DRLGTYPE_OUTDOOR,
  GRID2_LVL_LINK,
  LEVEL_BLOODYFOOTHILLS,
  LEVEL_CHAOSSANCTUM,
  LEVEL_HARROGATH,
  LEVEL_ID_ACT5_BARRICADE_1,
  LEVEL_RIVEROFFLAME,
} from './drlg-types.ts'

/** Tiles per outdoor grid cell (the 8x8 blocks of D2DrlgOutdoorInfoStrc.pGrid). */
const TILES_PER_GRID_CELL = 8
/** Sub-tiles per tile (DUNGEON_GameTileToSubtileCoords). */
const SUBTILES_PER_TILE = 5

// D2MapTileFlags (D2DrlgDrlg.h)
const MAPTILE_HIDDEN = 0x8
/** D2MapTileFlags MAPTILE_TREES: D2Client `0x6fb2a3a7` (`test byte [tile+0x14], 4`) skips the occlusion fade. */
const MAPTILE_TREES = 0x4
const MAPTILE_UNWALKABLE = 0x40
/** D2MapTileFlags MAPTILE_FLOOR_LINKER_PATH (`bLinkage`): `0x6fd5a25b` skips POPS style-matching fade when set. */
const MAPTILE_FLOOR_LINKER_PATH = 0x100
/** D2MapTileFlags MAPTILE_UNK_0x200 (`bRevealHidden`): `0x6fd5a21f` toggles cutaway interior wall cap visibility. */
const MAPTILE_UNK_0x200 = 0x200
const MAPTILE_LAYER_SHIFT = 14
const MAPTILE_LAYER_MASK = 0x7

// D2TileType (D2CMP.h)
const TILETYPE_FLOOR = 0
const TILETYPE_WALL_TOP_CORNER_RIGHT = 3
const TILETYPE_WALL_TOP_CORNER_LEFT = 4
const TILETYPE_SHADOW = 13

// D2C_UnitTypes
const UNIT_MONSTER = 1
const UNIT_OBJECT = 2
const UNIT_TILE = 5

/** DS1 object `type` values (the encoding DRLGPRESET_ParseDS1File reads). */
const DS1_TYPE_MONSTER = 1
const DS1_TYPE_OBJECT = 2
/** Object ids below this are ObjPreset slots; `objects.txt id + 150` otherwise (DRLGPRESET_ParseDS1File, v > 5). */
const DS1_OBJPRESET_SLOTS = 150
/** Monster ids below this are MonPreset slots; `monstats.txt hcIdx + 1000` for tile-spawned monsters (DRLGROOMTILE_AddTilePresetUnits). */
export const DS1_MONPRESET_SLOTS = 1000
/**
 * Objects.txt class D2Game refuses to create from a preset unit (SUnit.cpp:1003, SUNIT_CreatePresetUnit:
 * `if (nClassId == 573) return`), so it never exists in game.
 */
const OBJECT_CLASS_INVALID_PRESET = 573

/**
 * MonPlace.txt rows D2Game turns into a fixed monster at the preset position instead of a random pack
 * (D2Game MonsterRegion.cpp:243-300, `switch (nMonPlace)`), mapped to the monster planner's landmark id.
 * Only the cases reachable from Act I outdoor presets are listed: 5 -> MONSTER_BLOODRAVEN.
 */
const MONPLACE_LANDMARKS: ReadonlyMap<number, string> = new Map([[5, 'Blood Raven']])

/** Axis-aligned rectangle in world tiles (D2DrlgCoordStrc). */
export interface DrlgRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Which array of the owner room's D2DrlgRoomTilesStrc a tile lives in. */
export type DrlgTileKind = 'wall' | 'floor' | 'shadow'

/** One D2DrlgTileDataStrc, placed in level coordinates. */
export interface DrlgTileInput {
  /** Identity of the tile data (owner level, room, array, index), so owned and linked copies dedupe. */
  readonly key: string
  readonly kind: DrlgTileKind
  /** Level-local tile position: owner room position + nPosX/nPosY - level position (0..W, 0..H). */
  readonly x: number
  readonly y: number
  /** D2DrlgTileDataStrc.dwFlags (D2MapTileFlags). */
  readonly flags: number
  /** D2DrlgTileDataStrc.nTileType. */
  readonly tileType: number
  /** pTile: the DT1 tile D2 picked (normalized library path, tile index), or null when none matched. */
  readonly tile: { readonly library: string; readonly index: number } | null
  /**
   * D2DrlgTileDataStrc.unk0x10 when it points at a `D2RoomCoordListStrc` (DRLGLOGIC_SetCoordListForTiles):
   * the list's nIndex and its level-local pBox[0] position. Absent when unk0x10 is NULL.
   */
  readonly fadeBox?: { readonly index: number; readonly x: number; readonly y: number }
}

/**
 * Per-cell port of `D2Common.#10916` (`0x6fd8c6d0` -> `0x6fdd19c0`): the `nIndex` of the logical-room coord
 * list at each level-local cell (`pLogicalRoomInfo->pCoordList` when the room has
 * `DRLGLOGIC_ROOMINFO_HAS_COORD_LIST`, else the `pIndexY` grid entry), `-1` where no list exists.
 * D2Client `0x6fb2ac47` stores this value for the local player's position in `0x6fbc3b1c` every frame.
 */
export interface DrlgLogicalIndexGrid {
  readonly width: number
  readonly height: number
  readonly cells: Int32Array
}

/**
 * One POPS roof/wall visibility entry of a preset `D2DrlgMapStrc` (`DRLGPRESET_BuildPresetArea` `0x6fd5c166`,
 * `DRLGPRESET_UpdatePops` `0x6fd5a6a0`, `DRLGPRESET_TogglePopsVisibility` `0x6fd5a180`), placed in level-local
 * tile coordinates.
 */
export interface DrlgPopBox {
  /** Index of the owning `D2DrlgMapStrc` in the level (`room.preset.map`). */
  readonly mapIndex: number
  /** Pop group index `(nFlagsBits21_26 >> 2) - 1` (`pPopsIndex[k]`, `>= 1`). */
  readonly index: number
  /** Target DT1 wall/roof `style` to fade (`pPopsSubIndex[k]`). */
  readonly subIndex: number
  /** Sub-tile trigger box padding (`pLvlPrestTxtRecord->dwPopPad`). */
  readonly pad: number
  /** Level-local tile rectangle (`pPopsLocation[k]` shifted by `-levelCoord`). */
  readonly box: DrlgRect
}

/** One D2PresetUnitStrc of a room, after DRLGROOMTILE_AddRoomMapTiles. */
export interface DrlgUnitInput {
  /** Room index in the level's room chain. */
  readonly room: number
  /** D2C_UnitTypes. */
  readonly type: number
  /** nIndex as D2 stores it (after DRLGPRESET_ParseDS1File's MonPreset / ObjPreset conversion). */
  readonly index: number
  readonly mode: number
  /** Level-local sub-tile position (room-relative nXpos/nYpos + 5 * room offset). */
  readonly subX: number
  readonly subY: number
  readonly spawned: number
}

/** One D2RoomTileStrc (a warp of a room, sub_6FD77F00). */
export interface DrlgWarpInput {
  readonly room: number
  /** pLvlWarpTxtRecord->dwLevelId: the LvlWarp.txt `Id`, the class id of the warp's UNIT_TILE unit. */
  readonly lvlWarpId: number
  /** pDrlgRoom->pLevel->nLevelId of the destination room. */
  readonly toLevelId: number
}

/** One level-to-level D2DrlgOrthStrc of pOutdoors->pRoomData. */
export interface DrlgOrthInput {
  readonly level: number
  /** ALTDIR_*: where the neighbour lies (0 west, 1 north, 2 east, 3 south). */
  readonly dir: number
  readonly box: DrlgRect
}

/** Everything the adapter reads about one generated level. */
export interface DrlgLevelInput {
  readonly levelId: number
  readonly drlgType: number
  readonly levelType: number
  readonly coord: DrlgRect
  /** pOutdoors->dwFlags (D2DrlgOutdoorInfoStrc: link directions, river bank, ...). */
  readonly flags: number
  readonly orths: readonly DrlgOrthInput[]
  /** pOutdoors->pGrid[2] (packed grid-2 info) as dumped at the levelGrid stage. */
  readonly grid2: { readonly w: number; readonly h: number; readonly cells: readonly number[] }
  readonly tiles: readonly DrlgTileInput[]
  readonly units: readonly DrlgUnitInput[]
  readonly warps: readonly DrlgWarpInput[]
  /** Optional tile animation speed from LvlPrest.txt (`nAnimSpeed` when `dwAnimate !== 0`). */
  readonly animSpeed?: number
  /** Logical-room coord-list index per level-local cell (see {@link DrlgLogicalIndexGrid}). */
  readonly logicalIndex?: DrlgLogicalIndexGrid
  /** POPS visibility regions of preset maps in this level (see {@link DrlgPopBox}). */
  readonly pops?: readonly DrlgPopBox[]
}

/** Tables the mapping needs besides the DRLG output. */
export interface DrlgMapContext {
  readonly tables: DrlgTables
  /** Parsed DT1 libraries keyed by {@link normalizeDrlgPath}. */
  readonly dt1: ReadonlyMap<string, Dt1>
  /** SuperUniques.txt `Superunique` column, by row. */
  readonly superUniqueIds: readonly string[]
}

/** Which edge of the level an entrance sits on (world-graph `Side`). */
export type DrlgSide = 'north' | 'east' | 'south' | 'west'

/**
 * A way into or out of the level: the fields of a `WildernessEntrance` (what the bake's
 * buildSceneLinks reads) except the display label, which the bake adds, plus `span` for seams.
 */
export interface DrlgEntrance {
  /** Anchor cell (tiles, level-local). */
  readonly x: number
  readonly y: number
  /** One step inside from the anchor. */
  readonly interiorX: number
  readonly interiorY: number
  readonly toLevelId: number
  readonly side: DrlgSide | null
  readonly kind: 'gate' | 'preset'
  /**
   * Seams only: the stretch of this level's edge (tiles along the side, `from` inclusive, `to`
   * exclusive) where the opening is. The bake searches the walkable gap inside it.
   */
  readonly span?: { readonly from: number; readonly to: number }
  /** Warps only: the UNIT_TILE position in sub-tiles (level-local) and its LvlWarp.txt Id. */
  readonly warp?: { readonly subX: number; readonly subY: number; readonly lvlWarpId: number }
}

/** A fixed monster the planner anchors to its preset position. */
export interface DrlgLandmark {
  /** The monster planner's id (SuperUniques.txt `Superunique`, or 'Blood Raven'). */
  readonly id: string
  readonly tileX: number
  readonly tileY: number
  readonly subX: number
  readonly subY: number
}

/** One tile reference written into the canvas, with the library D2 took it from. */
export interface DrlgCellRef {
  readonly x: number
  readonly y: number
  readonly kind: DrlgTileKind
  readonly style: number
  readonly sequence: number
  readonly type: number
  /** Index into {@link DrlgLevelMap.dt1Names}. */
  readonly library: number
  /** Index into the DT1 library's `tiles` array. */
  readonly tile: number
  readonly hidden: boolean
}

export interface DrlgLevelMapStats {
  readonly walls: number
  readonly floors: number
  readonly shadows: number
  /** Type-4 halves skipped because the renderer draws them with their type-3 tile. */
  readonly cornerCompanions: number
  /** Tiles whose pTile is null (D2CMP found no tile): D2 draws nothing for them. */
  readonly linkedInCanvas: number
  readonly withoutTile: number
  /** Linked tiles outside the canvas (belong to the neighbour's canvas). */
  readonly linkedOutside: number
  readonly objects: number
  readonly monsters: number
  readonly skippedInvalidObjects: number
}

/** One mapped level. */
export interface DrlgLevelMap {
  readonly levelId: number
  readonly coord: DrlgRect
  readonly flags: number
  /** The canvas: (width + 1) x (height + 1) cells, like a DS1 of the level's size. */
  readonly ds1: Ds1
  /** DT1 libraries (normalized archive paths) in renderer library order; per-cell `dt1Mask` bits index it. */
  readonly dt1Names: readonly string[]
  readonly entrances: readonly DrlgEntrance[]
  readonly landmarks: readonly DrlgLandmark[]
  /** Every tile reference written into the canvas (for the DT1-mask ambiguity audit). */
  readonly refs: readonly DrlgCellRef[]
  readonly stats: DrlgLevelMapStats
  /** Optional tile animation speed from LvlPrest.txt (`nAnimSpeed` when `dwAnimate !== 0`). */
  readonly animSpeed?: number
  /** Logical-room coord-list index per level-local cell, from {@link DrlgLevelInput.logicalIndex}. */
  readonly logicalIndex?: DrlgLogicalIndexGrid
  /** POPS visibility regions of preset maps in this level, from {@link DrlgLevelInput.pops}. */
  readonly pops?: readonly DrlgPopBox[]
}

/**
 * DT1 libraries DRLGROOMTILE_LoadDT1FilesForRoom loads for every room regardless of its mask
 * (DrlgRoomTile.cpp:1249-1256): they come first so a cell mask can always name them.
 */
export const DRLG_UNIVERSAL_DT1: readonly string[] = [
  'DATA\\GLOBAL\\TILES\\Act1\\Outdoors\\Blank.dt1',
  'DATA\\GLOBAL\\TILES\\Act1\\Barracks\\InvisWal.dt1',
  'DATA\\GLOBAL\\TILES\\Act1\\Barracks\\Warp.dt1',
].map(normalizeDrlgPath)

/**
 * All levels of an act (or all acts) in Levels.txt (1..nLevelsTxtRecordCount - 1), ascending.
 *
 * @param tables - the DRLG tables.
 * @param act - optional 0-indexed act number (0..4).
 * @returns level ids.
 */
export function actLevelIds(tables: DrlgTables, act?: number): number[] {
  const out: number[] = []
  for (let id = 1; id < tables.nLevelsTxtRecordCount; id += 1) {
    if (act !== undefined && DRLG_GetActNoFromLevelId(id) !== act) continue
    out.push(id)
  }
  return out
}

/**
 * The levels D2 generates with the outdoor DRLG (Levels.txt DrlgType 3), ascending.
 *
 * @param tables - the DRLG tables.
 * @param act - optional 0-indexed act number (0..4).
 * @returns level ids.
 */
export function outdoorLevelIds(tables: DrlgTables, act?: number): number[] {
  const out: number[] = []
  for (let id = 1; id < tables.nLevelsTxtRecordCount; id += 1) {
    if (act !== undefined && DRLG_GetActNoFromLevelId(id) !== act) continue
    if (DATATBLS_GetLevelDefRecord(tables, id).dwDrlgType === DRLGTYPE_OUTDOOR) out.push(id)
  }
  return out
}

/**
 * The Act I levels D2 generates with the outdoor DRLG (Levels.txt DrlgType 3), ascending.
 *
 * @param tables - the DRLG tables.
 * @returns level ids.
 */
export function act1OutdoorLevelIds(tables: DrlgTables): number[] {
  return outdoorLevelIds(tables, 0)
}

const SIDE_OF_ALTDIR: Readonly<Record<number, DrlgSide>> = {
  [ALTDIR_WEST]: 'west',
  [ALTDIR_NORTH]: 'north',
  [ALTDIR_EAST]: 'east',
  [ALTDIR_SOUTH]: 'south',
}

function sideOfAltDir(dir: number, what: string): DrlgSide {
  const side = SIDE_OF_ALTDIR[dir]
  if (side === undefined) throw new Error(`${what}: direction ${dir} is not an ALTDIR`)
  return side
}

function emptyWall(): Ds1Wall {
  return { prop1: 0, sequence: 0, style: 0, type: 0, unknown1: 0, unknown2: 0, hidden: false }
}

function emptyFloor(): Ds1Floor {
  return { prop1: 0, sequence: 0, style: 0, unknown1: 0, unknown2: 0, hidden: false }
}

/** Mutable per-cell collector. */
interface CellBuild {
  walls: { layer: number; order: number; wall: Ds1Wall }[]
  floors: { layer: number; order: number; floor: Ds1Floor }[]
  shadows: Ds1Floor[]
  mask: number
}

/**
 * The DT1 library order for a level: the universal libraries, then the libraries of the level's
 * LvlTypes row in `File 1..32` order. Only libraries some tile uses are listed (plus the universal
 * three, which DRLGROOMTILE_LoadDT1FilesForRoom always loads).
 */
function libraryOrder(tables: DrlgTables, levelType: number, used: ReadonlySet<string>, levelId: number): string[] {
  const order: string[] = [...DRLG_UNIVERSAL_DT1]
  const listed = new Set(order)
  for (const f of DATATBLS_GetLvlTypesTxtRecord(tables, levelType).szFile) {
    if (f.length <= 1) continue
    const key = normalizeDrlgPath(f)
    if (listed.has(key) || !used.has(key)) continue
    order.push(key)
    listed.add(key)
  }
  for (const lib of used) {
    if (!listed.has(lib)) {
      throw new Error(`level ${levelId}: tile library ${lib} is neither universal nor in LvlTypes row ${levelType}`)
    }
  }
  if (order.length > 32) throw new Error(`level ${levelId}: ${order.length} DT1 libraries do not fit a 32-bit cell mask`)
  return order
}

/**
 * Map one generated level (outdoor, maze, or preset).
 *
 * @param input - the level, from the DRLG dump.
 * @param ctx - tables, DT1 libraries and names.
 * @returns the mapped level.
 */
export function buildDrlgLevelMap(input: DrlgLevelInput, ctx: DrlgMapContext): DrlgLevelMap {
  const { levelId, coord } = input
  const nAct = DRLG_GetActNoFromLevelId(levelId)
  const cellsX = coord.width + 1
  const cellsY = coord.height + 1

  // ---- tiles -> canvas ----
  const cells: CellBuild[] = []
  for (let i = 0; i < cellsX * cellsY; i += 1) cells.push({ walls: [], floors: [], shadows: [], mask: 0 })
  const seen = new Set<string>()
  const used = new Set<string>()
  const placed: { t: DrlgTileInput; style: number; sequence: number; type: number; hidden: boolean }[] = []
  let cornerCompanions = 0
  let withoutTile = 0
  let linkedInCanvas = 0
  let linkedOutside = 0
  const topCornerRights = new Set<string>()
  const topCornerLefts: { t: DrlgTileInput; style: number; sequence: number }[] = []

  for (const t of input.tiles) {
    if (seen.has(t.key)) continue
    seen.add(t.key)
    const linked = !t.key.startsWith(`${levelId}/`)
    if (t.x < 0 || t.y < 0 || t.x >= cellsX || t.y >= cellsY) {
      if (!linked) throw new Error(`level ${levelId}: owned tile ${t.key} at (${t.x}, ${t.y}) is outside the ${cellsX}x${cellsY} canvas`)
      linkedOutside += 1
      continue
    }
    if (linked) linkedInCanvas += 1
    if (t.tile === null) {
      withoutTile += 1
      continue
    }
    const lib = ctx.dt1.get(t.tile.library)
    if (lib === undefined) throw new Error(`level ${levelId}: tile ${t.key} uses DT1 ${t.tile.library}, which is not loaded`)
    const header = lib.tiles[t.tile.index]
    if (header === undefined) throw new Error(`level ${levelId}: tile ${t.key}: ${t.tile.library} has no tile #${t.tile.index}`)
    if (header.type !== t.tileType) {
      throw new Error(`level ${levelId}: tile ${t.key}: nTileType ${t.tileType} but DT1 tile #${t.tile.index} of ${t.tile.library} is type ${header.type}`)
    }
    const kindOk = t.kind === 'floor' ? header.type === TILETYPE_FLOOR
      : t.kind === 'shadow' ? header.type === TILETYPE_SHADOW
        : header.type !== TILETYPE_FLOOR && header.type !== TILETYPE_SHADOW
    if (!kindOk) throw new Error(`level ${levelId}: tile ${t.key} is a ${t.kind} of DT1 type ${header.type}`)
    if (header.type === TILETYPE_WALL_TOP_CORNER_LEFT) {
      // D2 stores the left half of a top corner as its own tile data next to the type-3 tile
      // (DRLGROOMTILE_InitWallTileData); buildIsoMapScene draws that half itself for every type-3 wall.
      used.add(t.tile.library)
      topCornerLefts.push({ t, style: header.style, sequence: header.sequence })
      continue
    }
    if (header.type === TILETYPE_WALL_TOP_CORNER_RIGHT) topCornerRights.add(`${t.x},${t.y},${header.style},${header.sequence}`)
    used.add(t.tile.library)
    placed.push({ t, style: header.style, sequence: header.sequence, type: header.type, hidden: (t.flags & MAPTILE_HIDDEN) !== 0 })
  }
  for (const c of topCornerLefts) {
    if (!topCornerRights.has(`${c.t.x},${c.t.y},${c.style},${c.sequence}`)) {
      throw new Error(`level ${levelId}: top-corner-left tile ${c.t.key} at (${c.t.x}, ${c.t.y}) has no top-corner-right partner`)
    }
    cornerCompanions += 1
  }

  const dt1Names = libraryOrder(ctx.tables, input.levelType, used, levelId)
  const libIndex = new Map(dt1Names.map((name, i) => [name, i]))
  const topCornerLeftByKey = new Map<string, { library: number; tile: number }[]>()
  for (const c of topCornerLefts) {
    const k = `${c.t.x},${c.t.y},${c.style},${c.sequence}`
    const list = topCornerLeftByKey.get(k) ?? []
    list.push({ library: libIndex.get(c.t.tile!.library)!, tile: c.t.tile!.index })
    topCornerLeftByKey.set(k, list)
  }
  const refs: DrlgCellRef[] = []
  let order = 0
  let walls = 0
  let floors = 0
  let shadows = 0
  for (const p of placed) {
    const cell = cells[p.t.y * cellsX + p.t.x]!
    const library = libIndex.get(p.t.tile!.library)!
    const tileIndex = p.t.tile!.index
    cell.mask |= 1 << library
    const layer = (p.t.flags >>> MAPTILE_LAYER_SHIFT) & MAPTILE_LAYER_MASK
    const unwalkable = (p.t.flags & MAPTILE_UNWALKABLE) !== 0
    // prop1 only marks the slot as used for the renderer; hidden tiles (warp lit tiles, etc.) are kept
    // hidden exactly as D2 adds them.
    if (p.t.kind === 'floor') {
      cell.floors.push({ layer, order: order++, floor: { prop1: 1, sequence: p.sequence, style: p.style, unknown1: 0, unknown2: 0, hidden: p.hidden, dt1Library: library, dt1Tile: tileIndex, ...(unwalkable ? { unwalkable: true } : {}) } })
      floors += 1
    } else if (p.t.kind === 'shadow') {
      cell.shadows.push({ prop1: 1, sequence: p.sequence, style: p.style, unknown1: 0, unknown2: 0, hidden: p.hidden, dt1Library: library, dt1Tile: tileIndex })
      shadows += 1
    } else {
      let companionDt1Library: number | undefined
      let companionDt1Tile: number | undefined
      if (p.type === TILETYPE_WALL_TOP_CORNER_RIGHT) {
        const k = `${p.t.x},${p.t.y},${p.style},${p.sequence}`
        const companion = topCornerLeftByKey.get(k)?.shift()
        if (companion !== undefined) {
          companionDt1Library = companion.library
          companionDt1Tile = companion.tile
          cell.mask |= 1 << companion.library
        }
      }
      cell.walls.push({
        layer,
        order: order++,
        wall: {
          prop1: 1,
          sequence: p.sequence,
          style: p.style,
          type: p.type,
          unknown1: 0,
          unknown2: 0,
          hidden: p.hidden,
          dt1Library: library,
          dt1Tile: tileIndex,
          ...(companionDt1Library !== undefined ? { companionDt1Library } : {}),
          ...(companionDt1Tile !== undefined ? { companionDt1Tile } : {}),
          ...(p.t.fadeBox !== undefined ? { fadeBox: p.t.fadeBox } : {}),
          ...((p.t.flags & MAPTILE_TREES) !== 0 ? { noFade: true } : {}),
          ...((p.t.flags & MAPTILE_UNK_0x200) !== 0 ? { revealHidden: true } : {}),
          ...((p.t.flags & MAPTILE_FLOOR_LINKER_PATH) !== 0 ? { popLinkage: true } : {}),
        },
      })
      walls += 1
    }
    refs.push({ x: p.t.x, y: p.t.y, kind: p.t.kind, style: p.style, sequence: p.sequence, type: p.type, library, tile: tileIndex, hidden: p.hidden })
  }

  let wallLayers = 1
  let floorLayers = 1
  let shadowLayers = 1
  for (const c of cells) {
    wallLayers = Math.max(wallLayers, c.walls.length)
    floorLayers = Math.max(floorLayers, c.floors.length)
    shadowLayers = Math.max(shadowLayers, c.shadows.length)
  }
  const byLayer = <T extends { layer: number; order: number }>(a: T, b: T): number => a.layer - b.layer || a.order - b.order
  const rows: Ds1Cell[][] = []
  for (let y = 0; y < cellsY; y += 1) {
    const row: Ds1Cell[] = []
    for (let x = 0; x < cellsX; x += 1) {
      const c = cells[y * cellsX + x]!
      const cw = c.walls.sort(byLayer).map(w => w.wall)
      const cf = c.floors.sort(byLayer).map(f => f.floor)
      const cs = [...c.shadows]
      while (cw.length < wallLayers) cw.push(emptyWall())
      while (cf.length < floorLayers) cf.push(emptyFloor())
      while (cs.length < shadowLayers) cs.push(emptyFloor())
      row.push({ walls: cw, floors: cf, shadows: cs, substitutions: [], ...(c.mask !== 0 ? { dt1Mask: c.mask >>> 0 } : {}) })
    }
    rows.push(row)
  }

  // ---- units -> DS1 objects, landmarks, warp entrances ----
  const objSlotOf = new Map<number, number>()
  for (let slot = DS1_OBJPRESET_SLOTS - 1; slot >= 0; slot -= 1) {
    objSlotOf.set(DRLGPRESET_GetObjectIndexFromObjPreset(nAct, slot), slot) // lowest slot wins
  }
  const crossActObjOf = new Map<number, { readonly act: number; readonly slot: number }>()
  for (let a = 4; a >= 0; a -= 1) {
    for (let slot = DS1_OBJPRESET_SLOTS - 1; slot >= 0; slot -= 1) {
      const objIdx = DRLGPRESET_GetObjectIndexFromObjPreset(a, slot)
      if (objIdx >= 0 && objIdx !== OBJECT_CLASS_INVALID_PRESET) {
        crossActObjOf.set(objIdx, { act: a + 1, slot })
      }
    }
  }
  const monSection = DATATBLS_GetMonPresetTxtActSection(ctx.tables, nAct)
  if (monSection === null) throw new Error(`level ${levelId}: MonPreset has no act ${nAct + 1} section`)
  const nMonStats = ctx.tables.nMonStatsTxtRecordCount
  const nSU = ctx.tables.nSuperUniquesTxtRecordCount
  const monIdOf = new Map<number, number>()
  for (let i = monSection.count - 1; i >= 0; i -= 1) {
    const r = ctx.tables.monPreset[monSection.start + i]!
    let unit: number
    switch (r.nType) {
      case 0: unit = r.wPlace + nSU + nMonStats; break
      case 1: unit = r.wPlace; break
      case 2: unit = r.wPlace + nMonStats; break
      default: continue // DRLGPRESET_ParseDS1File maps it to -1, which is never allocated
    }
    monIdOf.set(unit, i) // lowest DS1 id wins (duplicates carry the same Place)
  }
  const crossActMonOf = new Map<number, { readonly act: number; readonly id: number }>()
  for (let a = 4; a >= 0; a -= 1) {
    const sec = DATATBLS_GetMonPresetTxtActSection(ctx.tables, a)
    if (sec === null) continue
    for (let i = sec.count - 1; i >= 0; i -= 1) {
      const r = ctx.tables.monPreset[sec.start + i]!
      let unit: number
      switch (r.nType) {
        case 0: unit = r.wPlace + nSU + nMonStats; break
        case 1: unit = r.wPlace; break
        case 2: unit = r.wPlace + nMonStats; break
        default: continue
      }
      crossActMonOf.set(unit, { act: a + 1, id: i })
    }
  }

  const objects: Ds1Object[] = []
  const landmarks: DrlgLandmark[] = []
  const entrances: DrlgEntrance[] = []
  let nObjects = 0
  let nMonsters = 0
  let skippedInvalidObjects = 0
  for (const u of input.units) {
    switch (u.type) {
      case UNIT_OBJECT: {
        if (u.index === OBJECT_CLASS_INVALID_PRESET) { skippedInvalidObjects += 1; break }
        if (u.index < 0) throw new Error(`level ${levelId}: object unit with class ${u.index}`)
        const slot = objSlotOf.get(u.index)
        const crossObj = slot === undefined ? crossActObjOf.get(u.index) : undefined
        objects.push({
          type: DS1_TYPE_OBJECT,
          id: slot ?? crossObj?.slot ?? u.index + DS1_OBJPRESET_SLOTS,
          x: u.subX,
          y: u.subY,
          flags: u.spawned,
          ...(crossObj !== undefined ? { act: crossObj.act } : {}),
        })
        nObjects += 1
        // Throne of Destruction (131, wthrone.ds1) connects to The Worldstone Chamber (132, Vis1=132,
        // Warp1=82) via the preset object BaalsPortal (Objects.txt row 563, "The Worldstone Chamber")
        // rather than a TILETYPE_WARP marker tile.
        if (levelId === 131 && u.index === 563) {
          const cx = Math.floor(u.subX / SUBTILES_PER_TILE)
          const cy = Math.floor(u.subY / SUBTILES_PER_TILE)
          entrances.push({
            x: cx,
            y: cy,
            interiorX: cx,
            interiorY: cy,
            toLevelId: 132,
            side: null,
            kind: 'preset',
            warp: { subX: u.subX, subY: u.subY, lvlWarpId: DATATBLS_GetLevelDefRecord(ctx.tables, levelId).dwWarp[1] ?? 82 },
          })
        }
        break
      }
      case UNIT_MONSTER: {
        const directId = monIdOf.get(u.index) ?? (u.index >= 0 && u.index < nMonStats ? u.index + DS1_MONPRESET_SLOTS : undefined)
        const cross = directId === undefined ? crossActMonOf.get(u.index) : undefined
        const id = directId ?? cross?.id
        if (id === undefined) throw new Error(`level ${levelId}: monster unit ${u.index} has no act ${nAct + 1} MonPreset row`)
        objects.push({
          type: DS1_TYPE_MONSTER,
          id,
          x: u.subX,
          y: u.subY,
          flags: u.spawned,
          ...(cross !== undefined ? { act: cross.act } : {}),
        })
        nMonsters += 1
        const tileX = Math.floor(u.subX / SUBTILES_PER_TILE)
        const tileY = Math.floor(u.subY / SUBTILES_PER_TILE)
        if (u.index >= nMonStats && u.index < nMonStats + nSU) {
          const su = ctx.superUniqueIds[u.index - nMonStats]
          if (su === undefined || su === '') throw new Error(`level ${levelId}: SuperUnique row ${u.index - nMonStats} has no id`)
          landmarks.push({ id: su, tileX, tileY, subX: u.subX, subY: u.subY })
        } else if (u.index >= nMonStats + nSU) {
          const special = MONPLACE_LANDMARKS.get(u.index - nMonStats - nSU)
          if (special !== undefined) landmarks.push({ id: special, tileX, tileY, subX: u.subX, subY: u.subY })
        }
        break
      }
      case UNIT_TILE: {
        const matches = input.warps.filter(w => w.room === u.room && w.lvlWarpId === u.index)
        const to = [...new Set(matches.map(w => w.toLevelId))]
        if (to.length !== 1) {
          throw new Error(`level ${levelId} room ${u.room}: UNIT_TILE ${u.index} matches ${to.length} warp destinations (${to.join(', ')})`)
        }
        const cx = Math.floor(u.subX / SUBTILES_PER_TILE)
        const cy = Math.floor(u.subY / SUBTILES_PER_TILE)
        entrances.push({
          x: cx,
          y: cy,
          interiorX: cx,
          interiorY: cy,
          toLevelId: to[0]!,
          side: null,
          kind: 'preset',
          warp: { subX: u.subX, subY: u.subY, lvlWarpId: u.index },
        })
        break
      }
      default:
        throw new Error(`level ${levelId} room ${u.room}: unexpected preset unit type ${u.type} (index ${u.index})`)
    }
  }

  // The Worldstone Chamber (132, wstone01.ds1) declares Vis0=131, Warp0=81 in Levels.txt with
  // Position=1 (boss chamber entry at the top of the bridge, cell 16,22 / sub-tile 82,112) and no
  // TILETYPE_WARP tile inside the preset DS1.
  if (levelId === 132 && !entrances.some(e => e.toLevelId === 131)) {
    entrances.push({
      x: 16,
      y: 22,
      interiorX: 16,
      interiorY: 22,
      toLevelId: 131,
      side: null,
      kind: 'preset',
      warp: { subX: 82, subY: 112, lvlWarpId: DATATBLS_GetLevelDefRecord(ctx.tables, levelId).dwWarp[0] ?? 81 },
    })
  }

  // ---- seams ----
  entrances.push(...seamEntrances(input))

  const ds1: Ds1 = {
    version: 18,
    width: cellsX,
    height: cellsY,
    act: nAct + 1,
    substitutionType: 0,
    wallLayers,
    floorLayers,
    cells: rows,
    objects,
    npcPathOffset: null,
  }
  return {
    levelId,
    coord,
    flags: input.flags,
    ds1,
    dt1Names,
    entrances,
    landmarks,
    refs,
    stats: {
      walls, floors, shadows, cornerCompanions, withoutTile, linkedInCanvas, linkedOutside,
      objects: nObjects, monsters: nMonsters, skippedInvalidObjects,
    },
    ...(input.animSpeed !== undefined ? { animSpeed: input.animSpeed } : {}),
    ...(input.logicalIndex !== undefined ? { logicalIndex: input.logicalIndex } : {}),
    ...(input.pops !== undefined && input.pops.length > 0 ? { pops: input.pops } : {}),
  }
}

/** How far the renderer's tile choice can stray from D2's for one mapped level. */
export interface DrlgDt1Ambiguity {
  /** DT1 libraries of the level ({@link DrlgLevelMap.dt1Names}). */
  readonly libraries: number
  /** Tile references written into the canvas. */
  readonly refs: number
  /**
   * References whose exact (style, sequence, type) group under their cell's DT1 mask holds more than
   * one tile. The renderer draws the variant with its own per-cell hash (scene fidelity 'layout'); D2
   * rolled it with the room seed (DRLGROOMTILE_GetTileCache), and the port records that roll.
   */
  readonly variantGroups: number
  /** References whose group under the cell mask spans more than one library: the renderer may draw a tile of a library D2 did not take it from. */
  readonly crossLibrary: number
  /** The same count with one pool for the whole level (no cell masks): what the cell masks prevent. */
  readonly crossLibraryLevelWide: number
}

/**
 * The DT1-mask ambiguity audit of a mapped level: resolves every tile reference the way
 * `buildIsoMapScene` does (exact style:sequence:type key, {@link dt1MaskAllows}) and counts the
 * references whose candidates are not pinned down to D2's library.
 *
 * @param map - the mapped level.
 * @param libraries - the parsed libraries of `map.dt1Names`, in that order.
 * @returns the counts.
 */
export function auditDrlgDt1Ambiguity(map: DrlgLevelMap, libraries: readonly Dt1[]): DrlgDt1Ambiguity {
  if (libraries.length !== map.dt1Names.length) {
    throw new Error(`level ${map.levelId}: ${libraries.length} libraries for ${map.dt1Names.length} DT1 names`)
  }
  // style:sequence:type -> tiles per library
  const groups = new Map<string, number[]>()
  libraries.forEach((library, at) => {
    for (const tile of library.tiles) {
      const key = `${tile.style}:${tile.sequence}:${tile.type}`
      let counts = groups.get(key)
      if (counts === undefined) {
        counts = new Array<number>(libraries.length).fill(0)
        groups.set(key, counts)
      }
      counts[at]! += 1
    }
  })
  let variantGroups = 0
  let crossLibrary = 0
  let crossLibraryLevelWide = 0
  for (const ref of map.refs) {
    const counts = groups.get(`${ref.style}:${ref.sequence}:${ref.type}`)
    if (counts === undefined || counts[ref.library] === 0) {
      throw new Error(`level ${map.levelId}: ${ref.kind} ${ref.style}:${ref.sequence}:${ref.type} at (${ref.x}, ${ref.y}) is not in its library ${map.dt1Names[ref.library]}`)
    }
    const mask = map.ds1.cells[ref.y]?.[ref.x]?.dt1Mask
    if (mask === undefined) throw new Error(`level ${map.levelId}: cell (${ref.x}, ${ref.y}) holds a tile but has no DT1 mask`)
    let tilesInCell = 0
    let librariesInCell = 0
    let librariesInLevel = 0
    counts.forEach((n, library) => {
      if (n === 0) return
      librariesInLevel += 1
      if (!dt1MaskAllows(mask, library)) return
      librariesInCell += 1
      tilesInCell += n
    })
    if (tilesInCell > 1) variantGroups += 1
    if (librariesInCell > 1) crossLibrary += 1
    if (librariesInLevel > 1) crossLibraryLevelWide += 1
  }
  return { libraries: libraries.length, refs: map.refs.length, variantGroups, crossLibrary, crossLibraryLevelWide }
}

/**
 * The level's seams to its outdoor/preset neighbours, one per level link (pOutdoors->pRoomData).
 *
 * Outdoor-outdoor links are the grid-2 cells DRLGOUTPLACE_PlaceAct1245OutdoorBorders flags
 * GRID2_LVL_LINK: the border cell in the middle of each linked vertex edge, which gets the open border
 * preset (picked file 3, or 4 on the Burial Grounds). Links whose vertex edge carries flag 2 (the town
 * transition, the Monastery Gate approach) get no border cell: their opening is the neighbour-specific
 * preset, somewhere along the shared edge, so the whole shared stretch is the span.
 */
function seamEntrances(input: DrlgLevelInput): DrlgEntrance[] {
  const { levelId, coord, grid2 } = input
  const out: DrlgEntrance[] = []
  const linkCellsOf = new Map<number, { gx: number; gy: number }[]>()
  if (input.drlgType === DRLGTYPE_OUTDOOR) {
    if (grid2.w * TILES_PER_GRID_CELL !== coord.width || grid2.h * TILES_PER_GRID_CELL !== coord.height) {
      throw new Error(`level ${levelId}: grid-2 ${grid2.w}x${grid2.h} does not cover ${coord.width}x${coord.height} tiles`)
    }
    if (input.levelType === LVLTYPE_ACT1_WILDERNESS || (input.levelType === LVLTYPE_ACT4_MESA && levelId !== LEVEL_CHAOSSANCTUM)) {
      for (let gy = 0; gy < grid2.h; gy += 1) {
        for (let gx = 0; gx < grid2.w; gx += 1) {
          if (!(grid2.cells[gy * grid2.w + gx]! & GRID2_LVL_LINK)) continue
          const onW = gx === 0
          const onE = gx === grid2.w - 1
          const onN = gy === 0
          const onS = gy === grid2.h - 1
          if (Number(onW) + Number(onE) + Number(onN) + Number(onS) !== 1) {
            throw new Error(`level ${levelId}: level-link cell (${gx}, ${gy}) is not on exactly one border`)
          }
          const dir = onW ? ALTDIR_WEST : onE ? ALTDIR_EAST : onN ? ALTDIR_NORTH : ALTDIR_SOUTH
          // World tiles covered by the cell along its side.
          const horizontal = dir === ALTDIR_NORTH || dir === ALTDIR_SOUTH
          const from = (horizontal ? coord.x + gx * TILES_PER_GRID_CELL : coord.y + gy * TILES_PER_GRID_CELL)
          const to = from + TILES_PER_GRID_CELL
          const owners = input.orths.filter(o => {
            if (o.dir !== dir) return false
            const lo = horizontal ? o.box.x : o.box.y
            const hi = lo + (horizontal ? o.box.width : o.box.height)
            return from >= lo && to <= hi
          })
          if (owners.length !== 1) {
            throw new Error(`level ${levelId}: level-link cell (${gx}, ${gy}) matches ${owners.length} neighbour links`)
          }
          const list = linkCellsOf.get(owners[0]!.level) ?? []
          list.push({ gx, gy })
          linkCellsOf.set(owners[0]!.level, list)
        }
      }
    }
  }

  const pushSeam = (toLevelId: number, side: DrlgSide, from: number, to: number): void => {
    const mid = Math.floor((from + to - 1) / 2)
    const edgeX = side === 'west' ? 0 : side === 'east' ? coord.width - 1 : mid
    const edgeY = side === 'north' ? 0 : side === 'south' ? coord.height - 1 : mid
    const inX = side === 'west' ? 1 : side === 'east' ? coord.width - 2 : mid
    const inY = side === 'north' ? 1 : side === 'south' ? coord.height - 2 : mid
    out.push({
      x: edgeX,
      y: edgeY,
      interiorX: inX,
      interiorY: inY,
      toLevelId,
      side,
      kind: 'gate',
      span: { from, to },
    })
  }

  for (const o of input.orths) {
    const side = sideOfAltDir(o.dir, `level ${levelId} link to ${o.level}`)
    const horizontal = side === 'north' || side === 'south'
    const cellsOnLink = linkCellsOf.get(o.level) ?? []
    let from: number
    let to: number
    if (cellsOnLink.length > 1) {
      throw new Error(`level ${levelId}: ${cellsOnLink.length} level-link cells for the link to ${o.level}`)
    } else if (cellsOnLink.length === 1) {
      const c = cellsOnLink[0]!
      from = (horizontal ? c.gx : c.gy) * TILES_PER_GRID_CELL
      to = from + TILES_PER_GRID_CELL
    } else {
      // Shared edge of the two rectangles, in level-local tiles along the side.
      const lo = horizontal ? Math.max(coord.x, o.box.x) : Math.max(coord.y, o.box.y)
      const hi = horizontal
        ? Math.min(coord.x + coord.width, o.box.x + o.box.width)
        : Math.min(coord.y + coord.height, o.box.y + o.box.height)
      if (hi <= lo) throw new Error(`level ${levelId}: the link to ${o.level} (${side}) shares no edge`)
      from = lo - (horizontal ? coord.x : coord.y)
      to = hi - (horizontal ? coord.x : coord.y)
    }
    pushSeam(o.level, side, from, to)
  }

  // Preset-adjacent seams that D2Common connects via fixed DS1 border presets rather than pOutdoors->pRoomData:
  // - Chaos Sanctum (108): south entrance bridge to River of Flame (107) at x=48..72 (DiabloEntry at grid 6,12).
  // - Bloody Foothills (110): east town gate to Harrogath (109, y=0..40) and west barricade transition to Frigid Highlands (111, y=0..32).
  // - Frigid Highlands (111): east siege transition to Bloody Foothills (110, y=height-32..height).
  if (levelId === LEVEL_CHAOSSANCTUM) {
    if (!out.some(e => e.toLevelId === LEVEL_RIVEROFFLAME)) pushSeam(LEVEL_RIVEROFFLAME, 'south', 48, 72)
  } else if (levelId === LEVEL_BLOODYFOOTHILLS) {
    if (!out.some(e => e.toLevelId === LEVEL_HARROGATH)) pushSeam(LEVEL_HARROGATH, 'east', 0, Math.min(coord.height, 40))
    if (!out.some(e => e.toLevelId === LEVEL_ID_ACT5_BARRICADE_1)) pushSeam(LEVEL_ID_ACT5_BARRICADE_1, 'west', 0, Math.min(coord.height, 32))
  } else if (levelId === LEVEL_ID_ACT5_BARRICADE_1) {
    if (!out.some(e => e.toLevelId === LEVEL_BLOODYFOOTHILLS)) pushSeam(LEVEL_BLOODYFOOTHILLS, 'east', Math.max(0, coord.height - 32), coord.height)
  }

  return out
}

/** Which tile array a {@link DumpTileRef} names, as the adapter's tile kind. */
const TILE_KIND_OF_ARRAY = { w: 'wall', f: 'floor', r: 'shadow' } as const

/**
 * The 10 non-outdoor seamless level pairs in Levels.txt (towns, Monastery Gate/Courtyard/Barracks,
 * Cathedral, River of Flame <-> Chaos Sanctum) whose abutting level coordinates in `dump.act`
 * define their shared border seam.
 */
const NON_OUTDOOR_SEAM_PAIRS: readonly (readonly [number, number])[] = [
  [1, 2],
  [7, 26],
  [26, 27],
  [27, 28],
  [32, 33],
  [40, 41],
  [75, 76],
  [103, 104],
  [107, 108],
  [109, 110],
]

/**
 * The adapter input for one level of a schema-3 DRLG dump.
 *
 * The native oracle's JSON and the port's `dumpAct1` have the same shape, so both go through the same
 * mapping and a comparison of the two compares like with like. The dump must come from an act run with
 * activation: every room of the level activated, `mapTiles` being the final state after all of them.
 *
 * - tiles: each room's own tile data, i.e. the entries DRLGROOMTILE_InitWallTileData /
 *   InitFloorTileData / InitShadowTileData filled (`pTileGrid->nWalls/nFloors/nShadows` of the
 *   `pTiles` arrays; the rest of each allocation stays zeroed and is never drawn), then the tiles the
 *   room's pMapLinks point at (DRLGROOMTILE_LinkedTileDataManager's merge of shared room edges, which
 *   reaches rooms of the neighbouring level across a seam).
 * - units: `mapTiles.units`, the room's pPresetUnits after DRLGROOMTILE_AddRoomMapTiles (so with the
 *   UNIT_TILE units of DRLGROOMTILE_AddWarp), moved from room-relative to level-local sub-tiles.
 * - warps: the room's pRoomTiles chain.
 *
 * @param dump - schema-3 dump of an act run with activation.
 * @param levelId - the level to map.
 * @param tables - the DRLG tables the dump was made with (for LvlWarp.txt rows).
 * @returns the adapter input.
 */
export function drlgLevelInputFromDump(dump: DrlgDump, levelId: number, tables: DrlgTables): DrlgLevelInput {
  if (dump.schema !== 3) throw new Error(`DRLG dump schema ${String(dump.schema)}, expected 3`)
  const act = dump.act.find(a => a.id === levelId)
  if (act === undefined) throw new Error(`level ${levelId}: not in the dump's act section`)
  const levelsById = new Map<number, DumpLevel>(dump.levels.map(l => [l.id, l]))
  const level = levelsById.get(levelId)
  if (level === undefined) throw new Error(`level ${levelId}: not generated in the dump`)
  const levelGrid = level.levelGrid
  if (!levelGrid) throw new Error(`level ${levelId}: the dump has no levelGrid stage`)
  let grid2 = levelGrid.grids[2] ?? { w: 0, h: 0, cells: [] }
  if (act.drlgType === DRLGTYPE_OUTDOOR && !levelGrid.grids[2]) {
    throw new Error(`level ${levelId}: pGrid[2] was never allocated`)
  }
  if (level.activation.length !== level.rooms.length) {
    throw new Error(`level ${levelId}: ${level.activation.length} of ${level.rooms.length} rooms activated (the dump must be made with activation)`)
  }
  let [levelX, levelY, levelW, levelH] = act.coord
  if (act.drlgType === DRLGTYPE_OUTDOOR) {
    // pOutdoors->pCoord is a union over nWidth, nHeight, nGridWidth, nGridHeight (8-tile grid cells).
    const [, , gridW, gridH] = levelGrid.coord
    if (gridW * TILES_PER_GRID_CELL !== levelW || gridH * TILES_PER_GRID_CELL !== levelH) {
      throw new Error(`level ${levelId}: outdoor grid ${gridW}x${gridH} does not cover the ${levelW}x${levelH} tiles of the level`)
    }
  } else if (act.drlgType === DRLGTYPE_MAZE && level.rooms.length > 0) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const room of level.rooms) {
      const [rx, ry, rw, rh] = room.coord
      if (rx < minX) minX = rx
      if (ry < minY) minY = ry
      if (rx + rw > maxX) maxX = rx + rw
      if (ry + rh > maxY) maxY = ry + rh
    }
    levelX = minX
    levelY = minY
    levelW = maxX - minX
    levelH = maxY - minY
  }

  let animSpeed: number | undefined
  for (const room of level.rooms) {
    if (room.preset) {
      const prest = DATATBLS_GetLvlPrestTxtRecord(tables, room.preset.prest)
      const speed = prest.nAnimSpeed > 0 ? prest.nAnimSpeed : prest.dwAnimate
      if (speed > 0) {
        animSpeed = speed
        break
      }
    }
  }

  const coordListOf = (ref: DumpCoordListRef, what: string): DumpCoordList => {
    const [refLevel, refRoom, , k] = ref
    const logical = levelsById.get(refLevel)?.activation[refRoom]?.mapTiles.logical
    const list = logical?.lists[k]
    if (list === undefined) throw new Error(`${what}: unk0x10 coord list ${ref.join('/')} is not in the dump`)
    return list
  }
  const place = (key: string, kind: DrlgTileKind, room: DumpCoord, t: DumpTile): DrlgTileInput => {
    const library = t[6] === null ? null : normalizeDrlgPath(t[6][0])
    // DRLGROOMTILE_GetTileCache (DrlgRoomTile.cpp:0x6FD88860): when D2CMP_10088_GetTiles finds no
    // matching tile in the room's masked DT1s (e.g. unoccupied Act 3 jungle 8x8 filler rooms whose
    // dwDT1Mask = 0x04 excludes Floor.dt1), it falls back to GetTiles(pTiles, 10, 0, 0) from Warp.dt1
    // (type 10) while preserving the non-10 nTileType (0 for floor). Those void filler cells have no
    // floor tile and remain unwalkable.
    const isMissingTileFallback = library === DRLG_UNIVERSAL_DT1[2] && t[7] !== 10
    // unk0x10: DRLGLOGIC_SetCoordListForTiles stores the wall's D2RoomCoordListStrc* (0 = NULL).
    let fadeBox: DrlgTileInput['fadeBox']
    if (typeof t[4] !== 'number') {
      const list = coordListOf(t[4], `level ${levelId} tile ${key}`)
      fadeBox = { index: list[0], x: list[3][0] - levelX, y: list[3][1] - levelY }
    } else if (t[4] !== 0) {
      throw new Error(`level ${levelId} tile ${key}: unk0x10 holds the non-pointer value ${t[4]}`)
    }
    return {
      key,
      kind,
      x: room[0] + t[2] - levelX,
      y: room[1] + t[3] - levelY,
      flags: t[5] >>> 0,
      tileType: t[7],
      tile: t[6] === null || isMissingTileFallback ? null : { library: library!, index: t[6][1] },
      ...(fadeBox !== undefined ? { fadeBox } : {}),
    }
  }
  const initialised = (level: DumpLevel, room: number, array: 'w' | 'f' | 'r'): { list: readonly DumpTile[]; count: number } => {
    const mt = level.activation[room]!.mapTiles
    const [list, count] = array === 'w' ? [mt.walls, mt.nWalls] : array === 'f' ? [mt.floors, mt.nFloors] : [mt.roofs, mt.nShadows]
    if (count < 0 || count > list.length) {
      throw new Error(`level ${level.id} room ${room}: ${count} initialised ${TILE_KIND_OF_ARRAY[array]} tiles but ${list.length} allocated`)
    }
    return { list, count }
  }

  const tiles: DrlgTileInput[] = []
  const units: DrlgUnitInput[] = []
  const warps: DrlgWarpInput[] = []
  level.rooms.forEach((room, r) => {
    const what = `level ${levelId} room ${r}`
    const mt = level.activation[r]!.mapTiles
    for (const array of ['w', 'f', 'r'] as const) {
      const { list, count } = initialised(level, r, array)
      for (let i = 0; i < count; i += 1) {
        tiles.push(place(`${levelId}/${r}/${array}/${i}`, TILE_KIND_OF_ARRAY[array], room.coord, list[i]!))
      }
    }
    for (const [, ref] of mt.links) {
      if (ref === null) throw new Error(`${what}: a map link without a tile`)
      const [refLevel, refRoom, array, index] = ref
      const owner = levelsById.get(refLevel)
      const ownerRoom = owner?.rooms[refRoom]
      if (owner === undefined || ownerRoom === undefined || owner.activation[refRoom] === undefined) {
        throw new Error(`${what}: linked tile ${ref.join('/')} is in a room the dump did not activate`)
      }
      const { list, count } = initialised(owner, refRoom, array)
      if (index < 0 || index >= count) {
        throw new Error(`${what}: linked tile ${ref.join('/')} is not one of the owner's ${count} initialised tiles`)
      }
      tiles.push(place(ref.join('/'), TILE_KIND_OF_ARRAY[array], ownerRoom.coord, list[index]!))
    }
    const subDX = SUBTILES_PER_TILE * (room.coord[0] - levelX)
    const subDY = SUBTILES_PER_TILE * (room.coord[1] - levelY)
    for (const [type, index, mode, x, y, spawned] of mt.units) {
      units.push({ room: r, type, index, mode, subX: x + subDX, subY: y + subDY, spawned })
    }
    for (const [destination, row] of mt.warps) {
      if (destination === null) throw new Error(`${what}: a warp without a destination room`)
      const record = tables.lvlWarp[row]
      if (record === undefined) throw new Error(`${what}: warp to level ${destination[0]} has LvlWarp.txt row ${row}`)
      warps.push({ room: r, lvlWarpId: record.dwLevelId, toLevelId: destination[0] })
    }
  })

  const orths: DrlgOrthInput[] = levelGrid.roomData.map(o => {
    if (o.level < 0 || o.box === null) throw new Error(`level ${levelId}: an outdoor link without a neighbour level`)
    return { level: o.level, dir: o.dir, box: { x: o.box[0], y: o.box[1], width: o.box[2], height: o.box[3] } }
  })
  for (const [a, b] of NON_OUTDOOR_SEAM_PAIRS) {
    if (a !== levelId && b !== levelId) continue
    const otherId = a === levelId ? b : a
    if (orths.some(o => o.level === otherId)) continue
    if (!levelsById.has(otherId)) continue
    const otherAct = dump.act.find(x => x.id === otherId)
    if (otherAct === undefined) continue
    let [ox, oy, ow, oh] = otherAct.coord
    const otherLevel = levelsById.get(otherId)
    if (otherAct.drlgType === DRLGTYPE_MAZE && otherLevel !== undefined && otherLevel.rooms.length > 0) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const room of otherLevel.rooms) {
        const [rx, ry, rw, rh] = room.coord
        if (rx < minX) minX = rx
        if (ry < minY) minY = ry
        if (rx + rw > maxX) maxX = rx + rw
        if (ry + rh > maxY) maxY = ry + rh
      }
      ox = minX
      oy = minY
      ow = maxX - minX
      oh = maxY - minY
    }
    const box: DrlgRect = { x: ox, y: oy, width: ow, height: oh }
    if (ox + ow === levelX && Math.min(oy + oh, levelY + levelH) > Math.max(oy, levelY)) {
      orths.push({ level: otherId, dir: ALTDIR_WEST, box })
    } else if (levelX + levelW === ox && Math.min(oy + oh, levelY + levelH) > Math.max(oy, levelY)) {
      orths.push({ level: otherId, dir: ALTDIR_EAST, box })
    } else if (oy + oh === levelY && Math.min(ox + ow, levelX + levelW) > Math.max(ox, levelX)) {
      orths.push({ level: otherId, dir: ALTDIR_NORTH, box })
    } else if (levelY + levelH === oy && Math.min(ox + ow, levelX + levelW) > Math.max(ox, levelX)) {
      orths.push({ level: otherId, dir: ALTDIR_SOUTH, box })
    }
  }
  // D2Common.#10916 (0x6fd8c6d0 -> 0x6fdd19c0) per level-local cell: the nIndex of the room's coord list at
  // that cell (pCoordList when DRLGLOGIC_ROOMINFO_HAS_COORD_LIST, else pIndexY[y/5 - nPosY][x/5 - nPosX]).
  const gridW = levelW + 1
  const gridH = levelH + 1
  const logicalCells = new Int32Array(gridW * gridH).fill(-1)
  level.rooms.forEach((room, r) => {
    const logical = level.activation[r]!.mapTiles.logical
    if (logical === null) return
    const [rx, ry, rw, rh] = room.coord
    for (let y = 0; y < rh; y += 1) {
      for (let x = 0; x < rw; x += 1) {
        const lx = rx + x - levelX
        const ly = ry + y - levelY
        if (lx < 0 || ly < 0 || lx >= gridW || ly >= gridH) continue
        let index = -1
        if ((logical.flags & DRLGLOGIC_ROOMINFO_HAS_COORD_LIST) !== 0) {
          const head = logical.lists[0]
          if (head === undefined) throw new Error(`level ${levelId} room ${r}: HAS_COORD_LIST without a pCoordList`)
          index = head[0]
        } else {
          if (logical.indexY === null) throw new Error(`level ${levelId} room ${r}: logical room info without a pIndexY grid`)
          const handle = logical.indexY.cells[y * logical.indexY.w + x]
          if (handle === undefined) throw new Error(`level ${levelId} room ${r}: pIndexY has no cell (${x}, ${y})`)
          if (handle > 0) {
            const list = logical.lists[handle - 1]
            if (list === undefined) throw new Error(`level ${levelId} room ${r}: pIndexY handle ${handle} has no list`)
            index = list[0]
          }
        }
        logicalCells[ly * gridW + lx] = index
      }
    }
  })

  // DRLGPRESET_BuildPresetArea (0x6fd5c166) / DRLGPRESET_UpdatePops (0x6fd5a6a0): reconstruct each preset map's
  // POPS entries (`pPopsIndex`, `pPopsSubIndex`, `pPopsLocation`, `pLvlPrestTxtRecord->dwPopPad`) in level-local
  // tile coordinates from the room activation wall/tile-type grids.
  const pops: DrlgPopBox[] = []
  level.maps.forEach((m, mapIndex) => {
    const prest = DATATBLS_GetLvlPrestTxtRecord(tables, m.prest)
    const maxPops = prest.dwPops >>> 0
    if (maxPops === 0) return
    const [mapX, mapY, mapW, mapH] = m.coord
    const mapRooms: { rx: number; ry: number; rw: number; rh: number; act: DumpPresetActivation }[] = []
    level.rooms.forEach((r, rIdx) => {
      if (r.preset?.map === mapIndex) {
        mapRooms.push({
          rx: r.coord[0],
          ry: r.coord[1],
          rw: r.coord[2],
          rh: r.coord[3],
          act: level.activation[rIdx] as DumpPresetActivation,
        })
      }
    })
    if (mapRooms.length === 0) return
    const nWallLayers = mapRooms[0]!.act.walls.length
    const popsIndex: number[] = []
    const popsSubIndex: number[] = []
    const popsLoc: { x1: number; y1: number; x2: number; y2: number }[] = []

    for (let layer = 0; layer < nWallLayers; layer += 1) {
      for (let nY = 0; nY < mapH; nY += 1) {
        for (let nX = 0; nX < mapW; nX += 1) {
          const wx = mapX + nX
          const wy = mapY + nY
          let rm: (typeof mapRooms)[0] | undefined
          for (const cand of mapRooms) {
            if (wx >= cand.rx && wx < cand.rx + cand.rw && wy >= cand.ry && wy < cand.ry + cand.rh) {
              rm = cand
              break
            }
          }
          if (!rm) continue
          const tileGrid = rm.act.tiles[layer]
          const wallGrid = rm.act.walls[layer]
          if (!tileGrid || !wallGrid) continue
          const lx = wx - rm.rx
          const ly = wy - rm.ry
          const nTileType = tileGrid.cells[ly * tileGrid.w + lx]!
          if (nTileType !== 10 && nTileType !== 11) continue
          const nGrid2Flags = wallGrid.cells[ly * wallGrid.w + lx]!
          const nGrid2FlagsByte1 = (nGrid2Flags >>> 8) & 0xff
          const nFlagsBits21_26 = (nGrid2Flags >>> 20) & 0x3f
          if (nFlagsBits21_26 >= 8 && nFlagsBits21_26 <= 29) {
            const existing = popsIndex.indexOf(nFlagsBits21_26)
            if (existing >= 0) {
              popsLoc[existing]!.x2 = nX
              popsLoc[existing]!.y2 = nY
            } else {
              if (popsIndex.length >= maxPops) {
                throw new RangeError(`map ${m.file}: more pops than LvlPrest Pops=${maxPops}`)
              }
              popsIndex.push(nFlagsBits21_26)
              popsSubIndex.push(nGrid2FlagsByte1)
              popsLoc.push({ x1: nX, y1: nY, x2: 0, y2: 0 })
            }
          }
        }
      }
    }

    for (let k = 0; k < popsIndex.length; k += 1) {
      const loc = popsLoc[k]!
      const x1 = Math.min(loc.x1, loc.x2)
      const x2 = Math.max(loc.x1, loc.x2)
      const y1 = Math.min(loc.y1, loc.y2)
      const y2 = Math.max(loc.y1, loc.y2)
      pops.push({
        mapIndex,
        index: (popsIndex[k]! >> 2) - 1,
        subIndex: popsSubIndex[k]!,
        pad: prest.dwPopPad | 0,
        box: {
          x: x1 + mapX - levelX,
          y: y1 + mapY - levelY,
          width: x2 - x1 + 1,
          height: y2 - y1 + 1,
        },
      })
    }
  })

  return {
    levelId,
    drlgType: act.drlgType,
    levelType: act.levelType,
    coord: { x: levelX, y: levelY, width: levelW, height: levelH },
    flags: levelGrid.flags >>> 0,
    orths,
    grid2,
    tiles,
    units,
    warps,
    ...(animSpeed !== undefined ? { animSpeed } : {}),
    logicalIndex: { width: gridW, height: gridH, cells: logicalCells },
    ...(pops.length > 0 ? { pops } : {}),
  }
}

/**
 * Extract a {@link DrlgLevelInput} directly from an active {@link DrlgActSession}.
 *
 * Ensures the level is generated and activated in its act's session, then maps it
 * through {@link drlgLevelInputFromDump}.
 *
 * @param session - active DRLG session.
 * @param levelId - 1-based level id (1..136).
 * @param tables - optional DRLG tables (defaults to `session.env.tables`).
 * @returns normalized level input.
 */
export function drlgLevelInputFromSession(
  session: DrlgActSession,
  levelId: number,
  tables: DrlgTables = session.env.tables,
): DrlgLevelInput {
  session.ensureLevelActivated(levelId)
  const act = DRLG_GetActNoFromLevelId(levelId)
  const dump = session.getDump(act)
  return drlgLevelInputFromDump(dump, levelId, tables)
}
