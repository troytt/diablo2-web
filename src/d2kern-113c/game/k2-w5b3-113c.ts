/**
 * Milestone 33 [K2] Wave 5 Batch 3 (`w5b3`): 45 `D2Game.dll` v1.13c functions
 * in the VA range `0x6FCB9620..0x6FCDC6B0`.
 *
 * Clean-room 1:1 binary-isomorphic translations from `D2Game.dll` v1.13c.
 */

import {
  COLLISION_CheckMaskWithPattern2_113c,
  COLLISION_CheckMaskWithSizeXY113c,
  COLLISION_FindFreePositionWithStep113c,
  COLLISION_SetUnitCollisionMaskWithPattern113c,
} from '../common/collision'
import { UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon'
import { mulDiv113c } from '../common/int-math'
import {
  INVENTORY_FindStackableCompatItemInBelt113c,
  INVENTORY_FindStackableCompatItemInGrid0_113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_AreStackableWeaponsCompatible113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_EvalItemCalc113c,
  ITEMS_GetMagicSuffix113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_IsAutoStack113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_ClearPrevTargetCoord113c,
  PATH_Compute113c,
  PATH_ComputeSquaredDistance113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetNewDistance113c,
  PATH_SetType113c,
  PATH_SetVelocity113c,
  UNITS_GetDirectionToCoords113c,
} from '../common/path'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateManaCost256ths113c,
  SKILLS_GetParam1113c,
  SKILLS_GetParam2113c,
  SKILLS_GetParam3113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_GetSkillPhysMaxDamage113c,
  SKILLS_GetSkillPhysMinDamage113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_GetExpireFrameEx113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  UNITS_AreUnitsAligned113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetRoom113c,
  UNITS_GetShiftedFrameMetrics113c,
  UNITS_HasCollisionBetweenUnits113c,
  UNITS_SetSeqFrameFromLowByte113c,
} from '../common/unit'
import {
  UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c,
  UNITFINDS_FreeUnitFindData113c,
  UNITFINDS_InitUnitFindData113c,
} from '../common/unit-finds'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint'
import type { Memory113c } from '../mem/sparse-memory'
import { seedRoll } from '../prng'
import {
  DATATBLS_GetDirectionOffset113c,
  DATATBLS_GetQualityItemsTxtRecord113c,
  DATATBLS_NormalizeDirection113c,
} from '../tables/datatbls-113c'
import {
  SKILLS_ExecuteSkillDoFunc113c,
  SUNIT_AreUnitsHostileOrUnaligned113c,
} from './a1c-post150-f786-f1040-113c'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillWithMode113c,
  MONSTER_CheckTypeFlagsMask113c,
  MONSTER_InitModeChangeStrc113c,
} from './ai-fallen-113c'
import {
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
} from './boot-init-gap-b-113c'
import {
  AI_FindTargetScanRoomCallback113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_StartModeCast113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_ExecuteEvents113c,
} from './combat-a1c-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  AURAS_ApplyRadialStatBuffCallback113c,
  AURA_CheckCircleIntersectsRoom113c,
  AURA_CheckUnitMatchesFilterFlags113c,
  AURA_ForEachUnitInRadius113c,
  DATATBLS_GetItemStatCostRecordFast113c,
  STATES_CreateOrUpdateAuraStatList113c,
} from './k2-gap-itemdef-113c'
import {
  MISSILES_GetTxtRecordFast113c,
  MISSILE_CreateServerProjectile113c,
  STATES_OnTimedStateRemoved113c,
} from './k2-gap-melee-dot-113c'
import {
  SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c,
  type SUnitDmgHooks113c,
} from './k2-real-s2c-combat-113c'
import {
  CHARSTATS_GetRecordPtrFast_6FC210A0_113c,
  PETTYPE_GetRecordPtrFast_6FC21B60_113c,
  SKILLS_GetParam1Fast_6FC21B90_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import {
  PLAYER_GetPlayerDataField48_6FC57440_113c,
  QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c,
} from './k2-laneK-0x6fc5-w1-113c'
import { SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c } from './k2-laneL-0x6fc6-w1-113c'
import { S2C_QueueByteDwordPacket6_6FCAC3B0_113c } from './k2-w2b4-113c'
import {
  MONAI_GetUnitMeleeVelocity_6FCD08A0_113c,
  MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c,
  SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c,
  SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c,
  SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c,
  SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c,
} from './k2-w2b5-113c'
import {
  ACT4Prologue_ActiveFilter_6FCD8B50_113c,
  ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c,
  ACT4Prologue_StatusFilter_6FCD8B80_113c,
  ACT4Q0_StatusFilter_6FCD87D0_113c,
  SKILLS_InitInfernoSeqFrames_6FCD3270_113c,
} from './k2-w2b6-113c'
import { SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c } from './k2-w2b8-113c'
import {
  AURAS_RedemptionCorpseCallback_6FCB8680_113c,
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
  PETS_FindPetTypeByGuid_6FCB6600_113c,
} from './k2-w4b5-113c'
import {
  SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c,
  SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c,
  SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c,
  SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c,
  SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c,
  SKILLS_FindClosestUnitCallback_6FCBEDB0_113c,
  SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c,
  SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
  SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c,
  SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c,
  STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c,
  STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c,
  type K2W4B6Hooks113c,
} from './k2-w4b6-113c'
import {
  AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c,
  ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c,
  MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c,
  MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c,
  MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c,
  MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c,
  MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c,
  MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c,
  MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c,
  MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c,
  MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c,
} from './k2-w4b7-113c'
import {
  ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c,
  ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c,
  ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c,
  ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c,
  ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c,
  AIBAAL_ChooseActionWeighted_6FCD7380_113c,
  AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c,
  AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c,
  SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c,
} from './k2-w4b8-113c'
import {
  registerAiTargetModeCallback113c,
  SUNIT_IsDeadOrDying113c,
} from './monster-events'
import {
  MONSTATS_GetRecordPtr113c,
  MONSTATS_ValidateClassId113c,
  MONSTER_GetBaseIdFromUnit113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SEED_RollMaskFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { PLAYER_GetEquippedWeapon113c, SKILLS_GetFlags113c } from './replay-kernel-113c'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
  MONSTER_RefreshAiEvent113c,
} from './timer-wheel'
import {
  AITARGET_ScanUnitsByModeTable113c,
} from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

const SGPT_DATATABLES_6FD1829C = 0x6fd1829c
const GDW_BITMASKS_6FD18BE0 = 0x6fd18be0

function readI8(m: D2KernMemory113c, addr: number): number {
  return (m.u8(addr >>> 0) << 24) >> 24
}

function readI16(m: D2KernMemory113c, addr: number): number {
  return (m.u16(addr >>> 0) << 16) >> 16
}

function readI32(m: D2KernMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

function writeI32(m: D2KernMemory113c, addr: number, val: number): void {
  m.setU32(addr >>> 0, val >>> 0)
}

// Exact D2Game.dll .rdata Catapult skill table at 0x6FD1B69C
const CATAPULT_SKILLS_6FD1B69C = [0x11f, 0x120, 0x12f, 0x130, 0x131] as const

function rollSeedLimited6FC21180(m: D2KernMemory113c, pSeed: number, nRange: number): number {
  const ptr = pSeed >>> 0
  const seed = { lo: m.u32(ptr) >>> 0, hi: m.u32((ptr + 4) >>> 0) >>> 0 }
  const roll = seedRoll(seed, nRange | 0) | 0
  m.setU32(ptr, seed.lo >>> 0)
  m.setU32((ptr + 4) >>> 0, seed.hi >>> 0)
  return roll
}

/**
 * Initiates a Charge-like movement skill on `pUnit`, starting an immediate melee/monster attack
 * if already within melee range of the path target, or configuring path velocity/distance and
 * skill parameters (`Param1`, `Param2`, `Param0C`, `Param4 = 0x1001`) plus state `0x12`.
 *
 * @va D2Game:0x6FCB9620
 */
export function SKILLS_DoChargeStart_6FCB9620_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCB9620)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pSkill === 0) return 0

  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0) >>> 0
  if (pTarget !== (pUnit >>> 0) && pTarget !== 0) {
    if (UNITS_CanUnitMeleeAttackTarget113c(m, pUnit >>> 0, pTarget, 0) !== 0) {
      if (m.u32(pUnit >>> 0) === 0) {
        return SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c(
          m,
          pUnit >>> 0,
          pGame >>> 0,
          pTarget,
        )
      }
      SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c(m, pUnit >>> 0, pGame >>> 0, 1)
      SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
      const nBaseId = MONSTER_GetBaseIdFromUnit113c(m, pUnit >>> 0) | 0
      const nValidId = MONSTATS_ValidateClassId113c(m, nBaseId) | 0
      const nMode = nValidId === 0x49 ? 5 : nValidId === 0xd3 ? 5 : 4
      const sp = m.alloc(0x20) >>> 0
      MONSTER_InitModeChangeStrc113c(m, pUnit >>> 0, sp, nMode)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      return MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, nMode, pTarget, 0, 0) ? 1 : 0
    }
    if (STATES_CheckState113c(m, pTarget, 0x36) === 0) {
      SKILLS_SetParam1113c(m, pSkill, m.u32(pTarget))
      SKILLS_SetParam2113c(m, pSkill, m.u32((pTarget + 0x0c) >>> 0))
    } else {
      SKILLS_SetParam1113c(m, pSkill, 6)
      SKILLS_SetParam2113c(m, pSkill, 0)
    }
  } else {
    SKILLS_SetParam1113c(m, pSkill, 6)
    SKILLS_SetParam2113c(m, pSkill, 0)
  }

  SKILLS_SetParam4113c(m, pSkill, 7)
  let nBaseVel = 0x100
  if (m.u32(pUnit >>> 0) === 0) {
    const pCharStats = CHARSTATS_GetRecordPtrFast_6FC210A0_113c(
      m,
      readI32(m, (pUnit + 0x04) >>> 0),
    ) >>> 0
    if (pCharStats !== 0) {
      nBaseVel = (m.u8((pCharStats + 0x41) >>> 0) << 8) | 0
    }
  } else {
    const nClassId = readI32(m, (pUnit + 0x04) >>> 0)
    const pMonStats = MONSTATS_GetRecordPtr113c(m, nClassId) >>> 0
    if (pMonStats !== 0) {
      nBaseVel = (readI16(m, (pMonStats + 0x34) >>> 0) << 8) | 0
      if (nClassId === 0xd3) {
        SKILLS_SetParam4113c(m, pSkill, 0x0f)
      }
      PATH_ClearPrevTargetCoord113c(m, pPath)
      PATH_SetNewDistance113c(m, pPath, 0x14)
    }
  }

  let nVelPct = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x43, 0) | 0
  if (nVelPct <= 0x32) {
    nVelPct = 0x32
  }
  const nParam1 = SKILLS_GetParam1Fast_6FC21B90_113c(m, skillId) | 0
  const nScaledVel = mulDiv113c((nParam1 + nVelPct) | 0, nBaseVel, 100) | 0
  PATH_SetVelocity113c(m, pPath, nScaledVel, 0x6fd1ba14, 0x330)
  PATH_Compute113c(m, pPath, pUnit >>> 0, 0)
  SKILLS_SetParam0C113c(m, pSkill, 0x1001)
  STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x12, 1)
  return 1
}

/**
 * Executes a Redemption-style aura pulse on `pUnit`: applies the caster's own aura stat buff
 * (`AURAS_ApplyRadialStatBuffCallback113c`), and when outside town, scans corpses in `dwAuraRangeCalc`
 * (`+0x64`) with `AURAS_RedemptionCorpseCallback_6FCB8680_113c` and toggles state `0x55` / consumes mana.
 *
 * @va D2Game:0x6FCBA400
 */
export function SKILLS_DoRedemptionAuraPulse_6FCBA400_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCBA400)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const wAuraState = readI16(m, (pSkillsTxt + 0x80) >>> 0)
  if (wAuraState < 0 || wAuraState >= readI32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }

  const lvl = nSkillLevel | 0
  const nManaCost = SKILLS_EvaluateManaCost256ths113c(m, skillId, lvl) | 0
  const nCurMana = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 8, 0) | 0
  const nNextTrigger =
    SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c(
      m,
      lvl,
      skillId,
      pSkillsTxt,
      pGame >>> 0,
      pUnit >>> 0,
    ) | 0
  const nDuration = (1 - readI32(m, (pGame + 0xa8) >>> 0) + nNextTrigger) | 0

  const sp = m.alloc(0x90) >>> 0
  const pAuraSpec = (sp + 0x40) >>> 0
  for (let z = 0; z < 0x50; z += 4) {
    m.setU32((pAuraSpec + z) >>> 0, 0)
  }
  writeI32(m, pAuraSpec, wAuraState)
  writeI32(m, (pAuraSpec + 0x04) >>> 0, skillId)
  writeI32(m, (pAuraSpec + 0x08) >>> 0, lvl)
  writeI32(m, (pAuraSpec + 0x0c) >>> 0, nDuration)

  for (let i = 0; i < 5; i += 1) {
    const nStatId = readI16(m, (pSkillsTxt + 0x98 + i * 2) >>> 0)
    writeI32(m, (pAuraSpec + 0x10 + i * 4) >>> 0, nStatId)
    if (nStatId >= 0) {
      if (pUnit === 0 || m.u32(pUnit >>> 0) !== 0 || nCurMana >= nManaCost) {
        const dwCalc = readI32(m, (pSkillsTxt + 0xa4 + i * 4) >>> 0)
        const nVal = SKILLS_EvalCalcByOffset113c(m, pUnit >>> 0, dwCalc, skillId, lvl) | 0
        writeI32(m, (pAuraSpec + 0x28 + i * 4) >>> 0, nVal)
      }
    }
  }

  const pAuraCtx = (sp + 0x30) >>> 0
  m.setU32(pAuraCtx, pGame >>> 0)
  m.setU32((pAuraCtx + 0x04) >>> 0, pUnit >>> 0)
  m.setU32((pAuraCtx + 0x08) >>> 0, 0)
  m.setU32((pAuraCtx + 0x0c) >>> 0, pAuraSpec)
  AURAS_ApplyRadialStatBuffCallback113c(m, pAuraCtx, pUnit >>> 0)

  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) === 0) {
    const pRedempCtx = (sp + 0x24) >>> 0
    writeI32(m, pRedempCtx, skillId)
    writeI32(m, (pRedempCtx + 0x04) >>> 0, lvl)
    writeI32(m, (pRedempCtx + 0x08) >>> 0, 0)
    const nRadius =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit >>> 0,
        readI32(m, (pSkillsTxt + 0x64) >>> 0),
        skillId,
        lvl,
      ) | 0
    const dwFilter = m.u32((pSkillsTxt + 0x50) >>> 0) >>> 0
    AURA_ForEachUnitInRadius113c(
      m,
      pGame >>> 0,
      pUnit >>> 0,
      0,
      0,
      nRadius,
      dwFilter,
      0x6fcb8680,
      pRedempCtx,
      1,
      AURAS_RedemptionCorpseCallback_6FCB8680_113c,
    )
    if (nManaCost > 0 && pUnit !== 0 && m.u32(pUnit >>> 0) === 0) {
      if (readI32(m, (pRedempCtx + 0x08) >>> 0) > 0) {
        STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x55, 1)
        SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c(m, pUnit >>> 0, nManaCost)
        return 1
      }
      STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x55, 0)
    }
  }
  return 1
}

