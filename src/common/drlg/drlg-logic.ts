/**
 * D2Common DRLG logical rooms: 1:1 port of the parts of D2MOO source/D2Common/src/Drlg/DrlgDrlgLogic.cpp
 * (commit 5596f5c, MIT License, Copyright (c) 2020-2025 The Phrozen Keep community) reached by
 * DRLGROOMTILE_AddRoomMapTiles: DRLGOUTROOM_InitializeDrlgOutdoorRoom and DRLGPRESET_AddPresetRoomMapTiles
 * end with DRLGLOGIC_AllocCoordLists or (LvlPrest.txt `Logicals`) DRLGLOGIC_InitializeDrlgCoordList.
 *
 * Pointers in int cells: DRLGLOGIC_AssignCoordListsForGrids writes `(int)pRoomCoordList` into the pIndexY
 * cells and DRLGLOGIC_SetCoordListForTiles copies such a cell into D2DrlgTileDataStrc::unk0x10. Int32Array
 * cells cannot hold objects, so a pIndexY cell holds a 1-based handle into
 * `pLogicalRoomInfo.ppCoordListHandles` (0 = NULL), and the tile's unk0x10 receives the object itself.
 */

import { DRLGGRID_AlterGridFlag, DRLGGRID_FillGrid, DRLGGRID_GetGridEntry, DRLGGRID_InitializeGridCells, DRLGGRID_IsGridValid, DRLGGRID_ResetGrid } from './drlg-grid.ts'
import { DRLG_CheckNotOverlappingUsingManhattanDistance, DRLGROOM_AreXYInsideCoordinatesOrOnBorder } from './drlg-room.ts'
import {
  GetMapTileLayer,
  HasMapTileLayer,
  MAPTILE_OBJECT_WALL,
  MAPTILE_TREES,
  PackedTile,
  TILETYPE_ROOF,
  tileAt,
  tileGridOf,
} from './drlg-roomtile.ts'
import {
  FLAG_OPERATION_OR,
  FLAG_OPERATION_OVERWRITE,
  newCoord,
  newGrid,
  type D2DrlgGridStrc,
  type D2DrlgLogicalRoomInfoStrc,
  type D2DrlgRoomStrc,
  type D2DrlgTileDataStrc,
  type D2RoomCoordListStrc,
} from './drlg-types.ts'

// D2DrlgLogicalRoomInfoFlags (D2DrlgDrlgLogic.h)
export const DRLGLOGIC_ROOMINFO_HAS_COORD_LIST = 0x1
export const DRLGLOGIC_ROOMINFO_HAS_GRID_CELLS = 0x2

/** D2UnkDrlgLogicStrc (D2DrlgDrlgLogic.h) */
interface D2UnkDrlgLogicStrc {
  pDrlgRoom: D2DrlgRoomStrc
  field_4: D2DrlgGridStrc
  pTileTypeGrid: D2DrlgGridStrc
  pWallGrid: D2DrlgGridStrc
  pFloorGrid: D2DrlgGridStrc
  field_14: D2DrlgGridStrc
  field_18: number
  nFlags: number
}

/** A zeroed D2RoomCoordListStrc (D2_CALLOC_STRC_POOL / an element of a D2_CALLOC_POOL block). */
function newRoomCoordList(): D2RoomCoordListStrc {
  return { pBox: [newCoord(0, 0, 0, 0), newCoord(0, 0, 0, 0)], bNode: 0, bRoomActive: 0, nIndex: 0, pNext: null }
}

/** A zeroed D2DrlgLogicalRoomInfoStrc (D2_CALLOC_STRC_POOL). */
function newLogicalRoomInfo(): D2DrlgLogicalRoomInfoStrc {
  return { dwFlags: 0, nLists: 0, pIndexX: newGrid(), pIndexY: newGrid(), pCoordList: null, ppCoordListHandles: [] }
}

/** `(D2RoomCoordListStrc*)nCell` for a pIndexY cell of pLogicalRoomInfo. */
function coordListFromCell(pLogicalRoomInfo: D2DrlgLogicalRoomInfoStrc, nCell: number): D2RoomCoordListStrc | null {
  if (nCell === 0) return null
  const pRoomCoordList = nCell > 0 ? pLogicalRoomInfo.ppCoordListHandles[nCell - 1] : undefined
  if (!pRoomCoordList) throw new Error(`pIndexY cell ${nCell} is not a D2RoomCoordListStrc* (wild pointer)`)
  return pRoomCoordList
}

