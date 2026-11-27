/**
 * Milestone #37 ([K6] Wave 3) Real-DLL `D2Common.dll` + `D2Game.dll` Differential Vector Suite:
 * Replays all 377 NDJSON vectors emitted by `tools/oracle/k6-w3/k6-w3-d2game-emitter.c`
 * (`tests/fixtures/oracle/k6-w3/k6-w3-d2game-vectors.ndjson.gz`):
 *   - Closes `D2Common.dll` real-DLL verification to `1,479 / 1,479 (100.00%)` by verifying
 *     the final 2 `D2Common.dll` functions (`0x6FD87470`, `0x6FD96330`)
 *   - Verifies 123 previously un-DLL-verified `D2Game.dll` functions in `0x6FC20000..0x6FC7FFFF`
 * Asserts 100% bit-exact agreement on:
 *   1. Return value `(ret >>> 0) & retMask === expectedEax`
 *   2. Post-call memory arena (`workHex` byte-for-byte equality)
 *   3. `Fog.#10024` assertion line (`D2CommonAssertError.line === expectedAssert.line`)
 *   4. Runtime VA trace (`beginVaTrace113c` / `endVaTrace113c` records `${mod}:${va}`)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  ENVIRONMENT_GetTimeOfDayAndAngle113c,
  ITEMS_CalcByTimeStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  AI_CheckAnyMinionDeadCallback113c,
  OBJECTS_SubstituteObjectClassIdFromParm0_113c,
  PLAYER_CheckHostilePlayerCallback113c,
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts'
import { PLAYER_GetWaypointDataForDifficulty_6FC21720_113c } from '../../../src/d2kern-113c/game/k2-laneH-0x6fc2-w1-113c.ts'
import {
  AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c,
  AI_CountAdjacentUnitsCallback_6FC35590_113c,
  AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c,
  ITEMS_CalcDiminishingMfPercent_6FC2E130_113c,
  ITEMS_GetVendorHealthPotionCode_6FC2E390_113c,
  ITEMS_GetVendorManaPotionCode_6FC2E310_113c,
  ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c,
  MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c,
  MONUMOD_SetShatterOnDeath_6FC41A70_113c,
} from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c.ts'
import {
  CLIENT_SelectFlag20ClientCallback_6FC4A700_113c,
  QUESTS_CheckNotIntro_6FC53970_113c,
  QUESTS_GetQuestSeedPtr_6FC53D90_113c,
  QUESTS_ResolveDefaultStatusByte_6FC53A30_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts'
import {
  MISSILES_FilterFlagBit4Missile_6FC59510_113c,
  MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c,
  MISSILES_SetElemLenByEType_6FC594B0_113c,
  MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c,
  MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c,
  MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c,
  MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c,
  MISSILES_SrvHit_CopyColdLenToFrzLen_6FC59040_113c,
  MISSILES_SrvHit_MoveColdLenToFrzLen_6FC58E70_113c,
  MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c,
  MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c,
  PLAYER_FreePlayerDataList98_6FC57500_113c,
  PLAYER_GetPlayerDataField48_6FC57440_113c,
  QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c,
  QUESTS_PackNpcIntroFlags_6FC54C70_113c,
  QUESTS_SetNpcIntroFlags_6FC54D00_113c,
  SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c,
} from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c.ts'
import {
  CLIENTS_FindClientByIdInGame_6FC69FE0_113c,
  CLIENTS_FreeSaveDataBuffer_6FC69630_113c,
  CLIENTS_GetClientByte08_6FC69BF0_113c,
  CLIENTS_GetClientField488_6FC69AB0_113c,
  CLIENTS_GetClientNamePtr_6FC69A20_113c,
  CLIENTS_GetSaveDataPtr_6FC69790_113c,
  CLIENTS_GetSaveDataSize_6FC69760_113c,
  CLIENTS_GetSaveHeaderPtr_6FC69240_113c,
  CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c,
  CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c,
  CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c,
  CLIENTS_SetClientActNo_6FC69D70_113c,
  CLIENTS_SetClientFlag20_6FC69580_113c,
  CLIENTS_SetClientInitState_6FC69B70_113c,
  MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c,
  PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c,
  SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c,
  SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c,
} from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c.ts'
import {
  ACT5Q0_StatusFilter_6FC76EA0_113c,
  ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c,
  ACT5Q1_ActiveFilter_6FC76D80_113c,
  ACT5Q1_StatusFilter_6FC76E00_113c,
  ACT5Q2_ActiveFilter_6FC76C40_113c,
  ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c,
  ACT5Q2_Callback11_RemovePlayerGuid_6FC782A0_113c,
  ACT5Q2_Callback14_PlayerJoined_6FC781A0_113c,
  ACT5Q2_Callback15_ClearState04_6FC78240_113c,
  ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c,
  ACT5Q3_GetPortalTargetCoords_6FC76A40_113c,
  ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c,
  ACT5Q3_RecordAnyaPosition_6FC76A00_113c,
  ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c,
  ACT5Q4_ActiveFilter_6FC76840_113c,
  ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c,
  ACT5Q4_CompletePersonalizationReward_6FC777F0_113c,
  ACT5Q4_StatusFilter_6FC768C0_113c,
  ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c,
  ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c,
  ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c,
  ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c,
  ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c,
  ACT5Q5_GetSummitPlayerCount_6FC766D0_113c,
  ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c,
  ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c,
  ACT5Q6_ActiveFilter_6FC76810_113c,
  ACT5Q6_Callback11_RemovePlayerGuid_6FC775D0_113c,
  ACT5Q6_Callback14_PlayerJoined_6FC77540_113c,
  ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c,
} from '../../../src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c.ts'
import { AIGENERAL_GetOwnerData_6FC40D50_113c } from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c.ts'
import {
  CLIENTS_UpdateCharacterProgression113c,
  MONSTER_CheckPlayerInteractUnlocked113c,
  MONSTER_HasAnyInteractingPlayer113c,
  MONSTER_SetLastInteractTarget113c,
  REGPOP_CanSpawnPresetMinionPack113c,
  REGPOP_RemapDirectionalMonsterClassId113c,
  SKILLS_DeductFromStatPool113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c.ts'
import {
  ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c,
  ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c,
  ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c,
  ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c,
  ACT5Q3_Callback11_RemovePlayerGuidAndCheckIce_6FC78040_113c,
  ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c,
  ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c,
  ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c,
  ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c,
  ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c,
  ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c,
  AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c,
  MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c,
  STORM_TSHashTableAllocUniqueKey_6FC22060_113c,
  STORM_TSListPlacementNewCopy_6FC226F0_113c,
  STORM_TSListPlacementNewDefault_6FC225A0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b1-113c.ts'
import { STORM_TSListDestroy_6FC21FE0_113c } from '../../../src/d2kern-113c/game/k2-w3b1-113c.ts'
import {
  QUESTS_ApplyActNpcIntroFlags_6FC55C20_113c,
  QUESTS_CheckLevelTransitionBlocked_6FC54020_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c.ts'
import {
  ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F_6FC785C0_113c,
  ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c,
  ACT5Q2_FindSpawnedPrisonObjectForUnit_6FC7A290_113c,
  ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c,
  ACT5Q3_ActiveFilter_6FC77F50_113c,
  ACT5Q3_Callback03_OnItemPickedUp_6FC77DD0_113c,
  ACT5Q3_Callback11_OnPlayerConnect_6FC77E80_113c,
  ACT5Q6_ActiveFilter_6FC76EF0_113c,
  ACT5Q6_CompleteQuest28AndUpdateProgression_6FC78BE0_113c,
  PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c,
} from '../../../src/d2kern-113c/game/k2-w3b5-113c.ts'
import { STORM_TSListDestroySehWrapper_6FC21F60_113c } from '../../../src/d2kern-113c/game/k2-w4b1-113c.ts'
import { PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c } from '../../../src/d2kern-113c/game/k2-w4b2-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_GetBossMinionField34_113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import { REPO_ROOT_113C, loadManifest113c } from '../../../tools/oracle/kern-replay/replay-113c.ts'

interface TablesHeaderRow {
  readonly k: 'tables'
  readonly arenaBase: string
  readonly workBase: string
  readonly tablesHex: string
}

interface K6W3VectorRow {
  readonly mod: 'D2Common' | 'D2Game'
  readonly va: string
  readonly name: string
  readonly caseIndex: number
  readonly inputs: {
    readonly args: readonly string[]
    readonly workHex: string
  }
  readonly expectedAssert?: {
    readonly line: number
  }
  readonly outputs: {
    readonly eax: string
    readonly retMask: string
    readonly workHex: string
  }
}

type TsTargetFn = (m: Memory113c, ...args: number[]) => number | void

const TARGET_BY_MOD_VA: Readonly<Record<string, TsTargetFn>> = {
  // Part A: Final 2 D2Common.dll functions (1,479 / 1,479 = 100.00%)
  'D2Common:0x6FD87470': (m, a0, a1) => ENVIRONMENT_GetTimeOfDayAndAngle113c(m, a0!, a1!).timeOfDay,
  'D2Common:0x6FD96330': (m, a0, a1, a2, a3, a4, a5) =>
    ITEMS_CalcByTimeStat113c(a0!, a1!, a2!, m, a3!, a4!, a5!),

  // Part B: 123 D2Game.dll functions in 0x6FC20000..0x6FC7FFFF
  'D2Game:0x6FC21720': (m, a0, a1) => PLAYER_GetWaypointDataForDifficulty_6FC21720_113c(m, a0!, a1!),
  'D2Game:0x6FC21F60': (m, a0) => STORM_TSListDestroySehWrapper_6FC21F60_113c(m, a0!),
  'D2Game:0x6FC21FE0': (m, a0) => STORM_TSListDestroy_6FC21FE0_113c(m, a0!),
  'D2Game:0x6FC22060': (m, a0) => STORM_TSHashTableAllocUniqueKey_6FC22060_113c(m, a0!),
  'D2Game:0x6FC225A0': (m, a0) => STORM_TSListPlacementNewDefault_6FC225A0_113c(m, a0!),
  'D2Game:0x6FC226F0': (m, a0, a1) => STORM_TSListPlacementNewCopy_6FC226F0_113c(m, a0!, a1!),
  'D2Game:0x6FC2E130': (m, a0, a1, a2) => ITEMS_CalcDiminishingMfPercent_6FC2E130_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC2E150': (m, a0, a1, a2) => ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC2E310': (m, a0) => ITEMS_GetVendorManaPotionCode_6FC2E310_113c(m, a0!),
  'D2Game:0x6FC2E390': (m, a0) => ITEMS_GetVendorHealthPotionCode_6FC2E390_113c(m, a0!),
  'D2Game:0x6FC35570': (m, a0, a1, a2) => AI_CheckAnyMinionDeadCallback113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC35590': (m, a0, a1) => AI_CountAdjacentUnitsCallback_6FC35590_113c(m, a0!, a1!),
  'D2Game:0x6FC358F0': (m, a0, a1) => AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c(m, a0!, a1!),
  'D2Game:0x6FC3EC40': (m, a0, a1, a2) => MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC40D50': (m, a0, a1, a2) => AIGENERAL_GetOwnerData_6FC40D50_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC41040': (m, a0) => AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c(m, a0!),
  'D2Game:0x6FC41210': (m, a0, a1, a2, a3, a4, a5, a6) =>
    AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c(m, a0!, a1!, a2!, a3!, a4!, a5!, a6!),
  'D2Game:0x6FC41A70': (m, a0, a1, a2, a3) => MONUMOD_SetShatterOnDeath_6FC41A70_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC4A700': (m, a0, a1) => CLIENT_SelectFlag20ClientCallback_6FC4A700_113c(m, a0!, a1!),
  'D2Game:0x6FC4E8B0': (m, a0) => OBJECTS_SubstituteObjectClassIdFromParm0_113c(m, a0!),
  'D2Game:0x6FC53970': (m, a0, a1) => QUESTS_CheckNotIntro_6FC53970_113c(m, a0!, a1!),
  'D2Game:0x6FC53A30': (m, a0, a1, a2) => QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC53D90': (m, a0) => QUESTS_GetQuestSeedPtr_6FC53D90_113c(m, a0!),
  'D2Game:0x6FC54020': (m, a0, a1, a2, a3) => QUESTS_CheckLevelTransitionBlocked_6FC54020_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC540C0': (m, a0, a1) => QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, a0!, a1!),
  'D2Game:0x6FC54C70': (m, a0, a1, a2, a3) => QUESTS_PackNpcIntroFlags_6FC54C70_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC54D00': (m, a0, a1, a2, a3) => QUESTS_SetNpcIntroFlags_6FC54D00_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC55A20': (m, a0, a1, a2, a3) =>
    QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC55C20': (m, a0, a1, a2) => QUESTS_ApplyActNpcIntroFlags_6FC55C20_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC57440': (m, a0) => PLAYER_GetPlayerDataField48_6FC57440_113c(m, a0!),
  'D2Game:0x6FC57500': (m, a0, a1) => PLAYER_FreePlayerDataList98_6FC57500_113c(m, a0!, a1!),
  'D2Game:0x6FC576B0': (m, a0, a1) => PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c(m, a0!, a1!),
  'D2Game:0x6FC57940': (m, a0, a1, a2) => PLAYER_CheckHostilePlayerCallback113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC58E70': (m, a0, a1, a2, a3) =>
    MISSILES_SrvHit_MoveColdLenToFrzLen_6FC58E70_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC58E90': (m, a0, a1, a2) => MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC58EA0': (m, a0, a1, a2) => MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC59040': (m, a0, a1, a2, a3) =>
    MISSILES_SrvHit_CopyColdLenToFrzLen_6FC59040_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC591A0': (m, a0, a1, a2) => MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC592E0': (m, a0, a1) => MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c(m, a0!, a1!),
  'D2Game:0x6FC594B0': (m, a0, a1, a2) => MISSILES_SetElemLenByEType_6FC594B0_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC59510': (m, a0) => MISSILES_FilterFlagBit4Missile_6FC59510_113c(m, a0!),
  'D2Game:0x6FC59560': (m, a0, a1, a2, a3) =>
    MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC59600': (m, a0, a1, a2) => MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC59C80': (m, a0, a1, a2, a3) =>
    MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC59F70': (m, a0, a1, a2) => MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC62230': (m, a0, a1, a2, a3) => SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC645E0': (m, a0, a1) => SKILLS_DeductFromStatPool113c(m, a0!, a1!),
  'D2Game:0x6FC66D90': (m, a0) => REGPOP_CanSpawnPresetMinionPack113c(m, a0!),
  'D2Game:0x6FC66E80': (m, a0, a1) => REGPOP_RemapDirectionalMonsterClassId113c(m, a0!, a1!),
  'D2Game:0x6FC68300': (m, a0, a1, a2) => MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC68370': (m, a0) => MONSTER_HasAnyInteractingPlayer113c(m, a0!),
  'D2Game:0x6FC684F0': (m, a0, a1) => MONSTER_CheckPlayerInteractUnlocked113c(m, a0!, a1!),
  'D2Game:0x6FC68560': (m, a0) => MONSTER_GetBossMinionField34_113c(m, a0!),
  'D2Game:0x6FC68750': (m, a0, a1, a2) => MONSTER_SetLastInteractTarget113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC69240': (m, a0) => CLIENTS_GetSaveHeaderPtr_6FC69240_113c(m, a0!),
  'D2Game:0x6FC69580': (m, a0) => CLIENTS_SetClientFlag20_6FC69580_113c(m, a0!),
  'D2Game:0x6FC69630': (m, a0) => CLIENTS_FreeSaveDataBuffer_6FC69630_113c(m, a0!),
  'D2Game:0x6FC69760': (m, a0) => CLIENTS_GetSaveDataSize_6FC69760_113c(m, a0!),
  'D2Game:0x6FC69790': (m, a0) => CLIENTS_GetSaveDataPtr_6FC69790_113c(m, a0!),
  'D2Game:0x6FC69A20': (m, a0) => CLIENTS_GetClientNamePtr_6FC69A20_113c(m, a0!),
  'D2Game:0x6FC69AB0': (m, a0) => CLIENTS_GetClientField488_6FC69AB0_113c(m, a0!),
  'D2Game:0x6FC69B70': (m, a0, a1) => CLIENTS_SetClientInitState_6FC69B70_113c(m, a0!, a1!),
  'D2Game:0x6FC69BF0': (m, a0) => CLIENTS_GetClientByte08_6FC69BF0_113c(m, a0!),
  'D2Game:0x6FC69D70': (m, a0, a1) => CLIENTS_SetClientActNo_6FC69D70_113c(m, a0!, a1!),
  'D2Game:0x6FC69FE0': (m, a0, a1) => CLIENTS_FindClientByIdInGame_6FC69FE0_113c(m, a0!, a1!),
  'D2Game:0x6FC6A2D0': (m, a0, a1, a2) => CLIENTS_UpdateCharacterProgression113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC6A370': (m, a0, a1) => CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c(m, a0!, a1!),
  'D2Game:0x6FC6A660': (m, a0, a1) => CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c(m, a0!, a1!),
  'D2Game:0x6FC6A6E0': (m, a0, a1) => CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c(m, a0!, a1!),
  'D2Game:0x6FC6C1C0': (m, a0, a1, a2, a3) =>
    SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC6EE40': (m, a0, a1, a2, a3) =>
    SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c(m, a0!, a1!, a2!, a3!),
  'D2Game:0x6FC73170': (m, a0, a1) => PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c(m, a0!, a1!),
  'D2Game:0x6FC73260': (m, a0) => PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c(m, a0!),
  'D2Game:0x6FC76570': (m, a0) => ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c(m, a0!),
  'D2Game:0x6FC76600': (m, a0) => ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c(m, a0!),
  'D2Game:0x6FC76640': (m, a0) => ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c(m, a0!),
  'D2Game:0x6FC766D0': (m, a0) => ACT5Q5_GetSummitPlayerCount_6FC766D0_113c(m, a0!),
  'D2Game:0x6FC76740': (m, a0, a1) => ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c(m, a0!, a1!),
  'D2Game:0x6FC76810': (m, a0, a1, a2, a3, a4) => ACT5Q6_ActiveFilter_6FC76810_113c(m, a0!, a1!, a2!, a3!, a4!),
  'D2Game:0x6FC76840': (m, a0, a1, a2, a3, a4) => ACT5Q4_ActiveFilter_6FC76840_113c(m, a0!, a1!, a2!, a3!, a4!),
  'D2Game:0x6FC768C0': (m, a0, a1, a2, a3, a4) => ACT5Q4_StatusFilter_6FC768C0_113c(m, a0!, a1!, a2!, a3!, a4!),
  'D2Game:0x6FC76950': (m, a0) => ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c(m, a0!),
  'D2Game:0x6FC76A00': (m, a0, a1) => ACT5Q3_RecordAnyaPosition_6FC76A00_113c(m, a0!, a1!),
  'D2Game:0x6FC76A40': (m, a0, a1, a2) => ACT5Q3_GetPortalTargetCoords_6FC76A40_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC76B80': (m, a0) => ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c(m, a0!),
  'D2Game:0x6FC76C40': (m, a0, a1, a2, a3, a4) => ACT5Q2_ActiveFilter_6FC76C40_113c(m, a0!, a1!, a2!, a3!, a4!),
  'D2Game:0x6FC76CF0': (m, a0) => ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c(m, a0!),
  'D2Game:0x6FC76D80': (m, a0, a1, a2, a3, a4) => ACT5Q1_ActiveFilter_6FC76D80_113c(m, a0!, a1!, a2!, a3!, a4!),
  'D2Game:0x6FC76E00': (m, a0, a1, a2, a3, a4) => ACT5Q1_StatusFilter_6FC76E00_113c(m, a0!, a1!, a2!, a3!, a4!),
  'D2Game:0x6FC76EA0': (m, a0, a1, a2, a3, a4) => ACT5Q0_StatusFilter_6FC76EA0_113c(m, a0!, a1!, a2!, a3!, a4!),
  'D2Game:0x6FC76EB0': (m, a0, a1) => ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c(m, a0!, a1!),
  'D2Game:0x6FC76EF0': (m, a0, a1, a2, a3, a4) => ACT5Q6_ActiveFilter_6FC76EF0_113c(m, a0!, a1!, a2!, a3!, a4!),
  'D2Game:0x6FC76FC0': (m, a0, a1) => ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c(m, a0!, a1!),
  'D2Game:0x6FC77440': (m, a0, a1, a2) => ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC77540': (m, a0, a1) => ACT5Q6_Callback14_PlayerJoined_6FC77540_113c(m, a0!, a1!),
  'D2Game:0x6FC775D0': (m, a0, a1) => ACT5Q6_Callback11_RemovePlayerGuid_6FC775D0_113c(m, a0!, a1!),
  'D2Game:0x6FC777F0': (m, a0, a1) => ACT5Q4_CompletePersonalizationReward_6FC777F0_113c(m, a0!, a1!),
  'D2Game:0x6FC77A20': (m, a0, a1) => ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c(m, a0!, a1!),
  'D2Game:0x6FC77C00': (m, a0, a1, a2) => ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC77D80': (m, a0, a1, a2) =>
    ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC77DD0': (m, a0, a1) => ACT5Q3_Callback03_OnItemPickedUp_6FC77DD0_113c(m, a0!, a1!),
  'D2Game:0x6FC77E80': (m, a0, a1) => ACT5Q3_Callback11_OnPlayerConnect_6FC77E80_113c(m, a0!, a1!),
  'D2Game:0x6FC77F50': (m, a0, a1, a2, a3, a4) => ACT5Q3_ActiveFilter_6FC77F50_113c(m, a0!, a1!, a2!, a3!, a4!),
  'D2Game:0x6FC78040': (m, a0, a1) => ACT5Q3_Callback11_RemovePlayerGuidAndCheckIce_6FC78040_113c(m, a0!, a1!),
  'D2Game:0x6FC78110': (m, a0, a1, a2) => ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC781A0': (m, a0, a1) => ACT5Q2_Callback14_PlayerJoined_6FC781A0_113c(m, a0!, a1!),
  'D2Game:0x6FC78240': (m, a0, a1) => ACT5Q2_Callback15_ClearState04_6FC78240_113c(m, a0!, a1!),
  'D2Game:0x6FC78260': (m, a0, a1) => ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, a0!, a1!),
  'D2Game:0x6FC782A0': (m, a0, a1) => ACT5Q2_Callback11_RemovePlayerGuid_6FC782A0_113c(m, a0!, a1!),
  'D2Game:0x6FC78530': (m, a0, a1, a2) => ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC785C0': (m, a0, a1) => ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F_6FC785C0_113c(m, a0!, a1!),
  'D2Game:0x6FC787A0': (m, a0, a1) => ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c(m, a0!, a1!),
  'D2Game:0x6FC78890': (m, a0, a1, a2) => ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC78BE0': (m, a0, a1, a2) => ACT5Q6_CompleteQuest28AndUpdateProgression_6FC78BE0_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC78FF0': (m, a0, a1, a2) =>
    ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC79230': (m, a0, a1) => ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c(m, a0!, a1!),
  'D2Game:0x6FC79290': (m, a0, a1) => ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c(m, a0!, a1!),
  'D2Game:0x6FC792F0': (m, a0, a1, a2) =>
    ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC79550': (m, a0, a1, a2) =>
    ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c(m, a0!, a1!, a2!),
  'D2Game:0x6FC79A60': (m, a0) => ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c(m, a0!),
  'D2Game:0x6FC79AB0': (m, a0) => ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c(m, a0!),
  'D2Game:0x6FC79B00': (m, a0) => ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c(m, a0!),
  'D2Game:0x6FC7A290': (m, a0, a1, a2) => ACT5Q2_FindSpawnedPrisonObjectForUnit_6FC7A290_113c(m, a0!, a1!, a2!),
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >>> 1)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function dumpHex(m: SparseMemory113c, addr: number, len: number): string {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += m.u8((addr + i) >>> 0).toString(16).padStart(2, '0')
  }
  return out
}

const FIXTURE_PATH = join(REPO_ROOT_113C, 'tests/fixtures/oracle/k6-w3/k6-w3-d2game-vectors.ndjson.gz')
const rawLines = gunzipSync(readFileSync(FIXTURE_PATH))
  .toString('utf8')
  .split('\n')
  .filter((l) => l.trim().length > 0)

const header = JSON.parse(rawLines[0]!) as TablesHeaderRow
const vectors = rawLines.slice(1).map((l) => JSON.parse(l) as K6W3VectorRow)
const arenaBase = Number.parseInt(header.arenaBase, 16) >>> 0
const workBase = Number.parseInt(header.workBase, 16) >>> 0
const staticTableBytes = hexToBytes(header.tablesHex)

describe('[K6] Wave 3 real-DLL D2Common (2) + D2Game (123) differential vectors (125 functions, 377 vectors)', () => {
  it('covers 2 D2Common + 123 D2Game manifest VAs with >= 3 non-degenerate vectors each', () => {
    expect(header.k).toBe('tables')
    expect(Object.keys(TARGET_BY_MOD_VA).length).toBe(125)
    expect(vectors.length).toBe(377)

    const manifest = loadManifest113c()
    const byKey = new Map<string, string[]>()
    for (const row of vectors) {
      const key = `${row.mod}:${row.va}`
      expect(manifest.has(key), `${key} missing from manifest-113c.json`).toBe(true)
      let arr = byKey.get(key)
      if (arr === undefined) {
        arr = []
        byKey.set(key, arr)
      }
      arr.push(`${row.expectedAssert?.line ?? -1}:${row.outputs.eax}:${row.outputs.workHex}`)
    }
    expect(byKey.size).toBe(125)
    for (const [key, sigs] of byKey) {
      expect(sigs.length, `${key} must have >= 3 vectors`).toBeGreaterThanOrEqual(3)
      expect(new Set(sigs).size, `${key} outputs must be non-degenerate`).toBeGreaterThanOrEqual(2)
    }
  })

  for (const key of Object.keys(TARGET_BY_MOD_VA)) {
    const [mod, va] = key.split(':') as ['D2Common' | 'D2Game', string]
    const vaCases = vectors.filter((v) => v.mod === mod && v.va === va)
    it(`${key} (${vaCases[0]?.name ?? 'unknown'}): matches real ${mod}.dll across all ${vaCases.length} cases`, () => {
      const fn = TARGET_BY_MOD_VA[key]!
      expect(vaCases.length).toBeGreaterThanOrEqual(3)

      for (const row of vaCases) {
        const m = new SparseMemory113c()
        m.loadBlock(arenaBase, staticTableBytes)
        // Bind D2Common + D2Game IAT & table globals identically to install_iat_hooks() in k6-w3-d2game-emitter.c
        m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, D2COMMON_SGPT_DATATABLES_VA_113C)
        m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, arenaBase)
        m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, (arenaBase + 0x0e00) >>> 0)
        m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, (arenaBase + 0x0e00) >>> 0)
        m.setU32(0x6fdd9078, (arenaBase + 0x0e80) >>> 0) // gdwInvBitMasks
        m.setU32(0x6fdf0b94, (arenaBase + 0x0e000) >>> 0) // sgptObjectsTxt
        m.setU32(0x6fdf0b98, 6) // sgnObjectsTxtCount
        m.setU32(0x6fdefb94, 4) // sgnItemsTxtCount
        m.setU32(0x6fdefb98, (arenaBase + 0x0f000) >>> 0) // sgptItemsTxt

        const preWorkBytes = hexToBytes(row.inputs.workHex)
        m.loadBlock(workBase, preWorkBytes)

        const numArgs = row.inputs.args.map((a) => Number.parseInt(a, 16) >>> 0)

        beginVaTrace113c()
        let caughtAssert: D2CommonAssertError | null = null
        let retVal = 0
        let traced: Set<string>
        try {
          try {
            const rawRet = fn(m, ...numArgs)
            retVal = typeof rawRet === 'number' ? rawRet >>> 0 : 0
          } catch (err) {
            if (err instanceof D2CommonAssertError) {
              caughtAssert = err
            } else {
              throw err
            }
          }
        } finally {
          traced = endVaTrace113c()
        }

        expect(traced.has(key), `${key} case ${row.caseIndex} did not record VA hit`).toBe(true)

        if (row.expectedAssert !== undefined) {
          expect(caughtAssert, `${key} case ${row.caseIndex} expected Fog.#10024 assert`).not.toBeNull()
          expect(caughtAssert!.line).toBe(row.expectedAssert.line)
        } else {
          expect(caughtAssert, `${key} case ${row.caseIndex} threw unexpected assert`).toBeNull()
          const retMask = Number.parseInt(row.outputs.retMask, 16) >>> 0
          const expEax = Number.parseInt(row.outputs.eax, 16) >>> 0
          expect(((retVal >>> 0) & retMask) >>> 0, `${key} case ${row.caseIndex} eax mismatch`).toBe(expEax)
        }

        const actualWorkHex = dumpHex(m, workBase, preWorkBytes.length)
        expect(actualWorkHex, `${key} case ${row.caseIndex} post-call memory mismatch`).toBe(
          row.outputs.workHex,
        )
      }
    })
  }
})
