/**
 * 1:1 TypeScript port of D2MOO `source/D2Common/src/Drlg/DrlgTileSub.cpp` and
 * `source/D2Common/include/Drlg/D2DrlgTileSub.h`.
 */

import { SEED_RollLimitedRandomNumber, SEED_RollRandomNumber } from '../rng/d2-rng.ts'
import { DUNGEON_GameTileToSubtileCoords } from './drlg-drlg.ts'
import {
  DRLGGRID_AlterAllGridFlags,
  DRLGGRID_AlterGridFlag,
  DRLGGRID_FillNewCellFlags,
  DRLGGRID_FreeGrid,
  DRLGGRID_GetGridEntry,
} from './drlg-grid.ts'
import { DRLGPRESET_LoadDrlgFile } from './drlg-preset.ts'
import { DRLGROOM_AllocPresetUnit } from './drlg-room.ts'
import { DRLGROOMTILE_InitTileShadow, DRLGROOMTILE_ReallocRoofTileGrid } from './drlg-roomtile.ts'
import { DATATBLS_GetLvlSubTxtRecordIndex, type LvlSubRecord } from './drlg-tables.ts'
import {
  type D2DrlgGridStrc,
  type D2DrlgLevelStrc,
  type D2DrlgOutdoorRoomStrc,
  type D2DrlgRoomStrc,
  type D2DrlgSubstGroupStrc,
  type D2LvlSubFileStrc,
  type DrlgEnv,
  DRLG_MAX_WALL_LAYERS,
  DRLGSUBST_FIXED,
  DRLGSUBST_RANDOM,
  FLAG_OPERATION_OR,
  FLAG_OPERATION_OVERWRITE,
  i32,
  idiv,
  imod,
  LEVEL_BLOODMOOR,
  LEVEL_TAMOEHIGHLAND,
  newCoord,
  newGrid,
} from './drlg-types.ts'

export interface D2UnkOutdoorStrc {
  pLevel: D2DrlgLevelStrc
  field_4: { nPosX: number; nPosY: number; nWidth: number; nHeight: number }
  pGrid1: D2DrlgGridStrc
  pGrid2: D2DrlgGridStrc
  nLevelPrestId: number
  field_14: number
  nLvlSubId: number
  field_1C: ((pLevel: D2DrlgLevelStrc, nX: number, nY: number) => number | boolean) | null
  field_20:
    | ((pLevel: D2DrlgLevelStrc, nX: number, nY: number, nId: number, nOffset: number, nFlags: number) => boolean)
    | null
  field_24:
    | ((pLevel: D2DrlgLevelStrc, nX: number, nY: number, a4: number, a5: number, a6: number) => boolean)
    | null
  field_28: ((pLevel: D2DrlgLevelStrc, nStyle: number, a3: number) => number) | null
  field_2C: ((pLevel: D2DrlgLevelStrc, nX: number, nY: number) => void) | null
  field_30: ((pLevel: D2DrlgLevelStrc, nX: number, nY: number) => void) | null
  field_34:
    | ((pLevel: D2DrlgLevelStrc, nX: number, nY: number, nLevelPrestId: number, nRand: number, a6: boolean) => void)
    | null
}

export interface D2UnkOutdoorStrc2 {
  pDrlgRoom: D2DrlgRoomStrc
  pOutdoorRooms: (D2DrlgOutdoorRoomStrc | null)[]
  pWallsGrids: (D2DrlgGridStrc | null)[]
  pFloorGrid: D2DrlgGridStrc | null
  field_28: number
  field_2C: number
  nSubWaypoint_Shrine: number
  nSubTheme: number
  nSubThemePicked: number
}

function byte1(x: number): number {
  return (x >>> 8) & 0xff
}

