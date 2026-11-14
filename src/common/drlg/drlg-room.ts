/**
 * D2Common DRLG room helpers: 1:1 port of the parts of D2MOO
 * source/D2Common/src/Drlg/DrlgDrlgRoom.cpp (commit 5596f5c, MIT License, Copyright (c) 2020-2025
 * The Phrozen Keep community) used by the outdoor generator.
 */

import { newD2Seed, SEED_InitLowSeed, SEED_RollRandomNumber } from '../rng/d2-rng.ts'
import { DRLG_GetLevel, DRLG_InitLevel, DRLG_IsTownLevel } from './drlg-drlg.ts'
import { DATATBLS_GetLevelDefRecord } from './drlg-tables.ts'
import {
  DRLGLEVELFLAG_AUTOMAP_REVEAL,
  DRLGROOMFLAG_AUTOMAP_REVEAL,
  DRLGROOMFLAG_HAS_WARP_0,
  DRLGROOMFLAG_HAS_WARP_MASK,
  DRLGROOMFLAG_POPULATION_ZERO,
  DRLGTYPE_MAZE,
  DRLGTYPE_PRESET,
  newCoord,
  newOrth,
  newOutdoorRoom,
  newPresetUnit,
  type D2DrlgCoordStrc,
  type D2DrlgLevelStrc,
  type D2DrlgOrthStrc,
  type D2DrlgRoomStrc,
  type D2DrlgStrc,
  type D2PresetUnitStrc,
  type D2RoomTileStrc,
} from './drlg-types.ts'
import { DRLGPRESET_AllocPresetRoomData } from './drlg-preset.ts'
import { DRLGWARP_GetLvlWarpTxtRecordFromWarpIdAndDirection, DRLGWARP_GetWarpDestinationFromArray } from './drlg-warp.ts'

//D2Common.0x6FD771C0
// fRoomStatus = 4 is not modelled (room status lists only matter to the activation scheduler).
export function DRLGROOM_AllocRoomEx(pLevel: D2DrlgLevelStrc, nType: number): D2DrlgRoomStrc {
  const pDrlgRoom: D2DrlgRoomStrc = {
    pLevel,
    pDrlgCoord: newCoord(),
    dwFlags: 0,
    dwOtherFlags: 0,
    nType,
    pMaze: null,
    pOutdoor: null,
    dwDT1Mask: 0,
    pTiles: [],
    pTileGrid: null,
    nRoomsNear: 0,
    ppRoomsNear: [],
    pRoomTiles: null,
    pPresetUnits: null,
    pDrlgOrth: null,
    pSeed: newD2Seed(),
    dwInitSeed: 0,
    pLogicalRoomInfo: null,
    pRoom: null,
    pDrlgRoomNext: null,
  }

  SEED_InitLowSeed(pDrlgRoom.pSeed, SEED_RollRandomNumber(pLevel.pSeed))
  pDrlgRoom.dwInitSeed = SEED_RollRandomNumber(pDrlgRoom.pSeed) >>> 0

  if (pLevel.dwFlags & DRLGLEVELFLAG_AUTOMAP_REVEAL) {
    pDrlgRoom.dwFlags = (pDrlgRoom.dwFlags | DRLGROOMFLAG_AUTOMAP_REVEAL) >>> 0
  }

  if (nType === DRLGTYPE_MAZE) {
    DRLGOUTROOM_AllocDrlgOutdoorRoom(pDrlgRoom)
  } else if (nType === DRLGTYPE_PRESET) {
    DRLGPRESET_AllocPresetRoomData(pDrlgRoom)
  }
  return pDrlgRoom
}

//D2Common.0x6FD83DE0 (DrlgOutRoom.cpp)
export function DRLGOUTROOM_AllocDrlgOutdoorRoom(pDrlgRoom: D2DrlgRoomStrc): void {
  pDrlgRoom.pOutdoor = newOutdoorRoom()
}

