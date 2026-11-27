/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 7 Batch 2 (`w7b2`) routines across
 * `0x6FC7CFF0..0x6FCB5FE0` (40 functions).
 */

import {
  COLLISION_FindFreePositionBasic113c,
  COLLISION_FindFreePositionSimple113c,
} from '../common/collision'
import {
  UNITS_GetObjectPortalFlags113c,
  UNITS_GetPlayerData113c,
  UNITS_GetStashGoldLimit113c,
  UNITS_SetObjectPortalFlags113c,
} from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32, mulDiv113c } from '../common/int-math'
import {
  INVENTORY_FindBackpackItemByType113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_GetInvPage113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetCompositWeaponMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import { MONSTERS_GetHirelingTypeId113c } from '../common/missile'
import {
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_SetStepNum113c,
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
} from '../common/path'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record'
import {
  SKILLS_CalcKickBootDamage113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetParam1113c,
  SKILLS_GetSkillPhysMaxDamage113c,
  SKILLS_GetSkillPhysMinDamage113c,
  SKILLS_GetSkillToHitBonus113c,
  SKILLS_GetUsedSkill113c,
  SKILLS_SetParam1113c,
} from '../common/skills'
import {
  DUNGEON_GetActLevelId113c,
  STATES_CheckState113c,
  STATES_ClearGfxStateFlag113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetOwnerAndDynamicFlag113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_SetWeaponStatListActive113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
} from '../common/unit'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint'
import type { Memory113c } from '../mem/sparse-memory'
import { SEED_InitLowSeed113c, SEED_InitSeed113c, seedRoll } from '../prng'
import { MONSTERS_CheckMonStatsFlagBit6_113c } from '../tables/datatbls-113c'
import { DATATBLS_GetItemIdFromItemCode113c } from '../tables/item-tbls-113c'
import {
  SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c,
  SKILLS_ApplyProgressiveChargesToDamage113c,
  SKILLS_ConsumeProgressiveChargesOnHit113c,
  SKILLS_ConsumeSkillManaOrCharge113c,
} from './a1c-post150-f786-f1040-113c'
import {
  AI_CastSkillWithMode113c,
  MONSTER_CheckTypeFlagsMask113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FindCombatDamageData113c,
} from './combat-a1c-113c'
import {
  AURA_ForEachUnitInRadius113c,
  STATES_CreateOrUpdateAuraStatList113c,
} from './k2-gap-itemdef-113c'
import {
  SKILLS_ResolveChargedSrvMissileId113c,
  STATES_OnTimedStateRemoved113c,
} from './k2-gap-melee-dot-113c'
import {
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  STATLIST_AddUnitStatGoldGuarded_6FC21670_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import { MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c } from './k2-laneI-0x6fc3-w1-113c'
import {
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c } from './k2-w2b1-113c'
import {
  ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c,
  ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c,
  ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c,
} from './k2-w2b2-113c'
import { NET_SendPacket77_ButtonAction_6FCAB340_113c } from './k2-w2b3-113c'
import { STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c } from './k2-w2b4-113c'
import { SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c } from './k2-w2b5-113c'
import { SUNIT_SetLastKillerInfo_6FCFFAE0_113c } from './k2-w2b8-113c'
import { QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c } from './k2-w3b3-113c'
import {
  ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c,
  ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c,
  ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c,
  ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
  QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c,
} from './k2-w3b6-113c'
import { ACT1Q4_OnCainModeOrInteract_6FC88150_113c } from './k2-w3b7-113c'
import {
  ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
  ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
} from './k2-w4b2-113c'
import { ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c } from './k2-w4b3-113c'
import { SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c } from './k2-w4b5-113c'
import {
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
  SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c,
} from './k2-w4b6-113c'
import {
  SUNITDMG_AllocCombat113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c,
} from './k2-real-s2c-combat-113c'
import { ITEMS_CheckNotBrokenOrUnequipping113c } from './replay-kernel-113c'
import {
  ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c,
  ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c,
  ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c,
} from './k2-w5b2-113c'
import {
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
  SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c,
} from './k2-w5b7-113c'
import { SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c } from './k2-w5b9-113c'
import { ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c } from './k2-w6b1-113c'
import {
  ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c,
  SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c,
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c,
  SKILLS_RollMonsterConversionChance_6FCB1610_113c,
} from './k2-w6b2-113c'
import { NET_BroadcastSystemChatMessage_6FCEBE70_113c } from './k2-w6b3-113c'
import { SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c } from './k2-w5b6-113c'
import {
  ACT1Q2_TimerPromoteState3_6FC83A80_113c,
  ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c,
  ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c,
  ACT1Q5_TimerPromoteState0D_6FC83210_113c,
  ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c,
  PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c,
  SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c,
} from './k2-w6b4-113c'
import {
  ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c,
  PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c,
  SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c,
  SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c,
  SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c,
} from './k2-w6b5-113c'
import {
  ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c,
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c,
} from './k2-w6b6-113c'
import { OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c } from './k2-w6b7-113c'
import { SKILLS_SetUsedSkill113c, UNITS_ChangeAnimMode113c } from './monster-events'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTER_SpawnAtCoords113c,
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_AllocUnitData113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel'
import { AI_StepRelativeToTargetUnit113c } from './town-npc-ai-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c
export type SparseMemory113c = Memory113c

let k2W7B2StackPtr = 0x7e300000

function allocScratch(sizeOrMem: number | Memory113c, maybeSize?: number): number {
  const size = typeof sizeOrMem === 'number' ? sizeOrMem : (maybeSize as number)
  const aligned = (size + 7) & ~7
  k2W7B2StackPtr = (k2W7B2StackPtr - aligned) >>> 0
  if (typeof sizeOrMem !== 'number') {
    sizeOrMem.fill(k2W7B2StackPtr, aligned, 0)
  }
  return k2W7B2StackPtr
}

function freeScratch(size: number): void {
  const aligned = (size + 7) & ~7
  k2W7B2StackPtr = (k2W7B2StackPtr + aligned) >>> 0
}

function readUnitPosXInline(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  const t = m.u32(u) | 0
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (t === 2 || (t > 3 && t <= 5)) {
    return m.u32((pPath + 0x0c) >>> 0) | 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function readUnitPosYInline(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  const t = m.u32(u) | 0
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (t === 2 || (t > 3 && t <= 5)) {
    return m.u32((pPath + 0x10) >>> 0) | 0
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

/**
 * [1/40] Destroys a player's town portal pair if their active portal is on Arreat Summit (level 120).
 * @dll D2Game.dll
 * @va 0x6FC7CFF0
 * @ordinalOrName ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0
 */
export function ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _uUnused = 0,
): number {
  hitD2GameVa113c(0x6FC7CFF0)
  void _uUnused
  const esi = pPlayer >>> 0
  const ebx = pGame >>> 0
  if (esi === 0) {
    throw new D2CommonAssertError('Act5Q4.cpp', 0x24c)
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, esi) >>> 0
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('Act5Q4.cpp', 0x24f)
  }
  const dwPortalGuid = m.u32((pPlayerData + 0x48) >>> 0) >>> 0
  if (ebx === 0) {
    throw new D2CommonAssertError('Act5Q4.cpp', 0x2d3)
  }
  const bucketIdx = dwPortalGuid & 0x7f
  let pObj = m.u32((ebx + (bucketIdx << 2) + 0x1520) >>> 0) >>> 0
  while (pObj !== 0) {
    if (m.u32((pObj + 0x0c) >>> 0) >>> 0 === dwPortalGuid) {
      const pRoom = UNITS_GetRoom113c(m, pObj) >>> 0
      const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
      if (nLevelId === 0x78) {
        PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c(m, esi, ebx)
      }
      return 0
    }
    pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
  }
  return 0
}

/**
 * [2/40] Spawns a portal to Nihlathak's Temple (level 121) near `pUnit` if Act 5 Quest 2 flag `+0x89` is set.
 * @dll D2Game.dll
 * @va 0x6FC7D1D0
 * @ordinalOrName ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0
 */
export function ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC7D1D0)
  const ebx = pUnit >>> 0
  const game = pGame >>> 0
  const pChain = m.u32((game + 0x10f4) >>> 0) >>> 0
  let pQuest = pChain !== 0 ? m.u32(pChain) >>> 0 : 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === 0x22) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  const pExt = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pExt + 0x89) >>> 0) === 0) return

  const pRoom0 = UNITS_GetRoom113c(m, ebx) >>> 0
  const nLevel0 = DUNGEON_GetLevelIdFromRoom113c(m, pRoom0) | 0
  if ((DRLG_GetActNoFromLevelId113c(m, nLevel0) & 0xff) !== 4) return

  const posY = readUnitPosYInline(m, ebx)
  const posX = readUnitPosXInline(m, ebx)
  const pRoom = UNITS_GetRoom113c(m, ebx) >>> 0
  if (pRoom === 0) {
    throw new D2CommonAssertError('Act5Q2.cpp', 0xe42)
  }
  const act79 = DRLG_GetActNoFromLevelId113c(m, 0x79) & 0xff
  const nSrcLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const actSrc = DRLG_GetActNoFromLevelId113c(m, nSrcLevel) & 0xff
  if (act79 !== actSrc) {
    throw new D2CommonAssertError('Act5Q2.cpp', 0xe5c)
  }
  const targetX = (posX + 10) | 0
  const targetY = (posY + 5) | 0
  const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, targetX, targetY) >>> 0
  if (pTargetRoom === 0) return

  const pPortal = SUNIT_AllocUnitData113c(
    m,
    2,
    0x3c,
    targetX,
    targetY,
    game,
    pTargetRoom,
    1,
    1,
    0,
  ) >>> 0
  UNITS_ChangeAnimMode113c(m, pPortal, 1)
  const pDestPortal = PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(
    m,
    game,
    pPortal,
    0x79,
    nSrcLevel,
  ) >>> 0
  if (pDestPortal === 0) return

  const portalFlags = UNITS_GetObjectPortalFlags113c(m, pDestPortal) & 0xff
  UNITS_SetObjectPortalFlags113c(m, pDestPortal, (portalFlags | 3) & 0xff)
  DUNGEON_ToggleHasPortalFlag113c(m, pTargetRoom, 0)
  DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pDestPortal) >>> 0, 0)
  m.setU8((pExt + 0x89) >>> 0, 0)
}

/**
 * [3/40] Spawns a portal to Nihlathak's Temple (level 121) for `pQuestData` if flag `+0x88` is clear.
 * @dll D2Game.dll
 * @va 0x6FC7D380
 * @ordinalOrName ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380
 */
export function ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC7D380)
  const esi = pUnit >>> 0
  const ebp = pQuestData >>> 0
  const pExt = m.u32((ebp + 0x18) >>> 0) >>> 0
  if (m.u8((pExt + 0x88) >>> 0) !== 0) {
    return 0
  }
  const posY = readUnitPosYInline(m, esi)
  const posX = readUnitPosXInline(m, esi)
  const pRoom = UNITS_GetRoom113c(m, esi) >>> 0
  const pGame = m.u32((ebp + 0x04) >>> 0) >>> 0
  if (pRoom === 0) {
    throw new D2CommonAssertError('Act5Q2.cpp', 0xe42)
  }
  const act79 = DRLG_GetActNoFromLevelId113c(m, 0x79) & 0xff
  const nSrcLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const actSrc = DRLG_GetActNoFromLevelId113c(m, nSrcLevel) & 0xff
  if (act79 !== actSrc) {
    throw new D2CommonAssertError('Act5Q2.cpp', 0xe5c)
  }
  const targetX = (posX + 10) | 0
  const targetY = (posY + 5) | 0
  const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, targetX, targetY) >>> 0
  if (pTargetRoom === 0) {
    return 0
  }
  const pPortal = SUNIT_AllocUnitData113c(
    m,
    2,
    0x3c,
    targetX,
    targetY,
    pGame,
    pTargetRoom,
    1,
    1,
    0,
  ) >>> 0
  UNITS_ChangeAnimMode113c(m, pPortal, 1)
  const pDestPortal = PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(
    m,
    pGame,
    pPortal,
    0x79,
    nSrcLevel,
  ) >>> 0
  if (pDestPortal === 0) {
    return 0
  }
  const portalFlags = UNITS_GetObjectPortalFlags113c(m, pDestPortal) & 0xff
  UNITS_SetObjectPortalFlags113c(m, pDestPortal, (portalFlags | 3) & 0xff)
  DUNGEON_ToggleHasPortalFlag113c(m, pTargetRoom, 0)
  DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pDestPortal) >>> 0, 0)
  m.setU8((pExt + 0x88) >>> 0, 1)
  m.setU8((pExt + 0x87) >>> 0, 0)
  return 1
}

/**
 * [4/40] Broadcasts Act 1 Quest 4 debug message and refreshes player quest state if quest is active.
 * @dll D2Game.dll
 * @va 0x6FC83570
 * @ordinalOrName ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570
 */
export function ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FC83570)
  const esi = pQuestData >>> 0
  if (m.u32(0x6fd31c20) !== 0) {
    NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, 0x6fd1beec, m.u32((esi + 0x04) >>> 0) >>> 0, 4)
  }
  if (m.u8((esi + 0x09) >>> 0) !== 0) {
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((esi + 0x04) >>> 0) >>> 0,
      ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
      0,
      0,
    )
  }
}

/**
 * [5/40] Broadcasts Act 1 Quest 4 debug chat notice if `gdwDebugQuestNotices` (`0x6FD31C20`) is enabled.
 * @dll D2Game.dll
 * @va 0x6FC835B0
 * @ordinalOrName ACT1Q4_BroadcastDebugQuestNotice_6FC835B0
 */
export function ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FC835B0)
  const questData = pQuestData >>> 0
  if (m.u32(0x6fd31c20) !== 0) {
    NET_BroadcastSystemChatMessage_6FCEBE70_113c(
      m,
      0x6fd1bf08,
      m.u32((questData + 0x04) >>> 0) >>> 0,
      4,
    )
  }
}

function formatQuestStateDebugString(m: D2KernMemory113c, pBuf: number, nState: number): void {
  // 0x6FD1CC2C in D2Game.dll .rdata: "changing state to %d\n\0"
  const text = `changing state to ${nState | 0}\n`
  for (let i = 0; i < text.length; i++) {
    m.setU8((pBuf + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((pBuf + text.length) >>> 0, 0)
}

function invokeQuestFilterF0(m: D2KernMemory113c, pQuest: number): number {
  const fnVa = m.u32((pQuest + 0xf0) >>> 0) >>> 0
  if (fnVa === 0x6fc83d20) {
    return ACT1Q3_ActivateQuestState1_6FC83D20_113c(m, pQuest)
  }
  if (fnVa === 0x6fc846d0) {
    return ACT1Q4_ActivateOrChainQuest_6FC846D0_113c(m, pQuest)
  }
  if (fnVa === 0x6fc84aa0) {
    return ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c(m, pQuest)
  }
  if (fnVa === 0x6fc84e10) {
    return ACT1Q2_ActivateOrChainQuest_6FC84E10_113c(m, pQuest)
  }
  if (m.u8((pQuest + 0x0c) >>> 0) === 0 && m.u8((pQuest + 0x09) >>> 0) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 1)
  }
  return 1
}

/**
 * [6/40] Sets quest 3 state 0, clears state 1, and clears quest 3 active flag `+0x0A` if bit 15 is unset.
 * @dll D2Game.dll
 * @va 0x6FC837E0
 * @ordinalOrName ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0
 */
export function ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC837E0)
  const edi = pGame >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((edi + 0x6d) >>> 0)
  const esi = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  QUESTRECORD_SetQuestState113c(m, esi, 3, 0)
  QUESTRECORD_ClearQuestState113c(m, esi, 3, 1)
  if ((DRLGWARP_TestRoomTileBit113c(m, esi, 3, 0x0f) | 0) !== 0) {
    return
  }
  const pChain = m.u32((edi + 0x10f4) >>> 0) >>> 0
  let pQuest = pChain !== 0 ? m.u32(pChain) >>> 0 : 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === 3) {
      m.setU8((pQuest + 0x0a) >>> 0, 0)
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, 0x6fd1bf50, edi, 4)
      }
      return
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  throw new D2CommonAssertError('Act1Q3.cpp', 0x160)
}

