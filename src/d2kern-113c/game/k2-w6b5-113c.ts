/**
 * Diablo II v1.13c `D2Game.dll` Wave 6 Batch 5 (`w6b5`):
 * 45 functions in `0x6FCB2BB0..0x6FCED6D0`.
 */

import type { Memory113c } from '../mem/sparse-memory'
import {
  COLLISION_FindFreePositionWithStep113c,
  COLLISION_ResetMaskWithPattern113c,
} from '../common/collision'
import {
  UNITS_GetObjectPortalFlags113c,
  UNITS_GetPlayerData113c,
  UNITS_SetObjectPortalFlags113c,
} from '../common/composit'
import {
  DRLG_GetActNoFromLevelId113c,
  ENV_ResetDefaultEnvironment113c,
} from '../common/drlg/drlg'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_FindFreeSpawnPositionInLevel113c,
  DUNGEON_FindRoomBySubtileCoordinates113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomExFromRoom113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32 } from '../common/int-math'
import {
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CountEquippedOrCarryItems113c,
  ITEMS_GetInvPage113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_Compute113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetNumberOfPathPoints113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_RefreshUnitCollisionPattern113c,
  PATH_SetStepNum113c,
  PATH_SetTargetUnit113c,
  PATH_SetType113c,
} from '../common/path'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetClassSkillCount113c,
  SKILLS_GetClassSkillId113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetParam1113c,
  SKILLS_GetParam2113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_IsSelectableCorpseWithVelocity113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetSkillLevelOnUnit113c,
  STATES_UpdateOrClearState98Transform113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
} from '../common/statlist'
import {
  ANIMSEQ_GetUnitSeqFrameDataField8_113c,
  ANIMSEQ_GetUnitSeqRecordPtr113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
  UNITS_SetUnitUpdateFlags113c,
  UNIT_GetAlignment113c,
} from '../common/unit'
import { SEED_InitLowSeed113c } from '../prng'
import { DATATBLS_GetMonLvlTxtRecord113c } from '../tables/datatbls-113c'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c'
import {
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  MONSTER_InitModeChangeStrc113c,
} from './ai-fallen-113c'
import {
  MONSTER_ApplyElementalDamageAndResistStats113c,
  NET_QueuePacketToClientBuffer113c,
} from './boot-init-gap-a-113c'
import {
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_PACKET_SendPlayerPartyRelationship113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import { C2S_CheckCoordDeltaExceeded113c } from './c2s-packet-113c'
import {
  AI_IdleWander113c as AI_IdleWanderMem113c,
  AI_Stall113c as AI_StallMem113c,
  MONSTER_StartMode113c as MONSTER_StartModeMem113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ExecuteEvents113c,
} from './combat-a1c-113c'
import {
  AI_ApproachTarget113c,
  SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c,
} from './k2-real-s2c-combat-113c'
import {
  SKILLS_GetFlags113c,
  UNITS_GetDistanceToCoordinates113c,
} from './replay-kernel-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import { PACKET_CheckUnitsInDifferentActs113c } from './k2-combat-core-w1-113c'
import { SKILLS_TriggerSkillOnTarget113c } from './k2-gap-itemdef-113c'
import {
  MISSILE_CreateServerProjectile113c,
  SKILLS_ResolveChargedSrvMissileId113c,
} from './k2-gap-melee-dot-113c'
import {
  MONSTER_GetAiGeneralPtr_6FC218E0_113c,
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import {
  DRLG_PopulateSingleRoom_6FC4CB80_113c,
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { OBJECTS_OperateContainer_6FC56B90_113c } from './k2-laneK-0x6fc5-w1-113c'
import {
  MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c,
  QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
} from './k2-w2b1-113c'
import { NET_SendPacket15B_TransactionResult_6FCAAC90_113c } from './k2-w2b3-113c'
import { SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c } from './k2-w2b4-113c'
import {
  MONAI_InventoryContainsItemPointer_6FCCC9E0_113c,
  MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c,
} from './k2-w2b5-113c'
import {
  ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c,
  ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c,
  ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c,
  ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c,
} from './k2-w2b7-113c'
import {
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c,
} from './k2-w3b7-113c'
import { UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c } from './k2-w3b8-113c'
import { ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c } from './k2-w4b3-113c'
import {
  NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c,
  SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c,
  SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c,
} from './k2-w4b5-113c'
import {
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
} from './k2-w4b6-113c'
import {
  ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c,
  ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c,
  ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c,
  ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c,
  ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c,
} from './k2-w4b8-113c'
import {
  ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
  NPC_DeductPlayerGoldAndStash_6FCDCC60_113c,
} from './k2-w5b4-113c'
import {
  ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c,
  ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c,
  ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c,
  ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c,
  ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c,
  ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c,
  ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c,
  ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c,
} from './k2-w5b5-113c'
import {
  A5Q4_OpenTemplePortalObject_6FCE94E0_113c,
  AIBAAL_TrySpawnBaalClone_6FCD7D30_113c,
  AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c,
  AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c,
  C2S_ValidateInventoryOrCursorItem_6FCECE20_113c,
  MONREG_SelectRegionMonsterTypes_6FCEA760_113c,
  SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c,
  SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c,
  SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c,
} from './k2-w5b6-113c'
import {
  ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c,
  ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
  SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c,
  SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c,
  SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c,
  SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c,
} from './k2-w5b7-113c'
import {
  PARTY_DispatchRelationAction_6FD10A70_113c,
  PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c,
  SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c,
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c,
} from './k2-w5b9-113c'
import { AI_CircleStrafeTarget_6FD126B0_113c } from './k2-w5b10-113c'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONREG_GenerateOutfitVariants113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_ValidateClassId113c,
  MONSTER_AddSkillToUnit113c,
  MONSTER_GetBaseIdFromUnit113c,
  MONSTER_ScheduleInitialAiEvent113c,
  MONSTER_SpawnAtCoords113c,
  REGPOP_FindPackSpawnCoords113c,
  ROOM_FindRoomContainingSubtile113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_AllocUnitData113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { SUNIT_FreeUnit113c } from './replay-final11-113c'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel'
import { AI_StepRelativeToTargetUnit113c } from './town-npc-ai-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

const D2COMMON_SGPT_DATA_TABLES_PTR_VA = 0x6fde9e1c
let k2W6B5StackPtr = 0x7e440000

function allocScratch(size: number): number {
  const aligned = (size + 7) & ~7
  k2W6B5StackPtr = (k2W6B5StackPtr - aligned) >>> 0
  return k2W6B5StackPtr
}

function freeScratch(size: number): void {
  const aligned = (size + 7) & ~7
  k2W6B5StackPtr = (k2W6B5StackPtr + aligned) >>> 0
}

function getSgptDataTablesPtr(m: D2KernMemory113c): number {
  const iatVal = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0) >>> 0
  if (iatVal === D2COMMON_SGPT_DATA_TABLES_PTR_VA) {
    return m.u32(D2COMMON_SGPT_DATA_TABLES_PTR_VA) >>> 0
  }
  if (iatVal !== 0) {
    const deref = m.u32(iatVal) >>> 0
    if (deref !== 0 && m.u32((iatVal + 0xb98) >>> 0) === 0 && m.u32((iatVal + 0xa78) >>> 0) === 0) {
      return deref
    }
    return iatVal
  }
  return m.u32(D2COMMON_SGPT_DATA_TABLES_PTR_VA) >>> 0
}

function stepSeed64At113c(m: D2KernMemory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, newHi)
  m.setU32(pSeed >>> 0, newLo)
  return newLo
}

/**
 * [1/45] Rolls melee hit and allocates kick + progressive charge finish combat.
 * @va D2Game:0x6FCB2BB0
 * @dll D2Game.dll
 * @va 0x6FCB2BB0
 * @ordinalOrName SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0
 */
export function SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pSkillsTxt: number,
  nSkillLevel: number,
  bForceKnockbackFlags: number,
): number {
  hitD2GameVa113c(0x6FCB2BB0)
  const att = pAttacker >>> 0
  const def = pDefender >>> 0
  const game = pGame >>> 0
  const skillId = nSkillId | 0
  const slvl = nSkillLevel | 0
  const nToHit =
    ((SKILLS_GetSkillToHitBonus113c(m, att, skillId, slvl) | 0) +
      (STATLIST_GetUnitStat113c(m, att, 0x145, 0) | 0)) |
    0
  const pDmg = allocScratch(0x70)
  try {
    for (let i = 0; i < 0x1c; i += 1) m.setU32((pDmg + i * 4) >>> 0, 0)
    let wFlags = SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, att, def, game, nToHit, 0) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wFlags)
    if ((wFlags & 1) !== 0) {
      if ((bForceKnockbackFlags | 0) !== 0) {
        wFlags = (wFlags | 0x0c) & 0xffff
        m.setU16((pDmg + 0x04) >>> 0, wFlags)
      }
      let pRow = 0
      if (skillId >= 0) {
        const pTables = getSgptDataTablesPtr(m)
        if (pTables !== 0 && skillId < (m.u32((pTables + 0xba0) >>> 0) | 0)) {
          const pBase = m.u32((pTables + 0xb98) >>> 0) >>> 0
          pRow = (pBase + imul32(skillId, 0x23c)) >>> 0
        }
      }
      let physPct = 0
      if (pRow !== 0 && slvl > 0) {
        physPct = ((m.u32((pRow + 0x148) >>> 0) | 0) + imul32((slvl - 1) | 0, (m.u32((pRow + 0x14c) >>> 0) | 0))) | 0
      }
      m.setU32((pDmg + 0x0c) >>> 0, physPct)
      SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c(m, att, game, pDmg, def, skillId, slvl)
    }
    let srcDam = m.u8(((pSkillsTxt >>> 0) + 0x1a5) >>> 0)
    m.setU32((pDmg + 0x60) >>> 0, 1)
    if (srcDam === 0) srcDam = 0x80
    return SUNITDMG_AllocCombat113c(m, game, att, def, pDmg, srcDam) >>> 0
  } finally {
    freeScratch(0x70)
  }
}

/**
 * [2/45] Steps unit PRNG and spawns a charged spiral nova ring of projectiles.
 * @va D2Game:0x6FCB4E60
 * @dll D2Game.dll
 * @va 0x6FCB4E60
 * @ordinalOrName SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60
 */
export function SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB4E60)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const slvl = nSkillLevel | 0
  const nLowSeed = stepSeed64At113c(m, (unit + 0x20) >>> 0)
  if (skillId < 0) return 0
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = ((m.u32((pTables + 0xb98) >>> 0) >>> 0) + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, unit) | 0
  if (nMissileId <= 0) return 0
  const pCoords = allocScratch(8)
  try {
    m.setU32(pCoords, 0)
    m.setU32((pCoords + 4) >>> 0, 0)
    if ((SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, unit, game, pCoords, (pCoords + 4) >>> 0) | 0) === 0) {
      return 0
    }
    let nStep = SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c(m, unit, skillId, slvl) | 0
    if (nStep === 0) {
      nStep = SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x64) >>> 0), skillId, slvl) | 0
    }
    const nX = (m.u32(pCoords) | 0)
    const nY = (m.u32((pCoords + 4) >>> 0) | 0)
    SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c(
      m,
      nLowSeed,
      game,
      unit,
      nMissileId,
      nX,
      nY,
      skillId,
      slvl,
      nStep,
    )
    return 1
  } finally {
    freeScratch(8)
  }
}

/**
 * [3/45] Steps unit PRNG and spawns a charged guided nova ring of projectiles.
 * @va D2Game:0x6FCB4F50
 * @dll D2Game.dll
 * @va 0x6FCB4F50
 * @ordinalOrName SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50
 */
export function SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB4F50)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const slvl = nSkillLevel | 0
  const nLowSeed = stepSeed64At113c(m, (unit + 0x20) >>> 0)
  if (skillId < 0) return 0
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = ((m.u32((pTables + 0xb98) >>> 0) >>> 0) + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, unit) | 0
  if (nMissileId <= 0) return 0
  const pCoords = allocScratch(8)
  try {
    m.setU32(pCoords, 0)
    m.setU32((pCoords + 4) >>> 0, 0)
    if ((SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, unit, game, pCoords, (pCoords + 4) >>> 0) | 0) === 0) {
      return 0
    }
    let nStep = SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c(m, unit, skillId, slvl) | 0
    if (nStep === 0) {
      nStep = SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x64) >>> 0), skillId, slvl) | 0
    }
    const nX = (m.u32(pCoords) | 0)
    const nY = (m.u32((pCoords + 4) >>> 0) | 0)
    SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c(
      m,
      nLowSeed,
      game,
      unit,
      nMissileId,
      nX,
      nY,
      skillId,
      slvl,
      nStep,
    )
    return 1
  } finally {
    freeScratch(8)
  }
}

/**
 * [4/45] Fires a charged channeled projectile on frame interval and rewinds anim if state 12 active.
 * @va D2Game:0x6FCB5560
 * @dll D2Game.dll
 * @va 0x6FCB5560
 * @ordinalOrName SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560
 */
