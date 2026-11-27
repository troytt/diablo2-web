/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 7: +152 VAs).
 *
 * Audits and verifies 152 `D2Game.dll` (`0x6FC20000`) closure functions across:
 * - `k2w1-laneI-0x6fc3` (`src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c.ts`, 39 functions)
 * - `k2w2-b3` (`src/d2kern-113c/game/k2-w2b3-113c.ts`, 38 functions)
 * - `k2w7-b2` (`src/d2kern-113c/game/k2-w7b2-113c.ts`, 37 functions)
 * - `k2w13-b1` (`src/d2kern-113c/game/k2-w13b1-113c.ts`, 38 functions)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`.
 * 2. Differential regression tests for all genuine 1.13c binary disassembly discrepancies fixed.
 * 3. Multi-branch `SparseMemory113c` boundary/state assertions + 100% (`152 / 152`) live
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
  INVENTORY_AllocInventory113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_LinkItemToInventoryList113c,
  INVENTORY_SetCursorItem113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetItemCell113c,
  ITEMS_SetItemQuality113c,
  ITEMS_SetMagicPrefix113c,
  ITEMS_SetMagicSuffix113c,
  ITEMS_SetRarePrefix113c,
  ITEMS_SetRareSuffix113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts'
import {
  ITEMS_SetItemCell113c,
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATES_ToggleState113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { UNITS_InitPath113c } from '../../../src/d2kern-113c/common/unit.ts'
import {
  DATATABLES_LEVELS_TXT_COUNT_OFF_113C,
  DATATABLES_LEVELS_TXT_PTR_OFF_113C,
} from '../../../src/d2kern-113c/common/waypoint.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c,
  AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c,
  AIGENERAL_FreeMinionList_6FC40B30_113c,
  AI_CastNextPatrolPointSkill_6FC35F90_113c,
  AI_CountAdjacentUnitsCallback_6FC35590_113c,
  AI_CountNearbyMinion453Or461Callback_6FC35890_113c,
  AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c,
  AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c,
  AI_InitClearFreezeAndStall_6FC36060_113c,
  AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c,
  AI_ThinkMeleeOrApproach7_6FC372B0_113c,
  AI_ThinkSingleStrikeTurret_6FC360B0_113c,
  AI_ThinkSpecialGuard_6FC39640_113c,
  AI_ThinkStaticTrapAttack_6FC36190_113c,
  AI_ThinkTimedExpireOrStall_6FC36410_113c,
  AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c,
  ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c,
  ITEMS_CalcDiminishingMfPercent_6FC2E130_113c,
  ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c,
  ITEMS_CheckItemTxtSpawnable_6FC2F180_113c,
  ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c,
  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c,
  ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c,
  ITEMS_GetVendorHealthPotionCode_6FC2E390_113c,
  ITEMS_GetVendorManaPotionCode_6FC2E310_113c,
  ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c,
  ITEMS_TestUniqueSpawnedBit_6FC2E250_113c,
  MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c,
  MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c,
  MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c,
  MONUMOD_ApplyExtraFastVelocity_6FC42880_113c,
  MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c,
  MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c,
  MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c,
  MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c,
  MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c,
  MONUMOD_SetShatterOnDeath_6FC41A70_113c,
  MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c,
  SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c,
} from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c.ts'
import {
  AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c,
  AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c,
  MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c,
  MONMODE_EnterAnimMode10_6FC94C90_113c,
  MONMODE_EnterAnimMode6_6FC94C10_113c,
  MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c,
  MONMODE_EnterSequenceMode14_6FC954E0_113c,
  MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c,
  MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c,
  MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c,
  NET_SendPacket07_RoomTileCoords_6FCABF50_113c,
  NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c,
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c,
  NET_SendPacket42_ClearCursor_6FCAAF10_113c,
  NET_SendPacket47_UnitRelator1_6FCAAEC0_113c,
  NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c,
  NET_SendPacket60_PortalInfo_6FCAAAE0_113c,
  NET_SendPacket61_ByteParam_6FCAAAC0_113c,
  NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c,
  NET_SendPacket77_ButtonAction_6FCAB340_113c,
  NET_SendPacket79_GoldInTrade_6FCAB1F0_113c,
  NET_SendPacket7B_ByteAndDword_6FCAAD10_113c,
  NET_SendPacket98_UnitWordValue_6FCAA6C0_113c,
  NET_SendPacket9B_MercReviveInfo_6FCAA690_113c,
  NET_SendPacketA5_StateSkill_6FCABA10_113c,
  NET_SendPacketBuffer15B_6FCAABF0_113c,
  NET_SendPacketBuffer21B_6FCAAA70_113c,
  NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c,
  NET_SendPacketBuffer32B_6FCAAA10_113c,
  NET_SendPacketBuffer7B_6FCAAB20_113c,
  OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c,
  OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c,
  OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c,
  OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c,
  OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c,
  PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c,
  PLRTRADE_WalkTradeItemList_6FC8FFA0_113c,
  SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c,
} from '../../../src/d2kern-113c/game/k2-w2b3-113c.ts'
import {
  ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c,
  ACT1Q2_OnBloodRavenKilled_6FC85620_113c,
  ACT1Q3_ActivateQuestState1_6FC83D20_113c,
  ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c,
  ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c,
  ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c,
  ACT1Q4_OnCainGibbetOperated_6FC87730_113c,
  ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c,
  ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c,
  ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c,
  ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c,
  ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c,
  ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c,
  ACT1Q5_OnAndarielKilled_6FC88B90_113c,
  ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c,
  ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c,
  ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c,
  ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c,
  ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c,
  ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c,
  AI_Thinker_Izual_6FC9EA10_113c,
  CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c,
  MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c,
  OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c,
  OBJECTS_FloorSpikesEventTick_6FC8E270_113c,
  OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c,
  OBJECTS_OperateBankStash_6FC91290_113c,
  OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c,
  OBJECTS_OperateGemShrine_6FC8B430_113c,
  OBJECTS_OperatePortalShrine_6FC8B9B0_113c,
  SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c,
  SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c,
  SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c,
  SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c,
  SKILLS_TryConvertMonsterOnHit_6FCB5120_113c,
  STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c,
  STASH_HandleBankGoldOrCloseAction_6FC917E0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c.ts'
import {
  D2Game_6FC3E3D0_113c,
  D2Game_6FC7D690_113c,
  D2Game_6FC7DF70_113c,
  D2Game_6FC7E2A0_113c,
  D2Game_6FC8D620_113c,
  D2Game_6FC8E930_113c,
  D2Game_6FC8F4F0_113c,
  D2Game_6FC91E10_113c,
  D2Game_6FC93570_113c,
  D2Game_6FC93AA0_113c,
  D2Game_6FC93BA0_113c,
  D2Game_6FC98D00_113c,
  D2Game_6FCCA4D0_113c,
  D2Game_6FCCA710_113c,
  D2Game_6FCCAC30_113c,
  D2Game_6FCCB070_113c,
  D2Game_6FCCB360_113c,
  D2Game_6FCCB580_113c,
  D2Game_6FCCC410_113c,
  D2Game_6FCDB4F0_113c,
  D2Game_6FCDE2A0_113c,
  D2Game_6FCDE640_113c,
  D2Game_6FCDEE30_113c,
  D2Game_6FCDF990_113c,
  D2Game_6FCE1030_113c,
  D2Game_6FCE1510_113c,
  D2Game_6FCEF0E0_113c,
  D2Game_6FCEF810_113c,
  D2Game_6FCF08B0_113c,
  D2Game_6FCF12E0_113c,
  D2Game_6FCF7300_113c,
  D2Game_6FCF78C0_113c,
  D2Game_6FCF7CC0_113c,
  D2Game_6FCF8020_113c,
  D2Game_6FCF8600_113c,
  D2Game_6FD08EB0_113c,
  D2Game_6FD08F30_113c,
  D2Game_6FD095E0_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
  EVENT_SetEventFull113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemStatCostTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2ObjectsTxt_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'
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
  readonly batch: 'k2w1-laneI-0x6fc3' | 'k2w2-b3' | 'k2w7-b2' | 'k2w13-b1'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE7_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2DE20', size: 67, headHex: '85db578bf8741f8b', tailHex: '005fc3', tsSymbol: 'SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2E0A0', size: 117, headHex: '56e8bccaffff85c0', tailHex: '0000c3', tsSymbol: 'ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2E130', size: 31, headHex: '83f96e7f058bc1c2', tailHex: 'c20400', tsSymbol: 'ITEMS_CalcDiminishingMfPercent_6FC2E130_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2E150', size: 100, headHex: '568b716085f6751f', tailHex: '005ec3', tsSymbol: 'ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2E210', size: 63, headHex: '5633f68b07566a00', tailHex: 'ff5ec3', tsSymbol: 'ITEMS_ClearAffixesAndItemCell_6FC2E210_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2E250', size: 48, headHex: '85c07501c385c97c', tailHex: '0000c3', tsSymbol: 'ITEMS_TestUniqueSpawnedBit_6FC2E250_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2E310', size: 115, headHex: '568bf056e85fc1ff', tailHex: '6f5ec3', tsSymbol: 'ITEMS_GetVendorManaPotionCode_6FC2E310_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2E390', size: 115, headHex: '568bf056e8dfc0ff', tailHex: '6f5ec3', tsSymbol: 'ITEMS_GetVendorHealthPotionCode_6FC2E390_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2E800', size: 84, headHex: '568bf056e88fc0ff', tailHex: 'c15ec3', tsSymbol: 'ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2EAE0', size: 207, headHex: '85ff558b6c24180f', tailHex: 'c21800', tsSymbol: 'ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC2F180', size: 120, headHex: '85c07f05b8010000', tailHex: 'c20800', tsSymbol: 'ITEMS_CheckItemTxtSpawnable_6FC2F180_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC30700', size: 35, headHex: '56e8e8a2ffff85c0', tailHex: '0700c3', tsSymbol: 'ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC35590', size: 40, headHex: '53568b7424108b1e', tailHex: 'c20800', tsSymbol: 'AI_CountAdjacentUnitsCallback_6FC35590_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC35660', size: 92, headHex: '538b5c240885db56', tailHex: 'c20800', tsSymbol: 'AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC35890', size: 92, headHex: '568b7424083bd674', tailHex: 'c20800', tsSymbol: 'AI_CountNearbyMinion453Or461Callback_6FC35890_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC358F0', size: 191, headHex: '85f6558b6c240857', tailHex: 'c20400', tsSymbol: 'AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC35BB0', size: 142, headHex: '83ec2085f6741183', tailHex: 'c20400', tsSymbol: 'AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC35C40', size: 199, headHex: '538b5c240856578b', tailHex: 'c20800', tsSymbol: 'AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC35F90', size: 198, headHex: '5355568b30578b7e', tailHex: 'c20400', tsSymbol: 'AI_CastNextPatrolPointSkill_6FC35F90_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC36060', size: 68, headHex: '538b5c2408558b2b', tailHex: 'c20400', tsSymbol: 'AI_InitClearFreezeAndStall_6FC36060_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC360B0', size: 210, headHex: '8b44240483ec2055', tailHex: 'c20400', tsSymbol: 'AI_ThinkSingleStrikeTurret_6FC360B0_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC36190', size: 211, headHex: '8b44240483ec2053', tailHex: 'c20400', tsSymbol: 'AI_ThinkStaticTrapAttack_6FC36190_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC36410', size: 129, headHex: '8b44240483ec2056', tailHex: 'c20400', tsSymbol: 'AI_ThinkTimedExpireOrStall_6FC36410_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC372B0', size: 278, headHex: '8b44240483ec2053', tailHex: 'c20400', tsSymbol: 'AI_ThinkMeleeOrApproach7_6FC372B0_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC39640', size: 242, headHex: '51568bf285f6578b', tailHex: 'c20400', tsSymbol: 'AI_ThinkSpecialGuard_6FC39640_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC3EC40', size: 154, headHex: '0fb6c08b8483d800', tailHex: '5e5fc3', tsSymbol: 'MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC3EE50', size: 256, headHex: '53558b6c2410578b', tailHex: 'feffcc', tsSymbol: 'MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC40B30', size: 36, headHex: '85d2741f568b4f1c', tailHex: 'e35ec3', tsSymbol: 'AIGENERAL_FreeMinionList_6FC40B30_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC41040', size: 134, headHex: '8b5028568b703485', tailHex: 'feffcc', tsSymbol: 'AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC41590', size: 268, headHex: '568bf085f60f84df', tailHex: 'feffcc', tsSymbol: 'AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC41A70', size: 24, headHex: '85d274078b421085', tailHex: 'c20800', tsSymbol: 'MONUMOD_SetShatterOnDeath_6FC41A70_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC41A90', size: 52, headHex: '8b44240885c07507', tailHex: 'c20800', tsSymbol: 'MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC41AD0', size: 44, headHex: '8b44240885c07421', tailHex: 'c20800', tsSymbol: 'MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC41B00', size: 42, headHex: '85d2740c8b421083', tailHex: 'c20800', tsSymbol: 'MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC41BB0', size: 45, headHex: '8b44240885c07422', tailHex: 'c20800', tsSymbol: 'MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC41E80', size: 64, headHex: '568bf185f6743583', tailHex: 'c20400', tsSymbol: 'MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC41EC0', size: 159, headHex: '5653e8d984feff8b', tailHex: 'ff5ec3', tsSymbol: 'MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC42880', size: 126, headHex: '85c9747783390175', tailHex: 'c20400', tsSymbol: 'MONUMOD_ApplyExtraFastVelocity_6FC42880_113c' },
  { batch: 'k2w1-laneI-0x6fc3', va: '0x6FC42B10', size: 80, headHex: '53568bf285f68bd9', tailHex: 'c20800', tsSymbol: 'MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c' },
  { batch: 'k2w2-b3', va: '0x6FC89AD0', size: 44, headHex: '8b490485c9750433', tailHex: '33c0c3', tsSymbol: 'OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c' },
  { batch: 'k2w2-b3', va: '0x6FC89C00', size: 91, headHex: '56576a008bf18b46', tailHex: '5f5ec3', tsSymbol: 'OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c' },
  { batch: 'k2w2-b3', va: '0x6FC89C60', size: 50, headHex: '85c956be01000000', tailHex: 'c65ec3', tsSymbol: 'OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c' },
  { batch: 'k2w2-b3', va: '0x6FC89D60', size: 50, headHex: '568bf256e81d14fa', tailHex: '005ec3', tsSymbol: 'OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c' },
  { batch: 'k2w2-b3', va: '0x6FC89DA0', size: 58, headHex: '568bf285f6743166', tailHex: 'ff5ec3', tsSymbol: 'OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c' },
  { batch: 'k2w2-b3', va: '0x6FC8FFA0', size: 32, headHex: '50e81aa5f9ff85c0', tailHex: '75f9c3', tsSymbol: 'PLRTRADE_WalkTradeItemList_6FC8FFA0_113c' },
  { batch: 'k2w2-b3', va: '0x6FC8FFC0', size: 73, headHex: '50e8faa4f9ff85c0', tailHex: 'c20c00', tsSymbol: 'PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c' },
  { batch: 'k2w2-b3', va: '0x6FC94C10', size: 25, headHex: '578b7a0451e8365b', tailHex: '005fc3', tsSymbol: 'MONMODE_EnterAnimMode6_6FC94C10_113c' },
  { batch: 'k2w2-b3', va: '0x6FC94C90', size: 25, headHex: '578b7a0451e8b65a', tailHex: '005fc3', tsSymbol: 'MONMODE_EnterAnimMode10_6FC94C90_113c' },
  { batch: 'k2w2-b3', va: '0x6FC954E0', size: 45, headHex: '53568b7204578bd9', tailHex: '5e5bc3', tsSymbol: 'MONMODE_EnterSequenceMode14_6FC954E0_113c' },
  { batch: 'k2w2-b3', va: '0x6FC958D0', size: 34, headHex: '83ec208d1424526a', tailHex: 'c20400', tsSymbol: 'MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c' },
  { batch: 'k2w2-b3', va: '0x6FC959B0', size: 53, headHex: '568bf2578bf98bc6', tailHex: '005ec3', tsSymbol: 'MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c' },
  { batch: 'k2w2-b3', va: '0x6FC959F0', size: 65, headHex: '56578bf26a00568b', tailHex: '005ec3', tsSymbol: 'MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c' },
  { batch: 'k2w2-b3', va: '0x6FC96700', size: 56, headHex: '56578b7a048bf156', tailHex: '005ec3', tsSymbol: 'MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c' },
  { batch: 'k2w2-b3', va: '0x6FC98150', size: 97, headHex: '55568bf285f68be9', tailHex: 'c20c00', tsSymbol: 'MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c' },
  { batch: 'k2w2-b3', va: '0x6FC9A090', size: 95, headHex: '85f6750433c9eb03', tailHex: '03f9ff', tsSymbol: 'SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c' },
  { batch: 'k2w2-b3', va: '0x6FC9B9F0', size: 69, headHex: '538b5c2408568bf2', tailHex: 'c20800', tsSymbol: 'AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c' },
  { batch: 'k2w2-b3', va: '0x6FC9C8C0', size: 68, headHex: '538b5c2408558b2b', tailHex: 'c20400', tsSymbol: 'AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAA690', size: 39, headHex: '83ec086a078d5424', tailHex: 'c20400', tsSymbol: 'NET_SendPacket9B_MercReviveInfo_6FCAA690_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAA6C0', size: 53, headHex: '83ec0833c0890424', tailHex: 'c20400', tsSymbol: 'NET_SendPacket98_UnitWordValue_6FCAA6C0_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAA9C0', size: 69, headHex: '83ec0c85c08a5424', tailHex: 'c20800', tsSymbol: 'NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAAA10', size: 42, headHex: '83ec2056578bf06a', tailHex: 'c20400', tsSymbol: 'NET_SendPacketBuffer32B_6FCAAA10_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAAA70', size: 65, headHex: '83ec188b088b5004', tailHex: 'c20400', tsSymbol: 'NET_SendPacketBuffer21B_6FCAAA70_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAAAC0', size: 30, headHex: '516a028d4c240488', tailHex: 'c20400', tsSymbol: 'NET_SendPacket61_ByteParam_6FCAAAC0_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAAAE0', size: 57, headHex: '83ec0856c6442404', tailHex: 'c20400', tsSymbol: 'NET_SendPacket60_PortalInfo_6FCAAAE0_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAAB20', size: 46, headHex: '83ec088b08668b50', tailHex: 'c20400', tsSymbol: 'NET_SendPacketBuffer7B_6FCAAB20_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAABF0', size: 60, headHex: '83ec108b088b5004', tailHex: 'c20400', tsSymbol: 'NET_SendPacketBuffer15B_6FCAABF0_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAAC90', size: 52, headHex: '83ec108804248b44', tailHex: 'c20c00', tsSymbol: 'NET_SendPacket15B_TransactionResult_6FCAAC90_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAAD10', size: 36, headHex: '83ec088804246a07', tailHex: 'c20400', tsSymbol: 'NET_SendPacket7B_ByteAndDword_6FCAAD10_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAAE60', size: 86, headHex: '83ec0c8a54241433', tailHex: 'c20800', tsSymbol: 'NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAAEC0', size: 78, headHex: '83ec0c33c985c089', tailHex: 'c20400', tsSymbol: 'NET_SendPacket47_UnitRelator1_6FCAAEC0_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAAF10', size: 70, headHex: '83ec0833c985c089', tailHex: 'c20400', tsSymbol: 'NET_SendPacket42_ClearCursor_6FCAAF10_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAB1F0', size: 38, headHex: '83ec086a068d5424', tailHex: 'c20400', tsSymbol: 'NET_SendPacket79_GoldInTrade_6FCAB1F0_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAB2F0', size: 65, headHex: '83ec188b088b5004', tailHex: 'c20400', tsSymbol: 'NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAB340', size: 30, headHex: '516a028d4c240488', tailHex: 'c20400', tsSymbol: 'NET_SendPacket77_ButtonAction_6FCAB340_113c' },
  { batch: 'k2w2-b3', va: '0x6FCAB9B0', size: 89, headHex: '83ec0c663dff0072', tailHex: 'c21000', tsSymbol: 'NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c' },
  { batch: 'k2w2-b3', va: '0x6FCABA10', size: 57, headHex: '83ec0833c0890424', tailHex: 'c20800', tsSymbol: 'NET_SendPacketA5_StateSkill_6FCABA10_113c' },
  { batch: 'k2w2-b3', va: '0x6FCABF50', size: 48, headHex: '83ec088a54241066', tailHex: 'c20800', tsSymbol: 'NET_SendPacket07_RoomTileCoords_6FCABF50_113c' },
  { batch: 'k2w13-b1', va: '0x6FC3E3D0', size: 617, headHex: '83ec1085ff8b481c', tailHex: 'c20400', tsSymbol: 'D2Game_6FC3E3D0_113c' },
  { batch: 'k2w13-b1', va: '0x6FC7D690', size: 207, headHex: '53558be98b45008b', tailHex: 'c05bc3', tsSymbol: 'D2Game_6FC7D690_113c' },
  { batch: 'k2w13-b1', va: '0x6FC7DF70', size: 129, headHex: '538bd98b038b80f4', tailHex: 'c05bc3', tsSymbol: 'D2Game_6FC7DF70_113c' },
  { batch: 'k2w13-b1', va: '0x6FC7E2A0', size: 282, headHex: '53568bd9578b3b8b', tailHex: 'c05bc3', tsSymbol: 'D2Game_6FC7E2A0_113c' },
  { batch: 'k2w13-b1', va: '0x6FC8D620', size: 275, headHex: '568bf18b46045750', tailHex: 'c05ec3', tsSymbol: 'D2Game_6FC8D620_113c' },
  { batch: 'k2w13-b1', va: '0x6FC8E930', size: 515, headHex: '83ec2485db751f68', tailHex: 'c20400', tsSymbol: 'D2Game_6FC8E930_113c' },
  { batch: 'k2w13-b1', va: '0x6FC8F4F0', size: 29, headHex: '8b410485c074138b', tailHex: '33c0c3', tsSymbol: 'D2Game_6FC8F4F0_113c' },
  { batch: 'k2w13-b1', va: '0x6FC91E10', size: 1016, headHex: '83ec1c535556578b', tailHex: 'c20800', tsSymbol: 'D2Game_6FC91E10_113c' },
  { batch: 'k2w13-b1', va: '0x6FC93570', size: 715, headHex: '515356578bf2568b', tailHex: 'c20800', tsSymbol: 'D2Game_6FC93570_113c' },
  { batch: 'k2w13-b1', va: '0x6FC93AA0', size: 252, headHex: '8a4f6c84c98b5764', tailHex: '5e5bc3', tsSymbol: 'D2Game_6FC93AA0_113c' },
  { batch: 'k2w13-b1', va: '0x6FC93BA0', size: 475, headHex: '83ec0853558b6c24', tailHex: 'c20c00', tsSymbol: 'D2Game_6FC93BA0_113c' },
  { batch: 'k2w13-b1', va: '0x6FC98D00', size: 197, headHex: '53558b6c240c5657', tailHex: 'c20800', tsSymbol: 'D2Game_6FC98D00_113c' },
  { batch: 'k2w13-b1', va: '0x6FCCA4D0', size: 564, headHex: '83ec105356578bfa', tailHex: 'c20400', tsSymbol: 'D2Game_6FCCA4D0_113c' },
  { batch: 'k2w13-b1', va: '0x6FCCA710', size: 1308, headHex: '83ec1053558b6c24', tailHex: 'c20800', tsSymbol: 'D2Game_6FCCA710_113c' },
  { batch: 'k2w13-b1', va: '0x6FCCAC30', size: 1088, headHex: '83ec18538b581c8b', tailHex: 'c20400', tsSymbol: 'D2Game_6FCCAC30_113c' },
  { batch: 'k2w13-b1', va: '0x6FCCB070', size: 742, headHex: '83ec1c53568b7424', tailHex: 'c20400', tsSymbol: 'D2Game_6FCCB070_113c' },
  { batch: 'k2w13-b1', va: '0x6FCCB360', size: 532, headHex: '83ec0c8b44241053', tailHex: 'c20400', tsSymbol: 'D2Game_6FCCB360_113c' },
  { batch: 'k2w13-b1', va: '0x6FCCB580', size: 3618, headHex: '81ec440400008b84', tailHex: 'c20400', tsSymbol: 'D2Game_6FCCB580_113c' },
  { batch: 'k2w13-b1', va: '0x6FCCC410', size: 1220, headHex: '83ec205355568b74', tailHex: 'c20400', tsSymbol: 'D2Game_6FCCC410_113c' },
  { batch: 'k2w13-b1', va: '0x6FCDB4F0', size: 92, headHex: '83ec08576a0050bf', tailHex: 'c408c3', tsSymbol: 'D2Game_6FCDB4F0_113c' },
  { batch: 'k2w13-b1', va: '0x6FCDE2A0', size: 921, headHex: '83ec1c558b6c2424', tailHex: 'c20800', tsSymbol: 'D2Game_6FCDE2A0_113c' },
  { batch: 'k2w13-b1', va: '0x6FCDE640', size: 2021, headHex: '8b4c240483ec2c85', tailHex: 'c21800', tsSymbol: 'D2Game_6FCDE640_113c' },
  { batch: 'k2w13-b1', va: '0x6FCDEE30', size: 831, headHex: '83ec0856578bf885', tailHex: 'c21400', tsSymbol: 'D2Game_6FCDEE30_113c' },
  { batch: 'k2w13-b1', va: '0x6FCDF990', size: 1539, headHex: '83ec1c538b5c242c', tailHex: 'c21000', tsSymbol: 'D2Game_6FCDF990_113c' },
  { batch: 'k2w13-b1', va: '0x6FCE1030', size: 531, headHex: '83ec18558b6c2420', tailHex: 'c20c00', tsSymbol: 'D2Game_6FCE1030_113c' },
  { batch: 'k2w13-b1', va: '0x6FCE1510', size: 894, headHex: '83ec5c53558b6c24', tailHex: 'c21000', tsSymbol: 'D2Game_6FCE1510_113c' },
  { batch: 'k2w13-b1', va: '0x6FCEF0E0', size: 314, headHex: '837c24081155568b', tailHex: 'c20800', tsSymbol: 'D2Game_6FCEF0E0_113c' },
  { batch: 'k2w13-b1', va: '0x6FCEF810', size: 797, headHex: '83ec1053558b6c24', tailHex: 'c21000', tsSymbol: 'D2Game_6FCEF810_113c' },
  { batch: 'k2w13-b1', va: '0x6FCF08B0', size: 91, headHex: '837c24080d7408b8', tailHex: 'c20800', tsSymbol: 'D2Game_6FCF08B0_113c' },
  { batch: 'k2w13-b1', va: '0x6FCF12E0', size: 144, headHex: '837c24080353568b', tailHex: 'c20800', tsSymbol: 'D2Game_6FCF12E0_113c' },
  { batch: 'k2w13-b1', va: '0x6FCF7300', size: 918, headHex: '558b6c240c56578b', tailHex: 'c21800', tsSymbol: 'D2Game_6FCF7300_113c' },
  { batch: 'k2w13-b1', va: '0x6FCF78C0', size: 1016, headHex: '83ec34538b5c2444', tailHex: 'f2ffcc', tsSymbol: 'D2Game_6FCF78C0_113c' },
  { batch: 'k2w13-b1', va: '0x6FCF7CC0', size: 363, headHex: '558b6c240885ed56', tailHex: 'c20c00', tsSymbol: 'D2Game_6FCF7CC0_113c' },
  { batch: 'k2w13-b1', va: '0x6FCF8020', size: 744, headHex: '83ec0c5356578b7c', tailHex: 'c21000', tsSymbol: 'D2Game_6FCF8020_113c' },
  { batch: 'k2w13-b1', va: '0x6FCF8600', size: 870, headHex: '83ec085356578b7c', tailHex: 'c21000', tsSymbol: 'D2Game_6FCF8600_113c' },
  { batch: 'k2w13-b1', va: '0x6FD08EB0', size: 115, headHex: '8b018b80f4100000', tailHex: 'f2ffc3', tsSymbol: 'D2Game_6FD08EB0_113c' },
  { batch: 'k2w13-b1', va: '0x6FD08F30', size: 174, headHex: '83ec0c5355568bea', tailHex: 'c40cc3', tsSymbol: 'D2Game_6FD08F30_113c' },
  { batch: 'k2w13-b1', va: '0x6FD095E0', size: 25, headHex: '8b410485c0740f83', tailHex: '33c0c3', tsSymbol: 'D2Game_6FD095E0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC7CFF0', size: 139, headHex: '53568bf285f68bd9', tailHex: 'c20400', tsSymbol: 'ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC7D1D0', size: 428, headHex: '83ec14538bd88b44', tailHex: 'c20400', tsSymbol: 'ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC7D380', size: 401, headHex: '83ec14558b6c241c', tailHex: 'c20400', tsSymbol: 'ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c' },
  { batch: 'k2w7-b2', va: '0x6FC83570', size: 58, headHex: 'a1201cd36f85c056', tailHex: '5b5ec3', tsSymbol: 'ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c' },
  { batch: 'k2w7-b2', va: '0x6FC835B0', size: 32, headHex: 'a1201cd36f85c074', tailHex: 'c20400', tsSymbol: 'ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC837E0', size: 139, headHex: '5650e8d96cfaff0f', tailHex: '0600c3', tsSymbol: 'ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC83BB0', size: 139, headHex: '5650e80969faff0f', tailHex: '0600c3', tsSymbol: 'ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC83D20', size: 75, headHex: '81ec80000000568b', tailHex: '0000c3', tsSymbol: 'ACT1Q3_ActivateQuestState1_6FC83D20_113c' },
  { batch: 'k2w7-b2', va: '0x6FC847B0', size: 248, headHex: '8b80f410000083ec', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC84940', size: 346, headHex: '81ec800000005355', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c' },
  { batch: 'k2w7-b2', va: '0x6FC84C10', size: 277, headHex: '81ec80000000568b', tailHex: '0000c3', tsSymbol: 'ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c' },
  { batch: 'k2w7-b2', va: '0x6FC85620', size: 320, headHex: '81ec840000005657', tailHex: '0000c3', tsSymbol: 'ACT1Q2_OnBloodRavenKilled_6FC85620_113c' },
  { batch: 'k2w7-b2', va: '0x6FC87320', size: 374, headHex: '83ec1c56578bfa57', tailHex: 'c20400', tsSymbol: 'ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c' },
  { batch: 'k2w7-b2', va: '0x6FC874A0', size: 644, headHex: '83ec1c558b6c2424', tailHex: 'c20800', tsSymbol: 'ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC87730', size: 856, headHex: '8b4424048b80f410', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q4_OnCainGibbetOperated_6FC87730_113c' },
  { batch: 'k2w7-b2', va: '0x6FC87A90', size: 462, headHex: '83ec1885c98b5218', tailHex: 'c418c3', tsSymbol: 'ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c' },
  { batch: 'k2w7-b2', va: '0x6FC88280', size: 309, headHex: '558b6c2408568b75', tailHex: 'c20c00', tsSymbol: 'ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c' },
  { batch: 'k2w7-b2', va: '0x6FC88AB0', size: 224, headHex: '83ec08558be98b45', tailHex: 'c408c3', tsSymbol: 'ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC88B90', size: 389, headHex: '81ec840000005355', tailHex: '0000c3', tsSymbol: 'ACT1Q5_OnAndarielKilled_6FC88B90_113c' },
  { batch: 'k2w7-b2', va: '0x6FC88D20', size: 66, headHex: '8b46185056e866d1', tailHex: 'c20400', tsSymbol: 'ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c' },
  { batch: 'k2w7-b2', va: '0x6FC8AE60', size: 117, headHex: '83ec0853558b6c24', tailHex: 'c20400', tsSymbol: 'OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c' },
  { batch: 'k2w7-b2', va: '0x6FC8B430', size: 290, headHex: '535556578bf98b47', tailHex: '5d5bc3', tsSymbol: 'OBJECTS_OperateGemShrine_6FC8B430_113c' },
  { batch: 'k2w7-b2', va: '0x6FC8B930', size: 116, headHex: '5156578bfa578bf1', tailHex: '5e59c3', tsSymbol: 'OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c' },
  { batch: 'k2w7-b2', va: '0x6FC8B9B0', size: 432, headHex: '83ec2055578bf98b', tailHex: 'c420c3', tsSymbol: 'OBJECTS_OperatePortalShrine_6FC8B9B0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC8E0E0', size: 112, headHex: '568bf18b460485c0', tailHex: 'c05ec3', tsSymbol: 'OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC8E270', size: 393, headHex: '83ec105355568bf2', tailHex: 'c410c3', tsSymbol: 'OBJECTS_FloorSpikesEventTick_6FC8E270_113c' },
  { batch: 'k2w7-b2', va: '0x6FC91170', size: 94, headHex: '53558b6c240c5657', tailHex: 'c20400', tsSymbol: 'CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c' },
  { batch: 'k2w7-b2', va: '0x6FC91270', size: 26, headHex: 'c74064ffffffffc7', tailHex: 'c20400', tsSymbol: 'STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c' },
  { batch: 'k2w7-b2', va: '0x6FC91290', size: 154, headHex: '568bf1817e100b01', tailHex: 'c05ec3', tsSymbol: 'OBJECTS_OperateBankStash_6FC91290_113c' },
  { batch: 'k2w7-b2', va: '0x6FC917E0', size: 448, headHex: '53558b6c24108bda', tailHex: 'c20800', tsSymbol: 'STASH_HandleBankGoldOrCloseAction_6FC917E0_113c' },
  { batch: 'k2w7-b2', va: '0x6FC95A40', size: 536, headHex: '83ec1c85ff0f8407', tailHex: 'c20800', tsSymbol: 'MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c' },
  { batch: 'k2w7-b2', va: '0x6FC9EA10', size: 893, headHex: '83ec388b44243c53', tailHex: 'c20400', tsSymbol: 'AI_Thinker_Izual_6FC9EA10_113c' },
  { batch: 'k2w7-b2', va: '0x6FCB2DF0', size: 213, headHex: '83ec085355568b74', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c' },
  { batch: 'k2w7-b2', va: '0x6FCB4B10', size: 679, headHex: '83ec785556578bbc', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c' },
  { batch: 'k2w7-b2', va: '0x6FCB5120', size: 581, headHex: '5153558b6c241456', tailHex: 'c20800', tsSymbol: 'SKILLS_TryConvertMonsterOnHit_6FCB5120_113c' },
  { batch: 'k2w7-b2', va: '0x6FCB5BC0', size: 388, headHex: '53558b6c240c85ed', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c' },
  { batch: 'k2w7-b2', va: '0x6FCB5FE0', size: 440, headHex: '83ec10538b5c2418', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c' },
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

class BitWriter {
  private readonly bytes: number[] = []
  private bitPos = 0

  writeBits(val: number, width: number): void {
    const u = val >>> 0
    for (let i = 0; i < width; i++) {
      const byteIdx = this.bitPos >> 3
      const bitIdx = this.bitPos & 7
      while (this.bytes.length <= byteIdx) this.bytes.push(0)
      if (((u >>> i) & 1) !== 0) {
        this.bytes[byteIdx] = (this.bytes[byteIdx]! | (1 << bitIdx)) & 0xff
      }
      this.bitPos++
    }
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes)
  }
}

function allocBitBuffer(m: SparseMemory113c): number {
  const pBitBuf = m.alloc(0x10) >>> 0
  const pBytes = m.alloc(0x60) >>> 0
  m.setU32(pBitBuf, pBytes)
  m.setU32((pBitBuf + 4) >>> 0, 0x300)
  return pBitBuf
}

function createWave7World() {
  const m = new SparseMemory113c()
  m.fill(0x6fd18000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x28000, 0)
  m.fill(0x7e2f0000, 0x20000, 0)

  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)

  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const pInvBitMasks = m.alloc(128) >>> 0
  for (let i = 0; i < 32; i++) {
    const bit = (1 << i) >>> 0
    m.setU32((pBitMasks + i * 4) >>> 0, bit)
    m.setU32((pInvBitMasks + i * 4) >>> 0, (~bit) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pBitMasks)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.setU32(0x6fd182a4, pBitMasks)
  m.setU32(0x6fd27060, pBitMasks)
  m.setU32(0x6fd27c30, pBitMasks)
  m.setU32(0x6fd18bac, pInvBitMasks)

  const pDataTablesSlot = m.alloc(4) >>> 0
  m.setU32(pDataTablesSlot, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pDataTablesSlot)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(0x6fd270b0, pDataTablesSlot)
  m.setU32(0x6fd27d08, pDataTables)

  // Experience.txt & BODY_GRID_DEF_VA_113C
  const pExpBin = m.alloc(0x40) >>> 0
  for (let c = 0; c < 8; c++) m.setU32((pExpBin + c * 4) >>> 0, 99)
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin)
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)
  m.setU32(0x6fd18d10, 1000)
  m.setU32(0x6fd31c20, 0)
  m.fill(0x6fde4080, 0x30, 0)
  m.setU32(0x6fd27bb8 + 4, 0x6fc8cf90)

  // MonStatsTxt (600 rows * 0x1A8) with wMonStatsEx (+0x18) populated
  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec = (pMonStatsTxt + i * 0x1a8) >>> 0
    m.setU16(rec, i)
    m.setU16((rec + 0x02) >>> 0, i)
    m.setU16((rec + 0x06) >>> 0, i)
    m.setU16((rec + 0x18) >>> 0, i)
  }

  // MonStats2Txt (600 rows)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa8c) >>> 0, monStatsCount)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)

  // SkillsTxt (300 rows * 0x23C)
  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c) >>> 0
  m.setU32((pDataTables + 0xb90) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)

  // StatesTxt (200 rows * 0x40) + state mask arrays
  const statesCount = 200
  const pStatesTxt = m.alloc(statesCount * 0x40) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pStatesTxt) >>> 0, pStatesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0, statesCount)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksDC) >>> 0, m.alloc(32) >>> 0)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksAura) >>> 0, m.alloc(32) >>> 0)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksExp) >>> 0, m.alloc(32) >>> 0)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksOnCurse) >>> 0, m.alloc(32) >>> 0)
  m.setU32((pDataTables + 0xbbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xbc0) >>> 0, statesCount)

  // ItemStatCostTxt (360 rows)
  const iscCount = 360
  const pItemStatCostTxt = m.alloc(iscCount * D2ItemStatCostTxt_SIZE) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0, pItemStatCostTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0, iscCount)
  m.setU32((pDataTables + 0xbcc) >>> 0, pItemStatCostTxt)
  m.setU32((pDataTables + 0xbd4) >>> 0, iscCount)

  // ItemsTxt (100 rows) + linker
  const itemsCount = 100
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE) >>> 0
  m.setU32(SG_ITEM_DATATABLES_VA_113C, itemsCount)
  m.setU32((SG_ITEM_DATATABLES_VA_113C + 4) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xbd8) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xbdc) >>> 0, itemsCount)
  const pItemsLinker = m.alloc(0x40) >>> 0
  m.setU32(0x6fdeff6c, pItemsLinker)

  // ItemTypesTxt & self-equivalence bitset (64 rows)
  const itemTypesCount = 64
  const pItemTypesTxt = m.alloc(itemTypesCount * D2ItemTypesTxt_SIZE) >>> 0
  const pItemTypesEquiv = m.alloc(itemTypesCount * 8) >>> 0
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemTypesTxtRecordCount) >>> 0, itemTypesCount)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemTypesEquivDwords) >>> 0, 2)
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemTypesEquiv) >>> 0, pItemTypesEquiv)
  for (let t = 0; t < itemTypesCount; t++) {
    m.setU32((pItemTypesEquiv + (t * 2 + (t >> 5)) * 4) >>> 0, (1 << (t & 31)) >>> 0)
  }

  // ObjectsTxt (64 rows)
  const pObjectsTxt = m.alloc(64 * D2ObjectsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0x9c) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xa4) >>> 0, 64)
  m.setU32((pDataTables + 0x9c8) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0x9d0) >>> 0, 64)
  m.setU32(0x6fdf0b54, pObjectsTxt)
  m.setU32(0x6fdf0b58, 64)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 64)
  m.setU32(0x6fdf143c, pObjectsTxt)
  m.setU32(0x6fdf1440, 64)

  // LevelsTxt (140 rows)
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

  // AnimData table
  const pAnimDataTable = m.alloc(0x500) >>> 0
  const pEmptyBucket = m.alloc(16) >>> 0
  for (let i = 0; i < 256; i++) m.setU32((pAnimDataTable + i * 4) >>> 0, pEmptyBucket)
  m.setU32((pAnimDataTable + 0x40c) >>> 0, 8)
  m.setU32((pAnimDataTable + 0x410) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13a4, 16)
  m.setU32(0x6fdf13b0, m.alloc(16 * 0x34) >>> 0)

  // Game + Timer Wheel + Quest Control
  const pGame = m.alloc(0x2000) >>> 0
  m.setU32((pGame + 0x1c) >>> 0, 0x12340000)
  m.setU32((pGame + 0x70) >>> 0, 1) // bExpansion = 1
  m.setU16((pGame + 0x78) >>> 0, 101)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  EVENT_InitTimerQueue113c(m, pGame)

  const pQuestCtrl = m.alloc(0x40) >>> 0
  m.setU32((pQuestCtrl + 8) >>> 0, 1)
  m.setU32((pQuestCtrl + 0x0c) >>> 0, allocBitBuffer(m))
  m.setU32((pQuestCtrl + 0x18) >>> 0, 0x12345678)
  m.setU32((pQuestCtrl + 0x1c) >>> 0, 666)
  m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)

  return {
    m,
    pGame,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pStatesTxt,
    pItemStatCostTxt,
    pItemsTxt,
    pItemTypesTxt,
    pObjectsTxt,
    pLevelsTxt,
    pQuestCtrl,
  }
}

function allocClientWithQueue(m: SparseMemory113c): { pClient: number; pQueue: number } {
  const pClient = m.alloc(0x500) >>> 0
  const pQueue = m.alloc(0x40c) >>> 0
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)
  return { pClient, pQueue }
}

function readQueuedBytes(m: SparseMemory113c, pQueue: number, nSize: number): number[] {
  const out: number[] = []
  for (let i = 0; i < nSize; i++) out.push(m.u8((pQueue + 0x04 + i) >>> 0))
  return out
}

function allocRoom(m: SparseMemory113c, levelId: number, x = 80, y = 80): {
  pRoom: number
  pRoomEx: number
  pLevel: number
} {
  const pRoom = m.alloc(0x100) >>> 0
  const pRoomEx = m.alloc(0x90) >>> 0
  const pLevel = m.alloc(0x200) >>> 0
  const pGrid = m.alloc(0x28) >>> 0
  const pMap = m.alloc(40 * 40 * 2) >>> 0
  const ppRoomsNear = m.alloc(4) >>> 0
  m.setU32(ppRoomsNear, pRoom)
  m.setU32(pGrid, (x - 10) >>> 0)
  m.setU32((pGrid + 0x04) >>> 0, (y - 10) >>> 0)
  m.setU32((pGrid + 0x08) >>> 0, 40)
  m.setU32((pGrid + 0x0c) >>> 0, 40)
  m.setU32((pGrid + 0x20) >>> 0, pMap)
  m.setU32(pRoom, ppRoomsNear)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoom + 0x20) >>> 0, pGrid)
  m.setU32((pRoom + 0x24) >>> 0, 1)
  m.setU32((pRoom + 0x4c) >>> 0, (x - 10) >>> 0)
  m.setU32((pRoom + 0x50) >>> 0, (y - 10) >>> 0)
  m.setU32((pRoom + 0x54) >>> 0, 40)
  m.setU32((pRoom + 0x58) >>> 0, 40)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  m.setU32((pLevel + 0x1d0) >>> 0, levelId)
  return { pRoom, pRoomEx, pLevel }
}

function allocPlayer(m: SparseMemory113c, pGame: number, guid: number, pRoom = 0, x = 100, y = 100) {
  const pPlayer = m.alloc(0x100) >>> 0
  const pPlayerData = m.alloc(0x180) >>> 0
  const pPath = m.alloc(0x100) >>> 0
  const { pClient, pQueue } = allocClientWithQueue(m)
  const pQuestFlags = allocBitBuffer(m)
  const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer) >>> 0

  m.setU32(pPlayer, 0)
  m.setU32((pPlayer + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pPlayer + 0x10) >>> 0, 1)
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
  m.setU32((pPlayer + 0x2c) >>> 0, pPath)
  m.setU32((pPlayer + 0x60) >>> 0, pInv)
  m.setU32((pPlayer + 0x80) >>> 0, pGame)

  m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
  m.setU32((pClient + 0x1a8) >>> 0, pGame)
  m.setU32((pClient + 0x174) >>> 0, pPlayer)

  m.setU32((pPath + 0x00) >>> 0, x << 16)
  m.setU32((pPath + 0x04) >>> 0, y << 16)
  m.setU16((pPath + 0x02) >>> 0, x)
  m.setU16((pPath + 0x06) >>> 0, y)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)
  m.setU32((pPath + 0x30) >>> 0, pPlayer)

  STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
  SUNIT_InsertServerUnit113c(m, pGame, pPlayer)
  return { pPlayer, pPlayerData, pPath, pClient, pQueue, pQuestFlags, pInv }
}

function allocMonster(
  m: SparseMemory113c,
  pGame: number,
  classId: number,
  guid: number,
  x = 100,
  y = 100,
  levelId = 2,
) {
  const { pRoom, pRoomEx, pLevel } = allocRoom(m, levelId, x, y)
  const pMonster = m.alloc(0x100) >>> 0
  const pMonData = m.alloc(0x60) >>> 0
  const pAiGen = m.alloc(0x48) >>> 0
  const pAiCtrl = m.alloc(0x48) >>> 0
  const pPath = m.alloc(0x100) >>> 0
  const pSkills = m.alloc(0x20) >>> 0

  m.setU32((pPath + 0x00) >>> 0, x << 16)
  m.setU32((pPath + 0x04) >>> 0, y << 16)
  m.setU16((pPath + 0x02) >>> 0, x)
  m.setU16((pPath + 0x06) >>> 0, y)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)
  m.setU32((pPath + 0x30) >>> 0, pMonster)

  m.setU32(pMonster, 1)
  m.setU32((pMonster + 0x04) >>> 0, classId >>> 0)
  m.setU32((pMonster + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pMonster + 0x10) >>> 0, 1)
  m.setU32((pMonster + 0x14) >>> 0, pMonData)
  m.setU32((pMonster + 0x20) >>> 0, 12345)
  m.setU32((pMonster + 0x24) >>> 0, 666)
  m.setU32((pMonster + 0x2c) >>> 0, pPath)
  m.setU32((pMonster + 0x80) >>> 0, pGame)
  m.setU32((pMonster + 0xa8) >>> 0, pSkills)
  m.setU32((pMonster + 0xc4) >>> 0, 0x04)

  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const pMonStatsBase = pTables !== 0 ? m.u32((pTables + 0xa78) >>> 0) : 0
  if (pMonStatsBase !== 0 && classId >= 0) {
    m.setU32(pMonData, (pMonStatsBase + classId * 0x1a8) >>> 0)
  }
  m.setU32((pMonData + 0x28) >>> 0, pAiGen)
  m.setU32((pMonData + 0x2c) >>> 0, pAiCtrl)
  m.setU32((pAiGen + 0x28) >>> 0, pGame)
  m.setU32((pAiGen + 0x2c) >>> 0, 0xffffffff)
  m.setU32((pAiGen + 0x30) >>> 0, 1)

  STATLIST_CreateEx113c(m, pMonster, 1, pGame)
  STATLIST_SetUnitStat113c(m, pMonster, 6, 25600, 0)
  STATLIST_SetUnitStat113c(m, pMonster, 7, 25600, 0)
  SUNIT_InsertServerUnit113c(m, pGame, pMonster)
  return { pMonster, pMonData, pAiGen, pAiCtrl, pPath, pRoom, pRoomEx, pLevel, pSkills }
}

function allocItem(m: SparseMemory113c, pGame: number, classId: number, guid: number, quality = 2) {
  const pItem = m.alloc(0x100) >>> 0
  const pItemData = m.alloc(0x74) >>> 0
  const pPath = m.alloc(0x20) >>> 0
  m.setU32(pItem, 4)
  m.setU32((pItem + 0x04) >>> 0, classId >>> 0)
  m.setU32((pItem + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pItem + 0x14) >>> 0, pItemData)
  m.setU32((pItem + 0x2c) >>> 0, pPath)
  m.setU32((pItem + 0x80) >>> 0, pGame)
  ITEMS_SetItemQuality113c(m, pItem, quality)
  STATLIST_CreateEx113c(m, pItem, 0, pGame)
  SUNIT_InsertServerUnit113c(m, pGame, pItem)
  return { pItem, pItemData, pPath }
}

function allocObject(m: SparseMemory113c, classId = 0, pRoom = 0, guid = 500) {
  const pObj = m.alloc(0x100) >>> 0
  const pStaticPath = m.alloc(0x40) >>> 0
  const pObjData = m.alloc(0x40) >>> 0
  m.setU32(pStaticPath, pRoom >>> 0)
  m.setU32(pObj, 2)
  m.setU32((pObj + 0x04) >>> 0, classId >>> 0)
  m.setU32((pObj + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pObj + 0x14) >>> 0, pObjData)
  m.setU32((pObj + 0x2c) >>> 0, pStaticPath)
  return { pObj, pStaticPath, pObjData }
}

describe('K2 Disassembly Verification Wave 7 (+152 D2Game.dll v1.13c VAs)', () => {
  it('verifies all 152 promoted VAs against PE32 D2Game.dll .text machine code and manifest diff-verified entries', () => {
    expect(WAVE7_PROMOTED_SPECS.length).toBe(152)

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
    const byVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        byVa.set(fn.va.toUpperCase(), fn)
      }
    }

    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    const hasDll = fs.existsSync(dllPath)
    const pe = hasDll ? loadPeSectionMapper(dllPath, 0x6fc20000) : null

    for (const spec of WAVE7_PROMOTED_SPECS) {
      const fn = byVa.get(spec.va.toUpperCase())
      expect(fn, `Missing manifest entry for ${spec.va}`).toBeDefined()
      expect(fn!.status, `${spec.va} status`).toBe('diff-verified')
      expect(fn!.tsSymbol, `${spec.va} tsSymbol`).toBe(spec.tsSymbol)
      expect(fn!.size, `${spec.va} size`).toBe(spec.size)
      expect(fn!.indirectUnknown ?? false, `${spec.va} indirectUnknown`).toBe(false)
      expect((fn!.diffEvidence ?? '').length, `${spec.va} diffEvidence`).toBeGreaterThan(20)

      if (pe) {
        const vaNum = Number.parseInt(spec.va, 16)
        expect(vaNum).toBeGreaterThanOrEqual(pe.textStart)
        expect(vaNum + spec.size).toBeLessThanOrEqual(pe.textEnd)
        const off = pe.vaToFileOffset(vaNum)
        const headLen = spec.headHex.length / 2
        const tailLen = spec.tailHex.length / 2
        expect(pe.buf.subarray(off, off + headLen).toString('hex')).toBe(spec.headHex)
        expect(pe.buf.subarray(off + spec.size - tailLen, off + spec.size).toString('hex')).toBe(
          spec.tailHex,
        )
      }
    }
  })

  it('differential regressions: k2-w2b3 & k2-laneI-0x6fc3 disassembly fixes (0x6FC958D0, 0x6FC9C8C0, 0x6FC2EAE0, 0x6FC36060, 0x6FC39640)', () => {
    const { m, pGame, pItemsTxt } = createWave7World()

    // 1. 0x6FC958D0 routes through real 0x6FC95680 when sgptDataTables is loaded
    const { pMonster: deadMon } = allocMonster(m, pGame, 1, 10)
    const { pPlayer: killer } = allocPlayer(m, pGame, 11)
    beginVaTrace113c()
    MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c(m, pGame, deadMon, killer)
    const dropHits = endVaTrace113c()
    expect(dropHits.has('D2Game:0x6FC958D0')).toBe(true)
    expect(dropHits.has('D2Game:0x6FC95680')).toBe(true)

    // 2. 0x6FC9C8C0 & 0x6FC36060 pass (pGame, pAiEntry, nAiIdx) to AI_InitMonsterAiThinkFn113c
    const { pMonster: monA, pAiGen: aiGenA } = allocMonster(m, pGame, 2, 12)
    m.setU32(aiGenA, 0)
    STATES_ToggleState113c(m, monA, 0x0c, 1)
    const pAiArgsA = m.alloc(0x10) >>> 0
    m.setU32(pAiArgsA, aiGenA)
    AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c(m, pGame, monA, pAiArgsA)
    expect(STATES_CheckState113c(m, monA, 0x0c)).toBe(0)
    expect(EVENT_GetNextEventFrame113c(m, monA, 2)).toBe(101)

    const { pMonster: monB, pAiGen: aiGenB } = allocMonster(m, pGame, 2, 13)
    m.setU32(aiGenB, 0)
    STATES_ToggleGfxStateFlag113c(m, monB, 0x0c, 1)
    const pAiArgsB = m.alloc(0x10) >>> 0
    m.setU32(pAiArgsB, aiGenB)
    AI_InitClearFreezeAndStall_6FC36060_113c(m, pGame, monB, pAiArgsB)
    expect(STATES_CheckState113c(m, monB, 0x0c)).toBe(0)
    expect(EVENT_GetNextEventFrame113c(m, monB, 2)).toBe(101)

    // 3. 0x6FC2EAE0 invokes real 0x6FC2EA70 & 0x6FC2EA10 (no dead quality getter calls)
    const pHeader = m.alloc(16) >>> 0
    m.setU32(pHeader, 4)
    m.setU16((pHeader + 4) >>> 0, 80)
    m.setU16((pHeader + 6) >>> 0, 90)
    m.setU8((pHeader + 8) >>> 0, 3)
    const pOutBytes = m.alloc(4) >>> 0
    const bw = new BitWriter()
    bw.writeBits(0x4d4a, 16)
    bw.writeBits(0x00210000, 32)
    bw.writeBits(101, 10)
    bw.writeBits(3, 3)
    bw.writeBits(80, 16)
    bw.writeBits(90, 16)
    bw.writeBits(2, 3)
    bw.writeBits(55, 7)
    bw.writeBits(66, 7)
    bw.writeBits(0, 7)
    const raw = bw.toUint8Array()
    const pBuf = m.alloc(raw.length + 4) >>> 0
    m.loadBlock(pBuf, raw)
    const { pRoom: dropRoom } = allocRoom(m, 1, 80, 90)
    m.setU32((pItemsTxt + 4 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20726165)
    beginVaTrace113c()
    const pLoaded = ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(
      m,
      pGame,
      pHeader,
      dropRoom,
      pBuf,
      raw.length,
      1,
      pOutBytes,
      0x56,
    )
    const loadHits = endVaTrace113c()
    expect(pLoaded).not.toBe(0)
    expect(loadHits.has('D2Game:0x6FC2EAE0')).toBe(true)
    expect(loadHits.has('D2Game:0x6FC2EA70')).toBe(true)
    expect(loadHits.has('D2Game:0x6FC2EA10')).toBe(true)

    // 4. 0x6FC39640 passes wander radius 5 when roll < 20
    const { pMonster: guardMon, pAiCtrl: guardCtrl } = allocMonster(m, pGame, 1, 14, 100, 100, 2)
    m.setU32((guardMon + 0x10) >>> 0, 1)
    m.setU32((guardMon + 0x20) >>> 0, 0)
    m.setU32((guardMon + 0x24) >>> 0, 5) // first LCG step lo=5 -> 5 % 100 < 20
    const pGuardArgs = m.alloc(0x20) >>> 0
    m.setU32(pGuardArgs, guardCtrl)
    AI_ThinkSpecialGuard_6FC39640_113c(m, pGame, guardMon, pGuardArgs)
    // 1 MWC step (lo=5 < 20) in 0x6FC39640 + 4 MWC steps in AI_Wander / MONSTER_StartMode -> step 5 lo = 0x732f7a9f
    expect(m.u32((guardMon + 0x20) >>> 0)).toBe(0x732f7a9f)
  })

  it('differential regressions: k2-w7b2 disassembly fixes (Bugs A..M)', () => {
    const { m, pGame, pQuestCtrl, pSkillsTxt, pMonStats2Txt } = createWave7World()

    // Bug A: 0x6FC83D20 broadcasts exact .rdata format "changing state to 1\n" when 0x6fd31c20 != 0
    const { pClient, pQueue } = allocClientWithQueue(m)
    m.setU32((pClient + 0x04) >>> 0, 4) // active in-game client state
    m.setU32((pGame + 0x88) >>> 0, pClient)
    m.setU32(0x6fd31c20, 1)
    const pQuest3 = m.alloc(0x100) >>> 0
    m.setU32(pQuest3, 3)
    m.setU32((pQuest3 + 0x04) >>> 0, pGame)
    m.setU8((pQuest3 + 0x0c) >>> 0, 0)
    ACT1Q3_ActivateQuestState1_6FC83D20_113c(m, pQuest3)
    expect(m.u8((pQuest3 + 0x0c) >>> 0)).toBe(1)
    const chatLen = m.u32(pQueue)
    expect(chatLen).toBeGreaterThan(20)
    const chatStr = Buffer.from(readQueuedBytes(m, pQueue, chatLen)).toString('ascii')
    expect(chatStr).toContain('changing state to 1\n')
    m.setU32(0x6fd31c20, 0)

    // Bug C: 0x6FC88AB0 walks head at m.u32(pQuestChain) (+0x00, not +0x04)
    const pQuest5 = m.alloc(0x100) >>> 0
    const pExt5 = m.alloc(0x140) >>> 0
    m.setU32(pQuest5, 5)
    m.setU32((pQuest5 + 0x04) >>> 0, pGame)
    m.setU8((pQuest5 + 0x09) >>> 0, 1)
    m.setU32((pQuest5 + 0x18) >>> 0, pExt5)
    m.setU32(pQuestCtrl, pQuest5) // +0x00 head!
    const { pRoom: malusRoom } = allocRoom(m, 37, 100, 100)
    const { pPlayer: malusPlr } = allocPlayer(m, pGame, 31, malusRoom, 100, 100)
    const pMalusArg = m.alloc(0x10) >>> 0
    m.setU32(pMalusArg, pGame)
    m.setU32((pMalusArg + 4) >>> 0, malusPlr)
    ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c(m, pMalusArg)
    expect(m.u16((pExt5 + 0x88) >>> 0)).toBe(1)
    expect(m.u32((pExt5 + 0x68) >>> 0)).toBe(31)

    // Bug E: 0x6FC91170 supports distinct (pReceiverPlayer, pGame, pSourcePlayer)
    const { pPlayer: recvPlr } = allocPlayer(m, pGame, 32)
    const { pPlayer: srcPlr, pInv: srcInv } = allocPlayer(m, pGame, 33)
    const { pItem: cubeItem, pItemData: cubeData } = allocItem(m, pGame, 1, 301)
    m.setU8((cubeData + 0x45) >>> 0, 0) // non-cube page 0 -> ignored
    INVENTORY_LinkItemToInventoryList113c(m, cubeItem, srcInv)
    expect(CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c(m, recvPlr, pGame, srcPlr)).toBe(1)

    // Bug F & I: 0x6FC9EA10 Izual AI uses unsigned LCG % and checks pMonStats2 + 0x104 vs gdwBitMasks[4]
    const { pMonster: izual, pAiCtrl: izCtrl } = allocMonster(m, pGame, 256, 34, 100, 100, 105)
    const { pPlayer: izTarget } = allocPlayer(m, pGame, 35, 0, 101, 100)
    m.setU32((izual + 0x20) >>> 0, 0xffffffff) // high-bit seed exercising unsigned %
    m.setU32((izual + 0x24) >>> 0, 0x80000001)
    m.setU8((pMonStats2Txt + 256 * D2MonStats2Txt_SIZE + 0x104) >>> 0, 1 << 4)
    const pIzStats = m.alloc(0x200) >>> 0
    m.setU16((pIzStats + 0x56) >>> 0, 100) // aip1 = 100 so unsigned roll (0..99) < aip1 falls through to melee attack
    m.setU16((pIzStats + 0x170) >>> 0, 0xffff)
    m.setU16((pIzStats + 0x172) >>> 0, 0xffff)
    const pIzArgs = m.alloc(0x30) >>> 0
    m.setU32(pIzArgs, izCtrl)
    m.setU32((pIzArgs + 0x08) >>> 0, izTarget)
    m.setU32((pIzArgs + 0x18) >>> 0, 1) // in melee range
    m.setU32((pIzArgs + 0x1c) >>> 0, pIzStats)
    AI_Thinker_Izual_6FC9EA10_113c(m, pGame, izual, pIzArgs)
    expect(m.u32((izual + 0x10) >>> 0)).toBe(4)

    // Bug J: 0x6FCB4B10 Cloak of Shadows writes valid 9-dword D2CurseStateParamStrc (+0x20 = 0x6fcbf7a0)
    const cosSkillId = 264
    const pCosTxt = (pSkillsTxt + cosSkillId * 0x23c) >>> 0
    m.setU16((pCosTxt + 0x80) >>> 0, 153) // wAuraState
    m.setU16((pCosTxt + 0x82) >>> 0, 153) // wAuraTargetState
    m.setU16((pCosTxt + 0x50) >>> 0, 31) // wAuraStat1
    expect(SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c(m, pGame, recvPlr, cosSkillId, 5)).toBe(1)

    // Bug K & L: 0x6FCB5120 Conversion allocates extended statlist with correct args & scales HP via mulDiv(nAttLvl, hp>>8, nMonLvl)
    const { pMonster: convMon } = allocMonster(m, pGame, 5, 36, 100, 100, 2)
    STATLIST_SetUnitStat113c(m, convMon, 0x0c, 10, 0) // monster level 10
    STATLIST_SetUnitStat113c(m, convMon, 6, 100 << 8, 0)
    STATLIST_SetUnitStat113c(m, convMon, 7, 100 << 8, 0)
    STATLIST_SetUnitStat113c(m, recvPlr, 0x0c, 20, 0) // attacker level 20
    const pConvArgs = m.alloc(0x20) >>> 0
    m.setU32((pConvArgs + 0x00) >>> 0, 100) // 100% chance
    m.setU32((pConvArgs + 0x04) >>> 0, 200) // duration
    m.setU32((pConvArgs + 0x08) >>> 0, 50) // min resist/state
    // Seed produces valid unsigned roll < 100
    m.setU32((recvPlr + 0x20) >>> 0, 0)
    m.setU32((recvPlr + 0x24) >>> 0, 1)
    SKILLS_TryConvertMonsterOnHit_6FCB5120_113c(m, pConvArgs, convMon, pGame, recvPlr)
    expect(STATLIST_GetUnitStat113c(m, convMon, 7, 0)).toBeGreaterThan(0)

    // Bug M: 0x6FCB5FE0 Dragon Talon Multi-Kick with valid skill does not pass pDmg as pSkillsTxt
    const dtSkillId = 255
    expect(SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c(m, pGame, recvPlr, dtSkillId, 1)).toBe(
      0,
    )
  })

  it('differential regressions: k2-w13b1 disassembly fixes (Part A + Part B)', () => {
    const { m, pGame, pItemsTxt } = createWave7World()
    const { pRoom: townRoom } = allocRoom(m, 1, 50, 50)
    const { pPlayer: p1, pClient: c1, pQueue: q1, pInv: inv1 } = allocPlayer(
      m,
      pGame,
      41,
      townRoom,
      50,
      50,
    )
    const { pPlayer: p2 } = allocPlayer(m, pGame, 42, townRoom, 52, 50)
    m.setU32((p1 + 0x14) >>> 0, m.u32((p1 + 0x14) >>> 0))
    STATLIST_SetUnitStat113c(m, p1, 0x0e, 0x12345, 0) // gold = 0x12345

    // 1. 0x6FC98D00 removes item from inventory via 0x6FD71B00, invokes 0x6FD6DFD0 no-op,
    //    sets dwCommandFlags (+0x18) |= 0x20 and dwItemFlags (+0x14) |= (1 | 0x10)
    const { pItem: it98, pItemData: data98 } = allocItem(m, pGame, 1, 401)
    m.setU32((it98 + 0xc4) >>> 0, 2)
    INVENTORY_LinkItemToInventoryList113c(m, it98, inv1)
    beginVaTrace113c()
    D2Game_6FC98D00_113c(m, p1, it98, pGame, 0)
    const h98 = endVaTrace113c()
    expect(h98.has('D2Game:0x6FC98D00')).toBe(true)
    expect(h98.has('D2Common:0x6FD6DFD0')).toBe(true)
    expect(INVENTORY_GetFirstItem113c(m, inv1)).toBe(0)
    expect((m.u32((data98 + 0x18) >>> 0) & 0x20) !== 0).toBe(true)
    expect((m.u32((data98 + 0x14) >>> 0) & 0x11) === 0x11).toBe(true)
    expect(m.u32((it98 + 0xc4) >>> 0) & 2).toBe(0)

    // 2. 0x6FCDE640, 0x6FCDEE30, 0x6FCDF990 assert on pGame === 0 / pNpc === 0
    expect(() => D2Game_6FCDE640_113c(m, 0, p1, 0, 1, 0, 0)).toThrow(D2CommonAssertError)
    expect(() => D2Game_6FCDEE30_113c(m, 0, 0x20706163, 1, 0, 2, 10, 10)).toThrow(
      D2CommonAssertError,
    )
    expect(() => D2Game_6FCDEE30_113c(m, pGame, 0x20706163, 0, 0, 2, 10, 10)).toThrow(
      D2CommonAssertError,
    )
    expect(() => D2Game_6FCDF990_113c(m, 1, 0, p1, 1, 0)).toThrow(D2CommonAssertError)

    // 3. 0x6FCE1510 queues exact 15B packet 0x2A error payload: +3=0, +7=0xffffffff, +11=gold
    const { pMonster: fakeNpc } = allocMonster(m, pGame, 198, 402, 50, 50, 1)
    const pArena = m.alloc(0x40) >>> 0
    const pNpcCtrl = m.alloc(0x40) >>> 0
    const pNpcTable = m.alloc(0x1100) >>> 0
    m.setU32((pGame + 0x1d24) >>> 0, pNpcCtrl)
    m.setU32((pNpcCtrl + 0x04) >>> 0, pNpcTable)
    m.setU32((pGame + 0x1d28) >>> 0, pArena)
    m.setU32(q1, 0)
    D2Game_6FCE1510_113c(m, p1, pGame, fakeNpc, 1)
    expect(m.u32(q1)).toBe(0x0f)
    expect(m.u8((q1 + 0x04 + 0) >>> 0)).toBe(0x2a)
    expect(m.u8((q1 + 0x04 + 1) >>> 0)).toBe(0)
    expect(m.u8((q1 + 0x04 + 2) >>> 0)).toBe(0x09)
    expect(m.u32((q1 + 0x04 + 3) >>> 0)).toBe(0)
    expect(m.u32((q1 + 0x04 + 7) >>> 0)).toBe(0xffffffff)
    expect(m.u32((q1 + 0x04 + 11) >>> 0)).toBe(0x12345)

    // 4. 0x6FCF08B0 propagates 0x6FCF01D0 return value (1 for missing target unit) instead of hardcoded 0
    const pPkt08B0 = m.alloc(0x10) >>> 0
    m.setU8(pPkt08B0, 0x14)
    m.setU32((pPkt08B0 + 1) >>> 0, 1) // UNIT_MONSTER
    m.setU32((pPkt08B0 + 5) >>> 0, 0x7777) // missing GUID
    m.setU32((pPkt08B0 + 9) >>> 0, 0)
    expect(D2Game_6FCF08B0_113c(m, pGame, p1, pPkt08B0, 0x0d)).toBe(1)

    // 5. 0x6FCF7300 supports optional 7-arg form (pOutFailed defaults to pOutSwapped) and sets *pOutFailed = 1 on trade page 2
    const { pItem: curIt } = allocItem(m, pGame, 1, 410)
    const { pItem: tgtIt, pItemData: tgtData } = allocItem(m, pGame, 2, 411)
    m.setU32((curIt + 0x10) >>> 0, 4)
    m.setU32((tgtIt + 0x10) >>> 0, 0)
    m.setU8((tgtData + 0x45) >>> 0, 2) // trade page 2
    const pOutFail7 = m.alloc(4) >>> 0
    m.setU32(pOutFail7, 99)
    expect(D2Game_6FCF7300_113c(m, p1, pGame, 410, 411, 0, 0, pOutFail7)).toBe(0)
    expect(m.u32(pOutFail7)).toBe(1)

    // 6. 0x6FC91E10 empty trade page succeeds cleanly on valid players with client2
    expect(D2Game_6FC91E10_113c(m, p1, pGame, p2)).toBe(1)
    expect(c1).not.toBe(0)
    expect(pItemsTxt).not.toBe(0)
  })

  it('executes all 152 / 152 Wave 7 promoted VAs with behavioral assertions and zero missing VA trace hits', () => {
    const cumulativeHits = new Set<string>()

    // -------------------------------------------------------------------------
    // Shard 1: k2w1-laneI-0x6fc3 (39 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pGame, pMonStatsTxt, pMonStats2Txt, pItemsTxt } = createWave7World()
      beginVaTrace113c()

      const { pMonster: mon1, pAiGen: aiGen1, pAiCtrl: aiCtrl1, pMonData: monData1, pRoom: room1 } =
        allocMonster(m, pGame, 1, 1001, 100, 100, 2)
      const { pMonster: mon2, pAiGen: aiGen2 } = allocMonster(m, pGame, 1, 1002, 101, 100, 2)
      const { pMonster: mon453 } = allocMonster(m, pGame, 0x1c5, 1003, 102, 100, 2)
      const { pPlayer: plr1, pInv: inv1 } = allocPlayer(m, pGame, 1004, room1, 100, 100)

      // 0x6FC2DE20
      EVENT_SetEventFull113c(m, pGame, mon1, 0, 105, 0, 0, 0)
      SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c(m, pGame, mon1)
      expect(EVENT_GetNextEventFrame113c(m, mon1, 2)).toBe(113)

      // 0x6FC2E0A0 & 0x6FC2E130
      const { pItem: it1 } = allocItem(m, pGame, 1, 2001, 2)
      m.set(pItemsTxt + 1 * D2ItemsTxt_SIZE, D2ItemsTxt.wType1, 10)
      expect(ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, pGame, it1)).toBe(100 + 0x3a98)
      expect(ITEMS_CalcDiminishingMfPercent_6FC2E130_113c(m, 350, 250, 250)).toBe(225)

      // 0x6FC2E150 & 0x6FC2E210
      INVENTORY_LinkItemToInventoryList113c(m, it1, inv1)
      expect(ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, plr1, it1)).toBe(1)
      ITEMS_SetMagicPrefix113c(m, it1, 10, 0)
      ITEMS_SetMagicSuffix113c(m, it1, 20, 0)
      ITEMS_SetRarePrefix113c(m, it1, 30)
      ITEMS_SetRareSuffix113c(m, it1, 40)
      ITEMS_SetItemCell113c(m, it1, 7)
      const ppIt = m.alloc(4) >>> 0
      m.setU32(ppIt, it1)
      ITEMS_ClearAffixesAndItemCell_6FC2E210_113c(m, ppIt)
      expect(ITEMS_GetItemCell113c(m, it1) | 0).toBe(-1)

      // 0x6FC2E250 & 0x6FC2E800
      m.setU32((pGame + 0x1b24 + 4) >>> 0, 1 << 5)
      expect(ITEMS_TestUniqueSpawnedBit_6FC2E250_113c(m, pGame, 37)).toBe(1 << 5)
      ITEMS_SetItemQuality113c(m, it1, 7)
      ITEMS_SetItemCell113c(m, it1, 37)
      expect(ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c(m, it1, pGame)).toBe(1 << 5)

      // 0x6FC2E310 & 0x6FC2E390
      expect(ITEMS_GetVendorManaPotionCode_6FC2E310_113c(m, mon1)).toBe(0x2031706d)
      expect(ITEMS_GetVendorHealthPotionCode_6FC2E390_113c(m, mon1)).toBe(0x20317068)

      // 0x6FC2EAE0
      const pHdr = m.alloc(16) >>> 0
      m.setU32(pHdr, 999)
      const pOutB = m.alloc(4) >>> 0
      expect(ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(m, pGame, pHdr, 0, 0, 0, 1, pOutB, 0x56)).toBe(0)

      // 0x6FC2F180 & 0x6FC30700
      const rec8 = (pItemsTxt + 8 * D2ItemsTxt_SIZE) >>> 0
      m.setU8((rec8 + 0x133) >>> 0, 1)
      m.setU8((rec8 + 0xfd) >>> 0, 5)
      m.setU16((rec8 + 0x11e) >>> 0, 45)
      const pSeed = m.alloc(8) >>> 0
      m.setU32(pSeed, 1)
      expect(ITEMS_CheckItemTxtSpawnable_6FC2F180_113c(m, rec8, 10, 45, pSeed, 0)).toBe(1)
      EVENT_SetEventFull113c(m, pGame, it1, 3, 150, 0, 0, 0)
      ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c(m, pGame, it1)
      expect(EVENT_GetNextEventFrame113c(m, it1, 3)).toBe(0)

      // 0x6FC35590, 0x6FC35660, 0x6FC35890, 0x6FC358F0, 0x6FC35BB0, 0x6FC35C40, 0x6FC35F90
      const pAdjCtx = m.alloc(12) >>> 0
      m.setU32(pAdjCtx, mon1)
      AI_CountAdjacentUnitsCallback_6FC35590_113c(m, mon2, pAdjCtx)
      expect(m.u32((pAdjCtx + 8) >>> 0)).toBe(1)

      STATLIST_SetUnitStat113c(m, mon2, 6, 10240, 0)
      const pHealCtx = m.alloc(12) >>> 0
      m.setU32((pHealCtx + 4) >>> 0, 100)
      m.setU32((pHealCtx + 8) >>> 0, 100)
      AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c(m, pGame, mon1, mon2, pHealCtx)
      expect(m.u32(pHealCtx)).toBe(mon2)

      const pCnt = m.alloc(4) >>> 0
      AI_CountNearbyMinion453Or461Callback_6FC35890_113c(m, pGame, mon1, mon453, pCnt)
      expect(m.u32(pCnt)).toBe(1)

      AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c(m, mon1, mon2)
      expect(m.u32((aiGen1 + 0x14) >>> 0)).toBe(1002)

      const pInteract = m.alloc(16) >>> 0
      const pINode = m.alloc(12) >>> 0
      m.setU32((monData1 + 0x30) >>> 0, pInteract)
      m.setU32(pInteract, pINode)
      m.setU32(pINode, 0x1234)
      expect(AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c(m, mon1, pGame)).toBe(0)

      const pOvCtx = m.alloc(0x20) >>> 0
      m.setU32(pOvCtx, 100)
      m.setU32((pOvCtx + 4) >>> 0, 100)
      m.setU32((pOvCtx + 8) >>> 0, 80)
      AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c(m, pGame, mon1, mon453, pOvCtx)
      expect(m.u32((pOvCtx + 0x14) >>> 0)).toBe(1)

      const pAiArgs = m.alloc(0x20) >>> 0
      m.setU32(pAiArgs, aiCtrl1)
      m.setU32((pAiArgs + 0x08) >>> 0, mon2)
      m.setU32((pAiArgs + 0x1c) >>> 0, (pMonStatsTxt + 1 * 0x1a8) >>> 0)
      expect(AI_CastNextPatrolPointSkill_6FC35F90_113c(m, pAiArgs, pGame, mon1)).toBe(0)

      // 0x6FC36060, 0x6FC360B0, 0x6FC36190, 0x6FC36410, 0x6FC372B0, 0x6FC39640
      const pInitArgs = m.alloc(8) >>> 0
      m.setU32(pInitArgs, aiGen1)
      AI_InitClearFreezeAndStall_6FC36060_113c(m, pGame, mon1, pInitArgs)
      m.setU8((pMonStats2Txt + 1 * D2MonStats2Txt_SIZE + 0x104) >>> 0, 1 << 4)
      AI_ThinkSingleStrikeTurret_6FC360B0_113c(m, pGame, mon1, pAiArgs)
      AI_ThinkStaticTrapAttack_6FC36190_113c(m, pGame, mon1, pAiArgs)
      m.setU32((aiCtrl1 + 0x14) >>> 0, 200)
      AI_ThinkTimedExpireOrStall_6FC36410_113c(m, pGame, mon1, pAiArgs)
      AI_ThinkMeleeOrApproach7_6FC372B0_113c(m, pGame, mon1, pAiArgs)
      AI_ThinkSpecialGuard_6FC39640_113c(m, pGame, mon1, pAiArgs)

      // 0x6FC3EC40 & 0x6FC3EE50
      const pInactRoom = m.alloc(0x18) >>> 0
      const pInactMon = m.alloc(0x60) >>> 0
      m.setU32(pInactRoom, 100)
      m.setU32((pInactRoom + 4) >>> 0, 100)
      m.setU32((pInactRoom + 0x0c) >>> 0, pInactMon)
      m.setU32((pGame + 0xd8) >>> 0, pInactRoom)
      m.setU32((pInactMon + 0x08) >>> 0, 540)
      m.setU8((pInactMon + 0x18) >>> 0, 0x04)
      expect(MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c(m, 100, 100, pGame, room1, 540)).toBe(1)
      MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c(m, pGame, 0, 540, {
        onFreePoolMem: () => {},
      })
      expect(m.u32((pInactRoom + 0x0c) >>> 0)).toBe(0)

      // 0x6FC40B30, 0x6FC41040, 0x6FC41590
      const pMNode = m.alloc(8) >>> 0
      m.setU32(pMNode, 1002)
      m.setU32((aiGen1 + 0x2c) >>> 0, 1001)
      m.setU32((aiGen1 + 0x34) >>> 0, pMNode)
      m.setU32((aiGen2 + 0x2c) >>> 0, 1001)
      AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c(m, aiGen1)
      expect(m.u32((aiGen2 + 0x2c) >>> 0)).toBe(0xffffffff)
      m.setU32((aiGen2 + 0x2c) >>> 0, 1001)
      AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c(m, mon1, { onFreePoolMem: () => {} })
      expect(m.u32((aiGen1 + 0x34) >>> 0)).toBe(0)
      const pFreeNode = m.alloc(8) >>> 0
      AIGENERAL_FreeMinionList_6FC40B30_113c(m, pGame, pFreeNode, { onFreePoolMem: () => {} })

      // 0x6FC41A70..0x6FC42B10
      m.setU32((mon1 + 0x10) >>> 0, 0)
      MONUMOD_SetShatterOnDeath_6FC41A70_113c(m, pGame, mon1, 0, 1)
      expect(STATES_CheckState113c(m, mon1, 0x6b)).not.toBe(0)
      MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c(m, pGame, mon1, 0x12, 1)
      m.setU32((mon2 + 0x10) >>> 0, 3)
      MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c(m, pGame, mon2, 9, 1)
      MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c(m, pGame, mon2, 9, 0)
      MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c(m, pGame, mon1, 5, 1)
      STATLIST_SetUnitStat113c(m, mon2, 0x0c, 10, 0)
      STATLIST_SetUnitStat113c(m, mon2, 0x0d, 100, 0)
      MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c(m, mon2)
      expect(STATLIST_GetUnitStat113c(m, mon2, 0x0c, 0)).toBe(13)
      MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c(m, mon2, 50)
      m.setU16((pMonStatsTxt + 1 * 0x1a8 + 0x32) >>> 0, 10)
      MONUMOD_ApplyExtraFastVelocity_6FC42880_113c(m, mon2)
      MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c(m, pGame, mon1, 0, 1, {
        onMonsterCreate: () => 1,
      })

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 2: k2w2-b3 (38 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pGame, pObjectsTxt } = createWave7World()
      beginVaTrace113c()

      const { pObj } = allocObject(m, 1, 0, 3001)
      UNITS_InitPath113c(m, pObj, 0, 0, 0)
      const pArgs = m.alloc(0x10) >>> 0
      m.setU32((pArgs + 0x04) >>> 0, pObj)
      expect(OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c(m, pArgs)).toBe(0)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(1)

      const { pPlayer: plr, pPlayerData: pData, pClient, pQueue } = allocPlayer(m, pGame, 3002)
      STATLIST_SetUnitStat113c(m, plr, 6, 50, 0)
      STATLIST_SetUnitStat113c(m, plr, 7, 200, 0)
      m.setU32((pArgs + 0x08) >>> 0, plr)
      OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c(m, pArgs)
      expect(OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c(m, plr)).toBe(1)

      const pObjTxt = (pObjectsTxt + 1 * D2ObjectsTxt_SIZE) >>> 0
      m.setU8((pObjTxt + 0x167) >>> 0, 1)
      m.setU8((pObjTxt + 0x141) >>> 0, 1)
      m.setU8((pObjTxt + 0x122) >>> 0, 1)
      m.setU32(m.u32((pObj + 0x14) >>> 0), pObjTxt)
      OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c(m, pGame, pObj)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(0)
      m.setU32((pObj + 0x10) >>> 0, 1)
      OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c(m, pGame, pObj)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(2)

      const pTrade = m.alloc(0x20) >>> 0
      m.setU32((pData + 0x5c) >>> 0, pTrade)
      expect(PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c(m, plr, pGame, 1, 2)).not.toBe(0)
      expect(PLRTRADE_WalkTradeItemList_6FC8FFA0_113c(m, plr)).toBe(0)

      const { pMonster: mon, pAiGen } = allocMonster(m, pGame, 5, 3003, 100, 100, 2)
      const pModeChg = m.alloc(0x20) >>> 0
      m.setU32((pModeChg + 0x04) >>> 0, mon)
      expect(MONMODE_EnterAnimMode6_6FC94C10_113c(m, pGame, pModeChg)).toBe(1)
      expect(MONMODE_EnterAnimMode10_6FC94C90_113c(m, pGame, pModeChg)).toBe(1)
      expect(MONMODE_EnterSequenceMode14_6FC954E0_113c(m, pGame, pModeChg)).toBe(0)
      MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c(m, pGame, mon, plr)
      m.setU32((mon + 0x44) >>> 0, 0x200)
      m.setU32((mon + 0x48) >>> 0, 0x300)
      m.setU16((mon + 0x4c) >>> 0, 0x100)
      expect(MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c(m, pGame, mon)).toBe(1)
      expect(MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c(m, pGame, mon)).toBe(1)
      expect(MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c(m, pGame, pModeChg)).toBe(1)
      MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c(m, pGame, mon, 3)
      SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c(m, mon, 0x42)

      const pBestOut = m.alloc(0x10) >>> 0
      m.setU32((pBestOut + 4) >>> 0, 1000)
      expect(AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c(m, pGame, mon, mon, pBestOut)).toBe(0)
      const pAiArgs = m.alloc(0x10) >>> 0
      m.setU32(pAiArgs, pAiGen)
      AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c(m, pGame, mon, pAiArgs)

      const pSrcBuf = m.alloc(0x30) >>> 0
      // D2Game.dll@0x6FCAA3E0 returns queued byte count (`nPacketSize`) on success.
      expect(NET_SendPacket9B_MercReviveInfo_6FCAA690_113c(m, 1, 2, pClient)).toBe(7)
      expect(NET_SendPacket98_UnitWordValue_6FCAA6C0_113c(m, 1, 2, pClient)).toBe(7)
      expect(NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c(m, 0, 0, pClient, 1)).toBe(10)
      expect(NET_SendPacketBuffer32B_6FCAAA10_113c(m, pSrcBuf, pClient)).toBe(32)
      expect(NET_SendPacketBuffer21B_6FCAAA70_113c(m, pSrcBuf, pClient)).toBe(21)
      expect(NET_SendPacket61_ByteParam_6FCAAAC0_113c(m, 1, pClient)).toBe(2)
      expect(NET_SendPacket60_PortalInfo_6FCAAAE0_113c(m, pObj, pClient)).toBe(7)
      expect(NET_SendPacketBuffer7B_6FCAAB20_113c(m, pSrcBuf, pClient)).toBe(7)
      expect(NET_SendPacketBuffer15B_6FCAABF0_113c(m, pSrcBuf, pClient)).toBe(15)
      expect(NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, 0x2a, 0, 0, pClient, 1, 0)).toBe(15)
      expect(NET_SendPacket7B_ByteAndDword_6FCAAD10_113c(m, 0x2c, 1, 2, pClient)).toBe(7)
      expect(NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c(m, 0, pClient, 1)).toBe(11)
      expect(NET_SendPacket47_UnitRelator1_6FCAAEC0_113c(m, 0, pClient)).toBe(11)
      expect(NET_SendPacket42_ClearCursor_6FCAAF10_113c(m, 0, pClient)).toBe(6)
      expect(NET_SendPacket79_GoldInTrade_6FCAB1F0_113c(m, 100, 1, pClient)).toBe(6)
      expect(NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c(m, pSrcBuf, pClient)).toBe(21)
      expect(NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 1, pClient)).toBe(2)
      expect(NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c(m, 0x0c, pClient, 0x20, 1, 2)).toBe(10)
      expect(NET_SendPacketA5_StateSkill_6FCABA10_113c(m, 1, 2, pClient, 3)).toBe(8)
      expect(NET_SendPacket07_RoomTileCoords_6FCABF50_113c(m, 10, 20, pClient, 1)).toBe(6)
      expect(m.u32(pQueue)).toBeGreaterThan(0)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 3: k2w7-b2 (37 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pGame, pQuestCtrl, pDataTables } = createWave7World()
      beginVaTrace113c()

      const { pRoom: roomA1 } = allocRoom(m, 1, 100, 100)
      const { pRoom: roomA5 } = allocRoom(m, 0x6f, 100, 100)
      const { pPlayer: plr, pPlayerData: pData, pQuestFlags } = allocPlayer(m, pGame, 4001, roomA1)
      m.setU32((pData + 0x58) >>> 0, 0xffffffff)
      expect(ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c(m, pGame, plr)).toBe(0)

      const pQ22 = m.alloc(0x100) >>> 0
      const pExt22 = m.alloc(0x100) >>> 0
      m.setU32(pQ22, 0x22)
      m.setU32((pQ22 + 0x04) >>> 0, pGame)
      m.setU32((pQ22 + 0x18) >>> 0, pExt22)
      m.setU8((pExt22 + 0x88) >>> 0, 1)
      m.setU32(pQuestCtrl, pQ22)
      ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c(m, plr, pGame)
      expect(ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c(m, plr, pQ22)).toBe(0)

      const pQuest = m.alloc(0x100) >>> 0
      const pExt = m.alloc(0x140) >>> 0
      m.setU32(pQuest, 4)
      m.setU32((pQuest + 0x04) >>> 0, pGame)
      m.setU8((pQuest + 0x09) >>> 0, 1)
      m.setU32((pQuest + 0x14) >>> 0, m.alloc(0x40) >>> 0)
      m.setU32((pQuest + 0x18) >>> 0, pExt)
      ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c(m, pQuest)
      ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c(m, pQuest)

      const pQ1 = m.alloc(0x100) >>> 0
      const pQ2 = m.alloc(0x100) >>> 0
      const pExt2 = m.alloc(0x100) >>> 0
      const pQ3 = m.alloc(0x100) >>> 0
      const pQ5 = m.alloc(0x100) >>> 0
      const pExt5 = m.alloc(0x140) >>> 0
      m.setU32(pQ1, 0x1e)
      m.setU32((pQ1 + 0x04) >>> 0, pGame)
      m.setU32((pQ1 + 0xf4) >>> 0, pQ2)
      m.setU32(pQ2, 2)
      m.setU32((pQ2 + 0x04) >>> 0, pGame)
      m.setU8((pQ2 + 0x09) >>> 0, 1)
      m.setU32((pQ2 + 0x18) >>> 0, pExt2)
      m.setU32((pQ2 + 0xf4) >>> 0, pQ3)
      m.setU32(pQ3, 3)
      m.setU32((pQ3 + 0x04) >>> 0, pGame)
      m.setU32((pQ3 + 0xf4) >>> 0, pQuest)
      m.setU32((pQuest + 0xf4) >>> 0, pQ5)
      m.setU32(pQ5, 5)
      m.setU32((pQ5 + 0x04) >>> 0, pGame)
      m.setU8((pQ5 + 0x09) >>> 0, 1)
      m.setU32((pQ5 + 0x18) >>> 0, pExt5)
      m.setU32(pQuestCtrl, pQ1)
      ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c(m, plr, pGame)
      ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c(m, plr, pGame)
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 0)).toBe(1)

      m.setU8((pQuest + 0x0c) >>> 0, 0)
      ACT1Q3_ActivateQuestState1_6FC83D20_113c(m, pQuest)
      ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c(m, pGame, plr)
      m.setU8((pQuest + 0x0c) >>> 0, 2)
      ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c(m, pQuest)
      m.setU8((pQuest + 0x0c) >>> 0, 2)
      m.setU8((pExt + 1) >>> 0, 1)
      m.setU32((pExt + 4) >>> 0, 0xffffffff)
      ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c(m, pQuest)

      const { pMonster: brMon } = allocMonster(m, pGame, 1, 4002)
      const pBrArg = m.alloc(0x20) >>> 0
      m.setU32(pBrArg, pGame)
      m.setU32((pBrArg + 4) >>> 0, brMon)
      ACT1Q2_OnBloodRavenKilled_6FC85620_113c(m, pQuest, pBrArg)

      const { pObj: obj0 } = allocObject(m, 0, 0, 4003)
      expect(ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c(m, pGame, obj0)).toBe(0)
      expect(ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c(m, pGame, plr)).toBe(0)
      ACT1Q4_OnCainGibbetOperated_6FC87730_113c(m, pGame, obj0)
      m.setU32((pExt + 0x40) >>> 0, 0xffffffff)
      expect(ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c(m, pGame, pQuest)).toBe(1)
      ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c(m, pQuest, 0, 0)
      expect(m.u8((pExt + 0x50) >>> 0)).toBe(1)

      const pMalusArg = m.alloc(0x10) >>> 0
      m.setU32(pMalusArg, pGame)
      m.setU32((pMalusArg + 4) >>> 0, plr)
      ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c(m, pMalusArg)

      const pAndArg = m.alloc(0x20) >>> 0
      m.setU32(pAndArg, pGame)
      m.setU32((pAndArg + 4) >>> 0, plr)
      m.setU32((pAndArg + 8) >>> 0, brMon)
      m.setU8((pExt + 0x118) >>> 0, 1)
      m.setU8((pExt + 0x119) >>> 0, 1)
      ACT1Q5_OnAndarielKilled_6FC88B90_113c(m, pQuest, pAndArg)
      ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c(m, pQuest, brMon)

      const { pObj: objR } = allocObject(m, 0, roomA1, 4004)
      OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c(m, objR, pGame)
      const pOp = m.alloc(0x20) >>> 0
      m.setU32(pOp, pGame)
      m.setU32((pOp + 4) >>> 0, objR)
      m.setU32((pOp + 8) >>> 0, plr)
      m.setU32((pOp + 0x0c) >>> 0, m.alloc(0x200) >>> 0)
      expect(() => OBJECTS_OperateGemShrine_6FC8B430_113c(m, pOp)).toThrow(D2CommonAssertError)

      const { pObj: portalObj } = allocObject(m, 0x3b, roomA5, 4005)
      expect(() =>
        OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c(m, pGame, portalObj),
      ).toThrow(D2CommonAssertError)
      OBJECTS_OperatePortalShrine_6FC8B9B0_113c(m, pOp)
      m.setU32((objR + 0x10) >>> 0, 2)
      expect(OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c(m, pOp)).toBe(0)
      m.setU32((objR + 0x10) >>> 0, 0)
      OBJECTS_FloorSpikesEventTick_6FC8E270_113c(m, pGame, objR)

      expect(CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c(m, plr, pGame)).toBe(1)
      STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c(m, plr, pGame)
      expect(OBJECTS_OperateBankStash_6FC91290_113c(m, pOp)).toBe(0)
      STASH_HandleBankGoldOrCloseAction_6FC917E0_113c(m, plr, pGame, 999, 0x12, 0)

      m.setU32((brMon + 4) >>> 0, 0xffffffff)
      MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c(m, brMon, pGame, 100)

      const pIzCtrl = m.alloc(0x40) >>> 0
      m.setU32((pIzCtrl + 0x14) >>> 0, 1)
      m.setU32((pIzCtrl + 0x18) >>> 0, 5)
      const pIzArgs = m.alloc(0x30) >>> 0
      m.setU32(pIzArgs, pIzCtrl)
      m.setU32((pIzArgs + 0x08) >>> 0, plr)
      m.setU32((pIzArgs + 0x1c) >>> 0, m.alloc(0x200) >>> 0)
      m.setU32((pDataTables + 0xa80) >>> 0, 0)
      AI_Thinker_Izual_6FC9EA10_113c(m, pGame, brMon, pIzArgs)
      expect(m.u32((pIzCtrl + 0x18) >>> 0)).toBe(0)

      expect(SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c(m, pGame, plr, -1, 1)).toBe(0)
      expect(SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c(m, pGame, plr, -1, 1)).toBe(0)
      expect(SKILLS_TryConvertMonsterOnHit_6FCB5120_113c(m, m.alloc(0x20) >>> 0, brMon, pGame, plr)).toBe(0)
      expect(SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c(m, pGame, plr, -1, 1)).toBe(0)
      expect(SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c(m, pGame, plr, -1, 1)).toBe(0)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 4: k2w13-b1 (38 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pGame, pMonStatsTxt, pObjectsTxt, pItemsTxt, pQuestCtrl } = createWave7World()
      beginVaTrace113c()

      const pArena = m.alloc(0x40) >>> 0
      const pNpcCtrl = m.alloc(0x40) >>> 0
      const pNpcTable = m.alloc(0x1100) >>> 0
      const pGambleIds = m.alloc(0x40) >>> 0
      m.setU32((pGame + 0x1d24) >>> 0, pNpcCtrl)
      m.setU32((pNpcCtrl + 0x04) >>> 0, pNpcTable)
      m.setU32((pGame + 0x1d28) >>> 0, pArena)
      m.setU8((pArena + 0x08) >>> 0, 2)
      m.setU32(0x6fdefbf0 + 0x04, pGambleIds)
      m.setU32(pGambleIds, 999)

      const { pRoom: room1 } = allocRoom(m, 1, 100, 100)
      const { pPlayer: plr1, pPlayerData: pd1, pInv: inv1, pQueue: q1 } = allocPlayer(
        m,
        pGame,
        5001,
        room1,
        100,
        100,
      )
      const { pPlayer: plr2, pPlayerData: pd2 } = allocPlayer(m, pGame, 5002, room1, 102, 100)
      const { pMonster: pet, pAiGen, pAiCtrl } = allocMonster(m, pGame, 1, 5003, 101, 101, 2)
      m.setU32((pAiGen + 0x28) >>> 0, pGame)
      m.setU32((pAiGen + 0x2c) >>> 0, 5001)
      m.setU32((pAiGen + 0x30) >>> 0, 0)
      const pMonRec = (pMonStatsTxt + 1 * 0x1a8) >>> 0
      m.setU16((pMonRec + 0x170) >>> 0, 0xffff)
      m.setU16((pMonRec + 0x172) >>> 0, 0xffff)
      m.setU16((pMonRec + 0x68) >>> 0, 20)
      m.setU16((pMonRec + 0x6e) >>> 0, 40)
      m.setU16((pMonRec + 0x84) >>> 0, 10)
      const pAiTick = m.alloc(0x30) >>> 0
      m.setU32(pAiTick, pAiCtrl)
      m.setU32((pAiTick + 0x1c) >>> 0, pMonRec)

      // 0x6FC3E3D0
      D2Game_6FC3E3D0_113c(m, pAiTick, pet, pGame)
      expect(m.u32((pAiCtrl + 0x1c) >>> 0)).toBe(5001)

      // 0x6FC7D690, 0x6FC7DF70, 0x6FC7E2A0, 0x6FC8D620, 0x6FC8E930, 0x6FC8F4F0
      const pQ23 = m.alloc(0x100) >>> 0
      const pQ24 = m.alloc(0x100) >>> 0
      const pQ11 = m.alloc(0x100) >>> 0
      const pQD23 = m.alloc(0x100) >>> 0
      const pQD24 = m.alloc(0x100) >>> 0
      const pQD11 = m.alloc(0x100) >>> 0
      m.setU32(pQ23, 0x23)
      m.setU32((pQ23 + 0x18) >>> 0, pQD23)
      m.setU32((pQ23 + 0xf4) >>> 0, pQ24)
      m.setU32(pQ24, 0x24)
      m.setU32((pQ24 + 0x18) >>> 0, pQD24)
      m.setU32((pQ24 + 0xf4) >>> 0, pQ11)
      m.setU32(pQ11, 0x11)
      m.setU8((pQ11 + 0x09) >>> 0, 1)
      m.setU32((pQ11 + 0x18) >>> 0, pQD11)
      m.setU32(pQuestCtrl, pQ23)

      const { pObj, pObjData } = allocObject(m, 1, room1, 5010)
      m.setU32(pObjData, (pObjectsTxt + 1 * D2ObjectsTxt_SIZE) >>> 0)
      m.setU8((pObjectsTxt + 1 * D2ObjectsTxt_SIZE + 0x1b3) >>> 0, 1)
      m.setU32((pGame + 0x1520 + ((5010 & 0x7f) << 2)) >>> 0, pObj)
      const pObjInteract = m.alloc(0x20) >>> 0
      m.setU32(pObjInteract, pGame)
      m.setU32((pObjInteract + 0x04) >>> 0, pObj)
      m.setU32((pObjInteract + 0x08) >>> 0, plr1)
      m.setU32((pObjInteract + 0x10) >>> 0, 1)
      m.setU32((pObjInteract + 0x14) >>> 0, 111)
      m.setU32((pObjInteract + 0x18) >>> 0, 222)

      expect(D2Game_6FC7D690_113c(m, pObjInteract)).toBe(0)
      expect(D2Game_6FC7DF70_113c(m, pObjInteract)).toBe(0)
      expect(D2Game_6FC7E2A0_113c(m, pObjInteract)).toBe(0)
      m.setU32((pObj + 0x10) >>> 0, 0)
      expect(D2Game_6FC8D620_113c(m, pObjInteract)).toBe(0)
      D2Game_6FC8E930_113c(m, 5010, pGame, plr1, 0)
      expect(D2Game_6FC8F4F0_113c(m, pObjInteract)).toBe(0)

      // 0x6FC91E10, 0x6FC93570, 0x6FC93AA0, 0x6FC93BA0, 0x6FC98D00
      const pTr1 = m.alloc(0x20) >>> 0
      const pTr2 = m.alloc(0x20) >>> 0
      const pSnap1 = m.alloc(0x20) >>> 0
      const pSnap2 = m.alloc(0x20) >>> 0
      m.setU16(pSnap1, 0x4d4a)
      m.setU16(pSnap2, 0x4d4a)
      m.setU32((pTr1 + 0x04) >>> 0, pSnap1)
      m.setU32((pTr2 + 0x04) >>> 0, pSnap2)
      m.setU32((pd1 + 0x5c) >>> 0, pTr1)
      m.setU32((pd2 + 0x5c) >>> 0, pTr2)
      expect(D2Game_6FC91E10_113c(m, plr1, pGame, plr2)).toBe(1)
      m.setU32((pd1 + 0x50) >>> 0, 6)
      D2Game_6FC93570_113c(m, pGame, plr1)
      m.setU32((plr1 + 0x64) >>> 0, 5002)
      m.setU32((plr1 + 0x68) >>> 0, 0)
      m.setU8((plr1 + 0x6c) >>> 0, 1)
      D2Game_6FC93AA0_113c(m, pGame, plr1)
      D2Game_6FC93BA0_113c(m, plr1, plr2, pGame, pd1, pd2)
      const { pItem: itRem } = allocItem(m, pGame, 1, 5020)
      INVENTORY_LinkItemToInventoryList113c(m, itRem, inv1)
      D2Game_6FC98D00_113c(m, plr1, itRem, pGame, 0)

      // 0x6FCCA4D0..0x6FCCC410
      D2Game_6FCCA4D0_113c(m, pGame, pet, pAiTick)
      D2Game_6FCCA710_113c(m, pet, pGame, 0, pAiTick)
      D2Game_6FCCAC30_113c(m, pAiTick, pet, pGame)
      D2Game_6FCCB070_113c(m, pGame, pet, pAiTick)
      D2Game_6FCCB360_113c(m, pGame, pet, pAiTick)
      D2Game_6FCCB580_113c(m, pGame, pet, pAiTick)
      D2Game_6FCCC410_113c(m, pGame, pet, pAiTick)

      // 0x6FCDB4F0..0x6FCE1510
      const { pMonster: npc } = allocMonster(m, pGame, 198, 5030, 100, 100, 1)
      const pShop = m.alloc(0x40) >>> 0
      const q1BeforeArena = m.u32(q1)
      D2Game_6FCDB4F0_113c(m, pGame, plr1)
      expect(m.u32(q1) - q1BeforeArena).toBe(6)
      m.setU32((pGame + 0x70) >>> 0, 0) // classic branch exits cleanly on sentinel itemId 999
      D2Game_6FCDE2A0_113c(m, pShop, plr1, pGame, npc)
      m.setU32((pGame + 0x70) >>> 0, 1)
      expect(D2Game_6FCDE640_113c(m, pGame, plr1, npc, 99999, 0, 0)).toBe(1)
      expect(() => D2Game_6FCDEE30_113c(m, pGame, 0x20706163, 0, pShop, 2, 10, 10)).toThrow(
        D2CommonAssertError,
      )
      const { pItem: sellIt } = allocItem(m, pGame, 1, 5031)
      expect(D2Game_6FCDF990_113c(m, 5030, pGame, plr1, 5031, 0)).toBe(1)
      D2Game_6FCE1030_113c(m, pGame, plr1, 198)
      D2Game_6FCE1510_113c(m, plr1, pGame, npc, 1)

      // 0x6FCEF0E0, 0x6FCEF810, 0x6FCF08B0, 0x6FCF12E0
      const pPkt = m.alloc(0x20) >>> 0
      expect(D2Game_6FCEF0E0_113c(m, pGame, plr1, pPkt, 4)).toBe(3)
      D2Game_6FCEF810_113c(m, plr1, pGame, 2, 0x3b)
      expect(D2Game_6FCF08B0_113c(m, pGame, plr1, pPkt, 5)).toBe(3)
      expect(D2Game_6FCF12E0_113c(m, pGame, plr1, pPkt, 2)).toBe(3)

      // 0x6FCF7300, 0x6FCF78C0, 0x6FCF7CC0, 0x6FCF8020, 0x6FCF8600
      m.setU32((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20706163)
      m.setU32((pItemsTxt + 2 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20786f62)
      const { pItem: curIt } = allocItem(m, pGame, 1, 5040)
      const { pItem: boxIt, pItemData: boxData } = allocItem(m, pGame, 2, 5041)
      m.setU32((curIt + 0x10) >>> 0, 4)
      m.setU32((boxIt + 0x10) >>> 0, 0)
      m.setU8((boxData + 0x45) >>> 0, 2)
      const pOutFail = m.alloc(4) >>> 0
      expect(D2Game_6FCF7300_113c(m, plr1, pGame, 5040, 5041, 0, 0, pOutFail)).toBe(0)
      D2Game_6FCF78C0_113c(m, pGame, plr1, boxIt)
      m.setU32((curIt + 0x10) >>> 0, 0)
      expect(D2Game_6FCF7CC0_113c(m, 5040, plr1, pGame, 5041, pOutFail)).toBe(0)
      m.setU32((curIt + 0x10) >>> 0, 4)
      expect(D2Game_6FCF8020_113c(m, 5040, plr1, pGame, 1, 0, pOutFail)).toBe(0)
      expect(D2Game_6FCF8600_113c(m, 5040, plr1, pGame, 11, 0, pOutFail)).toBe(0)

      // 0x6FD08EB0, 0x6FD08F30, 0x6FD095E0
      D2Game_6FD08EB0_113c(m, pObjInteract)
      expect(m.u8((pQD11 + 0x18) >>> 0)).toBe(1)
      expect(D2Game_6FD08F30_113c(m, pGame, pQ11)).toBe(1)
      m.setU32((pObj + 0x10) >>> 0, 1)
      expect(D2Game_6FD095E0_113c(m, pObjInteract)).toBe(0)
      expect(sellIt).not.toBe(0)
      expect(INVENTORY_GetCursorItem113c(m, inv1)).toBe(0)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    const missingVas = WAVE7_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
