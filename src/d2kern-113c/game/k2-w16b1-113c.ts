import { UNITS_GetPlayerData113c } from '../common/composit';
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg';
import { DUNGEON_GetLevelIdFromRoom113c, DUNGEON_ToggleHasPortalFlag113c } from '../common/dungeon';
import { INVENTORY_GetCursorItem113c } from '../common/inventory';
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CanItemBeDroppedOrSold113c,
  ITEMS_CanItemBeSocketedByQuest113c,
  ITEMS_CheckEtherealFlag113c,
  ITEMS_CheckIfImbueable113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetEarName113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemSeed113c,
  ITEMS_GetMaxSocketsFromItemType113c,
  ITEMS_GetMissileWeaponVelocity113c,
  ITEMS_SetEarName113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_TestFlagMask113c,
} from '../common/items';
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  INVENTORY_GetCompositWeaponMemPort113c,
} from '../common/k0-d2common-memports';
import { PATH_GetPosX113c, PATH_GetPosY113c, PATH_GetTargetTypeAndPosition113c } from '../common/path';
import {
  QUESTRECORD_ClearQuestStateBits2To11_113c,
  QUESTRECORD_SetQuestState113c,
  UNITS_GetLeftSkill113c,
  UNITS_GetRightSkill113c,
} from '../common/quest-record';
import {
  SKILLS_GetOwnerItemGuid113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c,
} from '../common/skills';
import {
  DUNGEON_GetActLevelId113c,
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist';
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNIT_Alloc113c,
  UNITS_AllocStaticPath113c,
  UNITS_GetRoom113c,
  UNITS_SetUnitUpdateFlags113c,
} from '../common/unit';
import { D2CommonAssertError } from '../common/inline-helpers';
import { WAYPOINT_ActivateWaypoint113c, WAYPOINT_GetWaypointNoFromLevelId113c } from '../common/waypoint';
import type { SparseMemory113c } from '../mem/sparse-memory';
import {
  ACT2Q2_Callback03_LevelChanged113c,
  ACT2Q3_Callback03_LevelChanged113c,
  ACT3Q0_Callback03_LevelChanged113c,
  ACT3Q2_Callback03_LevelChanged113c,
  ACT3Q5_Callback03_LevelChanged113c,
  ACT3Q6_Callback03_LevelChanged113c,
  ACT3Q8_Callback03_LevelChanged113c,
  ACT4Q1_Callback03_LevelChanged113c,
} from './a1c-post150-f150-f276-113c';
import { ARENA_ProcessKillScoreUpdate113c } from './a1c-post150-f786-f1040-113c';
import {
  AIGENERAL_GetPackLeaderUnit113c,
  SUNIT_SetUnitEventSound113c,
  SUNITDMG_FreeAttackerCombatList113c,
} from './ai-fallen-113c';
import { CLIENTS_ForEachInGameClient113c, NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c';
import {
  D2GAME_ARENA_FindPlayerSlotByUnit113c,
  D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c,
  D2GAME_PLRMODES_SendStatToClientOrParty113c,
} from './boot-init-gap-b-113c';
import { C2S_ValidateTargetUnitDistance113c, PLAYER_StartModeAtCoords113c } from './c2s-packet-113c';
import { SUNITDMG_GetPlayerClientClassId113c } from './combat-a1c-113c';
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_FindFreeGroundDropCoords_6FC2E930_113c,
  ITEMS_GetDropItemLevel_6FC2E5D0_113c,
} from './k2-real-itemdrop-113c';
import { PLAYERSAVE_SavePlayerCharacter_6FC74320_113c } from './k2-w9b1-113c';
import {
  PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c,
  PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c,
} from './k2-w10b1-113c';
import {
  ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c,
  PLAYER_ChangeLevelOrActTransition_6FCBE170_113c,
  PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c,
} from './k2-w12b1-113c';
import {
  D2Game_6FC93AA0_113c,
  D2Game_6FCDB4F0_113c,
  D2Game_6FCEF810_113c,
} from './k2-w13b1-113c';
import {
  CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c,
  ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c,
  NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c,
  PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c,
  QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c,
} from './k2-w14b1-113c';
import {
  ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c,
  ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c,
  CLIENT_NotifyAndDisconnectClient_6FC4D090_113c,
  ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c,
  NPCS_BeginVendorOrGambleInteract_6FCDF730_113c,
  PLAYER_CreateCorpseOnDeath_6FC99210_113c,
  PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c,
  QUESTS_OnBossActChangeOrBossKill_6FC56890_113c,
} from './k2-w15b1-113c';
import { SUNIT_ScheduleModeAnimEvents113c } from './replay-kernel-113c';
import { SUNIT_GetServerUnit113c } from './game-strc';
import { PLRTRADE_SendTradeAcceptButtonAndSetState3_113c } from './k2-combat-core-w1-113c';
import { SKILLS_AssignHandSkillAndSyncAura113c } from './k2-gap-melee-dot-113c';
import {
  CLIENTS_CaptureFirstInGameClientCallback113c,
  PLAYER_IsBusyWithCursorOrNpcInteract113c,
} from './k2-items-tc-w1-113c';
import {
  MONSTER_GetInteractDataPtr_6FC21370_113c,
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
  PLAYER_GetWaypointDataForDifficulty_6FC21720_113c,
} from './k2-laneH-0x6fc2-w1-113c';
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c';
import {
  CLIENT_SelectFlag20ClientCallback_6FC4A700_113c,
  GAME_LeaveGameCriticalSection_6FC49BA0_113c,
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
} from './k2-laneJ-0x6fc4-w1-113c';
import {
  CLIENTS_FindClientByIdInGame_6FC69FE0_113c,
  CLIENTS_FreeSaveDataBuffer_6FC69630_113c,
  CLIENTS_GetClientNamePtr_6FC69A20_113c,
} from './k2-laneL-0x6fc6-w1-113c';
import {
  ACT5Q4_CompletePersonalizationReward_6FC777F0_113c,
  ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c,
  ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c,
  ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c,
} from './k2-laneM-0x6fc7-w1-113c';
import {
  ACT3Q5_BlackenedTempleActiveFilter113c,
  MONSTER_CountInteractingPlayers113c,
  MONSTER_PromotePlayerInteractToTradeState113c,
} from './k2-sunit-spawn-w1-113c';
import {
  ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c,
  QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
} from './k2-w2b1-113c';
import { ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c } from './k2-w2b2-113c';
import {
  NET_SendPacket77_ButtonAction_6FCAB340_113c,
  NET_SendPacket79_GoldInTrade_6FCAB1F0_113c,
  NET_SendPacket7B_ByteAndDword_6FCAAD10_113c,
  NET_SendPacketBuffer7B_6FCAAB20_113c,
  NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c,
} from './k2-w2b3-113c';
import {
  SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c,
  SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c,
} from './k2-w2b4-113c';
import {
  ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c,
  ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c,
  ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c,
  ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c,
  INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c,
} from './k2-w2b6-113c';
import {
  ACT2Q2_Callback10_RemovePlayerGuid_6FCE3EB0_113c,
  ACT2Q2_NoOp_6FCE2450_113c,
  ACT2Q6_Callback10_RemovePlayerGuid_6FCE2AF0_113c,
  ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c,
} from './k2-w2b7-113c';
import {
  ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c,
  ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c,
  ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c,
  ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c,
  ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c,
  ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c,
  ITEMS_OnCharmPlacedInInventory_6FCF6710_113c,
} from './k2-w2b8-113c';
import {
  ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c,
  ITEMS_PopulateItemDropStruct_6FC2E410_113c,
} from './k2-w3b1-113c';
import { GAME_LookupAndLockGameByKey_6FC4AAE0_113c } from './k2-w3b2-113c';
import { QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c } from './k2-w3b3-113c';
import {
  ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F_6FC785C0_113c,
  ACT5Q6_ActiveFilter_6FC76EF0_113c,
  ACT5Q6_Callback00_NpcActivate_6FC77000_113c,
  ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c,
  ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c,
} from './k2-w3b5-113c';
import {
  OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c,
  OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c,
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c,
} from './k2-w3b7-113c';
import { PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c } from './k2-w3b8-113c';
import {
  ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c,
  ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c,
} from './k2-w4b1-113c';
import {
  ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c,
  ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c,
} from './k2-w4b2-113c';
import { ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c } from './k2-w4b3-113c';
import { PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c } from './k2-w4b4-113c';
import {
  ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c,
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
} from './k2-w4b5-113c';
import {
  ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c,
  ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c,
  ACT4Q3_InitNpcDialog_6FCD9070_113c,
  ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c,
  ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c,
  ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c,
  ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c,
} from './k2-w4b8-113c';
import {
  CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c,
  PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c,
} from './k2-w5b1-113c';
import { ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c } from './k2-w5b2-113c';
import {
  ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c,
  SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c,
} from './k2-w5b3-113c';
import {
  ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c,
  ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c,
  ACT2Q2_StatusFilter_6FCE3BD0_113c,
  ACT2Q6_ActiveFilter_6FCE1C20_113c,
  ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c,
  ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c,
  ACT2Q6_StatusFilter_6FCE1D30_113c,
  NPC_ClearPlayerInteractState_6FCDCB90_113c,
  NPC_TransferInventoryItemsToOwner_6FCDCD90_113c,
} from './k2-w5b4-113c';
import {
  ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c,
  ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c,
  PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c,
} from './k2-w5b5-113c';
import { C2S_ValidateCursorItem_6FCECF70_113c } from './k2-w5b6-113c';
import {
  ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c,
  QUESTS_ChainStatusFilterNotState5_6FD02F00_113c,
  QUESTS_ChainStatusFilterNotState7_6FD02A40_113c,
  QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c,
  QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
} from './k2-w5b7-113c';
import {
  ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c,
  ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c,
  ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c,
  ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c,
  ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c,
  ACT3Q2_GidbinnActiveFilter_6FD04500_113c,
  ACT3Q2_GidbinnStatusFilter_6FD045B0_113c,
  ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c,
  ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c,
  ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c,
  ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c,
} from './k2-w5b8-113c';
import { ACT3Q4_StatusFilter_6FD06E00_113c } from './k2-w5b9-113c';
import {
  ACT2Q2_ActiveFilter_6FCE5440_113c,
  ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c,
  ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c,
  ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c,
  NPC_SendHirelingListPacketsToClient_6FCDD330_113c,
  NPCS_ResetVendorSlotInventory_6FCB02E0_113c,
} from './k2-w6b2-113c';
import {
  ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c,
  ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c,
  ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c,
  QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c,
} from './k2-w6b4-113c';
import {
  ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c,
  ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c,
  ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c,
  SKILLS_RespecPlayerClassSkills_6FCC1280_113c,
} from './k2-w6b5-113c';
import {
  ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c,
  ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c,
  ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c,
  ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c,
  ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c,
  ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c,
  PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c,
} from './k2-w6b6-113c';
import {
  ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c,
  PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c,
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c,
} from './k2-w7b1-113c';
import {
  ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c,
  ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c,
  STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c,
  STASH_HandleBankGoldOrCloseAction_6FC917E0_113c,
} from './k2-w7b2-113c';
import {
  ACT2Q3_SeqCallback_6FCE6390_113c,
  ACT4Q3_OnScrollMessage_6FCDB250_113c,
  ACT4Q3_SeqCallback_6FCDA4F0_113c,
} from './k2-w7b3-113c';
import {
  ACT2Q6_OnDurielKilled_6FCE97D0_113c,
  ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c,
  ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c,
} from './k2-w7b4-113c';
import { NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c } from './k2-w8b3-113c';
import {
  ACT3Q1_OnQuestItemPickedUp_6FD07640_113c,
  ACT3Q2_OnGidbinnPickedUp_6FD07770_113c,
  ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c,
} from './k2-w8b4-113c';
import { MONSTER_ClearModeEvents113c, UNITS_ChangeAnimMode113c } from './monster-events';
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c';
import {
  MONSTATS_CheckFlagBit113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SEED_RollRangeHalfOpen113c,
  SUNIT_InitUnitAnimData113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c';
import { EVENT_SetEventFull113c } from './timer-wheel';
import { PLAYER_SetNeutralOrTownNeutralMode113c } from './town-runtime-gap-113c';
import { hitD2GameVa113c } from '../va-trace-113c';

function FOG_Allocation113c(
  m: SparseMemory113c,
  size: number,
  _file: number | string,
  _line: number,
  _pool: number,
): number {
  return m.alloc(size);
}

function FOG_Assert113c(_expr: string | number, file: string | number, line: number): void {
  throw new D2CommonAssertError(String(file), line);
}

function FOG_FreeClientMemory113c(
  _m: SparseMemory113c,
  _ptr: number,
  _file: number | string,
  _line: number,
  _pool: number,
): void {}

function SStrNCpy113c(m: SparseMemory113c, dst: number, src: number, maxLen: number): void {
  if (dst === 0 || maxLen <= 0) return;
  for (let i = 0; i < maxLen; i += 1) {
    if (i === maxLen - 1) {
      m.setU8((dst + i) >>> 0, 0);
      break;
    }
    const ch = src !== 0 ? m.u8((src + i) >>> 0) : 0;
    m.setU8((dst + i) >>> 0, ch);
    if (ch === 0) break;
  }
}

const W16B1_SCRATCH_BASE = 0x7ef50000;

/**
 * @dll D2Game.dll
 * @va 0x6FC4D140
 * @ordinalOrName D2Game_6FC4D140
 */
export function CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c(
  m: SparseMemory113c,
  pClient: number,
  pGame: number,
  d2netSendPacket?: (nZero: number, dwClientId: number, pBuf: number, nLen: number) => number,
): void {
  hitD2GameVa113c(0x6FC4D140);
  if (pClient === 0) {
    FOG_Assert113c('pClient', '0x6fd19ff9', 0xb8a);
    return;
  }
  if ((m.u8((pClient + 0x3d4) >>> 0) & 0x10) === 0) return;
  const pSaveData = m.u32((pClient + 0x17c) >>> 0);
  if (pSaveData === 0) return;
  const nCooldown = m.u32((pClient + 0x184) >>> 0);
  if (nCooldown !== 0) {
    m.setU32((pClient + 0x184) >>> 0, (nCooldown - 1) >>> 0);
    return;
  }
  const nOffset = m.u32((pClient + 0x188) >>> 0);
  const nTotalSize = m.u32((pClient + 0x180) >>> 0);
  let nChunk = (nTotalSize - nOffset) | 0;
  m.setU32((pClient + 0x184) >>> 0, 5);
  if (nChunk >= 0xff) nChunk = 0xff;
  const pClientGame = m.u32((pClient + 0x1a8) >>> 0);
  const pMemPool = pClientGame !== 0 ? m.u32((pClientGame + 0x1c) >>> 0) : 0;
  const pBuf = FOG_Allocation113c(m, 0x107, 0x6fd1cd98, 0x8b2, pMemPool);
  m.setU8(pBuf >>> 0, 0xb3);
  m.setU8((pBuf + 1) >>> 0, nChunk & 0xff);
  m.setU8((pBuf + 2) >>> 0, nOffset === 0 ? 1 : 0);
  m.setU32((pBuf + 3) >>> 0, nTotalSize >>> 0);
  if (nChunk > 0) {
    for (let i = 0; i < nChunk; i += 1) {
      m.setU8((pBuf + 7 + i) >>> 0, m.u8((pSaveData + nOffset + i) >>> 0));
    }
  }
  const dwClientId = m.u32(pClient >>> 0) >>> 0;
  const nSendRes =
    d2netSendPacket !== undefined
      ? d2netSendPacket(0, dwClientId, pBuf, (nChunk + 7) | 0) | 0
      : (nChunk + 7) | 0;
  if (nSendRes !== 0) {
    const nNewOffset = (nOffset + nChunk) >>> 0;
    m.setU32((pClient + 0x188) >>> 0, nNewOffset);
    if (nNewOffset === nTotalSize >>> 0) {
      CLIENTS_FreeSaveDataBuffer_6FC69630_113c(m, pClient);
    }
    m.setU32((pClient + 0x1c4) >>> 0, 0);
  } else {
    m.setU32((pClient + 0x1c4) >>> 0, (m.u32((pClient + 0x1c4) >>> 0) + 1) >>> 0);
  }
  FOG_FreeClientMemory113c(m, pBuf, 0x6fd1cd98, 0x8d8, pMemPool);
  if ((m.u32((pClient + 0x1c4) >>> 0) | 0) >= 3) {
    CLIENTS_FreeSaveDataBuffer_6FC69630_113c(m, pClient);
    CLIENT_NotifyAndDisconnectClient_6FC4D090_113c(m, pClient, pGame, 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC4D500
 * @ordinalOrName D2Game_6FC4D500
 */
export function CLIENTS_FlushPositionsSaveAndPacketQueue_6FC4D500_113c(
  m: SparseMemory113c,
  pClient: number,
  pGame: number,
  bFlushPositions: number,
): void {
  hitD2GameVa113c(0x6FC4D500);
  if (pGame === 0) {
    FOG_Assert113c('pGame', '0x6fd19ff9', 0xee2);
    return;
  }
  if (pClient === 0) {
    FOG_Assert113c('pClient', '0x6fd19ff9', 0xee3);
    return;
  }
  if (bFlushPositions !== 0 && m.u32((pClient + 0x04) >>> 0) === 4) {
    if (m.u32(0x6fd31c38) !== 0) {
      CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c(m, pClient);
    }
    PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c(m, pClient);
  }
  const bGameType = m.u8((pGame + 0x6a) >>> 0);
  if (bGameType === 1 || bGameType === 2) {
    CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c(m, pClient, pGame);
  }
  let nSentCount = 0;
  let bStop = 0;
  while (true) {
    const pHead = m.u32((pClient + 0x1b8) >>> 0);
    if (m.u32((pClient + 0x1bc) >>> 0) === pHead) {
      m.setU32((pClient + 0x1bc) >>> 0, 0);
      m.setU32((pClient + 0x1b8) >>> 0, 0);
    }
    if (pHead === 0) break;
    const pNext = m.u32((pHead + 0x204) >>> 0);
    m.setU32((pClient + 0x1b8) >>> 0, pNext);
    const nPktSize = m.u32(pHead >>> 0);
    if (nPktSize === 0) break;
    const bSendOk = m.u8((pClient + 0x3d5) >>> 0) !== 0xff;
    if (bSendOk) {
      m.setU32(pHead >>> 0, 0);
      m.setU32((pHead + 0x204) >>> 0, m.u32((pClient + 0x1c0) >>> 0));
      nSentCount += 1;
      m.setU32((pClient + 0x1c0) >>> 0, pHead);
      m.setU32((pClient + 0x1c4) >>> 0, 0);
    } else {
      m.setU32((pClient + 0x1c4) >>> 0, (m.u32((pClient + 0x1c4) >>> 0) + 1) >>> 0);
      m.setU32((pHead + 0x204) >>> 0, 0);
      bStop = 1;
      if (m.u32((pClient + 0x1b8) >>> 0) === 0) {
        m.setU32((pHead + 0x204) >>> 0, 0);
      } else {
        m.setU32((pClient + 0x1bc) >>> 0, pHead);
      }
      const nRetries = m.u32((pClient + 0x1c4) >>> 0) | 0;
      m.setU32((pClient + 0x1b8) >>> 0, pHead);
      if (nRetries >= 3) {
        CLIENT_NotifyAndDisconnectClient_6FC4D090_113c(m, pClient, pGame, 0);
        return;
      }
    }
    const bType = m.u8((pGame + 0x6a) >>> 0);
    if ((bType === 1 || bType === 2) && nSentCount >= 3) break;
    if (bStop !== 0) break;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC4D790
 * @ordinalOrName D2Game_6FC4D790
 */
export function CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c(
  m: SparseMemory113c,
  pGame: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC4D790);
  const bGameType = m.u8((pGame + 0x6a) >>> 0);
  if (bGameType !== 1 && bGameType !== 2) return;
  if (pClient === 0) {
    FOG_Assert113c('pClient', '0x6fd19ff9', 0xb8a);
    return;
  }
  let guard = 0;
  while (
    (m.u8((pClient + 0x3d4) >>> 0) & 0x10) !== 0 &&
    m.u32((pClient + 0x17c) >>> 0) !== 0 &&
    guard < 1024
  ) {
    CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c(m, pClient, pGame);
    guard += 1;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC4DC70
 * @ordinalOrName D2Game_6FC4DC70
 */
export function CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c(
  m: SparseMemory113c,
  dwClientId: number,
  _uUnused = 0,
  getClientGameKey?: (dwClientId: number) => number,
): void {
  hitD2GameVa113c(0x6FC4DC70);
  const wGameKey =
    getClientGameKey !== undefined ? getClientGameKey(dwClientId >>> 0) & 0xffff : m.u16(0x6fd27d98);
  const pGame = GAME_LookupAndLockGameByKey_6FC4AAE0_113c(m, wGameKey);
  if (pGame === 0) return;
  let pWalk = m.u32((pGame + 0x88) >>> 0);
  let bFound = false;
  while (pWalk !== 0) {
    if (m.u32(pWalk >>> 0) === dwClientId >>> 0) {
      bFound = true;
      break;
    }
    pWalk = m.u32((pWalk + 0x4a8) >>> 0);
  }
  if (!bFound) {
    GAME_LeaveGameCriticalSection_6FC49BA0_113c(m, pGame);
    return;
  }
  let pClient = CLIENTS_FindClientByIdInGame_6FC69FE0_113c(m, pGame, dwClientId);
  if (pClient === 0) {
    FOG_Assert113c('pClient', '0x6fd19ff9', 0xba6);
    return;
  }
  const bCloseAll = (m.u8((pClient + 0x3d4) >>> 0) & 0x20) !== 0 ? 1 : 0;
  if (bCloseAll !== 0 || m.u8((pGame + 0x6a) >>> 0) !== 0) {
    PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c(m, pGame);
  }
  const pktScratch = W16B1_SCRATCH_BASE;
  let curClientId = dwClientId >>> 0;
  while (pClient !== 0) {
    m.setU8(pktScratch, 0x05);
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pktScratch, 1);
    CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c(m, pGame, pClient);
    m.setU8(pktScratch, 0x06);
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pktScratch, 1);
    m.setU8(pktScratch, 0xb0);
    CLIENTS_FlushPositionsSaveAndPacketQueue_6FC4D500_113c(m, pClient, pGame, 0);
    const pkt5A = (pktScratch + 0x10) >>> 0;
    for (let i = 0; i < 0x28; i += 4) m.setU32((pkt5A + i) >>> 0, 0);
    m.setU8(pkt5A, 0x5a);
    m.setU8((pkt5A + 1) >>> 0, 0x03);
    m.setU8((pkt5A + 2) >>> 0, 0x04);
    m.setU32((pkt5A + 3) >>> 0, 0);
    SStrNCpy113c(m, (pkt5A + 0x18) >>> 0, (pClient + 0x1d) >>> 0, 0x32);
    SStrNCpy113c(m, (pkt5A + 0x08) >>> 0, (pClient + 0x0d) >>> 0, 0x10);
    m.setU8((pkt5A + 0x27) >>> 0, 0);
    CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c(
      m,
      curClientId,
      pGame,
      bCloseAll === 0 ? 1 : 0,
    );
    if (_uUnused !== 0) {
      D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c(m, pkt5A, pGame);
    }
    if (bCloseAll === 0) break;
    pClient = m.u32((pGame + 0x88) >>> 0);
    if (pClient === 0) break;
    curClientId = m.u32(pClient >>> 0);
  }
  if (m.u32((pGame + 0x18) >>> 0) === 0) {
    FOG_Assert113c('pGame->pLock', '0x6fd19ff9', 0x100f);
    return;
  }
  GAME_LeaveGameCriticalSection_6FC49BA0_113c(m, pGame);
}

/**
 * @dll D2Game.dll
 * @va 0x6FC4DE30
 * @ordinalOrName D2Game_6FC4DE30
 */
export function CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c(
  m: SparseMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC4DE30);
  const bGameType = m.u8((pGame + 0x6a) >>> 0);
  if (bGameType !== 1 && bGameType !== 2) return;
  let pClient = m.u32((pGame + 0x88) >>> 0);
  while (pClient !== 0) {
    const pNext = m.u32((pClient + 0x4a8) >>> 0);
    let pPlayer = 0;
    if ((m.u8((pClient + 0x3d4) >>> 0) & 0x01) !== 0) {
      pPlayer = m.u32((pClient + 0x174) >>> 0);
    } else if (m.u32((pClient + 0x174) >>> 0) !== 0) {
      pPlayer = SUNIT_GetServerUnit113c(
        m,
        m.u32((pClient + 0x1a8) >>> 0),
        m.u32((pClient + 0x16c) >>> 0),
        m.u32((pClient + 0x170) >>> 0),
      );
      if (pPlayer === 0) {
        m.setU32((pClient + 0x174) >>> 0, 0);
      }
    }
    if (pPlayer !== 0) {
      PLAYERSAVE_SavePlayerCharacter_6FC74320_113c(m, pGame, pPlayer, (pClient + 0x0d) >>> 0, 0);
      CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c(m, pGame, pClient);
    }
    pClient = pNext;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC4E160
 * @ordinalOrName D2Game_6FC4E160
 */
export function CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c(
  m: SparseMemory113c,
  pGame: number,
  pDefaultClient = 0,
  getClientGameKey?: (dwClientId: number) => number,
): void {
  hitD2GameVa113c(0x6FC4E160);
  const outSlot1 = (W16B1_SCRATCH_BASE + 0x60) >>> 0;
  m.setU32(outSlot1, 0);
  CLIENTS_ForEachInGameClient113c(m, pGame, 0x6fc4a700, outSlot1, (mem, pClient, ctx) =>
    CLIENT_SelectFlag20ClientCallback_6FC4A700_113c(mem, pClient, ctx),
  );
  const pFlag20Client = m.u32(outSlot1);
  if (pFlag20Client !== 0) {
    CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c(
      m,
      m.u32(pFlag20Client >>> 0),
      0,
      getClientGameKey,
    );
    return;
  }
  if (pDefaultClient === 0) {
    const outSlot2 = (W16B1_SCRATCH_BASE + 0x64) >>> 0;
    m.setU32(outSlot2, 0);
    CLIENTS_ForEachInGameClient113c(m, pGame, 0x6fc4a0c0, outSlot2, (mem, pClient, ctx) =>
      CLIENTS_CaptureFirstInGameClientCallback113c(mem, pClient, ctx),
    );
    const pFirstClient = m.u32(outSlot2);
    if (pFirstClient !== 0) {
      CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c(
        m,
        m.u32(pFirstClient >>> 0),
        0,
        getClientGameKey,
      );
    }
    return;
  }
  CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c(
    m,
    m.u32(pDefaultClient >>> 0),
    0,
    getClientGameKey,
  );
}

/**
 * @dll D2Game.dll
 * @va 0x6FC58930
 * @ordinalOrName D2Game_6FC58930
 */
export function PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c(
  m: SparseMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC58930);
  const bActive = m.u8((pPlayer + 0x6c) >>> 0);
  const dwInteractId = m.u32((pPlayer + 0x64) >>> 0);
  const nInteractType = m.u32((pPlayer + 0x68) >>> 0);
  const getClient = (): number => {
    if (m.u32(pPlayer >>> 0) !== 0) return 0;
    const pData = UNITS_GetPlayerData113c(m, pPlayer);
    return pData !== 0 ? m.u32((pData + 0x9c) >>> 0) : 0;
  };
  if (bActive !== 0) {
    const pTarget = SUNIT_GetServerUnit113c(m, pGame, nInteractType, dwInteractId);
    if (pTarget !== 0 && nInteractType >>> 0 <= 4) {
      if (nInteractType === 0) {
        PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, pPlayer, 6, 0);
        return;
      }
      if (nInteractType === 1) {
        NPC_ClearPlayerInteractState_6FCDCB90_113c(m, pTarget, pPlayer, pGame);
        NET_SendPacket7B_ByteAndDword_6FCAAD10_113c(
          m,
          0x62,
          1,
          m.u32((pTarget + 0x0c) >>> 0),
          getClient(),
        );
        return;
      }
      if (nInteractType === 2) {
        OBJ_DeactivateShrineOrStashObject_6FC8F520_113c(m, pGame, pPlayer, pTarget);
        NET_SendPacket7B_ByteAndDword_6FCAAD10_113c(
          m,
          0x62,
          2,
          m.u32((pTarget + 0x0c) >>> 0),
          getClient(),
        );
        return;
      }
      if (nInteractType === 4) {
        const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((pTarget + 0x04) >>> 0));
        if (pItemsTxt === 0 || m.u32((pItemsTxt + 0x80) >>> 0) !== 0x20786f62) {
          return;
        }
        STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c(m, pPlayer, pGame);
        NET_SendPacket7B_ByteAndDword_6FCAAD10_113c(
          m,
          0x62,
          4,
          m.u32((pTarget + 0x0c) >>> 0),
          getClient(),
        );
        return;
      }
    }
  }
  const pClient = getClient();
  const pktScratch = 0x6fd44e70;
  m.setU8(pktScratch, 0x62);
  m.setU8((pktScratch + 1) >>> 0, 0x06);
  m.setU32((pktScratch + 2) >>> 0, 0);
  m.setU8((pktScratch + 6) >>> 0, 0);
  NET_QueuePacketToClientBuffer113c(m, pClient, 1, pktScratch, 7);
}

/**
 * @dll D2Game.dll
 * @va 0x6FC58AB0
 * @ordinalOrName D2Game_6FC58AB0
 */
export function PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c(
  m: SparseMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC58AB0);
  const bActive = m.u8((pPlayer + 0x6c) >>> 0);
  const dwInteractId = m.u32((pPlayer + 0x64) >>> 0);
  const nInteractType = m.u32((pPlayer + 0x68) >>> 0);
  if (bActive !== 0) {
    const pTarget = SUNIT_GetServerUnit113c(m, pGame, nInteractType, dwInteractId);
    if (pTarget !== 0 && nInteractType >>> 0 <= 4) {
      if (nInteractType === 0) {
        D2Game_6FC93AA0_113c(m, pGame, pPlayer);
      } else if (nInteractType === 1) {
        NPC_ClearPlayerInteractState_6FCDCB90_113c(m, pTarget, pPlayer, pGame);
      } else if (nInteractType === 2) {
        OBJ_DeactivateShrineOrStashObject_6FC8F520_113c(m, pGame, pPlayer, pTarget);
      } else if (nInteractType === 4) {
        const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((pTarget + 0x04) >>> 0));
        if (pItemsTxt !== 0 && m.u32((pItemsTxt + 0x80) >>> 0) === 0x20786f62) {
          STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c(m, pPlayer, pGame);
        }
      }
    }
  }
  ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c(m, pPlayer, pGame);
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7FD00
 * @ordinalOrName D2Game_6FC7FD00
 */
export function ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c(
  m: SparseMemory113c,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FC7FD00);
  const pGame = m.u32(pQuestArg >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuest !== 0 && m.u32(pQuest >>> 0) !== 0x24) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0) return 0;
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  if (pQuestState === 0 || m.u32((pQuestState + 0x9c) >>> 0) !== 2) return 0;
  const pPlayer = m.u32((pQuestArg + 0x08) >>> 0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pQuestHistory = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0);
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestHistory, 0x28, 0x0d) === 0) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer);
    return 0;
  }
  PLAYER_ChangeLevelOrActTransition_6FCBE170_113c(m, pPlayer, 0x6d, pGame, 0);
  let pClient = 0;
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pData = UNITS_GetPlayerData113c(m, pPlayer);
    pClient = pData !== 0 ? m.u32((pData + 0x9c) >>> 0) : 0;
  }
  CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c(m, m.u32((pQuest + 0x04) >>> 0));
  if (pClient !== 0 && PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pPlayer) === 0) {
    m.setU32((pPlayer + 0x64) >>> 0, 0xffffffff);
    m.setU32((pPlayer + 0x68) >>> 0, 6);
    m.setU8((pPlayer + 0x6c) >>> 0, 0);
    m.setU32((pPlayerData + 0x4c) >>> 0, 1);
    const pktScratch = (W16B1_SCRATCH_BASE + 0x78) >>> 0;
    m.setU8(pktScratch, 0x61);
    m.setU8((pktScratch + 1) >>> 0, 0x07);
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pktScratch, 2);
    QUESTRECORD_SetQuestState113c(m, pQuestHistory, m.u32((pQuest + 0xe0) >>> 0), 0x0a);
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7FE30
 * @ordinalOrName D2Game_6FC7FE30
 */
