/**
 * D2Common DRLG structures, ported from D2MOO (commit 5596f5c, MIT License, Copyright (c) 2020-2025
 * The Phrozen Keep community): include/Drlg/D2DrlgDrlg.h, D2DrlgDrlgGrid.h, D2DrlgDrlgVer.h,
 * D2DrlgOutdoors.h, D2DrlgOutRoom.h, D2DrlgPreset.h, D2DrlgTileSub.h.
 *
 * Porting conventions (shared by every file of src/game/drlg/):
 *   - Field names are the D2MOO names so each function reads like its C++ original.
 *   - C unions are represented by ONE canonical field: rooms and levels only use `pDrlgCoord` /
 *     `pLevelCoords` (never nTileXPos/nPosX aliases); an orth keeps `pLevel` and `pDrlgRoom` as two
 *     fields and each call site uses the member the C++ code uses.
 *   - Pointers to embedded structs (e.g. `pOrth->pBox = &pLevel->pLevelCoords`) are object
 *     references, so writes through them are visible to the owner exactly like in C.
 *   - Grids are views: `pCellsFlags` is the backing Int32Array and `nCellsBase` the index of cell
 *     (0, 0); row offsets may use a stride different from nWidth (DRLGGRID_FillNewCellFlags).
 *   - Integer fields hold C int32 values; uint32 fields are normalised with `>>> 0` where the C++
 *     code relies on unsigned semantics or when they are dumped.
 */

import type { D2SeedStrc } from '../rng/d2-rng.ts'
import type { D2TileLibraryEntryStrc, D2TileLibraryStrc } from './drlg-d2cmp.ts'
import type { DrlgDataSource, DrlgTables, LvlMazeRecord, LvlPrestRecord, LvlWarpRecord } from './drlg-tables.ts'

// ---------------------------------------------------------------------------------------------
// Enums (D2DrlgDrlg.h, D2DrlgOutdoors.h, DataTbls/LevelsIds.h, D2CommonDefinitions.h)
// ---------------------------------------------------------------------------------------------

export const ACT_I = 0
export const ACT_II = 1
export const ACT_III = 2
export const ACT_IV = 3
export const ACT_V = 4

export const DRLGFLAG_ONCLIENT = 0x01
export const DRLGFLAG_REFRESH = 0x10

export const DIRECTION_INVALID = -1
export const DIRECTION_SOUTHWEST = 0
export const DIRECTION_NORTHWEST = 1
export const DIRECTION_SOUTHEAST = 2
export const DIRECTION_NORTHEAST = 3
export const DIRECTION_COUNT = 4

/** enum D2AltDirections (D2DrlgDrlg.h). */
export const ALTDIR_WEST = 0
export const ALTDIR_NORTH = 1
export const ALTDIR_EAST = 2
export const ALTDIR_SOUTH = 3

export const DRLGTYPE_MAZE = 1
export const DRLGTYPE_PRESET = 2
export const DRLGTYPE_OUTDOOR = 3

// D2C_UnitTypes (Units/Units.h). Kept in this leaf module: drlg-preset.ts and drlg-roomtile.ts
// import each other, and drlg-roomtile.ts builds a module-level table (stru_6FDD0F68) from them.
export const UNIT_PLAYER = 0
export const UNIT_MONSTER = 1
export const UNIT_OBJECT = 2
export const UNIT_MISSILE = 3
export const UNIT_ITEM = 4
export const UNIT_TILE = 5

// D2C_MonModes / D2C_ObjectModes / D2C_ItemModes
export const MONMODE_NEUTRAL = 1
export const OBJMODE_NEUTRAL = 0
export const IMODE_ONGROUND = 3

export const DRLGSUBST_NONE = 0
export const DRLGSUBST_FIXED = 1
export const DRLGSUBST_RANDOM = 2

export const DRLGROOMFLAG_INACTIVE = 0x00000002
export const DRLGROOMFLAG_HAS_WARP_0 = 0x00000010
export const DRLGROOMFLAG_SUBSHRINE_ROW1 = 0x00001000
export const DRLGROOMFLAG_HAS_WAYPOINT = 0x00010000
export const DRLGROOMFLAG_HAS_WAYPOINT_SMALL = 0x00020000
export const DRLGROOMFLAG_AUTOMAP_REVEAL = 0x00040000
export const DRLGROOMFLAG_NO_LOS_DRAW = 0x00080000
export const DRLGROOMFLAG_HAS_ROOM = 0x00100000
export const DRLGROOMFLAG_ROOM_FREED_SRV = 0x00200000
export const DRLGROOMFLAG_HASPORTAL = 0x00400000
export const DRLGROOMFLAG_POPULATION_ZERO = 0x00800000
export const DRLGROOMFLAG_TILELIB_LOADED = 0x01000000
export const DRLGROOMFLAG_PRESET_UNITS_ADDED = 0x02000000
export const DRLGROOMFLAG_PRESET_UNITS_SPAWNED = 0x04000000
export const DRLGROOMFLAG_ANIMATED_FLOOR = 0x08000000
export const DRLGROOMFLAG_HAS_WARP_MASK = 0x00000ff0
export const DRLGROOMFLAG_SUBSHRINE_ROWS_MASK = 0x0000f000
export const DRLGROOMFLAG_HAS_WAYPOINT_MASK = 0x00030000
export const DRLGROOMFLAG_HAS_WARP_FIRST_BIT = 4
export const DRLGROOMFLAG_SUBSHRINE_ROWS_FIRST_BIT = 12
export const DRLGROOMFLAG_HAS_WAYPOINT_FIRST_BIT = 16

