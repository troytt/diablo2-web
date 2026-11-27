/**
 * Milestone 33 [K2] Wave 3 Batch 2 (`w3b2`): 45 strictly ready `D2Game.dll` v1.13c functions
 * in the VA range `0x6FC3BCA0..0x6FC525C0`.
 *
 * Clean-room 1:1 binary-isomorphic translations from `D2Game.dll` v1.13c.
 */

import {
  COLLISION_CheckMaskWithPattern2_113c,
  COLLISION_CheckMaskWithSizeXY113c,
  COLLISION_FindFreePositionSimple113c,
  COLLISION_GetMaskWithPattern2_113c,
} from '../common/collision.js'
import { UNITS_SetObjectShrineTxt113c } from '../common/composit.js'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.js'
import { DRLG_ResolveMonsterSubClassIdForRoom113c } from '../common/drlg/drlg-ver.js'
import { DRLGPRESET_MovePointerAndClear113c } from '../common/drlg/preset.js'
import { DUNGEON_GetLevelIdFromRoom113c, DUNGEON_GetRoomCoordinates113c } from '../common/dungeon.js'
import { D2CommonAssertError } from '../common/inline-helpers.js'
import { imul32, sdiv32 } from '../common/int-math.js'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_PlaceItemInSocket113c,
  INVENTORY_RemoveItemFromInventory113c,
  INVENTORY_UnitIsItem113c,
  ITEMS_DecodeItemCompactBitstreamV96_113c,
  ITEMS_GetCellOverwrite113c,
} from '../common/inventory.js'
import {
  ITEMS_CalcWeaponAttackSpeed113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_SerializeItemToBuffer113c,
} from '../common/items.js'
import {
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.js'
import {
  PATH_Compute113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetCollisionMask113c,
  PATH_SetMoveTestCollisionMask113c,
  PATH_SetStepNum113c,
  PATH_SetTargetPos113c,
  PATH_SetType113c,
  PATH_SetVelocity113c,
  UNITS_GetDirectionToCoords113c,
} from '../common/path.js'
import {
  SKILLS_CheckLineOfSight113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetParam1113c,
  SKILLS_GetParam2113c,
  SKILLS_GetParam3113c,
  SKILLS_GetParam4113c,
  SKILLS_GetSkillById113c,
  SKILLS_IsSelectableCorpse10678_113c,
  SKILLS_IsSelectableCorpseWithFlag12_113c,
  SKILLS_IsSelectableCorpseWithVelocity113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../common/skills.js'
import {
  STATES_CheckState113c,
  STATES_CheckStateMask33OnUnit113c,
  STATES_ClearGfxStateFlag113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.js'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNIT_Alloc113c,
  UNIT_GetAlignment113c,
  UNITROOM_RefreshUnit113c,
  UNITS_AllocStaticPath113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetEquippedWeaponAdder113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
} from '../common/unit.js'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.js'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.js'
import {
  DATATBLS_GetLevelMonsterLevel113c,
  DATATBLS_GetMonLvlTxtRecord113c,
  DATATBLS_GetObjGroupTxtRecord113c,
  DATATBLS_NormalizeDirection113c,
} from '../tables/datatbls-113c.js'
import { DATATBLS_CalcMissileSubLoopFrames113c } from '../tables/missile-tbls-113c.js'
import { DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c } from '../tables/monster-tbls-113c.js'
import {
  SKILLS_StartUsedSkill113c,
  SUNIT_AreUnitsHostileOrUnaligned113c,
} from './a1c-post150-f786-f1040-113c.js'
import {
  AIGENERAL_LinkMinionToLeader113c,
  AI_CastSkillWithMode113c,
  type AiFallenHooks113c,
  MONSTER_CheckTypeFlagsMask113c,
  SKILLS_CanMonsterCastAtTarget113c,
} from './ai-fallen-113c.js'
import { CLIENTS_ForEachInGameClient113c } from './boot-init-gap-a-113c.js'
import { AI_Stall113c, MONSTER_StartMode113c } from './combat-a1c-113c.js'
import {
  AIGENERAL_CopyAiCommandParams113c,
  type FallenSliceWorld113c,
  PLAYER_GetEquippedWeapon113c,
} from './replay-kernel-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.js'
import {
  AURA_ForEachUnitInRadius113c,
  ITEMS_ActivateEquippedItemStats113c,
  STATES_CreateOrUpdateAuraStatList113c,
} from './k2-gap-itemdef-113c.js'
import {
  type K2GapMeleeDotHooks113c,
  MISSILE_CreateServerProjectile113c,
  MISSILE_SpawnNova64Directions113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
  STATES_OnTimedStateRemoved113c,
} from './k2-gap-melee-dot-113c.js'
import {
  D2GAME_MONUMOD_TABLE_VA_113C,
  MONUMOD_CopyMinionEligibleUMods113c,
  MONUMOD_GetConstantValue113c,
  MONUMOD_GetMinionClassIdForBoss113c,
  MONUMOD_RollBossOrMinionNameSeed113c,
} from './k2-items-tc-w1-113c.js'
import {
  CHARSTATS_GetRecordPtrFast_6FC210A0_113c,
  MONSTER_TestUnitMonTypeFlag_6FC22790_113c,
  SKILLS_GetParam3Fast_6FC21BF0_113c,
  SKILLS_GetParam4Fast_6FC21C20_113c,
  STORM_TSHashTableLookup_6FC22130_113c,
} from './k2-laneH-0x6fc2-w1-113c.js'
import {
  ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c,
  ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c,
  MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c,
  MONUMOD_ApplyExtraFastVelocity_6FC42880_113c,
  MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c,
} from './k2-laneI-0x6fc3-w1-113c.js'
import {
  CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c,
  MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c,
  OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c,
  OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c,
  PLRMODE_IsDualWieldingClaws_6FC46A30_113c,
} from './k2-laneJ-0x6fc4-w1-113c.js'
import { MISSILES_InitChargedBoltPath_6FC61F50_113c } from './k2-laneK-0x6fc5-w1-113c.js'
import { SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c } from './k2-laneL-0x6fc6-w1-113c.js'
import { MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c } from './k2-w2b3-113c.js'
import { SKILLS_TargetRingScanCallback_6FCBED70_113c } from './k2-w2b5-113c.js'
import { MONSTER_SpawnAtCoords_6FD0F450_113c } from './k2-w2b8-113c.js'
import {
  MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c,
  MONUMOD_ApplyChampionFanaticStats_6FC43810_113c,
  MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c,
  MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c,
  MONUMOD_ApplyColdEnchantedStats_6FC42320_113c,
  MONUMOD_ApplyFireEnchantedStats_6FC42740_113c,
  MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c,
  MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c,
} from './k2-w4b1-113c.js'
import {
  MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c,
  MONSTER_AssignTeleportSkill_6FC441B0_113c,
} from './k2-w10b1-113c.js'
import { UNITS_ChangeAnimMode113c } from './monster-events.js'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c.js'
import { seedRoll } from '../prng.js'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_CheckModeBit113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_CheckFlagBit113c,
  MONSTATS_GetRecordPtr113c,
  MONSTATS_ValidateClassId113c,
  MONSTER_Create113c,
  MONSTER_GetBaseIdFromUnit113c,
  MONSTER_SpawnAtCoords113c,
  MONSTER_SpawnPackMember113c,
  MONSTER_SpawnPartyMinionInRing113c,
  REGPOP_FindPackSpawnCoords113c,
  type RegpopSpawnHooks113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SEED_RollRangeHalfOpen113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.js'
import { SUNIT_FreeUnit113c } from './replay-final11-113c.js'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel.js'
import { hitD2GameVa113c } from '../va-trace-113c.js'

export type D2KernMemory113c = Memory113c

/** Optional callback hooks for indirect function table entries in Wave 3 Batch 2. */
export interface K2W3B2Hooks113c {
  readonly aiFallen?: AiFallenHooks113c
  readonly regpop?: RegpopSpawnHooks113c
  readonly meleeDot?: K2GapMeleeDotHooks113c
  readonly onMonUMod?: (
    m: Memory113c,
    pfn: number,
    pMonster: number,
    nUModId: number,
    bBoss: number,
  ) => void
  readonly onPresetObjectHandler?: (
    m: Memory113c,
    pfn: number,
    pGame: number,
    pRoom: number,
    nObjectId: number,
    x: number,
    y: number,
    nInitMode: number,
  ) => number
  readonly onObjectPosValidate?: (
    m: Memory113c,
    pGame: number,
    pCtx: number,
    x: number,
    y: number,
  ) => number
}

/** Isolated reentrant scratch stack pointer for Wave 3 Batch 2 helpers on `Memory113c`. */
let w3b2ScratchSp = 0x7e060000

function sx8(v: number): number {
  return (v << 24) >> 24
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function stepSeed64InMem113c(m: Memory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, newHi)
  m.setU32(pSeed >>> 0, newLo)
  return newLo
}

function rollLimitedSeed64InMem113c(m: Memory113c, pSeed: number, nMax: number): number {
  const limit = nMax | 0
  if (limit <= 0) return 0
  const lo = stepSeed64InMem113c(m, pSeed)
  const mask = (limit - 1) | 0
  if ((limit & mask) === 0) {
    return (lo & mask) >>> 0
  }
  return ((lo >>> 0) % (limit >>> 0)) | 0
}

function seedRollMem113c(m: Memory113c, pSeed: number, nMax: number): number {
  const seed = {
    lo: m.u32(pSeed >>> 0) >>> 0,
    hi: m.u32((pSeed + 4) >>> 0) >>> 0,
  }
  const r = seedRoll(seed, nMax | 0) | 0
  m.setU32(pSeed >>> 0, seed.lo >>> 0)
  m.setU32((pSeed + 4) >>> 0, seed.hi >>> 0)
  return r
}

function withChargedBoltInitHook113c(hooks?: K2W3B2Hooks113c): K2GapMeleeDotHooks113c {
  const base = hooks !== undefined ? hooks.meleeDot : undefined
  const userCb = base !== undefined ? base.missileInitCallback : undefined
  const initCb = (mem: Memory113c, fnVa: number, pMis: number, dwParam: number): void => {
    if ((fnVa >>> 0) === 0x6fc61f50) {
      MISSILES_InitChargedBoltPath_6FC61F50_113c(mem, pMis, dwParam)
    }
    if (userCb !== undefined) {
      userCb(mem, fnVa, pMis, dwParam)
    }
  }
  if (base === undefined) {
    return { missileInitCallback: initCb }
  }
  return { ...base, missileInitCallback: initCb }
}

function mod8Signed113c(v: number): number {
  let r = (v | 0) & -0x7ffffff9
  if (r < 0) {
    r = (((r - 1) | -8) + 1) | 0
  }
  return r
}

function getUnitPosXInline113c(m: Memory113c, pUnit: number): number {
  const uType = m.u32(pUnit >>> 0) | 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return m.u32((pPath + 0x0c) >>> 0) | 0
  }
  if (pPath !== 0) {
    return PATH_GetPosX113c(m, pPath) | 0
  }
  return 0
}

function getUnitPosYInline113c(m: Memory113c, pUnit: number): number {
  const uType = m.u32(pUnit >>> 0) | 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return m.u32((pPath + 0x10) >>> 0) | 0
  }
  if (pPath !== 0) {
    return PATH_GetPosY113c(m, pPath) | 0
  }
  return 0
}

/**
 * `.rdata` `0x6FD1CEF8..0x6FD1CF37`: 8 octant `(dx, dy)` step vectors.
 */
const DIR_OFFSET_TABLE_6FD1CEF8: readonly (readonly [number, number])[] = [
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
]

/**
 * `.rdata` `0x6FD1CF38..0x6FD1D037`: `8x8` octant turn-step matrix (`row = targetDir`, `col = curDir`).
 */
const DIR_TURN_MATRIX_6FD1CF38: readonly number[] = [
  0, 0, 1, 2, 5, 6, 7, 0,
  1, 1, 1, 2, 3, 6, 7, 0,
  1, 2, 2, 2, 3, 4, 7, 0,
  1, 2, 3, 3, 3, 4, 5, 6,
  1, 2, 3, 4, 4, 4, 5, 6,
  7, 2, 3, 4, 5, 5, 5, 6,
  7, 0, 3, 4, 5, 6, 6, 6,
  7, 0, 1, 4, 5, 6, 7, 7,
]

/**
 * `.rdata` `0x6FD1CE3C` / `0x6FD1CE5C` (`dx[4]`) and `0x6FD1CE4C` / `0x6FD1CE6C` (`dy[4]`).
 */
const BOLT_DIR_DX_6FD1CE3C: readonly number[] = [-1, 0, 1, 0]
const BOLT_DIR_DY_6FD1CE4C: readonly number[] = [0, 1, 0, -1]

/**
 * `.data` `0x6FD2E550`: default `monUModTable[0..42]` function pointers.
 */
const DEFAULT_MONUMOD_TABLE_6FD2E550: readonly number[] = [
  0, 0x6fc43020, 0x6fc42fa0, 0, 0x6fc41e80, 0x6fc42bc0, 0x6fc42880, 0,
  0x6fc41be0, 0x6fc42740, 0, 0, 0, 0, 0, 0,
  0x6fc42da0, 0x6fc42600, 0x6fc42490, 0, 0, 0, 0, 0x6fc42320,
  0, 0x6fc421d0, 0x6fc441b0, 0x6fc41be0, 0x6fc41be0, 0, 0x6fc44cd0, 0,
  0, 0, 0, 0, 0x6fc43850, 0x6fc43810, 0x6fc437c0, 0x6fc42d00,
  0, 0x6fc469f0, 0,
]

/**
 * `.data` `0x6FD2E3E8..0x6FD2E49B`: `5 acts * 3 difficulties * 3 item codes` (`hp`, `mp`, `rv`).
 */
const POTION_CODE_TABLE_6FD2E3E8: readonly (readonly [number, number, number])[] = [
  [0x20327068, 0x2032706d, 0x20737672],
  [0x20337068, 0x2033706d, 0x20737672],
  [0x20337068, 0x2033706d, 0x20737672],
  [0x20347068, 0x2034706d, 0x206c7672],
  [0x20347068, 0x2034706d, 0x206c7672],
  [0x20347068, 0x2034706d, 0x206c7672],
  [0x20347068, 0x2035706d, 0x206c7672],
  [0x20357068, 0x2035706d, 0x206c7672],
  [0x20357068, 0x2035706d, 0x206c7672],
  [0x20357068, 0x2035706d, 0x206c7672],
  [0x20357068, 0x2035706d, 0x206c7672],
  [0x20357068, 0x2035706d, 0x206c7672],
  [0x20357068, 0x2035706d, 0x206c7672],
  [0x20357068, 0x2035706d, 0x206c7672],
  [0x20357068, 0x2035706d, 0x206c7672],
]

/**
 * `.data` `0x6FD2E1BC` (`9` entries, count at `0x6FD2E1E0 = 9`): preset object spawner VAs for `0x23E..0x246`.
 */
const DEFAULT_PRESET_OBJ_TABLE_6FD2E1BC: readonly number[] = [
  0x6fc525c0, 0x6fc525c0, 0x6fc525c0, 0x6fc525c0, 0x6fc525c0, 0x6fc525c0,
  0x6fc531b0, 0x6fc522b0, 0x6fc52110,
]

/**
 * `.data` `0x6FD2E00C` (`dx[8]`) and `0x6FD2E02C` (`dy[8]`) neighbor offsets.
 */
const NEIGHBOR8_DX_6FD2E00C: readonly number[] = [-1, 0, 1, -1, 1, -1, 0, 1]
const NEIGHBOR8_DY_6FD2E02C: readonly number[] = [-1, -1, -1, 0, 0, 1, 1, 1]

/**
 * `.data` `0x6FD2E334` (`int32[4]`) and `0x6FD2E344` (`count = 2`).
 */
const DEFAULT_EDGE_OBJ_TABLE_6FD2E334: readonly number[] = [104, 105, 106, 107]

/**
 * `.data` `0x6FD2E1F8` (`int32[10]`) and `0x6FD2E224` (`count = 5`).
 */
const DEFAULT_CRATE_OBJ_TABLE_6FD2E1F8: readonly number[] = [4, 9, 52, 94, 95, 89, 284, 208, 209, 3]

/**
 * `.rdata` `0x6FD1CCC0`: 6 entries `(nObjClassId, nMinShrine, nMaxShrine)` for preset objects `0x23E..0x243`.
 */
const PRESET_SHRINE_GROUP_TABLE_6FD1CCC0: readonly (readonly [number, number, number])[] = [
  [136, 2, 6],
  [136, 7, 7],
  [136, 8, 11],
  [136, 12, 12],
  [136, 1, 5],
  [136, 14, 14],
]

/**
 * Common inlined object unit allocation, initialization, and room placement sequence
 * shared across `0x6FC4FA90..0x6FC525C0`.
 */
function allocInitAndPlaceObjectUnit113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  nObjectId: number,
  x: number,
  y: number,
  nInitMode = 0,
): number {
  const pUnit = UNIT_Alloc113c(m, 2) >>> 0
  if (pUnit === 0) return 0
  m.setU32(pUnit, 2)
  m.setU32((pUnit + 0x04) >>> 0, nObjectId >>> 0)
  m.setU32((pUnit + 0x08) >>> 0, m.u32((pGame + 0x1c) >>> 0))
  m.setU32((pUnit + 0x80) >>> 0, pGame >>> 0)
  let flags2 = m.u32((pUnit + 0xc8) >>> 0) >>> 0
  if (m.u32((pGame + 0x70) >>> 0) !== 0) {
    flags2 = (flags2 | 0x2000000) >>> 0
  } else {
    flags2 = (flags2 & 0xfdffffff) >>> 0
  }
  m.setU32((pUnit + 0xc8) >>> 0, flags2)
  m.setU32((pUnit + 0xc8) >>> 0, (flags2 | 0x4000000) >>> 0)
  const nAct = DRLG_GetActNoFromLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom)) & 0xff
  m.setU8((pUnit + 0x18) >>> 0, nAct)
  m.setU32((pUnit + 0x1c) >>> 0, m.u32((pGame + 0xbc + nAct * 4) >>> 0))
  m.setU32((pUnit + 0x74) >>> 0, 0)
  SUNIT_InitUnitSeed113c(m, pUnit, (pGame + 0xd0) >>> 0)
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x10) >>> 0)
  m.setU32((pUnit + 0xd0) >>> 0, 0x0b)
  let nUnitId = ((m.u32((pGame + 0x98) >>> 0) | 0) + 1) | 0
  if (nUnitId === -1) nUnitId = 1
  m.setU32((pGame + 0x98) >>> 0, nUnitId >>> 0)
  const pObjData = m.alloc(0x38) >>> 0
  m.setU32((pUnit + 0x14) >>> 0, pObjData)
  m.fill(pObjData, 0x38, 0)
  m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0)
  m.setU32((pUnit + 0x10) >>> 0, nInitMode >>> 0)
  UNITS_AllocStaticPath113c(m, pUnit)
  OBJECTS_InitObjectUnit113c(m, pUnit, pGame, nUnitId >>> 0, pRoom, x, y)
  SUNIT_PlaceServerUnitInRoom113c(m, pRoom, y, pUnit, x, pGame, 1)
  return pUnit
}

// ============================================================================
// [1/45] .. [45/45]
// ============================================================================

/**
 * [1/45] Foul Crow Nest AI (`0x6FC3BCA0`): initializes remaining spawn count in `pAiControl+0x18`
 * from `MonStatsTxt->aipar1[diff]` (`+0x56`), dies (`mode 0`) when depleted, or spawns a crow
 * (`classId 0x60` resolved via `DRLG_ResolveMonsterSubClassIdForRoom113c`) when target is within
 * `aipar2[diff]` (`+0x5C`) and cooldown `pAiControl+0x14 <= dwGameFrame`, then stalls `15` frames.
 *
 * @va D2Game:0x6FC3BCA0
 */
export function AI_SpawnPackMinionOrStartMode_6FC3BCA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
  hooks?: K2W3B2Hooks113c,
): void {
  hitD2GameVa113c(0x6FC3BCA0)
  const pAiControl = m.u32(pAiTickArgs >>> 0) >>> 0
  const nDist = m.u32((pAiTickArgs + 0x14) >>> 0) | 0
  const pMonStatsTxt = m.u32((pAiTickArgs + 0x1c) >>> 0) >>> 0

  const dwNextSpawnFrame = m.u32((pAiControl + 0x14) >>> 0) | 0
  if (dwNextSpawnFrame === 0) {
    const nDiffInit = m.u8((pGame + 0x6d) >>> 0)
    const wInitCount = sx16(m.u16((pMonStatsTxt + nDiffInit * 2 + 0x56) >>> 0))
    m.setU32((pAiControl + 0x18) >>> 0, wInitCount >>> 0)
  }

  const nDiffDist = m.u8((pGame + 0x6d) >>> 0)
  const wMaxDist = sx16(m.u16((pMonStatsTxt + nDiffDist * 2 + 0x5c) >>> 0))
  if (nDist > wMaxDist) {
    AI_Stall113c(m, pGame, pUnit, 0x0f)
    return
  }

  const nRemaining = m.u32((pAiControl + 0x18) >>> 0) | 0
  if (nRemaining <= 0) {
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
    MONSTER_StartMode113c(m, pGame, pUnit, 0, 0, 0, 0)
    return
  }

  if (dwNextSpawnFrame <= (m.u32((pGame + 0xa8) >>> 0) | 0)) {
    const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
    const nMonStatsCount = pDataTables !== 0 ? (m.u32((pDataTables + 0xa80) >>> 0) | 0) : 0
    const nCrowClassId = nMonStatsCount > 0x60 ? 0x60 : -1
    const nSubClassId = DRLG_ResolveMonsterSubClassIdForRoom113c(m, pRoom, nCrowClassId) | 0

    const sp = w3b2ScratchSp
    w3b2ScratchSp = (sp + 0x10) >>> 0
    try {
      const pOutX = sp
      const pOutY = (sp + 4) >>> 0
      m.setU32(pOutX, 0)
      m.setU32(pOutY, 0)
      const bFound = REGPOP_FindPackSpawnCoords113c(
        m,
        pRoom,
        pGame,
        0,
        nSubClassId,
        pOutX,
        pOutY,
        0,
        hooks !== undefined ? hooks.regpop : undefined,
      )
      if (bFound !== 0) {
        const x = m.u32(pOutX) | 0
        const y = m.u32(pOutY) | 0
        const pSpawned = MONSTER_SpawnAtCoords113c(
          m,
          nSubClassId,
          1,
          pGame,
          pRoom,
          x,
          y,
          2,
          0x42,
          hooks !== undefined ? hooks.regpop : undefined,
        ) >>> 0
        if (pSpawned !== 0) {
          m.setU32((pAiControl + 0x18) >>> 0, ((m.u32((pAiControl + 0x18) >>> 0) | 0) - 1) >>> 0)
          const nDiffDelay = m.u8((pGame + 0x6d) >>> 0)
          const wCooldown = sx16(m.u16((pMonStatsTxt + nDiffDelay * 2 + 0x62) >>> 0))
          m.setU32(
            (pAiControl + 0x14) >>> 0,
            ((m.u32((pGame + 0xa8) >>> 0) | 0) + wCooldown) >>> 0,
          )
        }
      }
    } finally {
      w3b2ScratchSp = sp
    }
  }

  AI_Stall113c(m, pGame, pUnit, 0x0f)
}

