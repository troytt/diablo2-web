/**
 * Milestone 33 [K2] Wave 6 Batch 2 (`w6b2`): 45 `D2Game.dll` v1.13c functions
 * in the VA range `0x6FC85E90..0x6FCE5790`.
 */

import { UNITS_GetObjectTxt113c, UNITS_GetPlayerData113c } from '../common/composit'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { mulDiv113c } from '../common/int-math'
import { INVENTORY_AllocInventory113c } from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckItemFlag113c,
  ITEMS_GetBaseCode113c,
} from '../common/items'
import {
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MONSTERS_GetHirelingTypeId113c,
} from '../common/missile'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
} from '../common/path'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetClassSkillCount113c,
  SKILLS_GetClassSkillId113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetLeftSkillFromSkillList113c,
  SKILLS_GetParam1113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_SetLeftSkill113c,
  SKILLS_SetRightSkill113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitHirelingResurrectCost113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist'
import {
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
  UNIT_GetAlignment113c,
} from '../common/unit'
import type { Memory113c } from '../mem/sparse-memory'
import { seedRoll, type D2SeedStrc } from '../prng'
import { DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c } from '../tables/monster-tbls-113c'
import {
  S2C_SendPacket9C_ItemActionWorld113c,
  SKILLS_ConsumeProgressiveChargesOnHit113c,
  SKILLS_ExecuteSkillStart113c,
} from './a1c-post150-f786-f1040-113c'
import {
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import {
  MONSTER_ApplyElementalDamageAndResistStats113c,
  NET_QueuePacketToClientBuffer113c,
} from './boot-init-gap-a-113c'
import {
  D2GAME_ARENA_FindPlayerSlotByUnit113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_PLRMODES_SendStatToClientOrParty113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import {
  AI_FleeFrom113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_RemoveCombatNode113c,
} from './combat-a1c-113c'
import {
  AI_ApproachTarget113c,
  SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c,
} from './k2-real-s2c-combat-113c'
import { ITEMS_CheckNotBrokenOrUnequipping113c } from './replay-kernel-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  AURA_ForEachUnitInRadius113c,
  STATES_CreateOrUpdateAuraStatList113c,
} from './k2-gap-itemdef-113c'
import {
  MISSILE_CreateServerProjectile113c,
  SKILLS_ResolveChargedSrvMissileId113c,
} from './k2-gap-melee-dot-113c'
import {
  PLAYER_IsBusyWithCursorOrNpcInteract113c,
  QUESTS_AddNpcDialogTextNodes113c,
  QUESTS_HasPlayerGuidInQuest113c,
} from './k2-items-tc-w1-113c'
import { SKILLS_EvalLinearParam34_6FC21A40_113c } from './k2-laneH-0x6fc2-w1-113c'
import {
  ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c,
  ITEMS_SendCursorPutItemPacket04_6FCADF70_113c,
  ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c,
  ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c,
  ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c,
} from './k2-w2b4-113c'
import {
  MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c,
  SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c,
} from './k2-w2b5-113c'
import {
  ACT2Q4_Callback00_Noop_6FCE1980_113c,
  ACT2Q4_StatusFilter_6FCE1970_113c,
  ACT2Q5_StatusFilter_6FCE1960_113c,
  STATES_PurgeExpStateStatLists_6FCDC920_113c,
} from './k2-w2b6-113c'
import {
  ACT2Q0_ActiveFilter_6FCE2590_113c,
  ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c,
  ACT2Q0_StatusFilter_6FCE25C0_113c,
  ACT2Q3_GetAltarState_6FCE2120_113c,
  ACT2Q7_ActiveFilter_6FCE2750_113c,
  ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c,
  ACT2Q8_ActiveFilter_6FCE25D0_113c,
  ACT2Q8_StatusFilter_6FCE25E0_113c,
} from './k2-w2b7-113c'
import { AI_ScheduleAiThinkTimer_6FD120C0_113c } from './k2-w2b8-113c'
import { SKILLS_ApplyProgressiveChargeState_6FC48E70_113c } from './k2-w3b2-113c'
import { STATES_OnStateRemovedResetMonsterAi_6FC70130_113c } from './k2-w3b5-113c'
import {
  NET_SendPacket7D_SetItemFlags_6FCAADE0_113c,
  NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c,
} from './k2-w4b4-113c'
import {
  ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c,
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
  PETS_ForEachPlayerPetUnit_6FCB6AF0_113c,
  PETS_SendPacket7A_UnsummonPet_6FCB6810_113c,
  SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c,
} from './k2-w4b5-113c'
import {
  AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c,
  SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
} from './k2-w4b6-113c'
import { MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c } from './k2-w4b7-113c'
import { SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c } from './k2-w5b1-113c'
import {
  NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c,
  NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c,
  NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c,
  OBJ_UseWellHealPlayerAndPets_6FC8A560_113c,
  PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c,
  SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c,
  SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c,
  SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c,
  SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c,
  SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c,
} from './k2-w5b2-113c'
import {
  ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c,
  AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
  ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c,
  MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c,
  SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c,
  SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c,
  SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c,
  SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c,
  SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c,
} from './k2-w5b3-113c'
import {
  ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c,
  ACT2Q8_ActiveFilter_6FCE25F0_113c,
  ACT2Q8_Callback00_NpcActivate_6FCE2680_113c,
  NPC_HealAndCureUnit_6FCDCBE0_113c,
  NPC_InitHirelingVendorRoster_6FCDCED0_113c,
  NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c,
} from './k2-w5b4-113c'
import {
  ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c,
  ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c,
  ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c,
  ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c,
  ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c,
  ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c,
  ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c,
  ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c,
} from './k2-w5b5-113c'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTER_SpawnAtCoords113c,
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { CLIENTS_GetPlayerUnit113c, SUNIT_FreeUnit113c } from './replay-final11-113c'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel'
import { AI_FindNearestPlayerTarget113c } from './town-npc-ai-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

let k2W6B2StackPtr = 0x7e940000

function sx16(v: number): number {
  return (v << 16) >> 16
}

function allocScratch(size: number): number {
  const aligned = (size + 7) & ~7
  k2W6B2StackPtr = (k2W6B2StackPtr - aligned) >>> 0
  return k2W6B2StackPtr
}

function freeScratch(size: number): void {
  const aligned = (size + 7) & ~7
  k2W6B2StackPtr = (k2W6B2StackPtr + aligned) >>> 0
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

function stepUnitSeedMod100(m: D2KernMemory113c, pSeed: number): number {
  const nextLo = stepSeed64At113c(m, pSeed) >>> 0
  return (nextLo % 100) | 0
}

function getMonsterAiControl113c(m: D2KernMemory113c, pUnit: number): number {
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      return m.u32((pMonData + 0x2c) >>> 0) >>> 0
    }
  }
  return 0
}

/**
 * [1/45] Spawns Cairn Stone portal lightning caster (`0x146`) and fires `0x14C` bolts toward each stone in `pQuestState`.
 *
 * @dll D2Game.dll
 * @va 0x6FC85E90
 * @ordinalOrName D2Game_6FC85E90
 */
export function ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestState: number,
): void {
  hitD2GameVa113c(0x6FC85E90)
  const qData = pQuestData >>> 0
  const qState = pQuestState >>> 0
  if (m.u8((qState + 0x118) >>> 0) === 0) return
  if (m.u8((qState + 0x119) >>> 0) !== 0) return
  if (m.u16((qState + 0x88) >>> 0) === 0) return

  let pSpawner = 0
  const pCoords = allocScratch(8)
  try {
    let i = 0
    let pGuidSlot = (qState + 0x68) >>> 0
    while (i < m.u16((qState + 0x88) >>> 0)) {
      const pGame = m.u32((qData + 0x04) >>> 0) >>> 0
      const dwStoneGuid = m.u32(pGuidSlot) >>> 0
      if (pGame === 0) {
        throw new D2CommonAssertError('A1Q3.cpp', 0x2d3)
      }
      let pStone = m.u32((pGame + 0x1520 + (dwStoneGuid & 0x7f) * 4) >>> 0) >>> 0
      while (pStone !== 0 && (m.u32((pStone + 0x0c) >>> 0) >>> 0) !== dwStoneGuid) {
        pStone = m.u32((pStone + 0xe4) >>> 0) >>> 0
      }
      if (pStone !== 0) {
        let spawnX = m.u32((qState + 0x110) >>> 0) | 0
        let spawnY = m.u32((qState + 0x114) >>> 0) | 0
        if (pSpawner === 0) {
          const pStoneRoom = UNITS_GetRoom113c(m, pStone) >>> 0
          const pPortalRoom = ROOM_FindRoomContainingSubtile113c(m, pStoneRoom, spawnX, spawnY) >>> 0
          if (pPortalRoom !== 0) {
            pSpawner =
              MONSTER_SpawnAtCoords113c(
                m,
                0x146,
                0x0c,
                m.u32((qData + 0x04) >>> 0) >>> 0,
                pPortalRoom,
                spawnX,
                spawnY,
                -1,
                0x08,
              ) >>> 0
          }
          if (pSpawner === 0) {
            m.setU32(pCoords, spawnX >>> 0)
            m.setU32((pCoords + 4) >>> 0, spawnY >>> 0)
            PATH_GetTargetTypeAndPosition113c(m, pStone, pCoords)
            spawnX = ((m.u32(pCoords) | 0) + 5) | 0
            spawnY = ((m.u32((pCoords + 4) >>> 0) | 0) + 5) | 0
            const pStoneRoom2 = UNITS_GetRoom113c(m, pStone) >>> 0
            const pRoom2 = ROOM_FindRoomContainingSubtile113c(m, pStoneRoom2, spawnX, spawnY) >>> 0
            pSpawner =
              MONSTER_SpawnAtCoords113c(
                m,
                0x146,
                0x0c,
                m.u32((qData + 0x04) >>> 0) >>> 0,
                pRoom2,
                spawnX,
                spawnY,
                -1,
                0x08,
              ) >>> 0
          }
        }
        if (pSpawner !== 0) {
          m.setU8((qState + 0x119) >>> 0, 1)
          const uTypeY = m.u32(pStone) | 0
          let targetY = 0
          if (uTypeY === 2 || (uTypeY > 3 && uTypeY <= 5)) {
            const pPath = m.u32((pStone + 0x2c) >>> 0) >>> 0
            targetY = m.u32((pPath + 0x10) >>> 0) | 0
          } else {
            const pPath = m.u32((pStone + 0x2c) >>> 0) >>> 0
            targetY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
          }
          const uTypeX = m.u32(pStone) | 0
          let targetX = 0
          if (uTypeX === 2 || (uTypeX > 3 && uTypeX <= 5)) {
            const pPath = m.u32((pStone + 0x2c) >>> 0) >>> 0
            targetX = m.u32((pPath + 0x0c) >>> 0) | 0
          } else {
            const pPath = m.u32((pStone + 0x2c) >>> 0) >>> 0
            targetX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
          }
          const pMissile =
            SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
              m,
              pSpawner,
              m.u32((qData + 0x04) >>> 0) >>> 0,
              0,
              1,
              0x14c,
              targetX,
              targetY,
            ) >>> 0
          if (pMissile !== 0) {
            MISSILE_SetTargetX113c(m, pMissile, m.u32(pGuidSlot) | 0)
            MISSILE_SetTargetY113c(m, pMissile, 0)
            const pMisRoom = UNITS_GetRoom113c(m, pMissile) >>> 0
            DUNGEON_ToggleHasPortalFlag113c(m, pMisRoom, 0)
          }
        }
      }
      i += 1
      pGuidSlot = (pGuidSlot + 4) >>> 0
    }
  } finally {
    freeScratch(8)
  }
}

/**
 * [2/45] Operates a healing well object (`pObjOpArgs`: `+0x00 pGame`, `+0x04 pObject`, `+0x08 pPlayer`).
 *
 * @dll D2Game.dll
 * @va 0x6FC8CEE0
 * @ordinalOrName D2Game_6FC8CEE0
 */