export function SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB5560)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const slvl = nSkillLevel | 0
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, skillId) >>> 0
  if (pSkill === 0) return 0
  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, unit) | 0
  if (nMissileId < 0) return 0
  const nPeriod = ((SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c(m, unit, skillId, slvl) | 0) - 1) | 0
  if (nPeriod <= 0) return 0
  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) & 0xffffffbf) >>> 0)
  }
  const pScratch = allocScratch(0x68)
  try {
    const pOutX = pScratch
    const pOutY = (pScratch + 4) >>> 0
    const pParams = (pScratch + 8) >>> 0
    m.setU32(pOutX, 0)
    m.setU32(pOutY, 0)
    if ((SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, unit, game, pOutX, pOutY) | 0) === 0) {
      return 0
    }
    const nNextFrame = SKILLS_GetParam1113c(m, pSkill) | 0
    const dwCurFrame = (m.u32((game + 0xa8) >>> 0) | 0)
    let nFired = 0
    if (nNextFrame < dwCurFrame) {
      for (let i = 0; i < 0x17; i += 1) m.setU32((pParams + i * 4) >>> 0, 0)
      m.setU32(pParams, 0x20)
      m.setU32((pParams + 0x04) >>> 0, unit)
      m.setU32((pParams + 0x08) >>> 0, unit)
      m.setU32((pParams + 0x10) >>> 0, nMissileId)
      m.setU32((pParams + 0x1c) >>> 0, (m.u32(pOutX) | 0))
      m.setU32((pParams + 0x20) >>> 0, (m.u32(pOutY) | 0))
      m.setU32((pParams + 0x2c) >>> 0, skillId)
      m.setU32((pParams + 0x30) >>> 0, slvl)
      MISSILE_CreateServerProjectile113c(m, game, pParams)
      SKILLS_SetParam1113c(m, pSkill, ((m.u32((game + 0xa8) >>> 0) | 0) + nPeriod) | 0)
      nFired = 1
    }
    if ((STATES_CheckState113c(m, unit, 0x0c) | 0) !== 0) {
      SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c(m, unit, game, 1)
    }
    return nFired
  } finally {
    freeScratch(0x68)
  }
}

/**
 * [5/45] Executes multi-strike melee SrvDo (Zeal / Jab / Fend / Fury) loop, re-target, and combat hit.
 * @va D2Game:0x6FCB9D20
 * @dll D2Game.dll
 * @va 0x6FCB9D20
 * @ordinalOrName SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20
 */
export function SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB9D20)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const slvl = nSkillLevel | 0
  if (skillId < 0) return 0
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = ((m.u32((pTables + 0xb98) >>> 0) >>> 0) + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, unit) >>> 0
  if (pSkill === 0) return 0

  if ((ANIMSEQ_GetUnitSeqRecordPtr113c(m, unit) >>> 0) !== 0) {
    ANIMSEQ_GetUnitSeqFrameDataField8_113c(m, unit)
  }
  const nLoopFrame = SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c(m, unit) | 0
  const nSavedType = SKILLS_GetParam1113c(m, pSkill) | 0
  const dwSavedId = SKILLS_GetParam2113c(m, pSkill) | 0
  let pTarget = nSavedType === 6 ? 0 : SUNIT_GetServerUnit113c(m, game, nSavedType, dwSavedId) >>> 0
  const dwFlags = SKILLS_GetFlags113c(m, pSkill) >>> 0

  if ((dwFlags & 1) !== 0) {
    const nAdder0 = unit !== 0 && m.u32(unit) === 1 && (dwFlags & 2) !== 0 ? 3 : 0
    if (pTarget !== 0 && (UNITS_CanUnitMeleeAttackTarget113c(m, unit, pTarget, nAdder0) | 0) !== 0) {
      SKILLS_SetParam0C113c(m, pSkill, 0)
      SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c(m, unit, game, (nLoopFrame + 1) | 0)
      UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, unit, skillId)
      return 1
    }
    if ((dwFlags & 2) !== 0) {
      SKILLS_SetParam0C113c(m, pSkill, 0)
      UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, unit, skillId)
      const pNear = SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c(m, game, dwSavedId, unit) >>> 0
      if (pNear !== 0 && (UNITS_CanUnitMeleeAttackTarget113c(m, unit, pNear, 0) | 0) !== 0) {
        SKILLS_SetParam1113c(m, pSkill, (m.u32(pNear) | 0))
        SKILLS_SetParam2113c(m, pSkill, (m.u32((pNear + 0x0c) >>> 0) | 0))
        return 1
      }
      if (unit !== 0) {
        if (m.u32(unit) === 1) {
          const c1 = MONSTATS_ValidateClassId113c(m, MONSTER_GetBaseIdFromUnit113c(m, unit) | 0) | 0
          if (c1 === 0x1b4) {
            const c2 = MONSTATS_ValidateClassId113c(m, MONSTER_GetBaseIdFromUnit113c(m, unit) | 0) | 0
            if (c2 === 0x1b9) return 0
          }
        }
        let pEv = m.u32((unit + 0xdc) >>> 0) >>> 0
        while (pEv !== 0) {
          const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
          if (m.u8(pEv) === 1) EVENT_FreeNode113c(m, game, pEv)
          pEv = pNext
        }
      }
      EVENT_SetEventFull113c(m, game, unit, 1, (m.u32((game + 0xa8) >>> 0) + 1) >>> 0, 0, 0, 0)
      return 0
    }
    const elapsed = ((m.u32((game + 0xa8) >>> 0) | 0) - ((m.u32((unit + 0x44) >>> 0) | 0) >> 8)) | 0
    if (elapsed >= nLoopFrame) {
      SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c(m, unit, game, 0)
      SKILLS_SetParam0C113c(m, pSkill, 1)
    }
    let pEv = m.u32((unit + 0xdc) >>> 0) >>> 0
    while (pEv !== 0) {
      const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
      if (m.u8(pEv) === 0) EVENT_FreeNode113c(m, game, pEv)
      pEv = pNext
    }
    EVENT_SetEventFull113c(m, game, unit, 0, (m.u32((game + 0xa8) >>> 0) + 1) >>> 0, 0, 1, 0)
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) & 0xffffffbf) >>> 0)
    return 1
  }

  SKILLS_SetParam0C113c(m, pSkill, 0)
  SKILLS_SetParam1113c(m, pSkill, 0)
  SKILLS_SetParam2113c(m, pSkill, 0)
  UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, unit, skillId)
  SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c(m, unit, game, nLoopFrame)
  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  if (pTarget === 0) {
    pTarget = SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c(m, game, -1, unit) >>> 0
    if (pTarget === 0) {
      if (unit !== 0) {
        let pEv = m.u32((unit + 0xdc) >>> 0) >>> 0
        while (pEv !== 0) {
          const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
          if (m.u8(pEv) === 1) EVENT_FreeNode113c(m, game, pEv)
          pEv = pNext
        }
      }
      EVENT_SetEventFull113c(m, game, unit, 1, (m.u32((game + 0xa8) >>> 0) + 1) >>> 0, 0, 0, 0)
      return 0
    }
  }
  const nAdder = unit !== 0 && m.u32(unit) === 1 ? 3 : 0
  if (
    (UNITS_CanUnitMeleeAttackTarget113c(m, unit, pTarget, nAdder) | 0) !== 0 &&
    (SUNIT_IsDeadOrDying113c(m, unit) | 0) === 0
  ) {
    const pDmg = allocScratch(0x70)
    try {
      for (let i = 0; i < 0x1c; i += 1) m.setU32((pDmg + i * 4) >>> 0, 0)
      if (unit !== 0 && m.u32(unit) === 0) {
        const toHit = SKILLS_GetSkillToHitBonus113c(m, unit, skillId, slvl) | 0
        const wHit = (SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, unit, pTarget, game, toHit, 0) | 8) & 0xffff
        m.setU16((pDmg + 0x04) >>> 0, wHit)
      } else {
        m.setU16((pDmg + 0x04) >>> 0, 9)
      }
      m.setU32(
        (pDmg + 0x0c) >>> 0,
        SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x138) >>> 0), skillId, slvl) | 0,
      )
      const eType = m.u8((pSkillsTxt + 0x1dc) >>> 0)
      if (eType > 0) {
        const convPct =
          SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x144) >>> 0), skillId, slvl) | 0
        m.setU32((pDmg + 0x68) >>> 0, convPct)
        if (convPct > 0) m.setU8((pDmg + 0x65) >>> 0, m.u8((pSkillsTxt + 0x1dc) >>> 0))
      }
      SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, unit, pDmg, slvl)
      if (unit !== 0 && m.u32(unit) === 1) {
        const mc = MONSTATS_ValidateClassId113c(m, (m.u32((unit + 0x04) >>> 0) | 0)) | 0
        const bMode = mc === 0x49 ? 8 : mc === 0xd3 || mc === 0x1b4 ? 5 : 4
        MONSTER_ApplyElementalDamageAndResistStats113c(m, game, unit, bMode)
      }
      m.setU32((pDmg + 0x60) >>> 0, 0x70)
      SUNITDMG_AllocCombat113c(m, game, unit, pTarget, pDmg, m.u8((pSkillsTxt + 0x1a5) >>> 0))
      SUNITDMG_ExecuteEvents113c(m, game, unit, pTarget, 1, 0)
      STATES_SetMonsterSkillIconOnUnit113c(m, pTarget, 0x93, 0)
    } finally {
      freeScratch(0x70)
    }
  }
  return 1
}

function readUnitCoordX_113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  const t = (m.u32(u) | 0)
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (t === 2 || (t > 3 && t <= 5)) {
    return (m.u32((pPath + 0x0c) >>> 0) | 0)
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function readUnitCoordY_113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  const t = (m.u32(u) | 0)
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (t === 2 || (t > 3 && t <= 5)) {
    return (m.u32((pPath + 0x10) >>> 0) | 0)
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

/**
 * [6/45] Drains queued player GUIDs on join, initializes party relations, and sends packet 0x8D.
 * @va D2Game:0x6FCBC6F0
 * @dll D2Game.dll
 * @va 0x6FCBC6F0
 * @ordinalOrName PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0
 */
export function PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pJoinQueue: number,
): void {
  hitD2GameVa113c(0x6FCBC6F0)
  const game = pGame >>> 0
  const queue = pJoinQueue >>> 0
  if (queue === 0) {
    throw new D2CommonAssertError('PlrIntro.cpp', 0x95)
  }
  let pNode = m.u32((queue + 0x04) >>> 0) >>> 0
  while (pNode !== 0) {
    const dwPlayerGuid = m.u32(pNode) >>> 0
    if (game === 0) {
      throw new D2CommonAssertError('PlrIntro.cpp', 0x2d3)
    }
    const bucket = dwPlayerGuid & 0x7f
    let pPlayer = m.u32((game + bucket * 4 + 0x1120) >>> 0) >>> 0
    while (pPlayer !== 0 && (m.u32((pPlayer + 0x0c) >>> 0) >>> 0) !== dwPlayerGuid) {
      pPlayer = m.u32((pPlayer + 0xe4) >>> 0) >>> 0
    }
    if (pPlayer === 0) {
      throw new D2CommonAssertError('PlrIntro.cpp', 0x9a)
    }
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      game,
      PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c,
      pPlayer,
    )
    D2GAME_PACKET_SendPlayerPartyRelationship113c(m, pPlayer, pPlayer)
    pNode = m.u32((pNode + 0x04) >>> 0) >>> 0
  }
}

/**
 * [7/45] Respecs all class skills on a player, refunding base skill points to stat 5 and syncing.
 * @va D2Game:0x6FCC1280
 * @dll D2Game.dll
 * @va 0x6FCC1280
 * @ordinalOrName SKILLS_RespecPlayerClassSkills_6FCC1280
 */
export function SKILLS_RespecPlayerClassSkills_6FCC1280_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCC1280)
  const unit = pPlayer >>> 0
  if (unit === 0 || m.u32(unit) !== 0) return
  const nCharClass = (m.u32((unit + 0x04) >>> 0) | 0)
  const nCount = SKILLS_GetClassSkillCount113c(m, nCharClass) | 0
  let nRefundPts = 0
  for (let i = 0; i < nCount; i = (i + 1) | 0) {
    const nSkillId = SKILLS_GetClassSkillId113c(m, nCharClass, i) | 0
    const pSkill = SKILLS_GetSkillById113c(m, unit, nSkillId, -1) >>> 0
    if (pSkill !== 0) {
      const nBase = SKILLS_EvaluateSkillLevel113c(m, unit, pSkill, 0) | 0
      nRefundPts = (nRefundPts + nBase) | 0
      MONSTER_AddSkillToUnit113c(m, 0, nSkillId, unit, 1)
      let pClient = 0
      if (m.u32(unit) === 0) {
        const pPlrData = UNITS_GetPlayerData113c(m, unit) >>> 0
        pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
      }
      NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c(m, pClient, unit, nSkillId & 0xffff, 0, 1)
    }
  }
  STATLIST_AddUnitStatMemPort113c(m, unit, 5, nRefundPts, 0)
  ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c(m, unit)
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame >>> 0, unit, 0)
  UNITS_SetUnitUpdateFlags113c(m, unit, 1)
}