/**
 * [2/45] Steps octant turn direction in `pAiControl->dwParam[4]` (`+0x1C`) via `0x6FD1CF38`
 * and casts `MonStatsTxt->wSkill[4]` (`+0x170`) with mode `MonStatsTxt->nSkillMode[4]` (`+0x180`).
 *
 * @va D2Game:0x6FC3C1E0
 */
export function AI_StepTurnAndCastSkill4_6FC3C1E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
  hooks?: K2W3B2Hooks113c,
): void {
  hitD2GameVa113c(0x6FC3C1E0)
  const pAiControl = m.u32(pAiTickArgs >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiTickArgs + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((pAiTickArgs + 0x08) >>> 0) >>> 0
  const nDist = m.u32((pAiTickArgs + 0x14) >>> 0) | 0
  const wSkill4 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))

  if (wSkill4 >= 0 && m.u32((pAiControl + 0x14) >>> 0) === 0) {
    const nMode = sx8(m.u8((pMonStatsTxt + 0x180) >>> 0))
    AI_CastSkillWithMode113c(
      m,
      nMode,
      pUnit,
      pGame,
      wSkill4,
      0,
      0,
      0,
      undefined,
      hooks !== undefined ? hooks.aiFallen : undefined,
    )
    m.setU32((pAiControl + 0x1c) >>> 0, 0)
    m.setU32((pAiControl + 0x14) >>> 0, m.u32((pGame + 0xa8) >>> 0))
    return
  }

  const dwCurFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  if (dwCurFrame >= (m.u32((pAiControl + 0x14) >>> 0) | 0)) {
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    const wMaxDist = sx16(m.u16((pMonStatsTxt + 0x68 + nDiff * 2) >>> 0))
    if (nDist > wMaxDist) {
      const nCount = m.u32((pAiControl + 0x18) >>> 0) | 0
      if (nCount > 0) {
        m.setU32((pAiControl + 0x18) >>> 0, (nCount - 1) >>> 0)
      }
      AI_Stall113c(m, pGame, pUnit, 0x0f)
      return
    }

    const targetX = getUnitPosXInline113c(m, pTarget)
    const targetY = getUnitPosYInline113c(m, pTarget)
    const unitX = getUnitPosXInline113c(m, pUnit)
    const unitY = getUnitPosYInline113c(m, pUnit)

    const rawDir = UNITS_GetDirectionToCoords113c(m, pUnit, targetX, targetY) & 0xff
    const oldDir = mod8Signed113c(m.u32((pAiControl + 0x1c) >>> 0) | 0)
    const normDir = mod8Signed113c(DATATBLS_NormalizeDirection113c(m, rawDir) & 0xff)
    const matIdx = (oldDir + (normDir << 3)) | 0
    const nextDir =
      matIdx >= 0 && matIdx < 64
        ? DIR_TURN_MATRIX_6FD1CF38[matIdx]!
        : m.u32((0x6fd1cf38 + imul32(matIdx, 4)) >>> 0) | 0
    m.setU32((pAiControl + 0x1c) >>> 0, nextDir >>> 0)

    const wStepMult = sx16(m.u16((pMonStatsTxt + 0x6e + nDiff * 2) >>> 0))
    const stepVec = DIR_OFFSET_TABLE_6FD1CEF8[nextDir & 7]!
    const destX = (unitX + imul32(stepVec[0], wStepMult)) | 0
    const destY = (unitY + imul32(stepVec[1], wStepMult)) | 0

    UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit, pTarget)

    const wCurSkill = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
    if (wCurSkill >= 0) {
      const canCastDest = SKILLS_CanMonsterCastAtTarget113c(
        m,
        destY,
        pTarget,
        pUnit,
        wCurSkill,
        destX,
        hooks !== undefined ? hooks.aiFallen : undefined,
      )
      if (canCastDest !== 0) {
        const tY = UNIT_GetPosY113c(m, pTarget) | 0
        const tX = UNIT_GetPosX113c(m, pTarget) | 0
        const canCastTarget = SKILLS_CanMonsterCastAtTarget113c(
          m,
          tY,
          pTarget,
          pUnit,
          sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)),
          tX,
          hooks !== undefined ? hooks.aiFallen : undefined,
        )
        if (canCastTarget !== 0) {
          const nCastSkill = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
          const nCastMode = m.u8((pMonStatsTxt + 0x180) >>> 0)
          AI_CastSkillWithMode113c(
            m,
            nCastMode,
            pUnit,
            pGame,
            nCastSkill,
            0,
            destX,
            destY,
            undefined,
            hooks !== undefined ? hooks.aiFallen : undefined,
          )
          PATH_SetTargetPos113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0, destX, destY)
          const newCount = ((m.u32((pAiControl + 0x18) >>> 0) | 0) + 1) | 0
          m.setU32((pAiControl + 0x18) >>> 0, newCount >>> 0)
          const nDiffIdx = m.u8((pGame + 0x6d) >>> 0)
          const wMaxBursts = sx16(m.u16((pMonStatsTxt + 0x5c + nDiffIdx * 2) >>> 0))
          if (newCount > wMaxBursts) {
            const wCooldown = sx16(m.u16((pMonStatsTxt + 0x62 + nDiffIdx * 2) >>> 0))
            m.setU32((pAiControl + 0x14) >>> 0, ((m.u32((pGame + 0xa8) >>> 0) | 0) + wCooldown) >>> 0)
            m.setU32((pAiControl + 0x18) >>> 0, 0)
            return
          }
          const wShortDelay = sx16(m.u16((pMonStatsTxt + 0x56 + nDiffIdx * 2) >>> 0))
          m.setU32((pAiControl + 0x14) >>> 0, ((m.u32((pGame + 0xa8) >>> 0) | 0) + wShortDelay) >>> 0)
          return
        }
      }
    }

    const nCurBurst = m.u32((pAiControl + 0x18) >>> 0) | 0
    if (nCurBurst > 0) {
      m.setU32((pAiControl + 0x18) >>> 0, (nCurBurst - 1) >>> 0)
    }
  }

  AI_Stall113c(m, pGame, pUnit, 0x0a)
}

function isFallenSliceWorldW3B2_113c(
  v: D2KernMemory113c | FallenSliceWorld113c,
): v is FallenSliceWorld113c {
  return !('u32' in v)
}

/**
 * [3/45] Evaluates hireling skill slots (`HirelingTxt + 0x78`), performs weighted random selection,
 * and either casts the selected skill or executes a melee attack / approach against `pTarget`.
 *
 * @va D2Game:0x6FC3C4E0
 */
export function AI_SelectAndCastHirelingSkill_6FC3C4E0_113c(
  arg0: D2KernMemory113c | FallenSliceWorld113c,
  arg1: number,
  arg2: number,
  arg3: number,
  arg4: number,
  arg5?: number | K2W3B2Hooks113c,
  arg6?: number,
): number {
  hitD2GameVa113c(0x6FC3C4E0)
  if (!isFallenSliceWorldW3B2_113c(arg0) && typeof arg6 === 'number') {
    const m = arg0
    const pMerc = arg1 >>> 0
    const pGame = arg2 >>> 0
    const nClassId = arg3 | 0
    const wMercType = (arg4 << 16) >> 16
    const pTarget = (typeof arg5 === 'number' ? arg5 : 0) >>> 0
    const pSeed = arg6 >>> 0

    const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, nClassId) >>> 0
    if (pMonStatsTxt === 0) return pMerc

    const mercLvl = STATLIST_GetUnitStat113c(m, pMerc, 0x0c, 0) | 0
    const bExpansion = m.u32((pGame + 0x70) >>> 0) | 0
    const pHirelingTxt =
      DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(m, bExpansion, wMercType, mercLvl) >>> 0
    if (pHirelingTxt === 0) return 0

    let totalWeight = m.u32((pHirelingTxt + 0x64) >>> 0) | 0
    let lvlDiff = (mercLvl - (m.u32((pHirelingTxt + 0x1c) >>> 0) | 0)) | 0
    if (lvlDiff < 0) lvlDiff = 0

    const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pTables = pTablesPtr !== 0 ? (m.u32(pTablesPtr) >>> 0) : 0
    const nMonCount = pTables !== 0 ? (m.u32((pTables + 0xa80) >>> 0) | 0) : 0
    const nSkillsCount = pTables !== 0 ? (m.u32((pTables + 0xba0) >>> 0) | 0) : 0
    const nStatesCount = pTables !== 0 ? (m.u32((pTables + 0xc4) >>> 0) | 0) : 0

    const cumWeights = [0, 0, 0, 0, 0, 0]
    for (let slot = 0; slot < 6; slot += 1) {
      const skillId = m.u32((pHirelingTxt + 0x78 + slot * 4) >>> 0) | 0
      if (skillId <= 0 || skillId >= nSkillsCount) break
      const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId) >>> 0
      if (pSkillsTxt === 0) continue

      cumWeights[slot] = 0
      const pSkill = SKILLS_GetSkillById113c(m, pMerc, skillId, -1) >>> 0
      if (pSkill === 0) continue
      const effSlvl = SKILLS_EvaluateSkillLevel113c(m, pMerc, pSkill, 1) | 0
      if (effSlvl <= 0) continue

      if (m.u8((pSkillsTxt + 0x230) >>> 0) === 1) {
        const auraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
        if (auraState >= 0 && auraState < nStatesCount) {
          if (STATES_CheckState113c(m, pMerc, auraState) !== 0) continue
        }
      }

      if (skillId === 0x29) {
        const pSk29 = SKILLS_GetSkillById113c(m, pMerc, 0x29, -1) >>> 0
        if (pTarget !== 0 && pSk29 !== 0) {
          const slvl29 = SKILLS_EvaluateSkillLevel113c(m, pMerc, pSk29, 1) | 0
          const maxRange = (sdiv32(slvl29, 2) + 4) | 0
          if ((UNITS_GetApproximateDistance113c(m, pMerc, pTarget) | 0) > maxRange) continue
        }
      }

      const chancePerLvl = m.u32((pHirelingTxt + 0xa8 + slot * 4) >>> 0) | 0
      const baseChance = m.u32((pHirelingTxt + 0x90 + slot * 4) >>> 0) | 0
      const prod = imul32(chancePerLvl, lvlDiff)
      const scaled = ((prod + ((prod >> 31) & 3)) >> 2) | 0
      totalWeight = (totalWeight + baseChance + scaled) | 0
      cumWeights[slot] = totalWeight
    }

    const rollBound = (totalWeight + 1) | 0
    const roll = rollBound > 0 ? rollLimitedSeed64InMem113c(m, pSeed, rollBound) : 0
    const baseAttackWeight = m.u32((pHirelingTxt + 0x64) >>> 0) | 0

    if (roll >= baseAttackWeight) {
      let chosenSlot = 0
      if (roll > cumWeights[0]!) {
        while (chosenSlot < 6) {
          const nextW = chosenSlot + 1 < 6 ? cumWeights[chosenSlot + 1]! : 0
          chosenSlot += 1
          if (roll <= nextW) break
        }
      }
      if (chosenSlot < 6) {
        const chosenSkillId = m.u32((pHirelingTxt + 0x78 + chosenSlot * 4) >>> 0) | 0
        if (chosenSkillId > 0) {
          const pSkillsTxt = chosenSkillId < nSkillsCount ? (SKILLS_GetRecordPtrFast113c(m, chosenSkillId) >>> 0) : 0
          const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
          const auraMask = pMasks !== 0 ? m.u8((pMasks + 0x14) >>> 0) : 0x20
          if (pSkillsTxt !== 0 && (m.u8((pSkillsTxt + 0x04) >>> 0) & auraMask) !== 0) {
            SKILLS_AssignHandSkillAndSyncAura113c(m, pMerc, 0, chosenSkillId, -1)
            AI_Stall113c(m, pGame, pMerc, 10)
            return 1
          }
          const bMode = m.u8((pHirelingTxt + 0xc0 + chosenSlot) >>> 0)
          const castOk = AI_CastSkillWithMode113c(m, bMode, pMerc, pGame, chosenSkillId, pTarget, 0, 0)
          if (castOk !== 0 && SKILLS_GetUsedSkillMemPort113c(m, pMerc) !== 0) {
            SKILLS_StartUsedSkill113c(m, pMerc, pGame)
          }
          return castOk
        }
      }
    }

    const clsChecked = nClassId < nMonCount ? nClassId : -1
    if (clsChecked === 0x10f) {
      const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      const bMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
      const castOk = AI_CastSkillWithMode113c(m, bMode0, pMerc, pGame, wSkill0, pTarget, 0, 0)
      if (castOk !== 0 && SKILLS_GetUsedSkillMemPort113c(m, pMerc) !== 0) {
        SKILLS_StartUsedSkill113c(m, pMerc, pGame)
      }
      return castOk
    }

    if (
      clsChecked === 0x152 ||
      clsChecked === 0x167 ||
      clsChecked === 0x230 ||
      clsChecked === 0x231
    ) {
      if (UNITS_CanUnitMeleeAttackTarget113c(m, pMerc, pTarget, 0) === 0) {
        AI_Stall113c(m, pGame, pMerc, 10)
        return 1
      }
      SKILLS_SetUsedSkillMemPort113c(m, pMerc, 0)
      let nCombatMode = 0x64
      if (pMerc !== 0) {
        const pMercStats = MONSTATS_GetRecordPtr113c(m, m.u32((pMerc + 0x04) >>> 0) | 0) >>> 0
        const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
        const flagMask = pMasks !== 0 ? m.u32((pMasks + 0x10) >>> 0) : 0x10
        if (pMercStats !== 0 && (m.u8((pMercStats + 0x104) >>> 0) & flagMask) !== 0) {
          nCombatMode = 0x65
        }
      }
      return MONSTER_StartMode113c(m, pGame, pMerc, 4, pTarget, 0, 0, nCombatMode, 1)
    }

    AI_Stall113c(m, pGame, pMerc, 10)
    return 1
  }
  if (isFallenSliceWorldW3B2_113c(arg0)) {
    const world = arg0
    const { m, pGame } = world
    const pMerc = arg1 >>> 0
    const nClassId = arg2 | 0
    const wMercType = arg3 | 0
    const pTarget = arg4 >>> 0
    const pSeed = typeof arg5 === 'number' ? arg5 >>> 0 : (pMerc + 0x20) >>> 0

    const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, nClassId) >>> 0
    if (pMonStatsTxt === 0) return 0

    const mercLvl = STATLIST_GetUnitStat113c(m, pMerc, 0x0c, 0) | 0
    const bExpansion = m.u32((pGame + 0x70) >>> 0) | 0
    const pHirelingTxt =
      DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(m, bExpansion, wMercType, mercLvl) >>> 0
    if (pHirelingTxt === 0) return 0

    let totalWeight = m.u32((pHirelingTxt + 0x64) >>> 0) | 0
    let lvlDiff = (mercLvl - (m.u32((pHirelingTxt + 0x1c) >>> 0) | 0)) | 0
    if (lvlDiff < 0) lvlDiff = 0

    const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pTables = pTablesPtr !== 0 ? (m.u32(pTablesPtr) >>> 0) : 0
    const nSkillsCount = pTables !== 0 ? (m.u32((pTables + 0xba0) >>> 0) | 0) : 0
    const nStatesCount = pTables !== 0 ? (m.u32((pTables + 0xc4) >>> 0) | 0) : 0

    const cumWeights = [0, 0, 0, 0, 0, 0]
    for (let slot = 0; slot < 6; slot += 1) {
      const skillId = m.u32((pHirelingTxt + 0x78 + slot * 4) >>> 0) | 0
      if (skillId <= 0 || skillId >= nSkillsCount) break
      const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId) >>> 0
      if (pSkillsTxt === 0) continue

      const pSkill = SKILLS_GetSkillById113c(m, pMerc, skillId, 0xffffffff) >>> 0
      if (pSkill === 0) continue
      const effSlvl = m.u32((pSkill + 0x28) >>> 0) | 0
      if (effSlvl <= 0) continue

      if (m.u8((pSkillsTxt + 0x230) >>> 0) === 1) {
        const auraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
        if (auraState >= 0 && auraState < nStatesCount) {
          if (STATES_CheckState113c(m, pMerc, auraState) !== 0) continue
        }
      }

      if (skillId === 0x29 && pTarget !== 0) {
        const halfSlvl = sdiv32(effSlvl, 2)
        const maxRange = (halfSlvl + 4) | 0
        if ((UNITS_GetApproximateDistance113c(m, pMerc, pTarget) | 0) > maxRange) continue
      }

      const chancePerLvl = m.u32((pHirelingTxt + 0xa8 + slot * 4) >>> 0) | 0
      const baseChance = m.u32((pHirelingTxt + 0x90 + slot * 4) >>> 0) | 0
      const prod = imul32(chancePerLvl, lvlDiff)
      const scaled = ((prod + ((prod >> 31) & 3)) >> 2) | 0
      totalWeight = (totalWeight + baseChance + scaled) | 0
      cumWeights[slot] = totalWeight
    }

    const rollBound = (totalWeight + 1) | 0
    const roll = rollBound > 0 ? rollLimitedSeed64InMem113c(m, pSeed, rollBound) : 0
    const baseAttackWeight = m.u32((pHirelingTxt + 0x64) >>> 0) | 0

    if (roll >= baseAttackWeight) {
      let chosenSlot = 0
      if (roll > cumWeights[0]!) {
        while (chosenSlot < 6) {
          const nextW = chosenSlot + 1 < 6 ? cumWeights[chosenSlot + 1]! : 0
          chosenSlot += 1
          if (roll <= nextW) break
        }
      }
      if (chosenSlot < 6) {
        const chosenSkillId = m.u32((pHirelingTxt + 0x78 + chosenSlot * 4) >>> 0) | 0
        if (chosenSkillId > 0 && chosenSkillId < nSkillsCount) {
          const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, chosenSkillId) >>> 0
          const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
          const auraMask = pMasks !== 0 ? m.u8((pMasks + 0x14) >>> 0) : 0x20
          if (pSkillsTxt !== 0 && (m.u8((pSkillsTxt + 0x04) >>> 0) & auraMask) !== 0) {
            SKILLS_AssignHandSkillAndSyncAura113c(m, pMerc, 0, chosenSkillId, 0xffffffff)
            AI_Stall113c(world, pMerc, 10)
            return 1
          }
          const bMode = m.u8((pHirelingTxt + 0xc0 + chosenSlot) >>> 0)
          return AI_CastSkillWithMode113c(m, bMode, pMerc, pGame, chosenSkillId, pTarget, 0, 0, world)
        }
      }
    }

    if (nClassId === 0x10f) {
      const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      const bMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
      return AI_CastSkillWithMode113c(m, bMode0, pMerc, pGame, wSkill0, pTarget, 0, 0, world)
    }

    if (
      nClassId === 0x152 ||
      nClassId === 0x167 ||
      nClassId === 0x230 ||
      nClassId === 0x231
    ) {
      if (UNITS_CanUnitMeleeAttackTarget113c(m, pMerc, pTarget, 0) === 0) {
        AI_Stall113c(world, pMerc, 10)
        return 0
      }
      SKILLS_SetUsedSkillMemPort113c(m, pMerc, 0)
      const pPath = m.u32((pMerc + 0x2c) >>> 0) >>> 0
      if (pPath !== 0) {
        PATH_SetStepNum113c(m, pPath, 1)
      }
      return MONSTER_StartMode113c(world, pMerc, 4, pTarget, 0, 0) ? 1 : 0
    }

    AI_Stall113c(world, pMerc, 10)
    return 0
  }

  const m = arg0
  const pGame = arg1
  const pUnit = arg2
  const pTarget = arg3
  const bAllowMove = arg4
  const hooks = typeof arg5 === 'object' ? arg5 : undefined
  const nUnitLevel = STATLIST_GetUnitStat113c(m, pUnit, 0x0c, 0) | 0
  let wSubTypeId = 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      wSubTypeId = m.u16((pMonData + 0x22) >>> 0)
    }
  }
  const pHirelingTxt = DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(
    m,
    m.u8((pGame + 0x70) >>> 0),
    wSubTypeId,
    nUnitLevel,
  ) >>> 0
  if (pHirelingTxt === 0) return 0

  let nTotalChance = m.u32((pHirelingTxt + 0x5c) >>> 0) | 0
  let nEligibleCount = 0
  const eligibleSkills: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0]
  const eligibleChances: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0]
  const eligibleModes: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0]

  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  const nSkillsCount = m.u32((pDataTables + 0xbac) >>> 0) | 0
  const pSkillsBase = m.u32((pDataTables + 0xba8) >>> 0) >>> 0

  for (let i = 0; i < 6; i++) {
    const wSkillId = m.u16((pHirelingTxt + 0x78 + i * 2) >>> 0)
    if (wSkillId === 0) break
    const pSkill = SKILLS_GetSkillById113c(m, pUnit, wSkillId, -1) >>> 0
    if (pSkill === 0) continue
    if ((SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1) | 0) <= 0) continue
    const nSkillIdx = wSkillId & 0xffff
    if (nSkillIdx >= nSkillsCount) continue
    const pSkillsTxt = (pSkillsBase + imul32(nSkillIdx, 0x23c)) >>> 0
    if (pSkillsTxt === 0) continue

    const nAuraState = sx16(m.u16((pSkillsTxt + 0x10) >>> 0))
    if (nAuraState > 0 && STATES_CheckState113c(m, pUnit, nAuraState) !== 0) {
      continue
    }

    const nRangeType = m.u8((pSkillsTxt + 0x18) >>> 0)
    if ((nRangeType === 1 || nRangeType === 3) && pTarget !== 0) {
      if ((UNITS_GetApproximateDistance113c(m, pUnit, pTarget) | 0) > 2) {
        continue
      }
    }

    const nMode = m.u8((pHirelingTxt + 0x90 + i) >>> 0)
    const nChance = m.u32((pHirelingTxt + 0x60 + i * 4) >>> 0) | 0
    eligibleSkills[nEligibleCount] = nSkillIdx
    eligibleChances[nEligibleCount] = nChance
    eligibleModes[nEligibleCount] = nMode
    nTotalChance = (nTotalChance + nChance) | 0
    nEligibleCount++
  }

  let nSelectedSlot = -1
  if (nEligibleCount > 0) {
    let nRoll = 0
    if (nTotalChance > 0) {
      nRoll = rollLimitedSeed64InMem113c(m, (pUnit + 0x20) >>> 0, nTotalChance)
    }
    let idx = 0
    for (; idx < nEligibleCount; idx++) {
      if (nRoll < eligibleChances[idx]!) break
      nRoll = (nRoll - eligibleChances[idx]!) | 0
    }
    if (idx < nEligibleCount) {
      nSelectedSlot = idx
    }
  }

  if (nSelectedSlot !== -1) {
    const nChosenMode = eligibleModes[nSelectedSlot]!
    const nChosenSkill = eligibleSkills[nSelectedSlot]!
    if (nChosenMode === 0x0e) {
      SKILLS_AssignHandSkillAndSyncAura113c(
        m,
        pUnit,
        0,
        nChosenSkill,
        -1,
        hooks !== undefined ? hooks.meleeDot : undefined,
      )
      return 1
    }
    if (pTarget !== 0) {
      let nAnimMode = nChosenMode
      if (nAnimMode < 4 || nAnimMode > 0x0f) {
        nAnimMode = 4
      }
      AI_CastSkillWithMode113c(
        m,
        nAnimMode & 0xff,
        pUnit,
        pGame,
        nChosenSkill,
        pTarget,
        0,
        0,
        undefined,
        hooks !== undefined ? hooks.aiFallen : undefined,
      )
      return 1
    }
  } else if (pTarget !== 0) {
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
    if (UNITS_CanUnitMeleeAttackTarget113c(m, pUnit, pTarget, 0) !== 0) {
      let nAtkMode = 4
      const nClassId = pUnit !== 0 ? m.u32((pUnit + 0x04) >>> 0) | 0 : -1
      const pMonStats = (pDataTables !== 0 && nClassId >= 0 && nClassId < (m.u32((pDataTables + 0xa80) >>> 0) | 0))
        ? (m.u32((pDataTables + 0xa78) >>> 0) + imul32(nClassId, 0x1a8)) >>> 0
        : 0
      const pMonStats2 = pMonStats !== 0 ? MONSTATS2_GetRecordPtr113c(m, sx16(m.u16((pMonStats + 0x06) >>> 0))) >>> 0 : 0
      if (pMonStats2 !== 0 && (m.u8((pMonStats2 + 0x0c) >>> 0) & 0x20) !== 0) {
        const nA1ToHit = STATLIST_GetUnitStat113c(m, pUnit, 0x13, 0) | 0
        const nA2ToHit = STATLIST_GetUnitStat113c(m, pUnit, 0x14, 0) | 0
        const nSum = (nA1ToHit + nA2ToHit) | 0
        let nAtkRoll = 0
        if (nSum > 0) {
          nAtkRoll = rollLimitedSeed64InMem113c(m, (pUnit + 0x20) >>> 0, nSum)
        }
        nAtkMode = (nAtkRoll >= nA1ToHit ? 1 : 0) + 4
      }
      MONSTER_StartMode113c(m, pGame, pUnit, nAtkMode, pTarget, 0, 0)
      return 1
    }
    if (bAllowMove !== 0) {
      MONSTER_StartMode113c(m, pGame, pUnit, 2, pTarget, 0, 0)
      return 1
    }
  }

  AI_Stall113c(m, pGame, pUnit, 0x0a)
  return 1
}

