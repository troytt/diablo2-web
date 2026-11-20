/**
 * Diablo II v1.13c `D2Game.dll` Core & Combat Pipeline (`[K2]` Wave 3 Batch 4 `w3b4`):
 * 45 `MISSILE`, `SKILLS`, `CLIENTS`, and `REGPOP` functions (`0x6FC60070 .. 0x6FC6F4D0`,
 * image base `0x6FC20000`).
 *
 * Every exported function is a 1:1 instruction-faithful `Memory113c` translation of the
 * `D2Game.dll` v1.13c x86 machine code, with zero array ordering helpers, zero nullish
 * coalescing, zero Node/DOM globals, and zero cross-layer imports.
 */

import {
  COLLISION_SetMaskWithPattern113c,
  COLLISION_SetSubtileMask113c,
} from '../common/collision.ts'
import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { SEED_GetLowSeed113c } from '../common/drlg/drlg-grid.ts'
import { PATH_CheckFlag08_113c } from '../common/drlg/room-tile.ts'
import { DUNGEON_GetRoomCoordListIndexAtSubtile113c } from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32, mulDiv113c, sdiv32, smod32 } from '../common/int-math.ts'
import { INVENTORY_UpdateEquippedGfxAndColor113c } from '../common/inventory.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  MISSILE_GetElapsedFrames113c,
  MISSILE_GetLevel113c,
  MISSILE_GetRemainingFrames113c,
  MISSILE_GetSkill113c,
  MISSILE_GetTargetX113c,
  MISSILE_GetTargetY113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MONSTERS_GetHirelingTypeId113c,
} from '../common/missile.ts'
import {
  PATH_Compute113c,
  PATH_ComputeSquaredDistance113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_GetVelocity113c,
  PATH_SetTargetPos113c,
  UNITS_GetDirectionToCoords113c,
} from '../common/path.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvalParam12DimReturns113c,
  SKILLS_GetParam1113c,
  SKILLS_GetSkillElemMaxDamage113c,
  SKILLS_GetSkillElemMinDamage113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_IsSelectableCorpse11157_113c,
  SKILLS_SetParam1113c,
} from '../common/skills.ts'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  STATES_CheckState113c,
  STATES_ClearGfxStateFlag113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetOwnerId113c,
  STATLIST_GetOwnerType113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist.ts'
import {
  UNITROOM_RefreshUnit113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
  UNITS_SetUnitAnimMode113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SEED_InitLowSeed113c } from '../prng.ts'
import {
  DATATBLS_GetCharTemplateStartLevel113c,
  DATATBLS_NormalizeDirection113c,
} from '../tables/datatbls-113c.ts'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c.ts'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  MONSTER_CheckTypeFlagsMask113c,
} from './ai-fallen-113c.ts'
import {
  SEED_RollLimitedRandomNumber113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_ExecuteEvents113c,
} from './combat-a1c-113c.ts'
import { SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c } from './k2-real-s2c-combat-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  AURA_ForEachUnitInRadius113c,
  ITEMS_RegisterItemEventCallback113c,
  STATES_CreateOrUpdateAuraStatList113c,
  SUNITDMG_AddElementalDamageToStruct113c,
  SUNIT_AreUnitsInSamePartyOrAligned113c,
} from './k2-gap-itemdef-113c.ts'
import {
  ITEMEVENT_RemoveByTypeAndState113c,
  MISSILES_GetTxtRecordFast113c,
  MISSILE_CreateServerProjectile113c,
  MISSILE_ProcessTargetCollisionHit113c,
  MISSILE_SrvDo01_LinearProjectile113c,
  SKILLS_ResolveChargedSrvMissileId113c,
  STATES_OnTimedStateRemoved113c,
  type K2GapMeleeDotHooks113c,
} from './k2-gap-melee-dot-113c.ts'
import {
  MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c,
  SKILLS_GetParam3Fast_6FC21BF0_113c,
  SKILLS_GetParam4Fast_6FC21C20_113c,
  SKILLS_GetParam5Fast_6FC21C50_113c,
  SKILLS_GetParam6Fast_6FC21EC0_113c,
} from './k2-laneH-0x6fc2-w1-113c.ts'
import {
  MISSILES_InitChargedBoltPath_6FC61F50_113c,
  MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c,
} from './k2-laneK-0x6fc5-w1-113c.ts'
import {
  CLIENTS_SetClientInitState_6FC69B70_113c,
  SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c,
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c,
  SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c,
  SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c,
  SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c,
  SKILLS_InitNecroWarriorSkeletonComponents_6FC6E960_113c,
} from './k2-laneL-0x6fc6-w1-113c.ts'
import {
  SKILLS_DeductFromStatPool113c,
  SUNIT_GetOwnerUnit113c,
} from './k2-sunit-spawn-w1-113c.ts'
import { SKILLS_DispatchSrvDoFunc_6FCBE420_113c } from './k2-w2b4-113c.ts'
import {
  ARENA_CheckFlagBit8_6FCD2620_113c,
  ARENA_GetModeByte_6FCD22D0_113c,
  SKILLS_TargetRingScanCallback_6FCBED70_113c,
} from './k2-w2b5-113c.ts'
import { SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c } from './k2-w2b8-113c.ts'
import { SUNIT_IsDeadOrDying113c } from './monster-events.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS_GetRecordPtr113c,
  MONSTER_Create113c,
  REGPOP_GetSpawnBoxSubtiles113c,
  SEED_RollLimitedFast113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

export type D2KernMemory113c = Memory113c

let k2W3B4StackPtr = 0x7ef10000

const D2GAME_RING_SIN_TABLE_6FD1C960_113C: readonly number[] = [
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
]

const D2GAME_RING_COS_TABLE_6FD1CA60_113C: readonly number[] = [
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
]

const D2GAME_ABSORB_TABLE_6FD1C3E8_113C: readonly [number, number][] = [
  [8, 0],
  [16, 0],
  [28, 0],
  [36, 0],
  [32, 0],
  [56, 1],
  [60, 1],
  [64, 1],
]

function i32(m: D2KernMemory113c, p: number): number {
  return m.u32(p >>> 0) | 0
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function inlineUnitGetPosX113c(m: D2KernMemory113c, pUnit: number): number {
  const nType = i32(m, pUnit)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (nType === 2 || (nType > 3 && nType <= 5)) {
    return i32(m, (pPath + 0x0c) >>> 0)
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function inlineUnitGetPosY113c(m: D2KernMemory113c, pUnit: number): number {
  const nType = i32(m, pUnit)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (nType === 2 || (nType > 3 && nType <= 5)) {
    return i32(m, (pPath + 0x10) >>> 0)
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

function zeroWords113c(m: D2KernMemory113c, base: number, count: number): void {
  for (let i = 0; i < count; i = (i + 1) | 0) {
    m.setU32((base + ((i << 2) >>> 0)) >>> 0, 0)
  }
}

/**
 * Periodically spawns a scattered sub-missile around `pMissile` within `Param2`/`CltCalc1` radius
 * using the low seed stored in `MISSILE_GetTargetX`, then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC60070
 */
export function MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC60070)
  if (pMissile === 0) {
    return 2
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0 || sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) < 0) {
    return 2
  }
  const nSkillId = MISSILE_GetSkill113c(m, pMissile) | 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0) {
    return 2
  }
  const nLevel = MISSILE_GetLevel113c(m, pMissile) | 0
  const pOwner = SUNIT_GetOwnerUnit113c(m, pMissile, pGame) >>> 0
  if (pOwner !== 0) {
    let nRadius = i32(m, (pMissilesTxt + 0x3c) >>> 0)
    if (nRadius <= 0) {
      nRadius = SKILLS_EvalCalcByOffset113c(
        m,
        pOwner,
        i32(m, (pSkillsTxt + 0x64) >>> 0),
        nSkillId,
        nLevel,
      ) | 0
      if (nRadius < 1) {
        nRadius = 1
      }
    }
    let nStep = i32(m, (pMissilesTxt + 0x38) >>> 0)
    if (nStep <= 0) {
      nStep = SKILLS_EvalCalcByOffset113c(
        m,
        pOwner,
        i32(m, (pSkillsTxt + 0x144) >>> 0),
        nSkillId,
        nLevel,
      ) | 0
      if (nStep < 1) {
        nStep = 1
      }
    }
    const nElapsed = MISSILE_GetElapsedFrames113c(m, pMissile) | 0
    if (
      nElapsed > i32(m, (pMissilesTxt + 0x40) >>> 0) &&
      nElapsed < i32(m, (pMissilesTxt + 0x44) >>> 0) &&
      smod32(nElapsed, nStep) === 0
    ) {
      const pSeed = (pMissile + 0x20) >>> 0
      const lowSeed = MISSILE_GetTargetX113c(m, pMissile) | 0
      SEED_InitLowSeed113c(m, pSeed, lowSeed)
      const span = ((nRadius << 1) + 1) | 0
      const dx = (SEED_RollLimitedRandomNumber113c(m, pSeed, span) - nRadius) | 0
      const dy = (SEED_RollLimitedRandomNumber113c(m, pSeed, span) - nRadius) | 0
      const nextLowSeed = SEED_GetLowSeed113c(m, pSeed) | 0
      MISSILE_SetTargetX113c(m, pMissile, nextLowSeed)

      const savedSp = k2W3B4StackPtr
      const pParams = (savedSp - 0x60) >>> 0
      k2W3B4StackPtr = pParams
      try {
        zeroWords113c(m, pParams, 0x17)
        m.setU32(pParams, 0x520)
        m.setU32((pParams + 0x04) >>> 0, pOwner)
        m.setU32((pParams + 0x08) >>> 0, pMissile >>> 0)
        m.setU32((pParams + 0x10) >>> 0, sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) >>> 0)
        m.setU32((pParams + 0x1c) >>> 0, ((UNIT_GetPosX113c(m, pMissile) | 0) + dx) >>> 0)
        m.setU32((pParams + 0x20) >>> 0, ((UNIT_GetPosY113c(m, pMissile) | 0) + dy) >>> 0)
        m.setU32((pParams + 0x24) >>> 0, m.u32((pMissilesTxt + 0x48) >>> 0))
        m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
        m.setU32((pParams + 0x30) >>> 0, nLevel >>> 0)
        MISSILE_CreateServerProjectile113c(m, pGame, pParams)
      } finally {
        k2W3B4StackPtr = savedSp
      }
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
}

/**
 * Spawns a trail sub-missile at `pMissile`'s current position whenever `PATH_CheckFlag08` is set,
 * then advances `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC605E0
 */
export function MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC605E0)
  if (pMissile === 0) {
    return 2
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0 || sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) === 0) {
    return 2
  }
  if (PATH_CheckFlag08_113c(m, m.u32((pMissile + 0x2c) >>> 0)) !== 0) {
    const savedSp = k2W3B4StackPtr
    const pParams = (savedSp - 0x60) >>> 0
    k2W3B4StackPtr = pParams
    try {
      zeroWords113c(m, pParams, 0x17)
      const nParam1 = i32(m, (pMissilesTxt + 0x38) >>> 0)
      m.setU32(pParams, 1)
      if (nParam1 > 0) {
        m.setU32(pParams, 9)
        m.setU32((pParams + 0x34) >>> 0, nParam1 >>> 0)
      }
      const pOwner = SUNIT_GetOwnerUnit113c(m, pMissile, pGame) >>> 0
      m.setU32((pParams + 0x04) >>> 0, pOwner)
      m.setU32((pParams + 0x14) >>> 0, (UNIT_GetPosX113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x18) >>> 0, (UNIT_GetPosY113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x2c) >>> 0, (MISSILE_GetSkill113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x30) >>> 0, (MISSILE_GetLevel113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x10) >>> 0, sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame, pParams)
    } finally {
      k2W3B4StackPtr = savedSp
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
}

/**
 * Initializes perpendicular target offsets on frames `< 2` and spawns two opposing perpendicular
 * sub-missiles whenever `PATH_CheckFlag08` is set, then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC606D0
 */
export function MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC606D0)
  if (pMissile === 0) {
    return 2
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0 || sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) === 0) {
    return 2
  }
  const pPath = m.u32((pMissile + 0x2c) >>> 0) >>> 0
  if (pPath === 0) {
    return 2
  }
  const x = UNIT_GetPosX113c(m, pMissile) | 0
  const y = UNIT_GetPosY113c(m, pMissile) | 0
  if ((MISSILE_GetElapsedFrames113c(m, pMissile) | 0) < 2) {
    const pCurPath = m.u32((pMissile + 0x2c) >>> 0) >>> 0
    const dx = ((PATH_GetFirstPointX113c(m, pCurPath) | 0) - x) | 0
    const dy = (-(((PATH_GetFirstPointY113c(m, m.u32((pMissile + 0x2c) >>> 0)) | 0) - y) | 0)) | 0
    MISSILE_SetTargetX113c(m, pMissile, dy)
    MISSILE_SetTargetY113c(m, pMissile, dx)
  }
  if (PATH_CheckFlag08_113c(m, pPath) !== 0) {
    const savedSp = k2W3B4StackPtr
    const pParams = (savedSp - 0x60) >>> 0
    k2W3B4StackPtr = pParams
    try {
      zeroWords113c(m, pParams, 0x17)
      m.setU32(pParams, 0x0b)
      m.setU32((pParams + 0x04) >>> 0, SUNIT_GetOwnerUnit113c(m, pMissile, pGame) >>> 0)
      m.setU32((pParams + 0x14) >>> 0, x >>> 0)
      m.setU32((pParams + 0x18) >>> 0, y >>> 0)
      m.setU32((pParams + 0x2c) >>> 0, (MISSILE_GetSkill113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x30) >>> 0, (MISSILE_GetLevel113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x10) >>> 0, sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) >>> 0)
      m.setU32((pParams + 0x34) >>> 0, m.u32((pMissilesTxt + 0x38) >>> 0))
      m.setU32((pParams + 0x1c) >>> 0, (MISSILE_GetTargetX113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x20) >>> 0, (MISSILE_GetTargetY113c(m, pMissile) | 0) >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame, pParams)
      m.setU32((pParams + 0x1c) >>> 0, (-(MISSILE_GetTargetX113c(m, pMissile) | 0)) >>> 0)
      m.setU32((pParams + 0x20) >>> 0, (-(MISSILE_GetTargetY113c(m, pMissile) | 0)) >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame, pParams)
    } finally {
      k2W3B4StackPtr = savedSp
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
}

/**
 * Warps `pMissile` to its live owner's position and resets remaining frames to 10 while the owner
 * is alive, or triggers `MISSILE_ProcessTargetCollisionHit(..., 0, 1)` when owner is missing/dead.
 *
 * @va D2Game:0x6FC60860
 */
export function MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC60860)
  if (pMissile !== 0 && ((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const pOwner = SUNIT_GetServerUnit113c(
      m,
      pGame,
      i32(m, (pMissile + 0x94) >>> 0),
      i32(m, (pMissile + 0x98) >>> 0),
    ) >>> 0
    if (pOwner !== 0 && SUNIT_IsDeadOrDying113c(m, pOwner) === 0) {
      MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c(m, pGame, pMissile)
      MISSILE_SetRemainingFrames113c(m, pMissile, 10)
      MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame)
      return 1
    }
  }
  MISSILE_ProcessTargetCollisionHit113c(m, pMissile, pGame, 0, 1)
  return 2
}