export const DRLGLEVELFLAG_AUTOMAP_REVEAL = 0x10

export const OUTDOOR_FLAG1 = 0x00000001
export const OUTDOOR_BRIDGE = 0x00000004
export const OUTDOOR_RIVER_OTHER = 0x00000008
export const OUTDOOR_RIVER = 0x00000010
export const OUTDOOR_CLIFFS = 0x00000020
export const OUTDOOR_OUT_CAVES = 0x00000040
export const OUTDOOR_SOUTHWEST = 0x00000080
export const OUTDOOR_NORTHWEST = 0x00000100
export const OUTDOOR_SOUTHEAST = 0x00000200
export const OUTDOOR_NORTHEAST = 0x00000400

/**
 * union D2DrlgOutdoorPackedGrid2InfoStrc (D2DrlgOutdoors.h), the packed value of pOutdoors->pGrid[2].
 * Names follow the D2MOO bitfields; the comment gives the role observed in the outdoor code.
 */
export const GRID2_UNKB00 = 0x00000001 // nUnkb00: border / level edge cell
export const GRID2_HAS_DIRECTION = 0x00000002 // bHasDirection
export const GRID2_UNKB07 = 0x00000080 // nUnkb07: dirt path cell
export const GRID2_UNKB08 = 0x00000100 // nUnkb08: blank cell (no room)
export const GRID2_HAS_PICKED_FILE = 0x00000200 // bHasPickedFile
export const GRID2_LVL_LINK = 0x00000400 // bLvlLink
export const GRID2_UNKB11 = 0x00000800 // nUnkb11: waypoint
export const GRID2_UNKB12 = 0x00001000 // nUnkb12: shrine
export const GRID2_PICKED_FILE_MASK = 0x000f0000 // nPickedFile (4-bit field)
export const GRID2_PICKED_FILE_SHIFT = 16

/** `tPackedInfo.nPickedFile = n`: C bitfield assignment keeps the low 4 bits. */
export function grid2PickedFileBits(nPickedFile: number): number {
  return (nPickedFile & 0xf) << GRID2_PICKED_FILE_SHIFT
}

/** `tPackedInfo.nPickedFile` (uint32_t : 4). */
export function grid2PickedFile(nPackedValue: number): number {
  return (nPackedValue >>> GRID2_PICKED_FILE_SHIFT) & 0xf
}

export const DRLGPRESETROOMFLAG_NONE = 0
export const DRLGPRESETROOMFLAG_SINGLE_ROOM = 1
export const DRLGPRESETROOMFLAG_HAS_MAP_DS1 = 2

export const DRLG_MAX_WALL_LAYERS = 4
export const DRLG_MAX_FLOOR_LAYERS = 2

/** enum FlagOperation (D2DrlgDrlgGrid.h). */
export const FLAG_OPERATION_OR = 0
export const FLAG_OPERATION_AND = 1
export const FLAG_OPERATION_XOR = 2
export const FLAG_OPERATION_OVERWRITE = 3
export const FLAG_OPERATION_OVERWRITE_IF_ZERO = 4
export const FLAG_OPERATION_AND_NEGATED = 5
export type FlagOperation = 0 | 1 | 2 | 3 | 4 | 5

