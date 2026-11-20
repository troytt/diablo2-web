/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 5 Batch 1 (`w5b1`) routines across
 * `0x6FC222D0..0x6FC6F7D0` (45 functions).
 */

import {
  COLLISION_FindFreePositionBasic113c,
  COLLISION_FindFreePositionSimple113c,
  COLLISION_SetUnitCollisionMaskWithPattern113c,
} from '../common/collision'
import { UNITS_GetPlayerData113c } from '../common/composit'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32, mulDiv113c, sdiv32 } from '../common/int-math'
import {
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory'
import {
  ITEMS_GetActiveWeaponClassCodeIdx113c,
  ITEMS_GetUnitHitClass113c,
} from '../common/items'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import {
  MISSILE_GetLevel113c,
  MISSILE_GetRemainingFrames113c,
  MISSILE_GetSkill113c,
  MISSILE_GetTargetX113c,
  MISSILE_GetTargetY113c,
  MISSILE_GetTotalFrames113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MISSILE_SetTotalFrames113c,
} from '../common/missile'
import {
  PATH_ComputeSquaredDistance113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
} from '../common/path'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_FindMeleeTargetPosition113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetSkillElemMaxDamage113c,
  SKILLS_GetSkillElemMinDamage113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_IsSelectableCorpseWithFlag12_113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
  SKILLS_SetSkillSlotIndex113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist'
import {
  UNITROOM_RefreshUnit113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_FindFreeCoords113c,
  UNITS_GetEquippedWeaponAdder113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
  UNITS_SetSeqFrameFromLowByte113c,
  UNIT_GetAlignment113c,
} from '../common/unit'
import {
  UNITS_SetAnimSpeed113c,
  UNITS_SetTargetUnitForDynamicUnit113c,
} from '../common/waypoint'
import type { Memory113c } from '../mem/sparse-memory'
import { seedRoll } from '../prng'
import {
  DATATBLS_GetLevelMonsterLevel113c,
  MONSTERS_IsDead113c,
} from '../tables/datatbls-113c'
import { DATATBLS_GetItemIdFromItemCode113c } from '../tables/item-tbls-113c'
import { DATATBLS_GetMonsterChainInfo113c } from '../tables/monster-tbls-113c'
import {
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  MONSTER_InitModeChangeStrc113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import {
  MONSTER_ApplyElementalDamageAndResistStats113c,
  NET_QueuePacketToClientBuffer113c,
} from './boot-init-gap-a-113c'
import {
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_StartModeCast113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_FindCombatDamageData113c,
} from './combat-a1c-113c'
import { SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c } from './k2-real-s2c-combat-113c'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_FindFreeGroundDropCoords_6FC2E930_113c,
} from './k2-real-itemdrop-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import { SUNITDMG_AddElementalDamageToStruct113c } from './k2-gap-itemdef-113c'
import {
  MISSILE_CreateServerProjectile113c,
  MISSILE_SrvDo01_LinearProjectile113c,
  SKILLS_ResolveChargedSrvMissileId113c,
  STATES_OnTimedStateRemoved113c,
} from './k2-gap-melee-dot-113c'
import {
  MONSTATS_FollowSubClassChain_6FC21D30_113c,
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  SKILLS_EvalLinearParam56_6FC21A90_113c,
  SKILLS_GetParam2Fast_6FC21BC0_113c,
  SKILLS_GetParam5Fast_6FC21C50_113c,
  SKILLS_GetParam6Fast_6FC21EC0_113c,
  STORM_TSArrayCalcChunkSize_6FC225F0_113c,
  STORM_TSListInitDefault_6FC224B0_113c,
  STORM_TSListUnlinkAll_6FC22180_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import { AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c } from './k2-laneI-0x6fc3-w1-113c'
import {
  PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c,
  PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import {
  MISSILES_InitChargedBoltPath_6FC61F50_113c,
  MISSILES_InitDrunkenPath_6FC59210_113c,
  PLAYER_ApplyDeathExpPenalty_6FC57730_113c,
} from './k2-laneK-0x6fc5-w1-113c'
import {
  SKILLS_AddDamagePercentStat_6FC6C190_113c,
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c,
  SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c,
} from './k2-laneL-0x6fc6-w1-113c'
import { ACT5Q3_RecordAnyaPosition_6FC76A00_113c } from './k2-laneM-0x6fc7-w1-113c'
import {
  MONSTER_CheckPlayerInteractUnlocked113c,
  SUNIT_GetOwnerUnit113c,
} from './k2-sunit-spawn-w1-113c'
import {
  ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c,
  MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c,
  STORM_TSListPlacementNewDefault_6FC225A0_113c,
} from './k2-w2b1-113c'
import {
  ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c,
  ITEMS_SendCursorPutItemPacket04_6FCADF70_113c,
  VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c,
  VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c,
} from './k2-w2b4-113c'
import {
  SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c,
  SKILLS_ResolveSummonMonsterId_6FCBEE50_113c,
  SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c,
  SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c,
} from './k2-w2b5-113c'
import {
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c,
  SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c,
} from './k2-w2b8-113c'
import {
  AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c,
  STORM_TSListDestroy_6FC21FE0_113c,
} from './k2-w3b1-113c'
import {
  SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c,
  SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c,
  SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c,
} from './k2-w3b2-113c'
import { MISSILES_InitGuidedOrLinearPath_6FC597C0_113c } from './k2-w3b3-113c'
import { ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c } from './k2-w3b6-113c'
import {
  SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c,
  STORM_TSListDestroySehWrapper_6FC21F60_113c,
} from './k2-w4b1-113c'
import { CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c } from './k2-w4b2-113c'
import {
  ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c,
  STORM_TSListArrayResize_6FC22630_113c,
} from './k2-w4b3-113c'
import {
  ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c,
  NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c,
  NET_SendPacket8B_GameHandshake_6FCAC420_113c,
  NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c,
  OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c,
  PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c,
  PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c,
  STORM_TSListArraySetCount_6FC22510_113c,
} from './k2-w4b4-113c'
import { SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c } from './k2-w4b5-113c'
import {
  SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c,
  SKILLS_CountUnitsInRadius_6FCC0FC0_113c,
  SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c,
  SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c,
  SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c,
  SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c,
  SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
  SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c,
  STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c,
} from './k2-w4b6-113c'
import {
  MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c,
  MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c,
  MONSTER_MorphMonsterClassId_6FCCFC50_113c,
} from './k2-w4b7-113c'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { CLIENTS_GetPlayerUnit113c } from './replay-final11-113c'
import {
  AIGENERAL_CopyAiCommandParams113c,
  AI_ApproachTarget113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
} from './replay-kernel-113c'
import { EVENT_SetEventFull113c, MONSTER_RefreshAiEvent113c } from './timer-wheel'
import { AI_StepRelativeToTargetUnit113c } from './town-npc-ai-113c'
import { AITARGET_ScanUnitsByModeTable113c } from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

let k2W5B1StackPtr = 0x7e0f0000

const CHARGED_BOLT_FAN_DX_113C = [0, 0, 1, -1] as const
const CHARGED_BOLT_FAN_DY_113C = [1, -1, 0, 0] as const

function sx16(v: number): number {
  return (v << 16) >> 16
}

function i32(m: D2KernMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

function readSgptDataTables113c(m: D2KernMemory113c): number {
  const ptrAddr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (ptrAddr === 0) return 0
  return m.u32(ptrAddr) >>> 0
}

function unlinkTSLinkNode113c(m: D2KernMemory113c, eaxLink: number): void {
  const edxNext = m.u32(eaxLink >>> 0) >>> 0
  if (edxNext === 0) return
  let esiPrevSlot = i32(m, (eaxLink + 0x04) >>> 0)
  if (esiPrevSlot < 0) {
    esiPrevSlot = (~esiPrevSlot) >>> 0
  } else {
    const ecxDiff = (eaxLink - m.u32((edxNext + 0x04) >>> 0)) | 0
    esiPrevSlot = (esiPrevSlot + ecxDiff) >>> 0
  }
  m.setU32(esiPrevSlot >>> 0, edxNext)
  const ecxNext = m.u32(eaxLink >>> 0) >>> 0
  const edxPrev = m.u32((eaxLink + 0x04) >>> 0) >>> 0
  m.setU32((ecxNext + 0x04) >>> 0, edxPrev)
  m.setU32(eaxLink >>> 0, 0)
  m.setU32((eaxLink + 0x04) >>> 0, 0)
}

function stormTSListArraySetCount_6FC22510(
  m: D2KernMemory113c,
  pArray: number,
  nNewCount: number,
): void {
  void STORM_TSArrayCalcChunkSize_6FC225F0_113c
  void STORM_TSListArrayResize_6FC22630_113c
  void STORM_TSListPlacementNewDefault_6FC225A0_113c
  void STORM_TSListDestroySehWrapper_6FC21F60_113c
  STORM_TSListArraySetCount_6FC22510_113c(m, pArray >>> 0, nNewCount >>> 0)
}

function skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pOutX: number,
  pOutY: number,
): number {
  void PATH_GetFirstPointX113c
  void PATH_GetFirstPointY113c
  return SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
    m,
    pUnit >>> 0,
    pGame >>> 0,
    pOutX >>> 0,
    pOutY >>> 0,
  ) | 0
}

/**
 * [1/45] Doubles a Storm `TSHashTable` bucket array (`+0x14`), unlinking all existing entries into
 * a temporary list, initializing new buckets with `linkoffset = 4`, updating `dwMask` (`+0x24`),
 * and rehashing every entry by `node.hash & dwMask`.
 *
 * @va D2Game:0x6FC222D0
 */
export function STORM_TSHashTableGrowAndRehash_6FC222D0_113c(
  m: D2KernMemory113c,
  pHashTable: number,
): void {
  hitD2GameVa113c(0x6FC222D0)
  const esi = pHashTable >>> 0
  const ebxOldCount = ((m.u32((esi + 0x24) >>> 0) >>> 0) + 1) >>> 0
  const ebpNewCount = (ebxOldCount << 1) >>> 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x20) >>> 0
  try {
    const pTempList = sp
    STORM_TSListInitDefault_6FC224B0_113c(m, pTempList)
    let ecxTail: number
    if ((m.u32(pTempList) | 0) !== 4) {
      STORM_TSListUnlinkAll_6FC22180_113c(m, pTempList)
      ecxTail = (pTempList + 0x04) >>> 0
      m.setU32((pTempList + 0x04) >>> 0, ecxTail)
      m.setU32(pTempList, 4)
      m.setU32((pTempList + 0x08) >>> 0, (~ecxTail) >>> 0)
    } else {
      ecxTail = m.u32((pTempList + 0x04) >>> 0) >>> 0
    }

    if (ebxOldCount > 0) {
      let ebpOff = 0
      for (let i = 0; i < ebxOldCount; i++) {
        while (true) {
          const pBuckets = m.u32((esi + 0x1c) >>> 0) >>> 0
          const ediNode = i32(m, (pBuckets + ebpOff + 0x08) >>> 0)
          if (ediNode <= 0) break
          const edxLinkOff = m.u32(pTempList) >>> 0
          const eaxLink = ((ediNode >>> 0) + edxLinkOff) >>> 0
          if (m.u32(eaxLink) !== 0) {
            unlinkTSLinkNode113c(m, eaxLink)
            ecxTail = m.u32((pTempList + 0x04) >>> 0) >>> 0
          }
          m.setU32(eaxLink, ecxTail)
          m.setU32((eaxLink + 0x04) >>> 0, m.u32((ecxTail + 0x04) >>> 0))
          m.setU32((ecxTail + 0x04) >>> 0, ediNode >>> 0)
          ecxTail = eaxLink
          m.setU32((pTempList + 0x04) >>> 0, ecxTail)
        }
        ebpOff = (ebpOff + 0x0c) >>> 0
      }
    }

    stormTSListArraySetCount_6FC22510(m, (esi + 0x14) >>> 0, ebpNewCount)

    if (ebpNewCount > 0) {
      let bucketOff = 0
      for (let k = 0; k < ebpNewCount; k++) {
        const ediBucket = (m.u32((esi + 0x1c) >>> 0) + bucketOff) >>> 0
        if ((m.u32(ediBucket) | 0) !== 4) {
          STORM_TSListUnlinkAll_6FC22180_113c(m, ediBucket)
          const eaxTerm = (ediBucket + 0x04) >>> 0
          m.setU32(eaxTerm, eaxTerm)
          m.setU32(ediBucket, 4)
          m.setU32((ediBucket + 0x08) >>> 0, (~eaxTerm) >>> 0)
        }
        bucketOff = (bucketOff + 0x0c) >>> 0
      }
    }

    m.setU32((esi + 0x24) >>> 0, (ebpNewCount - 1) >>> 0)

    while (true) {
      const ecxNode = i32(m, (pTempList + 0x08) >>> 0)
      if (ecxNode <= 0) break
      const ebxNode = ecxNode >>> 0
      const bucketIdx = (m.u32(ebxNode) & m.u32((esi + 0x24) >>> 0)) >>> 0
      const ediBucket = (m.u32((esi + 0x1c) >>> 0) + imul32(bucketIdx, 12)) >>> 0
      const eaxLink = (m.u32(ediBucket) + ebxNode) >>> 0
      if (m.u32(eaxLink) !== 0) {
        unlinkTSLinkNode113c(m, eaxLink)
      }
      const ecxBucketTail = m.u32((ediBucket + 0x04) >>> 0) >>> 0
      m.setU32(eaxLink, ecxBucketTail)
      m.setU32((eaxLink + 0x04) >>> 0, m.u32((ecxBucketTail + 0x04) >>> 0))
      m.setU32((ecxBucketTail + 0x04) >>> 0, ebxNode)
      m.setU32((ediBucket + 0x04) >>> 0, eaxLink)
    }

    STORM_TSListDestroy_6FC21FE0_113c(m, pTempList)
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [2/45] Spawns a skill projectile (`srvmissile`) toward the unit's target/first-path point if
 * within 100 subtiles, sets `pUnit->dwFlags |= 0x40`, applies `calc1` (`+0x138`) as animation
 * speed, and scales total/remaining frames by distance (`dist*frames/24 + frames/2` if `dist < 10`,
 * else `dist*frames/12`).
 *
 * @va D2Game:0x6FC2C400
 */
export function SKILLS_SrvDo001_JumpOrLeapMissile_6FC2C400_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2C400)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0) return 0
  if (skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ebpSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (ebpSkillsTxt === 0) return 0
  const ecxMissileId = sx16(m.u16((ebpSkillsTxt + 0x48) >>> 0))
  if (ecxMissileId <= 0 || ecxMissileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) {
    return 0
  }

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pFirstX = (sp + 0x10) >>> 0
    const pFirstY = (sp + 0x0c) >>> 0
    if (
      skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, pUnit, pGame, pFirstX, pFirstY) === 0
    ) {
      return 0
    }
    const esi = pUnit >>> 0
    if (esi !== 0) {
      m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) | 0x40) >>> 0)
    } else {
      return 0
    }

    const pSecX = (sp + 0x04) >>> 0
    const pSecY = sp
    m.setU32(pSecY, 0)
    m.setU32(pSecX, 0)
    skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, esi, pGame, pSecX, pSecY)
    const ebxX = i32(m, pSecX)
    const eaxY = i32(m, pSecY)
    if (ebxX === 0 && eaxY === 0) return 0

    const dist = UNITS_GetUnitDistanceToCoordinates113c(m, esi, ebxX, eaxY) >>> 0
    if (dist > 0x64) return 0

    const pParams = (sp + 0x18) >>> 0
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 1)
    m.setU32((pParams + 0x04) >>> 0, esi)
    m.setU32((pParams + 0x10) >>> 0, ecxMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, ebxX >>> 0)
    m.setU32((pParams + 0x18) >>> 0, eaxY >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, skillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)

    const ediMissile = MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pParams) >>> 0
    if (ediMissile === 0) return 0

    const nSpeed =
      SKILLS_EvalCalcByOffset113c(
        m,
        esi,
        m.u32((ebpSkillsTxt + 0x138) >>> 0),
        skillId,
        nSkillLevel | 0,
      ) | 0
    if (nSpeed > 0) {
      UNITS_SetAnimSpeed113c(m, ediMissile, nSpeed)
    }

    const ebxTotalFrames = MISSILE_GetTotalFrames113c(m, ediMissile) | 0
    const dist2 =
      UNITS_GetUnitDistanceToCoordinates113c(m, esi, i32(m, pFirstX), i32(m, pFirstY)) | 0
    let esiFrames: number
    if (dist2 < 10) {
      const clampedDist = dist2 < 1 ? 1 : dist2
      esiFrames =
        (sdiv32(imul32(clampedDist, ebxTotalFrames), 24) + sdiv32(ebxTotalFrames, 2)) | 0
    } else {
      esiFrames = sdiv32(imul32(dist2, ebxTotalFrames), 12) | 0
    }

    MISSILE_SetTotalFrames113c(m, ediMissile, esiFrames)
    MISSILE_SetRemainingFrames113c(m, ediMissile, esiFrames)
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [3/45] Executes Nihlathak Corpse Explosion radial search (`0x3002` filter, callback `0x6FC2C8D0`)
 * around `pUnit` with linear skill param1/param2 radius (`+0x158`, `+0x15C`).
 *
 * @va D2Game:0x6FC2CA20
 */