//D2Common.0x6FD780E0
export function DRLGROOM_AllocPresetUnit(
  pDrlgRoom: D2DrlgRoomStrc | null,
  nUnitType: number,
  nIndex: number,
  nMode: number,
  nX: number,
  nY: number,
): D2PresetUnitStrc {
  const pPresetUnit = newPresetUnit()
  pPresetUnit.nUnitType = nUnitType
  pPresetUnit.nMode = nMode
  pPresetUnit.nIndex = nIndex
  pPresetUnit.nYpos = nY
  pPresetUnit.nXpos = nX
  if (pDrlgRoom) {
    pPresetUnit.pNext = pDrlgRoom.pPresetUnits
    pDrlgRoom.pPresetUnits = pPresetUnit
  } else {
    pPresetUnit.pNext = null
  }
  return pPresetUnit
}

//D2Common.0x6FD77600
// C: DRLGROOM_AddOrth(D2DrlgOrthStrc** ppDrlgOrth, ...). Takes *ppDrlgOrth, returns its new value.
export function DRLGROOM_AddOrth(
  pHead: D2DrlgOrthStrc | null,
  pLevel: D2DrlgLevelStrc,
  nDirection: number,
  bIsPreset: boolean,
): D2DrlgOrthStrc {
  const pNew = newOrth()
  pNew.pLevel = pLevel
  pNew.nDirection = nDirection & 0xff
  pNew.bPreset = bIsPreset ? 1 : 0
  pNew.bInit = 0
  pNew.pBox = pLevel.pLevelCoords

  if (!pHead) return pNew

  let pNext = pHead.pNext
  let pPrevious = pHead
  if (pNext) {
    do {
      if (sub_6FD776B0(pNext, pNew)) break
      pPrevious = pNext
      pNext = pNext.pNext
    } while (pNext)
  } else if (sub_6FD776B0(pHead, pNew)) {
    pNew.pNext = pHead
    return pNew
  }
  pNew.pNext = pNext
  pPrevious.pNext = pNew
  return pHead
}

//D2Common.0x6FD776B0
export function sub_6FD776B0(pDrlgOrth1: D2DrlgOrthStrc, pDrlgOrth2: D2DrlgOrthStrc): boolean {
  if (pDrlgOrth1.nDirection <= pDrlgOrth2.nDirection) {
    if (pDrlgOrth1.nDirection === pDrlgOrth2.nDirection) {
      switch (pDrlgOrth2.nDirection) {
        case 0:
          if (pDrlgOrth1.pBox!.nPosY <= pDrlgOrth2.pBox!.nPosY) return false
          break
        case 1:
          if (pDrlgOrth1.pBox!.nPosX >= pDrlgOrth2.pBox!.nPosX) return false
          break
        case 2:
          if (pDrlgOrth1.pBox!.nPosY >= pDrlgOrth2.pBox!.nPosY) return false
          break
        case 3:
          if (pDrlgOrth1.pBox!.nPosX <= pDrlgOrth2.pBox!.nPosX) return false
          break
        default:
          return false
      }
    } else {
      return false
    }
  }
  return true
}

// Helper function (DrlgDrlgRoom.cpp:365)
function DRLG_ComputeManhattanDistance(c1: D2DrlgCoordStrc, c2: D2DrlgCoordStrc): { nX: number; nY: number } {
  const nX = c1.nPosX >= c2.nPosX ? c1.nPosX - c2.nWidth - c2.nPosX : c2.nPosX - c1.nWidth - c1.nPosX
  const nY = c1.nPosY >= c2.nPosY ? c1.nPosY - c2.nHeight - c2.nPosY : c2.nPosY - c1.nHeight - c1.nPosY
  return { nX, nY }
}

//D2Common.0x6FD77740
export function DRLG_GetRectanglesManhattanDistanceAndCheckNotOverlapping(
  c1: D2DrlgCoordStrc,
  c2: D2DrlgCoordStrc,
  nMaxDistance: number,
): { result: boolean; nDistanceX: number; nDistanceY: number } {
  const d = DRLG_ComputeManhattanDistance(c1, c2)
  return { result: d.nX >= nMaxDistance || d.nY >= nMaxDistance, nDistanceX: d.nX, nDistanceY: d.nY }
}

//D2Common.0x6FD777B0
export function DRLG_CheckNotOverlappingUsingManhattanDistance(c1: D2DrlgCoordStrc, c2: D2DrlgCoordStrc, nMaxDistanceToAssumeCollision: number): boolean {
  const d = DRLG_ComputeManhattanDistance(c1, c2)
  return d.nX >= nMaxDistanceToAssumeCollision || d.nY >= nMaxDistanceToAssumeCollision
}