//D2Common.0x6FD8A460
export function DRLGTILESUB_AddSecondaryBorder(a1: D2UnkOutdoorStrc): void {
  const env = a1.pLevel.pDrlg.env
  const lvlSub = env.tables.lvlSub
  let recIdx = DATATBLS_GetLvlSubTxtRecordIndex(env.tables, a1.nLvlSubId)

  const pCoordX = new Int32Array(256)
  const pCoordY = new Int32Array(256)

  while (recIdx < lvlSub.length && lvlSub[recIdx]!.dwType === a1.nLvlSubId) {
    const pLvlSubTxtRecord = lvlSub[recIdx]!
    const pSubFile = DRLGTILESUB_InitializeDrlgFile(env, pLvlSubTxtRecord)

    if (pSubFile.pDrlgFile.nSubstGroups > 0) {
      if (a1.field_14 === -1) {
        a1.field_14 = 62
      }

      let nRand = 0
      if (!pLvlSubTxtRecord.dwBordType) {
        nRand = SEED_RollLimitedRandomNumber(a1.pLevel.pSeed, pSubFile.pDrlgFile.nSubstGroups) >>> 0
      } else {
        nRand = 0
      }

      for (let j = 0; j < pSubFile.pDrlgFile.nSubstGroups; j += 1) {
        const nGroupIdx = ((nRand + j) >>> 0) % (pSubFile.pDrlgFile.nSubstGroups >>> 0)
        const pSubstGroup = pSubFile.pDrlgFile.pSubstGroups[nGroupIdx]!

        const bWilderness = a1.pLevel.nLevelId >= LEVEL_BLOODMOOR && a1.pLevel.nLevelId <= LEVEL_TAMOEHIGHLAND

        const nOffset = a1.nLvlSubId === 1 && a1.pLevel.pOutdoors!.dwFlags & 12 ? -1 : 1

        const nWidth = i32(
          nOffset + a1.field_4.nWidth - Math.imul(pLvlSubTxtRecord.dwGridSize, pSubstGroup.tBox.nWidth),
        )
        const nHeight = i32(
          1 + a1.field_4.nHeight - Math.imul(pLvlSubTxtRecord.dwGridSize, pSubstGroup.tBox.nHeight),
        )

        const nArea = Math.imul(nWidth, nHeight)
        if (nArea > 0) {
          if (nArea > 256) {
            throw new Error(`DRLGTILESUB_AddSecondaryBorder: nArea ${nArea} exceeds D2CoordStrc pCoord[256]`)
          }
          const bSmallWilderness = a1.nLvlSubId === 1 && bWilderness && nWidth < 6 && nHeight < 6

          for (let i = 0; i < nArea; i += 1) {
            pCoordX[i] = imod(i, nWidth)
            pCoordY[i] = idiv(i, nWidth)
          }

          for (let i = 0; i < nArea; i += 1) {
            const nRand1 = SEED_RollLimitedRandomNumber(a1.pLevel.pSeed, nArea) >>> 0
            const nRand2 = SEED_RollLimitedRandomNumber(a1.pLevel.pSeed, nArea) >>> 0

            const nTemp1 = pCoordX[nRand1]!
            const nTemp2 = pCoordY[nRand1]!

            pCoordX[nRand1] = pCoordX[nRand2]!
            pCoordY[nRand1] = pCoordY[nRand2]!
            pCoordX[nRand2] = nTemp1
            pCoordY[nRand2] = nTemp2
          }

          let bBreak = false
          for (let i = 0; i < nArea; i += 1) {
            const nX = pCoordX[i]!
            const nY = pCoordY[i]!
            if (!bSmallWilderness || nX !== 2 || nY !== 2) {
              if (DRLGTILESUB_TestReplaceSubPreset(nX, nY, a1, pSubstGroup, pLvlSubTxtRecord, pSubFile)) {
                const a6 = Math.imul(
                  i32(SEED_RollLimitedRandomNumber(a1.pLevel.pSeed, pSubstGroup.field_14) + 1),
                  i32(pSubstGroup.tBox.nWidth + 1),
                )
                DRLGTILESUB_ReplaceSubPreset(nX, nY, a1, pSubstGroup, pLvlSubTxtRecord, pSubFile, a6)

                if (pLvlSubTxtRecord.dwBordType === 0) {
                  bBreak = true
                  break
                } else if (pLvlSubTxtRecord.dwBordType === 1) {
                  break
                }
              }
            }
          }

          if (bBreak) {
            break
          }
        }
      }
    }

    recIdx += 1
  }
}