/**
 * Checks whether `pUnit` (`eax`) can use a skill in `nMode` (`[esp+4]`), rejecting monster base class
 * `0x1EC` when state `0x8F` is active, and delegating to `MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c`.
 *
 * @va D2Game:0x6FCBF120
 */
export function SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nMode: number,
): number {
  hitD2GameVa113c(0x6FCBF120)
  if (pUnit !== 0 && m.u32(pUnit >>> 0) === 1) {
    let nClassId = readI32(m, (pUnit + 0x04) >>> 0)
    const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (nClassId >= 0 && pDataTables !== 0) {
      const nMonStatsCount = readI32(m, (pDataTables + 0xa80) >>> 0)
      if (nClassId < nMonStatsCount) {
        const pMonStats = (m.u32((pDataTables + 0xa78) >>> 0) + Math.imul(nClassId, 0x1a8)) >>> 0
        if (pMonStats !== 0) {
          nClassId = readI16(m, (pMonStats + 0x02) >>> 0)
        }
      }
      if (nClassId >= 0 && nClassId < readI32(m, (pDataTables + 0xa80) >>> 0) && nClassId === 0x1ec) {
        if (STATES_CheckState113c(m, pUnit >>> 0, 0x8f) !== 0) {
          return 0
        }
      }
    }
  }
  return MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c(m, pUnit >>> 0, nMode | 0) !== 0
    ? 1
    : 0
}

/**
 * Builds a `0x24`-byte `D2SkillSearchSpecStrc` on the stack from `(dwFlags, nX, pGame, nY, pOwnerUnit, nSkillId, nSkillLevel, pfnCallback)`
 * and dispatches `SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c`.
 *
 * @va D2Game:0x6FCBF340
 */
export function SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c(
  m: D2KernMemory113c,
  dwFlags: number,
  nX: number,
  pGame: number,
  nY: number,
  pOwnerUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  pfnCallback: number,
  hooks?: K2W4B6Hooks113c,
): void {
  hitD2GameVa113c(0x6FCBF340)
  const pSearchSpec = m.alloc(0x24) >>> 0
  m.setU32(pSearchSpec, dwFlags >>> 0)
  m.setU32((pSearchSpec + 0x04) >>> 0, pOwnerUnit >>> 0)
  writeI32(m, (pSearchSpec + 0x08) >>> 0, nSkillId | 0)
  writeI32(m, (pSearchSpec + 0x0c) >>> 0, nX | 0)
  writeI32(m, (pSearchSpec + 0x10) >>> 0, nY | 0)
  writeI32(m, (pSearchSpec + 0x18) >>> 0, nSkillLevel | 0)
  m.setU32((pSearchSpec + 0x20) >>> 0, pfnCallback >>> 0)
  SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c(m, pSearchSpec, pGame >>> 0, hooks)
}

/**
 * Validates that `pUnit` (`edx`, player) is targeting its own unsummonable pet monster (`bUnsummon` bit at `PetTypeTxt+0x04`)
 * and stores the pet's `dwUnitId` into the active skill's `Param1`.
 *
 * @va D2Game:0x6FCBFEF0
 */
export function SKILLS_DoUnsummonStart_6FCBFEF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCBFEF0)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) return 0
  if (m.u32(pTarget) !== 1 || m.u32(pUnit >>> 0) !== 0) return 0
  if ((AIGENERAL_GetPackLeaderUnit113c(m, pTarget) >>> 0) !== (pUnit >>> 0)) return 0

  const nPetType =
    PETS_FindPetTypeByGuid_6FCB6600_113c(m, pUnit >>> 0, m.u32((pTarget + 0x0c) >>> 0)) | 0
  const pPetTypeTxt = PETTYPE_GetRecordPtrFast_6FC21B60_113c(m, nPetType) >>> 0
  if (pPetTypeTxt === 0) return 0

  const pBitMasks = m.u32(GDW_BITMASKS_6FD18BE0) >>> 0
  if ((m.u8((pPetTypeTxt + 0x04) >>> 0) & m.u8((pBitMasks + 0x0c) >>> 0)) === 0) {
    return 0
  }

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pSkill === 0) return 0
  SKILLS_SetParam1113c(m, pSkill, m.u32((pTarget + 0x0c) >>> 0))
  return 1
}

/**
 * Spawns server projectile `nMissileId` from `pUnit` (`esi`) toward `(nX, nY)` (resolving target/path
 * coordinates via `SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c` when `(nX, nY) == (0, 0)`),
 * provided the distance does not exceed `100` (`0x64`) subtiles.
 *
 * @va D2Game:0x6FCC0000
 */
export function SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nSkillId: number,
  nSkillLevel: number,
  nMissileId: number,
  nX: number,
  nY: number,
): number {
  hitD2GameVa113c(0x6FCC0000)
  if (pUnit === 0) return 0
  let x = nX | 0
  let y = nY | 0
  if (x === 0 && y === 0) {
    const spCoord = m.alloc(8) >>> 0
    SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
      m,
      pUnit >>> 0,
      pGame >>> 0,
      spCoord,
      (spCoord + 4) >>> 0,
    )
    x = readI32(m, spCoord)
    y = readI32(m, (spCoord + 4) >>> 0)
    if (x === 0 && y === 0) return 0
  }

  const dist = UNITS_GetUnitDistanceToCoordinates113c(m, pUnit >>> 0, x, y) >>> 0
  if (dist > 0x64) return 0

  const pMissileParams = m.alloc(0x5c) >>> 0
  m.setU32(pMissileParams, 1)
  m.setU32((pMissileParams + 0x04) >>> 0, pUnit >>> 0)
  writeI32(m, (pMissileParams + 0x10) >>> 0, nMissileId | 0)
  writeI32(m, (pMissileParams + 0x14) >>> 0, x)
  writeI32(m, (pMissileParams + 0x18) >>> 0, y)
  writeI32(m, (pMissileParams + 0x2c) >>> 0, nSkillId | 0)
  writeI32(m, (pMissileParams + 0x30) >>> 0, nSkillLevel | 0)
  return MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pMissileParams) >>> 0
}

/**
 * Checks whether an object of class `nObjectId` (`eax`) can be spawned at `pUnit`'s target coordinates
 * in `pGame` by testing `COLLISION_CheckMaskWithSizeXY113c` with `bSizeX` (`ObjectsTxt+0x18A`) and mask `5`.
 *
 * @va D2Game:0x6FCC0630
 */
export function SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c(
  m: D2KernMemory113c,
  nObjectId: number,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCC0630)
  const objId = nObjectId | 0
  let pObjectsTxt = 0
  if (objId >= 0) {
    const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables !== 0 && objId < readI32(m, (pDataTables + 0xb6c) >>> 0)) {
      pObjectsTxt = (m.u32((pDataTables + 0xb64) >>> 0) + Math.imul(objId, 0x1a4)) >>> 0
    }
  }

  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (pObjectsTxt === 0 || pRoom === 0) return 0

  const spCoord = m.alloc(8) >>> 0
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
    m,
    pUnit >>> 0,
    pGame >>> 0,
    spCoord,
    (spCoord + 4) >>> 0,
  )
  const x = readI32(m, spCoord)
  const y = readI32(m, (spCoord + 4) >>> 0)
  if (x === 0 || y === 0) return 0

  const nSize = m.u8((pObjectsTxt + 0x18a) >>> 0)
  const hit = COLLISION_CheckMaskWithSizeXY113c(m, pRoom, x, y, nSize, nSize, 5) & 0xffff
  return hit === 0 ? 1 : 0
}

/**
 * Resolves `pUnit`'s target coordinates in `pGame`, initializes a `D2UnitFindDataStrc` of radius `dwSize`
 * (`eax`) with `dwFlags` at those coordinates, finds all matching units in adjacent rooms, and invokes `pfnCallback`.
 *
 * @va D2Game:0x6FCC06F0
 */
export function SKILLS_ForEachUnitNearTargetCoords_6FCC06F0_113c(
  m: D2KernMemory113c,
  dwSize: number,
  pGame: number,
  pUnit: number,
  dwFlags: number,
  pfnCallback:
    | number
    | ((
        m: D2KernMemory113c,
        pGame: number,
        pUnit: number,
        pFoundUnit: number,
        pCallbackArg: number,
      ) => void),
  pCallbackArg: number,
): void {
  hitD2GameVa113c(0x6FCC06F0)
  if (pfnCallback === 0) return
  const sp = m.alloc(0x70) >>> 0
  const pOutX = sp
  const pOutY = (sp + 0x04) >>> 0
  if (
    SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
      m,
      pUnit >>> 0,
      pGame >>> 0,
      pOutX,
      pOutY,
    ) === 0
  ) {
    return
  }

  const nX = readI32(m, pOutX)
  const nY = readI32(m, pOutY)
  const pUnitFindData = (sp + 0x08) >>> 0
  const pFilterArg = (sp + 0x34) >>> 0
  m.setU32(pFilterArg, dwFlags >>> 0)
  m.setU32((pFilterArg + 0x08) >>> 0, pUnit >>> 0)
  writeI32(m, (pFilterArg + 0x0c) >>> 0, nX)
  writeI32(m, (pFilterArg + 0x10) >>> 0, nY)
  writeI32(m, (pFilterArg + 0x14) >>> 0, dwSize | 0)

  const pStartRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  const pRoom = ROOM_FindRoomContainingSubtile113c(m, pStartRoom, nX, nY) >>> 0
  if (pRoom === 0) return

  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) >>> 0 : 0
  UNITFINDS_InitUnitFindData113c(
    m,
    pMemPool,
    pUnitFindData,
    pRoom,
    nX,
    nY,
    dwSize | 0,
    0,
    pFilterArg,
  )
  UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pUnitFindData)

  const nCount = readI32(m, (pUnitFindData + 0x18) >>> 0)
  const pArray = m.u32((pUnitFindData + 0x04) >>> 0) >>> 0
  for (let i = 0; i < nCount; i += 1) {
    const pFoundUnit = m.u32((pArray + i * 4) >>> 0) >>> 0
    if (typeof pfnCallback === 'function') {
      pfnCallback(m, pGame >>> 0, pUnit >>> 0, pFoundUnit, pCallbackArg >>> 0)
    }
  }
  UNITFINDS_FreeUnitFindData113c(m, pUnitFindData)
}

/**
 * Evaluates `SkillsTxt.dwDelay` (`+0x190`) for `(nSkillId, nSkillLevel)` on `pUnit`, and when positive,
 * applies skill delay state `121` (`0x79`) via `SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c`.
 *
 * @va D2Game:0x6FCC09A0
 */
export function SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nSkillId: number,
  pGame: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FCC09A0)
  const skillId = nSkillId | 0
  if (skillId < 0) return
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return
  if (skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return

  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return

  const nDelay =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      readI32(m, (pSkillsTxt + 0x190) >>> 0),
      skillId,
      nSkillLevel | 0,
    ) | 0
  if (nDelay > 0) {
    SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c(m, nDelay, pUnit >>> 0, pGame >>> 0)
  }
}

/**
 * Resolves `pUnit`'s target coordinates in `pGame`, scans all adjacent rooms intersecting the circle
 * of `nRadius`, filters candidate units via `AURA_CheckUnitMatchesFilterFlags113c`, and invokes `pfnCallback`.
 *
 * @va D2Game:0x6FCC0AD0
 */
export function AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwFilterFlags: number,
  pUnit: number,
  nRadius: number,
  pfnCallback:
    | number
    | ((m: D2KernMemory113c, pTargetUnit: number, pCallbackArg: number) => void),
  pCallbackArg: number,
): number {
  hitD2GameVa113c(0x6FCC0AD0)
  if (pfnCallback === 0) return 0
  const sp = m.alloc(0x18) >>> 0
  const pOutX = sp
  const pOutY = (sp + 0x04) >>> 0
  if (
    SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
      m,
      pUnit >>> 0,
      pGame >>> 0,
      pOutX,
      pOutY,
    ) === 0
  ) {
    return 0
  }

  const nX = readI32(m, pOutX)
  const nY = readI32(m, pOutY)
  const pStartRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  const pRoom = ROOM_FindRoomContainingSubtile113c(m, pStartRoom, nX, nY) >>> 0
  if (pRoom === 0) return 0

  const radius = nRadius | 0
  const nRadiusSq = Math.imul(radius, radius) | 0
  const pppRoomsNear = (sp + 0x08) >>> 0
  const pnRoomsNear = (sp + 0x0c) >>> 0
  DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, pppRoomsNear, pnRoomsNear)

  const nRoomsNear = readI32(m, pnRoomsNear)
  const ppRoomsNear = m.u32(pppRoomsNear) >>> 0
  const bSkipTown = (dwFilterFlags & 0x2000) !== 0

  for (let i = 0; i < nRoomsNear; i += 1) {
    const pAdjRoom = m.u32((ppRoomsNear + i * 4) >>> 0) >>> 0
    if (bSkipTown && DUNGEON_CheckRoomIsTownMemPort113c(m, pAdjRoom) !== 0) {
      continue
    }
    if (AURA_CheckCircleIntersectsRoom113c(m, nY, pAdjRoom, nX, radius) === 0) {
      continue
    }
    let pCand = m.u32((pAdjRoom + 0x74) >>> 0) >>> 0
    while (pCand !== 0) {
      const dwTypeY = m.u32(pCand) | 0
      const pPathY = m.u32((pCand + 0x2c) >>> 0) >>> 0
      const candY =
        dwTypeY === 2 || (dwTypeY > 3 && dwTypeY <= 5)
          ? readI32(m, (pPathY + 0x10) >>> 0)
          : pPathY !== 0
            ? PATH_GetPosY113c(m, pPathY) | 0
            : 0
      const dwTypeX = m.u32(pCand) | 0
      const pPathX = m.u32((pCand + 0x2c) >>> 0) >>> 0
      const candX =
        dwTypeX === 2 || (dwTypeX > 3 && dwTypeX <= 5)
          ? readI32(m, (pPathX + 0x0c) >>> 0)
          : pPathX !== 0
            ? PATH_GetPosX113c(m, pPathX) | 0
            : 0
      const distSq = PATH_ComputeSquaredDistance113c(nX, nY, candX, candY) | 0
      if (nRadiusSq >= distSq) {
        if (AURA_CheckUnitMatchesFilterFlags113c(m, dwFilterFlags >>> 0, pUnit >>> 0, pCand) !== 0) {
          if (typeof pfnCallback === 'function') {
            pfnCallback(m, pCand, pCallbackArg >>> 0)
          }
        }
      }
      pCand = m.u32((pCand + 0xe8) >>> 0) >>> 0
    }
  }
  return 1
}

/**
 * Finds the closest unit to `pCenterUnit` (`esi`) within `nRadius` in `pGame` matching filter flags `0x8783`
 * and optional `pfnFilter` by scanning with `AURA_ForEachUnitInRadius113c` and `SKILLS_FindClosestUnitCallback_6FCBEDB0_113c`.
 *
 * @va D2Game:0x6FCC1000
 */
