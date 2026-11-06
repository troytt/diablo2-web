/**
 * D2Common DRLG grids: 1:1 port of D2MOO source/D2Common/src/Drlg/DrlgDrlgGrid.cpp (commit 5596f5c,
 * MIT License, Copyright (c) 2020-2025 The Phrozen Keep community).
 *
 * A grid is a view (see drlg-types.ts): cell (x, y) is `pCellsFlags[nCellsBase + x + pCellsRowOffsets[y]]`.
 * C reads outside the backing memory are undefined behaviour; here they throw so a porting error
 * can never be silently absorbed by a JS typed-array out-of-bounds read.
 */

import {
  FLAG_OPERATION_AND,
  FLAG_OPERATION_AND_NEGATED,
  FLAG_OPERATION_OR,
  FLAG_OPERATION_OVERWRITE,
  FLAG_OPERATION_OVERWRITE_IF_ZERO,
  FLAG_OPERATION_XOR,
  type D2DrlgCoordStrc,
  type D2DrlgGridStrc,
  type D2DrlgVertexStrc,
  type FlagOperation,
} from './drlg-types.ts'
import { DRLGROOM_AreXYInsideCoordinates } from './drlg-room.ts'

/** Index of cell (nX, nY) in the backing array, with the bounds checks C does not do. */
export function gridCellIndex(g: D2DrlgGridStrc, nX: number, nY: number): number {
  const cells = g.pCellsFlags
  const rows = g.pCellsRowOffsets
  if (!cells || !rows) throw new Error(`grid access (${nX}, ${nY}) on an unallocated grid`)
  if (nY < 0 || nY >= rows.length) throw new RangeError(`grid row ${nY} outside 0..${rows.length - 1}`)
  const index = g.nCellsBase + nX + rows[nY]!
  if (index < 0 || index >= cells.length) {
    throw new RangeError(`grid cell (${nX}, ${nY}) -> ${index} outside the backing array (${cells.length})`)
  }
  return index
}

// gpfFlagOperations[] (D2Common.0x6FD75BA0..0x6FD75BF0)
function applyFlagOperation(cells: Int32Array, index: number, nFlag: number, eOperation: FlagOperation): void {
  switch (eOperation) {
    case FLAG_OPERATION_OR:
      cells[index] = cells[index]! | nFlag
      return
    case FLAG_OPERATION_AND:
      cells[index] = cells[index]! & nFlag
      return
    case FLAG_OPERATION_XOR:
      cells[index] = cells[index]! ^ nFlag
      return
    case FLAG_OPERATION_OVERWRITE:
      cells[index] = nFlag
      return
    case FLAG_OPERATION_OVERWRITE_IF_ZERO:
      if (cells[index] === 0) cells[index] = nFlag
      return
    case FLAG_OPERATION_AND_NEGATED:
      cells[index] = cells[index]! & ~nFlag
      return
  }
}

//D2Common.0x6FD75C00
export function DRLGGRID_IsGridValid(pDrlgGrid: D2DrlgGridStrc | null): boolean {
  return pDrlgGrid !== null && pDrlgGrid.pCellsFlags !== null
}

//D2Common.0x6FD75C20
export function DRLGGRID_IsPointInsideGridArea(pDrlgGrid: D2DrlgGridStrc, nX: number, nY: number): boolean {
  return nX >= 0 && nX < pDrlgGrid.nWidth && nY >= 0 && nY < pDrlgGrid.nHeight
}

//D2Common.0x6FD75C50
export function DRLGGRID_AlterGridFlag(pDrlgGrid: D2DrlgGridStrc, nX: number, nY: number, nFlag: number, eOperation: FlagOperation): void {
  applyFlagOperation(pDrlgGrid.pCellsFlags!, gridCellIndex(pDrlgGrid, nX, nY), nFlag | 0, eOperation)
}

//D2Common.0x6FD75CA0
export function DRLGGRID_GetGridEntry(pDrlgGrid: D2DrlgGridStrc, nX: number, nY: number): number {
  return pDrlgGrid.pCellsFlags![gridCellIndex(pDrlgGrid, nX, nY)]!
}

