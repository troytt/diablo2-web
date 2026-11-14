import {
  D2DrlgLevelStrc,
  D2DrlgStrc,
} from '../../mem/layout.generated.js'
import type { Memory113c } from '../../mem/sparse-memory.js'
import { COLLISION_MoveUnitToRoomAndCoord113c } from '../collision.ts'
import { D2CommonAssertError, SEED_RollRandomNumberInline113c } from '../inline-helpers.js'
import { smod32 } from '../int-math.js'
import { seedRoll } from '../../prng.ts'
import {
  DRLG_RandomizePresetRooms113c,
  DRLG_ReplacePresetRoom113c,
  DRLG_ValidateAndRebaseLevelRooms113c,
} from '../../tables/datatbls-113c.ts'
import {
  DRLG_AllocAndInitLevel113c,
  DRLG_ComputeLevelRoomsBoundingBox113c,
  DRLG_GetRectTouchDirection113c,
} from './drlg.ts'
import {
  DRLGMAZE_ExpandRoomsToTargetCount113c,
  DRLGMAZE_FindEastmostExpandableRoom113c,
  DRLGMAZE_FindNorthmostExpandableRoom113c,
  DRLGMAZE_FindSouthmostExpandableRoom113c,
  DRLGMAZE_FindWestmostExpandableRoom113c,
  DRLGMAZE_SpawnAdjacentSpecialPresetRoom113c,
  DRLGROOM_AddOrthRoomData113c,
  DRLGROOM_AllocAndInsertOrthNode113c,
  DRLGROOM_AllocRoomEx113c,
  DRLGROOM_CheckLevelRoomsSeparation113c,
  DRLGROOM_FreeRoomEx113c,
  DRLGROOM_LinkRoomsBidirectional113c,
} from './drlg-room.ts'
import { DRLGPRESET_AllocDrlgMap113c, DRLGPRESET_BuildPresetRoomsFromMap113c } from './preset.ts'

/**
 * 0x6FD5E3E0 — DRLGMAZE_HasMapDS1 (73 bytes).
 * Custom register ABI: `ecx = pLevel` (`D2DrlgLevelStrc*`), plain `ret`.
 *
 * @va D2Common:0x6FD5E3E0
 */
export function DRLGMAZE_HasMapDS1113c(m: Memory113c, pLevel: number): number {
  if (pLevel === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Maze.cpp', 28)
  }
  const pMaze = m.get(pLevel, D2DrlgLevelStrc.pOutdoors)
  if (pMaze === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Maze.cpp', 30)
  }
  const pDrlg = m.get(pLevel, D2DrlgLevelStrc.pDrlg)
  const nDiff = m.get(pDrlg, D2DrlgStrc.nDifficulty)
  const val = m.u32((pMaze + nDiff * 4 + 0x04) >>> 0) | 0
  return val === 1 ? 1 : 0
}

const MAZE_LVLT_SWITCH_6FD5E6D0 = Uint8Array.from([
  0, 1, 20, 20, 2, 3, 20, 4, 20, 20, 5, 6, 7, 20, 8, 9,
  10, 20, 20, 11, 12, 13, 14, 20, 20, 15, 20, 20, 20, 16, 17, 18, 19,
])

const TABLE_6FDE6DF0 = Int32Array.from([
  0, 0, 0, 0, 0, 356, 355, 0, 0, 357, 354, 0, 0, 0, 0, 0,
])
const TABLE_6FDE6DF4 = Int32Array.from([
  0, 0, 0, 0, 0, 360, 359, 0, 0, 361, 358, 0, 0, 0, 0, 0,
])
const TABLE_6FDE6DF8 = Int32Array.from([
  0, 0, 0, 0, 0, 659, 660, 0, 0, 661, 662, 0, 0, 0, 0, 0,
])
const TABLE_6FDE6D70 = Int32Array.from([
  0, 0, 0, 0, 0, 1045, 1044, 0, 0, 1043, 1042, 0, 0, 0, 0, 0,
])
const TABLE_6FDE6D74 = Int32Array.from([
  0, 1056, 1055, 1057, 1054, 0, 0, 0, 1053, 0, 0, 0, 1058, 0, 0, 0,
])

/**
 * `@va D2Common:0x6FD5E490` (`DRLGMAZE_AssignMazeRoomPrestId113c`,
 * custom register ABI `ebx = pRoomEx`, `[esp+4] = bClearFlag2`, `ret 4 -> eax = pRoomEx`).
 */
export function DRLGMAZE_AssignMazeRoomPrestId113c(
  m: Memory113c,
  pRoomEx: number,
  bClearFlag2: number,
): number {
  const roomEx = pRoomEx >>> 0
  let esi = 0
  let edi = -1

  let pOrth = m.u32(roomEx)
  while (pOrth !== 0) {
    const dir = m.u32((pOrth + 0x04) >>> 0)
    if (dir === 0) esi |= 1
    else if (dir === 1) esi |= 8
    else if (dir === 2) esi |= 2
    else if (dir === 3) esi |= 4
    pOrth = m.u32((pOrth + 0x14) >>> 0)
  }

  const pLevel = m.u32((roomEx + 0x58) >>> 0)
  const nDrlgType = m.u32((pLevel + 0x1c0) >>> 0) | 0
  const idx = (nDrlgType - 3) >>> 0
  if (idx > 32) {
    throw new D2CommonAssertError('DrlgMaze.cpp', 0x160) // Fog.#10265: unhandled level type (line 352)
  }

  const caseId = MAZE_LVLT_SWITCH_6FD5E6D0[idx]!
  switch (caseId) {
    case 0:
      esi = (esi + 0x34) | 0
      break
    case 1:
      esi = (esi + 0x6c) | 0
      break
    case 2:
      esi = (esi + 0xa7) | 0
      break
    case 3:
      esi = (esi + 0xcd) | 0
      break
    case 4:
      esi = (esi + 0x101) | 0
      break
    case 5:
      esi = (esi + 0x12d) | 0
      break
    case 6:
      esi = TABLE_6FDE6DF0[esi]!
      break
    case 7: {
      const nLevelId = m.u32((pLevel + 0x1d0) >>> 0) | 0
      esi = TABLE_6FDE6DF4[esi]!
      if (nLevelId === 0x34) {
        if (esi === 0x169) edi = 2
      } else if (nLevelId === 0x36) {
        if (esi === 0x169 || esi === 0x167) edi = 3
      }
      break
    }
    case 8:
      esi = (esi + 0x19d) | 0
      break
    case 9:
      esi = (esi + 0x1e1) | 0
      break
    case 10:
      esi = (esi + 0x1fd) | 0
      break
    case 11:
      esi = (esi + 0x2f1) | 0
      break
    case 12: {
      const nLevelId = m.u32((pLevel + 0x1d0) >>> 0) | 0
      esi = TABLE_6FDE6DF8[esi]!
      if (nLevelId === 0x54) {
        if (esi === 0x296) esi = 0x298
      } else if (nLevelId === 0x55) {
        if (esi === 0x295) esi = 0x297
      }
      break
    }
    case 13:
      esi = (esi + 0x298) | 0
      break
    case 14:
      esi = (esi + 0x2c0) | 0
      break
    case 15:
      esi = (esi + 0x344) | 0
      break
    case 16:
      esi = TABLE_6FDE6D70[esi]!
      break
    case 17:
      if (DRLGMAZE_HasMapDS1113c(m, pLevel) === 0) {
        esi = (esi + 0x3ea) | 0
      }
      break
    case 18:
      esi = (esi + 0x422) | 0
      break
    case 19:
      esi = TABLE_6FDE6D74[esi]!
      break
    default:
      throw new D2CommonAssertError('DrlgMaze.cpp', 0x160) // Fog.#10265: unhandled level type (line 352)
  }

  if (esi !== 0) {
    const pPreset = m.u32((roomEx + 0x20) >>> 0)
    m.setU32(pPreset, esi >>> 0)
    m.setU32((pPreset + 0x04) >>> 0, edi >>> 0)
    const curFlags = m.u32((pPreset + 0x0c) >>> 0)
    if ((bClearFlag2 | 0) !== 0) {
      m.setU32((pPreset + 0x0c) >>> 0, (curFlags & ~2) >>> 0)
    } else {
      m.setU32((pPreset + 0x0c) >>> 0, (curFlags | 2) >>> 0)
    }
  }
  return roomEx
}

const MAZE_SPECIAL_SWITCH_6FD5EE24 = Uint8Array.from([
  0, 1, 15, 15, 2, 3, 15, 4, 15, 15, 5, 15, 15, 15, 6, 7,
  15, 15, 15, 8, 15, 9, 10, 15, 15, 11, 15, 15, 15, 15, 12, 13, 14,
])

const MAZE_SPECIAL_BASE_DEF = Int32Array.from([
  0x34, 0x6c, 0xa7, 0xcd, 0x101, 0x12d, 0x19d, 0x1e1,
  0x2f1, 0x298, 0x2c0, 0x344, 0x3ea, 0x422, 0x41c,
])

/**
 * `@va D2Common:0x6FD5ECB0` (`DRLGMAZE_PickSequentialSpecialPresetFileIndex113c`,
 * custom register ABI `eax = nPickedFile`, `ebx = pLevel`, `[esp+4] = pDrlgMap`, `ret 4`).
 */
export function DRLGMAZE_PickSequentialSpecialPresetFileIndex113c(
  m: Memory113c,
  nPickedFile: number,
  pLevel: number,
  pDrlgMap: number,
): void {
  const lvl = pLevel >>> 0
  const map = pDrlgMap >>> 0
  void m.u32((m.u32((lvl + 0x1b4) >>> 0) + 0x478) >>> 0)

  if ((nPickedFile | 0) !== -1) {
    m.setU32((map + 0x04) >>> 0, nPickedFile >>> 0)
    return
  }

  const pLvlPrestTxt = m.u32((map + 0x08) >>> 0)
  const nFiles = m.u32((pLvlPrestTxt + 0x40) >>> 0) | 0
  const nDef = m.u32(pLvlPrestTxt) | 0
  const idx = ((m.u32((lvl + 0x1c0) >>> 0) | 0) - 3) >>> 0
  if (idx > 32) {
    return
  }

  const caseId = MAZE_SPECIAL_SWITCH_6FD5EE24[idx]!
  if (caseId >= 15) {
    return
  }
  const baseDef = MAZE_SPECIAL_BASE_DEF[caseId]!
  if (nDef <= baseDef || nDef >= ((baseDef + 16) | 0)) {
    return
  }

  let pNode = m.u32((lvl + 0x1cc) >>> 0)
  while (pNode !== 0) {
    if ((m.u32(pNode) | 0) === nDef) {
      break
    }
    pNode = m.u32((pNode + 0x0c) >>> 0)
  }

  if (pNode === 0) {
    pNode = m.alloc(0x10)
    m.setU32(pNode, 0)
    m.setU32((pNode + 0x04) >>> 0, 0)
    m.setU32((pNode + 0x08) >>> 0, 0)
    m.setU32((pNode + 0x0c) >>> 0, 0)
    m.setU32(pNode, nDef >>> 0)
    m.setU32((pNode + 0x04) >>> 0, nFiles >>> 0)
    const randInit = SEED_RollRandomNumberInline113c(m, (lvl + 0x1c4) >>> 0, nFiles)
    m.setU32((pNode + 0x08) >>> 0, randInit >>> 0)
    m.setU32((pNode + 0x0c) >>> 0, m.u32((lvl + 0x1cc) >>> 0))
    m.setU32((lvl + 0x1cc) >>> 0, pNode)
  }

  const nextVal = smod32(((m.u32((pNode + 0x08) >>> 0) | 0) + 1) | 0, m.u32((pNode + 0x04) >>> 0) | 0)
  m.setU32((pNode + 0x08) >>> 0, nextVal >>> 0)
  m.setU32((map + 0x04) >>> 0, nextVal >>> 0)
}

