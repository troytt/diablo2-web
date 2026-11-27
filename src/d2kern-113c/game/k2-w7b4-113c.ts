/**
 * D2Game.dll 1.13c — Milestone 33 [K2] Wave 7 Batch 4 (w7b4).
 *
 * Clean-room 1:1 binary-isomorphic port of 39 D2Game.dll v1.13c functions.
 */

import { UNITS_GetPlayerData113c } from '../common/composit'
import { DUNGEON_AddRoomPortalNode113c } from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import {
  INVENTORY_AppendItemGuidNode113c,
  INVENTORY_AutoPlaceItemInGrid113c,
  INVENTORY_CanAutoEquipItem113c,
  INVENTORY_CanBodyLocFitInGrid113c,
  INVENTORY_FindReagentForTome113c,
  INVENTORY_GetCompositWeaponMem113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_GetSwapWeaponItem113c,
  INVENTORY_NoOpRet20113c,
  INVENTORY_NoOpRet8B113c,
  INVENTORY_PlaceItemInBodyLoc113c,
  INVENTORY_PlaceItemInSocket113c,
  INVENTORY_RemoveItemFromInventory113c,
  INVENTORY_SetCursorItem113c,
  INVENTORY_UnitIsItem113c,
  INVENTORY_UpdateWeaponGuidOnInsert113c,
  INVENTORY_UpdateWeaponGuidOnRemoval113c,
  UNITS_GetInventoryRecordId113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_AreStackableWeaponsCompatible113c,
  ITEMS_CanUseCharmInInventory113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckRequirements113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_NoOpReturnZero113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetNodePage113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
} from '../common/path'
import {
  PLAYER_StoreLeftSkill113c,
  PLAYER_StoreRightSkill113c,
  PLAYER_StoreSwitchLeftSkill113c,
  PLAYER_StoreSwitchRightSkill113c,
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
  UNITS_GetLeftSkill113c,
  UNITS_GetRightSkill113c,
} from '../common/quest-record'
import {
  SKILLS_GetCharges113c,
  SKILLS_GetItemSkillInfo113c,
  SKILLS_GetOwnerItemGuid113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillUseFailReason113c,
  SKILLS_SetCharges113c,
  SKILLS_SetLeftSkill113c,
} from '../common/skills'
import {
  ITEMMODS_UpdateSetItemEquipmentState113c,
  STATLIST_AddUnitStat113c,
  STATLIST_GetMaxDurabilityFromUnit113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
  UNITS_PopPlayerSubtargetLeft113c,
  UNITS_PopPlayerSubtargetRight113c,
  UNITS_SetInteractItem113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
  UNITS_SetUnitUpdateFlags113c,
} from '../common/unit'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory'
import { SEED_InitLowSeed113c, SEED_InitSeed113c } from '../prng'
import {
  ITEMS_CheckIfUseable113c,
  MONSTERS_CheckMonStatsFlagBit6_113c,
  UNITS_IsPointWithinRadius113c,
} from '../tables/datatbls-113c'
import { QUESTS_GuidListRemove113c } from './a1c-post150-f150-f276-113c'
import { SUNIT_SetUnitEventSound113c } from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
} from './boot-init-gap-b-113c'
import {
  SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c,
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_GetPlayerClientClassId113c,
} from './combat-a1c-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c,
  ITEMS_HasSocketedSubItems113c,
  PLRTRADE_IsInteractingWithValidPlayer113c,
  PLRTRADE_SendTradeAcceptButtonAndSetState3_113c,
} from './k2-combat-core-w1-113c'
import {
  ITEMS_ActivateEquippedItemStats113c,
  ITEMS_DeactivateEquippedItemStats113c,
  ITEMS_OnUnequipScrollOrTome113c,
} from './k2-gap-itemdef-113c'
import {
  NET_SendPacket0x3E_ItemStatBitStream113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
} from './k2-gap-melee-dot-113c'
import {
  PLAYER_IsBusyWithCursorOrNpcInteract113c,
  QUESTS_GuidListAdd113c,
  QUESTS_SendQuestItemState2_5D_113c,
} from './k2-items-tc-w1-113c'
import { PLAYER_GetQuestRecordForDifficulty_6FC21020_113c } from './k2-laneH-0x6fc2-w1-113c'
import {
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_TriggerItemDropped_6FC545A0_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { ACT3Q5_SyncCouncilQuestFlagsCallback113c } from './k2-sunit-spawn-w1-113c'
import { QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c } from './k2-w2b1-113c'
import { PLRTRADE_WalkTradeItemList_6FC8FFA0_113c } from './k2-w2b3-113c'
import { S2C_QueueByteDwordPacket6_6FCAC3B0_113c } from './k2-w2b4-113c'
import { ACT2Q1_UnitIterateSetCompletionState_6FCE5560_113c } from './k2-w2b7-113c'
import {
  ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c,
  ITEMS_PlaceItemInSocketInventory_6FCF1650_113c,
} from './k2-w2b8-113c'
import { UNITMSG_QueuePacket23SetSkill_6FC9A020_113c } from './k2-w3b8-113c'
import { ACT5Q3_ApplyScrollOfResistanceAcrossDifficulties_6FC7B0B0_113c } from './k2-w4b2-113c'
import { ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c } from './k2-w4b3-113c'
import {
  NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c,
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
} from './k2-w4b5-113c'
import { PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c } from './k2-w5b1-113c'
import { ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c } from './k2-w5b3-113c'
import { ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c } from './k2-w5b4-113c'
import { ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c } from './k2-w5b5-113c'
import {
  C2S_ValidateBeltItemOwnership_6FCECDB0_113c,
  C2S_ValidateCursorItem_6FCECF70_113c,
  C2S_ValidateNpcMonsterInteract_6FCECCF0_113c,
  C2S_ValidateStoredItem_6FCECF00_113c,
  C2S_ValidateStoredOrEquippedItem_6FCECE90_113c,
} from './k2-w5b6-113c'
import {
  ITEMS_CompactBeltColumnDown_6FCF2540_113c,
  ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c,
  ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c,
  ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c,
  ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
} from './k2-w5b7-113c'
import {
  ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
  ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c,
  ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c,
} from './k2-w5b8-113c'
import {
  NET_SendPacket5A_PartyRelationEvent_6FD10720_113c,
  PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c,
  PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c,
  PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c,
  PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c,
  PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c,
  PLAYERSAVE_WriteSkillSection_6FD0BC40_113c,
  PLAYERSAVE_WriteStatsSection_6FD0BE70_113c,
  PLAYERSAVE_WriteWaypointSection_6FD0B700_113c,
} from './k2-w5b9-113c'
import { NPCS_ClosePlayerTradeAndFreeGamble_6FC685C0_113c } from './k2-w6b1-113c'
import {
  ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c,
  ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c,
  ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c,
  NET_BroadcastSystemChatMessage_6FCEBE70_113c,
} from './k2-w6b3-113c'
import {
  ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c,
  ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c,
  C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c,
  MONREG_InitAllActMonsterRegions_6FCEAB30_113c,
  NPCS_CainIdentifyAllItems_6FCDDB10_113c,
  NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c,
  SKILLS_RespecPlayerClassSkills_6FCC1280_113c,
} from './k2-w6b5-113c'
import {
  ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c,
  ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c,
  HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0_113c,
  ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c,
  ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c,
  ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c,
  ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c,
  ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c,
  ITEMS_InsertScrollIntoTome_6FCF34B0_113c,
  ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c,
  ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c,
  ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c,
  MONSTER_SpawnPresetPackTable_6FD0F940_113c,
  PLAYERSAVE_WriteCorpseSection_6FD0C260_113c,
  PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c,
  PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c,
  PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c,
} from './k2-w6b6-113c'
import {
  OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c,
  PARTY_EnableHostilityFlag08_6FD141C0_113c,
  PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c,
} from './k2-w6b7-113c'
import { UNITS_ChangeAnimMode113c } from './monster-events'
import { UNIT_GetPosX113c, UNIT_GetPosY113c } from './regpop-spawn-113c'
import { EVENT_SetEventFull113c } from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

let k2W7B4StackPtr = 0x7ff90000

function writeCString113c(m: D2KernMemory113c, ptr: number, text: string): void {
  const base = ptr >>> 0
  for (let i = 0; i < text.length; i++) {
    m.setU8((base + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((base + text.length) >>> 0, 0)
}

/**
 * [1/39] Act 2 Quest 1 (`0x09`) Radament death callback (`0x6FCE7540`): marks global quest state `0x0D`,
 * grants room/act quest states, schedules timer `0x6FCE6010`, and drops Book of Skill (`'ass '`) for qualifying players.
 *
 * @dll D2Game.dll
 * @va 0x6FCE7540
 * @ordinalOrName D2Game_6FCE7540
 */
export function ACT2Q1_OnRadamentKilled_6FCE7540_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE7540)
  const edi = pQuest >>> 0
  const esi = pQuestArg >>> 0
  if (m.u8((edi + 0x09) >>> 0) === 0) {
    return
  }

  const prevSp = k2W7B4StackPtr
  const sp = (prevSp - 0x90) >>> 0
  k2W7B4StackPtr = sp
  try {
    if (m.u32(0x6fd31c20) !== 0) {
      if (m.u8(0x6fd1b338) === 0) {
        writeCString113c(m, 0x6fd1b338, 'killed radament for quest')
      }
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        0x6fd1b338,
        m.u32((edi + 0x04) >>> 0) >>> 0,
        4,
      )
    }

    m.setU8((edi + 0x0c) >>> 0, 4)
    writeCString113c(m, (sp + 0x08) >>> 0, 'changing state to 4\n')

    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        (sp + 0x08) >>> 0,
        m.u32((edi + 0x04) >>> 0) >>> 0,
        4,
      )
    }

    const pGame0 = m.u32(esi) >>> 0
    const pQuests = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
    const nQuestId = m.u32((edi + 0xe0) >>> 0) | 0
    if ((m.u32((pQuests + 0x08) >>> 0) | 0) === 0) {
      throw new D2CommonAssertError('Act2Q1.cpp', 0x820)
    }
    QUESTRECORD_SetQuestState113c(m, m.u32((pQuests + 0x0c) >>> 0) >>> 0, nQuestId, 0x0d)

    const ebp = m.u32((edi + 0x18) >>> 0) >>> 0
    m.setU32((edi + 0xa8) >>> 0, 0)
    m.setU8(ebp, 1)
    const pRoom = UNITS_GetRoom113c(m, m.u32((esi + 0x08) >>> 0) >>> 0) >>> 0
    m.setU32((ebp + 0x04) >>> 0, pRoom)

    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(esi) >>> 0,
      ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c,
      0,
      m.u32((esi + 0x08) >>> 0) >>> 0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(esi) >>> 0,
      (mem, g, u, a) => ACT2Q1_UnitIterateSetCompletionState_6FCE5560_113c(mem, g, u, a),
      0,
      m.u32((esi + 0x08) >>> 0) >>> 0,
    )
    m.setU32((ebp + 0x0c) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(esi) >>> 0,
      ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c,
      0,
      m.u32((esi + 0x08) >>> 0) >>> 0,
    )

    if (m.u8((ebp + 0x0a) >>> 0) === 0) {
      m.setU8((ebp + 0x0a) >>> 0, 1)
      QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 0x0c, edi, 0x6fce6010)
    }

    if ((m.u32((ebp + 0x0c) >>> 0) | 0) !== 0) {
      const pTargetUnit = m.u32((esi + 0x08) >>> 0) >>> 0
      m.setU32((pTargetUnit + 0xb8) >>> 0, 0x20737361)
      let i = 0
      if ((m.u32((ebp + 0x0c) >>> 0) | 0) > 0) {
        do {
          const pUnitDrop = m.u32((esi + 0x08) >>> 0) >>> 0
          const pGameDrop = m.u32((edi + 0x04) >>> 0) >>> 0
          ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
            m,
            pGameDrop,
            pUnitDrop,
            2,
            (sp + 0x10) >>> 0,
            0,
            -1,
            0,
          )
          i = (i + 1) | 0
        } while (i < (m.u32((ebp + 0x0c) >>> 0) | 0))
      }
    }
  } finally {
    k2W7B4StackPtr = prevSp
  }
}

/**
 * [2/39] Act 2 Quest 6 (`0x0E`) Duriel death callback (`0x6FCE97D0`): updates quest state `3` and killer/party
 * flags, syncs quest logs across living players, and triggers Tyrael chamber door object animation/event.
 *
 * @dll D2Game.dll
 * @va 0x6FCE97D0
 * @ordinalOrName D2Game_6FCE97D0
 */
export function ACT2Q6_OnDurielKilled_6FCE97D0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE97D0)
  const ebp = pQuest >>> 0
  const edi = pQuestArg >>> 0
  const prevSp = k2W7B4StackPtr
  const sp = (prevSp - 0x80) >>> 0
  k2W7B4StackPtr = sp
  try {
    if (m.u32(0x6fd31c20) !== 0) {
      if (m.u8(0x6fd1b240) === 0) {
        writeCString113c(m, 0x6fd1b240, 'killed duriel for quest')
      }
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        0x6fd1b240,
        m.u32((ebp + 0x04) >>> 0) >>> 0,
        4,
      )
    }

    if (m.u8((ebp + 0x09) >>> 0) !== 0) {
      m.setU8((ebp + 0x0c) >>> 0, 3)
      writeCString113c(m, (sp + 0x08) >>> 0, 'changing state to 3\n')
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          (sp + 0x08) >>> 0,
          m.u32((ebp + 0x04) >>> 0) >>> 0,
          4,
        )
      }
      QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 8, ebp, 0x6fce58b0)

      const pKiller = m.u32((edi + 0x0c) >>> 0) >>> 0
      if (pKiller !== 0) {
        const pGame0 = m.u32(edi) >>> 0
        const pPlayerData = UNITS_GetPlayerData113c(m, pKiller) >>> 0
        const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
        const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
        if (
          (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0) | 0) === 0 &&
          (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 3) | 0) === 0 &&
          (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4) | 0) === 0 &&
          (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 5) | 0) === 0
        ) {
          QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 5)
          const wPartyId =
            SUNITDMG_GetPlayerClientClassId113c(m, m.u32((edi + 0x0c) >>> 0) >>> 0) & 0xffff
          if (wPartyId !== 0xffff) {
            PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
              m,
              m.u32(edi) >>> 0,
              wPartyId,
              ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c,
              0,
            )
          }
        }
      }
    }

    const esi = m.u32((ebp + 0x18) >>> 0) >>> 0
    m.setU32((ebp + 0xa8) >>> 0, 0)
    m.setU32((ebp + 0xc0) >>> 0, 0)
    m.setU8((esi + 0x01) >>> 0, 1)
    const pRoom = UNITS_GetRoom113c(m, m.u32((edi + 0x08) >>> 0) >>> 0) >>> 0
    m.setU32((esi + 0x60) >>> 0, pRoom)

    const pGame1 = m.u32((ebp + 0x04) >>> 0) >>> 0
    const pQuests1 = m.u32((pGame1 + 0x10f4) >>> 0) >>> 0
    m.setU8((pQuests1 + 0x20) >>> 0, 8)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGame1,
      (mem, g, u, a) => QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(mem, g, u, a),
      0,
      0,
    )
    const pGame2 = m.u32((ebp + 0x04) >>> 0) >>> 0
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGame2,
      ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c,
      0,
      0,
    )

    if (m.u8((esi + 0x05) >>> 0) !== 0) {
      const pGameObj = m.u32((ebp + 0x04) >>> 0) >>> 0
      const dwObjGuid = m.u32((esi + 0x2c) >>> 0) >>> 0
      if (pGameObj === 0) {
        throw new D2CommonAssertError('Act2Q6.cpp', 0x2d3)
      }
      let pObj = m.u32((pGameObj + 0x1520 + (dwObjGuid & 0x7f) * 4) >>> 0) >>> 0
      while (pObj !== 0) {
        if (m.u32((pObj + 0x0c) >>> 0) >>> 0 === dwObjGuid) {
          UNITS_ChangeAnimMode113c(m, pObj, 1)
          const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pObj + 0x04) >>> 0) | 0) >>> 0
          const nFrameDelta = (m.u32((pObjTxt + 0xdc) >>> 0) >>> 8) >>> 0
          const pGameCur = m.u32((ebp + 0x04) >>> 0) >>> 0
          const nTargetFrame = ((m.u32((pGameCur + 0xa8) >>> 0) | 0) + (nFrameDelta | 0)) >>> 0
          EVENT_SetEventFull113c(m, pGameCur, pObj, 1, nTargetFrame, 0, 0, 0)
          break
        }
        pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
      }
    }

    m.setU32((esi + 0x18) >>> 0, 2)
  } finally {
    k2W7B4StackPtr = prevSp
  }
}

