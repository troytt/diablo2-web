/**
 * D2Game.dll 1.13c — Milestone 33 [K2] Wave 4 Batch 8 (w4b8).
 *
 * Clean-room 1:1 binary-isomorphic port of 45 D2Game.dll v1.13c functions in
 * the 0x6FCD3770..0x6FCDB6A0 address range (skill SrvSt/SrvDo handlers,
 * monster AI routines for Mephisto/Diablo/Izual/BloodRaven/Duriell/Radament/Summoner/Council/SiegeBeast/SuicideMinion/Baal,
 * and Act 3 / Act 4 quest state callbacks).
 */

import {
  COLLISION_ResetMaskWithPattern113c,
  COLLISION_SetUnitCollisionMaskWithPattern113c,
} from '../common/collision.ts'
import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { PATH_CheckFlag08_113c } from '../common/drlg/room-tile.ts'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32, mulDiv113c } from '../common/int-math.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items.ts'
import { SKILLS_GetUsedSkillMemPort113c } from '../common/k0-d2common-memports.ts'
import { MONSTERS_GetHirelingTypeId113c } from '../common/missile.ts'
import {
  PATH_Compute113c,
  PATH_FaceTowardsCoords113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetNewDirection113c,
  PATH_GetNumberOfPathPoints113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_SetNewDistance113c,
  PATH_SetType113c,
  UNITS_GetDirectionToCoords113c,
} from '../common/path.ts'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_ClearQuestStateBits2To11_113c,
  QUESTRECORD_SetQuestState113c,
  UNITS_GetLeftSkill113c,
  UNITS_GetRightSkill113c,
} from '../common/quest-record.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetParam1113c,
  SKILLS_GetParam2113c,
  SKILLS_GetParam3113c,
  SKILLS_GetParam4113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
} from '../common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNIT_Alloc113c,
  UNITROOM_RefreshUnit113c,
  UNITS_AllocStaticPath113c,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory.ts'
import { seedRoll } from '../prng.ts'
import {
  DATATBLS_GetDirectionOffset113c,
  DATATBLS_NormalizeDirection113c,
} from '../tables/datatbls-113c.ts'
import { DATATBLS_CalcMissileSubLoopFrames113c } from '../tables/missile-tbls-113c.ts'
import { AI_CalcApproxUnitDistSubtiles113c } from './ai-fallen-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import { D2GAME_SUNIT_IterateAllLivingPlayers113c } from './boot-init-gap-b-113c.ts'
import {
  AI_Stall113c,
  AIGENERAL_CopyAiCommandParams113c,
  SUNITDMG_DistributeExperience113c,
} from './combat-a1c-113c.ts'
import {
  type K2GapMeleeDotHooks113c,
  MISSILE_CreateServerProjectile113c,
  MISSILE_SpawnNova64Directions113c,
} from './k2-gap-melee-dot-113c.ts'
import { QUESTS_AddNpcDialogTextNodes113c } from './k2-items-tc-w1-113c.ts'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c.ts'
import { QUESTS_GetQuestData_6FC53F30_113c } from './k2-laneJ-0x6fc4-w1-113c.ts'
import { SKILLS_ResolveSummonMonsterId_6FCBEE50_113c } from './k2-w2b5-113c.ts'
import {
  ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c,
  AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c,
} from './k2-w2b6-113c.ts'
import {
  type K2W3B3Hooks113c,
  QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c,
  QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c,
} from './k2-w3b3-113c.ts'
import {
  ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c,
  type K2W4B3Hooks113c,
} from './k2-w4b3-113c.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTER_Create113c,
  MONSTER_GetDifficultyAndPlayerBonus113c,
  MONSTER_SpawnAtCoords113c,
  MONSTER_SpawnPartyMinionInRing113c,
  type RegpopSpawnHooks113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { SUNIT_FreeUnit113c } from './replay-final11-113c.ts'
import {
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
  type EventWheelHooks113c,
  MONSTER_RefreshAiEvent113c,
} from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

export type { D2KernMemory113c }

let k2W4B8StackPtr = 0x7ef50000

const DIR_OFFSET_TABLE_6FD1B560_VA = 0x6fd1b560
const DEFAULT_DIR_OFFSET_TABLE_6FD1B560: readonly number[] = [10, 8, 22, 20, 18, 16, 14, 12]

function lookupSkillsTxtRecordFast113c(m: D2KernMemory113c, nSkillId: number): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = m.u32(pSgptPtr) >>> 0
  if (id >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  return (pSkillsTxt + imul32(id, 0x23c)) >>> 0
}

function readDirOffsetByte6FD1B560_113c(m: D2KernMemory113c, idx: number): number {
  const i = idx & 7
  for (let k = 0; k < 8; k = (k + 1) | 0) {
    const defByte = DEFAULT_DIR_OFFSET_TABLE_6FD1B560[k]
    if (defByte !== undefined) {
      m.setU8((DIR_OFFSET_TABLE_6FD1B560_VA + k) >>> 0, defByte)
    }
  }
  return m.u8((DIR_OFFSET_TABLE_6FD1B560_VA + i) >>> 0)
}

/**
 * Heals `pUnit`'s target unit by a random percentage of its maximum life
 * rolled between `dwMasteryCalc1` (`+0x138`) and `dwMasteryCalc2` (`+0x13C`).
 *
 * @va D2Game:0x6FCD3770
 */
export function SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD3770)
  const pSkillTxt = lookupSkillsTxtRecordFast113c(m, nSkillId)
  if (pSkillTxt === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  const maxCalc = m.u32((pSkillTxt + 0x13c) >>> 0)
  const maxEval = SKILLS_EvalCalcByOffset113c(m, pUnit, maxCalc, nSkillId, nSkillLevel) | 0
  let maxPct = 0
  if (maxEval > 0) {
    maxPct = maxEval < 100 ? maxEval : 100
  }
  const minCalc = m.u32((pSkillTxt + 0x138) >>> 0)
  const minEval = SKILLS_EvalCalcByOffset113c(m, pUnit, minCalc, nSkillId, nSkillLevel) | 0
  let minPct = minEval <= 0 ? 0 : minEval
  if (minPct >= maxPct) {
    minPct = maxPct
  }
  const range = (maxPct - minPct) | 0
  const roll = SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, range) | 0
  const pct = (roll + minPct) | 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pTarget) | 0
  const curLife = STATLIST_GetUnitStat113c(m, pTarget, 6, 0) | 0
  const healAdd = mulDiv113c(pct, maxLife, 100) | 0
  let newLife = (curLife + healAdd) | 0
  if (newLife <= 1) {
    newLife = 1
  }
  const clampedLife = newLife < maxLife ? newLife : maxLife
  STATLIST_SetUnitStat113c(m, pTarget, 6, clampedLife, 0)
  return 1
}

/**
 * Computes a path of distance 5 toward `pUnit`'s target unit (trying path type 2,
 * then falling back to path type 1) and sets `pSkill->dwParam0C = 1`.
 *
 * @va D2Game:0x6FCD3890
 */
export function SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCD3890)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) {
    return 0
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pSkill === 0) {
    return 0
  }
  PATH_SetNewDistance113c(m, pPath, 5)
  PATH_SetType113c(m, pPath, 2)
  PATH_Compute113c(m, pPath, pUnit, 0)
  if (PATH_GetNumberOfPathPoints113c(m, pPath) === 0) {
    PATH_SetType113c(m, pPath, 1)
    PATH_Compute113c(m, pPath, pUnit, 0)
    if (PATH_GetNumberOfPathPoints113c(m, pPath) === 0) {
      return 0
    }
  }
  SKILLS_SetParam0C113c(m, pSkill, 1)
  return 1
}

/**
 * Validates `pUnit`'s target unit and stores its X/Y coordinates into `pSkill`
 * parameters 1 and 2 (`SKILLS_SetParam1` / `SKILLS_SetParam2`).
 *
 * @va D2Game:0x6FCD3930
 */
export function SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCD3930)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pSkill === 0) {
    return 0
  }
  const unitTypeX = m.u32(pTarget) | 0
  let targetX = 0
  if (unitTypeX === 2 || (unitTypeX > 3 && unitTypeX <= 5)) {
    const pStaticPath = m.u32((pTarget + 0x2c) >>> 0) >>> 0
    targetX = m.u32((pStaticPath + 0x0c) >>> 0) | 0
  } else {
    const pDynPath = m.u32((pTarget + 0x2c) >>> 0) >>> 0
    targetX = pDynPath !== 0 ? (PATH_GetPosX113c(m, pDynPath) | 0) : 0
  }
  SKILLS_SetParam1113c(m, pSkill, targetX)

  const unitTypeY = m.u32(pTarget) | 0
  if (unitTypeY === 2 || (unitTypeY > 3 && unitTypeY <= 5)) {
    const pStaticPath = m.u32((pTarget + 0x2c) >>> 0) >>> 0
    const targetY = m.u32((pStaticPath + 0x10) >>> 0) | 0
    SKILLS_SetParam2113c(m, pSkill, targetY)
    return 1
  }
  const pDynPath = m.u32((pTarget + 0x2c) >>> 0) >>> 0
  const targetY = pDynPath !== 0 ? (PATH_GetPosY113c(m, pDynPath) | 0) : 0
  SKILLS_SetParam2113c(m, pSkill, targetY)
  return 1
}

/**
 * Resolves the summon monster class ID for `(pUnit, nSkillId, nSkillLevel)`,
 * computes an offset toward `pUnit`'s target via `.rdata` direction table `0x6FD1B560`,
 * spawns the monster, and sets flag `0x04000000` on `pSpawned->dwFlags`.
 *
 * @va D2Game:0x6FCD42D0
 */
export function SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  hitD2GameVa113c(0x6FCD42D0)
  const pSkillTxt = lookupSkillsTxtRecordFast113c(m, nSkillId)
  if (pSkillTxt === 0) {
    return 0
  }
  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 0x20) >>> 0
  try {
    const pOutMode = savedSp
    const pOutX = (savedSp + 4) >>> 0
    const pOutY = (savedSp + 8) >>> 0
    const nClassId =
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
        m,
        0,
        0,
        pOutMode,
        pUnit,
        1,
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nClassId < 0) {
      return 0
    }
    SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
    const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
    if (pTarget === (pUnit >>> 0) || pTarget === 0) {
      return 0
    }
    const targetY = UNIT_GetPosY113c(m, pTarget)
    const targetX = UNIT_GetPosX113c(m, pTarget)
    const dirRaw = UNITS_GetDirectionToCoords113c(m, pUnit, targetX, targetY) & 0xff
    const normDir = DATATBLS_NormalizeDirection113c(m, dirRaw) & 0xff
    const dirIdx = normDir & 7
    const dirByte = readDirOffsetByte6FD1B560_113c(m, dirIdx)
    DATATBLS_GetDirectionOffset113c(m, dirByte, pOutX, pOutY)
    const spawnX = (UNIT_GetPosX113c(m, pUnit) + (m.u32(pOutX) | 0)) | 0
    const spawnY = (UNIT_GetPosY113c(m, pUnit) + (m.u32(pOutY) | 0)) | 0
    m.setU8((pUnit + 0x4e) >>> 0, 0)
    const pRoom = UNITS_GetRoom113c(m, pUnit)
    const nMode = m.u32(pOutMode) | 0
    const pSpawned =
      MONSTER_SpawnAtCoords113c(m, nClassId, nMode, pGame, pRoom, spawnX, spawnY, -1, 0, hooks) >>>
      0
    if (pSpawned === 0) {
      return 0
    }
    m.setU32((pSpawned + 0xc4) >>> 0, (m.u32((pSpawned + 0xc4) >>> 0) | 0x04000000) >>> 0)
    return 1
  } finally {
    k2W4B8StackPtr = savedSp
  }
}

/**
 * Fires missile `0x8F` (143) with skill `0xAD` (173) along `pUnit`'s normalized
 * path direction when `PATH_CheckFlag08_113c(pUnit->pPath)` is non-zero.
 *
 * @va D2Game:0x6FCD4870
 */
