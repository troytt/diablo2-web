/**
 * D2Common act layout (level placement and level-to-level links): 1:1 port of
 * D2MOO source/D2Common/src/Drlg/DrlgOutPlace.cpp and DrlgOutRoom.cpp (commit 5596f5c, MIT License,
 * Copyright (c) 2020-2025 The Phrozen Keep community): DRLGOUTPLACE_CreateLevelConnections,
 * DRLG_GenerateJungles, and link helpers.
 */

import { D2SEED_AdvanceInline, SEED_RollLimitedRandomNumber, SEED_RollRandomNumber, type D2SeedStrc } from '../rng/d2-rng.ts'
import {
  DRLG_GetDirectionFromCoordinates,
  DRLG_GetDrlgWarpFromLevelId,
  DRLG_GetLevel,
  DRLG_SetWarpId,
} from './drlg-drlg.ts'
import {
  LVLPREST_ACT3_CLEARING_WEBBY_E,
  LVLPREST_ACT3_CLEARING_WEBBY_EW,
  LVLPREST_ACT3_CLEARING_WEBBY_N,
  LVLPREST_ACT3_CLEARING_WEBBY_NE,
  LVLPREST_ACT3_CLEARING_WEBBY_NS,
  LVLPREST_ACT3_CLEARING_WEBBY_NW,
  LVLPREST_ACT3_CLEARING_WEBBY_S,
  LVLPREST_ACT3_CLEARING_WEBBY_SE,
  LVLPREST_ACT3_CLEARING_WEBBY_SW,
  LVLPREST_ACT3_CLEARING_WEBBY_W,
  LVLPREST_ACT3_JUNGLE_E_N,
  LVLPREST_ACT3_JUNGLE_E_S,
  LVLPREST_ACT3_JUNGLE_E_W,
  LVLPREST_ACT3_JUNGLE_EW_N,
  LVLPREST_ACT3_JUNGLE_EW_S,
  LVLPREST_ACT3_JUNGLE_N_E,
  LVLPREST_ACT3_JUNGLE_N_S,
  LVLPREST_ACT3_JUNGLE_N_W,
  LVLPREST_ACT3_JUNGLE_NE_S,
  LVLPREST_ACT3_JUNGLE_NE_W,
  LVLPREST_ACT3_JUNGLE_NEW_S,
  LVLPREST_ACT3_JUNGLE_NS_E,
  LVLPREST_ACT3_JUNGLE_NS_W,
  LVLPREST_ACT3_JUNGLE_NSE_W,
  LVLPREST_ACT3_JUNGLE_NSW_E,
  LVLPREST_ACT3_JUNGLE_NW_E,
  LVLPREST_ACT3_JUNGLE_NW_S,
  LVLPREST_ACT3_JUNGLE_S_E,
  LVLPREST_ACT3_JUNGLE_S_N,
  LVLPREST_ACT3_JUNGLE_S_W,
  LVLPREST_ACT3_JUNGLE_SE_N,
  LVLPREST_ACT3_JUNGLE_SE_W,
  LVLPREST_ACT3_JUNGLE_SEW_N,
  LVLPREST_ACT3_JUNGLE_SW_E,
  LVLPREST_ACT3_JUNGLE_SW_N,
  LVLPREST_ACT3_JUNGLE_TAIL,
  LVLPREST_ACT3_JUNGLE_W_E,
  LVLPREST_ACT3_JUNGLE_W_N,
  LVLPREST_ACT3_JUNGLE_W_S,
  LVLPREST_ACT3_TOWN,
  LVLPREST_NONE,
} from './drlg-ids.ts'
import {
  DRLG_CheckNotOverlappingUsingManhattanDistance,
  DRLG_CheckOverlappingWithOrthogonalMargin,
  DRLGROOM_AddOrth,
  DRLGROOM_GetVisArrayFromLevelId,
} from './drlg-room.ts'
import { DATATBLS_GetLevelDefRecord } from './drlg-tables.ts'
import {
  ACT_I,
  ACT_II,
  ACT_III,
  ACT_IV,
  ACT_V,
  type D2DrlgCoordStrc,
  type D2DrlgLevelStrc,
  type D2DrlgStrc,
  DIRECTION_COUNT,
  DIRECTION_NORTHEAST,
  DIRECTION_NORTHWEST,
  DIRECTION_SOUTHEAST,
  DIRECTION_SOUTHWEST,
  type DrlgEnv,
  DRLGTYPE_OUTDOOR,
  DRLGTYPE_PRESET,
  idiv,
  LEVEL_ARREATPLATEAU,
  LEVEL_BLACKMARSH,
  LEVEL_BLOODMOOR,
  LEVEL_BLOODYFOOTHILLS,
  LEVEL_BURIALGROUNDS,
  LEVEL_CANYONOFTHEMAGI,
  LEVEL_CHAOSSANCTUM,
  LEVEL_CITYOFTHEDAMNED,
  LEVEL_COLDPLAINS,
  LEVEL_DARKWOOD,
  LEVEL_DRYHILLS,
  LEVEL_FAROASIS,
  LEVEL_HARROGATH,
  LEVEL_ID_ACT5_BARRICADE_1,
  LEVEL_KURASTDOCKTOWN,
  LEVEL_LOSTCITY,
  LEVEL_LOWERKURAST,
  LEVEL_LUTGHOLEIN,
  LEVEL_MONASTERYGATE,
  LEVEL_MOOMOOFARM,
  LEVEL_OUTERCLOISTER,
  LEVEL_OUTERSTEPPES,
  LEVEL_PANDEMONIUMFINALE,
  LEVEL_PANDEMONIUMRUN2,
  LEVEL_PLAINSOFDESPAIR,
  LEVEL_ROCKYWASTE,
  LEVEL_ROGUEENCAMPMENT,
  LEVEL_SPIDERFOREST,
  LEVEL_STONYFIELD,
  LEVEL_TAMOEHIGHLAND,
  LEVEL_THEPANDEMONIUMFORTRESS,
  LEVEL_TRAVINCAL,
  LEVEL_TUNDRAWASTELANDS,
  LEVEL_VALLEYOFSNAKES,
  newCoord,
} from './drlg-types.ts'
import { DRLGWARP_GetWarpIdArrayFromLevelId } from './drlg-warp.ts'

/** D2DrlgLevelLinkDataStrc. `nRand` is the C union nRand[4][15] / nRand2[60]: nRand[k][i] = nRand[k * 15 + i]. */
interface D2DrlgLevelLinkDataStrc {
  readonly env: DrlgEnv
  pSeed: D2SeedStrc
  pLevelCoord: D2DrlgCoordStrc[]
  pLink: readonly D2DrlgLinkStrc[]
  nRand: Int32Array
  nIteration: number
  nCurrentLevel: number
}

type Linker = (pLevelLinkData: D2DrlgLevelLinkDataStrc) => boolean

/** D2DrlgLinkStrc */
interface D2DrlgLinkStrc {
  readonly pfLinker: Linker | null
  readonly nLevel: number
  readonly nLevelLink: number
  readonly nLevelLinkEx: number
}

const R = (k: number, i: number): number => k * 15 + i

let dword_6FDEA6FC = 0

/** Pads a link table to its 15 static entries; C zero-initialises the unlisted ones. */
function linkTable(entries: D2DrlgLinkStrc[]): readonly D2DrlgLinkStrc[] {
  const table = entries.slice()
  while (table.length < 15) table.push({ pfLinker: null, nLevel: 0, nLevelLink: 0, nLevelLinkEx: 0 })
  return table
}

//D2Common.0x6FD81330
function sub_6FD81330(d: D2DrlgLevelLinkDataStrc): boolean {
  if (d.nRand[R(1, d.nIteration)] === -1) {
    d.nRand[R(0, d.nIteration)] = -1
  }
  const pLevelDefBinRecord = DATATBLS_GetLevelDefRecord(d.env.tables, d.nCurrentLevel)
  d.pLevelCoord[d.nIteration]!.nPosX = pLevelDefBinRecord.dwOffsetX
  d.pLevelCoord[d.nIteration]!.nPosY = pLevelDefBinRecord.dwOffsetY
  return true
}

//D2Common.0x6FD81380
function sub_6FD81380(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration
  if (d.nRand[R(1, it)] === -1) {
    d.nRand[R(1, it)] = SEED_RollRandomNumber(d.pSeed) & 3
    d.nRand[R(0, it)] = d.nRand[R(1, it)]!
  } else {
    if ((d.nRand[R(0, it)]! + 1) % 4 === d.nRand[R(1, it)]) return false
    d.nRand[R(0, it)] = (d.nRand[R(0, it)]! + 1) % 4
  }
  sub_6FD81430(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 1)
  return true
}

//D2Common.0x6FD81430
function sub_6FD81430(c1: D2DrlgCoordStrc, c2: D2DrlgCoordStrc, a3: number, a4: number): void {
  switch (a3) {
    case 0:
      c2.nPosX = c1.nPosX
      c2.nPosY = c1.nPosY + c1.nHeight
      if (a4 === 1) c2.nPosX -= 16
      break
    case 1:
      c2.nPosX = c1.nPosX - c2.nWidth
      c2.nPosY = c1.nPosY
      if (a4 === 1) c2.nPosY -= 16
      else if (a4 === 2) c2.nPosY += 8
      break
    case 2:
      c2.nPosX = c1.nPosX + c1.nWidth - c2.nWidth
      c2.nPosY = c1.nPosY - c2.nHeight
      if (a4 === 1) c2.nPosX += 16
      break
    case 3:
      c2.nPosX = c1.nPosX + c1.nWidth
      c2.nPosY = c1.nPosY + c1.nHeight - c2.nHeight
      switch (a4) {
        case 1:
          c2.nPosY += 16
          break
        case 2:
          c2.nPosY -= 8
          break
        case 3:
          c2.nPosY += 8
          break
        default:
          break
      }
      break
    default:
      return
  }
}

