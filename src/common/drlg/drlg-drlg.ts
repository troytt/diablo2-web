/**
 * D2Common DRLG lifecycle: 1:1 port of the parts of D2MOO source/D2Common/src/Drlg/DrlgDrlg.cpp
 * (commit 5596f5c, MIT License, Copyright (c) 2020-2025 The Phrozen Keep community) that create an
 * act, its levels and their seeds.
 *
 * Seed chain (D2Common 1.10f addresses, same logic in 1.13c):
 *   game seed nInitSeed -> SEED_InitLowSeed(pDrlg->pSeed) -> dwStartSeed = roll(pDrlg->pSeed)
 *   level seed = SEED_InitLowSeed(levelId + dwStartSeed), re-initialised by DRLG_InitLevel.
 */

import { newD2Seed, SEED_InitLowSeed, SEED_RollRandomNumber } from '../rng/d2-rng.ts'
import { DATATBLS_GetLevelDefRecord, DATATBLS_GetLvlMazeTxtRecordFromLevelId } from './drlg-tables.ts'
import {
  DIRECTION_INVALID,
  DIRECTION_NORTHEAST,
  DIRECTION_NORTHWEST,
  DIRECTION_SOUTHEAST,
  DIRECTION_SOUTHWEST,
  DRLGFLAG_ONCLIENT,
  DRLGLEVELFLAG_AUTOMAP_REVEAL,
  DRLGROOMFLAG_HAS_WARP_0,
  DRLGROOMFLAG_HAS_WARP_MASK,
  DRLGROOMFLAG_HAS_WAYPOINT_MASK,
  DRLGTYPE_MAZE,
  DRLGTYPE_OUTDOOR,
  DRLGTYPE_PRESET,
  LEVEL_HARROGATH,
  LEVEL_KURASTDOCKTOWN,
  LEVEL_LUTGHOLEIN,
  LEVEL_NONE,
  LEVEL_ROGUEENCAMPMENT,
  LEVEL_TALRASHASTOMB1,
  LEVEL_THEPANDEMONIUMFORTRESS,
  newCoord,
  type D2DrlgCoordStrc,
  type D2DrlgLevelStrc,
  type D2DrlgStrc,
  type D2DrlgWarpStrc,
  type DrlgEnv,
} from './drlg-types.ts'
import { DRLGOUTPLACE_CreateLevelConnections } from './drlg-act-links.ts'
import { DRLGMAZE_GenerateLevel } from './drlg-maze.ts'
import { DRLGOUTDOORS_AllocOutdoorInfo, DRLGOUTDOORS_GenerateLevel } from './drlg-outdoors.ts'
import { DRLGPRESET_GenerateLevel, DRLGPRESET_InitLevelData } from './drlg-preset.ts'
import { DRLGWARP_GetWarpDestinationFromArray } from './drlg-warp.ts'

/** DUNGEON_GameTileToSubtileCoords (D2Dungeon): tiles are 5x5 subtiles. */
export function DUNGEON_GameTileToSubtileCoords(nX: number, nY: number): { nX: number; nY: number } {
  return { nX: nX * 5, nY: nY * 5 }
}

//1.10f: D2Common.0x6FD74120 (#10014)
// pAct, hArchive (always null), pGame and the automap callbacks do not influence generation.
export function DRLG_AllocDrlg(
  env: DrlgEnv,
  nActNo: number,
  nInitSeed: number,
  nTownLevelId: number,
  nFlags: number,
  nDifficulty: number,
): D2DrlgStrc {
  const pDrlg: D2DrlgStrc = {
    env,
    pLevel: null,
    nAct: nActNo & 0xff,
    pSeed: newD2Seed(),
    dwStartSeed: 0,
    dwGameLowSeed: 0,
    dwFlags: 0,
    nDifficulty: nDifficulty & 0xff,
    nStaffTombLevel: 0,
    nBossTombLevel: 0,
    bJungleInterlink: 0,
    pWarp: null,
  }

  SEED_InitLowSeed(pDrlg.pSeed, nInitSeed)
  pDrlg.dwStartSeed = SEED_RollRandomNumber(pDrlg.pSeed) >>> 0
  pDrlg.dwFlags = nFlags >>> 0
  pDrlg.dwGameLowSeed = nInitSeed >>> 0

  switch (nActNo) {
    case 0: // ACT_I: D2CMP_10087_LoadTileLibrarySlot(pDrlg->pTiles, "DATA\\GLOBAL\\Tiles\\Act1\\Town\\Floor.dt1")
      break
    case 1: {
      // ACT_II
      let nStaffLevelOffset = 0
      let nBossLevelOffset = 0
      do {
        nStaffLevelOffset = (SEED_RollRandomNumber(pDrlg.pSeed) >>> 0) % 7
        nBossLevelOffset = (SEED_RollRandomNumber(pDrlg.pSeed) >>> 0) % 7
      } while (nStaffLevelOffset === nBossLevelOffset)
      pDrlg.nStaffTombLevel = LEVEL_TALRASHASTOMB1 + nStaffLevelOffset
      pDrlg.nBossTombLevel = LEVEL_TALRASHASTOMB1 + nBossLevelOffset
      break
    }
    case 2: // ACT_III
      pDrlg.bJungleInterlink = SEED_RollRandomNumber(pDrlg.pSeed) & 1
      break
    default:
      break
  }

  // DRLGACTIVATE_InitializeRoomExStatusLists(pDrlg): room status lists are not modelled.
  DRLGOUTPLACE_CreateLevelConnections(pDrlg, nActNo)

  if (nTownLevelId !== LEVEL_NONE) {
    DRLG_InitLevel(DRLG_GetLevel(pDrlg, nTownLevelId))
  }
  return pDrlg
}

