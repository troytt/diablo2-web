/**
 * 1:1 TypeScript port of D2MOO `source/D2Common/src/Drlg/DrlgOutWild.cpp`.
 *
 * Every function preserves D2MOO's name, control flow, integer arithmetic, and RNG roll order.
 */

import { SEED_RollLimitedRandomNumber, SEED_RollRandomNumber } from '../rng/d2-rng.ts'
import { DRLG_GetLevel } from './drlg-drlg.ts'
import { DRLGGRID_GetGridEntry } from './drlg-grid.ts'
import {
  LVLPREST_ACT1_BIVOUAC,
  LVLPREST_ACT1_BRIDGE,
  LVLPREST_ACT1_CAIRN_STONES,
  LVLPREST_ACT1_CAMP,
  LVLPREST_ACT1_CAVE_ENTRANCE,
  LVLPREST_ACT1_CORRAL_FILL,
  LVLPREST_ACT1_COTTAGES_1,
  LVLPREST_ACT1_COTTAGES_2,
  LVLPREST_ACT1_COTTAGES_3,
  LVLPREST_ACT1_DOE_ENTRANCE,
  LVLPREST_ACT1_FALLEN_CAMP_1,
  LVLPREST_ACT1_FALLEN_CAMP_2,
  LVLPREST_ACT1_FALLEN_CAMP_BISHIBOSH,
  LVLPREST_ACT1_GRAVEYARD,
  LVLPREST_ACT1_INIFUS,
  LVLPREST_ACT1_POND,
  LVLPREST_ACT1_RIVER_LOWER,
  LVLPREST_ACT1_RIVER_UPPER,
  LVLPREST_ACT1_RUIN,
  LVLPREST_ACT1_STONE_FILL_1,
  LVLPREST_ACT1_STONE_FILL_2,
  LVLPREST_ACT1_SWAMP_FILL_1,
  LVLPREST_ACT1_SWAMP_FILL_2,
  LVLPREST_ACT1_TOWER_1,
  LVLPREST_ACT1_TOWER_TOME,
  LVLPREST_ACT1_TOWN_1_TRANSITION_E,
  LVLPREST_ACT1_TOWN_1_TRANSITION_S,
  LVLPREST_ACT1_TREE_FILL,
  LVLPREST_ACT1_WILD_BORDER_1,
  LVLPREST_ACT1_WILD_BORDER_4,
  LVLPREST_ACT1_WILD_CLIFF_CAVE_LEFT,
  LVLPREST_ACT1_WILD_CLIFF_CAVE_RIGHT,
  LVLSUB_ACT1_BORDER_BORDER,
  LVLSUB_ACT1_BORDER_CLIFFS,
  LVLSUB_ACT1_BORDER_CORNER,
  LVLSUB_ACT1_BORDER_MIDDLE,
} from './drlg-ids.ts'
import {
  DRLGOUTDOORS_AddAct124SecondaryBorder,
  DRLGOUTDOORS_GetPackedGrid2Info,
  DRLGOUTDOORS_SpawnAct12Shrines,
  DRLGOUTDOORS_SpawnAct12Waypoint,
  DRLGOUTDOORS_SpawnAct1DirtPaths,
  DRLGOUTDOORS_SpawnOutdoorLevelPreset,
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx,
  DRLGOUTDOORS_SpawnPresetFarAway,
  DRLGOUTDOORS_SpawnRandomOutdoorDS1,
  DRLGOUTDOORS_TestGridCellSpawnValid,
} from './drlg-outdoors.ts'
import { DRLGOUTPLACE_PlaceAct1245OutdoorBorders, DRLGOUTPLACE_SetOutGridLinkFlags } from './drlg-outplace.ts'
import {
  type D2DrlgLevelStrc,
  type D2DrlgVertexStrc,
  GRID2_HAS_DIRECTION,
  GRID2_UNKB08,
  grid2PickedFile,
  i32,
  idiv,
  imod,
  LEVEL_BLACKMARSH,
  LEVEL_BLOODMOOR,
  LEVEL_BURIALGROUNDS,
  LEVEL_COLDPLAINS,
  LEVEL_DARKWOOD,
  LEVEL_MOOMOOFARM,
  LEVEL_ROGUEENCAMPMENT,
  LEVEL_STONYFIELD,
  LEVEL_TAMOEHIGHLAND,
  OUTDOOR_BRIDGE,
  OUTDOOR_RIVER,
} from './drlg-types.ts'

