/**
 * D2Common Act II outdoor desert DRLG: 1:1 port of D2MOO
 * `source/D2Common/src/Drlg/DrlgOutDesr.cpp`.
 */

import { SEED_RollLimitedRandomNumber, SEED_RollRandomNumber } from '../rng/d2-rng.ts'
import {
  LVLPREST_ACT2_DESERT_BORDER_1,
  LVLPREST_ACT2_DESERT_CLIFF_LEFT_ENDS,
  LVLPREST_ACT2_DESERT_CLIFF_LEFT_KING_ENDS,
  LVLPREST_ACT2_DESERT_CLIFF_LEFT_KING_TOMB,
  LVLPREST_ACT2_DESERT_CLIFF_LEFT_PATH,
  LVLPREST_ACT2_DESERT_CLIFF_LEFT_WALL,
  LVLPREST_ACT2_DESERT_CLIFF_RIGHT_ENDS,
  LVLPREST_ACT2_DESERT_CLIFF_RIGHT_KING_ENDS,
  LVLPREST_ACT2_DESERT_CLIFF_RIGHT_KING_TOMB,
  LVLPREST_ACT2_DESERT_CLIFF_RIGHT_PATH,
  LVLPREST_ACT2_DESERT_CLIFF_RIGHT_WALL,
  LVLPREST_ACT2_DESERT_CLIFF_TOP,
  LVLPREST_ACT2_DESERT_CLIFF_TOP_KING_TOMB,
  LVLPREST_ACT2_DESERT_FILL_BERMS_1,
  LVLPREST_ACT2_DESERT_FILL_BERMS_2,
  LVLPREST_ACT2_DESERT_FILL_BERMS_3,
  LVLPREST_ACT2_DESERT_FILL_BERMS_4,
  LVLPREST_ACT2_DESERT_FILL_BONE_1,
  LVLPREST_ACT2_DESERT_FILL_BONE_2,
  LVLPREST_ACT2_DESERT_FILL_HEAD_1,
  LVLPREST_ACT2_DESERT_FILL_HEAD_2,
  LVLPREST_ACT2_DESERT_FILL_MESA_1,
  LVLPREST_ACT2_DESERT_FILL_WAGON_1,
  LVLPREST_ACT2_DESERT_LAIR_1,
  LVLPREST_ACT2_DESERT_OASIS_1,
  LVLPREST_ACT2_DESERT_OASIS_2,
  LVLPREST_ACT2_DESERT_OASIS_3,
  LVLPREST_ACT2_DESERT_RUINS_08X08,
  LVLPREST_ACT2_DESERT_RUINS_08X16,
  LVLPREST_ACT2_DESERT_RUINS_16X08,
  LVLPREST_ACT2_DESERT_RUINS_16X16,
  LVLPREST_ACT2_DESERT_RUINS_ELDER,
  LVLPREST_ACT2_DESERT_RUINS_SEWER,
  LVLPREST_ACT2_DESERT_TOMB_1,
  LVLPREST_ACT2_DESERT_TOMB_2,
  LVLPREST_ACT2_DESERT_TRANSITION_N,
  LVLPREST_ACT2_DESERT_TRANSITION_W,
  LVLPREST_ACT2_DESERT_VALLEY_RUIN_1,
  LVLPREST_ACT2_DESERT_VALLEY_RUIN_2,
  LVLPREST_ACT2_DESERT_VALLEY_WARP,
} from './drlg-ids.ts'
import {
  DRLGOUTDOORS_AddAct124SecondaryBorder,
  DRLGOUTDOORS_SpawnAct12Shrines,
  DRLGOUTDOORS_SpawnAct12Waypoint,
  DRLGOUTDOORS_SpawnOutdoorLevelPreset,
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx,
} from './drlg-outdoors.ts'
import { DRLGOUTPLACE_PlaceAct1245OutdoorBorders, DRLGOUTPLACE_SetOutGridLinkFlags } from './drlg-outplace.ts'
import { DATATBLS_GetLvlPrestTxtRecord } from './drlg-tables.ts'
import {
  type D2DrlgLevelStrc,
  LEVEL_CANYONOFTHEMAGI,
  LEVEL_DRYHILLS,
  LEVEL_FAROASIS,
  LEVEL_LOSTCITY,
  LEVEL_LUTGHOLEIN,
  LEVEL_PANDEMONIUMRUN2,
  LEVEL_ROCKYWASTE,
  LEVEL_VALLEYOFSNAKES,
} from './drlg-types.ts'

