/**
 * D2Common Act V outdoor siege/barricade DRLG: 1:1 port of D2MOO
 * `source/D2Common/src/Drlg/DrlgOutSiege.cpp`.
 */

import { SEED_RollLimitedRandomNumber } from '../rng/d2-rng.ts'
import { DRLGGRID_AlterGridFlag, DRLGGRID_GetGridEntry } from './drlg-grid.ts'
import {
  LVLPREST_ACT5_BARRICADE_1,
  LVLPREST_ACT5_BARRICADE_1_SNOW,
  LVLPREST_ACT5_BARRICADE_8,
  LVLPREST_ACT5_BARRICADE_BUILDING,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_1,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_1_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_3,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_3_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_4,
  LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_4_SNOW,
  LVLPREST_ACT5_BARRICADE_CLIFF_RAVINE_BORDER_7,
  LVLPREST_ACT5_BARRICADE_CLIFF_RAVINE_BORDER_7_SNOW,
  LVLPREST_ACT5_BARRICADE_ENTRANCE_16X32,
  LVLPREST_ACT5_BARRICADE_ENTRANCE_32X16,
  LVLPREST_ACT5_BARRICADE_EXIT_16X32,
  LVLPREST_ACT5_BARRICADE_EXIT_32X16,
  LVLPREST_ACT5_BARRICADE_FILLER,
  LVLPREST_ACT5_BARRICADE_FILLER_TREASURE,
  LVLPREST_ACT5_BARRICADE_FROM_CAVE_16X32_SNOW,
  LVLPREST_ACT5_BARRICADE_FROM_CAVE_32X16_SNOW,
  LVLPREST_ACT5_BARRICADE_HELL_PORTAL_N,
  LVLPREST_ACT5_BARRICADE_HELL_PORTAL_W,
  LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_1,
  LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_1_SNOW,
  LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_3,
  LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_3_SNOW,
  LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_4,
  LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_4_SNOW,
  LVLPREST_ACT5_BARRICADE_RAVINE_CLIFF_BORDER_5,
  LVLPREST_ACT5_BARRICADE_RAVINE_CLIFF_BORDER_5_SNOW,
  LVLPREST_ACT5_BARRICADE_RUINS_N_1,
  LVLPREST_ACT5_BARRICADE_RUINS_N_2,
  LVLPREST_ACT5_BARRICADE_RUINS_N_TREASURE,
  LVLPREST_ACT5_BARRICADE_RUINS_W_1,
  LVLPREST_ACT5_BARRICADE_RUINS_W_2,
  LVLPREST_ACT5_BARRICADE_RUINS_W_TREASURE,
  LVLPREST_ACT5_BARRICADE_SNOW_LAKE_1,
  LVLPREST_ACT5_BARRICADE_SNOW_LAKE_2,
  LVLPREST_ACT5_BARRICADE_SNOW_OTHER,
  LVLPREST_ACT5_BARRICADE_SNOW_TREASURE,
  LVLPREST_ACT5_BARRICADE_TO_CAVE_16X32,
  LVLPREST_ACT5_BARRICADE_TO_CAVE_16X32_SNOW,
  LVLPREST_ACT5_BARRICADE_TO_CAVE_32X16,
  LVLPREST_ACT5_BARRICADE_TO_CAVE_32X16_SNOW,
  LVLPREST_ACT5_BARRICADE_TO_SIEGE,
  LVLPREST_ACT5_BARRICADE_WAYPOINT_DIRT,
  LVLPREST_ACT5_BARRICADE_WAYPOINT_SNOW,
  LVLPREST_ACT5_SIEGE_TO_TOWN,
  LVLSUB_ACT5_BARRICADE,
} from './drlg-ids.ts'
import {
  DRLGOUTDOORS_AlterAdjacentPresetGridCells,
  DRLGOUTDOORS_GetPackedGrid2Info,
  DRLGOUTDOORS_GetPresetIndexFromGridCell,
  DRLGOUTDOORS_SetBlankGridCell,
  DRLGOUTDOORS_SpawnOutdoorLevelPreset,
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx,
  DRLGOUTDOORS_TestGridCellNonLvlLink,
} from './drlg-outdoors.ts'
import { DRLGOUTPLACE_SetOutGridLinkFlags, sub_6FD80BE0, sub_6FD80C10 } from './drlg-outplace.ts'
import { DATATBLS_GetLvlPrestTxtRecord } from './drlg-tables.ts'
import { DRLGTILESUB_AddSecondaryBorder } from './drlg-tilesub.ts'
import {
  type D2DrlgLevelStrc,
  FLAG_OPERATION_OR,
  GRID2_LVL_LINK,
  GRID2_UNKB00,
  idiv,
  imod,
  LEVEL_ARREATPLATEAU,
  LEVEL_BLOODYFOOTHILLS,
  LEVEL_ID_ACT5_BARRICADE_1,
  LEVEL_TUNDRAWASTELANDS,
  outdoorCoord,
} from './drlg-types.ts'
import { DRLGVER_GetCoordDiff } from './drlg-vertex.ts'