/**
 * [3/39] Advances game seed (`pGame + 0xD0`), initializes local PRNG, and populates all Act monster regions (`0x6FCEACC0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCEACC0
 * @ordinalOrName D2Game_6FCEACC0
 */
export function MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCEACC0)
  const esi = pGame >>> 0
  const prevSp = k2W7B4StackPtr
  const sp = (prevSp - 0x08) >>> 0
  k2W7B4StackPtr = sp
  try {
    SEED_InitSeed113c(m, sp)
    const lo = m.u32((esi + 0xd0) >>> 0) >>> 0
    const hi = m.u32((esi + 0xd4) >>> 0) >>> 0
    const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
    const newLo = Number(prod & 0xffffffffn) >>> 0
    const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
    m.setU32((esi + 0xd4) >>> 0, newHi)
    m.setU32((esi + 0xd0) >>> 0, newLo)
    SEED_InitLowSeed113c(m, sp, newLo)
    const bExpansion = m.u32((esi + 0x70) >>> 0) >>> 0
    const nDifficulty = m.u8((esi + 0x6d) >>> 0)
    m.setU32((esi + 0xec) >>> 0, newLo)
    const pMemPool = m.u32((esi + 0x1c) >>> 0) >>> 0
    MONREG_InitAllActMonsterRegions_6FCEAB30_113c(
      m,
      newLo,
      pMemPool,
      (esi + 0xf0) >>> 0,
      sp,
      nDifficulty,
      bExpansion,
    )
  } finally {
    k2W7B4StackPtr = prevSp
  }
}

/**
 * [4/39] C2S packet `0x3A` handler (`0x6FCEC960`): validates stat ID (`0..15`) and point count (`1..100`) and spends stat points.
 *
 * @dll D2Game.dll
 * @va 0x6FCEC960
 * @ordinalOrName D2Game_6FCEC960
 */
export function C2S_Packet3A_AddStatPoint_6FCEC960_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEC960)
  const ebx = pPlayer >>> 0
  if ((nPacketLen | 0) !== 3) {
    return 3
  }
  const wVal = m.u16((pPacket + 1) >>> 0)
  const edi = wVal & 0xff
  let esi = ((wVal >>> 8) + 1) | 0
  if (edi <= -1 || edi >= 0x10 || esi < 1 || esi > 0x64) {
    return 3
  }
  if (esi !== 0) {
    do {
      esi = (esi - 1) | 0
      if ((PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c(m, ebx, edi) | 0) === 0) {
        return 2
      }
    } while (esi !== 0)
  }
  return 0
}

/**
 * [5/39] C2S packet `0x30` handler (`0x6FCED480`): validates NPC interaction and closes player trade/gamble session.
 *
 * @dll D2Game.dll
 * @va 0x6FCED480
 * @ordinalOrName D2Game_6FCED480
 */
export function C2S_Packet30_CancelNpcInteract_6FCED480_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCED480)
  const ebx = pGame >>> 0
  const esi = pPlayer >>> 0
  if ((nPacketLen | 0) !== 9) {
    return 3
  }
  const dwNpcGuid = m.u32((pPacket + 5) >>> 0) >>> 0
  const prevSp = k2W7B4StackPtr
  const sp = (prevSp - 8) >>> 0
  k2W7B4StackPtr = sp
  try {
    m.setU32(sp, 0)
    const err = C2S_ValidateNpcMonsterInteract_6FCECCF0_113c(m, ebx, dwNpcGuid, sp, esi, 0) | 0
    if (err !== 0) {
      return err >>> 0
    }
    const pNpc = m.u32(sp) >>> 0
    if (pNpc !== 0 && (m.u32(pNpc) | 0) === 1) {
      const pMonData = m.u32((pNpc + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const pNpcRecord = m.u32((pMonData + 0x30) >>> 0) >>> 0
        NPCS_ClosePlayerTradeAndFreeGamble_6FC685C0_113c(m, ebx, esi, pNpc, pNpcRecord)
        return 0
      }
    }
    NPCS_ClosePlayerTradeAndFreeGamble_6FC685C0_113c(m, ebx, esi, pNpc, 0)
    return 0
  } finally {
    k2W7B4StackPtr = prevSp
  }
}

/**
 * [6/39] C2S packet `0x29` handler (`0x6FCEDB30`): validates scroll and stored tome, then inserts scroll into tome.
 *
 * @dll D2Game.dll
 * @va 0x6FCEDB30
 * @ordinalOrName D2Game_6FCEDB30
 */
export function C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEDB30)
  const edi = pGame >>> 0
  const esi = pPlayer >>> 0
  if ((nPacketLen | 0) !== 9) {
    return 3
  }
  const ebx = m.u32((pPacket + 5) >>> 0) >>> 0
  const ebp = m.u32((pPacket + 1) >>> 0) >>> 0
  const err1 = C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c(m, edi, ebp, esi) | 0
  if (err1 !== 0) {
    return err1 >>> 0
  }
  const err2 = C2S_ValidateStoredItem_6FCECF00_113c(m, edi, ebx, esi) | 0
  if (err2 !== 0) {
    return err2 >>> 0
  }
  const prevSp = k2W7B4StackPtr
  const sp = (prevSp - 8) >>> 0
  k2W7B4StackPtr = sp
  try {
    m.setU32(sp, 0)
    const ok = ITEMS_InsertScrollIntoTome_6FCF34B0_113c(m, ebp, edi, esi, ebx, sp) | 0
    if (ok === 0 && (m.u32(sp) | 0) !== 0) {
      return 3
    }
    return 0
  } finally {
    k2W7B4StackPtr = prevSp
  }
}

/**
 * [7/39] C2S packet `0x28` handler (`0x6FCEEBD0`): validates cursor filler item and socketed target item, then sockets filler.
 *
 * @dll D2Game.dll
 * @va 0x6FCEEBD0
 * @ordinalOrName D2Game_6FCEEBD0
 */
export function C2S_Packet28_SocketItem_6FCEEBD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEEBD0)
  const edi = pGame >>> 0
  const esi = pPlayer >>> 0
  if ((nPacketLen | 0) !== 9) {
    return 3
  }
  const ebx = m.u32((pPacket + 5) >>> 0) >>> 0
  const ebp = m.u32((pPacket + 1) >>> 0) >>> 0
  const err1 = C2S_ValidateCursorItem_6FCECF70_113c(m, edi, ebp, esi) | 0
  if (err1 !== 0) {
    return err1 >>> 0
  }
  const err2 = C2S_ValidateStoredOrEquippedItem_6FCECE90_113c(m, edi, ebx, esi) | 0
  if (err2 !== 0) {
    return err2 >>> 0
  }
  const bInteracting = m.u8((esi + 0x6c) >>> 0)
  const dwInteractGuid = m.u32((esi + 0x64) >>> 0) >>> 0
  const dwInteractType = m.u32((esi + 0x68) >>> 0) >>> 0
  if (bInteracting !== 0) {
    const pInteractUnit = SUNIT_GetServerUnit113c(m, edi, dwInteractType, dwInteractGuid) >>> 0
    if (pInteractUnit !== 0 && (m.u32(pInteractUnit) | 0) === 0) {
      return 0
    }
  }
  const prevSp = k2W7B4StackPtr
  const sp = (prevSp - 8) >>> 0
  k2W7B4StackPtr = sp
  try {
    m.setU32(sp, 0)
    const ok =
      ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c(m, ebp, edi, esi, ebx, sp, 1, 1, 1, 1) | 0
    if (ok === 0 && (m.u32(sp) | 0) !== 0) {
      return 3
    }
    return 0
  } finally {
    k2W7B4StackPtr = prevSp
  }
}

/**
 * [8/39] C2S packet `0x27` handler (`0x6FCEEFE0`): validates target item GUID against player's pending identify GUID and identifies item.
 *
 * @dll D2Game.dll
 * @va 0x6FCEEFE0
 * @ordinalOrName D2Game_6FCEEFE0
 */
export function C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEEFE0)
  const ebx = pGame >>> 0
  const edi = pPlayer >>> 0
  if ((nPacketLen | 0) !== 5) {
    return 3
  }
  const esi = m.u32((pPacket + 1) >>> 0) >>> 0
  if (ebx === 0) {
    throw new D2CommonAssertError('PacketHandler.cpp', 0x2d3)
  }
  let pItem = m.u32((ebx + 0x1720 + (esi & 0x7f) * 4) >>> 0) >>> 0
  while (pItem !== 0 && (m.u32((pItem + 0x0c) >>> 0) >>> 0) !== esi) {
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) {
    return 2
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, edi) >>> 0
  if ((m.u32((pPlayerData + 0x6c) >>> 0) >>> 0) !== esi) {
    return 3
  }
  NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c(m, ebx, esi, edi)
  return 0
}

/**
 * [9/39] C2S packet `0x34` handler (`0x6FCEF070`): triggers Cain identify-all items for the player.
 *
 * @dll D2Game.dll
 * @va 0x6FCEF070
 * @ordinalOrName D2Game_6FCEF070
 */
export function C2S_Packet34_CainIdentifyItems_6FCEF070_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEF070)
  if ((nPacketLen | 0) !== 5) {
    return 3
  }
  const dwNpcGuid = m.u32((pPacket + 1) >>> 0) >>> 0
  NPCS_CainIdentifyAllItems_6FCDDB10_113c(m, dwNpcGuid, pPlayer >>> 0, pGame >>> 0)
  return 0
}

/**
 * [10/39] C2S packet `0x24` handler (`0x6FCF0F80`): validates belt item ownership and moves belt item to cursor.
 *
 * @dll D2Game.dll
 * @va 0x6FCF0F80
 * @ordinalOrName D2Game_6FCF0F80
 */
export function C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCF0F80)
  const ebx = pGame >>> 0
  const esi = pPlayer >>> 0
  if ((nPacketLen | 0) !== 5) {
    return 3
  }
  const edi = m.u32((pPacket + 1) >>> 0) >>> 0
  const err = C2S_ValidateBeltItemOwnership_6FCECDB0_113c(m, ebx, edi, esi) | 0
  if (err !== 0) {
    return err >>> 0
  }
  if ((PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(m, esi, ebx, 0) | 0) === 0) {
    return 0
  }
  const pInv = m.u32((esi + 0x60) >>> 0) >>> 0
  if ((INVENTORY_GetCursorItem113c(m, pInv) >>> 0) !== 0) {
    return 2
  }
  const prevSp = k2W7B4StackPtr
  const sp = (prevSp - 8) >>> 0
  k2W7B4StackPtr = sp
  try {
    m.setU32(sp, 0)
    const ok = ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c(m, esi, ebx, edi, sp) | 0
    if (ok === 0 && (m.u32(sp) | 0) !== 0) {
      return 3
    }
    return 0
  } finally {
    k2W7B4StackPtr = prevSp
  }
}

/**
 * [11/39] Finds a compatible tome in unit inventory and inserts `pScrollItem` (or any matching scroll if `0`) into it (`0x6FCF3C40`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF3C40
 * @ordinalOrName D2Game_6FCF3C40
 */
export function ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c(
  m: D2KernMemory113c,
  pScrollItem: number,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCF3C40)
  const esi = pScrollItem >>> 0
  const ebx = pGame >>> 0
  const edi = pUnit >>> 0
  if (ebx === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x611)
  }
  const pInv = m.u32((edi + 0x60) >>> 0) >>> 0
  const pTome = INVENTORY_FindReagentForTome113c(m, pInv, esi, 0) >>> 0
  if (pTome === 0) {
    return 0
  }
  const dwTomeGuid = m.u32((pTome + 0x0c) >>> 0) >>> 0
  const prevSp = k2W7B4StackPtr
  const sp = (prevSp - 8) >>> 0
  k2W7B4StackPtr = sp
  try {
    if (esi === 0) {
      return ITEMS_InsertScrollIntoTome_6FCF34B0_113c(m, 0xffffffff, ebx, edi, dwTomeGuid, sp) | 0
    }
    const dwScrollGuid = m.u32((esi + 0x0c) >>> 0) >>> 0
    return ITEMS_InsertScrollIntoTome_6FCF34B0_113c(m, dwScrollGuid, ebx, edi, dwTomeGuid, sp) | 0
  } finally {
    k2W7B4StackPtr = prevSp
  }
}

/**
 * [12/39] Finds a Skeleton Key (`itemType = 0x29`, page `0`) in unit inventory and decrements quantity or removes it (`0x6FCF4140`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF4140
 * @ordinalOrName D2Game_6FCF4140
 */
export function ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCF4140)
  const ebx = pUnit >>> 0
  const ebp = pGame >>> 0
  if (ebp === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x15f4)
  }
  if (ebx === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x15f5)
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, ebx)
  const pInv = m.u32((ebx + 0x60) >>> 0) >>> 0
  let edi = INVENTORY_GetFirstItem113c(m, pInv) >>> 0
  let esi = 0
  let found = false
  while (edi !== 0) {
    esi = INVENTORY_UnitIsItem113c(m, edi) >>> 0
    if (
      (ITEMS_CheckItemTypeIdMemPort113c(m, esi, 0x29) | 0) !== 0 &&
      (ITEMS_GetInvPage113c(m, esi) & 0xff) === 0
    ) {
      found = true
      break
    }
    edi = INVENTORY_GetNextItem113c(m, edi) >>> 0
  }
  if (!found) {
    return 0
  }
  const nRem = ((STATLIST_GetUnitStat113c(m, esi, 0x46, 0) | 0) - 1) | 0
  if (nRem > 0) {
    STATLIST_AddUnitStat113c(m, esi, 0x46, -1, 0)
    let pClient = 0
    if ((m.u32(ebx) | 0) === 0) {
      const pPlrData = UNITS_GetPlayerData113c(m, ebx) >>> 0
      pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
    }
    const nNewQty = STATLIST_GetUnitStat113c(m, esi, 0x46, 0) >>> 0
    NET_SendPacket0x3E_ItemStatBitStream113c(m, esi, 0, pClient, 1, 0x46, nNewQty)
    return 1
  }
  ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(m, esi, ebx, ebp)
  return 1
}

/**
 * [13/39] Validates and merges a compatible weapon stack from cursor (`dwSourceItemGuid`) into `dwTargetItemGuid` (`0x6FCF4230`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF4230
 * @ordinalOrName D2Game_6FCF4230
 */