//D2Common.0x6FD75CC0
export function DRLGGRID_AlterAllGridFlags(pDrlgGrid: D2DrlgGridStrc, nFlag: number, eOperation: FlagOperation): void {
  for (let nY = 0; nY < pDrlgGrid.nHeight; nY += 1) {
    for (let nX = 0; nX < pDrlgGrid.nWidth; nX += 1) {
      DRLGGRID_AlterGridFlag(pDrlgGrid, nX, nY, nFlag, eOperation)
    }
  }
}

//D2Common.0x6FD75D20
export function DRLGGRID_AlterEdgeGridFlags(pDrlgGrid: D2DrlgGridStrc, nFlag: number, eOperation: FlagOperation): void {
  for (let i = 0; i < pDrlgGrid.nWidth; i += 1) {
    DRLGGRID_AlterGridFlag(pDrlgGrid, i, 0, nFlag, eOperation)
    DRLGGRID_AlterGridFlag(pDrlgGrid, i, pDrlgGrid.nHeight - 1, nFlag, eOperation)
  }
  for (let i = 1; i < pDrlgGrid.nHeight; i += 1) {
    DRLGGRID_AlterGridFlag(pDrlgGrid, 0, i, nFlag, eOperation)
    DRLGGRID_AlterGridFlag(pDrlgGrid, pDrlgGrid.nWidth - 1, i, nFlag, eOperation)
  }
}

//D2Common.6FD75DE0
export function sub_6FD75DE0(
  pDrlgGrid: D2DrlgGridStrc,
  pDrlgVertex: D2DrlgVertexStrc,
  nFlag: number,
  eOperation: FlagOperation,
  bAlterNextVertex: boolean,
): void {
  const pNext = pDrlgVertex.pNext!
  if (pDrlgVertex.nPosX === pNext.nPosX && pDrlgVertex.nPosY === pNext.nPosY) {
    DRLGGRID_AlterGridFlag(pDrlgGrid, pDrlgVertex.nPosX, pDrlgVertex.nPosY, nFlag, eOperation)
    return
  }

  let nEndX = 0
  let nEndY = 0
  let nX = 0
  let nY = 0
  if (pDrlgVertex.nPosX === pNext.nPosX) {
    nX = pDrlgVertex.nPosX
    if (pDrlgVertex.nPosY >= pNext.nPosY) {
      nY = pNext.nPosY + 1
      nEndY = pDrlgVertex.nPosY
    } else {
      nY = pDrlgVertex.nPosY + 1
      nEndY = pNext.nPosY
    }
    while (nY !== nEndY) {
      DRLGGRID_AlterGridFlag(pDrlgGrid, nX, nY, nFlag, eOperation)
      nY += 1
    }
  } else {
    nY = pDrlgVertex.nPosY
    if (pDrlgVertex.nPosX >= pNext.nPosX) {
      nEndX = pDrlgVertex.nPosX
      nX = pNext.nPosX + 1
    } else {
      nEndX = pNext.nPosX
      nX = pDrlgVertex.nPosX + 1
    }
    while (nX !== nEndX) {
      DRLGGRID_AlterGridFlag(pDrlgGrid, nX, nY, nFlag, eOperation)
      nX += 1
    }
  }

  DRLGGRID_AlterGridFlag(pDrlgGrid, pDrlgVertex.nPosX, pDrlgVertex.nPosY, nFlag, eOperation)
  if (bAlterNextVertex) {
    DRLGGRID_AlterGridFlag(pDrlgGrid, pNext.nPosX, pNext.nPosY, nFlag, eOperation)
  }
}

//D2Common.0x6FD75F10
export function DRLGGRID_SetVertexGridFlags(pDrlgGrid: D2DrlgGridStrc, pDrlgVertex: D2DrlgVertexStrc | null, nFlag: number): void {
  let pVertex = pDrlgVertex
  while (pVertex) {
    const nX = pVertex.nPosX
    const nY = pVertex.nPosY
    pVertex = pVertex.pNext
    if (nX >= 0 && nX < pDrlgGrid.nWidth && nY >= 0 && nY < pDrlgGrid.nHeight) {
      DRLGGRID_AlterGridFlag(pDrlgGrid, nX, nY, nFlag, FLAG_OPERATION_OR)
    }
  }
}