export function SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FCD4870)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) {
    return 0
  }
  if (PATH_CheckFlag08_113c(m, pPath) === 0) {
    return 0
  }
  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 0x80) >>> 0
  try {
    const pOutX = savedSp
    const pOutY = (savedSp + 4) >>> 0
    const pDirTable = (savedSp + 8) >>> 0
    for (let i = 0; i < 8; i = (i + 1) | 0) {
      m.setU8((pDirTable + i) >>> 0, DEFAULT_DIR_OFFSET_TABLE_6FD1B560[i]!)
    }
    const newDir = PATH_GetNewDirection113c(m, pPath)
    const normDir = DATATBLS_NormalizeDirection113c(m, newDir) & 0xff
    const dirByte = m.u8((pDirTable + normDir) >>> 0)
    DATATBLS_GetDirectionOffset113c(m, dirByte, pOutX, pOutY)
    const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, 0xad)
    const nSkillLevel = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1)

    const unitTypeX = m.u32(pUnit) | 0
    let unitX = 0
    if (unitTypeX === 2 || (unitTypeX > 3 && unitTypeX <= 5)) {
      const pStaticPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
      unitX = m.u32((pStaticPath + 0x0c) >>> 0) | 0
    } else {
      const pDynPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
      unitX = pDynPath !== 0 ? (PATH_GetPosX113c(m, pDynPath) | 0) : 0
    }

    const unitTypeY = m.u32(pUnit) | 0
    let unitY = 0
    if (unitTypeY === 2 || (unitTypeY > 3 && unitTypeY <= 5)) {
      const pStaticPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
      unitY = m.u32((pStaticPath + 0x10) >>> 0) | 0
    } else {
      const pDynPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
      unitY = pDynPath !== 0 ? (PATH_GetPosY113c(m, pDynPath) | 0) : 0
    }

    const dx = m.u32(pOutX) | 0
    const dy = m.u32(pOutY) | 0
    const spawnX = (unitX + dx) | 0
    const spawnY = (unitY + dy) | 0
    const pUnitRoom = UNITS_GetRoom113c(m, pUnit)
    ROOM_FindRoomContainingSubtile113c(m, pUnitRoom, spawnX, spawnY)

    const pParams = (savedSp + 0x18) >>> 0
    for (let i = 0; i < 0x17; i = (i + 1) | 0) {
      m.setU32((pParams + i * 4) >>> 0, 0)
    }
    m.setU32(pParams, 0x21)
    m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x10) >>> 0, 0x8f)
    m.setU32((pParams + 0x14) >>> 0, spawnX >>> 0)
    m.setU32((pParams + 0x18) >>> 0, spawnY >>> 0)
    m.setU32((pParams + 0x1c) >>> 0, (spawnX + dx * 2) >>> 0)
    m.setU32((pParams + 0x20) >>> 0, (spawnY + dy * 2) >>> 0)
    m.setU32((pParams + 0x28) >>> 0, 3)
    m.setU32((pParams + 0x2c) >>> 0, 0xad)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    return MISSILE_CreateServerProjectile113c(m, pGame, pParams, hooks)
  } finally {
    k2W4B8StackPtr = savedSp
  }
}

const RING_OFFSET_Y_6FD1B468_VA = 0x6fd1b468
const RING_OFFSET_X_6FD1B4A8_VA = 0x6fd1b4a8

const DEFAULT_RING_OFFSET_Y_6FD1B468: readonly number[] = [
  2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2, -1, 0, 1, 2, 2,
]
const DEFAULT_RING_OFFSET_X_6FD1B4A8: readonly number[] = [
  0, 1, 2, 2, 2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2, -1,
]

function ensureRingOffsetTablesSeeded113c(m: D2KernMemory113c): void {
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    m.setU32((RING_OFFSET_Y_6FD1B468_VA + i * 4) >>> 0, DEFAULT_RING_OFFSET_Y_6FD1B468[i]! >>> 0)
    m.setU32((RING_OFFSET_X_6FD1B4A8_VA + i * 4) >>> 0, DEFAULT_RING_OFFSET_X_6FD1B4A8[i]! >>> 0)
  }
}

/**
 * Validates `pUnit`'s target and spawns a 64-direction missile nova using
 * `DATATBLS_CalcMissileSubLoopFrames113c(nMissileId, nSkillLevel)` as velocity override.
 *
 * @va D2Game:0x6FCD4D30
 */
export function SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FCD4D30)
  const pSkillTxt = lookupSkillsTxtRecordFast113c(m, nSkillId)
  if (pSkillTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  const nMissileId = (m.u16((pSkillTxt + 0x48) >>> 0) << 16) >> 16
  if (nMissileId < 0 || nMissileId >= (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) {
    return 0
  }
  if ((pUnit >>> 0) !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  const nVelOverride = DATATBLS_CalcMissileSubLoopFrames113c(m, nMissileId, nSkillLevel)
  MISSILE_SpawnNova64Directions113c(
    m,
    pUnit,
    nVelOverride,
    pGame,
    pUnit,
    nMissileId,
    nSkillId,
    nSkillLevel,
    hooks,
  )
  return 1
}

/**
 * Fires a server projectile for `pSkillTxt->wSrvMissileA` (`+0x48`) aimed at
 * `pUnit`'s target unit (or first path point when no target unit exists), with
 * `dwMasteryCalc1` (`+0x138`) stored at `pParams + 0x34`.
 *
 * @va D2Game:0x6FCD5110
 */
export function SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FCD5110)
  const pSkillTxt = lookupSkillsTxtRecordFast113c(m, nSkillId)
  if (pSkillTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  const nMissileId = (m.u16((pSkillTxt + 0x48) >>> 0) << 16) >> 16
  if (nMissileId < 0 || nMissileId >= (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) {
    return 0
  }
  const pMissilesTxt = (m.u32((pDataTables + 0xb64) >>> 0) + imul32(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) {
    return 0
  }
  if ((pUnit >>> 0) !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 0x60) >>> 0
  try {
    const pParams = savedSp
    for (let i = 0; i < 0x17; i = (i + 1) | 0) {
      m.setU32((pParams + i * 4) >>> 0, 0)
    }
    m.setU32(pParams, 3)
    m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x08) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, UNIT_GetPosX113c(m, pUnit) >>> 0)
    m.setU32((pParams + 0x18) >>> 0, UNIT_GetPosY113c(m, pUnit) >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    const calcVal = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x138) >>> 0),
      nSkillId,
      nSkillLevel,
    )
    m.setU32((pParams + 0x34) >>> 0, calcVal >>> 0)

    SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
    const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
    let targetY = 0
    if (pTarget !== (pUnit >>> 0) && pTarget !== 0) {
      const faceY = UNIT_GetPosY113c(m, pTarget)
      const faceX = UNIT_GetPosX113c(m, pTarget)
      PATH_FaceTowardsCoords113c(m, m.u32((pUnit + 0x2c) >>> 0), faceX, faceY, 0)
      const dx = (UNIT_GetPosX113c(m, pTarget) - UNIT_GetPosX113c(m, pUnit)) | 0
      m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
      targetY = UNIT_GetPosY113c(m, pTarget) | 0
    } else {
      const firstX = PATH_GetFirstPointX113c(m, m.u32((pUnit + 0x2c) >>> 0)) | 0
      const dx = (firstX - UNIT_GetPosX113c(m, pUnit)) | 0
      m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
      targetY = PATH_GetFirstPointY113c(m, m.u32((pUnit + 0x2c) >>> 0)) | 0
    }
    const dy = (targetY - UNIT_GetPosY113c(m, pUnit)) | 0
    m.setU32((pParams + 0x20) >>> 0, dy >>> 0)
    MISSILE_CreateServerProjectile113c(m, pGame, pParams, hooks)
    return 1
  } finally {
    k2W4B8StackPtr = savedSp
  }
}

/**
 * Spawns a two-pass ring of projectiles around `pUnit` using the 16-entry
 * `.rdata` perimeter tables at `0x6FD1B4A8` (`dX`) and `0x6FD1B468` (`dY`).
 *
 * @va D2Game:0x6FCD52A0
 */
export function SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FCD52A0)
  const pSkillTxt = lookupSkillsTxtRecordFast113c(m, nSkillId)
  if (pSkillTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  const nMissileId = (m.u16((pSkillTxt + 0x48) >>> 0) << 16) >> 16
  if (nMissileId < 0 || nMissileId >= (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) {
    return 0
  }
  const pMissilesTxt = (m.u32((pDataTables + 0xb64) >>> 0) + imul32(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) {
    return 0
  }
  if ((pUnit >>> 0) !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  ensureRingOffsetTablesSeeded113c(m)
  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 0x60) >>> 0
  try {
    const pParams = savedSp
    for (let i = 0; i < 0x17; i = (i + 1) | 0) {
      m.setU32((pParams + i * 4) >>> 0, 0)
    }
    m.setU32(pParams, 0x1f)
    m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x08) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, UNIT_GetPosX113c(m, pUnit) >>> 0)
    m.setU32((pParams + 0x18) >>> 0, UNIT_GetPosY113c(m, pUnit) >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    const calc1 = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillTxt + 0x138) >>> 0),
      nSkillId,
      nSkillLevel,
    )
    m.setU32((pParams + 0x34) >>> 0, calc1 >>> 0)
    m.setU32((pParams + 0x28) >>> 0, (m.u32((pMissilesTxt + 0x38) >>> 0) << 6) >>> 0)
    let step =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillTxt + 0x13c) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    if (step < 1) {
      step = 1
    }
    for (let off = 0; off < 0x40; off = (off + 8) | 0) {
      const dx = m.u32((RING_OFFSET_X_6FD1B4A8_VA + off) >>> 0)
      const dy = m.u32((RING_OFFSET_Y_6FD1B468_VA + off) >>> 0)
      m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
      m.setU32((pParams + 0x20) >>> 0, dy >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame, pParams, hooks)
    }
    m.setU32((pParams + 0x28) >>> 0, (m.u32((pMissilesTxt + 0x3c) >>> 0) << 6) >>> 0)
    if (step > 1) {
      const byteStride = (step << 2) | 0
      for (let off = 0; off < 0x3c; off = (off + byteStride) | 0) {
        const dy = m.u32((RING_OFFSET_Y_6FD1B468_VA + 4 + off) >>> 0)
        const dx = m.u32((RING_OFFSET_X_6FD1B4A8_VA + 4 + off) >>> 0)
        m.setU32((pParams + 0x20) >>> 0, dy >>> 0)
        m.setU32((pParams + 0x1c) >>> 0, dx >>> 0)
        MISSILE_CreateServerProjectile113c(m, pGame, pParams, hooks)
      }
    }
    return 1
  } finally {
    k2W4B8StackPtr = savedSp
  }
}

/**
 * Fires a projectile toward `pUnit`'s target with the minor axis stepped 4
 * units from `pUnit` toward `pTarget` and origin offset by `rel / 6 - 1`.
 *
 * @va D2Game:0x6FCD5450
 */