//D2Common.0x6FD8A750
export function DRLGTILESUB_TestReplaceSubPreset(
  a1: number,
  a2: number,
  a3: D2UnkOutdoorStrc,
  pSubstGroup: D2DrlgSubstGroupStrc,
  pLvlSubTxtRecord: LvlSubRecord,
  pSubFile: D2LvlSubFileStrc = DRLGTILESUB_InitializeDrlgFile(a3.pLevel.pDrlg.env, pLvlSubTxtRecord),
): boolean {
  const v9 = i32(a1 - imod(a1, pLvlSubTxtRecord.dwGridSize))
  const v8 = i32(a2 - imod(a2, pLvlSubTxtRecord.dwGridSize))

  for (let j = 0; j < pSubstGroup.tBox.nHeight; j += 1) {
    for (let i = 0; i < pSubstGroup.tBox.nWidth; i += 1) {
      let nFloorFlags = 0
      if (pSubFile.pDrlgFile.nFloorLayers) {
        nFloorFlags = DRLGGRID_GetGridEntry(
          pSubFile.pFloorGrid,
          i + pSubstGroup.tBox.nPosX,
          j + pSubstGroup.tBox.nPosY,
        )
      }

      let nWallFlags = 0
      if (pSubFile.pDrlgFile.nWallLayers) {
        nWallFlags = DRLGGRID_GetGridEntry(
          pSubFile.pWallGrid[0],
          i + pSubstGroup.tBox.nPosX,
          j + pSubstGroup.tBox.nPosY,
        )
      }

      const nX = i32(v9 + Math.imul(i, pLvlSubTxtRecord.dwGridSize))
      const nY = i32(v8 + Math.imul(j, pLvlSubTxtRecord.dwGridSize))

      const v15 = DRLGGRID_GetGridEntry(a3.pGrid1, nX, nY)
      if (a3.field_24) {
        if (!a3.field_24(a3.pLevel, nX, nY, v15, nFloorFlags, nWallFlags >>> 0)) {
          return false
        }
      } else if (nWallFlags & 1) {
        const v18 = byte1(nWallFlags) - 1
        if (v18 !== a3.field_14 && i32(v18 + a3.nLevelPrestId) !== v15) {
          return false
        }

        if (!a3.field_1C!(a3.pLevel, nX, nY)) {
          return false
        }
      } else if (nFloorFlags & 2) {
        if (!a3.field_20!(a3.pLevel, nX, nY, 0, 0, 0)) {
          return false
        }
      }
    }
  }

  return true
}

//D2Common.0x6FD8A8E0
export function DRLGTILESUB_ReplaceSubPreset(
  a1: number,
  a2: number,
  a3: D2UnkOutdoorStrc,
  pSubstGroup: D2DrlgSubstGroupStrc,
  pLvlSubTxtRecord: LvlSubRecord,
  pSubFile: D2LvlSubFileStrc = DRLGTILESUB_InitializeDrlgFile(a3.pLevel.pDrlg.env, pLvlSubTxtRecord),
  a6 = 0,
): void {
  const v21 = i32(a1 - imod(a1, pLvlSubTxtRecord.dwGridSize))
  const v25 = i32(a2 - imod(a2, pLvlSubTxtRecord.dwGridSize))

  for (let j = 0; j < pSubstGroup.tBox.nHeight; j += 1) {
    for (let i = 0; i < pSubstGroup.tBox.nWidth; i += 1) {
      let nWallFlags = 0
      if (pSubFile.pDrlgFile.nWallLayers) {
        nWallFlags = DRLGGRID_GetGridEntry(
          pSubFile.pWallGrid[0],
          a6 + pSubstGroup.tBox.nPosX + i,
          pSubstGroup.tBox.nPosY + j,
        )
      }

      let nFloorFlags = 0
      if (pSubFile.pDrlgFile.nFloorLayers) {
        nFloorFlags = DRLGGRID_GetGridEntry(
          pSubFile.pFloorGrid,
          a6 + pSubstGroup.tBox.nPosX + i,
          pSubstGroup.tBox.nPosY + j,
        )
      }

      const nCellX = i32(v21 + Math.imul(i, pLvlSubTxtRecord.dwGridSize))
      const nCellY = i32(v25 + Math.imul(j, pLvlSubTxtRecord.dwGridSize))

      if (nWallFlags & 1) {
        const v17 = byte1(nWallFlags) - 1
        let v18 = 0
        if (a3.field_28) {
          v18 = a3.field_28(a3.pLevel, (nWallFlags >>> 20) & 0x3f, byte1(nWallFlags))
        } else {
          v18 = i32(v17 + a3.nLevelPrestId)
        }

        if (v18 !== -5 && v17 !== a3.field_14) {
          a3.field_34!(a3.pLevel, nCellX, nCellY, v18, 0, true)
        }
      } else {
        if (nFloorFlags & 2) {
          a3.field_2C!(a3.pLevel, nCellX, nCellY)
        } else {
          a3.field_30!(a3.pLevel, nCellX, nCellY)
        }
      }
    }
  }
}