/**
 * Periodically rotates and halves `(targetX, targetY)` into a spiral trajectory before `Param1`
 * frames elapse, recomputing `pMissile->pPath`, then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC60BD0
 */
export function MISSILE_SrvDo_SpiralPath_6FC60BD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC60BD0)
  if (pMissile === 0) {
    return 2
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0) {
    return 2
  }
  let nStep = i32(m, (pMissilesTxt + 0x3c) >>> 0)
  if (nStep < 1) {
    nStep = 1
  }
  const nElapsed = MISSILE_GetElapsedFrames113c(m, pMissile) | 0
  if (nElapsed < i32(m, (pMissilesTxt + 0x38) >>> 0) && smod32(nElapsed, nStep) === 0) {
    const tx = MISSILE_GetTargetX113c(m, pMissile) | 0
    const ty = MISSILE_GetTargetY113c(m, pMissile) | 0
    const diff = (tx - ty) | 0
    const newTx = ((diff - (diff >> 31)) >> 1) | 0
    const sum = (tx + ty) | 0
    const newTy = ((sum - (sum >> 31)) >> 1) | 0
    const destY = ((UNIT_GetPosY113c(m, pMissile) | 0) + newTy) | 0
    const destX = ((UNIT_GetPosX113c(m, pMissile) | 0) + newTx) | 0
    PATH_SetTargetPos113c(m, m.u32((pMissile + 0x2c) >>> 0), destX, destY)
    PATH_Compute113c(m, m.u32((pMissile + 0x2c) >>> 0), pMissile, 0)
    MISSILE_SetTargetX113c(m, pMissile, newTx)
    MISSILE_SetTargetY113c(m, pMissile, newTy)
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks) | 0
}

/**
 * Spawns radial sub-missiles using the 64-entry sin/cos tables at `0x6FD1C960`/`0x6FD1CA60` and
 * advances the angle in `MISSILE_SetTargetX`, then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC60CA0
 */
export function MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC60CA0)
  if (pMissile === 0) {
    return 2
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0 || sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) < 0) {
    return 2
  }
  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) {
    return 2
  }
  const pOwner = SUNIT_GetServerUnit113c(
    m,
    pGame,
    i32(m, (pMissile + 0x94) >>> 0),
    i32(m, (pMissile + 0x98) >>> 0),
  ) >>> 0
  if (pOwner === 0) {
    return 2
  }
  let nStep = i32(m, (pMissilesTxt + 0x38) >>> 0)
  if (nStep < 1) {
    nStep = 1
  }
  const nElapsed = MISSILE_GetElapsedFrames113c(m, pMissile) | 0
  if (smod32(nElapsed, nStep) > 0) {
    return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks) | 0
  }

  const savedSp = k2W3B4StackPtr
  const pParams = (savedSp - 0x60) >>> 0
  k2W3B4StackPtr = pParams
  try {
    zeroWords113c(m, pParams, 0x17)
    m.setU32(pParams, 2)
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    m.setU32((pParams + 0x08) >>> 0, pMissile >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, (MISSILE_GetSkill113c(m, pMissile) | 0) >>> 0)
    m.setU32((pParams + 0x30) >>> 0, (MISSILE_GetLevel113c(m, pMissile) | 0) >>> 0)
    m.setU32((pParams + 0x10) >>> 0, sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) >>> 0)

    const rawAngle = MISSILE_GetTargetX113c(m, pMissile) | 0
    let idx = smod32(rawAngle, 64)
    if (idx < 0) {
      idx = (-idx) | 0
    }
    const cosVal = D2GAME_RING_COS_TABLE_6FD1CA60_113C[idx] as number
    const sinVal = D2GAME_RING_SIN_TABLE_6FD1C960_113C[idx] as number
    m.setU32((pParams + 0x1c) >>> 0, cosVal >>> 0)
    m.setU32((pParams + 0x20) >>> 0, sinVal >>> 0)

    const nextAngle = smod32((idx + i32(m, (pMissilesTxt + 0x3c) >>> 0)) | 0, 64)
    MISSILE_SetTargetX113c(m, pMissile, nextAngle)
    MISSILE_CreateServerProjectile113c(m, pGame, pParams, hooks)
  } finally {
    k2W3B4StackPtr = savedSp
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks) | 0
}

/**
 * Periodically dispatches `SKILLS_DispatchSrvDoFunc_6FCBE420` (`Param2` SrvDoFunc) on `pMissile`
 * every `Param1` frames, then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC60E10
 */
export function MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC60E10)
  if (pMissile === 0) {
    return 2
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0) {
    return 2
  }
  let nStep = i32(m, (pMissilesTxt + 0x38) >>> 0)
  if (nStep < 1) {
    nStep = 1
  }
  const nElapsed = MISSILE_GetElapsedFrames113c(m, pMissile) | 0
  if (smod32(nElapsed, nStep) === 0) {
    const nSkillId = MISSILE_GetSkill113c(m, pMissile) | 0
    const nLevel = MISSILE_GetLevel113c(m, pMissile) | 0
    if (nSkillId <= 0 || nLevel <= 0) {
      return 2
    }
    SKILLS_DispatchSrvDoFunc_6FCBE420_113c(
      m,
      i32(m, (pMissilesTxt + 0x3c) >>> 0),
      pGame,
      pMissile,
      nSkillId,
      nLevel,
    )
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
}

/**
 * Verifies the missile's owner exists in `pGame` and spawns a trail sub-missile (`dwFlags = 0x21`)
 * when `PATH_CheckFlag08` is set, then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC61110
 */
export function MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC61110)
  if (pMissile === 0) {
    return 2
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0 || sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) < 0) {
    return 2
  }
  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) {
    return 2
  }
  const pOwnerCheck = SUNIT_GetServerUnit113c(
    m,
    pGame,
    i32(m, (pMissile + 0x94) >>> 0),
    i32(m, (pMissile + 0x98) >>> 0),
  ) >>> 0
  if (pOwnerCheck === 0) {
    return 2
  }
  if (PATH_CheckFlag08_113c(m, m.u32((pMissile + 0x2c) >>> 0)) !== 0) {
    const x = UNIT_GetPosX113c(m, pMissile) | 0
    const y = UNIT_GetPosY113c(m, pMissile) | 0
    const savedSp = k2W3B4StackPtr
    const pParams = (savedSp - 0x60) >>> 0
    k2W3B4StackPtr = pParams
    try {
      zeroWords113c(m, pParams, 0x17)
      m.setU32(pParams, 0x21)
      m.setU32((pParams + 0x04) >>> 0, SUNIT_GetOwnerUnit113c(m, pMissile, pGame) >>> 0)
      m.setU32((pParams + 0x10) >>> 0, sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) >>> 0)
      m.setU32((pParams + 0x14) >>> 0, x >>> 0)
      m.setU32((pParams + 0x18) >>> 0, y >>> 0)
      m.setU32((pParams + 0x1c) >>> 0, x >>> 0)
      m.setU32((pParams + 0x20) >>> 0, y >>> 0)
      m.setU32((pParams + 0x2c) >>> 0, (MISSILE_GetSkill113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x30) >>> 0, (MISSILE_GetLevel113c(m, pMissile) | 0) >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame, pParams)
    } finally {
      k2W3B4StackPtr = savedSp
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
}

/**
 * Periodically steers `pMissile` toward its path target (or owner's path target) by `Param3`
 * subtile steps when within `Param2` distance, then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC61240
 */
export function MISSILE_SrvDo_HomingTargetStep_6FC61240_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC61240)
  if (pMissile === 0) {
    return 2
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0) {
    return 2
  }
  SUNIT_ValidatePathTargetUnit113c(m, pMissile, pGame)
  let pTarget = PATH_GetTargetUnit113c(m, m.u32((pMissile + 0x2c) >>> 0)) >>> 0
  if (pTarget === pMissile >>> 0) {
    pTarget = 0
  }
  let pOwner = 0
  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    pOwner = SUNIT_GetServerUnit113c(
      m,
      pGame,
      i32(m, (pMissile + 0x94) >>> 0),
      i32(m, (pMissile + 0x98) >>> 0),
    ) >>> 0
  }
  if (pTarget === 0) {
    if (pOwner === 0) {
      return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
    }
    SUNIT_ValidatePathTargetUnit113c(m, pOwner, pGame)
    const pOwnerTarget = PATH_GetTargetUnit113c(m, m.u32((pOwner + 0x2c) >>> 0)) >>> 0
    if (pOwnerTarget === pOwner || pOwnerTarget === 0) {
      return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
    }
    pTarget = pOwnerTarget
  }

  let nStep = i32(m, (pMissilesTxt + 0x38) >>> 0)
  if (nStep <= 0) {
    nStep = 5
  }
  const nRem = MISSILE_GetRemainingFrames113c(m, pMissile) | 0
  if (smod32(nRem, nStep) === 0) {
    const dist = UNITS_GetApproximateDistance113c(m, pMissile, pTarget) | 0
    if (dist <= i32(m, (pMissilesTxt + 0x3c) >>> 0)) {
      const mx = UNIT_GetPosX113c(m, pMissile) | 0
      const my = UNIT_GetPosY113c(m, pMissile) | 0
      const tx = UNIT_GetPosX113c(m, pTarget) | 0
      const ty = UNIT_GetPosY113c(m, pTarget) | 0
      let nDelta = i32(m, (pMissilesTxt + 0x40) >>> 0)
      if (nDelta < 1) {
        nDelta = 1
      }
      let dx = 0
      if (tx > mx) {
        dx = nDelta
      } else if (tx < mx) {
        dx = (-nDelta) | 0
      }
      let dy = 0
      if (ty > my) {
        dy = nDelta
      } else if (ty < my) {
        dy = (-nDelta) | 0
      }
      const nextY = ((UNIT_GetPosY113c(m, pMissile) | 0) + dy) | 0
      const nextX = ((UNIT_GetPosX113c(m, pMissile) | 0) + dx) | 0
      PATH_SetTargetPos113c(m, m.u32((pMissile + 0x2c) >>> 0), nextX, nextY)
      PATH_Compute113c(m, m.u32((pMissile + 0x2c) >>> 0), pMissile, 0)
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
}

/**
 * Spawns a trail sub-missile (`dwFlags = 1`) at inline unit coordinates when `PATH_CheckFlag08`
 * is set, then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC61520
 */
export function MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC61520)
  let pMissilesTxt = 0
  if (pMissile !== 0) {
    pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  }
  if (pMissilesTxt === 0 && sx16(m.u16(0x18)) < 0) {
    return 2
  }
  if (pMissile === 0 || pMissilesTxt === 0) {
    return 2
  }
  const x = inlineUnitGetPosX113c(m, pMissile)
  const y = inlineUnitGetPosY113c(m, pMissile)
  if (PATH_CheckFlag08_113c(m, m.u32((pMissile + 0x2c) >>> 0)) !== 0) {
    const savedSp = k2W3B4StackPtr
    const pParams = (savedSp - 0x60) >>> 0
    k2W3B4StackPtr = pParams
    try {
      zeroWords113c(m, pParams, 0x17)
      m.setU32(pParams, 1)
      let pOwner = 0
      if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
        pOwner = SUNIT_GetServerUnit113c(
          m,
          pGame,
          i32(m, (pMissile + 0x94) >>> 0),
          i32(m, (pMissile + 0x98) >>> 0),
        ) >>> 0
      }
      m.setU32((pParams + 0x04) >>> 0, pOwner)
      m.setU32((pParams + 0x14) >>> 0, x >>> 0)
      m.setU32((pParams + 0x18) >>> 0, y >>> 0)
      m.setU32((pParams + 0x2c) >>> 0, (MISSILE_GetSkill113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x30) >>> 0, (MISSILE_GetLevel113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x10) >>> 0, sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame, pParams)
    } finally {
      k2W3B4StackPtr = savedSp
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
}

/**
 * Periodically recomputes `pMissile->pPath` toward a live hostile target outside town when
 * `(MISSILE_GetTargetX & 1) != 0` and distance is in `(3, 25)`, then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC61710
 */
export function MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC61710)
  if (pMissile === 0) {
    return 2
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0) {
    return 2
  }
  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) {
    return 2
  }
  const pOwner = SUNIT_GetServerUnit113c(
    m,
    pGame,
    i32(m, (pMissile + 0x94) >>> 0),
    i32(m, (pMissile + 0x98) >>> 0),
  ) >>> 0
  if (pOwner === 0 || SUNIT_IsDeadOrDying113c(m, pOwner) !== 0) {
    return 2
  }
  const pRoom = UNITS_GetRoom113c(m, pMissile) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
    return 2
  }
  if ((MISSILE_GetTargetX113c(m, pMissile) & 1) !== 0) {
    SUNIT_ValidatePathTargetUnit113c(m, pMissile, pGame)
    const pPath = m.u32((pMissile + 0x2c) >>> 0) >>> 0
    let pTarget = SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, pMissile, pGame) >>> 0
    if (pTarget !== 0) {
      if (
        SUNIT_IsDeadOrDying113c(m, pTarget) !== 0 ||
        SUNIT_AreUnitsHostileOrUnaligned113c(m, pOwner, pTarget, pGame) === 0
      ) {
        pTarget = 0
      }
    }
    let nStep = i32(m, (pMissilesTxt + 0x38) >>> 0)
    if (nStep <= 0) {
      nStep = 5
    }
    if (pTarget !== 0) {
      const nRem = MISSILE_GetRemainingFrames113c(m, pMissile) | 0
      if (smod32(nRem, nStep) === 0) {
        const dist = UNITS_GetApproximateDistance113c(m, pMissile, pTarget) | 0
        if (dist > 3 && dist < 25) {
          PATH_Compute113c(m, pPath, pMissile, 0)
        }
      }
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
}

/**
 * Resolves `pOwner` via `SUNIT_GetServerUnit` first and spawns a trail sub-missile (`dwFlags = 0x21`)
 * when `PATH_CheckFlag08` is set, then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC61850
 */
export function MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC61850)
  if (pMissile === 0 || ((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) {
    return 2
  }
  const pOwner = SUNIT_GetOwnerUnit113c(m, pMissile, pGame) >>> 0
  if (pOwner === 0) {
    return 2
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0 || sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) < 0) {
    return 2
  }
  const pPath = m.u32((pMissile + 0x2c) >>> 0) >>> 0
  if (pPath === 0) {
    return 2
  }
  if (PATH_CheckFlag08_113c(m, pPath) !== 0) {
    const x = UNIT_GetPosX113c(m, pMissile) | 0
    const y = UNIT_GetPosY113c(m, pMissile) | 0
    const savedSp = k2W3B4StackPtr
    const pParams = (savedSp - 0x60) >>> 0
    k2W3B4StackPtr = pParams
    try {
      zeroWords113c(m, pParams, 0x17)
      m.setU32(pParams, 0x21)
      m.setU32((pParams + 0x04) >>> 0, pOwner)
      m.setU32((pParams + 0x14) >>> 0, x >>> 0)
      m.setU32((pParams + 0x18) >>> 0, y >>> 0)
      m.setU32((pParams + 0x2c) >>> 0, (MISSILE_GetSkill113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x30) >>> 0, (MISSILE_GetLevel113c(m, pMissile) | 0) >>> 0)
      m.setU32((pParams + 0x10) >>> 0, sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) >>> 0)
      m.setU32((pParams + 0x1c) >>> 0, x >>> 0)
      m.setU32((pParams + 0x20) >>> 0, y >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame, pParams, hooks)
    } finally {
      k2W3B4StackPtr = savedSp
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks) | 0
}