// D2Common.0x6FD84100
export function sub_6FD84100(pLevel: D2DrlgLevelStrc): number {
  return (pLevel.nLevelId === LEVEL_TUNDRAWASTELANDS ? 1 : 0) + 4
}

const stru_6FDD09C8: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
]

// D2Common.0x6FD84110
export function DRLGOUTSIEGE_InitAct5OutdoorLevel(pLevel: D2DrlgLevelStrc): void {
  const pOutdoors = pLevel.pOutdoors!
  if (pLevel.nLevelId === LEVEL_BLOODYFOOTHILLS) {
    const pLvlPrestTxtRecord = DATATBLS_GetLvlPrestTxtRecord(pLevel.pDrlg.env.tables, LVLPREST_ACT5_SIEGE_TO_TOWN)
    let nSize = pOutdoors.nGridWidth - idiv(pLvlPrestTxtRecord.nSizeX, 8)
    for (let i = 0; i < 15; i += 1) {
      if (nSize < 0) {
        throw new Error('Siege Level is the wrong size')
      }
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nSize, 0, i + LVLPREST_ACT5_SIEGE_TO_TOWN, 0, false)
      nSize -= idiv(pLvlPrestTxtRecord.nSizeX, 8)
    }
  } else {
    DRLGOUTPLACE_SetOutGridLinkFlags(pLevel)

    let pPreviousVertex = pOutdoors.pVertex!
    let pDrlgVertex = pPreviousVertex.pNext!

    const nLookupId = sub_6FD84100(pLevel)
    do {
      const prevDiff = DRLGVER_GetCoordDiff(pPreviousVertex)
      const curDiff = DRLGVER_GetCoordDiff(pDrlgVertex)
      const nPreviousDiffX = prevDiff.nDiffX
      const nPreviousDiffY = prevDiff.nDiffY
      const nCurrentDiffX = curDiff.nDiffX
      const nCurrentDiffY = curDiff.nDiffY

      const nPreviousDiffXAbs = Math.abs(nPreviousDiffX)
      const nPreviousDiffYAbs = Math.abs(nPreviousDiffY)

      let nPreviousX = pPreviousVertex.nPosX & ~1
      let nPreviousY = pPreviousVertex.nPosY & ~1

      const nCurrentX = pDrlgVertex.nPosX & ~1
      const nCurrentY = pDrlgVertex.nPosY & ~1

      const nLevelPrestId = sub_6FD80BE0(nPreviousDiffX, nPreviousDiffY, nLookupId)

      if ((pPreviousVertex.dwFlags & 2) === 0) {
        while (nPreviousX !== nCurrentX || nPreviousY !== nCurrentY) {
          nPreviousX += 2 * nPreviousDiffX
          nPreviousY += 2 * nPreviousDiffY

          DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nPreviousX, nPreviousY, nLevelPrestId, -1, false)
          DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nPreviousX, nPreviousY, GRID2_UNKB00, FLAG_OPERATION_OR)
        }
      }

      if (pPreviousVertex.dwFlags & 1) {
        const nX = Math.max(pPreviousVertex.nPosX, pDrlgVertex.nPosX)
        const nXCapped = (nX - 4 * nPreviousDiffXAbs) & ~1
        const nY = Math.max(pPreviousVertex.nPosY, pDrlgVertex.nPosY)
        const nYCapped = (nY - 4 * nPreviousDiffYAbs) & ~1

        DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nXCapped, nYCapped, GRID2_LVL_LINK, FLAG_OPERATION_OR)
        DRLGGRID_AlterGridFlag(
          pOutdoors.pGrid[2],
          nXCapped + 2 * nPreviousDiffXAbs,
          nYCapped + 2 * nPreviousDiffYAbs,
          GRID2_LVL_LINK,
          FLAG_OPERATION_OR,
        )
      }

      const nRand = sub_6FD80C10(
        2 * nPreviousDiffX,
        2 * nPreviousDiffY,
        2 * nCurrentDiffX,
        2 * nCurrentDiffY,
        nLookupId,
      )
      if (nRand) {
        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nCurrentX, nCurrentY, nRand, -1, false)
        DRLGGRID_AlterGridFlag(pOutdoors.pGrid[2], nCurrentX, nCurrentY, GRID2_UNKB00, FLAG_OPERATION_OR)
      }

      pPreviousVertex = pDrlgVertex
      pDrlgVertex = pDrlgVertex.pNext!
    } while (pPreviousVertex !== pOutdoors.pVertex)

    if (pLevel.nLevelId === LEVEL_ID_ACT5_BARRICADE_1) {
      sub_6FD846C0(pLevel)
    }

    const nLastX = pOutdoors.nGridWidth - 2
    const nLastY = pOutdoors.nGridHeight - 2
    let nX = nLastX
    let nY = 0

    const nLevelPrestIdCliff =
      pLevel.nLevelId === LEVEL_TUNDRAWASTELANDS
        ? LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_1_SNOW
        : LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_1
    const nLevelPrestIdRavine =
      pLevel.nLevelId === LEVEL_TUNDRAWASTELANDS
        ? LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_1_SNOW
        : LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_1

    while (nX !== 0 || nY !== nLastY) {
      const nIndex = DRLGGRID_GetGridEntry(pOutdoors.pGrid[0], nX, nY) - nLevelPrestIdCliff
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY, nIndex + nLevelPrestIdRavine, -1, false)

      nX += 2 * stru_6FDD09C8[nIndex]![0]
      nY += 2 * stru_6FDD09C8[nIndex]![1]
    }

    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
      pLevel,
      pOutdoors.nGridWidth - 2,
      0,
      pLevel.nLevelId === LEVEL_TUNDRAWASTELANDS
        ? LVLPREST_ACT5_BARRICADE_CLIFF_RAVINE_BORDER_7_SNOW
        : LVLPREST_ACT5_BARRICADE_CLIFF_RAVINE_BORDER_7,
      -1,
      false,
    )
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
      pLevel,
      0,
      pOutdoors.nGridHeight - 2,
      pLevel.nLevelId === LEVEL_TUNDRAWASTELANDS
        ? LVLPREST_ACT5_BARRICADE_RAVINE_CLIFF_BORDER_5_SNOW
        : LVLPREST_ACT5_BARRICADE_RAVINE_CLIFF_BORDER_5,
      -1,
      false,
    )

    DRLGOUTSIEGE_PlaceBarricadeEntrancesAndExits(pLevel)
    DRLGOUTSIEGE_PlaceCaves(pLevel)

    if (pLevel.nLevelId === LEVEL_ID_ACT5_BARRICADE_1) {
      DRLGOUTSIEGE_ConnectBarricadeAndSiege(pLevel)
    }

    DRLGOUTSIEGE_AddACt5SecondaryBorder(pLevel)
    DRLGOUTSIEGE_PlacePrisons(pLevel)
    DRLGOUTSIEGE_PlaceSpecialPresets(pLevel)
  }
}