/** C would loop forever on a cyclic tile chain; the port refuses instead. */
function chainStep(n: number): number {
  if (n > 1 << 22) throw new Error('DRLGLOGIC: tile chain does not terminate (C would loop forever)')
  return n + 1
}

//D2Common.0x6FD764A0
export function DRLGLOGIC_InitializeDrlgCoordList(
  pDrlgRoom: D2DrlgRoomStrc,
  pTileTypeGrid: D2DrlgGridStrc,
  pFloorGrid: D2DrlgGridStrc,
  pWallGrid: D2DrlgGridStrc,
): void {
  const nCellPositions = new Int32Array(1024)
  const nCellFlags = new Int32Array(256)

  const pDrlgCoordList = newLogicalRoomInfo()
  pDrlgRoom.pLogicalRoomInfo = pDrlgCoordList

  let pDrlgRoomTiles = tileGridOf(pDrlgRoom).pTiles
  for (let i = 0; i < pDrlgRoomTiles.nWalls; i += 1) {
    const pWallTileData = tileAt(pDrlgRoomTiles.pWallTiles, i, 'DRLGLOGIC_InitializeDrlgCoordList')

    if (pWallTileData.dwFlags & MAPTILE_TREES && !HasMapTileLayer(pWallTileData.dwFlags)) {
      DRLGGRID_AlterGridFlag(pWallGrid, pWallTileData.nPosX, pWallTileData.nPosY, 8, FLAG_OPERATION_OR)
    }
  }

  pDrlgCoordList.dwFlags |= DRLGLOGIC_ROOMINFO_HAS_GRID_CELLS

  DRLGGRID_InitializeGridCells(pDrlgCoordList.pIndexX, (pDrlgRoom.pDrlgCoord.nWidth + 1) | 0, (pDrlgRoom.pDrlgCoord.nHeight + 1) | 0)

  if (!pDrlgRoom.pLevel.nCoordLists) {
    pDrlgRoom.pLevel.nCoordLists = 1
  }

  const nLists = pDrlgRoom.pLevel.nCoordLists

  const pDrlgGrid = newGrid()
  DRLGGRID_FillGrid(pDrlgGrid, (pDrlgRoom.pDrlgCoord.nWidth + 1) | 0, (pDrlgRoom.pDrlgCoord.nHeight + 1) | 0, nCellPositions, 0, nCellFlags)

  pDrlgRoomTiles = tileGridOf(pDrlgRoom).pTiles
  for (let i = 0; i < pDrlgRoomTiles.nWalls; i += 1) {
    const pWallTileData = tileAt(pDrlgRoomTiles.pWallTiles, i, 'DRLGLOGIC_InitializeDrlgCoordList')
    if (
      GetMapTileLayer(pWallTileData.dwFlags) === 1 &&
      pWallTileData.nTileType !== TILETYPE_ROOF &&
      !(pWallTileData.dwFlags & MAPTILE_OBJECT_WALL)
    ) {
      DRLGGRID_AlterGridFlag(pDrlgGrid, pWallTileData.nPosX, pWallTileData.nPosY, 1, FLAG_OPERATION_OR)
    }
  }

  for (let i = 0; i < pDrlgRoom.nRoomsNear; i += 1) {
    const pDrlgRoomNear = pDrlgRoom.ppRoomsNear[i]!
    if (pDrlgRoomNear !== pDrlgRoom && pDrlgRoomNear.pTileGrid) {
      let nLinks = 0
      for (let pDrlgTileLink = pDrlgRoomNear.pTileGrid.pMapLinks; pDrlgTileLink; pDrlgTileLink = pDrlgTileLink.pNext) {
        nLinks = chainStep(nLinks)
        if (!pDrlgTileLink.bFloor) {
          let nTiles = 0
          for (let pDrlgTileData: D2DrlgTileDataStrc | null = pDrlgTileLink.pMapTile; pDrlgTileData; pDrlgTileData = pDrlgTileData.unk0x20) {
            nTiles = chainStep(nTiles)
            if (DRLG_CheckLayer1ButNotWallObject(pDrlgTileData)) {
              const nX = (pDrlgRoomNear.pDrlgCoord.nPosX + pDrlgTileData.nPosX) | 0
              const nY = (pDrlgRoomNear.pDrlgCoord.nPosY + pDrlgTileData.nPosY) | 0
              if (DRLGROOM_AreXYInsideCoordinatesOrOnBorder(pDrlgRoom.pDrlgCoord, nX, nY)) {
                DRLGGRID_AlterGridFlag(
                  pDrlgGrid,
                  (nX - pDrlgRoom.pDrlgCoord.nPosX) | 0,
                  (nY - pDrlgRoom.pDrlgCoord.nPosY) | 0,
                  1,
                  FLAG_OPERATION_OR,
                )
              }
            }
          }
        }
      }
    }
  }

  const tDRLGLogicUnkStrc: D2UnkDrlgLogicStrc = {
    pDrlgRoom,
    field_4: pDrlgCoordList.pIndexX,
    pTileTypeGrid,
    pWallGrid,
    pFloorGrid,
    field_14: pDrlgGrid,
    field_18: nLists,
    nFlags: 0,
  }

  for (let j = 0; j <= pDrlgRoom.pDrlgCoord.nHeight; j += 1) {
    for (let i = 0; i <= pDrlgRoom.pDrlgCoord.nWidth; i += 1) {
      if (!(DRLGGRID_GetGridEntry(tDRLGLogicUnkStrc.field_4, i, j) & 0x10000000)) {
        tDRLGLogicUnkStrc.field_18 = (tDRLGLogicUnkStrc.field_18 + 1) | 0
        tDRLGLogicUnkStrc.nFlags = (tDRLGLogicUnkStrc.field_18 & 0xfffffff) | 0x10000000

        const nFloorPackedInfo = DRLGGRID_GetGridEntry(tDRLGLogicUnkStrc.pFloorGrid, i, j) >>> 0
        if (
          (PackedTile.nTileStyle(nFloorPackedInfo) === 30 && PackedTile.nWallLayer(nFloorPackedInfo) === 0) ||
          PackedTile.bHidden(nFloorPackedInfo)
        ) {
          tDRLGLogicUnkStrc.nFlags |= 0x20000000
        }

        DRLGLOGIC_SetTileGridFlags(tDRLGLogicUnkStrc, i, j, -1)
      }
    }
  }

  DRLGGRID_ResetGrid(pDrlgGrid)

  pDrlgCoordList.nLists = (tDRLGLogicUnkStrc.field_18 - nLists + 1) | 0

  // D2_CALLOC_POOL(sizeof(D2RoomCoordListStrc) * nLists): only element [0] is ever reachable (it ends the
  // chain built by DRLGLOGIC_AssignCoordListsForGrids), so only that element is modelled.
  if (pDrlgCoordList.nLists <= 0) throw new RangeError(`DRLGLOGIC_InitializeDrlgCoordList: nLists = ${pDrlgCoordList.nLists}`)
  pDrlgCoordList.pCoordList = newRoomCoordList()

  pDrlgRoom.pLevel.nCoordLists = (pDrlgRoom.pLevel.nCoordLists + pDrlgCoordList.nLists) | 0

  DRLGLOGIC_AssignCoordListsForGrids(pDrlgRoom, pDrlgCoordList, nLists)
  DRLGLOGIC_SetCoordListForTiles(pDrlgRoom)
  sub_6FD769B0(pDrlgRoom)
}