function findAiCmdInCircularList113c(
  m: Memory113c,
  pMonster: number,
  nCmdType: number,
): number {
  if (pMonster === 0 || (m.u32(pMonster >>> 0) >>> 0) !== 1) return 0
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return 0
  const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGen === 0) return 0
  const pCmdHead = m.u32((pAiGen + 0x20) >>> 0) >>> 0
  if (pCmdHead === 0) return 0
  let pNode = m.u32(pCmdHead) >>> 0
  if (pNode === 0) return 0
  if ((m.u32((pNode + 0x08) >>> 0) | 0) === (nCmdType | 0)) {
    return pNode
  }
  let guard = 0
  while (pNode !== pCmdHead && pNode !== 0 && guard < 1024) {
    pNode = m.u32(pNode) >>> 0
    guard++
    if (pNode === 0) return 0
    if ((m.u32((pNode + 0x08) >>> 0) | 0) === (nCmdType | 0)) {
      return pNode
    }
  }
  return pNode !== 0 && (m.u32((pNode + 0x08) >>> 0) | 0) === (nCmdType | 0) ? pNode : 0
}

/**
 * [4/45] Applies preset AI commands (`cmd 0x0A`), moves preset pointer (`+0x24` -> `pAiGen+0x38`),
 * sets base-class (`0x44`, `0x21F`) and specific-class (`0x137`, `0x138`) AI/monster fields,
 * and applies `0xDEADDEAD` sentinel unit flags (`0x4000000`, `0x20000`).
 *
 * @va D2Game:0x6FC3F2D0
 */
export function MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c(
  m: D2KernMemory113c,
  pMonster: number,
  pGame: number,
  pPresetUnit = 0,
): void {
  hitD2GameVa113c(0x6FC3F2D0)
  if (pMonster === 0 || pPresetUnit === 0) return
  const nClassId = m.u32((pMonster + 0x04) >>> 0) | 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0

  let pMonStatsTxt = 0
  if (nClassId >= 0 && pDataTables !== 0 && nClassId < (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
    pMonStatsTxt = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(nClassId, 0x1a8)) >>> 0
  }

  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const mask0 = pMasks !== 0 ? m.u32(pMasks) : 1
  const mask1 = pMasks !== 0 ? m.u32((pMasks + 4) >>> 0) : 2
  const mask2 = pMasks !== 0 ? m.u32((pMasks + 8) >>> 0) : 4

  if (pMonStatsTxt !== 0) {
    const bFlag0D = m.u8((pMonStatsTxt + 0x0d) >>> 0)
    if ((bFlag0D & (mask0 | mask1 | mask2)) !== 0) {
      if (findAiCmdInCircularList113c(m, pMonster, 0x0a) === 0) {
        AIGENERAL_CopyAiCommandParams113c(m, pMonster, 0x0a, 0, 0, 0, 0)
      }
      const pCmd = findAiCmdInCircularList113c(m, pMonster, 0x0a)
      if (pCmd !== 0) {
        m.setU32((pCmd + 0x0c) >>> 0, m.u32((pPresetUnit + 0x4c) >>> 0))
        m.setU32((pCmd + 0x10) >>> 0, m.u32((pPresetUnit + 0x50) >>> 0))
        m.setU32((pCmd + 0x14) >>> 0, 0)
      }
      const ppPresetExtra = (pPresetUnit + 0x24) >>> 0
      let pAiGen = 0
      if ((m.u32(pMonster >>> 0) >>> 0) === 1) {
        const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) {
          pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
        }
      }
      if (m.u32(ppPresetExtra) !== 0 && pAiGen !== 0) {
        DRLGPRESET_MovePointerAndClear113c(m, ppPresetExtra, (pAiGen + 0x38) >>> 0)
      }
    }
  }

  const bForceCmdA =
    nClassId === 0x10b ||
    nClassId === 0xf3 ||
    ((m.u32((pPresetUnit + 0x18) >>> 0) & 0x800) !== 0 &&
      m.u16((pPresetUnit + 0x3c) >>> 0) === 6)
  if (
    bForceCmdA &&
    (m.u32((pPresetUnit + 0x4c) >>> 0) !== 0 || m.u32((pPresetUnit + 0x50) >>> 0) !== 0)
  ) {
    if (findAiCmdInCircularList113c(m, pMonster, 0x0a) === 0) {
      AIGENERAL_CopyAiCommandParams113c(m, pMonster, 0x0a, 0, 0, 0, 0)
    }
    const pCmd = findAiCmdInCircularList113c(m, pMonster, 0x0a)
    if (pCmd !== 0) {
      m.setU32((pCmd + 0x0c) >>> 0, m.u32((pPresetUnit + 0x4c) >>> 0))
      m.setU32((pCmd + 0x10) >>> 0, m.u32((pPresetUnit + 0x50) >>> 0))
    }
  }

  if ((m.u32(pMonster >>> 0) >>> 0) === 1 && pDataTables !== 0) {
    let nBaseId = m.u32((pMonster + 0x04) >>> 0) | 0
    if (nBaseId >= 0) {
      const nMonStatsCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
      if (nBaseId < nMonStatsCount) {
        const pRec = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(nBaseId, 0x1a8)) >>> 0
        if (pRec !== 0) {
          nBaseId = sx16(m.u16((pRec + 0x02) >>> 0))
        }
      }
      if (nBaseId >= 0 && nBaseId < nMonStatsCount) {
        if (nBaseId === 0x44) {
          const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
          if (pMonData !== 0) {
            const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
            if (pAiGen !== 0) {
              m.setU32((pAiGen + 0x1c) >>> 0, m.u32((pPresetUnit + 0x4c) >>> 0))
            }
          }
        } else if (nBaseId === 0x21f) {
          const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
          if (pMonData !== 0) {
            const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
            if (pAiGen !== 0) {
              m.setU32((pAiGen + 0x14) >>> 0, m.u32((pPresetUnit + 0x4c) >>> 0))
            }
          }
        }
      }
    }
  }

  if (nClassId === 0x138) {
    if ((m.u32(pMonster >>> 0) >>> 0) === 1) {
      const bVal = m.u8((pPresetUnit + 0x4c) >>> 0)
      const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        m.setU8((pMonData + 0x0e) >>> 0, bVal)
        m.setU8((pMonData + 0x0f) >>> 0, bVal)
      }
    }
  } else if (nClassId === 0x137) {
    if ((m.u32(pMonster >>> 0) >>> 0) === 1) {
      const bVal = m.u8((pPresetUnit + 0x4c) >>> 0)
      const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        m.setU8((pMonData + 0x0e) >>> 0, bVal)
      }
    }
  }

  void pGame
  const dwSentinel = (m.u32(0x6fd2e5fc) >>> 0) !== 0 ? (m.u32(0x6fd2e5fc) >>> 0) : 0xdeaddead
  if ((m.u32((pPresetUnit + 0x4c) >>> 0) >>> 0) === dwSentinel) {
    const dwFlagMask1 = (m.u32(0x6fd2e600) >>> 0) !== 0 ? (m.u32(0x6fd2e600) >>> 0) : 1
    const dwFlagMask2 = (m.u32(0x6fd2e604) >>> 0) !== 0 ? (m.u32(0x6fd2e604) >>> 0) : 2
    const dwPresetFlags = m.u32((pPresetUnit + 0x50) >>> 0) >>> 0
    if ((dwPresetFlags & dwFlagMask1) !== 0) {
      m.setU32((pMonster + 0xc4) >>> 0, (m.u32((pMonster + 0xc4) >>> 0) | 0x4000000) >>> 0)
    }
    if ((dwPresetFlags & dwFlagMask2) !== 0) {
      m.setU32((pMonster + 0xc4) >>> 0, (m.u32((pMonster + 0xc4) >>> 0) | 0x20000) >>> 0)
    }
  }
}

/**
 * [5/45] Restores an inactive ground item and its socketed child items from an inactive
 * item node (`+0x04 = dwExpireFrame`, `+0x0C = u16 nLen`, `+0x0E = bitstream`), clamps
 * non-zero expiry to `dwGameFrame + 0x3A98`, places sockets, and activates equipped stats.
 *
 * @va D2Game:0x6FC3F9F0
 */
export function ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pOwner: number,
  pInactiveItemNode: number,
): number {
  hitD2GameVa113c(0x6FC3F9F0)
  let nRemLen = m.u16((pInactiveItemNode + 0x0c) >>> 0)
  let pBuf = (pInactiveItemNode + 0x0e) >>> 0

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x38) >>> 0
  try {
    const pItemSave = sp
    const pBytesRead = (sp + 0x30) >>> 0
    m.fill(sp, 0x38, 0)

    ITEMS_DecodeItemCompactBitstreamV96_113c(m, pBuf, nRemLen, 1, pItemSave)
    const pItem = ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(
      m,
      pGame,
      pItemSave,
      pOwner,
      pBuf,
      nRemLen,
      1,
      pBytesRead,
      0x60,
    ) >>> 0
    if (pItem === 0) return 0

    const nRead0 = m.u32(pBytesRead) | 0
    pBuf = (pBuf + nRead0) >>> 0
    nRemLen = (nRemLen - nRead0) | 0

    const nNodeExpire = m.u32((pInactiveItemNode + 0x04) >>> 0) | 0
    const pItemData = m.u32((pItem + 0x14) >>> 0) >>> 0
    const nMinExpire = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 0x3a98) | 0
    if (nNodeExpire !== 0 && nNodeExpire < nMinExpire) {
      m.setU32((pItemData + 0x24) >>> 0, nMinExpire >>> 0)
    } else {
      m.setU32((pItemData + 0x24) >>> 0, nNodeExpire >>> 0)
    }

    const nSocketCount = m.u32((pItemSave + 0x14) >>> 0) | 0
    if (nSocketCount !== 0) {
      let pInv = m.u32((pItem + 0x60) >>> 0) >>> 0
      if (pInv === 0) {
        pInv = INVENTORY_AllocInventory113c(m, 0, pItem) >>> 0
      }
      for (let i = 0; i < nSocketCount; i++) {
        ITEMS_DecodeItemCompactBitstreamV96_113c(m, pBuf, nRemLen, 1, pItemSave)
        const pChild = ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(
          m,
          pGame,
          pItemSave,
          0,
          pBuf,
          nRemLen,
          1,
          pBytesRead,
          0x60,
        ) >>> 0
        if (pChild === 0) {
          throw new D2CommonAssertError('SUnitInactive.cpp', 0x10d)
        }
        const nChildRead = m.u32(pBytesRead) | 0
        pBuf = (pBuf + nChildRead) >>> 0
        nRemLen = (nRemLen - nChildRead) | 0
        INVENTORY_PlaceItemInSocket113c(m, pInv, pChild, 1)
        ITEMS_ActivateEquippedItemStats113c(m, pItem, pChild, 0)
      }
    }

    return pItem
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [6/45] Serializes `pItem` into a newly allocated inactive item node (`+0x00=next`,
 * `+0x04=expireFrame`, `+0x08=cellOverwrite`, `+0x0C=u16 len`, `+0x0E=bitstream`),
 * frees socketed children when subType != 0, frees `pItem`, and links or stores the node.
 *
 * @va D2Game:0x6FC403D0
 */
export function ITEMS_SaveItemToNodeAndFree_6FC403D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pItem: number,
  pInactiveHolder: number,
  ppOutNode = 0,
): number {
  hitD2GameVa113c(0x6FC403D0)
  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x420) >>> 0
  let pSaved = 0
  try {
    m.fill(sp, 0x410, 0)
    const dwCell = ITEMS_GetCellOverwrite113c(m, pItem) >>> 0
    m.setU32((sp + 0x00) >>> 0, 0)
    m.setU32((sp + 0x08) >>> 0, dwCell)
    const nWritten =
      ITEMS_SerializeItemToBuffer113c(m, pItem, (sp + 0x0e) >>> 0, 0x400, 1, 1, 0) & 0xffff
    m.setU16((sp + 0x0c) >>> 0, nWritten)
    const dwExpire = ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, pGame, pItem) >>> 0
    m.setU32((sp + 0x04) >>> 0, dwExpire)

    const nAllocSize = (nWritten + 0x0f) | 0
    pSaved = m.alloc(nAllocSize) >>> 0
    for (let i = 0; i < nAllocSize; i++) {
      m.setU8((pSaved + i) >>> 0, m.u8((sp + i) >>> 0))
    }
  } finally {
    w3b2ScratchSp = sp
  }

  if (ITEMS_GetSubTypeFromItem113c(m, pItem) !== 0) {
    const pInv = m.u32((pItem + 0x60) >>> 0) >>> 0
    if (pInv !== 0) {
      let pChild = INVENTORY_GetFirstItem113c(m, pInv) >>> 0
      while (pChild !== 0) {
        const pNext = INVENTORY_GetNextItem113c(m, pChild) >>> 0
        const pChildUnit = INVENTORY_UnitIsItem113c(m, pChild) >>> 0
        INVENTORY_RemoveItemFromInventory113c(m, pInv, pChildUnit)
        SUNIT_FreeUnit113c(m, pGame, pChildUnit)
        pChild = pNext
      }
    }
  }

  SUNIT_FreeUnit113c(m, pGame, pItem)

  if (ppOutNode !== 0) {
    m.setU32(ppOutNode >>> 0, pSaved)
    return ppOutNode >>> 0
  }
  const holder = pInactiveHolder >>> 0
  if (holder !== 0) {
    const pOldHead = m.u32((holder + 0x08) >>> 0) >>> 0
    m.setU32(pSaved, pOldHead)
    m.setU32((holder + 0x08) >>> 0, pSaved)
  }
  return holder
}

/**
 * [7/45] Unlinks `pMinion` from its leader's minion list (`pLeaderAiGen + 0x34`) via
 * `pAiGen->pOwnerGame (+0x28)` / `dwOwnerId (+0x2C)` / `dwOwnerType (+0x30)` and resets
 * the minion's owner tracking fields when found in `pLeaderGame`'s monster hash table (`+0x1320`).
 *
 * @va D2Game:0x6FC416A0
 */
export function AIGENERAL_RemoveFromMinionList_6FC416A0_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pMinion: number,
): void {
  hitD2GameVa113c(0x6FC416A0)
  if (pMinion === 0) return
  if ((m.u32(pMinion >>> 0) >>> 0) !== 1) return
  const pMonData = m.u32((pMinion + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGen === 0) return

  const pOwnerGame = m.u32((pAiGen + 0x28) >>> 0) >>> 0
  if (pOwnerGame === 0) return
  const nOwnerId = m.u32((pAiGen + 0x2c) >>> 0) | 0
  const nOwnerType = m.u32((pAiGen + 0x30) >>> 0) | 0

  const pLeader = SUNIT_GetServerUnit113c(m, pOwnerGame, nOwnerType, nOwnerId) >>> 0
  if (pLeader === 0 || (m.u32(pLeader) >>> 0) !== 1) return
  const pLeaderMonData = m.u32((pLeader + 0x14) >>> 0) >>> 0
  const pLeaderAiGen = pLeaderMonData !== 0 ? (m.u32((pLeaderMonData + 0x28) >>> 0) >>> 0) : 0
  if (pLeaderAiGen === 0) return

  let pCurNode = m.u32((pLeaderAiGen + 0x34) >>> 0) >>> 0
  if (pCurNode === 0) return

  const dwMinionGuid = m.u32((pMinion + 0x0c) >>> 0) >>> 0
  const pLeaderGame = m.u32((pLeaderAiGen + 0x28) >>> 0) >>> 0
  let pPrevNode = 0

  while (pCurNode !== 0) {
    if ((m.u32(pCurNode) >>> 0) === dwMinionGuid) {
      if (pLeaderGame === 0) {
        throw new D2CommonAssertError('AiGeneral.cpp', 0x2d3)
      }
      const dwNodeGuid = m.u32(pCurNode) >>> 0
      const bucketIdx = dwNodeGuid & 0x7f
      let pFound = m.u32((pLeaderGame + 0x1320 + bucketIdx * 4) >>> 0) >>> 0
      while (pFound !== 0) {
        if ((m.u32((pFound + 0x0c) >>> 0) >>> 0) === dwNodeGuid) {
          if ((m.u32(pFound) >>> 0) === 1) {
            const pFoundMonData = m.u32((pFound + 0x14) >>> 0) >>> 0
            const pFoundAiGen =
              pFoundMonData !== 0 ? (m.u32((pFoundMonData + 0x28) >>> 0) >>> 0) : 0
            if (pFoundAiGen !== 0) {
              m.setU32((pFoundAiGen + 0x2c) >>> 0, 0xffffffff)
              m.setU32((pFoundAiGen + 0x30) >>> 0, 1)
              m.setU32((pFoundAiGen + 0x28) >>> 0, pLeaderGame)
            }
          }
          break
        }
        pFound = m.u32((pFound + 0xe4) >>> 0) >>> 0
      }

      const pNext = m.u32((pCurNode + 0x04) >>> 0) >>> 0
      if (pPrevNode !== 0) {
        m.setU32((pPrevNode + 0x04) >>> 0, pNext)
      } else {
        m.setU32((pLeaderAiGen + 0x34) >>> 0, pNext)
      }
      return
    }
    pPrevNode = pCurNode
    pCurNode = m.u32((pCurNode + 0x04) >>> 0) >>> 0
  }
}

/**
 * [8/45] Sets monster level (`0x0C`), attack rating (`0x13`), and physical/elemental
 * damage stats on `pMonster`'s statlist for champion/sentry monsters (`0x146..0x171`).
 *
 * @va D2Game:0x6FC418A0
 */
export function MONUMOD_ApplyChampionBaseStats_6FC418A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  _nUModId = 0,
  _bBoss = 0,
): void {
  hitD2GameVa113c(0x6FC418A0)
  let nMlvl = 2
  const pRoom = UNITS_GetRoom113c(m, pMonster) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId !== 0) {
    const bExpansion = m.u32((pGame + 0x70) >>> 0)
    const nDifficulty = m.u8((pGame + 0x6d) >>> 0)
    nMlvl = DATATBLS_GetLevelMonsterLevel113c(m, nLevelId, nDifficulty, bExpansion) | 0
    if (nMlvl <= 1) {
      nMlvl = 1
    }
  }
  let nToHit = (nMlvl + 0x32) | 0
  if (nToHit >= 0x5a) {
    nToHit = 0x5a
  }
  STATLIST_SetUnitStat113c(m, pMonster, 0x0c, nMlvl, 0)
  STATLIST_SetUnitStat113c(m, pMonster, 0x13, nToHit, 0)

  if (pMonster === 0 || (m.u32(pMonster >>> 0) >>> 0) !== 1) {
    throw new D2CommonAssertError('MonUMod.cpp', 0xc42)
  }

  const pStatList = STATLIST_GetStatListFromUnitAndFlag113c(m, pMonster, 1) >>> 0
  const nIdx = ((m.u32((pMonster + 0x04) >>> 0) | 0) - 0x146) >>> 0
  if (nIdx > 0x2b) return

  if (nIdx === 0) {
    STATLIST_SetStat113c(m, pStatList, 0x15, 0, 0)
    STATLIST_SetStat113c(m, pStatList, 0x16, 0, 0)
    STATLIST_SetStat113c(m, pStatList, 0x30, nMlvl >> 1, 0)
    STATLIST_SetStat113c(m, pStatList, 0x31, imul32(nMlvl, 3) >> 1, 0)
  } else if (nIdx === 1 || nIdx === 2) {
    let nMin = ((nMlvl >> 1) + 1) | 0
    if (nMlvl < nMin) nMin = nMlvl
    STATLIST_SetStat113c(m, pStatList, 0x15, nMin, 0)
    STATLIST_SetStat113c(m, pStatList, 0x16, nMlvl, 0)
  } else if (nIdx === 3) {
    STATLIST_SetStat113c(m, pStatList, 0x15, 0, 0)
    STATLIST_SetStat113c(m, pStatList, 0x16, 0, 0)
    STATLIST_SetStat113c(m, pStatList, 0x39, nMlvl, 0)
    STATLIST_SetStat113c(m, pStatList, 0x3a, (nMlvl * 2) | 0, 0)
    STATLIST_SetStat113c(m, pStatList, 0x3b, (nMlvl * 2) | 0, 0)
  } else if (nIdx === 4 || nIdx === 0x2b) {
    STATLIST_SetStat113c(m, pStatList, 0x15, 0, 0)
    STATLIST_SetStat113c(m, pStatList, 0x16, 0, 0)
    STATLIST_SetStat113c(m, pStatList, 0x32, nMlvl >> 1, 0)
    STATLIST_SetStat113c(m, pStatList, 0x33, imul32(nMlvl, 3) >> 1, 0)
  }
}

