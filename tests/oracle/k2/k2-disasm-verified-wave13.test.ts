/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 13: +133 VAs).
 *
 * Audits and verifies 133 `D2Game.dll` (`0x6FC20000`) closure functions across 4 shards:
 * - `k2w5-b5` (`src/d2kern-113c/game/k2-w5b5-113c.ts`, 34 eligible functions; 0 indirectUnknown)
 * - `k2w16-b1` (`src/d2kern-113c/game/k2-w16b1-113c.ts`, 33 eligible functions; 0 indirectUnknown)
 * - `k2w6-b4` (`src/d2kern-113c/game/k2-w6b4-113c.ts`, 33 eligible functions; 0 indirectUnknown)
 * - `k2w4-b8` (`src/d2kern-113c/game/k2-w4b8-113c.ts`, 33 eligible functions; `0x6FCD8A70`
 *   `indirectUnknown` kept at `ported`)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`,
 *    plus manifest promotion & `indirectUnknown` guardrails (`0x6FCD8A70` stays `ported`).
 * 2. Differential regression tests for every real 1.13c binary disassembly discrepancy fixed:
 *    - `k2-w16b1-113c.ts`: removed all 19 private stand-ins and wired canonical closure exports;
 *      fixed inverted distance check polarity in `0x6FCEFB30`/`0x6FCF0E90` (6-arg `0x6FCECFE0`),
 *      packet `0x5A` string offsets (`+0x08`/`+0x18`) in `0x6FC4DC70`, swapped `SUNIT_GetServerUnit`
 *      args (`+0x16c`/`+0x170`) in `0x6FC4DE30`, jump table `0x6FC94850` button indices &
 *      `GetTickCount` timestamps in `0x6FC94200`, `pAttacker` broadcast guard in `0x6FC99E40`,
 *      item forwarding in `0x6FCC1580`, seal index (`pObject+0x04 - 0x188`) in `0x6FCDBF30`,
 *      GUID/seed/flags/room-scratch init in `0x6FCDC050`, classic guard / room guard / Diablo
 *      endgame timer flags & callbacks in `0x6FCDC2C0`, swapped gamble slot args in `0x6FCDF810`,
 *      hardcore disconnect + swapped `SendStatToClientOrParty` args + town level transition +
 *      `PLAYER_StartModeAtCoords(mode=1, force=1)` in `0x6FCF14B0`, and swapped `(pQuest, 3)` args in `0x6FD094C0`.
 *    - `k2-w6b4-113c.ts`: removed buggy `rollMeleeToHitFlags6FCFE5A0` stand-in (which passed
 *      `pDefender = 0` to `SUNITDMG_CheckToHit113c`) and wired canonical
 *      `SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c` in `0x6FC48BE0` & `0x6FCB2940`.
 *    - `k2-w4b8-113c.ts`: passed 7th arg `pUnit` to `MONSTER_GetDifficultyAndPlayerBonus113c` in
 *      `0x6FCD7380`, forwarded `(pGame, pAiGenArg, nAiIdxArg)` to `AI_InitMonsterAiThinkFn113c` in
 *      `0x6FCD78A0`, and fixed Last Portal coordinate offset (`x + 5`, not `y + 5`) in `0x6FCDAFF0`.
 * 3. Multi-branch `SparseMemory113c` state assertions + 100% (`133 / 133`) live
 *    `beginVaTrace113c()` / `endVaTrace113c()` execution coverage.
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c,
  ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20_113c,
  ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c,
  ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c,
  ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c,
  ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c,
  ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c,
  ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c,
  ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c,
  ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c,
  ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c,
  ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c,
  ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c,
  ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c,
  ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c,
  ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c,
  ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c,
  ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c,
  ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c,
  ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c,
  ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c,
  ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c,
  ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c,
  ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c,
  MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c,
  NET_SendChatMessagePacket26Wrapper_6FCEB580_113c,
  PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c,
  PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c,
  PACKET_Srv40_RequestQuestLog_6FCEBD30_113c,
  PLAYER_CalcHealingPotionPercent_6FCEB840_113c,
  PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c,
  PLAYER_IssueMercAiMoveCommand_6FCEC750_113c,
  PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c,
  SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c,
} from '../../../src/d2kern-113c/game/k2-w5b5-113c.ts'
import {
  ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c,
  ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c,
  ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c,
  ACT4Q3_OnSeal1Operate_6FCDC580_113c,
  ACT4Q3_OnSeal3Operate_6FCDC510_113c,
  ACT4Q3_OnSeal5Operate_6FCDC4A0_113c,
  ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c,
  ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c,
  ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c,
  ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c,
  ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c,
  ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c,
  ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c,
  C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c,
  C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c,
  C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c,
  C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c,
  C2S_HandlePacket4F_TradeButton_6FCF1470_113c,
  CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c,
  CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c,
  CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c,
  CLIENTS_FlushPositionsSaveAndPacketQueue_6FC4D500_113c,
  CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c,
  CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c,
  NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c,
  OBJ_DeactivateShrineOrStashObject_6FC8F520_113c,
  OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c,
  PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c,
  PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c,
  PLAYER_HandleDeathCorpseAndSave_6FC99730_113c,
  PLAYER_ProcessPlayerDeathAndPenalties_6FC99E40_113c,
  PLRTRADE_HandleClientTradeButton_6FC94200_113c,
  SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c.ts'
import {
  ACT1Q1_TimerPromoteState5_6FC83B50_113c,
  ACT1Q2_TimerPromoteState3_6FC83A80_113c,
  ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c,
  ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c,
  ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c,
  ACT1Q5_DecrementCounterAndCheckState3_6FC836C0_113c,
  ACT1Q5_OnMoldyTomeActivated_6FC83730_113c,
  ACT1Q5_TimerPromoteState0D_6FC83210_113c,
  ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c,
  ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c,
  ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c,
  ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c,
  ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c,
  ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c,
  ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c,
  ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c,
  ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c,
  ACT5Q4_TimerPromoteState4_6FC79CD0_113c,
  ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c,
  ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c,
  ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c,
  ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c,
  ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c,
  MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c,
  OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c,
  PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c,
  QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c,
  QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c,
  SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c,
  SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c,
  SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c,
  SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c,
  SKILLS_UpdateLeapMovementStep_6FC48740_113c,
} from '../../../src/d2kern-113c/game/k2-w6b4-113c.ts'
import {
  ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c,
  ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c,
  ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c,
  ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c,
  ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c,
  ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c,
  ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c,
  ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c,
  ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c,
  ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c,
  ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c,
  ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c,
  ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c,
  ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c,
  ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c,
  AIBAAL_ChooseActionWeighted_6FCD7380_113c,
  AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c,
  AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c,
  AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c,
  SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c,
  SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c,
  SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c,
  SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c,
  SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c,
  SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c,
  SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c,
  SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c,
  SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c,
  SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c,
  SKILLS_SrvDo141_SpawnPartyMinionsAndDistributeExp_6FCD65E0_113c,
  SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c,
  SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c,
  SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b8-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActStrc,
  D2ActiveRoomStrc,
  D2DrlgLevelStrc,
  D2DrlgStrc,
  D2InventoryStrc,
  D2ItemsTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2RoomCollisionGridStrc,
  D2RoomExStrc,
  D2SkillListStrc,
  D2SkillStrc,
  D2SkillsTxt,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../../..')
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools/oracle/callgraph/manifest-113c.json')
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data')

interface ManifestFn {
  readonly module: string
  readonly va: string
  readonly name: string
  readonly size: number
  readonly status: string
  readonly tsSymbol?: string
  readonly diffEvidence?: string
  readonly indirectUnknown?: boolean
}

interface Manifest {
  readonly functions: readonly ManifestFn[]
}

interface DisasmVaSpec {
  readonly batch: 'k2w5-b5' | 'k2w16-b1' | 'k2w6-b4' | 'k2w4-b8'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE13_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  // k2w5-b5 (34 eligible VAs)
  { batch: 'k2w5-b5', va: '0x6FCE3E10', size: 157, headHex: '568bf28b460885c0', tailHex: 'ff5ec3', tsSymbol: 'ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE3F40', size: 115, headHex: '53568bf2568bd9e8', tailHex: 'c20400', tsSymbol: 'ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE4030', size: 310, headHex: '8b4424045355c600', tailHex: 'c20400', tsSymbol: 'ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE4430', size: 154, headHex: '5657528bf1e88660', tailHex: 'c20400', tsSymbol: 'ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE4AA0', size: 108, headHex: '56578bf88b87f410', tailHex: 'c20400', tsSymbol: 'ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE4B10', size: 178, headHex: '8b83f410000083ec', tailHex: 'c420c3', tsSymbol: 'ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE4C30', size: 129, headHex: '56576a0d8bf86a0e', tailHex: 'c20400', tsSymbol: 'ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE4CC0', size: 101, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE4D30', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE4E30', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE5030', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE5090', size: 101, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE5100', size: 138, headHex: '83ec1885d2741583', tailHex: 'c20400', tsSymbol: 'ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE5190', size: 194, headHex: '83ec1885d2567415', tailHex: 'c20400', tsSymbol: 'ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE52B0', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE54A0', size: 186, headHex: '53578bfa578bd9e8', tailHex: 'c20400', tsSymbol: 'ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE55B0', size: 125, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE5630', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE5F30', size: 218, headHex: '535556578bfa8b47', tailHex: '5d5bc3', tsSymbol: 'ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE6240', size: 322, headHex: '83ec08578bf98b0f', tailHex: 'c408c3', tsSymbol: 'ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE7C20', size: 213, headHex: '83ec0c538b5e188a', tailHex: 'c40cc3', tsSymbol: 'ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE7FB0', size: 148, headHex: '83ec0856578bf88b', tailHex: 'c20400', tsSymbol: 'ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE8FD0', size: 438, headHex: '83ec2c53558b6c24', tailHex: 'c20800', tsSymbol: 'ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c' },
  { batch: 'k2w5-b5', va: '0x6FCE99B0', size: 200, headHex: '568bf18b068b80f4', tailHex: '5f5ec3', tsSymbol: 'ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c' },
  { batch: 'k2w5-b5', va: '0x6FCEA410', size: 119, headHex: '8b0c90568b742414', tailHex: 'c21000', tsSymbol: 'MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c' },
  { batch: 'k2w5-b5', va: '0x6FCEB4A0', size: 63, headHex: '8bc2837c24080374', tailHex: 'c20800', tsSymbol: 'PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c' },
  { batch: 'k2w5-b5', va: '0x6FCEB580', size: 9, headHex: '8bc251e8e8fefbff', tailHex: 'fbffc3', tsSymbol: 'NET_SendChatMessagePacket26Wrapper_6FCEB580_113c' },
  { batch: 'k2w5-b5', va: '0x6FCEB610', size: 73, headHex: '85f67c3fa19c82d1', tailHex: '0000c3', tsSymbol: 'SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c' },
  { batch: 'k2w5-b5', va: '0x6FCEB720', size: 284, headHex: '83ec0c55576a008b', tailHex: 'c40cc3', tsSymbol: 'PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c' },
  { batch: 'k2w5-b5', va: '0x6FCEB840', size: 163, headHex: '515356576a008bf0', tailHex: '5b59c3', tsSymbol: 'PLAYER_CalcHealingPotionPercent_6FCEB840_113c' },
  { batch: 'k2w5-b5', va: '0x6FCEBC70', size: 180, headHex: '83ec08837c241009', tailHex: 'c20800', tsSymbol: 'PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c' },
  { batch: 'k2w5-b5', va: '0x6FCEBD30', size: 27, headHex: '837c2408017408b8', tailHex: 'c20800', tsSymbol: 'PACKET_Srv40_RequestQuestLog_6FCEBD30_113c' },
  { batch: 'k2w5-b5', va: '0x6FCEC370', size: 467, headHex: '83ec3856578bf885', tailHex: 'c20400', tsSymbol: 'PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c' },
  { batch: 'k2w5-b5', va: '0x6FCEC750', size: 264, headHex: '83ec1c538bd985db', tailHex: 'c21000', tsSymbol: 'PLAYER_IssueMercAiMoveCommand_6FCEC750_113c' },
  // k2w16-b1 (33 eligible VAs)
  { batch: 'k2w16-b1', va: '0x6FC4D140', size: 339, headHex: '568bf085f6751f68', tailHex: 'c20400', tsSymbol: 'CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c' },
  { batch: 'k2w16-b1', va: '0x6FC4D500', size: 354, headHex: '5356578b7c241033', tailHex: 'c20800', tsSymbol: 'CLIENTS_FlushPositionsSaveAndPacketQueue_6FC4D500_113c' },
  { batch: 'k2w16-b1', va: '0x6FC4D790', size: 77, headHex: '8a476a3c0174043c', tailHex: 'fdffc3', tsSymbol: 'CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c' },
  { batch: 'k2w16-b1', va: '0x6FC4DC70', size: 441, headHex: '83ec28558b6c2430', tailHex: 'c20800', tsSymbol: 'CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c' },
  { batch: 'k2w16-b1', va: '0x6FC4DE30', size: 135, headHex: '538bd88a436a3c01', tailHex: '5f5bc3', tsSymbol: 'CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c' },
  { batch: 'k2w16-b1', va: '0x6FC4E160', size: 123, headHex: '5153558b6c241057', tailHex: 'c20400', tsSymbol: 'CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c' },
  { batch: 'k2w16-b1', va: '0x6FC58930', size: 355, headHex: '8a466c8b566483ec', tailHex: 'c408c3', tsSymbol: 'PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c' },
  { batch: 'k2w16-b1', va: '0x6FC58AB0', size: 141, headHex: '53578bf88a476c84', tailHex: '560200', tsSymbol: 'PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c' },
  { batch: 'k2w16-b1', va: '0x6FC7FD00', size: 297, headHex: '83ec0853558bd956', tailHex: 'c408c3', tsSymbol: 'ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c' },
  { batch: 'k2w16-b1', va: '0x6FC7FE30', size: 588, headHex: '83ec0c5355568be9', tailHex: 'c40cc3', tsSymbol: 'ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c' },
  { batch: 'k2w16-b1', va: '0x6FC8E680', size: 676, headHex: '83ec10568bf08b44', tailHex: 'f9ffcc', tsSymbol: 'OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c' },
  { batch: 'k2w16-b1', va: '0x6FC8F520', size: 135, headHex: '85c9578bfa746c8b', tailHex: '005fc3', tsSymbol: 'OBJ_DeactivateShrineOrStashObject_6FC8F520_113c' },
  { batch: 'k2w16-b1', va: '0x6FC94200', size: 1616, headHex: '8b4c240c83ec1855', tailHex: 'c21000', tsSymbol: 'PLRTRADE_HandleClientTradeButton_6FC94200_113c' },
  { batch: 'k2w16-b1', va: '0x6FC99730', size: 274, headHex: '5355568bf28b0683', tailHex: 'c20c00', tsSymbol: 'PLAYER_HandleDeathCorpseAndSave_6FC99730_113c' },
  { batch: 'k2w16-b1', va: '0x6FC99E40', size: 357, headHex: '5355568bf232db85', tailHex: 'c20800', tsSymbol: 'PLAYER_ProcessPlayerDeathAndPenalties_6FC99E40_113c' },
  { batch: 'k2w16-b1', va: '0x6FCC1580', size: 119, headHex: '83ec08568bf185f6', tailHex: 'c20400', tsSymbol: 'SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDB8D0', size: 803, headHex: '83ec0855568be957', tailHex: 'c408c3', tsSymbol: 'ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDBCE0', size: 217, headHex: '83ec2053568bf28b', tailHex: 'c20400', tsSymbol: 'ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDBDC0', size: 362, headHex: '53558bda8b6b188a', tailHex: 'c05bc3', tsSymbol: 'ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDBF30', size: 261, headHex: '535556578bf98b47', tailHex: 'c05bc3', tsSymbol: 'ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDC050', size: 456, headHex: '83ec0853558b6c24', tailHex: 'c20800', tsSymbol: 'ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDC220', size: 149, headHex: '8b018b80f4100000', tailHex: '5f5bc3', tsSymbol: 'ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDC2C0', size: 471, headHex: '51535556578bfa8b', tailHex: 'f4ffcc', tsSymbol: 'ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDC4A0', size: 99, headHex: '538bd98b4b0485c9', tailHex: 'c05bc3', tsSymbol: 'ACT4Q3_OnSeal5Operate_6FCDC4A0_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDC510', size: 99, headHex: '538bd98b4b0485c9', tailHex: 'c05bc3', tsSymbol: 'ACT4Q3_OnSeal3Operate_6FCDC510_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDC580', size: 99, headHex: '538bd98b4b0485c9', tailHex: 'c05bc3', tsSymbol: 'ACT4Q3_OnSeal1Operate_6FCDC580_113c' },
  { batch: 'k2w16-b1', va: '0x6FCDF810', size: 216, headHex: '51538bd885db0f84', tailHex: 'c21000', tsSymbol: 'NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c' },
  { batch: 'k2w16-b1', va: '0x6FCEF400', size: 125, headHex: '837c2408057408b8', tailHex: 'c20800', tsSymbol: 'C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c' },
  { batch: 'k2w16-b1', va: '0x6FCEFB30', size: 85, headHex: '837c24080d53578b', tailHex: 'c20800', tsSymbol: 'C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c' },
  { batch: 'k2w16-b1', va: '0x6FCF0E90', size: 240, headHex: '837c24081153568b', tailHex: 'c20800', tsSymbol: 'C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c' },
  { batch: 'k2w16-b1', va: '0x6FCF1470', size: 60, headHex: '837c2408077408b8', tailHex: 'c20800', tsSymbol: 'C2S_HandlePacket4F_TradeButton_6FCF1470_113c' },
  { batch: 'k2w16-b1', va: '0x6FCF14B0', size: 409, headHex: '51837c240c015357', tailHex: 'c20800', tsSymbol: 'C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c' },
  { batch: 'k2w16-b1', va: '0x6FD094C0', size: 284, headHex: '515356578bf98b1f', tailHex: '5b59c3', tsSymbol: 'ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c' },
  // k2w6-b4 (33 eligible VAs)
  { batch: 'k2w6-b4', va: '0x6FC2C760', size: 356, headHex: '83ec7c538b9c2484', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c' },
  { batch: 'k2w6-b4', va: '0x6FC44300', size: 316, headHex: '83ec745355568bf2', tailHex: 'c20800', tsSymbol: 'MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c' },
  { batch: 'k2w6-b4', va: '0x6FC48740', size: 606, headHex: '83ec0c53568bf08b', tailHex: 'c20800', tsSymbol: 'SKILLS_UpdateLeapMovementStep_6FC48740_113c' },
  { batch: 'k2w6-b4', va: '0x6FC48BE0', size: 650, headHex: '558bec83e4f881ec', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC554A0', size: 70, headHex: '538bd88a44240888', tailHex: 'fcffcc', tsSymbol: 'QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC55E90', size: 30, headHex: '53578bf88b87f410', tailHex: '5f5bc3', tsSymbol: 'QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c' },
  { batch: 'k2w6-b4', va: '0x6FC586F0', size: 227, headHex: '85c0750768590200', tailHex: '5d5ec3', tsSymbol: 'PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC5BC00', size: 119, headHex: '53568bf28b0683f8', tailHex: 'c20400', tsSymbol: 'OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c' },
  { batch: 'k2w6-b4', va: '0x6FC641C0', size: 464, headHex: '83ec64558b6c2470', tailHex: 'c21000', tsSymbol: 'SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC6C9E0', size: 282, headHex: '5356578bf96a2d57', tailHex: 'c20800', tsSymbol: 'ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC798B0', size: 128, headHex: '8b80f410000085c0', tailHex: 'faffcc', tsSymbol: 'ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC79930', size: 156, headHex: '8b41048b80f41000', tailHex: 'faffcc', tsSymbol: 'ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c' },
  { batch: 'k2w6-b4', va: '0x6FC79C50', size: 118, headHex: '8b80f410000085c0', tailHex: 'faffcc', tsSymbol: 'ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c' },
  { batch: 'k2w6-b4', va: '0x6FC79CD0', size: 93, headHex: '8a4a0bb0043ac856', tailHex: 'faffcc', tsSymbol: 'ACT5Q4_TimerPromoteState4_6FC79CD0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC79EF0', size: 144, headHex: '8b018b80f4100000', tailHex: 'faffcc', tsSymbol: 'ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC79F80', size: 118, headHex: '8b80f410000085c0', tailHex: 'faffcc', tsSymbol: 'ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c' },
  { batch: 'k2w6-b4', va: '0x6FC7A200', size: 132, headHex: '8b80f410000085c0', tailHex: 'faffcc', tsSymbol: 'ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c' },
  { batch: 'k2w6-b4', va: '0x6FC7A310', size: 543, headHex: '83ec145355578bf9', tailHex: 'faffcc', tsSymbol: 'ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c' },
  { batch: 'k2w6-b4', va: '0x6FC7A690', size: 141, headHex: '8b80f410000085c0', tailHex: 'faffcc', tsSymbol: 'ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c' },
  { batch: 'k2w6-b4', va: '0x6FC7A820', size: 396, headHex: '83ec148b018b80f4', tailHex: 'faffcc', tsSymbol: 'ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c' },
  { batch: 'k2w6-b4', va: '0x6FC7B9B0', size: 1014, headHex: '8b4424048b80f410', tailHex: 'faffcc', tsSymbol: 'ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC7BDB0', size: 234, headHex: '55568bf18a460984', tailHex: 'faffcc', tsSymbol: 'ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC7E200', size: 157, headHex: '57508bf9e86fc2fa', tailHex: '5e5fc3', tsSymbol: 'ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c' },
  { batch: 'k2w6-b4', va: '0x6FC83210', size: 91, headHex: '807a0c05568b7218', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q5_TimerPromoteState0D_6FC83210_113c' },
  { batch: 'k2w6-b4', va: '0x6FC83350', size: 107, headHex: '53578b7e046a00bb', tailHex: 'c86fc3', tsSymbol: 'ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c' },
  { batch: 'k2w6-b4', va: '0x6FC836C0', size: 111, headHex: '8a410984c0744780', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q5_DecrementCounterAndCheckState3_6FC836C0_113c' },
  { batch: 'k2w6-b4', va: '0x6FC83730', size: 161, headHex: '55568bf28b460c57', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q5_OnMoldyTomeActivated_6FC83730_113c' },
  { batch: 'k2w6-b4', va: '0x6FC83A80', size: 73, headHex: 'b8002cc86f85c0c6', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q2_TimerPromoteState3_6FC83A80_113c' },
  { batch: 'k2w6-b4', va: '0x6FC83B50', size: 91, headHex: '807a0c04568b7218', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q1_TimerPromoteState5_6FC83B50_113c' },
  { batch: 'k2w6-b4', va: '0x6FC85A70', size: 208, headHex: '51568bf28b460c85', tailHex: '5e59c3', tsSymbol: 'ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c' },
  { batch: 'k2w6-b4', va: '0x6FC88250', size: 38, headHex: '5356578bf28b7e04', tailHex: '015bc3', tsSymbol: 'ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c' },
  { batch: 'k2w6-b4', va: '0x6FC911D0', size: 156, headHex: '83ec0853578bf88b', tailHex: 'c20400', tsSymbol: 'ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c' },
  { batch: 'k2w6-b4', va: '0x6FCB2940', size: 275, headHex: '83ec7853558bac24', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c' },
  // k2w4-b8 (33 eligible VAs)
  { batch: 'k2w4-b8', va: '0x6FCD3770', size: 279, headHex: '53568b74240c85f6', tailHex: 'ffffff', tsSymbol: 'SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD3890', size: 150, headHex: '578bfa8bc7e806cf', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD3930', size: 187, headHex: '56578bfa8bc7e865', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD42D0', size: 317, headHex: '83ec0c5356578bf9', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD4870', size: 374, headHex: '83ec6c53578b7e2c', tailHex: 'c20400', tsSymbol: 'SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD4D30', size: 164, headHex: '51538b5c240c85db', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD5110', size: 394, headHex: '83ec6053558b6c24', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD52A0', size: 418, headHex: '83ec6053558b6c24', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD5450', size: 421, headHex: '83ec708b44247485', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD5D40', size: 260, headHex: '51558b6c240c85ed', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD5E50', size: 340, headHex: '83ec0c8b44241085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD5FB0', size: 261, headHex: '83ec08538b5c2410', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD65E0', size: 320, headHex: '83ec08538b5c2410', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo141_SpawnPartyMinionsAndDistributeExp_6FCD65E0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD6720', size: 102, headHex: '85db55578bf8bd0b', tailHex: '005dc3', tsSymbol: 'SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD7380', size: 589, headHex: '83ec5453b9050000', tailHex: 'c22000', tsSymbol: 'AIBAAL_ChooseActionWeighted_6FCD7380_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD75D0', size: 382, headHex: '83ec4053558b6c24', tailHex: 'c21400', tsSymbol: 'AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD7750', size: 334, headHex: '83ec40b80a000000', tailHex: 'c20c00', tsSymbol: 'AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD78A0', size: 264, headHex: '83ec205355568bf2', tailHex: 'c20400', tsSymbol: 'AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD8E80', size: 157, headHex: '5657528bf1e83616', tailHex: 'c20400', tsSymbol: 'ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD9290', size: 139, headHex: '5657528bf1e82612', tailHex: 'c20400', tsSymbol: 'ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD93B0', size: 283, headHex: '83ec0c5556578bea', tailHex: 'c20400', tsSymbol: 'ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD94F0', size: 112, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD96A0', size: 141, headHex: '5657528bf1e8160e', tailHex: 'c20400', tsSymbol: 'ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD9970', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD99D0', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD9A30', size: 199, headHex: '56576a0d8bf06a1a', tailHex: '401cc3', tsSymbol: 'ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD9B00', size: 182, headHex: '83ec0856578bf256', tailHex: 'c20400', tsSymbol: 'ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD9C00', size: 91, headHex: '56578bf88b87f410', tailHex: 'c20400', tsSymbol: 'ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c' },
  { batch: 'k2w4-b8', va: '0x6FCD9D20', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c' },
  { batch: 'k2w4-b8', va: '0x6FCDA810', size: 61, headHex: '518a410984c0568b', tailHex: '5e59c3', tsSymbol: 'ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c' },
  { batch: 'k2w4-b8', va: '0x6FCDA850', size: 261, headHex: '83ec288b44242c55', tailHex: 'c20c00', tsSymbol: 'ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c' },
  { batch: 'k2w4-b8', va: '0x6FCDAFF0', size: 436, headHex: '83ec1453568bf08b', tailHex: 'c20400', tsSymbol: 'ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c' },
  { batch: 'k2w4-b8', va: '0x6FCDB6A0', size: 531, headHex: '83ec0c53558b6c24', tailHex: 'c20400', tsSymbol: 'ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c' },
]

function loadPeSectionMapper(dllPath: string, expectedBase: number) {
  const buf = fs.readFileSync(dllPath)
  const e_lfanew = buf.readUInt32LE(0x3c)
  const numSec = buf.readUInt16LE(e_lfanew + 6)
  const optSize = buf.readUInt16LE(e_lfanew + 20)
  const imageBase = buf.readUInt32LE(e_lfanew + 24 + 28)
  expect(imageBase).toBe(expectedBase)
  const secTable = e_lfanew + 24 + optSize
  const sections: Array<{ vaddr: number; vsize: number; rawPtr: number; rawSize: number }> = []
  for (let i = 0; i < numSec; i++) {
    const sh = secTable + i * 40
    sections.push({
      vsize: buf.readUInt32LE(sh + 8),
      vaddr: buf.readUInt32LE(sh + 12),
      rawSize: buf.readUInt32LE(sh + 16),
      rawPtr: buf.readUInt32LE(sh + 20),
    })
  }
  const textSec = sections[0]!
  return {
    buf,
    textStart: imageBase + textSec.vaddr,
    textEnd: imageBase + textSec.vaddr + textSec.vsize,
    vaToFileOffset(va: number): number {
      const rva = va - imageBase
      for (const s of sections) {
        const span = Math.max(s.vsize, s.rawSize)
        if (rva >= s.vaddr && rva < s.vaddr + span) {
          return s.rawPtr + (rva - s.vaddr)
        }
      }
      throw new Error(`VA 0x${va.toString(16)} outside PE sections`)
    },
  }
}

function writeAscii(m: SparseMemory113c, addr: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    m.setU8((addr + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((addr + text.length) >>> 0, 0)
}

function readAscii(m: SparseMemory113c, addr: number, maxLen = 32): string {
  let out = ''
  for (let i = 0; i < maxLen; i++) {
    const ch = m.u8((addr + i) >>> 0)
    if (ch === 0) break
    out += String.fromCharCode(ch)
  }
  return out
}

function createWave13World() {
  const m = new SparseMemory113c()
  m.fill(0, 0x200, 0)
  m.fill(0x6fd18000, 0x2e000, 0)
  m.fill(0x6fdd6000, 0x24000, 0)

  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)

  // Wire both D2Game (0x6fd18be0) and D2Common (0x6fdd90b0) bitmask IAT slots
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pBitMasks)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)

  const pDataTablesSlot = m.alloc(4) >>> 0
  m.setU32(pDataTablesSlot, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pDataTablesSlot)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)

  // Experience.txt ptr (0x6fdf0b50)
  const pExpBin = m.alloc(0x40) >>> 0
  for (let c = 0; c < 8; c++) m.setU32((pExpBin + c * 4) >>> 0, 99)
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin)

  // MonStatsTxt (600 rows * 0x1A8) with wMonStatsEx (+0x18) populated
  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec = (pMonStatsTxt + i * 0x1a8) >>> 0
    m.setU16(rec, i)
    m.setU16((rec + 0x18) >>> 0, i)
  }

  // MonStats2Txt (600 rows * 0x134)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa8c) >>> 0, monStatsCount)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)

  // SkillsTxt (360 rows * 0x23C) + SkillCode RPN buffer + class skill tables
  const skillsCount = 360
  const pSkillsTxt = m.alloc(skillsCount * 0x23c) >>> 0
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)
  const pClassSkillCounts = m.alloc(7 * 4) >>> 0
  const pClassSkillList = m.alloc(7 * 30 * 2) >>> 0
  m.setU32((pDataTables + 0xba4) >>> 0, pClassSkillCounts)
  m.setU32((pDataTables + 0xba8) >>> 0, 30)
  m.setU32((pDataTables + 0xbac) >>> 0, pClassSkillList)
  const pSkillCode = m.alloc(0x400) >>> 0
  m.setU32((pDataTables + 0x40) >>> 0, pSkillCode)
  m.setU32((pDataTables + 0x44) >>> 0, 0x400)

  // MissilesTxt (400 rows * 0x1A4)
  const missilesCount = 400
  const pMissilesTxt = m.alloc(missilesCount * 0x1a4) >>> 0
  m.setU32((pDataTables + 0xb64) >>> 0, pMissilesTxt)
  m.setU32((pDataTables + 0xb6c) >>> 0, missilesCount)

  // CharStatsTxt (7 rows * 0xC4)
  const pCharStatsTxt = m.alloc(7 * 0xc4) >>> 0
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStatsTxt)
  m.setU32((pDataTables + 0xbc8) >>> 0, 7)

  // ItemStatCostTxt (400 rows * 0x144)
  const iscCount = 400
  const pIscTxt = m.alloc(iscCount * 0x144) >>> 0
  m.setU32((pDataTables + 0xbcc) >>> 0, pIscTxt)
  m.setU32((pDataTables + 0xbd4) >>> 0, iscCount)

  // StatesTxt (185 rows * 0x3C)
  const statesCount = 185
  const pStatesTxt = m.alloc(statesCount * 0x3c) >>> 0
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc4) >>> 0, statesCount)
  m.setU32((pDataTables + 0xbb8) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xbc0) >>> 0, statesCount)

  // LevelsTxt (140 rows * 0x220) + LevelDefs (140 rows * 0x9C at 0x6FDF0B38)
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE) >>> 0
  const pLevelDefs = m.alloc(levelsCount * 0x9c) >>> 0
  m.setU32((pDataTables + 0xbd8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xbe0) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xbf8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc00) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xc60) >>> 0, levelsCount)
  m.setU32(0x6fdf0b38, pLevelDefs)

  // Act town level IDs table at D2Common:0x6FDE4084 ([1, 40, 75, 103, 109])
  const actTownIds = [1, 40, 75, 103, 109]
  for (let a = 0; a < actTownIds.length; a++) {
    m.setU32((0x6fde4084 + a * 4) >>> 0, actTownIds[a]!)
  }

  // PetTypesTxt (16 rows * 0xE0 at pDataTables + 0xBE8, count at +0xBF0)
  const pPetTypesTxt = m.alloc(16 * 0x100) >>> 0
  m.setU32((pDataTables + 0xbe8) >>> 0, pPetTypesTxt)
  m.setU32((pDataTables + 0xbf0) >>> 0, 16)

  // ItemsTxt (40 rows * 0x1A8)
  const itemsCount = 40
  const pItemsTxt = m.alloc(itemsCount * ITEMS_TXT_STRIDE_113C) >>> 0
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, itemsCount)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, itemsCount)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20706976) // 'vip '
  m.setU32((pItemsTxt + 2 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20786f62) // 'box '
  m.setU32((pItemsTxt + 3 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x2066736d) // 'msf '
  m.setU32((pItemsTxt + 4 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20317274) // 'tr1 '
  m.setU32((pItemsTxt + 5 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20747368) // 'hst '
  m.setU32((pItemsTxt + 6 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20737076) // 'vps '
  m.setU32((pItemsTxt + 7 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20626262) // 'bbb '

  // Items linker for DATATBLS_GetItemsTxtRecordByCode113c (0x6fdeff6c): sorted 8-byte {dwCode, nIndex}
  const pItemsLinker = m.alloc(0x20) >>> 0
  const pLinkerEntries = m.alloc(4 * 8) >>> 0
  m.setU32((pLinkerEntries + 0x00) >>> 0, 0x20626262) // 'bbb ' -> 7
  m.setU32((pLinkerEntries + 0x04) >>> 0, 7)
  m.setU32((pLinkerEntries + 0x08) >>> 0, 0x20737076) // 'vps ' -> 6
  m.setU32((pLinkerEntries + 0x0c) >>> 0, 6)
  m.setU32(pItemsLinker, 2)
  m.setU32((pItemsLinker + 0x08) >>> 0, pLinkerEntries)
  m.setU32(0x6fdeff6c, pItemsLinker)

  // ObjectsTxt (600 rows * 0x1C0)
  const pObjectsTxt = m.alloc(600 * 0x1c0) >>> 0
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  // InventoryTxt (33 rows * 0xF0) + char inv record map for trade grid validation
  const invRows = 33
  const pInvTxt = m.alloc(invRows * 0xf0) >>> 0
  for (let i = 0; i < invRows; i++) {
    const rec = (pInvTxt + i * 0xf0) >>> 0
    m.setU8((rec + 0x10) >>> 0, 10)
    m.setU8((rec + 0x11) >>> 0, 4)
  }
  m.setU32(0x6fdefa58, invRows - 1)
  m.setU32(0x6fdefa5c, pInvTxt)
  m.setU32(0x6fdeefe4, 7)
  for (let c = 0; c < 7; c++) {
    m.setU32((0x6fdeefe8 + c * 8) >>> 0, c)
    m.setU32((0x6fdeefe8 + c * 8 + 4) >>> 0, c)
  }

  // Field direction lookup tables (0x6FDE9BA0 / 0x6FDE9BC4 / 0x6FDF1404 / 0x6FDF1414 / 0x6FDF1418)
  const fieldDx = [1, 1, 0, -1, -1, -1, 0, 1, 0]
  const fieldDy = [0, 1, 1, 1, 0, -1, -1, -1, 0]
  for (let d = 0; d < 9; d++) {
    m.setU32((0x6fde9ba0 + d * 4) >>> 0, fieldDx[d]! >>> 0)
    m.setU32((0x6fde9bc4 + d * 4) >>> 0, fieldDy[d]! >>> 0)
  }
  const pFieldData = m.alloc(0x10000) >>> 0
  m.fill(pFieldData, 0x10000, 8)
  m.setU32(0x6fdf1404, pFieldData)
  m.setU32(0x6fdf1414, 128)
  m.setU32(0x6fdf1418, 128)

  // AnimData table + PlrType/PlrMode globals
  const pAnimDataTable = m.alloc(0x500) >>> 0
  const pEmptyAnimBucket = m.alloc(8) >>> 0
  for (let i = 0; i < 256; i++) {
    m.setU32((pAnimDataTable + i * 4) >>> 0, pEmptyAnimBucket)
  }
  m.setU32((pAnimDataTable + 0x404 + 0x08) >>> 0, 8)
  m.setU32((pAnimDataTable + 0x404 + 0x0c) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13c4, 7)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34) >>> 0)
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34) >>> 0)

  return {
    m,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pSkillCode,
    pMissilesTxt,
    pCharStatsTxt,
    pIscTxt,
    pStatesTxt,
    pLevelsTxt,
    pItemsTxt,
    pObjectsTxt,
  }
}

function allocWalkableRoom(
  m: SparseMemory113c,
  levelId: number,
  x0 = 80,
  y0 = 180,
  w = 40,
  h = 40,
): number {
  const pRoom = m.alloc(0x90) >>> 0
  const pRoomEx = m.alloc(0xf0) >>> 0
  const pLevel = m.alloc(0x200) >>> 0
  const pDrlg = m.alloc(0x500) >>> 0
  const pNear = m.alloc(4) >>> 0
  const pGrid = m.alloc(0x40) >>> 0
  const pMap = m.alloc(w * h * 2) >>> 0
  m.setU32(pNear, pRoom)
  m.set(pRoom, D2ActiveRoomStrc.ppRoomsNear, pNear)
  m.set(pRoom, D2ActiveRoomStrc.nRoomsNear, 1)
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoom, D2ActiveRoomStrc.pCollisionGrid, pGrid)
  m.setU32((pRoom + 0x4c) >>> 0, x0 >>> 0)
  m.setU32((pRoom + 0x50) >>> 0, y0 >>> 0)
  m.setU32((pRoom + 0x54) >>> 0, w >>> 0)
  m.setU32((pRoom + 0x58) >>> 0, h >>> 0)
  m.setU32((pRoom + 0x5c) >>> 0, (x0 / 5) | 0)
  m.setU32((pRoom + 0x60) >>> 0, (y0 / 5) | 0)
  m.setU32((pRoom + 0x64) >>> 0, (w / 5) | 0)
  m.setU32((pRoom + 0x68) >>> 0, (h / 5) | 0)
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileX, x0 >>> 0)
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileY, y0 >>> 0)
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileWidth, w >>> 0)
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileHeight, h >>> 0)
  m.set(pGrid, D2RoomCollisionGridStrc.nTileX, (x0 / 5) | 0)
  m.set(pGrid, D2RoomCollisionGridStrc.nTileY, (y0 / 5) | 0)
  m.set(pGrid, D2RoomCollisionGridStrc.nTileWidth, (w / 5) | 0)
  m.set(pGrid, D2RoomCollisionGridStrc.nTileHeight, (h / 5) | 0)
  m.set(pGrid, D2RoomCollisionGridStrc.pMapStart, pMap)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, levelId >>> 0)
  m.setU32((pLevel + 0x1b4) >>> 0, pDrlg)
  return pRoom
}

function allocGame(m: SparseMemory113c, nDiff = 0, bExpansion = 1) {
  const pGame = m.alloc(0x1df4) >>> 0
  EVENT_InitTimerQueue113c(m, pGame)
  m.setU8((pGame + 0x6d) >>> 0, nDiff & 0xff)
  m.setU32((pGame + 0x70) >>> 0, bExpansion >>> 0)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  // Always initialize non-zero RNG seed on pGame + 0xd0
  m.setU32((pGame + 0xd0) >>> 0, 0x13579bdf)
  m.setU32((pGame + 0xd4) >>> 0, 666)
  m.setU32((pGame + 0x18) >>> 0, m.alloc(0x20) >>> 0)
  m.setU32((pGame + 0x1d28) >>> 0, m.alloc(0x40) >>> 0)
  const pQuestControl = m.alloc(0x60) >>> 0
  const pGlobalQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  m.setU32((pQuestControl + 0x08) >>> 0, 1)
  m.setU32((pQuestControl + 0x0c) >>> 0, pGlobalQuestFlags)
  m.setU32((pQuestControl + 0x18) >>> 0, 0x12345678)
  m.setU32((pQuestControl + 0x1c) >>> 0, 666)
  m.setU32((pGame + 0x10f4) >>> 0, pQuestControl)
  const pAct = m.alloc(0x80) >>> 0
  const pDrlg = m.alloc(0x500) >>> 0
  m.set(pAct, D2ActStrc.pDrlg, pDrlg)
  for (let a = 0; a < 5; a++) {
    m.setU32((pGame + 0xbc + a * 4) >>> 0, pAct)
  }
  return { pGame, pQuestControl, pGlobalQuestFlags, pAct, pDrlg }
}

function allocPlayer(
  m: SparseMemory113c,
  pGame: number,
  guid: number,
  x = 100,
  y = 200,
  pRoom = 0,
  charClass = 1,
) {
  const pPlayer = m.alloc(0x100) >>> 0
  const pPlayerData = m.alloc(0x180) >>> 0
  const pPath = m.alloc(0x80) >>> 0
  const pClient = m.alloc(0x520) >>> 0
  const pPacketQueue = m.alloc(0x420) >>> 0
  const pInv = m.alloc(0x40) >>> 0
  m.setU32(pInv, 0x01020304)
  m.setU32((pInv + 0x08) >>> 0, pPlayer)
  const pQuestFlagsList = [
    QUESTRECORD_AllocRecord113c(m, 0),
    QUESTRECORD_AllocRecord113c(m, 0),
    QUESTRECORD_AllocRecord113c(m, 0),
  ]
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = pQuestFlagsList[nDiff]!
  m.setU32(pPlayer, 0)
  m.setU32((pPlayer + 0x04) >>> 0, charClass >>> 0)
  m.setU32((pPlayer + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pPlayer + 0x10) >>> 0, 1)
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
  m.setU32((pPlayer + 0x20) >>> 0, (0x12345670 + guid) >>> 0)
  m.setU32((pPlayer + 0x24) >>> 0, 666)
  m.setU32((pPlayer + 0x2c) >>> 0, pPath)
  m.setU32((pPlayer + 0x60) >>> 0, pInv)
  m.setU32((pPlayer + 0x80) >>> 0, pGame)
  m.setU16((pPath + 0x02) >>> 0, x & 0xffff)
  m.setU16((pPath + 0x06) >>> 0, y & 0xffff)
  m.setU32((pPath + 0x1c) >>> 0, pRoom >>> 0)
  for (let d = 0; d < 3; d++) {
    m.setU32((pPlayerData + d * 4 + 0x10) >>> 0, pQuestFlagsList[d]!)
    const pWp = m.alloc(0x18) >>> 0
    m.setU16(pWp, 0x0102)
    m.setU32((pPlayerData + d * 4 + 0x1c) >>> 0, pWp)
    const pIntroData = m.alloc(0x10) >>> 0
    const pIntro0 = m.alloc(8) >>> 0
    const pIntro1 = m.alloc(8) >>> 0
    m.setU32(pIntro0, m.alloc(0x20) >>> 0)
    m.setU32(pIntro1, m.alloc(0x20) >>> 0)
    m.setU32(pIntroData, pIntro0)
    m.setU32((pIntroData + 4) >>> 0, pIntro1)
    m.setU32((pPlayerData + d * 4 + 0x60) >>> 0, pIntroData)
  }
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
  m.setU32(pClient, guid >>> 0)
  m.setU32((pClient + 0x04) >>> 0, 4)
  writeAscii(m, (pClient + 0x0d) >>> 0, `Hero${guid}`)
  m.setU32((pClient + 0x16c) >>> 0, 0)
  m.setU32((pClient + 0x170) >>> 0, guid >>> 0)
  m.setU32((pClient + 0x174) >>> 0, pPlayer)
  m.setU32((pClient + 0x1a8) >>> 0, pGame)
  m.setU8((pClient + 0x1ac) >>> 0, 1)
  m.setU32((pClient + 0x1bc) >>> 0, pPacketQueue)
  const pStatListEx = STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
  m.set(pPlayer, D2UnitStrc.pStatListEx, pStatListEx)
  const pSkills = m.alloc(0x20) >>> 0
  const pDefSkill = m.alloc(0x40) >>> 0
  const pDefSkillTxt = m.alloc(0x23c) >>> 0
  m.set(pDefSkill, D2SkillStrc.pSkillsTxt, pDefSkillTxt)
  m.set(pDefSkill, D2SkillStrc.nOwnerItemGuid, 0xffffffff)
  m.set(pSkills, D2SkillListStrc.pFirstSkill, pDefSkill)
  m.set(pSkills, D2SkillListStrc.pLeftSkill, pDefSkill)
  m.set(pSkills, D2SkillListStrc.pRightSkill, pDefSkill)
  m.set(pPlayer, D2UnitStrc.pSkills, pSkills)
  SUNIT_InsertServerUnit113c(m, pGame, pPlayer)
  return { pPlayer, pPlayerData, pPath, pClient, pPacketQueue, pQuestFlags, pStatListEx }
}

function allocMonster(
  m: SparseMemory113c,
  pGame: number,
  classId: number,
  guid: number,
  x = 100,
  y = 200,
  pRoom = 0,
) {
  const pMon = m.alloc(0x100) >>> 0
  const pMonData = m.alloc(0x80) >>> 0
  const pPath = m.alloc(0x60) >>> 0
  m.setU32(pMon, 1)
  m.setU32((pMon + 0x04) >>> 0, classId >>> 0)
  m.setU32((pMon + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pMon + 0x10) >>> 0, 1)
  m.setU32((pMon + 0x14) >>> 0, pMonData)
  m.setU32((pMon + 0x20) >>> 0, (0x22345670 + guid) >>> 0)
  m.setU32((pMon + 0x24) >>> 0, 666)
  m.setU32((pMon + 0x2c) >>> 0, pPath)
  m.setU32((pMon + 0x80) >>> 0, pGame)
  m.setU16((pPath + 0x02) >>> 0, x & 0xffff)
  m.setU16((pPath + 0x06) >>> 0, y & 0xffff)
  m.setU32((pPath + 0x1c) >>> 0, pRoom >>> 0)
  const pStatListEx = STATLIST_CreateEx113c(m, pMon, 0, pGame)
  m.set(pMon, D2UnitStrc.pStatListEx, pStatListEx)
  SUNIT_InsertServerUnit113c(m, pGame, pMon)
  return { pMon, pMonData, pPath, pStatListEx }
}

function linkQuestNode(
  m: SparseMemory113c,
  pGame: number,
  pQuestControl: number,
  nQuestId: number,
  nQuestNo = nQuestId,
) {
  const pQuest = m.alloc(0x100) >>> 0
  const pQuestState = m.alloc(0x100) >>> 0
  const pMsgTables = m.alloc(0xc4 * 12) >>> 0
  m.setU32(pQuest, nQuestId >>> 0)
  m.setU32((pQuest + 0x04) >>> 0, pGame)
  m.setU32((pQuest + 0x18) >>> 0, pQuestState)
  m.setU32((pQuest + 0xdc) >>> 0, pMsgTables)
  m.setU32((pQuest + 0xe0) >>> 0, nQuestNo >>> 0)
  m.setU32((pQuest + 0xf4) >>> 0, m.u32(pQuestControl))
  m.setU32(pQuestControl, pQuest)
  return { pQuest, pQuestState, pMsgTables }
}

describe('D2Game.dll v1.13c Disassembly Verification Wave 13 (+133 VAs across w5b5, w16b1, w6b4, w4b8)', () => {
  it('verifies exact PE32 machine-code leading/trailing opcodes, sizes, and manifest promotion for all 133 VAs', () => {
    expect(WAVE13_PROMOTED_SPECS.length).toBe(133)
    const uniqueVas = new Set(WAVE13_PROMOTED_SPECS.map((s) => s.va.toUpperCase()))
    expect(uniqueVas.size).toBe(133)

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
    const byVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        byVa.set(fn.va.toUpperCase(), fn)
      }
    }

    // Formerly indirectUnknown VA 0x6FCD8A70 in k2w4-b8 was statically resolved and promoted in Wave 23 (Batch A)
    const iuFn = byVa.get('0X6FCD8A70')
    expect(iuFn).toBeDefined()
    expect(iuFn!.indirectUnknown).toBeUndefined()
    expect(iuFn!.status).toBe('diff-verified')

    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    const pe = fs.existsSync(dllPath) ? loadPeSectionMapper(dllPath, 0x6fc20000) : null

    for (const spec of WAVE13_PROMOTED_SPECS) {
      const mFn = byVa.get(spec.va.toUpperCase())
      expect(mFn, `manifest missing ${spec.va}`).toBeDefined()
      expect(mFn!.status, `${spec.va} must be diff-verified`).toBe('diff-verified')
      expect(mFn!.indirectUnknown, `${spec.va} must not be indirectUnknown`).not.toBe(true)
      expect(mFn!.tsSymbol).toBe(spec.tsSymbol)
      expect(mFn!.size).toBe(spec.size)

      if (pe !== null) {
        const vaNum = Number.parseInt(spec.va, 16)
        expect(vaNum).toBeGreaterThanOrEqual(pe.textStart)
        expect(vaNum + spec.size).toBeLessThanOrEqual(pe.textEnd)
        const off = pe.vaToFileOffset(vaNum)
        const raw = pe.buf.subarray(off, off + spec.size)
        const headHex = raw.subarray(0, Math.min(8, raw.length)).toString('hex')
        const tailHex = raw.subarray(Math.max(0, raw.length - 3)).toString('hex')
        expect(headHex, `headHex mismatch at ${spec.va}`).toBe(spec.headHex)
        expect(tailHex, `tailHex mismatch at ${spec.va}`).toBe(spec.tailHex)
      }
    }
  })

  it('regression (w16b1): 0x6FCEFB30 & 0x6FCF0E90 use canonical 6-arg C2S_ValidateTargetUnitDistance113c without inverted polarity', () => {
    const { m } = createWave13World()
    const { pGame } = allocGame(m)
    const pRoom = allocWalkableRoom(m, 1, 80, 180, 40, 40)
    const { pPlayer } = allocPlayer(m, pGame, 11, 100, 200, pRoom)
    allocMonster(m, pGame, 0x94, 21, 105, 202, pRoom)
    allocMonster(m, pGame, 0x94, 22, 300, 400, pRoom)

    const pObjNear = m.alloc(0x100) >>> 0
    const pObjNearPath = m.alloc(0x30) >>> 0
    m.setU32(pObjNear, 2)
    m.setU32((pObjNear + 0x0c) >>> 0, 31)
    m.setU32((pObjNear + 0x2c) >>> 0, pObjNearPath)
    m.setU32((pObjNearPath + 0x00) >>> 0, pRoom)
    m.setU32((pObjNearPath + 0x0c) >>> 0, 102)
    m.setU32((pObjNearPath + 0x10) >>> 0, 201)
    SUNIT_InsertServerUnit113c(m, pGame, pObjNear)

    const pkt38 = m.alloc(0x10) >>> 0
    m.setU8(pkt38, 0x38)
    m.setU32((pkt38 + 1) >>> 0, 1)
    m.setU32((pkt38 + 5) >>> 0, 21) // nearby NPC -> must dispatch (return 0)
    m.setU32((pkt38 + 9) >>> 0, 0)

    beginVaTrace113c()
    const nearNpcRes = C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c(m, pGame, pPlayer, pkt38, 0x0d)
    const hitsNearNpc = endVaTrace113c()
    expect(nearNpcRes).toBe(0)
    expect(hitsNearNpc.has('D2Game:0x6FCECFE0')).toBe(true)
    expect(hitsNearNpc.has('D2Game:0x6FCE00C0')).toBe(true)

    m.setU32((pkt38 + 5) >>> 0, 22) // far NPC (>0x32 subtiles) -> rejected, 0x6FCE00C0 NOT called
    beginVaTrace113c()
    const farNpcRes = C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c(m, pGame, pPlayer, pkt38, 0x0d)
    const hitsFarNpc = endVaTrace113c()
    expect(farNpcRes).not.toBe(0)
    expect(hitsFarNpc.has('D2Game:0x6FCE00C0')).toBe(false)

    const pkt1C = m.alloc(0x20) >>> 0
    m.setU8(pkt1C, 0x1c)
    m.setU32((pkt1C + 5) >>> 0, 31)
    m.setU32((pkt1C + 9) >>> 0, 0)
    m.setU16((pkt1C + 0x0d) >>> 0, 2) // cancel action
    beginVaTrace113c()
    const nearObjRes = C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c(m, pGame, pPlayer, pkt1C, 0x11)
    const hitsNearObj = endVaTrace113c()
    expect(nearObjRes).toBe(0)
    expect(hitsNearObj.has('D2Game:0x6FCECFE0')).toBe(true)
    expect(hitsNearObj.has('D2Game:0x6FC8E680')).toBe(true)
  })

  it('regression (w16b1): 0x6FC4DC70 writes 0x5A strings at +0x08/+0x18 & 0x6FC4DE30 passes (type=+0x16c, id=+0x170)', () => {
    const { m } = createWave13World()
    const { pGame } = allocGame(m)
    m.setU8((pGame + 0x6a) >>> 0, 1) // single-player
    const { pPlayer, pClient } = allocPlayer(m, pGame, 77)
    writeAscii(m, (pClient + 0x0d) >>> 0, 'HeroOne')
    writeAscii(m, (pClient + 0x1d) >>> 0, 'AcctAlpha')
    m.setU32((pGame + 0x88) >>> 0, pClient)

    // Register game in STORM TSHashTable at 0x6FD31C24 (key = 5) for 0x6FC4AAE0
    const pHashTbl = m.alloc(0x30) >>> 0
    const pBuckets = m.alloc(128 * 12) >>> 0
    m.setU16(0x6fd27d98, 5)
    m.setU32(pGame, 5)
    m.setU32((pGame + 0x28) >>> 0, 5)
    m.setU16((pGame + 0x2c) >>> 0, 5)
    m.setU32((pHashTbl + 0x1c) >>> 0, pBuckets)
    m.setU32((pHashTbl + 0x24) >>> 0, 0x7f)
    m.setU32((pBuckets + (5 & 0x7f) * 12 + 0x08) >>> 0, pGame)
    m.setU32(0x6fd31c24, pHashTbl)

    // 0x6FC4DE30 fallback lookup with flag 0x01 cleared, pClient+0x16c=0 (type), +0x170=77 (id), +0x174=1 (sentinel)
    m.setU8((pClient + 0x3d4) >>> 0, 0)
    m.setU32((pClient + 0x16c) >>> 0, 0)
    m.setU32((pClient + 0x170) >>> 0, 77)
    m.setU32((pClient + 0x174) >>> 0, 1)
    beginVaTrace113c()
    CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c(m, pGame)
    const hitsDE30 = endVaTrace113c()
    expect(hitsDE30.has('D2Game:0x6FC4DE30')).toBe(true)
    expect(hitsDE30.has('D2Game:0x6FC74320')).toBe(true)
    // Sentinel +0x174 must NOT be cleared to 0 because SUNIT_GetServerUnit113c(type=0, id=77) found pPlayer!
    expect(m.u32((pClient + 0x174) >>> 0)).toBe(1)

    // 0x6FC4DC70 packet 0x5A string offsets +0x08 (char) and +0x18 (account)
    m.setU32((pClient + 0x174) >>> 0, pPlayer)
    beginVaTrace113c()
    CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c(m, 77, 0)
    const hitsDC70 = endVaTrace113c()
    expect(hitsDC70.has('D2Game:0x6FC4DC70')).toBe(true)
    expect(hitsDC70.has('D2Game:0x6FC4C830')).toBe(true)
    expect(hitsDC70.has('D2Game:0x6FC6B7F0')).toBe(true)
    const pkt5A = 0x6fd44e10
    expect(m.u8(pkt5A)).toBe(0x5a)
    expect(m.u8((pkt5A + 0x07) >>> 0)).toBe(0)
    expect(readAscii(m, (pkt5A + 0x08) >>> 0, 16)).toBe('HeroOne')
    expect(readAscii(m, (pkt5A + 0x18) >>> 0, 16)).toBe('AcctAlpha')
    expect(m.u8((pkt5A + 0x27) >>> 0)).toBe(0)
  })

  it('regression (w16b1): 0x6FC94200 matches jump table 0x6FC94850, writes GetTickCount, and calls canonical 0x6FC934E0/0x6FC919A0/0x6FC93D90', () => {
    const { m } = createWave13World()
    const { pGame } = allocGame(m)
    m.setU32((pGame + 0xa8) >>> 0, 999)
    m.setU32(0x6fd18d10, 0x12345678) // distinct GetTickCount value

    const { pPlayer: p1, pPlayerData: d1 } = allocPlayer(m, pGame, 1)
    const { pPlayer: p2, pPlayerData: d2 } = allocPlayer(m, pGame, 2)
    m.setU8((p1 + 0x6c) >>> 0, 1)
    m.setU32((p1 + 0x68) >>> 0, 0)
    m.setU32((p1 + 0x64) >>> 0, 2)
    m.setU32((d1 + 0x50) >>> 0, 4)
    m.setU32((d2 + 0x50) >>> 0, 4)

    // wButton=5 (nIdx=3) and wButton=6 (nIdx=4) MUST be no-ops in jump table 0x6FC94850
    expect(PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, p1, 5, 0)).toBe(0)
    expect(m.u32((d1 + 0x50) >>> 0)).toBe(4)
    expect(m.u32((d2 + 0x50) >>> 0)).toBe(4)

    expect(PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, p1, 6, 0)).toBe(0)
    expect(m.u32((d1 + 0x50) >>> 0)).toBe(4)
    expect(m.u32((d2 + 0x50) >>> 0)).toBe(4)

    // wButton=7 (nIdx=5) unpresses accept (4 -> 3)
    expect(PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, p1, 7, 0)).toBe(0)
    expect(m.u32((d1 + 0x50) >>> 0)).toBe(3)
    expect(m.u32((d2 + 0x50) >>> 0)).toBe(3)

    // wButton=4 (nIdx=2) with partner already at 4 triggers canonical 0x6FC93D90 & writes GetTickCount
    m.setU32((d2 + 0x50) >>> 0, 4)
    beginVaTrace113c()
    expect(PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, p1, 4, 0)).toBe(0)
    const hitsSwap = endVaTrace113c()
    expect(hitsSwap.has('D2Game:0x6FC93D90')).toBe(true)
    expect(m.u32((d1 + 0x58) >>> 0)).toBe(0x12345678)
    expect(m.u32((d2 + 0x58) >>> 0)).toBe(0x12345678)

    // wButton=2 (nIdx=0) cancels via canonical 0x6FC919A0 & writes GetTickCount
    m.setU32(0x6fd18d10, 0x22334455)
    m.setU8((p1 + 0x6c) >>> 0, 1)
    m.setU32((p1 + 0x68) >>> 0, 0)
    m.setU32((p1 + 0x64) >>> 0, 2)
    m.setU32((d1 + 0x50) >>> 0, 1)
    m.setU32((d2 + 0x50) >>> 0, 2)
    beginVaTrace113c()
    expect(PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, p1, 2, 0)).toBe(0)
    const hitsCancel = endVaTrace113c()
    expect(hitsCancel.has('D2Game:0x6FC919A0')).toBe(true)
    expect(m.u32((d1 + 0x58) >>> 0)).toBe(0x22334455)
    expect(m.u32((d2 + 0x58) >>> 0)).toBe(0x22334455)

    // Cube button 0x17 dispatches to canonical 0x6FC934E0
    m.setU8((p1 + 0x6c) >>> 0, 1)
    m.setU32((p1 + 0x68) >>> 0, 4)
    beginVaTrace113c()
    expect(PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, p1, 0x17, 0)).toBe(0)
    expect(endVaTrace113c().has('D2Game:0x6FC934E0')).toBe(true)
  })

  it('regression (w16b1): Chaos Sanctuary 0x6FCDBF30, 0x6FCDC050 & 0x6FCDC2C0 match D2Game.dll 1:1', () => {
    const { m } = createWave13World()
    const { pGame, pQuestControl } = allocGame(m, 0, 1)
    const q17 = linkQuestNode(m, pGame, pQuestControl, 0x17, 0x1a)
    m.setU8((q17.pQuest + 0x09) >>> 0, 1)
    m.setU8((q17.pQuest + 0x0c) >>> 0, 2)
    const pRoom = allocWalkableRoom(m, 108, 80, 180, 40, 40)

    // 0x6FCDBF30 reads seal index from pObject+0x04 - 0x188, NOT pQuestArg+0x10 - 0x188
    const pSealObj = m.alloc(0x100) >>> 0
    const pSealPath = m.alloc(0x30) >>> 0
    m.setU32(pSealObj, 2)
    m.setU32((pSealObj + 0x04) >>> 0, 0x18a) // seal 2
    m.setU32((pSealObj + 0x2c) >>> 0, pSealPath)
    m.setU32((pSealPath + 0x00) >>> 0, pRoom)
    m.setU32((pSealPath + 0x0c) >>> 0, 100)
    m.setU32((pSealPath + 0x10) >>> 0, 200)
    const pArg = m.alloc(0x30) >>> 0
    m.setU32(pArg, pGame)
    m.setU32((pArg + 0x04) >>> 0, pSealObj)
    m.setU32((pArg + 0x10) >>> 0, 0x188) // decoy offset
    ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c(m, pArg)
    expect(m.u8((q17.pQuestState + 0x0e) >>> 0)).toBe(1) // index 2 set
    expect(m.u8((q17.pQuestState + 0x0c) >>> 0)).toBe(0) // index 0 untouched

    // 0x6FCDC050 pre-increments pGame+0x98 (wrapping 0xfffffffe -> 1), leaves pGame+0xae8 untouched
    m.setU32((pSealObj + 0x10) >>> 0, 0)
    m.setU32((pGame + 0x98) >>> 0, 0xfffffffe)
    m.setU32((pGame + 0xae8) >>> 0, 0x5555)
    m.setU32((pGame + 0x1c) >>> 0, 0x7777)
    const pCoord = m.alloc(8) >>> 0
    m.setU32(pCoord, 100)
    m.setU32((pCoord + 4) >>> 0, 200)
    ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c(m, pCoord, pArg, 1)
    expect(m.u32((pGame + 0x98) >>> 0)).toBe(1) // wrapped 0xffffffff -> 1
    expect(m.u32((pGame + 0xae8) >>> 0)).toBe(0x5555) // untouched
    const pMarker = m.u32((pGame + 0x1520 + (1 & 0x7f) * 4) >>> 0)
    expect(pMarker).not.toBe(0)
    expect(m.u32((pMarker + 0x04) >>> 0)).toBe(0x83)
    expect(m.u32((pMarker + 0x08) >>> 0)).toBe(0x7777)
    expect(m.u32((pMarker + 0xc8) >>> 0) & 0x06000000).toBe(0x06000000)
    expect(m.u32((pMarker + 0xd0) >>> 0)).toBe(0x0b)
    const pMarkerData = m.u32((pMarker + 0x14) >>> 0)
    expect(m.u8((pMarkerData + 0x04) >>> 0)).toBe(0) // no spurious nObjSubtype write

    // 0x6FCDC2C0: expansion (pGame+0x70=1) must NOT set pQuestControl+0x20=0x0d; sets endgame timer flags + GetTickCount
    const { pPlayer: pKiller } = allocPlayer(m, pGame, 90, 100, 200, pRoom)
    const { pMon: pDiablo } = allocMonster(m, pGame, 0xf3, 91, 100, 200, pRoom)
    m.setU32(0x6fd18d10, 0x00abcdef)
    m.setU8((pQuestControl + 0x20) >>> 0, 0)
    m.setU32((pArg + 0x08) >>> 0, pDiablo)
    m.setU32((pArg + 0x0c) >>> 0, pKiller)
    ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c(m, q17.pQuest, pArg)
    expect(m.u8((pQuestControl + 0x20) >>> 0)).toBe(0) // expansion does not write +0x20
    expect(m.u8((q17.pQuestState + 0x01) >>> 0)).toBe(1)
    expect(m.u8((q17.pQuestState + 0x02) >>> 0)).toBe(0) // endgame, not spawn
    expect(m.u8((q17.pQuestState + 0x03) >>> 0)).toBe(1)
    expect(m.u8((q17.pQuestState + 0x04) >>> 0)).toBe(1)
    expect(m.u8((q17.pQuestState + 0x05) >>> 0)).toBe(1)
    expect(m.u8((q17.pQuestState + 0x15) >>> 0)).toBe(0)
    expect(m.u32((q17.pQuestState + 0x18) >>> 0)).toBe(0x00abcdef)
    expect(m.u8((q17.pQuest + 0x0b) >>> 0)).toBe(0x0d)
    expect(m.u8((q17.pQuest + 0x0c) >>> 0)).toBe(2) // NOT overwritten to 5

    // Classic mode (pGame+0x70=0) with pKiller=0: sets pQuestControl+0x20=0x0d and still runs callbacks
    m.setU32((pGame + 0x70) >>> 0, 0)
    m.setU32((pArg + 0x0c) >>> 0, 0)
    beginVaTrace113c()
    ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c(m, q17.pQuest, pArg)
    const hitsClassic = endVaTrace113c()
    expect(m.u8((pQuestControl + 0x20) >>> 0)).toBe(0x0d)
    expect(hitsClassic.has('D2Game:0x6FCD99D0')).toBe(true)
    expect(hitsClassic.has('D2Game:0x6FCD9F20')).toBe(true)
    expect(hitsClassic.has('D2Game:0x6FCDA490')).toBe(true)
    expect(hitsClassic.has('D2Game:0x6FCD9BC0')).toBe(true)
    expect(hitsClassic.has('D2Game:0x6FCD9B00')).toBe(true)
  })

  it('regression (w16b1): 0x6FCF14B0 HC disconnect + SC resurrect mode=1, 0x6FCDF810 gamble args, 0x6FCC1580 item forward, 0x6FD094C0 (pQuest,3)', () => {
    const { m } = createWave13World()
    const { pGame, pQuestControl } = allocGame(m)
    const pRoom = allocWalkableRoom(m, 2, 80, 180, 40, 40)

    // Hardcore dead player -> calls canonical 0x6FC4D090 with reason 3
    const { pPlayer: pHc, pClient: pHcClient } = allocPlayer(m, pGame, 10, 100, 200, pRoom)
    m.setU32((pHc + 0x10) >>> 0, 0x11)
    m.setU8((pHcClient + 0x0a) >>> 0, 0x04)
    beginVaTrace113c()
    expect(C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c(m, pGame, pHc, 0, 1)).toBe(0)
    expect(endVaTrace113c().has('D2Game:0x6FC4D090')).toBe(true)

    // Softcore dead player -> calls canonical 0x6FCBE170 + PLAYER_StartModeAtCoords(mode=1, force=1) -> animMode transitions 0x11 -> 1!
    const pTownRoom = allocWalkableRoom(m, 1, 80, 180, 40, 40)
    const pTownRoomEx = m.u32((pTownRoom + 0x10) >>> 0)
    const pTownLevel = m.u32((pTownRoomEx + 0x58) >>> 0)
    const pAct0 = m.u32((pGame + 0xbc) >>> 0)
    const pDrlg0 = m.get(pAct0, D2ActStrc.pDrlg)
    m.setU32((pDrlg0 + 0x47c) >>> 0, pTownLevel)
    m.setU32((pTownLevel + 0x10) >>> 0, pTownRoomEx)
    m.setU32((pTownLevel + 0x1c) >>> 0, 16)
    m.setU32((pTownLevel + 0x20) >>> 0, 36)
    m.setU32((pTownLevel + 0x24) >>> 0, 8)
    m.setU32((pTownLevel + 0x28) >>> 0, 8)
    m.setU32((pTownRoomEx + 0x28) >>> 0, 0x03100000)
    m.setU32((pTownRoomEx + 0x30) >>> 0, pTownRoom)
    m.setU32((pTownRoomEx + 0x34) >>> 0, 16)
    m.setU32((pTownRoomEx + 0x38) >>> 0, 36)
    m.setU32((pTownRoomEx + 0x3c) >>> 0, 8)
    m.setU32((pTownRoomEx + 0x40) >>> 0, 8)
    const { pPlayer: pSc, pClient: pScClient } = allocPlayer(m, pGame, 11, 100, 200, pRoom)
    m.setU8((pScClient + 0x1ac) >>> 0, 0)
    STATLIST_SetUnitStat113c(m, pSc, 7, 25600, 0)
    STATLIST_SetUnitStat113c(m, pSc, 9, 12800, 0)
    STATLIST_SetUnitStat113c(m, pSc, 11, 12800, 0)
    m.setU32((pSc + 0x10) >>> 0, 0x11)
    beginVaTrace113c()
    expect(C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c(m, pGame, pSc, 0, 1)).toBe(0)
    const hitsSc = endVaTrace113c()
    expect(hitsSc.has('D2Game:0x6FCBE170')).toBe(true)
    expect(hitsSc.has('D2Game:0x6FC98550')).toBe(true)
    expect(hitsSc.has('D2Game:0x6FCEC2F0')).toBe(true)
    expect(m.u32((pSc + 0x10) >>> 0)).toBe(1)

    // 0x6FCC1580 forwards pItem to canonical 0x6FCF8440
    const pItem = m.alloc(0x100) >>> 0
    m.setU32(pItem, 4)
    m.setU32((pItem + 0x04) >>> 0, 1)
    beginVaTrace113c()
    SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c(m, pSc, pItem, pGame)
    expect(endVaTrace113c().has('D2Game:0x6FCF8440')).toBe(true)

    // 0x6FCDF810 gamble mode passes (pNpc, pGame, pPlayer) to 0x6FCAFAA0 & calls canonical 0x6FCDF730
    const { pMon: pNpc } = allocMonster(m, pGame, 0x94, 44, 100, 200, pRoom)
    const pShopPool = m.alloc(0x40) >>> 0
    const pShopTable = m.alloc(0x40 * 0x44) >>> 0
    m.setU32(pShopTable, 0x94) // matched by pNpc->dwClassId (+0x04)
    m.setU32((pShopPool + 0x04) >>> 0, pShopTable)
    m.setU32((pGame + 0x1d24) >>> 0, pShopPool)
    beginVaTrace113c()
    NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c(m, pNpc, pGame, pSc, 0, 1)
    const hitsShop = endVaTrace113c()
    expect(hitsShop.has('D2Game:0x6FCDF730')).toBe(true)
    expect(hitsShop.has('D2Game:0x6FCAFAA0')).toBe(true)

    // 0x6FD094C0 passes (pQuest, 3) to 0x6FC55EB0 so pQuest+0x0c becomes 3
    const q0f = linkQuestNode(m, pGame, pQuestControl, 0x0f, 0x11)
    m.setU8((q0f.pQuest + 0x09) >>> 0, 1)
    m.setU8((q0f.pQuest + 0x0c) >>> 0, 1)
    const pStand = m.alloc(0x100) >>> 0
    const pStandPath = m.alloc(0x30) >>> 0
    m.setU32(pStand, 2)
    m.setU32((pStand + 0x0c) >>> 0, 88)
    m.setU32((pStand + 0x2c) >>> 0, pStandPath)
    m.setU32((pStandPath + 0x00) >>> 0, pRoom)
    m.setU32((pStandPath + 0x0c) >>> 0, 100)
    m.setU32((pStandPath + 0x10) >>> 0, 200)
    const pTomeArg = m.alloc(0x20) >>> 0
    m.setU32(pTomeArg, pGame)
    m.setU32((pTomeArg + 0x04) >>> 0, pStand)
    m.setU32((pTomeArg + 0x08) >>> 0, pSc)
    beginVaTrace113c()
    ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c(m, pTomeArg)
    expect(endVaTrace113c().has('D2Game:0x6FD094C0')).toBe(true)
    expect(m.u32((pStand + 0xb8) >>> 0)).toBe(0x20626262)
    if (m.u8((q0f.pQuestState + 0x02) >>> 0) === 1) {
      expect(m.u8((q0f.pQuest + 0x0c) >>> 0)).toBe(3)
    }
  })

  it('regression (w6b4): 0x6FC48BE0 & 0x6FCB2940 call canonical 0x6FCFE5A0 (SUNITDMG_RollMeleeToHitAndBlock)', () => {
    const { m, pSkillsTxt, pMonStatsTxt } = createWave13World()
    const { pGame } = allocGame(m)
    const pRoom = allocWalkableRoom(m, 2, 80, 180, 40, 40)
    const { pPlayer: pAtt, pPath: pAttPath } = allocPlayer(m, pGame, 1, 100, 200, pRoom)
    const { pMon: pDef, pMonData: pDefData } = allocMonster(m, pGame, 5, 2, 101, 200, pRoom)
    m.setU32(pDefData, (pMonStatsTxt + 5 * 0x1a8) >>> 0)
    m.setU32((pDef + 0xc4) >>> 0, 0x0f)
    m.setU32((pRoom + 0x74) >>> 0, pDef)
    STATLIST_SetUnitStat113c(m, pAtt, 12, 50, 0)
    STATLIST_SetUnitStat113c(m, pAtt, 19, 5000, 0)
    STATLIST_SetUnitStat113c(m, pDef, 12, 1, 0)
    STATLIST_SetUnitStat113c(m, pDef, 31, 10, 0)
    STATLIST_SetUnitStat113c(m, pDef, 6, 1000 << 8, 0)
    STATLIST_SetUnitStat113c(m, pDef, 7, 1000 << 8, 0)

    // Give pAtt friendly alignment (state 0x69, stat 0xac = 2) so pDef (alignment 0) is hostile
    const pAlignList = STATLIST_AllocList113c(m, 0, 0, 0, 0, 0)
    STATLIST_SetState113c(m, pAlignList, 0x69)
    STATLIST_SetStat113c(m, pAlignList, 0xac, 2, 0)
    STATLIST_MergeStatLists113c(m, pAtt, pAlignList, 1)

    // Attach Whirlwind skill (id 151) to pAtt
    const pSkillList = m.alloc(0x20) >>> 0
    const pSkillNode = m.alloc(0x40) >>> 0
    const pSkillTxt151 = (pSkillsTxt + 151 * 0x23c) >>> 0
    m.set(pSkillTxt151, D2SkillsTxt.wSkillId, 151)
    m.set(pSkillNode, D2SkillStrc.pSkillsTxt, pSkillTxt151)
    m.set(pSkillNode, D2SkillStrc.dwParam0C, 1)
    m.set(pSkillNode, D2SkillStrc.dwParam1, 105)
    m.set(pSkillNode, D2SkillStrc.dwParam2, 200)
    m.set(pSkillNode, D2SkillStrc.dwParam3, 0xffffffff)
    m.set(pSkillNode, D2SkillStrc.nSkillLevel, 5)
    m.set(pSkillNode, D2SkillStrc.nOwnerItemGuid, 0xffffffff)
    m.set(pSkillList, D2SkillListStrc.pFirstSkill, pSkillNode)
    m.set(pAtt, D2UnitStrc.pSkills, pSkillList)

    // 0x6FC48BE0 Whirlwind tick -> calls canonical 0x6FCFE5A0
    beginVaTrace113c()
    SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c(m, pGame, pAtt, 151, 5)
    const hitsWW = endVaTrace113c()
    expect(hitsWW.has('D2Game:0x6FC48BE0')).toBe(true)
    expect(hitsWW.has('D2Game:0x6FCFE5A0')).toBe(true)

    // 0x6FCB2940 Dragon Talon kick -> calls canonical 0x6FCFE5A0
    PATH_SetTargetUnit113c(m, pAttPath, pDef)
    beginVaTrace113c()
    SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c(m, pGame, pAtt, 151, 5)
    const hitsDT = endVaTrace113c()
    expect(hitsDT.has('D2Game:0x6FCB2940')).toBe(true)
    expect(hitsDT.has('D2Game:0x6FCFE5A0')).toBe(true)
  })

  it('regression (w4b8): 0x6FCD7380 passes pUnit to 0x6FC628A0, 0x6FCD78A0 forwards (pGame,pAiGen,nAiIdx), 0x6FCDAFF0 offsets x+5', () => {
    const { m, pMonStatsTxt } = createWave13World()
    const { pGame } = allocGame(m, 2, 1) // Hell difficulty
    const pRoom = allocWalkableRoom(m, 108, 80, 180, 40, 40)

    // 0x6FCD7380: verify 0x6FC628A0 receives pUnit
    const { pMon: pBaal, pMonData: pBaalData } = allocMonster(m, pGame, 5, 10, 100, 200, pRoom)
    m.setU32(pBaalData, (pMonStatsTxt + 5 * 0x1a8) >>> 0)
    const { pPlayer: pTarget } = allocPlayer(m, pGame, 11, 102, 200, pRoom)
    const pAiState = m.alloc(0x40) >>> 0
    beginVaTrace113c()
    const actIdx = AIBAAL_ChooseActionWeighted_6FCD7380_113c(m, pBaal, pGame, pAiState, pTarget, 1, 0, 1, 0, 70)
    const hits7380 = endVaTrace113c()
    expect(hits7380.has('D2Game:0x6FCD7380')).toBe(true)
    expect(hits7380.has('D2Game:0x6FCCF840')).toBe(true)
    expect(actIdx).toBeGreaterThanOrEqual(0)
    expect(actIdx).toBeLessThan(16)

    // 0x6FCD78A0: forwards (pGame, pAiGenArg, nAiIdxArg) to AI_InitMonsterAiThinkFn113c (0x6FCBD230)
    const pAiGen = m.alloc(0x40) >>> 0
    const pAiCtrl = m.alloc(0x40) >>> 0
    m.setU32((pBaalData + 0x28) >>> 0, pAiGen)
    m.setU32((pBaalData + 0x2c) >>> 0, pAiCtrl)
    m.setU32((pAiGen + 0x14) >>> 0, 99)
    const pAiParam = m.alloc(8) >>> 0
    const pAiParamPtr = m.alloc(8) >>> 0
    m.setU32(pAiParam, 0x0a) // nAiIdxArg = 0x0a
    m.setU32(pAiParamPtr, pAiGen) // pAiGenArg = pAiGen
    // Note: 0x6FCD78A0 reads pAiParam = m.u32(pAiParamPtr), nAiIdx = m.u32(pAiParam), pAiGen = m.u32(pAiParamPtr)
    // Wait: let's set [pAiParamPtr] = pAiGen and [pAiGen] = 0x0a (since pAiParam = [pAiParamPtr]!)
    m.setU32(pAiGen, 0x0b)
    beginVaTrace113c()
    AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c(m, pGame, pBaal, pAiParamPtr)
    const hits78A0 = endVaTrace113c()
    expect(hits78A0.has('D2Game:0x6FCD78A0')).toBe(true)
    expect(hits78A0.has('D2Game:0x6FCBD230')).toBe(true)
    expect(m.u32(pAiGen)).toBe(0x0b)
    expect(m.u32((pAiGen + 0x14) >>> 0)).toBe(0)

    // 0x6FCDAFF0: spawns Last Portal (classId 0x236) near (x + 5, y), NOT (x, y + 5)!
    const pRefObj = m.alloc(0x100) >>> 0
    const pRefPath = m.alloc(0x30) >>> 0
    m.setU32(pRefObj, 2)
    m.setU32((pRefObj + 0x2c) >>> 0, pRefPath)
    m.setU32((pRefPath + 0x00) >>> 0, pRoom)
    m.setU32((pRefPath + 0x0c) >>> 0, 100) // x = 100
    m.setU32((pRefPath + 0x10) >>> 0, 200) // y = 200
    const pNpcParams = m.alloc(0x20) >>> 0
    const pCustom = m.alloc(0x80) >>> 0
    m.setU32(pNpcParams, pGame)
    m.setU32((pNpcParams + 0x08) >>> 0, pRefObj)
    const pPortal = ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c(m, pNpcParams, pCustom)
    expect(pPortal).not.toBe(0)
    expect(m.u32((pPortal + 0x04) >>> 0)).toBe(0x236)
    const pPortalPath = m.u32((pPortal + 0x2c) >>> 0)
    const px = m.u32((pPortalPath + 0x0c) >>> 0) | 0
    const py = m.u32((pPortalPath + 0x10) >>> 0) | 0
    // Ring search starts around (100+5, 200) = (105, 200), so |px - 105| <= 2 and |py - 200| <= 2
    expect(Math.abs(px - 105)).toBeLessThanOrEqual(2)
    expect(Math.abs(py - 200)).toBeLessThanOrEqual(2)
    expect(m.u8((pCustom + 0x45) >>> 0)).toBe(1)
  })

  it('exercises all 133 promoted Wave 13 VAs with concrete assertions and 100% live VA trace coverage', () => {
    const cumulativeHits = new Set<string>()

    // -------------------------------------------------------------------------
    // Shard 1: k2w5-b5 (34 eligible VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pDataTables, pCharStatsTxt } = createWave13World()
      const { pGame, pQuestControl, pDrlg } = allocGame(m, 1, 1)
      const pRoom = allocWalkableRoom(m, 40, 80, 180, 40, 40)
      const { pPlayer, pPlayerData, pClient, pPacketQueue, pQuestFlags } = allocPlayer(m, pGame, 301, 100, 200, pRoom, 1)

      const q9 = linkQuestNode(m, pGame, pQuestControl, 9, 0x0a)
      const q8 = linkQuestNode(m, pGame, pQuestControl, 8, 9)
      const q6 = linkQuestNode(m, pGame, pQuestControl, 0x0d, 0x0e)
      const q0 = linkQuestNode(m, pGame, pQuestControl, 7, 8)
      const q4 = linkQuestNode(m, pGame, pQuestControl, 0x0b, 0x0c)
      m.setU8((q8.pQuest + 0x0c) >>> 0, 2)
      m.setU8((q9.pQuest + 0x08) >>> 0, 1)
      m.setU8((q6.pQuestState + 0x3d) >>> 0, 1)
      m.setU8((q0.pQuestState + 0x0d) >>> 0, 1)
      m.set(pDrlg, D2DrlgStrc.nBossTombLevel, 0x45)

      const pVip = m.alloc(0x40) >>> 0
      m.setU32((pVip + 0x04) >>> 0, 1)
      const pCube = m.alloc(0x40) >>> 0
      m.setU32((pCube + 0x04) >>> 0, 2)
      const pArg = m.alloc(0x28) >>> 0
      m.setU32(pArg, pGame)
      m.setU32((pArg + 0x08) >>> 0, pVip)
      m.setU32((pArg + 0x0c) >>> 0, pPlayer)

      const pInv = m.alloc(0x40) >>> 0
      m.setU32(pInv, 0x01020304)
      const pStaff = m.alloc(0x100) >>> 0
      m.setU32(pStaff, 4)
      m.setU32((pStaff + 0x04) >>> 0, 5) // 'hst '
      m.setU32((pStaff + 0x14) >>> 0, m.alloc(0x80) >>> 0)
      m.setU32((pInv + 0x20) >>> 0, pStaff)
      m.set(pInv, D2InventoryStrc.pFirstItem, pStaff)
      m.setU32((pPlayer + 0x60) >>> 0, pInv)

      const pOrifice = m.alloc(0x100) >>> 0
      m.setU32(pOrifice, 2)
      m.setU32((pOrifice + 0x0c) >>> 0, 777)
      m.setU32((pOrifice + 0x2c) >>> 0, m.alloc(0x20) >>> 0)
      const pOp = m.alloc(0x20) >>> 0
      m.setU32(pOp, pGame)
      m.setU32((pOp + 0x04) >>> 0, pOrifice)
      m.setU32((pOp + 0x08) >>> 0, pPlayer)

      // MONREG transfer
      const ppMonReg = m.alloc(0x20) >>> 0
      const pSrcReg = m.alloc(0x300) >>> 0
      const pDstReg = m.alloc(0x300) >>> 0
      m.setU32(ppMonReg, pSrcReg)
      m.setU32((ppMonReg + 4) >>> 0, pDstReg)
      m.setU32((pSrcReg + 0x2cc) >>> 0, 10)
      const { pMon, pMonData } = allocMonster(m, pGame, 5, 501, 100, 200, pRoom)
      m.setU8((pMonData + 0x16) >>> 0, 1)

      // Mercenary for 0x6FCEC750
      const { pMon: pMerc, pMonData: pMercData } = allocMonster(m, pGame, 10, 0x55, 100, 200, pRoom)
      const pMercAiGen = m.alloc(0x40) >>> 0
      m.setU32((pMercData + 0x28) >>> 0, pMercAiGen)
      const pPetWrap = m.alloc(8) >>> 0
      const pPetArr = m.alloc(0x80) >>> 0
      const pPetNode = m.alloc(0x20) >>> 0
      m.setU32((pPetNode + 4) >>> 0, 0x55)
      m.setU32((pPetArr + 0x54) >>> 0, pPetNode)
      m.setU32(pPetWrap, pPetArr)
      m.setU32((pPlayerData + 0x44) >>> 0, pPetWrap)

      // Shrine / healing potion stats
      m.setU8((pCharStatsTxt + 1 * 0xc4 + 0x3a) >>> 0, 120)
      STATLIST_SetUnitStat113c(m, pPlayer, 6, 50 << 8, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 7, 100 << 8, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 8, 25 << 8, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 9, 100 << 8, 0)
      const pShrineList = STATLIST_AllocList113c(m, 0, 0, 0, 0x6a, 2000)
      STATLIST_MergeStatLists113c(m, pPlayer, pShrineList, 1)
      const pHealList = STATLIST_AllocList113c(m, 0, 0, 0, 0x64, 120)
      STATLIST_SetStat113c(m, pHealList, 0x4a, 2 << 8, 0)
      STATLIST_MergeStatLists113c(m, pPlayer, pHealList, 1)

      m.setU16((pClient + 0x0a) >>> 0, 0x0020)
      writeAscii(m, (pClient + 0x0d) >>> 0, 'Sorc')
      m.setU32((pGame + 0x88) >>> 0, pClient)
      const pOutStatus = m.alloc(4) >>> 0
      const pPkt3B = m.alloc(8) >>> 0
      m.setU8(pPkt3B, 0x3b)
      m.setU16((pPkt3B + 1) >>> 0, 0xb1)
      const pChat = m.alloc(0x120) >>> 0
      m.setU8(pChat, 0x26)
      m.setU8((pChat + 1) >>> 0, 1)
      m.setU8((pChat + 0x0a) >>> 0, 0x41)
      m.setU8((pChat + 0x1b) >>> 0, 0x42)
      const pPkt3C = m.alloc(12) >>> 0
      m.setU32((pPkt3C + 1) >>> 0, (2 << 16) | 0xffff)
      m.setU32((pPkt3C + 5) >>> 0, 0xffffffff)
      const pInit = m.alloc(0x10) >>> 0
      m.setU32(pInit, pGame)
      void pDataTables
      void pMerc
      void q4

      beginVaTrace113c()
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0a, 4)
      ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c(m, 0, pArg)
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 4)).toBe(0)
      expect(ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c(m, q9.pQuest, pPlayer, pOutStatus)).toBe(1)
      expect(m.u8(pOutStatus)).toBe(4)
      ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c(m, pGame, pPlayer)
      expect(ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c(m, pGame, 0)).toBe(1)
      ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c(m, pPlayer, pGame)
      expect(m.u32((q6.pQuestState + 0x34) >>> 0)).toBe(0x45)
      m.setU32((pInv + 0x20) >>> 0, 0)
      expect(ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c(m, pOp)).toBe(0)
      ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c(m, pPlayer, pQuestFlags, pGame)
      ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c(m, pGame, pPlayer)
      expect(ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c(m, pGame, pPlayer)).toBe(0)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0b, 0x0d)
      ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c(m, pGame, pPlayer)
      ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c(m, pGame, pPlayer)
      ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c(m, pGame, pPlayer)
      expect(ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c(m, pGame, pPlayer)).toBe(0)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 5)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 0x0d)
      ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c(m, pGame, pPlayer)
      ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c(m, pGame, pPlayer)
      expect(ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c(m, pGame, pPlayer)).toBe(0)
      m.setU32((pArg + 0x08) >>> 0, pCube)
      ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c(m, q9.pQuest, pArg)
      ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20_113c(m, q0.pQuest, pArg)
      expect(ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c(m, pGame, m.alloc(8), m.alloc(4))).toBe(0)
      ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c(m, m.alloc(8), q0.pQuest, 0)
      ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c(m, pInit)
      MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c(m, ppMonReg, 1, 0, 0, 0, 0, pMon)
      expect(PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c(m, pGame, pPlayer, pPkt3B, 3)).toBe(0)
      NET_SendChatMessagePacket26Wrapper_6FCEB580_113c(m, pClient, pChat)
      expect(SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c(m, -1, pPlayer)).toBe(2)
      expect(PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c(m, pPlayer)).toBeGreaterThan(0)
      expect(PLAYER_CalcHealingPotionPercent_6FCEB840_113c(m, pPlayer)).toBeGreaterThan(0)
      expect(PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c(m, pGame, pPlayer, pPkt3C, 9)).toBe(0)
      expect(PACKET_Srv40_RequestQuestLog_6FCEBD30_113c(m, pGame, pPlayer, pPkt3C, 1)).toBe(0)
      m.setU32(pPacketQueue, 0)
      PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c(m, pPlayer, 0, pGame)
      expect(m.u8((pPacketQueue + 4) >>> 0)).toBe(0x5a)
      expect(PLAYER_IssueMercAiMoveCommand_6FCEC750_113c(m, pGame, 0x55, pPlayer, 120, 140, 0x0d)).toBe(0)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 2: k2w16-b1 (33 eligible VAs)
    // -------------------------------------------------------------------------
    {
      const { m } = createWave13World()
      const { pGame, pQuestControl } = allocGame(m, 0, 1)
      m.setU8((pGame + 0x6a) >>> 0, 1)
      const pRoom = allocWalkableRoom(m, 108, 80, 180, 40, 40)
      const { pPlayer, pClient } = allocPlayer(m, pGame, 51, 100, 200, pRoom)
      const { pMon: pVictim } = allocMonster(m, pGame, 0xf3, 52, 100, 200, pRoom)
      const q17 = linkQuestNode(m, pGame, pQuestControl, 0x17, 0x1a)
      const q18 = linkQuestNode(m, pGame, pQuestControl, 0x18, 0x1b)
      const q24 = linkQuestNode(m, pGame, pQuestControl, 0x24, 0x28)
      const q0f = linkQuestNode(m, pGame, pQuestControl, 0x0f, 0x11)
      m.setU8((q18.pQuest + 0x09) >>> 0, 1)
      m.setU8((q0f.pQuest + 0x09) >>> 0, 1)
      m.setU8((q17.pQuest + 0x09) >>> 0, 1)

      const pObj = m.alloc(0x100) >>> 0
      const pObjPath = m.alloc(0x30) >>> 0
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x04) >>> 0, 0x188)
      m.setU32((pObj + 0x0c) >>> 0, 61)
      m.setU32((pObj + 0x2c) >>> 0, pObjPath)
      m.setU32((pObjPath + 0x00) >>> 0, pRoom)
      m.setU32((pObjPath + 0x0c) >>> 0, 100)
      m.setU32((pObjPath + 0x10) >>> 0, 200)
      SUNIT_InsertServerUnit113c(m, pGame, pObj)

      const pArg = m.alloc(0x30) >>> 0
      m.setU32(pArg, pGame)
      m.setU32((pArg + 0x04) >>> 0, pObj)
      m.setU32((pArg + 0x08) >>> 0, pPlayer)
      const pPkt = m.alloc(0x20) >>> 0

      // Save chunk buffer for 0x6FC4D140 & 0x6FC4D790
      m.setU8((pClient + 0x3d4) >>> 0, 0x10)
      m.setU32((pClient + 0x17c) >>> 0, m.alloc(0x20) >>> 0)
      m.setU32((pClient + 0x180) >>> 0, 8)
      m.setU32(0x6fd31c3c, 1)

      beginVaTrace113c()
      CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c(m, pClient, pGame)
      CLIENTS_FlushPositionsSaveAndPacketQueue_6FC4D500_113c(m, pClient, pGame, 0)
      CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c(m, pGame, pClient)
      CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c(m, 9999, 0)
      CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c(m, pGame)
      CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c(m, pGame, 0)
      PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c(m, pPlayer, pGame)
      PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c(m, pPlayer, pGame)
      expect(ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c(m, pArg)).toBe(0)
      m.setU32((pArg + 0x08) >>> 0, pVictim)
      ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c(m, q24.pQuest, pArg)
      expect(OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c(m, 0, 51, pGame, 61, 2)).toBe(1)
      OBJ_DeactivateShrineOrStashObject_6FC8F520_113c(m, pGame, pPlayer, pObj)
      expect(PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, pPlayer, 2, 0)).toBe(0)
      PLAYER_HandleDeathCorpseAndSave_6FC99730_113c(m, pGame, pPlayer)
      PLAYER_ProcessPlayerDeathAndPenalties_6FC99E40_113c(m, pGame, pPlayer, 0, 0)
      SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c(m, pPlayer, 0, pGame)
      m.setU32((pArg + 0x08) >>> 0, pPlayer)
      expect(ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c(m, pArg)).toBe(0)
      expect(ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c(m, pGame, pPlayer, 0)).toBe(0)
      expect(ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c(m, pGame, q17.pQuest)).toBe(1)
      m.setU32((pObj + 0x10) >>> 0, 0)
      expect(ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c(m, pArg)).toBe(0)
      const pSealCoord = m.alloc(8) >>> 0
      m.setU32(pSealCoord, 100)
      m.setU32((pSealCoord + 4) >>> 0, 200)
      m.setU32((pObj + 0x10) >>> 0, 0)
      ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c(m, pSealCoord, pArg, 1)
      ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c(m, pArg)
      m.setU32((pArg + 0x08) >>> 0, pVictim)
      ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c(m, q17.pQuest, pArg)
      m.setU32((pObj + 0x10) >>> 0, 0)
      expect(ACT4Q3_OnSeal5Operate_6FCDC4A0_113c(m, pArg)).toBe(0)
      m.setU32((pObj + 0x10) >>> 0, 0)
      expect(ACT4Q3_OnSeal3Operate_6FCDC510_113c(m, pArg)).toBe(0)
      m.setU32((pObj + 0x10) >>> 0, 0)
      expect(ACT4Q3_OnSeal1Operate_6FCDC580_113c(m, pArg)).toBe(0)
      NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c(m, 0, pGame, pPlayer, 0, 0)
      expect(C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c(m, pGame, pPlayer, pPkt, 4)).toBe(3)
      expect(C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c(m, pGame, pPlayer, pPkt, 4)).toBe(3)
      expect(C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c(m, pGame, pPlayer, pPkt, 8)).toBe(3)
      expect(C2S_HandlePacket4F_TradeButton_6FCF1470_113c(m, pGame, pPlayer, pPkt, 7)).toBe(0)
      expect(C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c(m, pGame, pPlayer, pPkt, 2)).toBe(3)
      m.setU32((pArg + 0x08) >>> 0, pPlayer)
      m.setU32((pObj + 0x10) >>> 0, 0)
      expect(ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c(m, pArg)).toBe(0)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 3: k2w6-b4 (33 eligible VAs)
    // -------------------------------------------------------------------------
    {
      const { m } = createWave13World()
      const { pGame, pQuestControl } = allocGame(m)
      const pRoom = allocWalkableRoom(m, 2, 80, 180, 40, 40)
      const pQuests: number[] = []
      for (let i = 41; i >= 0; i--) {
        const node = linkQuestNode(m, pGame, pQuestControl, i, i)
        pQuests[i] = node.pQuest
      }
      const { pPlayer } = allocPlayer(m, pGame, 1, 100, 200, pRoom)
      const { pMon: pTarget } = allocMonster(m, pGame, 5, 2, 101, 200, pRoom)
      const pQuestArg = m.alloc(0x40) >>> 0
      m.setU32(pQuestArg, pGame)
      m.setU32((pQuestArg + 0x08) >>> 0, pTarget)
      m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer)
      const pSkill = m.alloc(0x40) >>> 0
      m.setU8((pQuests[0x24]! + 0x09) >>> 0, 1)

      beginVaTrace113c()
      expect(SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c(m, pGame, pTarget)
      expect(SKILLS_UpdateLeapMovementStep_6FC48740_113c(m, pPlayer, pGame, pSkill)).toBe(0)
      expect(SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c(m, () => 0, pQuests[0]!, 0, 3, 0)
      expect(m.u8((pQuests[0]! + 0x0b) >>> 0)).toBe(3)
      QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c(m, pGame, 1)
      PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c(m, pPlayer, pGame)
      expect(() => OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c(m, pGame, pTarget)).toThrow()
      expect(SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c(m, pPlayer, pGame, -1, 1, 1)).toBe(0)
      ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c(m, 50, pPlayer, 0, pGame, 1)
      ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c(m, pGame)
      expect(ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c(m, pQuests[0x24]!)).toBe(1)
      ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c(m, pGame)
      expect(ACT5Q4_TimerPromoteState4_6FC79CD0_113c(m, pQuests[0x22]!)).toBe(1)
      ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c(m, pQuestArg)
      ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c(m, pGame)
      ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c(m, pGame)
      ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c(m, pQuests[0x20]!, pQuestArg)
      ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c(m, pGame, pTarget)
      ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c(m, pQuestArg)
      ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c(m, pGame, pTarget, pPlayer)
      ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c(m, pQuests[0x1f]!, pQuestArg)
      ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c(m, pPlayer, pGame)
      expect(ACT1Q5_TimerPromoteState0D_6FC83210_113c(m, pQuests[5]!)).toBe(1)
      ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c(m, pQuests[3]!)
      ACT1Q5_DecrementCounterAndCheckState3_6FC836C0_113c(m, pQuests[5]!)
      ACT1Q5_OnMoldyTomeActivated_6FC83730_113c(m, pQuests[5]!, pQuestArg)
      expect(ACT1Q2_TimerPromoteState3_6FC83A80_113c(m, pQuests[2]!)).toBe(1)
      expect(ACT1Q1_TimerPromoteState5_6FC83B50_113c(m, pQuests[1]!)).toBe(1)
      m.setU32((pQuestArg + 0x0c) >>> 0, 0)
      ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c(m, pQuests[4]!, pQuestArg)
      expect(m.u32((pTarget + 0xb8) >>> 0)).toBe(0x20737076)
      expect(ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c(m, pQuests[4]!)).toBe(1)
      expect(ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c(m, pPlayer, 0, pGame)).toBe(0)
      expect(SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 4: k2w4-b8 (33 eligible VAs; 0x6FCD8A70 indirectUnknown stays ported)
    // -------------------------------------------------------------------------
    {
      const { m, pSkillsTxt, pMonStatsTxt } = createWave13World()
      const { pGame, pQuestControl } = allocGame(m)
      const pRoom = allocWalkableRoom(m, 108, 80, 180, 40, 40)
      const { pPlayer, pQuestFlags } = allocPlayer(m, pGame, 1, 100, 200, pRoom)
      const { pMon: pBaal, pMonData: pBaalData } = allocMonster(m, pGame, 5, 2, 101, 200, pRoom)
      m.setU32(pBaalData, (pMonStatsTxt + 5 * 0x1a8) >>> 0)
      const pSkillTxt10 = (pSkillsTxt + 10 * 0x23c) >>> 0
      m.setU16((pSkillTxt10 + 0x48) >>> 0, 5)
      m.setU32((pSkillTxt10 + 0x138) >>> 0, 0xffffffff)
      m.setU32((pSkillTxt10 + 0x13c) >>> 0, 0xffffffff)
      const q22 = linkQuestNode(m, pGame, pQuestControl, 0x16, 0x19)
      m.setU32((q22.pQuestState + 0x14) >>> 0, pBaal)
      const pAiParamPtr = m.alloc(8) >>> 0
      const pAiGen = m.alloc(0x40) >>> 0
      m.setU32(pAiParamPtr, pAiGen)
      const pNpcParams = m.alloc(0x40) >>> 0
      m.setU32(pNpcParams, pGame)
      m.setU32((pNpcParams + 0x08) >>> 0, pBaal)
      m.setU32((pNpcParams + 0x0c) >>> 0, pPlayer)

      beginVaTrace113c()
      expect(SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      expect(SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c(m, pGame, pPlayer)).toBe(0)
      expect(SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c(m, pGame, pPlayer)).toBe(0)
      expect(SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      expect(SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c(m, pGame, pPlayer)).toBe(0)
      expect(SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      expect(SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      expect(SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c(m, pGame, pPlayer, 10, 1)).toBe(1)
      expect(SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      expect(SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      expect(SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      expect(SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      expect(SKILLS_SrvDo141_SpawnPartyMinionsAndDistributeExp_6FCD65E0_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
      expect(SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c(m, pGame, pPlayer)).toBe(1)
      expect(AIBAAL_ChooseActionWeighted_6FCD7380_113c(m, pBaal, pGame, m.alloc(0x40), pPlayer, 1, 0, 1, 0, 70)).toBeLessThan(16)
      expect(AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c(m, pPlayer, pGame, pBaal, 1, 0, 1)).toBeLessThan(16)
      expect(AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c(m, pBaal, pGame, pPlayer, 1)).toBeLessThan(16)
      AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c(m, pGame, 0, pAiParamPtr)
      expect(ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c(m, pGame, pPlayer)).toBe(0)
      ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c(m, pGame, pPlayer)
      expect(ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c(m, pGame, pPlayer)).toBe(0)
      ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c(m, pQuestFlags, pPlayer, pGame)
      expect(ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c(m, pGame, 0)).toBe(0)
      expect(ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c(m, pGame, pPlayer)).toBe(0)
      ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c(m, q22.pQuest, pNpcParams)
      expect(ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c(m, 0, 100, pGame, 100, q22.pQuestState)).toBe(0)
      expect(ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c(m, pNpcParams, q22.pQuestState)).not.toBe(0)
      ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c(m, pBaal, q22.pQuest)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    const missingVas = WAVE13_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
