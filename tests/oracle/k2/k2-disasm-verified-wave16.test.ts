/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 16: +82 VAs).
 *
 * Audits and verifies 82 `D2Game.dll` (`0x6FC20000`) closure functions across 4 shards:
 * - `k2-remed-r2` (`src/d2kern-113c/game/k2-w4b4-113c.ts`, `src/d2kern-113c/game/k2-w15b1-113c.ts`,
 *   31 eligible; 8 `indirectUnknown` VAs kept `ported`)
 * - `k2w4-b4` (`src/d2kern-113c/game/k2-w4b4-113c.ts`, 20 eligible; 0 `indirectUnknown`)
 * - `k2-remed-r1` (`src/d2kern-113c/game/k2-w14b1-113c.ts`, 29 eligible; 6 `indirectUnknown` VAs kept `ported`)
 * - `k2w14-b1` (`src/d2kern-113c/game/k2-w14b1-113c.ts`, 2 eligible; 0 `indirectUnknown`)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`,
 *    plus manifest promotion & `indirectUnknown` guardrails for all 14 skipped VAs.
 * 2. Dedicated behavioral differential regression tests for every real 1.13c binary discrepancy
 *    fixed across `k2-w4b4-113c.ts`, `k2-w15b1-113c.ts`, and `k2-w14b1-113c.ts` (including the
 *    11-function `SKILLS_ResolveSummonMonsterId_6FCBEE50_113c` `pOutMode` class-of-bug sweep).
 * 3. Multi-branch `SparseMemory113c` concrete state assertions + 100% (`82 / 82`) live
 *    `beginVaTrace113c()` / `endVaTrace113c()` execution coverage.
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  SGPT_CUBEMAIN_RECS_VA,
  SGPT_CUBEMAIN_TXT_VA,
} from '../../../src/d2kern-113c/common/drlg/drlg-ver.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  D2COMMON_CHAR_INV_REC_COUNT_VA_113C,
  D2COMMON_CHAR_INV_REC_TABLE_VA_113C,
  D2COMMON_GRID0_INFO_VA_113C,
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  G_INVENTORY_TXT_TABLE_VA_113C,
  INVENTORY_AllocInventory113c,
  INVENTORY_GetLeftItemGuid113c,
  INVENTORY_PlaceItemInBodyLoc113c,
  INVENTORY_SetCursorItem113c,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_InsertSubList113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  ACT2Q2_CleanupHoradricStaffItemsOnEnterAct1_6FCE7D00_113c,
  ACT3Q2_OperateGidbinnAltar_6FD09C80_113c,
  ACT3Q3_CleanupKhalimItemsOnEnterAct2OrComplete_6FD087E0_113c,
  ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c,
  ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c,
  AI_MercOrShadowWarriorThink_6FCCC8E0_113c,
  C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c,
  C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c,
  C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c,
  C2S_Packet32_NpcBuyItem_6FCEF570_113c,
  C2S_Packet49_WaypointInteract_6FCF0D30_113c,
  C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c,
  CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c,
  ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c,
  MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c,
  NPCTRADE_EnsureVendorInventoryGenerated_6FCDF1C0_113c,
  NPCTRADE_InteractBuyItem_6FCDF200_113c,
  NPCTRADE_InteractRepairItem_6FCE1890_113c,
  NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c,
  PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c,
  PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c,
  SKILLS_SpawnBoneWallSegment_6FC70E60_113c,
  SKILLS_SrvDo_BoneWall_6FC70FE0_113c,
  SKILLS_SrvDo_IronGolem_6FC71540_113c,
  SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c,
  SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c,
  SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c,
  SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c,
  SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c,
  SKILLS_SrvDo_Valkyrie_6FCB5980_113c,
  SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c.ts'
import {
  ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c,
  ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c,
  ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c,
  ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c,
  C2S_Packet_DropCursorItem_6FCEF380_113c,
  C2S_Packet_HireMercenary_6FCF0060_113c,
  C2S_Packet_NpcBuyItem_6FCEF220_113c,
  CLIENT_NotifyAndDisconnectClient_6FC4D090_113c,
  D2GAME_SCRATCH_W15B1_113C,
  ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c,
  NPCS_BeginVendorOrGambleInteract_6FCDF730_113c,
  OBJ_OperateDuranceStairs_6FC8CD40_113c,
  PLAYER_CreateCorpseOnDeath_6FC99210_113c,
  PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c,
  SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c,
  SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c,
  SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c.ts'
import {
  ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c,
  ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c,
  AI_SelectHostileTargetByMetrics_6FCA4720_113c,
  AI_ThinkBurrowerSpawner_6FCA77B0_113c,
  AI_ThinkChargerRunOrAttack_6FCA2EC0_113c,
  AI_ThinkDualAttackMelee_6FCA3AC0_113c,
  AI_ThinkMeleeBasic_6FCA1F50_113c,
  AI_ThinkMonsterSpawnerNest_6FCA7A60_113c,
  AI_ThinkPackFollowerMelee_6FCA4800_113c,
  AI_ThinkSimpleMeleeVariantA_6FCA2430_113c,
  AI_ThinkSimpleMeleeVariantB_6FCA2570_113c,
  AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c,
  ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c,
  ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c,
  MONSTER_SpawnChampionPackMembers_6FC67880_113c,
  MONSTER_TickPathStepAndAnim_6FC96A10_113c,
  MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c,
  NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c,
  NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c,
  NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c,
  NET_SendPacket26_ChatMessage_6FCAB470_113c,
  NET_SendPacket8B_GameHandshake_6FCAC420_113c,
  OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c,
  OBJ_OperateAuraStatShrine_6FC8ABB0_113c,
  OBJ_OperateCombatShrine_6FC8ACE0_113c,
  OBJ_OperateStaminaShrine_6FC8AC30_113c,
  OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c,
  OBJ_OperateTomeOrScrollStand_6FC8B340_113c,
  OBJ_OperateWirtsBody_6FC8D960_113c,
  OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c,
  PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c,
  PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c,
  PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c,
  PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c,
  STORM_TSListArraySetCount_6FC22510_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2AiCmdStrc,
  D2CubemainTxt_SIZE,
  D2HirelingTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2RoomExStrc,
  D2SkillsTxt_SIZE,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_INVENTORY_TXT_MAX_VA,
  SGPT_INVENTORY_TXT_PTR_VA,
  SGPT_ITEMS_LINKER_PTR_VA,
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
  readonly batch: 'k2-remed-r2' | 'k2w4-b4' | 'k2-remed-r1' | 'k2w14-b1'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE16_INDIRECT_UNKNOWN_SKIPPED: readonly string[] = [
  '0x6FC56890', // k2-remed-r2: QUESTS_OnBossActChangeOrBossKill_6FC56890_113c
  '0x6FC89970', // k2-remed-r2: OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c
  '0x6FCE8050', // k2-remed-r2: ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c
  '0x6FD089A0', // k2-remed-r2: ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c
  '0x6FD08B60', // k2-remed-r2: ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c
  '0x6FD08FE0', // k2-remed-r2: ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c
  '0x6FD09600', // k2-remed-r2: ACT3Q2_OnNpcSpeechComplete_6FD09600_113c
  '0x6FD0A140', // k2-remed-r2: ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c
  '0x6FC6B7F0', // k2-remed-r1: CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c
  '0x6FC7C9E0', // k2-remed-r1: ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c
  '0x6FC86CE0', // k2-remed-r1: ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c
  '0x6FC87000', // k2-remed-r1: ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c
  '0x6FC88920', // k2-remed-r1: ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c
  '0x6FCDAA50', // k2-remed-r1: ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c
]

const WAVE16_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  { batch: 'k2-remed-r2', va: '0x6FC44B70', size: 119, headHex: '56578bf885ff8bf1', tailHex: '4f5c015f5ec3', tsSymbol: 'MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC4D090', size: 174, headHex: '83ec2885f6558b6c', tailHex: '83c428c20800', tsSymbol: 'CLIENT_NotifyAndDisconnectClient_6FC4D090_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC4F4B0', size: 199, headHex: '558bec83e4f883ec', tailHex: '8be55dc20400', tsSymbol: 'OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC58180', size: 538, headHex: '83ec105355576a00', tailHex: '83c410c20800', tsSymbol: 'PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC67880', size: 124, headHex: '5185f674738b0683', tailHex: 'd95d59c20400', tsSymbol: 'MONSTER_SpawnChampionPackMembers_6FC67880_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC71E70', size: 392, headHex: '83ec105355568d44', tailHex: '83c410c20800', tsSymbol: 'SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC7CC30', size: 60, headHex: '8b81f410000085c0', tailHex: 'e825faffffc3', tsSymbol: 'ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC7CD50', size: 533, headHex: '83ec0c5355578bf9', tailHex: 'e8d85afaffcc', tsSymbol: 'ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC864F0', size: 1136, headHex: '558bec83e4f883ec', tailHex: '5d5b8be55dc3', tsSymbol: 'ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC88E20', size: 214, headHex: '558b6c2408568b75', tailHex: '5f5e5dc20800', tsSymbol: 'ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC8ABB0', size: 127, headHex: '510fb602558be93b', tailHex: 'ffff5f5d59c3', tsSymbol: 'OBJ_OperateAuraStatShrine_6FC8ABB0_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC8AC30', size: 175, headHex: '51538bda0fb60357', tailHex: '5e5d5f5b59c3', tsSymbol: 'OBJ_OperateStaminaShrine_6FC8AC30_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC8ACE0', size: 128, headHex: '5155578bfa0fb607', tailHex: '5e5b5f5d59c3', tsSymbol: 'OBJ_OperateCombatShrine_6FC8ACE0_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC8B340', size: 239, headHex: '83ec0c568bf18b46', tailHex: '005e83c40cc3', tsSymbol: 'OBJ_OperateTomeOrScrollStand_6FC8B340_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC8CD40', size: 202, headHex: '51538bd98b430457', tailHex: '5f33c05b59c3', tsSymbol: 'OBJ_OperateDuranceStairs_6FC8CD40_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC8D960', size: 159, headHex: '51568bf18b460485', tailHex: '0000005e59c3', tsSymbol: 'OBJ_OperateWirtsBody_6FC8D960_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC8DBF0', size: 365, headHex: '83ec0c568bf08b46', tailHex: '5f5e83c40cc3', tsSymbol: 'OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC934E0', size: 64, headHex: '0fb7c983e9177411', tailHex: '100600c20400', tsSymbol: 'PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC98C50', size: 168, headHex: '83ec0885ff568bf0', tailHex: '83c408c20400', tsSymbol: 'ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c' },
  { batch: 'k2-remed-r2', va: '0x6FC99210', size: 1299, headHex: '83ec1853558b6c24', tailHex: 'e81a93f8ffcc', tsSymbol: 'PLAYER_CreateCorpseOnDeath_6FC99210_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCA2430', size: 310, headHex: '83ec208b44242453', tailHex: '83c420c20400', tsSymbol: 'AI_ThinkSimpleMeleeVariantA_6FCA2430_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCA2570', size: 310, headHex: '83ec208b44242453', tailHex: '83c420c20400', tsSymbol: 'AI_ThinkSimpleMeleeVariantB_6FCA2570_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCB6280', size: 141, headHex: '83ec085556578b7c', tailHex: '83c408c20800', tsSymbol: 'SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCB6310', size: 402, headHex: '83ec28558b6c2430', tailHex: '83c428c20800', tsSymbol: 'SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCDAF20', size: 193, headHex: '5356578bf2568bd9', tailHex: '5f5e5bc20400', tsSymbol: 'ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCDF730', size: 209, headHex: '538b5c241085db55', tailHex: '5e5d5bc21000', tsSymbol: 'NPCS_BeginVendorOrGambleInteract_6FCDF730_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCE9CB0', size: 537, headHex: '53558b6c240c5657', tailHex: '5e5d5bc20800', tsSymbol: 'ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCEF220', size: 75, headHex: '837c240811568bf2', tailHex: '5d5b5ec20800', tsSymbol: 'C2S_Packet_NpcBuyItem_6FCEF220_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCEF380', size: 127, headHex: '837c24080553568b', tailHex: '5f5e5bc20800', tsSymbol: 'C2S_Packet_DropCursorItem_6FCEF380_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCF0060', size: 49, headHex: '8bc1837c24080974', tailHex: '33c05bc20800', tsSymbol: 'C2S_Packet_HireMercenary_6FCF0060_113c' },
  { batch: 'k2-remed-r2', va: '0x6FCF8440', size: 446, headHex: '81ec8c0000005355', tailHex: '000000c20800', tsSymbol: 'ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c' },
  { batch: 'k2w4-b4', va: '0x6FC22510', size: 143, headHex: '5355568bf08b4604', tailHex: '7e045e5d5bc3', tsSymbol: 'STORM_TSListArraySetCount_6FC22510_113c' },
  { batch: 'k2w4-b4', va: '0x6FC309B0', size: 112, headHex: '53558b6c240c578b', tailHex: '5f5d5bc20400', tsSymbol: 'ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c' },
  { batch: 'k2w4-b4', va: '0x6FC8DD60', size: 158, headHex: 'a1b47bd26f560fb6', tailHex: '07005ec20400', tsSymbol: 'OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c' },
  { batch: 'k2w4-b4', va: '0x6FC90FB0', size: 171, headHex: '5553e80995f9ff8b', tailHex: '5dc332c05dc3', tsSymbol: 'PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c' },
  { batch: 'k2w4-b4', va: '0x6FC93860', size: 567, headHex: '83ec0c535556578b', tailHex: '83c40cc20400', tsSymbol: 'PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c' },
  { batch: 'k2w4-b4', va: '0x6FC96A10', size: 54, headHex: '568bf2578bf98bc6', tailHex: '010000005ec3', tsSymbol: 'MONSTER_TickPathStepAndAnim_6FC96A10_113c' },
  { batch: 'k2w4-b4', va: '0x6FC9CE40', size: 201, headHex: '535556578bf98b4c', tailHex: '5e5d5bc20400', tsSymbol: 'AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c' },
  { batch: 'k2w4-b4', va: '0x6FCA1F50', size: 370, headHex: '83ec088b44240c53', tailHex: '83c408c20400', tsSymbol: 'AI_ThinkMeleeBasic_6FCA1F50_113c' },
  { batch: 'k2w4-b4', va: '0x6FCA2EC0', size: 623, headHex: '83ec2c8b44243053', tailHex: '83c42cc20400', tsSymbol: 'AI_ThinkChargerRunOrAttack_6FCA2EC0_113c' },
  { batch: 'k2w4-b4', va: '0x6FCA3AC0', size: 535, headHex: '83ec288b44242c53', tailHex: '83c428c20400', tsSymbol: 'AI_ThinkDualAttackMelee_6FCA3AC0_113c' },
  { batch: 'k2w4-b4', va: '0x6FCA4720', size: 220, headHex: '83ec2833c0890424', tailHex: '83c428c20400', tsSymbol: 'AI_SelectHostileTargetByMetrics_6FCA4720_113c' },
  { batch: 'k2w4-b4', va: '0x6FCA4800', size: 655, headHex: '83ec288b44242c53', tailHex: '83c428c20400', tsSymbol: 'AI_ThinkPackFollowerMelee_6FCA4800_113c' },
  { batch: 'k2w4-b4', va: '0x6FCA77B0', size: 674, headHex: '83ec348b44243853', tailHex: '83c434c20400', tsSymbol: 'AI_ThinkBurrowerSpawner_6FCA77B0_113c' },
  { batch: 'k2w4-b4', va: '0x6FCA7A60', size: 333, headHex: '83ec148b44241853', tailHex: '83c414c20400', tsSymbol: 'AI_ThinkMonsterSpawnerNest_6FCA7A60_113c' },
  { batch: 'k2w4-b4', va: '0x6FCAA2A0', size: 112, headHex: '518b82bc03000085', tailHex: '5f89065e59c3', tsSymbol: 'NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c' },
  { batch: 'k2w4-b4', va: '0x6FCAB470', size: 198, headHex: '81ec1c0100005657', tailHex: '010000c20400', tsSymbol: 'NET_SendPacket26_ChatMessage_6FCAB470_113c' },
  { batch: 'k2w4-b4', va: '0x6FCAC280', size: 115, headHex: '83ec103c06880c24', tailHex: '83c410c21800', tsSymbol: 'NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c' },
  { batch: 'k2w4-b4', va: '0x6FCAC420', size: 107, headHex: '83ec08880c248b88', tailHex: '83c408c20400', tsSymbol: 'NET_SendPacket8B_GameHandshake_6FCAC420_113c' },
  { batch: 'k2w4-b4', va: '0x6FCAC910', size: 264, headHex: '558b6c2408568bf0', tailHex: '33c05dc20c00', tsSymbol: 'NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c' },
  { batch: 'k2w4-b4', va: '0x6FCACFB0', size: 88, headHex: '83ec0885c0c60424', tailHex: '83c408c20400', tsSymbol: 'PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC566C0', size: 352, headHex: '535557568bd8e8f5', tailHex: '5f5d5bc20800', tsSymbol: 'ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC60EB0', size: 603, headHex: '83ec3c558bea85ed', tailHex: '005d83c43cc3', tsSymbol: 'MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC63D40', size: 598, headHex: '83ec485355568b74', tailHex: '83c448c20800', tsSymbol: 'SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC66560', size: 433, headHex: '83ec3c5556578b7c', tailHex: '83c43cc20800', tsSymbol: 'SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC66720', size: 384, headHex: '83ec2c5556578b7c', tailHex: '83c42cc20800', tsSymbol: 'SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC668A0', size: 383, headHex: '83ec28538b5c2430', tailHex: '83c428c20800', tsSymbol: 'SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC6D8C0', size: 500, headHex: '8b44240483ec2c85', tailHex: '83c42cc20800', tsSymbol: 'SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC70E60', size: 376, headHex: '83ec3053558b6c24', tailHex: '83c430c21000', tsSymbol: 'SKILLS_SpawnBoneWallSegment_6FC70E60_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC70FE0', size: 853, headHex: '81ec980000005355', tailHex: '000000c20800', tsSymbol: 'SKILLS_SrvDo_BoneWall_6FC70FE0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC71540', size: 518, headHex: '8b44240883ec3053', tailHex: '83c430c20800', tsSymbol: 'SKILLS_SrvDo_IronGolem_6FC71540_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC92FC0', size: 1249, headHex: '83ec4c558b6c2458', tailHex: '83c44cc20800', tsSymbol: 'CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC93D90', size: 1126, headHex: '5153558b6c241456', tailHex: '5d5b59c20c00', tsSymbol: 'PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c' },
  { batch: 'k2-remed-r1', va: '0x6FC98FA0', size: 343, headHex: '83ec1c5355568bf0', tailHex: 'e84699f8ffcc', tsSymbol: 'PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCB5980', size: 576, headHex: '83ec34535556578b', tailHex: '83c434c20800', tsSymbol: 'SKILLS_SrvDo_Valkyrie_6FCB5980_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCB5D50', size: 641, headHex: '83ec50538b5c2468', tailHex: '83c450c21800', tsSymbol: 'SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCDB550', size: 336, headHex: '83ec0856578bf98b', tailHex: 'c05e83c408c3', tsSymbol: 'ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCDF1C0', size: 56, headHex: '85c95657750583cf', tailHex: 'ff5f5ec20800', tsSymbol: 'NPCTRADE_EnsureVendorInventoryGenerated_6FCDF1C0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCDF200', size: 214, headHex: '83ec10578bf885ff', tailHex: '83c410c21400', tsSymbol: 'NPCTRADE_InteractBuyItem_6FCDF200_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCDF2E0', size: 877, headHex: '83ec2053558b6c24', tailHex: 'e8f033f4ffcc', tsSymbol: 'NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCE1890', size: 199, headHex: '8a4e6c8b566483ec', tailHex: '83c410c20400', tsSymbol: 'NPCTRADE_InteractRepairItem_6FCE1890_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCE7D00', size: 192, headHex: '5356578bf2568bd9', tailHex: '5f5e5bc20400', tsSymbol: 'ACT2Q2_CleanupHoradricStaffItemsOnEnterAct1_6FCE7D00_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCEF270', size: 117, headHex: '837c24080956578b', tailHex: '5b5f5ec20800', tsSymbol: 'C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCEF2F0', size: 140, headHex: '837c24080955578b', tailHex: '5b5f5dc20800', tsSymbol: 'C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCEF570', size: 56, headHex: '837c2408117408b8', tailHex: '5f5e5bc20800', tsSymbol: 'C2S_Packet32_NpcBuyItem_6FCEF570_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCF0D30', size: 337, headHex: '51837c240c09568b', tailHex: 'c05e59c20800', tsSymbol: 'C2S_Packet49_WaypointInteract_6FCF0D30_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCF1010', size: 297, headHex: '51837c240c115356', tailHex: '5e5b59c20800', tsSymbol: 'C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCF1200', size: 210, headHex: '837c24080955568b', tailHex: '5b5e5dc20800', tsSymbol: 'C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c' },
  { batch: 'k2-remed-r1', va: '0x6FCF8310', size: 294, headHex: '83ec10538b5c2418', tailHex: '83c410c20800', tsSymbol: 'ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c' },
  { batch: 'k2-remed-r1', va: '0x6FD087E0', size: 443, headHex: '5356578bf2568bd9', tailHex: '5f5e5bc20400', tsSymbol: 'ACT3Q3_CleanupKhalimItemsOnEnterAct2OrComplete_6FD087E0_113c' },
  { batch: 'k2w14-b1', va: '0x6FCCC8E0', size: 44, headHex: '85d27418817a04a4', tailHex: 'deffffc20400', tsSymbol: 'AI_MercOrShadowWarriorThink_6FCCC8E0_113c' },
  { batch: 'k2w14-b1', va: '0x6FD09C80', size: 313, headHex: '568bf18b460485c0', tailHex: 'ff5f33c05ec3', tsSymbol: 'ACT3Q2_OperateGidbinnAltar_6FD09C80_113c' },
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

function createWave16World(nDifficulty = 0) {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(D2GAME_SCRATCH_W15B1_113C, 0x2000, 0)
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

  // Experience.txt ptr (0x6fdf0b50)
  const pExpBin = m.alloc(0x200) >>> 0
  for (let c = 0; c < 8; c++) m.setU32((pExpBin + c * 4) >>> 0, 99)
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin)

  // MonStatsTxt (750 rows * 0x1A8)
  const monStatsCount = 750
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec = (pMonStatsTxt + i * 0x1a8) >>> 0
    m.setU16(rec, i)
    m.setU16((rec + 0x18) >>> 0, i)
    m.setU16((rec + 0x1e) >>> 0, 1)
    for (let s = 0; s < 8; s++) m.setU16((rec + 0x170 + s * 2) >>> 0, 0xffff)
  }

  // MonStats2Txt (750 rows * 0x134)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa8c) >>> 0, monStatsCount)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)

  // MissilesTxt (400 rows * 0x1A4) at pDataTables+0xB64 / +0xB6C
  const missilesCount = 400
  const pMissilesTxt = m.alloc(missilesCount * 0x1a4) >>> 0
  m.setU32((pDataTables + 0xb64) >>> 0, pMissilesTxt)
  m.setU32((pDataTables + 0xb6c) >>> 0, missilesCount)

  // SkillsTxt (280 rows * 0x23C) + SkillCode RPN buffer
  const skillsCount = 280
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

  // LevelsTxt (140 rows * 0x220) + act town boundaries at pDataTables+0xC60
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE) >>> 0
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

  // PetTypesTxt (16 rows * 0xE0) at pDataTables+0xBE8 / count at +0xBF0
  const pPetTypesTxt = m.alloc(16 * 0xe0) >>> 0
  m.setU32((pDataTables + 0xbe8) >>> 0, pPetTypesTxt)
  m.setU32((pDataTables + 0xbf0) >>> 0, 16)

  // ItemTypesTxt (100 rows * 0xE4) + Equiv matrix
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
  const stdCodes: Array<[number, number, number]> = [
    [20, 0x20646c67, 4], // 'gld '
    [21, 0x20317068, 76], // 'hp1 '
    [22, 0x2031706d, 77], // 'mp1 '
    [23, 0x2067656c, 45], // 'leg '
    [24, 0x20637374, 22], // 'tsc '
    [25, 0x20637369, 22], // 'isc '
    [26, 0x206b6274, 18], // 'tbk '
    [27, 0x206b6269, 18], // 'ibk '
    [28, 0x20706163, 0x2b], // 'cap '
  ]
  for (const [id, code, typeId] of stdCodes) {
    const rec = (pItemsTxt + id * ITEMS_TXT_STRIDE_113C) >>> 0
    m.setU32((rec + 0x80) >>> 0, code >>> 0)
    m.setU32((rec + 0x84) >>> 0, code >>> 0)
    m.setU8((rec + 0x10f) >>> 0, 1)
    m.setU8((rec + 0x110) >>> 0, 1)
    m.setU16((rec + 0x11e) >>> 0, typeId & 0xffff)
  }
  // Sorted (dwCode, rowId) linker table for DATATBLS_GetItemIdFromItemCode113c / fogGetRowFromTxt113c
  const sortedCodes = [...stdCodes].sort((a, b) => (a[1] >>> 0) - (b[1] >>> 0))
  const pItemLinker = m.alloc(0x10) >>> 0
  const pLinkerEntries = m.alloc(sortedCodes.length * 8) >>> 0
  m.setU32(pItemLinker, sortedCodes.length)
  m.setU32((pItemLinker + 0x08) >>> 0, pLinkerEntries)
  for (let i = 0; i < sortedCodes.length; i++) {
    m.setU32((pLinkerEntries + i * 8) >>> 0, sortedCodes[i]![1] >>> 0)
    m.setU32((pLinkerEntries + i * 8 + 4) >>> 0, sortedCodes[i]![0] >>> 0)
  }
  m.setU32(SGPT_ITEMS_LINKER_PTR_VA, pItemLinker)

  // InventoryTxt / BeltsTxt (16 rows * 0x108) + SGPT_INVENTORY_TXT (64 rows * 0xF0)
  const pInvTxtTable = m.alloc(16 * 0x108) >>> 0
  m.setU32(G_INVENTORY_TXT_TABLE_VA_113C, pInvTxtTable)
  m.setU8((pInvTxtTable + 2 * 0x108 + 0x04) >>> 0, 4)
  const pSgptInvTxt = m.alloc(64 * 0xf0) >>> 0
  for (let i = 0; i < 64; i++) {
    const rec = (pSgptInvTxt + i * 0xf0) >>> 0
    m.setU8((rec + 0x10) >>> 0, 10) // gridX
    m.setU8((rec + 0x11) >>> 0, 4) // gridY
  }
  m.setU32(SGPT_INVENTORY_TXT_PTR_VA, pSgptInvTxt)
  m.setU32(SGPT_INVENTORY_TXT_MAX_VA, 63)
  m.setU32(D2COMMON_CHAR_INV_REC_COUNT_VA_113C, 7)
  for (let c = 0; c < 7; c++) {
    m.setU32((D2COMMON_CHAR_INV_REC_TABLE_VA_113C + c * 8) >>> 0, c)
    m.setU32((D2COMMON_CHAR_INV_REC_TABLE_VA_113C + 4 + c * 8) >>> 0, c)
  }

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
  m.setU16(pHirelingTxt, 100)
  m.setU32((pHirelingTxt + HIRELING_TXT_SELLER_OFF_113C) >>> 0, 198)
  m.setU32((pHirelingTxt + 0x10) >>> 0, 1)
  m.setU16((pHirelingTxt + 0x114) >>> 0, 10)
  m.setU16((pHirelingTxt + 0x116) >>> 0, 24)

  // Grid0 (bodylocs, 13x1) & Grid1 (belt, 16x1)
  m.setU8((D2COMMON_GRID0_INFO_VA_113C + 0x00) >>> 0, 13)
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
  m.setU16((pGame + 0x78) >>> 0, 100) // wItemFormat = 100
  m.setU32((pGame + 0xa8) >>> 0, 1000)
  m.setU32((pGame + 0xd0) >>> 0, 0x12345679)
  m.setU32((pGame + 0xd4) >>> 0, 666)
  EVENT_InitTimerQueue113c(m, pGame)

  const pQuestControl = m.alloc(0x40) >>> 0
  m.setU32((pQuestControl + 0x08) >>> 0, 1)
  m.setU32((pQuestControl + 0x0c) >>> 0, QUESTRECORD_AllocRecord113c(m, 0))
  m.setU32((pQuestControl + 0x18) >>> 0, 0x12345679)
  m.setU32((pQuestControl + 0x1c) >>> 0, 666)
  m.setU32((pGame + 0x10f4) >>> 0, pQuestControl)

  const pNpcControl = m.alloc(0x40) >>> 0
  const pNpcSlots = m.alloc(0x40 * 0x44) >>> 0
  for (let i = 0; i < 0x40; i++) m.setU32((pNpcSlots + i * 0x44) >>> 0, 0xfffffffe)
  m.setU32((pNpcControl + 0x04) >>> 0, pNpcSlots)
  m.setU32((pNpcControl + 0x08) >>> 0, 0x12345679)
  m.setU32((pNpcControl + 0x0c) >>> 0, 666)
  m.setU32((pGame + 0x1d24) >>> 0, pNpcControl)
  m.setU32((pGame + 0x1d28) >>> 0, m.alloc(0x20) >>> 0) // pArenaCtrl

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
    pMissilesTxt,
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

function allocRoomWithLevel(
  m: SparseMemory113c,
  levelId: number,
  x0 = 0,
  y0 = 0,
  w = 400,
  h = 400,
): number {
  const pRoom = m.alloc(0x90) >>> 0
  const pRoomEx = m.alloc(0xf0) >>> 0
  const pLevel = m.alloc(0x200) >>> 0
  const ppNear = m.alloc(4) >>> 0
  m.setU32(ppNear, pRoom)
  m.setU32(pRoom, ppNear)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoom + 0x24) >>> 0, 1)
  m.setU32((pRoom + 0x4c) >>> 0, x0 >>> 0)
  m.setU32((pRoom + 0x50) >>> 0, y0 >>> 0)
  m.setU32((pRoom + 0x54) >>> 0, w >>> 0)
  m.setU32((pRoom + 0x58) >>> 0, h >>> 0)
  m.setU32((pRoom + 0x60) >>> 0, 0x2468ace1)
  m.setU32((pRoom + 0x64) >>> 0, 666)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  m.setU32((pLevel + 0x1d0) >>> 0, levelId >>> 0)
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
  const pRoom = allocRoomWithLevel(m, levelId)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer) >>> 0
  const pClient = m.alloc(0x520) >>> 0
  const pQueue = m.alloc(0x410) >>> 0
  m.setU32(pClient, guid >>> 0)
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
  const pSkillList = m.alloc(0x20) >>> 0
  const pLeftSkill = m.alloc(0x40) >>> 0
  const pSgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  m.setU32(pLeftSkill, pSgpt !== 0 ? m.u32((pSgpt + 0xb98) >>> 0) : 0)
  m.setU32((pLeftSkill + 0x28) >>> 0, 1)
  m.setU32((pLeftSkill + 0x34) >>> 0, 0xffffffff) // D2SkillStrc.nOwnerItemGuid = -1
  m.setU32((pSkillList + 0x04) >>> 0, pLeftSkill)
  m.setU32((pSkillList + 0x08) >>> 0, pLeftSkill)
  m.setU32((pSkillList + 0x0c) >>> 0, pLeftSkill)
  m.set(pPlayer, D2UnitStrc.pSkills, pSkillList)
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
  const pRoom = allocRoomWithLevel(m, levelId)

  m.setU32(pMon, 1) // UNIT_MONSTER
  m.setU32((pMon + 0x04) >>> 0, classId >>> 0)
  m.setU32((pMon + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pMon + 0x10) >>> 0, 1)
  m.setU32((pMon + 0x14) >>> 0, pMonData)
  m.setU32((pMon + 0x20) >>> 0, (0x2468ace1 + guid) >>> 0)
  m.setU32((pMon + 0x24) >>> 0, 666)
  m.setU32((pMon + 0x2c) >>> 0, pPath)
  m.setU32((pMon + 0x48) >>> 0, 0x1000) // dwFrameCount > 0 for UNITS_AdvanceAnimFrame113c
  m.setU16((pMon + 0x4c) >>> 0, 0x100) // wAnimSpeed
  m.setU32((pMon + 0x80) >>> 0, pGame)

  const pSgptMon = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  const pMonStatsBase = pSgptMon !== 0 ? m.u32((pSgptMon + 0xa78) >>> 0) >>> 0 : 0
  if (pMonStatsBase !== 0) {
    m.setU32(pMonData, (pMonStatsBase + classId * 0x1a8) >>> 0) // D2MonsterDataStrc.pMonStats
  }
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
  const pRec = (pItemsTxt + itemId * ITEMS_TXT_STRIDE_113C) >>> 0
  m.setU32((pRec + 0x80) >>> 0, baseCode >>> 0)
  m.setU32((pRec + 0x84) >>> 0, baseCode >>> 0)
  m.setU8((pRec + 0x10f) >>> 0, 1)
  m.setU8((pRec + 0x110) >>> 0, 1)
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

describe('D2Game.dll v1.13c Disassembly Verification Wave 16 (+82 VAs across k2-remed-r2, k2w4-b4, k2-remed-r1, k2w14-b1)', () => {
  it('verifies exact PE32 machine-code leading/trailing opcodes, sizes, manifest promotion (82 VAs), and indirectUnknown guardrails (14 VAs)', () => {
    expect(WAVE16_PROMOTED_SPECS.length).toBe(82)
    const uniqueVas = new Set(WAVE16_PROMOTED_SPECS.map((s) => s.va.toUpperCase()))
    expect(uniqueVas.size).toBe(82)

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
    const byVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        byVa.set(fn.va.toUpperCase(), fn)
      }
    }

    // All 14 formerly indirectUnknown VAs across k2-remed-r2 (8) and k2-remed-r1 (6) were promoted in Wave 23 (Batch C)
    for (const skippedVa of WAVE16_INDIRECT_UNKNOWN_SKIPPED) {
      const mFn = byVa.get(skippedVa.toUpperCase())
      expect(mFn, `missing skipped VA ${skippedVa}`).toBeDefined()
      expect(mFn!.status, `${skippedVa} promoted to diff-verified in Wave 23`).toBe('diff-verified')
    }

    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    const pe = fs.existsSync(dllPath) ? loadPeSectionMapper(dllPath, 0x6fc20000) : null

    for (const spec of WAVE16_PROMOTED_SPECS) {
      const mFn = byVa.get(spec.va.toUpperCase())
      expect(mFn, `manifest missing ${spec.va}`).toBeDefined()
      expect(mFn!.status, `${spec.va} must be diff-verified`).toBe('diff-verified')
      expect(mFn!.indirectUnknown, `${spec.va} must not be indirectUnknown`).not.toBe(true)
      expect(mFn!.tsSymbol).toBe(spec.tsSymbol)
      expect(mFn!.size).toBe(spec.size)
      expect(mFn!.diffEvidence).toContain('k2-disasm-verified-wave16.test.ts')

      if (pe !== null) {
        const vaNum = Number.parseInt(spec.va, 16)
        expect(vaNum).toBeGreaterThanOrEqual(pe.textStart)
        expect(vaNum + spec.size).toBeLessThanOrEqual(pe.textEnd)
        const off = pe.vaToFileOffset(vaNum)
        const raw = pe.buf.subarray(off, off + spec.size)
        const headHex = raw.subarray(0, Math.min(8, raw.length)).toString('hex')
        const tailHex = raw.subarray(Math.max(0, raw.length - 6)).toString('hex')
        expect(headHex, `headHex mismatch at ${spec.va}`).toBe(spec.headHex)
        expect(tailHex, `tailHex mismatch at ${spec.va}`).toBe(spec.tailHex)
      }
    }
  })

  it('regression [k2-w4b4]: 0x6FC22510 canonical resize/destroy, 0x6FC309B0 unconditional canonical calls, 0x6FC96A10 step path, 0x6FCA1F50 seedRoll/wander=3/approach, 0x6FCA2EC0 diff threshold, 0x6FCA77B0 MonStats2+0x105 bitmask', () => {
    // 1. 0x6FC22510: grow traces canonical 0x6FC22630; shrink traces canonical 0x6FC21F60
    {
      const { m } = createWave16World(0)
      const pArr = m.alloc(0x10) >>> 0
      m.setU32(pArr, 0)
      m.setU32((pArr + 4) >>> 0, 0)
      m.setU32((pArr + 8) >>> 0, 0)
      beginVaTrace113c()
      STORM_TSListArraySetCount_6FC22510_113c(m, pArr, 3)
      const growHits = endVaTrace113c()
      expect(growHits.has('D2Game:0x6FC22510')).toBe(true)
      expect(growHits.has('D2Game:0x6FC22630')).toBe(true)
      expect(m.u32((pArr + 4) >>> 0)).toBe(3)

      beginVaTrace113c()
      STORM_TSListArraySetCount_6FC22510_113c(m, pArr, 1)
      const shrinkHits = endVaTrace113c()
      expect(shrinkHits.has('D2Game:0x6FC21F60')).toBe(true)
      expect(m.u32((pArr + 4) >>> 0)).toBe(1)
    }

    // 2. 0x6FC309B0: unconditionally traces 0x6FC2EE90 & 0x6FC30550 even when sgptDataTables IAT is unloaded
    {
      const { m } = createWave16World(0)
      const { pItem, pItemData } = allocItem(m, 1, 0x101)
      m.setU16((pItemData + 0x30) >>> 0, 100) // D2ItemDataStrc.wItemFormat = 100 (LoD expansion) -> 0x6FC30550
      m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, 0)
      const ppItem = m.alloc(4) >>> 0
      m.setU32(ppItem, pItem)
      const pDrop = m.alloc(0x88) >>> 0
      m.setU32((pDrop + 0x1c) >>> 0, 2) // ITEMQUAL_NORMAL
      beginVaTrace113c()
      ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(m, 0x12345, ppItem, pDrop, 0)
      const hits = endVaTrace113c()
      expect(hits.has('D2Game:0x6FC309B0')).toBe(true)
      expect(hits.has('D2Game:0x6FC2EE90')).toBe(true)
      expect(hits.has('D2Game:0x6FC30550')).toBe(true)
    }

    // 3. 0x6FC96A10: traces 0x6FD01930 without hooks.world & does not zero dwAnimFrame on 0-point path
    {
      const { m, pGame } = createWave16World(0)
      const { pMon } = allocMonster(m, pGame, 5, 0x102, 2, 100, 100)
      m.setU32((pMon + 0x44) >>> 0, 777)
      beginVaTrace113c()
      MONSTER_TickPathStepAndAnim_6FC96A10_113c(m, pGame, pMon)
      const hits = endVaTrace113c()
      expect(hits.has('D2Game:0x6FC96A10')).toBe(true)
      expect(hits.has('D2Game:0x6FD01930')).toBe(true)
      expect(m.u32((pMon + 0x44) >>> 0)).toBe(777 + 0x100) // advanced, NOT reset to 0!
    }

    // 4. 0x6FCA1F50: melee roll traces canonical 0x6FC21180; approach without hooks.world traces 0x6FD12540; idle wander passes range=3
    {
      const { m, pGame, pMonStatsTxt } = createWave16World(0)
      const { pPlayer } = allocPlayer(m, pGame, 0x103, 2, 100, 100, 0)
      const { pMon, pAiCtrl } = allocMonster(m, pGame, 5, 0x104, 2, 101, 100)
      const pMonRec = (pMonStatsTxt + 5 * 0x1a8) >>> 0
      const pAiArgs = m.alloc(0x30) >>> 0
      m.setU32(pAiArgs, pAiCtrl)
      m.setU32((pAiArgs + 0x08) >>> 0, pPlayer)
      m.setU32((pAiArgs + 0x14) >>> 0, 1) // nDist = 1 (in melee)
      m.setU32((pAiArgs + 0x18) >>> 0, 1) // bInMelee = 1
      m.setU32((pAiArgs + 0x1c) >>> 0, pMonRec)
      // MonStats AI params: maxDist (+0x56) = 20, atkChance (+0x62) = 100, a1Chance (+0x68) = 50
      m.setU16((pMonRec + 0x56) >>> 0, 20)
      m.setU16((pMonRec + 0x62) >>> 0, 100)
      m.setU16((pMonRec + 0x68) >>> 0, 50)
      beginVaTrace113c()
      AI_ThinkMeleeBasic_6FCA1F50_113c(m, pGame, pMon, pAiArgs)
      const meleeHits = endVaTrace113c()
      expect(meleeHits.has('D2Game:0x6FCA1F50')).toBe(true)
      expect(meleeHits.has('D2Game:0x6FC21180')).toBe(true)

      // Out of melee (nDist=12 <= maxDist=20) -> traces canonical AI_ApproachTarget113c (0x6FD12540)
      m.setU32((pAiArgs + 0x14) >>> 0, 12)
      m.setU32((pAiArgs + 0x18) >>> 0, 0)
      beginVaTrace113c()
      AI_ThinkMeleeBasic_6FCA1F50_113c(m, pGame, pMon, pAiArgs)
      const approachHits = endVaTrace113c()
      expect(approachHits.has('D2Game:0x6FD12540')).toBe(true)
    }

    // 5. 0x6FCA2EC0: charge threshold is 20 - 3 * nDifficulty from scratch+0 (NOT nExpBonus at +0x0C)
    {
      const runCharger = (diff: number): number => {
        const { m, pGame, pMonStatsTxt } = createWave16World(diff)
        const { pPlayer } = allocPlayer(m, pGame, 0x105, 2, 100, 100, diff)
        const { pMon, pAiCtrl } = allocMonster(m, pGame, 5, 0x106, 2, 116, 100)
        const pMonRec = (pMonStatsTxt + 5 * 0x1a8) >>> 0
        const pAiArgs = m.alloc(0x30) >>> 0
        m.setU32(pAiArgs, pAiCtrl)
        m.setU32((pAiArgs + 0x08) >>> 0, pPlayer)
        m.setU32((pAiArgs + 0x14) >>> 0, 16) // 16 <= 20 (Normal), 16 > 14 (Hell)
        m.setU32((pAiArgs + 0x18) >>> 0, 0)
        m.setU32((pAiArgs + 0x1c) >>> 0, pMonRec)
        m.setU32((pAiCtrl + 0x18) >>> 0, 0)
        AI_ThinkChargerRunOrAttack_6FCA2EC0_113c(m, pGame, pMon, pAiArgs)
        return m.u32((pAiCtrl + 0x18) >>> 0) // runCharge sets +0x18 = 0x0d (path type override)
      }
      expect(runCharger(0)).toBe(0) // Normal: threshold=20, dist=16 <= 20 -> no charge
      expect(runCharger(2)).toBe(0x0d) // Hell: threshold=14, dist=16 > 14 -> enters charge!
    }

    // 6. 0x6FCA77B0: byte-indexed MonStats2 + 0x105 bitmask for mode 0x0A (`bit 2 = 0x04`) sets pathType 0x65 vs 0x64
    {
      const runBurrower = (mode10BitSet: boolean): number => {
        const { m, pGame, pMonStatsTxt, pMonStats2Txt } = createWave16World(0)
        const { pPlayer } = allocPlayer(m, pGame, 0x107, 2, 100, 100, 0)
        const { pMon, pAiCtrl } = allocMonster(m, pGame, 5, 0x108, 2, 103, 100)
        const pMonRec = (pMonStatsTxt + 5 * 0x1a8) >>> 0
        const pMonStats2 = (pMonStats2Txt + 5 * D2MonStats2Txt_SIZE) >>> 0
        // Mode 0x0A -> byte offset 0x104 + (10 >> 3) = 0x105, mask 1 << (10 & 7) = 0x04
        m.setU8((pMonStats2 + 0x105) >>> 0, mode10BitSet ? 0x04 : 0x00)
        const pAiArgs = m.alloc(0x30) >>> 0
        m.setU32(pAiArgs, pAiCtrl)
        m.setU32((pAiArgs + 0x08) >>> 0, pPlayer)
        m.setU32((pAiArgs + 0x14) >>> 0, 3) // nDist <= 5 with nAnimMode === 1 triggers mode 0x0A
        m.setU32((pAiArgs + 0x18) >>> 0, 0)
        m.setU32((pAiArgs + 0x1c) >>> 0, pMonRec)
        let capturedPathType = -1
        AI_ThinkBurrowerSpawner_6FCA77B0_113c(m, pGame, pMon, pAiArgs, {
          aiFallen: {
            onMonsterStartMode: (mem, _g, pModeArgs) => {
              capturedPathType = mem.u8((pModeArgs + 0x15) >>> 0)
              return 1
            },
          },
        })
        return capturedPathType
      }
      expect(runBurrower(true)).toBe(0x65)
      expect(runBurrower(false)).toBe(0x64)
    }
  })

  it('regression [k2-w15b1]: 0x6FC4D090 0x5A offsets, 0x6FC71E70 exact ring table & u8 flag, 0x6FC7CD50 trace/u8, 0x6FC864F0 (x+6,y-3), 0x6FC99210 corpse/exp/gold, 0x6FCB6310, 0x6FCDAF20, 0x6FCDF730 pVendorState, 0x6FCE9CB0 (x-13,y+3), 0x6FCEF220 shift-fill', () => {
    // 1. 0x6FC4D090: 0x5A packet charName at +0x08 (byte +7 is 0), accountName at +0x18 (null at +0x27)
    {
      const { m, pGame } = createWave16World(0)
      const pClient1 = m.alloc(0x520) >>> 0
      const pClient2 = m.alloc(0x520) >>> 0
      const pQueue2 = m.alloc(0x410) >>> 0
      m.setU32(pClient1, 11)
      m.setU32((pClient1 + 0x1a8) >>> 0, pGame)
      m.setU32((pClient1 + 0x4a8) >>> 0, pClient2)
      m.setU32(pClient2, 22)
      m.setU32((pClient2 + 4) >>> 0, 4) // CLIENTSTATE_INGAME
      m.setU32((pClient2 + 0x1a8) >>> 0, pGame)
      m.setU32((pClient2 + 0x1bc) >>> 0, pQueue2)
      m.setU32((pGame + 0x88) >>> 0, pClient1)
      // Write charName "Hero" at pClient1+0x0D and accountName "Acct" at pClient1+0x1D
      for (const [i, ch] of [...'Hero'].entries()) m.setU8((pClient1 + 0x0d + i) >>> 0, ch.charCodeAt(0))
      for (const [i, ch] of [...'Acct'].entries()) m.setU8((pClient1 + 0x1d + i) >>> 0, ch.charCodeAt(0))
      CLIENT_NotifyAndDisconnectClient_6FC4D090_113c(m, pClient1, pGame, 4, {
        d2netSendPacket: () => {},
        d2netCloseConnection: () => {},
      })
      // Packet queued to pClient2's queue buffer (D2PacketDataStrc: +0x00=used, +0x04=data bytes)
      expect(m.u32(pQueue2)).toBe(40)
      expect(m.u8((pQueue2 + 0x04) >>> 0)).toBe(0x5a)
      expect(m.u8((pQueue2 + 0x04 + 7) >>> 0)).toBe(0)
      expect(m.u8((pQueue2 + 0x04 + 8) >>> 0)).toBe('H'.charCodeAt(0))
      expect(m.u8((pQueue2 + 0x04 + 0x17) >>> 0)).toBe(0)
      expect(m.u8((pQueue2 + 0x04 + 0x18) >>> 0)).toBe('A'.charCodeAt(0))
      expect(m.u8((pQueue2 + 0x04 + 0x27) >>> 0)).toBe(0)
    }

    // 2. 0x6FC71E70: exact 1.13c 0x6FD1C1AC/0x6FD1C17C radial table & 8-bit pAiGen+0x08 write
    {
      const { m, pGame } = createWave16World(0)
      const { pPlayer, pPath } = allocPlayer(m, pGame, 0x201, 2, 100, 200, 0)
      m.setU16((pPath + 0x10) >>> 0, 100)
      m.setU16((pPath + 0x12) >>> 0, 200)
      const spawned: Array<[number, number]> = []
      const aiGens: number[] = []
      const rc = SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c(m, pGame, pPlayer, 10, 3, {
        spawnRadialMinion: (_mem, _sk, _g, _u, nx, ny) => {
          spawned.push([nx, ny])
          const { pMon, pAiGen } = allocMonster(m, pGame, 5, 0x300 + spawned.length, 2, nx, ny)
          m.setU32((pAiGen + 0x08) >>> 0, 0xaabbcc00)
          aiGens.push(pAiGen)
          return pMon
        },
      })
      expect(rc).toBe(1)
      expect(spawned).toEqual([
        [99, 196], [101, 196], [103, 197], [104, 199], [104, 201], [103, 203],
        [99, 204], [101, 204], [97, 203], [96, 199], [96, 201], [97, 197],
      ])
      // Upper 3 bytes of pAiGen + 0x08 preserved by m.setU8 (writes 2 at +0x08)
      expect(m.u32((aiGens[0]! + 0x08) >>> 0)).toBe(0xaabbcc02)
    }

    // 3. 0x6FC7CD50: traces 0x6FCFFCC0 & preserves upper 3 bytes of pState+0x100
    {
      const { m, pGame, pQuestControl } = createWave16World(0)
      const { pPlayer, pInv, pRoom } = allocPlayer(m, pGame, 0x202, 114, 150, 160, 0)
      const { pQuest, pQuestEx } = linkQuest(m, pGame, pQuestControl, 0x21, 0x25)
      m.setU8((pQuest + 0x09) >>> 0, 1)
      m.setU32((pQuestEx + 0x100) >>> 0, 0x12345600)
      // Give player thaw potion ('ice ' = 0x20656369)
      const { pItem: pIce } = allocItem(m, 10, 0x250, 0x20656369, 0x16)
      INVENTORY_SetCursorItem113c(m, pInv, pIce)
      const pObj = m.alloc(0x100) >>> 0
      const pObjPath = m.alloc(0x20) >>> 0
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x04) >>> 0, 0x189)
      m.setU32((pObj + 0x0c) >>> 0, 0x251)
      m.setU32((pObj + 0x2c) >>> 0, pObjPath)
      m.setU32(pObjPath, pRoom)
      m.setU32((pObjPath + 0x0c) >>> 0, 155)
      m.setU32((pObjPath + 0x10) >>> 0, 165)
      const pArg = m.alloc(0x20) >>> 0
      m.setU32(pArg, pGame)
      m.setU32((pArg + 0x04) >>> 0, pObj)
      m.setU32((pArg + 0x08) >>> 0, pPlayer)
      beginVaTrace113c()
      ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c(m, pArg, {
        deletePlayerQuestItem: () => {},
      })
      const hits = endVaTrace113c()
      expect(hits.has('D2Game:0x6FC7CD50')).toBe(true)
      expect(hits.has('D2Game:0x6FCFFCC0')).toBe(true)
      expect(hits.has('D2Game:0x6FC55E90')).toBe(true)
      expect(m.u32((pQuestEx + 0x100) >>> 0)).toBe(0x12345601)
      expect(m.u32((pQuestEx + 0xf0) >>> 0)).toBe(155)
      expect(m.u32((pQuestEx + 0xf4) >>> 0)).toBe(165)
    }

    // 4. 0x6FC864F0: enforces pQuest+0x09 !== 0, u16 click increment after &0x3f check, and portal at (stone15.x + 6, stone15.y - 3)
    {
      const { m, pGame, pQuestControl } = createWave16World(0)
      const { pPlayer, pInv, pRoom } = allocPlayer(m, pGame, 0x203, 4, 200, 200, 0)
      const { pQuest, pQuestEx } = linkQuest(m, pGame, pQuestControl, 4, 4)
      m.setU8((pQuestEx + 0x4a) >>> 0, 1)
      m.setU8((pQuest + 0x09) >>> 0, 0) // inactive
      // Give player Scroll of Inifuss ('bkd ' = 0x20646b62)
      const { pItem: pBkd } = allocItem(m, 11, 0x260, 0x20646b62, 0x16)
      INVENTORY_SetCursorItem113c(m, pInv, pBkd)
      const pStone = m.alloc(0x100) >>> 0
      const pStonePath = m.alloc(0x20) >>> 0
      m.setU32(pStone, 2)
      m.setU32((pStone + 0x04) >>> 0, 0x15)
      m.setU32((pStone + 0x0c) >>> 0, 0x261)
      m.setU32((pStone + 0x2c) >>> 0, pStonePath)
      m.setU32(pStonePath, pRoom)
      m.setU32((pStonePath + 0x0c) >>> 0, 210)
      m.setU32((pStonePath + 0x10) >>> 0, 220)
      SUNIT_InsertServerUnit113c(m, pGame, pStone)
      m.setU16((pQuestEx + 0x08) >>> 0, 0x15) // 5th stone in sequence (index 4 -> +8)
      m.setU16((pQuestEx + 0x0c) >>> 0, 4) // 4 stones already lit -> this is stone #5
      m.setU8((pQuest + 0x0c) >>> 0, 5)
      const pArg = m.alloc(0x20) >>> 0
      m.setU32(pArg, pGame)
      m.setU32((pArg + 0x04) >>> 0, pStone)
      m.setU32((pArg + 0x08) >>> 0, pPlayer)
      m.setU16((pArg + 0x10) >>> 0, 0x15)
      // When pQuest+0x09 === 0, must NOT activate!
      ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c(m, pArg)
      expect(m.u8((pQuestEx + 0x4f) >>> 0)).toBe(0)
      // Activate quest (+0x09 = 1) -> stone 5 opens Tristram portal missile 0x120 at (210+6, 220-3) = (216, 217)
      m.setU8((pQuest + 0x09) >>> 0, 1)
      beginVaTrace113c()
      ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c(m, pArg)
      const cairnHits = endVaTrace113c()
      expect(m.u8((pQuestEx + 0x4f) >>> 0)).toBe(1)
      expect(m.u16((pQuestEx + 0x0c) >>> 0)).toBe(5)
      expect(cairnHits.has('D2Game:0x6FCC0000')).toBe(true)
      // Verify coord buffer held stone15 (210, 220) -> portal delta (+6, -3) = (216, 217)
      expect(m.u32(D2GAME_SCRATCH_W15B1_113C)).toBe(210)
      expect(m.u32((D2GAME_SCRATCH_W15B1_113C + 4) >>> 0)).toBe(220)
    }

    // 5. 0x6FC99210: PLRMODE_DEAD (0x11), state 7, 75% of pClient+0x508 lost exp on corpse & cleared, linked leftItemGuid
    {
      const { m, pGame } = createWave16World(2) // Hell
      const { pPlayer, pClient } = allocPlayer(m, pGame, 0x204, 2, 120, 130, 2)
      m.setU32((pClient + 0x508) >>> 0, 4000) // lost exp
      const pCorpse = PLAYER_CreateCorpseOnDeath_6FC99210_113c(m, pPlayer, pGame) >>> 0
      expect(pCorpse).not.toBe(0)
      expect(m.u32((pCorpse + 0x10) >>> 0)).toBe(0x11) // PLRMODE_DEAD
      expect(STATES_CheckGfxStateFlag113c(m, pCorpse, 7)).not.toBe(0) // bit 7 = 0x80
      // 75% of 4000 = 3000 stored on corpse, client +0x508 cleared to 0
      expect(STATLIST_GetUnitStat113c(m, pCorpse, 0x0d, 0)).toBe(3000)
      expect(m.u32((pClient + 0x508) >>> 0)).toBe(0)
      const pCorpseInv = m.u32((pCorpse + 0x60) >>> 0) >>> 0
      expect(INVENTORY_GetLeftItemGuid113c(m, pCorpseInv)).toBe(0x204)
    }

    // 6. 0x6FCB6310: passes (0, ownerX, ownerY, targetX, targetY) to AIGENERAL_CopyAiCommandParams113c & frees event 2 via 0x6FCAE6F0
    {
      const { m, pGame, pSkillsTxt } = createWave16World(0)
      const { pPlayer, pPath } = allocPlayer(m, pGame, 0x205, 2, 111, 222, 0)
      m.setU16((pPath + 0x10) >>> 0, 140)
      m.setU16((pPath + 0x12) >>> 0, 250)
      const { pMon: pPet, pAiGen } = allocMonster(m, pGame, 5, 0x206, 2, 140, 250)
      const pEv = m.alloc(0x30) >>> 0
      m.setU8(pEv, 2)
      m.setU32((pPet + 0xdc) >>> 0, pEv)
      const pSk = (pSkillsTxt + 15 * D2SkillsTxt_SIZE) >>> 0
      m.setU16((pSk + 0xbc) >>> 0, 5)
      m.setU8((pSk + 0xbf) >>> 0, 1)
      beginVaTrace113c()
      const rc = SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c(m, pGame, pPlayer, 15, 1, {
        spawnSkillMonsterFromParams: () => pPet,
      })
      const hits = endVaTrace113c()
      expect(rc).toBe(1)
      expect(hits.has('D2Game:0x6FCAE6F0')).toBe(true)
      expect(hits.has('D2Game:0x6FC41290')).toBe(true)
      const pCmdNode = m.u32((pAiGen + 0x20) >>> 0) >>> 0
      expect(pCmdNode).not.toBe(0)
      expect(m.get(pCmdNode, D2AiCmdStrc.dwCmdType)).toBe(0)
      expect(m.get(pCmdNode, D2AiCmdStrc.dwParam1)).toBe(111)
      expect(m.get(pCmdNode, D2AiCmdStrc.dwParam2)).toBe(222)
      expect(m.get(pCmdNode, D2AiCmdStrc.dwParam3)).toBe(140)
      expect(m.get(pCmdNode, D2AiCmdStrc.dwParam4)).toBe(250)
    }

    // 7. 0x6FCDAF20: safely returns on pRoom === 0 or nLevelId === 0
    {
      const { m, pGame } = createWave16World(0)
      const { pPlayer, pPath } = allocPlayer(m, pGame, 0x207, 0, 100, 100, 0)
      ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c(m, pGame, pPlayer) // levelId=0
      m.setU32((pPath + 0x1c) >>> 0, 0)
      ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c(m, pGame, pPlayer) // pRoom=0
    }

    // 8. 0x6FCDF730: passes pVendorState (pSlot + 0x20) to 0x6FCDF2E0 so pSlot + 0x28 gets refresh timestamp
    {
      const { m, pGame, pNpcSlots } = createWave16World(0)
      const { pPlayer } = allocPlayer(m, pGame, 0x208, 1, 100, 100, 0)
      const { pMon: pNpc } = allocMonster(m, pGame, 148, 0x209, 1, 102, 100)
      m.setU32(pNpcSlots, 148)
      m.setU8((pNpcSlots + 0x23) >>> 0, 1) // pVendorState.bHasInventory = 1
      m.setU32(0x6fd18d10, 0x7777) // global tick counter
      beginVaTrace113c()
      NPCS_BeginVendorOrGambleInteract_6FCDF730_113c(m, pPlayer, pNpc, pGame, 0)
      const hits = endVaTrace113c()
      expect(hits.has('D2Game:0x6FCDF730')).toBe(true)
      expect(hits.has('D2Game:0x6FCDF2E0')).toBe(true)
      expect(m.u32((pNpcSlots + 0x28) >>> 0)).toBe(0x7777)
    }

    // 9. 0x6FCE9CB0: uses (posX - 13, posY + 3) delta, Missiles.txt[0x152]+0x96 timer, and unconditional [pState0D+0xd/0xe]=1
    {
      const { m, pGame, pQuestControl, pMissilesTxt } = createWave16World(0)
      // Three adjacent rooms:
      // - pOrificeRoom covers x=[100..200], y=[100..200]
      // - pTargetRoom covers x=[80..99], y=[100..200]  -> fixed (-13, +3) = (92, 113) lands here!
      // - pWrongRoom covers x=[100..200], y=[80..99]   -> old buggy (+3, -13) = (108, 97) would land here!
      const pOrificeRoom = allocRoomWithLevel(m, 66, 100, 100, 100, 100)
      const pTargetRoom = allocRoomWithLevel(m, 66, 80, 100, 20, 100)
      const pWrongRoom = allocRoomWithLevel(m, 66, 100, 80, 100, 20)
      const ppAdj = m.alloc(12) >>> 0
      m.setU32(ppAdj, pOrificeRoom)
      m.setU32((ppAdj + 4) >>> 0, pTargetRoom)
      m.setU32((ppAdj + 8) >>> 0, pWrongRoom)
      m.setU32(pOrificeRoom, ppAdj)
      m.setU32((pOrificeRoom + 0x24) >>> 0, 3)
      const { pPlayer } = allocPlayer(m, pGame, 0x20a, 66, 105, 110, 0)
      const { pQuestEx: q0aEx } = linkQuest(m, pGame, pQuestControl, 0x0a, 0x0a)
      const { pQuestEx: q0dEx } = linkQuest(m, pGame, pQuestControl, 0x0d, 0x0d)
      const pOrifice = m.alloc(0x100) >>> 0
      const pOrificePath = m.alloc(0x20) >>> 0
      m.setU32(pOrifice, 2)
      m.setU32((pOrifice + 0x04) >>> 0, 0x98)
      m.setU32((pOrifice + 0x0c) >>> 0, 0x20b)
      m.setU32((pOrifice + 0x2c) >>> 0, pOrificePath)
      m.setU32(pOrificePath, pOrificeRoom)
      m.setU32((pOrificePath + 0x0c) >>> 0, 105)
      m.setU32((pOrificePath + 0x10) >>> 0, 110)
      // Set Missiles.txt[0x152] range (+0x96) = 200 -> Math.trunc((200 - 75) / 25) = 5 ticks
      m.setU16((pMissilesTxt + 0x152 * 0x1a4 + 0x96) >>> 0, 200)
      const pTargetRoomEx = m.u32((pTargetRoom + 0x10) >>> 0) >>> 0
      const pWrongRoomEx = m.u32((pWrongRoom + 0x10) >>> 0) >>> 0
      m.set(pTargetRoomEx, D2RoomExStrc.dwFlags, 0)
      m.set(pWrongRoomEx, D2RoomExStrc.dwFlags, 0)
      ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c(m, pGame, pPlayer, undefined, pOrifice)
      expect(m.u8((q0dEx + 0x0d) >>> 0)).toBe(1)
      expect(m.u8((q0dEx + 0x0e) >>> 0)).toBe(1)
      expect(m.u8((q0aEx + 0x00) >>> 0)).toBe(0)
      expect(m.get(pTargetRoomEx, D2RoomExStrc.dwFlags)).toBe(0x400000)
      expect(m.get(pWrongRoomEx, D2RoomExStrc.dwFlags)).toBe(0)
    }

    // 10. 0x6FCEF220: forwards Shift-click bit (dwRawTab & 0x80000000) to npcBuyItemImpl
    {
      const { m, pGame } = createWave16World(0)
      const { pPlayer } = allocPlayer(m, pGame, 0x20c, 1, 100, 100, 0)
      const pkt = m.alloc(0x11) >>> 0
      m.setU8(pkt, 0x32)
      m.setU32((pkt + 1) >>> 0, 0x555)
      m.setU32((pkt + 5) >>> 0, 0x666)
      m.setU32((pkt + 9) >>> 0, 0x80000002) // Shift-click fill bit + tab 2
      m.setU32((pkt + 0x0d) >>> 0, 150)
      let capturedFlag = -1
      let capturedTab = -1
      C2S_Packet_NpcBuyItem_6FCEF220_113c(m, pGame, pPlayer, pkt, 0x11, {
        npcBuyItemImpl: (_mem, _pl, _g, _npc, _item, tab, _cost, bFlag) => {
          capturedTab = tab
          capturedFlag = bFlag
        },
      })
      expect(capturedTab).toBe(0x80000002)
      expect(capturedFlag).toBe(0x80000000)
    }
  })

  it('regression [k2-w14b1]: 11-function SKILLS_ResolveSummonMonsterId pOutMode sweep, 0x6FC92FC0 total vs base stat ops, 0x6FC93D90 unswapped gold deduct, 0x6FCB5980/0x6FCB5D50, 0x6FCDF200/0x6FCE1890 u8, 0x6FCDF2E0 +0x2c, 0x6FD09C80 null-quest', () => {
    // 1. Class-of-bug sweep: bSumMode = 9 written via SKILLS_ResolveSummonMonsterId_6FCBEE50_113c arg 4 (pOutMode)
    {
      const { m, pGame, pSkillsTxt, pSkillCode } = createWave16World(0)
      const { pPlayer, pPath, pRoom, pStatListEx } = allocPlayer(m, pGame, 0x301, 2, 100, 100, 0)
      m.setU16((pPath + 0x10) >>> 0, 106)
      m.setU16((pPath + 0x12) >>> 0, 104)
      const off3 = writeRpnImm32(m, pSkillCode, 0x10, 3)
      const pSk = (pSkillsTxt + 20 * D2SkillsTxt_SIZE) >>> 0
      m.setU16((pSk + 0xbc) >>> 0, 5) // wSummon = 5
      m.setU8((pSk + 0xbe) >>> 0, 2) // bPetType = 2
      m.setU8((pSk + 0xbf) >>> 0, 9) // bSumMode = 9 (non-zero!)
      m.setU32((pSk + 0xc0) >>> 0, off3) // petmax = 3
      m.setU32((pSk + 0x13c) >>> 0, off3)

      // 0x6FC66560: pSummonArg+0x10 gets bSumMode (9), and +0x14/+0x18 remain 0
      let argMode66560 = -1
      let arg14 = -1
      let arg18 = -1
      SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c(m, pGame, pPlayer, 20, 1, (_mem, _g, pArg) => {
        argMode66560 = m.u32((pArg + 0x10) >>> 0)
        arg14 = m.u32((pArg + 0x14) >>> 0)
        arg18 = m.u32((pArg + 0x18) >>> 0)
        return 0
      })
      expect(argMode66560).toBe(9)
      expect(arg14).toBe(0)
      expect(arg18).toBe(0)

      // 0x6FC66720: sets pUnit+0xc4 |= 0x40, dwFlags=0 (+0x00), nMonMode=8 (+0x10)
      m.setU32((pPlayer + 0xc4) >>> 0, 0)
      let flags66720 = -1
      let mode66720 = -1
      SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c(m, pGame, pPlayer, 20, 1, (_mem, _g, pArg) => {
        flags66720 = m.u32(pArg)
        mode66720 = m.u32((pArg + 0x10) >>> 0)
        return 0
      })
      expect((m.u32((pPlayer + 0xc4) >>> 0) & 0x40) !== 0).toBe(true)
      expect(flags66720).toBe(0)
      expect(mode66720).toBe(8)

      // 0x6FC668A0: sets pUnit+0xc4 |= 0x40 and populates pSummonArg+0x10 = 9
      m.setU32((pPlayer + 0xc4) >>> 0, 0)
      let mode668A0 = -1
      SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c(m, pGame, pPlayer, 20, 1, (_mem, _g, pArg) => {
        mode668A0 = m.u32((pArg + 0x10) >>> 0)
        return 0
      })
      expect((m.u32((pPlayer + 0xc4) >>> 0) & 0x40) !== 0).toBe(true)
      expect(mode668A0).toBe(9)

      // 0x6FC6D8C0: uses STATLIST_GetUnitStat113c (base 25 + bonus 10 = 35 -> floor(35*3/4)+1 = 27 vs base-only 19) and populates pSummonArg+0x10 = 9
      const pSubLvl = STATLIST_AllocList113c(m, 0x40, 0, 0x301, 0, 0)
      STATLIST_SetStat113c(m, pSubLvl, 12, 10, 0)
      STATLIST_InsertSubList113c(m, pStatListEx, pSubLvl)
      let mode6D8C0 = -1
      const { pMon: pShadow } = allocMonster(m, pGame, 5, 0x302, 2, 106, 104)
      beginVaTrace113c()
      SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c(m, pGame, pPlayer, 20, 1, (_mem, _g, pArg) => {
        mode6D8C0 = m.u32((pArg + 0x10) >>> 0)
        return pShadow
      })
      const hits6D8C0 = endVaTrace113c()
      expect(mode6D8C0).toBe(9)
      expect(STATLIST_GetUnitStat113c(m, pShadow, 12, 0)).toBe(27)
      expect(hits6D8C0.has('D2Common:0x6FD88B70')).toBe(true) // STATLIST_GetUnitStat113c (#10973)

      // 0x6FC63D40, 0x6FC70E60, 0x6FC70FE0, 0x6FC60EB0 all receive bSumMode = 9
      let mode63D40 = -1
      SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c(m, pGame, pPlayer, 20, 1, (_mem, _g, pArg) => {
        mode63D40 = m.u32((pArg + 0x10) >>> 0)
        return 0
      })
      expect(mode63D40).toBe(9)

      let mode70E60 = -1
      SKILLS_SpawnBoneWallSegment_6FC70E60_113c(m, 20, pGame, pPlayer, 105, 105, 1, (_mem, _g, pArg) => {
        mode70E60 = m.u32((pArg + 0x10) >>> 0)
        return 0
      })
      expect(mode70E60).toBe(9)

      // 0x6FC60EB0: writes spSummonMode (9) into pSummonArg+0x10
      const pMissile = m.alloc(0x100) >>> 0
      const pMslData = m.alloc(0x40) >>> 0
      const pMslPath = m.alloc(0x80) >>> 0
      m.setU32(pMissile, 3)
      m.setU32((pMissile + 0x0c) >>> 0, 0x303)
      m.setU32((pMissile + 0x14) >>> 0, pMslData)
      m.setU32((pMissile + 0x2c) >>> 0, pMslPath)
      m.setU32((pMissile + 0x94) >>> 0, 0) // dwOwnerType = UNIT_PLAYER
      m.setU32((pMissile + 0x98) >>> 0, 0x301) // dwOwnerGuid = pPlayer
      m.setU32((pMissile + 0xc8) >>> 0, 0x400) // dwFlagsEx bit 10
      m.setU16((pMslPath + 0x02) >>> 0, 102)
      m.setU16((pMslPath + 0x06) >>> 0, 102)
      m.setU32((pMslPath + 0x1c) >>> 0, pRoom)
      m.setU32((pMslPath + 0x34) >>> 0, 0x08) // D2DynamicPathStrc.dwFlags |= 0x08
      m.setU16((pMslData + 0x0a) >>> 0, 20) // D2MissileDataStrc.nSkill = 20
      m.setU16((pMslData + 0x0c) >>> 0, 1) // D2MissileDataStrc.nLevel = 1
      m.setU32((pMslData + 0x28) >>> 0, 0x302) // D2MissileDataStrc.nTargetX = pShadow carrier monster GUID
      m.setU32((pMslData + 0x2c) >>> 0, 105) // D2MissileDataStrc.nTargetY != 0
      let mode60EB0 = -1
      MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c(m, pGame, pMissile, (_mem, _g, pArg) => {
        mode60EB0 = m.u32((pArg + 0x10) >>> 0)
        return 0
      })
      expect(mode60EB0).toBe(9)
    }

    // 2. 0x6FC92FC0: ops 3..6 compare total stat (STATLIST_GetUnitStat113c), ops 7..10 compare base stat (STATLIST_GetUnitBaseStat113c)
    {
      const { m, pGame } = createWave16World(0)
      const { pPlayer, pInv, pStatListEx } = allocPlayer(m, pGame, 0x304, 1, 100, 100, 0)
      // Base Strength (stat 0) = 10, Bonus Strength = +15 -> Total = 25, Base = 10
      STATLIST_SetUnitStat113c(m, pPlayer, 0, 10, 0)
      const pSubStr = STATLIST_AllocList113c(m, 0x40, 0, 0x304, 0, 0)
      STATLIST_SetStat113c(m, pSubStr, 0, 15, 0)
      STATLIST_InsertSubList113c(m, pStatListEx, pSubStr)
      expect(STATLIST_GetUnitStat113c(m, pPlayer, 0, 0)).toBe(25)
      expect(STATLIST_GetUnitBaseStat113c(m, pPlayer, 0, 0)).toBe(10)

      // Put 1 item on cube page (page 3 = D2ItemDataStrc.nInvPage at +0x45)
      const { pItem: pCubeItem, pItemData: pCubeItemData } = allocItem(m, 12, 0x305, 0x20706163, 0x2b)
      m.setU8((pCubeItemData + 0x45) >>> 0, 3)
      m.setU32((pInv + 0x0c) >>> 0, pCubeItem) // first item in inventory
      m.setU32((pCubeItemData + 0x64) >>> 0, 0) // next item = 0

      // Set up 2 Cubemain recipes with nInputs = 1 and param = 0 (Strength), value = 20:
      // Recipe 0: bOp = 7 (nOp = 6 => base stat >= 20 -> MUST NOT match since base=10 < 20!)
      // Recipe 1: bOp = 3 (nOp = 2 => total stat >= 20 -> MUST match since total=25 >= 20!)
      const pCubeTxt = m.alloc(2 * D2CubemainTxt_SIZE) >>> 0
      m.setU32(SGPT_CUBEMAIN_TXT_VA, pCubeTxt)
      m.setU32(SGPT_CUBEMAIN_RECS_VA, 2)
      for (let idx = 0; idx < 2; idx++) {
        const rec = (pCubeTxt + idx * D2CubemainTxt_SIZE) >>> 0
        m.setU8(rec, 1) // bEnabled = 1
        m.setU8((rec + 0x03) >>> 0, 0xff) // any class
        m.setU8((rec + 0x04) >>> 0, idx === 0 ? 7 : 3)
        m.setU32((rec + 0x08) >>> 0, 0) // stat 0 (Strength)
        m.setU32((rec + 0x0c) >>> 0, 20) // target = 20
        m.setU8((rec + 0x10) >>> 0, 1) // nNumInputs = 1
        // Input 0 (+0x18): wInputFlags = 0x01 (ANY), wItem = 0xffff
        m.setU16((rec + 0x18) >>> 0, 0x01)
        m.setU16((rec + 0x1a) >>> 0, 0xffff)
      }
      let executedRec = 0
      CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c(m, pGame, pPlayer, (_mem, _g, _pl, pRec) => {
        executedRec = pRec
      })
      expect(executedRec).toBe((pCubeTxt + D2CubemainTxt_SIZE) >>> 0)
    }

    // 3. 0x6FC93D90: unswapped STATLIST_AddUnitStatGoldGuarded_6FC21670_113c deducts gold cleanly
    {
      const { m, pGame } = createWave16World(0)
      const { pPlayer: p1, pPlayerData: pd1 } = allocPlayer(m, pGame, 0x306, 1, 100, 100, 0)
      const { pPlayer: p2, pPlayerData: pd2 } = allocPlayer(m, pGame, 0x307, 1, 102, 100, 0)
      STATLIST_SetUnitStat113c(m, p1, 0x0e, 500, 0)
      STATLIST_SetUnitStat113c(m, p2, 0x0e, 300, 0)
      const pTrade1 = m.alloc(0x20) >>> 0
      const pTrade2 = m.alloc(0x20) >>> 0
      m.setU32((pTrade1 + 0x0c) >>> 0, 200) // p1 gives 200 gold
      m.setU32((pTrade2 + 0x0c) >>> 0, 50) // p2 gives 50 gold
      m.setU32((pd1 + 0x5c) >>> 0, pTrade1)
      m.setU32((pd2 + 0x5c) >>> 0, pTrade2)
      PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c(m, pd1, p1, p2, pGame, pd2, () => 1)
      expect(STATLIST_GetUnitStat113c(m, p1, 0x0e, 0)).toBe(350) // 500 - 200 + 50
      expect(STATLIST_GetUnitStat113c(m, p2, 0x0e, 0)).toBe(450) // 300 - 50 + 200
    }

    // 4. 0x6FCB5D50: returns 0 cleanly on broken monster owner chain (pMonData === 0) and passes nSkillId to calc
    {
      const { m, pGame, pSkillsTxt, pSkillCode } = createWave16World(0)
      const pBrokenMon = m.alloc(0x100) >>> 0
      m.setU32(pBrokenMon, 1) // UNIT_MONSTER
      m.setU32((pBrokenMon + 0x14) >>> 0, 0) // pMonData = 0 (broken owner chain)
      const off1 = writeRpnImm32(m, pSkillCode, 0x20, 1)
      const pSk = (pSkillsTxt + 21 * D2SkillsTxt_SIZE) >>> 0
      m.setU16((pSk + 0xbc) >>> 0, 5)
      m.setU8((pSk + 0xbe) >>> 0, 1)
      m.setU32((pSk + 0xc0) >>> 0, off1)
      expect(
        SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c(m, pBrokenMon, pGame, 100, 100, pSk, 21, 1),
      ).toBe(0)
    }

    // 5. 0x6FCDF200 & 0x6FCE1890: queue 0x2A on channel 1 with 8-bit result=9 at +2; 0x6FCDF2E0 reads pNpcRecord+0x2c; 0x6FD09C80 null questControl
    {
      const { m, pGame, pNpcSlots } = createWave16World(0)
      const { pPlayer, pClient } = allocPlayer(m, pGame, 0x308, 1, 100, 100, 0)
      const pQueue = m.u32((pClient + 0x1bc) >>> 0) >>> 0
      NPCTRADE_InteractBuyItem_6FCDF200_113c(m, pGame, pPlayer, 0x9999, 1, 0, 0, 10)
      expect(m.u32(pQueue)).toBe(0x0f)
      expect(m.u8((pQueue + 0x04 + 0) >>> 0)).toBe(0x2a)
      expect(m.u8((pQueue + 0x04 + 2) >>> 0)).toBe(9)
      NPCTRADE_InteractRepairItem_6FCE1890_113c(m, pGame, pPlayer, 0x9999, 1)
      expect(m.u32(pQueue)).toBe(0x1e)
      expect(m.u8((pQueue + 0x04 + 0x0f) >>> 0)).toBe(0x2a)
      expect(m.u8((pQueue + 0x04 + 0x0f + 2) >>> 0)).toBe(9)

      // 0x6FCDF2E0 reads item code from pNpcRecord + 0x2c
      const { pMon: pNpc } = allocMonster(m, pGame, 149, 0x309, 1, 102, 100)
      const pSlot = (pNpcSlots + 0x44) >>> 0
      const pVendorItems = m.alloc(0x20) >>> 0
      m.setU8((pVendorItems + 0) >>> 0, 1) // min = 1
      m.setU8((pVendorItems + 1) >>> 0, 1) // max = 1
      m.setU32((pVendorItems + 4) >>> 0, 0x20706163) // 'cap '
      allocItem(m, 15, 0x30a, 0x20706163, 0x2b)
      m.setU32(pSlot, 149)
      m.setU32((pSlot + 0x2c) >>> 0, pVendorItems)
      m.setU32((pSlot + 0x30) >>> 0, 1)
      const createdCodes: number[] = []
      NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c(
        m,
        pGame,
        pPlayer,
        pNpc,
        (pSlot + 0x20) >>> 0,
        (_mem, _npc, code) => {
          createdCodes.push(code)
          return 1
        },
      )
      expect(createdCodes).toEqual([0x20706163])

      // 0x6FD09C80 returns 0 cleanly when pQuestControl === 0
      m.setU32((pGame + 0x10f4) >>> 0, 0)
      const pOp = m.alloc(0x10) >>> 0
      m.setU32(pOp, pGame)
      m.setU32((pOp + 0x08) >>> 0, pPlayer)
      expect(ACT3Q2_OperateGidbinnAltar_6FD09C80_113c(m, pOp)).toBe(0)
    }
  })

  it('exercises all 82 promoted Wave 16 VAs with concrete assertions and 100% live VA trace coverage', () => {
    const cumulativeHits = new Set<string>()

    // -------------------------------------------------------------------------
    // Part 1: k2-w4b4-113c.ts (35 eligible VAs: 15 in k2-remed-r2 + 20 in k2w4-b4)
    // -------------------------------------------------------------------------
    {
      const { m, pGame, pQuestControl, pMonStatsTxt } = createWave16World(0)
      const { pPlayer, pPlayerData, pClient, pRoom, pInv } = allocPlayer(m, pGame, 0x401, 2, 100, 100, 0)
      const { pPlayer: pPlayer2 } = allocPlayer(m, pGame, 0x402, 2, 104, 100, 0)
      const { pMon, pAiCtrl, pPath: pMonPath } = allocMonster(m, pGame, 5, 0x403, 2, 105, 100)
      const pMonRec = (pMonStatsTxt + 5 * 0x1a8) >>> 0
      m.setU16((pMonRec + 0x10c) >>> 0, 50)
      m.setU16((pMonRec + 0x110) >>> 0, 50)
      const pAiArgs = m.alloc(0x30) >>> 0
      m.setU32(pAiArgs, pAiCtrl)
      m.setU32((pAiArgs + 0x08) >>> 0, pPlayer)
      m.setU32((pAiArgs + 0x10) >>> 0, 5)
      m.setU32((pAiArgs + 0x14) >>> 0, 0)
      m.setU32((pAiArgs + 0x1c) >>> 0, pMonRec)

      const pObj = m.alloc(0x100) >>> 0
      const pObjPath = m.alloc(0x20) >>> 0
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x04) >>> 0, 10)
      m.setU32((pObj + 0x0c) >>> 0, 0x404)
      m.setU32((pObj + 0x14) >>> 0, m.alloc(0x40) >>> 0)
      m.setU32((pObj + 0x20) >>> 0, 0x3579bdf1)
      m.setU32((pObj + 0x24) >>> 0, 666)
      m.setU32((pObj + 0x2c) >>> 0, pObjPath)
      m.setU32(pObjPath, pRoom)
      m.setU32((pObjPath + 0x0c) >>> 0, 102)
      m.setU32((pObjPath + 0x10) >>> 0, 102)
      const pOpArgs = m.alloc(0x20) >>> 0
      m.setU32(pOpArgs, pGame)
      m.setU32((pOpArgs + 0x04) >>> 0, pObj)
      m.setU32((pOpArgs + 0x08) >>> 0, pPlayer)

      const pShrineTxt = m.alloc(0x100) >>> 0
      m.setU8(pShrineTxt, 2)
      m.setU32((pShrineTxt + 0x04) >>> 0, 10)
      m.setU32((pShrineTxt + 0x08) >>> 0, 20)

      const pArr = m.alloc(0x10) >>> 0
      const { pItem } = allocItem(m, 1, 0x405)
      const ppItem = m.alloc(4) >>> 0
      m.setU32(ppItem, pItem)
      const pDrop = m.alloc(0x88) >>> 0
      m.setU32((pDrop + 0x1c) >>> 0, 2)

      const pRoomCoords = m.alloc(0x20) >>> 0
      m.setU32(pRoomCoords, 10)
      m.setU32((pRoomCoords + 4) >>> 0, 10)
      m.setU32((pRoomCoords + 8) >>> 0, 15)
      m.setU32((pRoomCoords + 0x0c) >>> 0, 15)

      const { pQuest: q4 } = linkQuest(m, pGame, pQuestControl, 4, 4)
      const { pQuest: q22 } = linkQuest(m, pGame, pQuestControl, 0x22, 0x25)
      void q22
      m.setU32((pMonPath + 0x1c) >>> 0, pRoom)
      const pChatMsg = m.alloc(0x40) >>> 0
      m.setU8(pChatMsg, 1)
      m.setU32((pPlayerData + 0x5c) >>> 0, m.alloc(0x20) >>> 0)
      void pInv

      beginVaTrace113c()
      STORM_TSListArraySetCount_6FC22510_113c(m, pArr, 2)
      ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(m, 1, ppItem, pDrop, 0)
      MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c(m, pMon, pGame, {
        onRollChampionOrUniqueUMods_6FC43CA0: () => {},
      })
      OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c(m, pGame, pRoom, pRoomCoords, {
        onSpawnRandomRoomDropAtCoords_6FC32230: () => 0,
      })
      PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c(m, pPlayer, pGame, pMon)
      MONSTER_SpawnChampionPackMembers_6FC67880_113c(m, pMon, 5, pGame, 0)
      ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c(m, pGame, {
        onSpawnFrozenAnyaAndObject189_6FC7C690: () => {},
      })
      ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c(m, q4, pObj)
      OBJ_OperateAuraStatShrine_6FC8ABB0_113c(m, pOpArgs, pShrineTxt)
      OBJ_OperateStaminaShrine_6FC8AC30_113c(m, pOpArgs, pShrineTxt)
      OBJ_OperateCombatShrine_6FC8ACE0_113c(m, pOpArgs, pShrineTxt)
      OBJ_OperateTomeOrScrollStand_6FC8B340_113c(m, pOpArgs)
      OBJ_OperateWirtsBody_6FC8D960_113c(m, pOpArgs)
      OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c(m, pOpArgs)
      OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c(m, pOpArgs, 0)
      PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c(m, pPlayer, pGame)
      PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c(m, pPlayer, pGame, 0)
      MONSTER_TickPathStepAndAnim_6FC96A10_113c(m, pGame, pMon)
      ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c(m, pPlayer, 100, pPlayer, pGame)
      AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c(m, pGame, pMon, pAiArgs)
      AI_ThinkMeleeBasic_6FCA1F50_113c(m, pGame, pMon, pAiArgs)
      AI_ThinkSimpleMeleeVariantA_6FCA2430_113c(m, pGame, pMon, pAiArgs)
      AI_ThinkSimpleMeleeVariantB_6FCA2570_113c(m, pGame, pMon, pAiArgs)
      AI_ThinkChargerRunOrAttack_6FCA2EC0_113c(m, pGame, pMon, pAiArgs)
      AI_ThinkDualAttackMelee_6FCA3AC0_113c(m, pGame, pMon, pAiArgs)
      AI_SelectHostileTargetByMetrics_6FCA4720_113c(m, pGame, pMon, pMonRec, pPlayer)
      AI_ThinkPackFollowerMelee_6FCA4800_113c(m, pGame, pMon, pAiArgs)
      AI_ThinkBurrowerSpawner_6FCA77B0_113c(m, pGame, pMon, pAiArgs)
      AI_ThinkMonsterSpawnerNest_6FCA7A60_113c(m, pGame, pMon, pAiArgs)
      NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c(m, pClient)
      NET_SendPacket26_ChatMessage_6FCAB470_113c(m, pChatMsg, pClient)
      NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c(m, 0, 0x15, 0x401, pClient, 0, 100, 100, 0, 0)
      NET_SendPacket8B_GameHandshake_6FCAC420_113c(m, pGame, 0x8b, pClient)
      NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c(m, pPlayer, pPlayer2, 50, 6)
      PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c(m, pPlayer, pGame)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Part 2: k2-w15b1-113c.ts (16 eligible VAs in k2-remed-r2)
    // -------------------------------------------------------------------------
    {
      const { m, pGame, pQuestControl, pNpcSlots, pSkillsTxt } = createWave16World(0)
      const { pPlayer, pClient, pRoom } = allocPlayer(m, pGame, 0x501, 102, 100, 100, 0)
      const { pMon: pNpc } = allocMonster(m, pGame, 148, 0x502, 102, 102, 100)
      m.setU32(pNpcSlots, 148)
      const pSk = (pSkillsTxt + 15 * D2SkillsTxt_SIZE) >>> 0
      m.setU16((pSk + 0xbc) >>> 0, 5)
      m.setU8((pSk + 0xbf) >>> 0, 1)
      const { pItem: pStackItem } = allocItem(m, 2, 0x503)
      const pObj = m.alloc(0x100) >>> 0
      const pObjPath = m.alloc(0x20) >>> 0
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x0c) >>> 0, 0x504)
      m.setU32((pObj + 0x20) >>> 0, 0x3579bdf3)
      m.setU32((pObj + 0x24) >>> 0, 666)
      m.setU32((pObj + 0x2c) >>> 0, pObjPath)
      m.setU32(pObjPath, pRoom)
      m.setU32((pObjPath + 0x0c) >>> 0, 100)
      m.setU32((pObjPath + 0x10) >>> 0, 100)
      const pArg = m.alloc(0x20) >>> 0
      m.setU32(pArg, pGame)
      m.setU32((pArg + 0x04) >>> 0, pObj)
      m.setU32((pArg + 0x08) >>> 0, pPlayer)
      const pkt = m.alloc(0x20) >>> 0
      linkQuest(m, pGame, pQuestControl, 4, 4)
      linkQuest(m, pGame, pQuestControl, 0x0a, 0x0a)
      linkQuest(m, pGame, pQuestControl, 0x0d, 0x0d)
      linkQuest(m, pGame, pQuestControl, 0x22, 0x25)

      beginVaTrace113c()
      CLIENT_NotifyAndDisconnectClient_6FC4D090_113c(m, pClient, pGame, 4, {
        d2netSendPacket: () => {},
        d2netCloseConnection: () => {},
      })
      SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c(m, pGame, pPlayer, 15, 1, {
        spawnRadialMinion: () => 0,
      })
      ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c(m, pArg)
      ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c(m, pArg)
      OBJ_OperateDuranceStairs_6FC8CD40_113c(m, pArg)
      PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c(m, pPlayer, 0x17, pGame)
      PLAYER_CreateCorpseOnDeath_6FC99210_113c(m, pPlayer, pGame)
      SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c(m, 15, pPlayer, pGame, 1, {
        spawnSkillMonsterFromParams: () => 0,
      })
      SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c(m, pGame, pPlayer, 15, 1, {
        spawnSkillMonsterFromParams: () => 0,
      })
      ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c(m, pGame, pPlayer)
      NPCS_BeginVendorOrGambleInteract_6FCDF730_113c(m, pPlayer, pNpc, pGame, 0)
      ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c(m, pGame, pPlayer, undefined, pObj)
      C2S_Packet_NpcBuyItem_6FCEF220_113c(m, pGame, pPlayer, pkt, 0x11, {
        npcBuyItemImpl: () => {},
      })
      C2S_Packet_DropCursorItem_6FCEF380_113c(m, pGame, pPlayer, pkt, 5)
      C2S_Packet_HireMercenary_6FCF0060_113c(m, pGame, pPlayer, pkt, 9, {
        hireMercenaryImpl: () => {},
      })
      ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c(m, pGame, pPlayer, pStackItem)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Part 3: k2-w14b1-113c.ts (31 eligible VAs: 29 in k2-remed-r1 + 2 in k2w14-b1)
    // -------------------------------------------------------------------------
    {
      const { m, pGame, pQuestControl, pNpcSlots, pSkillsTxt, pSkillCode } = createWave16World(0)
      const { pPlayer, pPlayerData, pPath, pRoom, pQuestFlags } = allocPlayer(m, pGame, 0x601, 102, 100, 100, 0)
      const { pPlayer: pPlayer2, pPlayerData: pPlayerData2 } = allocPlayer(m, pGame, 0x602, 102, 104, 100, 0)
      const { pMon: pNpc, pAiCtrl } = allocMonster(m, pGame, 148, 0x603, 102, 102, 100)
      m.setU32(pNpcSlots, 148)
      m.setU16((pPath + 0x10) >>> 0, 105)
      m.setU16((pPath + 0x12) >>> 0, 105)

      const off2 = writeRpnImm32(m, pSkillCode, 0x10, 2)
      const pSk = (pSkillsTxt + 20 * D2SkillsTxt_SIZE) >>> 0
      m.setU16((pSk + 0xbc) >>> 0, 5)
      m.setU8((pSk + 0xbe) >>> 0, 1)
      m.setU8((pSk + 0xbf) >>> 0, 8)
      m.setU32((pSk + 0xc0) >>> 0, off2)
      m.setU32((pSk + 0x13c) >>> 0, off2)

      const pMissile = m.alloc(0x100) >>> 0
      const pMslData = m.alloc(0x40) >>> 0
      const pMslPath = m.alloc(0x80) >>> 0
      m.setU32(pMissile, 3)
      m.setU32((pMissile + 0x14) >>> 0, pMslData)
      m.setU32((pMissile + 0x20) >>> 0, 0x3579bdf5)
      m.setU32((pMissile + 0x24) >>> 0, 666)
      m.setU32((pMissile + 0x2c) >>> 0, pMslPath)
      m.setU32((pMslPath + 0x1c) >>> 0, pRoom)
      m.setU16((pMslData + 0x04) >>> 0, 20)
      m.setU16((pMslData + 0x06) >>> 0, 1)
      m.setU32((pMslData + 0x10) >>> 0, 0x601)

      const pTrade1 = m.alloc(0x20) >>> 0
      const pTrade2 = m.alloc(0x20) >>> 0
      m.setU32((pPlayerData + 0x5c) >>> 0, pTrade1)
      m.setU32((pPlayerData2 + 0x5c) >>> 0, pTrade2)

      const pAiArgs = m.alloc(0x30) >>> 0
      m.setU32(pAiArgs, pAiCtrl)

      const pQuestArg = m.alloc(0x20) >>> 0
      m.setU32(pQuestArg, pGame)
      m.setU32((pQuestArg + 0x08) >>> 0, pPlayer)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1a, 0)
      linkQuest(m, pGame, pQuestControl, 0x11, 0x11)

      const pkt = m.alloc(0x20) >>> 0
      const pOp = m.alloc(0x20) >>> 0
      m.setU32(pOp, pGame)
      m.setU32((pOp + 0x08) >>> 0, pPlayer)

      const pItemTarget = allocItem(m, 5, 0x604)
      PATH_SetTargetUnit113c(m, pPath, pItemTarget.pItem)
      const pEmptyInv = m.u32((pPlayer + 0x60) >>> 0) >>> 0
      void pEmptyInv

      beginVaTrace113c()
      ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c(m, pGame, pPlayer, 103)
      MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c(m, pGame, pMissile, () => 0)
      SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c(m, pGame, pPlayer, 20, 1, () => 0)
      SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c(m, pGame, pPlayer, 20, 1, () => 0)
      SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c(m, pGame, pPlayer, 20, 1, () => 0)
      SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c(m, pGame, pPlayer, 20, 1, () => 0)
      SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c(m, pGame, pPlayer, 20, 1, () => 0)
      SKILLS_SpawnBoneWallSegment_6FC70E60_113c(m, 20, pGame, pPlayer, 105, 105, 1, () => 0)
      SKILLS_SrvDo_BoneWall_6FC70FE0_113c(m, pGame, pPlayer, 20, 1, () => 0)
      SKILLS_SrvDo_IronGolem_6FC71540_113c(m, pGame, pPlayer, 20, 1, () => 0)
      CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c(m, pGame, pPlayer)
      PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c(m, pPlayerData, pPlayer, pPlayer2, pGame, pPlayerData2, () => 1)
      PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c(m, pPlayer, pGame)
      SKILLS_SrvDo_Valkyrie_6FCB5980_113c(m, pGame, pPlayer, 20, 1, () => 0)
      SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50_113c(m, pPlayer, pGame, 105, 105, pSk, 20, 1, () => 0)
      ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c(m, pQuestArg, () => {})
      NPCTRADE_EnsureVendorInventoryGenerated_6FCDF1C0_113c(m, (pNpcSlots + 0x20) >>> 0, pNpc, pGame, 0, () => {})
      NPCTRADE_InteractBuyItem_6FCDF200_113c(m, pGame, pPlayer, 0x603, 1, 0, 0, 10)
      NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c(m, pGame, pPlayer, pNpc, (pNpcSlots + 0x20) >>> 0)
      NPCTRADE_InteractRepairItem_6FCE1890_113c(m, pGame, pPlayer, 0x603, 1)
      ACT2Q2_CleanupHoradricStaffItemsOnEnterAct1_6FCE7D00_113c(m, pGame, pPlayer)
      C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c(m, pGame, pPlayer, pkt, 9)
      C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c(m, pGame, pPlayer, pkt, 9)
      C2S_Packet32_NpcBuyItem_6FCEF570_113c(m, pGame, pPlayer, pkt, 0x11, () => 1)
      C2S_Packet49_WaypointInteract_6FCF0D30_113c(m, pGame, pPlayer, pkt, 9)
      C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c(m, pGame, pPlayer, pkt, 0x11)
      C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c(m, pGame, pPlayer, pkt, 9)
      ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c(m, 0x604, pGame, pPlayer)
      ACT3Q3_CleanupKhalimItemsOnEnterAct2OrComplete_6FD087E0_113c(m, pGame, pPlayer)
      AI_MercOrShadowWarriorThink_6FCCC8E0_113c(m, pGame, pNpc, pAiArgs, () => {}, () => {})
      ACT3Q2_OperateGidbinnAltar_6FD09C80_113c(m, pOp)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    const missingVas = WAVE16_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