//D2Common.0x6FD84CA0
export function DRLGOUTWILD_GetBridgeCoords(pLevel: D2DrlgLevelStrc): { nX: number; nY: number } {
  const pOutdoors = pLevel.pOutdoors!
  const nX = idiv(pOutdoors.nGridWidth, 2) - 1

  for (let nY = 1; nY < pOutdoors.nGridWidth - 1; nY += 1) {
    if (
      DRLGGRID_GetGridEntry(pOutdoors.pGrid[0], nX, nY) === 28 &&
      grid2PickedFile(DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, nX, nY)) === 1
    ) {
      return { nX, nY }
    }
  }

  return { nX: -1, nY: -1 }
}

//D2Common.0x6FD84D30
//TODO: Check v21, v22
export function DRLGOUTWILD_InitAct1OutdoorLevel(pLevel: D2DrlgLevelStrc): void {
  const pOutdoors = pLevel.pOutdoors!
  let nX = 0
  let nY = 0
  let bAdded = false
  let bBreak = false

  let v21 = 0

  if (
    pLevel.nLevelId !== LEVEL_BLOODMOOR &&
    pLevel.nLevelId !== LEVEL_COLDPLAINS &&
    pLevel.nLevelId !== LEVEL_BURIALGROUNDS
  ) {
    let pVertex = pOutdoors.pVertex!
    let pPreviousVertex = pVertex

    for (let i = pVertex.pNext!; i !== pVertex; i = i.pNext!) {
      pPreviousVertex = i
    }

    bBreak = false
    do {
      const pNextVertex = pVertex.pNext!
      if (
        (pVertex.nPosX < pNextVertex.nPosX &&
          pPreviousVertex.nPosY > pVertex.nPosY &&
          !(pVertex.dwFlags & 1) &&
          !(pPreviousVertex.dwFlags & 1)) ||
        (pVertex.nPosY > pNextVertex.nPosY &&
          pPreviousVertex.nPosX > pVertex.nPosX &&
          !(pVertex.dwFlags & 1) &&
          !(pPreviousVertex.dwFlags & 1))
      ) {
        const pFirstVertex = pVertex
        let pSpecialVertex: D2DrlgVertexStrc | null = null
        do {
          if (pVertex === pOutdoors.pVertex) {
            bBreak = true
          }

          if (sub_6FD85350(pVertex)) {
            break
          }

          if (sub_6FD85300(pVertex)) {
            pSpecialVertex = pVertex
          }

          pVertex = pVertex.pNext!
        } while (pVertex !== pFirstVertex)

        if (pSpecialVertex) {
          for (let j: D2DrlgVertexStrc = pFirstVertex; j !== pSpecialVertex; j = j.pNext!) {
            j.nDirection = 1
          }

          pSpecialVertex.nDirection = 1

          pOutdoors.dwFlags |= 0x20
        }
      }

      pPreviousVertex = pVertex
      pVertex = pVertex.pNext!
    } while (!bBreak && pVertex !== pOutdoors.pVertex)
  }

  DRLGOUTPLACE_SetOutGridLinkFlags(pLevel)
  DRLGOUTPLACE_PlaceAct1245OutdoorBorders(pLevel)

  if (pLevel.nLevelId >= LEVEL_BLOODMOOR && pLevel.nLevelId <= LEVEL_TAMOEHIGHLAND) {
    DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, LVLSUB_ACT1_BORDER_CLIFFS, LVLPREST_ACT1_WILD_BORDER_1)

    if (pLevel.nLevelId !== LEVEL_MOOMOOFARM) {
      if (pOutdoors.dwFlags & 0xc) {
        if (DRLGOUTWILD_TestSpawnRiver(pLevel, pOutdoors.nGridWidth - 2)) {
          DRLGOUTWILD_SpawnRiver(pLevel, pOutdoors.nGridWidth - 2)
        }
      }

      if (pOutdoors.dwFlags & 0x20 && !(pOutdoors.dwFlags & 0x40)) {
        bAdded = false

        if (!(SEED_RollRandomNumber(pLevel.pSeed) & 1)) {
          for (let j = 0; j < pOutdoors.nGridHeight; j += 1) {
            if (bAdded) {
              break
            }

            for (let i = 0; i < pOutdoors.nGridWidth; i += 1) {
              if (bAdded) {
                break
              }

              bAdded = DRLGOUTWILD_SpawnCliffCaves(pLevel, i, j)
            }
          }

          if (!bAdded) {
            throw new Error('FOG_DisplayWarning: fAdded')
          }
        } else {
          for (let j = 0; j < pOutdoors.nGridHeight; j += 1) {
            if (bAdded) {
              break
            }

            for (let i = 0; i < pOutdoors.nGridWidth; i += 1) {
              if (bAdded) {
                break
              }

              bAdded = DRLGOUTWILD_SpawnCliffCaves(pLevel, j, i)
            }
          }

          if (!bAdded) {
            throw new Error('FOG_DisplayWarning: fAdded')
          }
        }
      }

      if (pOutdoors.dwFlags & 0x1c && !(pOutdoors.dwFlags & 0x40)) {
        nY = pOutdoors.nGridHeight - 4
        nX = pOutdoors.nGridWidth - (((~(pOutdoors.dwFlags & 0xff) & 0x10) | 0x40) >> 4)

        v21 = SEED_RollRandomNumber(pLevel.pSeed) & 3
        if (v21 % 2 !== 0) {
          nX = 3
        }

        if (idiv(v21, 2)) {
          nY = 3
        }

        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
          pLevel,
          nX,
          nY,
          (pLevel.nLevelId === LEVEL_BLOODMOOR ? 1 : 0) + 51,
          -1,
          false,
        )
        pOutdoors.dwFlags |= 0x40
      }
    }

    DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, LVLSUB_ACT1_BORDER_MIDDLE, LVLPREST_ACT1_WILD_BORDER_1)
    DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, LVLSUB_ACT1_BORDER_CORNER, LVLPREST_ACT1_WILD_BORDER_1)
    DRLGOUTWILD_SpawnTownTransitionsAndCaves(pLevel)
    DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, LVLSUB_ACT1_BORDER_BORDER, LVLPREST_ACT1_WILD_BORDER_1)
    DRLGOUTDOORS_SpawnAct1DirtPaths(pLevel)
  }

  if (pLevel.nLevelId === LEVEL_MOOMOOFARM) {
    DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, LVLSUB_ACT1_BORDER_CLIFFS, LVLPREST_ACT1_WILD_BORDER_1)
    DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, LVLSUB_ACT1_BORDER_MIDDLE, LVLPREST_ACT1_WILD_BORDER_1)
    DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, LVLSUB_ACT1_BORDER_CORNER, LVLPREST_ACT1_WILD_BORDER_1)
    DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, LVLSUB_ACT1_BORDER_BORDER, LVLPREST_ACT1_WILD_BORDER_1)
  }

  if (pLevel.nLevelId >= LEVEL_COLDPLAINS && pLevel.nLevelId <= LEVEL_BLACKMARSH) {
    DRLGOUTDOORS_SpawnAct12Waypoint(pLevel)
  }

  if (pLevel.nLevelId >= LEVEL_BLOODMOOR && pLevel.nLevelId <= LEVEL_TAMOEHIGHLAND) {
    DRLGOUTDOORS_SpawnAct12Shrines(pLevel, 5)
  }

  DRLGOUTWILD_SpawnSpecialPresets(pLevel)
}