/**
 * [8/45] Spawns and links the destination portal object in `nDestLevelId` for `pSourcePortal`.
 * @va D2Game:0x6FCC22E0
 * @dll D2Game.dll
 * @va 0x6FCC22E0
 * @ordinalOrName PORTAL_CreateLinkedDestinationPortal_6FCC22E0
 */
export function PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSourcePortal: number,
  nDestLevelId: number,
  nSourceLevelId: number,
): number {
  hitD2GameVa113c(0x6FCC22E0)
  const game = pGame >>> 0
  const srcPortal = pSourcePortal >>> 0
  const destLvl = nDestLevelId | 0
  const srcLvl = nSourceLevelId | 0
  const actNo = DRLG_GetActNoFromLevelId113c(m, destLvl) & 0xff
  const ppAct = (game + actNo * 4 + 0xbc) >>> 0
  const pScratch = allocScratch(0x18)
  try {
    const pOutX = pScratch
    const pOutY = (pScratch + 4) >>> 0
    const pCoord = (pScratch + 8) >>> 0
    const ppRoom = (pScratch + 16) >>> 0
    m.setU32(pOutX, 0)
    m.setU32(pOutY, 0)
    let pDestRoom =
      DUNGEON_FindFreeSpawnPositionInLevel113c(m, m.u32(ppAct) >>> 0, destLvl, 0x0b, pOutX, pOutY, 3) >>> 0
    const pOrigRoom = pDestRoom
    m.setU32(ppRoom, pDestRoom)
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pDestRoom, game)
    let pDestPortal = 0
    if (pDestRoom !== 0) {
      m.setU32(pCoord, (m.u32(pOutX) | 0))
      m.setU32((pCoord + 4) >>> 0, (m.u32(pOutY) | 0))
      if (srcLvl === 0x49) {
        if ((ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c(m, game, pCoord, ppRoom) | 0) !== 0) {
          pDestRoom =
            ROOM_FindRoomContainingSubtile113c(
              m,
              m.u32(ppRoom) >>> 0,
              (m.u32(pCoord) | 0),
              (m.u32((pCoord + 4) >>> 0) | 0),
            ) >>> 0
        } else {
          pDestRoom = m.u32(ppRoom) >>> 0
        }
      }
      if (pDestRoom === 0) {
        pDestRoom = pOrigRoom
        m.setU32(pCoord, (m.u32(pOutX) | 0))
        m.setU32((pCoord + 4) >>> 0, (m.u32(pOutY) | 0))
      }
      let pSpawnRoom = pDestRoom
      if ((COLLISION_FindFreePositionWithStep113c(m, pDestRoom, pCoord, 3, 0xbe11, 5) | 0) === 0) {
        const pRetry =
          DUNGEON_FindFreeSpawnPositionInLevel113c(m, m.u32(ppAct) >>> 0, destLvl, 0x0b, pOutX, pOutY, 3) >>> 0
        pSpawnRoom = pRetry !== 0 ? pRetry : pOrigRoom
      }
      const nSpawnX = (m.u32(pCoord) | 0)
      const nSpawnY = (m.u32((pCoord + 4) >>> 0) | 0)
      const nClassId = srcPortal !== 0 ? (m.u32((srcPortal + 0x04) >>> 0) | 0) : -1
      pDestPortal = SUNIT_AllocUnitData113c(m, 2, nClassId, nSpawnX, nSpawnY, game, pSpawnRoom, 1, 2, 0) >>> 0
    }
    if (pDestPortal === 0) {
      const dwGuid = srcPortal !== 0 ? (m.u32((srcPortal + 0x0c) >>> 0) | 0) : -1
      const pSrcRoom = UNITS_GetRoom113c(m, srcPortal) >>> 0
      DUNGEON_AddRoomPortalNode113c(m, pSrcRoom, 2, dwGuid)
      SUNIT_FreeUnit113c(m, game, srcPortal)
      return 0
    }
    const nLinkLvl = DUNGEON_GetLevelIdFromRoom113c(m, UNITS_GetRoom113c(m, srcPortal) >>> 0) | 0
    if (nLinkLvl > 0xff) {
      throw new D2CommonAssertError('SkillSrv.cpp', 0xe2b)
    }
    const pObjData = m.u32((pDestPortal + 0x14) >>> 0) >>> 0
    m.setU8((pObjData + 0x04) >>> 0, nLinkLvl & 0xff)
    const nPortalFlags = (UNITS_GetObjectPortalFlags113c(m, pDestPortal) | 3) & 0xff
    UNITS_SetObjectPortalFlags113c(m, pDestPortal, nPortalFlags)
    UNITS_ChangeAnimMode113c(m, pDestPortal, 2)
    SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c(m, srcPortal, pDestPortal)
    STATES_UpdateOrClearState98Transform113c(m, srcPortal, pDestPortal)
    STATES_UpdateOrClearState98Transform113c(m, pDestPortal, srcPortal)
    return pDestPortal
  } finally {
    freeScratch(0x18)
  }
}

/**
 * [9/45] Scales elapsed animation frames and reschedules anim events on `pUnit`.
 * @va D2Game:0x6FCC35D0
 * @dll D2Game.dll
 * @va 0x6FCC35D0
 * @ordinalOrName SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0
 */
export function SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nSlowPct: number,
): void {
  hitD2GameVa113c(0x6FCC35D0)
  const unit = pUnit >>> 0
  if (unit === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xa2a)
  }
  const pGame = m.u32((unit + 0x80) >>> 0) >>> 0
  SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c(m, unit, pGame, nSlowPct | 0)
}

/**
 * [10/45] Evaluates all players, party units, mercs, and decoys to pick the highest-threat AI target.
 * @va D2Game:0x6FCC4610
 * @dll D2Game.dll
 * @va 0x6FCC4610
 * @ordinalOrName AITARGET_FindBestHostileTarget_6FCC4610
 */
