/**
 * D2Common DRLG presets: 1:1 port of D2MOO source/D2Common/src/Drlg/DrlgPreset.cpp (commit 5596f5c,
 * MIT License, Copyright (c) 2020-2025 The Phrozen Keep community), the parts used by Act I.
 *
 * DS1 layers are parsed into Int32Arrays that are cached per file path, exactly like
 * gpLevelFilesList_6FDEA700: the grids of every map/room using a file are views into the SAME
 * arrays, so the in-place edits D2Common makes (DRLGPRESET_InitPresetRoomGrids ORs edge flags into
 * the file layers) are shared the same way.
 *
 * D2_ALLOC_POOL memory is zero-filled, as in the native oracle (FOG_AllocPool -> calloc).
 */

import { SEED_RollLimitedRandomNumber, SEED_RollRandomNumber, type D2SeedStrc } from '../rng/d2-rng.ts'
import { DRLGANIM_AllocAnimationTileGrids, DRLGANIM_TestLoadAnimatedRoomTiles } from './drlg-anim.ts'
import {
  DATATBLS_GetLvlPrestTxtRecord,
  DATATBLS_GetLvlPrestTxtRecordFromLevelId,
  DATATBLS_GetMonPresetTxtActSection,
  objectSubClass,
  type DrlgTables,
} from './drlg-tables.ts'
import {
  gObjPresetToObjectId,
  gTileTypeMappingTable,
  LVLPREST_ACT1_BRIDGE,
  LVLPREST_ACT1_GRAVEYARD,
  LVLPREST_ACT1_RIVER_LOWER,
  LVLPREST_ACT1_RIVER_UPPER,
  LVLPREST_ACT1_TOWN_1,
  LVLPREST_ACT1_TOWN_1_TRANSITION_S,
  LVLPREST_ACT1_TRISTRAM,
  LVLPREST_ACT1_WILD_BORDER_1,
  LVLPREST_ACT1_WILD_BORDER_4,
} from './drlg-ids.ts'
import {
  ACT_I,
  ACT_III,
  ACT_V,
  DRLGPRESETROOMFLAG_NONE,
  DRLGPRESETROOMFLAG_SINGLE_ROOM,
  DRLGROOMFLAG_AUTOMAP_REVEAL,
  DRLGROOMFLAG_HAS_WARP_0,
  DRLGROOMFLAG_POPULATION_ZERO,
  DRLGROOMFLAG_PRESET_UNITS_ADDED,
  DRLGSUBST_NONE,
  DRLGSUBST_RANDOM,
  DRLGTYPE_PRESET,
  DRLG_MAX_FLOOR_LAYERS,
  DRLG_MAX_WALL_LAYERS,
  FLAG_OPERATION_OR,
  IMODE_ONGROUND,
  LEVEL_BLOODMOOR,
  LEVEL_BURIALGROUNDS,
  LEVEL_HARROGATH,
  LEVEL_LUTGHOLEIN,
  LEVEL_THEPANDEMONIUMFORTRESS,
  MONMODE_NEUTRAL,
  OBJMODE_NEUTRAL,
  UNIT_ITEM,
  UNIT_MONSTER,
  UNIT_OBJECT,
  newCoord,
  newGrid,
  newPresetRoom,
  newPresetUnit,
  type D2DrlgCoordStrc,
  type D2DrlgFileStrc,
  type D2DrlgGridStrc,
  type D2DrlgLevelStrc,
  type D2DrlgMapStrc,
  type D2DrlgRoomStrc,
  type D2MapAIPathPositionStrc,
  type D2PresetUnitStrc,
  type DrlgEnv,
} from './drlg-types.ts'
import { DRLG_SetLevelPositionAndSize, DUNGEON_GameTileToSubtileCoords } from './drlg-drlg.ts'
import {
  DRLGGRID_AlterAllGridFlags,
  DRLGGRID_AlterEdgeGridFlags,
  DRLGGRID_AlterGridFlag,
  DRLGGRID_AssignCellsOffsetsAndFlags,
  DRLGGRID_FillGrid,
  DRLGGRID_FillNewCellFlags,
  DRLGGRID_GetGridEntry,
  DRLGGRID_ResetGrid,
} from './drlg-grid.ts'
import {
  DRLGROOM_AddRoomExToLevel,
  DRLGROOM_AllocPresetUnit,
  DRLGROOM_AllocRoomEx,
  DRLGROOM_AreXYInsideCoordinates,
  DRLGROOM_GetVisArrayFromLevelId,
} from './drlg-room.ts'
import { DRLGWARP_GetWarpDestinationFromArray } from './drlg-warp.ts'
// Used only inside DRLGPRESET_AddPresetRoomMapTiles (at run time), so these import cycles are harmless.
import { DRLGLOGIC_AllocCoordLists, DRLGLOGIC_InitializeDrlgCoordList } from './drlg-logic.ts'
import {
  DRLGROOMTILE_AllocTileData,
  DRLGROOMTILE_AllocTileGrid,
  DRLGROOMTILE_CountAllTileTypes,
  DRLGROOMTILE_CountWallWarpTiles,
  DRLGROOMTILE_LoadInitRoomTiles,
  PackedTile,
  tileGridOf,
} from './drlg-roomtile.ts'

// D2C_UnitTypes and unit modes: defined in the leaf module drlg-types.ts (see the note there).
export {
  IMODE_ONGROUND,
  MONMODE_NEUTRAL,
  OBJMODE_NEUTRAL,
  UNIT_ITEM,
  UNIT_MISSILE,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_PLAYER,
  UNIT_TILE,
} from './drlg-types.ts'

// D2C_MonsterIds / D2C_SuperUniques (DataTbls/MonsterIds.h)
export const MONSTER_ACT2VENDOR1 = 204
export const MONSTER_ACT2VENDOR2 = 205
export const MONSTER_NAVI = 266
export const MONSTER_NATALYA = 297
export const MONSTER_COMPELLINGORB = 366
export const MONSTER_LIGHTNINGSPIRE = 371
export const MONSTER_FIRETOWER = 372
export const MONSTER_NIHLATHAK = 514
export const MONSTER_ANCIENTSTATUE1 = 537
export const MONSTER_ANCIENTSTATUE2 = 538
export const MONSTER_ANCIENTSTATUE3 = 539
export const SUPERUNIQUE_THE_TORMENTOR = 33
export const SUPERUNIQUE_TAINTBREEDER = 34
export const SUPERUNIQUE_RIFTWRAITH_THE_CANNIBAL = 35

// D2C_ObjectIds (DataTbls/ObjectsIds.h)
export const OBJECT_RIVER1 = 40
export const OBJECT_RIVER2 = 41
export const OBJECT_RIVER3 = 42
export const OBJECT_INVISIBLE_RIVER_SOUND1 = 65
export const OBJECT_FLOORTRAP = 196
export const OBJECT_TOMBFLOORTRAP = 261
export const OBJECT_NATALYA_START = 382
export const OBJECT_COMPELLING_ORB = 404
export const OBJECT_NIHLATHAK_START_IN_TOWN = 461
export const OBJECT_ANCIENTSTATUE3 = 474
export const OBJECT_ANCIENTSTATUE1 = 475
export const OBJECT_ANCIENTSTATUE2 = 476
export const OBJSUBCLASS_WAYPOINT = 0x40

// D2TileType (D2CMP.h)
export const TILETYPE_FLOOR = 0
export const TILETYPE_WALL_LEFT_EXIT = 10
export const TILETYPE_WALL_RIGHT_EXIT = 11
export const TILETYPE_SHADOW = 13

//D2Common.0x6FD859E0 (#11223)
export function DRLGPRESET_GetObjectIndexFromObjPreset(nAct: number, nUnitId: number): number {
  if (nAct < 0 || nAct >= 5 || nUnitId < 0 || nUnitId >= 150) {
    throw new RangeError(`DRLGPRESET_GetObjectIndexFromObjPreset(${nAct}, ${nUnitId}): outside dword_6FDE1180[5][150]`)
  }
  return gObjPresetToObjectId[nAct * 150 + nUnitId]!
}

//D2Common.0x6FD88850
export function DRLGPRESET_MapTileType(nId: number): number {
  if (nId < 0 || nId >= gTileTypeMappingTable.length) throw new RangeError(`DRLGPRESET_MapTileType(${nId})`)
  return gTileTypeMappingTable[nId]!
}

/** `int32_t* pData` walking over a DS1 image (unaligned little-endian reads, bounds-checked). */
class Ds1Cursor {
  private readonly bytes: Uint8Array
  private readonly path: string
  private readonly view: DataView
  offset: number

