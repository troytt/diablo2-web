/**
 * D2Game.dll 1.13c — Wave 6 Batch 4 (w6b4).
 *
 * Clean-room 1:1 binary-isomorphic port of 45 D2Game.dll v1.13c functions
 * across 0x6FC2C760..0x6FCB2940 operating directly on SparseMemory113c.
 */

import {
  COLLISION_FindFreePositionBasic113c,
  COLLISION_ResetMaskWithPattern113c,
} from '../common/collision'
import { UNITS_GetPlayerData113c } from '../common/composit'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { mulDiv113c } from '../common/int-math'
import {
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CanItemLoseDurability113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_SetNodePage113c,
  ITEMS_SetOrClearFlagMask113c,
} from '../common/items'
import {
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetCollisionMask113c,
  PATH_SetMoveTestCollisionMask113c,
  PATH_SetType113c,
} from '../common/path'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetParam1113c,
  SKILLS_GetParam2113c,
  SKILLS_GetParam3113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam3113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  UNITROOM_RefreshUnit113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
  UNITS_SetSeqFrameFromLowByte113c,
} from '../common/unit'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory'
import { AI_CalcApproxUnitDistSubtiles113c, SUNIT_SetUnitEventSound113c } from './ai-fallen-113c'
import {
  AI_Stall113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ExecuteEvents113c,
} from './combat-a1c-113c'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_GetDropItemLevel_6FC2E5D0_113c,
} from './k2-real-itemdrop-113c'
import { SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c } from './k2-real-s2c-combat-113c'
import { SKILLS_GetFlags113c } from './replay-kernel-113c'
import { PLAYER_IsBusyWithCursorOrNpcInteract113c } from './k2-items-tc-w1-113c'
import {
  MISSILE_CreateServerProjectile113c,
  NET_SendPacket0x3E_ItemStatBitStream113c,
} from './k2-gap-melee-dot-113c'
import { AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c } from './k2-laneI-0x6fc3-w1-113c'
import {
  PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c } from './k2-laneL-0x6fc6-w1-113c'
import {
  ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c,
  ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c,
  ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c,
  ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c,
} from './k2-laneM-0x6fc7-w1-113c'
import {
  ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c,
  ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c,
  ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c,
  ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c,
  QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
} from './k2-w2b1-113c'
import { ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c } from './k2-w2b2-113c'
import {
  SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c,
  SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c,
} from './k2-w2b5-113c'
import { ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c } from './k2-w2b6-113c'
import { AI_StartModeAtCoordsKeepSteps_6FD121E0_113c } from './k2-w2b8-113c'
import { SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c } from './k2-w3b2-113c'
import { QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c } from './k2-w3b3-113c'
import { ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c } from './k2-w3b5-113c'
import {
  ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c,
  ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c,
  ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c,
  ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
  ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c,
} from './k2-w3b6-113c'
import { ACT1Q4_OnCainModeOrInteract_6FC88150_113c } from './k2-w3b7-113c'
import { UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c } from './k2-w3b8-113c'
import { SKILLS_EndChargeOrLeapMovement_6FC48170_113c } from './k2-w4b1-113c'
import {
  ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c,
  ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
  ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
  ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
  ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c,
  ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
  ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c,
  ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
  ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
  ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c,
  ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
  ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c,
  ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c,
  ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c,
} from './k2-w4b2-113c'
import {
  ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
  ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c,
} from './k2-w4b3-113c'
import {
  SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
} from './k2-w4b6-113c'
import { ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c } from './k2-w4b8-113c'
import {
  ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c,
  ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c,
  NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c,
} from './k2-w5b2-113c'
import { SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c } from './k2-w5b3-113c'
import {
  ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c,
  ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c,
} from './k2-w5b5-113c'
import { SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c } from './k2-w5b6-113c'
import {
  ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c,
  ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c,
  SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c,
  SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c,
  SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
  SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c,
  SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c,
} from './k2-w5b7-113c'
import { MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c } from './k2-w5b9-113c'
import { SUNIT_IsDeadOrDying113c } from './monster-events'
import {
  MONSTER_GetBaseIdFromUnit113c,
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_AllocUnitData113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { SUNIT_FreeUnit113c } from './replay-final11-113c'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c, MONSTER_RefreshAiEvent113c } from './timer-wheel'
import { AI_FindNearestPlayerTarget113c } from './town-npc-ai-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

let k2W6B4StackPtr = 0x7ec40000

function allocW6B4Stack(m: D2KernMemory113c, size: number): number {
  const aligned = (size + 15) & ~15
  const base = k2W6B4StackPtr >>> 0
  k2W6B4StackPtr = (base + aligned) >>> 0
  for (let i = 0; i < aligned; i += 4) {
    m.setU32((base + i) >>> 0, 0)
  }
  return base
}

function freeW6B4Stack(base: number): void {
  k2W6B4StackPtr = base >>> 0
}

function getSkillsTxt113c(m: D2KernMemory113c, nSkillId: number): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
  if (pDataTables === 0 || id >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0
  const pBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  return pBase !== 0 ? ((pBase + Math.imul(id, 0x23c)) >>> 0) : 0
}

/**
 * Melee skill action with percentage physical scaling (`calc1`) and life/mana steal (`calc2`, `calc3`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC2C760
 * @ordinalOrName SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760
 */
export function SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2C760)
  const pSkillsTxt = getSkillsTxt113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0
  SUNIT_ValidatePathTargetUnit113c(m, pAttacker >>> 0, pGame >>> 0)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pAttacker + 0x2c) >>> 0) >>> 0) >>> 0
  if (pTarget === 0 || pTarget === (pAttacker >>> 0)) return 0
  const pDmg = allocW6B4Stack(m, 0x70)
  try {
    SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c(
      m,
      pSkillsTxt,
      pDmg,
      nSkillLevel | 0,
      nSkillId | 0,
      pGame >>> 0,
      pAttacker >>> 0,
      pTarget,
      0,
    )
    if ((m.u8((pDmg + 0x04) >>> 0) & 1) !== 0) {
      const hitFlags = (m.u32(pDmg) | 2 | m.u32((pSkillsTxt + 0x130) >>> 0)) >>> 0
      m.setU32(pDmg, hitFlags)
      const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
      if (dwHitClass !== 0) m.setU32((pDmg + 0x60) >>> 0, dwHitClass)
      SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c(m, pAttacker >>> 0, nSkillId | 0, nSkillLevel | 0, pDmg)
      const calc1 = SKILLS_EvalCalcByOffset113c(m, pAttacker >>> 0, m.u32((pSkillsTxt + 0x138) >>> 0), nSkillId | 0, nSkillLevel | 0) | 0
      const curPhys = m.u32((pDmg + 0x08) >>> 0) | 0
      m.setU32((pDmg + 0x08) >>> 0, ((curPhys + mulDiv113c(calc1, curPhys, 100)) | 0) >>> 0)
      const calc2 = SKILLS_EvalCalcByOffset113c(m, pAttacker >>> 0, m.u32((pSkillsTxt + 0x13c) >>> 0), nSkillId | 0, nSkillLevel | 0) | 0
      const calc3 = SKILLS_EvalCalcByOffset113c(m, pAttacker >>> 0, m.u32((pSkillsTxt + 0x140) >>> 0), nSkillId | 0, nSkillLevel | 0) | 0
      m.setU32((pDmg + 0x38) >>> 0, ((m.u32((pDmg + 0x38) >>> 0) | 0) + calc2) >>> 0)
      m.setU32((pDmg + 0x3c) >>> 0, ((m.u32((pDmg + 0x3c) >>> 0) | 0) + calc3) >>> 0)
      SUNITDMG_AllocCombat113c(m, pGame >>> 0, pAttacker >>> 0, pTarget, pDmg, 0x80)
    }
    return 1
  } finally {
    freeW6B4Stack(pDmg)
  }
}

/**
 * Tyrael (`0xFB`) and Izual Spirit (`0x196`) quest NPC AI think handler.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC39880
 * @ordinalOrName AI_ThinkTyraelOrIzualGhost_6FC39880
 */
export function AI_ThinkTyraelOrIzualGhost_6FC39880_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FC39880)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const pTarget = AI_FindNearestPlayerTarget113c(m, game, unit) >>> 0
  if (pTarget !== 0 && pTarget !== unit) {
    const nDist = AI_CalcApproxUnitDistSubtiles113c(m, unit, pTarget) | 0
    let pMonInteract = 0
    if (unit !== 0 && m.u32(unit) === 1) {
      const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) pMonInteract = m.u32((pMonData + 0x30) >>> 0) >>> 0
    }
    if (m.u32(pTarget) === 0 && PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pTarget) === 1) {
      AI_Stall113c(m, game, unit, 0x0a)
      return
    }
    let pInteractNode = pMonInteract !== 0 ? (m.u32(pMonInteract) >>> 0) : 0
    while (pInteractNode !== 0) {
      if (m.u32(pInteractNode) !== 0) {
        AI_Stall113c(m, game, unit, 0x0a)
        return
      }
      pInteractNode = m.u32((pInteractNode + 0x08) >>> 0) >>> 0
    }
    const pAiCtrl = m.u32(pAiArgs >>> 0) >>> 0
    if (nDist < 0x18) {
      const curTimer = m.u32((pAiCtrl + 0x18) >>> 0) | 0
      if (curTimer === 0) {
        m.setU32((pAiCtrl + 0x18) >>> 0, 0x3c)
        if (m.u32(pTarget) === 0) {
          SUNIT_SetUnitEventSound113c(m, unit, 0x12, pTarget)
        }
        AI_Stall113c(m, game, unit, 0x14)
        return
      }
      m.setU32((pAiCtrl + 0x18) >>> 0, (curTimer - 1) >>> 0)
      AI_Stall113c(m, game, unit, 0x14)
      return
    }
    let curTimer = m.u32((pAiCtrl + 0x18) >>> 0) | 0
    if (curTimer <= 0) {
      m.setU32((pAiCtrl + 0x18) >>> 0, 0x3c)
      curTimer = m.u32((pAiCtrl + 0x18) >>> 0) | 0
    }
    m.setU32((pAiCtrl + 0x18) >>> 0, (curTimer - 1) >>> 0)
    AI_Stall113c(m, game, unit, 0x14)
    return
  }
  if (unit !== 0) {
    const nClassId = m.u32((unit + 0x04) >>> 0) | 0
    if (nClassId === 0xfb) {
      if (
        ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c(m, game, unit) !== 0 &&
        AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c(m, unit, game) !== 0
      ) {
        AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, unit, 0, game, 0, 0)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          game,
          ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c,
          0,
          0,
        )
        return
      }
    } else if (nClassId === 0x196) {
      if (
        ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c(m, game, unit) !== 0 &&
        AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c(m, unit, game) !== 0
      ) {
        AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, unit, 0, game, 0, 0)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          game,
          ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c,
          0,
          0,
        )
        return
      }
    }
  }
  AI_Stall113c(m, game, unit, 0x14)
}