/**
 * Stamps `0x40` collision pattern on `pMissile`'s room and adjusts animation frame (`+0x44`)
 * based on `pMissilesTxt` cel bounds (`+0x181`, `+0x182`) and remaining frames.
 *
 * @va D2Game:0x6FC61980
 */
export function MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC61980)
  if (pMissile === 0) {
    return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks) | 0
  }
  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pMissilesTxt === 0) {
    return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks) | 0
  }
  const nFrame = i32(m, (pMissile + 0x44) >>> 0) >> 8
  const y = inlineUnitGetPosY113c(m, pMissile)
  const x = inlineUnitGetPosX113c(m, pMissile)
  const nSizeX = UNITS_GetUnitSizeX113c(m, pMissile) | 0
  const pRoom = UNITS_GetRoom113c(m, pMissile) >>> 0
  COLLISION_SetMaskWithPattern113c(m, pRoom, x, y, nSizeX, 0x40)

  const uStart = m.u8((pMissilesTxt + 0x181) >>> 0)
  if (nFrame === ((uStart - 1) | 0)) {
    const uEnd = m.u8((pMissilesTxt + 0x182) >>> 0)
    const roll = SEED_RollLimitedFast113c(m, (pMissile + 0x20) >>> 0, (uEnd - uStart) | 0) | 0
    m.setU32((pMissile + 0x44) >>> 0, (((roll + nFrame) | 0) << 8) >>> 0)
    return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks) | 0
  }
  if ((MISSILE_GetRemainingFrames113c(m, pMissile) | 0) === uStart) {
    m.setU32((pMissile + 0x44) >>> 0, (((uStart - 3) | 0) << 8) >>> 0)
    return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks) | 0
  }
  if ((MISSILE_GetRemainingFrames113c(m, pMissile) | 0) < m.u8((pMissilesTxt + 0x181) >>> 0)) {
    let nextFrame = (nFrame - 2) | 0
    if (nextFrame < 0) {
      nextFrame = 0
    }
    m.setU32((pMissile + 0x44) >>> 0, (nextFrame << 8) >>> 0)
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks) | 0
}

/**
 * Stamps subtile collision mask `0x40` at `pMissile`'s coordinates when its path velocity is zero,
 * then steps `MISSILE_SrvDo01_LinearProjectile`.
 *
 * @va D2Game:0x6FC61AE0
 */
export function MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC61AE0)
  const pPath = m.u32((pMissile + 0x2c) >>> 0) >>> 0
  if (pPath !== 0 && PATH_GetVelocity113c(m, pPath) !== 0) {
    return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
  }
  const y = inlineUnitGetPosY113c(m, pMissile)
  const x = inlineUnitGetPosX113c(m, pMissile)
  const pRoom = UNITS_GetRoom113c(m, pMissile) >>> 0
  COLLISION_SetSubtileMask113c(m, pRoom, x, y, 0x40)
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame) | 0
}

/**
 * Absorbs incoming physical/elemental damage components in `pDmg` against `pDefender`'s mana pool
 * (`stat 8`) using `pSkillsTxt->dwCalc3`/`dwCalc4` and removes the aura state when mana reaches 0.
 *
 * @va D2Game:0x6FC61FB0
 */
export function SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c(
  m: D2KernMemory113c,
  pDefender: number,
  pAttacker: number,
  pDmg: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC61FB0)
  if (pDefender === 0 || pDmg === 0) {
    return 0
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  const nAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (
    nAuraState < 0 ||
    pDataTables === 0 ||
    nAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)
  ) {
    return 0
  }
  if (STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, nAuraState) === 0) {
    return 0
  }
  const nAbsorbPct = SKILLS_EvalCalcByOffset113c(
    m,
    pDefender,
    i32(m, (pSkillsTxt + 0x138) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0
  if (nAbsorbPct <= 0) {
    return 0
  }
  let nMana = STATLIST_GetUnitStat113c(m, pDefender, 8, 0) | 0
  let nRatio = SKILLS_EvalCalcByOffset113c(
    m,
    pDefender,
    i32(m, (pSkillsTxt + 0x13c) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0
  if (nRatio <= 0) {
    nRatio = 1
  }
  let bAllowElem = 1
  if (pAttacker !== 0) {
    if (i32(m, pAttacker) !== 1 || MONSTERS_GetHirelingTypeId113c(m, pAttacker) !== 0) {
      bAllowElem = 0
    }
  }
  let totalAbsorbed = 0
  for (let i = 0; i < D2GAME_ABSORB_TABLE_6FD1C3E8_113C.length; i = (i + 1) | 0) {
    const entry = D2GAME_ABSORB_TABLE_6FD1C3E8_113C[i] as readonly [number, number]
    const dmgOff = entry[0]
    const isElem = entry[1]
    if (isElem !== 0 && bAllowElem === 0) {
      continue
    }
    const curDmg = i32(m, (pDmg + dmgOff) >>> 0)
    if (curDmg > 0) {
      let absorbed = mulDiv113c(nAbsorbPct, curDmg, 100) | 0
      const maxByMana = mulDiv113c(16, nMana, nRatio) | 0
      if (absorbed >= maxByMana) {
        absorbed = maxByMana
      }
      totalAbsorbed = (totalAbsorbed + absorbed) | 0
      m.setU32((pDmg + dmgOff) >>> 0, ((curDmg - absorbed) | 0) >>> 0)
      const manaCost = mulDiv113c(nRatio, absorbed, 16) | 0
      nMana = (nMana - manaCost) | 0
      if (nMana <= 0) {
        nMana = 0
      }
    }
  }
  if (nMana <= 0) {
    nMana = 0
  }
  STATLIST_SetUnitStat113c(m, pDefender, 8, nMana, 0)

  if (pAttacker !== 0 && totalAbsorbed > 0) {
    const wOverlay = sx16(m.u16((pSkillsTxt + 0x10c) >>> 0))
    if (wOverlay >= 0 && wOverlay <= i32(m, (pDataTables + 0xbc0) >>> 0)) {
      const ay = UNIT_GetPosY113c(m, pAttacker) | 0
      const ax = UNIT_GetPosX113c(m, pAttacker) | 0
      const dir = UNITS_GetDirectionToCoords113c(m, pDefender, ax, ay) & 0xff
      const normDir = DATATBLS_NormalizeDirection113c(m, dir) & 0xff
      STATES_SetMonsterSkillIconOnUnit113c(
        m,
        pDefender,
        (sx16(m.u16((pSkillsTxt + 0x10c) >>> 0)) + normDir) | 0,
        0,
      )
    }
  }
  if (nMana <= 0) {
    const stateId = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
    const pList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, stateId) >>> 0
    if (pList !== 0) {
      STATLIST_UnlinkSubList113c(m, pDefender, pList)
      STATLIST_FreeStatListIfNonExtended113c(m, pList)
      return 1
    }
    STATES_ToggleGfxStateFlag113c(m, pDefender, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)), 0)
  }
  return 1
}


/**
 * Validates that `pUnit->pPath` has a valid target within `dwCalc1^2` squared subtile distance
 * and (if target is player/monster) that both units are hostile and outside town.
 *
 * @va D2Game:0x6FC62360
 */
export function SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC62360)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === pUnit >>> 0 || pTarget === 0) {
    return 0
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  const nRange = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    i32(m, (pSkillsTxt + 0x64) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0
  const nRangeSq = imul32(nRange, nRange)
  const ty = inlineUnitGetPosY113c(m, pTarget)
  const tx = inlineUnitGetPosX113c(m, pTarget)
  const uy = inlineUnitGetPosY113c(m, pUnit)
  const ux = inlineUnitGetPosX113c(m, pUnit)
  const distSq = PATH_ComputeSquaredDistance113c(ux, uy, tx, ty) | 0
  if (distSq > nRangeSq) {
    return 0
  }
  const targetType = i32(m, pTarget)
  if (targetType >= 0 && targetType <= 1) {
    if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pTarget, pUnit, pGame) === 0) {
      return 0
    }
    const pTargetRoom = UNITS_GetRoom113c(m, pTarget) >>> 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) !== 0) {
      return 0
    }
    const pUnitRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pUnitRoom) !== 0) {
      return 0
    }
  }
  return 1
}

/**
 * Applies `wAuraState` (`+0x80`) and up to 6 evaluated aura stats (`+0x54..+0x5E` / `+0x68..+0x7C`)
 * onto an allied path target (or `pUnit` itself if no allied target).
 *
 * @va D2Game:0x6FC62570
 */
export function SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC62570)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  const wStat0 = sx16(m.u16((pSkillsTxt + 0x54) >>> 0))
  if (wStat0 < -1 || pDataTables === 0 || wStat0 >= i32(m, (pDataTables + 0xbd4) >>> 0)) {
    return 0
  }
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wAuraState < 0 || wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }
  let pTarget = SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, pUnit, pGame) >>> 0
  if (pTarget !== 0) {
    if (SUNIT_AreUnitsInSamePartyOrAligned113c(m, pTarget, pUnit) === 0) {
      pTarget = pUnit >>> 0
    }
    if (pTarget === 0) {
      pTarget = pUnit >>> 0
    }
  } else {
    pTarget = pUnit >>> 0
  }
  const nLen = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    i32(m, (pSkillsTxt + 0x60) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0
  const savedSp = k2W3B4StackPtr
  const pAuraSetup = (savedSp - 0x30) >>> 0
  k2W3B4StackPtr = pAuraSetup
  let pStatList = 0
  try {
    zeroWords113c(m, pAuraSetup, 9)
    m.setU32(pAuraSetup, pUnit >>> 0)
    m.setU32((pAuraSetup + 0x04) >>> 0, pTarget >>> 0)
    m.setU32((pAuraSetup + 0x08) >>> 0, nSkillId >>> 0)
    m.setU32((pAuraSetup + 0x0c) >>> 0, nSkillLevel >>> 0)
    m.setU32((pAuraSetup + 0x10) >>> 0, nLen >>> 0)
    m.setU32((pAuraSetup + 0x14) >>> 0, 0xffffffff)
    m.setU32((pAuraSetup + 0x18) >>> 0, 0)
    m.setU32((pAuraSetup + 0x1c) >>> 0, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)) >>> 0)
    m.setU32((pAuraSetup + 0x20) >>> 0, 0)
    pStatList = STATES_CreateOrUpdateAuraStatList113c(m, pAuraSetup) >>> 0
  } finally {
    k2W3B4StackPtr = savedSp
  }
  if (pStatList === 0) {
    return 0
  }
  for (let i = 0; i < 6; i = (i + 1) | 0) {
    const wStat = sx16(m.u16((pSkillsTxt + 0x54 + i * 2) >>> 0))
    const pTablesCur = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
    if (wStat >= 0 && pTablesCur !== 0 && wStat < i32(m, (pTablesCur + 0xbd4) >>> 0)) {
      const val = SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        i32(m, (pSkillsTxt + 0x68 + i * 4) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
      if (val !== 0) {
        STATLIST_SetStat113c(m, pStatList, wStat, val, 0)
      }
    }
  }
  STATES_ClearGfxStateFlag113c(m, pTarget, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)), 1)
  return 1
}

/**
 * Creates/updates a self aura StatList (`wAuraState` `+0x80`), applies passive stat calcs (`0x6FC647D0`),
 * stores `0x15e`/`0x15f`, and registers up to 3 item event callbacks (`+0x84..+0x8e`).
 *
 * @va D2Game:0x6FC62730
 */
export function SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC62730)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  const wStat0 = sx16(m.u16((pSkillsTxt + 0x54) >>> 0))
  if (wStat0 < -1 || pDataTables === 0 || wStat0 >= i32(m, (pDataTables + 0xbd4) >>> 0)) {
    return 0
  }
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wAuraState < 0 || wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }
  const nLen = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    i32(m, (pSkillsTxt + 0x60) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0
  const savedSp = k2W3B4StackPtr
  const pAuraSetup = (savedSp - 0x30) >>> 0
  k2W3B4StackPtr = pAuraSetup
  let pStatList = 0
  try {
    zeroWords113c(m, pAuraSetup, 9)
    m.setU32(pAuraSetup, pUnit >>> 0)
    m.setU32((pAuraSetup + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pAuraSetup + 0x08) >>> 0, nSkillId >>> 0)
    m.setU32((pAuraSetup + 0x0c) >>> 0, nSkillLevel >>> 0)
    m.setU32((pAuraSetup + 0x10) >>> 0, nLen >>> 0)
    m.setU32((pAuraSetup + 0x14) >>> 0, 0xffffffff)
    m.setU32((pAuraSetup + 0x18) >>> 0, 0)
    m.setU32((pAuraSetup + 0x1c) >>> 0, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)) >>> 0)
    m.setU32((pAuraSetup + 0x20) >>> 0, 0)
    pStatList = STATES_CreateOrUpdateAuraStatList113c(m, pAuraSetup) >>> 0
  } finally {
    k2W3B4StackPtr = savedSp
  }
  if (pStatList === 0) {
    return 0
  }
  SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c(
    m,
    pSkillsTxt,
    pUnit,
    pStatList,
    nSkillId,
    nSkillLevel,
  )
  STATLIST_SetStat113c(m, pStatList, 0x15e, nSkillId, 0)
  STATLIST_SetStat113c(m, pStatList, 0x15f, nSkillLevel, 0)
  if (sx16(m.u16((pSkillsTxt + 0x84) >>> 0)) >= 0) {
    ITEMEVENT_RemoveByTypeAndState113c(
      m,
      pUnit,
      pGame,
      1,
      sx16(m.u16((pSkillsTxt + 0x80) >>> 0)),
    )
    for (let i = 0; i < 3; i = (i + 1) | 0) {
      const wEvent = sx16(m.u16((pSkillsTxt + 0x84 + i * 2) >>> 0))
      if (wEvent < 0) {
        break
      }
      const wEventFunc = sx16(m.u16((pSkillsTxt + 0x8a + i * 2) >>> 0))
      const wState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
      ITEMS_RegisterItemEventCallback113c(
        m,
        wEventFunc,
        wState,
        1,
        pUnit,
        pGame,
        wEvent,
        nSkillId,
        nSkillLevel,
      )
    }
  }
  return 1
}

/**
 * Item event callback that fires a counter-missile (`wSrvMissile` `+0x48`, `dwFlags = 0x20`)
 * from `pDefender` toward the hostile owner of `pMissile` when `MissilesTxt[+0x05] & 2` is set.
 *
 * @va D2Game:0x6FC634E0
 */