  constructor(bytes: Uint8Array, offset: number, path: string) {
    this.bytes = bytes
    this.path = path
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.offset = offset
  }

  int32(): number {
    if (this.offset + 4 > this.bytes.byteLength + 16) throw new RangeError(`${this.path}: read past the end of the DS1`)
    const v = this.offset + 4 <= this.bytes.byteLength ? this.view.getInt32(this.offset, true) : 0
    this.offset += 4
    return v
  }

  skipInt32s(n: number): void {
    if (n < 0 || this.offset + 4 * n > this.bytes.byteLength) throw new RangeError(`${this.path}: skip past the end of the DS1`)
    this.offset += 4 * n
  }

  /** `pData = (int*)((char*)pData + strlen((char*)pData) + 1)` */
  skipCString(): void {
    let end = this.offset
    while (end < this.bytes.byteLength && this.bytes[end] !== 0) end += 1
    if (end >= this.bytes.byteLength) throw new RangeError(`${this.path}: unterminated string`)
    this.offset = end + 1
  }

  /** `layer = pData; SkipInt32s(pData, nArea)`, as an owned Int32Array (the cached file layer). */
  layer(nArea: number): Int32Array {
    const out = new Int32Array(nArea)
    for (let i = 0; i < nArea; i += 1) out[i] = this.int32()
    return out
  }
}

//D2Common.0x6FD85A10
export function DRLGPRESET_ParseDS1File(env: DrlgEnv, pDrlgFile: D2DrlgFileStrc, szFileName: string): void {
  const t = env.tables
  const bytes = env.data.readFile(szFileName)
  if (bytes.byteLength < 12) throw new RangeError(`${szFileName}: truncated DS1 header`)
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const nVersion = header.getInt32(0, true)
  pDrlgFile.nWidth = header.getInt32(4, true)
  pDrlgFile.nHeight = header.getInt32(8, true)
  const pData = new Ds1Cursor(bytes, 12, szFileName)

  let nAct = ACT_I
  if (nVersion >= 8) {
    nAct = pData.int32()
    if (nAct > ACT_V) nAct = ACT_V
  }

  pDrlgFile.nSubstMethod = 0
  if (nVersion >= 10) pDrlgFile.nSubstMethod = pData.int32()

  if (nVersion >= 3) {
    const nStrings = pData.int32()
    for (let i = 0; i < nStrings; i += 1) pData.skipCString()
  }

  const nArea = (pDrlgFile.nWidth + 1) * (pDrlgFile.nHeight + 1)
  if (nArea <= 0) throw new RangeError(`${szFileName}: invalid size ${pDrlgFile.nWidth}x${pDrlgFile.nHeight}`)

  if (nVersion >= 9 && nVersion < 14) pData.skipInt32s(2)

  if (nVersion < 4) {
    pDrlgFile.pWallLayer[0] = pData.layer(nArea)
    pDrlgFile.nWallLayers = 1
    pDrlgFile.pFloorLayer[0] = pData.layer(nArea)
    pDrlgFile.pTileTypeLayer[0] = pData.layer(nArea)
    pDrlgFile.pSubstGroupTags = pData.layer(nArea)
  } else {
    pDrlgFile.nWallLayers = pData.int32()
    if (nVersion < 16) {
      pDrlgFile.nFloorLayers = 1
    } else {
      pDrlgFile.nFloorLayers = pData.int32()
    }
    if (pDrlgFile.nWallLayers < 0 || pDrlgFile.nWallLayers > DRLG_MAX_WALL_LAYERS) {
      throw new RangeError(`${szFileName}: ${pDrlgFile.nWallLayers} wall layers overflow pWallLayer[${DRLG_MAX_WALL_LAYERS}]`)
    }
    if (pDrlgFile.nFloorLayers < 0 || pDrlgFile.nFloorLayers > DRLG_MAX_FLOOR_LAYERS) {
      throw new RangeError(`${szFileName}: ${pDrlgFile.nFloorLayers} floor layers overflow pFloorLayer[${DRLG_MAX_FLOOR_LAYERS}]`)
    }
    for (let i = 0; i < pDrlgFile.nWallLayers; i += 1) {
      pDrlgFile.pWallLayer[i] = pData.layer(nArea)
      pDrlgFile.pTileTypeLayer[i] = pData.layer(nArea)
    }
    for (let i = 0; i < pDrlgFile.nFloorLayers; i += 1) {
      pDrlgFile.pFloorLayer[i] = pData.layer(nArea)
    }
  }

  if (nVersion < 7) {
    for (let j = 0; j < pDrlgFile.nWallLayers; j += 1) {
      const pTileTypeLayer = pDrlgFile.pTileTypeLayer[j]!
      for (let i = 0; i < nArea; i += 1) pTileTypeLayer[i] = DRLGPRESET_MapTileType(pTileTypeLayer[i]!)
    }
  }

  pDrlgFile.pShadowLayer = pData.layer(nArea)
  if (pDrlgFile.nSubstMethod > DRLGSUBST_NONE && pDrlgFile.nSubstMethod <= DRLGSUBST_RANDOM) {
    pDrlgFile.pSubstGroupTags = pData.layer(nArea)
  }

  if (nVersion > 1) {
    const nUnits = pData.int32()
    for (let i = 0; i < nUnits; i += 1) {
      let nUnitType = pData.int32()
      let nUnitId = pData.int32()
      let nMode = 0

      switch (nUnitType) {
        case UNIT_MONSTER:
          nMode = MONMODE_NEUTRAL
          if (nVersion > 4) {
            const pSection = DATATBLS_GetMonPresetTxtActSection(t, nAct)
            // D2_VERIFY(pMonPresetTxtSection && nUnitId < nMonPresetRecordsCount): the oracle fails on it.
            if (!(pSection && nUnitId < pSection.count)) {
              throw new Error(`${szFileName}: D2_VERIFY failed: MonPreset act ${nAct} has no record ${nUnitId}`)
            }
            if (nUnitId < 0) throw new RangeError(`${szFileName}: negative MonPreset index ${nUnitId}`)
            const monPresetRecord = t.monPreset[pSection.start + nUnitId]!
            nUnitId = monPresetRecord.wPlace
            switch (monPresetRecord.nType) {
              case 0:
                nUnitId += t.nSuperUniquesTxtRecordCount
                nUnitId += t.nMonStatsTxtRecordCount
                break
              case 1:
                break
              case 2:
                nUnitId += t.nMonStatsTxtRecordCount
                break
              default:
                nUnitId = -1
                break
            }

            switch (nAct) {
              case ACT_III:
                switch (nUnitId) {
                  case MONSTER_NATALYA:
                    nUnitId = OBJECT_NATALYA_START
                    nUnitType = UNIT_OBJECT
                    nMode = OBJMODE_NEUTRAL
                    break
                  case MONSTER_COMPELLINGORB:
                    nUnitId = OBJECT_COMPELLING_ORB
                    nUnitType = UNIT_OBJECT
                    nMode = OBJMODE_NEUTRAL
                    break
                  default:
                    break
                }
                break
              case ACT_V:
                switch (nUnitId) {
                  case MONSTER_NIHLATHAK:
                    nUnitId = OBJECT_NIHLATHAK_START_IN_TOWN
                    nUnitType = UNIT_OBJECT
                    nMode = OBJMODE_NEUTRAL
                    break
                  case MONSTER_ANCIENTSTATUE1:
                    nUnitId = OBJECT_ANCIENTSTATUE2
                    nUnitType = UNIT_OBJECT
                    nMode = OBJMODE_NEUTRAL
                    break
                  case MONSTER_ANCIENTSTATUE2:
                    nUnitId = OBJECT_ANCIENTSTATUE1
                    nUnitType = UNIT_OBJECT
                    nMode = OBJMODE_NEUTRAL
                    break
                  case MONSTER_ANCIENTSTATUE3:
                    nUnitId = OBJECT_ANCIENTSTATUE3
                    nUnitType = UNIT_OBJECT
                    nMode = OBJMODE_NEUTRAL
                    break
                  default:
                    break
                }
                break
              default:
                break
            }
          }
          break

        case UNIT_OBJECT:
          if (nVersion > 5) {
            if (nUnitId >= 150) {
              nUnitId -= 150
            } else {
              nUnitId = DRLGPRESET_GetObjectIndexFromObjPreset(nAct, nUnitId)
            }
          } else if (nUnitId === 573) {
            nUnitId = -1
          }
          break

        case UNIT_ITEM:
          if (nVersion > 4) {
            // DATATBLS_GetItemRecordFromItemCode is outside the DRLG; the oracle fails on it too.
            throw new Error(`${szFileName}: item preset unit in a DS1 (DATATBLS_GetItemRecordFromItemCode is not ported)`)
          }
          nMode = IMODE_ONGROUND
          break

        default:
          break
      }

      const nX = pData.int32()
      const nY = pData.int32()

      let nSpawnFlag = 0
      if (nVersion > 5) nSpawnFlag = pData.int32()

      if (nUnitId >= 0 && (nUnitType !== UNIT_MONSTER || nVersion > 4)) {
        const pNewPresetUnit = DRLGROOM_AllocPresetUnit(null, nUnitType, nUnitId, nMode, nX, nY)
        pNewPresetUnit.pNext = pDrlgFile.pPresetUnit
        pDrlgFile.pPresetUnit = pNewPresetUnit
        pNewPresetUnit.bSpawned |= nSpawnFlag
      }
    }
  }

  if (nVersion >= 12 && pDrlgFile.nSubstMethod > DRLGSUBST_NONE && pDrlgFile.nSubstMethod <= DRLGSUBST_RANDOM) {
    if (nVersion >= 18) pData.skipInt32s(1)

    pDrlgFile.nSubstGroups = pData.int32()
    if (pDrlgFile.nSubstGroups < 0) throw new RangeError(`${szFileName}: ${pDrlgFile.nSubstGroups} substitution groups`)
    pDrlgFile.pSubstGroups = []
    for (let i = 0; i < pDrlgFile.nSubstGroups; i += 1) {
      const tBox = newCoord()
      tBox.nPosX = pData.int32()
      tBox.nPosY = pData.int32()
      tBox.nWidth = pData.int32()
      tBox.nHeight = pData.int32()
      // field_10 is never read from the file; D2_ALLOC_POOL memory is zero-filled (oracle calloc).
      let field_14 = 0
      if (nVersion >= 13) field_14 = pData.int32()
      pDrlgFile.pSubstGroups.push({ tBox, field_10: 0, field_14 })
    }
  }

  if (nVersion >= 14) {
    const v59 = pData.int32()
    for (let i = 0; i < v59; i += 1) {
      const nNodes = pData.int32()
      const nX = pData.int32()
      const nY = pData.int32()
      if (nNodes) {
        // Find unit with given position
        let pPresetUnit = pDrlgFile.pPresetUnit
        while (pPresetUnit) {
          if (pPresetUnit.nXpos === nX && pPresetUnit.nYpos === nY) break
          pPresetUnit = pPresetUnit.pNext
        }
        if (pPresetUnit) {
          if (nNodes < 0) throw new RangeError(`${szFileName}: ${nNodes} path nodes`)
          const pPosition: D2MapAIPathPositionStrc[] = []
          for (let j = 0; j < nNodes; j += 1) {
            const nPosX = pData.int32()
            const nPosY = pData.int32()
            const nMapAIAction = nVersion < 15 ? 1 : pData.int32()
            pPosition.push({ nX: nPosX, nY: nPosY, nMapAIAction })
          }
          pPresetUnit.pMapAI = pPosition
        } else {
          // Unit not found, skip path
          pData.skipInt32s(2 * nNodes)
          if (nVersion >= 15) pData.skipInt32s(nNodes)
        }
      }
    }
  }
}