/**
 * `@va D2Common:0x6FD5EEC0` (`DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c`, not exported;
 * custom LTCG `eax = nDir`, `ecx = pBaseRoomEx`, `edx = pNewRoomEx`, `ret`).
 */
export function DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c(
  m: Memory113c,
  nDir: number,
  pBaseRoomEx: number,
  pNewRoomEx: number,
): number {
  const baseRoom = pBaseRoomEx >>> 0
  const newRoom = pNewRoomEx >>> 0
  const baseX = m.u32((baseRoom + 0x34) >>> 0) | 0
  const baseY = m.u32((baseRoom + 0x38) >>> 0) | 0
  const baseW = m.u32((baseRoom + 0x3c) >>> 0) | 0
  const baseH = m.u32((baseRoom + 0x40) >>> 0) | 0

  switch (nDir >>> 0) {
    case 0:
      m.setU32((newRoom + 0x34) >>> 0, ((baseX - baseW) | 0) >>> 0)
      m.setU32((newRoom + 0x38) >>> 0, baseY >>> 0)
      break
    case 1:
      m.setU32((newRoom + 0x34) >>> 0, baseX >>> 0)
      m.setU32((newRoom + 0x38) >>> 0, ((baseY - baseH) | 0) >>> 0)
      break
    case 2:
      m.setU32((newRoom + 0x34) >>> 0, ((baseX + baseW) | 0) >>> 0)
      m.setU32((newRoom + 0x38) >>> 0, baseY >>> 0)
      break
    case 3:
      m.setU32((newRoom + 0x34) >>> 0, baseX >>> 0)
      m.setU32((newRoom + 0x38) >>> 0, ((baseY + baseH) | 0) >>> 0)
      break
    case 4:
      m.setU32((newRoom + 0x34) >>> 0, ((baseX - baseW) | 0) >>> 0)
      m.setU32((newRoom + 0x38) >>> 0, ((baseY - baseH) | 0) >>> 0)
      break
    case 5:
      m.setU32((newRoom + 0x34) >>> 0, ((baseX + baseW) | 0) >>> 0)
      m.setU32((newRoom + 0x38) >>> 0, ((baseY - baseH) | 0) >>> 0)
      break
    case 6:
      m.setU32((newRoom + 0x34) >>> 0, ((baseX + baseW) | 0) >>> 0)
      m.setU32((newRoom + 0x38) >>> 0, ((baseY + baseH) | 0) >>> 0)
      break
    case 7:
      m.setU32((newRoom + 0x34) >>> 0, ((baseX - baseW) | 0) >>> 0)
      m.setU32((newRoom + 0x38) >>> 0, ((baseY + baseH) | 0) >>> 0)
      break
    default:
      break
  }

  let pOrth = m.u32(baseRoom)
  while (pOrth !== 0) {
    const pBox = m.u32((pOrth + 0x10) >>> 0)
    const boxX = m.u32(pBox) | 0
    const boxY = m.u32((pBox + 0x04) >>> 0) | 0
    const boxW = m.u32((pBox + 0x08) >>> 0) | 0
    const boxH = m.u32((pBox + 0x0c) >>> 0) | 0
    const newX = m.u32((newRoom + 0x34) >>> 0) | 0
    const newY = m.u32((newRoom + 0x38) >>> 0) | 0
    const newW = m.u32((newRoom + 0x3c) >>> 0) | 0
    const newH = m.u32((newRoom + 0x40) >>> 0) | 0

    const distX = newX < boxX ? (boxX - newW - newX) | 0 : (newX - boxW - boxX) | 0
    const distY = newY < boxY ? (boxY - newH - newY) | 0 : (newY - boxH - boxY) | 0
    if (distX < 0 && distY < 0) {
      return 0
    }
    pOrth = m.u32((pOrth + 0x14) >>> 0)
  }

  return DRLGROOM_CheckLevelRoomsSeparation113c(
    m,
    m.u32((newRoom + 0x58) >>> 0),
    0,
    newRoom,
    baseRoom,
  )
}

/**
 * `@va D2Common:0x6FD5EB80` (`DRLGMAZE_LinkTouchingMazeRooms113c`, not exported;
 * `__stdcall(pRoomEx) -> void`, `ret 4`).
 */