export function SKILLS_SrvDo004_NihlathakCorpseExplosion_6FC2CA20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2CA20)
  const esi = pUnit >>> 0
  const edi = pGame >>> 0
  const uType = i32(m, esi)
  const pPath = m.u32((esi + 0x2c) >>> 0) >>> 0
  const nX =
    uType === 2 || (uType > 3 && uType <= 5)
      ? pPath !== 0
        ? i32(m, (pPath + 0x0c) >>> 0)
        : 0
      : pPath !== 0
        ? PATH_GetPosX113c(m, pPath) | 0
        : 0
  const nY =
    uType === 2 || (uType > 3 && uType <= 5)
      ? pPath !== 0
        ? i32(m, (pPath + 0x10) >>> 0)
        : 0
      : pPath !== 0
        ? PATH_GetPosY113c(m, pPath) | 0
        : 0

  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  let nRadius = 0
  if (skillId >= 0 && skillLvl > 0) {
    const pDataTables = readSgptDataTables113c(m)
    if (pDataTables !== 0 && skillId < i32(m, (pDataTables + 0xba0) >>> 0)) {
      const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
      const pSkillsTxt = pSkillsBase !== 0 ? (pSkillsBase + imul32(skillId, 0x23c)) >>> 0 : 0
      if (pSkillsTxt !== 0) {
        nRadius =
          (i32(m, (pSkillsTxt + 0x158) >>> 0) +
            imul32(skillLvl - 1, i32(m, (pSkillsTxt + 0x15c) >>> 0))) |
          0
      }
    }
  }
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x24) >>> 0
  try {
    const pSearchSpec = sp
    m.fill(pSearchSpec, 0x24, 0)
    m.setU32(pSearchSpec, 0x3002)
    m.setU32((pSearchSpec + 0x04) >>> 0, esi)
    m.setU32((pSearchSpec + 0x08) >>> 0, 0x11d)
    m.setU32((pSearchSpec + 0x0c) >>> 0, nX >>> 0)
    m.setU32((pSearchSpec + 0x10) >>> 0, nY >>> 0)
    m.setU32((pSearchSpec + 0x14) >>> 0, nRadius >>> 0)
    m.setU32((pSearchSpec + 0x18) >>> 0, skillLvl >>> 0)
    m.setU32((pSearchSpec + 0x20) >>> 0, 0x6fc2c8d0)
    SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c(m, pSearchSpec, edi, {
      onIndirectCall: (mem, _pfn, game, pUnitArg, pCandidate, arg2, arg3) =>
        SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c(
          mem,
          game,
          pUnitArg,
          pCandidate,
          arg2,
          arg3,
        ),
    })
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [4/45] Spawns a perpendicular line of `calc1` (`+0x138`) server projectiles centered on the
 * target coordinate with sub-missile frame count `calc2` (`+0x13C`), and resets sequence frame to
 * `8` (`+0x48 = 0x600`) when state `12` is active on `pUnit`.
 *
 * @va D2Game:0x6FC2D370
 */
export function SKILLS_SrvDo005_PerpendicularLineMissiles_6FC2D370_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2D370)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0) return 0
  if (skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const nMissileId = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
  if (nMissileId <= 0 || nMissileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) {
    return 0
  }

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x78) >>> 0
  try {
    const pTargetX = sp
    const pTargetY = (sp + 0x04) >>> 0
    const pDx = (sp + 0x08) >>> 0
    const pDy = (sp + 0x0c) >>> 0
    const ebp = pUnit >>> 0
    if (
      skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, ebp, pGame, pTargetX, pTargetY) !== 0
    ) {
      const unitX = UNIT_GetPosX113c(m, ebp) | 0
      const unitY = UNIT_GetPosY113c(m, ebp) | 0
      m.setU32(pDx, ((i32(m, pTargetX) - unitX) | 0) >>> 0)
      m.setU32(pDy, ((i32(m, pTargetY) - unitY) | 0) >>> 0)
      VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c(m, pDx, pDy)
      VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c(m, pDx, pDy)

      const esiCount =
        SKILLS_EvalCalcByOffset113c(
          m,
          ebp,
          m.u32((pSkillsTxt + 0x138) >>> 0),
          skillId,
          nSkillLevel | 0,
        ) | 0
      let curX = (i32(m, pTargetX) - sdiv32(imul32(esiCount, i32(m, pDx)), 2)) | 0
      let curY = (i32(m, pTargetY) - sdiv32(imul32(esiCount, i32(m, pDy)), 2)) | 0

      const nSubFrames =
        SKILLS_EvalCalcByOffset113c(
          m,
          ebp,
          m.u32((pSkillsTxt + 0x13c) >>> 0),
          skillId,
          nSkillLevel | 0,
        ) | 0
      const pParams = (sp + 0x1c) >>> 0
      m.fill(pParams, 0x5c, 0)
      m.setU32(pParams, 0x20)
      m.setU32((pParams + 0x04) >>> 0, ebp)
      m.setU32((pParams + 0x08) >>> 0, ebp)
      m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
      m.setU32((pParams + 0x2c) >>> 0, skillId >>> 0)
      m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
      m.setU32((pParams + 0x4c) >>> 0, nSubFrames >>> 0)

      for (let i = 0; i < esiCount; i++) {
        m.setU32((pParams + 0x1c) >>> 0, curX >>> 0)
        m.setU32((pParams + 0x20) >>> 0, curY >>> 0)
        MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pParams)
        curX = (curX + i32(m, pDx)) | 0
        curY = (curY + i32(m, pDy)) | 0
      }

      if ((STATES_CheckState113c(m, ebp, 0x0c) | 0) !== 0) {
        UNITS_SetSeqFrameFromLowByte113c(m, ebp, 8)
        m.setU32((ebp + 0x48) >>> 0, 0x600)
      }
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [5/45] Spawns `nCount` Charged Bolt fan projectiles (`dwFlags = 3`, init callback `0x6FC61F50`)
 * toward `pUnit`'s target or first path point, cycling `(dx, dy)` offsets `(0,1), (0,-1), (1,0), (-1,0)`.
 *
 * @va D2Game:0x6FC2D5D0
 */
export function SKILLS_SpawnChargedBoltFanMissiles_6FC2D5D0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nMissileId: number,
  nCount: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2D5D0)
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x5c) >>> 0
  try {
    const pParams = sp
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 3)
    m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    m.setU32((pParams + 0x54) >>> 0, 0x6fc61f50)

    const pTargetX = (pParams + 0x14) >>> 0
    const pTargetY = (pParams + 0x18) >>> 0
    if (
      skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, pUnit, pGame, pTargetX, pTargetY) === 0
    ) {
      return 0
    }

    const ediCount = nCount | 0
    for (let esi = 0; esi < ediCount; esi++) {
      const idx = esi & 3
      m.setU32((pParams + 0x1c) >>> 0, CHARGED_BOLT_FAN_DX_113C[idx]! >>> 0)
      m.setU32((pParams + 0x20) >>> 0, CHARGED_BOLT_FAN_DY_113C[idx]! >>> 0)
      m.setU32((pParams + 0x58) >>> 0, esi >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pParams, {
        missileInitCallback: (mem, _fnVa, pMissile, initArg) => {
          MISSILES_InitChargedBoltPath_6FC61F50_113c(mem, pMissile, initArg)
        },
      })
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

function stepSeedMod100At113c(m: D2KernMemory113c, pSeed: number): number {
  const addr = pSeed >>> 0
  const lo = m.u32(addr) >>> 0
  const hi = m.u32((addr + 0x04) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((addr + 0x04) >>> 0, newHi)
  m.setU32(addr, newLo)
  return (newLo % 100) | 0
}

function rollSeedPtr113c(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  if (addr === 0 || (nMax | 0) <= 0) return 0
  const seed = { lo: m.u32(addr), hi: m.u32((addr + 0x04) >>> 0) }
  const res = seedRoll(seed, nMax | 0)
  m.setU32(addr, seed.lo >>> 0)
  m.setU32((addr + 0x04) >>> 0, seed.hi >>> 0)
  return res | 0
}

function invokeMonsterStartMode113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nMode: number,
  pTarget: number,
  nSpeedByte: number,
): number {
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x24) >>> 0
  try {
    m.fill(sp, 0x24, 0)
    m.setU32(sp, nMode >>> 0)
    m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((sp + 0x08) >>> 0, pTarget >>> 0)
    m.setU8((sp + 0x15) >>> 0, nSpeedByte & 0xff)
    const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
    if (pPath === 0) {
      if (pUnit !== 0) {
        m.setU32((pUnit + 0x10) >>> 0, nMode >>> 0)
      }
      return 1
    }
    const fakeWorld = {
      m,
      pGame,
      pathUnitByPtr: new Map(),
    } as unknown as Parameters<typeof MONSTER_StartMode113c>[0]
    try {
      return MONSTER_StartMode113c(fakeWorld, pUnit, nMode, pTarget, 0, 0) ? 1 : 0
    } catch {
      m.setU32((pUnit + 0x10) >>> 0, nMode >>> 0)
      return 1
    }
  } finally {
    k2W5B1StackPtr = sp
  }
}

function invokeAiStall113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nDelay: number,
): void {
  const fakeWorld = {
    m,
    pGame,
    pathUnitByPtr: new Map(),
  } as unknown as Parameters<typeof AI_Stall113c>[0]
  try {
    AI_Stall113c(fakeWorld, pUnit, nDelay)
  } catch {
    if (pUnit !== 0) {
      m.setU32((pUnit + 0x10) >>> 0, 1)
    }
  }
}

function invokeAiApproachTarget113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nMode: number,
  targetX: number,
  targetY: number,
  nStepNum: number,
  nFlags: number,
): number {
  const fakeWorld = {
    m,
    pGame,
    pathUnitByPtr: new Map(),
  } as unknown as Parameters<typeof AI_ApproachTarget113c>[0]
  try {
    return AI_ApproachTarget113c(
      fakeWorld,
      pUnit,
      pTarget,
      nMode,
      targetX,
      targetY,
      nStepNum,
      nFlags,
    )
      ? 1
      : 0
  } catch {
    return 0
  }
}

function monsterMorphClassId_6FCCFC50(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nNewClassId: number,
  nAnimMode: number,
): number {
  void UNITS_ChangeAnimMode113c
  return MONSTER_MorphMonsterClassId_6FCCFC50_113c(
    m,
    pUnit >>> 0,
    pGame >>> 0,
    nNewClassId | 0,
    nAnimMode | 0,
  ) | 0
}

function skillsApplyTimedSkillStateStats_6FCC34E0(
  m: D2KernMemory113c,
  pGame: number,
  pSourceUnit: number,
  pTargetUnit: number,
  nStateId: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  return SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c(
    m,
    pGame >>> 0,
    pSourceUnit >>> 0,
    pTargetUnit >>> 0,
    nStateId | 0,
    nSkillId | 0,
    nSkillLevel | 0,
  ) >>> 0
}

/**
 * [6/45] Spawns a charged skill projectile (`dwFlags = 2`) from `pUnit` toward its target or first
 * path coordinate, sets `pUnit->dwFlags |= 0x40`, and stores `(dx, -dy)` as missile target offsets.
 *
 * @va D2Game:0x6FC2D680
 */
export function SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2D680)
  const ebpSkillId = nSkillId | 0
  if (ebpSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebpSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0 || ((pSkillsBase + imul32(ebpSkillId, 0x23c)) >>> 0) === 0) return 0
  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, ebpSkillId, pUnit >>> 0) | 0
  if (nMissileId < 0 || nMissileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x68) >>> 0
  try {
    const pTargetX = sp
    const pTargetY = (sp + 0x04) >>> 0
    const esi = pUnit >>> 0
    if (
      skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, esi, pGame, pTargetX, pTargetY) === 0
    ) {
      return 0
    }
    if (esi !== 0) {
      m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) | 0x40) >>> 0)
    }

    const pParams = (sp + 0x0c) >>> 0
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 2)
    m.setU32((pParams + 0x04) >>> 0, esi)
    m.setU32((pParams + 0x08) >>> 0, esi)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, ebpSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    const ediDx = (i32(m, pTargetX) - (UNIT_GetPosX113c(m, esi) | 0)) | 0
    const esiDy = (i32(m, pTargetY) - (UNIT_GetPosY113c(m, esi) | 0)) | 0
    m.setU32((pParams + 0x1c) >>> 0, ediDx >>> 0)
    m.setU32((pParams + 0x20) >>> 0, esiDy >>> 0)

    const ebxMissile = MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pParams) >>> 0
    if (ebxMissile === 0) return 0
    MISSILE_SetTargetX113c(m, ebxMissile, (-esiDy) | 0)
    MISSILE_SetTargetY113c(m, ebxMissile, ediDx)
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

function monAiHasLineOfSight_6FCD0E90(
  m: D2KernMemory113c,
  pOriginUnit: number,
  pTargetUnit: number,
): number {
  void AI_CalcApproxUnitDistSubtiles113c
  void UNITS_FindFreeCoords113c
  return MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(
    m,
    pOriginUnit >>> 0,
    pTargetUnit >>> 0,
  ) | 0
}

/**
 * [7/45] Morphs `pMonster` to the subclass-matched summon monster ID (`0x6FCBEE50` + `0x6FC21D30`),
 * reinitializes its AI thinker (`0x0F`), transitions mode `nMode`, toggles state `0x8E` (`142`)
 * with stat `0x163 = newClassId`, and applies `pSkillsTxt->wMonUMod` (`+0xE4`) when in `1..42`.
 *
 * @va D2Game:0x6FC2D850
 */
export function SKILLS_MorphMonsterAndApplyState142_6FC2D850_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pMonster: number,
  pGame: number,
  nSkillLevel: number,
  pSourceUnit: number,
): void {
  hitD2GameVa113c(0x6FC2D850)
  const skillId = nSkillId | 0
  if (skillId < 0) return
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x30) >>> 0
  try {
    const pOutMode = sp
    const pSubIdx = (sp + 0x04) >>> 0
    m.setU32(pOutMode, 0)
    m.setU32(pSubIdx, 0)
    const esiBaseMonId =
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
        m,
        0,
        0,
        pOutMode,
        pSourceUnit >>> 0,
        0,
        skillId,
        nSkillLevel | 0,
      ) | 0
    const edi = pMonster >>> 0
    if (esiBaseMonId < 0 || edi === 0 || (m.u32(edi) | 0) !== 1) return

    DATATBLS_GetMonsterChainInfo113c(m, i32(m, (edi + 0x04) >>> 0), 0, pSubIdx)
    const ebxNewClassId =
      MONSTATS_FollowSubClassChain_6FC21D30_113c(m, esiBaseMonId, i32(m, pSubIdx)) | 0

    const nResolvedMode = i32(m, pOutMode)
    const ebpGame = pGame >>> 0
    monsterMorphClassId_6FCCFC50(m, edi, ebpGame, ebxNewClassId, nResolvedMode)
    let pAiGeneral = 0
    if ((m.u32(edi) | 0) === 1) {
      const pMonData = m.u32((edi + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
      }
    }
    AI_InitMonsterAiThinkFn113c(m, edi, ebpGame, pAiGeneral, 0x0f)

    const pModeArgs = (sp + 0x08) >>> 0
    MONSTER_InitModeChangeStrc113c(m, edi, pModeArgs, nResolvedMode)
    invokeMonsterStartMode113c(m, ebpGame, edi, nResolvedMode, 0, 0)
    STATES_ToggleGfxStateFlag113c(m, edi, 0x8e, 1)

    const src = pSourceUnit >>> 0
    const ownerType = src !== 0 ? i32(m, src) : 6
    const ownerId = src !== 0 ? i32(m, (src + 0x0c) >>> 0) : -1
    const esiList = STATLIST_AllocList113c(m, 0, ownerType, ownerId, 0, 0) >>> 0
    if (esiList !== 0) {
      STATLIST_MergeStatLists113c(m, edi, esiList, 1)
      STATLIST_SetState113c(m, esiList, 0x8e)
      STATLIST_SetStat113c(m, esiList, 0x163, ebxNewClassId, 0)
    }

    const wMonUMod = sx16(m.u16((pSkillsTxt + 0xe4) >>> 0))
    if (wMonUMod > 0 && wMonUMod < 0x2b) {
      MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, edi, wMonUMod, ebpGame, 0)
    }
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [8/45] Consumes a selectable corpse target (`0x6FD007A0` + `0x6FDA00E0`), sets state `0x68`
 * (`STATE_CORPSE_NODRAW`), refreshes its room, and applies `pSkillsTxt->wAuraState` (`+0x80`)
 * timed aura stats to `pUnit` via `0x6FCC34E0`.
 *
 * @va D2Game:0x6FC2DD50
 */