function newDrlgFile(szPath: string): D2DrlgFileStrc {
  return {
    nSubstMethod: 0,
    szPath,
    nWidth: 0,
    nHeight: 0,
    nWallLayers: 0,
    nFloorLayers: 0,
    pTileTypeLayer: [null, null, null, null],
    pWallLayer: [null, null, null, null],
    pFloorLayer: [null, null],
    pShadowLayer: null,
    pSubstGroupTags: null,
    nSubstGroups: 0,
    pSubstGroups: [],
    pPresetUnit: null,
  }
}

//D2Common.0x6FD86050
// Returns the cached or newly parsed file (C: *ppDrlgFile). The cache key is the exact path
// string (strcmp), as in gpLevelFilesList_6FDEA700.
export function DRLGPRESET_LoadDrlgFile(env: DrlgEnv, szFile: string): D2DrlgFileStrc {
  const cached = env.fileCache.get(szFile)
  if (cached) return cached
  const pFile = newDrlgFile(szFile)
  env.fileCache.set(szFile, pFile)
  DRLGPRESET_ParseDS1File(env, pFile, szFile)
  return pFile
}

//D2Common.0x6FD86310
export function DRLGPRESET_CopyPresetUnit(pPresetUnit: D2PresetUnitStrc, nX: number, nY: number): D2PresetUnitStrc {
  const pNewPresetUnit = newPresetUnit()
  pNewPresetUnit.nUnitType = pPresetUnit.nUnitType
  pNewPresetUnit.nIndex = pPresetUnit.nIndex
  pNewPresetUnit.nMode = pPresetUnit.nMode
  pNewPresetUnit.nXpos = nX + pPresetUnit.nXpos
  pNewPresetUnit.nYpos = nY + pPresetUnit.nYpos
  pNewPresetUnit.bSpawned = pPresetUnit.bSpawned
  if (pPresetUnit.pMapAI) {
    pNewPresetUnit.pMapAI = pPresetUnit.pMapAI.map(p => ({ nX: p.nX + nX, nY: p.nY + nY, nMapAIAction: p.nMapAIAction }))
  }
  return pNewPresetUnit
}

//D2Common.0x6FD86540
export function DRLGPRESET_AddPresetUnitToDrlgMap(t: DrlgTables, pDrlgMap: D2DrlgMapStrc, pSeed: D2SeedStrc): void {
  const sub = DUNGEON_GameTileToSubtileCoords(pDrlgMap.pDrlgCoord.nPosX, pDrlgMap.pDrlgCoord.nPosY)
  const nX = sub.nX
  const nY = sub.nY

  for (let pPresetUnit = pDrlgMap.pFile!.pPresetUnit; pPresetUnit; pPresetUnit = pPresetUnit.pNext) {
    if (pPresetUnit.nUnitType === UNIT_MONSTER) {
      let nIndex = pPresetUnit.nIndex
      if (nIndex < t.nMonStatsTxtRecordCount) {
        if (nIndex < 0 || nIndex >= t.nMonStatsTxtRecordCount) nIndex = -1
        switch (nIndex) {
          case MONSTER_ACT2VENDOR1:
          case MONSTER_ACT2VENDOR2:
          case MONSTER_LIGHTNINGSPIRE:
          case MONSTER_FIRETOWER:
            if ((SEED_RollRandomNumber(pSeed) >>> 0) % 3) continue
            break
          default:
            break
        }
      } else if (pPresetUnit.nIndex - t.nMonStatsTxtRecordCount >= t.nSuperUniquesTxtRecordCount) {
        const nPlace = pPresetUnit.nIndex - t.nMonStatsTxtRecordCount - t.nSuperUniquesTxtRecordCount
        if (nPlace === SUPERUNIQUE_THE_TORMENTOR) {
          if (!(SEED_RollRandomNumber(pSeed) & 3)) continue
        } else if (nPlace === SUPERUNIQUE_TAINTBREEDER) {
          if (!(SEED_RollRandomNumber(pSeed) & 1)) continue
        } else if (nPlace === SUPERUNIQUE_RIFTWRAITH_THE_CANNIBAL) {
          if (SEED_RollRandomNumber(pSeed) & 3) continue
        }
      }
    } else if (pPresetUnit.nUnitType === UNIT_OBJECT) {
      if (pPresetUnit.nIndex === OBJECT_FLOORTRAP || pPresetUnit.nIndex === OBJECT_TOMBFLOORTRAP) {
        if (SEED_RollRandomNumber(pSeed) & 1) continue
      } else if (pPresetUnit.nIndex === 581) {
        if (!(SEED_RollRandomNumber(pSeed) & 3)) continue
      }
    }

    const pNewPresetUnit = DRLGPRESET_CopyPresetUnit(pPresetUnit, nX, nY)
    pNewPresetUnit.pNext = pDrlgMap.pPresetUnit
    pDrlgMap.pPresetUnit = pNewPresetUnit
  }
}

//D2Common.0x6FD86D80
export function DRLGPRESET_AllocPresetRoomData(pDrlgRoom: D2DrlgRoomStrc): void {
  pDrlgRoom.pMaze = newPresetRoom()
}