//1.10f: D2Common.0x6FD748D0 (#10013)
export function DRLG_AllocLevel(pDrlg: D2DrlgStrc, nLevelId: number): D2DrlgLevelStrc {
  const pLevelDef = DATATBLS_GetLevelDefRecord(pDrlg.env.tables, nLevelId)
  const pLevel: D2DrlgLevelStrc = {
    pDrlg,
    nLevelId,
    nLevelType: pLevelDef.dwLevelType,
    nDrlgType: pLevelDef.dwDrlgType,
    dwFlags: 0,
    pSeed: newD2Seed(),
    dwInitSeed: 0,
    pLevelCoords: newCoord(),
    pFirstRoomEx: null,
    nRooms: 0,
    pPreset: null,
    pOutdoors: null,
    pMaze: null,
    pCurrentMap: null,
    nCoordLists: 0,
    pTileInfo: Array.from({ length: 32 }, () => ({ nPosX: 0, nPosY: 0, nTileIndex: 0 })),
    nTileInfo: 0,
    nRoom_Center_Warp_X: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    nRoom_Center_Warp_Y: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    nRoomCoords: 0,
    pJungleDefs: null,
    nJungleDefs: 0,
    pBuild: null,
    pPresetMaps: null,
    pNextLevel: null,
  }

  if (pDrlg.dwFlags & DRLGFLAG_ONCLIENT) {
    pLevel.dwFlags |= DRLGLEVELFLAG_AUTOMAP_REVEAL
  }

  SEED_InitLowSeed(pLevel.pSeed, (pLevel.nLevelId + pLevel.pDrlg.dwStartSeed) >>> 0)

  switch (pLevel.nDrlgType) {
    case DRLGTYPE_MAZE:
      DRLGMAZE_InitLevelData(pLevel)
      break
    case DRLGTYPE_PRESET:
      DRLGPRESET_InitLevelData(pLevel)
      break
    case DRLGTYPE_OUTDOOR:
      DRLGOUTDOORS_AllocOutdoorInfo(pLevel)
      break
    default:
      throw new Error(`DRLG_AllocLevel(${nLevelId}): D2_UNREACHABLE drlg type ${pLevel.nDrlgType}`)
  }

  pLevel.pNextLevel = pDrlg.pLevel
  pDrlg.pLevel = pLevel
  return pLevel
}

//D2Common.0x6FD749A0 (#10005)
export function DRLG_GetLevel(pDrlg: D2DrlgStrc, nLevelId: number): D2DrlgLevelStrc {
  for (let pLevel = pDrlg.pLevel; pLevel; pLevel = pLevel.pNextLevel) {
    if (pLevel.nLevelId === nLevelId) return pLevel
  }
  return DRLG_AllocLevel(pDrlg, nLevelId)
}

//D2Common.0x6FD749E0
export function DRLG_GetDirectionFromCoordinates(c1: D2DrlgCoordStrc, c2: D2DrlgCoordStrc): number {
  if (c1.nPosX <= c2.nPosX) {
    if (c2.nPosX === c1.nPosX + c1.nWidth) return DIRECTION_SOUTHEAST
  } else if (c1.nPosX === c2.nPosX + c2.nWidth) {
    return DIRECTION_SOUTHWEST
  }
  if (c1.nPosY <= c2.nPosY) {
    if (c2.nPosY === c1.nPosY + c1.nHeight) return DIRECTION_NORTHEAST
  } else if (c1.nPosY === c2.nPosY + c2.nHeight) {
    return DIRECTION_NORTHWEST
  }
  return DIRECTION_INVALID
}

