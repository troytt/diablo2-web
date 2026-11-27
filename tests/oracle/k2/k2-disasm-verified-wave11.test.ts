/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 11: +70 VAs).
 *
 * Audits and verifies 70 `D2Game.dll` (`0x6FC20000`) closure functions across:
 * - `k2w1-laneL-0x6fc6` (`src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c.ts`, 36 eligible functions;
 *   `0x6FC68410` `indirectUnknown` kept at `ported`)
 * - `k2w1-laneA-items-tc` (`src/d2kern-113c/game/k2-items-tc-w1-113c.ts`, 34 eligible functions;
 *   `0x6FC41840` `indirectUnknown` kept at `ported`)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`,
 *    plus manifest promotion & `indirectUnknown` guardrails.
 * 2. Differential regression tests for all 5 real 1.13c binary disassembly discrepancies fixed:
 *    - `0x6FC62C70` (`SKILLS_SrvEvent02_ApplyCalcFreezeAndState`): defers post-result so `0x6FCFE0C0`
 *      does not spuriously execute `0x6FCFCF20`.
 *    - `0x6FC6F370` (`SKILLS_ApplyCorpseExplosionAreaDamageCallback`): passes
 *      `bDeferPostResultTo6FCFCF20 = 1` to `0x6FCFE0C0` so `0x6FCFCF20` executes once, not twice.
 *    - `0x6FC700A0` (`SKILLS_ApplyCurseSpecialMonsterAiState`): delegates 1:1 to `0x6FCBD230`
 *      (`AI_InitMonsterAiThinkFn113c(m, pMonster, pGame, pAiGeneral, nSpecAi)`) instead of a buggy
 *      duplicated inline copy.
 *    - `0x6FC54AA0` / `0x6FC54B80` (`QUESTS_SendQuestStateAlert5D` / `QUESTS_SendNpcMessagePacket27`):
 *      delegates packet queueing to canonical `NET_QueuePacketToClientBuffer113c` (`0x6FCAA3E0`) so
 *      `0x6FCAA3E0` VA traces and `activeFrameS2CTrace113c` S2C captures match `D2Game.dll` 1:1.
 *    - `0x6FC469B0` (`MONSTER_Event7_MonUModEvent2`): traces tail-jump target `0x6FC468E0` on both
 *      canonical and hooked callback matrix dispatch paths.
 * 3. Multi-branch `SparseMemory113c` boundary/state assertions + 100% (`70 / 70`) live
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
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  INVENTORY_AllocInventory113c,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts'
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  AIGENERAL_GetField3C_113c,
  AIGENERAL_GetQuestDataPtr38_113c,
  AI_CheckAnyMinionDeadCallback113c,
  AI_InitBaalMinionSpawnState113c,
  AI_InitMonsterClearAiParam3_113c,
  AI_InitMonsterResetAiStateNeg1_113c,
  AI_InitMonsterSkillDelayFrame113c,
  AI_InitShadowMasterSkillSlot113c,
  AI_SelectBaalThroneSpawnClassId113c,
  CLIENTS_CaptureFirstInGameClientCallback113c,
  D2GAME_GLOBAL_SEED_OVERRIDE_VA_113C,
  D2GAME_MONUMOD_CALLBACK_MATRIX_VA_113C,
  D2GAME_SHADOW_MASTER_INIT_SLOTS_VA_113C,
  GAME_SetGlobalSeed113c,
  ITEMS_FindSuperiorQualityRecordIndex113c,
  ITEMS_ScaleStatByPercentWithMin113c,
  MONSTER_Event7_MonUModEvent2_113c,
  MONUMOD_AppendUModToMonster113c,
  MONUMOD_CopyMinionEligibleUMods113c,
  MONUMOD_CountUnitUMods113c,
  MONUMOD_GetConstantValue113c,
  MONUMOD_GetMinionClassIdForBoss113c,
  MONUMOD_GetUModListPtr113c,
  MONUMOD_MarkBossAndIncrementUniqueCount113c,
  MONUMOD_RollBossOrMinionNameSeed113c,
  MONUMOD_SetSuperUniqueId113c,
  OBJECTS_InitFn05_NoOp113c,
  OBJECTS_InitFn16_DoubleActToSubType113c,
  OBJECTS_InitFn27_RollSubType3_113c,
  OBJECTS_LevelHookAlwaysTrue113c,
  OBJECTS_SetUnitField7CDword4_113c,
  OBJECTS_SubstituteObjectClassIdFromParm0_113c,
  PLAYER_CheckHostilePlayerCallback113c,
  PLAYER_SetClientSkillHotkeySlot113c,
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c,
  QUESTS_SendNpcMessagePacket27_113c,
  QUESTS_SendQuestStateAlert5D_113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts'
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
  CLIENTS_StoreSaveDataBuffer_6FC696B0_113c,
  CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c,
  GAMETIME_GetElapsedMilliseconds_6FC72020_113c,
  MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c,
  PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c,
  REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c,
  SKILLS_AddDamagePercentStat_6FC6C190_113c,
  SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c,
  SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c,
  SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c,
  SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c,
  SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c,
  SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c,
  SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c,
  SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c,
  SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c,
  SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c,
  SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c,
  SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c,
  SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c,
  SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c,
  SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c,
} from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_CreateNodeWithGrowth113c, EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2DrlgLevelStrc,
  D2DynamicPathStrc,
  D2EventStrc,
  D2MonStats2Txt_SIZE,
  D2RoomExStrc,
  D2SkillListStrc,
  D2SkillStrc,
  D2SkillsTxt,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  beginFrameS2CTrace113c,
  endFrameS2CTrace113c,
} from '../../../src/d2kern-113c/net/packet-sink.ts'
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
  readonly batch: 'k2w1-laneL-0x6fc6' | 'k2w1-laneA-items-tc'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE11_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  // k2w1-laneL-0x6fc6: 36 eligible VAs (0x6FC68410 is indirectUnknown and stays ported)
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC62C70', size: 276, headHex: '83ec74558b6c247c', tailHex: 'c21400', tsSymbol: 'SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC63CA0', size: 160, headHex: '55576a006a0c538b', tailHex: '5f5dc3', tsSymbol: 'SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC647D0', size: 268, headHex: '8b4c240483ec0885', tailHex: 'c21000', tsSymbol: 'SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC649F0', size: 89, headHex: '83ec0885c074108b', tailHex: 'c20400', tsSymbol: 'SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC670F0', size: 236, headHex: '5185db56578bf08b', tailHex: 'c20800', tsSymbol: 'REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC68300', size: 76, headHex: '85f674458b0e8bd1', tailHex: 'c20400', tsSymbol: 'MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69240', size: 41, headHex: '85c0751f68fc0c00', tailHex: '0000c3', tsSymbol: 'CLIENTS_GetSaveHeaderPtr_6FC69240_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69580', size: 43, headHex: '85c0751f689b0b00', tailHex: '0020c3', tsSymbol: 'CLIENTS_SetClientFlag20_6FC69580_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69630', size: 114, headHex: '5733ff3bf7751f68', tailHex: '005fc3', tsSymbol: 'CLIENTS_FreeSaveDataBuffer_6FC69630_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC696B0', size: 166, headHex: '56578bf985ff8bf0', tailHex: 'c20400', tsSymbol: 'CLIENTS_StoreSaveDataBuffer_6FC696B0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69760', size: 42, headHex: '85c0751f684b0b00', tailHex: '0000c3', tsSymbol: 'CLIENTS_GetSaveDataSize_6FC69760_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69790', size: 42, headHex: '85c0751f68410b00', tailHex: '0000c3', tsSymbol: 'CLIENTS_GetSaveDataPtr_6FC69790_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69A20', size: 39, headHex: '85c0751f68d90900', tailHex: 'c00dc3', tsSymbol: 'CLIENTS_GetClientNamePtr_6FC69A20_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69AB0', size: 42, headHex: '85c0751f688b0900', tailHex: '0000c3', tsSymbol: 'CLIENTS_GetClientField488_6FC69AB0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69B70', size: 45, headHex: '85c0751f685f0900', tailHex: 'c20400', tsSymbol: 'CLIENTS_SetClientInitState_6FC69B70_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69BF0', size: 40, headHex: '85c0751f68a40800', tailHex: '4008c3', tsSymbol: 'CLIENTS_GetClientByte08_6FC69BF0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69D70', size: 54, headHex: '85c0750768d60700', tailHex: '0000c3', tsSymbol: 'CLIENTS_SetClientActNo_6FC69D70_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC69FE0', size: 65, headHex: '85c0751f68e90000', tailHex: '33c0c3', tsSymbol: 'CLIENTS_FindClientByIdInGame_6FC69FE0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6A370', size: 238, headHex: '53558b6c240c57c7', tailHex: 'c20400', tsSymbol: 'CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6A660', size: 122, headHex: '85c074068b0885c9', tailHex: 'c05fc3', tsSymbol: 'CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6A6E0', size: 152, headHex: '85c074068b0885c9', tailHex: '005ec3', tsSymbol: 'CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6B3C0', size: 60, headHex: '568bf085f6751f68', tailHex: '005ec3', tsSymbol: 'CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6C190', size: 36, headHex: '56578bfa85ff8bf1', tailHex: '5f5ec3', tsSymbol: 'SKILLS_AddDamagePercentStat_6FC6C190_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6C1C0', size: 87, headHex: '8b44240485c05657', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6DF20', size: 60, headHex: '578bf885ff7f0433', tailHex: 'c75fc3', tsSymbol: 'SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6E900', size: 85, headHex: '53578bf86a6157bb', tailHex: 'c20400', tsSymbol: 'SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6EB90', size: 79, headHex: '5356578bf16a0132', tailHex: 'c20400', tsSymbol: 'SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6EBE0', size: 79, headHex: '5356578bf16a0132', tailHex: 'c20400', tsSymbol: 'SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6EDD0', size: 101, headHex: '56578bfa8bc7e8c5', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6EE40', size: 53, headHex: '568bf28bc6e85619', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6EEE0', size: 64, headHex: '568bf2578bc6e8b5', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6F370', size: 213, headHex: '83ec7453558b690c', tailHex: 'c474c3', tsSymbol: 'SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC6F920', size: 68, headHex: '568bf285f6578bf9', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC700A0', size: 133, headHex: '85c07c7e8b0d9c82', tailHex: 'c20400', tsSymbol: 'SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC72020', size: 78, headHex: 'a1b003d36f83ec08', tailHex: 'c408c3', tsSymbol: 'GAMETIME_GetElapsedMilliseconds_6FC72020_113c' },
  { batch: 'k2w1-laneL-0x6fc6', va: '0x6FC73260', size: 80, headHex: '53568bf033db85f6', tailHex: 'c35bc3', tsSymbol: 'PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c' },

  // k2w1-laneA-items-tc: 34 eligible VAs (0x6FC41840 is indirectUnknown and stays ported)
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC33230', size: 33, headHex: '0faf4424048bc8b8', tailHex: 'c20400', tsSymbol: 'ITEMS_ScaleStatByPercentWithMin113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC332A0', size: 114, headHex: '56578bf8e8ff80ff', tailHex: '5f5ec3', tsSymbol: 'ITEMS_FindSuperiorQualityRecordIndex113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC35520', size: 16, headHex: '8b4424048b08c741', tailHex: 'c20400', tsSymbol: 'AI_InitMonsterClearAiParam3_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC35530', size: 16, headHex: '8b4424048b08c741', tailHex: 'c20400', tsSymbol: 'AI_InitMonsterResetAiStateNeg1_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC35540', size: 34, headHex: '8b5424048b028b89', tailHex: 'c20400', tsSymbol: 'AI_InitBaalMinionSpawnState113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC35570', size: 27, headHex: '85c9568bf2740a51', tailHex: 'c20400', tsSymbol: 'AI_CheckAnyMinionDeadCallback113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC355C0', size: 147, headHex: '538b5c240855568b', tailHex: 'c20400', tsSymbol: 'AI_InitShadowMasterSkillSlot113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC356C0', size: 108, headHex: '8b442404568b308b', tailHex: 'c20400', tsSymbol: 'AI_InitMonsterSkillDelayFrame113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC35730', size: 349, headHex: '53558b2d9c82d16f', tailHex: 'c20800', tsSymbol: 'AI_SelectBaalThroneSpawnClassId113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC40C60', size: 29, headHex: '85c9741383390175', tailHex: '403cc3', tsSymbol: 'AIGENERAL_GetField3C_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC40DE0', size: 31, headHex: '85c0741383380175', tailHex: '0000c3', tsSymbol: 'AIGENERAL_GetQuestDataPtr38_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC41860', size: 20, headHex: '33c0803900740c41', tailHex: '0000c3', tsSymbol: 'MONUMOD_CountUnitUMods113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC41F60', size: 71, headHex: '85c056750583c8ff', tailHex: 'c15ec3', tsSymbol: 'MONUMOD_GetMinionClassIdForBoss113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC41FB0', size: 40, headHex: '85c07c218b0d9c82', tailHex: '33c0c3', tsSymbol: 'MONUMOD_GetConstantValue113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC42920', size: 51, headHex: '85c0742c83380175', tailHex: 'c20400', tsSymbol: 'MONUMOD_AppendUModToMonster113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC42A10', size: 28, headHex: '85c0741583380175', tailHex: 'c20400', tsSymbol: 'MONUMOD_SetSuperUniqueId113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC42AF0', size: 23, headHex: '85c0740c83380175', tailHex: 'c01cc3', tsSymbol: 'MONUMOD_GetUModListPtr113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC43020', size: 60, headHex: '85c974358b442404', tailHex: 'c20400', tsSymbol: 'MONUMOD_RollBossOrMinionNameSeed113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC43060', size: 159, headHex: '85c05557740c8338', tailHex: 'f0ebb7', tsSymbol: 'MONUMOD_CopyMinionEligibleUMods113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC43260', size: 73, headHex: '85c074448b1083fa', tailHex: '1608c3', tsSymbol: 'MONUMOD_MarkBossAndIncrementUniqueCount113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC469B0', size: 21, headHex: 'c744240802000000', tailHex: 'ffffff', tsSymbol: 'MONSTER_Event7_MonUModEvent2_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC4A0C0', size: 8, headHex: '833a007502890ac3', tailHex: '890ac3', tsSymbol: 'CLIENTS_CaptureFirstInGameClientCallback113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC4A210', size: 12, headHex: '8b442404a354e3d2', tailHex: 'c20400', tsSymbol: 'GAME_SetGlobalSeed113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC4E4F0', size: 19, headHex: 'e873ccfdff85c074', tailHex: 'c20400', tsSymbol: 'OBJECTS_SetUnitField7CDword4_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC4E5C0', size: 8, headHex: 'b801000000c20400', tailHex: 'c20400', tsSymbol: 'OBJECTS_LevelHookAlwaysTrue113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC4E720', size: 1, headHex: 'c3', tailHex: 'c3', tsSymbol: 'OBJECTS_InitFn05_NoOp113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC4E760', size: 21, headHex: '8b41108a90800100', tailHex: '5104c3', tsSymbol: 'OBJECTS_InitFn16_DoubleActToSubType113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC4E8B0', size: 48, headHex: '85f6750583c8ffeb', tailHex: '4e04c3', tsSymbol: 'OBJECTS_SubstituteObjectClassIdFromParm0_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC4E9F0', size: 65, headHex: '5355568b710c8b06', tailHex: '045bc3', tsSymbol: 'OBJECTS_InitFn27_RollSubType3_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC540C0', size: 103, headHex: '8b430c578b7e0450', tailHex: 'ff5fc3', tsSymbol: 'QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC54AA0', size: 122, headHex: '83ec0856e8cf59fd', tailHex: 'c20800', tsSymbol: 'QUESTS_SendQuestStateAlert5D_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC54B80', size: 113, headHex: '83ec5085c056578b', tailHex: 'c20400', tsSymbol: 'QUESTS_SendNpcMessagePacket27_113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC57890', size: 73, headHex: '85c0741583380075', tailHex: 'c20c00', tsSymbol: 'PLAYER_SetClientSkillHotkeySlot113c' },
  { batch: 'k2w1-laneA-items-tc', va: '0x6FC57940', size: 89, headHex: '538b5c240856578b', tailHex: 'c20400', tsSymbol: 'PLAYER_CheckHostilePlayerCallback113c' },
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

function createWave11World() {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(0x6fd18000, 0x20000, 0)
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

  // SkillsTxt (160 rows * 0x23C) + SkillCode RPN buffer
  const skillsCount = 160
  const pSkillsTxt = m.alloc(skillsCount * 0x23c) >>> 0
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

  // StatesTxt (185 rows * 0x3C) + corpse state masks
  const statesCount = 185
  const pStatesTxt = m.alloc(statesCount * 0x3c) >>> 0
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc4) >>> 0, statesCount)
  m.setU32((pDataTables + 0xbb8) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xbc0) >>> 0, statesCount)
  const pCorpseStateMask = m.alloc(24) >>> 0
  m.setU32((pDataTables + 0xe4) >>> 0, pCorpseStateMask)
  m.setU32((pDataTables + 0x150) >>> 0, pCorpseStateMask)

  // LevelsTxt (16 rows * 0x220) + WarpData
  const pLevelsTxt = m.alloc(16 * 0x220) >>> 0
  const pWarpData = m.alloc(0x80) >>> 0
  m.setU32((pDataTables + 0xbd8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xbe0) >>> 0, 16)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc60) >>> 0, 16)
  m.setU32((pDataTables + 0xc64) >>> 0, pWarpData)

  // MonUModTxt (45 rows * 0x20)
  const pMonUModTxt = m.alloc(45 * 0x20) >>> 0
  m.setU32((pDataTables + 0xc50) >>> 0, pMonUModTxt)
  m.setU32((pDataTables + 0xc54) >>> 0, 45)

  // ItemsTxt (30 rows * 0x1A8) in both D2Common & datatbls globals
  const itemsCount = 30
  const pItemsTxt = m.alloc(itemsCount * ITEMS_TXT_STRIDE_113C) >>> 0
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, itemsCount)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, itemsCount)

  // ObjectsTxt (100 rows * 0x1C0)
  const pObjectsTxt = m.alloc(100 * 0x1c0) >>> 0
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 100)

  // AnimData table + PlrType/PlrMode globals for UNITS_SetUnitAnimMode113c
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

  // Shadow Master init slots table (0x6FD1CEE8): {2, 0}, {4, 0}, {1, 1}
  const shadowSlots = [2, 0, 4, 0, 1, 1]
  for (let i = 0; i < shadowSlots.length; i++) {
    m.setU32((D2GAME_SHADOW_MASTER_INIT_SLOTS_VA_113C + i * 4) >>> 0, shadowSlots[i]!)
  }

  // MonUMod callback matrix (row 9 col 2 = 0x6FC466B0)
  m.fill(D2GAME_MONUMOD_CALLBACK_MATRIX_VA_113C, 43 * 24, 0)
  m.setU32((D2GAME_MONUMOD_CALLBACK_MATRIX_VA_113C + (9 * 6 + 2) * 4) >>> 0, 0x6fc466b0)

  return {
    m,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pSkillCode,
    pIscTxt,
    pStatesTxt,
    pMonUModTxt,
    pItemsTxt,
    pObjectsTxt,
    pAnimDataTable,
  }
}

function writeRpnImm32(m: SparseMemory113c, pSkillCode: number, offset: number, val: number): number {
  const addr = (pSkillCode + offset) >>> 0
  m.setU8(addr, 0x09)
  m.setU32((addr + 1) >>> 0, val >>> 0)
  m.setU8((addr + 5) >>> 0, 0x00)
  return offset
}

function allocDynamicUnit(
  m: SparseMemory113c,
  unitType: number,
  classId: number,
  unitId: number,
  x = 100,
  y = 200,
) {
  const pUnit = m.alloc(0x100) >>> 0
  const pUnitData = m.alloc(0x100) >>> 0
  const pPath = m.alloc(0x60) >>> 0
  m.setU32(pUnit, unitType >>> 0)
  m.setU32((pUnit + 0x04) >>> 0, classId >>> 0)
  m.setU32((pUnit + 0x0c) >>> 0, unitId >>> 0)
  m.setU32((pUnit + 0x10) >>> 0, 1)
  m.setU32((pUnit + 0x14) >>> 0, pUnitData)
  // Always initialize non-zero RNG seed on every unit
  m.setU32((pUnit + 0x20) >>> 0, (0x12345670 + unitId) >>> 0)
  m.setU32((pUnit + 0x24) >>> 0, 666)
  m.setU32((pUnit + 0x2c) >>> 0, pPath)
  m.setU16((pPath + 0x02) >>> 0, x & 0xffff)
  m.setU16((pPath + 0x06) >>> 0, y & 0xffff)
  const pStatListEx = STATLIST_CreateEx113c(m, pUnit, 0, 0)
  m.set(pUnit, D2UnitStrc.pStatListEx, pStatListEx)
  return { pUnit, pPath, pUnitData, pStatListEx }
}

function allocRoomWithLevel(m: SparseMemory113c, levelId: number): number {
  const pRoom = m.alloc(0x90) >>> 0
  const pRoomEx = m.alloc(0xf0) >>> 0
  const pLevel = m.alloc(0x200) >>> 0
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  m.setU32((pLevel + 0x1d0) >>> 0, levelId >>> 0)
  return pRoom
}

describe('D2Game.dll v1.13c Disassembly Verification Wave 11 (+70 VAs across laneL + laneA)', () => {
  it('verifies exact PE32 machine-code leading/trailing opcodes, sizes, and manifest promotion for all 70 VAs', () => {
    expect(WAVE11_PROMOTED_SPECS.length).toBe(70)
    const uniqueVas = new Set(WAVE11_PROMOTED_SPECS.map((s) => s.va.toUpperCase()))
    expect(uniqueVas.size).toBe(70)

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
    const byVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        byVa.set(fn.va.toUpperCase(), fn)
      }
    }

    // Both formerly indirectUnknown VAs in these 2 shards were promoted in Wave 23 (Batch A)
    for (const skippedVa of ['0x6FC68410', '0x6FC41840']) {
      const mFn = byVa.get(skippedVa.toUpperCase())
      expect(mFn).toBeDefined()
      expect(mFn!.status).toBe('diff-verified')
    }

    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    const pe = fs.existsSync(dllPath) ? loadPeSectionMapper(dllPath, 0x6fc20000) : null

    for (const spec of WAVE11_PROMOTED_SPECS) {
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

  it('regression: 0x6FC62C70 (SKILLS_SrvEvent02) calls 0x6FCFE0C0 only and never spuriously invokes 0x6FCFCF20', () => {
    const w = createWave11World()
    const { m, pSkillsTxt, pSkillCode } = w
    const pGame = m.alloc(0x1df4) >>> 0
    EVENT_InitTimerQueue113c(m, pGame)

    const { pUnit: pAttacker } = allocDynamicUnit(m, 0, 5, 1)
    const { pUnit: pTarget } = allocDynamicUnit(m, 1, 2, 2)
    STATLIST_SetUnitStat113c(m, pTarget, 6, 512, 0)
    STATLIST_SetUnitStat113c(m, pTarget, 7, 512, 0)

    const calcOff = writeRpnImm32(m, pSkillCode, 0x10, 50)
    const pSkillRec = (pSkillsTxt + 12 * 0x23c) >>> 0
    m.setU32((pSkillRec + 0x138) >>> 0, calcOff)
    m.setU16((pSkillRec + 0x110) >>> 0, 0x2b)

    const pDmg = m.alloc(0x70) >>> 0
    m.setU32((pDmg + 0x08) >>> 0, 128)

    beginVaTrace113c()
    const res = SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c(
      m,
      pGame,
      2,
      pAttacker,
      pTarget,
      pDmg,
      12,
      -5,
    )
    const hits = new Set(endVaTrace113c())

    expect(res).toBe(1)
    expect(hits.has('D2Game:0x6FC62C70')).toBe(true)
    expect(hits.has('D2Game:0x6FCFE0C0')).toBe(true)
    // 0x6FC62D3D calls only 0x6FCFE0C0 (SUNITDMG_ApplyDamage) and NEVER calls 0x6FCFCF20
    expect(hits.has('D2Game:0x6FCFCF20')).toBe(false)
    expect(STATLIST_GetUnitStat113c(m, pTarget, 0xb2, 0)).toBe(0x2b)
  })

  it('regression: 0x6FC6F370 (Corpse Explosion callback) invokes 0x6FCFE0C0 with deferred post-result and calls 0x6FCFCF20 once', () => {
    const w = createWave11World()
    const { m } = w
    const pGame = m.alloc(0x1df4) >>> 0
    EVENT_InitTimerQueue113c(m, pGame)

    const { pUnit: pAttacker } = allocDynamicUnit(m, 0, 2, 1, 100, 100)
    const { pUnit: pNearMon } = allocDynamicUnit(m, 1, 5, 2, 102, 100)
    const { pUnit: pFarMon } = allocDynamicUnit(m, 1, 5, 3, 110, 100)
    STATLIST_SetUnitStat113c(m, pNearMon, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pNearMon, 7, 1000, 0)
    STATLIST_SetUnitStat113c(m, pFarMon, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pFarMon, 7, 1000, 0)

    const pSrcDmg = m.alloc(0x70) >>> 0
    m.setU32(pSrcDmg, 0x8000)
    m.setU16((pSrcDmg + 0x04) >>> 0, 0x0001)
    m.setU32((pSrcDmg + 0x08) >>> 0, 250)
    m.setU32((pSrcDmg + 0x10) >>> 0, 100)

    const pSubCtx = m.alloc(0x10) >>> 0
    m.setU32(pSubCtx, pSrcDmg)
    m.setU32((pSubCtx + 0x04) >>> 0, 100)
    m.setU32((pSubCtx + 0x08) >>> 0, 100)
    m.setU32((pSubCtx + 0x0c) >>> 0, 25) // maxPhysDistSq = 25 (near distSq=4 <= 25, far distSq=100 > 25)

    const pAuraCtx = m.alloc(0x10) >>> 0
    m.setU32(pAuraCtx, pGame)
    m.setU32((pAuraCtx + 0x04) >>> 0, pAttacker)
    m.setU32((pAuraCtx + 0x0c) >>> 0, pSubCtx)

    beginVaTrace113c()
    const rNear = SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c(m, pAuraCtx, pNearMon)
    const rFar = SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c(m, pAuraCtx, pFarMon)
    const trace = endVaTrace113c()

    expect(rNear).toBe(1)
    expect(rFar).toBe(1)
    expect(trace.has('D2Game:0x6FC6F370')).toBe(true)
    expect(trace.has('D2Game:0x6FCFE0C0')).toBe(true)
    expect(trace.has('D2Game:0x6FCFCF20')).toBe(true)
    // Near monster took phys+fire (350); far monster had phys zeroed and took fire only (100)
    expect(STATLIST_GetUnitStat113c(m, pNearMon, 6, 0)).toBe(650)
    expect(STATLIST_GetUnitStat113c(m, pFarMon, 6, 0)).toBe(900)
  })

  it('regression: 0x6FC700A0 (Curse Special AI State) delegates 1:1 to 0x6FCBD230 with explicit pGame/pAiGeneral/nSpecAi', () => {
    const w = createWave11World()
    const { m, pSkillsTxt, pMonStatsTxt } = w
    const pGame = m.alloc(0x1df4) >>> 0

    const { pUnit: pMon, pUnitData: pMonData } = allocDynamicUnit(m, 1, 5, 6)
    // Deliberately leave pMon->pGame (+0x80) as 0 to prove passed pGame arg is forwarded to 0x6FCBD230
    m.setU32((pMon + 0x80) >>> 0, 0)
    const pAiGen = m.alloc(0x40) >>> 0
    const pAiCtrl = m.alloc(0x40) >>> 0
    m.setU32(pMonData, (pMonStatsTxt + 5 * 0x1a8) >>> 0)
    m.setU16((pMonStatsTxt + 5 * 0x1a8 + 0x1e) >>> 0, 6)
    m.setU32((pMonData + 0x28) >>> 0, pAiGen)
    m.setU32((pMonData + 0x2c) >>> 0, pAiCtrl)
    m.setU32((pAiGen + 0x14) >>> 0, 77)

    // 0x17 -> 0x0A, 0x1B -> 0x0C, 0x38 -> 0x0B, other -> 0
    m.setU16((pSkillsTxt + 86 * 0x23c + 0x82) >>> 0, 0x17)
    m.setU16((pSkillsTxt + 81 * 0x23c + 0x82) >>> 0, 0x1b)
    m.setU16((pSkillsTxt + 95 * 0x23c + 0x82) >>> 0, 0x38)
    m.setU16((pSkillsTxt + 82 * 0x23c + 0x82) >>> 0, 0x05)

    beginVaTrace113c()
    SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, 86, pMon, pGame)
    const hits1 = endVaTrace113c()
    expect(hits1.has('D2Game:0x6FC700A0')).toBe(true)
    expect(hits1.has('D2Game:0x6FCBD230')).toBe(true)
    expect(hits1.has('D2Game:0x6FC41420')).toBe(true)
    expect(m.u32(pAiGen)).toBe(0x0a)
    expect(m.u32((pAiGen + 0x14) >>> 0)).toBe(0)
    expect(m.u32((pAiGen + 0x04) >>> 0)).not.toBe(0)
    expect(m.u32((pAiCtrl + 0x04) >>> 0)).toBe(0)

    SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, 81, pMon, pGame)
    expect(m.u32(pAiGen)).toBe(0x0c)
    SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, 95, pMon, pGame)
    expect(m.u32(pAiGen)).toBe(0x0b)
    SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, 82, pMon, pGame)
    expect(m.u32(pAiGen)).toBe(0)

    // State 0x36 (UNINTERRUPTABLE) throws via 0x6FCBD230 (line 0x1a6 = 422)
    STATES_ToggleGfxStateFlag113c(m, pMon, 0x36, 1)
    expect(() => SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, 86, pMon, pGame)).toThrow(
      /0x36|0x1a6|422/,
    )
  })

  it('regression: 0x6FC54AA0 & 0x6FC54B80 delegate to canonical 0x6FCAA3E0 with live VA + S2C trace capture', () => {
    const { m } = createWave11World()
    const { pUnit: pPlayer, pPath, pUnitData: pPD } = allocDynamicUnit(m, 0, 0, 77)
    const pClient = m.alloc(0x520) >>> 0
    m.setU32((pPD + 0x9c) >>> 0, pClient)

    const pRoom = m.alloc(0x80) >>> 0
    const pRoomEx = m.alloc(0x80) >>> 0
    const pLevel = m.alloc(0x200) >>> 0
    m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
    m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
    m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
    m.set(pLevel, D2DrlgLevelStrc.nLevelId, 40) // Act 1

    const pObj = m.alloc(0x40) >>> 0
    m.setU32((pObj + 0x0c) >>> 0, 0x11223344)

    beginVaTrace113c()
    beginFrameS2CTrace113c()
    QUESTS_SendQuestStateAlert5D_113c(m, pPlayer, 0x24, 1)
    QUESTS_SendNpcMessagePacket27_113c(m, pPlayer, pObj, 0x4ec9)
    const s2c = endFrameS2CTrace113c()
    const vaHits = new Set(endVaTrace113c())

    expect(vaHits.has('D2Game:0x6FC54AA0')).toBe(true)
    expect(vaHits.has('D2Game:0x6FC54B80')).toBe(true)
    expect(vaHits.has('D2Game:0x6FCAA3E0')).toBe(true)
    expect(s2c.length).toBe(2)
    expect(s2c[0]).toBe('5d24000c0000')
    expect(s2c[1]!.length).toBe(80) // 40 bytes hex
    expect(s2c[1]!.startsWith('27024433221101000000c94e')).toBe(true)
  })

  it('exercises all 70 promoted Wave 11 VAs with concrete assertions and 100% live VA trace coverage', () => {
    const cumulativeHits = new Set<string>()

    // -------------------------------------------------------------------------
    // Shard 1: k2w1-laneL-0x6fc6 (36 eligible VAs)
    // -------------------------------------------------------------------------
    {
      const w = createWave11World()
      const { m, pDataTables, pMonStatsTxt, pMonStats2Txt, pSkillsTxt, pSkillCode, pStatesTxt, pItemsTxt } = w
      const pGame = m.alloc(0x1df4) >>> 0
      m.setU32((pGame + 0xa8) >>> 0, 1000)
      EVENT_InitTimerQueue113c(m, pGame)

      const { pUnit: pPlr, pPath: pPlrPath, pUnitData: pPD } = allocDynamicUnit(m, 0, 2, 1, 100, 100)
      const { pUnit: pMon, pUnitData: pMonData } = allocDynamicUnit(m, 1, 5, 2, 102, 100)
      const { pUnit: pMon2, pUnitData: pMon2Data } = allocDynamicUnit(m, 1, 6, 3, 110, 100)
      SUNIT_InsertServerUnit113c(m, pGame, pPlr)
      SUNIT_InsertServerUnit113c(m, pGame, pMon)
      SUNIT_InsertServerUnit113c(m, pGame, pMon2)
      m.setU32((pMon + 0x80) >>> 0, pGame)
      m.setU32((pMon2 + 0x80) >>> 0, pGame)

      const pClient1 = m.alloc(0x520) >>> 0
      const pClient2 = m.alloc(0x520) >>> 0
      m.setU32(pClient1, 101)
      m.setU32((pClient1 + 0x174) >>> 0, pPlr)
      m.setU32((pClient1 + 0x1a8) >>> 0, pGame)
      m.setU32((pClient1 + 0x488) >>> 0, 0xabcdef12)
      m.setU8((pClient1 + 0x08) >>> 0, 0x04)
      m.setU32((pClient1 + 0x4a8) >>> 0, pClient2)
      m.setU32(pClient2, 202)
      m.setU32((pGame + 0x88) >>> 0, pClient1)
      m.setU32((pPD + 0x9c) >>> 0, pClient1)

      // 0x6FC62C70 setup
      const off50 = writeRpnImm32(m, pSkillCode, 0x10, 50)
      const off25 = writeRpnImm32(m, pSkillCode, 0x20, 25)
      m.setU32((pSkillsTxt + 10 * 0x23c + 0x138) >>> 0, off50)
      m.setU16((pSkillsTxt + 10 * 0x23c + 0x110) >>> 0, 0x2a)
      // 0x6FC647D0 setup
      const pPassiveList = STATLIST_AllocList113c(m, 0, 0, 1, 0, 0)
      m.setU16((pSkillsTxt + 7 * 0x23c + 0x98) >>> 0, 0x44)
      m.setU32((pSkillsTxt + 7 * 0x23c + 0xa4) >>> 0, off25)
      for (let i = 1; i < 5; i++) m.setU16((pSkillsTxt + 7 * 0x23c + 0x98 + i * 2) >>> 0, 0xffff)

      // 0x6FC63CA0 setup
      STATES_ToggleGfxStateFlag113c(m, pMon, 0x0c, 1)
      m.setU8((pMonStats2Txt + 5 * D2MonStats2Txt_SIZE + 0x108) >>> 0, 15)
      const ev0 = EVENT_CreateNodeWithGrowth113c(m, pGame, pMon)
      m.set(ev0, D2EventStrc.nType, 0)
      m.set(ev0, D2EventStrc.dwFrame, 0xffffffff)

      // 0x6FC649F0 setup
      m.setU32((pMon + 0xc8) >>> 0, 0x08)
      const pTransList = m.alloc(4) >>> 0
      m.setU16(pTransList, 139)
      m.setU32((pDataTables + 0x17c) >>> 0, pTransList)
      m.setU16((pDataTables + 0x180) >>> 0, 1)
      m.setU8((pStatesTxt + 139 * 0x3c + 0x2d) >>> 0, 1)
      m.setU16((pStatesTxt + 139 * 0x3c + 0x2e) >>> 0, 20)
      STATES_ToggleGfxStateFlag113c(m, pMon, 139, 1)

      // 0x6FC670F0 setup (room + logical coord node + MonStats min/max grp)
      const pWildRoom = allocRoomWithLevel(m, 2)
      const pWildRoomEx = m.u32((pWildRoom + 0x10) >>> 0)
      const pLogical = m.alloc(0x40) >>> 0
      const pCoordNode = m.alloc(0x30) >>> 0
      m.setU8(pLogical, 1)
      m.setU32((pLogical + 0x30) >>> 0, pCoordNode)
      m.setU32((pWildRoomEx + 0x64) >>> 0, pLogical)
      m.setU32((pWildRoom + 0x4c) >>> 0, 0)
      m.setU32((pWildRoom + 0x50) >>> 0, 0)
      m.setU32((pWildRoom + 0x54) >>> 0, 40)
      m.setU32((pWildRoom + 0x58) >>> 0, 40)
      m.setU32((pCoordNode + 0x08) >>> 0, 40)
      m.setU32((pCoordNode + 0x0c) >>> 0, 40)
      m.setU8((pCoordNode + 0x14) >>> 0, 1)
      m.setU8((pMonStatsTxt + 5 * 0x1a8 + 0x2f) >>> 0, 2)
      m.setU8((pMonStatsTxt + 5 * 0x1a8 + 0x30) >>> 0, 2)

      // 0x6FC68300 setup
      const pInteract = m.alloc(0x10) >>> 0
      const pNode1 = m.alloc(0x0c) >>> 0
      m.setU32(pNode1, pPlr)
      m.setU32((pNode1 + 0x08) >>> 0, 0)
      m.setU32(pInteract, pNode1)

      // 0x6FC6A370 setup
      const pTrackNodes = m.alloc(2 * 12) >>> 0
      m.setU32(pTrackNodes, pMon)
      m.setU32((pTrackNodes + 8) >>> 0, 1)
      m.setU32((pTrackNodes + 12) >>> 0, 0)
      m.setU32((pTrackNodes + 20) >>> 0, 0)

      // 0x6FC6B3C0 room change setup
      m.setU32(0x6fdf1420, 0)
      m.setU32(0x6fdf1424, 0)
      const pDrlg = m.alloc(0x500) >>> 0
      const pWarp = m.alloc(0x48) >>> 0
      m.setU32(pWarp, 1)
      m.setU32((pDrlg + 0x90) >>> 0, pWarp)
      const pRoomLevel = m.alloc(0x200) >>> 0
      m.setU32((pRoomLevel + 0x1b4) >>> 0, pDrlg)
      m.setU32((pRoomLevel + 0x1d0) >>> 0, 1)
      const pRoom2 = m.alloc(0x100) >>> 0
      m.setU32((pRoom2 + 0x58) >>> 0, pRoomLevel)
      const pRoomA = m.alloc(0x90) >>> 0
      const pNearA = m.alloc(4) >>> 0
      m.setU32(pNearA, pRoomA)
      m.setU32(pRoomA, pNearA)
      m.setU32((pRoomA + 0x10) >>> 0, pRoom2)
      m.setU32((pRoomA + 0x24) >>> 0, 1)
      m.setU32((pRoomA + 0x48) >>> 0, m.alloc(0x20) >>> 0)
      m.setU32((pRoomA + 0x74) >>> 0, 4)

      // 0x6FC6E900 setup
      STATES_ToggleGfxStateFlag113c(m, pPlr, 0x61, 1)
      const pState61 = STATLIST_AllocList113c(m, 0, 0, 1, 0x61, 0)
      STATLIST_SetStat113c(m, pState61, 0x15f, 4, 0)
      STATLIST_MergeStatLists113c(m, pPlr, pState61, 1)
      const pAiGen = m.alloc(0x40) >>> 0
      m.setU32(pMonData, (pMonStatsTxt + 5 * 0x1a8) >>> 0)
      m.setU16((pMonStatsTxt + 5 * 0x1a8 + 0x1e) >>> 0, 6)
      m.setU32((pMonData + 0x28) >>> 0, pAiGen)

      // 0x6FC6EDD0 metal ground item + 0x6FC6EEE0 corpse setup
      const pItem = m.alloc(0x100) >>> 0
      const pItemData = m.alloc(0x80) >>> 0
      m.setU32(pItem, 4)
      m.setU32((pItem + 0x04) >>> 0, 3)
      m.setU32((pItem + 0x0c) >>> 0, 50)
      m.setU32((pItem + 0x10) >>> 0, 3)
      m.setU32((pItem + 0x14) >>> 0, pItemData)
      m.setU32((pItemsTxt + 3 * ITEMS_TXT_STRIDE_113C + 0xdc) >>> 0, 0x02)
      m.setU32((pItemData + 0x18) >>> 0, 0x10)
      SUNIT_InsertServerUnit113c(m, pGame, pItem)

      const pCorpsePath = m.u32((pMon2 + 0x2c) >>> 0)
      m.setU32((pMon2 + 0x10) >>> 0, 12)
      m.setU32((pCorpsePath + 0x1c) >>> 0, pWildRoom)
      m.setU8((pMonStats2Txt + 6 * D2MonStats2Txt_SIZE + 0x04) >>> 0, 0x80)

      // 0x6FC6F370 setup
      STATLIST_SetUnitStat113c(m, pMon, 6, 1000, 0)
      STATLIST_SetUnitStat113c(m, pMon, 7, 1000, 0)
      const pSrcDmg = m.alloc(0x70) >>> 0
      m.setU32(pSrcDmg, 0x8000)
      m.setU16((pSrcDmg + 0x04) >>> 0, 0x0001)
      m.setU32((pSrcDmg + 0x08) >>> 0, 100)
      const pSubCtx = m.alloc(0x10) >>> 0
      m.setU32(pSubCtx, pSrcDmg)
      m.setU32((pSubCtx + 0x04) >>> 0, 100)
      m.setU32((pSubCtx + 0x08) >>> 0, 100)
      m.setU32((pSubCtx + 0x0c) >>> 0, 25)
      const pAuraCtx = m.alloc(0x10) >>> 0
      m.setU32(pAuraCtx, pGame)
      m.setU32((pAuraCtx + 0x04) >>> 0, pPlr)
      m.setU32((pAuraCtx + 0x0c) >>> 0, pSubCtx)

      // 0x6FC700A0 setup
      m.setU16((pSkillsTxt + 86 * 0x23c + 0x82) >>> 0, 0x17)

      // 0x6FC73260 inventory setup
      const pInv = INVENTORY_AllocInventory113c(m, 0, pPlr)
      m.setU32((pInv + 0x20) >>> 0, pItem)

      // 0x6FC696B0 source buffer
      const pSaveSrc = m.alloc(0x10) >>> 0
      m.setU32(pSaveSrc, 0x11223344)

      // 0x6FC6DF20 life setup
      STATLIST_SetUnitStat113c(m, pPlr, 7, 200 << 8, 0)
      STATLIST_SetUnitStat113c(m, pPlr, 6, 150 << 8, 0)

      // 0x6FC72020 timer setup
      m.setU32(0x6fd303b0, 0)
      m.setU32(0x6fd18d10, 424242)

      beginVaTrace113c()
      expect(SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c(m, pGame, 2, pPlr, pMon, 0, 10, 2)).toBe(1)
      SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c(m, pGame, pMon)
      expect(STATES_CheckState113c(m, pMon, 0x0c)).toBe(0)
      SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c(m, 0, pPlr, pPassiveList, 7, 2)
      expect(STATLIST_GetStatValue113c(m, pPassiveList, 0x45, 0)).toBe(25)
      expect(SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c(m, pPlr, 9)).toBe(9)
      expect(typeof SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c(m, pMon, 4)).toBe('number')

      const { pUnit: fakeLeader, pPath: pLeaderPath } = allocDynamicUnit(m, 1, 5, 100, 8, 12)
      m.setU32((pLeaderPath + 0x1c) >>> 0, pWildRoom)
      let spawnedMembers = 0
      expect(
        REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c(m, 12, 8, 5, pGame, pWildRoom, {
          onMonsterCreate: (_mem, args) => {
            if (args.nMaxRadius === -1) return fakeLeader
            spawnedMembers++
            return allocDynamicUnit(m, 1, 5, 200 + spawnedMembers).pUnit
          },
        }),
      ).toBe(fakeLeader)
      expect(spawnedMembers).toBe(1)

      MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c(m, pInteract, pPlr, pGame)
      expect(m.u32(pInteract)).toBe(0)

      expect(CLIENTS_GetSaveHeaderPtr_6FC69240_113c(m, pClient1)).toBe((pClient1 + 0x48c) >>> 0)
      CLIENTS_SetClientFlag20_6FC69580_113c(m, pClient1)
      expect(m.u32((pClient1 + 0x3d4) >>> 0) & 0x20).toBe(0x20)
      CLIENTS_StoreSaveDataBuffer_6FC696B0_113c(m, pClient1, 4, pSaveSrc)
      expect(CLIENTS_GetSaveDataSize_6FC69760_113c(m, pClient1)).toBe(4)
      expect(m.u32(CLIENTS_GetSaveDataPtr_6FC69790_113c(m, pClient1))).toBe(0x11223344)
      CLIENTS_FreeSaveDataBuffer_6FC69630_113c(m, pClient1)
      expect(CLIENTS_GetSaveDataPtr_6FC69790_113c(m, pClient1)).toBe(0)

      expect(CLIENTS_GetClientNamePtr_6FC69A20_113c(m, pClient1)).toBe((pClient1 + 0x0d) >>> 0)
      expect(CLIENTS_GetClientField488_6FC69AB0_113c(m, pClient1)).toBe(0xabcdef12)
      CLIENTS_SetClientInitState_6FC69B70_113c(m, pClient1, 3)
      expect(m.u32((pClient1 + 0x04) >>> 0)).toBe(3)
      expect(CLIENTS_GetClientByte08_6FC69BF0_113c(m, pClient1)).toBe(0x04)
      CLIENTS_SetClientActNo_6FC69D70_113c(m, pClient1, 2)
      expect(m.u8((pClient1 + 0x1ac) >>> 0)).toBe(2)
      expect(CLIENTS_FindClientByIdInGame_6FC69FE0_113c(m, pGame, 202)).toBe(pClient2)
      CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c(m, pClient1, pTrackNodes)
      expect(m.u32((pClient1 + 0x3bc) >>> 0)).toBe(1)

      CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c(m, pPlr, pGame)
      expect(CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c(m, pPlr, pGame)).toBe(0)
      CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c(m, pClient1, pRoomA)
      expect(m.u32((pClient1 + 0x1b4) >>> 0)).toBe(pRoomA)

      SKILLS_AddDamagePercentStat_6FC6C190_113c(m, pPlr, 30)
      expect(STATLIST_GetUnitStat113c(m, pPlr, 0x19, 0)).toBe(30)
      PATH_SetTargetUnit113c(m, pPlrPath, pMon)
      expect(SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c(m, pGame, pPlr, 1, 1)).toBe(1)
      expect(SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, 80 << 8, pPlr)).toBe(50 << 8)

      SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c(m, pPlr, pMon)
      SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c(m, pMon, 0x39, 0)
      SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c(m, pMon2, 0x3b, 0)
      expect(pMon2Data).not.toBe(0)

      PATH_SetTargetUnit113c(m, pPlrPath, pItem)
      expect(SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c(m, pGame, pPlr, 94, 1)).toBe(1)
      PATH_SetTargetUnit113c(m, pPlrPath, pMon2)
      expect(SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c(m, pGame, pPlr, 74, 1)).toBe(1)
      expect(SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c(m, pGame, pPlr, 74, 1)).toBe(1)

      expect(SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c(m, pAuraCtx, pMon)).toBe(1)
      PATH_SetTargetUnit113c(m, pPlrPath, pMon)
      expect(SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c(m, pGame, pPlr, 1, 1)).toBe(1)
      SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, 86, pMon, pGame)
      expect(m.u32(pAiGen)).toBe(0x0a)
      expect(GAMETIME_GetElapsedMilliseconds_6FC72020_113c(m)).toBe(424242)
      expect(PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c(m, pInv)).toBe(1)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 2: k2w1-laneA-items-tc (34 eligible VAs)
    // -------------------------------------------------------------------------
    {
      const w = createWave11World()
      const { m, pMonStatsTxt, pSkillsTxt, pMonUModTxt, pItemsTxt, pObjectsTxt } = w
      const pGame = m.alloc(0x1df4) >>> 0
      m.setU32((pGame + 0xa8) >>> 0, 500)
      m.setU8((pGame + 0x6d) >>> 0, 1) // Nightmare

      // Items + QualityItemsTxt for 0x6FC332A0
      const pItem = m.alloc(0x100) >>> 0
      m.setU32(pItem, 4)
      m.setU32((pItem + 0x04) >>> 0, 2)
      m.setU32((pItemsTxt + 2 * 0x1a8 + 0x80) >>> 0, 0x726f7773)
      const pQualTable = m.alloc(3 * 0x20) >>> 0
      m.setU32(0x6fdefda0, 3)
      m.setU32(0x6fdefda4, pQualTable)
      m.setU32((pQualTable + 1 * 0x20 + 0x18) >>> 0, 0x726f7773)

      // AI init structures
      const pAiCtrl = m.alloc(0x50) >>> 0
      const pAiTick = m.alloc(0x30) >>> 0
      const pMonStatsRec = (pMonStatsTxt + 10 * 0x1a8) >>> 0
      m.setU32(pAiTick, pAiCtrl)
      m.setU32((pAiTick + 0x1c) >>> 0, pMonStatsRec)
      m.setU16((pMonStatsRec + 0x170) >>> 0, 5) // wSkill[0] = 5
      m.setU16((pMonStatsRec + 2 * 2 + 0x170) >>> 0, 271)
      m.setU32((pSkillsTxt + 5 * 0x23c + 0x14c) >>> 0, 35)

      const { pUnit: pBoss, pUnitData: pBossData } = allocDynamicUnit(m, 1, 10, 10)
      const { pUnit: pMinion, pUnitData: pMinionData } = allocDynamicUnit(m, 1, 11, 11)
      const pAiGen = m.alloc(0x50) >>> 0
      m.setU32((pBossData + 0x28) >>> 0, pAiGen)
      m.setU32((pAiGen + 0x3c) >>> 0, 0xfeedface)
      m.setU32((pBossData + 0x58) >>> 0, 0) // Act 0
      m.setU16((pMonStatsTxt + 10 * 0x1a8 + 0x26) >>> 0, 14) // wMinion[0]

      // Attach skill 271 to pBoss for Shadow Master init
      const pSkillList = m.alloc(0x20) >>> 0
      const pSkillNode = m.alloc(0x40) >>> 0
      const pSkillTxt271 = m.alloc(0x23c) >>> 0
      m.set(pSkillTxt271, D2SkillsTxt.wSkillId, 271)
      m.set(pSkillNode, D2SkillStrc.pSkillsTxt, pSkillTxt271)
      m.set(pSkillNode, D2SkillStrc.nOwnerItemGuid, 0xffffffff)
      m.set(pSkillList, D2SkillListStrc.pFirstSkill, pSkillNode)
      m.set(pBoss, D2UnitStrc.pSkills, pSkillList)

      // MonReg[0] for Baal spawn selector & unique count
      const pMonReg0 = m.alloc(0x300) >>> 0
      m.setU32((pGame + 0xf0) >>> 0, pMonReg0)
      m.setU8((pMonReg0 + 0x10) >>> 0, 2)
      m.setU16((pMonReg0 + 0x14) >>> 0, 310)
      m.setU16((pMonReg0 + 0x34 + 0x14) >>> 0, 310)
      m.setU8((pMonStatsTxt + 310 * 0x1a8 + 0x0e) >>> 0, 0x20) // bit 0x15

      // MonUModTxt row 9
      m.setU32((pMonUModTxt + 9 * 0x20 + 0x1c) >>> 0, 275)
      m.setU8((pMonUModTxt + 9 * 0x20 + 0x07) >>> 0, 1)

      // Objects setup
      const pObj = m.alloc(0x100) >>> 0
      const pObjData = m.alloc(0x40) >>> 0
      const pField7C = m.alloc(0x10) >>> 0
      const pObjCtrl = m.alloc(0x20) >>> 0
      m.setU32(pObjCtrl, 0x11112222)
      m.setU32((pObjCtrl + 4) >>> 0, 666)
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x04) >>> 0, 12)
      m.setU32((pObj + 0x0c) >>> 0, 0x11223344)
      m.setU32((pObj + 0x14) >>> 0, pObjData)
      m.set(pObj, D2UnitStrc.dwField7C, pField7C)
      const pObjTxt12 = (pObjectsTxt + 12 * 0x1c0) >>> 0
      m.setU8((pObjTxt12 + 0x180) >>> 0, 3)
      m.setU32((pObjTxt12 + 0x17c) >>> 0, 45)
      const pInitParam = m.alloc(0x24) >>> 0
      m.setU32((pInitParam + 0x04) >>> 0, pObj)
      m.setU32((pInitParam + 0x0c) >>> 0, pObjCtrl)
      m.setU32((pInitParam + 0x10) >>> 0, pObjTxt12)

      // Player, Client, Quest & Hostile setup
      const { pUnit: pPlr, pPath: pPlrPath, pUnitData: pPD } = allocDynamicUnit(m, 0, 0, 77)
      const { pUnit: pRival } = allocDynamicUnit(m, 0, 1, 42)
      const pClient = m.alloc(0x520) >>> 0
      m.setU32((pPD + 0x9c) >>> 0, pClient)
      const pAct1Room = allocRoomWithLevel(m, 40)
      m.set(pPlrPath, D2DynamicPathStrc.pRoom, pAct1Room)

      const pQuestRecord = m.alloc(0x10) >>> 0
      const pQuestBits = m.alloc(0x60) >>> 0
      m.setU32(pQuestRecord, pQuestBits)
      m.setU8((pQuestBits + 6) >>> 0, 0x03) // quest 3 bits 0 & 1 set
      m.setU32((pPD + 1 * 4 + 0x10) >>> 0, pQuestRecord)

      const pQuestData = m.alloc(0x100) >>> 0
      m.setU32((pQuestData + 0x04) >>> 0, pGame)
      m.setU32((pQuestData + 0xe0) >>> 0, 3)
      m.setU16((pQuestData + 0x9c) >>> 0, 1)
      m.setU32((pQuestData + 0x1c) >>> 0, 77)
      const pQuestArg = m.alloc(0x20) >>> 0
      m.setU32((pQuestArg + 0x0c) >>> 0, pPlr)

      const pRel = m.alloc(0x18) >>> 0
      m.setU32(pRel, 42)
      m.setU32((pRel + 0x04) >>> 0, 0x08)
      m.setU32((pPD + 0x38) >>> 0, pRel)
      const pHostileCtx = m.alloc(8) >>> 0
      m.setU32((pHostileCtx + 0x04) >>> 0, pPlr)

      const pOutDead = m.alloc(4) >>> 0
      const pOutSpawnId = m.alloc(4) >>> 0
      const pOutClient = m.alloc(4) >>> 0
      m.set(pMinion, D2UnitStrc.dwAnimMode, 12) // dead

      beginVaTrace113c()
      expect(ITEMS_ScaleStatByPercentWithMin113c(m, 100, 5, 75)).toBe(75)
      expect(ITEMS_FindSuperiorQualityRecordIndex113c(m, pItem, 1)).toBe(1)

      AI_InitMonsterClearAiParam3_113c(m, pGame, pBoss, pAiTick)
      expect(m.u32((pAiCtrl + 0x1c) >>> 0)).toBe(0)
      AI_InitMonsterResetAiStateNeg1_113c(m, pGame, pBoss, pAiTick)
      expect(m.u32((pAiCtrl + 0x14) >>> 0)).toBe(0xffffffff)
      AI_InitBaalMinionSpawnState113c(m, pGame, pBoss, pAiTick)
      expect(m.u32((pAiCtrl + 0x14) >>> 0)).toBe(500)
      expect(m.u32((pAiCtrl + 0x3c) >>> 0)).toBe(0xffffffff)
      AI_CheckAnyMinionDeadCallback113c(m, pMinion, pOutDead)
      expect(m.u32(pOutDead)).toBe(1)
      AI_InitShadowMasterSkillSlot113c(m, pGame, pBoss, pAiTick)
      expect(m.u32((pAiCtrl + 0x18) >>> 0)).toBe(2)
      AI_InitMonsterSkillDelayFrame113c(m, pGame, pBoss, pAiTick)
      expect(m.u32((pAiCtrl + 0x14) >>> 0)).toBe(535)
      expect(AI_SelectBaalThroneSpawnClassId113c(m, pBoss, pGame, pOutSpawnId)).toBe(1)
      expect(m.u32(pOutSpawnId)).toBe(310)

      expect(AIGENERAL_GetField3C_113c(m, pBoss)).toBe(0xfeedface)
      expect(AIGENERAL_GetQuestDataPtr38_113c(m, pBoss)).toBe((pAiGen + 0x38) >>> 0)

      const pUModList = MONUMOD_GetUModListPtr113c(m, pBoss)
      expect(pUModList).toBe((pBossData + 0x1c) >>> 0)
      MONUMOD_AppendUModToMonster113c(m, pBoss, 9)
      expect(MONUMOD_CountUnitUMods113c(m, pUModList)).toBe(1)
      expect(MONUMOD_GetMinionClassIdForBoss113c(m, pBoss)).toBe(14)
      expect(MONUMOD_GetConstantValue113c(m, 9)).toBe(275)
      MONUMOD_SetSuperUniqueId113c(m, pBoss, 0x12)
      expect(m.u16((pBossData + 0x26) >>> 0)).toBe(0x12)
      MONUMOD_RollBossOrMinionNameSeed113c(m, pBoss, 1, 1)
      expect(m.u16((pBossData + 0x14) >>> 0)).toBe(m.u32((pBoss + 0x20) >>> 0) & 0xffff)
      MONUMOD_CopyMinionEligibleUMods113c(m, pBoss, pMinion, 0)
      expect(m.u8((pMinionData + 0x1c) >>> 0)).toBe(9)
      MONUMOD_MarkBossAndIncrementUniqueCount113c(m, pBoss, pGame)
      expect(m.u32((pMonReg0 + 0x2c8) >>> 0)).toBe(1)
      expect(m.u8((pBossData + 0x16) >>> 0) & 0x08).toBe(0x08)

      const ev2Calls: number[] = []
      MONSTER_Event7_MonUModEvent2_113c(m, pGame, pBoss, 0, 0, {
        onMonUModMatrixCallback: (_mem, pfn) => ev2Calls.push(pfn),
      })
      expect(ev2Calls).toEqual([0x6fc466b0])

      CLIENTS_CaptureFirstInGameClientCallback113c(m, pClient, pOutClient)
      expect(m.u32(pOutClient)).toBe(pClient)
      GAME_SetGlobalSeed113c(m, 0xdeadbeef)
      expect(m.u32(D2GAME_GLOBAL_SEED_OVERRIDE_VA_113C)).toBe(0xdeadbeef)

      OBJECTS_SetUnitField7CDword4_113c(m, pObj, 0x99)
      expect(m.u32((pField7C + 0x04) >>> 0)).toBe(0x99)
      expect(OBJECTS_LevelHookAlwaysTrue113c(m, pGame, pAct1Room, 0)).toBe(1)
      OBJECTS_InitFn05_NoOp113c(m, pInitParam)
      OBJECTS_InitFn16_DoubleActToSubType113c(m, pInitParam)
      expect(m.u8((pObjData + 0x04) >>> 0)).toBe(6)
      OBJECTS_SubstituteObjectClassIdFromParm0_113c(m, pObj)
      expect(m.u32((pObj + 0x04) >>> 0)).toBe(45)
      OBJECTS_InitFn27_RollSubType3_113c(m, pInitParam)
      expect([0, 3]).toContain(m.u8((pObjData + 0x04) >>> 0))

      QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuestData, pQuestArg)
      expect(m.u16((pQuestData + 0x9c) >>> 0)).toBe(0)
      QUESTS_SendQuestStateAlert5D_113c(m, pPlr, 0x24, 1)
      QUESTS_SendNpcMessagePacket27_113c(m, pPlr, pObj, 0x4ec9)
      expect(m.u32((pClient + 0x1b8) >>> 0)).not.toBe(0)

      expect(PLAYER_SetClientSkillHotkeySlot113c(m, pPlr, 3, 54, 1, 0x12345678)).toBe(1)
      expect(m.u16((pClient + 3 * 8 + 0x3dc) >>> 0)).toBe(54)
      PLAYER_CheckHostilePlayerCallback113c(m, pGame, pRival, pHostileCtx)
      expect(m.u32(pHostileCtx)).toBe(1)

      const shard2Hits = endVaTrace113c()
      expect(shard2Hits.has('D2Game:0x6FC468E0')).toBe(true)
      for (const v of shard2Hits) cumulativeHits.add(v)
    }

    const missingVas = WAVE11_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })

  it('guards assert branches on CLIENTS accessors (0x6FC69240..0x6FC6B3C0)', () => {
    const { m } = createWave11World()
    expect(() => CLIENTS_GetSaveHeaderPtr_6FC69240_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_SetClientFlag20_6FC69580_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_FreeSaveDataBuffer_6FC69630_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_StoreSaveDataBuffer_6FC696B0_113c(m, 0, 4, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_GetSaveDataSize_6FC69760_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_GetSaveDataPtr_6FC69790_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_GetClientNamePtr_6FC69A20_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_GetClientField488_6FC69AB0_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_SetClientInitState_6FC69B70_113c(m, 0, 1)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_GetClientByte08_6FC69BF0_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_SetClientActNo_6FC69D70_113c(m, 0, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_FindClientByIdInGame_6FC69FE0_113c(m, 0, 1)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c(m, 0, 0)).toThrow(D2CommonAssertError)
  })
})