export function AURA_FindClosestUnitInRadius_6FCC1000_113c(
  m: D2KernMemory113c,
  pCenterUnit: number,
  pGame: number,
  nRadius: number,
  pfnFilter: number,
  hooks?: K2W4B6Hooks113c,
): number {
  hitD2GameVa113c(0x6FCC1000)
  const pClosestCtx = m.alloc(0x14) >>> 0
  m.setU32(pClosestCtx, 0)
  writeI32(m, (pClosestCtx + 0x04) >>> 0, 0x7fffffff)

  const dwTypeX = m.u32(pCenterUnit >>> 0) | 0
  const pPathX = m.u32((pCenterUnit + 0x2c) >>> 0) >>> 0
  const centerX =
    dwTypeX === 2 || (dwTypeX > 3 && dwTypeX <= 5)
      ? readI32(m, (pPathX + 0x0c) >>> 0)
      : pPathX !== 0
        ? PATH_GetPosX113c(m, pPathX) | 0
        : 0
  writeI32(m, (pClosestCtx + 0x08) >>> 0, centerX)

  const dwTypeY = m.u32(pCenterUnit >>> 0) | 0
  const pPathY = m.u32((pCenterUnit + 0x2c) >>> 0) >>> 0
  const centerY =
    dwTypeY === 2 || (dwTypeY > 3 && dwTypeY <= 5)
      ? readI32(m, (pPathY + 0x10) >>> 0)
      : pPathY !== 0
        ? PATH_GetPosY113c(m, pPathY) | 0
        : 0
  writeI32(m, (pClosestCtx + 0x0c) >>> 0, centerY)
  m.setU32((pClosestCtx + 0x10) >>> 0, pfnFilter >>> 0)

  AURA_ForEachUnitInRadius113c(
    m,
    pGame >>> 0,
    pCenterUnit >>> 0,
    0,
    0,
    nRadius | 0,
    0x8783,
    0x6fcbedb0,
    pClosestCtx,
    0,
    (mArg, pAuraCtx, pCand) =>
      SKILLS_FindClosestUnitCallback_6FCBEDB0_113c(mArg, pAuraCtx, pCand, hooks),
  )
  return m.u32(pClosestCtx) >>> 0
}

let k2W5B3StackPtr = 0x7ea00000

/**
 * Radial aura callback (`ecx = pAuraCtx`, `edx = pTargetUnit`) that copies the `0x70`-byte `D2DamageStrc`
 * at `pAuraCtx+0x0C` onto the stack and applies it via `SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c`.
 *
 * @va D2Game:0x6FCC1210
 */
export function AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pTargetUnit: number,
  combatHooks?: SUnitDmgHooks113c,
): number {
  hitD2GameVa113c(0x6FCC1210)
  const pDmgSrc = m.u32((pAuraCtx + 0x0c) >>> 0) >>> 0
  const sp = k2W5B3StackPtr
  k2W5B3StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmgCopy = sp
    for (let i = 0; i < 0x1c; i += 1) {
      m.setU32((pDmgCopy + i * 4) >>> 0, m.u32((pDmgSrc + i * 4) >>> 0))
    }
    const pGame = m.u32(pAuraCtx >>> 0) >>> 0
    const pAttacker = m.u32((pAuraCtx + 0x04) >>> 0) >>> 0
    SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c(
      m,
      pAttacker,
      pDmgCopy,
      pGame,
      pTargetUnit >>> 0,
      combatHooks,
    )
    return 1
  } finally {
    k2W5B3StackPtr = sp
  }
}

/**
 * Checks whether player `pUnit` (`edx`) has sufficient weapon or quiver quantity via
 * `SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c`; if not, schedules cast frame events and starts cast mode.
 *
 * @va D2Game:0x6FCC1600
 */
export function SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCC1600)
  if (SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c(m, pUnit >>> 0) !== 0) {
    return 1
  }
  PLAYER_ScheduleSkillActionFrameEvents113c(m, pGame >>> 0, pUnit >>> 0)
  PLAYER_StartModeCast113c(m, pGame >>> 0, pUnit >>> 0, 0, '1HS', true)
  return 0
}

/**
 * Consumes 1 quantity (and syncs durability) from a player's equipped throwable weapon or bow/crossbow quiver
 * across body locations `4` and `5` via `SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c`.
 *
 * @va D2Game:0x6FCC1790
 */
export function SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCC1790)
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 0) return 0
  const pWeapon = PLAYER_GetEquippedWeapon113c(m, pUnit >>> 0) >>> 0
  let bMustMatchWeapon = 1
  if (
    ITEMS_CheckItemTypeIdMemPort113c(m, pWeapon, 0x1b) !== 0 ||
    ITEMS_CheckItemTypeIdMemPort113c(m, pWeapon, 0x23) !== 0
  ) {
    bMustMatchWeapon = 0
  }

  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  const pItem4 = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, 4) >>> 0
  if (pItem4 !== 0 && (bMustMatchWeapon === 0 || pItem4 === pWeapon)) {
    if (
      ITEMS_CheckIfThrowItemMemPort113c(m, pItem4) !== 0 ||
      ITEMS_GetTwoHandedFlag113c(m, pItem4) !== 0 ||
      STATLIST_GetUnitStatWithLayer113c(m, pItem4, 0x7d, 0) !== 0
    ) {
      return SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c(
        m,
        pItem4,
        pGame >>> 0,
        pUnit >>> 0,
      )
    }
  }

  const pItem5 = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, 5) >>> 0
  if (pItem5 !== 0 && (bMustMatchWeapon === 0 || pItem5 === pWeapon)) {
    if (
      ITEMS_CheckIfThrowItemMemPort113c(m, pItem5) !== 0 ||
      ITEMS_GetTwoHandedFlag113c(m, pItem5) !== 0 ||
      STATLIST_GetUnitStatWithLayer113c(m, pItem5, 0x7d, 0) !== 0
    ) {
      return SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c(
        m,
        pItem5,
        pGame >>> 0,
        pUnit >>> 0,
      )
    }
  }
  return 0
}

/**
 * Handles periodic item-aura timer event `9` on `pUnit`: if `pUnit` is alive and still has positive
 * `STAT_ITEM_AURA` (`0x97`, layer `nSkillId`), executes the skill's `DoFunc` and reschedules event `9`;
 * otherwise deletes event `9` for `nEventArg`.
 *
 * @va D2Game:0x6FCC37D0
 */
export function SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nEventArg: number,
  nSkillId: number,
): void {
  hitD2GameVa113c(0x6FCC37D0)
  const skillId = nSkillId | 0
  if (skillId >= 0) {
    const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables !== 0 && skillId < readI32(m, (pDataTables + 0xba0) >>> 0)) {
      const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
      if (pSkillsTxt !== 0) {
        const wAuraState = readI16(m, (pSkillsTxt + 0x80) >>> 0)
        if (wAuraState >= 0 && wAuraState < readI32(m, (pDataTables + 0xc4) >>> 0)) {
          if (SUNIT_IsDeadOrDying113c(m, pUnit >>> 0) === 0) {
            const nAuraLevel = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x97, skillId) | 0
            if (nAuraLevel > 0) {
              SKILLS_ExecuteSkillDoFunc113c(
                m,
                pUnit >>> 0,
                pGame >>> 0,
                skillId,
                nAuraLevel,
                1,
                1,
                0,
              )
              SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c(
                m,
                skillId,
                nEventArg | 0,
                pGame >>> 0,
                pUnit >>> 0,
                nAuraLevel,
                0,
              )
              return
            }
          }
        }
      }
    }
  }
  EVENT_DeleteEventByArg14_113c(m, pGame >>> 0, pUnit >>> 0, 9, nEventArg | 0)
}

/**
 * Checks whether `pTargetUnit` (`edx`) is eligible to be targeted by summon skill `nSkillId` (`ecx`)
 * cast by `pCasterUnit` (`eax`), rejecting units whose class matches `wSumMon` (`SkillsTxt+0xBC`) or
 * pets already belonging to `pCasterUnit` with `bPetType` (`SkillsTxt+0xBE`).
 *
 * @va D2Game:0x6FCC3D60
 */
export function SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c(
  m: D2KernMemory113c,
  pCasterUnit: number,
  nSkillId: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FCC3D60)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const wSumMon = readI16(m, (pSkillsTxt + 0xbc) >>> 0)
  if (wSumMon === 0) return 1

  const dwTargetClassId =
    pTargetUnit !== 0 ? m.u16((pTargetUnit + 0x04) >>> 0) : 0xffff
  if (wSumMon === dwTargetClassId) return 0

  const nPetType = readI8(m, (pSkillsTxt + 0xbe) >>> 0)
  if (nPetType < 0 || nPetType >= readI32(m, (pDataTables + 0xbf0) >>> 0) || pCasterUnit === 0) {
    return 1
  }

  const dwPetGuid =
    pTargetUnit !== 0 ? m.u32((pTargetUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const nFoundType = PETS_FindPetTypeByGuid_6FCB6600_113c(m, pCasterUnit >>> 0, dwPetGuid) | 0
  return nFoundType !== nPetType ? 1 : 0
}

/**
 * Monster AI step (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiTickArgs`) that checks reverse-velocity
 * corpse presence (`SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c`), enforces `wAiParam2`
 * cooldown, rolls `wAiParam1` chance, picks a random skill from `0x6FD1B69C[0..4]` around `pTarget`,
 * and casts it in mode `4` via `AI_CastSkillWithMode113c`.
 *
 * @va D2Game:0x6FCC4FD0
 */
export function AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
  hooks?: K2W4B6Hooks113c,
): void {
  hitD2GameVa113c(0x6FCC4FD0)
  void seedRoll
  const pMonStats = m.u32((pAiTickArgs + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((pAiTickArgs + 0x08) >>> 0) >>> 0
  const pAiControl = m.u32(pAiTickArgs >>> 0) >>> 0
  const pSeed = (pUnit + 0x20) >>> 0

  let bTryDeadCheck = true
  if (readI32(m, (pAiControl + 0x1c) >>> 0) !== 0) {
    const prod =
      BigInt(m.u32(pSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
    const lo = Number(prod & 0xffffffffn) >>> 0
    const hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pSeed + 0x04) >>> 0, hi)
    m.setU32(pSeed, lo)
    if ((lo % 100) >= 3) {
      bTryDeadCheck = false
    }
  }

  if (bTryDeadCheck) {
    if (
      SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c(
        m,
        pGame >>> 0,
        pUnit >>> 0,
        hooks,
      ) !== 0
    ) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 0, pTarget, 0, 0)
      return
    }
  }

  if (readI32(m, (pAiControl + 0x1c) >>> 0) === 0) {
    writeI32(m, (pAiControl + 0x1c) >>> 0, 1)
  }

  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const nAiParam2 = readI16(m, (pMonStats + bDiff * 2 + 0x5c) >>> 0)
  const nCooldownRem =
    (nAiParam2 - readI32(m, (pGame + 0xa8) >>> 0) + readI32(m, (pAiControl + 0x1c) >>> 0)) | 0
  if (nCooldownRem > 0) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, nAiParam2)
    return
  }

  if (pTarget === 0) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, nAiParam2)
    return
  }

  const prod2 =
    BigInt(m.u32(pSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
  const lo2 = Number(prod2 & 0xffffffffn) >>> 0
  const hi2 = Number((prod2 >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 0x04) >>> 0, hi2)
  m.setU32(pSeed, lo2)
  const bDiff2 = m.u8((pGame + 0x6d) >>> 0)
  const nAiParam1 = readI16(m, (pMonStats + bDiff2 * 2 + 0x56) >>> 0)
  if ((lo2 % 100) >= nAiParam1) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, readI16(m, (pMonStats + bDiff2 * 2 + 0x5c) >>> 0))
    return
  }

  let nCountRem = readI32(m, (pAiControl + 0x18) >>> 0)
  let nSkillIdx: number
  if (nCountRem <= 0) {
    nSkillIdx = rollSeedLimited6FC21180(m, pSeed, 5) | 0
    writeI32(m, (pAiControl + 0x14) >>> 0, nSkillIdx)
    nCountRem = readI16(m, (pMonStats + m.u8((pGame + 0x6d) >>> 0) * 2 + 0x6e) >>> 0)
  } else {
    nSkillIdx = readI32(m, (pAiControl + 0x14) >>> 0)
    nCountRem = (nCountRem - 1) | 0
  }
  writeI32(m, (pAiControl + 0x18) >>> 0, nCountRem)

  const wSpreadX = readI16(m, (pMonStats + m.u8((pGame + 0x6d) >>> 0) * 2 + 0x68) >>> 0)
  const rollX = (rollSeedLimited6FC21180(m, pSeed, wSpreadX << 1) - wSpreadX) | 0
  const targetX = (UNIT_GetPosX113c(m, pTarget) + rollX) | 0

  const wSpreadY = readI16(m, (pMonStats + m.u8((pGame + 0x6d) >>> 0) * 2 + 0x68) >>> 0)
  const rollY = (rollSeedLimited6FC21180(m, pSeed, wSpreadY << 1) - wSpreadY) | 0
  const targetY = (UNIT_GetPosY113c(m, pTarget) + rollY) | 0

  const spCoord = m.alloc(8) >>> 0
  writeI32(m, spCoord, targetX)
  writeI32(m, (spCoord + 4) >>> 0, targetY)
  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (COLLISION_FindFreePositionWithStep113c(m, pRoom, spCoord, 2, 0x805, 3) !== 0) {
    const nMemSkill = readI32(m, (0x6fd1b69c + nSkillIdx * 4) >>> 0)
    const nSkillId =
      nMemSkill !== 0 ? nMemSkill : nSkillIdx >= 0 && nSkillIdx < 5 ? CATAPULT_SKILLS_6FD1B69C[nSkillIdx]! : 0
    AI_CastSkillWithMode113c(
      m,
      4,
      pUnit >>> 0,
      pGame >>> 0,
      nSkillId,
      0,
      readI32(m, spCoord),
      readI32(m, (spCoord + 4) >>> 0),
    )
    m.setU32((pAiControl + 0x1c) >>> 0, m.u32((pGame + 0xa8) >>> 0))
    return
  }
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0f)
}

/**
 * Room-scan target callback (`ecx = pGame`, `edx = pOriginUnit`, `[esp+4] = pCandidateUnit`, `[esp+8] = pScanCtx`):
 * counts aligned monsters of base IDs `410..413, 415..416` (`0x19A..0x1A0` except `0x19E`) at `pScanCtx+0x20`,
 * and tracks closest hostile target / nearby counts relative to `pScanCtx+0x00` and `pOriginUnit`.
 *
 * @va D2Game:0x6FCC5230
 */