/**
 * Rolls fire splash damage (`MonStats.El1MinD..El1MaxD`) and radius (`mlvl * aip3[diff]`) on monster explosion.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC44300
 * @ordinalOrName MONSTER_ApplyDeathExplosionSplashDamage_6FC44300
 */
export function MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _arg0 = 0,
  _arg1 = 0,
): number {
  hitD2GameVa113c(0x6FC44300)
  const unit = pUnit >>> 0
  let pMonStatsTxt = 0
  if (unit !== 0) {
    const nClassId = m.u32((unit + 0x04) >>> 0) | 0
    if (nClassId >= 0) {
      const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
      if (pDataTables !== 0 && nClassId < (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
        pMonStatsTxt = (m.u32((pDataTables + 0xa78) >>> 0) + Math.imul(nClassId, 0x1a8)) >>> 0
      }
    }
  }
  const nMax = (m.u16((pMonStatsTxt + 0x120) >>> 0) << 16) >> 16
  const nMin = (m.u16((pMonStatsTxt + 0x10e) >>> 0) << 16) >> 16
  const nRange = (nMax - nMin) | 0
  let nRoll = 0
  if (nRange > 0) {
    const lo = BigInt(m.u32((unit + 0x20) >>> 0) >>> 0)
    const hi = BigInt(m.u32((unit + 0x24) >>> 0) >>> 0)
    const prod = lo * 0x6ac690c5n + hi
    const newLo = Number(prod & 0xffffffffn) >>> 0
    const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
    m.setU32((unit + 0x24) >>> 0, newHi)
    m.setU32((unit + 0x20) >>> 0, newLo)
    nRoll = (nRange & ((nRange - 1) | 0)) === 0 ? ((newLo & ((nRange - 1) >>> 0)) | 0) : ((newLo % (nRange >>> 0)) | 0)
  }
  const dwFireDmg = (((((m.u16((pMonStatsTxt + 0x10e) >>> 0) << 16) >> 16) + nRoll) | 0) << 8) >>> 0
  const nLevel = STATLIST_GetUnitStat113c(m, unit, 0x0c, 0) | 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const wAip3 = (m.u16((pMonStatsTxt + bDiff * 2 + 0x62) >>> 0) << 16) >> 16
  const nRadius = Math.imul(nLevel, wAip3) | 0
  const t0 = m.u32(unit) | 0
  const pPath0 = m.u32((unit + 0x2c) >>> 0) >>> 0
  const nX = t0 === 2 || (t0 > 3 && t0 <= 5) ? (m.u32((pPath0 + 0x0c) >>> 0) | 0) : pPath0 !== 0 ? (PATH_GetPosX113c(m, pPath0) | 0) : 0
  const t1 = m.u32(unit) | 0
  const pPath1 = m.u32((unit + 0x2c) >>> 0) >>> 0
  const nY = t1 === 2 || (t1 > 3 && t1 <= 5) ? (m.u32((pPath1 + 0x10) >>> 0) | 0) : pPath1 !== 0 ? (PATH_GetPosY113c(m, pPath1) | 0) : 0
  const pDmg = allocW6B4Stack(m, 0x70)
  try {
    m.setU32((pDmg + 0x10) >>> 0, dwFireDmg)
    return SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c(m, pGame >>> 0, unit, nX, nY, nRadius, pDmg, 0, 0, 0, 0)
  } finally {
    freeW6B4Stack(pDmg)
  }
}

/**
 * Updates unit leap movement step (`pUnit`, `pGame`, `pSkill`); restores normal collision/path on arrival.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC48740
 * @ordinalOrName SKILLS_UpdateLeapMovementStep_6FC48740
 */
export function SKILLS_UpdateLeapMovementStep_6FC48740_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pSkill: number,
): number {
  hitD2GameVa113c(0x6FC48740)
  const unit = pUnit >>> 0
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) return 0
  const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
  if (pRoom === 0) return 0
  const game = pGame >>> 0
  const skill = pSkill >>> 0
  const nTargetX = SKILLS_GetParam1113c(m, skill) | 0
  const nTargetY = SKILLS_GetParam2113c(m, skill) | 0
  const bIsMonster = m.u32(unit) === 1 ? 1 : 0
  let nBaseMonId = -1
  if (bIsMonster !== 0) {
    const id = MONSTER_GetBaseIdFromUnit113c(m, unit) | 0
    if (id >= 0) {
      const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
      if (pDataTables !== 0 && id < (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
        nBaseMonId = id
      }
    }
  }
  const uType = m.u32(unit) | 0
  const nCurX =
    uType === 2 || (uType > 3 && uType <= 5)
      ? (m.u32((m.u32((unit + 0x2c) >>> 0) + 0x0c) >>> 0) | 0)
      : (m.u32((unit + 0x2c) >>> 0) >>> 0) !== 0
        ? (PATH_GetPosX113c(m, m.u32((unit + 0x2c) >>> 0) >>> 0) | 0)
        : 0
  if (nCurX === nTargetX && (UNIT_GetPosY113c(m, unit) | 0) === nTargetY) {
    if (bIsMonster !== 0) {
      const nPattern = PATH_GetUnitCollisionPattern113c(m, unit)
      COLLISION_ResetMaskWithPattern113c(m, pRoom, nTargetX, nTargetY, nPattern, 0x100)
      PATH_SetCollisionMask113c(m, pPath, 0x100)
      PATH_SetMoveTestCollisionMask113c(m, pPath, 0x3c01)
      PATH_SetType113c(m, pPath, 2)
      if (nBaseMonId === 0x4e) {
        PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c(m, skill, game, unit, nTargetX, nTargetY)
      } else {
        SKILLS_SetParam0C113c(m, skill, 0x200)
        m.setU32((unit + 0x48) >>> 0, (((m.u32((unit + 0x48) >>> 0) & 0xffffff00) - 0x100) >>> 0))
      }
    } else {
      const nPattern = PATH_GetUnitCollisionPattern113c(m, unit)
      COLLISION_ResetMaskWithPattern113c(m, pRoom, nTargetX, nTargetY, nPattern, 0x80)
      PATH_SetCollisionMask113c(m, pPath, 0x80)
      PATH_SetMoveTestCollisionMask113c(m, pPath, 0x1c09)
      PATH_SetType113c(m, pPath, 7)
      SKILLS_SetParam0C113c(m, skill, 0x200)
      let pEv = m.u32((unit + 0xdc) >>> 0) >>> 0
      while (pEv !== 0) {
        const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
        if (m.u8(pEv) === 1) {
          EVENT_FreeNode113c(m, game, pEv)
        }
        pEv = pNext
      }
      EVENT_SetEventFull113c(m, game, unit, 1, (m.u32((game + 0xa8) >>> 0) + 1) >>> 0, 0, 0, 0)
    }
    MONSTER_RefreshAiEvent113c(m, unit, 0)
    const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, skill, 0x6fd1cdd8, 0x737)
    UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, unit, nSkillId)
    return 1
  }
  if (bIsMonster !== 0) {
    let nSeqFrame = 0
    if (nBaseMonId === 0x4e) {
      nSeqFrame = 8
    } else if (nBaseMonId === 0x21c) {
      const nDist = UNITS_GetUnitDistanceToCoordinates113c(m, unit, nTargetX, nTargetY) >>> 0
      nSeqFrame = nDist < 2 ? 12 : 10
    }
    UNITS_SetSeqFrameFromLowByte113c(m, unit, nSeqFrame)
    m.setU32((unit + 0x48) >>> 0, (((m.u32((unit + 0x48) >>> 0) & 0xffffff00) + 0x100) >>> 0))
    return 0
  }
  SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c(m, unit, game, 0x0a)
  return 0
}

/**
 * Executes a Whirlwind tick (`pGame`, `pUnit`, `nSkillId`, `nSkillLevel`), scanning ring targets and applying melee hits.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC48BE0
 * @ordinalOrName SKILLS_SrvDo_WhirlwindTick_6FC48BE0
 */