/**
 * [9/45] Applies resistance bonuses (and doubles defense `stat 0x1F` for `0x1C` Stone Skin)
 * for monster UMods (`0x08`, `0x09`, `0x11`, `0x12`, `0x17`, `0x19`, `0x1B`, `0x1C`) while
 * enforcing the 2-immunity (`>= 100`) cap across `[0x27, 0x29, 0x2B, 0x2D, 0x24, 0x25]`.
 *
 * @va D2Game:0x6FC41BE0
 */
export function MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(
  m: D2KernMemory113c,
  pMonster: number,
  nUModId: number,
  bBoss: number,
): void {
  hitD2GameVa113c(0x6FC41BE0)
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  if (bBoss === 0) return

  const mod = nUModId | 0
  if (mod === 0x1c) {
    const nDef = STATLIST_GetUnitStat113c(m, pMonster, 0x1f, 0) | 0
    STATLIST_SetUnitStat113c(m, pMonster, 0x1f, (nDef << 1) | 0, 0)
  }

  let nFireRes = STATLIST_GetUnitStat113c(m, pMonster, 0x27, 0) | 0
  let nLightRes = STATLIST_GetUnitStat113c(m, pMonster, 0x29, 0) | 0
  let nColdRes = STATLIST_GetUnitStat113c(m, pMonster, 0x2b, 0) | 0
  let nPoisonRes = STATLIST_GetUnitStat113c(m, pMonster, 0x2d, 0) | 0
  let nPhysRes = STATLIST_GetUnitStat113c(m, pMonster, 0x24, 0) | 0
  let nMagicRes = STATLIST_GetUnitStat113c(m, pMonster, 0x25, 0) | 0

  let nImmuneCount = 0
  if (nFireRes >= 0x64) nImmuneCount = 1
  if (nLightRes >= 0x64) nImmuneCount++
  if (nColdRes >= 0x64) nImmuneCount++
  if (nPoisonRes >= 0x64) nImmuneCount++
  if (nPhysRes >= 0x64) nImmuneCount++
  if (nMagicRes >= 0x64) nImmuneCount++

  if (nImmuneCount >= 2) return

  if (mod === 0x08) {
    if (nColdRes < 0x64) {
      nColdRes = (nColdRes + 0x28) | 0
      STATLIST_SetUnitStat113c(m, pMonster, 0x2b, nColdRes, 0)
      if (nColdRes >= 0x64) nImmuneCount++
    }
    if (nImmuneCount >= 2) return
    if (nFireRes < 0x64) {
      nFireRes = (nFireRes + 0x28) | 0
      STATLIST_SetUnitStat113c(m, pMonster, 0x27, nFireRes, 0)
      if (nFireRes >= 0x64) nImmuneCount++
    }
    if (nImmuneCount >= 2) return
    if (nLightRes < 0x64) {
      nLightRes = (nLightRes + 0x28) | 0
      STATLIST_SetUnitStat113c(m, pMonster, 0x29, nLightRes, 0)
    }
    return
  }
  if (mod === 0x09) {
    STATLIST_SetUnitStat113c(m, pMonster, 0x27, (nFireRes + 0x4b) | 0, 0)
    return
  }
  if (mod === 0x12) {
    STATLIST_SetUnitStat113c(m, pMonster, 0x2b, (nColdRes + 0x4b) | 0, 0)
    return
  }
  if (mod === 0x11) {
    STATLIST_SetUnitStat113c(m, pMonster, 0x29, (nLightRes + 0x4b) | 0, 0)
    return
  }
  if (mod === 0x17) {
    STATLIST_SetUnitStat113c(m, pMonster, 0x2d, (nPoisonRes + 0x4b) | 0, 0)
    return
  }
  if (mod === 0x19) {
    STATLIST_SetUnitStat113c(m, pMonster, 0x25, (nMagicRes + 0x14) | 0, 0)
    return
  }
  if (mod === 0x1b) {
    if (nColdRes < 0x4b) {
      nColdRes = (nColdRes + 0x14) | 0
      STATLIST_SetUnitStat113c(m, pMonster, 0x2b, nColdRes, 0)
      if (nColdRes >= 0x64) nImmuneCount++
    }
    if (nImmuneCount >= 2) return
    if (nFireRes < 0x4b) {
      nFireRes = (nFireRes + 0x14) | 0
      STATLIST_SetUnitStat113c(m, pMonster, 0x27, nFireRes, 0)
      if (nFireRes >= 0x64) nImmuneCount++
    }
    if (nImmuneCount >= 2) return
    if (nLightRes < 0x4b) {
      nLightRes = (nLightRes + 0x14) | 0
      STATLIST_SetUnitStat113c(m, pMonster, 0x29, nLightRes, 0)
    }
    return
  }
  if (mod === 0x1c) {
    STATLIST_SetUnitStat113c(m, pMonster, 0x24, (nPhysRes + 0x32) | 0, 0)
  }
}

const ELEM_STAT_TRIPLES_6FD1CE00: readonly (readonly [number, number, number])[] = [
  [0x30, 0x31, -1],
  [0x32, 0x33, -1],
  [0x36, 0x37, 0x38],
  [0x39, 0x3a, 0x3b],
  [0x34, 0x35, -1],
]

/**
 * [10/45] Applies elemental damage bonus stats `(nMinStatId, nMaxStatId, nLenStatId)` from
 * `MonLvl.txt` (`stride 0x78`, column `nDiff + (bExp + 6) * 3`) scaled by `MonUMod` constants
 * `0x1C` (`+0x380`) and `0x1F` (`+0x3E0`), plus `+40` (`0x28`) length when `nLenStatId != -1`.
 *
 * Accepts both the exact 6-arg binary signature `(m, pGame, pUnit, nMinStatId, nMaxStatId, nLenStatId)`
 * and the 4-arg element-index wrapper `(m, pUnit, nElemType, bBoss)`.
 *
 * @va D2Game:0x6FC41FE0
 */
export function MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c(
  m: D2KernMemory113c,
  arg1: number,
  arg2: number,
  arg3: number,
  arg4?: number,
  arg5?: number,
): void {
  hitD2GameVa113c(0x6FC41FE0)
  let pGame: number
  let pUnit: number
  let nMinStatId: number
  let nMaxStatId: number
  let nLenStatId: number

  if (arg4 !== undefined) {
    pGame = arg1 >>> 0
    pUnit = arg2 >>> 0
    nMinStatId = arg3 | 0
    nMaxStatId = arg4 | 0
    nLenStatId = arg5 !== undefined ? arg5 | 0 : -1
  } else {
    pUnit = arg1 >>> 0
    pGame = pUnit !== 0 ? (m.u32((pUnit + 0x80) >>> 0) >>> 0) : 0
    const elemIdx = arg2 | 0
    const triple =
      elemIdx >= 0 && elemIdx < ELEM_STAT_TRIPLES_6FD1CE00.length
        ? ELEM_STAT_TRIPLES_6FD1CE00[elemIdx]!
        : ELEM_STAT_TRIPLES_6FD1CE00[0]!
    nMinStatId = triple[0]
    nMaxStatId = triple[1]
    nLenStatId = triple[2]
  }

  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 3) {
    const nMisId = m.u32((pUnit + 0x04) >>> 0) | 0
    if (nMisId < 0 || pDataTables === 0 || nMisId >= (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) {
      return
    }
    const pMisTxt = (m.u32((pDataTables + 0xb64) >>> 0) + imul32(nMisId, 0x1a4)) >>> 0
    if (pMisTxt === 0) return
    const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
    const maskByte = pMasks !== 0 ? m.u8((pMasks + 0x14) >>> 0) : 0x20
    if ((m.u8((pMisTxt + 0x05) >>> 0) & maskByte) !== 0) return
  }

  if (pGame === 0 || pDataTables === 0) return

  let nDiff = m.u8((pGame + 0x6d) >>> 0)
  if (nDiff <= 0) nDiff = 0
  else if (nDiff >= 2) nDiff = 2

  const bExp = m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0 ? 1 : 0

  let nLvl = STATLIST_GetUnitStat113c(m, pUnit, 0x0c, 0) | 0
  const nMonLvlCount = m.u32((pDataTables + 0xb74) >>> 0) | 0
  const nMaxLvlIdx = (nMonLvlCount - 1) | 0
  if (nLvl <= 1) nLvl = 1
  if (nLvl >= nMaxLvlIdx) nLvl = nMaxLvlIdx
  if (nLvl < 0 || nLvl >= nMonLvlCount) return

  const pMonLvlRec = (m.u32((pDataTables + 0xb70) >>> 0) + imul32(nLvl, 0x78)) >>> 0
  if (pMonLvlRec === 0) return

  const nColIdx = (nDiff + imul32((bExp + 6) | 0, 3)) | 0
  const nBaseDmg = m.u32((pMonLvlRec + imul32(nColIdx, 4)) >>> 0) | 0

  const nMonUModCount = m.u32((pDataTables + 0xc54) >>> 0) | 0
  const pMonUModBase = m.u32((pDataTables + 0xc50) >>> 0) >>> 0
  const nMinPct =
    nMonUModCount > 0x1c && pMonUModBase !== 0
      ? m.u32((pMonUModBase + 0x380 + 0x1c) >>> 0) | 0
      : 0
  const nMaxPct =
    nMonUModCount > 0x1f && pMonUModBase !== 0
      ? m.u32((pMonUModBase + 0x3e0 + 0x1c) >>> 0) | 0
      : 0

  const nMinVal = Math.trunc(imul32(nMinPct, nBaseDmg) / 100) | 0
  const nMaxVal = Math.trunc(imul32(nMaxPct, nBaseDmg) / 100) | 0

  let pList = 0
  const bIsMonster = pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 1
  if (bIsMonster) {
    pList = STATLIST_GetStatListFromUnitAndFlag113c(m, pUnit, 1) >>> 0
    STATLIST_SetStat113c(m, pList, nMinStatId, nMinVal, 0)
    STATLIST_SetStat113c(m, pList, nMaxStatId, nMaxVal, 0)
  } else {
    STATLIST_SetUnitStat113c(m, pUnit, nMinStatId, nMinVal, 0)
    STATLIST_SetUnitStat113c(m, pUnit, nMaxStatId, nMaxVal, 0)
  }

  if (nLenStatId !== -1) {
    const nLenVal = ((STATLIST_GetUnitStat113c(m, pUnit, nLenStatId, 0) | 0) + 0x28) | 0
    if (bIsMonster) {
      STATLIST_SetStat113c(m, pList, nLenStatId, nLenVal, 0)
    } else {
      STATLIST_SetUnitStat113c(m, pUnit, nLenStatId, nLenVal, 0)
    }
  }
}

/**
 * [11/45] Applies Strong UMod (`0x05`) enhanced damage (`stat 0x19`) and attack rating (`stat 0x77`)
 * bonuses from `MonUMod.txt` constants (`0x0F`/`0x0D` for boss, `0x0E`/`0x0C` for minion), scaled by
 * `DifficultyLevelsTxt->dwMonsterDamageBonus` (`+0x34`) and halving damage for base class `0x76`.
 *
 * @va D2Game:0x6FC42BC0
 */
export function MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c(
  m: D2KernMemory113c,
  pMonster: number,
  _nUModId: number,
  bBoss: number,
): void {
  hitD2GameVa113c(0x6FC42BC0)
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  const pGame = m.u32((pMonster + 0x80) >>> 0) >>> 0
  if (pGame === 0) return

  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  const nMonUModCount = pDataTables !== 0 ? (m.u32((pDataTables + 0xc54) >>> 0) | 0) : 0
  const pMonUModBase = pDataTables !== 0 ? (m.u32((pDataTables + 0xc50) >>> 0) >>> 0) : 0

  let nDmgBonus: number
  let nThBonus: number
  if (bBoss !== 0) {
    nDmgBonus =
      nMonUModCount > 0x0f && pMonUModBase !== 0
        ? m.u32((pMonUModBase + 0x1e0 + 0x1c) >>> 0) | 0
        : 0
    nThBonus =
      nMonUModCount > 0x0d && pMonUModBase !== 0
        ? m.u32((pMonUModBase + 0x1a0 + 0x1c) >>> 0) | 0
        : 0
  } else {
    nDmgBonus =
      nMonUModCount > 0x0e && pMonUModBase !== 0
        ? m.u32((pMonUModBase + 0x1c0 + 0x1c) >>> 0) | 0
        : 0
    nThBonus =
      nMonUModCount > 0x0c && pMonUModBase !== 0
        ? m.u32((pMonUModBase + 0x180 + 0x1c) >>> 0) | 0
        : 0
  }

  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pDiffRec = DATATBLS_GetMonLvlTxtRecord113c(m, nDiff) >>> 0
  if (pDiffRec !== 0) {
    const nMult = m.u32((pDiffRec + 0x34) >>> 0) | 0
    nDmgBonus = Math.trunc(imul32(nMult, nDmgBonus) / 100) | 0
    nThBonus = Math.trunc(imul32(nMult, nThBonus) / 100) | 0
    const nBaseId = MONSTER_GetBaseIdFromUnit113c(m, pMonster) | 0
    if (
      nBaseId >= 0 &&
      pDataTables !== 0 &&
      nBaseId < (m.u32((pDataTables + 0xa80) >>> 0) | 0) &&
      nBaseId === 0x76
    ) {
      nDmgBonus = Math.trunc(nDmgBonus / 2) | 0
    }
  }

  STATLIST_AddUnitStatMemPort113c(m, pMonster, 0x19, nDmgBonus, 0)
  STATLIST_AddUnitStatMemPort113c(m, pMonster, 0x77, nThBonus, 0)
}

/**
 * [12/45] Applies Ghostly/Champion UMod (`0x27`) life scaling (`-75%`) and `+300%`
 * damage/attack rating bonus scaled by `DifficultyLevelsTxt->+0x34` (halving damage
 * for base class `0x76`), only when `bBoss != 0`.
 *
 * @va D2Game:0x6FC42D00
 */
export function MONUMOD_ApplyGhostlyStats_6FC42D00_113c(
  m: D2KernMemory113c,
  pMonster: number,
  _nUModId = 0,
  bBoss = 0,
): void {
  hitD2GameVa113c(0x6FC42D00)
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  const pGame = m.u32((pMonster + 0x80) >>> 0) >>> 0
  if (pGame === 0) return
  if (bBoss === 0) return

  MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c(m, pMonster, -0x4b)

  let nDmgBonus = 0x12c
  let nThBonus = 0x12c
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pDiffRec = DATATBLS_GetMonLvlTxtRecord113c(m, nDiff) >>> 0
  if (pDiffRec !== 0) {
    const nMult = m.u32((pDiffRec + 0x34) >>> 0) | 0
    nDmgBonus = Math.trunc(imul32(nMult, 0x12c) / 100) | 0
    nThBonus = nDmgBonus
    const nBaseId = MONSTATS_ValidateClassId113c(m, MONSTER_GetBaseIdFromUnit113c(m, pMonster)) | 0
    if (nBaseId === 0x76) {
      nDmgBonus = Math.trunc(nDmgBonus / 2) | 0
    }
  }

  STATLIST_AddUnitStatMemPort113c(m, pMonster, 0x19, nDmgBonus, 0)
  STATLIST_AddUnitStatMemPort113c(m, pMonster, 0x77, nThBonus, 0)
}

/**
 * [13/45] Applies Champion/Fanatic/Possessed UMod stat adjustments (`bBoss != 0`):
 * decrements level (`0x0C`) by `1`, scales experience (`stat 0x0D`) by `3/5`, adds damage/tohit
 * from `MonUMod` constants `0x0B`/`0x0A` scaled by `DifficultyLevelsTxt->+0x34`, and adjusts
 * velocity (`stat 0x43`) according to `nUModId` (`0x24`, `0x25`, or default `+20`).
 *
 * @va D2Game:0x6FC42DA0
 */
export function MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c(
  m: D2KernMemory113c,
  pMonster: number,
  nUModId = 0,
  bBoss = 0,
): void {
  hitD2GameVa113c(0x6FC42DA0)
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  const pGame = m.u32((pMonster + 0x80) >>> 0) >>> 0
  if (pGame === 0) return

  const nClassId = m.u32((pMonster + 0x04) >>> 0) | 0
  if (nClassId < 0) return
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (pDataTables === 0 || nClassId >= (m.u32((pDataTables + 0xa80) >>> 0) | 0)) return
  const pMonStatsTxt = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(nClassId, 0x1a8)) >>> 0
  if (pMonStatsTxt === 0) return
  if (bBoss === 0) return

  const nCurLvl = STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0
  STATLIST_SetUnitStat113c(m, pMonster, 0x0c, (nCurLvl - 1) | 0, 0)

  const uCurExp = STATLIST_GetUnitBaseStat113c(m, pMonster, 0x0d, 0) >>> 0
  const nNewExp = (uCurExp - ((Math.floor(uCurExp / 5) << 1) >>> 0)) | 0
  STATLIST_SetUnitStat113c(m, pMonster, 0x0d, nNewExp, 0)

  const nMonUModCount = m.u32((pDataTables + 0xc54) >>> 0) | 0
  const pMonUModBase = m.u32((pDataTables + 0xc50) >>> 0) >>> 0
  let nDmgBonus =
    nMonUModCount > 0x0b && pMonUModBase !== 0
      ? m.u32((pMonUModBase + 0x160 + 0x1c) >>> 0) | 0
      : 0
  let nThBonus =
    nMonUModCount > 0x0a && pMonUModBase !== 0
      ? m.u32((pMonUModBase + 0x140 + 0x1c) >>> 0) | 0
      : 0

  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pDiffRec = DATATBLS_GetMonLvlTxtRecord113c(m, nDiff) >>> 0
  if (pDiffRec !== 0) {
    const nMult = m.u32((pDiffRec + 0x34) >>> 0) | 0
    nDmgBonus = Math.trunc(imul32(nMult, nDmgBonus) / 100) | 0
    nThBonus = Math.trunc(imul32(nMult, nThBonus) / 100) | 0
    const nBaseId = MONSTATS_ValidateClassId113c(m, MONSTER_GetBaseIdFromUnit113c(m, pMonster)) | 0
    if (nBaseId === 0x76) {
      nDmgBonus = Math.trunc(nDmgBonus / 2) | 0
    }
  }

  STATLIST_AddUnitStatMemPort113c(m, pMonster, 0x19, nDmgBonus, 0)
  STATLIST_AddUnitStatMemPort113c(m, pMonster, 0x77, nThBonus, 0)

  const wVel = sx16(m.u16((pMonStatsTxt + 0x32) >>> 0))
  if (wVel <= 0) return

  const mod = nUModId | 0
  if (mod === 0x24) return
  if (mod === 0x25) {
    let nVelAdd = (Math.trunc(0x800 / wVel) - 0x80) | 0
    if (nVelAdd <= 0x0a) nVelAdd = 0x0a
    else if (nVelAdd >= 0x64) nVelAdd = 0x64
    STATLIST_AddUnitStatMemPort113c(m, pMonster, 0x43, nVelAdd, 0)
    return
  }
  STATLIST_AddUnitStatMemPort113c(m, pMonster, 0x43, 0x14, 0)
}

/**
 * [14/45] Scales monster max and current life using `MONUMOD_GetConstantValue113c`:
 * `nDiff + 1` for minions (`bBoss == 0`), or `nDiff + 4` (champion flag `4`) / `nDiff + 7`
 * (unique boss) plus zeroing `stat 0x4A` (`hpregen = 0`) when `bBoss != 0`.
 *
 * @va D2Game:0x6FC42FA0
 */
export function MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c(
  m: D2KernMemory113c,
  pMonster: number,
  _nUModId: number,
  bBoss: number,
): void {
  hitD2GameVa113c(0x6FC42FA0)
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) >>> 0) !== 1) return
  const pGame = m.u32((pMonster + 0x80) >>> 0) >>> 0
  if (pGame === 0) return

  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  if (nDiff >= 3) return

  if (bBoss === 0) {
    const nPct = MONUMOD_GetConstantValue113c(m, (nDiff + 1) | 0) | 0
    MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c(m, pMonster, nPct)
    return
  }

  const nConstIdx =
    MONSTER_CheckTypeFlagsMask113c(m, pMonster, 4) !== 0 ? (nDiff + 4) | 0 : (nDiff + 7) | 0
  const nPct = MONUMOD_GetConstantValue113c(m, nConstIdx) | 0
  MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c(m, pMonster, nPct)
  STATLIST_SetUnitStat113c(m, pMonster, 0x4a, 0, 0)
}

/**
 * [15/45] Checks whether `pMonster` is eligible for a `D2MonUModTxt` record according to
 * `bEnabled (+0x06)`, `wVersion (+0x04)`, `wExclude[0..1] (+0x0A/+0x0C)`, and `bFPick (+0x09)`
 * (`1`: mode bit `4`, `2`: not MonStats `+0x0C` bit 1 and not flag bit `0x11`, `3`: mode bit `2`).
 *
 * Accepts both the exact 4-arg binary signature `(m, pMonster, pMonUModRec, bExpansion)` and
 * the 5-arg legacy wrapper `(m, pMonster, pGame, nUModId, bCheckRandomPick)`.
 *
 * @va D2Game:0x6FC43100
 */