//D2Common.0x6FD86DC0
export function DRLGPRESET_InitPresetRoomData(
  pLevel: D2DrlgLevelStrc,
  pDrlgMap: D2DrlgMapStrc,
  pDrlgCoord: D2DrlgCoordStrc,
  dwDT1Mask: number,
  dwRoomFlags: number,
  dwPresetFlags: number,
  a7: D2DrlgGridStrc | null,
): D2DrlgRoomStrc {
  const pDrlgRoom = DRLGROOM_AllocRoomEx(pLevel, DRLGTYPE_PRESET)

  pDrlgRoom.dwDT1Mask = dwDT1Mask >>> 0
  pDrlgRoom.dwFlags = (pDrlgRoom.dwFlags | dwRoomFlags) >>> 0

  pDrlgRoom.pDrlgCoord.nPosX = pDrlgCoord.nPosX
  pDrlgRoom.pDrlgCoord.nPosY = pDrlgCoord.nPosY
  pDrlgRoom.pDrlgCoord.nWidth = pDrlgCoord.nWidth
  pDrlgRoom.pDrlgCoord.nHeight = pDrlgCoord.nHeight

  const pDrlgPresetRoom = pDrlgRoom.pMaze!
  pDrlgPresetRoom.pMap = pDrlgMap
  pDrlgPresetRoom.dwFlags = dwPresetFlags >>> 0
  pDrlgPresetRoom.nLevelPrest = pDrlgMap.pLvlPrestTxtRecord.dwDef
  pDrlgPresetRoom.pMazeGrid = a7
  if (a7) a7.nHeight |= 1

  if (!pDrlgPresetRoom.pMap!.pLvlPrestTxtRecord.dwPopulate) {
    pDrlgRoom.dwFlags = (pDrlgRoom.dwFlags | DRLGROOMFLAG_POPULATION_ZERO) >>> 0
  }

  DRLGROOM_AddRoomExToLevel(pLevel, pDrlgRoom)
  return pDrlgRoom
}

//D2Common.0x6FD87560
export function DRLGPRESET_BuildArea(pLevel: D2DrlgLevelStrc, pDrlgMap: D2DrlgMapStrc, nFlags: number, bSingleRoom: boolean): D2DrlgRoomStrc | null {
  if (pDrlgMap.pLvlPrestTxtRecord.dwOutdoors) nFlags = (nFlags | 0x80000) >>> 0

  // int nCellPos[1024]; int nCellFlags[256];
  const nCellPos = new Int32Array(1024)
  const nCellFlags = new Int32Array(256)
  const nGridWidth = Math.trunc(pDrlgMap.pDrlgCoord.nWidth / 8) + 1
  const nGridHeight = Math.trunc(pDrlgMap.pDrlgCoord.nHeight / 8) + 1
  if (nGridHeight > 256) throw new RangeError(`DRLGPRESET_BuildArea: ${nGridHeight} rows overflow nCellFlags[256]`)
  const tDrlgGrid = newGrid()
  DRLGGRID_FillGrid(tDrlgGrid, nGridWidth, nGridHeight, nCellPos, 0, nCellFlags)
  DRLGPRESET_BuildPresetArea(pLevel, tDrlgGrid, nFlags, pDrlgMap, bSingleRoom)

  let pDrlgRoom: D2DrlgRoomStrc | null = null
  if (bSingleRoom) {
    pDrlgRoom = DRLGPRESET_InitPresetRoomData(
      pLevel,
      pDrlgMap,
      pDrlgMap.pDrlgCoord,
      pDrlgMap.pLvlPrestTxtRecord.dwDt1Mask,
      DRLGGRID_GetGridEntry(tDrlgGrid, 0, 0),
      DRLGPRESETROOMFLAG_SINGLE_ROOM,
      null,
    )
  } else {
    const nXEnd = pDrlgMap.pDrlgCoord.nPosX + pDrlgMap.pDrlgCoord.nWidth
    const nYEnd = pDrlgMap.pDrlgCoord.nPosY + pDrlgMap.pDrlgCoord.nHeight
    const tDrlgCoord = newCoord()
    let nGridY = 0
    for (let nY = pDrlgMap.pDrlgCoord.nPosY; nY < nYEnd; nY += 8) {
      const nDeltaToEndY = nYEnd - nY
      tDrlgCoord.nPosY = nY
      let nGridX = 0
      for (let nX = pDrlgMap.pDrlgCoord.nPosX; nX < nXEnd; nX += 8) {
        const nDeltaToEndX = nXEnd - nX
        tDrlgCoord.nPosX = nX
        tDrlgCoord.nWidth = nDeltaToEndX
        if (nDeltaToEndX >= 8) tDrlgCoord.nWidth = 8
        tDrlgCoord.nHeight = nDeltaToEndY
        if (nDeltaToEndY >= 8) tDrlgCoord.nHeight = 8

        const nGridFlags = DRLGGRID_GetGridEntry(tDrlgGrid, nGridX, nGridY)
        if (tDrlgCoord.nWidth && tDrlgCoord.nHeight) {
          // C passes `(D2DrlgGridStrc*)(pDrlgMap->bHasInfo ? nGridFlags : 0)`: an int reinterpreted as a
          // pointer. Only maze/jungle maps carry bHasInfo; reaching it here would be a porting error.
          if (pDrlgMap.bHasInfo) throw new Error('DRLGPRESET_BuildArea: bHasInfo maps are not ported')
          pDrlgRoom = DRLGPRESET_InitPresetRoomData(
            pLevel,
            pDrlgMap,
            tDrlgCoord,
            pDrlgMap.pLvlPrestTxtRecord.dwDt1Mask,
            nGridFlags,
            DRLGPRESETROOMFLAG_NONE,
            null,
          )
        }
        nGridX += 1
      }
      nGridY += 1
    }
  }
  DRLGGRID_ResetGrid(tDrlgGrid)
  return pDrlgRoom
}