const stru_6FDCE5C8: readonly { nX: number; nY: number }[] = [
  { nX: 1, nY: 0 },
  { nX: 0, nY: 1 },
  { nX: -1, nY: 0 },
  { nX: 0, nY: -1 },
]

const dword_6FDCE5EC_NEG: readonly number[] = [1, -1, 0, 0, -1]

const dword_6FDCE5EC: readonly number[] = [
  23, 0, 5, 21, 17, 15, 3, 0, 9, 7, 39, 0, 0, 5, 3, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 0,
]

const dword_6FDCE650: readonly number[] = [-1, 0, 1, 2, 2, 0, 1, 3, 0, 1, 0, 1, 4, -1, 4, 0, 0, 0, 0, 0]

//D2Common.0x6FD76830
function DRLGLOGIC_SetTileGridFlags(a1: D2UnkDrlgLogicStrc, nX: number, nY: number, a4: number): void {
  let nPosX = nX
  let nPosY = nY

  while (
    DRLGROOM_AreXYInsideCoordinatesOrOnBorder(
      a1.pDrlgRoom.pDrlgCoord,
      (nPosX + a1.pDrlgRoom.pDrlgCoord.nPosX) | 0,
      (nPosY + a1.pDrlgRoom.pDrlgCoord.nPosY) | 0,
    )
  ) {
    if (DRLGGRID_GetGridEntry(a1.field_4, nPosX, nPosY) & 0x10000000) {
      return
    }

    if (!DRLGGRID_GetGridEntry(a1.field_14, nPosX, nPosY)) {
      DRLGGRID_AlterGridFlag(a1.field_4, nPosX, nPosY, a1.nFlags, FLAG_OPERATION_OR)

      for (let i = 0; i < 4; i += 1) {
        DRLGLOGIC_SetTileGridFlags(a1, (nPosX + stru_6FDCE5C8[i]!.nX) | 0, (nPosY + stru_6FDCE5C8[i]!.nY) | 0, i)
      }
      return
    }

    let nIndex = 0
    if (DRLGGRID_IsGridValid(a1.pTileTypeGrid)) {
      nIndex = DRLGGRID_GetGridEntry(a1.pTileTypeGrid, nPosX, nPosY)
    }

    // dword_6FDCE650 maps tile types 0 and 13 to row -1 (nFlagIndex = a4 - 4 in -5..-1), which in
    // DrlgDrlgLogic.cpp reads the trailing 5 ints of stru_6FDCE5C8 immediately preceding dword_6FDCE5EC.
    const nRow = nIndex >= 0 && nIndex < dword_6FDCE650.length ? dword_6FDCE650[nIndex]! : undefined
    const nFlagIndex = nRow === undefined ? -99 : (a4 + 5 * nRow + 1) | 0
    if (nRow === undefined || nFlagIndex < -5 || nFlagIndex >= dword_6FDCE5EC.length) {
      throw new RangeError(
        `DRLGLOGIC_SetTileGridFlags: out-of-bounds table read (tile type ${nIndex}, a4 ${a4}) at room tile (${nPosX}, ${nPosY})`,
      )
    }
    const nFlags = nFlagIndex < 0 ? dword_6FDCE5EC_NEG[nFlagIndex + 5]! : dword_6FDCE5EC[nFlagIndex]!
    if (nFlags & 1) {
      DRLGGRID_AlterGridFlag(a1.field_4, nPosX, nPosY, a1.nFlags, FLAG_OPERATION_OR)
    }

    if (nFlags & 2 && a4 !== 2) {
      DRLGLOGIC_SetTileGridFlags(a1, (nPosX + 1) | 0, nPosY, 0)
    }

    if (nFlags & 4 && a4 !== 3) {
      DRLGLOGIC_SetTileGridFlags(a1, nPosX, (nPosY + 1) | 0, 1)
    }

    if (nFlags & 8 && a4 !== 0) {
      DRLGLOGIC_SetTileGridFlags(a1, (nPosX - 1) | 0, nPosY, 2)
    }

    if (nFlags & 16 && a4 !== 1) {
      DRLGLOGIC_SetTileGridFlags(a1, nPosX, (nPosY - 1) | 0, 3)
    }

    if (!(nFlags & 32)) {
      return
    }

    nPosY = (nPosY + 1) | 0
    nPosX = (nPosX + 1) | 0

    a4 = -1
  }
}

