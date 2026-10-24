/**
 * D2Common DRLG room tiles: 1:1 port of D2MOO source/D2Common/src/Drlg/DrlgRoomTile.cpp
 * (commit 5596f5c, MIT License, Copyright (c) 2020-2025 The Phrozen Keep community), plus the
 * NULL-room case of D2Common_COLLISION_FirstFn_6FD41000 (D2Collision.cpp).
 *
 * Tile data live in the arrays of D2DrlgRoomTilesStrc (`pDrlgRoom.pTileGrid.pTiles`). Each array is
 * a JS array whose length is its allocation size in elements (D2_CALLOC_POOL / D2_REALLOC_POOL); a
 * `D2DrlgTileDataStrc*` is a reference to one element. Where C would write past an allocation or
 * through a NULL pointer, the port throws.
 */

import { SEED_InitLowSeed, SEED_RollLimitedRandomNumber, SEED_RollRandomNumber } from '../rng/d2-rng.ts'
import {
  D2CMP_10078_GetTileStyle,
  D2CMP_10079_GetTileFlags,
  D2CMP_10081_GetTileRarity,
  D2CMP_10082_GetTileSequence,
  D2CMP_10087_LoadTileLibrarySlot,
  D2CMP_10088_GetTiles,
  type D2TileLibraryEntryStrc,
} from './drlg-d2cmp.ts'
import { DUNGEON_GameTileToSubtileCoords } from './drlg-drlg.ts'
import { DRLGGRID_GetGridEntry } from './drlg-grid.ts'
import { DRLGOUTPLACE_InitOutdoorRoomGrids } from './drlg-outplace.ts'
import { DRLGOUTROOM_InitializeDrlgOutdoorRoom } from './drlg-outroom.ts'
import {
  DRLGPRESET_AddPresetRoomMapTiles,
  DRLGPRESET_InitPresetRoomGrids,
} from './drlg-preset.ts'
import {
  DRLGROOM_AllocPresetUnit,
  DRLGROOM_AreXYInsideCoordinates,
  DRLGROOM_AreXYInsideCoordinatesOrOnBorder,
} from './drlg-room.ts'
import {
  DATATBLS_GetLvlTypesTxtRecord,
  DATATBLS_GetLvlWarpTxtRecordFromLevelIdAndDirection,
  type LvlWarpRecord,
} from './drlg-tables.ts'
import {
  DRLGROOMFLAG_HAS_ROOM,
  DRLGROOMFLAG_POPULATION_ZERO,
  DRLGROOMFLAG_TILELIB_LOADED,
  DRLGTYPE_MAZE,
  DRLGTYPE_PRESET,
  LEVEL_HARROGATH,
  LEVEL_MONASTERYGATE,
  LEVEL_OUTERCLOISTER,
  MONMODE_NEUTRAL,
  OBJMODE_NEUTRAL,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_TILE,
  newTileData,
  type D2DrlgGridStrc,
  type D2DrlgRoomStrc,
  type D2DrlgTileDataStrc,
  type D2DrlgTileGridStrc,
  type D2DrlgTileLinkStrc,
  type D2RoomTileStrc,
} from './drlg-types.ts'
import { DRLGWARP_GetLvlWarpTxtRecordFromWarpIdAndDirection, DRLGWARP_GetWarpDestinationFromArray } from './drlg-warp.ts'

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------

// D2TileType (D2CMP.h)
export const TILETYPE_FLOOR = 0
export const TILETYPE_WALL_LEFT = 1
export const TILETYPE_WALL_RIGHT = 2
export const TILETYPE_WALL_TOP_CORNER_RIGHT = 3
export const TILETYPE_WALL_TOP_CORNER_LEFT = 4
export const TILETYPE_WALL_TOP_RIGHT = 5
export const TILETYPE_WALL_BOTTOM_LEFT = 6
export const TILETYPE_WALL_BOTTOM_RIGHT = 7
export const TILETYPE_WALL_LEFT_DOOR = 8
export const TILETYPE_WALL_RIGHT_DOOR = 9
export const TILETYPE_WALL_LEFT_EXIT = 10
export const TILETYPE_WALL_RIGHT_EXIT = 11
export const TILETYPE_COLUMN = 12
export const TILETYPE_SHADOW = 13
export const TILETYPE_TREE = 14
export const TILETYPE_ROOF = 15
export const TILETYPE_LEFT_WALL_DOWN = 16
export const TILETYPE_RIGHT_WALL_DOWN = 17
export const TILETYPE_FULL_WALL_DOWN = 18
export const TILETYPE_FRONT_WALL_DOWN = 19

// D2TileFlags (D2CMP.h)
export const TILE_FLAGS_OTHER = 0x1
export const TILE_FLAGS_WOOD_OBJ = 0x4

// D2MapTileFlags (Drlg/D2DrlgDrlg.h)
export const MAPTILE_FLAGS_NONE = 0x000000
export const MAPTILE_UNK_0x1 = 0x000001
export const MAPTILE_WALL_EXIT = 0x000002
export const MAPTILE_TREES = 0x000004
export const MAPTILE_HIDDEN = 0x000008
export const MAPTILE_UNK_0x10 = 0x000010
export const MAPTILE_HASPRESETUNITS = 0x000020
export const MAPTILE_UNWALKABLE = 0x000040
export const MAPTILE_FILL_LOS = 0x000080
export const MAPTILE_FLOOR_LINKER_PATH = 0x000100
export const MAPTILE_UNK_0x200 = 0x000200
export const MAPTILE_PITCH_BLACK = 0x000400
export const MAPTILE_OBJECT_WALL = 0x000800
export const MAPTILE_UNK_0x001000 = 0x001000
export const MAPTILE_LOS = 0x002000
export const MAPTILE_WALL_LAYER_BIT = 14
export const MAPTILE_WALL_LAYER_MASK = 0b111 << MAPTILE_WALL_LAYER_BIT

//D2DrlgRoomTile.h
export const DRLGROOMTILE_TILES_SIZE = 8
export const DRLGROOMTILE_SUBTILES_SIZE = DRLGROOMTILE_TILES_SIZE * 5

// D2C_Levels (DataTbls/LevelsIds.h) not exported by drlg-types.ts.
const LEVEL_BARRACKS = 28
const LEVEL_JAILLEV1 = 29
const LEVEL_JAILLEV2 = 30
const LEVEL_JAILLEV3 = 31
const LEVEL_INNERCLOISTER = 32
const LEVEL_CATHEDRAL = 33
const LEVEL_CATACOMBSLEV1 = 34
const LEVEL_CATACOMBSLEV2 = 35
const LEVEL_CATACOMBSLEV3 = 36
const LEVEL_CATACOMBSLEV4 = 37
const LEVEL_HAREMLEV2 = 51
const LEVEL_PALACECELLARLEV1 = 52
const LEVEL_PALACECELLARLEV2 = 53
const LEVEL_PALACECELLARLEV3 = 54
const LEVEL_STONYTOMBLEV1 = 55
const LEVEL_HALLSOFTHEDEADLEV1 = 56
const LEVEL_HALLSOFTHEDEADLEV2 = 57
const LEVEL_CLAWVIPERTEMPLELEV1 = 58
const LEVEL_STONYTOMBLEV2 = 59
const LEVEL_HALLSOFTHEDEADLEV3 = 60
const LEVEL_CLAWVIPERTEMPLELEV2 = 61
const LEVEL_MAGGOTLAIRLEV1 = 62
const LEVEL_MAGGOTLAIRLEV2 = 63
const LEVEL_MAGGOTLAIRLEV3 = 64
const LEVEL_TALRASHASTOMB1 = 66
const LEVEL_TALRASHASTOMB2 = 67
const LEVEL_TALRASHASTOMB3 = 68
const LEVEL_TALRASHASTOMB4 = 69
const LEVEL_TALRASHASTOMB5 = 70
const LEVEL_TALRASHASTOMB6 = 71
const LEVEL_TALRASHASTOMB7 = 72
const LEVEL_ARCANESANCTUARY = 74
const LEVEL_ID_ACT5_BARRICADE_1 = 111
const LEVEL_ARREATPLATEAU = 112
const LEVEL_TUNDRAWASTELANDS = 117

// D2C_ObjectIds (DataTbls/ObjectsIds.h)
const OBJECT_DOORGATELEFT = 13
const OBJECT_DOORGATERIGHT = 14
const OBJECT_DOORWOODENLEFT = 15
const OBJECT_DOORWOODENRIGHT = 16
const OBJECT_DOORCOURTYARDLEFT = 23
const OBJECT_DOORCOURTYARDRIGHT = 24
const OBJECT_DOORCATHEDRALDOUBLE = 25
const OBJECT_DOORMONASTERYDOUBLERIGHT = 27
const OBJECT_ANDARIELS_DOOR = 47
const OBJECT_PERMANENT_TOWN_PORTAL = 60
const OBJECT_DOORCATHEDRALLEFT = 62
const OBJECT_DOORCATHEDRALRIGHT = 63
const OBJECT_DOORWOODENLEFT2 = 64
const OBJECT_TOMBDOORLEFT = 91
const OBJECT_TOMBDOORRIGHT = 92
const OBJECT_SLIMEDOOR1 = 229
const OBJECT_SLIMEDOOR2 = 230
const OBJECT_IRONGRATEDOORLEFT = 290
const OBJECT_IRONGRATEDOORRIGHT = 291
const OBJECT_WOODENGRATEDOORLEFT = 292
const OBJECT_WOODENGRATEDOORRIGHT = 293
const OBJECT_WOODENDOORLEFT = 294
const OBJECT_WOODENDOORRIGHT = 295
const OBJECT_HARROGATH_TOWN_MAIN_GATE = 449

// D2C_MonsterIds (DataTbls/MonsterIds.h)
const MONSTER_BARRICADEDOOR1 = 432
const MONSTER_BARRICADEDOOR2 = 433
const MONSTER_PRISONDOOR = 434
const MONSTER_BARRICADETOWER = 435
const MONSTER_BARRICADEWALL1 = 524
const MONSTER_BARRICADEWALL2 = 525

// ---------------------------------------------------------------------------------------------
// D2C_PackedTileInformation (Drlg/D2DrlgDrlg.h): uint32 bitfield over a grid entry.
// ---------------------------------------------------------------------------------------------