export function SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FCD5450)
  const pSkillTxt = lookupSkillsTxtRecordFast113c(m, nSkillId)
  if (pSkillTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  const nMissileId = (m.u16((pSkillTxt + 0x48) >>> 0) << 16) >> 16
  if (nMissileId < 0 || nMissileId >= (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) {
    return 0
  }
  if ((pUnit >>> 0) !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  const targetX = UNIT_GetPosX113c(m, pTarget) | 0
  const targetY = UNIT_GetPosY113c(m, pTarget) | 0
  const unitX = UNIT_GetPosX113c(m, pUnit) | 0
  const unitY = UNIT_GetPosY113c(m, pUnit) | 0
  const absDx = Math.abs((targetX - unitX) | 0) | 0
  const absDy = Math.abs((targetY - unitY) | 0) | 0
  let adjX = targetX
  let adjY = targetY
  if (absDx < absDy) {
    adjX = unitX
    for (let i = 0; i < 4; i = (i + 1) | 0) {
      if (adjX > targetX) {
        adjX = (adjX - 1) | 0
      } else if (adjX < targetX) {
        adjX = (adjX + 1) | 0
      }
    }
  } else {
    adjY = unitY
    for (let i = 0; i < 4; i = (i + 1) | 0) {
      if (adjY > targetY) {
        adjY = (adjY - 1) | 0
      } else if (adjY < targetY) {
        adjY = (adjY + 1) | 0
      }
    }
  }
  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 0x60) >>> 0
  try {
    const pParams = savedSp
    for (let i = 0; i < 0x17; i = (i + 1) | 0) {
      m.setU32((pParams + i * 4) >>> 0, 0)
    }
    const relY = (adjY - unitY) | 0
    const relX = (adjX - unitX) | 0
    const spawnX = (Math.trunc(relX / 6) + unitX - 1) | 0
    const spawnY = (Math.trunc(relY / 6) + unitY - 1) | 0
    m.setU32(pParams, 3)
    m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, spawnX >>> 0)
    m.setU32((pParams + 0x18) >>> 0, spawnY >>> 0)
    m.setU32((pParams + 0x1c) >>> 0, relX >>> 0)
    m.setU32((pParams + 0x20) >>> 0, relY >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    MISSILE_CreateServerProjectile113c(m, pGame, pParams, hooks)
    return 1
  } finally {
    k2W4B8StackPtr = savedSp
  }
}

/**
 * Consumes a dead non-hireling monster corpse target (`dwUnitType == 1`,
 * `dwAnimMode == 12`) and heals `pUnit` by `dwMasteryCalc1` (`+0x138`) percent
 * of the consumed corpse's max life.
 *
 * @va D2Game:0x6FCD5D40
 */
export function SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD5D40)
  const pSkillTxt = lookupSkillsTxtRecordFast113c(m, nSkillId)
  if (pSkillTxt === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  if ((m.u32(pTarget) | 0) !== 1) {
    return 0
  }
  if (MONSTERS_GetHirelingTypeId113c(m, pTarget) !== 0) {
    return 0
  }
  if ((m.u32((pTarget + 0x10) >>> 0) | 0) !== 0x0c) {
    return 0
  }
  const corpseMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pTarget) | 0
  const pRoom = UNITS_GetRoom113c(m, pTarget)
  DUNGEON_AddRoomPortalNode113c(m, pRoom, 1, m.u32((pTarget + 0x0c) >>> 0))
  SUNIT_FreeUnit113c(m, pGame, pTarget)
  const casterCurLife = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
  const casterMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0
  if (corpseMaxLife > 0) {
    const pct =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillTxt + 0x138) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    const healAdd = mulDiv113c(pct, corpseMaxLife, 100) | 0
    let newLife = (casterCurLife + healAdd) | 0
    if (newLife <= 1) {
      newLife = 1
    }
    const clampedLife = newLife < casterMaxLife ? newLife : casterMaxLife
    STATLIST_SetUnitStat113c(m, pUnit, 6, clampedLife, 0)
  }
  return 1
}

/**
 * Emerges a previously prepared summon monster from `pSkill` parameters 1..4,
 * resets the `0x100` collision mask at its subtile, spawns the monster, and
 * applies `pSkillTxt->wSummonState` (`+0xE6`) skill icon if valid.
 *
 * @va D2Game:0x6FCD5E50
 */
export function SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  _nSkillLevel = 0,
  hooks?: RegpopSpawnHooks113c,
): number {
  hitD2GameVa113c(0x6FCD5E50)
  const pSkillTxt = lookupSkillsTxtRecordFast113c(m, nSkillId)
  if (pSkillTxt === 0) {
    return 0
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pSkill === 0) {
    return 0
  }
  if ((pUnit >>> 0) !== 0) {
    let pNode = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pNode !== 0) {
      const pNext = m.u32((pNode + 0x24) >>> 0) >>> 0
      if (m.u8(pNode) === 1) {
        EVENT_FreeNode113c(m, pGame, pNode)
      }
      pNode = pNext
    }
  }
  MONSTER_RefreshAiEvent113c(m, pUnit, 0)
  const nClassId = SKILLS_GetParam1113c(m, pSkill) | 0
  const spawnX = SKILLS_GetParam2113c(m, pSkill) | 0
  const spawnY = SKILLS_GetParam3113c(m, pSkill) | 0
  const nMode = SKILLS_GetParam4113c(m, pSkill) | 0
  const pUnitRoom = UNITS_GetRoom113c(m, pUnit)
  const pSpawnRoom = ROOM_FindRoomContainingSubtile113c(m, pUnitRoom, spawnX, spawnY) >>> 0
  if (pSpawnRoom === 0 || spawnX === 0 || spawnY === 0) {
    return 0
  }
  COLLISION_ResetMaskWithPattern113c(m, pSpawnRoom, spawnX, spawnY, 1, 0x100)
  const pSpawned =
    MONSTER_SpawnAtCoords113c(
      m,
      nClassId,
      nMode,
      pGame,
      pSpawnRoom,
      spawnX,
      spawnY,
      1,
      0,
      hooks,
    ) >>> 0
  if (pSpawned === 0) {
    return 0
  }
  m.setU32((pSpawned + 0xc4) >>> 0, (m.u32((pSpawned + 0xc4) >>> 0) | 0x04020000) >>> 0)
  const wSummonState = (m.u16((pSkillTxt + 0xe6) >>> 0) << 16) >> 16
  if (wSummonState >= 0) {
    const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
    const nStatesCount = m.u32((pDataTables + 0xbc0) >>> 0) | 0
    if (wSummonState < nStatesCount) {
      STATES_SetMonsterSkillIconOnUnit113c(m, pSpawned, wSummonState, 0)
    }
  }
  return 1
}

/**
 * Resolves the summon monster ID, spawn coordinates, and mode for `pUnit`,
 * stores them in `pSkill` parameters 1..4, marks collision `0x100` at the
 * target subtile, refreshes AI events, and frees type-1 timer nodes.
 *
 * @va D2Game:0x6FCD5FB0
 */
export function SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD5FB0)
  const pSkillTxt = lookupSkillsTxtRecordFast113c(m, nSkillId)
  if (pSkillTxt === 0) {
    return 0
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pSkill === 0) {
    return 0
  }
  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 0x10) >>> 0
  try {
    const pOutX = savedSp
    const pOutMode = (savedSp + 4) >>> 0
    const pOutY = (savedSp + 8) >>> 0
    const nClassId =
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
        m,
        pOutY,
        pOutX,
        pOutMode,
        pUnit,
        1,
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nClassId < 0) {
      return 0
    }
    const outX = m.u32(pOutX) | 0
    const outY = m.u32(pOutY) | 0
    const outMode = m.u32(pOutMode) | 0
    SKILLS_SetParam1113c(m, pSkill, nClassId)
    SKILLS_SetParam2113c(m, pSkill, outX)
    SKILLS_SetParam3113c(m, pSkill, outY)
    SKILLS_SetParam4113c(m, pSkill, outMode)
    const pUnitRoom = UNITS_GetRoom113c(m, pUnit)
    const pSpawnRoom = ROOM_FindRoomContainingSubtile113c(m, pUnitRoom, outX, outY)
    COLLISION_SetUnitCollisionMaskWithPattern113c(m, pSpawnRoom, outX, outY, 1, 0x100)
    MONSTER_RefreshAiEvent113c(m, pUnit, 1)
    if ((pUnit >>> 0) !== 0) {
      let pNode = m.u32((pUnit + 0xdc) >>> 0) >>> 0
      while (pNode !== 0) {
        const pNext = m.u32((pNode + 0x24) >>> 0) >>> 0
        if (m.u8(pNode) === 1) {
          EVENT_FreeNode113c(m, pGame, pNode)
        }
        pNode = pNext
      }
    }
    return 1
  } finally {
    k2W4B8StackPtr = savedSp
  }
}

/**
 * Spawns party minions in expanding rings around `pUnit` up to `dwMasteryCalc1` (`+0x138`)
 * count and distributes experience via `SUNITDMG_DistributeExperience113c`.
 *
 * @va D2Game:0x6FCD65E0
 */
export function SKILLS_SrvDo141_SpawnPartyMinionsAndDistributeExp_6FCD65E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  hitD2GameVa113c(0x6FCD65E0)
  const pSkillTxt = lookupSkillsTxtRecordFast113c(m, nSkillId)
  if (pSkillTxt === 0) {
    return 0
  }
  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 8) >>> 0
  try {
    const pOutMode = savedSp
    const nClassId =
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
        m,
        0,
        0,
        pOutMode,
        pUnit,
        1,
        nSkillId,
        nSkillLevel,
      ) | 0
    if (nClassId < 0) {
      return 0
    }
    if (SKILLS_GetUsedSkillMemPort113c(m, pUnit) === 0) {
      return 0
    }
    m.setU32((pUnit + 0x3c) >>> 0, 0)
    const targetCount =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        m.u32((pSkillTxt + 0x138) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
    if (targetCount > 0) {
      let spawnedCount = 0
      const nMode = m.u32(pOutMode) | 0
      const pFirst =
        MONSTER_SpawnPartyMinionInRing113c(m, nClassId, pUnit, nMode, pGame, -1, 0, hooks) >>> 0
      if (pFirst !== 0) {
        m.setU32((pFirst + 0xc4) >>> 0, (m.u32((pFirst + 0xc4) >>> 0) | 0x04000000) >>> 0)
        spawnedCount = 1
      }
      let radius = 1
      let attempts = 0
      if (spawnedCount < targetCount) {
        while (radius < 5 && attempts < ((targetCount * 2) | 0)) {
          const pMinion =
            MONSTER_SpawnPartyMinionInRing113c(m, nClassId, pUnit, 8, pGame, radius, 0, hooks) >>> 0
          if (pMinion !== 0) {
            m.setU32((pMinion + 0xc4) >>> 0, (m.u32((pMinion + 0xc4) >>> 0) | 0x04000000) >>> 0)
            spawnedCount = (spawnedCount + 1) | 0
          } else {
            radius = (radius + 1) | 0
          }
          attempts = (attempts + 1) | 0
          if (spawnedCount >= targetCount) {
            break
          }
        }
      }
    }
    SUNITDMG_DistributeExperience113c(m, pGame, pUnit, pUnit)
    return 1
  } finally {
    k2W4B8StackPtr = savedSp
  }
}

/**
 * Purges type-0 timer nodes on `pUnit` and schedules a type-1 timer event at
 * `pGame->dwGameFrame + nFrames` (where `nFrames` is `pMonStats2->bSubmergeFrames` at `+0x108` or `11`).
 *
 * @va D2Game:0x6FCD6720
 */
export function SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  eventHooks?: EventWheelHooks113c,
): number {
  hitD2GameVa113c(0x6FCD6720)
  let nFrames = 11
  if ((pUnit >>> 0) !== 0) {
    if ((m.u32(pUnit) | 0) === 1) {
      const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
      if (pMonStats2 !== 0) {
        nFrames = m.u8((pMonStats2 + 0x108) >>> 0)
      }
    }
    let pNode = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pNode !== 0) {
      const pNext = m.u32((pNode + 0x24) >>> 0) >>> 0
      if (m.u8(pNode) === 0) {
        EVENT_FreeNode113c(m, pGame, pNode)
      }
      pNode = pNext
    }
  }
  const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + nFrames) >>> 0
  EVENT_SetEventFull113c(m, pGame, pUnit, 1, targetFrame, 0, 0, 0, eventHooks)
  return 1
}

/**
 * Computes a 16-entry action weight table for Baal AI based on difficulty,
 * distance to `pTarget`, life percent, player count, and target active skills,
 * and rolls a weighted action index `0..15` using `pUnit->tSeed`.
 *
 * @va D2Game:0x6FCD7380
 */