//D2Common.0x6FD74B40
export function DRLG_ComputeLevelWarpInfo(pLevel: D2DrlgLevelStrc): void {
  for (let pDrlgRoom = pLevel.pFirstRoomEx; pDrlgRoom; pDrlgRoom = pDrlgRoom.pDrlgRoomNext) {
    let bHasWarp = (pDrlgRoom.dwFlags & DRLGROOMFLAG_HAS_WAYPOINT_MASK) !== 0
    if ((pDrlgRoom.dwFlags & DRLGROOMFLAG_HAS_WARP_MASK) !== 0 && !bHasWarp) {
      let nWarpIndex = 0
      for (let warpMask = DRLGROOMFLAG_HAS_WARP_0; (warpMask & DRLGROOMFLAG_HAS_WARP_MASK) !== 0; warpMask <<= 1) {
        if (pDrlgRoom.dwFlags & warpMask && DRLGWARP_GetWarpDestinationFromArray(pLevel, nWarpIndex) !== -1) {
          bHasWarp = true
        }
        nWarpIndex += 1
      }
    }
    if (bHasWarp) {
      if (pLevel.nRoomCoords >= 9) throw new RangeError(`level ${pLevel.nLevelId}: more than 9 warp rooms`)
      const c = pDrlgRoom.pDrlgCoord
      const sub = DUNGEON_GameTileToSubtileCoords(c.nPosX + Math.trunc(c.nWidth / 2), c.nPosY + Math.trunc(c.nHeight / 2))
      pLevel.nRoom_Center_Warp_X[pLevel.nRoomCoords] = sub.nX
      pLevel.nRoom_Center_Warp_Y[pLevel.nRoomCoords] = sub.nY
      pLevel.nRoomCoords += 1
    }
  }
}

//D2Common.0x6FD74C10 (#10006)
export function DRLG_InitLevel(pLevel: D2DrlgLevelStrc): void {
  SEED_InitLowSeed(pLevel.pSeed, (pLevel.nLevelId + pLevel.pDrlg.dwStartSeed) >>> 0)

  switch (pLevel.nDrlgType) {
    case DRLGTYPE_MAZE:
      DRLGMAZE_GenerateLevel(pLevel)
      break
    case DRLGTYPE_PRESET:
      DRLGPRESET_GenerateLevel(pLevel)
      break
    case DRLGTYPE_OUTDOOR:
      DRLGOUTDOORS_GenerateLevel(pLevel)
      break
    default:
      return
  }

  if (pLevel.nRooms && pLevel.pPresetMaps) {
    let nCounter = 0
    for (let pDrlgRoom = pLevel.pFirstRoomEx; pDrlgRoom; pDrlgRoom = pDrlgRoom.pDrlgRoomNext) {
      if (nCounter >= pLevel.pPresetMaps.length) throw new RangeError(`level ${pLevel.nLevelId}: pPresetMaps overflow`)
      if (pLevel.pPresetMaps[nCounter]) pDrlgRoom.dwOtherFlags |= 1
      nCounter += 1
    }
  }

  DRLG_ComputeLevelWarpInfo(pLevel)
}

//1.13c: D2Common.0x6FD7D320
export function DRLG_IsTownLevel(nLevelId: number): boolean {
  switch (nLevelId) {
    case LEVEL_ROGUEENCAMPMENT:
    case LEVEL_LUTGHOLEIN:
    case LEVEL_KURASTDOCKTOWN:
    case LEVEL_THEPANDEMONIUMFORTRESS:
    case LEVEL_HARROGATH:
      return true
    default:
      return false
  }
}

//D2Common.0x6FD75270
export function DRLG_SetLevelPositionAndSize(pDrlg: D2DrlgStrc, pLevel: D2DrlgLevelStrc): void {
  const pLevelDefBin = DATATBLS_GetLevelDefRecord(pDrlg.env.tables, pLevel.nLevelId)
  let nX = 0
  let nY = 0
  pLevel.pLevelCoords.nWidth = pLevelDefBin.dwSizeX[pDrlg.nDifficulty]!
  pLevel.pLevelCoords.nHeight = pLevelDefBin.dwSizeY[pDrlg.nDifficulty]!
  if (pLevelDefBin.dwDepend) {
    const pDependLevel = DRLG_GetLevel(pDrlg, pLevelDefBin.dwDepend)
    nX = pDependLevel.pLevelCoords.nPosX
    nY = pDependLevel.pLevelCoords.nPosY
  }
  pLevel.pLevelCoords.nPosX = nX + pLevelDefBin.dwOffsetX
  pLevel.pLevelCoords.nPosY = nY + pLevelDefBin.dwOffsetY
}