export function ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c(
  m: SparseMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7FE30);
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  const pGame = m.u32((pQuest + 0x04) >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  m.setU8((pQuestControl + 0x20) >>> 0, 0x13);
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGame,
    (mem, g, u, arg) => {
      QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(mem as SparseMemory113c, g, u, arg);
      return 0;
    },
    0,
    0,
  );
  if (m.u8((pQuest + 0x09) >>> 0) !== 0) {
    const pVictim = m.u32((pQuestArg + 0x08) >>> 0);
    const pRoom = UNITS_GetRoom113c(m, pVictim);
    m.setU32((pQuestState + 0x8c) >>> 0, pRoom);
    if (pRoom === 0) return;
    m.setU8((pQuest + 0x0b) >>> 0, 4);
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGame,
      (mem, g, u, arg) => {
        ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c(mem as SparseMemory113c, g, u, arg);
        return 0;
      },
      0,
      0,
    );
    const pKiller = m.u32((pQuestArg + 0x0c) >>> 0);
    if (pKiller !== 0) {
      let bFirstKill = 0;
      if (m.u8((pQuest + 0x09) >>> 0) !== 0) {
        const pArgGame = m.u32(pQuestArg >>> 0);
        const pKillerData = UNITS_GetPlayerData113c(m, pKiller);
        const nDiff = m.u8((pArgGame + 0x6d) >>> 0);
        const pKillerHist = m.u32((pKillerData + nDiff * 4 + 0x10) >>> 0);
        if (DRLGWARP_TestRoomTileBit113c(m, pKillerHist, 0x28, 0) === 0) {
          bFirstKill = 1;
        }
      }
      m.setU32((pQuestState + 0x88) >>> 0, 0);
      const pArgGame = m.u32(pQuestArg >>> 0);
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pArgGame,
        (mem, g, u, arg) => {
          ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c(mem as SparseMemory113c, g, u, arg);
          return 0;
        },
        0,
        pVictim,
      );
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pArgGame,
        (mem, g, u, arg) => {
          ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c(mem as SparseMemory113c, g, u, arg);
          return 0;
        },
        0,
        pVictim,
      );
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pArgGame,
        (mem, g, u, arg) => {
          ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c(mem as SparseMemory113c, g, u, arg);
          return 0;
        },
        0,
        pVictim,
      );
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pArgGame,
        (mem, g, u, arg) => {
          ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c(mem as SparseMemory113c, g, u, arg);
          return 0;
        },
        0,
        pVictim,
      );
      if (bFirstKill !== 0) {
        const nBase = (m.u8((pGame + 0x6d) >>> 0) * 0x1770) | 0;
        const nMin = (nBase + 0x5dc) | 0;
        let nMax = (nBase + 0xbb8) | 0;
        if (nMax >= 0xffff) nMax = 0xffff;
        let i = 0;
        while (i < (m.u32((pQuestState + 0x88) >>> 0) | 0)) {
          const pQc = m.u32((m.u32((pQuest + 0x04) >>> 0) + 0x10f4) >>> 0);
          if (pQc === 0) {
            FOG_Assert113c('pQuestControl', '0x6fd19ff9', 0x1fb);
            return;
          }
          const nGold = SEED_RollRangeHalfOpen113c(m, (pQc + 0x18) >>> 0, nMin, nMax);
          ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(m, m.u32((pQuest + 0x04) >>> 0), pVictim, nGold);
          i += 1;
        }
      }
      CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c(m, m.u32((pQuest + 0x04) >>> 0));
    }
    if (m.u8((pQuest + 0x0c) >>> 0) !== 5) {
      m.setU8((pQuest + 0x0c) >>> 0, 5);
    }
  }
  const pVictim = m.u32((pQuestArg + 0x08) >>> 0);
  const nType = m.u32(pVictim >>> 0);
  const pPath = m.u32((pVictim + 0x2c) >>> 0);
  const nY =
    nType === 2 || (nType > 3 && nType <= 5)
      ? m.u32((pPath + 0x10) >>> 0)
      : pPath !== 0
        ? PATH_GetPosY113c(m, pPath)
        : 0;
  const nX =
    nType === 2 || (nType > 3 && nType <= 5)
      ? m.u32((pPath + 0x0c) >>> 0)
      : pPath !== 0
        ? PATH_GetPosX113c(m, pPath)
        : 0;
  const pMissile = SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
    m,
    pVictim,
    m.u32(pQuestArg >>> 0),
    0,
    1,
    0x271,
    nX,
    nY,
  );
  if (pMissile !== 0) {
    DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pMissile), 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC80080
 * @ordinalOrName D2Game_6FC80080
 */