//D2Common.0x6FD85060
export function DRLGOUTWILD_TestSpawnRiver(pLevel: D2DrlgLevelStrc, nX: number): boolean {
  const pOutdoors = pLevel.pOutdoors!
  for (let nY = 0; nY < pOutdoors.nGridHeight; nY += 1) {
    if (
      (DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, nX, nY) & GRID2_HAS_DIRECTION) !== 0 ||
      (DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, nX + 1, nY) & GRID2_HAS_DIRECTION) !== 0
    ) {
      return false
    }
  }

  return true
}

const stru_6FDD0CA0: readonly { readonly nUpperFile: number; readonly nLowerFile: number }[] = [
  { nUpperFile: 2, nLowerFile: 2 },
  { nUpperFile: 0, nLowerFile: 3 },
  { nUpperFile: 1, nLowerFile: 1 },
  { nUpperFile: 3, nLowerFile: 0 },
  { nUpperFile: 0, nLowerFile: 2 },
  { nUpperFile: 0, nLowerFile: 1 },
  { nUpperFile: 1, nLowerFile: 0 },
  { nUpperFile: 2, nLowerFile: 0 },
  { nUpperFile: 2, nLowerFile: 3 },
  { nUpperFile: 1, nLowerFile: 3 },
  { nUpperFile: 3, nLowerFile: 1 },
  { nUpperFile: 3, nLowerFile: 2 },
]