//D2Common.0x6FD81530
function sub_6FD81530(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration
  if (d.nRand[R(1, it)] === -1) {
    d.nRand[R(1, it)] = SEED_RollRandomNumber(d.pSeed) & 7
    d.nRand[R(0, it)] = d.nRand[R(1, it)]!
  } else {
    if ((d.nRand[R(0, it)]! + 1) % 8 === d.nRand[R(1, it)]) return false
    d.nRand[R(0, it)] = (d.nRand[R(0, it)]! + 1) % 8
  }
  sub_6FD815E0(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 1)
  return true
}

//D2Common.0x6FD815E0
function sub_6FD815E0(c1: D2DrlgCoordStrc, c2: D2DrlgCoordStrc, a3: number, a4: number): void {
  switch (a3) {
    case 0:
      c2.nPosX = c1.nPosX
      c2.nPosY = c1.nPosY + c1.nHeight
      if (a4 === 1) c2.nPosX -= idiv(c2.nWidth, 2) + 8
      break
    case 1:
      c2.nPosX = c1.nPosX
      c2.nPosY = c1.nPosY + c1.nHeight
      if (a4 === 1) c2.nPosX += idiv(c2.nWidth, 2) + 8
      break
    case 2:
      c2.nPosX = c1.nPosX - c2.nWidth
      c2.nPosY = c1.nPosY
      if (a4 === 1) c2.nPosY -= idiv(c2.nHeight, 2) + 8
      break
    case 3:
      c2.nPosX = c1.nPosX - c2.nWidth
      c2.nPosY = c1.nPosY
      if (a4 === 1) c2.nPosY += idiv(c2.nHeight, 2) + 8
      break
    case 4:
      c2.nPosX = c1.nPosX
      c2.nPosY = c1.nPosY - c2.nHeight
      if (a4 === 1) c2.nPosX -= idiv(c2.nWidth, 2) + 8
      break
    case 5:
      c2.nPosX = c1.nPosX
      c2.nPosY = c1.nPosY - c2.nHeight
      if (a4 === 1) c2.nPosX += idiv(c2.nWidth, 2) + 8
      break
    case 6:
      c2.nPosX = c1.nPosX + c1.nWidth
      c2.nPosY = c1.nPosY
      if (a4 === 1) c2.nPosY -= idiv(c2.nHeight, 2) + 8
      break
    case 7:
      c2.nPosX = c1.nPosX + c1.nWidth
      c2.nPosY = c1.nPosY
      if (a4 === 1) c2.nPosY += idiv(c2.nHeight, 2) + 8
      break
    default:
      return
  }
}

//D2Common.0x6FD81720
function sub_6FD81720(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration
  let nRand2 = 0
  if (d.nRand[R(1, it)] === -1) {
    d.nRand[R(1, it)] = SEED_RollRandomNumber(d.pSeed) & 3
    d.nRand[R(0, it)] = d.nRand[R(1, it)]!
    d.nRand[R(3, it)] = SEED_RollRandomNumber(d.pSeed) & 1
    nRand2 = d.nRand[R(3, it)]!
  } else {
    const nRand0 = (d.nRand[R(2, it)]! + d.nRand[R(0, it)]!) % 4
    nRand2 = (d.nRand[R(2, it)]! + 1) % 2
    if (nRand0 === d.nRand[R(1, it)] && nRand2 === d.nRand[R(3, it)]) return false
    d.nRand[R(0, it)] = nRand0
  }
  d.nRand[R(2, it)] = nRand2

  if (d.nRand[R(2, it)] === 1) {
    sub_6FD81430(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 2)
  } else {
    sub_6FD81850(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 2)
  }
  return true
}

//D2Common.0x6FD81850
function sub_6FD81850(c1: D2DrlgCoordStrc, c2: D2DrlgCoordStrc, a3: number, a4: number): void {
  switch (a3) {
    case 0:
      c2.nPosX = c1.nPosX + c1.nWidth - c2.nWidth
      c2.nPosY = c1.nPosY + c1.nHeight
      if (a4 === 1) c2.nPosX += 16
      break
    case 1:
      c2.nPosX = c1.nPosX - c2.nWidth
      c2.nPosY = c1.nPosY + c1.nHeight - c2.nHeight
      if (a4 === 1) c2.nPosY += 16
      else if (a4 === 2) c2.nPosY -= 8
      break
    case 2:
      c2.nPosX = c1.nPosX
      c2.nPosY = c1.nPosY - c2.nHeight
      if (a4 === 1) c2.nPosX -= 16
      break
    case 3:
      c2.nPosX = c1.nPosX + c1.nWidth
      c2.nPosY = c1.nPosY
      switch (a4) {
        case 1:
          c2.nPosY -= 16
          break
        case 2:
          c2.nPosY += 8
          break
        case 3:
          c2.nPosY -= 8
          break
        default:
          break
      }
      break
    default:
      return
  }
}

//D2Common.0x6FD81950
function sub_6FD81950(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration
  let nRand2 = 0
  if (d.nRand[R(1, it)] === -1) {
    d.nRand[R(1, it)] = SEED_RollRandomNumber(d.pSeed) & 3
    d.nRand[R(0, it)] = d.nRand[R(1, it)]!
    d.nRand[R(3, it)] = SEED_RollRandomNumber(d.pSeed) & 1
    nRand2 = d.nRand[R(3, it)]!
  } else {
    const nRand0 = (d.nRand[R(2, it)]! + d.nRand[R(0, it)]!) % 4
    nRand2 = (d.nRand[R(2, it)]! + 1) % 2
    if (nRand0 === d.nRand[R(1, it)] && nRand2 === d.nRand[R(3, it)]) return false
    d.nRand[R(0, it)] = nRand0
  }
  d.nRand[R(2, it)] = nRand2

  d.pLevelCoord[it]!.nWidth = d.nRand[R(0, it)]! % 2 !== 0 ? 96 : 56
  d.pLevelCoord[it]!.nHeight = d.nRand[R(0, it)]! % 2 !== 0 ? 56 : 96

  if (d.nRand[R(2, it)] === 1) {
    sub_6FD81430(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 1)
  } else {
    sub_6FD81850(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 1)
  }
  return true
}

//D2Common.0x6FD81AD0
function sub_6FD81AD0(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration
  d.nRand[R(1, it)] = 0
  d.nRand[R(0, it)] = d.nRand[R(1, it)]!
  sub_6FD81430(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 0)
  return true
}

//D2Common.0x6FD81B30
function sub_6FD81B30(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration
  if (d.nRand[R(1, it)] === -1) {
    d.nRand[R(1, it)] = (SEED_RollRandomNumber(d.pSeed) & 1) + 1
    d.nRand[R(0, it)] = d.nRand[R(1, it)]!
  } else {
    const nRand = 2 - (d.nRand[R(0, it)] !== 1 ? 1 : 0)
    if (nRand === d.nRand[R(1, it)]) return false
    d.nRand[R(0, it)] = nRand
  }

  if (d.nRand[R(0, it)] === 1) {
    sub_6FD81430(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, 1, 0)
  } else {
    sub_6FD81850(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 0)
  }
  return true
}

//D2Common.0x6FD81BF0
function sub_6FD81BF0(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration
  if (d.nRand[R(1, it)] === -1) {
    d.nRand[R(1, it)] = SEED_RollRandomNumber(d.pSeed) & 7
    d.nRand[R(0, it)] = d.nRand[R(1, it)]!
  } else {
    const nRand = (d.nRand[R(0, it)]! + 1) % 8
    if (nRand === d.nRand[R(1, it)]) return false
    d.nRand[R(0, it)] = nRand
  }

  sub_6FD815E0(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 0)
  return true
}

//D2Common.0x6FD81CA0
function sub_6FD81CA0(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration
  d.nRand[R(1, it)] = 3
  d.nRand[R(0, it)] = d.nRand[R(1, it)]!

  if (!(SEED_RollRandomNumber(d.pSeed) & 1)) {
    sub_6FD81850(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 3)
    dword_6FDEA6FC = 0x400000
  } else {
    sub_6FD81430(d.pLevelCoord[d.pLink[it]!.nLevelLink]!, d.pLevelCoord[it]!, d.nRand[R(0, it)]!, 3)
    dword_6FDEA6FC = 0x800000
  }
  return true
}

//D2Common.0x6FD83EC0 (DrlgOutRoom.cpp)
function DRLGOUTROOM_LinkLevelsByLevelCoords(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration
  const nRand = SEED_RollRandomNumber(d.pSeed) & 1

  d.nRand[R(0, it)] = nRand
  d.nRand[R(1, it)] = nRand

  if (nRand === 0) {
    d.pLevelCoord[it]!.nWidth = 64
    d.pLevelCoord[it]!.nHeight = 160
  } else if (nRand === 1) {
    d.pLevelCoord[it]!.nWidth = 160
    d.pLevelCoord[it]!.nHeight = 64
  }

  const pLinkCoord = d.pLevelCoord[d.pLink[it]!.nLevelLink]!
  d.pLevelCoord[it]!.nPosX = pLinkCoord.nPosX - d.pLevelCoord[it]!.nWidth
  d.pLevelCoord[it]!.nPosY = pLinkCoord.nHeight - d.pLevelCoord[it]!.nHeight + pLinkCoord.nPosY - 16

  return true
}

//D2Common.0x6FD83F70 (DrlgOutRoom.cpp)
function DRLGOUTROOM_LinkLevelsByLevelDef(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration
  const nRand = SEED_RollRandomNumber(d.pSeed) & 1

  d.nRand[R(0, it)] = nRand
  d.nRand[R(1, it)] = nRand

  if (nRand === 0) {
    d.pLevelCoord[it]!.nWidth = 64
    d.pLevelCoord[it]!.nHeight = 160
  } else if (nRand === 1) {
    d.pLevelCoord[it]!.nWidth = 160
    d.pLevelCoord[it]!.nHeight = 64
  }

  const pLevelDefBin = DATATBLS_GetLevelDefRecord(d.env.tables, d.nCurrentLevel)
  d.pLevelCoord[it]!.nPosX = pLevelDefBin.dwOffsetX
  d.pLevelCoord[it]!.nPosY = pLevelDefBin.dwOffsetY

  return true
}