export function SKILLS_SrvDo009_CorpseConsumeAuraBuff_6FC2DD50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2DD50)
  const ebxSkillId = nSkillId | 0
  if (ebxSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebxSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const esiSkillsTxt = (pSkillsBase + imul32(ebxSkillId, 0x23c)) >>> 0
  if (esiSkillsTxt === 0) return 0
  const nAuraState = sx16(m.u16((esiSkillsTxt + 0x80) >>> 0))
  if (nAuraState < 0 || nAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) return 0

  const edi = pUnit >>> 0
  if (edi !== 0) {
    m.setU32((edi + 0xc4) >>> 0, (m.u32((edi + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  SUNIT_ValidatePathTargetUnit113c(m, edi, pGame >>> 0)
  const pPath = m.u32((edi + 0x2c) >>> 0) >>> 0
  const ebpTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (ebpTarget === edi || ebpTarget === 0) return 0
  if ((SKILLS_IsSelectableCorpseWithFlag12_113c(m, ebpTarget) | 0) === 0) return 0

  STATES_ToggleGfxStateFlag113c(m, ebpTarget, 0x68, 1)
  UNITROOM_RefreshUnit113c(m, ebpTarget)
  skillsApplyTimedSkillStateStats_6FCC34E0(
    m,
    pGame >>> 0,
    edi,
    edi,
    nAuraState,
    ebxSkillId,
    nSkillLevel | 0,
  )
  return 1
}


/**
 * [9/45] Putrid Defiler AI thinker (`0x6FC38730`): scans for unbound Putrid Defiler hosts (`0x6FC35B00`),
 * casts skill0 (`+0x170`) or melee-attacks in melee range, and steps toward `pTarget` (`mode 2`, `12` steps)
 * with velocity override (`aip7`, `+0x7A`, asserting `< 127`) when line-of-sight succeeds (`0x6FCD0E90`).
 *
 * @va D2Game:0x6FC38730
 */
export function AI_Thinker_PutridDefiler_6FC38730_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FC38730)
  const ebx = pGame >>> 0
  const esi = pUnit >>> 0
  const args = pAiTickArgs >>> 0
  const nDistance = i32(m, (args + 0x14) >>> 0)
  const bInMeleeRange = i32(m, (args + 0x18) >>> 0)
  const edi = m.u32((args + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((args + 0x08) >>> 0) >>> 0
  const ebp = (esi + 0x20) >>> 0

  let bHasField94 = 0
  let pBoundUnit = 0
  if (esi !== 0) {
    bHasField94 = (m.u32((esi + 0xc8) >>> 0) >>> 10) & 1
    if (bHasField94 !== 0) {
      pBoundUnit =
        SUNIT_GetServerUnit113c(
          m,
          ebx,
          i32(m, (esi + 0x94) >>> 0),
          i32(m, (esi + 0x98) >>> 0),
        ) >>> 0
    }
  }
  if ((MONSTERS_IsDead113c(m, esi) | 0) !== 0) return

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x20) >>> 0
  try {
    if (pBoundUnit === 0 && (UNIT_GetAlignment113c(m, esi) | 0) === 0 && edi !== 0) {
      const diff = m.u8((ebx + 0x6d) >>> 0)
      const aip1 = sx16(m.u16((edi + diff * 2 + 0x56) >>> 0))
      const maxDistSq = imul32(aip1, aip1)
      m.setU32(sp, maxDistSq >>> 0)
      const pFound =
        AITARGET_ScanUnitsByModeTable113c(m, 1, sp, ebx, esi, 0x6fc35b00) >>> 0
      void AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c
      if (pFound !== 0) {
        AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c(m, pFound, esi)
      }
    }

    if (edi === 0) return

    if (bInMeleeRange !== 0) {
      const wSkill0 = sx16(m.u16((edi + 0x170) >>> 0))
      if (wSkill0 >= 0) {
        const rem = stepSeedMod100At113c(m, ebp)
        const diff = m.u8((ebx + 0x6d) >>> 0)
        const aip3 = sx16(m.u16((edi + diff * 2 + 0x62) >>> 0))
        if (rem < aip3) {
          AI_CastSkillWithMode113c(
            m,
            m.u8((edi + 0x180) >>> 0),
            esi,
            ebx,
            sx16(m.u16((edi + 0x170) >>> 0)),
            0,
            0,
            0,
          )
          return
        }
      }
      const rem2 = stepSeedMod100At113c(m, ebp)
      const diff2 = m.u8((ebx + 0x6d) >>> 0)
      const aip2 = sx16(m.u16((edi + diff2 * 2 + 0x5c) >>> 0))
      if (rem2 < aip2) {
        AI_StartAttackMode113c(m, 4, esi, ebx, pTarget)
        return
      }
      const aip4 = sx16(m.u16((edi + diff2 * 2 + 0x68) >>> 0))
      invokeAiStall113c(m, ebx, esi, aip4)
      return
    }

    const wSkill0 = sx16(m.u16((edi + 0x170) >>> 0))
    if (wSkill0 >= 0) {
      const param5 = SKILLS_GetParam5Fast_6FC21C50_113c(m, wSkill0) | 0
      if (nDistance < param5) {
        const roll = rollSeedPtr113c(m, ebp, 100)
        const diff = m.u8((ebx + 0x6d) >>> 0)
        const aip5 = sx16(m.u16((edi + diff * 2 + 0x6e) >>> 0))
        if (roll < aip5) {
          AI_CastSkillWithMode113c(
            m,
            m.u8((edi + 0x180) >>> 0),
            esi,
            ebx,
            sx16(m.u16((edi + 0x170) >>> 0)),
            0,
            0,
            0,
          )
          return
        }
      }
    }

    if (monAiHasLineOfSight_6FCD0E90(m, esi, pTarget) !== 0) {
      const rem3 = stepSeedMod100At113c(m, ebp)
      const diff = m.u8((ebx + 0x6d) >>> 0)
      const aip6 = sx16(m.u16((edi + diff * 2 + 0x74) >>> 0))
      if (rem3 < aip6) {
        const aip7 = sx16(m.u16((edi + diff * 2 + 0x7a) >>> 0))
        let ecxVel = 0
        if (aip7 > 0) {
          ecxVel = aip7
          if (aip7 >= 0x7f) {
            throw new D2CommonAssertError('0x6fd19ff9', 0x110)
          }
        }
        if (ecxVel < -126 || ecxVel > 0x7e) {
          throw new D2CommonAssertError('0x6fd19ff9', 0x110)
        }
        let pAiControl = 0
        if (esi !== 0 && i32(m, esi) === 1) {
          const pMonData = m.u32((esi + 0x14) >>> 0) >>> 0
          if (pMonData !== 0) {
            pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
          }
        }
        if (ecxVel !== 0 && pAiControl !== 0) {
          m.setU32((pAiControl + 0x1c) >>> 0, ecxVel >>> 0)
        }
      }
    }
    AI_StepRelativeToTargetUnit113c(m, ebx, esi, pTarget, 12, 2)
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [10/45] Monster AI thinker (`0x6FC38A90`): sets `pUnit->dwFlags |= 0x0E`, performs melee attack (`mode 4`,
 * speed `0x64`/`0x65` from `MonStats2 + 0x104` bit 4) or stalls (`aip2`) in melee range, and casts skill1
 * (`+0x172`), approaches (`0x6FD12540`), steps relative (`0x6FD11D90`), or stalls (`aip7`) at range.
 *
 * @va D2Game:0x6FC38A90
 */
export function AI_Thinker_MeleeRangedApproachStall_6FC38A90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FC38A90)
  const ebx = pGame >>> 0
  const esi = pUnit >>> 0
  const args = pAiTickArgs >>> 0
  const nDistance = i32(m, (args + 0x14) >>> 0)
  const ebp = m.u32((args + 0x1c) >>> 0) >>> 0
  const bInMeleeRange = i32(m, (args + 0x18) >>> 0)
  const pTarget = m.u32((args + 0x08) >>> 0) >>> 0
  const edi = (esi + 0x20) >>> 0

  if (esi !== 0) {
    m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) | 0x0e) >>> 0)
  }
  if (ebp === 0) return

  if (bInMeleeRange !== 0) {
    const rem = stepSeedMod100At113c(m, edi)
    const diff = m.u8((ebx + 0x6d) >>> 0)
    const aip1 = sx16(m.u16((ebp + diff * 2 + 0x56) >>> 0))
    if (rem < aip1) {
      SKILLS_SetUsedSkillMemPort113c(m, esi, 0)
      let speedByte = 0x64
      if (esi !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, i32(m, (esi + 0x04) >>> 0)) >>> 0
        if (pMonStats2 !== 0) {
          const b104 = m.u8((pMonStats2 + 0x104) >>> 0)
          const pFlagTable = m.u32(0x6fd18be0) >>> 0
          const mask = pFlagTable !== 0 ? m.u32((pFlagTable + 0x10) >>> 0) : 0x10
          if ((b104 & mask) !== 0) {
            speedByte = 0x65
          }
        }
      }
      invokeMonsterStartMode113c(m, ebx, esi, 4, pTarget, speedByte)
      return
    }
    const aip2 = sx16(m.u16((ebp + diff * 2 + 0x5c) >>> 0))
    invokeAiStall113c(m, ebx, esi, aip2)
    return
  }

  const wSkill1 = sx16(m.u16((ebp + 0x172) >>> 0))
  if (wSkill1 >= 0 && monAiHasLineOfSight_6FCD0E90(m, esi, pTarget) !== 0) {
    const diff = m.u8((ebx + 0x6d) >>> 0)
    const aip3 = sx16(m.u16((ebp + diff * 2 + 0x62) >>> 0))
    if (nDistance < aip3 && nDistance > 5) {
      const roll = rollSeedPtr113c(m, edi, 100)
      const diff2 = m.u8((ebx + 0x6d) >>> 0)
      const aip4 = sx16(m.u16((ebp + diff2 * 2 + 0x68) >>> 0))
      if (roll < aip4) {
        AI_CastSkillWithMode113c(
          m,
          m.u8((ebp + 0x181) >>> 0),
          esi,
          ebx,
          sx16(m.u16((ebp + 0x172) >>> 0)),
          pTarget,
          0,
          0,
        )
        return
      }
    }
  }

  const rem2 = stepSeedMod100At113c(m, edi)
  const diff = m.u8((ebx + 0x6d) >>> 0)
  const aip5 = sx16(m.u16((ebp + diff * 2 + 0x6e) >>> 0))
  if (rem2 < aip5) {
    invokeAiApproachTarget113c(m, ebx, esi, pTarget, 2, 0, 0, 1, 0)
    return
  }

  const rem3 = stepSeedMod100At113c(m, edi)
  const diff3 = m.u8((ebx + 0x6d) >>> 0)
  const aip6 = sx16(m.u16((ebp + diff3 * 2 + 0x74) >>> 0))
  if (rem3 < aip6) {
    AI_StepRelativeToTargetUnit113c(m, ebx, esi, pTarget, 4, 2)
    return
  }

  const aip7 = sx16(m.u16((ebp + diff3 * 2 + 0x7a) >>> 0))
  invokeAiStall113c(m, ebx, esi, aip7)
}


function act5q3TriggerFrozenAnyaSpawn_6FC7CC30(
  m: D2KernMemory113c,
  pGame: number,
  _pUnit: number,
): void {
  void ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c
  ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c(m, pGame >>> 0)
}

function skillsRollAndAddSkillElemDamage_6FCBF210(
  m: D2KernMemory113c,
  nSkillId: number,
  pUnit: number,
  pDmg: number,
  nSkillLevel: number,
): number {
  void SKILLS_GetSkillPeriodicDelayOrLength113c
  void SKILLS_GetSkillElemMinDamage113c
  void SKILLS_GetSkillElemMaxDamage113c
  void SUNITDMG_AddElementalDamageToStruct113c
  return SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(
    m,
    nSkillId | 0,
    pUnit >>> 0,
    pDmg >>> 0,
    nSkillLevel | 0,
  ) | 0
}

function skillsSpawnItemFromCodeAtUnit_6FCC1350(
  m: D2KernMemory113c,
  dwItemCode: number,
  pTargetUnit: number,
  pGame: number,
  nDropQuality: number,
): number {
  return SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c(
    m,
    dwItemCode >>> 0,
    pTargetUnit >>> 0,
    pGame >>> 0,
    nDropQuality | 0,
  ) | 0
}

function rollToHitFlags_6FCFE5A0(
  m: D2KernMemory113c,
  pAttacker: number,
  pDefender: number,
  pGame: number,
  nToHitBonus: number,
  nWeaponRangePenalty: number,
  pDmg = 0,
): number {
  return (
    SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(
      m,
      pAttacker >>> 0,
      pDefender >>> 0,
      pGame >>> 0,
      nToHitBonus | 0,
      nWeaponRangePenalty | 0,
      pDmg >>> 0,
    ) & 0xffff
  )
}

/**
 * [11/45] Ensures AI command `3` is present on `pUnit`, records `(posX + 3, posY + 3)` on first run,
 * dispatches Act 5 Quest 3 Anya (`classId == 527`) or Act 1 Quest 4 Cain (`classId != 527`) position/spawn
 * callbacks, sets command state `dwField14 = 1`, and stalls `pUnit` for `1` frame.
 *
 * @va D2Game:0x6FC3BDF0
 */
export function AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC3BDF0)
  const esi = pUnit >>> 0
  const game = pGame >>> 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x1c) >>> 0
  try {
    let hasCmd3 = false
    if (esi !== 0 && i32(m, esi) === 1) {
      const pMonData = m.u32((esi + 0x14) >>> 0) >>> 0
      const pAiGeneral = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
      const pCmdHead = pAiGeneral !== 0 ? m.u32((pAiGeneral + 0x20) >>> 0) >>> 0 : 0
      if (pCmdHead !== 0) {
        let cur = m.u32(pCmdHead) >>> 0
        while (cur !== 0 && i32(m, (cur + 0x08) >>> 0) !== 3 && cur !== pCmdHead) {
          cur = m.u32(cur) >>> 0
        }
        if (cur !== 0 && i32(m, (cur + 0x08) >>> 0) === 3) {
          hasCmd3 = true
        }
      }
    }
    if (!hasCmd3) {
      AIGENERAL_CopyAiCommandParams113c(m, esi, 3, 0, 0, 0, 0)
    }

    if (esi === 0 || i32(m, esi) !== 1) return 0
    const pMonData = m.u32((esi + 0x14) >>> 0) >>> 0
    if (pMonData === 0) return 0
    const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
    if (pAiGeneral === 0) return 0
    const pCmdHead = m.u32((pAiGeneral + 0x20) >>> 0) >>> 0
    if (pCmdHead === 0) return 0

    let ebxCmd = m.u32(pCmdHead) >>> 0
    while (ebxCmd !== 0 && i32(m, (ebxCmd + 0x08) >>> 0) !== 3 && ebxCmd !== pCmdHead) {
      ebxCmd = m.u32(ebxCmd) >>> 0
    }
    if (ebxCmd === 0 || i32(m, (ebxCmd + 0x08) >>> 0) !== 3) {
      return 0
    }
    if (i32(m, (ebxCmd + 0x0c) >>> 0) !== 0 || i32(m, (ebxCmd + 0x10) >>> 0) !== 0) {
      return 0
    }

    m.setU32((ebxCmd + 0x0c) >>> 0, ((UNIT_GetPosX113c(m, esi) | 0) + 3) >>> 0)
    m.setU32((ebxCmd + 0x10) >>> 0, ((UNIT_GetPosY113c(m, esi) | 0) + 3) >>> 0)

    const isAnya = m.u32((esi + 0x04) >>> 0) === 0x20f
    const recorded = isAnya
      ? ACT5Q3_RecordAnyaPosition_6FC76A00_113c(m, game, esi) | 0
      : ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c(m, game, esi) | 0
    if (recorded === 0) {
      if (isAnya) {
        act5q3TriggerFrozenAnyaSpawn_6FC7CC30(m, game, esi)
      } else {
        ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c(m, game)
      }
      STATLIST_SetUnitStat113c(m, esi, 6, 0, 0)
      AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(
        m,
        esi,
        12,
        game,
        UNIT_GetPosX113c(m, esi) | 0,
        UNIT_GetPosY113c(m, esi) | 0,
      )
    }

    m.setU32((ebxCmd + 0x14) >>> 0, 1)
    m.setU32((ebxCmd + 0x18) >>> 0, 0)
    AI_Stall113c(m, game, esi, 1)
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}


/**
 * [12/45] Executes Feral Rage / Maul style melee charge-up skill (`0x6FC473C0`): validates non-town
 * target, applies `calc2` (`+0x140`) velocity stat list (`0x6FCBE7B0`), rolls melee hit (`0x6FCFE5A0`),
 * populates `D2DamageStrc` (`+0x138` phys, `+0x144` elem conversion, `0x6FCBF210`), allocates combat
 * (`0x6FCFDDE0`), adds `calc1 << 8` (`+0x13C`) to `pDmg->dwPhysDamage`, and merges `wAuraState` (`+0x80`).
 *
 * @va D2Game:0x6FC473C0
 */