//D2Common.0x6FD75F60
export function sub_6FD75F60(
  pDrlgGrid: D2DrlgGridStrc,
  pDrlgVertex: D2DrlgVertexStrc,
  pDrlgCoord: D2DrlgCoordStrc,
  nFlag: number,
  eOperation: FlagOperation,
  nSize: number,
): void {
  let nX = pDrlgVertex.nPosX
  let nY = pDrlgVertex.nPosY
  let nXDiff = pDrlgVertex.pNext!.nPosX - nX
  let nYDiff = pDrlgVertex.pNext!.nPosY - nY

  let nXInc = 0
  if (nXDiff >= 0) {
    nXInc = 1
  } else {
    nXDiff = -nXDiff
    nXInc = -1
  }
  let nYInc = 0
  if (nYDiff >= 0) {
    nYInc = 1
  } else {
    nYDiff = -nYDiff
    nYInc = -1
  }

  let nIndexX = nX - pDrlgCoord.nPosX
  let nIndexY = nY - pDrlgCoord.nPosY
  let nCheck = 0
  if (nXDiff >= nYDiff) {
    for (let i = 0; i < nSize; i += 1) {
      if (DRLGROOM_AreXYInsideCoordinates(pDrlgCoord, nX, nY + i)) {
        DRLGGRID_AlterGridFlag(pDrlgGrid, nIndexX, nIndexY + i, nFlag, eOperation)
      }
    }
    for (let j = 0; j < nXDiff; j += 1) {
      nX += nXInc
      nCheck += nYDiff
      if (nCheck > nXDiff) {
        nY += nYInc
        nCheck -= nXDiff
      }
      nIndexX = nX - pDrlgCoord.nPosX
      nIndexY = nY - pDrlgCoord.nPosY
      for (let i = 0; i < nSize; i += 1) {
        if (DRLGROOM_AreXYInsideCoordinates(pDrlgCoord, nX, nY + i)) {
          DRLGGRID_AlterGridFlag(pDrlgGrid, nIndexX, nIndexY + i, nFlag, eOperation)
        }
      }
    }
  } else {
    for (let i = 0; i < nSize; i += 1) {
      if (DRLGROOM_AreXYInsideCoordinates(pDrlgCoord, nX + i, nY)) {
        DRLGGRID_AlterGridFlag(pDrlgGrid, nIndexX + i, nIndexY, nFlag, eOperation)
      }
    }
    for (let j = 0; j < nYDiff; j += 1) {
      nY += nYInc
      nCheck += nXDiff
      if (nCheck > nYDiff) {
        nX += nXInc
        nCheck -= nYDiff
      }
      nIndexX = nX - pDrlgCoord.nPosX
      nIndexY = nY - pDrlgCoord.nPosY
      for (let i = 0; i < nSize; i += 1) {
        if (DRLGROOM_AreXYInsideCoordinates(pDrlgCoord, nX + i, nY)) {
          DRLGGRID_AlterGridFlag(pDrlgGrid, nIndexX + i, nIndexY, nFlag, eOperation)
        }
      }
    }
  }
}

//D2Common.0x6FD76230: one zeroed allocation (row offsets are not part of the cell array here).
export function DRLGGRID_InitializeGridCells(pDrlgGrid: D2DrlgGridStrc, nWidth: number, nHeight: number): void {
  if (nWidth < 0 || nHeight < 0) throw new RangeError(`DRLGGRID_InitializeGridCells(${nWidth}, ${nHeight})`)
  pDrlgGrid.nWidth = nWidth
  pDrlgGrid.nHeight = nHeight
  pDrlgGrid.pCellsRowOffsets = new Int32Array(nHeight)
  pDrlgGrid.pCellsFlags = new Int32Array(nWidth * nHeight)
  pDrlgGrid.nCellsBase = 0
  let nRowOffset = 0
  for (let i = 0; i < nHeight; i += 1) {
    pDrlgGrid.pCellsRowOffsets[i] = nRowOffset
    nRowOffset += nWidth
  }
  pDrlgGrid.unk0x10 = 0
}