interface D2DrlgOutDesertInitStrc {
  readonly nLvlPrestId: number
  readonly nRand: number
  readonly nX: number
  readonly nY: number
}

// Inlined in D2Common.0x6FD7D430
export function DRLGOUTDESR_PlaceDesertTransitionToTown(pLevel: D2DrlgLevelStrc): void {
  let pTownRoomData = pLevel.pOutdoors!.pRoomData

  while (pTownRoomData && pTownRoomData.pLevel!.nLevelId !== LEVEL_LUTGHOLEIN) {
    pTownRoomData = pTownRoomData.pNext
  }

  if (pTownRoomData) {
    if (pTownRoomData.nDirection === 3) {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
        pLevel,
        0,
        pLevel.pOutdoors!.nGridHeight - 1,
        LVLPREST_ACT2_DESERT_TRANSITION_N,
        -1,
        false,
      )
    } else {
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
        pLevel,
        pLevel.pOutdoors!.nGridWidth - 1,
        0,
        LVLPREST_ACT2_DESERT_TRANSITION_W,
        -1,
        false,
      )
    }
  }
}

// 1.10f: D2Common.0x6FD7D430
// 1.11 : D2Common.0x6FDD58A0
export function DRLGOUTDESR_InitAct2OutdoorLevel(pLevel: D2DrlgLevelStrc): void {
  const nLevelPrestIds1: readonly number[] = [
    LVLPREST_ACT2_DESERT_OASIS_1,
    LVLPREST_ACT2_DESERT_RUINS_08X08,
    LVLPREST_ACT2_DESERT_FILL_BONE_1,
    LVLPREST_ACT2_DESERT_FILL_BONE_2,
    LVLPREST_ACT2_DESERT_FILL_HEAD_1,
    LVLPREST_ACT2_DESERT_FILL_MESA_1,
    LVLPREST_ACT2_DESERT_FILL_WAGON_1,
  ]
  const nLevelPrestIds2: readonly number[] = [
    LVLPREST_ACT2_DESERT_OASIS_1,
    LVLPREST_ACT2_DESERT_RUINS_08X08,
    LVLPREST_ACT2_DESERT_FILL_HEAD_2,
    LVLPREST_ACT2_DESERT_FILL_MESA_1,
  ]
  const nLevelPrestIds3: readonly number[] = [
    LVLPREST_ACT2_DESERT_FILL_BERMS_1,
    LVLPREST_ACT2_DESERT_FILL_BERMS_2,
    LVLPREST_ACT2_DESERT_FILL_BERMS_3,
    LVLPREST_ACT2_DESERT_FILL_BERMS_4,
  ]
  const nLevelPrestIds4: readonly number[] = [LVLPREST_ACT2_DESERT_OASIS_2, LVLPREST_ACT2_DESERT_OASIS_3]

  DRLGOUTPLACE_SetOutGridLinkFlags(pLevel)
  DRLGOUTPLACE_PlaceAct1245OutdoorBorders(pLevel)

  switch (pLevel.nLevelId) {
    case LEVEL_ROCKYWASTE:
      DRLGOUTDESR_PlaceDesertTransitionToTown(pLevel)
      DRLGOUTDESR_PlaceBorders(pLevel)
      DRLGOUTDESR_AddExits(pLevel)
      DRLGOUTDOORS_SpawnAct12Shrines(pLevel, 5)
      DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds1, nLevelPrestIds1.length, false)
      break

    case LEVEL_DRYHILLS:
      DRLGOUTDESR_PlaceCliffs(pLevel)
      DRLGOUTDESR_PlaceBorders(pLevel)
      DRLGOUTDESR_AddExits(pLevel)
      DRLGOUTDOORS_SpawnAct12Waypoint(pLevel)
      DRLGOUTDOORS_SpawnAct12Shrines(pLevel, 5)
      DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds2, nLevelPrestIds2.length, false)
      DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds3, nLevelPrestIds3.length, true)
      break

    case LEVEL_FAROASIS:
      DRLGOUTDESR_PlaceCliffs(pLevel)
      DRLGOUTDESR_PlaceBorders(pLevel)
      DRLGOUTDESR_AddExits(pLevel)
      DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds4, nLevelPrestIds4.length, false)
      DRLGOUTDOORS_SpawnAct12Waypoint(pLevel)
      DRLGOUTDOORS_SpawnAct12Shrines(pLevel, 5)
      DRLGOUTDESR_PlaceFillsInFarOasis(pLevel)
      break

    case LEVEL_LOSTCITY:
      DRLGOUTDESR_PlaceCliffs(pLevel)
      DRLGOUTDESR_PlaceBorders(pLevel)
      DRLGOUTDESR_AddExits(pLevel)
      DRLGOUTDESR_PlaceRuinsInLostCity(pLevel)
      DRLGOUTDOORS_SpawnAct12Waypoint(pLevel)
      DRLGOUTDOORS_SpawnAct12Shrines(pLevel, 5)
      DRLGOUTDESR_PlaceFillsInLostCity(pLevel)
      break

    case LEVEL_VALLEYOFSNAKES:
      DRLGOUTDESR_AddExits(pLevel)
      break

    case LEVEL_CANYONOFTHEMAGI:
      DRLGOUTDESR_PlaceTombEntriesInCanyon(pLevel)
      DRLGOUTDESR_PlaceBorders(pLevel)
      DRLGOUTDOORS_SpawnAct12Shrines(pLevel, 5)
      DRLGOUTDESR_PlaceFillsInCanyon(pLevel)
      break

    case LEVEL_PANDEMONIUMRUN2:
      DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 4, 4, LVLPREST_ACT2_DESERT_VALLEY_WARP, -1, false)
      DRLGOUTDESR_PlaceBorders(pLevel)
      DRLGOUTDESR_PlaceFillsInCanyon(pLevel)
      DRLGOUTDOORS_SpawnAct12Shrines(pLevel, 5)
      break

    default:
      return
  }
}