export function DRLGMAZE_LinkTouchingMazeRooms113c(m: Memory113c, pRoomEx: number): void {
  const roomEx = pRoomEx >>> 0
  if ((m.u32((m.u32((roomEx + 0x20) >>> 0) + 0x0c) >>> 0) & 0x02) !== 0) {
    return
  }

  const pLevel = m.u32((roomEx + 0x58) >>> 0)
  const pMazeInfo = m.u32((pLevel + 0x14) >>> 0)
  let pOther = m.u32((pLevel + 0x10) >>> 0)

  while (pOther !== 0) {
    if (pOther !== roomEx) {
      if ((m.u32((m.u32((pOther + 0x20) >>> 0) + 0x0c) >>> 0) & 0x02) === 0) {
        const rX = m.u32((roomEx + 0x34) >>> 0) | 0
        const oX = m.u32((pOther + 0x34) >>> 0) | 0
        const rW = m.u32((roomEx + 0x3c) >>> 0) | 0
        const oW = m.u32((pOther + 0x3c) >>> 0) | 0
        const distX = rX < oX ? (oX - rW - rX) | 0 : (rX - oW - oX) | 0

        const rY = m.u32((roomEx + 0x38) >>> 0) | 0
        const oY = m.u32((pOther + 0x38) >>> 0) | 0
        const rH = m.u32((roomEx + 0x40) >>> 0) | 0
        const oH = m.u32((pOther + 0x40) >>> 0) | 0
        const distY = rY < oY ? (oY - rH - rY) | 0 : (rY - oH - oY) | 0

        if (distX < 1 && distY < 1 && distX !== distY) {
          let alreadyLinked = false
          let pOrth = m.u32(roomEx)
          while (pOrth !== 0) {
            if (m.u32(pOrth) === pOther) {
              alreadyLinked = true
              break
            }
            pOrth = m.u32((pOrth + 0x14) >>> 0)
          }
          if (!alreadyLinked) {
            const lo = BigInt(m.u32((pOther + 0x14) >>> 0))
            const hi = BigInt(m.u32((pOther + 0x18) >>> 0))
            const nextSeed = lo * 0x6ac690c5n + hi
            const newLo = Number(nextSeed & 0xffffffffn) >>> 0
            const newHi = Number((nextSeed >> 32n) & 0xffffffffn) >>> 0
            m.setU32((pOther + 0x14) >>> 0, newLo)
            m.setU32((pOther + 0x18) >>> 0, newHi)
            const roll = (newLo % 0x3e8) | 0
            if (roll < (m.u32((pMazeInfo + 0x18) >>> 0) | 0)) {
              const nDir = DRLG_GetRectTouchDirection113c(
                m,
                (pOther + 0x34) >>> 0,
                (roomEx + 0x34) >>> 0,
              ) | 0
              if (nDir !== -1) {
                DRLGROOM_LinkRoomsBidirectional113c(m, nDir, pOther, roomEx)
                DRLGMAZE_AssignMazeRoomPrestId113c(m, pOther, 1)
              }
            }
          }
        }
      }
    }
    pOther = m.u32((pOther + 0x24) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD5F000` (`DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c`, not exported;
 * `__stdcall(pBaseRoomEx, nDir, bLinkTouching) -> D2RoomExStrc*`, `ret 0xC`).
 */
export function DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(
  m: Memory113c,
  pBaseRoomEx: number,
  nDir: number,
  bLinkTouching: number,
): number {
  const baseRoom = pBaseRoomEx >>> 0
  const pNewRoomEx = DRLGROOM_AllocRoomEx113c(m, m.u32((baseRoom + 0x58) >>> 0), 2)
  const pLevelNew = m.u32((pNewRoomEx + 0x58) >>> 0)
  const pMazeInfo = m.u32((pLevelNew + 0x14) >>> 0)
  m.setU32((pNewRoomEx + 0x3c) >>> 0, m.u32((pMazeInfo + 0x10) >>> 0))
  m.setU32((pNewRoomEx + 0x40) >>> 0, m.u32((pMazeInfo + 0x14) >>> 0))

  if (DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c(m, nDir, baseRoom, pNewRoomEx) === 0) {
    DRLGROOM_FreeRoomEx113c(m, pNewRoomEx)
    return 0
  }

  DRLGROOM_AddOrthRoomData113c(m, pNewRoomEx, baseRoom, nDir)
  DRLGROOM_AddOrthRoomData113c(m, baseRoom, pNewRoomEx, ((nDir | 0) - 2) & 3)
  if ((bLinkTouching | 0) !== 0) {
    DRLGMAZE_LinkTouchingMazeRooms113c(m, pNewRoomEx)
  }

  const pLevelBase = m.u32((baseRoom + 0x58) >>> 0)
  m.setU32((pNewRoomEx + 0x24) >>> 0, m.u32((pLevelBase + 0x10) >>> 0))
  m.setU32((pLevelBase + 0x08) >>> 0, (m.u32((pLevelBase + 0x08) >>> 0) + 1) >>> 0)
  m.setU32((pLevelBase + 0x10) >>> 0, pNewRoomEx)
  return pNewRoomEx >>> 0
}

/**
 * `.rdata` corner maze preset table at `0x6FDE6CC8..0x6FDE6CE7` (`[lvlType17, lvlType34]`, indexed by dir `0..3`).
 */
export const MAZE_CORNER_PRESET_BY_DIR_6FDE6CC8: ReadonlyArray<readonly [number, number]> = [
  [447, 1075],
  [444, 1077],
  [446, 1076],
  [445, 1074],
]

/**
 * `.rdata` tunnels special preset pairs at `0x6FDE6CE8..0x6FDE6D47` (`[nLvlPrestId, nDir, nPickedFile]`).
 */
export const TUNNELS_SPECIAL_PRESETS_6FDE6CE8: ReadonlyArray<readonly [number, number, number]> = [
  [1054, 1, 0],
  [1053, 3, 1],
  [1054, 1, 1],
  [1053, 3, 0],
  [1055, 0, 1],
  [1056, 2, 0],
  [1055, 0, 0],
  [1056, 2, 1],
]

/**
 * `@va D2Common:0x6FD5FD20` (`DRLGMAZE_SpawnAndAssignCornerRoomPresets113c`, not exported;
 * `__stdcall(pLevel) -> void`, `ret 4`).
 */
export function DRLGMAZE_SpawnAndAssignCornerRoomPresets113c(
  m: Memory113c,
  pLevel: number,
): void {
  const level = pLevel >>> 0
  const lo = BigInt(m.u32((level + 0x1c4) >>> 0))
  const hi = BigInt(m.u32((level + 0x1c8) >>> 0))
  const next = lo * 0x6ac690c5n + hi
  const newLo = Number(next & 0xffffffffn) >>> 0
  const newHi = Number((next >> 32n) & 0xffffffffn) >>> 0
  m.setU32((level + 0x1c4) >>> 0, newLo)
  m.setU32((level + 0x1c8) >>> 0, newHi)

  const pBase = m.u32((level + 0x10) >>> 0)
  let dir = newLo & 3
  for (let iter = 0; iter < 3; iter++) {
    const pNew = DRLGROOM_AllocRoomEx113c(m, m.u32((pBase + 0x58) >>> 0), 2) >>> 0
    const pNewLvl = m.u32((pNew + 0x58) >>> 0)
    const pMaze = m.u32((pNewLvl + 0x14) >>> 0)
    m.setU32((pNew + 0x3c) >>> 0, m.u32((pMaze + 0x10) >>> 0))
    m.setU32((pNew + 0x40) >>> 0, m.u32((pMaze + 0x14) >>> 0))
    if (DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c(m, dir, pBase, pNew) === 0) {
      DRLGROOM_FreeRoomEx113c(m, pNew)
    } else {
      DRLGROOM_AddOrthRoomData113c(m, pNew, pBase, dir)
      DRLGROOM_AddOrthRoomData113c(m, pBase, pNew, (dir - 2) & 3)
      DRLGMAZE_LinkTouchingMazeRooms113c(m, pNew)
      const pBaseLvl = m.u32((pBase + 0x58) >>> 0)
      m.setU32((pNew + 0x24) >>> 0, m.u32((pBaseLvl + 0x10) >>> 0))
      m.setU32((pBaseLvl + 0x10) >>> 0, pNew)
      m.setU32((pBaseLvl + 0x08) >>> 0, (m.u32((pBaseLvl + 0x08) >>> 0) + 1) >>> 0)
      DRLGMAZE_AssignMazeRoomPrestId113c(m, pBase, 1)
      DRLGMAZE_AssignMazeRoomPrestId113c(m, pNew, 1)
    }
    dir = (dir + 1) & 3
  }

  const nLevelType = m.u32((level + 0x1c0) >>> 0) | 0
  if (nLevelType === 17 || nLevelType === 34) {
    const pPreset = m.u32((pBase + 0x20) >>> 0)
    const entry = MAZE_CORNER_PRESET_BY_DIR_6FDE6CC8[dir]!
    m.setU32(pPreset, (nLevelType === 17 ? entry[0] : entry[1]) >>> 0)
    m.setU32((pPreset + 0x04) >>> 0, 0xffffffff)
    m.setU32((pPreset + 0x0c) >>> 0, (m.u32((pPreset + 0x0c) >>> 0) | 2) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD5FE70` (`DRLGMAZE_SpawnCrossOrPairSpecialRooms113c`, not exported;
 * custom LTCG `eax = bAllFourDirs`, `ecx = pLevel`, `ret`).
 */
export function DRLGMAZE_SpawnCrossOrPairSpecialRooms113c(
  m: Memory113c,
  bAllFourDirs: number,
  pLevel: number,
): void {
  const level = pLevel >>> 0
  const pBase = m.u32((level + 0x10) >>> 0)
  let prestId = 0x122
  if ((bAllFourDirs | 0) !== 0) {
    const dirs = [1, 2, 3, 0]
    for (let i = 0; i < 4; i++) {
      const pNew = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, pBase, dirs[i]!, 1) >>> 0
      if (pNew !== 0) {
        DRLGMAZE_AssignMazeRoomPrestId113c(m, pBase, 1)
        DRLGMAZE_AssignMazeRoomPrestId113c(m, pNew, 1)
      }
    }
  } else {
    const lo = BigInt(m.u32((level + 0x1c4) >>> 0))
    const hi = BigInt(m.u32((level + 0x1c8) >>> 0))
    const next = lo * 0x6ac690c5n + hi
    const newLo = Number(next & 0xffffffffn) >>> 0
    const newHi = Number((next >> 32n) & 0xffffffffn) >>> 0
    m.setU32((level + 0x1c4) >>> 0, newLo)
    m.setU32((level + 0x1c8) >>> 0, newHi)
    const dirs = (newLo & 1) !== 0 ? [0, 2] : [1, 3]
    prestId = (newLo & 1) !== 0 ? 0x120 : 0x121
    for (let i = 0; i < 2; i++) {
      const pNew = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, pBase, dirs[i]!, 1) >>> 0
      if (pNew !== 0) {
        DRLGMAZE_AssignMazeRoomPrestId113c(m, pBase, 1)
        DRLGMAZE_AssignMazeRoomPrestId113c(m, pNew, 1)
      }
    }
  }
  const pPreset = m.u32((pBase + 0x20) >>> 0)
  m.setU32(pPreset, prestId >>> 0)
  m.setU32((pPreset + 0x04) >>> 0, 0xffffffff)
  m.setU32((pPreset + 0x0c) >>> 0, (m.u32((pPreset + 0x0c) >>> 0) | 2) >>> 0)
}

/**
 * `@va D2Common:0x6FD60010` (`DRLGMAZE_FillAdjacentRoomsWithPreset113c`, not exported;
 * custom LTCG `eax = pLevel`, `[esp+4] = nLvlPrestId`, `[esp+8] = pIgnoreRoomEx`, `ret 8`).
 */
export function DRLGMAZE_FillAdjacentRoomsWithPreset113c(
  m: Memory113c,
  pLevel: number,
  nLvlPrestId: number,
  pIgnoreRoomEx: number,
): void {
  const level = pLevel >>> 0
  const ignore = pIgnoreRoomEx >>> 0
  const nRooms = m.u32((level + 0x08) >>> 0) | 0
  const arr = m.alloc((nRooms << 2) >>> 0) >>> 0
  let pCur = m.u32((level + 0x10) >>> 0)
  for (let i = 0; i < nRooms; i++) {
    m.setU32((arr + i * 4) >>> 0, pCur)
    pCur = m.u32((pCur + 0x24) >>> 0)
  }
  for (let i = 0; i < nRooms; i++) {
    const pRoomEx = m.u32((arr + i * 4) >>> 0)
    if (pRoomEx === ignore) {
      continue
    }
    for (let dir = 0; dir < 8; dir++) {
      const pNew = DRLGROOM_AllocRoomEx113c(m, m.u32((pRoomEx + 0x58) >>> 0), 2) >>> 0
      const pNewLvl = m.u32((pNew + 0x58) >>> 0)
      const pMaze = m.u32((pNewLvl + 0x14) >>> 0)
      m.setU32((pNew + 0x3c) >>> 0, m.u32((pMaze + 0x10) >>> 0))
      m.setU32((pNew + 0x40) >>> 0, m.u32((pMaze + 0x14) >>> 0))
      if (DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c(m, dir, pRoomEx, pNew) === 0) {
        DRLGROOM_FreeRoomEx113c(m, pNew)
      } else {
        DRLGROOM_AddOrthRoomData113c(m, pNew, pRoomEx, dir)
        DRLGROOM_AddOrthRoomData113c(m, pRoomEx, pNew, (dir - 2) & 3)
        const pRoomLvl = m.u32((pRoomEx + 0x58) >>> 0)
        m.setU32((pNew + 0x24) >>> 0, m.u32((pRoomLvl + 0x10) >>> 0))
        m.setU32((pRoomLvl + 0x10) >>> 0, pNew)
        m.setU32((pRoomLvl + 0x08) >>> 0, (m.u32((pRoomLvl + 0x08) >>> 0) + 1) >>> 0)
        const pPreset = m.u32((pNew + 0x20) >>> 0)
        m.setU32(pPreset, nLvlPrestId >>> 0)
        m.setU32((pPreset + 0x04) >>> 0, 0xffffffff)
        m.setU32((pPreset + 0x0c) >>> 0, (m.u32((pPreset + 0x0c) >>> 0) | 2) >>> 0)
      }
    }
  }
  ;(m as { free?: (p: number) => void }).free?.(arr)
}

/**
 * `@va D2Common:0x6FD606B0` (`DRLGMAZE_PlaceOrReplaceSpecialRoomPreset113c`, not exported;
 * custom LTCG `edx = pPresetSpec`, `[esp+4] = pLevel`, `[esp+8] = pOutDir`, `ret 8`).
 */
export function DRLGMAZE_PlaceOrReplaceSpecialRoomPreset113c(
  m: Memory113c,
  pPresetSpec: number,
  pLevel: number,
  pOutDir: number,
): void {
  const spec = pPresetSpec >>> 0
  const level = pLevel >>> 0
  const outDir = pOutDir >>> 0
  const nMatchPrest = m.u32(spec) | 0
  const nNewPrest = m.u32((spec + 0x04) >>> 0) | 0
  const nPickedFile = m.u32((spec + 0x08) >>> 0) | 0

  let pRoomEx = m.u32((level + 0x10) >>> 0)
  let replaced = false
  while (pRoomEx !== 0) {
    const pPreset = m.u32((pRoomEx + 0x20) >>> 0)
    if (
      (m.u32((pPreset + 0x0c) >>> 0) & 0x02) === 0 &&
      (m.u32(pPreset) | 0) === nMatchPrest
    ) {
      m.setU32(pPreset, nNewPrest >>> 0)
      m.setU32((pPreset + 0x04) >>> 0, nPickedFile >>> 0)
      m.setU32((pPreset + 0x0c) >>> 0, (m.u32((pPreset + 0x0c) >>> 0) | 0x02) >>> 0)
      replaced = true
      break
    }
    pRoomEx = m.u32((pRoomEx + 0x24) >>> 0)
  }

  if (!replaced) {
    const nDir = m.u32((spec + 0x0c) >>> 0) | 0
    DRLGMAZE_SpawnAdjacentSpecialPresetRoom113c(m, level, nDir, nNewPrest, nPickedFile)
  }

  if (outDir !== 0) {
    m.setU32(outDir, ((m.u32(outDir) | 0) + 1) & 3)
  }
}

/**
 * `@va D2Common:0x6FD5E1E0` (`D2Common.#10533` `PATH_WarpUnitToRoomAndCoord113c`,
 * `__stdcall(pDynamicPath, _pUnused, pRoom, nX, nY) -> BOOL`, `ret 0x14`).
 */
export function PATH_WarpUnitToRoomAndCoord113c(
  m: Memory113c,
  pDynamicPath: number,
  _pUnused: number,
  pRoom: number,
  nX: number,
  nY: number,
): number {
  const path = pDynamicPath >>> 0
  const packedXY = (((nY & 0xffff) << 16) | (nX & 0xffff)) >>> 0
  if (COLLISION_MoveUnitToRoomAndCoord113c(m, path, pRoom, packedXY) === 0) {
    return 0
  }
  m.setU32((path + 0x28) >>> 0, 0)
  return 1
}

/**
 * `@va D2Common:0x6FD60AF0` (`DRLGMAZE_PlaceTunnelsSpecialPresets113c`, not exported;
 * `__stdcall(pLevel) -> void`, `ret 4`).
 */
export function DRLGMAZE_PlaceTunnelsSpecialPresets113c(
  m: Memory113c,
  pLevel: number,
): void {
  const level = pLevel >>> 0
  const pBase = m.u32((level + 0x10) >>> 0)
  const lo = BigInt(m.u32((pBase + 0x14) >>> 0))
  const hi = BigInt(m.u32((pBase + 0x18) >>> 0))
  const next = lo * 0x6ac690c5n + hi
  const newLo = Number(next & 0xffffffffn) >>> 0
  const newHi = Number((next >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pBase + 0x14) >>> 0, newLo)
  m.setU32((pBase + 0x18) >>> 0, newHi)

  const baseIdx = (newLo & 3) << 1
  if (baseIdx >= 7) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Maze.cpp', 683)
  }

  for (let k = 0; k < 2; k++) {
    const entry = TUNNELS_SPECIAL_PRESETS_6FDE6CE8[baseIdx + k]!
    const nLvlPrestId = entry[0]
    const nDir = entry[1]
    const nPickedFile = entry[2]
    const pNew = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, pBase, nDir, 0) >>> 0
    if (pNew !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(m, pBase, 1)
      const pPreset = m.u32((pNew + 0x20) >>> 0)
      m.setU32(pPreset, nLvlPrestId >>> 0)
      m.setU32((pPreset + 0x04) >>> 0, nPickedFile >>> 0)
      m.setU32((pPreset + 0x0c) >>> 0, (m.u32((pPreset + 0x0c) >>> 0) | 2) >>> 0)
    }
  }

  DRLGMAZE_FillAdjacentRoomsWithPreset113c(m, level, 0x344, 0)
}