export function SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  _nEvent: number,
  pDefender: number,
  pMissile: number,
  _pDmg: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC634E0)
  if (pDefender === 0 || pMissile === 0) {
    return 0
  }
  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) {
    return 0
  }
  const pOwner = SUNIT_GetServerUnit113c(
    m,
    pGame,
    i32(m, (pMissile + 0x94) >>> 0),
    i32(m, (pMissile + 0x98) >>> 0),
  ) >>> 0
  if (pOwner === 0) {
    return 0
  }
  if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pOwner, pDefender, pGame) === 0) {
    return 0
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0) {
    return 0
  }
  const wSrvMissile = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  if (wSrvMissile < 0 || pDataTables === 0 || wSrvMissile >= i32(m, (pDataTables + 0xb6c) >>> 0)) {
    return 0
  }
  let lvl = nSkillLevel | 0
  if (lvl < 0) {
    lvl = 1
  }
  const pHitMissilesTxt = MISSILES_GetTxtRecordFast113c(m, i32(m, (pMissile + 0x04) >>> 0)) >>> 0
  if (pHitMissilesTxt === 0) {
    return 0
  }
  const pBitMasks = m.u32(0x6fd18be0) >>> 0
  const maskByte = pBitMasks !== 0 ? m.u8((pBitMasks + 0x04) >>> 0) : 2
  if ((m.u8((pHitMissilesTxt + 0x05) >>> 0) & maskByte) === 0) {
    return 0
  }
  const savedSp = k2W3B4StackPtr
  const pParams = (savedSp - 0x60) >>> 0
  k2W3B4StackPtr = pParams
  try {
    zeroWords113c(m, pParams, 0x17)
    m.setU32(pParams, 0x20)
    m.setU32((pParams + 0x04) >>> 0, pDefender >>> 0)
    m.setU32((pParams + 0x08) >>> 0, pDefender >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, lvl >>> 0)
    m.setU32((pParams + 0x10) >>> 0, wSrvMissile >>> 0)
    const ox = UNIT_GetPosX113c(m, pOwner) | 0
    m.setU32((pParams + 0x1c) >>> 0, ox >>> 0)
    const oy = UNIT_GetPosY113c(m, pOwner) | 0
    m.setU32((pParams + 0x20) >>> 0, oy >>> 0)
    MISSILE_CreateServerProjectile113c(m, pGame, pParams)
  } finally {
    k2W3B4StackPtr = savedSp
  }
  return 1
}

/**
 * Spawns a Blaze trail projectile (`wSrvMissile` `+0x48`, `dwFlags = 0x21`) at `pUnit`'s position
 * when `PATH_CheckFlag08` is set, state `0x0d` is active, and `pUnit` is outside town.
 *
 * @va D2Game:0x6FC639A0
 */
export function SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC639A0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath === 0 || PATH_CheckFlag08_113c(m, pPath) === 0) {
    return
  }
  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, 0x0d) >>> 0
  if (pStatList === 0) {
    return
  }
  const nSkillId = STATLIST_GetStatValue113c(m, pStatList, 0x15e, 0) | 0
  let nSkillLevel = STATLIST_GetStatValue113c(m, pStatList, 0x15f, 0) | 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  if (nSkillId <= 0 || pDataTables === 0 || nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) {
    return
  }
  if (nSkillLevel < 0) {
    nSkillLevel = 1
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0) {
    return
  }
  const wSrvMissile = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
  if (wSrvMissile < 0 || wSrvMissile >= i32(m, (pDataTables + 0xb6c) >>> 0)) {
    return
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
    return
  }
  const x = UNIT_GetPosX113c(m, pUnit) | 0
  const y = UNIT_GetPosY113c(m, pUnit) | 0
  const savedSp = k2W3B4StackPtr
  const pParams = (savedSp - 0x60) >>> 0
  k2W3B4StackPtr = pParams
  try {
    zeroWords113c(m, pParams, 0x17)
    m.setU32(pParams, 0x21)
    m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x14) >>> 0, x >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    m.setU32((pParams + 0x18) >>> 0, y >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x10) >>> 0, wSrvMissile >>> 0)
    MISSILE_CreateServerProjectile113c(m, pGame, pParams)
  } finally {
    k2W3B4StackPtr = savedSp
  }
}

/**
 * Absorbs incoming fire (`+0x10`), cold (`+0x24`), and lightning (`+0x1c`) damage from `pDmg`
 * against `pDefender`'s Cyclone Armor stat pool (`wAuraStat1`/`wAuraStat2`), removing the state on depletion.
 *
 * @va D2Game:0x6FC64600
 */
export function SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c(
  m: D2KernMemory113c,
  pDefender: number,
  _pAttacker: number,
  pDmg: number,
  nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC64600)
  if (pDefender === 0 || pDmg === 0) {
    return 0
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wAuraState < 0 || pDataTables === 0 || wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }
  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, wAuraState) >>> 0
  if (pStatList === 0) {
    return 0
  }
  const wMaxStat = sx16(m.u16((pSkillsTxt + 0x56) >>> 0))
  if (wMaxStat < 0 || wMaxStat >= i32(m, (pDataTables + 0xbd4) >>> 0)) {
    return 0
  }
  const nMaxPool = STATLIST_GetStatValue113c(m, pStatList, wMaxStat, 0) | 0
  if (nMaxPool <= 0) {
    return 0
  }
  const wCurStat = sx16(m.u16((pSkillsTxt + 0x54) >>> 0))
  if (wCurStat < 0 || wCurStat >= i32(m, (pDataTables + 0xbd4) >>> 0)) {
    return 0
  }
  let nCurPool = STATLIST_GetStatValue113c(m, pStatList, wCurStat, 0) | 0
  if (nCurPool !== 0) {
    if (i32(m, (pDmg + 0x10) >>> 0) > 0) {
      nCurPool = SKILLS_DeductFromStatPool113c(m, nCurPool, (pDmg + 0x10) >>> 0) | 0
    }
    if (i32(m, (pDmg + 0x24) >>> 0) > 0) {
      nCurPool = SKILLS_DeductFromStatPool113c(m, nCurPool, (pDmg + 0x24) >>> 0) | 0
    }
    if (i32(m, (pDmg + 0x1c) >>> 0) > 0) {
      nCurPool = SKILLS_DeductFromStatPool113c(m, nCurPool, (pDmg + 0x1c) >>> 0) | 0
    }
    STATLIST_SetStat113c(m, pStatList, wCurStat, nCurPool, 0)
    if (nCurPool > 0) {
      const pct = mulDiv113c(100, nCurPool, nMaxPool) | 0
      const oldPct = STATLIST_GetStatValue113c(m, pStatList, 0x54, 0) | 0
      const diff = (pct - oldPct) | 0
      const shouldUpdate = diff >= 5 ? 1 : 0
      if (shouldUpdate !== 0) {
        STATES_ClearGfxStateFlag113c(m, pDefender, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)), 1)
        STATLIST_SetStat113c(m, pStatList, 0x54, pct, 0)
      }
      return 1
    }
  }
  STATES_ToggleGfxStateFlag113c(m, pDefender, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)), 0)
  STATLIST_UnlinkSubList113c(m, pDefender, pStatList)
  STATLIST_FreeStatListIfNonExtended113c(m, pStatList)
  return 1
}

/**
 * Accumulates ToHit bonus and `srcDam` across active states in `pDataTables->pStates (+0x17c)`,
 * rolls melee ToHit (`0x6FCFE5A0`), and allocates a combat node (`0x6FCFDDE0`).
 *
 * @va D2Game:0x6FC64AC0
 */
export function SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC64AC0)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === pUnit >>> 0 || pTarget === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  let toHitBonus = 0
  let srcDam = 0x80
  if (pDataTables !== 0) {
    const nCount = sx16(m.u16((pDataTables + 0x180) >>> 0))
    for (let i = 0; i < nCount; i = (i + 1) | 0) {
      const pStatesArr = m.u32((pDataTables + 0x17c) >>> 0) >>> 0
      const wState = sx16(m.u16((pStatesArr + i * 2) >>> 0))
      if (STATES_CheckState113c(m, pUnit, wState) !== 0 && wState >= 0) {
        const pTablesCur = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
        if (wState < i32(m, (pTablesCur + 0xc4) >>> 0)) {
          const pStatesTxt = m.u32((pTablesCur + 0xbc) >>> 0) >>> 0
          if (((pStatesTxt + imul32(wState, 0x3c)) >>> 0) !== 0) {
            const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(
              m,
              pUnit,
              wState,
            ) >>> 0
            if (pStatList !== 0) {
              const nSkillId = STATLIST_GetStatValue113c(m, pStatList, 0x15e, 0) | 0
              const pTablesSkill = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
              if (nSkillId >= 0 && nSkillId < i32(m, (pTablesSkill + 0xba0) >>> 0)) {
                toHitBonus =
                  (toHitBonus +
                    (SKILLS_GetSkillToHitBonus113c(m, pUnit, nSkillId, nSkillLevel) | 0)) |
                  0
                const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
                if (pSkillsTxt !== 0) {
                  const uSrc = m.u8((pSkillsTxt + 0x1a5) >>> 0)
                  if (uSrc !== 0) {
                    srcDam = uSrc
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  const savedSp = k2W3B4StackPtr
  const pDmg = (savedSp - 0x70) >>> 0
  k2W3B4StackPtr = pDmg
  try {
    zeroWords113c(m, pDmg, 0x1c)
    const wFlags = SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, pUnit, pTarget, pGame, toHitBonus, 0)
    m.setU16((pDmg + 0x04) >>> 0, wFlags & 0xffff)
    m.setU32((pDmg + 0x60) >>> 0, 1)
    SUNITDMG_AllocCombat113c(m, pGame, pUnit, pTarget, pDmg, srcDam)
  } finally {
    k2W3B4StackPtr = savedSp
  }
  return 1
}

/**
 * `SrvSt` handler for Druid charge-up melee skills: checks `wAuraState` (`+0x80`),
 * rolls ToHit (`0x6FCFE5A0`), evaluates `dwCalc1`/`dwCalc4`, and sets `pSkill->dwParam1 = 1` on hit.
 *
 * @va D2Game:0x6FC64C20
 */
export function SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC64C20)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pSkill === 0) {
    return 0
  }
  if (SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0x6fd1c3a8, 0x2f1) !== (nSkillId | 0)) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === pUnit >>> 0 || pTarget === 0) {
    return 0
  }
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wAuraState >= 0) {
    const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
    if (pDataTables !== 0 && wAuraState < i32(m, (pDataTables + 0xc4) >>> 0)) {
      if (STATES_CheckState113c(m, pUnit, wAuraState) === 0) {
        return 0
      }
    }
  }
  SKILLS_SetParam1113c(m, pSkill, 0)
  const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, pUnit, nSkillId, nSkillLevel) | 0
  const wFlags = SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, pUnit, pTarget, pGame, toHitBonus, 0)
  if ((wFlags & 1) === 0) {
    return 0
  }
  SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    i32(m, (pSkillsTxt + 0x138) >>> 0),
    nSkillId,
    nSkillLevel,
  )
  if (m.u8((pSkillsTxt + 0x1dc) >>> 0) > 0) {
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      i32(m, (pSkillsTxt + 0x144) >>> 0),
      nSkillId,
      nSkillLevel,
    )
  }
  SKILLS_SetParam1113c(m, pSkill, 1)
  return 1
}

/**
 * `SrvSt` handler that rolls melee ToHit (`0x6FCFE5A0`), populates elemental conversion (`+0x65`/`+0x68`)
 * and physical damage bonus (`+0x0c`), allocates a combat node (`0x6FCFDDE0`), and records hit status in `Param1`.
 *
 * @va D2Game:0x6FC64D70
 */
export function SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC64D70)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pSkill === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === pUnit >>> 0 || pTarget === 0) {
    return 0
  }
  const savedSp = k2W3B4StackPtr
  const pDmg = (savedSp - 0x70) >>> 0
  k2W3B4StackPtr = pDmg
  try {
    zeroWords113c(m, pDmg, 0x1c)
    const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, pUnit, nSkillId, nSkillLevel) | 0
    const wFlags = SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, pUnit, pTarget, pGame, toHitBonus, 0)
    m.setU16((pDmg + 0x04) >>> 0, wFlags & 0xffff)
    if ((wFlags & 1) !== 0) {
      if (m.u8((pSkillsTxt + 0x1dc) >>> 0) > 0) {
        const convPct = SKILLS_EvalCalcByOffset113c(
          m,
          pUnit,
          i32(m, (pSkillsTxt + 0x144) >>> 0),
          nSkillId,
          nSkillLevel,
        ) | 0
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0)
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, m.u8((pSkillsTxt + 0x1dc) >>> 0))
        }
      }
      const enhDmg = SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        i32(m, (pSkillsTxt + 0x138) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, enhDmg >>> 0)
    }
    let srcDam = m.u8((pSkillsTxt + 0x1a5) >>> 0)
    if (srcDam === 0) {
      srcDam = 0x80
    }
    SUNITDMG_AllocCombat113c(m, pGame, pUnit, pTarget, pDmg, srcDam)
    if ((m.u8((pDmg + 0x04) >>> 0) & 1) !== 0) {
      SKILLS_SetParam1113c(m, pSkill, 1)
    } else {
      SKILLS_SetParam1113c(m, pSkill, 0)
    }
  } finally {
    k2W3B4StackPtr = savedSp
  }
  return 1
}

/**
 * Resolves a charged server missile (`0x6FCB1340`), spawns it (`dwFlags = 0x8000`) via `MISSILE_CreateServerProjectile`,
 * and stores target unit type/id (`6`/`-1` when `pTarget == 0`) in `MISSILE_SetTargetX`/`MISSILE_SetTargetY`.
 *
 * @va D2Game:0x6FC65410
 */
export function SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pUnit: number,
  pTarget: number,
  pGame: number,
  nSkillLevel: number,
  nSubMissile: number,
): void {
  hitD2GameVa113c(0x6FC65410)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return
  }
  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, nSkillId, pTarget) | 0
  if (nMissileId <= 0) {
    return
  }
  let pMissile = 0
  const savedSp = k2W3B4StackPtr
  const pParams = (savedSp - 0x60) >>> 0
  k2W3B4StackPtr = pParams
  try {
    zeroWords113c(m, pParams, 0x17)
    m.setU32(pParams, 0x8000)
    m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x08) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSubMissile >>> 0)
    m.setU32((pParams + 0x4c) >>> 0, nSkillLevel >>> 0)
    pMissile = MISSILE_CreateServerProjectile113c(m, pGame, pParams) >>> 0
  } finally {
    k2W3B4StackPtr = savedSp
  }
  if (pMissile === 0) {
    return
  }
  const targetType = pTarget !== 0 ? m.u32(pTarget >>> 0) | 0 : 6
  MISSILE_SetTargetX113c(m, pMissile, targetType)
  const targetId = pTarget !== 0 ? m.u32((pTarget + 0x0c) >>> 0) | 0 : -1
  MISSILE_SetTargetY113c(m, pMissile, targetId)
}

/**
 * `SrvDo` handler for Druid Shapeshift skills: allocates/updates `wAuraState` (`+0x80`) StatList,
 * schedules timer events `0x0c` and `0x05`, applies aura stat calcs (`0x6FC648E0`), and stores a random seed in `Param1`.
 *
 * @va D2Game:0x6FC65CE0
 */