//D2Common.0x6FD87760
export function DRLGPRESET_BuildPresetArea(
  pLevel: D2DrlgLevelStrc,
  pDrlgGrid: D2DrlgGridStrc,
  nFlags: number,
  pDrlgMap: D2DrlgMapStrc,
  bSingleRoom: boolean,
): void {
  const env = pLevel.pDrlg.env
  const pVisArray = DRLGROOM_GetVisArrayFromLevelId(pLevel.pDrlg, pLevel.nLevelId)
  for (let i = 0; i < 8; i += 1) {
    if (pVisArray[i] && DRLGWARP_GetWarpDestinationFromArray(pLevel, i) === -1) {
      nFlags = (nFlags | (DRLGROOMFLAG_HAS_WARP_0 << i)) >>> 0
    }
  }

  DRLGGRID_AlterAllGridFlags(pDrlgGrid, nFlags, FLAG_OPERATION_OR)

  const pRecord = pDrlgMap.pLvlPrestTxtRecord
  const nPresetTxtRecordNumberPops = pRecord.dwPops >>> 0
  let nProcessedPops = 0

  if (!(pRecord.dwScan || nPresetTxtRecordNumberPops)) return

  pDrlgMap.pFile = DRLGPRESET_LoadDrlgFile(env, pRecord.szFile[pDrlgMap.nPickedFile]!)
  DRLGPRESET_AddPresetUnitToDrlgMap(env.tables, pDrlgMap, pLevel.pSeed)
  const pFile = pDrlgMap.pFile

  // FOG_DisplayWarning: the oracle's warning handler fails fast.
  if (pFile.nWidth !== pDrlgMap.pDrlgCoord.nWidth) {
    throw new Error(`${pFile.szPath}: ptRegion->ptFile->nSizeX == ptRegion->tCoords.nSizeTileX (${pFile.nWidth} != ${pDrlgMap.pDrlgCoord.nWidth})`)
  }
  if (pFile.nHeight !== pDrlgMap.pDrlgCoord.nHeight) {
    throw new Error(`${pFile.szPath}: ptRegion->ptFile->nSizeY == ptRegion->tCoords.nSizeTileY (${pFile.nHeight} != ${pDrlgMap.pDrlgCoord.nHeight})`)
  }

  if (nPresetTxtRecordNumberPops) {
    pDrlgMap.pPopsIndex = new Int32Array(nPresetTxtRecordNumberPops)
    pDrlgMap.pPopsSubIndex = new Int32Array(nPresetTxtRecordNumberPops)
    pDrlgMap.pPopsOrientation = new Int32Array(nPresetTxtRecordNumberPops)
    pDrlgMap.pPopsLocation = Array.from({ length: nPresetTxtRecordNumberPops }, () => newCoord())
  }

  const pDrlgCoord = newCoord(0, 0, pFile.nWidth + 1, pFile.nHeight + 1)
  if (pDrlgCoord.nHeight > 256) throw new RangeError(`${pFile.szPath}: ${pDrlgCoord.nHeight} rows overflow pCellFlags[256]`)

  for (let i = 0; i < pFile.nWallLayers; i += 1) {
    const pTileTypeGrid = newGrid()
    const pDrlgGrid2 = newGrid()
    DRLGGRID_AssignCellsOffsetsAndFlags(pTileTypeGrid, pFile.pTileTypeLayer[i]!, 0, pDrlgCoord, pFile.nWidth + 1, new Int32Array(256))
    DRLGGRID_AssignCellsOffsetsAndFlags(pDrlgGrid2, pFile.pWallLayer[i]!, 0, pDrlgCoord, pFile.nWidth + 1, new Int32Array(256))

    for (let nY = 0; nY < pFile.nHeight; nY += 1) {
      for (let nX = 0; nX < pFile.nWidth; nX += 1) {
        const nTileType = DRLGGRID_GetGridEntry(pTileTypeGrid, nX, nY)
        const nGrid2Flags = DRLGGRID_GetGridEntry(pDrlgGrid2, nX, nY)
        const nGrid2FlagsByte1 = (nGrid2Flags >>> 8) & 0xff
        const nGrid2UpperBit = nGrid2Flags & 0x80000000
        const nFlagsBits21_26 = (nGrid2Flags >>> 20) & 0x3f

        if (nTileType === TILETYPE_WALL_RIGHT_EXIT || nTileType === TILETYPE_WALL_LEFT_EXIT) {
          if (
            pRecord.dwScan &&
            nFlagsBits21_26 >= 0 &&
            nFlagsBits21_26 <= 7 &&
            (nGrid2FlagsByte1 === 0 || nGrid2FlagsByte1 === 4 || nGrid2UpperBit)
          ) {
            if (bSingleRoom) {
              DRLGGRID_AlterGridFlag(pDrlgGrid, 0, 0, 1 << (nFlagsBits21_26 + 4), FLAG_OPERATION_OR)
            } else {
              DRLGGRID_AlterGridFlag(pDrlgGrid, Math.trunc(nX / 8), Math.trunc(nY / 8), 1 << (nFlagsBits21_26 + 4), FLAG_OPERATION_OR)
            }
          }

          if (nPresetTxtRecordNumberPops && nFlagsBits21_26 >= 8 && nFlagsBits21_26 <= 29) {
            let nCounter = 0
            while (nCounter < nProcessedPops) {
              if (pDrlgMap.pPopsIndex![nCounter] === nFlagsBits21_26) {
                pDrlgMap.pPopsLocation![nCounter]!.nWidth = nX
                pDrlgMap.pPopsLocation![nCounter]!.nHeight = nY
                break
              }
              nCounter += 1
            }
            if (nCounter === nProcessedPops) {
              if (nProcessedPops >= nPresetTxtRecordNumberPops) {
                throw new RangeError(`${pFile.szPath}: more pops than LvlPrest Pops=${nPresetTxtRecordNumberPops}`)
              }
              pDrlgMap.pPopsIndex![nProcessedPops] = nFlagsBits21_26
              pDrlgMap.pPopsSubIndex![nProcessedPops] = nGrid2FlagsByte1
              pDrlgMap.pPopsLocation![nProcessedPops]!.nPosX = nX
              pDrlgMap.pPopsLocation![nProcessedPops]!.nPosY = nY
              nProcessedPops += 1
            }
          }

          if (pRecord.dwScan && nFlagsBits21_26 >= 30 && nFlagsBits21_26 <= 33) {
            if (pLevel.nTileInfo >= pLevel.pTileInfo.length) {
              throw new RangeError(`level ${pLevel.nLevelId}: pTileInfo[32] overflow`)
            }
            const pTileInfo = pLevel.pTileInfo[pLevel.nTileInfo]!
            pTileInfo.nPosX = nX + pDrlgMap.pDrlgCoord.nPosX
            pTileInfo.nPosY = nY + pDrlgMap.pDrlgCoord.nPosY
            switch (nFlagsBits21_26) {
              case 30:
                pTileInfo.nTileIndex = nGrid2FlagsByte1
                break
              case 31:
                pTileInfo.nTileIndex = nGrid2FlagsByte1 + 5
                break
              case 32:
                pTileInfo.nTileIndex = 10
                break
              case 33:
                pTileInfo.nTileIndex = 11
                break
              default:
                break
            }
            pLevel.nTileInfo += 1
          }
        }
      }
    }

    DRLGGRID_ResetGrid(pDrlgGrid2)
    DRLGGRID_ResetGrid(pTileTypeGrid)
  }

  if (nPresetTxtRecordNumberPops) {
    pDrlgMap.nPops = nProcessedPops
    for (let i = 0; i < pDrlgMap.nPops; i += 1) {
      const pPopsLocation = pDrlgMap.pPopsLocation![i]!
      const nX1 = Math.min(pPopsLocation.nPosX, pPopsLocation.nWidth)
      const nX2 = Math.max(pPopsLocation.nPosX, pPopsLocation.nWidth)
      const nY1 = Math.min(pPopsLocation.nPosY, pPopsLocation.nHeight)
      const nY2 = Math.max(pPopsLocation.nPosY, pPopsLocation.nHeight)

      pPopsLocation.nPosX = nX1 + pDrlgMap.pDrlgCoord.nPosX
      pPopsLocation.nPosY = nY1 + pDrlgMap.pDrlgCoord.nPosY
      pPopsLocation.nWidth = nX2 - nX1 + 1
      pPopsLocation.nHeight = nY2 - nY1 + 1

      // (((BYTE4(n) & 3) + (int)n) >> 2) - 1 with BYTE4 of a zero-extended uint32 == 0.
      pDrlgMap.pPopsIndex![i] = (pDrlgMap.pPopsIndex![i]! >> 2) - 1
    }
  }

  if (pRecord.dwScan) {
    for (let pPresetUnit = pFile.pPresetUnit; pPresetUnit; pPresetUnit = pPresetUnit.pNext) {
      if (
        pPresetUnit.nUnitType === UNIT_OBJECT &&
        pPresetUnit.nIndex < 573 &&
        objectSubClass(env.tables, pPresetUnit.nIndex) & OBJSUBCLASS_WAYPOINT
      ) {
        if (bSingleRoom) {
          DRLGGRID_AlterGridFlag(pDrlgGrid, 0, 0, 0x30000, FLAG_OPERATION_OR)
        } else {
          DRLGGRID_AlterGridFlag(
            pDrlgGrid,
            Math.trunc(Math.trunc(pPresetUnit.nXpos / 5) / 8),
            Math.trunc(Math.trunc(pPresetUnit.nYpos / 5) / 8),
            0x30000,
            FLAG_OPERATION_OR,
          )
        }
      }
    }
  }
}

//D2Common.0x6FD87E10
export function DRLGPRESET_SetPickedFileInDrlgMap(pDrlgMap: D2DrlgMapStrc, nPickedFile: number): void {
  pDrlgMap.nPickedFile = nPickedFile
}

//D2Common.0x6FD87E20
export function DRLGPRESET_AllocDrlgMap(
  pLevel: D2DrlgLevelStrc,
  nLvlPrestId: number,
  pDrlgCoord: D2DrlgCoordStrc,
  pSeed: D2SeedStrc,
): D2DrlgMapStrc {
  const pLvlPrestTxtRecord = DATATBLS_GetLvlPrestTxtRecord(pLevel.pDrlg.env.tables, nLvlPrestId)
  const pDrlgMap: D2DrlgMapStrc = {
    nLevelPrest: nLvlPrestId,
    nPickedFile: 0,
    pLvlPrestTxtRecord,
    pFile: null,
    pDrlgCoord: newCoord(),
    bHasInfo: 0,
    pMapGrid: newGrid(),
    pPresetUnit: null,
    bInited: 0,
    nPops: 0,
    pPopsIndex: null,
    pPopsSubIndex: null,
    pPopsOrientation: null,
    pPopsLocation: null,
    pNext: null,
  }

  pDrlgMap.nPickedFile = SEED_RollLimitedRandomNumber(pSeed, pLvlPrestTxtRecord.dwFiles)
  pDrlgMap.pDrlgCoord.nPosX = pDrlgCoord.nPosX
  pDrlgMap.pDrlgCoord.nPosY = pDrlgCoord.nPosY

  if (pLvlPrestTxtRecord.nSizeX && pLvlPrestTxtRecord.nSizeY) {
    pDrlgMap.pDrlgCoord.nWidth = pLvlPrestTxtRecord.nSizeX
    pDrlgMap.pDrlgCoord.nHeight = pLvlPrestTxtRecord.nSizeY
  } else {
    pDrlgMap.pDrlgCoord.nWidth = pDrlgCoord.nWidth
    pDrlgMap.pDrlgCoord.nHeight = pDrlgCoord.nHeight
  }

  pDrlgMap.bInited = 1
  pDrlgMap.pNext = pLevel.pCurrentMap
  pLevel.pCurrentMap = pDrlgMap
  return pDrlgMap
}