export function AI_ScanRoomTargetAndCountAlliesCallback_6FCC5230_113c(
  m: D2KernMemory113c,
  pGame: number,
  pOriginUnit: number,
  pCandidateUnit: number,
  pScanCtx: number,
): number {
  hitD2GameVa113c(0x6FCC5230)
  if ((pOriginUnit >>> 0) === (pCandidateUnit >>> 0)) return 0
  if (SUNIT_IsDeadOrDying113c(m, pCandidateUnit >>> 0) !== 0) return 0
  if (pCandidateUnit === 0) return 0

  if (m.u32(pCandidateUnit >>> 0) === 1) {
    if (UNITS_AreUnitsAligned113c(m, pOriginUnit >>> 0, pCandidateUnit >>> 0) !== 0) {
      let nBaseId = MONSTER_GetBaseIdFromUnit113c(m, pCandidateUnit >>> 0) | 0
      const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
      const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
      if (nBaseId < 0 || pDataTables === 0 || nBaseId >= readI32(m, (pDataTables + 0xa80) >>> 0)) {
        nBaseId = -1
      }
      const nRel = (nBaseId - 0x19a) >>> 0
      if (nRel <= 6 && nRel !== 4) {
        writeI32(m, (pScanCtx + 0x20) >>> 0, (readI32(m, (pScanCtx + 0x20) >>> 0) + 1) | 0)
        return 0
      }
    }
  }

  if (((m.u32((pCandidateUnit + 0xc4) >>> 0) >>> 2) & 1) === 0) return 0
  if (
    SUNIT_AreUnitsHostileOrUnaligned113c(
      m,
      pCandidateUnit >>> 0,
      pOriginUnit >>> 0,
      pGame >>> 0,
    ) === 0
  ) {
    return 0
  }

  const pRefUnit = m.u32(pScanCtx >>> 0) >>> 0
  if (pRefUnit !== 0) {
    const distRef = UNIT_CalcSqDistSubtiles113c(m, pRefUnit, pCandidateUnit >>> 0) | 0
    if (distRef <= 0x64) {
      writeI32(m, (pScanCtx + 0x18) >>> 0, (readI32(m, (pScanCtx + 0x18) >>> 0) + 1) | 0)
    }
    if (distRef < readI32(m, (pScanCtx + 0x14) >>> 0)) {
      m.setU32((pScanCtx + 0x10) >>> 0, pCandidateUnit >>> 0)
      writeI32(m, (pScanCtx + 0x14) >>> 0, distRef)
    }
  }

  const distOrigin = UNIT_CalcSqDistSubtiles113c(m, pOriginUnit >>> 0, pCandidateUnit >>> 0) | 0
  if (distOrigin <= 0x400) {
    writeI32(m, (pScanCtx + 0x1c) >>> 0, (readI32(m, (pScanCtx + 0x1c) >>> 0) + 1) | 0)
    if (distOrigin <= 0x64) {
      writeI32(m, (pScanCtx + 0x0c) >>> 0, (readI32(m, (pScanCtx + 0x0c) >>> 0) + 1) | 0)
    }
    if (distOrigin < readI32(m, (pScanCtx + 0x08) >>> 0)) {
      m.setU32((pScanCtx + 0x04) >>> 0, pCandidateUnit >>> 0)
      writeI32(m, (pScanCtx + 0x08) >>> 0, distOrigin)
    }
    if (
      SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c(
        m,
        pCandidateUnit >>> 0,
        pOriginUnit >>> 0,
      ) !== 0
    ) {
      m.setU32((pScanCtx + 0x24) >>> 0, pCandidateUnit >>> 0)
    }
  }
  return 0
}

/**
 * Dispatches item `nSpellIcon` handlers from `0x6FD27238` (`[ebx*8]` pre-check and `[ebx*8+4]` effect)
 * for `pItem` (`esi`) used by `pOwnerUnit` (`edi`), syncing inventory command flag `4` (`0x3F`) and
 * queueing packet `0x7C` on failure/cancel.
 *
 * @va D2Game:0x6FCCD0F0
 */
export function ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c(
  m: D2KernMemory113c,
  pOwnerUnit: number,
  pItem: number,
  pGame: number,
  pTargetUnit: number,
  nX: number,
  nY: number,
  onSpellHandler?: (
    m: D2KernMemory113c,
    pHandlerFn: number,
    pGame: number,
    pOwnerUnit: number,
    pItem: number,
    pTargetUnit: number,
    nX: number,
    nY: number,
    nSpellParam: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCCD0F0)
  if (pOwnerUnit === 0) return 0
  const dwOwnerType = m.u32(pOwnerUnit >>> 0)
  if (dwOwnerType !== 0 && dwOwnerType !== 1) return 0
  if (pItem === 0 || m.u32(pItem >>> 0) !== 4) return 0

  let nSpellParam = -1
  let nSpellIcon = -1
  if (
    ITEMS_CheckItemTypeIdMemPort113c(m, pItem >>> 0, 0x12) !== 0 ||
    ITEMS_CheckItemTypeIdMemPort113c(m, pItem >>> 0, 0x16) !== 0
  ) {
    const wSuffix = ITEMS_GetMagicSuffix113c(m, pItem >>> 0, 0) & 0xffff
    const pQualTxt = DATATBLS_GetQualityItemsTxtRecord113c(m, wSuffix) >>> 0
    if (pQualTxt !== 0) {
      nSpellIcon = readI32(m, (pQualTxt + 0x04) >>> 0)
      nSpellParam = readI32(m, (pQualTxt + 0x0c) >>> 0)
    }
  }
  if (nSpellIcon <= 0) {
    const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(
      m,
      readI32(m, (pItem + 0x04) >>> 0),
    ) >>> 0
    if (pItemsTxt !== 0) {
      nSpellIcon = readI32(m, (pItemsTxt + 0x94) >>> 0)
    }
  }
  if (nSpellIcon <= 0 || nSpellIcon >= readI32(m, 0x6fd27330)) {
    return 0
  }

  const pEntry = (0x6fd27238 + nSpellIcon * 8) >>> 0
  const pfnPhase1 = m.u32(pEntry) >>> 0
  if (
    pfnPhase1 !== 0 &&
    ITEMS_CheckCommandFlags113c(m, pItem >>> 0, 4, 0x46b, 0x6fd1b660) === 0
  ) {
    const res1 =
      onSpellHandler !== undefined
        ? onSpellHandler(
            m,
            pfnPhase1,
            pGame >>> 0,
            pOwnerUnit >>> 0,
            pItem >>> 0,
            0,
            nX | 0,
            nY | 0,
            nSpellParam,
          ) | 0
        : 0
    if (res1 === 0) {
      ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c(m, pOwnerUnit >>> 0)
      const dwItemGuid = m.u32((pItem + 0x0c) >>> 0) >>> 0
      const bItemType = m.u8(pItem >>> 0)
      const pClient =
        m.u32(pOwnerUnit >>> 0) === 0
          ? m.u32((UNITS_GetPlayerData113c(m, pOwnerUnit >>> 0) + 0x9c) >>> 0) >>> 0
          : 0
      S2C_QueueByteDwordPacket6_6FCAC3B0_113c(m, 0x7c, bItemType, dwItemGuid, pClient)
    }
    return 0
  }

  const pfnPhase2 = m.u32((pEntry + 0x04) >>> 0) >>> 0
  if (pfnPhase2 === 0) return 0

  ITEMS_SetOrClearCommandFlags113c(m, pItem >>> 0, 4, 1)
  const nRet =
    onSpellHandler !== undefined
      ? onSpellHandler(
          m,
          pfnPhase2,
          pGame >>> 0,
          pOwnerUnit >>> 0,
          pItem >>> 0,
          pTargetUnit >>> 0,
          nX | 0,
          nY | 0,
          nSpellParam,
        ) | 0
      : 0
  if (nRet === 0) {
    ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c(m, pOwnerUnit >>> 0)
    const dwItemGuid = m.u32((pItem + 0x0c) >>> 0) >>> 0
    const bItemType = m.u8(pItem >>> 0)
    const pClient =
      m.u32(pOwnerUnit >>> 0) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pOwnerUnit >>> 0) + 0x9c) >>> 0) >>> 0
        : 0
    S2C_QueueByteDwordPacket6_6FCAC3B0_113c(m, 0x7c, bItemType, dwItemGuid, pClient)
  }
  return nRet
}

/**
 * Rolls Open Wounds proc chance on `pAttacker` (`STATLIST_GetUnitStatWithLayer113c` with `dwStatAndLayer`),
 * evaluates the 5-tier piecewise linear bleed rate `[9, 18, 27, 36, 45] + 40` from attacker level (scaled
 * `/4` vs players, `/2` on event `6` or vs boss/unique monsters), and applies state `0x3E` (`STATE_OPENWOUNDS`)
 * with negative `STAT_HPREGEN` (`0x4A`) for `200` frames via `STATES_CreateOrUpdateAuraStatList113c`.
 *
 * @va D2Game:0x6FCCD410
 */
export function SUNITDMG_ProcHitOpenWounds_6FCCD410_113c(
  m: D2KernMemory113c,
  _pGame: number,
  nDamageEventId: number,
  pAttacker: number,
  pDefender: number,
  _nArg2: number,
  dwStatAndLayer: number,
  _nArg4 = 0,
): number {
  hitD2GameVa113c(0x6FCCD410)
  if (pAttacker === 0 || pDefender === 0) return 0
  const nChance =
    STATLIST_GetUnitStatWithLayer113c(
      m,
      pAttacker >>> 0,
      (dwStatAndLayer >>> 16) & 0xffff,
      dwStatAndLayer,
    ) | 0
  if (nChance <= 0) return 0

  const pSeed = (pAttacker + 0x20) >>> 0
  const prod =
    BigInt(m.u32(pSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
  const lo = Number(prod & 0xffffffffn) >>> 0
  const hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 0x04) >>> 0, hi)
  m.setU32(pSeed, lo)
  if ((lo % 100) >= nChance) return 0

  let nLvl = STATLIST_GetUnitStat113c(m, pAttacker >>> 0, 0x0c, 0) | 0
  if (nLvl <= 1) {
    nLvl = 1
  }

  const sp = m.alloc(0x28) >>> 0
  writeI32(m, sp, 0x09)
  writeI32(m, (sp + 0x04) >>> 0, 0x12)
  writeI32(m, (sp + 0x08) >>> 0, 0x1b)
  writeI32(m, (sp + 0x0c) >>> 0, 0x24)
  writeI32(m, (sp + 0x10) >>> 0, 0x2d)
  let nVal = (MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c(m, sp, nLvl) + 0x28) | 0

  const dwDefType = m.u32(pDefender >>> 0)
  if (dwDefType === 0) {
    nVal = Math.trunc(nVal / 4) | 0
    if ((nDamageEventId | 0) === 6) {
      nVal = Math.trunc(nVal / 2) | 0
    }
  } else if (dwDefType === 1) {
    if (MONSTER_CheckTypeFlagsMask113c(m, pDefender >>> 0, 0x0c) !== 0) {
      nVal = Math.trunc(nVal / 2) | 0
    }
  }

  for (let i = 0; i < 9; i += 1) {
    m.setU32((sp + i * 4) >>> 0, 0)
  }
  m.setU32(sp, pAttacker >>> 0)
  m.setU32((sp + 0x04) >>> 0, pDefender >>> 0)
  writeI32(m, (sp + 0x08) >>> 0, 0)
  writeI32(m, (sp + 0x0c) >>> 0, 1)
  writeI32(m, (sp + 0x10) >>> 0, 0xc8)
  writeI32(m, (sp + 0x14) >>> 0, 0x4a)
  writeI32(m, (sp + 0x18) >>> 0, (-nVal) | 0)
  writeI32(m, (sp + 0x1c) >>> 0, 0x3e)
  m.setU32((sp + 0x20) >>> 0, 0)
  STATES_CreateOrUpdateAuraStatList113c(m, sp)
  return 1
}

/**
 * Applies a timed state-buff potion item (`pItem`, e.g., Stamina/Antidote/Thawing potion) to `pUnit`,
 * stacking remaining expire frames with `ItemsTxt.dwLen` (`+0xB0`), applying the 3 `cStateStat` calcs
 * (`+0x9E` / `+0xA4`), and refilling stamina when stat `0x1C` (`STAT_STAMINARECOVERYBONUS`) is positive.
 *
 * @va D2Game:0x6FCCE4D0
 */
export function ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pItem: number,
  _pTargetUnit = 0,
  _nX = 0,
  _nY = 0,
  _nSpellParam = 0,
): number {
  hitD2GameVa113c(0x6FCCE4D0)
  void STATES_OnTimedStateRemoved113c
  const nItemClassId = pItem !== 0 ? readI32(m, (pItem + 0x04) >>> 0) : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemClassId) >>> 0
  if (pItemsTxt === 0) return 0

  const wState = readI16(m, (pItemsTxt + 0x98) >>> 0)
  if (wState <= 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || wState >= readI32(m, (pDataTables + 0xc4) >>> 0)) {
    return 0
  }

  const nLen =
    ITEMS_EvalItemCalc113c(
      m,
      pUnit >>> 0,
      pItem >>> 0,
      readI32(m, (pItemsTxt + 0xb0) >>> 0),
    ) | 0
  if (nLen <= 0) return 0

  STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c(m, pUnit >>> 0, wState, 0)
  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, wState) >>> 0
  let nRemFrames = 0
  if (pStatList !== 0) {
    nRemFrames = (STATLIST_GetExpireFrameEx113c(m, pStatList) - readI32(m, (pGame + 0xa8) >>> 0)) | 0
  }
  const nNewExpireFrame = (readI32(m, (pGame + 0xa8) >>> 0) + nRemFrames + nLen) | 0

  if (pStatList === 0) {
    const nOwnerType = pUnit !== 0 ? m.u32(pUnit >>> 0) : 6
    const nOwnerId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : -1
    pStatList = STATLIST_AllocList113c(m, 2, nOwnerType, nOwnerId, 0, 0) >>> 0
    if (pStatList === 0) return 0
    STATLIST_SetState113c(m, pStatList, wState)
    STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, wState, 1)
    STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0)
    STATLIST_MergeStatLists113c(m, pUnit >>> 0, pStatList, 1)
  }

  if (nNewExpireFrame !== 0) {
    STATLIST_SetExpireFrameEx113c(m, pStatList, nNewExpireFrame)
    EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0x0c, nNewExpireFrame, 0, 0, 0)
  }

  for (let i = 0; i < 3; i += 1) {
    const nStatId = readI16(m, (pItemsTxt + 0x9e + i * 2) >>> 0)
    if (nStatId >= 0) {
      const pDtPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
      const pDt = pDtPtr !== 0 ? m.u32(pDtPtr) >>> 0 : 0
      if (
        pDt !== 0 &&
        nStatId < readI32(m, (pDt + 0xbd4) >>> 0) &&
        DATATBLS_GetItemStatCostRecordFast113c(m, nStatId) !== 0
      ) {
        const dwCalc = readI32(m, (pItemsTxt + 0xa4 + i * 4) >>> 0)
        const nVal = ITEMS_EvalItemCalc113c(m, pUnit >>> 0, pItem >>> 0, dwCalc) | 0
        if (nVal !== 0) {
          STATLIST_SetStat113c(m, pStatList, nStatId, nVal, 0)
          if (nStatId === 0x1c && nVal > 0) {
            const nMaxStam = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0b, 0) | 0
            const nCurStam = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0a, 0) | 0
            if (nCurStam < nMaxStam) {
              STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x0a, (nMaxStam + 0x100) | 0, 0)
            }
          }
        }
      }
    }
  }
  return 1
}

/**
 * Rolls Hit-Causes-Monster-Flee / Taunt proc chance on `pAttacker` (`0..127` mask roll via `SEED_RollMaskFast113c`
 * against `STATLIST_GetUnitStatWithLayer113c`), and applies `MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c`
 * with duration `0x14` to normal monsters (`(bMonTypeFlags & 0x0C) == 0`).
 *
 * @va D2Game:0x6FCCF2E0
 */