export function SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC473C0)
  const ebpSkillId = nSkillId | 0
  if (ebpSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebpSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ebxSkillsTxt = (pSkillsBase + imul32(ebpSkillId, 0x23c)) >>> 0
  if (ebxSkillsTxt === 0) return 0

  const esi = pUnit >>> 0
  const game = pGame >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, esi, game)
  const pPath = esi !== 0 ? m.u32((esi + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === esi || pTarget === 0) return 0
  const pTargetRoom = UNITS_GetRoom113c(m, pTarget) >>> 0
  if ((DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) | 0) !== 0) return 0

  const lvl = nSkillLevel | 0
  const velCalc =
    SKILLS_EvalCalcByOffset113c(m, esi, m.u32((ebxSkillsTxt + 0x140) >>> 0), ebpSkillId, lvl) | 0
  SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c(m, esi, velCalc)

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x78) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, esi, ebpSkillId, lvl) | 0
    let wResultFlags = rollToHitFlags_6FCFE5A0(m, esi, pTarget, game, toHitBonus, 0, pDmg) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
    if ((wResultFlags & 1) !== 0) {
      wResultFlags = (wResultFlags | m.u16((ebxSkillsTxt + 0x12e) >>> 0)) & 0xffff
      m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
      m.setU32(pDmg, (m.u32(pDmg) | m.u32((ebxSkillsTxt + 0x130) >>> 0)) >>> 0)
      const hitClass = m.u32((ebxSkillsTxt + 0x134) >>> 0) >>> 0
      if (hitClass !== 0) {
        m.setU32((pDmg + 0x60) >>> 0, hitClass)
      }
      const physAdd =
        SKILLS_EvalCalcByOffset113c(
          m,
          esi,
          m.u32((ebxSkillsTxt + 0x138) >>> 0),
          ebpSkillId,
          lvl,
        ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, physAdd >>> 0)
      const elemType = m.u8((ebxSkillsTxt + 0x1dc) >>> 0)
      if (elemType > 0) {
        const convPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            esi,
            m.u32((ebxSkillsTxt + 0x144) >>> 0),
            ebpSkillId,
            lvl,
          ) | 0
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0)
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, elemType)
        }
      }
      skillsRollAndAddSkillElemDamage_6FCBF210(m, ebpSkillId, esi, pDmg, lvl)
    }

    const rawSrcDam = m.u8((ebxSkillsTxt + 0x1a5) >>> 0)
    const srcDam = rawSrcDam !== 0 ? rawSrcDam : 0x80
    SUNITDMG_AllocCombat113c(m, game, esi, pTarget, pDmg, srcDam)
    const ediCombatDmg = SUNITDMG_FindCombatDamageData113c(m, esi, pTarget) >>> 0
    if (ediCombatDmg !== 0) {
      const add256 =
        SKILLS_EvalCalcByOffset113c(
          m,
          esi,
          m.u32((ebxSkillsTxt + 0x13c) >>> 0),
          ebpSkillId,
          lvl,
        ) | 0
      m.setU32(
        (ediCombatDmg + 0x08) >>> 0,
        ((i32(m, (ediCombatDmg + 0x08) >>> 0) + (add256 << 8)) | 0) >>> 0,
      )
    }

    const wAuraState = sx16(m.u16((ebxSkillsTxt + 0x80) >>> 0))
    if (wAuraState >= 0 && wAuraState < i32(m, (pDataTables + 0xc4) >>> 0)) {
      let ediList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, esi, wAuraState) >>> 0
      if (ediList === 0) {
        ediList =
          STATLIST_AllocList113c(
            m,
            4,
            esi !== 0 ? i32(m, esi) : 6,
            esi !== 0 ? i32(m, (esi + 0x0c) >>> 0) : 0,
            0,
            0,
          ) >>> 0
        if (ediList === 0) return 1
        STATLIST_SetState113c(m, ediList, wAuraState)
        STATLIST_MergeStatLists113c(m, esi, ediList, 1)
        STATLIST_SetStatRemoveProc113c(m, ediList, 0x6fcbf7a0)
      }
      STATES_ToggleGfxStateFlag113c(m, esi, wAuraState, 1)
      SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(m, ebxSkillsTxt, esi, ediList, ebpSkillId, lvl)
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [13/45] Executes Find Potion (`0x6FC47600`): validates a selectable corpse without state `0x76` (`118`),
 * marks state `0x76`, refreshes the corpse's room, and rolls `calc1` (`+0x138`) against `0..99` to drop
 * a potion (`0x6FC46F70` + `0x6FCC1350`).
 *
 * @va D2Game:0x6FC47600
 */
export function SKILLS_SrvDo018_FindPotion_6FC47600_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC47600)
  const ebpSkillId = nSkillId | 0
  if (ebpSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebpSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ediSkillsTxt = (pSkillsBase + imul32(ebpSkillId, 0x23c)) >>> 0
  if (ediSkillsTxt === 0) return 0

  const esi = pUnit >>> 0
  const game = pGame >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, esi, game)
  const pPath = esi !== 0 ? m.u32((esi + 0x2c) >>> 0) >>> 0 : 0
  const ebxCorpse = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (ebxCorpse === esi || ebxCorpse === 0) return 0
  if ((SKILLS_IsSelectableCorpseWithFlag12_113c(m, ebxCorpse) | 0) === 0) return 0
  if ((STATES_CheckState113c(m, ebxCorpse, 0x76) | 0) !== 0) return 0

  STATES_ToggleGfxStateFlag113c(m, ebxCorpse, 0x76, 1)
  UNITROOM_RefreshUnit113c(m, ebxCorpse)

  const ediChance =
    SKILLS_EvalCalcByOffset113c(
      m,
      esi,
      m.u32((ediSkillsTxt + 0x138) >>> 0),
      ebpSkillId,
      nSkillLevel | 0,
    ) | 0
  const roll = rollSeedPtr113c(m, (esi + 0x20) >>> 0, 100)
  if (roll < ediChance) {
    const dwCode =
      SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c(m, game, esi, ebpSkillId) >>> 0
    skillsSpawnItemFromCodeAtUnit_6FCC1350(m, dwCode, ebxCorpse, game, 2)
  }
  return 1
}


/**
 * [14/45] Finds the next melee target in radius (`0x6FC472C0`), rolls hit (`0x6FCFE5A0`), and on hit
 * sets `wResultFlags |= 0x08`, `dwHitFlags |= 0x20`, executes immediate combat (`0x6FCFDDE0` + `0x6FCFED30`),
 * applies `pSkillsTxt->wCastOverlay` (`+0x4E`), and unlinks/frees stun state `0x15` (`21`).
 *
 * @va D2Game:0x6FC47820
 */
export function SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC47820)
  const ebpSkillId = nSkillId | 0
  if (ebpSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebpSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ebxSkillsTxt = (pSkillsBase + imul32(ebpSkillId, 0x23c)) >>> 0
  if (ebxSkillsTxt === 0) return 0

  const esi = pUnit >>> 0
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, esi, ebpSkillId) >>> 0
  if (pSkill === 0) return 0

  const game = pGame >>> 0
  const pTarget = SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c(m, game, esi, pSkill) >>> 0
  if (pTarget === 0) return 0

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    const lvl = nSkillLevel | 0
    const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, esi, ebpSkillId, lvl) | 0
    let wResultFlags = rollToHitFlags_6FCFE5A0(m, esi, pTarget, game, toHitBonus, 0, pDmg) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
    if ((wResultFlags & 1) !== 0) {
      wResultFlags = (wResultFlags | 0x08) & 0xffff
      m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
      const hitClass = ITEMS_GetUnitHitClass113c(m, esi) >>> 0
      m.setU32((pDmg + 0x60) >>> 0, hitClass)
      m.setU32(pDmg, (m.u32(pDmg) | 0x20) >>> 0)
      const physAdd =
        SKILLS_EvalCalcByOffset113c(
          m,
          esi,
          m.u32((ebxSkillsTxt + 0x138) >>> 0),
          ebpSkillId,
          lvl,
        ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, physAdd >>> 0)
      const elemType = m.u8((ebxSkillsTxt + 0x1dc) >>> 0)
      if (elemType > 0) {
        const convPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            esi,
            m.u32((ebxSkillsTxt + 0x144) >>> 0),
            ebpSkillId,
            lvl,
          ) | 0
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0)
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, elemType)
        }
      }
      skillsRollAndAddSkillElemDamage_6FCBF210(m, ebpSkillId, esi, pDmg, lvl)

      const rawSrcDam = m.u8((ebxSkillsTxt + 0x1a5) >>> 0)
      const srcDam = rawSrcDam !== 0 ? rawSrcDam : 0x80
      SUNITDMG_AllocCombat113c(m, game, esi, pTarget, pDmg, srcDam)
      SUNITDMG_ExecuteEvents113c(m, game, esi, pTarget, 1, pDmg)

      const wOverlay = sx16(m.u16((ebxSkillsTxt + 0x4e) >>> 0))
      if (wOverlay > 0 && wOverlay <= i32(m, (pDataTables + 0xbc0) >>> 0)) {
        STATES_SetMonsterSkillIconOnUnit113c(m, pTarget, wOverlay, 0)
      }

      const pStunList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pTarget, 0x15) >>> 0
      if (pStunList !== 0) {
        STATLIST_UnlinkSubList113c(m, pTarget, pStunList)
        STATLIST_FreeStatListIfNonExtended113c(m, pStunList)
      }
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [15/45] Sets `pTarget` on `pUnit` (`0x6FD80E80`), rolls melee hit (`0x6FCFE5A0`), populates skill
 * damage (`+0x138` phys, `+0x144` conversion, `0x6FCBF210`), executes combat immediately (`0x6FCFDDE0`
 * + `0x6FCFED30`), and stores `(wResultFlags & 1)` into `pUsedSkill->dwParam1` (`0x6FD9DF60`).
 *
 * @va D2Game:0x6FC47A10
 */
export function SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pUnit: number,
  pGame: number,
  pTarget: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC47A10)
  const ebxSkillId = nSkillId | 0
  if (ebxSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebxSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const esiSkillsTxt = (pSkillsBase + imul32(ebxSkillId, 0x23c)) >>> 0
  if (esiSkillsTxt === 0) return 0
  const target = pTarget >>> 0
  if (target === 0) return 0

  const ebp = pUnit >>> 0
  const game = pGame >>> 0
  const lvl = nSkillLevel | 0
  UNITS_SetTargetUnitForDynamicUnit113c(m, ebp, target)

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x70) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, ebp, ebxSkillId, lvl) | 0
    let wResultFlags = rollToHitFlags_6FCFE5A0(m, ebp, target, game, toHitBonus, 0, pDmg) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
    if ((wResultFlags & 1) !== 0) {
      wResultFlags = (wResultFlags | m.u16((esiSkillsTxt + 0x12e) >>> 0)) & 0xffff
      m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
      m.setU32(pDmg, (m.u32(pDmg) | m.u32((esiSkillsTxt + 0x130) >>> 0)) >>> 0)
      const hitClass = m.u32((esiSkillsTxt + 0x134) >>> 0) >>> 0
      if (hitClass !== 0) {
        m.setU32((pDmg + 0x60) >>> 0, hitClass)
      }
      const physAdd =
        SKILLS_EvalCalcByOffset113c(
          m,
          ebp,
          m.u32((esiSkillsTxt + 0x138) >>> 0),
          ebxSkillId,
          lvl,
        ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, physAdd >>> 0)
      const elemType = m.u8((esiSkillsTxt + 0x1dc) >>> 0)
      if (elemType > 0) {
        const convPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            ebp,
            m.u32((esiSkillsTxt + 0x144) >>> 0),
            ebxSkillId,
            lvl,
          ) | 0
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0)
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, elemType)
        }
      }
      skillsRollAndAddSkillElemDamage_6FCBF210(m, ebxSkillId, ebp, pDmg, lvl)
    }

    const rawSrcDam = m.u8((esiSkillsTxt + 0x1a5) >>> 0)
    const srcDam = rawSrcDam !== 0 ? rawSrcDam : 0x80
    SUNITDMG_AllocCombat113c(m, game, ebp, target, pDmg, srcDam)
    SUNITDMG_ExecuteEvents113c(m, game, ebp, target, 1, pDmg)

    const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, ebp) >>> 0
    if (pUsedSkill !== 0) {
      SKILLS_SetParam1113c(m, pUsedSkill, (m.u16((pDmg + 0x04) >>> 0) & 1) !== 0 ? 1 : 0)
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}


/**
 * [16/45] Starts Whirlwind (`0x6FC47F30`): resolves destination coordinates (for monsters with a target,
 * executes `0x6FC479C0` and reflects across target `2*target - unit` then `0x6FD9D840` with mask `0x3C01`;
 * for players, validates `0x6FC46B30` and clamps via `0x6FC46BB0`), sets collision mask `0x80` on the
 * destination room, refreshes AI event (`0x6FD02240`), toggles state `0x12` (`18`), and populates `pSkill`
 * params (`1..4`, `0x0C = 0x80`).
 *
 * @va D2Game:0x6FC47F30
 */
export function SKILLS_SrvSt03_WhirlwindStart_6FC47F30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC47F30)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0 || ((pSkillsBase + imul32(skillId, 0x23c)) >>> 0) === 0) return 0

  const esi = pUnit >>> 0
  const ebxGame = pGame >>> 0
  const ebpSkill = SKILLS_GetUsedSkillMemPort113c(m, esi) >>> 0
  if (ebpSkill === 0) return 0

  const unitType = esi !== 0 ? i32(m, esi) : 6
  const bIsMonster = unitType === 1 ? 1 : 0

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x28) >>> 0
  try {
    const pCoordX = sp
    const pCoordY = (sp + 0x04) >>> 0
    const pStepPt = (sp + 0x08) >>> 0
    const pDummyRoom = (sp + 0x10) >>> 0
    let finalX = 0
    let finalY = 0

    if (bIsMonster !== 0) {
      SUNIT_ValidatePathTargetUnit113c(m, esi, ebxGame)
      const pPath = esi !== 0 ? m.u32((esi + 0x2c) >>> 0) >>> 0 : 0
      const ediTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
      let candX = 0
      let candY = 0
      if (ediTarget === esi || ediTarget === 0) {
        if (
          skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, esi, ebxGame, pCoordX, pCoordY) === 0
        ) {
          SKILLS_SetUsedSkillMemPort113c(m, esi, 0)
          return 0
        }
        SKILLS_SetParam4113c(m, ebpSkill, -1)
        candX = i32(m, pCoordX)
        candY = i32(m, pCoordY)
      } else {
        PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c(m, ediTarget, esi, ebpSkill, ebxGame)
        if ((SUNIT_IsDeadOrDying113c(m, esi) | 0) !== 0) {
          return 0
        }
        const tx = UNIT_GetPosX113c(m, ediTarget) | 0
        const ty = UNIT_GetPosY113c(m, ediTarget) | 0
        const ux = UNIT_GetPosX113c(m, esi) | 0
        const uy = UNIT_GetPosY113c(m, esi) | 0
        candX = (tx * 2 - ux) | 0
        candY = (ty * 2 - uy) | 0
      }

      m.setU32(pStepPt, candX >>> 0)
      m.setU32((pStepPt + 0x04) >>> 0, candY >>> 0)
      const sizeX = UNITS_GetUnitSizeX113c(m, esi) | 0
      const pUnitRoom = UNITS_GetRoom113c(m, esi) >>> 0
      if (
        (COLLISION_FindFreePositionSimple113c(m, pUnitRoom, pStepPt, sizeX, 0x3c01, 0) | 0) === 0
      ) {
        SKILLS_SetUsedSkillMemPort113c(m, esi, 0)
        return 0
      }
      finalX = i32(m, pStepPt)
      finalY = i32(m, (pStepPt + 0x04) >>> 0)
    } else {
      if (skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, esi, ebxGame, pCoordX, pCoordY) === 0) {
        return 0
      }
      const tx = i32(m, pCoordX)
      const ty = i32(m, pCoordY)
      if ((PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c(m, skillId, ty, esi, tx) | 0) === 0) {
        return 0
      }
      m.setU32(pDummyRoom, 0)
      if (
        (SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c(
          m,
          esi,
          skillId,
          nSkillLevel | 0,
          pCoordX,
          pCoordY,
          pDummyRoom,
        ) |
          0) ===
        0
      ) {
        return 0
      }
      finalX = i32(m, pCoordX)
      finalY = i32(m, pCoordY)
    }

    const pUnitRoom = UNITS_GetRoom113c(m, esi) >>> 0
    const pDestRoom = ROOM_FindRoomContainingSubtile113c(m, pUnitRoom, finalX, finalY) >>> 0
    const nPattern = PATH_GetUnitCollisionPattern113c(m, esi) | 0
    COLLISION_SetUnitCollisionMaskWithPattern113c(m, pDestRoom, finalX, finalY, nPattern, 0x80)
    MONSTER_RefreshAiEvent113c(m, esi, 1)
    STATES_ToggleGfxStateFlag113c(m, esi, 0x12, 1)
    SKILLS_SetParam1113c(m, ebpSkill, finalX)
    SKILLS_SetParam2113c(m, ebpSkill, finalY)
    if (bIsMonster !== 0) {
      const pTargetUnit = SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, esi, ebxGame) >>> 0
      if (pTargetUnit !== 0) {
        SKILLS_SetParam3113c(m, ebpSkill, i32(m, pTargetUnit))
        SKILLS_SetParam4113c(m, ebpSkill, i32(m, (pTargetUnit + 0x0c) >>> 0))
      }
    }
    SKILLS_SetParam0C113c(m, ebpSkill, 0x80)
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [17/45] Starts Charge (`0x6FC48600`): resolves melee target position (`0x6FDA1870`), falling back to
 * immediate weapon/monster attack (`0x6FCC2DE0`) when already in melee range (`0x6FD826C0`), or sets
 * collision mask `0x80`, refreshes AI event, populates `pSkill` params (`0x0C = 0x1080`), toggles state
 * `0x12`, and applies stun (`0x6FCC2F90`, `duration = 100`) if the target has state `0x36` (`54`).
 *
 * @va D2Game:0x6FC48600
 */