export function AIBAAL_ChooseActionWeighted_6FCD7380_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pAiState: number,
  pTarget: number,
  nNearbyCount: number,
  bHasCloneOrTentacle: number,
  bTargetChilled: number,
  bTargetCursed: number,
  nFrameDelta: number,
): number {
  hitD2GameVa113c(0x6FCD7380)
  const weights = new Int32Array(16)
  weights[0] = 0
  weights[2] = 5
  weights[3] = 5
  weights[4] = 5
  weights[5] = 0
  weights[6] = 5
  weights[7] = 0
  weights[8] = 40
  weights[9] = 40
  weights[10] = 0
  weights[11] = 70
  weights[12] = 80
  weights[13] = 60
  weights[14] = 20

  let baseW1 = 100
  if (m.u8((pGame + 0x6d) >>> 0) === 0) {
    baseW1 = 125
    weights[13] = 40
  }

  const stateField18 = m.u32((pAiState + 0x18) >>> 0) | 0
  const w15 = ((2 - stateField18) * 10) | 0
  weights[15] = w15 >= 0 ? w15 : 0

  const dist = AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pTarget) | 0
  if (dist > 35) {
    weights[6] = 15
    weights[13] = 0
  }

  const lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit) | 0
  weights[1] = (baseW1 + (100 - lifePct)) | 0

  if (dist > 25) {
    weights[14] = 30
    weights[11] = 0
  }

  if ((nNearbyCount | 0) < 2) {
    weights[11] = (weights[11]! - 10) | 0
  }
  if ((nNearbyCount | 0) > 3) {
    weights[13] = (weights[13]! + 25) | 0
  }
  if ((nFrameDelta | 0) > 60) {
    weights[8] = 70
  }

  UNITS_GetRoom113c(m, pUnit)
  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 0x18) >>> 0
  let nEffectiveDiff = 0
  try {
    MONSTER_GetDifficultyAndPlayerBonus113c(
      m,
      pGame,
      savedSp,
      (savedSp + 4) >>> 0,
      (savedSp + 8) >>> 0,
      (savedSp + 12) >>> 0,
      pUnit,
    )
    nEffectiveDiff = m.u32(savedSp) | 0
  } finally {
    k2W4B8StackPtr = savedSp
  }

  if ((nNearbyCount | 0) < 2 && nEffectiveDiff < 2) {
    weights[8] = 0
  }

  const pRightSkill = UNITS_GetRightSkill113c(m, pTarget)
  let bHighThreat = AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pRightSkill, pTarget) | 0
  if (bHighThreat === 0) {
    const pLeftSkill = UNITS_GetLeftSkill113c(m, pTarget)
    bHighThreat = AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pLeftSkill, pTarget) | 0
  }

  if (bHighThreat !== 0) {
    if ((bHasCloneOrTentacle | 0) === 0) {
      weights[6] = (weights[6]! + 30) | 0
      weights[11] = (weights[11]! + 10) | 0
      weights[14] = (weights[14]! + 15) | 0
    } else {
      weights[3] = 25
      weights[2] = 0
      weights[6] = (weights[6]! + 25) | 0
      weights[14] = (weights[14]! + 35) | 0
    }
  } else if ((bHasCloneOrTentacle | 0) !== 0) {
    weights[3] = 25
    weights[2] = 0
    weights[6] = (weights[6]! + 25) | 0
    weights[14] = (weights[14]! + 35) | 0
  }

  if ((bTargetChilled | 0) !== 0) {
    weights[5] = 60
  }
  if ((bTargetCursed | 0) !== 0) {
    weights[7] = 0
  }

  let totalWeight = 0
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    totalWeight = (totalWeight + weights[i]!) | 0
  }

  let roll = 0
  if (totalWeight > 0) {
    const seed = {
      lo: m.u32((pUnit + 0x20) >>> 0) >>> 0,
      hi: m.u32((pUnit + 0x24) >>> 0) >>> 0,
    }
    roll = seedRoll(seed, totalWeight)
    m.setU32((pUnit + 0x20) >>> 0, seed.lo >>> 0)
    m.setU32((pUnit + 0x24) >>> 0, seed.hi >>> 0)
  }

  let acc = 0
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    acc = (acc + weights[i]!) | 0
    if ((roll | 0) < (acc | 0)) {
      return i
    }
  }
  return 1
}


/**
 * Computes a 16-entry ranged/mid-range action weight table for Baal AI and
 * rolls a weighted action index `0..15` using `pUnit->tSeed`.
 *
 * @va D2Game:0x6FCD75D0
 */
export function AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c(
  m: D2KernMemory113c,
  pTarget: number,
  pGame: number,
  pUnit: number,
  nNearbyCount: number,
  bHasCloneOrTentacle: number,
  bTargetChilled: number,
): number {
  hitD2GameVa113c(0x6FCD75D0)
  const weights = new Int32Array(16)
  weights[0] = 0
  weights[2] = 20
  weights[3] = 20
  weights[4] = 20
  weights[5] = 0
  weights[6] = 20
  weights[7] = 0
  weights[8] = 80
  weights[9] = 70
  weights[10] = 0
  weights[11] = 0
  weights[12] = 0
  weights[13] = 0
  weights[14] = 0
  weights[15] = 0

  let baseW1 = 100
  if (m.u8((pGame + 0x6d) >>> 0) === 0) {
    baseW1 = 125
  }
  if ((nNearbyCount | 0) < 2) {
    weights[2] = 45
    weights[10] = 25
  }

  const lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit) | 0
  weights[1] = (baseW1 + (100 - lifePct)) | 0

  const pRightSkill = UNITS_GetRightSkill113c(m, pTarget)
  let bHighThreat = AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pRightSkill, pTarget) | 0
  if (bHighThreat === 0) {
    const pLeftSkill = UNITS_GetLeftSkill113c(m, pTarget)
    bHighThreat = AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pLeftSkill, pTarget) | 0
  }

  if (bHighThreat !== 0) {
    if ((bHasCloneOrTentacle | 0) === 0) {
      weights[14] = 50
      weights[13] = 50
    } else {
      weights[2] = 0
      weights[6] = 0
      weights[3] = 35
      weights[11] = 25
      weights[13] = 25
    }
  } else if ((bHasCloneOrTentacle | 0) !== 0) {
    weights[2] = 0
    weights[6] = 0
    weights[3] = 35
    weights[11] = 25
    weights[13] = 25
  }

  if ((bTargetChilled | 0) !== 0) {
    weights[5] = 60
  }

  let totalWeight = 0
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    totalWeight = (totalWeight + weights[i]!) | 0
  }

  let roll = 0
  if (totalWeight > 0) {
    const seed = {
      lo: m.u32((pUnit + 0x20) >>> 0) >>> 0,
      hi: m.u32((pUnit + 0x24) >>> 0) >>> 0,
    }
    roll = seedRoll(seed, totalWeight)
    m.setU32((pUnit + 0x20) >>> 0, seed.lo >>> 0)
    m.setU32((pUnit + 0x24) >>> 0, seed.hi >>> 0)
  }

  let acc = 0
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    acc = (acc + weights[i]!) | 0
    if ((roll | 0) < (acc | 0)) {
      return i
    }
  }
  return 1
}

/**
 * Computes a 16-entry close-range action weight table for Baal AI and rolls
 * a weighted action index `0..15` using `pUnit->tSeed`.
 *
 * @va D2Game:0x6FCD7750
 */
export function AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pTarget: number,
  bAllowCloseAttacks: number,
): number {
  hitD2GameVa113c(0x6FCD7750)
  const weights = new Int32Array(16)
  weights[0] = 0
  weights[2] = 0
  weights[3] = 0
  weights[4] = 0
  weights[5] = 0
  weights[6] = 0
  weights[7] = 0
  weights[8] = 20
  weights[9] = 30
  weights[10] = 150
  weights[11] = 10
  weights[12] = 10
  weights[13] = 70
  weights[14] = 40
  weights[15] = 0

  let baseW1 = 50
  if (m.u8((pGame + 0x6d) >>> 0) === 0) {
    baseW1 = 75
    weights[13] = 45
  }

  if ((STATLIST_GetUnitLifePercent113c(m, pTarget) | 0) < 33) {
    weights[10] = 200
  }

  const unitLifePct = STATLIST_GetUnitLifePercent113c(m, pUnit) | 0
  weights[1] = (baseW1 + (100 - unitLifePct)) | 0

  if (STATES_CheckState113c(m, pTarget, 0x0b) !== 0) {
    weights[8] = 0
    weights[13] = 0
    weights[11] = 0
  }
  if ((bAllowCloseAttacks | 0) === 0) {
    weights[11] = 0
    weights[13] = 0
    weights[12] = 0
  }

  let totalWeight = 0
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    totalWeight = (totalWeight + weights[i]!) | 0
  }

  let roll = 0
  if (totalWeight > 0) {
    const seed = {
      lo: m.u32((pUnit + 0x20) >>> 0) >>> 0,
      hi: m.u32((pUnit + 0x24) >>> 0) >>> 0,
    }
    roll = seedRoll(seed, totalWeight)
    m.setU32((pUnit + 0x20) >>> 0, seed.lo >>> 0)
    m.setU32((pUnit + 0x24) >>> 0, seed.hi >>> 0)
  }

  let acc = 0
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    acc = (acc + weights[i]!) | 0
    if ((roll | 0) < (acc | 0)) {
      return i
    }
  }
  return 1
}

/**
 * Preserves AI command `10` arguments across `AI_InitMonsterAiThinkFn113c`,
 * clears state `12` (`STATE_BLAZE` / chill), re-adds AI command `10` if lost,
 * and stalls `pUnit` for 1 frame.
 *
 * @va D2Game:0x6FCD78A0
 */
export function AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParamPtr: number,
): void {
  hitD2GameVa113c(0x6FCD78A0)
  const pAiParam = m.u32(pAiParamPtr >>> 0) >>> 0
  let savedArg1 = 0
  let savedArg2 = 0

  if ((pUnit >>> 0) !== 0 && (m.u32(pUnit) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGeneral !== 0) {
        const pCmdHead = m.u32((pAiGeneral + 0x20) >>> 0) >>> 0
        if (pCmdHead !== 0) {
          let pNode = m.u32(pCmdHead) >>> 0
          if ((m.u32((pNode + 8) >>> 0) | 0) !== 10) {
            while (pNode !== pCmdHead) {
              pNode = m.u32(pNode) >>> 0
              if ((m.u32((pNode + 8) >>> 0) | 0) === 10) {
                break
              }
            }
          }
          if ((m.u32((pNode + 8) >>> 0) | 0) === 10) {
            savedArg1 = m.u32((pNode + 0x0c) >>> 0) | 0
            savedArg2 = m.u32((pNode + 0x10) >>> 0) | 0
          }
        }
      }
    }
  }

  if (STATES_CheckState113c(m, pUnit, 0x0c) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, 0x0c, 0)
  }

  const nAiIdxArg = m.u32(pAiParam) | 0
  const pAiGenArg = m.u32(pAiParamPtr >>> 0) >>> 0
  AI_InitMonsterAiThinkFn113c(m, pUnit, pGame, pAiGenArg, nAiIdxArg)

  let hasCmd10After = false
  if ((pUnit >>> 0) !== 0 && (m.u32(pUnit) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGeneral !== 0) {
        const pCmdHead = m.u32((pAiGeneral + 0x20) >>> 0) >>> 0
        if (pCmdHead !== 0) {
          let pNode = m.u32(pCmdHead) >>> 0
          if ((m.u32((pNode + 8) >>> 0) | 0) !== 10) {
            while (pNode !== pCmdHead) {
              pNode = m.u32(pNode) >>> 0
              if ((m.u32((pNode + 8) >>> 0) | 0) === 10) {
                break
              }
            }
          }
          if ((m.u32((pNode + 8) >>> 0) | 0) === 10) {
            hasCmd10After = true
          }
        }
      }
    }
  }

  if (!hasCmd10After && savedArg1 !== 0 && savedArg2 !== 0) {
    AIGENERAL_CopyAiCommandParams113c(m, pUnit, 10, savedArg1, savedArg2, 0, 0)
  }

  AI_Stall113c(m, pGame, pUnit, 1)
}

/**
 * Evaluates Act 4 Quest 1 (Fallen Angel / Tyrael) NPC quest indicator bits
 * for Tyrael (`367`) and Izual (`246`) across Classic and Expansion games.
 *
 * @va D2Game:0x6FCD8970
 */