//D2Common.0x6FD769B0
function sub_6FD769B0(pDrlgRoom: D2DrlgRoomStrc): void {
  for (let i = 0; i < pDrlgRoom.nRoomsNear; i += 1) {
    const pCurrentRoomEx = pDrlgRoom.ppRoomsNear[i]!
    if (pCurrentRoomEx !== pDrlgRoom) {
      if (pCurrentRoomEx.pLogicalRoomInfo) {
        if (!DRLG_CheckNotOverlappingUsingManhattanDistance(pDrlgRoom.pDrlgCoord, pCurrentRoomEx.pDrlgCoord, 1)) {
          for (let j = pDrlgRoom.pDrlgCoord.nPosX; j <= pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth; j += 1) {
            sub_6FD76A90(pDrlgRoom, pCurrentRoomEx, j, pDrlgRoom.pDrlgCoord.nPosY)
            sub_6FD76A90(pDrlgRoom, pCurrentRoomEx, j, (pDrlgRoom.pDrlgCoord.nHeight + pDrlgRoom.pDrlgCoord.nPosY) | 0)
          }

          for (let j = pDrlgRoom.pDrlgCoord.nPosY; j <= pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight; j += 1) {
            sub_6FD76A90(pDrlgRoom, pCurrentRoomEx, pDrlgRoom.pDrlgCoord.nPosX, j)
            sub_6FD76A90(pDrlgRoom, pCurrentRoomEx, (pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth) | 0, j)
          }
        }
      }
    }
  }
}