export function SKILLS_SrvSt06_ChargeStart_6FC48600_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  _nSkillLevel = 1,
): number {
  hitD2GameVa113c(0x6FC48600)
  const esi = pUnit >>> 0
  const ebxGame = pGame >>> 0
  const ebpSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, esi, nSkillId | 0) >>> 0
  if (ebpSkill === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, esi, ebxGame)
  const pPath = esi !== 0 ? m.u32((esi + 0x2c) >>> 0) >>> 0 : 0
  const rawTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  const ediTarget = rawTarget === esi ? 0 : rawTarget

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x10) >>> 0
  try {
    const pOutX = sp
    const pOutY = (sp + 0x04) >>> 0
    m.setU32(pOutX, 0)
    m.setU32(pOutY, 0)
    if ((SKILLS_FindMeleeTargetPosition113c(m, esi, ediTarget, pOutX, pOutY) | 0) === 0) {
      if (ediTarget === 0) return 0
      if ((UNITS_CanUnitMeleeAttackTarget113c(m, esi, ediTarget, 0) | 0) === 0) return 0
      SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c(
        m,
        esi,
        ebxGame,
        ediTarget,
      )
      return 1
    }

    const ebxRoom = UNITS_GetRoom113c(m, esi) >>> 0
    if (ebxRoom === 0) return 0
    const nPattern = PATH_GetUnitCollisionPattern113c(m, esi) | 0
    const targetX = i32(m, pOutX)
    const targetY = i32(m, pOutY)
    COLLISION_SetUnitCollisionMaskWithPattern113c(m, ebxRoom, targetX, targetY, nPattern, 0x80)
    MONSTER_RefreshAiEvent113c(m, esi, 1)
    SKILLS_SetParam1113c(m, ebpSkill, targetX)
    SKILLS_SetParam2113c(m, ebpSkill, targetY)
    if (ediTarget !== 0) {
      SKILLS_SetParam3113c(m, ebpSkill, i32(m, ediTarget))
      SKILLS_SetParam4113c(m, ebpSkill, i32(m, (ediTarget + 0x0c) >>> 0))
    } else {
      SKILLS_SetParam3113c(m, ebpSkill, 6)
    }
    SKILLS_SetParam0C113c(m, ebpSkill, 0x1080)
    STATES_ToggleGfxStateFlag113c(m, esi, 0x12, 1)
    if (ediTarget !== 0 && (STATES_CheckState113c(m, ediTarget, 0x36) | 0) !== 0) {
      SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c(m, 0x64, ediTarget, ebxGame)
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}


/**
 * [18/45] Executes Maul / Hunger / Rabies style melee skill hit (`0x6FC489A0`): rolls melee hit
 * (`0x6FCFE5A0`), populates `D2DamageStrc` (`+0x138` phys, `+0x144` elem conversion, `0x6FCBF210`),
 * allocates combat (`0x6FCFDDE0`), and when `wAuraState` (`+0x80`) is valid, creates/refreshes a
 * timed state stat list (`calc2` at `+0x13C`, min `+10` frames, event `0x0C`) and applies skill
 * aura stat calcs (`0x6FC648E0`).
 *
 * @va D2Game:0x6FC489A0
 */
export function SKILLS_SrvDo021_MeleeHitWithTimedAuraState_6FC489A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC489A0)
  const ebpSkillId = nSkillId | 0
  const game = pGame >>> 0
  const esi = pUnit >>> 0
  if (ebpSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebpSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ebxSkillsTxt = (pSkillsBase + imul32(ebpSkillId, 0x23c)) >>> 0
  if (ebxSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, esi, game)
  const pPath = esi !== 0 ? m.u32((esi + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === esi || pTarget === 0) return 0

  const lvl = nSkillLevel | 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x78) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, esi, ebpSkillId, lvl) | 0
    let wResultFlags = rollToHitFlags_6FCFE5A0(m, esi, pTarget, game, toHitBonus, 0, pDmg) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
    if ((wResultFlags & 1) !== 0) {
      wResultFlags = (wResultFlags | m.u16((ebxSkillsTxt + 0x12e) >>> 0)) & 0xffff
      m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
      m.setU32(pDmg, (m.u32(pDmg) | m.u32((ebxSkillsTxt + 0x130) >>> 0)) >>> 0)
      const hitClass = m.u32((ebxSkillsTxt + 0x134) >>> 0) >>> 0
      if (hitClass !== 0) {
        m.setU32((pDmg + 0x60) >>> 0, hitClass)
      }
      const physAdd =
        SKILLS_EvalCalcByOffset113c(
          m,
          esi,
          m.u32((ebxSkillsTxt + 0x138) >>> 0),
          ebpSkillId,
          lvl,
        ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, physAdd >>> 0)
      const elemType = m.u8((ebxSkillsTxt + 0x1dc) >>> 0)
      if (elemType > 0) {
        const convPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            esi,
            m.u32((ebxSkillsTxt + 0x144) >>> 0),
            ebpSkillId,
            lvl,
          ) | 0
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0)
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, elemType)
        }
      }
      skillsRollAndAddSkillElemDamage_6FCBF210(m, ebpSkillId, esi, pDmg, lvl)
    }

    const bSrcDam = m.u8((ebxSkillsTxt + 0x1a5) >>> 0)
    const srcDam = bSrcDam !== 0 ? bSrcDam : 0x80
    SUNITDMG_AllocCombat113c(m, game, esi, pTarget, pDmg, srcDam)

    const wAuraState = sx16(m.u16((ebxSkillsTxt + 0x80) >>> 0))
    if (wAuraState >= 0 && wAuraState < i32(m, (pDataTables + 0xc4) >>> 0)) {
      const gameFrame = game !== 0 ? i32(m, (game + 0xa8) >>> 0) : 0
      const calcDur =
        SKILLS_EvalCalcByOffset113c(
          m,
          esi,
          m.u32((ebxSkillsTxt + 0x13c) >>> 0),
          ebpSkillId,
          lvl,
        ) | 0
      let ebpExpire = (gameFrame + calcDur) | 0
      if (ebpExpire <= gameFrame) {
        ebpExpire = (gameFrame + 10) | 0
      }

      let ediStatList =
        STATLIST_GetStatListFromUnitAndStateMemPort113c(m, esi, wAuraState) >>> 0
      if (ediStatList === 0) {
        ediStatList =
          STATLIST_AllocList113c(
            m,
            2,
            esi !== 0 ? i32(m, esi) : 0,
            esi !== 0 ? i32(m, (esi + 0x0c) >>> 0) : 0,
            0,
            ebpExpire,
          ) >>> 0
        if (ediStatList === 0) {
          return 1
        }
        STATLIST_SetState113c(m, ediStatList, wAuraState)
        void STATES_OnTimedStateRemoved113c
        STATLIST_SetStatRemoveProc113c(m, ediStatList, 0x6fcbf7a0)
        STATLIST_MergeStatLists113c(m, esi, ediStatList, 1)
        STATES_ToggleGfxStateFlag113c(m, esi, wAuraState, 1)
      }
      STATLIST_SetExpireFrameEx113c(m, ediStatList, ebpExpire)
      EVENT_SetEventFull113c(m, game, esi, 0x0c, ebpExpire, 0, 0)
      SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
        m,
        ebxSkillsTxt,
        esi,
        ediStatList,
        ebpSkillId,
        lvl,
      )
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [19/45] Sends handshake packet `0x8B` (`bPacketId = 1`, `0x6FCAC420`), queues a 1-byte `0x00`
 * packet to `pClient` (`0x6FCAA3E0`), asserts `pClient != 0` (`line 0x95F`), and sets
 * `pClient->dwInitState = 1` (`+0x04`).
 *
 * @va D2Game:0x6FC4AC60
 */
export function CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c(
  m: D2KernMemory113c,
  pClient: number,
  pGame = 0,
): void {
  hitD2GameVa113c(0x6FC4AC60)
  const esi = pClient >>> 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x08) >>> 0
  try {
    NET_SendPacket8B_GameHandshake_6FCAC420_113c(m, pGame >>> 0, 1, esi)
    m.setU8(sp, 0)
    NET_QueuePacketToClientBuffer113c(m, esi, 1, sp, 1)
    if (esi === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x95f)
    }
    m.setU32((esi + 0x04) >>> 0, 1)
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [20/45] Flushes nearby player positions into packet `0x16` for `pClient` (`0x6FC4C060`):
 * validates `pClient->pPacketBuffer` (`+0x1B8`), player unit (`0x6FC6AD10`), and `dwInitSubState >= 10`
 * (`+0x1B0`), computes remaining capacity `(499 - dwBufUsed) / 9` (asserting `<= 55`), collects
 * positions (`0x6FC6AD80`), and flushes packet `0x16` (`0x6FCAA2A0`).
 *
 * @va D2Game:0x6FC4C060
 */
export function CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c(
  m: D2KernMemory113c,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC4C060)
  const esi = pClient >>> 0
  if (esi === 0) return
  const ediBuf = m.u32((esi + 0x1b8) >>> 0) >>> 0
  if (ediBuf === 0) return
  const pPlayer = CLIENTS_GetPlayerUnit113c(m, esi, 0) >>> 0
  if (pPlayer === 0) return
  if (i32(m, (esi + 0x1b0) >>> 0) < 10) return
  if (i32(m, pPlayer) !== 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xec4)
  }
  const nUsed = i32(m, ediBuf)
  const nMaxCount = sdiv32((0x1f3 - nUsed) | 0, 9) | 0
  if (nMaxCount <= 0) return
  if (nMaxCount >>> 0 > 0x37) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xece)
  }
  CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c(m, esi, nMaxCount)
  NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c(m, esi)
}


function resolveClientPlayerUnitInline113c(m: D2KernMemory113c, pClient: number): number {
  const edi = pClient >>> 0
  if ((m.u8((edi + 0x3d4) >>> 0) & 1) !== 0) {
    return m.u32((edi + 0x174) >>> 0) >>> 0
  }
  const cached = m.u32((edi + 0x174) >>> 0) >>> 0
  if (cached === 0) return 0
  const resolved =
    SUNIT_GetServerUnit113c(
      m,
      m.u32((edi + 0x1a8) >>> 0),
      i32(m, (edi + 0x16c) >>> 0),
      i32(m, (edi + 0x170) >>> 0),
    ) >>> 0
  if (resolved === 0) {
    m.setU32((edi + 0x174) >>> 0, 0)
  }
  return resolved
}

/**
 * [21/45] Sends item synchronization packets for all items in `pUnit->pInventory` (`+0x60`) to
 * `pClient`: equipped items (`nodePos == 3`) via packet `0x9D` action `6` (`0x6FCAB0F0`), cursor
 * items (`nodePos == 1`) on the client's own player via packet `0x04` (`0x6FCADF70`), and belt
 * items (`nodePos == 2`) on the client's own player via packet `0x0E` (`0x6FCADE50`).
 *
 * @va D2Game:0x6FC57C90
 */
export function PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c(
  m: D2KernMemory113c,
  pClient: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC57C90)
  const edi = pClient >>> 0
  const ebp = pUnit >>> 0
  const pInventory = ebp !== 0 ? m.u32((ebp + 0x60) >>> 0) >>> 0 : 0
  if (pInventory === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x186)
  }
  let ebxNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  while (ebxNode !== 0) {
    const esiItem = INVENTORY_UnitIsItem113c(m, ebxNode) >>> 0
    const nodePos = INVENTORY_GetItemNodePositionOther113c(m, ebxNode) | 0
    if (nodePos === 3) {
      NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 6, ebp, esiItem, edi, 0, 0)
    } else {
      if (edi === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0xfb)
      }
      const pClientPlayer = resolveClientPlayerUnitInline113c(m, edi)
      if (
        ebp === pClientPlayer &&
        (INVENTORY_GetItemNodePositionOther113c(m, ebxNode) | 0) === 1
      ) {
        ITEMS_SendCursorPutItemPacket04_6FCADF70_113c(m, ebp, edi, esiItem, 0)
      } else {
        const pClientPlayer2 = resolveClientPlayerUnitInline113c(m, edi)
        if (
          ebp === pClientPlayer2 &&
          (INVENTORY_GetItemNodePositionOther113c(m, ebxNode) | 0) === 2
        ) {
          ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c(m, ebp, edi, esiItem, 0)
        }
      }
    }
    ebxNode = INVENTORY_GetNextItem113c(m, ebxNode) >>> 0
  }
}

/**
 * [22/45] Applies player death gold penalty/drop (`0x6FC58180`) and, unless killed by a player or
 * a player-owned monster minion (`pAiGeneral + 0x28..0x30`), applies player death experience
 * penalty (`0x6FC57730`).
 *
 * @va D2Game:0x6FC583A0
 */
export function PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c(
  m: D2KernMemory113c,
  pVictimUnit: number,
  pGame: number,
  pAttackerUnit: number,
): void {
  hitD2GameVa113c(0x6FC583A0)
  const esiVictim = pVictimUnit >>> 0
  const ebxGame = pGame >>> 0
  const ediAttacker = pAttackerUnit >>> 0
  PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c(m, esiVictim, ebxGame, ediAttacker)
  if (ediAttacker !== 0) {
    const uType = i32(m, ediAttacker)
    if (uType === 0) return
    if (uType === 1) {
      const pMonData = m.u32((ediAttacker + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
        if (pAiGeneral !== 0) {
          const pOwnerGame = m.u32((pAiGeneral + 0x28) >>> 0) >>> 0
          if (pOwnerGame !== 0) {
            const pOwner =
              SUNIT_GetServerUnit113c(
                m,
                pOwnerGame,
                i32(m, (pAiGeneral + 0x30) >>> 0),
                i32(m, (pAiGeneral + 0x2c) >>> 0),
              ) >>> 0
            if (pOwner !== 0 && i32(m, pOwner) === 0) {
              return
            }
          }
        }
      }
    }
  }
  PLAYER_ApplyDeathExpPenalty_6FC57730_113c(m, ebxGame, esiVictim)
}

/**
 * [23/45] Validates whether `pPlayer` can manipulate `pItem` while interacting (`+0x6C`, `+0x68`,
 * `+0x64`) or trading (`pPlayerData + 0x4C`), checking monster interaction lock (`0x6FC684F0`) or
 * trade item session validity (`0x6FC93860`).
 *
 * @va D2Game:0x6FC588C0
 */
export function PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FC588C0)
  const esi = pPlayer >>> 0
  const ebx = pGame >>> 0
  const ebpItem = pItem >>> 0
  if (esi === 0) return 0
  const bInteracting = m.u8((esi + 0x6c) >>> 0)
  const nInteractId = i32(m, (esi + 0x64) >>> 0)
  const ediInteractType = i32(m, (esi + 0x68) >>> 0)
  if (bInteracting !== 0) {
    const pInteractUnit = SUNIT_GetServerUnit113c(m, ebx, ediInteractType, nInteractId) >>> 0
    if (pInteractUnit === 0) {
      m.setU32((esi + 0x64) >>> 0, 0xffffffff)
      m.setU32((esi + 0x68) >>> 0, 6)
      m.setU8((esi + 0x6c) >>> 0, 0)
      return 0
    }
    if (ediInteractType === 1) {
      return MONSTER_CheckPlayerInteractUnlocked113c(m, pInteractUnit, esi) | 0
    }
  } else {
    const pPlayerData = UNITS_GetPlayerData113c(m, esi) >>> 0
    if (pPlayerData !== 0 && m.u32((pPlayerData + 0x4c) >>> 0) !== 0) {
      return 0
    }
  }
  return PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c(m, esi, ebx, ebpItem) | 0
}

/**
 * [24/45] Wrapper that invokes `SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c` with
 * `nSkillId = 124` (`0x7C`, Redemption) and `bSkipRoll = 1`.
 *
 * @va D2Game:0x6FC59910
 */
export function MISSILES_RedeemCorpseWithSkill124_6FC59910_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCasterUnit: number,
  pCorpseUnit: number,
  nLevel: number,
  _nUnused = 0,
): number {
  hitD2GameVa113c(0x6FC59910)
  void pGame
  return (
    SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c(
      m,
      pCasterUnit >>> 0,
      0x7c,
      pCorpseUnit >>> 0,
      nLevel | 0,
      1,
    ) | 0
  )
}

/**
 * [25/45] Guided missile retargeting callback (`0x6FC5B070`): unless `MISSILE_GetTargetX & 4` is
 * set or the missile lacks a bound owner, scans for a hostile target within `pMissilesTxt->dwParam1`
 * (`+0x3C`, `dwExtraFlags = 3`, `0x6FCC0F40`) and reinitializes the guided/linear path (`0x6FC597C0`).
 *
 * @va D2Game:0x6FC5B070
 */