/**
 * [7/40] Sets quest 41 (`0x29`) state 0, clears state 1, and clears quest 30 (`0x1E`) flag `+0x0A` if bit 15 is unset.
 * @dll D2Game.dll
 * @va 0x6FC83BB0
 * @ordinalOrName ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0
 */
export function ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC83BB0)
  const edi = pGame >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((edi + 0x6d) >>> 0)
  const esi = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  QUESTRECORD_SetQuestState113c(m, esi, 0x29, 0)
  QUESTRECORD_ClearQuestState113c(m, esi, 0x29, 1)
  if ((DRLGWARP_TestRoomTileBit113c(m, esi, 0x29, 0x0f) | 0) !== 0) {
    return
  }
  const pChain = m.u32((edi + 0x10f4) >>> 0) >>> 0
  let pQuest = pChain !== 0 ? m.u32(pChain) >>> 0 : 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === 0x1e) {
      m.setU8((pQuest + 0x0a) >>> 0, 0)
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, 0x6fd1bfb4, edi, 4)
      }
      return
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  throw new D2CommonAssertError('Act1Q1.cpp', 0xe1)
}

/**
 * [8/40] Sets quest state byte `+0x0C` to 1 if 0 and broadcasts debug queststate notice.
 * @dll D2Game.dll
 * @va 0x6FC83D20
 * @ordinalOrName ACT1Q3_ActivateQuestState1_6FC83D20
 */
export function ACT1Q3_ActivateQuestState1_6FC83D20_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC83D20)
  const esi = pQuestData >>> 0
  if (m.u8((esi + 0x0c) >>> 0) === 0) {
    const pBuf = allocScratch(0x80)
    try {
      m.setU8((esi + 0x0c) >>> 0, 1)
      formatQuestStateDebugString(m, pBuf, 1)
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pBuf,
          m.u32((esi + 0x04) >>> 0) >>> 0,
          4,
        )
      }
    } finally {
      freeScratch(0x80)
    }
  }
  return 1
}

/**
 * [9/40] Activates Act 1 Quest 4 state 1 if active, or delegates to chained quest `pQuestData->nSeqId` (`+0x10`).
 * @dll D2Game.dll
 * @va 0x6FC846D0
 * @ordinalOrName ACT1Q4_ActivateOrChainQuest_6FC846D0
 */
export function ACT1Q4_ActivateOrChainQuest_6FC846D0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC846D0)
  const esi = pQuestData >>> 0
  const al = m.u8((esi + 0x0c) >>> 0)
  if (al === 0 && m.u8((esi + 0x09) >>> 0) === 1) {
    const pBuf = allocScratch(0x80)
    try {
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          0x6fd1bf08,
          m.u32((esi + 0x04) >>> 0) >>> 0,
          4,
        )
      }
      m.setU8((esi + 0x0c) >>> 0, 1)
      formatQuestStateDebugString(m, pBuf, 1)
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pBuf,
          m.u32((esi + 0x04) >>> 0) >>> 0,
          4,
        )
      }
    } finally {
      freeScratch(0x80)
    }
    return 1
  }
  if (al !== 6 && m.u8((esi + 0x09) >>> 0) !== 0) {
    return 1
  }
  const edi = QUESTS_GetQuestData_6FC53F30_113c(
    m,
    m.u32((esi + 0x04) >>> 0) >>> 0,
    m.u32((esi + 0x10) >>> 0) | 0,
  ) >>> 0
  if (edi === 0) {
    return 0
  }
  if (m.u32((esi + 0xf0) >>> 0) === 0) {
    throw new D2CommonAssertError('Act1Q4.cpp', 0x899)
  }
  return invokeQuestFilterF0(m, edi)
}

/**
 * [10/40] Randomizes Cairn Stones order if needed and sends 15-byte packet `0x50` (Scroll of Inifuss) to `pPlayer`.
 * @dll D2Game.dll
 * @va 0x6FC847B0
 * @ordinalOrName ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0
 */
export function ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FC847B0)
  const game = pGame >>> 0
  const edi = pPlayer >>> 0
  const pChain = m.u32((game + 0x10f4) >>> 0) >>> 0
  if (pChain === 0) return
  let pQuest = m.u32(pChain) >>> 0
  if (pQuest === 0) return
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === 4) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return

  const esi = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((esi + 0x4a) >>> 0) === 0) {
    m.setU8((esi + 0x4a) >>> 0, 1)
    ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c(m, pQuest)
  }
  let pClient = 0
  if (edi !== 0 && (m.u32(edi) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, edi) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  const pPkt = allocScratch(0x20)
  try {
    m.fill(pPkt, 0x20, 0)
    m.setU8(pPkt, 0x50)
    m.setU16((pPkt + 1) >>> 0, 4)
    for (let edx = 0; edx < 5; edx++) {
      const wStone = (m.u16((esi + edx * 2) >>> 0) - 0x11) & 0xffff
      m.setU16((pPkt + 3 + edx * 2) >>> 0, wStone)
      if (wStone >= 5) {
        throw new D2CommonAssertError('Act1Q4.cpp', 0x87f)
      }
    }
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x0f)
  } finally {
    freeScratch(0x20)
  }
}

/**
 * [11/40] Promotes Act 1 Quest 4 to state 3, resets object `0x1E` mode if `bFlag47 == 1`, and updates players.
 * @dll D2Game.dll
 * @va 0x6FC84940
 * @ordinalOrName ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940
 */
export function ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FC84940)
  const esi = pQuestData >>> 0
  const ebp = m.u32((esi + 0x18) >>> 0) >>> 0
  const bFlag47 = m.u8((ebp + 0x47) >>> 0)
  if (bFlag47 === 1) {
    const pGame = m.u32((esi + 0x04) >>> 0) >>> 0
    const dwObjGuid = m.u32((ebp + 0x30) >>> 0) >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('Act1Q4.cpp', 0x2d3)
    }
    const bucketIdx = dwObjGuid & 0x7f
    let pObj = m.u32((pGame + (bucketIdx << 2) + 0x1520) >>> 0) >>> 0
    while (pObj !== 0) {
      if (m.u32((pObj + 0x0c) >>> 0) >>> 0 === dwObjGuid) {
        if ((m.u32((pObj + 0x04) >>> 0) | 0) === 0x1e) {
          UNITS_ChangeAnimMode113c(m, pObj, 0)
        }
        break
      }
      pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
    }
  }
  m.setU8((esi + 0x14) >>> 0, 0)
  m.setU8((esi + 0x0b) >>> 0, 1)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((esi + 0x04) >>> 0) >>> 0,
    ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
    0,
    0,
  )
  const pBuf = allocScratch(0x80)
  try {
    m.setU8((esi + 0x0c) >>> 0, 3)
    formatQuestStateDebugString(m, pBuf, 3)
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        pBuf,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        4,
      )
    }
  } finally {
    freeScratch(0x80)
  }
  m.setU32((ebp + 0x58) >>> 0, 0)
  if (bFlag47 === 1) {
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((esi + 0x04) >>> 0) >>> 0,
      ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
      0,
      0,
    )
  }
}

/**
 * [12/40] Activates Act 1 Quest 3 state 1 if active, or delegates to chained quest `pQuestData->nSeqId` (`+0x10`).
 * @dll D2Game.dll
 * @va 0x6FC84AA0
 * @ordinalOrName ACT1Q3_ActivateOrChainQuest_6FC84AA0
 */
export function ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC84AA0)
  const esi = pQuestData >>> 0
  const al = m.u8((esi + 0x0c) >>> 0)
  if (al === 0 && m.u8((esi + 0x09) >>> 0) === 1) {
    const pBuf = allocScratch(0x80)
    try {
      m.setU8((esi + 0x0c) >>> 0, 1)
      formatQuestStateDebugString(m, pBuf, 1)
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pBuf,
          m.u32((esi + 0x04) >>> 0) >>> 0,
          4,
        )
      }
    } finally {
      freeScratch(0x80)
    }
    return 1
  }
  if (al !== 5 && m.u8((esi + 0x09) >>> 0) !== 0) {
    return 1
  }
  const edi = QUESTS_GetQuestData_6FC53F30_113c(
    m,
    m.u32((esi + 0x04) >>> 0) >>> 0,
    m.u32((esi + 0x10) >>> 0) | 0,
  ) >>> 0
  if (edi === 0) {
    return 0
  }
  if (m.u32((esi + 0xf0) >>> 0) === 0) {
    throw new D2CommonAssertError('Act1Q3.cpp', 0x362)
  }
  return invokeQuestFilterF0(m, edi)
}

/**
 * [13/40] Promotes Act 1 Quest 3 to state 3, sends alert `0x03`, and resets Malus stand object `0x6C` to mode 0.
 * @dll D2Game.dll
 * @va 0x6FC84C10
 * @ordinalOrName ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10
 */
export function ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC84C10)
  const esi = pQuestData >>> 0
  if (m.u8((esi + 0x09) >>> 0) === 0) {
    return 0
  }
  const ebp = m.u32((esi + 0x18) >>> 0) >>> 0
  const al = m.u8((ebp + 0x01) >>> 0)
  m.setU32((ebp + 0x98) >>> 0, 0)
  if (al === 0) {
    return 0
  }
  const pBuf = allocScratch(0x80)
  try {
    m.setU8((esi + 0x0c) >>> 0, 3)
    formatQuestStateDebugString(m, pBuf, 3)
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        pBuf,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        4,
      )
    }
  } finally {
    freeScratch(0x80)
  }
  m.setU8((esi + 0x14) >>> 0, 1)
  m.setU8((esi + 0x0b) >>> 0, 1)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((esi + 0x04) >>> 0) >>> 0,
    ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
    0,
    0,
  )
  const bState01 = m.u8((ebp + 0x01) >>> 0)
  m.setU8((ebp + 0x08) >>> 0, 0)
  if (bState01 === 1) {
    const pGame = m.u32((esi + 0x04) >>> 0) >>> 0
    const dwObjGuid = m.u32((ebp + 0x04) >>> 0) >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('Act1Q3.cpp', 0x2d3)
    }
    const bucketIdx = dwObjGuid & 0x7f
    let pObj = m.u32((pGame + (bucketIdx << 2) + 0x1520) >>> 0) >>> 0
    let matched = false
    while (pObj !== 0) {
      if (m.u32((pObj + 0x0c) >>> 0) >>> 0 === dwObjGuid) {
        if ((m.u32((pObj + 0x04) >>> 0) | 0) === 0x6c) {
          UNITS_ChangeAnimMode113c(m, pObj, 0)
          matched = true
        }
        break
      }
      pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
    }
    if (!matched) {
      m.setU8((ebp + 0x01) >>> 0, 0)
    }
  }
  return 1
}

/**
 * [14/40] Activates Act 1 Quest 2 state 1 if active, or delegates to chained quest `pQuestData->nSeqId` (`+0x10`).
 * @dll D2Game.dll
 * @va 0x6FC84E10
 * @ordinalOrName ACT1Q2_ActivateOrChainQuest_6FC84E10
 */
export function ACT1Q2_ActivateOrChainQuest_6FC84E10_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC84E10)
  const esi = pQuestData >>> 0
  const al = m.u8((esi + 0x0c) >>> 0)
  if (al === 0 && m.u8((esi + 0x09) >>> 0) === 1) {
    const pBuf = allocScratch(0x80)
    try {
      m.setU8((esi + 0x0c) >>> 0, 1)
      formatQuestStateDebugString(m, pBuf, 1)
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pBuf,
          m.u32((esi + 0x04) >>> 0) >>> 0,
          4,
        )
      }
    } finally {
      freeScratch(0x80)
    }
    return 1
  }
  if (al !== 5 && m.u8((esi + 0x09) >>> 0) !== 0) {
    return 1
  }
  const edi = QUESTS_GetQuestData_6FC53F30_113c(
    m,
    m.u32((esi + 0x04) >>> 0) >>> 0,
    m.u32((esi + 0x10) >>> 0) | 0,
  ) >>> 0
  if (edi === 0) {
    return 0
  }
  if (m.u32((esi + 0xf0) >>> 0) === 0) {
    throw new D2CommonAssertError('Act1Q2.cpp', 0x23b)
  }
  return invokeQuestFilterF0(m, edi)
}

/**
 * [15/40] Handles Blood Raven defeat callback for Act 1 Quest 2: completes party quest, schedules timer, sets global state `0x0D`.
 * @dll D2Game.dll
 * @va 0x6FC85620
 * @ordinalOrName ACT1Q2_OnBloodRavenKilled_6FC85620
 */
export function ACT1Q2_OnBloodRavenKilled_6FC85620_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC85620)
  const edi = pQuestData >>> 0
  const esi = pQuestArg >>> 0
  if (m.u8((edi + 0x09) >>> 0) === 0) {
    return
  }
  if (m.u32(0x6fd31c20) !== 0) {
    NET_BroadcastSystemChatMessage_6FCEBE70_113c(
      m,
      0x6fd1af1c,
      m.u32((edi + 0x04) >>> 0) >>> 0,
      4,
    )
  }
  const pBuf = allocScratch(0x80)
  try {
    m.setU8((edi + 0x0c) >>> 0, 4)
    formatQuestStateDebugString(m, pBuf, 4)
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        pBuf,
        m.u32((edi + 0x04) >>> 0) >>> 0,
        4,
      )
    }
  } finally {
    freeScratch(0x80)
  }
  const ebp = m.u32((edi + 0x18) >>> 0) >>> 0
  m.setU8((ebp + 0x01) >>> 0, 1)
  m.setU8((ebp + 0x02) >>> 0, 1)
  const pTarget = m.u32((esi + 0x08) >>> 0) >>> 0
  m.setU32((ebp + 0x08) >>> 0, pTarget !== 0 ? m.u32((pTarget + 0x0c) >>> 0) >>> 0 : 0xffffffff)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32(esi) >>> 0,
    ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c,
    0,
    m.u32((esi + 0x08) >>> 0) >>> 0,
  )
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32(esi) >>> 0,
    ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c,
    0,
    m.u32((esi + 0x08) >>> 0) >>> 0,
  )
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32(esi) >>> 0,
    ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c,
    0,
    m.u32((esi + 0x08) >>> 0) >>> 0,
  )
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32(esi) >>> 0,
    ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c,
    0,
    m.u32((esi + 0x08) >>> 0) >>> 0,
  )
  QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 0x0f, edi, 0x6fc83a80)
  m.setU32((edi + 0xa8) >>> 0, 0)
  m.setU8(ebp, 1)
  m.setU32((ebp + 0x04) >>> 0, 1)
  const pGame = m.u32(esi) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  const nQuestIdx = m.u32((edi + 0xe0) >>> 0) | 0
  if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
    throw new D2CommonAssertError('Act1Q2.cpp', 0x820)
  }
  QUESTRECORD_SetQuestState113c(m, m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0, nQuestIdx, 0x0d)
}

/**
 * [16/40] Spawns red portal from Catacombs Level 4 (`0x25`) back to Rogue Encampment (`1`).
 * @dll D2Game.dll
 * @va 0x6FC87320
 * @ordinalOrName ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320
 */
