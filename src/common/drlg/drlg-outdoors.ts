/**
 * D2Common outdoor DRLG: 1:1 port of D2MOO source/D2Common/src/Drlg/DrlgOutdoors.cpp and the inline
 * helper of include/Drlg/D2DrlgOutdoors.h (commit 5596f5c, MIT License, Copyright (c) 2020-2025
 * The Phrozen Keep community).
 *
 * Conventions specific to this file (see drlg-types.ts for the shared ones):
 *   - `D2DrlgOutdoorPackedGrid2InfoStrc` values are handled as their packed uint32 (`nPackedValue`);
 *     the bitfields are read with the GRID2_* masks and grid2PickedFile() of drlg-types.ts.
 *   - `D2CoordStrc pCoord[256]` stack arrays throw instead of overflowing.
 *   - `pOutdoors->pVertices[24]` / `pPathStarts[6]` are bounds-checked where C indexes them with a
 *     computed index (C would silently overrun into the neighbouring fields of D2DrlgOutdoorInfoStrc).
 */

import { SEED_RollLimitedRandomNumber, SEED_RollRandomNumber } from '../rng/d2-rng.ts'
import { DATATBLS_GetLvlPrestTxtRecord, type DrlgTables } from './drlg-tables.ts'
import {
  ACT_I,
  ACT_II,
  ACT_III,
  ACT_IV,
  ACT_V,
  ALTDIR_EAST,
  ALTDIR_NORTH,
  ALTDIR_SOUTH,
  ALTDIR_WEST,
  FLAG_OPERATION_AND_NEGATED,
  FLAG_OPERATION_OR,
  FLAG_OPERATION_OVERWRITE,
  GRID2_HAS_PICKED_FILE,
  GRID2_LVL_LINK,
  GRID2_UNKB00,
  GRID2_UNKB07,
  GRID2_UNKB08,
  GRID2_UNKB11,
  GRID2_UNKB12,
  LEVEL_BLOODMOOR,
  LEVEL_COLDPLAINS,
  LEVEL_MONASTERYGATE,
  LEVEL_PANDEMONIUMRUN2,
  LEVEL_ROGUEENCAMPMENT,
  grid2PickedFile,
  grid2PickedFileBits,
  idiv,
  imod,
  newCoord,
  newOutdoorInfo,
  outdoorCoord,
  type D2DrlgBuildStrc,
  type D2DrlgCoordStrc,
  type D2DrlgLevelStrc,
  type D2DrlgOutdoorInfoStrc,
  type D2DrlgRoomStrc,
  type D2DrlgVertexStrc,
} from './drlg-types.ts'
import {
  LVLPREST_ACT1_WILD_BORDER_1,
  LVLPREST_ACT1_WILD_BORDER_12,
  LVLPREST_ACT2_DESERT_BORDER_1,
  LVLPREST_ACT2_DESERT_BORDER_12,
  LVLPREST_ACT4_DIABLO_ARM_E,
  LVLPREST_ACT4_DIABLO_ARM_N,
  LVLPREST_ACT4_DIABLO_ARM_S,
  LVLPREST_ACT4_DIABLO_ARM_W,
  LVLPREST_ACT4_DIABLO_ENTRY,
  LVLPREST_ACT4_DIABLO_HEART,
  LVLPREST_ACT4_FORTRESS_TRANSITION,
  LVLPREST_ACT4_LAVA_X,
  LVLPREST_ACT4_MESA_1_24X24,
  LVLPREST_ACT4_MESA_2_24X24,
  LVLPREST_ACT4_MESA_2_IZUAL,
  LVLPREST_ACT4_MESA_3_24X24,
  LVLPREST_ACT4_MESA_BORDER_1,
  LVLPREST_ACT4_MESA_WARP,
  LVLPREST_ACT4_PITS_1_16X16,
  LVLPREST_ACT4_PITS_2_16X16,
  LVLTYPE_ACT1_WILDERNESS,
  LVLTYPE_ACT2_DESERT,
  LVLTYPE_ACT3_JUNGLE,
  LVLTYPE_ACT3_KURAST,
  LVLTYPE_ACT4_LAVA,
  LVLTYPE_ACT4_MESA,
  LVLTYPE_ACT5_BARRICADE,
  LVLTYPE_ACT5_SIEGE,
  byte_6FDCF958,
} from './drlg-ids.ts'
import {
  DRLGGRID_AlterGridFlag,
  DRLGGRID_FreeGrid,
  DRLGGRID_GetGridEntry,
  DRLGGRID_InitializeGridCells,
  DRLGGRID_IsPointInsideGridArea,
  DRLGGRID_SetVertexGridFlags,
  sub_6FD75F60,
} from './drlg-grid.ts'
import { DRLGVER_AllocVertex, DRLGVER_CreateVertices } from './drlg-vertex.ts'
import { DRLGROOM_AreXYInsideCoordinates, DRLGROOM_GetVisArrayFromLevelId } from './drlg-room.ts'
import { DRLGPRESET_AllocDrlgMap, DRLGPRESET_BuildArea, DRLGPRESET_SetPickedFileInDrlgMap } from './drlg-preset.ts'
import { DRLG_GetActNoFromLevelId } from './drlg-drlg.ts'
import { notifyLevelGrid } from './drlg-hooks.ts'
import { DRLGOUTDESR_InitAct2OutdoorLevel } from './drlg-outdesr.ts'
import { DRLGOUTWILD_GetBridgeCoords, DRLGOUTWILD_InitAct1OutdoorLevel } from './drlg-outwild.ts'
import {
  DRLGOUTPLACE_CreateOutdoorRoomEx,
  DRLGOUTPLACE_InitAct3OutdoorLevel,
  DRLGOUTPLACE_PlaceAct1245OutdoorBorders,
  DRLGOUTPLACE_SetOutGridLinkFlags,
  sub_6FD80750,
} from './drlg-outplace.ts'
import { DRLGOUTSIEGE_InitAct5OutdoorLevel } from './drlg-outsiege.ts'
import { DRLGTILESUB_AddSecondaryBorder } from './drlg-tilesub.ts'

// D2C_Levels (DataTbls/LevelsIds.h) used only by the Act IV code of this file.
const LEVEL_OUTERSTEPPES = 104
const LEVEL_PLAINSOFDESPAIR = 105
const LEVEL_CITYOFTHEDAMNED = 106
const LEVEL_CHAOSSANCTUM = 108

/** D2CoordStrc (D2CommonDefinitions): the element of the `pCoord[256]` stack arrays. */
interface D2CoordStrc {
  nX: number
  nY: number
}

/** `D2CoordStrc pCoord[256] = {};` */
function allocCoordArray(): D2CoordStrc[] {
  const pCoord: D2CoordStrc[] = []
  for (let i = 0; i < 256; i += 1) pCoord.push({ nX: 0, nY: 0 })
  return pCoord
}

/** The fill loops write pCoord[0 .. nArea - 1]: C overflows the 256-entry stack array beyond that. */
function checkCoordArea(szFunction: string, nArea: number): void {
  if (nArea > 256) throw new RangeError(`${szFunction}: nArea ${nArea} overflows D2CoordStrc pCoord[256]`)
}

/** `&pOutdoors->pVertices[nIndex]`, dereferenced (embedded array of 24 vertices). */
function outdoorVertex(pOutdoors: D2DrlgOutdoorInfoStrc, nIndex: number): D2DrlgVertexStrc {
  const pVertex = nIndex >= 0 && nIndex < 24 ? pOutdoors.pVertices[nIndex] : undefined
  if (!pVertex) throw new RangeError(`pOutdoors->pVertices[${nIndex}] is outside the 24-entry array`)
  return pVertex
}

