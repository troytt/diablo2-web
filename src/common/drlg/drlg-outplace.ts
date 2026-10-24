/**
 * 1:1 TypeScript port of the Act I reachable functions and lookup tables of D2MOO
 * `source/D2Common/src/Drlg/DrlgOutPlace.cpp`.
 *
 * Note: `DRLGOUTPLACE_CreateLevelConnections` and its link callbacks live in `./drlg-act-links.ts`.
 */

import { DRLG_GetActNoFromLevelId } from './drlg-drlg.ts'
import {
  DRLGGRID_AlterEdgeGridFlags,
  DRLGGRID_AlterGridFlag,
  DRLGGRID_GetGridEntry,
  DRLGGRID_InitializeGridCells,
  sub_6FD75DE0,
} from './drlg-grid.ts'
import {
  LVLPREST_ACT1_WILD_BORDER_1,
  LVLPREST_ACT1_WILD_BORDER_2,
  LVLPREST_ACT1_WILD_BORDER_3,
  LVLPREST_ACT1_WILD_BORDER_4,
  LVLPREST_ACT1_WILD_BORDER_5,
  LVLPREST_ACT1_WILD_BORDER_6,
  LVLPREST_ACT1_WILD_BORDER_7,
  LVLPREST_ACT1_WILD_BORDER_8,
  LVLPREST_ACT1_WILD_BORDER_9,
  LVLPREST_ACT1_WILD_BORDER_10,
  LVLPREST_ACT1_WILD_BORDER_11,
  LVLPREST_ACT1_WILD_BORDER_12,
  LVLPREST_ACT1_WILD_CLIFF_BORDER_2,
  LVLPREST_ACT1_WILD_CLIFF_BORDER_3,
  LVLPREST_ACT1_WILD_CLIFF_BORDER_5,
  LVLPREST_ACT1_WILD_CLIFF_BORDER_6A,
  LVLPREST_ACT1_WILD_CLIFF_BORDER_6B,
  LVLPREST_ACT1_WILD_CLIFF_BORDER_6C,
  LVLPREST_ACT1_WILD_CLIFF_BORDER_7,
  LVLPREST_ACT1_WILD_CLIFF_BORDER_10,
  LVLPREST_ACT2_DESERT_BORDER_1,
  LVLPREST_ACT2_DESERT_BORDER_2,
  LVLPREST_ACT2_DESERT_BORDER_3,
  LVLPREST_ACT2_DESERT_BORDER_4,
  LVLPREST_ACT2_DESERT_BORDER_5,
  LVLPREST_ACT2_DESERT_BORDER_6,
  LVLPREST_ACT2_DESERT_BORDER_7,
  LVLPREST_ACT2_DESERT_BORDER_8,
  LVLPREST_ACT2_DESERT_BORDER_9,
  LVLPREST_ACT2_DESERT_BORDER_10,
  LVLPREST_ACT2_DESERT_BORDER_11,
  LVLPREST_ACT2_DESERT_BORDER_12,
  LVLPREST_ACT3_BRIDGE,
  LVLPREST_ACT3_BURBS_08X08,
  LVLPREST_ACT3_BURBS_08X16,
  LVLPREST_ACT3_BURBS_16X08,
  LVLPREST_ACT3_BURBS_16X16,
  LVLPREST_ACT3_BURBS_SEWER,
  LVLPREST_ACT3_BURBS_TEMPLE,
  LVLPREST_ACT3_BURBS_WAYPOINT,
  LVLPREST_ACT3_METRO_08X08,
  LVLPREST_ACT3_METRO_08X16,
  LVLPREST_ACT3_METRO_16X08,
  LVLPREST_ACT3_METRO_16X16,
  LVLPREST_ACT3_METRO_SEWER,
  LVLPREST_ACT3_METROTEMPLE,
  LVLPREST_ACT3_SLUMS_08X08,
  LVLPREST_ACT3_SLUMS_08X16,
  LVLPREST_ACT3_SLUMS_16X08,
  LVLPREST_ACT3_SLUMS_16X16,
  LVLPREST_ACT3_TRAVINCAL_N,
  LVLPREST_ACT3_TRAVINCAL_NE,
  LVLPREST_ACT3_TRAVINCAL_NW,
  LVLPREST_ACT3_TRAVINCAL_S,
  LVLPREST_ACT3_TRAVINCAL_SE,
  LVLPREST_ACT3_TRAVINCAL_SW,
  LVLPREST_ACT4_MESA_BORDER_1,
  LVLPREST_ACT4_MESA_BORDER_2,
  LVLPREST_ACT4_MESA_BORDER_3,
  LVLPREST_ACT4_MESA_BORDER_4,
  LVLPREST_ACT4_MESA_BORDER_5,
  LVLPREST_ACT4_MESA_BORDER_6,
  LVLPREST_ACT4_MESA_BORDER_7,
  LVLPREST_ACT4_MESA_BORDER_8,
  LVLPREST_ACT4_MESA_BORDER_9,
  LVLPREST_ACT4_MESA_BORDER_10,
  LVLPREST_ACT4_MESA_BORDER_11,
  LVLPREST_ACT4_MESA_BORDER_12,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_1,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_1_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_2,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_2_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_3,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_3_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_4,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_4_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_5,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_5_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_6,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_6_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_7,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_7_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_8,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_8_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_9,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_9_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_10,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_10_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_11,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_11_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_12,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_12_SNOW,
  LVLPREST_NONE,
  LVLTYPE_ACT1_WILDERNESS,
  LVLTYPE_ACT2_DESERT,
  LVLTYPE_ACT3_JUNGLE,
  LVLTYPE_ACT3_KURAST,
  LVLTYPE_ACT4_LAVA,
  LVLTYPE_ACT4_MESA,
  LVLTYPE_ACT5_BARRICADE,
} from './drlg-ids.ts'
import {
  DRLG_OUTDOORS_GenerateDirtPath,
  DRLGOUTDOORS_GetOutLinkVisFlag,
  DRLGOUTDOORS_GetPackedGrid2Info,
  DRLGOUTDOORS_SpawnOutdoorLevelPreset,
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx,
} from './drlg-outdoors.ts'
import {
  DRLGOUTJUNG_BuildJungle,
  DRLGOUTJUNG_BuildKurastBazaar,
  DRLGOUTJUNG_BuildLowerKurast,
  DRLGOUTJUNG_BuildUpperKurast,
  DRLGOUTJUNG_SpawnRandomPreset,
} from './drlg-outjung.ts'
import { sub_6FD84100 } from './drlg-outsiege.ts'
import { DRLGROOM_AddRoomExToLevel, DRLGROOM_AllocRoomEx, DRLGROOM_AreXYInsideCoordinates } from './drlg-room.ts'
import { DRLGROOMTILE_AllocTileGrid } from './drlg-roomtile.ts'
import { DATATBLS_GetLevelDefRecord } from './drlg-tables.ts'
import { type D2UnkOutdoorStrc2, DRLGTILESUB_PickSubThemes, sub_6FD8AA80 } from './drlg-tilesub.ts'
import {
  ACT_I,
  ACT_II,
  ACT_IV,
  ACT_V,
  type D2DrlgCoordStrc,
  type D2DrlgLevelStrc,
  type D2DrlgRoomStrc,
  type D2DrlgVertexStrc,
  DRLGROOMFLAG_HAS_WAYPOINT_FIRST_BIT,
  DRLGROOMFLAG_HAS_WAYPOINT_MASK,
  DRLGROOMFLAG_NO_LOS_DRAW,
  DRLGROOMFLAG_SUBSHRINE_ROWS_FIRST_BIT,
  DRLGROOMFLAG_SUBSHRINE_ROWS_MASK,
  DRLGTYPE_MAZE,
  FLAG_OPERATION_AND_NEGATED,
  FLAG_OPERATION_OR,
  FLAG_OPERATION_OVERWRITE,
  GRID2_HAS_DIRECTION,
  GRID2_HAS_PICKED_FILE,
  GRID2_LVL_LINK,
  GRID2_PICKED_FILE_MASK,
  GRID2_UNKB00,
  GRID2_UNKB08,
  grid2PickedFileBits,
  i32,
  idiv,
  LEVEL_BURIALGROUNDS,
  LEVEL_KURASTBAZAAR,
  LEVEL_KURASTCAUSEWAY,
  LEVEL_LOWERKURAST,
  LEVEL_TRAVINCAL,
  LEVEL_TUNDRAWASTELANDS,
  LEVEL_UPPERKURAST,
} from './drlg-types.ts'
import { DRLGVER_AllocVertex, DRLGVER_GetCoordDiff } from './drlg-vertex.ts'
import { sub_6FDAB750 } from './path-dir.ts'