//1.10f: Inlined
export function DRLGOUTWILD_SpawnRiverPreset(
  pLevel: D2DrlgLevelStrc,
  nX: number,
  nY: number,
  bLowerRiver: boolean,
): void {
  const pOutdoors = pLevel.pOutdoors!
  const nOff = bLowerRiver ? 1 : 0
  let nPickedFile = 0

  const tPackedInfo = DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, nX + nOff, nY)
  const nFlags2 = DRLGGRID_GetGridEntry(pOutdoors.pGrid[0], nX + nOff, nY)
  if (nFlags2) {
    if (nFlags2 !== LVLPREST_ACT1_WILD_BORDER_4 || grid2PickedFile(tPackedInfo) !== 3) {
      const nIdx = i32(nFlags2 - LVLPREST_ACT1_WILD_BORDER_1)
      if (nIdx < 0 || nIdx >= stru_6FDD0CA0.length) {
        throw new Error(`DRLGOUTWILD_SpawnRiverPreset: nIdx ${nIdx} out of bounds`)
      }
      nPickedFile = bLowerRiver ? stru_6FDD0CA0[nIdx]!.nLowerFile : stru_6FDD0CA0[nIdx]!.nUpperFile
    } else {
      nPickedFile = 3
    }
  } else {
    if (tPackedInfo & GRID2_UNKB08) {
      nPickedFile = 0
    } else {
      nPickedFile = 3
    }
  }

  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
    pLevel,
    nX + nOff,
    nY,
    bLowerRiver ? LVLPREST_ACT1_RIVER_LOWER : LVLPREST_ACT1_RIVER_UPPER,
    nPickedFile,
    false,
  )
}

//D2Common.0x6FD850B0
export function DRLGOUTWILD_SpawnRiver(pLevel: D2DrlgLevelStrc, nX: number): void {
  const pOutdoors = pLevel.pOutdoors!
  for (let nY = 0; nY < pOutdoors.nGridHeight; nY += 1) {
    DRLGOUTWILD_SpawnRiverPreset(pLevel, nX, nY, false)
    DRLGOUTWILD_SpawnRiverPreset(pLevel, nX, nY, true)
  }

  if (pOutdoors.dwFlags & (OUTDOOR_RIVER | OUTDOOR_BRIDGE)) {
    const nRowRange = i32(pOutdoors.nGridHeight - 2)
    const nRand = SEED_RollLimitedRandomNumber(pLevel.pSeed, nRowRange)

    for (let i = 0; i < nRowRange; i += 1) {
      const nY = imod(i32(nRand + i), nRowRange) + 1

      if (
        DRLGOUTDOORS_TestGridCellSpawnValid(pLevel, nX - 1, nY) &&
        ((pOutdoors.dwFlags & OUTDOOR_BRIDGE) !== 0 || DRLGOUTDOORS_TestGridCellSpawnValid(pLevel, nX + 2, nY))
      ) {
        if (
          grid2PickedFile(DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, nX, nY)) === 3 &&
          grid2PickedFile(DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, nX + 1, nY)) === 3
        ) {
          DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY, LVLPREST_ACT1_BRIDGE, 1, false)
          DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
            pLevel,
            nX + 1,
            nY,
            LVLPREST_ACT1_BRIDGE,
            (pOutdoors.dwFlags & OUTDOOR_BRIDGE) !== 0 ? 3 : 2,
            false,
          )
          return
        }
      }
    }
  }
}

//D2Common.0x6FD85300
export function sub_6FD85300(pDrlgVertex: D2DrlgVertexStrc): boolean {
  const pNext = pDrlgVertex.pNext!

  if (
    pDrlgVertex.nPosX >= pNext.nPosX ||
    pNext.nPosY >= pNext.pNext!.nPosY ||
    pDrlgVertex.dwFlags & 1 ||
    pNext.dwFlags & 1
  ) {
    if (
      pDrlgVertex.nPosY <= pNext.nPosY ||
      pNext.nPosX >= pNext.pNext!.nPosX ||
      pDrlgVertex.dwFlags & 1 ||
      pNext.dwFlags & 1
    ) {
      return false
    }
  }

  return true
}