/** `pOutdoors->pPathStarts[nIndex]` (embedded array of 6 pointers). */
function checkPathStartIndex(nIndex: number): void {
  if (nIndex < 0 || nIndex >= 6) throw new RangeError(`pOutdoors->pPathStarts[${nIndex}] is outside the 6-entry array`)
}

//D2Common.0x6FD87F00 (DrlgPreset.cpp; drlg-preset.ts does not export it)
function DRLGPRESET_GetSizeX(t: DrlgTables, nLvlPrestId: number): number {
  return DATATBLS_GetLvlPrestTxtRecord(t, nLvlPrestId).nSizeX
}

//D2Common.0x6FD87F10 (DrlgPreset.cpp; drlg-preset.ts does not export it)
function DRLGPRESET_GetSizeY(t: DrlgTables, nLvlPrestId: number): number {
  return DATATBLS_GetLvlPrestTxtRecord(t, nLvlPrestId).nSizeY
}

//Helper function (D2DrlgOutdoors.h, inline): the packed D2DrlgOutdoorPackedGrid2InfoStrc of pGrid[2].
export function DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors: D2DrlgOutdoorInfoStrc, nX: number, nY: number): number {
  const nPackedValue = DRLGGRID_GetGridEntry(pOutdoors.pGrid[2], nX, nY) >>> 0
  return nPackedValue
}

//D2Common.0x6FD7DC20
export function DRLGOUTDOORS_GetOutLinkVisFlag(pLevel: D2DrlgLevelStrc, pDrlgVertex: D2DrlgVertexStrc): number {
  const pOffsetCoords: readonly D2CoordStrc[] = [
    { nX: -4, nY: 4 },
    { nX: 4, nY: -4 },
    { nX: 12, nY: 4 },
    { nX: 4, nY: 12 },
  ]

  let nIndex = 0
  let nX = 0
  let nY = 0

  const pOutdoors = pLevel.pOutdoors!
  if (pDrlgVertex.nPosX === 0) {
    nIndex = pDrlgVertex.nPosY === 0 ? 1 : 0
  } else if (pDrlgVertex.nPosY === 0) {
    nIndex = (pDrlgVertex.nPosX === pOutdoors.nGridWidth - 1 ? 1 : 0) + 1
  } else if (pDrlgVertex.nPosX === pOutdoors.nGridWidth - 1) {
    nIndex = (pDrlgVertex.nPosY === pOutdoors.nGridHeight - 1 ? 1 : 0) + 2
  } else if (pDrlgVertex.nPosY === pOutdoors.nGridHeight - 1) {
    nIndex = 3
  } else {
    return 0
  }

  nX = pLevel.pLevelCoords.nPosX + pOffsetCoords[nIndex]!.nX + 8 * pDrlgVertex.nPosX
  nY = pLevel.pLevelCoords.nPosY + pOffsetCoords[nIndex]!.nY + 8 * pDrlgVertex.nPosY

  for (let pRoomData = pOutdoors.pRoomData; pRoomData; pRoomData = pRoomData.pNext) {
    if (nIndex === pRoomData.nDirection && DRLGROOM_AreXYInsideCoordinates(pRoomData.pBox!, nX, nY)) {
      if (!pRoomData.bInit) {
        const pLevelIds = DRLGROOM_GetVisArrayFromLevelId(pLevel.pDrlg, pLevel.nLevelId)
        for (let i = 0; i < 8; i += 1) {
          if (pLevelIds[i] === pRoomData.pLevel!.nLevelId) {
            return 1 << (i + 4)
          }
        }
      }

      return 0
    }
  }

  return 0
}

//D2Common.0x6FD7DD00
export function DRLGOUTDOORS_GetPresetIndexFromGridCell(pLevel: D2DrlgLevelStrc, nX: number, nY: number): number {
  if (DRLGOUTDOORS_GetPackedGrid2Info(pLevel.pOutdoors!, nX, nY) & GRID2_HAS_PICKED_FILE) {
    return DRLGGRID_GetGridEntry(pLevel.pOutdoors!.pGrid[0], nX, nY)
  }

  return 0
}

//D2Common.0x6FD7DD40
export function DRLGOUTDOORS_AlterAdjacentPresetGridCells(pLevel: D2DrlgLevelStrc, nX: number, nY: number): void {
  DRLGGRID_AlterGridFlag(pLevel.pOutdoors!.pGrid[0], nX, nY, 0, FLAG_OPERATION_OVERWRITE)
  DRLGGRID_AlterGridFlag(pLevel.pOutdoors!.pGrid[2], nX, nY, 0, FLAG_OPERATION_OVERWRITE)
}

//D2Common.0x6FD7DD70
export function DRLGOUTDOORS_SetBlankGridCell(pLevel: D2DrlgLevelStrc, nX: number, nY: number): void {
  DRLGGRID_AlterGridFlag(pLevel.pOutdoors!.pGrid[0], nX, nY, 0, FLAG_OPERATION_OVERWRITE)
  // tPackedInfo{ 0 }; tPackedInfo.nUnkb08 = true;
  const nPackedValue = GRID2_UNKB08
  DRLGGRID_AlterGridFlag(pLevel.pOutdoors!.pGrid[2], nX, nY, nPackedValue, FLAG_OPERATION_OVERWRITE)
}

//D2Common.0x6FD7DDB0
export function DRLGOUTDOORS_TestGridCellNonLvlLink(pLevel: D2DrlgLevelStrc, nX: number, nY: number): number {
  return (DRLGOUTDOORS_GetPackedGrid2Info(pLevel.pOutdoors!, nX, nY) & GRID2_LVL_LINK) === 0 ? 1 : 0
}

//D2Common.0x6FD7DDD0
export function DRLGOUTDOORS_TestGridCellSpawnValid(pLevel: D2DrlgLevelStrc, nX: number, nY: number): boolean {
  const tPackedInfo = DRLGOUTDOORS_GetPackedGrid2Info(pLevel.pOutdoors!, nX, nY)
  // ! (nVal & 0x1B81): nUnkb00 || nUnkb07 || nUnkb08 || bHasPickedFile || nUnkb11 || nUnkb12
  return !(tPackedInfo & (GRID2_UNKB00 | GRID2_UNKB07 | GRID2_UNKB08 | GRID2_HAS_PICKED_FILE | GRID2_UNKB11 | GRID2_UNKB12))
}

//D2Common.0x6FD7DDF0
export function DRLGOUTDOORS_TestOutdoorLevelPreset(
  pLevel: D2DrlgLevelStrc,
  nX: number,
  nY: number,
  nLevelPrestId: number,
  nOffset: number,
  nFlags: number,
): boolean {
  let nXStart = 0
  let nYStart = 0
  let nSizeX = 0
  let nSizeY = 0
  let nXEnd = 0
  let nYEnd = 0

  nXStart = nX
  nYStart = nY

  if (nLevelPrestId) {
    const pLvlPrestTxtRecord = DATATBLS_GetLvlPrestTxtRecord(pLevel.pDrlg.env.tables, nLevelPrestId)
    nSizeX = idiv(pLvlPrestTxtRecord.nSizeX, 8)
    nSizeY = idiv(pLvlPrestTxtRecord.nSizeY, 8)
  } else {
    nSizeX = 1
    nSizeY = 1
  }

  if (nOffset) {
    if (nFlags & 1) {
      nYStart -= nOffset
      nSizeY += nOffset
    }

    if (nFlags & 2) {
      nSizeX += nOffset
    }

    if (nFlags & 4) {
      nSizeY += nOffset
    }

    if (nFlags & 8) {
      nXStart -= nOffset
      nSizeX += nOffset
    }
  }

  nXEnd = nXStart + nSizeX
  nYEnd = nYStart + nSizeY

  for (let i = nYStart; i < nYEnd; i += 1) {
    for (let j = nXStart; j < nXEnd; j += 1) {
      if (!DRLGGRID_IsPointInsideGridArea(pLevel.pOutdoors!.pGrid[2], j, i) || !DRLGOUTDOORS_TestGridCellSpawnValid(pLevel, j, i)) {
        return false
      }
    }
  }

  return true
}