export function AITARGET_FindBestHostileTarget_6FCC4610_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttackerUnit: number,
  pOutBestScore: number,
  pOutCandidateCount: number,
  pTetherCoords: number,
  pfnFilter: ((m: D2KernMemory113c, pAttacker: number, pPlayer: number) => number) | number,
): number {
  hitD2GameVa113c(0x6FCC4610)
  const game = pGame >>> 0
  const att = pAttackerUnit >>> 0
  const tether = pTetherCoords >>> 0
  if (pfnFilter === 0) {
    throw new D2CommonAssertError('AiTarget.cpp', 0x37a)
  }
  UNITS_GetRoom113c(m, att)
  const attX = readUnitCoordX_113c(m, att)
  const attY = readUnitCoordY_113c(m, att)
  const bAttAct = m.u8((att + 0x18) >>> 0)
  let nBestScore = 0
  let nCandidateCount = 0
  let pBestUnit = 0

  let pSlotAddr = (game + 0x10f8) >>> 0
  let pNode = m.u32(pSlotAddr) >>> 0
  for (let slot = 0; slot < 8; slot = (slot + 1) | 0) {
    if (pNode !== 0) {
      const pPlayer = m.u32(pNode) >>> 0
      if (pPlayer === 0 || m.u32(pPlayer) !== 0) {
        throw new D2CommonAssertError('AiTarget.cpp', 0x395)
      }
      const pass = typeof pfnFilter === 'function' ? pfnFilter(m, att, pPlayer) | 0 : 1
      if (pass !== 0) {
        const mode = (m.u32((pPlayer + 0x10) >>> 0) | 0)
        let score =
          mode === 0x11 || mode === 0
            ? 0
            : AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c(m, tether, pPlayer, att) | 0
        if (nBestScore < score) {
          nBestScore = score
          pBestUnit = pPlayer
        }
        nCandidateCount = (nCandidateCount + 1) | 0
        pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
        while (pNode !== 0) {
          const pSub = m.u32(pNode) >>> 0
          score = AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c(m, tether, pSub, att) | 0
          if (nBestScore < score) {
            nBestScore = score
            pBestUnit = pSub
          }
          nCandidateCount = (nCandidateCount + 1) | 0
          pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
        }
      }
    }
    pSlotAddr = (pSlotAddr + 4) >>> 0
    pNode = m.u32(pSlotAddr) >>> 0
  }

  while (pNode !== 0) {
    const pMerc = m.u32(pNode) >>> 0
    if (m.u8((pMerc + 0x18) >>> 0) === bAttAct) {
      const score = AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c(m, tether, pMerc, att) | 0
      if (nBestScore < score) {
        nBestScore = score
        pBestUnit = pMerc
      }
      nCandidateCount = (nCandidateCount + 1) | 0
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }

  pNode = m.u32((pSlotAddr + 4) >>> 0) >>> 0
  let nBestDecoyScore = 0
  let pBestDecoy = 0
  while (pNode !== 0) {
    const pDecoy = m.u32(pNode) >>> 0
    if (m.u8((pDecoy + 0x18) >>> 0) === bAttAct) {
      const score = AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c(m, tether, pDecoy, att) | 0
      if (nBestDecoyScore < score) {
        nBestDecoyScore = score
        pBestDecoy = pDecoy
      }
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }

  if (pBestDecoy !== 0) {
    const dx = readUnitCoordX_113c(m, pBestDecoy)
    const dy = readUnitCoordY_113c(m, pBestDecoy)
    if ((UNITS_GetDistanceToCoordinates113c(dx, dy, attX, attY) | 0) < 5) {
      if ((UNITS_CanUnitMeleeAttackTarget113c(m, att, pBestUnit, 0) | 0) === 0) {
        const pPath = m.u32((att + 0x2c) >>> 0) >>> 0
        PATH_SetTargetUnit113c(m, pPath, pBestUnit)
        PATH_SetType113c(m, pPath, 2)
        PATH_Compute113c(m, pPath, att, 0)
        if ((PATH_GetNumberOfPathPoints113c(m, pPath) | 0) === 0) {
          pBestUnit = pBestDecoy
          nBestScore = nBestDecoyScore
        }
      }
    }
  }

  m.setU32(pOutCandidateCount >>> 0, nCandidateCount)
  m.setU32(pOutBestScore >>> 0, nBestScore)
  return pBestUnit >>> 0
}

/**
 * [11/45] Identifies `pTargetItem` in `pPlayer`'s inventory via Scroll/Tome of Identify pSpell.
 * @va D2Game:0x6FCCDAC0
 * @dll D2Game.dll
 * @va 0x6FCCDAC0
 * @ordinalOrName ITEMS_SpellIdentifyInventoryItem_6FCCDAC0
 */
export function ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pScrollItem: number,
  pTargetItem: number,
  _nX = 0,
  _nY = 0,
  _nParam = 0,
): number {
  hitD2GameVa113c(0x6FCCDAC0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const item = pTargetItem >>> 0
  if (m.u8((player + 0x6c) >>> 0) !== 0 && m.u32((player + 0x68) >>> 0) === 0) {
    const dwInteractGuid = (m.u32((player + 0x64) >>> 0) | 0)
    if ((SUNIT_GetServerUnit113c(m, game, 0, dwInteractGuid) >>> 0) !== 0) return 0
  }
  if ((ITEMS_CheckCommandFlags113c(m, item, 0x10) | 0) !== 0) return 0
  if ((MONAI_InventoryContainsItemPointer_6FCCC9E0_113c(m, player, item) | 0) === 0) return 0
  ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c(m, player, item, game)
  return 1
}

/**
 * [12/45] Evaluates chance-to-cast item proc stat and triggers skill on target or path coords.
 * @va D2Game:0x6FCCDBF0
 * @dll D2Game.dll
 * @va 0x6FCCDBF0
 * @ordinalOrName ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0
 */
export function ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c(
  m: D2KernMemory113c,
  pOwnerUnit: number,
  pTargetUnit: number,
  _pDmg: number,
  dwStatAndLayer: number,
  _dwExtra = 0,
): number {
  hitD2GameVa113c(0x6FCCDBF0)
  const owner = pOwnerUnit >>> 0
  if (owner === 0) return 0
  const packed = dwStatAndLayer >>> 0
  const nChance = STATLIST_GetUnitStatWithLayer113c(m, owner, packed >>> 16, packed & 0xffff) | 0
  if (nChance <= 0) return 0
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0) return 0
  const nShift = m.u32((pTables + 0xc6c) >>> 0) & 0x1f
  const dwLvlMask = m.u32((pTables + 0xc70) >>> 0) >>> 0
  const rawLayer = packed & 0xffff
  const nSkillLvl = (rawLayer & dwLvlMask) | 0
  const nSkillId = rawLayer >> nShift
  const newLo = stepSeed64At113c(m, (owner + 0x20) >>> 0)
  if ((newLo % 100) >= (nChance >>> 0)) return 0
  if (nSkillId < 0 || nSkillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = ((m.u32((pTables + 0xb98) >>> 0) >>> 0) + imul32(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const target = pTargetUnit >>> 0
  if (target === 0) {
    const pPath = m.u32((owner + 0x2c) >>> 0) >>> 0
    const y = PATH_GetFirstPointY113c(m, pPath) | 0
    const x = PATH_GetFirstPointX113c(m, pPath) | 0
    SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c(m, owner, y, nSkillId, nSkillLvl, x, 0)
    return 1
  }
  SKILLS_TriggerSkillOnTarget113c(m, target, owner, nSkillId, nSkillLvl, 0)
  return 1
}

/**
 * [13/45] Evaluates melee-gated chance-to-cast item proc (`pDmg == 0` or `pDmg->dwHitFlags & 0x20`).
 * @va D2Game:0x6FCCDDC0
 * @dll D2Game.dll
 * @va 0x6FCCDDC0
 * @ordinalOrName ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0
 */
export function ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c(
  m: D2KernMemory113c,
  pOwnerUnit: number,
  pTargetUnit: number,
  pDmg: number,
  dwStatAndLayer: number,
  _dwExtra = 0,
): number {
  hitD2GameVa113c(0x6FCCDDC0)
  const owner = pOwnerUnit >>> 0
  if (owner === 0) return 0
  const packed = dwStatAndLayer >>> 0
  const nChance = STATLIST_GetUnitStatWithLayer113c(m, owner, packed >>> 16, packed & 0xffff) | 0
  if (nChance <= 0) return 0
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0) return 0
  const nShift = m.u32((pTables + 0xc6c) >>> 0) & 0x1f
  const dwLvlMask = m.u32((pTables + 0xc70) >>> 0) >>> 0
  const rawLayer = packed & 0xffff
  const nSkillLvl = (rawLayer & dwLvlMask) | 0
  const nSkillId = rawLayer >> nShift
  const dmg = pDmg >>> 0
  if (dmg !== 0 && (m.u8(dmg) & 0x20) === 0) return 0
  const newLo = stepSeed64At113c(m, (owner + 0x20) >>> 0)
  if ((newLo % 100) >= (nChance >>> 0)) return 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0
  if (pSkillsTxt === 0) return 0
  const dl = m.u8((pSkillsTxt + 0x07) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0
  const mask5 = pMasks !== 0 ? m.u8((pMasks + 0x14) >>> 0) : 0x20
  const target = pTargetUnit >>> 0
  if ((dl & mask5) !== 0) {
    if (target !== 0) {
      SKILLS_TriggerSkillOnTarget113c(m, target, target, nSkillId, nSkillLvl, 0)
    }
    return 1
  }
  if (target !== 0) {
    SKILLS_TriggerSkillOnTarget113c(m, target, owner, nSkillId, nSkillLvl, 1)
    return 1
  }
  const pPath = m.u32((owner + 0x2c) >>> 0) >>> 0
  const y = PATH_GetFirstPointY113c(m, pPath) | 0
  const x = PATH_GetFirstPointX113c(m, pPath) | 0
  SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c(m, owner, y, nSkillId, nSkillLvl, x, 1)
  return 1
}

/**
 * [14/45] Casts Fireball (`0x2F`, level 1) at `(nX, nY)` when `pItem` has a valid Items.txt record.
 * @va D2Game:0x6FCCDEE0
 * @dll D2Game.dll
 * @va 0x6FCCDEE0
 * @ordinalOrName ITEMS_SpellCastFireballAtCoords_6FCCDEE0
 */
export function ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pPlayer: number,
  pItem: number,
  _pTargetItem: number,
  nX: number,
  nY: number,
  _nParam = 0,
): void {
  hitD2GameVa113c(0x6FCCDEE0)
  const item = pItem >>> 0
  const nItemId = item !== 0 ? (m.u32((item + 0x04) >>> 0) | 0) : -1
  if ((DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0) === 0) return
  SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c(
    m,
    pPlayer >>> 0,
    nY & 0xffff,
    0x2f,
    1,
    nX & 0xffff,
    0,
  )
}

/**
 * [15/45] Casts Fireball (`0x2F`, level 1) at `pPlayer`'s validated path target unit or first path point.
 * @va D2Game:0x6FCCDF20
 * @dll D2Game.dll
 * @va 0x6FCCDF20
 * @ordinalOrName ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20
 */
export function ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pItem: number,
  _pTargetItem = 0,
  _nX = 0,
  _nY = 0,
  _nParam = 0,
): void {
  hitD2GameVa113c(0x6FCCDF20)
  const item = pItem >>> 0
  const player = pPlayer >>> 0
  const nItemId = item !== 0 ? (m.u32((item + 0x04) >>> 0) | 0) : -1
  if ((DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0) === 0) return
  SUNIT_ValidatePathTargetUnit113c(m, player, pGame >>> 0)
  const pPath = m.u32((player + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget !== player && pTarget !== 0) {
    SKILLS_TriggerSkillOnTarget113c(m, pTarget, player, 0x2f, 1, 0)
    return
  }
  const y = PATH_GetFirstPointY113c(m, pPath) | 0
  const x = PATH_GetFirstPointX113c(m, pPath) | 0
  SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c(m, player, y, 0x2f, 1, x, 0)
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

/**
 * [16/45] Reanimates `pCorpseUnit` as friendly monster `nMonClassId` bound to player `dwOwnerPlayerGuid`.
 * @va D2Game:0x6FCCE200
 * @dll D2Game.dll
 * @va 0x6FCCE200
 * @ordinalOrName ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200
 */
export function ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCorpseUnit: number,
  _dwArg2: number,
  _dwArg3: number,
  nMonClassId: number,
  dwOwnerPlayerGuid: number,
): number {
  hitD2GameVa113c(0x6FCCE200)
  const game = pGame >>> 0
  const corpse = pCorpseUnit >>> 0
  if (corpse === 0 || m.u32(corpse) !== 1) return 0
  if (game === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x2d3)
  }
  const ownerGuid = dwOwnerPlayerGuid >>> 0
  let pOwner = m.u32((game + (ownerGuid & 0x7f) * 4 + 0x1120) >>> 0) >>> 0
  while (pOwner !== 0 && (m.u32((pOwner + 0x0c) >>> 0) >>> 0) !== ownerGuid) {
    pOwner = m.u32((pOwner + 0xe4) >>> 0) >>> 0
  }
  if (pOwner === 0) return 0
  if ((SKILLS_IsSelectableCorpseWithVelocity113c(m, corpse, 0) | 0) === 0) return 0
  const monClass = nMonClassId | 0
  if (monClass < 0) return 0
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || monClass >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return 0

  const cx = UNIT_GetPosX113c(m, corpse) | 0
  const cy = UNIT_GetPosY113c(m, corpse) | 0
  const pRoom = ROOM_FindRoomContainingSubtile113c(m, UNITS_GetRoom113c(m, corpse) >>> 0, cx, cy) >>> 0
  if (pRoom === 0) return 0
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, monClass) >>> 0
  if (pMonStats2 === 0) return 0

  COLLISION_ResetMaskWithPattern113c(
    m,
    UNITS_GetRoom113c(m, corpse) >>> 0,
    UNIT_GetPosX113c(m, corpse) | 0,
    UNIT_GetPosY113c(m, corpse) | 0,
    PATH_GetUnitCollisionPattern113c(m, corpse) | 0,
    0x8000,
  )
  const pSpawned = MONSTER_SpawnAtCoords113c(m, monClass, 1, game, pRoom, cx, cy, -1, 0x4a) >>> 0
  if (pSpawned === 0) return 0

  m.setU32((pSpawned + 0xc4) >>> 0, (m.u32((pSpawned + 0xc4) >>> 0) | 0x0402000e) >>> 0)
  const pSpawnAiGen = MONSTER_GetAiGeneralPtr_6FC218E0_113c(m, pSpawned) >>> 0
  AI_InitMonsterAiThinkFn113c(m, pSpawned, game, pSpawnAiGen, 0)
  MONSTER_ScheduleInitialAiEvent113c(m, game, pSpawned)

  const ownerType = m.u32(pOwner) >>> 0
  const ownerId = m.u32((pOwner + 0x0c) >>> 0) >>> 0
  if (m.u32(pSpawned) === 1) {
    const pMonData = m.u32((pSpawned + 0x14) >>> 0) >>> 0
    const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
    m.setU32((pAiGen + 0x2c) >>> 0, ownerId)
    m.setU32((pAiGen + 0x30) >>> 0, ownerType)
    m.setU32((pAiGen + 0x28) >>> 0, game)
  }
  MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c(m, pSpawned, pOwner)

  let pEv = m.u32((pSpawned + 0xdc) >>> 0) >>> 0
  while (pEv !== 0) {
    const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
    if (m.u8(pEv) === 2) EVENT_FreeNode113c(m, game, pEv)
    pEv = pNext
  }
  EVENT_SetEventFull113c(m, game, pSpawned, 2, (m.u32((game + 0xa8) >>> 0) + 0x19) >>> 0, 0, 0, 0)
  SUNIT_SetMonsterAlignmentState113c(m, pSpawned, 2, 0)
  m.setU32((pSpawned + 0xc4) >>> 0, (m.u32((pSpawned + 0xc4) >>> 0) | 0x80000000) >>> 0)
  STATES_ToggleGfxStateFlag113c(m, pSpawned, 0x60, 1)
  MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pSpawned, 0x15, game, 0)
  EVENT_SetEventFull113c(m, game, pSpawned, 7, (m.u32((game + 0xa8) >>> 0) + 0x5dc) >>> 0, 0, 0, 0)
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(m, game, pSpawned, (m.u32((pOwner + 0xd0) >>> 0) | 0), 0)
  PATH_RefreshUnitCollisionPattern113c(m, pSpawned)

  if (m.u8((pMonStats2 + 0x10b) >>> 0) === 0x0e) {
    const pModeArgs = allocScratch(0x20)
    try {
      MONSTER_InitModeChangeStrc113c(m, pSpawned, pModeArgs, 0x0e)
      const pSeqSkill = SKILLS_GetSkillById113c(m, pSpawned, 0x9e, -1) >>> 0
      SKILLS_SetUsedSkillMemPort113c(m, pSpawned, pSeqSkill)
      PATH_SetStepNum113c(m, m.u32((pSpawned + 0x2c) >>> 0) >>> 0, 1)
      m.setU32((pModeArgs + 0x08) >>> 0, 0)
      m.setU32((pModeArgs + 0x0c) >>> 0, cx)
      m.setU32((pModeArgs + 0x10) >>> 0, cy)
      MONSTER_StartModeMem113c(m, game, pSpawned, 0x0e, 0, cx, cy)
    } finally {
      freeScratch(0x20)
    }
  }
  STATES_ToggleGfxStateFlag113c(m, pSpawned, 0x76, 1)
  STATES_ToggleGfxStateFlag113c(m, corpse, 0xad, 1)
  return 1
}

/**
 * [17/45] Evaluates hostile targets with 75-subtile tether radius (`0x6FCD6DA0`) for Baal / Act 5 boss AI.
 * @va D2Game:0x6FCD7090
 * @dll D2Game.dll
 * @va 0x6FCD7090
 * @ordinalOrName AITARGET_FindBestHostileTargetTether75_6FCD7090
 */