//D2Common.0x6FD8AA80
export function sub_6FD8AA80(a1: D2UnkOutdoorStrc2): void {
  if (a1.nSubWaypoint_Shrine !== -1) {
    const env = a1.pDrlgRoom.pLevel.pDrlg.env
    const lvlSub = env.tables.lvlSub
    let recIdx = DATATBLS_GetLvlSubTxtRecordIndex(env.tables, a1.nSubWaypoint_Shrine)
    let nThemeFlag = a1.nSubThemePicked >>> 0
    while (nThemeFlag) {
      if (recIdx >= lvlSub.length) {
        throw new Error(`sub_6FD8AA80: recIdx ${recIdx} out of bounds`)
      }
      const pLvlSubTxtRecord = lvlSub[recIdx]!
      if (nThemeFlag & 1) {
        const pSubFile = DRLGTILESUB_InitializeDrlgFile(env, pLvlSubTxtRecord)

        if (pLvlSubTxtRecord.dwCheckAll) {
          for (let nCurSubstGroupIndex = 0; nCurSubstGroupIndex < pSubFile.pDrlgFile.nSubstGroups; nCurSubstGroupIndex += 1) {
            const pSubstGroup = pSubFile.pDrlgFile.pSubstGroups[nCurSubstGroupIndex]!
            const nWidth = i32(a1.pDrlgRoom.pDrlgCoord.nWidth - pSubstGroup.tBox.nWidth + 1)
            const nHeight = i32(a1.pDrlgRoom.pDrlgCoord.nHeight - pSubstGroup.tBox.nHeight + 1)
            if (nWidth > 0 && nHeight > 0) {
              if (pSubFile.pDrlgFile.nSubstMethod === DRLGSUBST_FIXED) {
                for (let j = 1; j < nHeight; j += 1) {
                  for (let i = 1; i < nWidth; i += 1) {
                    if (sub_6FD8B010(i, j, a1, pSubstGroup, pLvlSubTxtRecord, pSubFile)) {
                      sub_6FD8ACE0(i, j, a1, pSubstGroup, pLvlSubTxtRecord, pSubFile, 0)
                    }
                  }
                }
              } else if (pSubFile.pDrlgFile.nSubstMethod === DRLGSUBST_RANDOM) {
                for (let j = 0; j < nHeight; j += 1) {
                  for (let i = 0; i < nWidth; i += 1) {
                    if (
                      sub_6FD8B130(i, j, a1, pSubstGroup, pLvlSubTxtRecord, pSubFile) &&
                      (pLvlSubTxtRecord.nProb[a1.nSubTheme]! >>> 0) <
                        (SEED_RollRandomNumber(a1.pDrlgRoom.pSeed) >>> 0) % 100
                    ) {
                      const nRand = SEED_RollLimitedRandomNumber(a1.pDrlgRoom.pSeed, pSubstGroup.field_14)
                      sub_6FD8ACE0(
                        i,
                        j,
                        a1,
                        pSubstGroup,
                        pLvlSubTxtRecord,
                        pSubFile,
                        Math.imul(i32(nRand + 1), i32(pSubstGroup.tBox.nWidth + 1)),
                      )
                    }
                  }
                }
              }
            }
          }
        } else {
          DRLGTILESUB_DoSubstitutions(a1, pLvlSubTxtRecord, pSubFile)
        }
      }

      nThemeFlag >>>= 1
      recIdx += 1
    }
  }
}