//D2Common.0x6FD7DEF0
export function DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
  pLevel: D2DrlgLevelStrc,
  nX: number,
  nY: number,
  nLevelPrestId: number,
  nPickedFile: number,
  bBorder: boolean,
): void {
  let pDrlgBuild: D2DrlgBuildStrc | null = null
  let nSizeX = 0
  let nSizeY = 0

  const t = pLevel.pDrlg.env.tables
  nSizeX = idiv(DRLGPRESET_GetSizeX(t, nLevelPrestId), 8)
  nSizeY = idiv(DRLGPRESET_GetSizeY(t, nLevelPrestId), 8)

  if (nPickedFile === -1) {
    pDrlgBuild = pLevel.pBuild
    while (pDrlgBuild) {
      if (pDrlgBuild.nPreset === nLevelPrestId) {
        break
      }

      pDrlgBuild = pDrlgBuild.pNext
    }

    if (!pDrlgBuild) {
      const pLvlPrestTxtRecord = DATATBLS_GetLvlPrestTxtRecord(t, nLevelPrestId)

      // D2_ALLOC_STRC_POOL: every field is assigned below.
      pDrlgBuild = { nPreset: 0, nDivisor: 0, nRand: 0, pNext: null }
      pDrlgBuild.nPreset = pLvlPrestTxtRecord.dwDef
      pDrlgBuild.nDivisor = pLvlPrestTxtRecord.dwFiles
      pDrlgBuild.nRand = SEED_RollLimitedRandomNumber(pLevel.pSeed, pLvlPrestTxtRecord.dwFiles) | 0
      pDrlgBuild.pNext = pLevel.pBuild

      pLevel.pBuild = pDrlgBuild
    }

    pDrlgBuild.nRand = imod(pDrlgBuild.nRand + 1, pDrlgBuild.nDivisor)
    nPickedFile = pDrlgBuild.nRand
  }

  const pOutdoors = pLevel.pOutdoors!
  for (let j = nY; j < nY + nSizeY; j += 1) {
    for (let i = nX; i < nX + nSizeX; i += 1) {
      // tPackedInfo{ 0 }; tPackedInfo.bHasPickedFile = true; tPackedInfo.nPickedFile = nPickedFile;
      let nPackedValue = GRID2_HAS_PICKED_FILE | grid2PickedFileBits(nPickedFile)

      DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], i, j, 0xf0000, FLAG_OPERATION_AND_NEGATED) // Clear nPickedFile
      DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], i, j, nPackedValue, FLAG_OPERATION_OR)

      if (
        bBorder &&
        ((nLevelPrestId >= LVLPREST_ACT1_WILD_BORDER_1 && nLevelPrestId <= LVLPREST_ACT1_WILD_BORDER_12) ||
          (nLevelPrestId >= LVLPREST_ACT2_DESERT_BORDER_1 && nLevelPrestId <= LVLPREST_ACT2_DESERT_BORDER_12))
      ) {
        nPackedValue = 0
        nPackedValue |= GRID2_UNKB00 // tPackedInfo.nUnkb00 = true;
        DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], i, j, nPackedValue, FLAG_OPERATION_OR)
      }

      DRLGGRID_AlterGridFlag(pOutdoors.pGrid[0], i, j, 0, FLAG_OPERATION_OVERWRITE)
    }
  }

  DRLGGRID_AlterGridFlag(pOutdoors.pGrid[0], nX, nY, nLevelPrestId, FLAG_OPERATION_OVERWRITE)
}

//D2Common.0x6FD7E0F0
export function DRLGOUTDOORS_SpawnPresetFarAway(
  pLevel: D2DrlgLevelStrc,
  pDrlgCoord: D2DrlgCoordStrc,
  nLvlPrestId: number,
  nRand: number,
  nOffset: number,
  nFlags: number,
): boolean {
  let nHeight = 0
  let nWidth = 0
  let nBaseX = 0
  let nBaseY = 0
  let nRandX = 0
  let nRandY = 0
  let nAbsX = 0
  let nAbsY = 0
  let nPosX = 0
  let nPosY = 0
  let nTemp = 0
  let nMax = 0
  let nX = 0
  let nY = 0

  nWidth = pLevel.pOutdoors!.nGridWidth - 2
  nHeight = pLevel.pOutdoors!.nGridHeight - 2

  nRandX = SEED_RollLimitedRandomNumber(pLevel.pSeed, nWidth) | 0
  nRandY = SEED_RollLimitedRandomNumber(pLevel.pSeed, nHeight) | 0

  nBaseX = pDrlgCoord.nPosX + idiv(pDrlgCoord.nWidth, 2)
  nBaseY = pDrlgCoord.nPosY + idiv(pDrlgCoord.nHeight, 2)
  nX = -1
  nY = -1

  for (let i = 0; i <= nHeight; i += 1) {
    nPosY = imod(i + nRandY, nHeight) + 1

    for (let j = 0; j <= nWidth; j += 1) {
      nPosX = imod(j + nRandX, nWidth) + 1

      if (DRLGOUTDOORS_TestOutdoorLevelPreset(pLevel, nPosX, nPosY, nLvlPrestId, nOffset, nFlags)) {
        nAbsX = 8 * nPosX - nBaseX + pLevel.pLevelCoords.nPosX + 4
        if (nAbsX < 0) {
          nAbsX = -nAbsX
        }

        nAbsY = 8 * nPosY - nBaseY + pLevel.pLevelCoords.nPosY + 4
        if (nAbsY < 0) {
          nAbsY = -nAbsY
        }

        if (nAbsX <= nAbsY) {
          nTemp = nAbsX + 2 * nAbsY
        } else {
          nTemp = nAbsY + 2 * nAbsX
        }

        if (nMax < idiv(nTemp, 2)) {
          nMax = idiv(nTemp, 2)
          nX = nPosX
          nY = nPosY
        }
      }
    }
  }

  if (nX === -1 || nY === -1) {
    return false
  } else {
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY, nLvlPrestId, nRand, false)
    return true
  }
}

//D2Common.0x6FD7E330
export function DRLGOUTDOORS_SpawnOutdoorLevelPreset(
  pLevel: D2DrlgLevelStrc,
  nLevelPrestId: number,
  nRand: number,
  nOffset: number,
  nFlags: number,
): boolean {
  const pCoord = allocCoordArray()
  let nWidth = 0
  let nRand1 = 0
  let nRand2 = 0
  let nArea = 0
  let nX = 0
  let nY = 0

  nWidth = pLevel.pOutdoors!.nGridWidth - 2
  nArea = Math.imul(nWidth, pLevel.pOutdoors!.nGridHeight - 2)

  if (nArea) {
    checkCoordArea('DRLGOUTDOORS_SpawnOutdoorLevelPreset', nArea)
    for (let i = 0; i < nArea; i += 1) {
      pCoord[i]!.nX = imod(i, nWidth)
      pCoord[i]!.nY = idiv(i, nWidth)
    }

    for (let i = 0; i < nArea; i += 1) {
      nRand1 = SEED_RollLimitedRandomNumber(pLevel.pSeed, nArea)
      nRand2 = SEED_RollLimitedRandomNumber(pLevel.pSeed, nArea)

      nX = pCoord[nRand1]!.nX
      nY = pCoord[nRand1]!.nY

      pCoord[nRand1]!.nX = pCoord[nRand2]!.nX
      pCoord[nRand1]!.nY = pCoord[nRand2]!.nY

      pCoord[nRand2]!.nX = nX
      pCoord[nRand2]!.nY = nY
    }

    for (let i = 0; i < nArea; i += 1) {
      nX = pCoord[i]!.nX + 1
      nY = pCoord[i]!.nY + 1

      if (DRLGOUTDOORS_TestOutdoorLevelPreset(pLevel, nX, nY, nLevelPrestId, nOffset, nFlags)) {
        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY, nLevelPrestId, nRand, false)
        return true
      }
    }
  }

  return false
}