const gnBarricadeCliffBorderIds: readonly (readonly [number, number])[] = [
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_1, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_1_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_2, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_2_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_3, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_3_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_4, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_4_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_5, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_5_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_6, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_6_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_7, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_7_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_8, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_8_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_9, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_9_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_10, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_10_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_11, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_11_SNOW],
  [LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_12, LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_12_SNOW],
  [-1, 1],
  [-1, 0],
]

//D2Common.0x6FD80480
export function DRLGOUTPLACE_BuildKurast(pLevel: D2DrlgLevelStrc): void {
  switch (pLevel.nLevelId) {
    case LEVEL_LOWERKURAST:
      DRLGOUTJUNG_BuildLowerKurast(pLevel)
      break

    case LEVEL_KURASTBAZAAR:
      DRLGOUTJUNG_BuildKurastBazaar(pLevel)
      break

    case LEVEL_UPPERKURAST:
      DRLGOUTJUNG_BuildUpperKurast(pLevel)
      break

    default:
      break
  }

  switch (pLevel.nLevelId) {
    case LEVEL_LOWERKURAST:
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT3_BURBS_WAYPOINT, 0, 0, 15)
      DRLGOUTJUNG_SpawnRandomPreset(pLevel, LVLPREST_ACT3_SLUMS_16X16, LVLPREST_ACT3_SLUMS_16X16, 4)
      DRLGOUTJUNG_SpawnRandomPreset(pLevel, LVLPREST_ACT3_SLUMS_08X16, LVLPREST_ACT3_SLUMS_16X08, 0)
      DRLGOUTJUNG_SpawnRandomPreset(pLevel, LVLPREST_ACT3_SLUMS_08X08, LVLPREST_ACT3_SLUMS_08X08, 0)
      break

    case LEVEL_KURASTBAZAAR:
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 3, 3, LVLPREST_ACT3_BURBS_SEWER, 0, false)
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
        pLevel,
        idiv(pLevel.pLevelCoords.nWidth, 8) - 4,
        3,
        LVLPREST_ACT3_BURBS_SEWER,
        1,
        false,
      )
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT3_BURBS_TEMPLE, 0, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT3_BURBS_TEMPLE, 1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT3_BURBS_WAYPOINT, 0, 0, 15)
      DRLGOUTJUNG_SpawnRandomPreset(pLevel, LVLPREST_ACT3_BURBS_16X16, LVLPREST_ACT3_BURBS_16X16, 4)
      DRLGOUTJUNG_SpawnRandomPreset(pLevel, LVLPREST_ACT3_BURBS_08X16, LVLPREST_ACT3_BURBS_16X08, 0)
      DRLGOUTJUNG_SpawnRandomPreset(pLevel, LVLPREST_ACT3_BURBS_08X08, LVLPREST_ACT3_BURBS_08X08, 0)
      break

    case LEVEL_UPPERKURAST:
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
        pLevel,
        3,
        idiv(pLevel.pLevelCoords.nHeight, 8) - 4,
        LVLPREST_ACT3_METRO_SEWER,
        0,
        false,
      )
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
        pLevel,
        idiv(pLevel.pLevelCoords.nWidth, 8) - 4,
        idiv(pLevel.pLevelCoords.nHeight, 8) - 4,
        LVLPREST_ACT3_METRO_SEWER,
        1,
        false,
      )
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT3_METROTEMPLE, 0, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT3_METROTEMPLE, 1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT3_BURBS_WAYPOINT, 0, 0, 15)
      DRLGOUTJUNG_SpawnRandomPreset(pLevel, LVLPREST_ACT3_METRO_16X16, LVLPREST_ACT3_METRO_16X16, 4)
      DRLGOUTJUNG_SpawnRandomPreset(pLevel, LVLPREST_ACT3_METRO_08X16, LVLPREST_ACT3_METRO_16X08, 0)
      DRLGOUTJUNG_SpawnRandomPreset(pLevel, LVLPREST_ACT3_METRO_08X08, LVLPREST_ACT3_METRO_08X08, 0)
      break

    case LEVEL_KURASTCAUSEWAY:
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, 0, LVLPREST_ACT3_BRIDGE, 0, false)
      break

    default:
      return
  }
}

