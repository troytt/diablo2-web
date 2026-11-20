/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite
 * (Wave 19 — `indirectUnknown` Batch A: 63 VAs across 29 disjoint TS files).
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode, byte size, and `0xFF`
 *    indirect-call opcode checks for all 63 VAs (72 indirect sites) in `D2Game.dll`.
 * 2. Complete schema & cross-reference validation of `tools/oracle/callgraph/indirect-audit-batchA.json`
 *    against `manifest-113c.json` and `dispatch-tables-113c.json`.
 * 3. Targeted differential regression tests proving every real 1.13c bug fixed in Wave 19.
 * 4. 100% (`63 / 63`) live `beginVaTrace113c()` / `endVaTrace113c()` execution coverage.
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
import { QUESTRECORD_AllocRecord113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import { MISSILE_GetRemainingFrames113c } from '../../../src/d2kern-113c/common/missile.ts'
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATLIST_CreateEx113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { QUESTS_TriggerCallback113c } from '../../../src/d2kern-113c/game/a1c-post150-f150-f276-113c.ts'
import {
  D2GAME_PLRMODES_DispatchModeSyncToClient113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-b-113c.ts'
import { AURA_ForEachUnitInRadius113c } from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c.ts'
import {
  MISSILE_CreateServerProjectile113c,
  MISSILE_DispatchFrameTick113c,
  MISSILE_ProcessTargetCollisionHit113c,
} from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c.ts'
import { MONUMOD_ApplyToMinionCallback113c } from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts'
import { AIGENERAL_ForEachPackMember_6FC41490_113c } from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c.ts'
import { QUESTS_RefreshInventoryQuestItems_6FC54760_113c } from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c.ts'
import { MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c } from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c.ts'
import { MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c } from '../../../src/d2kern-113c/game/k2-w2b1-113c.ts'
import { SKILLS_DispatchSrvDoFunc_6FCBE420_113c } from '../../../src/d2kern-113c/game/k2-w2b4-113c.ts'
import { MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c } from '../../../src/d2kern-113c/game/k2-w2b5-113c.ts'
import {
  MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c,
  OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c,
  OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c,
  OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c.ts'
import {
  QUESTS_AllocAndInitGameQuests_6FC548A0_113c,
  QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c,
  QUESTS_SendQuestLogPackets50And52_6FC55640_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c.ts'
import {
  ACT5Q1_SeqFilter_6FC76D10_113c,
  ACT5Q4_SeqFilter_6FC76B10_113c,
  ACT5Q5_SeqFilter_6FC76BD0_113c,
  ACT5Q6_SeqFilter_6FC767A0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b5-113c.ts'
import {
  QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c,
  QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b6-113c.ts'
import {
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
  PETS_ForEachPlayerPetUnit_6FCB6AF0_113c,
  SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c.ts'
import {
  MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c,
  MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c.ts'
import { ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c } from '../../../src/d2kern-113c/game/k2-w4b8-113c.ts'
import {
  AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c,
  ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c,
  SKILLS_ForEachUnitNearTargetCoords_6FCC06F0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b3-113c.ts'
import {
  ACT2Q1_SeqFilter_6FCE24A0_113c,
  ACT2Q3_SeqFilter_6FCE21E0_113c,
  ACT2Q4_ChainSeqFilter_6FCE1FF0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b4-113c.ts'
import {
  QUESTS_ChainStatusFilterNotState5_6FD02F00_113c,
  QUESTS_ChainStatusFilterNotState7_6FD02A40_113c,
  QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c,
  QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c,
  QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c,
  SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b7-113c.ts'
import { PARTY_DispatchRelationAction_6FD10A70_113c } from '../../../src/d2kern-113c/game/k2-w5b9-113c.ts'
import {
  AITARGET_FindBestHostileTargetTether75_6FCD7090_113c,
  AITARGET_FindBestHostileTarget_6FCC4610_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c.ts'
import { PLAYER_LevelUp_6FD0B090_113c } from '../../../src/d2kern-113c/game/k2-w6b6-113c.ts'
import {
  AI_Think_CainAndAnyaPrisonPortal_6FC3BF60_113c,
  STORM_TSHashTableInsertOrCreateNode_6FC22090_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c.ts'
import {
  ACT1Q2_ActivateOrChainQuest_6FC84E10_113c,
  ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c,
  ACT1Q4_ActivateOrChainQuest_6FC846D0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c.ts'
import {
  ACT2Q3_SeqCallback_6FCE6390_113c,
  ACT4Q1_SeqCallback_6FCDA270_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c.ts'
import {
  ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c,
  ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c,
} from '../../../src/d2kern-113c/game/k2-w8b3-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  AITARGET_IterateRoomActiveClients113c,
  PLAYER_StepAnimationModeTick113c,
  QUESTS_CheckNpcQuestInteractAlert113c,
  QUESTS_StepQuestTimers113c,
  registerK4QuestNpcAlertDispatcher113c,
} from '../../../src/d2kern-113c/game/town-runtime-gap-113c.ts'
import {
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  PATH_TYPE_FLAGS_6FDE4180,
  PATH_TYPE_STEP_NUMS_6FDE4138,
} from '../../../src/d2kern-113c/common/path.ts'
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
const DISPATCH_TABLES_PATH = path.join(REPO_ROOT, 'tools/oracle/callgraph/dispatch-tables-113c.json')
const AUDIT_BATCH_A_PATH = path.join(REPO_ROOT, 'tools/oracle/callgraph/indirect-audit-batchA.json')
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data')

const ALLOWED_KERN_FILES = new Set([
  'src/d2kern-113c/game/a1c-post150-f150-f276-113c.ts',
  'src/d2kern-113c/game/town-runtime-gap-113c.ts',
  'src/d2kern-113c/game/boot-init-gap-b-113c.ts',
  'src/d2kern-113c/game/k2-items-tc-w1-113c.ts',
  'src/d2kern-113c/game/k2-gap-melee-dot-113c.ts',
  'src/d2kern-113c/game/k2-gap-itemdef-113c.ts',
  'src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c.ts',
  'src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c.ts',
  'src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c.ts',
  'src/d2kern-113c/game/k2-w2b1-113c.ts',
  'src/d2kern-113c/game/k2-w2b4-113c.ts',
  'src/d2kern-113c/game/k2-w2b5-113c.ts',
  'src/d2kern-113c/game/k2-w3b2-113c.ts',
  'src/d2kern-113c/game/k2-w3b3-113c.ts',
  'src/d2kern-113c/game/k2-w3b5-113c.ts',
  'src/d2kern-113c/game/k2-w3b6-113c.ts',
  'src/d2kern-113c/game/k2-w4b5-113c.ts',
  'src/d2kern-113c/game/k2-w4b7-113c.ts',
  'src/d2kern-113c/game/k2-w4b8-113c.ts',
  'src/d2kern-113c/game/k2-w5b3-113c.ts',
  'src/d2kern-113c/game/k2-w5b4-113c.ts',
  'src/d2kern-113c/game/k2-w5b7-113c.ts',
  'src/d2kern-113c/game/k2-w5b9-113c.ts',
  'src/d2kern-113c/game/k2-w6b5-113c.ts',
  'src/d2kern-113c/game/k2-w6b6-113c.ts',
  'src/d2kern-113c/game/k2-w7b1-113c.ts',
  'src/d2kern-113c/game/k2-w7b2-113c.ts',
  'src/d2kern-113c/game/k2-w7b3-113c.ts',
  'src/d2kern-113c/game/k2-w8b3-113c.ts',
])

interface Pe32FnSpec {
  readonly va: number
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly ivas: readonly number[]
}

const WAVE19_INDA_PE32_SPECS: readonly Pe32FnSpec[] = [
  { va: 0x6FC22090, size: 147, headHex: '8b572453558b6c24', tailHex: '5bc20c00', ivas: [0x6FC220CA] },
  { va: 0x6FC3BF60, size: 636, headHex: '83ec0c53568bf285', tailHex: '0cc20400', ivas: [0x6FC3C06A, 0x6FC3C0CA, 0x6FC3C188] },
  { va: 0x6FC41490, size: 244, headHex: '558b6c240c56538b', tailHex: '14feffcc', ivas: [0x6FC41556] },
  { va: 0x6FC41840, size: 23, headHex: '8b049550e5d26f85', tailHex: '5ec20400', ivas: [0x6FC41851] },
  { va: 0x6FC432B0, size: 101, headHex: '558b6c240885ed74', tailHex: '5dc20800', ivas: [0x6FC4330E] },
  { va: 0x6FC446D0, size: 455, headHex: '83ec388b54244453', tailHex: '38c21400', ivas: [0x6FC44863, 0x6FC44883] },
  { va: 0x6FC4E830, size: 119, headHex: '81fe3d0200007f05', tailHex: '5fc21400', ivas: [0x6FC4E89C] },
  { va: 0x6FC517F0, size: 845, headHex: '83ec28538b5c2440', tailHex: '28c22000', ivas: [0x6FC5198A] },
  { va: 0x6FC51B40, size: 733, headHex: '83ec3056578b7c24', tailHex: '30c21c00', ivas: [0x6FC51C67] },
  { va: 0x6FC53B70, size: 256, headHex: '53558b6c240c8b9d', tailHex: 'edfcffcc', ivas: [0x6FC53BE5] },
  { va: 0x6FC53CE0, size: 172, headHex: '8b078b80f4100000', tailHex: 'ecfcffcc', ivas: [0x6FC53D55] },
  { va: 0x6FC54760, size: 256, headHex: '83ec1c53558b6c24', tailHex: 'e1fcffcc', ivas: [0x6FC54809] },
  { va: 0x6FC548A0, size: 506, headHex: '83ec08a168dfd26f', tailHex: 'dffcffcc', ivas: [0x6FC54940, 0x6FC549DF] },
  { va: 0x6FC54EA0, size: 399, headHex: '83ec0885ff53558b', tailHex: 'dafcffcc', ivas: [0x6FC54F87] },
  { va: 0x6FC554F0, size: 335, headHex: '83ec0c53558b6c24', tailHex: '0cc20400', ivas: [0x6FC555E8] },
  { va: 0x6FC55640, size: 577, headHex: '83ec58538b5c2460', tailHex: '58c20800', ivas: [0x6FC55710] },
  { va: 0x6FC5E3F0, size: 282, headHex: '568b74240c85f60f', tailHex: '5ec20800', ivas: [0x6FC5E4EC] },
  { va: 0x6FC5EDE0, size: 820, headHex: '83ec7c53558bac24', tailHex: '7cc20c00', ivas: [0x6FC5EFC8, 0x6FC5F045, 0x6FC5F099] },
  { va: 0x6FC68410, size: 212, headHex: '8b4c240883ec0c85', tailHex: '0cc20c00', ivas: [0x6FC684AF] },
  { va: 0x6FC767A0, size: 111, headHex: '568bf18a460c3c05', tailHex: '32c05ec3', ivas: [0x6FC76801] },
  { va: 0x6FC76B10, size: 111, headHex: '568bf18a460c3c05', tailHex: '32c05ec3', ivas: [0x6FC76B71] },
  { va: 0x6FC76BD0, size: 111, headHex: '568bf18a460c3c05', tailHex: '32c05ec3', ivas: [0x6FC76C31] },
  { va: 0x6FC76D10, size: 102, headHex: '568bf1807e0c0574', tailHex: '32c05ec3', ivas: [0x6FC76D68] },
  { va: 0x6FC801B0, size: 113, headHex: '568bf18a460c3c02', tailHex: '32c05ec3', ivas: [0x6FC80213] },
  { va: 0x6FC806E0, size: 102, headHex: '568bf1807e0c0574', tailHex: '32c05ec3', ivas: [0x6FC80738] },
  { va: 0x6FC846D0, size: 211, headHex: '81ec80000000568b', tailHex: '000000c3', ivas: [0x6FC84789] },
  { va: 0x6FC84AA0, size: 186, headHex: '81ec80000000568b', tailHex: '000000c3', ivas: [0x6FC84B40] },
  { va: 0x6FC84E10, size: 186, headHex: '81ec80000000568b', tailHex: '000000c3', ivas: [0x6FC84EB0] },
  { va: 0x6FC8F930, size: 1422, headHex: '83ec28558bea894c', tailHex: '83c428c3', ivas: [0x6FC8FE1F] },
  { va: 0x6FC99A10, size: 78, headHex: '55568bf285f68be9', tailHex: '5dc20800', ivas: [0x6FC99A40] },
  { va: 0x6FCB1660, size: 613, headHex: '538b5c241483fb01', tailHex: '5bc21000', ivas: [0x6FCB18BC] },
  { va: 0x6FCB6AF0, size: 259, headHex: '83ec08558b6c2410', tailHex: 'bef6ffcc', ivas: [0x6FCB6B9D] },
  { va: 0x6FCBC160, size: 130, headHex: '558b6c2408578bf8', tailHex: '68f6ffcc', ivas: [0x6FCBC1B4] },
  { va: 0x6FCBE420, size: 37, headHex: '85c07c1e3dbf0000', tailHex: 'd0c20800', ivas: [0x6FCBE440] },
  { va: 0x6FCC06F0, size: 317, headHex: '83ec68558b6c2478', tailHex: '68c21400', ivas: [0x6FCC0809] },
  { va: 0x6FCC0AD0, size: 405, headHex: '8b44241083ec1485', tailHex: '14c21400', ivas: [0x6FCC0C2F] },
  { va: 0x6FCC0C70, size: 521, headHex: '83ec1c578bf885ff', tailHex: '1cc22000', ivas: [0x6FCC0E40] },
  { va: 0x6FCC4610, size: 638, headHex: '8b44241883ec1853', tailHex: '18c21800', ivas: [0x6FCC46FA] },
  { va: 0x6FCCD0F0, size: 431, headHex: '5185ff0f84a00100', tailHex: '59c21000', ivas: [0x6FCCD1C4, 0x6FCCD243] },
  { va: 0x6FCD06F0, size: 43, headHex: '538b5c2408578bf9', tailHex: '5bc20400', ivas: [0x6FCD070D] },
  { va: 0x6FCD0720, size: 131, headHex: '83ec08558b6c2414', tailHex: '08c20800', ivas: [0x6FCD0778] },
  { va: 0x6FCD0CE0, size: 205, headHex: '83ec0885ff558b6c', tailHex: '08c20800', ivas: [0x6FCD0D6F] },
  { va: 0x6FCD11A0, size: 263, headHex: '8b44240883ec1055', tailHex: '17f5ffcc', ivas: [0x6FCD1259] },
  { va: 0x6FCD7090, size: 622, headHex: '8b44241883ec1853', tailHex: '18c21800', ivas: [0x6FCD716A] },
  { va: 0x6FCD8A70, size: 98, headHex: '8bc180780c05740a', tailHex: '32c05ec3', ivas: [0x6FCD8AC6] },
  { va: 0x6FCDA270, size: 183, headHex: '81ec80000000568b', tailHex: '000000c3', ivas: [0x6FCDA30F] },
  { va: 0x6FCE1FF0, size: 80, headHex: '8b4f108b470456e8', tailHex: '32c05ec3', ivas: [0x6FCE2034] },
  { va: 0x6FCE21E0, size: 102, headHex: '568bf1807e0c0574', tailHex: '32c05ec3', ivas: [0x6FCE2238] },
  { va: 0x6FCE24A0, size: 102, headHex: '568bf1807e0c0574', tailHex: '32c05ec3', ivas: [0x6FCE24F8] },
  { va: 0x6FCE6390, size: 187, headHex: '81ec800000005657', tailHex: '000000c3', ivas: [0x6FCE643C] },
  { va: 0x6FCE6B30, size: 366, headHex: '53558bea0fb74518', tailHex: '5e5d5bc3', ivas: [0x6FCE6C33] },
  { va: 0x6FCE6E90, size: 491, headHex: '81ec880000005355', tailHex: '000000c3', ivas: [0x6FCE6FBB, 0x6FCE7024] },
  { va: 0x6FCEB8F0, size: 88, headHex: '85db5657750433f6', tailHex: '5ec20800', ivas: [0x6FCEB941] },
  { va: 0x6FCFE380, size: 539, headHex: '558bec83e4f881ec', tailHex: '44f2ffcc', ivas: [0x6FCFE52C] },
  { va: 0x6FCFFC10, size: 164, headHex: '5185ff558daf2011', tailHex: '2df2ffcc', ivas: [0x6FCFFC4C] },
  { va: 0x6FCFFCC0, size: 250, headHex: '5185ff750768b307', tailHex: '59c20400', ivas: [0x6FCFFD5C] },
  { va: 0x6FD02A40, size: 102, headHex: '568bf1807e0c0774', tailHex: '32c05ec3', ivas: [0x6FD02A98] },
  { va: 0x6FD02B70, size: 196, headHex: '578bf9807f0c0574', tailHex: '00005fc3', ivas: [0x6FD02BB6, 0x6FD02C15] },
  { va: 0x6FD02D40, size: 111, headHex: '568bf18a460c3c05', tailHex: '32c05ec3', ivas: [0x6FD02DA1] },
  { va: 0x6FD02E80, size: 111, headHex: '568bf18a460c3c05', tailHex: '32c05ec3', ivas: [0x6FD02EE1] },
  { va: 0x6FD02F00, size: 102, headHex: '568bf1807e0c0574', tailHex: '32c05ec3', ivas: [0x6FD02F58] },
  { va: 0x6FD0B090, size: 510, headHex: '83ec0885f6535557', tailHex: '08c20400', ivas: [0x6FD0B283] },
  { va: 0x6FD10A70, size: 157, headHex: '5185ffc704240000', tailHex: '59c20800', ivas: [0x6FD10AF7] },
]

interface ManifestFn {
  readonly module: string
  readonly va: string
  readonly name: string
  readonly size: number
  readonly status: string
  readonly kernFile?: string
  readonly tsSymbol?: string
  readonly indirectUnknown?: boolean
}

interface AuditSite {
  readonly iva: string
  readonly insn: string
  readonly category: 'static_table' | 'vtable_or_struct_table' | 'caller_callback'
  readonly tableBase?: string
  readonly tableEnd?: string
  readonly tableName?: string
  readonly structOffset?: string
  readonly targetVas?: readonly string[]
  readonly proof: string
}

interface AuditEntry {
  readonly va: string
  readonly name: string
  readonly kernFile: string
  readonly tsSymbol: string
  readonly bindingShard: string
  readonly indirectSites: readonly AuditSite[]
}

interface AuditFile {
  readonly batch: string
  readonly module: string
  readonly imageBase: string
  readonly totalFunctions: number
  readonly totalIndirectSites: number
  readonly categorySummary: {
    readonly functions: Record<string, number>
    readonly sites: Record<string, number>
  }
  readonly entries: readonly AuditEntry[]
}

function readPeTextMapper(dllPath: string): {
  readonly buf: Buffer
  readonly vaToFileOffset: (va: number) => number
} {
  const buf = fs.readFileSync(dllPath)
  const peOff = buf.readUInt32LE(0x3c)
  expect(buf.toString('ascii', peOff, peOff + 4)).toBe('PE\0\0')
  const numSections = buf.readUInt16LE(peOff + 6)
  const optHeaderSize = buf.readUInt16LE(peOff + 20)
  const imageBase = buf.readUInt32LE(peOff + 24 + 28)
  expect(imageBase).toBe(0x6fc20000)

  const secBase = peOff + 24 + optHeaderSize
  const sections: Array<{ vaddr: number; vsize: number; rawPtr: number; rawSize: number }> = []
  for (let i = 0; i < numSections; i++) {
    const off = secBase + i * 40
    sections.push({
      vsize: buf.readUInt32LE(off + 8),
      vaddr: buf.readUInt32LE(off + 12),
      rawSize: buf.readUInt32LE(off + 16),
      rawPtr: buf.readUInt32LE(off + 20),
    })
  }
  return {
    buf,
    vaToFileOffset: (va: number) => {
      const rva = (va - imageBase) >>> 0
      for (const s of sections) {
        if (rva >= s.vaddr && rva < s.vaddr + Math.max(s.vsize, s.rawSize)) {
          return s.rawPtr + (rva - s.vaddr)
        }
      }
      throw new Error(`VA 0x${va.toString(16)} outside PE32 sections`)
    },
  }
}

function allocZero(m: SparseMemory113c, size: number): number {
  const ptr = m.alloc(size) >>> 0
  m.fill(ptr, size, 0)
  return ptr
}

function createFixtureWorld(): {
  m: SparseMemory113c
  pGame: number
  pDataTables: number
  pMonStats: number
  pMonStats2: number
  pSkillsTxt: number
  pMissilesTxt: number
  pObjectsTxt: number
  pItemsTxt: number
  pCharStats: number
  pExpTxt: number
  pRoom: number
  pLevel: number
  pDrlg: number
} {
  const m = new SparseMemory113c()
  m.fill(0x0, 0x100, 0)
  m.fill(0x6fdd6000, 0x20000, 0)
  const pDataTables = allocZero(m, 0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  const pMonStats = allocZero(m, 0x1a8 * 16)
  m.setU32(pDataTables + 0xa78, pMonStats)
  m.setU32(pDataTables + 0xa80, 16)
  m.setU32(0x6fdf0950, pMonStats)
  m.setU32(0x6fdf0958, 16)
  for (let i = 0; i < 16; i++) {
    const rec = pMonStats + i * 0x1a8
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x18, i)
  }

  const pMonStats2 = allocZero(m, D2MonStats2Txt_SIZE * 16)
  m.setU32(pDataTables + 0xa90, pMonStats2)
  m.setU32(pDataTables + 0xa98, 16)

  const pMonLvlTxt = allocZero(m, 120 * 0x78)
  m.setU32(pDataTables + 0xb70, pMonLvlTxt)
  m.setU32(pDataTables + 0xb74, 120)
  m.setU32(0x6fdf0b54, pMonLvlTxt)
  m.setU32(0x6fdf0b58, 120)

  const pSkillsTxt = allocZero(m, 0x23c * 16)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 16)
  m.setU32(pDataTables + 0xba8, pSkillsTxt)
  m.setU32(pDataTables + 0xbac, 16)

  const pMissilesTxt = allocZero(m, 0x1a4 * 16)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 16)
  m.setU32(0x6fdf0a3c, pMissilesTxt)
  m.setU32(0x6fdf0a44, 16)

  const pStatesTxt = allocZero(m, 256 * 0x3c)
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, 256)
  m.setU32(pDataTables + 0xbc0, pStatesTxt)
  m.setU32(pDataTables + 0x150, allocZero(m, 32))

  const pItemStatCostTxt = allocZero(m, 512 * 0x144)
  m.setU32(pDataTables + 0xbcc, pItemStatCostTxt)
  m.setU32(pDataTables + 0xbd4, 512)

  const pMonUModTxt = allocZero(m, 64 * 0x20)
  m.setU32(pDataTables + 0xc50, pMonUModTxt)
  m.setU32(pDataTables + 0xc54, 64)

  const pLevelsTxt = allocZero(m, 140 * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, 140)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, act)
  }

  const pObjectsTxt = allocZero(m, 0x1c0 * 16)
  m.setU32(pDataTables + 0x1c4, pObjectsTxt)
  m.setU32(pDataTables + 0x1c8, 16)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 16)

  const pItemsTxt = allocZero(m, ITEMS_TXT_STRIDE_113C * 16)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, 16)
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, 16)

  const pCharStats = allocZero(m, 0xc4 * 8)
  m.setU32(pDataTables + 0xbc4, pCharStats)
  m.setU32(pDataTables + 0xbc8, 8)
  m.setU8(pCharStats + 0x43, 2)
  m.setU8(pCharStats + 0x44, 1)
  m.setU8(pCharStats + 0x45, 2)
  m.setU8(pCharStats + 0x50, 5)

  const pExpTxt = allocZero(m, 0x20 * 16)
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpTxt)
  m.setU32(0x6fdf0b50, pExpTxt)
  m.setU32(pExpTxt + 0x00, 99) // max level for class 0
  m.setU32(pExpTxt + 0x20, 0) // lvl 0 threshold
  m.setU32(pExpTxt + 0x40, 500) // lvl 1 threshold
  m.setU32(pExpTxt + 0x60, 1500) // lvl 2 threshold
  m.setU32(pExpTxt + 0x80, 5000) // lvl 3 threshold
  m.setU32(pExpTxt + 0xa0, 10000) // lvl 4 threshold

  const pAnimDataTable = allocZero(m, 0x420)
  const pEmptyBucket = allocZero(m, 16)
  for (let i = 0; i < 256; i++) m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)

  const townLevels = [1, 40, 75, 103, 109]
  for (let act = 0; act < 5; act++) m.setU32(0x6fde4084 + act * 4, townLevels[act]!)
  for (let i = 0; i < PATH_TYPE_STEP_NUMS_6FDE4138.length; i++) {
    m.setU32((0x6fde4138 + i * 4) >>> 0, PATH_TYPE_STEP_NUMS_6FDE4138[i]! >>> 0)
  }
  for (let i = 0; i < PATH_TYPE_FLAGS_6FDE4180.length; i++) {
    m.setU32((0x6fde4180 + i * 4) >>> 0, PATH_TYPE_FLAGS_6FDE4180[i]! >>> 0)
  }
  m.fill(0x6fde41c8, 64 * 4, 1)

  const pGame = allocZero(m, 0x1e00)
  m.setU32(pGame + 0x1c, 0x12340000)
  m.setU16(pGame + 0x28, 7)
  m.setU8(pGame + 0x6d, 0) // normal diff
  m.setU16(pGame + 0x70, 1)
  m.setU32(pGame + 0xa8, 100)
  m.setU32(pGame + 0x10f0, allocZero(m, 0x40))
  m.setU32(pGame + 0x1d24, allocZero(m, 0x20))
  m.setU32(pGame + 0x1d2c, allocZero(m, 0x20))
  // Non-zero RNG seed (lo, hi)
  m.setU32(pGame + 0xd0, 0x12345678)
  m.setU32(pGame + 0xd4, 0x9abcdef1)
  EVENT_InitTimerQueue113c(m, pGame)

  const pDrlg = allocZero(m, 0x400)
  m.setU8(pDrlg + 0x00, 0) // Act 0
  const pLevel = allocZero(m, 0x200)
  m.setU32(pLevel + 0x00, pDrlg)
  m.setU32(pLevel + 0x1d0, 2) // Blood Moor (Act 0, non-town)

  const pRoom = allocZero(m, 0x100)
  const pRoomEx = allocZero(m, 0x100)
  const pColGrid = allocZero(m, 0x40)
  const pColCells = allocZero(m, 40 * 40 * 2)
  m.setU32(pColGrid + 0x00, 100)
  m.setU32(pColGrid + 0x04, 100)
  m.setU32(pColGrid + 0x08, 40)
  m.setU32(pColGrid + 0x0c, 40)
  m.setU32(pColGrid + 0x10, 100)
  m.setU32(pColGrid + 0x14, 100)
  m.setU32(pColGrid + 0x18, 40)
  m.setU32(pColGrid + 0x1c, 40)
  m.setU32(pColGrid + 0x20, pColCells)

  const pLogicalRoomInfo = allocZero(m, 0x30)
  m.setU32(pRoomEx + 0x58, pLevel)
  m.setU32(pRoomEx + 0x64, pLogicalRoomInfo)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x20, pColGrid)
  m.setU32(pRoom + 0x3c, allocZero(m, 16))
  m.setU32(pRoom + 0x4c, 100)
  m.setU32(pRoom + 0x50, 100)
  m.setU32(pRoom + 0x54, 40)
  m.setU32(pRoom + 0x58, 40)
  const ppNear = allocZero(m, 8)
  m.setU32(ppNear, pRoom)
  m.setU32(pRoom + 0x00, ppNear)
  m.setU32(pRoom + 0x24, 1)
  // Non-zero room RNG seed (lo, hi)
  m.setU32(pRoom + 0x6c, 0x2468ace1)
  m.setU32(pRoom + 0x70, 0x13579bdf)

  const pAct = allocZero(m, 0x100)
  m.setU32(pAct + 0x0c, pRoom)
  m.setU32(pGame + 0xbc, pAct)
  m.setU32(0x6fd31c20, 0)
  return {
    m,
    pGame,
    pDataTables,
    pMonStats,
    pMonStats2,
    pSkillsTxt,
    pMissilesTxt,
    pObjectsTxt,
    pItemsTxt,
    pCharStats,
    pExpTxt,
    pRoom,
    pLevel,
    pDrlg,
  }
}

describe('Wave 19 (indirectUnknown Batch A — 63 D2Game VAs across 29 disjoint TS files)', () => {
  it('verifies PE32 machine-code leading/trailing bytes, sizes, and 0xFF indirect opcodes for all 63 VAs', () => {
    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    expect(fs.existsSync(dllPath)).toBe(true)
    const { buf, vaToFileOffset } = readPeTextMapper(dllPath)

    expect(WAVE19_INDA_PE32_SPECS).toHaveLength(63)
    const seen = new Set<number>()
    let totalSites = 0
    for (const spec of WAVE19_INDA_PE32_SPECS) {
      expect(seen.has(spec.va)).toBe(false)
      seen.add(spec.va)

      const startOff = vaToFileOffset(spec.va)
      const actualHead = buf.subarray(startOff, startOff + 8).toString('hex')
      const actualTail = buf.subarray(startOff + spec.size - 4, startOff + spec.size).toString('hex')
      expect(actualHead, `headHex mismatch for 0x${spec.va.toString(16)}`).toBe(spec.headHex)
      expect(actualTail, `tailHex mismatch for 0x${spec.va.toString(16)}`).toBe(spec.tailHex)

      expect(spec.ivas.length).toBeGreaterThan(0)
      for (const iva of spec.ivas) {
        const ivaOff = vaToFileOffset(iva)
        expect(buf[ivaOff], `expected 0xFF indirect branch opcode at 0x${iva.toString(16)}`).toBe(0xff)
        expect(iva >= spec.va && iva < spec.va + spec.size).toBe(true)
        totalSites++
      }
    }
    expect(totalSites).toBe(72)
  })

  it('validates tools/oracle/callgraph/indirect-audit-batchA.json covers all 63 VAs with concrete PE32 proofs', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as {
      functions: ManifestFn[]
    }
    const dtables = JSON.parse(fs.readFileSync(DISPATCH_TABLES_PATH, 'utf8')) as {
      dispatchTables: Array<{ module?: string; name?: string }>
    }
    const audit = JSON.parse(fs.readFileSync(AUDIT_BATCH_A_PATH, 'utf8')) as AuditFile

    const d2gameManifestByVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module !== 'D2Game') continue
      d2gameManifestByVa.set(fn.va.toUpperCase(), fn)
    }
    const expectedBatchAVas = new Set<string>(
      WAVE19_INDA_PE32_SPECS.map((s) => `0X${s.va.toString(16).toUpperCase()}`),
    )
    expect(expectedBatchAVas.size).toBe(63)
    for (const key of expectedBatchAVas) {
      const mfn = d2gameManifestByVa.get(key)
      expect(mfn, `Missing Batch A VA ${key} in manifest`).toBeDefined()
      expect(mfn!.kernFile !== undefined && ALLOWED_KERN_FILES.has(mfn!.kernFile)).toBe(true)
      expect(mfn!.status, `Batch A VA ${key} must be diff-verified after Wave 23 promotion`).toBe('diff-verified')
    }

    const validTableNames = new Set(
      dtables.dispatchTables.filter((t) => t.module === 'D2Game' && t.name).map((t) => t.name!),
    )

    expect(audit.batch).toBe('wave19-indA')
    expect(audit.module).toBe('D2Game')
    expect(audit.totalFunctions).toBe(63)
    expect(audit.totalIndirectSites).toBe(72)
    expect(audit.entries).toHaveLength(63)

    const auditVas = new Set<string>()
    const fnCatCounts = { static_table: 0, vtable_or_struct_table: 0, caller_callback: 0 }
    const siteCatCounts = { static_table: 0, vtable_or_struct_table: 0, caller_callback: 0 }
    const specByVa = new Map(WAVE19_INDA_PE32_SPECS.map((s) => [`0X${s.va.toString(16).toUpperCase()}`, s]))

    for (const entry of audit.entries) {
      const vaKey = entry.va.toUpperCase()
      expect(expectedBatchAVas.has(vaKey), `Unexpected VA in audit: ${entry.va}`).toBe(true)
      expect(auditVas.has(vaKey)).toBe(false)
      auditVas.add(vaKey)

      const mfn = d2gameManifestByVa.get(vaKey)!
      expect(entry.name).toBe(mfn.name)
      expect(entry.kernFile).toBe(mfn.kernFile)
      expect(entry.tsSymbol).toBe(mfn.tsSymbol)
      expect(entry.bindingShard.endsWith('.json')).toBe(true)

      const peSpec = specByVa.get(vaKey)!
      expect(entry.indirectSites.length).toBe(peSpec.ivas.length)
      const fnCats = new Set<string>()

      for (const site of entry.indirectSites) {
        expect(/^0x[0-9A-F]{8}$/.test(site.iva)).toBe(true)
        expect(peSpec.ivas).toContain(Number.parseInt(site.iva, 16))
        expect(site.insn.length).toBeGreaterThan(4)
        expect(site.proof.length).toBeGreaterThan(20)
        expect(['static_table', 'vtable_or_struct_table', 'caller_callback']).toContain(site.category)

        siteCatCounts[site.category]++
        fnCats.add(site.category)

        if (site.category === 'static_table') {
          expect(site.tableBase).toMatch(/^0x[0-9A-F]{8}$/)
          expect(site.tableEnd).toMatch(/^0x[0-9A-F]{8}$/)
          expect(Number.parseInt(site.tableEnd!, 16)).toBeGreaterThan(Number.parseInt(site.tableBase!, 16))
          expect(site.tableName).toBeDefined()
          expect(validTableNames.has(site.tableName!)).toBe(true)
          expect(site.targetVas && site.targetVas.length > 0).toBe(true)
          for (const tva of site.targetVas!) {
            expect(d2gameManifestByVa.has(tva.toUpperCase()), `missing target ${tva}`).toBe(true)
          }
        } else if (site.category === 'vtable_or_struct_table') {
          expect(site.targetVas && site.targetVas.length > 0).toBe(true)
          for (const tva of site.targetVas!) {
            expect(d2gameManifestByVa.has(tva.toUpperCase()), `missing target ${tva}`).toBe(true)
          }
        }
      }
      expect(fnCats.size).toBe(1)
      const fnCat = entry.indirectSites[0]!.category
      fnCatCounts[fnCat]++
      if (fnCat === 'caller_callback') {
        expect(mfn.indirectUnknown, `caller_callback ${entry.va} keeps indirectUnknown`).toBe(true)
      } else {
        expect(mfn.indirectUnknown, `${fnCat} ${entry.va} must be statically resolved in manifest`).toBeUndefined()
      }
    }

    expect(auditVas.size).toBe(63)
    expect(fnCatCounts).toEqual({ static_table: 13, vtable_or_struct_table: 30, caller_callback: 20 })
    expect(siteCatCounts).toEqual({ static_table: 18, vtable_or_struct_table: 34, caller_callback: 20 })
    expect(audit.categorySummary.functions).toEqual(fnCatCounts)
    expect(audit.categorySummary.sites).toEqual(siteCatCounts)
  })

  it('0x6FC53CE0 QUESTS_TriggerCallback113c: keeps actNo=0xFF when UNITS_GetRoom returns 0 and masks flag bytes', () => {
    const { m, pGame } = createFixtureWorld()
    const pQuestCtrl = allocZero(m, 0x24)
    const pQuestAct2 = allocZero(m, 0xf8)
    m.setU8(pQuestAct2 + 0x08, 2) // Act 2
    m.setU8(pQuestAct2 + 0x0a, 1) // active
    m.setU32(pQuestAct2 + 0xa0, 0x6fc82410)
    m.setU32(pQuestCtrl + 0x00, pQuestAct2)
    m.setU32(pGame + 0x10f4, pQuestCtrl)

    const pArg = allocZero(m, 0x20)
    const pPlayerNoRoom = allocZero(m, 0x100)
    m.setU32(pArg + 0x00, pGame)
    m.setU32(pArg + 0x04, 0) // cbIdx = 0
    m.setU32(pArg + 0x0c, pPlayerNoRoom) // pPath = 0 -> UNITS_GetRoom = 0

    const fired: number[] = []
    // bFilterAct = 1 with null room must keep actNo = 0xFF and STILL fire Act 2 quest!
    QUESTS_TriggerCallback113c(m, pArg, 1, 1, {
      onQuestCallback: (_mem, fnVa) => {
        fired.push(fnVa)
      },
    })
    expect(fired).toEqual([0x6fc82410])

    // bCheckActive = 0x100 (low byte = 0) with inactive quest (+0x0A = 0) must NOT fire!
    m.setU8(pQuestAct2 + 0x0a, 0)
    fired.length = 0
    QUESTS_TriggerCallback113c(m, pArg, 0x100, 0, {
      onQuestCallback: (_mem, fnVa) => {
        fired.push(fnVa)
      },
    })
    expect(fired).toEqual([])
  })

  it('0x6FC53B70 QUESTS_StepQuestTimers113c: invokes pfnTimer, unlinks on return 1, re-reads tick on return 0', () => {
    const { m, pGame } = createFixtureWorld()
    const pQuestCtrl = allocZero(m, 0x24)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl + 0x14, 10)

    const pQuestData1 = allocZero(m, 0xf8)
    const pQuestData2 = allocZero(m, 0xf8)
    const pTimer1 = allocZero(m, 0x20)
    const pTimer2 = allocZero(m, 0x20)
    m.setU32(pTimer1 + 0x00, 0x6fc83b50) // pfnTimer
    m.setU32(pTimer1 + 0x04, pQuestData1)
    m.setU32(pTimer1 + 0x08, 5) // due (< 11)
    m.setU32(pTimer1 + 0x0c, 20)
    m.setU32(pTimer1 + 0x10, pTimer2)

    m.setU32(pTimer2 + 0x00, 0x6fc83a80)
    m.setU32(pTimer2 + 0x04, pQuestData2)
    m.setU32(pTimer2 + 0x08, 6) // due (< 11)
    m.setU32(pTimer2 + 0x0c, 30)
    m.setU32(pTimer2 + 0x10, 0)
    m.setU32(pQuestCtrl + 0x10, pTimer1)

    const seen: Array<[number, number]> = []
    QUESTS_StepQuestTimers113c(m, pGame, (mem, pfn, _pg, pq) => {
      seen.push([pfn, pq])
      if (pfn === 0x6fc83b50) {
        return 1 // unlink & free pTimer1
      }
      // Mutate pQuestControl + 0x14 inside callback to verify post-callback re-read at 0x6FC53C2D
      mem.setU32(pQuestCtrl + 0x14, 50)
      return 0
    })

    expect(seen).toEqual([
      [0x6fc83b50, pQuestData1],
      [0x6fc83a80, pQuestData2],
    ])
    // pTimer1 unlinked -> head is now pTimer2; pTimer2 rescheduled to postTick(50) + period(30) = 80
    expect(m.u32(pQuestCtrl + 0x10)).toBe(pTimer2)
    expect(m.u32(pTimer2 + 0x08)).toBe(80)
    expect(m.u32(pQuestCtrl + 0x04)).toBe(0)
  })

  it('0x6FC54EA0 QUESTS_CheckNpcQuestInteractAlert113c: masks callback return to low byte (test al, al)', () => {
    const { m, pGame, pMonStats } = createFixtureWorld()
    const pQuestCtrl = allocZero(m, 0x24)
    const pQuest = allocZero(m, 0xf8)
    m.setU8(pQuest + 0x08, 0)
    m.setU32(pQuest + 0xec, 0x6fc76810) // routed to k4QuestNpcAlertDispatcher
    m.setU32(pQuestCtrl + 0x00, pQuest)
    m.setU32(pQuestCtrl + 0x08, 1) // initialized
    m.setU32(pGame + 0x10f4, pQuestCtrl)

    const pPlayer = allocZero(m, 0x100)
    const pPlayerData = allocZero(m, 0x100)
    const pClient = allocZero(m, 0x400)
    const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU8(pClient + 0x1ac, 0) // Act 0
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pPlayerData + 0x9c, pClient)
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)

    const pNpc = allocZero(m, 0x100)
    m.setU32(pNpc + 0x00, 1)
    m.setU32(pNpc + 0x04, 1)
    // Set MONSTATS flag bit 9 (interact / NPC) at MonStatsTxt[1] + 0x0c + (9 >> 3) bit (9 & 7)
    m.setU8(pMonStats + 1 * 0x1a8 + 0x0c + 1, 1 << 1)

    try {
      // Return 0x100 (low byte al === 0): must NOT trigger alert packet!
      registerK4QuestNpcAlertDispatcher113c(() => 0x100)
      expect(QUESTS_CheckNpcQuestInteractAlert113c(m, pPlayer, pGame, pNpc)).toBe(0)

      // Return 0x101 (low byte al === 1): must trigger alert packet and return 1!
      registerK4QuestNpcAlertDispatcher113c(() => 0x101)
      expect(QUESTS_CheckNpcQuestInteractAlert113c(m, pPlayer, pGame, pNpc)).toBe(1)
    } finally {
      registerK4QuestNpcAlertDispatcher113c(() => 0)
    }
  })

  it('0x6FC99A10 PLAYER_StepAnimationModeTick113c: dispatches exact 0x6FD279D0 mode table VAs', () => {
    const { m, pGame } = createFixtureWorld()
    const pUnit = allocZero(m, 0x100)
    m.setU32(pUnit + 0x00, 0)

    const dispatched: number[] = []
    for (const [mode, expectedVa] of [
      [0, 0x6fc97940],
      [1, 0x6fc97930],
      [2, 0x6fc99b90],
      [4, 0x6fc97920],
      [7, 0x6fc99170],
      [19, 0x6fc99b90],
    ] as const) {
      m.setU32(pUnit + 0x10, mode)
      dispatched.length = 0
      PLAYER_StepAnimationModeTick113c(m, pGame, pUnit, 0, 0, undefined, (_mem, pfn) => {
        dispatched.push(pfn)
        return 1
      })
      expect(dispatched).toEqual([expectedVa])
    }
  })

  it('0x6FC5E3F0 / 0x6FC5EDE0 / 0x6FC8F930: real missile table VAs & 32-bit (dist << 16) truncation', () => {
    const { m, pGame, pMissilesTxt, pRoom } = createFixtureWorld()
    const pMis = allocZero(m, 0x100)
    const pPath = allocZero(m, 0x200)
    m.setU32(pMis + 0x00, 3)
    m.setU32(pMis + 0x04, 1)
    m.setU32(pMis + 0x10, 3) // collideKillMode = 3 (players & monsters)
    m.setU32(pMis + 0x2c, pPath)
    m.setU32(pMis + 0x80, pGame)
    m.setU32(pPath + 0x1c, pRoom)

    // MissilesTxt[1]: wSrvDoFunc = 2 -> 0x6FC61B80, wSrvHitFunc = 1 -> 0x6FC5B990, wSrvDmgFunc = 1 -> 0x6FC59CE0
    m.setU16(pMissilesTxt + 1 * 0x1a4 + 0x0c, 2)
    m.setU16(pMissilesTxt + 1 * 0x1a4 + 0x0e, 1)
    m.setU16(pMissilesTxt + 1 * 0x1a4 + 0x10, 1)

    let seenDoVa = 0
    MISSILE_DispatchFrameTick113c(m, pGame, pMis, {
      srvDoMissile: (_mem, _idx, fnVa) => {
        seenDoVa = fnVa
        return 1
      },
    })
    expect(seenDoVa).toBe(0x6fc61b80)

    const pTarget = allocZero(m, 0x100)
    m.setU32(pTarget + 0x00, 1)
    m.setU32(pTarget + 0x10, 1)
    m.setU32(pTarget + 0x80, pGame)
    STATLIST_CreateEx113c(m, pMis, 0, 0)
    STATLIST_CreateEx113c(m, pTarget, 0, 0)

    let seenHitVa = 0
    let seenDmgVa = 0
    MISSILE_ProcessTargetCollisionHit113c(m, pMis, pGame, pTarget, 1, {
      srvHitMissile: (_mem, _idx, fnVa) => {
        seenHitVa = fnVa
        return 2
      },
      srvDmgMissile: (_mem, _idx, fnVa) => {
        seenDmgVa = fnVa
      },
    })
    expect(seenHitVa).toBe(0x6fc5b990)
    expect(seenDmgVa).toBe(0x6fc59ce0)

    // 0x6FC8F930: (dist << 16) >>> 0 truncation when dist = 0x10002 (65538):
    // x86 `shl eax, 16` -> 0x00020000 (131072), NOT 65538 * 65536 = 4295098368!
    const pOwner = allocZero(m, 0x100)
    const pOwnerPath = allocZero(m, 0x200)
    m.setU32(pOwner + 0x00, 0)
    m.setU32(pOwner + 0x0c, 11)
    m.setU32(pOwner + 0x2c, pOwnerPath)
    m.setU32(pOwner + 0x80, pGame)
    m.setU32(pOwnerPath + 0x1c, pRoom)
    m.setU16(pOwnerPath + 0x02, 100)
    m.setU16(pOwnerPath + 0x06, 100)
    STATLIST_CreateEx113c(m, pOwner, 0, 0)

    m.setU8(pMissilesTxt + 1 * 0x1a4 + 0x9a, 16) // baseVel = 16 -> vel = divBy100(4096 * 75) = 3072 -> velShl4 = 49152
    m.setU16(pMissilesTxt + 1 * 0x1a4 + 0x96, 100) // range
    const pParams = allocZero(m, 0x60)
    m.setU32(pParams + 0x00, 0x0421) // dwFlags: 0x01 (startXY) | 0x20 (targetXY) | 0x400 (dist-based rem frames)
    m.setU32(pParams + 0x04, pOwner)
    m.setU32(pParams + 0x08, pOwner)
    m.setU32(pParams + 0x10, 1) // missileId = 1
    m.setU32(pParams + 0x14, 105) // startX
    m.setU32(pParams + 0x18, 105) // startY
    m.setU32(pParams + 0x1c, 155) // targetX -> dist = 50
    m.setU32(pParams + 0x20, 105) // targetY
    m.setU32(pParams + 0x30, 1) // skillLvl
    m.setU32(pParams + 0x54, 0x6fc61f50) // pfnInitFunc

    let initCalledWith = 0
    const pSpawned = MISSILE_CreateServerProjectile113c(m, pGame, pParams, {
      missileInitCallback: (_mem, fnVa) => {
        initCalledWith = fnVa
      },
    })
    expect(pSpawned).toBeGreaterThan(0)
    expect(initCalledWith).toBe(0x6fc61f50)
    // ((50 << 16) >>> 0) / (3072 << 4) = 3276800 / 49152 = 66
    expect(MISSILE_GetRemainingFrames113c(m, pSpawned)).toBe(66)
  })

  it('0x6FC446D0 MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c: marks minion flag 0x10, bBoss=0, and iterates all 9 slots', () => {
    const { m, pGame, pMonStats, pMonStats2, pRoom } = createFixtureWorld()
    // Configure valid monster class 1 so MONSTER_Create succeeds
    m.setU16(pMonStats + 1 * 0x1a8 + 0x00, 1)
    m.setU16(pMonStats + 1 * 0x1a8 + 0x02, 1)
    m.setU16(pMonStats + 1 * 0x1a8 + 0x06, 1)
    m.setU8(pMonStats + 1 * 0x1a8 + 0x90, 5) // Level
    m.setU8(pMonStats2 + 1 * D2MonStats2Txt_SIZE + 0x08, 1) // sizeX
    m.setU8(pMonStats2 + 1 * D2MonStats2Txt_SIZE + 0x09, 1) // sizeY
    m.setU8(pMonStats2 + 1 * D2MonStats2Txt_SIZE + 0x0a, 3) // no collision mask
    m.setU16(pGame + 0x10f6, 5) // pre-existing unique count

    // Put UMod 9 (Fire Enchanted -> 0x6FC42740) in slot 2 AFTER zeros in slots 0..1!
    const pUModBytes = allocZero(m, 16)
    m.setU8(pUModBytes + 0, 0)
    m.setU8(pUModBytes + 1, 0)
    m.setU8(pUModBytes + 2, 9)

    const seenModCalls: Array<[number, number, number]> = []
    const pMinion = MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c(
      m,
      pGame,
      pRoom,
      0,
      105,
      105,
      -1,
      1,
      0,
      pUModBytes,
      0x2a,
      {
        onMonUMod: (_mem, pfn, _pm, modId, bBoss) => {
          seenModCalls.push([pfn, modId, bBoss])
        },
      },
    )
    expect(pMinion).toBeGreaterThan(0)
    const pMonData = m.u32(pMinion + 0x14) >>> 0
    // Minion flag 0x10 set, NOT boss flag 0x08!
    expect(m.u8(pMonData + 0x16) & 0x10).toBe(0x10)
    expect(m.u8(pMonData + 0x16) & 0x08).toBe(0)
    // Does NOT increment pGame + 0x10f6!
    expect(m.u16(pGame + 0x10f6)).toBe(5)
    // Slot 2 (mod 9 -> 0x6FC42740) WAS invoked even though slots 0..1 were 0, AND bBoss === 0!
    expect(seenModCalls).toContainEqual([0x6fc42740, 9, 0])
  })

  it('0x6FC517F0 & 0x6FC51B40: pass pGame (not nObjectId) as arg1 to onObjectPosValidate', () => {
    const { m, pGame, pRoom } = createFixtureWorld()
    const seen1: number[] = []
    OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c(
      m,
      pGame,
      7,
      1,
      1,
      pRoom,
      0,
      0x123,
      0x6fc2b670,
      {
        onObjectPosValidate: (_mem, arg1Game, arg2Ctx) => {
          seen1.push(arg1Game, arg2Ctx)
          return 0
        },
      },
    )
    expect(seen1.length).toBeGreaterThanOrEqual(2)
    expect(seen1[0]).toBe(pGame)
    expect(seen1[1]).toBe(0x123)

    const seen2: number[] = []
    OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c(
      m,
      pGame,
      7,
      2,
      2,
      pRoom,
      0x456,
      0x6fc2b700,
      {
        onObjectPosValidate: (_mem, arg1Game, arg2Ctx) => {
          seen2.push(arg1Game, arg2Ctx)
          return 0
        },
      },
    )
    expect(seen2.length).toBeGreaterThanOrEqual(2)
    expect(seen2[0]).toBe(pGame)
    expect(seen2[1]).toBe(0x456)
  })

  it('0x6FCB1660 SKILLS_ApplyMonsterSkillBuffAndUMod: invokes monUModTable[nMonUMod](pMonster, nMonUMod, 1)', () => {
    const { m, pGame, pSkillsTxt } = createFixtureWorld()
    const pMonster = allocZero(m, 0x100)
    const pMonData = allocZero(m, 0x60)
    m.setU32(pMonster + 0x00, 1)
    m.setU32(pMonster + 0x14, pMonData)
    m.setU32(pMonster + 0x80, pGame)
    STATLIST_CreateEx113c(m, pMonster, 0, 0)
    STATLIST_SetUnitStat113c(m, pMonster, 7, 25600, 0)

    // Set pSkillsTxt->wMonUMod (+0xE4) = 9 (Fire Enchanted -> 0x6FC42740)
    m.setU16(pSkillsTxt + 0xe4, 9)
    const seen: Array<[number, number, number]> = []
    SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c(
      m,
      pSkillsTxt,
      pGame,
      pMonster,
      1,
      3,
      (_mem, pfn, pm, modId, bBoss) => {
        seen.push([pfn, pm, modId * 10 + bBoss])
      },
    )
    expect(m.u8(pMonData + 0x1c)).toBe(9)
    expect(seen).toEqual([[0x6fc42740, pMonster, 91]])
  })

  it('0x6FD10A70 PARTY_DispatchRelationAction: validates pfnHandler instead of reading IAT slot 0x6FD18D14 as boolean', () => {
    const { m, pGame } = createFixtureWorld()
    const pSrc = allocZero(m, 0x100)
    const pDst = allocZero(m, 0x100)
    m.setU32(pDst + 0x0c, 5)
    m.setU32(pGame + ((5 & 0x7f) << 2) + 0x1120, pDst)

    // Put a realistic non-zero kernel32!IsBadCodePtr address in IAT slot 0x6FD18D14!
    // Previously this caused 0x6FD10A70 to ALWAYS return 3 and never dispatch!
    m.setU32(0x6fd18d14, 0x7c809f90)

    let dispatchedFn = 0
    const res = PARTY_DispatchRelationAction_6FD10A70_113c(
      m,
      5,
      1, // table[1] = 0x6FD10F40
      pGame,
      pSrc,
      0,
      (_mem, pfn) => {
        dispatchedFn = pfn
      },
    )
    expect(res).toBe(0)
    expect(dispatchedFn).toBe(0x6fd10f40)

    // Bad pointer in table returns 3
    m.setU32(0x6fd1a3b0 + 4, 0x00001234)
    expect(PARTY_DispatchRelationAction_6FD10A70_113c(m, 5, 1, pGame, pSrc, 0)).toBe(3)
  })

  it('0x6FD0B090 PLAYER_LevelUp, 0x6FC22090 STORM_TSHashTableInsertOrCreateNode, and 0x6FCE6E90 debug format string', () => {
    const { m, pGame } = createFixtureWorld()

    // 1. 0x6FD0B090 invokes host callback [0x6FD31C3C]+0x2C
    const pPlayer = allocZero(m, 0x100)
    const pPlayerData = allocZero(m, 0x100)
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x04, 0) // class 0
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x80, pGame)
    m.setU32(pPlayer + 0xa8, allocZero(m, 0x20))
    STATLIST_CreateEx113c(m, pPlayer, 0, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 1, 0) // level 1
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0d, 3500, 0) // exp -> level 3
    STATLIST_SetUnitStat113c(m, pPlayer, 7, 1024, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 6, 1024, 0)

    const pCbTable = allocZero(m, 0x40)
    m.setU32(pCbTable + 0x2c, 0x12345678)
    m.setU32(0x6fd31c3c, pCbTable)

    const cbArgs: number[] = []
    PLAYER_LevelUp_6FD0B090_113c(m, pPlayer, pGame, (_mem, pfn, wGameId, _pName, nClass, nNewLvl) => {
      cbArgs.push(pfn, wGameId, nClass, nNewLvl)
    })
    expect(cbArgs).toEqual([0x12345678, 7, 0, 3])
    m.setU32(0x6fd31c3c, 0)

    // 2. 0x6FC22090 allocates fresh node buffer instead of clobbering vftable[1] code ptr
    const pTable = allocZero(m, 0x40)
    const pVtable = allocZero(m, 0x20)
    const pBuckets = allocZero(m, 0x40)
    const pSentinel = allocZero(m, 0x20)
    const fakeCodeVa = 0x6fc29999
    m.setU32(fakeCodeVa, 0x90909090)
    m.setU32(pVtable + 0x04, fakeCodeVa)
    m.setU32(pTable + 0x00, pVtable)
    m.setU32(pTable + 0x08, pSentinel)
    m.setU32(pTable + 0x1c, pBuckets)
    m.setU32(pTable + 0x24, 3)

    const pNewNode = STORM_TSHashTableInsertOrCreateNode_6FC22090_113c(m, pTable, 0x77, 0, 0)
    expect(pNewNode).toBeGreaterThan(0)
    expect(pNewNode).not.toBe(fakeCodeVa)
    expect(m.u32(pNewNode)).toBe(0x77)
    expect(m.u32(fakeCodeVa)).toBe(0x90909090) // vtable target address was NOT overwritten!

    // 3. 0x6FCE6E90 writes exact "changing state to 2\n" debug string from 0x6FD1CC2C
    const pQuest = allocZero(m, 0xf8)
    const pQuestState = allocZero(m, 0x40)
    const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pQuest + 0x04, pGame)
    m.setU32(pQuest + 0x18, pQuestState)
    const pQuestArg = allocZero(m, 0x20)
    m.setU32(pQuestArg + 0x00, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU16(pQuestArg + 0x14, 0xb0) // Atma
    m.setU16(pQuestArg + 0x18, 0x130) // intro message
    const pQuestCtrl = allocZero(m, 0x24)
    m.setU32(pQuestCtrl + 0x08, 1)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    const pClient = allocZero(m, 0x500)
    m.setU32(pClient + 0x04, 4) // active
    m.setU32(pClient + 0x174, pPlayer)
    m.setU32(pClient + 0x1a8, pGame)
    m.setU32(pPlayerData + 0x9c, pClient)
    m.setU32(pGame + 0x88, pClient)
    m.setU32(0x6fd31c20, 1) // enable quest debug broadcast
    ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c(m, pQuest, pQuestArg)
    m.setU32(0x6fd31c20, 0)
    let pNetNode = m.u32(pClient + 0x1b8) >>> 0
    expect(pNetNode).toBeGreaterThan(0)
    let text = ''
    while (pNetNode !== 0) {
      const netLen = m.u32(pNetNode) >>> 0
      for (let i = 0; i < netLen; i++) {
        const ch = m.u8(pNetNode + 4 + i)
        if (ch >= 0x0a && ch < 0x7f) text += String.fromCharCode(ch)
      }
      pNetNode = m.u32(pNetNode + 0x204) >>> 0
    }
    expect(text).toContain('changing state to 2\n')
  })

  it('achieves 63 / 63 (100%) live VA trace execution coverage across all Wave 19 Batch A functions', () => {
    const { m, pGame, pDataTables, pSkillsTxt, pRoom } = createFixtureWorld()
    m.fill(0x6fd18000, 0x20000, 0)
    initD2GameGlobalsInMem113c(m, pDataTables)
    m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))
    const pPlayer = allocZero(m, 0x100)
    const pPlayerData = allocZero(m, 0x100)
    const pQuestCtrl = allocZero(m, 0x24)
    m.setU32(pQuestCtrl + 0x08, 1)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    const pClient = allocZero(m, 0x500)
    const pPath = allocZero(m, 0x200)
    const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x0c, 1)
    m.setU32(pPlayer + 0x10, 1)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x2c, pPath)
    m.setU32(pPlayer + 0x80, pGame)
    m.setU32(pPlayer + 0xa8, allocZero(m, 0x20))
    m.setU32(pPath + 0x1c, pRoom)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pPlayerData + 0x9c, pClient)
    m.setU32(pClient + 0x174, pPlayer)
    STATLIST_CreateEx113c(m, pPlayer, 0, 0)

    const pMon = allocZero(m, 0x100)
    const pMonData = allocZero(m, 0x80)
    m.setU32(pMon + 0x00, 1)
    m.setU32(pMon + 0x04, 1)
    m.setU32(pMon + 0x14, pMonData)
    m.setU32(pMon + 0x2c, pPath)
    m.setU32(pMon + 0x80, pGame)
    m.setU32(pMon + D2UnitStrc.seedLo.off, 0x11112222)
    m.setU32(pMon + D2UnitStrc.seedHi.off, 0x33334444)
    STATLIST_CreateEx113c(m, pMon, 0, 0)

    const pQuest = allocZero(m, 0xf8)
    m.setU32(pQuest + 0x04, pGame)
    m.setU8(pQuest + 0x09, 1)
    m.setU8(pQuest + 0x0c, 1)

    const pArg = allocZero(m, 0x30)
    m.setU32(pArg + 0x00, pGame)
    m.setU32(pArg + 0x0c, pPlayer)

    const pTable = allocZero(m, 0x40)
    const pNode = allocZero(m, 0x40)
    const pBuckets = allocZero(m, 0x40)
    m.setU32(pTable + 0x08, pNode)
    m.setU32(pTable + 0x1c, pBuckets)
    m.setU32(pTable + 0x24, 3)

    const pOutA = allocZero(m, 8)
    const pOutB = allocZero(m, 8)
    const pTether = allocZero(m, 8)
    const pFilterArgs = allocZero(m, 0x20)
    const pDmg = allocZero(m, 0x70)
    const pItem = allocZero(m, 0x100)
    m.setU32(pItem + 0x00, 4)

    let trace: Set<string> = new Set()
    beginVaTrace113c()
    try {
      // 1..10
      STORM_TSHashTableInsertOrCreateNode_6FC22090_113c(m, pTable, 1, 0, 0, () => pNode)
      AI_Think_CainAndAnyaPrisonPortal_6FC3BF60_113c(m, pGame, 0, 0)
      AIGENERAL_ForEachPackMember_6FC41490_113c(m, pMon, () => {}, 0, 0)
      MONUMOD_ApplyToMinionCallback113c(m, pMon, 0, 0)
      MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pMon, 0, pGame, 0)
      MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c(m, pGame, pRoom, 0, 105, 105, -1, -1, 0, 0, 0)
      OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(m, 0, pGame, pRoom, 105, 105, 0)
      OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c(m, pGame, 7, 2, 2, pRoom, 1, 0, 0, { onObjectPosValidate: () => 0 })
      OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c(m, pGame, 7, 2, 2, pRoom, 0, 0, { onObjectPosValidate: () => 0 })
      QUESTS_StepQuestTimers113c(m, pGame)

      // 11..20
      QUESTS_TriggerCallback113c(m, pArg, 1, 0)
      QUESTS_RefreshInventoryQuestItems_6FC54760_113c(m, pPlayer, pGame)
      QUESTS_AllocAndInitGameQuests_6FC548A0_113c(m, pGame)
      QUESTS_CheckNpcQuestInteractAlert113c(m, pPlayer, pGame, pMon)
      QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 1, pPlayer, pGame)
      QUESTS_SendQuestLogPackets50And52_6FC55640_113c(m, pGame, pPlayer)
      MISSILE_DispatchFrameTick113c(m, pGame, 0)
      MISSILE_ProcessTargetCollisionHit113c(m, 0, pGame, 0, 0)
      MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c(m, pGame, 0, 0)
      ACT5Q6_SeqFilter_6FC767A0_113c(m, pQuest)

      // 21..30
      ACT5Q4_SeqFilter_6FC76B10_113c(m, pQuest)
      ACT5Q5_SeqFilter_6FC76BD0_113c(m, pQuest)
      ACT5Q1_SeqFilter_6FC76D10_113c(m, pQuest)
      QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c(m, pQuest)
      QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c(m, pQuest)
      ACT1Q4_ActivateOrChainQuest_6FC846D0_113c(m, pQuest)
      ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c(m, pQuest)
      ACT1Q2_ActivateOrChainQuest_6FC84E10_113c(m, pQuest)
      MISSILE_CreateServerProjectile113c(m, pGame, allocZero(m, 0x60))
      PLAYER_StepAnimationModeTick113c(m, pGame, pPlayer, 0, 0)

      // 31..40
      SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c(m, pSkillsTxt, pGame, pMon, 1, 1)
      PETS_ForEachPlayerPetUnit_6FCB6AF0_113c(m, pGame, pPlayer, () => {}, 0)
      PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(m, pGame, 0xffff, () => {}, 0)
      SKILLS_DispatchSrvDoFunc_6FCBE420_113c(m, 0, pGame, pPlayer, 1, 1)
      SKILLS_ForEachUnitNearTargetCoords_6FCC06F0_113c(m, 3, pGame, pPlayer, 0, () => {}, 0)
      AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c(m, pGame, 0, pPlayer, 5, () => {}, 0)
      AURA_ForEachUnitInRadius113c(m, pGame, pPlayer, 100, 100, 0, 0, 0, 0, 0)
      AITARGET_FindBestHostileTarget_6FCC4610_113c(m, pGame, pMon, pOutA, pOutB, pTether, () => 0)
      ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c(m, pPlayer, pItem, pGame, 0, 0, 0)
      MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c(m, pMon, pFilterArgs, pOutA)

      // 41..50
      MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c(m, pMon, 0, pGame, 0)
      MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c(m, pMon, 0, pGame, 0)
      AITARGET_IterateRoomActiveClients113c(m, pGame, pPlayer, 0, 0)
      AITARGET_FindBestHostileTargetTether75_6FCD7090_113c(m, pGame, pMon, pOutA, pOutB, pTether, () => 0)
      ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c(m, pQuest)
      ACT4Q1_SeqCallback_6FCDA270_113c(m, pQuest)
      ACT2Q4_ChainSeqFilter_6FCE1FF0_113c(m, pQuest)
      ACT2Q3_SeqFilter_6FCE21E0_113c(m, pQuest)
      ACT2Q1_SeqFilter_6FCE24A0_113c(m, pQuest)
      ACT2Q3_SeqCallback_6FCE6390_113c(m, pQuest)

      // 51..63
      ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c(m, pQuest, pArg)
      ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c(m, pQuest, pArg)
      D2GAME_PLRMODES_DispatchModeSyncToClient113c(m, pPlayer, pGame, pClient)
      SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c(m, pGame, pPlayer, 100, 100, 5, pDmg, 0, 0, () => 0, 0)
      D2GAME_SUNIT_IterateAllLivingPlayers113c(m, pGame, () => {}, 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(m, pGame, () => 0, 0, 0)
      QUESTS_ChainStatusFilterNotState7_6FD02A40_113c(m, pQuest)
      QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c(m, pQuest)
      QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c(m, pQuest)
      QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c(m, pQuest)
      QUESTS_ChainStatusFilterNotState5_6FD02F00_113c(m, pQuest)
      PLAYER_LevelUp_6FD0B090_113c(m, pPlayer, pGame)
      PARTY_DispatchRelationAction_6FD10A70_113c(m, 999, 1, pGame, pPlayer, 0)
    } finally {
      trace = endVaTrace113c()
    }
    const missing: string[] = []
    for (const spec of WAVE19_INDA_PE32_SPECS) {
      const key = `D2Game:0x${(spec.va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
      if (!trace.has(key)) {
        missing.push(key)
      }
    }
    expect(missing, `Missing live VA hits: ${missing.join(', ')}`).toEqual([])
  })
})