//D2Common.0x6FD7E4D0
export function DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel: D2DrlgLevelStrc, nLvlPrestId: number, nRand: number): boolean {
  // static const char nOffsetX[] / nOffsetY[]
  const nOffsetX: readonly number[] = [-1, 0, 0, 1, -1, 1, 1, -1]
  const nOffsetY: readonly number[] = [0, -1, 1, 0, -1, 1, -1, 1]

  const pCoord = allocCoordArray()
  let nRand1 = 0
  let nRand2 = 0
  let nWidth = 0
  let nArea = 0
  let nPosX = 0
  let nPosY = 0
  let nX = 0
  let nY = 0

  nWidth = pLevel.pOutdoors!.nGridWidth - 2
  nArea = Math.imul(nWidth, pLevel.pOutdoors!.nGridHeight - 2)

  if (nArea) {
    if (nArea > 0) {
      checkCoordArea('DRLGOUTDOORS_SpawnRandomOutdoorDS1', nArea)
      for (let i = 0; i < nArea; i += 1) {
        pCoord[i]!.nX = imod(i, nWidth)
        pCoord[i]!.nY = idiv(i, nWidth)
      }

      for (let i = 0; i < nArea; i += 1) {
        nRand1 = SEED_RollLimitedRandomNumber(pLevel.pSeed, nArea)
        nRand2 = SEED_RollLimitedRandomNumber(pLevel.pSeed, nArea)

        nX = pCoord[nRand1]!.nX
        nY = pCoord[nRand1]!.nY

        pCoord[nRand1]!.nX = pCoord[nRand2]!.nX
        pCoord[nRand1]!.nY = pCoord[nRand2]!.nY

        pCoord[nRand2]!.nX = nX
        pCoord[nRand2]!.nY = nY
      }

      for (let i = 0; i < nArea; i += 1) {
        nX = pCoord[i]!.nX + 1
        nY = pCoord[i]!.nY + 1

        if (DRLGOUTDOORS_GetPackedGrid2Info(pLevel.pOutdoors!, nX, nY) & GRID2_UNKB07) {
          for (let j = 0; j < 8; j += 1) {
            nPosX = nX + nOffsetX[j]!
            nPosY = nY + nOffsetY[j]!

            if (DRLGOUTDOORS_TestOutdoorLevelPreset(pLevel, nPosX, nPosY, nLvlPrestId, 0, 15)) {
              DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nPosX, nPosY, nLvlPrestId, nRand, false)
              return true
            }
          }
        }
      }
    }

    return DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nLvlPrestId, nRand, 0, 15)
  }

  return false
}

//D2Common.0x6FD7E6D0
export function DRLGOUTDOORS_SpawnAct12Waypoint(pLevel: D2DrlgLevelStrc): void {
  const pCoord = allocCoordArray()
  let nFlags = 0
  let nWidth = 0
  let nRand1 = 0
  let nRand2 = 0
  let nArea = 0
  let nX = 0
  let nY = 0

  const pOutdoors = pLevel.pOutdoors!
  if (pLevel.nLevelId === LEVEL_COLDPLAINS) {
    const pVisArray = DRLGROOM_GetVisArrayFromLevelId(pLevel.pDrlg, LEVEL_COLDPLAINS)
    for (let i = 0; i < 8; i += 1) {
      if (pVisArray[i] === LEVEL_BLOODMOOR) {
        nFlags = 1 << (i + 4)
        break
      }
    }

    for (let i = 0; i < pOutdoors.nGridHeight; i += 1) {
      for (let j = 0; j < pOutdoors.nGridWidth; j += 1) {
        if (DRLGGRID_GetGridEntry(pOutdoors.pGrid[1], j, i) & nFlags && !DRLGOUTDOORS_TestGridCellNonLvlLink(pLevel, j, i)) {
          if (!j) {
            j = 1
          }
          if (!i) {
            i = 1
          }
          if (j === pOutdoors.nGridWidth - 1) {
            j -= 1
          }
          if (i === pOutdoors.nGridHeight - 1) {
            i -= 1
          }

          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[1], j, i, 0x20000, FLAG_OPERATION_OR)
          // tPackedInfo{ 0 }; tPackedInfo.nUnkb11 = true;
          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], j, i, GRID2_UNKB11, FLAG_OPERATION_OR)
          return
        }
      }
    }
  }

  nWidth = pOutdoors.nGridWidth - 2
  nArea = Math.imul(nWidth, pOutdoors.nGridHeight - 2)

  if (nArea) {
    if (nArea > 0) {
      checkCoordArea('DRLGOUTDOORS_SpawnAct12Waypoint', nArea)
      for (let i = 0; i < nArea; i += 1) {
        pCoord[i]!.nX = imod(i, nWidth)
        pCoord[i]!.nY = idiv(i, nWidth)
      }

      for (let i = 0; i < nArea; i += 1) {
        nRand1 = SEED_RollLimitedRandomNumber(pLevel.pSeed, nArea)
        nRand2 = SEED_RollLimitedRandomNumber(pLevel.pSeed, nArea)

        nX = pCoord[nRand1]!.nX
        nY = pCoord[nRand1]!.nY

        pCoord[nRand1]!.nX = pCoord[nRand2]!.nX
        pCoord[nRand1]!.nY = pCoord[nRand2]!.nY

        pCoord[nRand2]!.nX = nX
        pCoord[nRand2]!.nY = nY
      }

      for (let i = 0; i < nArea; i += 1) {
        nX = pCoord[i]!.nX + 1
        nY = pCoord[i]!.nY + 1

        if (DRLGOUTDOORS_TestGridCellSpawnValid(pLevel, nX, nY)) {
          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[1], nX, nY, 0x10000, FLAG_OPERATION_OR)
          // tPackedInfo{ 0 }; tPackedInfo.nUnkb11 = true;
          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nX, nY, GRID2_UNKB11, FLAG_OPERATION_OR)
          break
        }
      }
    }
  }
}