export function SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  _nDamageEventId: number,
  pAttacker: number,
  pDefender: number,
  _nArg2: number,
  dwStatAndLayer: number,
  _nArg4 = 0,
): number {
  hitD2GameVa113c(0x6FCCF2E0)
  if (pAttacker === 0 || pDefender === 0) return 0
  if (m.u32(pDefender >>> 0) !== 1) return 0
  const pMonData = m.u32((pDefender + 0x14) >>> 0) >>> 0
  if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 0x0c) !== 0) {
    return 0
  }

  const nChance =
    STATLIST_GetUnitStatWithLayer113c(
      m,
      pAttacker >>> 0,
      (dwStatAndLayer >>> 16) & 0xffff,
      dwStatAndLayer,
    ) | 0
  if (nChance <= 0) return 0

  const nRoll = SEED_RollMaskFast113c(m, (pAttacker + 0x20) >>> 0, 0x80) | 0
  if (nRoll >= nChance) return 0

  MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c(
    m,
    pAttacker >>> 0,
    pGame >>> 0,
    pDefender >>> 0,
    0x14,
  )
  return 1
}

/**
 * Target-scan callback (`ecx = pGame`, `edx = pOriginUnit`, `[esp+4] = pCandidateUnit`, `[esp+8] = pBestCtx`):
 * selects the closest hostile combat target within `48` subtiles that has melee velocity `> 1` and a walkable
 * line-of-walk (`MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c`).
 *
 * @va D2Game:0x6FCD1520
 */
export function MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c(
  m: D2KernMemory113c,
  pGame: number,
  pOriginUnit: number,
  pCandidateUnit: number,
  pBestCtx: number,
): number {
  hitD2GameVa113c(0x6FCD1520)
  if ((pCandidateUnit >>> 0) === (m.u32((pBestCtx + 0x08) >>> 0) >>> 0)) return 0
  if (
    MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c(
      m,
      pCandidateUnit >>> 0,
      pGame >>> 0,
      pOriginUnit >>> 0,
    ) === 0
  ) {
    return 0
  }

  const nDist = AI_CalcApproxUnitDistSubtiles113c(m, pCandidateUnit >>> 0, pOriginUnit >>> 0) | 0
  if (nDist <= 0x30) {
    if (MONAI_GetUnitMeleeVelocity_6FCD08A0_113c(m, pCandidateUnit >>> 0) > 1) {
      if (nDist < readI32(m, (pBestCtx + 0x04) >>> 0)) {
        if (
          MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(
            m,
            pOriginUnit >>> 0,
            pCandidateUnit >>> 0,
          ) !== 0
        ) {
          m.setU32(pBestCtx >>> 0, pCandidateUnit >>> 0)
          writeI32(m, (pBestCtx + 0x04) >>> 0, nDist)
        }
      }
    }
  }
  return 0
}

/**
 * Target-scan callback (`ecx = pGame`, `edx = pOriginUnit`, `[esp+4] = pCandidateUnit`, `[esp+8] = pBestCtx`):
 * selects the closest hostile target within `48` subtiles with melee velocity `> 1` and clear line-of-sight
 * (`UNITS_HasCollisionBetweenUnits113c` mask `4 == 0`).
 *
 * @va D2Game:0x6FCD1580
 */
export function MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c(
  m: D2KernMemory113c,
  pGame: number,
  pOriginUnit: number,
  pCandidateUnit: number,
  pBestCtx: number,
): number {
  hitD2GameVa113c(0x6FCD1580)
  if ((pCandidateUnit >>> 0) === (m.u32((pBestCtx + 0x08) >>> 0) >>> 0)) return 0
  if (
    MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c(
      m,
      pOriginUnit >>> 0,
      pCandidateUnit >>> 0,
      pGame >>> 0,
    ) === 0
  ) {
    return 0
  }

  const nDist = AI_CalcApproxUnitDistSubtiles113c(m, pCandidateUnit >>> 0, pOriginUnit >>> 0) | 0
  if (nDist <= 0x30) {
    if (MONAI_GetUnitMeleeVelocity_6FCD08A0_113c(m, pCandidateUnit >>> 0) > 1) {
      if (nDist < readI32(m, (pBestCtx + 0x04) >>> 0)) {
        if (UNITS_HasCollisionBetweenUnits113c(m, pCandidateUnit >>> 0, pOriginUnit >>> 0, 4) === 0) {
          m.setU32(pBestCtx >>> 0, pCandidateUnit >>> 0)
          writeI32(m, (pBestCtx + 0x04) >>> 0, nDist)
        }
      }
    }
  }
  return 0
}

/**
 * Target-scan callback (`ecx = pGame`, `edx = pOriginUnit`, `[esp+4] = pCandidateUnit`, `[esp+8] = pBestCtx`):
 * tracks both the closest melee-velocity (`> 1`) hostile target at `(pBestCtx+0x00, +0x04)` and the closest
 * non-melee (`<= 1`) hostile target at `(pBestCtx+0x08, +0x0C)` within `48` subtiles with clear line-of-sight.
 *
 * @va D2Game:0x6FCD15E0
 */
export function MONAI_FindClosestLoSHostileMeleeAndRangedTargetCallback_6FCD15E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pOriginUnit: number,
  pCandidateUnit: number,
  pBestCtx: number,
): number {
  hitD2GameVa113c(0x6FCD15E0)
  if (
    MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c(
      m,
      pOriginUnit >>> 0,
      pCandidateUnit >>> 0,
      pGame >>> 0,
    ) === 0
  ) {
    return 0
  }

  const nDist = AI_CalcApproxUnitDistSubtiles113c(m, pCandidateUnit >>> 0, pOriginUnit >>> 0) | 0
  if (nDist > 0x30) return 0

  const nMeleeVel = MONAI_GetUnitMeleeVelocity_6FCD08A0_113c(m, pCandidateUnit >>> 0) | 0
  if (nMeleeVel > 1) {
    if (nDist >= readI32(m, (pBestCtx + 0x04) >>> 0)) return 0
  } else {
    if (nDist >= readI32(m, (pBestCtx + 0x0c) >>> 0)) return 0
  }

  if (UNITS_HasCollisionBetweenUnits113c(m, pCandidateUnit >>> 0, pOriginUnit >>> 0, 4) !== 0) {
    return 0
  }

  if (nMeleeVel > 1) {
    m.setU32(pBestCtx >>> 0, pCandidateUnit >>> 0)
    writeI32(m, (pBestCtx + 0x04) >>> 0, nDist)
  } else {
    m.setU32((pBestCtx + 0x08) >>> 0, pCandidateUnit >>> 0)
    writeI32(m, (pBestCtx + 0x0c) >>> 0, nDist)
  }
  return 0
}

registerAiTargetModeCallback113c(6, (m, pGame, pOriginUnit, pCandidateUnit, pBestCtx) =>
  MONAI_FindClosestLoSHostileMeleeAndRangedTargetCallback_6FCD15E0_113c(
    m,
    pGame,
    pOriginUnit,
    pCandidateUnit,
    pBestCtx,
  ),
)
registerAiTargetModeCallback113c(7, (m, pGame, pOriginUnit, pCandidateUnit, pBestCtx) =>
  MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c(
    m,
    pGame,
    pOriginUnit,
    pCandidateUnit,
    pBestCtx,
  ),
)


/**
 * Finds the best combat target for `pUnit` (via `AI_FindTargetScanRoomCallback113c` or room scan mode `6`
 * plus `MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c`), writing melee reachability
 * to `pbCanMeleeOut` and distance to `pnOutDist`.
 *
 * @va D2Game:0x6FCD1BC0
 */
export function MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pbCanMeleeOut: number,
  pnOutDist: number,
): number {
  hitD2GameVa113c(0x6FCD1BC0)
  const bestState = { pBestUnit: 0, bestDist: 0x7fffffff }
  const pPresetCand = pUnit !== 0 ? m.u32((pUnit + 0x94) >>> 0) >>> 0 : 0
  let pChosen = 0
  let nChosenDist = 0x7fffffff
  if (AI_FindTargetScanRoomCallback113c(m, pUnit >>> 0, pPresetCand, 1, bestState) !== 0) {
    pChosen = bestState.pBestUnit >>> 0
    nChosenDist = bestState.bestDist | 0
  } else {
    const pCtx = m.alloc(0x10)
    m.setU32(pCtx, 0)
    writeI32(m, (pCtx + 0x04) >>> 0, 0x7fffffff)
    m.setU32((pCtx + 0x08) >>> 0, 0)
    writeI32(m, (pCtx + 0x0c) >>> 0, 0x7fffffff)
    MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c(m, pUnit >>> 0, 0, pGame >>> 0, pCtx, () => 0)
    AITARGET_ScanUnitsByModeTable113c(m, 6, pCtx, pGame >>> 0, pUnit >>> 0, 0)
    const pRangedUnit = m.u32((pCtx + 0x08) >>> 0) >>> 0
    const nRangedDist = readI32(m, (pCtx + 0x0c) >>> 0)
    if (
      MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c(
        m,
        pUnit >>> 0,
        pCtx,
        (pCtx + 0x04) >>> 0,
        pRangedUnit,
        nRangedDist,
      ) !== 0
    ) {
      pChosen = m.u32((pCtx + 0x08) >>> 0) >>> 0
      nChosenDist = readI32(m, (pCtx + 0x0c) >>> 0)
    } else {
      pChosen = m.u32(pCtx) >>> 0
      nChosenDist = readI32(m, (pCtx + 0x04) >>> 0)
    }
  }

  if (pChosen === 0) {
    if (pbCanMeleeOut !== 0) m.setU32(pbCanMeleeOut >>> 0, 0)
    if (pnOutDist !== 0) writeI32(m, pnOutDist >>> 0, 0x7fffffff)
    return 0
  }
  if (pbCanMeleeOut !== 0) {
    const canMelee = UNITS_CanUnitMeleeAttackTarget113c(m, pUnit >>> 0, pChosen, 0) >>> 0
    m.setU32(pbCanMeleeOut >>> 0, canMelee)
  }
  if (pnOutDist !== 0) {
    writeI32(m, pnOutDist >>> 0, nChosenDist)
  }
  return pChosen >>> 0
}

/**
 * Applies a radius curse (`state = 0x19`, `stat = 0x44`) to hostile units with class IDs in
 * `[0x8D..0x91]` or `[0x18C..0x190]` within `dwAuraRange + 2 * nSkillLevel` of the target coords.
 *
 * @va D2Game:0x6FCD39F0
 */
export function SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD39F0)
  const pCoords = m.alloc(8)
  const pOutX = pCoords
  const pOutY = (pCoords + 4) >>> 0
  if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit >>> 0, pGame >>> 0, pOutX, pOutY) === 0) {
    return 0
  }
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }

  const skillId = nSkillId | 0
  let pSkillsTxt = 0
  if (skillId >= 0) {
    const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables !== 0 && skillId < readI32(m, (pDataTables + 0xba0) >>> 0)) {
      const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
      pSkillsTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
    }
  }

  const dwSize = ((pSkillsTxt !== 0 ? readI32(m, (pSkillsTxt + 0x154) >>> 0) : 0) + ((nSkillLevel | 0) << 1)) | 0
  const x = readI32(m, pOutX)
  const y = readI32(m, pOutY)
  const pUnitFindData = SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c(
    m,
    y,
    pGame >>> 0,
    pUnit >>> 0,
    dwSize,
    x,
  ) >>> 0

  const count = pUnitFindData !== 0 ? readI32(m, (pUnitFindData + 0x18) >>> 0) : 0
  for (let i = 0; i < count; i++) {
    const pUnitsArr = m.u32((pUnitFindData + 0x04) >>> 0) >>> 0
    const pCand = m.u32((pUnitsArr + i * 4) >>> 0) >>> 0
    if (
      SUNIT_AreUnitsHostileOrUnaligned113c(m, pCand, pUnit >>> 0, pGame >>> 0) === 0 &&
      pCand !== 0
    ) {
      const nClassId = m.u32((pCand + 0x04) >>> 0) >>> 0
      if ((nClassId >= 0x18c && nClassId <= 0x190) || (nClassId >= 0x8d && nClassId <= 0x91)) {
        if (SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c(m, pCand, pGame >>> 0, pUnit >>> 0) !== 0) {
          STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c(
            m,
            nSkillLevel | 0,
            skillId,
            0,
            pUnit >>> 0,
            pCand,
            0x44,
            0x19,
          )
        }
      }
    }
  }

  if (pUnitFindData !== 0) {
    UNITFINDS_FreeUnitFindData113c(m, pUnitFindData)
  }
  return 1
}

/**
 * Executes a multi-hit life-stealing melee skill step (`Param1 = hitsRemaining`, `Param2 = targetId`,
 * `Param3 = targetType`), rolling physical/elemental/drain damage, healing caster life by `calc3%` of
 * physical damage, applying combat damage, and looping animation frame `dwParam2 (+0x148)` while `hitsRemaining > 0`.
 *
 * @va D2Game:0x6FCD3B20
 */
export function SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD3B20)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pSkill === 0) return 0

  const nTargetType = SKILLS_GetParam3113c(m, pSkill) | 0
  const nTargetId = SKILLS_GetParam2113c(m, pSkill) | 0
  const pTarget = SUNIT_GetServerUnit113c(m, pGame >>> 0, nTargetType, nTargetId) >>> 0
  if (pTarget === 0) return 0
  if (UNITS_CanUnitMeleeAttackTarget113c(m, pUnit >>> 0, pTarget, 0) === 0) return 0

  const nHitsRem = SKILLS_GetParam1113c(m, pSkill) | 0
  if (pUnit === 0) return 0

  const pDmg = m.alloc(0x70)
  const minPhys = SKILLS_GetSkillPhysMinDamage113c(m, pUnit >>> 0, skillId, nSkillLevel | 0, 1) >> 8
  const maxPhys = SKILLS_GetSkillPhysMaxDamage113c(m, pUnit >>> 0, skillId, nSkillLevel | 0, 1) >> 8
  SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, pUnit >>> 0, skillId, pDmg, nSkillLevel | 0)
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, pUnit >>> 0, pDmg, nSkillLevel | 0)

  const pSeed = (pUnit + 0x20) >>> 0
  const rangePhys = (maxPhys - minPhys) | 0
  const roll1 = SEED_RollLimitedFast113c(m, pSeed, rangePhys) | 0
  writeI32(m, (pDmg + 0x28) >>> 0, (roll1 + minPhys) << 1)
  const delayLen = SKILLS_GetSkillPeriodicDelayOrLength113c(m, pUnit >>> 0, skillId, nSkillLevel | 0, 1) | 0
  writeI32(m, (pDmg + 0x2c) >>> 0, delayLen)
  const roll2 = SEED_RollLimitedFast113c(m, pSeed, rangePhys) | 0
  writeI32(m, (pDmg + 0x3c) >>> 0, (roll2 + minPhys) << 8)
  const roll3 = SEED_RollLimitedFast113c(m, pSeed, rangePhys) | 0
  writeI32(m, (pDmg + 0x40) >>> 0, (roll3 + minPhys) << 8)
  m.setU16((pDmg + 0x04) >>> 0, 1)

  const healPct = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit >>> 0,
    readI32(m, (pSkillsTxt + 0x140) >>> 0),
    skillId,
    nSkillLevel | 0,
  ) | 0
  const curLife = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 6, 0) | 0
  const addLife = mulDiv113c(healPct, readI32(m, (pDmg + 0x08) >>> 0), 100) | 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit >>> 0) | 0
  let newLife = (curLife + addLife) | 0
  if (newLife >= maxLife) newLife = maxLife
  STATLIST_SetUnitStat113c(m, pUnit >>> 0, 6, newLife, 0)

  SUNITDMG_ApplyDamage113c(m, pGame >>> 0, pUnit >>> 0, pTarget, pDmg, 1, undefined, 1)
  if (STATLIST_GetUnitStat113c(m, pTarget, 6, 0) === 0) {
    m.setU8((pDmg + 0x04) >>> 0, (m.u8((pDmg + 0x04) >>> 0) | 2) & 0xff)
  }
  SUNITDMG_ApplySideEffectsAndKill113c(m, pGame >>> 0, pUnit >>> 0, pTarget, pDmg)

  const nextHits = (nHitsRem - 1) | 0
  if (nextHits > 0) {
    SKILLS_SetParam1113c(m, pSkill, nextHits)
    UNITS_SetSeqFrameFromLowByte113c(m, pUnit >>> 0, readI32(m, (pSkillsTxt + 0x148) >>> 0))
    m.setU32((pUnit + 0x48) >>> 0, ((m.u32((pUnit + 0x48) >>> 0) & 0xffffff00) + 0x100) >>> 0)
  }
  return 1
}


