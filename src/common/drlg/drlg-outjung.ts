/**
 * D2Common Act III outdoor jungle/Kurast DRLG: 1:1 port of D2MOO
 * `source/D2Common/src/Drlg/DrlgOutJung.cpp`.
 */

import { SEED_RollLimitedRandomNumber } from '../rng/d2-rng.ts'
import {
  LVLPREST_ACT3_BURBS_BORDER_E,
  LVLPREST_ACT3_BURBS_BORDER_N,
  LVLPREST_ACT3_BURBS_BORDER_NE,
  LVLPREST_ACT3_BURBS_BORDER_NW,
  LVLPREST_ACT3_BURBS_BORDER_S,
  LVLPREST_ACT3_BURBS_BORDER_SE,
  LVLPREST_ACT3_BURBS_BORDER_SW,
  LVLPREST_ACT3_BURBS_BORDER_W,
  LVLPREST_ACT3_JUNGLE_HEAD,
  LVLPREST_ACT3_JUNGLE_TAIL,
  LVLPREST_ACT3_METRO_BORDER_E,
  LVLPREST_ACT3_METRO_BORDER_N,
  LVLPREST_ACT3_METRO_BORDER_NE,
  LVLPREST_ACT3_METRO_BORDER_NW,
  LVLPREST_ACT3_METRO_BORDER_S,
  LVLPREST_ACT3_METRO_BORDER_SE,
  LVLPREST_ACT3_METRO_BORDER_SW,
  LVLPREST_ACT3_METRO_BORDER_W,
  LVLPREST_ACT3_SLUMS_BORDER_E,
  LVLPREST_ACT3_SLUMS_BORDER_N,
  LVLPREST_ACT3_SLUMS_BORDER_NE,
  LVLPREST_ACT3_SLUMS_BORDER_NW,
  LVLPREST_ACT3_SLUMS_BORDER_S,
  LVLPREST_ACT3_SLUMS_BORDER_SE,
  LVLPREST_ACT3_SLUMS_BORDER_SW,
  LVLPREST_ACT3_SLUMS_BORDER_W,
} from './drlg-ids.ts'
import { DRLGOUTDOORS_SpawnOutdoorLevelPresetEx, DRLGOUTDOORS_TestOutdoorLevelPreset } from './drlg-outdoors.ts'
import { DATATBLS_GetLevelDefRecord } from './drlg-tables.ts'
import { type D2DrlgLevelStrc, idiv, imod, LEVEL_FLAYERJUNGLE, LEVEL_SPIDERFOREST } from './drlg-types.ts'

const dword_6FDCFB18: readonly number[] = [0, 10, 20, 0]

const dword_6FDCFB28: readonly number[] = [0, 1, 2, 1, 0, 2, 0, 2, 1, 1, 2, 0, 2, 0, 1, 2, 1, 0]

// D2Common.0x6FD7FC20
export function DRLGOUTJUNG_BuildJungle(pLevel: D2DrlgLevelStrc): void {
  if (pLevel.nLevelId >= LEVEL_SPIDERFOREST && pLevel.nLevelId <= LEVEL_FLAYERJUNGLE) {
    const pLevelDefBin = DATATBLS_GetLevelDefRecord(pLevel.pDrlg.env.tables, LEVEL_SPIDERFOREST)
    const nSizeX = pLevelDefBin.dwSizeX[pLevel.pDrlg.nDifficulty]! >> 5
    const nSizeY = pLevelDefBin.dwSizeY[pLevel.pDrlg.nDifficulty]! >> 5

    const nRand =
      SEED_RollLimitedRandomNumber(pLevel.pSeed, 4 * (pLevel.nJungleDefs === 3 ? 1 : 0) + 2) | 0

    const pJungleDefs = pLevel.pJungleDefs!
    let nDefId = 0
    let nFileIndex = 0

    for (let i = 0; i < nSizeY; i += 1) {
      if (pLevel.nLevelId === LEVEL_SPIDERFOREST && i === nSizeY - 1) {
        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
          pLevel,
          0,
          4 * i,
          LVLPREST_ACT3_JUNGLE_HEAD,
          pJungleDefs[nSizeX * nSizeY - 1] === 0 ? 1 : 0,
          false,
        )
        nDefId += 2
      } else if (pLevel.nLevelId === LEVEL_FLAYERJUNGLE && i === 0) {
        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
          pLevel,
          0,
          0,
          LVLPREST_ACT3_JUNGLE_TAIL,
          pJungleDefs[1] === 0 ? 1 : 0,
          false,
        )
        nDefId += 2
      } else {
        for (let j = 0; j < nSizeX; j += 1) {
          nDefId += 1
          let nJungleDef = pJungleDefs[nDefId - 1]!
          let v19 = 0
          if (nJungleDef > LVLPREST_ACT3_JUNGLE_TAIL) {
            nJungleDef += dword_6FDCFB18[pLevel.nLevelId - 76]!
            v19 = dword_6FDCFB28[nFileIndex + 3 * nRand]!
            nFileIndex += 1
          } else {
            v19 = -1
          }

          if (nJungleDef) {
            DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 4 * j, 4 * i, nJungleDef, v19, false)
          }
        }
      }
    }
  }
}