//D2Common.0x6FD7E940
export function DRLGOUTDOORS_SpawnAct12Shrines(pLevel: D2DrlgLevelStrc, nShrines: number): void {
  const dword_6FDCF948: readonly number[] = [0x1000, 0x2000, 0x4000, 0x8000]

  const pCoord = allocCoordArray()
  let nRand1 = 0
  let nRand2 = 0
  let nWidth = 0
  let nIndex = 0
  let nArea = 0
  let nX = 0
  let nY = 0

  const pOutdoors = pLevel.pOutdoors!
  nWidth = pOutdoors.nGridWidth - 2
  nArea = Math.imul(nWidth, pOutdoors.nGridHeight - 2)
  nIndex = SEED_RollRandomNumber(pLevel.pSeed) & 3

  if (nArea) {
    if (nArea > 0) {
      checkCoordArea('DRLGOUTDOORS_SpawnAct12Shrines', nArea)
      for (let i = 0; i < nArea; i += 1) {
        pCoord[i]!.nX = imod(i, nWidth)
        pCoord[i]!.nY = idiv(i, nWidth)
      }

      for (let i = 0; i < nArea; i += 1) {
        nRand1 = SEED_RollLimitedRandomNumber(pLevel.pSeed, nArea)
        nRand2 = SEED_RollLimitedRandomNumber(pLevel.pSeed, nArea)

        nX = pCoord[nRand1]!.nX
        nY = pCoord[nRand1]!.nY

        pCoord[nRand1]!.nX = pCoord[nRand2]!.nX
        pCoord[nRand1]!.nY = pCoord[nRand2]!.nY

        pCoord[nRand2]!.nX = nX
        pCoord[nRand2]!.nY = nY
      }

      for (let i = 0; i < nArea; i += 1) {
        if (nShrines <= 0) {
          break
        }

        nX = pCoord[i]!.nX + 1
        nY = pCoord[i]!.nY + 1

        if (DRLGOUTDOORS_TestGridCellSpawnValid(pLevel, nX, nY)) {
          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[1], nX, nY, dword_6FDCF948[nIndex]!, FLAG_OPERATION_OR)

          // tPackedInfo{ 0 }; tPackedInfo.nUnkb12 = true;
          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nX, nY, GRID2_UNKB12, FLAG_OPERATION_OR)

          nIndex = (nIndex + 1) % 4
          nShrines -= 1
        }
      }
    }
  }
}

//D2Common.0x6FD7EB20
export function DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel: D2DrlgLevelStrc, nLvlSubId: number, nLevelPrestId: number): void {
  // D2UnkOutdoorStrc a1 = {}; field_4 = &pLevel->pOutdoors->nWidth, i.e. the pCoord union
  // {nWidth, nHeight, nGridWidth, nGridHeight} (DRLGTILESUB_AddSecondaryBorder reads field_4[2], [3]).
  // field_24 and field_28 stay zero.
  const a1 = {
    pLevel,
    field_4: outdoorCoord(pLevel.pOutdoors!),
    pGrid1: pLevel.pOutdoors!.pGrid[0],
    pGrid2: pLevel.pOutdoors!.pGrid[2],
    nLevelPrestId,
    field_14: -1,
    nLvlSubId,
    field_1C: DRLGOUTDOORS_TestGridCellNonLvlLink,
    field_20: DRLGOUTDOORS_TestOutdoorLevelPreset,
    field_24: null,
    field_28: null,
    field_2C: DRLGOUTDOORS_AlterAdjacentPresetGridCells,
    field_30: DRLGOUTDOORS_SetBlankGridCell,
    field_34: DRLGOUTDOORS_SpawnOutdoorLevelPresetEx,
  }

  DRLGTILESUB_AddSecondaryBorder(a1)
}

//D2Common.0x6FD7EBA0
export function DRLGOUTDOORS_AllocOutdoorInfo(pLevel: D2DrlgLevelStrc): void {
  pLevel.pOutdoors = newOutdoorInfo()
}

//1.10: D2Common.0x6FD7EBD0
//1.14d: 0x00675360
export function DRLGOUTDOORS_GenerateLevel(pLevel: D2DrlgLevelStrc): void {
  const pDrlgCoord = newCoord()
  let pNextVertex: D2DrlgVertexStrc | null = null
  let pVertex: D2DrlgVertexStrc | null = null
  let dwDt1Mask = 0
  let nX = 0
  let nY = 0
  let a6a = 0
  let v14 = 0

  const pOutdoorInfo = pLevel.pOutdoors!

  pOutdoorInfo.nWidth = 0
  pOutdoorInfo.nHeight = 0
  pOutdoorInfo.nGridWidth = idiv(pLevel.pLevelCoords.nWidth, 8)
  pOutdoorInfo.nGridHeight = idiv(pLevel.pLevelCoords.nHeight, 8)

  DRLGGRID_InitializeGridCells(pOutdoorInfo.pGrid[0], pOutdoorInfo.nGridWidth, pOutdoorInfo.nGridHeight)
  DRLGGRID_InitializeGridCells(pOutdoorInfo.pGrid[1], pOutdoorInfo.nGridWidth, pOutdoorInfo.nGridHeight)
  DRLGGRID_InitializeGridCells(pOutdoorInfo.pGrid[2], pOutdoorInfo.nGridWidth, pOutdoorInfo.nGridHeight)
  DRLGGRID_InitializeGridCells(pOutdoorInfo.pGrid[3], pOutdoorInfo.nGridWidth, pOutdoorInfo.nGridHeight)

  // ppVertex = &pOutdoorInfo->pVertex: `*ppVertex` reads pOutdoorInfo.pVertex below.
  pOutdoorInfo.pVertex = DRLGVER_CreateVertices(pLevel.pLevelCoords, 0, pOutdoorInfo.pRoomData)

  pVertex = pOutdoorInfo.pVertex
  do {
    pVertex.nPosX = idiv(pVertex.nPosX, 8)
    pVertex.nPosY = idiv(pVertex.nPosY, 8)
    pVertex = pVertex.pNext!
  } while (pVertex !== pOutdoorInfo.pVertex)

  do {
    pNextVertex = pVertex.pNext!

    if (pVertex.nPosX === pNextVertex.nPosX && pVertex.nPosY === pNextVertex.nPosY) {
      if (pNextVertex === pOutdoorInfo.pVertex) {
        pOutdoorInfo.pVertex = pVertex
      }

      pVertex.pNext = pNextVertex.pNext
      pVertex.dwFlags |= pNextVertex.dwFlags
      pVertex.nDirection = pNextVertex.nDirection
      // D2_FREE_POOL(pLevel->pDrlg->pMempool, pNextVertex);
    }

    pVertex = pVertex.pNext!
  } while (pVertex !== pOutdoorInfo.pVertex)

  const nAct =
    pLevel.nLevelId === LEVEL_PANDEMONIUMRUN2
      ? ACT_II
      : DRLG_GetActNoFromLevelId(pLevel.nLevelId)

  switch (nAct) {
    case ACT_I:
      DRLGOUTWILD_InitAct1OutdoorLevel(pLevel)
      notifyLevelGrid(pLevel)
      break

    case ACT_II:
      DRLGOUTDESR_InitAct2OutdoorLevel(pLevel)
      notifyLevelGrid(pLevel)
      break

    case ACT_III:
      DRLGOUTPLACE_InitAct3OutdoorLevel(pLevel)
      notifyLevelGrid(pLevel)
      break

    case ACT_IV:
      DRLGOUTDOORS_InitAct4OutdoorLevel(pLevel)
      notifyLevelGrid(pLevel)
      break

    case ACT_V:
      DRLGOUTSIEGE_InitAct5OutdoorLevel(pLevel)
      notifyLevelGrid(pLevel)
      break

    default:
      break
  }

  switch (pLevel.nLevelType) {
    case LVLTYPE_ACT1_WILDERNESS:
      dwDt1Mask = 0x44103
      break

    case LVLTYPE_ACT3_JUNGLE:
      dwDt1Mask = 0x04
      break

    case LVLTYPE_ACT2_DESERT:
    case LVLTYPE_ACT3_KURAST:
    case LVLTYPE_ACT4_MESA:
    case LVLTYPE_ACT4_LAVA:
      dwDt1Mask = 0x01
      break

    case LVLTYPE_ACT5_SIEGE:
    case LVLTYPE_ACT5_BARRICADE:
      dwDt1Mask = 0x11
      break

    default:
      dwDt1Mask = 0x00
      break
  }

  nY = pLevel.pLevelCoords.nPosY
  for (let j = 0; j < pOutdoorInfo.nGridHeight; j += 1) {
    nX = pLevel.pLevelCoords.nPosX
    for (let i = 0; i < pOutdoorInfo.nGridWidth; i += 1) {
      a6a = DRLGGRID_GetGridEntry(pOutdoorInfo.pGrid[1], i, j)
      const tGrid2PackedInfo = DRLGOUTDOORS_GetPackedGrid2Info(pOutdoorInfo, i, j)
      if (tGrid2PackedInfo & GRID2_HAS_PICKED_FILE) {
        v14 = DRLGGRID_GetGridEntry(pOutdoorInfo.pGrid[0], i, j)
        if (v14) {
          pDrlgCoord.nWidth = 0
          pDrlgCoord.nPosX = nX
          pDrlgCoord.nHeight = 0
          pDrlgCoord.nPosY = nY

          const pDrlgMap = DRLGPRESET_AllocDrlgMap(pLevel, v14, pDrlgCoord, pLevel.pSeed)
          DRLGPRESET_SetPickedFileInDrlgMap(pDrlgMap, grid2PickedFile(tGrid2PackedInfo))
          DRLGPRESET_BuildArea(pLevel, pDrlgMap, a6a, false)
        }
      } else if (!(tGrid2PackedInfo & GRID2_UNKB08)) {
        DRLGOUTPLACE_CreateOutdoorRoomEx(
          pLevel,
          nX,
          nY,
          8,
          8,
          a6a,
          tGrid2PackedInfo,
          DRLGGRID_GetGridEntry(pOutdoorInfo.pGrid[3], i, j),
          dwDt1Mask,
        )
      }

      nX += 8
    }

    nY += 8
  }
}