//D2Common.0x6FD77800
export function DRLG_CheckOverlappingWithOrthogonalMargin(c1: D2DrlgCoordStrc, c2: D2DrlgCoordStrc, nOrthogonalDistanceMax: number): boolean {
  const d = DRLG_ComputeManhattanDistance(c1, c2)
  if (nOrthogonalDistanceMax) {
    if (d.nX === 0 && d.nY <= nOrthogonalDistanceMax) return true
    if (d.nY === 0 && d.nX <= nOrthogonalDistanceMax) return true
  } else if (d.nX <= 0 && d.nY <= 0) {
    return true
  }
  return false
}

//D2Common.0x6FD773B0
export function DRLGROOM_FreeRoomEx(pDrlgRoom: D2DrlgRoomStrc): void {
  pDrlgRoom.nRoomsNear = 0
  pDrlgRoom.ppRoomsNear = []
  pDrlgRoom.pOutdoor = null
  pDrlgRoom.pMaze = null
  pDrlgRoom.pPresetUnits = null

  let pNextDrlgOrth: D2DrlgOrthStrc | null = null
  for (let pDrlgOrth = pDrlgRoom.pDrlgOrth; pDrlgOrth; pDrlgOrth = pNextDrlgOrth) {
    pNextDrlgOrth = pDrlgOrth.pNext
    if (pDrlgOrth.bInit === 1) {
      const pCurrentRoomEx = pDrlgOrth.pDrlgRoom!
      let pOrth = pDrlgRoom.pDrlgOrth!
      let pNextOrth = pOrth.pNext

      if (pOrth.bInit === 1 && pOrth.pDrlgRoom === pCurrentRoomEx) {
        pDrlgRoom.pDrlgOrth = pNextOrth
      } else {
        while (pNextOrth) {
          if (pNextOrth.bInit === 1 && pNextOrth.pDrlgRoom === pCurrentRoomEx) {
            pOrth.pNext = pNextOrth.pNext
            break
          }
          pOrth = pNextOrth
          pNextOrth = pNextOrth.pNext
        }
      }

      if (pCurrentRoomEx.pDrlgOrth) {
        pOrth = pCurrentRoomEx.pDrlgOrth
        pNextOrth = pOrth.pNext
        if (pOrth.bInit === 1 && pOrth.pDrlgRoom === pDrlgRoom) {
          pCurrentRoomEx.pDrlgOrth = pNextOrth
        } else {
          while (pNextOrth) {
            if (pNextOrth.bInit === 1 && pNextOrth.pDrlgRoom === pDrlgRoom) {
              pOrth.pNext = pNextOrth.pNext
              break
            }
            pOrth = pNextOrth
            pNextOrth = pNextOrth.pNext
          }
        }
      }
    }
  }

  pDrlgRoom.pDrlgOrth = null

  let pCurrentRoomEx = pDrlgRoom.pLevel.pFirstRoomEx
  if (pCurrentRoomEx === pDrlgRoom) {
    pDrlgRoom.pLevel.pFirstRoomEx = pDrlgRoom.pDrlgRoomNext
    pDrlgRoom.pLevel.nRooms -= 1
  } else if (pCurrentRoomEx) {
    let pNextRoomEx = pCurrentRoomEx.pDrlgRoomNext
    while (pNextRoomEx) {
      if (pNextRoomEx === pDrlgRoom) {
        pCurrentRoomEx.pDrlgRoomNext = pDrlgRoom.pDrlgRoomNext
        pDrlgRoom.pLevel.nRooms -= 1
        break
      }
      pCurrentRoomEx = pNextRoomEx
      pNextRoomEx = pCurrentRoomEx.pDrlgRoomNext
    }
  }
}