//D2Common.0x6FD762B0: the caller owns both buffers; the cells are zeroed.
export function DRLGGRID_FillGrid(
  pDrlgGrid: D2DrlgGridStrc,
  nWidth: number,
  nHeight: number,
  pCellPos: Int32Array,
  nCellPosBase: number,
  pCellRowOffsets: Int32Array,
): void {
  pDrlgGrid.nWidth = nWidth
  pDrlgGrid.nHeight = nHeight
  pDrlgGrid.pCellsFlags = pCellPos
  pDrlgGrid.nCellsBase = nCellPosBase
  if (nCellPosBase < 0 || nCellPosBase + nWidth * nHeight > pCellPos.length) {
    throw new RangeError('DRLGGRID_FillGrid: cell buffer too small')
  }
  pCellPos.fill(0, nCellPosBase, nCellPosBase + nWidth * nHeight)
  pDrlgGrid.pCellsRowOffsets = pCellRowOffsets
  let nRowOffset = 0
  for (let i = 0; i < nHeight; i += 1) {
    pCellRowOffsets[i] = nRowOffset
    nRowOffset += nWidth
  }
  pDrlgGrid.unk0x10 = 0
}

//D2Common.0x6FD76310: a view of the (nPosX, nPosY, nWidth, nHeight) window of a parent array with row stride nWidth.
export function DRLGGRID_FillNewCellFlags(
  pDrlgGrid: D2DrlgGridStrc,
  pCellPos: Int32Array,
  nCellPosBase: number,
  pDrlgCoord: D2DrlgCoordStrc,
  nWidth: number,
): void {
  pDrlgGrid.nWidth = pDrlgCoord.nWidth
  pDrlgGrid.nHeight = pDrlgCoord.nHeight
  pDrlgGrid.pCellsFlags = pCellPos
  pDrlgGrid.nCellsBase = nCellPosBase + pDrlgCoord.nPosX + nWidth * pDrlgCoord.nPosY
  pDrlgGrid.pCellsRowOffsets = new Int32Array(pDrlgCoord.nHeight)
  let nOffset = 0
  for (let i = 0; i < pDrlgCoord.nHeight; i += 1) {
    pDrlgGrid.pCellsRowOffsets[i] = nOffset
    nOffset += nWidth
  }
  pDrlgGrid.unk0x10 = 1
}

//D2Common.0x6FD76380
export function DRLGGRID_AssignCellsOffsetsAndFlags(
  pDrlgGrid: D2DrlgGridStrc,
  pCellPos: Int32Array,
  nCellPosBase: number,
  pDrlgCoord: D2DrlgCoordStrc,
  nWidth: number,
  pCellFlags: Int32Array,
): void {
  pDrlgGrid.nWidth = pDrlgCoord.nWidth
  pDrlgGrid.nHeight = pDrlgCoord.nHeight
  pDrlgGrid.pCellsFlags = pCellPos
  pDrlgGrid.nCellsBase = nCellPosBase + pDrlgCoord.nPosX + nWidth * pDrlgCoord.nPosY
  pDrlgGrid.pCellsRowOffsets = pCellFlags
  for (let i = 0; i < pDrlgCoord.nHeight; i += 1) {
    pCellFlags[i] = i * nWidth
  }
  pDrlgGrid.unk0x10 = 1
}

//D2Common.0x6FD763E0
export function DRLGGRID_FreeGrid(pDrlgGrid: D2DrlgGridStrc): void {
  pDrlgGrid.pCellsFlags = null
  pDrlgGrid.pCellsRowOffsets = null
  pDrlgGrid.nCellsBase = 0
}

//D2Common.0x6FD76410
export function DRLGGRID_ResetGrid(pDrlgGrid: D2DrlgGridStrc): void {
  pDrlgGrid.pCellsFlags = null
  pDrlgGrid.pCellsRowOffsets = null
  pDrlgGrid.nCellsBase = 0
}