const MAZE_RDATA_6FDE5F98 = Int32Array.from([
  1010, 1021, -1, 3, 1004, 1019, -1, 0, 1006, 1020, -1, 1, 1003, 1018, -1, 2,
  1010, 1025, -1, 3, 1004, 1023, -1, 0, 1006, 1024, -1, 1, 1003, 1022, -1, 2,
  1010, 1029, -1, 3, 1004, 1027, -1, 0, 1006, 1028, -1, 1, 1003, 1026, -1, 2,
  1010, 1033, -1, 3, 1004, 1031, -1, 0, 1006, 1032, -1, 1, 1003, 1030, -1, 2,
  1010, 1034, -1, 3, 1004, 1036, -1, 0, 1006, 1035, -1, 1, 1003, 1037, -1, 2,
  837, 853, -1, 2, 838, 854, -1, 0, 175, 201, -1, 3, 169, 199, -1, 0,
  171, 200, -1, 1, 168, 198, -1, 2, 175, 205, -1, 3, 169, 203, -1, 0,
  171, 204, -1, 1, 168, 202, -1, 2, 1876297760, 1876297520, 1876298000, 0, 1066, 1078, -1, 3,
  1060, 1080, -1, 0, 1062, 1079, -1, 1, 1059, 1081, -1, 2, 1066, 1082, -1, 3,
  1060, 1084, -1, 0, 1062, 1083, -1, 1, 1059, 1085, -1, 2, 1042, 1046, -1, 1,
  1043, 1047, -1, 0, 1045, 1048, -1, 3, 1042, 1049, -1, 1, 1043, 1050, -1, 0,
  1045, 1052, -1, 3, 1044, 1051, -1, 2, 761, 787, -1, 3, 755, 785, -1, 0,
  757, 786, -1, 1, 754, 784, -1, 2, 761, 795, -1, 3, 755, 793, -1, 0,
  757, 794, -1, 1, 754, 792, -1, 2, 761, 791, -1, 3, 755, 789, -1, 0,
  757, 790, -1, 1, 754, 788, -1, 2, 712, 742, -1, 3, 706, 740, -1, 0,
  708, 741, -1, 1, 705, 739, -1, 2, 712, 746, -1, 3, 706, 744, -1, 0,
  708, 745, -1, 1, 705, 743, -1, 2, 672, 698, -1, 3, 666, 696, -1, 0,
  668, 697, -1, 1, 665, 695, -1, 2, 672, 702, -1, 3, 666, 700, -1, 0,
  668, 701, -1, 1, 665, 699, -1, 2, 517, 528, -1, 3, 511, 526, -1, 0,
  513, 527, -1, 1, 510, 525, -1, 2, 489, 500, -1, 3, 483, 498, -1, 0,
  485, 499, -1, 1, 482, 497, -1, 2, 489, 504, -1, 3, 483, 502, -1, 0,
  485, 503, -1, 1, 482, 501, -1, 2, 489, 508, -1, 3, 483, 506, -1, 0,
  485, 507, -1, 1, 482, 505, -1, 2, 485, 509, -1, 1, 421, 451, -1, 3,
  415, 449, -1, 0, 417, 450, -1, 1, 414, 448, -1, 2, 421, 479, -1, 3,
  415, 477, -1, 0, 417, 478, -1, 1, 414, 476, -1, 2, 421, 475, -1, 3,
  415, 473, -1, 0, 417, 474, -1, 1, 414, 472, -1, 2, 421, 467, -1, 3,
  415, 465, -1, 0, 417, 466, -1, 1, 414, 464, -1, 2, 421, 459, -1, 3,
  415, 457, -1, 0, 417, 458, -1, 1, 414, 456, -1, 2, 421, 455, -1, 3,
  415, 453, -1, 0, 417, 454, -1, 1, 414, 452, -1, 2, 421, 463, -1, 3,
  415, 461, -1, 0, 417, 462, -1, 1, 414, 460, -1, 2, 421, 471, -1, 3,
  415, 469, -1, 0, 417, 470, -1, 1, 414, 468, -1, 2, 309, 335, -1, 3,
  303, 333, -1, 0, 305, 334, -1, 1, 302, 332, -1, 2, 309, 340, -1, 3,
  303, 338, -1, 0, 305, 339, -1, 1, 302, 337, -1, 2, 309, 348, -1, 3,
  303, 346, -1, 0, 305, 347, -1, 1, 302, 345, -1, 2, 309, 344, -1, 3,
  303, 342, -1, 0, 305, 343, -1, 1, 302, 341, -1, 2, 309, 352, -1, 3,
  303, 350, -1, 0, 305, 351, -1, 1, 302, 349, -1, 2, 265, 294, -1, 3,
  259, 292, -1, 0, 261, 293, -1, 1, 258, 291, -1, 2, 265, 298, -1, 3,
  259, 296, -1, 0, 261, 297, -1, 1, 258, 295, -1, 2, 213, 239, -1, 3,
  207, 237, -1, 0, 209, 238, -1, 1, 206, 236, -1, 2, 213, 247, -1, 3,
  207, 245, -1, 0, 209, 246, -1, 1, 206, 244, -1, 2, 213, 243, -1, 3,
  207, 241, -1, 0, 209, 242, -1, 1, 206, 240, -1, 2, 213, 251, -1, 3,
  207, 249, -1, 0, 209, 250, -1, 1, 206, 248, -1, 2, 213, 255, -1, 3,
  207, 253, -1, 0, 209, 254, -1, 1, 206, 252, -1, 2, 116, 142, -1, 3,
  110, 140, -1, 0, 112, 141, -1, 1, 109, 139, -1, 2, 116, 150, -1, 3,
  110, 148, -1, 0, 112, 149, -1, 1, 109, 147, -1, 2, 116, 158, -1, 3,
  110, 156, -1, 0, 112, 157, -1, 1, 109, 155, -1, 2, 116, 154, -1, 3,
  110, 152, -1, 0, 112, 153, -1, 1, 109, 151, -1, 2, 116, 146, -1, 3,
  110, 144, -1, 0, 112, 145, -1, 1, 109, 143, -1, 2, 60, 86, -1, 3,
  54, 84, -1, 0, 56, 85, -1, 1, 53, 83, -1, 2, 60, 98, -1, 3,
  54, 96, -1, 0, 56, 97, -1, 1, 53, 95, -1, 2, 60, 94, -1, 3,
  54, 92, -1, 0, 56, 93, -1, 1, 53, 91, -1, 2, 60, 102, -1, 3,
  54, 100, -1, 0, 56, 101, -1, 1, 53, 99, -1, 2, 60, 90, -1, 3,
  54, 88, -1, 0, 56, 89, -1, 1, 53, 87, -1, 2,
])

const MAZE_STACK_BASE_IT14 = 0x7ff90000
const MAZE_STACK_SIZE_IT14 = 0x400

function withMazeStackAndRdata113c(m: Memory113c): Memory113c {
  const _mazeStackBufIt14 = new ArrayBuffer(MAZE_STACK_SIZE_IT14)
  const _mazeStackU8It14 = new Uint8Array(_mazeStackBufIt14)
  const _mazeStackDVIt14 = new DataView(_mazeStackBufIt14)
  const isStack = (p: number): boolean => {
    const u = p >>> 0
    return u >= MAZE_STACK_BASE_IT14 && u < MAZE_STACK_BASE_IT14 + MAZE_STACK_SIZE_IT14
  }
  const isRdata = (p: number): boolean => {
    const u = p >>> 0
    return u >= 0x6fde5f98 && u < 0x6fde6cc8
  }
  const self: Memory113c = {
    alloc: size => m.alloc(size),
    u8: p => {
      const u = p >>> 0
      if (isStack(u)) return _mazeStackU8It14[u - MAZE_STACK_BASE_IT14]!
      if (isRdata(u)) {
        const d = u - 0x6fde5f98
        return (MAZE_RDATA_6FDE5F98[d >>> 2]! >>> ((d & 3) * 8)) & 0xff
      }
      return m.u8(u)
    },
    u16: p => {
      const u = p >>> 0
      if (isStack(u)) return _mazeStackDVIt14.getUint16(u - MAZE_STACK_BASE_IT14, true)
      if (isRdata(u)) {
        const d = u - 0x6fde5f98
        return (MAZE_RDATA_6FDE5F98[d >>> 2]! >>> ((d & 2) * 8)) & 0xffff
      }
      return m.u16(u)
    },
    u32: p => {
      const u = p >>> 0
      if (isStack(u)) return _mazeStackDVIt14.getUint32(u - MAZE_STACK_BASE_IT14, true)
      if (isRdata(u)) return MAZE_RDATA_6FDE5F98[(u - 0x6fde5f98) >>> 2]! >>> 0
      return m.u32(u)
    },
    setU8: (p, v) => {
      if (isStack(p)) _mazeStackU8It14[(p >>> 0) - MAZE_STACK_BASE_IT14] = v & 0xff
      else m.setU8(p, v)
    },
    setU16: (p, v) => {
      if (isStack(p)) _mazeStackDVIt14.setUint16((p >>> 0) - MAZE_STACK_BASE_IT14, v & 0xffff, true)
      else m.setU16(p, v)
    },
    setU32: (p, v) => {
      if (isStack(p)) _mazeStackDVIt14.setUint32((p >>> 0) - MAZE_STACK_BASE_IT14, v >>> 0, true)
      else m.setU32(p, v)
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      const addr = ((base >>> 0) + f.off + idx * width) >>> 0
      return width === 1 ? self.u8(addr) : width === 2 ? self.u16(addr) : self.u32(addr)
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      const addr = ((base >>> 0) + f.off + idx * width) >>> 0
      if (width === 1) self.setU8(addr, v)
      else if (width === 2) self.setU16(addr, v)
      else self.setU32(addr, v)
    },
    fill: (p, len, v) => {
      if (isStack(p)) {
        const off = (p >>> 0) - MAZE_STACK_BASE_IT14
        _mazeStackU8It14.fill(v & 0xff, off, off + len)
      } else {
        m.fill(p, len, v)
      }
    },
  }
  return self
}