const pOffsetCoords_6FD84010: readonly (readonly [number, number])[] = [
  [0, -160],
  [-96, -64],
  [-64, -96],
  [-160, 0],
]

//D2Common.0x6FD84010 (DrlgOutRoom.cpp)
function DRLGOUTROOM_LinkLevelsByOffsetCoords(d: D2DrlgLevelLinkDataStrc): boolean {
  const it = d.nIteration

  if (d.nRand[R(1, it)] === -1) {
    d.nRand[R(1, it)] = SEED_RollRandomNumber(d.pSeed) & 1
    d.nRand[R(0, it)] = d.nRand[R(1, it)]!
  } else {
    const bRand0IsNull = d.nRand[R(0, it)] === 0 ? 1 : 0
    if (bRand0IsNull === d.nRand[R(1, it)]) {
      return false
    }
    d.nRand[R(0, it)] = bRand0IsNull
  }

  if (d.nRand[R(0, it)] === 0) {
    d.pLevelCoord[it]!.nWidth = 64
    d.pLevelCoord[it]!.nHeight = 160
  } else if (d.nRand[R(0, it)] === 1) {
    d.pLevelCoord[it]!.nWidth = 160
    d.pLevelCoord[it]!.nHeight = 64
  }

  const nIndex = d.nRand[R(0, it)]! + 2 * d.nRand[R(0, d.pLink[it]!.nLevelLink)]!
  const pLinkCoord = d.pLevelCoord[d.pLink[it]!.nLevelLink]!

  d.pLevelCoord[it]!.nPosX = pLinkCoord.nPosX + pOffsetCoords_6FD84010[nIndex]![0]
  d.pLevelCoord[it]!.nPosY = pLinkCoord.nPosY + pOffsetCoords_6FD84010[nIndex]![1]

  return true
}

//D2Common.0x6FDCFE40
const gAct1WildernessDrlgLink = linkTable([
  { pfLinker: sub_6FD81330, nLevel: LEVEL_STONYFIELD, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81380, nLevel: LEVEL_COLDPLAINS, nLevelLink: 0, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81950, nLevel: LEVEL_BLOODMOOR, nLevelLink: 1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81720, nLevel: LEVEL_ROGUEENCAMPMENT, nLevelLink: 2, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81380, nLevel: LEVEL_BURIALGROUNDS, nLevelLink: 1, nLevelLinkEx: -1 },
  { pfLinker: null, nLevel: 0, nLevelLink: -1, nLevelLinkEx: -1 },
])

//D2Common.0x6FDCFF30
const gAct1MonasteryDrlgLink = linkTable([
  { pfLinker: sub_6FD81330, nLevel: LEVEL_MOOMOOFARM, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81330, nLevel: LEVEL_MONASTERYGATE, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81AD0, nLevel: LEVEL_TAMOEHIGHLAND, nLevelLink: 1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81380, nLevel: LEVEL_BLACKMARSH, nLevelLink: 2, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81380, nLevel: LEVEL_DARKWOOD, nLevelLink: 3, nLevelLinkEx: -1 },
  { pfLinker: null, nLevel: 0, nLevelLink: -1, nLevelLinkEx: -1 },
])

//D2Common.0x6FDD0020
const gAct2OutdoorDrlgLink = linkTable([
  { pfLinker: sub_6FD81330, nLevel: LEVEL_LUTGHOLEIN, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81B30, nLevel: LEVEL_ROCKYWASTE, nLevelLink: 0, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81530, nLevel: LEVEL_DRYHILLS, nLevelLink: 1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81530, nLevel: LEVEL_FAROASIS, nLevelLink: 2, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81530, nLevel: LEVEL_LOSTCITY, nLevelLink: 3, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81BF0, nLevel: LEVEL_VALLEYOFSNAKES, nLevelLink: 4, nLevelLinkEx: -1 },
  { pfLinker: null, nLevel: 0, nLevelLink: -1, nLevelLinkEx: -1 },
])

//D2Common.0x6FDD0110
const gAct2CanyonDrlgLink = linkTable([
  { pfLinker: sub_6FD81330, nLevel: LEVEL_CANYONOFTHEMAGI, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: null, nLevel: 0, nLevelLink: -1, nLevelLinkEx: -1 },
])

//1.11 : D2Common.0x6FDDC0B8
const gAct5UbersDrlgLink = linkTable([
  { pfLinker: sub_6FD81330, nLevel: LEVEL_PANDEMONIUMRUN2, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81330, nLevel: LEVEL_PANDEMONIUMFINALE, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: null, nLevel: 0, nLevelLink: -1, nLevelLinkEx: -1 },
])

//D2Common.0x6FDD0200
const gAct4OutdoorDrlgLink = linkTable([
  { pfLinker: sub_6FD81330, nLevel: LEVEL_THEPANDEMONIUMFORTRESS, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81CA0, nLevel: LEVEL_OUTERSTEPPES, nLevelLink: 0, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81380, nLevel: LEVEL_PLAINSOFDESPAIR, nLevelLink: 1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81380, nLevel: LEVEL_CITYOFTHEDAMNED, nLevelLink: 2, nLevelLinkEx: -1 },
  { pfLinker: null, nLevel: 0, nLevelLink: -1, nLevelLinkEx: -1 },
])

//D2Common.0x6FDD02F0
const gAct4ChaosSanctumDrlgLink = linkTable([
  { pfLinker: sub_6FD81330, nLevel: LEVEL_CHAOSSANCTUM, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: null, nLevel: 0, nLevelLink: -1, nLevelLinkEx: -1 },
])

//1.10f: D2Common.0x6FDD03E0
const gAct5OutdoorDrlgLink = linkTable([
  { pfLinker: sub_6FD81330, nLevel: LEVEL_HARROGATH, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: sub_6FD81330, nLevel: LEVEL_BLOODYFOOTHILLS, nLevelLink: 0, nLevelLinkEx: -1 },
  { pfLinker: DRLGOUTROOM_LinkLevelsByLevelCoords, nLevel: LEVEL_ID_ACT5_BARRICADE_1, nLevelLink: 1, nLevelLinkEx: -1 },
  { pfLinker: DRLGOUTROOM_LinkLevelsByOffsetCoords, nLevel: LEVEL_ARREATPLATEAU, nLevelLink: 2, nLevelLinkEx: -1 },
  { pfLinker: null, nLevel: 0, nLevelLink: -1, nLevelLinkEx: -1 },
])

//1.10f: D2Common.0x6FDD04D0
const gAct5TundraDrlgLink = linkTable([
  { pfLinker: DRLGOUTROOM_LinkLevelsByLevelDef, nLevel: LEVEL_TUNDRAWASTELANDS, nLevelLink: -1, nLevelLinkEx: -1 },
  { pfLinker: null, nLevel: 0, nLevelLink: -1, nLevelLinkEx: -1 },
])

//D2Common.0x6FD81D60 (1.10)
export function DRLGOUTPLACE_CreateLevelConnections(pDrlg: D2DrlgStrc, nAct: number): void {
  switch (nAct) {
    case ACT_I:
      sub_6FD823C0(pDrlg, gAct1WildernessDrlgLink, sub_6FD82050, sub_6FD82360)
      sub_6FD823C0(pDrlg, gAct1MonasteryDrlgLink, sub_6FD82130, sub_6FD82360)
      sub_6FD82750(pDrlg, LEVEL_ROGUEENCAMPMENT, LEVEL_BURIALGROUNDS)
      break

    case ACT_II:
      sub_6FD823C0(pDrlg, gAct2OutdoorDrlgLink, DRLGOUTPLACE_LinkAct2Outdoors, null)
      sub_6FD823C0(pDrlg, gAct2CanyonDrlgLink, DRLGOUTPLACE_LinkAct2Canyon, null)
      sub_6FD82750(pDrlg, LEVEL_LUTGHOLEIN, LEVEL_CANYONOFTHEMAGI)
      break

    case ACT_III: {
      let pLevel = DRLG_GetLevel(pDrlg, LEVEL_KURASTDOCKTOWN)
      const pTownLevelDef = DATATBLS_GetLevelDefRecord(pDrlg.env.tables, LEVEL_KURASTDOCKTOWN)

      pLevel.pLevelCoords.nPosX = pTownLevelDef.dwOffsetX
      pLevel.pLevelCoords.nPosY = pTownLevelDef.dwOffsetY
      pLevel.pLevelCoords.nWidth = pTownLevelDef.dwSizeX[pDrlg.nDifficulty]!
      pLevel.pLevelCoords.nHeight = pTownLevelDef.dwSizeY[pDrlg.nDifficulty]!

      pLevel = DRLG_GenerateJungles(pLevel)

      let nPosY = 0
      for (let i = LEVEL_LOWERKURAST; i <= LEVEL_TRAVINCAL; i += 1) {
        const pLevelDefBinRecord = DATATBLS_GetLevelDefRecord(pDrlg.env.tables, i)
        const nSizeX = pLevelDefBinRecord.dwSizeX[pLevel.pDrlg.nDifficulty]!
        const nSizeY = pLevelDefBinRecord.dwSizeY[pLevel.pDrlg.nDifficulty]!

        nPosY -= nSizeY

        const pAdjacentLevel = DRLG_GetLevel(pLevel.pDrlg, i)
        pAdjacentLevel.pLevelCoords.nPosX =
          idiv(pLevel.pLevelCoords.nWidth, 2) + pLevel.pLevelCoords.nPosX - idiv(nSizeX, 2)
        pAdjacentLevel.pLevelCoords.nWidth = nSizeX
        pAdjacentLevel.pLevelCoords.nPosY = nPosY + pLevel.pLevelCoords.nPosY
        pAdjacentLevel.pLevelCoords.nHeight = nSizeY
      }

      sub_6FD826D0(pDrlg, LEVEL_KURASTDOCKTOWN, LEVEL_TRAVINCAL)
      sub_6FD82750(pDrlg, LEVEL_KURASTDOCKTOWN, LEVEL_TRAVINCAL)
      break
    }

    case ACT_IV: {
      sub_6FD823C0(pDrlg, gAct4OutdoorDrlgLink, DRLGOUTPLACE_LinkAct4Outdoors, null)
      sub_6FD823C0(pDrlg, gAct4ChaosSanctumDrlgLink, DRLGOUTPLACE_LinkAct4ChaosSanctum, null)

      const pLevel = DRLG_GetLevel(pDrlg, LEVEL_OUTERSTEPPES)
      pLevel.pOutdoors!.dwFlags = (pLevel.pOutdoors!.dwFlags | dword_6FDEA6FC) >>> 0

      sub_6FD82750(pDrlg, LEVEL_THEPANDEMONIUMFORTRESS, LEVEL_CITYOFTHEDAMNED)
      break
    }

    case ACT_V:
      sub_6FD823C0(pDrlg, gAct5OutdoorDrlgLink, null, null)
      sub_6FD823C0(pDrlg, gAct5TundraDrlgLink, null, null)

      sub_6FD826D0(pDrlg, LEVEL_ID_ACT5_BARRICADE_1, LEVEL_ARREATPLATEAU)
      sub_6FD82750(pDrlg, LEVEL_ID_ACT5_BARRICADE_1, LEVEL_ARREATPLATEAU)

      sub_6FD826D0(pDrlg, LEVEL_BLOODYFOOTHILLS, LEVEL_ID_ACT5_BARRICADE_1)
      sub_6FD826D0(pDrlg, LEVEL_HARROGATH, LEVEL_BLOODYFOOTHILLS)
      sub_6FD823C0(pDrlg, gAct5UbersDrlgLink, DRLGOUTPLACE_LinkAct5Ubers, null)
      break

    default:
      return
  }
}