/** D2C_Levels (DataTbls/LevelsIds.h). */
export const LEVEL_NONE = 0
export const LEVEL_ROGUEENCAMPMENT = 1
export const LEVEL_BLOODMOOR = 2
export const LEVEL_COLDPLAINS = 3
export const LEVEL_STONYFIELD = 4
export const LEVEL_DARKWOOD = 5
export const LEVEL_BLACKMARSH = 6
export const LEVEL_TAMOEHIGHLAND = 7
export const LEVEL_DENOFEVIL = 8
export const LEVEL_CAVELEV1 = 9
export const LEVEL_UNDERGROUNDPASSAGELEV1 = 10
export const LEVEL_HOLELEV1 = 11
export const LEVEL_PITLEV1 = 12
export const LEVEL_CAVELEV2 = 13
export const LEVEL_UNDERGROUNDPASSAGELEV2 = 14
export const LEVEL_HOLELEV2 = 15
export const LEVEL_PITLEV2 = 16
export const LEVEL_BURIALGROUNDS = 17
export const LEVEL_CRYPT = 18
export const LEVEL_MAUSOLEUM = 19
export const LEVEL_FORGOTTENTOWER = 20
export const LEVEL_TOWERCELLARLEV1 = 21
export const LEVEL_TOWERCELLARLEV2 = 22
export const LEVEL_TOWERCELLARLEV3 = 23
export const LEVEL_TOWERCELLARLEV4 = 24
export const LEVEL_TOWERCELLARLEV5 = 25
export const LEVEL_MONASTERYGATE = 26
export const LEVEL_OUTERCLOISTER = 27
export const LEVEL_BARRACKS = 28
export const LEVEL_JAILLEV1 = 29
export const LEVEL_JAILLEV2 = 30
export const LEVEL_JAILLEV3 = 31
export const LEVEL_INNERCLOISTER = 32
export const LEVEL_CATHEDRAL = 33
export const LEVEL_CATACOMBSLEV1 = 34
export const LEVEL_CATACOMBSLEV2 = 35
export const LEVEL_CATACOMBSLEV3 = 36
export const LEVEL_CATACOMBSLEV4 = 37
export const LEVEL_TRISTRAM = 38
export const LEVEL_MOOMOOFARM = 39
export const LEVEL_LUTGHOLEIN = 40
export const LEVEL_ROCKYWASTE = 41
export const LEVEL_DRYHILLS = 42
export const LEVEL_FAROASIS = 43
export const LEVEL_LOSTCITY = 44
export const LEVEL_VALLEYOFSNAKES = 45
export const LEVEL_CANYONOFTHEMAGI = 46
export const LEVEL_SEWERSLEV1 = 47
export const LEVEL_SEWERSLEV2 = 48
export const LEVEL_SEWERSLEV3 = 49
export const LEVEL_HAREMLEV1 = 50
export const LEVEL_HAREMLEV2 = 51
export const LEVEL_PALACECELLARLEV1 = 52
export const LEVEL_PALACECELLARLEV2 = 53
export const LEVEL_PALACECELLARLEV3 = 54
export const LEVEL_STONYTOMBLEV1 = 55
export const LEVEL_HALLSOFTHEDEADLEV1 = 56
export const LEVEL_HALLSOFTHEDEADLEV2 = 57
export const LEVEL_CLAWVIPERTEMPLELEV1 = 58
export const LEVEL_STONYTOMBLEV2 = 59
export const LEVEL_HALLSOFTHEDEADLEV3 = 60
export const LEVEL_CLAWVIPERTEMPLELEV2 = 61
export const LEVEL_MAGGOTLAIRLEV1 = 62
export const LEVEL_MAGGOTLAIRLEV2 = 63
export const LEVEL_MAGGOTLAIRLEV3 = 64
export const LEVEL_ANCIENTTUNNELS = 65
export const LEVEL_TALRASHASTOMB1 = 66
export const LEVEL_TALRASHASTOMB2 = 67
export const LEVEL_TALRASHASTOMB3 = 68
export const LEVEL_TALRASHASTOMB4 = 69
export const LEVEL_TALRASHASTOMB5 = 70
export const LEVEL_TALRASHASTOMB6 = 71
export const LEVEL_TALRASHASTOMB7 = 72
export const LEVEL_DURIELSLAIR = 73
export const LEVEL_ARCANESANCTUARY = 74
export const LEVEL_KURASTDOCKTOWN = 75
export const LEVEL_SPIDERFOREST = 76
export const LEVEL_GREATMARSH = 77
export const LEVEL_FLAYERJUNGLE = 78
export const LEVEL_LOWERKURAST = 79
export const LEVEL_KURASTBAZAAR = 80
export const LEVEL_UPPERKURAST = 81
export const LEVEL_KURASTCAUSEWAY = 82
export const LEVEL_TRAVINCAL = 83
export const LEVEL_SPIDERCAVE = 84
export const LEVEL_SPIDERCAVERN = 85
export const LEVEL_SWAMPYPITLEV1 = 86
export const LEVEL_SWAMPYPITLEV2 = 87
export const LEVEL_FLAYERDUNGEONLEV1 = 88
export const LEVEL_FLAYERDUNGEONLEV2 = 89
export const LEVEL_SWAMPYPITLEV3 = 90
export const LEVEL_FLAYERDUNGEONLEV3 = 91
export const LEVEL_SEWERSA3LEV1 = 92
export const LEVEL_SEWERSA3LEV2 = 93
export const LEVEL_RUINEDTEMPLE = 94
export const LEVEL_DISUSEDFANE = 95
export const LEVEL_FORGOTTENRELIQUARY = 96
export const LEVEL_FORGOTTENTEMPLE = 97
export const LEVEL_RUINEDFANE = 98
export const LEVEL_DISUSEDRELIQUARY = 99
export const LEVEL_DURANCEOFHATELEV1 = 100
export const LEVEL_DURANCEOFHATELEV2 = 101
export const LEVEL_DURANCEOFHATELEV3 = 102
export const LEVEL_THEPANDEMONIUMFORTRESS = 103
export const LEVEL_OUTERSTEPPES = 104
export const LEVEL_PLAINSOFDESPAIR = 105
export const LEVEL_CITYOFTHEDAMNED = 106
export const LEVEL_RIVEROFFLAME = 107
export const LEVEL_CHAOSSANCTUM = 108
export const LEVEL_HARROGATH = 109
export const LEVEL_BLOODYFOOTHILLS = 110
export const LEVEL_ID_ACT5_BARRICADE_1 = 111
export const LEVEL_ARREATPLATEAU = 112
export const LEVEL_CRYSTALIZEDCAVERNLEV1 = 113
export const LEVEL_CELLAROFPITY = 114
export const LEVEL_CRYSTALIZEDCAVERNLEV2 = 115
export const LEVEL_ECHOCHAMBER = 116
export const LEVEL_TUNDRAWASTELANDS = 117
export const LEVEL_GLACIALCAVESLEV1 = 118
export const LEVEL_GLACIALCAVESLEV2 = 119
export const LEVEL_ROCKYSUMMIT = 120
export const LEVEL_NIHLATHAKSTEMPLE = 121
export const LEVEL_HALLSOFANGUISH = 122
export const LEVEL_HALLSOFDEATHSCALLING = 123
export const LEVEL_HALLSOFVAUGHT = 124
export const LEVEL_HELL1 = 125
export const LEVEL_HELL2 = 126
export const LEVEL_HELL3 = 127
export const LEVEL_THEWORLDSTONEKEEPLEV1 = 128
export const LEVEL_THEWORLDSTONEKEEPLEV2 = 129
export const LEVEL_THEWORLDSTONEKEEPLEV3 = 130
export const LEVEL_THRONEOFDESTRUCTION = 131
export const LEVEL_THEWORLDSTONECHAMBER = 132
export const LEVEL_PANDEMONIUMRUN1 = 133
export const LEVEL_PANDEMONIUMRUN2 = 134
export const LEVEL_PANDEMONIUMRUN3 = 135
export const LEVEL_PANDEMONIUMFINALE = 136