export function MONUMOD_CheckModEligibility_6FC43100_113c(
  m: D2KernMemory113c,
  pMonster: number,
  arg2: number,
  arg3: number,
  arg4?: number,
): number {
  hitD2GameVa113c(0x6FC43100)
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  let pRec: number
  let bExpansion: number

  if (arg4 !== undefined) {
    const idx = arg3 | 0
    if (idx <= 0 || pDataTables === 0 || idx >= (m.u32((pDataTables + 0xc54) >>> 0) | 0)) {
      return 0
    }
    pRec = (m.u32((pDataTables + 0xc50) >>> 0) + (idx << 5)) >>> 0
    bExpansion = m.u32((arg2 + 0x70) >>> 0) | 0
  } else {
    pRec = arg2 >>> 0
    bExpansion = arg3 | 0
  }

  if (pRec === 0) return 0
  if (m.u8((pRec + 0x06) >>> 0) === 0) return 0
  if (bExpansion === 0 && m.u16((pRec + 0x04) >>> 0) >= 0x64) return 0

  for (let i = 0; i < 2; i++) {
    const wExcl = sx16(m.u16((pRec + 0x0a + i * 2) >>> 0))
    if (wExcl <= 0) break
    if (MONSTER_TestUnitMonTypeFlag_6FC22790_113c(m, pMonster, wExcl) !== 0) {
      return 0
    }
  }

  const nFPick = m.u8((pRec + 0x09) >>> 0)
  const nClassId = pMonster !== 0 ? (m.u32((pMonster + 0x04) >>> 0) | 0) : -1
  if (nFPick === 1) {
    return MONSTATS2_CheckModeBit113c(m, nClassId, 4) !== 0 ? 1 : 0
  }
  if (nFPick === 2) {
    if (pMonster !== 0 && nClassId >= 0 && pDataTables !== 0) {
      if (nClassId < (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
        const pMonStats = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(nClassId, 0x1a8)) >>> 0
        if (pMonStats !== 0) {
          const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
          const bit1 = pMasks !== 0 ? m.u32((pMasks + 4) >>> 0) : 2
          if ((m.u8((pMonStats + 0x0c) >>> 0) & bit1) !== 0) {
            return 0
          }
        }
      }
    }
    return MONSTATS_CheckFlagBit113c(m, nClassId, 0x11) !== 0 ? 0 : 1
  }
  if (nFPick === 3) {
    return MONSTATS2_CheckModeBit113c(m, nClassId, 2) !== 0 ? 1 : 0
  }
  return 1
}

/**
 * [16/45] Handles the periodic self-revive / corpse check timer event (`event 7`)
 * for Reanimated Horde / self-resurrecting monsters: frees type-2 events (`+0x24`),
 * checks death mode / state mask 33 / boss bit 8 / alignment 2 / collision `0x3C01`
 * (rescheduling event `7` at `dwGameFrame + aipar1[diff]*10 + 1`), or casts skill
 * `0x125` with mode `8`, clears flags `0x04020000`, increments `pAiGen+0x14`, and
 * schedules event `2` at `dwGameFrame + 0x33`.
 *
 * @va D2Game:0x6FC43E20
 */
export function MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  hooks?: K2W3B2Hooks113c,
): number {
  hitD2GameVa113c(0x6FC43E20)
  let pMonStatsTxt = 0
  if (pUnit !== 0) {
    const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
    const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
    if (nClassId >= 0 && pDataTables !== 0 && nClassId < (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
      pMonStatsTxt = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(nClassId, 0x1a8)) >>> 0
    }

    let pNode = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pNode !== 0) {
      const pNext = m.u32((pNode + 0x24) >>> 0) >>> 0
      if ((m.u8(pNode) & 0xff) === 2) {
        EVENT_FreeNode113c(m, pGame, pNode)
      }
      pNode = pNext
    }

    if ((m.u8((pUnit + 0xc6) >>> 0) & 1) === 0) {
      const uType = m.u32(pUnit >>> 0) | 0
      const nMode = m.u32((pUnit + 0x10) >>> 0) | 0
      if (uType === 0) {
        if (nMode !== 0 && nMode !== 0x11) return 1
      } else if (uType === 1) {
        if (nMode !== 0 && nMode !== 0x0c) return 1
      }
    }
  }

  if (STATES_CheckStateMask33OnUnit113c(m, pUnit) !== 0) return 1

  if (pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 8) !== 0) {
      return 1
    }
  }

  if ((UNIT_GetAlignment113c(m, pUnit) | 0) === 2) return 1

  const nY = UNIT_GetPosY113c(m, pUnit) | 0
  const nX = UNIT_GetPosX113c(m, pUnit) | 0
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  const wCol = COLLISION_GetMaskWithPattern2_113c(m, pRoom, nX, nY, 1, 0x3c01) & 0xffff
  if (wCol !== 0) {
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    const wParam = pMonStatsTxt !== 0 ? sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0)) : 0
    const nNextFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + imul32(wParam, 10) + 1) | 0
    EVENT_SetEventFull113c(m, pGame, pUnit, 7, nNextFrame >>> 0, 0, 0, 0)
    return 1
  }

  if (pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGen !== 0 && (m.u32((pAiGen + 0x14) >>> 0) | 0) >= 2) {
        return 1
      }
    }
  }

  if (SKILLS_IsSelectableCorpseWithVelocity113c(m, pUnit, 0) === 0) return 1
  if ((UNIT_GetAlignment113c(m, pUnit) | 0) !== 0) return 1

  AI_CastSkillWithMode113c(
    m,
    8,
    pUnit,
    pGame,
    0x125,
    0,
    0,
    0,
    undefined,
    hooks !== undefined ? hooks.aiFallen : undefined,
  )

  let nReviveCount = 0
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) & 0xfbfdffff) >>> 0)
    if ((m.u32(pUnit >>> 0) >>> 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
        if (pAiGen !== 0) {
          nReviveCount = m.u32((pAiGen + 0x14) >>> 0) | 0
          m.setU32((pAiGen + 0x14) >>> 0, (nReviveCount + 1) >>> 0)
        }
      }
    }
    let pNode = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pNode !== 0) {
      const pNext = m.u32((pNode + 0x24) >>> 0) >>> 0
      if ((m.u8(pNode) & 0xff) === 2) {
        EVENT_FreeNode113c(m, pGame, pNode)
      }
      pNode = pNext
    }
  }

  const nNextEvent2Frame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 0x33) | 0
  EVENT_SetEventFull113c(m, pGame, pUnit, 2, nNextEvent2Frame >>> 0, 0, 0, 0)
  return 1
}

/**
 * [17/45] Applies Cursed UMod Amplify Damage (`skill 0x42`) state/statlist to `pTarget`
 * when `pAttacker` and `pTarget` are hostile (`SUNIT_AreUnitsHostileOrUnaligned113c`),
 * evaluating `SkillsTxt[0x42]` duration (`+0x60`), aura stat 0 (`+0x54`/`+0x68`), and
 * secondary aura stats `1..5` (`+0x56..+0x5E` / `+0x6C..+0x7C`).
 *
 * @va D2Game:0x6FC44030
 */
export function MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  pTarget: number,
  nSkillLevel = 1,
): void {
  hitD2GameVa113c(0x6FC44030)
  if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pAttacker, pTarget, pGame) === 0) return

  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (pDataTables === 0 || (m.u32((pDataTables + 0xba0) >>> 0) | 0) <= 0x42) return
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + 0x9378) >>> 0
  if (pSkillsTxt === 0) return

  const wAuraStat0 = sx16(m.u16((pSkillsTxt + 0x54) >>> 0))
  const nItemStatCostCount = m.u32((pDataTables + 0xbd4) >>> 0) | 0
  if (wAuraStat0 < -1 || wAuraStat0 >= nItemStatCostCount) return

  const wAuraTargetState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
  const nStatesCount = m.u32((pDataTables + 0xc4) >>> 0) | 0
  if (wAuraTargetState < 0 || wAuraTargetState >= nStatesCount) return

  const slvl = nSkillLevel | 0
  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x28) >>> 0
  try {
    m.fill(sp, 0x24, 0)
    const nDuration =
      SKILLS_EvalCalcByOffset113c(m, pAttacker, m.u32((pSkillsTxt + 0x60) >>> 0) | 0, 0x42, slvl) | 0
    const nStat0Val =
      SKILLS_EvalCalcByOffset113c(m, pAttacker, m.u32((pSkillsTxt + 0x68) >>> 0) | 0, 0x42, slvl) | 0

    m.setU32((sp + 0x00) >>> 0, pAttacker >>> 0)
    m.setU32((sp + 0x04) >>> 0, pTarget >>> 0)
    m.setU32((sp + 0x08) >>> 0, 0x42)
    m.setU32((sp + 0x0c) >>> 0, slvl >>> 0)
    m.setU32((sp + 0x10) >>> 0, nDuration >>> 0)
    m.setU32((sp + 0x14) >>> 0, wAuraStat0 >>> 0)
    m.setU32((sp + 0x18) >>> 0, nStat0Val >>> 0)
    m.setU32((sp + 0x1c) >>> 0, wAuraTargetState >>> 0)
    m.setU32((sp + 0x20) >>> 0, 0)

    const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, sp) >>> 0
    if (pStatList !== 0) {
      for (let i = 0; i < 5; i++) {
        const wStat = sx16(m.u16((pSkillsTxt + 0x56 + i * 2) >>> 0))
        if (wStat < 0) continue
        const pCurTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
        if (pCurTables === 0 || wStat >= (m.u32((pCurTables + 0xbd4) >>> 0) | 0)) continue
        const nCalcVal =
          SKILLS_EvalCalcByOffset113c(
            m,
            pAttacker,
            m.u32((pSkillsTxt + 0x6c + i * 4) >>> 0) | 0,
            0x42,
            slvl,
          ) | 0
        if (nCalcVal !== 0) {
          STATLIST_SetStat113c(m, pStatList, wStat, nCalcVal, 0)
        }
      }
    }
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [18/45] Spawns a boss monster's minion pack (`MONSTER_SpawnPackMember113c` /
 * `MONSTER_SpawnPartyMinionInRing113c` with `radius = 3`, `flags = 0x40`), copies
 * minion-eligible UMods, sets minion owner/leader fields (`+0x28/+0x2C/+0x30`, `+0x0C/+0x10`),
 * links each minion to the boss, and sets `bTypeFlags |= 0x10`.
 *
 * @va D2Game:0x6FC445A0
 */
export function MONUMOD_SpawnBossMinionPack_6FC445A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  _pRoom: number,
  pCoordNode: number,
  pBoss: number,
  hooks?: K2W3B2Hooks113c,
  nMinCount?: number,
  nMaxCount?: number,
): void {
  hitD2GameVa113c(0x6FC445A0)
  if (pBoss !== 0 && (m.u32(pBoss >>> 0) >>> 0) === 1) {
    const pBossMonData = m.u32((pBoss + 0x14) >>> 0) >>> 0
    if (pBossMonData !== 0 && (m.u8((pBossMonData + 0x16) >>> 0) & 4) !== 0) {
      return
    }
  }

  const nMinionClassId = MONUMOD_GetMinionClassIdForBoss113c(m, pBoss) | 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (
    nMinionClassId < 0 ||
    pDataTables === 0 ||
    nMinionClassId >= (m.u32((pDataTables + 0xa80) >>> 0) | 0)
  ) {
    return
  }

  let minC: number
  let maxC: number
  if (nMinCount !== undefined && nMaxCount !== undefined) {
    minC = nMinCount | 0
    maxC = nMaxCount | 0
  } else {
    const pMonStatsTxt = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(nMinionClassId, 0x1a8)) >>> 0
    minC = pMonStatsTxt !== 0 ? sx16(m.u16((pMonStatsTxt + 0x22) >>> 0)) : 0
    maxC = pMonStatsTxt !== 0 ? sx16(m.u16((pMonStatsTxt + 0x24) >>> 0)) : 0
    if (maxC < minC) maxC = minC
  }

  const nRollRange = ((maxC - minC) + 1) | 0
  const nTotalMinions = (SEED_RollLimitedFast113c(m, (pBoss + 0x20) >>> 0, nRollRange) + minC) | 0
  if (nTotalMinions <= 0) return

  for (let i = 0; i < nTotalMinions; i++) {
    let pMinion = 0
    if (pCoordNode !== 0) {
      pMinion = MONSTER_SpawnPackMember113c(
        m,
        nMinionClassId,
        pBoss,
        1,
        pGame,
        pCoordNode,
        3,
        0x40,
        hooks !== undefined ? hooks.regpop : undefined,
      ) >>> 0
    } else {
      pMinion = MONSTER_SpawnPartyMinionInRing113c(
        m,
        nMinionClassId,
        pBoss,
        1,
        pGame,
        3,
        0x40,
        hooks !== undefined ? hooks.regpop : undefined,
      ) >>> 0
    }
    if (pMinion !== 0) {
      MONUMOD_CopyMinionEligibleUMods113c(m, pBoss, pMinion, 0)
      const dwBossGuid = pBoss !== 0 ? (m.u32((pBoss + 0x0c) >>> 0) >>> 0) : 0xffffffff
      if ((m.u32(pMinion) >>> 0) === 1) {
        const pMinMonData = m.u32((pMinion + 0x14) >>> 0) >>> 0
        const pMinAiGen = pMinMonData !== 0 ? (m.u32((pMinMonData + 0x28) >>> 0) >>> 0) : 0
        if (pMinAiGen !== 0) {
          m.setU32((pMinAiGen + 0x2c) >>> 0, dwBossGuid)
          m.setU32((pMinAiGen + 0x30) >>> 0, 1)
          m.setU32((pMinAiGen + 0x28) >>> 0, pGame >>> 0)
        }
      }
      AIGENERAL_LinkMinionToLeader113c(m, pBoss, pMinion, pGame)
      if ((m.u32(pMinion) >>> 0) === 1) {
        const pMinMonData = m.u32((pMinion + 0x14) >>> 0) >>> 0
        const pMinAiGen = pMinMonData !== 0 ? (m.u32((pMinMonData + 0x28) >>> 0) >>> 0) : 0
        if (pMinAiGen !== 0) {
          if (pBoss !== 0) {
            m.setU32((pMinAiGen + 0x0c) >>> 0, m.u32((pBoss + 0x0c) >>> 0))
            m.setU32((pMinAiGen + 0x10) >>> 0, m.u32(pBoss >>> 0))
          } else {
            m.setU32((pMinAiGen + 0x0c) >>> 0, 0xffffffff)
            m.setU32((pMinAiGen + 0x10) >>> 0, 1)
          }
        }
        if (pMinMonData !== 0) {
          m.setU8(
            (pMinMonData + 0x16) >>> 0,
            (m.u8((pMinMonData + 0x16) >>> 0) | 0x10) & 0xff,
          )
        }
      }
    }
  }
}

function invokeMonUModCallback113c(
  m: Memory113c,
  pfn: number,
  pMonster: number,
  nUModId: number,
  bBoss: number,
  hooks?: K2W3B2Hooks113c,
): void {
  if (pfn === 0) return
  if (hooks !== undefined && hooks.onMonUMod !== undefined) {
    hooks.onMonUMod(m, pfn, pMonster, nUModId, bBoss)
  }
  switch (pfn >>> 0) {
    case 0x6fc43020:
      MONUMOD_RollBossOrMinionNameSeed113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc42fa0:
      MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc41e80:
      MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc42bc0:
      MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc42880:
      MONUMOD_ApplyExtraFastVelocity_6FC42880_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc41be0:
      MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc42740:
      MONUMOD_ApplyFireEnchantedStats_6FC42740_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc42da0:
      MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc42600:
      MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc42490:
      MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc42320:
      MONUMOD_ApplyColdEnchantedStats_6FC42320_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc421d0:
      MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc441b0:
      MONSTER_AssignTeleportSkill_6FC441B0_113c(m as unknown as SparseMemory113c, pMonster, bBoss)
      return
    case 0x6fc44cd0:
      MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c(m as unknown as SparseMemory113c, pMonster, bBoss)
      return
    case 0x6fc43850:
      MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc43810:
      MONUMOD_ApplyChampionFanaticStats_6FC43810_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc437c0:
      MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc42d00:
      MONUMOD_ApplyGhostlyStats_6FC42D00_113c(m, pMonster, nUModId, bBoss)
      return
    case 0x6fc469f0:
      MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c(m, pMonster, bBoss)
      return
    default:
      return
  }
}

function getMonUModFnFromTable113c(m: Memory113c, nIdx: number): number {
  const idx = nIdx | 0
  if (idx < 0 || idx >= 43) return 0
  let inMem = 0
  try {
    inMem = m.u32((D2GAME_MONUMOD_TABLE_VA_113C + idx * 4) >>> 0) >>> 0
  } catch {
    inMem = 0
  }
  if (inMem !== 0) return inMem
  return DEFAULT_MONUMOD_TABLE_6FD2E550[idx]! >>> 0
}

/**
 * [19/45] Spawns a pack minion monster (`0x6FC446D0`) using 3-stage fallback placement
 * (`MONSTER_Create` radius `-1` -> `MONSTER_Create` radius `4` -> `REGPOP_FindPackSpawnCoords`
 * + `MONSTER_SpawnAtCoords_6FD0F450` radius `-1`, `wFlags = 0x62`), copies all 9 UMod bytes into
 * `pMonData + 0x1C`, marks `byte [pMonData + 0x16] |= 0x10` (minion), and invokes base (`1..4`)
 * plus all 9 UMod (`0..8`) callbacks in `0x6FD2E550` with `bBoss = 0`.
 *
 * @va D2Game:0x6FC446D0
 */
export function MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  _pCoordNode: number,
  nX: number,
  nY: number,
  _nMaxRadius: number,
  nClassId: number,
  _wFlags: number,
  pUModBytes: number,
  dwAiArg: number,
  hooks?: K2W3B2Hooks113c,
): number {
  hitD2GameVa113c(0x6FC446D0)
  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x50) >>> 0
  let pMinion = 0
  const regpopHooks = hooks !== undefined ? hooks.regpop : undefined
  try {
    m.fill(sp, 0x50, 0)
    // Stage 1: MONSTER_Create with nMaxRadius = -1, wFlags = 0x62
    m.setU32((sp + 0x08) >>> 0, pGame >>> 0)
    m.setU32((sp + 0x0c) >>> 0, pRoom >>> 0)
    m.setU32((sp + 0x10) >>> 0, 0)
    m.setU32((sp + 0x14) >>> 0, nClassId >>> 0)
    m.setU32((sp + 0x18) >>> 0, 1)
    m.setU32((sp + 0x1c) >>> 0, dwAiArg >>> 0)
    m.setU32((sp + 0x20) >>> 0, nX >>> 0)
    m.setU32((sp + 0x24) >>> 0, nY >>> 0)
    m.setU32((sp + 0x28) >>> 0, 0xffffffff)
    m.setU16((sp + 0x2c) >>> 0, 0x62)
    pMinion = MONSTER_Create113c(m, (sp + 0x08) >>> 0, regpopHooks) >>> 0

    // Stage 2: retry MONSTER_Create with nMaxRadius = 4, wFlags = 0x62
    if (pMinion === 0) {
      m.setU32((sp + 0x08) >>> 0, pGame >>> 0)
      m.setU32((sp + 0x0c) >>> 0, pRoom >>> 0)
      m.setU32((sp + 0x10) >>> 0, 0)
      m.setU32((sp + 0x14) >>> 0, nClassId >>> 0)
      m.setU32((sp + 0x18) >>> 0, 1)
      m.setU32((sp + 0x1c) >>> 0, dwAiArg >>> 0)
      m.setU32((sp + 0x20) >>> 0, nX >>> 0)
      m.setU32((sp + 0x24) >>> 0, nY >>> 0)
      m.setU32((sp + 0x28) >>> 0, 4)
      m.setU16((sp + 0x2c) >>> 0, 0x62)
      pMinion = MONSTER_Create113c(m, (sp + 0x08) >>> 0, regpopHooks) >>> 0
    }

    // Stage 3: REGPOP_FindPackSpawnCoords(..., pCoordNode=0, ..., 1) + MONSTER_SpawnAtCoords_6FD0F450
    if (pMinion === 0) {
      const pOutX = sp
      const pOutY = (sp + 0x04) >>> 0
      m.setU32(pOutX, nX >>> 0)
      m.setU32(pOutY, nY >>> 0)
      const bFound = REGPOP_FindPackSpawnCoords113c(
        m,
        pRoom,
        pGame,
        0,
        nClassId,
        pOutX,
        pOutY,
        1,
        regpopHooks,
      )
      if (bFound === 0) return 0
      pMinion = MONSTER_SpawnAtCoords_6FD0F450_113c(
        m,
        dwAiArg,
        nClassId,
        1,
        pGame,
        pRoom,
        m.u32(pOutX) | 0,
        m.u32(pOutY) | 0,
        -1,
        0x62,
        regpopHooks,
      ) >>> 0
    }
  } finally {
    w3b2ScratchSp = sp
  }

  if (pMinion === 0) return 0

  let pUModsDst = 0
  if ((m.u32(pMinion) >>> 0) === 1) {
    const pMonData = m.u32((pMinion + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pUModsDst = (pMonData + 0x1c) >>> 0
      if (pUModBytes !== 0) {
        for (let i = 0; i < 9; i++) {
          m.setU8((pUModsDst + i) >>> 0, m.u8((pUModBytes + i) >>> 0))
        }
      }
      m.setU8((pMonData + 0x16) >>> 0, (m.u8((pMonData + 0x16) >>> 0) | 0x10) & 0xff)
    }
  }

  for (let baseIdx = 1; baseIdx <= 4; baseIdx++) {
    const pfn = getMonUModFnFromTable113c(m, baseIdx)
    if (pfn !== 0) {
      invokeMonUModCallback113c(m, pfn, pMinion, baseIdx, 0, hooks)
    }
  }

  for (let i = 0; i < 9; i++) {
    const nModId = pUModsDst !== 0 ? m.u8((pUModsDst + i) >>> 0) : 0
    const pfn = getMonUModFnFromTable113c(m, nModId)
    if (pfn !== 0) {
      invokeMonUModCallback113c(m, pfn, pMinion, nModId, 0, hooks)
    }
  }

  return pMinion
}

/**
 * [20/45] Spawns 8 Charged Bolt projectiles (`0x141`, 4 cardinal directions * 2 bolts)
 * when a Lightning Enchanted monster is hit, using `nSkillLvl = stat 0x0C` directly
 * and cardinal offsets `dx=[0,1,0,-1]`, `dy=[-1,0,1,0]`.
 *
 * @va D2Game:0x6FC45CC0
 */