export function ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcClassId: number,
  _pArg1: number,
  pQuestFlags: number,
  _pArg3 = 0,
): number {
  hitD2GameVa113c(0x6FCD8970)
  if ((nNpcClassId | 0) === 0x16f) {
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0x0f) === 0 &&
      m.u8((pQuestData + 0x0c) >>> 0) === 1
    ) {
      return 1
    }
    const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
    if (m.u32((pGame + 0x70) >>> 0) === 0) {
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) !== 0 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 7) !== 0
      ) {
        return 1
      }
    }
    const pGame2 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
    if (m.u32((pGame2 + 0x70) >>> 0) !== 0) {
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) !== 0 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 9) === 0
      ) {
        return 1
      }
    }
    return 0
  }

  if ((nNpcClassId | 0) === 0xf6) {
    const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
    if (m.u32((pGame + 0x70) >>> 0) === 0) {
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) !== 0 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 6) !== 0
      ) {
        return 1
      }
    }
    const pGame2 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
    if (m.u32((pGame2 + 0x70) >>> 0) !== 0) {
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) !== 0 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 8) === 0
      ) {
        return 1
      }
    }
  }
  return 0
}

/**
 * Checks whether Act 4 Quest 1 is already active (`bState != 5 && bActive != 0`)
 * or dispatches the linked quest's `+0xF0` start callback.
 *
 * @va D2Game:0x6FCD8A70
 */
export function ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  hooks?: {
    isBadCodePtr?: (pfn: number) => number
    onQuestCallbackF0?: (m: D2KernMemory113c, pfn: number, pQuest: number) => number
  },
): number {
  hitD2GameVa113c(0x6FCD8A70)
  if (m.u8((pQuestData + 0x0c) >>> 0) !== 5 && m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    return 1
  }
  const pLinkedQuest =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      m.u32((pQuestData + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pLinkedQuest === 0) {
    return 0
  }
  const pfn = m.u32((pLinkedQuest + 0xf0) >>> 0) >>> 0
  const isBad =
    hooks !== undefined && hooks.isBadCodePtr !== undefined
      ? hooks.isBadCodePtr(pfn)
      : pfn === 0
        ? 1
        : 0
  if (isBad !== 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Quests\\a4q1.cpp', 0xa1)
  }
  if (hooks !== undefined && hooks.onQuestCallbackF0 !== undefined) {
    return hooks.onQuestCallbackF0(m, pfn, pLinkedQuest) & 0xff
  }
  return 1
}


/**
 * Evaluates Act 4 Quest 1 (Fallen Angel) active quest indicator bits for
 * Tyrael (`367`) and Izual spirit (`406`) on quest `0x19` (`25`).
 *
 * @va D2Game:0x6FCD8AE0
 */
export function ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcClassId: number,
  _pArg1: number,
  pQuestFlags: number,
  _pArg3 = 0,
): number {
  hitD2GameVa113c(0x6FCD8AE0)
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0) !== 0) {
    return 0
  }
  if ((nNpcClassId | 0) === 0x16f) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 1) === 1) {
      return 1
    }
    if (m.u8((pQuestData + 0x0c) >>> 0) === 1) {
      return 1
    }
    return 0
  }
  if ((nNpcClassId | 0) === 0x196) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 5) === 0) {
      return 1
    }
  }
  return 0
}

/**
 * Checks whether Hadriel (`408` / `0x198`) has a quest indicator for `pPlayer`
 * based on quest `0x1B` and `0x1A` state bits.
 *
 * @va D2Game:0x6FCD8B90
 */
export function ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcClassId: number,
  pPlayer: number,
  _pQuestFlags = 0,
  _pArg3 = 0,
): number {
  hitD2GameVa113c(0x6FCD8B90)
  if ((nNpcClassId | 0) !== 0x198) {
    return 0
  }
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 1) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0x0d) === 0
  ) {
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0x0d) !== 0) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) !== 0) {
    return 0
  }
  return 1
}

/**
 * Populates Hadriel (`408` / `0x198`) NPC dialog text nodes (slot `0` or `1`)
 * based on quest `0x1B` state bits and quest `0x17` custom flag `+0x14`.
 *
 * @va D2Game:0x6FCD8C00
 */
export function ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pNpcParams: number,
): void {
  hitD2GameVa113c(0x6FCD8C00)
  const pNpcUnit = m.u32((pNpcParams + 0x08) >>> 0) >>> 0
  if (pNpcUnit === 0) {
    return
  }
  if ((m.u32((pNpcUnit + 0x04) >>> 0) | 0) !== 0x198) {
    return
  }
  const pPlayerUnit = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pNpcParams >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 1) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0x0d) === 0
  ) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData,
      0,
      m.u32((pNpcParams + 0x14) >>> 0),
      0x198,
    )
    return
  }

  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestChain !== 0) {
    let pNode = m.u32(pQuestChain) >>> 0
    while (pNode !== 0) {
      if ((m.u32(pNode) | 0) === 0x17) {
        const pCustom = m.u32((pNode + 0x18) >>> 0) >>> 0
        if (m.u8((pCustom + 0x14) >>> 0) !== 0) {
          return
        }
        break
      }
      pNode = m.u32((pNode + 0xf4) >>> 0) >>> 0
    }
  }

  QUESTS_AddNpcDialogTextNodes113c(
    m,
    pQuestData,
    1,
    m.u32((pNpcParams + 0x14) >>> 0),
    0x198,
  )
}

/**
 * Populates Act 4 Quest 2 (Hell's Forge) NPC dialog text nodes (slots `0..3`)
 * checking quest state bits, player GUID history, and `'mss '` Soulstone presence.
 *
 * @va D2Game:0x6FCD8CE0
 */
export function ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pNpcParams: number,
): void {
  hitD2GameVa113c(0x6FCD8CE0)
  const pPlayerUnit = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pNpcParams >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  const pNpcUnit = m.u32((pNpcParams + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpcUnit === 0 ? -1 : m.u32((pNpcUnit + 0x04) >>> 0) | 0

  const nQuestId = m.u32((pQuestData + 0xe0) >>> 0) | 0
  const bBit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0) | 0
  const bBit13 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0x0d) | 0
  const bBit1 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 1) | 0

  if (bBit1 !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData,
      2,
      m.u32((pNpcParams + 0x14) >>> 0),
      nNpcClassId,
    )
    return
  }

  const playerGuid = pPlayerUnit === 0 ? -1 : m.u32((pPlayerUnit + 0x0c) >>> 0) | 0
  const nGuidCount = m.u16((pQuestData + 0x9c) >>> 0)
  for (let i = 0; i < nGuidCount; i = (i + 1) | 0) {
    if ((m.u32((pQuestData + 0x1c + i * 4) >>> 0) | 0) === playerGuid) {
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        pQuestData,
        3,
        m.u32((pNpcParams + 0x14) >>> 0),
        nNpcClassId,
      )
      return
    }
  }

  const bState = m.u8((pQuestData + 0x0c) >>> 0)
  if (bState === 0 || bBit0 === 1) {
    return
  }
  if (bState >= 4 && bBit13 === 0) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 1) !== 0) {
    return
  }
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) {
    return
  }

  const bState2 = m.u8((pQuestData + 0x0c) >>> 0)
  const pGame2 = m.u32(pNpcParams >>> 0) >>> 0
  const pPlayer2 = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  if (bState2 === 1) {
    if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer2, pGame2, 0x2073736d) !== 0) {
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        pQuestData,
        0,
        m.u32((pNpcParams + 0x14) >>> 0),
        nNpcClassId,
      )
      return
    }
    const pCustom = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    if (m.u8((pCustom + 0x1c) >>> 0) !== 0 || m.u8((pQuestData + 0x0b) >>> 0) >= 3) {
      return
    }
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData,
      1,
      m.u32((pNpcParams + 0x14) >>> 0),
      nNpcClassId,
    )
    return
  }

  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer2, pGame2, 0x2073736d) !== 0) {
    return
  }
  if (m.u8((pQuestData + 0x0b) >>> 0) >= 3) {
    return
  }
  const pCustom = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pCustom + 0x1c) >>> 0) !== 0) {
    return
  }
  QUESTS_AddNpcDialogTextNodes113c(
    m,
    pQuestData,
    1,
    m.u32((pNpcParams + 0x14) >>> 0),
    nNpcClassId,
  )
}

/**
 * Synchronizes quest `0x1B` (`27`) state bits (`2`, `3`, or `5`) on `pPlayer`
 * from quest node `0x18` (`24`) state and custom data `+0x1C`.
 *
 * @va D2Game:0x6FCD8E80
 */
export function ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCD8E80)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0) === 1) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 1) === 1) {
    return 0
  }

  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestChain === 0) {
    return 0
  }
  let pNode = m.u32(pQuestChain) >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) | 0) === 0x18) {
      const bState = m.u8((pNode + 0x0c) >>> 0)
      if (bState === 2) {
        const pCustom = m.u32((pNode + 0x18) >>> 0) >>> 0
        if (m.u8((pCustom + 0x1c) >>> 0) === 1) {
          QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1b, 5)
        } else {
          QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1b, 2)
        }
        return 0
      }
      if (bState === 3) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1b, 3)
      }
      return 0
    }
    pNode = m.u32((pNode + 0xf4) >>> 0) >>> 0
  }
  return 0
}


const ACT4Q3_STATE_DIALOG_SLOT_6FD26B24_VA = 0x6fd26b24
const ACT4Q3_STATE_DIALOG_SLOT_6FD26B24_VALS = [
  -1, 0, 1, -1, -1, 246, 678, 1, 0, 0, 0, 0, 0, 0, 0, 0,
] as const

function ensureAct4Q3DialogSlotTableSeeded113c(m: D2KernMemory113c): void {
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    m.setU32(
      (ACT4Q3_STATE_DIALOG_SLOT_6FD26B24_VA + i * 4) >>> 0,
      ACT4Q3_STATE_DIALOG_SLOT_6FD26B24_VALS[i]! >>> 0,
    )
  }
}

/**
 * Updates Act 4 Quest 3 (`0x1A`) state and sub-state bytes (`+0x0B`, `+0x0C`)
 * from `pPlayer`'s quest record bits (`2`, `3`, `4`), clearing bit `9` in
 * Expansion if quest `0x1C` bit `0` is not set.
 *
 * @va D2Game:0x6FCD8F20
 */
export function ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pNpcParams: number,
): void {
  hitD2GameVa113c(0x6FCD8F20)
  const pPlayerUnit = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pNpcParams >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  const pGame2 = m.u32(pNpcParams >>> 0) >>> 0
  if (m.u32((pGame2 + 0x70) >>> 0) !== 0) {
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 9) !== 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1c, 0) === 0
    ) {
      QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x1a, 9)
    }
  }

  const nQuestId = m.u32((pQuestData + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0) !== 0) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0x0f) !== 0) {
    return
  }

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 4) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 2)
    m.setU8((pQuestData + 0x0c) >>> 0, 3)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 3) === 1) {
    m.setU8((pQuestData + 0x0c) >>> 0, 3)
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 2) === 1) {
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
  }
}

/**
 * Populates Act 4 Quest 3 (Terror's End / Diablo) NPC dialog text nodes for
 * Tyrael (`367`) and Cain (`246`) across Classic and Expansion games.
 *
 * @va D2Game:0x6FCD9070
 */