//D2Common.0x6FD806A0
export function DRLGOUTPLACE_InitAct3OutdoorLevel(pLevel: D2DrlgLevelStrc): void {
  DRLGOUTPLACE_SetOutGridLinkFlags(pLevel)
  DRLGOUTJUNG_BuildJungle(pLevel)
  DRLGOUTPLACE_BuildKurast(pLevel)

  if (pLevel.nLevelId === LEVEL_TRAVINCAL) {
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, 0, LVLPREST_ACT3_TRAVINCAL_NW, -1, false)
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 2, 0, LVLPREST_ACT3_TRAVINCAL_N, -1, false)
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 6, 0, LVLPREST_ACT3_TRAVINCAL_NE, -1, false)
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, 4, LVLPREST_ACT3_TRAVINCAL_SW, -1, false)
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 2, 4, LVLPREST_ACT3_TRAVINCAL_S, -1, false)
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 6, 4, LVLPREST_ACT3_TRAVINCAL_SE, -1, false)
  }
}

interface D2UnkOutPlaceStrc12 {
  field_0: number
  field_4: number
  field_8: number
  nX: number
  nY: number
  field_14: number
  /** Index into byte_6FDCFB70 (C: uint8_t* field_18). */
  field_18: number
  nIndex: number
  pNext: D2UnkOutPlaceStrc12 | null
  field_24: D2UnkOutPlaceStrc12 | null
}

function newOutPlaceNode(): D2UnkOutPlaceStrc12 {
  return {
    field_0: 0,
    field_4: 0,
    field_8: 0,
    nX: 0,
    nY: 0,
    field_14: 0,
    field_18: 0,
    nIndex: 0,
    pNext: null,
    field_24: null,
  }
}

function resetOutPlaceNode(node: D2UnkOutPlaceStrc12): void {
  node.field_0 = 0
  node.field_4 = 0
  node.field_8 = 0
  node.nX = 0
  node.nY = 0
  node.field_14 = 0
  node.field_18 = 0
  node.nIndex = 0
  node.pNext = null
  node.field_24 = null
}

function copyOutPlaceNode(dst: D2UnkOutPlaceStrc12, src: D2UnkOutPlaceStrc12): void {
  dst.field_0 = src.field_0
  dst.field_4 = src.field_4
  dst.field_8 = src.field_8
  dst.nX = src.nX
  dst.nY = src.nY
  dst.field_14 = src.field_14
  dst.field_18 = src.field_18
  dst.nIndex = src.nIndex
  dst.pNext = src.pNext
  dst.field_24 = src.field_24
}

const byte_6FDCFB70: readonly number[] = [
  0, 1, 2, 3,
  0, 1, 1, 1,
  3, 2, 1, 2,
  0, 3, 2, 1,
]

const byte_6FDCFB80: readonly number[] = [1, 0, -1, 0]
const byte_6FDCFB84: readonly number[] = [0, 1, 0, -1]

function readByte6FDCFB70(idx: number): number {
  if (idx < 0 || idx >= byte_6FDCFB70.length) {
    throw new Error(`sub_6FD80750: byte_6FDCFB70 index ${idx} out of bounds`)
  }
  return byte_6FDCFB70[idx]!
}