export function ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _uUnused = 0,
): number {
  hitD2GameVa113c(0x6FC87320)
  void _uUnused
  const game = pGame >>> 0
  const edi = pUnit >>> 0
  const esi = UNITS_GetRoom113c(m, edi) >>> 0
  if (esi === 0 || (DUNGEON_GetLevelIdFromRoom113c(m, esi) | 0) !== 0x25) {
    return 0
  }
  const pScratch = allocScratch(0x18)
  try {
    const pTargetPos = pScratch
    const pFreePos = (pScratch + 8) >>> 0
    PATH_GetTargetTypeAndPosition113c(m, edi, pTargetPos)
    const x = m.u32(pTargetPos) | 0
    const y = m.u32((pTargetPos + 4) >>> 0) | 0
    if (edi !== 0 && (DUNGEON_CheckRoomIsTownMemPort113c(m, esi) | 0) !== 0) {
      SUNIT_SetUnitEventSound113c(m, edi, 0x18, edi)
      return 1
    }
    const bl = DRLG_GetActNoFromLevelId113c(m, 1) & 0xff
    const srcLevel = DUNGEON_GetLevelIdFromRoom113c(m, esi) | 0
    const al = DRLG_GetActNoFromLevelId113c(m, srcLevel) & 0xff
    if (bl !== al) {
      throw new D2CommonAssertError('Act1Q6.cpp', 0xe5c)
    }
    m.setU32(pFreePos, x >>> 0)
    m.setU32((pFreePos + 4) >>> 0, y >>> 0)
    if (
      (COLLISION_FindFreePositionBasic113c(m, esi, pFreePos, pFreePos, 3, 0x3e01, 0x0c01, 0) | 0) !==
      0
    ) {
      const outX = m.u32(pFreePos) | 0
      const outY = m.u32((pFreePos + 4) >>> 0) | 0
      const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, esi, outX, outY) >>> 0
      if (pTargetRoom !== 0) {
        const pPortal = SUNIT_AllocUnitData113c(
          m,
          2,
          0x3b,
          outX,
          outY,
          game,
          pTargetRoom,
          1,
          1,
          0,
        ) >>> 0
        UNITS_ChangeAnimMode113c(m, pPortal, 1)
        const pDestPortal = PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(
          m,
          game,
          pPortal,
          1,
          srcLevel,
        ) >>> 0
        if (pDestPortal !== 0) {
          const flags = UNITS_GetObjectPortalFlags113c(m, pDestPortal) & 0xff
          UNITS_SetObjectPortalFlags113c(m, pDestPortal, (flags | 3) & 0xff)
          DUNGEON_ToggleHasPortalFlag113c(m, pTargetRoom, 0)
          DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pDestPortal) >>> 0, 0)
        }
      }
    }
    return 1
  } finally {
    freeScratch(0x18)
  }
}

/**
 * [17/40] Validates Secret Cow Level prerequisites in Rogue Encampment and spawns portal to Moo Moo Farm (`0x27`).
 * @dll D2Game.dll
 * @va 0x6FC874A0
 * @ordinalOrName ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0
 */
export function ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FC874A0)
  const ebp = pGame >>> 0
  const esi = pPlayer >>> 0
  const pQuestCtrl = m.u32((ebp + 0x10f4) >>> 0) >>> 0
  if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
    throw new D2CommonAssertError('Act1Q4.cpp', 0x82c)
  }
  const pGlobalQuests = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
  const failCowPortal = (): number => {
    if (esi === 0) {
      throw new D2CommonAssertError('Act1Q4.cpp', 0x558)
    }
    m.setU16((esi + 0x6e) >>> 0, 0x14)
    m.setU32((esi + 0x70) >>> 0, esi)
    UNITROOM_RefreshUnit113c(m, esi)
    m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) | 0x400) >>> 0)
    return 0
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, pGlobalQuests, 4, 0x0b) | 0) !== 0) {
    return failCowPortal()
  }
  const pPlayerData0 = UNITS_GetPlayerData113c(m, esi) >>> 0
  const nDiff0 = m.u8((ebp + 0x6d) >>> 0)
  const pQuestFlags0 = m.u32((pPlayerData0 + (nDiff0 << 2) + 0x10) >>> 0) >>> 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags0, 4, 0x0a) | 0) !== 0) {
    return failCowPortal()
  }
  if (m.u32((ebp + 0x70) >>> 0) === 0) {
    const pPD1 = UNITS_GetPlayerData113c(m, esi) >>> 0
    const pQF1 = m.u32((pPD1 + (m.u8((ebp + 0x6d) >>> 0) << 2) + 0x10) >>> 0) >>> 0
    if ((DRLGWARP_TestRoomTileBit113c(m, pQF1, 0x1a, 0) | 0) === 0) {
      if (m.u32((ebp + 0x70) >>> 0) === 0) {
        return failCowPortal()
      }
      const pPD2 = UNITS_GetPlayerData113c(m, esi) >>> 0
      const pQF2 = m.u32((pPD2 + (m.u8((ebp + 0x6d) >>> 0) << 2) + 0x10) >>> 0) >>> 0
      if ((DRLGWARP_TestRoomTileBit113c(m, pQF2, 0x28, 0) | 0) === 0) {
        return failCowPortal()
      }
    }
  } else {
    const pPD2 = UNITS_GetPlayerData113c(m, esi) >>> 0
    const pQF2 = m.u32((pPD2 + (m.u8((ebp + 0x6d) >>> 0) << 2) + 0x10) >>> 0) >>> 0
    if ((DRLGWARP_TestRoomTileBit113c(m, pQF2, 0x28, 0) | 0) === 0) {
      return failCowPortal()
    }
  }
  const pRoom0 = UNITS_GetRoom113c(m, esi) >>> 0
  if (pRoom0 === 0 || (DUNGEON_GetLevelIdFromRoom113c(m, pRoom0) | 0) !== 1) {
    return failCowPortal()
  }
  const pScratch = allocScratch(0x20)
  try {
    const pIoCoords = pScratch
    const ppOutRoom = (pScratch + 8) >>> 0
    const pFreePos = (pScratch + 16) >>> 0
    m.setU32(ppOutRoom, 0)
    PATH_GetTargetTypeAndPosition113c(m, esi, pIoCoords)
    QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(m, pRoom0, pIoCoords, 3, 0x400, ppOutRoom, 0x64)
    const edi = m.u32(ppOutRoom) >>> 0
    if (edi === 0) {
      return failCowPortal()
    }
    const coordX = m.u32(pIoCoords) >>> 0
    const coordY = m.u32((pIoCoords + 4) >>> 0) >>> 0
    if (esi !== 0) {
      DUNGEON_CheckRoomIsTownMemPort113c(m, edi)
    }
    const bl = DRLG_GetActNoFromLevelId113c(m, 0x27) & 0xff
    const srcLevel = DUNGEON_GetLevelIdFromRoom113c(m, edi) | 0
    const al = DRLG_GetActNoFromLevelId113c(m, srcLevel) & 0xff
    if (bl !== al) {
      throw new D2CommonAssertError('Act1Q4.cpp', 0xe5c)
    }
    m.setU32(pFreePos, coordX)
    m.setU32((pFreePos + 4) >>> 0, coordY)
    if (
      (COLLISION_FindFreePositionBasic113c(m, edi, pFreePos, pFreePos, 3, 0x3e01, 0x0c01, 0) | 0) ===
      0
    ) {
      return failCowPortal()
    }
    const outX = m.u32(pFreePos) | 0
    const outY = m.u32((pFreePos + 4) >>> 0) | 0
    const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, edi, outX, outY) >>> 0
    if (pTargetRoom === 0) {
      return failCowPortal()
    }
    const pPortal = SUNIT_AllocUnitData113c(
      m,
      2,
      0x3c,
      outX,
      outY,
      ebp,
      pTargetRoom,
      1,
      1,
      0,
    ) >>> 0
    UNITS_ChangeAnimMode113c(m, pPortal, 1)
    const pDestPortal = PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(
      m,
      ebp,
      pPortal,
      0x27,
      srcLevel,
    ) >>> 0
    if (pDestPortal === 0) {
      return failCowPortal()
    }
    const flags = UNITS_GetObjectPortalFlags113c(m, pDestPortal) & 0xff
    UNITS_SetObjectPortalFlags113c(m, pDestPortal, (flags | 3) & 0xff)
    DUNGEON_ToggleHasPortalFlag113c(m, pTargetRoom, 0)
    DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pDestPortal) >>> 0, 0)
    QUESTS_SetGlobalQuestState_6FC53920_113c(m, ebp, 4, 0x0b)
    return 1
  } finally {
    freeScratch(0x20)
  }
}

/**
 * [18/40] Operates Cain's Gibbet cage in Tristram: spawns Deckard Cain (`0x92`) or fallback portal and completes quest 4.
 * @dll D2Game.dll
 * @va 0x6FC87730
 * @ordinalOrName ACT1Q4_OnCainGibbetOperated_6FC87730
 */
export function ACT1Q4_OnCainGibbetOperated_6FC87730_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObjectUnit: number,
): void {
  hitD2GameVa113c(0x6FC87730)
  const game = pGame >>> 0
  const ebx = pObjectUnit >>> 0
  const pChain = m.u32((game + 0x10f4) >>> 0) >>> 0
  let pQuest = pChain !== 0 ? m.u32(pChain) >>> 0 : 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === 4) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) {
    throw new D2CommonAssertError('Act1Q4.cpp', 0x68e)
  }
  const pExt = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuest + 0x09) >>> 0) === 0 || m.u8((pExt + 0x50) >>> 0) === 1) {
    return
  }
  m.setU32((pExt + 0x54) >>> 0, 3)
  UNITS_ChangeAnimMode113c(m, ebx, 3)
  let esi = (UNIT_GetPosX113c(m, ebx) + 3) | 0
  let ebp = (UNIT_GetPosY113c(m, ebx) + 3) | 0
  const pRoom = UNITS_GetRoom113c(m, ebx) >>> 0
  let pCain = MONSTER_SpawnAtCoords113c(m, 0x92, 1, game, pRoom, esi, ebp, -1, 0) >>> 0
  const pScratch = allocScratch(0x20)
  try {
    if (pCain === 0) {
      const pIoCoords = pScratch
      const ppOutRoom = (pScratch + 8) >>> 0
      m.setU32(pIoCoords, esi >>> 0)
      m.setU32((pIoCoords + 4) >>> 0, ebp >>> 0)
      m.setU32(ppOutRoom, pRoom)
      QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(m, pRoom, pIoCoords, 2, 0x100, ppOutRoom, 0x64)
      const pOutRoom = m.u32(ppOutRoom) >>> 0
      if (pOutRoom !== 0) {
        pCain =
          MONSTER_SpawnAtCoords113c(
            m,
            0x92,
            1,
            game,
            pOutRoom,
            m.u32(pIoCoords) | 0,
            m.u32((pIoCoords + 4) >>> 0) | 0,
            -1,
            0,
          ) >>> 0
      }
    }
    if (pCain !== 0) {
      m.setU32((pCain + 0xc4) >>> 0, (m.u32((pCain + 0xc4) >>> 0) | 0x03000000) >>> 0)
      const dwPlayerGuid = m.u32((pExt + 0x3c) >>> 0) >>> 0
      const bucketIdx = dwPlayerGuid & 0x7f
      let pPlayer = m.u32((game + (bucketIdx << 2) + 0x1120) >>> 0) >>> 0
      while (pPlayer !== 0) {
        if (m.u32((pPlayer + 0x0c) >>> 0) >>> 0 === dwPlayerGuid) {
          SUNIT_SetUnitEventSound113c(m, pPlayer, 0x30, 0)
          break
        }
        pPlayer = m.u32((pPlayer + 0xe4) >>> 0) >>> 0
      }
    } else {
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, 0x6fd1beac, game, 4)
      }
      m.setU32((pExt + 0x74) >>> 0, 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        game,
        ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c,
        0,
        ebx,
      )
      const pPortalUnit = m.u32((pExt + 0x74) >>> 0) >>> 0
      if (pPortalUnit !== 0 && m.u8((pExt + 0x66) >>> 0) === 0) {
        if (pRoom === 0) {
          throw new D2CommonAssertError('Act1Q4.cpp', 0xe42)
        }
        if ((DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) | 0) !== 0) {
          SUNIT_SetUnitEventSound113c(m, pPortalUnit, 0x18, pPortalUnit)
        } else {
          const bl = DRLG_GetActNoFromLevelId113c(m, 1) & 0xff
          const srcLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
          const al = DRLG_GetActNoFromLevelId113c(m, srcLevel) & 0xff
          if (bl !== al) {
            throw new D2CommonAssertError('Act1Q4.cpp', 0xe5c)
          }
          esi = (esi + 3) | 0
          ebp = (ebp + 3) | 0
          const pFreePos = (pScratch + 16) >>> 0
          m.setU32(pFreePos, esi >>> 0)
          m.setU32((pFreePos + 4) >>> 0, ebp >>> 0)
          if (
            (COLLISION_FindFreePositionBasic113c(
              m,
              pRoom,
              pFreePos,
              pFreePos,
              3,
              0x3e01,
              0x0c01,
              0,
            ) |
              0) !==
            0
          ) {
            const outX = m.u32(pFreePos) | 0
            const outY = m.u32((pFreePos + 4) >>> 0) | 0
            const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, outX, outY) >>> 0
            if (pTargetRoom !== 0) {
              const pNewPortal = SUNIT_AllocUnitData113c(
                m,
                2,
                0x3b,
                outX,
                outY,
                game,
                pTargetRoom,
                1,
                1,
                0,
              ) >>> 0
              UNITS_ChangeAnimMode113c(m, pNewPortal, 1)
              const pDestPortal = PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(
                m,
                game,
                pNewPortal,
                1,
                srcLevel,
              ) >>> 0
              if (pDestPortal !== 0) {
                const flags = UNITS_GetObjectPortalFlags113c(m, pDestPortal) & 0xff
                UNITS_SetObjectPortalFlags113c(m, pDestPortal, (flags | 3) & 0xff)
                DUNGEON_ToggleHasPortalFlag113c(m, pTargetRoom, 0)
                DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pDestPortal) >>> 0, 0)
                m.setU8((pExt + 0x66) >>> 0, 1)
              }
            }
          }
        }
      }
      if (m.u8((pExt + 0x51) >>> 0) === 0) {
        m.setU8((pExt + 0x52) >>> 0, 1)
      }
      m.setU8((pExt + 0x62) >>> 0, 1)
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      game,
      ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c,
      0,
      ebx,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      game,
      ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c,
      0,
      ebx,
    )
    m.setU8((pQuest + 0x14) >>> 0, 0)
    m.setU8((pQuest + 0x0b) >>> 0, 6)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0) >>> 0,
      ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
      0,
      0,
    )
  } finally {
    freeScratch(0x20)
  }
}

/**
 * [19/40] Spawns the Cairn Stones portal to Tristram (`0x26`) near the Cairn Stone object stored at `pExt+0x40`.
 * @dll D2Game.dll
 * @va 0x6FC87A90
 * @ordinalOrName ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90
 */
export function ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FC87A90)
  const game = pGame >>> 0
  const pExt = m.u32(((pQuestData >>> 0) + 0x18) >>> 0) >>> 0
  const dwObjGuid = m.u32((pExt + 0x40) >>> 0) >>> 0
  if (game === 0) {
    throw new D2CommonAssertError('Act1Q4.cpp', 0x2d3)
  }
  const bucketIdx = dwObjGuid & 0x7f
  let pObj = m.u32((game + (bucketIdx << 2) + 0x1520) >>> 0) >>> 0
  while (pObj !== 0) {
    if (m.u32((pObj + 0x0c) >>> 0) >>> 0 === dwObjGuid) break
    pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
  }
  if (pObj === 0) {
    m.setU8((pExt + 0x44) >>> 0, 0)
    return 1
  }
  const posY = readUnitPosYInline(m, pObj)
  const posX = readUnitPosXInline(m, pObj)
  const pRoom = UNITS_GetRoom113c(m, pObj) >>> 0
  if (pRoom === 0) {
    throw new D2CommonAssertError('Act1Q4.cpp', 0xe42)
  }
  const bl = DRLG_GetActNoFromLevelId113c(m, 0x26) & 0xff
  const srcLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const al = DRLG_GetActNoFromLevelId113c(m, srcLevel) & 0xff
  if (bl !== al) {
    throw new D2CommonAssertError('Act1Q4.cpp', 0xe5c)
  }
  const targetX = (posX + 4) | 0
  const targetY = (posY + 4) | 0
  const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, targetX, targetY) >>> 0
  if (pTargetRoom === 0) {
    return 0
  }
  const pPortal = SUNIT_AllocUnitData113c(
    m,
    2,
    0x3c,
    targetX,
    targetY,
    game,
    pTargetRoom,
    1,
    1,
    0,
  ) >>> 0
  UNITS_ChangeAnimMode113c(m, pPortal, 1)
  const pDestPortal = PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(
    m,
    game,
    pPortal,
    0x26,
    srcLevel,
  ) >>> 0
  if (pDestPortal === 0) {
    return 0
  }
  const flags = UNITS_GetObjectPortalFlags113c(m, pDestPortal) & 0xff
  UNITS_SetObjectPortalFlags113c(m, pDestPortal, (flags | 3) & 0xff)
  DUNGEON_ToggleHasPortalFlag113c(m, pTargetRoom, 0)
  DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pDestPortal) >>> 0, 0)
  m.setU8((pExt + 0x45) >>> 0, 1)
  m.setU8((pExt + 0x44) >>> 0, 0)
  return 1
}