export function OBJ_OperateWell_6FC8CEE0_113c(m: D2KernMemory113c, pObjOpArgs: number): number {
  hitD2GameVa113c(0x6FC8CEE0)
  const args = pObjOpArgs >>> 0
  const pObject0 = m.u32((args + 0x04) >>> 0) >>> 0
  const pObjectsTxt = UNITS_GetObjectTxt113c(m, pObject0) >>> 0
  const pObject1 = m.u32((args + 0x04) >>> 0) >>> 0
  const pObjData1 = m.u32((pObject1 + 0x14) >>> 0) >>> 0
  let charges = m.u8((pObjData1 + 0x04) >>> 0)
  if (charges === 0) return 0

  const pGame0 = m.u32(args) >>> 0
  const pPlayer = m.u32((args + 0x08) >>> 0) >>> 0
  if (OBJ_UseWellHealPlayerAndPets_6FC8A560_113c(m, pObjectsTxt, pPlayer, pGame0) === 0) {
    return 0
  }

  const bParm4 = m.u8((pObjectsTxt + 0x180) >>> 0)
  charges = (charges - 1) & 0xff
  const twiceParm = (bParm4 << 1) & 0xff
  if ((charges >>> 0) <= (twiceParm >>> 0)) {
    const halfTwice = twiceParm >>> 1
    if (halfTwice !== 0 && (charges % halfTwice | 0) === 0) {
      const dwParm4 = m.u32((pObjectsTxt + 0x180) >>> 0) | 0
      const quot = dwParm4 !== 0 ? Math.trunc(charges / dwParm4) | 0 : 0
      UNITS_ChangeAnimMode113c(m, m.u32((args + 0x04) >>> 0) >>> 0, (2 - quot) | 0)
    }
  }

  const pObject2 = m.u32((args + 0x04) >>> 0) >>> 0
  const pObjData2 = m.u32((pObject2 + 0x14) >>> 0) >>> 0
  m.setU8((pObjData2 + 0x04) >>> 0, charges)
  const pGame2 = m.u32(args) >>> 0
  const nextFrame = (m.u32((pGame2 + 0xa8) >>> 0) + m.u32((pObjectsTxt + 0x178) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame2, m.u32((args + 0x04) >>> 0) >>> 0, 2, nextFrame, 0, 0, 0)
  return 0
}

/**
 * [3/45] Monster AI think callback (`0x6FCA51E0`): skirmishes by approaching beyond `aip2`, fleeing within `aip4`,
 * attacking within `aip6`, strafing (`pathType 5/6`), or stalling (`aip8`).
 *
 * @dll D2Game.dll
 * @va 0x6FCA51E0
 * @ordinalOrName D2Game_6FCA51E0
 */
export function MONAI_SkirmishApproachFleeAttackThink_6FCA51E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA51E0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const param = pAiParam >>> 0
  const pMonStatsTxt = m.u32((param + 0x1c) >>> 0) >>> 0
  const pOrigTarget = m.u32((param + 0x08) >>> 0) >>> 0
  const pDistScratch = allocScratch(4)
  try {
    m.setU32(pDistScratch, m.u32((param + 0x14) >>> 0))
    const pFoundTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, unit, game, 0, pDistScratch) >>> 0
    const nDist = m.u32(pDistScratch) | 0

    if (pFoundTarget !== 0) {
      let diff = m.u8((game + 0x6d) >>> 0)
      const aip2 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
      if (nDist > aip2) {
        const roll1 = stepUnitSeedMod100(m, (unit + 0x20) >>> 0)
        diff = m.u8((game + 0x6d) >>> 0)
        const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
        if (roll1 < aip3) {
          const pAiCtrl = getMonsterAiControl113c(m, unit)
          m.setU32((pAiCtrl + 0x1c) >>> 0, 10)
          const diffStep = m.u8((game + 0x6d) >>> 0)
          let stepByte = m.u8((pMonStatsTxt + diffStep * 2 + 0x5c) >>> 0)
          if (stepByte === 0) stepByte = 1
          AI_ApproachTarget113c(
            m,
            game,
            unit,
            pFoundTarget,
            2,
            0,
            0,
            (nDist & ~0xff) | stepByte,
            0,
          )
          return
        }
      }

      const aip4 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0))
      if (nDist <= aip4) {
        const roll2 = stepUnitSeedMod100(m, (unit + 0x20) >>> 0)
        diff = m.u8((game + 0x6d) >>> 0)
        const aip5 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0))
        if (roll2 < aip5) {
          const pAiCtrl = getMonsterAiControl113c(m, unit)
          m.setU32((pAiCtrl + 0x1c) >>> 0, 0x19)
          if (AI_FleeFrom113c(m, game, unit, pFoundTarget, 5, 1) === 0) {
            AI_StartAttackMode113c(m, 4, unit, game, pOrigTarget)
          }
          return
        }
      }

      const aip6 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0))
      if (nDist < aip6) {
        const roll3 = stepUnitSeedMod100(m, (unit + 0x20) >>> 0)
        diff = m.u8((game + 0x6d) >>> 0)
        const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
        if (roll3 < aip1) {
          AI_StartAttackMode113c(m, 4, unit, game, pFoundTarget)
          return
        }
      }
    }

    let diff = m.u8((game + 0x6d) >>> 0)
    const aip2Fallback = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
    if (nDist > aip2Fallback) {
      const roll4 = stepUnitSeedMod100(m, (unit + 0x20) >>> 0)
      diff = m.u8((game + 0x6d) >>> 0)
      const aip3Fallback = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
      if (roll4 < aip3Fallback) {
        const pAiCtrl = getMonsterAiControl113c(m, unit)
        m.setU32((pAiCtrl + 0x1c) >>> 0, 10)
        const diffStep = m.u8((game + 0x6d) >>> 0)
        let stepByte = m.u8((pMonStatsTxt + diffStep * 2 + 0x5c) >>> 0)
        if (stepByte === 0) stepByte = 1
        AI_ApproachTarget113c(m, game, unit, pOrigTarget, 2, 0, 0, (nDist & ~0xff) | stepByte, 0)
        return
      }
    }

    const roll5 = stepUnitSeedMod100(m, (unit + 0x20) >>> 0)
    diff = m.u8((game + 0x6d) >>> 0)
    const aip7 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x7a) >>> 0))
    if (roll5 < aip7) {
      const nextLo = stepSeed64At113c(m, (unit + 0x20) >>> 0)
      let pathType = (nextLo & 0xff) >= 0x80 ? 6 : 5
      if (pathType === 1) pathType = 7
      const pAiCtrl = getMonsterAiControl113c(m, unit)
      if (pathType !== 0) m.setU32((pAiCtrl + 0x18) >>> 0, pathType >>> 0)
      m.setU8((pAiCtrl + 0x20) >>> 0, 4)
      AI_ApproachTarget113c(m, game, unit, pOrigTarget, 2, 0, 0, 1, 0)
      return
    }

    const aip8 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x80) >>> 0))
    AI_Stall113c(m, game, unit, aip8)
  } finally {
    freeScratch(4)
  }
}

/**
 * [4/45] Monster AI think callback (`0x6FCA5500`): alternates between skill1 (`+0x170`/`+0x180`)
 * and self-targeted skill2 (`+0x172`/`+0x181`) with cooldown timers on `pAiControl`, or melee-attacks / stalls.
 *
 * @dll D2Game.dll
 * @va 0x6FCA5500
 * @ordinalOrName D2Game_6FCA5500
 */
export function MONAI_PutridDefilerImpregnateThink_6FCA5500_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA5500)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const param = pAiParam >>> 0
  const pTarget = m.u32((param + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((param + 0x1c) >>> 0) >>> 0
  const bInMeleeRange = m.u32((param + 0x18) >>> 0) | 0
  const nDist = m.u32((param + 0x14) >>> 0) | 0
  const pAiControl = m.u32(param) >>> 0

  const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (wSkill1 >= 0) {
    if ((m.u32((pAiControl + 0x1c) >>> 0) | 0) === 0) {
      const mode1 = m.u8((pMonStatsTxt + 0x180) >>> 0)
      AI_CastSkillWithMode113c(m, mode1, unit, game, wSkill1, pTarget, 0, 0)
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, game, unit, 8)
      const diff = m.u8((game + 0x6d) >>> 0)
      const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
      m.setU32((pAiControl + 0x18) >>> 0, (m.u32((game + 0xa8) >>> 0) + Math.imul(aip3, 25)) >>> 0)
      m.setU32((pAiControl + 0x1c) >>> 0, 1)
      return
    }
    if (
      (m.u32((pAiControl + 0x1c) >>> 0) | 0) === 2 &&
      (m.u32((game + 0xa8) >>> 0) | 0) > (m.u32((pAiControl + 0x18) >>> 0) | 0)
    ) {
      const diff = m.u8((game + 0x6d) >>> 0)
      const aip6 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0))
      let doCast1 = false
      if (nDist > aip6) {
        doCast1 = true
      } else if (bInMeleeRange === 0) {
        const s: D2SeedStrc = {
          lo: m.u32((unit + 0x20) >>> 0) >>> 0,
          hi: m.u32((unit + 0x24) >>> 0) >>> 0,
        }
        const roll = seedRoll(s, 100) | 0
        m.setU32((unit + 0x20) >>> 0, s.lo >>> 0)
        m.setU32((unit + 0x24) >>> 0, s.hi >>> 0)
        const diff2 = m.u8((game + 0x6d) >>> 0)
        const aip2 = sx16(m.u16((pMonStatsTxt + diff2 * 2 + 0x5c) >>> 0))
        if (roll < aip2) doCast1 = true
      }
      if (doCast1) {
        const skill1Reload = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
        const mode1 = m.u8((pMonStatsTxt + 0x180) >>> 0)
        AI_CastSkillWithMode113c(m, mode1, unit, game, skill1Reload, pTarget, 0, 0)
        AI_ScheduleAiThinkTimer_6FD120C0_113c(m, game, unit, 0x14)
        const diff3 = m.u8((game + 0x6d) >>> 0)
        const aip3 = sx16(m.u16((pMonStatsTxt + diff3 * 2 + 0x62) >>> 0))
        m.setU32((pAiControl + 0x18) >>> 0, (m.u32((game + 0xa8) >>> 0) + Math.imul(aip3, 25)) >>> 0)
        m.setU32((pAiControl + 0x1c) >>> 0, 1)
        return
      }
    }
  }

  const wSkill2 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
  if (
    wSkill2 >= 0 &&
    (m.u32((pAiControl + 0x1c) >>> 0) | 0) === 1 &&
    (m.u32((game + 0xa8) >>> 0) | 0) > (m.u32((pAiControl + 0x18) >>> 0) | 0)
  ) {
    let doCast2 = bInMeleeRange !== 0
    if (!doCast2) {
      const diff = m.u8((game + 0x6d) >>> 0)
      const aip6 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0))
      if (nDist < aip6) doCast2 = true
    }
    if (doCast2) {
      const mode2 = m.u8((pMonStatsTxt + 0x181) >>> 0)
      AI_CastSkillWithMode113c(m, mode2, unit, game, wSkill2, unit, 0, 0)
      const diff2 = m.u8((game + 0x6d) >>> 0)
      const aip4 = sx16(m.u16((pMonStatsTxt + diff2 * 2 + 0x68) >>> 0))
      m.setU32((pAiControl + 0x18) >>> 0, (m.u32((game + 0xa8) >>> 0) + Math.imul(aip4, 25)) >>> 0)
      m.setU32((pAiControl + 0x1c) >>> 0, 2)
      return
    }
  }

  if ((m.u32((pAiControl + 0x1c) >>> 0) | 0) === 1) {
    const diff = m.u8((game + 0x6d) >>> 0)
    const aip5 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0))
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, game, unit, aip5)
    return
  }

  const pDistScratch = allocScratch(4)
  let pAtkTarget = 0
  try {
    m.setU32(pDistScratch, nDist >>> 0)
    pAtkTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, unit, game, 0, pDistScratch) >>> 0
  } finally {
    freeScratch(4)
  }

  const rollAtk = stepUnitSeedMod100(m, (unit + 0x20) >>> 0)
  const diff = m.u8((game + 0x6d) >>> 0)
  const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
  if (rollAtk < aip1) {
    SKILLS_SetUsedSkillMemPort113c(m, unit, 0)
    if (unit !== 0) {
      const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((unit + 0x04) >>> 0) | 0) >>> 0
      if (pMonStats2 !== 0) {
        void m.u8((pMonStats2 + 0x104) >>> 0)
        const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0
        if (pBitMasks !== 0) {
          void m.u32((pBitMasks + 0x10) >>> 0)
        }
      }
    }
    MONSTER_StartMode113c(m, game, unit, 4, pAtkTarget, 0, 0)
    return
  }

  const aip5 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0))
  AI_Stall113c(m, game, unit, aip5)
}

/**
 * [5/45] Sends party member life/level sync packet `0x7F` (`10` bytes) and distant automap position packet `0x90`
 * (`13` bytes when distance `> 50`) for `pMemberUnit` (`edi`) to `pClient` (`eax`).
 *
 * @dll D2Game.dll
 * @va 0x6FCAE2A0
 * @ordinalOrName D2Game_6FCAE2A0
 */
export function NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c(
  m: D2KernMemory113c,
  pClient: number,
  pMemberUnit: number,
): void {
  hitD2GameVa113c(0x6FCAE2A0)
  const client = pClient >>> 0
  const member = pMemberUnit >>> 0
  if (member === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x72a)
  }
  const nLifePct = STATLIST_GetUnitLifePercent113c(m, member) | 0
  const bIsPlayer = (m.u32(member) | 0) === 0 ? 1 : 0
  const pPkt = allocScratch(0x10)
  try {
    m.fill(pPkt, 0x10, 0)
    m.setU8(pPkt, 0x7f)
    m.setU8((pPkt + 0x01) >>> 0, bIsPlayer)
    m.setU16((pPkt + 0x02) >>> 0, nLifePct >= 0xffff ? 0xffff : nLifePct & 0xffff)
    m.setU32((pPkt + 0x04) >>> 0, m.u32((member + 0x0c) >>> 0))
    const pRoom = UNITS_GetRoom113c(m, member) >>> 0
    const wLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) & 0xffff
    m.setU16((pPkt + 0x08) >>> 0, wLevelId)

    const pDestPlayer = CLIENTS_GetPlayerUnit113c(m, client, 0) >>> 0
    if (NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c(m, member, pDestPlayer, nLifePct, wLevelId) !== 0) {
      NET_QueuePacketToClientBuffer113c(m, client, 1, pPkt, 0x0a)
    }
    if (bIsPlayer !== 0) {
      const pDestPlayer2 = CLIENTS_GetPlayerUnit113c(m, client, 0) >>> 0
      if ((UNITS_GetApproximateDistance113c(m, pDestPlayer2, member) | 0) > 0x32) {
        m.fill(pPkt, 0x10, 0)
        m.setU8(pPkt, 0x90)
        m.setU32((pPkt + 0x01) >>> 0, m.u32((member + 0x0c) >>> 0))
        m.setU32((pPkt + 0x05) >>> 0, UNIT_GetPosX113c(m, member) >>> 0)
        m.setU32((pPkt + 0x09) >>> 0, UNIT_GetPosY113c(m, member) >>> 0)
        NET_QueuePacketToClientBuffer113c(m, client, 1, pPkt, 0x0d)
      }
    }
  } finally {
    freeScratch(0x10)
  }
}

/**
 * [6/45] Frees vendor and gamble inventories on `pNpcSlot` (`esi`), resets `+0x20`/`+0x28`, allocates a fresh
 * vendor inventory (`+0x04`), and binds `pNpcUnit->pInventory` (`+0x60`) when `pNpcUnit` is non-null.
 *
 * @dll D2Game.dll
 * @va 0x6FCB02E0
 * @ordinalOrName D2Game_6FCB02E0
 */
export function NPCS_ResetVendorSlotInventory_6FCB02E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pNpcSlot: number,
  pNpcUnit: number,
): void {
  hitD2GameVa113c(0x6FCB02E0)
  const game = pGame >>> 0
  const slot = pNpcSlot >>> 0
  const npc = pNpcUnit >>> 0
  NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c(m, game, slot)
  m.setU8((slot + 0x20) >>> 0, 0)
  m.setU32((slot + 0x28) >>> 0, 0)
  const pInv = INVENTORY_AllocInventory113c(m, m.u32((game + 0x1c) >>> 0) >>> 0, 0) >>> 0
  m.setU32((slot + 0x04) >>> 0, pInv)
  if (npc !== 0) {
    m.setU32((npc + 0x60) >>> 0, pInv)
  }
}

/**
 * [7/45] Checks whether `pMonster` (`esi`) is an evil non-hireling monster eligible for mode `11` (`0x0B`),
 * and rolls `seedRoll(pAttacker->tSeed, 100) <= nChance`.
 *
 * @dll D2Game.dll
 * @va 0x6FCB1610
 * @ordinalOrName D2Game_6FCB1610
 */
export function SKILLS_RollMonsterConversionChance_6FCB1610_113c(
  m: D2KernMemory113c,
  pMonster: number,
  pAttacker: number,
  nChance: number,
): number {
  hitD2GameVa113c(0x6FCB1610)
  const mon = pMonster >>> 0
  if (mon === 0 || (m.u32(mon) | 0) !== 1) return 0
  if ((MONSTERS_GetHirelingTypeId113c(m, mon) | 0) !== 0) return 0
  if ((UNIT_GetAlignment113c(m, mon) | 0) !== 0) return 0
  if (SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, mon, 0x0b) === 0) return 0
  const attacker = pAttacker >>> 0
  const s: D2SeedStrc = {
    lo: m.u32((attacker + 0x20) >>> 0) >>> 0,
    hi: m.u32((attacker + 0x24) >>> 0) >>> 0,
  }
  const roll = seedRoll(s, 100) | 0
  m.setU32((attacker + 0x20) >>> 0, s.lo >>> 0)
  m.setU32((attacker + 0x24) >>> 0, s.hi >>> 0)
  return roll <= (nChance | 0) ? 1 : 0
}