export const PackedTile = {
  bIsWall: (p: number): boolean => (p & 0x00000001) !== 0,
  bIsFloor: (p: number): boolean => (p & 0x00000002) !== 0,
  bLOS: (p: number): boolean => (p & 0x00000004) !== 0,
  bEnclosed: (p: number): boolean => (p & 0x00000008) !== 0,
  bLayerAbove: (p: number): boolean => (p & 0x00000080) !== 0,
  /** uint32_t nTileSequence : 8 (bits 8..15) */
  nTileSequence: (p: number): number => (p >>> 8) & 0xff,
  bFillLOS: (p: number): boolean => (p & 0x00010000) !== 0,
  bUnwalkable: (p: number): boolean => (p & 0x00020000) !== 0,
  /** uint32_t nWallLayer : 2 (bits 18..19) */
  nWallLayer: (p: number): number => (p >>> 18) & 0x3,
  /** uint32_t nTileStyle : 6 (bits 20..25) */
  nTileStyle: (p: number): number => (p >>> 20) & 0x3f,
  bRevealHidden: (p: number): boolean => (p & 0x04000000) !== 0,
  bShadow: (p: number): boolean => (p & 0x08000000) !== 0,
  bLinkage: (p: number): boolean => (p & 0x10000000) !== 0,
  bObjectWall: (p: number): boolean => (p & 0x20000000) !== 0,
  bHidden: (p: number): boolean => (p & 0x80000000) !== 0,
  /** `nTileInformation.nTileSequence = v` (the bitfield keeps the low 8 bits). */
  setTileSequence: (p: number, v: number): number => ((p & ~0x0000ff00) | ((v & 0xff) << 8)) >>> 0,
  /** `nTileInformation.nTileStyle = v` (the bitfield keeps the low 6 bits). */
  setTileStyle: (p: number, v: number): number => ((p & ~0x03f00000) | ((v & 0x3f) << 20)) >>> 0,
  setLayerAbove: (p: number, b: boolean): number => (b ? p | 0x00000080 : p & ~0x00000080) >>> 0,
  setHidden: (p: number, b: boolean): number => (b ? p | 0x80000000 : p & ~0x80000000) >>> 0,
} as const

// Helper functions of Drlg/D2DrlgDrlg.h
export function HasMapTileLayer(nMapTileFlags: number): boolean {
  return (nMapTileFlags & MAPTILE_WALL_LAYER_MASK) !== 0
}

export function GetMapTileLayer(nMapTileFlags: number): number {
  return ((nMapTileFlags & MAPTILE_WALL_LAYER_MASK) >>> MAPTILE_WALL_LAYER_BIT) - 1
}

// Helper function of D2CMP.h
export function TileTypeIsAWallWithDoor(nTileType: number): boolean {
  return nTileType === TILETYPE_WALL_RIGHT_DOOR || nTileType === TILETYPE_WALL_LEFT_DOOR
}

// ---------------------------------------------------------------------------------------------
// Port helpers (memory safety only; no game logic)
// ---------------------------------------------------------------------------------------------

/** `pDrlgRoom->pTileGrid`, which every caller dereferences. */
export function tileGridOf(pDrlgRoom: D2DrlgRoomStrc): D2DrlgTileGridStrc {
  const pTileGrid = pDrlgRoom.pTileGrid
  if (!pTileGrid) throw new Error('pDrlgRoom->pTileGrid is NULL (DRLGROOMTILE_AllocTileGrid was not called)')
  return pTileGrid
}

/** `&pArray[nIndex]`: the element must exist inside the allocation. */
export function tileAt(pArray: D2DrlgTileDataStrc[] | null, nIndex: number, szWhat: string): D2DrlgTileDataStrc {
  if (!pArray) throw new Error(`${szWhat}: tile array is NULL`)
  const pTileData = nIndex >= 0 ? pArray[nIndex] : undefined
  if (!pTileData) throw new RangeError(`${szWhat}: element ${nIndex} is outside the ${pArray.length}-element allocation`)
  return pTileData
}

/** `pDrlgRoom->pTileGrid->pTiles` element count ceilings are C ints. */
const MAX_CHAIN = 1 << 22

function chainGuard(n: number, szWhat: string): void {
  if (n > MAX_CHAIN) throw new Error(`${szWhat}: tile chain does not terminate (C would loop forever)`)
}

//D2Common.0x6FD41000 (D2Collision.cpp). pRoom is the D2ActiveRoomStrc of the room owning pTileData;
// it only exists after DRLG_CreateRoomForRoomEx (D2Game), which the port never runs, so it is always
// NULL here and the function returns without touching anything (D2Collision.cpp:21).
function D2Common_COLLISION_FirstFn_6FD41000(
  pRoom: null,
  _pTileData: D2DrlgTileDataStrc,
  _pTileLibraryEntry: D2TileLibraryEntryStrc | null,
): void {
  if (pRoom !== null) {
    throw new Error('D2Common_COLLISION_FirstFn_6FD41000: active rooms (D2ActiveRoomStrc) are not ported')
  }
}

// DUNGEON_GameTileToClientCoords (D2Dungeon.cpp:1293, D2Common.0x6FD8D6E0 #10110)
function DUNGEON_GameTileToClientCoords(nX: number, nY: number): { nX: number; nY: number } {
  return { nX: Math.imul(80, (nX - nY) | 0), nY: (Math.imul(80, (nX + nY) | 0) / 2) | 0 }
}

// MONSTERS_ValidateMonsterId (D2Common Monsters.cpp)
function MONSTERS_ValidateMonsterId(pDrlgRoom: D2DrlgRoomStrc, nMonsterId: number): number {
  return nMonsterId >= 0 && nMonsterId < pDrlgRoom.pLevel.pDrlg.env.tables.nMonStatsTxtRecordCount ? nMonsterId : -1
}

// ---------------------------------------------------------------------------------------------
// DrlgRoomTile.cpp
// ---------------------------------------------------------------------------------------------

//1.10f:D2Common.0x6FD88860
//1.11: D2Common.0x6FD8D3D0
export function DRLGROOMTILE_GetTileCache(
  pDrlgRoom: D2DrlgRoomStrc,
  nType: number,
  nPackedTileInformation: number,
): D2TileLibraryEntryStrc {
  const ppTileLibraryEntries: D2TileLibraryEntryStrc[] = []
  const nStyle = PackedTile.nTileStyle(nPackedTileInformation)
  const nSequence = PackedTile.nTileSequence(nPackedTileInformation)

  let nEntries = D2CMP_10088_GetTiles(pDrlgRoom.pTiles, nType, nStyle, nSequence, ppTileLibraryEntries, 40)
  if (nEntries) {
    let nMax = 0
    for (let i = 0; i < nEntries; i += 1) {
      nMax = (nMax + D2CMP_10081_GetTileRarity(ppTileLibraryEntries[i]!)) | 0
    }

    let nId = 0
    let nRand = (SEED_RollLimitedRandomNumber(pDrlgRoom.pSeed, nMax) + 1) | 0
    if (nMax) {
      while (nEntries > 1 && nRand > 0) {
        nRand = (nRand - D2CMP_10081_GetTileRarity(ppTileLibraryEntries[nId]!)) | 0
        nId += 1
      }
      if (nId) {
        nId -= 1
      }
    }

    // ppTileLibraryEntries[40]: nId < nEntries unless the rarities are negative.
    const pEntry = ppTileLibraryEntries[nId]
    if (!pEntry) throw new RangeError(`DRLGROOMTILE_GetTileCache(${nType},${nStyle},${nSequence}): picked entry ${nId} of ${nEntries}`)
    return pEntry
  } else {
    nEntries = D2CMP_10088_GetTiles(pDrlgRoom.pTiles, TILETYPE_WALL_LEFT_EXIT, 0, 0, ppTileLibraryEntries, 40)
    if (!nEntries) {
      // FOG_DisplayWarning("nSize", ...), then ppTileLibraryEntries[0] == NULL is returned.
      throw new Error(`DRLGROOMTILE_GetTileCache(${nType},${nStyle},${nSequence}): fallback tile 10/0/0 missing`)
    }
    return ppTileLibraryEntries[0]!
  }
}

// Helper function
function DRLGROOMTILE_InitTileDataDefaults(
  pDrlgRoom: D2DrlgRoomStrc | null,
  pTileData: D2DrlgTileDataStrc,
  nX: number,
  nY: number,
  nPackedTileInformation: number,
  nTileType: number,
  pTileLibraryEntry: D2TileLibraryEntryStrc,
): void {
  pTileData.pTile = pTileLibraryEntry
  pTileData.nTileType = nTileType
  pTileData.dwFlags = MAPTILE_FLAGS_NONE
  pTileData.unk0x24 = 0
  pTileData.nGreen = 0xff
  pTileData.nBlue = 0xff
  pTileData.nRed = 0xff

  if (pDrlgRoom) {
    pTileData.nPosX = (nX - pDrlgRoom.pDrlgCoord.nPosX) | 0
    pTileData.nPosY = (nY - pDrlgRoom.pDrlgCoord.nPosY) | 0

    const client = DUNGEON_GameTileToClientCoords(nX, (nY + 1) | 0)

    pTileData.nWidth = client.nX
    pTileData.nHeight = (client.nY + DRLGROOMTILE_SUBTILES_SIZE) | 0
  }

  DRLGROOMTILE_InitializeTileDataFlags(pDrlgRoom, pTileData, nPackedTileInformation, nTileType, nX, nY)
}

//1.10f:D2Common.0x6FD889C0
//1.11: D2Common.0x6FD8D760
// ppTileData: `D2DrlgTileDataStrc**` as a { get, set } view of the chain head (null = nullptr).
export function DRLGROOMTILE_InitWallTileData(
  pDrlgRoom: D2DrlgRoomStrc,
  ppTileData: TileChainHead | null,
  nX: number,
  nY: number,
  nPackedTileInformation: number,
  pTileLibraryEntry: D2TileLibraryEntryStrc,
  nTileType: number,
): D2DrlgTileDataStrc {
  const pTileGrid = tileGridOf(pDrlgRoom)
  const pTileData = tileAt(pTileGrid.pTiles.pWallTiles, pTileGrid.nWalls, 'DRLGROOMTILE_InitWallTileData')
  if (ppTileData) {
    pTileData.unk0x20 = ppTileData.get()
    ppTileData.set(pTileData)
  } else {
    pTileData.unk0x20 = null
  }

  pTileGrid.nWalls = (pTileGrid.nWalls + 1) | 0

  DRLGROOMTILE_InitTileDataDefaults(pDrlgRoom, pTileData, nX, nY, nPackedTileInformation, nTileType, pTileLibraryEntry)

  if (nTileType === TILETYPE_WALL_TOP_CORNER_RIGHT) {
    DRLGROOMTILE_InitializeTileDataFlags(
      pDrlgRoom,
      DRLGROOMTILE_InitWallTileData(
        pDrlgRoom,
        ppTileData,
        nX,
        nY,
        nPackedTileInformation,
        DRLGROOMTILE_GetTileCache(pDrlgRoom, TILETYPE_WALL_TOP_CORNER_LEFT, nPackedTileInformation),
        TILETYPE_WALL_TOP_CORNER_LEFT,
      ),
      nPackedTileInformation,
      TILETYPE_WALL_TOP_CORNER_LEFT,
      nX,
      nY,
    )
  }

  return pTileData
}