interface D2DrlgOutSiegeInitStrc {
  readonly nLevelId: number
  readonly field_4: number
  readonly field_8: number
  readonly nLevelPrestId1: number
  readonly nLevelPrestId2: number
}

const stru_6FDD0988: readonly D2DrlgOutSiegeInitStrc[] = [
  {
    nLevelId: LEVEL_ARREATPLATEAU,
    field_4: 0,
    field_8: 0,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_TO_CAVE_32X16,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_TO_CAVE_16X32,
  },
  {
    nLevelId: LEVEL_TUNDRAWASTELANDS,
    field_4: 0,
    field_8: 1,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_FROM_CAVE_32X16_SNOW,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_FROM_CAVE_16X32_SNOW,
  },
  {
    nLevelId: LEVEL_TUNDRAWASTELANDS,
    field_4: 0,
    field_8: 0,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_TO_CAVE_32X16_SNOW,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_TO_CAVE_16X32_SNOW,
  },
]

// D2Common.0x6FD844F0
export function DRLGOUTSIEGE_PlaceCaves(pLevel: D2DrlgLevelStrc): void {
  let nLevelPrestId = 0
  let nX = 0
  let nY = 0

  for (let i = 0; i < stru_6FDD0988.length; i += 1) {
    const entry = stru_6FDD0988[i]!
    if (pLevel.nLevelId === entry.nLevelId) {
      if (pLevel.pLevelCoords.nWidth <= pLevel.pLevelCoords.nHeight) {
        nLevelPrestId = entry.nLevelPrestId1
        nX = 2
        if (entry.field_8) {
          nY = pLevel.pOutdoors!.nGridHeight - 2
        } else {
          nY = 0
        }
      } else {
        nLevelPrestId = entry.nLevelPrestId2
        nY = 2
        if (entry.field_8) {
          nX = pLevel.pOutdoors!.nGridWidth - 2
        } else {
          nX = 0
        }
      }

      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY, nLevelPrestId, entry.field_4, false)
    }
  }
}