export function SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC48BE0)
  const pSkillsTxt = getSkillsTxt113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, nSkillId | 0) >>> 0
  if (pSkill === 0) return 0
  const nParam1X = SKILLS_GetParam1113c(m, pSkill) | 0
  const nParam2Y = SKILLS_GetParam2113c(m, pSkill) | 0
  if (nParam1X === 0 || nParam2Y === 0) {
    SKILLS_EndChargeOrLeapMovement_6FC48170_113c(m, pSkill, nSkillId | 0, unit, nParam1X, nParam2Y)
    return 0
  }
  const dwFlags = SKILLS_GetFlags113c(m, pSkill) >>> 0
  if ((dwFlags & 3) === 3) {
    SKILLS_EndChargeOrLeapMovement_6FC48170_113c(m, pSkill, nSkillId | 0, unit, nParam1X, nParam2Y)
    return 1
  }
  if ((dwFlags & 1) === 0) return 0
  if (SUNIT_IsDeadOrDying113c(m, unit) !== 0) return 0
  if (unit !== 0 && m.u32(unit) === 0) {
    SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c(m, unit, game, 3)
  } else {
    UNITS_SetSeqFrameFromLowByte113c(m, unit, 0)
    m.setU32((unit + 0x48) >>> 0, 0x400)
  }
  let nHitCount = SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c(m, unit, game, pSkill) | 0
  if (nHitCount > 0) {
    const pDmg = allocW6B4Stack(m, 0x70)
    try {
      for (let i = 0; i < nHitCount; i++) {
        const dwPrevGuid = SKILLS_GetParam3113c(m, pSkill) >>> 0
        const pTarget = SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c(m, 3, 5, dwPrevGuid, 0, 0, game, unit, 0) >>> 0
        if (pTarget === 0) {
          SKILLS_SetParam3113c(m, pSkill, 0xffffffff)
          nHitCount = 0
        } else {
          SKILLS_SetParam3113c(m, pSkill, m.u32((pTarget + 0x0c) >>> 0) >>> 0)
          for (let k = 0; k < 0x70; k += 4) m.setU32((pDmg + k) >>> 0, 0)
          const nToHit = SKILLS_GetSkillToHitBonus113c(m, unit, nSkillId | 0, nSkillLevel | 0) | 0
          let wRes = SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, unit, pTarget, game, nToHit, 0, 0) & 0xffff
          m.setU16((pDmg + 0x04) >>> 0, wRes)
          if ((wRes & 1) !== 0) {
            wRes = (wRes | m.u16((pSkillsTxt + 0x12e) >>> 0)) & 0xffff
            m.setU16((pDmg + 0x04) >>> 0, wRes)
            m.setU32(pDmg, (m.u32(pDmg) | m.u32((pSkillsTxt + 0x130) >>> 0)) >>> 0)
            const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
            if (dwHitClass !== 0) m.setU32((pDmg + 0x60) >>> 0, dwHitClass)
            const nEnch = SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x138) >>> 0), nSkillId | 0, nSkillLevel | 0) | 0
            m.setU32((pDmg + 0x0c) >>> 0, nEnch >>> 0)
            SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, nSkillId | 0, unit, pDmg, nSkillLevel | 0)
          }
          let nSrcDam = m.u8((pSkillsTxt + 0x1a5) >>> 0)
          if (nSrcDam === 0) nSrcDam = 0x80
          SUNITDMG_AllocCombat113c(m, game, unit, pTarget, pDmg, nSrcDam)
          SUNITDMG_ExecuteEvents113c(m, game, unit, pTarget, 1, 0)
        }
        const curFlags = SKILLS_GetFlags113c(m, pSkill) >>> 0
        const nextFlags = (curFlags & 0x2000) !== 0 ? ((curFlags & 0xffffdfff) >>> 0) : ((curFlags | 0x2000) >>> 0)
        SKILLS_SetParam0C113c(m, pSkill, nextFlags)
      }
    } finally {
      freeW6B4Stack(pDmg)
    }
  }
  return 1
}

/**
 * Updates `pQuestData->bQState` (`+0x0B`) and optionally iterates all living players via `pfnPlayerCallback`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC554A0
 * @ordinalOrName QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0
 */
export function QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c(
  m: D2KernMemory113c,
  pfnPlayerCallback:
    | number
    | ((m: D2KernMemory113c, pGame: number, pUnit: number, pArg: number) => number),
  pQuestData: number,
  pCallbackArg: number,
  nNewState: number,
  bNotifyPlayers: number,
): void {
  hitD2GameVa113c(0x6FC554A0)
  m.setU8((pQuestData + 0x0b) >>> 0, nNewState & 0xff)
  if ((bNotifyPlayers & 0xff) === 1) {
    if (pfnPlayerCallback === 0) {
      throw new D2CommonAssertError('Quests.cpp', 0x5b8)
    }
    const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGame,
      pfnPlayerCallback,
      0,
      pCallbackArg >>> 0,
    )
  }
}

/**
 * Sets `pGame->pQuestControl->bPickedSet` (`+0x20`) and syncs quest logs across all living players.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC55E90
 * @ordinalOrName QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90
 */
export function QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c(
  m: D2KernMemory113c,
  pGame: number,
  bFlag: number,
): void {
  hitD2GameVa113c(0x6FC55E90)
  const game = pGame >>> 0
  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  m.setU8((pQuestCtrl + 0x20) >>> 0, bFlag & 0xff)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    game,
    QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
    0,
    0,
  )
}

/**
 * Destroys `pPlayer`'s active Town Portal (`dwClassId == 0x3B`) and its linked partner portal in `pGame`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC586F0
 * @ordinalOrName PLAYER_DestroyPlayerTownPortalPair_6FC586F0
 */
export function PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC586F0)
  if (pPlayer === 0) throw new D2CommonAssertError('Player.cpp', 0x259)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) throw new D2CommonAssertError('Player.cpp', 0x25c)
  const dwPortalGuid = m.u32((pPlayerData + 0x48) >>> 0) >>> 0
  if (pGame === 0) throw new D2CommonAssertError('Player.cpp', 0x2d3)
  const game = pGame >>> 0
  let pPortal = m.u32((game + (dwPortalGuid & 0x7f) * 4 + 0x1520) >>> 0) >>> 0
  while (pPortal !== 0 && (m.u32((pPortal + 0x0c) >>> 0) >>> 0) !== dwPortalGuid) {
    pPortal = m.u32((pPortal + 0xe4) >>> 0) >>> 0
  }
  if (pPortal === 0) return
  if ((m.u32((pPortal + 0x04) >>> 0) | 0) !== 0x3b) return
  ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c(m, pPortal, game)
  const pPartner = SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c(m, game, pPortal) >>> 0
  const pRoom1 = UNITS_GetRoom113c(m, pPortal) >>> 0
  if (pRoom1 !== 0) {
    DUNGEON_AddRoomPortalNode113c(m, pRoom1, 2, m.u32((pPortal + 0x0c) >>> 0) >>> 0)
  }
  SUNIT_FreeUnit113c(m, game, pPortal)
  DUNGEON_ToggleHasPortalFlag113c(m, pRoom1, 1)
  if (pPartner !== 0) {
    ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c(m, pPartner, game)
    const pRoom2 = UNITS_GetRoom113c(m, pPartner) >>> 0
    if (pRoom2 !== 0) {
      DUNGEON_AddRoomPortalNode113c(m, pRoom2, 2, m.u32((pPartner + 0x0c) >>> 0) >>> 0)
    }
    SUNIT_FreeUnit113c(m, game, pPartner)
    DUNGEON_ToggleHasPortalFlag113c(m, pRoom2, 1)
  }
}

/**
 * Spawns a random level monster at `pUnit`'s room and `(x, y)` coordinates (`Evil Urn` / trap handler).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC5BC00
 * @ordinalOrName OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00
 */
export function OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC5BC00)
  const unit = pUnit >>> 0
  const t0 = m.u32(unit) | 0
  const pPath0 = m.u32((unit + 0x2c) >>> 0) >>> 0
  const nY =
    t0 === 2 || (t0 > 3 && t0 <= 5)
      ? (m.u32((pPath0 + 0x10) >>> 0) | 0)
      : pPath0 !== 0
        ? (PATH_GetPosY113c(m, pPath0) | 0)
        : 0
  const t1 = m.u32(unit) | 0
  const pPath1 = m.u32((unit + 0x2c) >>> 0) >>> 0
  const nX =
    t1 === 2 || (t1 > 3 && t1 <= 5)
      ? (m.u32((pPath1 + 0x0c) >>> 0) | 0)
      : pPath1 !== 0
        ? (PATH_GetPosX113c(m, pPath1) | 0)
        : 0
  const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
  MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c(m, pGame >>> 0, pRoom, nX, nY)
  return 1
}

/**
 * Spawns a channeling projectile (`nMissileId`) after warmup (`dwParam1 != 0`) and reschedules channeling events.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC641C0
 * @ordinalOrName SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0
 */
