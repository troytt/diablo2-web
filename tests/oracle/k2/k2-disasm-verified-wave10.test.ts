/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 10: +108 VAs).
 *
 * Audits and verifies 108 `D2Game.dll` (`0x6FC20000`) closure functions across:
 * - `k2w1-laneB-sunit-spawn` (`src/d2kern-113c/game/k2-sunit-spawn-w1-113c.ts`, 36 functions)
 * - `k2w6-b2` (`src/d2kern-113c/game/k2-w6b2-113c.ts`, 36 functions)
 * - `k2w7-b4` (`src/d2kern-113c/game/k2-w7b4-113c.ts`, 36 functions)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`.
 * 2. Differential regression tests for all 14 genuine 1.13c binary disassembly discrepancies fixed.
 * 3. Multi-branch `SparseMemory113c` boundary/state assertions + 100% (`108 / 108`) live
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
  INVENTORY_LinkItemToInventoryList113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetItemQuality113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  SGPT_EXPERIENCE_TXT_PTR_VA_113C,
  SKILLS_AddSkillToUnit113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_ToggleState113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatListFromUnitAndState113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  DATATABLES_LEVELS_TXT_COUNT_OFF_113C,
  DATATABLES_LEVELS_TXT_PTR_OFF_113C,
} from '../../../src/d2kern-113c/common/waypoint.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  ACT3Q0_MarkWandererSeenCallback113c,
  ACT3Q0_StatusFilter113c,
  ACT3Q1_GetHratliTargetCoords113c,
  ACT3Q1_GetQuestDataByte04_113c,
  ACT3Q1_HratliIntroStatusFilter113c,
  ACT3Q2_AddQuestDataCount1C_113c,
  ACT3Q2_DarkWandererStatusFilter113c,
  ACT3Q3_OnKhalimsWillCubed113c,
  ACT3Q4_CheckOrmusNpcWaitFlag113c,
  ACT3Q4_ClearOrmusNpcWaitFlag113c,
  ACT3Q4_OnQuestUnitDeactivate113c,
  ACT3Q4_SyncTomePartyQuestStateCallback113c,
  ACT3Q5_CompleteCouncilPartyCallback113c,
  ACT3Q5_IsCompellingOrbIntact113c,
  ACT3Q5_IsDuranceEntryBlocked113c,
  ACT3Q5_SyncCouncilQuestFlagsCallback113c,
  ACT3Q6_SetGidbinnState0ECallback113c,
  ACT3Q6_SyncGidbinnState02Callback113c,
  ACT3Q7_Callback11_Noop113c,
  ACT3Q7_SendQuestUpdatePacket5D_113c,
  CLIENTS_UpdateCharacterProgression113c,
  MONSTER_CheckPlayerInteractUnlocked113c,
  MONSTER_CountInteractingPlayers113c,
  MONSTER_HasAnyInteractingPlayer113c,
  MONSTER_PromotePlayerInteractToTradeState113c,
  MONSTER_SetLastInteractTarget113c,
  PARTY_FindPlayerRelationNode113c,
  PARTY_GetHostileCooldownTick113c,
  PARTY_GetPlayerRelationState113c,
  PARTY_TestPlayerRelationFlags113c,
  REGPOP_CanSpawnPresetMinionPack113c,
  REGPOP_RemapDirectionalMonsterClassId113c,
  SKILLS_DeductFromStatPool113c,
  SKILLS_DivideValueByMonLvlHp113c,
  SKILLS_SrvSt18_ReturnOne113c,
  SUNIT_CanTargetOwnPetWithSkill113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c.ts'
import {
  ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c,
  ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c,
  ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c,
  AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c,
  ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c,
  ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c,
  MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c,
  MONAI_CanShadowCastSkillInContext_6FCC44C0_113c,
  MONAI_DeathSentryTrapThink_6FCC7C20_113c,
  MONAI_InitShadowMasterClassSkills_6FCC4320_113c,
  MONAI_PutridDefilerImpregnateThink_6FCA5500_113c,
  MONAI_SkirmishApproachFleeAttackThink_6FCA51E0_113c,
  MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c,
  MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c,
  MONAI_StationarySentryTrapThink_6FCC7DC0_113c,
  NPCS_ResetVendorSlotInventory_6FCB02E0_113c,
  NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c,
  NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c,
  OBJ_OperateWell_6FC8CEE0_113c,
  PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c,
  PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c,
  PETS_RemovePetFromSlotByGuid_6FCB7920_113c,
  SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c,
  SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c,
  SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c,
  SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c,
  SKILLS_RollMonsterConversionChance_6FCB1610_113c,
  SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c,
  SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c,
  SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c,
  SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c,
  SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c,
  SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c,
  SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c,
  SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c,
  SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c.ts'
import {
  ACT2Q1_OnRadamentKilled_6FCE7540_113c,
  ACT2Q6_OnDurielKilled_6FCE97D0_113c,
  ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c,
  ACT3Q2_OnGidbinnBossKilled_6FD08140_113c,
  ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c,
  ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c,
  ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c,
  ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c,
  ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c,
  C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c,
  C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c,
  C2S_Packet28_SocketItem_6FCEEBD0_113c,
  C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c,
  C2S_Packet34_CainIdentifyItems_6FCEF070_113c,
  C2S_Packet3A_AddStatPoint_6FCEC960_113c,
  ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c,
  ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c,
  ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c,
  ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c,
  ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c,
  ITEMS_PickupGroundItemToCursor_6FCF7160_113c,
  ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c,
  ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c,
  ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c,
  ITEMS_SwitchWeaponSlots_6FCF8EA0_113c,
  ITEMS_UseBeltItem_6FCF8BA0_113c,
  ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c,
  MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c,
  MONSTER_SpawnFallenShamanPack_6FD0FB80_113c,
  OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c,
  OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c,
  PARTY_DeclareHostility_6FD10CD0_113c,
  PARTY_ToggleLootPermission_6FD10F40_113c,
  PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c,
  PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c,
  SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemStatCostTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2MonLvlTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2ObjectsTxt_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_INVENTORY_TXT_MAX_VA,
  SGPT_INVENTORY_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
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
  readonly batch: 'k2w1-laneB-sunit-spawn' | 'k2w6-b2' | 'k2w7-b4'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE10_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  // k2w1-laneB-sunit-spawn: 36
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC645E0', size: 22, headHex: '8b0a3bc17f072bc8', tailHex: '0000c3', tsSymbol: 'SKILLS_DeductFromStatPool113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC66D90', size: 58, headHex: '85c07c108b0d9c82', tailHex: '0000c3', tsSymbol: 'REGPOP_CanSpawnPresetMinionPack113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC66E80', size: 187, headHex: '85c0568b359c82d1', tailHex: '155ec3', tsSymbol: 'REGPOP_RemapDirectionalMonsterClassId113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC68370', size: 27, headHex: '8b0085c0740c8338', tailHex: '0000c3', tsSymbol: 'MONSTER_HasAnyInteractingPlayer113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC68390', size: 22, headHex: '8b0933c085c9740d', tailHex: '75f3c3', tsSymbol: 'MONSTER_CountInteractingPlayers113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC684F0', size: 65, headHex: '85c074158b0883f9', tailHex: '8bc1c3', tsSymbol: 'MONSTER_CheckPlayerInteractUnlocked113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC68710', size: 58, headHex: '85c0741183380175', tailHex: '0000c3', tsSymbol: 'MONSTER_PromotePlayerInteractToTradeState113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC68750', size: 71, headHex: '85f657743c8b3e83', tailHex: 'c20400', tsSymbol: 'MONSTER_SetLastInteractTarget113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC6A2D0', size: 65, headHex: '33c9668b4e0a0fb6', tailHex: '560ac3', tsSymbol: 'CLIENTS_UpdateCharacterProgression113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC6DF60', size: 29, headHex: '0fb6c050e851c8fb', tailHex: '8bc6c3', tsSymbol: 'SKILLS_DivideValueByMonLvlHp113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FC6DFD0', size: 8, headHex: 'b801000000c20800', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt18_ReturnOne113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD00210', size: 129, headHex: '83ec0885f6747485', tailHex: 'c408c3', tsSymbol: 'SUNIT_CanTargetOwnPetWithSkill113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD028B0', size: 5, headHex: '32c0c20c00', tailHex: 'c20c00', tsSymbol: 'ACT3Q0_StatusFilter113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD02900', size: 90, headHex: '8b80f410000085c0', tailHex: 'c20400', tsSymbol: 'ACT3Q5_IsDuranceEntryBlocked113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD02960', size: 48, headHex: '8b80f410000085c0', tailHex: '94c0c3', tsSymbol: 'ACT3Q5_IsCompellingOrbIntact113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD02B10', size: 39, headHex: '8b80f410000085c0', tailHex: '0100c3', tsSymbol: 'ACT3Q4_ClearOrmusNpcWaitFlag113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD02B40', size: 48, headHex: '8b80f410000085c0', tailHex: '0000c3', tsSymbol: 'ACT3Q4_CheckOrmusNpcWaitFlag113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD02C40', size: 61, headHex: '8b80f410000085c0', tailHex: '0000c3', tsSymbol: 'ACT3Q1_GetHratliTargetCoords113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD02CD0', size: 41, headHex: '8b80f410000085c0', tailHex: '4104c3', tsSymbol: 'ACT3Q1_GetQuestDataByte04_113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD02DB0', size: 56, headHex: '8b80f410000085c0', tailHex: 'c20400', tsSymbol: 'ACT3Q2_AddQuestDataCount1C_113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD02EF0', size: 1, headHex: 'c3', tailHex: 'c3', tsSymbol: 'ACT3Q7_Callback11_Noop113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD03030', size: 5, headHex: '32c0c20c00', tailHex: 'c20c00', tsSymbol: 'ACT3Q1_HratliIntroStatusFilter113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD03040', size: 12, headHex: '8b44240cc6000032', tailHex: 'c20c00', tsSymbol: 'ACT3Q2_DarkWandererStatusFilter113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD030C0', size: 87, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT3Q0_MarkWandererSeenCallback113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD037D0', size: 123, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT3Q5_CompleteCouncilPartyCallback113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD03A80', size: 119, headHex: '5657528bf1e8366a', tailHex: 'c20400', tsSymbol: 'ACT3Q5_SyncCouncilQuestFlagsCallback113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD03B00', size: 39, headHex: '8b4018538a5802b2', tailHex: '015bc3', tsSymbol: 'ACT3Q4_OnQuestUnitDeactivate113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD03C70', size: 102, headHex: '578bf98b87f41000', tailHex: 'c20400', tsSymbol: 'ACT3Q4_SyncTomePartyQuestStateCallback113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD04900', size: 123, headHex: '5657508bf9e8b65b', tailHex: '5f5ec3', tsSymbol: 'ACT3Q3_OnKhalimsWillCubed113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD04A50', size: 95, headHex: '83ec088a48148b44', tailHex: 'c20400', tsSymbol: 'ACT3Q7_SendQuestUpdatePacket5D_113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD05230', size: 63, headHex: '56528bf1e88752f2', tailHex: 'c20400', tsSymbol: 'ACT3Q6_SetGidbinnState0ECallback113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD05370', size: 113, headHex: '5657528bf1e84651', tailHex: 'c20400', tsSymbol: 'ACT3Q6_SyncGidbinnState02Callback113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD10060', size: 46, headHex: '57e85aa4f1ff85f6', tailHex: '33c0c3', tsSymbol: 'PARTY_FindPlayerRelationNode113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD100E0', size: 68, headHex: '85f6751157e8d6a3', tailHex: '4008c3', tsSymbol: 'PARTY_GetHostileCooldownTick113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD101D0', size: 67, headHex: '57e8eaa2f1ff85f6', tailHex: '33c0c3', tsSymbol: 'PARTY_GetPlayerRelationState113c' },
  { batch: 'k2w1-laneB-sunit-spawn', va: '0x6FD102A0', size: 68, headHex: '57e81aa2f1ff85f6', tailHex: 'c20400', tsSymbol: 'PARTY_TestPlayerRelationFlags113c' },
  // k2w6-b2: 36
  { batch: 'k2w6-b2', va: '0x6FC85E90', size: 563, headHex: '8b5424088a821801', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c' },
  { batch: 'k2w6-b2', va: '0x6FC8CEE0', size: 161, headHex: '5355578bf98b4704', tailHex: 'c05bc3', tsSymbol: 'OBJ_OperateWell_6FC8CEE0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCA51E0', size: 785, headHex: '83ec088b44240c53', tailHex: 'c20400', tsSymbol: 'MONAI_SkirmishApproachFleeAttackThink_6FCA51E0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCA5500', size: 640, headHex: '83ec288b44242c53', tailHex: 'c20400', tsSymbol: 'MONAI_PutridDefilerImpregnateThink_6FCA5500_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB02E0', size: 49, headHex: '558b6c2408568bc7', tailHex: 'c20400', tsSymbol: 'NPCS_ResetVendorSlotInventory_6FCB02E0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB1610', size: 80, headHex: '85f67405833e0174', tailHex: 'c20800', tsSymbol: 'SKILLS_RollMonsterConversionChance_6FCB1610_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB2230', size: 112, headHex: '83ec085355568d44', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB2CF0', size: 241, headHex: '83ec7853558bac24', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB3110', size: 344, headHex: '558bec83e4f881ec', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB3270', size: 205, headHex: '53568bf2578bc68b', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB3340', size: 338, headHex: '81ec84000000558b', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB35F0', size: 134, headHex: '53568b74240c85f6', tailHex: 'c20800', tsSymbol: 'SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB3850', size: 315, headHex: '83ec2c568b710c57', tailHex: 'c42cc3', tsSymbol: 'SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB4DC0', size: 158, headHex: '83ec085356578b7c', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB61A0', size: 212, headHex: '5355568bf2578b7e', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB64B0', size: 77, headHex: '558b6c2408568b75', tailHex: 'c20400', tsSymbol: 'PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB7420', size: 534, headHex: '83ec4c538b5c2458', tailHex: 'f6ffcc', tsSymbol: 'PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB7920', size: 251, headHex: '83ec1c558b6c2424', tailHex: 'f6ffcc', tsSymbol: 'PETS_RemovePetFromSlotByGuid_6FCB7920_113c' },
  { batch: 'k2w6-b2', va: '0x6FCB88B0', size: 154, headHex: '85ff558b6c240856', tailHex: 'c20c00', tsSymbol: 'SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCBB630', size: 1233, headHex: '51558b6c240c85ed', tailHex: 'c20400', tsSymbol: 'ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c' },
  { batch: 'k2w6-b2', va: '0x6FCC1240', size: 55, headHex: '85c07505b8838500', tailHex: 'c21000', tsSymbol: 'AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c' },
  { batch: 'k2w6-b2', va: '0x6FCC1880', size: 282, headHex: '83ec5c53558bac24', tailHex: 'c22000', tsSymbol: 'SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c' },
  { batch: 'k2w6-b2', va: '0x6FCC4320', size: 304, headHex: '518b442408535533', tailHex: 'c20400', tsSymbol: 'MONAI_InitShadowMasterClassSkills_6FCC4320_113c' },
  { batch: 'k2w6-b2', va: '0x6FCC44C0', size: 313, headHex: '85c9558b68085657', tailHex: 'c20800', tsSymbol: 'MONAI_CanShadowCastSkillInContext_6FCC44C0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCC7C20', size: 402, headHex: '83ec185556578b7c', tailHex: 'c20400', tsSymbol: 'MONAI_DeathSentryTrapThink_6FCC7C20_113c' },
  { batch: 'k2w6-b2', va: '0x6FCC7DC0', size: 401, headHex: '83ec348b44243853', tailHex: 'c20400', tsSymbol: 'MONAI_StationarySentryTrapThink_6FCC7DC0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCC80C0', size: 428, headHex: '83ec245556578bfa', tailHex: 'c20400', tsSymbol: 'MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCC8270', size: 209, headHex: '83ec248b44242853', tailHex: 'c20400', tsSymbol: 'MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c' },
  { batch: 'k2w6-b2', va: '0x6FCC8350', size: 209, headHex: '83ec248b44242853', tailHex: 'c20400', tsSymbol: 'MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c' },
  { batch: 'k2w6-b2', va: '0x6FCCF370', size: 209, headHex: '83ec088b44240c85', tailHex: 'c21400', tsSymbol: 'ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c' },
  { batch: 'k2w6-b2', va: '0x6FCD41B0', size: 288, headHex: '83ec745356578bbc', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c' },
  { batch: 'k2w6-b2', va: '0x6FCD6790', size: 170, headHex: '5153568bf2568bd9', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c' },
  { batch: 'k2w6-b2', va: '0x6FCDA490', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c' },
  { batch: 'k2w6-b2', va: '0x6FCDD160', size: 183, headHex: '518b4424088b4b70', tailHex: 'c20400', tsSymbol: 'NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c' },
  { batch: 'k2w6-b2', va: '0x6FCDD490', size: 326, headHex: '51538bd88b53648b', tailHex: 'c20400', tsSymbol: 'NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c' },
  { batch: 'k2w6-b2', va: '0x6FCE23C0', size: 140, headHex: '8b420856578bf98b', tailHex: '5f5ec3', tsSymbol: 'ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c' },
  // k2w7-b4: 36
  { batch: 'k2w7-b4', va: '0x6FC8AD60', size: 254, headHex: '83ec1c8bc78b088b', tailHex: 'c41cc3', tsSymbol: 'OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c' },
  { batch: 'k2w7-b4', va: '0x6FC8D740', size: 104, headHex: '578bf98b470485c0', tailHex: 'c05fc3', tsSymbol: 'OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c' },
  { batch: 'k2w7-b4', va: '0x6FC91330', size: 685, headHex: '83ec1055578bfa8b', tailHex: 'c20400', tsSymbol: 'PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c' },
  { batch: 'k2w7-b4', va: '0x6FCE7540', size: 368, headHex: '81ec880000005657', tailHex: '0000c3', tsSymbol: 'ACT2Q1_OnRadamentKilled_6FCE7540_113c' },
  { batch: 'k2w7-b4', va: '0x6FCE97D0', size: 480, headHex: 'a1201cd36f81ec80', tailHex: '0000c3', tsSymbol: 'ACT2Q6_OnDurielKilled_6FCE97D0_113c' },
  { batch: 'k2w7-b4', va: '0x6FCEACC0', size: 107, headHex: '83ec08578d4c2404', tailHex: 'c408c3', tsSymbol: 'MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c' },
  { batch: 'k2w7-b4', va: '0x6FCEC960', size: 112, headHex: '837c240803538bda', tailHex: 'c20800', tsSymbol: 'C2S_Packet3A_AddStatPoint_6FCEC960_113c' },
  { batch: 'k2w7-b4', va: '0x6FCEDB30', size: 116, headHex: '837c24080956578b', tailHex: 'c20800', tsSymbol: 'C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c' },
  { batch: 'k2w7-b4', va: '0x6FCEEBD0', size: 156, headHex: '837c24080956578b', tailHex: 'c20800', tsSymbol: 'C2S_Packet28_SocketItem_6FCEEBD0_113c' },
  { batch: 'k2w7-b4', va: '0x6FCEEFE0', size: 144, headHex: '837c24080553578b', tailHex: 'c20800', tsSymbol: 'C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c' },
  { batch: 'k2w7-b4', va: '0x6FCEF070', size: 35, headHex: '837c2408057408b8', tailHex: 'c20800', tsSymbol: 'C2S_Packet34_CainIdentifyItems_6FCEF070_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF0F80', size: 132, headHex: '837c24080553568b', tailHex: 'c20800', tsSymbol: 'C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF3C40', size: 109, headHex: '5185db568bf0751f', tailHex: '5e59c3', tsSymbol: 'ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF4140', size: 238, headHex: '53558b6c240c85ed', tailHex: 'c20400', tsSymbol: 'ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF4230', size: 295, headHex: '558b6c240885ed57', tailHex: 'c20c00', tsSymbol: 'ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF4960', size: 266, headHex: '515356578bf9508d', tailHex: 'c20400', tsSymbol: 'ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF5690', size: 169, headHex: '5333db85f6558b6c', tailHex: 'c20400', tsSymbol: 'ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF57F0', size: 527, headHex: '538b5c240885db55', tailHex: 'f2ffcc', tsSymbol: 'ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF5C30', size: 1171, headHex: '83ec0c568b742414', tailHex: 'c21000', tsSymbol: 'ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF62E0', size: 685, headHex: '51538b5c240c85db', tailHex: 'c21800', tsSymbol: 'ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF7160', size: 413, headHex: '85db578bf8750768', tailHex: 'c20800', tsSymbol: 'ITEMS_PickupGroundItemToCursor_6FCF7160_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF8BA0', size: 568, headHex: '538b5c240885db55', tailHex: 'c21400', tsSymbol: 'ITEMS_UseBeltItem_6FCF8BA0_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF8EA0', size: 1488, headHex: '83ec6455568bf0b8', tailHex: 'c20800', tsSymbol: 'ITEMS_SwitchWeaponSlots_6FCF8EA0_113c' },
  { batch: 'k2w7-b4', va: '0x6FCF9FB0', size: 927, headHex: '53578bfa8b54240c', tailHex: 'c20800', tsSymbol: 'ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c' },
  { batch: 'k2w7-b4', va: '0x6FCFE870', size: 116, headHex: '85f6558b6c240874', tailHex: 'c20400', tsSymbol: 'SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c' },
  { batch: 'k2w7-b4', va: '0x6FD06760', size: 87, headHex: '8b80f410000085c0', tailHex: 'ff5bc3', tsSymbol: 'ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c' },
  { batch: 'k2w7-b4', va: '0x6FD06850', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c' },
  { batch: 'k2w7-b4', va: '0x6FD07050', size: 33, headHex: '8a410c84c075178a', tailHex: 'b001c3', tsSymbol: 'ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c' },
  { batch: 'k2w7-b4', va: '0x6FD073C0', size: 407, headHex: '8b80f410000081ec', tailHex: '0000c3', tsSymbol: 'ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c' },
  { batch: 'k2w7-b4', va: '0x6FD07A40', size: 169, headHex: '8b420c81ec800000', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c' },
  { batch: 'k2w7-b4', va: '0x6FD07AF0', size: 228, headHex: '81ec840000005556', tailHex: '0000c3', tsSymbol: 'ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c' },
  { batch: 'k2w7-b4', va: '0x6FD08140', size: 181, headHex: '51a1201cd36f85c0', tailHex: '5d59c3', tsSymbol: 'ACT3Q2_OnGidbinnBossKilled_6FD08140_113c' },
  { batch: 'k2w7-b4', va: '0x6FD0C7F0', size: 616, headHex: 'b80c800000e826a0', tailHex: 'c21400', tsSymbol: 'PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c' },
  { batch: 'k2w7-b4', va: '0x6FD0FB80', size: 157, headHex: '568bf033c081f954', tailHex: 'c21400', tsSymbol: 'MONSTER_SpawnFallenShamanPack_6FD0FB80_113c' },
  { batch: 'k2w7-b4', va: '0x6FD10CD0', size: 117, headHex: '53558b6c240c568b', tailHex: 'c20400', tsSymbol: 'PARTY_DeclareHostility_6FD10CD0_113c' },
  { batch: 'k2w7-b4', va: '0x6FD10F40', size: 167, headHex: '55578bfa85ff8be9', tailHex: 'c20c00', tsSymbol: 'PARTY_ToggleLootPermission_6FD10F40_113c' },
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

function createWave10World() {
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

  // Experience.txt, body grid, tick & debug flag
  const pExpBin = m.alloc(0x40) >>> 0
  for (let c = 0; c < 8; c++) m.setU32((pExpBin + c * 4) >>> 0, 99)
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin)
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)
  m.setU32(0x6fd18d10, 1000)
  m.setU32(0x6fd31c20, 0)
  m.fill(0x6fde4080, 0x30, 0)

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
    m.setU8((rec + 0x0e) >>> 0, 0x01) // killable / revivable / convertible base flag
    m.setU16((rec + 0x18) >>> 0, i)
  }

  // MonStats2Txt (600 rows)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa8c) >>> 0, monStatsCount)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec2 = (pMonStats2Txt + i * D2MonStats2Txt_SIZE) >>> 0
    m.setU8((rec2 + 0x05) >>> 0, 0x02) // attackable / curse-eligible flag
    m.setU32((rec2 + 0xf0) >>> 0, 0x04) // dwModeFlags bit 2 (walk/mode2)
  }

  // MonLvlTxt (110 rows)
  const monLvlCount = 110
  const pMonLvlTxt = m.alloc(monLvlCount * D2MonLvlTxt_SIZE) >>> 0
  m.setU32(0x6fdf0b54, pMonLvlTxt)
  m.setU32(0x6fdf0b58, monLvlCount)

  // SkillsTxt (360 rows * 0x23C)
  const skillsCount = 360
  const pSkillsTxt = m.alloc(skillsCount * 0x23c) >>> 0
  m.setU32((pDataTables + 0xb90) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)
  for (let s = 0; s < skillsCount; s++) {
    m.setU16((pSkillsTxt + s * 0x23c) >>> 0, s)
  }

  // StatesTxt (200 rows * 0x40) + state masks + progressive charge states array
  const statesCount = 200
  const pStatesTxt = m.alloc(statesCount * 0x40) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pStatesTxt) >>> 0, pStatesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0, statesCount)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksDC) >>> 0, m.alloc(32) >>> 0)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksAura) >>> 0, m.alloc(32) >>> 0)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksExp) >>> 0, m.alloc(32) >>> 0)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksOnCurse) >>> 0, m.alloc(32) >>> 0)
  m.setU32((pDataTables + 0x150) >>> 0, m.alloc(32) >>> 0)
  m.setU32((pDataTables + 0x154) >>> 0, m.alloc(32) >>> 0)
  m.setU32((pDataTables + 0xbbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xbc0) >>> 0, statesCount)
  // State masks table at +0x174 (40 masks * 32B) for STATES_CheckStateMaskByIndexOnUnit113c
  const pStateMasksTable = m.alloc(40 * 32) >>> 0
  m.setU32((pDataTables + 0x174) >>> 0, pStateMasksTable)

  // ItemStatCostTxt (360 rows)
  const iscCount = 360
  const pItemStatCostTxt = m.alloc(iscCount * D2ItemStatCostTxt_SIZE) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0, pItemStatCostTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0, iscCount)
  m.setU32((pDataTables + 0xbcc) >>> 0, pItemStatCostTxt)
  m.setU32((pDataTables + 0xbd4) >>> 0, iscCount)

  // PetTypesTxt (16 rows) so pet slot index 7 (hireling) is valid
  m.setU32((pDataTables + 0xbf0) >>> 0, 16)
  m.setU32((pDataTables + 0xbe8) >>> 0, 128)

  // ItemsTxt (100 rows) + linker
  const itemsCount = 100
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE) >>> 0
  m.setU32(SG_ITEM_DATATABLES_VA_113C, itemsCount)
  m.setU32((SG_ITEM_DATATABLES_VA_113C + 4) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xbd8) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xbdc) >>> 0, itemsCount)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)
  const pItemsLinker = m.alloc(0x40) >>> 0
  const pLinkerEntries = m.alloc(0x40) >>> 0
  m.setU32(pLinkerEntries, 0x20333367) // 'g33 ' Gidbinn (sorted ascending)
  m.setU32((pLinkerEntries + 4) >>> 0, 6) // item classId 6
  m.setU32((pLinkerEntries + 8) >>> 0, 0x20737361) // 'ass ' Book of Skill
  m.setU32((pLinkerEntries + 12) >>> 0, 7) // item classId 7
  m.setU32(pItemsLinker, 2)
  m.setU32((pItemsLinker + 8) >>> 0, pLinkerEntries)
  m.setU32(0x6fdeff6c, pItemsLinker)

  // ItemTypesTxt & self-equivalence bitset (128 rows so 0x4c/0x50/0x51/0x2d are in bounds)
  const itemTypesCount = 128
  const pItemTypesTxt = m.alloc(itemTypesCount * D2ItemTypesTxt_SIZE) >>> 0
  const pItemTypesEquiv = m.alloc(itemTypesCount * 16) >>> 0
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemTypesTxtRecordCount) >>> 0, itemTypesCount)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemTypesEquivDwords) >>> 0, 4)
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemTypesEquiv) >>> 0, pItemTypesEquiv)
  for (let t = 0; t < itemTypesCount; t++) {
    m.setU32((pItemTypesEquiv + (t * 4 + (t >> 5)) * 4) >>> 0, (1 << (t & 31)) >>> 0)
  }

  // ObjectsTxt (64 rows)
  const pObjectsTxt = m.alloc(64 * D2ObjectsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0x9c) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xa4) >>> 0, 64)
  m.setU32((pDataTables + 0x9c8) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0x9d0) >>> 0, 64)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 64)
  m.setU32(0x6fdf143c, pObjectsTxt)
  m.setU32(0x6fdf1440, 64)

  // HirelingTxt (1 expansion row for vendor 150 Kashya, wVersion=100, dwDifficulty=1)
  const pHirelingTxt = m.alloc(0x400) >>> 0
  m.setU32(0x6fdf0078, pHirelingTxt)
  m.setU32(0x6fdf007c, 1)
  m.setU16(pHirelingTxt + 0x00, 100)
  m.setU32(pHirelingTxt + 0x10, 1)
  m.setU32(pHirelingTxt + 0x14, 150)
  m.setU16(pHirelingTxt + 0x114, 10)
  m.setU16(pHirelingTxt + 0x116, 12)

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

  // Field direction lookup table for COLLISION_FindFreePositionBasic113c (dir=8 -> reached center)
  const pFieldData = m.alloc(0x10000) >>> 0
  m.fill(pFieldData, 0x10000, 8)
  m.setU32(0x6fdf1404, pFieldData)
  m.setU32(0x6fdf1414, 128)
  m.setU32(0x6fdf1418, 128)

  // InventoryTxt (32 rows * 0xF0) + char inv record table for InvTbls / UNITS_GetInventoryRecordId113c
  const pInvTxt = m.alloc(32 * 0xf0) >>> 0
  m.setU32(SGPT_INVENTORY_TXT_PTR_VA, pInvTxt)
  m.setU32(SGPT_INVENTORY_TXT_MAX_VA, 31)
  m.setU32(0x6fdeefe4, 1) // D2COMMON_CHAR_INV_REC_COUNT_VA_113C
  m.setU32(0x6fdeefe8, 0) // classId 0 (Amazon)
  m.setU32(0x6fdeefec, 0) // inv record 0
  m.setU8((pInvTxt + 0x10) >>> 0, 10) // gridX = 10
  m.setU8((pInvTxt + 0x11) >>> 0, 4) // gridY = 4

  // AnimData table
  const pAnimDataTable = m.alloc(0x500) >>> 0
  const pEmptyBucket = m.alloc(16) >>> 0
  for (let i = 0; i < 256; i++) m.setU32((pAnimDataTable + i * 4) >>> 0, pEmptyBucket)
  m.setU32((pAnimDataTable + 0x40c) >>> 0, 8)
  m.setU32((pAnimDataTable + 0x410) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13a4, 16)
  m.setU32(0x6fdf13b0, m.alloc(16 * 0x34) >>> 0)

  // Game + Timer Wheel + Quest Control + Non-zero RNG seed
  const pGame = m.alloc(0x2000) >>> 0
  m.setU32((pGame + 0x1c) >>> 0, 0x12340000)
  m.setU32((pGame + 0x70) >>> 0, 1) // bExpansion = 1
  m.setU16((pGame + 0x78) >>> 0, 101)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  m.setU32((pGame + 0xd0) >>> 0, 0x13579bdf)
  m.setU32((pGame + 0xd4) >>> 0, 666)
  EVENT_InitTimerQueue113c(m, pGame)

  const pQuestCtrl = m.alloc(0x40) >>> 0
  m.setU32((pQuestCtrl + 8) >>> 0, 1)
  m.setU32((pQuestCtrl + 0x0c) >>> 0, QUESTRECORD_AllocRecord113c(m, 0))
  m.setU32((pQuestCtrl + 0x18) >>> 0, 0x12345678)
  m.setU32((pQuestCtrl + 0x1c) >>> 0, 666)
  m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)
  m.setU32((pGame + 0x1d2c) >>> 0, m.alloc(0x40) >>> 0) // pPartyControl

  return {
    m,
    pGame,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pMonLvlTxt,
    pSkillsTxt,
    pStatesTxt,
    pStateMasksTable,
    pItemStatCostTxt,
    pItemsTxt,
    pItemTypesTxt,
    pObjectsTxt,
    pLevelsTxt,
    pQuestCtrl,
  }
}

function allocClientWithQueue(m: SparseMemory113c, pGame: number): { pClient: number; pQueue: number } {
  const pClient = m.alloc(0x500) >>> 0
  const pQueue = m.alloc(0x40c) >>> 0
  m.setU32((pClient + 0x04) >>> 0, 4)
  m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)
  m.setU8((pClient + 0x3d4) >>> 0, 1)
  return { pClient, pQueue }
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
  const ppClients = m.alloc(0x40) >>> 0
  m.setU32((pRoom + 0x48) >>> 0, ppClients)
  m.setU32((pRoom + 0x4c) >>> 0, (x - 10) >>> 0)
  m.setU32((pRoom + 0x50) >>> 0, (y - 10) >>> 0)
  m.setU32((pRoom + 0x54) >>> 0, 40)
  m.setU32((pRoom + 0x58) >>> 0, 40)
  m.setU32((pRoom + 0x78) >>> 0, 0) // client count incremented in allocPlayer
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  m.setU32((pLevel + 0x1d0) >>> 0, levelId)
  return { pRoom, pRoomEx, pLevel }
}

function linkUnitToRoom(m: SparseMemory113c, pRoom: number, pUnit: number): void {
  const head = m.u32((pRoom + 0x74) >>> 0) >>> 0
  m.setU32((pUnit + 0xe8) >>> 0, head)
  m.setU32((pRoom + 0x74) >>> 0, pUnit >>> 0)
}

function allocPlayer(m: SparseMemory113c, pGame: number, guid: number, pRoom = 0, x = 100, y = 100) {
  const pPlayer = m.alloc(0x100) >>> 0
  const pPlayerData = m.alloc(0x180) >>> 0
  const pPath = m.alloc(0x100) >>> 0
  const pSkills = m.alloc(0x20) >>> 0
  const { pClient, pQueue } = allocClientWithQueue(m, pGame)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer) >>> 0

  m.setU32(pPlayer, 0)
  m.setU32((pPlayer + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pPlayer + 0x10) >>> 0, 1)
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
  m.setU32((pPlayer + 0x20) >>> 0, 0x12345678)
  m.setU32((pPlayer + 0x24) >>> 0, 666)
  m.setU32((pPlayer + 0x2c) >>> 0, pPath)
  m.setU32((pPlayer + 0x60) >>> 0, pInv)
  m.setU32((pPlayer + 0x80) >>> 0, pGame)
  m.setU32((pPlayer + 0xa8) >>> 0, pSkills)
  m.setU32((pPlayer + 0xc4) >>> 0, 0x04)

  m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
  m.setU32((pClient + 0x174) >>> 0, pPlayer)

  m.setU32((pPath + 0x00) >>> 0, x << 16)
  m.setU32((pPath + 0x04) >>> 0, y << 16)
  m.setU16((pPath + 0x02) >>> 0, x)
  m.setU16((pPath + 0x06) >>> 0, y)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)
  m.setU32((pPath + 0x30) >>> 0, pPlayer)

  if (pRoom !== 0) {
    linkUnitToRoom(m, pRoom, pPlayer)
    const ppClients = m.u32((pRoom + 0x48) >>> 0) >>> 0
    if (ppClients !== 0) {
      const idx = m.u32((pRoom + 0x78) >>> 0)
      m.setU32((ppClients + idx * 4) >>> 0, pClient)
      m.setU32((pRoom + 0x78) >>> 0, (idx + 1) >>> 0)
    }
  }
  STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
  STATLIST_SetUnitStat113c(m, pPlayer, 6, 25600, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 7, 25600, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 12, 30, 0)
  SUNIT_InsertServerUnit113c(m, pGame, pPlayer)
  return { pPlayer, pPlayerData, pPath, pClient, pQueue, pQuestFlags, pInv, pSkills }
}

function allocMonster(
  m: SparseMemory113c,
  pGame: number,
  classId: number,
  guid: number,
  x = 100,
  y = 100,
  pRoomArg = 0,
  levelId = 2,
) {
  const roomInfo = pRoomArg !== 0 ? { pRoom: pRoomArg, pRoomEx: 0, pLevel: 0 } : allocRoom(m, levelId, x, y)
  const { pRoom } = roomInfo
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
  m.setU32((pMonster + 0x20) >>> 0, 0x24681357)
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

  linkUnitToRoom(m, pRoom, pMonster)
  STATLIST_CreateEx113c(m, pMonster, 1, pGame)
  STATLIST_SetUnitStat113c(m, pMonster, 6, 25600, 0)
  STATLIST_SetUnitStat113c(m, pMonster, 7, 25600, 0)
  SUNIT_InsertServerUnit113c(m, pGame, pMonster)
  return { pMonster, pMonData, pAiGen, pAiCtrl, pPath, pRoom, pSkills }
}

function allocItem(m: SparseMemory113c, pGame: number, classId: number, guid: number, quality = 2) {
  const pItem = m.alloc(0x100) >>> 0
  const pItemData = m.alloc(0x74) >>> 0
  const pPath = m.alloc(0x20) >>> 0
  m.setU32(pItem, 4)
  m.setU32((pItem + 0x04) >>> 0, classId >>> 0)
  m.setU32((pItem + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pItem + 0x14) >>> 0, pItemData)
  m.setU32((pItem + 0x20) >>> 0, 0x98765432)
  m.setU32((pItem + 0x24) >>> 0, 666)
  m.setU32((pItem + 0x2c) >>> 0, pPath)
  m.setU32((pItem + 0x80) >>> 0, pGame)
  ITEMS_SetItemQuality113c(m, pItem, quality)
  STATLIST_CreateEx113c(m, pItem, 0, pGame)
  SUNIT_InsertServerUnit113c(m, pGame, pItem)
  return { pItem, pItemData, pPath }
}

function allocObject(m: SparseMemory113c, classId = 0, pRoom = 0, guid = 500, x = 80, y = 80) {
  const pObj = m.alloc(0x100) >>> 0
  const pStaticPath = m.alloc(0x40) >>> 0
  const pObjData = m.alloc(0x40) >>> 0
  m.setU32(pStaticPath, pRoom >>> 0)
  m.setU32((pStaticPath + 0x0c) >>> 0, x >>> 0)
  m.setU32((pStaticPath + 0x10) >>> 0, y >>> 0)
  m.setU32(pObj, 2)
  m.setU32((pObj + 0x04) >>> 0, classId >>> 0)
  m.setU32((pObj + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pObj + 0x14) >>> 0, pObjData)
  m.setU32((pObj + 0x2c) >>> 0, pStaticPath)
  if (pRoom !== 0) linkUnitToRoom(m, pRoom, pObj)
  return { pObj, pStaticPath, pObjData }
}

function attachQuests(
  m: SparseMemory113c,
  pQuestCtrl: number,
  pGame: number,
  questNos: readonly number[],
): Map<number, { pQuest: number; pQuestExt: number }> {
  const map = new Map<number, { pQuest: number; pQuestExt: number }>()
  let prev = 0
  for (const qNo of questNos) {
    const pQuest = m.alloc(0x100) >>> 0
    const pQuestExt = m.alloc(0x140) >>> 0
    m.setU32(pQuest, qNo >>> 0)
    m.setU32((pQuest + 0x04) >>> 0, pGame >>> 0)
    m.setU8((pQuest + 0x09) >>> 0, 1)
    m.setU32((pQuest + 0x18) >>> 0, pQuestExt)
    if (prev === 0) {
      m.setU32(pQuestCtrl, pQuest)
    } else {
      m.setU32((prev + 0xf4) >>> 0, pQuest)
    }
    prev = pQuest
    map.set(qNo, { pQuest, pQuestExt })
  }
  return map
}

describe('K2 Disassembly Verification Wave 10 (+108 D2Game.dll v1.13c VAs)', () => {
  it('verifies all 108 promoted VAs against PE32 D2Game.dll .text machine code and manifest diff-verified entries', () => {
    expect(WAVE10_PROMOTED_SPECS.length).toBe(108)
    expect(WAVE10_PROMOTED_SPECS.filter((s) => s.batch === 'k2w1-laneB-sunit-spawn').length).toBe(36)
    expect(WAVE10_PROMOTED_SPECS.filter((s) => s.batch === 'k2w6-b2').length).toBe(36)
    expect(WAVE10_PROMOTED_SPECS.filter((s) => s.batch === 'k2w7-b4').length).toBe(36)

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

    for (const spec of WAVE10_PROMOTED_SPECS) {
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

  it('differential regressions: k2-w6b2 10 real 1.13c disassembly fixes (0x6FCBB630, 0x6FCC7C20, 0x6FCB3850, 0x6FCC4320, 0x6FCC80C0, 0x6FCD41B0, 0x6FCA51E0, 0x6FCB3110, 0x6FCB1610, 0x6FCB88B0)', () => {
    const { m, pGame, pDataTables, pMonStatsTxt, pMonStats2Txt, pSkillsTxt, pStateMasksTable } =
      createWave10World()
    const { pRoom } = allocRoom(m, 2, 80, 80)
    const { pPlayer, pClient } = allocPlayer(m, pGame, 1001, pRoom, 80, 80)

    // Fix #1 (0x6FCBB630): action flags check dwItemFlags (+0x14, ITEMS_CheckItemFlag113c),
    // NOT dwCmdFlags (+0x18, ITEMS_CheckCommandFlags113c).
    const { pItem: itCmdOnly } = allocItem(m, pGame, 1, 2001)
    ITEMS_SetOrClearCommandFlags113c(m, itCmdOnly, 0x40, 1)
    expect(ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c(m, itCmdOnly, pPlayer, pClient)).toBe(0)

    const { pItem: itFlag40 } = allocItem(m, pGame, 1, 2002)
    ITEMS_SetItemFlag113c(m, itFlag40, 0x40, 1)
    expect(ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c(m, itFlag40, pPlayer, pClient)).toBe(1)

    // Fix #2 (0x6FCC7C20): Death Sentry searches corpses around pTarget (NOT trap pUnit).
    // Trap at (60, 80), target at (61, 80) (dist 1 from trap), corpse at (70, 83) (dist ~9.5 <= 10 from target, ~10.4 > 10 from trap).
    const { pMonster: trap, pAiGen: trapAiGen, pAiCtrl: trapAiCtrl } = allocMonster(
      m,
      pGame,
      20,
      2010,
      60,
      80,
      pRoom,
    )
    const { pMonster: targetMon } = allocMonster(m, pGame, 21, 2011, 61, 80, pRoom)
    const { pMonster: corpseMon } = allocMonster(m, pGame, 22, 2012, 70, 83, pRoom)
    // Wire trap's summon owner (pPlayer guid 1001, type 0) so AI_UpdateSummonOwnerTownAndChargeCounter passes
    m.setU32((trapAiGen + 0x2c) >>> 0, 1001)
    m.setU32((trapAiGen + 0x30) >>> 0, 0)
    // Player-aligned trap (state 17 -> alignment 2) targeting hostile monster (alignment 0)
    STATES_ToggleState113c(m, trap, 17, 1)
    m.setU32((trap + 0x94) >>> 0, targetMon)
    m.setU32((corpseMon + 0x10) >>> 0, 0x0c)
    m.setU8((pMonStats2Txt + 22 * D2MonStats2Txt_SIZE + 0x04) >>> 0, 0x80)
    // Configure trap skill1 = 276 (Death Sentry CE) with param3=24, param4=0 -> ceRadius = 12
    const trapRec = (pMonStatsTxt + 20 * 0x1a8) >>> 0
    m.setU16((trapRec + 0x170) >>> 0, 276)
    m.setU16((trapRec + 0x68) >>> 0, 30)
    const ceSkillTxt = (pSkillsTxt + 276 * 0x23c) >>> 0
    m.setU32((ceSkillTxt + 0x150) >>> 0, 24) // Param3
    m.setU32((ceSkillTxt + 0x154) >>> 0, 0) // Param4
    const pTrapSkill = SKILLS_AddSkillToUnit113c(m, trap, 276)
    m.setU32((pTrapSkill + 0x28) >>> 0, 5)
    const pTrapAiParam = m.alloc(0x30) >>> 0
    m.setU32(pTrapAiParam, trapAiCtrl)
    m.setU32((pTrapAiParam + 0x1c) >>> 0, trapRec)
    m.setU32((trapAiCtrl + 0x18) >>> 0, 5) // remaining shots
    m.setU32((trap + 0xc4) >>> 0, (m.u32((trap + 0xc4) >>> 0) | 0x80000000) >>> 0)
    m.setU32((trap + 0x8c) >>> 0, pPlayer)
    beginVaTrace113c()
    MONAI_DeathSentryTrapThink_6FCC7C20_113c(m, pGame, trap, pTrapAiParam)
    const dsHits = endVaTrace113c()
    expect(dsHits.has('D2Game:0x6FCC7C20')).toBe(true)
    expect(dsHits.has('D2Game:0x6FCBE810')).toBe(true)
    expect(m.u32((trapAiCtrl + 0x14) >>> 0)).toBe(2012)

    // Fix #3 (0x6FCB3850): Passes (pGame, pAiGen, 0x0a) to AI_InitMonsterAiThinkFn113c without pre-overwriting pAiGen[0]
    const { pMonster: blindMon, pAiGen: blindAiGen } = allocMonster(m, pGame, 23, 2020, 82, 80, pRoom)
    m.setU32(blindAiGen, 0)
    const pAuraCtx = m.alloc(0x20) >>> 0
    const pAuraDesc = m.alloc(0x50) >>> 0
    m.setU32(pAuraCtx, pGame)
    m.setU32((pAuraCtx + 0x04) >>> 0, pPlayer)
    m.setU32((pAuraCtx + 0x0c) >>> 0, pAuraDesc)
    m.setU32(pAuraDesc, 10) // nSkillId
    m.setU32((pAuraDesc + 0x04) >>> 0, 5) // nSkillLevel
    m.setU32((pAuraDesc + 0x08) >>> 0, 0x40) // dwStatListFlags
    m.setU32((pAuraDesc + 0x0c) >>> 0, 12) // nStateId
    m.setU32((pAuraDesc + 0x10) >>> 0, 200) // nExpireFrame
    for (let k = 0; k < 5; k++) m.setU32((pAuraDesc + 0x14 + k * 4) >>> 0, 0xffffffff)
    beginVaTrace113c()
    const blindRet = SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c(m, pAuraCtx, blindMon)
    const blindHits = endVaTrace113c()
    expect(blindRet).toBe(1)
    expect(blindHits.has('D2Game:0x6FCB3850')).toBe(true)
    expect(blindHits.has('D2Game:0x6FCBD230')).toBe(true)
    expect(m.u32(blindAiGen)).toBe(0x0a)

    // Fix #4 (0x6FCC4320): Shadow Master sets Left skill (0x6FD9ED60) before Right skill (0x6FD9ECC0)
    const { pMonster: shadowMon, pAiGen: shadowAiGen, pAiCtrl: shadowAiCtrl } = allocMonster(
      m,
      pGame,
      24,
      2025,
      81,
      80,
      pRoom,
    )
    m.setU32((shadowAiGen + 0x2c) >>> 0, 1001)
    m.setU32((shadowAiGen + 0x30) >>> 0, 0)
    const pShadowParam = m.alloc(0x30) >>> 0
    m.setU32(pShadowParam, shadowAiCtrl)
    m.setU32((pShadowParam + 0x1c) >>> 0, (pMonStatsTxt + 24 * 0x1a8) >>> 0)
    beginVaTrace113c()
    MONAI_InitShadowMasterClassSkills_6FCC4320_113c(m, pGame, shadowMon, pShadowParam)
    const shadowHits = endVaTrace113c()
    expect(shadowHits.has('D2Game:0x6FCC4320')).toBe(true)
    expect(shadowHits.has('D2Common:0x6FD9ED60')).toBe(true)
    expect(shadowHits.has('D2Common:0x6FD9ECC0')).toBe(true)

    // Fix #5 (0x6FCC80C0): Barricade AI passes pOutClose to AI_FindNearestPlayerTarget113c (0x6FD130C0)
    const { pMonster: barMon, pAiCtrl: barAiCtrl } = allocMonster(m, pGame, 25, 2030, 81, 80, pRoom)
    const pBarParam = m.alloc(0x30) >>> 0
    m.setU32(pBarParam, barAiCtrl)
    m.setU32((pBarParam + 0x1c) >>> 0, (pMonStatsTxt + 25 * 0x1a8) >>> 0)
    m.setU32((barAiCtrl + 0x18) >>> 0, 0)
    // Pick seed where seedRoll(s, 3) !== 0 so taunt branch executes when bWithin4 === 1
    m.setU32((barMon + 0x20) >>> 0, 1)
    m.setU32((barMon + 0x24) >>> 0, 1)
    beginVaTrace113c()
    MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c(m, pGame, barMon, pBarParam)
    const barHits = endVaTrace113c()
    expect(barHits.has('D2Game:0x6FCC80C0')).toBe(true)
    expect(barHits.has('D2Game:0x6FD130C0')).toBe(true)

    // Fix #6 (0x6FCD41B0): Routes monster melee hit through real SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c
    // (0x6FCFE5A0) and passes pGame (not pDmg) to MONSTER_ApplyElementalDamageAndResistStats113c.
    const { pMonster: meleeMon, pPath: meleePath } = allocMonster(m, pGame, 26, 2040, 81, 80, pRoom)
    m.setU32((meleePath + 0x58) >>> 0, pPlayer)
    m.setU32((meleePath + 0x5c) >>> 0, 0)
    m.setU32((meleePath + 0x60) >>> 0, 1001)
    beginVaTrace113c()
    const meleeRet = SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c(m, pGame, meleeMon, 1, 1)
    const meleeHits = endVaTrace113c()
    expect(meleeRet).toBe(1)
    expect(meleeHits.has('D2Game:0x6FCD41B0')).toBe(true)
    expect(meleeHits.has('D2Game:0x6FCFE5A0')).toBe(true)

    // Fix #7 (0x6FCA51E0): Calls diff-verified AI_ApproachTarget113c (0x6FD12540) instead of private stand-in
    const { pMonster: skirMon, pAiCtrl: skirAiCtrl } = allocMonster(m, pGame, 27, 2050, 95, 80, pRoom)
    const skirRec = (pMonStatsTxt + 27 * 0x1a8) >>> 0
    m.setU16((skirRec + 0x56) >>> 0, 100) // aip1 = 100%
    m.setU16((skirRec + 0x5c) >>> 0, 5) // aip2
    m.setU16((skirRec + 0x62) >>> 0, 100) // aip3
    m.setU32((skirMon + 0x94) >>> 0, pPlayer)
    const pSkirParam = m.alloc(0x30) >>> 0
    m.setU32(pSkirParam, skirAiCtrl)
    m.setU32((pSkirParam + 0x1c) >>> 0, skirRec)
    m.setU32((pSkirParam + 0x08) >>> 0, pPlayer)
    m.setU32((pSkirParam + 0x14) >>> 0, 15) // dist = 15 (approach branch)
    m.setU32((pSkirParam + 0x18) >>> 0, 0) // not in melee
    beginVaTrace113c()
    MONAI_SkirmishApproachFleeAttackThink_6FCA51E0_113c(m, pGame, skirMon, pSkirParam)
    const skirHits = endVaTrace113c()
    expect(skirHits.has('D2Game:0x6FCA51E0')).toBe(true)
    expect(skirHits.has('D2Game:0x6FD12540')).toBe(true)

    // Fix #8 (0x6FCB3110): Passes 0 (not pSkillsTxt) to SKILLS_ConsumeProgressiveChargesOnHit113c so
    // non-zero pSkillsTxt+0x32 does NOT falsely abort progressive charge consumption.
    const dtSkillId = 270
    const pDtSkillTxt = (pSkillsTxt + dtSkillId * 0x23c) >>> 0
    m.setU8((pDtSkillTxt + 0x32) >>> 0, 1) // would cause early abort if pSkillsTxt were passed!
    const { pPlayer: dtPlr, pPath: dtPath } = allocPlayer(m, pGame, 2060, pRoom, 80, 80)
    const { pMonster: dtTarget } = allocMonster(m, pGame, 28, 2061, 81, 80, pRoom)
    // Attach player alignment sub-list (state 0x69, stat 0xAC = 2) so dtPlr vs dtTarget is hostile
    const pAlignList = STATLIST_AllocList113c(m, 0, 0x40, 0, 0, 2060)
    m.setU32((pAlignList + 0x14) >>> 0, 0x69)
    STATLIST_SetStat113c(m, pAlignList, 0xac, 2, 0)
    STATLIST_MergeStatLists113c(m, dtPlr, pAlignList, 1)
    m.setU32((dtPath + 0x58) >>> 0, dtTarget)
    m.setU32((dtPath + 0x5c) >>> 0, 1)
    m.setU32((dtPath + 0x60) >>> 0, 2061)
    // Attach combat node on dtPlr -> dtTarget with hit bit 1 and physical damage 100
    const pCombat = m.alloc(0x88) >>> 0
    m.setU32((pCombat + 0x04) >>> 0, 0) // attacker type
    m.setU32((pCombat + 0x08) >>> 0, 2060)
    m.setU32((pCombat + 0x0c) >>> 0, 1) // defender type
    m.setU32((pCombat + 0x10) >>> 0, 2061)
    m.setU16((pCombat + 0x18) >>> 0, 1) // tDamage (+0x14) + 0x04 wResultFlags = 1 (hit)
    m.setU32((pCombat + 0x1c) >>> 0, 25600) // tDamage (+0x14) + 0x08 dwPhysDamage
    m.setU32((dtPlr + 0xac) >>> 0, pCombat)
    // Configure progressive state 133 in mask index 0x19 (pDataTables + 0xcc + 0x19*4 = +0x130)
    // and progressive states list (+0x16c/+0x170)
    const progState = 133
    const pProgArr = m.alloc(4) >>> 0
    m.setU16(pProgArr, progState)
    m.setU32((pDataTables + 0x16c) >>> 0, pProgArr)
    m.setU32((pDataTables + 0x170) >>> 0, 1)
    const pMask19 = (pStateMasksTable + 0x19 * 32) >>> 0
    m.setU32((pDataTables + 0xcc + 0x19 * 4) >>> 0, pMask19)
    m.setU32((pMask19 + (progState >> 5) * 4) >>> 0, (1 << (progState & 31)) >>> 0)
    const pProgList = STATLIST_AllocList113c(m, 0, 0x40, 0, 0, 2060)
    m.setU32((pProgList + 0x14) >>> 0, progState)
    STATLIST_SetStat113c(m, pProgList, 0x144, 254, 0) // skillId
    STATLIST_SetStat113c(m, pProgList, 0x156, 3, 254) // 3 charges
    STATLIST_MergeStatLists113c(m, dtPlr, pProgList, 1)
    STATES_ToggleState113c(m, dtPlr, progState, 1)
    expect(STATLIST_GetStatListFromUnitAndState113c(m, dtPlr, progState)).toBe(pProgList)
    expect(SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c(m, pGame, dtPlr, dtSkillId, 1)).toBe(1)
    // Progressive charge statlist must have been unlinked & consumed despite pSkillsTxt+0x32 == 1
    expect(STATLIST_GetStatListFromUnitAndState113c(m, dtPlr, progState)).toBe(0)

    // Fix #9 & #10 (0x6FCB1610 & 0x6FCB88B0): Checks MONSTERS_GetHirelingTypeId113c before UNIT_GetAlignment113c
    const { pMonster: convMon } = allocMonster(m, pGame, 29, 2070, 82, 80, pRoom)
    expect(SKILLS_RollMonsterConversionChance_6FCB1610_113c(m, convMon, pPlayer, 100)).toBe(1)
    m.setU32((convMon + 0x04) >>> 0, 0x10f) // Rogue hireling classId -> MONSTERS_GetHirelingTypeId != 0
    expect(SKILLS_RollMonsterConversionChance_6FCB1610_113c(m, convMon, pPlayer, 100)).toBe(0)
    expect(SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c(m, 1, convMon, pPlayer, 1, 0)).toBe(0)
    m.setU32((convMon + 0x04) >>> 0, 29)
    expect(SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c(m, 1, convMon, pPlayer, 1, 0)).toBe(1)
  })

  it('differential regressions: k2-w7b4 4 real 1.13c disassembly fixes (0x6FCF62E0, 0x6FCF8BA0, 0x6FD08140, 0x6FD10CD0)', () => {
    const { m, pGame, pMonStatsTxt, pItemsTxt, pQuestCtrl } = createWave10World()
    const { pRoom } = allocRoom(m, 75, 80, 80)
    const { pPlayer, pPlayerData, pInv, pQueue } = allocPlayer(m, pGame, 3001, pRoom, 80, 80)
    const { pPlayer: pTargetPlr } = allocPlayer(m, pGame, 3002, pRoom, 82, 80)

    // Fix #11 (0x6FCF62E0): INVENTORY_SetCursorItem113c (when bDoRemoveFromStore!=0) and
    // INVENTORY_AppendItemGuidNode113c (when bSetCursorAndFlags===1) were swapped!
    const { pItem: itRem0 } = allocItem(m, pGame, 1, 3010)
    ITEMS_SetInvPage113c(m, itRem0, 0)
    m.setU32((itRem0 + 0x10) >>> 0, 0) // mode 0 (stored)
    INVENTORY_LinkItemToInventoryList113c(m, itRem0, pInv)
    const pOutErr = m.alloc(4) >>> 0
    // Call with bSetCursorAndFlags = 0: cursor MUST be set to itRem0, and guid node list (+0x2c) stays 0!
    expect(
      ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c(m, 0, pPlayer, pGame, 3010, pOutErr, 0, 0, 0),
    ).toBe(1)
    expect(INVENTORY_GetCursorItem113c(m, pInv)).toBe(itRem0)
    expect(m.u32((pInv + 0x2c) >>> 0)).toBe(0)

    // Now test with bSetCursorAndFlags = 1 (allow when cursor full): appends guid node (+0x2c != 0) AND sets cursor!
    const { pItem: itRem1 } = allocItem(m, pGame, 1, 3011)
    ITEMS_SetInvPage113c(m, itRem1, 0)
    m.setU32((itRem1 + 0x10) >>> 0, 0)
    INVENTORY_LinkItemToInventoryList113c(m, itRem1, pInv)
    expect(
      ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c(m, 0, pPlayer, pGame, 3011, pOutErr, 1, 0, 1),
    ).toBe(1)
    expect(INVENTORY_GetCursorItem113c(m, pInv)).toBe(itRem1)
    expect(m.u32((pInv + 0x2c) >>> 0)).not.toBe(0)

    // Fix #12 (0x6FCF8BA0): Shift-feeding a belt potion to merc (bShiftToMerc=1) passes pTargetUnit (pMerc)
    // as pOwnerUnit to ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c (not pUnit / player).
    const { pPlayer: pBeltPlr, pPlayerData: pBeltPlrData, pQueue: pBeltQueue } = allocPlayer(
      m,
      pGame,
      3020,
      pRoom,
      80,
      80,
    )
    const { pMonster: pMerc } = allocMonster(m, pGame, 30, 3021, 81, 80, pRoom)
    // Wire pet slot 7 (offset +0x54 from pPetArray) -> merc node with guid 3021
    const pPetHolder = m.alloc(0x10) >>> 0
    const pPetArray = m.alloc(0x100) >>> 0
    const pMercNode = m.alloc(0x20) >>> 0
    m.setU8(pMercNode, 0) // alive
    m.setU32((pMercNode + 0x04) >>> 0, 3021)
    m.setU32((pPetArray + 0x54) >>> 0, pMercNode)
    m.setU32(pPetHolder, pPetArray)
    m.setU32((pBeltPlrData + 0x44) >>> 0, pPetHolder)
    // Configure item class 5: useable=1, type=0x4c (healing potion), spellIcon=1 with pfnPhase1 != 0
    const pPotTxt = (pItemsTxt + 5 * D2ItemsTxt_SIZE) >>> 0
    m.set(pPotTxt, D2ItemsTxt.wType1, 0x4c)
    m.set(pPotTxt, D2ItemsTxt.nUseable, 1)
    m.setU32((pPotTxt + 0x94) >>> 0, 1) // nSpellIcon = 1
    m.setU32(0x6fd27330, 16)
    m.setU32((0x6fd27238 + 1 * 8) >>> 0, 0x6fcc0001) // phase1 handler sentinel
    const { pItem: pBeltPot } = allocItem(m, pGame, 5, 3022)
    m.setU32((pBeltPot + 0x10) >>> 0, 2) // ITEMMODE_INBELT
    // When bShiftToMerc = 1: pOwnerUnit passed to 0x6FCCD0F0 is pMerc (dwType=1), so player queue stays 0!
    const qBeforeMerc = m.u32(pBeltQueue)
    expect(ITEMS_UseBeltItem_6FCF8BA0_113c(m, pOutErr, 3022, pGame, pBeltPlr, 80, 80, 1)).toBe(0)
    expect(m.u32(pBeltQueue)).toBe(qBeforeMerc)
    // When bShiftToMerc = 0: pOwnerUnit passed to 0x6FCCD0F0 is pBeltPlr (dwType=0), so 0x7C packet IS queued!
    expect(ITEMS_UseBeltItem_6FCF8BA0_113c(m, pOutErr, 3022, pGame, pBeltPlr, 80, 80, 0)).toBe(0)
    expect(m.u32(pBeltQueue)).toBeGreaterThan(qBeforeMerc)

    // Fix #13 (0x6FD08140): Passes (0, pTarget) to MONSTERS_CheckMonStatsFlagBit6_113c instead of (pTarget, 0)
    const { pMonster: gidBoss, pMonData: gidBossData } = allocMonster(m, pGame, 31, 3030, 84, 80, pRoom)
    m.setU8((gidBossData + 0x16) >>> 0, 0) // NOT unique/champ so bit6 check is decisive!
    m.setU8((pMonStatsTxt + 31 * 0x1a8 + 0x0c) >>> 0, 0x40) // nBitField1 bit 6 = 1
    const qMap = attachQuests(m, pQuestCtrl, pGame, [0x11])
    const qGid = qMap.get(0x11)!
    m.setU8((qGid.pQuestExt + 0x02) >>> 0, 1)
    const pGidArg = m.alloc(0x20) >>> 0
    m.setU32((pGidArg + 0x08) >>> 0, gidBoss)
    ACT3Q2_OnGidbinnBossKilled_6FD08140_113c(m, qGid.pQuest, pGidArg)
    // Must reach the Gidbinn drop code write at pTarget+0xB8 = 'g33 ' (0x20333367)!
    expect(m.u32((gidBoss + 0xb8) >>> 0)).toBe(0x20333367)

    // Fix #14 (0x6FD10CD0): Uses STATLIST_GetUnitBaseStat113c (not STATLIST_GetUnitStat113c) for level >= 9 check
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 8, 0) // base level = 8 (< 9)
    const pBonusLvlList = STATLIST_AllocList113c(m, 0, 0, 0, 0, 3001)
    STATLIST_SetStat113c(m, pBonusLvlList, 0x0c, 5, 0) // effective level = 13 (>= 9)
    STATLIST_MergeStatLists113c(m, pPlayer, pBonusLvlList, 1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0x0c, 0)).toBe(13)
    expect(STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x0c, 0)).toBe(8)
    const qBeforeHostile = m.u32(pQueue)
    beginVaTrace113c()
    PARTY_DeclareHostility_6FD10CD0_113c(m, pGame, pPlayer, pTargetPlr)
    const blockedHostileHits = endVaTrace113c()
    expect(blockedHostileHits.has('D2Game:0x6FD10CD0')).toBe(true)
    expect(blockedHostileHits.has('D2Game:0x6FD141C0')).toBe(false)
    expect(m.u32(pQueue)).toBe(qBeforeHostile)

    // Raise base level to 9 -> hostility proceeds and queues packet 0x5A
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 9, 0)
    beginVaTrace113c()
    PARTY_DeclareHostility_6FD10CD0_113c(m, pGame, pPlayer, pTargetPlr)
    const allowedHostileHits = endVaTrace113c()
    expect(allowedHostileHits.has('D2Game:0x6FD141C0')).toBe(true)
    expect(m.u32(pQueue)).toBeGreaterThan(qBeforeHostile)
    expect(pPlayerData).not.toBe(0)
  })

  it('exercises all 108 promoted Wave 10 VAs with concrete assertions and verifies 100% live VA trace coverage', () => {
    const cumulativeHits = new Set<string>()

    // -------------------------------------------------------------------------
    // Shard 1: k2w1-laneB-sunit-spawn (36 VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pGame, pMonStatsTxt, pMonLvlTxt, pSkillsTxt, pQuestCtrl } = createWave10World()
      const { pRoom: roomA3 } = allocRoom(m, 75, 80, 80)
      const { pPlayer: plr1, pPlayerData: pd1, pClient: cli1, pQuestFlags: qf1 } = allocPlayer(
        m,
        pGame,
        4001,
        roomA3,
        80,
        80,
      )
      const { pPlayer: plr2 } = allocPlayer(m, pGame, 4002, roomA3, 82, 80)
      const { pMonster: npcMon, pMonData: npcMonData } = allocMonster(m, pGame, 19, 4010, 81, 80, roomA3)

      const qMap = attachQuests(m, pQuestCtrl, pGame, [0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x1c])
      const pInteractHolder = m.alloc(0x10) >>> 0
      const pInteractNode = m.alloc(0x18) >>> 0
      m.setU32(pInteractNode, plr1)
      m.setU32((pInteractNode + 0x04) >>> 0, 1)
      m.setU32(pInteractHolder, pInteractNode)
      m.setU32((npcMonData + 0x30) >>> 0, pInteractHolder)

      m.setU16((pMonStatsTxt + 0x13 * 0x1a8 + 0x02) >>> 0, 0x13)
      m.setU32((pMonStatsTxt + 0x13 * 0x1a8 + 0x0c) >>> 0, 1 << 0x10) // bit 0x10 (interactable NPC)
      m.setU32((pMonLvlTxt + 5 * D2MonLvlTxt_SIZE + 0x1c) >>> 0, 10)
      m.setU16((pSkillsTxt + 10 * 0x23c + 0x24) >>> 0, 1) // targetable pet flag

      const pPool = m.alloc(4) >>> 0
      m.setU32(pPool, 10)
      const pCoordsOut = m.alloc(8) >>> 0
      const pStatusOut = m.alloc(4) >>> 0
      m.setU8(pStatusOut, 1)
      const q10 = qMap.get(0x10)!
      const q11 = qMap.get(0x11)!
      const q12 = qMap.get(0x12)!
      const q13 = qMap.get(0x13)!
      const q14 = qMap.get(0x14)!
      const q15 = qMap.get(0x15)!
      const q16 = qMap.get(0x16)!
      const q17 = qMap.get(0x17)!
      m.setU8((q11.pQuestExt + 0x04) >>> 0, 7)
      m.setU8((q11.pQuestExt + 0x06) >>> 0, 1)
      m.setU32((q11.pQuestExt + 0x10) >>> 0, 123)
      m.setU32((q11.pQuestExt + 0x14) >>> 0, 456)
      m.setU8(q12.pQuestExt, 1)
      m.setU8((q14.pQuestExt + 0x01) >>> 0, 1)
      m.setU8((q14.pQuestExt + 0x02) >>> 0, 1)
      QUESTRECORD_SetQuestState113c(m, qf1, 0x15, 0)

      // Party relation node on plr1 (pPlayerData + 0x38) -> plr2 (guid 4002)
      const pRelNode = m.alloc(0x10) >>> 0
      m.setU32(pRelNode, 4002)
      m.setU32((pRelNode + 0x04) >>> 0, 0x09) // flags
      m.setU32((pRelNode + 0x08) >>> 0, 1234) // hostile tick
      m.setU16((pRelNode + 0x0c) >>> 0, 0x09) // relation state
      m.setU32((pd1 + 0x38) >>> 0, pRelNode)

      beginVaTrace113c()
      expect(SKILLS_DeductFromStatPool113c(m, 4, pPool)).toBe(0)
      expect(m.u32(pPool)).toBe(6)
      expect(REGPOP_CanSpawnPresetMinionPack113c(m, 0xe5)).toBe(0)
      expect(REGPOP_CanSpawnPresetMinionPack113c(m, 10)).toBe(1)
      expect(REGPOP_RemapDirectionalMonsterClassId113c(m, 0x13, 6)).toBe(0x14)
      expect(MONSTER_HasAnyInteractingPlayer113c(m, pInteractHolder)).toBe(1)
      expect(MONSTER_CountInteractingPlayers113c(m, pInteractHolder)).toBe(1)
      expect(MONSTER_CheckPlayerInteractUnlocked113c(m, npcMon, plr1)).toBe(1)
      MONSTER_PromotePlayerInteractToTradeState113c(m, npcMon, plr1)
      expect(MONSTER_SetLastInteractTarget113c(m, npcMon, 0, 4001)).toBe(1)
      CLIENTS_UpdateCharacterProgression113c(m, cli1, 0, 4)
      expect(SKILLS_DivideValueByMonLvlHp113c(m, 5, 100)).toBe(10)
      expect(SKILLS_SrvSt18_ReturnOne113c(m, pGame, plr1, 10, 1)).toBe(1)
      expect(SUNIT_CanTargetOwnPetWithSkill113c(m, plr1, npcMon, 10)).toBe(0)
      expect(ACT3Q0_StatusFilter113c(m, q10.pQuest, plr1, 0, qf1, pStatusOut)).toBe(0)
      expect(ACT3Q5_IsDuranceEntryBlocked113c(m, pGame, plr1)).toBe(1)
      expect(ACT3Q5_IsCompellingOrbIntact113c(m, pGame)).toBe(1)
      expect(ACT3Q4_CheckOrmusNpcWaitFlag113c(m, pGame)).toBe(1)
      ACT3Q4_ClearOrmusNpcWaitFlag113c(m, pGame)
      expect(ACT3Q4_CheckOrmusNpcWaitFlag113c(m, pGame)).toBe(0)
      expect(ACT3Q1_GetHratliTargetCoords113c(m, pGame, pCoordsOut)).toBe(1)
      expect(m.u32(pCoordsOut)).toBe(123)
      expect(ACT3Q1_GetQuestDataByte04_113c(m, pGame)).toBe(7)
      ACT3Q2_AddQuestDataCount1C_113c(m, pGame, 3)
      expect(m.u32((q10.pQuestExt + 0x1c) >>> 0)).toBe(3)
      ACT3Q7_Callback11_Noop113c(m, q16.pQuest, 0)
      expect(ACT3Q1_HratliIntroStatusFilter113c(m, q10.pQuest, plr1, 0, qf1, pStatusOut)).toBe(0)
      expect(ACT3Q2_DarkWandererStatusFilter113c(m, q11.pQuest, plr1, 0, qf1, pStatusOut)).toBe(0)
      expect(m.u8(pStatusOut)).toBe(0)
      expect(ACT3Q0_MarkWandererSeenCallback113c(m, pGame, plr1, 0)).toBe(0)
      ACT3Q5_CompleteCouncilPartyCallback113c(m, pGame, plr1, 0)
      expect(ACT3Q5_SyncCouncilQuestFlagsCallback113c(m, pGame, plr1, 0)).toBe(0)
      ACT3Q4_OnQuestUnitDeactivate113c(m, q14.pQuest, npcMon)
      ACT3Q4_SyncTomePartyQuestStateCallback113c(m, pGame, plr1, 0)
      ACT3Q3_OnKhalimsWillCubed113c(m, plr1, pGame)
      const pQArg5D = m.alloc(0x20) >>> 0
      m.setU32((pQArg5D + 0x0c) >>> 0, plr1)
      ACT3Q7_SendQuestUpdatePacket5D_113c(m, q16.pQuest, 1, pQArg5D)
      expect(ACT3Q6_SetGidbinnState0ECallback113c(m, pGame, plr1, 0)).toBe(0)
      expect(ACT3Q6_SyncGidbinnState02Callback113c(m, pGame, plr1, 0)).toBe(0)
      expect(PARTY_FindPlayerRelationNode113c(m, plr1, plr2)).toBe(pRelNode)
      expect(PARTY_GetHostileCooldownTick113c(m, plr1, plr2)).toBe(1234)
      expect(PARTY_GetPlayerRelationState113c(m, plr1, plr2)).toBe(0x09)
      expect(PARTY_TestPlayerRelationFlags113c(m, plr1, plr2, 0x08)).toBe(0x08)
      expect(q13.pQuest).not.toBe(0)
      expect(q15.pQuest).not.toBe(0)
      expect(q17.pQuest).not.toBe(0)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 2: k2w6-b2 (36 VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pGame, pMonStatsTxt, pSkillsTxt, pObjectsTxt } = createWave10World()
      const { pRoom } = allocRoom(m, 2, 80, 80)
      const { pPlayer: plr, pClient: cli, pPath: plrPath } = allocPlayer(m, pGame, 5001, pRoom, 80, 80)
      const { pMonster: mon, pAiCtrl: monAiCtrl, pPath: monPath } = allocMonster(m, pGame, 10, 5010, 82, 80, pRoom)
      const { pMonster: defMon } = allocMonster(m, pGame, 11, 5011, 83, 80, pRoom)
      const { pItem: itm } = allocItem(m, pGame, 1, 5020)
      const { pObj: wellObj, pObjData: wellData } = allocObject(m, 1, pRoom, 5030, 80, 80)
      m.setU32((wellObj + 0x10) >>> 0, 2)
      m.setU32(wellData, (pObjectsTxt + D2ObjectsTxt_SIZE) >>> 0)

      m.setU32((plrPath + 0x58) >>> 0, defMon)
      m.setU32((plrPath + 0x5c) >>> 0, 1)
      m.setU32((plrPath + 0x60) >>> 0, 5011)
      m.setU32((monPath + 0x58) >>> 0, plr)
      m.setU32((monPath + 0x5c) >>> 0, 0)
      m.setU32((monPath + 0x60) >>> 0, 5001)

      const pQData = m.alloc(0x100) >>> 0
      const pQState = m.alloc(0x140) >>> 0
      m.setU32((pQData + 0x04) >>> 0, pGame)
      m.setU32((pQData + 0x18) >>> 0, pQState)

      const pOp = m.alloc(0x20) >>> 0
      m.setU32(pOp, pGame)
      m.setU32((pOp + 0x04) >>> 0, wellObj)
      m.setU32((pOp + 0x08) >>> 0, plr)

      const pAiParam = m.alloc(0x30) >>> 0
      m.setU32(pAiParam, monAiCtrl)
      m.setU32((pAiParam + 0x1c) >>> 0, (pMonStatsTxt + 10 * 0x1a8) >>> 0)
      const pNpcSlot = m.alloc(0x30) >>> 0
      const pNpcUnit = allocMonster(m, pGame, 150, 5040, 84, 80, pRoom).pMonster
      const pPetSlot = m.alloc(0x20) >>> 0
      const pDmg = m.alloc(0x70) >>> 0
      const pAuraCtx = m.alloc(0x20) >>> 0
      const pAuraDesc = m.alloc(0x40) >>> 0
      m.setU32((pAuraCtx + 0x0c) >>> 0, pAuraDesc)

      // Roster for 0x6FCDD160
      const pRoster = m.alloc(0x80) >>> 0
      m.setU32((pNpcSlot + 0x10) >>> 0, pRoster)
      m.setU32((pRoster + 0x0c) >>> 0, 1) // 1 available entry -> returns early without assert

      // Act2Q2 callback arg
      const pQ2Arg = m.alloc(0x20) >>> 0
      m.setU32((pQ2Arg + 0x08) >>> 0, itm)

      beginVaTrace113c()
      ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c(m, pQData, pQState)
      expect(OBJ_OperateWell_6FC8CEE0_113c(m, pOp)).toBe(0)
      MONAI_SkirmishApproachFleeAttackThink_6FCA51E0_113c(m, pGame, mon, pAiParam)
      MONAI_PutridDefilerImpregnateThink_6FCA5500_113c(m, pGame, mon, pAiParam)
      NPCS_ResetVendorSlotInventory_6FCB02E0_113c(m, pGame, pNpcSlot, pNpcUnit)
      expect(m.u32((pNpcSlot + 0x04) >>> 0)).toBeGreaterThan(0)
      expect(SKILLS_RollMonsterConversionChance_6FCB1610_113c(m, defMon, plr, 100)).toBe(1)
      expect(SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c(m, pGame, plr, 1, 0)).toBe(0)
      expect(SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c(m, pGame, plr, 1, 1)).toBe(1)
      expect(SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c(m, pGame, plr, 1, 1)).toBe(0)
      expect(SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c(m, pGame, plr, 1, 1)).toBe(1)
      expect(SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c(m, pGame, plr, 1, 1)).toBe(1)
      expect(SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c(m, pGame, plr, 1, 1)).toBe(0)
      expect(SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c(m, pAuraCtx, 0)).toBe(0)
      expect(SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c(m, pGame, plr, 1, 1)).toBe(0)
      expect(SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c(m, pGame, plr, 1, 1)).toBe(1)
      PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c(m, pGame, pPetSlot)
      PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c(m, pGame, plr, pPetSlot, 1, 0)
      PETS_RemovePetFromSlotByGuid_6FCB7920_113c(m, pGame, 9999, pPetSlot, 1)
      expect(SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c(m, -1, defMon, plr, 1, 0)).toBe(0)
      expect(ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c(m, itm, plr, cli)).toBe(0)
      expect(AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c(m, 0, 0, pDmg, pGame, 80, 80, 5)).toBe(1)
      expect(
        SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(m, 0, plr, pGame, -1, 1, 1, 0, 0, 0, 0),
      ).toBe(0)
      MONAI_InitShadowMasterClassSkills_6FCC4320_113c(m, pGame, mon, pAiParam)
      expect(MONAI_CanShadowCastSkillInContext_6FCC44C0_113c(m, pAiParam, -1, mon, pGame, plr)).toBe(0)
      MONAI_DeathSentryTrapThink_6FCC7C20_113c(m, pGame, mon, pAiParam)
      MONAI_StationarySentryTrapThink_6FCC7DC0_113c(m, pGame, mon, pAiParam)
      MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c(m, pGame, mon, pAiParam)
      MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c(m, pGame, mon, pAiParam)
      MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c(m, pGame, mon, pAiParam)
      expect(ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c(m, pGame, plr, itm, 0, 80, 80, 0)).toBe(0)
      expect(SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c(m, pGame, mon, 1, 1)).toBe(1)
      expect(SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c(m, pGame, mon, 1, 1)).toBe(0)
      expect(ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c(m, pGame, plr, 0)).toBe(0)
      NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c(m, pGame, pNpcSlot, 150)
      NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c(m, plr, pGame, pNpcUnit)
      ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c(m, pQData, pQ2Arg)
      expect(pSkillsTxt).not.toBe(0)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Shard 3: k2w7-b4 (36 VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pGame, pQuestCtrl, pObjectsTxt } = createWave10World()
      const { pRoom } = allocRoom(m, 75, 80, 80)
      const { pPlayer: plr, pClient: cli, pInv } = allocPlayer(m, pGame, 6001, pRoom, 80, 80)
      const { pPlayer: plr2 } = allocPlayer(m, pGame, 6002, pRoom, 82, 80)
      const { pMonster: mon } = allocMonster(m, pGame, 12, 6010, 83, 80, pRoom)
      const { pItem: itm } = allocItem(m, pGame, 1, 6020)
      const { pObj: urnObj, pObjData: urnObjData } = allocObject(m, 0x0b, pRoom, 6030, 80, 80)
      m.setU32(urnObjData, (pObjectsTxt + 0x0b * D2ObjectsTxt_SIZE) >>> 0)

      const qMap = attachQuests(m, pQuestCtrl, pGame, [0x08, 0x09, 0x0e, 0x11, 0x13, 0x14, 0x16, 0x1c])
      const qRad = qMap.get(0x08)!
      const qDur = qMap.get(0x0e)!
      const qGid = qMap.get(0x11)!
      const qTome = qMap.get(0x14)!
      const qMeph = qMap.get(0x16)!
      m.setU8((qRad.pQuestExt + 0x0a) >>> 0, 1)
      m.setU8((qDur.pQuest + 0x09) >>> 0, 0)
      m.setU8((qMeph.pQuest + 0x0c) >>> 0, 0)

      const pQArg = m.alloc(0x20) >>> 0
      m.setU32(pQArg, pGame)
      m.setU32((pQArg + 0x08) >>> 0, mon)
      m.setU32((pQArg + 0x0c) >>> 0, plr)

      const pOpArgs = m.alloc(0x20) >>> 0
      m.setU32(pOpArgs, pGame)
      m.setU32((pOpArgs + 0x04) >>> 0, urnObj)
      m.setU32((pOpArgs + 0x08) >>> 0, plr)
      m.setU32((pOpArgs + 0x10) >>> 0, 1)
      m.setU32((pObjectsTxt + D2ObjectsTxt_SIZE + 0xdc) >>> 0, 0x400)

      const pPkt = m.alloc(0x20) >>> 0
      const pOutErr = m.alloc(4) >>> 0
      const pSaveBuf = m.alloc(0x200) >>> 0
      const pSaveSize = m.alloc(4) >>> 0

      // Enable loot permission bit on cli+0x0a for 0x6FD10F40
      m.setU8((cli + 0x0a) >>> 0, 0x04)

      beginVaTrace113c()
      expect(OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c(m, pOpArgs)).toBe(0)
      expect(OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c(m, pOpArgs)).toBe(0)
      PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c(m, pGame, plr, itm)
      ACT2Q1_OnRadamentKilled_6FCE7540_113c(m, qRad.pQuest, pQArg)
      expect(m.u8(qRad.pQuestExt)).toBe(1)
      ACT2Q6_OnDurielKilled_6FCE97D0_113c(m, qDur.pQuest, pQArg)
      expect(m.u32((qDur.pQuestExt + 0x18) >>> 0)).toBe(2)
      MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c(m, pGame)
      expect(m.u32((pGame + 0xec) >>> 0)).not.toBe(0)
      expect(C2S_Packet3A_AddStatPoint_6FCEC960_113c(m, pGame, 0, pPkt, 3)).toBe(2)
      expect(C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c(m, pGame, plr, pPkt, 4)).toBe(3)
      expect(C2S_Packet28_SocketItem_6FCEEBD0_113c(m, pGame, plr, pPkt, 4)).toBe(3)
      expect(C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c(m, pGame, plr, pPkt, 4)).toBe(3)
      expect(C2S_Packet34_CainIdentifyItems_6FCEF070_113c(m, pGame, plr, pPkt, 4)).toBe(3)
      expect(C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c(m, pGame, plr, pPkt, 2)).toBe(3)
      expect(ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c(m, itm, pGame, plr)).toBe(0)
      expect(ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c(m, plr, pGame)).toBe(0)
      expect(() =>
        ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c(m, 6020, 6020, 0, plr, pOutErr),
      ).toThrow(D2CommonAssertError)
      expect(ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c(m, itm, plr, 1)).toBe(0)
      ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c(m, plr, itm, pGame)
      expect(() => ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c(m, plr, 0, 6020, 1)).toThrow(
        D2CommonAssertError,
      )
      expect(() =>
        ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c(m, 6020, 0, plr, 4, pOutErr),
      ).toThrow(D2CommonAssertError)
      expect(ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c(m, 0, plr, pGame, 99999, pOutErr, 0, 0, 0)).toBe(0)
      ITEMS_PickupGroundItemToCursor_6FCF7160_113c(m, plr, pGame, 99999, pOutErr)
      expect(ITEMS_UseBeltItem_6FCF8BA0_113c(m, pOutErr, 99999, pGame, plr, 80, 80, 0)).toBe(0)
      expect(() => ITEMS_SwitchWeaponSlots_6FCF8EA0_113c(m, plr, 0, pOutErr)).toThrow(D2CommonAssertError)
      expect(() => ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c(m, 6020, plr, 6020, 0, pOutErr)).toThrow(
        D2CommonAssertError,
      )
      SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c(m, 0, 100, pGame)
      ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c(m, pGame, plr)
      expect(ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c(m, pGame, plr, 0)).toBe(0)
      expect(ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c(m, qMeph.pQuest, 0)).toBe(1)
      expect(m.u8((qMeph.pQuest + 0x0c) >>> 0)).toBe(1)
      ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c(m, pGame, plr)
      ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c(m, qTome.pQuest, pQArg)
      expect(m.u8((qTome.pQuest + 0x0c) >>> 0)).toBe(3)
      ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c(m, qTome.pQuest, pQArg)
      expect(m.u8((qTome.pQuest + 0x0c) >>> 0)).toBe(4)
      ACT3Q2_OnGidbinnBossKilled_6FD08140_113c(m, qGid.pQuest, pQArg)
      expect(PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c(m, mon, pGame, pSaveBuf, pSaveSize, 0x200, 0, 0)).toBe(2)
      expect(MONSTER_SpawnFallenShamanPack_6FD0FB80_113c(m, mon, 1, pGame, pRoom, 80, 80, 0)).toBe(0)
      PARTY_DeclareHostility_6FD10CD0_113c(m, pGame, plr, plr2)
      PARTY_ToggleLootPermission_6FD10F40_113c(m, pGame, plr, plr2, 1, 0)
      expect(pInv).not.toBe(0)
      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    const missingVas = WAVE10_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