// D2Common.0x6FD84580
export function DRLGOUTSIEGE_PlaceBarricadeEntrancesAndExits(pLevel: D2DrlgLevelStrc): void {
  const pOutdoors = pLevel.pOutdoors!
  const nPickedFile = 2 * (pLevel.nLevelId === LEVEL_BLOODYFOOTHILLS ? 1 : 0) - 1

  for (let i = 0; i < pOutdoors.nGridWidth; i += 1) {
    if (DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, i, 0) & GRID2_LVL_LINK) {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, i, 0, LVLPREST_ACT5_BARRICADE_EXIT_32X16, nPickedFile, false)
      break
    }
  }

  for (let i = 0; i < pOutdoors.nGridWidth; i += 1) {
    if (DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, i, pOutdoors.nGridHeight - 2) & GRID2_LVL_LINK) {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
        pLevel,
        i,
        pOutdoors.nGridHeight - 2,
        LVLPREST_ACT5_BARRICADE_ENTRANCE_32X16,
        nPickedFile,
        false,
      )
      break
    }
  }

  for (let i = 0; i < pOutdoors.nGridHeight; i += 1) {
    if (DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, 0, i) & GRID2_LVL_LINK) {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, i, LVLPREST_ACT5_BARRICADE_EXIT_16X32, nPickedFile, false)
      break
    }
  }

  for (let i = 0; i < pOutdoors.nGridHeight; i += 1) {
    if (DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, pOutdoors.nGridWidth - 2, i) & GRID2_LVL_LINK) {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
        pLevel,
        pOutdoors.nGridWidth - 2,
        i,
        LVLPREST_ACT5_BARRICADE_ENTRANCE_16X32,
        nPickedFile,
        false,
      )
      break
    }
  }
}

// D2Common.0x6FD846C0
export function sub_6FD846C0(pLevel: D2DrlgLevelStrc): void {
  const pOutdoors = pLevel.pOutdoors!
  DRLGGRID_AlterGridFlag(
    pOutdoors.pGrid[2],
    pOutdoors.nGridWidth - 2,
    pOutdoors.nGridHeight - 4,
    GRID2_LVL_LINK,
    FLAG_OPERATION_OR,
  )
  DRLGGRID_AlterGridFlag(
    pOutdoors.pGrid[2],
    pOutdoors.nGridWidth - 2,
    pOutdoors.nGridHeight - 3,
    GRID2_LVL_LINK,
    FLAG_OPERATION_OR,
  )
}