export function SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nSkillId: number,
  nSkillLevel: number,
  nMissileId: number,
): number {
  hitD2GameVa113c(0x6FC641C0)
  const pSkillsTxt = getSkillsTxt113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0
  const misId = nMissileId | 0
  if (misId < 0) return 0
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
  if (pDataTables === 0 || misId >= (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) return 0
  const unit = pUnit >>> 0
  const game = pGame >>> 0
  const sp = allocW6B4Stack(m, 0x70)
  try {
    const pOutX = sp >>> 0
    const pOutY = (sp + 0x04) >>> 0
    const pParams = (sp + 0x08) >>> 0
    if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, unit, game, pOutX, pOutY) === 0) {
      return 0
    }
    const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, unit) >>> 0
    if (pUsedSkill === 0) return 0
    if (SKILLS_GetParam1113c(m, pUsedSkill) !== 0) {
      let nLoops = SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x138) >>> 0), nSkillId | 0, nSkillLevel | 0) | 0
      if (nLoops < 1) nLoops = 1
      m.setU32(pParams, 0x8020)
      m.setU32((pParams + 0x04) >>> 0, unit)
      m.setU32((pParams + 0x08) >>> 0, unit)
      m.setU32((pParams + 0x10) >>> 0, misId >>> 0)
      m.setU32((pParams + 0x1c) >>> 0, m.u32(pOutX))
      m.setU32((pParams + 0x20) >>> 0, m.u32(pOutY))
      m.setU32((pParams + 0x2c) >>> 0, (nSkillId | 0) >>> 0)
      m.setU32((pParams + 0x30) >>> 0, (nSkillLevel | 0) >>> 0)
      m.setU32((pParams + 0x4c) >>> 0, nLoops >>> 0)
      MISSILE_CreateServerProjectile113c(m, game, pParams)
    }
    SKILLS_SetParam1113c(m, pUsedSkill, 1)
    if (unit === 0 || m.u32(unit) !== 1) {
      SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c(m, unit, game, 1)
      return 1
    }
    m.setU32((unit + 0x44) >>> 0, 0x0b00)
    const nEndFrame = SKILLS_GetParam1113c(m, pUsedSkill) | 0
    if ((m.u32((game + 0xa8) >>> 0) | 0) < nEndFrame && STATES_CheckState113c(m, unit, 0x0c) !== 0) {
      let pEv = m.u32((unit + 0xdc) >>> 0) >>> 0
      while (pEv !== 0) {
        const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
        if (m.u8(pEv) === 1) EVENT_FreeNode113c(m, game, pEv)
        pEv = pNext
      }
      EVENT_SetEventFull113c(m, game, unit, 0, (m.u32((game + 0xa8) >>> 0) + 2) >>> 0, 0, 4, 0)
      return 1
    }
    SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c(m, game, unit)
    return 1
  } finally {
    freeW6B4Stack(sp)
  }
}

function findQuestInGame113c(m: D2KernMemory113c, pGame: number, nQuestId: number): number {
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pCur = m.u32(pQuestCtrl) >>> 0
  while (pCur !== 0) {
    if ((m.u32(pCur) | 0) === (nQuestId | 0)) return pCur
    pCur = m.u32((pCur + 0xf4) >>> 0) >>> 0
  }
  return 0
}

function stepUnitSeedMod100_113c(m: D2KernMemory113c, pUnit: number): number {
  const lo = BigInt(m.u32((pUnit + 0x20) >>> 0) >>> 0)
  const hi = BigInt(m.u32((pUnit + 0x24) >>> 0) >>> 0)
  const prod = lo * 0x6ac690c5n + hi
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pUnit + 0x24) >>> 0, newHi)
  m.setU32((pUnit + 0x20) >>> 0, newLo)
  return (newLo % 0x64) | 0
}

/**
 * Rolls weapon quantity or durability loss (`nLossChancePct`%) on `pItem` (`ITEMTYPE_WEAPON = 0x2D`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC6C9E0
 * @ordinalOrName ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0
 */
export function ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c(
  m: D2KernMemory113c,
  nLossChancePct: number,
  pUnit: number,
  pItem: number,
  pGame: number,
  nDurabilityLossAmount: number,
): void {
  hitD2GameVa113c(0x6FC6C9E0)
  const item = pItem >>> 0
  const unit = pUnit >>> 0
  const game = pGame >>> 0
  const chance = nLossChancePct | 0
  if (ITEMS_CheckItemTypeIdMemPort113c(m, item, 0x2d) === 0) return
  if (ITEMS_GetTwoHandedFlag113c(m, item) !== 0) {
    if ((STATLIST_GetUnitStat113c(m, item, 0x46, 0) | 0) <= 0) return
    if (stepUnitSeedMod100_113c(m, unit) < chance) {
      SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c(m, unit, game)
    }
    return
  }
  if (ITEMS_CanItemLoseDurability113c(m, item) === 0) return
  if (stepUnitSeedMod100_113c(m, unit) >= chance) return
  const newDur = ((STATLIST_GetUnitStat113c(m, item, 0x48, 0) | 0) - (nDurabilityLossAmount | 0)) | 0
  if (newDur <= 0) {
    ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c(m, item, unit, game)
    return
  }
  STATLIST_SetUnitStat113c(m, item, 0x48, newDur, 0)
  if (unit !== 0 && m.u32(unit) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, unit) >>> 0
    const pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
    NET_SendPacket0x3E_ItemStatBitStream113c(m, item, 0, pClient, 1, 0x48, newDur)
    return
  }
  NET_SendPacket0x3E_ItemStatBitStream113c(m, item, 0, 0, 1, 0x48, newDur)
}

/**
 * Marks Worldstone Chamber entered on Quest `0x24` (`+0x86 = 1`) and advances `bQState` to `3` with alert `0x24`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC798B0
 * @ordinalOrName ACT5Q6_OnWorldstoneChamberEntered_6FC798B0
 */
export function ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC798B0)
  const pQuest = findQuestInGame113c(m, pGame >>> 0, 0x24)
  if (pQuest === 0) return
  const pExt = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pExt + 0x86) >>> 0, 1)
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  if (m.u8((pQuest + 0x0b) >>> 0) >= 3) return
  m.setU8((pQuest + 0x0b) >>> 0, 3)
  m.setU8((pQuest + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c,
    0,
    0,
  )
}

/**
 * Promotes Quest `0x24` (`Eve of Destruction`) when `bNotIntro != 0 && bLastState == 0`, syncing Baal quest state.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC79930
 * @ordinalOrName ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930
 */
export function ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC79930)
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pQ24 = findQuestInGame113c(m, pGame, 0x24)
  if (m.u8((pQ24 + 0x09) >>> 0) !== 0 && m.u8((pQ24 + 0x0c) >>> 0) === 0) {
    const pExt = m.u32((pQ24 + 0x18) >>> 0) >>> 0
    m.setU8((pExt + 0x90) >>> 0, 1)
    m.setU8((pQ24 + 0x0c) >>> 0, 2)
    m.setU8((pQ24 + 0x14) >>> 0, 0)
    m.setU8((pQ24 + 0x0b) >>> 0, 1)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQ24 + 0x04) >>> 0) >>> 0,
      ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c,
      0,
      0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQ24 + 0x04) >>> 0) >>> 0,
      ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c,
      0,
      0,
    )
  }
  return 1
}

/**
 * Qual-Kehk (`0x203`) NPC activate callback for Act 5 Quest 5 (`Rite of Passage`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC79BE0
 * @ordinalOrName ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0
 */
export function ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC79BE0)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0x203) return
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pExt + 0x01) >>> 0) !== 1) return
  m.setU8((pQuestData + 0x0b) >>> 0, 1)
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
    0,
    0,
  )
  m.setU8((pExt + 0x01) >>> 0, 0)
}

/**
 * Advances Quest `0x22` (`Betrayal of Harrogath`) to `bQState = 3` and sends alert `0x22` to active players.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC79C50
 * @ordinalOrName ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50
 */
export function ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC79C50)
  const pQuest = findQuestInGame113c(m, pGame >>> 0, 0x22)
  if (pQuest === 0) return
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  if (m.u8((pQuest + 0x0b) >>> 0) >= 3) return
  m.setU8((pQuest + 0x14) >>> 0, 0)
  m.setU8((pQuest + 0x0b) >>> 0, 3)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
    0,
    0,
  )
}

/**
 * Timer callback for Act 5 Quest 4 (`Betrayal of Harrogath`) setting `bQState = 4`, sending alert `0x22`, and clearing `+0x85`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC79CD0
 * @ordinalOrName ACT5Q4_TimerPromoteState4_6FC79CD0
 */
export function ACT5Q4_TimerPromoteState4_6FC79CD0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC79CD0)
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestData + 0x0b) >>> 0) !== 4) {
    m.setU8((pQuestData + 0x0b) >>> 0, 4)
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
      0,
      0,
    )
  }
  m.setU8((pExt + 0x85) >>> 0, 0)
  return 1
}

/**
 * Records Frozen Anya's GUID (`+0xFC`) on Quest `0x21` (`Prison of Ice`) and promotes `bQState` to `2`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC79EF0
 * @ordinalOrName ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0
 */
export function ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c(
  m: D2KernMemory113c,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC79EF0)
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pQuest = findQuestInGame113c(m, pGame, 0x21)
  if (pQuest === 0) return
  const pUnit = m.u32((pQuestArg + 0x04) >>> 0) >>> 0
  const dwGuid = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
  const pExt = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU32((pExt + 0xfc) >>> 0, dwGuid)
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  if (m.u8((pQuest + 0x0b) >>> 0) >= 2) return
  m.setU8((pQuest + 0x0b) >>> 0, 2)
  m.setU8((pQuest + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
    0,
    0,
  )
}

/**
 * Promotes Quest `0x21` (`Prison of Ice`) to `bQState = 2` and broadcasts alert `0x21`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC79F80
 * @ordinalOrName ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80
 */
export function ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC79F80)
  const pQuest = findQuestInGame113c(m, pGame >>> 0, 0x21)
  if (pQuest === 0) return
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  if (m.u8((pQuest + 0x0b) >>> 0) >= 2) return
  m.setU8((pQuest + 0x14) >>> 0, 0)
  m.setU8((pQuest + 0x0b) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
    0,
    0,
  )
}

/**
 * Malah (`0x201`) NPC activate callback for Act 5 Quest 3 (`Prison of Ice`), advancing state `1` or `4`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7A0A0
 * @ordinalOrName ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0
 */
export function ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7A0A0)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nClassId = pNpc !== 0 ? (m.u32((pNpc + 0x04) >>> 0) >>> 0) : 0xffffffff
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if ((nClassId & 0xffff) !== 0x201) return
  if (m.u8((pExt + 0xac) >>> 0) !== 0) {
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
      0,
      0,
    )
    m.setU8((pExt + 0xac) >>> 0, 0)
  }
  if (
    m.u8((pQuestData + 0x09) >>> 0) !== 0 &&
    m.u8((pExt + 0x101) >>> 0) !== 0 &&
    m.u8((pQuestData + 0x0b) >>> 0) < 4
  ) {
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    m.setU8((pQuestData + 0x0b) >>> 0, 4)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
      0,
      0,
    )
    m.setU8((pExt + 0x101) >>> 0, 0)
  }
}