export function ACT5Q6_InitQuestTableRecord_6FC80080_113c(
  m: SparseMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FC80080);
  for (let i = 0; i < 0x3c; i += 4) {
    m.setU32((pQuest + 0xa0 + i) >>> 0, 0);
  }
  m.setU8((pQuest + 0x0c) >>> 0, 0);
  const pGame = m.u32((pQuest + 0x04) >>> 0);
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fc77000);
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fc76fc0);
  m.setU32((pQuest + 0xac) >>> 0, 0x6fc7a9b0);
  m.setU32((pQuest + 0xc0) >>> 0, 0x6fc7fe30);
  m.setU32((pQuest + 0xa8) >>> 0, 0x6fc7d920);
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fc77270);
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fc78930);
  m.setU32((pQuest + 0xd8) >>> 0, 0x6fc76eb0);
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd2d1c0);
  m.setU8((pQuest + 0x0a) >>> 0, 1);
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0;
  const pState = FOG_Allocation113c(m, 0xa8, 0x6fd1bff4, 0x329, pMemPool);
  m.setU32((pQuest + 0x18) >>> 0, pState);
  m.setU32((pQuest + 0xe0) >>> 0, 0x28);
  m.setU32((pQuest + 0xe8) >>> 0, 0);
  m.setU8((pQuest + 0x0d) >>> 0, 4);
  m.setU32((pQuest + 0xec) >>> 0, 0x6fc76ef0);
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fc79930);
  m.setU32((pQuest + 0x10) >>> 0, 0x25);
  for (let i = 0; i < 0xa8; i += 4) {
    m.setU32((pState + i) >>> 0, 0);
  }
  m.setU16((pState + 0x80) >>> 0, 0);
  m.setU32((pState + 0x94) >>> 0, 1);
  m.setU32((pState + 0x9c) >>> 0, 1);
  void ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c;
  void ACT5Q6_ActiveFilter_6FC76EF0_113c;
  void ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c;
  void ACT5Q6_Callback00_NpcActivate_6FC77000_113c;
  void ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c;
  void ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c;
  void ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c;
  void ACT4Q1_Callback03_LevelChanged113c;
  void ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8E680
 * @ordinalOrName D2Game_6FC8E680
 */
export function OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c(
  m: SparseMemory113c,
  dwItemGuid: number,
  dwPlayerGuid: number,
  pGame: number,
  dwObjectGuid: number,
  wSubAction: number,
): number {
  hitD2GameVa113c(0x6FC8E680);
  if (pGame === 0) {
    FOG_Assert113c('pGame', '0x6fd19ff9', 0x2d3);
    return 0;
  }
  let pObject = m.u32((pGame + 0x1520 + (dwObjectGuid & 0x7f) * 4) >>> 0);
  while (pObject !== 0 && m.u32((pObject + 0x0c) >>> 0) !== dwObjectGuid >>> 0) {
    pObject = m.u32((pObject + 0xe4) >>> 0);
  }
  let pPlayer = m.u32((pGame + 0x1120 + (dwPlayerGuid & 0x7f) * 4) >>> 0);
  while (pPlayer !== 0 && m.u32((pPlayer + 0x0c) >>> 0) !== dwPlayerGuid >>> 0) {
    pPlayer = m.u32((pPlayer + 0xe4) >>> 0);
  }
  let pItem = m.u32((pGame + 0x1720 + (dwItemGuid & 0x7f) * 4) >>> 0);
  while (pItem !== 0 && m.u32((pItem + 0x0c) >>> 0) !== dwItemGuid >>> 0) {
    pItem = m.u32((pItem + 0xe4) >>> 0);
  }
  if (pPlayer === 0) {
    if (pObject === 0) {
      FOG_Assert113c('pObject', '0x6fd19ff9', 0x1109);
      return 0;
    }
    return 1;
  }
  if (pObject === 0) return 1;
  let pClient = 0;
  if (m.u32(pPlayer >>> 0) === 0) {
    const pData = UNITS_GetPlayerData113c(m, pPlayer);
    pClient = pData !== 0 ? m.u32((pData + 0x9c) >>> 0) : 0;
  }
  const pktScratch = 0x6fd44e80;
  m.setU8(pktScratch, 0x58);
  m.setU32((pktScratch + 1) >>> 0, dwObjectGuid >>> 0);
  m.setU8((pktScratch + 5) >>> 0, 0);
  m.setU8((pktScratch + 6) >>> 0, 0);
  const nAction = wSubAction & 0xffff;
  if (nAction === 2) {
    m.setU8((pktScratch + 5) >>> 0, 1);
    NET_SendPacketBuffer7B_6FCAAB20_113c(m, pktScratch, pClient);
    UNITS_ChangeAnimMode113c(m, pObject, 0);
    m.setU32((pPlayer + 0x64) >>> 0, 0xffffffff);
    m.setU32((pPlayer + 0x68) >>> 0, 6);
    m.setU8((pPlayer + 0x6c) >>> 0, 0);
    return 1;
  }
  if (nAction !== 3) return 1;
  const nItemClassId = pItem !== 0 ? m.u32((pItem + 0x04) >>> 0) : 0xffffffff;
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemClassId);
  const nObjClassId = m.u32((pObject + 0x04) >>> 0);
  if (nObjClassId === 0x98) {
    if (pItemsTxt === 0 || m.u32((pItemsTxt + 0x80) >>> 0) !== 0x20747368) {
      m.setU8((pktScratch + 5) >>> 0, 4);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pktScratch, pClient);
      return 1;
    }
  } else {
    if (ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, pPlayer, pItem, pGame) === 0) {
      m.setU8((pktScratch + 5) >>> 0, 4);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pktScratch, pClient);
      return 1;
    }
  }
  m.setU32((pPlayer + 0x64) >>> 0, 0xffffffff);
  m.setU32((pPlayer + 0x68) >>> 0, 6);
  m.setU8((pPlayer + 0x6c) >>> 0, 0);
  m.setU8((pktScratch + 5) >>> 0, 5);
  const bResult =
    nObjClassId === 0x98
      ? 1
      : OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c(
          m,
          pItemsTxt !== 0 ? m.u8((pItemsTxt + 0x122) >>> 0) : 0,
          pObject,
          pGame,
        ) & 0xff;
  m.setU8((pktScratch + 6) >>> 0, bResult);
  NET_SendPacketBuffer7B_6FCAAB20_113c(m, pktScratch, pClient);
  if (bResult === 1) {
    UNITS_ChangeAnimMode113c(m, pObject, 1);
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pObject + 0x04) >>> 0));
    if (m.u32((pObject + 0x04) >>> 0) === 0x98) {
      UNITS_ChangeAnimMode113c(m, pObject, 2);
      ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c(m, pGame, pPlayer);
      return 1;
    }
    const nFrames = pObjTxt !== 0 ? m.u32((pObjTxt + 0xdc) >>> 0) >>> 8 : 0;
    const nTargetFrame = (nFrames + m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0;
    EVENT_SetEventFull113c(m, pGame, pObject, 1, nTargetFrame, 0, 0, 0);
    return 1;
  }
  UNITS_ChangeAnimMode113c(m, pObject, 0);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8F520
 * @ordinalOrName D2Game_6FC8F520
 */