//D2Common.0x6FD88AC0
export function DRLGROOMTILE_InitializeTileDataFlags(
  pDrlgRoom: D2DrlgRoomStrc | null,
  pTileData: D2DrlgTileDataStrc,
  nTileFlags: number,
  nType: number,
  nX: number,
  nY: number,
): void {
  const nTileInfo = nTileFlags >>> 0

  if (pDrlgRoom && (nType === TILETYPE_WALL_RIGHT_DOOR || nType === TILETYPE_WALL_LEFT_DOOR)) {
    DRLGROOMTILE_AddTilePresetUnits(pDrlgRoom, pTileData, nTileFlags, nX, nY, 0)
  }

  let dwFlags = pTileData.dwFlags
  if (nType !== TILETYPE_SHADOW) {
    dwFlags |= (PackedTile.nWallLayer(nTileInfo) + 1) << MAPTILE_WALL_LAYER_BIT
  }

  if (nType === TILETYPE_TREE) {
    dwFlags |= MAPTILE_TREES
  } else if (
    nType === TILETYPE_WALL_RIGHT_EXIT ||
    nType === TILETYPE_WALL_LEFT_EXIT ||
    nType === TILETYPE_WALL_RIGHT_DOOR ||
    nType === TILETYPE_WALL_LEFT_DOOR
  ) {
    dwFlags |= MAPTILE_WALL_EXIT
  }

  if (PackedTile.bLayerAbove(nTileInfo)) {
    dwFlags |= MAPTILE_UNK_0x1
  }

  if (PackedTile.bLinkage(nTileInfo)) {
    dwFlags |= MAPTILE_FLOOR_LINKER_PATH | MAPTILE_WALL_EXIT
  }

  if (PackedTile.bUnwalkable(nTileInfo)) {
    dwFlags |= MAPTILE_UNWALKABLE
  }

  if (PackedTile.bFillLOS(nTileInfo)) {
    dwFlags |= MAPTILE_FILL_LOS
  }

  if (PackedTile.bEnclosed(nTileInfo)) {
    dwFlags |= MAPTILE_TREES
  }

  if (!PackedTile.bHidden(nTileInfo)) {
    dwFlags &= ~MAPTILE_HIDDEN
  } else {
    dwFlags |= MAPTILE_HIDDEN
  }

  if (PackedTile.bRevealHidden(nTileInfo)) {
    dwFlags |= MAPTILE_UNK_0x200 | MAPTILE_TREES | MAPTILE_HIDDEN
  }

  if (PackedTile.bObjectWall(nTileInfo)) {
    dwFlags |= MAPTILE_OBJECT_WALL
  }

  if (PackedTile.bLOS(nTileInfo)) {
    dwFlags |= MAPTILE_LOS
  }

  if (!pTileData.pTile) throw new Error('DRLGROOMTILE_InitializeTileDataFlags: pTileData->pTile is NULL')
  const nFlags = D2CMP_10079_GetTileFlags(pTileData.pTile) & 0xffff
  if (nFlags & TILE_FLAGS_OTHER) {
    dwFlags |= MAPTILE_TREES
  }

  if (nFlags & TILE_FLAGS_WOOD_OBJ) {
    dwFlags |= MAPTILE_OBJECT_WALL
  }
  pTileData.dwFlags = dwFlags >>> 0
}

/** D2UnkDrlgRoomTileStrc */
interface D2UnkDrlgRoomTileStrc {
  nLevelId: number
  nArrayStartId: number
  nArrayEndId: number
}

/** D2UnkDrlgRoomTileStrc2 */
interface D2UnkDrlgRoomTileStrc2 {
  nTileStyle: number
  nTileSequence: number
  bIsRightWallWithDoor: boolean
  nUnitId: number
  nUnitType: number
  nX: number
  nY: number
}

const stru_6FDD0DA8: readonly D2UnkDrlgRoomTileStrc[] = [
  { nLevelId: LEVEL_BARRACKS, nArrayStartId: 0, nArrayEndId: 3 },
  { nLevelId: LEVEL_JAILLEV1, nArrayStartId: 0, nArrayEndId: 3 },
  { nLevelId: LEVEL_JAILLEV2, nArrayStartId: 0, nArrayEndId: 3 },
  { nLevelId: LEVEL_JAILLEV3, nArrayStartId: 0, nArrayEndId: 3 },
  { nLevelId: LEVEL_MONASTERYGATE, nArrayStartId: 4, nArrayEndId: 6 },
  { nLevelId: LEVEL_OUTERCLOISTER, nArrayStartId: 4, nArrayEndId: 6 },
  { nLevelId: LEVEL_INNERCLOISTER, nArrayStartId: 5, nArrayEndId: 9 },
  { nLevelId: LEVEL_CATHEDRAL, nArrayStartId: 5, nArrayEndId: 9 },
  { nLevelId: LEVEL_CATACOMBSLEV1, nArrayStartId: 10, nArrayEndId: 11 },
  { nLevelId: LEVEL_CATACOMBSLEV2, nArrayStartId: 10, nArrayEndId: 11 },
  { nLevelId: LEVEL_CATACOMBSLEV3, nArrayStartId: 10, nArrayEndId: 11 },
  { nLevelId: LEVEL_CATACOMBSLEV4, nArrayStartId: 10, nArrayEndId: 12 },
  { nLevelId: LEVEL_HAREMLEV2, nArrayStartId: 13, nArrayEndId: 14 },
  { nLevelId: LEVEL_PALACECELLARLEV1, nArrayStartId: 15, nArrayEndId: 18 },
  { nLevelId: LEVEL_PALACECELLARLEV2, nArrayStartId: 15, nArrayEndId: 18 },
  { nLevelId: LEVEL_PALACECELLARLEV3, nArrayStartId: 15, nArrayEndId: 18 },
  { nLevelId: LEVEL_STONYTOMBLEV1, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_HALLSOFTHEDEADLEV1, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_HALLSOFTHEDEADLEV2, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_CLAWVIPERTEMPLELEV1, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_STONYTOMBLEV2, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_HALLSOFTHEDEADLEV3, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_CLAWVIPERTEMPLELEV2, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_TALRASHASTOMB1, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_TALRASHASTOMB2, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_TALRASHASTOMB3, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_TALRASHASTOMB4, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_TALRASHASTOMB5, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_TALRASHASTOMB6, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_TALRASHASTOMB7, nArrayStartId: 19, nArrayEndId: 20 },
  { nLevelId: LEVEL_MAGGOTLAIRLEV1, nArrayStartId: 21, nArrayEndId: 22 },
  { nLevelId: LEVEL_MAGGOTLAIRLEV2, nArrayStartId: 21, nArrayEndId: 22 },
  { nLevelId: LEVEL_MAGGOTLAIRLEV3, nArrayStartId: 21, nArrayEndId: 22 },
  { nLevelId: LEVEL_HARROGATH, nArrayStartId: 23, nArrayEndId: 24 },
  { nLevelId: LEVEL_ID_ACT5_BARRICADE_1, nArrayStartId: 24, nArrayEndId: 33 },
  { nLevelId: LEVEL_ARREATPLATEAU, nArrayStartId: 24, nArrayEndId: 33 },
  { nLevelId: LEVEL_TUNDRAWASTELANDS, nArrayStartId: 24, nArrayEndId: 33 },
]

function door(
  nTileStyle: number,
  nTileSequence: number,
  bIsRightWallWithDoor: boolean,
  nUnitId: number,
  nUnitType: number,
  nX: number,
  nY: number,
): D2UnkDrlgRoomTileStrc2 {
  return { nTileStyle, nTileSequence, bIsRightWallWithDoor, nUnitId, nUnitType, nX, nY }
}