function stepMazeSeed64_113c(m: Memory113c, pLevel: number): number {
  const pSeed = (pLevel + 0x1c4) >>> 0
  const lo = BigInt(m.u32(pSeed))
  const hi = BigInt(m.u32((pSeed + 4) >>> 0))
  const prod = lo * 0x6ac690c5n + hi
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed, newLo)
  m.setU32((pSeed + 4) >>> 0, newHi)
  return newLo
}

const MAZE_RDATA_BASE = 0x6fde5f98
const MAZE_RDATA_END = (0x6fde5f98 + (MAZE_RDATA_6FDE5F98.length << 2)) >>> 0
function withMazeRdata113c(m: Memory113c): Memory113c {
  const self: Memory113c = {
    get: m.get.bind(m),
    set: m.set.bind(m),
    u8: (addr: number): number => {
      const a = addr >>> 0
      if (a >= MAZE_RDATA_BASE && a < MAZE_RDATA_END) {
        const off = a - MAZE_RDATA_BASE
        const w = MAZE_RDATA_6FDE5F98[off >>> 2]!
        return (w >>> ((off & 3) * 8)) & 0xff
      }
      return m.u8(a)
    },
    u16: (addr: number): number => {
      const a = addr >>> 0
      if (a >= MAZE_RDATA_BASE && a + 1 < MAZE_RDATA_END) {
        return self.u8(a) | (self.u8(a + 1) << 8)
      }
      return m.u16(a)
    },
    u32: (addr: number): number => {
      const a = addr >>> 0
      if (a >= MAZE_RDATA_BASE && a + 3 < MAZE_RDATA_END) {
        if ((a & 3) === 0) return MAZE_RDATA_6FDE5F98[(a - MAZE_RDATA_BASE) >>> 2]! >>> 0
        return (self.u8(a) | (self.u8(a + 1) << 8) | (self.u8(a + 2) << 16) | (self.u8(a + 3) << 24)) >>> 0
      }
      return m.u32(a)
    },
    setU8: m.setU8.bind(m),
    setU16: m.setU16.bind(m),
    setU32: m.setU32.bind(m),
    alloc: m.alloc.bind(m),
    fill: m.fill.bind(m),
  }
  return self
}

function mazePlaceSpec113c(m: Memory113c, specVa: number, pLevel: number, pOutDir: number): void {
  const sm = withMazeRdata113c(m)
  DRLGMAZE_PlaceOrReplaceSpecialRoomPreset113c(sm, specVa, pLevel, pOutDir)
}

/**
 * `@va D2Common:0x6FD5F110` (`DRLGMAZE_ReplaceMazeRoomWithPresetRooms113c`, not exported;
 * custom LTCG `eax = pLevel`, stack `[esp+4] = pRoomEx`, tail-jumps `0x6FD94F90`).
 */
export function DRLGMAZE_ReplaceMazeRoomWithPresetRooms113c(
  m: Memory113c,
  pLevel: number,
  pRoomEx: number,
): void {
  const lvl = pLevel >>> 0
  const roomEx = pRoomEx >>> 0
  const pMaze = m.u32((roomEx + 0x20) >>> 0)
  const nPrestId = m.u32(pMaze) | 0
  const pMap = DRLGPRESET_AllocDrlgMap113c(m, (lvl + 0x1c4) >>> 0, lvl, nPrestId, (roomEx + 0x34) >>> 0) >>> 0
  DRLGMAZE_PickSequentialSpecialPresetFileIndex113c(m, m.u32((pMaze + 0x04) >>> 0), lvl, pMap)
  const rw = m.u32((roomEx + 0x3c) >>> 0) | 0
  const rh = m.u32((roomEx + 0x40) >>> 0) | 0
  const bSingle = rw <= 0x0c && rh <= 0x0c ? 1 : 0
  const pNewRoom = DRLGPRESET_BuildPresetRoomsFromMap113c(m, lvl, pMap, 0, bSingle) >>> 0
  let pOrth = m.u32(roomEx)
  while (pOrth !== 0) {
    if ((m.u32((pOrth + 0x0c) >>> 0) | 0) === 1) {
      const pNeighbor = m.u32(pOrth)
      const dir = m.u32((pOrth + 0x04) >>> 0) | 0
      DRLGROOM_AddOrthRoomData113c(m, pNeighbor, pNewRoom, dir)
      DRLGROOM_AddOrthRoomData113c(m, pNewRoom, pNeighbor, (dir + 2) & 3)
    }
    pOrth = m.u32((pOrth + 0x14) >>> 0)
  }
  DRLGROOM_FreeRoomEx113c(m, roomEx)
}

function mazeStepRingRoom113c(m: Memory113c, pPrevRoom: number, nDir: number): number {
  const pNew = DRLGROOM_AllocRoomEx113c(m, m.u32((pPrevRoom + 0x58) >>> 0), 2) >>> 0
  const pLevel = m.u32((pNew + 0x58) >>> 0)
  const pMazeData = m.u32((pLevel + 0x14) >>> 0)
  m.setU32((pNew + 0x3c) >>> 0, m.u32((pMazeData + 0x10) >>> 0))
  m.setU32((pNew + 0x40) >>> 0, m.u32((pMazeData + 0x14) >>> 0))
  if (DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c(m, nDir, pPrevRoom, pNew) === 0) {
    DRLGROOM_FreeRoomEx113c(m, pNew)
    return 0
  }
  DRLGROOM_AddOrthRoomData113c(m, pNew, pPrevRoom, nDir)
  DRLGROOM_AddOrthRoomData113c(m, pPrevRoom, pNew, (nDir - 2) & 3)
  DRLGMAZE_LinkTouchingMazeRooms113c(m, pNew)
  const pLvl = m.u32((pPrevRoom + 0x58) >>> 0)
  m.setU32((pNew + 0x24) >>> 0, m.u32((pLvl + 0x10) >>> 0))
  m.setU32((pLvl + 0x08) >>> 0, ((m.u32((pLvl + 0x08) >>> 0) | 0) + 1) >>> 0)
  m.setU32((pLvl + 0x10) >>> 0, pNew)
  DRLGMAZE_AssignMazeRoomPrestId113c(m, pPrevRoom, 1)
  DRLGMAZE_AssignMazeRoomPrestId113c(m, pNew, 1)
  return pNew
}

/**
 * `@va D2Common:0x6FD5F220` (`DRLGMAZE_BuildSpiderCavernRing113c`, not exported;
 * custom LTCG `ecx = pLevel`, plain `ret`).
 */
export function DRLGMAZE_BuildSpiderCavernRing113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const nStartDir = stepMazeSeed64_113c(m, lvl) & 3
  const ring: number[] = new Array(60).fill(0)
  let pPrev = m.u32((lvl + 0x10) >>> 0)
  let idx = 0
  for (let side = 0; side < 4; side++) {
    const d0 = side & 3
    const d1 = (side + 3) & 3
    const d2 = (side + 1) & 3
    const d3 = (side + 2) & 3
    const r0 = mazeStepRingRoom113c(m, pPrev, d0); ring[idx++] = r0
    const r1 = mazeStepRingRoom113c(m, r0, d0); ring[idx++] = r1
    const r2 = mazeStepRingRoom113c(m, r1, d1); ring[idx++] = r2
    const r3 = mazeStepRingRoom113c(m, r2, d0); ring[idx++] = r3
    const r4 = mazeStepRingRoom113c(m, r3, d0); ring[idx++] = r4
    const r5 = mazeStepRingRoom113c(m, r4, d0); ring[idx++] = r5
    const r6 = mazeStepRingRoom113c(m, r5, d0); ring[idx++] = r6
    const r7 = mazeStepRingRoom113c(m, r6, d2); ring[idx++] = r7
    mazeStepRingRoom113c(m, r7, d0); ring[idx++] = 0
    const r9 = mazeStepRingRoom113c(m, r7, d2); ring[idx++] = r9
    const r10 = mazeStepRingRoom113c(m, r9, d3); ring[idx++] = r10
    const r11 = mazeStepRingRoom113c(m, r10, d3); ring[idx++] = r11
    mazeStepRingRoom113c(m, r11, d1); ring[idx++] = 0
    const r13 = mazeStepRingRoom113c(m, r11, d3); ring[idx++] = r13
    const r14 = mazeStepRingRoom113c(m, r13, d3); ring[idx++] = r14
  }
  for (let i = 0; i < 60; i++) {
    const rm = ring[i]!
    if (rm !== 0) {
      const pType = m.u32((rm + 0x20) >>> 0)
      m.setU32((pType + 0x04) >>> 0, ((((i / 15) | 0) + nStartDir) & 3) >>> 0)
    }
  }
  // `0x6FD5FD03: mov ecx, [esp+0x24]` (= first RoomEx, `0x6FD5F273`) / `mov edx, [ecx+0x20]` /
  // `0x6FD5FD0D: mov [edx+0x4], 4`.
  const pFirstType = m.u32((pPrev + 0x20) >>> 0)
  m.setU32((pFirstType + 0x04) >>> 0, 4)
}

/**
 * `@va D2Common:0x6FD602F0` (`DRLGMAZE_BuildSquarePerimeterRooms113c`, not exported;
 * custom LTCG `eax = pLevel`, stack `[esp+4] = nSide`, `ret 4`).
 */
export function DRLGMAZE_BuildSquarePerimeterRooms113c(m: Memory113c, pLevel: number, nSide: number): void {
  const lvl = pLevel >>> 0
  const side = nSide | 0
  const pFirst = m.u32((lvl + 0x10) >>> 0)
  let pCur = pFirst
  const dirs = [1, 0, 3, 2]
  const counts = [side - 1, side - 1, side - 1, side - 2]
  for (let d = 0; d < 4; d++) {
    for (let k = 0; k < counts[d]!; k++) {
      pCur = mazeStepRingRoom113c(m, pCur, dirs[d]!)
    }
  }
  DRLGROOM_AddOrthRoomData113c(m, pFirst, pCur, 2)
  DRLGROOM_AddOrthRoomData113c(m, pCur, pFirst, 0)
  DRLGMAZE_AssignMazeRoomPrestId113c(m, pCur, 1)
  DRLGMAZE_AssignMazeRoomPrestId113c(m, pFirst, 1)
}

