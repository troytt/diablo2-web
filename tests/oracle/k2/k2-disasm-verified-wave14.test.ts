/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 14: +118 VAs).
 *
 * Audits and verifies 118 `D2Game.dll` (`0x6FC20000`) closure functions across 4 shards:
 * - `k2w7-b3` (`src/d2kern-113c/game/k2-w7b3-113c.ts`, 33 eligible; `0x6FCDA270`, `0x6FCE6390` kept `ported`)
 * - `k2w12-b1` (`src/d2kern-113c/game/k2-w12b1-113c.ts`, 29 eligible; 0 `indirectUnknown`)
 * - `k2w3-b6` (`src/d2kern-113c/game/k2-w3b6-113c.ts`, 28 eligible; `0x6FC801B0`, `0x6FC806E0` kept `ported`)
 * - `k2w5-b4` (`src/d2kern-113c/game/k2-w5b4-113c.ts`, 28 eligible; `0x6FCE1FF0`, `0x6FCE21E0`, `0x6FCE24A0` kept `ported`)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`,
 *    plus manifest promotion & `indirectUnknown` guardrails for all 7 skipped VAs.
 * 2. Dedicated behavioral differential regression tests for real 1.13c binary discrepancies fixed
 *    across `k2w3-b6` (8 VAs), `k2w7-b3` (15 VAs), `k2w12-b1` (19 VAs), and `0x6FCC41B0` return value.
 * 3. Multi-branch `SparseMemory113c` concrete state assertions + 100% (`118 / 118`) live
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
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  D2COMMON_GRID0_INFO_VA_113C,
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  G_INVENTORY_TXT_TABLE_VA_113C,
  INVENTORY_AllocInventory113c,
  INVENTORY_PlaceItemInBodyLoc113c,
  INVENTORY_SIGNATURE_113C,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetOrClearCommandFlags113c,
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
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import { QUESTS_GuidListAdd113c, QUESTS_GuidListContains113c } from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts'
import {
  ACT1Q4_SpawnSmithBossInBarracks_6FD08780_113c,
  ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c,
  AI_Think_BurrowingScarabOrFrog_6FCA9C30_113c,
  AI_Think_Raven_6FCCA1D0_113c,
  AI_Think_SandMaggot_6FCA9870_113c,
  AI_Think_ShadowWarriorAndMaster_6FCC9E80_113c,
  C2S_Packet23_MercReviveHandler_6FCEFB90_113c,
  HIRELING_AssignMercenaryToPlayer_6FC68FC0_113c,
  ITEMS_ClearInvalidRunewordOnItem_6FCF3280_113c,
  ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c,
  ITEMS_PlaceLoadedPlayerItemWithSync_6FC745D0_113c,
  ITEMS_PlaceLoadedPlayerOrMercItem_6FC74420_113c,
  ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c,
  ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c,
  MONSTER_SpawnUniqueBossWithChampionMinionPack_6FC679B0_113c,
  MONUMOD_SpawnPresetUniqueOrSuperUnique_6FC44E70_113c,
  MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c,
  MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70_113c,
  OBJ_OperateFn_DungeonStairOrTileWarp_6FC8BCB0_113c,
  OBJ_OperateFn_FindPairedObjectAndTeleportPad_6FC8BE40_113c,
  OBJ_OperateFn_SparklyChestOrTrapSpawner_6FC8EDB0_113c,
  OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c,
  PLAYER_ChangeLevelOrActTransition_6FCBE170_113c,
  PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c,
  PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c,
  PLRTRADE_RestorePlayerInventoryAndGoldFromSnapshot_6FC915E0_113c,
  PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c,
  SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast_6FC2DBD0_113c,
  SKILLS_SrvDo_MonsterConvert_6FC71340_113c,
} from '../../../src/d2kern-113c/game/k2-w12b1-113c.ts'
import {
  ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c,
  ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c,
  ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c,
  ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c,
  ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c,
  ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c,
  ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c,
  ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c,
  ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c,
  ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c,
  ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c,
  ACT1Q4_InitInifussTreeObject_6FC828D0_113c,
  ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c,
  ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c,
  ACT1Q4_SpawnTristramPortalObject_6FC81340_113c,
  ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
  ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c,
  ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c,
  ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c,
  ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c,
  ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c,
  ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c,
  ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c,
  ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c,
  ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c,
  ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c,
  ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c,
  QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c,
} from '../../../src/d2kern-113c/game/k2-w3b6-113c.ts'
import { AI_SetStateDirAndStartWalkMode_6FCC41B0_113c } from '../../../src/d2kern-113c/game/k2-w4b6-113c.ts'
import {
  ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c,
  ACT2Q2_StatusFilter_6FCE3BD0_113c,
  ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c,
  ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c,
  ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c,
  ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c,
  ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c,
  ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c,
  ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
  ACT2Q5_InitArcanePortalObject_6FCE2850_113c,
  ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c,
  ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c,
  ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c,
  ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c,
  ACT2Q6_StatusFilter_6FCE1D30_113c,
  ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c,
  ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c,
  NPC_ClearPlayerInteractState_6FCDCB90_113c,
  NPC_DeductPlayerGoldAndStash_6FCDCC60_113c,
  NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c,
  NPC_HealAndCureUnit_6FCDCBE0_113c,
  NPC_InitHirelingVendorRoster_6FCDCED0_113c,
  NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c,
  NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c,
  NPC_RefreshInventoryItemStatLists_6FCDCA20_113c,
  NPC_RollStoreItemUpgrade_6FCDD040_113c,
  NPC_TransferInventoryItemsToOwner_6FCDCD90_113c,
  QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b4-113c.ts'
import { D2GAME_TAL_RASHA_TOMB_OBJECTS_VA_113C } from '../../../src/d2kern-113c/game/k2-w5b4-113c.ts'
import {
  ACT2Q3_StartEclipseEvent_6FCE6A30_113c,
  ACT2Q5_OnSummonerKilled_6FCE66B0_113c,
  ACT2Q5_SeqCallback_6FCE69D0_113c,
  ACT2Q6_PropagatePartyCompletionCallback_6FCE65A0_113c,
  ACT4Q1_OnIzualKilled_6FCDABF0_113c,
  ACT4Q3_SeqCallback_6FCDA4F0_113c,
  AIBAAL_CloneThink_6FCD8460_113c,
  AIBAAL_CombatThink_6FCC9610_113c,
  AIBAAL_ThroneRoomThink_6FCD8610_113c,
  ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c,
  ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c,
  MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c,
  MONAI_NihlathakThink_6FCC7580_113c,
  MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c,
  MONAI_SiegeMinionThinkA_6FCC5EB0_113c,
  MONAI_SiegeMinionThinkB_6FCC6050_113c,
  MONAI_SiegeMinionThinkC_6FCC62D0_113c,
  MONAI_WorldstoneMinionThink_6FCC7410_113c,
  MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c,
  PARTY_AddPlayerToSubParty_6FCBC4F0_113c,
  PARTY_RemoveSubPartyById_6FCBC7D0_113c,
  PETS_FreePlayerPetTable_6FCB7640_113c,
  PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c,
  PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c,
  SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c,
  SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c,
  SKILLS_SrvDo028_Conversion_6FCB9830_113c,
  SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c,
  SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c,
  SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c,
  SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c,
  SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c,
  SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2HirelingTxt_SIZE,
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
import {
  G_HIRELING_COUNT_VA_113C,
  G_HIRELING_TXT_VA_113C,
  G_SUPERUNIQUES_COUNT_VA_113C,
  G_SUPERUNIQUES_TXT_VA_113C,
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
  readonly functions: readonly ManifestFn[]
}

interface DisasmVaSpec {
  readonly batch: 'k2w7-b3' | 'k2w12-b1' | 'k2w3-b6' | 'k2w5-b4'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE14_INDIRECT_UNKNOWN_SKIPPED: readonly string[] = [
  '0x6FCDA270',
  '0x6FCE6390',
  '0x6FC801B0',
  '0x6FC806E0',
  '0x6FCE1FF0',
  '0x6FCE21E0',
  '0x6FCE24A0',
]

const WAVE14_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  // k2w7-b3: 33 eligible VAs
  { batch: 'k2w7-b3', va: '0x6FCB7640', size: 225, headHex: '83ec0853558bea55', tailHex: 'c408c3', tsSymbol: 'PETS_FreePlayerPetTable_6FCB7640_113c' },
  { batch: 'k2w7-b3', va: '0x6FCB7B50', size: 203, headHex: '83ec1c56578bf256', tailHex: 'c20800', tsSymbol: 'PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c' },
  { batch: 'k2w7-b3', va: '0x6FCB9830', size: 807, headHex: '83ec10538b5c2418', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo028_Conversion_6FCB9830_113c' },
  { batch: 'k2w7-b3', va: '0x6FCBC4F0', size: 292, headHex: '5355578bd8e806f8', tailHex: 'f6ffcc', tsSymbol: 'PARTY_AddPlayerToSubParty_6FCBC4F0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCBC7D0', size: 99, headHex: '568bb02c1d000033', tailHex: 'ff5ec3', tsSymbol: 'PARTY_RemoveSubPartyById_6FCBC7D0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC24C0', size: 427, headHex: '83ec0c558b6c2418', tailHex: 'c22000', tsSymbol: 'PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC2A40', size: 248, headHex: '83ec0c5356578bfa', tailHex: 'c20800', tsSymbol: 'SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC2B40', size: 248, headHex: '83ec0c5356578bfa', tailHex: 'c20800', tsSymbol: 'SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC4890', size: 371, headHex: '5153568bf08b4424', tailHex: 'c20c00', tsSymbol: 'MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC5EB0', size: 404, headHex: '83ec08558b6c2410', tailHex: 'c20400', tsSymbol: 'MONAI_SiegeMinionThinkA_6FCC5EB0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC6050', size: 635, headHex: '8b4c240883ec0855', tailHex: 'c20800', tsSymbol: 'MONAI_SiegeMinionThinkB_6FCC6050_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC62D0', size: 599, headHex: '83ec3053558b6c24', tailHex: 'c20400', tsSymbol: 'MONAI_SiegeMinionThinkC_6FCC62D0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC7410', size: 276, headHex: '83ec288b44242c53', tailHex: 'c20400', tsSymbol: 'MONAI_WorldstoneMinionThink_6FCC7410_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC7580', size: 1162, headHex: '83ec408b44244453', tailHex: 'c20400', tsSymbol: 'MONAI_NihlathakThink_6FCC7580_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC7A10', size: 517, headHex: '83ec08535556578d', tailHex: 'c20400', tsSymbol: 'MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c' },
  { batch: 'k2w7-b3', va: '0x6FCC9610', size: 1771, headHex: '83ec2c8b44243053', tailHex: 'c20400', tsSymbol: 'AIBAAL_CombatThink_6FCC9610_113c' },
  { batch: 'k2w7-b3', va: '0x6FCCD9C0', size: 248, headHex: '568bf285f6578bf9', tailHex: 'c21400', tsSymbol: 'ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCCF210', size: 194, headHex: '51578b7c240c85ff', tailHex: 'c21400', tsSymbol: 'ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c' },
  { batch: 'k2w7-b3', va: '0x6FCD33B0', size: 437, headHex: '5557568bf8e8be70', tailHex: '005dc3', tsSymbol: 'MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCD49F0', size: 282, headHex: '51558b6c240c85ed', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCD4B10', size: 262, headHex: '5153558b6c241085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c' },
  { batch: 'k2w7-b3', va: '0x6FCD4C20', size: 262, headHex: '5153558b6c241085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c' },
  { batch: 'k2w7-b3', va: '0x6FCD5600', size: 190, headHex: '55568b74240c85f6', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c' },
  { batch: 'k2w7-b3', va: '0x6FCD58A0', size: 170, headHex: '535556578b7c2414', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCD5950', size: 613, headHex: '83ec745355568bf2', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c' },
  { batch: 'k2w7-b3', va: '0x6FCD8460', size: 429, headHex: '83ec2853568bda33', tailHex: 'c20400', tsSymbol: 'AIBAAL_CloneThink_6FCD8460_113c' },
  { batch: 'k2w7-b3', va: '0x6FCD8610', size: 410, headHex: '83ec285355565768', tailHex: 'c20400', tsSymbol: 'AIBAAL_ThroneRoomThink_6FCD8610_113c' },
  { batch: 'k2w7-b3', va: '0x6FCDA4F0', size: 81, headHex: '81ec80000000568b', tailHex: '0000c3', tsSymbol: 'ACT4Q3_SeqCallback_6FCDA4F0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCDABF0', size: 323, headHex: '81ec84000000a120', tailHex: '0000c3', tsSymbol: 'ACT4Q1_OnIzualKilled_6FCDABF0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCE65A0', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT2Q6_PropagatePartyCompletionCallback_6FCE65A0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCE66B0', size: 257, headHex: '81ec840000005355', tailHex: '0000c3', tsSymbol: 'ACT2Q5_OnSummonerKilled_6FCE66B0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCE69D0', size: 86, headHex: '81ec80000000578b', tailHex: '0000c3', tsSymbol: 'ACT2Q5_SeqCallback_6FCE69D0_113c' },
  { batch: 'k2w7-b3', va: '0x6FCE6A30', size: 191, headHex: 'b8b052ce6f81ec80', tailHex: '0000c3', tsSymbol: 'ACT2Q3_StartEclipseEvent_6FCE6A30_113c' },
  // k2w12-b1: 29 eligible VAs
  { batch: 'k2w12-b1', va: '0x6FC2DBD0', size: 370, headHex: '8b44240483ec0885', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast_6FC2DBD0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC44C70', size: 82, headHex: '558b6c2408576aff', tailHex: 'c21000', tsSymbol: 'MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70_113c' },
  { batch: 'k2w12-b1', va: '0x6FC44E70', size: 796, headHex: '568b74242457508b', tailHex: 'c22000', tsSymbol: 'MONUMOD_SpawnPresetUniqueOrSuperUnique_6FC44E70_113c' },
  { batch: 'k2w12-b1', va: '0x6FC451F0', size: 1396, headHex: '81ec08010000568b', tailHex: 'c21400', tsSymbol: 'MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC679B0', size: 105, headHex: '53558b6c240c5657', tailHex: 'c20800', tsSymbol: 'MONSTER_SpawnUniqueBossWithChampionMinionPack_6FC679B0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC68FC0', size: 585, headHex: '83ec48558b6c2458', tailHex: 'c21800', tsSymbol: 'HIRELING_AssignMercenaryToPlayer_6FC68FC0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC71340', size: 509, headHex: '83ec485355568b35', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_MonsterConvert_6FC71340_113c' },
  { batch: 'k2w12-b1', va: '0x6FC74420', size: 417, headHex: '53558b6c2410568b', tailHex: 'c20800', tsSymbol: 'ITEMS_PlaceLoadedPlayerOrMercItem_6FC74420_113c' },
  { batch: 'k2w12-b1', va: '0x6FC745D0', size: 308, headHex: '53558b6c240c568b', tailHex: 'c20400', tsSymbol: 'ITEMS_PlaceLoadedPlayerItemWithSync_6FC745D0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC74810', size: 514, headHex: '83ec30538bd86681', tailHex: 'c21400', tsSymbol: 'ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c' },
  { batch: 'k2w12-b1', va: '0x6FC8BCB0', size: 169, headHex: '83ec08568bf18b46', tailHex: 'c408c3', tsSymbol: 'OBJ_OperateFn_DungeonStairOrTileWarp_6FC8BCB0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC8BE40', size: 183, headHex: '83ec085355568be9', tailHex: 'c408c3', tsSymbol: 'OBJ_OperateFn_FindPairedObjectAndTeleportPad_6FC8BE40_113c' },
  { batch: 'k2w12-b1', va: '0x6FC8DFC0', size: 280, headHex: '83ec1053568bf18b', tailHex: 'c410c3', tsSymbol: 'OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC8EDB0', size: 398, headHex: '83ec0c568bf18b46', tailHex: 'c40cc3', tsSymbol: 'OBJ_OperateFn_SparklyChestOrTrapSpawner_6FC8EDB0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC915E0', size: 226, headHex: '515556578bf0568b', tailHex: '5d59c3', tsSymbol: 'PLRTRADE_RestorePlayerInventoryAndGoldFromSnapshot_6FC915E0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC916D0', size: 267, headHex: '83ec08558b6c2414', tailHex: 'ffffff', tsSymbol: 'PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC919A0', size: 347, headHex: '53558b6c240c576a', tailHex: 'c21000', tsSymbol: 'PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c' },
  { batch: 'k2w12-b1', va: '0x6FC91B00', size: 780, headHex: '83ec0c538bd88b44', tailHex: 'c20400', tsSymbol: 'PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c' },
  { batch: 'k2w12-b1', va: '0x6FCA9870', size: 958, headHex: '83ec0c8b44241053', tailHex: 'c20400', tsSymbol: 'AI_Think_SandMaggot_6FCA9870_113c' },
  { batch: 'k2w12-b1', va: '0x6FCA9C30', size: 1571, headHex: '83ec448b44244853', tailHex: 'c20400', tsSymbol: 'AI_Think_BurrowingScarabOrFrog_6FCA9C30_113c' },
  { batch: 'k2w12-b1', va: '0x6FCBE170', size: 225, headHex: '83ec0c53558b6c24', tailHex: 'c20800', tsSymbol: 'PLAYER_ChangeLevelOrActTransition_6FCBE170_113c' },
  { batch: 'k2w12-b1', va: '0x6FCC9E80', size: 842, headHex: '83ec148b44241853', tailHex: 'c20400', tsSymbol: 'AI_Think_ShadowWarriorAndMaster_6FCC9E80_113c' },
  { batch: 'k2w12-b1', va: '0x6FCCA1D0', size: 760, headHex: '83ec1c5355568b74', tailHex: 'c20400', tsSymbol: 'AI_Think_Raven_6FCCA1D0_113c' },
  { batch: 'k2w12-b1', va: '0x6FCE8950', size: 49, headHex: '8b43045750e81e1b', tailHex: '5e5fc3', tsSymbol: 'ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c' },
  { batch: 'k2w12-b1', va: '0x6FCEFB90', size: 40, headHex: '8b417085c0740783', tailHex: 'c20800', tsSymbol: 'C2S_Packet23_MercReviveHandler_6FCEFB90_113c' },
  { batch: 'k2w12-b1', va: '0x6FCF3280', size: 202, headHex: '558b6c240885ed56', tailHex: 'c20400', tsSymbol: 'ITEMS_ClearInvalidRunewordOnItem_6FCF3280_113c' },
  { batch: 'k2w12-b1', va: '0x6FCF7E30', size: 492, headHex: '81ec28010000558b', tailHex: 'f2ffcc', tsSymbol: 'ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c' },
  { batch: 'k2w12-b1', va: '0x6FCF8970', size: 551, headHex: '5185c9568bf2894c', tailHex: 'c20c00', tsSymbol: 'ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c' },
  { batch: 'k2w12-b1', va: '0x6FD08780', size: 92, headHex: '558b6c2408576aff', tailHex: 'c20400', tsSymbol: 'ACT1Q4_SpawnSmithBossInBarracks_6FD08780_113c' },
  // k2w3-b6: 28 eligible VAs
  { batch: 'k2w3-b6', va: '0x6FC7E000', size: 214, headHex: '83ec2085db751f68', tailHex: 'c420c3', tsSymbol: 'ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c' },
  { batch: 'k2w3-b6', va: '0x6FC7E560', size: 243, headHex: '83ec0c538b5c2418', tailHex: 'c20800', tsSymbol: 'ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c' },
  { batch: 'k2w3-b6', va: '0x6FC7E660', size: 289, headHex: '83ec108bc28b5018', tailHex: 'c410c3', tsSymbol: 'ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c' },
  { batch: 'k2w3-b6', va: '0x6FC7E840', size: 138, headHex: '85ff750433c0eb03', tailHex: '005ec3', tsSymbol: 'ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c' },
  { batch: 'k2w3-b6', va: '0x6FC7E8D0', size: 109, headHex: '8b018b80f4100000', tailHex: '0300c3', tsSymbol: 'ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c' },
  { batch: 'k2w3-b6', va: '0x6FC7E940', size: 491, headHex: '83ec1053578bd98b', tailHex: 'c410c3', tsSymbol: 'ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c' },
  { batch: 'k2w3-b6', va: '0x6FC7EE30', size: 151, headHex: '85ff56750583ceff', tailHex: '005ec3', tsSymbol: 'ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c' },
  { batch: 'k2w3-b6', va: '0x6FC802A0', size: 123, headHex: '85c956743e0fb770', tailHex: '005ec3', tsSymbol: 'ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c' },
  { batch: 'k2w3-b6', va: '0x6FC80D00', size: 154, headHex: '5657528bf1e8b697', tailHex: 'c20400', tsSymbol: 'ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c' },
  { batch: 'k2w3-b6', va: '0x6FC80F70', size: 182, headHex: '5356578bfa578bf1', tailHex: 'c20400', tsSymbol: 'ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c' },
  { batch: 'k2w3-b6', va: '0x6FC811B0', size: 150, headHex: '8b420c85c0565775', tailHex: '5f5ec3', tsSymbol: 'ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c' },
  { batch: 'k2w3-b6', va: '0x6FC81250', size: 215, headHex: '5657528bf9e86692', tailHex: 'c20400', tsSymbol: 'ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c' },
  { batch: 'k2w3-b6', va: '0x6FC81340', size: 209, headHex: '558be98b85f41000', tailHex: '005dc3', tsSymbol: 'ACT1Q4_SpawnTristramPortalObject_6FC81340_113c' },
  { batch: 'k2w3-b6', va: '0x6FC81910', size: 146, headHex: '5356578bda538bf9', tailHex: 'c20400', tsSymbol: 'ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c' },
  { batch: 'k2w3-b6', va: '0x6FC819B0', size: 133, headHex: '5657528bf1e8068b', tailHex: 'c20400', tsSymbol: 'ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c' },
  { batch: 'k2w3-b6', va: '0x6FC81DA0', size: 133, headHex: '5657528bf1e81687', tailHex: 'c20400', tsSymbol: 'ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c' },
  { batch: 'k2w3-b6', va: '0x6FC81EC0', size: 105, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c' },
  { batch: 'k2w3-b6', va: '0x6FC82040', size: 154, headHex: '5657528bf1e87684', tailHex: 'c20400', tsSymbol: 'ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c' },
  { batch: 'k2w3-b6', va: '0x6FC821B0', size: 105, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c' },
  { batch: 'k2w3-b6', va: '0x6FC82370', size: 154, headHex: '5657528bf1e84681', tailHex: 'c20400', tsSymbol: 'ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c' },
  { batch: 'k2w3-b6', va: '0x6FC82640', size: 125, headHex: '56576a0d8bf86a06', tailHex: 'c20400', tsSymbol: 'ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c' },
  { batch: 'k2w3-b6', va: '0x6FC827A0', size: 202, headHex: '5356578bf2568bd9', tailHex: 'c20400', tsSymbol: 'ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c' },
  { batch: 'k2w3-b6', va: '0x6FC828D0', size: 131, headHex: '8b018b80f4100000', tailHex: '5e5fc3', tsSymbol: 'ACT1Q4_InitInifussTreeObject_6FC828D0_113c' },
  { batch: 'k2w3-b6', va: '0x6FC829B0', size: 115, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c' },
  { batch: 'k2w3-b6', va: '0x6FC82B40', size: 102, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c' },
  { batch: 'k2w3-b6', va: '0x6FC83270', size: 224, headHex: '8b4c240433c06639', tailHex: 'f9ffcc', tsSymbol: 'QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c' },
  { batch: 'k2w3-b6', va: '0x6FC83930', size: 329, headHex: '83ec0c5355528954', tailHex: 'c20400', tsSymbol: 'ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c' },
  { batch: 'k2w3-b6', va: '0x6FC863A0', size: 334, headHex: '83ec28578bf98b87', tailHex: 'c428c3', tsSymbol: 'ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c' },
  // k2w5-b4: 28 eligible VAs
  { batch: 'k2w5-b4', va: '0x6FCDC840', size: 216, headHex: '53558b6c240c8bd8', tailHex: 'c21000', tsSymbol: 'NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c' },
  { batch: 'k2w5-b4', va: '0x6FCDCA20', size: 114, headHex: '5185db74078b4360', tailHex: '5e59c3', tsSymbol: 'NPC_RefreshInventoryItemStatLists_6FCDCA20_113c' },
  { batch: 'k2w5-b4', va: '0x6FCDCAA0', size: 117, headHex: '5185c05657750583', tailHex: 'c20400', tsSymbol: 'NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c' },
  { batch: 'k2w5-b4', va: '0x6FCDCB90', size: 73, headHex: '85c056578bf9c747', tailHex: 'c20400', tsSymbol: 'NPC_ClearPlayerInteractState_6FCDCB90_113c' },
  { batch: 'k2w5-b4', va: '0x6FCDCBE0', size: 125, headHex: '538b5c240856576a', tailHex: 'c20800', tsSymbol: 'NPC_HealAndCureUnit_6FCDCBE0_113c' },
  { batch: 'k2w5-b4', va: '0x6FCDCC60', size: 296, headHex: '576a006a0e56e8bf', tailHex: 'c20400', tsSymbol: 'NPC_DeductPlayerGoldAndStash_6FCDCC60_113c' },
  { batch: 'k2w5-b4', va: '0x6FCDCD90', size: 112, headHex: '5750e845d6f4ff8b', tailHex: '5e5fc3', tsSymbol: 'NPC_TransferInventoryItemsToOwner_6FCDCD90_113c' },
  { batch: 'k2w5-b4', va: '0x6FCDCE60', size: 102, headHex: '6a016a1056e8f4d7', tailHex: 'c20400', tsSymbol: 'NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c' },
  { batch: 'k2w5-b4', va: '0x6FCDCED0', size: 355, headHex: '83ec08538bd88a43', tailHex: 'c20800', tsSymbol: 'NPC_InitHirelingVendorRoster_6FCDCED0_113c' },
  { batch: 'k2w5-b4', va: '0x6FCDD040', size: 288, headHex: '83ec1053578bf98b', tailHex: 'c20c00', tsSymbol: 'NPC_RollStoreItemUpgrade_6FCDD040_113c' },
  { batch: 'k2w5-b4', va: '0x6FCDF8F0', size: 154, headHex: '8b54240485d2568b', tailHex: 'c20800', tsSymbol: 'QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE1990', size: 107, headHex: '8b48048b81f41000', tailHex: 'c20400', tsSymbol: 'ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE1BA0', size: 128, headHex: '568bf08b46048b88', tailHex: '005ec3', tsSymbol: 'ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE1D30', size: 201, headHex: '53568b7424106a00', tailHex: 'c20c00', tsSymbol: 'ACT2Q6_StatusFilter_6FCE1D30_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE2850', size: 126, headHex: '8b018b80f4100000', tailHex: 'f4ffc3', tsSymbol: 'ACT2Q5_InitArcanePortalObject_6FCE2850_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE29E0', size: 167, headHex: '568bf18b86f41000', tailHex: 'c20400', tsSymbol: 'ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE2E70', size: 141, headHex: '568bf18b86f41000', tailHex: 'c20400', tsSymbol: 'ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE2F10', size: 244, headHex: '83ec08535556578b', tailHex: 'c20400', tsSymbol: 'ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE3010', size: 107, headHex: '5657528bf1e8a674', tailHex: 'c20400', tsSymbol: 'ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE31C0', size: 157, headHex: '5356578bda538bf9', tailHex: 'c20400', tsSymbol: 'ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE3480', size: 143, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE3550', size: 193, headHex: '5657528bf1e8666f', tailHex: 'c20400', tsSymbol: 'ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE3630', size: 118, headHex: '53568bf28bd96876', tailHex: 'c20400', tsSymbol: 'ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE36B0', size: 148, headHex: '5356578bf2568bf9', tailHex: 'c20400', tsSymbol: 'ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE3750', size: 147, headHex: '5657528bf1e8666d', tailHex: 'c20400', tsSymbol: 'ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE3900', size: 105, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE39B0', size: 205, headHex: '535556578bfa8b47', tailHex: '5d5bc3', tsSymbol: 'ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c' },
  { batch: 'k2w5-b4', va: '0x6FCE3BD0', size: 565, headHex: '83ec0c558b6c2418', tailHex: 'c20c00', tsSymbol: 'ACT2Q2_StatusFilter_6FCE3BD0_113c' },
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

function writeRpnImm32(m: SparseMemory113c, pSkillCode: number, offset: number, val: number): number {
  const addr = (pSkillCode + offset) >>> 0
  m.setU8(addr, 0x09)
  m.setU32((addr + 1) >>> 0, val >>> 0)
  m.setU8((addr + 5) >>> 0, 0x00)
  return offset
}

function createWave14World(nDifficulty = 0) {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(0x6fd18000, 0x24000, 0)
  m.fill(0x6fdd6000, 0x24000, 0)

  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)

  // Always wire BOTH D2Game (0x6fd18be0) and D2Common (0x6fdd90b0) bitmask IAT slots
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
  const pExpBin = m.alloc(0x200) >>> 0
  for (let c = 0; c < 8; c++) m.setU32((pExpBin + c * 4) >>> 0, 99)
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin)

  // MonStatsTxt (750 rows * 0x1A8) with wMonStatsEx (+0x18) populated
  const monStatsCount = 750
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec = (pMonStatsTxt + i * 0x1a8) >>> 0
    m.setU16(rec, i)
    m.setU16((rec + 0x18) >>> 0, i) // D2MonStatsTxt.wMonStatsEx
    m.setU16((rec + 0x1e) >>> 0, 1) // wVelocity
    for (let s = 0; s < 8; s++) m.setU16((rec + 0x170 + s * 2) >>> 0, 0xffff)
  }

  // MonStats2Txt (750 rows * 0x134)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa8c) >>> 0, monStatsCount)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)

  // SkillsTxt (220 rows * 0x23C) + SkillCode RPN buffer
  const skillsCount = 220
  const pSkillsTxt = m.alloc(skillsCount * D2SkillsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)
  const pSkillCode = m.alloc(0x400) >>> 0
  m.setU32((pDataTables + 0x40) >>> 0, pSkillCode)
  m.setU32((pDataTables + 0x44) >>> 0, 0x400)

  // ItemStatCostTxt (400 rows * 0x144)
  const iscCount = 400
  const pIscTxt = m.alloc(iscCount * 0x144) >>> 0
  m.setU32((pDataTables + 0xbcc) >>> 0, pIscTxt)
  m.setU32((pDataTables + 0xbd4) >>> 0, iscCount)

  // StatesTxt (190 rows * 0x3C)
  const statesCount = 190
  const pStatesTxt = m.alloc(statesCount * 0x3c) >>> 0
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc4) >>> 0, statesCount)
  m.setU32((pDataTables + 0xbb8) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xbc0) >>> 0, statesCount)

  // LevelsTxt (140 rows * 0x220) + LevelDefBin (0x6FDF0B38, 140 rows * 0x9C) + act town boundaries at pDataTables+0xC60
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE) >>> 0
  const pLevelDefBin = m.alloc(levelsCount * 0x9c) >>> 0
  m.setU32(0x6fdf0b38, pLevelDefBin)
  for (let lvl = 1; lvl <= 39; lvl++) m.setU8((pLevelsTxt + lvl * D2LevelsTxt_SIZE + 0x02) >>> 0, 0)
  for (let lvl = 40; lvl <= 74; lvl++) m.setU8((pLevelsTxt + lvl * D2LevelsTxt_SIZE + 0x02) >>> 0, 1)
  for (let lvl = 75; lvl <= 102; lvl++) m.setU8((pLevelsTxt + lvl * D2LevelsTxt_SIZE + 0x02) >>> 0, 2)
  for (let lvl = 103; lvl <= 108; lvl++) m.setU8((pLevelsTxt + lvl * D2LevelsTxt_SIZE + 0x02) >>> 0, 3)
  for (let lvl = 109; lvl <= 136; lvl++) m.setU8((pLevelsTxt + lvl * D2LevelsTxt_SIZE + 0x02) >>> 0, 4)
  m.setU32((pDataTables + 0xbd8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xbe0) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, levelsCount)
  const actBounds = [1, 40, 75, 103, 109, 137]
  for (let i = 0; i < actBounds.length; i++) {
    m.setU32((pDataTables + 0xc60 + i * 4) >>> 0, actBounds[i]!)
  }

  // PetTypesTxt count at pDataTables+0xBF0
  m.setU32((pDataTables + 0xbf0) >>> 0, 16)

  // ItemTypesTxt (100 rows * 0xE4) + Equiv matrix (stride 4 dwords)
  const itemTypesCount = 100
  const pItemTypesTxt = m.alloc(itemTypesCount * 0xe4) >>> 0
  const itemTypeStride = 4
  const pItemTypeEquiv = m.alloc(itemTypesCount * itemTypeStride * 4) >>> 0
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + 0xbfc) >>> 0, itemTypesCount)
  m.setU32((pDataTables + 0xc00) >>> 0, itemTypeStride)
  m.setU32((pDataTables + 0xc04) >>> 0, pItemTypeEquiv)
  const setItemTypeEquiv = (typeId: number, targetType: number) => {
    const col = targetType >> 5
    const bit = (1 << (targetType & 31)) >>> 0
    const addr = (pItemTypeEquiv + (typeId * itemTypeStride + col) * 4) >>> 0
    m.setU32(addr, (m.u32(addr) | bit) >>> 0)
  }
  for (let t = 0; t < itemTypesCount; t++) setItemTypeEquiv(t, t)
  // Throwing potion type 0x26 & throwing weapon type 0x2b both belong to weapon type 45 (0x2d)
  setItemTypeEquiv(0x26, 45)
  setItemTypeEquiv(0x2b, 45)
  m.setU8((pItemTypesTxt + 0x2b * 0xe4 + 0x10) >>> 0, 1) // bThrowable = 1

  // ItemsTxt (64 rows * 0x1A8)
  const itemsCount = 64
  const pItemsTxt = m.alloc(itemsCount * ITEMS_TXT_STRIDE_113C) >>> 0
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, itemsCount)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, itemsCount)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32((pDataTables + 0xc28) >>> 0, itemsCount)
  m.setU32((pDataTables + 0xc2c) >>> 0, pItemsTxt)

  // InventoryTxt / BeltsTxt (16 rows * 0x108)
  const pInvTxtTable = m.alloc(16 * 0x108) >>> 0
  m.setU32(G_INVENTORY_TXT_TABLE_VA_113C, pInvTxtTable)
  // Default belt index 2 -> 4 slots at +0x04 (dwNumBoxes)
  m.setU8((pInvTxtTable + 2 * 0x108 + 0x04) >>> 0, 4)

  // ObjectsTxt (600 rows * 0x1C0)
  const objectsCount = 600
  const pObjectsTxt = m.alloc(objectsCount * 0x1c0) >>> 0
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, objectsCount)

  // SuperUniquesTxt (70 rows * 0x34)
  const suCount = 70
  const pSuperUniquesTxt = m.alloc(suCount * 0x34) >>> 0
  m.setU32(G_SUPERUNIQUES_TXT_VA_113C, pSuperUniquesTxt)
  m.setU32(G_SUPERUNIQUES_COUNT_VA_113C, suCount)

  // HirelingTxt (4 rows * D2HirelingTxt_SIZE)
  const pHirelingTxt = m.alloc(4 * D2HirelingTxt_SIZE) >>> 0
  m.setU32(G_HIRELING_TXT_VA_113C, pHirelingTxt)
  m.setU32(G_HIRELING_COUNT_VA_113C, 2)
  m.setU16(pHirelingTxt, 100) // wVersion = 100
  m.setU32((pHirelingTxt + HIRELING_TXT_SELLER_OFF_113C) >>> 0, 198)
  m.setU32((pHirelingTxt + 0x10) >>> 0, 1) // dwDifficulty = 1
  m.setU16((pHirelingTxt + 0x114) >>> 0, 10)
  m.setU16((pHirelingTxt + 0x116) >>> 0, 24)

  // Grid0 (bodylocs, 12x1) and Grid1 (belt, 16x1) info tables
  m.setU8((D2COMMON_GRID0_INFO_VA_113C + 0x00) >>> 0, 12)
  m.setU8((D2COMMON_GRID0_INFO_VA_113C + 0x01) >>> 0, 1)
  m.setU8(0x6fded390, 16)
  m.setU8(0x6fded391, 1)

  // AnimData table + PlrType/PlrMode globals
  const pAnimDataTable = m.alloc(0x500) >>> 0
  const pEmptyAnimBucket = m.alloc(8) >>> 0
  for (let i = 0; i < 256; i++) m.setU32((pAnimDataTable + i * 4) >>> 0, pEmptyAnimBucket)
  m.setU32((pAnimDataTable + 0x404 + 0x08) >>> 0, 8)
  m.setU32((pAnimDataTable + 0x404 + 0x0c) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13c4, 7)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34) >>> 0)
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34) >>> 0)

  // Game struct with non-zero RNG seed at +0xD0, timer queue, quest ctrl, NPC ctrl, acts
  const pGame = m.alloc(0x1df4) >>> 0
  m.setU8((pGame + 0x6d) >>> 0, nDifficulty & 0xff)
  m.setU32((pGame + 0x70) >>> 0, 1) // bExpansion = 1
  m.setU32((pGame + 0xa8) >>> 0, 1000)
  m.setU32((pGame + 0xd0) >>> 0, 0x12345679)
  m.setU32((pGame + 0xd4) >>> 0, 666)
  EVENT_InitTimerQueue113c(m, pGame)

  const pQuestControl = m.alloc(0x40) >>> 0
  m.setU32((pQuestControl + 0x08) >>> 0, 1)
  m.setU32((pQuestControl + 0x0c) >>> 0, QUESTRECORD_AllocRecord113c(m, 0))
  m.setU32((pGame + 0x10f4) >>> 0, pQuestControl)

  const pNpcControl = m.alloc(0x40) >>> 0
  const pNpcSlots = m.alloc(0x40 * 0x44) >>> 0
  for (let i = 0; i < 0x40; i++) m.setU32((pNpcSlots + i * 0x44) >>> 0, 0xfffffffe)
  m.setU32((pNpcControl + 0x04) >>> 0, pNpcSlots)
  m.setU32((pNpcControl + 0x08) >>> 0, 0x12345678)
  m.setU32((pNpcControl + 0x0c) >>> 0, 0x0000029a)
  m.setU32((pGame + 0x1d24) >>> 0, pNpcControl)

  for (let act = 0; act < 5; act++) {
    const pAct = m.alloc(0x80) >>> 0
    const pDrlg = m.alloc(0x500) >>> 0
    m.setU32((pAct + 0x04) >>> 0, pGame)
    m.setU32((pAct + 0x48) >>> 0, pDrlg)
    m.setU32((pGame + 0xbc + act * 4) >>> 0, pAct)
    const pMonReg = m.alloc(0x400) >>> 0
    m.setU32((pGame + 0xf0 + act * 4) >>> 0, pMonReg)
  }

  return {
    m,
    pDataTables,
    pGame,
    pQuestControl,
    pNpcControl,
    pNpcSlots,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pSkillCode,
    pIscTxt,
    pStatesTxt,
    pItemsTxt,
    pItemTypesTxt,
    pInvTxtTable,
    pObjectsTxt,
    pSuperUniquesTxt,
    pHirelingTxt,
    setItemTypeEquiv,
  }
}

function allocRoomWithLevel(m: SparseMemory113c, levelId: number, pGame = 0): number {
  const pRoom = m.alloc(0x90) >>> 0
  const pRoomEx = m.alloc(0xf0) >>> 0
  const pLevel = m.alloc(0x230) >>> 0
  const ppNear = m.alloc(4) >>> 0
  m.setU32(ppNear, pRoom)
  m.setU32(pRoom, ppNear)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoom + 0x24) >>> 0, 1)
  m.setU32((pRoom + 0x4c) >>> 0, 0)
  m.setU32((pRoom + 0x50) >>> 0, 0)
  m.setU32((pRoom + 0x54) >>> 0, 400)
  m.setU32((pRoom + 0x58) >>> 0, 400)
  m.setU32((pRoomEx + 0x28) >>> 0, 0x03100000)
  m.setU32((pRoomEx + 0x30) >>> 0, pRoom)
  m.setU32((pRoomEx + 0x3c) >>> 0, 80)
  m.setU32((pRoomEx + 0x40) >>> 0, 80)
  m.setU32((pRoomEx + 0x54) >>> 0, pRoom)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  m.setU32((pLevel + 0x08) >>> 0, 1)
  m.setU32((pLevel + 0x10) >>> 0, pRoomEx)
  m.setU32((pLevel + 0x24) >>> 0, 80)
  m.setU32((pLevel + 0x28) >>> 0, 80)
  m.setU32((pLevel + 0x1d0) >>> 0, levelId >>> 0)
  if (pGame !== 0) {
    const act = levelId >= 109 ? 4 : levelId >= 103 ? 3 : levelId >= 75 ? 2 : levelId >= 40 ? 1 : 0
    const pAct = m.u32((pGame + 0xbc + act * 4) >>> 0) >>> 0
    m.setU32((pRoom + 0x7c) >>> 0, pAct)
    if (pAct !== 0) {
      const pDrlg = m.u32((pAct + 0x48) >>> 0) >>> 0
      if (pDrlg !== 0) {
        m.setU32((pLevel + 0x1b4) >>> 0, pDrlg)
        m.setU32((pLevel + 0x1ac) >>> 0, m.u32((pDrlg + 0x47c) >>> 0))
        m.setU32((pDrlg + 0x47c) >>> 0, pLevel)
      }
    }
  }
  return pRoom
}

function allocPlayer(
  m: SparseMemory113c,
  pGame: number,
  guid: number,
  levelId = 1,
  x = 100,
  y = 100,
  nDifficulty = 0,
) {
  const pPlayer = m.alloc(0x100) >>> 0
  const pPlayerData = m.alloc(0x100) >>> 0
  const pPath = m.alloc(0x200) >>> 0
  const pRoom = allocRoomWithLevel(m, levelId, pGame)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer) >>> 0
  const pClient = m.alloc(0x520) >>> 0
  const pQueue = m.alloc(0x400) >>> 0
  m.setU32((pClient + 0x174) >>> 0, pPlayer)
  m.setU32((pClient + 0x1a8) >>> 0, pGame)
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)

  m.setU32(pPlayer, 0) // UNIT_PLAYER
  m.setU32((pPlayer + 0x04) >>> 0, 2) // Necromancer
  m.setU32((pPlayer + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pPlayer + 0x10) >>> 0, 1)
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
  m.setU32((pPlayer + 0x20) >>> 0, (0x13579bdf + guid) >>> 0)
  m.setU32((pPlayer + 0x24) >>> 0, 666)
  m.setU32((pPlayer + 0x2c) >>> 0, pPath)
  m.setU32((pPlayer + 0x60) >>> 0, pInv)
  m.setU32((pPlayer + 0x80) >>> 0, pGame)

  m.setU16((pPath + 0x02) >>> 0, x & 0xffff)
  m.setU16((pPath + 0x06) >>> 0, y & 0xffff)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)

  m.setU32((pPlayerData + 0x10 + nDifficulty * 4) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)

  const pStatListEx = STATLIST_CreateEx113c(m, pPlayer, 0, 0)
  m.set(pPlayer, D2UnitStrc.pStatListEx, pStatListEx)
  m.set(pPlayer, D2UnitStrc.pSkills, m.alloc(0x20) >>> 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 6, 500, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 7, 500, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 8, 250, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 9, 250, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 12, 25, 0)

  SUNIT_InsertServerUnit113c(m, pGame, pPlayer)
  return { pPlayer, pPlayerData, pPath, pRoom, pQuestFlags, pInv, pClient, pStatListEx }
}

function allocMonster(
  m: SparseMemory113c,
  pGame: number,
  classId: number,
  guid: number,
  levelId = 2,
  x = 104,
  y = 100,
) {
  const pMon = m.alloc(0x100) >>> 0
  const pMonData = m.alloc(0x80) >>> 0
  const pAiGen = m.alloc(0x50) >>> 0
  const pAiCtrl = m.alloc(0x60) >>> 0
  const pPath = m.alloc(0x200) >>> 0
  const pRoom = allocRoomWithLevel(m, levelId, pGame)

  m.setU32(pMon, 1) // UNIT_MONSTER
  m.setU32((pMon + 0x04) >>> 0, classId >>> 0)
  m.setU32((pMon + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pMon + 0x10) >>> 0, 1)
  m.setU32((pMon + 0x14) >>> 0, pMonData)
  m.setU32((pMon + 0x20) >>> 0, (0x2468ace1 + guid) >>> 0)
  m.setU32((pMon + 0x24) >>> 0, 666)
  m.setU32((pMon + 0x2c) >>> 0, pPath)
  m.setU32((pMon + 0x80) >>> 0, pGame)

  m.setU32((pMonData + 0x28) >>> 0, pAiGen)
  m.setU32((pMonData + 0x2c) >>> 0, pAiCtrl)

  m.setU16((pPath + 0x02) >>> 0, x & 0xffff)
  m.setU16((pPath + 0x06) >>> 0, y & 0xffff)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)

  const pStatListEx = STATLIST_CreateEx113c(m, pMon, 0, 0)
  m.set(pMon, D2UnitStrc.pStatListEx, pStatListEx)
  STATLIST_SetUnitStat113c(m, pMon, 6, 400, 0)
  STATLIST_SetUnitStat113c(m, pMon, 7, 400, 0)
  STATLIST_SetUnitStat113c(m, pMon, 12, 20, 0)

  SUNIT_InsertServerUnit113c(m, pGame, pMon)
  return { pMon, pMonData, pAiGen, pAiCtrl, pPath, pRoom, pStatListEx }
}

function allocItem(
  m: SparseMemory113c,
  itemId: number,
  guid: number,
  baseCode = 0x20706163,
  itemType = 0x2b,
) {
  const pItem = m.alloc(0x100) >>> 0
  const pItemData = m.alloc(0xa0) >>> 0
  const pStaticPath = m.alloc(0x20) >>> 0
  m.setU32(pItem, 4)
  m.setU32((pItem + 0x04) >>> 0, itemId >>> 0)
  m.setU32((pItem + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pItem + 0x14) >>> 0, pItemData)
  m.setU32((pItem + 0x20) >>> 0, (0x31415927 + guid) >>> 0)
  m.setU32((pItem + 0x24) >>> 0, 666)
  m.setU32((pItem + 0x2c) >>> 0, pStaticPath)
  const pStatListEx = STATLIST_CreateEx113c(m, pItem, 0, 0)
  m.set(pItem, D2UnitStrc.pStatListEx, pStatListEx)

  const pItemsTxt = m.u32(D2COMMON_ITEMS_TXT_PTR_VA_113C) >>> 0
  const pRec = (pItemsTxt + itemId * D2ItemsTxt_SIZE) >>> 0
  m.setU32((pRec + 0x80) >>> 0, baseCode >>> 0)
  m.setU32((pRec + 0x84) >>> 0, baseCode >>> 0)
  m.setU8((pRec + 0x10f) >>> 0, 1) // nInvWidth
  m.setU8((pRec + 0x110) >>> 0, 1) // nInvHeight
  m.setU16((pRec + 0x11e) >>> 0, itemType & 0xffff)
  return { pItem, pItemData, pStaticPath, pStatListEx }
}

function linkQuest(
  m: SparseMemory113c,
  pGame: number,
  pQuestControl: number,
  nQuestId: number,
  nQuestNo = nQuestId,
) {
  const pQuest = m.alloc(0x120) >>> 0
  const pQuestEx = m.alloc(0x200) >>> 0
  m.setU32(pQuest, nQuestId >>> 0)
  m.setU32((pQuest + 0x04) >>> 0, pGame)
  m.setU8((pQuest + 0x09) >>> 0, 1)
  m.setU32((pQuest + 0x18) >>> 0, pQuestEx)
  m.setU32((pQuest + 0xdc) >>> 0, m.alloc(0x800) >>> 0)
  m.setU32((pQuest + 0xe0) >>> 0, nQuestNo >>> 0)
  m.setU32((pQuest + 0xf4) >>> 0, m.u32(pQuestControl))
  m.setU32(pQuestControl, pQuest)
  return { pQuest, pQuestEx }
}

describe('D2Game.dll v1.13c Disassembly Verification Wave 14 (+118 VAs across k2w7-b3, k2w12-b1, k2w3-b6, k2w5-b4)', () => {
  it('verifies exact PE32 machine-code leading/trailing opcodes, sizes, manifest promotion (118 VAs), and indirectUnknown guardrails (7 VAs)', () => {
    expect(WAVE14_PROMOTED_SPECS.length).toBe(118)
    const uniqueVas = new Set(WAVE14_PROMOTED_SPECS.map((s) => s.va.toUpperCase()))
    expect(uniqueVas.size).toBe(118)

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
    const byVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        byVa.set(fn.va.toUpperCase(), fn)
      }
    }

    // All 7 formerly indirectUnknown VAs across the 4 shards were statically resolved and promoted in Wave 23 (Batch A)
    for (const skippedVa of WAVE14_INDIRECT_UNKNOWN_SKIPPED) {
      const mFn = byVa.get(skippedVa.toUpperCase())
      expect(mFn, `missing skipped VA ${skippedVa}`).toBeDefined()
      expect(mFn!.indirectUnknown, `${skippedVa} resolved in Wave 23`).toBeUndefined()
      expect(mFn!.status, `${skippedVa} promoted to diff-verified in Wave 23`).toBe('diff-verified')
    }

    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    const pe = fs.existsSync(dllPath) ? loadPeSectionMapper(dllPath, 0x6fc20000) : null

    for (const spec of WAVE14_PROMOTED_SPECS) {
      const mFn = byVa.get(spec.va.toUpperCase())
      expect(mFn, `manifest missing ${spec.va}`).toBeDefined()
      expect(mFn!.status, `${spec.va} must be diff-verified`).toBe('diff-verified')
      expect(mFn!.indirectUnknown, `${spec.va} must not be indirectUnknown`).not.toBe(true)
      expect(mFn!.tsSymbol).toBe(spec.tsSymbol)
      expect(mFn!.size).toBe(spec.size)
      expect(mFn!.diffEvidence).toContain('k2-disasm-verified-wave14.test.ts')

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

  it('regression [k2w3-b6]: 0x6FC82640 5-bit mask & >= check, 0x6FC827A0 level 0 handling, 0x6FC811B0 inline GUID removal, 0x6FC83270 32-bit sound check', () => {
    const { m, pGame, pQuestControl } = createWave14World(2)
    const { pPlayer, pQuestFlags, pClient } = allocPlayer(m, pGame, 0x101, 0, 50, 50, 2)

    // 0x6FC82640: Hell (nDifficulty=2) + Expansion bit 0x20 (nTotalActs=5) -> nTargetProgress = 5*2 + 1 = 11 (0b01011).
    // Current progress 0x10 (16 > 11) in bits 8..12 must NOT be truncated by old 4-bit mask 0x0f nor overwritten!
    m.setU16((pClient + 0x0a) >>> 0, 0b111_10000_00101010)
    ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c(m, pPlayer, pQuestFlags, pGame)
    expect(m.u16((pClient + 0x0a) >>> 0)).toBe(0b111_10000_00101010)

    // Current progress 0x02 (< 11) MUST update bits 8..12 to 11 (0b01011), preserving bits 0..7 and 13..15!
    m.setU16((pClient + 0x0a) >>> 0, 0b101_00010_00100101)
    ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c(m, pPlayer, pQuestFlags, pGame)
    expect(m.u16((pClient + 0x0a) >>> 0)).toBe(0b101_01011_00100101)

    // 0x6FC827A0: levelId === 0 must NOT early return — must still set quest 5 state 0x0e when quest 5 is active
    const { pQuest: q5, pQuestEx: q5Ex } = linkQuest(m, pGame, pQuestControl, 5, 5)
    m.setU8((q5 + 0x0c) >>> 0, 1)
    ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c(m, pGame, pPlayer, 0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0x0e)).toBe(1)

    // 0x6FC811B0: removes player GUID from +0x8c list AND both compact arrays (+0x00/+0x34) inline WITHOUT spuriously tracing D2Game:0x6FC802A0
    QUESTS_GuidListAdd113c(m, (q5Ex + 0x8c) >>> 0, 0x101)
    m.setU32((q5Ex + 0x34) >>> 0, 0x101)
    m.setU16((q5Ex + 0x64) >>> 0, 1)
    expect(QUESTS_GuidListContains113c(m, (q5Ex + 0x8c) >>> 0, 0x101)).toBe(1)
    const pQuestArg = m.alloc(0x30) >>> 0
    m.setU32(pQuestArg, pGame)
    m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer)
    beginVaTrace113c()
    ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c(m, q5, pQuestArg)
    const hits811b0 = endVaTrace113c()
    expect(hits811b0.has('D2Game:0x6FC811B0')).toBe(true)
    expect(hits811b0.has('D2Game:0x6FC802A0')).toBe(false)
    expect(QUESTS_GuidListContains113c(m, (q5Ex + 0x8c) >>> 0, 0x101)).toBe(0)
    expect(m.u16((q5Ex + 0x64) >>> 0)).toBe(0)

    // 0x6FC83270: full 32-bit wSoundId !== 0 check (0x10000 has low 16 bits == 0, still triggers sound path!)
    const pGuidList = m.alloc(0x100) >>> 0
    QUESTS_GuidListAdd113c(m, pGuidList, 0x101)
    beginVaTrace113c()
    QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c(m, pGame, pGuidList, 2, 0x10000)
    const hits83270 = endVaTrace113c()
    expect(hits83270.has('D2Game:0x6FC83270')).toBe(true)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0)).toBe(1)
  })

  it('regression [k2w3-b6]: 0x6FC83930 assert/room order, 0x6FC828D0 null-quest guard, 0x6FC863A0 & 0x6FC7E940 exact spawn', () => {
    const { m, pGame, pQuestControl } = createWave14World(0)
    const { pPlayer, pRoom } = allocPlayer(m, pGame, 0x102, 17, 120, 140, 0)

    // 0x6FC83930 asserts line 0x133 when quest 2 is missing (no premature early return)
    expect(() =>
      ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c(m, pGame, pPlayer, 0),
    ).toThrow(D2CommonAssertError)

    // With quest 2 present and tracked mon null, skips UNITS_GetRoom(0) and runs cleanly
    const { pQuest: q2 } = linkQuest(m, pGame, pQuestControl, 2, 2)
    m.setU8((q2 + 0x0c) >>> 0, 1)
    expect(
      ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c(m, pGame, pPlayer, 0),
    ).toBe(0)

    // 0x6FC828D0: safe when quest 4 missing; attaches when quest 4 present
    const pTreeObj = m.alloc(0x100) >>> 0
    m.setU32(pTreeObj, 2)
    m.setU32((pTreeObj + 0x0c) >>> 0, 0x222)
    const pObjInit = m.alloc(0x20) >>> 0
    m.setU32(pObjInit, pGame)
    m.setU32((pObjInit + 0x04) >>> 0, pTreeObj)
    ACT1Q4_InitInifussTreeObject_6FC828D0_113c(m, pObjInit)
    linkQuest(m, pGame, pQuestControl, 4, 4)
    ACT1Q4_InitInifussTreeObject_6FC828D0_113c(m, pObjInit)

    // 0x6FC863A0: returns early when bHadCage !== 1
    ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c(m, pGame)

    // 0x6FC7E940: full Frozen Anya object spawn (dwFlagsEx 0x06000000, GUID wrap 0xfffffffe->0xffffffff->1, 0x38 pObjectData, bNoActivate=1)
    const { pQuest: q21, pQuestEx: q21Ex } = linkQuest(m, pGame, pQuestControl, 0x21, 0x21)
    m.setU8((q21 + 0x09) >>> 0, 1)
    m.setU32((pGame + 0x98) >>> 0, 0xfffffffe)
    const { pMon: pAnyaUnit } = allocMonster(m, pGame, 512, 0x333, 114, 155, 165)
    m.setU32((m.u32((pAnyaUnit + 0x2c) >>> 0) + 0x1c) >>> 0, pRoom)
    ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c(m, pGame, pAnyaUnit)
    expect(m.u8((q21Ex + 0xa4) >>> 0)).toBe(1)
    expect(m.u32((pGame + 0x98) >>> 0)).toBe(1) // wrapped 0xffffffff -> 1!
    expect(m.u32((q21Ex + 0xa8) >>> 0)).toBe(1)
  })

  it('regression [k2w7-b3]: 0x6FCCF210 unswapped dwStatAndLayer, 0x6FCC2A40/0x6FCC2B40 unswapped throw checks, 0x6FCD5950 inline RNG, 0x6FCC4890/0x6FCC62D0/0x6FCC7580/0x6FCD8460', () => {
    const { m, pGame, pSkillsTxt, pSkillCode, pMonStatsTxt } = createWave14World(0)
    const { pPlayer, pInv, pRoom } = allocPlayer(m, pGame, 0x201, 2, 100, 100, 0)
    const { pMon: pVictim } = allocMonster(m, pGame, 5, 0x202, 2, 102, 100)

    // 0x6FCCF210: high16 = nStatId (0x00c5 = 197 STAT_ITEM_REANIMATE), low16 = nMonsterClassId (0x01e5 = 485)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x00c5, 100, 0x01e5) // 100% reanimate chance at layer=485
    const dwStatAndLayer = ((0x00c5 << 16) | 0x01e5) >>> 0
    const reanimRes = ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c(
      m,
      pGame,
      pPlayer,
      pVictim,
      0,
      0,
      dwStatAndLayer,
    )
    expect(reanimRes).toBe(1)
    // Verify registered unit event node on defender (+0x90) holds dwArg1 == nMonsterClassId (0x01e5), NOT nStatId (0x00c5)
    const pEventHead = m.u32((pVictim + 0x90) >>> 0) >>> 0
    expect(pEventHead).not.toBe(0)
    expect(m.u32((pEventHead + 0x0c) >>> 0)).toBe(0x01e5)

    // 0x6FCC2A40 & 0x6FCC2B40: throwing potion (type 0x26, NOT bThrowable) with stat 0x7d != 0 passes throw gate & dispatches potion branch
    const { pItem: pThrowPot } = allocItem(m, 5, 0x505, 0x20706f70, 0x26)
    STATLIST_SetUnitStat113c(m, pThrowPot, 0x7d, 1, 0)
    INVENTORY_PlaceItemInBodyLoc113c(m, pInv, pThrowPot, 4) // BODYLOC_RARM
    m.setU32((pInv + 0x2c) >>> 0, 0x505) // active weapon GUID
    beginVaTrace113c()
    SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c(m, pGame, pPlayer, 1, 1)
    SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c(m, pGame, pPlayer, 1, 1)
    const throwHits = endVaTrace113c()
    expect(throwHits.has('D2Game:0x6FCC2B40')).toBe(true)
    expect(throwHits.has('D2Game:0x6FCC2A40')).toBe(true)
    expect(throwHits.has('D2Game:0x6FCC1880')).toBe(true) // potion throw branch!

    // 0x6FCD5950: inline seed step % 5 does NOT spuriously trace D2Game:0x6FC21180
    const off10 = writeRpnImm32(m, pSkillCode, 0x10, 10)
    for (const curseId of [66, 72, 82, 87, 91]) {
      const pRec = (pSkillsTxt + curseId * D2SkillsTxt_SIZE) >>> 0
      m.setU16((pRec + 0x82) >>> 0, 9) // wAuraTargetState = 9
      m.setU32((pRec + 0x60) >>> 0, off10)
      m.setU32((pRec + 0x64) >>> 0, off10)
    }
    const { pMon: pOk, pPath: pOkPath, pRoom: pOkRoom } = allocMonster(m, pGame, 312, 0x203, 2, 100, 100)
    m.setU32((pOkRoom + 0x74) >>> 0, pPlayer)
    PATH_SetTargetUnit113c(m, pOkPath, pPlayer)
    beginVaTrace113c()
    const okRes = SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c(m, pGame, pOk, 135, 1)
    const okHits = endVaTrace113c()
    expect(okRes).toBe(1)
    expect(okHits.has('D2Game:0x6FCD5950')).toBe(true)
    expect(okHits.has('D2Game:0x6FC21180')).toBe(false)

    // 0x6FCC4890: traces D2Game:0x6FC21180 when rolling chance
    const pSkill = m.alloc(0x40) >>> 0
    m.setU32(pSkill, (pSkillsTxt + 10 * D2SkillsTxt_SIZE) >>> 0)
    m.setU32((pSkill + 0x28) >>> 0, 1)
    const { pMon: pShadow, pAiCtrl: pShadowCtrl } = allocMonster(m, pGame, 417, 0x204, 2, 100, 100)
    const pAiParam = m.alloc(0x30) >>> 0
    m.setU32(pAiParam, pShadowCtrl)
    m.setU32((pAiParam + 0x08) >>> 0, pVictim)
    m.setU32((pAiParam + 0x10) >>> 0, 5)
    m.setU32((pAiParam + 0x14) >>> 0, pPlayer)
    m.setU32((pAiParam + 0x1c) >>> 0, (pMonStatsTxt + 417 * 0x1a8) >>> 0)
    m.setU8((pSkillsTxt + 10 * D2SkillsTxt_SIZE + 0x0c) >>> 0, 2) // matches pPlayer classId=2
    m.setU8((pSkillsTxt + 10 * D2SkillsTxt_SIZE + 0x230) >>> 0, 1) // bAiType = 1 (buff)
    m.setU16((pSkillsTxt + 10 * D2SkillsTxt_SIZE + 0x158) >>> 0, 100)
    beginVaTrace113c()
    MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c(m, 10, pPlayer, pShadow, pGame, pSkill, pAiParam)
    const evalHits = endVaTrace113c()
    expect(evalHits.has('D2Game:0x6FCC4890')).toBe(true)
    expect(evalHits.has('D2Game:0x6FC21180')).toBe(true)

    // 0x6FCD8460: Baal clone death distributes XP with unswapped (pGame, 0, pUnit) & no spurious 0x6FC40F00 trace
    const { pMon: pBaalClone, pAiCtrl: pCloneCtrl } = allocMonster(m, pGame, 544, 0x205, 2, 100, 100)
    m.setU32((m.u32((pBaalClone + 0x2c) >>> 0) + 0x1c) >>> 0, pRoom)
    const pCloneParam = m.alloc(0x30) >>> 0
    m.setU32(pCloneParam, pCloneCtrl)
    m.setU32((pCloneParam + 0x1c) >>> 0, (pMonStatsTxt + 544 * 0x1a8) >>> 0)
    // Set expire frame in past so clone self-destructs and calls SUNITDMG_DistributeExperience113c(m, pGame, 0, pUnit)
    m.setU32((pCloneCtrl + 0x18) >>> 0, 1)
    beginVaTrace113c()
    AIBAAL_CloneThink_6FCD8460_113c(m, pGame, pBaalClone, pCloneParam)
    const cloneHits = endVaTrace113c()
    expect(cloneHits.has('D2Game:0x6FCD8460')).toBe(true)
    expect(cloneHits.has('D2Game:0x6FC40F00')).toBe(false)
  })

  it('regression [k2w12-b1 + 0x6FCC41B0]: 0x6FCF7E30 BeltsTxt+0x04, 0x6FCF8970 unswapped flags, 0x6FC74810 JM header+0x14, 0x6FCCA1D0+0x6FCC41B0 return value, canonical traced callees', () => {
    const { m, pGame, pInvTxtTable, pMonStatsTxt } = createWave14World(0)
    const { pPlayer, pInv, pRoom } = allocPlayer(m, pGame, 0x301, 2, 100, 100, 0)

    // 0x6FCF7E30: Belt index 2 has dwNumBoxes=4 at +0x04 (leave +0x0c = 0x99 to prove +0x04 is read, not +0x0c!)
    m.setU8((pInvTxtTable + 2 * 0x108 + 0x04) >>> 0, 4)
    m.setU8((pInvTxtTable + 2 * 0x108 + 0x0c) >>> 0, 0x99)
    beginVaTrace113c()
    ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c(m, 0, pPlayer, pGame)
    expect(endVaTrace113c().has('D2Game:0x6FCF7E30')).toBe(true)

    // 0x6FCF8970: unswapped command flag 0x20 / 0x4000 vs item flag 0x10
    const { pItem: pArmor } = allocItem(m, 3, 0x601, 0x20706163, 3)
    INVENTORY_PlaceItemInBodyLoc113c(m, pInv, pArmor, 3) // BODYLOC_TORSO
    ITEMS_SetOrClearCommandFlags113c(m, pArmor, 0x4000, 1)
    const pOutRes = m.alloc(4) >>> 0
    const unequipRes = ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c(
      m,
      pGame,
      pPlayer,
      3,
      1, // bToCursor=1 -> sets command flag 0x20 via ITEMS_SetOrClearCommandFlags113c
      pOutRes,
    )
    expect(unequipRes).toBe(1)
    expect((ITEMS_GetCommandFlags113c(m, pArmor) & 0x20) !== 0).toBe(true)
    expect((ITEMS_GetCommandFlags113c(m, pArmor) & 0x4000) === 0).toBe(true)
    expect((ITEMS_GetCommandFlags113c(m, pArmor) & 0x10) === 0).toBe(true)
    // Item flag 0x10 set via ITEMS_SetItemFlag113c (D2ItemDataStrc.dwItemFlags at pItemData+0x14)
    expect((m.u32((m.u32((pArmor + 0x14) >>> 0) + 0x14) >>> 0) & 0x10) !== 0).toBe(true)

    // 0x6FC74810: empty JM stream returns 0 and reads 4 bytes; invalid header returns 0x0e
    const pStream = m.alloc(0x40) >>> 0
    const pOutBytes = m.alloc(4) >>> 0
    m.setU16(pStream, 0x4d4a)
    m.setU16((pStream + 2) >>> 0, 0)
    expect(
      ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c(
        m,
        pStream,
        pGame,
        pPlayer,
        0x60,
        0x40,
        0,
        pOutBytes,
      ),
    ).toBe(0)
    expect(m.u32(pOutBytes)).toBe(4)
    m.setU16(pStream, 0x0000)
    expect(
      ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c(
        m,
        pStream,
        pGame,
        pPlayer,
        0x60,
        0x40,
        0,
        pOutBytes,
      ),
    ).toBe(0x0e)

    // 0x6FCCA1D0 + 0x6FCC41B0: AI_SetStateDirAndStartWalkMode_6FCC41B0_113c returns number (not void) and is traced by AI_Think_Raven
    const { pMon: pRaven, pAiGen: pRavenGen, pAiCtrl: pRavenCtrl } = allocMonster(
      m,
      pGame,
      419,
      0x302,
      2,
      105,
      100,
    )
    m.setU32((pRavenGen + 0x28) >>> 0, pGame)
    m.setU32((pRavenGen + 0x2c) >>> 0, 0x301)
    m.setU32((pRavenGen + 0x30) >>> 0, 0)
    m.setU32((pRavenCtrl + 0x14) >>> 0, 5) // nHitsLeft > 0 so Raven stays alive and walks around owner
    const pRavenRec = (pMonStatsTxt + 419 * 0x1a8) >>> 0
    m.setU16((pRavenRec + 0x56) >>> 0, 20) // max leash
    m.setU16((pRavenRec + 0x5c) >>> 0, 1) // min leash
    const pRavenArgs = m.alloc(0x30) >>> 0
    m.setU32(pRavenArgs, pRavenCtrl)
    m.setU32((pRavenArgs + 0x1c) >>> 0, pRavenRec)
    const walkRet = AI_SetStateDirAndStartWalkMode_6FCC41B0_113c(m, 5, 4, pRaven, pGame, pPlayer)
    expect(typeof walkRet).toBe('number')
    beginVaTrace113c()
    AI_Think_Raven_6FCCA1D0_113c(m, pGame, pRaven, pRavenArgs)
    const ravenHits = endVaTrace113c()
    expect(ravenHits.has('D2Game:0x6FCCA1D0')).toBe(true)
    expect(ravenHits.has('D2Game:0x6FCC41B0')).toBe(true)

    // 0x6FCE8950 & 0x6FC8BCB0: canonical D2Game:0x6FD01C00 traced (no private duplicate)
    const pTileObj = m.alloc(0x100) >>> 0
    const pTilePath = m.alloc(0x20) >>> 0
    m.setU32(pTilePath, pRoom)
    m.setU32(pTileObj, 2)
    m.setU32((pTileObj + 0x10) >>> 0, 0)
    m.setU32((pTileObj + 0x2c) >>> 0, pTilePath)
    const pRoomTile = m.alloc(0x100) >>> 0
    m.setU32(pRoomTile, 5) // UNIT_TILE
    m.setU32((pRoom + 0x74) >>> 0, pRoomTile)
    const pOpArgs = m.alloc(0x20) >>> 0
    m.setU32(pOpArgs, pGame)
    m.setU32((pOpArgs + 0x04) >>> 0, pTileObj)
    m.setU32((pOpArgs + 0x08) >>> 0, pPlayer)
    beginVaTrace113c()
    expect(() => ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c(m, pOpArgs)).toThrow(
      D2CommonAssertError,
    )
    const warpHits = endVaTrace113c()
    expect(warpHits.has('D2Game:0x6FCE8950')).toBe(true)
    expect(warpHits.has('D2Game:0x6FD01C00')).toBe(true)
  })

  it('exercises all 118 promoted Wave 14 VAs with concrete assertions and 100% live VA trace coverage', () => {
    const cumulativeHits = new Set<string>()

    // -------------------------------------------------------------------------
    // Shard 1: k2w7-b3 (33 eligible VAs)
    // -------------------------------------------------------------------------
    {
      const w = createWave14World(0)
      const { m, pGame, pQuestControl, pMonStatsTxt, pSkillsTxt, pSkillCode } = w
      const { pPlayer, pPlayerData, pRoom } = allocPlayer(m, pGame, 0x401, 2, 100, 100, 0)
      const { pPlayer: pPlayer2 } = allocPlayer(m, pGame, 0x402, 2, 105, 100, 0)
      const { pMon, pAiCtrl, pAiGen } = allocMonster(m, pGame, 5, 0x403, 2, 103, 100)
      m.setU32((pAiGen + 0x28) >>> 0, pGame)
      m.setU32((pAiGen + 0x2c) >>> 0, 0x401)
      m.setU32((pAiGen + 0x30) >>> 0, 0)

      // Pet table setup for 0x6FCB7640 & 0x6FCB7B50
      const pPetTable = m.alloc(0x20) >>> 0
      const pPetSlots = m.alloc(0x80) >>> 0
      m.setU32(pPetTable, pPetSlots)
      m.setU32((pPlayerData + 0x44) >>> 0, pPetTable)

      // Party setup for 0x6FCBC4F0 & 0x6FCBC7D0
      const pPartyCtrl = m.alloc(0x20) >>> 0
      const pSubParty = m.alloc(0x20) >>> 0
      m.setU16(pSubParty, 5)
      m.setU32((pPartyCtrl + 0x04) >>> 0, pSubParty)
      m.setU32((pGame + 0x1d2c) >>> 0, pPartyCtrl)

      // AI param setup
      const pAiParam = m.alloc(0x30) >>> 0
      m.setU32(pAiParam, pAiCtrl)
      m.setU32((pAiParam + 0x10) >>> 0, 4)
      m.setU32((pAiParam + 0x14) >>> 0, pPlayer)
      m.setU32((pAiParam + 0x1c) >>> 0, (pMonStatsTxt + 5 * 0x1a8) >>> 0)

      // Skill records for SrvDo120..135
      const off10 = writeRpnImm32(m, pSkillCode, 0x10, 10)
      for (const sid of [66, 72, 82, 87, 91, 120, 121, 122, 132, 134, 135]) {
        const pRec = (pSkillsTxt + sid * D2SkillsTxt_SIZE) >>> 0
        m.setU16((pRec + 0x82) >>> 0, 9)
        m.setU32((pRec + 0x60) >>> 0, off10)
        m.setU32((pRec + 0x64) >>> 0, off10)
      }

      // Quests for ACT4Q3, ACT4Q1 (0x16), ACT2Q6, ACT2Q5, ACT2Q3
      const { pQuest: qA4Q1 } = linkQuest(m, pGame, pQuestControl, 0x16, 0x19)
      const { pQuest: qA4Q3 } = linkQuest(m, pGame, pQuestControl, 0x18, 0x1a)
      const { pQuest: qA2Q3 } = linkQuest(m, pGame, pQuestControl, 0x0a, 0x0b)
      const { pQuest: qA2Q5 } = linkQuest(m, pGame, pQuestControl, 0x0c, 0x0d)
      linkQuest(m, pGame, pQuestControl, 0x0d, 0x0e)
      const pQuestArg = m.alloc(0x30) >>> 0
      m.setU32(pQuestArg, pGame)
      m.setU32((pQuestArg + 0x08) >>> 0, pMon)
      m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer)

      const pTownRoom = allocRoomWithLevel(m, 1)

      beginVaTrace113c()
      PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(m, pGame, pPlayer, 0x9999, 0)
      PETS_FreePlayerPetTable_6FCB7640_113c(m, pGame, pPlayer)
      expect(m.u32((pPlayerData + 0x44) >>> 0)).toBe(0)

      expect(SKILLS_SrvDo028_Conversion_6FCB9830_113c(m, pGame, pPlayer, 0x74, 1)).toBe(0)

      expect(PARTY_AddPlayerToSubParty_6FCBC4F0_113c(m, pGame, 5, pPlayer)).toBe(1)
      expect(PARTY_AddPlayerToSubParty_6FCBC4F0_113c(m, pGame, 5, pPlayer2)).toBe(1)
      PARTY_RemoveSubPartyById_6FCBC7D0_113c(m, pGame, 5)
      expect(m.u32((pPartyCtrl + 0x04) >>> 0)).toBe(0)

      expect(PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c(m, pPlayer, pGame, pTownRoom, 100, 100, 2, 0, 0x3b, 0)).toBe(0)
      expect(SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c(m, pGame, pPlayer, 1, 1)).toBe(0)
      expect(SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c(m, pGame, pPlayer, 1, 1)).toBe(0)
      expect(MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c(m, 0, pPlayer, pMon, pGame, 0, 0)).toBe(0)

      MONAI_SiegeMinionThinkA_6FCC5EB0_113c(m, pAiParam, pMon, pGame)
      MONAI_SiegeMinionThinkB_6FCC6050_113c(m, pAiParam, pGame, pMon)
      MONAI_SiegeMinionThinkC_6FCC62D0_113c(m, pAiParam, pMon, pGame)
      MONAI_WorldstoneMinionThink_6FCC7410_113c(m, pGame, pMon, pAiParam)
      MONAI_NihlathakThink_6FCC7580_113c(m, pGame, pMon, pAiParam)
      MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c(m, pGame, pMon, pAiParam)
      AIBAAL_CombatThink_6FCC9610_113c(m, pGame, pMon, pAiParam)

      expect(ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c(m, pGame, 0, 0)).toBe(0)
      expect(ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c(m, pGame, pPlayer, pMon, 0, 0, 0)).toBe(0)
      MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c(m, pGame, pMon)
      SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c(m, pGame, pMon, 120, 1)
      SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c(m, pGame, pMon, 121, 1)
      SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c(m, pGame, pMon, 122, 1)
      SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c(m, pGame, pMon, 132, 1)
      SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c(m, pGame, pMon, 134, 1)
      SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c(m, pGame, pMon, 135, 1)

      AIBAAL_CloneThink_6FCD8460_113c(m, pGame, pMon, pAiParam)
      AIBAAL_ThroneRoomThink_6FCD8610_113c(m, pGame, pMon, pAiParam)
      ACT4Q3_SeqCallback_6FCDA4F0_113c(m, qA4Q3)
      ACT4Q1_OnIzualKilled_6FCDABF0_113c(m, qA4Q1, pQuestArg)
      ACT2Q6_PropagatePartyCompletionCallback_6FCE65A0_113c(m, pGame, pPlayer, 0)
      ACT2Q5_OnSummonerKilled_6FCE66B0_113c(m, qA2Q5, pQuestArg)
      ACT2Q5_SeqCallback_6FCE69D0_113c(m, qA2Q5)
      ACT2Q3_StartEclipseEvent_6FCE6A30_113c(m, qA2Q3)
      expect(pRoom).not.toBe(0)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 2: k2w12-b1 (29 eligible VAs)
    // -------------------------------------------------------------------------
    {
      const w = createWave14World(0)
      const { m, pGame, pMonStatsTxt } = w
      const { pPlayer: pP1, pPlayerData: pPD1, pRoom } = allocPlayer(m, pGame, 0x501, 2, 100, 100, 0)
      const { pPlayer: pP2, pPlayerData: pPD2 } = allocPlayer(m, pGame, 0x502, 2, 104, 100, 0)
      const { pMon, pAiCtrl, pAiGen } = allocMonster(m, pGame, 5, 0x503, 2, 106, 100)
      m.setU32((pAiGen + 0x28) >>> 0, pGame)
      m.setU32((pAiGen + 0x2c) >>> 0, 0x501)
      m.setU32((pAiGen + 0x30) >>> 0, 0)
      const { pItem } = allocItem(m, 4, 0x504)
      m.setU32((pItem + 0x10) >>> 0, 6)

      const pStream = m.alloc(0x20) >>> 0
      const pOutBytes = m.alloc(4) >>> 0
      m.setU16(pStream, 0x4d4a)
      m.setU16((pStream + 2) >>> 0, 0)

      const pObj = m.alloc(0x100) >>> 0
      const pStaticPath = m.alloc(0x20) >>> 0
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x10) >>> 0, 3)
      m.setU32((pObj + 0x2c) >>> 0, pStaticPath)
      const pOpArgs = m.alloc(0x20) >>> 0
      m.setU32(pOpArgs, pGame)
      m.setU32((pOpArgs + 0x04) >>> 0, pObj)
      m.setU32((pOpArgs + 0x08) >>> 0, pP1)

      const pTrade = m.alloc(0x20) >>> 0
      m.setU32((pTrade + 0x04) >>> 0, pStream)
      m.setU32((pPD1 + 0x5c) >>> 0, pTrade)

      const pAiArgs = m.alloc(0x30) >>> 0
      m.setU32(pAiArgs, pAiCtrl)
      m.setU32((pAiArgs + 0x10) >>> 0, 4)
      m.setU32((pAiArgs + 0x14) >>> 0, pP1)
      m.setU32((pAiArgs + 0x1c) >>> 0, (pMonStatsTxt + 5 * 0x1a8) >>> 0)

      const pPkt23 = m.alloc(0x10) >>> 0
      const pOutUnequip = m.alloc(4) >>> 0
      const pQuestState = m.alloc(0x40) >>> 0

      beginVaTrace113c()
      expect(SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast_6FC2DBD0_113c(m, pGame, pMon, -1, 1)).toBe(0)
      expect(MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70_113c(m, pGame, pRoom, 1, 100, 100, 0, 0, -1)).toBe(0)
      expect(MONUMOD_SpawnPresetUniqueOrSuperUnique_6FC44E70_113c(m, pGame, pRoom, -1, 100, 100, -1, 0, 0, 0, 0, 0)).toBe(0)
      m.setU8((pGame + 0x6d) >>> 0, 3)
      expect(MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c(m, pGame, pRoom, 100, 100, 1)).toBe(0)
      m.setU8((pGame + 0x6d) >>> 0, 0)
      expect(MONSTER_SpawnUniqueBossWithChampionMinionPack_6FC679B0_113c(m, 0, pRoom, pGame, -1)).toBe(0)
      HIRELING_AssignMercenaryToPlayer_6FC68FC0_113c(m, pGame, 0, pMon, 0, 0, 0)
      expect(SKILLS_SrvDo_MonsterConvert_6FC71340_113c(m, pGame, pP1, 0, 1)).toBe(0)
      expect(ITEMS_PlaceLoadedPlayerOrMercItem_6FC74420_113c(m, pItem, 0, pGame, pP1)).toBe(0x0d)
      expect(ITEMS_PlaceLoadedPlayerItemWithSync_6FC745D0_113c(m, 0, pItem, pP1, pGame)).toBe(0x0c)
      expect(ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c(m, pStream, pGame, pP1, 0x60, 0x20, 0, pOutBytes)).toBe(0)

      expect(OBJ_OperateFn_DungeonStairOrTileWarp_6FC8BCB0_113c(m, pOpArgs)).toBe(1)
      expect(OBJ_OperateFn_FindPairedObjectAndTeleportPad_6FC8BE40_113c(m, pOpArgs)).toBe(0)
      expect(OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c(m, pOpArgs)).toBe(1)
      m.setU32((pObj + 0x10) >>> 0, 2)
      expect(OBJ_OperateFn_SparklyChestOrTrapSpawner_6FC8EDB0_113c(m, pOpArgs)).toBe(1)

      PLRTRADE_RestorePlayerInventoryAndGoldFromSnapshot_6FC915E0_113c(m, pP1, pGame)
      m.setU32((pPD1 + 0x5c) >>> 0, 0)
      PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c(m, pGame, pP1)
      PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(m, pGame, pP1, pP2, pPD1, pPD2, 0)
      PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c(m, pItem, pGame, pP1)

      AI_Think_SandMaggot_6FCA9870_113c(m, pGame, pMon, pAiArgs)
      AI_Think_BurrowingScarabOrFrog_6FCA9C30_113c(m, pGame, pMon, pAiArgs)
      const pArena = m.alloc(0x20) >>> 0
      m.setU32((pGame + 0x1d28) >>> 0, pArena)
      m.setU8((pArena + 0x08) >>> 0, 2)
      PLAYER_ChangeLevelOrActTransition_6FCBE170_113c(m, pP1, 41, pGame, 0)
      AI_Think_ShadowWarriorAndMaster_6FCC9E80_113c(m, pGame, pMon, pAiArgs)
      AI_Think_Raven_6FCCA1D0_113c(m, pGame, pMon, pAiArgs)

      m.setU32(pStaticPath, pRoom)
      ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c(m, pOpArgs)
      expect(C2S_Packet23_MercReviveHandler_6FCEFB90_113c(m, pGame, pP1, pPkt23, 5)).toBe(0)
      ITEMS_ClearInvalidRunewordOnItem_6FCF3280_113c(m, pItem, pP1, pGame)
      ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c(m, 0, pP1, pGame)
      expect(ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c(m, pGame, pP1, 3, 0, pOutUnequip)).toBe(0)
      ACT1Q4_SpawnSmithBossInBarracks_6FD08780_113c(m, pQuestState, pRoom, pGame)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 3: k2w3-b6 (28 eligible VAs)
    // -------------------------------------------------------------------------
    {
      const w = createWave14World(0)
      const { m, pGame, pQuestControl } = w
      const { pPlayer, pQuestFlags, pRoom } = allocPlayer(m, pGame, 0x601, 1, 100, 100, 0)
      const { pMon } = allocMonster(m, pGame, 10, 0x602, 1, 102, 100)

      const { pQuest: q1 } = linkQuest(m, pGame, pQuestControl, 1, 1)
      const { pQuest: q2 } = linkQuest(m, pGame, pQuestControl, 2, 2)
      const { pQuest: q3 } = linkQuest(m, pGame, pQuestControl, 3, 3)
      const { pQuest: q4, pQuestEx: q4Ex } = linkQuest(m, pGame, pQuestControl, 4, 4)
      const { pQuest: q5, pQuestEx: q5Ex } = linkQuest(m, pGame, pQuestControl, 5, 5)
      const { pQuest: q6 } = linkQuest(m, pGame, pQuestControl, 6, 6)
      const { pQuest: q20, pQuestEx: q20Ex } = linkQuest(m, pGame, pQuestControl, 0x20, 0x20)
      const { pQuest: q21, pQuestEx: q21Ex } = linkQuest(m, pGame, pQuestControl, 0x21, 0x21)
      const { pQuest: q23, pQuestEx: q23Ex } = linkQuest(m, pGame, pQuestControl, 0x23, 0x23)

      const pObj = m.alloc(0x100) >>> 0
      const pObjData = m.alloc(0x40) >>> 0
      m.setU32(pObjData, m.alloc(0x200) >>> 0)
      const pObjPath = m.alloc(0x20) >>> 0
      m.setU32(pObjPath, pRoom)
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x0c) >>> 0, 0x603)
      m.setU32((pObj + 0x10) >>> 0, 1)
      m.setU32((pObj + 0x14) >>> 0, pObjData)
      m.setU32((pObj + 0x2c) >>> 0, pObjPath)
      const pObjInit = m.alloc(0x20) >>> 0
      m.setU32(pObjInit, pGame)
      m.setU32((pObjInit + 0x04) >>> 0, pObj)

      const pQuestArg = m.alloc(0x30) >>> 0
      m.setU32(pQuestArg, pGame)
      m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer)

      m.setU32((q20Ex + 0xec) >>> 0, 0x603)
      m.setU8((q21Ex + 0xa4) >>> 0, 1)
      const pGuidList = m.alloc(0x100) >>> 0
      QUESTS_GuidListAdd113c(m, pGuidList, 0x601)

      for (let i = 0; i < 3; i++) {
        const statueGuid = 0x620 + i
        const pStatue = m.alloc(0x100) >>> 0
        const pStatueData = m.alloc(0x40) >>> 0
        m.setU32(pStatueData, m.alloc(0x200) >>> 0)
        const pStatuePath = m.alloc(0x20) >>> 0
        m.setU32(pStatuePath, pRoom)
        m.setU32(pStatue, 2)
        m.setU32((pStatue + 0x0c) >>> 0, statueGuid)
        m.setU32((pStatue + 0x14) >>> 0, pStatueData)
        m.setU32((pStatue + 0x2c) >>> 0, pStatuePath)
        m.setU32((pGame + 0x1520 + (statueGuid & 0x7f) * 4) >>> 0, pStatue)
        m.setU32((q23Ex + 0x14 + i * 4) >>> 0, statueGuid)
      }

      beginVaTrace113c()
      expect(ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c(m, pGame, 0x602)).toBe(1)
      expect(ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c(m, q23, q23Ex)).toBe(1)
      expect(ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c(m, pGame, q23)).toBe(1)
      ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c(m, q21, pObj)
      ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c(m, pObjInit)
      ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c(m, pGame, pMon)
      ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c(m, q20, pObj)
      expect(ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c(m, q5Ex, 0, 0x999)).toBe(0)
      ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c(m, pGame, pPlayer, 0)
      ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c(m, pGame, pPlayer, 0)
      ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c(m, q5, pQuestArg)
      ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c(m, pGame, pPlayer, 0)
      ACT1Q4_SpawnTristramPortalObject_6FC81340_113c(m, pGame, pObj)
      ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c(m, pGame, pPlayer, 0)
      ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c(m, pGame, pPlayer, 0)
      ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c(m, pGame, pPlayer, 0)
      ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c(m, pGame, pPlayer, 0)
      ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c(m, pGame, pPlayer, 0)
      ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c(m, pGame, pPlayer, 0)
      ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c(m, pGame, pPlayer, 0)
      ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c(m, pPlayer, pQuestFlags, pGame)
      ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c(m, pGame, pPlayer, 0)
      ACT1Q4_InitInifussTreeObject_6FC828D0_113c(m, pObjInit)
      ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c(m, pGame, pPlayer, 0)
      ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c(m, pGame, pPlayer, 0)
      QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c(m, pGame, pGuidList, 1, 0)
      ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c(m, pGame, pPlayer, 0)
      ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c(m, pGame)
      expect(q1 !== 0 && q2 !== 0 && q3 !== 0 && q4 !== 0 && q4Ex !== 0 && q6 !== 0).toBe(true)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 4: k2w5-b4 (28 eligible VAs)
    // -------------------------------------------------------------------------
    {
      const w = createWave14World(0)
      const { m, pGame, pQuestControl, pNpcSlots } = w
      const { pPlayer, pQuestFlags, pRoom } = allocPlayer(m, pGame, 0x701, 58, 100, 100, 0)
      const pNpc = m.alloc(0x100) >>> 0
      const pNpcInv = m.alloc(0x40) >>> 0
      m.setU32(pNpcInv, INVENTORY_SIGNATURE_113C)
      m.setU32(pNpc, 1)
      m.setU32((pNpc + 0x04) >>> 0, 177)
      m.setU32((pNpc + 0x14) >>> 0, m.alloc(0x60) >>> 0)
      m.setU32((pNpc + 0x60) >>> 0, pNpcInv)
      const { pItem: pStoreItem } = allocItem(m, 1, 0x702, 0x20347068, 0x2b)
      const pEmptyInv = m.alloc(0x40) >>> 0
      m.setU32(pEmptyInv, INVENTORY_SIGNATURE_113C)
      const pbChanged = m.alloc(4) >>> 0
      const pSlot = m.alloc(0x44) >>> 0

      const { pQuest: q09 } = linkQuest(m, pGame, pQuestControl, 9, 0x0a)
      const { pQuest: q0a, pQuestEx: q0aEx } = linkQuest(m, pGame, pQuestControl, 0x0a, 0x0b)
      const { pQuest: q0b, pQuestEx: q0bEx } = linkQuest(m, pGame, pQuestControl, 0x0b, 0x0c)
      const { pQuest: q0c, pQuestEx: q0cEx } = linkQuest(m, pGame, pQuestControl, 0x0c, 0x0d)
      const { pQuest: q0d, pQuestEx: q0dEx } = linkQuest(m, pGame, pQuestControl, 0x0d, 0x0e)
      for (let i = 0; i < 7; i++) m.setU32((D2GAME_TAL_RASHA_TOMB_OBJECTS_VA_113C + i * 4) >>> 0, 300 + i)
      const pAct2 = m.u32((pGame + 0xc0) >>> 0) >>> 0
      m.setU32((m.u32((pAct2 + 0x48) >>> 0) + 0x94) >>> 0, 0x44)

      const pPortalObj = m.alloc(0x100) >>> 0
      const pPortalPath = m.alloc(0x20) >>> 0
      m.setU32(pPortalPath, pRoom)
      m.setU32(pPortalObj, 2)
      m.setU32((pPortalObj + 0x0c) >>> 0, 0x703)
      m.setU32((pPortalObj + 0x2c) >>> 0, pPortalPath)
      const pOpData = m.alloc(0x10) >>> 0
      m.setU32(pOpData, pGame)
      m.setU32((pOpData + 0x04) >>> 0, pPortalObj)

      const pOutStatus = m.alloc(4) >>> 0
      const pQuestArg = m.alloc(0x30) >>> 0
      m.setU32(pQuestArg, pGame)
      m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer)

      STATLIST_SetUnitStat113c(m, pPlayer, 6, 100, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 7, 500, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 0x0e, 300, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 0x0f, 1000, 0)
      m.setU32(pNpcSlots, 177)
      m.setU32((q0cEx + 0x04) >>> 0, pRoom)
      m.setU32((q0bEx + 0x20) >>> 0, 102)
      m.setU32((q0bEx + 0x24) >>> 0, 102)
      m.setU32((q0aEx + 0x98) >>> 0, 58)
      m.setU8((q0a + 0x0c) >>> 0, 2)
      m.setU8((q0b + 0x0c) >>> 0, 2)
      m.setU8((q0c + 0x0c) >>> 0, 1)

      beginVaTrace113c()
      expect(NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c(m, pPlayer, pGame, pNpc, pStoreItem, 0)).toBe(0)
      expect(NPC_RefreshInventoryItemStatLists_6FCDCA20_113c(m, pPlayer)).toBe(1)
      expect(NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c(m, pNpc, pGame, pStoreItem)).toBe(0)
      NPC_ClearPlayerInteractState_6FCDCB90_113c(m, pNpc, pPlayer, pGame)
      NPC_HealAndCureUnit_6FCDCBE0_113c(m, pPlayer, pbChanged)
      expect(m.u8(pbChanged)).toBe(1)
      expect(STATLIST_GetUnitStat113c(m, pPlayer, 6, 0)).toBe(500)
      expect(NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayer, 500)).toBe(1)
      expect(STATLIST_GetUnitStat113c(m, pPlayer, 0x0f, 0)).toBe(800)
      NPC_TransferInventoryItemsToOwner_6FCDCD90_113c(m, pEmptyInv, pPlayer)
      NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c(m, pStoreItem, pNpc, 1)
      NPC_InitHirelingVendorRoster_6FCDCED0_113c(m, pSlot, pGame, 198)
      expect(m.u8((pSlot + 0x21) >>> 0)).toBe(1)
      expect(NPC_RollStoreItemUpgrade_6FCDD040_113c(m, 50, pGame, 1, 100, 50)).toBe(1)
      QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c(m, pPlayer, 5, 1)

      ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c(m, q0d, 0)
      expect(ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c(m, q0d)).toBe(300)
      expect(ACT2Q6_StatusFilter_6FCE1D30_113c(m, q0d, pPlayer, 0, pQuestFlags, pOutStatus)).toBe(1)
      ACT2Q5_InitArcanePortalObject_6FCE2850_113c(m, pOpData)
      expect(m.u32((q0dEx + 0x28) >>> 0)).toBe(0x703)
      ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c(m, pGame, pPlayer, 0)
      ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c(m, pGame, pPlayer, 0)
      expect(ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c(m, pGame, pPlayer, 0)).toBe(0)
      expect(ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c(m, pGame, pPlayer, 0)).toBe(0)
      expect(ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c(m, pGame, pPlayer, 0)).toBe(1)
      ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c(m, pGame, pPlayer, 0)
      expect(ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c(m, pGame, pPlayer, 0)).toBe(0)
      expect(ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c(m, pGame, pPlayer, 0)).toBe(0)
      expect(ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c(m, pGame, pPlayer, 0)).toBe(0)
      expect(ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c(m, pGame, pPlayer, 0)).toBe(0)
      ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c(m, pGame, pPlayer, 0)
      ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c(m, q09, pQuestArg)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 7, 0)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0a, 3)
      expect(ACT2Q2_StatusFilter_6FCE3BD0_113c(m, q09, pPlayer, 0, pQuestFlags, pOutStatus)).toBe(1)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    const missingVas = WAVE14_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