const stru_6FDD0F68: readonly D2UnkDrlgRoomTileStrc2[] = [
  door(7, 0, true, OBJECT_DOORGATERIGHT, UNIT_OBJECT, 5, 0),
  door(7, 0, false, OBJECT_DOORGATELEFT, UNIT_OBJECT, 0, 5),
  door(5, 0, true, OBJECT_DOORWOODENRIGHT, UNIT_OBJECT, 0, 0),
  door(5, 0, false, OBJECT_DOORWOODENLEFT, UNIT_OBJECT, 0, 0),
  door(6, 0, true, OBJECT_DOORMONASTERYDOUBLERIGHT, UNIT_OBJECT, 5, -2),
  door(4, 0, true, OBJECT_DOORCOURTYARDRIGHT, UNIT_OBJECT, 1, 2),
  door(4, 0, false, OBJECT_DOORCOURTYARDLEFT, UNIT_OBJECT, 0, 0),
  door(4, 3, true, OBJECT_DOORCATHEDRALDOUBLE, UNIT_OBJECT, 1, 0),
  door(1, 2, false, OBJECT_DOORCATHEDRALLEFT, UNIT_OBJECT, 0, 3),
  door(1, 2, true, OBJECT_DOORCATHEDRALRIGHT, UNIT_OBJECT, 3, 0),
  door(0, 0, true, OBJECT_DOORWOODENRIGHT, UNIT_OBJECT, 0, 0),
  door(0, 0, false, OBJECT_DOORWOODENLEFT2, UNIT_OBJECT, 0, 0),
  door(2, 0, true, OBJECT_ANDARIELS_DOOR, UNIT_OBJECT, 5, 0),
  door(0, 1, true, OBJECT_IRONGRATEDOORRIGHT, UNIT_OBJECT, 2, 0),
  door(0, 1, false, OBJECT_IRONGRATEDOORLEFT, UNIT_OBJECT, 0, 2),
  door(5, 0, true, OBJECT_WOODENGRATEDOORRIGHT, UNIT_OBJECT, 2, 0),
  door(4, 0, false, OBJECT_WOODENGRATEDOORLEFT, UNIT_OBJECT, 0, 2),
  door(0, 0, true, OBJECT_WOODENDOORRIGHT, UNIT_OBJECT, 2, 0),
  door(0, 0, false, OBJECT_WOODENDOORLEFT, UNIT_OBJECT, 0, 2),
  door(2, 4, true, OBJECT_TOMBDOORRIGHT, UNIT_OBJECT, 1, 0),
  door(2, 1, false, OBJECT_TOMBDOORLEFT, UNIT_OBJECT, 0, 2),
  door(0, 1, true, OBJECT_SLIMEDOOR1, UNIT_OBJECT, 0, 0),
  door(0, 1, false, OBJECT_SLIMEDOOR2, UNIT_OBJECT, 0, 0),
  door(3, 3, false, OBJECT_HARROGATH_TOWN_MAIN_GATE, UNIT_OBJECT, -2, 4),

  door(2, 1, false, MONSTER_BARRICADETOWER, UNIT_MONSTER, 1, 2),
  door(2, 1, true, MONSTER_BARRICADETOWER, UNIT_MONSTER, 2, 1),
  door(2, 6, false, MONSTER_BARRICADETOWER, UNIT_MONSTER, 1, 1),
  door(2, 2, false, MONSTER_BARRICADEDOOR2, UNIT_MONSTER, 0, 1),
  door(2, 3, true, MONSTER_BARRICADEDOOR1, UNIT_MONSTER, 1, 0),
  door(26, 0, false, MONSTER_PRISONDOOR, UNIT_MONSTER, 0, 1),
  door(2, 4, true, MONSTER_BARRICADEWALL1, UNIT_MONSTER, 0, 0),
  door(2, 4, false, MONSTER_BARRICADEWALL2, UNIT_MONSTER, 0, 0),

  door(29, 0, true, OBJECT_PERMANENT_TOWN_PORTAL, UNIT_OBJECT, 2, 0),
  door(29, 0, false, OBJECT_PERMANENT_TOWN_PORTAL, UNIT_OBJECT, 0, 2),
]

//D2Common.0x6FD88BE0
export function DRLGROOMTILE_AddTilePresetUnits(
  pDrlgRoom: D2DrlgRoomStrc,
  pTileData: D2DrlgTileDataStrc | null,
  nPackedTileInformation: number,
  nX: number,
  nY: number,
  nTileType: number,
): void {
  let bIsRightWallWithDoor = false

  if (pTileData) {
    if (pTileData.dwFlags & MAPTILE_HASPRESETUNITS) {
      return
    }

    bIsRightWallWithDoor = pTileData.nTileType === TILETYPE_WALL_RIGHT_DOOR
  } else {
    bIsRightWallWithDoor = nTileType === TILETYPE_WALL_RIGHT_DOOR
  }

  for (let i = 0; i < stru_6FDD0DA8.length; i += 1) {
    if (stru_6FDD0DA8[i]!.nLevelId === pDrlgRoom.pLevel.nLevelId) {
      const nTileStyle = PackedTile.nTileStyle(nPackedTileInformation)
      const nTileSequence = PackedTile.nTileSequence(nPackedTileInformation)

      for (let j = stru_6FDD0DA8[i]!.nArrayStartId; j <= stru_6FDD0DA8[i]!.nArrayEndId; j += 1) {
        const pEntry = stru_6FDD0F68[j]!
        if (
          nTileStyle === pEntry.nTileStyle &&
          nTileSequence === pEntry.nTileSequence &&
          bIsRightWallWithDoor === pEntry.bIsRightWallWithDoor
        ) {
          const sub = DUNGEON_GameTileToSubtileCoords(
            (nX - pDrlgRoom.pDrlgCoord.nPosX) | 0,
            (nY - pDrlgRoom.pDrlgCoord.nPosY) | 0,
          )
          const nPosX = (sub.nX + pEntry.nX) | 0
          const nPosY = (sub.nY + pEntry.nY) | 0

          if (
            nPosX >= 0 &&
            nPosY >= 0 &&
            nPosX < 5 * pDrlgRoom.pDrlgCoord.nWidth &&
            nPosY < 5 * pDrlgRoom.pDrlgCoord.nHeight
          ) {
            const nUnitId = pEntry.nUnitId

            switch (pEntry.nUnitType) {
              case UNIT_MONSTER:
                DRLGROOM_AllocPresetUnit(
                  pDrlgRoom,
                  UNIT_MONSTER,
                  MONSTERS_ValidateMonsterId(pDrlgRoom, nUnitId),
                  MONMODE_NEUTRAL,
                  nPosX,
                  nPosY,
                )
                break

              case UNIT_OBJECT:
                if (nUnitId < 91 || nUnitId > 92 || SEED_RollRandomNumber(pDrlgRoom.pSeed) % 3) {
                  DRLGROOM_AllocPresetUnit(pDrlgRoom, UNIT_OBJECT, nUnitId, OBJMODE_NEUTRAL, nPosX, nPosY)
                }
                break

              default:
                DRLGROOM_AllocPresetUnit(pDrlgRoom, pEntry.nUnitType, nUnitId, 0, nPosX, nPosY)
                break
            }

            if (pTileData) {
              pTileData.dwFlags = (pTileData.dwFlags | MAPTILE_HASPRESETUNITS) >>> 0
            }
          }
          return
        }
      }
    }
  }
}

//D2Common.0x6FD88DD0
export function DRLGROOMTILE_InitTileData(
  pDrlgRoom: D2DrlgRoomStrc,
  pTileData: D2DrlgTileDataStrc,
  nX: number,
  nY: number,
  nPackedTileInformation: number,
  pTileLibraryEntry: D2TileLibraryEntryStrc,
): void {
  DRLGROOMTILE_InitTileDataDefaults(pDrlgRoom, pTileData, nX, nY, nPackedTileInformation, TILETYPE_FLOOR, pTileLibraryEntry)
}

//D2Common.0x6FD88E60
export function DRLGROOMTILE_InitFloorTileData(
  pDrlgRoom: D2DrlgRoomStrc,
  ppTileData: TileChainHead | null,
  nX: number,
  nY: number,
  nPackedTileInformation: number,
  pTileLibraryEntry: D2TileLibraryEntryStrc,
): D2DrlgTileDataStrc {
  const pTileGrid = tileGridOf(pDrlgRoom)
  const pTileData = tileAt(pTileGrid.pTiles.pFloorTiles, pTileGrid.nFloors, 'DRLGROOMTILE_InitFloorTileData')
  if (ppTileData) {
    pTileData.unk0x20 = ppTileData.get()
    ppTileData.set(pTileData)
  } else {
    pTileData.unk0x20 = null
  }

  pTileGrid.nFloors = (pTileGrid.nFloors + 1) | 0

  DRLGROOMTILE_InitTileData(pDrlgRoom, pTileData, nX, nY, nPackedTileInformation, pTileLibraryEntry)
  return pTileData
}

//D2Common.0x6FD88F10
export function DRLGROOMTILE_InitShadowTileData(
  pDrlgRoom: D2DrlgRoomStrc,
  ppTileData: TileChainHead | null,
  nX: number,
  nY: number,
  nPackedTileInformation: number,
  pTileLibraryEntry: D2TileLibraryEntryStrc,
): D2DrlgTileDataStrc {
  const pTileGrid = tileGridOf(pDrlgRoom)
  const pTileData = tileAt(pTileGrid.pTiles.pRoofTiles, pTileGrid.nShadows, 'DRLGROOMTILE_InitShadowTileData')
  if (ppTileData) {
    pTileData.unk0x20 = ppTileData.get()
    ppTileData.set(pTileData)
  } else {
    pTileData.unk0x20 = null
  }

  pTileGrid.nShadows = (pTileGrid.nShadows + 1) | 0

  DRLGROOMTILE_InitTileDataDefaults(pDrlgRoom, pTileData, nX, nY, nPackedTileInformation, TILETYPE_SHADOW, pTileLibraryEntry)

  return pTileData
}

//D2Common.0x6FD88FD0
export function DRLGROOMTILE_InitTileShadow(
  pDrlgRoom: D2DrlgRoomStrc,
  nX: number,
  nY: number,
  nPackedTileInformation: number,
): void {
  DRLGROOMTILE_InitShadowTileData(
    pDrlgRoom,
    null,
    nX,
    nY,
    nPackedTileInformation,
    DRLGROOMTILE_GetTileCache(pDrlgRoom, TILETYPE_SHADOW, nPackedTileInformation),
  )
}

/**
 * A `D2DrlgTileDataStrc**` argument: the chain head it points to (D2DrlgTileLinkStrc::pMapTile or
 * D2RoomTileStrc::unk0x0C).
 */
export interface TileChainHead {
  get(): D2DrlgTileDataStrc | null
  set(pTileData: D2DrlgTileDataStrc): void
}

function linkHead(pTileLink: D2DrlgTileLinkStrc): TileChainHead {
  return {
    get: () => pTileLink.pMapTile,
    set: (pTileData) => {
      pTileLink.pMapTile = pTileData
    },
  }
}

function warpHead0C(pWarpTile: D2RoomTileStrc): TileChainHead {
  return {
    get: () => pWarpTile.unk0x0C,
    set: (pTileData) => {
      pWarpTile.unk0x0C = pTileData
    },
  }
}

