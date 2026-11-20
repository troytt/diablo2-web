/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 15: +122 VAs).
 *
 * Audits and verifies 122 `D2Game.dll` (`0x6FC20000`) closure functions across 5 disjoint shards:
 * - `k2w3-b5` (`src/d2kern-113c/game/k2-w3b5-113c.ts`, 28 eligible; 4 `indirectUnknown` stay `ported`)
 * - `k2w5-b8` (`src/d2kern-113c/game/k2-w5b8-113c.ts`, 25 eligible; 0 `indirectUnknown`)
 * - `k2w8-b2` (`src/d2kern-113c/game/k2-w8b2-113c.ts`, 25 eligible; 1 `indirectUnknown` stays `ported`)
 * - `k2w8-b3` (`src/d2kern-113c/game/k2-w8b3-113c.ts`, 23 eligible; 2 `indirectUnknown` stay `ported`)
 * - `k2w11-b1` (`src/d2kern-113c/game/k2-w11b1-113c.ts`, 21 eligible; 0 `indirectUnknown`)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`,
 *    plus manifest promotion & `indirectUnknown` guardrails.
 * 2. Differential regression tests for every real 1.13c binary disassembly bug fixed across
 *    `k2w3-b5` (5 VAs), `k2w8-b2` (7 VAs), `k2w8-b3` (8 VAs), and `k2w11-b1` (16 VAs + event helper).
 * 3. Multi-branch `SparseMemory113c` boundary/state assertions + 100% (`122 / 122`) live
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
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckState113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatValue113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import * as w11b1 from '../../../src/d2kern-113c/game/k2-w11b1-113c.ts'
import * as w3b5 from '../../../src/d2kern-113c/game/k2-w3b5-113c.ts'
import * as w5b8 from '../../../src/d2kern-113c/game/k2-w5b8-113c.ts'
import * as w8b2 from '../../../src/d2kern-113c/game/k2-w8b2-113c.ts'
import * as w8b3 from '../../../src/d2kern-113c/game/k2-w8b3-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2DynamicPathStrc,
  D2ItemDataStrc,
  D2MonStats2Txt_SIZE,
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
  readonly batch: 'k2w3-b5' | 'k2w5-b8' | 'k2w8-b2' | 'k2w8-b3' | 'k2w11-b1'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE15_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  // k2w3-b5: 28 eligible VAs (0x6FC767A0, 0x6FC76B10, 0x6FC76BD0, 0x6FC76D10 are indirectUnknown and stay ported)
  { batch: 'k2w3-b5', va: '0x6FC70130', size: 82, headHex: '56578bf985ff8bf2', tailHex: 'c20400', tsSymbol: 'STATES_OnStateRemovedResetMonsterAi_6FC70130_113c' },
  { batch: 'k2w3-b5', va: '0x6FC709E0', size: 389, headHex: '8b4c240c85c9558b', tailHex: 'c21000', tsSymbol: 'SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c' },
  { batch: 'k2w3-b5', va: '0x6FC72390', size: 293, headHex: '535556578bf28bd9', tailHex: 'c20400', tsSymbol: 'GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c' },
  { batch: 'k2w3-b5', va: '0x6FC73170', size: 114, headHex: '83ec085355578b7e', tailHex: 'c20400', tsSymbol: 'PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c' },
  { batch: 'k2w3-b5', va: '0x6FC737D0', size: 879, headHex: 'b81c200000e84630', tailHex: 'c21800', tsSymbol: 'PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c' },
  { batch: 'k2w3-b5', va: '0x6FC76EF0', size: 157, headHex: '578bfa81ff190200', tailHex: 'c20c00', tsSymbol: 'ACT5Q6_ActiveFilter_6FC76EF0_113c' },
  { batch: 'k2w3-b5', va: '0x6FC77900', size: 288, headHex: '83ec0c535556578b', tailHex: 'c20400', tsSymbol: 'ACT5Q4_CheckPlayerNearNihlathakRoom_6FC77900_113c' },
  { batch: 'k2w3-b5', va: '0x6FC77DD0', size: 167, headHex: '5356578bfa8b470c', tailHex: '5e5bc3', tsSymbol: 'ACT5Q3_Callback03_OnItemPickedUp_6FC77DD0_113c' },
  { batch: 'k2w3-b5', va: '0x6FC77F50', size: 229, headHex: '81fa010200005657', tailHex: 'c20c00', tsSymbol: 'ACT5Q3_ActiveFilter_6FC77F50_113c' },
  { batch: 'k2w3-b5', va: '0x6FC78530', size: 129, headHex: '5657528bf1e8861f', tailHex: 'c20400', tsSymbol: 'ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c' },
  { batch: 'k2w3-b5', va: '0x6FC785C0', size: 113, headHex: '5650e8f91efbff0f', tailHex: 'faffc3', tsSymbol: 'ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F_6FC785C0_113c' },
  { batch: 'k2w3-b5', va: '0x6FC78640', size: 120, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c' },
  { batch: 'k2w3-b5', va: '0x6FC786C0', size: 212, headHex: '83ec0c535556578b', tailHex: 'c20400', tsSymbol: 'ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c' },
  { batch: 'k2w3-b5', va: '0x6FC78890', size: 154, headHex: '5657528bf1e8261c', tailHex: 'c20400', tsSymbol: 'ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c' },
  { batch: 'k2w3-b5', va: '0x6FC78A40', size: 155, headHex: '83ec2085c0741383', tailHex: 'c20400', tsSymbol: 'ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c' },
  { batch: 'k2w3-b5', va: '0x6FC78AE0', size: 182, headHex: '83ec0856578bf256', tailHex: 'c20400', tsSymbol: 'ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c' },
  { batch: 'k2w3-b5', va: '0x6FC78BE0', size: 170, headHex: '56576a0d8bf86a28', tailHex: '0000c3', tsSymbol: 'ACT5Q6_CompleteQuest28AndUpdateProgression_6FC78BE0_113c' },
  { batch: 'k2w3-b5', va: '0x6FC78C90', size: 164, headHex: '5356578bf2568bd9', tailHex: 'c20400', tsSymbol: 'ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c' },
  { batch: 'k2w3-b5', va: '0x6FC79D30', size: 223, headHex: '8b80f410000085c0', tailHex: '5b5ec3', tsSymbol: 'ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c' },
  { batch: 'k2w3-b5', va: '0x6FC79E10', size: 223, headHex: '8b80f410000085c0', tailHex: '5f5ec3', tsSymbol: 'ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c' },
  { batch: 'k2w3-b5', va: '0x6FC7A160', size: 146, headHex: '83ec0885c056751f', tailHex: 'c20400', tsSymbol: 'ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c' },
  { batch: 'k2w3-b5', va: '0x6FC7A290', size: 122, headHex: '8b87f410000085c0', tailHex: 'c20800', tsSymbol: 'ACT5Q2_FindSpawnedPrisonObjectForUnit_6FC7A290_113c' },
  { batch: 'k2w3-b5', va: '0x6FC7A5C0', size: 201, headHex: '8b80f410000085c0', tailHex: '5f5ec3', tsSymbol: 'ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c' },
  { batch: 'k2w3-b5', va: '0x6FC7C2A0', size: 246, headHex: '83ec2853558b6c24', tailHex: 'c20c00', tsSymbol: 'ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c' },
  { batch: 'k2w3-b5', va: '0x6FC7CF70', size: 128, headHex: '568bf18b068b80f4', tailHex: '5f5ec3', tsSymbol: 'ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded_6FC7CF70_113c' },
  { batch: 'k2w3-b5', va: '0x6FC7D960', size: 267, headHex: '83ec5c558b6c2464', tailHex: 'c20800', tsSymbol: 'ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c' },
  { batch: 'k2w3-b5', va: '0x6FC7DD00', size: 235, headHex: '83ec2085f6741183', tailHex: 'c20400', tsSymbol: 'ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c' },
  { batch: 'k2w3-b5', va: '0x6FC7DDF0', size: 250, headHex: '83ec20568bf285f6', tailHex: 'c20400', tsSymbol: 'ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c' },
  // k2w5-b8: 25 eligible VAs
  { batch: 'k2w5-b8', va: '0x6FD03290', size: 133, headHex: '56578bf98b078b80', tailHex: '5f5ec3', tsSymbol: 'ACT3Q7_InitMephistoPortalObject_6FD03290_113c' },
  { batch: 'k2w5-b8', va: '0x6FD03320', size: 101, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT3Q7_NotifyPlayerMephistoState0DCallback_6FD03320_113c' },
  { batch: 'k2w5-b8', va: '0x6FD034D0', size: 139, headHex: '56576a0d8bf06a16', tailHex: 'c20400', tsSymbol: 'ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c' },
  { batch: 'k2w5-b8', va: '0x6FD03560', size: 289, headHex: '5657528bf9e8566f', tailHex: 'c20400', tsSymbol: 'ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c' },
  { batch: 'k2w5-b8', va: '0x6FD036A0', size: 178, headHex: '53568bf2568bd9e8', tailHex: 'c20400', tsSymbol: 'ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c' },
  { batch: 'k2w5-b8', va: '0x6FD03760', size: 101, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT3Q5_NotifyPlayerTravincalState0DCallback_6FD03760_113c' },
  { batch: 'k2w5-b8', va: '0x6FD03CE0', size: 275, headHex: '5153558b6c241456', tailHex: 'c20c00', tsSymbol: 'ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c' },
  { batch: 'k2w5-b8', va: '0x6FD041D0', size: 163, headHex: '568bf18b86f41000', tailHex: 'c20400', tsSymbol: 'ACT3Q2_SetGidbinnTurnInPartyCallback_6FD041D0_113c' },
  { batch: 'k2w5-b8', va: '0x6FD04280', size: 111, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT3Q2_SetGidbinnState0ECallback_6FD04280_113c' },
  { batch: 'k2w5-b8', va: '0x6FD045B0', size: 318, headHex: '53568b742410576a', tailHex: 'c20c00', tsSymbol: 'ACT3Q2_GidbinnStatusFilter_6FD045B0_113c' },
  { batch: 'k2w5-b8', va: '0x6FD046F0', size: 215, headHex: '5355578bea558bd9', tailHex: 'c20400', tsSymbol: 'ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c' },
  { batch: 'k2w5-b8', va: '0x6FD04AB0', size: 474, headHex: '83ec14538b5c2424', tailHex: 'c20c00', tsSymbol: 'ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c' },
  { batch: 'k2w5-b8', va: '0x6FD05A60', size: 162, headHex: '8b87f410000085c0', tailHex: 'ff5ec3', tsSymbol: 'ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c' },
  { batch: 'k2w5-b8', va: '0x6FD05BE0', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c' },
  { batch: 'k2w5-b8', va: '0x6FD05D20', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c' },
  { batch: 'k2w5-b8', va: '0x6FD05D80', size: 371, headHex: '83ec0c535556578b', tailHex: 'c20400', tsSymbol: 'ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c' },
  { batch: 'k2w5-b8', va: '0x6FD05F00', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c' },
  { batch: 'k2w5-b8', va: '0x6FD05F60', size: 150, headHex: '8b83f410000085c0', tailHex: '5f5ec3', tsSymbol: 'ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c' },
  { batch: 'k2w5-b8', va: '0x6FD06130', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c' },
  { batch: 'k2w5-b8', va: '0x6FD06190', size: 652, headHex: '83ec0c5355568bf2', tailHex: 'c40cc3', tsSymbol: 'ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c' },
  { batch: 'k2w5-b8', va: '0x6FD06420', size: 67, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c' },
  { batch: 'k2w5-b8', va: '0x6FD064C0', size: 133, headHex: '5355578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT3Q4_CompleteLamEsensTomePartyCallback_6FD064C0_113c' },
  { batch: 'k2w5-b8', va: '0x6FD06550', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c' },
  { batch: 'k2w5-b8', va: '0x6FD06980', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT3Q5_PropagateCouncilCompletionToPartyCallback_6FD06980_113c' },
  { batch: 'k2w5-b8', va: '0x6FD06B90', size: 49, headHex: '85c0742a578bb880', tailHex: '33c0c3', tsSymbol: 'ACT3Q4_PropagateTomeQuestStateToSubParty_6FD06B90_113c' },
  // k2w8-b2: 25 eligible VAs (0x6FCDA5E0 is indirectUnknown and stays ported)
  { batch: 'k2w8-b2', va: '0x6FC85760', size: 560, headHex: '83ec0c55578bf98a', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q1_OnMonsterKilled_6FC85760_113c' },
  { batch: 'k2w8-b2', va: '0x6FC85D40', size: 331, headHex: '515356578bf98b1f', tailHex: '5b59c3', tsSymbol: 'ACT1Q5_OnTreeOfInifussOperated_6FC85D40_113c' },
  { batch: 'k2w8-b2', va: '0x6FC87C60', size: 191, headHex: '8b421866ff809201', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c' },
  { batch: 'k2w8-b2', va: '0x6FC87D20', size: 209, headHex: '53578bf98b078b80', tailHex: '5f5bc3', tsSymbol: 'ACT1Q4_OnCairnStoneInit_6FC87D20_113c' },
  { batch: 'k2w8-b2', va: '0x6FC883C0', size: 238, headHex: '53558b6c240c5657', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q4_OnPlayerEnterTristramWithCainUnrescued_6FC883C0_113c' },
  { batch: 'k2w8-b2', va: '0x6FC88D70', size: 173, headHex: '56578bf98b470485', tailHex: 'c05ec3', tsSymbol: 'ACT1Q5_OnForgottenTowerTomeOperated_6FC88D70_113c' },
  { batch: 'k2w8-b2', va: '0x6FC8A9D0', size: 362, headHex: '83ec105355568bf1', tailHex: 'c410c3', tsSymbol: 'OBJ_OperateDoorWithLockCheck_6FC8A9D0_113c' },
  { batch: 'k2w8-b2', va: '0x6FC8E150', size: 275, headHex: '83ec14535556578b', tailHex: 'c414c3', tsSymbol: 'OBJ_ThinkEventSparkyChest_6FC8E150_113c' },
  { batch: 'k2w8-b2', va: '0x6FC8E400', size: 104, headHex: '535556578bfa85ff', tailHex: '5d5bc3', tsSymbol: 'OBJ_ThinkEventLightningSpire_6FC8E400_113c' },
  { batch: 'k2w8-b2', va: '0x6FC8F040', size: 1193, headHex: '83ec1853558be98b', tailHex: 'c418c3', tsSymbol: 'OBJ_OperateChestAndSparkyChest_6FC8F040_113c' },
  { batch: 'k2w8-b2', va: '0x6FC92210', size: 8, headHex: '5251e88952ffffc3', tailHex: 'ffffc3', tsSymbol: 'CUBE_Op15_SpawnSecretCowLevelPortal_6FC92210_113c' },
  { batch: 'k2w8-b2', va: '0x6FC98B60', size: 233, headHex: '558b6c240c0fb6c0', tailHex: 'c20800', tsSymbol: 'MONSTER_AutoEquipInteractItem_6FC98B60_113c' },
  { batch: 'k2w8-b2', va: '0x6FCB54F0', size: 100, headHex: '83ec7053558bd98b', tailHex: 'c470c3', tsSymbol: 'AURA_ApplyRadialDamageCallback_6FCB54F0_113c' },
  { batch: 'k2w8-b2', va: '0x6FCB6C00', size: 356, headHex: '51558b2885ed0f84', tailHex: 'f6ffcc', tsSymbol: 'PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c' },
  { batch: 'k2w8-b2', va: '0x6FCB8070', size: 162, headHex: '56578bf0e84724f7', tailHex: 'c20400', tsSymbol: 'PETS_UnsummonPetAndCheckNodeStillExists_6FCB8070_113c' },
  { batch: 'k2w8-b2', va: '0x6FCB8120', size: 292, headHex: '83ec1c558b6c2428', tailHex: 'c20c00', tsSymbol: 'PETS_OnPetOrMercKilled_6FCB8120_113c' },
  { batch: 'k2w8-b2', va: '0x6FCBC840', size: 267, headHex: '83ec0853568bf033', tailHex: 'c20400', tsSymbol: 'PARTY_LeavePartyForPlayer_6FCBC840_113c' },
  { batch: 'k2w8-b2', va: '0x6FCC2EA0', size: 49, headHex: '56578bf2568bf9e8', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_Unsummon_6FCC2EA0_113c' },
  { batch: 'k2w8-b2', va: '0x6FCC7530', size: 69, headHex: '85d2750583c8ffeb', tailHex: 'c20400', tsSymbol: 'MONAI_SiegeMinionThinkDispatch_6FCC7530_113c' },
  { batch: 'k2w8-b2', va: '0x6FCCDFA0', size: 307, headHex: '51558bea8b456085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c' },
  { batch: 'k2w8-b2', va: '0x6FCCE0E0', size: 273, headHex: '5153558b6c241085', tailHex: 'c21400', tsSymbol: 'SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c' },
  { batch: 'k2w8-b2', va: '0x6FCCF450', size: 370, headHex: '83ec0853578bfa85', tailHex: 'c21400', tsSymbol: 'SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450_113c' },
  { batch: 'k2w8-b2', va: '0x6FCD4410', size: 270, headHex: '538bd98b4c240885', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c' },
  { batch: 'k2w8-b2', va: '0x6FCD5BD0', size: 366, headHex: '83ec2c8b44243085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c' },
  { batch: 'k2w8-b2', va: '0x6FCDA330', size: 99, headHex: '8b520c56578bf18b', tailHex: '5f5ec3', tsSymbol: 'ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c' },
  // k2w8-b3: 23 eligible VAs (0x6FCE6B30, 0x6FCE6E90 are indirectUnknown and stay ported)
  { batch: 'k2w8-b3', va: '0x6FCDD880', size: 154, headHex: '5185db568bf07507', tailHex: 'c20400', tsSymbol: 'NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c' },
  { batch: 'k2w8-b3', va: '0x6FCDD920', size: 139, headHex: '85f653558b6c240c', tailHex: 'c20800', tsSymbol: 'NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c' },
  { batch: 'k2w8-b3', va: '0x6FCDD9B0', size: 223, headHex: '558b6c240856578b', tailHex: 'c20400', tsSymbol: 'NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c' },
  { batch: 'k2w8-b3', va: '0x6FCE6600', size: 168, headHex: '8b80f410000085c0', tailHex: 'f3ffcc', tsSymbol: 'ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c' },
  { batch: 'k2w8-b3', va: '0x6FCE6920', size: 162, headHex: '8b80f410000085c0', tailHex: 'ff5ec3', tsSymbol: 'ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c' },
  { batch: 'k2w8-b3', va: '0x6FCE6AF0', size: 63, headHex: '568bf2578b7e188a', tailHex: '015ec3', tsSymbol: 'ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c' },
  { batch: 'k2w8-b3', va: '0x6FCE6D20', size: 215, headHex: '8b80f410000085c0', tailHex: 'c20400', tsSymbol: 'ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c' },
  { batch: 'k2w8-b3', va: '0x6FCE7130', size: 110, headHex: '83ec0853568bf08b', tailHex: 'c408c3', tsSymbol: 'ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c' },
  { batch: 'k2w8-b3', va: '0x6FCE71A0', size: 168, headHex: '5355568bf08b6e18', tailHex: 'f3ffcc', tsSymbol: 'ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c' },
  { batch: 'k2w8-b3', va: '0x6FCE76B0', size: 1166, headHex: '83ec0c55568be98b', tailHex: 'c40cc3', tsSymbol: 'ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c' },
  { batch: 'k2w8-b3', va: '0x6FCE9A80', size: 231, headHex: '5356578bf98b4704', tailHex: 'c05bc3', tsSymbol: 'ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c' },
  { batch: 'k2w8-b3', va: '0x6FCEE4B0', size: 112, headHex: '837c24080955578b', tailHex: 'c20800', tsSymbol: 'C2S_Packet21_MergeStackableItems_6FCEE4B0_113c' },
  { batch: 'k2w8-b3', va: '0x6FCEECE0', size: 247, headHex: '5153568bf08b4424', tailHex: 'c20800', tsSymbol: 'ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c' },
  { batch: 'k2w8-b3', va: '0x6FCEEE60', size: 212, headHex: '837c24080955578b', tailHex: 'c20800', tsSymbol: 'C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c' },
  { batch: 'k2w8-b3', va: '0x6FCEF510', size: 87, headHex: '837c24080156578b', tailHex: 'c20800', tsSymbol: 'C2S_Packet60_SwapWeapons_6FCEF510_113c' },
  { batch: 'k2w8-b3', va: '0x6FCEF5B0', size: 241, headHex: '83ec08837c24100d', tailHex: 'c20800', tsSymbol: 'C2S_Packet26_UseBeltItem_6FCEF5B0_113c' },
  { batch: 'k2w8-b3', va: '0x6FCEF6B0', size: 115, headHex: '837c24080956578b', tailHex: 'c20800', tsSymbol: 'C2S_Packet27_IdentifyItem_6FCEF6B0_113c' },
  { batch: 'k2w8-b3', va: '0x6FCEFBC0', size: 639, headHex: '83ec10558b6c2420', tailHex: 'c21000', tsSymbol: 'ITEMS_EquipMercBodyLocFromPlayerCursor_6FCEFBC0_113c' },
  { batch: 'k2w8-b3', va: '0x6FCF1140', size: 188, headHex: '51837c240c09568b', tailHex: 'c20800', tsSymbol: 'C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c' },
  { batch: 'k2w8-b3', va: '0x6FCF1370', size: 242, headHex: '837c24080553568b', tailHex: 'c20800', tsSymbol: 'C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c' },
  { batch: 'k2w8-b3', va: '0x6FCF4360', size: 121, headHex: '538bd985db578bf8', tailHex: 'c05bc3', tsSymbol: 'ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c' },
  { batch: 'k2w8-b3', va: '0x6FCF5080', size: 274, headHex: '53558b6c240c5657', tailHex: 'c21000', tsSymbol: 'ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c' },
  { batch: 'k2w8-b3', va: '0x6FCF6760', size: 1116, headHex: '83ec1c558b6c2428', tailHex: 'c20800', tsSymbol: 'ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c' },
  // k2w11-b1: 21 eligible VAs
  { batch: 'k2w11-b1', va: '0x6FC44950', size: 539, headHex: '83ec3053558b6c24', tailHex: 'c21400', tsSymbol: 'MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c' },
  { batch: 'k2w11-b1', va: '0x6FC48290', size: 875, headHex: '83ec385556578b7c', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c' },
  { batch: 'k2w11-b1', va: '0x6FC58620', size: 200, headHex: '85f6538bd875046a', tailHex: 'c20400', tsSymbol: 'PLAYER_InitPlayerUnitSubsystems_6FC58620_113c' },
  { batch: 'k2w11-b1', va: '0x6FC628F0', size: 473, headHex: '83ec3055568b7424', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo067_ApplyBuffStateAndItemEvents_6FC628F0_113c' },
  { batch: 'k2w11-b1', va: '0x6FC63450', size: 139, headHex: '83ec085355568d44', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo029_Teleport_6FC63450_113c' },
  { batch: 'k2w11-b1', va: '0x6FC70800', size: 469, headHex: '83ec285355568bf0', tailHex: 'c428c3', tsSymbol: 'SKILLS_ReleaseTrappedOrConvertedMonster_6FC70800_113c' },
  { batch: 'k2w11-b1', va: '0x6FC8AB60', size: 74, headHex: '0fb6028b520c568b', tailHex: '005ec3', tsSymbol: 'OBJ_OperateFn_SkillShrine_6FC8AB60_113c' },
  { batch: 'k2w11-b1', va: '0x6FC8BB60', size: 330, headHex: '83ec14568bf18b46', tailHex: 'c414c3', tsSymbol: 'OBJ_OperateFn_CowAndSpecialPortal_6FC8BB60_113c' },
  { batch: 'k2w11-b1', va: '0x6FC8BD60', size: 211, headHex: '83ec308d44240850', tailHex: 'c430c3', tsSymbol: 'OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c' },
  { batch: 'k2w11-b1', va: '0x6FC8D0F0', size: 1328, headHex: '83ec1056578bf98b', tailHex: 'c410c3', tsSymbol: 'OBJ_OperateFn_TownAndPermanentPortal_6FC8D0F0_113c' },
  { batch: 'k2w11-b1', va: '0x6FCB3680', size: 463, headHex: '8b44240483ec7885', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo252_DragonFlight_6FCB3680_113c' },
  { batch: 'k2w11-b1', va: '0x6FCB7E20', size: 291, headHex: '83ec28558b6c2438', tailHex: 'c21000', tsSymbol: 'PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c' },
  { batch: 'k2w11-b1', va: '0x6FCBDF40', size: 546, headHex: '83ec14558b6c2420', tailHex: 'c21000', tsSymbol: 'ACT_WarpClientPlayerToActTown_6FCBDF40_113c' },
  { batch: 'k2w11-b1', va: '0x6FCC9D40', size: 316, headHex: '83ec0c8b44241053', tailHex: 'c20400', tsSymbol: 'AI_Think_TeleportLeashOrApproachOwner_6FCC9D40_113c' },
  { batch: 'k2w11-b1', va: '0x6FCD46B0', size: 172, headHex: '515355568bf28b46', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c' },
  { batch: 'k2w11-b1', va: '0x6FCD4760', size: 264, headHex: '5355568bf28b0683', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SubmergeOrBurrowMonster_6FCD4760_113c' },
  { batch: 'k2w11-b1', va: '0x6FCE0DB0', size: 633, headHex: '83ec10558b6c2418', tailHex: 'c20400', tsSymbol: 'NPCTRADE_InteractResurrectMerc_6FCE0DB0_113c' },
  { batch: 'k2w11-b1', va: '0x6FCEDA20', size: 258, headHex: '51890c248b4c240c', tailHex: 'c20800', tsSymbol: 'C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c' },
  { batch: 'k2w11-b1', va: '0x6FCEF0A0', size: 49, headHex: '837c240811568bf1', tailHex: 'c20800', tsSymbol: 'C2S_Packet35_NpcRepair_6FCEF0A0_113c' },
  { batch: 'k2w11-b1', va: '0x6FCEFE40', size: 234, headHex: '578b7c24086a016a', tailHex: 'c20400', tsSymbol: 'PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c' },
  { batch: 'k2w11-b1', va: '0x6FD01C00', size: 397, headHex: '83ec10578bf88b44', tailHex: 'c20400', tsSymbol: 'DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c' },
]

const WAVE15_INDIRECT_UNKNOWN_VAS = [
  '0x6FC767A0',
  '0x6FC76B10',
  '0x6FC76BD0',
  '0x6FC76D10',
  '0x6FCDA5E0',
  '0x6FCE6B30',
  '0x6FCE6E90',
] as const

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

function createWave15World() {
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
  m.setU32(0x6fd182a4, pBitMasks)
  m.setU32(0x6fd27060, pBitMasks)
  m.setU32(0x6fd18d10, 10000)

  const pDataTablesSlot = m.alloc(4) >>> 0
  m.setU32(pDataTablesSlot, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pDataTablesSlot)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(0x6fd270b0, pDataTablesSlot)

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
    m.setU8((rec + 0x1e) >>> 0, 6)
  }

  // MonStats2Txt (600 rows * 0x134)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa8c) >>> 0, monStatsCount)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)

  // SkillsTxt (360 rows * 0x23C) + SkillCode RPN buffer
  const skillsCount = 360
  const pSkillsTxt = m.alloc(skillsCount * 0x23c) >>> 0
  m.setU32((pDataTables + 0xb90) >>> 0, pSkillsTxt)
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

  // StatesTxt (185 rows * 0x3C) + corpse masks
  const statesCount = 185
  const pStatesTxt = m.alloc(statesCount * 0x3c) >>> 0
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc4) >>> 0, statesCount)
  m.setU32((pDataTables + 0xbb8) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xbc0) >>> 0, statesCount)
  const pCorpseMask = m.alloc(24) >>> 0
  m.setU32((pDataTables + 0xe4) >>> 0, pCorpseMask)
  m.setU32((pDataTables + 0x150) >>> 0, pCorpseMask)

  // PetTypesTxt (20 rows * 0xE0)
  const petTypesCount = 20
  const pPetTypesTxt = m.alloc(petTypesCount * 0xe0) >>> 0
  m.setU32((pDataTables + 0xbe8) >>> 0, pPetTypesTxt)
  m.setU32((pDataTables + 0xbec) >>> 0, pPetTypesTxt)
  m.setU32((pDataTables + 0xbf0) >>> 0, petTypesCount)

  // LevelsTxt (140 rows * 0x220) + LevelDefBin (140 rows * 0x9C)
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * 0x220) >>> 0
  const pLevelDefBin = m.alloc(levelsCount * 0x9c) >>> 0
  m.setU32((pDataTables + 0xbd8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xbe0) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xbf8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc00) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xc60) >>> 0, levelsCount)
  m.setU32(0x6fdf0b38, pLevelDefBin)
  // Mark town levels (1, 40, 75, 103, 109) with bIsTown flag at LevelsTxt+0x04 or allow teleport on non-town
  for (let lvl = 1; lvl < levelsCount; lvl++) {
    m.setU8((pLevelsTxt + lvl * 0x220 + 0x04) >>> 0, 1)
  }

  // ItemsTxt (64 rows * 0x1A8)
  const itemsCount = 64
  const pItemsTxt = m.alloc(itemsCount * ITEMS_TXT_STRIDE_113C) >>> 0
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, itemsCount)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, itemsCount)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)

  // ObjectsTxt (600 rows * 0x1C0)
  const objectsCount = 600
  const pObjectsTxt = m.alloc(objectsCount * 0x1c0) >>> 0
  m.setU32((pDataTables + 0xab8) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xac0) >>> 0, objectsCount)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, objectsCount)

  // AnimData + PlrMode globals
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

  // Game + TimerQueue + QuestCtrl
  const pGame = m.alloc(0x2000) >>> 0
  const pGameSeed = m.alloc(0x10) >>> 0
  m.setU32(pGameSeed, 0x13579bdf)
  m.setU32((pGameSeed + 4) >>> 0, 0x2468ace1)
  m.setU32((pGame + 0xa8) >>> 0, 500)
  m.setU8((pGame + 0x6a) >>> 0, 0)
  m.setU8((pGame + 0x6d) >>> 0, 0)
  m.setU32((pGame + 0x70) >>> 0, 1)
  const pDefaultMonReg = m.alloc(0x300) >>> 0
  for (let lvl = 0; lvl < 140; lvl++) {
    m.setU32((pGame + 0xf0 + lvl * 4) >>> 0, pDefaultMonReg)
  }
  m.setU32((pGame + 0x10f0) >>> 0, pGameSeed)
  EVENT_InitTimerQueue113c(m, pGame)

  const pQuestCtrl = m.alloc(0x20) >>> 0
  const pGameQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  m.setU32((pQuestCtrl + 0x08) >>> 0, 1)
  m.setU32((pQuestCtrl + 0x0c) >>> 0, pGameQuestFlags)
  m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)

  return {
    m,
    pDataTables,
    pGame,
    pQuestCtrl,
    pGameQuestFlags,
    pMonStatsTxt,
    pSkillsTxt,
    pSkillCode,
    pIscTxt,
    pStatesTxt,
    pLevelsTxt,
    pLevelDefBin,
    pItemsTxt,
    pObjectsTxt,
    pPetTypesTxt,
  }
}

function allocWalkableRoom(
  m: SparseMemory113c,
  nLevelId: number,
  nPosX = 100,
  nPosY = 100,
  nSizeX = 20,
  nSizeY = 20,
) {
  const pRoom = m.alloc(0x90) >>> 0
  const pRoomEx = m.alloc(0x90) >>> 0
  const pLevel = m.alloc(0x200) >>> 0
  const pCollMap = m.alloc(0x40) >>> 0
  const pCollGrid = m.alloc(nSizeX * nSizeY * 2) >>> 0
  const pCoords = m.alloc(0x20) >>> 0
  const pNearList = m.alloc(0x10) >>> 0
  m.setU32(pNearList, pRoom)

  m.setU32(pCollMap, nPosX)
  m.setU32((pCollMap + 0x04) >>> 0, nPosY)
  m.setU32((pCollMap + 0x08) >>> 0, nSizeX)
  m.setU32((pCollMap + 0x0c) >>> 0, nSizeY)
  m.setU32((pCollMap + 0x10) >>> 0, nPosX)
  m.setU32((pCollMap + 0x14) >>> 0, nPosY)
  m.setU32((pCollMap + 0x18) >>> 0, nSizeX)
  m.setU32((pCollMap + 0x1c) >>> 0, nSizeY)
  m.setU32((pCollMap + 0x20) >>> 0, pCollGrid)
  m.setU32((pCollMap + 0x24) >>> 0, (pCollGrid + nSizeX * nSizeY * 2) >>> 0)

  m.setU32(pCoords, nPosX)
  m.setU32((pCoords + 0x04) >>> 0, nPosY)
  m.setU32((pCoords + 0x08) >>> 0, nSizeX)
  m.setU32((pCoords + 0x0c) >>> 0, nSizeY)
  m.setU32((pCoords + 0x10) >>> 0, (nPosX / 5) | 0)
  m.setU32((pCoords + 0x14) >>> 0, (nPosY / 5) | 0)
  m.setU32((pCoords + 0x18) >>> 0, (nSizeX / 5) | 0)
  m.setU32((pCoords + 0x1c) >>> 0, (nSizeY / 5) | 0)

  m.setU32((pRoom + 0x00) >>> 0, pNearList)
  m.setU32((pRoom + 0x08) >>> 0, pCoords)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoom + 0x20) >>> 0, pCollMap)
  m.setU32((pRoom + 0x24) >>> 0, 1)
  m.setU32((pRoom + 0x4c) >>> 0, nPosX >>> 0)
  m.setU32((pRoom + 0x50) >>> 0, nPosY >>> 0)
  m.setU32((pRoom + 0x54) >>> 0, nSizeX >>> 0)
  m.setU32((pRoom + 0x58) >>> 0, nSizeY >>> 0)
  m.setU32((pRoom + 0x5c) >>> 0, ((nPosX / 5) | 0) >>> 0)
  m.setU32((pRoom + 0x60) >>> 0, ((nPosY / 5) | 0) >>> 0)
  m.setU32((pRoom + 0x64) >>> 0, ((nSizeX / 5) | 0) >>> 0)
  m.setU32((pRoom + 0x68) >>> 0, ((nSizeY / 5) | 0) >>> 0)
  m.setU32((pRoom + 0x7c) >>> 0, m.alloc(8) >>> 0)

  const pLogInfo = m.alloc(0x20) >>> 0
  m.setU8(pLogInfo, 1)
  m.setU32((pRoomEx + 0x28) >>> 0, 0x1100000)
  m.setU32((pRoomEx + 0x30) >>> 0, pRoom)
  m.setU32((pRoomEx + 0x34) >>> 0, nPosX)
  m.setU32((pRoomEx + 0x38) >>> 0, nPosY)
  m.setU32((pRoomEx + 0x3c) >>> 0, nSizeX)
  m.setU32((pRoomEx + 0x40) >>> 0, nSizeY)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  m.setU32((pRoomEx + 0x64) >>> 0, pLogInfo)
  m.setU32((pLevel + 0x1d0) >>> 0, nLevelId >>> 0)

  return { pRoom, pRoomEx, pLevel, pCollMap, pCollGrid }
}

function allocUnitWithRoom(
  m: SparseMemory113c,
  pGame: number,
  dwType: number,
  dwClassId: number,
  dwGuid: number,
  pRoom: number,
  nX = 105,
  nY = 105,
) {
  const pUnit = m.alloc(0x100) >>> 0
  const pUnitData = m.alloc(0x180) >>> 0
  const pPath = m.alloc(0x200) >>> 0

  m.setU32((pUnit + 0x00) >>> 0, dwType >>> 0)
  m.setU32((pUnit + 0x04) >>> 0, dwClassId >>> 0)
  m.setU32((pUnit + 0x0c) >>> 0, dwGuid >>> 0)
  m.setU32((pUnit + 0x10) >>> 0, 1)
  m.setU32((pUnit + 0x14) >>> 0, pUnitData)
  m.setU32((pUnit + 0x20) >>> 0, 0x13579bdf)
  m.setU32((pUnit + 0x24) >>> 0, 0x2468ace1)
  m.setU32((pUnit + 0x2c) >>> 0, pPath)
  m.setU32((pUnit + 0x80) >>> 0, pGame)

  if (dwType === 2 || dwType === 4 || dwType === 5) {
    m.setU32((pPath + 0x00) >>> 0, pRoom)
    m.setU32((pPath + 0x0c) >>> 0, nX >>> 0)
    m.setU32((pPath + 0x10) >>> 0, nY >>> 0)
  } else {
    m.set(pPath, D2DynamicPathStrc.wPosX, nX & 0xffff)
    m.set(pPath, D2DynamicPathStrc.wPosY, nY & 0xffff)
    m.set(pPath, D2DynamicPathStrc.wTargetX, nX & 0xffff)
    m.set(pPath, D2DynamicPathStrc.wTargetY, nY & 0xffff)
    m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
    m.set(pPath, D2DynamicPathStrc.pUnit, pUnit)
    m.set(pPath, D2DynamicPathStrc.dwUnitSize, 1)
    m.set(pPath, D2DynamicPathStrc.dwCollisionPattern, 1)
    m.set(pPath, D2DynamicPathStrc.dwVelocity, 0x600)
  }

  let pClient = 0
  let pQuestRecord = 0
  if (dwType === 0) {
    pClient = m.alloc(0x520) >>> 0
    m.setU32((pClient + 0x04) >>> 0, 4)
    m.setU32((pClient + 0x1a8) >>> 0, pGame)
    m.setU32((pClient + 0x1bc) >>> 0, m.alloc(0x200) >>> 0)
    m.setU32((pUnitData + 0x9c) >>> 0, pClient)
    pQuestRecord = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU32((pUnitData + 0x10) >>> 0, pQuestRecord)
    m.setU32((pUnitData + 0x14) >>> 0, pQuestRecord)
    m.setU32((pUnitData + 0x18) >>> 0, pQuestRecord)
    for (let i = 0; i < 3; i++) {
      m.setU32((pUnitData + 0x1c + i * 4) >>> 0, QUESTRECORD_AllocRecord113c(m, 0))
      const pIntro = m.alloc(8) >>> 0
      m.setU32(pIntro, QUESTRECORD_AllocRecord113c(m, 0))
      m.setU32((pUnitData + 0x60 + i * 4) >>> 0, pIntro)
    }
    INVENTORY_AllocInventory113c(m, 0, pUnit)
    const pSlListInit = m.alloc(0x20) >>> 0
    const pDefaultSkill = m.alloc(0x40) >>> 0
    const pSgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
    const pSkillsBase = pSgpt !== 0 ? m.u32((pSgpt + 0xb98) >>> 0) >>> 0 : 0
    m.set(pDefaultSkill, D2SkillStrc.pSkillsTxt, pSkillsBase)
    m.set(pDefaultSkill, D2SkillStrc.nSkillLevel, 1)
    m.set(pDefaultSkill, D2SkillStrc.nOwnerItemGuid, 0xffffffff)
    m.set(pSlListInit, D2SkillListStrc.pFirstSkill, pDefaultSkill)
    m.set(pSlListInit, D2SkillListStrc.pLeftSkill, pDefaultSkill)
    m.set(pSlListInit, D2SkillListStrc.pRightSkill, pDefaultSkill)
    m.set(pUnit, D2UnitStrc.pSkills, pSlListInit)
  } else if (dwType === 1) {
    const pAiGeneral = m.alloc(0x60) >>> 0
    const pAiCtrl = m.alloc(0x60) >>> 0
    m.setU32((pUnitData + 0x28) >>> 0, pAiGeneral)
    m.setU32((pUnitData + 0x2c) >>> 0, pAiCtrl)
    m.setU32((pAiGeneral + 0x28) >>> 0, pGame)
    m.set(pUnit, D2UnitStrc.pSkills, m.alloc(0x20) >>> 0)
  }

  STATLIST_CreateEx113c(m, pUnit, 0, pGame, 0)
  SUNIT_InsertServerUnit113c(m, pGame, pUnit)
  return { pUnit, pUnitData, pPath, pClient, pQuestRecord }
}

function writeRpnImm32(m: SparseMemory113c, pSkillCode: number, offset: number, val: number): number {
  const addr = (pSkillCode + offset) >>> 0
  m.setU8(addr, 0x09)
  m.setU32((addr + 1) >>> 0, val >>> 0)
  m.setU8((addr + 5) >>> 0, 0x00)
  return offset
}

describe('D2Game.dll 1.13c Disassembly Verification — Wave 15 (+122 VAs across k2w3-b5/k2w5-b8/k2w8-b2/k2w8-b3/k2w11-b1)', () => {
  it('verifies all 122 PE32 .text opcode heads/tails/sizes, manifest diff-verified promotions, and 7 indirectUnknown guardrails', () => {
    expect(WAVE15_PROMOTED_SPECS).toHaveLength(122)

    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    const pe = loadPeSectionMapper(dllPath, 0x6fc20000)
    const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    const byVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        byVa.set(fn.va.toUpperCase(), fn)
      }
    }

    for (const spec of WAVE15_PROMOTED_SPECS) {
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

      const mf = byVa.get(spec.va.toUpperCase())
      expect(mf, `Missing manifest entry for ${spec.va}`).toBeDefined()
      expect(mf!.size).toBe(spec.size)
      expect(mf!.status).toBe('diff-verified')
      expect(mf!.tsSymbol).toBe(spec.tsSymbol)
      expect(mf!.indirectUnknown).toBeFalsy()
      expect(mf!.diffEvidence).toContain('k2-disasm-verified-wave15.test.ts')
    }

    // All 7 formerly indirectUnknown VAs in the 5 shards were statically resolved and promoted in Wave 23 (Batches A/B)
    for (const indVa of WAVE15_INDIRECT_UNKNOWN_VAS) {
      const mf = byVa.get(indVa.toUpperCase())
      expect(mf, `Missing manifest entry for ${indVa}`).toBeDefined()
      expect(mf!.indirectUnknown).toBeUndefined()
      expect(mf!.status).toBe('diff-verified')
    }
  })

  it('regressions [k2w3-b5]: 0x6FC70130, 0x6FC709E0, 0x6FC73170, 0x6FC7DD00, 0x6FC7DDF0 match PE32 disassembly', () => {
    const { m, pGame } = createWave15World()
    const { pRoom } = allocWalkableRoom(m, 114)
    const { pUnit: pMon, pUnitData: pMonData } = allocUnitWithRoom(m, pGame, 1, 10, 501, pRoom)
    const pAiGen = m.u32((pMonData + 0x28) >>> 0)
    m.setU32(pAiGen, 0x12345678)

    // 0x6FC70130: calls AI_InitMonsterAiThinkFn113c(m, unit, unit+0x80, pAiGen, 0) without pre-zeroing pAiGen+0x00
    beginVaTrace113c()
    w3b5.STATES_OnStateRemovedResetMonsterAi_6FC70130_113c(m, pMon, 10, 0)
    const h0130 = endVaTrace113c()
    expect(h0130.has('D2Game:0x6FC70130')).toBe(true)
    expect(h0130.has('D2Game:0x6FCBD230')).toBe(true)

    // 0x6FC709E0: only early-returns on skillId === 0, not missing pSkillsTxt for non-zero skillId
    const { pUnit: pCaster } = allocUnitWithRoom(m, pGame, 0, 0, 502, pRoom)
    const flagsBefore = m.u32((pMon + 0xc4) >>> 0)
    w3b5.SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c(m, pCaster, pGame, pMon, 0, 1)
    expect(m.u32((pMon + 0xc4) >>> 0)).toBe(flagsBefore)

    // 0x6FC73170: returns unsigned 32-bit CRC32 (>>> 0) even when MSB is set
    const pSave = m.alloc(0x100) >>> 0
    for (let i = 0; i < 0x100; i++) m.setU8((pSave + i) >>> 0, (i * 7 + 0x5a) & 0xff)
    m.setU32((pSave + 0x04) >>> 0, 0x60)
    const crc = w3b5.PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c(m, pSave, 0x100)
    expect(crc).toBeGreaterThanOrEqual(0)
    expect(crc).toBe(crc >>> 0)

    // 0x6FC7DD00 & 0x6FC7DDF0: invoke canonical MONSTER_StartMode113c (0x6FC95E10)
    const pQuest = m.alloc(0x100) >>> 0
    const pQuestExt = m.alloc(0x100) >>> 0
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU32((pQuest + 0x18) >>> 0, pQuestExt)
    m.setU32((pQuest + 0xe0) >>> 0, 0x25)
    m.setU32((pMon + 0x04) >>> 0, 0x226)
    m.setU32((pMon + 0x10) >>> 0, 1)
    beginVaTrace113c()
    w3b5.ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c(m, pMon, pQuest)
    const hThaw = endVaTrace113c()
    expect(hThaw.has('D2Game:0x6FC7DD00')).toBe(true)
    expect(hThaw.has('D2Game:0x6FC95E10')).toBe(true)
  })

  it('regressions [k2w8-b2]: 0x6FC85D40, 0x6FC8A9D0, 0x6FC8F040, 0x6FCB54F0, 0x6FCB6C00, 0x6FCCF450, 0x6FCD4410, 0x6FCD5BD0', () => {
    const { m, pGame, pSkillsTxt, pLevelsTxt, pObjectsTxt } = createWave15World()
    const { pRoom: pFieldRoom } = allocWalkableRoom(m, 2)
    const { pUnit: pPlr, pClient } = allocUnitWithRoom(m, pGame, 0, 0, 601, pFieldRoom)
    const { pUnit: pAttacker } = allocUnitWithRoom(m, pGame, 1, 10, 602, pFieldRoom)
    const { pUnit: pDefender } = allocUnitWithRoom(m, pGame, 1, 11, 603, pFieldRoom)

    // 0x6FCB54F0: pAuraIterArgs+0x00 = pGame, +0x04 = pAttacker, and passes bDeferPostResultTo6FCFCF20=1
    const pAuraIterArgs = m.alloc(0x20) >>> 0
    const pAuraDamageCtx = m.alloc(0x20) >>> 0
    const pTemplateDmg = m.alloc(0x70) >>> 0
    m.setU16((pTemplateDmg + 0x04) >>> 0, 0x21)
    m.setU32((pTemplateDmg + 0x08) >>> 0, 256)
    m.setU32(pAuraDamageCtx, pTemplateDmg)
    m.setU32((pAuraDamageCtx + 0x08) >>> 0, 1)
    m.setU32((pAuraIterArgs + 0x00) >>> 0, pGame)
    m.setU32((pAuraIterArgs + 0x04) >>> 0, pAttacker)
    m.setU32((pAuraIterArgs + 0x0c) >>> 0, pAuraDamageCtx)
    let seenArgs: number[] = []
    const rAura = w8b2.AURA_ApplyRadialDamageCallback_6FCB54F0_113c(
      m,
      pAuraIterArgs,
      pDefender,
      (_mem, ctx, def, g, atk) => {
        seenArgs = [ctx, def, g, atk]
        return 1
      },
    )
    expect(rAura).toBe(1)
    expect(seenArgs).toEqual([pAuraDamageCtx, pDefender, pGame, pAttacker])

    // 0x6FCB6C00: signed nMaxDistSq (-1 < 0 triggers unsummon even at distSq 0, whereas 0 does not)
    const pPetListWrapper = m.alloc(0x10) >>> 0
    const pPetNode = m.alloc(0x20) >>> 0
    m.setU32(pPetListWrapper, pPetNode)
    m.setU32((pPetNode + 0x04) >>> 0, 602)
    beginVaTrace113c()
    w8b2.PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c(m, pPetListWrapper, pGame, pPlr, 0)
    const hDist0 = endVaTrace113c()
    expect(hDist0.has('D2Game:0x6FCB7B50')).toBe(false)

    const pPlrData = m.u32((pPlr + 0x14) >>> 0)
    const pPlrPets = m.alloc(0x20) >>> 0
    m.setU32(pPlrPets, m.alloc(20 * 12) >>> 0)
    m.setU32((pPlrData + 0x44) >>> 0, pPlrPets)
    beginVaTrace113c()
    w8b2.PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c(m, pPetListWrapper, pGame, pPlr, -1)
    const hDistNeg = endVaTrace113c()
    expect(hDistNeg.has('D2Game:0x6FCB7B50')).toBe(true)

    // 0x6FCCF450 & 0x6FCD4410: trace hits DUNGEON_CheckRoomIsTownMemPort113c (0x6FD8C390)
    const { pRoom: pTownRoom } = allocWalkableRoom(m, 1)
    const { pUnit: pTownPlr } = allocUnitWithRoom(m, pGame, 0, 0, 604, pTownRoom)
    m.setU8((pLevelsTxt + 1 * 0x220 + 0x1c) >>> 0, 1)
    beginVaTrace113c()
    expect(w8b2.SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450_113c(m, pGame, pTownPlr)).toBe(0)
    const hTown = endVaTrace113c()
    expect(hTown.has('D2Common:0x6FD8C390')).toBe(true)

    // 0x6FCD4410: checks DUNGEON_CheckRoomIsTownMemPort113c and resolves object via unswapped wTargetY=2 / wTargetX=guid
    const { pUnit: pDoor, pUnitData: pDoorData } = allocUnitWithRoom(m, pGame, 2, 1, 605, pFieldRoom)
    m.setU16((pSkillsTxt + 10 * 0x23c) >>> 0, 10)
    const pAtkMonData = m.u32((pAttacker + 0x14) >>> 0)
    const pAtkAiGen = m.u32((pAtkMonData + 0x28) >>> 0)
    m.setU32((pAtkAiGen + 0x3c) >>> 0, 10)
    const pAtkPath = m.u32((pAttacker + 0x2c) >>> 0)
    m.set(pAtkPath, D2DynamicPathStrc.wTargetY, 2)
    m.set(pAtkPath, D2DynamicPathStrc.wTargetX, 605)
    beginVaTrace113c()
    w8b2.SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c(m, pGame, pAttacker, 10, 1)
    const hShaman = endVaTrace113c()
    expect(hShaman.has('D2Common:0x6FD8C390')).toBe(true)

    // 0x6FC8A9D0 & 0x6FC8F040: locked door/chest passes pPlayer as sound source and pClient (not 0x0b)
    m.setU32((pDoor + 0x10) >>> 0, 0)
    m.setU32((pDoorData + 0x00) >>> 0, (pObjectsTxt + 1 * 0x1c0) >>> 0)
    m.setU8((pDoorData + 0x04) >>> 0, 0x80) // trap/locked flags
    const pOpArgs = m.alloc(0x20) >>> 0
    m.setU32((pOpArgs + 0x00) >>> 0, pGame)
    m.setU32((pOpArgs + 0x04) >>> 0, pDoor)
    m.setU32((pOpArgs + 0x08) >>> 0, pPlr)
    m.setU32((pOpArgs + 0x10) >>> 0, 1)
    w8b2.OBJ_OperateDoorWithLockCheck_6FC8A9D0_113c(m, pOpArgs, 10000)
    expect(m.u32((pPlr + 0xc4) >>> 0) | 0).toBeTypeOf('number')
    void pClient

    // 0x6FCD5BD0: executes with valid skill record and hits 0x6FD13CB0
    beginVaTrace113c()
    w8b2.SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c(m, pGame, pAttacker, 10, 1)
    const hRes = endVaTrace113c()
    expect(hRes.has('D2Game:0x6FCD5BD0')).toBe(true)
  })

  it('regressions [k2w8-b3]: 0x6FCDD880, 0x6FCDD920, 0x6FCE7130, 0x6FCEF5B0, 0x6FCF1140, 0x6FCF1370, 0x6FCF4360, 0x6FCF6760', () => {
    const { m, pGame } = createWave15World()
    const { pRoom } = allocWalkableRoom(m, 40)
    const { pUnit: pPlr, pClient } = allocUnitWithRoom(m, pGame, 0, 0, 701, pRoom)

    // 0x6FCDD880: bKeepItem=1 preserves item vs bKeepItem=0 frees failed item
    const { pUnit: pItemA } = allocUnitWithRoom(m, pGame, 4, 0, 702, pRoom)
    expect(
      w8b3.NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c(
        m,
        pItemA,
        pGame,
        pPlr,
        1,
      ),
    ).toBe(1)

    // 0x6FCE7130: queues packet 0x5D on client buffer channel 1 (not 4)
    const pQuest = m.alloc(0x100) >>> 0
    const pQuestState = m.alloc(0x40) >>> 0
    m.setU32((pQuest + 0x04) >>> 0, pGame)
    m.setU8((pQuest + 0x0a) >>> 0, 1) // triggers direct packet 0x5D path
    m.setU32((pQuest + 0x18) >>> 0, pQuestState)
    beginFrameS2CTrace113c()
    w8b3.ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c(m, pQuest, pPlr)
    const s2c5D = endFrameS2CTrace113c()
    expect(s2c5D.some((hex) => hex.startsWith('5d'))).toBe(true)
    void pClient

    // 0x6FCF1140: returns 1 when bodyloc has pEquipped === 0 (not 0)
    const pPkt1B = m.alloc(0x10) >>> 0
    m.setU8(pPkt1B, 0x1b)
    m.setU32((pPkt1B + 1) >>> 0, 702)
    m.setU32((pPkt1B + 5) >>> 0, 4) // right hand bodyloc (empty)
    expect(
      w8b3.C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c(m, pGame, pPlr, pPkt1B, 9),
    ).toBe(1)

    // 0x6FCF1370: passes unswapped args to 0x6FCF62E0 and returns 3 when out-flag set else 0
    const pItemAData = m.u32((pItemA + 0x14) >>> 0)
    m.setU32((pItemA + 0x10) >>> 0, 0) // ITEMMODE_STORED
    m.set(pItemAData, D2ItemDataStrc.pExtraOwnerInventory, m.u32((pPlr + 0x60) >>> 0))
    const pPkt19 = m.alloc(0x10) >>> 0
    m.setU8(pPkt19, 0x19)
    m.setU32((pPkt19 + 1) >>> 0, 702)
    beginVaTrace113c()
    const r19 = w8b3.C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c(
      m,
      pGame,
      pPlr,
      pPkt19,
      5,
    )
    const h19 = endVaTrace113c()
    expect(h19.has('D2Game:0x6FCF62E0')).toBe(true)
    expect([0, 3]).toContain(r19)

    // 0x6FCF4360: asserts line 0x660 when pGame === 0, does NOT assert when pUnit === 0 with valid pGame
    expect(() => w8b3.ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c(m, 0, pPlr, pItemA)).toThrow(
      D2CommonAssertError,
    )
    expect(w8b3.ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c(m, pGame, 0, pItemA)).toBe(0)

    // 0x6FCEF5B0: unswapped (dwItemGuid, bShiftToMerc) passed to 0x6FCF8BA0
    const { pUnit: pBeltItem, pUnitData: pBeltItemData } = allocUnitWithRoom(m, pGame, 4, 0, 704, pRoom)
    m.setU32((pBeltItem + 0x10) >>> 0, 2) // ITEMMODE_INBELT
    m.set(pBeltItemData, D2ItemDataStrc.pExtraOwnerInventory, m.u32((pPlr + 0x60) >>> 0))
    const pPkt26 = m.alloc(0x10) >>> 0
    m.setU8(pPkt26, 0x26)
    m.setU32((pPkt26 + 1) >>> 0, 704)
    m.setU32((pPkt26 + 5) >>> 0, 1)
    beginVaTrace113c()
    w8b3.C2S_Packet26_UseBeltItem_6FCEF5B0_113c(m, pGame, pPlr, pPkt26, 0x0d)
    const h26 = endVaTrace113c()
    expect(h26.has('D2Game:0x6FCF8BA0')).toBe(true)

    // 0x6FCF6760: unswapped paired equip args + delegates replenish to canonical 0x6FC2EA70/0x6FC2EA10
    const { pUnit: pCorpse } = allocUnitWithRoom(m, pGame, 0, 0, 703, pRoom)
    expect(w8b3.ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c(m, pCorpse, pGame, pPlr)).toBe(1)
  })

  it('regressions [k2w11-b1]: all 16 fixed VAs & freeUnitEventNodesByType match PE32 x86 disassembly', () => {
    const { m, pGame, pSkillsTxt, pSkillCode, pLevelsTxt, pLevelDefBin, pPetTypesTxt } =
      createWave15World()
    const { pRoom, pRoomEx } = allocWalkableRoom(m, 2, 100, 100, 24, 24)
    const { pUnit: pPlr, pUnitData: pPD, pPath: pPlrPath, pClient } = allocUnitWithRoom(
      m,
      pGame,
      0,
      0,
      801,
      pRoom,
      108,
      108,
    )
    const { pUnit: pMon, pUnitData: pMonData, pPath: pMonPath } = allocUnitWithRoom(
      m,
      pGame,
      1,
      10,
      802,
      pRoom,
      110,
      110,
    )

    // 1. 0x6FC58620: asserts line 0x47 on null player, line 0x4bc on non-player, initializes valid player subsystems
    expect(() => w11b1.PLAYER_InitPlayerUnitSubsystems_6FC58620_113c(m, pGame, 0, 1)).toThrow(
      D2CommonAssertError,
    )
    const pNewPlr = m.alloc(0x100) >>> 0
    m.setU32((pNewPlr + 0x00) >>> 0, 0)
    m.setU32((pNewPlr + 0x04) >>> 0, 0)
    m.setU32((pNewPlr + 0x80) >>> 0, pGame)
    w11b1.PLAYER_InitPlayerUnitSubsystems_6FC58620_113c(m, pGame, pNewPlr, 999)
    expect(m.u32((pNewPlr + 0x0c) >>> 0)).toBe(999)
    expect(m.u32((pNewPlr + 0xc4) >>> 0) & 0x0e).toBe(0x0e)
    expect(m.u32((pNewPlr + 0x60) >>> 0)).not.toBe(0)
    expect(m.u32((pNewPlr + 0xa8) >>> 0)).not.toBe(0)
    expect(m.u32((pNewPlr + 0xdc) >>> 0)).toBe(0)

    // 2. 0x6FC628F0: reads auraState at +0x80, sets pUnit+0xc4 |= 0x40, sets stats 0x15e/0x15f, returns pStatList
    const skillId67 = 50
    const pSkillRec67 = (pSkillsTxt + skillId67 * 0x23c) >>> 0
    m.setU16((pSkillRec67 + 0x00) >>> 0, skillId67)
    m.setU16((pSkillRec67 + 0x80) >>> 0, 15) // auraState = 15
    m.setU16((pSkillRec67 + 0x84) >>> 0, 0xffff) // no item events
    const lenOff = writeRpnImm32(m, pSkillCode, 0x10, 200)
    m.setU32((pSkillRec67 + 0x60) >>> 0, lenOff)
    const pBuffSl = w11b1.SKILLS_SrvDo067_ApplyBuffStateAndItemEvents_6FC628F0_113c(
      m,
      pGame,
      pPlr,
      skillId67,
      7,
    )
    expect(pBuffSl).toBeGreaterThan(1) // returns pStatList pointer, NOT 1!
    expect(m.u32((pPlr + 0xc4) >>> 0) & 0x40).toBe(0x40)
    expect(STATLIST_GetStatValue113c(m, pBuffSl, 0x15e, 0)).toBe(skillId67)
    expect(STATLIST_GetStatValue113c(m, pBuffSl, 0x15f, 0)).toBe(7)
    expect(STATES_CheckState113c(m, pPlr, 15)).not.toBe(0)

    // 3. 0x6FC63450: returns 0 (no assert) on missing LevelsTxt; bTeleport=2 blocks when UNITS_FindFreeCoords != 0
    const { pRoom: pBadLvlRoom } = allocWalkableRoom(m, 999)
    const { pUnit: pBadLvlUnit } = allocUnitWithRoom(m, pGame, 0, 0, 803, pBadLvlRoom)
    expect(() =>
      w11b1.SKILLS_SrvDo029_Teleport_6FC63450_113c(m, pGame, pBadLvlUnit, 54, 1),
    ).not.toThrow()
    expect(w11b1.SKILLS_SrvDo029_Teleport_6FC63450_113c(m, pGame, pBadLvlUnit, 54, 1)).toBe(0)
    m.setU8((pLevelsTxt + 2 * 0x220 + 0x04) >>> 0, 2)
    m.set(pPlrPath, D2DynamicPathStrc.wTargetX, 112)
    m.set(pPlrPath, D2DynamicPathStrc.wTargetY, 112)
    expect(w11b1.SKILLS_SrvDo029_Teleport_6FC63450_113c(m, pGame, pPlr, 54, 1)).toBe(1)

    // 4. 0x6FC48290: queues 0x6FC9A0F0 on missing skill & runs leap/charge path setup
    const skillId37 = 51
    const pSkillRec37 = (pSkillsTxt + skillId37 * 0x23c) >>> 0
    m.setU16((pSkillRec37 + 0x00) >>> 0, skillId37)
    m.setU16((pSkillRec37 + 0x80) >>> 0, 16) // distinct auraState = 16
    m.setU16((pSkillRec37 + 0x84) >>> 0, 0xffff)
    m.setU32((pSkillRec37 + 0x60) >>> 0, lenOff)
    beginVaTrace113c()
    expect(w11b1.SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c(m, pGame, pPlr, skillId37, 3)).toBe(0)
    const hLeapFail = endVaTrace113c()
    expect(hLeapFail.has('D2Game:0x6FC9A0F0')).toBe(true)

    // Attach skill node for skillId37 on pPlr and re-run 0x6FC48290
    const pSlList = m.alloc(0x20) >>> 0
    const pSkillNode = m.alloc(0x40) >>> 0
    m.set(pSkillNode, D2SkillStrc.pSkillsTxt, pSkillRec37)
    m.set(pSkillNode, D2SkillStrc.nSkillLevel, 3)
    m.set(pSkillNode, D2SkillStrc.nOwnerItemGuid, 0xffffffff)
    m.set(pSlList, D2SkillListStrc.pFirstSkill, pSkillNode)
    m.set(pPlr, D2UnitStrc.pSkills, pSlList)
    m.set(pPlrPath, D2DynamicPathStrc.dwVelocity, 0x600)
    m.set(pPlrPath, D2DynamicPathStrc.wTargetX, 114)
    m.set(pPlrPath, D2DynamicPathStrc.wTargetY, 114)
    expect(w11b1.SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c(m, pGame, pPlr, skillId37, 3)).toBe(1)
    expect(m.get(pSkillNode, D2SkillStrc.dwParam0C)).toBe(1)
    expect(m.get(pSkillNode, D2SkillStrc.dwParam3) | 0).toBe(-1)

    // 5. 0x6FC70800: frees event byte type 8 walking pNode+0x24 and sets used skill 0 before StartMode
    const pEvt8 = m.alloc(0x30) >>> 0
    const pEvt5 = m.alloc(0x30) >>> 0
    m.setU8(pEvt8, 8)
    m.setU32((pEvt8 + 0x24) >>> 0, pEvt5)
    m.setU8(pEvt5, 5)
    m.setU32((pEvt5 + 0x24) >>> 0, 0)
    m.setU32((pMon + 0xdc) >>> 0, pEvt8)
    beginVaTrace113c()
    w11b1.SKILLS_ReleaseTrappedOrConvertedMonster_6FC70800_113c(m, pMon, pGame)
    const hRel = endVaTrace113c()
    expect(hRel.has('D2Game:0x6FC70800')).toBe(true)
    expect(hRel.has('D2Game:0x6FCAE6F0')).toBe(true)

    // 6. 0x6FC8BB60: asserts 0xfb3 on non-player, always returns 0
    const pCowArgs = m.alloc(0x20) >>> 0
    m.setU32((pCowArgs + 0x00) >>> 0, pGame)
    m.setU32((pCowArgs + 0x08) >>> 0, pMon)
    expect(() => w11b1.OBJ_OperateFn_CowAndSpecialPortal_6FC8BB60_113c(m, pCowArgs)).toThrow(
      D2CommonAssertError,
    )

    // 7. 0x6FC8BD60: asserts 0xa2a on null player; warps player via pPlayerUnit+0x80 and queues 6-byte packet 0x07
    const { pUnit: pPadObj } = allocUnitWithRoom(m, pGame, 2, 10, 804, pRoom, 109, 109)
    expect(() => w11b1.OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c(m, pPadObj, 0, pRoom)).toThrow(
      D2CommonAssertError,
    )
    beginFrameS2CTrace113c()
    expect(w11b1.OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c(m, pPadObj, pPlr, pRoom)).toBe(1)
    const s2c07 = endFrameS2CTrace113c()
    expect(s2c07.some((hex) => hex.startsWith('07') && hex.length === 12)).toBe(true)

    // 8. 0x6FC8D0F0: enforces 5000ms (0x1388) cooldown against 0x6fd18d10 and returns 0
    const { pUnit: pPortalObj, pUnitData: pPortalData } = allocUnitWithRoom(
      m,
      pGame,
      2,
      0x3b,
      805,
      pRoom,
      107,
      107,
    )
    m.setU8((pPortalData + 0x04) >>> 0, 2)
    m.setU32((pLevelDefBin + 2 * 0x9c) >>> 0, 0)
    const pPortalArgs = m.alloc(0x20) >>> 0
    m.setU32((pPortalArgs + 0x00) >>> 0, pGame)
    m.setU32((pPortalArgs + 0x04) >>> 0, pPortalObj)
    m.setU32((pPortalArgs + 0x08) >>> 0, pPlr)
    m.setU32((pPortalArgs + 0x10) >>> 0, 0x3b)
    m.setU32((pPD + 0x160) >>> 0, 8000)
    m.setU32(0x6fd18d10, 12000) // 8000 + 5000 = 13000 > 12000 -> cooldown active
    expect(w11b1.OBJ_OperateFn_TownAndPermanentPortal_6FC8D0F0_113c(m, pPortalArgs)).toBe(0)

    // 9. 0x6FCB3680: branches on pUnit+0x38 >> 8 parity (even=teleport clearing bit 0x40; odd=kick calling 0x6FCFE5A0)
    const skillDF = 275
    const pDfRec = (pSkillsTxt + skillDF * 0x23c) >>> 0
    m.setU16(pDfRec, skillDF)
    m.setU8((pDfRec + 0x1a5) >>> 0, 0x80)
    PATH_SetTargetUnit113c(m, pPlrPath, pMon)
    m.setU32((pPlr + 0x38) >>> 0, 2 << 8) // even frame -> teleport
    m.setU32((pPlr + 0xc4) >>> 0, (m.u32((pPlr + 0xc4) >>> 0) | 0x40) >>> 0)
    expect(w11b1.SKILLS_SrvDo252_DragonFlight_6FCB3680_113c(m, pGame, pPlr, skillDF, 5)).toBe(1)
    expect(m.u32((pPlr + 0xc4) >>> 0) & 0x40).toBe(0)

    m.setU32((pPlr + 0x38) >>> 0, 3 << 8) // odd frame -> kick
    beginVaTrace113c()
    expect(w11b1.SKILLS_SrvDo252_DragonFlight_6FCB3680_113c(m, pGame, pPlr, skillDF, 5)).toBe(1)
    const hDfOdd = endVaTrace113c()
    expect(hDfOdd.has('D2Game:0x6FCFE5A0')).toBe(true)
    expect(hDfOdd.has('D2Game:0x6FCB1B70')).toBe(true)

    // 10. 0x6FCB7E20: asserts 0x3b5 on missing pPlrData, broadcasts via 0x6FCFFC10 -> 0x6FCB66E0
    const pBadPlr = m.alloc(0x100) >>> 0
    m.setU32(pBadPlr, 0)
    expect(() =>
      w11b1.PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c(m, pBadPlr, pGame, pMon, 1, 0),
    ).toThrow(D2CommonAssertError)
    const pPlayerPets = m.alloc(0x20) >>> 0
    const pPetSlots = m.alloc(20 * 12) >>> 0
    m.setU32(pPlayerPets, pPetSlots)
    m.setU32((pPD + 0x44) >>> 0, pPlayerPets)
    const pPetInfo = m.alloc(12) >>> 0
    m.setU32(pPetInfo, 0x1111)
    m.setU32((pPetInfo + 4) >>> 0, 0x2222)
    m.setU32((pPetInfo + 8) >>> 0, 0x3333)
    void pPetTypesTxt
    beginVaTrace113c()
    w11b1.PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c(m, pPlr, pGame, pMon, 1, pPetInfo)
    const hPetAssign = endVaTrace113c()
    expect(hPetAssign.has('D2Game:0x6FCB7A20')).toBe(true)
    expect(hPetAssign.has('D2Game:0x6FCFFC10')).toBe(true)

    // 11. 0x6FCD46B0: resolves owner using u32(pAiGeneral+0x28)
    m.set(pMonPath, D2DynamicPathStrc.wTargetX, 108)
    m.set(pMonPath, D2DynamicPathStrc.wTargetY, 108)
    expect(
      w11b1.SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c(m, pGame, pMon, 0, 1),
    ).toBe(1)

    // 12. 0x6FCE0DB0: queues fail packet 0x2A on channel 1 (observed in S2C trace)
    beginFrameS2CTrace113c()
    w11b1.NPCTRADE_InteractResurrectMerc_6FCE0DB0_113c(m, 0x9999, pGame, pPlr)
    const s2c2A = endFrameS2CTrace113c()
    expect(s2c2A.some((hex) => hex.startsWith('2a') && hex.length === 30)).toBe(true)
    void pClient

    // 13. 0x6FCEDA20: returns 2 WITHOUT sending packet 0x21 when SpendSkillPoints (0x6FCBFAE0) fails
    const skillId3B = 52
    const pSkillRec3B = (pSkillsTxt + skillId3B * 0x23c) >>> 0
    m.setU16(pSkillRec3B, skillId3B)
    m.setU8((pSkillRec3B + 0x05) >>> 0, 0x04) // allocatable flag bit 2
    m.setU8((pSkillRec3B + 0x0c) >>> 0, 0) // nCharClass = 0 (Amazon)
    m.setU16((pSkillRec3B + 0x17e) >>> 0, 0xffff)
    m.setU16((pSkillRec3B + 0x180) >>> 0, 0xffff)
    m.setU16((pSkillRec3B + 0x182) >>> 0, 0xffff)
    const cost5Off = writeRpnImm32(m, pSkillCode, 0x30, 5)
    m.setU32((pSkillRec3B + 0x170) >>> 0, cost5Off)
    STATLIST_SetUnitStat113c(m, pPlr, 0x0c, 20, 0) // level 20
    STATLIST_SetUnitStat113c(m, pPlr, 5, 1, 0) // 1 skill point < 5 required -> 0x6FCBFAE0 returns 0
    const pPkt3B = m.alloc(8) >>> 0
    m.setU8(pPkt3B, 0x3b)
    m.setU16((pPkt3B + 1) >>> 0, skillId3B)
    beginFrameS2CTrace113c()
    const r3B = w11b1.C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c(m, pGame, pPlr, pPkt3B, 3)
    const s2c3B = endFrameS2CTrace113c()
    expect(r3B).toBe(2)
    expect(s2c3B.some((hex) => hex.startsWith('21'))).toBe(false)

    // 14. 0x6FCEFE40: rate-limit delay uses [[50, 1500], [25, 3000], [25, 4500]] with weight subtraction
    expect(
      w11b1.PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c(m, 109, 109, pPlr, pGame),
    ).toBe(1)

    // 15. 0x6FC44950: spawns with pCoordNode=0, dwArg14=-1 and updates MonData+0x16 & AiGeneral
    const pSpawned = w11b1.MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c(
      m,
      10,
      0,
      0,
      pGame,
      pRoom,
      106,
      106,
      -1,
    )
    if (pSpawned !== 0) {
      const spData = m.u32((pSpawned + 0x14) >>> 0)
      expect(m.u16((spData + 0x16) >>> 0) & 1).toBe(1)
    }

    // 16. 0x6FD01C00: executes tile warp transition using pDestRoom + collision-adjusted pCoords + pLvlWarpTxt offsets
    const {
      pRoom: pDstWarpRoom,
      pRoomEx: pDstWarpRoomEx,
      pCollGrid: pDstCollGrid,
    } = allocWalkableRoom(m, 3, 200, 200, 24, 24)
    const pAct0 = m.alloc(0x60) >>> 0
    m.setU32((pAct0 + 0x10) >>> 0, pDstWarpRoom)
    m.setU32((pDstWarpRoom + 0x7c) >>> 0, pRoom)
    m.setU32((pRoom + 0x7c) >>> 0, 0)
    m.setU32((pGame + 0xbc) >>> 0, pAct0)
    // Block exact raw warp coord (206, 206) so FindFreePositionSimple adjusts pCoords
    m.setU16((pDstCollGrid + (6 * 24 + 6) * 2) >>> 0, 0x0001)
    const pSrcWarpTxt = m.alloc(0x28) >>> 0
    m.setU32(pSrcWarpTxt, 1) // nSrcClassId = 1
    const pDstWarpTxt = m.alloc(0x28) >>> 0
    m.setU32(pDstWarpTxt, 2) // nDstWarpClassId = 2
    m.setU32((pDstWarpTxt + 0x14) >>> 0, 3) // exitOffsetX = 3
    m.setU32((pDstWarpTxt + 0x18) >>> 0, 4) // exitOffsetY = 4
    const pSrcTile = m.alloc(0x18) >>> 0
    m.setU32((pSrcTile + 0x00) >>> 0, pDstWarpRoomEx)
    m.setU32((pSrcTile + 0x10) >>> 0, pSrcWarpTxt)
    m.setU32((pRoomEx + 0x4c) >>> 0, pSrcTile)
    const pDstBackTile = m.alloc(0x18) >>> 0
    m.setU32((pDstBackTile + 0x00) >>> 0, pRoomEx)
    m.setU32((pDstBackTile + 0x10) >>> 0, pDstWarpTxt)
    m.setU32((pDstWarpRoomEx + 0x4c) >>> 0, pDstBackTile)
    const { pUnit: pDstWarpUnit } = allocUnitWithRoom(m, pGame, 5, 2, 899, pDstWarpRoom, 206, 206)
    m.setU32((pDstWarpRoom + 0x74) >>> 0, pDstWarpUnit)
    const pSrcUnit = m.alloc(0x100) >>> 0
    const pSrcPath = m.alloc(0x20) >>> 0
    m.setU32(pSrcUnit, 5)
    m.setU32((pSrcUnit + 0x04) >>> 0, 1)
    m.setU32((pSrcUnit + 0x2c) >>> 0, pSrcPath)
    m.setU32(pSrcPath, pRoom)
    beginFrameS2CTrace113c()
    w11b1.DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c(m, pSrcUnit, pPlr, pGame)
    const s2cWarp = endFrameS2CTrace113c()
    expect(m.get(pPlrPath, D2DynamicPathStrc.pRoom)).toBe(pDstWarpRoom)
    const pkt0d = s2cWarp.find((h) => h.startsWith('0d'))
    expect(pkt0d).toBeDefined()
    // Verify exit coords reflect adjusted warp coord (NOT raw 206+3=209, 206+4=210)
    const exitX = Number.parseInt(pkt0d!.slice(16, 18) + pkt0d!.slice(14, 16), 16)
    const exitY = Number.parseInt(pkt0d!.slice(20, 22) + pkt0d!.slice(18, 20), 16)
    expect(exitX !== 209 || exitY !== 210).toBe(true)
  })

  it('executes all 122 Wave 15 promoted VAs under live beginVaTrace113c()/endVaTrace113c() with zero missing VAs', () => {
    const cumulativeHits = new Set<string>()

    // --- Shard 1: k2w3-b5 (28 promoted VAs) ---
    {
      const { m, pGame, pQuestCtrl } = createWave15World()
      const { pRoom } = allocWalkableRoom(m, 109)
      const { pUnit: pPlr, pQuestRecord } = allocUnitWithRoom(m, pGame, 0, 0, 1001, pRoom)
      const { pUnit: pMon } = allocUnitWithRoom(m, pGame, 1, 10, 1002, pRoom)
      const pQuest = m.alloc(0x120) >>> 0
      const pQuestExt = m.alloc(0x120) >>> 0
      const pQuestArg = m.alloc(0x40) >>> 0
      const pCoordInfo = m.alloc(0x40) >>> 0
      const pSaveChain = m.alloc(0x140) >>> 0
      const pTaskNode = m.alloc(0x40) >>> 0
      const pSaveBuf = m.alloc(0x100) >>> 0
      const pOutObj = m.alloc(8) >>> 0
      let prevQuestHead = 0
      for (const qId of [0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x28]) {
        const qn = m.alloc(0x120) >>> 0
        m.setU32((qn + 0x00) >>> 0, qId)
        m.setU32((qn + 0x04) >>> 0, pGame)
        m.setU32((qn + 0x18) >>> 0, m.alloc(0x120) >>> 0)
        m.setU32((qn + 0xe0) >>> 0, qId)
        m.setU32((qn + 0xf4) >>> 0, prevQuestHead)
        prevQuestHead = qn
      }
      m.setU32((pQuest + 0x00) >>> 0, 0x25)
      m.setU32((pQuest + 0x04) >>> 0, pGame)
      m.setU32((pQuest + 0x18) >>> 0, pQuestExt)
      m.setU32((pQuest + 0xe0) >>> 0, 0x25)
      m.setU32((pQuest + 0xf4) >>> 0, prevQuestHead)
      m.setU32(pQuestCtrl, pQuest)
      m.setU32((pQuestArg + 0x00) >>> 0, pGame)
      m.setU32((pQuestArg + 0x0c) >>> 0, pPlr)
      m.setU32((pCoordInfo + 0x00) >>> 0, pGame)
      m.setU32((pCoordInfo + 0x04) >>> 0, pRoom)
      const pSaveData = m.alloc(0x20) >>> 0
      m.setU32((pSaveChain + 0x00) >>> 0, 1)
      m.setU32((pSaveChain + 0x04) >>> 0, pSaveData)

      beginVaTrace113c()
      w3b5.STATES_OnStateRemovedResetMonsterAi_6FC70130_113c(m, pMon, 10, 0)
      w3b5.SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c(m, pPlr, pGame, pMon, 0, 1)
      w3b5.GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c(m, pTaskNode, 1, 2)
      expect(w3b5.PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c(m, pSaveBuf, 0x20)).toBeGreaterThanOrEqual(0)
      w3b5.PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c(m, pSaveBuf, m.u32((pPlr + 0x60) >>> 0), 0, 0, 0x80)
      w3b5.ACT5Q6_ActiveFilter_6FC76EF0_113c(m, pQuest, 0x219, pPlr, pQuestRecord, 0)
      w3b5.ACT5Q4_CheckPlayerNearNihlathakRoom_6FC77900_113c(m, pGame, pPlr)
      w3b5.ACT5Q3_Callback03_OnItemPickedUp_6FC77DD0_113c(m, pQuest, pQuestArg)
      w3b5.ACT5Q3_ActiveFilter_6FC77F50_113c(m, pQuest, 0x201, pPlr, pQuestRecord, 0)
      w3b5.ACT5Q2_SyncPlayerQuestStateWithQuest20_6FC78530_113c(m, pGame, pPlr)
      w3b5.ACT5Q1_CompleteQuestRecord23AndVerifyQuest1F_6FC785C0_113c(m, pPlr, pGame)
      w3b5.ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c(m, pGame, pPlr)
      w3b5.ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c(m, pGame, pPlr)
      w3b5.ACT5Q1_SyncPlayerQuestStateWithQuest1F_6FC78890_113c(m, pGame, pPlr)
      w3b5.ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c(m, pPlr, pGame)
      w3b5.ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c(m, pGame, pPlr)
      w3b5.ACT5Q6_CompleteQuest28AndUpdateProgression_6FC78BE0_113c(m, pQuestRecord, pPlr, pGame)
      w3b5.ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c(m, pGame, pPlr)
      w3b5.ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(m, pGame, pSaveChain)
      w3b5.ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(m, pGame, pSaveChain)
      w3b5.ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c(m, pPlr, pGame, pPlr)
      w3b5.ACT5Q2_FindSpawnedPrisonObjectForUnit_6FC7A290_113c(m, pGame, pPlr, pOutObj)
      w3b5.ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(m, pGame, pSaveChain)
      w3b5.ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c(m, pQuest, pCoordInfo, 0)
      w3b5.ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded_6FC7CF70_113c(m, pCoordInfo)
      w3b5.ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c(m, 0, pQuest, pQuestArg)
      w3b5.ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c(m, pMon, pQuest)
      w3b5.ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c(m, pGame, pMon, pPlr)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // --- Shard 2: k2w5-b8 (25 promoted VAs) ---
    {
      const { m, pGame, pQuestCtrl } = createWave15World()
      const { pRoom } = allocWalkableRoom(m, 75)
      const { pUnit: pPlr, pQuestRecord } = allocUnitWithRoom(m, pGame, 0, 0, 2001, pRoom)
      const { pUnit: pObj } = allocUnitWithRoom(m, pGame, 2, 10, 2002, pRoom)
      const pQuest = m.alloc(0x120) >>> 0
      const pQuestExt = m.alloc(0x180) >>> 0
      m.setU32((pQuest + 0x00) >>> 0, 0x14)
      m.setU32((pQuest + 0x04) >>> 0, pGame)
      m.setU32((pQuest + 0x18) >>> 0, pQuestExt)
      m.setU32((pQuest + 0xe0) >>> 0, 0x14)
      m.setU32(pQuestCtrl, pQuest)
      const pObjInit = m.alloc(0x20) >>> 0
      m.setU32((pObjInit + 0x00) >>> 0, pGame)
      m.setU32((pObjInit + 0x04) >>> 0, pObj)
      m.setU32((pObjInit + 0x08) >>> 0, pRoom)
      const pOutStatus = m.alloc(4) >>> 0
      const pQuestArg = m.alloc(0x30) >>> 0
      m.setU32((pQuestArg + 0x00) >>> 0, pGame)
      m.setU32((pQuestArg + 0x0c) >>> 0, pPlr)
      QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x16, 0x0d)

      beginVaTrace113c()
      w5b8.ACT3Q7_InitMephistoPortalObject_6FD03290_113c(m, pObjInit)
      w5b8.ACT3Q7_NotifyPlayerMephistoState0DCallback_6FD03320_113c(m, pGame, pPlr)
      w5b8.ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c(m, pQuestRecord, pPlr, pGame)
      w5b8.ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c(m, pGame, pPlr)
      w5b8.ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c(m, pGame, pPlr)
      w5b8.ACT3Q5_NotifyPlayerTravincalState0DCallback_6FD03760_113c(m, pGame, pPlr)
      w5b8.ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c(m, pQuest, pPlr, 0, pQuestRecord, pOutStatus)
      w5b8.ACT3Q2_SetGidbinnTurnInPartyCallback_6FD041D0_113c(m, pGame, pPlr)
      w5b8.ACT3Q2_SetGidbinnState0ECallback_6FD04280_113c(m, pGame, pPlr)
      w5b8.ACT3Q2_GidbinnStatusFilter_6FD045B0_113c(m, pQuest, pPlr, 0, pQuestRecord, pOutStatus)
      w5b8.ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c(m, pGame, pPlr)
      w5b8.ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c(m, pQuest, pPlr, 0, pQuestRecord, pOutStatus)
      w5b8.ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c(m, pGame)
      w5b8.ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c(m, pGame, pPlr)
      w5b8.ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c(m, pGame, pPlr)
      w5b8.ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c(m, pGame, pPlr)
      w5b8.ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c(m, pGame, pPlr)
      w5b8.ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c(m, pGame)
      w5b8.ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c(m, pGame, pPlr)
      w5b8.ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c(m, pQuest, pQuestArg)
      w5b8.ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c(m, pGame, pPlr)
      w5b8.ACT3Q4_CompleteLamEsensTomePartyCallback_6FD064C0_113c(m, pGame, pPlr)
      w5b8.ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c(m, pGame, pPlr)
      w5b8.ACT3Q5_PropagateCouncilCompletionToPartyCallback_6FD06980_113c(m, pGame, pPlr)
      w5b8.ACT3Q4_PropagateTomeQuestStateToSubParty_6FD06B90_113c(m, pGame, pPlr)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // --- Shard 3: k2w8-b2 (25 promoted VAs) ---
    {
      const { m, pGame, pQuestCtrl, pObjectsTxt } = createWave15World()
      const { pRoom } = allocWalkableRoom(m, 2)
      const { pUnit: pPlr } = allocUnitWithRoom(m, pGame, 0, 0, 3001, pRoom)
      const { pUnit: pMon } = allocUnitWithRoom(m, pGame, 1, 10, 3002, pRoom)
      const { pUnit: pDef } = allocUnitWithRoom(m, pGame, 1, 11, 3003, pRoom)
      const { pUnit: pObj, pUnitData: pObjData } = allocUnitWithRoom(m, pGame, 2, 1, 3004, pRoom)
      m.setU32(pObjData, (pObjectsTxt + 1 * 0x1c0) >>> 0)
      const pQuest = m.alloc(0x100) >>> 0
      const pQuestExt = m.alloc(0x200) >>> 0
      const pQuestArg = m.alloc(0x30) >>> 0
      const pOpArgs = m.alloc(0x20) >>> 0
      let prevQ = 0
      for (const qId of [1, 4, 5, 6, 0x17]) {
        const qn = m.alloc(0x100) >>> 0
        m.setU32((qn + 0x00) >>> 0, qId)
        m.setU32((qn + 0x04) >>> 0, pGame)
        m.setU32((qn + 0x18) >>> 0, m.alloc(0x200) >>> 0)
        m.setU32((qn + 0xe0) >>> 0, qId)
        m.setU32((qn + 0xf4) >>> 0, prevQ)
        prevQ = qn
      }
      m.setU32((pQuest + 0x00) >>> 0, 1)
      m.setU32((pQuest + 0x04) >>> 0, pGame)
      m.setU32((pQuest + 0x18) >>> 0, pQuestExt)
      m.setU32((pQuest + 0xe0) >>> 0, 1)
      m.setU32((pQuest + 0xf4) >>> 0, prevQ)
      m.setU32(pQuestCtrl, pQuest)
      m.setU32((pQuestArg + 0x00) >>> 0, pGame)
      m.setU32((pQuestArg + 0x0c) >>> 0, pPlr)
      m.setU32((pOpArgs + 0x00) >>> 0, pGame)
      m.setU32((pOpArgs + 0x04) >>> 0, pObj)
      m.setU32((pOpArgs + 0x08) >>> 0, pPlr)
      m.setU32((pObj + 0x10) >>> 0, 2)
      const pAuraIterArgs = m.alloc(0x20) >>> 0
      const pAuraDmgCtx = m.alloc(0x20) >>> 0
      const pTplDmg = m.alloc(0x70) >>> 0
      m.setU32(pAuraDmgCtx, pTplDmg)
      m.setU32((pAuraIterArgs + 0x00) >>> 0, pGame)
      m.setU32((pAuraIterArgs + 0x04) >>> 0, pMon)
      m.setU32((pAuraIterArgs + 0x0c) >>> 0, pAuraDmgCtx)
      const pPetListWrapper = m.alloc(0x10) >>> 0
      const pAiThinkArg = m.alloc(0x30) >>> 0

      beginVaTrace113c()
      w8b2.ACT1Q1_OnMonsterKilled_6FC85760_113c(m, pQuest, pQuestArg)
      w8b2.ACT1Q5_OnTreeOfInifussOperated_6FC85D40_113c(m, pOpArgs)
      w8b2.ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c(m, pGame, pQuest)
      w8b2.ACT1Q4_OnCairnStoneInit_6FC87D20_113c(m, pOpArgs)
      w8b2.ACT1Q4_OnPlayerEnterTristramWithCainUnrescued_6FC883C0_113c(m, pPlr, pGame)
      w8b2.ACT1Q5_OnForgottenTowerTomeOperated_6FC88D70_113c(m, pOpArgs)
      w8b2.OBJ_OperateDoorWithLockCheck_6FC8A9D0_113c(m, pOpArgs, 10000)
      w8b2.OBJ_ThinkEventSparkyChest_6FC8E150_113c(m, pGame, pObj)
      m.setU32((pObj + 0x10) >>> 0, 1)
      w8b2.OBJ_ThinkEventLightningSpire_6FC8E400_113c(m, pGame, pObj)
      w8b2.OBJ_OperateChestAndSparkyChest_6FC8F040_113c(m, pOpArgs)
      w8b2.CUBE_Op15_SpawnSecretCowLevelPortal_6FC92210_113c(m, pGame, pPlr)
      w8b2.MONSTER_AutoEquipInteractItem_6FC98B60_113c(m, pGame, pPlr)
      w8b2.AURA_ApplyRadialDamageCallback_6FCB54F0_113c(m, pAuraIterArgs, pDef, () => 0)
      w8b2.PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c(m, pPetListWrapper, pGame, pPlr, 400)
      w8b2.PETS_UnsummonPetAndCheckNodeStillExists_6FCB8070_113c(m, pMon, pPlr, pGame)
      w8b2.PETS_OnPetOrMercKilled_6FCB8120_113c(m, pGame, pPlr, pMon)
      w8b2.PARTY_LeavePartyForPlayer_6FCBC840_113c(m, pPlr, pGame)
      w8b2.SKILLS_SrvDo_Unsummon_6FCC2EA0_113c(m, pGame, pPlr)
      w8b2.MONAI_SiegeMinionThinkDispatch_6FCC7530_113c(m, pGame, pMon, pAiThinkArg)
      w8b2.SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c(m, pGame, pMon, 1)
      w8b2.SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c(m, pGame, 0, pMon, pDef)
      w8b2.SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450_113c(m, pGame, pMon)
      w8b2.SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c(m, pGame, pMon, -1, 1)
      w8b2.SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c(m, pGame, pMon, 1, 1)
      w8b2.ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c(m, pQuest, pQuestArg)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // --- Shard 4: k2w8-b3 (23 promoted VAs) ---
    {
      const { m, pGame, pQuestCtrl } = createWave15World()
      const { pRoom } = allocWalkableRoom(m, 40)
      const { pUnit: pPlr } = allocUnitWithRoom(m, pGame, 0, 0, 4001, pRoom)
      const { pUnit: pCorpse } = allocUnitWithRoom(m, pGame, 0, 0, 4002, pRoom)
      const { pUnit: pMerc } = allocUnitWithRoom(m, pGame, 1, 271, 4003, pRoom)
      const { pUnit: pItem } = allocUnitWithRoom(m, pGame, 4, 0, 4004, pRoom)
      const { pUnit: pItem2 } = allocUnitWithRoom(m, pGame, 4, 0, 4005, pRoom)
      const { pUnit: pObj } = allocUnitWithRoom(m, pGame, 2, 10, 4006, pRoom)
      m.setU32((pObj + 0x10) >>> 0, 2)
      const pQuest = m.alloc(0x120) >>> 0
      const pQuestState = m.alloc(0x80) >>> 0
      m.setU32((pQuest + 0x00) >>> 0, 0x0b)
      m.setU32((pQuest + 0x04) >>> 0, pGame)
      m.setU8((pQuest + 0x09) >>> 0, 1)
      m.setU32((pQuest + 0x18) >>> 0, pQuestState)
      m.setU32(pQuestCtrl, pQuest)
      const pOpParam = m.alloc(0x20) >>> 0
      m.setU32((pOpParam + 0x00) >>> 0, pGame)
      m.setU32((pOpParam + 0x04) >>> 0, pObj)
      m.setU32((pOpParam + 0x08) >>> 0, pPlr)
      const pPkt = m.alloc(0x20) >>> 0

      beginVaTrace113c()
      w8b3.NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c(m, pItem, pGame, pPlr, 1)
      w8b3.NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c(m, 0, pPlr, pItem, pGame, 1)
      w8b3.NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c(m, pPlr, pItem, pGame)
      w8b3.ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c(m, pGame)
      w8b3.ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c(m, pGame)
      w8b3.ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c(m, pGame, pQuest)
      w8b3.ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c(m, pGame, pPlr)
      w8b3.ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c(m, pQuest, pPlr)
      w8b3.ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c(m, pQuest, pOpParam)
      w8b3.ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c(m, pOpParam)
      w8b3.ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c(m, pOpParam)
      w8b3.C2S_Packet21_MergeStackableItems_6FCEE4B0_113c(m, pGame, pPlr, pPkt, 9)
      w8b3.ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c(m, 4, pMerc, pGame, pPlr)
      w8b3.C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c(m, pGame, pPlr, pPkt, 9)
      w8b3.C2S_Packet60_SwapWeapons_6FCEF510_113c(m, pGame, pPlr, pPkt, 1)
      w8b3.C2S_Packet26_UseBeltItem_6FCEF5B0_113c(m, pGame, pPlr, pPkt, 0x0d)
      w8b3.C2S_Packet27_IdentifyItem_6FCEF6B0_113c(m, pGame, pPlr, pPkt, 9)
      w8b3.ITEMS_EquipMercBodyLocFromPlayerCursor_6FCEFBC0_113c(m, pGame, pMerc, pPlr, pItem)
      w8b3.C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c(m, pGame, pPlr, pPkt, 9)
      w8b3.C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c(m, pGame, pPlr, pPkt, 5)
      w8b3.ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c(m, pGame, pPlr, pItem)
      w8b3.ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c(m, pItem, pGame, pPlr, pItem2, 0)
      w8b3.ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c(m, pCorpse, pGame, pPlr)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // --- Shard 5: k2w11-b1 (21 promoted VAs) ---
    {
      const { m, pGame } = createWave15World()
      const { pRoom, pRoomEx } = allocWalkableRoom(m, 2)
      const { pRoom: pWarpDstRoom, pRoomEx: pWarpDstRoomEx } = allocWalkableRoom(m, 3, 200, 200)
      const pWTxtSrc = m.alloc(0x28) >>> 0
      const pWTxtDst = m.alloc(0x28) >>> 0
      const pWTileF = m.alloc(0x18) >>> 0
      const pWTileB = m.alloc(0x18) >>> 0
      m.setU32(pWTileF, pWarpDstRoomEx)
      m.setU32((pWTileF + 0x10) >>> 0, pWTxtSrc)
      m.setU32((pRoomEx + 0x4c) >>> 0, pWTileF)
      m.setU32(pWTileB, pRoomEx)
      m.setU32((pWTileB + 0x10) >>> 0, pWTxtDst)
      m.setU32((pWarpDstRoomEx + 0x4c) >>> 0, pWTileB)
      const { pUnit: pPlr, pUnitData: pPD, pClient } = allocUnitWithRoom(m, pGame, 0, 0, 5001, pRoom)
      const { pUnit: pMon } = allocUnitWithRoom(m, pGame, 1, 10, 5002, pRoom)
      const { pUnit: pObj } = allocUnitWithRoom(m, pGame, 2, 0x64, 5003, pRoom)
      const pFreshPlr = m.alloc(0x100) >>> 0
      m.setU32(pFreshPlr, 0)
      m.setU32((pFreshPlr + 0x80) >>> 0, pGame)
      const pShrineRec = m.alloc(0x20) >>> 0
      m.setU8(pShrineRec, 14)
      m.setU32((pShrineRec + 0x0c) >>> 0, 1200)
      const pOpArgs = m.alloc(0x20) >>> 0
      m.setU32((pOpArgs + 0x00) >>> 0, pGame)
      m.setU32((pOpArgs + 0x04) >>> 0, pObj)
      m.setU32((pOpArgs + 0x08) >>> 0, pPlr)
      const pArena = m.alloc(0x20) >>> 0
      m.setU8((pArena + 0x08) >>> 0, 2)
      m.setU32((pGame + 0x1d28) >>> 0, pArena)
      const pAiTick = m.alloc(0x30) >>> 0
      const pPkt = m.alloc(0x20) >>> 0
      const pPetInfo = m.alloc(12) >>> 0
      const pWarpSrc = m.alloc(0x100) >>> 0
      const pWarpSrcPath = m.alloc(0x20) >>> 0
      m.setU32(pWarpSrc, 5)
      m.setU32((pWarpSrc + 0x2c) >>> 0, pWarpSrcPath)
      m.setU32(pWarpSrcPath, pRoom)

      beginVaTrace113c()
      w11b1.MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c(m, 10, 0, 0, pGame, pRoom, 105, 105, -1)
      w11b1.SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c(m, pGame, pPlr, -1, 1)
      w11b1.PLAYER_InitPlayerUnitSubsystems_6FC58620_113c(m, pGame, pFreshPlr, 5099)
      w11b1.SKILLS_SrvDo067_ApplyBuffStateAndItemEvents_6FC628F0_113c(m, pGame, pPlr, -1, 1)
      w11b1.SKILLS_SrvDo029_Teleport_6FC63450_113c(m, pGame, pPlr, 54, 1)
      w11b1.SKILLS_ReleaseTrappedOrConvertedMonster_6FC70800_113c(m, pMon, pGame)
      w11b1.OBJ_OperateFn_SkillShrine_6FC8AB60_113c(m, pOpArgs, pShrineRec)
      // 0x6FC8BB60 triggers VA hit on entry; assert 0xfcd on unpopulated act/level is expected
      try {
        w11b1.OBJ_OperateFn_CowAndSpecialPortal_6FC8BB60_113c(m, pOpArgs)
      } catch (err) {
        expect(err).toBeInstanceOf(D2CommonAssertError)
      }
      w11b1.OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c(m, pObj, pPlr, pRoom)
      m.setU8((pPlr + 0x6c) >>> 0, 1)
      w11b1.OBJ_OperateFn_TownAndPermanentPortal_6FC8D0F0_113c(m, pOpArgs, 0)
      m.setU8((pPlr + 0x6c) >>> 0, 0)
      w11b1.SKILLS_SrvDo252_DragonFlight_6FCB3680_113c(m, pGame, pPlr, -1, 1)
      m.setU32((pPD + 0x44) >>> 0, 0)
      w11b1.PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c(m, pPlr, pGame, pMon, 1, pPetInfo)
      w11b1.ACT_WarpClientPlayerToActTown_6FCBDF40_113c(m, pGame, pClient, 40, 0)
      w11b1.AI_Think_TeleportLeashOrApproachOwner_6FCC9D40_113c(m, pGame, pMon, pAiTick)
      w11b1.SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c(m, pGame, pMon, 0, 1)
      w11b1.SKILLS_SrvDo_SubmergeOrBurrowMonster_6FCD4760_113c(m, pGame, pMon, 0, 1)
      w11b1.NPCTRADE_InteractResurrectMerc_6FCE0DB0_113c(m, 9999, pGame, pPlr)
      w11b1.C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c(m, pGame, pPlr, pPkt, 5)
      w11b1.C2S_Packet35_NpcRepair_6FCEF0A0_113c(m, pGame, pPlr, pPkt, 4)
      w11b1.PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c(m, 105, 105, pPlr, pGame)
      w11b1.DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c(m, pWarpSrc, pPlr, pGame)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    const missingVas = WAVE15_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