//D2Common.0x6FD80750
export function sub_6FD80750(pLevel: D2DrlgLevelStrc, nVertexId: number): boolean {
  const pOutdoors = pLevel.pOutdoors!
  const nX1 = idiv(i32(pOutdoors.pVertices[6 + nVertexId]!.nPosX - pLevel.pLevelCoords.nPosX), 8)
  const nY1 = idiv(i32(pOutdoors.pVertices[6 + nVertexId]!.nPosY - pLevel.pLevelCoords.nPosY), 8)

  const nX2 = idiv(i32(pOutdoors.pVertices[12 + nVertexId]!.nPosX - pLevel.pLevelCoords.nPosX), 8)
  const nY2 = idiv(i32(pOutdoors.pVertices[12 + nVertexId]!.nPosY - pLevel.pLevelCoords.nPosY), 8)

  let nXDiff = i32(nX1 - nX2)
  if (nXDiff < 0) {
    nXDiff = -nXDiff
  }

  let nYDiff = i32(nY1 - nY2)
  if (nYDiff < 0) {
    nYDiff = -nYDiff
  }

  if (nXDiff + nYDiff >= 2) {
    const v18 = idiv(sub_6FDAB750(nX1, nY1, nX2, nY2), 2)

    let nMin = 0
    let nMax = 0
    if (nXDiff < nYDiff) {
      nMin = nXDiff
      nMax = nYDiff
    } else {
      nMin = nYDiff
      nMax = nXDiff
    }

    // C allocates `tOutPlaceArray[900]` and pre-increments `nNextIdx` up to 900; slot 900 is only
    // reached right before the `nNextIdx >= 900` bailout.
    const tOutPlaceArray: D2UnkOutPlaceStrc12[] = Array.from({ length: 901 }, newOutPlaceNode)

    const tInitOutPlace = newOutPlaceNode()
    tInitOutPlace.field_0 = i32(nMin + 2 * nMax)
    tInitOutPlace.field_4 = tInitOutPlace.field_0
    tInitOutPlace.field_8 = 0
    tInitOutPlace.nX = nX1
    tInitOutPlace.nY = nY1
    tInitOutPlace.field_14 = -1
    tInitOutPlace.field_18 = 0
    tInitOutPlace.nIndex = v18 & 3
    tInitOutPlace.pNext = null
    tInitOutPlace.field_24 = null

    let v58 = i32(tInitOutPlace.field_4 + idiv(tInitOutPlace.field_4, 2))
    const v64 = i32(v58 + 35)

    const pOutdoorsCoord: D2DrlgCoordStrc = {
      nPosX: pOutdoors.nWidth,
      nPosY: pOutdoors.nHeight,
      nWidth: pOutdoors.nGridWidth,
      nHeight: pOutdoors.nGridHeight,
    }

    let pCurrentOutPlace: D2UnkOutPlaceStrc12 | null = null
    const pNextOutPlace = tOutPlaceArray[0]!

    let nNextIdx = 1
    let v29 = 0
    while (true) {
      copyOutPlaceNode(pNextOutPlace, tInitOutPlace)
      pCurrentOutPlace = pNextOutPlace

      while (pCurrentOutPlace && (pCurrentOutPlace.nX !== nX2 || pCurrentOutPlace.nY !== nY2)) {
        const nOffsetsIndex = pCurrentOutPlace.nIndex
        const nTestCoordX = i32(pCurrentOutPlace.nX + byte_6FDCFB80[nOffsetsIndex]!)
        const nTestCoordY = i32(pCurrentOutPlace.nY + byte_6FDCFB84[nOffsetsIndex]!)

        let bGotoLabel26 = false
        if (nTestCoordX === nX2 && nTestCoordY === nY2) {
          bGotoLabel26 = true
        } else {
          if (DRLGROOM_AreXYInsideCoordinates(pOutdoorsCoord, nTestCoordX, nTestCoordY)) {
            if (!(DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, nTestCoordX, nTestCoordY) & GRID2_HAS_PICKED_FILE)) {
              let v28: D2UnkOutPlaceStrc12 | null = pCurrentOutPlace
              while (v28 && (v28.nX !== nTestCoordX || v28.nY !== nTestCoordY)) {
                v28 = v28.pNext
              }
              if (!v28) {
                bGotoLabel26 = true
              }
            }
          }
        }

        if (bGotoLabel26) {
          v29 = 2
          if (pCurrentOutPlace.nX !== nTestCoordX && pCurrentOutPlace.nY !== nTestCoordY) {
            v29 = 3
          }

          const v30 = i32(v29 + pCurrentOutPlace.field_8)
          let v31 = i32(nTestCoordX - nX2)
          if (v31 < 0) {
            v31 = -v31
          }

          let v32 = i32(nTestCoordY - nY2)
          if (v32 < 0) {
            v32 = -v32
          }

          let v33 = v31
          if (v31 >= v32) {
            v33 = v32
            if (v31 > v32) {
              v32 = v31
            }
          }

          const v34 = i32(v33 + 2 * v32)
          const v35 = i32(v34 + v30)
          if (v35 <= v58) {
            if (!pCurrentOutPlace.field_24) {
              let v50: D2UnkOutPlaceStrc12 | null = null
              if (nNextIdx !== 900) {
                nNextIdx += 1
                v50 = tOutPlaceArray[nNextIdx]!
                resetOutPlaceNode(v50)
              }

              pCurrentOutPlace.field_24 = v50
              if (!v50) {
                pCurrentOutPlace = null
                break
              }
              v50.pNext = pCurrentOutPlace
            }

            pCurrentOutPlace = pCurrentOutPlace.field_24!

            pCurrentOutPlace.field_0 = v35
            pCurrentOutPlace.field_8 = v30
            pCurrentOutPlace.field_4 = v34
            pCurrentOutPlace.field_14 = 0
            const v53 = idiv(sub_6FDAB750(nTestCoordX, nTestCoordY, nX2, nY2), 2)
            pCurrentOutPlace.field_18 = 4 * ((pCurrentOutPlace.pNext!.nIndex - (v53 & 0xff)) & 3)
            pCurrentOutPlace.nX = nTestCoordX
            pCurrentOutPlace.nY = nTestCoordY
            pCurrentOutPlace.nIndex = (v53 + readByte6FDCFB70(pCurrentOutPlace.field_18)) & 3
            continue
          }
        }

        if (pCurrentOutPlace.field_14 < 4) {
          pCurrentOutPlace.field_18 += 1
          pCurrentOutPlace.nIndex = (pCurrentOutPlace.nIndex + readByte6FDCFB70(pCurrentOutPlace.field_18)) & 3
        }

        pCurrentOutPlace.field_14 += 1
        if (pCurrentOutPlace.field_14 === 3) {
          let bResumed = false
          while (pCurrentOutPlace && pCurrentOutPlace !== pNextOutPlace) {
            pCurrentOutPlace = pCurrentOutPlace.pNext
            if (!pCurrentOutPlace) break
            pCurrentOutPlace.field_18 += 1
            pCurrentOutPlace.nIndex = (pCurrentOutPlace.nIndex + readByte6FDCFB70(pCurrentOutPlace.field_18)) & 3
            pCurrentOutPlace.field_14 += 1
            if (pCurrentOutPlace.field_14 !== 3) {
              bResumed = true
              break
            }
          }
          if (!bResumed) {
            pCurrentOutPlace = null
            break
          }
        }
      }

      v58 = i32(v58 + 5)
      if (nNextIdx >= 900) {
        return false
      }

      nNextIdx = 1
      if (pCurrentOutPlace) {
        break
      }

      if (v58 >= v64) {
        return false
      }
    }

    let pPreviousVertex: D2DrlgVertexStrc | null = null
    let pDrlgVertex: D2DrlgVertexStrc | null = null
    while (pCurrentOutPlace) {
      if (pOutdoors.pPathStarts[nVertexId]) {
        pDrlgVertex = DRLGVER_AllocVertex(0)
        pPreviousVertex!.pNext = pDrlgVertex
      } else {
        pDrlgVertex = DRLGVER_AllocVertex(0)
        pOutdoors.pPathStarts[nVertexId] = pDrlgVertex
      }

      pPreviousVertex = pDrlgVertex
      pDrlgVertex.nPosX = pCurrentOutPlace.nX
      pDrlgVertex.nPosY = pCurrentOutPlace.nY

      pCurrentOutPlace = pCurrentOutPlace.pNext
    }
  } else {
    const pFirst = DRLGVER_AllocVertex(0)
    pFirst.nPosX = nX1
    pFirst.nPosY = nY1
    pOutdoors.pPathStarts[nVertexId] = pFirst

    const pSecond = DRLGVER_AllocVertex(0)
    pSecond.nPosX = nX2
    pSecond.nPosY = nY2
    pFirst.pNext = pSecond
  }

  return true
}