//D2Common.0x6FD85350
export function sub_6FD85350(pDrlgVertex: D2DrlgVertexStrc): boolean {
  const pNext = pDrlgVertex.pNext!

  if (pDrlgVertex.nPosY >= pNext.nPosY && pDrlgVertex.nPosX <= pNext.nPosX) {
    if (!(pDrlgVertex.dwFlags & 1)) {
      return (pNext.dwFlags & 1) !== 0
    }
  }

  return true
}

//D2Common.0x6FD85390
export function DRLGOUTWILD_SpawnCliffCaves(pLevel: D2DrlgLevelStrc, nX: number, nY: number): boolean {
  const pOutdoors = pLevel.pOutdoors!
  switch (DRLGGRID_GetGridEntry(pOutdoors.pGrid[0], nX, nY)) {
    case 16:
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY, LVLPREST_ACT1_WILD_CLIFF_CAVE_LEFT, -1, false)
      pOutdoors.dwFlags |= 0x40
      return true

    case 17:
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nX, nY, LVLPREST_ACT1_WILD_CLIFF_CAVE_RIGHT, -1, false)
      pOutdoors.dwFlags |= 0x40
      return true

    default:
      return false
  }
}

//D2Common.0x6FD853F0
export function DRLGOUTWILD_SpawnTownTransitionsAndCaves(pLevel: D2DrlgLevelStrc): void {
  const pOutdoors = pLevel.pOutdoors!
  let fAdded = false
  let nX = 0
  let nY = 0

  if (pLevel.nLevelId !== LEVEL_MOOMOOFARM) {
    if (pOutdoors.dwFlags & 0x10) {
      nX = idiv(pOutdoors.nGridWidth, 2) - 1

      if (pOutdoors.nGridHeight <= 0) {
        DRLGOUTWILD_SpawnRiver(pLevel, nX)
      } else {
        while (
          !(DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, nX, nY) & GRID2_HAS_DIRECTION) &&
          !(DRLGOUTDOORS_GetPackedGrid2Info(pOutdoors, nX + 1, nY) & GRID2_HAS_DIRECTION)
        ) {
          nY += 1

          if (nY >= pOutdoors.nGridHeight) {
            DRLGOUTWILD_SpawnRiver(pLevel, nX)
            break
          }
        }
      }
    }

    if (pOutdoors.dwFlags & 0x80) {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, 0, LVLPREST_ACT1_TOWN_1_TRANSITION_S, 1, false)
    }

    if (pOutdoors.dwFlags & 0x100) {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
        pLevel,
        pOutdoors.nGridWidth - 7,
        0,
        LVLPREST_ACT1_TOWN_1_TRANSITION_S,
        2,
        false,
      )
    }

    if (pOutdoors.dwFlags & 0x200) {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, 1, LVLPREST_ACT1_TOWN_1_TRANSITION_E, 1, false)
    }

    if (pOutdoors.dwFlags & 0x400) {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
        pLevel,
        0,
        pOutdoors.nGridHeight - 6,
        LVLPREST_ACT1_TOWN_1_TRANSITION_E,
        1,
        false,
      )
    }

    if (!(pOutdoors.dwFlags & 0x40)) {
      if (pLevel.nLevelId === LEVEL_BLOODMOOR) {
        fAdded = DRLGOUTDOORS_SpawnPresetFarAway(
          pLevel,
          DRLG_GetLevel(pLevel.pDrlg, LEVEL_ROGUEENCAMPMENT).pLevelCoords,
          LVLPREST_ACT1_DOE_ENTRANCE,
          -1,
          1,
          15,
        )
      } else {
        fAdded = DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_CAVE_ENTRANCE, -1, 1, 15)
      }

      if (!fAdded) {
        throw new Error('FOG_DisplayWarning: fAdded')
      }

      pOutdoors.dwFlags |= 0x40
    }
  }
}