export function ACT4Q3_InitNpcDialog_6FCD9070_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pNpcParams: number,
): void {
  hitD2GameVa113c(0x6FCD9070)
  ensureAct4Q3DialogSlotTableSeeded113c(m)
  const pPlayerUnit = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pNpcParams >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  const nQuestId = m.u32((pQuestData + 0xe0) >>> 0) | 0
  const bBit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0) | 0
  const bBit13 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0x0d) | 0

  const pNpcUnit = m.u32((pNpcParams + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpcUnit === 0 ? -1 : m.u32((pNpcUnit + 0x04) >>> 0) | 0

  const bBit1a_7 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 7) | 0
  const bBit1a_6 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 6) | 0
  const bBit1a_9 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 9) | 0
  const bBit1a_8 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 8) | 0

  const pQuestGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const bExpansion = m.u32((pQuestGame + 0x70) >>> 0) | 0

  if (bExpansion === 0) {
    if (bBit1a_7 !== 0 && nNpcClassId === 0x16f) {
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        pQuestData,
        2,
        m.u32((pNpcParams + 0x14) >>> 0),
        nNpcClassId,
      )
      return
    }
    if (bBit1a_6 !== 0 && nNpcClassId === 0xf6) {
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        pQuestData,
        2,
        m.u32((pNpcParams + 0x14) >>> 0),
        nNpcClassId,
      )
      return
    }
    if (bBit1a_7 !== 0) {
      if (nNpcClassId !== 0xf6) {
        return
      }
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        pQuestData,
        3,
        m.u32((pNpcParams + 0x14) >>> 0),
        nNpcClassId,
      )
      return
    }
    if (bBit1a_6 !== 0) {
      if (nNpcClassId !== 0x16f) {
        return
      }
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        pQuestData,
        3,
        m.u32((pNpcParams + 0x14) >>> 0),
        nNpcClassId,
      )
      return
    }
  }

  if (bBit0 === 1) {
    if (bExpansion === 0) {
      return
    }
    if (bBit1a_9 === 0) {
      if (nNpcClassId === 0x16f) {
        QUESTS_AddNpcDialogTextNodes113c(
          m,
          pQuestData,
          4,
          m.u32((pNpcParams + 0x14) >>> 0),
          nNpcClassId,
        )
      } else if (nNpcClassId === 0xf6) {
        QUESTS_AddNpcDialogTextNodes113c(
          m,
          pQuestData,
          5,
          m.u32((pNpcParams + 0x14) >>> 0),
          nNpcClassId,
        )
      }
    }
    if (bBit1a_8 === 0) {
      if (nNpcClassId === 0xf6) {
        QUESTS_AddNpcDialogTextNodes113c(
          m,
          pQuestData,
          4,
          m.u32((pNpcParams + 0x14) >>> 0),
          nNpcClassId,
        )
        return
      }
      if (nNpcClassId === 0x16f) {
        QUESTS_AddNpcDialogTextNodes113c(
          m,
          pQuestData,
          5,
          m.u32((pNpcParams + 0x14) >>> 0),
          nNpcClassId,
        )
        return
      }
    }
    return
  }

  const bState = m.u8((pQuestData + 0x0c) >>> 0)
  if (bState >= 4 && bBit13 === 0) {
    return
  }
  if (m.u8((pQuestData + 0x09) >>> 0) === 0 || bState === 0) {
    return
  }
  const nSlot = m.u32((ACT4Q3_STATE_DIALOG_SLOT_6FD26B24_VA + bState * 4) >>> 0) | 0
  if (nSlot !== -1 && (nSlot >>> 0) < 7) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData,
      nSlot,
      m.u32((pNpcParams + 0x14) >>> 0),
      nNpcClassId,
    )
  }
}

/**
 * Synchronizes quest `0x1A` (`26`) state bits (`2`, `3`, or `4`) on `pPlayer`
 * from quest node `0x17` (`23`) state (`+0x0C`) and sub-state (`+0x0B`).
 *
 * @va D2Game:0x6FCD9290
 */
export function ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCD9290)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) === 1) {
    return 0
  }

  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestChain === 0) {
    return 0
  }
  let pNode = m.u32(pQuestChain) >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) | 0) === 0x17) {
      const bState = m.u8((pNode + 0x0c) >>> 0)
      if (bState === 2) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1a, 2)
        return 0
      }
      if (bState === 3) {
        if (m.u8((pNode + 0x0b) >>> 0) === 1) {
          QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1a, 3)
        } else {
          QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1a, 4)
        }
      }
      return 0
    }
    pNode = m.u32((pNode + 0xf4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Updates Act 4 Quest 1 (`0x19`) state and sub-state bytes (`+0x0B`, `+0x0C`)
 * and custom data flag `+0x0C` from `pPlayer`'s quest `0x19` record bits (`2`, `3`, `4`).
 *
 * @va D2Game:0x6FCD9320
 */
export function ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pNpcParams: number,
): void {
  hitD2GameVa113c(0x6FCD9320)
  const pPlayerUnit = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pNpcParams >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  const nQuestId = m.u32((pQuestData + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0) !== 0) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0x0f) !== 0) {
    return
  }

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 4) === 1) {
    const pCustom = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    m.setU8((pCustom + 0x0c) >>> 0, 1)
    m.setU8((pQuestData + 0x0b) >>> 0, 2)
    m.setU8((pQuestData + 0x0c) >>> 0, 3)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 3) === 1) {
    m.setU8((pQuestData + 0x0c) >>> 0, 3)
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 2) === 1) {
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
  }
}

/**
 * Checks if `pPlayerUnit` is in the same or an adjacent room to Izual's spirit
 * (`pQuestNode22->pCustomData->pIzualUnit` at `+0x14`) and sets quest `0x19`
 * state bits `13` (`0x0D`) and `1`.
 *
 * @va D2Game:0x6FCD93B0
 */
export function ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCD93B0)
  const pPlayerRoom = UNITS_GetRoom113c(m, pPlayerUnit) >>> 0
  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuestNode = 0
  if (pQuestChain !== 0) {
    let pCur = m.u32(pQuestChain) >>> 0
    while (pCur !== 0) {
      if ((m.u32(pCur) | 0) === 0x16) {
        pQuestNode = pCur
        break
      }
      pCur = m.u32((pCur + 0xf4) >>> 0) >>> 0
    }
  }
  if (pQuestNode === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Quests\\a4q1.cpp', 0x1c4)
  }

  const pCustom = m.u32((pQuestNode + 0x18) >>> 0) >>> 0
  const pIzualUnit = m.u32((pCustom + 0x14) >>> 0) >>> 0
  const pIzualRoom = UNITS_GetRoom113c(m, pIzualUnit) >>> 0
  if (pPlayerRoom === 0) {
    return 0
  }

  let bNear = 0
  if (pPlayerRoom === pIzualRoom) {
    bNear = 1
  } else {
    const pRoomCheck = UNITS_GetRoom113c(m, pPlayerUnit) >>> 0
    if (pRoomCheck === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Game\\Quests\\a4q1.cpp', 0x1d9)
    }
    const savedSp = k2W4B8StackPtr
    k2W4B8StackPtr = (savedSp + 8) >>> 0
    try {
      const pCountOut = savedSp
      const ppListOut = (savedSp + 4) >>> 0
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoomCheck, ppListOut, pCountOut)
      const count = m.u32(pCountOut) >>> 0
      const pList = m.u32(ppListOut) >>> 0
      for (let i = 0; i < count; i = (i + 1) >>> 0) {
        if ((m.u32((pList + i * 4) >>> 0) >>> 0) === pIzualRoom) {
          bNear = 1
          break
        }
      }
    } finally {
      k2W4B8StackPtr = savedSp
    }
  }

  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 1) === 0 &&
    bNear !== 0
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x19, 0x0d)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x19, 1)
  }
  return 0
}


const ACT4Q1_STATE_DIALOG_SLOT_6FD265B0_VA = 0x6fd265b0
const ACT4Q1_STATE_DIALOG_SLOT_6FD265B0_VALS = [
  -1, 0, 1, 2, 3, 4, 367, 681, 1, 0, 0, 0, 0, 0, 0, 0,
] as const

function ensureAct4Q1DialogSlotTableSeeded113c(m: D2KernMemory113c): void {
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    m.setU32(
      (ACT4Q1_STATE_DIALOG_SLOT_6FD265B0_VA + i * 4) >>> 0,
      ACT4Q1_STATE_DIALOG_SLOT_6FD265B0_VALS[i]! >>> 0,
    )
  }
}

/**
 * Marks quest `0x19` (`25`) bits `13` (`0x0D`) and `1` and clears bits `2..11`
 * when `pPlayerUnit` is in Act 4 (`nAct == 3`) and bits `0` and `1` are unset.
 *
 * @va D2Game:0x6FCD94F0
 */
export function ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): void {
  hitD2GameVa113c(0x6FCD94F0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0) === 1) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 1) !== 0) {
    return
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayerUnit) >>> 0
  if (pRoom === 0) {
    return
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) {
    return
  }
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 3) {
    return
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x19, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x19, 1)
  QUESTRECORD_ClearQuestStateBits2To11_113c(m, pQuestFlags, 0x19)
}

/**
 * Populates Act 4 Quest 1 (Fallen Angel / Izual) NPC dialog text nodes for
 * Tyrael (`367`) and Izual spirit (`406` / `0x196`).
 *
 * @va D2Game:0x6FCD9560
 */
export function ACT4Q1_InitNpcDialog_6FCD9560_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pNpcParams: number,
): void {
  hitD2GameVa113c(0x6FCD9560)
  ensureAct4Q1DialogSlotTableSeeded113c(m)
  const pPlayerUnit = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pNpcParams >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  const nQuestId = m.u32((pQuestData + 0xe0) >>> 0) | 0
  const bBit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0) | 0
  const bBit13 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0x0d) | 0

  const pNpcUnit = m.u32((pNpcParams + 0x08) >>> 0) >>> 0
  let nNpcClassId = -1
  if (pNpcUnit !== 0) {
    nNpcClassId = m.u32((pNpcUnit + 0x04) >>> 0) | 0
    if (nNpcClassId === 0x196) {
      if (
        DRLGWARP_TestRoomTileBit113c(
          m,
          pQuestFlags,
          m.u32((pQuestData + 0xe0) >>> 0) | 0,
          5,
        ) === 0
      ) {
        QUESTS_AddNpcDialogTextNodes113c(
          m,
          pQuestData,
          3,
          m.u32((pNpcParams + 0x14) >>> 0),
          nNpcClassId,
        )
        return
      }
    }
  }

  if (
    DRLGWARP_TestRoomTileBit113c(
      m,
      pQuestFlags,
      m.u32((pQuestData + 0xe0) >>> 0) | 0,
      1,
    ) !== 0
  ) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData,
      3,
      m.u32((pNpcParams + 0x14) >>> 0),
      nNpcClassId,
    )
    return
  }

  const pPlayer2 = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const playerGuid = pPlayer2 === 0 ? -1 : m.u32((pPlayer2 + 0x0c) >>> 0) | 0
  const nGuidCount = m.u16((pQuestData + 0x9c) >>> 0)
  for (let i = 0; i < nGuidCount; i = (i + 1) | 0) {
    if ((m.u32((pQuestData + 0x1c + i * 4) >>> 0) | 0) === playerGuid) {
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        pQuestData,
        4,
        m.u32((pNpcParams + 0x14) >>> 0),
        nNpcClassId,
      )
      return
    }
  }

  if (bBit0 === 1) {
    return
  }
  const bState = m.u8((pQuestData + 0x0c) >>> 0)
  if (bState >= 4 && bBit13 === 0) {
    return
  }
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) {
    return
  }
  const nSlot = m.u32((ACT4Q1_STATE_DIALOG_SLOT_6FD265B0_VA + bState * 4) >>> 0) | 0
  if (nSlot !== -1 && (nSlot >>> 0) < 6) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      pQuestData,
      nSlot,
      m.u32((pNpcParams + 0x14) >>> 0),
      nNpcClassId,
    )
  }
}

/**
 * Synchronizes quest `0x19` (`25`) state bits (`2`, `3`, or `4`) on `pPlayer`
 * from quest node `0x16` (`22`) state (`+0x0C`) and custom data `+0x0C`.
 *
 * @va D2Game:0x6FCD96A0
 */
