/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 3: +169 VAs).
 *
 * Audits and verifies 169 `D2Game.dll` (`0x6FC20000`) closure functions across:
 * - `k2w1-laneM-0x6fc7` (`src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c.ts`, 42 functions)
 * - `k2w2-b6` (`src/d2kern-113c/game/k2-w2b6-113c.ts`, 42 functions)
 * - `k2w3-b1` (`src/d2kern-113c/game/k2-w3b1-113c.ts`, 42 functions)
 * - `k2w5-b9` (`src/d2kern-113c/game/k2-w5b9-113c.ts`, 43 functions)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`.
 * 2. Differential regression tests for all 11 genuine 1.13c binary disassembly discrepancies fixed.
 * 3. Multi-branch `SparseMemory113c` boundary/state assertions + 100% (`169 / 169`) live
 *    `beginVaTrace113c()` / `endVaTrace113c()` execution coverage.
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
  INVENTORY_SIGNATURE_113C,
  INVENTORY_SetCursorItem113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_FLAG_EXTENDED,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  DATATABLES_LEVELS_TXT_COUNT_OFF_113C,
  DATATABLES_LEVELS_TXT_PTR_OFF_113C,
  GDW_WAYPOINT_TABLE_COUNT_VA_113C,
  GW_WAYPOINT_TABLE_BASE_VA_113C,
} from '../../../src/d2kern-113c/common/waypoint.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  ACT5Q0_StatusFilter_6FC76EA0_113c,
  ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c,
  ACT5Q1_ActiveFilter_6FC76D80_113c,
  ACT5Q1_StatusFilter_6FC76E00_113c,
  ACT5Q2_ActiveFilter_6FC76C40_113c,
  ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c,
  ACT5Q2_Callback11_RemovePlayerGuid_6FC782A0_113c,
  ACT5Q2_Callback15_ClearState04_6FC78240_113c,
  ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c,
  ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c,
  ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c,
  ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c,
  ACT5Q3_GetPortalTargetCoords_6FC76A40_113c,
  ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c,
  ACT5Q3_RecordAnyaPosition_6FC76A00_113c,
  ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c,
  ACT5Q4_ActiveFilter_6FC76840_113c,
  ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c,
  ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c,
  ACT5Q4_CompletePersonalizationReward_6FC777F0_113c,
  ACT5Q4_StatusFilter_6FC768C0_113c,
  ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c,
  ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c,
  ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c,
  ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c,
  ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c,
  ACT5Q5_GetSummitPlayerCount_6FC766D0_113c,
  ACT5Q5_InitAncientsAltarObject_6FC773D0_113c,
  ACT5Q5_InitSummitDoorObject_6FC765B0_113c,
  ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c,
  ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c,
  ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c,
  ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c,
  ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c,
  ACT5Q6_ActiveFilter_6FC76810_113c,
  ACT5Q6_Callback11_RemovePlayerGuid_6FC775D0_113c,
  ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c,
  ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c,
  ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c,
  ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c,
  ACT5_InitObjectNoop_6FC76CE0_113c,
  SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c,
} from '../../../src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c.ts'
import {
  ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c,
  ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c,
  ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c,
  ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c,
  ACT2Q2_IsQuestInState01_6FCE1B20_113c,
  ACT2Q2_IsQuestPastState01_6FCE1B60_113c,
  ACT2Q4_Callback00_Noop_6FCE1980_113c,
  ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c,
  ACT2Q4_StatusFilter_6FCE1970_113c,
  ACT2Q5_StatusFilter_6FCE1960_113c,
  ACT4Prologue_StatusFilter_6FCD8B80_113c,
  ACT4Q0_StatusFilter_6FCD87D0_113c,
  ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c,
  ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c,
  ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c,
  ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c,
  ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c,
  ACT4Q2_Callback10_RemovePlayerGuid_6FCD8E60_113c,
  ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c,
  ACT4Q2_InitHellforgeObject_6FCD8870_113c,
  ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c,
  ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c,
  ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c,
  ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c,
  ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c,
  ACT4_InitObjectNoop_6FCD8930_113c,
  AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c,
  AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c,
  AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c,
  AIBAAL_NoopThink_6FCD6C80_113c,
  HIRELING_GetVendorNameIdRange_6FCDC7D0_113c,
  INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c,
  NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c,
  SKILLS_InitInfernoSeqFrames_6FCD3270_113c,
  SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c,
  SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c,
  SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c,
  SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c,
  SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c,
  SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c,
  SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c,
  STATES_PurgeExpStateStatLists_6FCDC920_113c,
} from '../../../src/d2kern-113c/game/k2-w2b6-113c.ts'
import {
  AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c,
  AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c,
  AI_ThinkBaalThroneSpawner_6FC35E00_113c,
  AI_ThinkBloodHawk_6FC376B0_113c,
  AI_ThinkBloodLordFrenzy_6FC36270_113c,
  AI_ThinkClawViper_6FC38CE0_113c,
  AI_ThinkDelayedMeleeAttack_6FC38360_113c,
  AI_ThinkDualAttack95Pct_6FC381A0_113c,
  AI_ThinkGiantSpider_6FC377E0_113c,
  AI_ThinkMinionSpawner_6FC37BC0_113c,
  AI_ThinkPainWormSpawner_6FC364A0_113c,
  AI_ThinkPatrolAndAttack_6FC36E30_113c,
  AI_ThinkSandMaggot_6FC38480_113c,
  AI_ThinkThornedHulk_6FC379A0_113c,
  ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c,
  ITEMS_AddStaffModSkillsByTier_6FC335E0_113c,
  ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c,
  ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c,
  ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c,
  ITEMS_ApplyLowQualityItemMods_6FC337F0_113c,
  ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c,
  ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c,
  ITEMS_PopulateItemDropStruct_6FC2E410_113c,
  ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c,
  ITEMS_RollAndApplyUniqueItem_6FC33C20_113c,
  ITEMS_RollAutoMagicAffixId_6FC348A0_113c,
  ITEMS_RollRareSuffixId_6FC34370_113c,
  ITEMS_RollSpawnableArmorId_6FC2FA30_113c,
  ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c,
  ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c,
  OBJRGN_AllocObjectControl_6FC2B9A0_113c,
  OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c,
  SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c,
  SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c,
  SKILLS_MountImpOnSiegeBeast_6FC2D040_113c,
  SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c,
  SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c,
  SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c,
  SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c,
  SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c,
  SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c,
  STORM_TSListDestroy_6FC21FE0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c.ts'
import {
  ACT3Q0_InitDarkWandererPreset_6FD08290_113c,
  ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c,
  ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c,
  ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c,
  ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c,
  ACT3Q4_StatusFilter_6FD06E00_113c,
  ACT3Q5_InitCouncilBossPreset_6FD08310_113c,
  ACT3Q5_InitStairsObject_6FD098E0_113c,
  ACT3Q5_OnStairsProximityTimer_6FD09960_113c,
  ACT3Q6_FireHellgateOpenerProjectile_6FD0AB60_113c,
  MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c,
  MONSTER_SpawnMinionPackInRing_6FD0DE90_113c,
  MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c,
  MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c,
  NET_SendPacket5A_PartyRelationEvent_6FD10720_113c,
  PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c,
  PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c,
  PARTY_RefreshInviteRelationNodes_6FD103E0_113c,
  PARTY_SendRosterUpdateCallback_6FD0B070_113c,
  PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c,
  PARTY_SyncMutualRelationState_6FD109E0_113c,
  PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c,
  PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c,
  PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c,
  PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c,
  PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c,
  PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c,
  PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c,
  PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c,
  PLAYERSAVE_WriteSkillSection_6FD0BC40_113c,
  PLAYERSAVE_WriteStatsSection_6FD0BE70_113c,
  PLAYERSAVE_WriteWaypointSection_6FD0B700_113c,
  PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c,
  PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c,
  QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c,
  QUESTS_SpawnProjectile12B_6FD0AB10_113c,
  SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c,
  SKILLS_ResolveTriggeredAttackerTarget_6FD11420_113c,
  SKILLS_ResolveTriggeredCorpseTarget_6FD11490_113c,
  SKILLS_RollRandomUnblockedTargetPos_6FD112C0_113c,
  SUBPARTY_ClearUnitBucketList_6FD0FD40_113c,
  SUBPARTY_CreatePlayerBucketHead_6FD0FED0_113c,
  SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b9-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2HirelingTxt,
  D2HirelingTxt_SIZE,
  D2InventoryStrc,
  D2ItemDataStrc,
  D2ItemDataStrc_SIZE,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2SkillStrc,
  D2SkillsTxt,
  D2StatListExStrc,
  D2StatListExStrc_SIZE,
  D2StatListStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  G_HIRELING_COUNT_VA_113C,
  G_HIRELING_TXT_VA_113C,
  HIRELING_TXT_SELLER_OFF_113C,
} from '../../../src/d2kern-113c/tables/monster-tbls-113c.ts'
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
  readonly summary: {
    readonly statusBreakdown: Record<string, number>
  }
  readonly functions: readonly ManifestFn[]
}

interface DisasmVaSpec {
  readonly batch: 'k2w1-laneM-0x6fc7' | 'k2w2-b6' | 'k2w3-b1' | 'k2w5-b9'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE3_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC73470', size: 81, headHex: '5185c074468b88c8', tailHex: 'c20400', tsSymbol: 'SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC764D0', size: 67, headHex: '8b018b80f4100000', tailHex: '005ec3', tsSymbol: 'ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76520', size: 67, headHex: '8b018b80f4100000', tailHex: '005ec3', tsSymbol: 'ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76570', size: 52, headHex: '8b80f410000085c0', tailHex: '33c0c3', tsSymbol: 'ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC765B0', size: 68, headHex: '8b018b80f4100000', tailHex: 'fbffc3', tsSymbol: 'ACT5Q5_InitSummitDoorObject_6FC765B0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76600', size: 56, headHex: '8b80f410000085c0', tailHex: '94c0c3', tsSymbol: 'ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76640', size: 57, headHex: '8b80f410000085c0', tailHex: '0000c3', tsSymbol: 'ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC766D0', size: 54, headHex: '8b80f410000085c0', tailHex: '420cc3', tsSymbol: 'ACT5Q5_GetSummitPlayerCount_6FC766D0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76740', size: 86, headHex: '50e8323dfbff50e8', tailHex: 'c20400', tsSymbol: 'ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76810', size: 47, headHex: '81fa030200007522', tailHex: 'c20c00', tsSymbol: 'ACT5Q6_ActiveFilter_6FC76810_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76840', size: 127, headHex: '81fa000200005657', tailHex: 'c20c00', tsSymbol: 'ACT5Q4_ActiveFilter_6FC76840_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC768C0', size: 137, headHex: '53568b742410578b', tailHex: 'c20c00', tsSymbol: 'ACT5Q4_StatusFilter_6FC768C0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76950', size: 51, headHex: '8b80f410000085c0', tailHex: '94c0c3', tsSymbol: 'ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76A00', size: 64, headHex: '8b81f410000085c0', tailHex: '005ec3', tsSymbol: 'ACT5Q3_RecordAnyaPosition_6FC76A00_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76A40', size: 107, headHex: '8b81f410000085c0', tailHex: 'c20400', tsSymbol: 'ACT5Q3_GetPortalTargetCoords_6FC76A40_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76B80', size: 71, headHex: '8b48188a91860000', tailHex: '33c0c3', tsSymbol: 'ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76C40', size: 149, headHex: '81fa03020000568b', tailHex: 'c20c00', tsSymbol: 'ACT5Q2_ActiveFilter_6FC76C40_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76CE0', size: 1, headHex: 'c3', tailHex: 'c3', tsSymbol: 'ACT5_InitObjectNoop_6FC76CE0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76CF0', size: 19, headHex: '8a480c84c9750b8a', tailHex: '0c01c3', tsSymbol: 'ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76D80', size: 119, headHex: '81faff0100005657', tailHex: 'c20c00', tsSymbol: 'ACT5Q1_ActiveFilter_6FC76D80_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76E00', size: 150, headHex: '538b5c2410568b74', tailHex: 'c20c00', tsSymbol: 'ACT5Q1_StatusFilter_6FC76E00_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76EA0', size: 12, headHex: '8b44240cc6000032', tailHex: 'c20c00', tsSymbol: 'ACT5Q0_StatusFilter_6FC76EA0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76EB0', size: 60, headHex: '8b420c56578b3a50', tailHex: '5f5ec3', tsSymbol: 'ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC76FC0', size: 57, headHex: '56578bfa8b470c85', tailHex: 'c8fdff', tsSymbol: 'ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC77320', size: 165, headHex: '5356578bf2568bf9', tailHex: 'c20400', tsSymbol: 'ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC773D0', size: 111, headHex: '56578bf98b078b80', tailHex: '5f5ec3', tsSymbol: 'ACT5Q5_InitAncientsAltarObject_6FC773D0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC77440', size: 94, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC774A0', size: 74, headHex: '8b018b80f4100000', tailHex: 'ff5ec3', tsSymbol: 'ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC774F0', size: 77, headHex: '8b400485c0750583', tailHex: 'fbffc3', tsSymbol: 'ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC775D0', size: 29, headHex: '8b420c85c0750b83', tailHex: 'c2fdff', tsSymbol: 'ACT5Q6_Callback11_RemovePlayerGuid_6FC775D0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC77750', size: 148, headHex: '5356578bfa578bf1', tailHex: 'c20400', tsSymbol: 'ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC777F0', size: 53, headHex: '5650e8c92cfbff8b', tailHex: 'c20400', tsSymbol: 'ACT5Q4_CompletePersonalizationReward_6FC777F0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC77830', size: 199, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC77A20', size: 57, headHex: '56578bfa8b470c85', tailHex: 'bdfdff', tsSymbol: 'ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC77C00', size: 161, headHex: '5657528bf9e8b628', tailHex: 'c20400', tsSymbol: 'ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC77CB0', size: 200, headHex: '558be98b85f41000', tailHex: '005dc3', tsSymbol: 'ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC780A0', size: 105, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC78110', size: 129, headHex: '5657528bf1e8a623', tailHex: 'c20400', tsSymbol: 'ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC78240', size: 32, headHex: '8b420c568b3250e8', tailHex: 'ff5ec3', tsSymbol: 'ACT5Q2_Callback15_ClearState04_6FC78240_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC78260', size: 64, headHex: '85c08b4918565775', tailHex: '5f5ec3', tsSymbol: 'ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC782A0', size: 57, headHex: '56578bfa8b470c85', tailHex: 'b5fdff', tsSymbol: 'ACT5Q2_Callback11_RemovePlayerGuid_6FC782A0_113c' },
  { batch: 'k2w1-laneM-0x6fc7', va: '0x6FC782E0', size: 213, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD2E90', size: 50, headHex: '83ec08568d442408', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD2F80', size: 19, headHex: '85d27407838ac400', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD2FA0', size: 19, headHex: '85d2740783a2c400', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD31B0', size: 27, headHex: '85d2740783a2c400', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD3270', size: 100, headHex: '85f6744e833e0175', tailHex: 'c20400', tsSymbol: 'SKILLS_InitInfernoSeqFrames_6FCD3270_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD3570', size: 41, headHex: '568bf28bc6e826d2', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD3EB0', size: 88, headHex: '83ec7053568bf28b', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD4660', size: 80, headHex: '5356578bfa8bc78b', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD6C80', size: 3, headHex: 'c20400', tailHex: 'c20400', tsSymbol: 'AIBAAL_NoopThink_6FCD6C80_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD6C90', size: 77, headHex: '85f6744668310100', tailHex: '33c0c3', tsSymbol: 'AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD6CE0', size: 29, headHex: '3b0a741685c97412', tailHex: 'c20400', tsSymbol: 'AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD6D30', size: 100, headHex: '568bf185f6578bfa', tailHex: 'd85ec3', tsSymbol: 'AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD87D0', size: 5, headHex: '32c0c20c00', tailHex: 'c20c00', tsSymbol: 'ACT4Q0_StatusFilter_6FCD87D0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD87F0', size: 25, headHex: '8b4208568b711850', tailHex: '105ec3', tsSymbol: 'ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD8870', size: 77, headHex: '8b018b80f4100000', tailHex: 'f5ffc3', tsSymbol: 'ACT4Q2_InitHellforgeObject_6FCD8870_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD88C0', size: 57, headHex: '8b487085c9752f8b', tailHex: '33c0c3', tsSymbol: 'ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD8930', size: 1, headHex: 'c3', tailHex: 'c3', tsSymbol: 'ACT4_InitObjectNoop_6FCD8930_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD8A50', size: 28, headHex: '568b7424088b4614', tailHex: 'c20400', tsSymbol: 'ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD8B80', size: 5, headHex: '32c0c20c00', tailHex: 'c20c00', tsSymbol: 'ACT4Prologue_StatusFilter_6FCD8B80_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD8CC0', size: 30, headHex: '8b420c538b1a568b', tailHex: '5e5bc3', tsSymbol: 'ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD8E60', size: 29, headHex: '8b420c85c0750b83', tailHex: 'a9f7ff', tsSymbol: 'ACT4Q2_Callback10_RemovePlayerGuid_6FCD8E60_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD8FE0', size: 67, headHex: '568b328b467085c0', tailHex: 'ff5ec3', tsSymbol: 'ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD9030', size: 52, headHex: '518d0424506a6de8', tailHex: 'c20800', tsSymbol: 'ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD94D0', size: 29, headHex: '8b420c85c0750b83', tailHex: 'a3f7ff', tsSymbol: 'ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD9920', size: 76, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD9BC0', size: 61, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD9C60', size: 101, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c' },
  { batch: 'k2w2-b6', va: '0x6FCD9CD0', size: 76, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCDC7D0', size: 100, headHex: '8b4c24048b51706a', tailHex: 'f4ffcc', tsSymbol: 'HIRELING_GetVendorNameIdRange_6FCDC7D0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCDC920', size: 101, headHex: 'a19c82d16f8b088b', tailHex: 'c55dc3', tsSymbol: 'STATES_PurgeExpStateStatLists_6FCDC920_113c' },
  { batch: 'k2w2-b6', va: '0x6FCDC990', size: 39, headHex: '8b406085c0741b50', tailHex: 'c20400', tsSymbol: 'INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c' },
  { batch: 'k2w2-b6', va: '0x6FCDCB20', size: 101, headHex: '8a516d83ec1884d2', tailHex: 'c418c3', tsSymbol: 'NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c' },
  { batch: 'k2w2-b6', va: '0x6FCE1960', size: 5, headHex: '32c0c20c00', tailHex: 'c20c00', tsSymbol: 'ACT2Q5_StatusFilter_6FCE1960_113c' },
  { batch: 'k2w2-b6', va: '0x6FCE1970', size: 5, headHex: '32c0c20c00', tailHex: 'c20c00', tsSymbol: 'ACT2Q4_StatusFilter_6FCE1970_113c' },
  { batch: 'k2w2-b6', va: '0x6FCE1980', size: 1, headHex: 'c3', tailHex: 'c3', tsSymbol: 'ACT2Q4_Callback00_Noop_6FCE1980_113c' },
  { batch: 'k2w2-b6', va: '0x6FCE1A00', size: 50, headHex: '8b80f410000085c0', tailHex: '32c0c3', tsSymbol: 'ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c' },
  { batch: 'k2w2-b6', va: '0x6FCE1A40', size: 28, headHex: '568b7424088b4640', tailHex: 'c20400', tsSymbol: 'ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c' },
  { batch: 'k2w2-b6', va: '0x6FCE1A60', size: 55, headHex: '8b80f410000085c0', tailHex: '94c0c3', tsSymbol: 'ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c' },
  { batch: 'k2w2-b6', va: '0x6FCE1B20', size: 50, headHex: '8b80f410000085c0', tailHex: 'b001c3', tsSymbol: 'ACT2Q2_IsQuestInState01_6FCE1B20_113c' },
  { batch: 'k2w2-b6', va: '0x6FCE1B60', size: 50, headHex: '8b80f410000085c0', tailHex: '32c0c3', tsSymbol: 'ACT2Q2_IsQuestPastState01_6FCE1B60_113c' },
  { batch: 'k2w2-b6', va: '0x6FCE1EE0', size: 91, headHex: '8b80f410000085c0', tailHex: '0000c3', tsSymbol: 'ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c' },
  { batch: 'k2w2-b6', va: '0x6FCE1F40', size: 70, headHex: '8b80f410000085c0', tailHex: '33c0c3', tsSymbol: 'ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c' },
  { batch: 'k2w3-b1', va: '0x6FC21FE0', size: 120, headHex: '64a1000000006aff', tailHex: 'c20400', tsSymbol: 'STORM_TSListDestroy_6FC21FE0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2B510', size: 289, headHex: '83ec24535556578b', tailHex: 'c424c3', tsSymbol: 'OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2B9A0', size: 569, headHex: '83ec2c558b6c2434', tailHex: 'c20400', tsSymbol: 'OBJRGN_AllocObjectControl_6FC2B9A0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2BF90', size: 110, headHex: '83ec0c56578bfa57', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2C5D0', size: 211, headHex: '83ec24538b5c242c', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2C6B0', size: 175, headHex: '83ec2485ff558b6c', tailHex: 'c20400', tsSymbol: 'SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2CB30', size: 654, headHex: '83ec485356578bf2', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2CDC0', size: 308, headHex: '83ec108b44241485', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2CF00', size: 320, headHex: '83ec108b44241485', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2D040', size: 300, headHex: '85f653558b6c240c', tailHex: 'c20800', tsSymbol: 'SKILLS_MountImpOnSiegeBeast_6FC2D040_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2DB00', size: 207, headHex: '85f653558b6c240c', tailHex: 'c20800', tsSymbol: 'SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2DE70', size: 560, headHex: '83ec6c8b44247085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2E410', size: 446, headHex: '5733c0b921000000', tailHex: 'c20400', tsSymbol: 'ITEMS_PopulateItemDropStruct_6FC2E410_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2E990', size: 125, headHex: '85db558b6c241056', tailHex: 'c20c00', tsSymbol: 'ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2EDC0', size: 170, headHex: '85db55578bf87505', tailHex: 'c05dc3', tsSymbol: 'ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2EE70', size: 26, headHex: '53578bf856bbe0e7', tailHex: '320d00', tsSymbol: 'ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2F780', size: 368, headHex: 'b80c200000e89670', tailHex: 'c21800', tsSymbol: 'ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2F8F0', size: 320, headHex: 'b808200000e8266f', tailHex: 'c21000', tsSymbol: 'ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC2FA30', size: 320, headHex: 'b808200000e8e66d', tailHex: 'c21000', tsSymbol: 'ITEMS_RollSpawnableArmorId_6FC2FA30_113c' },
  { batch: 'k2w3-b1', va: '0x6FC33320', size: 700, headHex: '83ec1855568b7424', tailHex: 'c20c00', tsSymbol: 'ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c' },
  { batch: 'k2w3-b1', va: '0x6FC335E0', size: 517, headHex: '83ec1c5556578bf8', tailHex: 'c20400', tsSymbol: 'ITEMS_AddStaffModSkillsByTier_6FC335E0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC337F0', size: 569, headHex: '56e8d67bffff85ff', tailHex: '5d5ec3', tsSymbol: 'ITEMS_ApplyLowQualityItemMods_6FC337F0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC33A30', size: 490, headHex: '83ec2085ff750583', tailHex: 'c420c3', tsSymbol: 'ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c' },
  { batch: 'k2w3-b1', va: '0x6FC33C20', size: 437, headHex: '81ec0c0800005355', tailHex: 'c20800', tsSymbol: 'ITEMS_RollAndApplyUniqueItem_6FC33C20_113c' },
  { batch: 'k2w3-b1', va: '0x6FC33E60', size: 583, headHex: '56e86675ffff85ff', tailHex: 'c20400', tsSymbol: 'ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c' },
  { batch: 'k2w3-b1', va: '0x6FC340B0', size: 300, headHex: '83ec0c535556e8e7', tailHex: 'c20800', tsSymbol: 'ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC34370', size: 345, headHex: 'b804100000e8a624', tailHex: 'c20800', tsSymbol: 'ITEMS_RollRareSuffixId_6FC34370_113c' },
  { batch: 'k2w3-b1', va: '0x6FC348A0', size: 585, headHex: 'b814100000e8761f', tailHex: 'c21800', tsSymbol: 'ITEMS_RollAutoMagicAffixId_6FC348A0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC359B0', size: 336, headHex: '515356578bf233ff', tailHex: 'c20400', tsSymbol: 'AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC35B00', size: 169, headHex: '538b5c240855568b', tailHex: 'c20800', tsSymbol: 'AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c' },
  { batch: 'k2w3-b1', va: '0x6FC35E00', size: 394, headHex: '83ec248b44242853', tailHex: 'c20400', tsSymbol: 'AI_ThinkBaalThroneSpawner_6FC35E00_113c' },
  { batch: 'k2w3-b1', va: '0x6FC36270', size: 416, headHex: '83ec248b44242853', tailHex: 'c20400', tsSymbol: 'AI_ThinkBloodLordFrenzy_6FC36270_113c' },
  { batch: 'k2w3-b1', va: '0x6FC364A0', size: 359, headHex: '83ec288b44242c53', tailHex: 'c20400', tsSymbol: 'AI_ThinkPainWormSpawner_6FC364A0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC36E30', size: 1137, headHex: '83ec34558b6c243c', tailHex: 'c20400', tsSymbol: 'AI_ThinkPatrolAndAttack_6FC36E30_113c' },
  { batch: 'k2w3-b1', va: '0x6FC376B0', size: 292, headHex: '8b44240483ec2055', tailHex: 'feffcc', tsSymbol: 'AI_ThinkBloodHawk_6FC376B0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC377E0', size: 433, headHex: '83ec288b44242c53', tailHex: 'c20400', tsSymbol: 'AI_ThinkGiantSpider_6FC377E0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC379A0', size: 538, headHex: '83ec288b44242c53', tailHex: 'c20400', tsSymbol: 'AI_ThinkThornedHulk_6FC379A0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC37BC0', size: 234, headHex: '83ec288b44242c53', tailHex: 'c20400', tsSymbol: 'AI_ThinkMinionSpawner_6FC37BC0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC381A0', size: 446, headHex: '83ec208b44242453', tailHex: 'c20400', tsSymbol: 'AI_ThinkDualAttack95Pct_6FC381A0_113c' },
  { batch: 'k2w3-b1', va: '0x6FC38360', size: 285, headHex: '83ec208b44242453', tailHex: 'c20400', tsSymbol: 'AI_ThinkDelayedMeleeAttack_6FC38360_113c' },
  { batch: 'k2w3-b1', va: '0x6FC38480', size: 674, headHex: '83ec288b44242c53', tailHex: 'c20400', tsSymbol: 'AI_ThinkSandMaggot_6FC38480_113c' },
  { batch: 'k2w3-b1', va: '0x6FC38CE0', size: 928, headHex: '83ec3c8b44244053', tailHex: 'c20400', tsSymbol: 'AI_ThinkClawViper_6FC38CE0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD06E00', size: 339, headHex: '515556578b7c2418', tailHex: 'c20c00', tsSymbol: 'ACT3Q4_StatusFilter_6FD06E00_113c' },
  { batch: 'k2w5-b9', va: '0x6FD08290', size: 125, headHex: '558be98b45008b80', tailHex: '5e5dc3', tsSymbol: 'ACT3Q0_InitDarkWandererPreset_6FD08290_113c' },
  { batch: 'k2w5-b9', va: '0x6FD08310', size: 394, headHex: '83ec2853568bf18b', tailHex: 'c428c3', tsSymbol: 'ACT3Q5_InitCouncilBossPreset_6FD08310_113c' },
  { batch: 'k2w5-b9', va: '0x6FD084A0', size: 190, headHex: '83ec2856578bf98b', tailHex: 'c428c3', tsSymbol: 'ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD08560', size: 311, headHex: '578bf98b078b80f4', tailHex: '5b5fc3', tsSymbol: 'ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c' },
  { batch: 'k2w5-b9', va: '0x6FD086A0', size: 210, headHex: '578bf98b078b80f4', tailHex: '5e5fc3', tsSymbol: 'ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD098E0', size: 114, headHex: '578bf98b078b80f4', tailHex: 'ff5fc3', tsSymbol: 'ACT3Q5_InitStairsObject_6FD098E0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD09960', size: 173, headHex: '8b44240453558b68', tailHex: '04eba2', tsSymbol: 'ACT3Q5_OnStairsProximityTimer_6FD09960_113c' },
  { batch: 'k2w5-b9', va: '0x6FD09EA0', size: 180, headHex: '538bd8578b7b1880', tailHex: '5f5bc3', tsSymbol: 'ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0A730', size: 468, headHex: '83ec64538b5c2470', tailHex: 'c21800', tsSymbol: 'QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0AB10', size: 77, headHex: '83ec5c5733c0b917', tailHex: 'c20400', tsSymbol: 'QUESTS_SpawnProjectile12B_6FD0AB10_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0AB60', size: 320, headHex: '83ec5c558b6c2464', tailHex: 'c20400', tsSymbol: 'ACT3Q6_FireHellgateOpenerProjectile_6FD0AB60_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0AD10', size: 270, headHex: '578bf885ff0f8401', tailHex: '5b5fc3', tsSymbol: 'PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0AE20', size: 181, headHex: '578bf885ff0f84a8', tailHex: '5b5fc3', tsSymbol: 'PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0B070', size: 16, headHex: '8b442404538bdae8', tailHex: 'c20400', tsSymbol: 'PARTY_SendRosterUpdateCallback_6FD0B070_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0B610', size: 234, headHex: '8b44240483ec3453', tailHex: 'c20800', tsSymbol: 'PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0B700', size: 165, headHex: '83ec548b44245c55', tailHex: 'c20800', tsSymbol: 'PLAYERSAVE_WriteWaypointSection_6FD0B700_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0B7B0', size: 189, headHex: '558bec83e4f881ec', tailHex: 'c20800', tsSymbol: 'PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0BC40', size: 199, headHex: '8b0d9c82d16f8b44', tailHex: 'c20800', tsSymbol: 'PLAYERSAVE_WriteSkillSection_6FD0BC40_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0BD10', size: 144, headHex: '558b6c240c83fdff', tailHex: 'c20800', tsSymbol: 'PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0BE70', size: 425, headHex: 'b820100000e8a6a9', tailHex: 'c20c00', tsSymbol: 'PLAYERSAVE_WriteStatsSection_6FD0BE70_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0C020', size: 181, headHex: '5155578bf88b4424', tailHex: 'c21400', tsSymbol: 'PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0C0E0', size: 54, headHex: '538b5c240c568b37', tailHex: 'c20c00', tsSymbol: 'PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0C120', size: 181, headHex: '53558b6c24105657', tailHex: 'c20800', tsSymbol: 'PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0C1E0', size: 113, headHex: '55578bf88b442410', tailHex: 'c21400', tsSymbol: 'PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0DE90', size: 144, headHex: '83ec0885f6558b6c', tailHex: 'c21000', tsSymbol: 'MONSTER_SpawnMinionPackInRing_6FD0DE90_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0F6B0', size: 279, headHex: '5155568b74241456', tailHex: 'c21000', tsSymbol: 'MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0F7D0', size: 220, headHex: '83ec3453578bf88b', tailHex: 'c21c00', tsSymbol: 'MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0F8B0', size: 141, headHex: '83ec288944240c8b', tailHex: 'c21400', tsSymbol: 'MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0FD40', size: 107, headHex: '85ff746685c07462', tailHex: '005bc3', tsSymbol: 'SUBPARTY_ClearUnitBucketList_6FD0FD40_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0FDB0', size: 133, headHex: '85f6558b6c240874', tailHex: 'c20800', tsSymbol: 'SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD0FED0', size: 123, headHex: '85c0747485db7470', tailHex: 'c20400', tsSymbol: 'SUBPARTY_CreatePlayerBucketHead_6FD0FED0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD10040', size: 17, headHex: '8b44240457518bfa', tailHex: 'c20400', tsSymbol: 'PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c' },
  { batch: 'k2w5-b9', va: '0x6FD103E0', size: 159, headHex: '8b44240853558b6c', tailHex: 'f1ffcc', tsSymbol: 'PARTY_RefreshInviteRelationNodes_6FD103E0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD105B0', size: 132, headHex: '83ec0c56578bf957', tailHex: 'c20400', tsSymbol: 'PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD10640', size: 154, headHex: '83ec0c53578bf957', tailHex: 'c20800', tsSymbol: 'PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c' },
  { batch: 'k2w5-b9', va: '0x6FD10720', size: 211, headHex: '83ec288a44243033', tailHex: 'c20800', tsSymbol: 'NET_SendPacket5A_PartyRelationEvent_6FD10720_113c' },
  { batch: 'k2w5-b9', va: '0x6FD109E0', size: 131, headHex: '85db558b6c240875', tailHex: 'c20400', tsSymbol: 'PARTY_SyncMutualRelationState_6FD109E0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD10B10', size: 118, headHex: '53558b6c240c8bda', tailHex: 'c20400', tsSymbol: 'PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c' },
  { batch: 'k2w5-b9', va: '0x6FD112C0', size: 337, headHex: '83ec1453578b7c24', tailHex: 'c20400', tsSymbol: 'SKILLS_RollRandomUnblockedTargetPos_6FD112C0_113c' },
  { batch: 'k2w5-b9', va: '0x6FD11420', size: 103, headHex: '578bf88bc68bcfe8', tailHex: 'c20400', tsSymbol: 'SKILLS_ResolveTriggeredAttackerTarget_6FD11420_113c' },
  { batch: 'k2w5-b9', va: '0x6FD11490', size: 81, headHex: '578bc6e808f3feff', tailHex: 'c20c00', tsSymbol: 'SKILLS_ResolveTriggeredCorpseTarget_6FD11490_113c' },
  { batch: 'k2w5-b9', va: '0x6FD11730', size: 170, headHex: '83ec0c558b6c241c', tailHex: 'c21000', tsSymbol: 'SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c' },
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

function createWave3World() {
  const m = new SparseMemory113c()
  m.fill(0x6fd18000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x28000, 0)
  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  const pExpTxt = m.alloc(0x20) >>> 0
  m.setU32(pExpTxt, 99)
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpTxt)

  const pCharStats = m.alloc(7 * 0xc4) >>> 0
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStats)
  m.setU32((pDataTables + 0xbc8) >>> 0, 7)
  for (let c = 0; c < 7; c++) {
    m.setU8((pCharStats + c * 0xc4 + 0x46) >>> 0, 3) // nLifePerVitality
    m.setU8((pCharStats + c * 0xc4 + 0x47) >>> 0, 1) // nStaminaPerVitality
    m.setU8((pCharStats + c * 0xc4 + 0x48) >>> 0, 2) // nManaPerMagic
  }

  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c) >>> 0
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)
  m.setU32((pDataTables + 0xba8) >>> 0, 30) // nMaxClassSkills

  const pClassSkillCounts = m.alloc(7 * 4) >>> 0
  const pClassSkillLists = m.alloc(7 * 30 * 2) >>> 0
  m.setU32((pDataTables + 0xba4) >>> 0, pClassSkillCounts)
  m.setU32((pDataTables + 0xbac) >>> 0, pClassSkillLists)
  for (let c = 0; c < 7; c++) {
    m.setU32((pClassSkillCounts + c * 4) >>> 0, 30)
    const baseSk = 6 + c * 30
    for (let j = 0; j < 30; j++) {
      m.setU16((pClassSkillLists + (c * 30 + j) * 2) >>> 0, baseSk + j)
    }
  }

  const pMissilesTxt = m.alloc(64 * 0x1a4) >>> 0
  m.setU32((pDataTables + 0xb64) >>> 0, pMissilesTxt)
  m.setU32((pDataTables + 0xb6c) >>> 0, 64)

  const statesCount = 200
  const pStatesTxt = m.alloc(statesCount * 0x40) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pStatesTxt) >>> 0, pStatesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0, statesCount)
  const pStateMasksExp = m.alloc(0x20) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksExp) >>> 0, pStateMasksExp)
  m.setU32((pDataTables + 0xbbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xbc0) >>> 0, statesCount)

  const itemStatCostCount = 360
  const pItemStatCostTxt = m.alloc(itemStatCostCount * 0x144) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0, pItemStatCostTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0, itemStatCostCount)
  m.setU32((pDataTables + 0xbcc) >>> 0, pItemStatCostTxt)
  m.setU32((pDataTables + 0xbd4) >>> 0, itemStatCostCount)
  m.setU32(0x6fde9e48, pItemStatCostTxt)
  m.setU32(0x6fde9e50, itemStatCostCount)

  const pItemsTxt = m.alloc(16 * D2ItemsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0x00) >>> 0, 16)
  m.setU32((pDataTables + 0x04) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xbd8) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xbdc) >>> 0, 16)
  m.setU32(0x6fdefb94, 16)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(0x6fdefb9c, pItemsTxt)
  m.setU32(0x6fdefba0, 4)
  m.setU32(0x6fdefba4, (pItemsTxt + 4 * D2ItemsTxt_SIZE) >>> 0)
  m.setU32(0x6fdefba8, 4)
  m.setU32(0x6fdefbac, (pItemsTxt + 8 * D2ItemsTxt_SIZE) >>> 0)
  m.setU32(0x6fdefbb0, 8)
  m.setU32((pItemsTxt + 9 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20646c67) // 'gld '
  m.setU8((pItemsTxt + 9 * D2ItemsTxt_SIZE + 0x14d) >>> 0, 1)
  const pLinker = m.alloc(0x20) >>> 0
  const pLinkerRows = m.alloc(16) >>> 0
  m.setU32(pLinker, 1)
  m.setU32((pLinker + 0x08) >>> 0, pLinkerRows)
  m.setU32(pLinkerRows, 0x20646c67)
  m.setU32((pLinkerRows + 0x04) >>> 0, 9)
  m.setU32(0x6fdeff6c, pLinker)

  const pItemTypesTxt = m.alloc(64 * D2ItemTypesTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + 0xbfc) >>> 0, 64)
  m.setU32((pDataTables + 0xc00) >>> 0, 2)
  const pItemTypesHierarchy = m.alloc(64 * 8) >>> 0
  m.setU32((pDataTables + 0xc04) >>> 0, pItemTypesHierarchy)
  // Self-equivalence bits so ITEMS_CheckItemTypeId(item, ownType) returns 1
  for (let t = 0; t < 64; t++) {
    const wordIdx = t >>> 5
    const bitMask = (1 << (t & 31)) >>> 0
    m.setU32((pItemTypesHierarchy + t * 8 + wordIdx * 4) >>> 0, bitMask)
    m.setU8((pItemTypesTxt + t * D2ItemTypesTxt_SIZE + 0x2b) >>> 0, 0xff) // nStaffMods = -1 default
    m.setU8((pItemTypesTxt + t * D2ItemTypesTxt_SIZE + 0x2c) >>> 0, 0xff) // nClass = -1 default
  }

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE) >>> 0
  m.setU32((pDataTables + DATATABLES_LEVELS_TXT_PTR_OFF_113C) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + DATATABLES_LEVELS_TXT_COUNT_OFF_113C) >>> 0, 140)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, act)
    m.setU8((pLevelsTxt + lvl * D2LevelsTxt_SIZE + 0x03) >>> 0, act)
  }

  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)
  const pMonStats2Txt = m.alloc(monStatsCount * 0x134) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa8c) >>> 0, monStatsCount)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)
  for (let id = 0; id < monStatsCount; id++) {
    const rec = (pMonStatsTxt + id * 0x1a8) >>> 0
    m.setU16(rec, id)
    m.setU16((rec + 0x02) >>> 0, id)
    m.setU16((rec + 0x06) >>> 0, id)
    m.setU16((rec + 0x18) >>> 0, id)
  }

  const pUniqueItemsTxt = m.alloc(16 * 0x14c) >>> 0
  m.setU32((pDataTables + 0xc24) >>> 0, pUniqueItemsTxt)
  m.setU32((pDataTables + 0xc28) >>> 0, 16)

  const pSetsTxt = m.alloc(8 * 0x128) >>> 0
  m.setU32((pDataTables + 0xc0c) >>> 0, pSetsTxt)
  m.setU32((pDataTables + 0xc10) >>> 0, 8)

  const pSetItemsTxt = m.alloc(16 * 0x1b8) >>> 0
  m.setU32((pDataTables + 0xc18) >>> 0, pSetItemsTxt)
  m.setU32((pDataTables + 0xc1c) >>> 0, 16)

  const pObjectsTxt = m.alloc(600 * 0x1c0) >>> 0
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  const pObjGroupTxt = m.alloc(4 * 0xb8) >>> 0
  m.setU32(0x6fdf0b8c, pObjGroupTxt)
  m.setU32(0x6fdf0b90, 4)
  m.setU8((pObjGroupTxt + 0xb2) >>> 0, 2)
  m.setU8((pObjGroupTxt + 0xb8 + 0xb2) >>> 0, 5)

  const fieldDx = [0, 1, 1, 1, 0, -1, -1, -1, 0]
  const fieldDy = [-1, -1, 0, 1, 1, 1, 0, -1, 0]
  for (let i = 0; i < 9; i++) {
    m.setU32((0x6fde9ba0 + i * 4) >>> 0, fieldDx[i]! >>> 0)
    m.setU32((0x6fde9bc4 + i * 4) >>> 0, fieldDy[i]! >>> 0)
  }
  const pFieldData = m.alloc(256 * 256) >>> 0
  m.fill(pFieldData, 256 * 256, 8)
  m.setU32(0x6fdf1404, pFieldData)
  m.setU32(0x6fdf1414, 128)
  m.setU32(0x6fdf1418, 128)

  const pAnimDataTable = m.alloc(0x420) >>> 0
  const pEmptyBucket = m.alloc(16) >>> 0
  for (let i = 0; i < 256; i++) {
    m.setU32((pAnimDataTable + i * 4) >>> 0, pEmptyBucket)
  }
  m.setU32((pAnimDataTable + 0x40c) >>> 0, 8)
  m.setU32((pAnimDataTable + 0x410) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)

  // MonMode table (ANIM_MON_MODE_COUNT_VA=0x6fdf13a4, TBL_VA=0x6fdf13b0)
  const pMonModeTbl = m.alloc(16 * 0x34) >>> 0
  m.setU32(0x6fdf13a4, 16)
  m.setU32(0x6fdf13b0, pMonModeTbl)

  return {
    m,
    pDataTables,
    pCharStats,
    pSkillsTxt,
    pMissilesTxt,
    pStatesTxt,
    pStateMasksExp,
    pItemStatCostTxt,
    pItemsTxt,
    pItemTypesTxt,
    pItemTypesHierarchy,
    pLevelsTxt,
    pMonStatsTxt,
    pMonStats2Txt,
    pUniqueItemsTxt,
    pSetsTxt,
    pSetItemsTxt,
    pObjectsTxt,
  }
}

function allocObjectUnit(m: SparseMemory113c, guid: number, classId = 100, mode = 0): number {
  const pObject = m.alloc(0x100) >>> 0
  m.setU32(pObject, 2)
  m.setU32((pObject + 0x04) >>> 0, classId)
  m.setU32((pObject + 0x0c) >>> 0, guid)
  m.setU32((pObject + 0x10) >>> 0, mode)
  const pStaticPath = m.alloc(0x20) >>> 0
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE) >>> 0
  m.setU32(pStaticPath, pRoom)
  m.setU32((pObject + 0x2c) >>> 0, pStaticPath)
  return pObject
}

function allocPlayerUnit(m: SparseMemory113c, guid: number, difficulty = 0, levelId = 109) {
  const pPlayer = m.alloc(0x120) >>> 0
  const pPlayerData = m.alloc(0x180) >>> 0
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
  const pClient = m.alloc(0x600) >>> 0
  m.setU32((pClient + 0x1bc) >>> 0, m.alloc(0x800) >>> 0)
  m.setU32(pPlayer, 0)
  m.setU32((pPlayer + 0x0c) >>> 0, guid)
  m.setU32((pPlayer + 0x10) >>> 0, 1)
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
  m.setU32((pPlayerData + 0x10 + difficulty * 4) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)

  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE) >>> 0
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE) >>> 0
  const pLevel = m.alloc(D2DrlgLevelStrc_SIZE) >>> 0
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, levelId)
  const pDynPath = m.alloc(0x80) >>> 0
  m.setU32((pDynPath + 0x1c) >>> 0, pRoom)
  m.setU32((pPlayer + 0x2c) >>> 0, pDynPath)

  const pStatList = m.alloc(D2StatListExStrc_SIZE) >>> 0
  m.set(pPlayer, D2UnitStrc.pStatListEx, pStatList)
  m.setU32((pStatList + 0x10) >>> 0, STATLIST_FLAG_EXTENDED)

  return { pPlayer, pPlayerData, pQuestFlags, pClient, pRoom, pLevel, pDynPath }
}

function linkQuest(
  m: SparseMemory113c,
  pGame: number,
  nQuestNo: number,
  bNotIntro = 1,
  bLastState = 1,
  dwQuestRecordId = nQuestNo,
) {
  let pCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pCtrl === 0) {
    pCtrl = m.alloc(0x20) >>> 0
    m.setU32((pGame + 0x10f4) >>> 0, pCtrl)
  }
  const pQuest = m.alloc(0x100) >>> 0
  const pQuestDataEx = m.alloc(0x140) >>> 0
  m.setU32(pQuest, nQuestNo >>> 0)
  m.setU32((pQuest + 0x04) >>> 0, pGame)
  m.setU8((pQuest + 0x09) >>> 0, bNotIntro & 0xff)
  m.setU8((pQuest + 0x0c) >>> 0, bLastState & 0xff)
  m.setU32((pQuest + 0x18) >>> 0, pQuestDataEx)
  m.setU32((pQuest + 0xe0) >>> 0, dwQuestRecordId >>> 0)
  m.setU32((pQuest + 0xf4) >>> 0, m.u32(pCtrl) >>> 0)
  m.setU32(pCtrl, pQuest)
  return { pQuest, pQuestDataEx }
}

describe('[K2] D2Game 1.13c Disassembly-Verified Promotion Wave 3 (+169 VAs: Lane M)', () => {
  it('validates manifest diff-verified status and real PE32 D2Game.dll (0x6FC20000) opcodes across all 169 VAs', () => {
    expect(WAVE3_PROMOTED_SPECS.length).toBe(169)
    const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))

    const d2GameFnByVa = new Map(
      manifest.functions
        .filter((f) => f.module === 'D2Game')
        .map((f) => [f.va.toUpperCase(), f]),
    )

    for (const spec of WAVE3_PROMOTED_SPECS) {
      const fn = d2GameFnByVa.get(spec.va.toUpperCase())
      expect(fn, `Missing manifest entry for ${spec.va}`).toBeDefined()
      expect(fn!.status, `${spec.va} (${fn!.name}) must be diff-verified`).toBe('diff-verified')
      expect(fn!.tsSymbol).toBe(spec.tsSymbol)
      expect(fn!.size).toBe(spec.size)
      expect(Boolean(fn!.indirectUnknown)).toBe(false)
      expect(fn!.diffEvidence).toContain('tests/oracle/k2/k2-disasm-verified-wave3.test.ts')
    }

    const d2GameDllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    if (fs.existsSync(d2GameDllPath)) {
      const pe = loadPeSectionMapper(d2GameDllPath, 0x6fc20000)
      for (const spec of WAVE3_PROMOTED_SPECS) {
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
      }
    }
  })

  describe('1.13c PE32 Disassembly Bug Fix Differential Tests (11 Fixes)', () => {
    it('Fix #1 (0x6FD0BE70): PLAYERSAVE_WriteStatsSection zeros rolled-over bytes in dirty 0xFF buffer per Fog:#10128', () => {
      const { m, pItemStatCostTxt } = createWave3World()
      const pGame = m.alloc(0x1800) >>> 0
      const pPlayer = m.alloc(0x120) >>> 0
      m.setU32(pPlayer, 0)
      m.setU32((pPlayer + 0x0c) >>> 0, 1)
      const pStatList = STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
      m.setU32((pPlayer + 0x5c) >>> 0, pStatList)

      // Stat 1 (Energy) = 18 (10 bits), Stat 3 (Vitality) = 22 (10 bits)
      m.setU8((pItemStatCostTxt + 1 * 0x144 + 0x0a) >>> 0, 10)
      m.setU8((pItemStatCostTxt + 3 * 0x144 + 0x0a) >>> 0, 10)
      STATLIST_SetUnitStat113c(m, pPlayer, 1, 18, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 3, 22, 0)

      // Pre-fill scratch buffer with 0xFF so stale high bits would corrupt output without byte-rollover zeroing
      const pBuf = m.alloc(0x80) >>> 0
      m.fill(pBuf, 0x80, 0xff)
      const ppCur = m.alloc(4) >>> 0
      m.setU32(ppCur, pBuf)

      expect(PLAYERSAVE_WriteStatsSection_6FD0BE70_113c(m, pPlayer, ppCur, pBuf + 0x80)).toBe(0)
      expect(m.u16(pBuf)).toBe(0x6667) // 'gf'
      // Bitstream LSB-first:
      // 9b statId=1 (0x001), 10b val=18 (0x012), 9b statId=3 (0x003), 10b val=22 (0x016), 9b end=0x1FF
      // Total bits = 9 + 10 + 9 + 10 + 9 = 47 bits => ceil(47/8) = 6 payload bytes (+ 2 header = 8 bytes)
      expect(m.u32(ppCur) - pBuf).toBe(8)
      const bits: number[] = []
      const pushBits = (v: number, n: number) => {
        for (let i = 0; i < n; i++) bits.push((v >>> i) & 1)
      }
      pushBits(1, 9)
      pushBits(18, 10)
      pushBits(3, 9)
      pushBits(22, 10)
      pushBits(0x1ff, 9)
      for (let byteIdx = 0; byteIdx < 6; byteIdx++) {
        let expected = 0
        for (let b = 0; b < 8; b++) {
          const bi = byteIdx * 8 + b
          if (bi < bits.length && bits[bi]) expected |= 1 << b
        }
        expect(m.u8(pBuf + 2 + byteIdx)).toBe(expected)
      }
    })

    it('Fix #2 (0x6FC2E410): ITEMS_PopulateItemDropStruct distinguishes dwQuality, wType1 (gold=4 / ear=7), bStackable(+0x132), and dwItemFlags(+0x18)', () => {
      const { m, pItemsTxt } = createWave3World()

      const makeItem = (classId: number, quality: number, flags: number, wType1: number, bStackable: number) => {
        const pItem = m.alloc(0x100) >>> 0
        const pItemData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
        const pStats = STATLIST_AllocList113c(m, 0, 4, 0, 0, 0)
        m.set(pItem, D2UnitStrc.dwUnitType, 4)
        m.set(pItem, D2UnitStrc.dwClassId, classId)
        m.set(pItem, D2UnitStrc.pUnitData, pItemData)
        m.setU32((pItem + 0x5c) >>> 0, pStats)
        m.set(pItemData, D2ItemDataStrc.wItemFormat, 100)
        m.set(pItemData, D2ItemDataStrc.dwItemLevel, 42)
        m.set(pItemData, D2ItemDataStrc.dwQuality, quality)
        m.setU32((pItemData + 0x18) >>> 0, flags)
        m.set(pItemData, D2ItemDataStrc.dwItemCell, 5)
        const pRec = (pItemsTxt + classId * D2ItemsTxt_SIZE) >>> 0
        m.setU16((pRec + 0x11e) >>> 0, wType1)
        m.setU8((pRec + 0x132) >>> 0, bStackable)
        return { pItem, pItemData }
      }

      // A) Gold item (wType1 = 4, dwQuality = 2 normal, dwItemFlags = 0x1234)
      const gold = makeItem(1, 2, 0x1234, 4, 0)
      STATLIST_SetUnitStat113c(m, gold.pItem, 0x0e, 777, 0)
      const pDropA = m.alloc(0x90) >>> 0
      ITEMS_PopulateItemDropStruct_6FC2E410_113c(m, pDropA, gold.pItem, 0)
      expect(m.u32((pDropA + 0x30) >>> 0)).toBe(2) // dwQuality, NOT wType1!
      expect(m.u32((pDropA + 0x34) >>> 0)).toBe(777) // STAT_GOLD
      expect(m.u32((pDropA + 0x44) >>> 0)).toBe(0x1234) // dwItemFlags

      // B) Magic stackable item (dwQuality = 4, wType1 = 45 != 4, bStackable = 1) -> reads STAT_QUANTITY (0x46), NOT gold!
      const jav = makeItem(2, 4, 0x55, 45, 1)
      STATLIST_SetUnitStat113c(m, jav.pItem, 0x0e, 999, 0)
      STATLIST_SetUnitStat113c(m, jav.pItem, 0x46, 25, 0)
      const pDropB = m.alloc(0x90) >>> 0
      ITEMS_PopulateItemDropStruct_6FC2E410_113c(m, pDropB, jav.pItem, 0)
      expect(m.u32((pDropB + 0x30) >>> 0)).toBe(4)
      expect(m.u32((pDropB + 0x34) >>> 0)).toBe(25)

      // C) Unique non-ear item (dwQuality = 7, wType1 = 27 != 7) -> must NOT copy ear fields
      const uniq = makeItem(3, 7, 0x10, 27, 0)
      m.set(uniq.pItemData, D2ItemDataStrc.bEarLevel, 99)
      const pDropC = m.alloc(0x90) >>> 0
      ITEMS_PopulateItemDropStruct_6FC2E410_113c(m, pDropC, uniq.pItem, 0)
      expect(m.u32((pDropC + 0x30) >>> 0)).toBe(7)
      expect(m.u8((pDropC + 0x50) >>> 0)).toBe(0)

      // D) Ear item (wType1 = 7, dwQuality = 2) -> copies ear name (+0x58) & ear level (+0x50)
      const ear = makeItem(4, 2, 0x10, 7, 0)
      m.set(ear.pItemData, D2ItemDataStrc.bEarLevel, 85)
      const earNameOff = (ear.pItemData + D2ItemDataStrc.szPlayerName.off) >>> 0
      m.setU8(earNameOff, 'H'.charCodeAt(0))
      m.setU8((earNameOff + 1) >>> 0, 'e'.charCodeAt(0))
      m.setU8((earNameOff + 2) >>> 0, 'r'.charCodeAt(0))
      m.setU8((earNameOff + 3) >>> 0, 'o'.charCodeAt(0))
      m.setU8((earNameOff + 4) >>> 0, 0)
      const pDropD = m.alloc(0x90) >>> 0
      ITEMS_PopulateItemDropStruct_6FC2E410_113c(m, pDropD, ear.pItem, 0)
      expect(m.u8((pDropD + 0x50) >>> 0)).toBe(85)
      expect(m.u8((pDropD + 0x58) >>> 0)).toBe('H'.charCodeAt(0))
      expect(m.u8((pDropD + 0x5b) >>> 0)).toBe('o'.charCodeAt(0))
    })

    it('Fix #3 (0x6FC33320): ITEMS_AddClassSpecificAutoModSkills enforces format>=100 tier5 gate, low-quality sLvl=1 & seed preservation, SkillsTxt+0x18 check, and lazy statlist', () => {
      const { m, pSkillsTxt, pItemsTxt, pItemTypesTxt } = createWave3World()

      // Configure item class 1 -> wType1 = 10, itemType 10 -> nClass = 1
      m.setU16((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x11e) >>> 0, 10)
      m.setU8((pItemTypesTxt + 10 * D2ItemTypesTxt_SIZE + 0x2c) >>> 0, 1)

      // Skills in tiers 1..6 (6..35): tiers 4..6 (21..35) have matching SkillsTxt+0x18 = 10;
      // tiers 1..3 (6..20) have mismatching +0x18 = 99
      for (let s = 6; s < 36; s++) {
        m.setU16((pSkillsTxt + s * 0x23c + 0x18) >>> 0, s >= 21 ? 10 : 99)
      }

      const makeFreshItem = (format: number, quality: number, seedLo: number, seedHi: number) => {
        const pItem = m.alloc(0x100) >>> 0
        const pItemData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
        m.set(pItem, D2UnitStrc.dwUnitType, 4)
        m.set(pItem, D2UnitStrc.dwClassId, 1)
        m.set(pItem, D2UnitStrc.pUnitData, pItemData)
        m.set(pItemData, D2ItemDataStrc.wItemFormat, format)
        m.set(pItemData, D2ItemDataStrc.dwQuality, quality)
        m.set(pItemData, D2ItemDataStrc.dwSeedLo, seedLo >>> 0)
        m.set(pItemData, D2ItemDataStrc.dwSeedHi, seedHi >>> 0)
        const pStatListEx = STATLIST_CreateEx113c(m, pItem)
        return { pItem, pItemData, pStatListEx }
      }

      // Find a deterministic seed where numSkills === 0 -> no 0x40 sub-list allocated (lazy statlist!)
      let zeroSkillSeed = 1
      for (let s = 1; s < 500; s++) {
        const item = makeFreshItem(100, 2, s, 666)
        ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c(m, item.pItem, 50, 6, 0)
        if (m.get(item.pStatListEx, D2StatListExStrc.pMyLastList) === 0) {
          zeroSkillSeed = s
          break
        }
      }
      const lazyCheck = makeFreshItem(100, 2, zeroSkillSeed, 666)
      ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c(m, lazyCheck.pItem, 50, 6, 0)
      expect(m.get(lazyCheck.pStatListEx, D2StatListExStrc.pMyLastList)).toBe(0)

      // Compare format=100 quality=1 (low quality) vs quality=2 (normal) on identical seed that rolls skills:
      // Low quality forces sLvl = 1, clamps tier <= 4 (only skill 26..30), AND skips the level PRNG roll!
      let verifiedLowQuality = false
      for (let s = 1; s < 200; s++) {
        const lowQ = makeFreshItem(100, 1, s, 0x12345)
        const normQ = makeFreshItem(100, 2, s, 0x12345)
        ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c(m, lowQ.pItem, 50, 6, 100)
        ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c(m, normQ.pItem, 50, 6, 100)
        if (
          m.get(lowQ.pStatListEx, D2StatListExStrc.pMyLastList) !== 0 &&
          m.get(normQ.pStatListEx, D2StatListExStrc.pMyLastList) !== 0
        ) {
          // No tier 5..6 skills (26..35) allowed on low-quality item (clamped to tier <= 4!)
          for (let t5 = 26; t5 <= 35; t5++) {
            expect(STATLIST_GetUnitStat113c(m, lowQ.pItem, 0x6b, t5)).toBe(0)
          }
          // Every applied skill on low-quality item (tier 1..4 = 6..25) has level === 1
          let anyApplied = false
          for (let sk = 6; sk <= 25; sk++) {
            const lv = STATLIST_GetUnitStat113c(m, lowQ.pItem, 0x6b, sk)
            if (lv > 0) {
              expect(lv).toBe(1)
              anyApplied = true
            }
          }
          if (anyApplied) {
            // Seed diverged because low quality skipped the skill-level PRNG roll
            expect(m.get(lowQ.pItemData, D2ItemDataStrc.dwSeedLo)).not.toBe(
              m.get(normQ.pItemData, D2ItemDataStrc.dwSeedLo),
            )
            verifiedLowQuality = true
            break
          }
        }
      }
      expect(verifiedLowQuality).toBe(true)

      // Classic format (< 100) with ilvl=50 caps baseTier at 4
      const classicItem = makeFreshItem(0, 2, 7, 999)
      ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c(m, classicItem.pItem, 50, 6, 0)
      expect(m.get(classicItem.pItemData, D2ItemDataStrc.dwSeedLo)).not.toBe(7)
    })

    it('Fix #4 (0x6FC335E0): ITEMS_AddStaffModSkillsByTier reaches tier 5, excludes skill 0x49, and allocates statlist lazily', () => {
      const { m } = createWave3World()

      // Search seeds with ilvl = 30 (baseTier = 4) and nBaseSkillId = 53 (tier 5 = 53 + 20 = 73..77, where 73 == 0x49!)
      let sawTier5 = false
      let sawZeroAlloc = false
      for (let s = 1; s <= 400; s++) {
        const pItem = m.alloc(0x100) >>> 0
        const pItemData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
        m.set(pItem, D2UnitStrc.dwUnitType, 4)
        m.set(pItem, D2UnitStrc.dwClassId, 1)
        m.set(pItem, D2UnitStrc.pUnitData, pItemData)
        m.set(pItemData, D2ItemDataStrc.dwSeedLo, (s * 0x9e3779b1) >>> 0)
        m.set(pItemData, D2ItemDataStrc.dwSeedHi, 666)
        const pStatListEx = STATLIST_CreateEx113c(m, pItem)

        ITEMS_AddStaffModSkillsByTier_6FC335E0_113c(m, 30, pItem, 53)
        if (m.get(pStatListEx, D2StatListExStrc.pMyLastList) === 0) {
          sawZeroAlloc = true
          continue
        }
        // Skill 0x49 (73) must NEVER be chosen
        expect(STATLIST_GetUnitStat113c(m, pItem, 0x6b, 0x49)).toBe(0)
        // Tier 5 skills (74..77) MUST be reachable (previously broken by erroneous tier > 4 clamp!)
        for (let sk = 74; sk <= 77; sk++) {
          if (STATLIST_GetUnitStat113c(m, pItem, 0x6b, sk) > 0) {
            sawTier5 = true
          }
        }
      }
      expect(sawZeroAlloc).toBe(true)
      expect(sawTier5).toBe(true)
    })

    it('Fix #5 (0x6FC337F0 & 0x6FC33E60): Low-quality durability roll uses halfDur modulus ([halfDur, maxDur - 1])', () => {
      const { m, pItemsTxt } = createWave3World()
      m.setU32(0x6fdf111c, 4) // books count ptr
      // baseDur = 60 -> 0x6FC337F0: floor(60/3) = 20 (half=10); 0x6FC33E60: floor(60*33/100) = 19 (half=9)
      m.setU8((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x112) >>> 0, 60)
      m.setU8((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x113) >>> 0, 0) // bNoDurability = 0

      const pDrop = m.alloc(0x90) >>> 0
      for (let i = 0; i < 32; i++) {
        for (const [fn, expectedMax] of [
          [(pItem: number) => ITEMS_ApplyLowQualityItemMods_6FC337F0_113c(m, pItem), 20],
          [(pItem: number) => ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c(m, pItem, pDrop), 19],
        ] as const) {
          const pItem = m.alloc(0x100) >>> 0
          const pItemData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
          const pStats = STATLIST_AllocList113c(m, 0, 4, 0, 0, 0)
          m.set(pItem, D2UnitStrc.dwUnitType, 4)
          m.set(pItem, D2UnitStrc.dwClassId, 1)
          m.set(pItem, D2UnitStrc.pUnitData, pItemData)
          m.setU32((pItem + 0x5c) >>> 0, pStats)
          m.setU32((pItem + 0x20) >>> 0, (0x10001 * (i + 1)) >>> 0)
          m.setU32((pItem + 0x24) >>> 0, (0x7777 * (i + 3)) >>> 0)
          m.set(pItemData, D2ItemDataStrc.dwSeedLo, (0x10001 * (i + 1)) >>> 0)
          m.set(pItemData, D2ItemDataStrc.dwSeedHi, (0x7777 * (i + 3)) >>> 0)
          STATLIST_SetUnitStat113c(m, pItem, 0x48, 60, 0)
          STATLIST_SetUnitStat113c(m, pItem, 0x49, 60, 0)
          fn(pItem)
          const curDur = STATLIST_GetUnitBaseStat113c(m, pItem, 0x48, 0)
          const maxDur = STATLIST_GetUnitBaseStat113c(m, pItem, 0x49, 0)
          const expectedHalf = expectedMax >>> 1
          expect(maxDur).toBe(expectedMax)
          expect(curDur).toBeGreaterThanOrEqual(expectedHalf)
          expect(curDur).toBeLessThan(expectedMax)
        }
      }
    })

    it('Fix #6 (0x6FC33A30): ITEMS_ApplyCraftedOrSetItemCell doubles durability unconditionally, checks D2SetsTxt+0x04 version, and restores seedLo on miss', () => {
      const { m, pDataTables, pItemsTxt, pSetsTxt, pSetItemsTxt } = createWave3World()
      const dwCode = 0x20647773 // 'swd '
      m.setU32((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x80) >>> 0, dwCode)
      m.setU8((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x113) >>> 0, 0)

      // Set 0: classic (wVersion at +0x04 = 0 < 100), has item 0 matching dwCode with index 7
      // Set 1: expansion (wVersion at +0x04 = 100 >= 100), has item 1 matching dwCode with index 9 (must be excluded!)
      m.setU32((pDataTables + 0xc10) >>> 0, 2)
      m.setU16((pSetsTxt + 0 * 0x128 + 0x04) >>> 0, 0)
      m.setU32((pSetsTxt + 0 * 0x128 + 0x0c) >>> 0, 1)
      m.setU32((pSetsTxt + 0 * 0x128 + 0x110) >>> 0, pSetItemsTxt)
      m.setU16((pSetItemsTxt + 0x00) >>> 0, 7)
      m.setU32((pSetItemsTxt + 0x28) >>> 0, dwCode)

      m.setU16((pSetsTxt + 1 * 0x128 + 0x04) >>> 0, 100)
      m.setU32((pSetsTxt + 1 * 0x128 + 0x0c) >>> 0, 1)
      m.setU32((pSetsTxt + 1 * 0x128 + 0x110) >>> 0, (pSetItemsTxt + 0x1b8) >>> 0)
      m.setU16((pSetItemsTxt + 0x1b8 + 0x00) >>> 0, 9)
      m.setU32((pSetItemsTxt + 0x1b8 + 0x28) >>> 0, dwCode)

      const pItem = m.alloc(0x100) >>> 0
      const pItemData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
      const pStats = STATLIST_AllocList113c(m, 0, 4, 0, 0, 0)
      m.set(pItem, D2UnitStrc.dwUnitType, 4)
      m.set(pItem, D2UnitStrc.dwClassId, 1)
      m.set(pItem, D2UnitStrc.pUnitData, pItemData)
      m.setU32((pItem + 0x5c) >>> 0, pStats)
      m.setU32((pItemData + 0x0c) >>> 0, 0x12345678)
      m.setU32((pItemData + 0x10) >>> 0, 0x9abcdef0)
      STATLIST_SetUnitStat113c(m, pItem, 0x48, 15, 0)
      STATLIST_SetUnitStat113c(m, pItem, 0x49, 200, 0)

      expect(ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c(m, pItem)).toBe(1)
      expect(m.get(pItemData, D2ItemDataStrc.dwItemCell)).toBe(7)
      // Durability doubled (15*2=30, 200*2 clamped to 255)
      expect(STATLIST_GetUnitBaseStat113c(m, pItem, 0x48, 0)).toBe(30)
      expect(STATLIST_GetUnitBaseStat113c(m, pItem, 0x49, 0)).toBe(255)

      // On miss (change Set 0 item code so only expansion Set 1 matches): returns 0 & restores savedSeedLo!
      m.setU32((pSetItemsTxt + 0x28) >>> 0, 0x20617865)
      m.set(pItemData, D2ItemDataStrc.dwSeedLo, 0xdeadbeef)
      m.set(pItemData, D2ItemDataStrc.dwSeedHi, 666)
      expect(ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c(m, pItem)).toBe(0)
      expect(m.get(pItemData, D2ItemDataStrc.dwSeedLo)).toBe(0xdeadbeef)
    })

    it('Fix #7 (0x6FC33C20): ITEMS_RollAndApplyUniqueItem does NOT double durability, enforces wLvl<=ilvl even when forced, and uses exact [0, totalWeight) roll', () => {
      const { m, pDataTables, pItemsTxt, pSetItemsTxt } = createWave3World()
      const dwCode = 0x20726e67 // 'rng '
      m.setU32((pItemsTxt + 2 * D2ItemsTxt_SIZE + 0x80) >>> 0, dwCode)

      m.setU32((pDataTables + 0xc1c) >>> 0, 2)
      // Row 0: wLvl = 50 (too high for ilvl = 20!), rarity = 1
      m.setU32((pSetItemsTxt + 0 * 0x1b8 + 0x28) >>> 0, dwCode)
      m.setU16((pSetItemsTxt + 0 * 0x1b8 + 0x30) >>> 0, 50)
      m.setU32((pSetItemsTxt + 0 * 0x1b8 + 0x34) >>> 0, 1)
      // Row 1: wLvl = 10, rarity = 3
      m.setU32((pSetItemsTxt + 1 * 0x1b8 + 0x28) >>> 0, dwCode)
      m.setU16((pSetItemsTxt + 1 * 0x1b8 + 0x30) >>> 0, 10)
      m.setU32((pSetItemsTxt + 1 * 0x1b8 + 0x34) >>> 0, 3)

      const pItem = m.alloc(0x100) >>> 0
      const pItemData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
      const pStats = STATLIST_AllocList113c(m, 0, 4, 0, 0, 0)
      m.set(pItem, D2UnitStrc.dwUnitType, 4)
      m.set(pItem, D2UnitStrc.dwClassId, 2)
      m.set(pItem, D2UnitStrc.pUnitData, pItemData)
      m.setU32((pItem + 0x5c) >>> 0, pStats)
      m.set(pItemData, D2ItemDataStrc.dwItemLevel, 20)
      m.set(pItemData, D2ItemDataStrc.dwSeedLo, 12345)
      m.set(pItemData, D2ItemDataStrc.dwSeedHi, 666)
      STATLIST_SetUnitStat113c(m, pItem, 0x48, 17, 0)
      STATLIST_SetUnitStat113c(m, pItem, 0x49, 23, 0)

      const pDrop = m.alloc(0x90) >>> 0
      // Forced index 0 (drop+0x40 = 1) has wLvl 50 > ilvl 20 -> rejected! Falls back to eligible row 1 (wLvl 10).
      m.setU32((pDrop + 0x40) >>> 0, 1)
      expect(ITEMS_RollAndApplyUniqueItem_6FC33C20_113c(m, pItem, pDrop)).toBe(1)
      expect(m.get(pItemData, D2ItemDataStrc.dwItemCell)).toBe(1)
      // When row 1 also has wLvl 50 > ilvl 20 -> returns 0 even with forced index 0!
      m.setU16((pSetItemsTxt + 1 * 0x1b8 + 0x30) >>> 0, 50)
      expect(ITEMS_RollAndApplyUniqueItem_6FC33C20_113c(m, pItem, pDrop)).toBe(0)
      m.setU16((pSetItemsTxt + 1 * 0x1b8 + 0x30) >>> 0, 10)
      // Durability MUST NOT be doubled!
      expect(STATLIST_GetUnitBaseStat113c(m, pItem, 0x48, 0)).toBe(17)
      expect(STATLIST_GetUnitBaseStat113c(m, pItem, 0x49, 0)).toBe(23)

      // Unforced with both rows eligible (ilvl = 60): selects row 0 or row 1 via [0, 4)
      m.set(pItemData, D2ItemDataStrc.dwItemLevel, 60)
      m.setU32((pDrop + 0x40) >>> 0, 0)
      const picked = new Set<number>()
      for (let s = 1; s <= 40; s++) {
        m.set(pItemData, D2ItemDataStrc.dwSeedLo, (s * 1103515245) >>> 0)
        m.set(pItemData, D2ItemDataStrc.dwSeedHi, 666)
        expect(ITEMS_RollAndApplyUniqueItem_6FC33C20_113c(m, pItem, pDrop)).toBe(1)
        picked.add(m.get(pItemData, D2ItemDataStrc.dwItemCell))
      }
      expect(picked.has(0)).toBe(true)
      expect(picked.has(1)).toBe(true)
      expect(STATLIST_GetUnitBaseStat113c(m, pItem, 0x48, 0)).toBe(17)
      expect(STATLIST_GetUnitBaseStat113c(m, pItem, 0x49, 0)).toBe(23)
    })

    it('Fix #8 (0x6FC33E60 & 0x6FC340B0): Calls real ITEMS_RollStaffModsOnItem_6FC33DE0_113c (0x6FC33DE0 traced)', () => {
      const { m, pItemsTxt, pItemTypesTxt } = createWave3World()
      m.setU32(0x6fdf111c, 4)
      // Populate QualityItems.txt (SGPT_BELTS_TXT_COUNT_VA=0x6fdefd90, PTR_VA=0x6fdefd94) matching itemType 0x02
      const pQualTxt = m.alloc(0x70) >>> 0
      m.setU8((pQualTxt + 2) >>> 0, 1) // f0 matches wType1 === 0x02
      m.setU32(0x6fdefd90, 1)
      m.setU32(0x6fdefd94, pQualTxt)

      m.setU16((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x11e) >>> 0, 0x02)
      m.setU8((pItemTypesTxt + 0x02 * D2ItemTypesTxt_SIZE + 0x2b) >>> 0, 1) // nStaffMods = Sorceress (1)
      m.setU8((pItemTypesTxt + 0x02 * D2ItemTypesTxt_SIZE + 0x2c) >>> 0, 1)

      const pItem = m.alloc(0x100) >>> 0
      const pItemData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
      m.set(pItem, D2UnitStrc.dwUnitType, 4)
      m.set(pItem, D2UnitStrc.dwClassId, 1)
      m.set(pItem, D2UnitStrc.pUnitData, pItemData)
      STATLIST_CreateEx113c(m, pItem)
      m.set(pItemData, D2ItemDataStrc.wItemFormat, 100)
      const pDrop = m.alloc(0x90) >>> 0
      m.setU32((pDrop + 0x0c) >>> 0, 25)

      beginVaTrace113c()
      ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c(m, pItem, pDrop)
      const hitsLow = endVaTrace113c()
      expect(hitsLow.has('D2Game:0x6FC33E60')).toBe(true)
      expect(hitsLow.has('D2Game:0x6FC33DE0')).toBe(true)

      beginVaTrace113c()
      expect(ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c(m, pItem, pDrop)).toBe(1)
      const hitsHigh = endVaTrace113c()
      expect(hitsHigh.has('D2Game:0x6FC340B0')).toBe(true)
      expect(hitsHigh.has('D2Game:0x6FC33DE0')).toBe(true)
    })

    it('Fix #9 (0x6FC359B0): AI_InitBaalThroneTentaclePositionDelta reads dwLeaderId (+0x2C) and dwLeaderType (+0x30) accurately', () => {
      const { m } = createWave3World()
      const pGame = m.alloc(0x2000) >>> 0

      // Owner monster: type = 1, id = 42, pos = (100, 200)
      const pOwner = m.alloc(0x100) >>> 0
      const pOwnerPath = m.alloc(0x80) >>> 0
      m.set(pOwner, D2UnitStrc.dwUnitType, 1)
      m.set(pOwner, D2UnitStrc.dwUnitId, 42)
      m.set(pOwner, D2UnitStrc.pPath, pOwnerPath)
      m.setU16((pOwnerPath + 0x02) >>> 0, 100)
      m.setU16((pOwnerPath + 0x06) >>> 0, 200)
      SUNIT_InsertServerUnit113c(m, pGame, pOwner)

      // Tentacle monster: type = 1, id = 99, pos = (115, 190)
      const pTentacle = m.alloc(0x100) >>> 0
      const pMonData = m.alloc(0x80) >>> 0
      const pAiGen = m.alloc(0x60) >>> 0
      const pPath = m.alloc(0x80) >>> 0
      m.set(pTentacle, D2UnitStrc.dwUnitType, 1)
      m.set(pTentacle, D2UnitStrc.dwUnitId, 99)
      m.set(pTentacle, D2UnitStrc.pUnitData, pMonData)
      m.setU32((pMonData + 0x28) >>> 0, pAiGen)
      m.set(pTentacle, D2UnitStrc.pPath, pPath)
      m.setU16((pPath + 0x02) >>> 0, 115)
      m.setU16((pPath + 0x06) >>> 0, 190)
      m.setU32((pAiGen + 0x28) >>> 0, pGame)
      m.setU32((pAiGen + 0x2c) >>> 0, 42) // dwLeaderId
      m.setU32((pAiGen + 0x30) >>> 0, 1) // dwLeaderType
      SUNIT_InsertServerUnit113c(m, pGame, pTentacle)

      const pAiThinkArg = m.alloc(0x30) >>> 0
      const pAiParam = m.alloc(0x50) >>> 0
      m.setU32(pAiThinkArg, pAiParam)

      AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c(m, pTentacle, pAiThinkArg)
      expect(m.u32((pAiParam + 0x14) >>> 0) | 0).toBe(15) // 115 - 100
      expect(m.u32((pAiParam + 0x18) >>> 0) | 0).toBe(-10) // 190 - 200
    })

    it('Fix #10 (0x6FC35B00): AI_CheckTargetIsUnboundPutridDefiler passes (pUnit, pGame) to SUNIT_GetOwnerUnit113c', () => {
      const { m } = createWave3World()
      const pGame = m.alloc(0x2000) >>> 0

      const pSelf = m.alloc(0x100) >>> 0
      const pSelfPath = m.alloc(0x80) >>> 0
      m.set(pSelf, D2UnitStrc.dwUnitType, 1)
      m.set(pSelf, D2UnitStrc.dwUnitId, 1)
      m.set(pSelf, D2UnitStrc.pPath, pSelfPath)
      m.setU16((pSelfPath + 0x02) >>> 0, 50)
      m.setU16((pSelfPath + 0x06) >>> 0, 50)

      const pOwner = m.alloc(0x100) >>> 0
      m.set(pOwner, D2UnitStrc.dwUnitType, 1)
      m.set(pOwner, D2UnitStrc.dwUnitId, 77)
      SUNIT_InsertServerUnit113c(m, pGame, pOwner)

      const pCand = m.alloc(0x100) >>> 0
      const pCandMonData = m.alloc(0x80) >>> 0
      const pCandAiGen = m.alloc(0x60) >>> 0
      const pCandPath = m.alloc(0x80) >>> 0
      m.set(pCand, D2UnitStrc.dwUnitType, 1)
      m.set(pCand, D2UnitStrc.dwClassId, 0x1ec) // Putrid Defiler
      m.set(pCand, D2UnitStrc.dwUnitId, 2)
      m.set(pCand, D2UnitStrc.dwAnimMode, 1) // MONMODE_NEUTRAL (alive!)
      m.set(pCand, D2UnitStrc.pUnitData, pCandMonData)
      m.setU32((pCandMonData + 0x28) >>> 0, pCandAiGen)
      m.setU32((pCandAiGen + 0x14) >>> 0, 0xffffffff) // unbound (-1)
      m.set(pCand, D2UnitStrc.pPath, pCandPath)
      m.setU16((pCandPath + 0x02) >>> 0, 53)
      m.setU16((pCandPath + 0x06) >>> 0, 54) // distSq = 9 + 16 = 25

      const pMaxDistSq = m.alloc(4) >>> 0
      // Unbound seeker pSelf & unbound Putrid Defiler within distSq <= 100 -> returns pCand
      m.setU32(pMaxDistSq, 100)
      expect(AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c(m, pGame, pSelf, pCand, pMaxDistSq)).toBe(pCand)

      // Out of range (distSq = 25 > 20) -> returns 0
      m.setU32(pMaxDistSq, 20)
      expect(AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c(m, pGame, pSelf, pCand, pMaxDistSq)).toBe(0)

      // Owned seeker pSelf (dwFlagsEx bit 10 = 0x400, +0x94 = ownerType 1, +0x98 = ownerId 77) -> REJECTED!
      m.setU32((pSelf + 0xc8) >>> 0, 0x400)
      m.setU32((pSelf + 0x94) >>> 0, 1)
      m.setU32((pSelf + 0x98) >>> 0, 77)
      m.setU32(pMaxDistSq, 100)
      expect(AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c(m, pGame, pSelf, pCand, pMaxDistSq)).toBe(0)
    })

    it('Fix #11 (0x6FC2D040 & 0x6FC2DB00): Mount/Dismount invoke real AI_InitMonsterAiThinkFn113c (0x6FCBD230 traced)', () => {
      const { m, pMonStatsTxt } = createWave3World()
      const pGame = m.alloc(0x2000) >>> 0
      EVENT_InitTimerQueue113c(m, pGame)

      const pBeast = m.alloc(0x100) >>> 0
      const pMonData = m.alloc(0x80) >>> 0
      const pAiGen = m.alloc(0x60) >>> 0
      const pPath = m.alloc(0x80) >>> 0
      const pRoom = m.alloc(D2ActiveRoomStrc_SIZE) >>> 0
      const pStats = STATLIST_AllocList113c(m, 0, 1, 1, 0, 0)
      m.set(pBeast, D2UnitStrc.dwUnitType, 1)
      m.set(pBeast, D2UnitStrc.dwClassId, 0x1ec)
      m.set(pBeast, D2UnitStrc.pUnitData, pMonData)
      m.setU32(pMonData, (pMonStatsTxt + 0x1ec * 0x1a8) >>> 0)
      m.setU32((pMonData + 0x28) >>> 0, pAiGen)
      m.set(pBeast, D2UnitStrc.pPath, pPath)
      m.setU32((pPath + 0x1c) >>> 0, pRoom)
      m.setU32((pBeast + 0x5c) >>> 0, pStats)
      STATLIST_SetUnitStat113c(m, pBeast, 6, 25600, 0)
      STATLIST_SetUnitStat113c(m, pBeast, 7, 25600, 0)

      const pImp = m.alloc(0x100) >>> 0
      m.set(pImp, D2UnitStrc.dwUnitType, 1)
      m.set(pImp, D2UnitStrc.dwClassId, 0x1b3)

      beginVaTrace113c()
      SKILLS_MountImpOnSiegeBeast_6FC2D040_113c(m, pBeast, pImp, 1, pGame, 2)
      expect(m.u32(pAiGen)).toBe(0x10)
      const hitsMount = endVaTrace113c()
      expect(hitsMount.has('D2Game:0x6FC2D040')).toBe(true)
      expect(hitsMount.has('D2Game:0x6FCBD230')).toBe(true)

      beginVaTrace113c()
      SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c(m, pBeast, pImp, pGame, 0)
      expect(m.u32(pAiGen)).toBe(0)
      const hitsDismount = endVaTrace113c()
      expect(hitsDismount.has('D2Game:0x6FC2DB00')).toBe(true)
      expect(hitsDismount.has('D2Game:0x6FCBD230')).toBe(true)
    })
  })

  it('achieves 100% (169 / 169) live va-trace coverage with multi-branch behavioral assertions across all 4 shards', () => {
    const cumulativeHits = new Set<string>()

    // -------------------------------------------------------------------------
    // Shard 1: k2w1-laneM-0x6fc7 (42 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pItemsTxt } = createWave3World()
      beginVaTrace113c()

      // 0x6FC73470
      const pOutBuf = m.alloc(0x80) >>> 0
      expect(SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, 0, 0x80, pOutBuf)).toBe(0)
      m.set(pItemsTxt + D2ItemsTxt_SIZE, D2ItemsTxt.nDropSound, 1)
      m.set(pItemsTxt + D2ItemsTxt_SIZE, D2ItemsTxt.dwCode, 0x20737068)
      const pSerItem = m.alloc(0x100) >>> 0
      const pSerData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
      m.set(pSerItem, D2UnitStrc.dwUnitType, 4)
      m.set(pSerItem, D2UnitStrc.dwClassId, 1)
      m.set(pSerItem, D2UnitStrc.pUnitData, pSerData)
      m.set(pSerItem, D2UnitStrc.pPath, m.alloc(0x20) >>> 0)
      m.set(pSerData, D2ItemDataStrc.wItemFormat, 101)
      m.set(pSerData, D2ItemDataStrc.dwCommandFlags, 0x200000)
      expect(SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, pSerItem, 0x80, pOutBuf)).toBeGreaterThan(0)
      expect(m.u16(pOutBuf)).toBe(0x4d4a)

      const pGame = m.alloc(0x1df4) >>> 0
      m.setU8((pGame + 0x6d) >>> 0, 1) // Nightmare (req lvl 40 for Rite of Passage)
      m.setU32((pGame + 0xbc + 4 * 4) >>> 0, m.alloc(0x80) >>> 0)

      const plr = allocPlayerUnit(m, 42, 1, 109)
      const summitPlr = allocPlayerUnit(m, 43, 1, 0x78)

      const q6 = linkQuest(m, pGame, 0x24, 1, 1, 0x28)
      const q5 = linkQuest(m, pGame, 0x23, 1, 2, 0x27)
      const q4 = linkQuest(m, pGame, 0x22, 1, 1, 0x26)
      const q3 = linkQuest(m, pGame, 0x21, 1, 2, 0x25)
      const q2 = linkQuest(m, pGame, 0x20, 1, 0, 0x24)
      const q1 = linkQuest(m, pGame, 0x1f, 1, 1, 0x23)

      const pObj = allocObjectUnit(m, 77, 0x1da, 0)
      const pObjInit = m.alloc(0x20) >>> 0
      m.setU32(pObjInit, pGame)
      m.setU32((pObjInit + 0x04) >>> 0, pObj)

      // 0x6FC764D0, 0x6FC76520, 0x6FC76570
      m.setU32((q6.pQuestDataEx + 0x9c) >>> 0, 5)
      ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c(m, pObjInit)
      expect(m.u32((q6.pQuestDataEx + 0x9c) >>> 0)).toBe(2)
      m.setU32((q6.pQuestDataEx + 0x94) >>> 0, 4)
      ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c(m, pObjInit)
      expect(m.u32((q6.pQuestDataEx + 0x94) >>> 0)).toBe(2)
      m.setU8((q6.pQuestDataEx + 0x86) >>> 0, 1)
      expect(ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c(m, pGame)).toBe(0)

      // 0x6FC765B0, 0x6FC76600, 0x6FC76640, 0x6FC766D0, 0x6FC76740
      m.setU8((q5.pQuestDataEx + 0x4a) >>> 0, 1)
      ACT5Q5_InitSummitDoorObject_6FC765B0_113c(m, pObjInit)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(2)
      expect(ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c(m, pGame)).toBe(1)
      m.setU8((q5.pQuestDataEx + 0x48) >>> 0, 1)
      expect(ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c(m, pGame)).toBe(1)
      m.setU32((q5.pQuestDataEx + 0x0c) >>> 0, 1)
      m.setU8((q5.pQuestDataEx + 0x10) >>> 0, 1)
      expect(ACT5Q5_GetSummitPlayerCount_6FC766D0_113c(m, pGame)).toBe(1)
      ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c(m, summitPlr.pPlayer, pGame)
      expect(m.u8((q5.pQuestDataEx + 0x11) >>> 0)).toBe(1)

      // 0x6FC76810, 0x6FC76840, 0x6FC768C0
      expect(ACT5Q6_ActiveFilter_6FC76810_113c(m, q6.pQuest, 0x203, plr.pPlayer, plr.pQuestFlags, 0)).toBe(1)
      QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, 0x25, 1)
      expect(ACT5Q4_ActiveFilter_6FC76840_113c(m, q4.pQuest, 0x200, plr.pPlayer, plr.pQuestFlags, 0)).toBe(1)
      const pOutSt = m.alloc(4) >>> 0
      expect(ACT5Q4_StatusFilter_6FC768C0_113c(m, q4.pQuest, plr.pPlayer, 0, plr.pQuestFlags, pOutSt)).toBe(1)

      // 0x6FC76950, 0x6FC76A00, 0x6FC76A40
      expect(ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c(m, pGame)).toBe(1)
      const pObjPath = m.u32((pObj + 0x2c) >>> 0) >>> 0
      m.setU32((pObjPath + 0x0c) >>> 0, 100)
      m.setU32((pObjPath + 0x10) >>> 0, 200)
      expect(ACT5Q3_RecordAnyaPosition_6FC76A00_113c(m, pGame, pObj)).toBe(1)
      m.setU32((q3.pQuestDataEx + 0x84) >>> 0, 1)
      const pCoordsOut = m.alloc(8) >>> 0
      expect(ACT5Q3_GetPortalTargetCoords_6FC76A40_113c(m, pGame, pObj, pCoordsOut)).toBe(1)
      expect(m.u32(pCoordsOut)).toBe(100)

      // 0x6FC76B80, 0x6FC76C40, 0x6FC76CE0, 0x6FC76CF0, 0x6FC76D80, 0x6FC76E00, 0x6FC76EA0
      expect(ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c(m, q2.pQuest)).toBe(15)
      ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c(m, q2.pQuest)
      expect(m.u8((q2.pQuest + 0x0c) >>> 0)).toBe(1)
      expect(ACT5Q2_ActiveFilter_6FC76C40_113c(m, q2.pQuest, 0x203, plr.pPlayer, plr.pQuestFlags, 0)).toBe(1)
      ACT5_InitObjectNoop_6FC76CE0_113c(m, 0)
      expect(ACT5Q1_ActiveFilter_6FC76D80_113c(m, q1.pQuest, 0x1ff, plr.pPlayer, plr.pQuestFlags, 0)).toBe(1)
      expect(ACT5Q1_StatusFilter_6FC76E00_113c(m, q1.pQuest, plr.pPlayer, 0, plr.pQuestFlags, pOutSt)).toBe(1)
      expect(ACT5Q0_StatusFilter_6FC76EA0_113c(m, q1.pQuest, plr.pPlayer, 0, plr.pQuestFlags, pOutSt)).toBe(0)

      // 0x6FC77750 before marking 0x27 completed (bit 0 clear + level 40 -> sets bit 2)
      STATLIST_SetUnitStat113c(m, plr.pPlayer, 0x0c, 40, 0)
      ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c(m, pGame, plr.pPlayer, 0)
      expect(DRLGWARP_TestRoomTileBit113c(m, plr.pQuestFlags, 0x27, 2)).toBe(1)

      // 0x6FC76EB0, 0x6FC76FC0, 0x6FC77320, 0x6FC773D0, 0x6FC77440, 0x6FC774A0, 0x6FC774F0, 0x6FC775D0
      const pQArg = m.alloc(0x24) >>> 0
      m.setU32(pQArg, pGame)
      m.setU32((pQArg + 0x0c) >>> 0, plr.pPlayer)
      QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, 0x27, 0)
      ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c(m, q5.pQuest, pQArg)
      expect(DRLGWARP_TestRoomTileBit113c(m, plr.pQuestFlags, 0x27, 0x0a)).toBe(1)
      m.setU32((q5.pQuest + 0x1c) >>> 0, 42)
      m.setU16((q5.pQuest + 0x9c) >>> 0, 1)
      m.setU32(q5.pQuestDataEx, 42)
      m.setU16((q5.pQuestDataEx + 0x80) >>> 0, 1)
      expect(ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c(m, q5.pQuest, pQArg)).toBe(1)
      expect(ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c(m, pGame, plr.pPlayer, 0)).toBe(0)
      ACT5Q5_InitAncientsAltarObject_6FC773D0_113c(m, pObjInit)
      expect(m.u8((q5.pQuestDataEx + 0x58) >>> 0)).toBe(1)
      ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c(m, pGame, summitPlr.pPlayer, 0)
      expect(m.u32((q5.pQuestDataEx + 0x54) >>> 0)).toBe(1)
      ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c(m, pObjInit)
      expect(m.u32((q5.pQuestDataEx + 0x50) >>> 0)).toBe(77)
      m.setU32((q5.pQuestDataEx + 0x34) >>> 0, 5)
      ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c(m, pObjInit, q5.pQuestDataEx)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(5)
      m.setU32((q6.pQuest + 0x1c) >>> 0, 42)
      m.setU16((q6.pQuest + 0x9c) >>> 0, 1)
      expect(ACT5Q6_Callback11_RemovePlayerGuid_6FC775D0_113c(m, q6.pQuest, pQArg)).toBe(1)

      // 0x6FC777F0, 0x6FC77830, 0x6FC77A20, 0x6FC77C00, 0x6FC77CB0
      ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c(m, pGame, plr.pPlayer, 0)
      ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c(m, pGame, plr.pPlayer, 0)
      expect(DRLGWARP_TestRoomTileBit113c(m, plr.pQuestFlags, 0x26, 0x0d)).toBe(1)
      QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, 0x26, 0x0f)
      expect(ACT5Q4_CompletePersonalizationReward_6FC777F0_113c(m, plr.pPlayer, pGame)).toBe(1)
      m.setU32((q4.pQuest + 0x1c) >>> 0, 42)
      m.setU16((q4.pQuest + 0x9c) >>> 0, 1)
      m.setU32(q4.pQuestDataEx, 42)
      m.setU16((q4.pQuestDataEx + 0x80) >>> 0, 1)
      expect(ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c(m, q4.pQuest, pQArg)).toBe(1)
      m.setU32((plr.pRoom + 0x4c) >>> 0, 90)
      m.setU32((plr.pRoom + 0x50) >>> 0, 190)
      m.setU32((plr.pRoom + 0x54) >>> 0, 40)
      m.setU32((plr.pRoom + 0x58) >>> 0, 40)
      expect(ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c(m, pGame, plr.pPlayer)).toBe(1)

      // 0x6FC780A0, 0x6FC78110, 0x6FC78240, 0x6FC78260, 0x6FC782A0, 0x6FC782E0
      ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c(m, pGame, plr.pPlayer, 0)
      ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c(m, pGame, plr.pPlayer, 0)
      ACT5Q2_Callback15_ClearState04_6FC78240_113c(m, q2.pQuest, pQArg)
      expect(ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, pObj, q2.pQuest)).toBe(-1)
      m.setU32((q2.pQuest + 0x1c) >>> 0, 42)
      m.setU16((q2.pQuest + 0x9c) >>> 0, 1)
      m.setU32(q2.pQuestDataEx, 42)
      m.setU16((q2.pQuestDataEx + 0x80) >>> 0, 1)
      expect(ACT5Q2_Callback11_RemovePlayerGuid_6FC782A0_113c(m, q2.pQuest, pQArg)).toBe(1)
      m.setU32((q2.pQuestDataEx + 0xac) >>> 0, 15)
      ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c(m, pGame, plr.pPlayer, 0)
      expect(DRLGWARP_TestRoomTileBit113c(m, plr.pQuestFlags, 0x24, 5)).toBe(1)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 2: k2w2-b6 (42 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pItemsTxt, pLevelsTxt, pMonStats2Txt, pStateMasksExp } = createWave3World()
      beginVaTrace113c()

      const pGame = m.alloc(0x1df4) >>> 0
      const pUnit = m.alloc(0x100) >>> 0
      const pTarget = m.alloc(0x100) >>> 0
      const pPath = m.alloc(0x80) >>> 0
      m.setU32(pUnit, 1)
      m.setU32((pUnit + 0x04) >>> 0, 0)
      m.setU32((pUnit + 0x0c) >>> 0, 10)
      m.setU32((pUnit + 0x2c) >>> 0, pPath)
      m.setU32((pUnit + 0x44) >>> 0, 0)
      m.setU8((pUnit + 0x4e) >>> 0, 1)
      m.setU32(pTarget, 1)
      m.setU32((pTarget + 0x0c) >>> 0, 20)
      SUNIT_InsertServerUnit113c(m, pGame, pTarget)

      // 0x6FCD2E90, 0x6FCD2F80, 0x6FCD2FA0, 0x6FCD31B0, 0x6FCD3270
      expect(SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c(m, pGame, pUnit)).toBe(1)
      expect(m.u8((pUnit + 0x4e) >>> 0)).toBe(0)
      expect(SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c(m, pGame, pUnit)).toBe(1)
      expect(m.u32((pUnit + 0xc4) >>> 0) & 0x0e).toBe(0x0e)
      expect(SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c(m, pGame, pUnit)).toBe(1)
      expect(m.u32((pUnit + 0xc4) >>> 0) & 0x0e).toBe(0)
      expect(SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c(m, pGame, pUnit)).toBe(1)
      const pSkRec = m.alloc(0x200) >>> 0
      m.setU8((pMonStats2Txt + 0x109) >>> 0, 5)
      m.setU8((pSkRec + 0x11) >>> 0, 0x0e)
      SKILLS_InitInfernoSeqFrames_6FCD3270_113c(m, pUnit, pSkRec)
      expect(m.u32((pUnit + 0x48) >>> 0)).toBe(0x600)

      // 0x6FCD3570, 0x6FCD3EB0, 0x6FCD4660
      m.setU32((pPath + 0x58) >>> 0, pTarget)
      m.setU32((pPath + 0x5c) >>> 0, 1)
      m.setU32((pPath + 0x60) >>> 0, 20)
      expect(SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c(m, pGame, pUnit)).toBe(1)
      expect(SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c(m, pGame, pUnit)).toBe(1)
      expect(SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c(m, pGame, pUnit, -1, 1)).toBe(0)

      // 0x6FCD6C80..0x6FCD6D30
      AIBAAL_NoopThink_6FCD6C80_113c(m)
      const pSkill = m.alloc(0x40) >>> 0
      m.set(pSkill, D2SkillStrc.pSkillsTxt, pSkRec)
      m.set(pSkRec, D2SkillsTxt.wSkillId, 0x3b) // Blizzard
      expect(AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pSkill, pUnit)).toBe(1)
      const pSelfPtr = m.alloc(4) >>> 0
      const pOutCnt = m.alloc(4) >>> 0
      m.setU32(pSelfPtr, pUnit)
      m.setU32((pTarget + 0x10) >>> 0, 1)
      AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c(m, pTarget, pSelfPtr, pOutCnt)
      expect(m.u32(pOutCnt)).toBe(1)
      const pTPath = m.alloc(0x40) >>> 0
      m.setU32((pTarget + 0x2c) >>> 0, pTPath)
      m.setU8((pUnit + 0x18) >>> 0, 4)
      m.setU8((pTarget + 0x18) >>> 0, 4)
      expect(AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c(m, pUnit, pTarget)).toBe(1)

      // 0x6FCD87D0..0x6FCD9CD0 (Act 4 quests)
      expect(ACT4Q0_StatusFilter_6FCD87D0_113c(m)).toBe(0)
      expect(ACT4Prologue_StatusFilter_6FCD8B80_113c(m)).toBe(0)
      ACT4_InitObjectNoop_6FCD8930_113c(m)
      m.set(pItemsTxt, D2ItemsTxt.dwCode, 0x20686668) // 'hfh '
      const q17 = linkQuest(m, pGame, 0x17, 1, 1, 0x17)
      const pHammer = m.alloc(0x100) >>> 0
      m.setU32(pHammer, 4)
      m.setU32((pHammer + 0x04) >>> 0, 0)
      const plr = allocPlayerUnit(m, 77, 0, 103)
      const pInv = m.alloc(0x40) >>> 0
      m.setU32(pInv, INVENTORY_SIGNATURE_113C)
      m.setU32((pInv + 0x20) >>> 0, pHammer)
      m.setU32((plr.pPlayer + 0x60) >>> 0, pInv)
      const pQArg = m.alloc(0x40) >>> 0
      m.setU32(pQArg, pGame)
      m.setU32((pQArg + 0x08) >>> 0, pHammer)
      m.setU32((pQArg + 0x0c) >>> 0, plr.pPlayer)
      m.setU32((q17.pQuestDataEx + 0x10) >>> 0, 3)
      ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c(m, q17.pQuest, pQArg)
      expect(m.u32((q17.pQuestDataEx + 0x10) >>> 0)).toBe(2)
      ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c(m, q17.pQuest, pQArg)
      expect(m.u32((q17.pQuestDataEx + 0x10) >>> 0)).toBe(3)
      const pObjInit = m.alloc(0x10) >>> 0
      const pObj = allocObjectUnit(m, 9)
      m.setU32(pObjInit, pGame)
      m.setU32((pObjInit + 0x04) >>> 0, pObj)
      ACT4Q2_InitHellforgeObject_6FCD8870_113c(m, pObjInit)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(1)
      m.setU8((q17.pQuestDataEx + 0x14) >>> 0, 1)
      expect(ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c(m, pGame)).toBe(1)
      const pIzEx = m.alloc(0x40) >>> 0
      m.setU32((pIzEx + 0x14) >>> 0, m.alloc(0x100) >>> 0)
      ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c(m, pGame, plr.pPlayer, pIzEx)
      expect(m.u8((pIzEx + 0x18) >>> 0)).toBe(1)
      m.setU32((q17.pQuest + 0x1c) >>> 0, 77)
      m.setU16((q17.pQuest + 0x9c) >>> 0, 1)
      expect(ACT4Q2_Callback10_RemovePlayerGuid_6FCD8E60_113c(m, q17.pQuest, pQArg)).toBe(1)
      m.setU32((q17.pQuest + 0x1c) >>> 0, 77)
      m.setU16((q17.pQuest + 0x9c) >>> 0, 1)
      expect(ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c(m, q17.pQuest, pQArg)).toBe(1)
      m.setU32((pGame + 0x70) >>> 0, 1)
      QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, 0x1a, 9)
      ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c(m, q17.pQuest, pQArg)
      expect(DRLGWARP_TestRoomTileBit113c(m, plr.pQuestFlags, 0x1a, 9)).toBe(0)
      m.set(pLevelsTxt + 0x6d * D2LevelsTxt_SIZE, D2LevelsTxt.nWaypoint, 30)
      m.setU32(GDW_WAYPOINT_TABLE_COUNT_VA_113C, 0x70)
      m.setU16((GW_WAYPOINT_TABLE_BASE_VA_113C + 30 * 4) >>> 0, 1)
      m.setU16((GW_WAYPOINT_TABLE_BASE_VA_113C + 30 * 4 + 2) >>> 0, 0x0040)
      const pWpData = m.alloc(0x20) >>> 0
      m.setU32((plr.pPlayerData + 0x1c) >>> 0, pWpData)
      ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c(m, pGame, plr.pPlayer)
      expect(m.u16((pWpData + 2) >>> 0) & 0x0040).toBe(0x0040)
      ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c(m, pGame, plr.pPlayer)
      ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c(m, pGame, plr.pPlayer)
      QUESTRECORD_SetQuestState113c(m, plr.pQuestFlags, 0x19, 0x0d)
      ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c(m, pGame, plr.pPlayer)
      ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c(m, pGame, plr.pPlayer)

      // 0x6FCDC7D0..0x6FCDCB20
      const pHireBase = m.alloc(D2HirelingTxt_SIZE * 2) >>> 0
      m.setU32(G_HIRELING_TXT_VA_113C, pHireBase)
      m.setU32(G_HIRELING_COUNT_VA_113C, 1)
      m.setU32((pHireBase + HIRELING_TXT_SELLER_OFF_113C) >>> 0, 150)
      m.set(pHireBase, D2HirelingTxt.dwDifficulty, 1)
      m.set(pHireBase, D2HirelingTxt.wVersion, 100)
      m.setU16((pHireBase + 0x114) >>> 0, 10)
      m.setU16((pHireBase + 0x116) >>> 0, 14)
      expect(
        HIRELING_GetVendorNameIdRange_6FCDC7D0_113c(m, 150, m.alloc(4), m.alloc(4), m.alloc(4), pGame),
      ).toBe(5)
      m.setU32(pStateMasksExp, 1 << 2)
      const pSlEx = m.u32((plr.pPlayer + 0x5c) >>> 0) >>> 0
      const pStateFlags = m.alloc(0x20) >>> 0
      const pSubList = m.alloc(0x40) >>> 0
      m.set(pSlEx, D2StatListExStrc.pStateFlags, pStateFlags)
      m.setU32(pStateFlags, 1 << 2)
      m.set(pSlEx, D2StatListExStrc.pMyLastList, pSubList)
      m.set(pSubList, D2StatListStrc.pParent, pSlEx)
      m.set(pSubList, D2StatListStrc.dwStateNo, 2)
      expect(STATES_PurgeExpStateStatLists_6FCDC920_113c(m, plr.pPlayer)).toBe(1)
      m.setU32((pHammer + 0x0c) >>> 0, 42)
      expect(INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c(m, plr.pPlayer, 42)).toBe(1)
      const pNpc = m.alloc(0x100) >>> 0
      const pNpcCtrl = m.alloc(0x20) >>> 0
      const pNpcTbl = m.alloc(0x44 * 4) >>> 0
      m.setU32((pNpc + 4) >>> 0, 148)
      m.setU32((pGame + 0x1d24) >>> 0, pNpcCtrl)
      m.setU32((pNpcCtrl + 4) >>> 0, pNpcTbl)
      m.setU32(pNpcTbl, 148)
      expect(NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c(m, pGame, pNpc, 25)).toBe(12)

      // 0x6FCE1960..0x6FCE1F40 (Act 2 quests)
      expect(ACT2Q5_StatusFilter_6FCE1960_113c(m)).toBe(0)
      expect(ACT2Q4_StatusFilter_6FCE1970_113c(m)).toBe(0)
      ACT2Q4_Callback00_Noop_6FCE1980_113c(m)
      linkQuest(m, pGame, 0x0d, 1, 1, 0x0d)
      expect(ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c(m, pGame)).toBe(0)
      const pQ4Ex = m.alloc(0x60) >>> 0
      m.setU32((pQ4Ex + 0x40) >>> 0, m.alloc(0x100) >>> 0)
      ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c(m, pGame, plr.pPlayer, pQ4Ex)
      expect(ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c(m, pGame)).toBe(1)
      expect(ACT2Q2_IsQuestInState01_6FCE1B20_113c(m, pGame)).toBe(1)
      expect(ACT2Q2_IsQuestPastState01_6FCE1B60_113c(m, pGame)).toBe(0)
      const q0b = linkQuest(m, pGame, 0x0b, 1, 1, 0x0b)
      m.setU8((q0b.pQuestDataEx + 0x18) >>> 0, 1)
      m.setU32((q0b.pQuestDataEx + 0x30) >>> 0, 500)
      m.setU32((q0b.pQuestDataEx + 0x34) >>> 0, 600)
      expect(ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c(m, pGame, m.alloc(8))).toBe(1)
      expect(ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c(m, pGame)).toBe(0)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 3: k2w3-b1 (42 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pSkillsTxt, pMissilesTxt, pItemsTxt, pMonStatsTxt, pSetsTxt, pSetItemsTxt } =
        createWave3World()
      beginVaTrace113c()

      const pList = m.alloc(0x20) >>> 0
      m.setU32(pList, 4)
      m.setU32((pList + 4) >>> 0, ~(pList + 4) >>> 0)
      m.setU32((pList + 8) >>> 0, ~(pList + 4) >>> 0)
      STORM_TSListDestroy_6FC21FE0_113c(m, pList)

      const pGame = m.alloc(0x2000) >>> 0
      EVENT_InitTimerQueue113c(m, pGame)
      m.setU32((pGame + 0x70) >>> 0, 1)
      m.setU32((pGame + 0xa8) >>> 0, 100)
      m.setU32((pGame + 0xd0) >>> 0, 0x12345678)
      m.setU32((pGame + 0xd4) >>> 0, 0x9abcdef0)
      expect(OBJRGN_AllocObjectControl_6FC2B9A0_113c(m, pGame)).not.toBe(0)

      const pUnit = m.alloc(0x100) >>> 0
      const pMonData = m.alloc(0x80) >>> 0
      const pAiGen = m.alloc(0x60) >>> 0
      const pAiCtrl = m.alloc(0x40) >>> 0
      const pSkillList = m.alloc(0x20) >>> 0
      const pSkill = m.alloc(0x40) >>> 0
      const pPath = m.alloc(0x80) >>> 0
      const pRoom = m.alloc(D2ActiveRoomStrc_SIZE) >>> 0
      const pRoomEx = m.alloc(D2RoomExStrc_SIZE) >>> 0
      const pLevel = m.alloc(D2DrlgLevelStrc_SIZE) >>> 0
      const ppNear = m.alloc(8) >>> 0
      m.setU32(ppNear, pRoom)
      m.setU32(pRoom, ppNear)
      m.setU32((pRoom + 0x24) >>> 0, 1)
      m.setU32((pRoom + 0x3c) >>> 0, m.alloc(16) >>> 0)
      const pCollGrid = m.alloc(0x28) >>> 0
      m.setU32((pCollGrid + 0x08) >>> 0, 100)
      m.setU32((pCollGrid + 0x0c) >>> 0, 100)
      m.setU32((pCollGrid + 0x20) >>> 0, m.alloc(100 * 100 * 2) >>> 0)
      m.setU32((pRoom + 0x20) >>> 0, pCollGrid)
      m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
      m.setU32((pRoom + 0x54) >>> 0, 100)
      m.setU32((pRoom + 0x58) >>> 0, 100)
      m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
      const pLogicalInfo = m.alloc(0x40) >>> 0
      m.setU8(pLogicalInfo, 1) // single-coord-list fast flag
      m.set(pRoomEx, D2RoomExStrc.pLogicalRoomInfo, pLogicalInfo)
      m.set(pLevel, D2DrlgLevelStrc.nLevelId, 2)

      m.set(pUnit, D2UnitStrc.dwUnitType, 1)
      m.set(pUnit, D2UnitStrc.dwClassId, 10)
      m.set(pUnit, D2UnitStrc.dwUnitId, 7)
      m.set(pUnit, D2UnitStrc.pUnitData, pMonData)
      m.setU32(pMonData, (pMonStatsTxt + 10 * 0x1a8) >>> 0)
      m.setU32((pMonData + 0x28) >>> 0, pAiGen)
      m.setU32((pMonData + 0x2c) >>> 0, pAiCtrl)
      m.set(pUnit, D2UnitStrc.pSkills, pSkillList)
      m.setU32((pSkillList + 0x10) >>> 0, pSkill)
      m.set(pUnit, D2UnitStrc.pPath, pPath)
      m.setU32((pPath + 0x1c) >>> 0, pRoom)
      m.setU16((pPath + 0x02) >>> 0, 50)
      m.setU16((pPath + 0x06) >>> 0, 60)
      const pUnitStats = STATLIST_AllocList113c(m, 0, 1, 7, 0, 0)
      m.setU32((pUnit + 0x5c) >>> 0, pUnitStats)
      STATLIST_SetUnitStat113c(m, pUnit, 6, 12800, 0)
      STATLIST_SetUnitStat113c(m, pUnit, 7, 25600, 0)
      SUNIT_InsertServerUnit113c(m, pGame, pUnit)

      const pMonReg = m.alloc(0x100) >>> 0
      m.setU8((pMonReg + 0x10) >>> 0, 1)
      m.setU16((pMonReg + 0x14) >>> 0, 0x113)
      m.setU32((pGame + 2 * 4 + 0xf0) >>> 0, pMonReg)
      const pShrineArgs = m.alloc(0x10) >>> 0
      m.setU32(pShrineArgs, pGame)
      m.setU32((pShrineArgs + 4) >>> 0, pUnit)
      expect(OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c(m, pShrineArgs)).toBe(0x112)

      m.setU16((pSkillsTxt + 10 * 0x23c + 0x82) >>> 0, 15)
      m.setU16((pSkillsTxt + 10 * 0x23c + 0x48) >>> 0, 5)
      m.setU32((pMissilesTxt + 5 * 0x1a4 + 0x3c) >>> 0, 20)
      expect(SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c(m, pGame, pUnit, 10, 1)).toBe(1)
      expect(SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c(m, pGame, pUnit, 10, 1)).toBe(0)
      SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c(m, 10, pUnit, 1, pUnit)
      expect(SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c(m, pGame, pUnit, 10, 1)).toBe(1)
      expect(SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c(m, pGame, pUnit, 10, 1)).toBe(1)
      expect(SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c(m, pGame, pUnit, 10, 1)).toBe(0)
      const pImp = m.alloc(0x100) >>> 0
      m.set(pImp, D2UnitStrc.dwUnitType, 1)
      m.set(pImp, D2UnitStrc.dwClassId, 0x1b3)
      SKILLS_MountImpOnSiegeBeast_6FC2D040_113c(m, pUnit, pImp, 1, pGame, 2)
      SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c(m, pUnit, pImp, pGame, 0)
      expect(SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c(m, pGame, pUnit, 10, 1)).toBe(1)

      // ITEMS (0x6FC2E410..0x6FC348A0)
      const pItem = m.alloc(0x100) >>> 0
      const pItemData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
      const pItemStats = STATLIST_AllocList113c(m, 0, 4, 0, 0, 0)
      m.set(pItem, D2UnitStrc.dwUnitType, 4)
      m.set(pItem, D2UnitStrc.dwClassId, 1)
      m.set(pItem, D2UnitStrc.pUnitData, pItemData)
      m.set(pItem, D2UnitStrc.pPath, m.alloc(0x40) >>> 0)
      m.setU32((pItem + 0x5c) >>> 0, pItemStats)
      m.set(pItemData, D2ItemDataStrc.wItemFormat, 100)
      m.set(pItemData, D2ItemDataStrc.dwItemLevel, 30)
      m.set(pItemData, D2ItemDataStrc.dwQuality, 7)
      m.set(pItemData, D2ItemDataStrc.dwItemCell, 2)
      m.set(pItemData, D2ItemDataStrc.dwSeedLo, 0xabcdef01)
      m.set(pItemData, D2ItemDataStrc.dwSeedHi, 0x12345678)
      const dwSwd = 0x20647773
      m.setU32((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x80) >>> 0, dwSwd)
      m.setU8((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x112) >>> 0, 30)
      STATLIST_SetUnitStat113c(m, pItem, 0x48, 20, 0)
      STATLIST_SetUnitStat113c(m, pItem, 0x49, 20, 0)
      const pDrop = m.alloc(0x90) >>> 0
      ITEMS_PopulateItemDropStruct_6FC2E410_113c(m, pDrop, pItem, 0)
      ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(m, 50, pItem, pRoom, pGame, 0, 40)
      expect(ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c(m, pGame, pItem)).toBe(1)
      const pPlrInv = m.alloc(0x40) >>> 0
      m.set(pPlrInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)
      INVENTORY_SetCursorItem113c(m, pPlrInv, pItem)
      expect(ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pItem)).toBe(0)

      const pSeed = m.alloc(8) >>> 0
      m.setU32(pSeed, 0x11223344)
      m.setU32((pSeed + 4) >>> 0, 0x55667788)
      for (const idx of [0, 4, 8]) {
        const pRec = (pItemsTxt + idx * D2ItemsTxt_SIZE) >>> 0
        m.setU8((pRec + 0x133) >>> 0, 1)
        m.setU8((pRec + 0xfc) >>> 0, 1)
        m.setU8((pRec + 0xfd) >>> 0, 5)
        m.setU16((pRec + 0x11e) >>> 0, 1)
      }
      expect(ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c(m, pGame, pSeed, 10, 1, 1, 1)).toBe(8)
      expect(ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c(m, 1, pGame, pSeed, 10, 1)).toBe(0)
      expect(ITEMS_RollSpawnableArmorId_6FC2FA30_113c(m, 1, pGame, pSeed, 10, 1)).toBe(4)

      // Fresh item for post-free item mod calls (pItem was freed by 0x6FC2EE70 above)
      const pItem2 = m.alloc(0x100) >>> 0
      const pItemData2 = m.alloc(D2ItemDataStrc_SIZE) >>> 0
      m.set(pItem2, D2UnitStrc.dwUnitType, 4)
      m.set(pItem2, D2UnitStrc.dwClassId, 1)
      m.set(pItem2, D2UnitStrc.pUnitData, pItemData2)
      STATLIST_CreateEx113c(m, pItem2)
      m.set(pItemData2, D2ItemDataStrc.wItemFormat, 100)
      m.set(pItemData2, D2ItemDataStrc.dwItemLevel, 30)
      m.set(pItemData2, D2ItemDataStrc.dwSeedLo, 0xabcdef01)
      m.set(pItemData2, D2ItemDataStrc.dwSeedHi, 0x12345678)
      STATLIST_SetUnitStat113c(m, pItem2, 0x48, 20, 0)
      STATLIST_SetUnitStat113c(m, pItem2, 0x49, 20, 0)

      ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c(m, pItem2, 30, 6, 50)
      ITEMS_AddStaffModSkillsByTier_6FC335E0_113c(m, 30, pItem2, 6)
      m.setU32(0x6fdf111c, 4)
      ITEMS_ApplyLowQualityItemMods_6FC337F0_113c(m, pItem2)
      m.setU16(pSetItemsTxt, 3)
      m.setU32((pSetItemsTxt + 0x28) >>> 0, dwSwd)
      m.setU32((pSetItemsTxt + 0x34) >>> 0, 5)
      m.setU32((pSetsTxt + 0x0c) >>> 0, 1)
      m.setU32((pSetsTxt + 0x110) >>> 0, pSetItemsTxt)
      expect(ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c(m, pItem2)).toBe(1)
      m.setU32((pDrop + 0x40) >>> 0, 1)
      expect(ITEMS_RollAndApplyUniqueItem_6FC33C20_113c(m, pItem2, pDrop)).toBe(1)
      ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c(m, pItem2, pDrop)
      ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c(m, pItem2, pDrop)
      expect(ITEMS_RollRareSuffixId_6FC34370_113c(m, 0, pItem2)).toBe(0)
      expect(ITEMS_RollAutoMagicAffixId_6FC348A0_113c(m, pItem2, 1, 1, 0, 1, 0)).toBe(0)

      // AI (0x6FC359B0..0x6FC38CE0)
      const pAiUnit = m.alloc(0x100) >>> 0
      const pAiMonData = m.alloc(0x80) >>> 0
      const pAiGen2 = m.alloc(0x60) >>> 0
      const pAiCtrl2 = m.alloc(0x40) >>> 0
      const pAiPath = m.alloc(0x80) >>> 0
      const pAiRoom = m.alloc(D2ActiveRoomStrc_SIZE) >>> 0
      m.set(pAiUnit, D2UnitStrc.dwUnitType, 1)
      m.set(pAiUnit, D2UnitStrc.dwClassId, 10)
      m.set(pAiUnit, D2UnitStrc.dwUnitId, 8)
      m.set(pAiUnit, D2UnitStrc.pUnitData, pAiMonData)
      m.setU32((pAiMonData + 0x28) >>> 0, pAiGen2)
      m.setU32((pAiMonData + 0x2c) >>> 0, pAiCtrl2)
      m.set(pAiUnit, D2UnitStrc.pPath, pAiPath)
      m.setU32((pAiPath + 0x1c) >>> 0, pAiRoom)
      m.setU16((pAiPath + 0x02) >>> 0, 50)
      m.setU16((pAiPath + 0x06) >>> 0, 60)
      const pAiStats = STATLIST_AllocList113c(m, 0, 1, 8, 0, 0)
      m.setU32((pAiUnit + 0x5c) >>> 0, pAiStats)
      STATLIST_SetUnitStat113c(m, pAiUnit, 6, 12800, 0)
      STATLIST_SetUnitStat113c(m, pAiUnit, 7, 25600, 0)
      SUNIT_InsertServerUnit113c(m, pGame, pAiUnit)
      m.setU32((pAiGen2 + 0x28) >>> 0, pGame)
      m.setU32((pAiGen2 + 0x2c) >>> 0, 8)
      m.setU32((pAiGen2 + 0x30) >>> 0, 1)
      const pAiThinkArg = m.alloc(0x30) >>> 0
      const pAiParam = m.alloc(0x50) >>> 0
      const pTarget = m.alloc(0x100) >>> 0
      const pTargetPath = m.alloc(0x80) >>> 0
      m.set(pTarget, D2UnitStrc.dwUnitType, 0)
      m.set(pTarget, D2UnitStrc.pPath, pTargetPath)
      m.setU16((pTargetPath + 0x02) >>> 0, 52)
      m.setU16((pTargetPath + 0x06) >>> 0, 62)
      const pMonRec10 = (pMonStatsTxt + 10 * 0x1a8) >>> 0
      m.setU16((pMonRec10 + 0x56) >>> 0, 50)
      m.setU16((pMonRec10 + 0x5c) >>> 0, 50)
      m.setU16((pMonRec10 + 0x62) >>> 0, 50)
      m.setU16((pMonRec10 + 0x68) >>> 0, 10)
      m.setU16((pMonRec10 + 0x6e) >>> 0, 10)
      m.setU16((pMonRec10 + 0x74) >>> 0, 10)
      m.setU16((pMonRec10 + 0x170) >>> 0, 0xffff)
      m.setU32(pAiThinkArg, pAiParam)
      m.setU32((pAiThinkArg + 0x08) >>> 0, pTarget)
      m.setU32((pAiThinkArg + 0x14) >>> 0, 5)
      m.setU32((pAiThinkArg + 0x18) >>> 0, 1)
      m.setU32((pAiThinkArg + 0x1c) >>> 0, pMonRec10)

      AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c(m, pAiUnit, pAiThinkArg)
      const pMaxDistSq = m.alloc(4) >>> 0
      m.setU32(pMaxDistSq, 100)
      AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c(m, pGame, pAiUnit, pAiUnit, pMaxDistSq)
      AI_ThinkBaalThroneSpawner_6FC35E00_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkBloodLordFrenzy_6FC36270_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkPainWormSpawner_6FC364A0_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkPatrolAndAttack_6FC36E30_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkBloodHawk_6FC376B0_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkGiantSpider_6FC377E0_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkThornedHulk_6FC379A0_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkMinionSpawner_6FC37BC0_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkDualAttack95Pct_6FC381A0_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkDelayedMeleeAttack_6FC38360_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkSandMaggot_6FC38480_113c(m, pGame, pAiUnit, pAiThinkArg)
      AI_ThinkClawViper_6FC38CE0_113c(m, pGame, pAiUnit, pAiThinkArg)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 4: k2w5-b9 (43 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pItemStatCostTxt, pLevelsTxt, pMonStatsTxt } = createWave3World()
      beginVaTrace113c()

      const pGame = m.alloc(0x1800) >>> 0
      EVENT_InitTimerQueue113c(m, pGame)
      m.setU32((pGame + 0x70) >>> 0, 1)

      const plr = allocPlayerUnit(m, 1, 0, 75)
      const plrB = allocPlayerUnit(m, 2, 0, 75)
      m.setU32((plr.pPlayer + 0x80) >>> 0, pGame)
      m.setU32((plrB.pPlayer + 0x80) >>> 0, pGame)

      const pFlags = plr.pQuestFlags
      const pOut = m.alloc(4) >>> 0
      const q14 = linkQuest(m, pGame, 0x14, 1, 2, 0x14)
      const q13 = linkQuest(m, pGame, 0x13, 1, 1, 0x13)
      const q0e = linkQuest(m, pGame, 0x0e, 1, 1, 0x0e)
      const q1c = linkQuest(m, pGame, 0x1c, 1, 1, 0x1c)
      const pQCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
      m.setU32((pQCtrl + 0x08) >>> 0, 1)
      m.setU32((pQCtrl + 0x0c) >>> 0, pFlags)

      expect(ACT3Q4_StatusFilter_6FD06E00_113c(m, q14.pQuest, plr.pPlayer, 0, pFlags, pOut)).toBe(1)

      const pOrbObj = allocObjectUnit(m, 0x42)
      const pObjInit = m.alloc(0x30) >>> 0
      m.setU32(pObjInit, pGame)
      m.setU32((pObjInit + 0x04) >>> 0, pOrbObj)
      m.setU32((pObjInit + 0x14) >>> 0, 100)
      m.setU32((pObjInit + 0x18) >>> 0, 200)
      ACT3Q0_InitDarkWandererPreset_6FD08290_113c(m, pObjInit)
      expect(m.u8(q1c.pQuestDataEx)).toBe(1)

      m.setU8((q14.pQuestDataEx + 0x20) >>> 0, 1)
      m.setU32((q14.pQuestDataEx + 0x2c) >>> 0, 0x15)
      const pBossMon = m.alloc(0x100) >>> 0
      m.setU32((pBossMon + 0x04) >>> 0, 0x129)
      m.setU32((pBossMon + 0x0c) >>> 0, 0x15)
      m.setU32((pGame + 0x1320 + 0x15 * 4) >>> 0, pBossMon)
      ACT3Q5_InitCouncilBossPreset_6FD08310_113c(m, pObjInit)

      m.setU8((q13.pQuestDataEx + 0x0c) >>> 0, 1)
      m.setU8((q13.pQuestDataEx + 0x28) >>> 0, 1)
      ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c(m, pObjInit)
      expect(m.u32((pOrbObj + 0x10) >>> 0)).toBe(2)

      m.setU8(q0e.pQuestDataEx, 1)
      m.setU32((q0e.pQuestDataEx + 0x0c) >>> 0, 0x15)
      ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c(m, pObjInit)
      QUESTRECORD_SetQuestState113c(m, pFlags, 0x10, 0x0d)
      ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c(m, pObjInit)
      expect(m.u8((q0e.pQuestDataEx + 0x02) >>> 0)).toBe(1)

      m.setU32((q14.pQuestDataEx + 0x10) >>> 0, 1)
      ACT3Q5_InitStairsObject_6FD098E0_113c(m, pObjInit)
      ACT3Q5_OnStairsProximityTimer_6FD09960_113c(m, pOrbObj, q14.pQuest)

      m.setU8(q13.pQuestDataEx, 1)
      m.setU32((q13.pQuestDataEx + 0x04) >>> 0, 0x7f)
      ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c(m, q13.pQuest)
      expect(m.u32((q13.pQuestDataEx + 0x08) >>> 0)).toBe(2)

      const pCenter = m.alloc(0x100) >>> 0
      m.setU32(pCenter, 1)
      QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c(m, pGame, pCenter, 5, 2, 10, 1)
      expect(QUESTS_SpawnProjectile12B_6FD0AB10_113c(m, 0, pGame)).toBe(0)
      expect(() => ACT3Q6_FireHellgateOpenerProjectile_6FD0AB60_113c(m, pCenter, pGame)).toThrow(
        D2CommonAssertError,
      )

      const pSl = STATLIST_CreateEx113c(m, plr.pPlayer, 0, pGame)
      m.setU32((plr.pPlayer + 0x5c) >>> 0, pSl)
      STATLIST_SetUnitStat113c(m, plr.pPlayer, 4, 10, 0)
      STATLIST_SetUnitStat113c(m, plr.pPlayer, 3, 20, 0)
      STATLIST_SetUnitStat113c(m, plr.pPlayer, 1, 15, 0)
      PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c(m, 2, plr.pPlayer)
      expect(STATLIST_GetUnitStat113c(m, plr.pPlayer, 3, 0)).toBe(22)
      PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c(m, 3, plr.pPlayer)
      expect(STATLIST_GetUnitStat113c(m, plr.pPlayer, 1, 0)).toBe(18)

      expect(PARTY_SendRosterUpdateCallback_6FD0B070_113c(m, pGame, plrB.pPlayer, plr.pPlayer)).toBe(1)

      // Save sections (0x6FD0B610..0x6FD0C1E0)
      for (let d = 0; d < 3; d++) {
        const pIntro = m.alloc(0x10) >>> 0
        const pQI = m.alloc(4) >>> 0
        const pNI = m.alloc(4) >>> 0
        m.setU32(pQI, m.alloc(8) >>> 0)
        m.setU32(pNI, m.alloc(8) >>> 0)
        m.setU32(pIntro, pQI)
        m.setU32((pIntro + 0x04) >>> 0, pNI)
        m.setU32((plr.pPlayerData + 0x60 + d * 4) >>> 0, pIntro)
        m.setU32((plr.pPlayerData + 0x1c + d * 4) >>> 0, m.alloc(0x20) >>> 0)
        m.setU32((plr.pPlayerData + 0x10 + d * 4) >>> 0, QUESTRECORD_AllocRecord113c(m, 0) >>> 0)
      }
      const pSaveBuf = m.alloc(0x800) >>> 0
      const ppCur = m.alloc(4) >>> 0
      m.setU32(ppCur, pSaveBuf)
      expect(PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c(m, plr.pPlayer, ppCur, pSaveBuf + 0x800)).toBe(0)
      expect(PLAYERSAVE_WriteWaypointSection_6FD0B700_113c(m, pSaveBuf + 0x800, plr.pPlayer, ppCur)).toBe(0)
      expect(PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c(m, pSaveBuf + 0x800, plr.pPlayer, ppCur)).toBe(0)
      m.setU8((plr.pClient + 0x08) >>> 0, 7)
      expect(PLAYERSAVE_WriteSkillSection_6FD0BC40_113c(m, plr.pPlayer, ppCur, pSaveBuf + 0x800)).toBe(2)
      expect(PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c(m, plr.pPlayer, -1)).toBe(0)
      m.setU8((pItemStatCostTxt + 3 * 0x144 + 0x0a) >>> 0, 10)
      expect(PLAYERSAVE_WriteStatsSection_6FD0BE70_113c(m, plr.pPlayer, ppCur, pSaveBuf + 0x800)).toBe(0)
      expect(PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c(m, pGame, plr.pPlayer, ppCur, pSaveBuf + 0x800)).toBe(0)
      expect(
        PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c(m, pSaveBuf + 0x800, 0, 0, ppCur, pGame, plr.pPlayer, 0),
      ).toBe(0)
      PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c(m, pGame, plr.pPlayer, m.alloc(0x100) >>> 0)
      expect(PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c(m, pGame, plr.pPlayer, ppCur, pSaveBuf + 0x800)).toBe(0)

      // Minion spawns (0x6FD0DE90..0x6FD0F8B0)
      const pLeader = m.alloc(0x100) >>> 0
      m.setU32(pLeader, 1)
      expect(MONSTER_SpawnMinionPackInRing_6FD0DE90_113c(m, 0, pGame, pLeader, 1, 10, 3, 0)).toBe(0)
      m.setU8((pLevelsTxt + 75 * D2LevelsTxt_SIZE + 0x33) >>> 0, 1)
      m.setU16((pLevelsTxt + 75 * D2LevelsTxt_SIZE + 0x36) >>> 0, 0)
      m.setU8((pMonStatsTxt + 0x0c) >>> 0, 1)
      expect(MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c(m, pGame, plr.pRoom, 10, 10)).toBe(0)
      expect(MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c(m, 0, pGame, pLeader, 50, 60, 10, 1, 3, 0)).toBe(0)
      expect(MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c(m, -1, 1, 0, pGame, 50, 60, 3, 1, 0)).toBe(0)

      // Subparty buckets (0x6FD0FD40, 0x6FD0FDB0, 0x6FD0FED0)
      m.setU32((plr.pPlayer + 0xd0) >>> 0, 0x0b)
      SUBPARTY_CreatePlayerBucketHead_6FD0FED0_113c(m, pGame, plr.pPlayer, 0xaa)
      expect(m.u32((plr.pPlayer + 0xd0) >>> 0)).toBe(0)
      SUBPARTY_ClearUnitBucketList_6FD0FD40_113c(m, pGame, plr.pPlayer)
      expect(m.u32((plr.pPlayer + 0xd0) >>> 0)).toBe(0x0b)
      const pMonC = m.alloc(0x100) >>> 0
      m.setU32(pMonC, 1)
      m.setU32((pMonC + 0xd0) >>> 0, 0x0b)
      SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(m, pGame, 8, pMonC, 0xcc)
      expect(m.u32((pMonC + 0xd0) >>> 0)).toBe(8)

      // Party relations & packets (0x6FD10040..0x6FD10B10)
      const pRelAB = m.alloc(0x14) >>> 0
      m.setU32(pRelAB, 2)
      m.setU32((pRelAB + 0x04) >>> 0, 1)
      m.setU32((pRelAB + 0x0c) >>> 0, 2)
      m.setU32((plr.pPlayerData + 0x38) >>> 0, pRelAB)
      const pRelBA = m.alloc(0x14) >>> 0
      m.setU32(pRelBA, 1)
      m.setU32((pRelBA + 0x0c) >>> 0, 4)
      m.setU32((plrB.pPlayerData + 0x38) >>> 0, pRelBA)
      m.setU32((pGame + 0x1120 + 2 * 4) >>> 0, plrB.pPlayer)

      PARTY_RefreshInviteRelationNodes_6FD103E0_113c(m, pGame, plr.pPlayer)
      PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c(m, plrB.pPlayer, plr.pPlayer, pGame)
      PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c(m, 0x08, plr.pPlayer, plrB.pPlayer, pGame, 1)
      expect(m.u32((pRelAB + 0x04) >>> 0)).toBe(0x09)
      expect(NET_SendPacket5A_PartyRelationEvent_6FD10720_113c(m, 0x1234, plr.pClient, 3)).toBe(1)
      PARTY_SyncMutualRelationState_6FD109E0_113c(m, plr.pPlayer, plrB.pPlayer)
      PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c(m, pGame, plr.pPlayer, plrB.pPlayer)
      PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c(m, pGame, plr.pPlayer, plrB.pPlayer)

      // Triggered skills (0x6FD112C0..0x6FD11730)
      expect(SKILLS_RollRandomUnblockedTargetPos_6FD112C0_113c(m, plr.pPlayer)).toBe(0)
      const pOutType = m.alloc(4) >>> 0
      const pOutGuid = m.alloc(4) >>> 0
      expect(SKILLS_ResolveTriggeredAttackerTarget_6FD11420_113c(m, pGame, plr.pPlayer, pOutType, pOutGuid)).toBe(1)
      expect(SKILLS_ResolveTriggeredCorpseTarget_6FD11490_113c(m, pGame, plr.pPlayer, pOutType, 0, 0, pOutGuid)).toBe(0)
      expect(SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c(m, 0, 20, 1, 1, 10, 0)).toBe(0)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    const missingVas = WAVE3_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