//D2Common.0x6FD8ACE0
export function sub_6FD8ACE0(
  nX: number,
  nY: number,
  a4: D2UnkOutdoorStrc2,
  pSubstGroup: D2DrlgSubstGroupStrc,
  pLvlSubTxtRecord: LvlSubRecord,
  pSubFile: D2LvlSubFileStrc = DRLGTILESUB_InitializeDrlgFile(a4.pDrlgRoom.pLevel.pDrlg.env, pLvlSubTxtRecord),
  a7 = 0,
): void {
  let nCounter = 0

  for (let j = 0; j < pSubstGroup.tBox.nHeight; j += 1) {
    for (let i = 0; i < pSubstGroup.tBox.nWidth; i += 1) {
      if (
        pSubFile.pShadowGrid.pCellsFlags &&
        DRLGGRID_GetGridEntry(pSubFile.pShadowGrid, i + pSubstGroup.tBox.nPosX + a7, j + pSubstGroup.tBox.nPosY) &
          0x8000000
      ) {
        nCounter += 1
      }
    }
  }

  DRLGROOMTILE_ReallocRoofTileGrid(a4.pDrlgRoom, nCounter)

  for (let j = 0; j < pSubstGroup.tBox.nHeight; j += 1) {
    for (let i = 0; i < pSubstGroup.tBox.nWidth; i += 1) {
      let nFlags = 0
      if (pSubFile.pDrlgFile.nFloorLayers) {
        nFlags = DRLGGRID_GetGridEntry(
          pSubFile.pFloorGrid,
          i + pSubstGroup.tBox.nPosX + a7,
          j + pSubstGroup.tBox.nPosY,
        )
      }

      if (nFlags & 2) {
        nFlags |= 0x80
        DRLGGRID_AlterGridFlag(a4.pFloorGrid!, nX + i, nY + j, nFlags, FLAG_OPERATION_OVERWRITE)
      }

      if (pSubFile.pDrlgFile.nWallLayers > DRLG_MAX_WALL_LAYERS) {
        throw new Error('sub_6FD8ACE0: nWallLayers > DRLG_MAX_WALL_LAYERS')
      }
      for (let nLayer = 0; nLayer < pSubFile.pDrlgFile.nWallLayers; nLayer += 1) {
        nFlags = DRLGGRID_GetGridEntry(
          pSubFile.pWallGrid[nLayer]!,
          i + pSubstGroup.tBox.nPosX + a7,
          j + pSubstGroup.tBox.nPosY,
        )
        if (nFlags & 1 && a4.pWallsGrids[nLayer]) {
          DRLGGRID_AlterGridFlag(a4.pWallsGrids[nLayer]!, nX + i, nY + j, nFlags, FLAG_OPERATION_OVERWRITE)
        }

        nFlags = DRLGGRID_GetGridEntry(
          pSubFile.pTileTypeGrid[nLayer]!,
          i + pSubstGroup.tBox.nPosX + a7,
          j + pSubstGroup.tBox.nPosY,
        )
        if (nFlags && a4.pOutdoorRooms[nLayer]) {
          DRLGGRID_AlterGridFlag(
            a4.pOutdoorRooms[nLayer]!.pTileTypeGrid,
            nX + i,
            nY + j,
            nFlags,
            FLAG_OPERATION_OVERWRITE,
          )
        }
      }

      nFlags = pSubFile.pShadowGrid.pCellsFlags
        ? DRLGGRID_GetGridEntry(pSubFile.pShadowGrid, i + pSubstGroup.tBox.nPosX + a7, j + pSubstGroup.tBox.nPosY)
        : 0
      if (nFlags & 0x8000000) {
        DRLGROOMTILE_InitTileShadow(
          a4.pDrlgRoom,
          nX + i + a4.pDrlgRoom.pDrlgCoord.nPosX,
          nY + j + a4.pDrlgRoom.pDrlgCoord.nPosY,
          nFlags >>> 0,
        )
      }
    }
  }

  const subXY = DUNGEON_GameTileToSubtileCoords(nX, nY)
  const subMin = DUNGEON_GameTileToSubtileCoords(pSubstGroup.tBox.nPosX, pSubstGroup.tBox.nPosY)
  const subMax = DUNGEON_GameTileToSubtileCoords(pSubstGroup.tBox.nWidth, pSubstGroup.tBox.nHeight)
  const nSubX = subXY.nX
  const nSubY = subXY.nY
  const nMinX = subMin.nX
  const nMinY = subMin.nY
  const nMaxX = subMax.nX
  const nMaxY = subMax.nY

  for (let pPresetUnit = pSubFile.pDrlgFile.pPresetUnit; pPresetUnit; pPresetUnit = pPresetUnit.pNext) {
    if (
      pPresetUnit.nXpos > nMinX &&
      pPresetUnit.nXpos < nMinX + nMaxX &&
      pPresetUnit.nYpos > nMinY &&
      pPresetUnit.nYpos < nMinY + nMaxY
    ) {
      DRLGROOM_AllocPresetUnit(
        a4.pDrlgRoom,
        pPresetUnit.nUnitType,
        pPresetUnit.nIndex,
        pPresetUnit.nMode,
        nSubX + pPresetUnit.nXpos - nMinX,
        nSubY + pPresetUnit.nYpos - nMinY,
      )
    }
  }
}