/**
 * [8/45] Resolves target coordinates and charged server missile ID (`0x6FCB1340`) for `pUnit` (`edx`),
 * then spawns the projectile within range `100` (`0x6FCC0000`).
 *
 * @dll D2Game.dll
 * @va 0x6FCB2230
 * @ordinalOrName D2Game_6FCB2230
 */
export function SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB2230)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  const pCoords = allocScratch(8)
  try {
    const pOutY = pCoords
    const pOutX = (pCoords + 4) >>> 0
    if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, unit, game, pOutX, pOutY) === 0) {
      return 0
    }
    if (skillLvl <= 0) return 0
    const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, unit) | 0
    if (nMissileId <= 0) return 0
    SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
      m,
      unit,
      game,
      skillId,
      skillLvl,
      nMissileId,
      m.u32(pOutX) | 0,
      m.u32(pOutY) | 0,
    )
    return 1
  } finally {
    freeScratch(8)
  }
}

/**
 * [9/45] Evaluates charge-scaled or `dwAuraRangeCalc` radius and applies skill physical + elemental
 * radial damage (`dwHitFlags = 2`) via `0x6FCB2CC0` around `pAttacker` (`edx`).
 *
 * @dll D2Game.dll
 * @va 0x6FCB2CF0
 * @ordinalOrName D2Game_6FCB2CF0
 */
export function SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB2CF0)
  const game = pGame >>> 0
  const attacker = pAttacker >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) return 0
  const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0) >>> 0
  const pTables = pTablesPtr !== 0 ? m.u32(pTablesPtr) >>> 0 : 0
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  let nRadius = SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c(m, attacker, skillId, skillLvl) | 0
  if (nRadius === 0) {
    nRadius =
      SKILLS_EvalCalcByOffset113c(m, attacker, m.u32((pSkillsTxt + 0x64) >>> 0) | 0, skillId, skillLvl) | 0
  }

  const pDmg = allocScratch(0x70)
  try {
    m.fill(pDmg, 0x70, 0)
    m.setU32(pDmg, 2)
    SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, attacker, skillId, pDmg, skillLvl)
    SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, attacker, pDmg, skillLvl)
    const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
    if (dwHitClass !== 0) {
      m.setU32((pDmg + 0x60) >>> 0, dwHitClass)
    }
    AURA_ForEachUnitInRadius113c(
      m,
      game,
      attacker,
      0,
      0,
      nRadius,
      m.u32((pSkillsTxt + 0x50) >>> 0) >>> 0,
      0x6fcb2cc0,
      pDmg,
      0,
      (mArg, pAuraCtx, pDef) => SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c(mArg, pAuraCtx, pDef),
    )
    return 1
  } finally {
    freeScratch(0x70)
  }
}

/**
 * [10/45] Dragon Tail `SrvDoFunc` (`0x6FCB3110`): consumes progressive charges, executes primary melee hit,
 * and splashes `(calc1 + STAT_ITEM_FIRE_MASTERY)%` of primary physical damage as fire + knockback (`0x0009`)
 * across `dwAuraRangeCalc` around `pTarget`.
 *
 * @dll D2Game.dll
 * @va 0x6FCB3110
 * @ordinalOrName D2Game_6FCB3110
 */
export function SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB3110)
  const game = pGame >>> 0
  const attacker = pAttacker >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) return 0
  const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0) >>> 0
  const pTables = pTablesPtr !== 0 ? m.u32(pTablesPtr) >>> 0 : 0
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, attacker, game)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((attacker + 0x2c) >>> 0) >>> 0) >>> 0
  if (pTarget === attacker || pTarget === 0) return 0
  const pFoundDmg = SUNITDMG_FindCombatDamageData113c(m, attacker, pTarget) >>> 0
  if (pFoundDmg === 0) return 0

  const pScratch = allocScratch(0xe0)
  const pSavedDmg = pScratch
  const pSplashDmg = (pScratch + 0x70) >>> 0
  try {
    for (let off = 0; off < 0x70; off += 4) {
      m.setU32((pSavedDmg + off) >>> 0, m.u32((pFoundDmg + off) >>> 0))
    }
    SKILLS_ConsumeProgressiveChargesOnHit113c(m, 0, attacker, game)
    SUNITDMG_ExecuteEvents113c(m, game, attacker, pTarget, 1, 0)
    if (SUNIT_IsDeadOrDying113c(m, attacker) === 0) {
      m.fill(pSplashDmg, 0x70, 0)
      const calc1 =
        SKILLS_EvalCalcByOffset113c(m, attacker, m.u32((pSkillsTxt + 0x138) >>> 0) | 0, skillId, skillLvl) | 0
      const fireMastery = STATLIST_GetUnitStat113c(m, attacker, 0x149, 0) | 0
      const savedPhysDmg = m.u32((pSavedDmg + 0x08) >>> 0) | 0
      const fireDmg = mulDiv113c((calc1 + fireMastery) | 0, savedPhysDmg, 100) | 0
      m.setU32((pSplashDmg + 0x10) >>> 0, fireDmg >>> 0)
      m.setU16((pSplashDmg + 0x04) >>> 0, 0x0009)
      const nRadius =
        SKILLS_EvalCalcByOffset113c(m, attacker, m.u32((pSkillsTxt + 0x64) >>> 0) | 0, skillId, skillLvl) | 0
      const targetY = UNIT_GetPosY113c(m, pTarget) | 0
      const targetX = UNIT_GetPosX113c(m, pTarget) | 0
      AURA_ForEachUnitInRadius113c(
        m,
        game,
        attacker,
        targetX,
        targetY,
        nRadius,
        0x8583,
        0x6fcc1210,
        pSplashDmg,
        0,
        (mArg, pAuraCtx, pCand) => AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c(mArg, pAuraCtx, pCand),
      )
    }
    return 1
  } finally {
    freeScratch(0xe0)
  }
}

/**
 * [11/45] Dragon Claw `SrvDoFunc` (`0x6FCB3270`): rolls hit and progressive charges against path target,
 * executes combat events, and toggles `dwFlags` bit `0x40` based on `(dwFramePrecise >> 8) % 2`.
 *
 * @dll D2Game.dll
 * @va 0x6FCB3270
 * @ordinalOrName D2Game_6FCB3270
 */
export function SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB3270)
  const game = pGame >>> 0
  const attacker = pAttacker >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, attacker, game)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((attacker + 0x2c) >>> 0) >>> 0) >>> 0
  if (pTarget === attacker || pTarget === 0) return 0

  const frameIdx = (m.u32((attacker + 0x38) >>> 0) | 0) >> 8
  const isEven = (frameIdx % 2 | 0) === 0
  SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c(
    m,
    attacker,
    game,
    pTarget,
    nSkillId | 0,
    nSkillLevel | 0,
  )
  if (SUNITDMG_FindCombatDamageData113c(m, attacker, pTarget) !== 0) {
    SKILLS_ConsumeProgressiveChargesOnHit113c(m, 0, attacker, game)
  }
  SUNITDMG_ExecuteEvents113c(m, game, attacker, pTarget, 1, 0)
  if (isEven) {
    m.setU32((attacker + 0xc4) >>> 0, (m.u32((attacker + 0xc4) >>> 0) & 0xffffffbf) >>> 0)
  } else {
    m.setU32((attacker + 0xc4) >>> 0, (m.u32((attacker + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  return 1
}

/**
 * [12/45] Executes pending combat events on path target (if any), resolves target/path coordinates,
 * and applies charge-scaled radial skill physical + elemental damage (`wResultFlags |= 1`, `dwHitFlags |= 1`).
 *
 * @dll D2Game.dll
 * @va 0x6FCB3340
 * @ordinalOrName D2Game_6FCB3340
 */
export function SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB3340)
  const game = pGame >>> 0
  const attacker = pAttacker >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) return 0
  const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0) >>> 0
  const pTables = pTablesPtr !== 0 ? m.u32(pTablesPtr) >>> 0 : 0
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, attacker, game)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((attacker + 0x2c) >>> 0) >>> 0) >>> 0
  if (pTarget !== attacker && pTarget !== 0) {
    SUNITDMG_ExecuteEvents113c(m, game, attacker, pTarget, 1, 0)
  }

  const pScratch = allocScratch(0x78)
  const pOutY = pScratch
  const pOutX = (pScratch + 4) >>> 0
  const pDmg = (pScratch + 8) >>> 0
  try {
    if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, attacker, game, pOutX, pOutY) === 0) {
      return 0
    }
    let nRadius = SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c(m, attacker, skillId, skillLvl) | 0
    if (nRadius === 0) {
      nRadius =
        SKILLS_EvalCalcByOffset113c(m, attacker, m.u32((pSkillsTxt + 0x64) >>> 0) | 0, skillId, skillLvl) | 0
    }
    m.fill(pDmg, 0x70, 0)
    SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, attacker, skillId, pDmg, skillLvl)
    SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, attacker, pDmg, skillLvl)
    m.setU16((pDmg + 0x04) >>> 0, (m.u16((pDmg + 0x04) >>> 0) | 1) & 0xffff)
    m.setU32(pDmg, (m.u32(pDmg) | 1) >>> 0)
    AURA_ForEachUnitInRadius113c(
      m,
      game,
      attacker,
      m.u32(pOutX) | 0,
      m.u32(pOutY) | 0,
      nRadius,
      m.u32((pSkillsTxt + 0x50) >>> 0) >>> 0,
      0x6fcb2cc0,
      pDmg,
      0,
      (mArg, pAuraCtx, pDef) => SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c(mArg, pAuraCtx, pDef),
    )
    return 1
  } finally {
    freeScratch(0x78)
  }
}

/**
 * [13/45] Periodic aura pulse (`0x6FCB35F0`, Blade Shield): validates `wAuraState`, skill ownership,
 * and non-town room before invoking `SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c`.
 *
 * @dll D2Game.dll
 * @va 0x6FCB35F0
 * @ordinalOrName D2Game_6FCB35F0
 */
export function SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB35F0)
  const game = pGame >>> 0
  const attacker = pAttacker >>> 0
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0) >>> 0
  const pTables = pTablesPtr !== 0 ? m.u32(pTablesPtr) >>> 0 : 0
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wAuraState < 0 || wAuraState >= (m.u32((pTables + 0xc4) >>> 0) | 0)) return 0
  if (SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, attacker, skillId) === 0) return 0

  const pRoom = UNITS_GetRoom113c(m, attacker) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) === 0) {
    SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c(m, game, attacker, skillId, nSkillLevel | 0)
  }
  return 1
}

/**
 * [14/45] Radial Cloak of Shadows / curse statlist callback (`0x6FCB3850`, `ecx = pAuraCtx`, `edx = pTargetUnit`):
 * creates/updates aura statlist (`pfnRemove = 0x6FC70130`), sets up to 5 stat pairs, and switches monsters
 * eligible for mode `0x0A` to special AI `10` (`0x6FCBD230`).
 *
 * @dll D2Game.dll
 * @va 0x6FCB3850
 * @ordinalOrName D2Game_6FCB3850
 */
export function SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FCB3850)
  void STATES_OnStateRemovedResetMonsterAi_6FC70130_113c
  const ctx = pAuraCtx >>> 0
  const target = pTargetUnit >>> 0
  const pDesc = m.u32((ctx + 0x0c) >>> 0) >>> 0
  if (target === 0) return 0
  if ((m.u8((target + 0xc6) >>> 0) & 1) !== 0) return 0

  const uType = m.u32(target) | 0
  if (uType === 0) {
    const mode = m.u32((target + 0x10) >>> 0) | 0
    if (mode === 0 || mode === 0x11) return 0
  } else if (uType === 1) {
    const mode = m.u32((target + 0x10) >>> 0) | 0
    if (mode === 0 || mode === 0x0c) return 0
  } else {
    return 0
  }

  const pSetup = allocScratch(0x24)
  try {
    m.fill(pSetup, 0x24, 0)
    m.setU32(pSetup, m.u32((ctx + 0x04) >>> 0))
    m.setU32((pSetup + 0x04) >>> 0, target)
    m.setU32((pSetup + 0x08) >>> 0, m.u32(pDesc))
    m.setU32((pSetup + 0x0c) >>> 0, m.u32((pDesc + 0x04) >>> 0))
    m.setU32((pSetup + 0x10) >>> 0, m.u32((pDesc + 0x08) >>> 0))
    const rawExpire = m.u32((pDesc + 0x10) >>> 0) | 0
    m.setU32((pSetup + 0x14) >>> 0, rawExpire > 0 ? rawExpire >>> 0 : 0xffffffff)
    m.setU32((pSetup + 0x18) >>> 0, m.u32((pDesc + 0x28) >>> 0))
    m.setU32((pSetup + 0x1c) >>> 0, m.u32((pDesc + 0x0c) >>> 0))
    m.setU32((pSetup + 0x20) >>> 0, 0x6fc70130)

    const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, pSetup) >>> 0
    if (pStatList === 0) return 0

    for (let k = 0; k < 5; k += 1) {
      const statId = m.u32((pDesc + 0x14 + k * 4) >>> 0) | 0
      if (statId >= 0) {
        const statVal = m.u32((pDesc + 0x2c + k * 4) >>> 0) | 0
        STATLIST_SetStat113c(m, pStatList, statId, statVal, 0)
      }
    }

    if ((m.u32(target) | 0) === 1) {
      if (SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, target, 0x0a) !== 0) {
        let pAiGen = 0
        if ((m.u32(target) | 0) === 1) {
          const pMonData = m.u32((target + 0x14) >>> 0) >>> 0
          if (pMonData !== 0) {
            pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
          }
        }
        AI_InitMonsterAiThinkFn113c(m, target, m.u32(ctx) >>> 0, pAiGen, 0x0a)
      }
    }
    return 1
  } finally {
    freeScratch(0x24)
  }
}

/**
 * [15/45] Resolves charged server missile ID (`>= 0`) and stage count (`> 0`), evaluates `dwAuraRangeCalc` spread,
 * and spawns scattered projectiles via `SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c`.
 *
 * @dll D2Game.dll
 * @va 0x6FCB4DC0
 * @ordinalOrName D2Game_6FCB4DC0
 */
export function SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCaster: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB4DC0)
  const game = pGame >>> 0
  const caster = pCaster >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) return 0
  const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0) >>> 0
  const pTables = pTablesPtr !== 0 ? m.u32(pTablesPtr) >>> 0 : 0
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, caster) | 0
  if (nMissileId < 0) return 0
  const nCount = SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c(m, caster, skillId, skillLvl) | 0
  if (nCount <= 0) return 0
  const nSpread =
    SKILLS_EvalCalcByOffset113c(m, caster, m.u32((pSkillsTxt + 0x64) >>> 0) | 0, skillId, skillLvl) | 0
  return (
    SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c(
      m,
      game,
      caster,
      nMissileId,
      caster,
      nCount,
      nSpread,
      skillId,
      skillLvl,
    ) | 0
  )
}