export function ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCD96A0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0) === 1) {
    return 0
  }

  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestChain === 0) {
    return 0
  }
  let pNode = m.u32(pQuestChain) >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) | 0) === 0x16) {
      const pCustom = m.u32((pNode + 0x18) >>> 0) >>> 0
      const bState = m.u8((pNode + 0x0c) >>> 0)
      if (bState === 2) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x19, 2)
        return 0
      }
      if (bState === 3) {
        if (m.u8((pCustom + 0x0c) >>> 0) !== 0) {
          QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x19, 4)
        } else {
          QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x19, 3)
        }
      }
      return 0
    }
    pNode = m.u32((pNode + 0xf4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Adds Tyrael (`367` / `0x16F`) intro dialog node (slot `0`) if quest `0x18` (`24`)
 * bit `0` is not yet set on `pPlayer`.
 *
 * @va D2Game:0x6FCD9730
 */
export function ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pNpcParams: number,
): void {
  hitD2GameVa113c(0x6FCD9730)
  const pNpcUnit = m.u32((pNpcParams + 0x08) >>> 0) >>> 0
  if (pNpcUnit === 0) {
    return
  }
  if ((m.u32((pNpcUnit + 0x04) >>> 0) | 0) !== 0x16f) {
    return
  }
  const pPlayerUnit = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pNpcParams >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x18, 0) !== 0) {
    return
  }

  const pNpcUnit2 = m.u32((pNpcParams + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpcUnit2 === 0 ? -1 : m.u32((pNpcUnit2 + 0x04) >>> 0) | 0
  QUESTS_AddNpcDialogTextNodes113c(
    m,
    pQuestData,
    0,
    m.u32((pNpcParams + 0x14) >>> 0),
    nNpcClassId,
  )
}

/**
 * Updates Act 4 Quest 2 (Hell's Forge) quest state from `pPlayer` inventory
 * (`'hfh '` hammer count, `'mss '` Soulstone presence) and quest `0x1B` bits (`2`, `3`, `5`).
 *
 * @va D2Game:0x6FCD9830
 */
export function ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pNpcParams: number,
): void {
  hitD2GameVa113c(0x6FCD9830)
  const pPlayerUnit = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pNpcParams >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  const pCustom = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  const pPlayer2 = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const pGame2 = m.u32(pNpcParams >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer2, pGame2, 0x20686668) !== 0) {
    m.setU32((pCustom + 0x10) >>> 0, (m.u32((pCustom + 0x10) >>> 0) + 1) >>> 0)
  }

  const nQuestId = m.u32((pQuestData + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0) !== 0) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0x0f) !== 0) {
    return
  }

  const pPlayer3 = m.u32((pNpcParams + 0x0c) >>> 0) >>> 0
  const pGame3 = m.u32(pNpcParams >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer3, pGame3, 0x2073736d) === 0) {
    m.setU8((pQuestData + 0x0c) >>> 0, 1)
    return
  }

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 5) === 1) {
    const pCustom2 = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    m.setU8((pCustom2 + 0x1c) >>> 0, 1)
    m.setU8((pQuestData + 0x0b) >>> 0, 4)
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 3) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
    m.setU8((pQuestData + 0x0c) >>> 0, 3)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 2) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
  }
}


/**
 * Sends quest alert packet `0x5D` (`questId = 0x18`) to `pPlayerUnit` if quest
 * `0x1B` (`27`) is either incomplete (`bit 0 == 0 && bit 15 == 0`) or recently
 * completed (`bit 13 != 0 || bit 14 != 0`).
 *
 * @va D2Game:0x6FCD9970
 */
export function ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCD9970)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0x0f) === 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x18, pPlayerUnit, pGame)
    return 0
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x18, pPlayerUnit, pGame)
  }
  return 0
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x17`) to `pPlayerUnit` if quest
 * `0x1A` (`26`) is either incomplete (`bit 0 == 0 && bit 15 == 0`) or recently
 * completed (`bit 13 != 0 || bit 14 != 0`).
 *
 * @va D2Game:0x6FCD99D0
 */
export function ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCD99D0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0x0f) === 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x17, pPlayerUnit, pGame)
    return 0
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x17, pPlayerUnit, pGame)
  }
  return 0
}

/**
 * Completes Act 4 Quest 3 (`0x1A` / Diablo) on `pQuestFlags`, promotes the
 * player's Classic progression title on `pClient+0x0A` when `bExpansion == 0`,
 * and increments quest `0x17` custom counter `+0x1C`.
 *
 * @va D2Game:0x6FCD9A30
 */
export function ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c(
  m: D2KernMemory113c,
  pQuestFlags: number,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCD9A30)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1a, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1a, 0)
  QUESTRECORD_ClearQuestStateBits2To11_113c(m, pQuestFlags, 0x1a)

  if (m.u32((pGame + 0x70) >>> 0) === 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1a, 6)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1a, 7)

    let pClient = 0
    if ((pPlayerUnit >>> 0) !== 0 && m.u32(pPlayerUnit) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
      pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
    }

    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    const wFlags = m.u16((pClient + 0x0a) >>> 0)
    const step = (((wFlags & 0x20) | 0x80) >>> 5) | 0
    const newRank = (Math.imul(step, nDiff) + 4) | 0
    const curRank = (wFlags >>> 8) & 0x1f
    if (newRank >= curRank) {
      const wFlags2 = m.u16((pClient + 0x0a) >>> 0)
      const updated = (((Math.imul(nDiff, step) + 4) << 8) | (wFlags2 & 0xe0ff)) & 0xffff
      m.setU16((pClient + 0x0a) >>> 0, updated)
    }
  }

  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestChain === 0) {
    return
  }
  let pNode = m.u32(pQuestChain) >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) | 0) === 0x17) {
      const pCustom = m.u32((pNode + 0x18) >>> 0) >>> 0
      m.setU32((pCustom + 0x1c) >>> 0, (m.u32((pCustom + 0x1c) >>> 0) + 1) >>> 0)
      return
    }
    pNode = m.u32((pNode + 0xf4) >>> 0) >>> 0
  }
}

/**
 * Sends packet `0x5D` (`[0x5D, 0x17, 0x02, 0, 0, 0]`) and triggers speech/sound
 * `0x4B` on `pPlayerUnit` if quest `0x1A` bit `13` (`0x0D`) is set.
 *
 * @va D2Game:0x6FCD9B00
 */
export function ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCD9B00)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0x0d) === 0) {
    return 0
  }

  let pClient = 0
  if ((pPlayerUnit >>> 0) !== 0 && m.u32(pPlayerUnit) === 0) {
    const pData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
    pClient = m.u32((pData + 0x9c) >>> 0) >>> 0
  }

  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 8) >>> 0
  try {
    m.setU32(savedSp, 0)
    m.setU8(savedSp, 0x5d)
    m.setU8((savedSp + 1) >>> 0, 0x17)
    m.setU8((savedSp + 2) >>> 0, 0x02)
    m.setU16((savedSp + 4) >>> 0, 0)
    NET_QueuePacketToClientBuffer113c(m, pClient, 0, savedSp, 6)
  } finally {
    k2W4B8StackPtr = savedSp
  }

  if ((pPlayerUnit >>> 0) === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Quests\\a4q1.cpp', 0x558)
  }

  m.setU16((pPlayerUnit + 0x6e) >>> 0, 0x4b)
  m.setU32((pPlayerUnit + 0x70) >>> 0, pPlayerUnit >>> 0)
  UNITROOM_RefreshUnit113c(m, pPlayerUnit)
  m.setU32((pPlayerUnit + 0xc4) >>> 0, (m.u32((pPlayerUnit + 0xc4) >>> 0) | 0x400) >>> 0)
  return 0
}

/**
 * Checks whether any living player is in or adjacent to `pTargetRoom` for
 * Act 4 Quest 1 (`0x16`), returning `1` when no player matched (`bFound == 0`).
 *
 * @va D2Game:0x6FCD9C00
 */
export function ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pTargetRoom: number,
): number {
  hitD2GameVa113c(0x6FCD9C00)
  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestChain === 0) {
    return 0
  }
  let pNode = m.u32(pQuestChain) >>> 0
  while (pNode !== 0) {
    if ((m.u32(pNode) | 0) === 0x16) {
      const pCustom = m.u32((pNode + 0x18) >>> 0) >>> 0
      if (m.u8((pCustom + 0x12) >>> 0) === 0) {
        return 0
      }
      m.setU8((pCustom + 0x18) >>> 0, 0)
      m.setU32((pCustom + 0x14) >>> 0, pTargetRoom >>> 0)
      D2GAME_SUNIT_IterateAllLivingPlayers113c(
        m,
        pGame,
        ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c,
        pCustom,
      )
      return m.u8((pCustom + 0x18) >>> 0) === 0 ? 1 : 0
    }
    pNode = m.u32((pNode + 0xf4) >>> 0) >>> 0
  }
  return 0
}


const HELLFORGE_DROP_TABLES_6FD26F0C_VA = 0x6fd26f0c
const HELLFORGE_DROP_TABLES_6FD26F0C_VALS = [
  // 0x6fd26f0c..0x6fd26f60: 'r01 '..'r22 ' (22 dwords; 0x6fd26f38 is offset +11 = 'r12 ')
  0x20313072, 0x20323072, 0x20333072, 0x20343072, 0x20353072, 0x20363072,
  0x20373072, 0x20383072, 0x20393072, 0x20303172, 0x20313172, 0x20323172,
  0x20333172, 0x20343172, 0x20353172, 0x20363172, 0x20373172, 0x20383172,
  0x20393172, 0x20303272, 0x20313272, 0x20323272,
  // 0x6fd26f64..0x6fd26f8c: 'r15 '..'r25 ' (11 dwords)
  0x20353172, 0x20363172, 0x20373172, 0x20383172, 0x20393172, 0x20303272,
  0x20313272, 0x20323272, 0x20333272, 0x20343272, 0x20353272,
  // 0x6fd26f90..0x6fd26fa8: 'gpv ', 'gpr ', 'gpb ', 'gpy ', 'gpg ', 'gpw ', 'skz ' (7 dwords)
  0x20767067, 0x20727067, 0x20627067, 0x20797067, 0x20677067, 0x20777067,
  0x207a6b73,
  // 0x6fd26fac..0x6fd26fc4: 'gzv ', 'glr ', 'glb ', 'gly ', 'glg ', 'glw ', 'skl ' (7 dwords)
  0x20767a67, 0x20726c67, 0x20626c67, 0x20796c67, 0x20676c67, 0x20776c67,
  0x206c6b73,
  // 0x6fd26fc8..0x6fd26fe0: 'gsv ', 'gsr ', 'gsb ', 'gsy ', 'gsg ', 'gsw ', 'sku ' (7 dwords)
  0x20767367, 0x20727367, 0x20627367, 0x20797367, 0x20677367, 0x20777367,
  0x20756b73,
] as const

function ensureHellforgeDropTablesSeeded113c(m: D2KernMemory113c): void {
  for (let i = 0; i < HELLFORGE_DROP_TABLES_6FD26F0C_VALS.length; i = (i + 1) | 0) {
    m.setU32(
      (HELLFORGE_DROP_TABLES_6FD26F0C_VA + i * 4) >>> 0,
      HELLFORGE_DROP_TABLES_6FD26F0C_VALS[i]! >>> 0,
    )
  }
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x16`) to `pPlayerUnit` if quest
 * `0x19` (`25`) is either incomplete (`bit 0 == 0 && bit 15 == 0`) or recently
 * completed (`bit 13 != 0 || bit 14 != 0`).
 *
 * @va D2Game:0x6FCD9D20
 */
export function ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCD9D20)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0x0f) === 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x16, pPlayerUnit, pGame)
    return 0
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x16, pPlayerUnit, pGame)
  }
  return 0
}

/**
 * Drops a Unique (`quality = 7`) Hellforge Hammer (`'hfh '` / `0x20686668`)
 * at `pNpcParams->pUnit` (`+0x08`) when quest `pQuestData` is active (`+0x09 != 0`)
 * and increments `pCustomData->dwHammerDropCount` (`+0x10`).
 *
 * @va D2Game:0x6FCDA810
 */
export function ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pNpcParams: number,
  hooks?: K2W4B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FCDA810)
  const pCustom = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) {
    return
  }
  const pUnit = m.u32((pNpcParams + 0x08) >>> 0) >>> 0
  m.setU32((pUnit + 0xb8) >>> 0, 0x20686668)
  const pUnit2 = m.u32((pNpcParams + 0x08) >>> 0) >>> 0
  const pGame = m.u32(pNpcParams >>> 0) >>> 0

  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 4) >>> 0
  try {
    const pItem =
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        pGame,
        pUnit2,
        7,
        savedSp,
        0,
        -1,
        0,
        hooks,
      ) >>> 0
    if (pItem !== 0) {
      m.setU32((pCustom + 0x10) >>> 0, (m.u32((pCustom + 0x10) >>> 0) + 1) >>> 0)
    }
  } finally {
    k2W4B8StackPtr = savedSp
  }
}