const nBorderIndices: readonly number[] = [
  -1,  1, -1,  0, -1,  2, -1,  3, -1,  0,
   1,  9,  9, -1, -1,  1,  8, -1, -1, 12,
  -1, -1, -1, -1, 12,  4, -1, -1,  5,  2,
   2, 10, -1, -1, -1, -1, 10,  1,  9,  9,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  // Second array
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, 11, 11,  3, 12, -1, -1, -1, -1, 12,
   4,  4,  7, -1, -1,  2, 10, -1, -1, -1,
  -1, 10, -1, -1,  6,  3, -1, -1, 11, 11,
   3,
]

const nBorderIndicesOffset_sub_6FD80BE0 = 4
const nBorderIndicesOffset_sub_6FD80C10 = 50

const levelPrestBorder: readonly (readonly [number, number, number, number])[] = [
  [0x2010203, 0x1020300, 0x0ff0001, 0x0ff000100 | 0],
  [LVLPREST_NONE, LVLPREST_ACT1_WILD_BORDER_1, LVLPREST_ACT2_DESERT_BORDER_1, LVLPREST_ACT4_MESA_BORDER_1],
  [LVLPREST_ACT1_WILD_CLIFF_BORDER_2, LVLPREST_ACT1_WILD_BORDER_2, LVLPREST_ACT2_DESERT_BORDER_2, LVLPREST_ACT4_MESA_BORDER_2],
  [LVLPREST_ACT1_WILD_CLIFF_BORDER_3, LVLPREST_ACT1_WILD_BORDER_3, LVLPREST_ACT2_DESERT_BORDER_3, LVLPREST_ACT4_MESA_BORDER_3],
  [LVLPREST_NONE, LVLPREST_ACT1_WILD_BORDER_4, LVLPREST_ACT2_DESERT_BORDER_4, LVLPREST_ACT4_MESA_BORDER_4],
  [LVLPREST_ACT1_WILD_CLIFF_BORDER_5, LVLPREST_ACT1_WILD_BORDER_5, LVLPREST_ACT2_DESERT_BORDER_5, LVLPREST_ACT4_MESA_BORDER_5],
  [LVLPREST_ACT1_WILD_CLIFF_BORDER_6A, LVLPREST_ACT1_WILD_BORDER_6, LVLPREST_ACT2_DESERT_BORDER_6, LVLPREST_ACT4_MESA_BORDER_6],
  [LVLPREST_ACT1_WILD_CLIFF_BORDER_7, LVLPREST_ACT1_WILD_BORDER_7, LVLPREST_ACT2_DESERT_BORDER_7, LVLPREST_ACT4_MESA_BORDER_7],
  [LVLPREST_NONE, LVLPREST_ACT1_WILD_BORDER_8, LVLPREST_ACT2_DESERT_BORDER_8, LVLPREST_ACT4_MESA_BORDER_8],
  [LVLPREST_NONE, LVLPREST_ACT1_WILD_BORDER_9, LVLPREST_ACT2_DESERT_BORDER_9, LVLPREST_ACT4_MESA_BORDER_9],
  [LVLPREST_ACT1_WILD_CLIFF_BORDER_10, LVLPREST_ACT1_WILD_BORDER_10, LVLPREST_ACT2_DESERT_BORDER_10, LVLPREST_ACT4_MESA_BORDER_10],
  [LVLPREST_NONE, LVLPREST_ACT1_WILD_BORDER_11, LVLPREST_ACT2_DESERT_BORDER_11, LVLPREST_ACT4_MESA_BORDER_11],
  [LVLPREST_NONE, LVLPREST_ACT1_WILD_BORDER_12, LVLPREST_ACT2_DESERT_BORDER_12, LVLPREST_ACT4_MESA_BORDER_12],
]

//D2Common.0x6FD80BE0
export function sub_6FD80BE0(a1: number, a2: number, a3: number): number {
  const lutIndex = i32(a1 + 3 * a2 + nBorderIndicesOffset_sub_6FD80BE0)
  if (lutIndex < 0 || lutIndex >= nBorderIndices.length) {
    throw new Error(`sub_6FD80BE0: lutIndex ${lutIndex} out of bounds`)
  }
  const nIndex = nBorderIndices[lutIndex]!

  if (a3 < 4) {
    if (a3 < 0 || nIndex + 1 < 0 || nIndex + 1 >= levelPrestBorder.length) {
      throw new Error(`sub_6FD80BE0: levelPrestBorder[${nIndex + 1}][${a3}] out of bounds`)
    }
    return levelPrestBorder[nIndex + 1]![a3]!
  } else {
    return gnBarricadeCliffBorderIds[nIndex]![a3 - 4]!
  }
}

//D2Common.0x6FD80C10
export function sub_6FD80C10(a1: number, a2: number, a3: number, a4: number, a5: number): number {
  if (a1 >= 0) {
    if (a1 > 0) {
      a1 += 2
    }
  } else {
    a1 -= 2
  }

  if (a3 >= 0) {
    if (a3 > 0) {
      a3 += 2
    }
  } else {
    a3 -= 2
  }

  const lutIndex = i32(a2 + a1 + 9 * (a4 + a3) + nBorderIndicesOffset_sub_6FD80C10)
  if (lutIndex < 0 || lutIndex >= nBorderIndices.length) {
    throw new Error(`sub_6FD80C10: lutIndex ${lutIndex} out of bounds`)
  }

  const v6 = nBorderIndices[lutIndex]!

  if (v6 === -1) {
    return 0
  } else if (a5 < 4) {
    if (a5 < 0 || v6 < 0 || v6 >= levelPrestBorder.length) {
      throw new Error(`sub_6FD80C10: levelPrestBorder[${v6}][${a5}] out of bounds`)
    }
    return levelPrestBorder[v6]![a5]!
  } else {
    return gnBarricadeCliffBorderIds[v6 - 1]![a5 - 4]!
  }
}