export function ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c(
  m: D2KernMemory113c,
  dwSourceItemGuid: number,
  dwTargetItemGuid: number,
  pGame: number,
  pUnit: number,
  pOutRejectReason: number,
): number {
  hitD2GameVa113c(0x6FCF4230)
  const edi = dwSourceItemGuid >>> 0
  const ebx = dwTargetItemGuid >>> 0
  const ebp = pGame >>> 0
  const unit = pUnit >>> 0
  const pOut = pOutRejectReason >>> 0
  if (ebp === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x1193)
  }
  if (unit === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x1194)
  }
  m.setU32(pOut, 0)
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, unit)
  if (edi === ebx) {
    m.setU32(pOut, 1)
    return 0
  }
  let pSource = m.u32((ebp + 0x1720 + (edi & 0x7f) * 4) >>> 0) >>> 0
  while (pSource !== 0 && (m.u32((pSource + 0x0c) >>> 0) >>> 0) !== edi) {
    pSource = m.u32((pSource + 0xe4) >>> 0) >>> 0
  }
  if (pSource === 0) {
    m.setU32(pOut, 1)
    return 0
  }
  if ((m.u32(pSource) | 0) !== 4) {
    return 0
  }
  let pTarget = m.u32((ebp + 0x1720 + (ebx & 0x7f) * 4) >>> 0) >>> 0
  while (pTarget !== 0 && (m.u32((pTarget + 0x0c) >>> 0) >>> 0) !== ebx) {
    pTarget = m.u32((pTarget + 0xe4) >>> 0) >>> 0
  }
  if (pTarget === 0) {
    m.setU32(pOut, 1)
    return 0
  }
  if ((m.u32(pTarget) | 0) !== 4) {
    return 0
  }
  if ((ITEMS_GetInvPage113c(m, pTarget) & 0xff) === 2) {
    m.setU32(pOut, 1)
    return 0
  }
  if ((ITEMS_AreStackableWeaponsCompatible113c(m, pSource, pTarget) | 0) === 0) {
    return 0
  }
  if ((m.u32((pSource + 0x04) >>> 0) >>> 0) === (m.u32((pTarget + 0x04) >>> 0) >>> 0)) {
    ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c(m, pTarget, ebp, unit, pSource)
    ITEMS_SetItemFlag113c(m, pTarget, 0x100, 1)
    INVENTORY_AppendItemGuidNode113c(m, m.u32((unit + 0x60) >>> 0) >>> 0, pTarget)
    UNITS_SetUnitUpdateFlags113c(m, unit, 1)
  }
  return 1
}

/**
 * [14/39] Auto-equips `pItem` into a free compatible body location on `pUnit` (`0x6FCF4960`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF4960
 * @ordinalOrName D2Game_6FCF4960
 */
export function ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c(
  m: D2KernMemory113c,
  pItem: number,
  pUnit: number,
  bSkipRequirements: number,
  _uUnused = 0,
): number {
  hitD2GameVa113c(0x6FCF4960)
  const edi = pItem >>> 0
  const esi = pUnit >>> 0
  const ebx = m.u32((esi + 0x60) >>> 0) >>> 0
  const prevSp = k2W7B4StackPtr
  const sp = (prevSp - 8) >>> 0
  k2W7B4StackPtr = sp
  try {
    m.setU32(sp, 0)
    if ((ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c(m, edi, esi, sp, bSkipRequirements) | 0) === 0) {
      return 0
    }
    const ebp = m.u32(sp) | 0
    if ((INVENTORY_PlaceItemInBodyLoc113c(m, ebx, edi, ebp) | 0) === 0) {
      throw new D2CommonAssertError('Items.cpp', 0x1675)
    }
    if (ebp === 0x0b || ebp === 0x0c) {
      throw new D2CommonAssertError('Items.cpp', 0x1657)
    }
    if ((INVENTORY_PlaceItemInSocket113c(m, ebx, edi, 3) | 0) === 0) {
      INVENTORY_NoOpRet8B113c(m, ebx, ebp)
      throw new D2CommonAssertError('Items.cpp', 0x1672)
    }
    ITEMS_SetBodyLocation113c(m, edi, ebp)
    INVENTORY_UpdateWeaponGuidOnInsert113c(m, ebx, edi)
    INVENTORY_SetCursorItem113c(m, ebx, 0)
    ITEMS_ActivateEquippedItemStats113c(m, esi, edi, 0)
    if (edi !== 0) {
      m.setU32((edi + 0xc4) >>> 0, (m.u32((edi + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
    }
    UNITS_ChangeAnimMode113c(m, edi, 1)
    ITEMS_SetItemFlag113c(m, edi, 0x200, 1)
    if (edi !== 0) {
      m.setU32((edi + 0xc4) >>> 0, (m.u32((edi + 0xc4) >>> 0) & 0xfdffffff) >>> 0)
    }
    INVENTORY_AppendItemGuidNode113c(m, ebx, edi)
    UNITS_SetUnitUpdateFlags113c(m, esi, 1)
    ITEMS_SetInvPage113c(m, edi, 0xff)
    ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, esi)
    return 1
  } finally {
    k2W7B4StackPtr = prevSp
  }
}

/**
 * [15/39] Restores a broken equipped item's durability, command flags, and set/equipped stats (`0x6FCF5690`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF5690
 * @ordinalOrName D2Game_6FCF5690
 */
export function ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pItem: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCF5690)
  const esi = pUnit >>> 0
  const edi = pItem >>> 0
  const ebp = pGame >>> 0
  const ebx = esi !== 0 ? m.u32((esi + 0x60) >>> 0) >>> 0 : 0
  ITEMS_SetOrClearCommandFlags113c(m, edi, 0x200, 1)
  ITEMS_SetOrClearCommandFlags113c(m, edi, 0x100, 0)
  if (ebx !== 0) {
    ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c(m, esi, edi, ebp)
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, ebp, esi, 0)
    INVENTORY_AppendItemGuidNode113c(m, ebx, edi)
    UNITS_SetUnitUpdateFlags113c(m, esi, 1)
  }
  const nMaxDur = STATLIST_GetMaxDurabilityFromUnit113c(m, edi) | 0
  if (nMaxDur > 0) {
    STATLIST_SetUnitStat113c(m, edi, 0x48, nMaxDur, 0)
    if (esi !== 0) {
      let pClient = 0
      if ((m.u32(esi) | 0) === 0) {
        const pPlrData = UNITS_GetPlayerData113c(m, esi) >>> 0
        pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
      }
      NET_SendPacket0x3E_ItemStatBitStream113c(m, edi, 0, pClient, 1, 0x48, nMaxDur >>> 0)
    }
  }
  ITEMMODS_UpdateSetItemEquipmentState113c(m, esi, edi, 0, 0)
  if (esi !== 0) {
    ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, esi)
  }
}

/**
 * [16/39] Equips a stored inventory item (`dwItemGuid`) directly into `nBodyLoc` on `pUnit` (`0x6FCF57F0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF57F0
 * @ordinalOrName D2Game_6FCF57F0
 */
export function ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  dwItemGuid: number,
  nBodyLoc: number,
): number {
  hitD2GameVa113c(0x6FCF57F0)
  const esi = pUnit >>> 0
  const ebx = pGame >>> 0
  const ebp = dwItemGuid >>> 0
  const bBodyLoc = nBodyLoc & 0xff
  const dwBodyLoc = nBodyLoc >>> 0
  if (ebx === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x14f7)
  }
  if (esi === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x14f8)
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, esi)
  let edi = m.u32((ebx + 0x1720 + (ebp & 0x7f) * 4) >>> 0) >>> 0
  while (edi !== 0 && (m.u32((edi + 0x0c) >>> 0) >>> 0) !== ebp) {
    edi = m.u32((edi + 0xe4) >>> 0) >>> 0
  }
  if (edi === 0 || (m.u32(edi) | 0) !== 4 || (m.u32((edi + 0x10) >>> 0) | 0) !== 0) {
    return 0
  }
  if ((ITEMS_CheckRequirements113c(m, edi, esi, 0, 0, 0, 0) | 0) === 0) {
    return 0
  }
  const pInv = m.u32((esi + 0x60) >>> 0) >>> 0
  const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInv, edi) >>> 0
  if (pRemoved === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x1513)
  }
  if (edi !== pRemoved) {
    throw new D2CommonAssertError('Items.cpp', 0x1514)
  }
  const nInvRecId = UNITS_GetInventoryRecordId113c(m, esi, 0, m.u32((ebx + 0x70) >>> 0)) | 0
  const nPosY = UNIT_GetPosY113c(m, edi) | 0
  const nPosX = UNIT_GetPosX113c(m, edi) | 0
  INVENTORY_NoOpRet20113c(m, 0x6fd1b14c, 0x1516, pInv, nPosX, nPosY, nInvRecId, 0, 0)
  ITEMS_SetInvPage113c(m, edi, 0xff)
  if ((INVENTORY_PlaceItemInBodyLoc113c(m, pInv, edi, bBodyLoc) | 0) === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x1538)
  }
  if ((INVENTORY_PlaceItemInSocket113c(m, pInv, edi, 3) | 0) === 0) {
    INVENTORY_NoOpRet8B113c(m, pInv, bBodyLoc)
    throw new D2CommonAssertError('Items.cpp', 0x1535)
  }
  ITEMS_SetBodyLocation113c(m, edi, dwBodyLoc)
  INVENTORY_UpdateWeaponGuidOnInsert113c(m, pInv, edi)
  INVENTORY_SetCursorItem113c(m, pInv, 0)
  if ((ITEMS_CheckItemTypeIdMemPort113c(m, edi, 0x0d) | 0) !== 0) {
    throw new D2CommonAssertError('Items.cpp', 0x151e)
  }
  ITEMS_ActivateEquippedItemStats113c(m, esi, edi, 0)
  m.setU32((edi + 0xc4) >>> 0, (m.u32((edi + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  UNITS_ChangeAnimMode113c(m, edi, 1)
  ITEMS_SetInvPage113c(m, edi, 0xff)
  ITEMS_SetItemFlag113c(m, edi, 0x8000, 1)
  if ((ITEMS_HasSocketedSubItems113c(m, edi) | 0) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, edi, 1, 1)
  }
  if ((ITEMS_CheckCommandFlags113c(m, edi, 0x4000, 0x152b, 0x6fd1b14c) | 0) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, edi, 0x4000, 0)
  }
  INVENTORY_AppendItemGuidNode113c(m, pInv, edi)
  ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, esi)
  UNITS_SetUnitUpdateFlags113c(m, esi, 1)
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, ebx, esi, 0)
  return 1
}

/**
 * [17/39] Swaps dual-wield or two-handed weapons across both hand slots (`4` and `5`) when equipping a cursor item (`0x6FCF5C30`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF5C30
 * @ordinalOrName D2Game_6FCF5C30
 */
