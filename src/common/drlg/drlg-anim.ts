/**
 * D2Common DRLG animated tiles: 1:1 port of D2MOO source/D2Common/src/Drlg/DrlgDrlgAnim.cpp
 * (commit 5596f5c, MIT License, Copyright (c) 2020-2025 The Phrozen Keep community).
 */

import {
  D2CMP_10079_GetTileFlags,
  D2CMP_10081_GetTileRarity,
  D2CMP_10088_GetTiles,
  type D2TileLibraryEntryStrc,
} from './drlg-d2cmp.ts'
import { DRLGGRID_GetGridEntry } from './drlg-grid.ts'
import {
  DRLGROOMTILE_InitFloorTileData,
  DRLGROOMTILE_InitShadowTileData,
  DRLGROOMTILE_InitWallTileData,
  GetMapTileLayer,
  MAPTILE_HIDDEN,
  PackedTile,
  TILETYPE_FLOOR,
  TILETYPE_SHADOW,
  tileGridOf,
} from './drlg-roomtile.ts'
import {
  DRLGROOMFLAG_ANIMATED_FLOOR,
  type D2DrlgAnimTileGridStrc,
  type D2DrlgGridStrc,
  type D2DrlgRoomStrc,
  type D2DrlgTileDataStrc,
} from './drlg-types.ts'

// D2TileMaterialFlags (D2CMP.h)
const TILE_FLAGS_LAVA = 0x100

//D2Common.0x6FD75560
export function DRLGANIM_TestLoadAnimatedRoomTiles(
  pDrlgRoom: D2DrlgRoomStrc,
  pDrlgGrid: D2DrlgGridStrc,
  pTileTypeGrid: D2DrlgGridStrc | null,
  nTileType: number,
  bKillEdgeX: boolean,
  bKillEdgeY: boolean,
): void {
  const ppTileLibraryEntry: D2TileLibraryEntryStrc[] = []
  const pTiles = tileGridOf(pDrlgRoom).pTiles
  const nMaxY = (pDrlgRoom.pDrlgCoord.nHeight + (bKillEdgeY ? 0 : 1)) | 0
  const nMaxX = (pDrlgRoom.pDrlgCoord.nWidth + (bKillEdgeX ? 0 : 1)) | 0

  for (let nY = 0; nY < nMaxY; nY += 1) {
    for (let nX = 0; nX < nMaxX; nX += 1) {
      const nGridEntry = DRLGGRID_GetGridEntry(pDrlgGrid, nX, nY) >>> 0
      if (PackedTile.bShadow(nGridEntry) || PackedTile.bIsWall(nGridEntry) || PackedTile.bIsFloor(nGridEntry)) {
        if (pTileTypeGrid) {
          nTileType = DRLGGRID_GetGridEntry(pTileTypeGrid, nX, nY)
        }

        const nStyle = PackedTile.nTileStyle(nGridEntry)
        const nSequence = PackedTile.nTileSequence(nGridEntry)

        const nTilesCount = D2CMP_10088_GetTiles(pDrlgRoom.pTiles, nTileType, nStyle, nSequence, ppTileLibraryEntry, 40)
        if (nTilesCount && D2CMP_10079_GetTileFlags(ppTileLibraryEntry[0]!) & TILE_FLAGS_LAVA) {
          if (PackedTile.bIsFloor(nGridEntry)) {
            pTiles.nFloors = (pTiles.nFloors + nTilesCount - 1) | 0
          } else if (PackedTile.bIsWall(nGridEntry)) {
            pTiles.nWalls = (pTiles.nWalls + nTilesCount - 1) | 0
          } else {
            pTiles.nRoofs = (pTiles.nRoofs + nTilesCount - 1) | 0
          }

          pDrlgRoom.dwFlags = (pDrlgRoom.dwFlags | DRLGROOMFLAG_ANIMATED_FLOOR) >>> 0
        }
      }
    }
  }
}

// Helper function
function DRLGANIM_FindAnimatedTileFrame(
  pTileLibraryEntries: D2TileLibraryEntryStrc[],
  nbTileEntries: number,
  nRarity: number,
  nStyle: number,
  nSeq: number,
): D2TileLibraryEntryStrc {
  for (let nEntryIndex = 0; nEntryIndex < nbTileEntries; nEntryIndex += 1) {
    if (D2CMP_10081_GetTileRarity(pTileLibraryEntries[nEntryIndex]!) === nRarity) {
      return pTileLibraryEntries[nEntryIndex]!
    }
  }
  throw new Error(`Animating tiles missing Rarity ${nRarity} Tile - Style ${nStyle} Seq ${nSeq}`)
}