//D2Common.0x6FD7EFE0
export function DRLG_OUTDOORS_GenerateDirtPath(pLevel: D2DrlgLevelStrc, pDrlgRoom: D2DrlgRoomStrc): void {
  const pOutdoor = pDrlgRoom.pOutdoor!
  DRLGGRID_InitializeGridCells(pOutdoor.pDirtPathGrid, pDrlgRoom.pDrlgCoord.nWidth + 3, pDrlgRoom.pDrlgCoord.nHeight + 3)

  const tDrlgCoord = newCoord()
  tDrlgCoord.nPosX = pDrlgRoom.pDrlgCoord.nPosX - 1
  tDrlgCoord.nPosY = pDrlgRoom.pDrlgCoord.nPosY - 1
  tDrlgCoord.nWidth = pDrlgRoom.pDrlgCoord.nWidth + 3
  tDrlgCoord.nHeight = pDrlgRoom.pDrlgCoord.nHeight + 3

  const pOutdoors = pLevel.pOutdoors!
  for (let i = 0; i < pOutdoors.nVertices; i += 1) {
    checkPathStartIndex(i)
    for (let pVertex = pOutdoors.pPathStarts[i] ?? null; pVertex !== null; pVertex = pVertex.pNext) {
      if (pVertex.pNext) {
        sub_6FD75F60(pOutdoor.pDirtPathGrid, pVertex, tDrlgCoord, 1, FLAG_OPERATION_OR, 2)
      }
    }
  }

  const pDirtPathGrid = pOutdoor.pDirtPathGrid

  const nBoxDimension = 3
  const MapOffsetToBoxIndex = (nOffsetX: number, nOffsetY: number): number => {
    const nHalfBoxDimension = idiv(nBoxDimension, 2)
    const nBoxX = nHalfBoxDimension + nOffsetX
    const nBoxY = nBoxDimension - 1 - (nHalfBoxDimension + nOffsetY) // inverted Y
    return nBoxX * nBoxDimension + nBoxY
  }

  for (let nX = 1; nX <= pDrlgRoom.pDrlgCoord.nWidth + 1; nX += 1) {
    const aFlags = new Int32Array(nBoxDimension * nBoxDimension)

    const nStartY = pDrlgRoom.pDrlgCoord.nHeight + 1
    for (let nOffsetX = -1; nOffsetX <= 1; nOffsetX += 1) {
      for (let nOffsetY = -1; nOffsetY <= 1; nOffsetY += 1) {
        aFlags[MapOffsetToBoxIndex(nOffsetX, nOffsetY)] = DRLGGRID_GetGridEntry(pDirtPathGrid, nX + nOffsetX, nStartY + nOffsetY)
      }
    }

    for (let nY = nStartY; nY >= 1; nY -= 1) {
      const nBoxCenterIndex = MapOffsetToBoxIndex(0, 0)
      if (aFlags[nBoxCenterIndex]) {
        // center
        let nDirectionsWithPathFlags = 0
        for (let nBoxIndex = nBoxDimension * nBoxDimension - 1; nBoxIndex >= 0; nBoxIndex -= 1) {
          if (nBoxIndex !== nBoxCenterIndex) {
            nDirectionsWithPathFlags = (nDirectionsWithPathFlags << 1) >>> 0
            if (aFlags[nBoxIndex] !== 0) {
              nDirectionsWithPathFlags = (nDirectionsWithPathFlags | 1) >>> 0
            }
          }
        }

        if (nDirectionsWithPathFlags) {
          if (!(nDirectionsWithPathFlags < byte_6FDCF958.length)) {
            throw new Error('DRLG_OUTDOORS_GenerateDirtPath: D2_ASSERT(nDirectionsWithPathFlags < ARRAY_SIZE(byte_6FDCF958)) failed')
          }
          const v19 = byte_6FDCF958[nDirectionsWithPathFlags]!
          if (v19) {
            const nNewFloorFLags = ((v19 << 8) | 0x82) >>> 0
            DRLGGRID_AlterGridFlag(pOutdoor.pFloorGrid, nX - 1, nY - 1, nNewFloorFLags, FLAG_OPERATION_OVERWRITE)
          }
        }
      }

      // Update flags for next Y (move everything in direction of negative y, then sample the new values
      if (nY >= 2) {
        // memcpy(aFlags, &aFlags[1], sizeof(aFlags) - sizeof(aFlags[0])): overlapping, dst < src; the
        // intended (and compiled) behaviour is the memmove shift.
        aFlags.copyWithin(0, 1, nBoxDimension * nBoxDimension)

        aFlags[MapOffsetToBoxIndex(-1, -1)] = DRLGGRID_GetGridEntry(pDirtPathGrid, nX - 1, nY - 2)
        aFlags[MapOffsetToBoxIndex(0, -1)] = DRLGGRID_GetGridEntry(pDirtPathGrid, nX + 0, nY - 2)
        aFlags[MapOffsetToBoxIndex(+1, -1)] = DRLGGRID_GetGridEntry(pDirtPathGrid, nX + 1, nY - 2)
      }
    }
  }
}