export function AITARGET_FindBestHostileTargetTether75_6FCD7090_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttackerUnit: number,
  pOutBestScore: number,
  pOutCandidateCount: number,
  pTetherCoords: number,
  pfnFilter: ((m: D2KernMemory113c, pAttacker: number, pPlayer: number) => number) | number,
): number {
  hitD2GameVa113c(0x6FCD7090)
  const game = pGame >>> 0
  const att = pAttackerUnit >>> 0
  const tether = pTetherCoords >>> 0
  if (pfnFilter === 0) {
    throw new D2CommonAssertError('AiBaal.cpp', 0x9e)
  }
  const attX = readUnitCoordX_113c(m, att)
  const attY = readUnitCoordY_113c(m, att)
  const bAttAct = m.u8((att + 0x18) >>> 0)
  let nBestScore = 0
  let nCandidateCount = 0
  let pBestUnit = 0

  let pSlotAddr = (game + 0x10f8) >>> 0
  let pNode = m.u32(pSlotAddr) >>> 0
  for (let slot = 0; slot < 8; slot = (slot + 1) | 0) {
    if (pNode !== 0) {
      const pPlayer = m.u32(pNode) >>> 0
      if (pPlayer === 0 || m.u32(pPlayer) !== 0) {
        throw new D2CommonAssertError('AiBaal.cpp', 0xb3)
      }
      const pass = typeof pfnFilter === 'function' ? pfnFilter(m, att, pPlayer) | 0 : 1
      if (pass !== 0) {
        const mode = (m.u32((pPlayer + 0x10) >>> 0) | 0)
        let score =
          mode === 0x11 || mode === 0
            ? 0
            : AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c(m, tether, pPlayer, att) | 0
        if (nBestScore < score) {
          nBestScore = score
          pBestUnit = pPlayer
        }
        nCandidateCount = (nCandidateCount + 1) | 0
        pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
        while (pNode !== 0) {
          const pSub = m.u32(pNode) >>> 0
          score = AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c(m, tether, pSub, att) | 0
          if (nBestScore < score) {
            nBestScore = score
            pBestUnit = pSub
          }
          nCandidateCount = (nCandidateCount + 1) | 0
          pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
        }
      }
    }
    pSlotAddr = (pSlotAddr + 4) >>> 0
    pNode = m.u32(pSlotAddr) >>> 0
  }

  while (pNode !== 0) {
    const pMerc = m.u32(pNode) >>> 0
    if (m.u8((pMerc + 0x18) >>> 0) === bAttAct) {
      const score = AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c(m, tether, pMerc, att) | 0
      if (nBestScore < score) {
        nBestScore = score
        pBestUnit = pMerc
      }
      nCandidateCount = (nCandidateCount + 1) | 0
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }

  pNode = m.u32((pSlotAddr + 4) >>> 0) >>> 0
  let nBestDecoyScore = 0
  let pBestDecoy = 0
  while (pNode !== 0) {
    const pDecoy = m.u32(pNode) >>> 0
    if (m.u8((pDecoy + 0x18) >>> 0) === bAttAct) {
      const score = AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c(m, tether, pDecoy, att) | 0
      if (nBestDecoyScore < score) {
        nBestDecoyScore = score
        pBestDecoy = pDecoy
      }
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }

  if (pBestDecoy !== 0) {
    const dx = readUnitCoordX_113c(m, pBestDecoy)
    const dy = readUnitCoordY_113c(m, pBestDecoy)
    if ((UNITS_GetDistanceToCoordinates113c(dx, dy, attX, attY) | 0) < 5) {
      if ((UNITS_CanUnitMeleeAttackTarget113c(m, att, pBestUnit, 0) | 0) === 0) {
        const pPath = m.u32((att + 0x2c) >>> 0) >>> 0
        PATH_SetTargetUnit113c(m, pPath, pBestUnit)
        PATH_SetType113c(m, pPath, 2)
        PATH_Compute113c(m, pPath, att, 0)
        if ((PATH_GetNumberOfPathPoints113c(m, pPath) | 0) === 0) {
          pBestUnit = pBestDecoy
          nBestScore = nBestDecoyScore
        }
      }
    }
  }

  m.setU32(pOutCandidateCount >>> 0, nCandidateCount)
  m.setU32(pOutBestScore >>> 0, nBestScore)
  return pBestUnit >>> 0
}

/**
 * [18/45] Executes Baal / Uber Baal AI command actions (`1..15` jump table at `0x6FCD8420`).
 * @va D2Game:0x6FCD8070
 * @dll D2Game.dll
 * @va 0x6FCD8070
 * @ordinalOrName AIBAAL_ExecuteCommandAction_6FCD8070
 */
export function AIBAAL_ExecuteCommandAction_6FCD8070_113c(
  m: D2KernMemory113c,
  pTargetUnit: number,
  pMonster: number,
  nActionCode: number,
  pGame: number,
  pAiControl: number,
  pApproachCoords: number,
): void {
  hitD2GameVa113c(0x6FCD8070)
  const mon = pMonster >>> 0
  const target = pTargetUnit >>> 0
  const game = pGame >>> 0
  let cmd = nActionCode | 0

  while (true) {
    if (mon === 0) return
    const nClassId = (m.u32((mon + 0x04) >>> 0) | 0)
    if (nClassId < 0) return
    const pTables = getSgptDataTablesPtr(m)
    if (pTables === 0 || nClassId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return
    const pMonStatsTxt = ((m.u32((pTables + 0xa78) >>> 0) >>> 0) + imul32(nClassId, 0x1a8)) >>> 0
    if (pMonStatsTxt === 0) return

    switch (cmd) {
      case 1: {
        const diff = m.u8((game + 0x6d) >>> 0)
        const delay = diff === 1 ? 0x0f : diff === 2 ? 5 : 0x23
        AI_StallMem113c(m, game, mon, delay)
        return
      }
      case 2:
      case 6: {
        AI_StepRelativeToTargetUnit113c(m, game, mon, target, 0x0c, 2, 0)
        return
      }
      case 3: {
        AI_CircleStrafeTarget_6FD126B0_113c(m, mon, 1, game, target, 6)
        return
      }
      case 4: {
        AI_IdleWanderMem113c(m, game, mon, 0x10)
        return
      }
      case 5: {
        const coords = pApproachCoords >>> 0
        if (coords === 0) {
          AI_StallMem113c(m, game, mon, 5)
          return
        }
        AI_ApproachTarget113c(
          m,
          game,
          mon,
          0,
          2,
          (m.u32((coords + 0x0c) >>> 0) | 0),
          (m.u32((coords + 0x10) >>> 0) | 0),
          1,
          0,
        )
        return
      }
      case 7: {
        AI_StallMem113c(m, game, mon, 5)
        return
      }
      case 8: {
        if (target === 0) {
          cmd = 0
          break
        }
        const wDefCurse = sx16(m.u16((pMonStatsTxt + 0x17a) >>> 0))
        if (wDefCurse > 0) {
          const maxMana = STATLIST_GetMaxManaFromUnit113c(m, target) | 0
          const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, target) | 0
          if (maxLife > maxMana || m.u32(target) !== 0) {
            const mode = m.u8((pMonStatsTxt + 0x185) >>> 0)
            AI_CastSkillWithMode113c(m, mode, mon, game, wDefCurse, target, 0, 0)
            return
          }
        }
        const wBloodMana = sx16(m.u16((pMonStatsTxt + 0x17c) >>> 0))
        if (wBloodMana > 0 && m.u32(target) === 0) {
          const mode = m.u8((pMonStatsTxt + 0x186) >>> 0)
          AI_CastSkillWithMode113c(m, mode, mon, game, wBloodMana, target, 0, 0)
        }
        return
      }
      case 9: {
        AI_CastSkillWithMode113c(m, 9, mon, game, 0x13b, target, 0, 0)
        return
      }
      case 10: {
        AI_StartAttackMode113c(m, 5, mon, game, target)
        return
      }
      case 11: {
        SKILLS_SetSkillLevelOnUnit113c(m, mon, 0x13c, 1, 0, 0, 0)
        AI_CastSkillWithMode113c(m, 0x0a, mon, game, 0x13c, target, 0, 0)
        return
      }
      case 12: {
        AI_CastSkillWithMode113c(m, 8, mon, game, 0x13d, target, 0, 0)
        return
      }
      case 13: {
        AI_CastSkillWithMode113c(m, 4, mon, game, 0x13e, target, 0, 0)
        return
      }
      case 14: {
        if (target === 0) {
          cmd = 0
          break
        }
        const monX = UNIT_GetPosX113c(m, mon) | 0
        const monY = UNIT_GetPosY113c(m, mon) | 0
        const tgtX = UNIT_GetPosX113c(m, target) | 0
        const tgtY = UNIT_GetPosY113c(m, target) | 0
        let dist = UNITS_GetApproximateDistance113c(m, mon, target) | 0
        if (dist === 0) dist = 1
        const destX = (monX + Math.trunc(imul32((monX - tgtX) | 0, 0x19) / dist)) | 0
        const destY = (monY + Math.trunc(imul32((monY - tgtY) | 0, 0x19) / dist)) | 0
        const curClass = (m.u32((mon + 0x04) >>> 0) | 0)
        if (curClass === 0x2c5) {
          const wTpSkill = sx16(m.u16((pMonStatsTxt + 0x178) >>> 0))
          const tpMode = m.u8((pMonStatsTxt + 0x184) >>> 0)
          AI_CastSkillWithMode113c(m, tpMode, mon, game, wTpSkill, 0, tgtX, tgtY)
          return
        }
        const pCoords = allocScratch(8)
        let ok = 0
        let outX = 0
        let outY = 0
        try {
          m.setU32(pCoords, destX)
          m.setU32((pCoords + 4) >>> 0, destY)
          ok =
            REGPOP_FindPackSpawnCoords113c(
              m,
              UNITS_GetRoom113c(m, mon) >>> 0,
              game,
              0,
              curClass,
              pCoords,
              (pCoords + 4) >>> 0,
              0,
            ) | 0
          outX = (m.u32(pCoords) | 0)
          outY = (m.u32((pCoords + 4) >>> 0) | 0)
        } finally {
          freeScratch(8)
        }
        if (ok === 0) {
          cmd = 0
          break
        }
        const wTpSkill = sx16(m.u16((pMonStatsTxt + 0x178) >>> 0))
        const tpMode = m.u8((pMonStatsTxt + 0x184) >>> 0)
        AI_CastSkillWithMode113c(m, tpMode, mon, game, wTpSkill, 0, outX, outY)
        return
      }
      case 15: {
        AIBAAL_TrySpawnBaalClone_6FCD7D30_113c(m, mon, game, pAiControl >>> 0)
        AI_StallMem113c(m, game, mon, 5)
        return
      }
      default: {
        AI_StallMem113c(m, game, mon, 5)
        return
      }
    }
  }
}

/**
 * [19/45] Updates Act 4 Quest 2 (Hellforge) state and broadcasts alerts when item/NPC `0xF6` triggers.
 * @va D2Game:0x6FCD9DE0
 * @dll D2Game.dll
 * @va 0x6FCD9DE0
 * @ordinalOrName ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0
 */
export function ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCD9DE0)
  const quest = pQuest >>> 0
  const pTarget = m.u32(((pQuestArg >>> 0) + 0x08) >>> 0) >>> 0
  if (pTarget === 0 || m.u16((pTarget + 0x04) >>> 0) !== 0xf6) return
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8((pState + 0x02) >>> 0) !== 1) return
  if (m.u8((pState + 0x1c) >>> 0) !== 0) {
    m.setU8((quest + 0x0b) >>> 0, 4)
  } else {
    m.setU8((quest + 0x0b) >>> 0, 1)
  }
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((quest + 0x04) >>> 0) >>> 0,
    ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c,
    0,
    0,
  )
  m.setU8((quest + 0x14) >>> 0, 0)
  m.setU8((pState + 0x02) >>> 0, 0)
  m.setU32((quest + 0xa8) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((quest + 0x04) >>> 0) >>> 0,
    ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c,
    0,
    0,
  )
}

/**
 * [20/45] Initializes the Hellforge object animation mode from Act 4 Quest 2 (`0x18`) state.
 * @va D2Game:0x6FCD9E80
 * @dll D2Game.dll
 * @va 0x6FCD9E80
 * @ordinalOrName ACT4Q2_InitHellforgeObject_6FCD9E80
 */
export function ACT4Q2_InitHellforgeObject_6FCD9E80_113c(
  m: D2KernMemory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FCD9E80)
  const init = pObjInit >>> 0
  const pGame = m.u32(init) >>> 0
  const pChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pChain !== 0 ? m.u32(pChain) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x18) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0 || m.u8((pQuest + 0x09) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((init + 0x04) >>> 0) >>> 0, 3)
    return
  }
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, m.u32((init + 0x04) >>> 0) >>> 0, m.u16(pState))
  const bQ = m.u8((pQuest + 0x0b) >>> 0)
  if (bQ === 0x0d || bQ === 2 || bQ === 3) return
  m.setU8((pQuest + 0x14) >>> 0, 0)
  m.setU8((pQuest + 0x0b) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c,
    0,
    0,
  )
}

/**
 * [21/45] Advances Act 4 Quest 1 (`0x16`, Izual) to state 2 and sends quest alert when Plains of Despair entered.
 * @va D2Game:0x6FCDA080
 * @dll D2Game.dll
 * @va 0x6FCDA080
 * @ordinalOrName ACT4Q1_OnPlainsOfDespairEntered_6FCDA080
 */
export function ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCDA080)
  const pChain = m.u32(((pGame >>> 0) + 0x10f4) >>> 0) >>> 0
  let pQuest = pChain !== 0 ? m.u32(pChain) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x16) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0 || m.u8((pQuest + 0x09) >>> 0) === 0) return
  if (m.u8((pQuest + 0x0b) >>> 0) >= 2) return
  m.setU8((pQuest + 0x14) >>> 0, 0)
  m.setU8((pQuest + 0x0b) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c,
    0,
    0,
  )
}

/**
 * [22/45] Updates Act 4 Quest 1 state to 1 and broadcasts alert when Tyrael (`0x16F`) is spoken to.
 * @va D2Game:0x6FCDA100
 * @dll D2Game.dll
 * @va 0x6FCDA100
 * @ordinalOrName ACT4Q1_OnTyraelTalkCallback_6FCDA100
 */
export function ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCDA100)
  const quest = pQuest >>> 0
  const pNpc = m.u32(((pQuestArg >>> 0) + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0x16f) return
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8((pState + 0x11) >>> 0) !== 1) return
  m.setU8((quest + 0x0b) >>> 0, 1)
  m.setU8((quest + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((quest + 0x04) >>> 0) >>> 0,
    ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c,
    0,
    0,
  )
  m.setU8((pState + 0x11) >>> 0, 0)
  m.setU32((quest + 0xa8) >>> 0, 0)
}

/**
 * [23/45] Quest timer callback for Act 4 Quest 1 that spawns Izual's spirit (`0x196`, mode 8) and sends alert.
 * @va D2Game:0x6FCDA960
 * @dll D2Game.dll
 * @va 0x6FCDA960
 * @ordinalOrName ACT4Q1_TimerSpawnIzualSpirit_6FCDA960
 */