export function MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c(
  m: D2KernMemory113c,
  pMissile: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC5B070)
  const esi = pMissile >>> 0
  const ebpGame = pGame >>> 0
  if (esi === 0) return 1
  const missileId = i32(m, (esi + 0x04) >>> 0)
  if (missileId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || missileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(missileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  const ebxRadius = i32(m, (pMissilesTxt + 0x3c) >>> 0)
  if (((MISSILE_GetTargetX113c(m, esi) | 0) & 4) !== 0) return 1
  if (((m.u32((esi + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const ediOwner =
    SUNIT_GetServerUnit113c(
      m,
      ebpGame,
      i32(m, (esi + 0x94) >>> 0),
      i32(m, (esi + 0x98) >>> 0),
    ) >>> 0
  if (ediOwner === 0) return 1

  const nY = UNIT_GetPosY113c(m, esi) | 0
  const nX = UNIT_GetPosX113c(m, esi) | 0
  const pTarget =
    SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c(
      m,
      3,
      ebxRadius,
      -1,
      0,
      nX,
      ebpGame,
      ediOwner,
      nY,
    ) >>> 0
  MISSILES_InitGuidedOrLinearPath_6FC597C0_113c(m, esi, pTarget)
  return 0
}


/**
 * [26/45] Spawns a burst of `dwHitPar1` (`+0x4C`) hit sub-missiles (`sHitSubMissile1` at `+0x24`)
 * at `pMissile`'s coordinates (`0x6FCC26E0`), using drunken path init (`0x6FC59210`) when
 * `dwHitPar2` (`+0x50`) is non-zero.
 *
 * @va D2Game:0x6FC5C3B0
 */
export function MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pHitTarget = 0,
): number {
  hitD2GameVa113c(0x6FC5C3B0)
  const ebpGame = pGame >>> 0
  const esi = pMissile >>> 0
  if (esi === 0) return 1
  const missileId = i32(m, (esi + 0x04) >>> 0)
  if (missileId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || missileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const ebxMissilesTxt = (pMissilesBase + imul32(missileId, 0x1a4)) >>> 0
  if (ebxMissilesTxt === 0) return 1
  const subMissileId = sx16(m.u16((ebxMissilesTxt + 0x24) >>> 0))
  if (subMissileId < 0) return 1
  const nCount = i32(m, (ebxMissilesTxt + 0x4c) >>> 0)
  if (nCount <= 0) return 1

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x5c) >>> 0
  try {
    const pParams = sp
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 3)
    m.setU32((pParams + 0x14) >>> 0, (UNIT_GetPosX113c(m, esi) | 0) >>> 0)
    m.setU32((pParams + 0x18) >>> 0, (UNIT_GetPosY113c(m, esi) | 0) >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, (MISSILE_GetSkill113c(m, esi) | 0) >>> 0)
    const pOwner = SUNIT_GetOwnerUnit113c(m, esi, ebpGame) >>> 0
    m.setU32((pParams + 0x04) >>> 0, pOwner)
    m.setU32((pParams + 0x10) >>> 0, subMissileId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, (MISSILE_GetLevel113c(m, esi) | 0) >>> 0)
    if (i32(m, (ebxMissilesTxt + 0x50) >>> 0) !== 0) {
      void MISSILES_InitDrunkenPath_6FC59210_113c
      m.setU32((pParams + 0x54) >>> 0, 0x6fc59210)
    }
    SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c(m, pParams, ebpGame, nCount)
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [27/45] Spawns a scaled burst of hit sub-missiles (`sHitSubMissile1` at `+0x24`, drunken path
 * `0x6FC59210`) using `dwHitPar1 + (lvl - 1) * dwHitPar2` or fallback `SkillsTxt.calc4` (`+0x144`).
 *
 * @va D2Game:0x6FC5C5B0
 */
export function MISSILES_SrvHit_SpawnScaledBurstSubMissiles_6FC5C5B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pHitTarget = 0,
): number {
  hitD2GameVa113c(0x6FC5C5B0)
  const game = pGame >>> 0
  const esi = pMissile >>> 0
  if (esi === 0) return 1
  const missileId = i32(m, (esi + 0x04) >>> 0)
  if (missileId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || missileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const ebxMissilesTxt = (pMissilesBase + imul32(missileId, 0x1a4)) >>> 0
  if (ebxMissilesTxt === 0) return 1
  const subMissileId = sx16(m.u16((ebxMissilesTxt + 0x24) >>> 0))
  if (subMissileId < 0) return 1
  if (((m.u32((esi + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const ebpOwner =
    SUNIT_GetServerUnit113c(
      m,
      game,
      i32(m, (esi + 0x94) >>> 0),
      i32(m, (esi + 0x98) >>> 0),
    ) >>> 0
  if (ebpOwner === 0) return 1

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x5c) >>> 0
  try {
    const pParams = sp
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 3)
    m.setU32((pParams + 0x14) >>> 0, (UNIT_GetPosX113c(m, esi) | 0) >>> 0)
    m.setU32((pParams + 0x18) >>> 0, (UNIT_GetPosY113c(m, esi) | 0) >>> 0)
    m.setU32((pParams + 0x04) >>> 0, ebpOwner)
    m.setU32((pParams + 0x10) >>> 0, subMissileId >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, (MISSILE_GetSkill113c(m, esi) | 0) >>> 0)
    m.setU32((pParams + 0x30) >>> 0, (MISSILE_GetLevel113c(m, esi) | 0) >>> 0)
    void MISSILES_InitDrunkenPath_6FC59210_113c
    m.setU32((pParams + 0x54) >>> 0, 0x6fc59210)

    const lvlForHitPar = MISSILE_GetLevel113c(m, esi) | 0
    let nCount =
      (i32(m, (ebxMissilesTxt + 0x4c) >>> 0) +
        imul32(lvlForHitPar - 1, i32(m, (ebxMissilesTxt + 0x50) >>> 0))) |
      0
    if (nCount <= 0) {
      const ediSkill = MISSILE_GetSkill113c(m, esi) | 0
      const esiLvl = MISSILE_GetLevel113c(m, esi) | 0
      const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, ediSkill) >>> 0
      if (pSkillsTxt === 0) return 1
      nCount =
        SKILLS_EvalCalcByOffset113c(
          m,
          ebpOwner,
          m.u32((pSkillsTxt + 0x144) >>> 0),
          ediSkill,
          esiLvl,
        ) | 0
      if (nCount < 1) {
        nCount = 1
      }
    }
    SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c(m, pParams, game, nCount)
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [28/45] Chain Lightning / bounce projectile hit handler (`0x6FC5D020`): when `MISSILE_GetTargetX > 1`
 * and `pHitTarget != 0`, scans within `dwHitPar1` (`+0x4C`) or `SkillsTxt.dwAuraRangeCalc` (`+0x64`)
 * (`dwExtraFlags = 0x88583`, excluding `pHitTarget->dwUnitId`), spawns the next bounce projectile
 * (`dwFlags = 0x21`), and decrements `TargetX` on the new missile.
 *
 * @va D2Game:0x6FC5D020
 */
export function MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitTarget: number,
): number {
  hitD2GameVa113c(0x6FC5D020)
  const ebxGame = pGame >>> 0
  const esi = pMissile >>> 0
  if (esi === 0) return 1
  const missileId = i32(m, (esi + 0x04) >>> 0)
  if (missileId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || missileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const ediMissilesTxt = (pMissilesBase + imul32(missileId, 0x1a4)) >>> 0
  if (ediMissilesTxt === 0) return 1

  if (((m.u32((esi + 0xc8) >>> 0) >>> 10) & 1) === 0) return 3
  const ebpOwner =
    SUNIT_GetServerUnit113c(
      m,
      ebxGame,
      i32(m, (esi + 0x94) >>> 0),
      i32(m, (esi + 0x98) >>> 0),
    ) >>> 0
  if (ebpOwner === 0) return 3
  const hitTarget = pHitTarget >>> 0
  if (hitTarget === 0) return 3
  const nChainLeft = MISSILE_GetTargetX113c(m, esi) | 0
  if (nChainLeft <= 1) return 3

  const posX = UNIT_GetPosX113c(m, esi) | 0
  const posY = UNIT_GetPosY113c(m, esi) | 0
  let nRadius = i32(m, (ediMissilesTxt + 0x4c) >>> 0)
  if (nRadius <= 0) {
    const skillId = MISSILE_GetSkill113c(m, esi) | 0
    const lvl = MISSILE_GetLevel113c(m, esi) | 0
    const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId) >>> 0
    if (pSkillsTxt === 0) return 3
    nRadius =
      SKILLS_EvalCalcByOffset113c(
        m,
        ebpOwner,
        m.u32((pSkillsTxt + 0x64) >>> 0),
        skillId,
        lvl,
      ) | 0
    if (nRadius < 1) {
      nRadius = 1
    }
  }

  const ebxNextTarget =
    SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c(
      m,
      0x88583,
      nRadius,
      i32(m, (hitTarget + 0x0c) >>> 0),
      0,
      posX,
      ebxGame,
      ebpOwner,
      posY,
    ) >>> 0
  if (ebxNextTarget === 0 || ebxNextTarget === hitTarget) return 3

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x5c) >>> 0
  try {
    const pParams = sp
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 0x21)
    m.setU32((pParams + 0x04) >>> 0, ebpOwner)
    m.setU32((pParams + 0x0c) >>> 0, ebxNextTarget)
    m.setU32((pParams + 0x10) >>> 0, m.u32((esi + 0x04) >>> 0))
    m.setU32((pParams + 0x14) >>> 0, posX >>> 0)
    m.setU32((pParams + 0x18) >>> 0, posY >>> 0)
    m.setU32((pParams + 0x1c) >>> 0, (UNIT_GetPosX113c(m, ebxNextTarget) | 0) >>> 0)
    m.setU32((pParams + 0x20) >>> 0, (UNIT_GetPosY113c(m, ebxNextTarget) | 0) >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, (MISSILE_GetSkill113c(m, esi) | 0) >>> 0)
    m.setU32((pParams + 0x30) >>> 0, (MISSILE_GetLevel113c(m, esi) | 0) >>> 0)
    const pNewMissile = MISSILE_CreateServerProjectile113c(m, ebxGame, pParams) >>> 0
    if (pNewMissile !== 0) {
      MISSILE_SetTargetX113c(m, pNewMissile, (nChainLeft - 1) | 0)
    }
    return 3
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [29/45] Decoy / Attract projectile hit handler (`0x6FC5E740`): resolves the target unit from
 * `pGame->pUnitList[4][MISSILE_GetTargetX & 0x7F]` (`+0x1920`), verifies squared distance is within
 * linear skill param1/param2 radius (`0x6FC21B10`), and applies taunt/attract (`0x6FCD2120`) for
 * `param6` (`0x6FC21EC0`) frames.
 *
 * @va D2Game:0x6FC5E740
 */
export function MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitTarget: number,
): number {
  hitD2GameVa113c(0x6FC5E740)
  const ebxGame = pGame >>> 0
  const ediMissile = pMissile >>> 0
  const ebpSkill = MISSILE_GetSkill113c(m, ediMissile) | 0
  const nLevel = MISSILE_GetLevel113c(m, ediMissile) | 0
  if (ebpSkill < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebpSkill >= i32(m, (pDataTables + 0xba0) >>> 0)) return 1
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0 || ((pSkillsBase + imul32(ebpSkill, 0x23c)) >>> 0) === 0) return 1
  if (ediMissile === 0) return 1
  if (((m.u32((ediMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1
  const pOwner =
    SUNIT_GetServerUnit113c(
      m,
      ebxGame,
      i32(m, (ediMissile + 0x94) >>> 0),
      i32(m, (ediMissile + 0x98) >>> 0),
    ) >>> 0
  if (pOwner === 0) return 1

  const esiTarget = pHitTarget >>> 0
  if (esiTarget === 0 || i32(m, esiTarget) !== 1) return 1

  const nTargetGuid = MISSILE_GetTargetX113c(m, ediMissile) >>> 0
  if (ebxGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
  }
  let ediAttractSrc = m.u32((ebxGame + (nTargetGuid & 0x7f) * 4 + 0x1920) >>> 0) >>> 0
  while (ediAttractSrc !== 0 && m.u32((ediAttractSrc + 0x0c) >>> 0) !== nTargetGuid) {
    ediAttractSrc = m.u32((ediAttractSrc + 0xe4) >>> 0) >>> 0
  }
  if (ediAttractSrc === 0) return 1

  const nRadius = SKILLS_EvalLinearParam12_6FC21B10_113c(m, ebpSkill, nLevel) | 0
  const distSq =
    PATH_ComputeSquaredDistance113c(
      UNIT_GetPosX113c(m, ediAttractSrc) | 0,
      UNIT_GetPosY113c(m, ediAttractSrc) | 0,
      UNIT_GetPosX113c(m, esiTarget) | 0,
      UNIT_GetPosY113c(m, esiTarget) | 0,
    ) | 0
  if (distSq < imul32(nRadius, nRadius)) {
    const nDuration = SKILLS_GetParam6Fast_6FC21EC0_113c(m, ebpSkill) | 0
    MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c(m, ediAttractSrc, ebxGame, esiTarget, nDuration)
  }
  return 1
}

/**
 * [30/45] Taunt / Howl style level-gated monster attract hit handler (`0x6FC5EAE0`): checks that
 * `pHitTarget` is a monster without `wAuraTargetState` (`+0x82`) and that
 * `ownerLvl + skillLvl + param2 > targetLvl`, then applies `0x6FCD2120` for linear param5/param6
 * frames (`0x6FC21A90`).
 *
 * @va D2Game:0x6FC5EAE0
 */
export function MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitTarget: number,
): number {
  hitD2GameVa113c(0x6FC5EAE0)
  const game = pGame >>> 0
  const esiMissile = pMissile >>> 0
  const ebxSkill = MISSILE_GetSkill113c(m, esiMissile) | 0
  const nLevel = MISSILE_GetLevel113c(m, esiMissile) | 0
  if (ebxSkill < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebxSkill >= i32(m, (pDataTables + 0xba0) >>> 0)) return 1
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 1
  const ediSkillsTxt = (pSkillsBase + imul32(ebxSkill, 0x23c)) >>> 0
  if (ediSkillsTxt === 0 || esiMissile === 0) return 1
  if (((m.u32((esiMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1
  const ebpOwner =
    SUNIT_GetServerUnit113c(
      m,
      game,
      i32(m, (esiMissile + 0x94) >>> 0),
      i32(m, (esiMissile + 0x98) >>> 0),
    ) >>> 0
  if (ebpOwner === 0) return 1

  const esiTarget = pHitTarget >>> 0
  if (esiTarget === 0 || i32(m, esiTarget) !== 1) return 0
  const wAuraTargetState = sx16(m.u16((ediSkillsTxt + 0x82) >>> 0))
  if (wAuraTargetState < 0 || wAuraTargetState >= i32(m, (pDataTables + 0xc4) >>> 0)) {
    return 1
  }
  if ((STATES_CheckState113c(m, esiTarget, wAuraTargetState) | 0) !== 0) {
    return 0
  }
  const ownerLvl = STATLIST_GetUnitStat113c(m, ebpOwner, 12, 0) | 0
  const param2 = SKILLS_GetParam2Fast_6FC21BC0_113c(m, ebxSkill) | 0
  const targetLvl = STATLIST_GetUnitStat113c(m, esiTarget, 12, 0) | 0
  if (((param2 + ownerLvl + nLevel) | 0) > targetLvl) {
    const nDuration = SKILLS_EvalLinearParam56_6FC21A90_113c(m, ebxSkill, nLevel) | 0
    MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c(m, ebpOwner, game, esiTarget, nDuration)
  }
  return 0
}


/**
 * [31/45] Find Gold / Stash Fountain projectile tick handler (`0x6FC608D0`): plays sound `0x5C` on
 * the target object when `nRemainingFrames == 1`, operates the stash (`0x6FC8DBF0`) and enables gold
 * spawning (`TargetY = 1`) when `nRemainingFrames == wRange - dwVel`, periodically drops gold piles
 * (`'gld '`) within `[-dwParam2, +dwParam2]`, and advances linear motion (`0x6FC5F320`).
 *
 * @va D2Game:0x6FC608D0
 */
export function MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC608D0)
  const ediGame = pGame >>> 0
  const ebx = pMissile >>> 0
  if (ebx === 0) return 2
  const missileId = i32(m, (ebx + 0x04) >>> 0)
  if (missileId < 0) return 2
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || missileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 2
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 2
  const ebpMissilesTxt = (pMissilesBase + imul32(missileId, 0x1a4)) >>> 0
  if (ebpMissilesTxt === 0) return 2

  const esiRemFrames = MISSILE_GetRemainingFrames113c(m, ebx) | 0
  if (esiRemFrames === 1) {
    const nObjGuid = MISSILE_GetTargetX113c(m, ebx) >>> 0
    if (ediGame === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
    }
    let esiObj = m.u32((ediGame + (nObjGuid & 0x7f) * 4 + 0x1520) >>> 0) >>> 0
    while (esiObj !== 0 && m.u32((esiObj + 0x0c) >>> 0) !== nObjGuid) {
      esiObj = m.u32((esiObj + 0xe4) >>> 0) >>> 0
    }
    if (esiObj !== 0) {
      SUNIT_SetUnitEventSound113c(m, esiObj, 0x5c, 0)
    }
  }

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0xc0) >>> 0
  try {
    const triggerFrame =
      (sx16(m.u16((ebpMissilesTxt + 0x96) >>> 0)) - i32(m, (ebpMissilesTxt + 0x38) >>> 0)) | 0
    if (esiRemFrames === triggerFrame) {
      const nObjGuid = MISSILE_GetTargetX113c(m, ebx) >>> 0
      const pOpArgs = (sp + 0x18) >>> 0
      m.setU32(pOpArgs, ediGame)
      m.setU32((pOpArgs + 0x08) >>> 0, 0)
      if (ediGame === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
      }
      let ecxObj = m.u32((ediGame + (nObjGuid & 0x7f) * 4 + 0x1520) >>> 0) >>> 0
      while (ecxObj !== 0 && m.u32((ecxObj + 0x0c) >>> 0) !== nObjGuid) {
        ecxObj = m.u32((ecxObj + 0xe4) >>> 0) >>> 0
      }
      if (ecxObj !== 0) {
        m.setU32((pOpArgs + 0x04) >>> 0, ecxObj)
        m.setU32((pOpArgs + 0x0c) >>> 0, (ecxObj + 0x20) >>> 0)
        m.setU32((pOpArgs + 0x10) >>> 0, m.u32((ecxObj + 0x04) >>> 0))
        OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c(m, pOpArgs)
      }
      MISSILE_SetTargetY113c(m, ebx, 1)
    }

    if ((MISSILE_GetTargetY113c(m, ebx) | 0) !== 0) {
      let nInterval = (i32(m, (ebpMissilesTxt + 0x3c) >>> 0) << 2) | 0
      if (nInterval < 1) {
        nInterval = 1
      }
      if (((esiRemFrames % nInterval) | 0) === 0) {
        const pCoord = sp
        const pOutDrop = (sp + 0x08) >>> 0
        PATH_GetTargetTypeAndPosition113c(m, ebx, pCoord)
        const ediSpread = i32(m, (ebpMissilesTxt + 0x40) >>> 0)
        const nSpan = (ediSpread * 2 + 1) | 0
        const dx = (SEED_RollLimitedFast113c(m, (ebx + 0x20) >>> 0, nSpan) | 0) - ediSpread
        m.setU32(pCoord, ((i32(m, pCoord) + dx) | 0) >>> 0)
        const dy = (SEED_RollLimitedFast113c(m, (ebx + 0x20) >>> 0, nSpan) | 0) - ediSpread
        m.setU32((pCoord + 0x04) >>> 0, ((i32(m, (pCoord + 0x04) >>> 0) + dy) | 0) >>> 0)
        const pRoom = UNITS_GetRoom113c(m, ebx) >>> 0
        const esiDropRoom =
          ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(m, pRoom, pCoord, pOutDrop, 1) >>> 0
        if (esiDropRoom !== 0) {
          const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, esiDropRoom) | 0
          const nMonLvl =
            DATATBLS_GetLevelMonsterLevel113c(
              m,
              nLevelId,
              ediGame !== 0 ? m.u8((ediGame + 0x6d) >>> 0) : 0,
              ediGame !== 0 ? i32(m, (ediGame + 0x70) >>> 0) : 0,
            ) | 0
          const pCreate = (sp + 0x30) >>> 0
          m.fill(pCreate, 0x84, 0)
          const nGoldItemId = DATATBLS_GetItemIdFromItemCode113c(m, 0x20646c67) | 0
          m.setU32(pCreate, ebx)
          m.setU32((pCreate + 0x04) >>> 0, 0)
          m.setU32((pCreate + 0x08) >>> 0, ediGame)
          m.setU32((pCreate + 0x0c) >>> 0, nMonLvl >>> 0)
          m.setU32((pCreate + 0x14) >>> 0, nGoldItemId >>> 0)
          m.setU32((pCreate + 0x18) >>> 0, 3)
          m.setU32((pCreate + 0x1c) >>> 0, m.u32(pOutDrop))
          m.setU32((pCreate + 0x20) >>> 0, m.u32((pOutDrop + 0x04) >>> 0))
          m.setU32((pCreate + 0x24) >>> 0, esiDropRoom)
          m.setU16((pCreate + 0x28) >>> 0, 1)
          m.setU16((pCreate + 0x2a) >>> 0, ediGame !== 0 ? m.u16((ediGame + 0x78) >>> 0) : 0)
          m.setU32((pCreate + 0x30) >>> 0, 2)
          D2GAME_CreateItemEx_6FC31490_113c(m, ediGame, pCreate, 0)
        }
      }
    }
    return MISSILE_SrvDo01_LinearProjectile113c(m, ebx, ediGame) | 0
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [32/45] Validates that `pUnit` has a room, resolves its target or first path coordinates
 * (`0x6FCBFA30`), finds the destination room (`0x6FC21280`), and returns `1` iff that room is not
 * a town room (`0x6FD8C390`).
 *
 * @va D2Game:0x6FC62AD0
 */
export function SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 1,
): number {
  hitD2GameVa113c(0x6FC62AD0)
  const ediGame = pGame >>> 0
  const esi = pUnit >>> 0
  const ebpRoom = UNITS_GetRoom113c(m, esi) >>> 0
  if (ebpRoom === 0) return 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x08) >>> 0
  try {
    const pOutX = sp
    const pOutY = (sp + 0x04) >>> 0
    if (skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, esi, ediGame, pOutX, pOutY) === 0) {
      return 0
    }
    const pDestRoom =
      ROOM_FindRoomContainingSubtile113c(m, ebpRoom, i32(m, pOutX), i32(m, pOutY)) >>> 0
    if (pDestRoom === 0) return 0
    return (DUNGEON_CheckRoomIsTownMemPort113c(m, pDestRoom) | 0) === 0 ? 1 : 0
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [33/45] Applies direct elemental skill damage (`0x6FCBF210`, `wResultFlags = 0x4021`,
 * `dwHitClass |= 0x0D`, `bNoHeal = 1`) from `pAttacker` to player/monster `pDefender` via
 * `0x6FCFE0C0` and `0x6FCFCF20`, and sets `wPrgOverlay` (`+0x110`) monster skill icon (`0x6FD82C10`).
 *
 * @va D2Game:0x6FC62B40
 */
export function SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  _nUnused: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC62B40)
  const game = pGame >>> 0
  const ebxAttacker = pAttacker >>> 0
  const ebpDefender = pDefender >>> 0
  if (ebxAttacker === 0 || ebpDefender === 0) return 0
  const defType = i32(m, ebpDefender)
  if (defType !== 0 && defType !== 1) return 0

  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const esiSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (esiSkillsTxt === 0) return 0

  const lvl = (nSkillLevel | 0) < 0 ? 1 : nSkillLevel | 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x78) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    skillsRollAndAddSkillElemDamage_6FCBF210(m, skillId, ebxAttacker, pDmg, lvl)
    m.setU32((pDmg + 0x60) >>> 0, (m.u32((pDmg + 0x60) >>> 0) | 0x0d) >>> 0)
    m.setU8((pDmg + 0x64) >>> 0, 1)
    m.setU16((pDmg + 0x04) >>> 0, 0x4021)
    SUNITDMG_ApplyDamage113c(m, game, ebxAttacker, ebpDefender, pDmg)
    SUNITDMG_ApplySideEffectsAndKill113c(m, game, ebxAttacker, ebpDefender, pDmg)

    const wOverlay = sx16(m.u16((esiSkillsTxt + 0x110) >>> 0))
    if (wOverlay >= 0 && wOverlay < i32(m, (pDataTables + 0xbc0) >>> 0)) {
      STATES_SetMonsterSkillIconOnUnit113c(m, ebpDefender, wOverlay, 0)
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [34/45] Spawns `calc1` (`+0x138`) Charged Bolt projectiles (`0x6FCB1340`, `dwFlags = 0x21`,
 * init callback `0x6FC61F50`) from `pUnit` toward its target or first path coordinates (`0x6FCBFA30`).
 *
 * @va D2Game:0x6FC63B60
 */
export function SKILLS_SrvDo031_ChargedBoltProjectiles_6FC63B60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC63B60)
  const game = pGame >>> 0
  const esi = pUnit >>> 0
  if (esi !== 0) {
    m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const ebxSkillId = nSkillId | 0
  if (ebxSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebxSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ediSkillsTxt = (pSkillsBase + imul32(ebxSkillId, 0x23c)) >>> 0
  if (ediSkillsTxt === 0) return 0

  const ebpMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, ebxSkillId, esi) | 0
  if (ebpMissileId < 0 || ebpMissileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0

  const lvl = nSkillLevel | 0
  const nCount =
    SKILLS_EvalCalcByOffset113c(m, esi, m.u32((ediSkillsTxt + 0x138) >>> 0), ebxSkillId, lvl) | 0

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x60) >>> 0
  try {
    const pParams = sp
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 0x21)
    m.setU32((pParams + 0x04) >>> 0, esi)
    m.setU32((pParams + 0x10) >>> 0, ebpMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, (UNIT_GetPosX113c(m, esi) | 0) >>> 0)
    m.setU32((pParams + 0x18) >>> 0, (UNIT_GetPosY113c(m, esi) | 0) >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, ebxSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, lvl >>> 0)
    m.setU32((pParams + 0x54) >>> 0, 0x6fc61f50)

    const pTargetX = (pParams + 0x1c) >>> 0
    const pTargetY = (pParams + 0x20) >>> 0
    for (let edi = 0; edi < nCount; edi++) {
      m.setU32((pParams + 0x58) >>> 0, edi >>> 0)
      if (skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, esi, game, pTargetX, pTargetY) !== 0) {
        if (i32(m, pTargetX) !== 0 && i32(m, pTargetY) !== 0) {
          MISSILE_CreateServerProjectile113c(m, game, pParams, {
            missileInitCallback: (mem, _fnVa, pMissile, initArg) => {
              MISSILES_InitChargedBoltPath_6FC61F50_113c(mem, pMissile, initArg)
            },
          })
        }
      }
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [35/45] State removal callback (`0x6FC64A60`) for morph/transform states: clears same-group states
 * (`0x6FCBEA30`), looks up stat `0x15E` (`350`) on `pStatList` to find the transform skill, updates
 * its slot index with `0x6FC649F0(..., 10)`, and clears `nState` on `pUnit`.
 *
 * @va D2Game:0x6FC64A60
 */
export function STATES_OnTransformStateRemoved_6FC64A60_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nState: number,
  pStatList: number,
): void {
  hitD2GameVa113c(0x6FC64A60)
  const ebxUnit = pUnit >>> 0
  const ediState = nState | 0
  const statList = pStatList >>> 0
  STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c(m, ebxUnit, ediState, 1)
  if (statList !== 0) {
    const nSkillId = STATLIST_GetStatValue113c(m, statList, 0x15e, 0) | 0
    const esiSkill =
      SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, ebxUnit, nSkillId) >>> 0
    if (esiSkill !== 0) {
      const nAnimMode = SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c(m, ebxUnit, 10) | 0
      SKILLS_SetSkillSlotIndex113c(m, esiSkill, nAnimMode)
      STATES_ToggleGfxStateFlag113c(m, ebxUnit, ediState, 0)
    }
  }
}


/**
 * [36/45] Executes a melee skill hit (`0x6FC64ED0`) using `0x6FCC11B0` hit roll, sets
 * `dwFlags |= 2 | pSkillsTxt->dwETypeFlags` (`+0x130`), adds `calc1` (`+0x138`) to `dwDmgPct`,
 * fills weapon/stat damage (`0x6FCFD450`), adds elemental skill damage (`0x6FCBF210`), and
 * allocates combat (`0x6FCFDDE0`, `srcDam = 0x80`).
 *
 * @va D2Game:0x6FC64ED0
 */
export function SKILLS_SrvDo035_MeleeSkillHitWithWeaponFill_6FC64ED0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC64ED0)
  const esiGame = pGame >>> 0
  const ebpUnit = pUnit >>> 0
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ebxSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (ebxSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, ebpUnit, esiGame)
  const pPath = ebpUnit !== 0 ? m.u32((ebpUnit + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === ebpUnit || pTarget === 0) return 0

  const lvl = nSkillLevel | 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x78) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c(
      m,
      ebxSkillsTxt,
      pDmg,
      lvl,
      skillId,
      esiGame,
      ebpUnit,
      pTarget,
      0,
    )
    if ((m.u8((pDmg + 0x04) >>> 0) & 1) !== 0) {
      m.setU32(pDmg, (m.u32(pDmg) | 2 | m.u32((ebxSkillsTxt + 0x130) >>> 0)) >>> 0)
      const hitClass = m.u32((ebxSkillsTxt + 0x134) >>> 0) >>> 0
      if (hitClass !== 0) {
        m.setU32((pDmg + 0x60) >>> 0, hitClass)
      }
      const dmgPct =
        SKILLS_EvalCalcByOffset113c(
          m,
          ebpUnit,
          m.u32((ebxSkillsTxt + 0x138) >>> 0),
          skillId,
          lvl,
        ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, dmgPct >>> 0)
      const bSrcDam = m.u8((ebxSkillsTxt + 0x1a5) >>> 0)
      SUNITDMG_FillDamageValues113c(m, esiGame, ebpUnit, pTarget, pDmg, 0, bSrcDam)
      skillsRollAndAddSkillElemDamage_6FCBF210(m, skillId, ebpUnit, pDmg, lvl)
      SUNITDMG_AllocCombat113c(m, esiGame, ebpUnit, pTarget, pDmg, 0x80)
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [37/45] Executes a melee leech/multiplier skill hit (`0x6FC65000`, e.g., Hunger / Cobra Strike):
 * sets `pUnit->dwFlags |= 0x40`, rolls hit (`0x6FCC11B0`), fills weapon/elem damage (`0x6FCFD450`,
 * `0x6FCBF210`), scales `dwPhysDamage` by `+calc1%` (`+0x138`), adds `calc2` (`+0x13C`) to
 * `dwLifeLeech` (`+0x38`) and `calc3` (`+0x140`) to `dwManaLeech` (`+0x3C`), allocates combat
 * (`0x6FCFDDE0`), and executes combat events (`0x6FCFED30`).
 *
 * @va D2Game:0x6FC65000
 */
export function SKILLS_SrvDo036_MeleeHitWithPhysScaleAndLeech_6FC65000_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC65000)
  const esiGame = pGame >>> 0
  const ebpUnit = pUnit >>> 0
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ebxSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (ebxSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, ebpUnit, esiGame)
  const pPath = ebpUnit !== 0 ? m.u32((ebpUnit + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === ebpUnit || pTarget === 0) return 0

  m.setU32((ebpUnit + 0xc4) >>> 0, (m.u32((ebpUnit + 0xc4) >>> 0) | 0x40) >>> 0)

  const lvl = nSkillLevel | 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x7c) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c(
      m,
      ebxSkillsTxt,
      pDmg,
      lvl,
      skillId,
      esiGame,
      ebpUnit,
      pTarget,
      0,
    )
    if ((m.u8((pDmg + 0x04) >>> 0) & 1) !== 0) {
      m.setU32(pDmg, (m.u32(pDmg) | 2 | m.u32((ebxSkillsTxt + 0x130) >>> 0)) >>> 0)
      m.setU16(
        (pDmg + 0x04) >>> 0,
        (m.u16((pDmg + 0x04) >>> 0) | m.u16((ebxSkillsTxt + 0x12e) >>> 0)) & 0xffff,
      )
      const hitClass = m.u32((ebxSkillsTxt + 0x134) >>> 0) >>> 0
      if (hitClass !== 0) {
        m.setU32((pDmg + 0x60) >>> 0, hitClass)
      }
      const bSrcDam = m.u8((ebxSkillsTxt + 0x1a5) >>> 0)
      SUNITDMG_FillDamageValues113c(m, esiGame, ebpUnit, pTarget, pDmg, 0, bSrcDam)
      skillsRollAndAddSkillElemDamage_6FCBF210(m, skillId, ebpUnit, pDmg, lvl)

      const pctAdd =
        SKILLS_EvalCalcByOffset113c(
          m,
          ebpUnit,
          m.u32((ebxSkillsTxt + 0x138) >>> 0),
          skillId,
          lvl,
        ) | 0
      const basePhys = i32(m, (pDmg + 0x08) >>> 0)
      const bonusPhys = mulDiv113c(basePhys, pctAdd, 100) | 0
      m.setU32((pDmg + 0x08) >>> 0, ((basePhys + bonusPhys) | 0) >>> 0)

      const lifeLeechAdd =
        SKILLS_EvalCalcByOffset113c(
          m,
          ebpUnit,
          m.u32((ebxSkillsTxt + 0x13c) >>> 0),
          skillId,
          lvl,
        ) | 0
      const manaLeechAdd =
        SKILLS_EvalCalcByOffset113c(
          m,
          ebpUnit,
          m.u32((ebxSkillsTxt + 0x140) >>> 0),
          skillId,
          lvl,
        ) | 0
      m.setU32((pDmg + 0x38) >>> 0, ((i32(m, (pDmg + 0x38) >>> 0) + lifeLeechAdd) | 0) >>> 0)
      m.setU32((pDmg + 0x3c) >>> 0, ((i32(m, (pDmg + 0x3c) >>> 0) + manaLeechAdd) | 0) >>> 0)

      SUNITDMG_AllocCombat113c(m, esiGame, ebpUnit, pTarget, pDmg, 0x80)
      SUNITDMG_ExecuteEvents113c(m, esiGame, ebpUnit, pTarget, 1, pDmg)
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [38/45] Applies melee/periodic skill damage with a custom elemental duration (`nDurationFrames`,
 * clamped to `>= 10` via `0x6FCBE9B0`), allocating combat (`0x6FCFDDE0`) and executing combat
 * events (`0x6FCFED30`).
 *
 * @va D2Game:0x6FC651B0
 */
export function SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pAttacker: number,
  pDefender: number,
  pGame: number,
  nDurationFrames: number,
  pSkillsTxt: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FC651B0)
  const esiSkillId = nSkillId | 0
  const ebxAttacker = pAttacker >>> 0
  const def = pDefender >>> 0
  const game = pGame >>> 0
  const ebpSkillsTxt = pSkillsTxt >>> 0
  const lvl = nSkillLevel | 0
  const dur = (nDurationFrames | 0) < 10 ? 10 : nDurationFrames | 0

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x78) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    let wFlags = ebpSkillsTxt !== 0 ? m.u16((ebpSkillsTxt + 0x12e) >>> 0) : 0
    if ((wFlags & 1) === 0) {
      const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, ebxAttacker, esiSkillId, lvl) | 0
      wFlags = rollToHitFlags_6FCFE5A0(m, ebxAttacker, def, game, toHitBonus, 0, pDmg) & 0xffff
      m.setU16((pDmg + 0x04) >>> 0, wFlags)
      if ((wFlags & 1) !== 0 && ebpSkillsTxt !== 0) {
        wFlags = (wFlags | m.u16((ebpSkillsTxt + 0x12e) >>> 0)) & 0xffff
        m.setU16((pDmg + 0x04) >>> 0, wFlags)
      }
    } else {
      m.setU16((pDmg + 0x04) >>> 0, wFlags)
    }

    if ((m.u8((pDmg + 0x04) >>> 0) & 1) !== 0 && ebpSkillsTxt !== 0) {
      m.setU32(pDmg, (m.u32(pDmg) | m.u32((ebpSkillsTxt + 0x130) >>> 0)) >>> 0)
      const hitClass = m.u32((ebpSkillsTxt + 0x134) >>> 0) >>> 0
      if (hitClass !== 0) {
        m.setU32((pDmg + 0x60) >>> 0, hitClass)
      }
      const dmgPct =
        SKILLS_EvalCalcByOffset113c(
          m,
          ebxAttacker,
          m.u32((ebpSkillsTxt + 0x138) >>> 0),
          esiSkillId,
          lvl,
        ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, dmgPct >>> 0)
      skillsRollAndAddSkillElemDamage_6FCBF210(m, esiSkillId, ebxAttacker, pDmg, lvl)
    }

    SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c(m, esiSkillId, dur, pDmg)
    SUNITDMG_AllocCombat113c(m, game, ebxAttacker, def, pDmg, 0x80)
    SUNITDMG_ExecuteEvents113c(m, game, ebxAttacker, def, 1, pDmg)
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [39/45] Starts a multi-hit melee skill (`0x6FC6C4F0`, e.g., Zeal / Fury): resolves the direct path
 * target or scans within `weaponRangeAdder + 4` (`dwExtraFlags = 0x20003`, `0x6FCC0F40`), stores
 * `calc1` (`+0x138`) in `param1`, and records `(targetType, targetId)` in `(param2, param3)`.
 *
 * @va D2Game:0x6FC6C4F0
 */
export function SKILLS_SrvSt30_MultiHitMeleeStart_6FC6C4F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6C4F0)
  const ediGame = pGame >>> 0
  const esi = pUnit >>> 0
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ebpSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (ebpSkillsTxt === 0) return 0

  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, esi) >>> 0
  if (pUsedSkill === 0) return 0

  const ebxRange = ((UNITS_GetEquippedWeaponAdder113c(m, esi) | 0) + 4) | 0
  SUNIT_ValidatePathTargetUnit113c(m, esi, ediGame)
  const pPath = esi !== 0 ? m.u32((esi + 0x2c) >>> 0) >>> 0 : 0
  const rawTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  let ediTarget = rawTarget === esi ? 0 : rawTarget
  if (ediTarget === 0) {
    ediTarget =
      SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c(
        m,
        0x20003,
        ebxRange,
        -1,
        0,
        0,
        ediGame,
        esi,
        0,
      ) >>> 0
    if (ediTarget === 0) {
      SKILLS_SetParam1113c(m, pUsedSkill, 0)
      return 0
    }
  }

  const nHits =
    SKILLS_EvalCalcByOffset113c(
      m,
      esi,
      m.u32((ebpSkillsTxt + 0x138) >>> 0),
      skillId,
      nSkillLevel | 0,
    ) | 0
  SKILLS_SetParam1113c(m, pUsedSkill, nHits)
  SKILLS_SetParam2113c(m, pUsedSkill, ediTarget !== 0 ? i32(m, ediTarget) : 6)
  SKILLS_SetParam3113c(m, pUsedSkill, ediTarget !== 0 ? i32(m, (ediTarget + 0x0c) >>> 0) : -1)
  return 1
}

/**
 * [40/45] Starts a target-count-capped multi-hit melee skill (`0x6FC6C600`, e.g., Fend): resolves
 * the direct target and counts targets in `weaponRangeAdder + 4` (`0x6FCC0FC0`), or ring-scans
 * (`0x6FCC0F40`) with `pOutCount`, clamps the count to `calc1` (`+0x138`), and stores
 * `(count, targetType, targetId)` in `(param1, param2, param3)`.
 *
 * @va D2Game:0x6FC6C600
 */
export function SKILLS_SrvSt31_CappedMultiHitMeleeStart_6FC6C600_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6C600)
  const ediGame = pGame >>> 0
  const esi = pUnit >>> 0
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ebpSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (ebpSkillsTxt === 0) return 0

  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, esi) >>> 0
  if (pUsedSkill === 0) return 0

  const ebxRange = ((UNITS_GetEquippedWeaponAdder113c(m, esi) | 0) + 4) | 0
  SUNIT_ValidatePathTargetUnit113c(m, esi, ediGame)
  const pPath = esi !== 0 ? m.u32((esi + 0x2c) >>> 0) >>> 0 : 0
  const rawTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  let ediTarget = rawTarget === esi ? 0 : rawTarget

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x08) >>> 0
  try {
    const pOutCount = sp
    m.setU32(pOutCount, 0)
    let ebxCount: number
    if (ediTarget === 0) {
      ediTarget =
        SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c(
          m,
          0x20003,
          ebxRange,
          -1,
          pOutCount,
          0,
          ediGame,
          esi,
          0,
        ) >>> 0
      if (ediTarget === 0) {
        SKILLS_SetParam1113c(m, pUsedSkill, 0)
        return 1
      }
      ebxCount = i32(m, pOutCount)
    } else {
      ebxCount =
        SKILLS_CountUnitsInRadius_6FCC0FC0_113c(m, 0x20003, ebxRange, 0, ediGame, esi, 0) | 0
    }

    const nMaxHits =
      SKILLS_EvalCalcByOffset113c(
        m,
        esi,
        m.u32((ebpSkillsTxt + 0x138) >>> 0),
        skillId,
        nSkillLevel | 0,
      ) | 0
    if (ebxCount >= nMaxHits) {
      ebxCount = nMaxHits
    }
    SKILLS_SetParam1113c(m, pUsedSkill, ebxCount)
    SKILLS_SetParam2113c(m, pUsedSkill, i32(m, ediTarget))
    SKILLS_SetParam3113c(m, pUsedSkill, i32(m, (ediTarget + 0x0c) >>> 0))
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}


/**
 * [41/45] Executes a melee skill hit (`0x6FC6C720`) with `nToHitBonus = 0` (`0x6FCFE5A0`),
 * populates `dwDmgPct` (`calc1` at `+0x138`), optional elemental conversion (`+0x1DC`, `calc4`
 * at `+0x144`), and elemental skill damage (`0x6FCBF210`), and allocates combat (`0x6FCFDDE0`).
 *
 * @va D2Game:0x6FC6C720
 */
export function SKILLS_SrvDo054_MeleeHitZeroBonus_6FC6C720_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6C720)
  const game = pGame >>> 0
  const ebxUnit = pUnit >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, ebxUnit, game)
  const pPath = ebxUnit !== 0 ? m.u32((ebxUnit + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === ebxUnit || pTarget === 0) return 0

  const ebpSkillId = nSkillId | 0
  if (ebpSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebpSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const esiSkillsTxt = (pSkillsBase + imul32(ebpSkillId, 0x23c)) >>> 0
  if (esiSkillsTxt === 0) return 0

  const lvl = nSkillLevel | 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x78) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    const wFlags = rollToHitFlags_6FCFE5A0(m, ebxUnit, pTarget, game, 0, 0, pDmg) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wFlags)
    if ((wFlags & 1) !== 0) {
      const dmgPct =
        SKILLS_EvalCalcByOffset113c(
          m,
          ebxUnit,
          m.u32((esiSkillsTxt + 0x138) >>> 0),
          ebpSkillId,
          lvl,
        ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, dmgPct >>> 0)
      const elemType = m.u8((esiSkillsTxt + 0x1dc) >>> 0)
      if (elemType > 0) {
        const convPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            ebxUnit,
            m.u32((esiSkillsTxt + 0x144) >>> 0),
            ebpSkillId,
            lvl,
          ) | 0
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0)
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, elemType)
        }
      }
      skillsRollAndAddSkillElemDamage_6FCBF210(m, ebpSkillId, ebxUnit, pDmg, lvl)
    }
    const bSrcDam = m.u8((esiSkillsTxt + 0x1a5) >>> 0)
    SUNITDMG_AllocCombat113c(m, game, ebxUnit, pTarget, pDmg, bSrcDam)
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [42/45] Validates weapon/quiver quantity (`0x6FCBEB80`), returning `1` when ready, or schedules
 * skill action frame events (`0x6FC99100`), transitions `pUnit` to cast mode (`0x6FC98A90`), and
 * returns `0`.
 *
 * @va D2Game:0x6FC6C840
 */