/**
 * [20/40] Updates Cain's Gibbet (`0x1A`) and companion object modes, optionally schedules timer `0x6FC88250` or removes Cain monster (`0x92`).
 * @dll D2Game.dll
 * @va 0x6FC88280
 * @ordinalOrName ACT1Q4_UpdateGibbetModeAndCainState_6FC88280
 */
export function ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  bScheduleTimer: number,
  bDeleteCainMonster: number,
): void {
  hitD2GameVa113c(0x6FC88280)
  const ebp = pQuestData >>> 0
  const esi = m.u32((ebp + 0x18) >>> 0) >>> 0
  let skipSet54 = false
  if (m.u8((esi + 0x48) >>> 0) === 1) {
    const pGame = m.u32((ebp + 0x04) >>> 0) >>> 0
    const dwObjGuid = m.u32((esi + 0x34) >>> 0) >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('Act1Q4.cpp', 0x2d3)
    }
    const bucketIdx = dwObjGuid & 0x7f
    let pObj = m.u32((pGame + (bucketIdx << 2) + 0x1520) >>> 0) >>> 0
    while (pObj !== 0) {
      if (m.u32((pObj + 0x0c) >>> 0) >>> 0 === dwObjGuid) {
        if ((m.u32((pObj + 0x04) >>> 0) | 0) === 0x1a) {
          if ((m.u32((pObj + 0x10) >>> 0) | 0) === 3) {
            skipSet54 = true
          } else {
            UNITS_ChangeAnimMode113c(m, pObj, 3)
          }
        }
        break
      }
      pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
    }
  }
  if (!skipSet54) {
    m.setU32((esi + 0x54) >>> 0, 3)
  }
  if (m.u8((esi + 0x47) >>> 0) === 1) {
    const pGame = m.u32((ebp + 0x04) >>> 0) >>> 0
    const dwObjGuid = m.u32((esi + 0x30) >>> 0) >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('Act1Q4.cpp', 0x2d3)
    }
    const bucketIdx = dwObjGuid & 0x7f
    let pObj = m.u32((pGame + (bucketIdx << 2) + 0x1520) >>> 0) >>> 0
    while (pObj !== 0) {
      if (m.u32((pObj + 0x0c) >>> 0) >>> 0 === dwObjGuid) {
        UNITS_ChangeAnimMode113c(m, pObj, 1)
        break
      }
      pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
    }
  }
  if ((bScheduleTimer & 0xff) !== 0) {
    if (m.u8((esi + 0x46) >>> 0) === 0) {
      m.setU8((esi + 0x46) >>> 0, 1)
      QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 1, ebp, 0x6fc88250)
    }
  } else if ((bDeleteCainMonster & 0xff) !== 0) {
    // 0x6FC8836A: push 0 (pArg), mov eax, 1 (dwUnitType = UNIT_MONSTER)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((ebp + 0x04) >>> 0) >>> 0,
      ACT1Q4_OnCainModeOrInteract_6FC88150_113c,
      1,
      0,
    )
  }
  if ((bDeleteCainMonster & 0xff) !== 0) {
    if (m.u8((esi + 0x61) >>> 0) === 0) {
      MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c(
        m,
        m.u32((ebp + 0x04) >>> 0) >>> 0,
        0,
        0x92,
      )
    }
    if (m.u8((esi + 0x51) >>> 0) === 0) {
      m.setU8((esi + 0x52) >>> 0, 1)
    }
  }
  m.setU8((esi + 0x50) >>> 0, 1)
}
/**
 * @dll D2Game.dll
 * @va 0x6FC88AB0
 * @ordinalOrName ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0
 *
 * Records the entering player's GUID into the Act 1 Quest 5 (Tools of the Trade)
 * room-visitor list (up to 8 entries at +0x68, count at +0x88), triggers the
 * portal/cairn-stone lightning helper, and schedules event 7 (+10 frames) if
 * byte +0x118 is set and byte +0x119 is clear.
 */
export function ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c(
  m: SparseMemory113c,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC88AB0)
  const edi = pQuestArg >>> 0;
  const pGame = m.u32(edi) >>> 0;
  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0;
  let ecx = 0;
  if (pQuestChain !== 0) {
    // 0x6FC88ACC: mov edi, dword ptr [eax] (head of pQuestData list at +0x00)
    let curr = m.u32(pQuestChain) >>> 0;
    while (curr !== 0) {
      if ((m.u32(curr) | 0) === 5) {
        ecx = curr;
        break;
      }
      curr = m.u32((curr + 0xf4) >>> 0) >>> 0;
    }
  }
  if (ecx === 0) {
    return;
  }

  const ebp = m.u32((edi + 4) >>> 0) >>> 0;
  const esi = m.u32((ecx + 0x18) >>> 0) >>> 0;
  const dwGuid = ebp !== 0 ? m.u32((ebp + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  const wCount = m.u16((esi + 0x88) >>> 0);
  if (wCount > 0) {
    for (let i = 0; i < wCount; i = (i + 1) | 0) {
      if ((m.u32((esi + 0x68 + ((i << 2) >>> 0)) >>> 0) >>> 0) === dwGuid) {
        return;
      }
    }
  }
  if (wCount < 8) {
    m.setU32((esi + 0x68 + ((wCount << 2) >>> 0)) >>> 0, dwGuid);
    m.setU16((esi + 0x88) >>> 0, (wCount + 1) & 0xffff);
  }

  ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c(m, ecx, esi);
  if (m.u8((esi + 0x118) >>> 0) !== 0 && m.u8((esi + 0x119) >>> 0) === 0) {
    const pQuestGame = m.u32((ecx + 4) >>> 0) >>> 0;
    const nExpireFrame = (m.u32((pQuestGame + 0xa8) >>> 0) + 0x0a) >>> 0;
    EVENT_SetEventFull113c(m, pQuestGame, ebp, 7, nExpireFrame, 0, 0, 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC88B90
 * @ordinalOrName ACT1Q5_OnAndarielKilled_6FC88B90
 *
 * Handles the Act 1 Quest 6 (Sisters to the Slaughter / Andariel) boss kill callback:
 * stores the death coordinates at +0x110 of quest-ext, advances quest state to 5,
 * marks global quest flag 0x0D, awards completion to players in Catacombs Level 4,
 * propagates completion to party members, registers quest timer 0x6FC83210, and
 * schedules portal lightning event 7 (+10 frames).
 */
export function ACT1Q5_OnAndarielKilled_6FC88B90_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC88B90)
  const esi = pQuestData >>> 0;
  const ebp = pQuestArg >>> 0;
  const edi = m.u32((esi + 0x18) >>> 0) >>> 0;
  const pTargetUnit = m.u32((ebp + 8) >>> 0) >>> 0;
  PATH_GetTargetTypeAndPosition113c(m, pTargetUnit, (edi + 0x110) >>> 0);

  if (m.u8((esi + 0x09) >>> 0) !== 0) {
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, 0x6fd1b2e0, m.u32((esi + 4) >>> 0) >>> 0, 4);
    }
    const pStrBuf = allocScratch(m, 0x98);
    try {
      m.setU32((esi + 0xa8) >>> 0, 0);
      m.setU8((esi + 0x0c) >>> 0, 5);
      formatQuestStateDebugString(m, pStrBuf, 5);
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, pStrBuf, m.u32((esi + 4) >>> 0) >>> 0, 4);
      }
    } finally {
      freeScratch(0x98);
    }

    m.setU8((edi + 0x11a) >>> 0, 1);
    ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c(m, esi);
    m.setU8((edi + 0x118) >>> 0, 1);
    const nQuestIdx = m.u32((esi + 0xe0) >>> 0) | 0;
    m.setU32((esi + 0xc0) >>> 0, 0);
    const pGame0 = m.u32(ebp) >>> 0;
    const pQuestCtrl = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0;
    if (m.u32((pQuestCtrl + 8) >>> 0) === 0) {
      throw new D2CommonAssertError('C:\\projects\\D2\\head\\Diablo2\\Source\\D2Game\\Quests\\Act1Q5.cpp', 0x820);
    }
    QUESTRECORD_SetQuestState113c(m, m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0, nQuestIdx, 0x0d);
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(ebp) >>> 0,
      ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c,
      0,
      m.u32((ebp + 8) >>> 0) >>> 0,
    );
    QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c(
      m,
      m.u32(ebp) >>> 0,
      (edi + 0x8c) >>> 0,
      m.u32((esi + 0xe0) >>> 0) | 0,
      0x25,
    );
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(ebp) >>> 0,
      ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c,
      0,
      m.u32((ebp + 8) >>> 0) >>> 0,
    );
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(ebp) >>> 0,
      ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c,
      0,
      m.u32((ebp + 8) >>> 0) >>> 0,
    );
    QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 7, esi, 0x6fc83210);
  }

  ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c(m, esi, edi);
  if (m.u8((edi + 0x119) >>> 0) === 0) {
    const pQuestGame = m.u32((esi + 4) >>> 0) >>> 0;
    const pEventUnit = m.u32((ebp + 8) >>> 0) >>> 0;
    const nExpireFrame = (m.u32((pQuestGame + 0xa8) >>> 0) + 0x0a) >>> 0;
    EVENT_SetEventFull113c(m, pQuestGame, pEventUnit, 7, nExpireFrame, 0, 0, 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC88D20
 * @ordinalOrName ACT1Q5_OnPortalLightningTimerEvent_6FC88D20
 *
 * Periodic timer event (type 7) callback for Act 1 Quest 6 / Cairn Stones:
 * invokes `0x6FC85E90` to spawn lightning/portal visuals and re-arms event 7
 * (+10 frames) while +0x118 is non-zero and +0x119 is zero.
 */
export function ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC88D20)
  const esi = pQuestData >>> 0;
  const pExt = m.u32((esi + 0x18) >>> 0) >>> 0;
  ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c(m, esi, pExt);
  const pExt2 = m.u32((esi + 0x18) >>> 0) >>> 0;
  if (m.u8((pExt2 + 0x118) >>> 0) !== 0 && m.u8((pExt2 + 0x119) >>> 0) === 0) {
    const pGame = m.u32((esi + 4) >>> 0) >>> 0;
    const nExpireFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x0a) >>> 0;
    EVENT_SetEventFull113c(m, pGame, pUnit >>> 0, 7, nExpireFrame, 0, 0, 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8AE60
 * @ordinalOrName OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60
 *
 * Iterates all living player units in the trap object's room and applies lightning
 * trap damage (`bUseLightning = 1`) via `0x6FD142D0` to each player within
 * `pObjectsTxt->dwTrapRange + 1` approximate distance.
 */
export function OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c(
  m: SparseMemory113c,
  pObjectUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC8AE60)
  const edi = pObjectUnit >>> 0;
  const ebp = pGame >>> 0;
  const pRoom = UNITS_GetRoom113c(m, edi) >>> 0;
  const nObjId = edi !== 0 ? (m.u32((edi + 4) >>> 0) | 0) : -1;
  const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjId) >>> 0;
  const pCoords = allocScratch(m, 8);
  try {
    PATH_GetTargetTypeAndPosition113c(m, edi, pCoords);
    const nMaxDist = ((m.u32((pObjectsTxt + 0x178) >>> 0) | 0) + 1) | 0;
    let esi = m.u32((pRoom + 0x74) >>> 0) >>> 0;
    while (esi !== 0) {
      if ((m.u32(esi) | 0) === 0 && (m.u32((esi + 0x10) >>> 0) | 0) !== 0x11) {
        const nDist = UNITS_GetApproximateDistance113c(m, edi, esi) | 0;
        if (nDist <= nMaxDist) {
          OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(m, ebp, edi, esi, 1);
        }
      }
      esi = m.u32((esi + 0xe8) >>> 0) >>> 0;
    }
  } finally {
    freeScratch(8);
  }
}

const CHIPPED_GEM_CODES_6FC8B430 = [
  0x20776367, // 'gcw '
  0x20726367, // 'gcr '
  0x20676367, // 'gcg '
  0x20626367, // 'gcb '
  0x20796367, // 'gcy '
  0x20766367, // 'gcv '
] as const;

/**
 * @dll D2Game.dll
 * @va 0x6FC8B430
 * @ordinalOrName OBJECTS_OperateGemShrine_6FC8B430
 *
 * Operates a Gem Shrine: scans the operating player's backpack for an upgradable
 * gem (item type `0x14` whose `Items.txt +0xBC` upgrade code is not `'non '`),
 * replacing the first matching gem with its upgraded item; or if none is found,
 * rolls a random chipped gem (`gcw`/`gcr`/`gcg`/`gcb`/`gcy`/`gcv`) using the
 * player's seed at `+0x20` and spawns it.
 */