/**
 * Validates the path target of `pUnit`, rolls and applies elemental skill damage (`0x6FCBF210`),
 * and sets the monster skill icon (`wAuraTargetState` at `+0x4E`) on `pTarget` when in `1..nStates`.
 *
 * @va D2Game:0x6FCD3D60
 */
export function SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD3D60)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget !== (pUnit >>> 0) && pTarget !== 0) {
    const pDmg = m.alloc(0x70)
    const wRes = (1 | m.u16((pSkillsTxt + 0x12e) >>> 0)) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wRes)
    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pSkillsTxt + 0x130) >>> 0)) >>> 0)
    const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
    if (dwHitClass !== 0) {
      m.setU32((pDmg + 0x60) >>> 0, dwHitClass)
    }
    const poisLen = SKILLS_GetSkillPeriodicDelayOrLength113c(m, pUnit >>> 0, skillId, nSkillLevel | 0, 1) | 0
    writeI32(m, (pDmg + 0x34) >>> 0, poisLen)
    SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, pUnit >>> 0, pDmg, nSkillLevel | 0)
    SUNITDMG_ApplyDamage113c(m, pGame >>> 0, pUnit >>> 0, pTarget, pDmg, 1, undefined, 1)
    if (STATLIST_GetUnitStat113c(m, pTarget, 6, 0) === 0) {
      m.setU8((pDmg + 0x04) >>> 0, (m.u8((pDmg + 0x04) >>> 0) | 2) & 0xff)
    }
    SUNITDMG_ApplySideEffectsAndKill113c(m, pGame >>> 0, pUnit >>> 0, pTarget, pDmg)

    const wState = (m.u16((pSkillsTxt + 0x4e) >>> 0) << 16) >> 16
    if (wState > 0 && wState <= readI32(m, (pDataTables + 0xbc0) >>> 0)) {
      STATES_SetMonsterSkillIconOnUnit113c(m, pTarget, wState, 0)
    }
  }
  return 1
}

/**
 * Steps a multi-phase monster/player dash-or-strike skill (`0x6FCD3F10`):
 * handles skill flag bit 1 reset, velocity/path computation at frame `dwParam4 (+0x150)`,
 * sequence frame jump at `dwParam5 (+0x154)`, and melee hit + damage application when `bActionFlag (+0x4E) == 1`.
 *
 * @va D2Game:0x6FCD3F10
 */
export function SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD3F10)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pSkill === 0) return 0

  if ((SKILLS_GetFlags113c(m, pSkill) & 2) !== 0) {
    SKILLS_SetParam0C113c(m, pSkill, 0)
    m.setU32((pUnit + 0x48) >>> 0, (readI32(m, (pSkillsTxt + 0x148) >>> 0) << 8) >>> 0)
    UNITS_SetSeqFrameFromLowByte113c(m, pUnit >>> 0, readI32(m, (pSkillsTxt + 0x14c) >>> 0))
    return 1
  }

  const pMetrics = m.alloc(8)
  const pFrame = pMetrics
  const pFrameCount = (pMetrics + 4) >>> 0
  UNITS_GetShiftedFrameMetrics113c(m, pUnit >>> 0, pFrame, pFrameCount)
  const curFrame = readI32(m, pFrame)

  if (curFrame === readI32(m, (pSkillsTxt + 0x150) >>> 0)) {
    const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    if (pPath === 0) return 0
    let vel =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit >>> 0,
        readI32(m, (pSkillsTxt + 0x138) >>> 0),
        skillId,
        nSkillLevel | 0,
      ) << 8
    if (vel <= 0x100) vel = 0x100
    const velPct = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x43, 0) | 0
    const scaledVel = mulDiv113c(velPct, vel, 100) | 0
    PATH_SetVelocity113c(m, pPath, scaledVel, 0x6fd1b4e8, 0x731)
    PATH_SetType113c(m, pPath, 1)
    PATH_Compute113c(m, pPath, pUnit >>> 0, 0)
    SKILLS_SetParam0C113c(m, pSkill, 1)
    return 1
  }

  if (curFrame === readI32(m, (pSkillsTxt + 0x154) >>> 0)) {
    m.setU32((pUnit + 0x48) >>> 0, (readI32(m, (pSkillsTxt + 0x158) >>> 0) << 8) >>> 0)
    UNITS_SetSeqFrameFromLowByte113c(m, pUnit >>> 0, readI32(m, (pSkillsTxt + 0x15c) >>> 0))
    return 1
  }

  if (m.u8((pUnit + 0x4e) >>> 0) === 1) {
    const nTargetId = SKILLS_GetParam1113c(m, pSkill) | 0
    const nTargetType = SKILLS_GetParam2113c(m, pSkill) | 0
    const pTarget = SUNIT_GetServerUnit113c(m, pGame >>> 0, nTargetType, nTargetId) >>> 0
    if (pTarget !== 0 && UNITS_CanUnitMeleeAttackTarget113c(m, pUnit >>> 0, pTarget, 0) !== 0) {
      const pDmg = m.alloc(0x70)
      m.setU8((pUnit + 0x4e) >>> 0, 0)
      SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c(
        m,
        pSkillsTxt,
        pDmg,
        nSkillLevel | 0,
        skillId,
        pGame >>> 0,
        pUnit >>> 0,
        pTarget,
        0,
      )
      if ((m.u8((pDmg + 0x04) >>> 0) & 1) === 0) {
        return 1
      }
      const dwHitFlags = (m.u32((pSkillsTxt + 0x130) >>> 0) | 0x20) >>> 0
      const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
      m.setU32(pDmg, dwHitFlags)
      if (dwHitClass !== 0) {
        m.setU32((pDmg + 0x60) >>> 0, dwHitClass)
      }
      SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, pUnit >>> 0, skillId, pDmg, nSkillLevel | 0)
      SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, pUnit >>> 0, pDmg, nSkillLevel | 0)
      SUNITDMG_ApplyDamage113c(m, pGame >>> 0, pUnit >>> 0, pTarget, pDmg, 1, undefined, 1)
      if (STATLIST_GetUnitStat113c(m, pTarget, 6, 0) === 0) {
        m.setU8((pDmg + 0x04) >>> 0, (m.u8((pDmg + 0x04) >>> 0) | 2) & 0xff)
      }
      SUNITDMG_ApplySideEffectsAndKill113c(m, pGame >>> 0, pUnit >>> 0, pTarget, pDmg)
    }
  }
  return 1
}

/**
 * Sets `pTarget` as the dynamic target unit of `pUnit`, rolls attack hit via `SUNITDMG_CalcMonsterExperience113c`,
 * populates `pDmg` (`calc2` physical + elemental skill damage), allocates combat (`0x80`), executes combat events,
 * and records the hit bit (`0` or `1`) in active skill `Param1`.
 *
 * @va D2Game:0x6FCD4520
 */
export function SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pUnit: number,
  pTarget: number,
  pGame: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD4520)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0 || pTarget === 0) return 0

  UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit >>> 0, pTarget >>> 0)
  const pDmg = m.alloc(0x70)
  const toHit = SKILLS_GetSkillToHitBonus113c(m, pUnit >>> 0, skillId, nSkillLevel | 0) | 0
  const wHitRes =
    SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, pUnit >>> 0, pTarget >>> 0, pGame >>> 0, toHit, 0) &
    0xffff
  m.setU16((pDmg + 0x04) >>> 0, wHitRes)

  if ((wHitRes & 1) !== 0) {
    const wCombined = (wHitRes | m.u16((pSkillsTxt + 0x12e) >>> 0)) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wCombined)
    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pSkillsTxt + 0x130) >>> 0)) >>> 0)
    const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
    if (dwHitClass !== 0) {
      m.setU32((pDmg + 0x60) >>> 0, dwHitClass)
    }
    const enDmgPct = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      readI32(m, (pSkillsTxt + 0x13c) >>> 0),
      skillId,
      nSkillLevel | 0,
    ) | 0
    writeI32(m, (pDmg + 0x0c) >>> 0, enDmgPct)
    SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, pUnit >>> 0, pDmg, nSkillLevel | 0)
  }

  SUNITDMG_AllocCombat113c(m, pGame >>> 0, pUnit >>> 0, pTarget >>> 0, pDmg, 0x80)
  SUNITDMG_ExecuteEvents113c(m, pGame >>> 0, pUnit >>> 0, pTarget >>> 0, 1, 0)
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pSkill !== 0) {
    SKILLS_SetParam1113c(m, pSkill, (m.u8((pDmg + 0x04) >>> 0) & 1) !== 0 ? 1 : 0)
  }
  return 1
}


/**
 * Fires a fan of `calc1` server projectiles (`wSrvMissile` at `+0x48`) spread perpendicular to the
 * vector from `pUnit` to the target coordinates.
 *
 * @va D2Game:0x6FCD4DE0
 */
export function SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD4DE0)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nMissileId = (m.u16((pSkillsTxt + 0x48) >>> 0) << 16) >> 16
  if (nMissileId < 0 || nMissileId >= readI32(m, (pDataTables + 0xb6c) >>> 0)) return 0

  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }

  const pCoords = m.alloc(8)
  const pOutX = pCoords
  const pOutY = (pCoords + 4) >>> 0
  if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit >>> 0, pGame >>> 0, pOutX, pOutY) === 0) {
    return 0
  }

  const unitX = UNIT_GetPosX113c(m, pUnit >>> 0) | 0
  const unitY = UNIT_GetPosY113c(m, pUnit >>> 0) | 0
  let dx = (readI32(m, pOutX) - unitX) | 0
  let dy = (readI32(m, pOutY) - unitY) | 0
  if (dx === 0 && dy === 0) return 0

  let stepX = 0
  let stepY = 0
  if (dx < 0 && dy < 0) {
    stepX = 2
    stepY = -2
  } else if (dx === 0) {
    if (dy < 0) {
      stepX = 2
    } else if (dy > 0) {
      stepX = -2
    }
  } else if (dx > 0) {
    if (dy < 0) {
      stepX = 2
      stepY = 2
    } else if (dy === 0) {
      stepY = 2
    } else {
      stepX = -2
      stepY = 2
    }
  } else {
    if (dy > 0) {
      stepX = -2
      stepY = -2
    } else if (dy === 0) {
      stepY = -2
    }
  }

  const count = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit >>> 0,
    readI32(m, (pSkillsTxt + 0x138) >>> 0),
    skillId,
    nSkillLevel | 0,
  ) | 0
  const half = Math.trunc(count / 2) | 0
  dx = (dx - Math.imul(half, stepX)) | 0
  dy = (dy - Math.imul(half, stepY)) | 0

  const pMisParams = m.alloc(0x5c)
  m.setU32(pMisParams, 3)
  for (let i = 0; i < count; i++) {
    const div6 = Math.trunc(dx / 6) | 0
    m.setU32((pMisParams + 0x04) >>> 0, pUnit >>> 0)
    writeI32(m, (pMisParams + 0x10) >>> 0, nMissileId)
    writeI32(m, (pMisParams + 0x14) >>> 0, (unitX + div6) | 0)
    writeI32(m, (pMisParams + 0x18) >>> 0, (unitY + div6) | 0)
    writeI32(m, (pMisParams + 0x1c) >>> 0, dx)
    writeI32(m, (pMisParams + 0x20) >>> 0, dy)
    writeI32(m, (pMisParams + 0x30) >>> 0, nSkillLevel | 0)
    MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pMisParams)
    dx = (dx + stepX) | 0
    dy = (dy + stepY) | 0
  }
  return 1
}

/**
 * Spawns `calc1` server projectiles (`wSrvMissile` at `+0x48`) with `dwFlags = 0x21` and initializer
 * callback `0x6FCD31D0` (`MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c`).
 *
 * @va D2Game:0x6FCD4FF0
 */
export function SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD4FF0)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nMissileId = (m.u16((pSkillsTxt + 0x48) >>> 0) << 16) >> 16
  if (nMissileId < 0 || nMissileId >= readI32(m, (pDataTables + 0xb6c) >>> 0)) return 0

  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }

  const count = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit >>> 0,
    readI32(m, (pSkillsTxt + 0x138) >>> 0),
    skillId,
    nSkillLevel | 0,
  ) | 0

  const pMisParams = m.alloc(0x5c)
  m.setU32(pMisParams, 0x21)
  m.setU32((pMisParams + 0x04) >>> 0, pUnit >>> 0)
  writeI32(m, (pMisParams + 0x10) >>> 0, nMissileId)
  writeI32(m, (pMisParams + 0x14) >>> 0, UNIT_GetPosX113c(m, pUnit >>> 0) | 0)
  writeI32(m, (pMisParams + 0x18) >>> 0, UNIT_GetPosY113c(m, pUnit >>> 0) | 0)
  writeI32(m, (pMisParams + 0x30) >>> 0, nSkillLevel | 0)
  m.setU32((pMisParams + 0x54) >>> 0, 0x6fcd31d0)

  if (
    SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
      m,
      pUnit >>> 0,
      pGame >>> 0,
      (pMisParams + 0x1c) >>> 0,
      (pMisParams + 0x20) >>> 0,
    ) === 0
  ) {
    return 0
  }

  for (let i = 0; i < count; i++) {
    writeI32(m, (pMisParams + 0x58) >>> 0, i)
    MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pMisParams, {
      missileInitCallback: (mem, _fnVa, pMis, arg) => {
        MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c(mem, pMis, arg)
      },
    })
  }
  return 1
}

const DIR_BASE_6FD1B510 = [29, 28, 27, 26, 25, 24, 31, 30] as const
const DIR_SWEEP_6FD1B518 = [
  27, 14, 15, 3, 99, 7, 21, 22, 31,
  26, 12, 13, 2, 99, 6, 19, 20, 30,
  25, 10, 11, 1, 99, 5, 17, 18, 29,
  24, 8, 9, 0, 99, 4, 15, 16, 28,
  31, 22, 23, 7, 99, 3, 13, 14, 27,
  30, 20, 7, 6, 99, 2, 1, 12, 26,
  29, 18, 19, 5, 99, 1, 9, 10, 25,
  28, 16, 17, 4, 99, 0, 23, 8, 24,
] as const

/**
 * Spawns a directional sweep projectile (`wSrvMissile` at `+0x48`, `dwFlags = 0x20`) at an offset
 * determined by normalized direction `0..7` and current animation frame `clamp(frame - 4, 0, 8)`.
 *
 * @va D2Game:0x6FCD56C0
 */