export function ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c(
  m: D2KernMemory113c,
  pGame: number,
  pQuest: number,
): number {
  hitD2GameVa113c(0x6FCDA960)
  const game = pGame >>> 0
  const quest = pQuest >>> 0
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8((quest + 0x0c) >>> 0) === 4) {
    const bQ = m.u8((quest + 0x0b) >>> 0)
    if (bQ !== 4 && bQ !== 0x0d) {
      m.setU8((quest + 0x14) >>> 0, 0)
      m.setU8((quest + 0x0b) >>> 0, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c,
        0,
        0,
      )
    }
  }
  if (m.u8((pState + 0x10) >>> 0) !== 0) {
    const x = (m.u32((pState + 0x04) >>> 0) | 0)
    const y = (m.u32((pState + 0x08) >>> 0) | 0)
    m.setU8((pState + 0x10) >>> 0, 0)
    const pAct3 = m.u32((game + 0xc8) >>> 0) >>> 0
    const pRoom = DUNGEON_FindRoomBySubtileCoordinates113c(m, pAct3, x, y) >>> 0
    if (pRoom !== 0) {
      let pSpirit =
        MONSTER_SpawnAtCoords113c(
          m,
          0x196,
          8,
          game,
          pRoom,
          (m.u32((pState + 0x04) >>> 0) | 0),
          (m.u32((pState + 0x08) >>> 0) | 0),
          -1,
          0,
        ) >>> 0
      if (pSpirit === 0) {
        pSpirit =
          MONSTER_SpawnAtCoords113c(
            m,
            0x196,
            8,
            game,
            pRoom,
            (m.u32((pState + 0x04) >>> 0) | 0),
            (m.u32((pState + 0x08) >>> 0) | 0),
            3,
            0,
          ) >>> 0
        if (pSpirit === 0) {
          MONSTER_SpawnAtCoords113c(
            m,
            0x196,
            8,
            game,
            pRoom,
            (m.u32((pState + 0x04) >>> 0) | 0),
            (m.u32((pState + 0x08) >>> 0) | 0),
            5,
            0,
          )
        }
      }
    }
  }
  m.setU8((pState + 0x0d) >>> 0, 0)
  return 1
}

/**
 * [24/45] Handles Tyrael (`0x16F`) conversation on Act 4 Quest 3, sending alert and opening Harrogath portal.
 * @va D2Game:0x6FCDB1B0
 * @dll D2Game.dll
 * @va 0x6FCDB1B0
 * @ordinalOrName ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0
 */
export function ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCDB1B0)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pNpc = m.u32((arg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0x16f) return
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8(pState) === 1) {
    m.setU8((quest + 0x14) >>> 0, 0)
    m.setU8((quest + 0x0b) >>> 0, 1)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c,
      0,
      0,
    )
    m.setU8(pState, 0)
  }
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  if (
    m.u32((pGame + 0x70) >>> 0) !== 0 &&
    m.u8((pState + 0x44) >>> 0) !== 0 &&
    m.u8((pState + 0x45) >>> 0) === 0
  ) {
    ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c(m, arg, pState)
  }
}

/**
 * [25/45] Kills all living hostile non-Diablo monsters in Chaos Sanctuary (`0x6C`) and syncs quest log.
 * @va D2Game:0x6FCDB3B0
 * @dll D2Game.dll
 * @va 0x6FCDB3B0
 * @ordinalOrName ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0
 */
export function ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c(
  m: D2KernMemory113c,
  pQuestState: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCDB3B0)
  const state = pQuestState >>> 0
  const game = pGame >>> 0
  if (m.u8((state + 0x13) >>> 0) !== 0) return
  m.setU8((state + 0x13) >>> 0, 1)
  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  m.setU8((pQuestCtrl + 0x20) >>> 0, 0x0c)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    game,
    QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
    0,
    0,
  )
  const pAct3 = m.u32((game + 0xc8) >>> 0) >>> 0
  let pRoom = DUNGEON_GetRoomExFromRoom113c(m, pAct3) >>> 0
  while (pRoom !== 0) {
    if ((DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0) === 0x6c) {
      let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
      while (pUnit !== 0) {
        const pNext = m.u32((pUnit + 0xe8) >>> 0) >>> 0
        if (
          (m.u32(pUnit) | 0) === 1 &&
          (m.u32((pUnit + 0x04) >>> 0) | 0) !== 0xf3 &&
          (m.u8((pUnit + 0xc6) >>> 0) & 1) === 0
        ) {
          const mode = (m.u32((pUnit + 0x10) >>> 0) | 0)
          if (mode !== 0 && mode !== 0x0c && (UNIT_GetAlignment113c(m, pUnit) | 0) === 0) {
            SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
            MONSTER_StartModeMem113c(m, game, pUnit, 0, 0, 0, 0)
          }
        }
        pUnit = pNext
      }
    }
    pRoom = m.u32((pRoom + 0x7c) >>> 0) >>> 0
  }
}

/**
 * [26/45] Identifies pending item `dwItemGuid` (`+0x6C` on player data) for `pPlayer`.
 * @va D2Game:0x6FCDDA90
 * @dll D2Game.dll
 * @va 0x6FCDDA90
 * @ordinalOrName NPCS_IdentifyPendingItemForPlayer_6FCDDA90
 */
export function NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwItemGuid: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FCDDA90)
  const player = pPlayer >>> 0
  const game = pGame >>> 0
  const itemGuid = dwItemGuid >>> 0
  const pPlrData = UNITS_GetPlayerData113c(m, player) >>> 0
  if ((m.u32((pPlrData + 0x6c) >>> 0) >>> 0) !== itemGuid) return
  if (game === 0) {
    throw new D2CommonAssertError('NpcTrade.cpp', 0x2d3)
  }
  let pItem = m.u32((game + (itemGuid & 0x7f) * 4 + 0x1720) >>> 0) >>> 0
  while (pItem !== 0 && (m.u32((pItem + 0x0c) >>> 0) >>> 0) !== itemGuid) {
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) return
  if ((ITEMS_CheckCommandFlags113c(m, pItem, 0x10) | 0) === 0) {
    ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c(m, player, pItem, game)
  }
}

/**
 * [27/45] Handles Deckard Cain's Identify All Items action, charging 100g/item if Quest 4 unrescued.
 * @va D2Game:0x6FCDDB10
 * @dll D2Game.dll
 * @va 0x6FCDDB10
 * @ordinalOrName NPCS_CainIdentifyAllItems_6FCDDB10
 */
export function NPCS_CainIdentifyAllItems_6FCDDB10_113c(
  m: D2KernMemory113c,
  dwNpcGuid: number,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCDDB10)
  const player = pPlayer >>> 0
  const game = pGame >>> 0
  const npcGuid = dwNpcGuid >>> 0
  const pInteract =
    m.u8((player + 0x6c) >>> 0) !== 0
      ? SUNIT_GetServerUnit113c(m, game, (m.u32((player + 0x68) >>> 0) | 0), (m.u32((player + 0x64) >>> 0) | 0)) >>> 0
      : 0
  if (game === 0) {
    throw new D2CommonAssertError('NpcTrade.cpp', 0x2d3)
  }
  let pNpc = m.u32((game + (npcGuid & 0x7f) * 4 + 0x1320) >>> 0) >>> 0
  while (pNpc !== 0 && (m.u32((pNpc + 0x0c) >>> 0) >>> 0) !== npcGuid) {
    pNpc = m.u32((pNpc + 0xe4) >>> 0) >>> 0
  }
  if (pNpc === 0 || pInteract !== pNpc) {
    const pClient =
      m.u32(player) === 0 ? m.u32(((UNITS_GetPlayerData113c(m, player) >>> 0) + 0x9c) >>> 0) >>> 0 : 0
    const dwGold = STATLIST_GetUnitStat113c(m, player, 0x0e, 0) | 0
    const pPkt = allocScratch(0x10)
    try {
      for (let i = 0; i < 4; i += 1) m.setU32((pPkt + i * 4) >>> 0, 0)
      m.setU8(pPkt, 0x2a)
      m.setU8((pPkt + 1) >>> 0, 0)
      m.setU8((pPkt + 2) >>> 0, 9)
      m.setU32((pPkt + 7) >>> 0, 0xffffffff)
      m.setU32((pPkt + 0x0b) >>> 0, dwGold)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x0f)
    } finally {
      freeScratch(0x10)
    }
    return
  }

  const npcClass = m.u32((pNpc + 0x04) >>> 0) >>> 0
  if (npcClass > 0x109) {
    if (npcClass !== 0x208) return
  } else if (npcClass !== 0x109) {
    if (npcClass < 0xf4 || npcClass > 0xf6) return
  }

  const nUnid = ITEMS_CountEquippedOrCarryItems113c(m, player) | 0
  if (nUnid === 0) {
    const pClient =
      m.u32(player) === 0 ? m.u32(((UNITS_GetPlayerData113c(m, player) >>> 0) + 0x9c) >>> 0) >>> 0 : 0
    const dwGold = STATLIST_GetUnitStat113c(m, player, 0x0e, 0) | 0
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, 0x2a, 9, dwGold, pClient, -1, 0)
    return
  }

  const pPlrData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diff = m.u8((game + 0x6d) >>> 0)
  const pPlrQuestRec = m.u32((pPlrData + diff * 4 + 0x10) >>> 0) >>> 0
  let bFree = (DRLGWARP_TestRoomTileBit113c(m, pPlrQuestRec, 4, 0) | 0) === 1
  if (!bFree) {
    const pGameQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, player, game) >>> 0
    bFree = (DRLGWARP_TestRoomTileBit113c(m, pGameQuestRec, 4, 1) | 0) === 1
  }
  if (!bFree) {
    const nCost = imul32(nUnid, 0x64)
    if ((NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, player, nCost) | 0) === 0) {
      const pClient =
        m.u32(player) === 0 ? m.u32(((UNITS_GetPlayerData113c(m, player) >>> 0) + 0x9c) >>> 0) >>> 0 : 0
      const dwGold = STATLIST_GetUnitStat113c(m, player, 0x0e, 0) | 0
      NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, 0x2a, 0x0c, dwGold, pClient, -1, 0)
      return
    }
  }

  let pNode = INVENTORY_GetFirstItem113c(m, m.u32((player + 0x60) >>> 0) >>> 0) >>> 0
  while (pNode !== 0) {
    const pNext = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    const nodePos = INVENTORY_GetItemNodePositionOther113c(m, pNode) | 0
    const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
    let eligible = false
    if (nodePos === 1) {
      const page = ITEMS_GetInvPage113c(m, pItem) & 0xff
      eligible = page === 0 || page === 3
    } else if (nodePos === 3) {
      eligible = true
    }
    if (eligible && (ITEMS_CheckCommandFlags113c(m, pItem, 0x10) | 0) === 0) {
      ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c(m, player, pItem, game)
    }
    pNode = pNext
  }

  const pClient =
    m.u32(player) === 0 ? m.u32(((UNITS_GetPlayerData113c(m, player) >>> 0) + 0x9c) >>> 0) >>> 0 : 0
  const dwGold = STATLIST_GetUnitStat113c(m, player, 0x0e, 0) | 0
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, 0x2a, 3, dwGold, pClient, -1, 0)
}

/**
 * [28/45] Act 2 Quest 6 timer callback sending alert `0x0D` if quest state not yet 3/4/5.
 * @va D2Game:0x6FCE58B0
 * @dll D2Game.dll
 * @va 0x6FCE58B0
 * @ordinalOrName ACT2Q6_TimerSendQuest14Alert_6FCE58B0
 */
export function ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pQuest: number,
): number {
  hitD2GameVa113c(0x6FCE58B0)
  const quest = pQuest >>> 0
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  const bQ = m.u8((quest + 0x0b) >>> 0)
  if (bQ !== 5 && bQ !== 4 && bQ !== 3) {
    m.setU8((quest + 0x14) >>> 0, 0)
    m.setU8((quest + 0x0b) >>> 0, 3)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c,
      0,
      0,
    )
  }
  m.setU8(pState, 0)
  return 1
}

/**
 * [29/45] Act 2 Quest 6 NPC dialogue handler for Tyrael (`0xFB`) and Jerhyn (`0xC9`).
 * @va D2Game:0x6FCE5A60
 * @dll D2Game.dll
 * @va 0x6FCE5A60
 * @ordinalOrName ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60
 */
export function ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE5A60)
  const quest = pQuest >>> 0
  const pNpc = m.u32(((pQuestArg >>> 0) + 0x08) >>> 0) >>> 0
  const wNpcId = (pNpc !== 0 ? (m.u32((pNpc + 0x04) >>> 0) | 0) : -1) & 0xffff
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  if (wNpcId === 0xfb) {
    if (m.u8((pState + 0x09) >>> 0) !== 1) return
    m.setU8((quest + 0x14) >>> 0, 0)
    m.setU8((quest + 0x0b) >>> 0, 4)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c,
      0,
      0,
    )
    m.setU8((pState + 0x09) >>> 0, 0)
    m.setU32((quest + 0xa8) >>> 0, 0)
    return
  }
  if (wNpcId !== 0xc9) return
  if (m.u8((pState + 0x08) >>> 0) === 1) {
    m.setU8((quest + 0x14) >>> 0, 0)
    m.setU8((quest + 0x0b) >>> 0, 1)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c,
      0,
      0,
    )
    m.setU8((pState + 0x08) >>> 0, 0)
  } else if (m.u8((pState + 0x0a) >>> 0) === 1) {
    m.setU8((quest + 0x14) >>> 0, 0)
    m.setU8((quest + 0x0b) >>> 0, 6)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c,
      0,
      0,
    )
    m.setU8((pState + 0x0a) >>> 0, 0)
  } else {
    return
  }
  m.setU32((quest + 0xa8) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((quest + 0x04) >>> 0) >>> 0,
    ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c,
    0,
    0,
  )
}