const aBlankBorderOffsets: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [
    [0, 0],
    [1, 1],
  ],
  [
    [1, 0],
    [-1, 1],
  ],
  [
    [0, 1],
    [1, -1],
  ],
  [
    [1, 1],
    [-1, -1],
  ],
]

//D2Common.0x6FD80C80
export function DRLGOUTPLACE_SetBlankBorderGridCells(pLevel: D2DrlgLevelStrc): void {
  const pOutdoors = pLevel.pOutdoors!
  for (let k = 0; k < 4; k += 1) {
    const tStartPos = aBlankBorderOffsets[k]![0]
    const tDirection = aBlankBorderOffsets[k]![1]
    let nX = tStartPos[0]
    if (nX) {
      nX = pOutdoors.nGridWidth - 1
    }

    let nY = tStartPos[1]
    if (nY) {
      nY = pOutdoors.nGridHeight - 1
    }

    const nDirX = tDirection[0]
    const nDirY = tDirection[1]

    for (let j = nY; !(DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, nX, j) & GRID2_UNKB00); j += nDirY) {
      for (let i = nX; !(DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, i, j) & GRID2_UNKB00); i += nDirX) {
        DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], i, j, GRID2_UNKB08, FLAG_OPERATION_OR)
      }
    }
  }
}

//D2Common.0x6FD80DA0
export function DRLGOUTPLACE_SetOutGridLinkFlags(pLevel: D2DrlgLevelStrc): void {
  const pOutdoors = pLevel.pOutdoors!
  let pVertex = pOutdoors.pVertex!
  let pNext = pVertex.pNext!

  do {
    if (pVertex.dwFlags & 1) {
      sub_6FD75DE0(
        pOutdoors.pGrid[1],
        pVertex,
        DRLGOUTDOORS_GetOutLinkVisFlag(pLevel, pVertex),
        FLAG_OPERATION_OR,
        true,
      )
      const nPackedValue = GRID2_UNKB00 | (pVertex.nDirection !== 0 ? GRID2_HAS_DIRECTION : 0)
      sub_6FD75DE0(pOutdoors.pGrid[2], pVertex, nPackedValue, FLAG_OPERATION_OR, true)
    }

    pVertex = pNext
    pNext = pVertex.pNext!
  } while (pVertex !== pOutdoors.pVertex)
}

const nDesertBorderIds: readonly (readonly [number, number])[] = [
  [LVLPREST_ACT2_DESERT_BORDER_10, LVLPREST_ACT2_DESERT_BORDER_9],
  [LVLPREST_ACT2_DESERT_BORDER_9, LVLPREST_ACT2_DESERT_BORDER_12],
  [LVLPREST_NONE, LVLPREST_NONE],
  [LVLPREST_ACT2_DESERT_BORDER_10, LVLPREST_ACT2_DESERT_BORDER_11],
  [LVLPREST_ACT2_DESERT_BORDER_11, LVLPREST_ACT2_DESERT_BORDER_12],
]