export function SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC65CE0)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wAuraState < 0 || pDataTables === 0 || wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pSkill === 0) {
    return 0
  }
  if (SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0x6fd1c3a8, 0x48b) !== (nSkillId | 0)) {
    return 0
  }
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const nRand = SEED_RollLimitedRandomNumber113c(m, (pUnit + 0x20) >>> 0, 0x10000) | 0
  let nLen = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    i32(m, (pSkillsTxt + 0x60) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0
  if (nLen < 1) {
    nLen = 1
  }
  const expireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + nLen) >>> 0
  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(
    m,
    pUnit,
    sx16(m.u16((pSkillsTxt + 0x80) >>> 0)),
  ) >>> 0
  if (pStatList === 0) {
    const ownerId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    const ownerType = pUnit !== 0 ? m.u32(pUnit >>> 0) : 6
    const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
    pStatList = STATLIST_AllocList113c(m, 2, ownerType, ownerId, 0, expireFrame) >>> 0
    if (pStatList === 0) {
      return 0
    }
    m.setU32(pStatList, pMemPool)
    STATLIST_SetState113c(m, pStatList, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)))
    STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0)
    STATLIST_MergeStatLists113c(m, pUnit, pStatList, 1)
    STATES_ToggleGfxStateFlag113c(m, pUnit, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)), 1)
  }
  STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
  EVENT_SetEventFull113c(m, pGame, pUnit, 0x0c, expireFrame, 0, 0, 0)
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
    m,
    pSkillsTxt,
    pUnit,
    pStatList,
    nSkillId,
    nSkillLevel,
  )
  STATLIST_SetStat113c(m, pStatList, 0x15e, nSkillId, 0)
  STATLIST_SetStat113c(m, pStatList, 0x15f, nSkillLevel, 0)
  const nParam4 = SKILLS_GetParam4Fast_6FC21C20_113c(m, nSkillId) | 0
  const event5Frame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + nParam4) >>> 0
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, 5, 0)
  EVENT_SetEventFull113c(m, pGame, pUnit, 5, event5Frame, 0, nSkillId, nSkillLevel)
  SKILLS_SetParam1113c(m, pSkill, nRand)
  return 1
}

/**
 * Allocates or updates the secondary aura state (`wAuraState2` `+0x82`) StatList on `pUnit`
 * with duration `nDuration`, schedules event `0x0c`, and applies aura stat calcs (`0x6FC648E0`).
 *
 * @va D2Game:0x6FC65EE0
 */
export function SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nDuration: number,
  nSkillId: number,
  nSkillLevel: number,
  nChargeLevel: number,
  pCaster = pUnit,
): number {
  hitD2GameVa113c(0x6FC65EE0)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  const wAuraState2 = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
  if (wAuraState2 < 0 || pDataTables === 0 || wAuraState2 > i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }
  const expireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + (nDuration | 0)) >>> 0
  if (STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, wAuraState2) !== 0) {
    return 0
  }
  const ownerId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
  const ownerType = pUnit !== 0 ? m.u32(pUnit >>> 0) : 6
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  const pStatList = STATLIST_AllocList113c(m, 2, ownerType, ownerId, 0, expireFrame) >>> 0
  if (pStatList === 0) {
    return 0
  }
  m.setU32(pStatList, pMemPool)
  STATLIST_SetState113c(m, pStatList, sx16(m.u16((pSkillsTxt + 0x82) >>> 0)))
  STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0)
  STATLIST_MergeStatLists113c(m, pUnit, pStatList, 1)
  STATES_ToggleGfxStateFlag113c(m, pUnit, sx16(m.u16((pSkillsTxt + 0x82) >>> 0)), 1)
  STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
  EVENT_SetEventFull113c(m, pGame, pUnit, 0x0c, expireFrame, 0, 0, 0)
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
    m,
    pSkillsTxt,
    pCaster,
    pStatList,
    nSkillId,
    nChargeLevel,
  )
  void nSkillLevel
  return 1
}

/**
 * `SrvDo` handler for Druid Maul / Feral Rage: executes damage events against the validated target
 * (`0x6FCFED30`), and when `Param1 != 0`, increments charge stat `0xa9` (clamped to `dwCalc2`)
 * and applies `SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c`.
 *
 * @va D2Game:0x6FC66000
 */
export function SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC66000)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wAuraState < 0 || pDataTables === 0 || wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pSkill === 0) {
    return 0
  }
  if (SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0x6fd1c3a8, 0x2af) !== (nSkillId | 0)) {
    return 0
  }
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const pTarget = SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, pUnit, pGame) >>> 0
  if (pTarget !== 0) {
    SUNITDMG_ExecuteEvents113c(m, pGame, pUnit, pTarget, 1, 0)
  }
  if (SKILLS_GetParam1113c(m, pSkill) !== 0) {
    const nLen = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      i32(m, (pSkillsTxt + 0x60) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0
    const expireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + nLen) >>> 0
    let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(
      m,
      pUnit,
      sx16(m.u16((pSkillsTxt + 0x80) >>> 0)),
    ) >>> 0
    if (pStatList === 0) {
      const ownerId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
      const ownerType = pUnit !== 0 ? m.u32(pUnit >>> 0) : 6
      const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
      pStatList = STATLIST_AllocList113c(m, 2, ownerType, ownerId, 0, expireFrame) >>> 0
      if (pStatList === 0) {
        return 1
      }
      m.setU32(pStatList, pMemPool)
      STATLIST_SetState113c(m, pStatList, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)))
      STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0)
      STATLIST_MergeStatLists113c(m, pUnit, pStatList, 1)
      STATES_ToggleGfxStateFlag113c(m, pUnit, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)), 1)
    }
    STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
    EVENT_SetEventFull113c(m, pGame, pUnit, 0x0c, expireFrame, 0, 0, 0)
    STATES_ClearGfxStateFlag113c(m, pUnit, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)), 1)
    const maxCharges = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      i32(m, (pSkillsTxt + 0x13c) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0
    const nextCharges = ((STATLIST_GetStatValue113c(m, pStatList, 0xa9, 0) | 0) + 1) | 0
    const clampedCharges = maxCharges < nextCharges ? maxCharges : nextCharges
    STATLIST_SetStat113c(m, pStatList, 0xa9, clampedCharges, 0)
    STATLIST_SetStat113c(m, pStatList, 0x15e, nSkillId, 0)
    STATLIST_SetStat113c(m, pStatList, 0x15f, nSkillLevel, 0)
    SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
      m,
      pSkillsTxt,
      pUnit,
      pStatList,
      nSkillId,
      clampedCharges,
    )
  }
  return 1
}

/**
 * Attempts up to 20 random subtile origins within `REGPOP_GetSpawnBoxSubtiles` to spawn all entries
 * of `pFormation` via `MONSTER_Create`, writing the successful origin to `*pOutX`/`*pOutY`.
 *
 * @va D2Game:0x6FC671E0
 */
export function REGPOP_SpawnMonsterFormation_6FC671E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  pCoordNode: number,
  nClassId: number,
  pFormation: number,
  pOutX: number,
  pOutY: number,
): number {
  hitD2GameVa113c(0x6FC671E0)
  const savedSp = k2W3B4StackPtr
  const sp = (savedSp - 0x48) >>> 0
  k2W3B4StackPtr = sp
  try {
    const pBoxX = sp
    const pBoxY = (sp + 0x04) >>> 0
    const pBoxW = (sp + 0x08) >>> 0
    const pBoxH = (sp + 0x0c) >>> 0
    const pArgs = (sp + 0x10) >>> 0
    REGPOP_GetSpawnBoxSubtiles113c(m, pCoordNode, pRoom, pBoxX, pBoxY, pBoxW, pBoxH)
    const hasCoordNode = pCoordNode !== 0 ? 1 : 0
    const expectedIdx = pCoordNode !== 0 ? i32(m, (pCoordNode + 0x28) >>> 0) : 0
    const pRoomSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0
    const nCount = i32(m, pFormation >>> 0)
    const pEntries = (pFormation + 0x0c) >>> 0

    for (let attempt = 0; attempt < 20; attempt = (attempt + 1) | 0) {
      const boxW = i32(m, pBoxW)
      const dx = boxW > 0 ? SEED_RollLimitedFast113c(m, pRoomSeed, boxW) | 0 : 0
      const candX = (i32(m, pBoxX) + dx) | 0
      const boxH = i32(m, pBoxH)
      const dy = boxH > 0 ? SEED_RollLimitedFast113c(m, pRoomSeed, boxH) | 0 : 0
      const candY = (i32(m, pBoxY) + dy) | 0

      let allOk = 1
      for (let i = 0; i < nCount; i = (i + 1) | 0) {
        const pCur = (pEntries + i * 0x0c) >>> 0
        const relX = i32(m, pCur)
        const relY = i32(m, (pCur + 0x04) >>> 0)
        if (hasCoordNode !== 0) {
          const idx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(
            m,
            pRoom,
            (relX + candX) | 0,
            relY,
          ) | 0
          if (idx !== expectedIdx) {
            allOk = 0
            break
          }
        }
        zeroWords113c(m, pArgs, 10)
        m.setU32(pArgs, pGame >>> 0)
        m.setU32((pArgs + 0x04) >>> 0, pRoom >>> 0)
        m.setU32((pArgs + 0x08) >>> 0, hasCoordNode !== 0 ? pCoordNode >>> 0 : 0)
        m.setU32((pArgs + 0x0c) >>> 0, nClassId >>> 0)
        m.setU32((pArgs + 0x10) >>> 0, 1)
        m.setU32((pArgs + 0x14) >>> 0, 0)
        m.setU32((pArgs + 0x18) >>> 0, ((relX + candX) | 0) >>> 0)
        m.setU32((pArgs + 0x1c) >>> 0, ((relY + candY) | 0) >>> 0)
        m.setU32((pArgs + 0x20) >>> 0, 0xffffffff)
        m.setU16((pArgs + 0x24) >>> 0, 1)
        if (MONSTER_Create113c(m, pArgs) === 0) {
          allOk = 0
          break
        }
      }
      if (allOk !== 0) {
        m.setU32(pOutX >>> 0, candX >>> 0)
        m.setU32(pOutY >>> 0, candY >>> 0)
        return 1
      }
    }
    return 0
  } finally {
    k2W3B4StackPtr = savedSp
  }
}

/**
 * Inserts a player unit (`dwUnitType == 0`) into a distance-ordered linked list of 12-byte nodes
 * at `pList` (capped at `nMaxCount` via `pGame + 0x3bc`) and updates `*pMaxDist`.
 *
 * @va D2Game:0x6FC6A460
 */
export function SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c(
  m: D2KernMemory113c,
  nX: number,
  pList: number,
  pPlayerUnit: number,
  nY: number,
  pMaxDist: number,
  pGame: number,
  nMaxCount: number,
): void {
  hitD2GameVa113c(0x6FC6A460)
  if (pPlayerUnit === 0 || i32(m, pPlayerUnit >>> 0) !== 0) {
    return
  }
  const px = inlineUnitGetPosX113c(m, pPlayerUnit)
  let dx = (nX - px) | 0
  if (dx < 0) {
    dx = (-dx) | 0
  }
  const py = inlineUnitGetPosY113c(m, pPlayerUnit)
  let dy = (nY - py) | 0
  if (dy < 0) {
    dy = (-dy) | 0
  }
  const dist = ((dx + dy) | 0) >>> 0
  const curCount = m.u32((pGame + 0x3bc) >>> 0) >>> 0
  const maxCount = nMaxCount >>> 0
  if (curCount >= maxCount && dist >= m.u32(pMaxDist >>> 0)) {
    return
  }
  let prevIdx = 0
  let nextIdx = m.u32((pList + 0x08) >>> 0) >>> 0
  while (nextIdx !== 0) {
    const nodeDist = m.u32((pList + nextIdx * 12 + 0x04) >>> 0) >>> 0
    if (dist <= nodeDist) {
      break
    }
    prevIdx = nextIdx
    nextIdx = m.u32((pList + prevIdx * 12 + 0x08) >>> 0) >>> 0
  }
  let slotIdx = 0
  if (curCount === maxCount) {
    let penultIdx = 0
    const headNext = m.u32((pList + 0x08) >>> 0) >>> 0
    if (headNext !== 0 && m.u32((pList + headNext * 12 + 0x08) >>> 0) !== 0) {
      let ptr = (pList + 0x08) >>> 0
      while (true) {
        penultIdx = m.u32(ptr) >>> 0
        ptr = (pList + penultIdx * 12 + 0x08) >>> 0
        const afterIdx = m.u32(ptr) >>> 0
        if (m.u32((pList + afterIdx * 12 + 0x08) >>> 0) === 0) {
          break
        }
      }
    }
    const pPenult = (pList + penultIdx * 12) >>> 0
    slotIdx = m.u32((pPenult + 0x08) >>> 0) >>> 0
    if (curCount !== 0) {
      if (dist >= m.u32((pList + slotIdx * 12 + 0x04) >>> 0)) {
        return
      }
    }
    if (curCount === 1) {
      m.setU32(pMaxDist >>> 0, dist)
      m.setU32((pPenult + 0x08) >>> 0, 0)
    } else {
      m.setU32(pMaxDist >>> 0, m.u32((pPenult + 0x04) >>> 0))
      m.setU32((pPenult + 0x08) >>> 0, 0)
    }
  } else {
    slotIdx = curCount
    m.setU32((pGame + 0x3bc) >>> 0, (curCount + 1) >>> 0)
  }

  if (prevIdx === 0 && dist < m.u32((pList + 0x04) >>> 0)) {
    if (((m.u32((pGame + 0x3bc) >>> 0) - 1) | 0) !== 0) {
      const pSlot = (pList + slotIdx * 12) >>> 0
      m.setU32((pSlot + 0x08) >>> 0, m.u32((pList + 0x08) >>> 0))
      m.setU32(pSlot, m.u32(pList))
      m.setU32((pSlot + 0x04) >>> 0, m.u32((pList + 0x04) >>> 0))
    }
    m.setU32((pList + 0x08) >>> 0, slotIdx)
    slotIdx = 0
  } else {
    const pPrev = (pList + prevIdx * 12) >>> 0
    const oldNext = m.u32((pPrev + 0x08) >>> 0) >>> 0
    m.setU32((pList + slotIdx * 12 + 0x08) >>> 0, oldNext)
    m.setU32((pPrev + 0x08) >>> 0, slotIdx)
  }
  const pWrite = (pList + slotIdx * 12) >>> 0
  m.setU32((pWrite + 0x04) >>> 0, dist)
  m.setU32(pWrite, pPlayerUnit >>> 0)
  if (dist > m.u32(pMaxDist >>> 0)) {
    m.setU32(pMaxDist >>> 0, dist)
  }
}


function stormStrCopy113c(m: D2KernMemory113c, dst: number, src: number, maxLen: number): number {
  const limit = maxLen | 0
  if (limit <= 0 || dst === 0) {
    return 0
  }
  let i = 0
  if (src !== 0) {
    for (; i < limit - 1; i = (i + 1) | 0) {
      const ch = m.u8((src + i) >>> 0)
      if (ch === 0) {
        break
      }
      m.setU8((dst + i) >>> 0, ch)
    }
  }
  m.setU8((dst + i) >>> 0, 0)
  return i
}

function stormStrLen113c(m: D2KernMemory113c, str: number): number {
  if (str === 0) {
    return 0
  }
  let len = 0
  while (m.u8((str + len) >>> 0) !== 0) {
    len = (len + 1) | 0
  }
  return len
}

function stormMemCopy113c(m: D2KernMemory113c, dst: number, src: number, count: number): void {
  const n = count | 0
  for (let i = 0; i < n; i = (i + 1) | 0) {
    m.setU8((dst + i) >>> 0, m.u8((src + i) >>> 0))
  }
}

function fogEncode14BitsToString113c(m: D2KernMemory113c, dst: number, val: number): void {
  const dl = (val & 0xff) | 0x80
  const al = ((val >>> 7) & 0xff) | 0x80
  m.setU8(dst >>> 0, dl)
  m.setU8((dst + 1) >>> 0, al)
}

function fogCrc16CcittTableEntry113c(index: number): number {
  let c = (index & 0xff) << 8
  for (let b = 0; b < 8; b = (b + 1) | 0) {
    c = ((c & 0x8000) !== 0 ? ((c << 1) ^ 0x1021) : c << 1) & 0xffff
  }
  return c
}

