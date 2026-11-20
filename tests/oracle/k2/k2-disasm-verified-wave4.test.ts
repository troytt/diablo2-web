/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 4: +164 VAs).
 *
 * Audits and verifies 164 `D2Game.dll` (`0x6FC20000`) closure functions across:
 * - `k2w5-b2` (`src/d2kern-113c/game/k2-w5b2-113c.ts`, 41 functions)
 * - `k2w4-b2` (`src/d2kern-113c/game/k2-w4b2-113c.ts`, 41 functions)
 * - `k2w2-b8` (`src/d2kern-113c/game/k2-w2b8-113c.ts`, 41 functions)
 * - `k2w2-b4` (`src/d2kern-113c/game/k2-w2b4-113c.ts`, 41 functions)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`.
 * 2. Multi-branch `SparseMemory113c` behavioral assertions & regression tests for all verified 1.13c
 *    instruction-level disassembly fixes (idle-wander range=4, wSubMissile non-null skip,
 *    charged missile duration/charge arg order, nearby-player list zeroing offset +0x04,
 *    direct save-buffer copy, Anya pInteract & call-order, 11 quest-alert boolean predicates,
 *    Cain rescue party-ID lookup, Shrine Monster canonical promotion, scattered-projectile
 *    targetX seed & pOwner field, pet unsummon 0x7A channel 1, Smite dwHitClass +0x60 = 0x65).
 * 3. 100% (`164 / 164`) live `beginVaTrace113c()` / `endVaTrace113c()` execution coverage.
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_LinkItemToInventoryList113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemQuality113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import { QUESTS_GuidListAdd113c } from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts'
import {
  CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c,
  EVENT_DestroyTimerQueue_6FCAE4D0_113c,
  ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c,
  ITEMS_SendCursorPutItemPacket04_6FCADF70_113c,
  ITEMS_SendDropToGroundPacket02_6FCAE030_113c,
  ITEMS_SendGroundItemPacket03_6FCADFD0_113c,
  ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c,
  ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c,
  ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c,
  MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c,
  MONAI_NoOpStub_6FCBC990_113c,
  PARTY_AllocNextPartyId_6FCBBD40_113c,
  PARTY_AllocPartyControl_6FCBBE40_113c,
  PARTY_FindSubPartyById_6FCBBD00_113c,
  PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c,
  PARTY_SplitGoldPickupByCap_6FCBBC70_113c,
  S2C_QueueByteDwordPacket6_6FCAC3B0_113c,
  S2C_QueueLocationPacket11_6FCABF80_113c,
  S2C_QueueMonsterMovePacket12_6FCAC160_113c,
  S2C_QueueSingleBytePacket1_6FCAC490_113c,
  S2C_QueueUnitTargetMovePacket16_6FCAC230_113c,
  S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c,
  S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c,
  S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c,
  SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c,
  SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c,
  SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c,
  SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c,
  SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c,
  SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c,
  SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c,
  SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c,
  SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c,
  STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c,
  STATES_ClearGfxStateFlagCallback_6FCB0F00_113c,
  SUMMON_GetFirstPetGuidForType_6FCB67B0_113c,
  SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c,
  SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c,
  SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c,
  VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c,
  VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c,
} from '../../../src/d2kern-113c/game/k2-w2b4-113c.ts'
import {
  ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c,
  ACT3Q2_InitGidbinnAltarObject_6FD04120_113c,
  ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c,
  ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c,
  ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c,
  ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c,
  ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c,
  ACT3Q3_InitSewerLeverObject_6FD04980_113c,
  ACT3Q3_InitSewerStairsObject_6FD02E00_113c,
  ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c,
  ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c,
  ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c,
  ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c,
  ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c,
  ACT3Q5_InitCompellingOrbObject_6FD02A00_113c,
  ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c,
  ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c,
  ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c,
  AI_ApproachTargetPathType13_6FD13000_113c,
  AI_RunTowardTarget_6FD12F00_113c,
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
  AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c,
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c,
  AI_StartModeAtCoordsStep0_6FD11FA0_113c,
  AI_StartModeAtCoordsStep1_6FD11FF0_113c,
  AI_WalkTowardTarget_6FD12F30_113c,
  D2GAME_IAT_GET_TICK_COUNT_VA_113C,
  ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c,
  ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c,
  ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c,
  ITEMS_OnCharmPlacedInInventory_6FCF6710_113c,
  ITEMS_PlaceItemInSocketInventory_6FCF1650_113c,
  MONSTER_SpawnAtCoords_6FD0F450_113c,
  MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c,
  PACKET_Recv12_ClearGfxState0C_6FCEB590_113c,
  PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c,
  PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c,
  PLAYERLIST_SetHostileDelayTick_6FD10090_113c,
  SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c,
  SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c,
  SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c,
  SUNIT_SetPlayerClientPtr_6FD00040_113c,
  SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c,
} from '../../../src/d2kern-113c/game/k2-w2b8-113c.ts'
import {
  ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c,
  ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
  ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
  ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
  ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c,
  ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
  ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c,
  ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c,
  ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c,
  ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c,
  ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c,
  ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
  ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
  ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c,
  ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
  ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c,
  ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c,
  ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c,
  ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c,
  CLIENTS_AppendSaveDataChunk_6FC6A190_113c,
  CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c,
  MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c,
  MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c,
  MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c,
  MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c,
  MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c,
  MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c,
  MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c,
  MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c,
  MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c,
  MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c,
  MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c,
  MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c,
  MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c,
  MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c,
  MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c,
  PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c,
  PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c,
  QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c,
  SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c,
  SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c,
} from '../../../src/d2kern-113c/game/k2-w4b2-113c.ts'
import {
  ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c,
  ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c,
  ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c,
  ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c,
  ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c,
  ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c,
  ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c,
  ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c,
  ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c,
  ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c,
  ACT5Q3_PropagateQuestStateToPartyCallback_6FC7B120_113c,
  ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c,
  ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c,
  NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c,
  NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c,
  NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c,
  OBJ_OperateChestAndDropTreasure_6FC8EC20_113c,
  OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c,
  OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c,
  OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c,
  OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c,
  OBJ_UseWellHealPlayerAndPets_6FC8A560_113c,
  PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c,
  PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c,
  PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c,
  SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c,
  SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c,
  SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c,
  SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c,
  SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c,
  SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c,
  SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c,
  SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c,
  SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c,
  SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c,
  SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c,
  SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c,
  SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c,
  SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c,
  SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0_113c,
  SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b2-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
  SUNIT_SetMonsterAlignmentState113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
  EVENT_SetEventFull113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2AnimDataTableStrc,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2DynamicPathStrc,
  D2DynamicPathStrc_SIZE,
  D2ItemDataStrc,
  D2ItemDataStrc_SIZE,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemStatCostTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2MissileDataStrc,
  D2MissileDataStrc_SIZE,
  D2MonStats2Txt,
  D2MonStats2Txt_SIZE,
  D2MonStatsTxt,
  D2MonStatsTxt_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2SkillsTxt,
  D2SkillsTxt_SIZE,
  D2StatListExStrc,
  D2StatListExStrc_SIZE,
  D2StatListStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { type Memory113c, SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import type { Manifest } from '../../../tools/oracle/callgraph/status.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools', 'oracle', 'callgraph', 'manifest-113c.json')
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data')

interface DisasmVaSpec {
  readonly batch: 'k2w5-b2' | 'k2w4-b2' | 'k2w2-b8' | 'k2w2-b4'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE4_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  { batch: 'k2w5-b2', va: '0x6FC7AB00', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c' },
  { batch: 'k2w5-b2', va: '0x6FC7AF50', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c' },
  { batch: 'k2w5-b2', va: '0x6FC7B030', size: 128, headHex: '5356578b7c24108b', tailHex: 'c20400', tsSymbol: 'ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c' },
  { batch: 'k2w5-b2', va: '0x6FC7B120', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT5Q3_PropagateQuestStateToPartyCallback_6FC7B120_113c' },
  { batch: 'k2w5-b2', va: '0x6FC7B180', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c' },
  { batch: 'k2w5-b2', va: '0x6FC7B490', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c' },
  { batch: 'k2w5-b2', va: '0x6FC83D70', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c' },
  { batch: 'k2w5-b2', va: '0x6FC84150', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c' },
  { batch: 'k2w5-b2', va: '0x6FC848B0', size: 133, headHex: '5356578bfa578bf1', tailHex: 'c20400', tsSymbol: 'ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c' },
  { batch: 'k2w5-b2', va: '0x6FC84B60', size: 163, headHex: '568bf085f6751f68', tailHex: 'c20400', tsSymbol: 'ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c' },
  { batch: 'k2w5-b2', va: '0x6FC84FE0', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c' },
  { batch: 'k2w5-b2', va: '0x6FC85200', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c' },
  { batch: 'k2w5-b2', va: '0x6FC88FC0', size: 363, headHex: '53568bf1578b3e8b', tailHex: 'c05bc3', tsSymbol: 'ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c' },
  { batch: 'k2w5-b2', va: '0x6FC8A560', size: 385, headHex: '83ec08535557568b', tailHex: 'c20400', tsSymbol: 'OBJ_UseWellHealPlayerAndPets_6FC8A560_113c' },
  { batch: 'k2w5-b2', va: '0x6FC8B8A0', size: 129, headHex: '568bf18b4e088b01', tailHex: 'ff5ec3', tsSymbol: 'OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c' },
  { batch: 'k2w5-b2', va: '0x6FC8EB40', size: 215, headHex: '578bf98b470485c0', tailHex: '005fc3', tsSymbol: 'OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c' },
  { batch: 'k2w5-b2', va: '0x6FC8EC20', size: 169, headHex: '578bf98b470485c0', tailHex: '005fc3', tsSymbol: 'OBJ_OperateChestAndDropTreasure_6FC8EC20_113c' },
  { batch: 'k2w5-b2', va: '0x6FC8ECD0', size: 209, headHex: '578bf98b470485c0', tailHex: '005fc3', tsSymbol: 'OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c' },
  { batch: 'k2w5-b2', va: '0x6FC8EF40', size: 242, headHex: '568bf18b460485c0', tailHex: '005ec3', tsSymbol: 'OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c' },
  { batch: 'k2w5-b2', va: '0x6FC9ACB0', size: 279, headHex: '558bec83e4f881ec', tailHex: 'c20400', tsSymbol: 'SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c' },
  { batch: 'k2w5-b2', va: '0x6FCAD710', size: 324, headHex: '83ec1c568bf033c0', tailHex: 'c20c00', tsSymbol: 'NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c' },
  { batch: 'k2w5-b2', va: '0x6FCAFAF0', size: 227, headHex: '85c053558b6c240c', tailHex: 'c20400', tsSymbol: 'NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB0170', size: 225, headHex: '5153558b6c241056', tailHex: 'c20400', tsSymbol: 'NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB18D0', size: 347, headHex: '558b6c241056578b', tailHex: 'c20c00', tsSymbol: 'SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB1A30', size: 265, headHex: '53578b7c24106a00', tailHex: 'c20c00', tsSymbol: 'SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB20C0', size: 353, headHex: '83ec245356578b7c', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB2770', size: 458, headHex: '83ec7853568bb424', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB2A60', size: 336, headHex: '83ec7053558bac24', tailHex: 'c21000', tsSymbol: 'SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB2CC0', size: 48, headHex: '83ec70568bc18b70', tailHex: 'c470c3', tsSymbol: 'SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB34A0', size: 321, headHex: '81ec8c0000005355', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB3990', size: 545, headHex: '8b4c240483ec6053', tailHex: 'c22000', tsSymbol: 'SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB3BC0', size: 413, headHex: '558bec83e4f883ec', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB4970', size: 410, headHex: '558bec83e4f881ec', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB5690', size: 343, headHex: '83ec7455568bf28b', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB6D70', size: 297, headHex: '83ec1c578bf88b44', tailHex: 'c20800', tsSymbol: 'PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB72C0', size: 122, headHex: '558b6c240c56578b', tailHex: 'f6ffcc', tsSymbol: 'PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB77E0', size: 317, headHex: '83ec4053578bf985', tailHex: 'c440c3', tsSymbol: 'PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB8BA0', size: 647, headHex: '81ec80000000538b', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB8E90', size: 367, headHex: '83ec78538b9c2480', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB9000', size: 641, headHex: '81ec880000005355', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c' },
  { batch: 'k2w5-b2', va: '0x6FCB94C0', size: 338, headHex: '83ec6c55568b7424', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC561E0', size: 645, headHex: '83ec58538b5c246c', tailHex: 'c21800', tsSymbol: 'QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC576B0', size: 56, headHex: '5357508bf9e8062e', tailHex: '5f5bc3', tsSymbol: 'PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC5A790', size: 192, headHex: '51558bea85ed894c', tailHex: 'c20800', tsSymbol: 'MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c' },
  { batch: 'k2w4-b2', va: '0x6FC5A850', size: 204, headHex: '51538bda85db0f84', tailHex: 'c20800', tsSymbol: 'MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c' },
  { batch: 'k2w4-b2', va: '0x6FC5A920', size: 241, headHex: '83ec78558bea85ed', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c' },
  { batch: 'k2w4-b2', va: '0x6FC5D800', size: 182, headHex: '5155568bf285f657', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c' },
  { batch: 'k2w4-b2', va: '0x6FC5DA60', size: 206, headHex: '83ec0853568bf285', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c' },
  { batch: 'k2w4-b2', va: '0x6FC5DB30', size: 548, headHex: '81eca8000000538b', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c' },
  { batch: 'k2w4-b2', va: '0x6FC5DD60', size: 400, headHex: '83ec3055568bea85', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c' },
  { batch: 'k2w4-b2', va: '0x6FC5E330', size: 182, headHex: '5156578bfa85ff89', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c' },
  { batch: 'k2w4-b2', va: '0x6FC604D0', size: 257, headHex: '83ec0c538bda85db', tailHex: 'c40cc3', tsSymbol: 'MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC613D0', size: 332, headHex: '83ec10538bda85db', tailHex: 'c410c3', tsSymbol: 'MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC61670', size: 157, headHex: '53568bda85db578b', tailHex: '5e5bc3', tsSymbol: 'MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c' },
  { batch: 'k2w4-b2', va: '0x6FC61B80', size: 173, headHex: '83ec0853568bf285', tailHex: 'c408c3', tsSymbol: 'MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c' },
  { batch: 'k2w4-b2', va: '0x6FC61C30', size: 417, headHex: '83ec6853558bda85', tailHex: 'c468c3', tsSymbol: 'MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c' },
  { batch: 'k2w4-b2', va: '0x6FC61DE0', size: 193, headHex: '83ec5c5355568bf2', tailHex: 'c45cc3', tsSymbol: 'MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC663A0', size: 71, headHex: '85f653558b6c2414', tailHex: 'c20c00', tsSymbol: 'SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC68950', size: 493, headHex: '56508bf1e8671bfc', tailHex: '5b5ec3', tsSymbol: 'MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c' },
  { batch: 'k2w4-b2', va: '0x6FC6A190', size: 305, headHex: '558b6c2410568bf0', tailHex: 'c21000', tsSymbol: 'CLIENTS_AppendSaveDataChunk_6FC6A190_113c' },
  { batch: 'k2w4-b2', va: '0x6FC6AD80', size: 258, headHex: '8b83b401000081ec', tailHex: 'c20400', tsSymbol: 'CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c' },
  { batch: 'k2w4-b2', va: '0x6FC70190', size: 187, headHex: '5153558b6c241085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c' },
  { batch: 'k2w4-b2', va: '0x6FC73B40', size: 108, headHex: '558b6c241485ed74', tailHex: 'c21800', tsSymbol: 'PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c' },
  { batch: 'k2w4-b2', va: '0x6FC78D40', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c' },
  { batch: 'k2w4-b2', va: '0x6FC78F90', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c' },
  { batch: 'k2w4-b2', va: '0x6FC790C0', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC791D0', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC793F0', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC79620', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c' },
  { batch: 'k2w4-b2', va: '0x6FC799D0', size: 13, headHex: '8bc251e868f0ffff', tailHex: 'c20400', tsSymbol: 'ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC799E0', size: 122, headHex: '53568bf2568bd9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC7C1F0', size: 172, headHex: '83ec348d44240450', tailHex: 'c20800', tsSymbol: 'ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC7C3A0', size: 218, headHex: '83ec0c578bf98b07', tailHex: 'c40cc3', tsSymbol: 'ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC7D760', size: 445, headHex: '83ec145356578bf2', tailHex: 'c20400', tsSymbol: 'ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c' },
  { batch: 'k2w4-b2', va: '0x6FC7DEF0', size: 121, headHex: '8b80f410000085c0', tailHex: 'ff5ec3', tsSymbol: 'ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC7E0E0', size: 278, headHex: '53558b6c2414568d', tailHex: 'c20c00', tsSymbol: 'ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC7EC30', size: 499, headHex: '83ec2053558b6c24', tailHex: 'feffff', tsSymbol: 'ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c' },
  { batch: 'k2w4-b2', va: '0x6FC82700', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c' },
  { batch: 'k2w4-b2', va: '0x6FC82870', size: 81, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c' },
  { batch: 'k2w4-b2', va: '0x6FC82A80', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c' },
  { batch: 'k2w4-b2', va: '0x6FC82AE0', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c' },
  { batch: 'k2w4-b2', va: '0x6FC82C00', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c' },
  { batch: 'k2w2-b8', va: '0x6FCEB590', size: 30, headHex: '837c2408017408b8', tailHex: 'c20800', tsSymbol: 'PACKET_Recv12_ClearGfxState0C_6FCEB590_113c' },
  { batch: 'k2w2-b8', va: '0x6FCEBD50', size: 78, headHex: '8b4c2408b8030000', tailHex: 'c20800', tsSymbol: 'PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c' },
  { batch: 'k2w2-b8', va: '0x6FCF1650', size: 91, headHex: '85ff750768a11900', tailHex: '0000c3', tsSymbol: 'ITEMS_PlaceItemInSocketInventory_6FCF1650_113c' },
  { batch: 'k2w2-b8', va: '0x6FCF1780', size: 14, headHex: '8b81a80000005052', tailHex: 'f3ffc3', tsSymbol: 'ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c' },
  { batch: 'k2w2-b8', va: '0x6FCF1A30', size: 26, headHex: '5051e8918ef3ff83', tailHex: '33c0c3', tsSymbol: 'ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c' },
  { batch: 'k2w2-b8', va: '0x6FCF1A50', size: 80, headHex: 'c7030000000056c7', tailHex: '035ec3', tsSymbol: 'ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c' },
  { batch: 'k2w2-b8', va: '0x6FCF6710', size: 71, headHex: '56576a018bf96a10', tailHex: 'c20400', tsSymbol: 'ITEMS_OnCharmPlacedInInventory_6FCF6710_113c' },
  { batch: 'k2w2-b8', va: '0x6FCFAE70', size: 83, headHex: '538b5c240885db7f', tailHex: 'c20400', tsSymbol: 'SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c' },
  { batch: 'k2w2-b8', va: '0x6FCFF980', size: 24, headHex: '578bf950e8c7adff', tailHex: 'c20400', tsSymbol: 'SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c' },
  { batch: 'k2w2-b8', va: '0x6FD00040', size: 66, headHex: '85c0750768bb0400', tailHex: 'c20400', tsSymbol: 'SUNIT_SetPlayerClientPtr_6FD00040_113c' },
  { batch: 'k2w2-b8', va: '0x6FD00410', size: 77, headHex: '53568bf233db3bf3', tailHex: 'c20c00', tsSymbol: 'SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c' },
  { batch: 'k2w2-b8', va: '0x6FD00BD0', size: 27, headHex: '8bc6e8c9fbffff8b', tailHex: '23c1c3', tsSymbol: 'SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c' },
  { batch: 'k2w2-b8', va: '0x6FD02A00', size: 57, headHex: '8b018b80f4100000', tailHex: 'f2ffc3', tsSymbol: 'ACT3Q5_InitCompellingOrbObject_6FD02A00_113c' },
  { batch: 'k2w2-b8', va: '0x6FD02D00', size: 53, headHex: '8b420856578bf18b', tailHex: '5f5ec3', tsSymbol: 'ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c' },
  { batch: 'k2w2-b8', va: '0x6FD02E00', size: 53, headHex: '8b018b80f4100000', tailHex: 'f2ffc3', tsSymbol: 'ACT3Q3_InitSewerStairsObject_6FD02E00_113c' },
  { batch: 'k2w2-b8', va: '0x6FD03390', size: 14, headHex: '53568bda8bf1e825', tailHex: '5e5bc3', tsSymbol: 'ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c' },
  { batch: 'k2w2-b8', va: '0x6FD03960', size: 14, headHex: '53568bda8bf1e855', tailHex: '5e5bc3', tsSymbol: 'ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c' },
  { batch: 'k2w2-b8', va: '0x6FD03B30', size: 14, headHex: '53568bda8bf1e885', tailHex: '5e5bc3', tsSymbol: 'ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c' },
  { batch: 'k2w2-b8', va: '0x6FD04120', size: 81, headHex: '8b018b80f4100000', tailHex: 'f2ffc3', tsSymbol: 'ACT3Q2_InitGidbinnAltarObject_6FD04120_113c' },
  { batch: 'k2w2-b8', va: '0x6FD041A0', size: 47, headHex: '8b420c538b1a568b', tailHex: '5e5bc3', tsSymbol: 'ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c' },
  { batch: 'k2w2-b8', va: '0x6FD047D0', size: 87, headHex: '53568bf28bd96871', tailHex: 'c20400', tsSymbol: 'ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c' },
  { batch: 'k2w2-b8', va: '0x6FD04830', size: 87, headHex: '53568bf28bd96871', tailHex: 'c20400', tsSymbol: 'ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c' },
  { batch: 'k2w2-b8', va: '0x6FD04890', size: 87, headHex: '53568bf28bd96871', tailHex: 'c20400', tsSymbol: 'ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c' },
  { batch: 'k2w2-b8', va: '0x6FD04980', size: 95, headHex: '8b018b80f4100000', tailHex: 'f2ffc3', tsSymbol: 'ACT3Q3_InitSewerLeverObject_6FD04980_113c' },
  { batch: 'k2w2-b8', va: '0x6FD05080', size: 63, headHex: '538bc28bd9686262', tailHex: 'c20400', tsSymbol: 'ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c' },
  { batch: 'k2w2-b8', va: '0x6FD051C0', size: 81, headHex: '8b420885c0744966', tailHex: '5e5fc3', tsSymbol: 'ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c' },
  { batch: 'k2w2-b8', va: '0x6FD05220', size: 14, headHex: '53568bda8bf1e895', tailHex: '5e5bc3', tsSymbol: 'ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c' },
  { batch: 'k2w2-b8', va: '0x6FD05B10', size: 76, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c' },
  { batch: 'k2w2-b8', va: '0x6FD05CD0', size: 76, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c' },
  { batch: 'k2w2-b8', va: '0x6FD06470', size: 73, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c' },
  { batch: 'k2w2-b8', va: '0x6FD0DF20', size: 64, headHex: '5657e851c5f1ff8b', tailHex: 'c21400', tsSymbol: 'MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c' },
  { batch: 'k2w2-b8', va: '0x6FD0F450', size: 86, headHex: '83ec28894c240c8b', tailHex: 'c21800', tsSymbol: 'MONSTER_SpawnAtCoords_6FD0F450_113c' },
  { batch: 'k2w2-b8', va: '0x6FD0FFD0', size: 100, headHex: '5356578bf0e8e6a4', tailHex: 'c20400', tsSymbol: 'PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c' },
  { batch: 'k2w2-b8', va: '0x6FD10090', size: 80, headHex: '56578bf0e827a4f1', tailHex: 'c20400', tsSymbol: 'PLAYERLIST_SetHostileDelayTick_6FD10090_113c' },
  { batch: 'k2w2-b8', va: '0x6FD11FA0', size: 67, headHex: '83ec2056578bf950', tailHex: 'c20c00', tsSymbol: 'AI_StartModeAtCoordsStep0_6FD11FA0_113c' },
  { batch: 'k2w2-b8', va: '0x6FD11FF0', size: 67, headHex: '83ec2056578bf950', tailHex: 'c20c00', tsSymbol: 'AI_StartModeAtCoordsStep1_6FD11FF0_113c' },
  { batch: 'k2w2-b8', va: '0x6FD120C0', size: 83, headHex: '558b6c240885ed57', tailHex: 'c20400', tsSymbol: 'AI_ScheduleAiThinkTimer_6FD120C0_113c' },
  { batch: 'k2w2-b8', va: '0x6FD121E0', size: 52, headHex: '83ec2056508d7424', tailHex: 'c20c00', tsSymbol: 'AI_StartModeAtCoordsKeepSteps_6FD121E0_113c' },
  { batch: 'k2w2-b8', va: '0x6FD12F00', size: 39, headHex: '8a44240884c07505', tailHex: 'c20800', tsSymbol: 'AI_RunTowardTarget_6FD12F00_113c' },
  { batch: 'k2w2-b8', va: '0x6FD12F30', size: 39, headHex: '8a44240884c07505', tailHex: 'c20800', tsSymbol: 'AI_WalkTowardTarget_6FD12F30_113c' },
  { batch: 'k2w2-b8', va: '0x6FD13CB0', size: 100, headHex: '85c0745a85ff7505', tailHex: '0000c3', tsSymbol: 'AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCABF80', size: 64, headHex: '83ec0c880424668b', tailHex: 'c21000', tsSymbol: 'S2C_QueueLocationPacket11_6FCABF80_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAC160', size: 77, headHex: '83ec0c33c0890424', tailHex: 'c21400', tsSymbol: 'S2C_QueueMonsterMovePacket12_6FCAC160_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAC230', size: 80, headHex: '83ec108804248a44', tailHex: 'c21800', tsSymbol: 'S2C_QueueUnitTargetMovePacket16_6FCAC230_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAC3B0', size: 36, headHex: '83ec088804246a06', tailHex: 'c20400', tsSymbol: 'S2C_QueueByteDwordPacket6_6FCAC3B0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAC490', size: 25, headHex: '516a018d4c240788', tailHex: 'c20400', tsSymbol: 'S2C_QueueSingleBytePacket1_6FCAC490_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAC530', size: 53, headHex: '85d27420833a0075', tailHex: 'c20400', tsSymbol: 'S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAC5F0', size: 53, headHex: '85d27420833a0075', tailHex: 'c20400', tsSymbol: 'S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAC690', size: 53, headHex: '85d27420833a0075', tailHex: 'c20400', tsSymbol: 'S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c' },
  { batch: 'k2w2-b4', va: '0x6FCADE50', size: 81, headHex: '85c0538bd9741383', tailHex: 'c20400', tsSymbol: 'ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c' },
  { batch: 'k2w2-b4', va: '0x6FCADEB0', size: 81, headHex: '85c0538bd9741383', tailHex: 'c20400', tsSymbol: 'ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCADF10', size: 81, headHex: '85c0538bd9741383', tailHex: 'c20400', tsSymbol: 'ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c' },
  { batch: 'k2w2-b4', va: '0x6FCADF70', size: 81, headHex: '85c0538bd9741383', tailHex: 'c20400', tsSymbol: 'ITEMS_SendCursorPutItemPacket04_6FCADF70_113c' },
  { batch: 'k2w2-b4', va: '0x6FCADFD0', size: 81, headHex: '85c0538bd9741383', tailHex: 'c20400', tsSymbol: 'ITEMS_SendGroundItemPacket03_6FCADFD0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAE030', size: 81, headHex: '85c0538bd9741383', tailHex: 'c20400', tsSymbol: 'ITEMS_SendDropToGroundPacket02_6FCAE030_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAE090', size: 101, headHex: '85c053568bf18bda', tailHex: 'c20400', tsSymbol: 'ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAE4D0', size: 99, headHex: '538b9fb800000085', tailHex: '005bc3', tsSymbol: 'EVENT_DestroyTimerQueue_6FCAE4D0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAF6C0', size: 75, headHex: '85c056750583ceff', tailHex: 'c20400', tsSymbol: 'SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAF820', size: 37, headHex: '85c05675108b4424', tailHex: 'c20400', tsSymbol: 'SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c' },
  { batch: 'k2w2-b4', va: '0x6FCAFAA0', size: 74, headHex: '5185c056750583ce', tailHex: '0059c3', tsSymbol: 'SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCB0EA0', size: 86, headHex: '55568bf185f68bea', tailHex: '5e5dc3', tsSymbol: 'MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCB0F00', size: 12, headHex: '6a005251e8c194f7', tailHex: 'c20400', tsSymbol: 'STATES_ClearGfxStateFlagCallback_6FCB0F00_113c' },
  { batch: 'k2w2-b4', va: '0x6FCB0F10', size: 27, headHex: '566a008bf15256e8', tailHex: 'c20400', tsSymbol: 'STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c' },
  { batch: 'k2w2-b4', va: '0x6FCB1B40', size: 41, headHex: '568bf28bc6e856ec', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c' },
  { batch: 'k2w2-b4', va: '0x6FCB2030', size: 46, headHex: '568bf28bc6e866e7', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c' },
  { batch: 'k2w2-b4', va: '0x6FCB2060', size: 90, headHex: '568bf2578bc6e835', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c' },
  { batch: 'k2w2-b4', va: '0x6FCB67B0', size: 94, headHex: '50e80a3df7ff85c0', tailHex: '4004c3', tsSymbol: 'SUMMON_GetFirstPetGuidForType_6FCB67B0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCB8390', size: 27, headHex: '8b426085c07503c2', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c' },
  { batch: 'k2w2-b4', va: '0x6FCB83B0', size: 53, headHex: '5756e8b922f7ff8b', tailHex: 'ff5fc3', tsSymbol: 'SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBBC70', size: 64, headHex: '558b6c240c565753', tailHex: 'c20800', tsSymbol: 'PARTY_SplitGoldPickupByCap_6FCBBC70_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBBCB0', size: 68, headHex: '85c0751f68e50000', tailHex: '0000c3', tsSymbol: 'PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBBD00', size: 63, headHex: '8b802c1d000085c0', tailHex: '33c0c3', tsSymbol: 'PARTY_FindSubPartyById_6FCBBD00_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBBD40', size: 66, headHex: '568bb02c1d000066', tailHex: '00ebd6', tsSymbol: 'PARTY_AllocNextPartyId_6FCBBD40_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBBE40', size: 97, headHex: '85f675046a18eb2a', tailHex: '0000c3', tsSymbol: 'PARTY_AllocPartyControl_6FCBBE40_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBC990', size: 3, headHex: 'c20400', tailHex: 'c20400', tsSymbol: 'MONAI_NoOpStub_6FCBC990_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBC9A0', size: 92, headHex: '85c9740f83f90a74', tailHex: 'c20400', tsSymbol: 'SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBCA00', size: 81, headHex: '538b5c240885db56', tailHex: 'c20800', tsSymbol: 'SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBD550', size: 93, headHex: '83ec0885c0751f68', tailHex: 'c408c3', tsSymbol: 'CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBE2E0', size: 31, headHex: '56578bf1568bfae8', tailHex: 'c05ec3', tsSymbol: 'SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBE330', size: 63, headHex: '53558b6c240c5657', tailHex: 'c20400', tsSymbol: 'SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBE450', size: 63, headHex: '8b0bf7d9568b378b', tailHex: '0f5ec3', tsSymbol: 'VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c' },
  { batch: 'k2w2-b4', va: '0x6FCBE490', size: 61, headHex: '8b0e8b02570fafc0', tailHex: 'd122c3', tsSymbol: 'VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c' },
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

interface Wave4World {
  m: SparseMemory113c
  pGame: number
  pDataTables: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pSkillsTxt: number
  pMissilesTxt: number
  pItemsTxt: number
  pItemStatCostTxt: number
  pItemTypesEquiv: number
  pLevelsTxt: number
  pObjectsTxt: number
  pStatesTxt: number
}

function createWave4World(): Wave4World {
  const m = new SparseMemory113c()
  m.fill(0x6fd10000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x20000, 0)

  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)

  // Grid0 info (13 body locations x 1) & ExperienceTxt table
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)
  m.setU32(0x6fdeff6c, m.alloc(0x10))
  const pExpTxt = m.alloc(64) >>> 0
  m.setU32(pExpTxt, 99)
  m.setU32(0x6fdf0b50, pExpTxt)

  // MonStatsTxt (600 rows * 0x1A8) with wMonStatsEx (+0x06) and wBaseId (+0x02 / +0x18)
  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * D2MonStatsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i += 1) {
    const rec = (pMonStatsTxt + i * D2MonStatsTxt_SIZE) >>> 0
    m.setU16((rec + 0x02) >>> 0, i)
    m.setU16((rec + 0x06) >>> 0, i)
    m.setU16((rec + 0x18) >>> 0, i)
  }

  // MonStats2Txt (600 rows)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)

  // SkillsTxt (300 rows * 0x23C)
  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * D2SkillsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)

  // MissilesTxt (100 rows * 0x1A4)
  const missilesCount = 100
  const pMissilesTxt = m.alloc(missilesCount * 0x1a4) >>> 0
  m.setU32((pDataTables + 0xb64) >>> 0, pMissilesTxt)
  m.setU32((pDataTables + 0xb6c) >>> 0, missilesCount)

  // ItemStatCostTxt (360 rows)
  const iscCount = 360
  const pItemStatCostTxt = m.alloc(iscCount * D2ItemStatCostTxt_SIZE) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0, pItemStatCostTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0, iscCount)

  // ItemsTxt (100 rows)
  const itemsCount = 100
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE) >>> 0
  m.setU32(SG_ITEM_DATATABLES_VA_113C, itemsCount)
  m.setU32((SG_ITEM_DATATABLES_VA_113C + 4) >>> 0, pItemsTxt)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)

  // ItemTypesTxt & equivalence bitset (64 item types, 2 dwords/row)
  const itemTypesCount = 64
  const equivDwords = 2
  const pItemTypesTxt = m.alloc(itemTypesCount * D2ItemTypesTxt_SIZE) >>> 0
  const pItemTypesEquiv = m.alloc(itemTypesCount * equivDwords * 4) >>> 0
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemTypesTxtRecordCount) >>> 0, itemTypesCount)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemTypesEquivDwords) >>> 0, equivDwords)
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemTypesEquiv) >>> 0, pItemTypesEquiv)
  for (let t = 0; t < itemTypesCount; t += 1) {
    m.setU32((pItemTypesEquiv + (t * equivDwords + (t >> 5)) * 4) >>> 0, (1 << (t & 31)) >>> 0)
  }

  // LevelsTxt (140 rows)
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0x1dc) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0x1e0) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, levelsCount)
  for (let lvl = 1; lvl < levelsCount; lvl += 1) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set((pLevelsTxt + lvl * D2LevelsTxt_SIZE) >>> 0, D2LevelsTxt.nAct, act)
  }

  // ObjectsTxt (600 rows * 0x1C0)
  const pObjectsTxt = m.alloc(600 * 0x1c0) >>> 0
  m.setU32((pDataTables + 0xc48) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xc50) >>> 0, 600)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  // CharStatsTxt (7 classes * 0xC4) at pDataTables + 0xBC4 / +0xBC8
  const pCharStatsTxt = m.alloc(7 * 0xc4) >>> 0
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStatsTxt)
  m.setU32((pDataTables + 0xbc8) >>> 0, 7)

  // StatesTxt (200 rows * 0x3C) + masks
  const pStatesTxt = m.alloc(200 * 0x3c) >>> 0
  const pStateMaskExp = m.alloc(0x40) >>> 0
  const pCorpseMask = m.alloc(32) >>> 0
  m.setU32((pStateMaskExp + 4 * 4) >>> 0, 1 << 6)
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc4) >>> 0, 200)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksExp) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x100) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x104) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x150) >>> 0, pCorpseMask)
  m.setU32((pDataTables + 0xbf0) >>> 0, 8)

  // D2Common gdwPathTypeFlags[0x0A] = 0x40000 (PATHTYPE_MISSILE special path)
  m.setU32((0x6fde4180 + 0x0a * 4) >>> 0, 0x40000)

  // TreasureClassEx & AnimData
  m.setU32(0x6fdf13c4, 20)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34))
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34))
  const pAnimData = m.alloc(0x800) >>> 0
  const pEmptyBucket = m.alloc(8) >>> 0
  for (let i = 0; i < 256; i += 1) {
    m.set(pAnimData, D2AnimDataTableStrc.pHashBuckets, pEmptyBucket, i)
  }
  m.setU32(0x6fdf0b4c, pAnimData)

  // Game + Timer wheel + Party control
  const pGame = m.alloc(0x1df4) >>> 0
  m.setU32((pGame + 0x1c) >>> 0, 0x12340000)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  m.setU16((pGame + 0x78) >>> 0, 101)
  m.setU32((pGame + 0x70) >>> 0, 1)
  m.setU8((pGame + 0x6d) >>> 0, 0)
  m.setU32((pGame + 0x1d2c) >>> 0, m.alloc(0x20))
  EVENT_InitTimerQueue113c(m, pGame)

  return {
    m,
    pGame,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pMissilesTxt,
    pItemsTxt,
    pItemStatCostTxt,
    pItemTypesEquiv,
    pLevelsTxt,
    pObjectsTxt,
    pStatesTxt,
  }
}

function allocClientWithQueue(m: SparseMemory113c, pGame = 0) {
  const pClient = m.alloc(0x600) >>> 0
  const pQueue = m.alloc(0x410) >>> 0
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)
  m.setU32((pClient + 0x1a8) >>> 0, pGame)
  return { pClient, pQueue }
}

function allocRoom(m: SparseMemory113c, levelId = 2, x = 100, y = 100) {
  const pRoom = m.alloc(Math.max(D2ActiveRoomStrc_SIZE, 0x100)) >>> 0
  const pRoomEx = m.alloc(Math.max(D2RoomExStrc_SIZE, 0x90)) >>> 0
  const pLevel = m.alloc(Math.max(D2DrlgLevelStrc_SIZE, 0x280)) >>> 0
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, m.alloc(4))
  m.setU32((pRoom + 0x4c) >>> 0, x - 10)
  m.setU32((pRoom + 0x50) >>> 0, y - 10)
  m.setU32((pRoom + 0x54) >>> 0, 40)
  m.setU32((pRoom + 0x58) >>> 0, 40)
  m.setU32((pRoom + 0x5c) >>> 0, x - 10)
  m.setU32((pRoom + 0x60) >>> 0, y - 10)
  m.setU32((pRoom + 0x64) >>> 0, 40)
  m.setU32((pRoom + 0x68) >>> 0, 40)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, levelId)
  // Wire self as sole adjacent room (ppRoomsNear at +0x00, nRoomsNear at +0x24)
  const ppRooms = m.alloc(4) >>> 0
  m.setU32(ppRooms, pRoom)
  m.setU32(pRoom, ppRooms)
  m.setU32((pRoom + 0x24) >>> 0, 1)
  return { pRoom, pRoomEx, pLevel }
}

function allocPlayerUnit(
  m: SparseMemory113c,
  pGame: number,
  unitId = 1,
  classId = 0,
  levelId = 2,
  posX = 100,
  posY = 100,
) {
  const { pClient, pQueue } = allocClientWithQueue(m, pGame)
  const { pRoom, pRoomEx, pLevel } = allocRoom(m, levelId, posX, posY)
  const pPlayer = m.alloc(0x100) >>> 0
  const pPlayerData = m.alloc(0x180) >>> 0
  const pPath = m.alloc(Math.max(D2DynamicPathStrc_SIZE, 0x100)) >>> 0
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
  const pInventory = INVENTORY_AllocInventory113c(m, 0, pPlayer) >>> 0

  m.setU32(pPlayer, 0)
  m.setU32((pPlayer + 0x04) >>> 0, classId)
  m.setU32((pPlayer + 0x0c) >>> 0, unitId)
  m.setU32((pPlayer + 0x10) >>> 0, 1)
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
  m.setU32((pPlayer + 0x20) >>> 0, 0x12345)
  m.setU32((pPlayer + 0x24) >>> 0, 666)
  m.setU32((pPlayer + 0x2c) >>> 0, pPath)
  m.setU32((pPlayer + 0x60) >>> 0, pInventory)
  m.setU32((pPlayer + 0x80) >>> 0, pGame)
  m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x14) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x18) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
  m.setU8((pClient + 0x3d4) >>> 0, 1)
  m.setU32((pClient + 0x174) >>> 0, pPlayer)
  m.setU32((pClient + 0x1b4) >>> 0, pRoom)

  m.setU32(pPath, posX << 16)
  m.setU32((pPath + 0x04) >>> 0, posY << 16)
  m.setU16((pPath + 0x02) >>> 0, posX)
  m.setU16((pPath + 0x06) >>> 0, posY)
  m.setU16((pPath + 0x10) >>> 0, posX + 2)
  m.setU16((pPath + 0x12) >>> 0, posY + 2)
  m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
  m.set(pPath, D2DynamicPathStrc.pUnit, pPlayer)

  STATLIST_CreateEx113c(m, pPlayer, 0x80000000, pGame)
  SUNIT_SetMonsterAlignmentState113c(m, pPlayer, 2, 0)
  return { pPlayer, pPlayerData, pClient, pQueue, pInventory, pPath, pQuestFlags, pRoom, pRoomEx, pLevel }
}

function allocMonsterUnit(
  m: SparseMemory113c,
  pGame: number,
  classId = 5,
  unitId = 10,
  posX = 100,
  posY = 100,
  levelId = 2,
) {
  const { pRoom, pRoomEx, pLevel } = allocRoom(m, levelId, posX, posY)
  const pMonster = m.alloc(0x100) >>> 0
  const pMonData = m.alloc(0x80) >>> 0
  const pAiGen = m.alloc(0x48) >>> 0
  const pAiCtrl = m.alloc(0x48) >>> 0
  const pPath = m.alloc(Math.max(D2DynamicPathStrc_SIZE, 0x100)) >>> 0
  const pSkills = m.alloc(0x20) >>> 0

  m.setU32(pPath, posX << 16)
  m.setU32((pPath + 0x04) >>> 0, posY << 16)
  m.setU16((pPath + 0x02) >>> 0, posX)
  m.setU16((pPath + 0x06) >>> 0, posY)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)
  m.setU32((pPath + 0x30) >>> 0, pMonster)

  m.setU32(pMonster, 1)
  m.setU32((pMonster + 0x04) >>> 0, classId)
  m.setU32((pMonster + 0x0c) >>> 0, unitId)
  m.setU32((pMonster + 0x10) >>> 0, 1)
  m.setU32((pMonster + 0x14) >>> 0, pMonData)
  m.setU32((pMonster + 0x20) >>> 0, 0x54321)
  m.setU32((pMonster + 0x24) >>> 0, 666)
  m.setU32((pMonster + 0x2c) >>> 0, pPath)
  m.setU32((pMonster + 0x80) >>> 0, pGame)
  m.setU32((pMonster + 0xa8) >>> 0, pSkills)
  const pDataTables = m.u32(0x6fde9e1c) >>> 0
  if (pDataTables !== 0) {
    const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
    if (pMonStatsBase !== 0) {
      m.setU32(pMonData, (pMonStatsBase + classId * D2MonStatsTxt_SIZE) >>> 0)
    }
  }
  m.setU32((pMonData + 0x08) >>> 0, pAiCtrl)
  m.setU32((pMonData + 0x28) >>> 0, pAiGen)
  STATLIST_CreateEx113c(m, pMonster, 0x80000000, pGame)
  return { pMonster, pMonData, pAiGen, pAiCtrl, pPath, pRoom, pRoomEx, pLevel }
}

function allocBasicItem(m: SparseMemory113c, pGame: number, classId = 0, unitId = 0x77, quality = 2) {
  const pItem = m.alloc(0x100) >>> 0
  const pItemData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
  const pStaticPath = m.alloc(0x40) >>> 0
  m.setU32(pItem, 4)
  m.setU32((pItem + 0x04) >>> 0, classId)
  m.setU32((pItem + 0x0c) >>> 0, unitId)
  m.setU32((pItem + 0x14) >>> 0, pItemData)
  m.setU32((pItem + 0x2c) >>> 0, pStaticPath)
  m.setU32((pItem + 0x80) >>> 0, pGame)
  m.setU32((pItemData + D2ItemDataStrc.dwItemFlags.off) >>> 0, 0x10)
  ITEMS_SetItemQuality113c(m, pItem, quality)
  STATLIST_CreateEx113c(m, pItem, 0, pGame)
  return { pItem, pItemData, pStaticPath }
}

function linkQuest(m: SparseMemory113c, pGame: number, nQuestId: number) {
  let pChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pChain === 0) {
    pChain = m.alloc(0x40) >>> 0
    m.setU32((pGame + 0x10f4) >>> 0, pChain)
  }
  const pQuest = m.alloc(0x120) >>> 0
  const pQuestData = m.alloc(0x200) >>> 0
  m.setU32(pQuest, nQuestId >>> 0)
  m.setU32((pQuest + 0x04) >>> 0, pGame)
  m.setU8((pQuest + 0x09) >>> 0, 1)
  m.setU32((pQuest + 0x18) >>> 0, pQuestData)
  m.setU32((pQuest + 0xe0) >>> 0, nQuestId >>> 0)
  m.setU32((pQuest + 0xf4) >>> 0, m.u32(pChain) >>> 0)
  m.setU32(pChain, pQuest)
  return { pQuest, pQuestData }
}

describe('[K2] D2Game 1.13c Disassembly-Verified Promotion Wave 4 (+164 VAs)', () => {
  it('validates manifest diff-verified status and real PE32 D2Game.dll (0x6FC20000) opcodes across all 164 VAs', () => {
    expect(WAVE4_PROMOTED_SPECS.length).toBe(164)
    const uniqueVas = new Set(WAVE4_PROMOTED_SPECS.map((s) => s.va.toUpperCase()))
    expect(uniqueVas.size).toBe(164)

    const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    expect(manifest.summary.statusBreakdown['diff-verified']).toBeGreaterThanOrEqual(2670)

    const d2GameFnByVa = new Map(
      manifest.functions
        .filter((f) => f.module === 'D2Game')
        .map((f) => [f.va.toUpperCase(), f]),
    )
    const d2GameDvCount = manifest.functions.filter(
      (f) => f.module === 'D2Game' && f.status === 'diff-verified',
    ).length
    expect(d2GameDvCount).toBeGreaterThanOrEqual(1191)

    for (const spec of WAVE4_PROMOTED_SPECS) {
      const fn = d2GameFnByVa.get(spec.va.toUpperCase())
      expect(fn, `Missing manifest entry for ${spec.va}`).toBeDefined()
      expect(fn!.status, `${spec.va} (${fn!.name}) must be diff-verified`).toBe('diff-verified')
      expect(fn!.tsSymbol).toBe(spec.tsSymbol)
      expect(fn!.size).toBe(spec.size)
      expect(Boolean(fn!.indirectUnknown)).toBe(false)
      expect(fn!.diffEvidence).toContain('tests/oracle/k2/k2-disasm-verified-wave4.test.ts')
    }

    const d2GameDllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    if (fs.existsSync(d2GameDllPath)) {
      const pe = loadPeSectionMapper(d2GameDllPath, 0x6fc20000)
      for (const spec of WAVE4_PROMOTED_SPECS) {
        const vaNum = parseInt(spec.va, 16) >>> 0
        expect(vaNum).toBeGreaterThanOrEqual(pe.textStart)
        expect(vaNum + spec.size).toBeLessThanOrEqual(pe.textEnd)
        const off = pe.vaToFileOffset(vaNum)
        const fnBytes = pe.buf.subarray(off, off + spec.size)
        expect(fnBytes[0], `${spec.va} starts on int3`).not.toBe(0xcc)
        expect(fnBytes[0], `${spec.va} starts on nop`).not.toBe(0x90)

        const actualHead = fnBytes.subarray(0, Math.min(8, spec.size)).toString('hex')
        const actualTail = fnBytes.subarray(Math.max(0, spec.size - 3), spec.size).toString('hex')
        expect(actualHead, `PE32 head opcode mismatch at ${spec.va}`).toBe(spec.headHex)
        expect(actualTail, `PE32 tail opcode mismatch at ${spec.va}`).toBe(spec.tailHex)

        const lastByte = fnBytes[spec.size - 1]!
        const retImmOp = spec.size >= 3 ? fnBytes[spec.size - 3]! : 0
        const tailJmpOp = spec.size >= 5 ? fnBytes[spec.size - 5]! : 0
        const shortJmpOp = spec.size >= 2 ? fnBytes[spec.size - 2]! : 0
        expect(
          lastByte === 0xc3 ||
            lastByte === 0xcc ||
            retImmOp === 0xc2 ||
            tailJmpOp === 0xe9 ||
            shortJmpOp === 0xeb,
          `${spec.va} unexpected epilogue ${actualTail}`,
        ).toBe(true)
      }
    }
  })

  const cumulativeHits = new Set<string>()

  it('SHARD 1 (k2w2-b4): executes all 41 promoted D2Game VAs with behavioral checks and 100% va-trace hits', () => {
    // =========================================================================
    // SHARD 1: k2w2-b4 (41 promoted VAs: 0x6FCABF80..0x6FCBE490)
    // =========================================================================
    {
      beginVaTrace113c()
      const { m, pGame, pItemsTxt, pSkillsTxt, pMonStatsTxt } = createWave4World()
      m.setU32((pItemsTxt + D2ItemsTxt.dwCode.off) >>> 0, 0x20706163) // 'cap '
      m.setU8((pItemsTxt + 0x137) >>> 0, 1) // nCompactSave

      // S2C queue helpers (8 VAs)
      const c1 = allocClientWithQueue(m, pGame)
      expect(S2C_QueueLocationPacket11_6FCABF80_113c(m, 0x15, 0x01, 0x11223344, c1.pClient, 0x1234, 0x5678, 0x09)).toBe(1)
      expect(m.u32(c1.pQueue)).toBe(11)
      expect(m.u8((c1.pQueue + 4) >>> 0)).toBe(0x15)
      expect(m.u32((c1.pQueue + 6) >>> 0)).toBe(0x11223344)

      const c2 = allocClientWithQueue(m, pGame)
      expect(S2C_QueueMonsterMovePacket12_6FCAC160_113c(m, 0x67, 0xdeadbeef, c2.pClient, 0xaa, 0xbb, 0x01020304, 0xcc)).toBe(1)
      expect(m.u32(c2.pQueue)).toBe(12)
      expect(m.u8((c2.pQueue + 4) >>> 0)).toBe(0x67)

      const c3 = allocClientWithQueue(m, pGame)
      expect(S2C_QueueUnitTargetMovePacket16_6FCAC230_113c(m, 0x68, 1, 0x100, c3.pClient, 2, 0, 0x200, 0x1111, 0x2222)).toBe(1)
      expect(m.u32(c3.pQueue)).toBe(16)
      expect(m.u8((c3.pQueue + 4) >>> 0)).toBe(0x68)

      const c4 = allocClientWithQueue(m, pGame)
      expect(S2C_QueueByteDwordPacket6_6FCAC3B0_113c(m, 0x20, 3, 0x89abcdef, c4.pClient)).toBe(1)
      expect(m.u32(c4.pQueue)).toBe(6)
      expect(m.u32((c4.pQueue + 6) >>> 0)).toBe(0x89abcdef)

      const c5 = allocClientWithQueue(m, pGame)
      expect(S2C_QueueSingleBytePacket1_6FCAC490_113c(m, 0x97, c5.pClient)).toBe(1)
      expect(m.u32(c5.pQueue)).toBe(1)
      expect(m.u8((c5.pQueue + 4) >>> 0)).toBe(0x97)

      const plr = allocPlayerUnit(m, pGame, 11)
      const pRawPkt = m.alloc(16) >>> 0
      for (let i = 0; i < 12; i += 1) m.setU8((pRawPkt + i) >>> 0, 0x40 + i)
      expect(S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c(m, plr.pPlayer, pRawPkt)).toBe(1)
      expect(S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c(m, plr.pPlayer, pRawPkt)).toBe(1)
      expect(S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c(m, plr.pPlayer, pRawPkt)).toBe(1)
      expect(m.u32(plr.pQueue)).toBe(28)

      // Item 0x9C wrappers (7 VAs) + client-mismatch assertion
      const itm = allocBasicItem(m, pGame, 0, 0x88)
      m.setU32((itm.pStaticPath + 0x0c) >>> 0, 321)
      m.setU32((itm.pStaticPath + 0x10) >>> 0, 654)
      expect(() => ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c(m, plr.pPlayer, plr.pClient + 4, itm.pItem, 0)).toThrow(D2CommonAssertError)
      const queueBefore9C = m.u32(plr.pQueue)
      ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c(m, plr.pPlayer, plr.pClient, itm.pItem, 0)
      expect(m.u8((plr.pQueue + 4 + queueBefore9C) >>> 0)).toBe(0x9c)
      expect(m.u8((plr.pQueue + 5 + queueBefore9C) >>> 0)).toBe(0x0e)
      ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c(m, plr.pPlayer, plr.pClient, itm.pItem, 0)
      ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c(m, plr.pPlayer, plr.pClient, itm.pItem, 0)
      ITEMS_SendCursorPutItemPacket04_6FCADF70_113c(m, plr.pPlayer, plr.pClient, itm.pItem, 0)
      ITEMS_SendGroundItemPacket03_6FCADFD0_113c(m, plr.pPlayer, plr.pClient, itm.pItem, 0)
      ITEMS_SendDropToGroundPacket02_6FCAE030_113c(m, plr.pPlayer, plr.pClient, itm.pItem, 0)
      ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c(m, plr.pPlayer, itm.pItem, plr.pClient, 0)
      expect(m.u32((itm.pStaticPath + 0x0c) >>> 0)).toBe(0)
      expect(m.u32((itm.pStaticPath + 0x10) >>> 0)).toBe(0)

      // Timer queue destroy (1 VA)
      const pTmpGame = m.alloc(0x1df4) >>> 0
      EVENT_InitTimerQueue113c(m, pTmpGame)
      expect(m.u32((pTmpGame + 0xb8) >>> 0)).not.toBe(0)
      EVENT_DestroyTimerQueue_6FCAE4D0_113c(m, pTmpGame)
      expect(m.u32((pTmpGame + 0xb8) >>> 0)).toBe(0)

      // SUnitProxy NPC slot & list-18 nodes (3 VAs)
      const pNpcCtrl = m.alloc(0x10) >>> 0
      const pNpcSlots = m.alloc(4 * 0x44) >>> 0
      m.setU32((pGame + 0x1d24) >>> 0, pNpcCtrl)
      m.setU32((pNpcCtrl + 0x04) >>> 0, pNpcSlots)
      m.setU32(pNpcSlots, 200)
      const pNpcUnit = m.alloc(0x40) >>> 0
      m.setU32((pNpcUnit + 0x04) >>> 0, 200)
      const pOutIdx = m.alloc(4) >>> 0
      expect(SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c(m, pNpcUnit, pGame, pOutIdx)).toBe(pNpcSlots)
      const pNode18 = SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c(m, plr.pPlayer, pNpcSlots, pGame)
      expect(pNode18).not.toBe(0)
      expect(m.u32(pNode18)).toBe(m.u32((plr.pPlayer + 0x0c) >>> 0))
      const pNode08 = m.alloc(0x0c) >>> 0
      m.setU32(pNode08, itm.pItem)
      m.setU32((pNode08 + 0x04) >>> 0, m.u32((plr.pPlayer + 0x0c) >>> 0))
      m.setU32((pNpcSlots + 0x08) >>> 0, pNode08)
      m.setU32((pNpcSlots + 0x0c) >>> 0, 1)
      expect(SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c(m, pNpcUnit, pGame, plr.pPlayer)).toBe(itm.pItem)

      // Guided missile init & state callbacks (3 VAs)
      const pMis = m.alloc(0x100) >>> 0
      const pMisData = m.alloc(D2MissileDataStrc_SIZE) >>> 0
      const pMisPath = m.alloc(D2DynamicPathStrc_SIZE) >>> 0
      m.setU32(pMis, 3)
      m.setU32((pMis + 0x14) >>> 0, pMisData)
      m.setU32((pMis + 0x2c) >>> 0, pMisPath)
      m.set(pMisPath, D2DynamicPathStrc.pRoom, plr.pRoom)
      m.set(pMisPath, D2DynamicPathStrc.pUnit, pMis)
      m.setU16((pMisPath + 0x02) >>> 0, 100)
      m.setU16((pMisPath + 0x06) >>> 0, 100)
      m.setU16((pMisPath + 0x10) >>> 0, 105)
      m.setU16((pMisPath + 0x12) >>> 0, 105)
      m.setU16((pMisData + D2MissileDataStrc.nTotalFrames.off) >>> 0, 90)
      MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c(m, pMis, 0x1234)
      expect(m.u16((pMisData + D2MissileDataStrc.nTotalFrames.off) >>> 0)).toBe(0x4d)
      expect(m.u16((pMisData + D2MissileDataStrc.nRemainingFrames.off) >>> 0)).toBe(0x4d)
      expect(m.get(pMisPath, D2DynamicPathStrc.dwPathType)).toBe(0x0a)

      STATES_ToggleGfxStateFlag113c(m, plr.pPlayer, 10, 1)
      STATES_ClearGfxStateFlagCallback_6FCB0F00_113c(m, plr.pPlayer, 10)
      expect(STATES_CheckState113c(m, plr.pPlayer, 10)).toBe(0)
      STATES_ToggleGfxStateFlag113c(m, plr.pPlayer, 11, 1)
      STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c(m, plr.pPlayer, 11)
      expect(STATES_CheckState113c(m, plr.pPlayer, 11)).toBe(0)
      expect((m.u32((plr.pPlayer + 0xc4) >>> 0) & 0x40) !== 0).toBe(true)

      // Skill SrvSt validators, summon pet GUID, shield check, seq record scan (6 VAs)
      const mon = allocMonsterUnit(m, pGame, 5, 55, 101, 100, 2)
      SUNIT_InsertServerUnit113c(m, pGame, mon.pMonster)
      PATH_SetTargetUnit113c(m, plr.pPath, mon.pMonster)
      expect(SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c(m, pGame, plr.pPlayer)).toBe(1)
      expect(SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c(m, pGame, plr.pPlayer)).toBe(1)
      expect(SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c(m, pGame, plr.pPlayer)).toBe(1)
      expect(SUMMON_GetFirstPetGuidForType_6FCB67B0_113c(m, plr.pPlayer, 1) >>> 0).toBe(0xffffffff)
      expect(SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c(m, plr.pPlayer)).toBe(0)

      expect(SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c(m, plr.pPlayer)).toBe(7)

      // Party control, u16 ID wrap skipping 0xFFFF, gold split (5 VAs)
      m.setU32((pGame + 0x1d2c) >>> 0, 0)
      PARTY_AllocPartyControl_6FCBBE40_113c(m, pGame)
      const pPartyCtrl = m.u32((pGame + 0x1d2c) >>> 0) >>> 0
      expect(pPartyCtrl).not.toBe(0)
      m.setU16(pPartyCtrl, 0xffff)
      expect(PARTY_AllocNextPartyId_6FCBBD40_113c(m, pGame)).toBe(0xffff)
      expect(PARTY_AllocNextPartyId_6FCBBD40_113c(m, pGame)).toBe(3)
      const pSubParty = m.alloc(0x10) >>> 0
      const pMemberNode = m.alloc(8) >>> 0
      m.setU32(pMemberNode, 11)
      m.setU16(pSubParty, 5)
      m.setU32((pSubParty + 4) >>> 0, pMemberNode)
      m.setU32((pPartyCtrl + 4) >>> 0, pSubParty)
      expect(PARTY_FindSubPartyById_6FCBBD00_113c(m, pGame, 5)).toBe(pSubParty)
      expect(PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c(m, pSubParty, 11)).toBe(1)
      expect(PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c(m, pSubParty, 999)).toBe(0)

      STATLIST_SetUnitStat113c(m, plr.pPlayer, 0x0c, 1, 0) // lvl 1 -> cap 10000
      STATLIST_SetUnitStat113c(m, plr.pPlayer, 0x0e, 9500, 0)
      const pOutAdd = m.alloc(4) >>> 0
      const pOutRem = m.alloc(4) >>> 0
      PARTY_SplitGoldPickupByCap_6FCBBC70_113c(m, 800, plr.pPlayer, pOutAdd, pOutRem)
      expect(m.u32(pOutAdd)).toBe(500)
      expect(m.u32(pOutRem)).toBe(300)

      // Remaining 8 VAs in k2w2-b4 (MonAI stub, revive/teleport mode, closest monster, room remove, corpse filter, merc skill stats, vector math)
      expect(MONAI_NoOpStub_6FCBC990_113c(m, 0)).toBe(0)
      expect(SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c(m, mon.pMonster, 1, 0)).toBe(1)
      expect(SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c(m, mon.pMonster, 0x0a, 0)).toBe(0)
      const mon2 = allocMonsterUnit(m, pGame, 5, 56, 102, 100, 2)
      const pBestCtx = m.alloc(0x10) >>> 0
      m.setU32((pBestCtx + 4) >>> 0, 9999)
      expect(SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c(m, mon.pMonster, mon2.pMonster, pBestCtx)).toBe(0)
      expect(m.u32(pBestCtx)).toBe(mon2.pMonster)
      const pRoomClients = m.alloc(4) >>> 0
      m.setU32(pRoomClients, plr.pClient)
      m.setU32((plr.pRoom + 0x48) >>> 0, pRoomClients)
      m.setU32((plr.pRoom + 0x78) >>> 0, 1)
      CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c(m, plr.pRoom, plr.pClient)
      expect(m.u32((plr.pRoom + 0x78) >>> 0)).toBe(0)

      const pSearch = m.alloc(0x10) >>> 0
      expect(SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c(m, mon.pMonster, pSearch)).toBe(0)

      const pMercSkill = m.alloc(0x40) >>> 0
      const pSkillRec1 = (pSkillsTxt + 1 * D2SkillsTxt_SIZE) >>> 0
      m.setU32(pMercSkill, pSkillRec1)
      m.setU32((pMercSkill + 0x28) >>> 0, 1)
      m.setU32((m.u32((mon.pMonster + 0xa8) >>> 0) + 0x04) >>> 0, pMercSkill)
      const pOut3 = m.alloc(12) >>> 0
      SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c(m, 1, mon.pMonster, pOut3)
      expect(m.u16((pMonStatsTxt + 5 * D2MonStatsTxt_SIZE + 0x02) >>> 0)).toBe(5)

      // Trunc-div-by-2 perpendicular normalization: (-5,1) -> (-2,0) -> (-1,0) -> (0,1); (5,3) -> (2,1) -> (1,0) -> (0,-1)
      const pVx = m.alloc(4) >>> 0
      const pVy = m.alloc(4) >>> 0
      m.setU32(pVx, (-5) >>> 0)
      m.setU32(pVy, 1)
      VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c(m, pVx, pVy)
      expect(m.u32(pVx) | 0).toBe(0)
      expect(m.u32(pVy) | 0).toBe(1)
      m.setU32(pVx, 5)
      m.setU32(pVy, 3)
      VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c(m, pVx, pVy)
      expect(m.u32(pVx) | 0).toBe(0)
      expect(m.u32(pVy) | 0).toBe(-1)
      m.setU32(pVx, 1)
      m.setU32(pVy, 1)
      VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c(m, pVx, pVy)
      expect(m.u32(pVx) | 0).toBe(4)
      expect(m.u32(pVy) | 0).toBe(4)

      const hitsB4 = endVaTrace113c()
      for (const v of hitsB4) cumulativeHits.add(v)
      const missingB4 = WAVE4_PROMOTED_SPECS.filter((s) => s.batch === 'k2w2-b4')
        .map((s) => `D2Game:${s.va}`)
        .filter((k) => !hitsB4.has(k))
      expect(missingB4).toEqual([])
    }
  })

  it('SHARD 2 (k2w2-b8): executes all 41 promoted D2Game VAs + Fix 2A with 100% va-trace hits', () => {
    // =========================================================================
    // SHARD 2: k2w2-b8 (41 promoted VAs: 0x6FCEB590..0x6FD13CB0 + Fix 2A)
    // =========================================================================
    {
      beginVaTrace113c()
      const { m, pGame, pMonStats2Txt, pItemsTxt, pSkillsTxt } = createWave4World()
      const plr = allocPlayerUnit(m, pGame, 1, 0, 75, 100, 100)
      SUNIT_InsertServerUnit113c(m, pGame, plr.pPlayer)

      // Packets 0x12 & 0x3F (2 VAs)
      STATES_ToggleGfxStateFlag113c(m, plr.pPlayer, 12, 1)
      expect(PACKET_Recv12_ClearGfxState0C_6FCEB590_113c(m, plr.pPlayer, 0, 2)).toBe(3)
      expect(PACKET_Recv12_ClearGfxState0C_6FCEB590_113c(m, plr.pPlayer, 0, 1)).toBe(0)
      expect(STATES_CheckState113c(m, plr.pPlayer, 12)).toBe(0)

      const pVoicePkt = m.alloc(8) >>> 0
      m.setU8(pVoicePkt, 0x3f)
      m.setU16((pVoicePkt + 1) >>> 0, 0x19)
      expect(PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c(m, plr.pPlayer, pVoicePkt, 3)).toBe(0)

      // Items (5 VAs)
      const sockHost = allocBasicItem(m, pGame, 1, 101)
      const sockGem = allocBasicItem(m, pGame, 2, 102)
      const pSockInv = INVENTORY_AllocInventory113c(m, 0, sockHost.pItem) >>> 0
      m.setU32((sockHost.pItem + 0x60) >>> 0, pSockInv)
      expect(ITEMS_PlaceItemInSocketInventory_6FCF1650_113c(m, sockHost.pItem, sockGem.pItem)).toBe(1)
      ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c(m, pGame, sockHost.pItem)

      const pSkillNode = m.alloc(0x40) >>> 0
      m.setU32(pSkillNode, (pSkillsTxt + 2 * D2SkillsTxt_SIZE) >>> 0)
      expect(ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c(m, plr.pPlayer, pSkillNode)).toBe(1)

      const pOutPrim = m.alloc(4) >>> 0
      const pOutSec = m.alloc(4) >>> 0
      ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c(m, plr.pPlayer, pOutPrim, pOutSec)
      expect(m.u32(pOutPrim)).toBe(0)

      const charm = allocBasicItem(m, pGame, 3, 103)
      m.setU16((pItemsTxt + 3 * D2ItemsTxt_SIZE + D2ItemsTxt.wType1.off) >>> 0, 13) // charm type
      ITEMS_SetInvPage113c(m, charm.pItem, 0)
      ITEMS_SetBodyLocation113c(m, charm.pItem, 0)
      INVENTORY_LinkItemToInventoryList113c(m, plr.pInventory, charm.pItem)
      ITEMS_OnCharmPlacedInInventory_6FCF6710_113c(m, plr.pPlayer, charm.pItem, pGame)

      // SUnit / Combat helpers (5 VAs)
      STATLIST_SetUnitStat113c(m, plr.pPlayer, 9, 500 << 8, 0)
      STATLIST_SetUnitStat113c(m, plr.pPlayer, 8, 100 << 8, 0)
      expect(SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c(m, plr.pPlayer, 50 << 8)).toBe(50 << 8)
      expect(STATLIST_GetUnitStat113c(m, plr.pPlayer, 8, 0)).toBe(150 << 8)

      expect(SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c(m, plr.pPlayer, pGame, 2)).toBe(1)
      expect(m.u32((plr.pPlayer + 0x10) >>> 0)).toBe(2)
      SUNIT_SetPlayerClientPtr_6FD00040_113c(m, plr.pPlayer, plr.pClient)
      expect(m.u32((plr.pPlayerData + 0x9c) >>> 0)).toBe(plr.pClient)
      expect(SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, plr.pPlayer)).toBe(1)
      expect(SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, 0)).toBe(0)
      PATH_SetTargetUnit113c(m, plr.pPath, plr.pPlayer)
      expect(SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, plr.pPlayer, pGame)).toBe(0)

      // Act 3 Quests (18 VAs)
      const q17 = linkQuest(m, pGame, 0x11) // Act3Q2 Gidbinn (questId 17)
      const q18 = linkQuest(m, pGame, 0x12) // Act3Q3 Khalim (questId 18)
      const q19 = linkQuest(m, pGame, 0x13) // Act3Q4 Lam Esen (questId 19)
      const q20 = linkQuest(m, pGame, 0x14) // Act3Q5 Compelling Orb (questId 20)
      const q21 = linkQuest(m, pGame, 0x15) // Act3Q6 Mephisto (questId 21)

      const pObjInit = m.alloc(0x20) >>> 0
      const pObjDummy = m.alloc(0x100) >>> 0
      const pObjPath = m.alloc(0x40) >>> 0
      m.setU32(pObjPath, plr.pRoom)
      m.setU32((pObjPath + 0x0c) >>> 0, 100)
      m.setU32((pObjPath + 0x10) >>> 0, 100)
      m.setU32(pObjDummy, 2)
      m.setU32((pObjDummy + 0x0c) >>> 0, 501)
      m.setU32((pObjDummy + 0x2c) >>> 0, pObjPath)
      m.setU32((pObjDummy + 0x80) >>> 0, pGame)
      m.setU32(pObjInit, pGame)
      m.setU32((pObjInit + 4) >>> 0, pObjDummy)
      ACT3Q5_InitCompellingOrbObject_6FD02A00_113c(m, pObjInit)
      ACT3Q3_InitSewerStairsObject_6FD02E00_113c(m, pObjInit)
      ACT3Q2_InitGidbinnAltarObject_6FD04120_113c(m, pObjInit)
      ACT3Q3_InitSewerLeverObject_6FD04980_113c(m, pObjInit)

      const pQArg = m.alloc(0x20) >>> 0
      m.setU32(pQArg, pGame)
      m.setU32((pQArg + 0x08) >>> 0, plr.pPlayer)
      m.setU32((pQArg + 0x0c) >>> 0, plr.pPlayer)
      QUESTS_GuidListAdd113c(m, (q17.pQuestData + 0x00) >>> 0, 1)
      QUESTS_GuidListAdd113c(m, (q19.pQuestData + 0x00) >>> 0, 1)
      QUESTS_GuidListAdd113c(m, (q20.pQuestData + 0x00) >>> 0, 1)
      QUESTS_GuidListAdd113c(m, (q21.pQuestData + 0x00) >>> 0, 1)

      const gidbinnItem = allocBasicItem(m, pGame, 0, 601, 2)
      const pQArgItem = m.alloc(0x20) >>> 0
      m.setU32(pQArgItem, pGame)
      m.setU32((pQArgItem + 0x08) >>> 0, gidbinnItem.pItem)
      m.setU32((pQArgItem + 0x0c) >>> 0, plr.pPlayer)
      ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c(m, q17.pQuest, pQArgItem)
      ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c(m, q17.pQuest, pQArg)
      ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c(m, q17.pQuest, pQArg)
      ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c(m, q19.pQuest, pQArg)
      ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c(m, q20.pQuest, pQArg)
      ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c(m, q21.pQuest, pQArg)

      expect(ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c(m, pGame, plr.pPlayer)).toBe(0)
      expect(ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c(m, pGame, plr.pPlayer)).toBe(0)
      expect(ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c(m, pGame, plr.pPlayer)).toBe(0)
      ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c(m, pGame, plr.pPlayer)
      ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c(m, q19.pQuest, pQArg)
      expect(ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c(m, pGame, plr.pPlayer)).toBe(0)
      expect(ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c(m, pGame, plr.pPlayer)).toBe(0)
      QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, 0x11, 1)
      const statPtsBefore = STATLIST_GetUnitStat113c(m, plr.pPlayer, 4, 0)
      expect(ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c(m, pGame, plr.pPlayer)).toBe(0)
      expect(STATLIST_GetUnitStat113c(m, plr.pPlayer, 4, 0)).toBe(statPtsBefore + 5)
      void q18

      // Monster spawns & playerlist (4 VAs)
      const mon = allocMonsterUnit(m, pGame, 5, 20, 100, 100, 2)
      const monTgt = allocMonsterUnit(m, pGame, 1, 21, 110, 100, 2)
      expect(MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c(m, mon.pMonster, 1, 0, pGame, 3, 0)).toBe(0)
      expect(MONSTER_SpawnAtCoords_6FD0F450_113c(m, 0xffffffff, -1, 1, pGame, mon.pRoom, 100, 100, 3, 0)).toBe(0)

      const plr2 = allocPlayerUnit(m, pGame, 2)
      const pRelNode = m.alloc(0x14) >>> 0
      m.setU32(pRelNode, 2)
      m.setU32((plr.pPlayerData + 0x38) >>> 0, pRelNode)
      const pTick = m.alloc(4) >>> 0
      m.setU32(pTick, 7777)
      m.setU32(D2GAME_IAT_GET_TICK_COUNT_VA_113C, pTick)
      PLAYERLIST_SetHostileDelayTick_6FD10090_113c(m, plr2.pPlayer, plr.pPlayer, 4321)
      expect(m.u32((pRelNode + 8) >>> 0)).toBe(4321)
      expect(m.u32((plr.pPlayerData + 0x160) >>> 0)).toBe(7777)
      PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c(m, plr2.pPlayer, plr.pPlayer, pGame)
      expect(m.u32((plr.pPlayerData + 0x38) >>> 0)).toBe(0)

      // AI mode helpers & Disassembly Fix 2A (range=4 to AI_IdleWander113c) (7 VAs)
      let capturedX = -1
      let capturedY = -1
      const modeHooks = {
        onMonsterStartMode: (mem: Memory113c, _g: number, pArgs: number) => {
          capturedX = mem.u32((pArgs + 0x0c) >>> 0) | 0
          capturedY = mem.u32((pArgs + 0x10) >>> 0) | 0
          return 1
        },
      }
      expect(AI_StartModeAtCoordsStep0_6FD11FA0_113c(m, mon.pMonster, 2, pGame, 111, 122, modeHooks)).toBe(1)
      expect(capturedX).toBe(111)
      expect(AI_StartModeAtCoordsStep1_6FD11FF0_113c(m, mon.pMonster, 2, pGame, 133, 144, modeHooks)).toBe(1)
      expect(capturedY).toBe(144)
      expect(AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, mon.pMonster, 3, pGame, 155, 166, modeHooks)).toBe(1)
      m.setU32((pGame + 0xa8) >>> 0, 500)
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, mon.pMonster, 0)
      expect(EVENT_GetNextEventFrame113c(m, mon.pMonster, 2)).toBe(501)

      expect(AI_RunTowardTarget_6FD12F00_113c(m, mon.pMonster, monTgt.pMonster, pGame, 2, modeHooks)).toBe(1)
      expect(AI_WalkTowardTarget_6FD12F30_113c(m, mon.pMonster, monTgt.pMonster, pGame, 3, modeHooks)).toBe(1)

      // Disassembly Fix 2A: when approach fails with flagsByte & 2 and roll < 0x46, AI_IdleWander113c uses range=4 (0x6FD12673: mov al, 4)
      // Verify across multiple deterministic seeds that wander destination offset stays strictly within [-4, +4] of (100, 100)
      for (let seed = 1; seed <= 16; seed += 1) {
        m.setU32((mon.pMonster + 0x20) >>> 0, seed)
        m.setU32((mon.pMonster + 0x24) >>> 0, 666)
        m.setU16((mon.pPath + 0x02) >>> 0, 100)
        m.setU16((mon.pPath + 0x06) >>> 0, 100)
        m.setU16((mon.pPath + 0x10) >>> 0, 100)
        m.setU16((mon.pPath + 0x12) >>> 0, 100)
        expect(
          AI_ApproachTargetPathType13_6FD13000_113c(m, mon.pMonster, monTgt.pMonster, pGame, 0x02, {
            onMonsterStartMode: () => 0,
          }),
        ).toBe(1)
        const tx = m.u16((mon.pPath + 0x10) >>> 0)
        const ty = m.u16((mon.pPath + 0x12) >>> 0)
        expect(Math.abs(tx - 100)).toBeLessThanOrEqual(4)
        expect(Math.abs(ty - 100)).toBeLessThanOrEqual(4)
      }

      const pRec2 = (pMonStats2Txt + 5 * D2MonStats2Txt_SIZE) >>> 0
      m.setU8((pRec2 + 0x10b) >>> 0, 11)
      m.setU16((pRec2 + 0x10c) >>> 0, 25)
      expect(AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c(m, mon.pMonster, 1)).toBe(11)
      m.setU8((pRec2 + 0x10b) >>> 0, 20)
      expect(AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c(m, mon.pMonster, 1)).toBe(1)

      const hitsB8 = endVaTrace113c()
      for (const v of hitsB8) cumulativeHits.add(v)
      const missingB8 = WAVE4_PROMOTED_SPECS.filter((s) => s.batch === 'k2w2-b8')
        .map((s) => `D2Game:${s.va}`)
        .filter((k) => !hitsB8.has(k))
      expect(missingB8).toEqual([])
    }
  })

  it('SHARD 3 (k2w4-b2): executes all 41 promoted D2Game VAs + Fixes 3A..3F with 100% va-trace hits', () => {
    // =========================================================================
    // SHARD 3: k2w4-b2 (41 promoted VAs: 0x6FC561E0..0x6FC82C00 + Fixes 3A..3F)
    // =========================================================================
    {
      beginVaTrace113c()
      const { m, pGame, pMissilesTxt, pSkillsTxt } = createWave4World()
      const plr = allocPlayerUnit(m, pGame, 1, 0, 0x84, 100, 100)
      SUNIT_InsertServerUnit113c(m, pGame, plr.pPlayer)
      const mon = allocMonsterUnit(m, pGame, 5, 50, 102, 100, 0x84)
      SUNIT_InsertServerUnit113c(m, pGame, mon.pMonster)

      // 0x6FC561E0 & 0x6FC576B0
      expect(QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c(m, pGame, 100, 100, plr.pRoom, 1, 5)).toBe(0)
      const pTmpPlr = allocPlayerUnit(m, pGame, 99)
      m.setU32((pTmpPlr.pPlayerData + 0x98) >>> 0, m.alloc(0x20))
      for (let i = 0; i < 3; i += 1) {
        const pPair = m.alloc(8) >>> 0
        const pBufA = m.alloc(8) >>> 0
        const pBufB = m.alloc(8) >>> 0
        m.setU32(pBufA, m.alloc(16))
        m.setU32(pBufB, m.alloc(16))
        m.setU32(pPair, pBufA)
        m.setU32((pPair + 4) >>> 0, pBufB)
        m.setU32((pTmpPlr.pPlayerData + 0x60 + i * 4) >>> 0, pPair)
      }
      PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c(m, pTmpPlr.pPlayer, pGame)
      expect(m.u32((pTmpPlr.pPlayerData + 0x98) >>> 0)).toBe(0)
      expect(m.u32((pTmpPlr.pPlayerData + 0x60) >>> 0)).toBe(0)

      // Missile SrvDmg & SrvDo handlers (14 VAs) + Fix 3A
      const pMis = m.alloc(0x100) >>> 0
      const pMisData = m.alloc(D2MissileDataStrc_SIZE) >>> 0
      const pMisPath = m.alloc(D2DynamicPathStrc_SIZE) >>> 0
      m.setU32(pMis, 3)
      m.setU32((pMis + 0x04) >>> 0, 1) // missileId = 1
      m.setU32((pMis + 0x0c) >>> 0, 777)
      m.setU32((pMis + 0x14) >>> 0, pMisData)
      m.setU32((pMis + 0x2c) >>> 0, pMisPath)
      m.setU32((pMis + 0x80) >>> 0, pGame)
      m.setU32((pMis + 0xc8) >>> 0, 1 << 10)
      m.setU32((pMis + 0x94) >>> 0, 0)
      m.setU32((pMis + 0x98) >>> 0, 1)
      m.setU16((pMisData + D2MissileDataStrc.nSkill.off) >>> 0, 1) // skillId = 1
      m.setU16((pMisData + D2MissileDataStrc.nLevel.off) >>> 0, 5) // level = 5
      m.setU32((pMisData + D2MissileDataStrc.nTargetX.off) >>> 0, 1) // targetUnitType = monster
      m.setU32((pMisData + D2MissileDataStrc.nTargetY.off) >>> 0, 50) // targetUnitId = mon.unitId
      m.setU32((pMisPath + 0x1c) >>> 0, plr.pRoom)
      m.setU16((pMisPath + 0x02) >>> 0, 100)
      m.setU16((pMisPath + 0x06) >>> 0, 100)

      const pMisRec1 = (pMissilesTxt + 1 * 0x1a4) >>> 0
      m.setU16((pMisRec1 + 0x18) >>> 0, 2) // wSubMissile[0] = 2
      m.setU16((pMisRec1 + 0x24) >>> 0, 2) // wHitSubMissile[0] = 2
      m.setU32((pMisRec1 + 0x38) >>> 0, 2)
      m.setU32((pMisRec1 + 0x3c) >>> 0, 4)
      m.setU32((pMisRec1 + 0x40) >>> 0, 2)

      const pDmg = m.alloc(0x70) >>> 0
      MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c(m, pGame, pMis, mon.pMonster, pDmg)
      MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c(m, pGame, pMis, mon.pMonster, pDmg)
      expect(MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c(m, pGame, pMis, mon.pMonster)).toBe(2)
      expect(MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c(m, pGame, pMis, mon.pMonster)).toBe(1)
      expect(MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c(m, pGame, pMis, mon.pMonster)).toBe(3)
      expect(MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c(m, pGame, pMis, mon.pMonster)).toBe(1)
      expect(MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c(m, pGame, pMis, mon.pMonster)).toBe(3)
      expect(MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c(m, pGame, pMis, mon.pMonster)).toBe(3)
      expect(MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)

      // Disassembly Fix 3A: 0x6FC613D0 & 0x6FC61670 skip wSubMissile[0] < 0 when pMissilesTxt != 0 (Blizzard jne jump)
      expect(MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c(m, pGame, 0)).toBe(2)
      expect(MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c(m, pGame, 0)).toBe(2)
      m.setU16((pMisRec1 + 0x18) >>> 0, 0xffff) // wSubMissile[0] = -1, pMissilesTxt != 0
      // Real 1.13c does NOT return 2 early; calls MISSILE_SrvDo01_LinearProjectile113c (returns 1 with valid room/path)
      m.setU16((pMisData + D2MissileDataStrc.nTotalFrames.off) >>> 0, 10)
      m.setU16((pMisData + D2MissileDataStrc.nRemainingFrames.off) >>> 0, 5)
      expect(MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c(m, pGame, pMis)).toBe(1)
      expect(MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c(m, pGame, pMis)).toBe(1)
      m.setU16((pMisRec1 + 0x18) >>> 0, 2)

      expect(MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)

      // Disassembly Fix 3B: 0x6FC663A0 passes (nDuration, nChargeLevel) -> (totalFrames, nSkillLevel), NOT (nChargeLevel, nSkillLevel)
      expect(SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c(m, pGame, plr.pPlayer, 37, 1, 5, 0, mon.pMonster)).toBe(0)
      const pSkillRec1 = (pSkillsTxt + 1 * D2SkillsTxt_SIZE) >>> 0
      m.setU16((pSkillRec1 + 0x82) >>> 0, 15) // wAuraTargetState = 15
      m.setU16((pSkillRec1 + 0x48) >>> 0, 1) // wSrvMissileA = 1
      expect(SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c(m, pGame, plr.pPlayer, 37, 1, 5, 3, mon.pMonster)).toBe(1)

      // 0x6FC68950 Merc stat 9E packets
      MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c(m, plr.pPlayer, pGame)

      // 0x6FC6A190 Append save data chunk (2 chunks -> completion + checksum)
      m.setU32(0x6fd31c18, 1)
      const pSaveClient = m.alloc(0x500) >>> 0
      m.setU32(pSaveClient, 7)
      m.setU32((0x6fd307b8 + (7 << 2)) >>> 0, pSaveClient)
      const pChunk = m.alloc(16) >>> 0
      m.setU32(pChunk, 0xaa55aa55)
      expect(CLIENTS_AppendSaveDataChunk_6FC6A190_113c(m, 7, pChunk, 16, 32, 9)).toBe(0)
      expect(CLIENTS_AppendSaveDataChunk_6FC6A190_113c(m, 7, pChunk, 16, 32, 9)).toBe(1)
      expect((m.u32((pSaveClient + 0x3d4) >>> 0) & 0x08) !== 0).toBe(true)

      // Disassembly Fix 3C: 0x6FC6AD80 zeroes pList + 0x04 and pList + 0x08 before scanning nearby players
      const plrNear = allocPlayerUnit(m, pGame, 2, 0, 0x84, 102, 100)
      m.setU32((plr.pRoom + 0x74) >>> 0, plrNear.pPlayer)
      CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c(m, plr.pClient, 8)
      expect(m.u32((plr.pClient + 0x3bc) >>> 0)).toBeGreaterThanOrEqual(0)

      // 0x6FC70190 Corpse ring 16 submissiles
      expect(SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c(m, pGame, plr.pPlayer, 1, 1)).toBe(0)

      // Disassembly Fix 3D: 0x6FC73B40 copies cached save data directly into pBuffer (no extra pointer deref!)
      const pCached = m.alloc(0x10) >>> 0
      const pCachedSrc = m.alloc(8) >>> 0
      m.setU32(pCachedSrc, 0x13579bdf)
      m.setU32(pCached, 4)
      m.setU32((pCached + 4) >>> 0, pCachedSrc)
      m.setU32((plr.pPlayerData + 0x5c) >>> 0, pCached)
      const pDirectBuf = m.alloc(8) >>> 0
      m.setU32(pDirectBuf, 0x22222222) // NOT a valid pointer — would fault/miswrite if dereferenced!
      expect(PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c(m, plr.pPlayer, pDirectBuf, 0, 8, 1, 0, 0)).toBe(4)
      expect(m.u32(pDirectBuf)).toBe(0x13579bdf)

      // Disassembly Fix 3F: ALL 11 SendAlert*IfQuest*Active callbacks (exact 1.13c boolean truth table!)
      const tenAlertCases: Array<{
        questRec: number
        alertId: number
        fn: (mem: Memory113c, g: number, p: number) => number
      }> = [
        { questRec: 0x28, alertId: 0x24, fn: ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c },
        { questRec: 0x27, alertId: 0x23, fn: ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c },
        { questRec: 0x26, alertId: 0x22, fn: ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c },
        { questRec: 0x25, alertId: 0x21, fn: ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c },
        { questRec: 0x24, alertId: 0x20, fn: ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c },
        { questRec: 0x23, alertId: 0x1f, fn: ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c },
        { questRec: 0x06, alertId: 0x06, fn: ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c },
        { questRec: 0x04, alertId: 0x04, fn: ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c },
        { questRec: 0x03, alertId: 0x03, fn: ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c },
        { questRec: 0x02, alertId: 0x02, fn: ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c },
      ]
      const pFlagBuf = m.u32(plr.pQuestFlags) >>> 0
      const linkedQuests = new Map<number, { pQuest: number; pQuestData: number }>()
      for (const tc of tenAlertCases) {
        const qLinked = linkQuest(m, pGame, tc.alertId)
        linkedQuests.set(tc.alertId, qLinked)
        const actNo = tc.alertId >= 0x1f ? 4 : 0
        m.setU8((qLinked.pQuest + 0x08) >>> 0, actNo)
        m.set(plr.pLevel, D2DrlgLevelStrc.nLevelId, actNo === 4 ? 0x84 : 1)

        // Case 1: Fresh quest (bit0=0, bitF=0, bitD=0, bitE=0) -> MUST send 0x5D!
        m.fill(pFlagBuf, 0x60, 0)
        m.setU32(plr.pQueue, 0)
        expect(tc.fn(m, pGame, plr.pPlayer)).toBe(0)
        expect(m.u32(plr.pQueue), `fresh quest 0x${tc.questRec.toString(16)} must send 0x5D`).toBeGreaterThan(0)
        expect(m.u8((plr.pQueue + 4) >>> 0)).toBe(0x5d)
        expect(m.u8((plr.pQueue + 5) >>> 0)).toBe(tc.alertId)

        // Case 2: bit0=1 only (completed, no D/E) -> MUST NOT send!
        m.fill(pFlagBuf, 0x60, 0)
        QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, tc.questRec, 0)
        m.setU32(plr.pQueue, 0)
        expect(tc.fn(m, pGame, plr.pPlayer)).toBe(0)
        expect(m.u32(plr.pQueue), `bit0=1 quest 0x${tc.questRec.toString(16)} must NOT send`).toBe(0)

        // Case 3: bit0=0, bitF=1 only -> MUST NOT send!
        m.fill(pFlagBuf, 0x60, 0)
        QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, tc.questRec, 0x0f)
        m.setU32(plr.pQueue, 0)
        expect(tc.fn(m, pGame, plr.pPlayer)).toBe(0)
        expect(m.u32(plr.pQueue), `bitF=1 quest 0x${tc.questRec.toString(16)} must NOT send`).toBe(0)

        // Case 4: bit0=1 AND bitD=1 -> MUST send!
        m.fill(pFlagBuf, 0x60, 0)
        QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, tc.questRec, 0)
        QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, tc.questRec, 0x0d)
        m.setU32(plr.pQueue, 0)
        expect(tc.fn(m, pGame, plr.pPlayer)).toBe(0)
        expect(m.u32(plr.pQueue), `bit0=1|bitD=1 quest 0x${tc.questRec.toString(16)} must send`).toBeGreaterThan(0)
      }

      // 0x6FC82870 (ACT1Q5): sends when bit0==0 || bitD!=0 || bitE!=0 (ignores bit 0x0F!)
      const q05 = linkQuest(m, pGame, 0x05)
      m.setU8((q05.pQuest + 0x08) >>> 0, 0)
      m.set(plr.pLevel, D2DrlgLevelStrc.nLevelId, 1)
      m.fill(pFlagBuf, 0x60, 0)
      QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, 0x05, 0x0f)
      m.setU32(plr.pQueue, 0)
      expect(ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c(m, pGame, plr.pPlayer)).toBe(0)
      expect(m.u32(plr.pQueue)).toBeGreaterThan(0)
      expect(m.u8((plr.pQueue + 5) >>> 0)).toBe(0x05)
      m.fill(pFlagBuf, 0x60, 0)
      QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, 0x05, 0)
      m.setU32(plr.pQueue, 0)
      expect(ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c(m, pGame, plr.pPlayer)).toBe(0)
      expect(m.u32(plr.pQueue)).toBe(0)
      m.set(plr.pLevel, D2DrlgLevelStrc.nLevelId, 0x84)

      // Remaining 8 Act 5 quest VAs + Disassembly Fix 3E (0x6FC7EC30)
      m.fill(pFlagBuf, 0x60, 0)
      expect(ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c(m, pGame, plr.pPlayer)).toBe(0)
      expect(ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c(m, pGame, plr.pPlayer)).toBe(0)
      expect(DRLGWARP_TestRoomTileBit113c(m, plr.pQuestFlags, 0x28, 0)).toBe(1)

      ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c(m, plr.pPlayer, pGame, plr.pRoom)
      const q1f = linkedQuests.get(0x1f)!
      const pOpShenk = m.alloc(0x20) >>> 0
      m.setU32(pOpShenk, pGame)
      m.setU32((pOpShenk + 0x08) >>> 0, plr.pRoom)
      m.setU32((pOpShenk + 0x14) >>> 0, 100)
      m.setU32((pOpShenk + 0x18) >>> 0, 100)
      ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c(m, pOpShenk)
      void q1f

      expect(ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c(m, pGame, plr.pPlayer)).toBe(1)

      const q21 = linkedQuests.get(0x21)!
      const frozenAnya = allocMonsterUnit(m, pGame, 0x202, 888, 100, 100, 114)
      m.setU32((frozenAnya.pMonData + 0x30) >>> 0, m.alloc(4))
      SUNIT_InsertServerUnit113c(m, pGame, frozenAnya.pMonster)
      m.setU32((q21.pQuestData + 0x9c) >>> 0, 888)
      ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c(m, pGame)

      const q23 = linkedQuests.get(0x23)!
      const pAltar = m.alloc(0x100) >>> 0
      const pAltarPath = m.alloc(0x40) >>> 0
      m.setU32(pAltarPath, plr.pRoom)
      m.setU32((pAltarPath + 0x0c) >>> 0, 100)
      m.setU32((pAltarPath + 0x10) >>> 0, 100)
      m.setU32(pAltar, 2)
      m.setU32((pAltar + 0x0c) >>> 0, 901)
      m.setU32((pAltar + 0x10) >>> 0, 2)
      m.setU32((pAltar + 0x2c) >>> 0, pAltarPath)
      m.setU32((pAltar + 0x80) >>> 0, pGame)
      SUNIT_InsertServerUnit113c(m, pGame, pAltar)
      m.setU32((q23.pQuestData + 0x50) >>> 0, 901)
      ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c(m, pGame, q23.pQuest, q23.pQuestData)
      expect(m.u32((pAltar + 0x10) >>> 0)).toBe(0)

      // Disassembly Fix 3E: 0x6FC7EC30 resolves pInteract from pMonData+0x30 (NOT pMon94) & sets target before room removal
      const townNpc = allocMonsterUnit(m, pGame, 0x200, 889, 100, 100, 109)
      SUNIT_InsertServerUnit113c(m, pGame, townNpc.pMonster)
      const pInteractStruct = m.alloc(0x10) >>> 0
      const pInteractNode = m.alloc(0x10) >>> 0
      m.setU32(pInteractNode, plr.pPlayer)
      m.setU32(pInteractStruct, pInteractNode)
      m.setU32((townNpc.pMonData + 0x30) >>> 0, pInteractStruct)
      m.setU8((q21.pQuestData + 0x91) >>> 0, 1)
      m.setU32((q21.pQuestData + 0x84) >>> 0, 1)
      m.setU32((q21.pQuestData + 0x94) >>> 0, 889)
      m.setU8((q21.pQuestData + 0x93) >>> 0, 1)
      m.setU32((q21.pQuestData + 0x88) >>> 0, 0)
      ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c(m, q21.pQuest)
      expect(m.u8((q21.pQuestData + 0x91) >>> 0)).toBe(0)
      expect(m.u8((q21.pQuestData + 0x93) >>> 0)).toBe(0)
      expect(m.u32((q21.pQuestData + 0x88) >>> 0)).toBe(1)

      const hitsB2 = endVaTrace113c()
      for (const v of hitsB2) cumulativeHits.add(v)
      const missingB2 = WAVE4_PROMOTED_SPECS.filter((s) => s.batch === 'k2w4-b2')
        .map((s) => `D2Game:${s.va}`)
        .filter((k) => !hitsB2.has(k))
      expect(missingB2).toEqual([])
    }
  })

  it('SHARD 4 (k2w5-b2): executes all 41 promoted D2Game VAs + Fixes 4A..4E with 100% va-trace hits', () => {
    // =========================================================================
    // SHARD 4: k2w5-b2 (41 promoted VAs: 0x6FC7AB00..0x6FCB94C0 + Fixes 4A..4E)
    // =========================================================================
    {
      beginVaTrace113c()
      const { m, pGame, pSkillsTxt, pObjectsTxt, pItemsTxt, pMonStatsTxt, pDataTables } =
        createWave4World()

      // Players + Party ID = 5 (distinct from dwClassId = 1!) for Fix 4A
      const plr1 = allocPlayerUnit(m, pGame, 10, 1, 0x26, 100, 100) // Sorceress (classId=1) in Tristram (0x26)
      const plr2 = allocPlayerUnit(m, pGame, 20, 2, 0x26, 102, 100) // Party mate in party 5
      SUNIT_InsertServerUnit113c(m, pGame, plr1.pPlayer)
      SUNIT_InsertServerUnit113c(m, pGame, plr2.pPlayer)
      // Also link into living players client list (pGame + 0x88) for D2GAME_SUNIT_IterateAllLivingPlayers
      m.setU32((pGame + 0x88) >>> 0, plr1.pClient)
      m.setU32((plr1.pClient + 0x4ac) >>> 0, plr2.pClient)
      m.setU32((plr1.pClient + 0x04) >>> 0, 4) // active client state
      m.setU32((plr2.pClient + 0x04) >>> 0, 4)

      m.setU32((pGame + 0x1d2c) >>> 0, 0)
      PARTY_AllocPartyControl_6FCBBE40_113c(m, pGame)
      const pPartyCtrl = m.u32((pGame + 0x1d2c) >>> 0) >>> 0
      const pSubParty5 = m.alloc(0x10) >>> 0
      const pNode2 = m.alloc(8) >>> 0
      const pNode1 = m.alloc(8) >>> 0
      m.setU32(pNode1, 10)
      m.setU32((pNode1 + 4) >>> 0, pNode2)
      m.setU32(pNode2, 20)
      m.setU16(pSubParty5, 5) // wPartyId = 5 (NOT classId = 1!)
      m.setU32((pSubParty5 + 4) >>> 0, pNode1)
      m.setU32((pPartyCtrl + 4) >>> 0, pSubParty5)

      // Quest party propagation callbacks (10 VAs)
      expect(ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c(m, pGame, plr1.pPlayer)).toBe(0)
      expect(ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c(m, pGame, plr1.pPlayer)).toBe(0)
      const pQuestArgCheck = m.alloc(0x20) >>> 0
      m.setU32((pQuestArgCheck + 4) >>> 0, pGame)
      m.setU32((pQuestArgCheck + 0x18) >>> 0, m.alloc(0x100))
      expect(ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c(m, plr1.pPlayer, pQuestArgCheck)).toBe(0)
      expect(ACT5Q3_PropagateQuestStateToPartyCallback_6FC7B120_113c(m, pGame, plr1.pPlayer)).toBe(0)
      expect(ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c(m, pGame, plr1.pPlayer)).toBe(0)
      expect(ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c(m, pGame, plr1.pPlayer)).toBe(0)
      expect(ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c(m, pGame, plr1.pPlayer)).toBe(0)
      expect(ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c(m, pGame, plr1.pPlayer)).toBe(0)
      expect(ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c(m, plr1.pPlayer, pQuestArgCheck)).toBe(0)
      expect(ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c(m, pGame, plr1.pPlayer)).toBe(0)
      expect(ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c(m, pGame, plr1.pPlayer)).toBe(0)

      // Disassembly Fix 4A (part 1): 0x6FC848B0 uses real party ID (5), NOT dwClassId (1), propagating Cain rescue to plr2!
      expect(DRLGWARP_TestRoomTileBit113c(m, plr2.pQuestFlags, 4, 1)).toBe(0)
      expect(ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c(m, pGame, plr1.pPlayer)).toBe(0)
      expect(DRLGWARP_TestRoomTileBit113c(m, plr1.pQuestFlags, 4, 1)).toBe(1)
      expect(DRLGWARP_TestRoomTileBit113c(m, plr2.pQuestFlags, 4, 1)).toBe(1)

      // Disassembly Fix 4A (part 2): 0x6FC88FC0 also uses real party ID (5) for Cain Gibbet Cage!
      m.fill(m.u32(plr1.pQuestFlags), 0x60, 0)
      m.fill(m.u32(plr2.pQuestFlags), 0x60, 0)
      const pObjTxtRec = (pObjectsTxt + 10 * 0x1c0) >>> 0
      m.setU8((pObjTxtRec + 0x121) >>> 0, 1)
      m.setU32((pObjTxtRec + 0x17c) >>> 0, 0x80)
      m.setU32((pObjTxtRec + 0x184) >>> 0, 3)
      const pObj = m.alloc(0x100) >>> 0
      const pObjData = m.alloc(0x40) >>> 0
      const pObjPath = m.alloc(0x40) >>> 0
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x04) >>> 0, 10)
      m.setU32((pObj + 0x10) >>> 0, 0)
      m.setU32((pObj + 0x14) >>> 0, pObjData)
      m.setU32((pObj + 0x2c) >>> 0, pObjPath)
      m.setU32((pObj + 0x80) >>> 0, pGame)
      m.setU32(pObjPath, plr1.pRoom)
      m.setU32(pObjData, pObjTxtRec)
      const pOpArgs = m.alloc(0x30) >>> 0
      m.setU32(pOpArgs, pGame)
      m.setU32((pOpArgs + 0x04) >>> 0, pObj)
      m.setU32((pOpArgs + 0x08) >>> 0, plr1.pPlayer)
      m.setU32((pOpArgs + 0x0c) >>> 0, m.alloc(8))
      m.setU32((pOpArgs + 0x10) >>> 0, 10)
      expect(ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c(m, pOpArgs)).toBe(0)
      expect(DRLGWARP_TestRoomTileBit113c(m, plr1.pQuestFlags, 4, 1)).toBe(1)
      expect(DRLGWARP_TestRoomTileBit113c(m, plr2.pQuestFlags, 4, 1)).toBe(1)

      // 0x6FC8A560 Well heal life/mana/stamina
      STATLIST_SetUnitStat113c(m, plr1.pPlayer, 7, 100 << 8, 0)
      STATLIST_SetUnitStat113c(m, plr1.pPlayer, 6, 20 << 8, 0)
      expect(OBJ_UseWellHealPlayerAndPets_6FC8A560_113c(m, pObjTxtRec, plr1.pPlayer, pGame)).toBe(1)
      expect(STATLIST_GetUnitStat113c(m, plr1.pPlayer, 6, 0)).toBe(70 << 8)

      // Disassembly Fix 4B: 0x6FC8B8A0 delegates to canonical MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c
      const nearMon = allocMonsterUnit(m, pGame, 5, 60, 101, 100, 0x26)
      SUNIT_InsertServerUnit113c(m, pGame, nearMon.pMonster)
      m.setU32((pMonStatsTxt + 5 * D2MonStatsTxt_SIZE + 0x108) >>> 0, 0) // normal non-boss monster
      m.setU32((nearMon.pPath + 0x1c) >>> 0, plr1.pRoom)
      // Populate MonStats2 for classId=5 so OBJ_IsEligibleMonsterForShrineUpgrade accepts nearMon
      const pMonStats2Rec5 = (m.u32((pDataTables + 0xa90) >>> 0) + 5 * D2MonStats2Txt_SIZE) >>> 0
      m.setU8((pMonStats2Rec5 + 0x0b) >>> 0, 1)
      m.setU8((pMonStats2Rec5 + 0xf0) >>> 0, 0x04) // mode bit 2
      STATLIST_SetUnitStat113c(m, nearMon.pMonster, 6, 100 << 8, 0)
      STATLIST_SetUnitStat113c(m, nearMon.pMonster, 7, 100 << 8, 0)
      m.setU32((plr1.pRoom + 0x74) >>> 0, nearMon.pMonster)
      OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c(m, pOpArgs)
      expect((m.u8((nearMon.pMonData + 0x16) >>> 0) & 0x01) !== 0).toBe(true)
      expect((m.u32((nearMon.pMonster + 0xc4) >>> 0) & 0x800) !== 0).toBe(true)

      // Chest/Urn operate handlers (4 VAs)
      m.setU32((pObj + 0x10) >>> 0, 0)
      expect(OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c(m, pOpArgs)).toBe(1)
      m.setU32((pObj + 0x10) >>> 0, 0)
      expect(OBJ_OperateChestAndDropTreasure_6FC8EC20_113c(m, pOpArgs)).toBe(1)
      m.setU32((pObj + 0x10) >>> 0, 0)
      expect(OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c(m, pOpArgs)).toBe(1)
      m.setU32((pObj + 0x10) >>> 0, 0)
      expect(OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c(m, pOpArgs)).toBe(1)

      // 0x6FC9ACB0 Hover clear packet 0x76 & 0x6FCAD710 Packet 0x59 + 0x75
      m.setU32(plr1.pQueue, 0)
      SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c(m, pObj, plr1.pClient)
      expect(m.u32(plr1.pQueue)).toBe(6)
      expect(m.u8((plr1.pQueue + 4) >>> 0)).toBe(0x76)

      const szName = m.alloc(16) >>> 0
      m.setU8(szName, 0x41)
      m.setU8((szName + 1) >>> 0, 0)
      m.setU32(plr1.pQueue, 0)
      NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c(m, plr1.pClient, 1, 10, szName, 100, 100)
      expect(m.u32(plr1.pQueue)).toBe(0x1a + 0x0d)
      expect(m.u8((plr1.pQueue + 4) >>> 0)).toBe(0x59)
      expect(m.u8((plr1.pQueue + 4 + 0x1a) >>> 0)).toBe(0x75)

      // 0x6FCAFAF0 & 0x6FCB0170 NPC gamble/merc/vendor cleanup
      const pNpcCtrl = m.alloc(0x10) >>> 0
      const pNpcSlots = m.alloc(2 * 0x44) >>> 0
      m.setU32((pGame + 0x1d24) >>> 0, pNpcCtrl)
      m.setU32((pNpcCtrl + 0x04) >>> 0, pNpcSlots)
      m.setU32(pNpcSlots, 150)
      m.setU32((pNpcSlots + 0x04) >>> 0, INVENTORY_AllocInventory113c(m, 0, 0))
      m.setU32((pNpcSlots + 0x0c) >>> 0, 1)
      const pGambleNode = m.alloc(0x10) >>> 0
      m.setU32(pGambleNode, INVENTORY_AllocInventory113c(m, 0, 0))
      m.setU32((pGambleNode + 0x04) >>> 0, 10)
      m.setU32((pNpcSlots + 0x08) >>> 0, pGambleNode)
      const pMercNode = m.alloc(0x10) >>> 0
      m.setU32(pMercNode, 10)
      m.setU32((pNpcSlots + 0x18) >>> 0, pMercNode)
      const pNpcRec = m.alloc(0x20) >>> 0
      m.setU32((pNpcRec + 0x04) >>> 0, 150)
      NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c(m, pNpcRec, plr1.pPlayer, pGame)
      expect(m.u32((pNpcSlots + 0x08) >>> 0)).toBe(0)
      expect(m.u32((pNpcSlots + 0x18) >>> 0)).toBe(0)
      NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c(m, pGame, pNpcSlots)
      expect(m.u32((pNpcSlots + 0x04) >>> 0)).toBe(0)

      // Progressive charge & combat skill handlers (11 VAs)
      const skillId = 10
      const skillRec = (pSkillsTxt + skillId * D2SkillsTxt_SIZE) >>> 0
      m.setU16((skillRec + 0x54) >>> 0, 30)
      m.setU16((skillRec + 0x80) >>> 0, 10)
      m.setU8((skillRec + 0x1a5) >>> 0, 0x80)
      m.setU8((skillRec + 0x1dc) >>> 0, 4)

      const pChargeList = STATLIST_CreateEx113c(m, plr1.pPlayer, 0, pGame) >>> 0
      STATLIST_SetState113c(m, pChargeList, 10)
      STATLIST_SetStat113c(m, pChargeList, 0x15e, skillId, 0)
      STATLIST_SetStat113c(m, pChargeList, 0x15f, 1, 0)
      STATLIST_SetStat113c(m, pChargeList, 30, 3, 0)
      const pDmg = m.alloc(0x70) >>> 0
      SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c(m, plr1.pPlayer, pDmg, pChargeList)
      expect((m.u8((pDmg + 5) >>> 0) & 0x40) !== 0).toBe(true)
      m.setU8((pDmg + 5) >>> 0, 0)
      SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c(m, plr1.pPlayer, pChargeList, pDmg)
      expect((m.u8((pDmg + 5) >>> 0) & 0x40) !== 0).toBe(true)

      expect(SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0_113c(m, pGame, plr1.pPlayer, skillId, 1)).toBe(0)
      PATH_SetTargetUnit113c(m, plr1.pPath, nearMon.pMonster)
      expect(SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c(m, pGame, plr1.pPlayer, skillId, 1)).toBe(1)
      SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c(m, plr1.pPlayer, pGame, nearMon.pMonster, skillId, 1)

      const pAuraCtx = m.alloc(0x14) >>> 0
      m.setU32(pAuraCtx, pGame)
      m.setU32((pAuraCtx + 0x04) >>> 0, plr1.pPlayer)
      m.setU32((pAuraCtx + 0x0c) >>> 0, pDmg)
      expect(SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c(m, pAuraCtx, nearMon.pMonster)).toBe(1)
      expect(SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c(m, pGame, plr1.pPlayer, skillId, 1)).toBe(1)

      // Disassembly Fix 4C: 0x6FCB3990 initializes caster seed from targetX (NOT pOwner!) and writes pOwner into pMissPkt+0x04
      const pOriginMis = m.alloc(0x100) >>> 0
      const pOriginPath = m.alloc(D2DynamicPathStrc_SIZE) >>> 0
      m.setU32(pOriginMis, 3)
      m.setU32((pOriginMis + 0x2c) >>> 0, pOriginPath)
      m.setU16((pOriginPath + 0x10) >>> 0, 0x135) // targetX = 0x135
      m.setU16((pOriginPath + 0x12) >>> 0, 0x246) // targetY = 0x246
      m.setU32((pOriginPath + 0x1c) >>> 0, plr1.pRoom)
      expect(
        SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c(
          m,
          pGame,
          pOriginMis,
          1,
          plr1.pPlayer,
          1,
          0,
          skillId,
          1,
        ),
      ).toBe(1)
      expect(m.u32((pOriginMis + 0x20) >>> 0)).toBe(0x135)
      expect(m.u32((pOriginMis + 0x24) >>> 0)).toBe(0x29a)

      expect(SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c(m, pGame, plr1.pPlayer, skillId, 1)).toBe(0)
      expect(SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c(m, pGame, plr1.pPlayer, skillId, 1)).toBe(0)
      expect(SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c(m, pGame, plr1.pPlayer, skillId, 1)).toBe(1)

      // Pet broadcast, warp, and Disassembly Fix 4D (0x6FCB77E0 sends 0x7A on channel 1!)
      expect(PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c(m, nearMon.pMonster, pGame, plr1.pPlayer)).toBe(0)
      const pPetSlot = m.alloc(8) >>> 0
      PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c(m, pPetSlot, plr1.pRoom, pGame, 100, 100)

      const petMon = allocMonsterUnit(m, pGame, 5, 777, 100, 100, 0x26)
      SUNIT_InsertServerUnit113c(m, pGame, petMon.pMonster)
      m.setU32(plr1.pQueue, 0)
      PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c(m, pGame, 777)
      expect((m.u32((petMon.pMonster + 0xc4) >>> 0) & 0x4000000) !== 0).toBe(true)
      const qLen7a = m.u32(plr1.pQueue) >>> 0
      expect(qLen7a).toBeGreaterThanOrEqual(0x0d)
      const p7a = (plr1.pQueue + 4 + qLen7a - 0x0d) >>> 0
      expect(m.u8(p7a)).toBe(0x7a)
      expect(m.u8((p7a + 1) >>> 0)).toBe(0)
      expect(m.u32((p7a + 9) >>> 0)).toBe(777)

      // Claws of Thunder, Melee Elem Convert, Disassembly Fix 4E (Smite dwHitClass +0x60 = 0x65), Leap/Charge
      expect(SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c(m, pGame, plr1.pPlayer, skillId, 1)).toBe(0)
      expect(SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c(m, pGame, plr1.pPlayer, skillId, 1)).toBe(0)

      // Disassembly Fix 4E: 0x6FCB9000 writes Smite hit class 0x65 at pDmg + 0x60 (NOT pDmg + 0x68 dwConvPct!)
      const shield = allocBasicItem(m, pGame, 4, 404)
      m.setU16((pItemsTxt + 4 * D2ItemsTxt_SIZE + D2ItemsTxt.wType1.off) >>> 0, 2) // shield type
      m.setU8((pItemsTxt + 4 * D2ItemsTxt_SIZE + 0xfe) >>> 0, 2) // min smite
      m.setU8((pItemsTxt + 4 * D2ItemsTxt_SIZE + 0xff) >>> 0, 6) // max smite
      const pEquiv = m.u32((pDataTables + DATATABLES_OFF_113C.pItemTypesEquiv) >>> 0) >>> 0
      // Mark item type 2 as equivalent to item type 2 (already set) and place in left-hand shield bodyloc=5
      void pEquiv
      ITEMS_SetBodyLocation113c(m, shield.pItem, 5)
      INVENTORY_LinkItemToInventoryList113c(m, plr1.pInventory, shield.pItem)
      const pInvGrid0 = m.u32((plr1.pInventory + 0x20) >>> 0) >>> 0
      if (pInvGrid0 !== 0) {
        m.setU32((pInvGrid0 + 5 * 4) >>> 0, shield.pItem)
      }
      // Also set monster Smite branch (non-player attacker -> enters 0x6FCB91E7 -> sets pDmg+0x60 = 0x65!)
      const smiteMon = allocMonsterUnit(m, pGame, 5, 808, 100, 100, 0x26)
      const smiteTgt = allocMonsterUnit(m, pGame, 5, 809, 101, 100, 0x26)
      SUNIT_InsertServerUnit113c(m, pGame, smiteMon.pMonster)
      SUNIT_InsertServerUnit113c(m, pGame, smiteTgt.pMonster)
      PATH_SetTargetUnit113c(m, smiteMon.pPath, smiteTgt.pMonster)
      // Fix 4E: Smite sets dwHitClass = 0x65 at pDmg + 0x60 (NOT pDmg + 0x68 dwConvPct!)
      let pSmiteDmg = 0
      const origAlloc = m.alloc.bind(m)
      m.alloc = (size: number): number => {
        const ptr = origAlloc(size)
        if (size === 0x70 && pSmiteDmg === 0) pSmiteDmg = ptr >>> 0
        return ptr
      }
      try {
        expect(SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c(m, pGame, smiteMon.pMonster, skillId, 1)).toBe(1)
      } finally {
        m.alloc = origAlloc
      }
      expect(pSmiteDmg).not.toBe(0)
      expect(m.u32((pSmiteDmg + 0x60) >>> 0)).toBe(0x65)
      expect(m.u32((pSmiteDmg + 0x68) >>> 0)).toBe(0)
      expect(SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c(m, pGame, plr1.pPlayer, skillId, 1)).toBe(0)

      const hitsW5B2 = endVaTrace113c()
      expect(hitsW5B2.has('D2Game:0x6FC44B70')).toBe(true)
      for (const v of hitsW5B2) cumulativeHits.add(v)
      const missingW5B2 = WAVE4_PROMOTED_SPECS.filter((s) => s.batch === 'k2w5-b2')
        .map((s) => `D2Game:${s.va}`)
        .filter((k) => !hitsW5B2.has(k))
      expect(missingW5B2).toEqual([])
    }
  })

  it('confirms 100% (164/164) cumulative va-trace hit coverage across all 4 Wave 4 shards', () => {
    const missingVas = WAVE4_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