// ---------------------------------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------------------------------

/** Game data and DS1 file cache shared by one DRLG instance (sgptDataTables + archive + gpLevelFilesList). */
export interface DrlgEnv {
  readonly tables: DrlgTables
  readonly data: DrlgDataSource
  /** DRLGPRESET_LoadDrlgFile cache (gpLevelFilesList_6FDEA700), keyed by the exact path string (strcmp). */
  readonly fileCache: Map<string, D2DrlgFileStrc>
  /**
   * The mutable half of each D2LvlSubTxt record (pDrlgFile and the grids over it), keyed by the
   * LvlSub.bin record index. D2Common keeps it inside the global table; DRLGTILESUB_InitializeDrlgFile
   * fills it on first use and it then lives as long as the tables.
   */
  readonly lvlSubFiles: Map<number, D2LvlSubFileStrc>
  /** Loaded DT1 tile libraries keyed by normalized lowercase path. */
  readonly dt1Cache: Map<string, D2TileLibraryStrc>
}

/** D2LvlSubTxt::{pDrlgFile, pTileTypeGrid[4], pWallGrid[4], pFloorGrid, pShadowGrid}. */
export interface D2LvlSubFileStrc {
  pDrlgFile: D2DrlgFileStrc
  pTileTypeGrid: [D2DrlgGridStrc, D2DrlgGridStrc, D2DrlgGridStrc, D2DrlgGridStrc]
  pWallGrid: [D2DrlgGridStrc, D2DrlgGridStrc, D2DrlgGridStrc, D2DrlgGridStrc]
  pFloorGrid: D2DrlgGridStrc
  pShadowGrid: D2DrlgGridStrc
}

/** D2DrlgBuildStrc: per-level round robin over the files of a LvlPrest row (DRLGOUTDOORS_SpawnOutdoorLevelPresetEx). */
export interface D2DrlgBuildStrc {
  nPreset: number
  nDivisor: number
  nRand: number
  pNext: D2DrlgBuildStrc | null
}

/** D2DrlgCoordStrc */
export interface D2DrlgCoordStrc {
  nPosX: number
  nPosY: number
  nWidth: number
  nHeight: number
}

/** D2DrlgGridStrc */
export interface D2DrlgGridStrc {
  pCellsFlags: Int32Array | null
  /** Index of cell (0, 0) inside pCellsFlags (C: pCellsFlags pointer arithmetic). */
  nCellsBase: number
  pCellsRowOffsets: Int32Array | null
  nWidth: number
  nHeight: number
  unk0x10: number
}