/**
 * [30/45] Act 2 Quest 5 two-stage timer playing Summoner taunt first, then sending alert `0x0C`.
 * @va D2Game:0x6FCE5BE0
 * @dll D2Game.dll
 * @va 0x6FCE5BE0
 * @ordinalOrName ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0
 */
export function ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pQuest: number,
): number {
  hitD2GameVa113c(0x6FCE5BE0)
  const quest = pQuest >>> 0
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8((pState + 0x09) >>> 0) === 0) {
    m.setU8((pState + 0x09) >>> 0, 1)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGame >>> 0,
      ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c,
      0,
      0,
    )
    return 0
  }
  m.setU8((quest + 0x14) >>> 0, 0)
  m.setU8((quest + 0x0b) >>> 0, 4)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((quest + 0x04) >>> 0) >>> 0,
    ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c,
    0,
    0,
  )
  m.setU8((pState + 0x08) >>> 0, 0)
  return 1
}

/**
 * [31/45] Marks Act 2 Quest 4 Arcane Sanctuary portal state and opens portal object `pState+0x38`.
 * @va D2Game:0x6FCE5D10
 * @dll D2Game.dll
 * @va 0x6FCE5D10
 * @ordinalOrName ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10
 */
export function ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c(
  m: D2KernMemory113c,
  pQuestState: number,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FCE5D10)
  const state = pQuestState >>> 0
  const quest = pQuest >>> 0
  const wPrev = m.u16((state + 0x40) >>> 0)
  m.setU8((state + 0x0e) >>> 0, 1)
  if (wPrev === 0) {
    m.setU8((state + 0x46) >>> 0, 1)
  }
  m.setU16((state + 0x40) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((quest + 0x04) >>> 0) >>> 0,
    ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
    0,
    0,
  )
  if (m.u8((state + 0x11) >>> 0) !== 1) return
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const dwObjGuid = m.u32((state + 0x38) >>> 0) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('Act2Q4.cpp', 0x2d3)
  }
  let pObj = m.u32((pGame + (dwObjGuid & 0x7f) * 4 + 0x1520) >>> 0) >>> 0
  while (pObj !== 0 && (m.u32((pObj + 0x0c) >>> 0) >>> 0) !== dwObjGuid) {
    pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
  }
  if (pObj === 0) return
  UNITS_ChangeAnimMode113c(m, pObj, 2)
  UNITS_SetTargetUnitForDynamicUnitEx113c(m, pObj)
}

/**
 * [32/45] Act 2 Quest 4 Drognan (`0xB1`) talk callback advancing quest state to 2 and syncing players.
 * @va D2Game:0x6FCE5DB0
 * @dll D2Game.dll
 * @va 0x6FCE5DB0
 * @ordinalOrName ACT2Q4_OnDrognanTalkCallback_6FCE5DB0
 */
export function ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE5DB0)
  const quest = pQuest >>> 0
  const pNpc = m.u32(((pQuestArg >>> 0) + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0xb1) return
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8((pState + 0x04) >>> 0) !== 1) return
  m.setU8((quest + 0x14) >>> 0, 0)
  m.setU8((quest + 0x0b) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((quest + 0x04) >>> 0) >>> 0,
    ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c,
    0,
    0,
  )
  m.setU8((pState + 0x04) >>> 0, 0)
  m.setU32((quest + 0xa8) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((quest + 0x04) >>> 0) >>> 0,
    ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
    0,
    0,
  )
}

/**
 * [33/45] Act 2 Quest 3 timer callback sending alert `0x0A` when `pQuest+0x0C == 4`.
 * @va D2Game:0x6FCE5E30
 * @dll D2Game.dll
 * @va 0x6FCE5E30
 * @ordinalOrName ACT2Q3_TimerSendQuest11Alert_6FCE5E30
 */
export function ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pQuest: number,
): number {
  hitD2GameVa113c(0x6FCE5E30)
  const quest = pQuest >>> 0
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8((quest + 0x0c) >>> 0) === 4) {
    m.setU8((quest + 0x14) >>> 0, 0)
    m.setU8((quest + 0x0b) >>> 0, 3)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c,
      0,
      0,
    )
  }
  m.setU8((pState + 0x06) >>> 0, 0)
  return 1
}

/**
 * [34/45] Resets Act 2 environment lighting and notifies players via packet `0x53` when Tainted Sun ends.
 * @va D2Game:0x6FCE5E90
 * @dll D2Game.dll
 * @va 0x6FCE5E90
 * @ordinalOrName ACT2Q3_EndTaintedSunEclipse_6FCE5E90
 */
export function ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FCE5E90)
  const game = pGame >>> 0
  const pAct1 = m.u32((game + 0xc0) >>> 0) >>> 0
  if (pAct1 === 0) return
  const pState = m.u32(((pQuest >>> 0) + 0x18) >>> 0) >>> 0
  m.setU8((pState + 0x02) >>> 0, 0)
  ENV_ResetDefaultEnvironment113c(m, m.u32((game + 0xc0) >>> 0) >>> 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    game,
    ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c,
    0,
    0,
  )
}

/**
 * [35/45] Act 2 Quest 1 timer callback sending alert `0x08` when `pQuest+0x0C == 4`.
 * @va D2Game:0x6FCE6010
 * @dll D2Game.dll
 * @va 0x6FCE6010
 * @ordinalOrName ACT2Q1_TimerSendQuest9Alert_6FCE6010
 */
export function ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pQuest: number,
): number {
  hitD2GameVa113c(0x6FCE6010)
  const quest = pQuest >>> 0
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8((quest + 0x0c) >>> 0) === 4) {
    m.setU8((quest + 0x14) >>> 0, 0)
    m.setU8((quest + 0x0b) >>> 0, 3)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c,
      0,
      0,
    )
  }
  m.setU8((pState + 0x0a) >>> 0, 0)
  return 1
}

/**
 * [36/45] Act 2 Quest 1 Atma (`0xB0`) talk callback advancing quest state to 1 and sending alert `0x08`.
 * @va D2Game:0x6FCE61C0
 * @dll D2Game.dll
 * @va 0x6FCE61C0
 * @ordinalOrName ACT2Q1_OnAtmaTalkCallback_6FCE61C0
 */
export function ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE61C0)
  const quest = pQuest >>> 0
  const pNpc = m.u32(((pQuestArg >>> 0) + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0xb0) return
  const pState = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u8((pState + 0x08) >>> 0) !== 1) return
  m.setU8((quest + 0x0b) >>> 0, 1)
  m.setU8((quest + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((quest + 0x04) >>> 0) >>> 0,
    ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c,
    0,
    0,
  )
  m.setU8((pState + 0x08) >>> 0, 0)
  m.setU32((quest + 0xa8) >>> 0, 0)
}

/**
 * [37/45] Initializes Quest `0x0D` temple/sanctuary portal object, arming timer `0x6FCE94E0` or mode 2.
 * @va D2Game:0x6FCE9ED0
 * @dll D2Game.dll
 * @va 0x6FCE9ED0
 * @ordinalOrName QUEST0D_InitTemplePortalObject_6FCE9ED0
 */
export function QUEST0D_InitTemplePortalObject_6FCE9ED0_113c(
  m: D2KernMemory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FCE9ED0)
  void A5Q4_OpenTemplePortalObject_6FCE94E0_113c
  const init = pObjInit >>> 0
  const pGame = m.u32(init) >>> 0
  const pChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pChain === 0) return
  let pQuest = m.u32(pChain) >>> 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pState + 0x04) >>> 0, 1)
  const pObj = m.u32((init + 0x04) >>> 0) >>> 0
  m.setU32((pState + 0x20) >>> 0, pObj !== 0 ? (m.u32((pObj + 0x0c) >>> 0) | 0) : -1)
  if (
    m.u8((pState + 0x0c) >>> 0) !== 0 &&
    m.u8((pState + 0x03) >>> 0) === 0 &&
    m.u8((pState + 0x0b) >>> 0) === 0
  ) {
    QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 1, pQuest, 0x6fce94e0)
    m.setU8((pState + 0x03) >>> 0, 1)
    UNITS_ChangeAnimMode113c(m, m.u32((init + 0x04) >>> 0) >>> 0, 2)
    return
  }
  if (m.u8((pState + 0x0b) >>> 0) !== 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((init + 0x04) >>> 0) >>> 0, 2)
  }
}

/**
 * [38/45] Operates the Horadric Cube (`'box '`) quest chest, dropping missing Cubes, chest tier loot, and gold.
 * @va D2Game:0x6FCEA050
 * @dll D2Game.dll
 * @va 0x6FCEA050
 * @ordinalOrName ACT2Q2_OperateHoradricCubeChest_6FCEA050
 */
export function ACT2Q2_OperateHoradricCubeChest_6FCEA050_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FCEA050)
  const op = pOperateArgs >>> 0
  if ((OBJECTS_OperateContainer_6FC56B90_113c(m, op) | 0) === 0) return 0
  const pObj0 = m.u32((op + 0x04) >>> 0) >>> 0
  m.setU32((pObj0 + 0xb8) >>> 0, 0x20786f62)
  const pGame0 = m.u32(op) >>> 0
  const pChain = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  let pQuest = pChain !== 0 ? m.u32(pChain) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 9) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  const pIlvlScratch = allocScratch(8)
  try {
    m.setU32(pIlvlScratch, 0)
    if (pQuest !== 0) {
      const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
      m.setU32((pState + 0x14) >>> 0, 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(op) >>> 0,
        ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c,
        0,
        m.u32((op + 0x08) >>> 0) >>> 0,
      )
      for (let i = 0; i < (m.u32((pState + 0x14) >>> 0) | 0); i = (i + 1) | 0) {
        const pDropped =
          ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
            m,
            m.u32(op) >>> 0,
            m.u32((op + 0x04) >>> 0) >>> 0,
            2,
            pIlvlScratch,
            0,
            -1,
            1,
          ) >>> 0
        if (pDropped !== 0) {
          m.setU32((pState + 0x20) >>> 0, ((m.u32((pState + 0x20) >>> 0) | 0) + 1) | 0)
          m.setU8((pState + 0x29) >>> 0, 1)
        }
      }
    }
    OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, op, 4)
    const pQuestCtrl = m.u32(((m.u32(op) >>> 0) + 0x10f4) >>> 0) >>> 0
    if (pQuestCtrl === 0) {
      throw new D2CommonAssertError('Quests.cpp', 0x1fb)
    }
    const newLo = stepSeed64At113c(m, (pQuestCtrl + 0x18) >>> 0)
    const nPiles = ((newLo % 5) + 5) | 0
    for (let k = 0; k < nPiles; k = (k + 1) | 0) {
      OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
        m,
        0x20646c67,
        m.u32((op + 0x04) >>> 0) >>> 0,
        m.u32(op) >>> 0,
        2,
      )
    }
    return 0
  } finally {
    freeScratch(8)
  }
}

/**
 * [39/45] Operates the Staff of Kings (`'msf '`) quest chest, dropping identified unique staffs, loot, and gold.
 * @va D2Game:0x6FCEA170
 * @dll D2Game.dll
 * @va 0x6FCEA170
 * @ordinalOrName ACT2Q2_OperateStaffOfKingsChest_6FCEA170
 */
export function ACT2Q2_OperateStaffOfKingsChest_6FCEA170_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FCEA170)
  const op = pOperateArgs >>> 0
  if ((OBJECTS_OperateContainer_6FC56B90_113c(m, op) | 0) === 0) return 0
  const pObj0 = m.u32((op + 0x04) >>> 0) >>> 0
  m.setU32((pObj0 + 0xb8) >>> 0, 0x2066736d)
  const pGame0 = m.u32(op) >>> 0
  const pChain = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  let pQuest = pChain !== 0 ? m.u32(pChain) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 9) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  const pIlvlScratch = allocScratch(8)
  try {
    m.setU32(pIlvlScratch, 0)
    if (pQuest !== 0) {
      const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
      m.setU32((pState + 0x14) >>> 0, 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(op) >>> 0,
        ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c,
        0,
        m.u32((op + 0x08) >>> 0) >>> 0,
      )
      for (let i = 0; i < (m.u32((pState + 0x14) >>> 0) | 0); i = (i + 1) | 0) {
        const pDropped =
          ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
            m,
            m.u32(op) >>> 0,
            m.u32((op + 0x04) >>> 0) >>> 0,
            7,
            pIlvlScratch,
            0,
            -1,
            1,
          ) >>> 0
        if (pDropped !== 0) {
          ITEMS_SetOrClearCommandFlags113c(m, pDropped, 0x10, 1)
          m.setU32((pState + 0x18) >>> 0, ((m.u32((pState + 0x18) >>> 0) | 0) + 1) | 0)
          m.setU8((pState + 0x28) >>> 0, 1)
        }
      }
    }
    OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, op, 4)
    const pQuestCtrl = m.u32(((m.u32(op) >>> 0) + 0x10f4) >>> 0) >>> 0
    if (pQuestCtrl === 0) {
      throw new D2CommonAssertError('Quests.cpp', 0x1fb)
    }
    const newLo = stepSeed64At113c(m, (pQuestCtrl + 0x18) >>> 0)
    const nPiles = ((newLo % 5) + 5) | 0
    for (let k = 0; k < nPiles; k = (k + 1) | 0) {
      OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
        m,
        0x20646c67,
        m.u32((op + 0x04) >>> 0) >>> 0,
        m.u32(op) >>> 0,
        2,
      )
    }
    return 0
  } finally {
    freeScratch(8)
  }
}