export function OBJ_DeactivateShrineOrStashObject_6FC8F520_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC8F520);
  if (pObject !== 0) {
    const wObjId = m.u16((pObject + 0x04) >>> 0);
    if (wObjId === 0x50 || wObjId === 0x5a) {
      const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff;
      OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c(
        m,
        0,
        dwPlayerGuid,
        pGame,
        m.u32((pObject + 0x0c) >>> 0),
        2,
      );
    } else if (wObjId === 0x151) {
      OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c(m, pGame, pObject, pPlayer);
    } else if (wObjId === 0x98) {
      UNITS_ChangeAnimMode113c(m, pObject, 0);
    }
  }
  if (pPlayer !== 0) {
    m.setU32((pPlayer + 0x64) >>> 0, 0xffffffff);
    m.setU32((pPlayer + 0x68) >>> 0, 6);
    m.setU8((pPlayer + 0x6c) >>> 0, 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC94200
 * @ordinalOrName D2Game_6FC94200
 */
export function PLRTRADE_HandleClientTradeButton_6FC94200_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  wButton: number,
  nGoldAmount: number,
): number {
  hitD2GameVa113c(0x6FC94200);
  if (pPlayer === 0) return 1;
  const dwInteractId = m.u32((pPlayer + 0x64) >>> 0);
  const nInteractType = m.u32((pPlayer + 0x68) >>> 0);
  const bActive = m.u8((pPlayer + 0x6c) >>> 0);
  const getClient = (pUnit: number): number => {
    if (pUnit === 0 || m.u32(pUnit >>> 0) !== 0) return 0;
    const pData = UNITS_GetPlayerData113c(m, pUnit);
    return pData !== 0 ? m.u32((pData + 0x9c) >>> 0) : 0;
  };
  const nBtn = wButton & 0xffff;
  if (bActive === 0) {
    const pkt = 0x6fd44e90;
    m.setU8(pkt, 0x77);
    m.setU8((pkt + 1) >>> 0, 0x0c);
    NET_QueuePacketToClientBuffer113c(m, getClient(pPlayer), 1, pkt, 2);
    return 0;
  }
  if (nBtn >= 0x12 && nBtn <= 0x14) {
    if (nInteractType !== 2) return 1;
    STASH_HandleBankGoldOrCloseAction_6FC917E0_113c(
      m,
      pPlayer,
      pGame,
      dwInteractId,
      nBtn,
      nGoldAmount,
    );
    return 0;
  }
  if (nBtn >= 0x17 && nBtn <= 0x18) {
    if (nInteractType !== 4) return 3;
    PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c(m, pPlayer, nBtn, pGame);
    return 0;
  }
  if (nInteractType !== 0) {
    const pkt = 0x6fd44e94;
    m.setU8(pkt, 0x77);
    m.setU8((pkt + 1) >>> 0, 0x0d);
    NET_QueuePacketToClientBuffer113c(m, getClient(pPlayer), 1, pkt, 2);
    return 3;
  }
  const pPartner = SUNIT_GetServerUnit113c(m, pGame, 0, dwInteractId);
  if (pPartner === 0) {
    if (ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPlayer, pGame) === 0) {
      NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0x0c, getClient(pPlayer));
    }
    return 0;
  }
  const pData1 = UNITS_GetPlayerData113c(m, pPlayer);
  const pData2 = UNITS_GetPlayerData113c(m, pPartner);
  const nIdx = (nBtn - 2) >>> 0;
  if (nIdx > 6) return 0;
  if (nIdx === 0) {
    const nState1 = m.u32((pData1 + 0x50) >>> 0);
    const nState2 = m.u32((pData2 + 0x50) >>> 0);
    const bBothOpen =
      (nState1 === 1 || nState1 === 2) && (nState2 === 1 || nState2 === 2);
    if (!bBothOpen) {
      if (
        ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPlayer, pGame) !== 0 ||
        ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPartner, pGame) !== 0
      ) {
        return 0;
      }
    }
    PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(m, pGame, pPlayer, pPartner, pData1, pData2, 9);
    const dwTick = m.u32(0x6fd18d10);
    m.setU32((pData2 + 0x58) >>> 0, dwTick);
    m.setU32((pData1 + 0x58) >>> 0, dwTick);
    return 0;
  }
  if (nIdx === 1) {
    if (
      ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPlayer, pGame) !== 0 ||
      ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPartner, pGame) !== 0
    ) {
      const nSt = m.u32((pData1 + 0x50) >>> 0);
      if (nSt === 7) {
        m.setU32((pData1 + 0x50) >>> 0, 0x0e);
        return 0;
      }
      if (nSt === 8) {
        m.setU32((pData1 + 0x50) >>> 0, 0x0f);
        return 0;
      }
      PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(m, pGame, pPlayer, pPartner, pData1, pData2, 0x0c);
      return 0;
    }
    if (ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c(m, pGame) !== 0) {
      PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(m, pGame, pPlayer, pPartner, pData1, pData2, 9);
      return 0;
    }
    if (m.u32((pData1 + 0x50) >>> 0) !== 2 || m.u32((pData2 + 0x50) >>> 0) !== 1) {
      PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(m, pGame, pPlayer, pPartner, pData1, pData2, 0x0c);
      return 0;
    }
    PLRTRADE_SendTradeAcceptButtonAndSetState3_113c(m, pPlayer, pPartner, pData1, pData2);
    if ((PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c(m, pPlayer, pGame) & 0xff) !== 0) {
      if ((PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c(m, pPartner, pGame) & 0xff) !== 0) {
        const pkt78 = 0x6fd44ea0;
        const fillAndSend78 = (pSrcUnit: number, pDstUnit: number): void => {
          m.setU8(pkt78, 0x78);
          const pName = CLIENTS_GetClientNamePtr_6FC69A20_113c(m, getClient(pSrcUnit));
          for (let i = 0; i < 16; i += 4) {
            m.setU32((pkt78 + 1 + i) >>> 0, pName !== 0 ? m.u32((pName + i) >>> 0) : 0);
          }
          m.setU8((pkt78 + 0x10) >>> 0, 0);
          m.setU32((pkt78 + 0x11) >>> 0, m.u32((pSrcUnit + 0x0c) >>> 0));
          NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c(m, pkt78, getClient(pDstUnit));
        };
        fillAndSend78(pPartner, pPlayer);
        fillAndSend78(pPlayer, pPartner);
        return 0;
      }
      PLAYER_FreePlayerDataField5CList_6FC900C0_113c(m, pPlayer, pGame);
    }
    NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0x0c, getClient(pPlayer));
    NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0x0c, getClient(pPartner));
    return 0;
  }
  if (nIdx === 2) {
    if (
      ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPlayer, pGame) === 0 &&
      ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPartner, pGame) === 0
    ) {
      if (ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c(m, pGame) !== 0) {
        PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(m, pGame, pPlayer, pPartner, pData1, pData2, 9);
        return 0;
      }
      if (
        m.u32((pData1 + 0x50) >>> 0) === 3 &&
        INVENTORY_GetCursorItem113c(m, m.u32((pPlayer + 0x60) >>> 0)) === 0
      ) {
        NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 5, getClient(pPartner));
        if (m.u32((pData1 + 0x50) >>> 0) !== 3) return 0;
        m.setU32((pData1 + 0x50) >>> 0, 4);
        if (m.u32((pData2 + 0x50) >>> 0) !== 4) return 0;
        PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c(m, pData1, pPlayer, pPartner, pGame, pData2);
        const dwTick = m.u32(0x6fd18d10);
        m.setU32((pData2 + 0x58) >>> 0, dwTick);
        m.setU32((pData1 + 0x58) >>> 0, dwTick);
        return 0;
      }
    }
    NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 6, getClient(pPlayer));
    return 0;
  }
  if (nIdx === 5) {
    if (m.u32((pData1 + 0x50) >>> 0) === 4) m.setU32((pData1 + 0x50) >>> 0, 3);
    if (m.u32((pData2 + 0x50) >>> 0) === 4) m.setU32((pData2 + 0x50) >>> 0, 3);
    NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 6, getClient(pPlayer));
    NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 6, getClient(pPartner));
    return 0;
  }
  if (nIdx === 6) {
    const nCurGold = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0) >>> 0;
    let nOffer = nGoldAmount >>> 0;
    if (nOffer > nCurGold) {
      if (
        ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPlayer, pGame) !== 0 ||
        ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPartner, pGame) !== 0
      ) {
        return 0;
      }
      PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(m, pGame, pPlayer, pPartner, pData1, pData2, 9);
      return 0;
    }
    const nPartnerMax = STATLIST_GetUnitGoldBankLimit113c(m, pPartner) >>> 0;
    const nPartnerGold = STATLIST_GetUnitStat113c(m, pPartner, 0x0e, 0) >>> 0;
    if ((nPartnerGold + nOffer) >>> 0 > nPartnerMax) {
      nOffer = (nPartnerMax - nPartnerGold) >>> 0;
    }
    const pTradeRecord = m.u32((pData1 + 0x5c) >>> 0);
    if (pTradeRecord === 0) return 0;
    m.setU32((pTradeRecord + 0x0c) >>> 0, nOffer);
    NET_SendPacket79_GoldInTrade_6FCAB1F0_113c(m, nOffer, 0, getClient(pPartner));
    NET_SendPacket79_GoldInTrade_6FCAB1F0_113c(m, nOffer, 1, getClient(pPlayer));
    return 0;
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC99730
 * @ordinalOrName D2Game_6FC99730
 */
export function PLAYER_HandleDeathCorpseAndSave_6FC99730_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  _uArg0 = 0,
  _uArg1 = 0,
  _uArg2 = 0,
): void {
  hitD2GameVa113c(0x6FC99730);
  const nType = m.u32(pPlayer >>> 0);
  const pPath = m.u32((pPlayer + 0x2c) >>> 0);
  const nY =
    nType === 2 || (nType > 3 && nType <= 5)
      ? m.u32((pPath + 0x10) >>> 0)
      : pPath !== 0
        ? PATH_GetPosY113c(m, pPath)
        : 0;
  const nX =
    nType === 2 || (nType > 3 && nType <= 5)
      ? m.u32((pPath + 0x0c) >>> 0)
      : pPath !== 0
        ? PATH_GetPosX113c(m, pPath)
        : 0;
  const pRoom = UNITS_GetRoom113c(m, pPlayer);
  void nX;
  void nY;
  void pRoom;
  PLAYER_CreateCorpseOnDeath_6FC99210_113c(m, pPlayer, pGame);
  PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c(m, pGame, pPlayer);
  let pClient = 0;
  if (m.u32(pPlayer >>> 0) === 0) {
    const pData = UNITS_GetPlayerData113c(m, pPlayer);
    pClient = pData !== 0 ? m.u32((pData + 0x9c) >>> 0) : 0;
  }
  if (pClient !== 0) {
    m.setU8((pClient + 0x0a) >>> 0, (m.u8((pClient + 0x0a) >>> 0) | 0x08) & 0xff);
  }
  const bSkipSave =
    m.u32(0x6fd31c3c) !== 0 && pClient !== 0 && (m.u16((pClient + 0x0a) >>> 0) & 0x04) === 0;
  if (!bSkipSave) {
    if (pClient === 0) {
      FOG_Assert113c('pClient', '0x6fd19ff9', 0x9d9);
      return;
    }
    PLAYERSAVE_SavePlayerCharacter_6FC74320_113c(m, pGame, pPlayer, (pClient + 0x0d) >>> 0, 0);
  }
  SUNITDMG_FreeAttackerCombatList113c(m, pPlayer, pGame);
  UNITS_ChangeAnimMode113c(m, pPlayer, 0x11);
  SUNIT_InitUnitAnimData113c(m, pPlayer);
  PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c(m, pPlayer, pGame);
  MONSTER_ClearModeEvents113c(m, pGame, pPlayer);
}

/**
 * @dll D2Game.dll
 * @va 0x6FC99E40
 * @ordinalOrName D2Game_6FC99E40
 */
export function PLAYER_ProcessPlayerDeathAndPenalties_6FC99E40_113c(
  m: SparseMemory113c,
  pGame: number,
  pVictim: number,
  _nMode = 0,
  pAttacker = 0,
): void {
  hitD2GameVa113c(0x6FC99E40);
  const bIsDruid =
    pVictim !== 0 &&
    m.u32(pVictim >>> 0) === 0 &&
    m.u32((pVictim + 0x04) >>> 0) === 5;
  const nRemovedTransform = SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c(m, pVictim);
  if (nRemovedTransform !== 0 && bIsDruid) {
    if (pGame === 0) {
      FOG_Assert113c('pGame', '0x6fd19ff9', 0x804);
      return;
    }
    const pInv = m.u32((pVictim + 0x60) >>> 0);
    if (pInv !== 0 && INVENTORY_GetCursorItem113c(m, pInv) !== 0) {
      return;
    }
    PLAYER_SetNeutralOrTownNeutralMode113c(m, pGame, pVictim, 1, 0, 0);
    return;
  }
  PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c(m, pVictim, pGame, pAttacker);
  SUNITDMG_FreeAttackerCombatList113c(m, pVictim, pGame);
  UNITS_ChangeAnimMode113c(m, pVictim, 0);
  let pClient = 0;
  if (pVictim !== 0 && m.u32(pVictim >>> 0) === 0) {
    const pData = UNITS_GetPlayerData113c(m, pVictim);
    pClient = pData !== 0 ? m.u32((pData + 0x9c) >>> 0) : 0;
  }
  if (pClient !== 0) {
    m.setU8((pClient + 0x0a) >>> 0, (m.u8((pClient + 0x0a) >>> 0) | 0x08) & 0xff);
  }
  SUNIT_InitUnitAnimData113c(m, pVictim);
  PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c(m, pVictim, pGame);
  MONSTER_ClearModeEvents113c(m, pGame, pVictim);
  SUNIT_ScheduleModeAnimEvents113c(m, pGame, pVictim);
  if (STATES_CheckState113c(m, pVictim, 7) === 0 && pVictim !== 0) {
    m.setU32((pVictim + 0xc4) >>> 0, (m.u32((pVictim + 0xc4) >>> 0) & 0xfffffffd) >>> 0);
  }
  if (pAttacker !== 0) {
    if (pVictim !== 0 && m.u32(pVictim >>> 0) === 0 && pVictim !== pAttacker) {
      const nAtkType = m.u32(pAttacker >>> 0);
      let bDropEar = false;
      if (nAtkType === 0) {
        bDropEar = true;
      } else if (nAtkType === 1) {
        const pLeader = AIGENERAL_GetPackLeaderUnit113c(m, pAttacker);
        if (pLeader !== 0 && m.u32(pLeader >>> 0) === 0 && pLeader !== pVictim) {
          bDropEar = true;
        }
      }
      if (bDropEar) {
        ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c(m, pVictim, pGame);
      }
    }
    PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c(m, pVictim, pAttacker, pGame);
    ARENA_ProcessKillScoreUpdate113c(m, pGame, pAttacker, pVictim);
  }
  PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c(m, pVictim, pGame);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCC1580
 * @ordinalOrName D2Game_6FCC1580
 */
export function SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c(
  m: SparseMemory113c,
  pPlayer: number,
  pItem: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCC1580);
  if (pPlayer !== 0) {
    m.setU32((pPlayer + 0xc8) >>> 0, (m.u32((pPlayer + 0xc8) >>> 0) & 0xffffffbf) >>> 0);
  }
  if (pItem !== 0) {
    if (ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c(m, pGame, pPlayer, pItem) !== 0) {
      SUNIT_SetUnitEventSound113c(m, pPlayer, 4, pPlayer);
    }
  }
  let pClient = 0;
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pData = UNITS_GetPlayerData113c(m, pPlayer);
    pClient = pData !== 0 ? m.u32((pData + 0x9c) >>> 0) : 0;
  }
  const pktScratch = 0x6fd44ec0;
  m.setU8(pktScratch, 0x3f);
  m.setU8((pktScratch + 1) >>> 0, 0xff);
  m.setU32((pktScratch + 2) >>> 0, 0);
  m.setU16((pktScratch + 6) >>> 0, 0xffff);
  NET_QueuePacketToClientBuffer113c(m, pClient, 1, pktScratch, 8);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDB8D0
 * @ordinalOrName D2Game_6FCDB8D0
 */