// D2Common.0x6FD7D870
export function DRLGOUTDESR_PlacePresetVariants(
  pLevel: D2DrlgLevelStrc,
  pLevelPrestIds: readonly number[],
  nVariants: number,
  bIterateFiles: boolean,
): void {
  let nRand = SEED_RollLimitedRandomNumber(pLevel.pSeed, nVariants) >>> 0

  for (let i = 0; i < nVariants; i += 1) {
    const nPrestId = pLevelPrestIds[nRand]!
    if (bIterateFiles) {
      const dwFiles = DATATBLS_GetLvlPrestTxtRecord(pLevel.pDrlg.env.tables, nPrestId).dwFiles >>> 0
      for (let nFile = 0; nFile < dwFiles; nFile += 1) {
        DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPrestId, nFile, 0, 15)
      }
    } else {
      DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nPrestId, -1, 0, 15)
    }

    nRand = (nRand + 1) % nVariants
  }
}

const pOutDesertCliffsInit: readonly (readonly D2DrlgOutDesertInitStrc[])[] = [
  [
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_ENDS, nRand: 1, nX: 0, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_PATH, nRand: -1, nX: 2, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_WALL, nRand: -1, nX: 4, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_WALL, nRand: -1, nX: 6, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_ENDS, nRand: 2, nX: 8, nY: 4 },
  ],
  [
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_ENDS, nRand: 1, nX: 0, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_WALL, nRand: -1, nX: 2, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_PATH, nRand: -1, nX: 4, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_WALL, nRand: -1, nX: 6, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_ENDS, nRand: 2, nX: 8, nY: 4 },
  ],
  [
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_ENDS, nRand: 1, nX: 0, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_WALL, nRand: -1, nX: 2, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_WALL, nRand: -1, nX: 4, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_PATH, nRand: -1, nX: 6, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_ENDS, nRand: 2, nX: 8, nY: 4 },
  ],
  [
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_ENDS, nRand: 2, nX: 8, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_WALL, nRand: -1, nX: 6, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_TOP, nRand: -1, nX: 4, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_PATH, nRand: -1, nX: 4, nY: 6 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_ENDS, nRand: 2, nX: 4, nY: 8 },
  ],
  [
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_ENDS, nRand: 2, nX: 8, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_PATH, nRand: -1, nX: 6, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_TOP, nRand: -1, nX: 4, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_WALL, nRand: -1, nX: 4, nY: 6 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_ENDS, nRand: 2, nX: 4, nY: 8 },
  ],
  [
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_ENDS, nRand: 1, nX: 4, nY: 0 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_PATH, nRand: -1, nX: 4, nY: 2 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_WALL, nRand: -1, nX: 4, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_WALL, nRand: -1, nX: 4, nY: 6 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_ENDS, nRand: 2, nX: 4, nY: 8 },
  ],
  [
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_ENDS, nRand: 1, nX: 4, nY: 0 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_WALL, nRand: -1, nX: 4, nY: 2 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_PATH, nRand: -1, nX: 4, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_WALL, nRand: -1, nX: 4, nY: 6 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_ENDS, nRand: 2, nX: 4, nY: 8 },
  ],
  [
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_ENDS, nRand: 1, nX: 4, nY: 0 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_WALL, nRand: -1, nX: 4, nY: 2 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_WALL, nRand: -1, nX: 4, nY: 4 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_PATH, nRand: -1, nX: 4, nY: 6 },
    { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_ENDS, nRand: 2, nX: 4, nY: 8 },
  ],
]