/**
 * `@va D2Common:0x6FD60BE0` (`DRLGMAZE_PlaceAct5IceCavesPresets113c`, not exported;
 * custom LTCG `esi = pLevel`, plain `ret`).
 */
export function DRLGMAZE_PlaceAct5IceCavesPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  mazePlaceSpec113c(sm, 0x6fde5f98 + (d0 << 4), lvl, pDir)
  mazePlaceSpec113c(sm, 0x6fde5fd8 + (sm.u32(pDir) << 4), lvl, pDir)
  mazePlaceSpec113c(sm, 0x6fde6018 + (sm.u32(pDir) << 4), lvl, pDir)
  const lvlId = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  if (lvlId === 0x73) {
    mazePlaceSpec113c(sm, 0x6fde6058 + (sm.u32(pDir) << 4), lvl, pDir)
    mazePlaceSpec113c(sm, 0x6fde6098 + (sm.u32(pDir) << 4), lvl, pDir)
  } else if (lvlId === 0x71 || lvlId === 0x76) {
    mazePlaceSpec113c(sm, 0x6fde6098 + (sm.u32(pDir) << 4), lvl, pDir)
  }
}

/**
 * `@va D2Common:0x6FD60CA0` (`DRLGMAZE_FinalizeAct5HellBarrow113c`, not exported;
 * `__stdcall(pLevel)`, `ret 4`).
 */
export function DRLGMAZE_FinalizeAct5HellBarrow113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const pDrlg = m.get(lvl, D2DrlgLevelStrc.pDrlg)
  if (m.get(pDrlg, D2DrlgStrc.nAct) === 4) return
  let pTarget = m.get(pDrlg, D2DrlgStrc.pLevel)
  while (pTarget !== 0) {
    if ((m.get(pTarget, D2DrlgLevelStrc.nLevelId) | 0) === 0x6c) break
    pTarget = m.get(pTarget, D2DrlgLevelStrc.pNextLevel)
  }
  if (pTarget === 0) {
    pTarget = DRLG_AllocAndInitLevel113c(m, pDrlg, 0x6c) >>> 0
  }
  const pSouth = DRLGMAZE_FindSouthmostExpandableRoom113c(m, lvl) >>> 0
  const pR1 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, pSouth, 3, 0) >>> 0
  if (pR1 !== 0) {
    DRLGMAZE_AssignMazeRoomPrestId113c(m, pSouth, 1)
    const pT = m.u32((pR1 + 0x20) >>> 0)
    m.setU32(pT, 0x354)
    m.setU32((pT + 0x04) >>> 0, 0xffffffff)
    m.setU32((pT + 0x0c) >>> 0, (m.u32((pT + 0x0c) >>> 0) | 0x02) >>> 0)
  }
  const pNorth = DRLGMAZE_FindNorthmostExpandableRoom113c(m, lvl) >>> 0
  let pR2 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, pNorth, 1, 0) >>> 0
  if (pR2 !== 0) {
    DRLGMAZE_AssignMazeRoomPrestId113c(m, pNorth, 1)
    const pT = m.u32((pR2 + 0x20) >>> 0)
    m.setU32(pT, 0x357)
    m.setU32((pT + 0x04) >>> 0, 0xffffffff)
    m.setU32((pT + 0x0c) >>> 0, (m.u32((pT + 0x0c) >>> 0) | 0x02) >>> 0)
  }
  const pR3 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, pR2, 1, 0) >>> 0
  if (pR3 !== 0) {
    const pT = m.u32((pR3 + 0x20) >>> 0)
    m.setU32(pT, 0x358)
    m.setU32((pT + 0x04) >>> 0, 0xffffffff)
    m.setU32((pT + 0x0c) >>> 0, (m.u32((pT + 0x0c) >>> 0) | 0x02) >>> 0)
  }
  const pR4 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, pR3, 1, 0) >>> 0
  if (pR4 !== 0) {
    const pT = m.u32((pR4 + 0x20) >>> 0)
    m.setU32(pT, 0x358)
    m.setU32((pT + 0x04) >>> 0, 0xffffffff)
    m.setU32((pT + 0x0c) >>> 0, (m.u32((pT + 0x0c) >>> 0) | 0x02) >>> 0)
  }
  DRLGROOM_AllocAndInsertOrthNode113c(m, pTarget, pR4, 1, 0)
  const dx = (((m.u32((pTarget + 0x1c) >>> 0) | 0) + (((m.u32((pR4 + 0x3c) >>> 0) | 0) << 1) - (m.u32((pR4 + 0x34) >>> 0) | 0))) | 0)
  const dy = (((m.u32((pTarget + 0x28) >>> 0) | 0) - (m.u32((pR4 + 0x38) >>> 0) | 0) + (m.u32((pTarget + 0x20) >>> 0) | 0)) | 0)
  const bit = stepMazeSeed64_113c(m, lvl) & 1
  mazePlaceSpec113c(m, 0x6fde60d8 + (bit << 4), lvl, 0)
  DRLGMAZE_FillAdjacentRoomsWithPreset113c(m, lvl, 0x344, pR4)
  let cur = m.get(lvl, D2DrlgLevelStrc.pFirstRoomEx)
  while (cur !== 0) {
    m.setU32((cur + 0x34) >>> 0, ((m.u32((cur + 0x34) >>> 0) | 0) + dx) >>> 0)
    m.setU32((cur + 0x38) >>> 0, ((m.u32((cur + 0x38) >>> 0) | 0) + dy) >>> 0)
    cur = m.u32((cur + 0x24) >>> 0)
  }
  const sm = withMazeStackAndRdata113c(m)
  const pMinX = MAZE_STACK_BASE_IT14
  const pMinY = (MAZE_STACK_BASE_IT14 + 4) >>> 0
  const pMaxX = (MAZE_STACK_BASE_IT14 + 8) >>> 0
  const pMaxY = (MAZE_STACK_BASE_IT14 + 12) >>> 0
  sm.fill(pMinX, 16, 0)
  DRLG_ComputeLevelRoomsBoundingBox113c(sm, lvl, pMinX, pMinY, pMaxX, pMaxY)
  const x0 = sm.u32(pMinX) | 0
  const y0 = sm.u32(pMinY) | 0
  sm.setU32((lvl + 0x1c) >>> 0, x0 >>> 0)
  sm.setU32((lvl + 0x20) >>> 0, y0 >>> 0)
  sm.setU32((lvl + 0x24) >>> 0, ((sm.u32(pMaxX) | 0) - x0) >>> 0)
  sm.setU32((lvl + 0x28) >>> 0, ((sm.u32(pMaxY) | 0) - y0) >>> 0)
}

/**
 * `@va D2Common:0x6FD60EB0` (`DRLGMAZE_FinalizeAct1JailConnect113c`, not exported;
 * `__stdcall(pLevel)`, `ret 4`).
 */
export function DRLGMAZE_FinalizeAct1JailConnect113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const pDrlg = m.get(lvl, D2DrlgLevelStrc.pDrlg)
  let pTarget = m.get(pDrlg, D2DrlgStrc.pLevel)
  while (pTarget !== 0) {
    if ((m.get(pTarget, D2DrlgLevelStrc.nLevelId) | 0) === 0x1b) break
    pTarget = m.get(pTarget, D2DrlgLevelStrc.pNextLevel)
  }
  if (pTarget === 0) {
    pTarget = DRLG_AllocAndInitLevel113c(m, pDrlg, 0x1b) >>> 0
  }
  const dirMode = m.u32((m.u32((pTarget + 0x14) >>> 0) + 0x04) >>> 0) | 0
  let anchor = 0
  if (dirMode === 0) anchor = DRLGMAZE_FindEastmostExpandableRoom113c(m, lvl) >>> 0
  else if (dirMode === 1) anchor = DRLGMAZE_FindSouthmostExpandableRoom113c(m, lvl) >>> 0
  else if (dirMode === 2) anchor = DRLGMAZE_FindWestmostExpandableRoom113c(m, lvl) >>> 0

  let dx = m.u32((pTarget + 0x1c) >>> 0) | 0
  let dy = m.u32((pTarget + 0x20) >>> 0) | 0
  const pMazeData = m.u32((lvl + 0x14) >>> 0)
  if (dirMode === 0) {
    const r = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, anchor, 2, 0) >>> 0
    if (r !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(m, anchor, 1)
      const t = m.u32((r + 0x20) >>> 0)
      m.setU32(t, 0xa7)
      m.setU32((t + 0x04) >>> 0, 0)
      m.setU32((t + 0x0c) >>> 0, (m.u32((t + 0x0c) >>> 0) | 0x02) >>> 0)
    }
    DRLGROOM_AllocAndInsertOrthNode113c(m, pTarget, r, 2, 0)
    dx = (dx - ((m.u32((r + 0x34) >>> 0) | 0) + (m.u32((pMazeData + 0x10) >>> 0) | 0))) | 0
    dy = (dy + (((m.u32((pTarget + 0x28) >>> 0) | 0) >> 1) - (m.u32((r + 0x38) >>> 0) | 0))) | 0
  } else if (dirMode === 1) {
    const r = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, anchor, 3, 0) >>> 0
    if (r !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(m, anchor, 1)
      const t = m.u32((r + 0x20) >>> 0)
      m.setU32(t, 0xa7)
      m.setU32((t + 0x04) >>> 0, 1)
      m.setU32((t + 0x0c) >>> 0, (m.u32((t + 0x0c) >>> 0) | 0x02) >>> 0)
    }
    DRLGROOM_AllocAndInsertOrthNode113c(m, pTarget, r, 3, 0)
    dx = (dx + (((m.u32((pTarget + 0x24) >>> 0) | 0) >> 1) - (m.u32((r + 0x34) >>> 0) | 0) - 6)) | 0
    dy = (dy - ((m.u32((r + 0x38) >>> 0) | 0) + (m.u32((pMazeData + 0x14) >>> 0) | 0))) | 0
  } else if (dirMode === 2) {
    const r = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, anchor, 0, 0) >>> 0
    if (r !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(m, anchor, 1)
      const t = m.u32((r + 0x20) >>> 0)
      m.setU32(t, 0xa7)
      m.setU32((t + 0x04) >>> 0, 2)
      m.setU32((t + 0x0c) >>> 0, (m.u32((t + 0x0c) >>> 0) | 0x02) >>> 0)
    }
    DRLGROOM_AllocAndInsertOrthNode113c(m, pTarget, r, 0, 0)
    dx = (dx + ((m.u32((pTarget + 0x24) >>> 0) | 0) - (m.u32((r + 0x34) >>> 0) | 0))) | 0
    dy = (dy + (((m.u32((pTarget + 0x28) >>> 0) | 0) >> 1) - (m.u32((r + 0x38) >>> 0) | 0) + 1)) | 0
  }

  const sm = withMazeStackAndRdata113c(m)
  const pOutDir = MAZE_STACK_BASE_IT14
  // 0x6FD60EF1: mov [esp+0x20], edi -- the pOutDir slot is seeded with dirMode before 0x6FD606B0.
  sm.setU32(pOutDir, dirMode >>> 0)
  if ((stepMazeSeed64_113c(sm, lvl) & 1) !== 0) {
    mazePlaceSpec113c(sm, 0x6fde60f8 + (dirMode << 4), lvl, pOutDir)
    mazePlaceSpec113c(sm, 0x6fde6138 + (sm.u32(pOutDir) << 4), lvl, pOutDir)
  } else {
    mazePlaceSpec113c(sm, 0x6fde6138 + (dirMode << 4), lvl, pOutDir)
    mazePlaceSpec113c(sm, 0x6fde60f8 + (sm.u32(pOutDir) << 4), lvl, pOutDir)
  }

  let cur = sm.get(lvl, D2DrlgLevelStrc.pFirstRoomEx)
  while (cur !== 0) {
    sm.setU32((cur + 0x34) >>> 0, ((sm.u32((cur + 0x34) >>> 0) | 0) + dx) >>> 0)
    sm.setU32((cur + 0x38) >>> 0, ((sm.u32((cur + 0x38) >>> 0) | 0) + dy) >>> 0)
    cur = sm.u32((cur + 0x24) >>> 0)
  }
  const pMinX = (MAZE_STACK_BASE_IT14 + 0x10) >>> 0
  const pMinY = (MAZE_STACK_BASE_IT14 + 0x14) >>> 0
  const pMaxX = (MAZE_STACK_BASE_IT14 + 0x18) >>> 0
  const pMaxY = (MAZE_STACK_BASE_IT14 + 0x1c) >>> 0
  sm.fill(pMinX, 16, 0)
  DRLG_ComputeLevelRoomsBoundingBox113c(sm, lvl, pMinX, pMinY, pMaxX, pMaxY)
  const x0 = sm.u32(pMinX) | 0
  const y0 = sm.u32(pMinY) | 0
  sm.setU32((lvl + 0x1c) >>> 0, x0 >>> 0)
  sm.setU32((lvl + 0x20) >>> 0, y0 >>> 0)
  sm.setU32((lvl + 0x24) >>> 0, ((sm.u32(pMaxX) | 0) - x0) >>> 0)
  sm.setU32((lvl + 0x28) >>> 0, ((sm.u32(pMaxY) | 0) - y0) >>> 0)
}

