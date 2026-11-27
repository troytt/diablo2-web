/**
 * [K6-P9] Band B (0x6FC70000..0x6FCAFFFF) Real-DLL D2Game.dll Vector Tests.
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-p9/k6-p9-d2game-emitter.c
 * against the TypeScript v1.13c kernel in src/d2kern-113c/game/*, verifying 100%
 * bit-exact agreement on return values, Fog.#10024 assertion line numbers, staged arena
 * memory mutations, extra D2Game global ranges, heap allocations, and va-trace-113c hits.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { type Memory113c, SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

import { S2C_SendPacket0F_UnitWalkToTarget113c } from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c'
import {
  AI_FallenShaman113c,
  MONSTER_AdvanceAttackOrSkillStep113c,
  MONSTER_ExecuteMeleeSwing113c,
  MONSTER_FireModeMissile113c,
  MONSTER_StartAttackOrCast113c,
} from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  EVENT_ExecuteMonsterEvents113c,
  MONSTER_ApplyElementalDamageAndResistStats113c,
  OBJECT_SendUpdatePacketsToClient113c,
  OBJECT_SyncStateAndEventsToClient113c,
  UNIT_FlushEventNotifyQueueToClient113c,
  UNIT_FreeEventNotifyList113c,
  UNIT_SyncStateAndStatsToClient113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-a-113c'
import {
  D2GAME_PACKET_Send0x5BPlayerInGame113c,
  D2GAME_PACKET_Send0x73MissileSync113c,
  D2GAME_PACKET_SendMonsterAssign113c,
  D2GAME_PACKET_SendPlayerPartyRelationship113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-b-113c'
import { PLAYER_StartModeAtCoords113c } from '../../../src/d2kern-113c/game/c2s-packet-113c'
import { NET_SendUnitTargetedSkillAction113c } from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import {
  MISSILE_InitOwnerDamageStats113c,
  MONSTER_Event03_RegenAndPoisonTick113c,
  MONSTER_Event12_ExpireTimedStats113c,
  PLAYER_StartCastSkillAtCoords113c,
} from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c'
import { ACT5_InitObjectNoop_6FC76CE0_113c } from '../../../src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c'
import {
  MONSTER_DropDeathItems_6FC95900_113c,
  MONSTER_DropTreasureOnDeath_6FC95680_113c,
} from '../../../src/d2kern-113c/game/k2-real-itemdrop-113c'
import {
  MONSTER_BroadcastEventSoundToClients113c,
  MONSTER_ExecuteEventsWrapper113c,
  MONSTER_SetDeathPathAndAnim113c,
  PLAYER_AdvanceSkillModeFrame113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_StartBlockMode113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import {
  ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c,
  QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import {
  OBJ_OperateFn_TownAndPermanentPortal_6FC8D0F0_113c,
  SKILLS_PostInitSummonedPetStatsAndAi_6FC70070_113c,
} from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  D2Game_6FC56470_113c,
  D2Game_6FC565E0_113c,
  D2Game_6FC7DF70_113c,
  D2Game_6FC8E930_113c,
  D2Game_6FC92220_113c,
  D2Game_6FC98D00_113c,
  D2Game_6FCE1030_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c,
  ACT1Q3_OnNpcInitCainSearch_6FC86960_113c,
  ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c,
  ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c,
  ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c,
  ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c,
  CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c,
  SKILLS_SrvDo_BoneWall_6FC70FE0_113c,
  SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c,
  SKILLS_SrvDo_IronGolem_6FC71540_113c,
  SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import {
  OBJ_OperateDuranceStairs_6FC8CD40_113c,
  PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c,
  SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c,
  OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c,
  PLRTRADE_HandleClientTradeButton_6FC94200_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c'
import { SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c } from '../../../src/d2kern-113c/game/k2-w2b4-113c'
import {
  ACT5Q1_Callback00_NpcActivate_6FC787C0_113c,
  ACT5Q2_Callback00_NpcActivate_6FC783C0_113c,
  ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c,
  ACT5Q3_GrantScrollOfResistanceStats_6FC7A000_113c,
  ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c,
  ACT5Q4_Callback00_NpcActivate_6FC77A60_113c,
  ACT5Q4_SeqFilter_6FC76B10_113c,
  ACT5Q5_Callback00_NpcActivate_6FC775F0_113c,
  ACT5Q6_Callback00_NpcActivate_6FC77000_113c,
  ACT5Q6_SeqFilter_6FC767A0_113c,
  PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import {
  ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c,
  ACT1Q6_Callback00_NpcActivate_6FC80A80_113c,
} from '../../../src/d2kern-113c/game/k2-w3b6-113c'
import {
  CUBE_ValidateRecipeInputSlot_6FC90240_113c,
  MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c,
  OBJ_OperateShrine_6FC8DA00_113c,
  OBJ_OperateWaypoint_6FC8CF90_113c,
  OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c,
  OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c'
import {
  AI_LinkedOwnerTurretCycle_6FC9CB10_113c,
  AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c,
  AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c'
import {
  ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c,
  ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c,
  QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import {
  ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c,
  ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c,
  ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c,
  ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c,
  ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c,
  OBJ_TryOperateObjectIfInRange_6FC8A720_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import {
  ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c,
  AI_ThinkDualAttackMelee_6FCA3AC0_113c,
  AI_ThinkSimpleMeleeVariantB_6FCA2570_113c,
  ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c,
  MONSTER_TickPathStepAndAnim_6FC96A10_113c,
  OBJ_OperateWirtsBody_6FC8D960_113c,
  PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import { NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c } from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c,
  NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c,
  NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c,
  SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b2-113c'
import {
  MONAI_CorpseSpitterThink_6FCA3FE0_113c,
  MONAI_CorruptRogueArcherThink_6FCA26B0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  SKILLS_ApplyAttractCurseCallback_6FC70B70_113c,
  SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import {
  MONAI_PutridDefilerImpregnateThink_6FCA5500_113c,
  NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c,
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  AI_ThinkCommand14TriggeredSkill_6FC9D670_113c,
  AI_ThinkGiantMosquito_6FCA6280_113c,
  AI_ThinkMephistoBoss_6FCA5B60_113c,
} from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import {
  ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c,
  ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c,
  ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c,
} from '../../../src/d2kern-113c/game/k2-w6b4-113c'
import {
  QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c,
  SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c,
  SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import {
  ACT1Q4_OnCainGibbetOperated_6FC87730_113c,
  ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c,
  ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c,
  ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c,
  ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c,
  AI_Thinker_Izual_6FC9EA10_113c,
  MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c,
  OBJECTS_FloorSpikesEventTick_6FC8E270_113c,
  STASH_HandleBankGoldOrCloseAction_6FC917E0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import {
  ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c,
  ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c,
  ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c,
  ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c,
  ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c,
  PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c,
  QUESTS_DefaultSequenceFilter_6FC7AFB0_113c,
  SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c,
} from '../../../src/d2kern-113c/game/k2-w8b1-113c'
import {
  CUBE_Op15_SpawnSecretCowLevelPortal_6FC92210_113c,
  OBJ_OperateDoorWithLockCheck_6FC8A9D0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import {
  ACT1Q6_OnAndarielKilled_6FC87E00_113c,
  ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c,
  ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c,
  ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c,
  AI_SummonerThink_6FCA5780_113c,
  PLAYERSAVE_SavePlayerCharacter_6FC74320_113c,
} from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import {
  MONSTER_ClearStepEvents113c,
  MONSTER_DispatchEvent113c,
  MONSTER_Event0_ModeStep113c,
  MONSTER_Event1_ModeEnd113c,
} from '../../../src/d2kern-113c/game/monster-events'
import { PLAYER_StepModeWalkOrRun113c } from '../../../src/d2kern-113c/game/replay-final11-113c'
import {
  PLAYER_DrainRunStamina113c,
  PLAYER_UpdateManaRegen113c,
  SUNIT_ScheduleModeAnimEvents113c,
} from '../../../src/d2kern-113c/game/replay-kernel-113c'
import { EVENT_FreeNode113c } from '../../../src/d2kern-113c/game/timer-wheel'
import {
  AITHINK_CanPlayerStartSkillOrCast113c,
  D2NET_SendUnitPosSync0x15ToClient113c,
  PLAYER_RecalcTargetUnitPath113c,
  PLAYER_StepAnimationModeTick113c,
} from '../../../src/d2kern-113c/game/town-runtime-gap-113c'

const W4B3_QUEST_HOOKS = {
  onSpawnQuestMonsterWithRetryRings_6FC561E0: (
    m: Memory113c,
    pGame: number,
    nX: number,
    nY: number,
    pRoom: number,
    nTries: number,
    nClassId: number,
  ) => QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c(m as SparseMemory113c, pGame, nX, nY, pRoom, nTries, nClassId),
  onResetAncientsToStatuesAndAltar_6FC7E0E0: (
    m: Memory113c,
    pGame: number,
    pQuest: number,
    pQuestData: number,
  ) => ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c(m as SparseMemory113c, pGame, pQuest, pQuestData),
}


const MON_EVT_CBS = {
  onModeStep: (mem: Memory113c, g: number, u: number, _e: unknown, a14: number, a18: number) =>
    MONSTER_Event0_ModeStep113c(mem, g, u, a14, a18, {
      onModeStep: (m2, g2, u2, entry) => {
        if (entry.pfnStep === 0x6fc95320) MONSTER_ClearStepEvents113c(m2, g2, u2)
        else if (entry.pfnStep === 0x6fc95ce0) MONSTER_AdvanceAttackOrSkillStep113c(m2, g2, u2)
      },
    }),
  onModeEnd: (mem: Memory113c, g: number, u: number, _e: unknown, a14: number, a18: number) =>
    MONSTER_Event1_ModeEnd113c(mem, g, u, a14, a18, { onModeEnd: () => {} }),
  onStatRegen: (mem: Memory113c, g: number, u: number, a14: number, a18: number) =>
    MONSTER_Event03_RegenAndPoisonTick113c(mem, g, u, a14, a18),
  onOtherEvent: (mem: Memory113c, g: number, u: number, ev: number, a14: number, a18: number) => {
    if (ev === 12) MONSTER_Event12_ExpireTimedStats113c(mem, g, u, a14, a18)
  },
}

const GAP_A_SYNC_CALLEES = {
  sendUnitEventSound: (mem: Memory113c, pClient: number, pUnit: number) =>
    MONSTER_BroadcastEventSoundToClients113c(mem, pUnit, pClient, 0),
}


const B4D_GAP_A_SYNC_CALLEES = {
  sendUnitEventSound: (mem: Memory113c, pClient: number, pUnit: number) =>
    MONSTER_BroadcastEventSoundToClients113c(mem, pUnit, pClient, 0),
}


function makeP9MinimalWorld(m: Memory113c, pGame: number) {
  return { m, pGame, pathUnitByPtr: new Map() } as never
}


type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  '0x6FC8F620': (m, a) => MISSILE_InitOwnerDamageStats113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC911D0': (m, a) => ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC934E0': (m, a) => PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC94D50': (m, a) => PLAYER_RecalcTargetUnitPath113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC95510': (m, a) => MONSTER_StartAttackOrCast113c(m, a[0]!, a[1]!),
  '0x6FC95900': (m, a) => MONSTER_DropDeathItems_6FC95900_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC95CE0': (m, a) => MONSTER_AdvanceAttackOrSkillStep113c(m, a[0]!, a[1]!),
  '0x6FC96A10': (m, a) => MONSTER_TickPathStepAndAnim_6FC96A10_113c(m, a[0]!, a[1]!),
  '0x6FC97B20': (m, a) => PLAYER_AdvanceSkillModeFrame113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC97FA0': (m, a) => AITHINK_CanPlayerStartSkillOrCast113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC98840': (m, a) => PLAYER_StartCastSkillAtCoords113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC98C50': (m, a) => ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC98D00': (m, a) => D2Game_6FC98D00_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC99100': (m, a) => PLAYER_ScheduleSkillActionFrameEvents113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC97BB0': (m, a) => PLAYER_DrainRunStamina113c(m, a[0]!),
  '0x6FC99B90': (m, a) => PLAYER_StepModeWalkOrRun113c(m, a[0]!, a[1]!),
  '0x6FC99FE0': (m, a) => UNIT_FreeEventNotifyList113c(m, a[0]!),
  '0x6FC9ACB0': (m, a) => SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c(m, a[0]!, a[1]!),
  '0x6FC9ADF0': (m, a) => UNIT_FlushEventNotifyQueueToClient113c(m, a[0]!, a[1]!),
  '0x6FCAC570': (m, a) => D2GAME_PACKET_SendPlayerPartyRelationship113c(m, a[0]!, a[1]!),
  '0x6FCAD210': (m, a) => NET_SendUnitTargetedSkillAction113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FCAD670': (m, a) => D2GAME_PACKET_Send0x73MissileSync113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FCAD710': (m, a) => NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCADB00': (m, a) => D2NET_SendUnitPosSync0x15ToClient113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCADC30': (m, a) => S2C_SendPacket0F_UnitWalkToTarget113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCAE170': (m, a) => D2GAME_PACKET_Send0x5BPlayerInGame113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCAE2A0': (m, a) => NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c(m, a[0]!, a[1]!),
  '0x6FCAE6F0': (m, a) => EVENT_FreeNode113c(m, a[0]!, a[1]!),
  '0x6FCAF620': (m, a) => NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCAF6C0': (m, a) => SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCAF720': (m, a) => NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c(m, a[0]!, a[1]!),
  '0x6FC767A0': (m, a) => ACT5Q6_SeqFilter_6FC767A0_113c(m, a[0]!, { invokeQuestSeqFilter: (mem, pq) => QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(mem as SparseMemory113c, pq) }),
  '0x6FC76B10': (m, a) => ACT5Q4_SeqFilter_6FC76B10_113c(m, a[0]!, { invokeQuestSeqFilter: (mem, pq) => QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(mem as SparseMemory113c, pq) }),
  '0x6FC77000': (m, a) => ACT5Q6_Callback00_NpcActivate_6FC77000_113c(m, a[0]!, a[1]!),
  '0x6FC775F0': (m, a) => ACT5Q5_Callback00_NpcActivate_6FC775F0_113c(m, a[0]!, a[1]!),
  '0x6FC77A60': (m, a) => ACT5Q4_Callback00_NpcActivate_6FC77A60_113c(m, a[0]!, a[1]!),
  '0x6FC783C0': (m, a) => ACT5Q2_Callback00_NpcActivate_6FC783C0_113c(m, a[0]!, a[1]!),
  '0x6FC787C0': (m, a) => ACT5Q1_Callback00_NpcActivate_6FC787C0_113c(m, a[0]!, a[1]!),
  '0x6FC7A000': (m, a) => ACT5Q3_GrantScrollOfResistanceStats_6FC7A000_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC7AFB0': (m, a) => QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m, a[0]!, (mem, pq) => QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(mem, pq)),
  '0x6FC7B4F0': (m, a) => ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c(m, a[0]!, a[1]!),
  '0x6FC7B7A0': (m, a) => ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c(m, a[0]!, a[1]!),
  '0x6FC7BF70': (m, a) => QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c(m, a[0]!, a[1]!),
  '0x6FC7C100': (m, a) => ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC7C3A0': (m, a) => ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c(m, a[0]!),
  '0x6FC7C5C0': (m, a) => ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c(m, a[0]!, W4B3_QUEST_HOOKS),
  '0x6FC7C9E0': (m, a) => ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c(m, a[0]!, a[1]!),
  '0x6FC7D0A0': (m, a) => ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c(m, a[0]!),
  '0x6FC7D1D0': (m, a) => ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c(m, a[0]!, a[1]!),
  '0x6FC7D960': (m, a) => ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC7DA70': (m, a) => ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c(m, a[0]!, a[1]!),
  '0x6FC7E200': (m, a) => ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c(m, a[0]!, a[1]!),
  '0x6FC7E3C0': (m, a) => ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c(m, a[0]!, a[1]!, W4B3_QUEST_HOOKS),
  '0x6FC7EB30': (m, a) => ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c(m, a[0]!, W4B3_QUEST_HOOKS),
  '0x6FC7EED0': (m, a) => ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c(m, a[0]!, a[1]!, (mem, pq) => QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(mem, pq)),
  '0x6FC7F200': (m, a) => ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c(m, a[0]!, a[1]!),
  '0x6FC7F5E0': (m, a) => ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c(m, a[0]!, a[1]!),
  '0x6FC7FE30': (m, a) => ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c(m, a[0]!, a[1]!),
  '0x6FC7DF70': (m, a) => D2Game_6FC7DF70_113c(m, a[0]!),
  '0x6FC80A80': (m, a) => ACT1Q6_Callback00_NpcActivate_6FC80A80_113c(m, a[0]!, a[1]!),
  '0x6FC835D0': (m, a) => ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c(m, a[0]!, a[1]!),
  '0x6FC83F90': (m, a) => ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c(m, a[0]!, a[1]!),
  '0x6FC84430': (m, a) => ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c(m, a[0]!, a[1]!),
  '0x6FC85260': (m, a) => ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c(m, a[0]!, a[1]!),
  '0x6FC860D0': (m, a) => ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, W4B3_QUEST_HOOKS),
  '0x6FC86960': (m, a) => ACT1Q3_OnNpcInitCainSearch_6FC86960_113c(m, a[0]!, a[1]!, (m2, pu, it, pg, pi) => D2Game_6FC565E0_113c(m2, it, pu, pg, pi)),
  '0x6FC86CE0': (m, a) => ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c(m, a[0]!, a[1]!, (m2, pu, it, pg, pi) => D2Game_6FC565E0_113c(m2, it, pu, pg, pi), (m2, pg, pu, code, lvl, qual, drop) => D2Game_6FC56470_113c(m2, lvl, code, pu, pg, qual, drop), (m2, pq) => QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m2, pq)),
  '0x6FC87000': (m, a) => ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c(m, a[0]!, a[1]!, (m2, pu, it, pg, pi) => D2Game_6FC565E0_113c(m2, it, pu, pg, pi), (m2, pq) => QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m2, pq)),
  '0x6FC874A0': (m, a) => ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c(m, a[0]!, a[1]!),
  '0x6FC87730': (m, a) => ACT1Q4_OnCainGibbetOperated_6FC87730_113c(m, a[0]!, a[1]!),
  '0x6FC87A90': (m, a) => ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c(m, a[0]!, a[1]!),
  '0x6FC87E00': (m, a) => ACT1Q6_OnAndarielKilled_6FC87E00_113c(m, a[0]!, a[1]!),
  '0x6FC88280': (m, a) => ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC88920': (m, a) => ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c(m, a[0]!, a[1]!, (m2, pg, pu, npc) => D2Game_6FCE1030_113c(m2, pg, pu, npc), (m2, pq) => QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m2, pq)),
  '0x6FC88E20': (m, a) => ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c(m, a[0]!, a[1]!),
  '0x6FC88FC0': (m, a) => ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c(m, a[0]!),
  '0x6FC8A0D0': (m, a) => OBJECT_SendUpdatePacketsToClient113c(m, a[1]!, a[0]!),
  '0x6FC8A220': (m, a) => OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c(m, a[0]!, a[1]!),
  '0x6FC8A720': (m, a) => OBJ_TryOperateObjectIfInRange_6FC8A720_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, W4B3_QUEST_HOOKS),
  '0x6FC8A9D0': (m, a) => OBJ_OperateDoorWithLockCheck_6FC8A9D0_113c(m, a[0]!, a[1]!),
  '0x6FC8CD40': (m, a) => OBJ_OperateDuranceStairs_6FC8CD40_113c(m, a[0]!),
  '0x6FC8CF90': (m, a) => OBJ_OperateWaypoint_6FC8CF90_113c(m, a[0]!),
  '0x6FC8D0F0': (m, a) => OBJ_OperateFn_TownAndPermanentPortal_6FC8D0F0_113c(m, a[0]!, a[1]!),
  '0x6FC8D960': (m, a) => OBJ_OperateWirtsBody_6FC8D960_113c(m, a[0]!),
  '0x6FC8DA00': (m, a) => OBJ_OperateShrine_6FC8DA00_113c(m, a[0]!),
  '0x6FC8E270': (m, a) => OBJECTS_FloorSpikesEventTick_6FC8E270_113c(m, a[0]!, a[1]!),
  '0x6FC8E680': (m, a) => OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC70250': (m, a) => SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c(m, a[0]!, a[1]!),
  '0x6FC705D0': (m, a) => SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC70B70': (m, a) => SKILLS_ApplyAttractCurseCallback_6FC70B70_113c(m, a[0]!, a[1]!),
  '0x6FC70FE0': (m, a) => SKILLS_SrvDo_BoneWall_6FC70FE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC71540': (m, a) => SKILLS_SrvDo_IronGolem_6FC71540_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC71750': (m, a) => SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC718B0': (m, a) => SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC71A90': (m, a) => SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC71C60': (m, a) => SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC71E70': (m, a) => SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC8F510': (m, a) => QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c(m, a[0]!, a[1]!),
  '0x6FC92210': (m, a) => CUBE_Op15_SpawnSecretCowLevelPortal_6FC92210_113c(m, a[0]!, a[1]!),
  '0x6FC94870': (m, a) => MONSTER_Event12_ExpireTimedStats113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC952A0': (m, a) => MONSTER_Event1_ModeEnd113c(m, a[0]!, a[1]!, a[2]!, a[3]!, { onModeEnd: () => {} }),
  '0x6FC952E0': (m, a) => MONSTER_Event0_ModeStep113c(m, a[0]!, a[1]!, a[2]!, a[3]!, { onModeStep: (mem, g, u, entry) => { if (entry.pfnStep === 0x6fc95320) MONSTER_ClearStepEvents113c(mem, g, u); else if (entry.pfnStep === 0x6fc95ce0) MONSTER_AdvanceAttackOrSkillStep113c(mem, g, u); } }),
  '0x6FC95C60': (m, a) => MONSTER_FireModeMissile113c(m, a[0]!, a[1]!, a[2]!, { onSpawnModeMissile: (mem, g, mid, u, sid, sl, ox, oy) => SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(mem, g, mid, u, sid, sl, ox, oy, 0, 0, 1), onPostModeMissile: MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c }),
  '0x6FC96740': (m, a) => MONSTER_Event03_RegenAndPoisonTick113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC737D0': (m, a) => PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c(m, a[0]!, a[1]!, 0, 0, a[2]!),
  '0x6FC74320': (m, a) => PLAYERSAVE_SavePlayerCharacter_6FC74320_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC7E420': (m, a) => ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c(m, a[0]!, a[1]!, W4B3_QUEST_HOOKS),
  '0x6FC90240': (m, a) => CUBE_ValidateRecipeInputSlot_6FC90240_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC917E0': (m, a) => STASH_HandleBankGoldOrCloseAction_6FC917E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC92220': (m, a) => D2Game_6FC92220_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC92FC0': (m, a) => CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c(m, a[0]!, a[1]!, D2Game_6FC92220_113c),
  '0x6FC93860': (m, a) => PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC94200': (m, a) => PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC95A40': (m, a) => MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC969A0': (m, a) => MONSTER_DispatchEvent113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, MON_EVT_CBS),
  '0x6FC97240': (m, a) => MONSTER_ApplyElementalDamageAndResistStats113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC97790': (m, a) => MONSTER_ExecuteMeleeSwing113c(m, a[0]!, a[1]!, undefined, { onExecuteMeleeDamage: (mem, att, g, def, pDmg, srcDam) => { const wFlags = SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(mem, att, def, g, 0, 0, pDmg); mem.setU16(pDmg, wFlags & 0xffff); SUNITDMG_AllocCombat113c(mem, g, att, def, pDmg, srcDam); } }),
  '0x6FC97950': (m, a) => PLAYER_UpdateManaRegen113c(m, a[0]!),
  '0x6FC988B0': (m, a) => UNIT_SyncStateAndStatsToClient113c(m, a[0]!, a[1]!, a[2]!, GAP_A_SYNC_CALLEES),
  '0x6FC9B8E0': (m, a) => AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9C6E0': (m, a) => AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC9CB10': (m, a) => AI_LinkedOwnerTurretCycle_6FC9CB10_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9D670': (m, a) => AI_ThinkCommand14TriggeredSkill_6FC9D670_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9EA10': (m, a) => AI_Thinker_Izual_6FC9EA10_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA2570': (m, a) => AI_ThinkSimpleMeleeVariantB_6FCA2570_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA26B0': (m, a) => MONAI_CorruptRogueArcherThink_6FCA26B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA3AC0': (m, a) => AI_ThinkDualAttackMelee_6FCA3AC0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA3FE0': (m, a) => MONAI_CorpseSpitterThink_6FCA3FE0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA5500': (m, a) => MONAI_PutridDefilerImpregnateThink_6FCA5500_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA5B60': (m, a) => AI_ThinkMephistoBoss_6FCA5B60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA6280': (m, a) => AI_ThinkGiantMosquito_6FCA6280_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCACA20': (m, a) => D2GAME_PACKET_SendMonsterAssign113c(m, a[0]!, a[1]!, 0),
  '0x6FC70070': (m, a) => SKILLS_PostInitSummonedPetStatsAndAi_6FC70070_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC863A0': (m, a) => ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c(m, a[0]!),
  '0x6FC8A330': (m, a) => OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, (mem, va, args) => va === 0x6fc8cf90 ? OBJ_OperateWaypoint_6FC8CF90_113c(mem, args) : 0),
  '0x6FC8B200': (m, a) => OBJECT_SyncStateAndEventsToClient113c(m, a[0]!, a[1]!, B4D_GAP_A_SYNC_CALLEES),
  '0x6FC8E930': (m, a) => D2Game_6FC8E930_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC95350': (m, a) => MONSTER_SetDeathPathAndAnim113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC95680': (m, a) => MONSTER_DropTreasureOnDeath_6FC95680_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC965E0': (m, a) => MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c(m, a[0]!, a[1]!),
  '0x6FC977F0': (m, a) => MONSTER_ExecuteEventsWrapper113c(m, a[0]!, a[1]!, a[2]!, 0),
  '0x6FC98550': (m, a) => PLAYER_StartModeAtCoords113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC99A10': (m, a) => PLAYER_StepAnimationModeTick113c(m, a[0]!, a[1]!, a[2]!, a[3]!, (mem, g, u) => PLAYER_StepModeWalkOrRun113c(mem, g, u)),
  '0x6FC981C0': (m, a) => PLAYER_StartBlockMode113c(m, a[0]!, a[1]!, '1HS', (mem, pg, plr) => SUNIT_ScheduleModeAnimEvents113c(mem, pg, plr, 0, 1)),
  '0x6FCAEBC0': (m, a) => EVENT_ExecuteMonsterEvents113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA5780': (m, a) => AI_SummonerThink_6FCA5780_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA90A0': (m, a) => AI_FallenShaman113c(m, a[0]!, a[1]!, a[2]!, makeP9MinimalWorld(m, a[0]!)),
  '0x6FC76CE0': (m, a) => ACT5_InitObjectNoop_6FC76CE0_113c(m, a[0]!),
  '0x6FC73F10': (m, a) => PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
}


interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P9VectorRecord {
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

const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_SETUP_BASE = 0x30020000
const STAGE_CS_GAME = 0x30078000
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
    const sz = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    this.fill(p, sz, 0)
    this.heapCursor = (p + sz) >>> 0
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

function canonicalizeStackPtrsInHeap(bytes: Uint8Array): Uint8Array {
  const copy = bytes.slice()
  const dv = new DataView(copy.buffer, copy.byteOffset, copy.byteLength)
  for (let off = 0; off + 4 <= copy.length; off += 4) {
    const v = dv.getUint32(off, true) >>> 0
    if (v >= 0x7e000000 && v < 0x7f000000) {
      dv.setUint32(off, 0x7e000000, true)
    }
  }
  return copy
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

function loadVectors(): K6P9VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p9/k6-p9-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P9VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P9VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6-P9] Band B real-DLL D2Game.dll vectors', () => {
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
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd19f00, 0x3100, 0)
    mem.fill(0x6fd27000, 0xb000, 0)
    mem.setU32(0x6fd27bb8 + 0x17 * 4, 0x6fc8cf90)
    mem.fill(0x6fd39fa0, 8, 0)
    mem.fill(0x004000f0, 8, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 149 target real-DLL D2Game.dll Band B VAs (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(149)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fc70000)
      expect(num).toBeLessThanOrEqual(0x6fcaffff)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
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
        for (const cap of vec.extraCaps) {
          const capAddr = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capAddr, cap.len, 0)
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
          const actualHeapBytes = canonicalizeStackPtrsInHeap(
            mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE),
          )
          const actualHeapHex = bytesToHex(actualHeapBytes)
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