/** D2DrlgVertexStrc */
export interface D2DrlgVertexStrc {
  nPosX: number
  nPosY: number
  /** uint8_t */
  nDirection: number
  dwFlags: number
  pNext: D2DrlgVertexStrc | null
}

/** D2DrlgOrthStrc. `pLevel` and `pDrlgRoom` share storage in C; each call site uses one. */
export interface D2DrlgOrthStrc {
  pLevel: D2DrlgLevelStrc | null
  pDrlgRoom: D2DrlgRoomStrc | null
  /** uint8_t */
  nDirection: number
  bPreset: number
  bInit: number
  pBox: D2DrlgCoordStrc | null
  pNext: D2DrlgOrthStrc | null
}

/** D2DrlgWarpStrc */
export interface D2DrlgWarpStrc {
  nLevel: number
  nVis: number[]
  nWarp: number[]
  pNext: D2DrlgWarpStrc | null
}

/** D2DrlgPresetInfoStrc */
export interface D2DrlgPresetInfoStrc {
  pDrlgMap: D2DrlgMapStrc | null
  nDirection: number
}

/** D2DrlgOutdoorInfoStrc. The C union `pCoord` is exposed through {@link outdoorCoord}. */
export interface D2DrlgOutdoorInfoStrc {
  /** uint32_t D2C_OutDoorInfoFlags */
  dwFlags: number
  /** 0: LevelPrestId, 1: ?, 2: packed info (D2DrlgOutdoorPackedGrid2InfoStrc), 3: ? */
  pGrid: [D2DrlgGridStrc, D2DrlgGridStrc, D2DrlgGridStrc, D2DrlgGridStrc]
  nWidth: number
  nHeight: number
  nGridWidth: number
  nGridHeight: number
  pVertex: D2DrlgVertexStrc | null
  pPathStarts: (D2DrlgVertexStrc | null)[]
  /** Embedded array of 24 vertices. */
  pVertices: D2DrlgVertexStrc[]
  nVertices: number
  pRoomData: D2DrlgOrthStrc | null
}

/** D2MapAIPathPositionStrc */
export interface D2MapAIPathPositionStrc {
  nX: number
  nY: number
  nMapAIAction: number
}

/** D2PresetUnitStrc. `pMapAI` holds D2MapAIStrc::pPosition (nPathNodes is its length). */
export interface D2PresetUnitStrc {
  nUnitType: number
  nIndex: number
  nMode: number
  nXpos: number
  nYpos: number
  bSpawned: number
  pMapAI: D2MapAIPathPositionStrc[] | null
  pNext: D2PresetUnitStrc | null
}

/** D2DrlgSubstGroupStrc */
export interface D2DrlgSubstGroupStrc {
  tBox: D2DrlgCoordStrc
  field_10: number
  field_14: number
}

/** D2DrlgFileStrc: a parsed DS1 (DRLGPRESET_ParseDS1File). Layers are raw packed int32 grids. */
export interface D2DrlgFileStrc {
  nSubstMethod: number
  /** Map key / path, for diagnostics. */
  szPath: string
  nWidth: number
  nHeight: number
  nWallLayers: number
  nFloorLayers: number
  pTileTypeLayer: (Int32Array | null)[]
  pWallLayer: (Int32Array | null)[]
  pFloorLayer: (Int32Array | null)[]
  pShadowLayer: Int32Array | null
  pSubstGroupTags: Int32Array | null
  nSubstGroups: number
  pSubstGroups: D2DrlgSubstGroupStrc[]
  pPresetUnit: D2PresetUnitStrc | null
}

/** D2DrlgMapStrc */
export interface D2DrlgMapStrc {
  nLevelPrest: number
  nPickedFile: number
  pLvlPrestTxtRecord: LvlPrestRecord
  pFile: D2DrlgFileStrc | null
  pDrlgCoord: D2DrlgCoordStrc
  bHasInfo: number
  pMapGrid: D2DrlgGridStrc
  pPresetUnit: D2PresetUnitStrc | null
  bInited: number
  nPops: number
  pPopsIndex: Int32Array | null
  pPopsSubIndex: Int32Array | null
  pPopsOrientation: Int32Array | null
  pPopsLocation: D2DrlgCoordStrc[] | null
  pNext: D2DrlgMapStrc | null
}