/**
 * [16/45] Dual-claw progressive charge `SrvDoFunc` (`0x6FCB61A0`): toggles `dwFlags` bit `0x40`
 * on odd animation frames when dual-wielding two unbroken `h2h` (`0x2D`) claws, else sets `0x40`,
 * then delegates to `SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c`.
 *
 * @dll D2Game.dll
 * @va 0x6FCB61A0
 * @ordinalOrName D2Game_6FCB61A0
 */
export function SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB61A0)
  const game = pGame >>> 0
  const attacker = pAttacker >>> 0
  const pInv = m.u32((attacker + 0x60) >>> 0) >>> 0
  let useFrameParity = pInv === 0
  if (pInv !== 0) {
    const pRight = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv, 4) >>> 0
    const pLeft = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv, 5) >>> 0
    if (
      pRight !== pLeft &&
      pRight !== 0 &&
      pLeft !== 0 &&
      ITEMS_CheckNotBrokenOrUnequipping113c(m, pRight) !== 0 &&
      ITEMS_CheckNotBrokenOrUnequipping113c(m, pLeft) !== 0 &&
      ITEMS_CheckItemTypeIdMemPort113c(m, pRight, 0x2d) !== 0 &&
      ITEMS_CheckItemTypeIdMemPort113c(m, pLeft, 0x2d) !== 0
    ) {
      useFrameParity = true
    }
  }

  if (!useFrameParity) {
    m.setU32((attacker + 0xc4) >>> 0, (m.u32((attacker + 0xc4) >>> 0) | 0x40) >>> 0)
  } else {
    const frameIdx = (m.u32((attacker + 0x38) >>> 0) | 0) >> 8
    if ((frameIdx % 2 | 0) === 0) {
      m.setU32((attacker + 0xc4) >>> 0, (m.u32((attacker + 0xc4) >>> 0) & 0xffffffbf) >>> 0)
    } else {
      m.setU32((attacker + 0xc4) >>> 0, (m.u32((attacker + 0xc4) >>> 0) | 0x40) >>> 0)
    }
  }
  SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c(
    m,
    game,
    attacker,
    nSkillId | 0,
    nSkillLevel | 0,
  )
  return 1
}

/**
 * [17/45] Kills/unsummons every pet node in `pPetTypeSlot` (`[esp+4]`) via `0x6FCB77E0`
 * and zeroes `pPetTypeSlot[0..1]`.
 *
 * @dll D2Game.dll
 * @va 0x6FCB64B0
 * @ordinalOrName D2Game_6FCB64B0
 */
export function PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPetTypeSlot: number,
): void {
  hitD2GameVa113c(0x6FCB64B0)
  const game = pGame >>> 0
  const slot = pPetTypeSlot >>> 0
  let pNode = m.u32(slot) >>> 0
  while (pNode !== 0) {
    const dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
    const pNext = m.u32((pNode + 0x14) >>> 0) >>> 0
    PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c(m, game, dwPetGuid)
    void m.u32((game + 0x1c) >>> 0)
    pNode = pNext
  }
  m.setU32(slot, 0)
  m.setU32((slot + 0x04) >>> 0, 0)
}

/**
 * [18/45] Cleans up or marks dead all pet nodes in `pPetTypeSlot` (`0x6FCB7420`), broadcasting `0x7A`,
 * recording room portal node, and sending `0x9B` hireling resurrect cost when `bKeepHirelingDeadNode != 0`.
 *
 * @dll D2Game.dll
 * @va 0x6FCB7420
 * @ordinalOrName D2Game_6FCB7420
 */
export function PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPetTypeSlot: number,
  bPlayerAlive: number,
  bKeepHirelingDeadNode: number,
): void {
  hitD2GameVa113c(0x6FCB7420)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const slot = pPetTypeSlot >>> 0
  let pNode = m.u32(slot) >>> 0
  const pScratch = allocScratch(0x30)
  const pTempNode = pScratch
  const pPkt9B = (pScratch + 0x20) >>> 0
  try {
    while (pNode !== 0) {
      const pNext = m.u32((pNode + 0x14) >>> 0) >>> 0
      if (bPlayerAlive === 0) {
        PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c(m, game, m.u32((pNode + 0x04) >>> 0) >>> 0)
        m.setU32((slot + 0x04) >>> 0, ((m.u32((slot + 0x04) >>> 0) | 0) - 1) >>> 0)
        m.setU32((slot + 0x08) >>> 0, ((m.u32((slot + 0x08) >>> 0) | 0) - 1) >>> 0)
        void m.u32((game + 0x1c) >>> 0)
        pNode = pNext
        continue
      }
      const dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
      if (game === 0) {
        throw new D2CommonAssertError('SUnitPets.cpp', 0x2d3)
      }
      let pPetUnit = m.u32((game + 0x1320 + (dwPetGuid & 0x7f) * 4) >>> 0) >>> 0
      while (pPetUnit !== 0 && (m.u32((pPetUnit + 0x0c) >>> 0) >>> 0) !== dwPetGuid) {
        pPetUnit = m.u32((pPetUnit + 0xe4) >>> 0) >>> 0
      }
      if (pPetUnit !== 0) {
        m.fill(pTempNode, 0x1c, 0)
        m.setU32(pTempNode, dwPetGuid)
        D2GAME_SUNIT_IterateAllLivingPlayers113c(
          m,
          game,
          (mem, _g, pPlr, pCtx) => {
            PETS_SendPacket7A_UnsummonPet_6FCB6810_113c(mem, pPlr, pCtx)
          },
          pTempNode,
        )
        const pRoom = UNITS_GetRoom113c(m, pPetUnit) >>> 0
        DUNGEON_AddRoomPortalNode113c(m, pRoom, 1, m.u32((pPetUnit + 0x0c) >>> 0) | 0)
        if (bKeepHirelingDeadNode === 0) {
          SUNIT_FreeUnit113c(m, game, pPetUnit)
          m.setU32((slot + 0x04) >>> 0, ((m.u32((slot + 0x04) >>> 0) | 0) - 1) >>> 0)
          m.setU32((slot + 0x08) >>> 0, ((m.u32((slot + 0x08) >>> 0) | 0) - 1) >>> 0)
          void m.u32((game + 0x1c) >>> 0)
          pNode = pNext
          continue
        }
        const nodeFlags = m.u32(pNode) >>> 0
        if ((nodeFlags & 1) === 0) {
          m.setU32(pNode, (nodeFlags | 1) >>> 0)
          m.setU32(slot, pNode)
          if (UNITS_GetRoom113c(m, pPetUnit) !== 0) {
            SKILLS_SetUsedSkillMemPort113c(m, pPetUnit, 0)
            let pOwnerOrKiller = 0
            if (((m.u32((pPetUnit + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
              pOwnerOrKiller =
                SUNIT_GetServerUnit113c(
                  m,
                  game,
                  m.u32((pPetUnit + 0x94) >>> 0) | 0,
                  m.u32((pPetUnit + 0x98) >>> 0) >>> 0,
                ) >>> 0
            }
            MONSTER_StartMode113c(m, game, pPetUnit, 0, pOwnerOrKiller, 0, 0)
          }
          let pClient = 0
          if (player !== 0 && (m.u32(player) | 0) === 0) {
            const pPlrData = UNITS_GetPlayerData113c(m, player) >>> 0
            pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
          }
          const dwCost = STATLIST_GetUnitHirelingResurrectCost113c(m, pPetUnit) >>> 0
          m.setU8(pPkt9B, 0x9b)
          m.setU16((pPkt9B + 0x01) >>> 0, m.u16((pNode + 0x0c) >>> 0))
          m.setU32((pPkt9B + 0x03) >>> 0, dwCost)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt9B, 7)
        }
      }
      if (bKeepHirelingDeadNode === 0) {
        m.setU32((slot + 0x04) >>> 0, ((m.u32((slot + 0x04) >>> 0) | 0) - 1) >>> 0)
        m.setU32((slot + 0x08) >>> 0, ((m.u32((slot + 0x08) >>> 0) | 0) - 1) >>> 0)
        void m.u32((game + 0x1c) >>> 0)
      }
      pNode = pNext
    }
    if (m.u32((slot + 0x04) >>> 0) === 0) {
      m.setU32(slot, 0)
    }
  } finally {
    freeScratch(0x30)
  }
}

/**
 * [19/45] Unlinks `dwPetGuid` (`ecx`) from `pPetTypeSlot`, broadcasts `0x7A` unsummon to all living players,
 * kills or clears bit `0x80000000` on the pet unit, and decrements `pPetTypeSlot->nCount` (asserting `>= 0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCB7920
 * @ordinalOrName D2Game_6FCB7920
 */
export function PETS_RemovePetFromSlotByGuid_6FCB7920_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwPetGuid: number,
  pPetTypeSlot: number,
  bKillMonsterUnit: number,
): void {
  hitD2GameVa113c(0x6FCB7920)
  const game = pGame >>> 0
  const petGuid = dwPetGuid >>> 0
  const slot = pPetTypeSlot >>> 0
  let pPrev = 0
  let pCur = m.u32(slot) >>> 0
  while (pCur !== 0 && (m.u32((pCur + 0x04) >>> 0) >>> 0) !== petGuid) {
    pPrev = pCur
    pCur = m.u32((pCur + 0x14) >>> 0) >>> 0
  }
  if (pCur === 0) return

  const pNext = m.u32((pCur + 0x14) >>> 0) >>> 0
  if (pPrev !== 0) {
    m.setU32((pPrev + 0x14) >>> 0, pNext)
  } else {
    m.setU32(slot, pNext)
  }

  const pTempNode = allocScratch(0x1c)
  try {
    m.fill(pTempNode, 0x1c, 0)
    m.setU32(pTempNode, petGuid)
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      game,
      (mem, _g, pPlr, pCtx) => {
        PETS_SendPacket7A_UnsummonPet_6FCB6810_113c(mem, pPlr, pCtx)
      },
      pTempNode,
    )
  } finally {
    freeScratch(0x1c)
  }

  if (game === 0) {
    throw new D2CommonAssertError('SUnitPets.cpp', 0x2d3)
  }
  const dwNodeGuid = m.u32((pCur + 0x04) >>> 0) >>> 0
  let pPetUnit = m.u32((game + 0x1320 + (dwNodeGuid & 0x7f) * 4) >>> 0) >>> 0
  while (pPetUnit !== 0 && (m.u32((pPetUnit + 0x0c) >>> 0) >>> 0) !== dwNodeGuid) {
    pPetUnit = m.u32((pPetUnit + 0xe4) >>> 0) >>> 0
  }
  if (pPetUnit !== 0) {
    if (bKillMonsterUnit !== 0) {
      PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c(m, game, dwNodeGuid)
    } else {
      m.setU32((pPetUnit + 0xc4) >>> 0, (m.u32((pPetUnit + 0xc4) >>> 0) & 0x7fffffff) >>> 0)
    }
  }
  void m.u32((game + 0x1c) >>> 0)
  const newCount = ((m.u32((slot + 0x04) >>> 0) | 0) - 1) | 0
  m.setU32((slot + 0x04) >>> 0, newCount >>> 0)
  if (newCount < 0) {
    throw new D2CommonAssertError('SUnitPets.cpp', 0x260)
  }
}

/**
 * [20/45] Checks monster conversion / Mind Blast eligibility for `pTargetUnit` (`ebx`) under `nSkillId` (`edi`),
 * optionally rolling `seedRoll(pCasterUnit->tSeed, 100) < calc1` when `bRollChance != 0`.
 *
 * @dll D2Game.dll
 * @va 0x6FCB88B0
 * @ordinalOrName D2Game_6FCB88B0
 */
export function SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pTargetUnit: number,
  pCasterUnit: number,
  nSkillLevel: number,
  bRollChance: number,
): number {
  hitD2GameVa113c(0x6FCB88B0)
  const skillId = nSkillId | 0
  const target = pTargetUnit >>> 0
  const caster = pCasterUnit >>> 0
  if (skillId < 0) return 0
  const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0) >>> 0
  const pTables = pTablesPtr !== 0 ? m.u32(pTablesPtr) >>> 0 : 0
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  if ((MONSTERS_GetHirelingTypeId113c(m, target) | 0) !== 0) return 0
  if (target === 0 || (m.u32(target) | 0) !== 1) return 0
  if ((UNIT_GetAlignment113c(m, target) | 0) !== 0) return 0
  if (SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, target, 0x0b) === 0) return 0

  const nChance =
    SKILLS_EvalCalcByOffset113c(m, caster, m.u32((pSkillsTxt + 0x138) >>> 0) | 0, skillId, nSkillLevel | 0) | 0
  if (bRollChance !== 0) {
    const s: D2SeedStrc = {
      lo: m.u32((caster + 0x20) >>> 0) >>> 0,
      hi: m.u32((caster + 0x24) >>> 0) >>> 0,
    }
    const roll = seedRoll(s, 100) | 0
    m.setU32((caster + 0x20) >>> 0, s.lo >>> 0)
    m.setU32((caster + 0x24) >>> 0, s.hi >>> 0)
    if (roll >= nChance) return 0
  }
  return 1
}

/**
 * [21/45] Dispatches pending item command/state flag network packets (`0x9C`, `0x9D`, `0x7D`, pickup/cursor/belt/container)
 * for `pItem` (`eax`) on `pOwnerUnit` (`ecx`) to `pClient` (`[esp+4]`).
 *
 * @dll D2Game.dll
 * @va 0x6FCBB630
 * @ordinalOrName D2Game_6FCBB630
 */