export function ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c(
  m: SparseMemory113c,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FCDB8D0);
  const pGame = m.u32(pQuestArg >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuest !== 0 && m.u32(pQuest >>> 0) !== 0x18) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0) return 0;
  const pPlayer = m.u32((pQuestArg + 0x08) >>> 0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pQuestHistory = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestHistory, 0x1b, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestHistory, 0x1b, 1) === 1
  ) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer);
    return 0;
  }
  const pObject = m.u32((pQuestArg + 0x04) >>> 0);
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(
    m,
    pObject !== 0 ? m.u32((pObject + 0x04) >>> 0) : 0xffffffff,
  );
  const nMode = pObject !== 0 ? m.u32((pObject + 0x10) >>> 0) : 0;
  if (nMode === 0) {
    if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x2073736d) === 0) {
      SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer);
      if (m.u8((pQuest + 0x09) >>> 0) !== 0 && m.u8((pQuest + 0x0c) >>> 0) === 0) {
        QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 1);
      }
      return 0;
    }
    UNITS_ChangeAnimMode113c(m, pObject, 1);
    const nFrames = pObjTxt !== 0 ? m.u32((pObjTxt + 0xdc) >>> 0) >>> 8 : 0;
    EVENT_SetEventFull113c(
      m,
      pGame,
      pObject,
      1,
      (nFrames + m.u32((pGame + 0xa8) >>> 0)) >>> 0,
      0,
      0,
      0,
    );
    m.setU16(pQuestState >>> 0, 2);
    m.setU8((pQuest + 0x14) >>> 0, 0);
    m.setU8((pQuest + 0x0b) >>> 0, 3);
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      (mem, g, u, arg) => {
        ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c(mem as SparseMemory113c, g, u, arg);
        return 0;
      },
      0,
      0,
    );
    QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c(m, pGame, pPlayer, 0x2073736d);
    return 0;
  }
  if (nMode !== 2) return 0;
  const pInv = m.u32((pPlayer + 0x60) >>> 0);
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20686668) === 0 ||
    pInv === 0
  ) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer);
    return 0;
  }
  const pWeapon = INVENTORY_GetCompositWeaponMemPort113c(m, pInv);
  if (pWeapon === 0) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer);
    return 0;
  }
  const pWpnTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((pWeapon + 0x04) >>> 0));
  if (pWpnTxt === 0 || m.u32((pWpnTxt + 0x80) >>> 0) !== 0x20686668) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer);
    return 0;
  }
  const nHits = (m.u32((pQuestState + 0x0c) >>> 0) + 1) | 0;
  m.setU32((pQuestState + 0x0c) >>> 0, nHits >>> 0);
  if (nHits <= 2) return 0;
  UNITS_ChangeAnimMode113c(m, pObject, 3);
  m.setU16(pQuestState >>> 0, 3);
  QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c(m, pGame, pPlayer, 0x20686668);
  const pRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame);
  QUESTRECORD_SetQuestState113c(m, pRec, 0x1b, 0x0d);
  QUESTRECORD_SetQuestState113c(m, pRec, 0x1b, 1);
  QUESTRECORD_ClearQuestStateBits2To11_113c(m, pRec, m.u32((pQuest + 0xe0) >>> 0));
  m.setU8((pQuestState + 0x04) >>> 0, 1);
  m.setU8((pQuestState + 0x03) >>> 0, 1);
  m.setU32((pQuestState + 0x08) >>> 0, 4);
  m.setU32((pQuestState + 0x14) >>> 0, 1);
  const wPartyId = SUNITDMG_GetPlayerClientClassId113c(m, pPlayer) & 0xffff;
  if (wPartyId !== 0xffff) {
    PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
      m,
      pGame,
      wPartyId,
      (mem, g, u) => ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c(mem as SparseMemory113c, g, u),
      0,
    );
  }
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 4);
  m.setU8((pQuest + 0x14) >>> 0, 0);
  m.setU8((pQuest + 0x0b) >>> 0, 0x0d);
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0),
    (mem, g, u, arg) => {
      ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c(mem as SparseMemory113c, g, u, arg);
      return 0;
    },
    0,
    0,
  );
  const nDelay = pObjTxt !== 0 ? m.u32((pObjTxt + 0xe4) >>> 0) >>> 8 : 0;
  EVENT_SetEventFull113c(
    m,
    pGame,
    pObject,
    7,
    (nDelay + m.u32((pGame + 0xa8) >>> 0)) >>> 0,
    0,
    0,
    0,
  );
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGame,
    (mem, g, u, arg) => {
      ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c(mem as SparseMemory113c, g, u, arg);
      return 0;
    },
    0,
    pPlayer,
  );
  QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c(m, pGame, 0x0e);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDBCE0
 * @ordinalOrName D2Game_6FCDBCE0
 */
export function ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCDBCE0);
  PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c(m, pPlayer, pGame);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  m.setU32((pPlayerData + 0x4c) >>> 0, 1);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuest !== 0 && m.u32(pQuest >>> 0) !== 0x17) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest !== 0) {
    const pQuestState = m.u32((pQuest + 0x18) >>> 0);
    if (pQuestState !== 0) {
      m.setU32((pQuestState + 0x20) >>> 0, pPlayer);
    }
  }
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pQuestHistory = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0);
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestHistory, 0x1a, 0x0d) !== 0) {
    D2Game_6FCDB4F0_113c(m, pGame, pPlayer);
    return 0;
  }
  let pClient = 0;
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pData = UNITS_GetPlayerData113c(m, pPlayer);
    pClient = pData !== 0 ? m.u32((pData + 0x9c) >>> 0) : 0;
  }
  const pktScratch = 0x6fd44ed0;
  for (let i = 0; i < 16; i += 4) m.setU32((pktScratch + i) >>> 0, 0);
  m.setU8(pktScratch, 0x50);
  m.setU16((pktScratch + 1) >>> 0, 0x0017);
  NET_QueuePacketToClientBuffer113c(m, pClient, 1, pktScratch, 0x0f);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDBDC0
 * @ordinalOrName D2Game_6FCDBDC0
 */
export function ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c(
  m: SparseMemory113c,
  pGame: number,
  pQuest: number,
): number {
  hitD2GameVa113c(0x6FCDBDC0);
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  if (m.u8((pQuestState + 0x02) >>> 0) !== 0) {
    const nTicks = (m.u32((pQuestState + 0x18) >>> 0) + 1) >>> 0;
    m.setU32((pQuestState + 0x18) >>> 0, nTicks);
    if (nTicks < 0x0a || m.u8((pQuestState + 0x06) >>> 0) === 0) {
      return 0;
    }
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0);
    const dwSealGuid = m.u32((pQuestState + 0x08) >>> 0);
    if (pQuestGame === 0) {
      FOG_Assert113c('pGame', '0x6fd19ff9', 0x2d3);
      return 0;
    }
    let pObject = m.u32((pQuestGame + 0x1520 + (dwSealGuid & 0x7f) * 4) >>> 0);
    while (pObject !== 0 && m.u32((pObject + 0x0c) >>> 0) !== dwSealGuid >>> 0) {
      pObject = m.u32((pObject + 0xe4) >>> 0);
    }
    if (pObject === 0) return 0;
    const nY = UNIT_GetPosY113c(m, pObject);
    const nX = UNIT_GetPosX113c(m, pObject);
    const pRoom = UNITS_GetRoom113c(m, pObject);
    if (
      ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c(
        m,
        pRoom,
        nY,
        m.u32((pQuest + 0x04) >>> 0),
        nX,
        pQuestState,
      ) === 0
    ) {
      return 0;
    }
    m.setU8((pQuestState + 0x02) >>> 0, 0);
    m.setU8((pQuestState + 0x01) >>> 0, 0);
    return 1;
  }
  if (m.u8((pQuestState + 0x03) >>> 0) === 0) return 1;
  const rawNow = m.u32(0x6fd18d10) >>> 0;
  const dwNow = rawNow === 0x000fe2f2 ? 0 : rawNow;
  if (m.u8((pQuestState + 0x04) >>> 0) !== 0) {
    if (((m.u32((pQuestState + 0x18) >>> 0) + 0x17318) >>> 0) < dwNow >>> 0) {
      m.setU8((pQuestState + 0x01) >>> 0, 0);
      m.setU8((pQuestState + 0x03) >>> 0, 0);
      m.setU8((pQuestState + 0x04) >>> 0, 0);
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0);
      if (m.u32((pQuestGame + 0x70) >>> 0) === 0) {
        CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c(m, pGame, 0);
      }
      return 1;
    }
  }
  if (((m.u32((pQuestState + 0x18) >>> 0) + 0x15f90) >>> 0) < dwNow >>> 0) {
    if (m.u8((pQuestState + 0x05) >>> 0) !== 0) {
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0);
      if (m.u32((pQuestGame + 0x70) >>> 0) === 0) {
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          pGame,
          (mem, g, u, arg) => ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c(mem as SparseMemory113c, g, u, arg),
          0,
          0,
        );
      }
      m.setU8((pQuestState + 0x05) >>> 0, 0);
    }
    return 0;
  }
  if (((m.u32((pQuestState + 0x18) >>> 0) + 0x124f8) >>> 0) < dwNow >>> 0) {
    if (m.u8((pQuestState + 0x15) >>> 0) === 0) {
      m.setU8((pQuestState + 0x15) >>> 0, 1);
      CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c(m, pGame);
    }
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDBF30
 * @ordinalOrName D2Game_6FCDBF30
 */
export function ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c(
  m: SparseMemory113c,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FCDBF30);
  const pObject = m.u32((pQuestArg + 0x04) >>> 0);
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 0;
  }
  UNITS_ChangeAnimMode113c(m, pObject, 1);
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pQuestArg + 0x10) >>> 0));
  const pGame = m.u32(pQuestArg >>> 0);
  const nFrames = pObjTxt !== 0 ? m.u32((pObjTxt + 0xdc) >>> 0) >>> 7 : 0;
  EVENT_SetEventFull113c(
    m,
    pGame,
    pObject,
    1,
    (nFrames + m.u32((pGame + 0xa8) >>> 0)) >>> 0,
    0,
    0,
    0,
  );
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuest !== 0 && m.u32(pQuest >>> 0) !== 0x17) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0) return 0;
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  const nSealIdx =
    ((pObject !== 0 ? m.u32((pObject + 0x04) >>> 0) : 0xffffffff) - 0x188) >>> 0;
  if (nSealIdx <= 4) {
    m.setU8((pQuestState + 0x0c + nSealIdx) >>> 0, 1);
  }
  if (
    m.u8((pQuestState + 0x0c) >>> 0) !== 0 &&
    m.u8((pQuestState + 0x0d) >>> 0) !== 0 &&
    m.u8((pQuestState + 0x0e) >>> 0) !== 0 &&
    m.u8((pQuestState + 0x0f) >>> 0) !== 0 &&
    m.u8((pQuestState + 0x10) >>> 0) !== 0 &&
    m.u32((pQuestState + 0x48) >>> 0) === 3
  ) {
    ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c(m, pQuestState, pGame);
    if (m.u8((pQuestState + 0x01) >>> 0) === 0) {
      m.setU32((pQuestState + 0x18) >>> 0, 0);
      m.setU8((pQuestState + 0x03) >>> 0, 0);
      m.setU8((pQuestState + 0x02) >>> 0, 1);
      m.setU8((pQuestState + 0x01) >>> 0, 1);
      QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 1, pQuest, 0x6fcdbdc0);
    }
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDC050
 * @ordinalOrName D2Game_6FCDC050
 */
export function ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c(
  m: SparseMemory113c,
  pCoord: number,
  pQuestArg: number,
  nSealBossIdx: number,
): void {
  hitD2GameVa113c(0x6FCDC050);
  const pSealObj = m.u32((pQuestArg + 0x04) >>> 0);
  const pSealRoom = UNITS_GetRoom113c(m, pSealObj);
  const pTargetRoom = ROOM_FindRoomContainingSubtile113c(
    m,
    pSealRoom,
    m.u32(pCoord >>> 0),
    m.u32((pCoord + 4) >>> 0),
  );
  if (pTargetRoom === 0) return;
  const nObjSubtype = nSealBossIdx === 1 ? 0x0d : nSealBossIdx !== 3 ? 0x0f : 0x0e;
  void nObjSubtype;
  const pOutRoomScratch = 0x6fd44ec0;
  m.setU32(pOutRoomScratch, 0);
  QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
    m,
    pTargetRoom,
    pCoord,
    3,
    0x3f11,
    pOutRoomScratch,
    0x64,
  );
  const pFoundRoom = m.u32(pOutRoomScratch);
  if (pFoundRoom !== 0) {
    const pGame = m.u32(pQuestArg >>> 0);
    const pMemPool = m.u32((pGame + 0x1c) >>> 0);
    const nX = m.u32(pCoord >>> 0);
    const nY = m.u32((pCoord + 4) >>> 0);
    const pUnit = UNIT_Alloc113c(m, 2);
    if (pUnit === 0) return;
    m.setU32(pUnit >>> 0, 2);
    m.setU32((pUnit + 0x04) >>> 0, 0x83);
    m.setU32((pUnit + 0x08) >>> 0, pMemPool);
    m.setU32((pUnit + 0x80) >>> 0, pGame);
    let flagsC8 = m.u32((pUnit + 0xc8) >>> 0);
    if (m.u32((pGame + 0x70) >>> 0) !== 0) {
      flagsC8 = (flagsC8 | 0x02000000) >>> 0;
    } else {
      flagsC8 = (flagsC8 & 0xfdffffff) >>> 0;
    }
    m.setU32((pUnit + 0xc8) >>> 0, (flagsC8 | 0x04000000) >>> 0);
    const bAct = DRLG_GetActNoFromLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pFoundRoom));
    m.setU8((pUnit + 0x18) >>> 0, bAct & 0xff);
    m.setU32((pUnit + 0x1c) >>> 0, m.u32((pGame + (bAct & 0xff) * 4 + 0xbc) >>> 0));
    m.setU32((pUnit + 0x74) >>> 0, 0);
    SUNIT_InitUnitSeed113c(m, pUnit, (pGame + 0xd0) >>> 0);
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x10) >>> 0);
    m.setU32((pUnit + 0xd0) >>> 0, 0x0b);
    let nUnitId = (m.u32((pGame + 0x98) >>> 0) + 1) >>> 0;
    if (nUnitId === 0xffffffff) nUnitId = 1;
    m.setU32((pGame + 0x98) >>> 0, nUnitId);
    const pObjData = FOG_Allocation113c(m, 0x38, 0x6fd1b02c, 0x265, pMemPool);
    m.setU32((pUnit + 0x14) >>> 0, pObjData);
    if (pObjData !== 0) {
      for (let i = 0; i < 0x38; i += 4) m.setU32((pObjData + i) >>> 0, 0);
      m.setU32(pObjData >>> 0, DATATBLS_GetObjectsTxtRecord113c(m, 0x83));
    }
    m.setU32((pUnit + 0x10) >>> 0, 0);
    UNITS_AllocStaticPath113c(m, pUnit);
    OBJECTS_InitObjectUnit113c(m, pUnit, pGame, nUnitId, pFoundRoom, nX, nY);
    SUNIT_PlaceServerUnitInRoom113c(m, pFoundRoom, nY, pUnit, nX, pGame, 1);
    DUNGEON_ToggleHasPortalFlag113c(m, pFoundRoom, 0);
    ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c(m, pQuestArg);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDC220
 * @ordinalOrName D2Game_6FCDC220
 */
export function ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c(
  m: SparseMemory113c,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCDC220);
  const pGame = m.u32(pQuestArg >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuest !== 0 && m.u32(pQuest >>> 0) !== 0x17) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0) return;
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  if (m.u8((pQuestState + 0x11) >>> 0) === 0) {
    const pObj = m.u32((pQuestArg + 0x04) >>> 0);
    m.setU8((pQuestState + 0x06) >>> 0, 1);
    m.setU32((pQuestState + 0x08) >>> 0, pObj !== 0 ? m.u32((pObj + 0x0c) >>> 0) : 0xffffffff);
    if (
      m.u8((pQuestState + 0x0c) >>> 0) !== 0 &&
      m.u8((pQuestState + 0x0d) >>> 0) !== 0 &&
      m.u8((pQuestState + 0x0e) >>> 0) !== 0 &&
      m.u8((pQuestState + 0x0f) >>> 0) !== 0 &&
      m.u8((pQuestState + 0x10) >>> 0) !== 0 &&
      m.u32((pQuestState + 0x48) >>> 0) === 3
    ) {
      ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c(m, pQuestState, pGame);
      if (m.u8((pQuestState + 0x01) >>> 0) === 0) {
        m.setU32((pQuestState + 0x18) >>> 0, 0);
        m.setU8((pQuestState + 0x03) >>> 0, 0);
        m.setU8((pQuestState + 0x02) >>> 0, 1);
        m.setU8((pQuestState + 0x01) >>> 0, 1);
        QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 1, pQuest, 0x6fcdbdc0);
      }
    }
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDC2C0
 * @ordinalOrName D2Game_6FCDC2C0
 */