export function OBJECTS_OperateGemShrine_6FC8B430_113c(
  m: SparseMemory113c,
  pOpStrc: number,
): void {
  hitD2GameVa113c(0x6FC8B430)
  const edi = pOpStrc >>> 0;
  const pPlayer = m.u32((edi + 8) >>> 0) >>> 0;
  const ebp = m.u32((pPlayer + 0x60) >>> 0) >>> 0;
  let esi = INVENTORY_FindBackpackItemByType113c(m, ebp, 0x14, 0) >>> 0;
  let ebx = 0;

  while (esi !== 0 && ebx === 0) {
    const nItemId = esi !== 0 ? (m.u32((esi + 4) >>> 0) | 0) : -1;
    const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0;
    const dwUpgradeCode = m.u32((pItemsTxt + 0xbc) >>> 0) >>> 0;
    if (dwUpgradeCode !== 0x206e6f6e) {
      const nUpgradeId = DATATBLS_GetItemIdFromItemCode113c(m, dwUpgradeCode) | 0;
      if (nUpgradeId === -1) {
        throw new D2CommonAssertError('C:\\projects\\D2\\head\\Diablo2\\Source\\D2Game\\Objects\\Objects.cpp', 0x823);
      }
      const pGame = m.u32(edi) >>> 0;
      const pUnit = m.u32((edi + 8) >>> 0) >>> 0;
      if ((ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c(m, pGame, pUnit, nUpgradeId, esi) | 0) !== 0) {
        ebx = 1;
        esi = 0;
      }
    }
    esi = INVENTORY_FindBackpackItemByType113c(m, ebp, 0x14, esi) >>> 0;
  }

  if (ebx === 0) {
    const pUnit = m.u32((edi + 8) >>> 0) >>> 0;
    const pSeed = (pUnit + 0x20) >>> 0;
    const lo = BigInt(m.u32(pSeed) >>> 0);
    const hi = BigInt(m.u32((pSeed + 4) >>> 0) >>> 0);
    const prod = lo * 0x6ac690c5n + hi;
    const newLo = Number(prod & 0xffffffffn) >>> 0;
    const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0;
    m.setU32(pSeed, newLo);
    m.setU32((pSeed + 4) >>> 0, newHi);
    const rem = (newLo % 6) >>> 0;
    const dwGemCode = CHIPPED_GEM_CODES_6FC8B430[rem]!;
    const nGemId = DATATBLS_GetItemIdFromItemCode113c(m, dwGemCode) | 0;
    if (nGemId === -1) {
      throw new D2CommonAssertError('C:\\projects\\D2\\head\\Diablo2\\Source\\D2Game\\Objects\\Objects.cpp', 0x84c);
    }
    ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c(
      m,
      m.u32(edi) >>> 0,
      m.u32((edi + 8) >>> 0) >>> 0,
      nGemId,
      0,
    );
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8B930
 * @ordinalOrName OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930
 *
 * Links an Act 5 red Hell portal (`pPortalUnit`) in Frigid Highlands (`0x6F`),
 * Arreat Plateau (`0x70`), or Frozen Tundra (`0x71`) to its corresponding
 * bonus sub-level (`0x7D` Abaddon, `0x7E` Pit of Acheron, `0x7F` Infernal Pit),
 * sets portal flags `|= 3` on the destination portal, and clears the room portal
 * toggle flag on both rooms.
 */
export function OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c(
  m: SparseMemory113c,
  pGame: number,
  pPortalUnit: number,
): void {
  hitD2GameVa113c(0x6FC8B930)
  const esi = pGame >>> 0;
  const edi = pPortalUnit >>> 0;
  const pSrcRoom = UNITS_GetRoom113c(m, edi) >>> 0;
  const nSrcLevel = DUNGEON_GetLevelIdFromRoom113c(m, pSrcRoom) | 0;
  const nDestLevel = nSrcLevel === 0x6f ? 0x7d : nSrcLevel === 0x70 ? 0x7e : 0x7f;
  const pDestPortal = PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(m, esi, edi, nDestLevel, nSrcLevel) >>> 0;
  if (pDestPortal !== 0) {
    const bFlags = UNITS_GetObjectPortalFlags113c(m, pDestPortal) & 0xff;
    UNITS_SetObjectPortalFlags113c(m, pDestPortal, (bFlags | 3) & 0xff);
  }
  const pSrcRoomAfter = UNITS_GetRoom113c(m, edi) >>> 0;
  DUNGEON_ToggleHasPortalFlag113c(m, pSrcRoomAfter, 0);
  const pDestRoomAfter = UNITS_GetRoom113c(m, pDestPortal) >>> 0;
  DUNGEON_ToggleHasPortalFlag113c(m, pDestRoomAfter, 0);
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8B9B0
 * @ordinalOrName OBJECTS_OperatePortalShrine_6FC8B9B0
 *
 * Operates a Portal Shrine: validates that the player's room is non-null and not
 * already in town (playing error sound `0x18` if in town), finds a free position
 * offset by `(+5, +5)` from the player, spawns a blue town portal object (`0x3B`),
 * links it to the current Act's town level via `0x6FCC22E0`, sets portal flags
 * `|= 3`, and updates both rooms' portal flags.
 */
export function OBJECTS_OperatePortalShrine_6FC8B9B0_113c(
  m: SparseMemory113c,
  pOpStrc: number,
): void {
  hitD2GameVa113c(0x6FC8B9B0)
  const edi = pOpStrc >>> 0;
  const pUnit0 = m.u32((edi + 8) >>> 0) >>> 0;
  const ebp = UNITS_GetRoom113c(m, pUnit0) >>> 0;
  const pScratch = allocScratch(m, 16);
  const pCoords = pScratch;
  const pBasicCoords = (pScratch + 8) >>> 0;
  try {
    PATH_GetTargetTypeAndPosition113c(m, pUnit0, pCoords);
    const nSrcLevel0 = DUNGEON_GetLevelIdFromRoom113c(m, ebp) | 0;
    const bAct = DRLG_GetActNoFromLevelId113c(m, nSrcLevel0) & 0xff;
    const nTownLevelId = DUNGEON_GetActLevelId113c(m, bAct) | 0;
    const pUnit1 = m.u32((edi + 8) >>> 0) >>> 0;
    const pRoom1 = UNITS_GetRoom113c(m, pUnit1) >>> 0;
    // 0x6FC8B9F6: in/out pCoords is passed directly to COLLISION_FindFreePositionSimple
    if ((COLLISION_FindFreePositionSimple113c(m, pRoom1, pCoords, 3, 0x1c09, 0) | 0) === 0) {
      return;
    }

    const ebx = m.u32((edi + 8) >>> 0) >>> 0;
    const esi = m.u32(edi) >>> 0;
    const coordX = (m.u32(pCoords) + 5) | 0;
    const coordY = (m.u32((pCoords + 4) >>> 0) + 5) | 0;
    if (ebp === 0) {
      throw new D2CommonAssertError('C:\\projects\\D2\\head\\Diablo2\\Source\\D2Game\\Objects\\Objects.cpp', 0xe42);
    }
    if (ebx !== 0 && (DUNGEON_CheckRoomIsTownMemPort113c(m, ebp) | 0) !== 0) {
      SUNIT_SetUnitEventSound113c(m, ebx, 0x18, ebx);
      return;
    }

    const bl = DRLG_GetActNoFromLevelId113c(m, nTownLevelId) & 0xff;
    const nSrcLevel = DUNGEON_GetLevelIdFromRoom113c(m, ebp) | 0;
    const al = DRLG_GetActNoFromLevelId113c(m, nSrcLevel) & 0xff;
    if (bl !== al) {
      throw new D2CommonAssertError(
        'C:\\projects\\D2\\head\\Diablo2\\Source\\D2Game\\Objects\\Objects.cpp',
        0xe5c,
      );
    }

    m.setU32(pBasicCoords, coordX >>> 0);
    m.setU32((pBasicCoords + 4) >>> 0, coordY >>> 0);
    if ((COLLISION_FindFreePositionBasic113c(m, ebp, pBasicCoords, pBasicCoords, 3, 0x3e01, 0x0c01, 0) | 0) === 0) {
      return;
    }

    const outX = m.u32(pBasicCoords) | 0;
    const outY = m.u32((pBasicCoords + 4) >>> 0) | 0;
    const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, ebp, outX, outY) >>> 0;
    if (pTargetRoom === 0) {
      return;
    }

    const pPortal = SUNIT_AllocUnitData113c(m, 2, 0x3b, outX, outY, esi, pTargetRoom, 1, 1, 0) >>> 0;
    UNITS_ChangeAnimMode113c(m, pPortal, 1);
    const pDestPortal = PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(m, esi, pPortal, nTownLevelId, nSrcLevel) >>> 0;
    if (pDestPortal === 0) {
      return;
    }

    const bFlags = UNITS_GetObjectPortalFlags113c(m, pDestPortal) & 0xff;
    UNITS_SetObjectPortalFlags113c(m, pDestPortal, (bFlags | 3) & 0xff);
    DUNGEON_ToggleHasPortalFlag113c(m, pTargetRoom, 0);
    const pDestRoom = UNITS_GetRoom113c(m, pDestPortal) >>> 0;
    DUNGEON_ToggleHasPortalFlag113c(m, pDestRoom, 0);
  } finally {
    freeScratch(16);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8E0E0
 * @ordinalOrName OBJECTS_OperateFireAndLightningTrap_6FC8E0E0
 *
 * Operates a dual fire-and-lightning object trap: if the trap is in mode 0,
 * applies both physical/fire (`0`) and lightning (`1`) trap damage to the
 * operating unit, switches the object to mode 1, and schedules event 1 at
 * `(pObjectsTxt->dwFrameCnt1 >> 8) + pGame->dwGameFrame + 1`.
 */
export function OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c(
  m: SparseMemory113c,
  pOpStrc: number,
): number {
  hitD2GameVa113c(0x6FC8E0E0)
  const esi = pOpStrc >>> 0;
  const pObj0 = m.u32((esi + 4) >>> 0) >>> 0;
  if (pObj0 !== 0 && (m.u32((pObj0 + 0x10) >>> 0) | 0) !== 0) {
    return 0;
  }

  OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(
    m,
    m.u32(esi) >>> 0,
    pObj0,
    m.u32((esi + 8) >>> 0) >>> 0,
    0,
  );
  OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(
    m,
    m.u32(esi) >>> 0,
    m.u32((esi + 4) >>> 0) >>> 0,
    m.u32((esi + 8) >>> 0) >>> 0,
    1,
  );
  UNITS_ChangeAnimMode113c(m, m.u32((esi + 4) >>> 0) >>> 0, 1);

  const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((esi + 0x10) >>> 0) | 0) >>> 0;
  const dwFrameCnt = m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8;
  const pGame = m.u32(esi) >>> 0;
  const nExpireFrame = (dwFrameCnt + m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0;
  EVENT_SetEventFull113c(m, pGame, m.u32((esi + 4) >>> 0) >>> 0, 1, nExpireFrame, 0, 0, 0);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8E270
 * @ordinalOrName OBJECTS_FloorSpikesEventTick_6FC8E270
 *
 * Periodic event (type 3) handler for Floor Spikes trap objects:
 * - State `0`: checks for living players at distance `<= 0`; if found, plays
 *   warning sound `0x0D`, transitions state to `1`, and arms next tick at `+25` frames.
 * - State `1`: deals trap damage (`0`) to players at distance `<= 0`, transitions
 *   state to `2` + anim mode `1` if any hit (or back to `0` if none), and arms next
 *   tick after `(dwFrameCnt1 >> 8) + 1` frames.
 * - State `2`: resets anim mode to `0` and state to `0`, arming next tick at `+15` frames.
 */
export function OBJECTS_FloorSpikesEventTick_6FC8E270_113c(
  m: SparseMemory113c,
  pGame: number,
  pObjectUnit: number,
): void {
  hitD2GameVa113c(0x6FC8E270)
  const ebp = pGame >>> 0;
  const esi = pObjectUnit >>> 0;
  const ebxMode = esi !== 0 ? (m.u32((esi + 0x10) >>> 0) | 0) : 0;
  const ediRoom = UNITS_GetRoom113c(m, esi) >>> 0;
  const pObjData0 = m.u32((esi + 0x14) >>> 0) >>> 0;
  const bState = m.u8((pObjData0 + 4) >>> 0);

  if (bState !== 0 && bState !== 1) {
    if (bState === 2 && ebxMode !== 0) {
      UNITS_ChangeAnimMode113c(m, esi, 0);
      const pObjDataReset = m.u32((esi + 0x14) >>> 0) >>> 0;
      m.setU8((pObjDataReset + 4) >>> 0, 0);
    }
    const nExpire = (m.u32((ebp + 0xa8) >>> 0) + 0x0f) >>> 0;
    EVENT_SetEventFull113c(m, ebp, esi, 3, nExpire, 0, 0, 0);
    return;
  }

  const bDealDamage = bState === 1 ? 1 : 0;
  const pCoords = allocScratch(m, 8);
  try {
    PATH_GetTargetTypeAndPosition113c(m, esi, pCoords);
    let bHitAny = 0;
    let bTriggeredSound = 0;
    let pUnit = m.u32((ediRoom + 0x74) >>> 0) >>> 0;
    while (pUnit !== 0) {
      if ((m.u32(pUnit) | 0) === 0 && (m.u32((pUnit + 0x10) >>> 0) | 0) !== 0x11) {
        if ((UNITS_GetApproximateDistance113c(m, esi, pUnit) | 0) <= 0) {
          if (bDealDamage !== 0) {
            OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c(m, ebp, esi, pUnit, 0);
            bHitAny = 1;
          } else {
            SUNIT_SetUnitEventSound113c(m, esi, 0x0d, 0);
            bTriggeredSound = 1;
          }
        }
      }
      pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0;
    }

    if (bTriggeredSound !== 0) {
      const pObjData1 = m.u32((esi + 0x14) >>> 0) >>> 0;
      m.setU8((pObjData1 + 4) >>> 0, 1);
      const nExpire = (m.u32((ebp + 0xa8) >>> 0) + 0x19) >>> 0;
      EVENT_SetEventFull113c(m, ebp, esi, 3, nExpire, 0, 0, 0);
      return;
    }

    if (bDealDamage !== 0) {
      const pObjData2 = m.u32((esi + 0x14) >>> 0) >>> 0;
      if (bHitAny === 1) {
        m.setU8((pObjData2 + 4) >>> 0, 2);
        UNITS_ChangeAnimMode113c(m, esi, 1);
      } else {
        m.setU8((pObjData2 + 4) >>> 0, 0);
      }
      const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((esi + 4) >>> 0) | 0) >>> 0;
      const dwFrameCnt = m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8;
      const nExpire = (dwFrameCnt + m.u32((ebp + 0xa8) >>> 0) + 1) >>> 0;
      EVENT_SetEventFull113c(m, ebp, esi, 3, nExpire, 0, 0, 0);
      return;
    }

    const nExpire = (m.u32((ebp + 0xa8) >>> 0) + 0x0f) >>> 0;
    EVENT_SetEventFull113c(m, ebp, esi, 3, nExpire, 0, 0, 0);
  } finally {
    freeScratch(8);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC91170
 * @ordinalOrName CUBE_CanPlayerPickupAllCubeItems_6FC91170
 *
 * Iterates all items in `pPlayer->pInventory` and verifies that every item on
 * inventory page `2` (Horadric Cube) passes `ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00`.
 * Returns `1` if all cube items are valid to hold, or `0` if any fails.
 */
export function CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c(
  m: SparseMemory113c,
  pReceiverPlayer: number,
  pGame: number,
  pSourcePlayer: number = pReceiverPlayer,
): number {
  hitD2GameVa113c(0x6FC91170)
  // 0x6FC91178..0x6FC9117A: edi = ecx (pReceiverPlayer), eax = pSourcePlayer (+0x60 inventory)
  const edi = pReceiverPlayer >>> 0;
  const srcPlayer = pSourcePlayer >>> 0;
  const ebp = pGame >>> 0;
  const pInv = m.u32((srcPlayer + 0x60) >>> 0) >>> 0;
  let esi = INVENTORY_GetFirstItem113c(m, pInv) >>> 0;
  while (esi !== 0) {
    const ebx = INVENTORY_UnitIsItem113c(m, esi) >>> 0;
    esi = INVENTORY_GetNextItem113c(m, esi) >>> 0;
    if ((ITEMS_GetInvPage113c(m, ebx) & 0xff) === 2) {
      if ((ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c(m, edi, ebp, ebx) | 0) === 0) {
        return 0;
      }
    }
  }
  return 1;
}

function stepSeed64At113c(m: SparseMemory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0;
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0;
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi);
  const newLo = Number(prod & 0xffffffffn) >>> 0;
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0;
  m.setU32((pSeed + 4) >>> 0, newHi);
  m.setU32(pSeed >>> 0, newLo);
  return newLo | 0;
}

function rollSeedPtr113c(m: SparseMemory113c, pSeed: number, nRange: number): number {
  if ((nRange | 0) <= 0) {
    return 0;
  }
  const lo = stepSeed64At113c(m, pSeed >>> 0) >>> 0;
  if (((nRange - 1) & nRange) === 0) {
    return (lo & (nRange - 1)) | 0;
  }
  // 0x6FC211AD: `div esi` (unsigned 32-bit remainder in [0, nRange - 1])
  return ((lo >>> 0) % (nRange >>> 0)) | 0;
}

function getSgptDataTablesPtr(m: SparseMemory113c): number {
  const pSlot = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0;
  return pSlot !== 0 ? m.u32(pSlot) >>> 0 : 0;
}

function aiApproachTarget6FD12540(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nMode: number,
  nX: number,
  nY: number,
  nStepNum: number,
  dwFlags: number,
): number {
  let mode = nMode | 0;
  if (mode === 0x0f && (STATES_CheckState113c(m, pUnit >>> 0, 0x3c) | 0) !== 0) {
    let pAiControl = 0;
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0;
      if (pMonData !== 0) {
        pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0;
      }
    }
    m.setU32((pAiControl + 0x18) >>> 0, 0);
    m.setU32((pAiControl + 0x1c) >>> 0, 0);
    m.setU8((pAiControl + 0x20) >>> 0, 0);
    mode = 2;
  }
  PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0), nStepNum | 0);
  // 0x6FD125A5 -> 0x6FC95070 (MONSTER_InitModeChangeStrc) clears pUsedSkill
  SKILLS_SetUsedSkill113c(m, pUnit >>> 0, 0);
  const sp = allocScratch(0x20);
  try {
    m.setU32(sp, mode >>> 0);
    m.setU32((sp + 0x04) >>> 0, pUnit >>> 0);
    m.setU32((sp + 0x08) >>> 0, 0);
    m.setU32((sp + 0x0c) >>> 0, 0);
    m.setU32((sp + 0x10) >>> 0, 0);
    m.setU32((sp + 0x14) >>> 0, 0);
    m.setU32((sp + 0x18) >>> 0, 0);
    m.setU32((sp + 0x1c) >>> 0, 0);
    if (pTarget !== 0) {
      m.setU32((sp + 0x08) >>> 0, pTarget >>> 0);
    } else {
      m.setU32((sp + 0x0c) >>> 0, nX >>> 0);
      m.setU32((sp + 0x10) >>> 0, nY >>> 0);
    }
    const res = MONSTER_StartMode113c(
      m,
      pGame >>> 0,
      m.u32((sp + 0x04) >>> 0) >>> 0,
      m.u32(sp) | 0,
      m.u32((sp + 0x08) >>> 0) >>> 0,
      m.u32((sp + 0x0c) >>> 0) | 0,
      m.u32((sp + 0x10) >>> 0) | 0,
    ) | 0;
    if (res !== 0) {
      return res;
    }
    const flagsByte = dwFlags & 0xff;
    if ((flagsByte & 4) !== 0) {
      let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0;
      while (pEvent !== 0) {
        const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0;
        if (m.u8(pEvent) === 2) {
          EVENT_FreeNode113c(m, pGame >>> 0, pEvent);
        }
        pEvent = pNext;
      }
    }
    if ((flagsByte & 1) !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0;
      if (pMonData !== 0) {
        const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0;
        if (pAiGeneral !== 0) {
          m.setU8((pAiGeneral + 8) >>> 0, (m.u8((pAiGeneral + 8) >>> 0) | 0x40) & 0xff);
        }
      }
    }
    if ((flagsByte & 2) !== 0) {
      const roll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100;
      if (roll < 0x46) {
        // 0x6FD12673: mov al, 4 (wander radius = 4)
        AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 4);
        return 1;
      }
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10);
      return 1;
    }
    return res;
  } finally {
    freeScratch(0x20);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC91270
 * @ordinalOrName STASH_ClearKillerInfoAndRecountScrolls_6FC91270
 *
 * Clears the player's active interaction/killer unit reference (`+0x64 = -1`, `+0x68 = 6`, `+0x6C = 0`)
 * and recounts inventory scrolls/tome charges via `ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570`.
 */
export function STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c(
  m: SparseMemory113c,
  pPlayer: number,
  _pGame = 0,
): void {
  hitD2GameVa113c(0x6FC91270)
  const eax = pPlayer >>> 0;
  m.setU32((eax + 0x64) >>> 0, 0xffffffff);
  m.setU32((eax + 0x68) >>> 0, 6);
  m.setU8((eax + 0x6c) >>> 0, 0);
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, eax);
}

/**
 * @dll D2Game.dll
 * @va 0x6FC91290
 * @ordinalOrName OBJECTS_OperateBankStash_6FC91290
 *
 * Operates the town Bank (`0x10B` = `267`), verifying both player and bank object are in a town room,
 * binding the bank object as the player's active interaction target (`SUNIT_SetLastKillerInfo_6FCFFAE0`),
 * sending button action packet `0x77` (`0x10`), and recounting inventory scrolls.
 */
export function OBJECTS_OperateBankStash_6FC91290_113c(
  m: SparseMemory113c,
  pOpStrc: number,
): number {
  hitD2GameVa113c(0x6FC91290)
  const esi = pOpStrc >>> 0;
  if ((m.u32((esi + 0x10) >>> 0) | 0) !== 0x10b) {
    return 0;
  }
  const ediPlayer = m.u32((esi + 8) >>> 0) >>> 0;
  const ebxObj = m.u32((esi + 4) >>> 0) >>> 0;
  const pPlayerRoom = UNITS_GetRoom113c(m, ediPlayer) >>> 0;
  if (pPlayerRoom === 0 || (DUNGEON_CheckRoomIsTownMemPort113c(m, pPlayerRoom) | 0) === 0) {
    return 0;
  }
  const pObjRoom = UNITS_GetRoom113c(m, ebxObj) >>> 0;
  if (pObjRoom === 0 || (DUNGEON_CheckRoomIsTownMemPort113c(m, pObjRoom) | 0) === 0) {
    return 0;
  }
  const dwObjGuid = ebxObj !== 0 ? m.u32((ebxObj + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c(m, ediPlayer, 2, dwObjGuid);
  const pPlayer2 = m.u32((esi + 8) >>> 0) >>> 0;
  const pClient =
    pPlayer2 !== 0 && (m.u32(pPlayer2) | 0) === 0
      ? m.u32(((UNITS_GetPlayerData113c(m, pPlayer2) >>> 0) + 0x9c) >>> 0) >>> 0
      : 0;
  NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0x10, pClient);
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, m.u32((esi + 8) >>> 0) >>> 0);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC917E0
 * @ordinalOrName STASH_HandleBankGoldOrCloseAction_6FC917E0
 *
 * Handles bank object (`0x10B`) actions `0x12` (close stash), `0x13` (withdraw gold), and `0x14` (deposit gold)
 * after verifying both the player and bank object are in town rooms.
 */
export function STASH_HandleBankGoldOrCloseAction_6FC917E0_113c(
  m: SparseMemory113c,
  pPlayer: number,
  pGame: number,
  nObjectGuid: number,
  wAction: number,
  nGoldAmount: number,
): void {
  hitD2GameVa113c(0x6FC917E0)
  const esi = pPlayer >>> 0;
  const ebx = pGame >>> 0;
  const ebp = nGoldAmount | 0;
  if (ebx === 0) {
    throw new D2CommonAssertError('Stash.cpp', 0x2d3);
  }
  let edi = m.u32((ebx + ((nObjectGuid & 0x7f) << 2) + 0x1520) >>> 0) >>> 0;
  while (edi !== 0 && (m.u32((edi + 0x0c) >>> 0) >>> 0) !== (nObjectGuid >>> 0)) {
    edi = m.u32((edi + 0xe4) >>> 0) >>> 0;
  }
  if (edi === 0 || (m.u32((edi + 4) >>> 0) | 0) !== 0x10b) {
    return;
  }
  const pPlayerRoom = UNITS_GetRoom113c(m, esi) >>> 0;
  if (pPlayerRoom === 0 || (DUNGEON_CheckRoomIsTownMemPort113c(m, pPlayerRoom) | 0) === 0) {
    return;
  }
  const pObjRoom = UNITS_GetRoom113c(m, edi) >>> 0;
  if (pObjRoom === 0 || (DUNGEON_CheckRoomIsTownMemPort113c(m, pObjRoom) | 0) === 0) {
    return;
  }
  const actionIdx = ((wAction & 0xffff) - 0x12) | 0;
  if (actionIdx === 0) {
    if (m.u8((esi + 0x6c) >>> 0) !== 0 && (m.u32((esi + 0x68) >>> 0) | 0) === 2) {
      m.setU32((esi + 0x64) >>> 0, 0xffffffff);
      m.setU32((esi + 0x68) >>> 0, 6);
      m.setU8((esi + 0x6c) >>> 0, 0);
    }
    ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, esi);
  } else if (actionIdx === 1) {
    if (ebp > 0) {
      const nBankGold = STATLIST_GetUnitStat113c(m, esi, 0x0f, 0) | 0;
      if (ebp <= nBankGold) {
        const nInvGold = STATLIST_GetUnitStat113c(m, esi, 0x0e, 0) | 0;
        const nMaxInvGold = STATLIST_GetUnitGoldBankLimit113c(m, esi) | 0;
        if (((nInvGold + ebp) | 0) <= nMaxInvGold) {
          ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c(m, esi, ebx, ebp);
          STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, esi, 0x0f, (-ebp) | 0);
        } else {
          SUNIT_SetUnitEventSound113c(m, esi, 0x13, esi);
        }
      }
    }
  } else if (actionIdx === 2) {
    if (ebp > 0) {
      const nInvGold = STATLIST_GetUnitStat113c(m, esi, 0x0e, 0) | 0;
      if (ebp <= nInvGold) {
        const nBankLimit = UNITS_GetStashGoldLimit113c(esi) >>> 0;
        const nBankGold = STATLIST_GetUnitStat113c(m, esi, 0x0f, 0) >>> 0;
        if (((nBankGold + (ebp >>> 0)) >>> 0) <= nBankLimit) {
          STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, esi, 0x0e, (-ebp) | 0);
          STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, esi, 0x0f, ebp);
        } else if (nBankGold < nBankLimit) {
          const delta = (nBankLimit - nBankGold) | 0;
          STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, esi, 0x0f, delta);
          STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, esi, 0x0e, (-delta) | 0);
        }
      }
    }
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC95A40
 * @ordinalOrName MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40
 *
 * For a monster whose `MonStats.txt->wBaseId` (`+0x02`) is `0x3F` (`63`), initializes a `'SEIS'` (`0x53454953`)
 * PRNG seed with `pMonsterUnit->dwUnitId` and fires `wAIP3[bDifficulty]` (`+0x62`) directional projectiles
 * (`SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0`) at random `(±5, ±5)` offsets around the target.
 */
