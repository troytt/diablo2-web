/**
 * [K6-P10] Real-DLL D2Game.dll Band C (0x6FCB0000..0x6FCDFFFF) Vector Suite.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import { installK4QuestReplay113c } from '../../../src/d2kern-113c/game/k4-quest-replay-113c'
import {
  SKILLS_ConsumeSkillManaOrCharge113c,
  SKILLS_ExecuteSkillDoFunc113c,
  SKILLS_ExecuteSkillStart113c,
  SKILLS_ValidateSkillTargetAlignment113c,
  SrvDoFunc_001_Attack113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c'
import {
  AI_CalcApproxUnitDistSubtiles113c,
  AI_TryMonsterTeleportEscape113c,
} from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  D2GAME_ARENA_BroadcastKillCountsToClients113c,
  D2GAME_ARENA_SyncArenaJoinState113c,
  D2GAME_ARENA_SyncClientKillCountsOnJoin113c,
  D2GAME_INVENTORY_DestroyUnitInventoryItems113c,
  D2GAME_PACKET_Send0x65PlayerKillCount113c,
  D2GAME_SUNIT_SyncRoomUnitsToClient113c,
  D2GAME_SUNIT_SyncUnitStateToClient113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-b-113c'
import {
  AURAS_ApplyRadialStatBuffCallback113c,
  AURA_CheckUnitMatchesFilterFlags113c,
  AURA_ForEachUnitInRadius113c,
  SKILLS_ActivateAuraSkillOnUnit113c,
  STATES_CreateOrUpdateAuraStatList113c,
  SUNITDMG_AddElementalDamageToStruct113c,
  SrvDoFunc_065_AuraRadialStatBuff113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import {
  MISSILE_SpawnNova64Directions113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
  STATES_ClearCurseStatesOnUnit113c,
  STATES_OnTimedStateRemoved113c,
} from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c'
import {
  UNITS_GetDistanceToCoordinates113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import {
  PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c,
  PETS_InsertPetIntoPlayerPetSlot_6FCB7A20_113c,
  SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import {
  PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c,
} from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  AI_Think_ShadowWarriorAndMaster_6FCC9E80_113c,
  SKILLS_RegisterSummonedMonsterPet_6FCC3090_113c,
} from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import {
  D2Game_6FCCA4D0_113c,
  D2Game_6FCCB070_113c,
  D2Game_6FCCB580_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c,
  NPCTRADE_InteractBuyItem_6FCDF200_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import {
  NPCS_BeginVendorOrGambleInteract_6FCDF730_113c,
  SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c,
  SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c,
  NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c'
import {
  MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c,
  SKILLS_ResolveSummonMonsterId_6FCBEE50_113c,
} from '../../../src/d2kern-113c/game/k2-w2b5-113c'
import {
  AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c,
  AURAS_RedemptionCorpseCallback_6FCB8680_113c,
  NPCS_QueueOrFreeVendorItem_6FCB0260_113c,
  PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c,
  SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c,
  SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  AI_CastSkill286AtOffsetY13_6FCC4E40_113c,
  AI_SetStateDirAndStartWalkMode_6FCC41B0_113c,
  AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c,
  AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c,
  SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c,
  SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c,
  SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c,
  SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c,
  STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import {
  ITEMMODS_ApplySlowTarget_6FCCD2A0_113c,
  MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c,
  MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c,
  MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c,
  MONAI_ImpregnateChaseThink_6FCC7F60_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import {
  ACT4Q1_InitNpcDialog_6FCD9560_113c,
  ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c,
  ACT4Q3_InitNpcDialog_6FCD9070_113c,
} from '../../../src/d2kern-113c/game/k2-w4b8-113c'
import {
  SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c,
  SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c,
  SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c,
  SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c,
  SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c,
  SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0_113c,
  STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c,
} from '../../../src/d2kern-113c/game/k2-w5b2-113c'
import {
  ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00_113c,
  AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
  ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c,
  MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c,
  SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c,
  SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c,
  SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c,
  SKILLS_DoChargeStart_6FCB9620_113c,
  SKILLS_DoRedemptionAuraPulse_6FCBA400_113c,
  SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c,
  SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c,
  SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c,
} from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import {
  NPC_DeductPlayerGoldAndStash_6FCDCC60_113c,
  NPC_InitHirelingVendorRoster_6FCDCED0_113c,
  NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c,
  NPC_RollStoreItemUpgrade_6FCDD040_113c,
} from '../../../src/d2kern-113c/game/k2-w5b4-113c'
import {
  ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c,
  ITEMS_UsePercentagePotion_6FCCE6D0_113c,
  SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c,
  SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c,
  MONAI_DeathSentryTrapThink_6FCC7C20_113c,
  MONAI_InitShadowMasterClassSkills_6FCC4320_113c,
  MONAI_StationarySentryTrapThink_6FCC7DC0_113c,
  NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c,
  NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c,
  NPC_SendHirelingListPacketsToClient_6FCDD330_113c,
  SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c,
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c,
  SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c,
  SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  AI_ThinkTerrorCurse_6FCC6FC0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import {
  SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c,
  SKILLS_TryConvertMonsterOnHit_6FCB5120_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import {
  ACT4Q3_OnScrollMessage_6FCDB250_113c,
  ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c,
  ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c,
  PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c,
  SKILLS_SrvDo028_Conversion_6FCB9830_113c,
  SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c'
import {
  ACT4Q1_OnNpcMessage_6FCDA5E0_113c,
  AURA_ApplyRadialDamageCallback_6FCB54F0_113c,
  MONSTER_SpawnAndEquipMonEquipRecordItem_6FCCFCE0_113c,
  SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import {
  NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c,
  NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c,
  NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c,
} from '../../../src/d2kern-113c/game/k2-w8b3-113c'
import {
  NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c,
  PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c,
  PETS_RecalcAndClampPlayerPetTypeForSkill_6FCBF600_113c,
  PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c,
  SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c,
} from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import {
  MONSTER_AddSkillToUnit113c,
  MONSTER_ChooseOutfit113c,
  MONSTER_InitPlacedMonsterPathAndMode113c,
  MONSTER_ScheduleInitialAiEvent113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import {
  GAME_ClearAllActRoomUpdateLists113c,
  SUNIT_SendRemovePortalsInAdjacentRooms113c,
  SUNIT_SyncAdjacentRoomUnitsToClient113c,
} from '../../../src/d2kern-113c/game/replay-final11-113c'
import {
  AI_RogueTownMem113c,
} from '../../../src/d2kern-113c/game/town-npc-ai-113c'
import {
  AITARGET_IterateRoomActiveClients113c,
  AITARGET_ScanUnitsByModeTable113c,
  AI_HandleStunDoorOrLeaderFollow113c,
} from '../../../src/d2kern-113c/game/town-runtime-gap-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  '0x6FCB0260': (m, a) => NPCS_QueueOrFreeVendorItem_6FCB0260_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB0F30': (m, a) => STATES_ClearCurseStatesOnUnit113c(m, a[0]!),
  '0x6FCB1660': (m, a) => SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCB20C0': (m, a) => SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB34A0': (m, a) => SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB35F0': (m, a) => SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB3990': (m, a) => SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FCB4B10': (m, a) => SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB5120': (m, a) => SKILLS_TryConvertMonsterOnHit_6FCB5120_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB54F0': (m, a) => AURA_ApplyRadialDamageCallback_6FCB54F0_113c(m, a[0]!, a[1]!),
  '0x6FCB57F0': (m, a) => SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB6280': (m, a) => SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB6310': (m, a) => SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB6FA0': (m, a) => PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(m, a[0]!, a[1]!),
  '0x6FCB71F0': (m, a) => PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCB7340': (m, a) => PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB7730': (m, a) => PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c(m, a[0]!, a[1]!),
  '0x6FCB7A20': (m, a) => PETS_InsertPetIntoPlayerPetSlot_6FCB7A20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCB7E20': (m, a) => PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCB8450': (m, a) => STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCB8680': (m, a) => AURAS_RedemptionCorpseCallback_6FCB8680_113c(m, a[0]!, a[1]!),
  '0x6FCB8BA0': (m, a) => SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB8E90': (m, a) => SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB9000': (m, a) => SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB9290': (m, a) => SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB9620': (m, a) => SKILLS_DoChargeStart_6FCB9620_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB9830': (m, a) => SKILLS_SrvDo028_Conversion_6FCB9830_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBA1A0': (m, a) => AURAS_ApplyRadialStatBuffCallback113c(m, a[0]!, a[1]!),
  '0x6FCBA400': (m, a) => SKILLS_DoRedemptionAuraPulse_6FCBA400_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBA7C0': (m, a) => AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c(m, a[0]!, a[1]!),
  '0x6FCBA8D0': (m, a) => SrvDoFunc_065_AuraRadialStatBuff113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBABC0': (m, a) => SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBAF50': (m, a) => SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBB3B0': (m, a) => D2GAME_INVENTORY_DestroyUnitInventoryItems113c(m, a[0]!, a[1]!),
  '0x6FCBB630': (m, a) => ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBBB10': (m, a) => ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBCB00': (m, a) => AI_RogueTownMem113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBCD90': (m, a) => AI_HandleStunDoorOrLeaderFollow113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBCDE0': (m, a) => AI_TryMonsterTeleportEscape113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBD780': (m, a) => SUNIT_SendRemovePortalsInAdjacentRooms113c(m, a[0]!, a[1]!),
  '0x6FCBD850': (m, a) => GAME_ClearAllActRoomUpdateLists113c(m, a[0]!),
  '0x6FCBDCD0': (m, a) => D2GAME_SUNIT_SyncUnitStateToClient113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBDE10': (m, a) => D2GAME_SUNIT_SyncRoomUnitsToClient113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBDEC0': (m, a) => SUNIT_SyncAdjacentRoomUnitsToClient113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBEA30': (m, a) => STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBEB80': (m, a) => SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c(m, a[0]!),
  '0x6FCBEE50': (m, a) => SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCBEEB0': (m, a) => SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c(m, a[0]!, a[1]!),
  '0x6FCBEFE0': (m, a) => SUNITDMG_AddElementalDamageToStruct113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCBF340': (m, a) => SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FCBF600': (m, a) => PETS_RecalcAndClampPlayerPetTypeForSkill_6FCBF600_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBF7A0': (m, a) => STATES_OnTimedStateRemoved113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBF850': (m, a) => SKILLS_ConsumeSkillManaOrCharge113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBF9A0': (m, a) => MONSTER_AddSkillToUnit113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBFAE0': (m, a) => SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c(m, a[0]!, a[1]!),
  '0x6FCBFC00': (m, a) => SKILLS_ValidateSkillTargetAlignment113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBFD00': (m, a) => SKILLS_ExecuteSkillStart113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCC0000': (m, a) => SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCC00B0': (m, a) => STATES_CreateOrUpdateAuraStatList113c(m, a[0]!),
  '0x6FCC0370': (m, a) => AURA_CheckUnitMatchesFilterFlags113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC0630': (m, a) => SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC0C70': (m, a) => AURA_ForEachUnitInRadius113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FCC10B0': (m, a) => SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC1210': (m, a) => AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c(m, a[0]!, a[1]!),
  '0x6FCC1790': (m, a) => SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c(m, a[0]!, a[1]!),
  '0x6FCC1880': (m, a) => SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!),
  '0x6FCC19A0': (m, a) => SKILLS_ExecuteSkillDoFunc113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCC1D10': (m, a) => SKILLS_ActivateAuraSkillOnUnit113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC2100': (m, a) => SKILLS_AssignHandSkillAndSyncAura113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC24C0': (m, a) => PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FCC2800': (m, a) => MISSILE_SpawnNova64Directions113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCC28F0': (m, a) => SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!),
  '0x6FCC2C40': (m, a) => SrvDoFunc_001_Attack113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC3090': (m, a) => SKILLS_RegisterSummonedMonsterPet_6FCC3090_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC3220': (m, a) => SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC41B0': (m, a) => AI_SetStateDirAndStartWalkMode_6FCC41B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCC4320': (m, a) => MONAI_InitShadowMasterClassSkills_6FCC4320_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC4A10': (m, a) => AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC4E40': (m, a) => AI_CastSkill286AtOffsetY13_6FCC4E40_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC57E0': (m, a) => AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC6FC0': (m, a) => AI_ThinkTerrorCurse_6FCC6FC0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC7C20': (m, a) => MONAI_DeathSentryTrapThink_6FCC7C20_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC7DC0': (m, a) => MONAI_StationarySentryTrapThink_6FCC7DC0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC7F60': (m, a) => MONAI_ImpregnateChaseThink_6FCC7F60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC9E80': (m, a) => AI_Think_ShadowWarriorAndMaster_6FCC9E80_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCCA4D0': (m, a) => D2Game_6FCCA4D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCCB070': (m, a) => D2Game_6FCCB070_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCCB580': (m, a) => D2Game_6FCCB580_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCCD0F0': (m, a) => ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCCD2A0': (m, a) => ITEMMODS_ApplySlowTarget_6FCCD2A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCCD9C0': (m, a) => ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCCE6D0': (m, a) => ITEMS_UsePercentagePotion_6FCCE6D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCCEDC0': (m, a) => ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCCF450': (m, a) => SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCCF730': (m, a) => MONSTER_ChooseOutfit113c(m, a[0]!, a[1]!),
  '0x6FCCF920': (m, a) => MONSTER_ScheduleInitialAiEvent113c(m, a[0]!, a[1]!),
  '0x6FCCFAB0': (m, a) => MONSTER_InitPlacedMonsterPathAndMode113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCCFCE0': (m, a) => MONSTER_SpawnAndEquipMonEquipRecordItem_6FCCFCE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD06F0': (m, a) => MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCD08F0': (m, a) => UNITS_GetDistanceToCoordinates113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCD0A20': (m, a) => AI_CalcApproxUnitDistSubtiles113c(m, a[0]!, a[1]!),
  '0x6FCD0E90': (m, a) => MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(m, a[0]!, a[1]!),
  '0x6FCD11A0': (m, a) => AITARGET_IterateRoomActiveClients113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD1660': (m, a) => MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD17B0': (m, a) => AITARGET_ScanUnitsByModeTable113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD1AB0': (m, a) => MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD1BC0': (m, a) => MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD2760': (m, a) => D2GAME_PACKET_Send0x65PlayerKillCount113c(m, a[0]!, a[1]!),
  '0x6FCD2C20': (m, a) => D2GAME_ARENA_BroadcastKillCountsToClients113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCD2D40': (m, a) => D2GAME_ARENA_SyncClientKillCountsOnJoin113c(m, a[0]!, a[1]!),
  '0x6FCD2D90': (m, a) => D2GAME_ARENA_SyncArenaJoinState113c(m, a[0]!, a[1]!),
  '0x6FCD4520': (m, a) => SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD4B10': (m, a) => SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD6790': (m, a) => SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD6A60': (m, a) => SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD8CE0': (m, a) => ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c(m, a[0]!, a[1]!),
  '0x6FCD9070': (m, a) => ACT4Q3_InitNpcDialog_6FCD9070_113c(m, a[0]!, a[1]!),
  '0x6FCD9560': (m, a) => ACT4Q1_InitNpcDialog_6FCD9560_113c(m, a[0]!, a[1]!),
  '0x6FCDA5E0': (m, a) => ACT4Q1_OnNpcMessage_6FCDA5E0_113c(m, a[0]!, a[1]!),
  '0x6FCDAA50': (m, a) => ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c(m, a[0]!, a[1]!),
  '0x6FCDB250': (m, a) => ACT4Q3_OnScrollMessage_6FCDB250_113c(m, a[0]!, a[1]!),
  '0x6FCDBC00': (m, a) => ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00_113c(m, a[0]!, a[1]!),
  '0x6FCDC050': (m, a) => ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCDC840': (m, a) => NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCDCC60': (m, a) => NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, a[0]!, a[1]!),
  '0x6FCDCED0': (m, a) => NPC_InitHirelingVendorRoster_6FCDCED0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCDD040': (m, a) => NPC_RollStoreItemUpgrade_6FCDD040_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCDD160': (m, a) => NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCDD330': (m, a) => NPC_SendHirelingListPacketsToClient_6FCDD330_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCDD490': (m, a) => NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCDD880': (m, a) => NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCDD920': (m, a) => NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCDD9B0': (m, a) => NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCDDD80': (m, a) => NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCDF200': (m, a) => NPCTRADE_InteractBuyItem_6FCDF200_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FCDF730': (m, a) => NPCS_BeginVendorOrGambleInteract_6FCDF730_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCDF810': (m, a) => NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P10VectorRecord {
  va: string
  name: string
  caseIdx: number
  label: string
  tsArgs: number[]
  extraCaps: ExtraCapRecord[]
  retMask: string
  asserted: boolean
  assertLine: number
  ret: string
  setupTop: string
  preMem: MemRunRecord[]
  postMem: MemRunRecord[]
  heapTop: string
  heapHex: string
}

const D2COM_PREF_BASE = 0x6fd50000
const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_CS_GAME = 0x30010000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS
const EXPECTED_VAS = Number(process.env.K6_P10_EXPECTED_VAS ?? '137')
const FORBIDDEN_P8_VAS = new Set(
  [0x1340, 0x6f40, 0xbeb0, 0xc1f0, 0xd160, 0xd980, 0xe610, 0xf3b0, 0x2de60].map(
    (off) => (0x6fcb0000 + off) >>> 0,
  ),
)
const TRIVIAL_NOOP_VAS = new Set([0x6fcc3880, 0x6fcc3930, 0x6fcd8930])

class CoWSparseMemory113c extends SparseMemory113c {
  private readonly basePages = new Map<number, Uint8Array>()
  private readonly baseKnown = new Map<number, Uint8Array>()
  private readonly overlayPages = new Map<number, Uint8Array>()
  private readonly overlayKnown = new Map<number, Uint8Array>()
  private heapCursor = HEAP_BASE

  commitOverlayToBase(): void {
    for (const [pg, data] of this.overlayPages.entries()) {
      this.basePages.set(pg, data)
      this.baseKnown.set(pg, this.overlayKnown.get(pg)!)
    }
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  resetOverlay(): void {
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  getHeapTop(): number {
    return this.heapCursor >>> 0
  }

  override alloc(size: number): number {
    const effSize = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    if (p > this.heapCursor) {
      this.fill(this.heapCursor, p - this.heapCursor, 0)
    }
    this.fill(p, effSize, 0)
    this.heapCursor = (p + effSize) >>> 0
    return p
  }

  override loadBlock(addr: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.setU8((addr + i) >>> 0, data[i]!)
    }
  }

  override readBytes(addr: number, len: number): Uint8Array {
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      out[i] = this.u8((addr + i) >>> 0)
    }
    return out
  }

  override u8(p: number): number {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    const ok = this.overlayKnown.get(pg)
    if (ok !== undefined && ok[off] !== 0) {
      return this.overlayPages.get(pg)![off]!
    }
    const bk = this.baseKnown.get(pg)
    if (bk !== undefined && bk[off] !== 0) {
      return this.basePages.get(pg)![off]!
    }
    throw new Error(`CoWSparseMemory113c: read of unloaded byte 0x${addr.toString(16)}`)
  }

  override u16(p: number): number {
    return this.u8(p) | (this.u8((p + 1) >>> 0) << 8)
  }

  override u32(p: number): number {
    return (this.u16(p) | (this.u16((p + 2) >>> 0) << 16)) >>> 0
  }

  override setU8(p: number, v: number): void {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    let od = this.overlayPages.get(pg)
    let ok = this.overlayKnown.get(pg)
    if (od === undefined || ok === undefined) {
      const bd = this.basePages.get(pg)
      const bk = this.baseKnown.get(pg)
      od = bd !== undefined ? bd.slice() : new Uint8Array(PAGE_SIZE)
      ok = bk !== undefined ? bk.slice() : new Uint8Array(PAGE_SIZE)
      this.overlayPages.set(pg, od)
      this.overlayKnown.set(pg, ok)
    }
    od[off] = v & 0xff
    ok[off] = 1
  }

  override setU16(p: number, v: number): void {
    this.setU8(p, v & 0xff)
    this.setU8((p + 1) >>> 0, (v >>> 8) & 0xff)
  }

  override setU32(p: number, v: number): void {
    this.setU16(p, v & 0xffff)
    this.setU16((p + 2) >>> 0, (v >>> 16) & 0xffff)
  }

  override fill(p: number, len: number, v: number): void {
    const byte = v & 0xff
    for (let i = 0; i < len; i++) {
      this.setU8((p + i) >>> 0, byte)
    }
  }

  override get(base: number, f: FieldLayout113c, index = 0): number {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }

  override set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }
}

const HEX_CHARS = '0123456789abcdef'

function hexToBytes(hex: string): Uint8Array {
  const n = hex.length >>> 1
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    out += HEX_CHARS[(b >>> 4) & 0x0f]! + HEX_CHARS[b & 0x0f]!
  }
  return out
}

function extractMemRunsRange(
  mem: CoWSparseMemory113c,
  startAddr: number,
  endAddr: number,
  out: MemRunRecord[],
): void {
  let a = startAddr >>> 0
  const end = endAddr >>> 0
  while (a < end) {
    const chunkEnd = a + 16 <= end ? a + 16 : end
    let nz = false
    for (let k = a; k < chunkEnd; k++) {
      if (mem.u8(k) !== 0) {
        nz = true
        break
      }
    }
    if (!nz) {
      a = chunkEnd
      continue
    }
    const runStart = a
    let runEnd = chunkEnd
    while (runEnd < end && runEnd - runStart < 512) {
      const nextEnd = runEnd + 16 <= end ? runEnd + 16 : end
      let nextNz = false
      for (let k = runEnd; k < nextEnd; k++) {
        if (mem.u8(k) !== 0) {
          nextNz = true
          break
        }
      }
      if (!nextNz) break
      runEnd = nextEnd
    }
    const addrHex = `0x${runStart.toString(16).toUpperCase().padStart(8, '0')}`
    const hex = bytesToHex(mem.readBytes(runStart, runEnd - runStart))
    out.push({ addr: addrHex, hex })
    a = runEnd
  }
}

function extractStageRuns(
  mem: CoWSparseMemory113c,
  setupTop: number,
  extraCaps: readonly ExtraCapRecord[],
): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  extractMemRunsRange(mem, STAGE_CS_GAME, STAGE_CS_GAME + 0x1000, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6P10VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p10/k6-p10-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P10VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P10VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6-P10] Real-DLL D2Game.dll Band C (0x6FCB0000..0x6FCDFFFF) Vector Suite', () => {
  let mem: CoWSparseMemory113c

  beforeAll(() => {
    const imgPath = resolve(
      import.meta.dirname,
      '../../fixtures/oracle/k1/d2game-datatbls-113c.img.gz',
    )
    const raw = gunzipSync(readFileSync(imgPath))
    const hdr = parseVectorHeader(raw)
    expect(hdr.kind).toBe('PAGEIMG')
    expect(hdr.recordSize).toBe(4100)

    mem = new CoWSparseMemory113c()
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    let off = 32
    for (let i = 0; i < hdr.recordCount; i++) {
      const va = view.getUint32(off, true) >>> 0
      mem.loadBlock(va, raw.subarray(off + 4, off + 4 + 4096))
      off += 4100
    }
    // Pre-zero D2Game .bss region before binding canonical globals (preserve initialized .data in 0x6fd1f000..0x6fd2ffff)
    mem.fill(0x6fd30000, 0x2000, 0)
    bindK2KernelGlobals113c(mem)
    installK4QuestReplay113c()
    // Hydrate SGPT_ITEMS_LINKER_PTR_VA (0x6FDEFF6C) at fixed 0x28000100/0x28000110
    mem.fill(0x28000000, 0x4000, 0)
    const nItems = mem.u32(0x6fdefb94) >>> 0
    const pItems = mem.u32(0x6fdefb98) >>> 0
    if (nItems > 0 && nItems < 1900 && pItems !== 0) {
      const nodes: Array<{ code: number; row: number }> = []
      for (let r = 0; r < nItems; r++) {
        const code = mem.u32((pItems + r * 0x1a8 + 0x80) >>> 0) >>> 0
        nodes.push({ code, row: r })
      }
      nodes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.row - b.row))
      const hdrVa = 0x28000100
      const nodesVa = 0x28000110
      mem.setU32(hdrVa, nItems)
      mem.setU32((hdrVa + 4) >>> 0, 0)
      mem.setU32((hdrVa + 8) >>> 0, nodesVa)
      for (let i = 0; i < nodes.length; i++) {
        mem.setU32((nodesVa + i * 8) >>> 0, nodes[i]!.code)
        mem.setU32((nodesVa + i * 8 + 4) >>> 0, nodes[i]!.row >>> 0)
      }
      mem.setU32(0x6fdeff6c, hdrVa)
    }
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.fill(STAGE_CS_GAME, 0x1000, 0)
    // Initialize known-zero D2Game global regions referenced by save/combat/AI paths
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd301e0, 8, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f7c, 0x24, 0)
    mem.commitOverlayToBase()
  })

  it('covers all target real-DLL D2Game Band C VAs (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(EXPECTED_VAS)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fcb0000)
      expect(num).toBeLessThanOrEqual(0x6fcdffff)
      expect(FORBIDDEN_P8_VAS.has(num)).toBe(false)
      expect(TRIVIAL_NOOP_VAS.has(num)).toBe(false)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    const vaNum = Number.parseInt(va, 16) >>> 0
    const modPrefix = vaNum >= D2COM_PREF_BASE ? 'D2Common' : 'D2Game'

    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const cap of vec.extraCaps) {
          const capStart = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capStart, cap.len, 0)
        }
        for (const blk of vec.preMem) {
          const addr = Number.parseInt(blk.addr, 16) >>> 0
          mem.loadBlock(addr, hexToBytes(blk.hex))
        }

        beginVaTrace113c()
        let retVal: unknown = 0
        let caughtErr: unknown = null
        try {
          retVal = fn!(mem, vec.tsArgs)
        } catch (err) {
          caughtErr = err
        }
        const hits = endVaTrace113c()
        expect(
          hits.has(`${modPrefix}:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit ${modPrefix}:${va}`,
        ).toBe(true)

        if (vec.asserted) {
          expect(
            caughtErr,
            `${va} case ${vec.caseIdx} (${vec.label}) expected D2CommonAssertError(${vec.assertLine})`,
          ).toBeInstanceOf(D2CommonAssertError)
          expect((caughtErr as D2CommonAssertError).line).toBe(vec.assertLine)
          continue
        }

        if (caughtErr !== null) {
          throw new Error(
            `${va} case ${vec.caseIdx} (${vec.label}) threw unexpected error: ${String(caughtErr)}`,
          )
        }

        const retMask = Number.parseInt(vec.retMask, 16) >>> 0
        if (retMask !== 0) {
          const actualMasked = ((Number(retVal) | 0) & retMask) >>> 0
          const expectedMasked = Number.parseInt(vec.ret, 16) >>> 0
          expect(
            actualMasked,
            `${va} case ${vec.caseIdx} (${vec.label}) return mismatch: got 0x${actualMasked.toString(16)} expected 0x${expectedMasked.toString(16)}`,
          ).toBe(expectedMasked)
        }

        const actualPostMem = extractStageRuns(mem, setupTop, vec.extraCaps)
        expect(
          actualPostMem,
          `${va} case ${vec.caseIdx} (${vec.label}) staged arena memory mismatch`,
        ).toEqual(vec.postMem)

        if (vec.heapHex.length > 0) {
          const expectedHeapTop = Number.parseInt(vec.heapTop, 16) >>> 0
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) heapTop mismatch`,
          ).toBe(expectedHeapTop)
          const rawHeapBytes = mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE)
          const actualHeapHex = bytesToHex(rawHeapBytes)
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        } else {
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) unexpected heap allocation (expected zero heap drift)`,
          ).toBe(HEAP_BASE)
        }
      }
    })
  }
})