export function ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c(
  m: D2KernMemory113c,
  dwCursorItemGuid: number,
  pGame: number,
  pUnit: number,
  nBodyLoc: number,
  pOutRejectReason: number,
): number {
  hitD2GameVa113c(0x6FCF5C30)
  const esi = pGame >>> 0
  const edi = pUnit >>> 0
  const pOut = pOutRejectReason >>> 0
  const bBodyLoc = nBodyLoc & 0xff
  const dwBodyLoc = nBodyLoc >>> 0
  if (esi === 0) {
    throw new D2CommonAssertError('Items.cpp', 0xd39)
  }
  if (edi === 0) {
    throw new D2CommonAssertError('Items.cpp', 0xd3a)
  }
  m.setU32(pOut, 0)
  let ebp = m.u32((esi + 0x1720 + ((dwCursorItemGuid >>> 0) & 0x7f) * 4) >>> 0) >>> 0
  while (ebp !== 0 && (m.u32((ebp + 0x0c) >>> 0) >>> 0) !== (dwCursorItemGuid >>> 0)) {
    ebp = m.u32((ebp + 0xe4) >>> 0) >>> 0
  }
  if (ebp === 0 || (m.u32(ebp) | 0) !== 4 || (m.u32((ebp + 0x10) >>> 0) | 0) !== 4) {
    return 0
  }
  if ((INVENTORY_CanAutoEquipItem113c(m, edi, bBodyLoc, ebp, 0) | 0) !== 7) {
    return 0
  }
  if ((ITEMS_CheckRequirements113c(m, ebp, edi, 0, 0, 0, 0) | 0) === 0) {
    return 0
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, edi)
  const nInvRecId = UNITS_GetInventoryRecordId113c(m, edi, 0, m.u32((esi + 0x70) >>> 0)) | 0
  const ebx = m.u32((edi + 0x60) >>> 0) >>> 0
  const nOtherBodyLoc = bBodyLoc === 5 ? 4 : 5
  const pOtherItem = INVENTORY_GetItemFromBodyLocMemPort113c(m, ebx, nOtherBodyLoc) >>> 0
  if ((INVENTORY_CanBodyLocFitInGrid113c(m, ebx, ebp, nOtherBodyLoc, nInvRecId) | 0) === 0) {
    m.setU32(pOut, 1)
    return 0
  }
  if (pOtherItem === 0) {
    throw new D2CommonAssertError('Items.cpp', 0xd74)
  }
  if ((m.u32((pOtherItem + 0x10) >>> 0) | 0) !== 1) {
    m.setU32(pOut, 1)
    return 0
  }
  ITEMS_NoOpReturnZero113c(m, edi, pOtherItem)
  INVENTORY_UpdateWeaponGuidOnRemoval113c(m, ebx, pOtherItem)
  const pRemovedOther = INVENTORY_RemoveItemFromInventory113c(m, ebx, pOtherItem) >>> 0
  if (pRemovedOther === 0) {
    throw new D2CommonAssertError('Items.cpp', 0xd7e)
  }
  if (pOtherItem !== pRemovedOther) {
    throw new D2CommonAssertError('Items.cpp', 0xd7f)
  }
  INVENTORY_NoOpRet8B113c(m, ebx, nOtherBodyLoc)
  ITEMS_DeactivateEquippedItemStats113c(m, edi, pRemovedOther, esi, 0, 1)
  if ((INVENTORY_AutoPlaceItemInGrid113c(m, ebx, pRemovedOther, nInvRecId, 0, 0, 0x6fd1b14c, 0xd87) | 0) !== 0) {
    if ((INVENTORY_PlaceItemInSocket113c(m, ebx, pRemovedOther, 1) | 0) === 0) {
      m.setU32(pOut, 1)
      return 0
    }
    ITEMS_SetInvPage113c(m, pRemovedOther, 0)
    m.setU32((pRemovedOther + 0xc4) >>> 0, (m.u32((pRemovedOther + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
    INVENTORY_SetCursorItem113c(m, ebx, 0)
    UNITS_ChangeAnimMode113c(m, pRemovedOther, 0)
    if ((ITEMS_HasSocketedSubItems113c(m, pRemovedOther) | 0) !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pRemovedOther, 1, 1)
    }
    if ((ITEMS_CheckCommandFlags113c(m, pRemovedOther, 0x4000, 0xd91, 0x6fd1b14c) | 0) !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pRemovedOther, 0x4000, 0)
    }
    ITEMS_SetItemFlag113c(m, pRemovedOther, 0x4000, 1)
    ITEMS_SetOrClearCommandFlags113c(m, pRemovedOther, 1, 1)
    INVENTORY_AppendItemGuidNode113c(m, ebx, pRemovedOther)
  }
  const pPrimary = INVENTORY_GetItemFromBodyLocMemPort113c(m, ebx, bBodyLoc) >>> 0
  if (pPrimary === 0) {
    throw new D2CommonAssertError('Items.cpp', 0xda0)
  }
  if ((m.u32((pPrimary + 0x10) >>> 0) | 0) !== 1) {
    m.setU32(pOut, 1)
    return 0
  }
  ITEMS_DeactivateEquippedItemStats113c(m, edi, pPrimary, esi, 0, 1)
  if ((ITEMS_CheckRequirements113c(m, ebp, edi, 0, 0, 0, 0) | 0) === 0) {
    ITEMS_ActivateEquippedItemStats113c(m, edi, pPrimary, 0)
    INVENTORY_SetCursorItem113c(m, ebx, ebp)
    ITEMS_PlaceItemInSocketInventory_6FCF1650_113c(m, edi, ebp)
    SUNIT_SetUnitEventSound113c(m, edi, 0x14, 0)
    UNITS_SetUnitUpdateFlags113c(m, edi, 1)
    return 0
  }
  ITEMS_NoOpReturnZero113c(m, edi, pPrimary)
  INVENTORY_UpdateWeaponGuidOnRemoval113c(m, ebx, pPrimary)
  const pRemovedPrim = INVENTORY_RemoveItemFromInventory113c(m, ebx, pPrimary) >>> 0
  if (pRemovedPrim === 0) {
    throw new D2CommonAssertError('Items.cpp', 0xdb7)
  }
  if (pPrimary !== pRemovedPrim) {
    throw new D2CommonAssertError('Items.cpp', 0xdb8)
  }
  INVENTORY_NoOpRet8B113c(m, ebx, bBodyLoc)
  INVENTORY_SetCursorItem113c(m, ebx, pPrimary)
  m.setU32((pPrimary + 0xc4) >>> 0, (m.u32((pPrimary + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  UNITS_ChangeAnimMode113c(m, pPrimary, 4)
  ITEMS_SetItemFlag113c(m, pPrimary, 0x10, 1)
  ITEMS_SetOrClearCommandFlags113c(m, pPrimary, 1, 1)
  if ((ITEMS_CheckCommandFlags113c(m, pPrimary, 0x4000, 0xdbf, 0x6fd1b14c) | 0) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pPrimary, 0x4000, 0)
  }
  INVENTORY_AppendItemGuidNode113c(m, ebx, pPrimary)
  if ((INVENTORY_PlaceItemInBodyLoc113c(m, ebx, ebp, bBodyLoc) | 0) === 0) {
    m.setU32(pOut, 1)
    return 0
  }
  if ((INVENTORY_PlaceItemInSocket113c(m, ebx, ebp, 3) | 0) === 0) {
    m.setU32(pOut, 1)
    return 0
  }
  ITEMS_SetBodyLocation113c(m, ebp, dwBodyLoc)
  INVENTORY_UpdateWeaponGuidOnInsert113c(m, ebx, ebp)
  ITEMS_ActivateEquippedItemStats113c(m, edi, ebp, 0)
  m.setU32((ebp + 0xc4) >>> 0, (m.u32((ebp + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  UNITS_ChangeAnimMode113c(m, ebp, 1)
  ITEMS_SetInvPage113c(m, ebp, 0xff)
  ITEMS_SetOrClearCommandFlags113c(m, ebp, 8, 1)
  ITEMS_SetItemFlag113c(m, ebp, 8, 1)
  ITEMS_SetOrClearCommandFlags113c(m, ebp, 1, 1)
  if ((ITEMS_HasSocketedSubItems113c(m, ebp) | 0) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, ebp, 1, 1)
  }
  if ((ITEMS_CheckCommandFlags113c(m, ebp, 0x4000, 0xdd9, 0x6fd1b14c) | 0) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, ebp, 0x4000, 0)
  }
  INVENTORY_AppendItemGuidNode113c(m, ebx, ebp)
  ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, edi)
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, esi, edi, 0)
  return 1
}

/**
 * [18/39] Equips cursor item (`dwItemGuid`) into `nBodyLoc` on `pUnit` (primary or secondary weapon slot) (`0x6FCF60D0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF60D0
 * @ordinalOrName D2Game_6FCF60D0
 */
export function ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c(
  m: D2KernMemory113c,
  dwItemGuid: number,
  pUnit: number,
  pGame: number,
  nBodyLoc: number,
  bSecondarySlot: number,
  pOutRejectReason: number,
): number {
  hitD2GameVa113c(0x6FCF60D0)
  const ebx = dwItemGuid >>> 0
  const esi = pUnit >>> 0
  const edi = pGame >>> 0
  const bBodyLoc = nBodyLoc & 0xff
  const dwBodyLoc = nBodyLoc >>> 0
  const bSec = bSecondarySlot >>> 0
  const ebp = pOutRejectReason >>> 0
  const bIsAltWeapon = bBodyLoc === 0x0b || bBodyLoc === 0x0c ? 1 : 0
  if (edi === 0) {
    throw new D2CommonAssertError('Items.cpp', 0xaef)
  }
  if (esi === 0) {
    throw new D2CommonAssertError('Items.cpp', 0xaf0)
  }
  if (ebp !== 0) {
    m.setU32(ebp, 0)
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, esi)
  let pItem = m.u32((edi + 0x1720 + (ebx & 0x7f) * 4) >>> 0) >>> 0
  while (pItem !== 0 && (m.u32((pItem + 0x0c) >>> 0) >>> 0) !== ebx) {
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) {
    if (ebp !== 0) m.setU32(ebp, 1)
    return 0
  }
  if ((m.u32(pItem) | 0) !== 4) {
    return 0
  }
  if ((m.u32((pItem + 0x10) >>> 0) | 0) !== 4) {
    if (ebp !== 0) m.setU32(ebp, 1)
    return 0
  }
  if ((INVENTORY_CanAutoEquipItem113c(m, esi, bBodyLoc, pItem, bSec) | 0) !== 1) {
    if (ebp !== 0) m.setU32(ebp, 0)
    return 0
  }
  if (bSec === 0 && (ITEMS_CheckRequirements113c(m, pItem, esi, 0, 0, 0, 0) | 0) === 0) {
    if (ebp !== 0) m.setU32(ebp, 1)
    return 0
  }
  const pInv = m.u32((esi + 0x60) >>> 0) >>> 0
  if (bIsAltWeapon === 0) {
    const pCompWeapon = INVENTORY_GetCompositWeaponMem113c(m, pInv) >>> 0
    if (pCompWeapon !== 0) {
      UNITS_SetInteractItem113c(m, esi, pCompWeapon)
    }
  }
  if ((INVENTORY_PlaceItemInBodyLoc113c(m, pInv, pItem, bBodyLoc) | 0) !== 0) {
    const nSocketType = bIsAltWeapon === 0 ? 3 : 4
    if ((INVENTORY_PlaceItemInSocket113c(m, pInv, pItem, nSocketType) | 0) === 0) {
      if (ebp !== 0) m.setU32(ebp, 1)
      return 0
    }
    ITEMS_SetBodyLocation113c(m, pItem, dwBodyLoc)
    if (bIsAltWeapon === 0) {
      INVENTORY_UpdateWeaponGuidOnInsert113c(m, pInv, pItem)
      ITEMS_ActivateEquippedItemStats113c(m, esi, pItem, bIsAltWeapon)
    }
    INVENTORY_SetCursorItem113c(m, pInv, 0)
    m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
    UNITS_ChangeAnimMode113c(m, pItem, 1)
    ITEMS_SetInvPage113c(m, pItem, 0xff)
    ITEMS_SetItemFlag113c(m, pItem, 8, 1)
    ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1)
    if ((ITEMS_CheckCommandFlags113c(m, pItem, 0x4000, 0xb4f, 0x6fd1b14c) | 0) !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x4000, 0)
    }
    INVENTORY_AppendItemGuidNode113c(m, pInv, pItem)
    UNITS_SetUnitUpdateFlags113c(m, esi, 1)
    ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, esi)
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, edi, esi, 0)
  }
  return 1
}

/**
 * [19/39] Picks up a ground item (`dwItemGuid`) onto `pUnit`'s cursor (or distributes gold if gold item) (`0x6FCF7160`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF7160
 * @ordinalOrName D2Game_6FCF7160
 */
export function ITEMS_PickupGroundItemToCursor_6FCF7160_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  dwItemGuid: number,
  pOutRejectReason: number,
): void {
  hitD2GameVa113c(0x6FCF7160)
  const edi = pUnit >>> 0
  const ebx = pGame >>> 0
  const dwGuid = dwItemGuid >>> 0
  const pOut = pOutRejectReason >>> 0
  if (ebx === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x559)
  }
  if (edi === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x55a)
  }
  m.setU32(pOut, 0)
  const ebp = m.u32((edi + 0x60) >>> 0) >>> 0
  if (ebp === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x55f)
  }
  if ((INVENTORY_GetCursorItem113c(m, ebp) >>> 0) !== 0) {
    return
  }
  if ((PLAYER_IsBusyWithCursorOrNpcInteract113c(m, edi) | 0) !== 0) {
    return
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, edi)
  let esi = m.u32((ebx + 0x1720 + (dwGuid & 0x7f) * 4) >>> 0) >>> 0
  while (esi !== 0 && (m.u32((esi + 0x0c) >>> 0) >>> 0) !== dwGuid) {
    esi = m.u32((esi + 0xe4) >>> 0) >>> 0
  }
  if (esi === 0 || (m.u32(esi) | 0) !== 4) {
    return
  }
  if ((m.u32((esi + 0x10) >>> 0) | 0) !== 3) {
    m.setU32(pOut, 1)
    return
  }
  if ((ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c(m, edi, ebx, esi) | 0) === 0) {
    ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c(m, esi, edi, 0x13)
    return
  }
  const pRoom = UNITS_GetRoom113c(m, esi) >>> 0
  DUNGEON_AddRoomPortalNode113c(m, pRoom, m.u32(esi) | 0, m.u32((esi + 0x0c) >>> 0) | 0)
  if ((ITEMS_GetItemTypeFromItem113c(m, esi) | 0) === 4) {
    ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c(m, edi, ebx, esi)
    SUNIT_SetUnitEventSound113c(m, edi, 1, edi)
    return
  }
  UNITS_SetTargetUnitForDynamicUnitEx113c(m, esi)
  UNITROOM_RemoveUnitFromRoom113c(m, esi)
  m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  INVENTORY_SetCursorItem113c(m, ebp, esi)
  UNITS_ChangeAnimMode113c(m, esi, 4)
  ITEMS_SetItemFlag113c(m, esi, 0x40, 1)
  ITEMS_SetInvPage113c(m, esi, 0xff)
  UNITS_SetUnitUpdateFlags113c(m, edi, 1)
  m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) & 0xfdffffff) >>> 0)
  INVENTORY_AppendItemGuidNode113c(m, ebp, esi)
  QUESTS_TriggerItemDropped_6FC545A0_113c(m, ebx, esi, edi)
  SUNIT_SetUnitEventSound113c(m, edi, 1, edi)
}

/**
 * [20/39] Uses a belt item (`dwItemGuid`) on `pUnit` or mercenary (`bShiftToMerc`), updates scroll charges, and compacts belt column (`0x6FCF8BA0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF8BA0
 * @ordinalOrName D2Game_6FCF8BA0
 */
export function ITEMS_UseBeltItem_6FCF8BA0_113c(
  m: D2KernMemory113c,
  pOutRejectReason: number,
  dwItemGuid: number,
  pGame: number,
  pUnit: number,
  nX: number,
  nY: number,
  bShiftToMerc: number,
): number {
  hitD2GameVa113c(0x6FCF8BA0)
  const edi = pOutRejectReason >>> 0
  const esi = dwItemGuid >>> 0
  const ebx = pGame >>> 0
  const ebp = pUnit >>> 0
  if (ebx === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x1326)
  }
  if (ebp === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x1327)
  }
  m.setU32(edi, 0)
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, ebp)
  let pItem = m.u32((ebx + 0x1720 + (esi & 0x7f) * 4) >>> 0) >>> 0
  while (pItem !== 0 && (m.u32((pItem + 0x0c) >>> 0) >>> 0) !== esi) {
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) {
    m.setU32(edi, 1)
    return 0
  }
  if ((m.u32(pItem) | 0) !== 4) {
    return 0
  }
  if ((INVENTORY_GetCursorItem113c(m, m.u32((ebp + 0x60) >>> 0) >>> 0) >>> 0) !== 0) {
    return 0
  }
  if ((m.u32((pItem + 0x10) >>> 0) | 0) !== 2 || (ITEMS_CheckIfUseable113c(m, pItem) | 0) === 0) {
    m.setU32(edi, 1)
    return 0
  }
  if ((PLRTRADE_IsInteractingWithValidPlayer113c(m, ebp, ebx) | 0) !== 0) {
    return 0
  }
  let pTargetUnit = ebp
  if ((bShiftToMerc | 0) !== 0 && (m.u32(ebp) | 0) === 0 && (m.u32((ebx + 0x70) >>> 0) | 0) !== 0) {
    if (
      (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x4c) | 0) === 0 &&
      (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x51) | 0) === 0 &&
      (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x50) | 0) === 0
    ) {
      return 0
    }
    const pPlrData = UNITS_GetPlayerData113c(m, ebp) >>> 0
    if (pPlrData !== 0) {
      const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
      const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
      if (pDataTables !== 0 && (m.u32((pDataTables + 0xbf0) >>> 0) | 0) > 7) {
        const pField44 = m.u32((pPlrData + 0x44) >>> 0) >>> 0
        if (pField44 !== 0) {
          const pBase = m.u32(pField44) >>> 0
          const pListSlot = (pBase + 0x54) >>> 0
          if (pListSlot !== 0) {
            let pNode = m.u32(pListSlot) >>> 0
            while (pNode !== 0) {
              if ((m.u8(pNode) & 1) === 0) {
                const dwMercGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
                let pMon = m.u32((ebx + 0x1320 + (dwMercGuid & 0x7f) * 4) >>> 0) >>> 0
                while (pMon !== 0 && (m.u32((pMon + 0x0c) >>> 0) >>> 0) !== dwMercGuid) {
                  pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
                }
                if (pMon !== 0) {
                  pTargetUnit = pMon
                }
                break
              }
              pNode = m.u32((pNode + 0x14) >>> 0) >>> 0
            }
          }
        }
      }
    }
  }
  if (
    (ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c(
      m,
      pTargetUnit,
      pItem,
      ebx,
      pItem,
      nX | 0,
      nY | 0,
    ) |
      0) ===
    0
  ) {
    return 0
  }
  const nBeltSlot = UNIT_GetPosX113c(m, pItem) | 0
  const nSkillId = ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(m, pItem) | 0
  if (nSkillId !== -1) {
    const pSkill = SKILLS_GetSkillById113c(m, ebp, nSkillId, -1) >>> 0
    if (pSkill !== 0) {
      let nCharges = ((SKILLS_GetCharges113c(m, pSkill) | 0) - 1) | 0
      if (nCharges <= 0) {
        if ((UNITS_GetRightSkill113c(m, ebp) >>> 0) === pSkill) {
          SKILLS_AssignHandSkillAndSyncAura113c(m, ebp, 0, 0, -1)
        }
        nCharges = 0
      }
      SKILLS_SetCharges113c(m, pSkill, nCharges)
      const dwUnitGuid = m.u32((ebp + 0x0c) >>> 0) >>> 0
      const dwUnitType = m.u32(ebp) >>> 0
      let pClient = 0
      if (dwUnitType === 0) {
        const pPlrData2 = UNITS_GetPlayerData113c(m, ebp) >>> 0
        pClient = m.u32((pPlrData2 + 0x9c) >>> 0) >>> 0
      }
      NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(
        m,
        pClient,
        dwUnitType & 0xff,
        dwUnitGuid,
        nSkillId & 0xffff,
        nCharges & 0xff,
      )
    }
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, ebp)
  ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c(m, pItem, ebp, ebx)
  ITEMS_CompactBeltColumnDown_6FCF2540_113c(m, nBeltSlot, ebp)
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF8EA0
 * @ordinalOrName ITEMS_SwitchWeaponSlots_6FCF8EA0_113c
 */