export function MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  hooks?: K2W3B2Hooks113c,
): void {
  hitD2GameVa113c(0x6FC45CC0)
  if (pMonster === 0) return

  const startX = getUnitPosXInline113c(m, pMonster)
  const startY = getUnitPosYInline113c(m, pMonster)
  const nSkillLvl = STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0
  const projHooks = withChargedBoltInitHook113c(hooks)

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x60) >>> 0
  try {
    m.fill(sp, 0x5c, 0)
    m.setU32((sp + 0x00) >>> 0, 0x21)
    m.setU32((sp + 0x04) >>> 0, pMonster >>> 0)
    m.setU32((sp + 0x10) >>> 0, 0x141)
    m.setU32((sp + 0x14) >>> 0, startX >>> 0)
    m.setU32((sp + 0x18) >>> 0, startY >>> 0)
    m.setU32((sp + 0x30) >>> 0, nSkillLvl >>> 0)
    m.setU32((sp + 0x54) >>> 0, 0x6fc61f50)

    for (let dirIdx = 0; dirIdx < 4; dirIdx++) {
      const curX = getUnitPosXInline113c(m, pMonster)
      const curY = getUnitPosYInline113c(m, pMonster)
      const targetX = (curX + BOLT_DIR_DY_6FD1CE4C[dirIdx]!) | 0
      const targetY = (curY + BOLT_DIR_DX_6FD1CE3C[dirIdx]!) | 0
      for (let bolt = 0; bolt < 2; bolt++) {
        m.setU32((sp + 0x58) >>> 0, bolt >>> 0)
        m.setU32((sp + 0x1c) >>> 0, targetX >>> 0)
        m.setU32((sp + 0x20) >>> 0, targetY >>> 0)
        MISSILE_CreateServerProjectile113c(m, pGame, sp, projHooks)
      }
    }
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [21/45] Spawns 8 missile projectiles (`0xE1`, 4 cardinal directions * 2 bolts)
 * around `pMonster`, using `nSkillLvl = stat 0x0C` directly and cardinal offsets
 * `dx = [0x6FD1CE4C]` (`[0,1,0,-1]`), `dy = [0x6FD1CE3C]` (`[-1,0,1,0]`).
 *
 * @va D2Game:0x6FC460D0
 */
export function MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  hooks?: K2W3B2Hooks113c,
): void {
  hitD2GameVa113c(0x6FC460D0)
  if (pMonster === 0) return

  const startX = getUnitPosXInline113c(m, pMonster)
  const startY = getUnitPosYInline113c(m, pMonster)
  const nSkillLvl = STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0
  const projHooks = withChargedBoltInitHook113c(hooks)

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x60) >>> 0
  try {
    m.fill(sp, 0x5c, 0)
    m.setU32((sp + 0x00) >>> 0, 0x21)
    m.setU32((sp + 0x04) >>> 0, pMonster >>> 0)
    m.setU32((sp + 0x10) >>> 0, 0xe1)
    m.setU32((sp + 0x14) >>> 0, startX >>> 0)
    m.setU32((sp + 0x18) >>> 0, startY >>> 0)
    m.setU32((sp + 0x30) >>> 0, nSkillLvl >>> 0)
    m.setU32((sp + 0x54) >>> 0, 0x6fc61f50)

    for (let dirIdx = 0; dirIdx < 4; dirIdx++) {
      const curX = getUnitPosXInline113c(m, pMonster)
      const curY = getUnitPosYInline113c(m, pMonster)
      const targetX = (curX + BOLT_DIR_DY_6FD1CE4C[dirIdx]!) | 0
      const targetY = (curY + BOLT_DIR_DX_6FD1CE3C[dirIdx]!) | 0
      for (let bolt = 0; bolt < 2; bolt++) {
        m.setU32((sp + 0x58) >>> 0, bolt >>> 0)
        m.setU32((sp + 0x1c) >>> 0, targetX >>> 0)
        m.setU32((sp + 0x20) >>> 0, targetY >>> 0)
        MISSILE_CreateServerProjectile113c(m, pGame, sp, projHooks)
      }
    }
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [22/45] Spawns a 64-direction Frost Nova (`0xC2`, `nSkillId = 0`, `slvl = max(1, mlvl / 2)`)
 * on Cold Enchanted monster trigger (`bTrigger != 0`).
 *
 * @va D2Game:0x6FC462D0
 */
export function MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  hooks?: K2W3B2Hooks113c,
  bTrigger = 1,
): void {
  hitD2GameVa113c(0x6FC462D0)
  if ((bTrigger | 0) === 0) return

  let nSkillLvl = Math.trunc((STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0) / 2) | 0
  if (nSkillLvl <= 1) nSkillLvl = 1

  const nVelOverride = DATATBLS_CalcMissileSubLoopFrames113c(m, 0x77, 0) | 0
  MISSILE_SpawnNova64Directions113c(
    m,
    pMonster,
    nVelOverride,
    pGame,
    pMonster,
    0xc2,
    0,
    nSkillLvl,
    hooks !== undefined ? hooks.meleeDot : undefined,
  )
}

/**
 * [23/45] Spawns 8 Scarab Charged Bolt projectiles (`0xC3`, `slvl = max(1, mlvl / 2)`) with
 * a 10-frame cooldown (`|dwCurFrame - dwLastFrame| < 10` clears `bFlags(+0x17) &= ~1`;
 * otherwise writes `dwCurFrame` to `+0x18` and sets `bFlags(+0x17) |= 1`).
 *
 * @va D2Game:0x6FC46320
 */
export function MONUMOD_SpawnScarabChargedBolts_6FC46320_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  hooks?: K2W3B2Hooks113c,
  bTrigger = 1,
): void {
  hitD2GameVa113c(0x6FC46320)
  if ((bTrigger | 0) === 0) return

  let dwLastFrame = 0
  if (pMonster !== 0 && (m.u32(pMonster >>> 0) >>> 0) === 1) {
    const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      dwLastFrame = m.u32((pMonData + 0x18) >>> 0) | 0
    }
  }

  const dwCurFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  let nFrameDelta = (dwCurFrame - dwLastFrame) | 0
  if (nFrameDelta < 0) nFrameDelta = (-nFrameDelta) | 0

  if (nFrameDelta < 0x0a) {
    if (pMonster !== 0 && (m.u32(pMonster >>> 0) >>> 0) === 1) {
      const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        m.setU8((pMonData + 0x17) >>> 0, m.u8((pMonData + 0x17) >>> 0) & 0xfe)
      }
    }
    return
  }

  if (pMonster !== 0 && (m.u32(pMonster >>> 0) >>> 0) === 1) {
    const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      m.setU32((pMonData + 0x18) >>> 0, dwCurFrame >>> 0)
      m.setU8((pMonData + 0x17) >>> 0, (m.u8((pMonData + 0x17) >>> 0) | 1) & 0xff)
    }
  }

  let nSkillLvl = Math.trunc((STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0) / 2) | 0
  if (nSkillLvl < 1) nSkillLvl = 1

  const startX = getUnitPosXInline113c(m, pMonster)
  const startY = getUnitPosYInline113c(m, pMonster)
  const baseX = getUnitPosXInline113c(m, pMonster)
  const baseY = getUnitPosYInline113c(m, pMonster)
  const projHooks = withChargedBoltInitHook113c(hooks)

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x60) >>> 0
  try {
    m.fill(sp, 0x5c, 0)
    m.setU32((sp + 0x00) >>> 0, 0x21)
    m.setU32((sp + 0x04) >>> 0, pMonster >>> 0)
    m.setU32((sp + 0x10) >>> 0, 0xc3)
    m.setU32((sp + 0x14) >>> 0, startX >>> 0)
    m.setU32((sp + 0x18) >>> 0, startY >>> 0)
    m.setU32((sp + 0x30) >>> 0, nSkillLvl >>> 0)
    m.setU32((sp + 0x54) >>> 0, 0x6fc61f50)

    for (let dirIdx = 0; dirIdx < 4; dirIdx++) {
      const targetX = (baseX + BOLT_DIR_DY_6FD1CE4C[dirIdx]!) | 0
      const targetY = (baseY + BOLT_DIR_DX_6FD1CE3C[dirIdx]!) | 0
      for (let bolt = 0; bolt < 2; bolt++) {
        m.setU32((sp + 0x58) >>> 0, bolt >>> 0)
        m.setU32((sp + 0x1c) >>> 0, targetX >>> 0)
        m.setU32((sp + 0x20) >>> 0, targetY >>> 0)
        MISSILE_CreateServerProjectile113c(m, pGame, sp, projHooks)
      }
    }
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [24/45] Spawns a 64-direction Nova (`0x5A`, `nSkillId = 0`) when `bTrigger != 0`, deriving
 * `nSkillLvl = clamp(leaderSkill0x10C / 2 + 1, 1, 15)` (or `1` if no owner/skill or if
 * `STATLIST_GetUnitLifePercent113c(pMonster) > 10`).
 *
 * @va D2Game:0x6FC46520
 */
export function MONUMOD_SpawnDeathNova_6FC46520_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  _pTarget: number,
  _nUModId: number,
  bTrigger: number,
  hooks?: K2W3B2Hooks113c,
): void {
  hitD2GameVa113c(0x6FC46520)
  if ((bTrigger | 0) === 0) return

  let nSkillLvl = 1
  if (pMonster !== 0 && (m.u32(pMonster >>> 0) >>> 0) === 1) {
    const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGen !== 0) {
        const pOwnerGame = m.u32((pAiGen + 0x28) >>> 0) >>> 0
        if (pOwnerGame !== 0) {
          const pLeader = SUNIT_GetServerUnit113c(
            m,
            pOwnerGame,
            m.u32((pAiGen + 0x30) >>> 0) | 0,
            m.u32((pAiGen + 0x2c) >>> 0) | 0,
          ) >>> 0
          if (pLeader !== 0) {
            const pSkill =
              SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pLeader, 0x10c) >>> 0
            if (pSkill !== 0) {
              const evalLvl = SKILLS_EvaluateSkillLevel113c(m, pLeader, pSkill, 1) | 0
              const scaled = (Math.trunc(evalLvl / 2) + 1) | 0
              if (scaled > 1) {
                nSkillLvl = scaled < 0x0f ? scaled : 0x0f
              }
            }
          }
        }
      }
    }
  }

  if ((STATLIST_GetUnitLifePercent113c(m, pMonster) | 0) > 0x0a) {
    nSkillLvl = 1
  }

  const nVelOverride = DATATBLS_CalcMissileSubLoopFrames113c(m, 0x5a, 0) | 0
  MISSILE_SpawnNova64Directions113c(
    m,
    pMonster,
    nVelOverride,
    pGame,
    pMonster,
    0x5a,
    0,
    nSkillLvl,
    hooks !== undefined ? hooks.meleeDot : undefined,
  )
}

/**
 * [25/45] Configures a Charge/Leap dynamic path (`param0C = 0x1101`, collision masks `0`,
 * `type = 9`, velocity = `MonStatsTxt+0x34 << 8` or `CharStatsTxt+0x41 << 8`), computes
 * the path via `PATH_Compute113c`, and returns `1`.
 *
 * @va D2Game:0x6FC46A80
 */
export function SKILLS_SetupChargeOrLeapPath_6FC46A80_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pSkill: number,
  _unusedVelocityArg = 0,
): number {
  hitD2GameVa113c(0x6FC46A80)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) return 0

  SKILLS_SetParam0C113c(m, pSkill, 0x1101)
  PATH_SetMoveTestCollisionMask113c(m, pPath, 0)
  PATH_SetCollisionMask113c(m, pPath, 0)

  const nTargetX = SKILLS_GetParam1113c(m, pSkill) | 0
  const nTargetY = SKILLS_GetParam2113c(m, pSkill) | 0
  if (nTargetX === 0 || nTargetY === 0) return 0

  PATH_SetTargetPos113c(m, pPath, nTargetX, nTargetY)
  PATH_SetType113c(m, pPath, 9)

  const uType = m.u32(pUnit >>> 0) | 0
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  let nVel: number
  if (uType === 1) {
    const pMonRec = MONSTATS_GetRecordPtr113c(m, nClassId) >>> 0
    if (pMonRec === 0) return 0
    nVel = (sx16(m.u16((pMonRec + 0x34) >>> 0)) << 8) | 0
  } else {
    const pCharRec = CHARSTATS_GetRecordPtrFast_6FC210A0_113c(m, nClassId) >>> 0
    nVel = pCharRec !== 0 ? (m.u8((pCharRec + 0x41) >>> 0) << 8) | 0 : 0
  }

  PATH_SetVelocity113c(m, pPath, nVel)
  PATH_Compute113c(m, pPath, pUnit, 0)
  return 1
}

/**
 * [26/45] Clamps target coordinates `(pInOutX, pInOutY)` to skill range (`SkillsTxt + 0x64`)
 * and tries 3 positions (clamped target, +perp, -perp) to find a free spot (`0x1C09`,
 * `bAllowUnk = 1`) with Line-of-Sight (`0x804`) within range.
 *
 * @va D2Game:0x6FC46BB0
 */
export function SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  pInOutX: number,
  pInOutY: number,
  _pOutRoom = 0,
): number {
  hitD2GameVa113c(0x6FC46BB0)
  const nSkillIdx = nSkillId | 0
  if (nSkillIdx < 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (pDataTables === 0 || nSkillIdx >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(nSkillIdx, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nOriginX = getUnitPosXInline113c(m, pUnit)
  const nOriginY = getUnitPosYInline113c(m, pUnit)

  const nCalc = m.u32((pSkillsTxt + 0x64) >>> 0) | 0
  const nMaxDist = SKILLS_EvalCalcByOffset113c(m, pUnit, nCalc, nSkillIdx, nSkillLevel | 0) | 0

  const rawX = m.u32(pInOutX >>> 0) | 0
  const rawY = m.u32(pInOutY >>> 0) | 0
  let nDist = UNITS_GetUnitDistanceToCoordinates113c(m, pUnit, rawX, rawY) | 0
  if (nDist <= 1) nDist = 1

  if (nDist > nMaxDist) {
    const clampedX = (nOriginX + Math.trunc(imul32((rawX - nOriginX) | 0, nMaxDist) / nDist)) | 0
    const clampedY = (nOriginY + Math.trunc(imul32((rawY - nOriginY) | 0, nMaxDist) / nDist)) | 0
    m.setU32(pInOutX >>> 0, clampedX >>> 0)
    m.setU32(pInOutY >>> 0, clampedY >>> 0)
  }

  const baseTargetX = m.u32(pInOutX >>> 0) | 0
  const baseTargetY = m.u32(pInOutY >>> 0) | 0

  let stepX = (baseTargetY - nOriginY) | 0
  if (stepX <= -2) stepX = -2
  else if (stepX >= 2) stepX = 2

  let stepY = (nOriginX - baseTargetX) | 0
  if (stepY <= -2) stepY = -2
  else if (stepY >= 2) stepY = 2

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x10) >>> 0
  try {
    let curX = baseTargetX
    let curY = baseTargetY
    let attemptsLeft = 3

    while (attemptsLeft > 0) {
      m.setU32(sp, curX >>> 0)
      m.setU32((sp + 4) >>> 0, curY >>> 0)
      const pUnitRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
      const pDestRoom = ROOM_FindRoomContainingSubtile113c(m, pUnitRoom, curX, curY) >>> 0
      const nSizeX = UNITS_GetUnitSizeX113c(m, pUnit) | 0
      const pFreeRoom = COLLISION_FindFreePositionSimple113c(m, pDestRoom, sp, nSizeX, 0x1c09, 1) >>> 0
      const freeX = m.u32(sp) | 0
      const freeY = m.u32((sp + 4) >>> 0) | 0
      if (pFreeRoom !== 0) {
        const nPattern = PATH_GetUnitCollisionPattern113c(m, pUnit) | 0
        if (COLLISION_CheckMaskWithPattern2_113c(m, pFreeRoom, freeX, freeY, nPattern, 0x1c09) === 0) {
          if (SKILLS_CheckLineOfSight113c(m, nOriginX, nOriginY, freeX, freeY, pFreeRoom, 0x804) !== 0) {
            if ((UNITS_GetUnitDistanceToCoordinates113c(m, pUnit, freeX, freeY) | 0) <= nMaxDist) {
              m.setU32(pInOutX >>> 0, freeX >>> 0)
              m.setU32(pInOutY >>> 0, freeY >>> 0)
              return 1
            }
          }
        }
      }
      attemptsLeft = (attemptsLeft - 1) | 0
      if (attemptsLeft === 2) {
        curX = ((m.u32(pInOutX >>> 0) | 0) + stepX) | 0
        curY = ((m.u32(pInOutY >>> 0) | 0) + stepY) | 0
      } else if (attemptsLeft === 1) {
        curX = ((m.u32(pInOutX >>> 0) | 0) - stepX) | 0
        curY = ((m.u32(pInOutY >>> 0) | 0) - stepY) | 0
      }
    }
    return 0
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [27/45] Computes Whirlwind / dual-wielding attack frame interval from weapon speed
 * (`ITEMS_CalcWeaponAttackSpeed113c`) and stores the next attack frame in `Skill->dwParam4`.
 *
 * @va D2Game:0x6FC46E40
 */
export function SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pSkill: number,
): number {
  hitD2GameVa113c(0x6FC46E40)
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 1) {
    const lo = stepSeed64InMem113c(m, (pUnit + 0x20) >>> 0)
    return (lo & 1) === 0 ? 1 : 0
  }
  if (m.u32((pGame + 0x70) >>> 0) === 0) {
    return 1
  }

  let nNextFrame = SKILLS_GetParam4113c(m, pSkill) | 0
  const dwCurFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  if (nNextFrame === 0) {
    SKILLS_SetParam4113c(m, pSkill, (dwCurFrame + 4) | 0)
    return 1
  }
  if (dwCurFrame < nNextFrame) {
    return 0
  }

  let nHitCount = 1
  const pWeapon = PLAYER_GetEquippedWeapon113c(m, pUnit) >>> 0
  let nStepFrames = 10
  if (pWeapon !== 0) {
    const nFrames = ITEMS_CalcWeaponAttackSpeed113c(m, pUnit, pWeapon) | 0
    if (nFrames < 0x0c) {
      nStepFrames = 4
    } else if (nFrames < 0x0f) {
      nStepFrames = 6
    } else if (nFrames < 0x12) {
      nStepFrames = 8
    } else if (nFrames < 0x14) {
      nStepFrames = 10
    } else if (nFrames < 0x17) {
      nStepFrames = 12
    } else if (nFrames < 0x1a) {
      nStepFrames = 14
    } else {
      nStepFrames = 16
    }
  }

  if (PLRMODE_IsDualWieldingClaws_6FC46A30_113c(m, pUnit) !== 0) {
    nHitCount = 2
  }

  let nUpdatedFrame = (nNextFrame + nStepFrames) | 0
  if (nUpdatedFrame < dwCurFrame) {
    nUpdatedFrame = (dwCurFrame + nStepFrames) | 0
  }
  SKILLS_SetParam4113c(m, pSkill, nUpdatedFrame)
  return nHitCount
}

/**
 * [28/45] Selects a potion item code (`hp`, `mp`, or `rv`) from `0x6FD2E3E8` indexed by
 * `nAct + nDiff * 5` using a random roll against `Skill` param3 (`mp`, col 1) then
 * `param3 + param4` (`rv`, col 2), defaulting to `hp` (col 0).
 *
 * @va D2Game:0x6FC46F70
 */
export function SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
): number {
  hitD2GameVa113c(0x6FC46F70)
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (pRoom === 0) return 0

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (nAct >= 5) return 0

  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const nRowIdx = (nAct + imul32(nDiff, 5)) | 0

  const nRoll = ((stepSeed64InMem113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
  const nParam3 = SKILLS_GetParam3Fast_6FC21BF0_113c(m, nSkillId) | 0

  let nCol = 0
  if (nRoll < nParam3) {
    nCol = 1
  } else {
    const nParam4 = SKILLS_GetParam4Fast_6FC21C20_113c(m, nSkillId) | 0
    if (nRoll < ((nParam3 + nParam4) | 0)) {
      nCol = 2
    }
  }

  const nMaxRow = (m.u32(0x6fd2e49c) | 0) !== 0 ? (m.u32(0x6fd2e49c) | 0) : 15
  if (nRowIdx > nMaxRow || nRowIdx < 0 || nRowIdx >= POTION_CODE_TABLE_6FD2E3E8.length) {
    return 0
  }
  const row = POTION_CODE_TABLE_6FD2E3E8[nRowIdx]!
  return row[nCol]!
}

/**
 * [29/45] Finds the next melee target: first checks path target (`SUNIT_ValidatePathTargetUnit` +
 * `UNITS_CanUnitMeleeAttackTarget`), then saved `Param3`/`Param4`, otherwise scans via
 * `AURA_ForEachUnitInRadius113c` (`radius = weaponAdder + 4`, flags `0x2A783`, callback
 * `SKILLS_TargetRingScanCallback_6FCBED70_113c`) and stores its type/GUID in `Param3`/`Param4`
 * (or `Param3 = 6` if none found).
 *
 * @va D2Game:0x6FC472C0
 */
export function SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pSkill: number,
): number {
  hitD2GameVa113c(0x6FC472C0)
  if (pSkill === 0) return 0

  let pTarget = 0
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pPathTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (
    pPathTarget !== pUnit &&
    pPathTarget !== 0 &&
    UNITS_CanUnitMeleeAttackTarget113c(m, pUnit, pPathTarget, 0) !== 0
  ) {
    pTarget = pPathTarget
  } else {
    const nSavedType = SKILLS_GetParam3113c(m, pSkill) | 0
    const nSavedGuid = SKILLS_GetParam4113c(m, pSkill) | 0
    if (nSavedType !== 6) {
      pTarget = SUNIT_GetServerUnit113c(m, pGame, nSavedType, nSavedGuid) >>> 0
    }
  }

  if (pTarget === 0) {
    const nAdder = UNITS_GetEquippedWeaponAdder113c(m, pUnit) | 0
    const sp = w3b2ScratchSp
    w3b2ScratchSp = (sp + 0x18) >>> 0
    try {
      m.setU32((sp + 0x00) >>> 0, 0)
      m.setU32((sp + 0x04) >>> 0, 0xffffffff)
      m.setU32((sp + 0x08) >>> 0, 0)
      m.setU32((sp + 0x0c) >>> 0, 0xffffffff)
      m.setU32((sp + 0x10) >>> 0, 0xffffffff)
      m.setU32((sp + 0x14) >>> 0, 0)

      AURA_ForEachUnitInRadius113c(
        m,
        pGame,
        pUnit,
        0,
        0,
        (nAdder + 4) | 0,
        0x2a783,
        0x6fcbed70,
        sp,
        0,
        SKILLS_TargetRingScanCallback_6FCBED70_113c,
      )
      pTarget = m.u32((sp + 0x00) >>> 0) >>> 0
      if (pTarget === 0) {
        pTarget = m.u32((sp + 0x08) >>> 0) >>> 0
      }
    } finally {
      w3b2ScratchSp = sp
    }
  }

  if (pTarget !== 0) {
    SKILLS_SetParam3113c(m, pSkill, m.u32(pTarget >>> 0) | 0)
    SKILLS_SetParam4113c(m, pSkill, m.u32((pTarget + 0x0c) >>> 0) | 0)
    return pTarget
  }
  SKILLS_SetParam3113c(m, pSkill, 6)
  return 0
}

/**
 * [30/45] Consumes a selectable monster corpse (setting state `0x76` and refreshing before
 * rolling), evaluates `SkillsTxt->dwCalc1 (+0x138)`, rolls via `seedRoll(100)`, advances
 * seed on second `seedRoll(100)`, and drops treasure via `MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c`.
 *
 * @va D2Game:0x6FC476D0
 */
export function SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC476D0)
  const nSkillIdx = nSkillId | 0
  if (nSkillIdx < 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (pDataTables === 0 || nSkillIdx >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(nSkillIdx, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pCorpse = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pCorpse === pUnit || pCorpse === 0) return 0

  if (SKILLS_IsSelectableCorpse10678_113c(m, pCorpse) === 0) return 0
  if (STATES_CheckState113c(m, pCorpse, 0x76) !== 0) return 0

  STATES_ToggleGfxStateFlag113c(m, pCorpse, 0x76, 1)
  UNITROOM_RefreshUnit113c(m, pCorpse)

  const nChance =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillsTxt + 0x138) >>> 0) | 0,
      nSkillIdx,
      nSkillLevel | 0,
    ) | 0

  const pSeed = (pUnit + 0x20) >>> 0
  const nRoll1 = seedRollMem113c(m, pSeed, 100)
  if (nRoll1 >= nChance) return 0

  const nRoll2 = seedRollMem113c(m, pSeed, 100)
  let _nTier = 1
  const c0 = m.u32((pSkillsTxt + 0x148) >>> 0) | 0
  if (nRoll2 >= 0 && nRoll2 < c0) _nTier = 1
  const c1 = m.u32((pSkillsTxt + 0x14c) >>> 0) | 0
  const sum01 = (c0 + c1) | 0
  if (nRoll2 >= c0 && nRoll2 < sum01) _nTier = 2
  const c2 = m.u32((pSkillsTxt + 0x150) >>> 0) | 0
  const sum012 = (sum01 + c2) | 0
  if (nRoll2 >= sum01 && nRoll2 < sum012) _nTier = 3
  const c3 = m.u32((pSkillsTxt + 0x154) >>> 0) | 0
  if (nRoll2 >= sum012 && nRoll2 < ((sum012 + c3) | 0)) _nTier = 4
  void _nTier

  MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c(m, pGame, pCorpse, pUnit, false)
  return 1
}