//D2Common.0x6FD82050
const dword_6FDD05C0 = [
  1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 1,
]

function sub_6FD82050(d: D2DrlgLevelLinkDataStrc, nIteration: number): boolean {
  const nLevelLink = gAct1WildernessDrlgLink[nIteration]!.nLevelLink
  for (let i = 0; i < nIteration; i += 1) {
    if (i !== nLevelLink && !DRLG_CheckNotOverlappingUsingManhattanDistance(d.pLevelCoord[nIteration]!, d.pLevelCoord[i]!, 0)) {
      return false
    }
  }
  if (gAct1WildernessDrlgLink[nIteration]!.nLevel !== LEVEL_ROGUEENCAMPMENT) {
    if (gAct1WildernessDrlgLink[nIteration]!.nLevel === LEVEL_BURIALGROUNDS) {
      for (let i = 0; i < 15; i += 1) {
        // nRand2[x] with x < 15 is nRand[0][x].
        if (i !== nIteration && gAct1WildernessDrlgLink[i]!.nLevelLink === nLevelLink && d.nRand[nIteration] === d.nRand[i]) {
          return false
        }
      }
    }
    return true
  }
  const nIndex =
    d.nRand[R(0, nIteration)]! + 4 * (d.nRand[R(2, nIteration)]! + 2 * (d.nRand[R(0, nLevelLink)]! + 4 * d.nRand[R(2, nLevelLink)]!))
  if (nIndex < 0 || nIndex >= dword_6FDD05C0.length) throw new RangeError(`sub_6FD82050: table index ${nIndex}`)
  return dword_6FDD05C0[nIndex] !== 0
}

//D2Common.0x6FD82130
function sub_6FD82130(d: D2DrlgLevelLinkDataStrc, nIteration: number): boolean {
  let nCounter = 0
  while (nCounter < nIteration) {
    if (
      nCounter !== gAct1MonasteryDrlgLink[nIteration]!.nLevelLink &&
      !DRLG_CheckNotOverlappingUsingManhattanDistance(d.pLevelCoord[nIteration]!, d.pLevelCoord[nCounter]!, 0)
    ) {
      return false
    }
    nCounter += 1
  }
  let bResult = true
  if (nIteration) {
    d.pLevelCoord[0]!.nHeight += 200
    d.pLevelCoord[0]!.nPosY -= 200
    // nCounter == nIteration here.
    bResult = DRLG_CheckNotOverlappingUsingManhattanDistance(d.pLevelCoord[0]!, d.pLevelCoord[nCounter]!, 0)
    d.pLevelCoord[0]!.nHeight -= 200
    d.pLevelCoord[0]!.nPosY += 200
  }
  return bResult
}

//D2Common.0x6FD821E0
function DRLGOUTPLACE_LinkAct2Outdoors(d: D2DrlgLevelLinkDataStrc, nIteration: number): boolean {
  const nLevelLink = gAct2OutdoorDrlgLink[nIteration]!.nLevelLink
  for (let i = 0; i < nIteration; i += 1) {
    if (i !== nLevelLink && !DRLG_CheckNotOverlappingUsingManhattanDistance(d.pLevelCoord[nIteration]!, d.pLevelCoord[i]!, 0)) {
      return false
    }
  }
  return true
}

//D2Common.0x6FD82240
function DRLGOUTPLACE_LinkAct2Canyon(d: D2DrlgLevelLinkDataStrc, nIteration: number): boolean {
  const nLevelLink = gAct2CanyonDrlgLink[nIteration]!.nLevelLink
  for (let i = 0; i < nIteration; i += 1) {
    if (i !== nLevelLink && !DRLG_CheckNotOverlappingUsingManhattanDistance(d.pLevelCoord[nIteration]!, d.pLevelCoord[i]!, 0)) {
      return false
    }
  }
  return true
}

//1.11 : D2Common.0x6FD6C560
function DRLGOUTPLACE_LinkAct5Ubers(d: D2DrlgLevelLinkDataStrc, nIteration: number): boolean {
  const nLevelLink = gAct5UbersDrlgLink[nIteration]!.nLevelLink
  for (let i = 0; i < nIteration; i += 1) {
    if (i !== nLevelLink && !DRLG_CheckNotOverlappingUsingManhattanDistance(d.pLevelCoord[nIteration]!, d.pLevelCoord[i]!, 0)) {
      return false
    }
  }
  return true
}

//D2Common.0x6FD822A0
function DRLGOUTPLACE_LinkAct4Outdoors(d: D2DrlgLevelLinkDataStrc, nIteration: number): boolean {
  const nLevelLink = gAct4OutdoorDrlgLink[nIteration]!.nLevelLink
  for (let i = 0; i < nIteration; i += 1) {
    if (i !== nLevelLink && !DRLG_CheckNotOverlappingUsingManhattanDistance(d.pLevelCoord[nIteration]!, d.pLevelCoord[i]!, 0)) {
      return false
    }
  }
  return true
}

//D2Common.0x6FD82300
function DRLGOUTPLACE_LinkAct4ChaosSanctum(d: D2DrlgLevelLinkDataStrc, nIteration: number): boolean {
  const nLevelLink = gAct4ChaosSanctumDrlgLink[nIteration]!.nLevelLink
  for (let i = 0; i < nIteration; i += 1) {
    if (i !== nLevelLink && !DRLG_CheckNotOverlappingUsingManhattanDistance(d.pLevelCoord[nIteration]!, d.pLevelCoord[i]!, 0)) {
      return false
    }
  }
  return true
}

//D2Common.0x6FD82360
const stru_6FDD06C0: readonly (readonly [number, number, number, number, number, number])[] = [
  // nLevelId, nExcludedLevel1, nExcludedLevel2, nRand, nNextRand, nFlags
  [0, LEVEL_BLOODMOOR, LEVEL_COLDPLAINS, 1, 0, 0x04],
  [0, LEVEL_BLOODMOOR, LEVEL_COLDPLAINS, 2, 3, 0x04],
  [0, LEVEL_COLDPLAINS, LEVEL_BURIALGROUNDS, 2, 1, 0x08],
  [0, LEVEL_COLDPLAINS, LEVEL_BURIALGROUNDS, 3, 0, 0x08],
  [0, LEVEL_COLDPLAINS, LEVEL_BURIALGROUNDS, 1, 1, 0x10],
  [0, LEVEL_COLDPLAINS, LEVEL_BURIALGROUNDS, 3, 3, 0x10],
  [LEVEL_BLOODMOOR, 0, 0, 0, 0, 0x08],
  [LEVEL_BLOODMOOR, 0, 0, 2, 2, 0x08],
  [LEVEL_BLOODMOOR, 0, 0, 3, 0, 0x08],
  [LEVEL_BLOODMOOR, 0, 0, 3, 2, 0x08],
  [LEVEL_BLOODMOOR, 0, 0, 0, 1, 0x400],
  [LEVEL_BLOODMOOR, 0, 0, 1, 1, 0x400],
  [LEVEL_BLOODMOOR, 0, 0, 2, 1, 0x200],
  [LEVEL_BLOODMOOR, 0, 0, 2, 2, 0x80],
  [LEVEL_BLOODMOOR, 0, 0, 3, 2, 0x100],
]

function sub_6FD82360(pLevel: D2DrlgLevelStrc, nIteration: number, pRand: Int32Array): void {
  if (pLevel.nDrlgType !== DRLGTYPE_OUTDOOR) return
  for (const [nLevelId, nExcludedLevel1, nExcludedLevel2, nRand, nNextRand, nFlags] of stru_6FDD06C0) {
    if (pLevel.nLevelId === nLevelId || !nLevelId) {
      if (pLevel.nLevelId !== nExcludedLevel1 && pLevel.nLevelId !== nExcludedLevel2 && pRand[nIteration] === nRand) {
        if (pRand[nIteration + 1] === nNextRand) {
          pLevel.pOutdoors!.dwFlags = (pLevel.pOutdoors!.dwFlags | nFlags) >>> 0
        }
      }
    }
  }
}

/** The inlined `lSeed = nHighSeed + 1791398085i64 * nLowSeed` of sub_6FD823C0 (no SEED_* call, no trace). */
function advanceUntraced(pSeed: D2SeedStrc): void {
  D2SEED_AdvanceInline(pSeed)
}

