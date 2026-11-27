/**
 * D2Common outdoor rooms: 1:1 port of DRLGOUTROOM_InitializeDrlgOutdoorRoom from D2MOO
 * source/D2Common/src/Drlg/DrlgOutRoom.cpp (commit 5596f5c, MIT License, Copyright (c) 2020-2025
 * The Phrozen Keep community). The allocation of D2DrlgOutdoorRoomStrc and the level-link callbacks of
 * that file are ported with the outdoor generator (drlg-outdoors.ts / drlg-outplace.ts).
 */

import { DRLGLOGIC_AllocCoordLists } from './drlg-logic.ts'
import {
  DRLGROOMTILE_AllocTileData,
  DRLGROOMTILE_AllocTileGrid,
  DRLGROOMTILE_CountAllTileTypes,
  DRLGROOMTILE_CountWallWarpTiles,
  DRLGROOMTILE_LoadInitRoomTiles,
  tileGridOf,
} from './drlg-roomtile.ts'
import type { D2DrlgRoomStrc } from './drlg-types.ts'

//D2Common.6FD83E20
export function DRLGOUTROOM_InitializeDrlgOutdoorRoom(pDrlgRoom: D2DrlgRoomStrc): void {
  const pOutdoor = pDrlgRoom.pOutdoor
  if (!pOutdoor) throw new Error('DRLGOUTROOM_InitializeDrlgOutdoorRoom: pDrlgRoom->pOutdoor is NULL')

  DRLGROOMTILE_AllocTileGrid(pDrlgRoom)
  DRLGROOMTILE_CountWallWarpTiles(pDrlgRoom, pOutdoor.pWallGrid, pOutdoor.pTileTypeGrid, false, false)
  DRLGROOMTILE_CountAllTileTypes(pDrlgRoom, pOutdoor.pWallGrid, false, false, false)
  DRLGROOMTILE_CountAllTileTypes(pDrlgRoom, pOutdoor.pFloorGrid, false, false, false)
  DRLGROOMTILE_AllocTileData(pDrlgRoom)
  DRLGROOMTILE_LoadInitRoomTiles(pDrlgRoom, pOutdoor.pWallGrid, pOutdoor.pTileTypeGrid, false, false, false)
  DRLGROOMTILE_LoadInitRoomTiles(pDrlgRoom, pOutdoor.pFloorGrid, null, false, false, false)

  const pTileGrid = tileGridOf(pDrlgRoom)
  pTileGrid.pTiles.nWalls = pTileGrid.nWalls
  pTileGrid.pTiles.nFloors = pTileGrid.nFloors
  pTileGrid.pTiles.nRoofs = pTileGrid.nShadows

  DRLGLOGIC_AllocCoordLists(pDrlgRoom)
}