export function MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c(
  m: SparseMemory113c,
  pMonsterUnit: number,
  pGame: number,
  nMissileId: number,
): void {
  hitD2GameVa113c(0x6FC95A40)
  const edi = pMonsterUnit >>> 0;
  if (edi === 0 || (m.u32(edi) | 0) !== 1) {
    return;
  }
  const pTables = getSgptDataTablesPtr(m);
  const nClassId = m.u32((edi + 4) >>> 0) | 0;
  if (nClassId < 0 || nClassId >= (m.u32((pTables + 0xa80) >>> 0) | 0)) {
    return;
  }
  const pMonStatsBase = m.u32((pTables + 0xa78) >>> 0) >>> 0;
  const pMonStats0 = (pMonStatsBase + imul32(nClassId, 0x1a8)) >>> 0;
  if (pMonStats0 === 0) {
    return;
  }
  const wBaseId = (m.u16((pMonStats0 + 2) >>> 0) << 16) >> 16;
  if (wBaseId < 0 || wBaseId >= (m.u32((pTables + 0xa80) >>> 0) | 0) || wBaseId !== 0x3f) {
    return;
  }
  const ebp = m.u32((edi + 0x2c) >>> 0) >>> 0;
  SUNIT_ValidatePathTargetUnit113c(m, edi, pGame >>> 0);
  const esiTarget = PATH_GetTargetUnit113c(m, m.u32((edi + 0x2c) >>> 0) >>> 0) >>> 0;
  let savedTarget = 0;
  let baseX = 0;
  let baseY = 0;
  if (esiTarget === edi || esiTarget === 0) {
    savedTarget = 0;
    baseX = PATH_GetFirstPointX113c(m, ebp) | 0;
    baseY = PATH_GetFirstPointY113c(m, ebp) | 0;
  } else {
    savedTarget = esiTarget;
    baseX = readUnitPosXInline(m, esiTarget);
    baseY = readUnitPosYInline(m, esiTarget);
  }
  PATH_SetTargetUnit113c(m, ebp, 0);
  let ebx = 5;
  let esi = 5;
  const pSeed = allocScratch(8);
  try {
    SEED_InitSeed113c(m, pSeed);
    SEED_InitLowSeed113c(m, pSeed, 0x53454953);
    m.setU32((pSeed + 4) >>> 0, m.u32((edi + 0x0c) >>> 0) >>> 0);
    const pTables2 = getSgptDataTablesPtr(m);
    const nClassId2 = m.u32((edi + 4) >>> 0) | 0;
    let pMonStats = 0;
    if (nClassId2 >= 0 && nClassId2 < (m.u32((pTables2 + 0xa80) >>> 0) | 0)) {
      pMonStats = (m.u32((pTables2 + 0xa78) >>> 0) + imul32(nClassId2, 0x1a8)) >>> 0;
    }
    const bDiff = m.u8(((pGame >>> 0) + 0x6d) >>> 0);
    const nCount = (m.u16((pMonStats + (bDiff << 1) + 0x62) >>> 0) << 16) >> 16;
    for (let i = 0; i < nCount; i = (i + 1) | 0) {
      if ((stepSeed64At113c(m, pSeed) & 1) !== 0) {
        ebx = (-ebx) | 0;
      }
      if ((stepSeed64At113c(m, pSeed) & 1) !== 0) {
        esi = (-esi) | 0;
      }
      PATH_SetTargetPos113c(m, ebp, (ebx + baseX) | 0, (esi + baseY) | 0);
      SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
        m,
        pGame >>> 0,
        nMissileId | 0,
        edi,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
      );
    }
    PATH_SetTargetUnit113c(m, ebp, savedTarget);
  } finally {
    freeScratch(8);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC9EA10
 * @ordinalOrName AI_Thinker_Izual_6FC9EA10
 *
 * Izual AI thinker (`aiFunctionTable[39]`): activates Act 4 Quest 1 on first tick (`ACT4Q1_OnPlainsOfDespairEntered_6FCDA080`),
 * processes stall/cooldown timers (`+0x18`, `+0x1C`), casts `Skill1` (`+0x170`) with `SkillMode1` (`+0x180`),
 * steps or approaches when out of melee range, and executes melee mode `4` (`MONMODE_ATTACK1`) in combat.
 */
export function AI_Thinker_Izual_6FC9EA10_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FC9EA10)
  const ebx = pGame >>> 0;
  const edxUnit = pUnit >>> 0;
  const args = pAiTickArgs >>> 0;
  const ebp = m.u32(args) >>> 0;
  const nDist = m.u32((args + 0x14) >>> 0) | 0;
  const bCombat = m.u32((args + 0x18) >>> 0) | 0;
  const pTarget = m.u32((args + 8) >>> 0) >>> 0;
  const edi = m.u32((args + 0x1c) >>> 0) >>> 0;
  const esi = (edxUnit + 0x20) >>> 0;
  const targetX = readUnitPosXInline(m, pTarget);
  const targetY = readUnitPosYInline(m, pTarget);
  if (m.u32((ebp + 0x14) >>> 0) === 0) {
    m.setU32((ebp + 0x14) >>> 0, 1);
    ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c(m, ebx);
  }
  const nStall = m.u32((ebp + 0x18) >>> 0) | 0;
  if (nStall !== 0) {
    AI_Stall113c(m, ebx, edxUnit, nStall);
    m.setU32((ebp + 0x18) >>> 0, 0);
    return;
  }
  const castHooks = {
    onMonsterStartMode: (_mem: SparseMemory113c, g: number, pModeArgs: number): number =>
      MONSTER_StartMode113c(
        m,
        g >>> 0,
        m.u32((pModeArgs + 4) >>> 0) >>> 0,
        m.u32(pModeArgs) | 0,
        m.u32((pModeArgs + 8) >>> 0) >>> 0,
        m.u32((pModeArgs + 12) >>> 0) | 0,
        m.u32((pModeArgs + 16) >>> 0) | 0,
      ) | 0,
  };
  if (bCombat === 0) {
    const wSkill1 = (m.u16((edi + 0x170) >>> 0) << 16) >> 16;
    if (wSkill1 >= 0 && nDist < 10) {
      if ((m.u32((ebp + 0x1c) >>> 0) | 0) > 0) {
        aiApproachTarget6FD12540(m, ebx, edxUnit, pTarget, 2, 0, 0, 1, 7);
        return;
      }
      const roll = rollSeedPtr113c(m, esi, 100);
      const bDiff0 = m.u8((ebx + 0x6d) >>> 0);
      const aip3 = (m.u16((edi + (bDiff0 << 1) + 0x62) >>> 0) << 16) >> 16;
      if (roll < aip3) {
        const wSkill = (m.u16((edi + 0x170) >>> 0) << 16) >> 16;
        const bMode = m.u8((edi + 0x180) >>> 0);
        AI_CastSkillWithMode113c(m, bMode, edxUnit, ebx, wSkill, pTarget, targetX, targetY, undefined, castHooks);
        const bDiff1 = m.u8((ebx + 0x6d) >>> 0);
        const aip5 = (m.u16((edi + (bDiff1 << 1) + 0x6e) >>> 0) << 16) >> 16;
        m.setU32((ebp + 0x18) >>> 0, aip5 >>> 0);
        const bDiff2 = m.u8((ebx + 0x6d) >>> 0);
        const aip6 = (m.u16((edi + (bDiff2 << 1) + 0x74) >>> 0) << 16) >> 16;
        m.setU32((ebp + 0x1c) >>> 0, aip6 >>> 0);
        return;
      }
    }
    if ((m.u32((ebp + 0x1c) >>> 0) | 0) <= 0) {
      const rem = ((stepSeed64At113c(m, esi) >>> 0) % 100) | 0;
      const bDiff = m.u8((ebx + 0x6d) >>> 0);
      const aip2 = (m.u16((edi + (bDiff << 1) + 0x5c) >>> 0) << 16) >> 16;
      if (rem >= aip2) {
        if (nDist > 10) {
          // 0x6FC9EBBB: push 9 (nTargetDist = 9)
          AI_StepRelativeToTargetUnit113c(m, ebx, edxUnit, pTarget, 6, 2, 9);
          return;
        }
        const nDelay = m.u8((edi + bDiff + 0x4f) >>> 0);
        AI_Stall113c(m, ebx, edxUnit, nDelay);
        return;
      }
    }
    aiApproachTarget6FD12540(m, ebx, edxUnit, pTarget, 2, 0, 0, 1, 7);
    return;
  }
  if ((m.u32((ebp + 0x1c) >>> 0) | 0) <= 0) {
    const rem = ((stepSeed64At113c(m, esi) >>> 0) % 100) | 0;
    const bDiff = m.u8((ebx + 0x6d) >>> 0);
    const aip1 = (m.u16((edi + (bDiff << 1) + 0x56) >>> 0) << 16) >> 16;
    if (rem >= aip1) {
      m.setU32((ebp + 0x1c) >>> 0, 0);
      if (((m.u16((edi + 0x170) >>> 0) << 16) >> 16) >= 0) {
        const roll = rollSeedPtr113c(m, esi, 100);
        const bDiff1 = m.u8((ebx + 0x6d) >>> 0);
        const aip4 = (m.u16((edi + (bDiff1 << 1) + 0x68) >>> 0) << 16) >> 16;
        if (roll < aip4) {
          const wSkill = (m.u16((edi + 0x170) >>> 0) << 16) >> 16;
          const bMode = m.u8((edi + 0x180) >>> 0);
          AI_CastSkillWithMode113c(m, bMode, edxUnit, ebx, wSkill, pTarget, targetX, targetY, undefined, castHooks);
          const bDiff2 = m.u8((ebx + 0x6d) >>> 0);
          const aip5 = (m.u16((edi + (bDiff2 << 1) + 0x6e) >>> 0) << 16) >> 16;
          m.setU32((ebp + 0x18) >>> 0, aip5 >>> 0);
          const bDiff3 = m.u8((ebx + 0x6d) >>> 0);
          const aip6 = (m.u16((edi + (bDiff3 << 1) + 0x74) >>> 0) << 16) >> 16;
          m.setU32((ebp + 0x1c) >>> 0, aip6 >>> 0);
          return;
        }
      }
      const bDiff4 = m.u8((ebx + 0x6d) >>> 0);
      const nDelay = m.u8((edi + bDiff4 + 0x4f) >>> 0);
      AI_Stall113c(m, ebx, edxUnit, nDelay);
      return;
    }
  }
  const v1c = m.u32((ebp + 0x1c) >>> 0) | 0;
  if (v1c > 0) {
    m.setU32((ebp + 0x1c) >>> 0, (v1c - 1) >>> 0);
  }
  SKILLS_SetUsedSkill113c(m, edxUnit, 0);
  let bModeParam = 0x64;
  if (edxUnit !== 0) {
    const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((edxUnit + 4) >>> 0) | 0) >>> 0;
    if (pMonStats2 !== 0) {
      const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0;
      const mask4 = pBitMasks !== 0 ? m.u32((pBitMasks + 0x10) >>> 0) : 0x10;
      if ((m.u8((pMonStats2 + 0x104) >>> 0) & mask4) !== 0) {
        bModeParam = 0x65;
      }
    }
  }
  void bModeParam;
  MONSTER_StartMode113c(m, ebx, edxUnit, 4, pTarget, 0, 0);
}