export function ITEMS_SwitchWeaponSlots_6FCF8EA0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pOutError: number,
): number {
  hitD2GameVa113c(0x6FCF8EA0)
  const sp = k2W7B4StackPtr;
  k2W7B4StackPtr = (sp + 0x100) >>> 0;
  try {
    if ((pGame >>> 0) === 0) {
      FOG_DisplayAssert113c('pGame', 'ItemMode.cpp', 0xe1f);
      throw new D2CommonAssertError('ItemMode.cpp', 0xe1f);
    }
    if ((pUnit >>> 0) === 0) {
      FOG_DisplayAssert113c('pUnit', 'ItemMode.cpp', 0xe20);
      throw new D2CommonAssertError('ItemMode.cpp', 0xe20);
    }
    const pErr = pOutError >>> 0;
    m.setU32(pErr, 0);
    ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
    const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0;

    const pSubRightSkillId = sp >>> 0;
    const pSubRightOwnerGuid = (sp + 4) >>> 0;
    const pSubLeftOwnerGuid = (sp + 8) >>> 0;
    const pSubLeftSkillId = (sp + 0x0c) >>> 0;
    const pTmpGuid = (sp + 0x10) >>> 0;
    const pSlots = (sp + 0x14) >>> 0;
    const pPkt = (sp + 0x60) >>> 0;

    UNITS_PopPlayerSubtargetRight113c(m, pUnit, pSubRightSkillId, pSubRightOwnerGuid);
    UNITS_PopPlayerSubtargetLeft113c(m, pUnit, pSubLeftSkillId, pSubLeftOwnerGuid);
    PLAYER_StoreSwitchRightSkill113c(m, pUnit);
    PLAYER_StoreSwitchLeftSkill113c(m, pUnit);

    const srcBodyLocs = [4, 5, 11, 12];
    const dstBodyLocs = [11, 12, 4, 5];
    const socketPages = [4, 4, 3, 3];

    for (let i = 0; i < 4; i++) {
      const pSlotItemPtr = (pSlots + i * 4) >>> 0;
      const srcLoc = srcBodyLocs[i]!;
      let pItem = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, srcLoc) >>> 0;
      m.setU32(pSlotItemPtr, pItem);
      if (pItem !== 0) {
        INVENTORY_GetSwapWeaponItem113c(m, pUnit, pInventory, pSlotItemPtr, srcLoc);
        pItem = m.u32(pSlotItemPtr) >>> 0;
        if (pItem === 0 || (m.u32((pItem + 0x10) >>> 0) >>> 0) !== 1) {
          m.setU32(pErr, 1);
          return 0;
        }
      }
    }

    const pItem0 = m.u32(pSlots) >>> 0;
    if (pItem0 !== 0) {
      ITEMS_DeactivateEquippedItemStats113c(m, pUnit, pItem0, pGame, 0, 1);
    }
    const pItem1 = m.u32((pSlots + 4) >>> 0) >>> 0;
    if (pItem1 !== 0) {
      ITEMS_DeactivateEquippedItemStats113c(m, pUnit, pItem1, pGame, 0, 1);
    }

    for (let i = 0; i < 4; i++) {
      const pItem = m.u32((pSlots + i * 4) >>> 0) >>> 0;
      if (pItem !== 0) {
        if (i < 2) {
          INVENTORY_UpdateWeaponGuidOnRemoval113c(m, pInventory, pItem);
        }
        const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInventory, pItem) >>> 0;
        if (pRemoved === 0 || pRemoved !== pItem) {
          m.setU32(pErr, 1);
          return 0;
        }
        INVENTORY_NoOpRet8B113c(m, pInventory, srcBodyLocs[i]!);
        ITEMS_SetInvPage113c(m, pRemoved, 0xff);
        ITEMS_SetItemFlag113c(m, pRemoved, 0x200000, 1);
        ITEMS_SetOrClearCommandFlags113c(m, pRemoved, 1, 1);
        if (ITEMS_CheckCommandFlags113c(m, pRemoved, 0x4000, 0xe5c, 0x6fd1b14c) !== 0) {
          ITEMS_SetOrClearCommandFlags113c(m, pRemoved, 0x4000, 0);
        }
        INVENTORY_AppendItemGuidNode113c(m, pInventory, pRemoved);
      }
    }

    for (let i = 0; i < 4; i++) {
      const pItem = m.u32((pSlots + i * 4) >>> 0) >>> 0;
      if (pItem !== 0) {
        const dstLoc = dstBodyLocs[i]!;
        if (INVENTORY_PlaceItemInBodyLoc113c(m, pInventory, pItem, dstLoc) === 0) {
          m.setU32(pErr, 1);
          return 0;
        }
        if (INVENTORY_PlaceItemInSocket113c(m, pInventory, pItem, socketPages[i]!) === 0) {
          m.setU32(pErr, 1);
          return 0;
        }
        ITEMS_SetBodyLocation113c(m, pItem, dstLoc & 0xff);
        if (dstLoc === 4 || dstLoc === 5) {
          INVENTORY_UpdateWeaponGuidOnInsert113c(m, pInventory, pItem);
          ITEMS_ActivateEquippedItemStats113c(m, pUnit, pItem, 0);
          ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x40, 1);
        } else {
          ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x80, 1);
        }
        m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~2) >>> 0);
        UNITS_ChangeAnimMode113c(m, pItem, 1);
        ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1);
        ITEMS_SetItemFlag113c(m, pItem, 0x200000, 1);
        ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1);
        if (i < 2) {
          ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, pUnit);
        }
      }
    }

    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit, 0);

    const nLeftSkillId = m.u32(pSubRightSkillId) | 0;
    const dwLeftOwnerGuid = m.u32(pSubRightOwnerGuid) >>> 0;
    const nRightSkillId = m.u32(pSubLeftSkillId) | 0;
    const dwRightOwnerGuid = m.u32(pSubLeftOwnerGuid) >>> 0;

    const pLeftSkill = SKILLS_GetSkillById113c(m, pUnit, nLeftSkillId, dwLeftOwnerGuid) >>> 0;
    const pRightSkill = SKILLS_GetSkillById113c(m, pUnit, nRightSkillId, dwRightOwnerGuid) >>> 0;

    if ((m.u32(pUnit >>> 0) >>> 0) !== 0) {
      FOG_DisplayAssert113c('pClient', 'ItemMode.cpp', 0xe95);
      throw new D2CommonAssertError('ItemMode.cpp', 0xe95);
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit) >>> 0;
    const pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0;
    if (pClient === 0) {
      FOG_DisplayAssert113c('pClient', 'ItemMode.cpp', 0xe95);
      throw new D2CommonAssertError('ItemMode.cpp', 0xe95);
    }
    m.setU8((pClient + 0x45c) >>> 0, (m.u8((pClient + 0x45c) >>> 0) & 0xff) === 0 ? 1 : 0);

    const pClient97 = (m.u32(pUnit >>> 0) >>> 0) === 0
      ? (m.u32(((UNITS_GetPlayerData113c(m, pUnit) >>> 0) + 0x9c) >>> 0) >>> 0)
      : 0;
    m.setU8(pPkt, 0x97);
    NET_QueuePacketToClientBuffer113c(m, pClient97, 1, pPkt, 1);

    const nLeftFail = pLeftSkill !== 0 ? (SKILLS_GetSkillUseFailReason113c(m, pUnit, pLeftSkill) | 0) : 0;
    if (pLeftSkill !== 0 && nLeftFail !== 2 && nLeftFail !== 7) {
      if (nLeftSkillId !== 5) {
        const pSkillL = SKILLS_GetSkillById113c(m, pUnit, nLeftSkillId, dwLeftOwnerGuid) >>> 0;
        if (pSkillL !== 0) {
          SKILLS_SetLeftSkill113c(m, pUnit, nLeftSkillId, dwLeftOwnerGuid);
          m.setU32(pTmpGuid, 0xffffffff);
          SKILLS_GetItemSkillInfo113c(m, pSkillL, pTmpGuid, 0, 0, 0);
          if ((m.u32(pUnit >>> 0) >>> 0) === 0) {
            const dwUnitGuid = m.u32((pUnit + 0x0c) >>> 0) >>> 0;
            const pClientL = m.u32(((UNITS_GetPlayerData113c(m, pUnit) >>> 0) + 0x9c) >>> 0) >>> 0;
            m.setU8(pPkt, 0x23);
            m.setU8((pPkt + 1) >>> 0, 0);
            m.setU32((pPkt + 2) >>> 0, dwUnitGuid);
            m.setU8((pPkt + 6) >>> 0, 1);
            m.setU16((pPkt + 7) >>> 0, nLeftSkillId & 0xffff);
            m.setU32((pPkt + 9) >>> 0, m.u32(pTmpGuid) >>> 0);
            NET_QueuePacketToClientBuffer113c(m, pClientL, 1, pPkt, 0x0d);
          }
        }
      }
      UNITMSG_QueuePacket23SetSkill_6FC9A020_113c(m, pUnit, 1, nLeftSkillId, dwLeftOwnerGuid);
    } else {
      const pCurLeft = UNITS_GetLeftSkill113c(m, pUnit) >>> 0;
      const wSkillId = pCurLeft !== 0 ? (SKILLS_GetSkillIdFromSkill113c(m, pCurLeft, 0x6fd1b14c, 0xea3) & 0xffff) : 0;
      const dwOwnerGuid = pCurLeft !== 0 ? (SKILLS_GetOwnerItemGuid113c(m, pCurLeft) >>> 0) : 0xffffffff;
      UNITMSG_QueuePacket23SetSkill_6FC9A020_113c(m, pUnit, 1, wSkillId, dwOwnerGuid);
    }

    const nRightFail = pRightSkill !== 0 ? (SKILLS_GetSkillUseFailReason113c(m, pUnit, pRightSkill) | 0) : 0;
    if (pRightSkill !== 0 && nRightFail !== 2 && nRightFail !== 7) {
      SKILLS_AssignHandSkillAndSyncAura113c(m, pUnit, 0, nRightSkillId, dwRightOwnerGuid);
      UNITMSG_QueuePacket23SetSkill_6FC9A020_113c(m, pUnit, 0, nRightSkillId, dwRightOwnerGuid);
      return 1;
    }

    const pCurRight = UNITS_GetRightSkill113c(m, pUnit) >>> 0;
    const wRightSkillId = pCurRight !== 0 ? (SKILLS_GetSkillIdFromSkill113c(m, pCurRight, 0x6fd1b14c, 0xeb1) & 0xffff) : 0;
    const dwRightGuid = pCurRight !== 0 ? (SKILLS_GetOwnerItemGuid113c(m, pCurRight) >>> 0) : 0xffffffff;
    UNITMSG_QueuePacket23SetSkill_6FC9A020_113c(m, pUnit, 0, wRightSkillId, dwRightGuid);
    return 1;
  } finally {
    k2W7B4StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF9BF0
 * @ordinalOrName ITEMS_UseInventoryItem_6FCF9BF0_113c
 */
export function ITEMS_UseInventoryItem_6FCF9BF0_113c(
  m: D2KernMemory113c,
  dwItemGuid: number,
  pGame: number,
  pUnit: number,
  nX: number,
  nY: number,
  pOutError: number,
): number {
  hitD2GameVa113c(0x6FCF9BF0)
  if ((pGame >>> 0) === 0) {
    FOG_DisplayAssert113c('pGame', 'ItemMode.cpp', 0x105b);
    throw new D2CommonAssertError('ItemMode.cpp', 0x105b);
  }
  if ((pUnit >>> 0) === 0) {
    FOG_DisplayAssert113c('pUnit', 'ItemMode.cpp', 0x105c);
    throw new D2CommonAssertError('ItemMode.cpp', 0x105c);
  }
  const pErr = pOutError >>> 0;
  m.setU32(pErr, 0);
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);

  const dwGuid = dwItemGuid >>> 0;
  let pItem = m.u32((pGame + 0x1720 + ((dwGuid & 0x7f) << 2)) >>> 0) >>> 0;
  while (pItem !== 0 && (m.u32((pItem + 0x0c) >>> 0) >>> 0) !== dwGuid) {
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0;
  }
  if (pItem === 0) {
    m.setU32(pErr, 1);
    return 0;
  }
  if (
    (m.u32(pItem) >>> 0) !== 4 ||
    (INVENTORY_GetCursorItem113c(m, m.u32((pUnit + 0x60) >>> 0) >>> 0) >>> 0) !== 0
  ) {
    return 0;
  }
  if ((m.u32((pItem + 0x10) >>> 0) >>> 0) !== 0 || ITEMS_CheckIfUseable113c(m, pItem) === 0) {
    m.setU32(pErr, 1);
    return 0;
  }
  if ((ITEMS_GetItemTypeFromItem113c(m, pItem) | 0) === 0x12) {
    if ((STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) | 0) <= 0) {
      return 0;
    }
  }
  if (PLRTRADE_IsInteractingWithValidPlayer113c(m, pUnit, pGame) !== 0) {
    return 0;
  }
  if (ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c(m, pUnit, pItem, pGame, 0, nX | 0, nY | 0) !== 0) {
    if ((ITEMS_GetItemTypeFromItem113c(m, pItem) | 0) === 0x12) {
      const nSkillId = ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(m, pItem) | 0;
      if (nSkillId !== -1 && (STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) | 0) > 0) {
        STATLIST_AddUnitStat113c(m, pItem, 0x46, -1, 0);
        const pClient = (m.u32(pUnit >>> 0) >>> 0) === 0
          ? (m.u32(((UNITS_GetPlayerData113c(m, pUnit) >>> 0) + 0x9c) >>> 0) >>> 0)
          : 0;
        const dwNewQty = STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) >>> 0;
        NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, 0, pClient, 1, 0x46, dwNewQty);
        const pClient2 = (m.u32(pUnit >>> 0) >>> 0) === 0
          ? (m.u32(((UNITS_GetPlayerData113c(m, pUnit) >>> 0) + 0x9c) >>> 0) >>> 0)
          : 0;
        S2C_QueueByteDwordPacket6_6FCAC3B0_113c(
          m,
          0x7c,
          m.u8(pItem) & 0xff,
          m.u32((pItem + 0x0c) >>> 0) >>> 0,
          pClient2,
        );
        ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c(m, pUnit, nSkillId);
        return 1;
      }
      return 1;
    }

    const nSkillId = ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(m, pItem) | 0;
    if (nSkillId !== -1) {
      const pSkill = SKILLS_GetSkillById113c(m, pUnit, nSkillId, -1) >>> 0;
      if (pSkill !== 0) {
        let nCharges = ((SKILLS_GetCharges113c(m, pSkill) | 0) - 1) | 0;
        if (nCharges <= 0) {
          if ((UNITS_GetRightSkill113c(m, pUnit) >>> 0) === pSkill) {
            SKILLS_AssignHandSkillAndSyncAura113c(m, pUnit, 0, 0, 0xffffffff);
          }
          nCharges = 0;
        }
        SKILLS_SetCharges113c(m, pSkill, nCharges);
        const dwUnitType = m.u32(pUnit >>> 0) >>> 0;
        const dwUnitGuid = m.u32((pUnit + 0x0c) >>> 0) >>> 0;
        const pClient = dwUnitType === 0
          ? (m.u32(((UNITS_GetPlayerData113c(m, pUnit) >>> 0) + 0x9c) >>> 0) >>> 0)
          : 0;
        NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(m, pClient, dwUnitType, dwUnitGuid, nSkillId, nCharges);
      }
    }
    ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
    ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(m, pItem, pUnit, pGame);
    return 1;
  }

  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((pItem + 4) >>> 0) | 0) >>> 0;
  const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pUnit, pGame) >>> 0;
  const dwCode = m.u32((pItemsTxt + 0x80) >>> 0) >>> 0;
  if (dwCode === 0x20737361) {
    ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 9, 5) === 0) {
      SUNIT_SetUnitEventSound113c(m, pUnit, 0x13, pUnit);
      return 1;
    }
    QUESTRECORD_ClearQuestState113c(m, pQuestRec, 9, 5);
    STATLIST_AddUnitStat113c(m, pUnit, 5, 1, 0);
    QUESTS_SendQuestItemState2_5D_113c(m, pUnit, 8);
    ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(m, pItem, pUnit, pGame);
    return 1;
  }
  if (dwCode === 0x207a7978) {
    ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x14, 5) === 0) {
      SUNIT_SetUnitEventSound113c(m, pUnit, 0x13, pUnit);
      return 1;
    }
    QUESTRECORD_ClearQuestState113c(m, pQuestRec, 0x14, 5);
    STATLIST_AddUnitStat113c(m, pUnit, 7, 0x1400, 0);
    QUESTS_SendQuestItemState2_5D_113c(m, pUnit, 0x12);
    ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(m, pItem, pUnit, pGame);
    return 1;
  }
  if (dwCode === 0x20327274) {
    ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x25, 8) === 0 ||
      DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x25, 7) !== 0
    ) {
      SUNIT_SetUnitEventSound113c(m, pUnit, 0x13, pUnit);
      return 1;
    }
    QUESTRECORD_SetQuestState113c(m, pQuestRec, 0x25, 7);
    ACT5Q3_ApplyScrollOfResistanceAcrossDifficulties_6FC7B0B0_113c(m, pUnit, pGame);
    QUESTS_SendQuestItemState2_5D_113c(m, pUnit, 0x21);
    ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(m, pItem, pUnit, pGame);
    return 1;
  }
  if (dwCode === 0x20616f74) {
    ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
    SKILLS_RespecPlayerClassSkills_6FCC1280_113c(m, pUnit, pGame);
    PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c(m, pUnit);
    ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(m, pItem, pUnit, pGame);
    SUNIT_SetUnitEventSound113c(m, pUnit, 2, pUnit);
    return 1;
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF9FB0
 * @ordinalOrName ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c
 */
export function ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c(
  m: D2KernMemory113c,
  dwScrollOrTomeGuid: number,
  pUnit: number,
  dwTargetItemGuid: number,
  pGame: number,
  pOutError: number,
): number {
  hitD2GameVa113c(0x6FCF9FB0)
  if ((pGame >>> 0) === 0) {
    FOG_DisplayAssert113c('pGame', 'ItemMode.cpp', 0xfd0);
    throw new D2CommonAssertError('ItemMode.cpp', 0xfd0);
  }
  if ((pUnit >>> 0) === 0) {
    FOG_DisplayAssert113c('pUnit', 'ItemMode.cpp', 0xfd1);
    throw new D2CommonAssertError('ItemMode.cpp', 0xfd1);
  }

  const dwTargetGuid = dwTargetItemGuid >>> 0;
  let pTargetItem = m.u32((pGame + 0x1720 + ((dwTargetGuid & 0x7f) << 2)) >>> 0) >>> 0;
  while (pTargetItem !== 0 && (m.u32((pTargetItem + 0x0c) >>> 0) >>> 0) !== dwTargetGuid) {
    pTargetItem = m.u32((pTargetItem + 0xe4) >>> 0) >>> 0;
  }

  const dwSourceGuid = dwScrollOrTomeGuid >>> 0;
  let pSourceItem = m.u32((pGame + 0x1720 + ((dwSourceGuid & 0x7f) << 2)) >>> 0) >>> 0;
  while (pSourceItem !== 0 && (m.u32((pSourceItem + 0x0c) >>> 0) >>> 0) !== dwSourceGuid) {
    pSourceItem = m.u32((pSourceItem + 0xe4) >>> 0) >>> 0;
  }

  const pErr = pOutError >>> 0;
  m.setU32(pErr, 0);
  if (pSourceItem === 0) {
    m.setU32(pErr, 1);
    return 0;
  }
  if (pTargetItem === 0 || pTargetItem === pSourceItem) {
    ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
    return 0;
  }
  if ((m.u32((pSourceItem + 0x10) >>> 0) >>> 0) === 2) {
    if (ITEMS_CheckItemTypeIdMemPort113c(m, pSourceItem, 0x16) === 0) {
      m.setU32(pErr, 1);
      return 0;
    }
  }
  if (PLRTRADE_IsInteractingWithValidPlayer113c(m, pUnit, pGame) !== 0) {
    m.setU32(pErr, 0);
    return 0;
  }
  if (
    (m.u32(pTargetItem) >>> 0) !== 4 ||
    (m.u32(pSourceItem) >>> 0) !== 4 ||
    (INVENTORY_GetCursorItem113c(m, m.u32((pUnit + 0x60) >>> 0) >>> 0) >>> 0) !== 0
  ) {
    return 0;
  }

  const nTargetMode = m.u32((pTargetItem + 0x10) >>> 0) >>> 0;
  const nSourceMode = m.u32((pSourceItem + 0x10) >>> 0) >>> 0;
  if (nTargetMode !== 0 && nTargetMode !== 1) {
    if (nSourceMode === 2) {
      ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
      ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c(m, pSourceItem, pUnit, pGame);
      return 0;
    }
    if (nSourceMode === 0) {
      if ((ITEMS_GetItemTypeFromItem113c(m, pSourceItem) | 0) !== 0x12) {
        return 0;
      }
      let nNewQty = ((STATLIST_GetUnitStat113c(m, pSourceItem, 0x46, 0) | 0) - 1) | 0;
      if (nNewQty < 0) {
        nNewQty = 0;
      }
      STATLIST_SetUnitStat113c(m, pSourceItem, 0x46, nNewQty, 0);
      const pClient = (m.u32(pUnit >>> 0) >>> 0) === 0
        ? (m.u32(((UNITS_GetPlayerData113c(m, pUnit) >>> 0) + 0x9c) >>> 0) >>> 0)
        : 0;
      NET_SendPacket0x3E_ItemStatBitStream113c(m, pSourceItem, 0, pClient, 1, 0x46, nNewQty >>> 0);
      return 0;
    }
    m.setU32(pErr, 1);
    return 0;
  }

  if ((ITEMS_GetItemTypeFromItem113c(m, pSourceItem) | 0) === 0x12) {
    if ((STATLIST_GetUnitStat113c(m, pSourceItem, 0x46, 0) | 0) <= 0) {
      ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
      const pClient = (m.u32(pUnit >>> 0) >>> 0) === 0
        ? (m.u32(((UNITS_GetPlayerData113c(m, pUnit) >>> 0) + 0x9c) >>> 0) >>> 0)
        : 0;
      S2C_QueueByteDwordPacket6_6FCAC3B0_113c(
        m,
        0x7c,
        m.u8(pSourceItem) & 0xff,
        m.u32((pSourceItem + 0x0c) >>> 0) >>> 0,
        pClient,
      );
      return 0;
    }
  }

  if (ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c(m, pUnit, pSourceItem, pGame, pTargetItem, 0, 0) === 0) {
    return 1;
  }

  if (nSourceMode === 2) {
    const nSkillId = ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(m, pSourceItem) | 0;
    if (nSkillId !== -1) {
      ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c(m, pUnit, nSkillId);
      ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c(m, pSourceItem, pUnit, pGame);
      ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
      return 1;
    }
    const pClient = (m.u32(pUnit >>> 0) >>> 0) === 0
      ? (m.u32(((UNITS_GetPlayerData113c(m, pUnit) >>> 0) + 0x9c) >>> 0) >>> 0)
      : 0;
    S2C_QueueByteDwordPacket6_6FCAC3B0_113c(
      m,
      0x7c,
      m.u8(pSourceItem) & 0xff,
      m.u32((pSourceItem + 0x0c) >>> 0) >>> 0,
      pClient,
    );
    ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
    return 1;
  }

  if (nSourceMode !== 0) {
    m.setU32(pErr, 1);
    return 0;
  }

  if ((ITEMS_GetItemTypeFromItem113c(m, pSourceItem) | 0) === 0x12) {
    const nSkillId = ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(m, pSourceItem) | 0;
    if (nSkillId !== -1 && (STATLIST_GetUnitStat113c(m, pSourceItem, 0x46, 0) | 0) > 0) {
      STATLIST_AddUnitStat113c(m, pSourceItem, 0x46, -1, 0);
      const pClient = (m.u32(pUnit >>> 0) >>> 0) === 0
        ? (m.u32(((UNITS_GetPlayerData113c(m, pUnit) >>> 0) + 0x9c) >>> 0) >>> 0)
        : 0;
      const dwNewQty = STATLIST_GetUnitStat113c(m, pSourceItem, 0x46, 0) >>> 0;
      NET_SendPacket0x3E_ItemStatBitStream113c(m, pSourceItem, 0, pClient, 1, 0x46, dwNewQty);
      ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c(m, pUnit, nSkillId);
      const pClient2 = (m.u32(pUnit >>> 0) >>> 0) === 0
        ? (m.u32(((UNITS_GetPlayerData113c(m, pUnit) >>> 0) + 0x9c) >>> 0) >>> 0)
        : 0;
      S2C_QueueByteDwordPacket6_6FCAC3B0_113c(
        m,
        0x7c,
        m.u8(pSourceItem) & 0xff,
        m.u32((pSourceItem + 0x0c) >>> 0) >>> 0,
        pClient2,
      );
      ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
      return 1;
    }
    ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(m, pSourceItem, pUnit, pGame);
    ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
    return 1;
  }

  const nSkillId = ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(m, pSourceItem) | 0;
  if (nSkillId !== -1) {
    ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c(m, pUnit, nSkillId);
  }
  ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(m, pSourceItem, pUnit, pGame);
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCFE870
 * @ordinalOrName SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c
 */
export function SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nExpGain: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCFE870)
  const unit = pUnit >>> 0;
  if (unit === 0) {
    return;
  }
  const dwType = m.u32(unit) >>> 0;
  if (dwType !== 0 && dwType !== 1) {
    return;
  }
  const nLevel = STATLIST_GetUnitBaseStat113c(m, unit, 0x0c, 0) | 0;
  if (dwType === 0) {
    SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c(m, pGame >>> 0, unit, nExpGain >>> 0, true, nLevel);
    return;
  }
  if (dwType === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0;
    if (pMonData === 0) {
      return;
    }
    const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0;
    if (pAiGen === 0) {
      return;
    }
    const pOwnerGame = m.u32((pAiGen + 0x28) >>> 0) >>> 0;
    if (pOwnerGame === 0) {
      return;
    }
    const dwOwnerGuid = m.u32((pAiGen + 0x2c) >>> 0) >>> 0;
    const dwOwnerType = m.u32((pAiGen + 0x30) >>> 0) | 0;
    const pOwner = SUNIT_GetServerUnit113c(m, pOwnerGame, dwOwnerType, dwOwnerGuid) >>> 0;
    if (pOwner !== 0 && (m.u32(pOwner) >>> 0) === 0) {
      HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0_113c(
        m,
        nExpGain | 0,
        pGame >>> 0,
        pOwner,
        unit,
        nLevel,
      );
    }
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FD06760
 * @ordinalOrName ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c
 */
export function ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FD06760)
  void ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c;
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0;
  if (pQuestCtrl === 0) {
    return;
  }
  let pQuestNode = m.u32(pQuestCtrl) >>> 0;
  while (pQuestNode !== 0 && (m.u32(pQuestNode) >>> 0) !== 0x1c) {
    pQuestNode = m.u32((pQuestNode + 0xf4) >>> 0) >>> 0;
  }
  if (pQuestNode === 0) {
    return;
  }
  const pQuestExt = m.u32((pQuestNode + 0x18) >>> 0) >>> 0;
  if (m.u8((pQuestExt + 0x0c) >>> 0) !== 0 || m.u8((pQuestExt + 0x0d) >>> 0) !== 0) {
    return;
  }
  m.setU8((pQuestExt + 0x0d) >>> 0, 1);
  const dwPlayerGuid = (pPlayerUnit >>> 0) !== 0 ? (m.u32((pPlayerUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff;
  m.setU32((pQuestExt + 0x10) >>> 0, dwPlayerGuid);
  QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 2, pQuestNode, 0x6fd057d0);
}

/**
 * @dll D2Game.dll
 * @va 0x6FD06850
 * @ordinalOrName ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c
 */
export function ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD06850)
  const u = pPlayer >>> 0;
  const pPlayerData = UNITS_GetPlayerData113c(m, u) >>> 0;
  const nDiff = m.u8((pGame + 0x6d) >>> 0) & 0xff;
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0d) !== 0 && u !== 0) {
    const pUnitGame = m.u32((u + 0x80) >>> 0) >>> 0;
    if (pUnitGame !== 0 && (m.u32(u) >>> 0) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, u, pUnitGame) & 0xffff;
      if (wPartyId !== 0xffff) {
        PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
          m,
          pGame >>> 0,
          wPartyId,
          ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c,
          0,
        );
      }
    }
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FD07050
 * @ordinalOrName ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c
 */