/**
 * Attempts to spawn Diablo (`classId = 243` / `0xF3`, `mode = 1`) at `(x, y)`
 * in `pRoom` with search radii `-1`, `5`, and `10`, setting unit flag `0x03000000`
 * and `pQuestCustomData+0x11 = 1` on success.
 *
 * @va D2Game:0x6FCDA850
 */
export function ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c(
  m: D2KernMemory113c,
  pRoom: number,
  y: number,
  pGame: number,
  x: number,
  pQuestCustomData: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  hitD2GameVa113c(0x6FCDA850)
  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 0x28) >>> 0
  try {
    const pDesc = savedSp
    const radii = [-1, 5, 10] as const
    for (let i = 0; i < 3; i = (i + 1) | 0) {
      m.setU32(pDesc, pGame >>> 0)
      m.setU32((pDesc + 0x04) >>> 0, pRoom >>> 0)
      m.setU32((pDesc + 0x08) >>> 0, 0)
      m.setU32((pDesc + 0x0c) >>> 0, 0xf3)
      m.setU32((pDesc + 0x10) >>> 0, 1)
      m.setU32((pDesc + 0x14) >>> 0, 0)
      m.setU32((pDesc + 0x18) >>> 0, x >>> 0)
      m.setU32((pDesc + 0x1c) >>> 0, y >>> 0)
      m.setU32((pDesc + 0x20) >>> 0, radii[i]! >>> 0)
      m.setU16((pDesc + 0x24) >>> 0, 0)
      const pDiablo = MONSTER_Create113c(m, pDesc, hooks) >>> 0
      if (pDiablo !== 0) {
        m.setU32((pDiablo + 0xc4) >>> 0, (m.u32((pDiablo + 0xc4) >>> 0) | 0x03000000) >>> 0)
        m.setU8((pQuestCustomData + 0x11) >>> 0, 1)
        return pDiablo
      }
    }
    return 0
  } finally {
    k2W4B8StackPtr = savedSp
  }
}

/**
 * Allocates and places the Last Portal object (`classId = 0x236` / `566`) near
 * `pNpcParams->pUnit` (`+0x08`, `x + 5`) and marks `pQuestCustomData` (`+0x44 = 0`, `+0x45 = 1`).
 *
 * @va D2Game:0x6FCDAFF0
 */
export function ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c(
  m: D2KernMemory113c,
  pNpcParams: number,
  pQuestCustomData: number,
): number {
  hitD2GameVa113c(0x6FCDAFF0)
  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 0x18) >>> 0
  try {
    const ppRoomOut = savedSp
    const pSaveX = (savedSp + 0x04) >>> 0
    const pSaveY = (savedSp + 0x08) >>> 0
    const pCoordX = (savedSp + 0x0c) >>> 0
    const pCoordY = (savedSp + 0x10) >>> 0

    const pRefUnit = m.u32((pNpcParams + 0x08) >>> 0) >>> 0
    PATH_GetTargetTypeAndPosition113c(m, pRefUnit, pCoordX)
    const adjX = (m.u32(pCoordX) + 5) | 0
    m.setU32(pCoordX, adjX >>> 0)

    const pRoom0 = UNITS_GetRoom113c(m, m.u32((pNpcParams + 0x08) >>> 0)) >>> 0
    m.setU32(ppRoomOut, pRoom0)
    const pRoom1 = UNITS_GetRoom113c(m, m.u32((pNpcParams + 0x08) >>> 0)) >>> 0
    QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
      m,
      pRoom1,
      pCoordX,
      2,
      0x400,
      ppRoomOut,
      100,
    )

    const pSpawnRoom = m.u32(ppRoomOut) >>> 0
    if (pSpawnRoom === 0) {
      return 0
    }

    const pGame = m.u32(pNpcParams >>> 0) >>> 0
    m.u32((pGame + 0x1c) >>> 0)
    m.setU32(pSaveY, m.u32(pCoordY))
    m.setU32(pSaveX, m.u32(pCoordX))

    const pObjUnit = UNIT_Alloc113c(m, 2) >>> 0
    if (pObjUnit === 0) {
      return 0
    }

    m.setU32(pObjUnit, 2)
    m.setU32((pObjUnit + 0x04) >>> 0, 0x236)
    m.setU32((pObjUnit + 0x08) >>> 0, m.u32((pGame + 0x1c) >>> 0))
    m.setU32((pObjUnit + 0x80) >>> 0, pGame)

    let flagsC8 = m.u32((pObjUnit + 0xc8) >>> 0) >>> 0
    if (m.u32((pGame + 0x70) >>> 0) !== 0) {
      flagsC8 = (flagsC8 | 0x02000000) >>> 0
    } else {
      flagsC8 = (flagsC8 & 0xfdffffff) >>> 0
    }
    m.setU32((pObjUnit + 0xc8) >>> 0, (flagsC8 | 0x04000000) >>> 0)

    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pSpawnRoom) | 0
    const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
    m.setU8((pObjUnit + 0x18) >>> 0, nAct)
    m.setU32((pObjUnit + 0x1c) >>> 0, m.u32((pGame + nAct * 4 + 0xbc) >>> 0))
    m.setU32((pObjUnit + 0x74) >>> 0, 0)
    SUNIT_InitUnitSeed113c(m, pObjUnit, (pGame + 0xd0) >>> 0)
    m.setU32((pObjUnit + 0xc4) >>> 0, (m.u32((pObjUnit + 0xc4) >>> 0) | 0x10) >>> 0)
    m.setU32((pObjUnit + 0xd0) >>> 0, 0x0b)

    let nextGuid = (m.u32((pGame + 0x98) >>> 0) + 1) >>> 0
    if ((nextGuid | 0) === -1) {
      nextGuid = 1
    }
    m.setU32((pGame + 0x98) >>> 0, nextGuid)

    m.u32((pGame + 0x1c) >>> 0)
    const pObjectData = m.alloc(0x38) >>> 0
    m.setU32((pObjUnit + 0x14) >>> 0, pObjectData)
    for (let i = 0; i < 14; i = (i + 1) | 0) {
      m.setU32((pObjectData + i * 4) >>> 0, 0)
    }

    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, 0x236) >>> 0
    m.setU32(m.u32((pObjUnit + 0x14) >>> 0), pObjTxt)
    m.setU32((pObjUnit + 0x10) >>> 0, 1)
    UNITS_AllocStaticPath113c(m, pObjUnit)
    OBJECTS_InitObjectUnit113c(
      m,
      pObjUnit,
      pGame,
      nextGuid,
      pSpawnRoom,
      m.u32(pSaveX) | 0,
      m.u32(pSaveY) | 0,
    )
    SUNIT_PlaceServerUnitInRoom113c(
      m,
      pSpawnRoom,
      m.u32(pSaveY) | 0,
      pObjUnit,
      m.u32(pSaveX) | 0,
      pGame,
      1,
    )
    m.setU8((pQuestCustomData + 0x44) >>> 0, 0)
    m.setU8((pQuestCustomData + 0x45) >>> 0, 1)
    m.setU32((pObjUnit + 0xc4) >>> 0, (m.u32((pObjUnit + 0xc4) >>> 0) | 0x03000000) >>> 0)
    return pObjUnit
  } finally {
    k2W4B8StackPtr = savedSp
  }
}

/**
 * Executes a Hellforge (`0x6FCDB6A0`) smash reward wave on `pForgeUnit`:
 * drops normal/flawless/perfect gems per player count (`+0x14`), decrements
 * wave counter (`+0x08`), and either schedules wave event `7` (+20 frames) or
 * drops a difficulty-tiered rune (`r01..r11`, `r12..r22`, `r15..r25`) in Expansion.
 *
 * @va D2Game:0x6FCDB6A0
 */
export function ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c(
  m: D2KernMemory113c,
  pForgeUnit: number,
  pQuestData: number,
  hooks?: K2W4B3Hooks113c,
  eventHooks?: EventWheelHooks113c,
): void {
  hitD2GameVa113c(0x6FCDB6A0)
  ensureHellforgeDropTablesSeeded113c(m)
  const pCustom = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pCustom + 0x04) >>> 0) !== 0) {
    UNITS_ChangeAnimMode113c(m, pForgeUnit, 4)
  }
  if (m.u8((pCustom + 0x03) >>> 0) === 0) {
    return
  }
  const nPlayerCount = m.u32((pCustom + 0x14) >>> 0) | 0
  if (nPlayerCount <= 0) {
    return
  }

  const savedSp = k2W4B8StackPtr
  k2W4B8StackPtr = (savedSp + 8) >>> 0
  try {
    const pQualityOut = savedSp
    m.setU32(pQualityOut, 0x32)
    let droppedCount = 0

    for (let i = 0; i < (m.u32((pCustom + 0x14) >>> 0) | 0); i = (i + 1) | 0) {
      const nWaveIdx = ((m.u32((pCustom + 0x08) >>> 0) | 0) - 1) | 0
      if ((nWaveIdx >>> 0) > 3) {
        return
      }
      const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
      const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
      if (pQuestChain === 0) {
        throw new D2CommonAssertError('..\\Source\\D2Game\\Quests\\a4q1.cpp', 0x1fb)
      }

      const seed = {
        lo: m.u32((pQuestChain + 0x18) >>> 0) >>> 0,
        hi: m.u32((pQuestChain + 0x1c) >>> 0) >>> 0,
      }
      const gemIdx = seedRoll(seed, 7) >>> 0
      m.setU32((pQuestChain + 0x18) >>> 0, seed.lo >>> 0)
      m.setU32((pQuestChain + 0x1c) >>> 0, seed.hi >>> 0)

      let tableBase = 0x6fd26fac
      if (nWaveIdx === 0) {
        tableBase = 0x6fd26fc8
      } else if (nWaveIdx === 3) {
        tableBase = 0x6fd26f90
      }
      const dwGemCode = m.u32((tableBase + gemIdx * 4) >>> 0) >>> 0
      m.setU32((pForgeUnit + 0xb8) >>> 0, dwGemCode)

      const pDropped =
        ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
          m,
          m.u32((pQuestData + 0x04) >>> 0),
          pForgeUnit,
          2,
          pQualityOut,
          0,
          -1,
          0,
          hooks,
        ) >>> 0
      if (pDropped !== 0) {
        droppedCount = (droppedCount + 1) | 0
      }
    }

    if (droppedCount === 0) {
      return
    }

    const nextWave = ((m.u32((pCustom + 0x08) >>> 0) | 0) - 1) | 0
    m.setU32((pCustom + 0x08) >>> 0, nextWave >>> 0)
    if (nextWave > 0) {
      const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
      const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x14) >>> 0
      EVENT_SetEventFull113c(m, pGame, pForgeUnit, 7, targetFrame, 0, 0, 0, eventHooks)
      return
    }

    m.setU8((pCustom + 0x03) >>> 0, 0)
    const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
    if (m.u32((pGame + 0x70) >>> 0) === 0) {
      return
    }

    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    let runeTableBase = 0x6fd26f0c
    if (nDiff === 1) {
      runeTableBase = 0x6fd26f38
    } else if (nDiff === 2) {
      runeTableBase = 0x6fd26f64
    }

    const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (pQuestChain === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Game\\Quests\\a4q1.cpp', 0x1fb)
    }
    const seed = {
      lo: m.u32((pQuestChain + 0x18) >>> 0) >>> 0,
      hi: m.u32((pQuestChain + 0x1c) >>> 0) >>> 0,
    }
    const runeIdx = seedRoll(seed, 11) >>> 0
    m.setU32((pQuestChain + 0x18) >>> 0, seed.lo >>> 0)
    m.setU32((pQuestChain + 0x1c) >>> 0, seed.hi >>> 0)

    const dwRuneCode = m.u32((runeTableBase + runeIdx * 4) >>> 0) >>> 0
    m.setU32((pForgeUnit + 0xb8) >>> 0, dwRuneCode)
    ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      pForgeUnit,
      2,
      pQualityOut,
      0,
      -1,
      0,
      hooks,
    )
  } finally {
    k2W4B8StackPtr = savedSp
  }
}