/**
 * Promotes Quest `0x20` (`Rescue on Mount Arreat`) to `bQState = 5` if `nDeadDoors (+0xA8) < 5`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7A200
 * @ordinalOrName ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200
 */
export function ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC7A200)
  const pQuest = findQuestInGame113c(m, pGame >>> 0, 0x20)
  if (pQuest === 0) return
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  if (m.u8((pQuest + 0x0b) >>> 0) === 5) return
  const pExt = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if ((m.u32((pExt + 0xa8) >>> 0) | 0) >= 5) return
  m.setU8((pQuest + 0x0b) >>> 0, 5)
  m.setU8((pQuest + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c,
    0,
    0,
  )
}

/**
 * Monster kill callback for Act 5 Quest 2 (`Rescue on Mount Arreat`) tracking prison doors (`0x1B2`) and soldiers (`0x216`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7A310
 * @ordinalOrName ACT5Q2_Callback02_MonsterKilled_6FC7A310
 */
export function ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7A310)
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return
  const pKilled = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pKilled !== 0 && (m.u32((pKilled + 0x04) >>> 0) | 0) === 0x1b2) {
    DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pKilled) >>> 0, 0)
    const pRoom = UNITS_GetRoom113c(m, m.u32((pQuestArg + 0x08) >>> 0) >>> 0) >>> 0
    if (pRoom !== 0) {
      const sp = allocW6B4Stack(m, 0x10)
      try {
        const ppRooms = sp >>> 0
        const pnRooms = (sp + 0x04) >>> 0
        DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, ppRooms, pnRooms)
        const nRooms = m.u32(pnRooms) >>> 0
        for (let i = 0; i < nRooms; i++) {
          const pAdj = m.u32((m.u32(ppRooms) + i * 4) >>> 0) >>> 0
          let pCur = m.u32((pAdj + 0x74) >>> 0) >>> 0
          while (pCur !== 0) {
            if (m.u32(pCur) === 1 && (m.u32((pCur + 0x04) >>> 0) | 0) === 0x216) {
              const nMode = m.u32((pCur + 0x10) >>> 0) | 0
              if (nMode !== 0x0c && nMode !== 0) {
                const nDist = UNITS_GetApproximateDistance113c(m, pCur, m.u32((pQuestArg + 0x08) >>> 0) >>> 0) | 0
                if (nDist < 0x0f) {
                  const idx = m.u32((pExt + 0x15c) >>> 0) | 0
                  m.setU32((pExt + idx * 4 + 0x120) >>> 0, m.u32((pCur + 0x0c) >>> 0) >>> 0)
                  m.setU32((pExt + 0x15c) >>> 0, (m.u32((pExt + 0x15c) >>> 0) + 1) >>> 0)
                  m.setU32((pExt + 0xac) >>> 0, (m.u32((pExt + 0xac) >>> 0) + 1) >>> 0)
                }
              }
            }
            pCur = m.u32((pCur + 0xe8) >>> 0) >>> 0
          }
        }
      } finally {
        freeW6B4Stack(sp)
      }
    }
  } else {
    const nSaved = m.u32((pExt + 0x15c) >>> 0) | 0
    for (let i = 0; i < nSaved; i++) {
      const guid = pKilled !== 0 ? (m.u32((pKilled + 0x0c) >>> 0) >>> 0) : 0xffffffff
      if (guid === (m.u32((pExt + 0x120 + i * 4) >>> 0) >>> 0)) {
        const grpIdx = ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, pKilled, pQuestData) | 0
        if (grpIdx >= 0) {
          const cnt = ((m.u32((pExt + grpIdx * 4 + 0x114) >>> 0) | 0) + 1) | 0
          m.setU32((pExt + grpIdx * 4 + 0x114) >>> 0, cnt >>> 0)
          if (cnt >= 5) m.setU8((pExt + grpIdx + 0x108) >>> 0, 1)
        }
        return
      }
    }
    m.setU32((pExt + 0xa8) >>> 0, (m.u32((pExt + 0xa8) >>> 0) + 1) >>> 0)
  }
  if ((m.u32((pExt + 0xa8) >>> 0) | 0) >= 5 && m.u8((pQuestData + 0x0b) >>> 0) !== 0x0c) {
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    m.setU8((pQuestData + 0x0b) >>> 0, 0x0c)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c,
      0,
      0,
    )
    m.setU8((pExt + 0x84) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c,
      0,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
    )
  }
  const grpIdx = ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, m.u32((pQuestArg + 0x08) >>> 0) >>> 0, pQuestData) | 0
  if (grpIdx >= 0) {
    const pExt2 = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    const cnt = ((m.u32((pExt2 + grpIdx * 4 + 0x114) >>> 0) | 0) + 1) | 0
    m.setU32((pExt2 + grpIdx * 4 + 0x114) >>> 0, cnt >>> 0)
    if (cnt >= 5) m.setU8((pExt2 + grpIdx + 0x108) >>> 0, 1)
  }
}

/**
 * Qual-Kehk (`0x203`) NPC activate callback for Act 5 Quest 2 (`Rescue on Mount Arreat`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7A530
 * @ordinalOrName ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530
 */
export function ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7A530)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0x203) return
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pExt + 0x84) >>> 0) !== 1) return
  if ((m.u32((pExt + 0xa8) >>> 0) | 0) >= 5) return
  m.setU8((pQuestData + 0x0b) >>> 0, 1)
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c,
    0,
    0,
  )
  m.setU8((pExt + 0x84) >>> 0, 0)
  m.setU32((pQuestData + 0xa8) >>> 0, 0)
}

/**
 * Advances Quest `0x1F` (`Siege on Harrogath`) to `bQState = 2` when Shenk (`wUniqueHcIdx == 0x2A`) is spotted.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7A690
 * @ordinalOrName ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690
 */
export function ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC7A690)
  const pQuest = findQuestInGame113c(m, pGame >>> 0, 0x1f)
  if (pQuest === 0) return
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  if (m.u8((pQuest + 0x0b) >>> 0) >= 2) return
  const unit = pUnit >>> 0
  if (unit === 0 || m.u32(unit) !== 1) return
  const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
  if (pMonData === 0 || m.u16((pMonData + 0x26) >>> 0) !== 0x2a) return
  m.setU8((pQuest + 0x14) >>> 0, 0)
  m.setU8((pQuest + 0x0b) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0) >>> 0,
    ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
    0,
    0,
  )
}

/**
 * Larzuk (`0x1FF`) NPC activate callback for Act 5 Quest 1 (`Siege on Harrogath`), advancing state `1` or `4`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7A720
 * @ordinalOrName ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720
 */
export function ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7A720)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0x1ff) return
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pExt + 0x08) >>> 0) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
      0,
      0,
    )
    m.setU8((pExt + 0x08) >>> 0, 0)
  }
  if (m.u8((pExt + 0x16) >>> 0) === 1) {
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    m.setU8((pQuestData + 0x0b) >>> 0, 4)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
      0,
      0,
    )
    m.setU8((pExt + 0x16) >>> 0, 0)
  }
}

/**
 * Rolls a valid `MonStats` monster ID (`bit 6` at `+0x0E` set) into `pExt + 0xA4` and broadcasts packet `0x50` for Quest `0x24`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7A820
 * @ordinalOrName ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820
 */
export function ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c(
  m: D2KernMemory113c,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7A820)
  const pGame0 = m.u32(pQuestArg >>> 0) >>> 0
  const pQuest = findQuestInGame113c(m, pGame0, 0x24)
  const pExt = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pExt + 0xa0) >>> 0) !== 0) return
  const pDataTables0 = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
  const nMonStatsCount0 = pDataTables0 !== 0 ? (m.u32((pDataTables0 + 0xa80) >>> 0) | 0) : 0
  for (let attempt = 0; attempt < 10; attempt++) {
    const pQGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    const pQuestCtrl = m.u32((pQGame + 0x10f4) >>> 0) >>> 0
    if (pQuestCtrl === 0) throw new D2CommonAssertError('Quests.cpp', 0x1fb)
    let nRolledId = 1
    if (nMonStatsCount0 > 1) {
      const nBound = (nMonStatsCount0 - 1) | 0
      const lo = BigInt(m.u32((pQuestCtrl + 0x18) >>> 0) >>> 0)
      const hi = BigInt(m.u32((pQuestCtrl + 0x1c) >>> 0) >>> 0)
      const prod = lo * 0x6ac690c5n + hi
      const newLo = Number(prod & 0xffffffffn) >>> 0
      const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
      m.setU32((pQuestCtrl + 0x1c) >>> 0, newHi)
      m.setU32((pQuestCtrl + 0x18) >>> 0, newLo)
      const rem = (nBound & ((nBound - 1) | 0)) === 0 ? (newLo & ((nBound - 1) >>> 0)) : (newLo % (nBound >>> 0))
      nRolledId = ((rem | 0) + 1) | 0
    }
    m.setU32((pExt + 0xa4) >>> 0, nRolledId >>> 0)
    if (nRolledId >= 0) {
      const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
      if (pDataTables !== 0 && nRolledId < (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
        const pMonStats = (m.u32((pDataTables + 0xa78) >>> 0) + Math.imul(nRolledId, 0x1a8)) >>> 0
        if (pMonStats !== 0) {
          const pBitMasks = m.u32(0x6fd18be0) >>> 0
          const bit6 = pBitMasks !== 0 ? m.u32((pBitMasks + 0x18) >>> 0) : 0x40
          if ((m.u8((pMonStats + 0x0e) >>> 0) & bit6) !== 0) {
            m.setU8((pExt + 0xa0) >>> 0, 1)
          }
        }
      }
    }
    if (m.u8((pExt + 0xa0) >>> 0) !== 0) break
  }
  if (m.u8((pExt + 0xa0) >>> 0) === 0) {
    m.setU8((pExt + 0xa0) >>> 0, 1)
    const bAfter = m.u8((pExt + 0xa0) >>> 0)
    m.setU32((pExt + 0xa4) >>> 0, 0)
    if (bAfter === 0) return
  }
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32(pQuestArg >>> 0) >>> 0,
    ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c,
    0,
    0,
  )
}