export function ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c(
  m: D2KernMemory113c,
  pQuest: number,
  _pQuestArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD07050)
  void ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c;
  const quest = pQuest >>> 0;
  if (m.u8((quest + 0x0c) >>> 0) !== 0) {
    return 1;
  }
  if (m.u8((quest + 0x09) >>> 0) === 0) {
    return 1;
  }
  m.setU8((quest + 0x0c) >>> 0, 1);
  m.setU32((quest + 0xa8) >>> 0, 0x6fd06910);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FD073C0
 * @ordinalOrName ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c
 */
export function ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FD073C0)
  const sp = k2W7B4StackPtr;
  k2W7B4StackPtr = (sp + 0x90) >>> 0;
  try {
    const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0;
    if (pQuestCtrl === 0) {
      return;
    }
    let pQuest = m.u32(pQuestCtrl) >>> 0;
    while (pQuest !== 0 && (m.u32(pQuest) >>> 0) !== 0x13) {
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0;
    }
    if (pQuest === 0 || m.u8((pQuest + 0x09) >>> 0) === 0) {
      return;
    }
    const pQuestExt = m.u32((pQuest + 0x18) >>> 0) >>> 0;
    const nCount = m.u32((pQuestExt + 0x30) >>> 0) | 0;
    m.setU8((pQuestExt + 0x05) >>> 0, 1);
    if (nCount >= 6) {
      return;
    }
    const dwPlayerGuid = (pUnit >>> 0) !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff;
    for (let i = 0; i < nCount; i++) {
      if ((m.u32((pQuestExt + 0x10 + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
        return;
      }
    }
    m.setU32((pQuestExt + 0x10 + nCount * 4) >>> 0, dwPlayerGuid);
    const nNewCount = ((m.u32((pQuestExt + 0x30) >>> 0) | 0) + 1) >>> 0;
    m.setU32((pQuestExt + 0x30) >>> 0, nNewCount);
    m.setU32((pQuestExt + 0x34) >>> 0, nNewCount);

    if ((m.u8((pQuest + 0x0c) >>> 0) & 0xff) <= 1) {
      if ((m.u8((pQuest + 0x0b) >>> 0) & 0xff) !== 1) {
        m.setU8((pQuest + 0x14) >>> 0, 0);
        m.setU8((pQuest + 0x0b) >>> 0, 1);
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          m.u32((pQuest + 0x04) >>> 0) >>> 0,
          ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c,
          0,
          0,
        );
      }
    } else if ((m.u8((pQuest + 0x0b) >>> 0) & 0xff) !== 3) {
      m.setU8((pQuest + 0x14) >>> 0, 0);
      m.setU8((pQuest + 0x0b) >>> 0, 3);
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c,
        0,
        0,
      );
    }

    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
    const pCtrl2 = m.u32((pQuestGame + 0x10f4) >>> 0) >>> 0;
    if ((m.u32((pCtrl2 + 0x08) >>> 0) >>> 0) === 0) {
      FOG_DisplayAssert113c('', 'Quests.cpp', 0x82c);
      throw new D2CommonAssertError('Quests.cpp', 0x82c);
    }
    const pGlobalFlags = m.u32((pCtrl2 + 0x0c) >>> 0) >>> 0;
    const pStrBuf = (sp + 0x10) >>> 0;
    if (DRLGWARP_TestRoomTileBit113c(m, pGlobalFlags, 0x11, 0x0d) === 1) {
      m.setU8((pQuest + 0x0c) >>> 0, 4);
      writeCString113c(m, pStrBuf, 'changing state to 4\n');
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pStrBuf,
          m.u32((pQuest + 0x04) >>> 0) >>> 0,
          4,
        );
      }
    } else {
      m.setU8((pQuest + 0x0c) >>> 0, 5);
      writeCString113c(m, pStrBuf, 'changing state to 5\n');
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pStrBuf,
          m.u32((pQuest + 0x04) >>> 0) >>> 0,
          4,
        );
      }
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0) >>> 0,
      ACT3Q5_SyncCouncilQuestFlagsCallback113c,
      0,
      0,
    );
  } finally {
    k2W7B4StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FD07A40
 * @ordinalOrName ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c
 */
export function ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD07A40)
  const sp = k2W7B4StackPtr;
  k2W7B4StackPtr = (sp + 0x80) >>> 0;
  try {
    const quest = pQuest >>> 0;
    const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
    const dwPlayerGuid = pPlayer !== 0 ? (m.u32((pPlayer + 0x0c) >>> 0) >>> 0) : 0xffffffff;
    const pQuestExt = m.u32((quest + 0x18) >>> 0) >>> 0;
    QUESTS_GuidListRemove113c(m, (pQuestExt + 0x1c) >>> 0, dwPlayerGuid);
    if (m.u8((quest + 0x09) >>> 0) === 0) {
      return;
    }
    const pStrBuf = (sp + 4) >>> 0;
    m.setU8((quest + 0x0c) >>> 0, 3);
    writeCString113c(m, pStrBuf, 'changing state to 3\n');
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        pStrBuf,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        4,
      );
    }
    m.setU8((quest + 0x14) >>> 0, 0);
    m.setU8((quest + 0x0b) >>> 0, 1);
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c,
      0,
      0,
    );
  } finally {
    k2W7B4StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FD07AF0
 * @ordinalOrName ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c
 */
export function ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD07AF0)
  const sp = k2W7B4StackPtr;
  k2W7B4StackPtr = (sp + 0x84) >>> 0;
  try {
    const quest = pQuest >>> 0;
    const pQuestExt = m.u32((quest + 0x18) >>> 0) >>> 0;
    if (m.u8((quest + 0x09) >>> 0) === 0) {
      return;
    }
    if (m.u32(0x6fd31c20) !== 0) {
      if (m.u8(0x6fd1af90) === 0) {
        writeCString113c(m, 0x6fd1af90, 'tome acquired');
      }
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        0x6fd1af90,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        4,
      );
    }
    m.setU8((quest + 0x14) >>> 0, 0);
    m.setU8((quest + 0x0b) >>> 0, 2);
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((quest + 0x04) >>> 0) >>> 0,
      ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c,
      0,
      0,
    );
    const pStrBuf = (sp + 8) >>> 0;
    m.setU8((quest + 0x0c) >>> 0, 4);
    writeCString113c(m, pStrBuf, 'changing state to 4\n');
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        pStrBuf,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        4,
      );
    }
    const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
    const dwPlayerGuid = pPlayer !== 0 ? (m.u32((pPlayer + 0x0c) >>> 0) >>> 0) : 0xffffffff;
    QUESTS_GuidListAdd113c(m, (pQuestExt + 0x1c) >>> 0, dwPlayerGuid);
  } finally {
    k2W7B4StackPtr = sp;
  }
}