export function ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c(
  m: D2KernMemory113c,
  pItem: number,
  pOwnerUnit: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCBB630)
  const item = pItem >>> 0
  const owner = pOwnerUnit >>> 0
  const client = pClient >>> 0
  if (client === 0) {
    throw new D2CommonAssertError('Items.cpp', 0xfb)
  }

  let pClientPlayer = 0
  if ((m.u8((client + 0x3d4) >>> 0) & 1) !== 0) {
    pClientPlayer = m.u32((client + 0x174) >>> 0) >>> 0
  } else {
    const cachedPlr = m.u32((client + 0x174) >>> 0) >>> 0
    if (cachedPlr !== 0) {
      pClientPlayer =
        SUNIT_GetServerUnit113c(
          m,
          m.u32((client + 0x1a8) >>> 0) >>> 0,
          m.u32((client + 0x16c) >>> 0) | 0,
          m.u32((client + 0x170) >>> 0) >>> 0,
        ) >>> 0
      if (pClientPlayer === 0) {
        m.setU32((client + 0x174) >>> 0, 0)
      }
    }
  }

  const pGame = m.u32((client + 0x1a8) >>> 0) >>> 0
  let pInteractNpc = 0
  if (m.u8((pClientPlayer + 0x6c) >>> 0) !== 0) {
    pInteractNpc =
      SUNIT_GetServerUnit113c(
        m,
        pGame,
        m.u32((pClientPlayer + 0x68) >>> 0) | 0,
        m.u32((pClientPlayer + 0x64) >>> 0) >>> 0,
      ) >>> 0
  }

  if (item !== 0) {
    const dwFlagsEx = m.u32((item + 0xc8) >>> 0) >>> 0
    if (((dwFlagsEx >>> 2) & 1) !== 0) {
      if (pInteractNpc !== owner) return 1
      if (NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c(m, pClientPlayer, pGame, pInteractNpc, item, 0) === 0) {
        return 1
      }
      ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c(m, 0x38, item, client)
      return 1
    }
    if (((dwFlagsEx >>> 4) & 1) !== 0) {
      if (pInteractNpc !== owner) return 1
      if (NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c(m, pClientPlayer, pGame, pInteractNpc, item, 1) === 0) {
        return 1
      }
      ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c(m, 0x39, item, client)
      return 1
    }
  }

  if (ITEMS_CheckItemFlag113c(m, item, 0x40) !== 0 && owner === pClientPlayer) {
    ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c(m, owner, item, client, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x80000) !== 0 && owner === pClientPlayer) {
    NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 0x16, owner, item, client, 0, 0)
    return 1
  }
  if (
    (ITEMS_CheckItemFlag113c(m, item, 0x02) !== 0 || ITEMS_CheckItemFlag113c(m, item, 0x80) !== 0) &&
    owner === pClientPlayer
  ) {
    ITEMS_SendCursorPutItemPacket04_6FCADF70_113c(m, owner, client, item, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x04) !== 0 && owner === pClientPlayer) {
    NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(m, item, owner, client, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x08) !== 0 || ITEMS_CheckItemFlag113c(m, item, 0x200) !== 0) {
    NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 0x06, owner, item, client, 0, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x10000) !== 0) {
    NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 0x07, owner, item, client, 0, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x10) !== 0) {
    NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 0x08, owner, item, client, 0, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x20) !== 0) {
    NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 0x09, owner, item, client, 0, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x100) !== 0 && owner === pClientPlayer) {
    ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c(m, owner, client, item, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x40000) !== 0 && owner === pClientPlayer) {
    ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c(m, owner, client, item, 0)
    return 1
  }
  if (
    (ITEMS_CheckItemFlag113c(m, item, 0x400) !== 0 || ITEMS_CheckItemFlag113c(m, item, 0x2000) !== 0) &&
    owner === pClientPlayer
  ) {
    ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c(m, owner, client, item, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x800) !== 0 && owner === pClientPlayer) {
    S2C_SendPacket9C_ItemActionWorld113c(m, client, item, 0x0f, 0, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x1000) !== 0 && owner === pClientPlayer) {
    S2C_SendPacket9C_ItemActionWorld113c(m, client, item, 0x10, 0, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x100000) !== 0 && owner === pClientPlayer) {
    S2C_SendPacket9C_ItemActionWorld113c(m, client, item, 0x12, 0, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x200000) !== 0) {
    NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 0x17, owner, item, client, 0, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x4000) !== 0) {
    NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 0x11, owner, item, client, 0, 0)
    return 1
  }
  if (ITEMS_CheckItemFlag113c(m, item, 0x8000) !== 0) {
    NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 0x14, owner, item, client, 0, 0)
    return 1
  }

  if (ITEMS_CheckCommandFlags113c(m, item, 0x100) !== 0) {
    if (owner !== pClientPlayer && (item === 0 || (m.u32((item + 0x10) >>> 0) | 0) !== 1)) {
      return 0
    }
    const hasBroken = ITEMS_CheckCommandFlags113c(m, item, 0x100) >>> 0
    NET_SendPacket7D_SetItemFlags_6FCAADE0_113c(m, owner, item, client, 0x100, hasBroken)
    return 1
  }
  if (ITEMS_CheckCommandFlags113c(m, item, 0x200) !== 0) {
    if (owner !== pClientPlayer && (item === 0 || (m.u32((item + 0x10) >>> 0) | 0) !== 1)) {
      return 0
    }
    const hasRepaired = ITEMS_CheckCommandFlags113c(m, item, 0x200) >>> 0
    NET_SendPacket7D_SetItemFlags_6FCAADE0_113c(m, owner, item, client, 0x200, hasRepaired)
    return 1
  }

  if (ITEMS_CheckCommandFlags113c(m, item, 0x01) === 0) return 0
  const itemMode = item !== 0 ? m.u32((item + 0x10) >>> 0) | 0 : 0
  if (owner !== pClientPlayer && (itemMode === 0 || itemMode === 2)) return 0
  if (itemMode !== 0 && itemMode !== 1 && itemMode !== 2) return 0
  if (owner === pClientPlayer && ITEMS_CheckCommandFlags113c(m, item, 0x40000) !== 0) return 0
  NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(m, 0x15, owner, item, client, 0, 0)
  return 1
}

/**
 * [22/45] Applies radial skill damage (`0x6FCC1210`) around `pCenterUnit` (`ecx`) with default filter `0x8583`.
 *
 * @dll D2Game.dll
 * @va 0x6FCC1240
 * @ordinalOrName D2Game_6FCC1240
 */
export function AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c(
  m: D2KernMemory113c,
  dwFilterFlags: number,
  pCenterUnit: number,
  pDmg: number,
  pGame: number,
  nX: number,
  nY: number,
  nRadius: number,
): number {
  hitD2GameVa113c(0x6FCC1240)
  const filter = dwFilterFlags !== 0 ? dwFilterFlags >>> 0 : 0x8583
  const center = pCenterUnit >>> 0
  if (center !== 0) {
    AURA_ForEachUnitInRadius113c(
      m,
      pGame >>> 0,
      center,
      nX | 0,
      nY | 0,
      nRadius | 0,
      filter,
      0x6fcc1210,
      pDmg >>> 0,
      0,
      (mArg, pAuraCtx, pTarget) => AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c(mArg, pAuraCtx, pTarget),
    )
  }
  return 1
}

function getUnitPosXInline113c(m: D2KernMemory113c, pUnit: number): number {
  const uType = m.u32(pUnit >>> 0) | 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return m.u32((pPath + 0x0c) >>> 0) | 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function getUnitPosYInline113c(m: D2KernMemory113c, pUnit: number): number {
  const uType = m.u32(pUnit >>> 0) | 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return m.u32((pPath + 0x10) >>> 0) | 0
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

/**
 * [23/45] Spawns a targeted server projectile (`dwFlags = 0x420`) from `pUnit` (`esi`) + `(nOffsetX, nOffsetY)`,
 * resolving target coords via `0x6FCBFA30` when `(nTargetX, nTargetY)` are zero and optionally consuming ammo (`0x6FCC1790`).
 *
 * @dll D2Game.dll
 * @va 0x6FCC1880
 * @ordinalOrName D2Game_6FCC1880
 */
export function SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(
  m: D2KernMemory113c,
  nTargetX: number,
  pUnit: number,
  pGame: number,
  nMissileId: number,
  nSkillId: number,
  nSkillLevel: number,
  nOffsetX: number,
  nOffsetY: number,
  nTargetY: number,
  bConsumeAmmo: number,
): number {
  hitD2GameVa113c(0x6FCC1880)
  const unit = pUnit >>> 0
  const game = pGame >>> 0
  const pMisParams = allocScratch(0x5c)
  try {
    m.fill(pMisParams, 0x5c, 0)
    m.setU32(pMisParams, 0x420)
    m.setU32((pMisParams + 0x04) >>> 0, unit)
    m.setU32((pMisParams + 0x08) >>> 0, unit)
    m.setU32((pMisParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pMisParams + 0x30) >>> 0, nSkillLevel >>> 0)
    m.setU32((pMisParams + 0x14) >>> 0, ((getUnitPosXInline113c(m, unit) + (nOffsetX | 0)) | 0) >>> 0)
    m.setU32((pMisParams + 0x18) >>> 0, ((getUnitPosYInline113c(m, unit) + (nOffsetY | 0)) | 0) >>> 0)
    m.setU32((pMisParams + 0x10) >>> 0, nMissileId >>> 0)

    if ((nTargetX | 0) !== 0 && (nTargetY | 0) !== 0) {
      m.setU32((pMisParams + 0x1c) >>> 0, nTargetX >>> 0)
      m.setU32((pMisParams + 0x20) >>> 0, nTargetY >>> 0)
    } else if (
      SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
        m,
        unit,
        game,
        (pMisParams + 0x1c) >>> 0,
        (pMisParams + 0x20) >>> 0,
      ) === 0
    ) {
      return 0
    }

    if (bConsumeAmmo !== 0 && (m.u32(unit) | 0) === 0) {
      if ((SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c(m, unit, game) | 0) <= 0) {
        return 0
      }
    }
    return MISSILE_CreateServerProjectile113c(m, game, pMisParams) >>> 0
  } finally {
    freeScratch(0x5c)
  }
}

/**
 * [24/45] Spawns a directional server projectile (`dwFlags = 0x21`, adding `0x1000` + monster `STAT_TOHIT`
 * when `pUnit` is a monster with non-zero attack rating) and optionally consumes player ammo (`0x6FCC1790`).
 *
 * @dll D2Game.dll
 * @va 0x6FCC28F0
 * @ordinalOrName D2Game_6FCC28F0
 */
export function SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  nMissileId: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  nOffsetX: number,
  nOffsetY: number,
  nTargetX: number,
  nTargetY: number,
  bConsumeAmmo: number,
): number {
  hitD2GameVa113c(0x6FCC28F0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const pMisParams = allocScratch(0x5c)
  try {
    m.fill(pMisParams, 0x5c, 0)
    m.setU32(pMisParams, 0x21)
    m.setU32((pMisParams + 0x04) >>> 0, unit)
    m.setU32((pMisParams + 0x14) >>> 0, ((getUnitPosXInline113c(m, unit) + (nOffsetX | 0)) | 0) >>> 0)
    m.setU32((pMisParams + 0x18) >>> 0, ((getUnitPosYInline113c(m, unit) + (nOffsetY | 0)) | 0) >>> 0)
    m.setU32((pMisParams + 0x30) >>> 0, nSkillLevel >>> 0)
    m.setU32((pMisParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pMisParams + 0x10) >>> 0, nMissileId >>> 0)

    if ((nTargetX | 0) !== 0 && (nTargetY | 0) !== 0) {
      m.setU32((pMisParams + 0x1c) >>> 0, nTargetX >>> 0)
      m.setU32((pMisParams + 0x20) >>> 0, nTargetY >>> 0)
    } else if (
      SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
        m,
        unit,
        game,
        (pMisParams + 0x1c) >>> 0,
        (pMisParams + 0x20) >>> 0,
      ) === 0
    ) {
      return 0
    }

    if ((m.u32((pMisParams + 0x1c) >>> 0) | 0) === 0 || (m.u32((pMisParams + 0x20) >>> 0) | 0) === 0) {
      return 0
    }

    if ((m.u32(unit) | 0) === 1) {
      const nToHit = STATLIST_GetUnitStat113c(m, unit, 0x13, 0) | 0
      if (nToHit !== 0) {
        m.setU32((pMisParams + 0x48) >>> 0, nToHit >>> 0)
        m.setU32(pMisParams, (m.u32(pMisParams) | 0x1000) >>> 0)
      }
    }

    if (bConsumeAmmo !== 0 && (m.u32(unit) | 0) === 0) {
      if ((SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c(m, unit, game) | 0) <= 0) {
        return 0
      }
    }
    return MISSILE_CreateServerProjectile113c(m, game, pMisParams) >>> 0
  } finally {
    freeScratch(0x5c)
  }
}

/**
 * [25/45] Initializes Shadow Master AI state (`0x6FCC4320`), granting basic attack (`0`) and all eligible
 * owner class skills (`SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c`) at clamped bonus levels (`0x6FCC3D00`).
 *
 * @dll D2Game.dll
 * @va 0x6FCC4320
 * @ordinalOrName D2Game_6FCC4320
 */
export function MONAI_InitShadowMasterClassSkills_6FCC4320_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pSummonUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC4320)
  const summon = pSummonUnit >>> 0
  const param = pAiParam >>> 0
  const pAiCtrl = m.u32(param) >>> 0
  m.setU32((pAiCtrl + 0x14) >>> 0, 0)
  m.setU32((pAiCtrl + 0x18) >>> 0, 0)
  m.setU32((pAiCtrl + 0x1c) >>> 0, 1)
  if (summon === 0 || (m.u32(summon) | 0) !== 1) return

  const pMonData = m.u32((summon + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGen === 0) return
  const pOwnerGame = m.u32((pAiGen + 0x28) >>> 0) >>> 0
  if (pOwnerGame === 0) return

  const pOwner =
    SUNIT_GetServerUnit113c(
      m,
      pOwnerGame,
      m.u32((pAiGen + 0x30) >>> 0) | 0,
      m.u32((pAiGen + 0x2c) >>> 0) >>> 0,
    ) >>> 0
  if (pOwner === 0 || (m.u32(pOwner) | 0) !== 0) return

  const pMonStatsTxt = m.u32((param + 0x1c) >>> 0) >>> 0
  const nSummonSkillId = sx16(m.u16((pMonStatsTxt + 0x80) >>> 0))
  const pOwnerSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pOwner, nSummonSkillId) >>> 0
  if (pOwnerSkill !== 0) {
    const nLvl = SKILLS_EvaluateSkillLevel113c(m, pOwner, pOwnerSkill, 1) | 0
    m.setU32((pAiCtrl + 0x1c) >>> 0, nLvl >>> 0)
  }
  const nBaseBonus = m.u32((pAiCtrl + 0x1c) >>> 0) | 0

  if (SKILLS_GetSkillById113c(m, summon, 0, -1) === 0) {
    SKILLS_SetSkillLevelOnUnit113c(m, summon, 0, 1, 0, 0x6fd1b6b0, 0xbee)
  }
  SKILLS_SetLeftSkill113c(m, summon, 0, -1)
  SKILLS_SetRightSkill113c(m, summon, 0, -1)

  let idx = 0
  while (idx < (SKILLS_GetClassSkillCount113c(m, m.u32((pOwner + 0x04) >>> 0) | 0) | 0)) {
    const nClassSkillId = SKILLS_GetClassSkillId113c(m, m.u32((pOwner + 0x04) >>> 0) | 0, idx) | 0
    if (SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c(m, pOwner, nClassSkillId, summon) !== 0) {
      SKILLS_GetSkillById113c(m, summon, nClassSkillId, -1)
      const nClampedLvl =
        MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c(m, pOwner, nClassSkillId, nBaseBonus) | 0
      SKILLS_SetSkillLevelOnUnit113c(m, summon, nClassSkillId, nClampedLvl, 0, 0x6fd1b6b0, 0xbfd)
    }
    idx += 1
  }
}