// D2Common.0x6FD7D950
export function DRLGOUTDESR_PlaceCliffs(pLevel: D2DrlgLevelStrc): void {
  const nRand = SEED_RollRandomNumber(pLevel.pSeed) & 7
  const row = pOutDesertCliffsInit[nRand]!

  for (let i = 0; i < 5; i += 1) {
    const entry = row[i]!
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, entry.nX, entry.nY, entry.nLvlPrestId, entry.nRand, false)
  }
}

// D2Common.0x6FD7D9B0
export function DRLGOUTDESR_PlaceBorders(pLevel: D2DrlgLevelStrc): void {
  DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, 2, LVLPREST_ACT2_DESERT_BORDER_1)
  DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, 1, LVLPREST_ACT2_DESERT_BORDER_1)
  DRLGOUTDOORS_AddAct124SecondaryBorder(pLevel, 3, LVLPREST_ACT2_DESERT_BORDER_1)
}

// D2Common.0x6FD7D9F0
export function DRLGOUTDESR_AddExits(pLevel: D2DrlgLevelStrc): void {
  let nLevelPrestId = 0

  switch (pLevel.nLevelId) {
    case LEVEL_ROCKYWASTE:
    case LEVEL_DRYHILLS:
      nLevelPrestId = LVLPREST_ACT2_DESERT_TOMB_1
      break

    case LEVEL_FAROASIS:
      nLevelPrestId = LVLPREST_ACT2_DESERT_LAIR_1
      break

    case LEVEL_LOSTCITY:
      nLevelPrestId = LVLPREST_ACT2_DESERT_RUINS_SEWER
      break

    case LEVEL_VALLEYOFSNAKES:
      nLevelPrestId = LVLPREST_ACT2_DESERT_TOMB_2
      break

    default:
      throw new Error('sAddTheExitsAndStuff() - Could not add the exit!')
  }

  if (!DRLGOUTDOORS_SpawnOutdoorLevelPreset(pLevel, nLevelPrestId, -1, 0, 15)) {
    throw new Error('sAddTheExitsAndStuff() - Could not add the exit!')
  }
}

// D2Common.0x6FD7DA60
export function DRLGOUTDESR_PlaceFillsInFarOasis(pLevel: D2DrlgLevelStrc): void {
  const nLevelPrestIds1: readonly number[] = [
    LVLPREST_ACT2_DESERT_RUINS_08X08,
    LVLPREST_ACT2_DESERT_FILL_HEAD_1,
    LVLPREST_ACT2_DESERT_FILL_MESA_1,
    LVLPREST_ACT2_DESERT_FILL_WAGON_1,
  ]
  const nLevelPrestIds2: readonly number[] = [LVLPREST_ACT2_DESERT_OASIS_1]

  DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds1, nLevelPrestIds1.length, false)
  DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds2, nLevelPrestIds2.length, true)
  DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds2, nLevelPrestIds2.length, true)
}