function div100MagicSignedK2(x: number): number {
  const hi = Number((BigInt(x | 0) * 0x51eb851fn) >> 32n) | 0
  const s5 = hi >> 5
  return (s5 + (s5 >>> 31)) | 0
}

function calcPctBonus100KickK2(val: number, pct: number): number {
  const v = val | 0
  const p = pct | 0
  if (v > 0x100000) {
    if (((v & -16) | 0) < 0x640) {
      return Number((BigInt(p) * BigInt(v)) / 100n) | 0
    }
    return imul32(div100MagicSignedK2(v), p)
  }
  if (p > 0x10000) {
    if (((p & -16) | 0) < 0x640) {
      return Number((BigInt(p) * BigInt(v)) / 100n) | 0
    }
    return imul32(div100MagicSignedK2(p), v)
  }
  return div100MagicSignedK2(imul32(p, v))
}

function stepSeed64AtKickK2(m: D2KernMemory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, newHi)
  m.setU32(pSeed >>> 0, newLo)
  return newLo
}

export function calcKickAndProgressiveFinishDamageFixed113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pGame: number,
  pDmg: number,
  pDefender: number,
  nSkillId: number,
  nSkillLevel: number,
): void {
  SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c(
    m,
    pAttacker,
    pGame,
    pDmg,
    pDefender,
    nSkillId,
    nSkillLevel,
  )
}

export function rollHitAndAllocKickProgressiveCombatFixed113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pSkillsTxt: number,
  nSkillLevel: number,
  bForceKnockbackFlags: number,
): number {
  void SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c
  hitD2GameVa113c(0x6FCB2BB0)
  const att = pAttacker >>> 0
  const def = pDefender >>> 0
  const game = pGame >>> 0
  const skillId = nSkillId | 0
  const slvl = nSkillLevel | 0
  const nToHit =
    ((SKILLS_GetSkillToHitBonus113c(m, att, skillId, slvl) | 0) +
      (STATLIST_GetUnitStat113c(m, att, 0x145, 0) | 0)) |
    0
  const pDmg = allocScratch(m, 0x70)
  try {
    for (let i = 0; i < 0x1c; i += 1) m.setU32((pDmg + i * 4) >>> 0, 0)
    let wFlags = SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, att, def, game, nToHit, 0) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wFlags)
    if ((wFlags & 1) !== 0) {
      if ((bForceKnockbackFlags | 0) !== 0) {
        wFlags = (wFlags | 0x0c) & 0xffff
        m.setU16((pDmg + 0x04) >>> 0, wFlags)
      }
      let pRow = 0
      if (skillId >= 0) {
        const pTables = getSgptDataTablesPtr(m)
        if (pTables !== 0 && skillId < (m.u32((pTables + 0xba0) >>> 0) | 0)) {
          const pBase = m.u32((pTables + 0xb98) >>> 0) >>> 0
          pRow = (pBase + imul32(skillId, 0x23c)) >>> 0
        }
      }
      let physPct = 0
      if (pRow !== 0 && slvl > 0) {
        physPct = ((m.u32((pRow + 0x148) >>> 0) | 0) + imul32((slvl - 1) | 0, (m.u32((pRow + 0x14c) >>> 0) | 0))) | 0
      }
      m.setU32((pDmg + 0x0c) >>> 0, physPct >>> 0)
      calcKickAndProgressiveFinishDamageFixed113c(m, att, game, pDmg, def, skillId, slvl)
    }
    let srcDam = m.u8(((pSkillsTxt >>> 0) + 0x1a5) >>> 0)
    m.setU32((pDmg + 0x60) >>> 0, 1)
    if (srcDam === 0) srcDam = 0x80
    return SUNITDMG_AllocCombat113c(m, game, att, def, pDmg, srcDam) >>> 0
  } finally {
    freeScratch(0x70)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB2DF0
 * @ordinalOrName SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0
 *
 * `srvdofunc = 75` (`Dragon Talon` initial kick): validates the melee target, evaluates `calc1` (`+0x138`) minus `1`
 * into `pSkill->dwParam1`, and invokes `SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0` (with knockback if `dwParam1 === 0`).
 */
export function SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB2DF0)
  const ebxGame = pGame >>> 0;
  const ebp = pUnit >>> 0;
  const esi = nSkillId | 0;
  const nLvl = nSkillLevel | 0;
  if (esi < 0) {
    return 0;
  }
  const pTables = getSgptDataTablesPtr(m);
  if (esi >= (m.u32((pTables + 0xba0) >>> 0) | 0)) {
    return 0;
  }
  const edi = (m.u32((pTables + 0xb98) >>> 0) + imul32(esi, 0x23c)) >>> 0;
  if (edi === 0) {
    return 0;
  }
  const pSkill = SKILLS_GetUsedSkill113c(m, ebp) >>> 0;
  if (pSkill === 0) {
    return 0;
  }
  SUNIT_ValidatePathTargetUnit113c(m, ebp, ebxGame);
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((ebp + 0x2c) >>> 0) >>> 0) >>> 0;
  if (pTarget === ebp || pTarget === 0) {
    SKILLS_SetParam1113c(m, pSkill, 0);
    return 0;
  }
  if ((UNITS_CanUnitMeleeAttackTarget113c(m, ebp, pTarget, 0) | 0) === 0) {
    return 0;
  }
  const nRemKicks = ((SKILLS_EvalCalcByOffset113c(m, ebp, m.u32((edi + 0x138) >>> 0), esi, nLvl) | 0) - 1) | 0;
  SKILLS_SetParam1113c(m, pSkill, nRemKicks);
  const bKnockback = nRemKicks === 0 ? 1 : 0;
  rollHitAndAllocKickProgressiveCombatFixed113c(
    m,
    esi,
    ebxGame,
    ebp,
    pTarget,
    edi,
    nLvl,
    bKnockback,
  );
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB4B10
 * @ordinalOrName SKILLS_SrvDo_CloakOfShadows_6FCB4B10
 *
 * `Cloak of Shadows` `srvdofunc`: creates the caster's self-buff aura stat list (`wAuraState` at `+0x80`),
 * populates passive stats (`+0x9A..+0xA0`, `+0xA8..+0xB4`) and skill stats (`0x15E`, `0x15F`), clears GFX state flag `1`,
 * and applies radial debuff stats + AI blind via `AURA_ForEachUnitInRadius113c` with callback `0x6FCB3850`.
 */
