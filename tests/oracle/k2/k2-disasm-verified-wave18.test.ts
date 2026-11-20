/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 18: +57 VAs).
 *
 * Audits and verifies 57 eligible `D2Game.dll` (`0x6FC20000`) closure functions across 2 shards:
 * - `k2w4-b3` (`src/d2kern-113c/game/k2-w4b3-113c.ts`, all 20 eligible; 0 `indirectUnknown`)
 * - `k2-remed-r3` (37 of 38 eligible across 11 files; 3 `indirectUnknown` VAs `0x6FC92220`,
 *   `0x6FC96A50`, `0x6FC96B20` and excluded `0x6FC4CB80` in `k2-laneJ-0x6fc4-w1-113c.ts` stay `ported`)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`,
 *    manifest promotion checks, and guardrails keeping the 3 `indirectUnknown` VAs and `0x6FC4CB80` at `ported`.
 * 2. Differential regression tests proving every real 1.13c binary disassembly discrepancy fixed in Wave 18
 *    across 16 VAs (`0x6FC22630`, `0x6FC304F0`, `0x6FC30600`, `0x6FC30730`, `0x6FC31A70`, `0x6FC32B90`,
 *    `0x6FC4BC90`, `0x6FC82D30`, `0x6FC83000`, `0x6FC860D0`, `0x6FC8A720`, `0x6FC8C200`, `0x6FC8C580`,
 *    `0x6FC8D7B0`, `0x6FC90CF0`, `0x6FCE00C0`).
 * 3. Live `beginVaTrace113c()` / `endVaTrace113c()` execution across all 57/57 promoted VAs.
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
  PATH_TYPE_FLAGS_6FDE4180,
  PATH_TYPE_STEP_NUMS_6FDE4138,
} from '../../../src/d2kern-113c/common/path.ts'
import {
  STATLIST_CreateEx113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import { MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c } from '../../../src/d2kern-113c/game/k2-w11b1-113c.ts'
import { NPCS_HandleNpcMenuRequest_6FCE00C0_113c } from '../../../src/d2kern-113c/game/k2-w16b1-113c.ts'
import { ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c } from '../../../src/d2kern-113c/game/k2-w3b1-113c.ts'
import {
  OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c,
  OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c,
  OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c.ts'
import {
  AI_TentacleSkillCastA_6FC9C060_113c,
  AI_TentacleSkillCastB_6FC9C1D0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c.ts'
import {
  ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c,
  ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c,
  ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c,
  ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c.ts'
import * as w4b3 from '../../../src/d2kern-113c/game/k2-w4b3-113c.ts'
import { SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c } from '../../../src/d2kern-113c/game/k2-w4b6-113c.ts'
import { MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c } from '../../../src/d2kern-113c/game/k2-w5b1-113c.ts'
import { ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c } from '../../../src/d2kern-113c/game/k2-w6b4-113c.ts'
import { MONAI_DarkWandererThink_6FCC6E60_113c } from '../../../src/d2kern-113c/game/k2-w8b2-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ItemsTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2RoomExStrc,
  D2SkillListStrc,
  D2SkillStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_ITEMS_LINKER_PTR_VA,
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

interface BindingEntry {
  readonly module: string
  readonly va: string
  readonly name: string
  readonly kernFile: string
  readonly tsSymbol: string
  readonly status: string
  readonly diffEvidence?: string
}

interface DisasmVaSpec {
  readonly batch: 'k2w4-b3' | 'k2-remed-r3'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE18_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  // k2w4-b3: 20 eligible VAs (0 indirectUnknown)
  { batch: 'k2w4-b3', va: '0x6FC22630', size: 180, headHex: '51538bd83b5e0455', tailHex: '5b59c3', tsSymbol: 'STORM_TSListArrayResize_6FC22630_113c' },
  { batch: 'k2w4-b3', va: '0x6FC304F0', size: 88, headHex: '578bf8e818ddffff', tailHex: 'ff5fc3', tsSymbol: 'ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c' },
  { batch: 'k2w4-b3', va: '0x6FC30600', size: 186, headHex: '53568bf1568bd8e8', tailHex: 'c20400', tsSymbol: 'ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c' },
  { batch: 'k2w4-b3', va: '0x6FC30730', size: 126, headHex: '56578bf98bf0e8d5', tailHex: '5f5ec3', tsSymbol: 'ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c' },
  { batch: 'k2w4-b3', va: '0x6FC82D30', size: 95, headHex: '5356578bfa578bd9', tailHex: 'c20400', tsSymbol: 'ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c' },
  { batch: 'k2w4-b3', va: '0x6FC83000', size: 194, headHex: '515355568bda538b', tailHex: 'c20400', tsSymbol: 'ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c' },
  { batch: 'k2w4-b3', va: '0x6FC830D0', size: 179, headHex: '51535556578bfa57', tailHex: 'c20400', tsSymbol: 'ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c' },
  { batch: 'k2w4-b3', va: '0x6FC860D0', size: 581, headHex: '8b4424048b80f410', tailHex: 'c21000', tsSymbol: 'ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c' },
  { batch: 'k2w4-b3', va: '0x6FC89EE0', size: 184, headHex: '558b6c24085733ff', tailHex: 'c20400', tsSymbol: 'OBJ_CalcShrineStatBonusValue_6FC89EE0_113c' },
  { batch: 'k2w4-b3', va: '0x6FC8A4E0', size: 120, headHex: '83ec145356578bf2', tailHex: 'c414c3', tsSymbol: 'OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c' },
  { batch: 'k2w4-b3', va: '0x6FC8A720', size: 125, headHex: '53558b6c2410568b', tailHex: 'c20800', tsSymbol: 'OBJ_TryOperateObjectIfInRange_6FC8A720_113c' },
  { batch: 'k2w4-b3', va: '0x6FC8B6F0', size: 107, headHex: '83ec1456578bf28b', tailHex: 'c414c3', tsSymbol: 'OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c' },
  { batch: 'k2w4-b3', va: '0x6FC8B860', size: 16, headHex: '566871010000518b', tailHex: 'ff5ec3', tsSymbol: 'OBJ_SpawnMonster369FromObject_6FC8B860_113c' },
  { batch: 'k2w4-b3', va: '0x6FC8B870', size: 16, headHex: '566849010000518b', tailHex: 'ff5ec3', tsSymbol: 'OBJ_SpawnMonster329FromObject_6FC8B870_113c' },
  { batch: 'k2w4-b3', va: '0x6FC8B880', size: 16, headHex: '566846010000518b', tailHex: 'ff5ec3', tsSymbol: 'OBJ_SpawnMonster326FromObject_6FC8B880_113c' },
  { batch: 'k2w4-b3', va: '0x6FC8B890', size: 16, headHex: '56684a010000518b', tailHex: 'ff5ec3', tsSymbol: 'OBJ_SpawnMonster330FromObject_6FC8B890_113c' },
  { batch: 'k2w4-b3', va: '0x6FC8CE10', size: 197, headHex: '568bf18b460485c0', tailHex: 'c05ec3', tsSymbol: 'OBJ_OperateFn48_TrappedSoul_6FC8CE10_113c' },
  { batch: 'k2w4-b3', va: '0x6FC8D7B0', size: 310, headHex: '568bf18b460485c0', tailHex: 'c05ec3', tsSymbol: 'OBJ_OperateFn28_Urn_6FC8D7B0_113c' },
  { batch: 'k2w4-b3', va: '0x6FC90CF0', size: 101, headHex: '558bec83e4f881ec', tailHex: 'c20800', tsSymbol: 'CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c' },
  { batch: 'k2w4-b3', va: '0x6FC90D90', size: 530, headHex: '568bf085f6743283', tailHex: 'c20400', tsSymbol: 'PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c' },
  // k2-remed-r3: 37 of 38 eligible VAs (0x6FC4CB80 excluded; 0x6FC92220/0x6FC96A50/0x6FC96B20 indirectUnknown stay ported)
  { batch: 'k2-remed-r3', va: '0x6FC31A70', size: 545, headHex: '81ec9c00000085db', tailHex: 'c21800', tsSymbol: 'ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC31CA0', size: 373, headHex: '558bec83e4f881ec', tailHex: 'c21000', tsSymbol: 'ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC31E20', size: 392, headHex: '558bec83e4f881ec', tailHex: 'c21400', tsSymbol: 'ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC31FB0', size: 294, headHex: '558bec83e4f881ec', tailHex: 'c20c00', tsSymbol: 'ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC320E0', size: 336, headHex: '558bec83e4f881ec', tailHex: 'c20400', tsSymbol: 'ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC32230', size: 334, headHex: '558bec83e4f881ec', tailHex: 'c20c00', tsSymbol: 'ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC32B90', size: 460, headHex: '558bec83e4f881ec', tailHex: 'c20c00', tsSymbol: 'ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC32DF0', size: 232, headHex: '51555756e86176ff', tailHex: 'c20800', tsSymbol: 'ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC43650', size: 29, headHex: '8b44240885c07412', tailHex: 'c20800', tsSymbol: 'MONUMOD_SpectralHitMissileDamage_6FC43650_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC43BF0', size: 169, headHex: '83ec2055568bf285', tailHex: 'c20800', tsSymbol: 'MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC43CA0', size: 379, headHex: '558bec83e4f881ec', tailHex: 'c20c00', tsSymbol: 'MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC44BF0', size: 119, headHex: '56578bf885ff8bf1', tailHex: 'c20400', tsSymbol: 'MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC4BC90', size: 215, headHex: '83ec1053578bd8e8', tailHex: 'c410c3', tsSymbol: 'GAME_AssignUniqueGameName_6FC4BC90_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC57F80', size: 265, headHex: '83ec08558b6c2410', tailHex: 'c20800', tsSymbol: 'PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC5AAA0', size: 132, headHex: '55568b74240c85f6', tailHex: 'c20800', tsSymbol: 'MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC5BBB0', size: 78, headHex: '8b44240485c05356', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC5F670', size: 85, headHex: '5356578bda538bf1', tailHex: '5e5bc3', tsSymbol: 'MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC5F7D0', size: 188, headHex: '83ec08538bda85db', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC608D0', size: 590, headHex: '558bec83e4f881ec', tailHex: 'e55dc3', tsSymbol: 'MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC7C480', size: 318, headHex: '5155568b72188a86', tailHex: '5d59c3', tsSymbol: 'ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC7C5C0', size: 196, headHex: '8b018b80f4100000', tailHex: '015ec3', tsSymbol: 'ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC7C690', size: 445, headHex: '83ec08558b6c2414', tailHex: 'c20800', tsSymbol: 'ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC7E3C0', size: 86, headHex: '50e8b2c0faff50e8', tailHex: 'ffffc3', tsSymbol: 'ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC7E420', size: 310, headHex: '8b4c240483ec0855', tailHex: 'c20800', tsSymbol: 'ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC7EB30', size: 251, headHex: '578bf98b078b80f4', tailHex: 'ff5fc3', tsSymbol: 'ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC8AFA0', size: 204, headHex: '558bec83e4f881ec', tailHex: 'c20800', tsSymbol: 'OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC8B070', size: 385, headHex: '558bec83e4f881ec', tailHex: 'c21000', tsSymbol: 'ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC8B280', size: 96, headHex: '83ec08578bf98b47', tailHex: 'c408c3', tsSymbol: 'OBJ_OperateFn20_WeaponRack_6FC8B280_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC8B2E0', size: 96, headHex: '83ec08568bf18b46', tailHex: 'c408c3', tsSymbol: 'OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC8C200', size: 888, headHex: '558bec83e4f881ec', tailHex: 'e55dc3', tsSymbol: 'OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC8C580', size: 888, headHex: '558bec83e4f881ec', tailHex: 'e55dc3', tsSymbol: 'OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC9C060', size: 356, headHex: '83ec208b44242453', tailHex: 'c20400', tsSymbol: 'AI_TentacleSkillCastA_6FC9C060_113c' },
  { batch: 'k2-remed-r3', va: '0x6FC9C1D0', size: 356, headHex: '83ec208b44242453', tailHex: 'c20400', tsSymbol: 'AI_TentacleSkillCastB_6FC9C1D0_113c' },
  { batch: 'k2-remed-r3', va: '0x6FCA9730', size: 315, headHex: '538bd885db558b6c', tailHex: 'c20400', tsSymbol: 'MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c' },
  { batch: 'k2-remed-r3', va: '0x6FCC1350', size: 204, headHex: '558bec83e4f881ec', tailHex: 'c20800', tsSymbol: 'SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c' },
  { batch: 'k2-remed-r3', va: '0x6FCC6E60', size: 339, headHex: '83ec10535556578b', tailHex: 'c20400', tsSymbol: 'MONAI_DarkWandererThink_6FCC6E60_113c' },
  { batch: 'k2-remed-r3', va: '0x6FCE00C0', size: 2690, headHex: '8b44240c81ec0c01', tailHex: 'c21000', tsSymbol: 'NPCS_HandleNpcMenuRequest_6FCE00C0_113c' },
]

const WAVE18_INDIRECT_UNKNOWN_VAS = ['0x6FC92220', '0x6FC96A50', '0x6FC96B20'] as const
const WAVE18_EXCLUDED_VAS = ['0x6FC4CB80'] as const

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

function readCString(m: SparseMemory113c, addr: number): string {
  const bytes: number[] = []
  for (let i = 0; i < 64; i++) {
    const b = m.u8((addr + i) >>> 0)
    if (b === 0) break
    bytes.push(b)
  }
  return String.fromCharCode(...bytes)
}

function writeCString(m: SparseMemory113c, addr: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    m.setU8((addr + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((addr + text.length) >>> 0, 0)
}

function setQuestBit(m: SparseMemory113c, pQuestFlags: number, questId: number, bitNo: number, on: boolean): void {
  const pArr = m.u32(pQuestFlags >>> 0) >>> 0
  const bitIdx = ((questId << 4) + bitNo) | 0
  const byteAddr = (pArr + (bitIdx >> 3)) >>> 0
  const cur = m.u8(byteAddr)
  const mask = 1 << (bitIdx & 7)
  m.setU8(byteAddr, on ? (cur | mask) & 0xff : cur & ~mask & 0xff)
}

function createWave18World() {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(0x6fd18000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x28000, 0)
  m.fill(0x00f0_b000, 0x1000, 0)

  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)

  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  const pDataTablesSlot = m.alloc(4) >>> 0
  m.setU32(pDataTablesSlot, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pDataTablesSlot)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)

  // ItemStatCost (360 records)
  const pItemStatCost = m.alloc(360 * 0x144) >>> 0
  m.setU32(pDataTables + 0x2c, pItemStatCost)
  m.setU32(pDataTables + 0x34, 360)
  m.setU32(pDataTables + 0xbcc, pItemStatCost)
  m.setU32(pDataTables + 0xbd4, 360)
  m.setU32(0x6fde9e48, pItemStatCost)
  m.setU32(0x6fde9e50, 360)

  // ItemsTxt + linker
  const pItemsTxt = m.alloc(16 * D2ItemsTxt_SIZE) >>> 0
  m.setU32(pDataTables + 0x00, 16)
  m.setU32(pDataTables + 0x04, pItemsTxt)
  m.setU32(pDataTables + 0xbd8, pItemsTxt)
  m.setU32(pDataTables + 0xbdc, 16)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, 16)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(0x6fdefb9c, pItemsTxt)
  m.setU32(0x6fdefba0, 4)
  m.setU32(0x6fdefba4, pItemsTxt + 4 * D2ItemsTxt_SIZE)
  m.setU32(0x6fdefba8, 4)
  m.setU32(0x6fdefbac, pItemsTxt + 8 * D2ItemsTxt_SIZE)
  m.setU32(0x6fdefbb0, 8)

  const codes: Array<[number, number]> = [
    [9, 0x20646c67], // 'gld '
    [10, 0x206d7067], // 'gpm '
    [11, 0x206d706f], // 'opm '
    [4, 0x20706163], // 'cap '
    [0, 0x20786168], // 'hax '
    [12, 0x20786f62], // 'box '
    [8, 0x2079656b], // 'key '
  ]
  const pLinker = m.alloc(0x20) >>> 0
  const pLinkerRows = m.alloc(codes.length * 8) >>> 0
  m.setU32(pLinker + 0x00, codes.length)
  m.setU32(pLinker + 0x08, pLinkerRows)
  for (let i = 0; i < codes.length; i++) {
    const [idx, code] = codes[i]!
    const rec = (pItemsTxt + idx * D2ItemsTxt_SIZE) >>> 0
    m.setU32(rec + 0x80, code)
    m.setU32(rec + 0x84, code)
    m.setU8(rec + 0xfc, 1)
    m.setU8(rec + 0xfd, 1)
    m.setU8(rec + 0x10e, 1)
    m.setU8(rec + 0x10f, 1)
    m.setU16(rec + 0x11e, 1)
    m.setU8(rec + 0x133, 1)
    m.setU8(rec + 0x14d, 1)
    m.setU32(pLinkerRows + i * 8, code)
    m.setU32(pLinkerRows + i * 8 + 4, idx)
  }
  m.setU32(SGPT_ITEMS_LINKER_PTR_VA, pLinker)

  // ItemTypesTxt
  const pItemTypesTxt = m.alloc(16 * D2ItemTypesTxt_SIZE) >>> 0
  m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
  m.setU32(pDataTables + 0xbfc, 16)
  m.setU32(pDataTables + 0xc00, 1)
  const pTypeMatrix = m.alloc(64) >>> 0
  m.setU32(pTypeMatrix + 4, 1 << 1)
  m.setU32(pDataTables + 0xc04, pTypeMatrix)
  for (let i = 0; i < 16; i++) {
    m.setU8(pItemTypesTxt + i * D2ItemTypesTxt_SIZE + 0x11, 1)
  }

  // MonStatsTxt & MonStats2Txt
  const pMonStatsTxt = m.alloc(600 * 0x1a8) >>> 0
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 600)
  m.setU32(0x6fdf0950, pMonStatsTxt)
  m.setU32(0x6fdf0958, 600)
  const pMonStats2Txt = m.alloc(600 * 0x134) >>> 0
  m.setU32(pDataTables + 0xa84, pMonStats2Txt)
  m.setU32(pDataTables + 0xa8c, 600)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 600)
  for (let i = 0; i < 600; i++) {
    const rec = (pMonStatsTxt + i * 0x1a8) >>> 0
    m.setU16(rec + 0x00, i)
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x06, i)
    m.setU16(rec + 0x18, i)
    m.setU16(rec + 0x56, 10)
  }

  // Skills, Missiles, States, Objects, Levels
  const pSkillsTxt = m.alloc(360 * 0x23c) >>> 0
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 360)
  const pMissilesTxt = m.alloc(400 * 0x1a4) >>> 0
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 400)
  m.setU32(0x6fdf0a3c, pMissilesTxt)
  m.setU32(0x6fdf0a44, 400)
  for (let i = 0; i < 400; i++) {
    const rec = (pMissilesTxt + i * 0x1a4) >>> 0
    m.setU16(rec + 0x00, i)
    m.setU16(rec + 0x96, 10) // base range
    m.setU16(rec + 0x98, 5) // lev range
    m.setU8(rec + 0x9a, 12) // base velocity
    m.setU8(rec + 0x9b, 4) // sub-level velocity step
    m.setU8(rec + 0x9c, 24) // max velocity
    m.setU16(rec + 0x9e, 0) // accel
  }
  const pStatesTxt = m.alloc(200 * 0x40) >>> 0
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, 200)
  m.setU32(pDataTables + 0xbbc, pStatesTxt)
  m.setU32(pDataTables + 0xbc0, 200)
  const pObjectsTxt = m.alloc(600 * 0x1c0) >>> 0
  m.setU32(pDataTables + 0xc98, pObjectsTxt)
  m.setU32(pDataTables + 0xca0, 600)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE) >>> 0
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, 140)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const rec = (pLevelsTxt + lvl * D2LevelsTxt_SIZE) >>> 0
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(rec, D2LevelsTxt.nAct, act)
    m.setU8(rec + 0x51, 5)
    m.setU8(rec + 0x54, 5)
  }

  // AnimData, town levels, path tables, FieldTbls
  const pAnimDataTable = m.alloc(0x420) >>> 0
  const pEmptyBucket = m.alloc(16) >>> 0
  for (let i = 0; i < 256; i++) m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13a4, 16)
  m.setU32(0x6fdf13b0, m.alloc(16 * 0x34))
  m.setU32(0x6fdf13c0, m.alloc(8 * 0x34))
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34))

  const townLevels = [1, 40, 75, 103, 109]
  for (let act = 0; act < 5; act++) m.setU32(0x6fde4084 + act * 4, townLevels[act]!)
  for (let i = 0; i < PATH_TYPE_STEP_NUMS_6FDE4138.length; i++) {
    m.setU32((0x6fde4138 + i * 4) >>> 0, PATH_TYPE_STEP_NUMS_6FDE4138[i]! >>> 0)
  }
  for (let i = 0; i < PATH_TYPE_FLAGS_6FDE4180.length; i++) {
    m.setU32((0x6fde4180 + i * 4) >>> 0, PATH_TYPE_FLAGS_6FDE4180[i]! >>> 0)
  }
  m.fill(0x6fde41c8, 64 * 4, 1)

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

  const pGame = m.alloc(0x2000) >>> 0
  m.setU8(pGame + 0x6d, 0)
  m.setU32(pGame + 0x70, 1)
  m.setU16(pGame + 0x78, 100)
  // Always initialize non-zero RNG seeds (lo, hi)
  m.setU32(pGame + 0xd0, 0x12345678)
  m.setU32(pGame + 0xd4, 0x00000007)
  const pObjCtrl = m.alloc(0x600) >>> 0
  const pRegion0 = m.alloc(0x40) >>> 0
  m.setU32(pRegion0 + 0x1c, 0xffffffff)
  m.setU32(pObjCtrl + 0x48, pRegion0)
  m.setU32(pObjCtrl + 2 * 4 + 0x48, m.alloc(0x40))
  m.setU32(pGame + 0x10f0, pObjCtrl)
  const pQuestCtrl = m.alloc(0x100) >>> 0
  const pQuest6Default = m.alloc(0x100) >>> 0
  m.setU32(pQuest6Default + 0x00, 6)
  m.setU32(pQuest6Default + 0x18, m.alloc(0x200))
  m.setU32(pQuestCtrl + 0x00, pQuest6Default)
  m.setU32(pQuestCtrl + 0x08, 1)
  m.setU32(pGame + 0x10f4, pQuestCtrl)
  m.setU32(pGame + 0xf0, m.alloc(0x300))
  m.setU32(pGame + 0xf0 + 2 * 4, m.alloc(0x300))
  m.setU32(pGame + 0xf0 + 38 * 4, m.alloc(0x300))
  const pArena = m.alloc(0x20) >>> 0
  m.setU32(pArena + 0x04, m.alloc(0x40 * 0x44))
  m.setU32(pGame + 0x1d24, pArena)
  EVENT_InitTimerQueue113c(m, pGame)

  const pRoom = allocWalkableRoom(m, 2, 100, 100, 40, 40)

  return { m, pDataTables, pGame, pRoom, pMonStatsTxt, pObjectsTxt, pMissilesTxt, pQuestCtrl }
}

function allocWalkableRoom(
  m: SparseMemory113c,
  nLevelId = 2,
  x = 100,
  y = 100,
  w = 40,
  h = 40,
): number {
  const pRoom = m.alloc(0x90) >>> 0
  const pRoomEx = m.alloc(0x90) >>> 0
  const pLevel = m.alloc(0x220) >>> 0
  const pAct = m.alloc(0x80) >>> 0
  const ppNear = m.alloc(8) >>> 0
  const pActFlag = m.alloc(4) >>> 0
  m.setU32(ppNear, pRoom)
  m.setU32(pRoom, ppNear)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x24, 1)
  m.setU32(pRoom + 0x2c, pActFlag)
  m.setU32(pRoom + 0x3c, pAct)
  m.setU32(pRoom + 0x4c, x)
  m.setU32(pRoom + 0x50, y)
  m.setU32(pRoom + 0x54, w)
  m.setU32(pRoom + 0x58, h)
  // Non-zero RNG seeds
  m.setU32(pRoom + 0x6c, 0x13572468)
  m.setU32(pRoom + 0x70, 0x00000003)
  const pLogical = m.alloc(0x40) >>> 0
  m.setU8(pLogical, 1)
  m.setU32(pRoomEx + 0x58, pLevel)
  m.set(pRoomEx, D2RoomExStrc.pLogicalRoomInfo, pLogical)
  m.setU32(pLevel + 0x1d0, nLevelId)
  const pCollGrid = m.alloc(0x28) >>> 0
  const pCollMap = m.alloc(w * h * 2) >>> 0
  m.setU32(pCollGrid + 0x00, x)
  m.setU32(pCollGrid + 0x04, y)
  m.setU32(pCollGrid + 0x08, w)
  m.setU32(pCollGrid + 0x0c, h)
  m.setU32(pCollGrid + 0x20, pCollMap)
  m.setU32(pRoom + 0x20, pCollGrid)
  return pRoom
}

function allocDynUnit(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  dwType: number,
  dwClassId: number,
  dwGuid: number,
  x = 110,
  y = 110,
): { pUnit: number; pData: number; pPath: number; pQFlags: number } {
  const pUnit = m.alloc(0x100) >>> 0
  const pData = m.alloc(0x160) >>> 0
  const pPath = m.alloc(0x200) >>> 0
  const pQFlags = m.alloc(0x20) >>> 0
  const pQBits = m.alloc(0x80) >>> 0
  m.setU32(pQFlags, pQBits)
  m.setU32(pData + 0x10, pQFlags)
  m.setU32(pData + 0x14, pQFlags)
  m.setU32(pData + 0x18, pQFlags)
  m.setU32(pUnit + 0x00, dwType)
  m.setU32(pUnit + 0x04, dwClassId)
  m.setU32(pUnit + 0x0c, dwGuid >>> 0)
  m.setU32(pUnit + 0x10, dwType === 1 ? 1 : 0)
  m.setU32(pUnit + 0x14, pData)
  // Non-zero RNG seeds
  m.setU32(pUnit + 0x20, 0xabcdef01)
  m.setU32(pUnit + 0x24, 0x00000005)
  m.setU32(pUnit + 0x2c, pPath)
  m.setU32(pUnit + 0x80, pGame)
  m.setU16(pPath + 0x02, x)
  m.setU16(pPath + 0x06, y)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pUnit)
  m.setU32(pPath + 0x34, 1)
  const pStatList = STATLIST_CreateEx113c(m, pUnit, 0x80000000, pGame)
  m.setU32(pUnit + 0x5c, pStatList)
  STATLIST_SetUnitStat113c(m, pUnit, 12, 15, 0)
  return { pUnit, pData, pPath, pQFlags }
}

describe('K2 Wave 18 Disassembly Verification (+57 D2Game.dll VAs: k2w4-b3 & k2-remed-r3)', () => {
  it('verifies PE32 machine-code opcodes, manifest promotion, and indirectUnknown/exclusion guardrails', () => {
    expect(WAVE18_PROMOTED_SPECS.length).toBe(57)

    const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    const byVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        byVa.set(fn.va.toUpperCase(), fn)
      }
    }

    const w4b3Bindings: BindingEntry[] = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'tools/oracle/callgraph/bindings/k2w4-b3.json'), 'utf8'),
    )
    const r3Bindings: BindingEntry[] = JSON.parse(
      fs.readFileSync(
        path.join(REPO_ROOT, 'tools/oracle/callgraph/bindings/k2-remed-r3.json'),
        'utf8',
      ),
    )
    const bindByVa = new Map<string, BindingEntry>()
    for (const b of [...w4b3Bindings, ...r3Bindings]) {
      bindByVa.set(b.va.toUpperCase(), b)
    }

    // 1. Check all 57 promoted VAs in bindings and manifest
    for (const spec of WAVE18_PROMOTED_SPECS) {
      const vaU = spec.va.toUpperCase()
      const fn = byVa.get(vaU)
      expect(fn, `Missing manifest entry for ${spec.va}`).toBeDefined()
      expect(fn!.size).toBe(spec.size)
      expect(fn!.indirectUnknown ?? false).toBe(false)
      expect(fn!.status).toBe('diff-verified')
      expect(fn!.tsSymbol).toBe(spec.tsSymbol)
      expect(fn!.diffEvidence).toContain('tests/oracle/k2/k2-disasm-verified-wave18.test.ts')

      const b = bindByVa.get(vaU)
      expect(b, `Missing binding entry for ${spec.va}`).toBeDefined()
      expect(b!.status).toBe('diff-verified')
      expect(b!.tsSymbol).toBe(spec.tsSymbol)
    }

    // 2. Guardrail: 3 formerly indirectUnknown VAs promoted in Wave 23 (Batch B); 0x6FC4CB80 audited in Wave 22 & promoted in Wave 24
    for (const va of WAVE18_INDIRECT_UNKNOWN_VAS) {
      const fn = byVa.get(va.toUpperCase())
      expect(fn, `Missing manifest entry ${va}`).toBeDefined()
      expect(fn!.indirectUnknown).toBeUndefined()
      expect(fn!.status).toBe('diff-verified')
      const b = bindByVa.get(va.toUpperCase())
      expect(b!.status).toBe('diff-verified')
    }
    for (const va of WAVE18_EXCLUDED_VAS) {
      const fn = byVa.get(va.toUpperCase())
      expect(fn, `Missing excluded manifest entry ${va}`).toBeDefined()
      expect(fn!.indirectUnknown).toBeUndefined()
      expect(fn!.status).toBe('diff-verified')
      const b = bindByVa.get(va.toUpperCase())
      expect(b!.status).toBe('diff-verified')
    }

    // 3. PE32 raw opcode check against D2Game.dll when present
    const d2GamePath = path.join(D2_DATA_DIR, 'D2Game.dll')
    if (fs.existsSync(d2GamePath)) {
      const pe = loadPeSectionMapper(d2GamePath, 0x6fc20000)
      for (const spec of WAVE18_PROMOTED_SPECS) {
        const vaNum = Number.parseInt(spec.va, 16)
        expect(vaNum).toBeGreaterThanOrEqual(pe.textStart)
        expect(vaNum + spec.size).toBeLessThanOrEqual(pe.textEnd)
        const off = pe.vaToFileOffset(vaNum)
        const head = pe.buf.subarray(off, off + 8).toString('hex')
        const tail = pe.buf.subarray(off + spec.size - 3, off + spec.size).toString('hex')
        expect(head, `${spec.va} head bytes mismatch`).toBe(spec.headHex)
        expect(tail, `${spec.va} tail bytes mismatch`).toBe(spec.tailHex)
      }
    }
  })

  it('regresses 0x6FC22630: calls STORM_TSListDestroySehWrapper (0x6FC21F60) on shrink and copy-destroy', () => {
    const { m } = createWave18World()
    const initList = (pList: number) => {
      m.setU32(pList + 0x00, 4)
      m.setU32(pList + 0x04, (pList + 0x04) >>> 0)
      m.setU32(pList + 0x08, (~((pList + 0x04) >>> 0)) >>> 0)
    }

    // Case A: shrink from 3 -> 1 calls 0x6FC21F60 on tail elements
    const pArrShrink = m.alloc(0x20) >>> 0
    const pOldShrink = m.alloc(0x40) >>> 0
    m.setU32(pArrShrink + 0x04, 3)
    m.setU32(pArrShrink + 0x08, pOldShrink)
    for (let i = 0; i < 3; i++) initList((pOldShrink + i * 12) >>> 0)
    beginVaTrace113c()
    w4b3.STORM_TSListArrayResize_6FC22630_113c(m, pArrShrink, 1, {
      onSMemReAlloc: (_mem, pOld) => pOld,
    })
    const hitsShrink = endVaTrace113c()
    expect(hitsShrink.has('D2Game:0x6FC22630')).toBe(true)
    expect(hitsShrink.has('D2Game:0x6FC21F60')).toBe(true)
    expect(hitsShrink.has('D2Game:0x6FC21FE0')).toBe(true)

    // Case B: realloc returns 0 -> copy-construct + destroy old entries via 0x6FC21F60
    const pArrGrow = m.alloc(0x20) >>> 0
    const pOldGrow = m.alloc(0x40) >>> 0
    m.setU32(pArrGrow + 0x04, 2)
    m.setU32(pArrGrow + 0x08, pOldGrow)
    for (let i = 0; i < 2; i++) initList((pOldGrow + i * 12) >>> 0)
    beginVaTrace113c()
    w4b3.STORM_TSListArrayResize_6FC22630_113c(m, pArrGrow, 4)
    const hitsGrow = endVaTrace113c()
    expect(hitsGrow.has('D2Game:0x6FC21F60')).toBe(true)
    expect(hitsGrow.has('D2Game:0x6FC226F0')).toBe(true)
  })

  it('regresses 0x6FC304F0, 0x6FC30600, 0x6FC30730, and 0x6FC31A70 assert line 2503', () => {
    const { m, pGame } = createWave18World()
    const pItem = m.alloc(0x100) >>> 0
    const pItemData = m.alloc(0x80) >>> 0
    m.setU32(pItem + 0x00, 4)
    m.setU32(pItem + 0x04, 0)
    m.setU32(pItem + 0x14, pItemData)
    m.setU32(pItem + 0x80, pGame)
    m.setU32(pItem + 0x20, 0x11223344)
    m.setU32(pItem + 0x24, 1)
    m.setU16(pItemData + 0x30, 100)
    const ppItem = m.alloc(8) >>> 0
    m.setU32(ppItem, pItem)
    const pdwSeed = m.alloc(8) >>> 0
    m.setU32(pdwSeed, 0x22334455)
    const pDrop = m.alloc(0x90) >>> 0
    m.setU32(pDrop + 0x08, pGame)

    // 0x6FC304F0 must invoke 0x6FC2EE90 (not ITEMS_ApplySocketAndEtherealBonuses113c)
    beginVaTrace113c()
    w4b3.ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c(m, ppItem, pdwSeed, pDrop, {
      onTryRollAndApplyMagicAffixes_6FC303C0: () => 1,
    })
    const hitsMagic = endVaTrace113c()
    expect(hitsMagic.has('D2Game:0x6FC304F0')).toBe(true)
    expect(hitsMagic.has('D2Game:0x6FC2EE90')).toBe(true)
    expect(m.u32(pDrop + 0x30)).toBe(4)

    // 0x6FC30730 must invoke 0x6FC2EE90 unconditionally (no bogus SocketAndEthereal fallback)
    beginVaTrace113c()
    w4b3.ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c(m, ppItem, pdwSeed, pDrop)
    const hitsRare = endVaTrace113c()
    expect(hitsRare.has('D2Game:0x6FC30730')).toBe(true)
    expect(hitsRare.has('D2Game:0x6FC2EE90')).toBe(true)
    expect(m.u32(pDrop + 0x30)).toBe(6)

    // 0x6FC30600 default branch must invoke 0x6FC33DE0 + 0x6FC2EC90 even when tables are unloaded
    m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, 0)
    m.setU32(0x6fde9e1c, 0)
    beginVaTrace113c()
    w4b3.ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c(m, pItem, pDrop, pGame)
    const hitsMods = endVaTrace113c()
    expect(hitsMods.has('D2Game:0x6FC30600')).toBe(true)
    expect(hitsMods.has('D2Game:0x6FC33DE0')).toBe(true)
    expect(hitsMods.has('D2Game:0x6FC2EC90')).toBe(true)

    // 0x6FC31A70 null pGame Fog assert line must be 2503 (0x9C7)
    let caught: unknown
    try {
      w4b3.ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(m, 0, pItem, 2, m.alloc(4), pDrop, 0, 0)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(D2CommonAssertError)
    expect((caught as D2CommonAssertError).line).toBe(2503)
  })

  it('regresses 0x6FC32B90: inlines 0x6FC21280 + 0x6FD9D7E0 without spurious 0x6FC2E930 hit', () => {
    const { m, pGame, pRoom } = createWave18World()
    const { pUnit: pPlayer } = allocDynUnit(m, pGame, pRoom, 0, 0, 501, 112, 112)
    beginVaTrace113c()
    ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(m, pGame, pPlayer, 150)
    const hits = endVaTrace113c()
    expect(hits.has('D2Game:0x6FC32B90')).toBe(true)
    expect(hits.has('D2Game:0x6FC21280')).toBe(true)
    expect(hits.has('D2Common:0x6FD9D7E0')).toBe(true)
    expect(hits.has('D2Game:0x6FC2E930')).toBe(false)
  })

  it('regresses 0x6FC4BC90: collision suffixes use 0x6FD1CDB8 "%s~%d" tilde format', () => {
    const { m, pGame } = createWave18World()
    const szBase = m.alloc(0x20) >>> 0
    writeCString(m, szBase, 'Baal')
    const seen: string[] = []
    w4b3.GAME_AssignUniqueGameName_6FC4BC90_113c(m, pGame, szBase, {
      onIsGameNameAvailable_6FC4ABD0: (_mem, pStr) => {
        const s = readCString(m, pStr)
        seen.push(s)
        return s === 'Baal~2' ? 1 : 0
      },
    })
    expect(seen).toEqual(['Baal', 'Baal~0', 'Baal~1', 'Baal~2'])
    expect(readCString(m, pGame + 0x2a)).toBe('Baal~2')

    // Truncation at byte 0x0B when strlen >= 13 (15 - len < 3)
    const szLong = m.alloc(0x20) >>> 0
    writeCString(m, szLong, 'ABCDEFGHIJKLM')
    w4b3.GAME_AssignUniqueGameName_6FC4BC90_113c(m, pGame, szLong, {
      onIsGameNameAvailable_6FC4ABD0: (_mem, pStr) => (readCString(m, pStr) === 'ABCDEFGHIJK~0' ? 1 : 0),
    })
    expect(readCString(m, pGame + 0x2a)).toBe('ABCDEFGHIJK~0')
  })

  it('regresses 0x6FC82D30: OR semantics for quest 1 bits 0x0D and 0x0E', () => {
    const { m, pGame, pRoom } = createWave18World()
    const { pUnit: pPlr, pQFlags } = allocDynUnit(m, pGame, pRoom, 0, 0, 502, 112, 112)
    // Mark bit (1, 0) set so first guard is skipped
    setQuestBit(m, pQFlags, 1, 0, true)

    // Case 1: bit 0x0D set, bit 0x0E clear -> MUST send alert 0x6FC554F0
    setQuestBit(m, pQFlags, 1, 0x0d, true)
    setQuestBit(m, pQFlags, 1, 0x0e, false)
    beginVaTrace113c()
    w4b3.ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c(m, pGame, pPlr)
    expect(endVaTrace113c().has('D2Game:0x6FC554F0')).toBe(true)

    // Case 2: bit 0x0D clear, bit 0x0E set -> MUST send alert 0x6FC554F0
    setQuestBit(m, pQFlags, 1, 0x0d, false)
    setQuestBit(m, pQFlags, 1, 0x0e, true)
    beginVaTrace113c()
    w4b3.ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c(m, pGame, pPlr)
    expect(endVaTrace113c().has('D2Game:0x6FC554F0')).toBe(true)

    // Case 3: both 0x0D and 0x0E clear -> MUST NOT send alert
    setQuestBit(m, pQFlags, 1, 0x0d, false)
    setQuestBit(m, pQFlags, 1, 0x0e, false)
    beginVaTrace113c()
    w4b3.ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c(m, pGame, pPlr)
    expect(endVaTrace113c().has('D2Game:0x6FC554F0')).toBe(false)
  })

  it('regresses 0x6FC83000: syncs Act 1 (bAct == 0) players and returns early for Act > 0', () => {
    const { m, pGame, pQuestCtrl } = createWave18World()
    const pQuest6 = m.alloc(0x100) >>> 0
    const pQ6Data = m.alloc(0x200) >>> 0
    m.setU32(pQuest6 + 0x00, 6)
    m.setU32(pQuest6 + 0x18, pQ6Data)
    m.setU32(pQuestCtrl, pQuest6)

    // Player in Act 2 (level 40 -> bAct = 1): MUST return early without adding GUID
    const pAct2Room = allocWalkableRoom(m, 40, 100, 100, 40, 40)
    const { pUnit: pPlrAct2 } = allocDynUnit(m, pGame, pAct2Room, 0, 0, 777, 110, 110)
    beginVaTrace113c()
    w4b3.ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c(m, pGame, pPlrAct2)
    expect(endVaTrace113c().has('D2Game:0x6FC82640')).toBe(false)

    // Player in Act 1 (level 2 -> bAct = 0): MUST sync GUID lists and call 0x6FC82640
    const pAct1Room = allocWalkableRoom(m, 2, 100, 100, 40, 40)
    const { pUnit: pPlrAct1 } = allocDynUnit(m, pGame, pAct1Room, 0, 0, 888, 110, 110)
    beginVaTrace113c()
    w4b3.ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c(m, pGame, pPlrAct1)
    expect(endVaTrace113c().has('D2Game:0x6FC82640')).toBe(true)
    expect(m.u32(pQ6Data + 0x80)).toBeGreaterThan(0)
  })

  it('regresses 0x6FC860D0: reads roomW/roomH at +0x08/+0x0C and applies step>20 curX=nY fallback', () => {
    const { m, pGame, pQuestCtrl } = createWave18World()
    const pQuest4 = m.alloc(0x100) >>> 0
    const pQ4Data = m.alloc(0x100) >>> 0
    m.setU32(pQuest4 + 0x00, 4)
    m.setU32(pQuest4 + 0x18, pQ4Data)
    m.setU32(pQuestCtrl, pQuest4)

    const findMonsterByGuid = (guid: number): number => {
      let cur = m.u32((pGame + 0x1320 + (guid & 0x7f) * 4) >>> 0) >>> 0
      while (cur !== 0 && m.u32((cur + 0x0c) >>> 0) !== guid >>> 0) {
        cur = m.u32((cur + 0xe4) >>> 0) >>> 0
      }
      return cur
    }

    // Room box [100..139, 100..139] -> coords (95, 95) enter box at step 5 -> (100, 100)
    // With the old +0x0C/+0x10 bug, roomH was 0 so the box check ALWAYS failed!
    const pTristRoom = allocWalkableRoom(m, 38, 100, 100, 40, 40)
    w4b3.ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c(m, pGame, pTristRoom, 95, 95)
    expect(m.u8(pQ4Data + 0x51)).toBe(1)
    const grisGuid1 = m.u32(pQ4Data + 0x68) >>> 0
    expect(grisGuid1).toBeGreaterThan(0)
    const pGris1 = findMonsterByGuid(grisGuid1)
    expect(pGris1).toBeGreaterThan(0)
    expect(m.u32(pGris1 + 0x04)).toBe(0x109)
    const pPath1 = m.u32(pGris1 + 0x2c) >>> 0
    const gx1 = m.u16(pPath1 + 0x02)
    const gy1 = m.u16(pPath1 + 0x06)
    // Clamped to (100, 100) via roomW/roomH (+0x08/+0x0C), then placed within MONSTER_Create radius (~5..7)
    expect(Math.abs(gx1 - 100)).toBeLessThanOrEqual(8)
    expect(Math.abs(gy1 - 100)).toBeLessThanOrEqual(8)

    // Exhaust 21 steps: room box [200..239, 200..239], start (10, 50) -> step>20 sets curX = nY (50), curY = 50+21 (71)
    // Attach neighbor room [40..99, 40..99] so (50, 71) resolves cleanly while old buggy (31, 50) would lie outside!
    const pRoom2 = allocWalkableRoom(m, 38, 200, 200, 40, 40)
    const pNeighbor = allocWalkableRoom(m, 38, 40, 40, 60, 60)
    const ppNear2 = m.alloc(8) >>> 0
    m.setU32(ppNear2 + 0x00, pRoom2)
    m.setU32(ppNear2 + 0x04, pNeighbor)
    m.setU32(pRoom2 + 0x00, ppNear2)
    m.setU32(pRoom2 + 0x24, 2)
    w4b3.ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c(m, pGame, pRoom2, 10, 50)
    const grisGuid2 = m.u32(pQ4Data + 0x68) >>> 0
    expect(grisGuid2).not.toBe(grisGuid1)
    const pGris2 = findMonsterByGuid(grisGuid2)
    expect(pGris2).toBeGreaterThan(0)
    const pPath2 = m.u32(pGris2 + 0x2c) >>> 0
    const gx2 = m.u16(pPath2 + 0x02)
    const gy2 = m.u16(pPath2 + 0x06)
    expect(Math.abs(gx2 - 50)).toBeLessThanOrEqual(8)
    expect(Math.abs(gy2 - 71)).toBeLessThanOrEqual(8)
  })

  it('regresses 0x6FC8A720: binary parameter order (wUnitType, pPlayer, pGame, dwObjectId)', () => {
    const { m, pGame, pRoom, pObjectsTxt } = createWave18World()
    const { pUnit: pPlayer } = allocDynUnit(m, pGame, pRoom, 0, 0, 601, 110, 110)
    const pObj = m.alloc(0x100) >>> 0
    const pObjData = m.alloc(0x40) >>> 0
    const pObjPath = m.alloc(0x40) >>> 0
    m.setU32(pObjData + 0x00, (pObjectsTxt + 0x1c0) >>> 0)
    m.setU32(pObj + 0x00, 2)
    m.setU32(pObj + 0x04, 1)
    m.setU32(pObj + 0x0c, 9001)
    m.setU32(pObj + 0x14, pObjData)
    m.setU32(pObj + 0x2c, pObjPath)
    m.setU32(pObjPath + 0x00, pRoom)
    m.setU32(pObjPath + 0x0c, 110)
    m.setU32(pObjPath + 0x10, 110)
    SUNIT_InsertServerUnit113c(m, pGame, pObj)

    // With fixed binary arg order (pGame, dwObjectId), finds object 9001 and invokes 0x6FC8A330
    beginVaTrace113c()
    w4b3.OBJ_TryOperateObjectIfInRange_6FC8A720_113c(m, 2, pPlayer, pGame, 9001)
    const hits = endVaTrace113c()
    expect(hits.has('D2Game:0x6FC8A720')).toBe(true)
    expect(hits.has('D2Game:0x6FC8A330')).toBe(true)
  })

  it('regresses 0x6FC8C200 & 0x6FC8C580: exact D2MissileStrc +0x10..+0x30 offsets & inline 64-bit LCG', () => {
    const runShrineCase = (isExploding: boolean, expectedMissileId: number) => {
      const { m, pGame, pRoom } = createWave18World()
      const { pUnit: pPlayer } = allocDynUnit(m, pGame, pRoom, 0, 0, 701, 114, 114)
      STATLIST_SetUnitStat113c(m, pPlayer, 12, 25, 0) // lvl 25 -> clamp(trunc(25/5), 1, 8) = 5

      const pObj = m.alloc(0x100) >>> 0
      const pObjPath = m.alloc(0x40) >>> 0
      m.setU32(pObj + 0x00, 2)
      m.setU32(pObj + 0x0c, 702)
      m.setU32(pObj + 0x20, 0x13579bdf)
      m.setU32(pObj + 0x24, 0x00000003)
      m.setU32(pObj + 0x2c, pObjPath)
      m.setU32(pObjPath + 0x00, pRoom)
      m.setU32(pObjPath + 0x0c, 120)
      m.setU32(pObjPath + 0x10, 120)

      const pOpArgs = m.alloc(0x30) >>> 0
      m.setU32(pOpArgs + 0x00, pGame)
      m.setU32(pOpArgs + 0x04, pObj)
      m.setU32(pOpArgs + 0x08, pPlayer)

      const pShrineTxt = m.alloc(0x40) >>> 0
      m.setU32(pShrineTxt + 0x04, 1) // nMin = 1
      m.setU32(pShrineTxt + 0x08, 3) // nMax = 3 -> nSpan = 2 > 0 exercises inline 64-bit LCG

      beginVaTrace113c()
      if (isExploding) {
        OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c(m, pOpArgs, pShrineTxt)
      } else {
        OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c(m, pOpArgs, pShrineTxt)
      }
      const hits = endVaTrace113c()

      // Must NOT call 0x6FC211D0 (SEED_RollLimitedFast); LCG is inlined
      expect(hits.has('D2Game:0x6FC211D0')).toBe(false)
      expect(hits.has('D2Game:0x6FC8F930')).toBe(true)

      // Scan pGame missile hash buckets (pGame + 0x1920, 128 buckets) for the 6 spawned missiles
      const spawned: Array<{ classId: number; tx: number; ty: number; totalFrames: number }> = []
      for (let b = 0; b < 128; b++) {
        let cur = m.u32((pGame + 0x1920 + b * 4) >>> 0) >>> 0
        while (cur !== 0) {
          const pPath = m.u32((cur + 0x2c) >>> 0) >>> 0
          const pMisData = m.u32((cur + 0x14) >>> 0) >>> 0
          spawned.push({
            classId: m.u32((cur + 0x04) >>> 0) | 0,
            tx: m.u16((pPath + 0x10) >>> 0),
            ty: m.u16((pPath + 0x12) >>> 0),
            totalFrames: pMisData !== 0 ? m.u32((pMisData + 0x08) >>> 0) | 0 : 0,
          })
          cur = m.u32((cur + 0xe4) >>> 0) >>> 0
        }
      }
      expect(spawned.length).toBe(6)
      for (const s of spawned) {
        expect(s.classId).toBe(expectedMissileId)
        // baseRange=10 + levRange=5 * nSkillLvl(clamp(trunc(25/5),1,8)=5) = 35
        expect(s.totalFrames).toBe(35)
      }
      const targetSet = new Set(spawned.map((s) => `${s.tx},${s.ty}`))
      expect(targetSet).toEqual(new Set(['114,126', '114,114', '120,126', '120,114', '126,126', '126,114']))
    }

    runShrineCase(false, 0x30)
    runShrineCase(true, 0x2d)
  })

  it('regresses 0x6FC8D7B0: reads Kick skill mode via 0x6FD9E180 and calls PLAYER_StartModeOnUnit (0x6FC98430)', () => {
    const { m, pGame, pRoom, pObjectsTxt } = createWave18World()
    const { pUnit: pPlayer } = allocDynUnit(m, pGame, pRoom, 0, 0, 801, 110, 110)

    // Wire D2SkillListStrc with Kick skill (id=1) whose nSlotIndex/nSkillMode (+0x08) = 15 (PLRMODE_KICK)
    const pSkillList = m.alloc(0x40) >>> 0
    const pKickSkill = m.alloc(0x40) >>> 0
    const pKickTxt = m.alloc(0x40) >>> 0
    m.setU16(pKickTxt + 0x00, 1) // wSkillId = 1 (Kick)
    m.set(pKickSkill, D2SkillStrc.pSkillsTxt, pKickTxt)
    m.set(pKickSkill, D2SkillStrc.nSlotIndex, 15) // +0x08 returned by D2Common.#10136 (0x6FD9E180)
    m.set(pKickSkill, D2SkillStrc.nOwnerItemGuid, 0xffffffff)
    m.set(pSkillList, D2SkillListStrc.pFirstSkill, pKickSkill)
    m.set(pPlayer, D2UnitStrc.pSkills, pSkillList)

    const pObj = m.alloc(0x100) >>> 0
    const pObjData = m.alloc(0x40) >>> 0
    const pObjPath = m.alloc(0x40) >>> 0
    m.setU32(pObjData + 0x00, (pObjectsTxt + 0x1c0) >>> 0)
    m.setU32(pObj + 0x00, 2)
    m.setU32(pObj + 0x04, 1)
    m.setU32(pObj + 0x0c, 802)
    m.setU32(pObj + 0x10, 0) // mode 0 -> operable
    m.setU32(pObj + 0x14, pObjData)
    m.setU32(pObj + 0x2c, pObjPath)
    m.setU32(pObjPath + 0x00, pRoom)
    m.setU32(pObjPath + 0x0c, 112)
    m.setU32(pObjPath + 0x10, 112)

    const pSeed = m.alloc(8) >>> 0
    m.setU32(pSeed + 0x00, 0x12345678)
    m.setU32(pSeed + 0x04, 1)
    const pOp = m.alloc(0x30) >>> 0
    m.setU32(pOp + 0x00, pGame)
    m.setU32(pOp + 0x04, pObj)
    m.setU32(pOp + 0x08, pPlayer)
    m.setU32(pOp + 0x0c, pSeed)
    m.setU32(pOp + 0x10, 1)

    beginVaTrace113c()
    expect(w4b3.OBJ_OperateFn28_Urn_6FC8D7B0_113c(m, pOp)).toBe(0)
    const hits = endVaTrace113c()
    expect(hits.has('D2Game:0x6FC8D7B0')).toBe(true)
    expect(hits.has('D2Common:0x6FD9E180')).toBe(true)
    expect(hits.has('D2Game:0x6FC98430')).toBe(true)
  })

  it('regresses 0x6FC90CF0: binary parameter order (pCubeMainTxt, pInventory, pGame, pCubeOutputCtx) and null guard', () => {
    const { m, pGame } = createWave18World()
    const pCubeMainTxt = m.alloc(0x100) >>> 0 // all 7 input slots have wInFlags=0 -> (wInFlags & 3) == 0 -> pass
    const pInventory = m.alloc(0x40) >>> 0
    const pOutCtx = m.alloc(0x40) >>> 0

    // Null pCubeMainTxt or null pInventory -> returns 0
    expect(w4b3.CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c(m, 0, pInventory, pGame, pOutCtx)).toBe(0)
    expect(w4b3.CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c(m, pCubeMainTxt, 0, pGame, pOutCtx)).toBe(0)

    // Valid (pCubeMainTxt, pInventory) returns 1 even when pGame == 0 (matching 0x6FC90CFC..0x6FC90D06)
    expect(w4b3.CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c(m, pCubeMainTxt, pInventory, 0, pOutCtx)).toBe(1)
    expect(w4b3.CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c(m, pCubeMainTxt, pInventory, pGame, pOutCtx)).toBe(1)
  })

  it('regresses 0x6FCE00C0: exact 0x6FCE0B44 trade NPC whitelist rejects non-merchants in 0x93..0xC7', () => {
    const { m, pGame, pRoom, pMonStatsTxt } = createWave18World()
    const { pUnit: pPlayer, pData: pPlrData } = allocDynUnit(m, pGame, pRoom, 0, 0, 901, 110, 110)
    const pClient = m.alloc(0x300) >>> 0
    m.setU32(pPlrData + 0x9c, pClient)

    const testTradeNpc = (npcClassId: number, guid: number): boolean => {
      // Enable MONSTATS flag bit 9 (interactable NPC) -> byte at +0x0D bit 1 (0x02)
      m.setU8((pMonStatsTxt + npcClassId * 0x1a8 + 0x0d) >>> 0, 0x02)
      const { pUnit: pNpc, pData: pMonData } = allocDynUnit(m, pGame, pRoom, 1, npcClassId, guid, 112, 112)
      const pInteract = m.alloc(0x20) >>> 0
      m.setU32(pMonData + 0x30, pInteract)
      SUNIT_InsertServerUnit113c(m, pGame, pNpc)

      beginVaTrace113c()
      NPCS_HandleNpcMenuRequest_6FCE00C0_113c(m, pPlayer, pGame, 1, guid, 0)
      return endVaTrace113c().has('D2Game:0x6FCDF810')
    }

    // Non-merchants inside 0x93..0xC7 MUST NOT open shop (previously broken by >= 0x93 && <= 0xc7!)
    for (const [idx, badClassId] of [0x95, 0x96, 0x9b, 0xa0, 0xb0, 0xc6].entries()) {
      expect(testTradeNpc(badClassId, 910 + idx), `Non-merchant 0x${badClassId.toString(16)} must not trade`).toBe(false)
    }
    // Canonical merchants MUST open shop (0x6FCDF810)
    for (const [idx, goodClassId] of [0x93, 0x94, 0x9a, 0xb1, 0xb2, 0xc7, 0xca, 0xfc, 0x101, 0x195, 0x1ff, 0x201].entries()) {
      expect(testTradeNpc(goodClassId, 940 + idx), `Merchant 0x${goodClassId.toString(16)} must trade`).toBe(true)
    }
  })

  it('achieves 100% (57 / 57) live beginVaTrace113c() / endVaTrace113c() coverage across all Wave 18 VAs', () => {
    const { m, pGame, pRoom } = createWave18World()
    const { pUnit: pPlayer } = allocDynUnit(m, pGame, pRoom, 0, 0, 1001, 112, 112)
    const { pUnit: pPlayer2 } = allocDynUnit(m, pGame, pRoom, 0, 0, 1002, 114, 112)
    const { pUnit: pMon } = allocDynUnit(m, pGame, pRoom, 1, 5, 1003, 110, 110)
    const { pUnit: pMissile } = allocDynUnit(m, pGame, pRoom, 3, 1, 1004, 113, 113)

    const pObj = m.alloc(0x100) >>> 0
    const pObjData = m.alloc(0x60) >>> 0
    const pObjTxt = m.alloc(0x200) >>> 0
    const pObjPath = m.alloc(0x40) >>> 0
    m.setU32(pObj + 0x00, 2)
    m.setU32(pObj + 0x04, 1)
    m.setU32(pObj + 0x0c, 1005)
    m.setU32(pObj + 0x10, 1)
    m.setU32(pObj + 0x14, pObjData)
    m.setU32(pObj + 0x20, 0x11112222)
    m.setU32(pObj + 0x24, 1)
    m.setU32(pObj + 0x2c, pObjPath)
    m.setU32(pObj + 0x80, pGame)
    m.setU32(pObjData + 0x00, pObjTxt)
    m.setU32(pObjPath + 0x00, pRoom)
    m.setU32(pObjPath + 0x0c, 114)
    m.setU32(pObjPath + 0x10, 114)

    const pArr = m.alloc(0x20) >>> 0
    const pOldBuf = m.alloc(0x30) >>> 0
    m.setU32(pArr + 0x04, 1)
    m.setU32(pArr + 0x08, pOldBuf)
    m.setU32(pOldBuf + 0x00, 4)
    m.setU32(pOldBuf + 0x04, (pOldBuf + 0x04) >>> 0)
    m.setU32(pOldBuf + 0x08, (~((pOldBuf + 0x04) >>> 0)) >>> 0)

    const pItem = m.alloc(0x100) >>> 0
    const pItemData = m.alloc(0x80) >>> 0
    m.setU32(pItem + 0x00, 4)
    m.setU32(pItem + 0x14, pItemData)
    m.setU32(pItem + 0x20, 0x12345678)
    m.setU32(pItem + 0x24, 1)
    m.setU32(pItem + 0x80, pGame)
    const ppItem = m.alloc(8) >>> 0
    m.setU32(ppItem, pItem)
    const pdwSeed = m.alloc(8) >>> 0
    m.setU32(pdwSeed, 0x12345678)
    const pDrop = m.alloc(0x90) >>> 0
    m.setU32(pDrop + 0x08, pGame)

    const pCoords = m.alloc(8) >>> 0
    m.setU32(pCoords + 0x00, 110)
    m.setU32(pCoords + 0x04, 110)
    const pIlvl = m.alloc(4) >>> 0
    m.setU32(pIlvl, 5)
    const pOutDrop = m.alloc(0x90) >>> 0
    const pDmg = m.alloc(0x80) >>> 0
    const pOpArgs = m.alloc(0x30) >>> 0
    const pOpSeed = m.alloc(8) >>> 0
    m.setU32(pOpSeed + 0x00, 0x24681357)
    m.setU32(pOpSeed + 0x04, 1)
    m.setU32(pOpArgs + 0x00, pGame)
    m.setU32(pOpArgs + 0x04, pObj)
    m.setU32(pOpArgs + 0x08, pPlayer)
    m.setU32(pOpArgs + 0x0c, pOpSeed)
    const pShrineTxt = m.alloc(0x40) >>> 0
    m.setU32(pShrineTxt + 0x04, 1)
    m.setU32(pShrineTxt + 0x08, 1)
    const pQuest = m.alloc(0x100) >>> 0
    const pQuestData = m.alloc(0x140) >>> 0
    m.setU32(pQuest + 0x0c, pGame)
    m.setU32(pQuest + 0x18, pQuestData)
    const pAiArgs = m.alloc(0x20) >>> 0
    const szName = m.alloc(0x20) >>> 0
    writeCString(m, szName, 'W18')
    m.setU8(pPlayer2 + 0x6c, 1)

    beginVaTrace113c()
    // 20 k2w4-b3 VAs
    w4b3.STORM_TSListArrayResize_6FC22630_113c(m, pArr, 2)
    w4b3.ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c(m, ppItem, pdwSeed, pDrop, {
      onTryRollAndApplyMagicAffixes_6FC303C0: () => 1,
    })
    w4b3.ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c(m, pItem, pDrop, pGame)
    w4b3.ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c(m, ppItem, pdwSeed, pDrop)
    w4b3.ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c(m, pGame, pPlayer)
    w4b3.ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c(m, pGame, pPlayer)
    w4b3.ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c(m, pGame, pPlayer)
    w4b3.ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c(m, pGame, pRoom, 110, 110)
    w4b3.OBJ_CalcShrineStatBonusValue_6FC89EE0_113c(m, pPlayer, 50, 11)
    w4b3.OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c(m, pGame, pObj)
    w4b3.OBJ_TryOperateObjectIfInRange_6FC8A720_113c(m, 2, pPlayer, pGame, 9999)
    w4b3.OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c(m, pGame, pObj)
    w4b3.OBJ_SpawnMonster369FromObject_6FC8B860_113c(m, pGame, pObj)
    w4b3.OBJ_SpawnMonster329FromObject_6FC8B870_113c(m, pGame, pObj)
    w4b3.OBJ_SpawnMonster326FromObject_6FC8B880_113c(m, pGame, pObj)
    w4b3.OBJ_SpawnMonster330FromObject_6FC8B890_113c(m, pGame, pObj)
    w4b3.OBJ_OperateFn48_TrappedSoul_6FC8CE10_113c(m, pOpArgs)
    w4b3.OBJ_OperateFn28_Urn_6FC8D7B0_113c(m, pOpArgs)
    w4b3.CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c(m, 0, 0, pGame, 0)
    w4b3.PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c(m, pPlayer2, pPlayer, pGame)

    // 37 k2-remed-r3 VAs
    w4b3.ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(m, pGame, pMon, 2, pIlvl, pOutDrop, 1, 1)
    ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c(m, pCoords, pGame, pRoom, 1, 1, pMon)
    ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c(m, pGame, pRoom, pCoords, 1, 1, pMon)
    ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c(m, pCoords, pRoom, pGame, 1, 1, pMon)
    ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c(m, pCoords, pGame, pRoom)
    w4b3.ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c(m, pCoords, pGame, pRoom, pOutDrop)
    ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(m, pGame, pPlayer, 50)
    w4b3.ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c(m, pPlayer, pGame, 10)
    w4b3.MONUMOD_SpectralHitMissileDamage_6FC43650_113c(m, pGame, pMissile, pMon, pDmg)
    w4b3.MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c(m, pGame, pMon)
    w4b3.MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c(m, pGame, pMon, 1)
    w4b3.MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c(m, pMon, pGame, 8)
    w4b3.GAME_AssignUniqueGameName_6FC4BC90_113c(m, pGame, szName)
    w4b3.PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c(m, pGame, 1001, pPlayer, 10)
    w4b3.MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c(
      m,
      pGame,
      pMissile,
      pMon,
      pDmg,
    )
    w4b3.MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c(m, pGame, pMissile, 0)
    w4b3.MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c(m, pGame, pMissile)
    w4b3.MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c(m, pGame, 0, 1)
    MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c(m, pGame, pMissile)
    w4b3.ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c(m, pGame, pQuest)
    w4b3.ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c(m, pOpArgs)
    w4b3.ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c(m, pQuest, pQuestData)
    w4b3.ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c(m, pObj, pGame)
    w4b3.ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c(m, pQuest, pObj)
    w4b3.ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c(m, pOpArgs)
    OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(m, 0x2079656b, pMon, pGame, 2)
    ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c(m, pGame, pPlayer, 0x20786f62, 0)
    w4b3.OBJ_OperateFn20_WeaponRack_6FC8B280_113c(m, pOpArgs)
    w4b3.OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c(m, pOpArgs)
    OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c(m, pOpArgs, pShrineTxt)
    OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c(m, pOpArgs, pShrineTxt)
    AI_TentacleSkillCastA_6FC9C060_113c(m, pGame, pMon, pAiArgs)
    AI_TentacleSkillCastB_6FC9C1D0_113c(m, pGame, pMon, pAiArgs)
    MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(m, pMon, pGame)
    SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c(m, 0x2079656b, pMon, pGame, 2)
    MONAI_DarkWandererThink_6FCC6E60_113c(m, pGame, pMon, pAiArgs)
    NPCS_HandleNpcMenuRequest_6FCE00C0_113c(m, pPlayer, pGame, 1, 9999)

    const hits = endVaTrace113c()
    const missing = WAVE18_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (va) => !hits.has(va),
    )
    expect(missing).toEqual([])
  })
})