//D2Common.0x6FD77520
export function DRLGROOM_AllocDrlgOrthsForRooms(pDrlgRoom1: D2DrlgRoomStrc, pDrlgRoom2: D2DrlgRoomStrc, nDirection: number): void {
  let pDrlgOrth = pDrlgRoom1.pDrlgOrth
  while (pDrlgOrth) {
    if (pDrlgOrth.pDrlgRoom === pDrlgRoom2) break
    pDrlgOrth = pDrlgOrth.pNext
  }

  if (!pDrlgOrth) {
    const pNew = newOrth()
    pNew.pNext = pDrlgRoom1.pDrlgOrth
    pDrlgRoom1.pDrlgOrth = pNew
    pNew.pDrlgRoom = pDrlgRoom2
    pNew.nDirection = nDirection & 0xff
    pNew.bInit = 1
    pNew.pBox = pDrlgRoom2.pDrlgCoord
  }

  pDrlgOrth = pDrlgRoom2.pDrlgOrth
  while (pDrlgOrth) {
    if (pDrlgOrth.pDrlgRoom === pDrlgRoom1) break
    pDrlgOrth = pDrlgOrth.pNext
  }

  if (!pDrlgOrth) {
    const pNew = newOrth()
    pNew.pNext = pDrlgRoom2.pDrlgOrth
    pDrlgRoom2.pDrlgOrth = pNew
    pNew.pDrlgRoom = pDrlgRoom1
    pNew.nDirection = ((nDirection & 0xff) - 2) & 3
    pNew.bInit = 1
    pNew.pBox = pDrlgRoom1.pDrlgCoord
  }
}

//D2Common.0x6FD77890
export function DRLGMAZE_CheckRoomNotOverlaping(
  pLevel: D2DrlgLevelStrc,
  pDrlgRoom1: D2DrlgRoomStrc,
  pIgnoredRoom: D2DrlgRoomStrc | null,
  nMargin: number,
): boolean {
  for (let pCurrentRoomEx = pLevel.pFirstRoomEx; pCurrentRoomEx; pCurrentRoomEx = pCurrentRoomEx.pDrlgRoomNext) {
    if (pCurrentRoomEx !== pDrlgRoom1 && pCurrentRoomEx !== pIgnoredRoom) {
      if (!DRLG_CheckNotOverlappingUsingManhattanDistance(pDrlgRoom1.pDrlgCoord, pCurrentRoomEx.pDrlgCoord, nMargin)) {
        return false
      }
    }
  }
  return true
}

//D2Common.0x6FD77910
export function DRLGROOM_AddRoomExToLevel(pLevel: D2DrlgLevelStrc, pDrlgRoom: D2DrlgRoomStrc): void {
  pDrlgRoom.pDrlgRoomNext = pLevel.pFirstRoomEx
  pLevel.pFirstRoomEx = pDrlgRoom
  pLevel.nRooms += 1
}

//D2Common.0x6FD77930
export function DRLGROOM_AreXYInsideCoordinates(c: D2DrlgCoordStrc, nX: number, nY: number): boolean {
  return nX >= c.nPosX && nY >= c.nPosY && nX < c.nPosX + c.nWidth && nY < c.nPosY + c.nHeight
}

//D2Common.0x6FD77980
export function DRLGROOM_AreXYInsideCoordinatesOrOnBorder(c: D2DrlgCoordStrc, nX: number, nY: number): boolean {
  return nX >= c.nPosX && nY >= c.nPosY && nX <= c.nPosX + c.nWidth && nY <= c.nPosY + c.nHeight
}

//D2Common.0x6FD781E0
export function DRLGROOM_GetVisArrayFromLevelId(pDrlg: D2DrlgStrc, nLevelId: number): readonly number[] {
  for (let pDrlgWarp = pDrlg.pWarp; pDrlgWarp; pDrlgWarp = pDrlgWarp.pNext) {
    if (!pDrlgWarp.nLevel) throw new Error('ptVisInfo->eLevelId != LEVEL_ID_NONE')
    if (nLevelId === pDrlgWarp.nLevel) return pDrlgWarp.nVis
  }
  return DATATBLS_GetLevelDefRecord(pDrlg.env.tables, nLevelId).dwVis
}

//D2Common.0x6FD77EB0
export function DRLGROOM_SortRoomListByPosition(ppRoomList: D2DrlgRoomStrc[], nListSize: number): void {
  for (let j = nListSize - 1; j > 0; j -= 1) {
    for (let i = 0; i < nListSize - 1; i += 1) {
      const pDrlgRoom1 = ppRoomList[i + 1]!
      const pDrlgRoom2 = ppRoomList[i]!
      if (
        pDrlgRoom2.pDrlgCoord.nPosX >= pDrlgRoom1.pDrlgCoord.nPosX + pDrlgRoom1.pDrlgCoord.nWidth ||
        pDrlgRoom2.pDrlgCoord.nPosY >= pDrlgRoom1.pDrlgCoord.nPosY + pDrlgRoom1.pDrlgCoord.nHeight
      ) {
        ppRoomList[i] = pDrlgRoom1
        ppRoomList[i + 1] = pDrlgRoom2
      }
    }
  }
}

