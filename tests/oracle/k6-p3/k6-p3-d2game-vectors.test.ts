/**
 * [K6-P3] Real-DLL D2Game.dll Hi-VA (0x6FCC0000..0x6FD142D0) Vector Suite (150 VAs).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  ACT2Q2_Callback03_LevelChanged113c,
  ACT3Q0_Callback03_LevelChanged113c,
  SUNIT_GetUnitField78_113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f150-f276-113c'
import {
  ARENA_GetPlayerArenaFlags113c,
  MONSTER_DeleteAiAndRegenEvents113c,
  SKILLS_StartPlayerSkillAnimOrCast113c,
  SUNIT_AreUnitsHostileOrUnaligned113c,
  SUNIT_CanPlayerTargetUnitWithSkill113c,
  UNITROOM_BroadcastGroundItemIfUpdated113c,
  UNITROOM_SendDroppedGroundItemToClient113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c'
import {
  MONSTER_HasAlwaysChaseFlag113c,
  SUNITDMG_FreeAttackerCombatList113c,
  SUNIT_SetUnitEventSound113c,
} from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  D2GAME_ARENA_ClearPlayerArenaFlags113c,
  D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c,
  D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c,
  D2GAME_MONSTER_HasComponentChoices113c,
  D2GAME_PARTY_EnsurePlayerRelationNode113c,
  D2GAME_PARTY_SetPlayerRelationState113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-b-113c'
import {
  C2S_CheckCoordDeltaExceeded113c,
  C2S_Packet3C_SelectSkill113c,
  C2S_UnpackAndValidateLocationPacket113c,
  C2S_UnpackAndValidateUnitPacket113c,
} from '../../../src/d2kern-113c/game/c2s-packet-113c'
import {
  SUNIT_GetNewUnitId113c,
  SUNIT_GetServerUnit113c,
  SUNIT_RemoveServerUnit113c,
} from '../../../src/d2kern-113c/game/game-strc'
import {
  ITEMS_HasSocketedSubItems113c,
  NET_SendEventMessage5A_Type0E_113c,
  PACKET_CheckUnitsInDifferentActs113c,
  SUNITDMG_GetDefenderColdEffect113c,
} from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c'
import {
  ITEMEVENT_ManaAfterKill113c,
  ITEMS_GetScrollOrTomeSkillId113c,
  ITEMS_OnEquipScrollOrTome113c,
  ITEMS_OnUnequipScrollOrTome113c,
  MONSTER_SetLastHitModeField54_113c,
  SUNIT_AreUnitsInSamePartyOrAligned113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import {
  ACT3Q1_HratliIntroActiveFilter113c,
  ACT3Q5_BlackenedTempleActiveFilter113c,
  ACT3Q6_MephistoActiveFilter113c,
  PARTY_GetPlayerRelationState113c,
  SUNIT_GetOwnerUnit113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c'
import {
  D2Game_6FCF08B0_113c,
  D2Game_6FCF0910_113c,
  D2Game_6FCF12E0_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c,
  C2S_HandlePacket4F_TradeButton_6FCF1470_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c'
import {
  MONAI_GetUnitMeleeVelocity_6FCD08A0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b5-113c'
import {
  ACT2Q2_IsQuestPastState01_6FCE1B60_113c,
  ACT4Prologue_ActiveFilter_6FCD8B50_113c,
  ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c,
  ACT4Q2_ActiveFilter_6FCD8810_113c,
  NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c,
  STATES_PurgeExpStateStatLists_6FCDC920_113c,
} from '../../../src/d2kern-113c/game/k2-w2b6-113c'
import {
  ACT2Q0_ActiveFilter_6FCE2590_113c,
  ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c,
  ACT2Q4_InitArcanePortalObject_6FCE32C0_113c,
  ACT2Q7_ActiveFilter_6FCE2750_113c,
  ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c,
} from '../../../src/d2kern-113c/game/k2-w2b7-113c'
import {
  ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c,
  ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c,
  PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c,
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b8-113c'
import {
  ITEMMODS_ApplyManaAfterKill_6FCCCBA0_113c,
  ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c,
  MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c,
  MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import {
  ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c,
  ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c,
  ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c,
  ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c,
  ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c,
} from '../../../src/d2kern-113c/game/k2-w4b8-113c'
import {
  MONAI_FindClosestLoSHostileMeleeAndRangedTargetCallback_6FCD15E0_113c,
  SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import {
  ACT2Q1_ActiveFilter_6FCE2520_113c,
  ACT2Q3_ActiveFilter_6FCE2250_113c,
  ACT2Q4_ActiveFilter_6FCE2080_113c,
  ACT2Q4_IsPalaceCellarAllowed_6FCE3260_113c,
  ACT2Q5_ActiveFilter_6FCE1E10_113c,
  ACT2Q8_ActiveFilter_6FCE25F0_113c,
  ACT2Q8_Callback00_NpcActivate_6FCE2680_113c,
  NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c,
  NPC_TransferInventoryItemsToOwner_6FCDCD90_113c,
} from '../../../src/d2kern-113c/game/k2-w5b4-113c'
import {
  ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c,
  ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c,
  ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c,
  ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c,
  ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c,
  PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c,
  PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c,
  PACKET_Srv40_RequestQuestLog_6FCEBD30_113c,
} from '../../../src/d2kern-113c/game/k2-w5b5-113c'
import {
  C2S_Packet50_DropPlayerGold_6FCEEF40_113c,
  C2S_ValidateBeltItemOwnership_6FCECDB0_113c,
  C2S_ValidateCursorItem_6FCECF70_113c,
  C2S_ValidateInventoryOrCursorItem_6FCECE20_113c,
  C2S_ValidateNpcMonsterInteract_6FCECCF0_113c,
  C2S_ValidateStoredItem_6FCECF00_113c,
  PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c,
  ITEMS_CompactBeltColumnDown_6FCF2540_113c,
  ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c,
  ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c,
  ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c,
  ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c,
  SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b7-113c'
import {
  ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c,
  ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c,
  ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c,
  ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
  ACT3Q2_GidbinnActiveFilter_6FD04500_113c,
  ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c,
  ACT3_CainIntroActiveFilter_6FD055C0_113c,
  ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b8-113c'
import {
  PARTY_SendRosterUpdateCallback_6FD0B070_113c,
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c,
} from '../../../src/d2kern-113c/game/k2-w5b9-113c'
import {
  ACT2Q2_ActiveFilter_6FCE5440_113c,
  AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c,
  ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c,
  ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c,
  ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c,
  ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c,
  C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c'
import {
  ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c,
  C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c,
  ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c,
  ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c,
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c,
  PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b6-113c'
import {
  NPC_OnHealerNpcInteract_6FCDD810_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c'
import {
  C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c,
  C2S_Packet30_CancelNpcInteract_6FCED480_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import {
  C2S_Packet60_SwapWeapons_6FCEF510_113c,
  ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c,
} from '../../../src/d2kern-113c/game/k2-w8b3-113c'
import {
  ACT3Q3_OnNpcSpeechComplete_6FD07940_113c,
} from '../../../src/d2kern-113c/game/k2-w8b4-113c'
import {
  C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c,
  ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c,
} from '../../../src/d2kern-113c/game/k2-w9b2-113c'
import {
  MONSTER_ClearModeEvents113c,
  MONSTER_RegisterContinuousModeEvent113c,
  SUNIT_IsDeadOrDying113c,
} from '../../../src/d2kern-113c/game/monster-events'
import {
  MONREG_IncrementSpawnCount113c,
  MONREG_UpdateActiveCountOnMode113c,
  MONSTER_GetDifficultyAndPlayerBonus113c,
  MONSTER_GetPlayerCountExpBonusPct113c,
  MONSTER_GetPlayerCountHpBonusPct113c,
  MONSTER_UpdateMonsterRoomAllyCount113c,
  SUNIT_IsUnitInActiveClientRoom113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import {
  UNITS_GetOctileDistanceToCoordinates113c,
} from '../../../src/d2kern-113c/game/town-npc-ai-113c'
import {
  AI_FindNearestPlayerCallback113c,
  SUNIT_FindValidNextRoomInAct113c,
} from '../../../src/d2kern-113c/game/town-runtime-gap-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  '0x6FCC09A0': (m, a) => SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC1240': (m, a) => AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCC1630': (m, a) => SKILLS_StartPlayerSkillAnimOrCast113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCCCBA0': (m, a) => ITEMMODS_ApplyManaAfterKill_6FCCCBA0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCCCDA0': (m, a) => ITEMEVENT_ManaAfterKill113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCCCF10': (m, a) => ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c(m, a[0]!, a[1]!),
  '0x6FCCF5D0': (m, a) => MONSTER_GetPlayerCountHpBonusPct113c(m, a[0]!),
  '0x6FCCF5F0': (m, a) => MONSTER_GetPlayerCountExpBonusPct113c(m, a[0]!),
  '0x6FCCF610': (m, a) => D2GAME_MONSTER_HasComponentChoices113c(m, a[0]!),
  '0x6FCCF710': (m, a) => MONSTER_SetLastHitModeField54_113c(m, a[0]!, a[1]!),
  '0x6FCCF840': (m, a) => MONSTER_GetDifficultyAndPlayerBonus113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCCF8D0': (m, a) => MONSTER_DeleteAiAndRegenEvents113c(m, a[0]!, a[1]!),
  '0x6FCD07B0': (m, a) => UNITS_GetOctileDistanceToCoordinates113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCD08A0': (m, a) => MONAI_GetUnitMeleeVelocity_6FCD08A0_113c(m, a[0]!),
  '0x6FCD0B20': (m, a) => MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c(m, a[0]!, a[1]!),
  '0x6FCD0BE0': (m, a) => MONSTER_HasAlwaysChaseFlag113c(m, a[0]!),
  '0x6FCD1400': (m, a) => MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCD15E0': (m, a) => MONAI_FindClosestLoSHostileMeleeAndRangedTargetCallback_6FCD15E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD23D0': (m, a) => ARENA_GetPlayerArenaFlags113c(m, a[0]!),
  '0x6FCD27D0': (m, a) => D2GAME_ARENA_ClearPlayerArenaFlags113c(m, a[0]!),
  '0x6FCD8810': (m, a) => ACT4Q2_ActiveFilter_6FCD8810_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD8970': (m, a) => ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD8AE0': (m, a) => ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD8B50': (m, a) => ACT4Prologue_ActiveFilter_6FCD8B50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD8B90': (m, a) => ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD8C00': (m, a) => ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c(m, a[0]!, a[1]!),
  '0x6FCD9730': (m, a) => ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c(m, a[0]!, a[1]!),
  '0x6FCD97A0': (m, a) => ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c(m, a[0]!, a[1]!),
  '0x6FCD9DE0': (m, a) => ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c(m, a[0]!, a[1]!),
  '0x6FCDA100': (m, a) => ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c(m, a[0]!, a[1]!),
  '0x6FCDB1B0': (m, a) => ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c(m, a[0]!, a[1]!),
  '0x6FCDC920': (m, a) => STATES_PurgeExpStateStatLists_6FCDC920_113c(m, a[0]!),
  '0x6FCDCB20': (m, a) => NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCDCD90': (m, a) => NPC_TransferInventoryItemsToOwner_6FCDCD90_113c(m, a[0]!, a[1]!),
  '0x6FCDCE60': (m, a) => NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCDD810': (m, a) => NPC_OnHealerNpcInteract_6FCDD810_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCE1B60': (m, a) => ACT2Q2_IsQuestPastState01_6FCE1B60_113c(m, a[0]!),
  '0x6FCE1E10': (m, a) => ACT2Q5_ActiveFilter_6FCE1E10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE1F90': (m, a) => ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c(m, a[0]!),
  '0x6FCE2080': (m, a) => ACT2Q4_ActiveFilter_6FCE2080_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE2250': (m, a) => ACT2Q3_ActiveFilter_6FCE2250_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE2520': (m, a) => ACT2Q1_ActiveFilter_6FCE2520_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE2590': (m, a) => ACT2Q0_ActiveFilter_6FCE2590_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE25F0': (m, a) => ACT2Q8_ActiveFilter_6FCE25F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE2680': (m, a) => ACT2Q8_Callback00_NpcActivate_6FCE2680_113c(m, a[0]!, a[1]!),
  '0x6FCE2720': (m, a) => ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c(m, a[0]!, a[1]!),
  '0x6FCE2750': (m, a) => ACT2Q7_ActiveFilter_6FCE2750_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE3260': (m, a) => ACT2Q4_IsPalaceCellarAllowed_6FCE3260_113c(m, a[0]!),
  '0x6FCE32C0': (m, a) => ACT2Q4_InitArcanePortalObject_6FCE32C0_113c(m, a[0]!),
  '0x6FCE3EC0': (m, a) => ACT2Q2_Callback03_LevelChanged113c(m, a[0]!, a[1]!),
  '0x6FCE4570': (m, a) => ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c(m, a[0]!, a[1]!),
  '0x6FCE4620': (m, a) => ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c(m, a[0]!, a[1]!),
  '0x6FCE4690': (m, a) => ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c(m, a[0]!, a[1]!),
  '0x6FCE4780': (m, a) => ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c(m, a[0]!, a[1]!),
  '0x6FCE4A40': (m, a) => ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c(m, a[0]!, a[1]!),
  '0x6FCE5440': (m, a) => ACT2Q2_ActiveFilter_6FCE5440_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE5DB0': (m, a) => ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c(m, a[0]!, a[1]!),
  '0x6FCE61C0': (m, a) => ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c(m, a[0]!, a[1]!),
  '0x6FCEA530': (m, a) => MONREG_UpdateActiveCountOnMode113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEA5B0': (m, a) => MONREG_IncrementSpawnCount113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEB370': (m, a) => PACKET_CheckUnitsInDifferentActs113c(m, a[0]!, a[1]!),
  '0x6FCEB690': (m, a) => C2S_CheckCoordDeltaExceeded113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEBC70': (m, a) => PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEBD30': (m, a) => PACKET_Srv40_RequestQuestLog_6FCEBD30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEBD50': (m, a) => PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCEBED0': (m, a) => NET_SendEventMessage5A_Type0E_113c(m, a[0]!),
  '0x6FCEBF50': (m, a) => C2S_UnpackAndValidateLocationPacket113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCEC9D0': (m, a) => PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCECCF0': (m, a) => C2S_ValidateNpcMonsterInteract_6FCECCF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCECDB0': (m, a) => C2S_ValidateBeltItemOwnership_6FCECDB0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCECE20': (m, a) => C2S_ValidateInventoryOrCursorItem_6FCECE20_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCECF00': (m, a) => C2S_ValidateStoredItem_6FCECF00_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCECF70': (m, a) => C2S_ValidateCursorItem_6FCECF70_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCED0E0': (m, a) => PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c(m, a[0]!, a[1]!),
  '0x6FCED480': (m, a) => C2S_Packet30_CancelNpcInteract_6FCED480_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCED630': (m, a) => C2S_UnpackAndValidateUnitPacket113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCED6D0': (m, a) => C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCEE440': (m, a) => C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEEC70': (m, a) => C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEEF40': (m, a) => C2S_Packet50_DropPlayerGold_6FCEEF40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEF480': (m, a) => C2S_Packet3C_SelectSkill113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEF510': (m, a) => C2S_Packet60_SwapWeapons_6FCEF510_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEFB30': (m, a) => C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF08B0': (m, a) => D2Game_6FCF08B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF0910': (m, a) => D2Game_6FCF0910_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF0F80': (m, a) => C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF12E0': (m, a) => D2Game_6FCF12E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF1470': (m, a) => C2S_HandlePacket4F_TradeButton_6FCF1470_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF17B0': (m, a) => ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(m, a[0]!),
  '0x6FCF1830': (m, a) => D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c(m, a[0]!, a[1]!),
  '0x6FCF1890': (m, a) => D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c(m, a[0]!, a[1]!),
  '0x6FCF1A50': (m, a) => ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF1AA0': (m, a) => ITEMS_GetScrollOrTomeSkillId113c(m, a[0]!),
  '0x6FCF1BC0': (m, a) => ITEMS_HasSocketedSubItems113c(m, a[0]!),
  '0x6FCF24B0': (m, a) => ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c(m, a[0]!),
  '0x6FCF2540': (m, a) => ITEMS_CompactBeltColumnDown_6FCF2540_113c(m, a[0]!, a[1]!),
  '0x6FCF2BE0': (m, a) => ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c(m, a[0]!, a[1]!),
  '0x6FCF31D0': (m, a) => ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF3950': (m, a) => ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF39B0': (m, a) => ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF40F0': (m, a) => UNITROOM_SendDroppedGroundItemToClient113c(m, a[0]!, a[1]!),
  '0x6FCF4360': (m, a) => ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF4550': (m, a) => UNITROOM_BroadcastGroundItemIfUpdated113c(m, a[0]!, a[1]!),
  '0x6FCF4570': (m, a) => ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, a[0]!),
  '0x6FCF4630': (m, a) => ITEMS_OnUnequipScrollOrTome113c(m, a[0]!, a[1]!),
  '0x6FCF4670': (m, a) => ITEMS_OnEquipScrollOrTome113c(m, a[0]!, a[1]!),
  '0x6FCF8DE0': (m, a) => ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c(m, a[0]!, a[1]!),
  '0x6FCFA480': (m, a) => ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c(m, a[0]!, a[1]!),
  '0x6FCFA750': (m, a) => SUNITDMG_FreeAttackerCombatList113c(m, a[0]!, a[1]!),
  '0x6FCFAE20': (m, a) => SUNITDMG_GetDefenderColdEffect113c(m, a[0]!, a[1]!),
  '0x6FCFB4C0': (m, a) => SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCFF620': (m, a) => SUNIT_FindValidNextRoomInAct113c(m, a[0]!, a[1]!),
  '0x6FCFF6C0': (m, a) => SUNIT_GetUnitField78_113c(m, a[0]!),
  '0x6FCFF780': (m, a) => D2GAME_SUNIT_GetGameFromUnit113c(m, a[0]!),
  '0x6FCFF9A0': (m, a) => SUNIT_IsUnitInActiveClientRoom113c(m, a[0]!),
  '0x6FCFF9C0': (m, a) => SUNIT_GetNewUnitId113c(m, a[0]!, a[1]!),
  '0x6FCFFA90': (m, a) => SUNIT_IsDeadOrDying113c(m, a[0]!),
  '0x6FCFFAE0': (m, a) => SUNIT_SetLastKillerInfo_6FCFFAE0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCFFFD0': (m, a) => SUNIT_SetUnitEventSound113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD001A0': (m, a) => MONSTER_UpdateMonsterRoomAllyCount113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD002A0': (m, a) => SUNIT_RemoveServerUnit113c(m, a[0]!, a[1]!),
  '0x6FD003A0': (m, a) => SUNIT_GetServerUnit113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD00570': (m, a) => SUNIT_AreUnitsInSamePartyOrAligned113c(m, a[0]!, a[1]!),
  '0x6FD00660': (m, a) => SUNIT_CanPlayerTargetUnitWithSkill113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD00750': (m, a) => MONSTER_ClearModeEvents113c(m, a[0]!, a[1]!),
  '0x6FD00A20': (m, a) => SUNIT_GetOwnerUnit113c(m, a[0]!, a[1]!),
  '0x6FD00A60': (m, a) => SUNIT_AreUnitsHostileOrUnaligned113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD00B40': (m, a) => MONSTER_RegisterContinuousModeEvent113c(m, a[0]!, a[1]!),
  '0x6FD028C0': (m, a) => ACT3Q6_MephistoActiveFilter113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD02AB0': (m, a) => ACT3Q5_BlackenedTempleActiveFilter113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD03000': (m, a) => ACT3Q1_HratliIntroActiveFilter113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD03E00': (m, a) => ACT3Q0_Callback03_LevelChanged113c(m, a[0]!, a[1]!),
  '0x6FD04030': (m, a) => ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD04500': (m, a) => ACT3Q2_GidbinnActiveFilter_6FD04500_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD053F0': (m, a) => ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD054C0': (m, a) => ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c(m, a[0]!, a[1]!),
  '0x6FD05540': (m, a) => ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c(m, a[0]!, a[1]!),
  '0x6FD055C0': (m, a) => ACT3_CainIntroActiveFilter_6FD055C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD055F0': (m, a) => ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c(m, a[0]!, a[1]!),
  '0x6FD056E0': (m, a) => ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c(m, a[0]!, a[1]!),
  '0x6FD05F00': (m, a) => ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD06CF0': (m, a) => ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c(m, a[0]!, a[1]!),
  '0x6FD07940': (m, a) => ACT3Q3_OnNpcSpeechComplete_6FD07940_113c(m, a[0]!, a[1]!),
  '0x6FD0AEE0': (m, a) => PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c(m, a[0]!, a[1]!),
  '0x6FD0B070': (m, a) => PARTY_SendRosterUpdateCallback_6FD0B070_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD0FE40': (m, a) => SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD101D0': (m, a) => PARTY_GetPlayerRelationState113c(m, a[0]!, a[1]!),
  '0x6FD10220': (m, a) => D2GAME_PARTY_SetPlayerRelationState113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD102F0': (m, a) => D2GAME_PARTY_EnsurePlayerRelationNode113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD11A90': (m, a) => AI_FindNearestPlayerCallback113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P3VectorRecord {
  va: string
  name: string
  caseIdx: number
  label: string
  tsArgs: number[]
  extraCaps: ExtraCapRecord[]
  retMask: string
  asserted: boolean
  assertLine: number
  ret: string
  setupTop: string
  preMem: MemRunRecord[]
  postMem: MemRunRecord[]
  heapTop: string
  heapHex: string
}

const D2COM_PREF_BASE = 0x6fd50000
const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_CS_GAME = 0x30010000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

class CoWSparseMemory113c extends SparseMemory113c {
  private readonly basePages = new Map<number, Uint8Array>()
  private readonly baseKnown = new Map<number, Uint8Array>()
  private readonly overlayPages = new Map<number, Uint8Array>()
  private readonly overlayKnown = new Map<number, Uint8Array>()
  private heapCursor = HEAP_BASE

  commitOverlayToBase(): void {
    for (const [pg, data] of this.overlayPages.entries()) {
      this.basePages.set(pg, data)
      this.baseKnown.set(pg, this.overlayKnown.get(pg)!)
    }
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  resetOverlay(): void {
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  getHeapTop(): number {
    return this.heapCursor >>> 0
  }

  override alloc(size: number): number {
    const effSize = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    if (p > this.heapCursor) {
      this.fill(this.heapCursor, p - this.heapCursor, 0)
    }
    this.fill(p, effSize, 0)
    this.heapCursor = (p + effSize) >>> 0
    return p
  }

  override loadBlock(addr: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.setU8((addr + i) >>> 0, data[i]!)
    }
  }

  override readBytes(addr: number, len: number): Uint8Array {
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      out[i] = this.u8((addr + i) >>> 0)
    }
    return out
  }

  override u8(p: number): number {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    const ok = this.overlayKnown.get(pg)
    if (ok !== undefined && ok[off] !== 0) {
      return this.overlayPages.get(pg)![off]!
    }
    const bk = this.baseKnown.get(pg)
    if (bk !== undefined && bk[off] !== 0) {
      return this.basePages.get(pg)![off]!
    }
    throw new Error(`CoWSparseMemory113c: read of unloaded byte 0x${addr.toString(16)}`)
  }

  override u16(p: number): number {
    return this.u8(p) | (this.u8((p + 1) >>> 0) << 8)
  }

  override u32(p: number): number {
    return (this.u16(p) | (this.u16((p + 2) >>> 0) << 16)) >>> 0
  }

  override setU8(p: number, v: number): void {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    let od = this.overlayPages.get(pg)
    let ok = this.overlayKnown.get(pg)
    if (od === undefined || ok === undefined) {
      const bd = this.basePages.get(pg)
      const bk = this.baseKnown.get(pg)
      od = bd !== undefined ? bd.slice() : new Uint8Array(PAGE_SIZE)
      ok = bk !== undefined ? bk.slice() : new Uint8Array(PAGE_SIZE)
      this.overlayPages.set(pg, od)
      this.overlayKnown.set(pg, ok)
    }
    od[off] = v & 0xff
    ok[off] = 1
  }

  override setU16(p: number, v: number): void {
    this.setU8(p, v & 0xff)
    this.setU8((p + 1) >>> 0, (v >>> 8) & 0xff)
  }

  override setU32(p: number, v: number): void {
    this.setU16(p, v & 0xffff)
    this.setU16((p + 2) >>> 0, (v >>> 16) & 0xffff)
  }

  override fill(p: number, len: number, v: number): void {
    const byte = v & 0xff
    for (let i = 0; i < len; i++) {
      this.setU8((p + i) >>> 0, byte)
    }
  }

  override get(base: number, f: FieldLayout113c, index = 0): number {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }

  override set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }
}

const HEX_CHARS = '0123456789abcdef'

function hexToBytes(hex: string): Uint8Array {
  const n = hex.length >>> 1
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    out += HEX_CHARS[(b >>> 4) & 0x0f]! + HEX_CHARS[b & 0x0f]!
  }
  return out
}

function extractMemRunsRange(
  mem: CoWSparseMemory113c,
  startAddr: number,
  endAddr: number,
  out: MemRunRecord[],
): void {
  let a = startAddr >>> 0
  const end = endAddr >>> 0
  while (a < end) {
    const chunkEnd = a + 16 <= end ? a + 16 : end
    let nz = false
    for (let k = a; k < chunkEnd; k++) {
      if (mem.u8(k) !== 0) {
        nz = true
        break
      }
    }
    if (!nz) {
      a = chunkEnd
      continue
    }
    const runStart = a
    let runEnd = chunkEnd
    while (runEnd < end && runEnd - runStart < 512) {
      const nextEnd = runEnd + 16 <= end ? runEnd + 16 : end
      let nextNz = false
      for (let k = runEnd; k < nextEnd; k++) {
        if (mem.u8(k) !== 0) {
          nextNz = true
          break
        }
      }
      if (!nextNz) break
      runEnd = nextEnd
    }
    const addrHex = `0x${runStart.toString(16).toUpperCase().padStart(8, '0')}`
    const hex = bytesToHex(mem.readBytes(runStart, runEnd - runStart))
    out.push({ addr: addrHex, hex })
    a = runEnd
  }
}

function extractStageRuns(
  mem: CoWSparseMemory113c,
  setupTop: number,
  extraCaps: readonly ExtraCapRecord[],
): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6P3VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p3/k6-p3-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P3VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P3VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6-P3] Real-DLL D2Game.dll 0x6FCC0000..0x6FD142D0 Vector Suite (150 VAs)', () => {
  let mem: CoWSparseMemory113c

  beforeAll(() => {
    const imgPath = resolve(
      import.meta.dirname,
      '../../fixtures/oracle/k1/d2game-datatbls-113c.img.gz',
    )
    const raw = gunzipSync(readFileSync(imgPath))
    const hdr = parseVectorHeader(raw)
    expect(hdr.kind).toBe('PAGEIMG')
    expect(hdr.recordSize).toBe(4100)

    mem = new CoWSparseMemory113c()
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    let off = 32
    for (let i = 0; i < hdr.recordCount; i++) {
      const va = view.getUint32(off, true) >>> 0
      mem.loadBlock(va, raw.subarray(off + 4, off + 4 + 4096))
      off += 4100
    }
    // Pre-zero D2Game .rdata/.bss regions before binding canonical globals
    mem.fill(0x6fd19f00, 0x3100, 0)
    mem.fill(0x6fd22000, 0x10000, 0)
    bindK2KernelGlobals113c(mem)
    // Hydrate SGPT_ITEMS_LINKER_PTR_VA (0x6FDEFF6C) from loaded Items.txt rows
    const nItems = mem.u32(0x6fdefb94) >>> 0
    const pItems = mem.u32(0x6fdefb98) >>> 0
    if (nItems > 0 && nItems < 4096 && pItems !== 0) {
      const nodes: Array<{ code: number; row: number }> = []
      for (let r = 0; r < nItems; r++) {
        const code = mem.u32((pItems + r * 0x1a8 + 0x80) >>> 0) >>> 0
        nodes.push({ code, row: r })
      }
      nodes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.row - b.row))
      const hdrVa = 0x20fe0000
      const nodesVa = 0x20fe0010
      mem.setU32(hdrVa, nItems)
      mem.setU32((hdrVa + 4) >>> 0, 0)
      mem.setU32((hdrVa + 8) >>> 0, nodesVa)
      for (let i = 0; i < nodes.length; i++) {
        mem.setU32((nodesVa + i * 8) >>> 0, nodes[i]!.code)
        mem.setU32((nodesVa + i * 8 + 4) >>> 0, nodes[i]!.row >>> 0)
      }
      mem.setU32(0x6fdeff6c, hdrVa)
    }
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.fill(STAGE_CS_GAME, 0x20, 0)
    mem.fill(0x28000000, 0x10, 0)
    mem.setU32(0x28000004, 1)
    // Initialize known-zero D2Game global regions referenced by save/combat/AI paths
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f80, 0x20, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 150 target real-DLL D2Game Hi-VAs in 0x6FCC0000..0x6FD142D0 (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(150)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fcc0000)
      expect(num).toBeLessThanOrEqual(0x6fd142d0)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    const vaNum = Number.parseInt(va, 16) >>> 0
    const modPrefix = vaNum >= D2COM_PREF_BASE ? 'D2Common' : 'D2Game'

    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const cap of vec.extraCaps) {
          const capStart = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capStart, cap.len, 0)
        }
        for (const blk of vec.preMem) {
          const addr = Number.parseInt(blk.addr, 16) >>> 0
          mem.loadBlock(addr, hexToBytes(blk.hex))
        }

        beginVaTrace113c()
        let retVal: unknown = 0
        let caughtErr: unknown = null
        try {
          retVal = fn!(mem, vec.tsArgs)
        } catch (err) {
          caughtErr = err
        }
        const hits = endVaTrace113c()
        expect(
          hits.has(`${modPrefix}:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit ${modPrefix}:${va}`,
        ).toBe(true)

        if (vec.asserted) {
          expect(
            caughtErr,
            `${va} case ${vec.caseIdx} (${vec.label}) expected D2CommonAssertError(${vec.assertLine})`,
          ).toBeInstanceOf(D2CommonAssertError)
          expect((caughtErr as D2CommonAssertError).line).toBe(vec.assertLine)
          continue
        }

        if (caughtErr !== null) {
          throw new Error(
            `${va} case ${vec.caseIdx} (${vec.label}) threw unexpected error: ${String(caughtErr)}`,
          )
        }

        const retMask = Number.parseInt(vec.retMask, 16) >>> 0
        if (retMask !== 0) {
          const actualMasked = ((Number(retVal) | 0) & retMask) >>> 0
          const expectedMasked = Number.parseInt(vec.ret, 16) >>> 0
          expect(
            actualMasked,
            `${va} case ${vec.caseIdx} (${vec.label}) return mismatch: got 0x${actualMasked.toString(16)} expected 0x${expectedMasked.toString(16)}`,
          ).toBe(expectedMasked)
        }

        const actualPostMem = extractStageRuns(mem, setupTop, vec.extraCaps)
        expect(
          actualPostMem,
          `${va} case ${vec.caseIdx} (${vec.label}) staged arena memory mismatch`,
        ).toEqual(vec.postMem)

        if (vec.heapHex.length > 0) {
          const expectedHeapTop = Number.parseInt(vec.heapTop, 16) >>> 0
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) heapTop mismatch`,
          ).toBe(expectedHeapTop)
          const rawHeapBytes = mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE)
          const actualHeapHex = bytesToHex(rawHeapBytes)
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        } else {
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) unexpected heap allocation (expected zero heap drift)`,
          ).toBe(HEAP_BASE)
        }
      }
    })
  }
})
