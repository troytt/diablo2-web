/**
 * Milestone #37 [K6] Wave 10 — Real-DLL D2Game.dll (0x6FCC0000..0x6FD142D0)
 * Hi-VA Part 3 Differential Vector Suite.
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

import { ITEMS_BuildItemDropParamsFromItem113c } from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c'
import {
  DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c,
  SKILLS_SrvDo_SubmergeOrBurrowMonster_6FCD4760_113c,
  SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c,
} from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  ACT1Q4_SpawnSmithBossInBarracks_6FD08780_113c,
  ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c,
  ITEMS_ClearInvalidRunewordOnItem_6FCF3280_113c,
} from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import {
  D2Game_6FCDB4F0_113c,
  D2Game_6FCE1030_113c,
  D2Game_6FD08EB0_113c,
  D2Game_6FD08F30_113c,
  D2Game_6FD095E0_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  ACT2Q2_CleanupHoradricStaffItemsOnEnterAct1_6FCE7D00_113c,
  C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c,
  C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import {
  ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c,
  ACT3Q1_InitQuestTableRecord_6FD092D0_113c,
  ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c,
  ACT4Q3_OnSeal1Operate_6FCDC580_113c,
  ACT4Q3_OnSeal3Operate_6FCDC510_113c,
  ACT4Q3_OnSeal5Operate_6FCDC4A0_113c,
  ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c'
import {
  ACT4Q2_InitHellforgeObject_6FCD8870_113c,
  SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c,
} from '../../../src/d2kern-113c/game/k2-w2b6-113c'
import {
  ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c,
  ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b7-113c'
import {
  ACT3Q2_InitGidbinnAltarObject_6FD04120_113c,
  ACT3Q3_InitSewerLeverObject_6FD04980_113c,
  ACT3Q3_InitSewerStairsObject_6FD02E00_113c,
  ACT3Q5_InitCompellingOrbObject_6FD02A00_113c,
  MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c,
} from '../../../src/d2kern-113c/game/k2-w2b8-113c'
import {
  AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c,
  SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c,
  SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c,
  SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c,
  SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c,
  SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c,
  STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import {
  ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c,
  ITEMMODS_ApplyMonsterFlee_6FCCD580_113c,
  MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c,
  MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c,
  MONSTER_MorphMonsterClassId_6FCCFC50_113c,
  SKILLS_RestartAuraEvent9AndTriggerOnSkillChange_6FCCDB30_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import {
  ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c,
  ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c,
  SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c,
  SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c,
  SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c,
} from '../../../src/d2kern-113c/game/k2-w4b8-113c'
import {
  ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c,
  ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c,
  AI_ScanRoomTargetAndCountAlliesCallback_6FCC5230_113c,
  ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c,
  ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c,
  MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c,
  MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c,
  SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c,
  SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import {
  ACT2Q1_SeqFilter_6FCE24A0_113c,
  ACT2Q3_SeqFilter_6FCE21E0_113c,
  ACT2Q4_ChainSeqFilter_6FCE1FF0_113c,
  ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c,
  ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c,
  QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b4-113c'
import {
  ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c,
  ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c,
} from '../../../src/d2kern-113c/game/k2-w5b5-113c'
import {
  AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c,
  AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c,
  ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c,
  PACKET_DeliverChatIfNotSquelched_6FCECA00_113c,
  SKILLS_TestPathReachableToCoords_6FCED790_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c,
  ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c,
  ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c,
  ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c,
  ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c,
  ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c,
  ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c,
  ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c,
  PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c,
  PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c,
  QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c,
  QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c,
  SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c,
  SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c,
} from '../../../src/d2kern-113c/game/k2-w5b7-113c'
import {
  ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
  ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c,
  ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c,
  ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c,
} from '../../../src/d2kern-113c/game/k2-w5b8-113c'
import {
  ACT3Q0_InitDarkWandererPreset_6FD08290_113c,
  ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c,
  MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c,
  MONSTER_SpawnMinionPackInRing_6FD0DE90_113c,
  MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c,
  MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c,
  PARTY_DispatchRelationAction_6FD10A70_113c,
  PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c,
  QUESTS_SpawnProjectile12B_6FD0AB10_113c,
  SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c,
  SKILLS_RollRandomUnblockedTargetPos_6FD112C0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b9-113c'
import {
  ACT2Intro_InitQuestData_6FCE5730_113c,
  ACT2Q0_InitQuestData_6FCE5690_113c,
  ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c,
  SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c,
  ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c,
  ACT2Q6_UnitIterate_CompleteInTalRashaChamber_6FCE59A0_113c,
  ACT3Q0_InitQuestData_6FD05920_113c,
  PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c,
} from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import {
  ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c,
  ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c,
  ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c,
  ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c,
  ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c,
  ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c,
  SKILLS_RespecPlayerClassSkills_6FCC1280_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c'
import {
  ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c,
  ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c,
  ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c,
  MONSTER_SpawnPresetPackTable_6FD0F940_113c,
  QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c,
} from '../../../src/d2kern-113c/game/k2-w6b6-113c'
import { OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c } from '../../../src/d2kern-113c/game/k2-w6b7-113c'
import {
  ACT2Q3_SeqCallback_6FCE6390_113c,
  ACT2Q5_SeqCallback_6FCE69D0_113c,
  ACT4Q1_SeqCallback_6FCDA270_113c,
  ACT4Q3_SeqCallback_6FCDA4F0_113c,
  ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c,
  MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c,
  SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c,
  SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c,
  SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c'
import {
  ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c,
  ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c,
  ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c,
  ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c,
  ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c,
  ITEMS_PickupGroundItemToCursor_6FCF7160_113c,
  MONSTER_SpawnFallenShamanPack_6FD0FB80_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import { SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c } from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import {
  ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c,
  ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c,
  ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c,
  ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b3-113c'
import { ACT4Q1_InitQuestData_6FCDAE40_113c } from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import {
  ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c,
  ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c,
  C2S_PacketUseQuestScrollItem_6FCED8D0_113c,
  PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c,
} from '../../../src/d2kern-113c/game/k2-w9b2-113c'
import {
  MONSTER_FindValidFloorSpawnCoords113c,
  MONSTER_SpawnFetishPartyMinions113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'

type KernelFn113c = (m: SparseMemory113c, ...args: number[]) => number | void

const DISPATCH_BY_VA: Readonly<Record<string, KernelFn113c>> = {
  '0x6FCEF2F0': C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c as unknown as KernelFn113c,
  '0x6FCED8D0': C2S_PacketUseQuestScrollItem_6FCED8D0_113c as unknown as KernelFn113c,
  '0x6FCF1200': C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c as unknown as KernelFn113c,
  '0x6FD00D00': SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c as unknown as KernelFn113c,
  '0x6FD142D0': OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c as unknown as KernelFn113c,
  '0x6FD01C00': DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c as unknown as KernelFn113c,
  '0x6FCE8950': ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c as unknown as KernelFn113c,
  '0x6FD095E0': D2Game_6FD095E0_113c as unknown as KernelFn113c,
  '0x6FCDB4F0': D2Game_6FCDB4F0_113c as unknown as KernelFn113c,
  '0x6FD110F0': PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c as unknown as KernelFn113c,
  '0x6FD08F30': D2Game_6FD08F30_113c as unknown as KernelFn113c,
  '0x6FCEFF30': PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c as unknown as KernelFn113c,
  '0x6FCE1030': D2Game_6FCE1030_113c as unknown as KernelFn113c,
  '0x6FCEC030': PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c as unknown as KernelFn113c,
  '0x6FCCEA40': ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c as unknown as KernelFn113c,
  '0x6FCF5740': ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c as unknown as KernelFn113c,
  '0x6FCEECE0': ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c as unknown as KernelFn113c,
  '0x6FCF3C40': ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c as unknown as KernelFn113c,
  '0x6FCCDBF0': ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c as unknown as KernelFn113c,
  '0x6FCF1E10': ITEMS_BuildItemDropParamsFromItem113c as unknown as KernelFn113c,
  '0x6FCDC6B0': ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c as unknown as KernelFn113c,
  '0x6FCF5590': ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c as unknown as KernelFn113c,
  '0x6FCCDDC0': ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c as unknown as KernelFn113c,
  '0x6FCF4140': ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c as unknown as KernelFn113c,
  '0x6FCCF210': ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c as unknown as KernelFn113c,
  '0x6FCF3A10': ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c as unknown as KernelFn113c,
  '0x6FCF3280': ITEMS_ClearInvalidRunewordOnItem_6FCF3280_113c as unknown as KernelFn113c,
  '0x6FCCF370': ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c as unknown as KernelFn113c,
  '0x6FCF1F60': ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c as unknown as KernelFn113c,
  '0x6FCCD580': ITEMMODS_ApplyMonsterFlee_6FCCD580_113c as unknown as KernelFn113c,
  '0x6FCF36D0': ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c as unknown as KernelFn113c,
  '0x6FCF4230': ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c as unknown as KernelFn113c,
  '0x6FCCCC30': ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c as unknown as KernelFn113c,
  '0x6FCF6C80': ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c as unknown as KernelFn113c,
  '0x6FCCE4D0': ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c as unknown as KernelFn113c,
  '0x6FCF2070': ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c as unknown as KernelFn113c,
  '0x6FCF1C00': ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c as unknown as KernelFn113c,
  '0x6FCD36A0': MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c as unknown as KernelFn113c,
  '0x6FCC09F0': STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c as unknown as KernelFn113c,
  '0x6FCD35A0': MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c as unknown as KernelFn113c,
  '0x6FCD33B0': MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c as unknown as KernelFn113c,
  '0x6FD0DF60': MONSTER_FindValidFloorSpawnCoords113c as unknown as KernelFn113c,
  '0x6FD0DF20': MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c as unknown as KernelFn113c,
  '0x6FD0DE90': MONSTER_SpawnMinionPackInRing_6FD0DE90_113c as unknown as KernelFn113c,
  '0x6FD0F8B0': MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c as unknown as KernelFn113c,
  '0x6FD0F7D0': MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c as unknown as KernelFn113c,
  '0x6FD0E0A0': MONSTER_SpawnFetishPartyMinions113c as unknown as KernelFn113c,
  '0x6FD0F6B0': MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c as unknown as KernelFn113c,
  '0x6FCFE380': SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c as unknown as KernelFn113c,
  '0x6FCC1600': SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c as unknown as KernelFn113c,
  '0x6FCD4660': SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c as unknown as KernelFn113c,
  '0x6FCC1280': SKILLS_RespecPlayerClassSkills_6FCC1280_113c as unknown as KernelFn113c,
  '0x6FCD3890': SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c as unknown as KernelFn113c,
  '0x6FCC34E0': SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c as unknown as KernelFn113c,
  '0x6FCC2EE0': SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c as unknown as KernelFn113c,
  '0x6FCD4D30': SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c as unknown as KernelFn113c,
  '0x6FCCDB30': SKILLS_RestartAuraEvent9AndTriggerOnSkillChange_6FCCDB30_113c as unknown as KernelFn113c,
  '0x6FCC0E80': SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c as unknown as KernelFn113c,
  '0x6FCC26E0': SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c as unknown as KernelFn113c,
  '0x6FCD46B0': SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c as unknown as KernelFn113c,
  '0x6FCC37D0': SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c as unknown as KernelFn113c,
  '0x6FCD4760': SKILLS_SrvDo_SubmergeOrBurrowMonster_6FCD4760_113c as unknown as KernelFn113c,
  '0x6FCC3120': SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c as unknown as KernelFn113c,
  '0x6FCCE0E0': SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c as unknown as KernelFn113c,
  '0x6FCD5D40': SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c as unknown as KernelFn113c,
  '0x6FCD41B0': SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c as unknown as KernelFn113c,
  '0x6FCED790': SKILLS_TestPathReachableToCoords_6FCED790_113c as unknown as KernelFn113c,
  '0x6FD08EB0': D2Game_6FD08EB0_113c as unknown as KernelFn113c,
  '0x6FD10B10': PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c as unknown as KernelFn113c,
  '0x6FD10A70': PARTY_DispatchRelationAction_6FD10A70_113c as unknown as KernelFn113c,
  '0x6FCECA00': PACKET_DeliverChatIfNotSquelched_6FCECA00_113c as unknown as KernelFn113c,
  '0x6FCF00A0': PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c as unknown as KernelFn113c,
  '0x6FCCFC50': MONSTER_MorphMonsterClassId_6FCCFC50_113c as unknown as KernelFn113c,
  '0x6FD0FB80': MONSTER_SpawnFallenShamanPack_6FD0FB80_113c as unknown as KernelFn113c,
  '0x6FD0F940': MONSTER_SpawnPresetPackTable_6FD0F940_113c as unknown as KernelFn113c,
  '0x6FCCDEE0': ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c as unknown as KernelFn113c,
  '0x6FCCDF20': ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c as unknown as KernelFn113c,
  '0x6FCF5080': ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c as unknown as KernelFn113c,
  '0x6FCF6590': ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c as unknown as KernelFn113c,
  '0x6FCF7160': ITEMS_PickupGroundItemToCursor_6FCF7160_113c as unknown as KernelFn113c,
  '0x6FD11730': SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c as unknown as KernelFn113c,
  '0x6FCE3190': ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c as unknown as KernelFn113c,
  '0x6FD02E00': ACT3Q3_InitSewerStairsObject_6FD02E00_113c as unknown as KernelFn113c,
  '0x6FD02A00': ACT3Q5_InitCompellingOrbObject_6FD02A00_113c as unknown as KernelFn113c,
  '0x6FCD8870': ACT4Q2_InitHellforgeObject_6FCD8870_113c as unknown as KernelFn113c,
  '0x6FD0AB10': QUESTS_SpawnProjectile12B_6FD0AB10_113c as unknown as KernelFn113c,
  '0x6FCDA4F0': ACT4Q3_SeqCallback_6FCDA4F0_113c as unknown as KernelFn113c,
  '0x6FD04120': ACT3Q2_InitGidbinnAltarObject_6FD04120_113c as unknown as KernelFn113c,
  '0x6FCD97D0': ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c as unknown as KernelFn113c,
  '0x6FCE69D0': ACT2Q5_SeqCallback_6FCE69D0_113c as unknown as KernelFn113c,
  '0x6FD06760': ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c as unknown as KernelFn113c,
  '0x6FD08780': ACT1Q4_SpawnSmithBossInBarracks_6FD08780_113c as unknown as KernelFn113c,
  '0x6FCD9D80': ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c as unknown as KernelFn113c,
  '0x6FCE5730': ACT2Intro_InitQuestData_6FCE5730_113c as unknown as KernelFn113c,
  '0x6FD06700': ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c as unknown as KernelFn113c,
  '0x6FD04980': ACT3Q3_InitSewerLeverObject_6FD04980_113c as unknown as KernelFn113c,
  '0x6FCE27F0': ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c as unknown as KernelFn113c,
  '0x6FCD8A70': ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c as unknown as KernelFn113c,
  '0x6FCDC4A0': ACT4Q3_OnSeal5Operate_6FCDC4A0_113c as unknown as KernelFn113c,
  '0x6FCDC510': ACT4Q3_OnSeal3Operate_6FCDC510_113c as unknown as KernelFn113c,
  '0x6FCDC580': ACT4Q3_OnSeal1Operate_6FCDC580_113c as unknown as KernelFn113c,
  '0x6FCE21E0': ACT2Q3_SeqFilter_6FCE21E0_113c as unknown as KernelFn113c,
  '0x6FCE24A0': ACT2Q1_SeqFilter_6FCE24A0_113c as unknown as KernelFn113c,
  '0x6FCE7250': ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c as unknown as KernelFn113c,
  '0x6FCE1FF0': ACT2Q4_ChainSeqFilter_6FCE1FF0_113c as unknown as KernelFn113c,
  '0x6FCE5690': ACT2Q0_InitQuestData_6FCE5690_113c as unknown as KernelFn113c,
  '0x6FD05920': ACT3Q0_InitQuestData_6FD05920_113c as unknown as KernelFn113c,
  '0x6FCDAE40': ACT4Q1_InitQuestData_6FCDAE40_113c as unknown as KernelFn113c,
  '0x6FCE7ED0': ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c as unknown as KernelFn113c,
  '0x6FD092D0': ACT3Q1_InitQuestTableRecord_6FD092D0_113c as unknown as KernelFn113c,
  '0x6FCDC5F0': ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c as unknown as KernelFn113c,
  '0x6FD02D40': QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c as unknown as KernelFn113c,
  '0x6FD02E80': QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c as unknown as KernelFn113c,
  '0x6FCDA080': ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c as unknown as KernelFn113c,
  '0x6FD08290': ACT3Q0_InitDarkWandererPreset_6FD08290_113c as unknown as KernelFn113c,
  '0x6FCE1BA0': ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c as unknown as KernelFn113c,
  '0x6FD08200': ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c as unknown as KernelFn113c,
  '0x6FCDC220': ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c as unknown as KernelFn113c,
  '0x6FCDF8F0': QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c as unknown as KernelFn113c,
  '0x6FCE5C60': ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c as unknown as KernelFn113c,
  '0x6FCE6600': ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c as unknown as KernelFn113c,
  '0x6FD07A40': ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c as unknown as KernelFn113c,
  '0x6FCE4B10': ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c as unknown as KernelFn113c,
  '0x6FCE59A0': ACT2Q6_UnitIterate_CompleteInTalRashaChamber_6FCE59A0_113c as unknown as KernelFn113c,
  '0x6FD036A0': ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c as unknown as KernelFn113c,
  '0x6FCDA270': ACT4Q1_SeqCallback_6FCDA270_113c as unknown as KernelFn113c,
  '0x6FCE6390': ACT2Q3_SeqCallback_6FCE6390_113c as unknown as KernelFn113c,
  '0x6FD046F0': ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c as unknown as KernelFn113c,
  '0x6FD03560': ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c as unknown as KernelFn113c,
  '0x6FCE54A0': ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c as unknown as KernelFn113c,
  '0x6FCD9B00': ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c as unknown as KernelFn113c,
  '0x6FCDB3B0': ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c as unknown as KernelFn113c,
  '0x6FCE6D20': ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c as unknown as KernelFn113c,
  '0x6FCE6070': ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c as unknown as KernelFn113c,
  '0x6FD02780': ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c as unknown as KernelFn113c,
  '0x6FD0AA30': QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c as unknown as KernelFn113c,
  '0x6FD08560': ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c as unknown as KernelFn113c,
  '0x6FCE2F10': ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c as unknown as KernelFn113c,
  '0x6FD05D80': ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c as unknown as KernelFn113c,
  '0x6FCE7D00': ACT2Q2_CleanupHoradricStaffItemsOnEnterAct1_6FCE7D00_113c as unknown as KernelFn113c,
  '0x6FCD58A0': SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c as unknown as KernelFn113c,
  '0x6FCC2A40': SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c as unknown as KernelFn113c,
  '0x6FCC2B40': SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c as unknown as KernelFn113c,
  '0x6FCD1520': MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c as unknown as KernelFn113c,
  '0x6FCD1580': MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c as unknown as KernelFn113c,
  '0x6FCC4260': AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c as unknown as KernelFn113c,
  '0x6FCC5230': AI_ScanRoomTargetAndCountAlliesCallback_6FCC5230_113c as unknown as KernelFn113c,
  '0x6FD112C0': SKILLS_RollRandomUnblockedTargetPos_6FD112C0_113c as unknown as KernelFn113c,
  '0x6FCC3E80': AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c as unknown as KernelFn113c,
  '0x6FCD6DA0': AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c as unknown as KernelFn113c,
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

interface K6W10VectorRecord {
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

function loadVectors(): K6W10VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w10/k6-w10-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W10VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W10VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 10 real-DLL D2Game.dll (0x6FCC0000..0x6FD142D0) Hi-VA Part 3 differential vectors', () => {
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