//D2Common.0x6FD77F00
export function sub_6FD77F00(
  pDrlgRoom1: D2DrlgRoomStrc,
  nWarpId: number,
  pDrlgRoom2: D2DrlgRoomStrc | null,
  nWarpFlag: number,
  nDirection: number,
): boolean {
  let bResult = false

  while (pDrlgRoom2) {
    if (((1 << (nWarpFlag + 4)) & pDrlgRoom2.dwFlags) !== 0) {
      if (nDirection === -1) {
        let nX = pDrlgRoom1.pDrlgCoord.nPosX - pDrlgRoom2.pDrlgCoord.nWidth - pDrlgRoom2.pDrlgCoord.nPosX
        if (nX < 0) {
          nX = pDrlgRoom2.pDrlgCoord.nPosX - (pDrlgRoom1.pDrlgCoord.nPosX + pDrlgRoom1.pDrlgCoord.nWidth)
        }

        let nY = pDrlgRoom1.pDrlgCoord.nPosY - pDrlgRoom2.pDrlgCoord.nHeight - pDrlgRoom2.pDrlgCoord.nPosY
        if (nY < 0) {
          nY = pDrlgRoom2.pDrlgCoord.nPosY - (pDrlgRoom1.pDrlgCoord.nPosY + pDrlgRoom1.pDrlgCoord.nHeight)
        }

        if (nX < 0) nX = 0
        if (nY < 0) nY = 0

        if (nX < 6 && nY < 6) {
          pDrlgRoom1.ppRoomsNear.push(pDrlgRoom2)
          pDrlgRoom1.nRoomsNear += 1
          DRLGROOM_SortRoomListByPosition(pDrlgRoom1.ppRoomsNear, pDrlgRoom1.nRoomsNear)
          bResult = true
        }
      } else {
        pDrlgRoom1.ppRoomsNear.push(pDrlgRoom2)
        pDrlgRoom1.nRoomsNear += 1
        DRLGROOM_SortRoomListByPosition(pDrlgRoom1.ppRoomsNear, pDrlgRoom1.nRoomsNear)

        // D2_CALLOC_STRC_POOL(D2RoomTileStrc)
        const pRoomTile: D2RoomTileStrc = {
          pDrlgRoom: pDrlgRoom2,
          pLvlWarpTxtRecord: DRLGWARP_GetLvlWarpTxtRecordFromWarpIdAndDirection(pDrlgRoom1.pLevel, nWarpId, 'b'),
          bEnabled: 1,
          unk0x0C: null,
          unk0x10: null,
          pNext: pDrlgRoom1.pRoomTiles,
        }
        pDrlgRoom1.pRoomTiles = pRoomTile

        return true
      }
    }

    pDrlgRoom2 = pDrlgRoom2.pDrlgRoomNext
  }

  return bResult
}