//D2Common.0x6FD76A90
function sub_6FD76A90(pDrlgRoom1: D2DrlgRoomStrc, pDrlgRoom2: D2DrlgRoomStrc, nX: number, nY: number): void {
  if (DRLGROOM_AreXYInsideCoordinatesOrOnBorder(pDrlgRoom2.pDrlgCoord, nX, nY)) {
    const pRoomCoordList1 = sub_6FD77110(pDrlgRoom1, Math.imul(nX, 5), Math.imul(nY, 5))
    const pRoomCoordList2 = sub_6FD77110(pDrlgRoom2, Math.imul(nX, 5), Math.imul(nY, 5))
    if (!pRoomCoordList1 || !pRoomCoordList2) throw new Error('sub_6FD76A90: NULL D2RoomCoordListStrc dereference')

    const nIndex1 = pRoomCoordList1.nIndex
    const nIndex2 = pRoomCoordList2.nIndex

    if (nIndex2 && nIndex1) {
      if (
        pDrlgRoom2.pLevel.nLevelId === pDrlgRoom1.pLevel.nLevelId &&
        nIndex2 !== nIndex1 &&
        pRoomCoordList2.bNode === pRoomCoordList1.bNode
      ) {
        sub_6FD76B90(pDrlgRoom1, nIndex1, nIndex2, pRoomCoordList2.bNode)
      }
    }
  }
}

//D2Common.0x6FD76B90
function sub_6FD76B90(pDrlgRoom: D2DrlgRoomStrc, nIndex1: number, nIndex2: number, bNode: number): void {
  if (pDrlgRoom.pLogicalRoomInfo === null || pDrlgRoom.pLogicalRoomInfo.dwFlags & DRLGLOGIC_ROOMINFO_HAS_COORD_LIST) {
    return
  }

  let pRoomCoordList = pDrlgRoom.pLogicalRoomInfo.pCoordList
  if (pRoomCoordList) {
    let bContinue = false
    let nSteps = 0
    do {
      nSteps = chainStep(nSteps)
      if (pRoomCoordList.nIndex === nIndex1) {
        bContinue = true
        pRoomCoordList.nIndex = nIndex2
      }
      pRoomCoordList = pRoomCoordList.pNext
    } while (pRoomCoordList)

    if (bContinue) {
      for (let i = 0; i < pDrlgRoom.nRoomsNear; i += 1) {
        const pRoomNear = pDrlgRoom.ppRoomsNear[i]!
        if (pRoomNear !== pDrlgRoom && pRoomNear.pLevel.nLevelId === pDrlgRoom.pLevel.nLevelId) {
          sub_6FD76B90(pRoomNear, nIndex1, nIndex2, bNode)
        }
      }
    }
  }
}

//D2Common.0x6FD76C20
export function DRLG_CheckLayer1ButNotWallObject(pTileData: D2DrlgTileDataStrc): boolean {
  if (GetMapTileLayer(pTileData.dwFlags) === 1) {
    if (pTileData.nTileType !== TILETYPE_ROOF) {
      return (pTileData.dwFlags & MAPTILE_OBJECT_WALL) === 0
    }
  }

  return false
}