/**
 * [26/45] Filters whether a Shadow summon (`ebx`) can cast `nSkillId` (`ecx`) given `pAiParam` (`eax`)
 * and `pOwnerUnit` (`[esp+8]`), checking melee range, `bAIType` (`+0x230`), active states, and charge cap (`< 3`).
 *
 * @dll D2Game.dll
 * @va 0x6FCC44C0
 * @ordinalOrName D2Game_6FCC44C0
 */
export function MONAI_CanShadowCastSkillInContext_6FCC44C0_113c(
  m: D2KernMemory113c,
  pAiParam: number,
  nSkillId: number,
  pShadowUnit: number,
  _pGame: number,
  pOwnerUnit: number,
): number {
  hitD2GameVa113c(0x6FCC44C0)
  const param = pAiParam >>> 0
  const skillId = nSkillId | 0
  const shadow = pShadowUnit >>> 0
  const pTarget = m.u32((param + 0x08) >>> 0) >>> 0
  const bInMelee = m.u32((param + 0x18) >>> 0) | 0
  if (skillId < 0) return 0

  const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0) >>> 0
  const pTables = pTablesPtr !== 0 ? m.u32(pTablesPtr) >>> 0 : 0
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  if (SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c(m, pOwnerUnit >>> 0, skillId, shadow) === 0) {
    return 0
  }

  const bAiType = m.u8((pSkillsTxt + 0x230) >>> 0)
  if (bInMelee !== 0) {
    if (bAiType !== 4 && bAiType !== 0x0d) return 0
  } else if (bAiType === 4 || bAiType === 0x0d) {
    return 0
  }

  if (bAiType === 1) {
    const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
    if (wAuraState > 0 && STATES_CheckState113c(m, shadow, wAuraState) !== 0) return 0
  }

  if (pTarget === 0) {
    if (
      bAiType === 2 ||
      bAiType === 4 ||
      bAiType === 5 ||
      bAiType === 11 ||
      bAiType === 12 ||
      bAiType === 13
    ) {
      return 0
    }
  }

  if (bAiType === 2) {
    const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
    if (wAuraState > 0 && STATES_CheckState113c(m, shadow, wAuraState) !== 0) return 0
    const wTargetState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
    if (wTargetState > 0 && STATES_CheckState113c(m, pTarget, wTargetState) !== 0) return 0
  }

  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0
  const bit2 = pBitMasks !== 0 ? m.u8((pBitMasks + 0x08) >>> 0) : 0x04
  if ((m.u8((pSkillsTxt + 0x04) >>> 0) & bit2) !== 0) {
    const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
    if (wAuraState > 0 && STATES_CheckState113c(m, shadow, wAuraState) !== 0) {
      const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, shadow, wAuraState) >>> 0
      if (pStatList !== 0) {
        const wPassiveStat = sx16(m.u16((pSkillsTxt + 0x54) >>> 0))
        if ((STATLIST_GetStatValue113c(m, pStatList, wPassiveStat, 0) | 0) >= 3) {
          return 0
        }
      }
    }
  }
  return 1
}

/**
 * [27/45] Death Sentry trap AI (`0x6FCC7C20`): updates charge/town state (`0x6FCC4A10`), casts Corpse Explosion
 * (`mode 9`) when a corpse within `param34 / 2` of target is found, else casts secondary bolt (`mode 0x0E`) or stalls.
 *
 * @dll D2Game.dll
 * @va 0x6FCC7C20
 * @ordinalOrName D2Game_6FCC7C20
 */
export function MONAI_DeathSentryTrapThink_6FCC7C20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC7C20)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const param = pAiParam >>> 0
  if (AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c(m, unit, game, param, 0) !== 0) return

  const pMonStatsTxt = m.u32((param + 0x1c) >>> 0) >>> 0
  const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  const pSkill1 = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, wSkill1) >>> 0
  if (pSkill1 === 0) return
  const nSkillLvl1 = SKILLS_EvaluateSkillLevel113c(m, unit, pSkill1, 1) | 0
  if (nSkillLvl1 <= 0) return

  const pScratch = allocScratch(8)
  try {
    const pCanMelee = pScratch
    const pnOutDist = (pScratch + 4) >>> 0
    const pTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, unit, game, pCanMelee, pnOutDist) >>> 0
    if (pTarget === 0) {
      const diff = m.u8((game + 0x6d) >>> 0)
      const aip2 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
      AI_Stall113c(m, game, unit, aip2)
      return
    }

    const nTargetDist = m.u32(pnOutDist) | 0
    const pCorpse = SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c(m, pTarget, unit, nSkillLvl1) >>> 0
    const pAiCtrl = m.u32(param) >>> 0
    const dwLastCorpseGuid = m.u32((pAiCtrl + 0x14) >>> 0) >>> 0
    const ceRadius = Math.trunc((SKILLS_EvalLinearParam34_6FC21A40_113c(m, wSkill1, nSkillLvl1) | 0) / 2) | 0
    if (
      pCorpse !== 0 &&
      (m.u32((pCorpse + 0x0c) >>> 0) >>> 0) !== dwLastCorpseGuid &&
      (UNITS_GetApproximateDistance113c(m, pTarget, pCorpse) | 0) < ceRadius
    ) {
      if (AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c(m, unit, game, param, 1) !== 0) return
      const pAiCtrl2 = m.u32(param) >>> 0
      m.setU32((pAiCtrl2 + 0x14) >>> 0, m.u32((pCorpse + 0x0c) >>> 0))
      AI_CastSkillWithMode113c(m, 9, unit, game, wSkill1, pCorpse, 0, 0)
      return
    }

    let diff = m.u8((game + 0x6d) >>> 0)
    const aip4 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0))
    if (nTargetDist < aip4) {
      diff = m.u8((game + 0x6d) >>> 0)
      const s: D2SeedStrc = {
        lo: m.u32((unit + 0x20) >>> 0) >>> 0,
        hi: m.u32((unit + 0x24) >>> 0) >>> 0,
      }
      const roll = seedRoll(s, 100) | 0
      m.setU32((unit + 0x20) >>> 0, s.lo >>> 0)
      m.setU32((unit + 0x24) >>> 0, s.hi >>> 0)
      const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
      if (roll < aip3) {
        if (AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c(m, unit, game, param, 1) !== 0) return
        const wSkill2 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
        AI_CastSkillWithMode113c(m, 0x0e, unit, game, wSkill2, pTarget, 0, 0)
        return
      }
    }

    const aip2 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
    AI_Stall113c(m, game, unit, aip2)
  } finally {
    freeScratch(8)
  }
}

/**
 * [28/45] Stationary sentry trap AI (`0x6FCC7DC0`): expires into mode `0` if skill1 is missing, clears state `0x0C`,
 * acquires target within `aip4`, decrements trap shot counter (`0x6FCC4A10`), purges `Event 2` nodes, and casts `wSkill1`.
 *
 * @dll D2Game.dll
 * @va 0x6FCC7DC0
 * @ordinalOrName D2Game_6FCC7DC0
 */
export function MONAI_StationarySentryTrapThink_6FCC7DC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC7DC0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const param = pAiParam >>> 0
  const pMonStatsTxt = m.u32((param + 0x1c) >>> 0) >>> 0
  const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  const diff0 = m.u8((game + 0x6d) >>> 0)
  const aip4 = sx16(m.u16((pMonStatsTxt + diff0 * 2 + 0x68) >>> 0))
  if (AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c(m, unit, game, param, 0) !== 0) return

  const pSkill1 = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, wSkill1) >>> 0
  if (pSkill1 === 0) {
    SKILLS_SetUsedSkillMemPort113c(m, unit, 0)
    MONSTER_StartMode113c(m, game, unit, 0, 0, 0, 0)
    return
  }

  if (STATES_CheckState113c(m, unit, 0x0c) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, unit, 0x0c, 0)
  }

  const pScratch = allocScratch(8)
  try {
    const pnOutDist = pScratch
    const pbCanMelee = (pScratch + 4) >>> 0
    const pTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, unit, game, pbCanMelee, pnOutDist) >>> 0
    if (pTarget === 0 || (m.u32(pnOutDist) | 0) >= aip4) {
      const diff2 = m.u8((game + 0x6d) >>> 0)
      const aip3 = sx16(m.u16((pMonStatsTxt + diff2 * 2 + 0x62) >>> 0))
      AI_Stall113c(m, game, unit, aip3)
      return
    }

    const diff1 = m.u8((game + 0x6d) >>> 0)
    const s: D2SeedStrc = {
      lo: m.u32((unit + 0x20) >>> 0) >>> 0,
      hi: m.u32((unit + 0x24) >>> 0) >>> 0,
    }
    const roll = seedRoll(s, 100) | 0
    m.setU32((unit + 0x20) >>> 0, s.lo >>> 0)
    m.setU32((unit + 0x24) >>> 0, s.hi >>> 0)
    const aip1 = sx16(m.u16((pMonStatsTxt + diff1 * 2 + 0x56) >>> 0))
    if (roll >= aip1) {
      const aip2 = sx16(m.u16((pMonStatsTxt + diff1 * 2 + 0x5c) >>> 0))
      AI_Stall113c(m, game, unit, aip2)
      return
    }

    if (AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c(m, unit, game, param, 1) !== 0) return
    if (unit !== 0) {
      let pEv = m.u32((unit + 0xdc) >>> 0) >>> 0
      while (pEv !== 0) {
        const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
        if (m.u8(pEv) === 2) EVENT_FreeNode113c(m, game, pEv)
        pEv = pNext
      }
    }

    const nCastMode = SKILLS_GetLeftSkillFromSkillList113c(m, pSkill1) & 0xff
    AI_CastSkillWithMode113c(m, nCastMode, unit, game, wSkill1, pTarget, 0, 0)
  } finally {
    freeScratch(8)
  }
}

function resolveMonModeChangeAnimSpeed113c(m: D2KernMemory113c, pUnit: number): number {
  const unit = pUnit >>> 0
  if (unit === 0) return 0x64
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((unit + 0x04) >>> 0) | 0) >>> 0
  if (pMonStats2 === 0) return 0x64
  const bFlags = m.u8((pMonStats2 + 0x104) >>> 0)
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const mask4 = pBitMasks !== 0 ? m.u32((pBitMasks + 0x10) >>> 0) >>> 0 : 0x10
  return (bFlags & mask4) !== 0 ? 0x65 : 0x64
}

/**
 * [29/45] Barricade/tower AI think (`0x6FCC80C0`): stalls while NPC-interacted, taunts nearby players (`dist < 4`), or melee-attacks within 25.
 *
 * @dll D2Game.dll
 * @va 0x6FCC80C0
 * @ordinalOrName D2Game_6FCC80C0
 */
export function MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC80C0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const param = pAiParam >>> 0

  let pInteractHolder = 0
  if (unit !== 0 && (m.u32(unit) | 0) === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pInteractHolder = m.u32((pMonData + 0x30) >>> 0) >>> 0
    }
  }
  let pInteractNode = pInteractHolder !== 0 ? m.u32(pInteractHolder) >>> 0 : 0
  while (pInteractNode !== 0) {
    if (m.u32(pInteractNode) !== 0) {
      AI_Stall113c(m, game, unit, 0x0a)
      return
    }
    pInteractNode = m.u32((pInteractNode + 0x08) >>> 0) >>> 0
  }

  const pOutClose = allocScratch(4)
  let pNear = 0
  let bWithin4 = 0
  try {
    m.setU32(pOutClose, 0)
    pNear = AI_FindNearestPlayerTarget113c(m, game, unit, pOutClose) >>> 0
    bWithin4 = m.u32(pOutClose) | 0
  } finally {
    freeScratch(4)
  }
  if (
    pNear !== 0 &&
    (m.u32(pNear) | 0) === 0 &&
    PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pNear) === 0
  ) {
    const s: D2SeedStrc = {
      lo: m.u32((unit + 0x20) >>> 0) >>> 0,
      hi: m.u32((unit + 0x24) >>> 0) >>> 0,
    }
    const r = seedRoll(s, 3) | 0
    m.setU32((unit + 0x20) >>> 0, s.lo >>> 0)
    m.setU32((unit + 0x24) >>> 0, s.hi >>> 0)
    if (r !== 0 && bWithin4 !== 0) {
      const pAiCtrl = m.u32(param) >>> 0
      const curTimer = m.u32((pAiCtrl + 0x18) >>> 0) | 0
      if (curTimer === 0) {
        m.setU32((pAiCtrl + 0x18) >>> 0, 0x3c)
        if ((m.u32(pNear) | 0) === 0) {
          SUNIT_SetUnitEventSound113c(m, unit, 0x12, pNear)
          AI_Stall113c(m, game, unit, 0x14)
          return
        }
        AI_Stall113c(m, game, unit, 0x14)
        return
      }
      if (curTimer < 0) {
        m.setU32((pAiCtrl + 0x18) >>> 0, 0)
      }
      const nextTimer = m.u32((pAiCtrl + 0x18) >>> 0) | 0
      if (nextTimer > 0) {
        m.setU32((pAiCtrl + 0x18) >>> 0, (nextTimer - 1) >>> 0)
      }
      AI_Stall113c(m, game, unit, 0x14)
      return
    }
  }

  const pScratch = allocScratch(8)
  try {
    const pbCanMelee = pScratch
    const pnOutDist = (pScratch + 4) >>> 0
    m.setU32(pnOutDist, param)
    const pTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, unit, game, pbCanMelee, pnOutDist) >>> 0
    if (pTarget !== 0 && (m.u32(pnOutDist) | 0) < 0x19) {
      SKILLS_SetUsedSkillMemPort113c(m, unit, 0)
      void resolveMonModeChangeAnimSpeed113c(m, unit)
      MONSTER_StartMode113c(m, game, unit, 4, pTarget, 0, 0)
      return
    }
    AI_Stall113c(m, game, unit, 0x32)
  } finally {
    freeScratch(8)
  }
}

/**
 * [30/45] Stationary turret/hut AI think (`0x6FCC8270`): starts mode `4` on target within `< 25` subtiles or stalls `50` frames.
 *
 * @dll D2Game.dll
 * @va 0x6FCC8270
 * @ordinalOrName D2Game_6FCC8270
 */
export function MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC8270)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const param = pAiParam >>> 0
  const pScratch = allocScratch(8)
  try {
    const pbCanMelee = pScratch
    const pnOutDist = (pScratch + 4) >>> 0
    m.setU32(pnOutDist, m.u32((param + 0x14) >>> 0))
    const pTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, unit, game, pbCanMelee, pnOutDist) >>> 0
    if (pTarget !== 0 && (m.u32(pnOutDist) | 0) < 0x19) {
      SKILLS_SetUsedSkillMemPort113c(m, unit, 0)
      void resolveMonModeChangeAnimSpeed113c(m, unit)
      MONSTER_StartMode113c(m, game, unit, 4, pTarget, 0, 0)
      return
    }
    AI_Stall113c(m, game, unit, 0x32)
  } finally {
    freeScratch(8)
  }
}