//D2Common.0x6FD75740
export function DRLGANIM_AllocAnimationTileGrids(
  pDrlgRoom: D2DrlgRoomStrc,
  nAnimationSpeed: number,
  pWallGrid: D2DrlgGridStrc[],
  nWalls: number,
  pFloorGrid: D2DrlgGridStrc[],
  nFloors: number,
  pShadowGrid: D2DrlgGridStrc,
): void {
  const pTileGrid = tileGridOf(pDrlgRoom)
  DRLGANIM_AllocAnimationTileGrid(
    pDrlgRoom,
    nAnimationSpeed,
    pTileGrid.pTiles.pWallTiles,
    pTileGrid.nWalls,
    pWallGrid,
    nWalls,
  )
  DRLGANIM_AllocAnimationTileGrid(
    pDrlgRoom,
    nAnimationSpeed,
    pTileGrid.pTiles.pFloorTiles,
    pTileGrid.nFloors,
    pFloorGrid,
    nFloors,
  )
  DRLGANIM_AllocAnimationTileGrid(
    pDrlgRoom,
    nAnimationSpeed,
    pTileGrid.pTiles.pRoofTiles,
    pTileGrid.nShadows,
    [pShadowGrid],
    1,
  )
}

//D2Common.0x6FD757B0
export function DRLGANIM_AllocAnimationTileGrid(
  pDrlgRoom: D2DrlgRoomStrc,
  nAnimationSpeed: number,
  pTiles: D2DrlgTileDataStrc[] | null,
  nTiles: number,
  pDrlgGrid: D2DrlgGridStrc[],
  _nUnused: number,
): void {
  if (!pTiles) {
    return
  }
  if (nAnimationSpeed === 0) {
    nAnimationSpeed = 80
  }

  const pTileGrid = tileGridOf(pDrlgRoom)
  const pTileLibraryEntries: D2TileLibraryEntryStrc[] = []

  for (let i = 0; i < nTiles; i += 1) {
    const pCurrentTileData = pTiles[i]!
    if (pCurrentTileData.pTile && D2CMP_10079_GetTileFlags(pCurrentTileData.pTile) & TILE_FLAGS_LAVA) {
      const nGridIdx = GetMapTileLayer(pCurrentTileData.dwFlags)
      const pLayerGrid = pDrlgGrid[nGridIdx < 0 ? 0 : nGridIdx]!
      const nGridEntry = DRLGGRID_GetGridEntry(pLayerGrid, pCurrentTileData.nPosX, pCurrentTileData.nPosY) >>> 0

      const nStyle = PackedTile.nTileStyle(nGridEntry)
      const nSeq = PackedTile.nTileSequence(nGridEntry)

      const nFrames = D2CMP_10088_GetTiles(
        pDrlgRoom.pTiles,
        pCurrentTileData.nTileType,
        nStyle,
        nSeq,
        pTileLibraryEntries,
        40,
      )

      const ppMapTileData = new Array<D2DrlgTileDataStrc | null>(nFrames).fill(null)
      const pDrlgAnimTileGrid: D2DrlgAnimTileGridStrc = {
        ppMapTileData,
        nFrames,
        nCurrentFrame: 0,
        nAnimationSpeed,
        pNext: pTileGrid.pAnimTiles,
      }

      pTileGrid.pAnimTiles = pDrlgAnimTileGrid

      // Animated tiles use rarity as frame index
      pCurrentTileData.pTile = DRLGANIM_FindAnimatedTileFrame(pTileLibraryEntries, nFrames, 0, nStyle, nSeq)
      pDrlgAnimTileGrid.ppMapTileData[0] = pCurrentTileData

      const nX = (pCurrentTileData.nPosX + pDrlgRoom.pDrlgCoord.nPosX) | 0
      const nY = (pCurrentTileData.nPosY + pDrlgRoom.pDrlgCoord.nPosY) | 0

      for (let nRarity = 1; nRarity < nFrames; nRarity += 1) {
        const pTileEntry = DRLGANIM_FindAnimatedTileFrame(pTileLibraryEntries, nFrames, nRarity, nStyle, nSeq)

        let pAddedTile: D2DrlgTileDataStrc
        if (pCurrentTileData.nTileType === TILETYPE_FLOOR) {
          pAddedTile = DRLGROOMTILE_InitFloorTileData(pDrlgRoom, null, nX, nY, nGridEntry, pTileEntry)
        } else if (pCurrentTileData.nTileType === TILETYPE_SHADOW) {
          pAddedTile = DRLGROOMTILE_InitShadowTileData(pDrlgRoom, null, nX, nY, nGridEntry, pTileEntry)
        } else {
          pAddedTile = DRLGROOMTILE_InitWallTileData(
            pDrlgRoom,
            null,
            nX,
            nY,
            nGridEntry,
            pTileEntry,
            pCurrentTileData.nTileType,
          )
        }
        pDrlgAnimTileGrid.ppMapTileData[nRarity] = pAddedTile
        // We start by displaying the first frame, hide all other frames tiles.
        pAddedTile.dwFlags = (pAddedTile.dwFlags | MAPTILE_HIDDEN) >>> 0
      }
    }
  }
}