//D2Common.0x6FD77BB0
export function sub_6FD77BB0(pDrlgRoom: D2DrlgRoomStrc): void {
  let bSkip = false

  const pDrlg = pDrlgRoom.pLevel.pDrlg
  let nNearRooms = 0
  for (let pNearRoom = pDrlgRoom.pLevel.pFirstRoomEx; pNearRoom; pNearRoom = pNearRoom.pDrlgRoomNext) {
    let nX = pDrlgRoom.pDrlgCoord.nPosX - pNearRoom.pDrlgCoord.nWidth - pNearRoom.pDrlgCoord.nPosX
    if (nX < 0) {
      nX = pNearRoom.pDrlgCoord.nPosX - (pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth)
    }

    let nY = pDrlgRoom.pDrlgCoord.nPosY - pNearRoom.pDrlgCoord.nHeight - pNearRoom.pDrlgCoord.nPosY
    if (nY < 0) {
      nY = pNearRoom.pDrlgCoord.nPosY - (pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight)
    }

    if (nX < 0) nX = 0
    if (nY < 0) nY = 0

    if (nX < 6 && nY < 6) {
      nNearRooms += 1
    }
  }

  const ppRoomList: D2DrlgRoomStrc[] = []
  let nNearRoomsCounter = 0

  for (let pNearRoom = pDrlgRoom.pLevel.pFirstRoomEx; pNearRoom; pNearRoom = pNearRoom.pDrlgRoomNext) {
    let nX = pDrlgRoom.pDrlgCoord.nPosX - pNearRoom.pDrlgCoord.nWidth - pNearRoom.pDrlgCoord.nPosX
    if (nX < 0) {
      nX = pNearRoom.pDrlgCoord.nPosX - (pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth)
    }

    let nY = pDrlgRoom.pDrlgCoord.nPosY - pNearRoom.pDrlgCoord.nHeight - pNearRoom.pDrlgCoord.nPosY
    if (nY < 0) {
      nY = pNearRoom.pDrlgCoord.nPosY - (pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight)
    }

    if (nX < 0) nX = 0
    if (nY < 0) nY = 0

    if (nX < 6 && nY < 6) {
      ppRoomList[nNearRoomsCounter] = pNearRoom
      nNearRoomsCounter += 1
    }
  }

  DRLGROOM_SortRoomListByPosition(ppRoomList, nNearRooms)

  pDrlgRoom.ppRoomsNear = ppRoomList
  pDrlgRoom.nRoomsNear = nNearRooms

  if (pDrlgRoom.dwFlags & DRLGROOMFLAG_HAS_WARP_MASK) {
    let nFlags = DRLGROOMFLAG_HAS_WARP_0
    let nWarpId = 0

    do {
      if (nFlags & pDrlgRoom.dwFlags && pDrlgRoom.pLevel.nLevelId !== 133) {
        const pSourceVisArray = DRLGROOM_GetVisArrayFromLevelId(pDrlg, pDrlgRoom.pLevel.nLevelId)
        const pLevel = DRLG_GetLevel(pDrlg, pSourceVisArray[nWarpId]!)
        const pDestinationVisArray = DRLGROOM_GetVisArrayFromLevelId(pDrlg, pSourceVisArray[nWarpId]!)
        const nWarpDestination = DRLGWARP_GetWarpDestinationFromArray(pDrlgRoom.pLevel, nWarpId)
        if (!pLevel.pFirstRoomEx) {
          DRLG_InitLevel(pLevel)
        }

        if (nWarpDestination !== -1) {
          let nSourceVisCount = 0
          for (let i = 0; i <= nWarpId; i += 1) {
            if (pSourceVisArray[i] === pLevel.nLevelId) {
              nSourceVisCount += 1
            }
          }

          let nDestinationVisCount = 0
          for (let i = 0; i < 8; i += 1) {
            if (pDestinationVisArray[i] === pDrlgRoom.pLevel.nLevelId) {
              nDestinationVisCount += 1
            }

            if (nSourceVisCount === nDestinationVisCount) {
              const pNearRoom = pLevel.pFirstRoomEx
              if (sub_6FD77F00(pDrlgRoom, nWarpId, pNearRoom, i, nWarpDestination)) {
                bSkip = true
                break
              }
            }
          }
        }

        if (!bSkip) {
          for (let i = 0; i < 8; i += 1) {
            if (pDestinationVisArray[i] === pDrlgRoom.pLevel.nLevelId) {
              const pNearRoom = pLevel.pFirstRoomEx
              if (sub_6FD77F00(pDrlgRoom, nWarpId, pNearRoom, i, nWarpDestination)) {
                break
              }
            }
          }
        }
      }

      nFlags <<= 1
      nWarpId += 1
    } while (nFlags & DRLGROOMFLAG_HAS_WARP_MASK)
  }

  if (!DRLG_IsTownLevel(pDrlgRoom.pLevel.nLevelId)) {
    for (let i = 0; i < pDrlgRoom.nRoomsNear; i += 1) {
      if (DRLG_IsTownLevel(pDrlgRoom.ppRoomsNear[i]!.pLevel.nLevelId)) {
        pDrlgRoom.dwFlags = (pDrlgRoom.dwFlags | DRLGROOMFLAG_POPULATION_ZERO) >>> 0
        return
      }
    }
  }
}