// D2Common.0x6FD84700
export function DRLGOUTSIEGE_AddACt5SecondaryBorder(pLevel: D2DrlgLevelStrc): void {
  if (pLevel.nLevelId !== LEVEL_BLOODYFOOTHILLS) {
    const a1 = {
      pLevel,
      field_4: outdoorCoord(pLevel.pOutdoors!),
      pGrid1: pLevel.pOutdoors!.pGrid[0],
      pGrid2: pLevel.pOutdoors!.pGrid[2],
      nLevelPrestId: 0,
      field_14: -1,
      nLvlSubId: LVLSUB_ACT5_BARRICADE,
      field_1C: null,
      field_20: null,
      field_24: sub_6FD84820,
      field_28: sub_6FD84780,
      field_2C: DRLGOUTDOORS_AlterAdjacentPresetGridCells,
      field_30: DRLGOUTDOORS_SetBlankGridCell,
      field_34: DRLGOUTDOORS_SpawnOutdoorLevelPresetEx,
    }

    DRLGTILESUB_AddSecondaryBorder(a1)
  }
}

interface D2DrlgOutSiegeInitStrc2 {
  readonly nStyle: number
  readonly field_4: number
  readonly field_8: number
  readonly nLevelPrestId1: number
  readonly nLevelPrestId2: number
}

const stru_6FDD0A28: readonly D2DrlgOutSiegeInitStrc2[] = [
  { nStyle: 49, field_4: 1, field_8: 16, nLevelPrestId1: LVLPREST_ACT5_BARRICADE_1, nLevelPrestId2: LVLPREST_ACT5_BARRICADE_1_SNOW },
  { nStyle: 49, field_4: 31, field_8: 46, nLevelPrestId1: LVLPREST_ACT5_BARRICADE_1, nLevelPrestId2: LVLPREST_ACT5_BARRICADE_1_SNOW },
  {
    nStyle: 48,
    field_4: 1,
    field_8: 1,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_3,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_3_SNOW,
  },
  {
    nStyle: 48,
    field_4: 2,
    field_8: 3,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_1,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_1_SNOW,
  },
  {
    nStyle: 48,
    field_4: 4,
    field_8: 4,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_4,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_CLIFF_BORDER_4_SNOW,
  },
  {
    nStyle: 48,
    field_4: 5,
    field_8: 5,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_3,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_3_SNOW,
  },
  {
    nStyle: 48,
    field_4: 6,
    field_8: 7,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_1,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_1_SNOW,
  },
  {
    nStyle: 48,
    field_4: 8,
    field_8: 8,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_4,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_4_SNOW,
  },
  { nStyle: 48, field_4: 30, field_8: 30, nLevelPrestId1: 0, nLevelPrestId2: 0 },
  { nStyle: 48, field_4: 31, field_8: 31, nLevelPrestId1: -5, nLevelPrestId2: -5 },
]

// D2Common.0x6FD84780
export function sub_6FD84780(pLevel: D2DrlgLevelStrc, nStyle: number, a3: number): number {
  if (nStyle !== 48 && nStyle !== 49) {
    throw new Error(`sub_6FD84780: unexpected nStyle=${nStyle}`)
  }

  for (let i = 0; i < stru_6FDD0A28.length; i += 1) {
    const entry = stru_6FDD0A28[i]!
    if (nStyle === entry.nStyle && a3 >= entry.field_4 && a3 <= entry.field_8) {
      if (pLevel.nLevelId === LEVEL_TUNDRAWASTELANDS) {
        return a3 + entry.nLevelPrestId2 - entry.field_4
      } else {
        return a3 + entry.nLevelPrestId1 - entry.field_4
      }
    }
  }

  throw new Error(`sub_6FD84780: unreachable nStyle=${nStyle} a3=${a3}`)
}

// D2Common.0x6FD84820
export function sub_6FD84820(
  pLevel: D2DrlgLevelStrc,
  nX: number,
  nY: number,
  a4: number,
  _a5: number,
  a6: number,
): boolean {
  const v8 = sub_6FD84780(pLevel, (a6 >>> 20) & 0x3f, (a6 >>> 8) & 0xff)

  if (v8 === -5) {
    return true
  } else if (v8 === a4) {
    return DRLGOUTDOORS_TestGridCellNonLvlLink(pLevel, nX, nY) !== 0
  }

  return false
}