//D2Common.0x6FD88610
export function DRLGPRESET_InitLevelData(pLevel: D2DrlgLevelStrc): void {
  const pLvlPrestTxtRecord = DATATBLS_GetLvlPrestTxtRecordFromLevelId(pLevel.pDrlg.env.tables, pLevel.nLevelId)
  if (!pLvlPrestTxtRecord) {
    throw new Error(`level ${pLevel.nLevelId}: Level labeled as Preset, but no preset claims the level`)
  }
  pLevel.pPreset = { pDrlgMap: null, nDirection: 0 }
  if (pLvlPrestTxtRecord.dwFiles) {
    pLevel.pPreset.nDirection = SEED_RollLimitedRandomNumber(pLevel.pSeed, pLvlPrestTxtRecord.dwFiles)
  } else {
    pLevel.pPreset.nDirection = -1
  }
  DRLG_SetLevelPositionAndSize(pLevel.pDrlg, pLevel)
}

//D2Common.0x6FD886F0
// pfAutomap / pfTownAutomap are null on the server (and in the oracle), so the automap branches
// that initialise neighbouring levels never run.
export function DRLGPRESET_GenerateLevel(pLevel: D2DrlgLevelStrc): void {
  const pLvlPrestTxtRecord = DATATBLS_GetLvlPrestTxtRecordFromLevelId(pLevel.pDrlg.env.tables, pLevel.nLevelId)
  if (!pLvlPrestTxtRecord) throw new Error(`level ${pLevel.nLevelId}: no LvlPrest record`)
  const pPreset = pLevel.pPreset!
  pPreset.pDrlgMap = DRLGPRESET_AllocDrlgMap(pLevel, pLvlPrestTxtRecord.dwDef, pLevel.pLevelCoords, pLevel.pSeed)

  if (pPreset.nDirection === -1) {
    pPreset.nDirection = pPreset.pDrlgMap.nPickedFile
  } else {
    pPreset.pDrlgMap.nPickedFile = pPreset.nDirection
  }

  DRLGPRESET_BuildArea(pLevel, pPreset.pDrlgMap, 0, false)

  if (pLevel.nLevelId === LEVEL_LUTGHOLEIN || pLevel.nLevelId === LEVEL_THEPANDEMONIUMFORTRESS || pLevel.nLevelId === LEVEL_HARROGATH) {
    // pfTownAutomap is null.
  } else {
    // pfAutomap is null.
  }
}

const nRiverBlockSizeInTilesX = 5
const nRiverBlockSizeInTilesY = 4
const DRLGROOMTILE_SUBTILES_SIZE = 5

function DRLGPRESET_AddPresetUnitToMap(pMazeMap: D2DrlgMapStrc, pNewPresetUnit: D2PresetUnitStrc, bSpawned: boolean): void {
  pNewPresetUnit.pNext = pMazeMap.pPresetUnit
  pMazeMap.pPresetUnit = pNewPresetUnit
  pNewPresetUnit.bSpawned |= bSpawned ? 1 : 0
}

function DRLGPRESET_AllocateAndAddPresetUnitToMap(
  pDrlgRoom: D2DrlgRoomStrc | null,
  nUnitType: number,
  nIndex: number,
  nMode: number,
  nX: number,
  nY: number,
  pMazeMap: D2DrlgMapStrc,
  bSpawned: boolean,
): D2PresetUnitStrc {
  const pPresetUnit = DRLGROOM_AllocPresetUnit(pDrlgRoom, nUnitType, nIndex, nMode, nX, nY)
  DRLGPRESET_AddPresetUnitToMap(pMazeMap, pPresetUnit, bSpawned)
  return pPresetUnit
}

//D2Common.0x6FD86AC0
export function DRLGPRESET_AddPresetRiverObjects(
  pDrlgMap: D2DrlgMapStrc,
  nOffsetX: number,
  pDrlgGrid: D2DrlgGridStrc,
): void {
  const nX = nOffsetX < 0 ? 0 : nOffsetX
  for (let nY = 0; nY < pDrlgMap.pDrlgCoord.nHeight; nY += 1) {
    const sub = DUNGEON_GameTileToSubtileCoords(nOffsetX + pDrlgMap.pDrlgCoord.nPosX, nY + pDrlgMap.pDrlgCoord.nPosY)
    const nObjectX = sub.nX - nRiverBlockSizeInTilesX
    const nObjectY = sub.nY

    DRLGPRESET_AllocateAndAddPresetUnitToMap(null, UNIT_OBJECT, OBJECT_RIVER1, OBJMODE_NEUTRAL, nObjectX, nObjectY, pDrlgMap, true)
    DRLGPRESET_AllocateAndAddPresetUnitToMap(null, UNIT_OBJECT, OBJECT_RIVER2, OBJMODE_NEUTRAL, nObjectX + 5, nObjectY, pDrlgMap, true)
    DRLGPRESET_AllocateAndAddPresetUnitToMap(null, UNIT_OBJECT, OBJECT_RIVER2, OBJMODE_NEUTRAL, nObjectX + 10, nObjectY, pDrlgMap, true)
    DRLGPRESET_AllocateAndAddPresetUnitToMap(null, UNIT_OBJECT, OBJECT_RIVER2, OBJMODE_NEUTRAL, nObjectX + 15, nObjectY, pDrlgMap, true)
    DRLGPRESET_AllocateAndAddPresetUnitToMap(null, UNIT_OBJECT, OBJECT_RIVER3, OBJMODE_NEUTRAL, nObjectX + 20, nObjectY, pDrlgMap, true)

    const nGridEntry = DRLGGRID_GetGridEntry(pDrlgGrid, nX, nY)
    const nTileStyle = (nGridEntry >>> 20) & 0x3f
    const nTileSequence = (nGridEntry >>> 8) & 0xff
    if (nTileStyle === 4) {
      switch (nTileSequence) {
        case 0:
        case 4:
        case 8:
        case 16:
        case 29:
        case 39:
          nY += nRiverBlockSizeInTilesY - 1
          break
        default:
          break
      }
    }
  }
}

function DRLGPRESET_SpawnRiver(
  pMazeMap: D2DrlgMapStrc,
  tDrlgCoord: D2DrlgCoordStrc,
  pDrlgGrid: D2DrlgGridStrc,
  nOffsetX: number,
): void {
  const startSub = DUNGEON_GameTileToSubtileCoords(tDrlgCoord.nPosX + nOffsetX + 1, tDrlgCoord.nPosY)
  const endSub = DUNGEON_GameTileToSubtileCoords(0, tDrlgCoord.nPosY + pMazeMap.pFile!.nHeight)
  const nSubtileX = startSub.nX
  let nSubtileY = startSub.nY
  const nEndSubtileY = endSub.nY

  while (nSubtileY < nEndSubtileY) {
    DRLGPRESET_AllocateAndAddPresetUnitToMap(
      null,
      UNIT_OBJECT,
      OBJECT_INVISIBLE_RIVER_SOUND1,
      OBJMODE_NEUTRAL,
      nSubtileX,
      nSubtileY,
      pMazeMap,
      true,
    )
    nSubtileY += DRLGROOMTILE_SUBTILES_SIZE
  }

  DRLGPRESET_AddPresetRiverObjects(pMazeMap, nOffsetX, pDrlgGrid)
}