// D2Common.0x6FD7FE50
export function DRLGOUTJUNG_BuildLowerKurast(pLevel: D2DrlgLevelStrc): void {
  const nWidth = idiv(pLevel.pLevelCoords.nWidth, 8) - 1
  const nHeight = idiv(pLevel.pLevelCoords.nHeight, 8) - 1
  const v5 = idiv(idiv(pLevel.pLevelCoords.nWidth, 8) - 1, 2)
  const v10 = pLevel.pDrlg.bJungleInterlink ? 1 : nWidth - 1

  for (let i = 1; i < nWidth; i += 1) {
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
      pLevel,
      i,
      0,
      8 * (i === v10 ? 1 : 0) + LVLPREST_ACT3_SLUMS_BORDER_N,
      -1,
      false,
    )
  }

  for (let i = 1; i < nWidth; i += (i === v5 ? 1 : 0) + 1) {
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
      pLevel,
      i,
      nHeight,
      8 * (i === v5 ? 1 : 0) + LVLPREST_ACT3_SLUMS_BORDER_S,
      -1,
      false,
    )
  }

  for (let i = 1; i < nHeight; i += 1) {
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nWidth, i, LVLPREST_ACT3_SLUMS_BORDER_E, -1, false)
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, i, LVLPREST_ACT3_SLUMS_BORDER_W, -1, false)
  }

  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, 0, LVLPREST_ACT3_SLUMS_BORDER_NW, -1, false)
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nWidth, 0, LVLPREST_ACT3_SLUMS_BORDER_NE, -1, false)
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, nHeight, LVLPREST_ACT3_SLUMS_BORDER_SW, -1, false)
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nWidth, nHeight, LVLPREST_ACT3_SLUMS_BORDER_SE, -1, false)
}

// D2Common.0x6FD7FFA0
export function DRLGOUTJUNG_BuildKurastBazaar(pLevel: D2DrlgLevelStrc): void {
  const nWidth = idiv(pLevel.pLevelCoords.nWidth, 8) - 1
  const nHeight = idiv(pLevel.pLevelCoords.nHeight, 8) - 1
  let v7 = 0
  let v8 = 0

  if (pLevel.pDrlg.bJungleInterlink) {
    v7 = idiv(pLevel.pLevelCoords.nWidth, 8) - 2
    v8 = 1
  } else {
    v7 = 1
    v8 = idiv(pLevel.pLevelCoords.nWidth, 8) - 2
  }

  for (let i = 1; i < nWidth; i += 1) {
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
      pLevel,
      i,
      0,
      8 * (i === v7 ? 1 : 0) + LVLPREST_ACT3_BURBS_BORDER_N,
      -1,
      false,
    )
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
      pLevel,
      i,
      nHeight,
      8 * (i === v8 ? 1 : 0) + LVLPREST_ACT3_BURBS_BORDER_S,
      -1,
      false,
    )
  }

  for (let i = 1; i < nHeight; i += 1) {
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nWidth, i, LVLPREST_ACT3_BURBS_BORDER_E, -1, false)
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, i, LVLPREST_ACT3_BURBS_BORDER_W, -1, false)
  }

  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, 0, LVLPREST_ACT3_BURBS_BORDER_NW, -1, false)
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nWidth, 0, LVLPREST_ACT3_BURBS_BORDER_NE, -1, false)
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, nHeight, LVLPREST_ACT3_BURBS_BORDER_SW, -1, false)
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nWidth, nHeight, LVLPREST_ACT3_BURBS_BORDER_SE, -1, false)
}