//D2Common.0x6FD85520
export function DRLGOUTWILD_SpawnSpecialPresets(pLevel: D2DrlgLevelStrc): void {
  switch (pLevel.nLevelId) {
    case LEVEL_BLOODMOOR:
      DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_POND, -1)

      if (!(SEED_RollRandomNumber(pLevel.pSeed) & 3)) {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_1, -1)
      }

      DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_1, -1)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_STONE_FILL_1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_STONE_FILL_2, -1, 0, 15)
      return

    case LEVEL_COLDPLAINS:
      if (SEED_RollRandomNumber(pLevel.pSeed) & 3) {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_2, -1)

        if (SEED_RollRandomNumber(pLevel.pSeed) & 1) {
          DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_3, -1)
        }
      } else {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_2, -1)
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_2, -1)
      }

      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_FALLEN_CAMP_BISHIBOSH, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_STONE_FILL_1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_STONE_FILL_2, -1, 0, 15)
      return

    case LEVEL_STONYFIELD:
      DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_CAIRN_STONES, -1)
      DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_CAMP, -1)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_TOWER_TOME, -1, 0, 15)

      if (SEED_RollRandomNumber(pLevel.pSeed) & 3) {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_1, -1)

        if (SEED_RollRandomNumber(pLevel.pSeed) & 1) {
          DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_3, -1)
        }
      } else {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_1, -1)
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_1, -1)
      }

      if (!(SEED_RollRandomNumber(pLevel.pSeed) & 3)) {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_FALLEN_CAMP_1, -1)
      }

      DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_FALLEN_CAMP_1, -1)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_CORRAL_FILL, -1, 0, 15)
      return

    case LEVEL_DARKWOOD:
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_INIFUS, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_RUIN, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_TREE_FILL, -1, 0, 15)

      if (SEED_RollRandomNumber(pLevel.pSeed) & 3) {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_2, -1)

        if (SEED_RollRandomNumber(pLevel.pSeed) & 1) {
          DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_3, -1)
        }
      } else {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_2, -1)
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_2, -1)
      }

      if (!(SEED_RollRandomNumber(pLevel.pSeed) & 3)) {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_FALLEN_CAMP_2, -1)
      }

      DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_FALLEN_CAMP_2, -1)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_STONE_FILL_1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_STONE_FILL_2, -1, 0, 15)
      return

    case LEVEL_BLACKMARSH:
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_TOWER_1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_SWAMP_FILL_1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_SWAMP_FILL_2, -1, 0, 15)

      if (SEED_RollRandomNumber(pLevel.pSeed) & 3) {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_1, -1)

        if (SEED_RollRandomNumber(pLevel.pSeed) & 1) {
          DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_3, -1)
        }
      } else {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_1, -1)
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_1, -1)
      }

      if (!(SEED_RollRandomNumber(pLevel.pSeed) & 3)) {
        DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_FALLEN_CAMP_1, -1)
      }

      DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_FALLEN_CAMP_1, -1)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_STONE_FILL_1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_STONE_FILL_2, -1, 0, 15)
      return

    case LEVEL_TAMOEHIGHLAND:
      DRLGOUTWILD_SpawnCottage(pLevel, LVLPREST_ACT1_COTTAGES_2, 1)
      DRLGOUTWILD_SpawnCottage(pLevel, LVLPREST_ACT1_FALLEN_CAMP_2, 0)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_CORRAL_FILL, -1, 0, 15)
      return

    case LEVEL_BURIALGROUNDS:
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 1, 1, LVLPREST_ACT1_GRAVEYARD, -1, false)
      return

    case LEVEL_MOOMOOFARM:
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_BIVOUAC, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_POND, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_CORRAL_FILL, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_SWAMP_FILL_1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_SWAMP_FILL_2, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_STONE_FILL_1, -1, 0, 15)
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, LVLPREST_ACT1_STONE_FILL_2, -1, 0, 15)
      return

    default:
      return
  }
}

//D2Common.0x6FD85920
export function DRLGOUTWILD_SpawnCottage(pLevel: D2DrlgLevelStrc, nLvlPrestId: number, a3: number): void {
  if (SEED_RollRandomNumber(pLevel.pSeed) & 3) {
    DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, nLvlPrestId, -1)

    if (a3 && SEED_RollRandomNumber(pLevel.pSeed) & 1) {
      DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, LVLPREST_ACT1_COTTAGES_3, -1)
    }
  } else {
    DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, nLvlPrestId, -1)
    DRLGOUTDOORS_SpawnRandomOutdoorDS1(pLevel, nLvlPrestId, -1)
  }
}
