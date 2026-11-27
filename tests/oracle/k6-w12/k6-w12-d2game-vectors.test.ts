/**
 * Milestone #37 [K6] Wave 12 — Real-DLL D2Game.dll (0x6FCC0000..0x6FD142D0)
 * Hi-VA Part 4 Differential Vector Suite.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

import { SKILLS_CanMonsterCastAtTarget113c } from '../../../src/d2kern-113c/game/ai-fallen-113c'
import { NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c } from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import {
  AI_Think_TeleportLeashOrApproachOwner_6FCC9D40_113c,
  NPCTRADE_InteractResurrectMerc_6FCE0DB0_113c,
} from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  D2Game_6FCCA710_113c,
  D2Game_6FCCAC30_113c,
  D2Game_6FCCC410_113c,
  D2Game_6FCEF810_113c,
  D2Game_6FCF8020_113c,
  D2Game_6FCF8600_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  ACT3Q2_OperateGidbinnAltar_6FD09C80_113c,
  ACT3Q3_CleanupKhalimItemsOnEnterAct2OrComplete_6FD087E0_113c,
  AI_MercOrShadowWarriorThink_6FCCC8E0_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import {
  ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c,
  ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  ACT2Q6_InitQuestTableRecord_6FCE9F60_113c,
  ACT3Q2_InitQuestTableRecord_6FD09DC0_113c,
  ACT3Q4_InitQuestTableRecord_6FD093C0_113c,
  ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c,
  ACT3Q5_InitQuestTableRecord_6FD09200_113c,
  ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c,
  ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c,
  ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c,
  ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c,
  ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c'
import { PLAYERLIST_SetHostileDelayTick_6FD10090_113c } from '../../../src/d2kern-113c/game/k2-w2b8-113c'
import {
  AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c,
  AI_TickSummonedTimedAttacker_6FCC4D10_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import {
  MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c,
  MONAI_ForEachPackMemberWithFilter_6FCD1320_113c,
  MONAI_MeleeAndRangedSkillThink_6FCC6530_113c,
  MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c,
  MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c,
  MONAI_NestOrMeleeWanderThink_6FCC5B30_113c,
  MONAI_UnburrowThink_6FCC59B0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import {
  ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c,
  ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c,
  ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c,
  ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c,
  ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c,
  AIBAAL_ChooseActionWeighted_6FCD7380_113c,
  AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c,
  AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c,
  AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c,
  SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c,
  SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c,
  SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c,
  SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c,
  SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c,
  SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c,
  SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b8-113c'
import {
  ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c,
  AIBAAL_SelectAction_6FCD79B0_113c,
  AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c,
  SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c,
  SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c,
  SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c,
  SUNITDMG_ProcHitOpenWounds_6FCCD410_113c,
} from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import {
  ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c,
  ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c,
  ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c,
  ACT2Q5_InitArcanePortalObject_6FCE2850_113c,
} from '../../../src/d2kern-113c/game/k2-w5b4-113c'
import {
  ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c,
  ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c,
  ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c,
  ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c,
  ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c,
} from '../../../src/d2kern-113c/game/k2-w5b5-113c'
import {
  A5Q4_OpenTemplePortalObject_6FCE94E0_113c,
  AIBAAL_SelectCombatAction_6FCC8E80_113c,
  SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import { QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c } from '../../../src/d2kern-113c/game/k2-w5b7-113c'
import {
  ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c,
  ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c,
  ACT3Q2_GidbinnStatusFilter_6FD045B0_113c,
  ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c,
  ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c,
  ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c,
  ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c,
  ACT3Q7_InitMephistoPortalObject_6FD03290_113c,
  ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c,
} from '../../../src/d2kern-113c/game/k2-w5b8-113c'
import {
  ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c,
  ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c,
  ACT3Q4_StatusFilter_6FD06E00_113c,
  ACT3Q5_InitCouncilBossPreset_6FD08310_113c,
  ACT3Q5_InitStairsObject_6FD098E0_113c,
  ACT3Q5_OnStairsProximityTimer_6FD09960_113c,
  QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c,
} from '../../../src/d2kern-113c/game/k2-w5b9-113c'
import {
  ACT2Q7_InitQuestData_6FCE5790_113c,
  ACT2Q8_InitQuestData_6FCE4880_113c,
  MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c,
  MONAI_CanShadowCastSkillInContext_6FCC44C0_113c,
  MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c,
  MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import { AI_ThinkBladeCreeper_6FCC6B70_113c } from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import {
  ACT2Q2_OperateHoradricCubeChest_6FCEA050_113c,
  ACT2Q2_OperateHoradricScrollChest_6FCEA290_113c,
  ACT2Q2_OperateStaffOfKingsChest_6FCEA170_113c,
  ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c,
  ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c,
  ACT4Q2_InitHellforgeObject_6FCD9E80_113c,
  AIBAAL_ExecuteCommandAction_6FCD8070_113c,
  AITARGET_FindBestHostileTargetTether75_6FCD7090_113c,
  AITARGET_FindBestHostileTarget_6FCC4610_113c,
  ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c,
  MONREG_InitAllActMonsterRegions_6FCEAB30_113c,
  QUEST0D_InitTemplePortalObject_6FCE9ED0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c'
import {
  ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c,
  ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c,
  ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c,
  ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c,
  ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c,
  ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c,
  ACT3Q3_OperateSewerLeverObject_6FD09F60_113c,
  ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b6-113c'
import {
  ACT2Q5_OnSummonerKilled_6FCE66B0_113c,
  ACT4Q1_OnIzualKilled_6FCDABF0_113c,
  AIBAAL_CloneThink_6FCD8460_113c,
  AIBAAL_CombatThink_6FCC9610_113c,
  AIBAAL_ThroneRoomThink_6FCD8610_113c,
  MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c,
  MONAI_NihlathakThink_6FCC7580_113c,
  MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c,
  MONAI_SiegeMinionThinkA_6FCC5EB0_113c,
  MONAI_SiegeMinionThinkB_6FCC6050_113c,
  MONAI_SiegeMinionThinkC_6FCC62D0_113c,
  MONAI_WorldstoneMinionThink_6FCC7410_113c,
  SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c,
  SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c'
import {
  ACT2Q1_OnRadamentKilled_6FCE7540_113c,
  ACT2Q6_OnDurielKilled_6FCE97D0_113c,
  ACT3Q2_OnGidbinnBossKilled_6FD08140_113c,
  ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c,
  ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c,
  ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c,
  ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c,
  MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import {
  MONAI_DarkWandererThink_6FCC6E60_113c,
  MONAI_SiegeMinionThinkDispatch_6FCC7530_113c,
  SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c,
  SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c,
  SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import {
  ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c,
  ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c,
  ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c,
} from '../../../src/d2kern-113c/game/k2-w8b3-113c'
import {
  ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c,
  ACT3Q1_OnQuestItemPickedUp_6FD07640_113c,
  ACT3Q2_OnGidbinnPickedUp_6FD07770_113c,
  ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c,
  ACT3Q7_OnMephistoKilled_6FD09A10_113c,
} from '../../../src/d2kern-113c/game/k2-w8b4-113c'
import { ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c } from '../../../src/d2kern-113c/game/k2-w9b2-113c'

type KernelFn113c = (m: SparseMemory113c, ...args: number[]) => number | void

const DISPATCH_BY_VA: Readonly<Record<string, KernelFn113c>> = {
  '0x6FCCA710': D2Game_6FCCA710_113c as unknown as KernelFn113c,
  '0x6FCCAC30': D2Game_6FCCAC30_113c as unknown as KernelFn113c,
  '0x6FCCC410': D2Game_6FCCC410_113c as unknown as KernelFn113c,
  '0x6FCCD410': SUNITDMG_ProcHitOpenWounds_6FCCD410_113c as unknown as KernelFn113c,
  '0x6FCCE200': ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c as unknown as KernelFn113c,
  '0x6FCE0B90': NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c as unknown as KernelFn113c,
  '0x6FCE0DB0': NPCTRADE_InteractResurrectMerc_6FCE0DB0_113c as unknown as KernelFn113c,
  '0x6FCEAB30': MONREG_InitAllActMonsterRegions_6FCEAB30_113c as unknown as KernelFn113c,
  '0x6FCEACC0': MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c as unknown as KernelFn113c,
  '0x6FCEF810': D2Game_6FCEF810_113c as unknown as KernelFn113c,
  '0x6FCF3CB0': ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c as unknown as KernelFn113c,
  '0x6FCF57F0': ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c as unknown as KernelFn113c,
  '0x6FCF5C30': ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c as unknown as KernelFn113c,
  '0x6FCF6760': ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c as unknown as KernelFn113c,
  '0x6FCF8020': D2Game_6FCF8020_113c as unknown as KernelFn113c,
  '0x6FCF8600': D2Game_6FCF8600_113c as unknown as KernelFn113c,
  '0x6FD10090': PLAYERLIST_SetHostileDelayTick_6FD10090_113c as unknown as KernelFn113c,
  '0x6FCE4880': ACT2Q8_InitQuestData_6FCE4880_113c as unknown as KernelFn113c,
  '0x6FCE5790': ACT2Q7_InitQuestData_6FCE5790_113c as unknown as KernelFn113c,
  '0x6FCE9F60': ACT2Q6_InitQuestTableRecord_6FCE9F60_113c as unknown as KernelFn113c,
  '0x6FD09200': ACT3Q5_InitQuestTableRecord_6FD09200_113c as unknown as KernelFn113c,
  '0x6FD093C0': ACT3Q4_InitQuestTableRecord_6FD093C0_113c as unknown as KernelFn113c,
  '0x6FD09DC0': ACT3Q2_InitQuestTableRecord_6FD09DC0_113c as unknown as KernelFn113c,
  '0x6FCDA810': ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c as unknown as KernelFn113c,
  '0x6FD098E0': ACT3Q5_InitStairsObject_6FD098E0_113c as unknown as KernelFn113c,
  '0x6FCE2850': ACT2Q5_InitArcanePortalObject_6FCE2850_113c as unknown as KernelFn113c,
  '0x6FD05F60': ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c as unknown as KernelFn113c,
  '0x6FCE5D10': ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c as unknown as KernelFn113c,
  '0x6FD05A60': ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c as unknown as KernelFn113c,
  '0x6FCE7FB0': ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c as unknown as KernelFn113c,
  '0x6FD084A0': ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c as unknown as KernelFn113c,
  '0x6FD03290': ACT3Q7_InitMephistoPortalObject_6FD03290_113c as unknown as KernelFn113c,
  '0x6FCD9E80': ACT4Q2_InitHellforgeObject_6FCD9E80_113c as unknown as KernelFn113c,
  '0x6FCE71A0': ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c as unknown as KernelFn113c,
  '0x6FCE9ED0': QUEST0D_InitTemplePortalObject_6FCE9ED0_113c as unknown as KernelFn113c,
  '0x6FCDA850': ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c as unknown as KernelFn113c,
  '0x6FD09EA0': ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c as unknown as KernelFn113c,
  '0x6FD09960': ACT3Q5_OnStairsProximityTimer_6FD09960_113c as unknown as KernelFn113c,
  '0x6FD06A60': ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c as unknown as KernelFn113c,
  '0x6FCE99B0': ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c as unknown as KernelFn113c,
  '0x6FCDBCE0': ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c as unknown as KernelFn113c,
  '0x6FD08140': ACT3Q2_OnGidbinnBossKilled_6FD08140_113c as unknown as KernelFn113c,
  '0x6FD07AF0': ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c as unknown as KernelFn113c,
  '0x6FCE39B0': ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c as unknown as KernelFn113c,
  '0x6FD02B70': QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c as unknown as KernelFn113c,
  '0x6FCE5F30': ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c as unknown as KernelFn113c,
  '0x6FCE9A80': ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c as unknown as KernelFn113c,
  '0x6FCE66B0': ACT2Q5_OnSummonerKilled_6FCE66B0_113c as unknown as KernelFn113c,
  '0x6FCE72C0': ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c as unknown as KernelFn113c,
  '0x6FD07770': ACT3Q2_OnGidbinnPickedUp_6FD07770_113c as unknown as KernelFn113c,
  '0x6FCD9F20': ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c as unknown as KernelFn113c,
  '0x6FCDA960': ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c as unknown as KernelFn113c,
  '0x6FCD9830': ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c as unknown as KernelFn113c,
  '0x6FCEA290': ACT2Q2_OperateHoradricScrollChest_6FCEA290_113c as unknown as KernelFn113c,
  '0x6FCEA050': ACT2Q2_OperateHoradricCubeChest_6FCEA050_113c as unknown as KernelFn113c,
  '0x6FCEA170': ACT2Q2_OperateStaffOfKingsChest_6FCEA170_113c as unknown as KernelFn113c,
  '0x6FD0A390': ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c as unknown as KernelFn113c,
  '0x6FD0A4C0': ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c as unknown as KernelFn113c,
  '0x6FD0A5F0': ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c as unknown as KernelFn113c,
  '0x6FD050C0': ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c as unknown as KernelFn113c,
  '0x6FD09F60': ACT3Q3_OperateSewerLeverObject_6FD09F60_113c as unknown as KernelFn113c,
  '0x6FD08010': ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c as unknown as KernelFn113c,
  '0x6FCDBF30': ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c as unknown as KernelFn113c,
  '0x6FCD93B0': ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c as unknown as KernelFn113c,
  '0x6FD07640': ACT3Q1_OnQuestItemPickedUp_6FD07640_113c as unknown as KernelFn113c,
  '0x6FD094C0': ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c as unknown as KernelFn113c,
  '0x6FD03850': ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c as unknown as KernelFn113c,
  '0x6FCDABF0': ACT4Q1_OnIzualKilled_6FCDABF0_113c as unknown as KernelFn113c,
  '0x6FD057D0': ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c as unknown as KernelFn113c,
  '0x6FD09C80': ACT3Q2_OperateGidbinnAltar_6FD09C80_113c as unknown as KernelFn113c,
  '0x6FCE3A80': ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c as unknown as KernelFn113c,
  '0x6FCE3320': ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c as unknown as KernelFn113c,
  '0x6FCE7540': ACT2Q1_OnRadamentKilled_6FCE7540_113c as unknown as KernelFn113c,
  '0x6FD03B40': ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c as unknown as KernelFn113c,
  '0x6FCE6240': ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c as unknown as KernelFn113c,
  '0x6FD06000': ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c as unknown as KernelFn113c,
  '0x6FD08310': ACT3Q5_InitCouncilBossPreset_6FD08310_113c as unknown as KernelFn113c,
  '0x6FCE41D0': ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c as unknown as KernelFn113c,
  '0x6FD073C0': ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c as unknown as KernelFn113c,
  '0x6FD03120': ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c as unknown as KernelFn113c,
  '0x6FCDBDC0': ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c as unknown as KernelFn113c,
  '0x6FD045B0': ACT3Q2_GidbinnStatusFilter_6FD045B0_113c as unknown as KernelFn113c,
  '0x6FD06E00': ACT3Q4_StatusFilter_6FD06E00_113c as unknown as KernelFn113c,
  '0x6FD0A730': QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c as unknown as KernelFn113c,
  '0x6FCDC2C0': ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c as unknown as KernelFn113c,
  '0x6FCE97D0': ACT2Q6_OnDurielKilled_6FCE97D0_113c as unknown as KernelFn113c,
  '0x6FD087E0': ACT3Q3_CleanupKhalimItemsOnEnterAct2OrComplete_6FD087E0_113c as unknown as KernelFn113c,
  '0x6FCDB6A0': ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c as unknown as KernelFn113c,
  '0x6FCE9CB0': ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c as unknown as KernelFn113c,
  '0x6FD07DB0': ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c as unknown as KernelFn113c,
  '0x6FD0A140': ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c as unknown as KernelFn113c,
  '0x6FD09A10': ACT3Q7_OnMephistoKilled_6FD09A10_113c as unknown as KernelFn113c,
  '0x6FCE94E0': A5Q4_OpenTemplePortalObject_6FCE94E0_113c as unknown as KernelFn113c,
  '0x6FD06190': ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c as unknown as KernelFn113c,
  '0x6FCDB8D0': ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c as unknown as KernelFn113c,
  '0x6FCD5FB0': SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c as unknown as KernelFn113c,
  '0x6FCD4410': SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c as unknown as KernelFn113c,
  '0x6FCD3D60': SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c as unknown as KernelFn113c,
  '0x6FCD49F0': SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c as unknown as KernelFn113c,
  '0x6FCD4870': SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c as unknown as KernelFn113c,
  '0x6FCD42D0': SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c as unknown as KernelFn113c,
  '0x6FCD5E50': SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c as unknown as KernelFn113c,
  '0x6FCD52A0': SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c as unknown as KernelFn113c,
  '0x6FCD5110': SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c as unknown as KernelFn113c,
  '0x6FCCDFA0': SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c as unknown as KernelFn113c,
  '0x6FCD5450': SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c as unknown as KernelFn113c,
  '0x6FCD5950': SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c as unknown as KernelFn113c,
  '0x6FCD6380': SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c as unknown as KernelFn113c,
  '0x6FCD3F10': SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c as unknown as KernelFn113c,
  '0x6FCD60C0': SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c as unknown as KernelFn113c,
  '0x6FD13E30': SKILLS_CanMonsterCastAtTarget113c as unknown as KernelFn113c,
  '0x6FCD7750': AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c as unknown as KernelFn113c,
  '0x6FCD75D0': AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c as unknown as KernelFn113c,
  '0x6FCD7380': AIBAAL_ChooseActionWeighted_6FCD7380_113c as unknown as KernelFn113c,
  '0x6FCD79B0': AIBAAL_SelectAction_6FCD79B0_113c as unknown as KernelFn113c,
  '0x6FCC8E80': AIBAAL_SelectCombatAction_6FCC8E80_113c as unknown as KernelFn113c,
  '0x6FCC44C0': MONAI_CanShadowCastSkillInContext_6FCC44C0_113c as unknown as KernelFn113c,
  '0x6FCC4890': MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c as unknown as KernelFn113c,
  '0x6FCD7090': AITARGET_FindBestHostileTargetTether75_6FCD7090_113c as unknown as KernelFn113c,
  '0x6FCC4610': AITARGET_FindBestHostileTarget_6FCC4610_113c as unknown as KernelFn113c,
  '0x6FCCC8E0': AI_MercOrShadowWarriorThink_6FCCC8E0_113c as unknown as KernelFn113c,
  '0x6FCC7530': MONAI_SiegeMinionThinkDispatch_6FCC7530_113c as unknown as KernelFn113c,
  '0x6FCD1320': MONAI_ForEachPackMemberWithFilter_6FCD1320_113c as unknown as KernelFn113c,
  '0x6FCD2120': MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c as unknown as KernelFn113c,
  '0x6FCD8070': AIBAAL_ExecuteCommandAction_6FCD8070_113c as unknown as KernelFn113c,
  '0x6FCC5EB0': MONAI_SiegeMinionThinkA_6FCC5EB0_113c as unknown as KernelFn113c,
  '0x6FCC6050': MONAI_SiegeMinionThinkB_6FCC6050_113c as unknown as KernelFn113c,
  '0x6FCC62D0': MONAI_SiegeMinionThinkC_6FCC62D0_113c as unknown as KernelFn113c,
  '0x6FCC5C80': MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c as unknown as KernelFn113c,
  '0x6FCC4D10': AI_TickSummonedTimedAttacker_6FCC4D10_113c as unknown as KernelFn113c,
  '0x6FCC7410': MONAI_WorldstoneMinionThink_6FCC7410_113c as unknown as KernelFn113c,
  '0x6FCC59B0': MONAI_UnburrowThink_6FCC59B0_113c as unknown as KernelFn113c,
  '0x6FCD78A0': AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c as unknown as KernelFn113c,
  '0x6FCC5D70': MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c as unknown as KernelFn113c,
  '0x6FCC9D40': AI_Think_TeleportLeashOrApproachOwner_6FCC9D40_113c as unknown as KernelFn113c,
  '0x6FCD8460': AIBAAL_CloneThink_6FCD8460_113c as unknown as KernelFn113c,
  '0x6FCD8610': AIBAAL_ThroneRoomThink_6FCD8610_113c as unknown as KernelFn113c,
  '0x6FCC7A10': MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c as unknown as KernelFn113c,
  '0x6FCC5350': AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c as unknown as KernelFn113c,
  '0x6FCC6B70': AI_ThinkBladeCreeper_6FCC6B70_113c as unknown as KernelFn113c,
  '0x6FCC7580': MONAI_NihlathakThink_6FCC7580_113c as unknown as KernelFn113c,
  '0x6FCC9610': AIBAAL_CombatThink_6FCC9610_113c as unknown as KernelFn113c,
  '0x6FCC8270': MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c as unknown as KernelFn113c,
  '0x6FCC8350': MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c as unknown as KernelFn113c,
  '0x6FCC5B30': MONAI_NestOrMeleeWanderThink_6FCC5B30_113c as unknown as KernelFn113c,
  '0x6FCC6E60': MONAI_DarkWandererThink_6FCC6E60_113c as unknown as KernelFn113c,
  '0x6FCC6530': MONAI_MeleeAndRangedSkillThink_6FCC6530_113c as unknown as KernelFn113c,
  '0x6FCC80C0': MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c as unknown as KernelFn113c,
  '0x6FCC4FD0': AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c as unknown as KernelFn113c,
  '0x6FCD5BD0': SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c as unknown as KernelFn113c,
}

const EXPECTED_VA_COUNT = 150
const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x0000c000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

interface MemRunRecord {
  readonly addr: string
  readonly hex: string
}

interface K6W12VectorRecord {
  readonly va: string
  readonly name: string
  readonly caseIdx: number
  readonly label: string
  readonly tsArgs: readonly number[]
  readonly retMask: string
  readonly asserted: boolean
  readonly assertLine: number
  readonly ret: string
  readonly setupTop: string
  readonly preMem: readonly MemRunRecord[]
  readonly postMem: readonly MemRunRecord[]
  readonly heapTop: string
  readonly heapHex: string
}

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
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    this.fill(p, size, 0)
    this.heapCursor = (p + size) >>> 0
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

function extractStageRuns(mem: CoWSparseMemory113c, setupTop: number): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  return out
}

function loadVectors(): K6W12VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w12/k6-w12-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W12VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W12VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 12 real-DLL D2Game.dll (0x6FCC0000..0x6FD142D0) Hi-VA Part 4 differential vectors', () => {
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
    bindK2KernelGlobals113c(mem)
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.commitOverlayToBase()
  })

  it(`covers ${EXPECTED_VA_COUNT} real-DLL D2Game.dll VAs in 0x6FCC0000..0x6FD142D0`, () => {
    expect(VECTORS_BY_VA.size).toBe(EXPECTED_VA_COUNT)
    expect(Object.keys(DISPATCH_BY_VA).length).toBe(EXPECTED_VA_COUNT)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(EXPECTED_VA_COUNT * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fcc0000)
      expect(num).toBeLessThanOrEqual(0x6fd142d0)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
      expect(cases.length).toBeGreaterThanOrEqual(3)
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const blk of vec.preMem) {
          const addr = Number.parseInt(blk.addr, 16) >>> 0
          mem.loadBlock(addr, hexToBytes(blk.hex))
        }

        beginVaTrace113c()
        let retVal: unknown = 0
        let caughtErr: unknown = null
        try {
          retVal = fn!(mem, ...vec.tsArgs)
        } catch (err) {
          caughtErr = err
        }
        const hits = endVaTrace113c()
        expect(
          hits.has(`D2Game:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit D2Game:${va}`,
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

        const actualPostMem = extractStageRuns(mem, setupTop)
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
          const actualHeapHex = bytesToHex(mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE))
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        }
      }
    })
  }
})