/** `@va D2Common:0x6FD61170` (`DRLGMAZE_PlaceAct5GlacialPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct5GlacialPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  mazePlaceSpec113c(sm, 0x6fde6188 + (d0 << 4), lvl, pDir)
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === 0x81) {
    mazePlaceSpec113c(sm, 0x6fde61c8 + (sm.u32(pDir) << 4), lvl, pDir)
  }
}

/** `@va D2Common:0x6FD611E0` (`DRLGMAZE_PlaceAct5BaalKeepPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct5BaalKeepPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = (stepMazeSeed64_113c(sm, lvl) % 3) >>> 0
  sm.setU32(pDir, d0)
  const lvlId = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  if (lvlId !== 0x7c) {
    mazePlaceSpec113c(sm, 0x6fde6208 + (d0 << 4), lvl, pDir)
  }
  const d1 = sm.u32(pDir) >>> 0
  if (lvlId === 0x7b) {
    if (d1 === d0) {
      throw new D2CommonAssertError('DrlgMaze.cpp', 0x5fc)
    }
    mazePlaceSpec113c(sm, 0x6fde6238 + (d1 << 4), lvl, pDir)
  }
}

/** `@va D2Common:0x6FD61280` (`DRLGMAZE_PlaceAct3DurancePresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct3DurancePresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  mazePlaceSpec113c(sm, 0x6fde6278 + (d0 << 4), lvl, pDir)
  const lvlId = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  if (lvlId === 0x65) {
    mazePlaceSpec113c(sm, 0x6fde62b8 + (sm.u32(pDir) << 4), lvl, pDir)
    mazePlaceSpec113c(sm, 0x6fde62f8 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  if (lvlId === 0x64) {
    mazePlaceSpec113c(sm, 0x6fde62f8 + (sm.u32(pDir) << 4), lvl, pDir)
  }
}

/** `@va D2Common:0x6FD61320` (`DRLGMAZE_PlaceAct3SewersPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct3SewersPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  mazePlaceSpec113c(sm, 0x6fde6338 + (d0 << 4), lvl, pDir)
  mazePlaceSpec113c(sm, 0x6fde6378 + (sm.u32(pDir) << 4), lvl, pDir)
}

/** `@va D2Common:0x6FD61380` (`DRLGMAZE_PlaceAct3FlayerDungeonPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct3FlayerDungeonPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  mazePlaceSpec113c(sm, 0x6fde63b8 + (d0 << 4), lvl, pDir)
  mazePlaceSpec113c(sm, 0x6fde63f8 + (sm.u32(pDir) << 4), lvl, pDir)
}

/** `@va D2Common:0x6FD613E0` (`DRLGMAZE_PlaceAct2PalaceCellarPresets113c`, `ecx = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct2PalaceCellarPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  mazePlaceSpec113c(sm, 0x6fde6438 + (d0 << 4), lvl, pDir)
}

/** `@va D2Common:0x6FD61430` (`DRLGMAZE_PlaceAct2MaggotLairPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct2MaggotLairPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === 0x40) {
    mazePlaceSpec113c(sm, 0x6fde6538, lvl, pDir)
    sm.setU32(pDir, 3)
    mazePlaceSpec113c(sm, 0x6fde6528, lvl, pDir)
  } else {
    mazePlaceSpec113c(sm, 0x6fde64b8 + (d0 << 4), lvl, pDir)
  }
  mazePlaceSpec113c(sm, 0x6fde6478 + (sm.u32(pDir) << 4), lvl, pDir)
}

/** `@va D2Common:0x6FD614C0` (`DRLGMAZE_PlaceAct2TombPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct2TombPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  let pRoom = sm.get(lvl, D2DrlgLevelStrc.pFirstRoomEx)
  let pType = 0
  while (pRoom !== 0) {
    pType = sm.u32((pRoom + 0x20) >>> 0)
    if ((sm.u32(pType) | 0) > 0x1ac) break
    pRoom = sm.u32((pRoom + 0x24) >>> 0)
  }
  const nPrest = sm.u32(pType) | 0
  if (nPrest < 0x1bc || nPrest > 0x1bf) {
    throw new D2CommonAssertError('DrlgMaze.cpp', 0x519)
  }
  const pDir = MAZE_STACK_BASE_IT14
  // Jump table `0x6FD61698`: `[0x6FD6150C (3), 0x6FD614FE (1), 0x6FD614FA (0), 0x6FD61505 (2)]`.
  const TOMB_DIR_BY_PREST_6FD61698 = [3, 1, 0, 2]
  sm.setU32(pDir, TOMB_DIR_BY_PREST_6FD61698[(nPrest - 0x1bc) | 0]! >>> 0)
  const lvlId = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  if (lvlId >= 0x37 && lvlId <= 0x3a) {
    mazePlaceSpec113c(sm, 0x6fde6548 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === 0x39) {
    mazePlaceSpec113c(sm, 0x6fde6588 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  const id2 = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  if (id2 === 0x3b || id2 === 0x3d) {
    mazePlaceSpec113c(sm, 0x6fde65c8 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  const id3 = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  const pDrlg = sm.get(lvl, D2DrlgLevelStrc.pDrlg)
  if (id3 >= 0x42 && id3 <= 0x48 && id3 !== (sm.get(pDrlg, D2DrlgStrc.nBossTombLevel) | 0)) {
    mazePlaceSpec113c(sm, 0x6fde65c8 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === 0x3b) {
    mazePlaceSpec113c(sm, 0x6fde6608 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === 0x3c) {
    mazePlaceSpec113c(sm, 0x6fde6648 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  const id4 = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  if (id4 === 0x3b || id4 === 0x3d) {
    mazePlaceSpec113c(sm, 0x6fde6688 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === (sm.get(pDrlg, D2DrlgStrc.nBossTombLevel) | 0)) {
    mazePlaceSpec113c(sm, 0x6fde66c8 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === (sm.u32((pDrlg + 0x484) >>> 0) | 0)) {
    mazePlaceSpec113c(sm, 0x6fde6708 + (sm.u32(pDir) << 4), lvl, pDir)
  }
}

/** `@va D2Common:0x6FD616B0` (`DRLGMAZE_PlaceAct2SewersPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct2SewersPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir1 = MAZE_STACK_BASE_IT14
  const pDir0 = (MAZE_STACK_BASE_IT14 + 4) >>> 0
  const d1 = ((stepMazeSeed64_113c(sm, lvl) & 1) << 1) | 1
  sm.setU32(pDir1, d1)
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir0, d0)
  const lvlId = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  if (lvlId === 0x2f) {
    const pNorth = DRLGMAZE_FindNorthmostExpandableRoom113c(sm, lvl) >>> 0
    const r1 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(sm, pNorth, 1, 1) >>> 0
    if (r1 !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, pNorth, 1)
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, r1, 1)
    }
    const r2 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(sm, r1, 1, 1) >>> 0
    if (r2 !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, r1, 1)
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, r2, 1)
    }
    const r3 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(sm, r2, 0, 0) >>> 0
    if (r3 !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, r2, 1)
      const t = sm.u32((r3 + 0x20) >>> 0)
      sm.setU32(t, 0x14d)
      sm.setU32((t + 0x04) >>> 0, 0)
      sm.setU32((t + 0x0c) >>> 0, (sm.u32((t + 0x0c) >>> 0) | 0x02) >>> 0)
    }
    const pEast = DRLGMAZE_FindEastmostExpandableRoom113c(sm, lvl) >>> 0
    const r4 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(sm, pEast, 2, 1) >>> 0
    if (r4 !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, pEast, 1)
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, r4, 1)
    }
    const r5 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(sm, r4, 2, 1) >>> 0
    if (r5 !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, r4, 1)
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, r5, 1)
    }
    const r6 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(sm, r5, d1, 0) >>> 0
    if (r6 !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, r5, 1)
      const t = sm.u32((r6 + 0x20) >>> 0)
      sm.setU32(t, 0x150)
      sm.setU32((t + 0x04) >>> 0, 0)
      sm.setU32((t + 0x0c) >>> 0, (sm.u32((t + 0x0c) >>> 0) | 0x02) >>> 0)
    }
    const r7 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(sm, r6, d1, 0) >>> 0
    if (r7 !== 0) {
      DRLGMAZE_AssignMazeRoomPrestId113c(sm, r7, 1)
    }
    mazePlaceSpec113c(sm, 0x6fde6788 + (sm.u32(pDir0) << 4), lvl, pDir1)
  } else if (lvlId === 0x30) {
    mazePlaceSpec113c(sm, 0x6fde6748 + (d0 << 4), lvl, pDir0)
    mazePlaceSpec113c(sm, 0x6fde67c8 + (sm.u32(pDir0) << 4), lvl, pDir0)
    mazePlaceSpec113c(sm, 0x6fde6788 + (sm.u32(pDir0) << 4), lvl, pDir0)
  } else if (lvlId === 0x31) {
    mazePlaceSpec113c(sm, 0x6fde6748 + (d0 << 4), lvl, pDir0)
    mazePlaceSpec113c(sm, 0x6fde6808 + (sm.u32(pDir0) << 4), lvl, pDir0)
  } else if (lvlId === 0x41) {
    mazePlaceSpec113c(sm, 0x6fde6748 + (d0 << 4), lvl, pDir0)
    mazePlaceSpec113c(sm, 0x6fde6848 + (sm.u32(pDir0) << 4), lvl, pDir0)
  }
}

/** `@va D2Common:0x6FD61940` (`DRLGMAZE_PlaceAct1CatacombsPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct1CatacombsPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  mazePlaceSpec113c(sm, 0x6fde6888 + (d0 << 4), lvl, pDir)
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === 0x23) {
    mazePlaceSpec113c(sm, 0x6fde68c8 + (sm.u32(pDir) << 4), lvl, pDir)
  }
}

/** `@va D2Common:0x6FD619B0` (`DRLGMAZE_PlaceAct1JailPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct1JailPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  mazePlaceSpec113c(sm, 0x6fde6908 + (d0 << 4), lvl, pDir)
  const lvlId = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  if (lvlId === 0x1d) {
    mazePlaceSpec113c(sm, 0x6fde69c8 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  if (lvlId === 0x1e) {
    mazePlaceSpec113c(sm, 0x6fde6a08 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  if (lvlId === 0x1f) {
    mazePlaceSpec113c(sm, 0x6fde6948 + (sm.u32(pDir) << 4), lvl, pDir)
  } else {
    mazePlaceSpec113c(sm, 0x6fde6988 + (sm.u32(pDir) << 4), lvl, pDir)
  }
}

/** `@va D2Common:0x6FD61A70` (`DRLGMAZE_PlaceAct1CryptsPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct1CryptsPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  mazePlaceSpec113c(sm, 0x6fde6a48 + (d0 << 4), lvl, pDir)
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === 0x12) {
    mazePlaceSpec113c(sm, 0x6fde6a88 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  const id2 = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  if (id2 === 0x13 || id2 === 0x85) {
    mazePlaceSpec113c(sm, 0x6fde6b08 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  const id3 = sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  if (id3 >= 0x15 && id3 <= 0x18) {
    mazePlaceSpec113c(sm, 0x6fde6b48 + (sm.u32(pDir) << 4), lvl, pDir)
  }
}

/** `@va D2Common:0x6FD61B30` (`DRLGMAZE_PlaceAct1CavesPresets113c`, `esi = pLevel`, `ret`). */
export function DRLGMAZE_PlaceAct1CavesPresets113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const sm = withMazeStackAndRdata113c(m)
  const pDir = MAZE_STACK_BASE_IT14
  const d0 = stepMazeSeed64_113c(sm, lvl) & 3
  sm.setU32(pDir, d0)
  mazePlaceSpec113c(sm, 0x6fde6b88 + (d0 << 4), lvl, pDir)
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === 0x08) {
    mazePlaceSpec113c(sm, 0x6fde6bc8 + (sm.u32(pDir) << 4), lvl, pDir)
  } else {
    mazePlaceSpec113c(sm, 0x6fde6c08 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === 0x09) {
    mazePlaceSpec113c(sm, 0x6fde6c48 + (sm.u32(pDir) << 4), lvl, pDir)
  }
  if ((sm.get(lvl, D2DrlgLevelStrc.nLevelId) | 0) === 0x0a) {
    mazePlaceSpec113c(sm, 0x6fde6c88 + (sm.u32(pDir) << 4), lvl, pDir)
  }
}