//1.10f:D2Common.0x6FD89000
//1.11: D2Common.0x6FD8E0B0
//1.14d: 0x0066E9B0
export function DRLGROOMTILE_LoadInitRoomTiles(
  pDrlgRoom: D2DrlgRoomStrc,
  pTilePackedInfoGrid: D2DrlgGridStrc,
  pTileTypeGrid: D2DrlgGridStrc | null,
  bFillBlanks: boolean,
  bKillEdgeX: boolean,
  bKillEdgeY: boolean,
): void {
  const nTileCountX = (pDrlgRoom.pDrlgCoord.nWidth + (bKillEdgeX ? 0 : 1)) | 0
  const nTileCountY = (pDrlgRoom.pDrlgCoord.nHeight + (bKillEdgeY ? 0 : 1)) | 0

  const nRoomX = pDrlgRoom.pDrlgCoord.nPosX
  const nRoomY = pDrlgRoom.pDrlgCoord.nPosY

  for (let nTileOffsetY = 0; nTileOffsetY < nTileCountY; nTileOffsetY += 1) {
    for (let nTileOffsetX = 0; nTileOffsetX < nTileCountX; nTileOffsetX += 1) {
      const nPackedTileInformation = DRLGGRID_GetGridEntry(pTilePackedInfoGrid, nTileOffsetX, nTileOffsetY) >>> 0
      let nTileInformation = nPackedTileInformation
      const nTileStyle = PackedTile.nTileStyle(nTileInformation)
      const nTileSequence = PackedTile.nTileSequence(nTileInformation)

      const nTileType = pTileTypeGrid ? DRLGGRID_GetGridEntry(pTileTypeGrid, nTileOffsetX, nTileOffsetY) : TILETYPE_FLOOR

      if ((nTileType === TILETYPE_WALL_LEFT_EXIT || nTileType === TILETYPE_WALL_RIGHT_EXIT) && nTileStyle >= 8) {
        continue
      }

      if (nTileType === TILETYPE_FLOOR && nTileStyle === 30 && (nTileSequence === 0 || nTileSequence === 1)) {
        nTileInformation = PackedTile.setHidden(nTileInformation, true)
      }

      const nTilePosX = (nRoomX + nTileOffsetX) | 0
      const nTilePosY = (nRoomY + nTileOffsetY) | 0

      if (PackedTile.bHidden(nTileInformation)) {
        let bTileAdded = false
        switch (nTileType) {
          // Doors
          case TILETYPE_WALL_LEFT_DOOR:
          case TILETYPE_WALL_RIGHT_DOOR: {
            const nLevelId = pDrlgRoom.pLevel.nLevelId
            if (
              nLevelId === LEVEL_ID_ACT5_BARRICADE_1 ||
              nLevelId === LEVEL_ARREATPLATEAU ||
              nLevelId === LEVEL_TUNDRAWASTELANDS
            ) {
              break // ignore doors for those levels
            }
            DRLGROOMTILE_AddTilePresetUnits(pDrlgRoom, null, nTileInformation, nTilePosX, nTilePosY, nTileType)
            bTileAdded = true
            break
          }
          // Warps
          case TILETYPE_WALL_LEFT_EXIT:
          case TILETYPE_WALL_RIGHT_EXIT:
            if (nTileStyle < 8) {
              DRLGROOMTILE_AddWarp(pDrlgRoom, nTilePosX, nTilePosY, nTileInformation, nTileType)
              DRLGROOMTILE_LoadFloorWarpTiles(pDrlgRoom, nTilePosX, nTilePosY, nTileInformation, nTileType)
            }
            bTileAdded = true
            break

          default:
            break
        }
        if (bTileAdded) {
          continue
        }
      }

      let bTileAdded = false
      if (PackedTile.bLOS(nTileInformation)) {
        bTileAdded = true
        if (PackedTile.bIsFloor(nTileInformation)) {
          if (nTileStyle === 30 && (nTileSequence === 0 || nTileSequence === 1)) {
            nTileInformation = PackedTile.setLayerAbove(nTileInformation, false)
          }

          const ppLinkedRoom: { p: D2DrlgRoomStrc | null } = { p: null }
          const pLinkedTileData = DRLGROOMTILE_GetLinkedTileData(pDrlgRoom, true, nTileInformation, nTilePosX, nTilePosY, ppLinkedRoom)
          if (pLinkedTileData) {
            DRLGROOMTILE_LinkedTileDataManager(
              pDrlgRoom,
              ppLinkedRoom.p!,
              pLinkedTileData,
              TILETYPE_FLOOR,
              nTileInformation,
              nTilePosX,
              nTilePosY,
            )
          } else {
            DRLGROOMTILE_AddLinkedTileData(pDrlgRoom, TILETYPE_FLOOR, nTileInformation, nTilePosX, nTilePosY)
          }
        } else if (PackedTile.bIsWall(nTileInformation)) {
          const ppLinkedRoom: { p: D2DrlgRoomStrc | null } = { p: null }
          const pLinkedTileData = DRLGROOMTILE_GetLinkedTileData(
            pDrlgRoom,
            nTileType === TILETYPE_FLOOR,
            nTileInformation,
            nTilePosX,
            nTilePosY,
            ppLinkedRoom,
          )
          if (pLinkedTileData) {
            DRLGROOMTILE_LinkedTileDataManager(
              pDrlgRoom,
              ppLinkedRoom.p!,
              pLinkedTileData,
              nTileType,
              nTileInformation,
              nTilePosX,
              nTilePosY,
            )
          } else {
            DRLGROOMTILE_AddLinkedTileData(pDrlgRoom, nTileType, nTileInformation, nTilePosX, nTilePosY)
          }
        } else if (PackedTile.bShadow(nTileInformation) && !PackedTile.bHidden(nTileInformation)) {
          DRLGROOMTILE_GetCreateLinkedTileData(pDrlgRoom, TILETYPE_SHADOW, nTileInformation, nTilePosX, nTilePosY)
        } else {
          bTileAdded = false
        }
      }

      if (!bTileAdded) {
        if (PackedTile.bIsFloor(nTileInformation)) {
          const pTileCache = DRLGROOMTILE_GetTileCache(pDrlgRoom, TILETYPE_FLOOR, nTileInformation)
          DRLGROOMTILE_InitFloorTileData(pDrlgRoom, null, nTilePosX, nTilePosY, nTileInformation, pTileCache)
        } else if (bFillBlanks && DRLGROOM_AreXYInsideCoordinates(pDrlgRoom.pDrlgCoord, nTilePosX, nTilePosY)) {
          let nCachedTileInfo = 0
          nCachedTileInfo = PackedTile.setTileStyle(nCachedTileInfo, 30)
          nCachedTileInfo = PackedTile.setTileSequence(nCachedTileInfo, pDrlgRoom.pLevel.nLevelId === LEVEL_ARCANESANCTUARY ? 1 : 0)
          const pTileCache = DRLGROOMTILE_GetTileCache(pDrlgRoom, 0, nCachedTileInfo)

          let nArcaneFloorTileInfo = nTileInformation
          nArcaneFloorTileInfo = PackedTile.setLayerAbove(nArcaneFloorTileInfo, false)
          nArcaneFloorTileInfo = PackedTile.setHidden(nArcaneFloorTileInfo, true)
          DRLGROOMTILE_InitFloorTileData(pDrlgRoom, null, nTilePosX, nTilePosY, nArcaneFloorTileInfo, pTileCache)
        }

        if (PackedTile.bIsWall(nTileInformation)) {
          const pTileCache = DRLGROOMTILE_GetTileCache(pDrlgRoom, nTileType, nTileInformation)
          const pWallTileData = DRLGROOMTILE_InitWallTileData(
            pDrlgRoom,
            null,
            nTilePosX,
            nTilePosY,
            nTileInformation,
            pTileCache,
            nTileType,
          )
          if (
            (nTileType === TILETYPE_WALL_RIGHT_EXIT || nTileType === TILETYPE_WALL_LEFT_EXIT) &&
            pDrlgRoom.pLevel.nLevelId !== 133
          ) {
            DRLGROOMTILE_LoadWallWarpTiles(pDrlgRoom, pWallTileData, nTileInformation, nTileType)
          }
        }

        if (PackedTile.bShadow(nTileInformation)) {
          const pTileCache = DRLGROOMTILE_GetTileCache(pDrlgRoom, TILETYPE_SHADOW, nTileInformation)
          DRLGROOMTILE_InitShadowTileData(pDrlgRoom, null, nTilePosX, nTilePosY, nTileInformation, pTileCache)
        }
      }
    }
  }
}

//D2Common.0x6FD89360
export function DRLGROOMTILE_AddWarp(
  pDrlgRoom: D2DrlgRoomStrc,
  nX: number,
  nY: number,
  nPackedTileInformation: number,
  nTileType: number,
): boolean {
  const pLvlWarpTxtRecord = DRLGWARP_GetLvlWarpTxtRecordFromWarpIdAndDirection(
    pDrlgRoom.pLevel,
    PackedTile.nTileStyle(nPackedTileInformation),
    nTileType === TILETYPE_WALL_RIGHT_EXIT ? 'r' : 'l',
  )

  // DATATBLS_GetLvlWarpTxtRecordFromLevelIdAndDirection never returns NULL (it asserts instead).
  if (pLvlWarpTxtRecord) {
    const nPosX0 = (nX - pDrlgRoom.pDrlgCoord.nPosX) | 0
    const nPosY0 = (nY - pDrlgRoom.pDrlgCoord.nPosY) | 0

    if (nPosX0 !== pDrlgRoom.pDrlgCoord.nWidth && nPosY0 !== pDrlgRoom.pDrlgCoord.nHeight) {
      const sub = DUNGEON_GameTileToSubtileCoords(nPosX0, nPosY0)

      const nPosX = (sub.nX + pLvlWarpTxtRecord.dwOffsetX) | 0
      const nPosY = (sub.nY + pLvlWarpTxtRecord.dwOffsetY) | 0

      DRLGROOM_AllocPresetUnit(pDrlgRoom, UNIT_TILE, pLvlWarpTxtRecord.dwLevelId, OBJMODE_NEUTRAL, nPosX, nPosY)

      return true
    }
  }

  return false
}

// Helper functions
function DRLGROOMTILE_FindDestinationWarpTile(pDrlgRoom: D2DrlgRoomStrc, nTileInformation: number): D2RoomTileStrc | null {
  const nDestinationLevelId = DRLGWARP_GetWarpDestinationFromArray(pDrlgRoom.pLevel, PackedTile.nTileStyle(nTileInformation))
  let pWarpTile = pDrlgRoom.pRoomTiles
  // uint32_t dwLevelId != int nDestinationLevelId: equal bit patterns.
  while (pWarpTile && (pWarpTile.pLvlWarpTxtRecord.dwLevelId | 0) !== (nDestinationLevelId | 0)) {
    pWarpTile = pWarpTile.pNext
  }
  return pWarpTile
}