/** D2DrlgPresetRoomStrc */
export interface D2DrlgPresetRoomStrc {
  nLevelPrest: number
  nPickedFile: number
  pMap: D2DrlgMapStrc | null
  /** uint32_t; the low byte is `nFlags` (D2DrlgPresetRoomFlags). */
  dwFlags: number
  pWallGrid: D2DrlgGridStrc[]
  pTileTypeGrid: D2DrlgGridStrc[]
  pFloorGrid: D2DrlgGridStrc[]
  pCellGrid: D2DrlgGridStrc
  pMazeGrid: D2DrlgGridStrc | null
  /** D2_ALLOC_POOL(6 * sizeof(D2CoordStrc)) by DRLGPRESET_AddPresetRoomMapTiles (LEVEL_BURIALGROUNDS). */
  pTombStoneTiles: D2CoordStrc[] | null
  nTombStoneTiles: number
}

/** D2DrlgOutdoorRoomStrc */
export interface D2DrlgOutdoorRoomStrc {
  pTileTypeGrid: D2DrlgGridStrc
  pWallGrid: D2DrlgGridStrc
  pFloorGrid: D2DrlgGridStrc
  pDirtPathGrid: D2DrlgGridStrc
  pVertex: D2DrlgVertexStrc | null
  dwFlags: number
  dwFlagsEx: number
  unk0x5C: number
  unk0x60: number
  nSubType: number
  nSubTheme: number
  nSubThemePicked: number
}

/** D2CoordStrc */
export interface D2CoordStrc {
  nX: number
  nY: number
}

/** D2RoomCoordListStrc (D2DrlgDrlg.h:260). */
export interface D2RoomCoordListStrc {
  /** Embedded array of 2. */
  pBox: [D2DrlgCoordStrc, D2DrlgCoordStrc]
  bNode: number
  bRoomActive: number
  nIndex: number
  pNext: D2RoomCoordListStrc | null
}

/**
 * D2DrlgTileDataStrc (D2DrlgDrlg.h:333). Tile data live in the arrays of D2DrlgRoomTilesStrc; a
 * `D2DrlgTileDataStrc*` is a reference to an element of such an array.
 */
export interface D2DrlgTileDataStrc {
  /** 0x00: client X of the tile (DUNGEON_GameTileToClientCoords). */
  nWidth: number
  /** 0x04: client Y of the tile bottom. */
  nHeight: number
  /** 0x08: tile X relative to the room. */
  nPosX: number
  /** 0x0C: tile Y relative to the room. */
  nPosY: number
  /**
   * 0x10 (int32): DRLGLOGIC_SetCoordListForTiles stores the `D2RoomCoordListStrc*` of the tile's
   * logical room here (C casts the pointer to int); otherwise 0.
   */
  unk0x10: number | D2RoomCoordListStrc
  /** 0x14: uint32_t D2MapTileFlags */
  dwFlags: number
  pTile: D2TileLibraryEntryStrc | null
  nTileType: number
  /** 0x20: next tile of the same chain (link list, warp list, shadow list). */
  unk0x20: D2DrlgTileDataStrc | null
  unk0x24: number
  /** uint8_t */
  nRed: number
  /** uint8_t */
  nGreen: number
  /** uint8_t */
  nBlue: number
  /** uint8_t */
  nIntensity: number
  unk0x2C: number
}

/**
 * D2DrlgRoomTilesStrc. Each array's length is its allocation size in elements
 * (D2_CALLOC_POOL / D2_REALLOC_POOL); the port throws where C would write past it.
 */
export interface D2DrlgRoomTilesStrc {
  pWallTiles: D2DrlgTileDataStrc[] | null
  nWalls: number
  pFloorTiles: D2DrlgTileDataStrc[] | null
  nFloors: number
  /** Shadows occupy pRoofTiles[0..nShadows) (DRLGROOMTILE_InitShadowTileData). */
  pRoofTiles: D2DrlgTileDataStrc[] | null
  nRoofs: number
}

/** D2DrlgTileLinkStrc */
export interface D2DrlgTileLinkStrc {
  bFloor: number
  pMapTile: D2DrlgTileDataStrc | null
  pNext: D2DrlgTileLinkStrc | null
}

/** D2DrlgAnimTileGridStrc */
export interface D2DrlgAnimTileGridStrc {
  ppMapTileData: (D2DrlgTileDataStrc | null)[]
  nFrames: number
  nCurrentFrame: number
  nAnimationSpeed: number
  pNext: D2DrlgAnimTileGridStrc | null
}

/** D2DrlgTileGridStrc */
export interface D2DrlgTileGridStrc {
  pMapLinks: D2DrlgTileLinkStrc | null
  pAnimTiles: D2DrlgAnimTileGridStrc | null
  nWalls: number
  nFloors: number
  nShadows: number
  /** Embedded D2DrlgRoomTilesStrc. */
  pTiles: D2DrlgRoomTilesStrc
}

/** D2RoomTileStrc: one warp of a room (allocated by sub_6FD77F00). */
export interface D2RoomTileStrc {
  pDrlgRoom: D2DrlgRoomStrc
  pLvlWarpTxtRecord: LvlWarpRecord
  bEnabled: number
  unk0x0C: D2DrlgTileDataStrc | null
  unk0x10: D2DrlgTileDataStrc | null
  pNext: D2RoomTileStrc | null
}