function fogCrc16LowerString113c(m: D2KernMemory113c, str: number): number {
  if (str === 0) {
    return 0xffff
  }
  let crc = 0xffff
  let ptr = str >>> 0
  let ch = m.u8(ptr)
  if (ch >= 0x41 && ch <= 0x5a) {
    ch = (ch + 0x20) & 0xff
  }
  while (ch !== 0) {
    const idx = (ch ^ crc) & 0xff
    crc = ((crc >>> 2) ^ fogCrc16CcittTableEntry113c(idx)) & 0xffff
    ptr = (ptr + 1) >>> 0
    ch = m.u8(ptr)
    if (ch >= 0x41 && ch <= 0x5a) {
      ch = (ch + 0x20) & 0xff
    }
  }
  return crc & 0xffff
}

/**
 * Allocates a `0x518`-byte `D2ClientStrc`, initializes strings, arena class/level, and 16-slot
 * tracking records (`+0x3dc`), and links the client into `pGame->pClientList` (`+0x88`) and
 * global ID/name hash buckets (`0x6FD307B8` / `0x6FD303B8`).
 *
 * @va D2Game:0x6FC6A9B0
 */
export function CLIENTS_AllocAndLinkClient_6FC6A9B0_113c(
  m: D2KernMemory113c,
  dwClientId: number,
  pGame: number,
  bCharClass: number,
  szCharName: number,
  szAccountName: number,
  dwClientFlags60: number,
  bLocaleId: number,
): number {
  hitD2GameVa113c(0x6FC6A9B0)
  if (m.u32(0x6fd31c18) === 0 || pGame === 0 || i32(m, (pGame + 0x8c) >>> 0) >= 8) {
    return 0
  }
  m.u32((pGame + 0x1c) >>> 0)
  const pClient = m.alloc(0x518) >>> 0
  zeroWords113c(m, pClient, 0x146)
  m.setU32(pClient, dwClientId >>> 0)
  const tickCount = m.u32(0x6fd18d10) >>> 0
  m.setU32((pClient + 0x3d8) >>> 0, (tickCount + 0x2bf20) >>> 0)
  m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
  if (ARENA_CheckFlagBit8_6FCD2620_113c(m, pGame) !== 0) {
    m.setU8((pClient + 0x0c) >>> 0, bCharClass & 0xff)
    const arenaMode = ARENA_GetModeByte_6FCD22D0_113c(m, pGame)
    const startLvl = DATATBLS_GetCharTemplateStartLevel113c(m, bCharClass & 0xff, arenaMode)
    m.setU8((pClient + 0x08) >>> 0, startLvl & 0xff)
  } else {
    m.setU8((pClient + 0x08) >>> 0, bCharClass & 0xff)
  }
  stormStrCopy113c(m, (pClient + 0x0d) >>> 0, szCharName, 0x7fffffff)
  stormStrCopy113c(m, (pClient + 0x1d) >>> 0, szAccountName, 0x7fffffff)
  m.setU32((pClient + 0x60) >>> 0, dwClientFlags60 >>> 0)
  m.setU32((pClient + 0x68) >>> 0, 0)
  m.setU32((pClient + 0x50c) >>> 0, bLocaleId & 0xff)
  CLIENTS_SetClientInitState_6FC69B70_113c(m, pClient, 0)
  m.setU32((pClient + 0x1b8) >>> 0, 0)
  m.setU32((pClient + 0x1bc) >>> 0, 0)
  m.setU32((pClient + 0x1c0) >>> 0, 0)
  let pSlot = (pClient + 0x3de) >>> 0
  for (let i = 0; i < 16; i = (i + 1) | 0) {
    m.setU16((pSlot - 2) >>> 0, 0xffff)
    m.setU8(pSlot, 0)
    m.setU32((pSlot + 2) >>> 0, 0xffffffff)
    pSlot = (pSlot + 8) >>> 0
  }
  m.setU32((pClient + 0x4a8) >>> 0, m.u32((pGame + 0x88) >>> 0))
  m.setU32((pGame + 0x88) >>> 0, pClient)
  const idBucket = dwClientId & 0xff
  const idBucketAddr = (0x6fd307b8 + idBucket * 4) >>> 0
  m.setU32((pClient + 0x4ac) >>> 0, m.u32(idBucketAddr))
  m.setU32(idBucketAddr, pClient)
  const nameBucket = fogCrc16LowerString113c(m, szCharName) & 0xff
  const nameBucketAddr = (0x6fd303b8 + nameBucket * 4) >>> 0
  m.setU32((pClient + 0x4b0) >>> 0, m.u32(nameBucketAddr))
  m.setU32(nameBucketAddr, pClient)
  m.setU32((pGame + 0x8c) >>> 0, (i32(m, (pGame + 0x8c) >>> 0) + 1) >>> 0)
  return pClient
}

/**
 * Formats a 33-byte Battle.net portrait/status string into `pOutBuf` (`eax`) from `pClient` (`ecx`),
 * encoding equipped composite GFX, colors, class, level, flags, and rank via `Fog.#10086`.
 *
 * @va D2Game:0x6FC6AE90
 */
export function CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c(
  m: D2KernMemory113c,
  pOutBuf: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC6AE90)
  fogEncode14BitsToString113c(m, pOutBuf, 0x0d)
  const pBody = (pOutBuf + 2) >>> 0
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xfb)
  }
  let pPlayer = 0
  if ((m.u8((pClient + 0x3d4) >>> 0) & 1) !== 0) {
    pPlayer = m.u32((pClient + 0x174) >>> 0) >>> 0
  } else {
    if (m.u32((pClient + 0x174) >>> 0) === 0) {
      return
    }
    pPlayer = SUNIT_GetServerUnit113c(
      m,
      m.u32((pClient + 0x1a8) >>> 0),
      i32(m, (pClient + 0x16c) >>> 0),
      i32(m, (pClient + 0x170) >>> 0),
    ) >>> 0
    if (pPlayer === 0) {
      m.setU32((pClient + 0x174) >>> 0, 0)
    }
  }
  if (pPlayer === 0) {
    return
  }
  const savedSp = k2W3B4StackPtr
  const sp = (savedSp - 0x20) >>> 0
  k2W3B4StackPtr = sp
  try {
    const pCompBuf = sp
    const pColorBuf = (sp + 0x10) >>> 0
    const bLevel = STATLIST_GetUnitStat113c(m, pPlayer, 0x0c, 0) & 0xff
    const dwClassId = m.u32((pPlayer + 0x04) >>> 0) >>> 0
    m.setU32(pCompBuf, 0xffffffff)
    m.setU32((pCompBuf + 0x04) >>> 0, 0xffffffff)
    m.setU32((pCompBuf + 0x08) >>> 0, 0xffffffff)
    m.setU32((pCompBuf + 0x0c) >>> 0, 0xffffffff)
    INVENTORY_UpdateEquippedGfxAndColor113c(m, pPlayer, pCompBuf, pColorBuf)
    stormMemCopy113c(m, pBody, pCompBuf, 0x0b)
    const classByte = dwClassId & 0xff
    m.setU8((pBody + 0x0b) >>> 0, classByte < 7 ? (classByte + 1) & 0xff : 1)
    m.setU32(pColorBuf, 0xffffffff)
    m.setU32((pColorBuf + 0x04) >>> 0, 0xffffffff)
    m.setU32((pColorBuf + 0x08) >>> 0, 0xffffffff)
    m.setU32((pColorBuf + 0x0c) >>> 0, 0xffffffff)
    INVENTORY_UpdateEquippedGfxAndColor113c(m, pPlayer, pCompBuf, pColorBuf)
    for (let i = 0; i < 16; i = (i + 1) | 0) {
      if (m.u8((pColorBuf + i) >>> 0) === 0) {
        m.setU8((pColorBuf + i) >>> 0, 0xff)
      }
    }
    stormMemCopy113c(m, (pBody + 0x0c) >>> 0, pColorBuf, 0x0b)
    m.setU8((pBody + 0x17) >>> 0, bLevel > 0 && bLevel <= 0x63 ? bLevel : 1)
    const dwMode = m.u32((pPlayer + 0x10) >>> 0) >>> 0
    let wFlags = m.u16((pClient + 0x0a) >>> 0)
    if ((dwMode === 0x11 || dwMode === 0) && (wFlags & 0x04) !== 0) {
      wFlags = (wFlags | 0x08) & 0xffff
    } else {
      wFlags = wFlags & 0xfff7
    }
    fogEncode14BitsToString113c(m, (pBody + 0x18) >>> 0, wFlags)
    fogEncode14BitsToString113c(m, (pBody + 0x1a) >>> 0, m.u16((pClient + 0x45e) >>> 0))
    const b480 = m.u8((pClient + 0x480) >>> 0)
    const b481 = m.u8((pClient + 0x481) >>> 0)
    const b482 = m.u8((pClient + 0x482) >>> 0)
    m.setU8((pBody + 0x1c) >>> 0, b480 !== 0 ? b480 : 0xff)
    m.setU8((pBody + 0x1d) >>> 0, b481 !== 0 ? b481 : 0xff)
    m.setU8((pBody + 0x1e) >>> 0, b482 !== 0 ? b482 : 0xff)
    m.setU32((pBody + 0x1f) >>> 0, m.u32((pClient + 0x460) >>> 0))
    const invalidLevel = bLevel < 1 || bLevel > 0x63 ? 1 : 0
    const invalidClass = classByte >= 7 ? 1 : 0
    const invalidFlags = (wFlags & 0x13) !== 0 ? 1 : 0
    const invalidLen = stormStrLen113c(m, pOutBuf) !== 0x21 ? 1 : 0
    if (invalidLevel !== 0 || invalidClass !== 0 || invalidFlags !== 0 || invalidLen !== 0) {
      m.setU8(pOutBuf >>> 0, 0)
    }
  } finally {
    k2W3B4StackPtr = savedSp
  }
}

/**
 * Aura radius callback that unpacks a `D2AuraSetupStrc` from `pAuraCtx` (`ecx`) and `pTargetUnit` (`edx`)
 * and calls `STATES_CreateOrUpdateAuraStatList113c`.
 *
 * @va D2Game:0x6FC6C220
 */
export function SKILLS_AuraCallback_ApplyAuraStatListFromCtx_6FC6C220_113c(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FC6C220)
  const pSubCtx = m.u32((pAuraCtx + 0x0c) >>> 0) >>> 0
  const pCaster = m.u32((pAuraCtx + 0x04) >>> 0) >>> 0
  const savedSp = k2W3B4StackPtr
  const pSetup = (savedSp - 0x24) >>> 0
  k2W3B4StackPtr = pSetup
  try {
    m.setU32(pSetup, pCaster)
    m.setU32((pSetup + 0x04) >>> 0, pTargetUnit >>> 0)
    m.setU32((pSetup + 0x08) >>> 0, m.u32(pSubCtx))
    m.setU32((pSetup + 0x0c) >>> 0, m.u32((pSubCtx + 0x04) >>> 0))
    m.setU32((pSetup + 0x10) >>> 0, m.u32((pSubCtx + 0x08) >>> 0))
    m.setU32((pSetup + 0x14) >>> 0, m.u32((pSubCtx + 0x10) >>> 0))
    m.setU32((pSetup + 0x18) >>> 0, m.u32((pSubCtx + 0x14) >>> 0))
    m.setU32((pSetup + 0x1c) >>> 0, m.u32((pSubCtx + 0x0c) >>> 0))
    m.setU32((pSetup + 0x20) >>> 0, 0)
    STATES_CreateOrUpdateAuraStatList113c(m, pSetup)
  } finally {
    k2W3B4StackPtr = savedSp
  }
  return 1
}

/**
 * `SrvSt` handler that rolls melee ToHit (`0x6FCFE5A0`), rolls skill elemental damage (`+0x20`),
 * evaluates `dwCalc1` (`+0x0c`) and elemental conversion (`+0x65`/`+0x68`), and allocates combat (`0x6FCFDDE0`).
 *
 * @va D2Game:0x6FC6C3A0
 */
export function SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6C3A0)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  if (SKILLS_GetUsedSkillMemPort113c(m, pUnit) === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === pUnit >>> 0 || pTarget === 0) {
    return 0
  }
  const savedSp = k2W3B4StackPtr
  const pDmg = (savedSp - 0x70) >>> 0
  k2W3B4StackPtr = pDmg
  try {
    zeroWords113c(m, pDmg, 0x1c)
    const wFlags = SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, pUnit, pTarget, pGame, 0, 0)
    m.setU16((pDmg + 0x04) >>> 0, wFlags & 0xffff)
    if ((wFlags & 1) !== 0) {
      const minElem = SKILLS_GetSkillElemMinDamage113c(m, pUnit, nSkillId, nSkillLevel, 1) | 0
      const maxElem = SKILLS_GetSkillElemMaxDamage113c(m, pUnit, nSkillId, nSkillLevel, 1) | 0
      const roll = SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, (maxElem - minElem) | 0) | 0
      m.setU32((pDmg + 0x20) >>> 0, ((minElem + roll) | 0) >>> 0)
      const enhDmg = SKILLS_EvalCalcByOffset113c(
        m,
        pUnit,
        i32(m, (pSkillsTxt + 0x138) >>> 0),
        nSkillId,
        nSkillLevel,
      ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, enhDmg >>> 0)
      if (m.u8((pSkillsTxt + 0x1dc) >>> 0) > 0) {
        const convPct = SKILLS_EvalCalcByOffset113c(
          m,
          pUnit,
          i32(m, (pSkillsTxt + 0x144) >>> 0),
          nSkillId,
          nSkillLevel,
        ) | 0
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0)
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, m.u8((pSkillsTxt + 0x1dc) >>> 0))
        }
      }
    }
    let srcDam = m.u8((pSkillsTxt + 0x1a5) >>> 0)
    if (srcDam === 0) {
      srcDam = 0x80
    }
    SUNITDMG_AllocCombat113c(m, pGame, pUnit, pTarget, pDmg, srcDam)
  } finally {
    k2W3B4StackPtr = savedSp
  }
  return 1
}

/**
 * `SrvDo` handler for Lightning Strike: executes melee events on `pTarget`, scans nearby units via
 * `AURA_ForEachUnitInRadius113c` (`0x6FCBED70`), and spawns the chain projectile with `dwCalc2` bounces.
 *
 * @va D2Game:0x6FC6CE10
 */