//D2Common.0x6FD8B010
export function sub_6FD8B010(
  a1: number,
  a2: number,
  a3: D2UnkOutdoorStrc2,
  pSubstGroup: D2DrlgSubstGroupStrc,
  pLvlSubTxtRecord: LvlSubRecord,
  pSubFile: D2LvlSubFileStrc = DRLGTILESUB_InitializeDrlgFile(a3.pDrlgRoom.pLevel.pDrlg.env, pLvlSubTxtRecord),
): boolean {
  for (let j = 0; j < pSubstGroup.tBox.nHeight; j += 1) {
    for (let i = 0; i < pSubstGroup.tBox.nWidth; i += 1) {
      const bFloorSub =
        pSubFile.pFloorGrid.pCellsFlags !== null &&
        (DRLGGRID_GetGridEntry(pSubFile.pFloorGrid, i + pSubstGroup.tBox.nPosX, j + pSubstGroup.tBox.nPosY) & 2) !== 0
      const bWallSub =
        pSubFile.pWallGrid[0].nWidth !== 0 &&
        (DRLGGRID_GetGridEntry(pSubFile.pWallGrid[0], i + pSubstGroup.tBox.nPosX, j + pSubstGroup.tBox.nPosY) & 1) !== 0
      if (bFloorSub || bWallSub) {
        const nFlags = DRLGGRID_GetGridEntry(a3.pFloorGrid!, a1 + i, a2 + j)
        if (nFlags & 0x3f0ff00 || !(nFlags & 2)) {
          return false
        }

        for (let nLayer = 0; nLayer < a3.field_2C; nLayer += 1) {
          if (a3.pWallsGrids[nLayer] && DRLGGRID_GetGridEntry(a3.pWallsGrids[nLayer]!, a1 + i, a2 + j) & 1) {
            return false
          }
        }
      }
    }
  }

  return true
}

//D2Common.0x6FD8B130
export function sub_6FD8B130(
  a1: number,
  a2: number,
  a3: D2UnkOutdoorStrc2,
  pSubstGroup: D2DrlgSubstGroupStrc,
  pLvlSubTxtRecord: LvlSubRecord,
  pSubFile: D2LvlSubFileStrc = DRLGTILESUB_InitializeDrlgFile(a3.pDrlgRoom.pLevel.pDrlg.env, pLvlSubTxtRecord),
): boolean {
  for (let j = 0; j < pSubstGroup.tBox.nHeight; j += 1) {
    for (let i = 0; i < pSubstGroup.tBox.nWidth; i += 1) {
      const nTileType = DRLGGRID_GetGridEntry(
        pSubFile.pTileTypeGrid[0],
        i + pSubstGroup.tBox.nPosX,
        j + pSubstGroup.tBox.nPosY,
      )
      if (nTileType !== DRLGGRID_GetGridEntry(a3.pOutdoorRooms[0]!.pTileTypeGrid, i + a1, j + a2)) {
        return false
      }

      let nFloorFlags1 = 0
      if (pSubFile.pDrlgFile.nFloorLayers) {
        nFloorFlags1 = DRLGGRID_GetGridEntry(
          pSubFile.pFloorGrid,
          i + pSubstGroup.tBox.nPosX,
          j + pSubstGroup.tBox.nPosY,
        )
      }

      if (nFloorFlags1 & 2) {
        const nFloorFlags2 = DRLGGRID_GetGridEntry(a3.pFloorGrid!, i + a1, j + a2)
        if (!(nFloorFlags2 & 2)) {
          return false
        }

        if ((nFloorFlags1 ^ nFloorFlags2) & 0x3f0ff00) {
          return false
        }
      }

      let nWallFlags1 = 0
      if (pSubFile.pDrlgFile.nWallLayers) {
        nWallFlags1 = DRLGGRID_GetGridEntry(
          pSubFile.pWallGrid[0],
          i + pSubstGroup.tBox.nPosX,
          j + pSubstGroup.tBox.nPosY,
        )
      }

      if (nWallFlags1 & 1) {
        const nWallFlags2 = DRLGGRID_GetGridEntry(a3.pWallsGrids[0]!, i + a1, j + a2)
        if (!(nWallFlags2 & 1)) {
          return false
        }

        if ((nWallFlags1 ^ nWallFlags2) & 0x3f0ff00) {
          return false
        }
      }
    }
  }

  return true
}