export function ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c(
  m: SparseMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCDC2C0);
  const pVictim = m.u32((pQuestArg + 0x08) >>> 0);
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  if (m.u32((pVictim + 0x04) >>> 0) !== 0xf3) {
    const nKilled = (m.u32((pQuestState + 0x48) >>> 0) + 1) >>> 0;
    m.setU32((pQuestState + 0x48) >>> 0, nKilled);
    if (
      nKilled === 3 &&
      m.u8((pQuestState + 0x0c) >>> 0) !== 0 &&
      m.u8((pQuestState + 0x0d) >>> 0) !== 0 &&
      m.u8((pQuestState + 0x0e) >>> 0) !== 0 &&
      m.u8((pQuestState + 0x0f) >>> 0) !== 0 &&
      m.u8((pQuestState + 0x10) >>> 0) !== 0
    ) {
      ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c(m, pQuestState, m.u32((pQuest + 0x04) >>> 0));
      if (m.u8((pQuestState + 0x01) >>> 0) === 0) {
        m.setU32((pQuestState + 0x18) >>> 0, 0);
        m.setU8((pQuestState + 0x03) >>> 0, 0);
        m.setU8((pQuestState + 0x02) >>> 0, 1);
        m.setU8((pQuestState + 0x01) >>> 0, 1);
        QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 1, pQuest, 0x6fcdbdc0);
      }
    }
    return;
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0);
  if (m.u32((pGame + 0x70) >>> 0) === 0) {
    const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
    if (pQuestControl !== 0) {
      m.setU8((pQuestControl + 0x20) >>> 0, 0x0d);
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGame,
      (mem, g, u, arg) => {
        QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(mem as SparseMemory113c, g, u, arg);
        return 0;
      },
      0,
      0,
    );
  }
  m.setU8((pQuestState + 0x14) >>> 0, 1);
  const pRoom = UNITS_GetRoom113c(m, pVictim);
  if (pRoom === 0) return;
  m.setU32((pQuestState + 0x3c) >>> 0, pRoom);
  const pKiller = m.u32((pQuestArg + 0x0c) >>> 0);
  if (pKiller !== 0) {
    const pState = m.u32((pQuest + 0x18) >>> 0);
    if (m.u8((pState + 0x01) >>> 0) === 0) {
      m.setU8((pState + 0x02) >>> 0, 0);
      m.setU8((pState + 0x03) >>> 0, 1);
      m.setU8((pState + 0x04) >>> 0, 1);
      m.setU8((pState + 0x05) >>> 0, 1);
      m.setU8((pState + 0x15) >>> 0, 0);
      m.setU8((pState + 0x01) >>> 0, 1);
      const rawTick = m.u32(0x6fd18d10) >>> 0;
      m.setU32((pState + 0x18) >>> 0, rawTick === 0x000fe2f2 ? 0 : rawTick);
      QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 1, pQuest, 0x6fcdbdc0);
    }
    if (m.u8((pQuest + 0x09) >>> 0) === 0) return;
    const pArgGame = m.u32(pQuestArg >>> 0);
    const pKillerData = UNITS_GetPlayerData113c(m, pKiller);
    const nDiff = m.u8((pArgGame + 0x6d) >>> 0);
    const pHist = m.u32((pKillerData + nDiff * 4 + 0x10) >>> 0);
    DRLGWARP_TestRoomTileBit113c(m, pHist, 0x1a, 0);
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return;
  m.setU32((pQuestState + 0x1c) >>> 0, 0);
  m.setU8((pQuest + 0x0b) >>> 0, 0x0d);
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0),
    (mem, g, u, arg) => {
      ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c(mem as SparseMemory113c, g, u, arg);
      return 0;
    },
    0,
    0,
  );
  const pArgGame = m.u32(pQuestArg >>> 0);
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pArgGame,
    (mem, g, u, arg) => {
      ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c(mem as SparseMemory113c, g, u, arg);
      return 0;
    },
    0,
    pVictim,
  );
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pArgGame,
    (mem, g, u, arg) => {
      ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c(mem as SparseMemory113c, g, u, arg);
      return 0;
    },
    0,
    pVictim,
  );
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pArgGame,
    (mem, g, u, arg) => {
      ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c(mem as SparseMemory113c, g, u, arg);
      return 0;
    },
    0,
    pVictim,
  );
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pArgGame,
    (mem, g, u, arg) => {
      ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c(mem as SparseMemory113c, g, u, arg);
      return 0;
    },
    0,
    pVictim,
  );
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDC4A0
 * @ordinalOrName D2Game_6FCDC4A0
 */
export function ACT4Q3_OnSeal5Operate_6FCDC4A0_113c(
  m: SparseMemory113c,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FCDC4A0);
  const pObject = m.u32((pQuestArg + 0x04) >>> 0);
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 0;
  }
  const pGame = m.u32(pQuestArg >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuest !== 0 && m.u32(pQuest >>> 0) !== 0x17) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0) return 0;
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  const pCoord = (pQuestState + 0x34) >>> 0;
  PATH_GetTargetTypeAndPosition113c(m, pObject, pCoord);
  m.setU32(pCoord, (m.u32(pCoord) + 0x20) >>> 0);
  m.setU32((pQuestState + 0x38) >>> 0, (m.u32((pQuestState + 0x38) >>> 0) + 0x10) >>> 0);
  ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c(m, pCoord, pQuestArg, 5);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDC510
 * @ordinalOrName D2Game_6FCDC510
 */
export function ACT4Q3_OnSeal3Operate_6FCDC510_113c(
  m: SparseMemory113c,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FCDC510);
  const pObject = m.u32((pQuestArg + 0x04) >>> 0);
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 0;
  }
  const pGame = m.u32(pQuestArg >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuest !== 0 && m.u32(pQuest >>> 0) !== 0x17) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0) return 0;
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  const pCoord = (pQuestState + 0x2c) >>> 0;
  PATH_GetTargetTypeAndPosition113c(m, pObject, pCoord);
  m.setU32(pCoord, (m.u32(pCoord) - 0x27) >>> 0);
  m.setU32((pQuestState + 0x30) >>> 0, (m.u32((pQuestState + 0x30) >>> 0) + 0x21) >>> 0);
  ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c(m, pCoord, pQuestArg, 3);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDC580
 * @ordinalOrName D2Game_6FCDC580
 */
export function ACT4Q3_OnSeal1Operate_6FCDC580_113c(
  m: SparseMemory113c,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FCDC580);
  const pObject = m.u32((pQuestArg + 0x04) >>> 0);
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 0;
  }
  const pGame = m.u32(pQuestArg >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuest !== 0 && m.u32(pQuest >>> 0) !== 0x17) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0) return 0;
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  const pCoord = (pQuestState + 0x24) >>> 0;
  PATH_GetTargetTypeAndPosition113c(m, pObject, pCoord);
  m.setU32(pCoord, (m.u32(pCoord) - 0x0c) >>> 0);
  m.setU32((pQuestState + 0x28) >>> 0, (m.u32((pQuestState + 0x28) >>> 0) - 0x34) >>> 0);
  ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c(m, pCoord, pQuestArg, 1);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDC5F0
 * @ordinalOrName D2Game_6FCDC5F0
 */
export function ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c(
  m: SparseMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FCDC5F0);
  for (let i = 0; i < 0x3c; i += 4) {
    m.setU32((pQuest + 0xa0 + i) >>> 0, 0);
  }
  m.setU8((pQuest + 0x0c) >>> 0, 0);
  m.setU32((pQuest + 0xe8) >>> 0, 0);
  const pGame = m.u32((pQuest + 0x04) >>> 0);
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fcd9070);
  m.setU32((pQuest + 0xc0) >>> 0, 0x6fcdc2c0);
  m.setU32((pQuest + 0xac) >>> 0, 0x6fcda3a0);
  m.setU32((pQuest + 0xa8) >>> 0, 0x6fcdb1b0);
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fcdb250);
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fcd8f20);
  m.setU32((pQuest + 0xd8) >>> 0, 0x6fcd8fe0);
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd265c8);
  m.setU8((pQuest + 0x0a) >>> 0, 1);
  m.setU32((pQuest + 0xe0) >>> 0, 0x1a);
  m.setU8((pQuest + 0x0d) >>> 0, 4);
  m.setU32((pQuest + 0xec) >>> 0, 0x6fcd8970);
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0;
  const pState = FOG_Allocation113c(m, 0x4c, 0x6fd1b3ec, 0x418, pMemPool);
  m.setU32((pQuest + 0x18) >>> 0, pState);
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fcda4f0);
  for (let i = 0; i < 0x4c; i += 4) {
    m.setU32((pState + i) >>> 0, 0);
  }
  void ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c;
  void ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c;
  void ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c;
  void ACT4Q3_InitNpcDialog_6FCD9070_113c;
  void ACT3Q2_Callback03_LevelChanged113c;
  void ACT4Q3_SeqCallback_6FCDA4F0_113c;
  void ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c;
  void ACT4Q3_OnScrollMessage_6FCDB250_113c;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDF810
 * @ordinalOrName D2Game_6FCDF810
 */
