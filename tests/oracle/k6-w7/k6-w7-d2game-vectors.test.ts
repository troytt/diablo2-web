/**
 * Milestone #37 [K6] Wave 7 — Real-DLL D2Game.dll (0x6FCC0000..0x6FD142D0)
 * Hi-VA Part 2 Differential Vector Suite.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

import {
  C2S_Packet02_WalkToUnit113c,
  C2S_Packet04_RunToUnit113c,
  C2S_Packet05_LeftSkillOnLocation113c,
  C2S_Packet07_ShiftLeftSkillOnUnit113c,
  C2S_Packet08_RepeatLeftSkillOnLocation113c,
  C2S_Packet09_RepeatLeftSkillOnUnit113c,
  C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c,
  C2S_Packet0B_Noop1Byte113c,
  C2S_Packet0E_ShiftRightSkillOnUnit113c,
  C2S_Packet0F_RepeatRightSkillOnLocation113c,
  C2S_Packet10_RepeatRightSkillOnUnit113c,
  C2S_Packet11_RepeatShiftRightSkillOnUnit113c,
} from '../../../src/d2kern-113c/game/c2s-packet-113c'
import { ITEMS_AreWeaponSlotTypesCompatible113c } from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c'
import {
  ACT3Q0_MarkWandererSeenCallback113c,
  ACT3Q3_OnKhalimsWillCubed113c,
  ACT3Q4_OnQuestUnitDeactivate113c,
  ACT3Q4_SyncTomePartyQuestStateCallback113c,
  ACT3Q5_CompleteCouncilPartyCallback113c,
  ACT3Q5_SyncCouncilQuestFlagsCallback113c,
  ACT3Q6_SyncGidbinnState02Callback113c,
  ACT3Q7_Callback14_PlayerJoined113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c'
import { C2S_Packet23_MercReviveHandler_6FCEFB90_113c } from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import {
  ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c,
  C2S_Packet_HireMercenary_6FCF0060_113c,
  C2S_Packet_NpcBuyItem_6FCEF220_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c,
  C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c,
  SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c'
import { SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c } from '../../../src/d2kern-113c/game/k2-w2b5-113c'
import { ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c } from '../../../src/d2kern-113c/game/k2-w2b7-113c'
import {
  ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c,
  PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b8-113c'
import {
  AI_TickAncientStatueRevertCheck_6FCC4F40_113c,
  SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c,
  SKILLS_CountUnitsInRadius_6FCC0FC0_113c,
  SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import {
  ARENA_UpdatePlayerArenaScore_6FCD2820_113c,
  ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c,
  MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c,
  MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c,
  MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c,
  MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c,
  MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c,
  SKILLS_RemoveAuraStateAndEvent9OnSkillChange_6FCCD050_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import {
  ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c,
  ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c,
  ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c,
  ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c,
  ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c,
  ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c,
  ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c,
  ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c,
  SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c,
  SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c,
} from '../../../src/d2kern-113c/game/k2-w4b8-113c'
import { AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c } from '../../../src/d2kern-113c/game/k2-w5b10-113c'
import { ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c } from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import {
  ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c,
  ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c,
  ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c,
  ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c,
  ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c,
  ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c,
  ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
  ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c,
  ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c,
  ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c,
  ACT2Q6_StatusFilter_6FCE1D30_113c,
  ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c,
  ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c,
  NPC_HealAndCureUnit_6FCDCBE0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b4-113c'
import {
  ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c,
  ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c,
  ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c,
  ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c,
  ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c,
  ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c,
  ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c,
  ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c,
  ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c,
  PLAYER_CalcHealingPotionPercent_6FCEB840_113c,
  PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c,
  PLAYER_IssueMercAiMoveCommand_6FCEC750_113c,
} from '../../../src/d2kern-113c/game/k2-w5b5-113c'
import { PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c } from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c,
  ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c,
  ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b7-113c'
import {
  ACT3Q2_SetGidbinnState0ECallback_6FD04280_113c,
  ACT3Q2_SetGidbinnTurnInPartyCallback_6FD041D0_113c,
  ACT3Q4_CompleteLamEsensTomePartyCallback_6FD064C0_113c,
  ACT3Q4_PropagateTomeQuestStateToSubParty_6FD06B90_113c,
  ACT3Q5_PropagateCouncilCompletionToPartyCallback_6FD06980_113c,
  ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c,
  ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c,
} from '../../../src/d2kern-113c/game/k2-w5b8-113c'
import {
  PARTY_RefreshInviteRelationNodes_6FD103E0_113c,
  PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c,
  PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c,
  PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c,
  PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c,
  PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c,
  PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c,
  PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c,
  PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c,
  PLAYERSAVE_WriteSkillSection_6FD0BC40_113c,
  PLAYERSAVE_WriteWaypointSection_6FD0B700_113c,
  SKILLS_ResolveTriggeredCorpseTarget_6FD11490_113c,
} from '../../../src/d2kern-113c/game/k2-w5b9-113c'
import {
  ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c,
  ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c,
  ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c,
  ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c,
  ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c,
  ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c,
  NET_BroadcastSystemChatMessage_6FCEBE70_113c,
  PACKET_SrvMercMoveToCoord_6FCED360_113c,
  PACKET_SrvMercMoveToUnit_6FCED3D0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import {
  ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c,
  ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c,
  ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c,
  ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c,
  ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c,
  ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c,
  NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c'
import {
  ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c,
  ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c,
  ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c,
  ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c,
  ACT3Q5_OnOrmusActivatedSendTravincalAlert_6FD069E0_113c,
  ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c,
  ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c,
  ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c,
  C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c,
  PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c,
} from '../../../src/d2kern-113c/game/k2-w6b6-113c'
import {
  PARTY_CancelPartyInvitation_6FD10900_113c,
  PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c,
} from '../../../src/d2kern-113c/game/k2-w6b7-113c'
import {
  ACT2Q3_StartEclipseEvent_6FCE6A30_113c,
  ACT2Q6_PropagatePartyCompletionCallback_6FCE65A0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c'
import {
  ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c,
  C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c,
  C2S_Packet28_SocketItem_6FCEEBD0_113c,
  C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c,
  C2S_Packet34_CainIdentifyItems_6FCEF070_113c,
  ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import {
  ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c,
  ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c,
  ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c,
  C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c,
  C2S_Packet21_MergeStackableItems_6FCEE4B0_113c,
  C2S_Packet27_IdentifyItem_6FCEF6B0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b3-113c'
import { NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c } from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import { ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c } from '../../../src/d2kern-113c/game/k2-w9b2-113c'

type KernelFn113c = (m: SparseMemory113c, ...args: number[]) => unknown

const DISPATCH_BY_VA: Record<string, KernelFn113c> = {
  '0x6FD10820': PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c as unknown as KernelFn113c,
  '0x6FCEBE70': NET_BroadcastSystemChatMessage_6FCEBE70_113c as unknown as KernelFn113c,
  '0x6FCED360': PACKET_SrvMercMoveToCoord_6FCED360_113c as unknown as KernelFn113c,
  '0x6FCED3D0': PACKET_SrvMercMoveToUnit_6FCED3D0_113c as unknown as KernelFn113c,
  '0x6FCEC750': PLAYER_IssueMercAiMoveCommand_6FCEC750_113c as unknown as KernelFn113c,
  '0x6FD0FFD0': PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c as unknown as KernelFn113c,
  '0x6FD10640': PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c as unknown as KernelFn113c,
  '0x6FCED2C0': PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c as unknown as KernelFn113c,
  '0x6FD103E0': PARTY_RefreshInviteRelationNodes_6FD103E0_113c as unknown as KernelFn113c,
  '0x6FCEB840': PLAYER_CalcHealingPotionPercent_6FCEB840_113c as unknown as KernelFn113c,
  '0x6FCEB720': PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c as unknown as KernelFn113c,
  '0x6FD10900': PARTY_CancelPartyInvitation_6FD10900_113c as unknown as KernelFn113c,
  '0x6FD0AF80': PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c as unknown as KernelFn113c,
  '0x6FCD2820': ARENA_UpdatePlayerArenaScore_6FCD2820_113c as unknown as KernelFn113c,
  '0x6FD0C0E0': PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c as unknown as KernelFn113c,
  '0x6FD0C1E0': PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c as unknown as KernelFn113c,
  '0x6FD0BD10': PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c as unknown as KernelFn113c,
  '0x6FD0B700': PLAYERSAVE_WriteWaypointSection_6FD0B700_113c as unknown as KernelFn113c,
  '0x6FD0C020': PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c as unknown as KernelFn113c,
  '0x6FD0C120': PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c as unknown as KernelFn113c,
  '0x6FD0B7B0': PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c as unknown as KernelFn113c,
  '0x6FD0BC40': PLAYERSAVE_WriteSkillSection_6FD0BC40_113c as unknown as KernelFn113c,
  '0x6FD0B610': PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c as unknown as KernelFn113c,
  '0x6FCEB5B0': C2S_Packet0B_Noop1Byte113c as unknown as KernelFn113c,
  '0x6FCEF070': C2S_Packet34_CainIdentifyItems_6FCEF070_113c as unknown as KernelFn113c,
  '0x6FCEFB90': C2S_Packet23_MercReviveHandler_6FCEFB90_113c as unknown as KernelFn113c,
  '0x6FCF0060': C2S_Packet_HireMercenary_6FCF0060_113c as unknown as KernelFn113c,
  '0x6FCEF220': C2S_Packet_NpcBuyItem_6FCEF220_113c as unknown as KernelFn113c,
  '0x6FCEE000': C2S_Packet04_RunToUnit113c as unknown as KernelFn113c,
  '0x6FCEE090': C2S_Packet02_WalkToUnit113c as unknown as KernelFn113c,
  '0x6FCEEA50': C2S_Packet11_RepeatShiftRightSkillOnUnit113c as unknown as KernelFn113c,
  '0x6FCEEAB0': C2S_Packet10_RepeatRightSkillOnUnit113c as unknown as KernelFn113c,
  '0x6FCEEB10': C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c as unknown as KernelFn113c,
  '0x6FCEEB70': C2S_Packet09_RepeatLeftSkillOnUnit113c as unknown as KernelFn113c,
  '0x6FCEE7F0': C2S_Packet0E_ShiftRightSkillOnUnit113c as unknown as KernelFn113c,
  '0x6FCEE950': C2S_Packet07_ShiftLeftSkillOnUnit113c as unknown as KernelFn113c,
  '0x6FCEE790': C2S_Packet0F_RepeatRightSkillOnLocation113c as unknown as KernelFn113c,
  '0x6FCEE8F0': C2S_Packet08_RepeatLeftSkillOnLocation113c as unknown as KernelFn113c,
  '0x6FCEE5A0': C2S_Packet05_LeftSkillOnLocation113c as unknown as KernelFn113c,
  '0x6FCEE4B0': C2S_Packet21_MergeStackableItems_6FCEE4B0_113c as unknown as KernelFn113c,
  '0x6FCEEDE0': C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c as unknown as KernelFn113c,
  '0x6FCEF6B0': C2S_Packet27_IdentifyItem_6FCEF6B0_113c as unknown as KernelFn113c,
  '0x6FCEDB30': C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c as unknown as KernelFn113c,
  '0x6FCEF400': C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c as unknown as KernelFn113c,
  '0x6FCEEFE0': C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c as unknown as KernelFn113c,
  '0x6FCEEBD0': C2S_Packet28_SocketItem_6FCEEBD0_113c as unknown as KernelFn113c,
  '0x6FCF1140': C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c as unknown as KernelFn113c,
  '0x6FCF0E90': C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c as unknown as KernelFn113c,
  '0x6FCDA180': ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c as unknown as KernelFn113c,
  '0x6FCDA490': ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c as unknown as KernelFn113c,
  '0x6FCE5B80': ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c as unknown as KernelFn113c,
  '0x6FCE5ED0': ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c as unknown as KernelFn113c,
  '0x6FCE65A0': ACT2Q6_PropagatePartyCompletionCallback_6FCE65A0_113c as unknown as KernelFn113c,
  '0x6FD06850': ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c as unknown as KernelFn113c,
  '0x6FD06980': ACT3Q5_PropagateCouncilCompletionToPartyCallback_6FD06980_113c as unknown as KernelFn113c,
  '0x6FD06B90': ACT3Q4_PropagateTomeQuestStateToSubParty_6FD06B90_113c as unknown as KernelFn113c,
  '0x6FCE5E30': ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c as unknown as KernelFn113c,
  '0x6FCE6010': ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c as unknown as KernelFn113c,
  '0x6FD068B0': ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c as unknown as KernelFn113c,
  '0x6FCE58B0': ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c as unknown as KernelFn113c,
  '0x6FCE5BE0': ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c as unknown as KernelFn113c,
  '0x6FCE6AF0': ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c as unknown as KernelFn113c,
  '0x6FCE6A30': ACT2Q3_StartEclipseEvent_6FCE6A30_113c as unknown as KernelFn113c,
  '0x6FCE5E90': ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c as unknown as KernelFn113c,
  '0x6FCE7130': ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c as unknown as KernelFn113c,
  '0x6FCE6920': ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c as unknown as KernelFn113c,
  '0x6FCE6CA0': ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c as unknown as KernelFn113c,
  '0x6FD06D90': ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c as unknown as KernelFn113c,
  '0x6FD06910': ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c as unknown as KernelFn113c,
  '0x6FD069E0': ACT3Q5_OnOrmusActivatedSendTravincalAlert_6FD069E0_113c as unknown as KernelFn113c,
  '0x6FD06B20': ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c as unknown as KernelFn113c,
  '0x6FD06FE0': ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c as unknown as KernelFn113c,
  '0x6FD06F60': ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c as unknown as KernelFn113c,
  '0x6FD03B00': ACT3Q4_OnQuestUnitDeactivate113c as unknown as KernelFn113c,
  '0x6FD051C0': ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c as unknown as KernelFn113c,
  '0x6FD04900': ACT3Q3_OnKhalimsWillCubed113c as unknown as KernelFn113c,
  '0x6FD049E0': ACT3Q7_Callback14_PlayerJoined113c as unknown as KernelFn113c,
  '0x6FD03050': ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c as unknown as KernelFn113c,
  '0x6FCE1990': ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c as unknown as KernelFn113c,
  '0x6FCE23C0': ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c as unknown as KernelFn113c,
  '0x6FCE3E10': ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c as unknown as KernelFn113c,
  '0x6FCD9C00': ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c as unknown as KernelFn113c,
  '0x6FCE4AA0': ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c as unknown as KernelFn113c,
  '0x6FCE1D30': ACT2Q6_StatusFilter_6FCE1D30_113c as unknown as KernelFn113c,
  '0x6FCE4C30': ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c as unknown as KernelFn113c,
  '0x6FD034D0': ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c as unknown as KernelFn113c,
  '0x6FCD9A30': ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c as unknown as KernelFn113c,
  '0x6FCD9320': ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c as unknown as KernelFn113c,
  '0x6FCD8F20': ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c as unknown as KernelFn113c,
  '0x6FCE2900': ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c as unknown as KernelFn113c,
  '0x6FCE4DE0': ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c as unknown as KernelFn113c,
  '0x6FD030C0': ACT3Q0_MarkWandererSeenCallback113c as unknown as KernelFn113c,
  '0x6FCE5090': ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c as unknown as KernelFn113c,
  '0x6FD03C70': ACT3Q4_SyncTomePartyQuestStateCallback113c as unknown as KernelFn113c,
  '0x6FCE3900': ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c as unknown as KernelFn113c,
  '0x6FCD94F0': ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c as unknown as KernelFn113c,
  '0x6FD05B60': ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c as unknown as KernelFn113c,
  '0x6FD037D0': ACT3Q5_CompleteCouncilPartyCallback113c as unknown as KernelFn113c,
  '0x6FCE55B0': ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c as unknown as KernelFn113c,
  '0x6FD064C0': ACT3Q4_CompleteLamEsensTomePartyCallback_6FD064C0_113c as unknown as KernelFn113c,
  '0x6FCE2E70': ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c as unknown as KernelFn113c,
  '0x6FCE3480': ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c as unknown as KernelFn113c,
  '0x6FCE5910': ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c as unknown as KernelFn113c,
  '0x6FD041D0': ACT3Q2_SetGidbinnTurnInPartyCallback_6FD041D0_113c as unknown as KernelFn113c,
  '0x6FCE29E0': ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c as unknown as KernelFn113c,
  '0x6FCE3010': ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c as unknown as KernelFn113c,
  '0x6FD04280': ACT3Q2_SetGidbinnState0ECallback_6FD04280_113c as unknown as KernelFn113c,
  '0x6FD05370': ACT3Q6_SyncGidbinnState02Callback113c as unknown as KernelFn113c,
  '0x6FCE3F40': ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c as unknown as KernelFn113c,
  '0x6FCE3630': ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c as unknown as KernelFn113c,
  '0x6FD03A80': ACT3Q5_SyncCouncilQuestFlagsCallback113c as unknown as KernelFn113c,
  '0x6FCE5100': ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c as unknown as KernelFn113c,
  '0x6FCE5190': ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c as unknown as KernelFn113c,
  '0x6FD05C40': ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c as unknown as KernelFn113c,
  '0x6FCE5820': ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c as unknown as KernelFn113c,
  '0x6FCE36B0': ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c as unknown as KernelFn113c,
  '0x6FCE31C0': ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c as unknown as KernelFn113c,
  '0x6FCDAF20': ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c as unknown as KernelFn113c,
  '0x6FCD9290': ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c as unknown as KernelFn113c,
  '0x6FCD96A0': ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c as unknown as KernelFn113c,
  '0x6FCE3750': ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c as unknown as KernelFn113c,
  '0x6FCE4430': ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c as unknown as KernelFn113c,
  '0x6FCD8E80': ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c as unknown as KernelFn113c,
  '0x6FCE3550': ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c as unknown as KernelFn113c,
  '0x6FCDDE50': NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c as unknown as KernelFn113c,
  '0x6FCCDAC0': ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c as unknown as KernelFn113c,
  '0x6FCF6BC0': ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c as unknown as KernelFn113c,
  '0x6FCDDA90': NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c as unknown as KernelFn113c,
  '0x6FCCCFD0': ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c as unknown as KernelFn113c,
  '0x6FCDCBE0': NPC_HealAndCureUnit_6FCDCBE0_113c as unknown as KernelFn113c,
  '0x6FCF1B20': ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c as unknown as KernelFn113c,
  '0x6FCF1950': ITEMS_AreWeaponSlotTypesCompatible113c as unknown as KernelFn113c,
  '0x6FCF5690': ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c as unknown as KernelFn113c,
  '0x6FCF2310': ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c as unknown as KernelFn113c,
  '0x6FCC0FC0': SKILLS_CountUnitsInRadius_6FCC0FC0_113c as unknown as KernelFn113c,
  '0x6FCC0F40': SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c as unknown as KernelFn113c,
  '0x6FD11490': SKILLS_ResolveTriggeredCorpseTarget_6FD11490_113c as unknown as KernelFn113c,
  '0x6FCC11B0': SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c as unknown as KernelFn113c,
  '0x6FCC1580': SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c as unknown as KernelFn113c,
  '0x6FCCD050': SKILLS_RemoveAuraStateAndEvent9OnSkillChange_6FCCD050_113c as unknown as KernelFn113c,
  '0x6FCD3930': SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c as unknown as KernelFn113c,
  '0x6FCD3770': SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c as unknown as KernelFn113c,
  '0x6FCC16A0': SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c as unknown as KernelFn113c,
  '0x6FD12040': AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c as unknown as KernelFn113c,
  '0x6FCC4F40': AI_TickAncientStatueRevertCheck_6FCC4F40_113c as unknown as KernelFn113c,
  '0x6FCD3120': MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c as unknown as KernelFn113c,
  '0x6FCD2FC0': MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c as unknown as KernelFn113c,
  '0x6FCD2ED0': MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c as unknown as KernelFn113c,
  '0x6FCD3060': MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c as unknown as KernelFn113c,
  '0x6FCD31D0': MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c as unknown as KernelFn113c,
}

const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS
const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0xc000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const EXPECTED_VA_COUNT = 150

interface MemRunRecord {
  readonly addr: string
  readonly hex: string
}

interface K6W7VectorRecord {
  readonly va: string
  readonly name: string
  readonly caseIdx: number
  readonly label: string
  readonly tsArgs: readonly number[]
  readonly retMask: string
  readonly asserted: boolean
  readonly assertLine: number
  readonly ret: string
  readonly setupTop: string
  readonly preMem: readonly MemRunRecord[]
  readonly postMem: readonly MemRunRecord[]
  readonly heapTop: string
  readonly heapHex: string
}

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
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    this.fill(p, size, 0)
    this.heapCursor = (p + size) >>> 0
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

function extractStageRuns(mem: CoWSparseMemory113c, setupTop: number): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  return out
}

function loadVectors(): K6W7VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w7/k6-w7-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W7VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W7VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 7 real-DLL D2Game.dll (0x6FCC0000..0x6FD142D0) differential vectors', () => {
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
    bindK2KernelGlobals113c(mem)
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.commitOverlayToBase()
  })

  it(`covers ${EXPECTED_VA_COUNT} real-DLL D2Game.dll VAs in 0x6FCC0000..0x6FD142D0`, () => {
    expect(VECTORS_BY_VA.size).toBe(EXPECTED_VA_COUNT)
    expect(Object.keys(DISPATCH_BY_VA).length).toBe(EXPECTED_VA_COUNT)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(EXPECTED_VA_COUNT * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fcc0000)
      expect(num).toBeLessThanOrEqual(0x6fd142d0)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
      expect(cases.length).toBeGreaterThanOrEqual(3)
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const blk of vec.preMem) {
          const addr = Number.parseInt(blk.addr, 16) >>> 0
          mem.loadBlock(addr, hexToBytes(blk.hex))
        }

        beginVaTrace113c()
        let retVal: unknown = 0
        let caughtErr: unknown = null
        try {
          retVal = fn!(mem, ...vec.tsArgs)
        } catch (err) {
          caughtErr = err
        }
        const hits = endVaTrace113c()
        expect(
          hits.has(`D2Game:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit D2Game:${va}`,
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

        const actualPostMem = extractStageRuns(mem, setupTop)
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
          const actualHeapHex = bytesToHex(mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE))
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        }
      }
    })
  }
})