/**
 * [31/45] Consumes a selectable monster corpse (`SKILLS_IsSelectableCorpseWithFlag12_113c`),
 * selects `wSrvMissileA/B/C` (`+0x48/+0x4A/+0x4C`) from `MonStats2+5` size flags, spawns
 * the projectile at a free spot (`size=2, mask=0x1000, bAllow=1`), and toggles BOTH states
 * `0x68` and `0x76` before refreshing the corpse.
 *
 * @va D2Game:0x6FC47C90
 */
export function SKILLS_SrvDo_SpawnCorpseMissile_6FC47C90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2W3B2Hooks113c,
): number {
  hitD2GameVa113c(0x6FC47C90)
  const nSkillIdx = nSkillId | 0
  if (nSkillIdx < 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (pDataTables === 0 || nSkillIdx >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(nSkillIdx, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pCorpse = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pCorpse === pUnit || pCorpse === 0) return 0

  if (SKILLS_IsSelectableCorpseWithFlag12_113c(m, pCorpse) === 0) return 0

  const nCorpseX = UNIT_GetPosX113c(m, pCorpse) | 0
  const nCorpseY = UNIT_GetPosY113c(m, pCorpse) | 0
  const pCorpseRoom = UNITS_GetRoom113c(m, pCorpse) >>> 0
  if (pCorpseRoom === 0) return 0

  const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pCorpseRoom, nCorpseX, nCorpseY) >>> 0
  if (pTargetRoom === 0) return 0

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x68) >>> 0
  try {
    const pCoords = sp
    const pMissileParams = (sp + 8) >>> 0
    m.setU32(pCoords, nCorpseX >>> 0)
    m.setU32((pCoords + 4) >>> 0, nCorpseY >>> 0)
    if (COLLISION_FindFreePositionSimple113c(m, pTargetRoom, pCoords, 2, 0x1000, 1) === 0) {
      return 0
    }
    const freeX = m.u32(pCoords) | 0
    const freeY = m.u32((pCoords + 4) >>> 0) | 0

    if ((m.u32(pCorpse) >>> 0) !== 1) return 0
    let wMissileId = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
    const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pCorpse + 0x04) >>> 0) | 0) >>> 0
    if (pMonStats2 === 0) return 0

    const bFlag5 = m.u8((pMonStats2 + 0x05) >>> 0)
    const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
    const mask3 = pMasks !== 0 ? m.u32((pMasks + 0x0c) >>> 0) : 8
    const mask2 = pMasks !== 0 ? m.u32((pMasks + 0x08) >>> 0) : 4
    if ((bFlag5 & mask3) !== 0) {
      wMissileId = sx16(m.u16((pSkillsTxt + 0x4c) >>> 0))
    } else if ((bFlag5 & mask2) !== 0) {
      wMissileId = sx16(m.u16((pSkillsTxt + 0x4a) >>> 0))
    }

    const pCurTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
    if (wMissileId < 0 || pCurTables === 0 || wMissileId >= (m.u32((pCurTables + 0xb6c) >>> 0) | 0)) {
      return 0
    }

    m.fill(pMissileParams, 0x5c, 0)
    m.setU32((pMissileParams + 0x00) >>> 0, 1)
    m.setU32((pMissileParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pMissileParams + 0x10) >>> 0, wMissileId >>> 0)
    m.setU32((pMissileParams + 0x14) >>> 0, freeX >>> 0)
    m.setU32((pMissileParams + 0x18) >>> 0, freeY >>> 0)
    m.setU32((pMissileParams + 0x2c) >>> 0, nSkillIdx >>> 0)
    m.setU32((pMissileParams + 0x30) >>> 0, nSkillLevel >>> 0)
    MISSILE_CreateServerProjectile113c(
      m,
      pGame,
      pMissileParams,
      hooks !== undefined ? hooks.meleeDot : undefined,
    )

    STATES_ToggleGfxStateFlag113c(m, pCorpse, 0x68, 1)
    STATES_ToggleGfxStateFlag113c(m, pCorpse, 0x76, 1)
    UNITROOM_RefreshUnit113c(m, pCorpse)
    return 1
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [32/45] Applies or increments a progressive charge-up skill state (`stat 0xA9` layer `0`
 * on `SkillsTxt->wAuraState (+0x80)`), schedules event `0x0C`, clears gfx state flag, and
 * refreshes aura stat calcs (`SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c`).
 *
 * @va D2Game:0x6FC48E70
 */
export function SKILLS_ApplyProgressiveChargeState_6FC48E70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC48E70)
  const nSkillIdx = nSkillId | 0
  if (nSkillIdx < 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (pDataTables === 0 || nSkillIdx >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(nSkillIdx, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pUsedSkill === 0) return 0
  if (SKILLS_GetParam1113c(m, pUsedSkill) === 0) return 0

  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wAuraState < 0 || wAuraState >= (m.u32((pDataTables + 0xc4) >>> 0) | 0)) return 1

  const slvl = nSkillLevel | 0
  const nLen =
    SKILLS_EvalCalcByOffset113c(m, pUnit, m.u32((pSkillsTxt + 0x60) >>> 0) | 0, nSkillIdx, slvl) | 0
  const nExpireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + nLen) | 0

  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, wAuraState) >>> 0
  if (pStatList === 0) {
    let uType = 6
    let uGuid = -1
    if (pUnit !== 0) {
      uType = m.u32(pUnit >>> 0) | 0
      uGuid = m.u32((pUnit + 0x0c) >>> 0) | 0
    }
    pStatList = STATLIST_AllocList113c(m, 2, uType, uGuid, 0, nExpireFrame) >>> 0
    if (pStatList === 0) return 0
    STATLIST_SetState113c(m, pStatList, wAuraState)
    STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0)
    STATLIST_SetStat113c(m, pStatList, 0xa9, 0, 0)
    STATLIST_MergeStatLists113c(m, pUnit, pStatList, 1)
    STATES_ToggleGfxStateFlag113c(m, pUnit, wAuraState, 1)
  }

  STATLIST_SetExpireFrameEx113c(m, pStatList, nExpireFrame)
  EVENT_SetEventFull113c(m, pGame, pUnit, 0x0c, nExpireFrame >>> 0, 0, 0, 0)
  STATES_ClearGfxStateFlag113c(m, pUnit, wAuraState, 1)

  const nCurCharge = STATLIST_GetStatValue113c(m, pStatList, 0xa9, 0) | 0
  let nNextCharge = (nCurCharge + 1) | 0
  if (nNextCharge > slvl) nNextCharge = slvl
  STATLIST_SetStat113c(m, pStatList, 0xa9, nNextCharge, 0)
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
    m,
    pSkillsTxt,
    pUnit,
    pStatList,
    nSkillIdx,
    nNextCharge,
  )
  return 1
}

/**
 * [33/45] Looks up a game entry by `wGameKey` (`uint16`) in the global game hash table
 * at `m.u32(0x6FD31C24)` via `STORM_TSHashTableLookup_6FC22130_113c`, asserts non-null
 * lock at `pGame + 0x18` (`0x112E`), and increments the lock count.
 *
 * @va D2Game:0x6FC4AAE0
 */
export function GAME_LookupAndLockGameByKey_6FC4AAE0_113c(
  m: D2KernMemory113c,
  wGameKey: number,
): number {
  hitD2GameVa113c(0x6FC4AAE0)
  const pTable = m.u32(0x6fd31c24) >>> 0
  if (pTable === 0) return 0
  const pGame = STORM_TSHashTableLookup_6FC22130_113c(m, pTable, wGameKey & 0xffff) >>> 0
  if (pGame !== 0) {
    const pLock = m.u32((pGame + 0x18) >>> 0) >>> 0
    if (pLock === 0) {
      throw new D2CommonAssertError('Game.cpp', 0x112e)
    }
    m.setU32(pLock, ((m.u32(pLock) | 0) + 1) >>> 0)
    return pGame
  }
  return 0
}

/**
 * [34/45] Broadcasts unit removal to all in-game clients in nearby rooms via
 * `CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c` and frees `pUnit`.
 *
 * @va D2Game:0x6FC4CD10
 */
export function SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC4CD10)
  CLIENTS_ForEachInGameClient113c(
    m,
    pGame,
    0x6fc4a9f0,
    pUnit,
    (mem, pClient, pCtx) => {
      CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c(mem, pClient, pCtx)
    },
  )
  SUNIT_FreeUnit113c(m, pGame, pUnit)
}

/**
 * [35/45] Dispatches preset object spawner callbacks for preset object IDs `> 0x23D`
 * via the table at `0x6FD2E1BC` (count at `0x6FD2E1E0`).
 *
 * @va D2Game:0x6FC4E830
 */
export function OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(
  m: D2KernMemory113c,
  nObjectId: number,
  pGame: number,
  pRoom: number,
  x: number,
  y: number,
  nInitMode: number,
  hooks?: K2W3B2Hooks113c,
): number {
  hitD2GameVa113c(0x6FC4E830)
  const objId = nObjectId | 0
  if (objId <= 0x23d) return 0

  let nCount = m.u32(0x6fd2e1e0) | 0
  if (nCount === 0) nCount = 9
  const idx = (objId - 0x23e) | 0
  if (idx >= nCount) return 0

  let pfn = m.u32((0x6fd2e1bc + idx * 4) >>> 0) >>> 0
  if (pfn === 0 && idx < DEFAULT_PRESET_OBJ_TABLE_6FD2E1BC.length) {
    pfn = DEFAULT_PRESET_OBJ_TABLE_6FD2E1BC[idx]! >>> 0
  }
  if (pfn === 0) {
    throw new D2CommonAssertError('Objects.cpp', 0x1ad)
  }

  if (pfn === 0x6fc525c0) {
    return OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c(m, pGame, pRoom, objId, x, y, nInitMode)
  }
  if (pfn === 0x6fc522b0) {
    return OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c(m, pGame, pRoom, objId, x, y, nInitMode)
  }
  if (hooks !== undefined && hooks.onPresetObjectHandler !== undefined) {
    return hooks.onPresetObjectHandler(m, pfn, pGame, pRoom, objId, x, y, nInitMode) | 0
  }
  return 0
}

function readEdgeObjTable113c(m: Memory113c, idx: number): number {
  const i = idx | 0
  const inMem = m.u32((0x6fd2e334 + i * 4) >>> 0) | 0
  if (inMem !== 0) return inMem
  return DEFAULT_EDGE_OBJ_TABLE_6FD2E334[i & 3]!
}

function readCrateObjTable113c(m: Memory113c, idx: number): number {
  const i = idx | 0
  const inMem = m.u32((0x6fd2e1f8 + i * 4) >>> 0) | 0
  if (inMem !== 0) return inMem
  return DEFAULT_CRATE_OBJ_TABLE_6FD2E1F8[i % DEFAULT_CRATE_OBJ_TABLE_6FD2E1F8.length]!
}

/**
 * [36/45] Populates clusters of evil-urn/trap monsters (`0x193` / `0x194`) inside
 * `pPopCtx->pRoom (+0x08)` using `pPopCtx` (`+0x00=pGame, +0x04=pObj, +0x08=pRoom,
 * +0x0C=pClassSeed, +0x14=initX, +0x18=initY`), updating `pObj` to mode `2`.
 *
 * @va D2Game:0x6FC4F690
 */
export function OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c(
  m: D2KernMemory113c,
  pPopCtx: number,
  hooks?: K2W3B2Hooks113c,
): void {
  hitD2GameVa113c(0x6FC4F690)
  const pObj = m.u32((pPopCtx + 0x04) >>> 0) >>> 0
  if (pObj !== 0 && m.u32((pObj + 0x10) >>> 0) !== 0) return

  const pGame = m.u32(pPopCtx >>> 0) >>> 0
  const pRoom = m.u32((pPopCtx + 0x08) >>> 0) >>> 0
  const pObjSeed = m.u32((pGame + 0x10f0) >>> 0) >>> 0

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x70) >>> 0
  try {
    const pPos = sp
    const pRoomCoords = (sp + 0x10) >>> 0
    const pSpawnArgs = (sp + 0x28) >>> 0
    m.fill(sp, 0x70, 0)

    DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
    const subX = m.u32(pRoomCoords) | 0
    const subY = m.u32((pRoomCoords + 4) >>> 0) | 0
    const subW = m.u32((pRoomCoords + 8) >>> 0) | 0
    const subH = m.u32((pRoomCoords + 12) >>> 0) | 0

    let nRemaining = (imul32(imul32(subW, subH) >> 7, 0x1e) >> 8) | 0
    let nAttempts = 0x0c

    while (nRemaining > 0 && nAttempts > 0) {
      let curX = (rollLimitedSeed64InMem113c(m, pObjSeed, (subW - 4) | 0) + subX) | 0
      let curY = (rollLimitedSeed64InMem113c(m, pObjSeed, (subH - 4) | 0) + subY) | 0
      m.setU32(pPos, curX >>> 0)
      m.setU32((pPos + 4) >>> 0, curY >>> 0)

      if (OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(m, pRoomCoords, pPos, 3, pRoom, 3) === 1) {
        const pClassSeed = m.u32((pPopCtx + 0x0c) >>> 0) >>> 0
        const nClassId = (stepSeed64InMem113c(m, pClassSeed) & 1) !== 0 ? 0x194 : 0x193
        m.fill(pSpawnArgs, 0x28, 0)
        m.setU32((pSpawnArgs + 0x00) >>> 0, pGame)
        m.setU32((pSpawnArgs + 0x04) >>> 0, pRoom)
        m.setU32((pSpawnArgs + 0x08) >>> 0, 0)
        m.setU32((pSpawnArgs + 0x0c) >>> 0, nClassId >>> 0)
        m.setU32((pSpawnArgs + 0x10) >>> 0, 1)
        m.setU32((pSpawnArgs + 0x14) >>> 0, 0)
        m.setU32((pSpawnArgs + 0x18) >>> 0, m.u32((pPopCtx + 0x14) >>> 0))
        m.setU32((pSpawnArgs + 0x1c) >>> 0, m.u32((pPopCtx + 0x18) >>> 0))
        m.setU32((pSpawnArgs + 0x20) >>> 0, 0xffffffff)
        m.setU16((pSpawnArgs + 0x24) >>> 0, 0)

        const pMon = MONSTER_Create113c(
          m,
          pSpawnArgs,
          hooks !== undefined ? hooks.regpop : undefined,
        ) >>> 0
        if (pMon !== 0) {
          UNITS_ChangeAnimMode113c(m, m.u32((pPopCtx + 0x04) >>> 0) >>> 0, 2)
          nRemaining = (nRemaining - 1) | 0
        }

        let nClusterIdx = 1
        let bSpotFound = 1
        while (true) {
          const half = nClusterIdx >> 1
          if (half > 0) {
            if (rollLimitedSeed64InMem113c(m, pObjSeed, half) !== 0) break
          }
          if (bSpotFound === 0) break

          bSpotFound = 0
          const nMaxTries = imul32(nRemaining < 4 ? 4 : nRemaining, 3)
          for (let t = 0; t < nMaxTries; t++) {
            const dir = stepSeed64InMem113c(m, pObjSeed) & 7
            const stepX = (((stepSeed64InMem113c(m, pObjSeed) >>> 0) % 5) + 5) | 0
            curX = (curX + (imul32(stepX, NEIGHBOR8_DX_6FD2E00C[dir]!) << 1)) | 0
            const stepY = (((stepSeed64InMem113c(m, pObjSeed) >>> 0) % 5) + 5) | 0
            curY = (curY + (imul32(stepY, NEIGHBOR8_DY_6FD2E02C[dir]!) << 1)) | 0
            m.setU32(pPos, curX >>> 0)
            m.setU32((pPos + 4) >>> 0, curY >>> 0)
            bSpotFound = OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(
              m,
              pRoomCoords,
              pPos,
              3,
              pRoom,
              3,
            ) | 0
            if (bSpotFound !== 0) break
          }
          if (bSpotFound === 0) continue

          const pClassSeed2 = m.u32((pPopCtx + 0x0c) >>> 0) >>> 0
          const nClassId2 = (stepSeed64InMem113c(m, pClassSeed2) & 1) !== 0 ? 0x194 : 0x193
          m.fill(pSpawnArgs, 0x28, 0)
          m.setU32((pSpawnArgs + 0x00) >>> 0, pGame)
          m.setU32((pSpawnArgs + 0x04) >>> 0, pRoom)
          m.setU32((pSpawnArgs + 0x08) >>> 0, 0)
          m.setU32((pSpawnArgs + 0x0c) >>> 0, nClassId2 >>> 0)
          m.setU32((pSpawnArgs + 0x10) >>> 0, 1)
          m.setU32((pSpawnArgs + 0x14) >>> 0, 0)
          m.setU32((pSpawnArgs + 0x18) >>> 0, curX >>> 0)
          m.setU32((pSpawnArgs + 0x1c) >>> 0, curY >>> 0)
          m.setU32((pSpawnArgs + 0x20) >>> 0, 0xffffffff)
          m.setU16((pSpawnArgs + 0x24) >>> 0, 0)
          nClusterIdx = (nClusterIdx + 1) | 0

          const pMon2 = MONSTER_Create113c(
            m,
            pSpawnArgs,
            hooks !== undefined ? hooks.regpop : undefined,
          ) >>> 0
          if (pMon2 !== 0) {
            UNITS_ChangeAnimMode113c(m, m.u32((pPopCtx + 0x04) >>> 0) >>> 0, 2)
            nRemaining = (nRemaining - 1) | 0
          }
        }
      }
      nAttempts = (nAttempts - 1) | 0
    }
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [37/45] Populates a line of border objects (`0x6FD2E334[group*2 + bit]`) along either
 * the top (`bit == 0`: `y = subY + 1`, `x` step `2 * sizeX`) or left (`bit == 1`: `x = subX + 1`,
 * `y` step `2 * sizeY`) edge of `pRoom`, rolling `bit` on `pGame->pObjectControl (+0x10F0)`.
 *
 * @va D2Game:0x6FC4FA90
 */
export function OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  pRoomCoords: number,
  nEdgeGroupIdx: number,
  _unusedFixedCoord = 0,
  _unusedDensity = 0,
): number {
  hitD2GameVa113c(0x6FC4FA90)
  const groupIdx = nEdgeGroupIdx | 0
  let nMaxGroups = m.u32(0x6fd2e344) | 0
  if (nMaxGroups <= 0) nMaxGroups = 2
  if (groupIdx >= nMaxGroups) return 1

  const pObjSeed = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  const bit = stepSeed64InMem113c(m, pObjSeed) & 1
  const objTableIdx = (bit + (groupIdx << 1)) | 0
  const nObjId = readEdgeObjTable113c(m, objTableIdx)

  const pObjRec = DATATBLS_GetObjectsTxtRecord113c(m, nObjId) >>> 0
  const nSizeX = pObjRec !== 0 ? (m.u32((pObjRec + 0xd0) >>> 0) | 0) : 1
  const nSizeY = pObjRec !== 0 ? (m.u32((pObjRec + 0xd4) >>> 0) | 0) : 1

  const subX = m.u32(pRoomCoords >>> 0) | 0
  const subY = m.u32((pRoomCoords + 4) >>> 0) | 0
  const subW = m.u32((pRoomCoords + 8) >>> 0) | 0
  const subH = m.u32((pRoomCoords + 12) >>> 0) | 0
  const endX = ((subW - nSizeX) + subX) >>> 0
  const endY = ((subH - nSizeY) + subY) >>> 0

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x10) >>> 0
  try {
    if (bit === 0) {
      if (nSizeX <= 0) return 1
      const fixedY = (subY + 1) | 0
      let curX = (subX + nSizeX) >>> 0
      m.setU32((sp + 4) >>> 0, fixedY >>> 0)
      while (curX < endX) {
        m.setU32(sp, curX)
        if (OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(m, pRoomCoords, sp, nSizeX, pRoom, nSizeY) === 1) {
          if (pRoom === 0) {
            throw new D2CommonAssertError('Objects.cpp', 0xb12)
          }
          const spawnId = readEdgeObjTable113c(m, groupIdx << 1)
          allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, spawnId, curX | 0, fixedY, 0)
        }
        curX = (curX + ((nSizeX << 1) >>> 0)) >>> 0
      }
    } else {
      if (nSizeY <= 0) return 1
      const fixedX = (subX + 1) | 0
      let curY = (subY + nSizeY) >>> 0
      m.setU32(sp, fixedX >>> 0)
      while (curY < endY) {
        m.setU32((sp + 4) >>> 0, curY)
        if (OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(m, pRoomCoords, sp, nSizeX, pRoom, nSizeY) === 1) {
          if (pRoom === 0) {
            throw new D2CommonAssertError('Objects.cpp', 0xb25)
          }
          const spawnId = readEdgeObjTable113c(m, objTableIdx)
          allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, spawnId, fixedX, curY | 0, 0)
        }
        curY = (curY + ((nSizeY << 1) >>> 0)) >>> 0
      }
    }
  } finally {
    w3b2ScratchSp = sp
  }
  return 1
}

/**
 * [38/45] Populates a step-2 grid of barrels (`(seed & 3) == 0 ? 11 : 7`, up to `32` spawned)
 * within `pRect` (`endX = x + w + 1`, `endY = y + h + 1`), checking margin-2 clearance.
 *
 * @va D2Game:0x6FC4FEC0
 */