export function NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c(
  m: SparseMemory113c,
  pNpc: number,
  pGame: number,
  pPlayer: number,
  bResetShop: number,
  bGamble: number,
): void {
  hitD2GameVa113c(0x6FCDF810);
  if (pNpc === 0) return;
  const pOutSlotScratch = 0x6fd44ec8;
  const pShopRecord = D2GAME_ARENA_FindPlayerSlotByUnit113c(
    m,
    pOutSlotScratch,
    pGame,
    m.u32((pNpc + 0x04) >>> 0),
  );
  if (pShopRecord === 0) return;
  m.setU32((pShopRecord + 0x1c) >>> 0, 1);
  m.setU32((pShopRecord + 0x40) >>> 0, m.u32((pNpc + 0x0c) >>> 0));
  NPCS_BeginVendorOrGambleInteract_6FCDF730_113c(m, pPlayer, pNpc, pGame, bGamble);
  const nClassId = m.u32((pNpc + 0x04) >>> 0);
  if (nClassId === 0x96 || nClassId === 0x203 || nClassId === 0xc6) {
    return;
  }
  if (bResetShop !== 0 && bGamble === 0) {
    if (m.u8((pShopRecord + 0x27) >>> 0) !== 0) {
      const pShopSlot = (pShopRecord + 0x20) >>> 0;
      m.setU8((pShopSlot + 0x07) >>> 0, 0);
      NPCS_ResetVendorSlotInventory_6FCB02E0_113c(m, pGame, pShopRecord, pNpc);
      NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c(m, pGame, pPlayer, pNpc, pShopSlot);
      m.setU8(pShopSlot, 1);
    }
  }
  UNITS_SetUnitUpdateFlags113c(m, pNpc, 1);
  if (bGamble === 0) {
    NPC_TransferInventoryItemsToOwner_6FCDCD90_113c(m, m.u32((pNpc + 0x60) >>> 0), pPlayer);
    return;
  }
  const pGambleInv = SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c(m, pNpc, pGame, pPlayer);
  if (pGambleInv !== 0) {
    NPC_TransferInventoryItemsToOwner_6FCDCD90_113c(m, pGambleInv, pPlayer);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCE00C0
 * @ordinalOrName D2Game_6FCE00C0
 */
export function NPCS_HandleNpcMenuRequest_6FCE00C0_113c(
  m: SparseMemory113c,
  pPlayer: number,
  pGame: number,
  nMenuOption: number,
  dwNpcGuid: number,
  dwItemGuid = 0,
): number {
  hitD2GameVa113c(0x6FCE00C0);
  if (pGame === 0) {
    FOG_Assert113c('pGame', '0x6fd19ff9', 0x2d3);
    return 0;
  }
  let pNpc = m.u32((pGame + 0x1320 + (dwNpcGuid & 0x7f) * 4) >>> 0);
  while (pNpc !== 0 && m.u32((pNpc + 0x0c) >>> 0) !== dwNpcGuid >>> 0) {
    pNpc = m.u32((pNpc + 0xe4) >>> 0);
  }
  if (pNpc === 0 || pPlayer === 0) return 0;
  const nNpcClassId = m.u32((pNpc + 0x04) >>> 0);
  if (MONSTATS_CheckFlagBit113c(m, nNpcClassId, 9) === 0) return 0;
  if (m.u32(pNpc >>> 0) !== 1) return 0;
  const pMonsterData = m.u32((pNpc + 0x14) >>> 0);
  if (pMonsterData === 0) return 0;
  const pInteract = m.u32((pMonsterData + 0x30) >>> 0);
  if (pInteract === 0) return 0;
  const bResetShop = MONSTER_CountInteractingPlayers113c(m, pInteract) === 1 ? 1 : 0;
  if (nMenuOption === 1) {
    const bCanTrade =
      nNpcClassId === 0x93 ||
      nNpcClassId === 0x94 ||
      nNpcClassId === 0x9a ||
      nNpcClassId === 0xb1 ||
      nNpcClassId === 0xb2 ||
      nNpcClassId === 0xc7 ||
      nNpcClassId === 0xca ||
      (nNpcClassId >= 0xfc && nNpcClassId <= 0xff) ||
      nNpcClassId === 0x101 ||
      nNpcClassId === 0x195 ||
      (nNpcClassId >= 0x1ff && nNpcClassId <= 0x201);
    if (!bCanTrade) return 0;
    MONSTER_PromotePlayerInteractToTradeState113c(m, pNpc, pPlayer);
    NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c(m, pNpc, pGame, pPlayer, bResetShop, 0);
    return 0;
  }
  if (nMenuOption === 2) {
    const bCanGamble =
      nNpcClassId === 0x93 ||
      nNpcClassId === 0xc7 ||
      nNpcClassId === 0xfe ||
      nNpcClassId === 0x195 ||
      nNpcClassId === 0x200 ||
      nNpcClassId === 0x202;
    if (!bCanGamble) return 0;
    MONSTER_PromotePlayerInteractToTradeState113c(m, pNpc, pPlayer);
    NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c(m, pNpc, pGame, pPlayer, bResetShop, 1);
    return 0;
  }
  if (nMenuOption === 3) {
    MONSTER_CountInteractingPlayers113c(m, MONSTER_GetInteractDataPtr_6FC21370_113c(m, pNpc));
    const pClient =
      m.u32(pPlayer >>> 0) === 0 ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0) : 0;
    NPC_SendHirelingListPacketsToClient_6FCDD330_113c(m, pNpc, pGame, pClient);
    return 0;
  }
  const pkt58 = 0x6fd44ed0;
  m.fill(pkt58, 8, 0);
  const pDropStruct = 0x6fd44f00;
  const pCoordScratch = 0x6fd44ee0;
  const pOutCoordScratch = 0x6fd44ee8;
  const getClient = (): number =>
    m.u32(pPlayer >>> 0) === 0 ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0) : 0;
  const lookupItem = (guid: number): number => {
    let cur = m.u32((pGame + 0x1720 + (guid & 0x7f) * 4) >>> 0);
    while (cur !== 0 && m.u32((cur + 0x0c) >>> 0) !== guid >>> 0) {
      cur = m.u32((cur + 0xe4) >>> 0);
    }
    return cur;
  };
  const placeOrDropReward = (pNewItem: number, nLine: number): void => {
    const dwNewGuid = pNewItem !== 0 ? m.u32((pNewItem + 0x0c) >>> 0) : 0xffffffff;
    if (
      ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c(
        m,
        0x6fd1b3a4,
        nLine,
        pGame,
        pPlayer,
        dwNewGuid,
        0,
        0,
        1,
        1,
        0,
      ) === 0
    ) {
      UNITS_ChangeAnimMode113c(m, pNewItem, 3);
      PATH_GetTargetTypeAndPosition113c(m, pPlayer, pCoordScratch);
      const pRoom = ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(
        m,
        UNITS_GetRoom113c(m, pPlayer),
        pCoordScratch,
        pOutCoordScratch,
        1,
      );
      ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(
        m,
        m.u32((pOutCoordScratch + 4) >>> 0),
        pNewItem,
        pRoom,
        pGame,
        0,
        m.u32(pOutCoordScratch),
      );
    }
  };
  if (nNpcClassId === 0x9a) {
    const pClient = getClient();
    m.setU8(pkt58, 0x58);
    m.setU32((pkt58 + 1) >>> 0, dwNpcGuid >>> 0);
    m.setU8((pkt58 + 6) >>> 0, 0);
    if (INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c(m, pPlayer, dwItemGuid) === 0) return 3;
    const pItem = lookupItem(dwItemGuid);
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame);
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 3, 1) === 0) {
      m.setU8((pkt58 + 5) >>> 0, 7);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
      ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, dwItemGuid, pGame, pPlayer);
      return 0;
    }
    if (pItem === 0) return 0;
    if (ITEMS_CheckIfImbueable113c(m, pItem) === 0) {
      m.setU8((pkt58 + 5) >>> 0, 7);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
      ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, dwItemGuid, pGame, pPlayer);
      return 0;
    }
    ITEMS_PopulateItemDropStruct_6FC2E410_113c(m, pDropStruct, pItem, pGame);
    const nEthBits = (ITEMS_CheckEtherealFlag113c(m, pItem) !== 0 ? 4 : 2) | 0x20;
    m.setU32((pDropStruct + 0x80) >>> 0, (m.u32((pDropStruct + 0x80) >>> 0) | nEthBits) >>> 0);
    m.setU16((pDropStruct + 0x2a) >>> 0, m.u16((pGame + 0x78) >>> 0));
    const bPersonalized = ITEMS_TestFlagMask113c(m, ITEMS_GetCommandFlags113c(m, pItem), 0x1000000) !== 0;
    const pSavedEarName = (pDropStruct + 0x84) >>> 0;
    if (bPersonalized) {
      const pEar = ITEMS_GetEarName113c(m, pItem);
      for (let i = 0; i < 16; i += 1) {
        const ch = pEar !== 0 ? m.u8((pEar + i) >>> 0) : 0;
        m.setU8((pSavedEarName + i) >>> 0, ch);
        if (ch === 0) break;
      }
    }
    if (ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, pPlayer, pItem, pGame) === 0) {
      m.setU8((pkt58 + 5) >>> 0, 7);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
      ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, dwItemGuid, pGame, pPlayer);
      return 0;
    }
    m.setU32((pDropStruct + 0x30) >>> 0, 6);
    let nIlvl = ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, pGame, pPlayer, 0) | 0;
    if (nIlvl > 5) nIlvl += 4;
    m.setU32((pDropStruct + 0x0c) >>> 0, nIlvl >>> 0);
    const pNewItem = D2GAME_CreateItemEx_6FC31490_113c(m, pGame, pDropStruct, 0) >>> 0;
    if (pNewItem === 0) {
      m.setU8((pkt58 + 5) >>> 0, 7);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
      return 0;
    }
    NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c(m, 0, pNewItem, pGame);
    ITEMS_OnCharmPlacedInInventory_6FCF6710_113c(m, pPlayer, pNewItem, pGame);
    ITEMS_SetInvPage113c(m, pNewItem, 0);
    if (bPersonalized) {
      ITEMS_SetOrClearCommandFlags113c(m, pNewItem, 0x1000000, 1);
      ITEMS_SetEarName113c(m, pNewItem, pSavedEarName);
    }
    placeOrDropReward(pNewItem, 0xba9);
    ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c(m, pPlayer, pGame);
    m.setU8((pkt58 + 5) >>> 0, 6);
    NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
    return 0;
  }
  if (nNpcClassId === 0x94) {
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame);
    if (
      m.u8((pGame + 0x6d) >>> 0) === 2 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 1, 0) === 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x29, 1) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x29, 0) === 0
    ) {
      ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c(m, pPlayer, pGame);
    }
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x29, 1) === 0) return 0;
    SKILLS_RespecPlayerClassSkills_6FCC1280_113c(m, pPlayer, pGame);
    PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c(m, pPlayer);
    SUNIT_SetUnitEventSound113c(m, pPlayer, 2, pPlayer);
    ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c(m, pPlayer, pGame);
    return 0;
  }
  if (nNpcClassId === 0x1ff) {
    const pClient = getClient();
    m.setU8(pkt58, 0x58);
    m.setU32((pkt58 + 1) >>> 0, dwNpcGuid >>> 0);
    if (INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c(m, pPlayer, dwItemGuid) === 0) return 3;
    const pItem = lookupItem(dwItemGuid);
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame);
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x23, 1) === 0) {
      m.setU8((pkt58 + 5) >>> 0, 7);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
      ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, dwItemGuid, pGame, pPlayer);
      return 0;
    }
    if (pItem === 0) return 0;
    if (ITEMS_CanItemBeSocketedByQuest113c(m, pItem) === 0) {
      m.setU8((pkt58 + 5) >>> 0, 7);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
      ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, dwItemGuid, pGame, pPlayer);
      return 0;
    }
    const pNewItem = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(m, pGame, pItem, 1);
    if (pNewItem === 0 || ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, pPlayer, pItem, pGame) === 0) {
      m.setU8((pkt58 + 5) >>> 0, 7);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
      ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, dwItemGuid, pGame, pPlayer);
      return 0;
    }
    ITEMS_SetOrClearCommandFlags113c(m, pNewItem, 0x800, 1);
    let nSockets = ITEMS_GetMaxSocketsFromItemType113c(m, pNewItem) & 0xff;
    const nQual = ITEMS_GetItemQuality113c(m, pNewItem) | 0;
    if (nQual === 4) {
      if (nSockets >= 2) nSockets = 2;
      nSockets = (SEED_RollLimitedFast113c(m, ITEMS_GetItemSeed113c(m, pNewItem), nSockets) + 1) >>> 0;
    } else if (nQual > 4 && nQual <= 9) {
      if (nSockets >= 1) nSockets = 1;
    }
    ITEMS_GetMissileWeaponVelocity113c(m, pNewItem, nSockets);
    NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c(m, 0, pNewItem, pGame);
    ITEMS_OnCharmPlacedInInventory_6FCF6710_113c(m, pPlayer, pNewItem, pGame);
    ITEMS_SetInvPage113c(m, pNewItem, 0);
    placeOrDropReward(pNewItem, 0xc36);
    ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F_6FC785C0_113c(m, pPlayer, pGame);
    m.setU8((pkt58 + 5) >>> 0, 6);
    NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
    return 0;
  }
  if (nNpcClassId === 0x200) {
    const pClient = getClient();
    m.setU8(pkt58, 0x58);
    m.setU32((pkt58 + 1) >>> 0, dwNpcGuid >>> 0);
    if (INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c(m, pPlayer, dwItemGuid) === 0) return 3;
    const pItem = lookupItem(dwItemGuid);
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame);
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x26, 1) === 0 || (pItem !== 0 && ITEMS_CanItemBeDroppedOrSold113c(m, pItem) === 0)) {
      m.setU8((pkt58 + 5) >>> 0, 7);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
      ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, dwItemGuid, pGame, pPlayer);
      return 0;
    }
    if (pItem === 0) return 0;
    const pNewItem = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(m, pGame, pItem, 1);
    if (pNewItem === 0 || ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, pPlayer, pItem, pGame) === 0) {
      m.setU8((pkt58 + 5) >>> 0, 7);
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
      ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, dwItemGuid, pGame, pPlayer);
      return 0;
    }
    NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c(m, 0, pNewItem, pGame);
    ITEMS_OnCharmPlacedInInventory_6FCF6710_113c(m, pPlayer, pNewItem, pGame);
    ITEMS_SetInvPage113c(m, pNewItem, 0);
    placeOrDropReward(pNewItem, 0xc91);
    ITEMS_SetOrClearCommandFlags113c(m, pNewItem, 0x1000000, 1);
    ITEMS_SetEarName113c(m, pNewItem, UNITS_GetPlayerData113c(m, pPlayer));
    ACT5Q4_CompletePersonalizationReward_6FC777F0_113c(m, pPlayer, pGame);
    m.setU8((pkt58 + 5) >>> 0, 6);
    NET_SendPacketBuffer7B_6FCAAB20_113c(m, pkt58, pClient);
    return 0;
  }
  const travelToAct = (nQuestId: number, nDestLvl: number): void => {
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame);
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, nQuestId, 0) === 0) return;
    D2Game_6FCEF810_113c(m, pPlayer, pGame, nDestLvl, 0);
    QUESTS_OnBossActChangeOrBossKill_6FC56890_113c(m, pNpc, pPlayer, pGame);
    if (WAYPOINT_GetWaypointNoFromLevelId113c(m, nDestLvl, pCoordScratch) !== 0) {
      WAYPOINT_ActivateWaypoint113c(
        m,
        PLAYER_GetWaypointDataForDifficulty_6FC21720_113c(m, pPlayer, pGame),
        m.u16(pCoordScratch),
      );
    }
  };
  if (nNpcClassId === 0x9b) {
    travelToAct(6, 0x28);
  } else if (nNpcClassId === 0xaf) {
    D2Game_6FCEF810_113c(m, pPlayer, pGame, 1, 5);
  } else if (nNpcClassId === 0xd2 && nMenuOption === 0) {
    travelToAct(0x0e, 0x4b);
  } else if (nNpcClassId === 0x108 && nMenuOption === 0) {
    D2Game_6FCEF810_113c(m, pPlayer, pGame, 0x28, 5);
  } else if (nNpcClassId === 0x16f && nMenuOption === 0 && m.u32((pGame + 0x70) >>> 0) !== 0) {
    travelToAct(0x1a, 0x6d);
  } else if (nNpcClassId === 0x208 && nMenuOption === 0) {
    D2Game_6FCEF810_113c(m, pPlayer, pGame, 0x67, 5);
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCE7ED0
 * @ordinalOrName D2Game_6FCE7ED0
 */
export function ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c(
  m: SparseMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FCE7ED0);
  for (let i = 0; i < 0x3c; i += 4) {
    m.setU32((pQuest + 0xa0 + i) >>> 0, 0);
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0);
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd23988);
  m.setU8((pQuest + 0x0a) >>> 0, 1);
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0;
  const pState = FOG_Allocation113c(m, 0x30, 0x6fd1b314, 0x3ed, pMemPool);
  m.setU32((pQuest + 0x18) >>> 0, pState);
  m.setU32((pQuest + 0xe0) >>> 0, 0x0a);
  m.setU32((pQuest + 0xe8) >>> 0, 0x6fce3bd0);
  m.setU8((pQuest + 0x0d) >>> 0, 0);
  m.setU32((pQuest + 0xec) >>> 0, 0x6fce5440);
  m.setU32((pQuest + 0xac) >>> 0, 0x6fce3ec0);
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fce5310);
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fce7dc0);
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fce3eb0);
  m.setU32((pQuest + 0xb0) >>> 0, 0x6fce5f30);
  m.setU32((pQuest + 0xb4) >>> 0, 0x6fce3e10);
  m.setU32((pQuest + 0xc0) >>> 0, 0x6fce2450);
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fce3a80);
  m.setU32((pQuest + 0xd8) >>> 0, 0x6fce39b0);
  m.setU32((pQuest + 0xc4) >>> 0, 0x6fce23c0);
  for (let i = 0; i < 0x30; i += 4) {
    m.setU32((pState + i) >>> 0, 0);
  }
  m.setU8((pQuest + 0x0b) >>> 0, 0x0d);
  void ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c;
  void ACT2Q2_NoOp_6FCE2450_113c;
  void ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c;
  void ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c;
  void ACT2Q2_StatusFilter_6FCE3BD0_113c;
  void ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c;
  void ACT2Q2_Callback10_RemovePlayerGuid_6FCE3EB0_113c;
  void ACT2Q2_Callback03_LevelChanged113c;
  void ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c;
  void ACT2Q2_ActiveFilter_6FCE5440_113c;
  void ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCE9F60
 * @ordinalOrName D2Game_6FCE9F60
 */
export function ACT2Q6_InitQuestTableRecord_6FCE9F60_113c(
  m: SparseMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FCE9F60);
  for (let i = 0; i < 0x3c; i += 4) {
    m.setU32((pQuest + 0xa0 + i) >>> 0, 0);
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0);
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fce2b00);
  m.setU32((pQuest + 0xac) >>> 0, 0x6fce6450);
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fce8050);
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fce2af0);
  m.setU32((pQuest + 0xa8) >>> 0, 0x6fce5a60);
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fce2900);
  m.setU32((pQuest + 0xd8) >>> 0, 0x6fce29c0);
  m.setU32((pQuest + 0xc0) >>> 0, 0x6fce97d0);
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd25318);
  m.setU8((pQuest + 0x0a) >>> 0, 1);
  m.setU8((pQuest + 0x0c) >>> 0, 0);
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0;
  const pState = FOG_Allocation113c(m, 0x68, 0x6fd1b258, 0x442, pMemPool);
  m.setU32((pQuest + 0x18) >>> 0, pState);
  m.setU32((pQuest + 0xe0) >>> 0, 0x0e);
  m.setU32((pQuest + 0xe8) >>> 0, 0x6fce1d30);
  m.setU8((pQuest + 0x0d) >>> 0, 4);
  m.setU32((pQuest + 0xec) >>> 0, 0x6fce1c20);
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fce6390);
  for (let i = 0; i < 0x68; i += 4) {
    m.setU32((pState + i) >>> 0, 0);
  }
  m.setU8((pState + 0x01) >>> 0, 0);
  m.setU8((pState + 0x02) >>> 0, 0);
  m.setU8((pState + 0x03) >>> 0, 0);
  m.setU32((pState + 0x18) >>> 0, 0);
  m.setU32((pState + 0x1c) >>> 0, 0);
  m.setU32((pState + 0x34) >>> 0, 0);
  void ACT2Q6_ActiveFilter_6FCE1C20_113c;
  void ACT2Q6_StatusFilter_6FCE1D30_113c;
  void ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c;
  void ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c;
  void ACT2Q6_Callback10_RemovePlayerGuid_6FCE2AF0_113c;
  void ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c;
  void ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c;
  void ACT2Q3_SeqCallback_6FCE6390_113c;
  void ACT2Q3_Callback03_LevelChanged113c;
  void ACT2Q6_OnDurielKilled_6FCE97D0_113c;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEF400
 * @ordinalOrName D2Game_6FCEF400
 */
export function C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEF400);
  if (nPacketLen !== 5) return 3;
  const dwItemGuid = m.u32((pPacket + 1) >>> 0);
  if (pGame === 0) {
    FOG_Assert113c('pGame', '0x6fd19ff9', 0x2d3);
    return 0;
  }
  let pItem = m.u32((pGame + 0x1720 + (dwItemGuid & 0x7f) * 4) >>> 0);
  while (pItem !== 0 && m.u32((pItem + 0x0c) >>> 0) !== dwItemGuid >>> 0) {
    pItem = m.u32((pItem + 0xe4) >>> 0);
  }
  if (pItem === 0 && dwItemGuid >>> 0 !== 0xffffffff) {
    return 1;
  }
  SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c(m, pPlayer, pItem, pGame);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEFB30
 * @ordinalOrName D2Game_6FCEFB30
 */
export function C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEFB30);
  if (nPacketLen !== 0x0d) return 3;
  const nMenuOption = m.u32((pPacket + 1) >>> 0);
  const dwNpcGuid = m.u32((pPacket + 5) >>> 0);
  const dwItemGuid = m.u32((pPacket + 9) >>> 0);
  const nRes = C2S_ValidateTargetUnitDistance113c(m, 1, dwNpcGuid, pGame, pPlayer, 0x32);
  if (nRes !== 0) return nRes;
  return NPCS_HandleNpcMenuRequest_6FCE00C0_113c(
    m,
    pPlayer,
    pGame,
    nMenuOption,
    dwNpcGuid,
    dwItemGuid,
  );
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF0E90
 * @ordinalOrName D2Game_6FCF0E90
 */
