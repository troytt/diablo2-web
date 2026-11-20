/**
 * K4 longitudinal Act 1-5 quest & town NPC replay bridge in pure SparseMemory113c.
 *
 * Wires already-ported D2Game.dll / D2Common.dll v1.13c functions for:
 * 1. Town NPC AI think dispatch (0x6FC3DB40, 0x6FC3BC60, 0x6FCBCB00, 0x6FC39880, 0x6FCCA4D0)
 * 2. Act 1-5 quest descriptor initialization (0x6FC548A0 + 0x6FD2DBF0 / 0x6FD2DF6C tables),
 *    active NPC quest-alert filters (+0xEC), and callback dispatch (+0xA0..+0xD8)
 * 3. C2S quest & consumable handlers (0x13, 0x2F, 0x31, 0x30, 0x20)
 * 4. F2 snapshot hydration of player .d2s quest/intro bit-buffers, pQuestControl (+0x10F4),
 *    NPC interaction heads (+0x30), and DRLG preset MapAI waypoint chains (+0x38)
 */
import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../common/inline-helpers.ts'
import {
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
} from '../common/inventory.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record.ts'
import {
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import {
  D2AiGeneralStrc,
  D2DynamicPathStrc,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2MonsterDataStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import {
  SGPT_ITEMS_LINKER_PTR_VA,
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
} from '../tables/datatbls-113c.ts'
import { registerK4QuestCallbackDispatcher113c } from './a1c-post150-f150-f276-113c.ts'
import { SUNIT_HASH_OFFSET_BY_TYPE_113C } from './game-strc.ts'
import { bindK2KernelGlobals113c } from './k2-d2tv-evaluators-113c.ts'
import { QUESTS_GetQuestData_6FC53F30_113c } from './k2-laneJ-0x6fc4-w1-113c.ts'
import {
  ACT5Q1_ActiveFilter_6FC76D80_113c,
  ACT5Q2_ActiveFilter_6FC76C40_113c,
  ACT5Q2_Callback14_PlayerJoined_6FC781A0_113c,
  ACT5Q4_ActiveFilter_6FC76840_113c,
  ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c,
  ACT5Q6_ActiveFilter_6FC76810_113c,
  ACT5Q6_Callback14_PlayerJoined_6FC77540_113c,
} from './k2-laneM-0x6fc7-w1-113c.ts'
import {
  ACT3Q0_ActiveFilter113c,
  ACT3Q1_HratliIntroActiveFilter113c,
  ACT3Q5_BlackenedTempleActiveFilter113c,
  ACT3Q6_MephistoActiveFilter113c,
  ACT3Q7_Callback14_PlayerJoined113c,
} from './k2-sunit-spawn-w1-113c.ts'
import {
  ACT1Q6_InitQuestData_6FC88060_113c,
  ACT2Q3_InitQuestData_6FCE7480_113c,
  ACT5Q4_InitQuestData_6FC7D5C0_113c,
} from './k2-w10b1-113c.ts'
import {
  ACT5Q5_InitQuestData_6FC7FB50_113c,
  C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c,
} from './k2-w11b1-113c.ts'
import { C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c } from './k2-w12b1-113c.ts'
import {
  D2Game_6FCCA4D0_113c,
  D2Game_6FCF0910_113c,
} from './k2-w13b1-113c.ts'
import {
  ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c,
  ACT1Q3_OnNpcInitCainSearch_6FC86960_113c,
  ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c,
  ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c,
  ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c,
  ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c,
  ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c,
  dispatchQuestSeqFilterF0_113c,
} from './k2-w14b1-113c.ts'
import {
  ACT1Q2_InitQuestData_6FC89130_113c,
  ACT1Q4_InitQuestData_6FC887D0_113c,
  ACT1Q5_InitQuestData_6FC87210_113c as ACT1Q3_InitMalusQuestData_6FC87210_113c,
  ACT2Q2_OnNpcSpeechComplete_6FCE7DC0_113c,
  ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c,
  ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c,
  ACT3Q2_OnNpcSpeechComplete_6FD09600_113c,
  ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c,
  ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c,
  ACT4Q2_InitQuestData_6FCDAD40_113c,
  ACT5Q2_InitQuestData_6FC7CC70_113c,
  ACT5Q3_InitQuestData_6FC7FC20_113c,
} from './k2-w15b1-113c.ts'
import {
  ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c,
  ACT2Q6_InitQuestTableRecord_6FCE9F60_113c,
  ACT3Q1_InitQuestTableRecord_6FD092D0_113c,
  ACT3Q2_InitQuestTableRecord_6FD09DC0_113c,
  ACT3Q4_InitQuestTableRecord_6FD093C0_113c,
  ACT3Q5_InitQuestTableRecord_6FD09200_113c,
  ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c,
  ACT5Q6_InitQuestTableRecord_6FC80080_113c,
} from './k2-w16b1-113c.ts'
import { ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c } from './k2-w2b2-113c.ts'
import {
  ACT4Prologue_ActiveFilter_6FCD8B50_113c,
  ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c,
  ACT4Q2_ActiveFilter_6FCD8810_113c,
} from './k2-w2b6-113c.ts'
import {
  ACT2Q0_ActiveFilter_6FCE2590_113c,
  ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c,
  ACT2Q7_ActiveFilter_6FCE2750_113c,
  ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c,
  ACT2Q8_ActiveFilter_6FCE25D0_113c,
} from './k2-w2b7-113c.ts'
import { ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c } from './k2-w2b8-113c.ts'
import {
  QUESTS_AllocAndInitGameQuests_6FC548A0_113c,
  registerK4QuestStatusFilterDispatcher113c,
} from './k2-w3b3-113c.ts'
import {
  ACT5Intro_ActiveFilter_6FC79680_113c,
  ACT5Intro_Callback00_NpcActivate_6FC796B0_113c,
  ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c,
  ACT5Q1_Callback00_NpcActivate_6FC787C0_113c,
  ACT5Q2_Callback00_NpcActivate_6FC783C0_113c,
  ACT5Q3_ActiveFilter_6FC77F50_113c,
  ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c,
  ACT5Q3_Callback11_OnPlayerConnect_6FC77E80_113c,
  ACT5Q4_Callback00_NpcActivate_6FC77A60_113c,
  ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c,
  ACT5Q5_Callback00_NpcActivate_6FC775F0_113c,
  ACT5Q6_ActiveFilter_6FC76EF0_113c,
  ACT5Q6_Callback00_NpcActivate_6FC77000_113c,
  ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c,
} from './k2-w3b5-113c.ts'
import {
  ACT1Q0_Callback00_WarrivIntroActivate_6FC82410_113c,
  ACT1Q1_Callback00_NpcActivate_6FC82220_113c,
  ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c,
  ACT1Q2_Callback00_NpcActivate_6FC81F50_113c,
  ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c,
  ACT1Q3_Callback00_NpcActivate_6FC81030_113c,
  ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c,
  ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c,
  ACT1Q5_Callback00_NpcActivate_6FC81C60_113c,
  ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c,
  ACT1Q6_Callback00_NpcActivate_6FC80A80_113c,
  ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c,
  ACT1_IntroCainActivate_6FC824D0_113c,
  ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c,
  ACT1_IntroNpcActivate_6FC82E50_113c,
} from './k2-w3b6-113c.ts'
import {
  ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c,
  PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c,
} from './k2-w4b2-113c.ts'
import {
  ACT1Q0_InitQuestDescriptor_6FC82D90_113c,
  ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c,
  ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c,
} from './k2-w4b3-113c.ts'
import {
  ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c,
  ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c,
  ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c,
  ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c,
  ACT4Q1_InitNpcDialog_6FCD9560_113c,
  ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c,
  ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c,
  ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c,
  ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c,
  ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c,
  ACT4Q3_InitNpcDialog_6FCD9070_113c,
  ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c,
} from './k2-w4b8-113c.ts'
import {
  ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c,
  ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c,
} from './k2-w5b3-113c.ts'
import {
  ACT2Q1_ActiveFilter_6FCE2520_113c,
  ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c,
  ACT2Q3_ActiveFilter_6FCE2250_113c,
  ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c,
  ACT2Q4_ActiveFilter_6FCE2080_113c,
  ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c,
  ACT2Q5_ActiveFilter_6FCE1E10_113c,
  ACT2Q5_Callback00_NpcActivate_6FCE3080_113c,
  ACT2Q6_ActiveFilter_6FCE1C20_113c,
  ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c,
  ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c,
  ACT2Q8_ActiveFilter_6FCE25F0_113c,
  ACT2Q8_Callback00_NpcActivate_6FCE2680_113c,
} from './k2-w5b4-113c.ts'
import {
  ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c,
  ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c,
  ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c,
  ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c,
  ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c,
  ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c,
  ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c,
  ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c,
  ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c,
  ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c,
  PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c,
  PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c,
  PACKET_Srv40_RequestQuestLog_6FCEBD30_113c,
} from './k2-w5b5-113c.ts'
import {
  ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c,
  ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c,
  ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c,
  ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c,
  ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c,
  ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c,
  ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c,
  ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c,
  ACT3Q2_GidbinnActiveFilter_6FD04500_113c,
  ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c,
  ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c,
  ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c,
  ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c,
  ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c,
  ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c,
  ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c,
  ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c,
  ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c,
  ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c,
  ACT3_CainIntroActiveFilter_6FD055C0_113c,
  ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c,
} from './k2-w5b8-113c.ts'
import {
  ACT2Intro_InitQuestData_6FCE5730_113c,
  ACT2Q0_InitQuestData_6FCE5690_113c,
  ACT2Q2_ActiveFilter_6FCE5440_113c,
  ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c,
  ACT2Q7_InitQuestData_6FCE5790_113c,
  ACT2Q8_InitQuestData_6FCE4880_113c,
} from './k2-w6b2-113c.ts'
import { ACT3Q0_InitQuestData_6FD05920_113c } from './k2-w6b3-113c.ts'
import {
  ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c,
  ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c,
  ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c,
  ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c,
  ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c,
  ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c,
  ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c,
  ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c,
  ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c,
  ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c,
  AI_ThinkTyraelOrIzualGhost_6FC39880_113c,
} from './k2-w6b4-113c.ts'
import {
  ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c,
  ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c,
  ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c,
  ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c,
  ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c,
  ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c,
} from './k2-w6b5-113c.ts'
import {
  ACT3Q0_InitHratliIntroQuestTable_6FD06660_113c,
  ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c,
  ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c,
  ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c,
  ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c,
} from './k2-w6b6-113c.ts'
import {
  ACT2Q5_OnScrollMessage_6FCE67C0_113c,
  ACT4Q3_OnScrollMessage_6FCDB250_113c,
} from './k2-w7b3-113c.ts'
import {
  C2S_Packet30_CancelNpcInteract_6FCED480_113c,
  C2S_Packet3A_AddStatPoint_6FCEC960_113c,
} from './k2-w7b4-113c.ts'
import {
  ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c,
  ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c,
  ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c,
  ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c,
  ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c,
  ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c,
  ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c,
} from './k2-w8b1-113c.ts'
import { ACT4Q1_OnNpcMessage_6FCDA5E0_113c } from './k2-w8b2-113c.ts'
import {
  ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c,
  ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c,
  ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c,
  ACT2Q5_InitQuestData_6FCE7080_113c,
  ACT3Q7_Callback00_NpcActivate_6FD07080_113c,
  C2S_Packet20_UseInventoryItem_6FCEF730_113c,
} from './k2-w8b3-113c.ts'
import { ACT3Q3_OnNpcSpeechComplete_6FD07940_113c } from './k2-w8b4-113c.ts'
import {
  ACT1Q1_InitQuestData_6FC85990_113c,
  ACT1Q5_InitQuestData_6FC89200_113c,
  ACT4Q1_InitQuestData_6FCDAE40_113c,
  ACT5Q1_InitQuestData_6FC7BEA0_113c,
  ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c,
} from './k2-w9b1-113c.ts'
import {
  ACT2Q1_InitQuestData_6FCE7B40_113c,
  ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c,
  ACT2Q4_InitQuestData_6FCE9400_113c,
  ACT3Q3_InitQuestData_6FD07CE0_113c,
  ACT3Q6_InitQuestData_6FD0A080_113c,
  C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c,
} from './k2-w9b2-113c.ts'
import { MON_EVENT_AI_THINK } from './monster-events.ts'
import { registerK4ReplayKernelBridge113c } from './replay-kernel-113c.ts'
import { EVENT_DeleteEventByArg14_113c } from './timer-wheel.ts'
import {
  AI_RogueTownMem113c,
  AI_SimpleMapAiNpc113c,
  AI_TownNpcMem113c,
} from './town-npc-ai-113c.ts'
import { registerK4QuestNpcAlertDispatcher113c } from './town-runtime-gap-113c.ts'

const K4_AI_TICK_PARAM_SCRATCH_VA = 0x7ff67b00
const K4_PACKET_SCRATCH_VA = 0x7f000800
const K4_QUEST_ARG_SCRATCH_VA = 0x7f000840

const ACT_TOWN_LEVEL_IDS_113C = [1, 40, 75, 103, 109] as const

function isByteAddrLoaded113c(m: Memory113c, addr: number): boolean {
  const a = addr >>> 0
  if (a === 0) return false
  const memInternal = m as unknown as { known?: Map<number, Uint8Array> }
  if (memInternal.known === undefined) return false
  const kp = memInternal.known.get(a >>> 12)
  return kp !== undefined && kp[a & 0xfff] !== 0
}

function findAsciiTag113c(bytes: Uint8Array, tag: string, minOff: number): number {
  const n = tag.length
  const end = bytes.length - n
  for (let i = minOff; i <= end; i++) {
    let match = true
    for (let k = 0; k < n; k++) {
      if (bytes[i + k] !== (tag.charCodeAt(k) & 0xff)) {
        match = false
        break
      }
    }
    if (match) return i
  }
  return -1
}

function dispatchQuestInitByVa113c(m: SparseMemory113c, pfnInit: number, pQuest: number): void {
  switch (pfnInit >>> 0) {
    // Act 1
    case 0x6fc82d90:
      ACT1Q0_InitQuestDescriptor_6FC82D90_113c(m, pQuest)
      return
    case 0x6fc85990:
      ACT1Q1_InitQuestData_6FC85990_113c(m, pQuest)
      return
    case 0x6fc89130:
      ACT1Q2_InitQuestData_6FC89130_113c(m, pQuest)
      return
    case 0x6fc87210:
      ACT1Q3_InitMalusQuestData_6FC87210_113c(m, pQuest)
      return
    case 0x6fc887d0:
      ACT1Q4_InitQuestData_6FC887D0_113c(m, pQuest)
      return
    case 0x6fc89200:
      ACT1Q5_InitQuestData_6FC89200_113c(m, pQuest)
      return
    case 0x6fc88060:
      ACT1Q6_InitQuestData_6FC88060_113c(m, pQuest)
      return
    case 0x6fc82fa0:
      ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c(m, pQuest)
      return
    case 0x6fc83cc0:
      ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c(m, pQuest)
      return
    // Act 2
    case 0x6fce5690:
      ACT2Q0_InitQuestData_6FCE5690_113c(m, pQuest)
      return
    case 0x6fce7b40:
      ACT2Q1_InitQuestData_6FCE7B40_113c(m, pQuest)
      return
    case 0x6fce7ed0:
      ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c(m, pQuest)
      return
    case 0x6fce7480:
      ACT2Q3_InitQuestData_6FCE7480_113c(m, pQuest)
      return
    case 0x6fce9400:
      ACT2Q4_InitQuestData_6FCE9400_113c(m, pQuest)
      return
    case 0x6fce7080:
      ACT2Q5_InitQuestData_6FCE7080_113c(m, pQuest)
      return
    case 0x6fce9f60:
      ACT2Q6_InitQuestTableRecord_6FCE9F60_113c(m, pQuest)
      return
    case 0x6fce5790:
      ACT2Q7_InitQuestData_6FCE5790_113c(m, pQuest)
      return
    case 0x6fce4880:
      ACT2Q8_InitQuestData_6FCE4880_113c(m, pQuest)
      return
    case 0x6fce5730:
      ACT2Intro_InitQuestData_6FCE5730_113c(m, pQuest)
      return
    // Act 3
    case 0x6fd06660:
      ACT3Q0_InitHratliIntroQuestTable_6FD06660_113c(m, pQuest)
      return
    case 0x6fd093c0:
      ACT3Q4_InitQuestTableRecord_6FD093C0_113c(m, pQuest)
      return
    case 0x6fd07ce0:
      ACT3Q3_InitQuestData_6FD07CE0_113c(m, pQuest)
      return
    case 0x6fd09dc0:
      ACT3Q2_InitQuestTableRecord_6FD09DC0_113c(m, pQuest)
      return
    case 0x6fd092d0:
      ACT3Q1_InitQuestTableRecord_6FD092D0_113c(m, pQuest)
      return
    case 0x6fd09200:
      ACT3Q5_InitQuestTableRecord_6FD09200_113c(m, pQuest)
      return
    case 0x6fd0a080:
      ACT3Q6_InitQuestData_6FD0A080_113c(m, pQuest)
      return
    case 0x6fd05920:
      ACT3Q0_InitQuestData_6FD05920_113c(m, pQuest)
      return
    case 0x6fd06700:
      ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c(m, pQuest)
      return
    // Act 4
    case 0x6fcd9d80:
      ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c(m, pQuest)
      return
    case 0x6fcdae40:
      ACT4Q1_InitQuestData_6FCDAE40_113c(m, pQuest)
      return
    case 0x6fcdc5f0:
      ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c(m, pQuest)
      return
    case 0x6fcdad40:
      ACT4Q2_InitQuestData_6FCDAD40_113c(m, pQuest)
      return
    case 0x6fcd97d0:
      ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c(m, pQuest)
      return
    // Act 5
    case 0x6fc7bea0:
      ACT5Q1_InitQuestData_6FC7BEA0_113c(m, pQuest)
      return
    case 0x6fc7cc70:
      ACT5Q2_InitQuestData_6FC7CC70_113c(m, pQuest)
      return
    case 0x6fc7fc20:
      ACT5Q3_InitQuestData_6FC7FC20_113c(m, pQuest)
      return
    case 0x6fc7d5c0:
      ACT5Q4_InitQuestData_6FC7D5C0_113c(m, pQuest)
      return
    case 0x6fc7fb50:
      ACT5Q5_InitQuestData_6FC7FB50_113c(m, pQuest)
      return
    case 0x6fc80080:
      ACT5Q6_InitQuestTableRecord_6FC80080_113c(m, pQuest)
      return
    case 0x6fc7a7c0:
      ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c(m, pQuest)
      return
    default:
      return
  }
}

export function dispatchK4QuestNpcAlert113c(
  m: Memory113c,
  pfnCheck: number,
  pQuest: number,
  pPlayer: number,
  npcClassId: number,
  pQuestFlags: number,
  pNpc: number,
): number {
  const sm = m as SparseMemory113c
  switch (pfnCheck >>> 0) {
    // Act 2
    case 0x6fce2590:
      return ACT2Q0_ActiveFilter_6FCE2590_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce2520:
      return ACT2Q1_ActiveFilter_6FCE2520_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce5440:
      return ACT2Q2_ActiveFilter_6FCE5440_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce2250:
      return ACT2Q3_ActiveFilter_6FCE2250_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce2080:
      return ACT2Q4_ActiveFilter_6FCE2080_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce1e10:
      return ACT2Q5_ActiveFilter_6FCE1E10_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce1c20:
      return ACT2Q6_ActiveFilter_6FCE1C20_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce2750:
      return ACT2Q7_ActiveFilter_6FCE2750_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce25d0:
      return ACT2Q8_ActiveFilter_6FCE25D0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce25f0:
      return ACT2Q8_ActiveFilter_6FCE25F0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    // Act 3
    case 0x6fd028a0:
      return ACT3Q0_ActiveFilter113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd03000:
      return ACT3Q1_HratliIntroActiveFilter113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd055c0:
      return ACT3_CainIntroActiveFilter_6FD055C0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd04030:
      return ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd04500:
      return ACT3Q2_GidbinnActiveFilter_6FD04500_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd04f60:
      return ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd053f0:
      return ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd02ab0:
      return ACT3Q5_BlackenedTempleActiveFilter113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd028c0:
      return ACT3Q6_MephistoActiveFilter113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    // Act 4
    case 0x6fcd8b50:
      return ACT4Prologue_ActiveFilter_6FCD8B50_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fcd8ae0:
      return ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fcd8810:
      return ACT4Q2_ActiveFilter_6FCD8810_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fcd8b90:
      return ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fcd8970:
      return ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    // Act 5
    case 0x6fc79680:
      return ACT5Intro_ActiveFilter_6FC79680_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc76d80:
      return ACT5Q1_ActiveFilter_6FC76D80_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc76c40:
      return ACT5Q2_ActiveFilter_6FC76C40_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc77f50:
      return ACT5Q3_ActiveFilter_6FC77F50_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc76840:
      return ACT5Q4_ActiveFilter_6FC76840_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc76810:
      return ACT5Q6_ActiveFilter_6FC76810_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc76ef0:
      return ACT5Q6_ActiveFilter_6FC76EF0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    default:
      return 0
  }
}

export function dispatchK4QuestCallback113c(
  m: Memory113c,
  pfnCallback: number,
  pQuest: number,
  pArg: number,
): boolean {
  const sm = m as SparseMemory113c
  switch (pfnCallback >>> 0) {
    // cbIdx 0x00: NpcActivate (+0xA0)
    case 0x6fc77000:
      ACT5Q6_Callback00_NpcActivate_6FC77000_113c(sm, pQuest, pArg)
      return true
    case 0x6fc775f0:
      ACT5Q5_Callback00_NpcActivate_6FC775F0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc77a60:
      ACT5Q4_Callback00_NpcActivate_6FC77A60_113c(sm, pQuest, pArg)
      return true
    case 0x6fc783c0:
      ACT5Q2_Callback00_NpcActivate_6FC783C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc787c0:
      ACT5Q1_Callback00_NpcActivate_6FC787C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc796b0:
      ACT5Intro_Callback00_NpcActivate_6FC796B0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7da70:
      ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c(sm, pQuest, pArg)
      return true
    case 0x6fc80a80:
      ACT1Q6_Callback00_NpcActivate_6FC80A80_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81030:
      ACT1Q3_Callback00_NpcActivate_6FC81030_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81c60:
      ACT1Q5_Callback00_NpcActivate_6FC81C60_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81f50:
      ACT1Q2_Callback00_NpcActivate_6FC81F50_113c(sm, pQuest, pArg)
      return true
    case 0x6fc82220:
      ACT1Q1_Callback00_NpcActivate_6FC82220_113c(sm, pQuest, pArg)
      return true
    case 0x6fc82410:
      ACT1Q0_Callback00_WarrivIntroActivate_6FC82410_113c(sm, pQuest, pArg)
      return true
    case 0x6fc824d0:
      ACT1_IntroCainActivate_6FC824D0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc82e50:
      ACT1_IntroNpcActivate_6FC82E50_113c(sm, pQuest, pArg)
      return true
    case 0x6fc86960:
      ACT1Q3_OnNpcInitCainSearch_6FC86960_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd8c00:
      ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd8ce0:
      ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9070:
      ACT4Q3_InitNpcDialog_6FCD9070_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9560:
      ACT4Q1_InitNpcDialog_6FCD9560_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9730:
      ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c(sm, pQuest, pArg)
      return true
    case 0x6fce2680:
      ACT2Q8_Callback00_NpcActivate_6FCE2680_113c(sm, pQuest, pArg)
      return true
    case 0x6fce2b00:
      ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c(sm, pQuest, pArg)
      return true
    case 0x6fce3080:
      ACT2Q5_Callback00_NpcActivate_6FCE3080_113c(sm, pQuest, pArg)
      return true
    case 0x6fce37f0:
      ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4320:
      ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4570:
      ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4690:
      ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4900:
      ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4ea0:
      ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce5310:
      ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c(sm, pQuest, pArg)
      return true
    case 0x6fd033a0:
      ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03970:
      ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03e30:
      ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c(sm, pQuest, pArg)
      return true
    case 0x6fd042f0:
      ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd04c90:
      ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c(sm, pQuest, pArg)
      return true
    case 0x6fd05270:
      ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c(sm, pQuest, pArg)
      return true
    case 0x6fd054c0:
      ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd055f0:
      ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c(sm, pQuest, pArg)
      return true

    // cbIdx 0x02: NpcDeactivate (+0xA8)
    case 0x6fc79be0:
      ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7a0a0:
      ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7a530:
      ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7a720:
      ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7d520:
      ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7d920:
      ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c(sm, pQuest, pArg)
      return true
    case 0x6fc83190:
      ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c(sm, pQuest, pArg)
      return true
    case 0x6fc835d0:
      ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc83870:
      ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c(sm, pQuest, pArg)
      return true
    case 0x6fc83ad0:
      ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc83c40:
      ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9de0:
      ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c(sm, pQuest, pArg)
      return true
    case 0x6fcda100:
      ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c(sm, pQuest, pArg)
      return true
    case 0x6fcdb1b0:
      ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce5a60:
      ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c(sm, pQuest, pArg)
      return true
    case 0x6fce5db0:
      ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce61c0:
      ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd06bd0:
      ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd06cf0:
      ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c(sm, pQuest, pArg)
      return true

    // cbIdx 0x0B: ScrollMessage (+0xCC)
    case 0x6fc77270:
      ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c(sm, pQuest, pArg)
      return true
    case 0x6fc797b0:
      ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7b4f0:
      ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7b7a0:
      ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7c9e0:
      ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7f200:
      ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7f5e0:
      ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc82490:
      ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c(sm, pQuest, pArg)
      return true
    case 0x6fc82f00:
      ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c(sm, pQuest, pArg)
      return true
    case 0x6fc83f90:
      ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c(sm, pQuest, pArg)
      return true
    case 0x6fc84430:
      ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c(sm, pQuest, pArg)
      return true
    case 0x6fc85260:
      ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c(sm, pQuest, pArg)
      return true
    case 0x6fc86ce0:
      ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc87000:
      ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c(sm, pQuest, pArg)
      return true
    case 0x6fc88920:
      ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd97a0:
      ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fcda5e0:
      ACT4Q1_OnNpcMessage_6FCDA5E0_113c(sm, pQuest, pArg, (mem, pq) => {
        ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c(mem, pq)
      })
      return true
    case 0x6fcdaa50:
      ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c(sm, pQuest, pArg)
      return true
    case 0x6fcdb250:
      ACT4Q3_OnScrollMessage_6FCDB250_113c(sm, pQuest, pArg)
      return true
    case 0x6fce2720:
      ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4620:
      ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4780:
      ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4a40:
      ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c(sm, pQuest, pArg)
      return true
    case 0x6fce67c0:
      ACT2Q5_OnScrollMessage_6FCE67C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce6b30:
      ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c(sm, pQuest, pArg, (mem, pq) => {
        dispatchQuestSeqFilterF0_113c(mem as SparseMemory113c, pq)
      })
      return true
    case 0x6fce6e90:
      ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c(sm, pQuest, pArg, (mem, pq) => {
        dispatchQuestSeqFilterF0_113c(mem as SparseMemory113c, pq)
      })
      return true
    case 0x6fce7dc0:
      ACT2Q2_OnNpcSpeechComplete_6FCE7DC0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce8050:
      ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(sm, pQuest, pArg)
      return true
    case 0x6fce85a0:
      ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd05540:
      ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c(sm, pQuest, pArg)
      return true
    case 0x6fd056e0:
      ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd07080:
      ACT3Q7_Callback00_NpcActivate_6FD07080_113c(sm, pQuest, pArg)
      return true
    case 0x6fd07940:
      ACT3Q3_OnNpcSpeechComplete_6FD07940_113c(sm, pQuest, pArg)
      return true
    case 0x6fd089a0:
      ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd08b60:
      ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c(sm, pQuest, pArg)
      return true
    case 0x6fd08fe0:
      ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd09600:
      ACT3Q2_OnNpcSpeechComplete_6FD09600_113c(sm, pQuest, pArg)
      return true

    // cbIdx 0x0D: PlayerStartedGame (+0xD4)
    case 0x6fc77540:
      ACT5Q6_Callback14_PlayerJoined_6FC77540_113c(sm, pQuest, pArg)
      return true
    case 0x6fc77e80:
      ACT5Q3_Callback11_OnPlayerConnect_6FC77E80_113c(sm, pQuest, pArg)
      return true
    case 0x6fc781a0:
      ACT5Q2_Callback14_PlayerJoined_6FC781A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc78930:
      ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c(sm, pQuest, pArg)
      return true
    case 0x6fc79450:
      ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7ae20:
      ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c(sm, pQuest, pArg)
      return true
    case 0x6fc808b0:
      ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc80e00:
      ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81540:
      ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81a80:
      ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81e30:
      ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c(sm, pQuest, pArg)
      return true
    case 0x6fc820e0:
      ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd8f20:
      ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9320:
      ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9830:
      ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c(sm, pQuest, pArg)
      return true
    case 0x6fce2900:
      ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c(sm, pQuest, pArg)
      return true
    case 0x6fce2dc0:
      ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce3320:
      ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c(sm, pQuest, pArg)
      return true
    case 0x6fce3a80:
      ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c(sm, pQuest, pArg)
      return true
    case 0x6fce41d0:
      ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce44e0:
      ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce72c0:
      ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03050:
      ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03120:
      ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03850:
      ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03b40:
      ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c(sm, pQuest, pArg)
      return true
    case 0x6fd049e0:
      ACT3Q7_Callback14_PlayerJoined113c(sm, pQuest, pArg)
      return true
    case 0x6fd050c0:
      ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd05450:
      ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c(sm, pQuest, pArg)
      return true
    case 0x6fd06000:
      ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c(sm, pQuest, pArg)
      return true

    default:
      return false
  }
}

export function hydrateK4QuestAndNpcState113c(
  m: Memory113c,
  pGame: number,
  saveBytes?: Uint8Array,
): void {
  if (pGame === 0) return
  if (!isByteAddrLoaded113c(m, 0x7f9c4ff0)) {
    m.setU32(0x7f9c4ff0, 0)
  }
  const sm = m as SparseMemory113c
  bindK2KernelGlobals113c(sm)

  // Hydrate pGame->pNpcControl (+0x1D24) if zeroed or unmapped
  const curNpcCtrl = m.u32((pGame + 0x1d24) >>> 0) >>> 0
  if (curNpcCtrl === 0 || !isByteAddrLoaded113c(m, curNpcCtrl)) {
    const pNpcCtrl = m.alloc(0x10) >>> 0
    const pNpcTable = m.alloc(0x40 * 0x44) >>> 0
    m.fill(pNpcCtrl, 0x10, 0)
    m.fill(pNpcTable, 0x40 * 0x44, 0)
    m.setU32(pNpcCtrl, 0x40)
    m.setU32((pNpcCtrl + 0x04) >>> 0, pNpcTable)
    m.setU32((pGame + 0x1d24) >>> 0, pNpcCtrl)
  }

  // 0. Hydrate D2ItemsTxt Fog code-lookup linker (CD2TxtLinkStrc at SGPT_ITEMS_LINKER_PTR_VA) if unmapped
  const curItemsLinker = m.u32(SGPT_ITEMS_LINKER_PTR_VA) >>> 0
  if (curItemsLinker === 0 || !isByteAddrLoaded113c(m, curItemsLinker)) {
    const nItems = m.u32(SGPT_ITEMS_TXT_COUNT_VA) | 0
    const pItemsBase = m.u32(SGPT_ITEMS_TXT_PTR_VA) >>> 0
    if (nItems > 0 && pItemsBase !== 0 && isByteAddrLoaded113c(m, pItemsBase)) {
      const codes = new Uint32Array(nItems)
      const indices = new Int32Array(nItems)
      for (let i = 0; i < nItems; i++) {
        const pRec = (pItemsBase + Math.imul(i, D2ItemsTxt_SIZE)) >>> 0
        const c = m.get(pRec, D2ItemsTxt.dwCode) >>> 0
        let pos = i
        while (pos > 0 && codes[pos - 1]! > c) {
          codes[pos] = codes[pos - 1]!
          indices[pos] = indices[pos - 1]!
          pos = (pos - 1) | 0
        }
        codes[pos] = c
        indices[pos] = i
      }
      const pLinker = m.alloc(0x10) >>> 0
      const pEntries = m.alloc(nItems * 8) >>> 0
      m.fill(pLinker, 0x10, 0)
      m.setU32(pLinker, nItems >>> 0)
      m.setU32((pLinker + 0x04) >>> 0, nItems >>> 0)
      m.setU32((pLinker + 0x08) >>> 0, pEntries)
      for (let i = 0; i < nItems; i++) {
        m.setU32((pEntries + i * 8) >>> 0, codes[i]!)
        m.setU32((pEntries + i * 8 + 4) >>> 0, indices[i]! >>> 0)
      }
      m.setU32(SGPT_ITEMS_LINKER_PTR_VA, pLinker)
    }
  }

  // Hydrate unmapped unit node chains (+0x74 pField74, +0xD8 pQuestChain) on F2 snapshot units
  for (let listIdx = 0; listIdx < 5; listIdx++) {
    const hashBase = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[listIdx]!) >>> 0
    for (let b = 0; b < 128; b++) {
      let pU = m.u32((hashBase + b * 4) >>> 0) >>> 0
      while (pU !== 0) {
        const pNode74 = m.u32((pU + 0x74) >>> 0) >>> 0
        if (pNode74 !== 0 && !isByteAddrLoaded113c(m, pNode74)) {
          m.fill(pNode74, 0x08, 0)
        }
        const pQuestChain = m.u32((pU + 0xd8) >>> 0) >>> 0
        if (pQuestChain !== 0 && !isByteAddrLoaded113c(m, pQuestChain)) {
          m.fill(pQuestChain, 0x10, 0)
        }
        pU = m.get(pU, D2UnitStrc.pGameHashNext) >>> 0
      }
    }
  }

  // 1. Hydrate player .d2s quest records (+0x10..+0x18), waypoints (+0x1c..+0x24), NPC intro (+0x60..+0x68), and inventory grids
  const wooOff =
    saveBytes !== undefined && saveBytes.length >= 0x300
      ? findAsciiTag113c(saveBytes, 'Woo!', 0x100)
      : -1
  let hasActiveSaveQuestHistory = false
  if (wooOff >= 0 && saveBytes !== undefined && wooOff + 10 + 0x60 <= saveBytes.length) {
    for (let k = 0; k < 0x60; k++) {
      if (saveBytes[wooOff + 10 + k] !== 0) {
        hasActiveSaveQuestHistory = true
        break
      }
    }
  }
  const w4Off =
    saveBytes !== undefined && saveBytes.length >= 0x300
      ? findAsciiTag113c(saveBytes, 'w4', 0x200)
      : -1

  const nItemsCnt = m.u32(SGPT_ITEMS_TXT_COUNT_VA) | 0
  const pItemsTxtBase = m.u32(SGPT_ITEMS_TXT_PTR_VA) >>> 0

  const players: number[] = []
  const plrHashBase = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[UNIT_PLAYER]!) >>> 0
  for (let b = 0; b < 128; b++) {
    let pPlr = m.u32((plrHashBase + b * 4) >>> 0) >>> 0
    while (pPlr !== 0) {
      players.push(pPlr)
      const pInv = m.u32((pPlr + 0x60) >>> 0) >>> 0
      if (pInv !== 0 && isByteAddrLoaded113c(m, pInv)) {
        const pFirstNode = m.u32((pInv + 0x2c) >>> 0) >>> 0
        if (pFirstNode !== 0 && !isByteAddrLoaded113c(m, pFirstNode)) {
          m.setU32((pInv + 0x2c) >>> 0, 0)
          m.setU32((pInv + 0x30) >>> 0, 0)
          let pIt = INVENTORY_GetFirstItem113c(m, pInv)
          let pTail = 0
          while (pIt !== 0) {
            const pNode = m.alloc(8) >>> 0
            m.setU32(pNode, m.u32((pIt + 0x0c) >>> 0))
            m.setU32((pNode + 4) >>> 0, 0)
            if (pTail === 0) {
              m.setU32((pInv + 0x2c) >>> 0, pNode)
            } else {
              m.setU32((pTail + 4) >>> 0, pNode)
            }
            pTail = pNode
            pIt = INVENTORY_GetNextItem113c(m, pIt)
          }
          m.setU32((pInv + 0x30) >>> 0, pTail)
        }
        const pGrids = m.u32((pInv + 0x14) >>> 0) >>> 0
        const nGrids = m.u32((pInv + 0x18) >>> 0) | 0
        if (pGrids !== 0 && isByteAddrLoaded113c(m, pGrids) && nGrids > 0 && nGrids <= 16) {
          for (let g = 0; g < nGrids; g++) {
            const gb = (pGrids + g * 16) >>> 0
            const gw = m.u8((gb + 8) >>> 0)
            const gh = m.u8((gb + 9) >>> 0)
            const ppItems = m.u32((gb + 0x0c) >>> 0) >>> 0
            if (ppItems !== 0 && !isByteAddrLoaded113c(m, ppItems) && gw > 0 && gh > 0) {
              m.fill(ppItems, gw * gh * 4, 0)
              let pIt = INVENTORY_GetFirstItem113c(m, pInv)
              while (pIt !== 0) {
                const pItData = m.u32((pIt + 0x14) >>> 0) >>> 0
                const pItPath = m.u32((pIt + 0x2c) >>> 0) >>> 0
                if (pItData !== 0 && pItPath !== 0) {
                  const nodePage = m.u8((pItData + 0x5c + 0x0c) >>> 0)
                  if ((nodePage - 1) === g) {
                    const ix = m.u32((pItPath + 0x0c) >>> 0) | 0
                    const iy = m.u32((pItPath + 0x10) >>> 0) | 0
                    let bw = 1
                    let bh = 1
                    if (g >= 2 && pItemsTxtBase !== 0) {
                      const icid = m.u32((pIt + 4) >>> 0) | 0
                      if (icid >= 0 && icid < nItemsCnt) {
                        const pItRec = (pItemsTxtBase + Math.imul(icid, D2ItemsTxt_SIZE)) >>> 0
                        bw = m.get(pItRec, D2ItemsTxt.nInvWidth)
                        bh = m.get(pItRec, D2ItemsTxt.nInvHeight)
                      }
                    }
                    for (let dy = 0; dy < bh; dy++) {
                      for (let dx = 0; dx < bw; dx++) {
                        const cx = (ix + dx) | 0
                        const cy = (iy + dy) | 0
                        if (cx >= 0 && cx < gw && cy >= 0 && cy < gh) {
                          m.setU32((ppItems + (cy * gw + cx) * 4) >>> 0, pIt)
                        }
                      }
                    }
                  }
                }
                pIt = INVENTORY_GetNextItem113c(m, pIt)
              }
            }
          }
        }
      }

      const pPlrData = UNITS_GetPlayerData113c(m, pPlr) >>> 0
      if (pPlrData !== 0) {
        const pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
        if (pClient !== 0) {
          for (let off = 0x200; off < 0x518; off++) {
            const addr = (pClient + off) >>> 0
            if (!isByteAddrLoaded113c(m, addr)) {
              m.setU8(addr, 0)
            }
          }
          m.setU8((pClient + 0x3d4) >>> 0, (m.u8((pClient + 0x3d4) >>> 0) | 1) & 0xff)
        }
        for (let diff = 0; diff < 3; diff++) {
          const curQ = m.u32((pPlrData + diff * 4 + 0x10) >>> 0) >>> 0
          if (curQ === 0 || !isByteAddrLoaded113c(m, curQ)) {
            const pRec = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
            const pBuf = m.u32(pRec) >>> 0
            if (wooOff >= 0 && saveBytes !== undefined && wooOff + 10 + (diff + 1) * 0x60 <= saveBytes.length) {
              const srcOff = wooOff + 10 + diff * 0x60
              for (let k = 0; k < 0x60; k++) {
                m.setU8((pBuf + k) >>> 0, saveBytes[srcOff + k]!)
              }
              // 0x6FD7D180..0x6FD7D1BF (bConvert = 1 from 0x6FC73132): clear bits 13 & 14; if bit 1 set, set bit 15
              for (let q = 0; q < 42; q++) {
                QUESTRECORD_ClearQuestState113c(m, pRec, q, 13)
                QUESTRECORD_ClearQuestState113c(m, pRec, q, 14)
                if (DRLGWARP_TestRoomTileBit113c(m, pRec, q, 1) !== 0) {
                  QUESTRECORD_SetQuestState113c(m, pRec, q, 15)
                }
              }
            }
            m.setU32((pPlrData + diff * 4 + 0x10) >>> 0, pRec)
          }

          const curWp = m.u32((pPlrData + diff * 4 + 0x1c) >>> 0) >>> 0
          if (curWp !== 0 && !isByteAddrLoaded113c(m, curWp)) {
            m.fill(curWp, 0x18, 0)
          }

        }
        if (hasActiveSaveQuestHistory && saveBytes !== undefined) {
          const isIntroSlotHydrated = (diffIdx: number): boolean => {
            const pPair = m.u32((pPlrData + diffIdx * 4 + 0x60) >>> 0) >>> 0
            if (pPair === 0 || !isByteAddrLoaded113c(m, pPair)) return false
            const pBit0 = m.u32(pPair) >>> 0
            const pBit1 = m.u32((pPair + 4) >>> 0) >>> 0
            if (pBit0 === 0 || !isByteAddrLoaded113c(m, pBit0)) return false
            if (pBit1 === 0 || !isByteAddrLoaded113c(m, pBit1)) return false
            const pBuf0 = m.u32(pBit0) >>> 0
            const pBuf1 = m.u32(pBit1) >>> 0
            return (
              pBuf0 !== 0 &&
              isByteAddrLoaded113c(m, pBuf0) &&
              pBuf1 !== 0 &&
              isByteAddrLoaded113c(m, pBuf1)
            )
          }
          if (!isIntroSlotHydrated(0) || !isIntroSlotHydrated(1) || !isIntroSlotHydrated(2)) {
            const has6c = isByteAddrLoaded113c(m, (pPlrData + 0x6c) >>> 0)
            const saved6c = has6c ? (m.u32((pPlrData + 0x6c) >>> 0) >>> 0) : 0
            PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c(sm, pPlr, pGame)
            if (has6c && saved6c !== 0) {
              m.setU32((pPlrData + 0x6c) >>> 0, saved6c)
            }
            if (w4Off >= 0 && w4Off + 4 + 48 <= saveBytes.length) {
              for (let diff = 0; diff < 3; diff++) {
                const pPair = m.u32((pPlrData + 0x60 + diff * 4) >>> 0) >>> 0
                const pBit0 = pPair !== 0 ? (m.u32(pPair) >>> 0) : 0
                const pBit1 = pPair !== 0 ? (m.u32((pPair + 4) >>> 0) >>> 0) : 0
                const pBuf0 = pBit0 !== 0 ? (m.u32(pBit0) >>> 0) : 0
                const pBuf1 = pBit1 !== 0 ? (m.u32(pBit1) >>> 0) : 0
                const introSrc = w4Off + 4 + diff * 8
                const congSrc = w4Off + 4 + 24 + diff * 8
                for (let k = 0; k < 8; k++) {
                  if (pBuf0 !== 0) m.setU8((pBuf0 + k) >>> 0, saveBytes[introSrc + k]!)
                  if (pBuf1 !== 0) m.setU8((pBuf1 + k) >>> 0, saveBytes[congSrc + k]!)
                }
              }
            }
          }
        } else {
          for (let diff = 0; diff < 3; diff++) {
            const curIntro = m.u32((pPlrData + diff * 4 + 0x60) >>> 0) >>> 0
            if (curIntro === 0 || !isByteAddrLoaded113c(m, curIntro)) {
              const pWrap = m.alloc(0x0c) >>> 0
              const pBit0 = m.alloc(0x14) >>> 0
              const pBuf0 = m.alloc(0x08) >>> 0
              const pBit1 = m.alloc(0x14) >>> 0
              const pBuf1 = m.alloc(0x08) >>> 0
              m.fill(pWrap, 0x0c, 0)
              m.fill(pBit0, 0x14, 0)
              m.fill(pBuf0, 0x08, 0)
              m.fill(pBit1, 0x14, 0)
              m.fill(pBuf1, 0x08, 0)
              m.setU32(pBit0, pBuf0)
              m.setU32((pBit0 + 4) >>> 0, 64)
              m.setU32(pBit1, pBuf1)
              m.setU32((pBit1 + 4) >>> 0, 64)
              m.setU32(pWrap, pBit0)
              m.setU32((pWrap + 4) >>> 0, pBit1)
              m.setU32((pPlrData + diff * 4 + 0x60) >>> 0, pWrap)
            }
          }
        }
      }
      pPlr = m.get(pPlr, D2UnitStrc.pGameHashNext) >>> 0
    }
  }

  // 2. Hydrate pGame->pQuestControl (+0x10F4) while preserving F2 pGame->pGameSeed (+0xD0/+0xD4)
  const curQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (curQuestCtrl === 0 || !isByteAddrLoaded113c(m, curQuestCtrl)) {
    const savedSeedLo = m.u32((pGame + 0xd0) >>> 0) >>> 0
    const savedSeedHi = m.u32((pGame + 0xd4) >>> 0) >>> 0
    QUESTS_AllocAndInitGameQuests_6FC548A0_113c(sm, pGame, {
      isBadCodePtr: () => 0,
      onQuestInit: (mem, pfnInit, pQuest) => {
        dispatchQuestInitByVa113c(mem as SparseMemory113c, pfnInit, pQuest)
      },
    })
    m.setU32((pGame + 0xd0) >>> 0, savedSeedLo)
    m.setU32((pGame + 0xd4) >>> 0, savedSeedHi)
    const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (pQuestCtrl !== 0) {
      m.setU32((pQuestCtrl + 0x08) >>> 0, 1)
      const nGameDiff = m.u8((pGame + 0x6d) >>> 0)
      const pGlobalFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
      if (players.length > 0) {
        const pFirstPlrData = UNITS_GetPlayerData113c(m, players[0]!) >>> 0
        const pFirstQuestFlags =
          pFirstPlrData !== 0
            ? (m.u32((pFirstPlrData + nGameDiff * 4 + 0x10) >>> 0) >>> 0)
            : 0
        // 0x6FC550F0..0x6FC55163: mark previously completed quests inactive in game (0x6FC54440)
        if (pFirstQuestFlags !== 0) {
          const nQuestDescs = m.u32(0x6fd2df68) | 0
          for (let qi = 0; qi < nQuestDescs; qi++) {
            const desc = (0x6fd2dbf0 + qi * 0x18) >>> 0
            if (m.u8((desc + 0x04) >>> 0) >= 5) continue
            if (m.u8((desc + 0x0c) >>> 0) !== 0) continue
            const nQuestId = m.u32((desc + 0x10) >>> 0) | 0
            const nQuestStateId = m.u32((desc + 0x14) >>> 0) | 0
            if (
              DRLGWARP_TestRoomTileBit113c(m, pFirstQuestFlags, nQuestStateId, 0) !== 0 ||
              DRLGWARP_TestRoomTileBit113c(m, pFirstQuestFlags, nQuestStateId, 15) !== 0
            ) {
              const pDoneQ = QUESTS_GetQuestData_6FC53F30_113c(sm, pGame, nQuestId) >>> 0
              if (pDoneQ !== 0) {
                m.setU8((pDoneQ + 0x09) >>> 0, 0)
                m.setU8((pDoneQ + 0x0a) >>> 0, 0)
                m.setU8((pDoneQ + 0x0b) >>> 0, 0)
              }
              if (pGlobalFlags !== 0) {
                QUESTRECORD_SetQuestState113c(m, pGlobalFlags, nQuestStateId, 15)
              }
            }
          }
        }
      }
      // 0x6FC55165..0x6FC551AD: sync player-entered quest states (cbIdx = 0x0D)
      for (let pi = 0; pi < players.length; pi++) {
        const pPlr = players[pi]!
        const pArg = K4_QUEST_ARG_SCRATCH_VA
        m.fill(pArg, 0x1c, 0)
        m.setU32(pArg, pGame >>> 0)
        m.setU32((pArg + 0x04) >>> 0, 0x0d)
        m.setU32((pArg + 0x0c) >>> 0, pPlr >>> 0)
        let pQ = m.u32(pQuestCtrl) >>> 0
        while (pQ !== 0) {
          const pfn0D = m.u32((pQ + 0xd4) >>> 0) >>> 0
          if (
            pfn0D !== 0 &&
            (hasActiveSaveQuestHistory ||
              pfn0D === 0x6fc820e0 ||
              pfn0D === 0x6fc81e30 ||
              pfn0D === 0x6fc808b0 ||
              pfn0D === 0x6fce44e0 ||
              pfn0D === 0x6fd03b40 ||
              pfn0D === 0x6fcd9320 ||
              pfn0D === 0x6fc77e80)
          ) {
            dispatchK4QuestCallback113c(m, pfn0D, pQ, pArg)
          }
          pQ = m.u32((pQ + 0xf4) >>> 0) >>> 0
        }
      }
      // 0x6FC551AF..0x6FC55323: invoke Act 1..5 root quest sequence filters (+0xF0)
      const actRootQuestIds = [1, 8, 18, 22, 31] as const
      for (let ri = 0; ri < actRootQuestIds.length; ri++) {
        const pRootQ = QUESTS_GetQuestData_6FC53F30_113c(sm, pGame, actRootQuestIds[ri]!) >>> 0
        if (pRootQ !== 0) {
          dispatchQuestSeqFilterF0_113c(sm, pRootQ)
        }
      }
    }
  }

  // 3. Collect DRLG town preset MapAI chains across active acts and mark already-active F2 rooms' presets spawned
  interface TownMapAiCandidate {
    readonly uType: number
    readonly txtId: number
    readonly wx: number
    readonly wy: number
    readonly pMapAi: number
  }
  const mapAiByAct: TownMapAiCandidate[][] = [[], [], [], [], []]
  for (let actIdx = 0; actIdx < 5; actIdx++) {
    const pAct = m.u32((pGame + 0xbc + actIdx * 4) >>> 0) >>> 0
    if (pAct === 0 || !isByteAddrLoaded113c(m, pAct)) continue
    const pDrlg = m.u32((pAct + 0x48) >>> 0) >>> 0
    if (pDrlg === 0 || !isByteAddrLoaded113c(m, pDrlg)) continue
    const townLvlId = ACT_TOWN_LEVEL_IDS_113C[actIdx]!
    for (
      let pLvl = m.u32((pDrlg + 0x47c) >>> 0) >>> 0;
      pLvl !== 0 && isByteAddrLoaded113c(m, pLvl);
      pLvl = m.u32((pLvl + 0x1ac) >>> 0) >>> 0
    ) {
      if ((m.u32((pLvl + 0x1d0) >>> 0) | 0) !== townLvlId) continue
      for (
        let rx = m.u32((pLvl + 0x10) >>> 0) >>> 0;
        rx !== 0 && isByteAddrLoaded113c(m, rx);
        rx = m.u32((rx + 0x24) >>> 0) >>> 0
      ) {
        const subX = (m.u32((rx + 0x34) >>> 0) | 0) * 5
        const subY = (m.u32((rx + 0x38) >>> 0) | 0) * 5
        const isRoomAlreadyActiveAtF2 = m.u32((rx + 0x30) >>> 0) !== 0
        for (
          let pr = m.u32((rx + 0x5c) >>> 0) >>> 0;
          pr !== 0 && isByteAddrLoaded113c(m, pr);
          pr = m.u32((pr + 0x0c) >>> 0) >>> 0
        ) {
          const pMapAi = m.u32((pr + 0x10) >>> 0) >>> 0
          if (pMapAi !== 0 && isByteAddrLoaded113c(m, pMapAi)) {
            mapAiByAct[actIdx]!.push({
              uType: m.u32((pr + 0x14) >>> 0) >>> 0,
              txtId: m.u32((pr + 0x04) >>> 0) >>> 0,
              wx: subX + (m.u32((pr + 0x08) >>> 0) | 0),
              wy: subY + (m.u32((pr + 0x18) >>> 0) | 0),
              pMapAi,
            })
          }
          if (isRoomAlreadyActiveAtF2) {
            m.setU32((pr + 0x1c) >>> 0, (m.u32((pr + 0x1c) >>> 0) | 1) >>> 0)
          }
        }
      }
    }
  }

  // 4. Hydrate F2 town monsters' unmapped pNpcInteract (+0x30) and pMapAi (+0x38)
  const monHashBase = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[UNIT_MONSTER]!) >>> 0
  for (let b = 0; b < 128; b++) {
    let pMon = m.u32((monHashBase + b * 4) >>> 0) >>> 0
    while (pMon !== 0) {
      const pMonData = m.get(pMon, D2UnitStrc.pUnitData) >>> 0
      if (pMonData !== 0 && isByteAddrLoaded113c(m, pMonData)) {
        const pInteract = m.u32((pMonData + 0x30) >>> 0) >>> 0
        if (pInteract !== 0 && !isByteAddrLoaded113c(m, pInteract)) {
          m.fill(pInteract, 0x10, 0)
        }
        const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral) >>> 0
        if (pAiGen !== 0 && isByteAddrLoaded113c(m, pAiGen)) {
          const origMapAi = m.u32((pAiGen + 0x38) >>> 0) >>> 0
          if (origMapAi !== 0 && !isByteAddrLoaded113c(m, origMapAi)) {
            const pRoom = UNITS_GetRoom113c(m, pMon) >>> 0
            const pRoomEx = pRoom !== 0 ? (m.u32((pRoom + 0x10) >>> 0) >>> 0) : 0
            const pLvl = pRoomEx !== 0 ? (m.u32((pRoomEx + 0x58) >>> 0) >>> 0) : 0
            const lvlId = pLvl !== 0 ? (m.u32((pLvl + 0x1d0) >>> 0) | 0) : 0
            let actIdx = -1
            for (let a = 0; a < 5; a++) {
              if (ACT_TOWN_LEVEL_IDS_113C[a] === lvlId) {
                actIdx = a
                break
              }
            }
            const pPath = m.get(pMon, D2UnitStrc.pPath) >>> 0
            const mx = pPath !== 0 ? (m.get(pPath, D2DynamicPathStrc.wPosX) | 0) : 0
            const my = pPath !== 0 ? (m.get(pPath, D2DynamicPathStrc.wPosY) | 0) : 0
            const cid = m.get(pMon, D2UnitStrc.dwClassId) >>> 0
            let chosenMapAi = 0
            if (actIdx >= 0) {
              const cands = mapAiByAct[actIdx]!
              let bestDist = 0x7fffffff
              for (let ci = 0; ci < cands.length; ci++) {
                const c = cands[ci]!
                if (c.uType !== 1 || c.txtId !== cid) continue
                const d = Math.abs(mx - c.wx) + Math.abs(my - c.wy)
                if (d < bestDist) {
                  bestDist = d
                  chosenMapAi = c.pMapAi
                }
              }
              if (chosenMapAi === 0 || bestDist > 32) {
                chosenMapAi = 0
                bestDist = 0x7fffffff
                for (let ci = 0; ci < cands.length; ci++) {
                  const c = cands[ci]!
                  if (c.uType !== 2) continue
                  const d = Math.abs(mx - c.wx) + Math.abs(my - c.wy)
                  if (d <= 8 && d < bestDist) {
                    bestDist = d
                    chosenMapAi = c.pMapAi
                  }
                }
              }
            }
            m.setU32((pAiGen + 0x38) >>> 0, chosenMapAi >>> 0)
          }
        }
      }
      pMon = m.get(pMon, D2UnitStrc.pGameHashNext) >>> 0
    }
  }
}

