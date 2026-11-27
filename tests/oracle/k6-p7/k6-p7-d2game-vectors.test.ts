/**
 * [K6-P7] Real-DLL D2Game.dll Band D (0x6FCE0000..0x6FD142D0) Vector Suite (150 net-new VAs).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  AI_CastSkillWithMode113c,
} from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  D2GAME_ITEMSTAT_OnStatChangedCallback113c,
  D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c,
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_MONSTER_SendMonsterMovementSync113c,
  D2GAME_MONSTER_SyncMonsterUnitToClient113c,
  D2GAME_PARTY_Send0x8BPartyRelationStatus113c,
  D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c,
  D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c,
  D2GAME_PLRMODES_DispatchModeSyncToClient113c,
  D2GAME_PLRMODES_Send0x0DPlayerStop113c,
  D2GAME_PLRMODES_SendClientWhisperAdapter113c,
  D2GAME_PLRMODES_SendStatToClientOrParty113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-b-113c'
import {
  C2S_Packet01_WalkToLocation113c,
  C2S_Packet03_RunToLocation113c,
  C2S_Packet06_LeftSkillOnUnit113c,
  C2S_Packet0C_RightSkillOnLocation113c,
  C2S_Packet5F_UpdatePlayerPos113c,
  C2S_ResolveDualWieldThrowSkill113c,
  C2S_RunToTargetAndSetQueuedSkill113c,
  C2S_ValidateTargetUnitDistance113c,
} from '../../../src/d2kern-113c/game/c2s-packet-113c'
import {
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c,
} from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c'
import {
  ITEMS_ActivateEquippedItemStats113c,
  ITEMS_DeactivateEquippedItemStats113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import {
  MONSTER_SendPacket0x0C_LifeSync113c,
} from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c'
import {
  AI_ApproachTarget113c,
  AI_FleeFrom113c,
  AI_Stall113c,
  SUNITDMG_ApplyArmorDurabilityAndGetHit113c,
  SUNITDMG_ApplyLevelDiffExpRatio_6FCFAA40_113c,
  SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_GetPlayerClientClassId113c,
  SUNITDMG_GetWeaponBlockChance_6FCFA540_113c,
  SUNITDMG_ResolveAttackerPlayer113c,
  SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import {
  PACKETS_SrvMercItemAction_6FCF0BC0_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import {
  C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c,
  ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c,
  ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c,
  ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c,
} from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import {
  D2Game_6FCE1510_113c,
  D2Game_6FCEF0E0_113c,
  D2Game_6FCF7300_113c,
  D2Game_6FCF78C0_113c,
  D2Game_6FCF7CC0_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c,
  C2S_Packet32_NpcBuyItem_6FCEF570_113c,
  C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c,
  ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c,
  NPCTRADE_InteractRepairItem_6FCE1890_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import {
  ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c,
  ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c,
  ACT3Q2_OnNpcSpeechComplete_6FD09600_113c,
  ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c,
  ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c,
  C2S_Packet_DropCursorItem_6FCEF380_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c,
  NPCS_HandleNpcMenuRequest_6FCE00C0_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c'
import {
  ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b7-113c'
import {
  AI_ApproachTargetPathType13_6FD13000_113c,
} from '../../../src/d2kern-113c/game/k2-w2b8-113c'
import {
  AI_WalkWanderAroundSelf_6FD129B0_113c,
  AI_WalkWanderAroundUnitOrSelf_6FD12870_113c,
  NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b10-113c'
import {
  ACT2Q2_StatusFilter_6FCE3BD0_113c,
  ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c,
  ACT2Q5_Callback00_NpcActivate_6FCE3080_113c,
  ACT2Q6_ActiveFilter_6FCE1C20_113c,
  ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c,
} from '../../../src/d2kern-113c/game/k2-w5b4-113c'
import {
  ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c,
  ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20_113c,
  ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c,
  ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c,
  ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c,
  ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c,
  PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c,
} from '../../../src/d2kern-113c/game/k2-w5b5-113c'
import {
  A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c,
  C2S_ValidateWaypointInteraction_6FCECB50_113c,
  PACKET_DeliverOverheadOrPartyChat_6FCED530_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c,
  ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c,
  ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c,
  ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c,
  ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c,
  ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c,
  SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
  SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c,
  SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c,
  SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c,
  SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c,
} from '../../../src/d2kern-113c/game/k2-w5b7-113c'
import {
  ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c,
  ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c,
  ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c,
  ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c,
  ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c,
  ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c,
  ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c,
  ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c,
  ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b8-113c'
import {
  ACT3Q6_FireHellgateOpenerProjectile_6FD0AB60_113c,
  PLAYERSAVE_WriteStatsSection_6FD0BE70_113c,
  PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c,
} from '../../../src/d2kern-113c/game/k2-w5b9-113c'
import {
  ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c,
} from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import {
  ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c'
import {
  ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c,
  ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c,
  C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c,
  ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c,
  ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c,
  ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c,
  ITEMS_InsertScrollIntoTome_6FCF34B0_113c,
  ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c,
  ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c,
  PLAYER_LevelUp_6FD0B090_113c,
  PLAYERSAVE_WriteCorpseSection_6FD0C260_113c,
  PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c,
} from '../../../src/d2kern-113c/game/k2-w6b6-113c'
import {
  PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b7-113c'
import {
  ACT2Q5_OnScrollMessage_6FCE67C0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c'
import {
  ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c,
  ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c,
  ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c,
  ITEMS_SwitchWeaponSlots_6FCF8EA0_113c,
  ITEMS_UseInventoryItem_6FCF9BF0_113c,
  ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c,
  PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import {
  ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c,
  ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c,
  ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c,
  ACT3Q7_Callback00_NpcActivate_6FD07080_113c,
  C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c,
  C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c,
  ITEMS_ProcessReplenishStatTick_6FCFA350_113c,
} from '../../../src/d2kern-113c/game/k2-w8b3-113c'
import {
  ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c,
  ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c,
} from '../../../src/d2kern-113c/game/k2-w9b2-113c'
import {
  MONREG_GenerateOutfitVariants113c,
  MONREG_GetOrCreateActOutfit113c,
  MONSTER_CheckSpawnTileFree113c,
  MONSTER_InitSpecialClassEvents113c,
  MONSTER_PostSpawnQuestAndSpecialInit113c,
  MONSTER_SpawnPartyMinions113c,
  SUNIT_DeactivateUnitStatesAndEvents113c,
  SUNIT_InitExtraItemSeed113c,
  SUNIT_InitUnitAnimData113c,
  SUNIT_ValidatePathTargetUnit113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import {
  C2S_Dispatch113c,
} from '../../../src/d2kern-113c/game/c2s-dispatch-113c'
import {
  MONSTER_RefreshAiEvent113c,
} from '../../../src/d2kern-113c/game/timer-wheel'
import {
  SPLAYER_BroadcastUnitMovementToClient113c,
  SUNIT_UpdateUnitPositionAndRoom113c,
} from '../../../src/d2kern-113c/game/town-runtime-gap-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  '0x6FCE00C0': (m, a) => NPCS_HandleNpcMenuRequest_6FCE00C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE1510': (m, a) => D2Game_6FCE1510_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCE1890': (m, a) => NPCTRADE_InteractRepairItem_6FCE1890_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCE1C20': (m, a) => ACT2Q6_ActiveFilter_6FCE1C20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE2B00': (m, a) => ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c(m, a[0]!, a[1]!),
  '0x6FCE3080': (m, a) => ACT2Q5_Callback00_NpcActivate_6FCE3080_113c(m, a[0]!, a[1]!),
  '0x6FCE37F0': (m, a) => ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c(m, a[0]!, a[1]!),
  '0x6FCE3BD0': (m, a) => ACT2Q2_StatusFilter_6FCE3BD0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE4030': (m, a) => ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCE4320': (m, a) => ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c(m, a[0]!, a[1]!),
  '0x6FCE4900': (m, a) => ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c(m, a[0]!, a[1]!),
  '0x6FCE4EA0': (m, a) => ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c(m, a[0]!, a[1]!),
  '0x6FCE5310': (m, a) => ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c(m, a[0]!, a[1]!),
  '0x6FCE5A60': (m, a) => ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c(m, a[0]!, a[1]!),
  '0x6FCE67C0': (m, a) => ACT2Q5_OnScrollMessage_6FCE67C0_113c(m, a[0]!, a[1]!),
  '0x6FCE6B30': (m, a) => ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c(m, a[0]!, a[1]!),
  '0x6FCE6E90': (m, a) => ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c(m, a[0]!, a[1]!),
  '0x6FCE7C20': (m, a) => ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20_113c(m, a[0]!, a[1]!),
  '0x6FCE8050': (m, a) => ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(m, a[0]!, a[1]!),
  '0x6FCE85A0': (m, a) => ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c(m, a[0]!, a[1]!),
  '0x6FCE8CD0': (m, a) => A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c(m, a[0]!, a[1]!),
  '0x6FCE8FD0': (m, a) => ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCE9B70': (m, a) => ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c(m, a[0]!, a[1]!),
  '0x6FCEA5F0': (m, a) => MONREG_GetOrCreateActOutfit113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCEB1F0': (m, a) => C2S_ResolveDualWieldThrowSkill113c(m, a[0]!, a[1]!),
  '0x6FCEB570': (m, a) => D2GAME_PLRMODES_SendClientWhisperAdapter113c(m, a[0]!, a[1]!),
  '0x6FCEB8F0': (m, a) => D2GAME_PLRMODES_DispatchModeSyncToClient113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCEBBB0': (m, a) => SUNITDMG_ApplyArmorDurabilityAndGetHit113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCEBDB0': (m, a) => D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c(m, a[0]!, a[1]!),
  '0x6FCEC2F0': (m, a) => D2GAME_PLRMODES_SendStatToClientOrParty113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEC370': (m, a) => PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCEC550': (m, a) => C2S_Dispatch113c(m, a[0]!, a[1]!, Uint8Array.from({ length: a[3]! }, (_, i) => m.u8((a[2]! + i) >>> 0))),
  '0x6FCECB50': (m, a) => C2S_ValidateWaypointInteraction_6FCECB50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCECFE0': (m, a) => C2S_ValidateTargetUnitDistance113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCED190': (m, a) => D2GAME_PLRMODES_Send0x0DPlayerStop113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCED530': (m, a) => PACKET_DeliverOverheadOrPartyChat_6FCED530_113c(m, a[0]!, a[1]!),
  '0x6FCEDBB0': (m, a) => PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEE040': (m, a) => C2S_Packet03_RunToLocation113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEE0D0': (m, a) => C2S_Packet01_WalkToLocation113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEE120': (m, a) => C2S_RunToTargetAndSetQueuedSkill113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCEE150': (m, a) => SPLAYER_BroadcastUnitMovementToClient113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEE520': (m, a) => C2S_Packet0C_RightSkillOnLocation113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEE9D0': (m, a) => C2S_Packet06_LeftSkillOnUnit113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEEE60': (m, a) => C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEF0E0': (m, a) => D2Game_6FCEF0E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEF270': (m, a) => C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEF380': (m, a) => C2S_Packet_DropCursorItem_6FCEF380_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEF570': (m, a) => C2S_Packet32_NpcBuyItem_6FCEF570_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF01D0': (m, a) => C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCF05B0': (m, a) => ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF0790': (m, a) => C2S_Packet5F_UpdatePlayerPos113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF0950': (m, a) => C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF0BC0': (m, a) => PACKETS_SrvMercItemAction_6FCF0BC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF1010': (m, a) => C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF1370': (m, a) => C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF14B0': (m, a) => C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF1ED0': (m, a) => D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c(m, a[0]!, a[1]!),
  '0x6FCF2380': (m, a) => ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF2610': (m, a) => ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF28D0': (m, a) => ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, a[0]!),
  '0x6FCF29F0': (m, a) => ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, a[0]!),
  '0x6FCF2C70': (m, a) => ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF2CF0': (m, a) => ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF2D90': (m, a) => ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF2F00': (m, a) => ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF34B0': (m, a) => ITEMS_InsertScrollIntoTome_6FCF34B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCF46B0': (m, a) => ITEMS_DeactivateEquippedItemStats113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCF47C0': (m, a) => ITEMS_ActivateEquippedItemStats113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF4960': (m, a) => ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF4A70': (m, a) => ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FCF4D30': (m, a) => ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF4E80': (m, a) => ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCF51A0': (m, a) => D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF5A00': (m, a) => ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCF60D0': (m, a) => ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCF62E0': (m, a) => ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FCF6E30': (m, a) => ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF7300': (m, a) => D2Game_6FCF7300_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FCF76A0': (m, a) => ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!),
  '0x6FCF78C0': (m, a) => D2Game_6FCF78C0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF7CC0': (m, a) => D2Game_6FCF7CC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCF7E30': (m, a) => ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF8310': (m, a) => ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF8970': (m, a) => ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCF8EA0': (m, a) => ITEMS_SwitchWeaponSlots_6FCF8EA0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF9470': (m, a) => D2GAME_ITEMSTAT_OnStatChangedCallback113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCF9BF0': (m, a) => ITEMS_UseInventoryItem_6FCF9BF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCF9FB0': (m, a) => ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCFA350': (m, a) => ITEMS_ProcessReplenishStatTick_6FCFA350_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCFA540': (m, a) => SUNITDMG_GetWeaponBlockChance_6FCFA540_113c(m, a[0]!),
  '0x6FCFAA40': (_m, a) => SUNITDMG_ApplyLevelDiffExpRatio_6FCFAA40_113c(a[0]!, a[1]!, a[2]!),
  '0x6FCFAA90': (m, a) => SUNITDMG_FindCombatDamageData113c(m, a[0]!, a[1]!),
  '0x6FCFB5E0': (m, a) => SUNITDMG_ResolveAttackerPlayer113c(m, a[0]!, a[1]!),
  '0x6FCFE5A0': (m, a) => SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, 0),
  '0x6FCFEBA0': (m, a) => SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCFF1A0': (m, a) => MONREG_GenerateOutfitVariants113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCFFA60': (m, a) => SUNITDMG_GetPlayerClientClassId113c(m, a[0]!),
  '0x6FCFFC10': (m, a) => D2GAME_SUNIT_IterateAllLivingPlayers113c(m, a[0]!, ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c, a[2]!),
  '0x6FCFFCC0': (m, a) => SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, a[0]!, ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c, a[2]!, a[3]!),
  '0x6FCFFDC0': (m, a) => SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c(m, a[0]!, a[1]!),
  '0x6FCFFF10': (m, a) => SUNIT_InitUnitAnimData113c(m, a[0]!),
  '0x6FD000C0': (m, a) => SUNIT_InitExtraItemSeed113c(m, a[0]!, a[1]!),
  '0x6FD007A0': (m, a) => SUNIT_ValidatePathTargetUnit113c(m, a[0]!, a[1]!),
  '0x6FD00860': (m, a) => SUNIT_DeactivateUnitStatesAndEvents113c(m, a[0]!, a[1]!),
  '0x6FD01570': (m, a) => SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c(m, a[0]!, a[1]!),
  '0x6FD01610': (m, a) => SUNIT_UpdateUnitPositionAndRoom113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD02240': (m, a) => MONSTER_RefreshAiEvent113c(m, a[0]!, a[1]!),
  '0x6FD02310': (m, a) => SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD02480': (m, a) => SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD02600': (m, a) => SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD033A0': (m, a) => ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c(m, a[0]!, a[1]!),
  '0x6FD03970': (m, a) => ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c(m, a[0]!, a[1]!),
  '0x6FD03CE0': (m, a) => ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD03E30': (m, a) => ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c(m, a[0]!, a[1]!),
  '0x6FD042F0': (m, a) => ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c(m, a[0]!, a[1]!),
  '0x6FD04AB0': (m, a) => ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD04C90': (m, a) => ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c(m, a[0]!, a[1]!),
  '0x6FD04F60': (m, a) => ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD05270': (m, a) => ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c(m, a[0]!, a[1]!),
  '0x6FD06BD0': (m, a) => ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c(m, a[0]!, a[1]!),
  '0x6FD07080': (m, a) => ACT3Q7_Callback00_NpcActivate_6FD07080_113c(m, a[0]!, a[1]!),
  '0x6FD089A0': (m, a) => ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c(m, a[0]!, a[1]!),
  '0x6FD08B60': (m, a) => ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c(m, a[0]!, a[1]!),
  '0x6FD08FE0': (m, a) => ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c(m, a[0]!, a[1]!),
  '0x6FD09600': (m, a) => ACT3Q2_OnNpcSpeechComplete_6FD09600_113c(m, a[0]!, a[1]!),
  '0x6FD0A930': (m, a) => ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c(m, a[0]!, a[1]!),
  '0x6FD0AB60': (m, a) => ACT3Q6_FireHellgateOpenerProjectile_6FD0AB60_113c(m, a[0]!, a[1]!),
  '0x6FD0AD10': (m, a) => PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c(m, a[0]!, a[1]!),
  '0x6FD0B090': (m, a) => PLAYER_LevelUp_6FD0B090_113c(m, a[0]!, a[1]!),
  '0x6FD0BE70': (m, a) => PLAYERSAVE_WriteStatsSection_6FD0BE70_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD0C260': (m, a) => PLAYERSAVE_WriteCorpseSection_6FD0C260_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD0C470': (m, a) => PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD0C7F0': (m, a) => PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FD0E260': (m, a) => MONSTER_InitSpecialClassEvents113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD0E480': (m, a) => MONSTER_SpawnPartyMinions113c(m, a[0]!, a[1]!),
  '0x6FD0E7B0': (m, a) => MONSTER_PostSpawnQuestAndSpecialInit113c(m, a[0]!, a[1]!),
  '0x6FD10130': (m, a) => D2GAME_PARTY_Send0x8BPartyRelationStatus113c(m, a[0]!, a[1]!),
  '0x6FD10480': (m, a) => D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD122C0': (m, a) => AI_Stall113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD12380': (m, a) => AI_CastSkillWithMode113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FD12540': (m, a) => AI_ApproachTarget113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FD12870': (m, a) => AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD129B0': (m, a) => AI_WalkWanderAroundSelf_6FD129B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD12D80': (m, a) => AI_FleeFrom113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD13000': (m, a) => AI_ApproachTargetPathType13_6FD13000_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD13360': (m, a) => MONSTER_SendPacket0x0C_LifeSync113c(m, a[0]!, a[1]!),
  '0x6FD134C0': (m, a) => NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD135C0': (m, a) => D2GAME_MONSTER_SendMonsterMovementSync113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD13A40': (m, a) => D2GAME_MONSTER_SyncMonsterUnitToClient113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD13D20': (m, a) => MONSTER_CheckSpawnTileFree113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P7VectorRecord {
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

function loadVectors(): K6P7VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p7/k6-p7-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P7VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P7VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6-P7] Real-DLL D2Game.dll Band D (0x6FCE0000..0x6FD142D0) Vector Suite (150 net-new VAs)', () => {
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
    mem.fill(0x6fd27000, 0xb000, 0)
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
    mem.fill(0x6fd301e0, 8, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f80, 0x20, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 150 target real-DLL D2Game Band D VAs (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(150)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fce0000)
      expect(num).toBeLessThanOrEqual(0x6fd142d0)
      expect(num).not.toBe(0x6fcef0a0)
      expect(num).not.toBe(0x6fd130c0)
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