function DRLGROOMTILE_UpdateAndGetLvlWarpTxtRecord(
  pDrlgRoom: D2DrlgRoomStrc,
  pWarpTile: D2RoomTileStrc,
  nTileType: number,
): LvlWarpRecord {
  const pLvlWarpTxtRecord = pWarpTile.pLvlWarpTxtRecord
  if (!pLvlWarpTxtRecord) throw new Error('D2_ASSERT(pLvlWarpTxtRecord)')

  if (pLvlWarpTxtRecord.szDirection[0] !== 'b') {
    const szDirection = nTileType === TILETYPE_WALL_RIGHT_EXIT ? 'r' : 'l'

    if (pLvlWarpTxtRecord.szDirection[0] !== szDirection) {
      pWarpTile.pLvlWarpTxtRecord = DATATBLS_GetLvlWarpTxtRecordFromLevelIdAndDirection(
        pDrlgRoom.pLevel.pDrlg.env.tables,
        pLvlWarpTxtRecord.dwLevelId,
        szDirection,
      )
    }
  }
  return pWarpTile.pLvlWarpTxtRecord
}

//1.10f:D2Common.0x6FD89410
//1.11: D2Common.0x6FD8DBD0
export function DRLGROOMTILE_LoadWallWarpTiles(
  pDrlgRoom: D2DrlgRoomStrc,
  pTileData: D2DrlgTileDataStrc,
  nPackedTileInformation: number,
  nTileType: number,
): void {
  let nTileInformation = nPackedTileInformation >>> 0

  const pWarpTile = DRLGROOMTILE_FindDestinationWarpTile(pDrlgRoom, nTileInformation)

  if (!pWarpTile) {
    // FOG_DisplayWarning("ptWarp", ...): a hard failure in the native oracle.
    throw new Error(`DRLGROOMTILE_LoadWallWarpTiles: no warp tile for style ${PackedTile.nTileStyle(nTileInformation)} (ptWarp)`)
  }

  const nTileSequence = PackedTile.nTileSequence(nTileInformation)
  if (
    (nTileSequence !== 0 && nTileSequence !== 4) ||
    DRLGROOMTILE_AddWarp(
      pDrlgRoom,
      (pDrlgRoom.pDrlgCoord.nPosX + pTileData.nPosX) | 0,
      (pTileData.nPosY + pDrlgRoom.pDrlgCoord.nPosY) | 0,
      nTileInformation,
      nTileType,
    )
  ) {
    pTileData.unk0x20 = pWarpTile.unk0x10
    pWarpTile.unk0x10 = pTileData

    const pWarpDef = DRLGROOMTILE_UpdateAndGetLvlWarpTxtRecord(pDrlgRoom, pWarpTile, nTileType)

    if (pWarpDef.dwLitVersion) {
      nTileInformation = PackedTile.setTileSequence(nTileInformation, PackedTile.nTileSequence(nTileInformation) | pWarpDef.dwTiles)
      const pTileCache = DRLGROOMTILE_GetTileCache(pDrlgRoom, nTileType, nTileInformation)
      const pDrlgTileData = DRLGROOMTILE_InitWallTileData(
        pDrlgRoom,
        warpHead0C(pWarpTile),
        (pDrlgRoom.pDrlgCoord.nPosX + pTileData.nPosX) | 0,
        (pTileData.nPosY + pDrlgRoom.pDrlgCoord.nPosY) | 0,
        nTileInformation,
        pTileCache,
        nTileType,
      )
      if (pDrlgTileData) {
        pDrlgTileData.dwFlags = (pDrlgTileData.dwFlags | MAPTILE_HIDDEN) >>> 0
      }
    }
  }
}

//D2Common.0x6FDD1320
const gWarpTileOffsets_6FDD1320: readonly { nX: number; nY: number }[] = [
  { nX: 0, nY: 0 },
  { nX: 1, nY: 0 },
  { nX: 0, nY: 1 },
  { nX: 1, nY: 1 },
]

//1.10f:D2Common.0x6FD89590
//1.11: D2Common.0x6FD8DA30
export function DRLGROOMTILE_LoadFloorWarpTiles(
  pDrlgRoom: D2DrlgRoomStrc,
  nX: number,
  nY: number,
  nPackedTileInformation: number,
  nTileType: number,
): void {
  const nTileInformation = nPackedTileInformation >>> 0

  pDrlgRoom.dwFlags = (pDrlgRoom.dwFlags | DRLGROOMFLAG_POPULATION_ZERO) >>> 0

  const pWarpTile = DRLGROOMTILE_FindDestinationWarpTile(pDrlgRoom, nTileInformation)
  if (pWarpTile) {
    const pWarpDef = DRLGROOMTILE_UpdateAndGetLvlWarpTxtRecord(pDrlgRoom, pWarpTile, nTileType)

    if (pWarpDef.dwLitVersion) {
      for (let nDestinationTileSequence = 0; nDestinationTileSequence < 4; nDestinationTileSequence += 1) {
        let nDestinationTileInformation = 0
        // This is how we reference links between tiles to hide/show
        nDestinationTileInformation = PackedTile.setTileStyle(nDestinationTileInformation, PackedTile.nTileSequence(nTileInformation))
        nDestinationTileInformation = PackedTile.setTileSequence(nDestinationTileInformation, nDestinationTileSequence | 4)
        const pTileCache = DRLGROOMTILE_GetTileCache(pDrlgRoom, TILETYPE_FLOOR, nDestinationTileInformation)

        const nDestinationTilePosX = (nX - 1 + gWarpTileOffsets_6FDD1320[nDestinationTileSequence]!.nX) | 0
        const nDestinationTilePosY = (nY - 1 + gWarpTileOffsets_6FDD1320[nDestinationTileSequence]!.nY) | 0
        const pDestTileData = DRLGROOMTILE_InitFloorTileData(
          pDrlgRoom,
          warpHead0C(pWarpTile),
          nDestinationTilePosX,
          nDestinationTilePosY,
          nDestinationTileInformation,
          pTileCache,
        )
        pDestTileData.dwFlags = (pDestTileData.dwFlags | MAPTILE_HIDDEN) >>> 0
      }

      const pTileGrid = tileGridOf(pDrlgRoom)
      for (let i = 0; i < pTileGrid.nFloors; i += 1) {
        const pFloorTileData = tileAt(pTileGrid.pTiles.pFloorTiles, i, 'DRLGROOMTILE_LoadFloorWarpTiles')
        if (!pFloorTileData.pTile) throw new Error('DRLGROOMTILE_LoadFloorWarpTiles: floor tile without pTile')
        if (
          D2CMP_10078_GetTileStyle(pFloorTileData.pTile) >>> 0 === PackedTile.nTileSequence(nTileInformation) &&
          D2CMP_10082_GetTileSequence(pFloorTileData.pTile) >>> 0 < 4
        ) {
          pFloorTileData.unk0x20 = pWarpTile.unk0x10
          pWarpTile.unk0x10 = pFloorTileData
        }
      }
    }
  }
}

//1.10f:D2Common.0x6FD897E0
//1.11: D2Common.0x6FD8D130
export function DRLGROOMTILE_GetLinkedTileData(
  pDrlgRoom: D2DrlgRoomStrc,
  bFloor: boolean,
  nPackedTileInformation: number,
  nX: number,
  nY: number,
  ppDrlgRoom: { p: D2DrlgRoomStrc | null },
): D2DrlgTileDataStrc | null {
  const nTileInformation = nPackedTileInformation >>> 0

  for (let i = 0; i < pDrlgRoom.nRoomsNear; i += 1) {
    const pNearRoomEx = pDrlgRoom.ppRoomsNear[i]!

    if (
      pNearRoomEx !== pDrlgRoom &&
      pNearRoomEx.pTileGrid &&
      DRLGROOM_AreXYInsideCoordinatesOrOnBorder(pNearRoomEx.pDrlgCoord, nX, nY)
    ) {
      for (let pTileLink = pNearRoomEx.pTileGrid.pMapLinks; pTileLink; pTileLink = pTileLink.pNext) {
        if ((!pTileLink.bFloor && !bFloor) || (pTileLink.bFloor && bFloor)) {
          let n = 0
          for (let pTileData = pTileLink.pMapTile; pTileData; pTileData = pTileData.unk0x20) {
            chainGuard((n += 1), 'DRLGROOMTILE_GetLinkedTileData')
            if (
              ((pNearRoomEx.pDrlgCoord.nPosX + pTileData.nPosX) | 0) === nX &&
              ((pNearRoomEx.pDrlgCoord.nPosY + pTileData.nPosY) | 0) === nY
            ) {
              if (
                pTileData.nTileType !== TILETYPE_WALL_TOP_CORNER_LEFT &&
                (pTileData.nTileType === TILETYPE_SHADOW || !PackedTile.bShadow(nTileInformation))
              ) {
                if (!HasMapTileLayer(pTileData.dwFlags) || GetMapTileLayer(pTileData.dwFlags) === PackedTile.nWallLayer(nTileInformation)) {
                  ppDrlgRoom.p = pDrlgRoom.ppRoomsNear[i]!
                  return pTileData
                }
              }
            }
          }
        }
      }
    }
  }

  ppDrlgRoom.p = null
  return null
}

//1.10f:D2Common.0x6FD89930
//1.11: D2Common.0x6FD8DCE0
export function DRLGROOMTILE_AddLinkedTileData(
  pDrlgRoom: D2DrlgRoomStrc,
  nTileType: number,
  nPackedTileInformation: number,
  nX: number,
  nY: number,
): void {
  if (
    (nTileType !== TILETYPE_WALL_LEFT_EXIT && nTileType !== TILETYPE_WALL_RIGHT_EXIT) ||
    DRLGROOM_AreXYInsideCoordinates(pDrlgRoom.pDrlgCoord, nX, nY)
  ) {
    const pTileGrid = tileGridOf(pDrlgRoom)
    let pCurLink: D2DrlgTileLinkStrc | null
    for (pCurLink = pTileGrid.pMapLinks; pCurLink; pCurLink = pCurLink.pNext) {
      if ((pCurLink.bFloor && nTileType === TILETYPE_FLOOR) || (!pCurLink.bFloor && nTileType !== TILETYPE_FLOOR)) {
        // Use current tile
        break
      }
    }
    if (pCurLink === null) {
      const pTileLink: D2DrlgTileLinkStrc = {
        bFloor: nTileType === TILETYPE_FLOOR ? 1 : 0,
        pMapTile: null,
        pNext: pTileGrid.pMapLinks,
      }
      pTileGrid.pMapLinks = pTileLink
      pCurLink = pTileLink
    }

    const pTileCache = DRLGROOMTILE_GetTileCache(pDrlgRoom, nTileType, nPackedTileInformation)

    switch (nTileType) {
      case TILETYPE_FLOOR:
        DRLGROOMTILE_InitFloorTileData(pDrlgRoom, linkHead(pCurLink), nX, nY, nPackedTileInformation, pTileCache)
        break
      case TILETYPE_SHADOW:
        DRLGROOMTILE_InitShadowTileData(pDrlgRoom, linkHead(pCurLink), nX, nY, nPackedTileInformation, pTileCache)
        break
      default:
        DRLGROOMTILE_InitWallTileData(pDrlgRoom, linkHead(pCurLink), nX, nY, nPackedTileInformation, pTileCache, nTileType)
        if (nTileType === TILETYPE_WALL_LEFT_EXIT || nTileType === TILETYPE_WALL_RIGHT_EXIT) {
          DRLGROOMTILE_LoadWallWarpTiles(pDrlgRoom, pCurLink.pMapTile!, nPackedTileInformation, nTileType)
        }
        break
    }
  }
}