/**
 * Rescues a Barbarian soldier group on Mount Arreat (`Quest 0x20`), spawning rescue portal `0xBD` and updating rewards.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7B9B0
 * @ordinalOrName ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0
 */
export function ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pSoldierUnit: number,
): void {
  hitD2GameVa113c(0x6FC7B9B0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const soldier = pSoldierUnit >>> 0
  const pQuest = findQuestInGame113c(m, game, 0x20)
  if (pQuest === 0) return
  const pExt = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const grpIdx = ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, soldier, pQuest) | 0
  if (grpIdx < 0) return
  const pFlagAddr = (pExt + grpIdx + 0x10e) >>> 0
  if (m.u8(pFlagAddr) === 1) return
  let pTargetRoom = UNITS_GetRoom113c(m, soldier) >>> 0
  const pPlrRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pPlrRoom === 0) return
  const sp = allocW6B4Stack(m, 0x20)
  try {
    const ppRooms = sp >>> 0
    const pnRooms = (sp + 0x04) >>> 0
    const pCoords = (sp + 0x08) >>> 0
    const ppOutRoom = (sp + 0x10) >>> 0
    m.setU32(pCoords, ((m.u32((pExt + grpIdx * 8 + 0x8c) >>> 0) | 0) + 0x0c) >>> 0)
    m.setU32((pCoords + 0x04) >>> 0, m.u32((pExt + grpIdx * 8 + 0x90) >>> 0))
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pPlrRoom, ppRooms, pnRooms)
    const nRooms = m.u32(pnRooms) >>> 0
    let bFoundDoor = 0
    for (let i = 0; i < nRooms; i++) {
      const pAdj = m.u32((m.u32(ppRooms) + i * 4) >>> 0) >>> 0
      let pCur = m.u32((pAdj + 0x74) >>> 0) >>> 0
      while (pCur !== 0) {
        if (m.u32(pCur) === 1 && (m.u32((pCur + 0x04) >>> 0) | 0) === 0x1b2 && (m.u32((pCur + 0x10) >>> 0) | 0) === 0x0c) {
          if ((UNITS_GetApproximateDistance113c(m, pCur, soldier) | 0) < 0x0f) {
            pTargetRoom = UNITS_GetRoom113c(m, pCur) >>> 0
            PATH_GetTargetTypeAndPosition113c(m, pCur, pCoords)
            m.setU32(pCoords, ((m.u32(pCoords) | 0) + 2) >>> 0)
            bFoundDoor = 1
            break
          }
        }
        pCur = m.u32((pCur + 0xe8) >>> 0) >>> 0
      }
    }
    if (bFoundDoor === 0) return
    m.setU8(pFlagAddr, 1)
    const coordX = m.u32(pCoords) | 0
    const coordY = m.u32((pCoords + 0x04) >>> 0) | 0
    pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pTargetRoom, coordX, coordY) >>> 0
    let pPortal = SUNIT_AllocUnitData113c(m, 2, 0xbd, coordX, coordY, m.u32((pQuest + 0x04) >>> 0) >>> 0, pTargetRoom, 1, 1, 0) >>> 0
    if (pPortal === 0) {
      pPortal = SUNIT_AllocUnitData113c(m, 2, 0xbd, (coordX - 2) | 0, coordY, m.u32((pQuest + 0x04) >>> 0) >>> 0, pTargetRoom, 1, 1, 0) >>> 0
    }
    if (pPortal === 0 && pTargetRoom !== 0) {
      m.setU32(ppOutRoom, pTargetRoom)
      QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(m, pTargetRoom, pCoords, 2, 0x8000, ppOutRoom, 0x64)
      const pFoundRoom = m.u32(ppOutRoom) >>> 0
      pPortal = SUNIT_AllocUnitData113c(
        m,
        2,
        0xbd,
        m.u32(pCoords) | 0,
        m.u32((pCoords + 0x04) >>> 0) | 0,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        pFoundRoom !== 0 ? pFoundRoom : pTargetRoom,
        1,
        1,
        0,
      ) >>> 0
    }
    if (pPortal !== 0) {
      m.setU8((pExt + grpIdx + 0xf8) >>> 0, 1)
      m.setU32((pExt + grpIdx * 4 + 0xec) >>> 0, m.u32((pPortal + 0x0c) >>> 0) >>> 0)
      const pQGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      EVENT_SetEventFull113c(m, pQGame, pPortal, 7, (m.u32((pQGame + 0xa8) >>> 0) + 0x19) >>> 0, 0, 0, 0)
      DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pPortal) >>> 0, 0)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    const bDiff = m.u8((game + 0x6d) >>> 0)
    const pQuestRecord = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
    const nSaved = m.u32((pExt + 0xac) >>> 0) | 0
    const nDead = m.u32((pExt + 0xa8) >>> 0) | 0
    if (
      (m.u32((pExt + 0xa4) >>> 0) | 0) === ((nDead + nSaved) | 0) &&
      m.u8((pExt + 0x86) >>> 0) !== 0 &&
      m.u8((pExt + 0x87) >>> 0) !== 0 &&
      m.u8((pExt + 0x88) >>> 0) !== 0
    ) {
      if (nSaved <= 0x0b) {
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, game, ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c, 0, player)
        return
      }
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, m.u32((pQuest + 0x04) >>> 0) >>> 0, ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c, 0, 0)
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x24, 0) === 0 && DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x24, 1) === 0) {
        QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x24, 0x0d)
        QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x24, 1)
        const curSaved = m.u32((pExt + 0xac) >>> 0) | 0
        QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x24, curSaved === 0x0f ? 5 : curSaved === 0x0e ? 6 : 7)
      }
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, game, ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c, 0, player)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, game, ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c, 0, player)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, game, ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c, 0, player)
      return
    }
    QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x24, 4)
    if ((m.u32((pExt + 0xa8) >>> 0) | 0) < 5) {
      m.setU8((pQuest + 0x14) >>> 0, 0x20)
      m.setU8((pQuest + 0x0b) >>> 0, 2)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, m.u32((pQuest + 0x04) >>> 0) >>> 0, ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c, 0, 0)
    }
    m.setU8((pExt + 0x84) >>> 0, 0)
  } finally {
    freeW6B4Stack(sp)
  }
}

/**
 * Completes Act 5 Quest 1 (`Siege on Harrogath`) upon Shenk's death, propagating rewards and syncing quest logs.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7BDB0
 * @ordinalOrName ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0
 */
export function ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7BDB0)
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return
  const pUnit = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (pRoom === 0) return
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  m.setU32((pExt + 0x04) >>> 0, pRoom)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, m.u32((pQuestData + 0x04) >>> 0) >>> 0, ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c, 0, 0)
  const pArgGame = m.u32(pQuestArg >>> 0) >>> 0
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, pArgGame, ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c, 0, m.u32((pQuestArg + 0x08) >>> 0) >>> 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, pArgGame, ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c, 0, m.u32((pQuestArg + 0x08) >>> 0) >>> 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, pArgGame, ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c, 0, m.u32((pQuestArg + 0x08) >>> 0) >>> 0)
  QUESTS_SetGlobalQuestState_6FC53920_113c(m, m.u32((pQuestData + 0x04) >>> 0) >>> 0, 0x23, 0x0d)
  const pQGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pQuestCtrl = m.u32((pQGame + 0x10f4) >>> 0) >>> 0
  m.setU8((pQuestCtrl + 0x20) >>> 0, 0x0f)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, pQGame, QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c, 0, 0)
  if (m.u8((pQuestData + 0x0b) >>> 0) < 3) {
    m.setU8((pQuestData + 0x0b) >>> 0, 3)
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, m.u32((pQuestData + 0x04) >>> 0) >>> 0, ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c, 0, 0)
  }
}

/**
 * Tyrael (`0x209`) NPC activate callback for Act 5 Quest 6, spawning Destruction's End portal once (`+0x98 = 1`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7D920
 * @ordinalOrName ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920
 */
export function ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7D920)
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0x209) return
  if (m.u8((pExt + 0x98) >>> 0) !== 0) return
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c,
    0,
    m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
  )
  m.setU8((pExt + 0x98) >>> 0, 1)
}

/**
 * Resets the Ancients encounter on Arreat Summit (`Level 0x78`) when no living players remain.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC7E200
 * @ordinalOrName ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200
 */
export function ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC7E200)
  const game = pGame >>> 0
  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (pRoom === 0) return
  if ((DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0) !== 0x78) return
  const pQuest = findQuestInGame113c(m, game, 0x23)
  if (pQuest === 0 || m.u8((pQuest + 0x09) >>> 0) === 0) return
  const pExt = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u32((pExt + 0x0c) >>> 0) !== 0 || m.u8(pExt) !== 0 || m.u8((pExt + 0x11) >>> 0) === 0) return
  m.setU32((pExt + 0x54) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, game, ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c, 0, 0)
  if (m.u32((pExt + 0x54) >>> 0) === 0) {
    m.setU8((m.u32((pQuest + 0x18) >>> 0) + 0x11) >>> 0, 0)
    m.setU8((m.u32((pQuest + 0x18) >>> 0) + 0x10) >>> 0, 0)
    ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c(m, game, pQuest, m.u32((pQuest + 0x18) >>> 0) >>> 0)
  }
}