//D2Common.0x6FD867A0
export function DRLGPRESET_SpawnHardcodedPresetUnits(pDrlgRoom: D2DrlgRoomStrc): void {
  const env = pDrlgRoom.pLevel.pDrlg.env
  const pMazeMap = pDrlgRoom.pMaze!.pMap!
  if (!pMazeMap.pFile) {
    pMazeMap.pFile = DRLGPRESET_LoadDrlgFile(env, pMazeMap.pLvlPrestTxtRecord.szFile[pMazeMap.nPickedFile]!)
    DRLGPRESET_AddPresetUnitToDrlgMap(env.tables, pMazeMap, pDrlgRoom.pSeed)
  }

  if (pMazeMap.bInited === 1) {
    pMazeMap.bInited = 0
    const nLevelPrestId = pMazeMap.nLevelPrest

    if (
      nLevelPrestId >= LVLPREST_ACT1_WILD_BORDER_1 &&
      nLevelPrestId <= LVLPREST_ACT1_WILD_BORDER_4 &&
      pDrlgRoom.pLevel.nLevelId === LEVEL_BLOODMOOR &&
      pMazeMap.nPickedFile === 3
    ) {
      const sub = DUNGEON_GameTileToSubtileCoords(
        pMazeMap.pDrlgCoord.nPosX + Math.trunc(pMazeMap.pDrlgCoord.nWidth / 2),
        pMazeMap.pDrlgCoord.nPosY + Math.trunc(pMazeMap.pDrlgCoord.nHeight / 2),
      )
      const nClassId = MONSTER_NAVI < env.tables.nMonStatsTxtRecordCount ? MONSTER_NAVI : -1
      DRLGPRESET_AllocateAndAddPresetUnitToMap(null, UNIT_MONSTER, nClassId, MONMODE_NEUTRAL, sub.nX, sub.nY, pMazeMap, false)
    } else if (
      nLevelPrestId === LVLPREST_ACT1_TOWN_1 ||
      nLevelPrestId === LVLPREST_ACT1_TOWN_1_TRANSITION_S ||
      (nLevelPrestId >= LVLPREST_ACT1_RIVER_UPPER && nLevelPrestId <= LVLPREST_ACT1_BRIDGE) ||
      nLevelPrestId === LVLPREST_ACT1_TRISTRAM
    ) {
      if (pDrlgRoom.dwFlags & DRLGROOMFLAG_AUTOMAP_REVEAL) {
        const tDrlgCoord = newCoord(0, 0, pMazeMap.pDrlgCoord.nWidth, pMazeMap.pDrlgCoord.nHeight)
        const tDrlgGrid = newGrid()
        const nCellFlags = new Int32Array(256)
        DRLGGRID_AssignCellsOffsetsAndFlags(
          tDrlgGrid,
          pMazeMap.pFile.pFloorLayer[0]!,
          0,
          tDrlgCoord,
          pMazeMap.pDrlgCoord.nWidth + 1,
          nCellFlags,
        )

        tDrlgCoord.nPosX = pMazeMap.pDrlgCoord.nPosX
        tDrlgCoord.nPosY = pMazeMap.pDrlgCoord.nPosY

        if (pMazeMap.pLvlPrestTxtRecord.dwDef === LVLPREST_ACT1_RIVER_LOWER) {
          DRLGPRESET_SpawnRiver(pMazeMap, tDrlgCoord, tDrlgGrid, -1)
        } else {
          for (let nOffsetX = 0; nOffsetX < tDrlgCoord.nWidth; nOffsetX += 1) {
            const nGridEntry = DRLGGRID_GetGridEntry(tDrlgGrid, nOffsetX, 0)
            const nTileStyle = (nGridEntry >>> 20) & 0x3f
            const nTileSequence = (nGridEntry >>> 8) & 0xff
            if (nTileStyle === 2 && nTileSequence === 24) {
              DRLGPRESET_SpawnRiver(pMazeMap, tDrlgCoord, tDrlgGrid, nOffsetX)
              nOffsetX += nRiverBlockSizeInTilesX - 1
            }
          }
        }

        DRLGGRID_ResetGrid(tDrlgGrid)
      }
    }
  }

  pDrlgRoom.dwFlags = (pDrlgRoom.dwFlags | DRLGROOMFLAG_PRESET_UNITS_ADDED) >>> 0
}

//D2Common.0x6FD86E50
export function DRLGPRESET_InitPresetRoomGrids(pDrlgRoom: D2DrlgRoomStrc): void {
  const pMaze = pDrlgRoom.pMaze!
  const pMap = pMaze.pMap!
  const pFile = pMap.pFile!
  const pDrlgCoord = newCoord(
    pDrlgRoom.pDrlgCoord.nPosX - pMap.pDrlgCoord.nPosX,
    pDrlgRoom.pDrlgCoord.nPosY - pMap.pDrlgCoord.nPosY,
    pDrlgRoom.pDrlgCoord.nWidth + 1,
    pDrlgRoom.pDrlgCoord.nHeight + 1,
  )

  const nWidth = pMap.pDrlgCoord.nWidth + 1

  for (let i = 0; i < pFile.nWallLayers; i += 1) {
    DRLGGRID_FillNewCellFlags(pMaze.pWallGrid[i]!, pFile.pWallLayer[i]!, 0, pDrlgCoord, nWidth)
    DRLGGRID_FillNewCellFlags(pMaze.pTileTypeGrid[i]!, pFile.pTileTypeLayer[i]!, 0, pDrlgCoord, nWidth)
  }

  if (pFile.nWallLayers) {
    DRLGGRID_AlterEdgeGridFlags(pMaze.pWallGrid[0]!, 132, FLAG_OPERATION_OR)
  }

  for (let i = 1; i < pFile.nWallLayers; i += 1) {
    DRLGGRID_AlterAllGridFlags(pMaze.pWallGrid[i]!, i << 18, FLAG_OPERATION_OR)
  }

  for (let i = 0; i < pFile.nFloorLayers; i += 1) {
    DRLGGRID_FillNewCellFlags(pMaze.pFloorGrid[i]!, pFile.pFloorLayer[i]!, 0, pDrlgCoord, nWidth)
    DRLGGRID_AlterAllGridFlags(pMaze.pFloorGrid[i]!, i << 18, FLAG_OPERATION_OR)
  }

  DRLGGRID_FillNewCellFlags(pMaze.pCellGrid, pFile.pShadowLayer!, 0, pDrlgCoord, nWidth)

  for (let i = 0; i < pFile.nFloorLayers; i += 1) {
    DRLGGRID_AlterEdgeGridFlags(pMaze.pFloorGrid[i]!, 132, FLAG_OPERATION_OR)
  }

  DRLGGRID_AlterEdgeGridFlags(pMaze.pCellGrid, 132, FLAG_OPERATION_OR)

  const subPos = DUNGEON_GameTileToSubtileCoords(pDrlgRoom.pDrlgCoord.nPosX, pDrlgRoom.pDrlgCoord.nPosY)
  const subSize = DUNGEON_GameTileToSubtileCoords(pDrlgRoom.pDrlgCoord.nWidth, pDrlgRoom.pDrlgCoord.nHeight)
  pDrlgCoord.nPosX = subPos.nX
  pDrlgCoord.nPosY = subPos.nY
  pDrlgCoord.nWidth = subSize.nX
  pDrlgCoord.nHeight = subSize.nY

  let pPresetUnit = pMap.pPresetUnit
  let pPrevious: D2PresetUnitStrc | null = null

  while (pPresetUnit) {
    if (DRLGROOM_AreXYInsideCoordinates(pDrlgCoord, pPresetUnit.nXpos, pPresetUnit.nYpos)) {
      pPresetUnit.nXpos -= 5 * pDrlgRoom.pDrlgCoord.nPosX
      pPresetUnit.nYpos -= 5 * pDrlgRoom.pDrlgCoord.nPosY

      if (pPrevious) {
        pPrevious.pNext = pPresetUnit.pNext
      } else {
        pMap.pPresetUnit = pPresetUnit.pNext
      }

      pPresetUnit.pNext = pDrlgRoom.pPresetUnits
      pDrlgRoom.pPresetUnits = pPresetUnit

      if (pPrevious) {
        pPresetUnit = pPrevious.pNext
      } else {
        pPresetUnit = pMap.pPresetUnit
      }
    } else {
      pPrevious = pPresetUnit
      pPresetUnit = pPresetUnit.pNext
    }
  }
}