export function SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6CE10)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === pUnit >>> 0 || pTarget === 0) {
    return 0
  }
  SUNITDMG_ExecuteEvents113c(m, pGame, pUnit, pTarget, 1, 0)
  const nRadius = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    i32(m, (pSkillsTxt + 0x138) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0
  const targetGuid = m.u32((pTarget + 0x0c) >>> 0) >>> 0
  const ty = inlineUnitGetPosY113c(m, pTarget)
  const tx = inlineUnitGetPosX113c(m, pTarget)
  const savedSp = k2W3B4StackPtr
  const sp = (savedSp - 0x78) >>> 0
  k2W3B4StackPtr = sp
  try {
    const pRingCtx = sp
    const pParams = (sp + 0x18) >>> 0
    m.setU32(pRingCtx, 0)
    m.setU32((pRingCtx + 0x04) >>> 0, 0xffffffff)
    m.setU32((pRingCtx + 0x08) >>> 0, 0)
    m.setU32((pRingCtx + 0x0c) >>> 0, targetGuid)
    m.setU32((pRingCtx + 0x10) >>> 0, targetGuid)
    m.setU32((pRingCtx + 0x14) >>> 0, 0)
    AURA_ForEachUnitInRadius113c(
      m,
      pGame,
      pUnit,
      tx,
      ty,
      nRadius,
      0xa783,
      0x6fcbed70,
      pRingCtx,
      0,
      (mem, pFindData, pCand) => SKILLS_TargetRingScanCallback_6FCBED70_113c(mem, pFindData, pCand),
    )
    let pBounceTarget = m.u32(pRingCtx) >>> 0
    if (pBounceTarget === 0) {
      pBounceTarget = m.u32((pRingCtx + 0x08) >>> 0) >>> 0
      m.setU32(pRingCtx, pBounceTarget)
    }
    if (pBounceTarget === 0) {
      return 0
    }
    const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, nSkillId, pUnit) | 0
    const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
    if (nMissileId < 0 || pDataTables === 0 || nMissileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) {
      return 0
    }
    const nChainHits = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      i32(m, (pSkillsTxt + 0x13c) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0
    zeroWords113c(m, pParams, 0x17)
    m.setU32(pParams, 0x20)
    m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x08) >>> 0, pTarget >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x1c) >>> 0, (UNIT_GetPosX113c(m, pBounceTarget) | 0) >>> 0)
    m.setU32((pParams + 0x20) >>> 0, (UNIT_GetPosY113c(m, pBounceTarget) | 0) >>> 0)
    const pMissile = MISSILE_CreateServerProjectile113c(m, pGame, pParams) >>> 0
    if (pMissile !== 0) {
      MISSILE_SetTargetX113c(m, pMissile, nChainHits)
    }
    return 1
  } finally {
    k2W3B4StackPtr = savedSp
  }
}

/**
 * `SrvDo` handler for Charged Strike: executes melee events on `pTarget` and spawns `dwCalc1`
 * charged bolts initialized via `MISSILES_InitChargedBoltPath_6FC61F50_113c`.
 *
 * @va D2Game:0x6FC6D040
 */
export function SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6D040)
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === pUnit >>> 0 || pTarget === 0) {
    return 0
  }
  SUNITDMG_ExecuteEvents113c(m, pGame, pUnit, pTarget, 1, 0)
  const nBolts = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    i32(m, (pSkillsTxt + 0x138) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0
  const tx = inlineUnitGetPosX113c(m, pTarget)
  const ty = inlineUnitGetPosY113c(m, pTarget)
  const ux = inlineUnitGetPosX113c(m, pUnit)
  const uy = inlineUnitGetPosY113c(m, pUnit)
  const dstX = (tx * 2 - ux) | 0
  const dstY = (ty * 2 - uy) | 0
  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, nSkillId, pUnit) | 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  if (nMissileId < 0 || pDataTables === 0 || nMissileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) {
    return 0
  }
  const savedSp = k2W3B4StackPtr
  const pParams = (savedSp - 0x60) >>> 0
  k2W3B4StackPtr = pParams
  try {
    zeroWords113c(m, pParams, 0x17)
    m.setU32(pParams, 0x21)
    m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, tx >>> 0)
    m.setU32((pParams + 0x18) >>> 0, ty >>> 0)
    m.setU32((pParams + 0x1c) >>> 0, dstX >>> 0)
    m.setU32((pParams + 0x20) >>> 0, dstY >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    m.setU32((pParams + 0x54) >>> 0, 0x6fc61f50)
    for (let i = 0; i < nBolts; i = (i + 1) | 0) {
      m.setU32((pParams + 0x58) >>> 0, i >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame, pParams, {
        missileInitCallback: (mem, _fnVa, pMis, initArg) => {
          MISSILES_InitChargedBoltPath_6FC61F50_113c(mem, pMis, initArg)
        },
      })
    }
  } finally {
    k2W3B4StackPtr = savedSp
  }
  return 1
}

/**
 * Absorbs incoming physical damage (`pDmg + 0x08`) against `pDefender`'s Bone Armor stat pool
 * (`wAuraStat1`/`wAuraStat2`), updating percentage stat `0x54` or removing the state on depletion.
 *
 * @va D2Game:0x6FC6DFE0
 */
export function SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c(
  m: D2KernMemory113c,
  pDefender: number,
  _pAttacker: number,
  pDmg: number,
  nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6DFE0)
  if (pDefender === 0 || pDmg === 0) {
    return 0
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wAuraState < 0 || pDataTables === 0 || wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }
  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, wAuraState) >>> 0
  if (pStatList === 0) {
    return 0
  }
  const wMaxStat = sx16(m.u16((pSkillsTxt + 0x56) >>> 0))
  if (wMaxStat < 0 || wMaxStat >= i32(m, (pDataTables + 0xbd4) >>> 0)) {
    return 0
  }
  const nMaxArmor = STATLIST_GetStatValue113c(m, pStatList, wMaxStat, 0) | 0
  if (nMaxArmor <= 0) {
    return 0
  }
  const wCurStat = sx16(m.u16((pSkillsTxt + 0x54) >>> 0))
  if (wCurStat < 0 || wCurStat >= i32(m, (pDataTables + 0xbd4) >>> 0)) {
    return 0
  }
  let nCurArmor = STATLIST_GetStatValue113c(m, pStatList, wCurStat, 0) | 0
  if (nCurArmor > 0) {
    const physDmg = i32(m, (pDmg + 0x08) >>> 0)
    if (nCurArmor <= physDmg) {
      m.setU32((pDmg + 0x08) >>> 0, ((physDmg - nCurArmor) | 0) >>> 0)
      nCurArmor = 0
    } else {
      nCurArmor = (nCurArmor - physDmg) | 0
      m.setU32((pDmg + 0x08) >>> 0, 0)
    }
    STATLIST_SetStat113c(m, pStatList, wCurStat, nCurArmor, 0)
  }
  if (nCurArmor === 0) {
    STATES_ToggleGfxStateFlag113c(m, pDefender, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)), 0)
    STATLIST_UnlinkSubList113c(m, pDefender, pStatList)
    STATLIST_FreeStatListIfNonExtended113c(m, pStatList)
    return 1
  }
  const pct = mulDiv113c(100, nCurArmor, nMaxArmor) | 0
  const oldPct = STATLIST_GetStatValue113c(m, pStatList, 0x54, 0) | 0
  let diff = (pct - oldPct) | 0
  if (diff < 0) {
    diff = (-diff) | 0
  }
  if (diff >= 5) {
    STATES_ClearGfxStateFlag113c(m, pDefender, sx16(m.u16((pSkillsTxt + 0x80) >>> 0)), 1)
    STATLIST_SetStat113c(m, pStatList, 0x54, pct, 0)
  }
  return 1
}

/**
 * Transfers `Param5`% of incoming damage (`pDmg + 0x4c`) on Blood Golem (`pDefender`) to its
 * owner's life (`STAT_HITPOINTS = 6`, clamped at `>= 0x100`).
 *
 * @va D2Game:0x6FC6E500
 */
export function SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c(
  m: D2KernMemory113c,
  pDefender: number,
  _pAttacker: number,
  pDmg: number,
  _nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6E500)
  if (pDefender === 0 || pDmg === 0) {
    return 0
  }
  if (i32(m, pDefender >>> 0) !== 1 || i32(m, (pDmg + 0x4c) >>> 0) <= 0) {
    return 0
  }
  const pOwner = AIGENERAL_GetPackLeaderUnit113c(m, pDefender) >>> 0
  if (pOwner === 0 || SUNIT_IsDeadOrDying113c(m, pOwner) !== 0) {
    return 0
  }
  let ownerLife = STATLIST_GetUnitStat113c(m, pOwner, 6, 0) | 0
  if (ownerLife < 0x100) {
    return 0
  }
  const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, i32(m, (pDefender + 0x04) >>> 0)) >>> 0
  if (pMonStatsTxt === 0) {
    return 0
  }
  const wSkillId = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (wSkillId < 0) {
    return 0
  }
  const nParam5 = SKILLS_GetParam5Fast_6FC21C50_113c(m, wSkillId) | 0
  const sharedDmg = mulDiv113c(nParam5, i32(m, (pDmg + 0x4c) >>> 0), 100) | 0
  ownerLife = (ownerLife - sharedDmg) | 0
  if (ownerLife < 0x100) {
    ownerLife = 0x100
  }
  STATLIST_SetUnitStat113c(m, pOwner, 6, ownerLife, 0)
  const remDmg = (i32(m, (pDmg + 0x4c) >>> 0) - sharedDmg) | 0
  m.setU32((pDmg + 0x4c) >>> 0, (remDmg > 0 ? remDmg : 0) >>> 0)
  return 1
}

/**
 * Computes Blood Golem life steal from `pDmg->dwPhysDamage` (`+0x08`, scaled by target drain
 * effectiveness and `SKILLS_EvalParam12DimReturns`) and distributes healing between `pOwner` (`Param3`%) and `pAttacker`.
 *
 * @va D2Game:0x6FC6E5F0
 */
export function SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  _nEvent: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6E5F0)
  if (pAttacker === 0 || pDefender === 0 || pDmg === 0) {
    return 0
  }
  const defType = i32(m, pDefender >>> 0)
  if (defType !== 0 && defType !== 1) {
    return 0
  }
  let drainEff = 100
  if (defType === 1) {
    const pMonStatsTxt = MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(m, pDefender) >>> 0
    if (pMonStatsTxt === 0) {
      return 0
    }
    const diff = m.u8((pGame + 0x6d) >>> 0)
    drainEff = m.u8((pMonStatsTxt + 0xa0 + diff) >>> 0)
    if (drainEff === 0) {
      return 0
    }
  }
  if (UNIT_GetAlignment113c(m, pDefender) !== 0) {
    return 0
  }
  let stolenLife = i32(m, (pDmg + 0x08) >>> 0)
  if (drainEff !== 100) {
    stolenLife = mulDiv113c(drainEff, stolenLife, 100) | 0
  }
  const defLife = STATLIST_GetUnitStat113c(m, pDefender, 6, 0) | 0
  if (stolenLife >= defLife) {
    stolenLife = defLife
  }
  const pOwner = AIGENERAL_GetPackLeaderUnit113c(m, pAttacker) >>> 0
  if (pOwner !== 0 && SUNIT_IsDeadOrDying113c(m, pOwner) !== 0) {
    return 0
  }
  if (SUNIT_IsDeadOrDying113c(m, pAttacker) !== 0) {
    return 0
  }
  const leechPct = SKILLS_EvalParam12DimReturns113c(m, nSkillLevel, nSkillId) | 0
  if (leechPct <= 0) {
    return 0
  }
  stolenLife = mulDiv113c(leechPct, stolenLife, 100) | 0
  if (stolenLife <= 0) {
    return 0
  }
  const ownerSharePct = SKILLS_GetParam3Fast_6FC21BF0_113c(m, nSkillId) | 0
  if (pOwner !== 0 && ownerSharePct > 0) {
    const ownerHealReq = mulDiv113c(ownerSharePct, stolenLife, 100) | 0
    const healedOwner = SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, ownerHealReq, pOwner) | 0
    stolenLife = (stolenLife - healedOwner) | 0
  }
  const healedGolem = SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, stolenLife, pAttacker) | 0
  stolenLife = (stolenLife - healedGolem) | 0
  if (pOwner !== 0 && stolenLife > 0) {
    SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, stolenLife, pOwner)
  }
  STATES_SetMonsterSkillIconOnUnit113c(m, pAttacker, 0x97, 0)
  if (ownerSharePct > 0 && pOwner !== 0) {
    STATES_SetMonsterSkillIconOnUnit113c(m, pOwner, 0x97, 0)
  }
  return 1
}

/**
 * Heals `pAttacker` by `dwCalc1`% of `pDmg->dwPhysDamage` (`+0x08`) when `pDefender` has the
 * Life Tap curse state (`wAuraState2` `+0x82`), and sets overlay icon `wAuraTargetState` (`+0x10c`).
 *
 * @va D2Game:0x6FC6E760
 */
export function SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c(
  m: D2KernMemory113c,
  pGame: number,
  _nEvent: number,
  pDefender: number,
  pAttacker: number,
  pDmg: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6E760)
  if (pDefender === 0 || pAttacker === 0) {
    return 0
  }
  const defType = i32(m, pDefender >>> 0)
  if (defType !== 0 && defType !== 1) {
    return 0
  }
  const atkType = i32(m, pAttacker >>> 0)
  if (atkType !== 0 && atkType !== 1) {
    return 0
  }
  if (SUNIT_IsDeadOrDying113c(m, pAttacker) !== 0) {
    return 0
  }
  if (pDmg === 0 || i32(m, (pDmg + 0x08) >>> 0) <= 0) {
    return 0
  }
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0) {
    return 0
  }
  let lvl = nSkillLevel | 0
  if (lvl < 0) {
    lvl = 1
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  const wAuraState2 = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
  if (wAuraState2 < 0 || pDataTables === 0 || wAuraState2 >= i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }
  if (STATES_CheckState113c(m, pDefender, wAuraState2) === 0) {
    return 0
  }
  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(
    m,
    pDefender,
    sx16(m.u16((pSkillsTxt + 0x82) >>> 0)),
  ) >>> 0
  if (pStatList === 0) {
    return 0
  }
  const ownerId = STATLIST_GetOwnerId113c(m, pStatList) | 0
  const ownerType = STATLIST_GetOwnerType113c(m, pStatList) | 0
  const pCurseOwner = SUNIT_GetServerUnit113c(m, pGame, ownerType, ownerId) >>> 0
  const calcVal = SKILLS_EvalCalcByOffset113c(
    m,
    pCurseOwner,
    i32(m, (pSkillsTxt + 0x138) >>> 0),
    nSkillId,
    lvl,
  ) | 0
  const healAmt = mulDiv113c(calcVal, i32(m, (pDmg + 0x08) >>> 0), 100) | 0
  const curLife = STATLIST_GetUnitStat113c(m, pAttacker, 6, 0) | 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pAttacker) | 0
  if (curLife <= 0 || maxLife <= 0) {
    return 0
  }
  let nextLife = (curLife + healAmt) | 0
  if (nextLife < 1) {
    nextLife = 1
  }
  if (nextLife > maxLife) {
    nextLife = maxLife
  }
  STATLIST_SetUnitStat113c(m, pAttacker, 6, nextLife, 0)
  const wOverlay = sx16(m.u16((pSkillsTxt + 0x10c) >>> 0))
  if (wOverlay > 0 && wOverlay < i32(m, (pDataTables + 0xbc0) >>> 0)) {
    STATES_SetMonsterSkillIconOnUnit113c(m, pAttacker, wOverlay, 0)
  }
  return 1
}

/**
 * Shares a portion (`Param6`%) of `pPlayer`'s (`eax`) healing (`nHealAmount` in `ecx`) with an active
 * Blood Golem (`classId == 0x122`) in pet slot `3`, returning the remaining player heal amount.
 *
 * @va D2Game:0x6FC6EA30
 */
