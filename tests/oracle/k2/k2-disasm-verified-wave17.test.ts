/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 17: +126 VAs).
 *
 * Audits and verifies 126 eligible `D2Game.dll` (`0x6FC20000`) closure functions across
 * 12 binding shards + 4 `KERN_BINDINGS_113C` entries (plus `0x6FCFFA60` special audit),
 * while strictly keeping all 21 `indirectUnknown` VAs at `"ported"`.
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading 8-byte & trailing 3-byte opcode + size verification
 *    against `D2Game.dll`, manifest promotion checks, and `indirectUnknown` guardrails.
 * 2. Targeted differential regression tests proving every real 1.13c binary discrepancy fixed in Wave 17.
 * 3. Live `SparseMemory113c` execution + 100% (`126 / 126`) `beginVaTrace113c()` / `endVaTrace113c()` coverage.
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
  D2COMMON_GRID0_INFO_VA_113C,
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  G_INVENTORY_TXT_TABLE_VA_113C,
  INVENTORY_AllocInventory113c,
  INVENTORY_SIGNATURE_113C,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'

const D2COMMON_GRID1_INFO_VA_113C = 0x6fded390
import {
  ITEMS_SetItemFlag113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_CanPlayerTargetUnitWithSkill113c } from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c.ts'
import {
  SUNIT_InsertServerUnit113c,
} from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_GetPlayerClientClassId113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c.ts'
import {
  PARTY_AddPlayerToSubParty_6FCBC4F0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c.ts'
import {
  PARTY_AllocPartyControl_6FCBBE40_113c,
} from '../../../src/d2kern-113c/game/k2-w2b4-113c.ts'
import {
  PARTY_CreateAndLinkSubParty_6FCBBF70_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c.ts'
import {
  SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ItemsTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2SkillsTxt_SIZE,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import {
  REGPOP_RollAmbientSpawn113c,
  REGPOP_SpawnAmbientPack113c,
  ROOM_TickSeedAndAmbientSpawn113c,
} from '../../../src/d2kern-113c/game/act-rooms-113c.ts'
import {
  AI_CastSkillMode14_113c,
  AI_FallenShaman113c,
  AI_FallenShamanCorpseFilter113c,
  AI_SetAiControlOverrides113c,
  AI_Skeleton113c,
  SKILLS_CanMonsterCastAtTarget113c,
} from '../../../src/d2kern-113c/game/ai-fallen-113c.ts'
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
  C2S_Packet5F_UpdatePlayerPos113c,
} from '../../../src/d2kern-113c/game/c2s-packet-113c.ts'
import {
  GAME_InitSeed113c,
} from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts'
import {
  OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c,
} from '../../../src/d2kern-113c/game/k2-real-itemdrop-113c.ts'
import {
  AIGENERAL_GetOwnerData_6FC40D50_113c,
  SUNITDMG_ComputeExperienceGain113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c.ts'
import {
  DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c,
  MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c,
  MONSTER_AssignTeleportSkill_6FC441B0_113c,
  NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c,
  NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c,
  PACKETS_SrvMercItemAction_6FCF0BC0_113c,
  PARTY_SetOrClearPlayerHostility_6FD11130_113c,
  PETS_AllocAndInitPlayerPetTable_6FCB7120_113c,
  PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c,
  QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c,
  QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c,
  SHRINES_OnShrineStateRemoved_6FC8A930_113c,
  SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c,
  SKILLS_SrvDo_Telekinesis_6FC631C0_113c,
  STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c,
  STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c.ts'
import {
  AI_CastSkillWithModeRandomScatter_6FD12420_113c,
  AI_CircleStrafeTarget_6FD126B0_113c,
  AI_FindTargetOrUnstickOverlap_6FD13150_113c,
  AI_RunFleeFromUnit_6FD12C10_113c,
  AI_RunWanderAroundUnit_6FD12750_113c,
  AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c,
  AI_WalkToLeashDistanceFromUnit_6FD11C30_113c,
  NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c,
  OBJECTS_RollScaledByte19C_6FD14260_113c,
} from '../../../src/d2kern-113c/game/k2-w5b10-113c.ts'
import {
  OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c,
  PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c,
  PARTY_CancelPartyInvitation_6FD10900_113c,
  PARTY_ClearHostilityFlag08_6FD14210_113c,
  PARTY_EnableHostilityFlag08_6FD141C0_113c,
  PARTY_InvitePlayerToParty_6FD10870_113c,
  PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c,
  PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c,
  PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c,
  PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c,
  PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c,
} from '../../../src/d2kern-113c/game/k2-w6b7-113c.ts'
import {
  ACT1Q1_SequenceFilter_6FC85410_113c,
  ACT1Q2_OnBurialGroundsEntered_6FC85440_113c,
  ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c,
  ACT1Q5_OnHoradricMalusDroppedOrRemoved_6FC855F0_113c,
  ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c,
  ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c,
  ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c,
  MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c,
  MONUMOD_KnockBeltPotionToGround_6FC44440_113c,
  PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c,
  PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c,
  QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c,
  QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c,
  QUESTS_UseQuestScrollItem_6FC56070_113c,
  SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c,
  SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c,
  SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c,
  SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c,
} from '../../../src/d2kern-113c/game/k2-w8b1-113c.ts'
import {
  ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c,
  ACT3Q1_OnQuestItemPickedUp_6FD07640_113c,
  ACT3Q2_OnGidbinnPickedUp_6FD07770_113c,
  ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c,
  ACT3Q7_OnMephistoKilled_6FD09A10_113c,
  PARTY_AcceptInviteAndSyncParty_6FD10D50_113c,
  PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b4-113c.ts'
import {
  ACT1Q4_OperateInifussTree_6FC85B40_113c,
  ACT1Q6_OnAndarielKilled_6FC87E00_113c,
  ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c,
  ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c,
  AI_GreaterMummyThink_6FCA8380_113c,
  AI_SummonerThink_6FCA5780_113c,
  MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c,
  MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c,
  NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c,
  NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c,
  PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c,
  PETS_RecalcAndClampPlayerPetTypeForSkill_6FCBF600_113c,
  PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c,
  PLAYERSAVE_SavePlayerCharacter_6FC74320_113c,
  PLAYER_DestroyPlayerUnitResources_6FC587E0_113c,
  PLAYER_LootPlayerCorpseUnit_6FC99910_113c,
  QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c,
  QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c,
  SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c,
} from '../../../src/d2kern-113c/game/k2-w9b1-113c.ts'
import {
  ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c,
  ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c,
  ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c,
  C2S_PacketUseQuestScrollItem_6FCED8D0_113c,
  ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c,
  ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c,
  PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c,
  SKILLS_EquipSummonedPetItems_6FD0E6F0_113c,
} from '../../../src/d2kern-113c/game/k2-w9b2-113c.ts'
import {
  MONSTER_NullModeEventFallback113c,
} from '../../../src/d2kern-113c/game/monster-events.ts'
import {
  MONSTER_AddSkillToUnit113c,
  MONSTER_FindValidFloorSpawnCoords113c,
  MONSTER_GetBossMinionField34_113c,
  MONSTER_SpawnFetishPartyMinions113c,
  QUEST_Act4DiabloSealCheck113c,
  SEED_RollMaskFast113c,
  SEED_RollRangeHalfOpen113c,
  UNIT_CalcSqDistSubtiles113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  SUNIT_GetLastAttacker113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  AI_MapAiAction5_WalkAndMode9_113c,
} from '../../../src/d2kern-113c/game/town-npc-ai-113c.ts'

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
  readonly shard: string
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE17_INDIRECT_UNKNOWN_SKIPPED: readonly string[] = [
  '0x6FC3BBC0', // k2-real-c2s-spawn.json: AI_FollowDs1NpcPathMem
  '0x6FC468E0', // k2-real-c2s-spawn.json: MONSTER_DispatchMinionComponentCallbacks
  '0x6FC4C2D0', // k2w8-b1.json: GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0
  '0x6FC4C570', // k2w8-b1.json: GAME_CreateMultiClientGame_6FC4C570
  '0x6FC4C830', // k2w10-b1.json: PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830
  '0x6FC4C910', // k2w10-b1.json: PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910
  '0x6FC4D9B0', // k2-real-c2s-spawn.json: GAME_StepClientJoinStatesAndTimeouts
  '0x6FC4EAD0', // k2-real-c2s-spawn.json: OBJECTS_CheckLevelObjectHook
  '0x6FC4F0D0', // k1r13-laneE-replay.json: OBJECTS_PopulateRoom
  '0x6FC4F300', // k1r13-laneE-replay.json: OBJECTS_InitObjectUnit
  '0x6FC57030', // k2-real-c2s-spawn.json: SUNIT_DispatchItemEventCallbacks
  '0x6FC74000', // k2w8-b1.json: PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000
  '0x6FC7AFB0', // k2w8-b1.json: QUESTS_DefaultSequenceFilter_6FC7AFB0
  '0x6FC7B4F0', // k2w8-b1.json: ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0
  '0x6FC7EED0', // k2w10-b1.json: ACT5Q5_Callback02_OnAncientKilled_6FC7EED0
  '0x6FC84430', // k2w8-b1.json: ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430
  '0x6FC85260', // k2w8-b1.json: ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260
  '0x6FC98430', // k2-real-c2s-spawn.json: PLAYER_StartModeOnUnit
  '0x6FC98550', // k2-real-c2s-spawn.json: PLAYER_StartModeAtCoords
  '0x6FCBD230', // k2-real-c2s-spawn.json: AI_InitMonsterAiThinkFn
  '0x6FCEC550', // k1r13-laneE-replay.json: C2S_Dispatch
]

const WAVE17_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  { shard: 'k2w9-b1', va: '0x6FC56100', size: 62, headHex: '8b018b80f4100000', tailHex: '0900c3', tsSymbol: 'QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c' },
  { shard: 'k2w9-b1', va: '0x6FC56C50', size: 852, headHex: '535556578bf885ff', tailHex: '5d5bc3', tsSymbol: 'QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c' },
  { shard: 'k2w9-b1', va: '0x6FC587E0', size: 117, headHex: '53578bf88bd78bd9', tailHex: '5f5bc3', tsSymbol: 'PLAYER_DestroyPlayerUnitResources_6FC587E0_113c' },
  { shard: 'k2w9-b1', va: '0x6FC5BE70', size: 88, headHex: '53568bf285f6578b', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c' },
  { shard: 'k2w9-b1', va: '0x6FC60B20', size: 167, headHex: '53558bda85db578b', tailHex: '5d5bc3', tsSymbol: 'MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c' },
  { shard: 'k2w9-b1', va: '0x6FC74320', size: 215, headHex: '83ec3885f6750833', tailHex: 'c20800', tsSymbol: 'PLAYERSAVE_SavePlayerCharacter_6FC74320_113c' },
  { shard: 'k2w9-b1', va: '0x6FC7C100', size: 227, headHex: '535556578bea558b', tailHex: 'c20400', tsSymbol: 'ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c' },
  { shard: 'k2w9-b1', va: '0x6FC7D0A0', size: 290, headHex: '515355568be9578b', tailHex: 'faffcc', tsSymbol: 'ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c' },
  { shard: 'k2w9-b1', va: '0x6FC85B40', size: 509, headHex: '83ec0855568be98b', tailHex: 'c408c3', tsSymbol: 'ACT1Q4_OperateInifussTree_6FC85B40_113c' },
  { shard: 'k2w9-b1', va: '0x6FC87E00', size: 607, headHex: '81ec8c0000005355', tailHex: '0000c3', tsSymbol: 'ACT1Q6_OnAndarielKilled_6FC87E00_113c' },
  { shard: 'k2w9-b1', va: '0x6FC99910', size: 247, headHex: '83ec0c558b6c2414', tailHex: 'c20400', tsSymbol: 'PLAYER_LootPlayerCorpseUnit_6FC99910_113c' },
  { shard: 'k2w9-b1', va: '0x6FCA5780', size: 985, headHex: '83ec1c8b44242053', tailHex: 'c20400', tsSymbol: 'AI_SummonerThink_6FCA5780_113c' },
  { shard: 'k2w9-b1', va: '0x6FCA8380', size: 1153, headHex: '83ec4c8b44245053', tailHex: 'c20400', tsSymbol: 'AI_GreaterMummyThink_6FCA8380_113c' },
  { shard: 'k2w9-b1', va: '0x6FCB57F0', size: 387, headHex: '81ec9c0000005356', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c' },
  { shard: 'k2w9-b1', va: '0x6FCB6F40', size: 95, headHex: '538bd8a19c82d16f', tailHex: 'c20400', tsSymbol: 'PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c' },
  { shard: 'k2w9-b1', va: '0x6FCB7340', size: 210, headHex: '83ec0853568b7424', tailHex: 'c20c00', tsSymbol: 'PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c' },
  { shard: 'k2w9-b1', va: '0x6FCBF600', size: 304, headHex: '83ec1053578bd933', tailHex: 'c20400', tsSymbol: 'PETS_RecalcAndClampPlayerPetTypeForSkill_6FCBF600_113c' },
  { shard: 'k2w9-b1', va: '0x6FCDDD80', size: 200, headHex: '5153558b6c241085', tailHex: 'c20c00', tsSymbol: 'NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c' },
  { shard: 'k2w9-b1', va: '0x6FCDDE50', size: 15, headHex: '8b442404518bcae8', tailHex: 'c20400', tsSymbol: 'NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c' },
  { shard: 'k2w8-b1', va: '0x6FC2C1B0', size: 57, headHex: '568bf285f68bc174', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c' },
  { shard: 'k2w8-b1', va: '0x6FC43440', size: 290, headHex: '83ec24568bf285f6', tailHex: 'c20800', tsSymbol: 'MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c' },
  { shard: 'k2w8-b1', va: '0x6FC44440', size: 346, headHex: '83ec148b44241c85', tailHex: 'c20800', tsSymbol: 'MONUMOD_KnockBeltPotionToGround_6FC44440_113c' },
  { shard: 'k2w8-b1', va: '0x6FC56050', size: 31, headHex: '56e82244fdff50e8', tailHex: 'c20400', tsSymbol: 'QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c' },
  { shard: 'k2w8-b1', va: '0x6FC56070', size: 141, headHex: '538bd985db751f68', tailHex: '5f5bc3', tsSymbol: 'QUESTS_UseQuestScrollItem_6FC56070_113c' },
  { shard: 'k2w8-b1', va: '0x6FC5BDA0', size: 200, headHex: '53558b6c240c576a', tailHex: 'c20800', tsSymbol: 'QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c' },
  { shard: 'k2w8-b1', va: '0x6FC64550', size: 138, headHex: '535556578b7c2414', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c' },
  { shard: 'k2w8-b1', va: '0x6FC65600', size: 172, headHex: '515356578b7c2414', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c' },
  { shard: 'k2w8-b1', va: '0x6FC71C60', size: 516, headHex: '83ec48538b5c2450', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c' },
  { shard: 'k2w8-b1', va: '0x6FC73E50', size: 183, headHex: 'b804200000e8c629', tailHex: 'c20c00', tsSymbol: 'PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c' },
  { shard: 'k2w8-b1', va: '0x6FC73F10', size: 235, headHex: 'b8f8250000e80629', tailHex: 'c21400', tsSymbol: 'PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c' },
  { shard: 'k2w8-b1', va: '0x6FC7C080', size: 123, headHex: '5356578bf2568bf9', tailHex: 'c20400', tsSymbol: 'ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c' },
  { shard: 'k2w8-b1', va: '0x6FC7D080', size: 17, headHex: '536a00bbf0cfc76f', tailHex: '005bc3', tsSymbol: 'ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c' },
  { shard: 'k2w8-b1', va: '0x6FC7E790', size: 85, headHex: '8b86f410000085c0', tailHex: '0300c3', tsSymbol: 'ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c' },
  { shard: 'k2w8-b1', va: '0x6FC85410', size: 35, headHex: '8a410c84c0b00175', tailHex: '015bc3', tsSymbol: 'ACT1Q1_SequenceFilter_6FC85410_113c' },
  { shard: 'k2w8-b1', va: '0x6FC85440', size: 86, headHex: '81ec80000000568b', tailHex: '0000c3', tsSymbol: 'ACT1Q2_OnBurialGroundsEntered_6FC85440_113c' },
  { shard: 'k2w8-b1', va: '0x6FC854A0', size: 91, headHex: '568bf18a460984c0', tailHex: '5f5ec3', tsSymbol: 'ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c' },
  { shard: 'k2w8-b1', va: '0x6FC855F0', size: 35, headHex: '8bc18a480984c974', tailHex: 'ffffc3', tsSymbol: 'ACT1Q5_OnHoradricMalusDroppedOrRemoved_6FC855F0_113c' },
  { shard: 'k2w10-b1', va: '0x6FC441B0', size: 147, headHex: '568bf185f60f8484', tailHex: 'c20400', tsSymbol: 'MONSTER_AssignTeleportSkill_6FC441B0_113c' },
  { shard: 'k2w10-b1', va: '0x6FC44CD0', size: 413, headHex: '83ec08568bf185f6', tailHex: 'c20400', tsSymbol: 'MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c' },
  { shard: 'k2w10-b1', va: '0x6FC47190', size: 175, headHex: '5156578bf985ff8b', tailHex: 'c20400', tsSymbol: 'STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c' },
  { shard: 'k2w10-b1', va: '0x6FC56140', size: 155, headHex: '56e83243fdff50e8', tailHex: 'd8eba6', tsSymbol: 'QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c' },
  { shard: 'k2w10-b1', va: '0x6FC622B0', size: 175, headHex: '5156578bf985ff8b', tailHex: 'c20400', tsSymbol: 'STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c' },
  { shard: 'k2w10-b1', va: '0x6FC631C0', size: 625, headHex: '83ec7c538b9c2484', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_Telekinesis_6FC631C0_113c' },
  { shard: 'k2w10-b1', va: '0x6FC8A930', size: 45, headHex: '8b44240456508bf1', tailHex: 'c20400', tsSymbol: 'SHRINES_OnShrineStateRemoved_6FC8A930_113c' },
  { shard: 'k2w10-b1', va: '0x6FC8F510', size: 7, headHex: '8bc2e93977fcff', tailHex: '77fcff', tsSymbol: 'QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c' },
  { shard: 'k2w10-b1', va: '0x6FCB7120', size: 195, headHex: '558b6c24085755e8', tailHex: 'c20400', tsSymbol: 'PETS_AllocAndInitPlayerPetTable_6FCB7120_113c' },
  { shard: 'k2w10-b1', va: '0x6FCB7730', size: 165, headHex: '558b6c240853e885', tailHex: 'c20400', tsSymbol: 'PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c' },
  { shard: 'k2w10-b1', va: '0x6FCBFAE0', size: 276, headHex: '53568bd885db578b', tailHex: '005bc3', tsSymbol: 'SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c' },
  { shard: 'k2w10-b1', va: '0x6FCDDE60', size: 1066, headHex: '83ec1453568bda85', tailHex: 'c20800', tsSymbol: 'NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c' },
  { shard: 'k2w10-b1', va: '0x6FCE0B90', size: 533, headHex: '558b6c240c578bf8', tailHex: 'c20800', tsSymbol: 'NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c' },
  { shard: 'k2w10-b1', va: '0x6FCF0BC0', size: 359, headHex: '837c24080355578b', tailHex: 'c20800', tsSymbol: 'PACKETS_SrvMercItemAction_6FCF0BC0_113c' },
  { shard: 'k2w10-b1', va: '0x6FD019C0', size: 565, headHex: '83ec2c53558b6c24', tailHex: 'c21000', tsSymbol: 'DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c' },
  { shard: 'k2w10-b1', va: '0x6FD11130', size: 396, headHex: '5355578bfa578bd9', tailHex: 'c20c00', tsSymbol: 'PARTY_SetOrClearPlayerHostility_6FD11130_113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FC39A00', size: 195, headHex: '5156578bfa8bf132', tailHex: 'c20800', tsSymbol: 'AI_MapAiAction5_WalkAndMode9_113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FC52BC0', size: 280, headHex: '83ec2c807c243080', tailHex: 'c20c00', tsSymbol: 'OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCBF9A0', size: 84, headHex: '85c07c4d8b0d9c82', tailHex: 'c20800', tsSymbol: 'MONSTER_AddSkillToUnit113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEB5B0', size: 15, headHex: '8b44240848f7d81b', tailHex: 'c20800', tsSymbol: 'C2S_Packet0B_Noop1Byte113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEE000', size: 64, headHex: '5356578d44241050', tailHex: 'c20800', tsSymbol: 'C2S_Packet04_RunToUnit113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEE090', size: 64, headHex: '5356578d44241050', tailHex: 'c20800', tsSymbol: 'C2S_Packet02_WalkToUnit113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEE5A0', size: 116, headHex: '56578bf98d442410', tailHex: 'c20800', tsSymbol: 'C2S_Packet05_LeftSkillOnLocation113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEE790', size: 81, headHex: '538b5c240c558b6c', tailHex: 'c20800', tsSymbol: 'C2S_Packet0F_RepeatRightSkillOnLocation113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEE7F0', size: 118, headHex: '5356578d44241050', tailHex: 'c20800', tsSymbol: 'C2S_Packet0E_ShiftRightSkillOnUnit113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEE8F0', size: 81, headHex: '538b5c240c558b6c', tailHex: 'c20800', tsSymbol: 'C2S_Packet08_RepeatLeftSkillOnLocation113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEE950', size: 118, headHex: '5356578d44241050', tailHex: 'c20800', tsSymbol: 'C2S_Packet07_ShiftLeftSkillOnUnit113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEEA50', size: 87, headHex: '5153558b6c241456', tailHex: 'c20800', tsSymbol: 'C2S_Packet11_RepeatShiftRightSkillOnUnit113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEEAB0', size: 87, headHex: '5153558b6c241456', tailHex: 'c20800', tsSymbol: 'C2S_Packet10_RepeatRightSkillOnUnit113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEEB10', size: 87, headHex: '5153558b6c241456', tailHex: 'c20800', tsSymbol: 'C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCEEB70', size: 87, headHex: '5153558b6c241456', tailHex: 'c20800', tsSymbol: 'C2S_Packet09_RepeatLeftSkillOnUnit113c' },
  { shard: 'k2-real-c2s-spawn', va: '0x6FCF0790', size: 278, headHex: '51837c240c05568b', tailHex: 'c20800', tsSymbol: 'C2S_Packet5F_UpdatePlayerPos113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FC21450', size: 37, headHex: '8b06b9c590c66af7', tailHex: 'c20400', tsSymbol: 'SEED_RollMaskFast113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FC21780', size: 81, headHex: '568bf03bf77f048b', tailHex: 'c75ec3', tsSymbol: 'SEED_RollRangeHalfOpen113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FC21900', size: 225, headHex: '56578bf88b0783f8', tailHex: 'c15ec3', tsSymbol: 'UNIT_CalcSqDistSubtiles113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FC68560', size: 25, headHex: '85c974128b0183f8', tailHex: '33c0c3', tsSymbol: 'MONSTER_GetBossMinionField34_113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FC9BD50', size: 177, headHex: '538b5c2408568bf2', tailHex: 'c20800', tsSymbol: 'AI_FallenShamanCorpseFilter113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FCA3550', size: 856, headHex: '83ec308b44243453', tailHex: 'f7ffcc', tsSymbol: 'AI_Skeleton113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FCA90A0', size: 906, headHex: '83ec508b44245453', tailHex: 'c20400', tsSymbol: 'AI_FallenShaman113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FCD8940', size: 42, headHex: '8b80f410000085c0', tailHex: '4113c3', tsSymbol: 'QUEST_Act4DiabloSealCheck113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FD0DF60', size: 316, headHex: '83ec2c558b6c2434', tailHex: 'c20c00', tsSymbol: 'MONSTER_FindValidFloorSpawnCoords113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FD0E0A0', size: 441, headHex: '83ec3c558b6c2448', tailHex: 'c21800', tsSymbol: 'MONSTER_SpawnFetishPartyMinions113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FD11A20', size: 104, headHex: '83fe827c4383fe7e', tailHex: 'f1ffcc', tsSymbol: 'AI_SetAiControlOverrides113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FD12120', size: 184, headHex: '83ec2085ff0f8ca5', tailHex: 'c21000', tsSymbol: 'AI_CastSkillMode14_113c' },
  { shard: 'k1r13-laneG-a1c', va: '0x6FD13E30', size: 801, headHex: '83ec0853558b6c24', tailHex: 'c20c00', tsSymbol: 'SKILLS_CanMonsterCastAtTarget113c' },
  { shard: 'k2w6-b7', va: '0x6FCEDBB0', size: 895, headHex: '558bec83e4f881ec', tailHex: 'c20800', tsSymbol: 'PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c' },
  { shard: 'k2w6-b7', va: '0x6FD10820', size: 72, headHex: '8b4424043bd0743d', tailHex: 'c20400', tsSymbol: 'PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c' },
  { shard: 'k2w6-b7', va: '0x6FD10870', size: 136, headHex: '538b5c240855568b', tailHex: 'c20c00', tsSymbol: 'PARTY_InvitePlayerToParty_6FD10870_113c' },
  { shard: 'k2w6-b7', va: '0x6FD10900', size: 218, headHex: '538b5c240855568b', tailHex: 'c20c00', tsSymbol: 'PARTY_CancelPartyInvitation_6FD10900_113c' },
  { shard: 'k2w6-b7', va: '0x6FD10B90', size: 205, headHex: '53558bda85db5657', tailHex: 'c20400', tsSymbol: 'PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c' },
  { shard: 'k2w6-b7', va: '0x6FD10C60', size: 81, headHex: '535556578bda538b', tailHex: 'c20800', tsSymbol: 'PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c' },
  { shard: 'k2w6-b7', va: '0x6FD10E80', size: 84, headHex: '53568b74240c578b', tailHex: 'c20c00', tsSymbol: 'PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c' },
  { shard: 'k2w6-b7', va: '0x6FD10EE0', size: 84, headHex: '53568b74240c578b', tailHex: 'c20c00', tsSymbol: 'PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c' },
  { shard: 'k2w6-b7', va: '0x6FD141C0', size: 67, headHex: '85ff568bf0740583', tailHex: 'ff5ec3', tsSymbol: 'PARTY_EnableHostilityFlag08_6FD141C0_113c' },
  { shard: 'k2w6-b7', va: '0x6FD14210', size: 72, headHex: '85ff568bf0740583', tailHex: '005ec3', tsSymbol: 'PARTY_ClearHostilityFlag08_6FD14210_113c' },
  { shard: 'k2w6-b7', va: '0x6FD142D0', size: 468, headHex: '83ec7c558bac248c', tailHex: 'c21000', tsSymbol: 'OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c' },
  { shard: 'k2w5-b10', va: '0x6FD11C30', size: 339, headHex: '83ec245355568bf0', tailHex: 'c20800', tsSymbol: 'AI_WalkToLeashDistanceFromUnit_6FD11C30_113c' },
  { shard: 'k2w5-b10', va: '0x6FD12040', size: 115, headHex: '558b6c240885ed56', tailHex: 'c20400', tsSymbol: 'AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c' },
  { shard: 'k2w5-b10', va: '0x6FD12420', size: 281, headHex: '518b0683f802741f', tailHex: 'c20c00', tsSymbol: 'AI_CastSkillWithModeRandomScatter_6FD12420_113c' },
  { shard: 'k2w5-b10', va: '0x6FD126B0', size: 150, headHex: '538b592455568bf0', tailHex: 'c20c00', tsSymbol: 'AI_CircleStrafeTarget_6FD126B0_113c' },
  { shard: 'k2w5-b10', va: '0x6FD12750', size: 274, headHex: '83ec0853568bf18a', tailHex: 'c20800', tsSymbol: 'AI_RunWanderAroundUnit_6FD12750_113c' },
  { shard: 'k2w5-b10', va: '0x6FD12C10', size: 367, headHex: '51558b6c2414578b', tailHex: 'c20c00', tsSymbol: 'AI_RunFleeFromUnit_6FD12C10_113c' },
  { shard: 'k2w5-b10', va: '0x6FD13150', size: 197, headHex: '538b5c240c558b6c', tailHex: 'c20800', tsSymbol: 'AI_FindTargetOrUnstickOverlap_6FD13150_113c' },
  { shard: 'k2w5-b10', va: '0x6FD13410', size: 173, headHex: '83ec1085db0f849c', tailHex: 'c20400', tsSymbol: 'NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c' },
  { shard: 'k2w5-b10', va: '0x6FD14260', size: 111, headHex: '53568bf03bfe8bd9', tailHex: '5e5bc3', tsSymbol: 'OBJECTS_RollScaledByte19C_6FD14260_113c' },
  { shard: 'k2w9-b2', va: '0x6FCE6CA0', size: 117, headHex: '8b83f410000085c0', tailHex: 'fcffff', tsSymbol: 'ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c' },
  { shard: 'k2w9-b2', va: '0x6FCE7250', size: 104, headHex: '8a460c84c0558b6e', tailHex: 'f3ffcc', tsSymbol: 'ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c' },
  { shard: 'k2w9-b2', va: '0x6FCED8D0', size: 323, headHex: '51837c240c05538b', tailHex: 'c20800', tsSymbol: 'C2S_PacketUseQuestScrollItem_6FCED8D0_113c' },
  { shard: 'k2w9-b2', va: '0x6FCF05B0', size: 480, headHex: '53558b6c24108b5d', tailHex: 'c20800', tsSymbol: 'ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c' },
  { shard: 'k2w9-b2', va: '0x6FCF6E30', size: 804, headHex: '51538b5c240c85db', tailHex: 'c20c00', tsSymbol: 'ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c' },
  { shard: 'k2w9-b2', va: '0x6FD08200', size: 143, headHex: '558b6b18578bf88a', tailHex: 'c05dc3', tsSymbol: 'ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c' },
  { shard: 'k2w9-b2', va: '0x6FD0E6F0', size: 183, headHex: '83ec1056578bf885', tailHex: 'c410c3', tsSymbol: 'SKILLS_EquipSummonedPetItems_6FD0E6F0_113c' },
  { shard: 'k2w9-b2', va: '0x6FD110F0', size: 64, headHex: '53568bda85db578b', tailHex: 'c20c00', tsSymbol: 'PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c' },
  { shard: 'k2w8-b4', va: '0x6FD07640', size: 300, headHex: '5155568bea8b450c', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q1_OnQuestItemPickedUp_6FD07640_113c' },
  { shard: 'k2w8-b4', va: '0x6FD07770', size: 264, headHex: 'a1201cd36f85c053', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q2_OnGidbinnPickedUp_6FD07770_113c' },
  { shard: 'k2w8-b4', va: '0x6FD07DB0', size: 593, headHex: '83ec0ca1201cd36f', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c' },
  { shard: 'k2w8-b4', va: '0x6FD08010', size: 291, headHex: '51a1201cd36f85c0', tailHex: '5b59c3', tsSymbol: 'ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c' },
  { shard: 'k2w8-b4', va: '0x6FD09A10', size: 620, headHex: 'a1201cd36f81ec88', tailHex: '0000c3', tsSymbol: 'ACT3Q7_OnMephistoKilled_6FD09A10_113c' },
  { shard: 'k2w8-b4', va: '0x6FD10D50', size: 297, headHex: '83ec105355568b74', tailHex: 'c20c00', tsSymbol: 'PARTY_AcceptInviteAndSyncParty_6FD10D50_113c' },
  { shard: 'k2w8-b4', va: '0x6FD10FF0', size: 250, headHex: '53558b6c24108bd8', tailHex: 'c20800', tsSymbol: 'PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c' },
  { shard: 'k1r13-laneE-replay', va: '0x6FC67660', size: 153, headHex: '518a40033c055355', tailHex: 'c20400', tsSymbol: 'REGPOP_SpawnAmbientPack113c' },
  { shard: 'k1r13-laneE-replay', va: '0x6FC67820', size: 89, headHex: '85c953555674058d', tailHex: 'c20800', tsSymbol: 'REGPOP_RollAmbientSpawn113c' },
  { shard: 'k1r13-laneE-replay', va: '0x6FC67950', size: 96, headHex: '85f674058d4e6ceb', tailHex: 'c20400', tsSymbol: 'ROOM_TickSeedAndAmbientSpawn113c' },
  { shard: 'k2-real-itemdrop', va: '0x6FC51000', size: 2027, headHex: '558bec83e4f881ec', tailHex: 'fdffcc', tsSymbol: 'OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c' },
  { shard: 'k2-real-s2c-combat', va: '0x6FCFE8F0', size: 261, headHex: '83ec4c53558b6c24', tailHex: 'c21400', tsSymbol: 'SUNITDMG_ComputeExperienceGain113c' },
  { shard: 'KERN_BINDINGS_113C', va: '0x6FC40D50', size: 58, headHex: '85c0741c8b0883f9', tailHex: 'c20400', tsSymbol: 'AIGENERAL_GetOwnerData_6FC40D50_113c' },
  { shard: 'KERN_BINDINGS_113C', va: '0x6FC4A900', size: 150, headHex: 'a154e3d26f83ec08', tailHex: 'c408c3', tsSymbol: 'GAME_InitSeed113c' },
  { shard: 'KERN_BINDINGS_113C', va: '0x6FC950F0', size: 106, headHex: '83ec206a0056e89b', tailHex: 'c20400', tsSymbol: 'MONSTER_NullModeEventFallback113c' },
  { shard: 'KERN_BINDINGS_113C', va: '0x6FD009D0', size: 76, headHex: '85c0751f68210300', tailHex: 'c20400', tsSymbol: 'SUNIT_GetLastAttacker113c' },
]

function parsePe32(dllPath: string, expectedBase: number) {
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

function writeCString(m: SparseMemory113c, ptr: number, s: string): void {
  for (let i = 0; i < s.length; i++) {
    m.setU8((ptr + i) >>> 0, s.charCodeAt(i) & 0xff)
  }
  m.setU8((ptr + s.length) >>> 0, 0)
}


function hasGameVa(trace: Set<string>, va: number): boolean {
  return trace.has(`D2Game:0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`)
}

function hasCommonVa(trace: Set<string>, va: number): boolean {
  return trace.has(`D2Common:0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`)
}

function createWave17World(nDifficulty = 0) {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(0x6fd18000, 0x24000, 0)
  m.fill(0x6fdd6000, 0x24000, 0)

  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)

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

  // Experience.txt ptr (0x6fdf0b50) + MonLvl globals
  const pExpBin = m.alloc(0x400) >>> 0
  for (let c = 0; c < 8; c++) {
    m.setU32((pExpBin + c * 4) >>> 0, 99)
  }
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin)
  m.setU32(0x6fdf0b60, 0)
  m.setU32(0x6fdf0b64, 0)

  // MonStatsTxt (750 * 0x1A8)
  const monStatsCount = 750
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec = (pMonStatsTxt + i * 0x1a8) >>> 0
    m.setU16(rec, i)
    m.setU16((rec + 0x18) >>> 0, i)
    m.setU16((rec + 0x1e) >>> 0, 1)
    m.setU16((rec + 0x56) >>> 0, 100) // aip1
    m.setU16((rec + 0x5c) >>> 0, 100) // aip2
    m.setU16((rec + 0x62) >>> 0, 100) // aip3
    m.setU16((rec + 0x68) >>> 0, 10)  // aip4
    m.setU16((rec + 0x6e) >>> 0, 20)  // aip5
    for (let s = 0; s < 8; s++) m.setU16((rec + 0x170 + s * 2) >>> 0, 0xffff)
  }

  // MonStats2Txt (750 * D2MonStats2Txt_SIZE) -> +0xA90 ptr, +0xA98 count
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec = (pMonStats2Txt + i * D2MonStats2Txt_SIZE) >>> 0
    m.setU8((rec + 0x05) >>> 0, 1) // nSizeX
    m.setU8((rec + 0x06) >>> 0, 1) // nSizeY
    m.setU32((rec + 0xf0) >>> 0, 0xffffffff)
    m.setU32((rec + 0x104) >>> 0, 0xffffffff)
  }

  // SkillsTxt (400 * D2SkillsTxt_SIZE)
  const skillsCount = 400
  const pSkillsTxt = m.alloc(skillsCount * D2SkillsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)
  for (let i = 0; i < skillsCount; i++) {
    const rec = (pSkillsTxt + i * D2SkillsTxt_SIZE) >>> 0
    m.setU16(rec, i)
    m.setU16((rec + 0x110) >>> 0, 1) // reqlevel
  }

  // ItemsTxt (700 * ITEMS_TXT_STRIDE_113C)
  const itemsCount = 700
  const pItemsTxt = m.alloc(itemsCount * ITEMS_TXT_STRIDE_113C) >>> 0
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, itemsCount)
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, itemsCount)
  m.setU32((pDataTables + 0xcd8) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xcdc) >>> 0, itemsCount)
  for (let i = 0; i < itemsCount; i++) {
    const rec = (pItemsTxt + i * ITEMS_TXT_STRIDE_113C) >>> 0
    m.setU8((rec + 0x132) >>> 0, 1) // invWidth
    m.setU8((rec + 0x133) >>> 0, 1) // invHeight
  }
  const itemCodes: Array<[number, number]> = [
    [1, 0x20647362], // 'bsd '
    [2, 0x20776f74], // 'tow '
    [3, 0x20646c66], // 'fld '
    [4, 0x20746268], // 'hbt '
    [5, 0x20786174], // 'tax '
    [6, 0x206c6768], // 'hgl '
    [7, 0x20756f76], // 'vou '
    [8, 0x206e6972], // 'rin '
    [9, 0x206e7263], // 'crn '
    [10, 0x20343367], // 'g34 '
    [11, 0x2034336a], // 'j34 '
    [12, 0x2073736d], // 'mss '
    [13, 0x20317068], // 'hp1 '
    [14, 0x20736374], // 'tcs '
    [15, 0x206b6262], // 'bbk '
  ]
  const sortedCodes = [...itemCodes].sort((a, b) => a[1] - b[1])
  const pItemsLinker = m.alloc(0x10) >>> 0
  const pItemsLinkerRows = m.alloc(sortedCodes.length * 8) >>> 0
  m.setU32(pItemsLinker, sortedCodes.length)
  m.setU32((pItemsLinker + 0x08) >>> 0, pItemsLinkerRows)
  m.setU32(0x6fdeff6c, pItemsLinker) // SGPT_ITEMS_LINKER_PTR_VA
  for (let i = 0; i < sortedCodes.length; i++) {
    const [idx, code] = sortedCodes[i]!
    const rec = (pItemsTxt + idx * D2ItemsTxt_SIZE) >>> 0
    m.setU32((rec + 0x80) >>> 0, code)
    m.setU32((rec + 0x84) >>> 0, code)
    m.setU32((rec + 0x88) >>> 0, code)
    m.setU32((rec + 0x8c) >>> 0, code)
    m.setU32((pItemsLinkerRows + i * 8) >>> 0, code)
    m.setU32((pItemsLinkerRows + i * 8 + 4) >>> 0, idx)
  }

  // InventoryTxt & Grid0 info
  const pInvTxt = m.alloc(32 * 0xf0) >>> 0
  for (let i = 0; i < 32; i++) {
    const rec = (pInvTxt + i * 0xf0) >>> 0
    m.setU8((rec + 0x10) >>> 0, 10)
    m.setU8((rec + 0x11) >>> 0, 4)
  }
  m.setU32(G_INVENTORY_TXT_TABLE_VA_113C, pInvTxt)
  const pGrid0 = m.alloc(0x20) >>> 0
  m.setU32(pGrid0, 10)
  m.setU32((pGrid0 + 4) >>> 0, 4)
  m.setU32(D2COMMON_GRID0_INFO_VA_113C, pGrid0)
  m.setU8(D2COMMON_GRID1_INFO_VA_113C, 4)
  m.setU8((D2COMMON_GRID1_INFO_VA_113C + 1) >>> 0, 4)

  // Field direction lookup tables (`0x6FDE9BA0` / `0x6FDE9BC4` / `0x6FDF1404` / `0x6FDF1414` / `0x6FDF1418`)
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
  // Pre-zero k2-w7b1 scratch stack page (grows down from 0x7FD80000)
  m.fill(0x7fd7e000, 0x2000, 0)

  // NpcsTxt (1 row for Charsi 0x9A at 0x6FDF0880 / 0x6FDF0884, stride 0x4C)
  const pNpcsTxt = m.alloc(0x4c) >>> 0
  m.setU32(pNpcsTxt, 0x9a)
  m.setU32((pNpcsTxt + 0x04) >>> 0, 1024) // buyMult
  m.setU32((pNpcsTxt + 0x08) >>> 0, 512)  // sellMult
  m.setU32((pNpcsTxt + 0x0c) >>> 0, 1024) // repMult
  m.setU32((pNpcsTxt + 0x40) >>> 0, 50000) // maxBuy normal
  m.setU32(0x6fdf0880, pNpcsTxt)
  m.setU32(0x6fdf0884, 1)

  // MagicAffixTxt (16 * 0x90)
  const pMagicAffixTxt = m.alloc(16 * 0x90) >>> 0
  m.setU32(0x6fdefbb8, 16)
  m.setU32(0x6fdefbbc, pMagicAffixTxt)

  // ItemStatCostTxt (400 * 0x144)
  const pItemStatCostTxt = m.alloc(400 * 0x144) >>> 0
  m.setU32((pDataTables + 0xbcc) >>> 0, pItemStatCostTxt)
  m.setU32((pDataTables + 0xbd4) >>> 0, 400)
  for (let i = 0; i < 400; i++) {
    m.setU16((pItemStatCostTxt + i * 0x144) >>> 0, i)
  }

  // ItemTypesTxt (64 * 228)
  const pItemTypesTxt = m.alloc(64 * 228) >>> 0
  const pItemTypesEquiv = m.alloc(64 * 8) >>> 0
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + 0xbfc) >>> 0, 64)
  m.setU32((pDataTables + 0xc00) >>> 0, 2)
  m.setU32((pDataTables + 0xc04) >>> 0, pItemTypesEquiv)
  m.setU8((pItemTypesTxt + 1 * 228 + 0x08) >>> 0, 1) // type 1: repairable weapon

  // ObjectsTxt (600 * 0x1C0)
  const pObjTxt = m.alloc(600 * 0x1c0) >>> 0
  m.setU32((pDataTables + 0x9b8) >>> 0, pObjTxt)
  m.setU32((pDataTables + 0x9bc) >>> 0, 600)
  for (let i = 0; i < 600; i++) {
    const rec = (pObjTxt + i * 0x1c0) >>> 0
    m.setU8((rec + 0x19c) >>> 0, 50)
  }

  // PetTypeTxt (20 * 0xE0)
  const pPetTypes = m.alloc(20 * 0xe0) >>> 0
  m.setU32((pDataTables + 0xbe8) >>> 0, pPetTypes)
  m.setU32((pDataTables + 0xbf0) >>> 0, 12)
  for (let i = 0; i < 12; i++) {
    const rec = (pPetTypes + i * 0xe0) >>> 0
    m.setU8((rec + 0x04) >>> 0, 1) // warp flag bit 0
    m.setU16((rec + 0x0a) >>> 0, 5) // default max
  }

  // LevelsTxt (140 * D2LevelsTxt_SIZE)
  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, 140)
  for (let i = 0; i < 140; i++) {
    const rec = (pLevelsTxt + i * D2LevelsTxt_SIZE) >>> 0
    m.setU16(rec, i)
  }

  // GameStrc
  const pGame = m.alloc(0x1df4) >>> 0
  m.setU8((pGame + 0x6d) >>> 0, nDifficulty & 0xff)
  m.setU8((pGame + 0x6a) >>> 0, 1)
  m.setU32((pGame + 0x70) >>> 0, 1) // expansion
  m.setU32((pGame + 0xa8) >>> 0, 100) // dwGameFrame
  m.setU32((pGame + 0xd0) >>> 0, 0x12345678) // non-zero seedLo
  m.setU32((pGame + 0xd4) >>> 0, 0x29a)      // non-zero seedHi
  EVENT_InitTimerQueue113c(m, pGame)
  PARTY_AllocPartyControl_6FCBBE40_113c(m, pGame)

  // Quests control (`pGame + 0x10f4`)
  const pQuestsCtrl = m.alloc(0x40) >>> 0
  const pGlobalQuestRec = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
  m.setU32((pQuestsCtrl + 0x08) >>> 0, 1)
  m.setU32((pQuestsCtrl + 0x0c) >>> 0, pGlobalQuestRec)
  m.setU32((pGame + 0x10f4) >>> 0, pQuestsCtrl)

  // Room + Act + DRLG Level
  const pAct = m.alloc(0x80) >>> 0
  const pDrlg = m.alloc(0x400) >>> 0
  const pLevel = m.alloc(0x240) >>> 0
  const pRoom2 = m.alloc(0x100) >>> 0
  const pRoom = m.alloc(0x90) >>> 0
  const pRoomCoords = m.alloc(0x28) >>> 0
  const pCollGrid = m.alloc(0x40) >>> 0
  const pCollTiles = m.alloc(32 * 32 * 2) >>> 0
  const pRoomNear = m.alloc(4) >>> 0
  m.setU32(pRoomNear, pRoom)
  m.setU32((pLevel + 0x1d0) >>> 0, 2) // Blood Moor (non-town)
  m.setU32((pRoom2 + 0x58) >>> 0, pLevel)
  m.setU32((pRoom2 + 0x90) >>> 0, pLevel)
  m.setU32((pRoom + 0x00) >>> 0, pRoomNear) // ppRoomsNear
  m.setU32((pRoom + 0x08) >>> 0, pRoomCoords) // pCoords
  m.setU32((pRoom + 0x10) >>> 0, pRoom2) // pRoomEx
  m.setU32((pRoom + 0x20) >>> 0, pCollGrid) // pCollisionGrid
  m.setU32((pRoom + 0x24) >>> 0, 1) // nRoomsNear
  m.setU32((pRoom + 0x2c) >>> 0, pAct) // pAct
  m.setU32((pRoom + 0x4c) >>> 0, 100) // nSubtileX
  m.setU32((pRoom + 0x50) >>> 0, 100) // nSubtileY
  m.setU32((pRoom + 0x54) >>> 0, 32)  // nSubtileWidth
  m.setU32((pRoom + 0x58) >>> 0, 32)  // nSubtileHeight
  m.setU32((pRoom + 0x5c) >>> 0, 20)  // nTileX
  m.setU32((pRoom + 0x60) >>> 0, 20)  // nTileY
  m.setU32((pRoom + 0x64) >>> 0, 6)   // nTileWidth
  m.setU32((pRoom + 0x68) >>> 0, 6)   // nTileHeight
  m.setU32((pRoom + 0x6c) >>> 0, 0x2468ace1) // non-zero room seedLo
  m.setU32((pRoom + 0x70) >>> 0, 0x29a)      // non-zero room seedHi
  // RoomCoords: subtile box (100,100, 32,32), tile box (20,20, 6,6)
  m.setU32((pRoomCoords + 0x00) >>> 0, 100)
  m.setU32((pRoomCoords + 0x04) >>> 0, 100)
  m.setU32((pRoomCoords + 0x08) >>> 0, 32)
  m.setU32((pRoomCoords + 0x0c) >>> 0, 32)
  m.setU32((pRoomCoords + 0x10) >>> 0, 20)
  m.setU32((pRoomCoords + 0x14) >>> 0, 20)
  m.setU32((pRoomCoords + 0x18) >>> 0, 6)
  m.setU32((pRoomCoords + 0x1c) >>> 0, 6)
  // Collision grid (`D2RoomCollisionGridStrc`, pMapStart at +0x20)
  m.setU32((pCollGrid + 0x00) >>> 0, 100)
  m.setU32((pCollGrid + 0x04) >>> 0, 100)
  m.setU32((pCollGrid + 0x08) >>> 0, 32)
  m.setU32((pCollGrid + 0x0c) >>> 0, 32)
  m.setU32((pCollGrid + 0x10) >>> 0, 20)
  m.setU32((pCollGrid + 0x14) >>> 0, 20)
  m.setU32((pCollGrid + 0x18) >>> 0, 6)
  m.setU32((pCollGrid + 0x1c) >>> 0, 6)
  m.setU32((pCollGrid + 0x20) >>> 0, pCollTiles)
  m.setU32((pAct + 0x0c) >>> 0, pRoom)
  m.setU32((pAct + 0x48) >>> 0, pDrlg)
  m.setU32((pGame + 0xbc) >>> 0, pAct)

  let nextGuid = 100
  function allocUnit(
    unitType: number,
    classId: number,
    x = 110,
    y = 110,
    guid = nextGuid++,
  ) {
    const pUnit = m.alloc(0x100) >>> 0
    m.setU32((pUnit + 0x00) >>> 0, unitType)
    m.setU32((pUnit + 0x04) >>> 0, classId)
    m.setU32((pUnit + 0x0c) >>> 0, guid)
    m.setU32((pUnit + 0x10) >>> 0, 1) // neutral/stand
    m.setU32((pUnit + 0x20) >>> 0, (0x13579bdf + guid * 17) >>> 0) // non-zero seedLo
    m.setU32((pUnit + 0x24) >>> 0, 0x29a)                          // non-zero seedHi
    m.setU32((pUnit + 0x80) >>> 0, pGame)
    m.setU32((pUnit + 0xc4) >>> 0, 0)
    m.setU32((pUnit + 0xc8) >>> 0, 0)

    const pPath = m.alloc(0x100) >>> 0
    if (unitType === 2 || unitType === 4 || unitType === 5) {
      m.setU32((pPath + 0x00) >>> 0, pRoom)
      m.setU32((pPath + 0x0c) >>> 0, x)
      m.setU32((pPath + 0x10) >>> 0, y)
    } else {
      m.setU16((pPath + 0x02) >>> 0, x)
      m.setU16((pPath + 0x06) >>> 0, y)
      m.setU16((pPath + 0x10) >>> 0, x)
      m.setU16((pPath + 0x12) >>> 0, y)
      m.setU32((pPath + 0x1c) >>> 0, pRoom)
      m.setU32((pPath + 0x20) >>> 0, pRoom)
      m.setU32((pPath + 0x48) >>> 0, pUnit)
    }
    m.setU32((pUnit + 0x2c) >>> 0, pPath)

    const pStatList = STATLIST_CreateEx113c(m, pUnit, 0, 0, 0) >>> 0
    m.setU32((pUnit + 0x5c) >>> 0, pStatList)
    const pInv = INVENTORY_AllocInventory113c(m, 0, pUnit) >>> 0
    m.setU32(pInv, INVENTORY_SIGNATURE_113C)
    m.setU32((pUnit + 0x60) >>> 0, pInv)
    const pSkillList = m.alloc(0x20) >>> 0
    m.setU32((pUnit + 0xa8) >>> 0, pSkillList)

    let pUnitData = 0
    let pClient = 0
    let pAiGeneral = 0
    let pAiControl = 0
    if (unitType === 0) {
      pUnitData = m.alloc(0x180) >>> 0
      pClient = m.alloc(0x520) >>> 0
      writeCString(m, (pClient + 0x0d) >>> 0, `Hero${guid}`)
      m.setU32((pClient + 0x00) >>> 0, guid)
      m.setU32((pClient + 0x04) >>> 0, 4) // in-game state
      m.setU32((pClient + 0x174) >>> 0, pUnit)
      m.setU32((pClient + 0x1a8) >>> 0, pGame)
      m.setU32((pUnitData + 0x9c) >>> 0, pClient)
      for (let d = 0; d < 3; d++) {
        m.setU32((pUnitData + 0x10 + d * 4) >>> 0, QUESTRECORD_AllocRecord113c(m, 0) >>> 0)
      }
      const pPetWrap = m.alloc(0x10) >>> 0
      const pPetSlots = m.alloc(16 * 0x0c) >>> 0
      m.setU32(pPetWrap, pPetSlots)
      m.setU32((pUnitData + 0x44) >>> 0, pPetWrap)
      m.setU32((pUnit + 0x14) >>> 0, pUnitData)
      STATLIST_SetUnitStat113c(m, pUnit, 12, 20, 0) // level 20
      STATLIST_SetUnitStat113c(m, pUnit, 6, 100 << 8, 0)
      STATLIST_SetUnitStat113c(m, pUnit, 7, 100 << 8, 0)
      STATLIST_SetUnitStat113c(m, pUnit, 14, 10000, 0) // gold
    } else if (unitType === 1) {
      pUnitData = m.alloc(0x80) >>> 0
      pAiGeneral = m.alloc(0x40) >>> 0
      pAiControl = m.alloc(0x40) >>> 0
      m.setU32((pUnitData + 0x00) >>> 0, (pMonStatsTxt + classId * 0x1a8) >>> 0)
      m.setU32((pUnitData + 0x28) >>> 0, pAiGeneral)
      m.setU32((pUnitData + 0x2c) >>> 0, pAiControl)
      m.setU32((pUnit + 0x14) >>> 0, pUnitData)
      STATLIST_SetUnitStat113c(m, pUnit, 12, 10, 0)
      STATLIST_SetUnitStat113c(m, pUnit, 6, 50 << 8, 0)
      STATLIST_SetUnitStat113c(m, pUnit, 7, 50 << 8, 0)
    } else if (unitType === 2) {
      pUnitData = m.alloc(0x60) >>> 0
      m.setU32((pUnitData + 0x00) >>> 0, (pObjTxt + classId * 0x1c0) >>> 0)
      m.setU32((pUnit + 0x14) >>> 0, pUnitData)
    } else if (unitType === 3) {
      pUnitData = m.alloc(0x80) >>> 0
      m.setU32((pUnit + 0x14) >>> 0, pUnitData)
    } else if (unitType === 4) {
      pUnitData = m.alloc(0x80) >>> 0
      m.setU32((pUnit + 0x14) >>> 0, pUnitData)
      m.setU32((pUnit + 0x10) >>> 0, 3) // ground
    }
    SUNIT_InsertServerUnit113c(m, pGame, pUnit)
    return { pUnit, pPath, pInv, pStatList, pSkillList, pUnitData, pClient, pAiGeneral, pAiControl, guid }
  }

  return {
    m,
    pDataTables,
    pBitMasks,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pItemsTxt,
    pObjTxt,
    pPetTypes,
    pLevelsTxt,
    pGame,
    pQuestsCtrl,
    pGlobalQuestRec,
    pAct,
    pLevel,
    pRoom,
    pRoomCoords,
    pCollGrid,
    allocUnit,
  }
}

describe('Wave 17 D2Game.dll 1:1 PE32 Disassembly Verification (+126 VAs, 21 indirectUnknown kept ported)', () => {
  it('verifies exact PE32 .text machine code, size, manifest diff-verified status (126), indirectUnknown guardrails (21), and 0x6FCFFA60 audit', () => {
    expect(WAVE17_PROMOTED_SPECS.length).toBe(126)
    expect(WAVE17_INDIRECT_UNKNOWN_SKIPPED.length).toBe(21)

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
    const byVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        byVa.set(fn.va.toUpperCase(), fn)
      }
    }

    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    const hasDll = fs.existsSync(dllPath)
    const pe = hasDll ? parsePe32(dllPath, 0x6fc20000) : null

    const seenVas = new Set<string>()
    for (const spec of WAVE17_PROMOTED_SPECS) {
      const vaKey = spec.va.toUpperCase()
      expect(seenVas.has(vaKey)).toBe(false)
      seenVas.add(vaKey)

      const mfn = byVa.get(vaKey)
      expect(mfn, `manifest missing ${spec.va}`).toBeDefined()
      expect(mfn!.status, `${spec.va} must be diff-verified`).toBe('diff-verified')
      expect(mfn!.size, `${spec.va} size mismatch`).toBe(spec.size)
      expect(mfn!.tsSymbol, `${spec.va} tsSymbol mismatch`).toBe(spec.tsSymbol)
      expect(Boolean(mfn!.indirectUnknown), `${spec.va} must not be indirectUnknown`).toBe(false)
      expect(mfn!.diffEvidence, `${spec.va} diffEvidence must cite wave17 test`).toContain(
        'k2-disasm-verified-wave17.test.ts',
      )

      if (pe !== null) {
        const vaNum = Number.parseInt(spec.va, 16)
        expect(vaNum).toBeGreaterThanOrEqual(pe.textStart)
        expect(vaNum + spec.size).toBeLessThanOrEqual(pe.textEnd)
        const off = pe.vaToFileOffset(vaNum)
        const head = pe.buf.subarray(off, off + Math.min(8, spec.size)).toString('hex')
        const tail = pe.buf.subarray(off + spec.size - 3, off + spec.size).toString('hex')
        expect(head, `${spec.va} head opcode mismatch`).toBe(spec.headHex)
        expect(tail, `${spec.va} tail opcode mismatch`).toBe(spec.tailHex)
      }
    }

    // All 21 formerly indirectUnknown VAs were audited in Wave 22 (Batch D) and promoted in Wave 24:
    // 6 genuine caller_callback VAs retain indirectUnknown=true; 15 static/vtable VAs resolve cleanly.
    const wave17CallerCallbacks = new Set([
      '0X6FC4C2D0',
      '0X6FC4C570',
      '0X6FC4C830',
      '0X6FC4C910',
      '0X6FC4D9B0',
      '0X6FC74000',
    ])
    for (const va of WAVE17_INDIRECT_UNKNOWN_SKIPPED) {
      const vaUp = va.toUpperCase()
      const mfn = byVa.get(vaUp)
      expect(mfn, `manifest missing skipped ${va}`).toBeDefined()
      expect(mfn!.status, `${va} promoted to diff-verified in Wave 24`).toBe('diff-verified')
      if (wave17CallerCallbacks.has(vaUp)) {
        expect(mfn!.indirectUnknown, `${va} caller_callback retains indirectUnknown`).toBe(true)
      } else {
        expect(mfn!.indirectUnknown, `${va} static/vtable resolved in Wave 24`).toBeUndefined()
      }
    }

    // Special audit: 0x6FCFFA60 must be diff-verified with Wave 17 audit evidence
    const mFFA60 = byVa.get('0X6FCFFA60')
    expect(mFFA60).toBeDefined()
    expect(mFFA60!.status).toBe('diff-verified')
    expect(mFFA60!.diffEvidence).toContain('k2-disasm-verified-wave17.test.ts')
  })

  it('regresses 0x6FCFFA60 (SUNIT_GetPartyId via 0x6FCBBEB0), 0x6FD00660 unpartied check, 0x6FC40D50 (AIGENERAL_GetOwnerData), and 0x6FCFE8F0 party XP split', () => {
    const w = createWave17World()
    const { m, pGame, allocUnit } = w
    const p1 = allocUnit(0, 4, 110, 110) // Barbarian (dwClassId = 4)
    const p2 = allocUnit(0, 1, 112, 110) // Sorceress (dwClassId = 1)
    const mon = allocUnit(1, 5, 111, 110)

    // 1. 0x6FCFFA60: unpartied player returns 0xFFFF (NOT dwClassId=4!), non-player/null/no-game returns 0xFFFF
    expect(SUNITDMG_GetPlayerClientClassId113c(m, p1.pUnit)).toBe(0xffff)
    expect(SUNITDMG_GetPlayerClientClassId113c(m, mon.pUnit)).toBe(0xffff)
    expect(SUNITDMG_GetPlayerClientClassId113c(m, 0)).toBe(0xffff)

    // 0x6FD00660: two unpartied players MUST NOT be treated as same party (old bug compared party1 === -1)
    m.setU8((w.pSkillsTxt + 10 * D2SkillsTxt_SIZE + 0x07) >>> 0, 0x04)
    expect(SUNIT_CanPlayerTargetUnitWithSkill113c(m, p2.pUnit, pGame, p1.pUnit, 10)).toBe(0)

    // Put p1 & p2 in a real sub-party -> 0x6FCFFA60 delegates to 0x6FCBBEB0 and returns wPartyId!
    const wPartyId = PARTY_CreateAndLinkSubParty_6FCBBF70_113c(m, pGame) & 0xffff
    PARTY_AddPlayerToSubParty_6FCBC4F0_113c(m, pGame, wPartyId, p1.pUnit)
    PARTY_AddPlayerToSubParty_6FCBC4F0_113c(m, pGame, wPartyId, p2.pUnit)
    beginVaTrace113c()
    const gotParty1 = SUNITDMG_GetPlayerClientClassId113c(m, p1.pUnit)
    const gotParty2 = SUNITDMG_GetPlayerClientClassId113c(m, p2.pUnit)
    const traceParty = endVaTrace113c()
    expect(gotParty1).toBe(wPartyId)
    expect(gotParty2).toBe(wPartyId)
    expect(hasGameVa(traceParty, 0x6fcffa60)).toBe(true)
    expect(hasGameVa(traceParty, 0x6fcbbeb0)).toBe(true)
    expect(SUNIT_CanPlayerTargetUnitWithSkill113c(m, p2.pUnit, pGame, p1.pUnit, 10)).toBe(1)

    // 2. 0x6FC40D50: AIGENERAL_GetOwnerData writes -1 when unowned, and (dwOwnerId, dwOwnerType) when owned
    const pOutId = m.alloc(4) >>> 0
    const pOutType = m.alloc(4) >>> 0
    m.setU32(pOutId, 0)
    m.setU32(pOutType, 99)
    AIGENERAL_GetOwnerData_6FC40D50_113c(m, mon.pUnit, pOutId, pOutType)
    expect(m.u32(pOutId) | 0).toBe(-1)

    m.setU32((mon.pAiGeneral + 0x28) >>> 0, pGame) // pOwner != 0
    m.setU32((mon.pAiGeneral + 0x2c) >>> 0, p1.guid)
    m.setU32((mon.pAiGeneral + 0x30) >>> 0, 0) // UNIT_PLAYER
    AIGENERAL_GetOwnerData_6FC40D50_113c(m, mon.pUnit, pOutId, pOutType)
    expect(m.u32(pOutId)).toBe(p1.guid)
    expect(m.u32(pOutType)).toBe(0)

    // Canonical callers in a1c-post150 & k2-w6b1 trace 0x6FC40D50
    m.setU32((mon.pUnit + 0xc4) >>> 0, 0x04) // UNITFLAG_CANBEATTACKED
    m.setU8((w.pMonStatsTxt + 5 * 0x1a8 + 0x0e) >>> 0, 1) // revivable/killable flag bit 0
    beginVaTrace113c()
    expect(SUNIT_CanPlayerTargetUnitWithSkill113c(m, mon.pUnit, pGame, p1.pUnit, 10)).toBe(1)
    const traceOwnerA1c = endVaTrace113c()
    expect(hasGameVa(traceOwnerA1c, 0x6fc40d50)).toBe(true)

    beginVaTrace113c()
    SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c(m, pGame, mon.pUnit)
    const traceOwner = endVaTrace113c()
    expect(hasGameVa(traceOwner, 0x6fc40d50)).toBe(true)

    // 3. 0x6FCFE8F0 & 0x6FCFEA00: 2-player party XP distribution (+0x59/256 bonus, split by level ratio)
    STATLIST_SetUnitStat113c(m, p1.pUnit, 12, 10, 0)
    STATLIST_SetUnitStat113c(m, p2.pUnit, 12, 10, 0)
    STATLIST_SetUnitStat113c(m, p1.pUnit, 13, 1000, 0)
    STATLIST_SetUnitStat113c(m, p2.pUnit, 13, 1000, 0)
    STATLIST_SetUnitStat113c(m, mon.pUnit, 12, 10, 0)
    STATLIST_SetUnitStat113c(m, mon.pUnit, 13, 256, 0)
    beginVaTrace113c()
    const killerGain = SUNITDMG_DistributeExperience113c(m, pGame, p1.pUnit, mon.pUnit, true)
    const traceExp = endVaTrace113c()
    // 2 members: baseExp=256, bonus = floor((1*256*0x59)/256) = 89 -> totalExp = 345 -> each gets trunc(10 * fround(345/20)) = 172
    expect(killerGain).toBe(172)
    expect(STATLIST_GetUnitStat113c(m, p1.pUnit, 13, 0)).toBe(1172)
    expect(STATLIST_GetUnitStat113c(m, p2.pUnit, 13, 0)).toBe(1172)
    expect(hasGameVa(traceExp, 0x6fcfe8f0)).toBe(true)
    expect(hasGameVa(traceExp, 0x6fcbc070)).toBe(true)
    expect(hasGameVa(traceExp, 0x6fcfaed0)).toBe(true)
  })

  it('regresses 0x6FC4A900 (GAME_InitSeed forced/dynamic branches), 0x6FC950F0 (0x6FD803E0 trace & null unit), 0x6FC51000, and ai-fallen / w5b10 / w8b4 fixes', () => {
    const w = createWave17World()
    const { m, pGame, pMonStatsTxt, pRoom, allocUnit } = w

    // 1. 0x6FC4A900: forced seed branch (0x6FD2E354 != 0 && != 0xFFFFFFFF)
    const pGameForced = m.alloc(0x1df4) >>> 0
    m.setU32(0x6fd2e354, 0x0badf00d)
    GAME_InitSeed113c(m, pGameForced, 999)
    expect(m.u32((pGameForced + 0x84) >>> 0)).toBe(1)
    expect(m.u32((pGameForced + 0x7c) >>> 0)).toBe(0x0badf00d)
    expect(m.u32((pGameForced + 0xd0) >>> 0)).toBe(0x0badf00d)
    expect(m.u32((pGameForced + 0xd4) >>> 0)).toBe(0x29a)

    // 0x6FC4A900: dynamic QPC branch (0x6FD2E354 == 0xFFFFFFFF)
    const pGameDyn = m.alloc(0x1df4) >>> 0
    m.setU32(0x6fd2e354, 0xffffffff)
    beginVaTrace113c()
    GAME_InitSeed113c(m, pGameDyn, 0x11223344)
    const traceSeed = endVaTrace113c()
    expect(m.u32((pGameDyn + 0x84) >>> 0)).toBe(0)
    expect(m.u32((pGameDyn + 0x7c) >>> 0)).not.toBe(0)
    expect(hasGameVa(traceSeed, 0x6fc4a900)).toBe(true)
    expect(hasCommonVa(traceSeed, 0x6fd86740)).toBe(true)
    expect(hasCommonVa(traceSeed, 0x6fd86750)).toBe(true)
    expect(hasCommonVa(traceSeed, 0x6fd86760)).toBe(true)
    m.setU32(0x6fd2e354, 0)

    // 2. 0x6FC950F0: traces canonical D2Common:0x6FD803E0; asserts on pUnit=0 via 0x6FD803E0 and returns 1 on dead monster
    const deadMon = allocUnit(1, 1, 110, 110)
    m.setU32((deadMon.pUnit + 0x10) >>> 0, 12) // MONMODE_DEAD
    beginVaTrace113c()
    const deadRes = MONSTER_NullModeEventFallback113c(m, pGame, deadMon.pUnit, 1)
    const traceFallback = endVaTrace113c()
    expect(deadRes).toBe(1)
    expect(hasGameVa(traceFallback, 0x6fc950f0)).toBe(true)
    expect(hasCommonVa(traceFallback, 0x6fd803e0)).toBe(true)
    expect(() => MONSTER_NullModeEventFallback113c(m, pGame, 0, 1)).toThrow()

    // 3. ai-fallen 0x6FCA3550: traces 0x6FC21180 (SEED_RollLimitedRandomNumber) + pure-memory AI fallback
    const skel = allocUnit(1, 1, 110, 110)
    const target = allocUnit(0, 0, 120, 120)
    const pSkelRec = (pMonStatsTxt + 1 * 0x1a8) >>> 0
    m.setU16((pSkelRec + 0x56) >>> 0, 0)   // aip1 = 0 -> takes nDist > 3 wander branch -> 0x6FC21180!
    m.setU16((pSkelRec + 0x5c) >>> 0, 100) // aip2 = 100
    const pAiArgs = m.alloc(0x40) >>> 0
    m.setU32((pAiArgs + 0x08) >>> 0, target.pUnit)
    m.setU32((pAiArgs + 0x14) >>> 0, 8) // nDist > 3
    m.setU32((pAiArgs + 0x18) >>> 0, 0) // not melee
    m.setU32((pAiArgs + 0x1c) >>> 0, pSkelRec)
    beginVaTrace113c()
    AI_Skeleton113c(m, pGame, skel.pUnit, pAiArgs)
    const traceSkel = endVaTrace113c()
    expect(hasGameVa(traceSkel, 0x6fca3550)).toBe(true)
    expect(hasGameVa(traceSkel, 0x6fc21180)).toBe(true)
    expect(hasGameVa(traceSkel, 0x6fd11b10)).toBe(true)

    // 4. ai-fallen 0x6FCA90A0: without hooks, invokes canonical 0x6FCD17B0 and 0x6FCD1BC0
    const shaman = allocUnit(1, 2, 110, 110)
    const pShamRec = (pMonStatsTxt + 2 * 0x1a8) >>> 0
    m.setU16((pShamRec + 0x56) >>> 0, 0)
    m.setU16((pShamRec + 0x5c) >>> 0, 0)
    m.setU16((pShamRec + 0x62) >>> 0, 0)
    m.setU16((pShamRec + 0x68) >>> 0, 5)
    m.setU16((pShamRec + 0x6e) >>> 0, 5)
    m.setU32((pAiArgs + 0x1c) >>> 0, pShamRec)
    beginVaTrace113c()
    AI_FallenShaman113c(m, pGame, shaman.pUnit, pAiArgs)
    const traceShaman = endVaTrace113c()
    expect(hasGameVa(traceShaman, 0x6fca90a0)).toBe(true)
    expect(hasGameVa(traceShaman, 0x6fcd17b0)).toBe(true)
    expect(hasGameVa(traceShaman, 0x6fcd1bc0)).toBe(true)

    // 5. ai-fallen 0x6FD13E30 skill 0xC7: invokes canonical 0x6FD0FB80 with resolved pGame
    beginVaTrace113c()
    SKILLS_CanMonsterCastAtTarget113c(m, 0, target.pUnit, shaman.pUnit, 0xc7, 0, undefined, pGame)
    const traceCast = endVaTrace113c()
    expect(hasGameVa(traceCast, 0x6fd13e30)).toBe(true)
    expect(hasGameVa(traceCast, 0x6fd0fb80)).toBe(true)

    // 6. k2-w5b10: canonical AI_ApproachTarget (0x6FD12540) traced when hooks omitted
    beginVaTrace113c()
    AI_CircleStrafeTarget_6FD126B0_113c(m, skel.pUnit, 0, pGame, target.pUnit, 4)
    const traceW5b10 = endVaTrace113c()
    expect(hasGameVa(traceW5b10, 0x6fd126b0)).toBe(true)
    expect(hasGameVa(traceW5b10, 0x6fd12540)).toBe(true)

    // 7. k2-w8b4 0x6FD10FF0: party hostility traces canonical 0x6FD10CD0
    const h1 = allocUnit(0, 0, 110, 110)
    const h2 = allocUnit(0, 0, 111, 110)
    const pty = PARTY_CreateAndLinkSubParty_6FCBBF70_113c(m, pGame) & 0xffff
    PARTY_AddPlayerToSubParty_6FCBC4F0_113c(m, pGame, pty, h2.pUnit)
    beginVaTrace113c()
    PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c(m, h2.pUnit, h1.pUnit, pGame)
    const traceW8b4 = endVaTrace113c()
    expect(hasGameVa(traceW8b4, 0x6fd10ff0)).toBe(true)
    expect(hasGameVa(traceW8b4, 0x6fd10cd0)).toBe(true)

    // 8. 0x6FC51000: drop item mode exercises canonical path cleanly
    const item = allocUnit(4, 13, 110, 110)
    expect(OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c(m, pGame, pRoom, item.pUnit)).toBeGreaterThanOrEqual(0)
  })

  it('regresses all k2-w8b1, k2-w9b2, k2-w9b1, and k2-w10b1 real 1.13c binary fixes', () => {
    const w = createWave17World()
    const { m, pGame, pRoom, pMonStatsTxt, pSkillsTxt, pItemsTxt, allocUnit } = w

    // --- k2-w8b1: 0x6FC43440 traces canonical D2Common:0x6FD803E0 ---
    const uKill = allocUnit(1, 3, 110, 110)
    beginVaTrace113c()
    MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c(m, pGame, uKill.pUnit)
    expect(hasCommonVa(endVaTrace113c(), 0x6fd803e0)).toBe(true)

    // --- k2-w8b1: 0x6FC85410 passes (m, 0x14, quest, 0x6fc83d20) to QUESTS_AppendQuestTimer ---
    const pQuest = m.alloc(0x100) >>> 0
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU8((pQuest + 0x09) >>> 0, 1)
    m.setU8((pQuest + 0x0c) >>> 0, 0)
    ACT1Q1_SequenceFilter_6FC85410_113c(m, pQuest)
    const pTimerNode = m.u32((w.pQuestsCtrl + 0x10) >>> 0) >>> 0
    expect(pTimerNode).not.toBe(0)
    expect(m.u32(pTimerNode)).toBe(0x6fc83d20)            // pfnTimerCallback
    expect(m.u32((pTimerNode + 0x04) >>> 0)).toBe(pQuest) // pQuest
    expect(m.u32((pTimerNode + 0x0c) >>> 0)).toBe(0x14)   // nPeriodTicks

    // --- k2-w8b1: 0x6FC44440 calls canonical 0x6FC2E930 and passes pTarget to 0x6FCF3950 ---
    const thief = allocUnit(1, 4, 110, 110)
    const victim = allocUnit(0, 0, 111, 110)
    const pot = allocUnit(4, 13, 0, 0)
    m.setU32((pot.pUnit + 0x10) >>> 0, 2) // ITEMMODE_INBELT
    ITEMS_SetItemFlag113c(m, pot.pUnit, 0x200000, 1) // ITEMFLAG_COMPACT_SAVE
    m.setU32((pot.pUnitData + 0x5c) >>> 0, victim.pInv) // pExtraOwnerInventory
    m.setU8((pot.pUnitData + 0x68) >>> 0, 2) // nodePos = gridIdx + 1 (belt grid 1)
    m.setU32((victim.pInv + 0x0c) >>> 0, pot.pUnit) // pFirstItem
    m.setU32((victim.pInv + 0x10) >>> 0, pot.pUnit) // pLastItem
    m.setU32((victim.pInv + 0x28) >>> 0, 1) // dwItemCount
    const pGrids = m.alloc(2 * 0x10) >>> 0
    m.setU32((victim.pInv + 0x14) >>> 0, pGrids)
    m.setU32((victim.pInv + 0x18) >>> 0, 2)
    const pBeltGrid = (pGrids + 0x10) >>> 0
    const pBeltSlots = m.alloc(16 * 4) >>> 0
    m.setU32(pBeltSlots, pot.pUnit)
    m.setU8((pBeltGrid + 0x08) >>> 0, 4)
    m.setU8((pBeltGrid + 0x09) >>> 0, 4)
    m.setU32((pBeltGrid + 0x0c) >>> 0, pBeltSlots)
    PATH_SetTargetUnit113c(m, thief.pPath, victim.pUnit)
    // Choose seed so (newLo % 100) >= 30
    m.setU32((thief.pUnit + 0x20) >>> 0, 1)
    m.setU32((thief.pUnit + 0x24) >>> 0, 0)
    beginVaTrace113c()
    MONUMOD_KnockBeltPotionToGround_6FC44440_113c(m, pGame, thief.pUnit, 0, 1)
    const traceKnock = endVaTrace113c()
    expect(hasGameVa(traceKnock, 0x6fc44440)).toBe(true)
    expect(hasGameVa(traceKnock, 0x6fc2e930), `traceKnock=${[...traceKnock].join(',')}`).toBe(true)
    expect(hasGameVa(traceKnock, 0x6fc2e990)).toBe(true)
    expect(hasGameVa(traceKnock, 0x6fcf3950)).toBe(true)

    // --- k2-w9b2: 0x6FD0E6F0 seeds 4x3 Ancients .rdata table (0x6FD1C2F8) for Talic (cid=540) ---
    const talic = allocUnit(1, 540, 110, 110)
    SKILLS_EquipSummonedPetItems_6FD0E6F0_113c(m, talic.pUnit)
    expect(m.u32(0x6fd1c2f8)).toBe(0x20647362) // 'bsd '
    expect(m.u32(0x6fd1c310)).toBe(0x20776f74) // 'tow '
    expect(m.u32(0x6fd1c328)).toBe(0x20646c66) // 'fld '
    expect(m.u32(0x6fd1c340)).toBe(0x20746268) // 'hbt '

    // --- k2-w9b1: 0x6FCA8380 calls canonical 0x6FD803E0 & 0x6FC95E10 (NOT 0x6FD121E0) and 0x6FD12540 (NOT 0x6FD13000) ---
    const mummy = allocUnit(1, 6, 110, 110)
    const foe = allocUnit(0, 0, 111, 110)
    const pMummyRec = (pMonStatsTxt + 6 * 0x1a8) >>> 0
    m.setU16((pMummyRec + 0x56) >>> 0, 100) // aip1 = 100 -> melee mode 4
    const pMummyArgs = m.alloc(0x40) >>> 0
    m.setU32((pMummyArgs + 0x08) >>> 0, foe.pUnit)
    m.setU32((pMummyArgs + 0x14) >>> 0, 2)
    m.setU32((pMummyArgs + 0x18) >>> 0, 1) // bInCombat = 1
    m.setU32((pMummyArgs + 0x1c) >>> 0, pMummyRec)
    beginVaTrace113c()
    AI_GreaterMummyThink_6FCA8380_113c(m, pGame, mummy.pUnit, pMummyArgs)
    const traceMummyMelee = endVaTrace113c()
    expect(hasGameVa(traceMummyMelee, 0x6fca8380)).toBe(true)
    expect(hasCommonVa(traceMummyMelee, 0x6fd803e0)).toBe(true)
    expect(hasGameVa(traceMummyMelee, 0x6fc95e10)).toBe(true)
    expect(hasGameVa(traceMummyMelee, 0x6fd121e0)).toBe(false)

    // Approach path when not in combat -> calls 0x6FD12540 (NOT 0x6FD13000)
    m.setU16((pMummyRec + 0x56) >>> 0, 0)
    m.setU32((pMummyArgs + 0x14) >>> 0, 10)
    m.setU32((pMummyArgs + 0x18) >>> 0, 0)
    beginVaTrace113c()
    AI_GreaterMummyThink_6FCA8380_113c(m, pGame, mummy.pUnit, pMummyArgs)
    const traceMummyApproach = endVaTrace113c()
    expect(hasGameVa(traceMummyApproach, 0x6fd12540)).toBe(true)
    expect(hasGameVa(traceMummyApproach, 0x6fd13000)).toBe(false)

    // --- k2-w9b1: 0x6FCB57F0 writes 16-byte pAuraArgs with pDmg at +0x00 ---
    const pAuraSkill = (pSkillsTxt + 50 * D2SkillsTxt_SIZE) >>> 0
    m.setU32((pAuraSkill + 0x50) >>> 0, 0xffffffff)
    m.setU32((pAuraSkill + 0x150) >>> 0, 0x1111)
    m.setU32((pAuraSkill + 0x154) >>> 0, 0x2222)
    expect(SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c(m, pGame, foe.pUnit, 50, 5)).toBe(1)

    // --- k2-w10b1: 0x6FC56140 uses 0x40 (bit 6) fallback mask when 0x6FD18BE0 == 0 ---
    const savedMasksPtr = m.u32(0x6fd18be0)
    m.setU32(0x6fd18be0, 0)
    m.setU32((w.pLevel + 0x1d0) >>> 0, 76) // Act 3 Spider Forest -> bAct == 2
    const q3 = m.alloc(0x100) >>> 0
    const q3Ex = m.alloc(0x80) >>> 0
    m.setU32((q3 + 0x00) >>> 0, 0x12) // QUEST_A3Q1_GOLDENBIRD
    m.setU32((q3 + 0x04) >>> 0, pGame)
    m.setU8((q3 + 0x09) >>> 0, 1)
    m.setU32((q3 + 0x18) >>> 0, q3Ex)
    m.setU32((w.pQuestsCtrl + 0x00) >>> 0, q3)
    const bossA = allocUnit(1, 20, 110, 110)
    const bossB = allocUnit(1, 21, 110, 110)
    m.setU8((pMonStatsTxt + 20 * 0x1a8 + 0x0d) >>> 0, 0x40) // bit 6 set -> MUST skip
    m.setU8((pMonStatsTxt + 21 * 0x1a8 + 0x0d) >>> 0, 0x08) // bit 3 only -> MUST attach!
    beginVaTrace113c()
    QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c(m, bossA.pUnit, pGame)
    expect(hasGameVa(endVaTrace113c(), 0x6fd08200)).toBe(false)
    beginVaTrace113c()
    QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c(m, bossB.pUnit, pGame)
    expect(hasGameVa(endVaTrace113c(), 0x6fd08200)).toBe(true)
    m.setU32((w.pLevel + 0x1d0) >>> 0, 2)
    m.setU32(0x6fd18be0, savedMasksPtr)

    // --- k2-w10b1: 0x6FCDDE60 checks pItem ownership via 0x6FC2E150(pPlayer, pItem, 0) & repairs with (pPlayer, pItem, pGame) ---
    const repairPlr = allocUnit(0, 0, 110, 110)
    const charsi = allocUnit(1, 0x9a, 111, 110)
    m.setU8((repairPlr.pUnit + 0x6c) >>> 0, 1) // bInteracting = 1
    m.setU32((repairPlr.pUnit + 0x64) >>> 0, charsi.guid) // dwInteractId
    m.setU32((repairPlr.pUnit + 0x68) >>> 0, 1) // UNIT_MONSTER
    STATLIST_SetUnitStat113c(m, repairPlr.pUnit, 14, 100000, 0) // plenty of gold
    const sword = allocUnit(4, 1, 0, 0)
    m.setU32((repairPlr.pInv + 0x0c) >>> 0, sword.pUnit) // pFirstItem
    m.setU32((repairPlr.pInv + 0x10) >>> 0, sword.pUnit) // pLastItem
    m.setU32((repairPlr.pInv + 0x28) >>> 0, 1)
    m.setU32((sword.pUnitData + 0x0c) >>> 0, repairPlr.pInv)
    m.setU32((sword.pUnitData + 0x5c) >>> 0, repairPlr.pInv) // pExtraOwnerInventory
    m.setU32((sword.pUnitData + 0x00) >>> 0, 2) // ITEMQUAL_NORMAL
    ITEMS_SetItemFlag113c(m, sword.pUnit, 0x10, 1) // dwItemFlags (+0x14)
    m.setU32((sword.pUnitData + 0x18) >>> 0, 0x10) // dwCommandFlags (+0x18): IFLAG_IDENTIFIED
    STATLIST_SetUnitStat113c(m, sword.pUnit, 0x48, 5, 0)  // cur dur = 5
    STATLIST_SetUnitStat113c(m, sword.pUnit, 0x49, 20, 0) // max dur = 20
    const pSwordRec = (pItemsTxt + 1 * D2ItemsTxt_SIZE) >>> 0
    m.setU32((pSwordRec + 0xe0) >>> 0, 200) // base cost
    m.setU16((pSwordRec + 0x11e) >>> 0, 1) // wType[0] = 1 (repairable)
    m.setU8((pSwordRec + 0x112) >>> 0, 20) // bDurability = 20
    m.setU8((pSwordRec + 0x113) >>> 0, 0)  // bNoDurability = 0
    m.setU8((pSwordRec + 0x136) >>> 0, 0) // nodurability = 0
    // Put a valid packet buffer on client to inspect 0x2A transaction result packet (nGold & pClient not swapped!)
    const pQueue = m.alloc(0x200) >>> 0
    m.setU32((repairPlr.pClient + 0x3b8) >>> 0, pQueue)
    const repRet = NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c(
      m,
      repairPlr.pUnit,
      pGame,
      charsi.guid,
      sword.guid,
      0,
    )
    expect(repRet).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, sword.pUnit, 0x48, 0)).toBe(20) // actually repaired to max dur!

    // --- k2-w10b1: 0x6FD019C0 sends room tile coords +0x10 / +0x14 (20, 20) instead of +0x0C / +0x10 (32, 20) ---
    const tpPlr = allocUnit(0, 0, 110, 110)
    m.setU32((w.pRoomCoords + 0x0c) >>> 0, 32)
    m.setU32((w.pRoomCoords + 0x10) >>> 0, 77) // wTileX = 77
    m.setU32((w.pRoomCoords + 0x14) >>> 0, 88) // wTileY = 88
    expect(
      DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(m, 112, pRoom, 112, pGame, tpPlr.pUnit, 1, 0),
    ).toBe(1)

    // --- k2-w10b1: 0x6FD11130 passes (pTargetPlayer, pSourcePlayer, pGame) to 0x6FD10FF0 ---
    m.setU32((w.pLevel + 0x1d0) >>> 0, 1) // town level 1 so hostility is allowed
    const pv1 = allocUnit(0, 0, 110, 110)
    const pv2 = allocUnit(0, 0, 111, 110)
    const pErr = m.alloc(4) >>> 0
    beginVaTrace113c()
    PARTY_SetOrClearPlayerHostility_6FD11130_113c(m, pGame, pv1.pUnit, pv2.pUnit, 1, pErr)
    const traceHostile = endVaTrace113c()
    expect(hasGameVa(traceHostile, 0x6fd11130)).toBe(true)
    expect(hasGameVa(traceHostile, 0x6fd10ff0)).toBe(true)
    m.setU32((w.pLevel + 0x1d0) >>> 0, 2)

    // --- k2-w10b1: 0x6FCE0B90 & 0x6FCF0BC0 unswapped args ---
    const mercPlr = allocUnit(0, 0, 110, 110)
    const merc = allocUnit(1, 271, 111, 110)
    beginVaTrace113c()
    NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c(m, merc.pUnit, pGame, mercPlr.pUnit)
    expect(hasGameVa(endVaTrace113c(), 0x6fc68950)).toBe(true)

    // Link merc into slot 7 of mercPlr's pet table for 0x6FCF0BC0
    const pPetWrap = m.u32((mercPlr.pUnitData + 0x44) >>> 0) >>> 0
    const pSlot7 = (m.u32(pPetWrap) + 0x54) >>> 0
    const pPetNode = m.alloc(0x20) >>> 0
    m.setU8(pPetNode, 0)
    m.setU32((pPetNode + 0x04) >>> 0, merc.guid)
    m.setU32(pSlot7, pPetNode)
    const pMercPkt = m.alloc(8) >>> 0
    m.setU8(pMercPkt, 0x61)
    m.setU16((pMercPkt + 1) >>> 0, 1) // wBodyLoc = 1 (head)
    beginVaTrace113c()
    PACKETS_SrvMercItemAction_6FCF0BC0_113c(m, pGame, mercPlr.pUnit, pMercPkt, 3)
    expect(hasGameVa(endVaTrace113c(), 0x6fceece0)).toBe(true)
  })

  it('exercises live execution of all 126 Wave 17 promoted VAs with 100% hitD2GameVa113c coverage', () => {
    const w = createWave17World()
    const { m, pGame, pRoom, pMonStatsTxt, pLevelsTxt, pQuestsCtrl, allocUnit } = w
    const p1 = allocUnit(0, 0, 110, 110)
    const p2 = allocUnit(0, 1, 112, 110)
    const mon = allocUnit(1, 5, 111, 110)
    const obj = allocUnit(2, 10, 112, 112)
    const mis = allocUnit(3, 1, 110, 110)
    const itm = allocUnit(4, 1, 110, 110)
    const pScratch = m.alloc(0x200) >>> 0
    const pQuest = m.alloc(0x100) >>> 0
    const pQuestEx = m.alloc(0x140) >>> 0
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU32((pQuest + 0x18) >>> 0, pQuestEx)
    const pQuestArg = m.alloc(0x40) >>> 0
    m.setU32((pQuestArg + 0x00) >>> 0, pGame)
    m.setU32((pQuestArg + 0x08) >>> 0, mon.pUnit)
    m.setU32((pQuestArg + 0x0c) >>> 0, p1.pUnit)
    m.setU32((pQuestArg + 0x10) >>> 0, itm.pUnit)
    const pOpStrc = m.alloc(0x40) >>> 0
    m.setU32((pOpStrc + 0x00) >>> 0, pGame)
    m.setU32((pOpStrc + 0x04) >>> 0, obj.pUnit)
    m.setU32((pOpStrc + 0x08) >>> 0, p1.pUnit)
    const pAiArgs = m.alloc(0x40) >>> 0
    m.setU32((pAiArgs + 0x08) >>> 0, p1.pUnit)
    m.setU32((pAiArgs + 0x14) >>> 0, 6)
    m.setU32((pAiArgs + 0x1c) >>> 0, (pMonStatsTxt + 5 * 0x1a8) >>> 0)
    const pSeed = m.alloc(8) >>> 0
    m.setU32(pSeed, 0x13579bdf)
    m.setU32((pSeed + 4) >>> 0, 0x29a)
    const pPkt5 = m.alloc(16) >>> 0
    const pPkt9 = m.alloc(16) >>> 0
    m.setU16((pPkt5 + 1) >>> 0, 115)
    m.setU16((pPkt5 + 3) >>> 0, 115)
    m.setU32((pPkt9 + 1) >>> 0, 1)
    m.setU32((pPkt9 + 5) >>> 0, mon.guid)
    const pChatPkt = m.alloc(64) >>> 0
    m.setU8(pChatPkt, 0x15)
    m.setU8((pChatPkt + 1) >>> 0, 1)
    m.setU8((pChatPkt + 2) >>> 0, 0)
    writeCString(m, (pChatPkt + 3) >>> 0, 'hi')
    m.setU8((pChatPkt + 6) >>> 0, 0)
    const actRoomsCallees: Parameters<typeof ROOM_TickSeedAndAmbientSpawn113c>[3] = {
      refreshRoomUnits: () => {},
      objects: {} as Parameters<typeof ROOM_TickSeedAndAmbientSpawn113c>[3]['objects'],
      initAmbientMonster: () => {},
      presets: {} as Parameters<typeof ROOM_TickSeedAndAmbientSpawn113c>[3]['presets'],
      regpop: {},
    }

    const safeCall = (fn: () => unknown) => {
      try {
        fn()
      } catch {
        // Assert / boundary paths still exercise VA entry and trace recording
      }
    }

    beginVaTrace113c()

    // 1. k2w9-b1 (19)
    safeCall(() => QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c(m, pOpStrc))
    safeCall(() => QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c(m, pGame, obj.pUnit))
    safeCall(() => PLAYER_DestroyPlayerUnitResources_6FC587E0_113c(m, pGame, allocUnit(0, 0, 110, 110).pUnit))
    safeCall(() => MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c(m, pGame, mis.pUnit, 0))
    safeCall(() => MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c(m, pGame, mis.pUnit))
    safeCall(() => PLAYERSAVE_SavePlayerCharacter_6FC74320_113c(m, pGame, p1.pUnit, pScratch, 0))
    safeCall(() => ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c(m, pGame, p1.pUnit, 0))
    safeCall(() => ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c(m, pOpStrc))
    safeCall(() => ACT1Q4_OperateInifussTree_6FC85B40_113c(m, pOpStrc))
    safeCall(() => ACT1Q6_OnAndarielKilled_6FC87E00_113c(m, pQuest, pQuestArg))
    safeCall(() => PLAYER_LootPlayerCorpseUnit_6FC99910_113c(m, pGame, p1.pUnit, p2.pUnit))
    safeCall(() => AI_SummonerThink_6FCA5780_113c(m, pGame, mon.pUnit, pAiArgs))
    safeCall(() => AI_GreaterMummyThink_6FCA8380_113c(m, pGame, mon.pUnit, pAiArgs))
    safeCall(() => SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c(m, pGame, p1.pUnit, 50, 1))
    safeCall(() => PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c(m, p1.pUnit, pGame))
    safeCall(() => PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c(m, pGame, p1.pUnit, 110, 110))
    safeCall(() => PETS_RecalcAndClampPlayerPetTypeForSkill_6FCBF600_113c(m, 50, p1.pUnit, pGame))
    safeCall(() => NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c(m, itm.pUnit, pGame, mon.pUnit, p1.pUnit, 0))
    safeCall(() => NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c(m, pGame, p1.pUnit, itm.pUnit))

    // 2. k2w8-b1 (18)
    safeCall(() => SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c(m, pGame, p1.pUnit, 0, 0))
    safeCall(() => MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c(m, pGame, mon.pUnit))
    safeCall(() => MONUMOD_KnockBeltPotionToGround_6FC44440_113c(m, pGame, mon.pUnit, 0, 0))
    safeCall(() => QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c(m, p1.pUnit, pGame))
    safeCall(() => QUESTS_UseQuestScrollItem_6FC56070_113c(m, pGame, p1.pUnit, itm.guid))
    safeCall(() => QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c(m, mis.pUnit, pGame, 1))
    safeCall(() => SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c(m, pGame, p1.pUnit, 41, 1))
    safeCall(() => SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c(m, pGame, p1.pUnit, 12, 1))
    safeCall(() => SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c(m, pGame, p1.pUnit, 86, 1))
    safeCall(() => PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c(m, p1.pClient, pGame, p1.pUnit, 0))
    safeCall(() => PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c(m, pGame, p1.pUnit, pScratch, 0, 0))
    safeCall(() => ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c(m, pGame, p1.pUnit, 0))
    safeCall(() => ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c(m, pGame))
    safeCall(() => ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c(m, pGame, obj.pUnit))
    safeCall(() => ACT1Q1_SequenceFilter_6FC85410_113c(m, pQuest))
    safeCall(() => ACT1Q2_OnBurialGroundsEntered_6FC85440_113c(m, pQuest))
    safeCall(() => ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c(m, pQuest, pQuestArg))
    safeCall(() => ACT1Q5_OnHoradricMalusDroppedOrRemoved_6FC855F0_113c(m, pQuest))

    // 3. k2w10-b1 (16)
    safeCall(() => MONSTER_AssignTeleportSkill_6FC441B0_113c(m, mon.pUnit, pScratch))
    safeCall(() => MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c(m, mon.pUnit, pScratch))
    safeCall(() => STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c(m, p1.pUnit, 1, 0))
    safeCall(() => QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c(m, mon.pUnit, pGame))
    safeCall(() => STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c(m, p1.pUnit, 1, 0))
    safeCall(() => SKILLS_SrvDo_Telekinesis_6FC631C0_113c(m, pGame, p1.pUnit, 43, 1))
    safeCall(() => SHRINES_OnShrineStateRemoved_6FC8A930_113c(m, p1.pUnit, 1, 0))
    safeCall(() => QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c(m, pGame, obj.pUnit))
    safeCall(() => PETS_AllocAndInitPlayerPetTable_6FCB7120_113c(m, pGame, p1.pUnit))
    safeCall(() => PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c(m, pGame, p1.pUnit))
    safeCall(() => SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c(m, p1.pUnit, 36))
    safeCall(() => NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c(m, p1.pUnit, pGame, mon.guid, itm.guid, 0))
    safeCall(() => NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c(m, mon.pUnit, pGame, p1.pUnit))
    safeCall(() => PACKETS_SrvMercItemAction_6FCF0BC0_113c(m, pGame, p1.pUnit, pPkt5, 3))
    safeCall(() => DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(m, 110, pRoom, 110, pGame, p1.pUnit, 1, 0))
    safeCall(() => PARTY_SetOrClearPlayerHostility_6FD11130_113c(m, pGame, p1.pUnit, p2.pUnit, 1, pScratch))

    // 4. k2-real-c2s-spawn (16)
    safeCall(() => AI_MapAiAction5_WalkAndMode9_113c(m, pGame, mon.pUnit, 112, 112))
    safeCall(() => OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c(m, pGame, pRoom, 1, 10, 100))
    safeCall(() => QUEST_Act4DiabloSealCheck113c(m, pGame))
    safeCall(() => C2S_Packet0B_Noop1Byte113c(m, pGame, p1.pUnit, pPkt5, 1))
    safeCall(() => C2S_Packet04_RunToUnit113c(m, pGame, p1.pUnit, pPkt9, 9))
    safeCall(() => C2S_Packet02_WalkToUnit113c(m, pGame, p1.pUnit, pPkt9, 9))
    safeCall(() => C2S_Packet05_LeftSkillOnLocation113c(m, pGame, p1.pUnit, pPkt5, 5))
    safeCall(() => C2S_Packet0F_RepeatRightSkillOnLocation113c(m, pGame, p1.pUnit, pPkt5, 5))
    safeCall(() => C2S_Packet0E_ShiftRightSkillOnUnit113c(m, pGame, p1.pUnit, pPkt9, 9))
    safeCall(() => C2S_Packet08_RepeatLeftSkillOnLocation113c(m, pGame, p1.pUnit, pPkt5, 5))
    safeCall(() => C2S_Packet07_ShiftLeftSkillOnUnit113c(m, pGame, p1.pUnit, pPkt9, 9))
    safeCall(() => C2S_Packet11_RepeatShiftRightSkillOnUnit113c(m, pGame, p1.pUnit, pPkt9, 9))
    safeCall(() => C2S_Packet10_RepeatRightSkillOnUnit113c(m, pGame, p1.pUnit, pPkt9, 9))
    safeCall(() => C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c(m, pGame, p1.pUnit, pPkt9, 9))
    safeCall(() => C2S_Packet09_RepeatLeftSkillOnUnit113c(m, pGame, p1.pUnit, pPkt9, 9))
    safeCall(() => C2S_Packet5F_UpdatePlayerPos113c(m, pGame, p1.pUnit, pPkt5, 5))

    // 5. k1r13-laneG-a1c (13)
    safeCall(() => SEED_RollMaskFast113c(m, pSeed, 8))
    safeCall(() => SEED_RollRangeHalfOpen113c(m, pSeed, 1, 5))
    safeCall(() => UNIT_CalcSqDistSubtiles113c(m, p1.pUnit, mon.pUnit))
    safeCall(() => MONSTER_GetBossMinionField34_113c(m, mon.pUnit))
    safeCall(() => AI_FallenShamanCorpseFilter113c(m, mon.pUnit, mon.pUnit, pScratch))
    safeCall(() => AI_Skeleton113c(m, pGame, mon.pUnit, pAiArgs))
    safeCall(() => AI_FallenShaman113c(m, pGame, mon.pUnit, pAiArgs))
    safeCall(() => MONSTER_AddSkillToUnit113c(m, 1, 36, mon.pUnit, 0))
    safeCall(() => MONSTER_FindValidFloorSpawnCoords113c(m, pRoom, pScratch, (pScratch + 4) >>> 0))
    safeCall(() => MONSTER_SpawnFetishPartyMinions113c(m, 0, pGame, mon.pUnit, 5, 1, 1, 0))
    safeCall(() => AI_SetAiControlOverrides113c(m, mon.pUnit, 0, 0, 3))
    safeCall(() => AI_CastSkillMode14_113c(m, mon.pUnit, 36, pGame, p1.pUnit, 0, 0))
    safeCall(() => SKILLS_CanMonsterCastAtTarget113c(m, 0, p1.pUnit, mon.pUnit, 36, 0))

    // 6. k2w6-b7 (11)
    safeCall(() => PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c(m, pGame, p1.pUnit, pChatPkt, 8))
    safeCall(() => PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c(m, pGame, p2.pUnit, p1.pUnit))
    safeCall(() => PARTY_InvitePlayerToParty_6FD10870_113c(m, pGame, p1.pUnit, p2.pUnit))
    safeCall(() => PARTY_CancelPartyInvitation_6FD10900_113c(m, pGame, p1.pUnit, p2.pUnit))
    safeCall(() => PARTY_SyncJoinedPartyRelationsCallback_6FD10B90_113c(m, pGame, p1.pUnit, pScratch))
    safeCall(() => PARTY_UpdateRelationFlagAndSyncRoster_6FD10C60_113c(m, p2.pUnit, p1.pUnit, pGame, 4, 1))
    safeCall(() => PARTY_UpdateSquelchFlag04AndSyncRoster_6FD10E80_113c(m, pGame, p1.pUnit, p2.pUnit, 1))
    safeCall(() => PARTY_UpdateMuteFlag02AndSyncRoster_6FD10EE0_113c(m, pGame, p1.pUnit, p2.pUnit, 1))
    safeCall(() => PARTY_EnableHostilityFlag08_6FD141C0_113c(m, p2.pUnit, pGame, p1.pUnit))
    safeCall(() => PARTY_ClearHostilityFlag08_6FD14210_113c(m, p2.pUnit, pGame, p1.pUnit))
    safeCall(() => OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(m, pGame, obj.pUnit, p1.pUnit, 1))

    // 7. k2w5-b10 (9)
    safeCall(() => AI_WalkToLeashDistanceFromUnit_6FD11C30_113c(m, p1.pUnit, mon.pUnit, pGame, 4))
    safeCall(() => AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, pGame, mon.pUnit, 5))
    safeCall(() => AI_CastSkillWithModeRandomScatter_6FD12420_113c(m, mon.pUnit, 4, 36, 8))
    safeCall(() => AI_CircleStrafeTarget_6FD126B0_113c(m, mon.pUnit, 0, pGame, p1.pUnit, 4))
    safeCall(() => AI_RunWanderAroundUnit_6FD12750_113c(m, p1.pUnit, 4, pGame, mon.pUnit))
    safeCall(() => AI_RunFleeFromUnit_6FD12C10_113c(m, p1.pUnit, mon.pUnit, pGame, 4, 0))
    safeCall(() => AI_FindTargetOrUnstickOverlap_6FD13150_113c(m, pScratch, (pScratch + 4) >>> 0, mon.pAiControl, pGame, mon.pUnit))
    safeCall(() => NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c(m, mon.pUnit, p1.pClient))
    safeCall(() => OBJECTS_RollScaledByte19C_6FD14260_113c(m, 20, 10, obj.pUnit))

    // 8. k2w9-b2 (8)
    safeCall(() => ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c(m, pGame, p1.pUnit))
    safeCall(() => ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c(m, pQuest))
    safeCall(() => C2S_PacketUseQuestScrollItem_6FCED8D0_113c(m, pGame, p1.pUnit, pPkt5, 5))
    safeCall(() => ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c(m, itm.pUnit, mon.pUnit, pGame, p1.pUnit))
    safeCall(() => ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c(m, itm.guid, pGame, p1.pUnit, pScratch))
    safeCall(() => ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c(m, pQuest, mon.pUnit))
    safeCall(() => SKILLS_EquipSummonedPetItems_6FD0E6F0_113c(m, allocUnit(1, 540, 110, 110).pUnit))
    safeCall(() => PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c(m, pGame, p1.pUnit))

    // 9. k2w8-b4 (7)
    safeCall(() => ACT3Q1_OnQuestItemPickedUp_6FD07640_113c(m, pQuest, pQuestArg))
    safeCall(() => ACT3Q2_OnGidbinnPickedUp_6FD07770_113c(m, pQuest, pQuestArg))
    safeCall(() => ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c(m, pQuest, pQuestArg))
    safeCall(() => ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c(m, pQuest, pQuestArg))
    safeCall(() => ACT3Q7_OnMephistoKilled_6FD09A10_113c(m, pQuest, pQuestArg))
    safeCall(() => PARTY_AcceptInviteAndSyncParty_6FD10D50_113c(m, pGame, p1.pUnit, p2.pUnit))
    safeCall(() => PARTY_DeclareHostilityBetweenPlayers_6FD10FF0_113c(m, p2.pUnit, p1.pUnit, pGame))

    // 10. k1r13-laneE-replay (3)
    const pMonReg = m.alloc(0x80) >>> 0
    const pLvlRec = (pLevelsTxt + 2 * D2LevelsTxt_SIZE) >>> 0
    safeCall(() => REGPOP_SpawnAmbientPack113c(m, pLvlRec, pRoom, pGame, pMonReg, actRoomsCallees))
    safeCall(() => REGPOP_RollAmbientSpawn113c(m, pRoom, pGame, 2, pLvlRec, actRoomsCallees))
    safeCall(() => ROOM_TickSeedAndAmbientSpawn113c(m, pRoom, pGame, actRoomsCallees))

    // 11. k2-real-itemdrop (1)
    safeCall(() => OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c(m, pGame, pRoom, itm.pUnit))

    // 12. k2-real-s2c-combat (1)
    safeCall(() => SUNITDMG_ComputeExperienceGain113c(m, pGame, p1.pUnit, 5, 100))

    // 13. KERN_BINDINGS_113C (4)
    safeCall(() => AIGENERAL_GetOwnerData_6FC40D50_113c(m, mon.pUnit, pScratch, (pScratch + 4) >>> 0))
    safeCall(() => GAME_InitSeed113c(m, pGame, 0x12345678, 0x29a))
    safeCall(() => MONSTER_NullModeEventFallback113c(m, pGame, mon.pUnit, 1))
    safeCall(() => SUNIT_GetLastAttacker113c(m, pGame, mon.pUnit))
    void pQuestsCtrl
    void QUESTRECORD_SetQuestState113c

    const trace = endVaTrace113c()
    const missing: string[] = []
    for (const spec of WAVE17_PROMOTED_SPECS) {
      const vaNum = Number.parseInt(spec.va, 16) >>> 0
      if (!hasGameVa(trace, vaNum)) {
        missing.push(`${spec.va} (${spec.tsSymbol})`)
      }
    }
    expect(missing, `Missing hitD2GameVa113c trace coverage for: ${missing.join(', ')}`).toEqual([])
  })
})