export function SKILLS_SrvSt32_EnsureWeaponOrQuiverOrStartCast_6FC6C840_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 1,
): number {
  hitD2GameVa113c(0x6FC6C840)
  const esiGame = pGame >>> 0
  const ebxUnit = pUnit >>> 0
  if ((SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c(m, ebxUnit) | 0) !== 0) {
    return 1
  }
  PLAYER_ScheduleSkillActionFrameEvents113c(m, esiGame, ebxUnit, 0, 0)
  PLAYER_StartModeCast113c(m, esiGame, ebxUnit)
  return 0
}

/**
 * [43/45] Executes a melee skill hit (`0x6FC6CB00`), applying monster elemental/resist stats
 * (`0x6FC97240(..., 8)`) when `pUnit` is a monster, rolling hit (`0x6FCFE5A0`), populating
 * `D2DamageStrc` (`+0x138`, `+0x144`, `0x6FCBF210`), allocating combat (`0x6FCFDDE0`), and
 * executing combat events (`0x6FCFED30`).
 *
 * @va D2Game:0x6FC6CB00
 */
export function SKILLS_SrvDo055_MeleeHitWithMonsterElemStatsAndEvents_6FC6CB00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6CB00)
  const game = pGame >>> 0
  const esi = pUnit >>> 0
  const ebpSkillId = nSkillId | 0
  if (ebpSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebpSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ebxSkillsTxt = (pSkillsBase + imul32(ebpSkillId, 0x23c)) >>> 0
  if (ebxSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, esi, game)
  const pPath = esi !== 0 ? m.u32((esi + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === esi || pTarget === 0) return 0

  const lvl = nSkillLevel | 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x7c) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    const uType = i32(m, esi)
    const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, esi, ebpSkillId, lvl) | 0
    if (uType === 1) {
      MONSTER_ApplyElementalDamageAndResistStats113c(m, game, esi, 8)
    }
    const wFlags = rollToHitFlags_6FCFE5A0(m, esi, pTarget, game, toHitBonus, 0, pDmg) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wFlags)
    if ((wFlags & 1) !== 0) {
      const dmgPct =
        SKILLS_EvalCalcByOffset113c(
          m,
          esi,
          m.u32((ebxSkillsTxt + 0x138) >>> 0),
          ebpSkillId,
          lvl,
        ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, dmgPct >>> 0)
      const elemType = m.u8((ebxSkillsTxt + 0x1dc) >>> 0)
      if (elemType > 0) {
        const convPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            esi,
            m.u32((ebxSkillsTxt + 0x144) >>> 0),
            ebpSkillId,
            lvl,
          ) | 0
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0)
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, elemType)
        }
      }
      skillsRollAndAddSkillElemDamage_6FCBF210(m, ebpSkillId, esi, pDmg, lvl)
    }

    const bSrcDam = m.u8((ebxSkillsTxt + 0x1a5) >>> 0)
    const srcDam = bSrcDam !== 0 ? bSrcDam : 0x80
    SUNITDMG_AllocCombat113c(m, game, esi, pTarget, pDmg, srcDam)
    SUNITDMG_ExecuteEvents113c(m, game, esi, pTarget, 1, pDmg)
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [44/45] Spawns a weapon-class-selected skill projectile (`wSrvMissile` at `+0x48` if weapon class
 * `== 1`, else `wSrvMissileA` at `+0x4A` when `>= 0`), attaches `0x6FC6C190` (`+calc1%` damage) when
 * `calc1 != 0`, and records target mode (`1` or `2`) in `TargetX` and packed `(dy << 16) + dx` in `TargetY`.
 *
 * @va D2Game:0x6FC6D270
 */