//D2Common.0x6FD87130
export function DRLGPRESET_AddPresetRoomMapTiles(pDrlgRoom: D2DrlgRoomStrc): void {
  DRLGROOMTILE_AllocTileGrid(pDrlgRoom)

  const pMaze = pDrlgRoom.pMaze!
  const pMazeMap = pDrlgRoom.pMaze!.pMap!
  const pFile = pMazeMap.pFile!

  let bKillEdgeX = false
  let bKillEdgeY = false
  if (pMazeMap.pLvlPrestTxtRecord.dwKillEdge) {
    bKillEdgeX =
      ((pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth) | 0) ===
      ((pMazeMap.pDrlgCoord.nPosX + pMazeMap.pDrlgCoord.nWidth) | 0)
    bKillEdgeY =
      ((pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight) | 0) ===
      ((pMazeMap.pDrlgCoord.nPosY + pMazeMap.pDrlgCoord.nHeight) | 0)
  }

  const tTownOrGraveyardTileInfoGrid = newGrid()
  const aCellOffsets = new Int32Array(256)
  const aCellPosBuffer = new Int32Array(1024)
  const tTownOrGraveyardTileTypeGrid = newGrid()
  const aTownOrGraveyardCellPosOffsets = new Int32Array(256)
  const aTownOrGraveyardCellPosBuffer = new Int32Array(1024)
  const bTownOrGraveyard =
    pDrlgRoom.pMaze!.nLevelPrest === LVLPREST_ACT1_TOWN_1 || pDrlgRoom.pMaze!.nLevelPrest === LVLPREST_ACT1_GRAVEYARD
  if (bTownOrGraveyard) {
    DRLGGRID_FillGrid(
      tTownOrGraveyardTileTypeGrid,
      (pDrlgRoom.pDrlgCoord.nWidth + 1) | 0,
      (pDrlgRoom.pDrlgCoord.nHeight + 1) | 0,
      aTownOrGraveyardCellPosBuffer,
      0,
      aTownOrGraveyardCellPosOffsets,
    )
    DRLGGRID_FillGrid(
      tTownOrGraveyardTileInfoGrid,
      (pDrlgRoom.pDrlgCoord.nWidth + 1) | 0,
      (pDrlgRoom.pDrlgCoord.nHeight + 1) | 0,
      aCellPosBuffer,
      0,
      aCellOffsets,
    )
  }

  for (let i = 0; i < pFile.nFloorLayers; i += 1) {
    const bCheckCoordinatesValidity = i === 0 && pMazeMap.pLvlPrestTxtRecord.dwFillBlanks !== 0
    DRLGROOMTILE_CountAllTileTypes(pDrlgRoom, pMaze.pFloorGrid[i]!, bCheckCoordinatesValidity, bKillEdgeX, bKillEdgeY)

    if (pMazeMap.pLvlPrestTxtRecord.dwAnimate) {
      DRLGANIM_TestLoadAnimatedRoomTiles(pDrlgRoom, pMaze.pFloorGrid[i]!, null, 0, bKillEdgeX, bKillEdgeY)
    }
  }

  for (let i = 0; i < pFile.nWallLayers; i += 1) {
    DRLGROOMTILE_CountWallWarpTiles(pDrlgRoom, pMaze.pWallGrid[i]!, pMaze.pTileTypeGrid[i]!, bKillEdgeX, bKillEdgeY)
    DRLGROOMTILE_CountAllTileTypes(pDrlgRoom, pMaze.pWallGrid[i]!, false, bKillEdgeX, bKillEdgeY)

    if (pMazeMap.pLvlPrestTxtRecord.dwAnimate) {
      DRLGANIM_TestLoadAnimatedRoomTiles(
        pDrlgRoom,
        pMaze.pWallGrid[i]!,
        pMaze.pTileTypeGrid[i]!,
        TILETYPE_FLOOR,
        bKillEdgeX,
        bKillEdgeY,
      )
    }
  }

  DRLGROOMTILE_CountAllTileTypes(pDrlgRoom, pMaze.pCellGrid, false, bKillEdgeX, bKillEdgeY)

  if (pMazeMap.pLvlPrestTxtRecord.dwAnimate) {
    DRLGANIM_TestLoadAnimatedRoomTiles(pDrlgRoom, pMaze.pCellGrid, null, TILETYPE_SHADOW, bKillEdgeX, bKillEdgeY)
  }

  if (bTownOrGraveyard) {
    DRLGROOMTILE_CountAllTileTypes(pDrlgRoom, tTownOrGraveyardTileInfoGrid, false, bKillEdgeX, bKillEdgeY)
  }

  DRLGROOMTILE_AllocTileData(pDrlgRoom)

  for (let i = 0; i < pFile.nFloorLayers; i += 1) {
    const bCheckCoordinatesValidity = i === 0 && pMazeMap.pLvlPrestTxtRecord.dwFillBlanks !== 0
    DRLGROOMTILE_LoadInitRoomTiles(pDrlgRoom, pMaze.pFloorGrid[i]!, null, bCheckCoordinatesValidity, bKillEdgeX, bKillEdgeY)
  }

  for (let i = 0; i < pFile.nWallLayers; i += 1) {
    DRLGROOMTILE_LoadInitRoomTiles(pDrlgRoom, pMaze.pWallGrid[i]!, pMaze.pTileTypeGrid[i]!, false, bKillEdgeX, bKillEdgeY)
  }

  DRLGROOMTILE_LoadInitRoomTiles(pDrlgRoom, pMaze.pCellGrid, null, false, bKillEdgeX, bKillEdgeY)

  if (bTownOrGraveyard) {
    DRLGROOMTILE_LoadInitRoomTiles(pDrlgRoom, tTownOrGraveyardTileInfoGrid, tTownOrGraveyardTileTypeGrid, false, bKillEdgeX, bKillEdgeY)
  }

  if (pMazeMap.pLvlPrestTxtRecord.dwAnimate) {
    DRLGANIM_AllocAnimationTileGrids(
      pDrlgRoom,
      pMazeMap.pLvlPrestTxtRecord.nAnimSpeed,
      pMaze.pWallGrid,
      pFile.nWallLayers,
      pMaze.pFloorGrid,
      pFile.nFloorLayers,
      pMaze.pCellGrid,
    )
  }

  const pTileGrid = tileGridOf(pDrlgRoom)
  pTileGrid.pTiles.nWalls = pTileGrid.nWalls
  pTileGrid.pTiles.nFloors = pTileGrid.nFloors
  pTileGrid.pTiles.nRoofs = pTileGrid.nShadows

  if (pMazeMap.pLvlPrestTxtRecord.dwLogicals) {
    // C passes the first element of each grid array.
    DRLGLOGIC_InitializeDrlgCoordList(pDrlgRoom, pMaze.pTileTypeGrid[0]!, pMaze.pFloorGrid[0]!, pMaze.pWallGrid[0]!)
  } else {
    DRLGLOGIC_AllocCoordLists(pDrlgRoom)
  }

  if (bTownOrGraveyard) {
    DRLGGRID_ResetGrid(tTownOrGraveyardTileTypeGrid)
    DRLGGRID_ResetGrid(tTownOrGraveyardTileInfoGrid)
  }

  if (pDrlgRoom.pLevel.nLevelId === LEVEL_BURIALGROUNDS && !pMaze.pTombStoneTiles) {
    let nTombStoneTiles = 0

    // D2_ALLOC_POOL(6 * sizeof(D2CoordStrc)): zero-filled like the oracle's FOG_AllocPool (calloc).
    const pTombStoneTiles = [0, 1, 2, 3, 4, 5].map(() => ({ nX: 0, nY: 0 }))
    pMaze.pTombStoneTiles = pTombStoneTiles

    for (let i = 0; i < pDrlgRoom.pDrlgCoord.nHeight; i += 1) {
      for (let j = 0; j < pDrlgRoom.pDrlgCoord.nWidth; j += 1) {
        const nPackedTileInformation = DRLGGRID_GetGridEntry(pMaze.pWallGrid[0]!, j, i) >>> 0
        if (
          PackedTile.nTileStyle(nPackedTileInformation) === 10 &&
          PackedTile.nTileSequence(nPackedTileInformation) >= 23 &&
          PackedTile.nTileSequence(nPackedTileInformation) <= 27
        ) {
          if (nTombStoneTiles < 6) {
            const nX = (j + pDrlgRoom.pDrlgCoord.nPosX) | 0
            const nY = (i + pDrlgRoom.pDrlgCoord.nPosY) | 0

            const tSubtile = DUNGEON_GameTileToSubtileCoords(nX, nY)

            pTombStoneTiles[nTombStoneTiles]!.nX = (tSubtile.nX + 2) | 0
            pTombStoneTiles[nTombStoneTiles]!.nY = (tSubtile.nY + 2) | 0

            nTombStoneTiles += 1
          }
        }
      }
    }

    pMaze.nTombStoneTiles = nTombStoneTiles
  }
}