function fogComputeChecksum10229_113c(m: D2KernMemory113c, pData: number, nLen: number): number {
  let eax = 0;
  const len = nLen | 0;
  const base = pData >>> 0;
  for (let i = 0; i < len; i++) {
    const edx = (m.u8((base + i) >>> 0) + ((eax | 0) < 0 ? 1 : 0)) | 0;
    eax = (edx + ((eax << 1) | 0)) | 0;
  }
  return eax >>> 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FD08140
 * @ordinalOrName ACT3Q2_OnGidbinnBossKilled_6FD08140_113c
 */
export function ACT3Q2_OnGidbinnBossKilled_6FD08140_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD08140)
  const sp = k2W7B4StackPtr;
  k2W7B4StackPtr = (sp + 0x10) >>> 0;
  try {
    const quest = pQuest >>> 0;
    const arg = pQuestArg >>> 0;
    if (m.u32(0x6fd31c20) !== 0) {
      if (m.u8(0x6fd1af1c) === 0) {
        writeCString113c(m, 0x6fd1af1c, 'killed boss for quest');
      }
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        0x6fd1af1c,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        4,
      );
    }
    const pQuestExt = m.u32((quest + 0x18) >>> 0) >>> 0;
    if (m.u8((pQuestExt + 0x02) >>> 0) === 0 || m.u8((quest + 0x09) >>> 0) === 0) {
      return;
    }
    const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0;
    let isSpecialMon = false;
    if (pTarget !== 0 && (m.u32(pTarget) >>> 0) === 1) {
      const pMonData = m.u32((pTarget + 0x14) >>> 0) >>> 0;
      if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 0x0e) !== 0) {
        isSpecialMon = true;
      }
    }
    if (!isSpecialMon) {
      if (MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pTarget) === 0) {
        return;
      }
    }
    const pDropUnit = m.u32((arg + 0x08) >>> 0) >>> 0;
    m.setU32((pDropUnit + 0xb8) >>> 0, 0x20333367);
    const pDropped =
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        m.u32((arg + 0x08) >>> 0) >>> 0,
        2,
        sp,
        0,
        -1,
        0,
      ) >>> 0;
    if (pDropped !== 0) {
      m.setU8(pQuestExt, 1);
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
        0,
        0,
      );
      m.setU32((quest + 0xc0) >>> 0, 0);
      return;
    }
    m.setU8((pQuestExt + 0x02) >>> 0, 0);
  } finally {
    k2W7B4StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FD0C7F0
 * @ordinalOrName PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c
 */
export function PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
  pOutBuf: number,
  pOutSize: number,
  nMaxBufSize: number,
  arg4: number,
  arg5: number,
): number {
  hitD2GameVa113c(0x6FD0C7F0)
  const sp = k2W7B4StackPtr;
  k2W7B4StackPtr = (sp + 0x8020) >>> 0;
  try {
    const pLocalCurPos = sp >>> 0;
    const pLocalScratchPos = (sp + 4) >>> 0;
    const pScratchBuf = (sp + 0x10) >>> 0;
    const pScratchEnd = (pScratchBuf + 0x8000) >>> 0;
    const pBufStart = pOutBuf >>> 0;
    const pBufEnd = (pBufStart + (nMaxBufSize >>> 0)) >>> 0;
    const pSizeOut = pOutSize >>> 0;

    m.setU32(pLocalCurPos, pBufStart);
    m.setU32(pLocalScratchPos, pScratchBuf);
    m.setU32(pSizeOut, 0);

    const player = pPlayerUnit >>> 0;
    const game = pGame >>> 0;
    if (player === 0 || (m.u32(player) >>> 0) !== 0) {
      m.setU32(pSizeOut, 0);
      return 2;
    }

    let err = PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c(m, player, game, pLocalCurPos, pBufEnd) | 0;
    if (err !== 0) {
      m.setU32(pSizeOut, 0);
      return err;
    }
    err = PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c(m, pBufEnd, player, pLocalCurPos) | 0;
    if (err !== 0) {
      m.setU32(pSizeOut, 0);
      return err;
    }
    err = PLAYERSAVE_WriteWaypointSection_6FD0B700_113c(m, pBufEnd, player, pLocalCurPos) | 0;
    if (err !== 0) {
      m.setU32(pSizeOut, 0);
      return err;
    }
    err = PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c(m, player, pLocalCurPos, pBufEnd) | 0;
    if (err !== 0) {
      m.setU32(pSizeOut, 0);
      return err;
    }
    err = PLAYERSAVE_WriteStatsSection_6FD0BE70_113c(m, player, pLocalCurPos, pBufEnd) | 0;
    if (err !== 0) {
      m.setU32(pSizeOut, 0);
      return err;
    }
    err = PLAYERSAVE_WriteSkillSection_6FD0BC40_113c(m, player, pLocalCurPos, pBufEnd) | 0;
    if (err !== 0) {
      m.setU32(pSizeOut, 0);
      return err;
    }

    const nRemainingAfterSkills = ((pBufEnd - (m.u32(pLocalCurPos) >>> 0)) | 0);
    err = PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c(
      m,
      pScratchEnd,
      arg5,
      arg4,
      pLocalScratchPos,
      game,
      player,
      1,
    ) | 0;
    if (err !== 0) {
      m.setU32(pSizeOut, 0);
      return err;
    }
    const nPlayerItemsScratchBytes = (((m.u32(pLocalScratchPos) >>> 0) - pScratchBuf) | 0);
    err = PLAYERSAVE_WriteCorpseSection_6FD0C260_113c(
      m,
      game,
      player,
      pLocalScratchPos,
      pScratchEnd,
      arg5,
      1,
    ) | 0;
    if (err !== 0) {
      m.setU32(pSizeOut, 0);
      return err;
    }
    if ((m.u32((game + 0x70) >>> 0) >>> 0) !== 0) {
      err = PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c(
        m,
        game,
        player,
        pLocalScratchPos,
        pScratchEnd,
        arg5,
        1,
      ) | 0;
      if (err !== 0) {
        m.setU32(pSizeOut, 0);
        return err;
      }
      err = PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c(
        m,
        game,
        player,
        pLocalScratchPos,
        pScratchEnd,
        arg5,
        1,
      ) | 0;
      if (err !== 0) {
        m.setU32(pSizeOut, 0);
        return err;
      }
    }

    const nTotalScratchBytes = (((m.u32(pLocalScratchPos) >>> 0) - pScratchBuf) | 0);
    let pPlayerItemsEnd = pBufEnd;
    if (nTotalScratchBytes > nRemainingAfterSkills) {
      pPlayerItemsEnd = (
        nPlayerItemsScratchBytes -
        nTotalScratchBytes +
        nRemainingAfterSkills +
        (m.u32(pLocalCurPos) >>> 0)
      ) >>> 0;
    }

    err = PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c(
      m,
      pPlayerItemsEnd,
      arg5,
      arg4,
      pLocalCurPos,
      game,
      player,
      0,
    ) | 0;
    if (err !== 0) {
      m.setU32(pSizeOut, 0);
      return err;
    }
    err = PLAYERSAVE_WriteCorpseSection_6FD0C260_113c(
      m,
      game,
      player,
      pLocalCurPos,
      pBufEnd,
      arg5,
      0,
    ) | 0;
    if (err !== 0) {
      m.setU32(pSizeOut, 0);
      return err;
    }
    if ((m.u32((game + 0x70) >>> 0) >>> 0) !== 0) {
      err = PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c(
        m,
        game,
        player,
        pLocalCurPos,
        pBufEnd,
        arg5,
        0,
      ) | 0;
      if (err !== 0) {
        m.setU32(pSizeOut, 0);
        return err;
      }
      err = PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c(
        m,
        game,
        player,
        pLocalCurPos,
        pBufEnd,
        arg5,
        0,
      ) | 0;
      if (err !== 0) {
        m.setU32(pSizeOut, 0);
        return err;
      }
    }

    const nFinalBytes = ((m.u32(pLocalCurPos) >>> 0) - pBufStart) >>> 0;
    m.setU32(pSizeOut, nFinalBytes);
    m.setU32((pBufStart + 0x08) >>> 0, nFinalBytes);
    const dwChecksum = fogComputeChecksum10229_113c(m, pBufStart, nFinalBytes);
    m.setU32((pBufStart + 0x0c) >>> 0, dwChecksum);
    return 0;
  } finally {
    k2W7B4StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FD0FB80
 * @ordinalOrName MONSTER_SpawnFallenShamanPack_6FD0FB80_113c
 */
export function MONSTER_SpawnFallenShamanPack_6FD0FB80_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nClassId: number,
  pGame: number,
  pRoom: number,
  _unusedX: number,
  _unusedY: number,
  dwSpawnFlags: number,
): number {
  hitD2GameVa113c(0x6FD0FB80)
  const unit = pUnit >>> 0;
  if ((nClassId | 0) !== 0x154 || unit === 0) {
    return 0;
  }
  const dwType1 = m.u32(unit) | 0;
  let nBaseX = 0;
  if (dwType1 === 2 || (dwType1 > 3 && dwType1 <= 5)) {
    const pStatic = m.u32((unit + 0x2c) >>> 0) >>> 0;
    nBaseX = m.u32((pStatic + 0x0c) >>> 0) | 0;
  } else {
    const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0;
    nBaseX = pPath !== 0 ? (PATH_GetPosX113c(m, pPath) | 0) : 0;
  }
  const dwType2 = m.u32(unit) | 0;
  let nBaseY = 0;
  if (dwType2 === 2 || (dwType2 > 3 && dwType2 <= 5)) {
    const pStatic = m.u32((unit + 0x2c) >>> 0) >>> 0;
    nBaseY = m.u32((pStatic + 0x10) >>> 0) | 0;
  } else {
    const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0;
    nBaseY = pPath !== 0 ? (PATH_GetPosY113c(m, pPath) | 0) : 0;
  }
  return MONSTER_SpawnPresetPackTable_6FD0F940_113c(
    m,
    0x6fd2f3c0,
    pRoom >>> 0,
    pGame >>> 0,
    nBaseX,
    nBaseY,
    0x154,
    0,
    8,
    dwSpawnFlags >>> 0,
  );
}

/**
 * @dll D2Game.dll
 * @va 0x6FD10CD0
 * @ordinalOrName PARTY_DeclareHostility_6FD10CD0_113c
 */
export function PARTY_DeclareHostility_6FD10CD0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSourcePlayer: number,
  pTargetPlayer: number,
): void {
  hitD2GameVa113c(0x6FD10CD0)
  const src = pSourcePlayer >>> 0;
  const dst = pTargetPlayer >>> 0;
  const game = pGame >>> 0;
  if (dst === src) {
    return;
  }
  if ((STATLIST_GetUnitBaseStat113c(m, src, 0x0c, 0) | 0) < 9) {
    return;
  }
  PARTY_EnableHostilityFlag08_6FD141C0_113c(m, src, game, dst);
  PARTY_EnableHostilityFlag08_6FD141C0_113c(m, dst, game, src);
  const dwTargetGuid = dst !== 0 ? (m.u32((dst + 0x0c) >>> 0) >>> 0) : 0xffffffff;
  const pClient =
    src !== 0 && (m.u32(src) >>> 0) === 0
      ? (m.u32(((UNITS_GetPlayerData113c(m, src) >>> 0) + 0x9c) >>> 0) >>> 0)
      : 0;
  NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, dwTargetGuid, pClient, 3);
}

/**
 * @dll D2Game.dll
 * @va 0x6FD10F40
 * @ordinalOrName PARTY_ToggleLootPermission_6FD10F40_113c
 */
export function PARTY_ToggleLootPermission_6FD10F40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSourcePlayer: number,
  pTargetPlayer: number,
  dwEnable: number,
  _pOutError: number = 0,
): void {
  hitD2GameVa113c(0x6FD10F40)
  const src = pSourcePlayer >>> 0;
  const dst = pTargetPlayer >>> 0;
  const game = pGame >>> 0;
  const pSrcClient =
    src !== 0 && (m.u32(src) >>> 0) === 0
      ? (m.u32(((UNITS_GetPlayerData113c(m, src) >>> 0) + 0x9c) >>> 0) >>> 0)
      : 0;
  if ((m.u8((pSrcClient + 0x0a) >>> 0) & 4) === 0) {
    return;
  }
  PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c(m, dst, src, game, 1, dwEnable >>> 0);
  let bAction = 0;
  if (src !== 0) {
    const dwClassId = m.u32((src + 0x04) >>> 0) >>> 0;
    if (dwClassId <= 1 || dwClassId === 6) {
      bAction = (dwEnable >>> 0) !== 0 ? 2 : 0x0b;
    } else {
      bAction = (dwEnable >>> 0) !== 0 ? 1 : 0x0a;
    }
  } else {
    bAction = (dwEnable >>> 0) !== 0 ? 1 : 0x0a;
  }
  const dwSourceGuid = src !== 0 ? (m.u32((src + 0x0c) >>> 0) >>> 0) : 0xffffffff;
  const pDstClient =
    dst !== 0 && (m.u32(dst) >>> 0) === 0
      ? (m.u32(((UNITS_GetPlayerData113c(m, dst) >>> 0) + 0x9c) >>> 0) >>> 0)
      : 0;
  NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, dwSourceGuid, pDstClient, bAction);
}
function FOG_DisplayAssert113c(_expr: string, _file: string, _line: number): void {}

/**
 * @dll D2Game.dll
 * @va 0x6FC8AD60
 * @ordinalOrName D2Game_6FC8AD60
 */