// D2Common.0x6FD800E0
export function DRLGOUTJUNG_BuildUpperKurast(pLevel: D2DrlgLevelStrc): void {
  const nWidth = idiv(pLevel.pLevelCoords.nWidth, 8) - 1
  const nHeight = idiv(pLevel.pLevelCoords.nHeight, 8) - 1
  const v8 = pLevel.pDrlg.bJungleInterlink ? nWidth - 1 : 1
  const nHalfWidth = idiv(nWidth, 2)

  for (let i = 1; i < nWidth; i += (i === nHalfWidth ? 1 : 0) + 1) {
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
      pLevel,
      i,
      0,
      8 * (i === nHalfWidth ? 1 : 0) + LVLPREST_ACT3_METRO_BORDER_N,
      -1,
      false,
    )
  }

  for (let i = 1; i < nWidth; i += 1) {
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(
      pLevel,
      i,
      nHeight,
      8 * (i === v8 ? 1 : 0) + LVLPREST_ACT3_METRO_BORDER_S,
      -1,
      false,
    )
  }

  for (let i = 1; i < nHeight; i += 1) {
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nWidth, i, LVLPREST_ACT3_METRO_BORDER_E, -1, false)
    DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, i, LVLPREST_ACT3_METRO_BORDER_W, -1, false)
  }

  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, 0, LVLPREST_ACT3_METRO_BORDER_NW, -1, false)
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nWidth, 0, LVLPREST_ACT3_METRO_BORDER_NE, -1, false)
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, 0, nHeight, LVLPREST_ACT3_METRO_BORDER_SW, -1, false)
  DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, nWidth, nHeight, LVLPREST_ACT3_METRO_BORDER_SE, -1, false)
}

// D2Common.0x6FD80230
export function DRLGOUTJUNG_SpawnRandomPreset(
  pLevel: D2DrlgLevelStrc,
  nLevelPrestId1: number,
  nLevelPrestId2: number,
  a4: number,
): void {
  const nVariants = (nLevelPrestId2 - nLevelPrestId1 + 1) >>> 0
  let v34 = 0

  const pOutdoors = pLevel.pOutdoors!
  const v8 = Math.imul(pOutdoors.nGridWidth, pOutdoors.nGridHeight)

  if (v8) {
    const v11 = new Int32Array(2 * v8)

    for (let i = 0; i < v8; i += 1) {
      const v12 = idiv(i, pOutdoors.nGridWidth)
      const v13 = imod(i, pOutdoors.nGridWidth)

      v11[2 * i] = v13
      v11[2 * i + 1] = v12
    }

    for (let i = 0; i < v8; i += 1) {
      const v14 = SEED_RollLimitedRandomNumber(pLevel.pSeed, v8) >>> 0
      const v19 = SEED_RollLimitedRandomNumber(pLevel.pSeed, v8) >>> 0

      const v23 = v11[2 * v14]!
      const v24 = v11[2 * v14 + 1]!

      v11[2 * v14] = v11[2 * v19]!
      v11[2 * v14 + 1] = v11[2 * v19 + 1]!

      v11[2 * v19] = v23
      v11[2 * v19 + 1] = v24
    }

    for (let i = 0; i < v8; i += 1) {
      const a2b = v11[2 * i]!
      const a3a = v11[2 * i + 1]!

      const v26 = SEED_RollLimitedRandomNumber(pLevel.pSeed, nVariants) >>> 0

      if (DRLGOUTDOORS_TestOutdoorLevelPreset(pLevel, a2b, a3a, v26 + nLevelPrestId1, 0, 15)) {
        DRLGOUTDOORS_SpawnOutdoorLevelPresetEx(pLevel, a2b, a3a, v26 + nLevelPrestId1, -1, false)

        v34 += 1

        if (a4 > 0 && v34 >= a4) {
          break
        }
      }
    }
  }
}