/** D2DrlgLogicalRoomInfoStrc (D2DrlgDrlgLogic.h, aka D2DrlgCoordListStrc). */
export interface D2DrlgLogicalRoomInfoStrc {
  /** D2DrlgLogicalRoomInfoFlags */
  dwFlags: number
  nLists: number
  pIndexX: D2DrlgGridStrc
  /**
   * C stores `(int)pRoomCoordList` in these cells (DRLGLOGIC_AssignCoordListsForGrids). Int32Array cells
   * cannot hold objects: the port stores a 1-based handle into `ppCoordListHandles` (0 = NULL).
   */
  pIndexY: D2DrlgGridStrc
  pCoordList: D2RoomCoordListStrc | null
  /** Port-only: the D2RoomCoordListStrc objects whose handles (index + 1) live in pIndexY cells. */
  ppCoordListHandles: D2RoomCoordListStrc[]
}

/** A zeroed D2DrlgTileDataStrc (D2_CALLOC_POOL). */
export function newTileData(): D2DrlgTileDataStrc {
  return {
    nWidth: 0,
    nHeight: 0,
    nPosX: 0,
    nPosY: 0,
    unk0x10: 0,
    dwFlags: 0,
    pTile: null,
    nTileType: 0,
    unk0x20: null,
    unk0x24: 0,
    nRed: 0,
    nGreen: 0,
    nBlue: 0,
    nIntensity: 0,
    unk0x2C: 0,
  }
}

/** D2DrlgRoomStrc (aka D2RoomExStrc). Tile coordinates live in `pDrlgCoord`. */
export interface D2DrlgRoomStrc {
  pLevel: D2DrlgLevelStrc
  pDrlgCoord: D2DrlgCoordStrc
  /** uint32_t D2DrlgRoomFlags */
  dwFlags: number
  dwOtherFlags: number
  nType: number
  pMaze: D2DrlgPresetRoomStrc | null
  pOutdoor: D2DrlgOutdoorRoomStrc | null
  /** uint32_t */
  dwDT1Mask: number
  pTiles: D2TileLibraryStrc[]
  /** 0xA8: allocated by DRLGROOMTILE_AllocTileGrid. */
  pTileGrid: D2DrlgTileGridStrc | null
  nRoomsNear: number
  ppRoomsNear: D2DrlgRoomStrc[]
  /** 0xC8: warps of the room (sub_6FD77F00). */
  pRoomTiles: D2RoomTileStrc | null
  pPresetUnits: D2PresetUnitStrc | null
  pDrlgOrth: D2DrlgOrthStrc | null
  pSeed: D2SeedStrc
  /** uint32_t */
  dwInitSeed: number
  /** 0xE0 */
  pLogicalRoomInfo: D2DrlgLogicalRoomInfoStrc | null
  /**
   * 0xE4 D2ActiveRoomStrc*: set by DRLG_CreateRoomForRoomEx (D2Game side, not ported); always null
   * in the port, like in the oracle.
   */
  pRoom: null
  pDrlgRoomNext: D2DrlgRoomStrc | null
}

/** D2DrlgTileInfoStrc */
export interface D2DrlgTileInfoStrc {
  nPosX: number
  nPosY: number
  nTileIndex: number
}

/** D2DrlgLevelStrc. Level coordinates live in `pLevelCoords`. */
export interface D2DrlgLevelStrc {
  pDrlg: D2DrlgStrc
  nLevelId: number
  nLevelType: number
  nDrlgType: number
  /** uint32_t */
  dwFlags: number
  pSeed: D2SeedStrc
  dwInitSeed: number
  pLevelCoords: D2DrlgCoordStrc
  pFirstRoomEx: D2DrlgRoomStrc | null
  nRooms: number
  /** C union at 0x38 (pPreset / pOutdoors / pMaze). */
  pPreset: D2DrlgPresetInfoStrc | null
  pOutdoors: D2DrlgOutdoorInfoStrc | null
  pMaze: LvlMazeRecord | null
  pCurrentMap: D2DrlgMapStrc | null
  nCoordLists: number
  /** Embedded array of 32 entries. */
  pTileInfo: D2DrlgTileInfoStrc[]
  nTileInfo: number
  nRoom_Center_Warp_X: number[]
  nRoom_Center_Warp_Y: number[]
  nRoomCoords: number
  /** 0x21C: file round robin of DRLGOUTDOORS_SpawnOutdoorLevelPresetEx (nPickedFile == -1). */
  pBuild: D2DrlgBuildStrc | null
  pPresetMaps: Int32Array | null
  pJungleDefs: Int32Array | null
  nJungleDefs: number
  pNextLevel: D2DrlgLevelStrc | null
}