//D2Common.0x6FD823C0
function sub_6FD823C0(
  pDrlg: D2DrlgStrc,
  pDrlgLink: readonly D2DrlgLinkStrc[],
  a3: ((d: D2DrlgLevelLinkDataStrc, nIteration: number) => boolean) | null,
  a4: ((pLevel: D2DrlgLevelStrc, nIteration: number, pRand: Int32Array) => void) | null,
): void {
  const pLevelLinkData: D2DrlgLevelLinkDataStrc = {
    env: pDrlg.env,
    pSeed: { lo: pDrlg.pSeed.lo, hi: pDrlg.pSeed.hi },
    pLevelCoord: Array.from({ length: 15 }, () => newCoord()),
    pLink: pDrlgLink,
    nRand: new Int32Array(60).fill(-1),
    nIteration: 0,
    nCurrentLevel: 0,
  }

  for (let i = 0; i < 15 && pDrlgLink[i]!.nLevel; i += 1) {
    const pLevelDefBinRecord = DATATBLS_GetLevelDefRecord(pDrlg.env.tables, pDrlgLink[i]!.nLevel)
    pLevelLinkData.pLevelCoord[i]!.nWidth = pLevelDefBinRecord.dwSizeX[pDrlg.nDifficulty]!
    pLevelLinkData.pLevelCoord[i]!.nHeight = pLevelDefBinRecord.dwSizeY[pDrlg.nDifficulty]!
  }

  let nCounter = 0
  let nGuard = 0
  while (pDrlgLink[nCounter]!.nLevel) {
    if (++nGuard > 1_000_000) throw new Error('sub_6FD823C0: link solver does not terminate')
    pLevelLinkData.nIteration = nCounter
    pLevelLinkData.nCurrentLevel = pDrlgLink[nCounter]!.nLevel
    if (pDrlgLink[nCounter]!.pfLinker!(pLevelLinkData)) {
      if (!a3 || a3(pLevelLinkData, nCounter)) nCounter += 1
    } else {
      pLevelLinkData.nRand[R(0, nCounter)] = -1
      pLevelLinkData.nRand[R(1, nCounter)] = -1
      pLevelLinkData.nRand[R(2, nCounter)] = -1
      pLevelLinkData.nRand[R(3, nCounter)] = -1
      nCounter -= 1
      if (nCounter < 0) throw new Error('sub_6FD823C0: backtracked past the first link (C reads pDrlgLink[-1])')
    }
  }

  for (let i = 0; i < 15 && pDrlgLink[i]!.nLevel; i += 1) {
    const nVis = pDrlgLink[i]!.nLevelLink !== -1 ? pDrlgLink[pDrlgLink[i]!.nLevelLink]!.nLevel : 0
    const nVisEx = pDrlgLink[i]!.nLevelLinkEx !== -1 ? pDrlgLink[pDrlgLink[i]!.nLevelLinkEx]!.nLevel : 0

    const pLevel = DRLG_GetLevel(pDrlg, pDrlgLink[i]!.nLevel)
    pLevel.pLevelCoords.nPosX = pLevelLinkData.pLevelCoord[i]!.nPosX
    pLevel.pLevelCoords.nPosY = pLevelLinkData.pLevelCoord[i]!.nPosY
    pLevel.pLevelCoords.nWidth = pLevelLinkData.pLevelCoord[i]!.nWidth
    pLevel.pLevelCoords.nHeight = pLevelLinkData.pLevelCoord[i]!.nHeight

    if (pLevel.nDrlgType === DRLGTYPE_PRESET) {
      if (pLevel.nLevelId === LEVEL_ROGUEENCAMPMENT) {
        pLevel.pPreset!.nDirection = pLevelLinkData.nRand[R(0, i)]!
      } else if (pLevel.nLevelId === LEVEL_LUTGHOLEIN) {
        pLevel.pPreset!.nDirection = pLevelLinkData.nRand[R(0, i + 1)]!
      }
    }

    if (pLevel.nLevelId === LEVEL_BLACKMARSH) {
      const pPresetInfo = DRLG_GetLevel(pDrlg, LEVEL_OUTERCLOISTER).pPreset!
      if (pLevelLinkData.nRand[R(0, i)] === 1) {
        advanceUntraced(pDrlg.pSeed)
        pPresetInfo.nDirection = 2 - ((pDrlg.pSeed.lo & 1) !== 0 ? 1 : 0)
      } else if (pLevelLinkData.nRand[R(0, i)] === 3) {
        advanceUntraced(pDrlg.pSeed)
        pPresetInfo.nDirection = ~pDrlg.pSeed.lo & 1
      }
    }

    if (a4) a4(pLevel, i, pLevelLinkData.nRand)

    if (pDrlg.nAct !== ACT_V) {
      if (nVis) {
        const pDrlgWarp1 = DRLG_GetDrlgWarpFromLevelId(pDrlg, pDrlgLink[i]!.nLevel)
        const pDrlgWarp2 = DRLG_GetDrlgWarpFromLevelId(pDrlg, nVis)
        DRLG_SetWarpId(pDrlgWarp1, nVis, -1, -1)
        DRLG_SetWarpId(pDrlgWarp2, pDrlgLink[i]!.nLevel, -1, -1)
      }
      if (nVisEx) {
        const pDrlgWarp1 = DRLG_GetDrlgWarpFromLevelId(pDrlg, pDrlgLink[i]!.nLevel)
        const pDrlgWarp2 = DRLG_GetDrlgWarpFromLevelId(pDrlg, nVisEx)
        DRLG_SetWarpId(pDrlgWarp1, nVisEx, -1, -1)
        DRLG_SetWarpId(pDrlgWarp2, pDrlgLink[i]!.nLevel, -1, -1)
      }
    }
  }
}

//D2Common.0x6FD826D0
function sub_6FD826D0(pDrlg: D2DrlgStrc, nStartId: number, nEndId: number): void {
  for (let i = nStartId; i <= nEndId; i += 1) {
    const pLevel = DRLG_GetLevel(pDrlg, i)
    const pDrlgWarp = DRLG_GetDrlgWarpFromLevelId(pDrlg, i)

    for (let j = nStartId; j <= nEndId; j += 1) {
      if (
        i !== j &&
        DRLG_CheckOverlappingWithOrthogonalMargin(pLevel.pLevelCoords, DRLG_GetLevel(pDrlg, j).pLevelCoords, -1)
      ) {
        DRLG_SetWarpId(pDrlgWarp, j, -1, -1)
      }
    }
  }
}