/**
 * [31/45] Stationary turret/spawner AI think (`0x6FCC8350`): starts mode `4` on target within `< 25` subtiles or stalls `50` frames.
 *
 * @dll D2Game.dll
 * @va 0x6FCC8350
 * @ordinalOrName D2Game_6FCC8350
 */
export function MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC8350)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const param = pAiParam >>> 0
  const pScratch = allocScratch(8)
  try {
    const pbCanMelee = pScratch
    const pnOutDist = (pScratch + 4) >>> 0
    m.setU32(pnOutDist, m.u32((param + 0x14) >>> 0))
    const pTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, unit, game, pbCanMelee, pnOutDist) >>> 0
    if (pTarget !== 0 && (m.u32(pnOutDist) | 0) < 0x19) {
      SKILLS_SetUsedSkillMemPort113c(m, unit, 0)
      void resolveMonModeChangeAnimSpeed113c(m, unit)
      MONSTER_StartMode113c(m, game, unit, 4, pTarget, 0, 0)
      return
    }
    AI_Stall113c(m, game, unit, 0x32)
  } finally {
    freeScratch(8)
  }
}

/**
 * [32/45] Uses an antidote/thawing cure potion (`0x6FCCF370`): clears up to two `ItemsTxt` cure states (`+0x9A`, `+0x9C`) and applies timed state buff (`0x6FCCE4D0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCCF370
 * @ordinalOrName D2Game_6FCCF370
 */
export function ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pItem: number,
  pTargetUnit: number,
  nX: number,
  nY: number,
  nSpellParam: number,
): number {
  hitD2GameVa113c(0x6FCCF370)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const item = pItem >>> 0
  const nItemId = item !== 0 ? m.u32((item + 0x04) >>> 0) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pItemsTxt === 0) return 0

  let bHandled = 0
  for (let i = 0; i < 2; i++) {
    const wState = sx16(m.u16((pItemsTxt + 0x9a + i * 2) >>> 0))
    if (wState > 0) {
      const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
      const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
      const nStatesTxtCount = pDataTables !== 0 ? m.u32((pDataTables + 0xc4) >>> 0) | 0 : 0
      if (wState < nStatesTxtCount) {
        const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, unit, wState) >>> 0
        if (pStatList !== 0) {
          STATLIST_UnlinkSubList113c(m, unit, pStatList)
          STATLIST_FreeStatListIfNonExtended113c(m, pStatList)
        }
        if (STATES_CheckState113c(m, unit, wState) !== 0) {
          STATES_ToggleGfxStateFlag113c(m, unit, wState, 0)
        }
        bHandled = 1
      }
    }
  }

  if (
    ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c(
      m,
      game,
      unit,
      item,
      pTargetUnit >>> 0,
      nX | 0,
      nY | 0,
      nSpellParam | 0,
    ) !== 0
  ) {
    bHandled = 1
  }
  return bHandled
}


/**
 * [33/45] Executes Feral Rage / Maul (`0x6FC473C0`) for player casters or rolls monster melee skill hit (`0x6FCFE5A0`),
 * applies `MONSTER_ApplyElementalDamageAndResistStats113c(pGame, pUnit, 8)`, and allocates combat (`0x6FCFDDE0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCD41B0
 * @ordinalOrName D2Game_6FCD41B0
 */
export function SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD41B0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) return 0
  const pTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pTables = pTablesPtr !== 0 ? m.u32(pTablesPtr) >>> 0 : 0
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pPath = unit !== 0 ? m.u32((unit + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === unit || pTarget === 0) return 0

  if ((m.u32(unit) | 0) === 0) {
    return SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c(m, game, unit, skillId, skillLvl) | 0
  }

  const pDmg = allocScratch(0x70)
  try {
    m.fill(pDmg, 0x70, 0)
    const nToHitBonus = SKILLS_GetSkillToHitBonus113c(m, unit, skillId, skillLvl) | 0
    let wResultFlags =
      SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, unit, pTarget, game, nToHitBonus, 0) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
    if ((wResultFlags & 1) !== 0) {
      wResultFlags = (wResultFlags | m.u16((pSkillsTxt + 0x12e) >>> 0)) & 0xffff
      const dwHitFlags = (m.u32(pDmg) | m.u32((pSkillsTxt + 0x130) >>> 0)) >>> 0
      const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
      m.setU16((pDmg + 0x04) >>> 0, wResultFlags)
      m.setU32(pDmg, dwHitFlags)
      if (dwHitClass !== 0) {
        m.setU32((pDmg + 0x60) >>> 0, dwHitClass)
      }
      MONSTER_ApplyElementalDamageAndResistStats113c(m, game, unit, 8)
    }
    SUNITDMG_AllocCombat113c(m, game, unit, pTarget, pDmg, 0x80)
    return 1
  } finally {
    freeScratch(0x70)
  }
}

/**
 * [34/45] Executes monster Smite/Telekinesis/charge-up melee skill (`0x6FCD6790`): removes existing combat node,
 * sets `dwFlags |= 0x40`, triggers `SKILLS_ExecuteSkillStart113c` if more anim events remain (`0x6FCD2E00`),
 * applies `0x6FCD4520` hit, and applies progressive charge state (`0x6FC48E70`) when `SKILLS_GetParam1 != 0`.
 *
 * @dll D2Game.dll
 * @va 0x6FCD6790
 * @ordinalOrName D2Game_6FCD6790
 */
export function SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD6790)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, unit) >>> 0
  if (pSkill === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pPath = unit !== 0 ? m.u32((unit + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === unit || pTarget === 0) return 0

  SUNITDMG_RemoveCombatNode113c(m, unit, pTarget)
  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  if ((MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c(m, unit) | 0) !== 0) {
    SKILLS_ExecuteSkillStart113c(m, skillId, game, unit, skillLvl, 0)
  }
  SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c(m, skillId, unit, pTarget, game, skillLvl)
  if ((SKILLS_GetParam1113c(m, pSkill) | 0) !== 0) {
    SKILLS_ApplyProgressiveChargeState_6FC48E70_113c(m, game, unit, skillId, skillLvl)
  }
  return 1
}

/**
 * [35/45] Act 4 Quest 3 party completion callback (`0x6FCDA490`): when `pPlayerUnit` has quest `0x1A` state `0x0D`
 * set, broadcasts `ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c` across all members of `pPlayerUnit`'s sub-party.
 *
 * @dll D2Game.dll
 * @va 0x6FCDA490
 * @ordinalOrName D2Game_6FCDA490
 */
export function ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _nArg = 0,
): number {
  hitD2GameVa113c(0x6FCDA490)
  void _nArg
  const game = pGame >>> 0
  const player = pPlayerUnit >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = pPlayerData !== 0 ? m.u32((pPlayerData + diff * 4 + 0x10) >>> 0) >>> 0 : 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0x0d) !== 0 && player !== 0) {
    const pUnitGame = m.u32((player + 0x80) >>> 0) >>> 0
    if (pUnitGame !== 0 && (m.u32(player) | 0) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, player, pUnitGame) & 0xffff
      if (wPartyId !== 0xffff) {
        PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
          m,
          game,
          wPartyId,
          (mArg, gArg, pMember, pArg) => {
            ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c(mArg, gArg, pMember, pArg)
          },
          0,
        )
      }
    }
  }
  return 0
}


/**
 * [36/45] Checks whether any hireling slot in `pNpcSlot->pMercRoster` (`+0x10`) remains unpurchased;
 * if all slots are exhausted (or count <= 0), frees the roster and reinitializes via `0x6FCDCED0`.
 *
 * @dll D2Game.dll
 * @va 0x6FCDD160
 * @ordinalOrName D2Game_6FCDD160
 */
export function NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c(
  m: D2KernMemory113c,
  pGame: number,
  pNpcSlot: number,
  nSellerClassId: number,
): void {
  hitD2GameVa113c(0x6FCDD160)
  const game = pGame >>> 0
  const slot = pNpcSlot >>> 0
  const sellerId = nSellerClassId | 0
  const bExpansion = m.u32((game + 0x70) >>> 0) | 0
  const pRoster = m.u32((slot + 0x10) >>> 0) >>> 0
  const pHirelingTxt =
    DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c(m, bExpansion, sellerId, 0, 0) >>> 0
  if (pHirelingTxt === 0) {
    throw new D2CommonAssertError('SUnitNpc.cpp', 0x62d)
  }
  const wFirstNameId = m.u16((pHirelingTxt + 0x114) >>> 0)
  const wLastNameId = m.u16((pHirelingTxt + 0x116) >>> 0)
  const nCount = (wLastNameId - wFirstNameId + 1) | 0
  if (nCount === -1) {
    throw new D2CommonAssertError('SUnitNpc.cpp', 0x5b)
  }

  let nAvailable = 0
  if (nCount > 0) {
    let pEntry = (pRoster + 0x08) >>> 0
    for (let i = 0; i < nCount; i += 1) {
      if (m.u32((pEntry + 0x04) >>> 0) !== 0 && m.u32(pEntry) === 0) {
        nAvailable += 1
      }
      pEntry = (pEntry + 0x10) >>> 0
    }
    if (nAvailable !== 0) {
      return
    }
  }

  void m.u32((slot + 0x10) >>> 0)
  void m.u32((game + 0x1c) >>> 0)
  m.setU32((slot + 0x10) >>> 0, 0)
  m.setU8((slot + 0x21) >>> 0, 0)
  NPC_InitHirelingVendorRoster_6FCDCED0_113c(m, slot, game, sellerId)
}

/**
 * [37/45] Sends hireling vendor header packet (`0x4F`) and available hireling roster entries (`0x4E`)
 * for Kashya (`150`), Greiz (`198`), Asheara (`252`), or Qual-Kehk (`515`) to `pClient`.
 *
 * @dll D2Game.dll
 * @va 0x6FCDD330
 * @ordinalOrName D2Game_6FCDD330
 */
export function NPC_SendHirelingListPacketsToClient_6FCDD330_113c(
  m: D2KernMemory113c,
  pNpcUnit: number,
  pGame: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FCDD330)
  const npc = pNpcUnit >>> 0
  const game = pGame >>> 0
  const client = pClient >>> 0
  if (npc === 0) return
  const nClassId = m.u32((npc + 0x04) >>> 0) | 0
  if (nClassId !== 0x96 && nClassId !== 0xc6 && nClassId !== 0x203 && nClassId !== 0xfc) {
    return
  }

  const pScratch = allocScratch(0x18)
  const pPkt4F = pScratch
  const pOutIdx = (pScratch + 4) >>> 0
  const pPkt4E = (pScratch + 8) >>> 0
  try {
    m.setU8(pPkt4F, 0x4f)
    NET_QueuePacketToClientBuffer113c(m, client, 1, pPkt4F, 1)
    if (client === 0) {
      throw new D2CommonAssertError('SUnitNpc.cpp', 0x996)
    }
    const pClientGame = m.u32((client + 0x1a8) >>> 0) >>> 0
    const pNpcSlot =
      D2GAME_ARENA_FindPlayerSlotByUnit113c(m, pOutIdx, pClientGame, m.u32((npc + 0x04) >>> 0) >>> 0) >>> 0
    if (pNpcSlot === 0) return

    const nSellerId = m.u32((npc + 0x04) >>> 0) | 0
    if (m.u8((pNpcSlot + 0x21) >>> 0) === 0) {
      NPC_InitHirelingVendorRoster_6FCDCED0_113c(
        m,
        pNpcSlot,
        m.u32((client + 0x1a8) >>> 0) >>> 0,
        nSellerId,
      )
    }

    const bExpansion = m.u32((game + 0x70) >>> 0) | 0
    const pRoster = m.u32((pNpcSlot + 0x10) >>> 0) >>> 0
    const pHirelingTxt =
      DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c(m, bExpansion, nSellerId, 0, 0) >>> 0
    if (pHirelingTxt === 0) {
      throw new D2CommonAssertError('SUnitNpc.cpp', 0x1f6)
    }
    const wFirstNameId = m.u16((pHirelingTxt + 0x114) >>> 0)
    const wLastNameId = m.u16((pHirelingTxt + 0x116) >>> 0)
    const nCount = (wLastNameId - wFirstNameId + 1) | 0
    if (nCount === -1) {
      throw new D2CommonAssertError('SUnitNpc.cpp', 0x5b)
    }
    if (nCount <= 0) return

    let pEntry = (pRoster + 0x08) >>> 0
    for (let i = 0; i < nCount; i += 1) {
      if (m.u32((pEntry + 0x04) >>> 0) !== 0 && m.u32(pEntry) === 0) {
        const wNameId = m.u16((pEntry - 0x08) >>> 0)
        const dwMercSeed = m.u32((pEntry - 0x04) >>> 0) >>> 0
        m.setU8(pPkt4E, 0x4e)
        m.setU16((pPkt4E + 1) >>> 0, wNameId)
        m.setU32((pPkt4E + 3) >>> 0, dwMercSeed)
        NET_QueuePacketToClientBuffer113c(m, client, 1, pPkt4E, 7)
      }
      pEntry = (pEntry + 0x10) >>> 0
    }
  } finally {
    freeScratch(0x18)
  }
}

/**
 * [38/45] Heals `pPlayer`'s life, mana, and stamina to max, cures poison (`2`), freeze (`1`),
 * and exp-state curses (`0x6FCDC920`), heals all player pets (`0x6FCDCBE0`), and plays sound `0x0A`
 * on `pNpcUnit` when any restoration occurred.
 *
 * @dll D2Game.dll
 * @va 0x6FCDD490
 * @ordinalOrName D2Game_6FCDD490
 */