/**
 * [40/45] Operates the Horadric Scroll (`'tr1 '`) quest chest, dropping quest scrolls, loot, and gold.
 * @va D2Game:0x6FCEA290
 * @dll D2Game.dll
 * @va 0x6FCEA290
 * @ordinalOrName ACT2Q2_OperateHoradricScrollChest_6FCEA290
 */
export function ACT2Q2_OperateHoradricScrollChest_6FCEA290_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FCEA290)
  const op = pOperateArgs >>> 0
  if ((OBJECTS_OperateContainer_6FC56B90_113c(m, op) | 0) === 0) return 0
  const pObj0 = m.u32((op + 0x04) >>> 0) >>> 0
  m.setU32((pObj0 + 0xb8) >>> 0, 0x20317274)
  const pGame0 = m.u32(op) >>> 0
  const pChain = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  let pQuest = pChain !== 0 ? m.u32(pChain) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 9) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  const pIlvlScratch = allocScratch(8)
  try {
    m.setU32(pIlvlScratch, 0)
    if (pQuest !== 0) {
      const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
      m.setU32((pState + 0x14) >>> 0, 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(op) >>> 0,
        ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c,
        0,
        m.u32((op + 0x08) >>> 0) >>> 0,
      )
      for (let i = 0; i < (m.u32((pState + 0x14) >>> 0) | 0); i = (i + 1) | 0) {
        ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
          m,
          m.u32(op) >>> 0,
          m.u32((op + 0x04) >>> 0) >>> 0,
          7,
          pIlvlScratch,
          0,
          -1,
          1,
        )
      }
    }
    OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, op, 4)
    const pQuestCtrl = m.u32(((m.u32(op) >>> 0) + 0x10f4) >>> 0) >>> 0
    if (pQuestCtrl === 0) {
      throw new D2CommonAssertError('Quests.cpp', 0x1fb)
    }
    const newLo = stepSeed64At113c(m, (pQuestCtrl + 0x18) >>> 0)
    const nPiles = ((newLo % 5) + 5) | 0
    for (let k = 0; k < nPiles; k = (k + 1) | 0) {
      OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
        m,
        0x20646c67,
        m.u32((op + 0x04) >>> 0) >>> 0,
        m.u32(op) >>> 0,
        2,
      )
    }
    return 0
  } finally {
    freeScratch(8)
  }
}

/**
 * [41/45] Initializes the `D2SeedStrc` and allocates/populates `D2MonsterRegionStrc` (`0x2E4` bytes)
 * for all levels `1..nLevelsTxtRecordCount - 1`.
 * @dll D2Game.dll
 * @va D2Game:0x6FCEAB30
 * @va 0x6FCEAB30
 * @ordinalOrName MONREG_InitAllActMonsterRegions_6FCEAB30
 */
export function MONREG_InitAllActMonsterRegions_6FCEAB30_113c(
  m: D2KernMemory113c,
  nLowSeed: number,
  _pMemPool: number,
  ppRegionTable: number,
  pSeed: number,
  nDifficulty: number,
  bExpansion: number,
): void {
  hitD2GameVa113c(0x6FCEAB30)
  SEED_InitLowSeed113c(m, pSeed >>> 0, nLowSeed >>> 0)
  let pRegionSlot = ((ppRegionTable >>> 0) + 0x04) >>> 0
  const diff = nDifficulty & 0xff
  if ((DATATBLS_GetMonLvlTxtRecord113c(m, diff) >>> 0) === 0) {
    throw new D2CommonAssertError('MonsterRegion.cpp', 0x83)
  }
  const pDataTables0 = getSgptDataTablesPtr(m)
  const nLevelsCount0 = (m.u32((pDataTables0 + 0xc5c) >>> 0) | 0)
  let nLevelId = 1
  if (nLevelsCount0 <= 1) return

  const bUseAltMonTable = (nDifficulty & 0xff) !== 0 ? 1 : 0
  while (true) {
    const pRegion = m.alloc(0x2e4) >>> 0
    for (let w = 0; w < 0xb9; w = (w + 1) | 0) {
      m.setU32((pRegion + (w << 2)) >>> 0, 0)
    }
    const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId) >>> 0
    m.setU8(pRegion, m.u8((pLevelsTxt + 0x03) >>> 0))
    m.setU32((pRegion + 0x2c0) >>> 0, nLevelId >>> 0)
    m.setU32((pRegion + 0x2b8) >>> 0, m.u32((pLevelsTxt + diff * 4 + 0x1c) >>> 0) >>> 0)
    m.setU8((pRegion + 0x2bc) >>> 0, m.u8((pLevelsTxt + diff + 0x28) >>> 0))
    m.setU8((pRegion + 0x2bd) >>> 0, m.u8((pLevelsTxt + diff + 0x2b) >>> 0))
    m.setU8((pRegion + 0x2be) >>> 0, m.u8((pLevelsTxt + 0x2e) >>> 0))
    const bQuest = m.u8((pLevelsTxt + 0x30) >>> 0)
    m.setU32((pRegion + 0x2d4) >>> 0, 0xffffffff)
    m.setU32((pRegion + 0x0c) >>> 0, 0xffffffff)
    m.setU8((pRegion + 0x2d8) >>> 0, bQuest)
    if ((bExpansion | 0) !== 0) {
      const monLvEx = (m.u16((pLevelsTxt + diff * 2 + 0x16) >>> 0) << 16) >> 16
      m.setU32((pRegion + 0x2dc) >>> 0, monLvEx >>> 0)
      const monLvEx2 = (m.u16((pLevelsTxt + diff * 2 + 0x16) >>> 0) << 16) >> 16
      m.setU32((pRegion + 0x2e0) >>> 0, monLvEx2 >>> 0)
    } else {
      const monLv = (m.u16((pLevelsTxt + diff * 2 + 0x10) >>> 0) << 16) >> 16
      m.setU32((pRegion + 0x2dc) >>> 0, monLv >>> 0)
      const monLv2 = (m.u16((pLevelsTxt + diff * 2 + 0x10) >>> 0) << 16) >> 16
      m.setU32((pRegion + 0x2e0) >>> 0, monLv2 >>> 0)
    }
    MONREG_SelectRegionMonsterTypes_6FCEA760_113c(
      m,
      bUseAltMonTable,
      pSeed >>> 0,
      pLevelsTxt,
      pRegion,
    )
    if (m.u8((pRegion + 0x10) >>> 0) > 0) {
      let pOutfitEntry = (pRegion + 0x14) >>> 0
      for (let i = 0; i < m.u8((pRegion + 0x10) >>> 0); i = (i + 1) | 0) {
        MONREG_GenerateOutfitVariants113c(m, pSeed >>> 0, pOutfitEntry, 3)
        pOutfitEntry = (pOutfitEntry + 0x34) >>> 0
      }
    }
    m.setU32(pRegionSlot, pRegion)
    const pDataTables = getSgptDataTablesPtr(m)
    const nLevelsCount = (m.u32((pDataTables + 0xc5c) >>> 0) | 0)
    pRegionSlot = (pRegionSlot + 0x04) >>> 0
    nLevelId = (nLevelId + 1) | 0
    if (nLevelId >= nLevelsCount) break
  }
}

/**
 * [42/45] C2S packet `0x5D` (`6` bytes) handler: validates arena flags and dispatches party relation action (`<= 10`) with `dwExtraArg = 0`.
 * @dll D2Game.dll
 * @va D2Game:0x6FCEC860
 * @va 0x6FCEC860
 * @ordinalOrName C2S_HandlePacket5D_PartyRelationAction_6FCEC860
 */
export function C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEC860)
  if ((nPacketSize | 0) !== 6) return 3
  const pArena = m.u32(((pGame >>> 0) + 0x1d28) >>> 0) >>> 0
  if (pArena === 0) {
    throw new D2CommonAssertError('Arena.cpp', 0x27)
  }
  if ((m.u32((pArena + 0x08) >>> 0) & 0x10000) !== 0) return 3
  const pkt = pPacket >>> 0
  const bAction = m.u8((pkt + 0x01) >>> 0)
  if (bAction > 0x0a) return 2
  const dwTargetGuid = m.u32((pkt + 0x02) >>> 0) >>> 0
  PARTY_DispatchRelationAction_6FD10A70_113c(m, dwTargetGuid, bAction, pGame >>> 0, pPlayer >>> 0, 0)
  return 0
}

/**
 * [43/45] C2S packet `0x5E` (`7` bytes) handler: validates arena flags and dispatches party relation action (`<= 10`) with `bExtraArg = pPacket[2]`.
 * @dll D2Game.dll
 * @va D2Game:0x6FCEC8E0
 * @va 0x6FCEC8E0
 * @ordinalOrName C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0
 */
export function C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEC8E0)
  if ((nPacketSize | 0) !== 7) return 3
  const pArena = m.u32(((pGame >>> 0) + 0x1d28) >>> 0) >>> 0
  if (pArena === 0) {
    throw new D2CommonAssertError('Arena.cpp', 0x27)
  }
  if ((m.u32((pArena + 0x08) >>> 0) & 0x10000) !== 0) return 3
  const pkt = pPacket >>> 0
  const dwTargetGuid = m.u32((pkt + 0x03) >>> 0) >>> 0
  const bAction = m.u8((pkt + 0x01) >>> 0)
  if (bAction > 0x0a) return 2
  const bExtraArg = m.u8((pkt + 0x02) >>> 0)
  return (
    PARTY_DispatchRelationAction_6FD10A70_113c(
      m,
      dwTargetGuid,
      bAction,
      pGame >>> 0,
      pPlayer >>> 0,
      bExtraArg,
    ) | 0
  )
}

/**
 * [44/45] C2S 5-byte item packet validator: checks `nPacketSize == 5` and validates inventory/cursor ownership of `*(DWORD*)(pPacket + 1)`.
 * @dll D2Game.dll
 * @va D2Game:0x6FCED4F0
 * @va 0x6FCED4F0
 * @ordinalOrName C2S_ValidatePacket5ByteItem_6FCED4F0
 */
export function C2S_ValidatePacket5ByteItem_6FCED4F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCED4F0)
  if ((nPacketSize | 0) !== 5) return 3
  const dwItemGuid = m.u32(((pPacket >>> 0) + 0x01) >>> 0) >>> 0
  const res =
    C2S_ValidateInventoryOrCursorItem_6FCECE20_113c(m, pGame >>> 0, dwItemGuid, pPlayer >>> 0) | 0
  if (res !== 0) return res
  return (nPacketSize | 0) !== 0 ? 3 : 0
}

/**
 * [45/45] Validates item interaction by `pItem->dwAnimMode` (`0..4`): ground items (`mode == 3`) check same Act and `<= 10` subtile distance; inventory/equipped/belt/cursor items (`0, 1, 2, 4`) delegate to `C2S_ValidateInventoryOrCursorItem_6FCECE20_113c`.
 * @dll D2Game.dll
 * @va D2Game:0x6FCED6D0
 * @va 0x6FCED6D0
 * @ordinalOrName C2S_ValidateItemInteractionByAnimMode_6FCED6D0
 */
export function C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwItemGuid: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FCED6D0)
  const game = pGame >>> 0
  if (game === 0) {
    throw new D2CommonAssertError('Packet.cpp', 0x4ce)
  }
  const guid = dwItemGuid >>> 0
  let pItem = m.u32((game + 0x1720 + ((guid & 0x7f) << 2)) >>> 0) >>> 0
  while (pItem !== 0) {
    if ((m.u32((pItem + 0x0c) >>> 0) >>> 0) === guid) break
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) return 1

  const mode = m.u32((pItem + 0x10) >>> 0) >>> 0
  if (mode > 4) return 1
  if (mode === 3) {
    const actErr = PACKET_CheckUnitsInDifferentActs113c(m, pPlayer >>> 0, pItem) | 0
    if (actErr !== 0) return actErr
    const ix = UNIT_GetPosX113c(m, pItem) | 0
    const iy = UNIT_GetPosY113c(m, pItem) | 0
    const distErr = C2S_CheckCoordDeltaExceeded113c(m, pPlayer >>> 0, ix, iy, 0x0a) | 0
    if (distErr !== 0) return distErr
    return 0
  }
  const invErr =
    C2S_ValidateInventoryOrCursorItem_6FCECE20_113c(m, game, guid, pPlayer >>> 0) | 0
  if (invErr !== 0) return invErr
  return 0
}