interface D2DrlgOutSiegeInitStrc3 {
  readonly nLevelId: number
  readonly nLevelPrestId1: number
  readonly nLevelPrestId2: number
  readonly field_C: number
  readonly field_10: number
  readonly field_14: number
  readonly bMustHave: boolean
}

const stru_6FDD0AF8: readonly D2DrlgOutSiegeInitStrc3[] = [
  {
    nLevelId: LEVEL_ID_ACT5_BARRICADE_1,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_HELL_PORTAL_N,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_HELL_PORTAL_W,
    field_C: 0,
    field_10: 25,
    field_14: 1,
    bMustHave: true,
  },
  {
    nLevelId: LEVEL_ARREATPLATEAU,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_HELL_PORTAL_N,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_HELL_PORTAL_W,
    field_C: 0,
    field_10: 25,
    field_14: 1,
    bMustHave: true,
  },
  {
    nLevelId: LEVEL_TUNDRAWASTELANDS,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_HELL_PORTAL_N,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_HELL_PORTAL_W,
    field_C: 1,
    field_10: 25,
    field_14: 1,
    bMustHave: true,
  },
  {
    nLevelId: LEVEL_ARREATPLATEAU,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_WAYPOINT_DIRT,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_WAYPOINT_DIRT,
    field_C: -1,
    field_10: 25,
    field_14: 1,
    bMustHave: true,
  },
  {
    nLevelId: LEVEL_TUNDRAWASTELANDS,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_WAYPOINT_SNOW,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_WAYPOINT_SNOW,
    field_C: -1,
    field_10: 25,
    field_14: 1,
    bMustHave: true,
  },
  {
    nLevelId: LEVEL_ID_ACT5_BARRICADE_1,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_RUINS_N_TREASURE,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_RUINS_W_TREASURE,
    field_C: -1,
    field_10: 10,
    field_14: 1,
    bMustHave: false,
  },
  {
    nLevelId: LEVEL_ID_ACT5_BARRICADE_1,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_RUINS_N_1,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_RUINS_W_1,
    field_C: -1,
    field_10: 20,
    field_14: 4,
    bMustHave: false,
  },
  {
    nLevelId: LEVEL_ID_ACT5_BARRICADE_1,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_RUINS_N_2,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_RUINS_W_2,
    field_C: -1,
    field_10: 20,
    field_14: 4,
    bMustHave: false,
  },
  {
    nLevelId: LEVEL_ARREATPLATEAU,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_FILLER_TREASURE,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_FILLER_TREASURE,
    field_C: -1,
    field_10: 10,
    field_14: 1,
    bMustHave: false,
  },
  {
    nLevelId: LEVEL_ARREATPLATEAU,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_BUILDING,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_BUILDING,
    field_C: -1,
    field_10: 8,
    field_14: 1,
    bMustHave: false,
  },
  {
    nLevelId: LEVEL_ARREATPLATEAU,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_FILLER,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_FILLER,
    field_C: -1,
    field_10: 15,
    field_14: 5,
    bMustHave: false,
  },
  {
    nLevelId: LEVEL_TUNDRAWASTELANDS,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_SNOW_LAKE_1,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_SNOW_LAKE_1,
    field_C: -1,
    field_10: 9,
    field_14: 4,
    bMustHave: false,
  },
  {
    nLevelId: LEVEL_TUNDRAWASTELANDS,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_SNOW_LAKE_2,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_SNOW_LAKE_2,
    field_C: -1,
    field_10: 9,
    field_14: 4,
    bMustHave: false,
  },
  {
    nLevelId: LEVEL_TUNDRAWASTELANDS,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_SNOW_OTHER,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_SNOW_OTHER,
    field_C: -1,
    field_10: 9,
    field_14: 4,
    bMustHave: false,
  },
  {
    nLevelId: LEVEL_TUNDRAWASTELANDS,
    nLevelPrestId1: LVLPREST_ACT5_BARRICADE_SNOW_TREASURE,
    nLevelPrestId2: LVLPREST_ACT5_BARRICADE_SNOW_TREASURE,
    field_C: -1,
    field_10: 5,
    field_14: 3,
    bMustHave: false,
  },
]