/**
 * Deckard Cain (`0x109`) NPC activate callback for Act 1 Quest 6 (`Sisters to the Slaughter`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC83190
 * @ordinalOrName ACT1Q6_Callback00_NpcActivateCain_6FC83190
 */
export function ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC83190)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0x109) return
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pExt + 0x195) >>> 0) !== 1) return
  m.setU8((pQuestData + 0x0b) >>> 0, 1)
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c,
    0,
    0,
  )
  m.setU8((pExt + 0x195) >>> 0, 0)
  m.setU32((pQuestData + 0xa8) >>> 0, 0)
}

/**
 * Timer callback for Act 1 Quest 5 (`Tools of the Trade`), promoting `bQState` to `0x0D` when `bLastState == 5`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC83210
 * @ordinalOrName ACT1Q5_TimerPromoteState0D_6FC83210
 */
export function ACT1Q5_TimerPromoteState0D_6FC83210_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC83210)
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestData + 0x0c) >>> 0) === 5) {
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    m.setU8((pQuestData + 0x0b) >>> 0, 0x0d)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
      0,
      0,
    )
  }
  m.setU8((pExt + 0x11c) >>> 0, 0)
  return 1
}

/**
 * Completes Charsi's Imbue quest globally (`Quest 5`, state `0x0D`) and updates `pfCallback[11]`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC83350
 * @ordinalOrName ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350
 */
export function ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FC83350)
  void ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c
  const pGame0 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGame0,
    ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c,
    0,
    0,
  )
  const pGame1 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pQuestCtrl = m.u32((pGame1 + 0x10f4) >>> 0) >>> 0
  if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
    throw new D2CommonAssertError('Quests.cpp', 0x820)
  }
  QUESTRECORD_SetQuestState113c(m, m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0, 5, 0x0d)
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u16((pExt + 0x64) >>> 0) === 0) {
    m.setU8((pQuestData + 0x0a) >>> 0, 0)
    return
  }
  m.setU32((pQuestData + 0xc8) >>> 0, 0x6fc811b0)
}

/**
 * Akara (`0x94`) and Cain (`0x92`) NPC activate callback for Act 1 Quest 4 (`Search for Cain`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC835D0
 * @ordinalOrName ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0
 */
export function ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC835D0)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nClassId = pNpc !== 0 ? (m.u32((pNpc + 0x04) >>> 0) >>> 0) : 0xffffffff
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if ((nClassId & 0xffff) === 0x94) {
    if (m.u8((pExt + 0x53) >>> 0) === 1) {
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      const pPlayer0 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
      m.setU8((pQuestData + 0x0b) >>> 0, 1)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuestData + 0x04) >>> 0) >>> 0,
        ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
        0,
        pPlayer0,
      )
      m.setU8((pExt + 0x53) >>> 0, 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuestData + 0x04) >>> 0) >>> 0,
        ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
        0,
        0,
      )
    }
    if (m.u8((pExt + 0x64) >>> 0) === 1) {
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      const pPlayer1 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
      m.setU8((pQuestData + 0x0b) >>> 0, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuestData + 0x04) >>> 0) >>> 0,
        ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
        0,
        pPlayer1,
      )
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuestData + 0x04) >>> 0) >>> 0,
        ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
        0,
        0,
      )
      m.setU8((pExt + 0x64) >>> 0, 0)
    }
    return
  }
  if ((nClassId & 0xffff) === 0x92) {
    m.setU8((pExt + 0x93) >>> 0, 1)
  }
}

/**
 * Decrements `pExt + 0x9C` and advances `bQState` to `3` with alert `0x03` when Countess's chamber conditions hold.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC836C0
 * @ordinalOrName ACT1Q5_DecrementCounterAndCheckState3_6FC836C0
 */
export function ACT1Q5_DecrementCounterAndCheckState3_6FC836C0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FC836C0)
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return
  if (m.u8((pQuestData + 0x0c) >>> 0) === 5) return
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  const nextCnt = ((m.u32((pExt + 0x9c) >>> 0) | 0) - 1) >>> 0
  m.setU32((pExt + 0x9c) >>> 0, nextCnt)
  if (nextCnt !== 0) return
  if (m.u8((pExt + 0x01) >>> 0) === 0) return
  if ((m.u32((pExt + 0x98) >>> 0) | 0) !== 2) return
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 3)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
    0,
    0,
  )
}

/**
 * Moldy Tome object operate callback for Forgotten Tower (`Quest 3`, state `6`), setting speech `0x24` and `bQState = 2`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC83730
 * @ordinalOrName ACT1Q5_OnMoldyTomeActivated_6FC83730
 */
export function ACT1Q5_OnMoldyTomeActivated_6FC83730_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC83730)
  const pPlayer0 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRecord = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 3, 6) === 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestRecord, 3, 6)
    const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
    if (pPlayer === 0) throw new D2CommonAssertError('Quests.cpp', 0x558)
    m.setU16((pPlayer + 0x6e) >>> 0, 0x24)
    m.setU32((pPlayer + 0x70) >>> 0, pPlayer)
    UNITROOM_RefreshUnit113c(m, pPlayer)
    m.setU32((pPlayer + 0xc4) >>> 0, (m.u32((pPlayer + 0xc4) >>> 0) | 0x400) >>> 0)
  }
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
    0,
    0,
  )
}

/**
 * Charsi (`0x9A`) NPC activate callback for Act 1 Quest 5 (`Tools of the Trade`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC83870
 * @ordinalOrName ACT1Q5_Callback00_NpcActivateCharsi_6FC83870
 */
export function ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC83870)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0x9a) return
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pExt + 0x02) >>> 0) === 1) {
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c,
      0,
      0,
    )
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
      0,
      0,
    )
    m.setU8((pExt + 0x02) >>> 0, 0)
    return
  }
  if (m.u8((pExt + 0x03) >>> 0) === 1) {
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    m.setU8((pQuestData + 0x0b) >>> 0, 0x0d)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
      0,
      0,
    )
    m.setU8((pExt + 0x03) >>> 0, 0)
  }
}

/**
 * Timer callback for Act 1 Quest 2 (`Sisters' Burial Grounds`), setting `bQState = 3` and sending alert `0x02`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC83A80
 * @ordinalOrName ACT1Q2_TimerPromoteState3_6FC83A80
 */
export function ACT1Q2_TimerPromoteState3_6FC83A80_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC83A80)
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 3)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c,
    0,
    0,
  )
  return 1
}

/**
 * Kashya (`0x96`) NPC activate callback for Act 1 Quest 2 (`Sisters' Burial Grounds`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC83AD0
 * @ordinalOrName ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0
 */
export function ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC83AD0)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0x96) return
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pExt + 0x03) >>> 0) !== 1) return
  m.setU8((pQuestData + 0x0b) >>> 0, 1)
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c,
    0,
    0,
  )
  m.setU8((pExt + 0x03) >>> 0, 0)
  m.setU32((pQuestData + 0xa8) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c,
    0,
    0,
  )
}

/**
 * Timer callback for Act 1 Quest 1 (`Den of Evil`), promoting `bQState = 5` when `bLastState == 4`.
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC83B50
 * @ordinalOrName ACT1Q1_TimerPromoteState5_6FC83B50
 */
export function ACT1Q1_TimerPromoteState5_6FC83B50_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC83B50)
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestData + 0x0c) >>> 0) === 4) {
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    m.setU8((pQuestData + 0x0b) >>> 0, 5)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0) >>> 0,
      ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
      0,
      0,
    )
  }
  m.setU8((pExt + 0x87) >>> 0, 0)
  return 1
}

/**
 * Akara (`0x94`) NPC activate callback for Act 1 Quest 1 (`Den of Evil`).
 *
 *
 * @dll D2Game.dll
 * @va 0x6FC83C40
 * @ordinalOrName ACT1Q1_Callback00_NpcActivateAkara_6FC83C40
 */
export function ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC83C40)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u16((pNpc + 0x04) >>> 0) !== 0x94) return
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pExt + 0x86) >>> 0) !== 1) return
  m.setU8((pQuestData + 0x0b) >>> 0, 1)
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
    0,
    0,
  )
  m.setU8((pExt + 0x86) >>> 0, 0)
  m.setU32((pQuestData + 0xa8) >>> 0, 0)
}


/**
 * Griswold death quest callback for Act 1 Quest 4 (`The Search for Cain`), updating quest state
 * and rolling 8 item drops (`'vps '`).
 *
 * @dll D2Game.dll
 * @va 0x6FC85A70
 * @ordinalOrName ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70
 */