export function SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB4B10)
  const pGame0 = pGame >>> 0;
  const ebp = pUnit >>> 0;
  const edi = nSkillId | 0;
  const ebx = nSkillLevel | 0;
  if (edi < 0) {
    return 0;
  }
  const pTables = getSgptDataTablesPtr(m);
  if (edi >= (m.u32((pTables + 0xba0) >>> 0) | 0)) {
    return 0;
  }
  const esi = (m.u32((pTables + 0xb98) >>> 0) + imul32(edi, 0x23c)) >>> 0;
  if (esi === 0) {
    return 0;
  }
  const wAuraState = (m.u16((esi + 0x80) >>> 0) << 16) >> 16;
  if (wAuraState < 0 || wAuraState >= (m.u32((pTables + 0xc4) >>> 0) | 0)) {
    return 0;
  }
  if ((STATES_CheckState113c(m, ebp, wAuraState) | 0) !== 0) {
    return 0;
  }
  const nLen = SKILLS_EvalCalcByOffset113c(m, ebp, m.u32((esi + 0x60) >>> 0), edi, ebx) | 0;
  const nSelfVal = SKILLS_EvalCalcByOffset113c(m, ebp, m.u32((esi + 0xa4) >>> 0), edi, ebx) | 0;
  const wSelfStat = (m.u16((esi + 0x98) >>> 0) << 16) >> 16;
  const pScratch = allocScratch(0x6c);
  try {
    const pAuraArgs = pScratch;
    const pRadArgs = (pScratch + 0x2c) >>> 0;
    // 0x6FCB4BB9..0x6FCB4BFF: exact 9-dword D2CurseStateParamStrc layout (+0x00..+0x20)
    m.setU32(pAuraArgs, ebp);
    m.setU32((pAuraArgs + 0x04) >>> 0, ebp);
    m.setU32((pAuraArgs + 0x08) >>> 0, edi >>> 0);
    m.setU32((pAuraArgs + 0x0c) >>> 0, ebx >>> 0);
    m.setU32((pAuraArgs + 0x10) >>> 0, nLen >>> 0);
    m.setU32((pAuraArgs + 0x14) >>> 0, wSelfStat >>> 0);
    m.setU32((pAuraArgs + 0x18) >>> 0, nSelfVal >>> 0);
    m.setU32((pAuraArgs + 0x1c) >>> 0, wAuraState >>> 0);
    m.setU32((pAuraArgs + 0x20) >>> 0, 0x6fcbf7a0);
    const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, pAuraArgs) >>> 0;
    if (pStatList === 0) {
      return 0;
    }
    for (let i = 0; i < 4; i = (i + 1) | 0) {
      const wStat = (m.u16((esi + 0x9a + i * 2) >>> 0) << 16) >> 16;
      if (wStat >= 0) {
        const val = SKILLS_EvalCalcByOffset113c(m, ebp, m.u32((esi + 0xa8 + i * 4) >>> 0), edi, ebx) | 0;
        if (val !== 0) {
          STATLIST_SetStat113c(m, pStatList, wStat, val, 0);
        }
      }
    }
    STATLIST_SetStat113c(m, pStatList, 0x15e, edi, 0);
    STATLIST_SetStat113c(m, pStatList, 0x15f, ebx, 0);
    STATES_ClearGfxStateFlag113c(m, ebp, wAuraState, 1);
    const wTargetState = (m.u16((esi + 0x82) >>> 0) << 16) >> 16;
    const pTables2 = getSgptDataTablesPtr(m);
    if (wTargetState < 0 || wTargetState >= (m.u32((pTables2 + 0xc4) >>> 0) | 0)) {
      return 0;
    }
    m.setU32(pRadArgs, edi >>> 0);
    m.setU32((pRadArgs + 0x04) >>> 0, ebx >>> 0);
    m.setU32((pRadArgs + 0x08) >>> 0, nLen >>> 0);
    m.setU32((pRadArgs + 0x0c) >>> 0, wTargetState >>> 0);
    for (let j = 0; j < 6; j = (j + 1) | 0) {
      const wAuraStat = (m.u16((esi + 0x54 + j * 2) >>> 0) << 16) >> 16;
      m.setU32((pRadArgs + 0x10 + j * 4) >>> 0, wAuraStat >>> 0);
      m.setU32((pRadArgs + 0x28 + j * 4) >>> 0, 0);
      if (wAuraStat >= 0) {
        const v = SKILLS_EvalCalcByOffset113c(m, ebp, m.u32((esi + 0x68 + j * 4) >>> 0), edi, ebx) | 0;
        m.setU32((pRadArgs + 0x28 + j * 4) >>> 0, v >>> 0);
      }
    }
    const nRadius = SKILLS_EvalCalcByOffset113c(m, ebp, m.u32((esi + 0x64) >>> 0), edi, ebx) | 0;
    const dwFilter = m.u32((esi + 0x50) >>> 0) >>> 0;
    AURA_ForEachUnitInRadius113c(
      m,
      pGame0,
      ebp,
      0,
      0,
      nRadius,
      dwFilter,
      0x6fcb3850,
      pRadArgs,
      1,
      SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c,
    );
    return 1;
  } finally {
    freeScratch(0x6c);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB5120
 * @ordinalOrName SKILLS_TryConvertMonsterOnHit_6FCB5120
 *
 * Rolls monster conversion (`SKILLS_RollMonsterConversionChance_6FCB1610`), attaches/updates state `0x35` (`STATE_CONVERSION`)
 * with remove proc `0x6FCB14F0`, unlinks from minion list, switches alignment to `2` (`UNIT_ALIGNMENT_GOOD`) in the attacker's
 * subparty bucket, purges curse stat lists (`flag 8`), and scales down monster level/life (`STATE_CONVERSION_SAVE` `0x6D`) if higher than attacker level.
 */
export function SKILLS_TryConvertMonsterOnHit_6FCB5120_113c(
  m: SparseMemory113c,
  pConvArgs: number,
  pTargetMonster: number,
  pGame: number,
  pAttacker: number,
): number {
  hitD2GameVa113c(0x6FCB5120)
  const ebx = pConvArgs >>> 0;
  const esi = pTargetMonster >>> 0;
  const pGame0 = pGame >>> 0;
  const ebp = pAttacker >>> 0;
  if ((SKILLS_RollMonsterConversionChance_6FCB1610_113c(m, esi, ebp, m.u32((ebx + 4) >>> 0) | 0) | 0) === 0) {
    return 0;
  }
  const nRandDur = rollSeedPtr113c(m, (ebp + 0x20) >>> 0, m.u32((ebx + 0x0c) >>> 0) | 0) | 0;
  const ediExpire = (nRandDur + m.u32((pGame0 + 0xa8) >>> 0) + m.u32((ebx + 8) >>> 0)) >>> 0;
  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, esi, 0x35) >>> 0;
  if (pStatList === 0) {
    const dwOwnerType = ebp !== 0 ? m.u32(ebp) >>> 0 : 6;
    const dwOwnerGuid = ebp !== 0 ? m.u32((ebp + 0x0c) >>> 0) >>> 0 : 0xffffffff;
    // STATLIST_AllocList113c(m, flags, ownerType, ownerId, stateNo, expireFrame)
    pStatList = STATLIST_AllocList113c(
      m,
      0x802,
      dwOwnerType,
      dwOwnerGuid,
      0,
      ediExpire,
    ) >>> 0;
    if (pStatList === 0) {
      return 0;
    }
    STATLIST_SetState113c(m, pStatList, 0x35);
    STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcb14f0);
    STATLIST_MergeStatLists113c(m, esi, pStatList, 1);
    STATES_ToggleGfxStateFlag113c(m, esi, 0x35, 1);
  }
  STATLIST_SetExpireFrameEx113c(m, pStatList, ediExpire);
  EVENT_SetEventFull113c(m, pGame0, esi, 0x0c, ediExpire, 0, 0, 0);
  SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c(m, esi);
  SUNIT_SetMonsterAlignmentState113c(m, esi, 2, 1);
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(m, pGame0, esi, m.u32((ebp + 0xd0) >>> 0) | 0, 0);
  for (;;) {
    const pCurseList = STATLIST_GetStatListFromUnitAndFlag113c(m, esi, 8) >>> 0;
    if (pCurseList === 0) {
      break;
    }
    STATLIST_UnlinkSubList113c(m, esi, pCurseList);
    STATLIST_FreeStatListIfNonExtended113c(m, pCurseList);
  }
  UNITS_SetTargetUnitForDynamicUnit113c(m, ebp, 0);
  const nMonLvl = STATLIST_GetUnitStat113c(m, esi, 0x0c, 0) | 0;
  const nAttLvl = STATLIST_GetUnitStat113c(m, ebp, 0x0c, 0) | 0;
  if (nMonLvl !== 0 && nAttLvl < nMonLvl) {
    if ((STATLIST_GetStatListFromUnitAndStateMemPort113c(m, esi, 0x6d) >>> 0) === 0) {
      const dwMonType = esi !== 0 ? m.u32(esi) >>> 0 : 6;
      const dwMonGuid = esi !== 0 ? m.u32((esi + 0x0c) >>> 0) >>> 0 : 0xffffffff;
      // STATLIST_AllocList113c(m, flags, ownerType, ownerId, stateNo, expireFrame)
      const pLvlList = STATLIST_AllocList113c(
        m,
        0,
        dwMonType,
        dwMonGuid,
        0,
        0,
      ) >>> 0;
      if (pLvlList !== 0) {
        STATLIST_SetState113c(m, pLvlList, 0x6d);
        STATLIST_MergeStatLists113c(m, esi, pLvlList, 1);
        const curLifeShr8 = (STATLIST_GetUnitStat113c(m, esi, 6, 0) | 0) >> 8;
        const maxLifeShr8 = (STATLIST_GetMaxLifeFromUnit113c(m, esi) | 0) >> 8;
        STATLIST_SetStat113c(m, pLvlList, 0xb0, nMonLvl, 0);
        STATLIST_SetStat113c(m, pLvlList, 0xb1, maxLifeShr8, 0);
        // 0x6FCB52F7..0x6FCB5313: GAME_MulDiv(factor=nAttLvl, value=lifeShr8, divisor=nMonLvl)
        let scaledCur = (mulDiv113c(nAttLvl, curLifeShr8, nMonLvl) << 8) | 0;
        let scaledMax = (mulDiv113c(nAttLvl, maxLifeShr8, nMonLvl) << 8) | 0;
        if (scaledMax < 1) {
          scaledMax = 1;
        }
        if (scaledCur <= 1) {
          scaledCur = 1;
        }
        if (scaledCur >= scaledMax) {
          scaledCur = scaledMax;
        }
        STATLIST_SetUnitStat113c(m, esi, 0x0c, nAttLvl, 0);
        STATLIST_SetUnitStat113c(m, esi, 6, scaledCur, 0);
        STATLIST_SetUnitStat113c(m, esi, 7, scaledMax, 0);
      }
    }
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB5BC0
 * @ordinalOrName SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0
 *
 * `srvdofunc = 77` (`Inferno` / `Arctic Blast` channel tick): attaches state `0x0C` (`STATE_INFERNO`) with remove proc
 * `0x6FCB0F10` on initial frame (after verifying `wStartMana` at `+0x184`), or refreshes expiry (`dwGameFrame + 7`),
 * rewinds animation events if `pSkill->dwParam1 > dwGameFrame`, and fires `SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560`
 * followed by `SKILLS_ConsumeSkillManaOrCharge113c`.
 */
export function SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB5BC0)
  const edi = pGame >>> 0;
  const esi = pUnit >>> 0;
  const ebp = nSkillId | 0;
  const nLvl = nSkillLevel | 0;
  if (ebp < 0) {
    return 0;
  }
  const pTables = getSgptDataTablesPtr(m);
  if (ebp >= (m.u32((pTables + 0xba0) >>> 0) | 0)) {
    return 0;
  }
  const ebx = (m.u32((pTables + 0xb98) >>> 0) + imul32(ebp, 0x23c)) >>> 0;
  if (ebx === 0) {
    return 0;
  }
  if ((SKILLS_ResolveChargedSrvMissileId113c(m, ebp, esi) | 0) < 0) {
    return 0;
  }
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, esi, ebp) >>> 0;
  if (pSkill === 0) {
    return 0;
  }
  const pStateList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, esi, 0x0c) >>> 0;
  if (pStateList === 0) {
    const wStartMana = (m.u16((ebx + 0x184) >>> 0) << 16) >> 16;
    if (wStartMana > 0) {
      const curMana = STATLIST_GetUnitStat113c(m, esi, 8, 0) | 0;
      if (curMana < (wStartMana << 8)) {
        return 0;
      }
    }
    const nExpire = (m.u32((edi + 0xa8) >>> 0) + 0x15) >>> 0;
    const dwOwnerType = esi !== 0 ? m.u32(esi) >>> 0 : 6;
    const dwOwnerGuid = esi !== 0 ? m.u32((esi + 0x0c) >>> 0) >>> 0 : 0xffffffff;
    // STATLIST_AllocList113c(m, flags, ownerType, ownerId, stateNo, expireFrame)
    const pNewList = STATLIST_AllocList113c(
      m,
      2,
      dwOwnerType,
      dwOwnerGuid,
      0,
      nExpire,
    ) >>> 0;
    if (pNewList === 0) {
      return 0;
    }
    EVENT_SetEventFull113c(m, edi, esi, 0x0c, nExpire, 0, 0, 0);
    STATLIST_MergeStatLists113c(m, esi, pNewList, 1);
    STATLIST_SetStatRemoveProc113c(m, pNewList, 0x6fcb0f10);
    STATLIST_SetState113c(m, pNewList, 0x0c);
    STATES_ToggleGfxStateFlag113c(m, esi, 0x0c, 1);
    SKILLS_SetParam1113c(m, pSkill, 0);
    return 1;
  }
  const nExpire = (m.u32((edi + 0xa8) >>> 0) + 7) >>> 0;
  STATLIST_SetExpireFrameEx113c(m, pStateList, nExpire);
  EVENT_SetEventFull113c(m, edi, esi, 0x0c, nExpire, 0, 0, 0);
  const nNextFrame = SKILLS_GetParam1113c(m, pSkill) | 0;
  if (nNextFrame > (m.u32((edi + 0xa8) >>> 0) | 0)) {
    SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c(m, esi, edi, 1);
    return 1;
  }
  const fired = SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c(m, edi, esi, ebp, nLvl) | 0;
  if (fired !== 0) {
    SKILLS_ConsumeSkillManaOrCharge113c(m, esi, ebp, edi, nLvl);
  }
  return fired;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB5FE0
 * @ordinalOrName SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0
 *
 * `srvdofunc = 78` (`Dragon Talon` follow-up kick): resolves and executes the previous kick's combat damage and
 * progressive charges, decrements `pSkill->dwParam1` (remaining kicks), rolls knockback on the final kick
 * (`dwParam1 <= 0`), rolls hit/damage for the next kick (`0x6FCB2BB0`), and rewinds animation events if kicks remain.
 */
export function SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB5FE0)
  const ebp = pGame >>> 0;
  const esi = pUnit >>> 0;
  const nSkill = nSkillId | 0;
  const nLvl = nSkillLevel | 0;
  if (nSkill < 0) {
    return 0;
  }
  const pTables = getSgptDataTablesPtr(m);
  if (nSkill >= (m.u32((pTables + 0xba0) >>> 0) | 0)) {
    return 0;
  }
  const ebx = (m.u32((pTables + 0xb98) >>> 0) + imul32(nSkill, 0x23c)) >>> 0;
  if (ebx === 0) {
    return 0;
  }
  SUNIT_ValidatePathTargetUnit113c(m, esi, ebp);
  const edi = PATH_GetTargetUnit113c(m, m.u32((esi + 0x2c) >>> 0) >>> 0) >>> 0;
  if (edi === esi || edi === 0) {
    return 0;
  }
  const pDmg = SUNITDMG_FindCombatDamageData113c(m, esi, edi) >>> 0;
  // 0x6FCB1B70: checks pDmg != 0 && (pDmg->wResultFlags & 1) before consuming charges
  if (pDmg !== 0 && (m.u8((pDmg + 0x04) >>> 0) & 1) !== 0) {
    SKILLS_ConsumeProgressiveChargesOnHit113c(m, 0, esi, ebp);
  }
  SUNITDMG_ExecuteEvents113c(m, ebp, esi, edi, 1, 0);
  const pSkill = SKILLS_GetUsedSkill113c(m, esi) >>> 0;
  if (pSkill === 0) {
    return 0;
  }
  const nRem = ((SKILLS_GetParam1113c(m, pSkill) | 0) - 1) | 0;
  if (nRem < 0) {
    return 0;
  }
  SKILLS_SetParam1113c(m, pSkill, nRem);
  let bKnockback = 0;
  if (nRem <= 0) {
    const stat1 = STATLIST_GetUnitStat113c(m, edi, 0x0c, 0) | 0;
    const stat2 = STATLIST_GetUnitStat113c(m, edi, 0x0c, 0) | 0;
    let clampedLvl = (stat1 + nLvl - stat2) | 0;
    if (clampedLvl <= 1) {
      clampedLvl = 1;
    }
    if (clampedLvl >= nLvl) {
      clampedLvl = nLvl;
    }
    let bEvalCalc = true;
    let dwCalc = 0;
    if ((m.u32(edi) | 0) === 0 || (MONSTERS_GetHirelingTypeId113c(m, edi) | 0) !== 0) {
      dwCalc = m.u32((ebx + 0x144) >>> 0) >>> 0;
    } else if ((MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, edi) | 0) !== 0) {
      dwCalc = m.u32((ebx + 0x140) >>> 0) >>> 0;
    } else if ((MONSTER_CheckTypeFlagsMask113c(m, edi, 8) | 0) !== 0) {
      dwCalc = m.u32((ebx + 0x13c) >>> 0) >>> 0;
    } else {
      bEvalCalc = false;
    }
    let chance = 0x64;
    if (bEvalCalc) {
      chance = SKILLS_EvalCalcByOffset113c(m, esi, dwCalc, nSkill, clampedLvl) | 0;
    }
    if (chance > 0) {
      if ((rollSeedPtr113c(m, (esi + 0x20) >>> 0, 0x64) | 0) < chance) {
        bKnockback = 1;
      }
    }
  }
  rollHitAndAllocKickProgressiveCombatFixed113c(
    m,
    nSkill,
    ebp,
    esi,
    edi,
    ebx,
    nLvl,
    bKnockback,
  );
  SUNITDMG_ExecuteEvents113c(m, ebp, esi, edi, 1, 0);
  if (nRem > 0) {
    m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) & 0xffffffbf) >>> 0);
    SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c(m, esi, 0x64);
  }
  return 1;
}

export function dragonTailKickHitFixed113c(
  m: SparseMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  return SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c(m, pGame, pAttacker, nSkillId, nSkillLevel)
}

export function dragonFlightStrikeFixed113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  const game = pGame >>> 0
  const att = pUnit >>> 0
  const skillId = nSkillId | 0
  const slvl = nSkillLevel | 0
  if (skillId < 0) return 0
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 0
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, att, game)
  const pPath = att !== 0 ? (m.u32((att + 0x2c) >>> 0) >>> 0) : 0
  const def = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (def === att || def === 0) return 0

  const pDmg = allocScratch(m, 0x70)
  try {
    const nToHitBonus =
      ((SKILLS_GetSkillToHitBonus113c(m, att, skillId, slvl) | 0) +
        (STATLIST_GetUnitStat113c(m, att, 0x145, 0) | 0)) |
      0
    const wRoll =
      SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, att, def, game, nToHitBonus, 0, 0) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wRoll)
    if ((wRoll & 1) !== 0) {
      m.setU32(
        (pDmg + 0x0c) >>> 0,
        SKILLS_EvalLinearParam12_6FC21B10_113c(m, skillId, slvl) >>> 0,
      )
      calcKickAndProgressiveFinishDamageFixed113c(m, att, game, pDmg, def, skillId, slvl)
    }
    const srcDamRaw = m.u8((pSkillsTxt + 0x1a5) >>> 0)
    const srcDam = srcDamRaw !== 0 ? srcDamRaw : 0x80
    SUNITDMG_AllocCombat113c(m, game, att, def, pDmg, srcDam)
    const pCombatDmg = SUNITDMG_FindCombatDamageData113c(m, att, def) >>> 0
    if (pCombatDmg !== 0 && (m.u8((pCombatDmg + 0x04) >>> 0) & 1) !== 0) {
      SKILLS_ConsumeProgressiveChargesOnHit113c(m, 0, att, game)
    }
    SUNITDMG_ExecuteEvents113c(m, game, att, def, 1, 0)
    return 1
  } finally {
    freeScratch(0x70)
  }
}