//D2Common.0x6FD76C50
function DRLGLOGIC_SetCoordListForTiles(pDrlgRoom: D2DrlgRoomStrc): void {
  const pTiles = tileGridOf(pDrlgRoom).pTiles
  if (pTiles.nWalls) {
    for (let i = 0; i < pTiles.nWalls; i += 1) {
      const pWallTileData = tileAt(pTiles.pWallTiles, i, 'DRLGLOGIC_SetCoordListForTiles')
      const pLogicalRoomInfo = pDrlgRoom.pLogicalRoomInfo
      if (pLogicalRoomInfo && !(pLogicalRoomInfo.dwFlags & DRLGLOGIC_ROOMINFO_HAS_COORD_LIST)) {
        pWallTileData.unk0x10 =
          coordListFromCell(
            pLogicalRoomInfo,
            DRLGGRID_GetGridEntry(pLogicalRoomInfo.pIndexY, pWallTileData.nPosX, pWallTileData.nPosY),
          ) ?? 0
      } else {
        pWallTileData.unk0x10 = 0
      }
    }
  }
}

//D2Common.0x6FD76CF0
function DRLGLOGIC_AssignCoordListsForGrids(
  pDrlgRoom: D2DrlgRoomStrc,
  pDrlgCoordList: D2DrlgLogicalRoomInfoStrc,
  _nLists: number,
): void {
  DRLGGRID_InitializeGridCells(pDrlgCoordList.pIndexY, (pDrlgRoom.pDrlgCoord.nWidth + 1) | 0, (pDrlgRoom.pDrlgCoord.nHeight + 1) | 0)
  const nWidth = (pDrlgRoom.pDrlgCoord.nWidth + 1) | 0
  const nHeight = (pDrlgRoom.pDrlgCoord.nHeight + 1) | 0

  for (let nY = 0; nY < nHeight; nY += 1) {
    for (let nX = 0; nX < nWidth; nX += 1) {
      const nFlags = DRLGGRID_GetGridEntry(pDrlgCoordList.pIndexX, nX, nY)
      const nIndex = nFlags & 0xfffffff

      if (!DRLGGRID_GetGridEntry(pDrlgCoordList.pIndexY, nX, nY)) {
        const pRoomCoordList = newRoomCoordList()
        const hRoomCoordList = pDrlgCoordList.ppCoordListHandles.push(pRoomCoordList)

        pRoomCoordList.nIndex = nIndex
        pRoomCoordList.bNode = (nFlags & 0x20000000) === 0x20000000 ? 1 : 0
        pRoomCoordList.pNext = pDrlgCoordList.pCoordList

        pDrlgCoordList.pCoordList = pRoomCoordList

        const pBox0 = pRoomCoordList.pBox[0]
        const pBox1 = pRoomCoordList.pBox[1]
        pBox0.nPosX = nX
        pBox0.nPosY = nY
        let nTmpWidth: number
        for (nTmpWidth = nX; nTmpWidth < nWidth; nTmpWidth += 1) {
          if (nIndex !== (DRLGGRID_GetGridEntry(pDrlgCoordList.pIndexX, nTmpWidth, nY) & 0xfffffff)) {
            break
          }

          if (DRLGGRID_GetGridEntry(pDrlgCoordList.pIndexY, nTmpWidth, nY)) {
            break
          }
        }
        pBox0.nWidth = nTmpWidth

        let bBreak = false
        let nTmpHeight: number
        for (nTmpHeight = nY; nTmpHeight < nHeight; nTmpHeight += 1) {
          for (let i = nX; i < pBox0.nWidth; i += 1) {
            if (
              nIndex !== (DRLGGRID_GetGridEntry(pDrlgCoordList.pIndexX, i, nTmpHeight) & 0xfffffff) ||
              DRLGGRID_GetGridEntry(pDrlgCoordList.pIndexY, i, nTmpHeight)
            ) {
              bBreak = true
              break
            }
          }

          if (bBreak) {
            break
          }
        }
        pBox0.nHeight = nTmpHeight

        for (let j = pBox0.nPosY; j < pBox0.nHeight; j += 1) {
          for (let i = pBox0.nPosX; i < pBox0.nWidth; i += 1) {
            DRLGGRID_AlterGridFlag(pDrlgCoordList.pIndexY, i, j, hRoomCoordList, FLAG_OPERATION_OVERWRITE)
          }
        }

        pBox0.nPosY = (pBox0.nPosY + pDrlgRoom.pDrlgCoord.nPosY) | 0
        pBox0.nHeight = (pBox0.nHeight + pDrlgRoom.pDrlgCoord.nPosY) | 0
        pBox0.nPosX = (pBox0.nPosX + pDrlgRoom.pDrlgCoord.nPosX) | 0
        pBox0.nWidth = (pBox0.nWidth + pDrlgRoom.pDrlgCoord.nPosX) | 0

        pBox1.nPosX = pBox0.nPosX
        pBox1.nPosY = pBox0.nPosY
        pBox1.nWidth = pBox0.nWidth
        pBox1.nHeight = pBox0.nHeight

        nTmpWidth = (pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth) | 0
        if (pBox1.nWidth >= nTmpWidth) {
          pBox1.nWidth = nTmpWidth
        }

        nTmpHeight = (pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight) | 0
        if (pBox1.nHeight >= nTmpHeight) {
          pBox1.nHeight = nTmpHeight
        }

        if (pBox1.nPosX >= nTmpWidth || pBox1.nPosY >= nTmpHeight) {
          pBox1.nPosX = 0
          pBox1.nPosY = 0
          pBox1.nWidth = 0
          pBox1.nHeight = 0
        }
      }
    }
  }
}