//D2Common.0x6FD80E10
export function DRLGOUTPLACE_PlaceAct1245OutdoorBorders(pLevel: D2DrlgLevelStrc): void {
  const pOutdoors = pLevel.pOutdoors!
  const nAct = DRLG_GetActNoFromLevelId(pLevel.nLevelId)
  let pDrlgVertex = pOutdoors.pVertex!
  let pNextVertex = pDrlgVertex.pNext!

  do {
    let tLvlPrestPackedInfo = GRID2_UNKB00 | (pDrlgVertex.nDirection !== 0 ? GRID2_HAS_DIRECTION : 0)

    const curDiff = DRLGVER_GetCoordDiff(pDrlgVertex)
    const nextDiff = DRLGVER_GetCoordDiff(pNextVertex)
    const nCurrentDiffX = curDiff.nDiffX
    const nCurrentDiffY = curDiff.nDiffY
    const nNextDiffX = nextDiff.nDiffX
    const nNextDiffY = nextDiff.nDiffY

    const nCurrentDiffXAbs = nCurrentDiffX < 0 ? -nCurrentDiffX : nCurrentDiffX
    const nCurrentDiffYAbs = nCurrentDiffY < 0 ? -nCurrentDiffY : nCurrentDiffY

    let nCurrentX = pDrlgVertex.nPosX
    let nCurrentY = pDrlgVertex.nPosY
    const nNextX = pNextVertex.nPosX
    const nNextY = pNextVertex.nPosY
    let nDiff = nCurrentDiffXAbs ? i32(nCurrentX - nNextX) : i32(nCurrentY - nNextY)
    if (nDiff < 0) {
      nDiff = -nDiff
    }

    let nLevelPrestId = 0
    switch (pLevel.nLevelType) {
      case LVLTYPE_ACT1_WILDERNESS:
        nLevelPrestId = sub_6FD80BE0(nCurrentDiffX, nCurrentDiffY, pDrlgVertex.nDirection === 0 ? 1 : 0)
        break

      case LVLTYPE_ACT2_DESERT:
        nLevelPrestId = sub_6FD80BE0(nCurrentDiffX, nCurrentDiffY, 2)
        break

      case LVLTYPE_ACT4_MESA:
        nLevelPrestId = sub_6FD80BE0(nCurrentDiffX, nCurrentDiffY, 3)
        break

      case LVLTYPE_ACT5_BARRICADE:
        nLevelPrestId = sub_6FD80BE0(nCurrentDiffX, nCurrentDiffY, sub_6FD84100(pLevel))
        break

      default:
        nLevelPrestId = sub_6FD80BE0(nCurrentDiffX, nCurrentDiffY, -1)
        break
    }

    if (!(pDrlgVertex.dwFlags & 2)) {
      while (nCurrentX !== nNextX || nCurrentY !== nNextY) {
        nCurrentX = i32(nCurrentX + nCurrentDiffX)
        nCurrentY = i32(nCurrentY + nCurrentDiffY)
        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nCurrentX, nCurrentY, nLevelPrestId, -1, false)
        DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nCurrentX, nCurrentY, tLvlPrestPackedInfo, FLAG_OPERATION_OR)
      }
    }

    if (pDrlgVertex.dwFlags & 1 && !(pDrlgVertex.dwFlags & 2)) {
      switch (nAct) {
        case ACT_I:
        case ACT_V: {
          let nX = pDrlgVertex.nPosX < pNextVertex.nPosX ? pDrlgVertex.nPosX : pNextVertex.nPosX
          nX = i32(nX + idiv(Math.imul(nCurrentDiffXAbs, nDiff), 2))

          let nY = pDrlgVertex.nPosY < pNextVertex.nPosY ? pDrlgVertex.nPosY : pNextVertex.nPosY
          nY = i32(nY + idiv(Math.imul(nCurrentDiffYAbs, nDiff), 2))

          const tPackedInfoToAdd =
            GRID2_LVL_LINK | grid2PickedFileBits(pLevel.nLevelId === LEVEL_BURIALGROUNDS ? 4 : 3)
          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nX, nY, GRID2_PICKED_FILE_MASK, FLAG_OPERATION_AND_NEGATED)
          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nX, nY, tPackedInfoToAdd, FLAG_OPERATION_OR)
          break
        }
        case ACT_IV: {
          let nX = pDrlgVertex.nPosX < pNextVertex.nPosX ? pDrlgVertex.nPosX : pNextVertex.nPosX
          nX = i32(nX + idiv(Math.imul(nCurrentDiffXAbs, nDiff), 2))

          let nY = pDrlgVertex.nPosY < pNextVertex.nPosY ? pDrlgVertex.nPosY : pNextVertex.nPosY
          nY = i32(nY + idiv(Math.imul(nCurrentDiffYAbs, nDiff), 2))

          const tPackedInfoToAdd = GRID2_LVL_LINK | grid2PickedFileBits(3)
          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nX, nY, GRID2_PICKED_FILE_MASK, FLAG_OPERATION_AND_NEGATED)
          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nX, nY, tPackedInfoToAdd, FLAG_OPERATION_OR)
          break
        }
        case ACT_II: {
          let nX = pDrlgVertex.nPosX < pNextVertex.nPosX ? pDrlgVertex.nPosX : pNextVertex.nPosX
          nX = i32(nX + idiv(Math.imul(nCurrentDiffXAbs, nDiff), 2))

          let nY = pDrlgVertex.nPosY < pNextVertex.nPosY ? pDrlgVertex.nPosY : pNextVertex.nPosY
          nY = i32(nY + idiv(Math.imul(nCurrentDiffYAbs, nDiff), 2))

          const nIndex = i32(nCurrentDiffX + 2 * nCurrentDiffY + 2)
          DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY, nDesertBorderIds[nIndex]![0], -1, false)
          DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
            pLevel,
            nX + nCurrentDiffXAbs,
            nY + nCurrentDiffYAbs,
            nDesertBorderIds[nIndex]![1],
            -1,
            false,
          )
          break
        }
        default:
          break
      }
    }

    let nDirection = pDrlgVertex.nDirection
    if (nDirection) {
      tLvlPrestPackedInfo |= GRID2_HAS_DIRECTION
    } else {
      nDirection = pNextVertex.nDirection
      if (nDirection !== 0) {
        tLvlPrestPackedInfo |= GRID2_HAS_DIRECTION
      } else {
        tLvlPrestPackedInfo &= ~GRID2_HAS_DIRECTION
      }
    }

    let v41 = 0
    switch (pLevel.nLevelType) {
      case LVLTYPE_ACT1_WILDERNESS:
        v41 = nDirection === 0 ? 1 : 0
        break

      case LVLTYPE_ACT2_DESERT:
        v41 = 2
        break

      case LVLTYPE_ACT4_MESA:
        v41 = 3
        break

      case LVLTYPE_ACT5_BARRICADE:
        v41 = sub_6FD84100(pLevel)
        break

      default:
        v41 = -1
        break
    }

    if (pDrlgVertex.dwFlags & 2) {
      if (pNextVertex.dwFlags & 2) {
        nLevelPrestId = sub_6FD80C10(nCurrentDiffX, nCurrentDiffY, nNextDiffX, nNextDiffY, v41)
      } else {
        nLevelPrestId = sub_6FD80C10(nCurrentDiffX, nCurrentDiffY, 2 * nNextDiffX, 2 * nNextDiffY, v41)
      }
    } else {
      if (pNextVertex.dwFlags & 2) {
        nLevelPrestId = sub_6FD80C10(2 * nCurrentDiffX, 2 * nCurrentDiffY, nNextDiffX, nNextDiffY, v41)
      } else {
        nLevelPrestId = sub_6FD80C10(2 * nCurrentDiffX, 2 * nCurrentDiffY, 2 * nNextDiffX, 2 * nNextDiffY, v41)
      }
    }

    if (nLevelPrestId === LVLPREST_ACT1_WILD_CLIFF_BORDER_6A) {
      if (pDrlgVertex.nDirection === 1) {
        if (pNextVertex.nDirection !== 1) {
          nLevelPrestId = LVLPREST_ACT1_WILD_CLIFF_BORDER_6B
        }
      } else {
        nLevelPrestId = LVLPREST_ACT1_WILD_CLIFF_BORDER_6C
      }

      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nNextX, nNextY, nLevelPrestId, -1, false)
      DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nNextX, nNextY, tLvlPrestPackedInfo, FLAG_OPERATION_OR)
    } else if (nLevelPrestId !== LVLPREST_NONE) {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nNextX, nNextY, nLevelPrestId, -1, false)
      DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nNextX, nNextY, tLvlPrestPackedInfo, FLAG_OPERATION_OR)
    }

    pDrlgVertex = pNextVertex
    pNextVertex = pNextVertex.pNext!
  } while (pDrlgVertex !== pOutdoors.pVertex)

  DRLGOUTPLACE_SetBlankBorderGridCells(pLevel)
}