export function OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  pRoomCoords: number,
  pRect = 0,
  _unusedDensity = 0,
): number {
  hitD2GameVa113c(0x6FC4FEC0)
  const rectPtr = pRect !== 0 ? (pRect >>> 0) : (pRoomCoords >>> 0)
  const startX = m.u32(rectPtr) >>> 0
  const startY = m.u32((rectPtr + 4) >>> 0) >>> 0
  const endX = (startX + (m.u32((rectPtr + 8) >>> 0) >>> 0) + 1) >>> 0
  const endY = (startY + (m.u32((rectPtr + 12) >>> 0) >>> 0) + 1) >>> 0

  const pObjRec = DATATBLS_GetObjectsTxtRecord113c(m, 7) >>> 0
  const nSizeX = pObjRec !== 0 ? (m.u32((pObjRec + 0xd0) >>> 0) | 0) : 1
  const nSizeY = pObjRec !== 0 ? (m.u32((pObjRec + 0xd4) >>> 0) | 0) : 1
  const pObjSeed = m.u32((pGame + 0x10f0) >>> 0) >>> 0

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x10) >>> 0
  let nSpawned = 0
  try {
    for (let curX = startX; curX < endX; curX = (curX + 2) >>> 0) {
      for (let curY = startY; curY < endY; curY = (curY + 2) >>> 0) {
        const lo = stepSeed64InMem113c(m, pObjSeed)
        const nObjId = (lo & 3) === 0 ? 0x0b : 0x07
        m.setU32(sp, curX)
        m.setU32((sp + 4) >>> 0, curY)
        if (OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(m, rectPtr, sp, pRoom, nSizeX, nSizeY) === 1) {
          if (pRoom === 0) {
            throw new D2CommonAssertError('Objects.cpp', 0xa88)
          }
          allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, nObjId, curX | 0, curY | 0, 0)
          nSpawned = (nSpawned + 1) | 0
          if (nSpawned >= 0x20) return 1
        }
      }
    }
  } finally {
    w3b2ScratchSp = sp
  }
  return 1
}

/**
 * [39/45] Populates clusters of crates/containers (`nObjId == 0x2E` or table `0x6FD2E1F8`)
 * in `pRoom`, enforcing `densityByte <= 0x80` (`Objects.cpp:0x9D7`), probability roll `<= wProb`,
 * and cluster growth up to `8` spawned objects, returning the last spawned object unit.
 *
 * @va D2Game:0x6FC50150
 */
export function OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nDensity: number,
  nObjId = 0x2e,
  wProb = 100,
): number {
  hitD2GameVa113c(0x6FC50150)
  const pObjRec = DATATBLS_GetObjectsTxtRecord113c(m, nObjId | 0) >>> 0
  const densityByte = nDensity & 0xff
  if (densityByte > 0x80) {
    throw new D2CommonAssertError('Objects.cpp', 0x9d7)
  }

  const pObjSeed = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  if (((stepSeed64InMem113c(m, pObjSeed) >>> 0) % 100) > (wProb & 0xffff)) {
    return 0
  }

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x28) >>> 0
  try {
    const pPos = sp
    const pRoomCoords = (sp + 0x10) >>> 0
    m.fill(sp, 0x28, 0)

    DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
    const subX = m.u32(pRoomCoords) | 0
    const subY = m.u32((pRoomCoords + 4) >>> 0) | 0
    const subW = m.u32((pRoomCoords + 8) >>> 0) | 0
    const subH = m.u32((pRoomCoords + 12) >>> 0) | 0

    let nRemaining = (imul32(imul32(subW, subH) >> 7, densityByte) >> 8) | 0
    let nAttempts = (nRemaining * 2) | 0
    let nSubCap = (nRemaining * 4) | 0
    let nTotalSpawned = 0
    let pLastUnit = 0

    const nSizeX = pObjRec !== 0 ? (m.u32((pObjRec + 0xd0) >>> 0) | 0) : 1
    const nSizeY = pObjRec !== 0 ? (m.u32((pObjRec + 0xd4) >>> 0) | 0) : 1
    const nStepX = pObjRec !== 0 ? m.u8((pObjRec + 0x162) >>> 0) : 1
    const nStepY = pObjRec !== 0 ? m.u8((pObjRec + 0x163) >>> 0) : 1

    while (nRemaining > 0 && nAttempts > 0) {
      let chosenId = nObjId | 0
      if (chosenId !== 0x2e) {
        let nTableMax = m.u32(0x6fd2e224) | 0
        if (nTableMax <= 0) nTableMax = 5
        const idx = rollLimitedSeed64InMem113c(m, pObjSeed, nTableMax)
        chosenId = readCrateObjTable113c(m, idx)
      }

      let curX = (rollLimitedSeed64InMem113c(m, pObjSeed, subW) + subX) | 0
      let curY = (rollLimitedSeed64InMem113c(m, pObjSeed, subH) + subY) | 0
      m.setU32(pPos, curX >>> 0)
      m.setU32((pPos + 4) >>> 0, curY >>> 0)

      if (OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(m, pRoomCoords, pPos, pRoom, nSizeX, nSizeY) === 1) {
        if (chosenId !== 0x2e) {
          let nTableMax = m.u32(0x6fd2e224) | 0
          if (nTableMax <= 0) nTableMax = 5
          const idx = rollLimitedSeed64InMem113c(m, pObjSeed, nTableMax)
          chosenId = readCrateObjTable113c(m, idx)
        }
        if (pRoom === 0) {
          throw new D2CommonAssertError('Objects.cpp', 0xa06)
        }
        allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, chosenId, curX, curY, 0)

        let bSpotFound = 1
        pLastUnit = 0
        let nClusterIdx = 1
        while (true) {
          const half = nClusterIdx >> 1
          if (half > 0) {
            if (rollLimitedSeed64InMem113c(m, pObjSeed, half) !== 0) break
          }
          if (bSpotFound === 0) break

          bSpotFound = 0
          const nMaxTries = nSubCap < 4 ? 4 : nSubCap
          for (let t = 0; t < nMaxTries; t++) {
            const dir = stepSeed64InMem113c(m, pObjSeed) & 7
            curX = (curX + imul32(nStepX, NEIGHBOR8_DX_6FD2E00C[dir]!)) | 0
            curY = (curY + imul32(nStepY, NEIGHBOR8_DY_6FD2E02C[dir]!)) | 0
            m.setU32(pPos, curX >>> 0)
            m.setU32((pPos + 4) >>> 0, curY >>> 0)
            bSpotFound = OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(
              m,
              pRoomCoords,
              pPos,
              pRoom,
              nSizeX,
              nSizeY,
            ) | 0
            if (bSpotFound !== 0) break
          }
          if (bSpotFound === 0) continue

          const pUnit = allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, chosenId, curX, curY, 0) >>> 0
          if (pUnit === 0) {
            pLastUnit = 0
            nClusterIdx = (nClusterIdx + 1) | 0
            continue
          }
          pLastUnit = pUnit
          nTotalSpawned = (nTotalSpawned + 1) | 0
          if (nTotalSpawned >= 8) {
            return pUnit
          }
          nClusterIdx = (nClusterIdx + 1) | 0
        }

        nRemaining = (nRemaining - 1) | 0
        nSubCap = (nSubCap - 4) | 0
      }
      nAttempts = (nAttempts - 1) | 0
    }
    return pLastUnit
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [40/45] Populates clusters of barrel objects (`7` or `11`) in `pRoom`, enforcing
 * `densityByte <= 0x80` (`Objects.cpp:0x955`), probability roll `<= wProb`, center roll
 * `(seed % 3) == 0 ? 11 : 7`, neighbor roll `(seed & 3) == 0 ? 11 : 7`, up to `8` spawned
 * objects total, returning the last spawned object unit.
 *
 * @va D2Game:0x6FC50800
 */
export function OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nDensity: number,
  _unusedObjId = 7,
  wProb = 100,
): number {
  hitD2GameVa113c(0x6FC50800)
  const pObjRec = DATATBLS_GetObjectsTxtRecord113c(m, 7) >>> 0
  const densityByte = nDensity & 0xff
  if (densityByte > 0x80) {
    throw new D2CommonAssertError('Objects.cpp', 0x955)
  }

  const pObjSeed = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  if (((stepSeed64InMem113c(m, pObjSeed) >>> 0) % 100) > (wProb & 0xffff)) {
    return 0
  }

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x28) >>> 0
  try {
    const pPos = sp
    const pRoomCoords = (sp + 0x10) >>> 0
    m.fill(sp, 0x28, 0)

    DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
    const subX = m.u32(pRoomCoords) | 0
    const subY = m.u32((pRoomCoords + 4) >>> 0) | 0
    const subW = m.u32((pRoomCoords + 8) >>> 0) | 0
    const subH = m.u32((pRoomCoords + 12) >>> 0) | 0

    let nRemaining = (imul32(imul32(subW, subH) >> 7, densityByte) >> 8) | 0
    let nAttempts = (nRemaining * 2) | 0
    let nTotalSpawned = 0
    let pLastUnit = 0

    const nSizeX = pObjRec !== 0 ? (m.u32((pObjRec + 0xd0) >>> 0) | 0) : 1
    const nSizeY = pObjRec !== 0 ? (m.u32((pObjRec + 0xd4) >>> 0) | 0) : 1
    const nStepX = pObjRec !== 0 ? m.u8((pObjRec + 0x162) >>> 0) : 1
    const nStepY = pObjRec !== 0 ? m.u8((pObjRec + 0x163) >>> 0) : 1

    while (nRemaining > 0 && nAttempts > 0) {
      const centerObjId = ((stepSeed64InMem113c(m, pObjSeed) >>> 0) % 3) === 0 ? 0x0b : 0x07
      let curX = (rollLimitedSeed64InMem113c(m, pObjSeed, subW) + subX) | 0
      let curY = (rollLimitedSeed64InMem113c(m, pObjSeed, subH) + subY) | 0
      m.setU32(pPos, curX >>> 0)
      m.setU32((pPos + 4) >>> 0, curY >>> 0)

      if (OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(m, pRoomCoords, pPos, pRoom, nSizeX, nSizeY) === 1) {
        if (pRoom === 0) {
          throw new D2CommonAssertError('Objects.cpp', 0x98d)
        }
        const pCenter = allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, centerObjId, curX, curY, 0) >>> 0
        nTotalSpawned = (nTotalSpawned + 1) | 0
        if (nTotalSpawned >= 8) {
          return pCenter
        }

        let nClusterIdx = 1
        let bSpotFound = 1
        pLastUnit = 0
        while (true) {
          const half = nClusterIdx >> 1
          if (half > 0) {
            if (rollLimitedSeed64InMem113c(m, pObjSeed, half) !== 0) break
          }
          if (bSpotFound === 0) break

          bSpotFound = 0
          for (let t = 0; t < 0x0f; t++) {
            const dir = stepSeed64InMem113c(m, pObjSeed) & 7
            curX = (curX + imul32(nStepX, NEIGHBOR8_DX_6FD2E00C[dir]!)) | 0
            curY = (curY + imul32(nStepY, NEIGHBOR8_DY_6FD2E02C[dir]!)) | 0
            m.setU32(pPos, curX >>> 0)
            m.setU32((pPos + 4) >>> 0, curY >>> 0)
            bSpotFound = OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(
              m,
              pRoomCoords,
              pPos,
              pRoom,
              nSizeX,
              nSizeY,
            ) | 0
            if (bSpotFound !== 0) break
          }
          if (bSpotFound === 0) continue

          const nbrObjId = (stepSeed64InMem113c(m, pObjSeed) & 3) === 0 ? 0x0b : 0x07
          const pUnit = allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, nbrObjId, curX, curY, 0) >>> 0
          pLastUnit = pUnit
          nTotalSpawned = (nTotalSpawned + 1) | 0
          nClusterIdx = (nClusterIdx + 1) | 0
          if (nTotalSpawned >= 8) {
            return pLastUnit
          }
        }
        nRemaining = (nRemaining - 1) | 0
      }
      nAttempts = (nAttempts - 1) | 0
    }
    return pLastUnit
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [41/45] Queries `UNITS_GetRoom113c(pUnit)`, rolls `pGame->pObjectControl->tSeed`
 * (`> 0x46` out of `100`), reads target coordinates via `PATH_GetTargetTypeAndPosition113c`,
 * asserts non-null `pRoom` (`Objects.cpp:0x79A`), and spawns object `0x67`.
 *
 * @va D2Game:0x6FC50E50
 */
export function OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC50E50)
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  const pObjCtrl = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  const nRoll = (stepSeed64InMem113c(m, pObjCtrl) >>> 0) % 100
  if (nRoll <= 0x46) return

  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x18) >>> 0
  try {
    m.fill(sp, 0x18, 0)
    PATH_GetTargetTypeAndPosition113c(m, pUnit, sp)
    if (pRoom === 0) {
      throw new D2CommonAssertError('Objects.cpp', 0x79a)
    }
    const x = m.u32(sp) | 0
    const y = m.u32((sp + 4) >>> 0) | 0
    allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, 0x67, x, y, 0)
  } finally {
    w3b2ScratchSp = sp
  }
}

/**
 * [42/45] Spawns an object in `pRoom` along a wall side (`nWallSide`: `1`, `2`, or general)
 * after validating collision (`0x3F11`) and a caller-supplied placement predicate.
 *
 * @va D2Game:0x6FC517F0
 */
export function OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  nObjectId: number,
  nSizeX: number,
  nSizeY: number,
  pRoom: number,
  nWallSide: number,
  pCallbackCtx: number,
  pfnCallback: number,
  hooks?: K2W3B2Hooks113c,
): number {
  hitD2GameVa113c(0x6FC517F0)
  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x20) >>> 0
  let subX = 0
  let subY = 0
  let subW = 0
  let subH = 0
  try {
    m.fill(sp, 0x20, 0)
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    subX = m.u32(sp) | 0
    subY = m.u32((sp + 4) >>> 0) | 0
    subW = m.u32((sp + 8) >>> 0) | 0
    subH = m.u32((sp + 12) >>> 0) | 0
  } finally {
    w3b2ScratchSp = sp
  }

  if (subW < ((nSizeX + 2) | 0) || subH < ((nSizeY + 2) | 0)) {
    return 0
  }

  const pSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0
  let x = 0
  let y = 0
  let attempt = 0

  for (; attempt < 5; attempt++) {
    if (nWallSide === 1) {
      const rX = SEED_RollLimitedFast113c(m, pSeed, Math.trunc(subW / 2)) | 0
      x = (subX + rX + Math.trunc(subW / 4)) | 0
      const rY = SEED_RollRangeHalfOpen113c(m, pSeed, 1, 2) | 0
      y = (subY + rY) | 0
    } else if (nWallSide === 2) {
      const rX = SEED_RollRangeHalfOpen113c(m, pSeed, 1, 2) | 0
      x = (subX + rX) | 0
      const rY = SEED_RollLimitedFast113c(m, pSeed, Math.trunc(subH / 2)) | 0
      y = (subY + rY + Math.trunc(subH / 4)) | 0
    } else {
      const rX = SEED_RollLimitedFast113c(m, pSeed, (subW - nSizeX - 1) | 0) | 0
      x = (subX + rX) | 0
      const rY = SEED_RollLimitedFast113c(m, pSeed, (subH - nSizeY - 1) | 0) | 0
      y = (subY + rY) | 0
    }

    if (x === 0 || y === 0) continue
    const x16 = x & 0xffff
    const y16 = y & 0xffff
    if (x16 < ((subX + 1) | 0)) continue
    if (y16 < ((subY + 1) | 0)) continue
    if (x16 >= ((subX + subW - 1) | 0)) continue
    if (y16 >= ((subY + subH - 1) | 0)) continue

    if (pfnCallback === 0 && (hooks === undefined || hooks.onObjectPosValidate === undefined)) {
      throw new D2CommonAssertError('Objects.cpp', 0x634)
    }
    const wHit = COLLISION_CheckMaskWithSizeXY113c(
      m,
      pRoom,
      x,
      y,
      (nSizeX + 6) | 0,
      (nSizeY + 6) | 0,
      0x3f11,
    ) & 0xffff
    if (wHit === 0) {
      const bOk =
        hooks !== undefined && hooks.onObjectPosValidate !== undefined
          ? hooks.onObjectPosValidate(m, pGame >>> 0, pCallbackCtx, x, y) & 0xff
          : 1
      if (bOk !== 0) break
    }
  }

  if (attempt >= 5) return 0
  if (pRoom === 0) {
    throw new D2CommonAssertError('Objects.cpp', 0x64d)
  }
  return allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, nObjectId, x, y, 0)
}

/**
 * [43/45] Spawns a random object in `pRoom` after validating collision (`0x3F11`)
 * and a caller-supplied placement predicate.
 *
 * @va D2Game:0x6FC51B40
 */
export function OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c(
  m: D2KernMemory113c,
  pGame: number,
  nObjectId: number,
  nSizeX: number,
  nSizeY: number,
  pRoom: number,
  pCallbackCtx: number,
  pfnCallback: number,
  hooks?: K2W3B2Hooks113c,
): number {
  hitD2GameVa113c(0x6FC51B40)
  const sp = w3b2ScratchSp
  w3b2ScratchSp = (sp + 0x20) >>> 0
  let subX = 0
  let subY = 0
  let subW = 0
  let subH = 0
  try {
    m.fill(sp, 0x20, 0)
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    subX = m.u32(sp) | 0
    subY = m.u32((sp + 4) >>> 0) | 0
    subW = m.u32((sp + 8) >>> 0) | 0
    subH = m.u32((sp + 12) >>> 0) | 0
  } finally {
    w3b2ScratchSp = sp
  }

  if (subW < 2 || subH < 2 || subW <= (nSizeX | 0) || subH <= (nSizeY | 0)) {
    return 0
  }

  const pSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0
  let x = 0
  let y = 0
  let attempt = 0

  for (; attempt < 5; attempt++) {
    const rX = SEED_RollLimitedFast113c(m, pSeed, (subW - nSizeX - 1) | 0) | 0
    x = (subX + rX) | 0
    const rY = SEED_RollLimitedFast113c(m, pSeed, (subH - nSizeY - 1) | 0) | 0
    y = (subY + rY) | 0

    if (x === 0 || y === 0) continue
    const x16 = x & 0xffff
    const y16 = y & 0xffff
    if (x16 < ((subX + 1) | 0)) continue
    if (y16 < ((subY + 1) | 0)) continue
    if (x16 >= ((subX + subW - 1) | 0)) continue
    if (y16 >= ((subY + subH - 1) | 0)) continue

    if (pfnCallback === 0 && (hooks === undefined || hooks.onObjectPosValidate === undefined)) {
      throw new D2CommonAssertError('Objects.cpp', 0x588)
    }
    const wHit = COLLISION_CheckMaskWithSizeXY113c(
      m,
      pRoom,
      x,
      y,
      (nSizeX + 6) | 0,
      (nSizeY + 6) | 0,
      0x3f11,
    ) & 0xffff
    if (wHit === 0) {
      const bOk =
        hooks !== undefined && hooks.onObjectPosValidate !== undefined
          ? hooks.onObjectPosValidate(m, pGame >>> 0, pCallbackCtx, x, y) & 0xff
          : 1
      if (bOk !== 0) break
    }
  }

  if (attempt >= 5) return 0
  if (pRoom === 0) {
    throw new D2CommonAssertError('Objects.cpp', 0x593)
  }
  return allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, nObjectId, x, y, 0)
}

/**
 * [44/45] Spawns a preset torch/brazier object at `(x, y)` in `pRoom` by rolling
 * act/level-specific object IDs on `pGame->pObjectControl->tSeed` (or keeping `0x173`).
 *
 * @va D2Game:0x6FC522B0
 */
export function OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nObjectId: number,
  x: number,
  y: number,
  _nInitMode = 0,
): number {
  hitD2GameVa113c(0x6FC522B0)
  const nLevelId0 = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId0) & 0xff
  const pSeed = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0

  let nChosenObjId: number
  if (nAct === 1) {
    if (nLevelId === 0x4a) {
      const r = stepSeed64InMem113c(m, pSeed) & 3
      const table4A: readonly [number, number, number, number] = [0x183, 0x185, 0x186, 0x187]
      nChosenObjId = table4A[r]!
    } else {
      const r = stepSeed64InMem113c(m, pSeed) & 1
      nChosenObjId = r === 0 ? 0x57 : 0x58
    }
  } else if (nAct === 2) {
    if (nLevelId === 0x53) {
      const r = stepSeed64InMem113c(m, pSeed) & 3
      const table53: readonly [number, number, number, number] = [0x149, 0x14a, 0x14b, 0x14c]
      nChosenObjId = table53[r]!
    } else {
      const r = stepSeed64InMem113c(m, pSeed) & 1
      nChosenObjId = r === 0 ? 0xb5 : 0xb7
    }
  } else {
    const r = (stepSeed64InMem113c(m, pSeed) >>> 0) % 13
    const tableDefault: readonly number[] = [
      0x05, 0x06, 0x8b, 0x8c, 0x8d, 0x90, 0xb0, 0xb1, 0xc6, 0xf0, 0xf1, 0xf2, 0xf3,
    ]
    nChosenObjId = tableDefault[r]!
  }

  if ((nObjectId | 0) === 0x173) {
    nChosenObjId = 0x173
  }
  if (pRoom === 0) {
    throw new D2CommonAssertError('Objects.cpp', 0x157)
  }
  return allocInitAndPlaceObjectUnit113c(m, pGame, pRoom, nChosenObjId, x, y, 0)
}

/**
 * [45/45] Spawns a preset shrine object (`0x23E..0x243`) at `(x, y)` in `pRoom` using
 * the shrine group range table at `0x6FD1CCC0` and attaches its shrine record via
 * `UNITS_SetObjectShrineTxt113c`.
 *
 * @va D2Game:0x6FC525C0
 */
export function OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nObjectId: number,
  x: number,
  y: number,
  nInitMode = 0,
): number {
  hitD2GameVa113c(0x6FC525C0)
  const objId = nObjectId | 0
  if (objId < 0x23e || objId > 0x243) {
    return 0
  }
  if (pRoom === 0) {
    throw new D2CommonAssertError('Objects.cpp', 0xde)
  }

  const entry = PRESET_SHRINE_GROUP_TABLE_6FD1CCC0[objId - 0x23e]!
  const nActualClassId = entry[0]
  const nMinShrine = entry[1]
  const nMaxShrine = entry[2]

  const pUnit = allocInitAndPlaceObjectUnit113c(
    m,
    pGame,
    pRoom,
    nActualClassId,
    x,
    y,
    nInitMode,
  ) >>> 0
  if (pUnit === 0) return 0

  const nRange = (nMaxShrine - nMinShrine) | 0
  const nRoll = SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, nRange) | 0
  let nShrineId = (nMinShrine + nRoll) | 0
  if (nShrineId === 5 || nShrineId === 4) {
    nShrineId = 2
  }
  const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  m.setU8((pObjData + 0x04) >>> 0, nShrineId & 0xff)
  const pShrineTxt = DATATBLS_GetObjGroupTxtRecord113c(m, nShrineId) >>> 0
  UNITS_SetObjectShrineTxt113c(m, pUnit, pShrineTxt)
  return pUnit
}