// D2Common.0x6FD7DAC0
export function DRLGOUTDESR_PlaceRuinsInLostCity(pLevel: D2DrlgLevelStrc): void {
  const nLevelPrestIds: readonly number[] = [
    LVLPREST_ACT2_DESERT_RUINS_ELDER,
    LVLPREST_ACT2_DESERT_RUINS_16X16,
    LVLPREST_ACT2_DESERT_RUINS_16X08,
    LVLPREST_ACT2_DESERT_RUINS_08X16,
  ]

  DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds, nLevelPrestIds.length, false)
}

// D2Common.0x6FD7DB00
export function DRLGOUTDESR_PlaceFillsInLostCity(pLevel: D2DrlgLevelStrc): void {
  const nLevelPrestIds1: readonly number[] = [
    LVLPREST_ACT2_DESERT_OASIS_1,
    LVLPREST_ACT2_DESERT_FILL_HEAD_2,
    LVLPREST_ACT2_DESERT_FILL_MESA_1,
    LVLPREST_ACT2_DESERT_FILL_BERMS_1,
    LVLPREST_ACT2_DESERT_FILL_BERMS_2,
  ]
  const nLevelPrestIds2: readonly number[] = [LVLPREST_ACT2_DESERT_RUINS_08X08]

  DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds1, nLevelPrestIds1.length, false)
  DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds2, nLevelPrestIds2.length, true)
  DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds2, nLevelPrestIds2.length, true)
}

const pOutDesertCanyonInit: readonly D2DrlgOutDesertInitStrc[] = [
  { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_KING_ENDS, nRand: 0, nX: 8, nY: 0 },
  { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_KING_TOMB, nRand: 2, nX: 6, nY: 0 },
  { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_KING_TOMB, nRand: 1, nX: 4, nY: 0 },
  { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_RIGHT_KING_TOMB, nRand: 0, nX: 2, nY: 0 },
  { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_TOP_KING_TOMB, nRand: 0, nX: 0, nY: 0 },
  { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_KING_TOMB, nRand: 0, nX: 0, nY: 2 },
  { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_KING_TOMB, nRand: 1, nX: 0, nY: 4 },
  { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_KING_TOMB, nRand: 2, nX: 0, nY: 6 },
  { nLvlPrestId: LVLPREST_ACT2_DESERT_CLIFF_LEFT_KING_ENDS, nRand: 0, nX: 0, nY: 8 },
]

// D2Common.0x6FD7DB70
export function DRLGOUTDESR_PlaceTombEntriesInCanyon(pLevel: D2DrlgLevelStrc): void {
  for (let i = 0; i < pOutDesertCanyonInit.length; i += 1) {
    const entry = pOutDesertCanyonInit[i]!
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, entry.nX, entry.nY, entry.nLvlPrestId, entry.nRand, false)
  }

  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 4, 4, LVLPREST_ACT2_DESERT_VALLEY_WARP, -1, false)
}

// 1.10f: D2Common.0x6FD7DBC0
// 1.11 : D2Common.0x6FDD5600
export function DRLGOUTDESR_PlaceFillsInCanyon(pLevel: D2DrlgLevelStrc): void {
  const nLevelPrestIds1: readonly number[] = [
    LVLPREST_ACT2_DESERT_FILL_BONE_1,
    LVLPREST_ACT2_DESERT_FILL_BONE_2,
    LVLPREST_ACT2_DESERT_FILL_BERMS_3,
    LVLPREST_ACT2_DESERT_FILL_BERMS_4,
    LVLPREST_ACT2_DESERT_FILL_WAGON_1,
  ]
  const nLevelPrestIds2: readonly number[] = [
    LVLPREST_ACT2_DESERT_VALLEY_RUIN_1,
    LVLPREST_ACT2_DESERT_VALLEY_RUIN_2,
  ]

  DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds1, nLevelPrestIds1.length, false)
  DRLGOUTDESR_PlacePresetVariants(pLevel, nLevelPrestIds2, nLevelPrestIds2.length, true)
}