export function SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD56C0)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nMissileId = (m.u16((pSkillsTxt + 0x48) >>> 0) << 16) >> 16
  if (nMissileId < 0 || nMissileId >= readI32(m, (pDataTables + 0xb6c) >>> 0)) return 0

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pSkill === 0) return 0

  let targetX = SKILLS_GetParam1113c(m, pSkill) | 0
  let targetY = SKILLS_GetParam2113c(m, pSkill) | 0
  const pScratch = m.alloc(0x18)
  if (targetX === 0 || targetY === 0) {
    if (
      SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
        m,
        pUnit >>> 0,
        pGame >>> 0,
        pScratch,
        (pScratch + 4) >>> 0,
      ) === 0
    ) {
      return 0
    }
    targetX = readI32(m, pScratch)
    targetY = readI32(m, (pScratch + 4) >>> 0)
  }

  const rawDir = UNITS_GetDirectionToCoords113c(m, pUnit >>> 0, targetX, targetY) & 0xff
  const normDir = DATATBLS_NormalizeDirection113c(m, rawDir) & 7
  let posX = UNIT_GetPosX113c(m, pUnit >>> 0) | 0
  let posY = UNIT_GetPosY113c(m, pUnit >>> 0) | 0

  const pDx = (pScratch + 8) >>> 0
  const pDy = (pScratch + 12) >>> 0
  DATATBLS_GetDirectionOffset113c(m, DIR_BASE_6FD1B510[normDir]!, pDx, pDy)
  posX = (posX + readI32(m, pDx)) | 0
  posY = (posY + readI32(m, pDy)) | 0

  const pFrame = (pScratch + 16) >>> 0
  const pFrameCount = (pScratch + 20) >>> 0
  UNITS_GetShiftedFrameMetrics113c(m, pUnit >>> 0, pFrame, pFrameCount)
  let frameIdx = (readI32(m, pFrame) - 4) | 0
  if (frameIdx <= 0) frameIdx = 0
  else if (frameIdx >= 8) frameIdx = 8

  const sweepDir = DIR_SWEEP_6FD1B518[normDir * 9 + frameIdx]!
  if (sweepDir !== 0x63) {
    DATATBLS_GetDirectionOffset113c(m, sweepDir, pDx, pDy)
    posX = (posX + readI32(m, pDx)) | 0
    posY = (posY + readI32(m, pDy)) | 0
  }

  const pMisParams = m.alloc(0x5c)
  m.setU32(pMisParams, 0x20)
  m.setU32((pMisParams + 0x04) >>> 0, pUnit >>> 0)
  m.setU32((pMisParams + 0x08) >>> 0, pUnit >>> 0)
  writeI32(m, (pMisParams + 0x10) >>> 0, nMissileId)
  writeI32(m, (pMisParams + 0x1c) >>> 0, posX)
  writeI32(m, (pMisParams + 0x20) >>> 0, posY)
  writeI32(m, (pMisParams + 0x30) >>> 0, nSkillLevel | 0)
  MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pMisParams)
  return 1
}

/**
 * Initiates a monster/player knockback-dash attack (`0x6FCD6380`), allocating a `0x80` combat entry
 * against the path target unit (if present), reserving collision at the destination subtile, refreshing
 * AI event `1`, and storing destination/target state in `Param1..Param4` and `Param0C = 0x80`.
 *
 * @va D2Game:0x6FCD6380
 */
export function SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD6380)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || skillId >= readI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pSkill === 0) return 0
  const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
  if (pPath === 0) return 0
  if (STATES_CheckState113c(m, pUnit >>> 0, 1) !== 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  let pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0)) pTarget = 0

  let destX = 0
  let destY = 0
  if (pTarget === 0) {
    destX = PATH_GetFirstPointX113c(m, pPath) | 0
    destY = PATH_GetFirstPointY113c(m, pPath) | 0
    SKILLS_SetParam4113c(m, pSkill, -1)
  } else {
    const tX = UNIT_GetPosX113c(m, pTarget) | 0
    const tY = UNIT_GetPosY113c(m, pTarget) | 0
    const uX = UNIT_GetPosX113c(m, pUnit >>> 0) | 0
    const uY = UNIT_GetPosY113c(m, pUnit >>> 0) | 0
    destX = (tX * 2 - uX) | 0
    destY = (tY * 2 - uY) | 0
  }

  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  const pDestRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, destX, destY) >>> 0
  if (pDestRoom === 0) return 0

  if (pTarget !== 0) {
    const pDmg = m.alloc(0x70)
    const toHit = SKILLS_GetSkillToHitBonus113c(m, pUnit >>> 0, skillId, nSkillLevel | 0) | 0
    const wHitRes =
      SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, pUnit >>> 0, pTarget, pGame >>> 0, toHit, 0) &
      0xffff
    m.setU16((pDmg + 0x04) >>> 0, wHitRes)
    if ((wHitRes & 1) !== 0) {
      m.setU16((pDmg + 0x04) >>> 0, (wHitRes | m.u16((pSkillsTxt + 0x12e) >>> 0)) & 0xffff)
      m.setU32(pDmg, (m.u32(pDmg) | m.u32((pSkillsTxt + 0x130) >>> 0)) >>> 0)
      const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
      if (dwHitClass !== 0) m.setU32((pDmg + 0x60) >>> 0, dwHitClass)
      const enDmgPct = SKILLS_EvalCalcByOffset113c(
        m,
        pUnit >>> 0,
        readI32(m, (pSkillsTxt + 0x138) >>> 0),
        skillId,
        nSkillLevel | 0,
      ) | 0
      writeI32(m, (pDmg + 0x0c) >>> 0, enDmgPct)
      SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, pUnit >>> 0, pDmg, nSkillLevel | 0)
    }
    SUNITDMG_AllocCombat113c(m, pGame >>> 0, pUnit >>> 0, pTarget, pDmg, 0x80)
    SKILLS_SetParam3113c(m, pSkill, readI32(m, pTarget))
    SKILLS_SetParam4113c(m, pSkill, readI32(m, (pTarget + 0x0c) >>> 0))
  } else {
    SKILLS_SetParam4113c(m, pSkill, -1)
  }

  const pattern = PATH_GetUnitCollisionPattern113c(m, pUnit >>> 0) | 0
  COLLISION_SetUnitCollisionMaskWithPattern113c(m, pDestRoom, destX, destY, pattern, 0x100)
  MONSTER_RefreshAiEvent113c(m, pUnit >>> 0, 1)
  SKILLS_SetParam1113c(m, pSkill, destX)
  SKILLS_SetParam2113c(m, pSkill, destY)
  SKILLS_SetParam0C113c(m, pSkill, 0x80)
  return 1
}


/**
 * Ticks channeled Inferno projectile emission (`0x6FCD6840`): spawns a stream projectile (`dwFlags = 0x25`),
 * configures range/frames (`0x6FCD32E0`) and channeled sequence frames (`0x6FCD3270`), and either schedules
 * the next channel tick (`event 0` after `calc3` frames while `dwGameFrame < Param1` and state `0x0C` holds)
 * or terminates the channel via `SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c`.
 *
 * @va D2Game:0x6FCD6840
 */
export function SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD6840)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pSkill === 0) return 0

  const nMissileId = (m.u16((pSkillsTxt + 0x48) >>> 0) << 16) >> 16
  if (nMissileId < 0 || nMissileId >= (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) return 0

  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, nMissileId) >>> 0
  const pMisParams = m.alloc(0x5c) >>> 0
  m.setU32(pMisParams, 0x25)
  m.setU32((pMisParams + 0x04) >>> 0, pUnit >>> 0)
  m.setU32((pMisParams + 0x14) >>> 0, UNIT_GetPosX113c(m, pUnit >>> 0) >>> 0)
  m.setU32((pMisParams + 0x18) >>> 0, UNIT_GetPosY113c(m, pUnit >>> 0) >>> 0)

  const lvl = nSkillLevel | 0
  const bLevVel = pMissilesTxt !== 0 ? m.u8((pMissilesTxt + 0x9b) >>> 0) : 0
  const bVel = pMissilesTxt !== 0 ? m.u8((pMissilesTxt + 0x9a) >>> 0) : 0
  const nVel = (Math.trunc(Math.imul(bLevVel, lvl) / 8) + bVel) | 0
  m.setU32((pMisParams + 0x10) >>> 0, nMissileId >>> 0)
  m.setU32((pMisParams + 0x28) >>> 0, nVel >>> 0)
  m.setU32((pMisParams + 0x30) >>> 0, lvl >>> 0)

  if (
    SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
      m,
      pUnit >>> 0,
      pGame >>> 0,
      (pMisParams + 0x1c) >>> 0,
      (pMisParams + 0x20) >>> 0,
    ) === 0
  ) {
    SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c(m, pGame >>> 0, pUnit >>> 0)
    return 0
  }

  const pMissile = MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pMisParams) >>> 0
  if (pMissile === 0) {
    SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c(m, pGame >>> 0, pUnit >>> 0)
    return 0
  }

  MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c(m, skillId, pMissile, pUnit >>> 0, lvl)
  SKILLS_InitInfernoSeqFrames_6FCD3270_113c(m, pUnit >>> 0, pSkillsTxt)

  const nEndFrame = SKILLS_GetParam1113c(m, pSkill) | 0
  const nCurFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  if (nCurFrame >= nEndFrame || STATES_CheckState113c(m, pUnit >>> 0, 0x0c) === 0) {
    SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c(m, pGame >>> 0, pUnit >>> 0)
    return 1
  }

  let nStepFrames =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x140) >>> 0) | 0,
      skillId,
      lvl,
    ) | 0
  if (nStepFrames < 1) nStepFrames = 1

  if ((pUnit >>> 0) !== 0) {
    let pNode1 = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pNode1 !== 0) {
      const pNext1 = m.u32((pNode1 + 0x24) >>> 0) >>> 0
      if (m.u8(pNode1) === 1) EVENT_FreeNode113c(m, pGame >>> 0, pNode1)
      pNode1 = pNext1
    }
    let pNode0 = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pNode0 !== 0) {
      const pNext0 = m.u32((pNode0 + 0x24) >>> 0) >>> 0
      if (m.u8(pNode0) === 0) EVENT_FreeNode113c(m, pGame >>> 0, pNode0)
      pNode0 = pNext0
    }
  }

  const nextFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + nStepFrames) >>> 0
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0, nextFrame, 0, 0, 0)
  return 1
}

/**
 * Ticks channeled Arctic Blast projectile emission (`0x6FCD6A60`), mirroring `0x6FCD6840`
 * (`dwFlags = 0x25`, range/frame setup, sequence frame update, and `event 0` / `event 1` scheduling).
 *
 * @va D2Game:0x6FCD6A60
 */
export function SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD6A60)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0 || skillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pSkill === 0) return 0

  const nMissileId = (m.u16((pSkillsTxt + 0x48) >>> 0) << 16) >> 16
  if (nMissileId < 0 || nMissileId >= (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) return 0

  const pMissilesTxt = MISSILES_GetTxtRecordFast113c(m, nMissileId) >>> 0
  const pMisParams = m.alloc(0x5c) >>> 0
  m.setU32(pMisParams, 0x25)
  m.setU32((pMisParams + 0x04) >>> 0, pUnit >>> 0)
  m.setU32((pMisParams + 0x14) >>> 0, UNIT_GetPosX113c(m, pUnit >>> 0) >>> 0)
  m.setU32((pMisParams + 0x18) >>> 0, UNIT_GetPosY113c(m, pUnit >>> 0) >>> 0)

  const lvl = nSkillLevel | 0
  const bLevVel = pMissilesTxt !== 0 ? m.u8((pMissilesTxt + 0x9b) >>> 0) : 0
  const bVel = pMissilesTxt !== 0 ? m.u8((pMissilesTxt + 0x9a) >>> 0) : 0
  const nVel = (Math.trunc(Math.imul(bLevVel, lvl) / 8) + bVel) | 0
  m.setU32((pMisParams + 0x10) >>> 0, nMissileId >>> 0)
  m.setU32((pMisParams + 0x28) >>> 0, nVel >>> 0)
  m.setU32((pMisParams + 0x30) >>> 0, lvl >>> 0)

  if (
    SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
      m,
      pUnit >>> 0,
      pGame >>> 0,
      (pMisParams + 0x1c) >>> 0,
      (pMisParams + 0x20) >>> 0,
    ) === 0
  ) {
    SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c(m, pGame >>> 0, pUnit >>> 0)
    return 0
  }

  const pMissile = MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pMisParams) >>> 0
  if (pMissile === 0) {
    SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c(m, pGame >>> 0, pUnit >>> 0)
    return 0
  }

  MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c(m, skillId, pMissile, pUnit >>> 0, lvl)
  SKILLS_InitInfernoSeqFrames_6FCD3270_113c(m, pUnit >>> 0, pSkillsTxt)

  const nEndFrame = SKILLS_GetParam1113c(m, pSkill) | 0
  const nCurFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  if (nCurFrame >= nEndFrame || STATES_CheckState113c(m, pUnit >>> 0, 0x0c) === 0) {
    SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c(m, pGame >>> 0, pUnit >>> 0)
    return 1
  }

  let nStepFrames =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x140) >>> 0) | 0,
      skillId,
      lvl,
    ) | 0
  if (nStepFrames < 1) nStepFrames = 1

  if ((pUnit >>> 0) !== 0) {
    let pNode1 = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pNode1 !== 0) {
      const pNext1 = m.u32((pNode1 + 0x24) >>> 0) >>> 0
      if (m.u8(pNode1) === 1) EVENT_FreeNode113c(m, pGame >>> 0, pNode1)
      pNode1 = pNext1
    }
    let pNode0 = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pNode0 !== 0) {
      const pNext0 = m.u32((pNode0 + 0x24) >>> 0) >>> 0
      if (m.u8(pNode0) === 0) EVENT_FreeNode113c(m, pGame >>> 0, pNode0)
      pNode0 = pNext0
    }
  }

  const nextFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + nStepFrames) >>> 0
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0, nextFrame, 0, 0, 0)
  return 1
}

/**
 * Selects Baal's next AI action index (`0..15`): returns forced action `pAiState->dwForcedAction` (`+0x14`)
 * if non-zero; handles targetless collision/roam rolls (`4`, `9`, or `1`); checks player Town Portal proximity
 * in level `0x84` (`132`) and Baal's anchor distance (`> 75`, `> 100`), then delegates to close-range (`0x6FCD7750`),
 * line-of-sight (`0x6FCD7380`), or mid-range (`0x6FCD75D0`) weighted selection.
 *
 * @va D2Game:0x6FCD79B0
 */
