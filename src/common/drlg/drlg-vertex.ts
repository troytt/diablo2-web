/**
 * D2Common DRLG vertices: 1:1 port of D2MOO source/D2Common/src/Drlg/DrlgDrlgVer.cpp (commit
 * 5596f5c, MIT License, Copyright (c) 2020-2025 The Phrozen Keep community).
 */

import { newVertex, type D2DrlgCoordStrc, type D2DrlgOrthStrc, type D2DrlgVertexStrc } from './drlg-types.ts'

//D2Common.0x6FD782A0
export function DRLGVER_AllocVertex(nDirection = 0): D2DrlgVertexStrc {
  return newVertex(nDirection)
}

//D2Common.0x6FD782D0
// Returns the new ring head (C: *ppVertices). pDrlgCoord and every orth box are temporarily
// shrunk by one exactly like the C++ code (the boxes are the neighbours' own coordinates).
export function DRLGVER_CreateVertices(
  pDrlgCoord: D2DrlgCoordStrc,
  nDirection: number,
  pDrlgRoomData: D2DrlgOrthStrc | null,
): D2DrlgVertexStrc {
  pDrlgCoord.nWidth -= 1
  pDrlgCoord.nHeight -= 1

  let pCurrentRoomData = pDrlgRoomData
  while (pCurrentRoomData) {
    pCurrentRoomData.pBox!.nWidth -= 1
    pCurrentRoomData.pBox!.nHeight -= 1
    pCurrentRoomData = pCurrentRoomData.pNext
  }

  const pHead = DRLGVER_AllocVertex(nDirection)
  pHead.nPosX = pDrlgCoord.nPosX
  pHead.nPosY = pDrlgCoord.nHeight + pDrlgCoord.nPosY

  let pNextVertex = DRLGVER_AllocVertex(nDirection)
  pHead.pNext = pNextVertex
  pNextVertex.nPosX = pDrlgCoord.nPosX
  pNextVertex.nPosY = pDrlgCoord.nPosY

  let pLastVertex = DRLGVER_AllocVertex(nDirection)
  pNextVertex.pNext = pLastVertex
  pLastVertex.nPosX = pDrlgCoord.nWidth + pDrlgCoord.nPosX
  pLastVertex.nPosY = pDrlgCoord.nPosY

  let pPreviousVertex = DRLGVER_AllocVertex(nDirection)
  pLastVertex.pNext = pPreviousVertex
  pPreviousVertex.nPosX = pDrlgCoord.nWidth + pDrlgCoord.nPosX
  pPreviousVertex.nPosY = pDrlgCoord.nHeight + pDrlgCoord.nPosY
  pPreviousVertex.pNext = pHead

  const pCurrentVertex = pHead
  pNextVertex = pHead.pNext
  pLastVertex = pNextVertex.pNext!
  pPreviousVertex = pLastVertex.pNext!

  pCurrentRoomData = pDrlgRoomData
  while (pCurrentRoomData) {
    const pCurrentCoords = pCurrentRoomData.pBox ? pCurrentRoomData.pBox : pDrlgCoord
    let pVertex: D2DrlgVertexStrc
    let bDirection: number
    let v15: number
    let v16: number
    let v21: number
    let v23: number
    let nSign: number
    switch (pCurrentRoomData.nDirection) {
      case 0:
        pVertex = pCurrentVertex
        bDirection = 1
        v16 = pCurrentCoords.nPosY + pCurrentCoords.nHeight
        v15 = pCurrentCoords.nPosY
        v21 = pCurrentVertex.nPosY
        v23 = pNextVertex.nPosY
        nSign = -1
        break
      case 1:
        pVertex = pNextVertex
        bDirection = 0
        v16 = pCurrentCoords.nPosX
        v15 = pCurrentCoords.nPosX + pCurrentCoords.nWidth
        v21 = pNextVertex.nPosX
        v23 = pLastVertex.nPosX
        nSign = 1
        break
      case 2:
        pVertex = pLastVertex
        bDirection = 1
        v16 = pCurrentCoords.nPosY
        v15 = pCurrentCoords.nPosY + pCurrentCoords.nHeight
        v21 = pLastVertex.nPosY
        v23 = pPreviousVertex.nPosY
        nSign = 1
        break
      case 3:
        pVertex = pPreviousVertex
        bDirection = 0
        v16 = pCurrentCoords.nPosX + pCurrentCoords.nWidth
        v15 = pCurrentCoords.nPosX
        v21 = pVertex.nPosX
        v23 = pCurrentVertex.nPosX
        nSign = -1
        break
      default:
        // FOG_DisplayWarning("FALSE") then exit(-1)
        throw new Error(`DRLGVER_CreateVertices: invalid orth direction ${pCurrentRoomData.nDirection}`)
    }

    if (nSign * v16 > nSign * v21) {
      if (nSign * v16 <= nSign * v23) {
        let pNewVertex = DRLGVER_AllocVertex(nDirection)
        if (bDirection) {
          pNewVertex.nPosY = v16
          pNewVertex.nPosX = pVertex.nPosX
        } else {
          pNewVertex.nPosX = v16
          pNewVertex.nPosY = pVertex.nPosY
        }
        pNewVertex.pNext = pVertex.pNext
        pVertex.pNext = pNewVertex
        pVertex = pNewVertex

        pVertex.dwFlags |= 1
        if (pCurrentRoomData.bPreset) pVertex.dwFlags |= 2

        if (nSign * v15 < nSign * v23) {
          pNewVertex = DRLGVER_AllocVertex(nDirection)
          if (bDirection) {
            pNewVertex.nPosY = v15
            pNewVertex.nPosX = pVertex.nPosX
          } else {
            pNewVertex.nPosX = v15
            pNewVertex.nPosY = pVertex.nPosY
          }
          pNewVertex.pNext = pVertex.pNext
          pVertex.pNext = pNewVertex
        }
      }
    } else if (nSign * v15 >= nSign * v21) {
      pVertex.dwFlags |= 1
      if (pCurrentRoomData.bPreset) pVertex.dwFlags |= 2

      if (nSign * v15 < nSign * v23) {
        const pNewVertex = DRLGVER_AllocVertex(nDirection)
        if (bDirection) {
          pNewVertex.nPosY = v15
          pNewVertex.nPosX = pVertex.nPosX
        } else {
          pNewVertex.nPosX = v15
          pNewVertex.nPosY = pVertex.nPosY
        }
        pNewVertex.pNext = pVertex.pNext
        pVertex.pNext = pNewVertex
      }
    }

    pCurrentRoomData = pCurrentRoomData.pNext
  }

  let p: D2DrlgVertexStrc = pHead
  do {
    p.nPosX -= pDrlgCoord.nPosX
    p.nPosY -= pDrlgCoord.nPosY
    p = p.pNext!
  } while (p !== pHead)

  pDrlgCoord.nWidth += 1
  pDrlgCoord.nHeight += 1

  pCurrentRoomData = pDrlgRoomData
  while (pCurrentRoomData) {
    pCurrentRoomData.pBox!.nWidth += 1
    pCurrentRoomData.pBox!.nHeight += 1
    pCurrentRoomData = pCurrentRoomData.pNext
  }
  return pHead
}

//D2Common.0x6FD78730
export function DRLGVER_GetCoordDiff(pDrlgVertex: D2DrlgVertexStrc): { nDiffX: number; nDiffY: number } {
  let nDiffX = pDrlgVertex.pNext!.nPosX - pDrlgVertex.nPosX
  let nDiffY = pDrlgVertex.pNext!.nPosY - pDrlgVertex.nPosY
  if (nDiffX >= 0) {
    if (nDiffX > 0) nDiffX = 1
  } else {
    nDiffX = -1
  }
  if (nDiffY >= 0) {
    if (nDiffY > 0) nDiffY = 1
  } else {
    nDiffY = -1
  }
  return { nDiffX, nDiffY }
}