//D2Common.0x6FD75300 (#10001)
export function DRLG_GetActNoFromLevelId(nLevelId: number): number {
  const gnTownIds = [LEVEL_ROGUEENCAMPMENT, LEVEL_LUTGHOLEIN, LEVEL_KURASTDOCKTOWN, LEVEL_THEPANDEMONIUMFORTRESS, LEVEL_HARROGATH, 1024]
  let nAct = 1
  while (nLevelId >= gnTownIds[nAct]!) {
    nAct += 1
    if (nAct > 5) return 0
  }
  return nAct - 1
}

//D2Common.0x6FD75370
export function DRLG_GetDrlgWarpFromLevelId(pDrlg: D2DrlgStrc, nLevelId: number): D2DrlgWarpStrc {
  for (let i = pDrlg.pWarp; i; i = i.pNext) {
    if (i.nLevel === nLevelId) return i
  }
  const pLevelDefBin = DATATBLS_GetLevelDefRecord(pDrlg.env.tables, nLevelId)
  const pDrlgWarp: D2DrlgWarpStrc = {
    nLevel: nLevelId,
    nVis: pLevelDefBin.dwVis.slice(0, 8),
    nWarp: pLevelDefBin.dwWarp.slice(0, 8),
    pNext: pDrlg.pWarp,
  }
  pDrlg.pWarp = pDrlgWarp
  return pDrlgWarp
}

//D2Common.0x6FD753F0
export function DRLG_SetWarpId(pDrlgWarp: D2DrlgWarpStrc, nVis: number, nWarp: number, nId: number): void {
  for (let i = 0; i < 8; i += 1) {
    if (pDrlgWarp.nVis[i] === nVis) {
      pDrlgWarp.nWarp[i] = nWarp
      return
    }
  }
  if (nId === -1) {
    for (let i = 0; i < 8; i += 1) {
      if (!pDrlgWarp.nVis[i] && pDrlgWarp.nWarp[i] === -1) {
        pDrlgWarp.nVis[i] = nVis
        pDrlgWarp.nWarp[i] = nWarp
        return
      }
    }
    throw new Error(`DRLG_SetWarpId(level ${pDrlgWarp.nLevel}, vis ${nVis}): D2_UNREACHABLE, no free slot`)
  }
  if (!(nId >= 0 && nId < 8)) throw new Error(`DRLG_SetWarpId: D2_ASSERT(nId >= 0 && nId < 8) failed (${nId})`)
  pDrlgWarp.nVis[nId] = nVis
  pDrlgWarp.nWarp[nId] = nWarp
}

//D2Common.0x6FD74D90
export function DRLG_GetMinAndMaxCoordinatesFromLevel(pLevel: D2DrlgLevelStrc): {
  nTileMinX: number
  nTileMinY: number
  nTileMaxX: number
  nTileMaxY: number
} {
  let pDrlgRoom = pLevel.pFirstRoomEx!
  let nTileMinX = pDrlgRoom.pDrlgCoord.nPosX
  let nTileMinY = pDrlgRoom.pDrlgCoord.nPosY
  let nTileMaxX = pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth
  let nTileMaxY = pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight

  while (pDrlgRoom) {
    if (pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth > nTileMaxX) {
      nTileMaxX = pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth
    }
    if (pDrlgRoom.pDrlgCoord.nPosX < nTileMinX) {
      nTileMinX = pDrlgRoom.pDrlgCoord.nPosX
    }
    if (pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight > nTileMaxY) {
      nTileMaxY = pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight
    }
    if (pDrlgRoom.pDrlgCoord.nPosY < nTileMinY) {
      nTileMinY = pDrlgRoom.pDrlgCoord.nPosY
    }
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext!
  }

  return { nTileMinX, nTileMinY, nTileMaxX, nTileMaxY }
}

//D2Common.0x6FD74E10
export function DRLG_UpdateRoomExCoordinates(pLevel: D2DrlgLevelStrc): void {
  const { nTileMinX, nTileMinY } = DRLG_GetMinAndMaxCoordinatesFromLevel(pLevel)
  let pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    pDrlgRoom.pDrlgCoord.nPosX += pLevel.pLevelCoords.nPosX - nTileMinX
    pDrlgRoom.pDrlgCoord.nPosY += pLevel.pLevelCoords.nPosY - nTileMinY
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext
  }
}

//D2Common.0x6FD79480
export function DRLGMAZE_InitLevelData(pLevel: D2DrlgLevelStrc): void {
  pLevel.pMaze = DATATBLS_GetLvlMazeTxtRecordFromLevelId(pLevel.pDrlg.env.tables, pLevel.nLevelId)
  DRLG_SetLevelPositionAndSize(pLevel.pDrlg, pLevel)
}