// D2Common.0x6FD84870
export function DRLGOUTSIEGE_PlaceSpecialPresets(pLevel: D2DrlgLevelStrc): void {
  for (let i = 0; i < stru_6FDD0AF8.length; i += 1) {
    const entry = stru_6FDD0AF8[i]!
    if (pLevel.nLevelId === entry.nLevelId) {
      const nLevelPrestId =
        pLevel.pLevelCoords.nWidth < pLevel.pLevelCoords.nHeight ? entry.nLevelPrestId1 : entry.nLevelPrestId2

      let bAdded = false
      for (let j = 0; j < entry.field_14; j += 1) {
        bAdded = DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nLevelPrestId, entry.field_C, 0, 15)
      }

      if (!bAdded && entry.bMustHave) {
        throw new Error(`DRLGOUTSIEGE_PlaceSpecialPresets: failed to place required preset ${nLevelPrestId}`)
      }
    }
  }
}

// D2Common.0x6FD84910
export function DRLGOUTSIEGE_PlacePrisons(pLevel: D2DrlgLevelStrc): void {
  let nPrisonsPlaced = 0
  const nPrisonsToPlace = 3

  if (pLevel.nLevelId === LEVEL_ID_ACT5_BARRICADE_1) {
    const pOutdoors = pLevel.pOutdoors!

    for (let nAttemptNumber = 0; nAttemptNumber < 90 && nPrisonsPlaced < nPrisonsToPlace; nAttemptNumber += 1) {
      const nRandX = 2 * (SEED_RollLimitedRandomNumber(pLevel.pSeed, idiv(pOutdoors.nGridWidth, 2)) | 0)
      const nRandY = 2 * (SEED_RollLimitedRandomNumber(pLevel.pSeed, idiv(pOutdoors.nGridHeight, 2)) | 0)

      const nLevelPrestId = DRLGOUTDOORS_GetPresetIndexFromGridCell(pLevel, nRandX, nRandY)
      if (nLevelPrestId >= LVLPREST_ACT5_BARRICADE_1 && nLevelPrestId <= LVLPREST_ACT5_BARRICADE_8) {
        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nRandX, nRandY, nLevelPrestId + 16, -1, false)
        nPrisonsPlaced += 1
      }
    }

    const nRandX = 2 * (SEED_RollLimitedRandomNumber(pLevel.pSeed, idiv(pOutdoors.nGridWidth, 2)) | 0)
    const nRandY = 2 * (SEED_RollLimitedRandomNumber(pLevel.pSeed, idiv(pOutdoors.nGridHeight, 2)) | 0)

    for (let j = 0; j < pOutdoors.nGridHeight && nPrisonsPlaced < nPrisonsToPlace; j += 1) {
      for (let i = 0; i < pOutdoors.nGridWidth && nPrisonsPlaced < nPrisonsToPlace; i += 1) {
        const nX = imod(i + nRandX, pOutdoors.nGridWidth)
        const nY = imod(j + nRandY, pOutdoors.nGridHeight)

        const nLevelPrestId = DRLGOUTDOORS_GetPresetIndexFromGridCell(pLevel, nX, nY)
        if (nLevelPrestId >= LVLPREST_ACT5_BARRICADE_1 && nLevelPrestId <= LVLPREST_ACT5_BARRICADE_8) {
          DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY, nLevelPrestId + 16, -1, false)
          nPrisonsPlaced += 1
        }
      }
    }
  }
}

// D2Common.0x6FD84BB0
export function DRLGOUTSIEGE_ConnectBarricadeAndSiege(pLevel: D2DrlgLevelStrc): void {
  const pOutdoors = pLevel.pOutdoors!
  const pLvlPrestTxtRecord = DATATBLS_GetLvlPrestTxtRecord(pLevel.pDrlg.env.tables, LVLPREST_ACT5_BARRICADE_TO_SIEGE)

  const nX = pOutdoors.nGridWidth - idiv(pLvlPrestTxtRecord.nSizeX, 8)
  const nY = pOutdoors.nGridHeight - idiv(pLvlPrestTxtRecord.nSizeY, 8)

  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY, LVLPREST_ACT5_BARRICADE_TO_SIEGE, -1, false)
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY - 2, LVLPREST_ACT5_BARRICADE_RAVINE_BORDER_4, -1, false)
}