//D2Common.0x6FD76F90
export function DRLGLOGIC_AllocCoordLists(pDrlgRoom: D2DrlgRoomStrc): void {
  const pLogicalRoomInfo = newLogicalRoomInfo()
  pDrlgRoom.pLogicalRoomInfo = pLogicalRoomInfo

  pLogicalRoomInfo.dwFlags |= DRLGLOGIC_ROOMINFO_HAS_COORD_LIST
  pDrlgRoom.pLevel.nCoordLists = 1
  pLogicalRoomInfo.nLists = 1

  const pCoordList = newRoomCoordList()
  pLogicalRoomInfo.pCoordList = pCoordList

  pCoordList.nIndex = pDrlgRoom.pLevel.nCoordLists
  pCoordList.pBox[0].nPosY = pDrlgRoom.pDrlgCoord.nPosY
  pCoordList.pBox[0].nHeight = (pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight) | 0
  pCoordList.pBox[0].nPosX = pDrlgRoom.pDrlgCoord.nPosX
  pCoordList.pBox[0].nWidth = (pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth) | 0
  pCoordList.pBox[1].nPosY = pDrlgRoom.pDrlgCoord.nPosY
  pCoordList.pBox[1].nHeight = (pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight) | 0
  pCoordList.pBox[1].nPosX = pDrlgRoom.pDrlgCoord.nPosX
  pCoordList.pBox[1].nWidth = (pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth) | 0
}

//D2Common.0x6FD77110
export function sub_6FD77110(pDrlgRoom: D2DrlgRoomStrc, nX: number, nY: number): D2RoomCoordListStrc | null {
  const pLogicalRoomInfo = pDrlgRoom.pLogicalRoomInfo
  if (!pLogicalRoomInfo) throw new Error('D2_ASSERT(pDrlgRoom->pLogicalRoomInfo) (sub_6FD77110)')

  if (pLogicalRoomInfo.dwFlags & DRLGLOGIC_ROOMINFO_HAS_COORD_LIST) {
    return pLogicalRoomInfo.pCoordList
  } else {
    return coordListFromCell(
      pLogicalRoomInfo,
      DRLGGRID_GetGridEntry(
        pLogicalRoomInfo.pIndexY,
        ((nX / 5) | 0) - pDrlgRoom.pDrlgCoord.nPosX,
        ((nY / 5) | 0) - pDrlgRoom.pDrlgCoord.nPosY,
      ),
    )
  }
}

//D2Common.0x6FD77190
export function DRLGLOGIC_GetRoomCoordList(pDrlgRoom: D2DrlgRoomStrc): D2RoomCoordListStrc | null {
  if (!pDrlgRoom.pLogicalRoomInfo) throw new Error('D2_ASSERT(pDrlgRoom->pLogicalRoomInfo) (DRLGLOGIC_GetRoomCoordList)')
  return pDrlgRoom.pLogicalRoomInfo.pCoordList
}