/**
 * `@va D2Common:0x6FD61BF0` (`DRLGMAZE_GenerateMazeLevel113c`, not exported;
 * custom LTCG `eax = pLevel`, plain `ret`).
 */
export function DRLGMAZE_GenerateMazeLevel113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0
  const pRoom = DRLGROOM_AllocRoomEx113c(m, lvl, 2) >>> 0
  const pMazeData = m.u32((lvl + 0x14) >>> 0)
  const w = m.u32((pMazeData + 0x10) >>> 0) | 0
  const h = m.u32((pMazeData + 0x14) >>> 0) | 0
  m.setU32((pRoom + 0x3c) >>> 0, w >>> 0)
  m.setU32((pRoom + 0x40) >>> 0, h >>> 0)
  m.setU32((pRoom + 0x34) >>> 0, (((((m.u32((lvl + 0x24) >>> 0) | 0) - w) / 2) | 0) + (m.u32((lvl + 0x1c) >>> 0) | 0)) >>> 0)
  m.setU32((pRoom + 0x38) >>> 0, (((((m.u32((lvl + 0x28) >>> 0) | 0) - h) / 2) | 0) + (m.u32((lvl + 0x20) >>> 0) | 0)) >>> 0)
  m.setU32((pRoom + 0x24) >>> 0, m.u32((lvl + 0x10) >>> 0))
  m.setU32((lvl + 0x08) >>> 0, ((m.u32((lvl + 0x08) >>> 0) | 0) + 1) >>> 0)
  m.setU32((lvl + 0x10) >>> 0, pRoom)

  const nLevelType = m.u32((lvl + 0x1c0) >>> 0) | 0
  const nLevelId = m.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  switch (nLevelType) {
    case 3:
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      DRLGMAZE_PlaceAct1CavesPresets113c(m, lvl)
      break
    case 4:
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      DRLGMAZE_PlaceAct1CryptsPresets113c(m, lvl)
      break
    case 7:
      DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 2)
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      break
    case 8:
      DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 2)
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      DRLGMAZE_PlaceAct1JailPresets113c(m, lvl)
      break
    case 10:
      DRLGMAZE_SpawnCrossOrPairSpecialRooms113c(m, nLevelId === 0x22 ? 1 : 0, lvl)
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      DRLGMAZE_PlaceAct1CatacombsPresets113c(m, lvl)
      break
    case 13:
      DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 2)
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      DRLGMAZE_PlaceAct2SewersPresets113c(m, lvl)
      break
    case 14:
    case 15:
    case 23:
      DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 2)
      break
    case 17:
      if (nLevelId === 0x3d) {
        const pT = m.u32((pRoom + 0x20) >>> 0)
        m.setU32(pT, 0x1e0)
        m.setU32((pT + 0x04) >>> 0, 0xffffffff)
        m.setU32((pT + 0x0c) >>> 0, (m.u32((pT + 0x0c) >>> 0) | 0x02) >>> 0)
      } else {
        DRLGMAZE_SpawnAndAssignCornerRoomPresets113c(m, lvl)
        DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
        DRLGMAZE_PlaceAct2TombPresets113c(m, lvl)
      }
      break
    case 18:
      DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 2)
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      DRLGMAZE_PlaceAct2MaggotLairPresets113c(m, lvl)
      break
    case 19:
      DRLGMAZE_BuildSpiderCavernRing113c(m, lvl)
      DRLGMAZE_PlaceAct2PalaceCellarPresets113c(m, lvl)
      break
    case 22:
      DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 2)
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      DRLGMAZE_PlaceAct3DurancePresets113c(m, lvl)
      break
    case 24:
      DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 2)
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      DRLGMAZE_PlaceAct3FlayerDungeonPresets113c(m, lvl)
      break
    case 25:
      if (nLevelId === 0x5c) {
        DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 5)
        const ok1 = DRLG_ReplacePresetRoom113c(m, lvl, 0x2c5, 0x2df, -1, 0)
        if (ok1 === 0) throw new D2CommonAssertError('DrlgMaze.cpp', 0x849)
        const ok2 = DRLG_ReplacePresetRoom113c(m, lvl, 0x2c6, 0x2e0, -1, 0)
        if (ok2 === 0) throw new D2CommonAssertError('DrlgMaze.cpp', 0x84a)
        const ok3 = DRLG_ReplacePresetRoom113c(m, lvl, 0x2c9, 0x2e1, -1, 0)
        if (ok3 === 0) throw new D2CommonAssertError('DrlgMaze.cpp', 0x84b)
        const ok4 = DRLG_ReplacePresetRoom113c(m, lvl, 0x2ca, 0x2e2, -1, 0)
        if (ok4 === 0) throw new D2CommonAssertError('DrlgMaze.cpp', 0x84c)
      } else {
        DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 2)
      }
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      DRLGMAZE_PlaceAct3SewersPresets113c(m, lvl)
      break
    case 28:
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      break
    case 32:
      DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 2)
      DRLGMAZE_PlaceAct5BaalKeepPresets113c(m, lvl)
      break
    case 33: {
      if (nLevelId === 0x72) {
        const bit = stepMazeSeed64_113c(m, m.u32((pRoom + 0x58) >>> 0)) & 1
        const pT = m.u32((pRoom + 0x20) >>> 0)
        m.setU32(pT, (bit !== 0 ? 0x40e : 0x40f) >>> 0)
        m.setU32((pT + 0x04) >>> 0, 0xffffffff)
        m.setU32((pT + 0x0c) >>> 0, (m.u32((pT + 0x0c) >>> 0) | 0x02) >>> 0)
      } else if (nLevelId === 0x74) {
        const pT = m.u32((pRoom + 0x20) >>> 0)
        m.setU32(pT, 0x410)
        m.setU32((pT + 0x04) >>> 0, 0xffffffff)
        m.setU32((pT + 0x0c) >>> 0, (m.u32((pT + 0x0c) >>> 0) | 0x02) >>> 0)
      } else if (nLevelId === 0x77) {
        const pT = m.u32((pRoom + 0x20) >>> 0)
        m.setU32(pT, 0x411)
        m.setU32((pT + 0x04) >>> 0, 0xffffffff)
        m.setU32((pT + 0x0c) >>> 0, (m.u32((pT + 0x0c) >>> 0) | 0x02) >>> 0)
      } else {
        DRLGMAZE_BuildSquarePerimeterRooms113c(m, lvl, 2)
        DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
        DRLGMAZE_PlaceAct5IceCavesPresets113c(m, lvl)
      }
      break
    }
    case 34:
      DRLGMAZE_SpawnAndAssignCornerRoomPresets113c(m, lvl)
      DRLGMAZE_ExpandRoomsToTargetCount113c(m, lvl)
      DRLGMAZE_PlaceAct5GlacialPresets113c(m, lvl)
      break
    case 35:
      DRLGMAZE_PlaceTunnelsSpecialPresets113c(m, lvl)
      break
    default:
      throw new D2CommonAssertError('DrlgMaze.cpp', 0x883)
  }

  if (nLevelId === 0x1c) {
    DRLGMAZE_FinalizeAct1JailConnect113c(m, lvl)
  } else if (nLevelId === 0x6b) {
    DRLGMAZE_FinalizeAct5HellBarrow113c(m, lvl)
  } else {
    DRLG_ValidateAndRebaseLevelRooms113c(m, lvl)
  }
  DRLG_RandomizePresetRooms113c(m, lvl)

  let cur = m.u32((lvl + 0x10) >>> 0)
  while (cur !== 0) {
    const next = m.u32((cur + 0x24) >>> 0)
    DRLGMAZE_ReplaceMazeRoomWithPresetRooms113c(m, lvl, cur)
    cur = next
  }
}