//D2Common.0x6FDD1340
// -1 Means stop and do nothing
// -2 Means ignore remapping but still init tile data
const nRemapIndices: readonly number[] = [
  -1,
  0, // [TILETYPE_WALL_LEFT            ]
  1, // [TILETYPE_WALL_RIGHT           ]
  2, // [TILETYPE_WALL_TOP_CORNER_RIGHT]
  -1, // [TILETYPE_WALL_TOP_CORNER_LEFT ] This one doesn't remap somehow
  3, // [TILETYPE_WALL_TOP_RIGHT       ]
  4, // [TILETYPE_WALL_BOTTOM_LEFT     ]
  5, // [TILETYPE_WALL_BOTTOM_RIGHT    ]
  -2, -2, -1, -1, -1, -2, -1, -1, -1, -1, -1, 0, 0,
]

//D2Common.0x6FDD1390
const nWallTileTypeRemap: readonly (readonly number[])[] = [
  /* [parameter nTileType value     ]    [pTileData->nTileType - 1] */
  /* [TILETYPE_WALL_LEFT            ] */ [TILETYPE_WALL_LEFT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_LEFT, TILETYPE_WALL_LEFT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_LEFT],
  /* [TILETYPE_WALL_RIGHT           ] */ [TILETYPE_WALL_LEFT, TILETYPE_WALL_RIGHT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_LEFT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_RIGHT, TILETYPE_WALL_RIGHT],
  /* [TILETYPE_WALL_TOP_CORNER_RIGHT] */ [TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_LEFT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_RIGHT],
  /* [TILETYPE_WALL_TOP_RIGHT       ] */ [TILETYPE_WALL_LEFT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_LEFT, TILETYPE_WALL_TOP_RIGHT, TILETYPE_WALL_BOTTOM_LEFT, TILETYPE_WALL_LEFT],
  /* [TILETYPE_WALL_BOTTOM_LEFT     ] */ [TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_RIGHT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_LEFT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_BOTTOM_LEFT, TILETYPE_WALL_RIGHT],
  /* [TILETYPE_WALL_BOTTOM_RIGHT    ] */ [TILETYPE_WALL_LEFT, TILETYPE_WALL_RIGHT, TILETYPE_WALL_TOP_CORNER_RIGHT, TILETYPE_WALL_TOP_CORNER_LEFT, TILETYPE_WALL_LEFT, TILETYPE_WALL_RIGHT, TILETYPE_WALL_BOTTOM_RIGHT],
]

//1.10f:D2Common.0x6FD89AF0
//1.11: D2Common.0x6FD8DE40
export function DRLGROOMTILE_LinkedTileDataManager(
  pDrlgRoom1: D2DrlgRoomStrc,
  pDrlgRoom2: D2DrlgRoomStrc,
  pTileData: D2DrlgTileDataStrc,
  nTileType: number,
  nPackedTileInformation: number,
  nX: number,
  nY: number,
): void {
  const nTileInformation = nPackedTileInformation >>> 0
  if (nTileType < 0 || nTileType >= nRemapIndices.length) {
    throw new RangeError(`DRLGROOMTILE_LinkedTileDataManager: nRemapIndices[${nTileType}] is outside the table`)
  }
  const v10 = nRemapIndices[nTileType]!

  if (pTileData.dwFlags & MAPTILE_UNK_0x1) {
    if (TileTypeIsAWallWithDoor(pTileData.nTileType)) {
      DRLGROOMTILE_InitializeTileDataFlags(pDrlgRoom1, pTileData, nPackedTileInformation, pTileData.nTileType, nX, nY)
    }

    return
  }

  if (!PackedTile.bLayerAbove(nTileInformation)) {
    let b = false
    if (!TileTypeIsAWallWithDoor(nTileType)) {
      if (TileTypeIsAWallWithDoor(pTileData.nTileType) && (nX === pDrlgRoom2.pDrlgCoord.nPosX || nY === pDrlgRoom2.pDrlgCoord.nPosY)) {
        return
      }

      b = true
    }

    if (b || (nX !== pDrlgRoom1.pDrlgCoord.nPosX && nY !== pDrlgRoom1.pDrlgCoord.nPosY)) {
      const bIsTileTypeANormalWallOrFloor = pTileData.nTileType <= TILETYPE_WALL_BOTTOM_RIGHT
      if (v10 < 0 || !bIsTileTypeANormalWallOrFloor) {
        if (v10 !== -1) {
          return
        }
      } else {
        if (!(v10 < 6)) throw new Error('D2_ASSERT(v10 < 6)')
        if (!(pTileData.nTileType >= 0)) throw new Error('D2_ASSERT(pTileData->nTileType >= 0)')
        const nWallIdx = pTileData.nTileType - TILETYPE_WALL_LEFT // From 0 to 6
        if (nWallIdx < 0) {
          // pTileData->nTileType == TILETYPE_FLOOR reads nWallTileTypeRemap[v10][-1] (out of bounds).
          throw new RangeError(`DRLGROOMTILE_LinkedTileDataManager: nWallTileTypeRemap[${v10}][${nWallIdx}]`)
        }
        nTileType = nWallTileTypeRemap[v10]![nWallIdx]!
      }
    }
  }

  if (pTileData.nTileType === TILETYPE_WALL_TOP_CORNER_RIGHT) {
    if (nTileType !== TILETYPE_WALL_TOP_CORNER_RIGHT) {
      const pNext = pTileData.unk0x20
      if (!pNext) throw new Error('DRLGROOMTILE_LinkedTileDataManager: pTileData->unk0x20 is NULL')
      pNext.dwFlags = (pNext.dwFlags | MAPTILE_HIDDEN) >>> 0
      D2Common_COLLISION_FirstFn_6FD41000(pDrlgRoom2.pRoom, pNext, null)
    }
  } else {
    if (nTileType === TILETYPE_WALL_TOP_CORNER_RIGHT) {
      pTileData.dwFlags = (pTileData.dwFlags | (3 << MAPTILE_WALL_LAYER_BIT) | MAPTILE_HIDDEN) >>> 0
      D2Common_COLLISION_FirstFn_6FD41000(pDrlgRoom2.pRoom, pTileData, null)
      DRLGROOMTILE_AddLinkedTileData(pDrlgRoom1, TILETYPE_WALL_TOP_CORNER_RIGHT, nPackedTileInformation, nX, nY)
    }
  }

  if (!pTileData.pTile) throw new Error('DRLGROOMTILE_LinkedTileDataManager: pTileData->pTile is NULL')
  if (
    nTileType !== pTileData.nTileType ||
    (pTileData.nTileType === TILETYPE_FLOOR &&
      D2CMP_10078_GetTileStyle(pTileData.pTile) === 30 &&
      D2CMP_10082_GetTileSequence(pTileData.pTile) === 0)
  ) {
    const pTileCache = DRLGROOMTILE_GetTileCache(pDrlgRoom2, nTileType, nPackedTileInformation)
    pTileData.nTileType = nTileType

    if (pTileCache !== pTileData.pTile && pDrlgRoom2.pRoom) {
      D2Common_COLLISION_FirstFn_6FD41000(pDrlgRoom2.pRoom, pTileData, pTileCache)
    }

    pTileData.pTile = pTileCache
  }

  DRLGROOMTILE_InitializeTileDataFlags(pDrlgRoom1, pTileData, nPackedTileInformation, pTileData.nTileType, nX, nY)
}

//D2Common.0x6FD89CC0
export function DRLGROOMTILE_GetCreateLinkedTileData(
  pDrlgRoom: D2DrlgRoomStrc,
  nTileType: number,
  nPackedTileInformation: number,
  nX: number,
  nY: number,
): void {
  const nTileInformation = nPackedTileInformation >>> 0

  for (let i = 0; i < pDrlgRoom.nRoomsNear; i += 1) {
    const pNearRoomEx = pDrlgRoom.ppRoomsNear[i]!
    if (
      pNearRoomEx !== pDrlgRoom &&
      pNearRoomEx.pTileGrid &&
      DRLGROOM_AreXYInsideCoordinatesOrOnBorder(pNearRoomEx.pDrlgCoord, nX, nY)
    ) {
      let pTileLink = pNearRoomEx.pTileGrid.pMapLinks
      while (pTileLink) {
        let pTileData = pTileLink.pMapTile

        if ((!pTileLink.bFloor && nTileType !== TILETYPE_FLOOR) || (pTileLink.bFloor && nTileType === TILETYPE_FLOOR)) {
          let n = 0
          while (pTileData) {
            chainGuard((n += 1), 'DRLGROOMTILE_GetCreateLinkedTileData')
            if (
              ((pNearRoomEx.pDrlgCoord.nPosX + pTileData.nPosX) | 0) === nX &&
              ((pNearRoomEx.pDrlgCoord.nPosY + pTileData.nPosY) | 0) === nY
            ) {
              if (
                pTileData.nTileType !== TILETYPE_WALL_TOP_CORNER_LEFT &&
                (pTileData.nTileType === TILETYPE_SHADOW || !PackedTile.bShadow(nTileInformation))
              ) {
                if (!HasMapTileLayer(pTileData.dwFlags) || GetMapTileLayer(pTileData.dwFlags) === PackedTile.nWallLayer(nTileInformation)) {
                  return DRLGROOMTILE_LinkedTileDataManager(
                    pDrlgRoom,
                    pDrlgRoom.ppRoomsNear[i]!,
                    pTileData,
                    nTileType,
                    nPackedTileInformation,
                    nX,
                    nY,
                  )
                }
              }
            }

            pTileData = pTileData.unk0x20
          }
        }

        pTileLink = pTileLink.pNext
      }
    }
  }

  DRLGROOMTILE_AddLinkedTileData(pDrlgRoom, nTileType, nPackedTileInformation, nX, nY)
}