export function SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  nHealAmount: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC6EA30)
  let remHeal = nHealAmount | 0
  if (pPlayer === 0) {
    return remHeal
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  if (pPlayerData === 0) {
    return remHeal
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  if (pDataTables === 0 || i32(m, (pDataTables + 0xbf0) >>> 0) <= 3) {
    return remHeal
  }
  const pPetTableHolder = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPetTableHolder === 0) {
    return remHeal
  }
  const pPetBuckets = m.u32(pPetTableHolder) >>> 0
  const pSlot3 = (pPetBuckets + 0x24) >>> 0
  if (pSlot3 === 0) {
    return remHeal
  }
  let pPetNode = m.u32(pSlot3) >>> 0
  if (pPetNode === 0) {
    return remHeal
  }
  while ((m.u8(pPetNode) & 1) !== 0) {
    pPetNode = m.u32((pPetNode + 0x14) >>> 0) >>> 0
    if (pPetNode === 0) {
      return remHeal
    }
  }
  const dwPetGuid = m.u32((pPetNode + 0x04) >>> 0) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('SkillNec.cpp', 0x2d3)
  }
  let pMon = m.u32((pGame + 0x1320 + (dwPetGuid & 0x7f) * 4) >>> 0) >>> 0
  if (pMon === 0) {
    return remHeal
  }
  while (m.u32((pMon + 0x0c) >>> 0) !== dwPetGuid) {
    pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
    if (pMon === 0) {
      return remHeal
    }
  }
  if (i32(m, pMon) !== 1 || i32(m, (pMon + 0x04) >>> 0) !== 0x122) {
    return remHeal
  }
  if (remHeal === 0) {
    const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pMon) | 0
    STATLIST_SetUnitStat113c(m, pMon, 6, maxLife, 0)
    return 0
  }
  const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, 0x122) >>> 0
  if (pMonStatsTxt === 0) {
    return remHeal
  }
  const wSkillId = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (wSkillId < 0) {
    return remHeal
  }
  const nParam6 = SKILLS_GetParam6Fast_6FC21EC0_113c(m, wSkillId) | 0
  const golemHealReq = sdiv32(imul32(nParam6, remHeal), 100)
  const actualHealed = SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, golemHealReq, pMon) | 0
  remHeal = (remHeal - actualHealed) | 0
  return remHeal
}

/**
 * Dispatches Necromancer skeleton pet component initialization for warrior (`classId == 0x16b`, `0x6FC6E960`)
 * or mage (`classId == 0x16c`, `0x6FC6E900`) skeletons.
 *
 * @va D2Game:0x6FC6EB50
 */
export function SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c(
  m: D2KernMemory113c,
  pMonster: number,
  pOwnerUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FC6EB50)
  const nClassId = pMonster !== 0 ? i32(m, (pMonster + 0x04) >>> 0) : -1
  if (nClassId === 0x16b) {
    SKILLS_InitNecroWarriorSkeletonComponents_6FC6E960_113c(
      m,
      nSkillId,
      pOwnerUnit,
      pMonster,
      nSkillLevel,
    )
  } else if (nClassId === 0x16c) {
    SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c(m, pOwnerUnit, pMonster)
  }
}

/**
 * Applies `STAT_ITEM_SLOW` (`0x96`) from `pAttacker` to `pDefender` (capped at `50%` for players
 * and boss monsters, `90%` for normal monsters) via `STATES_CreateOrUpdateAuraStatList113c` (`state 0x18`).
 *
 * @va D2Game:0x6FC6EF70
 */
export function SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pDefender: number,
  _pDmg: number,
  _nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6EF70)
  if (pAttacker === 0 || pDefender === 0) {
    return 0
  }
  let slowPct = STATLIST_GetUnitStatWithLayer113c(m, pAttacker, 0x96, 0) | 0
  if (slowPct === 0) {
    return 0
  }
  const defType = i32(m, pDefender >>> 0)
  if (defType === 0) {
    if (slowPct >= 0x32) {
      slowPct = 0x32
    }
  } else if (defType === 1) {
    if (MONSTER_CheckTypeFlagsMask113c(m, pDefender, 0x0c) !== 0) {
      if (slowPct >= 0x32) {
        slowPct = 0x32
      }
    } else if (slowPct >= 0x5a) {
      slowPct = 0x5a
    }
  } else {
    return 0
  }
  slowPct = (-slowPct) | 0
  const savedSp = k2W3B4StackPtr
  const pSetup = (savedSp - 0x24) >>> 0
  k2W3B4StackPtr = pSetup
  try {
    zeroWords113c(m, pSetup, 9)
    m.setU32(pSetup, pAttacker >>> 0)
    m.setU32((pSetup + 0x04) >>> 0, pDefender >>> 0)
    m.setU32((pSetup + 0x0c) >>> 0, 1)
    m.setU32((pSetup + 0x10) >>> 0, 0x2ee)
    m.setU32((pSetup + 0x14) >>> 0, 0x43)
    m.setU32((pSetup + 0x18) >>> 0, slowPct >>> 0)
    m.setU32((pSetup + 0x1c) >>> 0, 0x18)
    const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, pSetup) >>> 0
    if (pStatList === 0) {
      return 0
    }
    STATLIST_SetStat113c(m, pStatList, 0x44, slowPct, 0)
    STATLIST_SetStat113c(m, pStatList, 0x45, slowPct, 0)
    UNITS_SetUnitAnimMode113c(m, pDefender, 0x6fd1c1dc, 0xb62)
    return 1
  } finally {
    k2W3B4StackPtr = savedSp
  }
}

/**
 * Reflects physical melee damage (`pDmg + 0x08`) via Iron Maiden (`wAuraState2` `+0x82`),
 * applies reflected damage + side effects, and triggers Blood Golem (`0x122`) shared life steal.
 *
 * @va D2Game:0x6FC6F090
 */
export function SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c(
  m: D2KernMemory113c,
  pGame: number,
  _nEvent: number,
  pUnit: number,
  pTarget: number,
  pDmg: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6F090)
  if (pTarget === 0 || pUnit === 0) {
    return 0
  }
  const unitType = i32(m, pUnit >>> 0)
  if (unitType !== 0 && unitType !== 1) {
    return 0
  }
  if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) {
    return 0
  }
  if (pDmg === 0 || i32(m, (pDmg + 0x08) >>> 0) <= 0) {
    return 0
  }
  let lvl = nSkillLevel | 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0) {
    return 0
  }
  if (lvl < 0) {
    lvl = 1
  }
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  const wAuraState2 = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
  if (wAuraState2 < 0 || pDataTables === 0 || wAuraState2 >= i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }
  if (STATES_CheckState113c(m, pUnit, wAuraState2) === 0) {
    return 0
  }
  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(
    m,
    pUnit,
    sx16(m.u16((pSkillsTxt + 0x82) >>> 0)),
  ) >>> 0
  if (pStatList === 0) {
    return 0
  }
  const ownerId = STATLIST_GetOwnerId113c(m, pStatList) | 0
  const ownerType = STATLIST_GetOwnerType113c(m, pStatList) | 0
  const pCurseOwner = SUNIT_GetServerUnit113c(m, pGame, ownerType, ownerId) >>> 0
  let calcOffset = 0
  if (i32(m, pUnit >>> 0) !== 0 && MONSTERS_GetHirelingTypeId113c(m, pUnit) === 0) {
    calcOffset = i32(m, (pSkillsTxt + 0x138) >>> 0)
  } else if (i32(m, pTarget >>> 0) === 0) {
    calcOffset = i32(m, (pSkillsTxt + 0x13c) >>> 0)
  } else {
    calcOffset = i32(m, (pSkillsTxt + 0x140) >>> 0)
  }
  const reflectPct = SKILLS_EvalCalcByOffset113c(m, pCurseOwner, calcOffset, nSkillId, lvl) | 0
  const savedSp = k2W3B4StackPtr
  const pReflectedDmg = (savedSp - 0x70) >>> 0
  k2W3B4StackPtr = pReflectedDmg
  try {
    zeroWords113c(m, pReflectedDmg, 0x1c)
    const reflectedPhys = mulDiv113c(reflectPct, i32(m, (pDmg + 0x08) >>> 0), 100) | 0
    m.setU32((pReflectedDmg + 0x08) >>> 0, reflectedPhys >>> 0)
    const wResFlags = (m.u16((pSkillsTxt + 0x12e) >>> 0) | 0x20) & 0xffff
    m.setU16((pReflectedDmg + 0x04) >>> 0, (m.u16((pReflectedDmg + 0x04) >>> 0) | wResFlags) & 0xffff)
    m.setU32(pReflectedDmg, (m.u32(pReflectedDmg) | m.u32((pSkillsTxt + 0x130) >>> 0)) >>> 0)
    m.setU32((pReflectedDmg + 0x60) >>> 0, m.u32((pSkillsTxt + 0x134) >>> 0))
    SUNITDMG_ApplyDamage113c(m, pGame, pTarget, pUnit, pReflectedDmg, 1)
    SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pTarget, pUnit, pReflectedDmg)

    if (i32(m, pTarget >>> 0) === 1 && i32(m, (pTarget + 0x04) >>> 0) === 0x122) {
      const pMonStatsTxt = MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(m, pTarget) >>> 0
      if (pMonStatsTxt !== 0) {
        const diff = m.u8((pGame + 0x6d) >>> 0)
        const drainEff = m.u8((pMonStatsTxt + 0xa0 + diff) >>> 0)
        if (drainEff > 0 && UNIT_GetAlignment113c(m, pTarget) === 0) {
          let effPhys = i32(m, (pReflectedDmg + 0x08) >>> 0)
          if (drainEff !== 100) {
            effPhys = mulDiv113c(drainEff, effPhys, 100) | 0
          }
          const pOwner = AIGENERAL_GetPackLeaderUnit113c(m, pUnit) >>> 0
          if (
            (pOwner === 0 || SUNIT_IsDeadOrDying113c(m, pOwner) === 0) &&
            SUNIT_IsDeadOrDying113c(m, pUnit) === 0
          ) {
            let totalHeal = mulDiv113c(20, effPhys, 100) | 0
            if (totalHeal > 0) {
              if (pOwner !== 0) {
                const ownerShare = mulDiv113c(50, totalHeal, 100) | 0
                const healedOwner =
                  SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, ownerShare, pOwner) | 0
                totalHeal = (totalHeal - healedOwner) | 0
              }
              const healedUnit =
                SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, totalHeal, pUnit) | 0
              totalHeal = (totalHeal - healedUnit) | 0
              if (pOwner !== 0 && totalHeal > 0) {
                SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, totalHeal, pOwner)
              }
              STATES_SetMonsterSkillIconOnUnit113c(m, pUnit, 0x97, 0)
              if (pOwner !== 0) {
                STATES_SetMonsterSkillIconOnUnit113c(m, pOwner, 0x97, 0)
              }
            }
          }
        }
      }
    }
  } finally {
    k2W3B4StackPtr = savedSp
  }
  return 1
}

/**
 * `SrvDo` handler for Corpse Explosion: consumes the target corpse (`state 0x68`), computes
 * physical + elemental explosion damage scaled by corpse base life, and dispatches
 * `AURA_ForEachUnitInRadius113c` with `SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c`.
 *
 * @va D2Game:0x6FC6F4D0
 */
export function SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6F4D0)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pCorpse = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pCorpse === pUnit >>> 0 || pCorpse === 0) {
    return 0
  }
  if (SKILLS_IsSelectableCorpse11157_113c(m, pCorpse) === 0) {
    return 0
  }
  STATES_ToggleGfxStateFlag113c(m, pCorpse, 0x68, 1)
  UNITROOM_RefreshUnit113c(m, pCorpse)
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (nSkillId === 0 || pSkillsTxt === 0) {
    return 0
  }
  const savedSp = k2W3B4StackPtr
  const sp = (savedSp - 0xc0) >>> 0
  k2W3B4StackPtr = sp
  try {
    const pSubCtx = sp
    const pMonStatsOut = (sp + 0x10) >>> 0
    const pDmg = (sp + 0x48) >>> 0

    let baseMaxHp = STATLIST_GetUnitBaseStat113c(m, pCorpse, 7, 0) | 0
    if (i32(m, pCorpse >>> 0) === 1) {
      const isExp =
        m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0 ? 1 : 0
      zeroWords113c(m, pMonStatsOut, 0x0e)
      const corpseLvl = STATLIST_GetUnitStat113c(m, pCorpse, 0x0c, 0) | 0
      const diff = m.u8((pGame + 0x6d) >>> 0)
      DATATBLS_CalculateMonsterStatsByLevel113c(
        m,
        i32(m, (pCorpse + 0x04) >>> 0),
        isExp,
        diff,
        corpseLvl,
        1,
        pMonStatsOut,
      )
      baseMaxHp = ((i32(m, pMonStatsOut) + i32(m, (pMonStatsOut + 0x04) >>> 0)) << 7) | 0
    }
    const cx = UNIT_GetPosX113c(m, pCorpse) | 0
    const cy = UNIT_GetPosY113c(m, pCorpse) | 0
    const rawRadius = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      i32(m, (pSkillsTxt + 0x64) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0
    const physRadius = sdiv32(rawRadius, 2)
    const fullRadius = sdiv32((rawRadius + 1) | 0, 2)
    const minPct = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      i32(m, (pSkillsTxt + 0x138) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0
    const minDmg = mulDiv113c(baseMaxHp, minPct, 100) | 0
    const maxPct = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      i32(m, (pSkillsTxt + 0x13c) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0
    const maxDmg = mulDiv113c(baseMaxHp, maxPct, 100) | 0
    const roll = SEED_RollLimitedFast113c(m, (pCorpse + 0x20) >>> 0, (maxDmg - minDmg) | 0) | 0
    let totalDmg = (minDmg + roll) | 0
    const corpseLvl2 = STATLIST_GetUnitStat113c(m, pCorpse, 0x0c, 0) | 0
    const casterLvl = STATLIST_GetUnitStat113c(m, pUnit, 0x0c, 0) | 0
    if (corpseLvl2 !== 0 && casterLvl < corpseLvl2) {
      totalDmg = mulDiv113c(casterLvl, totalDmg, corpseLvl2) | 0
    }
    zeroWords113c(m, pDmg, 0x1c)
    const elemPctRaw = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      i32(m, (pSkillsTxt + 0x140) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0
    const elemPct = elemPctRaw <= 0 ? 0 : elemPctRaw < 100 ? elemPctRaw : 100
    if (elemPct > 0 && m.u8((pSkillsTxt + 0x1dc) >>> 0) !== 0) {
      const elemLen =
        SKILLS_GetSkillPeriodicDelayOrLength113c(m, pUnit, nSkillId, nSkillLevel, 1) | 0
      const elemDmg = mulDiv113c(elemPct, totalDmg, 100) | 0
      SUNITDMG_AddElementalDamageToStruct113c(
        m,
        pDmg,
        m.u8((pSkillsTxt + 0x1dc) >>> 0),
        pUnit,
        elemDmg,
        elemLen,
        0,
        0,
      )
      totalDmg = mulDiv113c((100 - elemPct) | 0, totalDmg, 100) | 0
    }
    m.setU32((pDmg + 0x08) >>> 0, totalDmg >>> 0)
    m.setU32(pSubCtx, pDmg)
    m.setU32((pSubCtx + 0x04) >>> 0, cx >>> 0)
    m.setU32((pSubCtx + 0x08) >>> 0, cy >>> 0)
    m.setU32((pSubCtx + 0x0c) >>> 0, imul32(physRadius, physRadius) >>> 0)
    AURA_ForEachUnitInRadius113c(
      m,
      pGame,
      pUnit,
      cx,
      cy,
      fullRadius,
      m.u32((pSkillsTxt + 0x50) >>> 0),
      0x6fc6f370,
      pSubCtx,
      0,
      (mem, pAuraCtx, pTarget) =>
        SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c(mem, pAuraCtx, pTarget),
    )
    return 1
  } finally {
    k2W3B4StackPtr = savedSp
  }
}