export function OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8AD60)
  const savedSp = k2W7B4StackPtr;
  k2W7B4StackPtr = (savedSp - 0x20) >>> 0;
  const pCoords = k2W7B4StackPtr;
  const pChildArgs = (k2W7B4StackPtr + 8) >>> 0;
  try {
    m.setU32(pChildArgs, m.u32(pOperateArgs >>> 0) >>> 0);
    m.setU32((pChildArgs + 4) >>> 0, m.u32((pOperateArgs + 4) >>> 0) >>> 0);
    m.setU32((pChildArgs + 8) >>> 0, m.u32((pOperateArgs + 8) >>> 0) >>> 0);
    m.setU32((pChildArgs + 12) >>> 0, m.u32((pOperateArgs + 12) >>> 0) >>> 0);
    m.setU32((pChildArgs + 16) >>> 0, m.u32((pOperateArgs + 16) >>> 0) >>> 0);
    PATH_GetTargetTypeAndPosition113c(m, m.u32((pOperateArgs + 4) >>> 0) >>> 0, pCoords);
    const pRoom = UNITS_GetRoom113c(m, m.u32((pOperateArgs + 4) >>> 0) >>> 0) >>> 0;
    let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0;
    while (pUnit !== 0) {
      const pObj = m.u32((pOperateArgs + 4) >>> 0) >>> 0;
      const dwType = m.u32(pUnit) >>> 0;
      const dwMode = m.u32((pUnit + 0x10) >>> 0) >>> 0;
      if (pUnit !== pObj && dwType !== 5) {
        if (dwType === 0) {
          if (dwMode !== 0x11 && UNITS_IsPointWithinRadius113c(m, pUnit, pCoords, 3) !== 0) {
            OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(
              m,
              m.u32(pOperateArgs >>> 0) >>> 0,
              m.u32((pOperateArgs + 4) >>> 0) >>> 0,
              pUnit,
              0,
            );
          }
        } else if (dwType === 1) {
          if (dwMode !== 0x0c && UNITS_IsPointWithinRadius113c(m, pUnit, pCoords, 3) !== 0) {
            OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(
              m,
              m.u32(pOperateArgs >>> 0) >>> 0,
              m.u32((pOperateArgs + 4) >>> 0) >>> 0,
              pUnit,
              0,
            );
          }
        } else if (dwType === 2) {
          if (
            pUnit !== 0 &&
            (m.u32((pUnit + 4) >>> 0) >>> 0) === 0x0b &&
            (m.u32((pUnit + 0x10) >>> 0) >>> 0) === 0
          ) {
            if ((UNITS_GetApproximateDistance113c(m, pObj, pUnit) | 0) <= 2) {
              m.setU32((pChildArgs + 4) >>> 0, pUnit);
              OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c(m, pChildArgs);
            }
          }
        }
      }
      pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0;
    }
    return 0;
  } finally {
    k2W7B4StackPtr = savedSp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8D740
 * @ordinalOrName D2Game_6FC8D740
 */
export function OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8D740)
  const pObject = m.u32((pOperateArgs + 4) >>> 0) >>> 0;
  if (pObject !== 0 && (m.u32((pObject + 0x10) >>> 0) >>> 0) !== 0) {
    return 0;
  }
  UNITS_ChangeAnimMode113c(m, pObject, 1);
  const pObject2 = m.u32((pOperateArgs + 4) >>> 0) >>> 0;
  if (pObject2 !== 0) {
    m.setU32((pObject2 + 0xc4) >>> 0, (m.u32((pObject2 + 0xc4) >>> 0) & 0xfffffffd) >>> 0);
  }
  OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c(m, pOperateArgs);
  UNITS_SetTargetUnitForDynamicUnitEx113c(m, m.u32((pOperateArgs + 4) >>> 0) >>> 0);
  const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pOperateArgs + 0x10) >>> 0) | 0) >>> 0;
  const dwFrameCnt = (m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8) >>> 0;
  const pGame = m.u32(pOperateArgs >>> 0) >>> 0;
  const dwTargetFrame = (dwFrameCnt + (m.u32((pGame + 0xa8) >>> 0) >>> 0) + 1) >>> 0;
  EVENT_SetEventFull113c(
    m,
    pGame,
    m.u32((pOperateArgs + 4) >>> 0) >>> 0,
    1,
    dwTargetFrame,
    0,
    0,
    0,
  );
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC91330
 * @ordinalOrName D2Game_6FC91330
 */
export function PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pItem: number,
): void {
  hitD2GameVa113c(0x6FC91330)
  const savedSp = k2W7B4StackPtr;
  k2W7B4StackPtr = (savedSp - 0x20) >>> 0;
  const pPkt = k2W7B4StackPtr;
  const pErrOut = (k2W7B4StackPtr + 0x10) >>> 0;
  try {
    const dwPartnerGuid = m.u32((pPlayer + 0x64) >>> 0) >>> 0;
    if (m.u8((pPlayer + 0x6c) >>> 0) !== 0 && (m.u32((pPlayer + 0x68) >>> 0) >>> 0) !== 0) {
      const pClient =
        (m.u32(pPlayer >>> 0) >>> 0) === 0
          ? m.u32(((UNITS_GetPlayerData113c(m, pPlayer) >>> 0) + 0x9c) >>> 0) >>> 0
          : 0;
      m.setU8(pPkt, 0x77);
      m.setU8((pPkt + 1) >>> 0, 0x0c);
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 2);
      return;
    }
    if ((pGame >>> 0) === 0) {
      throw new D2CommonAssertError('PlrTrade.cpp', 0x2d3);
    }
    let pPartner = m.u32((pGame + 0x1120 + ((dwPartnerGuid & 0x7f) << 2)) >>> 0) >>> 0;
    while (pPartner !== 0) {
      if ((m.u32((pPartner + 0x0c) >>> 0) >>> 0) === dwPartnerGuid) {
        break;
      }
      pPartner = m.u32((pPartner + 0xe4) >>> 0) >>> 0;
    }
    if (pPartner === 0) {
      const pClient =
        (m.u32(pPlayer >>> 0) >>> 0) === 0
          ? m.u32(((UNITS_GetPlayerData113c(m, pPlayer) >>> 0) + 0x9c) >>> 0) >>> 0
          : 0;
      m.setU8(pPkt, 0x77);
      m.setU8((pPkt + 1) >>> 0, 0x0c);
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 2);
      return;
    }
    const dwItemGuid = (pItem >>> 0) !== 0 ? m.u32((pItem + 0x0c) >>> 0) >>> 0 : 0xffffffff;
    const pPlrData0 = UNITS_GetPlayerData113c(m, pPlayer) >>> 0;
    if (pPlrData0 !== 0) {
      const pTrade0 = m.u32((pPlrData0 + 0x5c) >>> 0) >>> 0;
      if (pTrade0 !== 0) {
        let pNode = m.u32((pTrade0 + 0x08) >>> 0) >>> 0;
        while (pNode !== 0) {
          if ((m.u32(pNode) >>> 0) === dwItemGuid) {
            const dwPartnerCopyGuid = m.u32((pNode + 4) >>> 0) >>> 0;
            if (
              ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c(
                m,
                0,
                pPartner,
                pGame,
                dwPartnerCopyGuid,
                pErrOut,
                1,
                1,
                1,
              ) !== 0
            ) {
              PLRTRADE_WalkTradeItemList_6FC8FFA0_113c(m, pPlayer);
            }
            break;
          }
          pNode = m.u32((pNode + 0x08) >>> 0) >>> 0;
        }
      }
    }
    const pPlrData1 = UNITS_GetPlayerData113c(m, pPlayer) >>> 0;
    const pPlrData2 = UNITS_GetPlayerData113c(m, pPartner) >>> 0;
    const pTrade1 = m.u32((pPlrData1 + 0x5c) >>> 0) >>> 0;
    const pTrade2 = m.u32((pPlrData2 + 0x5c) >>> 0) >>> 0;
    const dwCooldownEnd = ((m.u32(0x6fd18d10) >>> 0) + 0x2710) >>> 0;
    m.setU32((pTrade1 + 0x14) >>> 0, dwCooldownEnd);
    m.setU32((pTrade2 + 0x14) >>> 0, dwCooldownEnd);
    const pClient1 =
      (m.u32(pPlayer >>> 0) >>> 0) === 0
        ? m.u32(((UNITS_GetPlayerData113c(m, pPlayer) >>> 0) + 0x9c) >>> 0) >>> 0
        : 0;
    m.setU8(pPkt, 0x77);
    m.setU8((pPkt + 1) >>> 0, 0x0e);
    NET_QueuePacketToClientBuffer113c(m, pClient1, 1, pPkt, 2);
    const pClient2 =
      (m.u32(pPartner >>> 0) >>> 0) === 0
        ? m.u32(((UNITS_GetPlayerData113c(m, pPartner) >>> 0) + 0x9c) >>> 0) >>> 0
        : 0;
    m.setU8(pPkt, 0x77);
    m.setU8((pPkt + 1) >>> 0, 0x0e);
    NET_QueuePacketToClientBuffer113c(m, pClient2, 1, pPkt, 2);
    if (
      (m.u32((pPlrData1 + 0x50) >>> 0) >>> 0) === 4 ||
      (m.u32((pPlrData2 + 0x50) >>> 0) >>> 0) === 4
    ) {
      const pCli1a =
        (m.u32(pPlayer >>> 0) >>> 0) === 0
          ? m.u32(((UNITS_GetPlayerData113c(m, pPlayer) >>> 0) + 0x9c) >>> 0) >>> 0
          : 0;
      m.setU8(pPkt, 0x79);
      m.setU8((pPkt + 1) >>> 0, 0x00);
      m.setU32((pPkt + 2) >>> 0, 0);
      NET_QueuePacketToClientBuffer113c(m, pCli1a, 1, pPkt, 6);
      const pCli1b =
        (m.u32(pPlayer >>> 0) >>> 0) === 0
          ? m.u32(((UNITS_GetPlayerData113c(m, pPlayer) >>> 0) + 0x9c) >>> 0) >>> 0
          : 0;
      m.setU8(pPkt, 0x79);
      m.setU8((pPkt + 1) >>> 0, 0x01);
      m.setU32((pPkt + 2) >>> 0, 0);
      NET_QueuePacketToClientBuffer113c(m, pCli1b, 1, pPkt, 6);
      const pCli2a =
        (m.u32(pPartner >>> 0) >>> 0) === 0
          ? m.u32(((UNITS_GetPlayerData113c(m, pPartner) >>> 0) + 0x9c) >>> 0) >>> 0
          : 0;
      m.setU8(pPkt, 0x79);
      m.setU8((pPkt + 1) >>> 0, 0x00);
      m.setU32((pPkt + 2) >>> 0, 0);
      NET_QueuePacketToClientBuffer113c(m, pCli2a, 1, pPkt, 6);
      const pCli2b =
        (m.u32(pPartner >>> 0) >>> 0) === 0
          ? m.u32(((UNITS_GetPlayerData113c(m, pPartner) >>> 0) + 0x9c) >>> 0) >>> 0
          : 0;
      m.setU8(pPkt, 0x79);
      m.setU8((pPkt + 1) >>> 0, 0x01);
      m.setU32((pPkt + 2) >>> 0, 0);
      NET_QueuePacketToClientBuffer113c(m, pCli2b, 1, pPkt, 6);
      PLRTRADE_SendTradeAcceptButtonAndSetState3_113c(m, pPlayer, pPartner, pPlrData1, pPlrData2);
    }
  } finally {
    k2W7B4StackPtr = savedSp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF62E0
 * @ordinalOrName D2Game_6FCF62E0
 */
export function ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c(
  m: D2KernMemory113c,
  pOverrideInventory: number,
  pUnit: number,
  pGame: number,
  dwItemGuid: number,
  pOutError: number,
  bSetCursorAndFlags: number,
  bSetCmdFlag20: number,
  bAllowWhenCursorFull: number,
): number {
  hitD2GameVa113c(0x6FCF62E0)
  if ((pGame >>> 0) === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x907);
  }
  if ((pUnit >>> 0) === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x908);
  }
  m.setU32(pOutError >>> 0, 0);
  const pInventory =
    (pOverrideInventory >>> 0) !== 0
      ? pOverrideInventory >>> 0
      : m.u32((pUnit + 0x60) >>> 0) >>> 0;
  if (pInventory === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x911);
  }
  if (INVENTORY_GetCursorItem113c(m, pInventory) !== 0 && (bAllowWhenCursorFull >>> 0) === 0) {
    return 0;
  }
  let pItem = m.u32((pGame + 0x1720 + ((dwItemGuid & 0x7f) << 2)) >>> 0) >>> 0;
  while (pItem !== 0) {
    if ((m.u32((pItem + 0x0c) >>> 0) >>> 0) === (dwItemGuid >>> 0)) {
      break;
    }
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0;
  }
  if (pItem === 0) {
    m.setU32(pOutError >>> 0, 1);
    return 0;
  }
  if ((m.u32(pItem) >>> 0) !== 4) {
    return 0;
  }
  if ((m.u32(pUnit >>> 0) >>> 0) === 0) {
    if (PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pUnit) === 0) {
      if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) !== 0) {
        m.setU32(pOutError >>> 0, 1);
        return 0;
      }
    }
  }
  if ((m.u32((pItem + 0x10) >>> 0) >>> 0) !== 0) {
    m.setU32(pOutError >>> 0, 1);
    return 0;
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);
  m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & 0xfffffffd) >>> 0);
  const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInventory, pItem) >>> 0;
  if (pRemoved === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x948);
  }
  if (pRemoved !== pItem) {
    throw new D2CommonAssertError('Items.cpp', 0x949);
  }
  ITEMS_DeactivateEquippedItemStats113c(m, pUnit, pItem, pGame, 0, 1);
  if (ITEMS_CanUseCharmInInventory113c(m, pItem, pUnit) !== 0) {
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit, 0);
    UNITS_SetUnitUpdateFlags113c(m, pUnit, 1);
  }
  ITEMS_OnUnequipScrollOrTome113c(m, pItem, pUnit);
  const nOldInvPage = ITEMS_GetInvPage113c(m, pItem) & 0xff;
  const dwPageArg = ((pOutError & 0xffffff00) | nOldInvPage) >>> 0;
  const nInvRecId =
    UNITS_GetInventoryRecordId113c(
      m,
      pUnit,
      dwPageArg,
      m.u32((pGame + 0x70) >>> 0) >>> 0,
    ) | 0;
  let bIsTradePage = 0;
  let bDoRemoveFromStore = 1;
  if ((m.u32(pUnit >>> 0) >>> 0) === 0) {
    if (nOldInvPage === 1) {
      bDoRemoveFromStore = 0;
    } else if (nOldInvPage === 2) {
      bIsTradePage = 1;
    }
  } else {
    bDoRemoveFromStore = 0;
  }
  const nPosY = UNIT_GetPosY113c(m, pItem) | 0;
  const nPosX = UNIT_GetPosX113c(m, pItem) | 0;
  INVENTORY_NoOpRet20113c(
    m,
    0x6fd1b14c,
    0x966,
    dwPageArg,
    nPosX,
    nPosY,
    nInvRecId,
    0,
    dwPageArg,
  );
  ITEMS_SetNodePage113c(m, pItem, dwPageArg);
  ITEMS_SetInvPage113c(m, pItem, 0xff);
  if (bDoRemoveFromStore !== 0) {
    INVENTORY_SetCursorItem113c(m, pInventory, pItem);
  }
  UNITS_ChangeAnimMode113c(m, pItem, 4);
  if ((bSetCursorAndFlags >>> 0) === 1) {
    if ((bSetCmdFlag20 >>> 0) !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x20, 1);
    }
    if (bIsTradePage === 1) {
      PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c(m, pGame, pUnit, pItem);
    }
    ITEMS_SetItemFlag113c(m, pItem, 4, 1);
    if (ITEMS_HasSocketedSubItems113c(m, pItem) !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1);
    }
    if (ITEMS_CheckCommandFlags113c(m, pItem, 0x4000, 0x979, 0x6fd1b14c) !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x4000, 0);
    }
    INVENTORY_AppendItemGuidNode113c(m, pInventory, pItem);
    UNITS_SetUnitUpdateFlags113c(m, pUnit, 1);
  }
  return 1;
}