//D2Common.0x6FD89E30
export function DRLGROOMTILE_CountAllTileTypes(
  pDrlgRoom: D2DrlgRoomStrc,
  pTileInfoGrid: D2DrlgGridStrc,
  bCheckCoordinatesValidity: boolean,
  bKillEdgeX: boolean,
  bKillEdgeY: boolean,
): void {
  const nTileCountX = (pDrlgRoom.pDrlgCoord.nWidth + (bKillEdgeX ? 0 : 1)) | 0
  const nTileCountY = (pDrlgRoom.pDrlgCoord.nHeight + (bKillEdgeY ? 0 : 1)) | 0
  const pTiles = tileGridOf(pDrlgRoom).pTiles

  for (let nY = 0; nY < nTileCountY; nY += 1) {
    for (let nX = 0; nX < nTileCountX; nX += 1) {
      // *DRLGGRID_GetGridFlagsPointer(pTileInfoGrid, nX, nY)
      const nTileInformation = DRLGGRID_GetGridEntry(pTileInfoGrid, nX, nY) >>> 0
      if (PackedTile.bIsWall(nTileInformation)) {
        pTiles.nWalls = (pTiles.nWalls + 1) | 0
      }

      if (
        PackedTile.bIsFloor(nTileInformation) ||
        (bCheckCoordinatesValidity &&
          DRLGROOM_AreXYInsideCoordinates(
            pDrlgRoom.pDrlgCoord,
            (nX + pDrlgRoom.pDrlgCoord.nPosX) | 0,
            (nY + pDrlgRoom.pDrlgCoord.nPosY) | 0,
          ))
      ) {
        pTiles.nFloors = (pTiles.nFloors + 1) | 0
      }

      if (PackedTile.bShadow(nTileInformation)) {
        pTiles.nRoofs = (pTiles.nRoofs + 1) | 0
      }
    }
  }
}

//D2Common.0x6FD89F00
export function DRLGROOMTILE_CountWallWarpTiles(
  pDrlgRoom: D2DrlgRoomStrc,
  pTileInfoGrid: D2DrlgGridStrc,
  pTileTypeGrid: D2DrlgGridStrc,
  bKillEdgeX: boolean,
  bKillEdgeY: boolean,
): void {
  const nTileCountX = (pDrlgRoom.pDrlgCoord.nWidth + (bKillEdgeX ? 0 : 1)) | 0
  const nTileCountY = (pDrlgRoom.pDrlgCoord.nHeight + (bKillEdgeY ? 0 : 1)) | 0
  const pTiles = tileGridOf(pDrlgRoom).pTiles

  for (let nY = 0; nY < nTileCountY; nY += 1) {
    for (let nX = 0; nX < nTileCountX; nX += 1) {
      switch (DRLGGRID_GetGridEntry(pTileTypeGrid, nX, nY)) {
        case TILETYPE_WALL_TOP_CORNER_RIGHT:
          pTiles.nWalls = (pTiles.nWalls + 1) | 0
          break
        case TILETYPE_WALL_LEFT_EXIT:
        case TILETYPE_WALL_RIGHT_EXIT:
          if (PackedTile.bHidden(DRLGGRID_GetGridEntry(pTileInfoGrid, nX, nY) >>> 0)) {
            pTiles.nFloors = (pTiles.nFloors + 6) | 0
          } else {
            pTiles.nWalls = (pTiles.nWalls + 1) | 0
          }
          break
        default:
          break
      }
    }
  }
}

//D2Common.0x6FD89FA0
export function DRLGROOMTILE_InitRoomGrids(pDrlgRoom: D2DrlgRoomStrc): void {
  SEED_InitLowSeed(pDrlgRoom.pSeed, pDrlgRoom.dwInitSeed)

  if (pDrlgRoom.nType === DRLGTYPE_MAZE) {
    DRLGOUTPLACE_InitOutdoorRoomGrids(pDrlgRoom)
  } else if (pDrlgRoom.nType === DRLGTYPE_PRESET) {
    DRLGPRESET_InitPresetRoomGrids(pDrlgRoom)
  }
}

//D2Common.0x6FD89FD0
export function DRLGROOMTILE_AddRoomMapTiles(pDrlgRoom: D2DrlgRoomStrc): void {
  if (pDrlgRoom.nType === DRLGTYPE_MAZE) {
    DRLGOUTROOM_InitializeDrlgOutdoorRoom(pDrlgRoom)
  } else if (pDrlgRoom.nType === DRLGTYPE_PRESET) {
    DRLGPRESET_AddPresetRoomMapTiles(pDrlgRoom)
  }

  pDrlgRoom.dwFlags = (pDrlgRoom.dwFlags | DRLGROOMFLAG_HAS_ROOM) >>> 0
}

/** A zeroed D2DrlgTileGridStrc (D2_CALLOC_STRC_POOL). */
function newTileGrid(): D2DrlgTileGridStrc {
  return {
    pMapLinks: null,
    pAnimTiles: null,
    nWalls: 0,
    nFloors: 0,
    nShadows: 0,
    pTiles: { pWallTiles: null, nWalls: 0, pFloorTiles: null, nFloors: 0, pRoofTiles: null, nRoofs: 0 },
  }
}

/** D2_CALLOC_POOL(sizeof(D2DrlgTileDataStrc) * n). */
function callocTileData(n: number): D2DrlgTileDataStrc[] {
  if (n < 0) throw new RangeError(`D2_CALLOC_POOL of ${n} tile data`)
  const pArray: D2DrlgTileDataStrc[] = new Array<D2DrlgTileDataStrc>(n)
  for (let i = 0; i < n; i += 1) pArray[i] = newTileData()
  return pArray
}

//D2Common.0x6FD8A010
export function DRLGROOMTILE_AllocTileGrid(pDrlgRoom: D2DrlgRoomStrc): void {
  if (!pDrlgRoom.pTileGrid) {
    pDrlgRoom.pTileGrid = newTileGrid()
  }
}

//D2Common.0x6FD8A050
export function DRLGROOMTILE_AllocTileData(pDrlgRoom: D2DrlgRoomStrc): void {
  const pRoomTiles = tileGridOf(pDrlgRoom).pTiles

  if (pRoomTiles.nFloors) {
    pRoomTiles.pFloorTiles = callocTileData(pRoomTiles.nFloors)
  }

  if (pRoomTiles.nWalls) {
    pRoomTiles.pWallTiles = callocTileData(pRoomTiles.nWalls)
  }

  // Something may already have allocated roof tiles with DRLGROOMTILE_ReallocRoofTileGrid!
  if (pRoomTiles.nRoofs && !pRoomTiles.pRoofTiles) {
    pRoomTiles.pRoofTiles = callocTileData(pRoomTiles.nRoofs)
  }
}

//D2Common.0x6FD8A130
// C: (void* pMemPool, D2DrlgTileGridStrc* pTileGrid, int nAdditionalRoofs), called by sub_6FD8ACE0 as
// (pMemPool, a4->pDrlgRoom->pTileGrid, nCounter); the TS caller passes a4.pDrlgRoom.
// D2_REALLOC_POOL keeps the old elements and appends uninitialised ones; the native oracle's
// FOG_ReallocPool zero-fills the grown bytes, so the appended elements are zeroed here too. Shadow
// pointers into the old block would dangle, which is why the chain [0..nShadows) is rebuilt.
export function DRLGROOMTILE_ReallocRoofTileGrid(pDrlgRoom: D2DrlgRoomStrc, nAdditionalRoofs: number): void {
  const pTileGrid = tileGridOf(pDrlgRoom)
  if (nAdditionalRoofs) {
    const nNewSize = (nAdditionalRoofs + pTileGrid.pTiles.nRoofs) | 0
    if (nNewSize <= 0) throw new RangeError(`D2_REALLOC_POOL of ${nNewSize} roof tiles`)
    const pOld = pTileGrid.pTiles.pRoofTiles ?? []
    const pNew: D2DrlgTileDataStrc[] = new Array<D2DrlgTileDataStrc>(nNewSize)
    for (let i = 0; i < nNewSize; i += 1) {
      pNew[i] = i < pOld.length ? pOld[i]! : newTileData()
    }
    pTileGrid.pTiles.pRoofTiles = pNew

    let nCounter = 0
    while (nCounter < pTileGrid.nShadows - 1) {
      tileAt(pNew, nCounter, 'DRLGROOMTILE_ReallocRoofTileGrid').unk0x20 = tileAt(pNew, nCounter + 1, 'DRLGROOMTILE_ReallocRoofTileGrid')
      nCounter += 1
    }

    tileAt(pNew, nCounter, 'DRLGROOMTILE_ReallocRoofTileGrid').unk0x20 = null
    pTileGrid.pTiles.nRoofs = (pTileGrid.pTiles.nRoofs + nAdditionalRoofs) | 0
  }
}

//D2Common.0x6FD8A380
export function DRLGROOMTILE_LoadDT1FilesForRoom(pDrlgRoom: D2DrlgRoomStrc): void {
  const env = pDrlgRoom.pLevel.pDrlg.env
  const pLvlTypesTxtRecord = DATATBLS_GetLvlTypesTxtRecord(env.tables, pDrlgRoom.pLevel.nLevelType)
  let dwDT1Mask = pDrlgRoom.dwDT1Mask >>> 0

  let nFileIndex = 0
  while (dwDT1Mask && nFileIndex < 32) {
    if (dwDT1Mask & 1) {
      D2CMP_10087_LoadTileLibrarySlot(env, pDrlgRoom.pTiles, pLvlTypesTxtRecord.szFile[nFileIndex]!)
    }
    dwDT1Mask >>>= 1
    nFileIndex += 1
  }

  D2CMP_10087_LoadTileLibrarySlot(env, pDrlgRoom.pTiles, 'DATA\\GLOBAL\\Tiles\\Act1\\Outdoors\\Blank.dt1')
  D2CMP_10087_LoadTileLibrarySlot(env, pDrlgRoom.pTiles, 'DATA\\GLOBAL\\Tiles\\Act1\\Barracks\\InvisWal.dt1')
  D2CMP_10087_LoadTileLibrarySlot(env, pDrlgRoom.pTiles, 'DATA\\GLOBAL\\Tiles\\Act1\\Barracks\\Warp.dt1')

  pDrlgRoom.dwFlags = (pDrlgRoom.dwFlags | DRLGROOMFLAG_TILELIB_LOADED) >>> 0
}