//D2Common.0x6FD7F250
export function DRLGOUTDOORS_SpawnAct1DirtPaths(pLevel: D2DrlgLevelStrc): void {
  const pOutdoors = pLevel.pOutdoors!
  pOutdoors.nVertices = 0

  for (let pRoomData = pOutdoors.pRoomData; pRoomData !== null; pRoomData = pRoomData.pNext) {
    // D2DrlgVertexStrc* pVertex = &pOutdoors->pVertices[pOutdoors->nVertices]; (dereferenced below)
    const nVertexIndex = pOutdoors.nVertices
    const pNeighbour = pRoomData.pLevel!
    if (pNeighbour.nLevelId === LEVEL_ROGUEENCAMPMENT) {
      const pVertex = outdoorVertex(pOutdoors, nVertexIndex)
      pVertex.nDirection = pRoomData.nDirection & 0xff

      // Is west/east inverted here ?
      switch (pRoomData.nDirection) {
        case ALTDIR_WEST:
          pVertex.nPosX = pNeighbour.pLevelCoords.nPosX + 59
          pVertex.nPosY = pNeighbour.pLevelCoords.nPosY + 19
          break

        case ALTDIR_NORTH:
          pVertex.nPosX = pNeighbour.pLevelCoords.nPosX + 29
          pVertex.nPosY = pNeighbour.pLevelCoords.nPosY + 35
          break

        case ALTDIR_EAST:
          pVertex.nPosX = pNeighbour.pLevelCoords.nPosX + 4
          pVertex.nPosY = pNeighbour.pLevelCoords.nPosY + 22
          break

        case ALTDIR_SOUTH:
          pVertex.nPosX = pNeighbour.pLevelCoords.nPosX + 29
          pVertex.nPosY = pNeighbour.pLevelCoords.nPosY + 3
          break

        default:
          break
      }

      pOutdoors.nVertices += 1
    } else if (pNeighbour.nLevelId === LEVEL_MONASTERYGATE) {
      const pVertex = outdoorVertex(pOutdoors, nVertexIndex)
      pVertex.nPosX = pNeighbour.pLevelCoords.nPosX + 27
      pVertex.nPosY = pNeighbour.pLevelCoords.nPosY + 13

      pVertex.nDirection = ALTDIR_NORTH
      pOutdoors.nVertices += 1
    }
  }

  for (let i = 0; i < pOutdoors.nGridWidth; i += 1) {
    for (let j = 0; j < pOutdoors.nGridHeight; j += 1) {
      const nGrid0Entry = DRLGGRID_GetGridEntry(pOutdoors.pGrid[0], i, j)
      const tPackedInfo = DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, i, j)

      const pVertex = outdoorVertex(pOutdoors, pOutdoors.nVertices)

      pVertex.nPosX = pLevel.pLevelCoords.nPosX + 8 * i + 3
      pVertex.nPosY = pLevel.pLevelCoords.nPosY + 8 * j + 3
      pVertex.nDirection = 4

      const nPickedFile = grid2PickedFile(tPackedInfo)

      switch (nGrid0Entry) {
        case 4:
          if (nPickedFile === 3) {
            pVertex.nDirection = 3
          }
          break
        case 5:
          if (nPickedFile === 3) {
            pVertex.nDirection = 0
          }
          break
        case 6:
          if (nPickedFile === 3) {
            pVertex.nDirection = 1
          }
          break
        case 7:
          if (nPickedFile === 3) {
            pVertex.nDirection = 2
          }
          break
        case 24:
          pVertex.nDirection = 1
          break
        case 25:
          pVertex.nDirection = 0
          break
        case 28:
          if (nPickedFile === 1 && i === pOutdoors.nGridWidth - 2) {
            pVertex.nDirection = 2
          }
          break
        case 51:
        case 52:
          pVertex.nDirection = nPickedFile !== 0 ? 1 : 0
          break
        default:
          break
      }

      if (pVertex.nDirection !== 4) {
        pOutdoors.nVertices += 1
      }
    }
  }

  for (let i = 0; i < pOutdoors.nVertices; i += 1) {
    DRLGOUTDOORS_CalculatePathCoordinates(pLevel, outdoorVertex(pOutdoors, i), outdoorVertex(pOutdoors, 6 + i))
  }

  sub_6FD7F5B0(pLevel)

  for (let i = 0; i < pOutdoors.nVertices; i += 1) {
    if (sub_6FD80750(pLevel, i)) {
      // tPackedInfo{ 0 }; tPackedInfo.nUnkb07 = true;
      checkPathStartIndex(i)
      DRLGGRID_SetVertexGridFlags(pOutdoors.pGrid[2], pOutdoors.pPathStarts[i] ?? null, GRID2_UNKB07)
      sub_6FD7F810(pLevel, i)
    }
  }
}

//D2Common.0x6FD7F500
export function DRLGOUTDOORS_CalculatePathCoordinates(pLevel: D2DrlgLevelStrc, pVertex1: D2DrlgVertexStrc, pVertex2: D2DrlgVertexStrc): void {
  pVertex2.nPosX = pVertex1.nPosX - pLevel.pLevelCoords.nPosX
  pVertex2.nPosY = pVertex1.nPosY - pLevel.pLevelCoords.nPosY

  switch (pVertex1.nDirection) {
    case ALTDIR_WEST:
      pVertex2.nPosX = 8 * idiv(pVertex2.nPosX, 8) + 11
      break

    case ALTDIR_NORTH:
      pVertex2.nPosY = 8 * idiv(pVertex2.nPosY, 8) + 11
      break

    case ALTDIR_EAST:
      pVertex2.nPosX = 8 * idiv(pVertex2.nPosX, 8) - 5
      break

    case ALTDIR_SOUTH:
      pVertex2.nPosY = 8 * idiv(pVertex2.nPosY, 8) - 5
      break

    default:
      break
  }

  pVertex2.nPosX += pLevel.pLevelCoords.nPosX
  pVertex2.nPosY += pLevel.pLevelCoords.nPosY
}

//D2Common.0x6FD7F5B0
export function sub_6FD7F5B0(pLevel: D2DrlgLevelStrc): void {
  const nXOffsets: readonly number[] = [-1, 0, 0, 1]
  const nYOffsets: readonly number[] = [0, 1, -1, 0]

  let bBreak = false
  let nPosX = 0
  let nPosY = 0
  let nX = -1
  let nY = -1

  const pOutdoors = pLevel.pOutdoors!
  let bBridge = false
  if (pOutdoors.dwFlags & 0x10) {
    // (DRLGOUTWILD_GetBridgeCoords(pLevel, &nX, &nY), nX != -1)
    const tBridge = DRLGOUTWILD_GetBridgeCoords(pLevel)
    nX = tBridge.nX
    nY = tBridge.nY
    bBridge = nX !== -1
  }

  if (bBridge) {
    nPosX = pLevel.pLevelCoords.nPosX + 8 * nX + 3
    nPosY = pLevel.pLevelCoords.nPosY + 8 * nY + 3

    for (let i = 0; i < pOutdoors.nVertices; i += 1) {
      outdoorVertex(pOutdoors, 18 + i).nPosY = nPosY

      if (outdoorVertex(pOutdoors, i).nPosX <= nPosX) {
        outdoorVertex(pOutdoors, 18 + i).nPosX = nPosX
        outdoorVertex(pOutdoors, 18 + i).nDirection = 2
      } else {
        outdoorVertex(pOutdoors, 18 + i).nDirection = 0
        outdoorVertex(pOutdoors, 18 + i).nPosX = nPosX + 8
      }
    }
  } else {
    for (let i = 0; i < pOutdoors.nVertices; i += 1) {
      if (i) {
        outdoorVertex(pOutdoors, 18 + i).nPosX = outdoorVertex(pOutdoors, 18).nPosX
        outdoorVertex(pOutdoors, 18 + i).nPosY = outdoorVertex(pOutdoors, 18).nPosY
        outdoorVertex(pOutdoors, 18 + i).nDirection = 4
      } else {
        if (pOutdoors.nVertices === 1) {
          nPosX = idiv(pOutdoors.nGridWidth, 2)
          nPosY = idiv(pOutdoors.nGridHeight, 2)
        } else {
          nX = 0
          nY = 0

          for (let j = 0; j < pOutdoors.nVertices; j += 1) {
            nX += outdoorVertex(pOutdoors, j).nPosX - pLevel.pLevelCoords.nPosX
            nY += outdoorVertex(pOutdoors, j).nPosY - pLevel.pLevelCoords.nPosY
          }

          nPosX = idiv(nX, 8 * pOutdoors.nVertices)
          nPosY = idiv(nY, 8 * pOutdoors.nVertices)
        }

        bBreak = false

        for (let j = 0; j < 8; j += 1) {
          if (bBreak) {
            break
          }

          for (let k = 0; k < 4; k += 1) {
            nX = nPosX + j * nXOffsets[k]!
            nY = nPosY + j * nYOffsets[k]!

            if (nX >= 0 && nX < pOutdoors.nGridWidth && nY >= 0 && nY < pOutdoors.nGridHeight) {
              if (DRLGOUTDOORS_TestGridCellSpawnValid(pLevel, nX, nY)) {
                bBreak = true
                break
              }
            }
          }
        }

        outdoorVertex(pOutdoors, 18).nPosX = pLevel.pLevelCoords.nPosX + 8 * nX + 3
        outdoorVertex(pOutdoors, 18).nPosY = pLevel.pLevelCoords.nPosY + 8 * nY + 3
        outdoorVertex(pOutdoors, 18).nDirection = 4
      }
    }
  }

  for (let i = 0; i < pOutdoors.nVertices; i += 1) {
    DRLGOUTDOORS_CalculatePathCoordinates(pLevel, outdoorVertex(pOutdoors, 18 + i), outdoorVertex(pOutdoors, 12 + i))
  }
}