export function C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCF0E90);
  if (nPacketLen !== 0x11) return 3;
  const dwObjectGuid = m.u32((pPacket + 5) >>> 0);
  const dwItemGuid = m.u32((pPacket + 9) >>> 0);
  const wSubAction = m.u16((pPacket + 0x0d) >>> 0);
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const bHasInteractOrCursor =
      m.u8((pPlayer + 0x6c) >>> 0) !== 0 ||
      INVENTORY_GetCursorItem113c(m, m.u32((pPlayer + 0x60) >>> 0)) !== 0 ||
      m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x4c) >>> 0) !== 0;
    if (
      bHasInteractOrCursor &&
      m.u8((pPlayer + 0x6c) >>> 0) !== 0 &&
      m.u32((pPlayer + 0x68) >>> 0) === 0 &&
      SUNIT_GetServerUnit113c(m, pGame, 0, m.u32((pPlayer + 0x64) >>> 0)) !== 0
    ) {
      return 3;
    }
  }
  const nDistRes = C2S_ValidateTargetUnitDistance113c(m, 2, dwObjectGuid, pGame, pPlayer, 0x32);
  if (nDistRes !== 0) return nDistRes;
  if (wSubAction !== 2) {
    if (wSubAction !== 3) return 2;
    const nCursorRes = C2S_ValidateCursorItem_6FCECF70_113c(m, pGame, dwItemGuid, pPlayer);
    if (nCursorRes !== 0) return nCursorRes;
  }
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff;
  OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c(
    m,
    dwItemGuid,
    dwPlayerGuid,
    pGame,
    dwObjectGuid,
    wSubAction,
  );
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF1470
 * @ordinalOrName D2Game_6FCF1470
 */
export function C2S_HandlePacket4F_TradeButton_6FCF1470_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCF1470);
  if (nPacketLen !== 7) return 3;
  const wButton = m.u16((pPacket + 1) >>> 0);
  const nGoldAmount = ((m.u16((pPacket + 3) >>> 0) << 16) | m.u16((pPacket + 5) >>> 0)) >>> 0;
  return PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, pPlayer, wButton, nGoldAmount);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF14B0
 * @ordinalOrName D2Game_6FCF14B0
 */
export function C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  _pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCF14B0);
  if (nPacketLen !== 1) return 3;
  if (pPlayer === 0 || m.u32((pPlayer + 0x10) >>> 0) !== 0x11) {
    return 0;
  }
  const pClient =
    m.u32(pPlayer >>> 0) === 0 ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0) : 0;
  if (pClient !== 0 && (m.u8((pClient + 0x0a) >>> 0) & 0x04) !== 0) {
    CLIENT_NotifyAndDisconnectClient_6FC4D090_113c(m, pClient, pGame, 3);
    return 0;
  }
  SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c(m, pPlayer);
  const nMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pPlayer);
  const nMaxMana = STATLIST_GetMaxManaFromUnit113c(m, pPlayer);
  const nMaxStam = STATLIST_GetMaxStaminaFromUnit113c(m, pPlayer);
  STATLIST_SetUnitStat113c(m, pPlayer, 6, nMaxLife, 0);
  STATLIST_SetUnitStat113c(m, pPlayer, 8, nMaxMana, 0);
  STATLIST_SetUnitStat113c(m, pPlayer, 0x0a, nMaxStam, 0);
  D2GAME_PLRMODES_SendStatToClientOrParty113c(m, pPlayer, 6, pPlayer, nMaxLife);
  D2GAME_PLRMODES_SendStatToClientOrParty113c(m, pPlayer, 8, pPlayer, nMaxMana);
  D2GAME_PLRMODES_SendStatToClientOrParty113c(m, pPlayer, 0x0a, pPlayer, nMaxStam);
  m.setU32((pPlayer + 0xc4) >>> 0, (m.u32((pPlayer + 0xc4) >>> 0) | 2) >>> 0);
  STATES_ToggleGfxStateFlag113c(m, pPlayer, 0x36, 1);
  STATES_ToggleGfxStateFlag113c(m, pPlayer, 0x36, 0);
  DRLG_GetActNoFromLevelId113c(m, 0);
  const bAct =
    DRLG_GetActNoFromLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, UNITS_GetRoom113c(m, pPlayer))) &
    0xff;
  const nTownLevelId = DUNGEON_GetActLevelId113c(m, bAct);
  PLAYER_ChangeLevelOrActTransition_6FCBE170_113c(m, pPlayer, nTownLevelId, pGame, 0);
  PLAYER_StartModeAtCoords113c(m, pGame, pPlayer, 1, 0, 0, 1, 0);
  const pLeftSkill = UNITS_GetLeftSkill113c(m, pPlayer);
  if (pLeftSkill !== 0) {
    const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pLeftSkill, 0x6fd1b188, 0x11a5);
    const dwOwnerItem = SKILLS_GetOwnerItemGuid113c(m, pLeftSkill);
    SKILLS_AssignHandSkillAndSyncAura113c(m, pPlayer, 1, nSkillId, dwOwnerItem);
  }
  const pRightSkill = UNITS_GetRightSkill113c(m, pPlayer);
  if (pRightSkill !== 0) {
    const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pRightSkill, 0x6fd1b188, 0x11aa);
    const dwOwnerItem = SKILLS_GetOwnerItemGuid113c(m, pRightSkill);
    SKILLS_AssignHandSkillAndSyncAura113c(m, pPlayer, 0, nSkillId, dwOwnerItem);
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FD09200
 * @ordinalOrName D2Game_6FD09200
 */
export function ACT3Q5_InitQuestTableRecord_6FD09200_113c(
  m: SparseMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FD09200);
  for (let i = 0; i < 0x3c; i += 4) {
    m.setU32((pQuest + 0xa0 + i) >>> 0, 0);
  }
  m.setU8((pQuest + 0x0c) >>> 0, 0);
  m.setU32((pQuest + 0xe8) >>> 0, 0);
  const pGame = m.u32((pQuest + 0x04) >>> 0);
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fd03970);
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd21c50);
  m.setU8((pQuest + 0x0a) >>> 0, 1);
  m.setU32((pQuest + 0xc0) >>> 0, 0x6fd07db0);
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fd089a0);
  m.setU32((pQuest + 0xac) >>> 0, 0x6fd07560);
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fd03850);
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fd03960);
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fd02a40);
  m.setU32((pQuest + 0x10) >>> 0, 0x14);
  m.setU32((pQuest + 0xe0) >>> 0, 0x15);
  m.setU32((pQuest + 0xec) >>> 0, 0x6fd02ab0);
  m.setU8((pQuest + 0x0d) >>> 0, 6);
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0;
  const pState = FOG_Allocation113c(m, 0x50, 0x6fd1aec0, 0x425, pMemPool);
  m.setU32((pQuest + 0x18) >>> 0, pState);
  for (let i = 0; i < 0x50; i += 4) {
    m.setU32((pState + i) >>> 0, 0);
  }
  void QUESTS_ChainStatusFilterNotState7_6FD02A40_113c;
  void ACT3Q5_BlackenedTempleActiveFilter113c;
  void ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c;
  void ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c;
  void ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c;
  void ACT3Q6_Callback03_LevelChanged113c;
  void ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c;
}

/**
 * @dll D2Game.dll
 * @va 0x6FD092D0
 * @ordinalOrName D2Game_6FD092D0
 */
export function ACT3Q1_InitQuestTableRecord_6FD092D0_113c(
  m: SparseMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FD092D0);
  for (let i = 0; i < 0x3c; i += 4) {
    m.setU32((pQuest + 0xa0 + i) >>> 0, 0);
  }
  m.setU8((pQuest + 0x0c) >>> 0, 0);
  m.setU8((pQuest + 0x0d) >>> 0, 0);
  m.setU16((pQuest + 0x9c) >>> 0, 0);
  const pGame = m.u32((pQuest + 0x04) >>> 0);
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fd03e30);
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd21568);
  m.setU8((pQuest + 0x0a) >>> 0, 1);
  m.setU32((pQuest + 0xe0) >>> 0, 0x14);
  m.setU32((pQuest + 0xec) >>> 0, 0x6fd04030);
  m.setU32((pQuest + 0xe8) >>> 0, 0x6fd03ce0);
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fd02b70);
  m.setU32((pQuest + 0x10) >>> 0, 0x10);
  m.setU32((pQuest + 0xb0) >>> 0, 0x6fd07640);
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fd08b60);
  m.setU32((pQuest + 0xac) >>> 0, 0x6fd03e00);
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fd03b40);
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fd03b30);
  m.setU32((pQuest + 0xd8) >>> 0, 0x6fd06a60);
  m.setU32((pQuest + 0xc4) >>> 0, 0x6fd06b20);
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0;
  const pState = FOG_Allocation113c(m, 0x1c, 0x6fd1aef8, 0x340, pMemPool);
  m.setU32((pQuest + 0x18) >>> 0, pState);
  for (let i = 0; i < 0x1c; i += 4) {
    m.setU32((pState + i) >>> 0, 0);
  }
  m.setU8((pState + 0x0c) >>> 0, 1);
  m.setU8((pState + 0x01) >>> 0, 1);
  void QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c;
  void ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c;
  void ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c;
  void ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c;
  void ACT3Q0_Callback03_LevelChanged113c;
  void ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c;
  void ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c;
  void ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c;
  void ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c;
  void ACT3Q1_OnQuestItemPickedUp_6FD07640_113c;
}

/**
 * @dll D2Game.dll
 * @va 0x6FD093C0
 * @ordinalOrName D2Game_6FD093C0
 */
export function ACT3Q4_InitQuestTableRecord_6FD093C0_113c(
  m: SparseMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FD093C0);
  for (let i = 0; i < 0x3c; i += 4) {
    m.setU32((pQuest + 0xa0 + i) >>> 0, 0);
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0);
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd20088);
  m.setU8((pQuest + 0x0a) >>> 0, 1);
  m.setU8((pQuest + 0x0c) >>> 0, 0);
  m.setU32((pQuest + 0xe0) >>> 0, 0x11);
  m.setU8((pQuest + 0x0d) >>> 0, 4);
  m.setU32((pQuest + 0xe8) >>> 0, 0x6fd06e00);
  m.setU32((pQuest + 0xec) >>> 0, 0x6fd053f0);
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fd02f00);
  m.setU32((pQuest + 0x10) >>> 0, 0x13);
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0;
  const pState = FOG_Allocation113c(m, 0xa0, 0x6fd1afa0, 0x3ad, pMemPool);
  m.setU32((pQuest + 0x18) >>> 0, pState);
  m.setU32((pQuest + 0xb0) >>> 0, 0x6fd07af0);
  m.setU32((pQuest + 0xb4) >>> 0, 0x6fd07a40);
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fd05270);
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fd08fe0);
  m.setU32((pQuest + 0xac) >>> 0, 0x6fd07be0);
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fd050c0);
  m.setU32((pQuest + 0xd8) >>> 0, 0x6fd06f60);
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fd05220);
  m.setU32((pQuest + 0xc4) >>> 0, 0x6fd06fe0);
  for (let i = 0; i < 0xa0; i += 4) {
    m.setU32((pState + i) >>> 0, 0);
  }
  m.setU8((pState + 0x01) >>> 0, 0);
  m.setU8((pState + 0x02) >>> 0, 0);
  m.setU16((pState + 0x9c) >>> 0, 0);
  m.setU8(pState >>> 0, 1);
  void QUESTS_ChainStatusFilterNotState5_6FD02F00_113c;
  void ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c;
  void ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c;
  void ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c;
  void ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c;
  void ACT3Q4_StatusFilter_6FD06E00_113c;
  void ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c;
  void ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c;
  void ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c;
  void ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c;
  void ACT3Q5_Callback03_LevelChanged113c;
}

/**
 * @dll D2Game.dll
 * @va 0x6FD094C0
 * @ordinalOrName D2Game_6FD094C0
 */
export function ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c(
  m: SparseMemory113c,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FD094C0);
  const pGame = m.u32(pQuestArg >>> 0);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl >>> 0) : 0;
  while (pQuest !== 0 && m.u32(pQuest >>> 0) !== 0x0f) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0 || m.u8((pQuest + 0x09) >>> 0) === 0) {
    return 0;
  }
  const pObject = m.u32((pQuestArg + 0x04) >>> 0);
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 0;
  }
  const pPlayer = m.u32((pQuestArg + 0x08) >>> 0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pQuestHist = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0);
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestHist, 0x11, 0) === 1) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer);
    return 0;
  }
  m.setU32((pObject + 0xb8) >>> 0, 0x20626262);
  const pOutQualityScratch = 0x6fd44ef0;
  m.setU32(pOutQualityScratch, 0);
  const pDropped = ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
    m,
    m.u32(pQuestArg >>> 0),
    pObject,
    2,
    pOutQualityScratch,
    0,
    -1,
    0,
  );
  if (pDropped === 0) return 0;
  UNITS_ChangeAnimMode113c(m, pObject, 2);
  const pQuestState = m.u32((pQuest + 0x18) >>> 0);
  m.setU8((pQuestState + 0x02) >>> 0, 1);
  m.setU32((pQuestState + 0x08) >>> 0, (m.u32((pQuestState + 0x08) >>> 0) + 1) >>> 0);
  m.setU8((pQuestState + 0x01) >>> 0, 1);
  m.setU32((pQuestState + 0x18) >>> 0, 2);
  m.setU32((pQuestState + 0x14) >>> 0, pObject !== 0 ? m.u32((pObject + 0x0c) >>> 0) : 0xffffffff);
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fd05270);
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fd08fe0);
  if (m.u8((pQuest + 0x0c) >>> 0) !== 3) {
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3);
  }
  if (m.u8((pQuest + 0x0b) >>> 0) !== 1) {
    m.setU8((pQuest + 0x14) >>> 0, 0);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FD09DC0
 * @ordinalOrName D2Game_6FD09DC0
 */
export function ACT3Q2_InitQuestTableRecord_6FD09DC0_113c(
  m: SparseMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FD09DC0);
  for (let i = 0; i < 0x3c; i += 4) {
    m.setU32((pQuest + 0xa0 + i) >>> 0, 0);
  }
  m.setU8((pQuest + 0x0c) >>> 0, 0);
  const pGame = m.u32((pQuest + 0x04) >>> 0);
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fd042f0);
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd20f30);
  m.setU8((pQuest + 0x0a) >>> 0, 1);
  m.setU32((pQuest + 0xe0) >>> 0, 0x13);
  m.setU32((pQuest + 0xec) >>> 0, 0x6fd04500);
  m.setU8((pQuest + 0x0d) >>> 0, 4);
  m.setU32((pQuest + 0xe8) >>> 0, 0x6fd045b0);
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fd02d40);
  m.setU32((pQuest + 0x10) >>> 0, 0x0f);
  m.setU32((pQuest + 0xb0) >>> 0, 0x6fd07770);
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fd09600);
  m.setU32((pQuest + 0xac) >>> 0, 0x6fd07880);
  m.setU32((pQuest + 0xa8) >>> 0, 0x6fd06cf0);
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fd06000);
  m.setU32((pQuest + 0xd8) >>> 0, 0x6fd041a0);
  m.setU32((pQuest + 0xc4) >>> 0, 0x6fd02d00);
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0;
  const pState = FOG_Allocation113c(m, 0x30, 0x6fd1af48, 0x394, pMemPool);
  m.setU32((pQuest + 0x18) >>> 0, pState);
  for (let i = 0; i < 0x30; i += 4) {
    m.setU32((pState + i) >>> 0, 0);
  }
  m.setU32((pState + 0x2c) >>> 0, 0);
  void ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c;
  void QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c;
  void ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c;
  void ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c;
  void ACT3Q2_GidbinnActiveFilter_6FD04500_113c;
  void ACT3Q2_GidbinnStatusFilter_6FD045B0_113c;
  void ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c;
  void ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c;
  void ACT3Q2_OnGidbinnPickedUp_6FD07770_113c;
  void ACT3Q8_Callback03_LevelChanged113c;
}