export function ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC85A70)
  const pPlayer0 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  if (pPlayer0 !== 0) {
    const pGame0 = m.u32(pQuestArg >>> 0) >>> 0
    const pPlrData0 = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
    const nDiff0 = m.u8((pGame0 + 0x6d) >>> 0)
    const pQuestRec0 = m.u32((pPlrData0 + nDiff0 * 4 + 0x10) >>> 0) >>> 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec0, 4, 0x0a) !== 0) return
    const pGame1 = m.u32(pQuestArg >>> 0) >>> 0
    const bExpansion = m.u32((pGame1 + 0x70) >>> 0)
    const pPlayer1 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
    const pPlrData1 = UNITS_GetPlayerData113c(m, pPlayer1) >>> 0
    const nDiff1 = m.u8((pGame1 + 0x6d) >>> 0)
    const pQuestRec1 = m.u32((pPlrData1 + nDiff1 * 4 + 0x10) >>> 0) >>> 0
    const nCheckState = bExpansion !== 0 ? 0x28 : 0x1a
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec1, nCheckState, 0) === 0) return
    const pPlayer2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
    const pGame2 = m.u32(pQuestArg >>> 0) >>> 0
    const pPlrData2 = UNITS_GetPlayerData113c(m, pPlayer2) >>> 0
    const nDiff2 = m.u8((pGame2 + 0x6d) >>> 0)
    const pQuestRec2 = m.u32((pPlrData2 + nDiff2 * 4 + 0x10) >>> 0) >>> 0
    QUESTRECORD_SetQuestState113c(m, pQuestRec2, 4, 0x0a)
  }
  const pTarget0 = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const pGameMain = m.u32(pQuestArg >>> 0) >>> 0
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGameMain,
    ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c,
    0,
    pTarget0,
  )
  const pTarget1 = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  m.setU32((pTarget1 + 0xb8) >>> 0, 0x20737076)
  const frameBase = allocW6B4Stack(m, 0x10)
  try {
    m.setU32(frameBase, pQuestData >>> 0)
    for (let i = 8; i > 0; i--) {
      const pUnit = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
      const pGame = m.u32(pQuestArg >>> 0) >>> 0
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        pGame,
        pUnit,
        0,
        frameBase,
        0,
        -1,
        0,
      )
    }
  } finally {
    freeW6B4Stack(frameBase)
  }
}

/**
 * Timer callback for Act 1 Quest 4 (`The Search for Cain`), scanning monster units with
 * `ACT1Q4_OnCainModeOrInteract_6FC88150_113c` and clearing `pExt + 0x46`.
 *
 * @dll D2Game.dll
 * @va 0x6FC88250
 * @ordinalOrName ACT1Q4_TimerRefreshCainMonsterState_6FC88250
 */
export function ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC88250)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0) >>> 0,
    ACT1Q4_OnCainModeOrInteract_6FC88150_113c,
    1,
    0,
  )
  const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  m.setU8((pExt + 0x46) >>> 0, 0)
  return 1
}

/**
 * Spawns a ground item of `dwItemCode` with quantity `1` and quality `2` near `pUnit`,
 * and optionally removes `pOldItem` from `pUnit`'s inventory (`0x9D` action `0x05`).
 *
 * @dll D2Game.dll
 * @va 0x6FC8B070
 * @ordinalOrName ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070
 */
export function ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  dwItemCode: number,
  pOldItem: number,
): number {
  hitD2GameVa113c(0x6FC8B070)
  const frameBase = allocW6B4Stack(m, 0xb0)
  try {
    const pOutCoords = (frameBase + 0x04) >>> 0
    const pTargetCoords = (frameBase + 0x0c) >>> 0
    const pTempFlags = (frameBase + 0x0c) >>> 0
    const pItemDrop = (frameBase + 0x18) >>> 0

    PATH_GetTargetTypeAndPosition113c(m, pUnit, pTargetCoords)
    const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    const candX = (m.u32(pTargetCoords) + 2) >>> 0
    const candY = (m.u32((pTargetCoords + 4) >>> 0) + 3) >>> 0
    if (ROOM_FindRoomContainingSubtile113c(m, pRoom, candX, candY) !== 0) {
      m.setU32(pOutCoords, candX)
      m.setU32((pOutCoords + 4) >>> 0, candY)
    } else {
      m.setU32(pOutCoords, m.u32(pTargetCoords))
      m.setU32((pOutCoords + 4) >>> 0, m.u32((pTargetCoords + 4) >>> 0))
    }
    const pSpawnRoom =
      COLLISION_FindFreePositionBasic113c(
        m,
        pRoom,
        pOutCoords,
        pTargetCoords,
        1,
        0x3e01,
        0x801,
        1,
      ) >>> 0
    if (pSpawnRoom === 0) {
      return 0
    }
    for (let i = 0; i < 0x21; i++) {
      m.setU32((pItemDrop + i * 4) >>> 0, 0)
    }
    m.setU16((pItemDrop + 0x2a) >>> 0, m.u16((pGame + 0x78) >>> 0))
    const outX = m.u32(pOutCoords) >>> 0
    m.setU32((pItemDrop + 0x14) >>> 0, dwItemCode >>> 0)
    const outY = m.u32((pOutCoords + 4) >>> 0) >>> 0
    m.setU32((pItemDrop + 0x1c) >>> 0, outX)
    m.setU32(pItemDrop, 0)
    m.setU32((pItemDrop + 0x04) >>> 0, 0)
    m.setU32((pItemDrop + 0x08) >>> 0, pGame >>> 0)
    m.setU32((pItemDrop + 0x18) >>> 0, 3)
    m.setU32((pItemDrop + 0x20) >>> 0, outY)
    m.setU32((pItemDrop + 0x24) >>> 0, pSpawnRoom)
    m.setU16((pItemDrop + 0x28) >>> 0, 1)
    m.setU32((pItemDrop + 0x30) >>> 0, 2)
    const nItemLevel = ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, pGame, pUnit, 0) >>> 0
    m.setU32((pItemDrop + 0x0c) >>> 0, nItemLevel)
    const pCreatedItem = D2GAME_CreateItemEx_6FC31490_113c(m, pGame, pItemDrop, 0) >>> 0
    if (pCreatedItem !== 0) {
      STATLIST_SetUnitStat113c(m, pCreatedItem, 0x46, 1, 0)
      UNITROOM_RefreshUnit113c(m, pCreatedItem)
      m.setU32((pCreatedItem + 0xc4) >>> 0, (m.u32((pCreatedItem + 0xc4) >>> 0) | 1) >>> 0)
    }
    if (pOldItem === 0) {
      return 1
    }
    m.setU32(pTempFlags, 0)
    ITEMS_SetOrClearFlagMask113c(m, pTempFlags, 0x20, 1)
    const bPage = ITEMS_GetInvPage113c(m, pOldItem)
    ITEMS_SetNodePage113c(m, pOldItem, bPage)
    let pClient = 0
    if (pUnit !== 0 && m.u32(pUnit >>> 0) === 0) {
      const pPlrData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
      pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
    }
    NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(
      m,
      pOldItem,
      pUnit,
      pClient,
      m.u32(pTempFlags) >>> 0,
    )
    ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c(m, pUnit, pOldItem, pGame, 0)
    return 1
  } finally {
    freeW6B4Stack(frameBase)
  }
}

/**
 * Iterates `pUnit->pInventory` (`+0x60`) and removes all items located on page `3` (Horadric Cube),
 * notifying `pClient` via `0x9D` action `0x05` and returning the removed item count.
 *
 * @dll D2Game.dll
 * @va 0x6FC911D0
 * @ordinalOrName ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0
 */
export function ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pClient: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC911D0)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return 0
  }
  const frameBase = allocW6B4Stack(m, 0x10)
  try {
    let nCount = 0
    let pNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
    while (pNode !== 0) {
      const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
      pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
      if (pItem !== 0 && (ITEMS_GetInvPage113c(m, pItem) & 0xff) === 3) {
        m.setU32(frameBase, 0)
        ITEMS_SetOrClearFlagMask113c(m, frameBase, 0x20, 1)
        ITEMS_SetNodePage113c(m, pItem, 3)
        NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(
          m,
          pItem,
          pUnit,
          pClient,
          m.u32(frameBase) >>> 0,
        )
        ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c(m, pUnit, pItem, pGame, 0)
        nCount = (nCount + 1) | 0
      }
    }
    return nCount
  } finally {
    freeW6B4Stack(frameBase)
  }
}

/**
 * Assassin kick skill action handler (`Dragon Talon` / kick finisher): applies skill velocity
 * statlist (`+0x154`), validates target, rolls melee to-hit with `SKILLS_GetSkillToHitBonus` +
 * `STAT_SKILL_FINISHING_TOHIT` (`0x145`), computes kick + progressive charge damage
 * (`0x6FCB2360`), and allocates combat node (`0x6FCFDDE0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCB2940
 * @ordinalOrName SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940
 */
export function SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB2940)
  const pSkillsTxt = getSkillsTxt113c(m, nSkillId)
  if (pSkillsTxt === 0) {
    return 0
  }
  SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c(
    m,
    pAttacker,
    m.u32((pSkillsTxt + 0x154) >>> 0) | 0,
  )
  SUNIT_ValidatePathTargetUnit113c(m, pAttacker, pGame)
  const pDefender = PATH_GetTargetUnit113c(m, m.u32((pAttacker + 0x2c) >>> 0) >>> 0) >>> 0
  if (pDefender === pAttacker || pDefender === 0) {
    return 0
  }
  const nToHitBonus =
    ((SKILLS_GetSkillToHitBonus113c(m, pAttacker, nSkillId, nSkillLevel) | 0) +
      (STATLIST_GetUnitStat113c(m, pAttacker, 0x145, 0) | 0)) |
    0
  const pDmg = allocW6B4Stack(m, 0x70)
  try {
    const wResultFlags =
      SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(
        m,
        pAttacker,
        pDefender,
        pGame,
        nToHitBonus,
        0,
        0,
      ) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wResultFlags & 0xffff)
    if ((wResultFlags & 1) === 0) {
      return 0
    }
    SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c(
      m,
      pAttacker,
      pGame,
      pDmg,
      pDefender,
      nSkillId,
      nSkillLevel,
    )
    let bSrcDam = m.u8((pSkillsTxt + 0x1a5) >>> 0)
    if (bSrcDam === 0) {
      bSrcDam = 0x80
    }
    SUNITDMG_AllocCombat113c(m, pGame, pAttacker, pDefender, pDmg, bSrcDam)
    return 1
  } finally {
    freeW6B4Stack(pDmg)
  }
}