//D2Common.0x6FD82750
function sub_6FD82750(pDrlg: D2DrlgStrc, nStartId: number, nEndId: number): void {
  for (let i = nStartId; i <= nEndId; i += 1) {
    const pLevel = DRLG_GetLevel(pDrlg, i)
    if (pLevel.nDrlgType === DRLGTYPE_OUTDOOR) {
      const pVisArray = DRLGROOM_GetVisArrayFromLevelId(pDrlg, i)
      const pWarpIdArray = DRLGWARP_GetWarpIdArrayFromLevelId(pDrlg, i)
      for (let j = 0; j < 8; j += 1) {
        if (pVisArray[j] && pWarpIdArray[j] === -1) {
          const pWarpLevel = DRLG_GetLevel(pLevel.pDrlg, pVisArray[j]!)
          pLevel.pOutdoors!.pRoomData = DRLGROOM_AddOrth(
            pLevel.pOutdoors!.pRoomData,
            pWarpLevel,
            DRLG_GetDirectionFromCoordinates(pLevel.pLevelCoords, pWarpLevel.pLevelCoords),
            pWarpLevel.nDrlgType === DRLGTYPE_PRESET,
          )
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Act III Jungle layout (DrlgOutPlace.cpp:1926-2616)
// ---------------------------------------------------------------------------------------------

const JUNGLE_MAX_ATTACH = 3
const JUNGLE_PRESET2_ATTACH_POINT = 2

const JUNGLE_FLAG_LEFT_ = 0b0001
const JUNGLE_FLAG_RIGHT_ = 0b0010
const JUNGLE_FLAG_BOTTOM_ = 0b0100
const JUNGLE_FLAG_TOP_ = 0b1000

interface D2JungleStrc {
  pDrlgCoord: D2DrlgCoordStrc
  field_10: number
  nBranch: number
  pBasedOnJungle: D2JungleStrc | null
  pJungleBranches: (D2JungleStrc | null)[]
  nPresetsBlocksX: number
  nPresetsBlocksY: number
  pJungleDefs: Int32Array | null
  nJungleDefs: number
}

function newJungleStrc(): D2JungleStrc {
  return {
    pDrlgCoord: newCoord(),
    field_10: 0,
    nBranch: 0,
    pBasedOnJungle: null,
    pJungleBranches: [null, null, null],
    nPresetsBlocksX: 0,
    nPresetsBlocksY: 0,
    pJungleDefs: null,
    nJungleDefs: 0,
  }
}

//D2Common.0x6FDD0828
const gJunglePresets: readonly number[] = [
  LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_W_E, LVLPREST_ACT3_JUNGLE_W_S, LVLPREST_ACT3_JUNGLE_W_N,
  LVLPREST_ACT3_JUNGLE_E_W, LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_E_S, LVLPREST_ACT3_JUNGLE_E_N,
  LVLPREST_NONE, LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_EW_S, LVLPREST_ACT3_JUNGLE_EW_N,
  LVLPREST_ACT3_JUNGLE_S_W, LVLPREST_ACT3_JUNGLE_S_E, LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_S_N,
  LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_SW_E, LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_SW_N,
  LVLPREST_ACT3_JUNGLE_SE_W, LVLPREST_NONE, LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_SE_N,
  LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_SEW_N,
  LVLPREST_ACT3_JUNGLE_N_W, LVLPREST_ACT3_JUNGLE_N_E, LVLPREST_ACT3_JUNGLE_N_S, LVLPREST_NONE,
  LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_NW_E, LVLPREST_ACT3_JUNGLE_NW_S, LVLPREST_NONE,
  LVLPREST_ACT3_JUNGLE_NE_W, LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_NE_S, LVLPREST_NONE,
  LVLPREST_NONE, LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_NEW_S, LVLPREST_NONE,
  LVLPREST_ACT3_JUNGLE_NS_W, LVLPREST_ACT3_JUNGLE_NS_E, LVLPREST_NONE, LVLPREST_NONE,
  LVLPREST_NONE, LVLPREST_ACT3_JUNGLE_NSW_E, LVLPREST_NONE, LVLPREST_NONE,
  LVLPREST_ACT3_JUNGLE_NSE_W, LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE,
  LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE,
]

//D2Common.0x6FDD0924
const gSpiderForestPresets: readonly number[] = [
  LVLPREST_NONE, LVLPREST_ACT3_CLEARING_WEBBY_W, LVLPREST_ACT3_CLEARING_WEBBY_E, LVLPREST_ACT3_CLEARING_WEBBY_EW,
  LVLPREST_ACT3_CLEARING_WEBBY_S, LVLPREST_ACT3_CLEARING_WEBBY_SW, LVLPREST_ACT3_CLEARING_WEBBY_SE, LVLPREST_NONE,
  LVLPREST_ACT3_CLEARING_WEBBY_N, LVLPREST_ACT3_CLEARING_WEBBY_NW, LVLPREST_ACT3_CLEARING_WEBBY_NE, LVLPREST_NONE,
  LVLPREST_ACT3_CLEARING_WEBBY_NS, LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE,
  LVLPREST_NONE,
]

const nPresetBlocksDimensions = 32

function DRLG_GenerateJunglesAttachPoints(
  pDrlg: D2DrlgStrc,
  tJungles: D2JungleStrc[],
  nMinX: number,
  nMinY: number,
  nSpiderForestLevelSizeX: number,
  nSpiderForestLevelSizeY: number,
  nPresetsWidth: number,
  nPresetsHeight: number,
  pPreset0: Int32Array,
  pPreset1: Int32Array,
  pPreset2: Int32Array,
  pLevelPresetId: Int32Array,
): void {
  pPreset0.fill(0, 0, nPresetsWidth * nPresetsHeight)
  pPreset1.fill(0, 0, nPresetsWidth * nPresetsHeight)
  pPreset2.fill(0, 0, nPresetsWidth * nPresetsHeight)
  pLevelPresetId.fill(0, 0, nPresetsWidth * nPresetsHeight)

  const nSpiderForestLevelPresetsBlocksSizeX = idiv(nSpiderForestLevelSizeX, nPresetBlocksDimensions)
  const nSpiderForestLevelPresetsBlocksSizeY = idiv(nSpiderForestLevelSizeY, nPresetBlocksDimensions)

  for (let nJungleIdx = 0; nJungleIdx < JUNGLE_MAX_ATTACH; nJungleIdx += 1) {
    const tCurrentJungle = tJungles[nJungleIdx]!
    const nJungleOffsetX = tCurrentJungle.pDrlgCoord.nPosX - nMinX
    const nJungleOffsetY = tCurrentJungle.pDrlgCoord.nPosY - nMinY

    tCurrentJungle.nPresetsBlocksX = (((nJungleOffsetX & 0x1f) + nJungleOffsetX) >> 5) + 1
    tCurrentJungle.nPresetsBlocksY = (((nJungleOffsetY & 0x1f) + nJungleOffsetY) >> 5) + 1

    tCurrentJungle.pJungleDefs = new Int32Array(
      nSpiderForestLevelPresetsBlocksSizeX * nSpiderForestLevelPresetsBlocksSizeY,
    )

    let bLineStartWithOffset: boolean
    if (nJungleIdx !== 0) {
      bLineStartWithOffset = tCurrentJungle.field_10 % 2 !== 0
    } else {
      bLineStartWithOffset = SEED_RollLimitedRandomNumber(pDrlg.pSeed, 2) !== 0
    }

    let nJungleAttachPoints = 0
    while (nJungleAttachPoints < 2) {
      let nPresetBlockRowOffset = tCurrentJungle.nPresetsBlocksX + nPresetsWidth * tCurrentJungle.nPresetsBlocksY
      for (let nPresetBlockY = 0; nPresetBlockY < nSpiderForestLevelPresetsBlocksSizeY; nPresetBlockY += 1) {
        for (let nPresetBlockX = 0; nPresetBlockX < nSpiderForestLevelPresetsBlocksSizeX; nPresetBlockX += 1) {
          const nPresetBlockIndex = nPresetBlockRowOffset + nPresetBlockX
          pPreset0[nPresetBlockIndex] = nJungleIdx + 1
          pPreset1[nPresetBlockIndex] = 0
          pPreset2[nPresetBlockIndex] = 0
          pLevelPresetId[nPresetBlockIndex] = 0
        }
        nPresetBlockRowOffset += nPresetsWidth
      }

      const nFirstPresetsBlockY = tCurrentJungle.nPresetsBlocksY
      const nLastPresetsBlockY = nFirstPresetsBlockY + nSpiderForestLevelPresetsBlocksSizeY - 1

      if (nJungleIdx !== 0) {
        const nFirstPresetsBlockIndex = nLastPresetsBlockY * nPresetsWidth + tCurrentJungle.nPresetsBlocksX
        pPreset2[nFirstPresetsBlockIndex + (bLineStartWithOffset ? 1 : 0)] = 1
        pPreset2[nFirstPresetsBlockIndex + (!bLineStartWithOffset ? 1 : 0)] = JUNGLE_PRESET2_ATTACH_POINT
      }

      for (let nBranchIdx = 0; nBranchIdx < tCurrentJungle.nBranch; nBranchIdx += 1) {
        const pJungleBranch = tCurrentJungle.pJungleBranches[nBranchIdx]!
        let nPresetOffsetX = 0
        let nPresetOffsetY = 0
        switch (pJungleBranch.field_10) {
          case 0:
            break
          case 1:
            nPresetOffsetY = 3
            break
          case 2:
            nPresetOffsetX = 1
            nPresetOffsetY = 3
            break
          case 3:
            nPresetOffsetY = 1
            break
          case 4:
            nPresetOffsetX = 1
            nPresetOffsetY = 1
            break
          default:
            throw new Error(`DRLG_GenerateJunglesAttachPoints: unreachable field_10=${pJungleBranch.field_10}`)
        }
        pPreset2[
          tCurrentJungle.nPresetsBlocksX +
            nPresetOffsetX +
            nPresetsWidth * (tCurrentJungle.nPresetsBlocksY + nPresetOffsetY)
        ] = 1
      }

      nJungleAttachPoints = nJungleIdx !== 0 ? 1 : 0

      const nCurrentPresetsBlockX = tCurrentJungle.nPresetsBlocksX
      let i = 20 * (5 * nJungleIdx + 5)
      let nColumnSize = 0
      for (let nCurrentPresetsBlockY = nLastPresetsBlockY; nCurrentPresetsBlockY >= nFirstPresetsBlockY; ) {
        const nCurrentPresetsBlockRowOffset = nCurrentPresetsBlockY * nPresetsWidth

        pPreset1[nCurrentPresetsBlockRowOffset + nCurrentPresetsBlockX + (bLineStartWithOffset ? 1 : 0)] = i
        i += 1

        if (
          nColumnSize === 0 ||
          nCurrentPresetsBlockY === nFirstPresetsBlockY ||
          SEED_RollLimitedRandomNumber(pDrlg.pSeed, 3) !== 0
        ) {
          nColumnSize += 1

          if (nColumnSize >= 2 && nCurrentPresetsBlockY > 1) {
            const nNextPresetIdx =
              nCurrentPresetsBlockRowOffset + nCurrentPresetsBlockX + (!bLineStartWithOffset ? 1 : 0)

            if (pPreset2[nNextPresetIdx] === 0) {
              pPreset2[nNextPresetIdx] = JUNGLE_PRESET2_ATTACH_POINT
              nJungleAttachPoints += 1
            }
          }
          nCurrentPresetsBlockY -= 1
        } else {
          nColumnSize = 0
          bLineStartWithOffset = !bLineStartWithOffset
        }
      }
    }

    while (nJungleAttachPoints > 3) {
      let bFinished = false
      let nAttachPointsFound = 0
      const nAttachPointToRemove = SEED_RollLimitedRandomNumber(pDrlg.pSeed, nJungleAttachPoints) >>> 0

      for (
        let nCurrentPresetsBlockY = 0;
        nCurrentPresetsBlockY < nSpiderForestLevelPresetsBlocksSizeY && !bFinished;
        nCurrentPresetsBlockY += 1
      ) {
        const nCurrentPresetsBlockOffset =
          tCurrentJungle.nPresetsBlocksX +
          (tCurrentJungle.nPresetsBlocksY + nCurrentPresetsBlockY) * nPresetsWidth

        for (
          let nCurrentPresetsBlockX = 0;
          nCurrentPresetsBlockX < nSpiderForestLevelPresetsBlocksSizeX && !bFinished;
          nCurrentPresetsBlockX += 1
        ) {
          const nCurrentPresetBlockIdx = nCurrentPresetsBlockOffset + nCurrentPresetsBlockX
          if (pPreset2[nCurrentPresetBlockIdx] === JUNGLE_PRESET2_ATTACH_POINT) {
            if (nAttachPointsFound === nAttachPointToRemove) {
              pPreset2[nCurrentPresetBlockIdx] = 0
              bFinished = true
              nJungleAttachPoints -= 1
            }
            nAttachPointsFound += 1
          }
        }
      }
    }
  }
}

function DRLG_JungleComputeConnexity(
  _pDrlg: D2DrlgStrc,
  nPresetsWidth: number,
  nPresetsHeight: number,
  pPreset0: Int32Array,
  pPreset1: Int32Array,
  pPreset2: Int32Array,
  pLevelPresetId: Int32Array,
): void {
  const nMaxValue = 0x7fffffff

  for (let nCurrentPresetY = 0; nCurrentPresetY < nPresetsHeight; nCurrentPresetY += 1) {
    for (let nCurrentPresetX = 0; nCurrentPresetX < nPresetsWidth; nCurrentPresetX += 1) {
      let nFlags = 0
      let nLastDirPreset1Value = nMaxValue

      const nCurrentPresetIndex = nCurrentPresetY * nPresetsWidth + nCurrentPresetX
      const nRightPresetIndex = nCurrentPresetY * nPresetsWidth + nCurrentPresetX + 1
      const nLeftPresetIndex = nCurrentPresetY * nPresetsWidth + nCurrentPresetX - 1
      const nTopPresetIndex = (nCurrentPresetY - 1) * nPresetsWidth + nCurrentPresetX
      const nBottomPresetIndex = (nCurrentPresetY + 1) * nPresetsWidth + nCurrentPresetX

      if (pPreset2[nCurrentPresetIndex] === 1) {
        const nPreset0CurrentValue = pPreset0[nCurrentPresetIndex]!

        const UpdateAccordingToPreset1 = (nPresetIndex: number, nDirectionFlag: number): void => {
          const nPreset1Value = pPreset1[nPresetIndex]!
          if (
            nPreset1Value !== 0 &&
            nPreset1Value < nLastDirPreset1Value &&
            pPreset0[nPresetIndex] === nPreset0CurrentValue
          ) {
            nFlags = nDirectionFlag
            nLastDirPreset1Value = nPreset1Value
          }
        }

        UpdateAccordingToPreset1(nTopPresetIndex, JUNGLE_FLAG_TOP_)
        UpdateAccordingToPreset1(nBottomPresetIndex, JUNGLE_FLAG_BOTTOM_)
        UpdateAccordingToPreset1(nRightPresetIndex, JUNGLE_FLAG_RIGHT_)
        UpdateAccordingToPreset1(nLeftPresetIndex, JUNGLE_FLAG_LEFT_)

        if (nFlags & JUNGLE_FLAG_TOP_) pLevelPresetId[nTopPresetIndex]! |= JUNGLE_FLAG_BOTTOM_
        if (nFlags & JUNGLE_FLAG_BOTTOM_) pLevelPresetId[nBottomPresetIndex]! |= JUNGLE_FLAG_TOP_
        if (nFlags & JUNGLE_FLAG_RIGHT_) pLevelPresetId[nRightPresetIndex]! |= JUNGLE_FLAG_LEFT_
        if (nFlags & JUNGLE_FLAG_LEFT_) pLevelPresetId[nLeftPresetIndex]! |= JUNGLE_FLAG_RIGHT_

        if (pPreset2[nTopPresetIndex] === 1 && pPreset0[nTopPresetIndex] !== nPreset0CurrentValue) {
          nFlags |= JUNGLE_FLAG_TOP_
        }
        if (pPreset2[nBottomPresetIndex] === 1 && pPreset0[nBottomPresetIndex] !== nPreset0CurrentValue) {
          nFlags |= JUNGLE_FLAG_BOTTOM_
        }
        if (pPreset2[nRightPresetIndex] === 1 && pPreset0[nRightPresetIndex] !== nPreset0CurrentValue) {
          nFlags |= JUNGLE_FLAG_RIGHT_
        }
        if (pPreset2[nLeftPresetIndex] === 1 && pPreset0[nLeftPresetIndex] !== nPreset0CurrentValue) {
          nFlags |= JUNGLE_FLAG_LEFT_
        }
      }

      const nPreset1CurrentValue = pPreset1[nCurrentPresetIndex]!
      if (nPreset1CurrentValue) {
        if (Math.abs(pPreset1[nTopPresetIndex]! - nPreset1CurrentValue) === 1) {
          nFlags |= JUNGLE_FLAG_TOP_
        }
        if (Math.abs(pPreset1[nBottomPresetIndex]! - nPreset1CurrentValue) === 1) {
          nFlags |= JUNGLE_FLAG_BOTTOM_
        }
        if (Math.abs(pPreset1[nRightPresetIndex]! - nPreset1CurrentValue) === 1) {
          nFlags |= JUNGLE_FLAG_RIGHT_
        }
        if (Math.abs(pPreset1[nLeftPresetIndex]! - nPreset1CurrentValue) === 1) {
          nFlags |= JUNGLE_FLAG_LEFT_
        }
      }

      pLevelPresetId[nCurrentPresetIndex]! |= nFlags
    }
  }
}

function DRLG_JungleUpdateAttachPointsDirections(
  pDrlg: D2DrlgStrc,
  nPresetsWidth: number,
  nPresetsHeight: number,
  pPreset0: Int32Array,
  pPreset2: Int32Array,
  pLevelPresetId: Int32Array,
): boolean {
  for (let nCurrentPresetY = 0; nCurrentPresetY < nPresetsHeight; nCurrentPresetY += 1) {
    for (let nCurrentPresetX = 0; nCurrentPresetX < nPresetsWidth; nCurrentPresetX += 1) {
      const nCurrentPresetIndex = nCurrentPresetY * nPresetsWidth + nCurrentPresetX

      let nDirectionBase = SEED_RollLimitedRandomNumber(pDrlg.pSeed, DIRECTION_COUNT) | 0

      if (pPreset2[nCurrentPresetIndex] === JUNGLE_PRESET2_ATTACH_POINT) {
        const nRightPresetIndex = nCurrentPresetY * nPresetsWidth + nCurrentPresetX + 1
        const nLeftPresetIndex = nCurrentPresetY * nPresetsWidth + nCurrentPresetX - 1
        const nTopPresetIndex = (nCurrentPresetY - 1) * nPresetsWidth + nCurrentPresetX
        const nBottomPresetIndex = (nCurrentPresetY + 1) * nPresetsWidth + nCurrentPresetX

        const nPreset0CurrentValue = pPreset0[nCurrentPresetIndex]!

        let nCurrentPresetLevelId = pLevelPresetId[nCurrentPresetIndex]!
        const bHadNoPresetLeveld = nCurrentPresetLevelId === 0

        let bLookAtNextDirection = true
        const LookForDirection = (CheckDirectionFunction: (nPresetIndex: number, nFlagToAdd: number) => void): void => {
          for (let i = 0; i < DIRECTION_COUNT && bLookAtNextDirection; i += 1) {
            switch ((nDirectionBase + i) % DIRECTION_COUNT) {
              case DIRECTION_SOUTHWEST:
                CheckDirectionFunction(nTopPresetIndex, JUNGLE_FLAG_TOP_)
                break
              case DIRECTION_NORTHWEST:
                CheckDirectionFunction(nBottomPresetIndex, JUNGLE_FLAG_BOTTOM_)
                break
              case DIRECTION_SOUTHEAST:
                CheckDirectionFunction(nRightPresetIndex, JUNGLE_FLAG_RIGHT_)
                break
              case DIRECTION_NORTHEAST:
                CheckDirectionFunction(nLeftPresetIndex, JUNGLE_FLAG_LEFT_)
                break
              default:
                break
            }
          }
        }

        bLookAtNextDirection = true
        LookForDirection((nPresetIndex, nFlagToAdd) => {
          if (
            pPreset0[nPresetIndex] === nPreset0CurrentValue &&
            pLevelPresetId[nPresetIndex]! !== 0 &&
            pLevelPresetId[nPresetIndex]! < 15
          ) {
            nCurrentPresetLevelId |= nFlagToAdd << 4
            bLookAtNextDirection = false
          }
        })

        if (!nCurrentPresetLevelId) {
          return false
        }

        if (bHadNoPresetLeveld) {
          bLookAtNextDirection = true
          LookForDirection((nPresetIndex, nFlagToAdd) => {
            if (
              pPreset0[nPresetIndex] !== nPreset0CurrentValue &&
              pPreset2[nPresetIndex] === JUNGLE_PRESET2_ATTACH_POINT
            ) {
              nCurrentPresetLevelId |= nFlagToAdd << 4
              bLookAtNextDirection = false
            }
          })

          bLookAtNextDirection = SEED_RollLimitedRandomNumber(pDrlg.pSeed, 2) !== 0 && bLookAtNextDirection

          nDirectionBase = SEED_RollLimitedRandomNumber(pDrlg.pSeed, DIRECTION_COUNT) | 0

          LookForDirection((nPresetIndex, nFlagToAdd) => {
            if (
              pLevelPresetId[nPresetIndex]! !== 0 &&
              pLevelPresetId[nPresetIndex]! < 15 &&
              (nCurrentPresetLevelId & (nFlagToAdd << 4)) === 0
            ) {
              nCurrentPresetLevelId |= nFlagToAdd << 4
              bLookAtNextDirection = false
            }
          })
        }

        if ((nCurrentPresetLevelId & (JUNGLE_FLAG_TOP_ << 4)) !== 0) {
          pLevelPresetId[nTopPresetIndex]! |= JUNGLE_FLAG_BOTTOM_ << 4
        }
        if ((nCurrentPresetLevelId & (JUNGLE_FLAG_BOTTOM_ << 4)) !== 0) {
          pLevelPresetId[nBottomPresetIndex]! |= JUNGLE_FLAG_TOP_ << 4
        }
        if ((nCurrentPresetLevelId & (JUNGLE_FLAG_RIGHT_ << 4)) !== 0) {
          pLevelPresetId[nRightPresetIndex]! |= JUNGLE_FLAG_LEFT_ << 4
        }
        if ((nCurrentPresetLevelId & (JUNGLE_FLAG_LEFT_ << 4)) !== 0) {
          pLevelPresetId[nLeftPresetIndex]! |= JUNGLE_FLAG_RIGHT_ << 4
        }

        pPreset2[nCurrentPresetIndex] = 0
        pLevelPresetId[nCurrentPresetIndex]! |= nCurrentPresetLevelId
      }
    }
  }

  return true
}

function DRLG_JungleNormalizeLevelPresetId(nLevelPresetId: number): number {
  const nbDirections = 16
  let nPDef = idiv(nLevelPresetId, 1) % nbDirections
  if (nPDef !== 0) {
    if (nLevelPresetId < nbDirections) {
      nPDef += LVLPREST_ACT3_TOWN
    } else {
      const nPresetDefinitionOffset = 4 * (nPDef - 1)
      if ((nLevelPresetId & (JUNGLE_FLAG_LEFT_ << 4)) !== 0) nPDef = gJunglePresets[nPresetDefinitionOffset]!
      if ((nLevelPresetId & (JUNGLE_FLAG_RIGHT_ << 4)) !== 0) nPDef = gJunglePresets[nPresetDefinitionOffset + 1]!
      if ((nLevelPresetId & (JUNGLE_FLAG_BOTTOM_ << 4)) !== 0) nPDef = gJunglePresets[nPresetDefinitionOffset + 2]!
      if ((nLevelPresetId & (JUNGLE_FLAG_TOP_ << 4)) !== 0) nPDef = gJunglePresets[nPresetDefinitionOffset + 3]!
    }
  } else if (nLevelPresetId >= nbDirections) {
    nPDef = gSpiderForestPresets[nLevelPresetId >> 4]!
  }
  return nPDef
}

//D2Common.0x6FD82820
export function DRLG_GenerateJungles(pLevel: D2DrlgLevelStrc): D2DrlgLevelStrc {
  const pDrlg = pLevel.pDrlg
  const pSpiderForestLevelDef = DATATBLS_GetLevelDefRecord(pDrlg.env.tables, LEVEL_SPIDERFOREST)
  const nDifficulty = pDrlg.nDifficulty
  const nSpiderForestLevelSizeX = pSpiderForestLevelDef.dwSizeX[nDifficulty]!
  const nSpiderForestLevelSizeY = pSpiderForestLevelDef.dwSizeY[nDifficulty]!
  let nMinX = pLevel.pLevelCoords.nPosX
  let nMaxX = nSpiderForestLevelSizeX + nMinX
  const nMaxY = pLevel.pLevelCoords.nPosY
  let nMinY = nMaxY - nSpiderForestLevelSizeY

  const tJungles: D2JungleStrc[] = [newJungleStrc(), newJungleStrc(), newJungleStrc()]
  sub_6FD83970(pLevel.pLevelCoords, tJungles[0]!, 0, nSpiderForestLevelSizeX, nSpiderForestLevelSizeY)

  for (let nJungleAttachIdx = 1; nJungleAttachIdx < JUNGLE_MAX_ATTACH; nJungleAttachIdx += 1) {
    const nBaseOn = SEED_RollLimitedRandomNumber(pDrlg.pSeed, nJungleAttachIdx) >>> 0

    const pCurrentJungle = tJungles[nJungleAttachIdx]!
    sub_6FD83970(
      tJungles[nBaseOn]!.pDrlgCoord,
      pCurrentJungle,
      SEED_RollLimitedRandomNumber(pDrlg.pSeed, 5) | 0,
      nSpiderForestLevelSizeX,
      nSpiderForestLevelSizeY,
    )

    let nFirstOverlappingJungle = 0
    for (nFirstOverlappingJungle = 0; nFirstOverlappingJungle < nJungleAttachIdx; nFirstOverlappingJungle += 1) {
      const levelsOverlaps = !DRLG_CheckNotOverlappingUsingManhattanDistance(
        tJungles[nFirstOverlappingJungle]!.pDrlgCoord,
        pCurrentJungle.pDrlgCoord,
        0,
      )
      if (levelsOverlaps) {
        break
      }
    }

    if (nFirstOverlappingJungle < nJungleAttachIdx) {
      nJungleAttachIdx -= 1
      continue
    }

    pCurrentJungle.pBasedOnJungle = tJungles[nBaseOn]!
    tJungles[nBaseOn]!.pJungleBranches[tJungles[nBaseOn]!.nBranch] = pCurrentJungle
    tJungles[nBaseOn]!.nBranch += 1

    if (nMinX > pCurrentJungle.pDrlgCoord.nPosX) nMinX = pCurrentJungle.pDrlgCoord.nPosX
    if (nMinY > pCurrentJungle.pDrlgCoord.nPosY) nMinY = pCurrentJungle.pDrlgCoord.nPosY
    if (nMaxX < pCurrentJungle.pDrlgCoord.nWidth + pCurrentJungle.pDrlgCoord.nPosX) {
      nMaxX = pCurrentJungle.pDrlgCoord.nWidth + pCurrentJungle.pDrlgCoord.nPosX
    }
  }

  const nPresetsWidth = idiv(nMaxX - nMinX, nPresetBlocksDimensions) + 2
  const nPresetsHeight = idiv(nMaxY - nMinY, nPresetBlocksDimensions) + 2
  const nPresets = nPresetsWidth * nPresetsHeight

  const pPreset0 = new Int32Array(nPresets)
  const pPreset1 = new Int32Array(nPresets)
  const pPreset2 = new Int32Array(nPresets)
  const pLevelPresetId = new Int32Array(nPresets)

  do {
    DRLG_GenerateJunglesAttachPoints(
      pDrlg,
      tJungles,
      nMinX,
      nMinY,
      nSpiderForestLevelSizeX,
      nSpiderForestLevelSizeY,
      nPresetsWidth,
      nPresetsHeight,
      pPreset0,
      pPreset1,
      pPreset2,
      pLevelPresetId,
    )
    DRLG_JungleComputeConnexity(pDrlg, nPresetsWidth, nPresetsHeight, pPreset0, pPreset1, pPreset2, pLevelPresetId)
  } while (!DRLG_JungleUpdateAttachPointsDirections(pDrlg, nPresetsWidth, nPresetsHeight, pPreset0, pPreset2, pLevelPresetId))

  for (let nCurrentPresetY = 0; nCurrentPresetY < nPresetsHeight; nCurrentPresetY += 1) {
    for (let nCurrentPresetX = 0; nCurrentPresetX < nPresetsWidth; nCurrentPresetX += 1) {
      const nCurrentPresetIndex = nCurrentPresetY * nPresetsWidth + nCurrentPresetX
      pLevelPresetId[nCurrentPresetIndex] = DRLG_JungleNormalizeLevelPresetId(pLevelPresetId[nCurrentPresetIndex]!)
    }
  }

  const nSpiderForestLevelPresetsBlocksSizeX = idiv(nSpiderForestLevelSizeX, nPresetBlocksDimensions)
  const nSpiderForestLevelPresetsBlocksSizeY = idiv(nSpiderForestLevelSizeY, nPresetBlocksDimensions)

  for (let nJungleIdx = 0; nJungleIdx < JUNGLE_MAX_ATTACH; nJungleIdx += 1) {
    const tCurrentJungle = tJungles[nJungleIdx]!
    let nJungleDefsIndex = 0
    for (let nBlockY = 0; nBlockY < nSpiderForestLevelPresetsBlocksSizeY; nBlockY += 1) {
      for (let nBlockX = 0; nBlockX < nSpiderForestLevelPresetsBlocksSizeX; nBlockX += 1) {
        const nCurrentPresetIndex =
          nBlockX + tCurrentJungle.nPresetsBlocksX + nPresetsWidth * (nBlockY + tCurrentJungle.nPresetsBlocksY)
        const nPrestId = pLevelPresetId[nCurrentPresetIndex]!
        tCurrentJungle.pJungleDefs![nJungleDefsIndex] = nPrestId
        if (nPrestId > LVLPREST_ACT3_JUNGLE_TAIL) {
          tCurrentJungle.nJungleDefs += 1
        }
        nJungleDefsIndex += 1
      }
    }
  }

  tJungles.sort((lhs, rhs) => rhs.pDrlgCoord.nPosY - lhs.pDrlgCoord.nPosY)

  let pJungleLevel: D2DrlgLevelStrc | null = null
  for (let i = 0; i < JUNGLE_MAX_ATTACH; i += 1) {
    pJungleLevel = DRLG_GetLevel(pDrlg, i + LEVEL_SPIDERFOREST)
    pJungleLevel.pJungleDefs = tJungles[i]!.pJungleDefs
    pJungleLevel.nJungleDefs = tJungles[i]!.nJungleDefs
    pJungleLevel.pLevelCoords.nPosX = tJungles[i]!.pDrlgCoord.nPosX
    pJungleLevel.pLevelCoords.nPosY = tJungles[i]!.pDrlgCoord.nPosY
    pJungleLevel.pLevelCoords.nWidth = tJungles[i]!.pDrlgCoord.nWidth
    pJungleLevel.pLevelCoords.nHeight = tJungles[i]!.pDrlgCoord.nHeight
  }

  return pJungleLevel!
}

//D2Common.0x6FD83970
function sub_6FD83970(
  pDrlgCoord: D2DrlgCoordStrc,
  pJungle: D2JungleStrc,
  nRand: number,
  nSizeX: number,
  nSizeY: number,
): void {
  let nX = 0
  let nY = 0

  switch (nRand) {
    case 0:
      nX = 0
      nY = -nSizeY
      break

    case 1: {
      nX = -nSizeX
      const mul = Number(BigInt.asUintN(64, 0x55555555n * BigInt.asUintN(64, BigInt(nSizeY))) >> 32n) | 0
      const nTemp = (mul - nSizeY) >> 1
      nY = ((nTemp >>> 31) + nTemp) | 0
      break
    }

    case 2: {
      nX = nSizeX
      const mul = Number(BigInt.asUintN(64, 0x55555555n * BigInt.asUintN(64, BigInt(nSizeY))) >> 32n) | 0
      const nTemp = (mul - nSizeY) >> 1
      nY = ((nTemp >>> 31) + nTemp) | 0
      break
    }

    case 3: {
      nX = -nSizeX
      const nTemp = Number(BigInt.asUintN(64, 0xffffffff55555554n * BigInt.asUintN(64, BigInt(nSizeY))) >> 32n) | 0
      nY = ((nTemp >>> 31) + nTemp) | 0
      break
    }

    case 4: {
      nX = nSizeX
      const nTemp = Number(BigInt.asUintN(64, 0xffffffff55555554n * BigInt.asUintN(64, BigInt(nSizeY))) >> 32n) | 0
      nY = ((nTemp >>> 31) + nTemp) | 0
      break
    }

    default:
      break
  }

  pJungle.pDrlgCoord.nPosX = nX + pDrlgCoord.nPosX
  pJungle.pDrlgCoord.nHeight = nSizeY
  pJungle.pDrlgCoord.nWidth = nSizeX
  pJungle.pDrlgCoord.nPosY = nY + pDrlgCoord.nPosY
  pJungle.field_10 = nRand
}