/** D2DrlgStrc (1.10f layout, the one D2MOO uses for 1.13c-era logic). */
export interface D2DrlgStrc {
  readonly env: DrlgEnv
  pLevel: D2DrlgLevelStrc | null
  /** uint8_t */
  nAct: number
  pSeed: D2SeedStrc
  /** uint32_t */
  dwStartSeed: number
  /** uint32_t */
  dwGameLowSeed: number
  /** uint32_t D2DrlgFlags */
  dwFlags: number
  /** uint8_t */
  nDifficulty: number
  nStaffTombLevel: number
  nBossTombLevel: number
  bJungleInterlink: number
  pWarp: D2DrlgWarpStrc | null
}

// ---------------------------------------------------------------------------------------------
// Allocation helpers (D2_CALLOC_STRC_POOL: zero-initialised)
// ---------------------------------------------------------------------------------------------

export function newCoord(nPosX = 0, nPosY = 0, nWidth = 0, nHeight = 0): D2DrlgCoordStrc {
  return { nPosX, nPosY, nWidth, nHeight }
}

export function newGrid(): D2DrlgGridStrc {
  return { pCellsFlags: null, nCellsBase: 0, pCellsRowOffsets: null, nWidth: 0, nHeight: 0, unk0x10: 0 }
}

export function newVertex(nDirection = 0): D2DrlgVertexStrc {
  return { nPosX: 0, nPosY: 0, nDirection: nDirection & 0xff, dwFlags: 0, pNext: null }
}

export function newOrth(): D2DrlgOrthStrc {
  return { pLevel: null, pDrlgRoom: null, nDirection: 0, bPreset: 0, bInit: 0, pBox: null, pNext: null }
}

export function newOutdoorInfo(): D2DrlgOutdoorInfoStrc {
  const pVertices: D2DrlgVertexStrc[] = []
  for (let i = 0; i < 24; i += 1) pVertices.push(newVertex())
  return {
    dwFlags: 0,
    pGrid: [newGrid(), newGrid(), newGrid(), newGrid()],
    nWidth: 0,
    nHeight: 0,
    nGridWidth: 0,
    nGridHeight: 0,
    pVertex: null,
    pPathStarts: [null, null, null, null, null, null],
    pVertices,
    nVertices: 0,
    pRoomData: null,
  }
}

export function newOutdoorRoom(): D2DrlgOutdoorRoomStrc {
  return {
    pTileTypeGrid: newGrid(),
    pWallGrid: newGrid(),
    pFloorGrid: newGrid(),
    pDirtPathGrid: newGrid(),
    pVertex: null,
    dwFlags: 0,
    dwFlagsEx: 0,
    unk0x5C: 0,
    unk0x60: 0,
    nSubType: 0,
    nSubTheme: 0,
    nSubThemePicked: 0,
  }
}

export function newPresetRoom(): D2DrlgPresetRoomStrc {
  return {
    nLevelPrest: 0,
    nPickedFile: 0,
    pMap: null,
    dwFlags: 0,
    pWallGrid: [newGrid(), newGrid(), newGrid(), newGrid()],
    pTileTypeGrid: [newGrid(), newGrid(), newGrid(), newGrid()],
    pFloorGrid: [newGrid(), newGrid()],
    pCellGrid: newGrid(),
    pMazeGrid: null,
    pTombStoneTiles: null,
    nTombStoneTiles: 0,
  }
}

export function newPresetUnit(): D2PresetUnitStrc {
  return { nUnitType: 0, nIndex: 0, nMode: 0, nXpos: 0, nYpos: 0, bSpawned: 0, pMapAI: null, pNext: null }
}

/**
 * `&pOutdoors->pCoord`: the C union maps pCoord.{nPosX, nPosY, nWidth, nHeight} onto
 * {nWidth, nHeight, nGridWidth, nGridHeight}. The returned object reads and writes through.
 */
export function outdoorCoord(o: D2DrlgOutdoorInfoStrc): D2DrlgCoordStrc {
  return {
    get nPosX() { return o.nWidth },
    set nPosX(v: number) { o.nWidth = v },
    get nPosY() { return o.nHeight },
    set nPosY(v: number) { o.nHeight = v },
    get nWidth() { return o.nGridWidth },
    set nWidth(v: number) { o.nGridWidth = v },
    get nHeight() { return o.nGridHeight },
    set nHeight(v: number) { o.nGridHeight = v },
  }
}

/** C `int32_t` truncation of an arithmetic result. */
export function i32(v: number): number {
  return v | 0
}

/** C signed integer division (truncates toward zero). */
export function idiv(a: number, b: number): number {
  if (b === 0) throw new RangeError('integer division by zero')
  return Math.trunc(a / b) | 0
}

/** C signed remainder (sign of the dividend). */
export function imod(a: number, b: number): number {
  if (b === 0) throw new RangeError('integer modulo by zero')
  return (a % b) | 0
}