//D2Common.0x6FD7F810
export function sub_6FD7F810(pLevel: D2DrlgLevelStrc, nVertexId: number): void {
  const nXOffsets: readonly number[] = [1, 0, -1, 0]
  const nYOffsets: readonly number[] = [0, 1, 0, -1]

  let pNewVertex: D2DrlgVertexStrc | null = null
  let pVertex: D2DrlgVertexStrc | null = null
  let nOffsetX = 0
  let nOffsetY = 0
  let nIndex = 0

  const pOutdoors = pLevel.pOutdoors!
  checkPathStartIndex(nVertexId)
  pVertex = pOutdoors.pPathStarts[nVertexId] ?? null

  nIndex = SEED_RollRandomNumber(pLevel.pSeed) & 3
  if (pVertex) {
    if (outdoorVertex(pOutdoors, 18 + nVertexId).nDirection !== 4) {
      pNewVertex = DRLGVER_AllocVertex(0)
      pNewVertex.nPosX = outdoorVertex(pOutdoors, 18 + nVertexId).nPosX
      pNewVertex.nPosY = outdoorVertex(pOutdoors, 18 + nVertexId).nPosY
      pNewVertex.pNext = pVertex

      pOutdoors.pPathStarts[nVertexId] = pNewVertex
    }

    pVertex.nPosX = outdoorVertex(pOutdoors, 12 + nVertexId).nPosX
    pVertex.nPosY = outdoorVertex(pOutdoors, 12 + nVertexId).nPosY

    pVertex = pVertex.pNext
    if (pVertex) {
      while (pVertex.pNext) {
        nOffsetX = ((SEED_RollRandomNumber(pLevel.pSeed) & 1) + 2) * nXOffsets[nIndex]!
        nOffsetY = ((SEED_RollRandomNumber(pLevel.pSeed) & 1) + 2) * nYOffsets[nIndex]!

        nIndex = (nIndex + 1) % 4

        pVertex.nPosX = 8 * pVertex.nPosX + pLevel.pLevelCoords.nPosX + nOffsetX + 3
        pVertex.nPosY = 8 * pVertex.nPosY + pLevel.pLevelCoords.nPosY + nOffsetY + 3

        pVertex = pVertex.pNext
        if (!pVertex) {
          return
        }
      }

      pVertex.nPosX = outdoorVertex(pOutdoors, 6 + nVertexId).nPosX
      pVertex.nPosY = outdoorVertex(pOutdoors, 6 + nVertexId).nPosY

      pNewVertex = DRLGVER_AllocVertex(0)
      pNewVertex.nPosX = outdoorVertex(pOutdoors, 0 + nVertexId).nPosX
      pNewVertex.nPosY = outdoorVertex(pOutdoors, 0 + nVertexId).nPosY
      pVertex.pNext = pNewVertex
    }
  }
}

//D2Common.0x6FD7F9B0
// Only reachable through the Act IV dispatch of DRLGOUTDOORS_GenerateLevel, which throws (Act IV is
// out of scope); ported 1:1 for completeness.
export function DRLGOUTDOORS_InitAct4OutdoorLevel(pLevel: D2DrlgLevelStrc): void {
  const nMesaLvlPrestIds: readonly number[] = [LVLPREST_ACT4_MESA_1_24X24, LVLPREST_ACT4_MESA_2_24X24, LVLPREST_ACT4_MESA_3_24X24]

  const nPitsLvlPrestIds: readonly number[] = [LVLPREST_ACT4_PITS_1_16X16, LVLPREST_ACT4_PITS_2_16X16, LVLPREST_ACT4_PITS_2_16X16]

  const nLavaLvlPrestIds: readonly number[] = [
    LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_LAVA_X,
    LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_DIABLO_ARM_N, LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_LAVA_X,
    LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_DIABLO_ARM_W, LVLPREST_ACT4_DIABLO_HEART, LVLPREST_ACT4_DIABLO_ARM_E, LVLPREST_ACT4_LAVA_X,
    LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_DIABLO_ARM_S, LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_LAVA_X,
    LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_DIABLO_ENTRY, LVLPREST_ACT4_LAVA_X, LVLPREST_ACT4_LAVA_X,
  ]

  if (pLevel.nLevelId === LEVEL_CHAOSSANCTUM) {
    DRLGOUTPLACE_SetOutGridLinkFlags(pLevel)
  } else {
    DRLGOUTPLACE_SetOutGridLinkFlags(pLevel)
    DRLGOUTPLACE_PlaceAct1245OutdoorBorders(pLevel)
  }

  if (pLevel.nLevelId >= LEVEL_OUTERSTEPPES) {
    if (pLevel.nLevelId <= LEVEL_CITYOFTHEDAMNED) {
      if (pLevel.pOutdoors!.dwFlags & 0x400000) {
        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, 1, LVLPREST_ACT4_FORTRESS_TRANSITION, -1, false)
      }

      if (pLevel.pOutdoors!.dwFlags & 0x800000) {
        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, 4, LVLPREST_ACT4_FORTRESS_TRANSITION, -1, false)
      }

      DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, 1, LVLPREST_ACT4_MESA_BORDER_1)
      DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, 2, LVLPREST_ACT4_MESA_BORDER_1)
      DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, 3, LVLPREST_ACT4_MESA_BORDER_1)

      if (pLevel.nLevelId === LEVEL_CITYOFTHEDAMNED) {
        DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT4_MESA_WARP, -1, 0, 15)
      }

      const nMesaId = nMesaLvlPrestIds[pLevel.nLevelId - 104]!
      const nPitId = nPitsLvlPrestIds[pLevel.nLevelId - 104]!

      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 0, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 2, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 2, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 3, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 3, -1, 0, 15)

      if (pLevel.nLevelId === LEVEL_PLAINSOFDESPAIR) {
        DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT4_MESA_2_IZUAL, -1, 0, 15)
      }

      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 4, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 4, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 4, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nMesaId + 4, -1, 0, 15)

      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPitId + 0, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPitId + 1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPitId + 1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPitId + 2, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPitId + 2, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPitId + 3, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPitId + 3, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPitId + 3, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPitId + 3, -1, 0, 15)
    } else if (pLevel.nLevelId === LEVEL_CHAOSSANCTUM) {
      for (let i = 0; i < nLavaLvlPrestIds.length; i += 1) {
        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 3 * (i % 5), 3 * idiv(i, 5), nLavaLvlPrestIds[i]!, -1, false)
      }
    }
  }
}