//D2Common.0x6FD83A20
export function DRLGOUTPLACE_InitOutdoorRoomGrids(pDrlgRoom: D2DrlgRoomStrc): void {
  const pLevel = pDrlgRoom.pLevel
  const pOutdoor = pDrlgRoom.pOutdoor!
  const pLevelDefBinRecord = DATATBLS_GetLevelDefRecord(pLevel.pDrlg.env.tables, pLevel.nLevelId)

  const nWaypointSubTheme = (pDrlgRoom.dwFlags & DRLGROOMFLAG_HAS_WAYPOINT_MASK) >>> DRLGROOMFLAG_HAS_WAYPOINT_FIRST_BIT
  const nShrineSubTheme = (pDrlgRoom.dwFlags & DRLGROOMFLAG_SUBSHRINE_ROWS_MASK) >>> DRLGROOMFLAG_SUBSHRINE_ROWS_FIRST_BIT

  const nWidth = pDrlgRoom.pDrlgCoord.nWidth + 1
  const nHeight = pDrlgRoom.pDrlgCoord.nHeight + 1

  DRLGGRID_InitializeGridCells(pOutdoor.pTileTypeGrid, nWidth, nHeight)
  DRLGGRID_InitializeGridCells(pOutdoor.pWallGrid, nWidth, nHeight)
  DRLGGRID_InitializeGridCells(pOutdoor.pFloorGrid, nWidth, nHeight)

  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      DRLGGRID_AlterGridFlag(pOutdoor.pFloorGrid, j, i, 0x40002, FLAG_OPERATION_OVERWRITE)
    }
  }

  if (DRLG_GetActNoFromLevelId(pLevel.nLevelId) === ACT_I) {
    DRLG_OUTDOORS_GenerateDirtPath(pLevel, pDrlgRoom)
  }

  DRLGROOMTILE_AllocTileGrid(pDrlgRoom)

  const a1: D2UnkOutdoorStrc2 = {
    pDrlgRoom,
    pOutdoorRooms: [pOutdoor, null, null, null],
    pWallsGrids: [pOutdoor.pWallGrid, null, null, null],
    pFloorGrid: pOutdoor.pFloorGrid,
    field_28: 0,
    field_2C: 1,
    nSubWaypoint_Shrine: 0,
    nSubTheme: 0,
    nSubThemePicked: 0,
  }

  if (nWaypointSubTheme) {
    a1.nSubTheme = 0
    a1.nSubWaypoint_Shrine = pLevelDefBinRecord.dwSubWaypoint
    a1.nSubThemePicked = nWaypointSubTheme
    sub_6FD8AA80(a1)
  }

  if (nShrineSubTheme) {
    a1.nSubTheme = 0
    a1.nSubWaypoint_Shrine = pLevelDefBinRecord.dwSubShrine
    a1.nSubThemePicked = nShrineSubTheme
    sub_6FD8AA80(a1)
  }

  a1.nSubWaypoint_Shrine = pOutdoor.nSubType
  a1.nSubTheme = pOutdoor.nSubTheme
  a1.nSubThemePicked = pOutdoor.nSubThemePicked
  sub_6FD8AA80(a1)

  let nFlags = 0
  switch (pLevel.nLevelType) {
    case LVLTYPE_ACT2_DESERT:
      nFlags = 0x100
      break

    case LVLTYPE_ACT3_JUNGLE:
      nFlags = 0x120000
      break

    case LVLTYPE_ACT3_KURAST:
      nFlags = 0x100000
      break

    case LVLTYPE_ACT4_MESA:
      nFlags = 0xa00000
      break

    case LVLTYPE_ACT4_LAVA:
      nFlags = 0x1600000
      break

    case LVLTYPE_ACT5_BARRICADE:
      nFlags = pLevel.nLevelId === LEVEL_TUNDRAWASTELANDS ? 0x600000 : 0
      break

    default:
      break
  }

  for (let nY = 0; nY < nHeight; nY += 1) {
    for (let nX = 0; nX < nWidth; nX += 1) {
      if (!(DRLGGRID_GetGridEntry(pOutdoor.pFloorGrid, nX, nY) & 0x3f0ff80)) {
        DRLGGRID_AlterGridFlag(pOutdoor.pFloorGrid, nX, nY, nFlags, FLAG_OPERATION_OR)
      }
    }
  }

  DRLGGRID_AlterEdgeGridFlags(pOutdoor.pWallGrid, 4, FLAG_OPERATION_OR)
  DRLGGRID_AlterEdgeGridFlags(pOutdoor.pFloorGrid, 4, FLAG_OPERATION_OR)
}

//D2Common.0x6FD83C90
export function DRLGOUTPLACE_CreateOutdoorRoomEx(
  pLevel: D2DrlgLevelStrc,
  nX: number,
  nY: number,
  nWidth: number,
  nHeight: number,
  dwRoomFlags: number,
  dwOutdoorFlags: number,
  dwOutdoorFlagsEx: number,
  dwDT1Mask: number,
): void {
  const pDrlgRoom = DRLGROOM_AllocRoomEx(pLevel, DRLGTYPE_MAZE)
  pDrlgRoom.pDrlgCoord.nWidth = nWidth
  pDrlgRoom.pDrlgCoord.nHeight = nHeight
  pDrlgRoom.pDrlgCoord.nPosX = nX
  pDrlgRoom.pDrlgCoord.nPosY = nY

  DRLGROOM_AddRoomExToLevel(pLevel, pDrlgRoom)

  pDrlgRoom.dwDT1Mask = dwDT1Mask >>> 0
  pDrlgRoom.dwFlags = (pDrlgRoom.dwFlags | dwRoomFlags | DRLGROOMFLAG_NO_LOS_DRAW) >>> 0

  const pOutdoor = pDrlgRoom.pOutdoor!
  pOutdoor.dwFlags = dwOutdoorFlags | 0
  pOutdoor.dwFlagsEx = dwOutdoorFlagsEx | 0

  const pLevelDefBinRecord = DATATBLS_GetLevelDefRecord(pLevel.pDrlg.env.tables, pLevel.nLevelId)
  pOutdoor.nSubType = pLevelDefBinRecord.dwSubType
  pOutdoor.nSubTheme = pLevelDefBinRecord.dwSubTheme
  pOutdoor.nSubThemePicked = DRLGTILESUB_PickSubThemes(
    pDrlgRoom,
    pLevelDefBinRecord.dwSubType,
    pLevelDefBinRecord.dwSubTheme,
  )
}