//D2Common.0x6FD8B290
export function DRLGTILESUB_DoSubstitutions(
  pOutdoorLevel: D2UnkOutdoorStrc2,
  pLvlSubTxtRecord: LvlSubRecord,
  pSubFile: D2LvlSubFileStrc = DRLGTILESUB_InitializeDrlgFile(
    pOutdoorLevel.pDrlgRoom.pLevel.pDrlg.env,
    pLvlSubTxtRecord,
  ),
): void {
  if (!pSubFile.pDrlgFile.nSubstGroups) {
    return
  }
  const pCoordX = new Int32Array(256)
  const pCoordY = new Int32Array(256)

  for (let xyz = 0; xyz < pLvlSubTxtRecord.nMax[pOutdoorLevel.nSubTheme]!; xyz += 1) {
    const substGroupIdx = SEED_RollLimitedRandomNumber(
      pOutdoorLevel.pDrlgRoom.pSeed,
      pSubFile.pDrlgFile.nSubstGroups,
    )
    const pSubstGroup = pSubFile.pDrlgFile.pSubstGroups[substGroupIdx]!

    const nAvailableSpaceX = i32(pOutdoorLevel.pDrlgRoom.pDrlgCoord.nWidth - pSubstGroup.tBox.nWidth)
    const nAvailableSpaceY = i32(pOutdoorLevel.pDrlgRoom.pDrlgCoord.nHeight - pSubstGroup.tBox.nHeight)
    if (nAvailableSpaceX > 0 && nAvailableSpaceY > 0) {
      const nTrials = pLvlSubTxtRecord.nTrials[pOutdoorLevel.nSubTheme]!
      if (nTrials !== -1) {
        for (let i = 0; i < nTrials; i += 1) {
          const nX = i32(SEED_RollLimitedRandomNumber(pOutdoorLevel.pDrlgRoom.pSeed, nAvailableSpaceX) + 1)
          const nY = i32(SEED_RollLimitedRandomNumber(pOutdoorLevel.pDrlgRoom.pSeed, nAvailableSpaceY) + 1)
          if (sub_6FD8B010(nX, nY, pOutdoorLevel, pSubstGroup, pLvlSubTxtRecord, pSubFile)) {
            sub_6FD8ACE0(nX, nY, pOutdoorLevel, pSubstGroup, pLvlSubTxtRecord, pSubFile, 0)
            break
          }
        }
      } else {
        const nPotentialPositionsArea = Math.imul(nAvailableSpaceX, nAvailableSpaceY)
        if (nPotentialPositionsArea > 256) {
          throw new Error(
            `DRLGTILESUB_DoSubstitutions: nPotentialPositionsArea ${nPotentialPositionsArea} exceeds D2CoordStrc tCoords[256]`,
          )
        }
        for (let i = 0; i < nPotentialPositionsArea; i += 1) {
          pCoordX[i] = imod(i, nAvailableSpaceX)
          pCoordY[i] = idiv(i, nAvailableSpaceX)
        }

        for (let i = 0; i < nPotentialPositionsArea; i += 1) {
          const nRand1 = SEED_RollLimitedRandomNumber(pOutdoorLevel.pDrlgRoom.pSeed, nPotentialPositionsArea) >>> 0
          const nRand2 = SEED_RollLimitedRandomNumber(pOutdoorLevel.pDrlgRoom.pSeed, nPotentialPositionsArea) >>> 0

          const nTemp1 = pCoordX[nRand1]!
          const nTemp2 = pCoordY[nRand1]!
          pCoordX[nRand1] = pCoordX[nRand2]!
          pCoordY[nRand1] = pCoordY[nRand2]!
          pCoordX[nRand2] = nTemp1
          pCoordY[nRand2] = nTemp2
        }

        for (let i = 0; i < nPotentialPositionsArea; i += 1) {
          const nX = pCoordX[i]! + 1
          const nY = pCoordY[i]! + 1
          if (sub_6FD8B010(nX, nY, pOutdoorLevel, pSubstGroup, pLvlSubTxtRecord, pSubFile)) {
            sub_6FD8ACE0(nX, nY, pOutdoorLevel, pSubstGroup, pLvlSubTxtRecord, pSubFile, 0)
            break
          }
        }
      }
    }
  }
}