export function NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
  pNpcUnit: number,
): void {
  hitD2GameVa113c(0x6FCDD490)
  const player = pPlayer >>> 0
  const game = pGame >>> 0
  const npc = pNpcUnit >>> 0
  const pInteractUnit =
    m.u8((player + 0x6c) >>> 0) !== 0
      ? SUNIT_GetServerUnit113c(
          m,
          game,
          m.u32((player + 0x68) >>> 0) | 0,
          m.u32((player + 0x64) >>> 0) >>> 0,
        ) >>> 0
      : 0
  if (pInteractUnit !== npc) return

  const pbChanged = allocScratch(4)
  try {
    m.setU32(pbChanged, 0)
    const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, player) >>> 0
    const curLife = STATLIST_GetUnitStat113c(m, player, 6, 0) >>> 0
    if (curLife < maxLife) {
      STATLIST_SetUnitStat113c(m, player, 6, maxLife | 0, 0)
      D2GAME_PLRMODES_SendStatToClientOrParty113c(m, player, 6, player, maxLife | 0)
      m.setU32(pbChanged, 1)
    }

    const maxMana = STATLIST_GetMaxManaFromUnit113c(m, player) >>> 0
    const curMana = STATLIST_GetUnitStat113c(m, player, 8, 0) >>> 0
    if (curMana < maxMana) {
      STATLIST_SetUnitStat113c(m, player, 8, maxMana | 0, 0)
      D2GAME_PLRMODES_SendStatToClientOrParty113c(m, player, 8, player, maxMana | 0)
      m.setU32(pbChanged, 1)
    }

    const maxStam = STATLIST_GetMaxStaminaFromUnit113c(m, player) >>> 0
    const curStam = STATLIST_GetUnitStat113c(m, player, 0x0a, 0) >>> 0
    if (curStam < maxStam) {
      STATLIST_SetUnitStat113c(m, player, 0x0a, maxStam | 0, 0)
      D2GAME_PLRMODES_SendStatToClientOrParty113c(m, player, 0x0a, player, maxStam | 0)
      m.setU32(pbChanged, 1)
    }

    const pPoisonList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, player, 2) >>> 0
    if (pPoisonList !== 0) {
      STATLIST_UnlinkSubList113c(m, player, pPoisonList)
      STATLIST_FreeStatListIfNonExtended113c(m, pPoisonList)
      m.setU32(pbChanged, 1)
    }

    const pFreezeList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, player, 1) >>> 0
    if (pFreezeList !== 0) {
      STATLIST_UnlinkSubList113c(m, player, pFreezeList)
      STATLIST_FreeStatListIfNonExtended113c(m, pFreezeList)
      m.setU32(pbChanged, 1)
    }

    if (STATES_PurgeExpStateStatLists_6FCDC920_113c(m, player) !== 0) {
      m.setU32(pbChanged, 1)
    }

    PETS_ForEachPlayerPetUnit_6FCB6AF0_113c(
      m,
      game,
      player,
      (mArg, _g, _owner, pPet, pArg) => {
        NPC_HealAndCureUnit_6FCDCBE0_113c(mArg, pPet, pArg)
      },
      pbChanged,
    )

    if (m.u32(pbChanged) === 1) {
      SUNIT_SetUnitEventSound113c(m, npc, 0x0a, 0)
    }
  } finally {
    freeScratch(4)
  }
}

/**
 * [39/45] Act 2 Quest 2 Horadric item drop/destroy callback (`0x6FCE23C0`): decrements `vip `, `msf `,
 * `hst `, or `box ` count on `pQuestData->pQuestDataEx` and triggers `0x6FCE1990` when no Staff remains.
 *
 * @dll D2Game.dll
 * @va 0x6FCE23C0
 * @ordinalOrName D2Game_6FCE23C0
 */
export function ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE23C0)
  const qData = pQuestData >>> 0
  const qArg = pQuestArg >>> 0
  const pItem = m.u32((qArg + 0x08) >>> 0) >>> 0
  const pState = m.u32((qData + 0x18) >>> 0) >>> 0
  const dwCode = ITEMS_GetBaseCode113c(m, pItem) >>> 0
  if (dwCode === 0x20747368) {
    m.setU32((pState + 0x1c) >>> 0, ((m.u32((pState + 0x1c) >>> 0) | 0) - 1) >>> 0)
  } else if (dwCode < 0x20747368) {
    if (dwCode === 0x2066736d) {
      m.setU32((pState + 0x18) >>> 0, ((m.u32((pState + 0x18) >>> 0) | 0) - 1) >>> 0)
    } else if (dwCode === 0x20706976) {
      m.setU32((pState + 0x24) >>> 0, ((m.u32((pState + 0x24) >>> 0) | 0) - 1) >>> 0)
    }
  } else if (dwCode === 0x20786f62) {
    m.setU32((pState + 0x20) >>> 0, ((m.u32((pState + 0x20) >>> 0) | 0) - 1) >>> 0)
  }

  if (m.u8((pState + 0x2b) >>> 0) !== 0) return
  if (m.u32((pState + 0x1c) >>> 0) !== 0) return

  let bShouldUpdate = false
  if (m.u8((pState + 0x29) >>> 0) !== 0 && m.u32((pState + 0x20) >>> 0) === 0) {
    bShouldUpdate = true
  } else if (
    m.u32((pState + 0x24) >>> 0) === 0 &&
    (ACT2Q3_GetAltarState_6FCE2120_113c(m, qData) & 0xff) !== 0
  ) {
    bShouldUpdate = true
  } else if (m.u8((pState + 0x28) >>> 0) !== 0 && m.u32((pState + 0x18) >>> 0) === 0) {
    bShouldUpdate = true
  }

  if (bShouldUpdate) {
    ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c(m, qData, 0)
    m.setU8((pState + 0x2b) >>> 0, 1)
  }
}

/**
 * [40/45] Initializes Act 2 Quest 8 (`0x6FCE4880`, Jerhyn / Kaelan / Harem intro) quest callbacks,
 * status/active filters, and 2-byte `pQuestDataEx` state.
 *
 * @dll D2Game.dll
 * @va 0x6FCE4880
 * @ordinalOrName D2Game_6FCE4880
 */
export function ACT2Q8_InitQuestData_6FCE4880_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FCE4880)
  void ACT2Q5_StatusFilter_6FCE1960_113c
  void ACT2Q8_ActiveFilter_6FCE25F0_113c
  void ACT2Q8_Callback00_NpcActivate_6FCE2680_113c
  void ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c
  const qData = pQuestData >>> 0
  m.fill((qData + 0xa0) >>> 0, 0x3c, 0)
  m.setU8((qData + 0x0c) >>> 0, 0)
  m.setU8((qData + 0x0b) >>> 0, 0)
  const pGame = m.u32((qData + 0x04) >>> 0) >>> 0
  m.setU32((qData + 0xa0) >>> 0, 0x6fce2680)
  m.setU32((qData + 0xcc) >>> 0, 0x6fce2720)
  m.setU32((qData + 0xdc) >>> 0, 0x6fd25e08)
  m.setU8((qData + 0x0a) >>> 0, 1)
  void m.u32((pGame + 0x1c) >>> 0)
  const pState = m.alloc(2) >>> 0
  m.setU32((qData + 0x18) >>> 0, pState)
  m.setU8(pState, 0)
  m.setU8((pState + 0x01) >>> 0, 0)
  m.setU32((qData + 0xe0) >>> 0, 0x1f)
  m.setU32((qData + 0xe8) >>> 0, 0x6fce1960)
  m.setU32((qData + 0xec) >>> 0, 0x6fce25f0)
}


/**
 * [41/45] Act 2 Quest 2 NPC activate callback (`0x6FCE5310`, Deckard Cain `0xF4` = `244`):
 * resolves Horadric Staff sub-status (`0x6FCE4030`) or quest bit flags on `0x0A` and appends
 * dialog text nodes (`0x6FC53EB0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCE5310
 * @ordinalOrName D2Game_6FCE5310
 */
export function ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE5310)
  const qData = pQuestData >>> 0
  const qArg = pQuestArg >>> 0
  const pPlayer = m.u32((qArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(qArg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = pPlayerData !== 0 ? m.u32((pPlayerData + diff * 4 + 0x10) >>> 0) >>> 0 : 0
  const bState0D = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x0d) | 0
  const bState00 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x00) | 0
  const pNpc = m.u32((qArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || (m.u32((pNpc + 0x04) >>> 0) | 0) !== 0xf4) return

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x01) !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(
      m,
      qData,
      4,
      m.u32((qArg + 0x14) >>> 0) >>> 0,
      0xf4,
    )
    return
  }

  const pOutStatus = allocScratch(4)
  try {
    m.setU8(pOutStatus, 0)
    const bResolved =
      ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c(m, qData, pPlayer, pOutStatus) & 0xff
    let uStatus = m.u8(pOutStatus)
    if (bResolved !== 0 && uStatus !== 0xff) {
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        qData,
        uStatus,
        m.u32((qArg + 0x14) >>> 0) >>> 0,
        0xf4,
      )
      return
    }

    const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
    if (QUESTS_HasPlayerGuidInQuest113c(m, qData, dwPlayerGuid) !== 0) {
      QUESTS_AddNpcDialogTextNodes113c(
        m,
        qData,
        5,
        m.u32((qArg + 0x14) >>> 0) >>> 0,
        0xf4,
      )
      return
    }

    if (bState00 === 1 && (bState0D === 0 || bState0D === 1)) {
      return
    }

    uStatus = m.u8(pOutStatus)
    if (uStatus > 9) {
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x03) === 0) return
      uStatus = 6
      m.setU8(pOutStatus, 6)
    }

    QUESTS_AddNpcDialogTextNodes113c(
      m,
      qData,
      uStatus,
      m.u32((qArg + 0x14) >>> 0) >>> 0,
      0xf4,
    )
  } finally {
    freeScratch(4)
  }
}

/**
 * [42/45] Act 2 Quest 2 active filter (`0x6FCE5440`): returns `1` for Deckard Cain (`0xF4` = `244`)
 * when quest `0x0A` bit `1` is set or `ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c` returns non-zero.
 *
 * @dll D2Game.dll
 * @va 0x6FCE5440
 * @ordinalOrName D2Game_6FCE5440
 */
export function ACT2Q2_ActiveFilter_6FCE5440_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcId: number,
  pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit = 0,
): number {
  hitD2GameVa113c(0x6FCE5440)
  void _pNpcUnit
  if ((nNpcId | 0) !== 0xf4) return 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x0a, 0x01) | 0) === 1) {
    return 1
  }
  const pOutStatus = allocScratch(4)
  try {
    m.setU8(pOutStatus, 0)
    const res =
      ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c(
        m,
        pQuestData >>> 0,
        pPlayer >>> 0,
        pOutStatus,
      ) & 0xff
    return res !== 0 ? 1 : 0
  } finally {
    freeScratch(4)
  }
}

/**
 * [43/45] Initializes Act 2 Quest 0 (`0x6FCE5690`, Warriv / Cain Act 2 intro) quest callbacks,
 * filters, and `0x84`-byte `pQuestDataEx` state.
 *
 * @dll D2Game.dll
 * @va 0x6FCE5690
 * @ordinalOrName D2Game_6FCE5690
 */
export function ACT2Q0_InitQuestData_6FCE5690_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FCE5690)
  void ACT2Q0_ActiveFilter_6FCE2590_113c
  void ACT2Q0_StatusFilter_6FCE25C0_113c
  void ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c
  void ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c
  void ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c
  void ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c
  const qData = pQuestData >>> 0
  m.fill((qData + 0xa0) >>> 0, 0x3c, 0)
  const pGame = m.u32((qData + 0x04) >>> 0) >>> 0
  m.setU32((qData + 0xa0) >>> 0, 0x6fce4570)
  m.setU32((qData + 0xcc) >>> 0, 0x6fce4620)
  m.setU32((qData + 0xc8) >>> 0, 0x6fce4550)
  m.setU32((qData + 0xd4) >>> 0, 0x6fce44e0)
  m.setU32((qData + 0xdc) >>> 0, 0x6fd23038)
  m.setU8((qData + 0x0a) >>> 0, 1)
  m.setU8((qData + 0x0c) >>> 0, 0)
  m.setU8((qData + 0x0b) >>> 0, 0)
  m.setU32((qData + 0x18) >>> 0, 0)
  m.setU32((qData + 0xe0) >>> 0, 0x08)
  m.setU32((qData + 0xe8) >>> 0, 0x6fce25c0)
  m.setU32((qData + 0xec) >>> 0, 0x6fce2590)
  void m.u32((pGame + 0x1c) >>> 0)
  const pState = m.alloc(0x84) >>> 0
  m.setU32((qData + 0x18) >>> 0, pState)
  m.setU16((pState + 0x80) >>> 0, 0)
}

/**
 * [44/45] Initializes Act 2 town NPC intro quest (`0x6FCE5730`, `nSeqFilterId = 0x2A`) callbacks
 * (`0x6FCE4690`, `0x6FCE4780`) and status/active filters (`0x6FCE25E0`, `0x6FCE25D0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCE5730
 * @ordinalOrName D2Game_6FCE5730
 */
export function ACT2Intro_InitQuestData_6FCE5730_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FCE5730)
  void ACT2Q8_ActiveFilter_6FCE25D0_113c
  void ACT2Q8_StatusFilter_6FCE25E0_113c
  void ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c
  void ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c
  const qData = pQuestData >>> 0
  m.fill((qData + 0xa0) >>> 0, 0x3c, 0)
  m.setU32((qData + 0xa0) >>> 0, 0x6fce4690)
  m.setU32((qData + 0xcc) >>> 0, 0x6fce4780)
  m.setU32((qData + 0xdc) >>> 0, 0x6fd22de8)
  m.setU8((qData + 0x0a) >>> 0, 1)
  m.setU8((qData + 0x0c) >>> 0, 0)
  m.setU8((qData + 0x0b) >>> 0, 0)
  m.setU32((qData + 0x18) >>> 0, 0)
  m.setU32((qData + 0xe0) >>> 0, 0x2a)
  m.setU32((qData + 0xe8) >>> 0, 0x6fce25e0)
  m.setU32((qData + 0xec) >>> 0, 0x6fce25d0)
}

/**
 * [45/45] Initializes Act 2 Quest 7 (`0x6FCE5790`, Palace Guard / Harem entry, `nSeqFilterId = 0x1E`)
 * callbacks (`0x6FCE4900`, `0x6FCE4A40`, `0x6FCE1980`), filters (`0x6FCE1970`, `0x6FCE2750`), and 1-byte `pQuestDataEx`.
 *
 * @dll D2Game.dll
 * @va 0x6FCE5790
 * @ordinalOrName D2Game_6FCE5790
 */
export function ACT2Q7_InitQuestData_6FCE5790_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FCE5790)
  void ACT2Q4_StatusFilter_6FCE1970_113c
  void ACT2Q4_Callback00_Noop_6FCE1980_113c
  void ACT2Q7_ActiveFilter_6FCE2750_113c
  void ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c
  void ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c
  const qData = pQuestData >>> 0
  m.fill((qData + 0xa0) >>> 0, 0x3c, 0)
  m.setU32((qData + 0xa0) >>> 0, 0x6fce4900)
  m.setU8((qData + 0x0c) >>> 0, 0)
  m.setU8((qData + 0x0b) >>> 0, 0)
  const pGame = m.u32((qData + 0x04) >>> 0) >>> 0
  m.setU32((qData + 0xcc) >>> 0, 0x6fce4a40)
  m.setU32((qData + 0xc0) >>> 0, 0x6fce1980)
  m.setU32((qData + 0xdc) >>> 0, 0x6fd25970)
  m.setU8((qData + 0x0a) >>> 0, 1)
  void m.u32((pGame + 0x1c) >>> 0)
  const pState = m.alloc(1) >>> 0
  m.setU32((qData + 0x18) >>> 0, pState)
  m.setU8(pState, 0)
  m.setU32((qData + 0xe0) >>> 0, 0x1e)
  m.setU32((qData + 0xe8) >>> 0, 0x6fce1970)
  m.setU32((qData + 0xec) >>> 0, 0x6fce2750)
}