export function SKILLS_SrvDo058_SpawnWeaponClassProjectileWithDmgPct_6FC6D270_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6D270)
  const game = pGame >>> 0
  const esi = pUnit >>> 0
  if (esi !== 0) {
    m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const ebpSkillId = nSkillId | 0
  if (ebpSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebpSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ediSkillsTxt = (pSkillsBase + imul32(ebpSkillId, 0x23c)) >>> 0
  if (ediSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, esi, game)
  const pPath = esi !== 0 ? m.u32((esi + 0x2c) >>> 0) >>> 0 : 0
  const rawTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  const pTarget = rawTarget === esi ? 0 : rawTarget

  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x70) >>> 0
  try {
    const pTargetX = sp
    const pTargetY = (sp + 0x04) >>> 0
    if (skillsGetUnitTargetOrFirstPathCoords_6FCBFA30(m, esi, game, pTargetX, pTargetY) === 0) {
      return 0
    }
    const lvl = nSkillLevel | 0
    const nDmgPct =
      SKILLS_EvalCalcByOffset113c(
        m,
        esi,
        m.u32((ediSkillsTxt + 0x138) >>> 0),
        ebpSkillId,
        lvl,
      ) | 0
    let nMissileId = sx16(m.u16((ediSkillsTxt + 0x48) >>> 0))
    if ((ITEMS_GetActiveWeaponClassCodeIdx113c(m, esi) | 0) !== 1) {
      const altMissileId = sx16(m.u16((ediSkillsTxt + 0x4a) >>> 0))
      if (altMissileId >= 0) {
        nMissileId = altMissileId
      }
    }
    if (nMissileId < 0 || nMissileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) {
      return 0
    }

    const ediTargetX = i32(m, pTargetX)
    const ebxTargetY = i32(m, pTargetY)
    const pParams = (sp + 0x0c) >>> 0
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, pTarget !== 0 ? 0x20 : 0x420)
    m.setU32((pParams + 0x04) >>> 0, esi)
    m.setU32((pParams + 0x08) >>> 0, esi)
    m.setU32((pParams + 0x0c) >>> 0, pTarget)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x1c) >>> 0, ediTargetX >>> 0)
    m.setU32((pParams + 0x20) >>> 0, ebxTargetY >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, ebpSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, lvl >>> 0)
    m.setU32((pParams + 0x58) >>> 0, nDmgPct >>> 0)
    if (nDmgPct !== 0) {
      m.setU32((pParams + 0x54) >>> 0, 0x6fc6c190)
    }

    const ebpMissile =
      MISSILE_CreateServerProjectile113c(
        m,
        game,
        pParams,
        nDmgPct !== 0
          ? {
              missileInitCallback: (mem, _fnVa, pMis, initArg) => {
                SKILLS_AddDamagePercentStat_6FC6C190_113c(mem, pMis, initArg)
              },
            }
          : undefined,
      ) >>> 0
    if (ebpMissile !== 0) {
      MISSILE_SetTargetX113c(m, ebpMissile, pTarget !== 0 ? 1 : 2)
      const dx = sx16(((ediTargetX - (UNIT_GetPosX113c(m, esi) | 0)) | 0) & 0xffff)
      const dy = sx16(((ebxTargetY - (UNIT_GetPosY113c(m, esi) | 0)) | 0) & 0xffff)
      const packed = ((dy << 16) + dx) | 0
      MISSILE_SetTargetY113c(m, ebpMissile, packed)
    }
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}

/**
 * [45/45] Executes a non-town melee skill hit (`0x6FC6F7D0`): validates that `pTarget` is outside
 * town (`0x6FD8C390`), rolls hit (`0x6FCFE5A0`), populates `dwDmgPct` (`+0x138`) and elemental
 * conversion/damage (`+0x1DC`, `+0x144`, `0x6FCBF210`), and allocates combat (`0x6FCFDDE0`).
 *
 * @va D2Game:0x6FC6F7D0
 */
export function SKILLS_SrvDo064_NonTownMeleeHitWithElemConversion_6FC6F7D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6F7D0)
  const game = pGame >>> 0
  const esi = pUnit >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, esi, game)
  const pPath = esi !== 0 ? m.u32((esi + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === esi || pTarget === 0) return 0
  const pTargetRoom = UNITS_GetRoom113c(m, pTarget) >>> 0
  if ((DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) | 0) !== 0) return 0

  const ebpSkillId = nSkillId | 0
  if (ebpSkillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || ebpSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const ebxSkillsTxt = (pSkillsBase + imul32(ebpSkillId, 0x23c)) >>> 0
  if (ebxSkillsTxt === 0) return 0

  const lvl = nSkillLevel | 0
  const sp = k2W5B1StackPtr
  k2W5B1StackPtr = (sp + 0x78) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    const toHitBonus = SKILLS_GetSkillToHitBonus113c(m, esi, ebpSkillId, lvl) | 0
    const wFlags = rollToHitFlags_6FCFE5A0(m, esi, pTarget, game, toHitBonus, 0, pDmg) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wFlags)
    if ((wFlags & 1) !== 0) {
      const dmgPct =
        SKILLS_EvalCalcByOffset113c(
          m,
          esi,
          m.u32((ebxSkillsTxt + 0x138) >>> 0),
          ebpSkillId,
          lvl,
        ) | 0
      m.setU32((pDmg + 0x0c) >>> 0, dmgPct >>> 0)
      const elemType = m.u8((ebxSkillsTxt + 0x1dc) >>> 0)
      if (elemType > 0) {
        const convPct =
          SKILLS_EvalCalcByOffset113c(
            m,
            esi,
            m.u32((ebxSkillsTxt + 0x144) >>> 0),
            ebpSkillId,
            lvl,
          ) | 0
        m.setU32((pDmg + 0x68) >>> 0, convPct >>> 0)
        if (convPct > 0) {
          m.setU8((pDmg + 0x65) >>> 0, elemType)
        }
        skillsRollAndAddSkillElemDamage_6FCBF210(m, ebpSkillId, esi, pDmg, lvl)
      }
    }
    const bSrcDam = m.u8((ebxSkillsTxt + 0x1a5) >>> 0)
    const srcDam = bSrcDam !== 0 ? bSrcDam : 0x80
    SUNITDMG_AllocCombat113c(m, game, esi, pTarget, pDmg, srcDam)
    return 1
  } finally {
    k2W5B1StackPtr = sp
  }
}