//D2Common.0x6FD8B640
export function DRLGTILESUB_InitializeDrlgFile(env: DrlgEnv, pLvlSubTxtRecord: LvlSubRecord): D2LvlSubFileStrc {
  const existing = env.lvlSubFiles.get(pLvlSubTxtRecord.index)
  if (existing) return existing

  const pDrlgFile = DRLGPRESET_LoadDrlgFile(env, pLvlSubTxtRecord.szFile)

  const pDrlgCoord = newCoord()
  pDrlgCoord.nPosX = 0
  pDrlgCoord.nPosY = 0
  pDrlgCoord.nWidth = pDrlgFile.nWidth + 1
  pDrlgCoord.nHeight = pDrlgFile.nHeight + 1

  if (!pDrlgFile.nSubstGroups) {
    throw new Error('FOG_DisplayWarning: Substitution File was not saved with substitution groups')
  }

  const pSubFile: D2LvlSubFileStrc = {
    pDrlgFile,
    pTileTypeGrid: [newGrid(), newGrid(), newGrid(), newGrid()],
    pWallGrid: [newGrid(), newGrid(), newGrid(), newGrid()],
    pFloorGrid: newGrid(),
    pShadowGrid: newGrid(),
  }

  for (let i = 0; i < pDrlgFile.nWallLayers; i += 1) {
    DRLGGRID_FillNewCellFlags(pSubFile.pWallGrid[i]!, pDrlgFile.pWallLayer[i]!, 0, pDrlgCoord, pDrlgCoord.nWidth)
    DRLGGRID_FillNewCellFlags(
      pSubFile.pTileTypeGrid[i]!,
      pDrlgFile.pTileTypeLayer[i]!,
      0,
      pDrlgCoord,
      pDrlgCoord.nWidth,
    )
  }

  for (let i = 1; i < pDrlgFile.nWallLayers; i += 1) {
    DRLGGRID_AlterAllGridFlags(pSubFile.pWallGrid[i]!, i << 18, FLAG_OPERATION_OR)
  }

  if (pDrlgFile.nFloorLayers) {
    DRLGGRID_FillNewCellFlags(pSubFile.pFloorGrid, pDrlgFile.pFloorLayer[0]!, 0, pDrlgCoord, pDrlgCoord.nWidth)
  }

  if (pDrlgFile.pShadowLayer) {
    DRLGGRID_FillNewCellFlags(pSubFile.pShadowGrid, pDrlgFile.pShadowLayer, 0, pDrlgCoord, pDrlgCoord.nWidth)
  }

  env.lvlSubFiles.set(pLvlSubTxtRecord.index, pSubFile)
  return pSubFile
}

//D2Common.0x6FD8B7E0
export function DRLGTILESUB_PickSubThemes(pDrlgRoom: D2DrlgRoomStrc, nSubType: number, nSubTheme: number): number {
  let nCounter = 0
  let nMask = 0

  if (nSubType !== -1 && nSubTheme !== -1) {
    const lvlSub = pDrlgRoom.pLevel.pDrlg.env.tables.lvlSub
    let recIdx = DATATBLS_GetLvlSubTxtRecordIndex(pDrlgRoom.pLevel.pDrlg.env.tables, nSubType)
    while (recIdx < lvlSub.length && lvlSub[recIdx]!.dwType === nSubType) {
      const pLvlSubTxtRecord = lvlSub[recIdx]!
      if ((SEED_RollRandomNumber(pDrlgRoom.pSeed) >>> 0) % 100 < (pLvlSubTxtRecord.nProb[nSubTheme]! >>> 0)) {
        nMask |= 1 << nCounter
        pDrlgRoom.dwDT1Mask = (pDrlgRoom.dwDT1Mask | pLvlSubTxtRecord.dwDt1Mask) >>> 0
      }

      recIdx += 1
      nCounter += 1
    }

    return nMask
  }

  return 0
}