export function tryRunTownNpcThinkK4_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pfnThink: number,
): boolean {
  const va = pfnThink >>> 0
  if (
    va !== 0x6fc3db40 &&
    va !== 0x6fc3bc60 &&
    va !== 0x6fcbcb00 &&
    va !== 0x6fc39880 &&
    va !== 0x6fcca4d0
  ) {
    return false
  }
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData) >>> 0
  const pAiGen = pMonData !== 0 ? (m.get(pMonData, D2MonsterDataStrc.pAiGeneral) >>> 0) : 0
  const pMonStatsTxt = pMonData !== 0 ? (m.get(pMonData, D2MonsterDataStrc.pMonStatsTxt) >>> 0) : 0
  let pMonStats2Txt = 0
  if (pMonStatsTxt !== 0 && isByteAddrLoaded113c(m, (pMonStatsTxt + 0x08) >>> 0)) {
    const monStatsExIdx = (m.u16((pMonStatsTxt + 0x08) >>> 0) << 16) >> 16
    const pTables = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
    const pMs2Base = pTables !== 0 ? (m.u32((pTables + 0xa84) >>> 0) >>> 0) : 0
    const nMs2Count = pTables !== 0 ? (m.u32((pTables + 0xa8c) >>> 0) | 0) : 0
    if (pMs2Base !== 0 && monStatsExIdx >= 0 && monStatsExIdx < nMs2Count) {
      pMonStats2Txt = (pMs2Base + Math.imul(monStatsExIdx, 0x134)) >>> 0
    }
  }

  // 0x6FCBD3B0 (`AI_RunMonsterAI`): clears pending arg14==0 AI_THINK event and populates D2AiTickParamStrc
  EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
  const pAiTickParam = K4_AI_TICK_PARAM_SCRATCH_VA
  m.fill(pAiTickParam, 0x28, 0)
  m.setU32(pAiTickParam, pAiGen)
  m.setU32((pAiTickParam + 0x1c) >>> 0, pMonStatsTxt)
  m.setU32((pAiTickParam + 0x20) >>> 0, pMonStats2Txt)

  const sm = m as SparseMemory113c
  if (va === 0x6fc3db40) {
    AI_TownNpcMem113c(m, pGame, pMonster, pAiTickParam)
    return true
  }
  if (va === 0x6fc3bc60) {
    AI_SimpleMapAiNpc113c(m, pGame, pMonster, pAiTickParam)
    return true
  }
  if (va === 0x6fcbcb00) {
    AI_RogueTownMem113c(m, pGame, pMonster, pAiTickParam)
    return true
  }
  if (va === 0x6fc39880) {
    AI_ThinkTyraelOrIzualGhost_6FC39880_113c(sm, pGame, pMonster, pAiTickParam)
    return true
  }
  if (va === 0x6fcca4d0) {
    D2Game_6FCCA4D0_113c(sm, pGame, pMonster, pAiTickParam)
    return true
  }
  return false
}