export function AIBAAL_SelectAction_6FCD79B0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pTarget: number,
  pGame: number,
  pAiState: number,
  nFrameDelta: number,
  nNearbyCount: number,
  pAnchorStaticPath: number,
): number {
  hitD2GameVa113c(0x6FCD79B0)
  const forcedAction = m.u32((pAiState + 0x14) >>> 0) | 0
  if (forcedAction !== 0) return forcedAction

  if ((pTarget >>> 0) === 0) {
    const dwTypeY = m.u32(pUnit >>> 0) | 0
    const pPathY = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    const unitY =
      dwTypeY === 2 || (dwTypeY > 3 && dwTypeY <= 5)
        ? m.u32((pPathY + 0x10) >>> 0) | 0
        : pPathY !== 0
          ? PATH_GetPosY113c(m, pPathY) | 0
          : 0

    const dwTypeX = m.u32(pUnit >>> 0) | 0
    const pPathX = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    const unitX =
      dwTypeX === 2 || (dwTypeX > 3 && dwTypeX <= 5)
        ? m.u32((pPathX + 0x0c) >>> 0) | 0
        : pPathX !== 0
          ? PATH_GetPosX113c(m, pPathX) | 0
          : 0

    const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
    if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, unitX, unitY, 2, 0x40) !== 0) {
      return 4
    }

    const pSeed = (pUnit + 0x20) >>> 0
    const prod =
      BigInt(m.u32(pSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
    const lo = Number(prod & 0xffffffffn) >>> 0
    const hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pSeed + 0x04) >>> 0, hi)
    m.setU32(pSeed, lo)
    const rem = (lo % 100) | 0
    return rem < 8 ? 9 : 1
  }

  let game = pGame >>> 0
  if (game === 0) {
    game = D2GAME_SUNIT_GetGameFromUnit113c(m, pUnit >>> 0) >>> 0
  }

  let bPortalNearInChamber = 0
  if (m.u32(pTarget >>> 0) === 0) {
    const dwPortalGuid = PLAYER_GetPlayerDataField48_6FC57440_113c(m, pTarget >>> 0) >>> 0
    if (game !== 0) {
      let pPortalObj = m.u32((game + (dwPortalGuid & 0x7f) * 4 + 0x1520) >>> 0) >>> 0
      while (pPortalObj !== 0) {
        if ((m.u32((pPortalObj + 0x0c) >>> 0) >>> 0) === dwPortalGuid) {
          const pPortalRoom = UNITS_GetRoom113c(m, pPortalObj) >>> 0
          if ((DUNGEON_GetLevelIdFromRoom113c(m, pPortalRoom) | 0) === 0x84) {
            if ((pAnchorStaticPath >>> 0) === 0) {
              bPortalNearInChamber = 1
            } else {
              const anchorX = m.u32((pAnchorStaticPath + 0x0c) >>> 0) | 0
              const anchorY = m.u32((pAnchorStaticPath + 0x10) >>> 0) | 0
              const dist =
                UNITS_GetUnitDistanceToCoordinates113c(m, pPortalObj, anchorX, anchorY) >>> 0
              if (dist < 0x4b) {
                bPortalNearInChamber = 1
              }
            }
          }
          break
        }
        pPortalObj = m.u32((pPortalObj + 0xe4) >>> 0) >>> 0
      }
    }
  }

  let bAnchorDistGt75 = 0
  let bAnchorDistGt100 = 0
  if ((pAnchorStaticPath >>> 0) !== 0) {
    const anchorX = m.u32((pAnchorStaticPath + 0x0c) >>> 0) | 0
    const anchorY = m.u32((pAnchorStaticPath + 0x10) >>> 0) | 0
    const distTarget = AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(
      m,
      pTarget >>> 0,
      anchorX,
      anchorY,
    ) | 0
    if (distTarget > 0x4b) bAnchorDistGt75 = 1
    if (distTarget > 0x64) bAnchorDistGt100 = 1
  }

  const bInMelee = UNITS_CanUnitMeleeAttackTarget113c(m, pUnit >>> 0, pTarget >>> 0, 0) | 0
  const hasColl = UNITS_HasCollisionBetweenUnits113c(m, pUnit >>> 0, pTarget >>> 0, 4) | 0
  const bHasLoS = hasColl === 0 ? 1 : 0

  if (bInMelee !== 0) {
    return AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c(
      m,
      pUnit >>> 0,
      game,
      pTarget >>> 0,
      bHasLoS,
    )
  }
  if (bHasLoS !== 0) {
    return AIBAAL_ChooseActionWeighted_6FCD7380_113c(
      m,
      pUnit >>> 0,
      game,
      pAiState >>> 0,
      pTarget >>> 0,
      nNearbyCount | 0,
      bAnchorDistGt75,
      bAnchorDistGt100,
      bPortalNearInChamber,
      nFrameDelta | 0,
    )
  }
  return AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c(
    m,
    pTarget >>> 0,
    game,
    pUnit >>> 0,
    nNearbyCount | 0,
    bAnchorDistGt75,
    bAnchorDistGt100,
  )
}

/**
 * Initializes the Act 4 Hadriel checkpoint quest descriptor (`dwQuestId = 0x21`), zeroing callback
 * slots `+0xA0..+0xDB` and wiring `0x6FCD8C00`, `0x6FD26FE8`, `0x6FCD87D0`, and `0x6FCD8B90`.
 *
 * @va D2Game:0x6FCD97D0
 */
export function ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FCD97D0)
  void ACT4Q0_StatusFilter_6FCD87D0_113c
  void ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c
  void ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c
  const base = pQuestData >>> 0
  for (let i = 0; i < 0x0f; i = (i + 1) | 0) {
    m.setU32((base + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU32((base + 0xa0) >>> 0, 0x6fcd8c00)
  m.setU32((base + 0xdc) >>> 0, 0x6fd26fe8)
  m.setU8((base + 0x0a) >>> 0, 1)
  m.setU8((base + 0x0c) >>> 0, 0)
  m.setU8((base + 0x0b) >>> 0, 0)
  m.setU32((base + 0x18) >>> 0, 0)
  m.setU32((base + 0xe0) >>> 0, 0x21)
  m.setU32((base + 0xe8) >>> 0, 0x6fcd87d0)
  m.setU32((base + 0xec) >>> 0, 0x6fcd8b90)
}

/**
 * Initializes the Act 4 Prologue quest descriptor (`dwQuestId = 0x18`), zeroing callback slots
 * `+0xA0..+0xDB` and wiring `0x6FCD9730`, `0x6FCD97A0` (`+0xCC`), `0x6FD25F90`, `0x6FCD8B80`, and `0x6FCD8B50`.
 *
 * @va D2Game:0x6FCD9D80
 */
export function ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FCD9D80)
  void ACT4Prologue_ActiveFilter_6FCD8B50_113c
  void ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c
  void ACT4Prologue_StatusFilter_6FCD8B80_113c
  void ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c
  const base = pQuestData >>> 0
  for (let i = 0; i < 0x0f; i = (i + 1) | 0) {
    m.setU32((base + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU32((base + 0xa0) >>> 0, 0x6fcd9730)
  m.setU32((base + 0xcc) >>> 0, 0x6fcd97a0)
  m.setU32((base + 0xdc) >>> 0, 0x6fd25f90)
  m.setU8((base + 0x0a) >>> 0, 1)
  m.setU8((base + 0x0c) >>> 0, 0)
  m.setU8((base + 0x0b) >>> 0, 0)
  m.setU32((base + 0x18) >>> 0, 0)
  m.setU32((base + 0xe0) >>> 0, 0x18)
  m.setU32((base + 0xe8) >>> 0, 0x6fcd8b80)
  m.setU32((base + 0xec) >>> 0, 0x6fcd8b50)
}

/**
 * Completes Act 4 Quest 3 (`0x1A` / Diablo) for `pPlayerUnit` (`edx`) in `pGame` (`ecx`) if quest `0x1A`
 * bits `0` and `1` are unset and `pPlayerUnit` is in or adjacent to Diablo's death room (`pQuest17->pCustom+0x3C`).
 *
 * @va D2Game:0x6FCD9F20
 */
export function ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCD9F20)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) === 1) return 0

  const pPlayerRoom = UNITS_GetRoom113c(m, pPlayerUnit >>> 0) >>> 0
  if (pPlayerRoom === 0) return 0

  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  if (pQuest === 0) return 0
  while ((m.u32(pQuest) | 0) !== 0x17) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return 0
  }

  const pCustom = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const pDiabloRoom = m.u32((pCustom + 0x3c) >>> 0) >>> 0
  let bNear = 0
  if (pPlayerRoom === pDiabloRoom) {
    bNear = 1
  } else {
    const sp = m.alloc(8) >>> 0
    const pnRoomsNear = sp
    const ppRoomsNear = (sp + 4) >>> 0
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pPlayerRoom, ppRoomsNear, pnRoomsNear)
    const nRooms = m.u32(pnRoomsNear) >>> 0
    if (nRooms > 0) {
      const targetRoom = m.u32((pCustom + 0x3c) >>> 0) >>> 0
      const pList = m.u32(ppRoomsNear) >>> 0
      for (let i = 0; i < nRooms; i = (i + 1) >>> 0) {
        if ((m.u32((pList + i * 4) >>> 0) >>> 0) === targetRoom) {
          bNear = 1
          break
        }
      }
    }
  }

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 1) === 0 &&
    bNear !== 0
  ) {
    ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c(m, pQuestFlags, pPlayerUnit >>> 0, pGame >>> 0)
  }
  return 0
}

/**
 * Completes Act 4 Quest 3 (`0x1A` / Diablo) for `pPlayerUnit` (`edx`) in `pGame` (`ecx`) if quest `0x1A`
 * bit `0` is unset and `pPlayerUnit` is currently in Act 4 (`bAct == 3`).
 *
 * @va D2Game:0x6FCDA010
 */
export function ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): void {
  hitD2GameVa113c(0x6FCDA010)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) === 1) return

  const pRoom = UNITS_GetRoom113c(m, pPlayerUnit >>> 0) >>> 0
  if (pRoom === 0) return

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const bAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (bAct === 3) {
    ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c(m, pQuestFlags, pPlayerUnit >>> 0, pGame >>> 0)
  }
}

/**
 * Propagates Act 4 Quest 1 (`0x19` / Izual) completion failure (`0x6FCD94F0`) to all members of
 * `pPlayerUnit`'s (`edx`) sub-party in `pGame` (`ecx`) when `pPlayerUnit` has quest `0x19` bit `13` (`0x0D`) set.
 *
 * @va D2Game:0x6FCDA180
 */
export function ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCDA180)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0x0d) !== 0 && (pPlayerUnit >>> 0) !== 0) {
    const pUnitGame = m.u32((pPlayerUnit + 0x80) >>> 0) >>> 0
    if (pUnitGame !== 0 && m.u32(pPlayerUnit >>> 0) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlayerUnit >>> 0, pUnitGame) & 0xffff
      if (wPartyId !== 0xffff) {
        PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
          m,
          pGame >>> 0,
          wPartyId,
          ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c,
          0,
        )
      }
    }
  }
  return 0
}

/**
 * Matches `pUnit`'s (`ebx`) target coordinates against the 3 Chaos Sanctuary seal boss spawn coords
 * (`pQuest17->pCustom + 0x24`, `+0x2C`, `+0x34`), spawns the corresponding SuperUnique preset (`pDataTables + 0xB28..0xB2C`,
 * type `2`), or schedules retry timer event `7` after `10` frames if spawning returns `0`.
 *
 * @va D2Game:0x6FCDBC00
 */
export function ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCDBC00)
  const pCoord = m.alloc(8) >>> 0
  PATH_GetTargetTypeAndPosition113c(m, pUnit >>> 0, pCoord)

  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return
  let pQuest = m.u32(pQuestCtrl) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x17) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }

  const pCustom = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const coordX = m.u32(pCoord) | 0
  const coordY = m.u32((pCoord + 4) >>> 0) | 0

  let pSealCoord = 0
  let nPresetTableOff = 0
  if (
    coordX === (m.u32((pCustom + 0x24) >>> 0) | 0) &&
    coordY === (m.u32((pCustom + 0x28) >>> 0) | 0)
  ) {
    pSealCoord = (pCustom + 0x24) >>> 0
    nPresetTableOff = 0xb28
  } else if (
    coordX === (m.u32((pCustom + 0x2c) >>> 0) | 0) &&
    coordY === (m.u32((pCustom + 0x30) >>> 0) | 0)
  ) {
    pSealCoord = (pCustom + 0x2c) >>> 0
    nPresetTableOff = 0xb2a
  } else if (
    coordX === (m.u32((pCustom + 0x34) >>> 0) | 0) &&
    coordY === (m.u32((pCustom + 0x38) >>> 0) | 0)
  ) {
    pSealCoord = (pCustom + 0x34) >>> 0
    nPresetTableOff = 0xb2c
  } else {
    return
  }

  const pDataTablesPtr = m.u32(SGPT_DATATABLES_6FD1829C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  const nPlaceId = pDataTables !== 0 ? m.u16((pDataTables + nPresetTableOff) >>> 0) : 0
  const pSpawned =
    QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c(
      m,
      nPlaceId,
      2,
      pSealCoord,
      pGame >>> 0,
      pUnit >>> 0,
    ) >>> 0
  if (pSpawned === 0) {
    const retryFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 0x0a) >>> 0
    EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 7, retryFrame, 0, 0, 0)
  }
}

/**
 * Searches `pUnit`'s (`ecx`) inventory (`grid 0` then `belt/grid 2`) for an auto-stackable compatible
 * weapon stack (`ebx = pItem`) with remaining capacity (`curQty < maxStack`), writing remaining stack
 * capacity to `pnOutFreeSpace` (`[esp+4]`) and returning the matching stack item (or `0` when none).
 *
 * @va D2Game:0x6FCDC6B0
 */
export function ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pItem: number,
  pnOutFreeSpace: number,
): number {
  hitD2GameVa113c(0x6FCDC6B0)
  m.setU32(pnOutFreeSpace >>> 0, 1)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) return 0
  if (ITEMS_GetTwoHandedFlag113c(m, pItem >>> 0) === 0) return 0
  if (ITEMS_IsAutoStack113c(m, pItem >>> 0) === 0) return 0

  let maxStack = ITEMS_GetTotalMaxStack113c(m, pItem >>> 0) | 0

  let pCand = INVENTORY_FindStackableCompatItemInGrid0_113c(m, pInventory, pItem >>> 0, 0) >>> 0
  while (pCand !== 0) {
    if (ITEMS_AreStackableWeaponsCompatible113c(m, pItem >>> 0, pCand) !== 0) {
      const curQty = STATLIST_GetUnitStat113c(m, pCand, 0x46, 0) | 0
      maxStack = ITEMS_GetTotalMaxStack113c(m, pCand) | 0
      if (curQty < maxStack) {
        m.setU32(pnOutFreeSpace >>> 0, ((maxStack - curQty) | 0) >>> 0)
        return pCand
      }
    }
    pCand = INVENTORY_FindStackableCompatItemInGrid0_113c(m, pInventory, pItem >>> 0, pCand) >>> 0
  }

  let pCand2 = INVENTORY_FindStackableCompatItemInBelt113c(m, pInventory, pItem >>> 0, 0) >>> 0
  while (pCand2 !== 0) {
    if (ITEMS_AreStackableWeaponsCompatible113c(m, pItem >>> 0, pCand2) !== 0) {
      const curQty = STATLIST_GetUnitStat113c(m, pCand2, 0x46, 0) | 0
      maxStack = ITEMS_GetTotalMaxStack113c(m, pCand2) | 0
      if (curQty < maxStack) {
        m.setU32(pnOutFreeSpace >>> 0, ((maxStack - curQty) | 0) >>> 0)
        return pCand2
      }
    }
    pCand2 = INVENTORY_FindStackableCompatItemInBelt113c(m, pInventory, pItem >>> 0, pCand2) >>> 0
  }

  m.setU32(pnOutFreeSpace >>> 0, maxStack >>> 0)
  return 0
}