export function tryApplyQuestAndNpcC2SPacketK4_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  packetBytes: Uint8Array,
  syncWorld: () => void,
): boolean {
  if (packetBytes.length === 0) return false
  const op = packetBytes[0]!
  if (
    op !== 0x13 &&
    op !== 0x2f &&
    op !== 0x31 &&
    op !== 0x30 &&
    op !== 0x20 &&
    op !== 0x3a &&
    op !== 0x3b &&
    op !== 0x40 &&
    op !== 0x51
  ) {
    return false
  }
  const pPkt = K4_PACKET_SCRATCH_VA
  for (let i = 0; i < packetBytes.length; i++) {
    m.setU8((pPkt + i) >>> 0, packetBytes[i]!)
  }
  const sm = m as SparseMemory113c
  const nLen = packetBytes.length
  if (op === 0x13) {
    D2Game_6FCF0910_113c(sm, pGame, pPlayer, pPkt, nLen)
  } else if (op === 0x2f) {
    C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c(sm, pGame, pPlayer, pPkt, nLen)
  } else if (op === 0x31) {
    PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c(sm, pGame, pPlayer, pPkt, nLen)
  } else if (op === 0x30) {
    C2S_Packet30_CancelNpcInteract_6FCED480_113c(sm, pGame, pPlayer, pPkt, nLen)
  } else if (op === 0x20) {
    C2S_Packet20_UseInventoryItem_6FCEF730_113c(sm, pGame, pPlayer, pPkt, nLen)
  } else if (op === 0x3a) {
    C2S_Packet3A_AddStatPoint_6FCEC960_113c(sm, pGame, pPlayer, pPkt, nLen)
  } else if (op === 0x3b) {
    C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c(sm, pGame, pPlayer, pPkt, nLen)
  } else if (op === 0x40) {
    PACKET_Srv40_RequestQuestLog_6FCEBD30_113c(sm, pGame, pPlayer, pPkt, nLen)
  } else if (op === 0x51) {
    PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c(sm, pGame, pPlayer, pPkt, nLen)
  }
  syncWorld()
  return true
}

export function executeQueuedPlayerEntityInteractK4_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  interactAction: number,
  targetType: number,
  targetId: number,
): void {
  C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c(
    m as SparseMemory113c,
    targetType >>> 0,
    pGame >>> 0,
    (interactAction | 0) === -2 ? 1 : 0,
    pPlayer >>> 0,
    targetId >>> 0,
  )
}

export function dispatchK4QuestStatusFilter113c(
  m: Memory113c,
  pfnStatus: number,
  pQuest: number,
  pPlayerUnit: number,
  pGameQuestFlags: number,
  pPlayerQuestFlags: number,
  pOutByte: number,
): number {
  const sm = m as SparseMemory113c
  if ((pfnStatus >>> 0) === 0x6fd03ce0) {
    return ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c(
      sm,
      pQuest,
      pPlayerUnit,
      pGameQuestFlags,
      pPlayerQuestFlags,
      pOutByte,
    )
  }
  return 0
}

let k4Installed = false

export function installK4QuestReplay113c(): void {
  if (k4Installed) return
  k4Installed = true
  registerK4QuestCallbackDispatcher113c(dispatchK4QuestCallback113c)
  registerK4QuestNpcAlertDispatcher113c(dispatchK4QuestNpcAlert113c)
  registerK4QuestStatusFilterDispatcher113c(dispatchK4QuestStatusFilter113c)
  registerK4ReplayKernelBridge113c({
    hydrateQuestAndNpcState: hydrateK4QuestAndNpcState113c,
    tryRunTownNpcThink: tryRunTownNpcThinkK4_113c,
    tryApplyQuestAndNpcC2SPacket: tryApplyQuestAndNpcC2SPacketK4_113c,
    executeQueuedPlayerEntityInteract: executeQueuedPlayerEntityInteractK4_113c,
  })
}
